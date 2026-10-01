# DanMemoRe

Preservation project to make *DanMachi: Memoria Freese* playable after its service shutdown.

Large original game contents are kept outside Git.

## Offline client

The original EU 15.1.0 APK stays untouched. The build creates a separately named
`com.eu.danmore` app whose game API, content, telemetry, billing, and archived
storage URLs point only to `127.0.0.1:28766`.

Put the extracted archive in `contents/`. For an ARM64 emulator such as MuMu,
put the untouched APKPure bundle at `.work/danmemo-15.1.0-arm64.xapk`; otherwise
the builder uses `contents/com.eu.danmemo_2023-12-22.apk`. Neither source is
tracked by Git.

```powershell
python tools/offline_client.py self-test
python tools/offline_client.py build
python tools/offline_client.py serve
```

With MuMu running, open a second terminal and install/launch it:

```powershell
python tools/offline_client.py install
```

Downloaded content is served directly from `contents/`. Static analysis of the
ARM client established the WFS response headers, JSON login fields, dedicated
MessagePack user-data path, local AES request format, and an unencrypted response
mode. OpenSSL must be available on `PATH` to decode user-data pushes.

The local server supplies the minimum original-data starter profile, acknowledges
the client's own nested state deltas, and emulates the retired name-moderation
bootstrap. The ARM64 build also corrects the client's invalid fresh-account party
selection (`activePartyId` 0 while original party IDs begin at 1).

On MuMu this passes login, update verification, player registration, local asset
download, movie playback/skip, and reaches an interactive opening story. Unknown
actions still fail closed with HTTP 503. Request metadata and locally decoded
user-data bodies are recorded only in ignored `.work/requests.jsonl` so later
routes can be reconstructed from the client rather than nonexistent server traffic.

Current boundary: this is a client-derived first-run bootstrap, not complete game
server coverage. The verified party-selection correction currently targets the
APKPure ARM64 build used by MuMu; the ARMv7 package still needs an equivalent fix.

Generated APKs, signing material, request logs, and the 14 GB content archive are
intentionally excluded from Git.
