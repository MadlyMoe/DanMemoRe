# Shared character-state acquisition — partial support

## Repeated communication acquisition (2026-10-07, implementation only)

All checks, builds, installation and emulator interaction remain deferred until the packets are implemented. This change is **NOT RUN** and does not establish native acceptance. Earlier acceptance below is historical.

Original `.work/communication-entry-wardrobe-exact-20261006.txt` proves that `2418d64` calls `241ac00(2)` without checking whether the communication character has already joined. State2 again auto-grants locked initial outfits, selects the original highest-priority default, writes the native server-date join time and runs `23a2fd8`'s voice refresh; `246b840` then considers the first normal node of each matching type2/3 parent. State3 consumes NEW but does not run those reset effects. Costume and voice states already seen3 are not reset to2.

The ordinary `user_data/push` planner now handles observable repeats from an actual already-joined baseline: a changed native join time, including a historical clock moving backwards, or seen3→NEW2 with an unchanged time. A changed-time reset may coalesce to seen3 before save. These paths reuse the first-entry graph, wardrobe, own-hero CP voice thresholds, original default selection, independent observations and atomic profile/checkpoint/floor/sequence/reply transaction. Native rows, signatures, owners, points and rewards are never pre-written; no network operation or fake ACK is created.

`stage_entry_refresh` retains only the latest actual repeat for each of the26 original communication identities. The original `stage_entry` receipt remains unchanged. Imported joined rows may acquire a **prospective** repeat capture from their actual baseline, never fabricated first-entry history. Newly opened original first nodes retain their completed source in nullable `stage_unlock_floor.refresh_json`; an indexed source snapshot outlives replacement of the latest repeat. Existing stage, costume/voice and positive consulted CP floors remain protected. Neither absence nor an ambiguous original stage creates a replacement node.

Incomplete repeats block ordinary gameplay with the existing3000999 recovery path while genuine finishing saves remain accepted. Cold/cached reads, saved-effect rewind, owner/time/default mismatch while pending, completed communication deletion/unjoining and malformed captures retain errors and data. Completed repeats preserve their last native join time but permit later seen3, ordinary outfit selection and touch saves; none replays the reset. First-entry and repeated saves share validation rather than two independent gameplay implementations.

Extended `test_communication_wardrobe.cjs` contains **written, unexecuted** checks for first-receipt preservation, new own-hero voices, pending seen3, backwards time, same-second seen3→NEW2, coalesced3, imported joined baselines, latest-row replacement, immutable old stage sources, no wallet/queue/ACK effects, restart, owner/default/time rejection, deletion/relock, source corruption and transactional rollback. Run it only in the later consolidated verification phase.

An identical same-second2→2 save or coalesced3→3 with unchanged time cannot identify a reset from its serialized acquisition fields alone. It follows the ordinary save path rather than inventing a receipt. Effects saved before the first observable reset are captured as actual preowned state, not retroactively claimed as newly acquired. Attributing those indistinguishable callbacks, simultaneous overlapping CP/quest producers, every acquired-event listener, exact native signatures/save ordering, usable interrupted recovery and full UI/gameplay/stability remain pending. Co-op stays last.

## Unit-story acquisition follow-up (2026-10-07, implementation only)

Testing, builds, installation and emulator interaction are deferred by the user until all packets are implemented. This source change has **not been run** and does not establish native acceptance. Earlier passes below apply only to their recorded revisions.

Original common-PC constructor `22ebbbc` grants PC slot76's initial outfit, then calls `2473d9c`. The new read-only artifacts `.work/unit-story-costume-lookup-exact-20261007-v2.txt`, `.work/unit-story-stage-resolution-exact-20261007.txt` and `.work/unit-story-costume-pc-join-exact-20261007.txt` trace that call: `2473d2c` resolves the outfit back to the original PC, `2473704` uses the outfit's communication-character key to search type4/NORMAL stages for condition6 and its authored PC ID, and `2450ef4` tests closed state0 before `2451204` opens state1. This is not the raid-part stage lookup `2466820`. Numeric arithmetic between PC, outfit and stage IDs is not the lookup.

The final archive has319 matching stages, all NORMAL with distinct PC IDs and initial outfits; their labels join the original communication keys. An absent authored story is a nullable lookup, not permission to substitute another stage or open all unit stories. Ambiguous/incomplete stage, outfit or character joins remain unavailable.

The shared first-unit target now captures `unitStory:{stageId,beforeState}` from the actual saved stage. All existing gacha, present, mission and stage unit producers reuse it. Already-owned units do not invent a first-unit capture. Unit, boards, character, outfit and story saves remain independent: an opened story is observed separately, pending half-saves cannot relock it, and every reward ACK requires the actual owned open stage. Issue never changes native stage rows, tokens, wallet or signatures and adds no wire field.

The existing indexed `gift_pc_floor` retains the story capture across subsequent preowned rewards/upgrades. Changed stage IDs use the original stage-to-PC map and primary-key floor reads; cold stage reads use a bounded indexed lookup of the319 original PC identities, not lifetime receipt scans. Cached binary pulls for all four producers must match current stages. Profile, observations, floor, queue, ACK, sequence and reply use the existing transaction, without a new table or fabricated operation. Missing/corrupt pending captures retain their queue and recover3000999; older completed floors without this capture are not retroactively declared story proof.

`test_pc_costumes.cjs` now includes deferred explicit synthetic unit-story deltas, catalog target coverage, absent/closed/already-open stages, story-first/unit-first/outfit-first saves, restart, early-ACK rejection, rollback, later deletion/relock/foreign-owner rejection, cold missing-row preservation and missing-capture recovery. Explicit acquisition fixtures in the existing gift/mission/stage/shop/gacha checks were updated; generic XP fixtures do not silently add story unlocks. **None of these checks was executed.** Actual native acquisition/story-menu/play/clear/reward/hot-cold save/ACK/back ordering, other story-unlock producers and full gameplay remain pending. Co-op stays last.

### Missing first-normal-stage follow-up (2026-10-07, implementation only)

The original `246b840:246bcdc` first-entry helper, retained in `.work/stage-refresh-firstentry-events-exact-20261006.txt`, explicitly branches around the unlock when `2480344` returns a null first-normal-stage pointer. It continues to the next matching parent; it does not cancel the preceding communication-state, initial-costume, selected-outfit or join-time work. The original Haruhime100000027 and Wiene100000028 type2/3 parent episodes have no normal stages, while their type4 stories are separate.

Shared `stageEntryGraph` now skips an absent first-normal node, rather than rejecting those saves. Both new capture creation and receipt reconstruction use this same helper. Empty stage inputs/effects still require the real communication and wardrobe saves, with independent observations, atomic persistence and existing wardrobe floors. No replacement stage, type4 unlock, CP, reward, operation, signature or player-profile precredit is added. Invalid parent identity, duplicate first-stage indices and malformed existing stages still reject.

The existing all26-identity wardrobe check is updated to require Haruhime/Wiene completion and restart with zero stage flags/floors, while retaining the outfit-save and no-wallet/no-ACK checks. It is **written but NOT RUN**. This source follow-up is not built, installed or emulator-accepted; the executed history below predates it. All checks and emulator testing remain deferred until the packets are implemented. Repeated joined callbacks, completed state/time lifecycle, type4 availability and full gameplay remain incomplete; co-op stays last.

Acceptance update (2026-10-07): isolated wardrobe/voice, friendship-voice and ordinary board-checkpoint checks passed. Native tutorial Ais acquisition, a free regular11 draw and bounded Bell/Ais board spending/save/cold rendering were observed on a separate MuMu test profile. Older deferred statements below are historical and superseded only for those checks and named native paths. Full character gameplay remains incomplete. Co-op remains last.

### Communication menu and seen-flag checkpoint follow-up (2026-10-07)

The Bell menu issue was reproduced and traced in the original client, then the menus opened **without a client patch**. Raw1c7e5d0:1c7e628 emits idle reaction6 after10 seconds;1ddeebc:1ddf2c0 dispatches it to the registered callback. Active dialogue gates menu input.1c8148c:1c81654 consumes Novel output1000001 through201290c:2012974 and closes/fades the quote through1c7df5c:1c7e064. Dismiss the quote, wait for its fade, then select the visible menu before the next idle quote. Favorites is a toggle, not a page. Read-only callback observation modified no native return, register or save; its temporary helper and forwarding were stopped afterward.

Bell's CP Reward modal, two unlocked Outfits, Favorites toggle and Daily Talk1 were visually exercised. Native saves21067..21070 used TutorialUpdate, CostumeChange, FavoriteCharacter and CommunicationVoice. A stopped-listener DB/WAL/SHM copy opened read-only verified Bell100000001 seen3, BasicEquip1021001002 selected, both original outfits seen3, DailyTalk140000001 seen3, favoriteCommunicationCharacterId100000001 and tutorial780060057 ended; queue0/integrity ok. True cold relaunch retained the outfit, favorite and cleared Voice/Outfits markers. This is an existing joined2-to-seen3 path, not a fresh first-acquisition/coalesced3 proof. No CP gain, claim or audible playback is certified.

The native observation exposed a separate persistence gap: costume_unlock_floor could remain at captured NEW2 after the actual profile saved seen3. The new regression first failed because the seen save performed no protection-record write. Shared `user_data/push` now advances existing costume/voice floors to the actual saved state in the same profile/checkpoint/reply transaction. Reward ACKs and first-entry completion likewise retain actual coalesced seen3. Original2505dbc auto-grants only locked costumes via2507b58;23a2fd8/23a5144 only unlock locked eligible voices, so these helpers do not reset seen3. Bounded evidence is `.work/communication-wardrobe-seen-refresh-exact-20261007.txt` plus the existing gift costume state artifact.

Older state2 floors beside actual state3 profiles are guarded against the retained native baseline; no guessed history migration is performed. Per-table state indexes avoid repeated full-profile scans. Unknown/unproven legacy rows do not acquire fabricated floors. No schema, native flag/signature/owner/CP pre-credit, new packet or fake ACK was added. Completed communication state/join-time resets, pending-effect seen progression and every unrelated gameplay path are not declared solved.

Nine complete disposable/source checks pass on this revision: communication wardrobe, costume rewards, PC costumes, stage entry, friendship voices, stage persistence, ordinary board checkpoint, CP transport and launcher lifecycle. They cover ordinary and coalesced seen saves, older state2 history, restart, stale2/deletion rejection and every-table forced SQLite rollback. The PC catalogue fixture now explicitly asserts the existing unjoined home-Hestia recovery boundary instead of misclassifying it as an owned unit; production validation was not weakened. Full stage-unit acceptance is still not passed.

Local offline rebuild/replacement install succeeded. All seven packaged/copied server modules and installed APK hashes match source (server `e19184ce60b5ee3afcbca0279cd8bb9eb9819ea13566a6606da122249e7b7555`, APK `dbf9cafeaf64c7af0c0834344f040d0d6653c2ce9abe40b7448b856482710526`). On the new build, Ais's real CostumeChange21085 and CommunicationVoice21086 saves changed her communication state, original costume1021002000 and DailyTalk140000027 to3. A stopped read-only copy verifies both protection records are3, original join time/owner retained, Bell still selected BasicEquip/favorite, queue0/integrity ok. Subsequent cold matching/login/confirm21087..AreaChanged21092 returned successfully; Ais's acquisition NEW label, Outfits/Voice markers and DailyTalk1 NEW label remain cleared in the rendered UI. Town still has rank3/SP60/Iris17/Valis30138; Android reports no ANR since boot in these limited flows. Native rollback fault injection was not performed. Full route/gameplay/stability acceptance remains partial.

At handoff the game/listener were stopped through normal Tools (game PID and port28766 absent). Adventure5/date2022-08-20 is restored as next-launch metadata only, Offline/19 profiles verified; the original DB was never opened. Temporary device-only root adbd was restored to shell uid2000 after stopping the owned diagnostic helper/forward. No workers or GitHub Actions were used.

### Communication NEW-to-seen save follow-up (2026-10-07)

`user_data/push` now handles first-entry state3, not just state2. Original menu init1c7c2e4 calls241b0d8 (exactly2) then241ac00(3);241b10c recognizes2/3 together. The native setter260b6b0 marks the changed row dirty. Therefore NEW2 and seen3 can coalesce before the first save. Both states now bind the existing first-entry capture, preserving the actual owner/join time/default outfit and independently observed story/costume/voice/three-track obligations. State3 does not waive missing effects, fabricate an ACK, initialize inventory or reinterpret already-joined legacy rows as a new entry. No schema or client patch was added.

Earlier NEW-to-seen revision: full `test_communication_wardrobe.cjs` and `test_stage_entry.cjs` passed, including coalesced3 versus saved2→3, both entry/effect save orders, restart, exact owner/time/default checks, missing effects and all-table rollback. Stage-persistence, ordinary-board, CP-transport and launcher checks also passed. Native cold town retained rank3/SP60/Iris17/Valis30138 and returned successful login/confirm/pull/push responses. The previously unresolved Interact input investigation is superseded by the menu/timer evidence above only for the named Bell/Ais paths. Fresh first-acquisition3, repeated joined callbacks and their reset/time lifecycle remain incomplete. Full route/gameplay/stability acceptance is still partial.

## Original evidence

Original15.1.0 ARM64 SHA256 `e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`. Read-only exact artifacts `.work/pc-character-state-join-exact-20261006.txt` and `.work/pc-character-costume-join-exact-20261006.txt` completed before inspection. Bounded instructions, constructor/parser fields and original gacha string literals are recorded in `.work/character-acquisition-native-asm-20261006.txt`.

Stage246c564, mission2361db4 and gift248cbb8 initialize absent reward units and resolve their original character key. Predicate23e79f8 lazily obtains UserCharacter and tests its byte state1;23e6888 changes it to2. Lazy23e57bc and constructor2608c70 create a missing row with owner0/state1/zero CP, without subsequently replacing its owner. Parser260a584 confirms the original character ID, state and three friendship tracks. Existing master.pcProfiles.characterId/characters joins are reused; no new archive export or guessed identity is required.
Neighbor23e7ae0 tests exactly2;23e7bc8 evaluates `(stateByte | 1) == 3`, recognizing2/3 together. Accepting saved3 for an unlock target2 follows that original shared-state predicate, not a general assumption that larger state values are better.

Additional bounded26c4984:26c4ba8 reads protected character ID at row+30 and registers the local map+9e0 by that ID, not owner ID. Getter23e5afc:23e5cb8 reads actual friendship/ Ais/ Lef tracks from row+58/d0/f8 with no owner check or rewrite; a genuinely absent row returns zero. The completed read-only `character-wardrobe-selection-bounded-exact-20261006.txt` also identifies23e6a14 as a `CharacterAquiredEvent` broadcast, not a direct quest writer. Its listeners remain pending. Costume selection filters original slot8 before descending slot9 priority; the archived initial candidates have no maximum-priority ties. These fields, voice kind/threshold/hero slots7/4/8 and common-PC initial costume slot76 are now exported from the original archive, not guessed.

Gacha22f0170 iterates **UserPC**, not lotteryPCs. Its character refresh follows both missing/existing PC lookup branches. Our producer includes only absent first-award PCs in UserPC, so ordinary duplicate-only draws have no new character target. This does not establish legacy/imported existing-PC handoff parity.

## Implemented save path

- The existing private unit target optionally captures original character ID, actual row presence/owner/state and all three CP baselines. State1 targets2; other captured byte states are preserved rather than guessed. A missing native row targets owner0/state2/zero CP. No native character/unit/boards/costume/voice/signature is pre-credited or added to the wire.
- Stage, gift, mission and gacha receipts require this pre-effect capture for first units with a character mapping. An already-owned unit does not acquire a fabricated first-unit target. Missing/corrupt legacy first-unit captures retain their queue and recover3000999; no post-award backfill. Old completed plain unit floors remain readable but are not retroactively declared character proof.
- Shared save proof preserves captured owners/CP tracks and separately observes missing-row creation and state1→2. Unit/board/character-first saves can checkpoint in any order; observed state/row cannot disappear or rewind. A saved2 or known3 satisfies the new unlock target. State3 captured before issue still requires3; unknown byte states require their exact captured state.
- Every reward ACK now requires the actual candidate UserCharacter alongside the unit and owned boards. Partial save replies omit delivery only; hot/cached/cold callbacks cancel until the genuine complete ACK. Gacha nonadditive checkpoints reuse actual persisted rows plus pre-commit comparison, not a new schema/history ledger. Its existing absolute bond guard is retained.
- Existing indexed gift_pc_floor carries the character minimum across later preowned upgrades/draws. Changed UserCharacter IDs use a fixed original reverse map and per-PC primary-key lookups, not a lifetime ledger scan. Cached binary character pulls for all four producers must match durable state. Profile/observation/floor/queue/done/sequence/reply remain in the existing atomic transaction.

### Native lazy-owner progression follow-up

One shared character-owner check now accepts exactly numeric0 or the local user ID for character CP acquisition, stage receipts/ACKs, all three consulted quest tracks, first-entry zero initialization, dispatch stat calculation and public profiles. UserInfo, units, boards and item ownership checks remain unchanged. Native UserCharacter merges explicitly use characterId and reject malformed/duplicate IDs; proposed saves reject foreign/string/missing owners and cannot change an existing character's owner, including0-to-local-ID. Invalid retained ownership is preserved for reconciliation, not silently repaired by deletion. Missing rows remain missing unless the client actually supplies them; existing CP caps, indexed floors, queue retention and transactions remain in force. No SQL schema, native field, signature, profile or points pre-credit was added.

### Common-PC initial costume follow-up

The common initializer22ebbbc reads pc.slot76 with139c3ac at22ebe94..22ebeb8; zero skips the direct2505fc4 grant. This is different from241ac00's communication-character initial wardrobe/default selection. Only the original referenced costume is captured for a first unit. Preowned units and zero-slot PCs do not invent wardrobe grants; an already-unlocked costume retains its captured state and does not regrant linked voices.

The existing gift/mission/stage/gacha private unit targets now carry a `wardrobe` capture of the actual pre-effect costume/voice states plus required targets. The same validators and effect proof serve explicit gift/shop/mission costume awards and slot76 initialization. Split costume and unit/board/character saves checkpoint independently; early ACK fails and saved halves cannot relock or vanish. All four reward ACK paths inspect the actual candidate wardrobe. Queue/cached/cold delivery suppression and original ownership/state/board/bond guards remain in force. Completed unlocks use the existing indexed costume_unlock_floor alongside gift_pc_floor; later preowned target merges retain the capture. No new SQL table, wire field, signature, owner rewrite or native pre-credit. Profile/observations/floors/ACK/sequence/reply remain atomic. Each costume proof reads its relevant profile snapshots once, not once per linked voice.

The final catalog has346 nonzero PC initialCostumeIds and346 distinct referenced costumes; none intersects the42 costume-linked voice rows. The shared grant implementation supports those original linked voices, but PC acquisitions must not substitute communication-default/CP voices for this empty intersection. Communication-entry and subsequent CP-level voice source handling are separate below; native acceptance remains pending.

`decode_master_data.cjs --native` recovers AES/IV/XXTEA in memory from the hash-pinned untouched client image, without reading a local configuration or printing/persisting key values. The regenerated artifact has158 hashed original sources, including the separately prepared pcGuest/pcGuestLevelStep catalogs. Removing only the new wardrobe/voice/slot76 fields and two guest exports reproduces the old full-object SHA256 `26744814cf5db4d9fcb4f1981500b3bb558dd10c7a17f65118dc582e2f7150f5`; all prior fields and source records are unchanged. This was mechanical original-data extraction, not a gameplay test.

### Communication first-entry wardrobe and voices

The completed read-only `communication-entry-wardrobe-exact-20261006.txt` covers241ac00:241ae98 and2418d64:2418f04. Bounded instructions establish state2 ->2505dbc initial auto-grants ->25061b0 default selection ->260b5d0 selected costume ->260b794 join time ->23a2fd8 voice refresh. It is not a grant of every archived costume. The original catalog contains27 initial costumes for26 communication identities; Bell has two, with priority1 InitialEquip selected over priority0 BasicEquip. None of these27 initial costumes has a linked voice. Full23a2fd8 separately checks all42 kind2 voices against seven costume groups, regardless of communication key. Repository initialization23a1e90 reads the kind byte at FlatBuffer vtable offset0x12 (slot7), then23a1f0c/23a1f10 skips kind1 before constructing/inserting the row. Only repository kind0 voices use the matching key and each voice's own hero CP level, not maximum CP across heroes. At zero CP the first24 identities therefore have THREE Daily Talk voices each, not21; the final two have none. The shared entry/CP helper now excludes Reaction Voice requirements. No replacement pools are invented.

The existing `stage_entry.capture_json` now captures the original catalog hash, initial-costume before/targets, selected default, all seven global costume baselines and qualified voice before/targets alongside its actual character/three-track/stage capture. Shared costume validators and effects prove actual candidate saves; costume/voice observations checkpoint independently of communication state/time and stage flags. First selection must match the original default. Preowned states and saved halves cannot vanish or relock. Completed entries reuse the existing indexed costume_unlock_floor and stage floors, including the preowned global costumes that qualified their voices; still-locked global inputs do not acquire a floor. Profile/capture/observations/floors/sequence/reply remain atomic. There is no new SQL table, fabricated operation/ACK, profile/signature/owner/CP pre-credit or wire field. Profile state indexes preserve duplicate-row rejection and avoid a full-profile filter per consulted voice. Native absent CP remains absent unless supplied.

Original260b124:260b334 initializes the costume integer at row+80 to0, and260b5d0:260b6b0 confirms the selected-costume getter/setter at that offset. Thus the source accepts numeric costume0 only for an unjoined communication row; joined state2 still requires an original matching costume. Raw signatures are preserved. The constructor's internal row+160 mask=-1 is **not** proof of the serialized signature default; older claims of a native UINT32_MAX signature require separate field/serialization verification. Deferred UINT32_MAX fixtures are explicitly synthetic.

Old captures lacking wardrobe data, missing/corrupt catalog/inputs and lost completed floors retain their data and cancel3000999 rather than inventing a post-save baseline. This does not make legacy recovery usable.2418d64 unconditionally calls241ac00(state2) for the matching communication ID, so repeated already-joined callbacks remain an implementation gap, not a proven first-only native predicate. Later ordinary costume selection is not pinned to the first-entry default. CP-level source handling follows below; other communication refresh producers, completed communication-state/time lifecycle and native ordering remain incomplete.

### Friendship-level voice refresh

The original bounded23e6b08:23e7564 setter was reread together with raw instructions from the hash-matched ELF.23e6b44 captures the old active level;23e6cb0 derives the new level and23e6cb8 branches to23e7240 when unchanged. The changed-level branch resolves the original communication character at23e70d4 ->2418b0c, refreshes quests at23e7198 ->246c0c4 and calls the full voice refresher at23e7204 ->23a2fd8. It does **not** call costume auto-grant/default selection or change join time. This is a level-change callback, not a callback on every point gain or every login.

Existing stage_delivery/friendship_reward_claim `friendship_unlocks` JSON now optionally carries a `voices` capture when a level-changed target has an original communication identity. The same original voice capture/receipt/effect helpers serve communication entry and CP refresh. They combine mapped characters' after-effect three hero tracks, retain actual global costume/qualified voice baselines, deduplicate nonadditive global voices and replay the catalog/threshold proof from captured inputs rather than current post-save rows. Stage/skip/PVE/Element and11000/21000 use the shared source path when their actual native friendshipStates require it; no CP or voice grants are invented for PvB or absent states. Unchanged-level/unmapped targets retain the old voiceless shape; changed-level legacy captures missing voices remain preserved/unavailable, not backfilled.

Independent `v:ID` observations join CP/quest observations. Voice-first and CP/flags-first saves preserve all preowned states and saved halves, while partial push suppresses additive delivery only and retains the full queue. Both stage and friendship/dispatch ACKs require actual candidate voices plus existing point/quest/item/XP/SP proofs. The existing indexed costume_unlock_floor records completed voices and preowned global costumes that qualified them in the same transaction as profiles/observations/queue/done/sequence/reply. Shared stale-binary-pull comparisons now also consult these floors, covering entry/PC/CP voice rewards without an explicit costume_reward_claim. No SQL table or native/wire field was added; no signature, CP point, voice, costume choice, join time or owner is pre-credited or rewritten.

## Deferred acceptance and remaining gaps

Updated `test_stage_units.cjs`, `test_gacha_persistence.cjs`, `test_gift_characters.cjs`, `test_gift_delivery.cjs`, `test_achievement_units.cjs`, `test_memoria_rewards.cjs` and the explicit synthetic draw helper are **NOT RUN**. Stage checks add character-first/missing-owner0/already-unlocked/three-track baselines, malformed ownership/state/CP, early ACK, legacy missing capture, observation/floor rollback, deletion/rewind, higher state, cache/restart and unchanged preowned branches. Gacha checks add character-first saves, missing rows/captures, queue retention, split-unit completion, duplicate floor merging and restart. Shared fixtures explicitly supply a synthetic character delta; generic stage-XP helpers do not secretly supply missing acquisition proof.

Batch acceptance must repeat stage/skip/PVE/Element/PvB, gifts, missions, regular/ticket/tutorial/shop gacha, panels, inventory/CP/dispatch, recovery, Android and launcher checks, then observe genuine native signed acquisition/save/ACK order, interruptions, back/home and no crash/ANR. Synthetic prerequisites/stats/signatures are not natural earning or native rendering proof.

Also extended, **NOT RUN**: `test_stage_entry.cjs`, `test_character_stage_unlocks.cjs`, `test_stage_friendship.cjs`, `test_friendship_heroes.cjs`, `test_friendship_rewards.cjs`, `test_pc_status.cjs`. Both local/zero owners exercise all hero tracks, split stage/CP/quest saves, dispatch and consumed CP gifts, owner/type/identity rejection, persistence/replay/rollback and earned floors. A missing CP row can arrive before, between or after first-entry saves without owner/signature normalization; the unchanged absent branch still must not precreate it. Public-profile/competitive/Familia consumers must be included in the deferred native batch. This removes source owner0 rejection, not native earning/order/crash acceptance.

New `test_pc_costumes.cjs`, extended master byte/boolean/joins/provenance assertions and explicit synthetic gacha/gift helpers are **DEFERRED / NOT RUN**. They queue all original PC metadata targets, gift/gacha absent-state1/preowned2/3, unit/costume-first persistence, early ACK, malformed owners, no native prewrite/unrelated voices, legacy missing captures, completed relock/deletion guards, restart/cold delivery and floor-transaction rollback. Repeat explicit costume rewards, stage/skip/PVE/Element/PvB, missions, gifts, all gacha families, guest handling, save/pull/recovery/Android/launcher checks. Review older hand-built ACK fixtures for omitted slot76 deltas; generic XP helpers still do not secretly supply acquisition proof. Native signed initialization, callbacks and scene/save order, natural acquisition, cold-back usability, no crash/ANR and measured performance remain unverified.

New `test_communication_wardrobe.cjs`, updated `test_stage_entry.cjs` and the explicit synthetic communication fixture are **DEFERRED / NOT RUN**. They queue all26 identities, all24 communication/flags/costumes/voices save orders, Bell's priority default, per-hero CP thresholds, all seven global kind2 groups in states2/3, no absent-CP precreation or native precredit, preowned preservation, later costume selection, pending/cold/restart saves, relock/deletion, legacy/corrupt captures/lost floors and profile/entry/stage-floor/costume-floor/reply rollback. Repeat all shared costume/PC/CP/stage/skip/PVE/Element/PvB/gacha/mission/gift/save/recovery/Android/launcher checks before the consolidated native pass. Syntax checks and source inventory regeneration are not execution of these deferred checks.

New `test_friendship_voices.cjs`, updated quest/hero checks and explicit synthetic shared ACK fixtures are **DEFERRED / NOT RUN**. Queued vectors cover plain CP/item/stage, all three heroes/both voice-CP save orders, all26 communication identities, inactive-hero threshold independence, all seven global costume groups in states2/3 with preowned voice3, unchanged-level skip, no costume selection/join/precredit, early ACK/partial delivery, retained legacy/corrupt captures, restart/stale voice-only binary pulls, deletion/relock and floor/queue/done/reply rollback. Existing dispatch/PVE/Element/stage/CP suites now have explicit synthetic voice deltas; native multi-character dispatch and mixed producer ordering must still be accepted in the consolidated batch. All these checks remain unrun.

**Still incomplete:** repeated joined communication callbacks and completed state/time lifecycle, other voice refresh producers, CP level-reward stats/received flags/achievement effects,23e6a14 quest observers, initialization/default stats/HP/skills/signatures, other reward producers, legacy/cold reconciliation and temporary guest lifecycle. First-entry and CP-level wardrobe/voice source proof is implemented, not native acceptance. The158-source export removes the guest-catalog data gate, not native guest ownership/level/expiry/save-order acceptance. Native earning/signatures/mixed-save order/navigation/back/no-crash-ANR/performance remain unverified.175 routes:103 partial,72 unsupported,zero complete; this is not full gameplay or crash-fix acceptance.

## Executed entry/voice recovery check (2026-10-06)

`node tools/test_communication_wardrobe.cjs` and `node tools/test_friendship_voices.cjs` passed on disposable SQLite profiles. The entry check covers the24 usable first-stage graphs, explicit unchanged recovery for the original Haruhime/Wiene parent episodes without a normal first stage, all24 four-table save orders, per-hero thresholds, global costume voices, observed floors and transaction rollback. CP checks cover plain/item/stage producers and split voice/point saves; their MessagePack pull, stage reward-inventory and fixed home-bootstrap fixtures were corrected without relaxing server guards.

Exact old entry receipts containing Reaction Voice requirements can be reconciled on listener startup. The old formula, full graph, catalog and baselines must validate first. Original receipt bytes are retained in `legacy_entry_voice_backup`; only excluded requirements/observations are removed. The ordinary entry-save planner then checks actual persisted communication, CP, stage, costume and Daily Talk state and commits the existing floors. Native profiles/tokens, wallet, queue and ACK history are never synthesized. Missing real Daily Talk stays pending; corrupt/missing graph or lost observed saves stay blocked and unchanged. Repeated startup is idempotent. This narrow compatibility repair does not accept arbitrary legacy captures or migrate every old CP producer receipt.

Native isolated profile `eb8b83ee`, date2019-10-18: tutorial draw171000570 kept Ais1011002003, real LotteryDraw save/ACK settled operation1, and subsequent first-entry saved exactly140000027/140000443/140000859. The old21-target entry blocked restart; the corrected launcher recovered that receipt from those actual saved flags, reached town, and opened/closed the offline notice page. No ordinary stage-completion request was observed during the bootstrap battles. Details and limitations: [gacha-persistence-contract.md](gacha-persistence-contract.md).

## Executed Bell board progression (2026-10-06)

On that same isolated save, the later ordinary Bell1-1 reward/save/ACK produced
native level3 Bell/Hestia/Ais and actual earned falna. Native Bell showed
HP108/MP18 and Next44; EXP-book stock was0, so no book enhancement was tested.
No unit, wallet, item, board or eligibility prerequisite was injected.

Bell's original job106000101 End+2 panel consumed one armor-small falna
294000004 and1000 Valis, saving DailyMissionComplete20886. Valis10408 became
9408, falna amount0 retained cumulative1, and End/DEF9 became11. The original
Strength panel107025001 was then released using the displayed2-free-Iris
option: consume81031001 via `currency/hard/consume`20887, native
StatusBoardOpen20888 and real ACK3. Free Iris3 became1, paid Iris stayed0,
Valis stayed9408, and Str/PAT10 became12. The saved purchase receipt retained
actual PC1011001001/job106000101/panel107025001/free cost2.

The native first-board mask33555457 (`0x2000401`) retains opened Str index1,
End index11 and the original reserved flag. Opening the screen also lazily
created original job106000107 with mask `0x2000000`; this was a native save,
not a server-precreated board. Both opened panels and stats rendered after
an actual stop/relaunch, with receipt1, done IDs1..3, empty queue and no repeat
charge. Screenshots: `.work/native-bell-board-20261006.png` and
`.work/native-bell-board-cold-20261006.png`.

`test_pc_status.cjs`, `test_pc_battle_status.cjs` and
`test_ability_panels.cjs` passed isolated checks. They exercise original data
with explicitly synthetic stat/gear/funding vectors and are not native proof
for every unit, gear source, rank/LB/ascension/EXP cost or consume kind. This
limited board case was checked on the preceding portability build; the later
hot6000 rebuild is documented in [the mission contract](achievement-reward-contract.md).
All broader character-acquisition, CP-level reward and gameplay limits remain.

## Ordinary ability-board checkpoints (2026-10-07)

A disposable probe reproduced a real persistence gap: an ordinary Falna board
save followed by its stale pre-upgrade snapshot returned200 and relocked the
earned bit. Iris purchase receipts already protected purchased panels; ordinary
board saves had no equivalent checkpoint.

The shared `user_data/push` planner now checks affected initialized owned,
non-guest PCs using the original panel index/group catalog and actual prior
unit/board state. Existing acquisition validators and `gift_pc_floor` retain
accepted progress in the profile/reply transaction. This also covers saves
coalesced under mission triggers, not only `StatusBoardOpen`. Cached binary
pulls of `UserPC`/`UserPCJobSet` compare current bytes, cancelling obsolete
responses rather than hiding earned boards. No table, dependency, operation,
reward, signature, wallet grant or native opening bit was added.

`node tools/test_native_board_checkpoint.cjs` passed after failing before the
fix: stale bits, deletion/owner changes, PC removal, cache cancellation, cold
persistence, reordered jobs, later upgrades and profile/checkpoint/reply
rollback. Its synthetic stock/signatures prove persistence, not original costs
or natural earning. Fresh related ability-panel, gacha, stage EXP/persistence,
gift, PC status/battle-status and launcher checks also passed.

Real isolated `eb8b83ee` progression released two more Bell Str+2 panels,
five Ais Str+6 panels and three End+5 panels through saves20961..20970. Each
used one naturally held matching Falna and1000 Valis. On the patched runtime,
Ais's sixth Str+6 release20977 saved mask34275559 and subsequently retained
totalExp1020 after actual battles. Stop/relaunch rendered PAT61/DEF31 with
the same opened panels. Valis29816 became18816; Strength11 became3 and
Endurance10 became7, preserving cumulative acquisition. Iris9 stayed unchanged.
Screens: `.work/native-ais-checkpoint-20261007.png` and
`.work/native-ais-checkpoint-cold-20261007.png`.

Boss1-4 genuinely lost at turn7 again; retirement20982/area20983 returned
to usable stage selection and discarded272 run Valis without a fake clear.
The insufficient Skill Falna and EXP-book stock were not funded or bypassed.
Recipes/cost validation, rank/LB/ascension, guests, defaults, all native upgrade
paths and full character gameplay remain partial.

Local offline-built/installed APK SHA256:
`6ed35b42473ea2cafb945b308374094faf43321b9a32ca8622d6436bc2c68e22`.
Installed runtime server/source SHA256:
`4919254eea5d10e5ae10653c9eabf6a586f30c92ffd2a4adb3a3184cc76e7f64`.
All seven packaged server modules matched source. Original Adventure5 was not
opened or changed; its2022-08-20 selection was restored with game/listener
stopped and19 profiles retained. No workers or GitHub Actions.
