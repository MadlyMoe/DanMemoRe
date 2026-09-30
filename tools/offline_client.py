"""Build, serve, and install the isolated DanMemoRe Android client."""

from __future__ import annotations

import argparse
import hashlib
import http.server
import json
import os
from pathlib import Path, PurePosixPath
import secrets
import shutil
import struct
import subprocess
import tempfile
import threading
import time
from urllib.parse import unquote, urlsplit
import zipfile
import zlib


ROOT = Path(__file__).resolve().parents[1]
CONTENTS = ROOT / "contents"
SOURCE_APK = CONTENTS / "com.eu.danmemo_2023-12-22.apk"
WORK = ROOT / ".work"
DIST = ROOT / "dist"
OUTPUT_APK = DIST / "danmemore-offline.apk"
IDENTITY = DIST / "danmemore-offline.json"
ORIGINAL_PACKAGE = "com.eu.danmemo"
PRIVATE_PACKAGE = "com.eu.danmore"  # Same width keeps binary resource offsets stable.
PORT = 28766
ENDPOINT = f"http://127.0.0.1:{PORT}"
URL_PATCHES = {
    b"https://api-danmemo-eu.wrightflyer.net": f"{ENDPOINT}/api".encode(),
    b"https://cdn-danmemo.akamaized.net/eu": f"{ENDPOINT}/content".encode(),
    b"https://tdsdk-danmemo-eu.wrightflyer.net": f"{ENDPOINT}/telemetry".encode(),
    b"https://bn-payment-us.wrightflyer.net": f"{ENDPOINT}/billing".encode(),
    b"https://storage.googleapis.com/argo-ap4zsi86n4q": f"{ENDPOINT}/storage".encode(),
}


def run(command: list[Path | str], *, env: dict[str, str] | None = None) -> str:
    process = subprocess.run(
        [str(value) for value in command], capture_output=True, timeout=180, env=env
    )
    output = (process.stdout + process.stderr).decode(errors="replace")
    if process.returncode:
        raise RuntimeError(output[-4000:])
    return output


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def xml_chunks(data: bytes) -> list[tuple[int, bytearray]]:
    if len(data) < 8 or struct.unpack_from("<HH", data) != (3, 8):
        raise ValueError("Expected a binary Android XML document")
    size, = struct.unpack_from("<I", data, 4)
    if size != len(data):
        raise ValueError("Binary XML size mismatch")
    result = []
    at = 8
    while at < len(data):
        if at + 8 > len(data):
            raise ValueError("Truncated XML chunk")
        kind, header, size = struct.unpack_from("<HHI", data, at)
        if header < 8 or size < header or at + size > len(data):
            raise ValueError("Invalid XML chunk bounds")
        result.append((kind, bytearray(data[at : at + size])))
        at += size
    return result


def patch_manifest(data: bytes) -> bytes:
    old = ORIGINAL_PACKAGE.encode("utf-16le")
    new = PRIVATE_PACKAGE.encode("utf-16le")
    if len(old) != len(new) or data.count(old) != 10:
        raise ValueError("Unexpected package references in AndroidManifest.xml")
    data = data.replace(old, new)
    parts = xml_chunks(data)
    pool, = [part for kind, part in parts if kind == 1]
    count, styles, flags, start, style_start = struct.unpack_from("<IIIII", pool, 8)
    if styles or style_start or flags & 0x100 or start != 28 + count * 4:
        raise ValueError("Expected an unstyled UTF-16 manifest string pool")
    offsets = list(struct.unpack_from(f"<{count}I", pool, 28))
    strings = []
    for offset in offsets:
        at = start + offset
        length, = struct.unpack_from("<H", pool, at)
        end = at + 2 + length * 2
        if length & 0x8000 or end + 2 > len(pool) or pool[end : end + 2] != b"\0\0":
            raise ValueError("Unexpected manifest string encoding")
        strings.append(pool[at + 2 : end].decode("utf-16le"))
    if "usesCleartextTraffic" in strings:
        raise ValueError("Review the existing cleartext policy before patching")
    text = bytearray(pool[start:])
    for value in ("usesCleartextTraffic", "DanMemoRe"):
        offsets.append(len(text))
        text += struct.pack("<H", len(value)) + value.encode("utf-16le") + b"\0\0"
    text += b"\0" * (-len(text) % 4)
    new_start = 28 + 4 * len(offsets)
    pool[:] = (
        struct.pack(
            "<HHIIIIII", 1, 28, new_start + len(text), len(offsets), 0, flags & ~1, new_start, 0
        )
        + struct.pack(f"<{len(offsets)}I", *offsets)
        + text
    )
    resource_map, = [part for kind, part in parts if kind == 0x180]
    ids = list(struct.unpack_from(f"<{(len(resource_map) - 8) // 4}I", resource_map, 8))
    if len(ids) > count:
        raise ValueError("Invalid binary XML resource map")
    ids += [0] * (count + 2 - len(ids))
    ids[count] = 0x010104EC
    resource_map[:] = (
        struct.pack("<HHI", 0x180, 8, 8 + len(ids) * 4)
        + struct.pack(f"<{len(ids)}I", *ids)
    )
    applications = 0
    for kind, part in parts:
        if kind != 0x102:
            continue
        name, = struct.unpack_from("<I", part, 20)
        if strings[name] != "application":
            continue
        applications += 1
        attr_start, width, number, id_index, class_index, style_index = struct.unpack_from(
            "<HHHHHH", part, 24
        )
        if (
            attr_start != 20
            or width != 20
            or id_index
            or class_index
            or style_index
            or len(part) != 36 + number * 20
        ):
            raise ValueError("Unexpected application attribute layout")
        attrs = [bytes(part[36 + i * 20 : 56 + i * 20]) for i in range(number)]
        labels = [
            i
            for i, attr in enumerate(attrs)
            if ids[struct.unpack_from("<I", attr, 4)[0]] == 0x01010001
        ]
        if len(labels) != 1:
            raise ValueError("Expected one application label")
        label_index = labels[0]
        namespace, label = struct.unpack_from("<II", attrs[label_index])
        attrs[label_index] = struct.pack(
            "<IIIHBBI", namespace, label, count + 1, 8, 0, 3, count + 1
        )
        attrs.append(
            struct.pack("<IIIHBBI", namespace, count, 0xFFFFFFFF, 8, 0, 0x12, 0xFFFFFFFF)
        )
        attrs.sort(key=lambda attr: ids[struct.unpack_from("<I", attr, 4)[0]])
        part[:] = part[:36] + b"".join(attrs)
        struct.pack_into("<I", part, 4, len(part))
        struct.pack_into("<H", part, 28, number + 1)
    if applications != 1:
        raise ValueError("Expected one application element")
    payload = b"".join(part for _, part in parts)
    return struct.pack("<HHI", 3, 8, len(payload) + 8) + payload


def patch_c_string(data: bytes, old: bytes, new: bytes) -> bytes:
    if not new or len(new) >= len(old) or data.count(old) != 1:
        raise ValueError(f"Unexpected fixed-width URL patch: {old!r}")
    return data.replace(old, new + b"\0" * (len(old) - len(new)))


def patch_dex(data: bytes) -> bytes:
    old, new = ORIGINAL_PACKAGE.encode(), PRIVATE_PACKAGE.encode()
    if data.count(old) != 1 or len(old) != len(new):
        raise ValueError("Unexpected package identity in classes.dex")
    data = bytearray(data.replace(old, new))
    data[12:32] = hashlib.sha1(data[32:]).digest()
    struct.pack_into("<I", data, 8, zlib.adler32(data[12:]) & 0xFFFFFFFF)
    return bytes(data)


def find_android_tools() -> tuple[Path, Path, Path, Path, Path, Path]:
    candidates = [
        Path(value)
        for value in (os.environ.get("ANDROID_SDK_ROOT"), os.environ.get("ANDROID_HOME"))
        if value
    ]
    candidates += [
        Path.home() / "AppData/Local/Android/Sdk",
        Path("C:/Main/Productivity/Coding/Android/Sdk"),
    ]
    sdk = next((path for path in candidates if path.is_dir()), None)
    if not sdk:
        raise FileNotFoundError("Android SDK not found; set ANDROID_SDK_ROOT")
    versions = sorted(
        (path for path in (sdk / "build-tools").iterdir() if (path / "zipalign.exe").exists()),
        reverse=True,
    )
    if not versions:
        raise FileNotFoundError("Android SDK build tools not found")
    tools = versions[0]
    java_home = Path(os.environ.get("JAVA_HOME", "C:/Program Files/Android/Android Studio/jbr"))
    java, keytool = java_home / "bin/java.exe", java_home / "bin/keytool.exe"
    adb = sdk / "platform-tools/adb.exe"
    required = (tools / "zipalign.exe", tools / "aapt.exe", tools / "lib/apksigner.jar", java, keytool, adb)
    if missing := [str(path) for path in required if not path.exists()]:
        raise FileNotFoundError("Missing Android tools: " + ", ".join(missing))
    return (
        tools / "zipalign.exe",
        tools / "aapt.exe",
        tools / "lib/apksigner.jar",
        java,
        keytool,
        adb,
    )


def build() -> None:
    if not SOURCE_APK.is_file():
        raise FileNotFoundError(f"Original APK not found: {SOURCE_APK}")
    WORK.mkdir(exist_ok=True)
    DIST.mkdir(exist_ok=True)
    zipalign, aapt, signer, java, keytool, _adb = find_android_tools()
    password_path, keystore = WORK / "local-key.password", WORK / "local-key.p12"
    if password_path.exists() != keystore.exists():
        raise ValueError("Incomplete local signing identity in .work")
    if not keystore.exists():
        password_path.write_text(secrets.token_hex(24) + "\n", encoding="ascii")
        env = os.environ | {"DANMEMORE_KEY_PASSWORD": password_path.read_text().strip()}
        run(
            [
                keytool,
                "-genkeypair",
                "-keystore",
                keystore,
                "-storetype",
                "PKCS12",
                "-alias",
                "danmemore-local",
                "-storepass:env",
                "DANMEMORE_KEY_PASSWORD",
                "-keyalg",
                "RSA",
                "-keysize",
                "2048",
                "-validity",
                "3650",
                "-dname",
                "CN=DanMemoRe Local Client",
            ],
            env=env,
        )
    password = password_path.read_text(encoding="ascii").strip()
    with tempfile.TemporaryDirectory(prefix="apk-", dir=WORK) as temp_name:
        temp = Path(temp_name)
        unsigned, aligned, signed = temp / "unsigned.apk", temp / "aligned.apk", temp / "signed.apk"
        changes = []
        with zipfile.ZipFile(SOURCE_APK) as source, zipfile.ZipFile(unsigned, "w") as target:
            for entry in source.infolist():
                name = entry.filename
                if name == "stamp-cert-sha256" or (
                    name.startswith("META-INF/")
                    and (name == "META-INF/MANIFEST.MF" or name.endswith((".RSA", ".DSA", ".EC", ".SF")))
                ):
                    continue
                data = source.read(entry)
                before = hashlib.sha256(data).hexdigest()
                if name == "AndroidManifest.xml":
                    data = patch_manifest(data)
                elif name == "resources.arsc":
                    old, new = ORIGINAL_PACKAGE.encode("utf-16le"), PRIVATE_PACKAGE.encode("utf-16le")
                    if data.count(old) != 1:
                        raise ValueError("Unexpected package identity in resources.arsc")
                    data = data.replace(old, new)
                elif name == "classes.dex":
                    data = patch_dex(data)
                elif name == "lib/armeabi-v7a/libapp.so":
                    for old, new in URL_PATCHES.items():
                        data = patch_c_string(data, old, new)
                after = hashlib.sha256(data).hexdigest()
                if before != after:
                    changes.append({"member": name, "before_sha256": before, "after_sha256": after})
                target.writestr(entry, data)
        run([zipalign, "-P", "16", "4", unsigned, aligned])
        env = os.environ | {"DANMEMORE_KEY_PASSWORD": password}
        run(
            [
                java,
                "-jar",
                signer,
                "sign",
                "--min-sdk-version",
                "19",
                "--ks",
                keystore,
                "--ks-pass",
                "env:DANMEMORE_KEY_PASSWORD",
                "--v1-signing-enabled",
                "true",
                "--v2-signing-enabled",
                "true",
                "--v3-signing-enabled",
                "true",
                "--v4-signing-enabled",
                "false",
                "--out",
                signed,
                aligned,
            ],
            env=env,
        )
        verification = run(
            [java, "-jar", signer, "verify", "--verbose", "--print-certs", signed]
        )
        tree = run([aapt, "dump", "xmltree", signed, "AndroidManifest.xml"])
        required = (
            f'package="{PRIVATE_PACKAGE}"',
            "usesCleartextTraffic(0x010104ec)=(type 0x12)0xffffffff",
            '="DanMemoRe"',
        )
        if any(value not in tree for value in required):
            raise ValueError("Patched manifest did not validate")
        shutil.copy2(signed, OUTPUT_APK)
    signer_digest = next(
        line.rsplit(":", 1)[1].strip()
        for line in verification.splitlines()
        if "certificate SHA-256 digest:" in line
    )
    identity = {
        "project": "DanMemoRe",
        "purpose": "isolated local routing client; unknown game routes fail closed",
        "source_apk": {"bytes": SOURCE_APK.stat().st_size, "sha256": sha256(SOURCE_APK)},
        "output_apk": {"bytes": OUTPUT_APK.stat().st_size, "sha256": sha256(OUTPUT_APK)},
        "package": PRIVATE_PACKAGE,
        "endpoint": ENDPOINT,
        "signer_sha256": signer_digest,
        "patched_urls": {old.decode(): new.decode() for old, new in URL_PATCHES.items()},
        "changed_members": changes,
    }
    IDENTITY.write_text(json.dumps(identity, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(identity, indent=2))


def content_path(request_path: str) -> Path | None:
    path = unquote(urlsplit(request_path).path)
    prefix = next((value for value in ("/content/", "/storage/") if path.startswith(value)), None)
    if not prefix:
        return None
    parts = PurePosixPath(path[len(prefix) :]).parts
    if not parts or any(part in ("", ".", "..") for part in parts):
        return None
    candidate = (CONTENTS / Path(*parts)).resolve()
    root = CONTENTS.resolve()
    return candidate if candidate == root or root in candidate.parents else None


class LocalHandler(http.server.BaseHTTPRequestHandler):
    server_version = "DanMemoRe/0"

    def log_message(self, _format: str, *_args: object) -> None:
        pass

    def record(self, body: bytes) -> None:
        WORK.mkdir(exist_ok=True)
        row = {
            "time": int(time.time()),
            "method": self.command,
            "path": urlsplit(self.path).path,
            "header_names": sorted(name.lower() for name in self.headers),
            "body_bytes": len(body),
            "body_sha256": hashlib.sha256(body).hexdigest(),
        }
        with self.server.log_lock:
            with (WORK / "requests.jsonl").open("a", encoding="utf-8") as log:
                log.write(json.dumps(row, separators=(",", ":")) + "\n")
        print(json.dumps(row), flush=True)

    def do_HEAD(self) -> None:
        self.serve_file(head_only=True)

    def do_GET(self) -> None:
        if urlsplit(self.path).path == "/health":
            body = b'{"status":"ok"}\n'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.serve_file(head_only=False)

    def serve_file(self, *, head_only: bool) -> None:
        path = content_path(self.path)
        if path and path.is_file():
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(path.stat().st_size))
            self.end_headers()
            if not head_only:
                with path.open("rb") as source:
                    shutil.copyfileobj(source, self.wfile)
            return
        self.record(b"")
        self.unknown()

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        if length < 0 or length > 64 * 1024 * 1024:
            self.send_error(413)
            return
        body = self.rfile.read(length)
        self.record(body)
        self.unknown()

    def unknown(self) -> None:
        body = b'{"error":"unimplemented local route"}\n'
        self.send_response(503)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("SERVER-TIMESTAMP", str(int(time.time())))
        self.send_header("SERVER-VERSION", "0")
        self.send_header("SERVER-RESPONSE-CODE", "503")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)


def serve() -> None:
    if not CONTENTS.is_dir():
        raise FileNotFoundError(f"Extracted contents not found: {CONTENTS}")
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), LocalHandler)
    server.log_lock = threading.Lock()
    print(json.dumps({"listening": ENDPOINT, "request_log": str(WORK / "requests.jsonl")}))
    server.serve_forever()


def install() -> None:
    if not OUTPUT_APK.is_file():
        raise FileNotFoundError("Build the offline APK first")
    *_, adb = find_android_tools()
    lines = run([adb, "devices"]).splitlines()[1:]
    devices = [line.split()[0] for line in lines if line.strip().endswith("\tdevice")]
    if len(devices) != 1:
        raise RuntimeError(f"Expected one running Android device, found {devices or 'none'}")
    serial = devices[0]
    run([adb, "-s", serial, "reverse", f"tcp:{PORT}", f"tcp:{PORT}"])
    print(run([adb, "-s", serial, "install", "-r", OUTPUT_APK]).strip())
    run([adb, "-s", serial, "shell", "am", "force-stop", PRIVATE_PACKAGE])
    print(
        run(
            [
                adb,
                "-s",
                serial,
                "shell",
                "am",
                "start",
                "-n",
                f"{PRIVATE_PACKAGE}/net.wrightflyer.toybox.AppActivity",
            ]
        ).strip()
    )


def self_test() -> None:
    assert patch_c_string(b"before-old-after", b"old", b"x") == b"before-x\0\0-after"
    assert content_path("/content/1/version.manifest") == (CONTENTS / "1/version.manifest").resolve()
    assert content_path("/content/../README.md") is None
    with zipfile.ZipFile(SOURCE_APK) as archive:
        manifest = patch_manifest(archive.read("AndroidManifest.xml"))
    assert PRIVATE_PACKAGE.encode("utf-16le") in manifest
    assert ORIGINAL_PACKAGE.encode("utf-16le") not in manifest
    xml_chunks(manifest)
    print("PASS: fixed-width routing, safe content paths, and binary manifest patch")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("build", "serve", "install", "self-test"))
    command = parser.parse_args().command
    {"build": build, "serve": serve, "install": install, "self-test": self_test}[command]()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
    except Exception as error:
        raise SystemExit(f"error: {error}") from None
