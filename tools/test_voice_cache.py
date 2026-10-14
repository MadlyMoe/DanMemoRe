"""Voice repair provenance, deterministic ZIPs, missing-file and device guards."""
import hashlib
import json
from pathlib import Path
import tempfile
import zipfile

from repair_voice_cache import build_catalog, digest, verify_audio


with tempfile.TemporaryDirectory(prefix="danmemore-voice-test-") as temporary:
    root = Path(temporary)
    episode = "7040020101"
    directory = root / f"contents/voice_root/files/sound/voice_episode/{episode}"
    (directory / "bel").mkdir(parents=True)
    audio = directory / "bel/dialog.ogg"
    audio.write_bytes(b"OggS-test-original-recording")
    marker = directory / f"{episode}.md5"
    marker.write_bytes(b"a" * 32)
    archived = {"episodeId": int(episode), "md5": "b" * 32,
                "path": "contents/original-newer-version.zip", "size": 290}
    absent = {"episodeId": 7090010901, "md5": "c" * 32, "path": "contents/missing.zip", "size": 5}
    manifest = {"baseUrl": "{}", "episodes": {episode: archived, "7090010901": absent}}
    source = root / "contents/1/manifests/voice_episode.manifest"
    source.parent.mkdir(parents=True)
    source.write_text(json.dumps(manifest), encoding="utf-8")
    original_hash = digest(source)
    project = root / "data/manifests/project.manifest.1"
    project.parent.mkdir(parents=True)
    project.write_text(json.dumps({"assets": {"gacha": {"md5": "original-gacha"}}}), encoding="utf-8")
    with zipfile.ZipFile(root / "contents-complete.zip", "w") as archive:
        for file in (audio, marker):
            archive.write(file, file.relative_to(root).as_posix())
    plan = build_catalog(root)
    assert len(plan["episodes"]) == 1
    row = plan["episodes"][0]
    assert row["original"] == archived and row["archivedMd5"] == "a" * 32
    package = root / ".work/voice-packages" / episode / f"{row['md5']}.zip"
    assert digest(package, "md5") == row["md5"]
    assert digest(package) == row["sha256"]
    with zipfile.ZipFile(package) as archive:
        assert archive.namelist() == [f"{episode}/bel/dialog.ogg"]
        assert archive.read(archive.namelist()[0]) == audio.read_bytes()
        assert archive.testzip() is None
    repaired = json.loads((project.parent / "resources/voice/voice_episode.manifest").read_text())
    assert repaired["episodes"]["7090010901"] == absent, "Never mark unavailable voices downloaded"
    assert repaired["episodes"][episode]["size"] == package.stat().st_size
    assert repaired["episodes"][episode]["path"].endswith(f"/{row['md5']}.zip")
    assert json.loads(project.read_text())["assets"]["gacha"] == {"md5": "original-gacha"}
    assert build_catalog(root) == plan, "Repacking must be deterministic and idempotent"
    assert digest(source) == original_hash and marker.read_bytes() == b"a" * 32
    device_root = "/data/data/com.eu.danmore/files/contents"
    device_file = f"{device_root}/voice_root/files/sound/voice_episode/{episode}/bel/dialog.ogg"
    correct = f"{hashlib.sha256(audio.read_bytes()).hexdigest()}  {device_file}\n"
    verify_audio(plan, correct, device_root)
    for wrong in ("", correct.replace(correct[:64], "0" * 64), correct + correct,
                  correct + correct.replace("dialog.ogg", "extra.ogg")):
        try:
            verify_audio(plan, wrong, device_root)
        except ValueError:
            pass
        else:
            raise AssertionError("Unverified installed audio was accepted")
    for corruption in (b"OggS-corrupt", None):
        if corruption is None:
            audio.unlink()
        else:
            audio.write_bytes(corruption)
        try:
            build_catalog(root)
        except ValueError:
            pass
        else:
            raise AssertionError("Incomplete/corrupt source audio was accepted")

print("Voice package provenance, native extraction layout, exact hashes, restart-safe identities and failure guards: OK")
