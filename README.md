# DanMemoRe

Preservation project to make *DanMachi: Memoria Freese* playable after its service shutdown.

Large original game contents are kept outside Git.

## Offline client baseline

The original EU 15.1.0 APK stays untouched. The build creates a separately named
`com.eu.danmore` app whose game API, content, telemetry, billing, and archived
storage URLs point only to `127.0.0.1:28766`.

```powershell
python tools/offline_client.py self-test
python tools/offline_client.py build
python tools/offline_client.py serve
```

With MuMu running, open a second terminal and install/launch it:

```powershell
python tools/offline_client.py install
```

Downloaded content is served directly from `contents/`. Unknown API actions fail
closed with HTTP 503 and are recorded without header values or request bodies in
`.work/requests.jsonl`. That route evidence is the input for implementing the
login and user-data replies; the current server does not fake successful gameplay.

Generated APKs, signing material, request logs, and the 14 GB content archive are
intentionally excluded from Git.
