# Mission character rewards — source contract, native acceptance pending

This change is **SOURCE ONLY / DEFERRED / NOT RUN**. Syntax checks and metadata generation do not establish playable missions, natural eligibility, signed saves or emulator stability. It does not change the actual player save, listener, installed APK or MuMu state. Co-op remains last.

## Original evidence

Original15.1.0 ARM64 `libapp.so` SHA256: `e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.

Read-only exact decompilation `.work/achievement-operation-exact-20261006.txt` covers the complete unwind range raw `2361db4:23631b0` for operation6000. The first extraction failed and its empty artifact was not used; the corrected extraction completed successfully before its output was inspected.

The handler consumes integer `receivedPCs`, looks up each unit through `22eba54`, and calls the same absent-unit initializer `22ebbbc:22ec100` used by stages/gacha. Its repository path `22dba90:22dbf38` creates an owned UserPCJobSet with lazy ordinary boards, not fabricated fully opened boards. Existing exact artifacts are `.work/gift-pc-repository-initialize-20261004.txt` and `.work/gacha-acquisition-exact-20261004.txt`.

Unlike the gacha callback, the mission callback performs communication-character acquisition `23ea744`/`23e6888(2)` and available-costume unlock `2418b0c`/`2418d64` **inside the absent-unit branch**. A preowned unit skips those new-unit effects. SP, costumes/items, PCs, memorias, casino and optional union-raid medals precede the final mission received-state mutation. `2358d80` marks a claim received; category3 deletion requires `expireAt + 2592000 < currentTime`, not equality.

All three archived type29 rewards have quantity1:

| Mission ID | Original unit ID | Asset key |
| --- | --- | --- |
|6020015761|1011021001|character.0_har_s4_1|
|6020015786|1011002028|character.0_ais_s4_22|
|6020015818|1011018019|character.0_lef_s4_16|

## Implemented persistence

- Fresh genuine mission6000 operations atomically retain their exact operation/parameters/token/signature, original mission/date identities and each distinct unit's actual preowned status/progress/board target in private `achievement_pc_delivery`. No PC/board/flag/stat/signature is pre-credited. CURRENT PC-free and Memoria extensions reuse this capture; see `achievement-reward-contract.md`. Empty PC targets are known-empty; shop-paired6000 remains separate.
- Shared `giftPcTarget` validates acknowledged `gift_pc_floor` minima before a new gift/gacha/stage/mission capture. Shared `pcRewardEffects`, unit and board validators cover typed owned progress, original board IDs and unsigned32 masks. New-unit empty lazy boards are valid; missing/foreign/duplicate/malformed boards are not. Preowned EXP/rank/LB/ascension/unlock/bits cannot regress. No new lifetime character-floor ledger is introduced.
- Unit and job-set observations are separate. Received flags, recorded ordinary inventory and existing SP/casino checkpoints also suppress a partially applied PC-bearing6000 operation. Either split order commits observations with the profile save; save replies omit delivery only and retain the real queue. Hot/cached/cold delivery cancels3000999 until all proofs and the genuine ACK arrive.
- ACK requires every target's joined owned unit **and** owned boards, all existing mixed memoria/inventory/currency proofs and the matching owned state4/completedAt flags. New first-owned mission captures also require their saved communication-entry effects (below). The native expiry exception is retained. Actual ACK merges character targets into the existing indexed floor; queue/done/profile/observation/floor/sequence/reply changes roll back together.
- Completed character floors reject later deletion/progress loss. Cached binary PC/job-set/mission pulls must match current durable state. Missing or corrupt original captures stay queued/unavailable; current post-reward saves are not invented as legacy baselines. Permanent captures are retained after ACK, but do not establish a new actual-wire permanent mission retry identity.

The pending loops are queue-bounded; changed completed characters use primary-key floor lookups. This is source-level query design, not measured performance.

## Deferred checks and remaining limits

Run `node tools/test_achievement_units.cjs` and `node tools/test_memoria_rewards.cjs` in the consolidated batch. Updated disposable checks cover all three original units, unit/board/flag-first interruption, typed/malformed/missing captures, original/unsigned/lazy boards, preowned mixed Iris, mixed memoria/EXP, source edits, retained queues, cached/cold/restarted replay, pending/completed deletion and progress loss, native expiry boundary, once-only rewards and issue/observation/floor/ACK/reply rollback. These checks use synthetic prerequisites and saves and are **NOT RUN** for this change.

Repeat mission items/stamina/casino, gift/gacha/stage/panel/save/recovery/Android/launcher checks because character capture/proof is shared. Mixed ordinary item/SP/casino partial-save behavior needs focused and native acceptance; the existing pure-item checks are not evidence for this new PC-bearing path.

Native default fields, HP/stats/skills, signatures, actual communication-character/costume/voice callback behavior, natural eligibility/reset policy, original reward attribution and save/order/recovery/navigation/no-crash/no-ANR remain unverified or incomplete. CURRENT Memoria-only and PC-free checkpoints are documented in `achievement-reward-contract.md` and remain deferred source work. A clock rewind after native expired-row deletion but before ACK still needs reconciliation. After generic cache eviction, a fresh already-claimed mission request still returns400; a usable permanent actual-wire retry/recovery path is not established. This is not full6000 or full gameplay support.

## New source-only communication handoff (untested)

Newly issued first-owned type-29 unit operations capture their one matching
original communication ID and the actual `UserCommunicationCharacter` row (or
absence) in `achievement_pc_delivery.communication_targets`, with a versioned
capture so a new receipt cannot silently lose this proof. An incomplete
earlier first-entry checkpoint prevents a new issue. For an unjoined baseline,
the existing local `stageEntryPlan` owns the native wardrobe/voice/first-quest
save, with no second writer or pre-credit. For an already joined baseline, the
operation captures the original refresh graph and wardrobe inputs, validates
that capture through the existing entry-receipt reconstruction, then requires
its default costume, voice and quest effects before ACK. A detectable local
refresh must finish too. An identical same-second callback cannot prove a
second join, but cannot ACK while the captured wardrobe or quest effects are
missing. Newly applied effects observe `entry:<ID>` as part of the PC
constructor, so PC/job-set alone cannot suppress missing communication effects
in cold redelivery. Effects already satisfied in the joined baseline are
required to stay satisfied but are not counted as a new partial observation;
an unsaved unit can still be redelivered. Stored and same-save entry/ACK commit profile, observations, floors
and operation completion atomically; the joined branch records its own original
operation-sourced stage and wardrobe floors plus a small indexed joined-owner
floor after saved effects are proven. That floor rejects later deletion,
ownership swaps or a return to an unjoined state on both saves and cold entry.
The completed joined-owner floor now also checks that its done operation has a
retained version-1 mission capture for this exact original PC/communication
pair and an original type-29 claim attributed to that operation. An unrelated
done ID or lost communication capture cannot authorize the floor. This guard
also runs on native communication saves; no existing floor or save is rewritten.

All three original type-29 units map uniquely to their communication entries
and have `initialCostumeId=0`, so the common PC-costume proof could not cover
`2418d64`. Historical pending receipts have version 0 and SQL-NULL `communication_targets`:
they remain readable under the older guarded policy, without fabricating a
retroactive baseline or claiming their missing entry was proven. A separate
producer joining the same previously unjoined communication character after
mission issue is observationally ambiguous; baseline matching does not prove
which native callback caused the save.

Deferred synthetic cases in `test_achievement_units.cjs`,
`test_achievement_character_recovery.cjs` and `test_memoria_rewards.cjs` now
cover absent entry/invalid capture rejection, split saves, cold projection,
same-save entry plus ACK, joined-baseline wardrobe/quest/ACK rollback, permanent
joined-state preservation, unrelated-done-ID and missing-source-capture refusal, and
redelivery when the joined baseline already satisfied every effect. **None
were run.** Native mission acquisition,
signature/callback order, historical reconciliation, save usability, UI and
crash/ANR behavior remain unverified. Counts remain 175 tracked routes: 124
partial, 51 unsupported, zero feature-complete; no player save, listener, APK,
emulator, workers or GitHub Actions were touched.
