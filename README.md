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

Downloaded content is served directly from `contents/`. Static analysis of the
ARM client established the WFS response headers, JSON login fields, dedicated
MessagePack `user_data/pull` path, and an unencrypted response mode. The local
server now handles `matching_user/game_user_id`, `user/login`,
`user_data/confirm`, and `user_data/pull` without relying on dead-server traffic.

The user-data reply is currently an empty, valid MessagePack envelope. It is a
bootstrap boundary, not a claim of playable gameplay; the next step is recovering
the client's required table set and constructing an original-data starter profile.
Unknown actions still fail closed with HTTP 503 and are recorded without header
values or request bodies in `.work/requests.jsonl`.

Generated APKs, signing material, request logs, and the 14 GB content archive are
intentionally excluded from Git.
