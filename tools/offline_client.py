"""Build, serve, and install the isolated DanMemoRe Android client."""

from __future__ import annotations

import argparse
import functools
import hashlib
import http.server
import io
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
ARM64_XAPK = WORK / "danmemo-15.1.0-arm64.xapk"
ARM64_XAPK_SHA256 = "f783eeca9db7e690f82f4995fd831d6b8f1066f7954efabce0fb379d95affe82"
ARM64_SOURCE = WORK / "xapk"
ARM64_OUTPUT = DIST / "danmemore-arm64"
ARM64_APKS = (
    "com.eu.danmemo.apk",
    "config.arm64_v8a.apk",
    "config.en.apk",
    "config.fr.apk",
    "config.mdpi.apk",
    "AssetPack1.apk",
)
IDENTITY = DIST / "danmemore-offline.json"
ORIGINAL_PACKAGE = "com.eu.danmemo"
PRIVATE_PACKAGE = "com.eu.danmore"  # Same width keeps binary resource offsets stable.
PORT = 28766
ENDPOINT = f"http://127.0.0.1:{PORT}"
LOCAL_USER_ID = 1000000001
LOCAL_AES_IV = "DanMemoReLocalIV"
LOCAL_AES_KEY = b"JsfcytENstRNhJBfkNQCCKb62jbZYccX"
LOCAL_TOKEN = "00000000000000000000000000000001"
HOME_CHARACTER_TOKEN = "132d52133a41bfb630af4effa24aeb54"
API_ACTIONS = (
    "matching_user/game_user_id",
    "user/login",
    "user_data/confirm",
    "user_data/push",
    "user_data/pull",
)
URL_PATCHES = {
    b"https://api-danmemo-eu.wrightflyer.net": f"{ENDPOINT}/danmemore-local".encode(),
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
    if not new or len(new) > len(old) or data.count(old) != 1:
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


def patch_service_dependencies(data: bytes) -> bytes:
    patches = (
        (
            bytes.fromhex("1a019c097230710017000a076a072425"),
            bytes.fromhex("1a019c097230710017040a076a072425"),
            "Google Play auto-sign-in",
        ),
        (
            bytes.fromhex("0801100054129e07380273016e10b40b0200"),
            bytes.fromhex("0801100054129e07290073016e10b40b0200"),
            "GREE response signature",
        ),
    )
    for old, new, name in patches:
        if data.count(old) != 1:
            raise ValueError(f"Unexpected {name} bytecode")
        data = data.replace(old, new)
    data = bytearray(data)
    data[12:32] = hashlib.sha1(data[32:]).digest()
    struct.pack_into("<I", data, 8, zlib.adler32(data[12:]) & 0xFFFFFFFF)
    return bytes(data)


def patch_native_client(data: bytes, abi: str) -> bytes:
    if abi != "arm64-v8a":
        return data
    # The retired backend created party IDs starting at 1, but this frozen build
    # initializes activePartyId to 0 and dereferences the missing party on startup.
    # ponytail: force the first party on ARM64; preserve arbitrary selections once
    # server-side profile persistence replaces the client-only bootstrap.
    offset = 0x24ABD70
    old = bytes.fromhex("e103152a")  # mov w1, w21
    new = bytes.fromhex("21008052")  # mov w1, #1
    if data[offset : offset + len(old)] != old:
        raise ValueError("Unexpected ARM64 party-selection code")
    return data[:offset] + new + data[offset + len(old) :]


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


def patch_and_sign_apk(
    source_apk: Path,
    output_apk: Path,
    primary: bool,
    tools: tuple[Path, Path, Path, Path, Path],
    keystore: Path,
    password: str,
) -> tuple[list[dict[str, str]], str]:
    zipalign, aapt, signer, java, _keytool = tools
    with tempfile.TemporaryDirectory(prefix="apk-", dir=WORK) as temp_name:
        temp = Path(temp_name)
        unsigned, aligned, signed = temp / "unsigned.apk", temp / "aligned.apk", temp / "signed.apk"
        changes = []
        with zipfile.ZipFile(source_apk) as source, zipfile.ZipFile(unsigned, "w") as target:
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
                    if primary:
                        data = patch_manifest(data)
                    else:
                        old, new = ORIGINAL_PACKAGE.encode("utf-16le"), PRIVATE_PACKAGE.encode("utf-16le")
                        if data.count(old) != 1:
                            raise ValueError(f"Unexpected split package identity in {source_apk.name}")
                        data = data.replace(old, new)
                elif name == "resources.arsc":
                    old, new = ORIGINAL_PACKAGE.encode("utf-16le"), PRIVATE_PACKAGE.encode("utf-16le")
                    if data.count(old) not in (0, 1):
                        raise ValueError("Unexpected package identity in resources.arsc")
                    data = data.replace(old, new)
                elif name == "classes.dex":
                    data = patch_dex(data)
                elif name == "classes3.dex":
                    data = patch_service_dependencies(data)
                elif name.endswith("/libapp.so"):
                    for old, new in URL_PATCHES.items():
                        data = patch_c_string(data, old, new)
                    data = patch_native_client(data, Path(name).parent.name)
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
            [
                java,
                "-jar",
                signer,
                "verify",
                "--min-sdk-version",
                "19",
                "--verbose",
                "--print-certs",
                signed,
            ]
        )
        tree = run([aapt, "dump", "xmltree", signed, "AndroidManifest.xml"])
        required = (
            f'package="{PRIVATE_PACKAGE}"',
            "usesCleartextTraffic(0x010104ec)=(type 0x12)0xffffffff",
            '="DanMemoRe"',
        )
        if any(value not in tree for value in required):
            if primary or f'package="{PRIVATE_PACKAGE}"' not in tree:
                raise ValueError(f"Patched manifest did not validate: {source_apk.name}")
        output_apk.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(signed, output_apk)
    signer_digest = next(
        line.rsplit(":", 1)[1].strip()
        for line in verification.splitlines()
        if "certificate SHA-256 digest:" in line
    )
    return changes, signer_digest


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
    tools = zipalign, aapt, signer, java, keytool
    changes, signer_digest = patch_and_sign_apk(
        SOURCE_APK, OUTPUT_APK, True, tools, keystore, password
    )
    arm64_outputs = []
    if ARM64_XAPK.is_file():
        if sha256(ARM64_XAPK) != ARM64_XAPK_SHA256:
            raise ValueError("Unexpected APKPure arm64 XAPK hash")
        ARM64_SOURCE.mkdir(exist_ok=True)
        with zipfile.ZipFile(ARM64_XAPK) as bundle:
            for name in ARM64_APKS:
                (ARM64_SOURCE / name).write_bytes(bundle.read(name))
        for name in ARM64_APKS:
            source = ARM64_SOURCE / name
            output = ARM64_OUTPUT / name
            split_changes, split_signer = patch_and_sign_apk(
                source, output, name == "com.eu.danmemo.apk", tools, keystore, password
            )
            if split_signer != signer_digest:
                raise ValueError("Split APK signer mismatch")
            arm64_outputs.append(
                {
                    "file": str(output.relative_to(ROOT)),
                    "bytes": output.stat().st_size,
                    "sha256": sha256(output),
                    "changed_members": split_changes,
                }
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
        "arm64_outputs": arm64_outputs,
    }
    IDENTITY.write_text(json.dumps(identity, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(identity, indent=2))


def content_path(request_path: str) -> Path | None:
    path = unquote(urlsplit(request_path).path)
    name = PurePosixPath(path).name
    if path.startswith(("/api/asset/manifest/", "/content/asset/manifest/")) and name.startswith("version.manifest."):
        phase = name.rpartition(".")[2]
        candidate = CONTENTS / phase / "version.manifest"
        return candidate if phase in tuple("12345678") and candidate.is_file() else None
    parts = PurePosixPath(path).parts
    if path.startswith(("/api/manifests/us/pkm/", "/content/manifests/us/pkm/")) and len(parts) >= 2:
        name = parts[-2]
        if name.startswith("project.manifest."):
            phase = name.rpartition(".")[2]
            return local_project_manifest(phase) if phase in tuple("12345678") else None
        candidate = CONTENTS / "1" / "manifests" / name
        return candidate if candidate.is_file() else None
    if path.startswith(("/api/contents/", "/content/contents/")):
        return asset_paths().get(path)
    prefix = next((value for value in ("/content/", "/storage/") if path.startswith(value)), None)
    if not prefix:
        return None
    parts = PurePosixPath(path[len(prefix) :]).parts
    if not parts or any(part in ("", ".", "..") for part in parts):
        return None
    candidate = (CONTENTS / Path(*parts)).resolve()
    root = CONTENTS.resolve()
    return candidate if candidate == root or root in candidate.parents else None


@functools.lru_cache(maxsize=8)
def local_project_manifest(phase: str) -> Path:
    WORK.mkdir(exist_ok=True)
    source_root = CONTENTS / phase
    manifest = json.loads((source_root / "project.manifest").read_text(encoding="utf-8"))
    for relative, metadata in list(manifest["assets"].items()):
        path = source_root / relative
        if not path.is_file():
            del manifest["assets"][relative]
            continue
        with path.open("rb") as file:
            metadata["md5"] = hashlib.file_digest(file, "md5").hexdigest()
        metadata["size"] = path.stat().st_size
    output = WORK / f"project.manifest.{phase}.local"
    output.write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
    return output


@functools.lru_cache(maxsize=1)
def asset_paths() -> dict[str, Path]:
    result = {}
    for phase in "12345678":
        manifest = json.loads((CONTENTS / phase / "project.manifest").read_text(encoding="utf-8"))
        for relative, metadata in manifest["assets"].items():
            result["/api/" + metadata["path"]] = CONTENTS / phase / Path(relative)
            result["/content/" + metadata["path"]] = CONTENTS / phase / Path(relative)
    return result


def byte_range(value: str | None, size: int) -> tuple[int, int, bool]:
    if not value:
        return 0, size - 1, False
    unit, separator, spec = value.partition("=")
    start_text, dash, end_text = spec.partition("-")
    if unit != "bytes" or separator != "=" or dash != "-" or not start_text:
        raise ValueError("Unsupported Range header")
    start = int(start_text)
    end = min(int(end_text), size - 1) if end_text else size - 1
    if start < 0 or start > end or start >= size:
        raise ValueError("Range outside file")
    return start, end, True


def api_action(request_path: str) -> str | None:
    path = urlsplit(request_path).path.rstrip("/")
    return next((action for action in API_ACTIONS if path.endswith("/" + action)), None)


def decode_request(body: bytes) -> dict:
    process = subprocess.run(
        [
            "openssl",
            "enc",
            "-d",
            "-aes-256-cbc",
            "-nopad",
            "-K",
            LOCAL_AES_KEY.hex(),
            "-iv",
            LOCAL_AES_IV.encode().hex(),
        ],
        input=body,
        capture_output=True,
    )
    if process.returncode:
        raise ValueError("Could not decrypt the local client request")
    value = json.loads(zlib.decompress(process.stdout))
    if not isinstance(value, dict):
        raise ValueError("Expected a request object")
    return value


def push_response(value: dict) -> dict:
    deltas = value.get("deltas")
    checksums = value.get("checksums")
    if not isinstance(deltas, list) or not isinstance(checksums, dict):
        raise ValueError("Unsupported user-data push")
    after = checksums.get("after")
    if not isinstance(after, dict):
        raise ValueError("Unsupported user-data checksums")
    puts: dict[str, int] = {}
    deletes: dict[str, int] = {}
    triggers = []
    for delta in deltas:
        if not isinstance(delta, dict) or not isinstance(delta.get("trigger"), str):
            raise ValueError("Unsupported user-data delta")
        triggers.append(delta["trigger"])
        for result, name in ((puts, "putItems"), (deletes, "deleteItems")):
            items = delta.get(name)
            if not isinstance(items, dict):
                raise ValueError("Unsupported user-data items")
            for table, rows in items.items():
                if not isinstance(table, str) or not isinstance(rows, list):
                    raise ValueError("Unsupported user-data table")
                result[table] = result.get(table, 0) + len(rows)
    return {
        "code": 0,
        "triggers": triggers,
        "putItems": puts,
        "deleteItems": deletes or [],
        "data": {},
        "operations": [],
        "dones": [],
        "dataTokens": after,
    }


def msgpack_string(value: str) -> bytes:
    encoded = value.encode()
    if len(encoded) <= 31:
        return bytes((0xA0 | len(encoded),)) + encoded
    if len(encoded) <= 255:
        return bytes((0xD9, len(encoded))) + encoded
    raise ValueError("User-data table name is too long")


def pull_response(value: dict) -> bytes:
    tables = value.get("tables")
    if not isinstance(tables, list) or not tables or not all(isinstance(table, str) for table in tables):
        raise ValueError("Unsupported user-data pull")
    if tables == ["UserCommunicationCharacter"]:
        # Client validation requires one unlocked home character on a fresh account.
        return bytes.fromhex(
            "83a46461746181ba55736572436f6d6d756e69636174696f6e436861726163746572"
            "9188a6757365724964ce3b9aca01ab6368617261637465724964ce05f5e105a97369676e6174"
            "75726500a9636f7374756d654964ce3ceae4f8ae636861"
            "726163746572537461746502ac6a6f696e4461746554696d6500ae746f756368436f"
            "756e744275737400af746f756368436f756e744f7468657200aa64617461546f6b65"
            "6e7381ba55736572436f6d6d756e69636174696f6e436861726163746572d9203133"
            "326435323133336134316266623633306166346566666132346165623534a8726563"
            "6f76657279c2"
        )
    if len(tables) > 15:
        raise ValueError("Too many user-data tables in one pull")
    names = b"".join(msgpack_string(table) + b"\x90" for table in tables)
    tokens = b"".join(msgpack_string(table) + b"\xa0" for table in tables)
    header = bytes((0x80 | len(tables),))
    return b"\x83\xa4data" + header + names + b"\xaadataTokens" + header + tokens + b"\xa8recovery\xc2"


def api_response(action: str, request_body: bytes = b"") -> tuple[str, bytes]:
    if action == "matching_user/game_user_id":
        value = {"code": 0, "game_user_id": LOCAL_USER_ID, "aesIv": LOCAL_AES_IV}
    elif action == "user/login":
        value = {
            "code": 0,
            "apiUrl": f"{ENDPOINT}/api",
            "cdnUrl": f"{ENDPOINT}/content",
            "game_user_id": LOCAL_USER_ID,
            "aesIv": LOCAL_AES_IV,
            "userDataPullMultiRequestEnabled": False,
            "warningId": 0,
            "warningTitle": "",
            "warningMessage": "",
            "agreePolicyVersionUpdate": False,
            "data": {},
            "dataTokens": {},
        }
    elif action == "user_data/confirm":
        value = {
            "code": 0,
            "dataTokens": {"UserCommunicationCharacter": HOME_CHARACTER_TOKEN},
            "migrators": [],
            "operations": [],
        }
    elif action == "user_data/push":
        value = push_response(decode_request(request_body))
    elif action == "user_data/pull":
        return "application/x-msgpack", pull_response(decode_request(request_body))
    else:
        raise ValueError(f"Unsupported API action: {action}")
    return "application/json", json.dumps(value, separators=(",", ":")).encode()


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
        if body:
            try:
                row["decoded_body"] = decode_request(body)
            except (ValueError, zlib.error, json.JSONDecodeError):
                pass
        with self.server.log_lock:
            with (WORK / "requests.jsonl").open("a", encoding="utf-8") as log:
                log.write(json.dumps(row, separators=(",", ":")) + "\n")
        print(json.dumps({key: value for key, value in row.items() if key != "decoded_body"}), flush=True)

    def do_HEAD(self) -> None:
        self.serve_file(head_only=True)

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path in ("/health", "/storage/eu/status.json"):
            body = b'{"status":"ok"}\n' if path == "/health" else b'{"code":0}\n'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/billing/v1.0/auth/x_uid":
            self.record(b"")
            body = b'{"result":"OK","x_uid":"danmemore-local","x_app_id":"danmemore"}\n'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/billing/v1.0/moderate/keywordlist":
            self.record(b"")
            body = (
                b'{"result":"OK","entry":{"timestamp":"0","keywords":['
                b'{"id":0,"type":0,"rank":0,"keyword":"__danmemore_never_match__"}]}}\n'
            )
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/billing/v1.0/payment/balance":
            self.record(b"")
            body = b'{"result":"OK","entry":{"balance_charge_gem":0,"balance_free_gem":0,"balance_total_gem":0}}\n'
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
            size = path.stat().st_size
            try:
                start, end, partial = byte_range(self.headers.get("Range"), size)
            except ValueError:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return
            self.send_response(206 if partial else 200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(end - start + 1))
            if partial:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.end_headers()
            if not head_only:
                with path.open("rb") as source:
                    source.seek(start)
                    remaining = end - start + 1
                    while remaining:
                        chunk = source.read(min(1024 * 1024, remaining))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        remaining -= len(chunk)
            return
        self.record(b"")
        self.unknown()

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        if length < 0 or length > 64 * 1024 * 1024:
            self.send_error(413)
            return
        body = self.rfile.read(length)
        path = urlsplit(self.path).path
        if path.startswith("/telemetry/"):
            body = b"{}\n"
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.record(body)
        if path == "/billing/v1.0/auth/authorize":
            body = b'{"result":"OK"}\n'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/billing/v1.0/auth/initialize":
            body = b'{"result":"OK","uuid":"00000000-0000-0000-0000-000000000001"}\n'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if action := api_action(self.path):
            self.serve_api(action, body)
            return
        self.unknown()

    def serve_api(self, action: str, request_body: bytes) -> None:
        content_type, body = api_response(action, request_body)
        now = str(int(time.time()))
        request_id = self.headers.get("X-ARGO-REQUEST-ID", "0")
        sequence = self.headers.get("X-ARGO-REQUEST-SEQUENCE", "0")
        body_hash = self.headers.get(
            "X-ARGO-REQUEST-BODY-HASH", hashlib.md5(request_body).hexdigest()
        )
        self.send_response(200)
        for name, value in {
            "Content-Type": content_type,
            "Content-Length": str(len(body)),
            "Cache-Control": "no-store",
            "X-ARGO-ENCRYPTION": "0",
            "X-ARGO-REQUEST-ID": request_id,
            "X-ARGO-REQUEST-SEQUENCE": sequence,
            "X-ARGO-REQUEST-BODY-HASH": body_hash,
            "X-ARGO-ONE-TIME-TOKEN": LOCAL_TOKEN,
            "X-ARGO-USER": str(LOCAL_USER_ID),
            "X-ARGO-SERVER-RESPONSE-CODE": "0",
            "X-ARGO-SERVER-TIMESTAMP": now,
            "X-ARGO-ACCEPT-TIMESTAMP": now,
            "X-ARGO-SERVER-VERSION": "DanMemoRe/1",
        }.items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

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
    abis = run([adb, "-s", serial, "shell", "getprop", "ro.product.cpu.abilist"])
    arm64_apks = [ARM64_OUTPUT / name for name in ARM64_APKS]
    if "arm64-v8a" in abis and all(path.is_file() for path in arm64_apks):
        command = [adb, "-s", serial, "install-multiple", "-r", *arm64_apks]
    else:
        command = [adb, "-s", serial, "install", "-r", OUTPUT_APK]
    print(run(command).strip())
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
    assert decode_request(bytes.fromhex("038fa77da124ee456d20737612890393")) == {}
    assert patch_c_string(b"before-old-after", b"old", b"x") == b"before-x\0\0-after"
    assert patch_c_string(b"before-old-after", b"old", b"new") == b"before-new-after"
    assert content_path("/content/1/version.manifest") == (CONTENTS / "1/version.manifest").resolve()
    assert content_path("/api/asset/manifest/old/us/pkm/version.manifest.1") == CONTENTS / "1/version.manifest"
    assert content_path("/content/manifests/us/pkm/project.manifest.1/old").is_file()
    assert byte_range("bytes=3-5", 10) == (3, 5, True)
    assert byte_range("bytes=3-", 10) == (3, 9, True)
    assert content_path("/content/../README.md") is None
    assert api_action("/api/game_client/user/login") == "user/login"
    assert api_action("/api/not-implemented") is None
    content_type, body = api_response("user/login")
    assert content_type == "application/json"
    assert json.loads(body)["game_user_id"] == LOCAL_USER_ID
    body = pull_response({"tables": ["UserCommunicationCharacter"]})
    assert b"UserCommunicationCharacter" in body
    assert bytes.fromhex("a6757365724964ce3b9aca01") in body
    assert bytes.fromhex("a9636f7374756d654964ce3ceae4f8") in body
    body = pull_response({"tables": ["UserGift", "UserNotice"]})
    assert b"UserGift\x90" in body and b"UserNotice\x90" in body
    assert b"UserCommunicationCharacter" not in body
    push = push_response(
        {
            "checksums": {"after": {"UserProfile": "new-token"}},
            "deltas": [
                {
                    "trigger": "UserRegistration",
                    "putItems": {"UserProfile": [{"name": "Player"}]},
                    "deleteItems": {},
                }
            ],
        }
    )
    assert push["dataTokens"] == {"UserProfile": "new-token"}
    assert push["putItems"] == {"UserProfile": 1}
    assert push["data"] == {}
    with zipfile.ZipFile(SOURCE_APK) as archive:
        manifest = patch_manifest(archive.read("AndroidManifest.xml"))
        services = patch_service_dependencies(archive.read("classes3.dex"))
    assert PRIVATE_PACKAGE.encode("utf-16le") in manifest
    assert ORIGINAL_PACKAGE.encode("utf-16le") not in manifest
    assert bytes.fromhex("290073016e10b40b0200") in services
    if ARM64_XAPK.is_file():
        with zipfile.ZipFile(ARM64_XAPK) as bundle:
            split = bundle.read("config.arm64_v8a.apk")
        with zipfile.ZipFile(io.BytesIO(split)) as archive:
            native = patch_native_client(archive.read("lib/arm64-v8a/libapp.so"), "arm64-v8a")
        assert native[0x24ABD70 : 0x24ABD74] == bytes.fromhex("21008052")
    xml_chunks(manifest)
    print("PASS: APK isolation, safe paths, and static-derived plaintext bootstrap")


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
