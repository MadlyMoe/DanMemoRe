# Local save confirmation

`user/migration/confirm` has a source handler and is **partial**. Functional checks, APK deployment and MuMu acceptance are deferred, not passed. The actual player save/listener/emulator remain untouched.

## Frozen-client contract

Original EU 15.1.0 ARM64 SHA-256: `e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`. Addresses are raw; Ghidra adds `0x100000`.

- Wrapper `0x202f28c:0x202f4a0` constructs `{userId:string}`. Raw `0x202f2c4..0x202f2d4` uses JSON type 3/string, not an integer.
- Vtable `0x4266760 + 0x30` dispatches `0x2031914:0x2031e34`. Successful transport reads `gamelibUser.createdAt`, `userMeta.updatedAt`, `userInfo.name`, numeric `userInfo.userId` and array `userCurrency` with `currencyId`/`amount`.
- Dates are signed int32 seconds, formatted through `0x202f958:0x202f9d4` using `%Y/%m/%d %H:%M`. Raw `0x20319ec..0x2031a14` confirms signed extension into the formatter.
- Raw `0x2031ba4..0x2031bac` constructs `0x0c380d42`, decimal `205000002`. Original master data identifies it as **Valis**, not paid Iris. The callback defaults its display to zero and uses the matching Valis entry when present. The initially suspected Iris interpretation was rejected before verification.
- Scheduled vtable `0x42667d0 + 0x30` / `0x203201c:0x203207c` advances the support-menu UI to state 7. This confirmation callback does not authorize or execute an account transfer.

Completed read-only extraction: `.work/migration-confirm-wrapper-exact-20261006.txt`, `.work/migration-confirm-callback-exact-20261006.txt` and `.work/migration-confirm-ui-exact-20261006.txt`. Additional currency tracing in `.work/migration-confirm-iris-source-exact-20261006.txt` and `.work/migration-confirm-iris-caller-exact-20261006.txt` retained their scratch names; they do not establish an Iris interpretation. All headless processes exited zero. Extraction is not gameplay acceptance.

## Implemented local behavior

Only the exact text ID of the selected local save is recognized. Numeric, empty and extra-field requests reject; other text IDs remain unavailable through cancellation `3000999`. The reply contains the actual owned saved name/numeric ID and original Valis projection. Original currency IDs and ownership must be typed and unique; Valis must fit its native `0..2000000000` amount range. A genuinely absent Valis row yields an empty array/native zero. Corrupt or foreign rows never become an empty fake-success balance. Iris wallets are neither substituted nor changed.

The single indexed private `local_save_meta` row records a newly created local save's real wall-clock creation/checkpoint time, preserving a positive owned seed `UserStatus.createdAt` when supplied. Successful `user_data/push` updates the maximum observed wall-clock checkpoint in the same transaction as profiles, acknowledgements and reply persistence. Failed saves/replies roll back the timestamp too. An exact cached save replay does not create another checkpoint. Selecting a historical event date does not rewrite real save dates; wall-clock rollback cannot rewind the observed checkpoint. This is explicit local metadata policy, not reconstruction of publisher account history or every publisher-side update.

Old databases gain nullable **unknown** timestamps, not today's fabricated creation/save time. A positive owned source `UserStatus.createdAt` plus a subsequent recorded native save checkpoint can supply the legacy confirmation branch. Unknown, missing, unordered or out-of-int32 dates remain unavailable without clearing the profile or its pending operations. No native timestamp or signature is prewritten to satisfy the UI.

Confirmation is read-only except for the normal atomic sequence/reply cache. It does not debit currencies, grant rewards, acknowledge pending operations, begin a login session, issue authentication material, select another save, erase profiles or import data. Cached replies must still equal current name/Valis/dates; changed facts require a fresh lookup rather than replay an older confirmation.

Replay identity is also bound to the MD5 of the decrypted request bytes actually received. The client-supplied body-hash header is not trusted for either cache lookup or persistence, so a forged header cannot select an old confirmation. Exact unchanged requests remain replayable while the current saved name, Valis and dates still match.

## Deferred verification and remaining scope

Run `node tools/test_migration_confirm.cjs` in the consolidated batch, with save/recovery/Android/launcher/backup-restore regressions. The new check uses isolated, explicitly synthetic signed-save fixtures and covers exact shape/text ID, read-only state, Valis versus Iris, caps and original IDs, malformed/nonlocal/corrupt preservation, checkpoint/reply rollback, wall/event clocks, actual-body cache identity despite forged headers, unchanged restart replay and nullable legacy recovery. It has **not run**.

Native ID-entry eligibility and labels, state-7 rendering, dates/Valis/name, cancel/back/re-entry, signatures and save order, portable-profile behavior, performance and no crash/freeze/ANR remain unverified. Password authorization and publisher/cross-account/cross-device transfer remain unsupported; this read-only local confirmation must not be described as a working transfer system. Co-op remains last. No workers or GitHub Actions were used.
