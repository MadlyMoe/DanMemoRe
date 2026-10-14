"""Repack verified archived voices; never label an absent newer revision downloaded."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shlex
import tempfile
import zipfile
import zlib


def digest(path: Path, algorithm: str = "sha256") -> str:
    with path.open("rb") as source:
        return hashlib.file_digest(source, algorithm).hexdigest()


def build_catalog(root: Path) -> dict:
    (root / ".work").mkdir(exist_ok=True)
    contents = root / "contents"
    source_manifest = contents / "1/manifests/voice_episode.manifest"
    manifest = json.loads(source_manifest.read_text(encoding="utf-8"))
    plans = []
    with zipfile.ZipFile(root / "contents-complete.zip") as archive:
        members = {member.filename: member for member in archive.infolist() if not member.is_dir()}
        for episode_id, original in manifest["episodes"].items():
            if not re.fullmatch(r"[0-9]{10}", episode_id) or str(original["episodeId"]) != episode_id:
                raise ValueError("Invalid voice episode identity")
            prefix = f"contents/voice_root/files/sound/voice_episode/{episode_id}/"
            directory = root / prefix
            marker = directory / f"{episode_id}.md5"
            if not marker.is_file():
                continue  # Missing revisions remain missing, not fake completed downloads.
            cached_md5 = marker.read_text(encoding="ascii")
            if not re.fullmatch(r"[a-f0-9]{32}", cached_md5):
                raise ValueError(f"Invalid archived voice marker: {episode_id}")
            if cached_md5 == original["md5"]:
                continue
            marker_member = members.get(prefix + marker.name)
            if marker_member is None or archive.read(marker_member) != marker.read_bytes():
                raise ValueError(f"Voice marker differs from the untouched archive: {episode_id}")
            audio = {name[len(prefix):]: member for name, member in members.items()
                     if name.startswith(prefix) and name != prefix + marker.name}
            actual = {file.relative_to(directory).as_posix() for file in directory.rglob("*")
                      if file.is_file() and file != marker}
            if not audio or actual != audio.keys():
                raise ValueError(f"Incomplete archived voice episode: {episode_id}")
            package_root = root / ".work/voice-packages" / episode_id
            package_root.mkdir(parents=True, exist_ok=True)
            temporary = package_root / "repacked.zip.tmp"
            hashes = {}
            # The native extractor expands each ZIP next to <episode>.zip; its
            # members must include the episode directory (0x20a93d0).
            with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_STORED) as package:
                for relative, member in sorted(audio.items()):
                    parts = PurePosixPath(relative).parts
                    if (not parts or any(part in (".", "..") for part in parts)
                            or not re.fullmatch(r"[A-Za-z0-9_./-]+\.ogg", relative)):
                        raise ValueError(f"Unsafe voice member: {relative}")
                    source = directory / relative
                    if directory.resolve() not in source.resolve().parents:
                        raise ValueError("Voice source escapes its episode")
                    data = source.read_bytes()
                    if len(data) != member.file_size or zlib.crc32(data) != member.CRC:
                        raise ValueError(f"Voice audio differs from the untouched archive: {episode_id}/{relative}")
                    hashes[relative] = hashlib.sha256(data).hexdigest()
                    entry = zipfile.ZipInfo(f"{episode_id}/{relative}", date_time=(1980, 1, 1, 0, 0, 0))
                    entry.external_attr = 0o100644 << 16
                    package.writestr(entry, data)
            local_md5 = digest(temporary, "md5")
            package = package_root / f"{local_md5}.zip"
            temporary.replace(package)
            manifest["episodes"][episode_id] = {**original, "md5": local_md5,
                "path": f"resources/voice/packages/{episode_id}/{local_md5}.zip", "size": package.stat().st_size}
            plans.append({"episodeId": episode_id, "original": original, "archivedMd5": cached_md5,
                          "md5": local_md5, "sha256": digest(package), "files": hashes})
    output = root / "data/manifests/resources/voice/voice_episode.manifest"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
    project_file = root / "data/manifests/project.manifest.1"
    project = json.loads(project_file.read_text(encoding="utf-8"))
    project["assets"]["manifests/voice_episode.manifest"] = {
        "md5": digest(output, "md5"), "path": "resources/voice/voice_episode.manifest", "size": output.stat().st_size}
    project_file.write_text(json.dumps(project, separators=(",", ":")), encoding="utf-8")
    plan = {"sourceManifestSha256": digest(source_manifest), "episodes": plans}
    (root / ".work/voice-cache-plan.json").write_text(json.dumps(plan, indent=2), encoding="utf-8")
    return plan


def verify_audio(plan: dict, output: str, device_contents: str) -> None:
    expected = {f"{device_contents}/voice_root/files/sound/voice_episode/{row['episodeId']}/{relative}": checksum
                for row in plan["episodes"] for relative, checksum in row["files"].items()}
    actual = {}
    for line in output.splitlines():
        checksum, separator, name = line.partition("  ")
        if not separator or not re.fullmatch(r"[a-f0-9]{64}", checksum) or name in actual:
            raise ValueError("Invalid device voice checksum output")
        actual[name] = checksum
    if actual != expected:
        raise ValueError("Installed voice audio is missing, changed, or has extra files; no completion records published")


def repair(root: Path, adb: Path, serial: str, run) -> None:
    plan = build_catalog(root)
    device_contents = "/data/data/com.eu.danmore/files/contents"
    call = lambda *args: run([adb, "-s", serial, *args])
    if call("shell", "id", "-u").strip() != "0":
        raise RuntimeError("Voice cache repair requires a rooted emulator")
    call("shell", "am", "force-stop", "com.eu.danmore")
    owner = call("shell", "stat", "-c", "%u:%g", "/data/data/com.eu.danmore").strip()
    directories = [f"{device_contents}/voice_root/files/sound/voice_episode/{row['episodeId']}"
                   for row in plan["episodes"]]
    print(f"Verifying all audio files in {len(directories)} repacked voice episodes...", flush=True)
    if directories:
        command = "find " + " ".join(map(shlex.quote, directories)) + " -type f -name '*.ogg' -exec sha256sum {} +"
        verify_audio(plan, call("shell", command), device_contents)
    backup = Path(tempfile.mkdtemp(prefix="voice-cache-before-", dir=root / ".work"))
    call("pull", f"{device_contents}/1/manifests/voice_episode.manifest", backup / "voice_episode.manifest")
    call("pull", f"{device_contents}/1/project.manifest", backup / "project.manifest.1")
    launcher = "/data/data/dev.danmemore.launcher"
    launcher_present = call("shell", f"if test -d {launcher}; then echo yes; fi").strip() == "yes"
    if launcher_present:
        launcher_owner = call("shell", "stat", "-c", "%u:%g", launcher).strip()
        runtime = f"{launcher}/files/runtime/manifests"
        for row in plan["episodes"]:
            source = root / ".work/voice-packages" / row["episodeId"] / f"{row['md5']}.zip"
            target = f"{runtime}/resources/voice/packages/{row['episodeId']}/{row['md5']}.zip"
            call("shell", "mkdir", "-p", str(PurePosixPath(target).parent))
            call("push", source, target)
            if call("shell", "sha256sum", target).split()[0] != row["sha256"]:
                raise RuntimeError("Repacked voice ZIP upload failed verification")
            call("shell", "chown", launcher_owner, target)
            call("shell", "restorecon", "-F", target)
        for source, target in ((root / "data/manifests/resources/voice/voice_episode.manifest",
                                f"{runtime}/resources/voice/voice_episode.manifest"),
                               (root / "data/manifests/project.manifest.1", f"{runtime}/project.manifest.1")):
            call("shell", "mkdir", "-p", str(PurePosixPath(target).parent))
            call("push", source, target)
            call("shell", "chown", launcher_owner, target)
            call("shell", "restorecon", "-F", target)
        # Intermediate directories must also belong to the launcher, not root.
        call("shell", "chown", "-R", launcher_owner, f"{runtime}/resources/voice")
        call("shell", "restorecon", "-RF", f"{runtime}/resources/voice")
    for row in plan["episodes"]:
        marker = f"{device_contents}/voice_root/files/sound/voice_episode/{row['episodeId']}/{row['episodeId']}.md5"
        call("pull", marker, backup / f"{row['episodeId']}.md5")
        local = backup / f"{row['episodeId']}.new.md5"
        local.write_bytes(row["md5"].encode("ascii"))
        call("push", local, marker)
        call("shell", "chown", owner, marker)
        call("shell", "restorecon", "-F", marker)
        if call("shell", "cat", marker) != row["md5"]:
            raise RuntimeError("Voice completion record verification failed")
    for source, target in ((root / "data/manifests/resources/voice/voice_episode.manifest",
                            f"{device_contents}/1/manifests/voice_episode.manifest"),
                           (root / "data/manifests/project.manifest.1", f"{device_contents}/1/project.manifest")):
        call("push", source, target)
        call("shell", "chown", owner, target)
        call("shell", "restorecon", "-F", target)
        if call("shell", "sha256sum", target).split()[0] != digest(source):
            raise RuntimeError("Voice manifest upload failed verification")
    print(f"PASS: repaired {len(directories)} archived voice revisions; backups in {backup}")
