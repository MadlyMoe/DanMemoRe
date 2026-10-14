# Record Buster offline completion policy

## View and ranking-prize cache boundary — SOURCE ONLY / UNTESTED (2026-10-14)

All six Record Buster views now use one original-season and acknowledged-best
builder for fresh and exact cached responses. It rechecks pending result
exclusion, native record floors, indexed best/player proof, immutable score/team
and the route-specific response. Empty-to-ranked and higher-score/team/profile
changes recover instead of replaying obsolete history. Lower/tied clears and
unrelated current-party changes retain the immutable historical response. Both
page-0 and omitted-page friend forms use the same guard.

Summary cache replay additionally probes ranking-prize eligibility without
writing. When the original group/total prize becomes due, the old response is
rejected so a fresh summary can atomically create Presents and publish receive
flags. The probe itself cannot create Presents or alter the profile. The added
cases in `test_pvb_views.cjs` are written only and have not been run.

## Pending result and score-event source binding — SOURCE ONLY / UNTESTED (2026-10-12)

The pending 19000 delivery now checks its captured stage and event against the
original PvB catalog, its scoring policy and score/recording fields against the
signed result, and its objective IDs against the per-task claim receipts.
Already-received objectives retain their earlier settled claim owner and saved
completed flag; a repeat result does not require minting another claim. A
damaged private capture cannot redeliver or ACK another PvB event
or objective while retaining the original queue and rewards. Corrupt-capture
cases in `test_pvb.cjs` are WRITTEN ONLY; no checks or emulator run accompanied
this change. Original19000 emits `PvbScoreEvent`. Read-only original-binary
tracing found all three listeners at raw `0x2123e78`, `0x21242e8` and
`0x21269dc`. The first matches authored slot10 event keys and calls the additive,
int32-saturating setter `0x2358a98`. The second compares authored slot11 with the
event score, reads required slot9 through `0x2358958`, then calls absolute setter
`0x2358854`. The third accepts only the active PvB event ID and calls the same
additive setter. The decoder now exports all3595 original rules:1377 type1201
event thresholds,2214 type1202 event-key cumulative goals and four type1203
active-event/global cumulative goals. Category, selector, required value,
threshold, dates and reset type are retained and validated against the original
PvB keys; no guessed mission is added.

New19000 receipts capture the canonical owned `UserAchievement` rows and their
sorted SHA-256 digest at issuance. An independently saved achievement change is
accepted only when it preserves exact row identities and every non-progress
field. Every owned applicable row must show the complete listener result before
the adapter may suppress the whole event: a matching type1201 row may become its
authored required value only after that event's threshold; matching type1202 and
global type1203 rows may receive only the exact clamped score addition. A partial
listener footprint, or unrelated, wrong-event, below-threshold, rewritten or
unknown achievement change, is rejected. That actual native save is
captured by its after-digest while the pending result remains suppressed from
the push reply.
Cold confirmation, pull and direct retry can then emit
`offlinePvbScoreEventApplied:1`; the ARM64 adapter skips only the already-saved
event dispatch and continues the original allocation cleanup, clear, record
and ACK path. Rewind, a second change, a legacy receipt without the canonical
baseline, or any transition outside those three listeners retains the operation instead of
guessing. Row reordering alone does not block recovery. No achievement progress
is precredited. A saved record before the
stage clear can cold replay when the owned record equals its original signed
target, the stage is otherwise at its captured baseline, and the achievement
digest still matches. The original clear routine sets state4 before adding
cumulative/daily counts. A saved state4 alone can therefore accompany an
untouched or exact saved-record replay without adding the count twice; its
private `clearState` observation and real clear/ACK remain distinct. Record
import and state assignment are absolute; the still-unsaved clear and score
event follow the original 19000 callback. An already-added cumulative/daily
count or date is accepted from `user_data/push` with the result suppressed.
Read-only ARM64 extraction now proves Operation19000's fixed `0x1f0` callback
frame, clear-call return `0x246f03c`, and retained response wrapper at caller
`SP+0x90`. Separate guarded count/date shims use that root only for the exact
PvB return; foreign and recursive clear callers still execute the original
helpers without JSON access. The cumulative-setter shim additionally checks
the outer clear caller before selecting the PvB stack offset. Derived control
values skip only the already-saved cumulative/daily increments or LAST date;
the remaining original clear, tasks, record/event processing and real ACK are
unchanged. Changed or unknown records and other partial effects remain guarded. Deferred
achievement-first, record-only, state-only, first/repeat partial-count and count-rewind, same-second, changed-progress,
unchanged/reordered, legacy, cached retry and full-ACK cases are written only.
This is not full route support.

For an original all-zero first clear, the saved cumulative-before-daily prefix
enters the durable stage observation set. Repeat clears with an original state4,
positive count and complete first/last dates now use the same durable cumulative
and daily observations. A later save cannot rewind either observed count after
restart. A repeat's clear/ACK also requires exactly one added cumulative count.
Normally its last date must advance; a receipt-backed exception permits equality
only when `pvb_clear.issued_at` exactly equals the captured prior last date. That
private issue second distinguishes an original same-second callback from a bare
legacy count prefix. An early count-only ACK still rejects. The daily count may
fall after the dated clear because the original daily reset is independent.
First and repeat prefixes can cold re-enter through the caller-specific adapter: value `2`
skips only a saved cumulative increment, value `1` skips both saved increments,
and the date marker skips only an already-saved LAST timestamp. The original
remaining callback and full ACK are still required. Once a complete clear and
its receipt-valid LAST are both checkpointed, a later client-day daily reset may lower
only the live daily counter. Recovery retains that reset value while the two
existing controls skip the old count/date work. Same-day lowering, future or
changed dates, and counter-only cross-day recovery still refuse.

Source implementation only. Logical tests, APK deployment and native acceptance
are deferred. This is a partial system, not publisher scoring/ranking parity.

## Frozen-client contract

Client15.1.0's shared wrapper `0x2472bec..0x2473704` selects
`pvb/stage/complete` for adventure mode15. The producer sends original
`pvbStageId` and `userPvBScore` with signed-int32 `totalDamage` and `turnCount`.
The capitalization is **userPvBScore**, not userPVBScore. Ordinary stage fields
and the stage/token retry identity accompany this request.

Operation19000, registered at `0x20694a8`, consumes `pvbResult` and
`userPvbRecord` at `0x246e9f4..0x246f38c`. It does not invoke the generic reward
operation5000. Result fields are:

- int32: totalDamage, baseScore, turnCount, maxTurn, turnBonusRate, difficulty,
  difficultyBonusRate, previousRank, currentRank.
- int64: turnBonusScore, provisionalTotalScore, finalScore, adventureStageId.
- boolean isRecorded; array aroundPlayerInfo.

Each around-player entry requires name, pcId, gradeId, rank, score and
difficulty. The current follow-up below includes only the genuine local best;
there are no fabricated neighbouring players on the solo board.
New zero-score records retain native-style zero defaults. A new recorded high
uses solo rank1 for the genuine local participant, retaining an existing nonzero
group ID or assigning local group1. Received/aggregate flags are preserved.
There is no fake solo/global rank assignment or immediate leaderboard prize.

The record reader `0x27d13e8..0x27d1b6c` consumes exactly11 fields:
userId, pvbId, groupId, totalRank, groupRank, score, pvbStageId, isAggregate,
isReceiveTotalReward, isReceiveGroupReward, scoreInt64. The operation creates an
absent record, sets event ID and zero scores, then merges these fields. It does
not automatically max the incoming record, so the server must retain an older
higher score. Client records are keyed by **pvbId**, not stage/group ID.

The operation emits a PvbScoreEvent with event ID and finalScore clamped to
int32 only for that achievement event. It directly calls stage completion
`0x2451924` with count1: clear state4, cumulative count, last date and preserved
first date. Objective processing is in that native clear path, not a fabricated
generic reward envelope. Original message40582563 directs score-reward claims
to the Mission Screen; message40480023 permits mission qualification after
ranking closes. The handler does not treat an undefeated boss as an invalid PvB
result: the separate isEnemyAnnihilated flag need not be true in this mode.

## Original archive data

Exports retain152 information rows with their linked adventure's raw window
slots6..9;942 unique original PvB stages and their seven difficulties; and8
survival-bonus rows;1,976 original grade rows and26 communication-character
links. Source paths, SHA-256 hashes and row counts are recorded in
`data/danmemore-master.json.sources`. All942 ordinary stage first-clear reward
triples are empty. Their2,826 original objective rows each award one Iris.

Unidentified stage values stay `slot4`, `slot5`, `slot6`; survival-table bounds
stay `slot3`, `slot4`. Their offline interpretation below is **not** a recovered
publisher schema or formula. Archive/Lua and native table-consumer inspection
did not recover server scoring arithmetic. The published descriptions mention
damage, difficulty and survived turns, not an exact formula or rounding rule.

## Reconstruction: offline-pvb-v1

The following are explicit offline choices over the original values:

| Output | Offline rule |
| --- | --- |
| baseScore | submitted totalDamage |
| maxTurn | largest survival slot4 for rows matching stage slot4; currently15 |
| turnBonusRate | survival value whose slot3..slot4 contains min(turnCount,maxTurn);0 if none |
| turnBonusScore | floor(baseScore * turnBonusRate /10000) |
| provisionalTotalScore | baseScore + turnBonusScore |
| difficultyBonusRate | original stage slot5 |
| finalScore | floor(provisionalTotalScore * difficultyBonusRate /1000) |

The original stage slot6 is1 throughout this build and is guarded, not assigned
an unproven extra multiplier. Raw turnCount remains unchanged; only bonus lookup
is capped. Submitted fields and baseScore are nonnegative signed32-bit values;
bonus/final scores retain safe nonnegative JavaScript/SQLite integers, including
values above int32. The record's legacy score field is capped at int32 only when
a new recorded high is set; scoreInt64 keeps that full high score.

New completions require window6<=event clock<=window9. `isRecorded` is true only
through window7. These inclusive boundaries and cutoff meanings are documented
offline policy, not proven publisher eligibility. Within the later window, the
client still receives the actual new score for its achievement event while the
previous recorded high is retained. Pending exact retries and ACKs remain
deliverable after expiry. Clock changes never reset records or objective prizes.

## Persistence and save proof

`pvb_clear` captures stage/event IDs, raw statistics, scoring model, exact result,
target record, original stage baseline, submitted objective IDs and the issue
second for new receipts. Legacy null issue times remain valid only for the
historically supported strictly-later repeat path. The existing
permanent stage/token receipt owns retry identity. One pending19000 per event
prevents two difficulties from overwriting each other's unacknowledged record.
Lower/tied scores preserve the previous best stage and record fields. Default
zero-score records still require a real owned native record after19000; unlike
the Seventh Zone setter, this operation creates a record even with score0.

Authored submitted objective prizes use the existing permanent `stage_reward`
ledger and wallet transaction. Previously received objective flags suppress
unknown legacy reminting. No unsupported stage item, ranking prize, PC or
friendship reward is silently minted. Skip, nonempty loot and friendship-result
branches remain explicitly unavailable until their native delivery is recovered.

Queue, result/record/objective receipts, once-only Iris and response cache commit
atomically. The server does not pre-credit the native clear or event record.
ACK requires the original stage/token/result/record receipt, unique owned clear,
counter/date/objective proof, and an owned event record preserving at least the
target high score and previously received flags. Split stage/record saves and
ACK can cross a restart. A proven durable clear can reconcile a pre-clear stage
retry; it cannot substitute for a missing event record. Unknown legacy captures
remain queued and unavailable instead of being accepted as fake success.

The ACK transaction updates bounded `pvb_record` and `pvb_stage_record` floors,
marks done and removes the queue row together. `pvb_objective_receipt` stores
only the first receipt for each original objective and uses completed-operation
proof. Later saves cannot remove/rewind completed scores, best-stage identity at
the same score, received flags, clear counts, first dates or proved objectives.
Checks use materialized records/bounded objective receipts, not a lifetime battle
history scan. Existing save/reward paths are reused without a new dependency.

## Summary, rankings and player details

All six view routes now have source handlers, **NOT RUN or deployed**. They are
an explicit single-account reconstruction, not lost publisher leaderboards.
Only a real acknowledged recorded high becomes the local rank1 participant.
The original grade whose raw slots3..4 contain rank1 supplies grade ID/art; no
ranking reward is minted. One local page uses index0/isFinalGrouptrue. Friend
initial/around-self requests omit `page`:25517a0 checks native sentinel -99
(GOT4326ae8 ->3557390), sending only pvbId. That body and explicit page0 contain
the genuine local comparison; subsequent pages terminate with
empty rows/hasNextPagefalse. Nonempty remote social state remains unavailable.
These pagination/group choices are offline policy, not recovered service rules.

Native response contracts:

| Route | Required root fields / reader |
| --- | --- |
| summary/get | pvbGroupRankingIndex, isFinalGroup, pvbGroupRanking, userPvbRecord;2552700 |
| group/ranking/get | pvbGroupRankingIndex, isFinalGroup, pvbGroupRanking;25532fc |
| total/ranking/get | pvbTotalRanking;25549c8 |
| friend/ranking/get | pvbFriendRanking, optional hasNextPage;2553db8 |
| character/ranking/get | normal, assist arrays of int32 rank/pcId;2141c44 |
| player_info/get | playerInfo, pvbParty, pvbRecord array;24cd18c/25564d0/255bbc0 |

Summary/group/total/friend rows require userId/int64, name/string, pcId/int32,
gradeId/int64, rank/int32, score/int64 and difficulty/int32. Summary includes the
complete11-field record even before a native row exists, but does not insert one:
the callback only merges existing rows. Pending19000 results block view refresh
so a summary cannot overwrite a partially saved but unacknowledged high score.
Positive legacy scores without matching captures stay explicitly unavailable;
zero/absent participation produces a genuinely empty board.

`pvb_player_capture` stores the actual name/EXP/portrait at completion issue,
plus the saved native UserPvBParty only when its unit/memoria identities agree
with the selected UserParty. No historical stats/equipment are constructed from
current UserPC. DomainPvBParty::createShared at255a790 copies a DomainParty;
native party reader2773d90 handles userId/slots/memoriaSlots. Fresh battle stat
and save ordering **still requires native verification**: matching identities
alone do not prove freshness. Mismatched/absent full snapshots are not published
as history. An initialized owned selected-slot1 PC may supply a genuine captured
portrait only; usage/player-party views then remain unavailable.

ACK publishes `pvb_best_capture` only for a captured recorded new high whose
saved event score/stage match that operation. It commits with record floors,
done and queue removal. Lower/tied/later-period results and clock changes retain
the earlier capture. Indexed event pointers avoid scanning all battle history.
An unsolicited higher save cannot be paired with an unrelated earlier party.

Character usage counts the actual best party separately by main/assist identity,
orders frequency descending then PC ID, and assigns local ordinal ranks. This
is **offline usage policy**, not publisher popularity percentages or methodology.
Local player details expose current owned profile fields and the immutable
historical party/event record. Favorite communication IDs join the original
character keys for current hero friendship points and actual owned costume.
The points-versus-displayed-level semantics remain unverified. Optional
userAdventureLevelInfo is omitted rather than fabricated. Remote profiles,
missing parties and legacy nonempty title-badge exploit mappings remain
unavailable; an empty exploit list is limited to profiles without saved badge
rows. No view changes wallet, native records or queue merely by being opened.

## Still required before completion

`node tools/test_pvb.cjs` and updated master/general-server checks contain deferred
synthetic probes for all942 stages/152 events, original objective Iris, lower
repeats, zero/int64 records, difficulty changes, late-period scores, windows,
strict fields/owners, split save/ACK, interrupted delivery, permanent receipts,
same-second repeat provenance/recovery/ACK, regression guards and request/ACK
rollback. The new same-second cases have **not been run** on this implementation.
Synthetic unlocked stages and saved flags do not prove native
objective processing or natural progression.

`node tools/test_pvb_views.cjs` contains deferred probes for all152 empty event
summaries, six response shapes, split/pending refresh guards, immutable parties,
lower/tied repeats, difficulty changes, original grades, late dates/restart,
missing/legacy captures, remote/social cancellation and ACK-pointer rollback.
The updated completion probes also cover capture/pointer transaction rollback.
These probes have **not been run**. Native screen entry and end-to-end playability
are not certified. Publisher arithmetic/availability, ranking
groups/rewards, fresh historical high-score party saves, defeat/retire variants, nonempty
loot/CP results, SP/cost/save ordering, native objective flags/Iris refresh,
mission events, zero/high-score creation, hot/cold result UI and natural unlocks
remain pending. No emulator save or installed APK was changed in this slice.
See the consolidated packet checklist.

## Original group/total prizes and offline Presents (2026-10-06)

This supersedes missing-all-ranking-prize statements, not lost publisher
groups/global standings/tally timing or native-acceptance gaps. Coverage stays
175 routes,103 partial,72 unsupported, zero feature-complete. Implementation
first/testing later remains in force: actual player SQLite/listener/APK/MuMu
were not changed; no workers or GitHub Actions, co-op last.

Original exact1c3a24c:1c3acbc and1c3b230:1c3bca0 read the separate group and
total reward vectors. Both filter long slot1 by the actual event ID, pass
int32 slots2/3 as rank endpoints and resolve five int32 item-ID/quantity pairs
from slots4..13 through25e3a5c. Slot0 is unused and remains absent. Exact
1c366d0:1c36d14 displays equal endpoints as a single rank, maxRank0 as an
open-ended range, and other endpoints as a range. It hides nonpositive counts.
Only this valid cell section in `pvb-ranking-reward-cell-flags-exact-20261006.txt`
is used; the unrelated295... sections are not PvB setter evidence.

Exact299ee18:299ef0c and29b4dcc:29b4ec0 identify original table names;
29b66c8:29b670c and29bc8cc:29bc910 select their root vectors. Read-only jobs
completed actual exit0 before artifact reads. The established decoder now
exports separate `pvbRankingRewards.group` and `.total` maps preserving row
and pair order, original open-ended endpoints and exact item profiles:

- `pvbGroupRankingReward`:1064 rows/152 seasons, SHA-256
  `bf7f49499265f219409aa096676365f073533ca40a49597b8da870717b46dc51`.
- `pvbTotalRankingReward`:1820 rows/152 seasons, SHA-256
  `04bbd19a77ea896e37b416525dc9d1d29702408a8d8075f43704f6089f23f810`.

There are now154 sources. All previous152 hashes and master exports, the
PvB scoring/grade/event catalog and War Game v1/v2 identities are unchanged.
Season55000000001 local group rank1 uses StatusBoardSpecial5,
EquipmentMaterial289990016×75 and CpItems215000001/3/5×50 each; total rank1
uses Iris1000. Other seasons retain their own authored quantities, including
equipment-evolve and HeroSublimate items. No guessed or substituted amounts.

Original27d13e8:27d1b6c reads the11 record fields. Corrected raw, exact
28505d4:28506b4,28506b4:2850794 and2850794:2850874 setters hold protected
boolean aggregate/total/group reward values at+130/+158/+180 and set dirty
byte+1e0 on change. These ranges are confirmed in original bounded ASM and
`pvb-ranking-reward-protected-flags-exact-20261006.txt`; displayed Ghidra
addresses include a100000 bias and are not used as raw code addresses.

Explicit offline policy reuses the existing single-account/group rank1 board.
After the inclusive original recording cutoff(window7), both authored prizes
are produced together at window7+1 from an acknowledged positive recorded best,
not a default/zero record, imported score or pending19000. Original publisher
aggregation/reward timing is not recovered. The best pointer, exact immutable
19000 operation, captured before/target/raw score/result, completion token,
player identity, done row, latest record floor and native saved clear must agree.
Score recomputation uses the existing disclosed offline-PvB formula, not a
claim of independent combat verification or publisher arithmetic parity.

`pvb_ranking_reward` captures one event/best-operation/catalog/before/gift
production. `pvb_ranking_gift` indexes durable gift IDs. Existing `createGifts`
produces original RANKING8/COMPANY1 Presents, with explicit offline permanent
expiry0; the existing2000 handler performs actual claiming. Native publication
changes only aggregate/group/total reward flags and the table token. It does
not precredit wallet, ordinary inventory, combat results or native signatures,
change score/difficulty/group/rank, rewrite an old19000 or import history.

The packet transaction commits captures/index/gifts/publication/profile tokens,
sequence and reply together. Fresh login/confirm, relevant full pulls and
summary settle; cached views stay read-only. Stale summary/details, full binary
pulls or confirmation tokens cannot restore pre-publication flags/Presents.
Shared native read/save/gift guards retain corrupt/missing proofs and reject
changed gifts or publication rewinds. Gift claims reuse once-only wallet and
cumulative inventory receipts, observed-additive suppression and exact native
flag/item/save/ACK proof. Claimed gift cleanup cannot reuse the indexed ID.

Clock rewind cannot reopen recorded-score earning in a rewarded event. Existing
post-competition practice results remain available through window9, preserve
the original best/flags and cannot replace or remint prizes. Later acknowledged
practice floors do not rewrite the original reward capture. Indexed best/clear/
gift/claim pointers avoid lifetime battle scans; each guard batches the native
stage index once, with at most152 original seasons. Performance is not measured.

Extended `test_pvb_views.cjs` and `test_master_data.cjs` are **DEFERRED / NOT RUN**:
all original ranges/pairs/hash/joins, inclusive cutoff/no early prize, exact
group+total quantities and no wallet precredit, capture/index/profile/reply
rollback, stale summary/pull/confirm cancellation, corrupt/null retained proof,
flag rewind, restart/once-only publication, clock-rewind recorded-score rejection
and later practice, original best-history loss,2000 Iris claim, early ACK,
split received flags/interruption/restart/once-only credit and unclaimed restore.
Existing ordinary17-table gift acquisitions/mission/PvB/War/Under/Serial/save/
recovery/clock/Android/launcher checks remain queued. These flags and parties
are synthetic; native popups/inventory/flag refresh, signatures, natural earning,
event-save-ACK ordering, usable recovery/back and no-crash/ANR/performance remain
unverified. Loot/CP/skip, independent combat, original group/global aggregation
and complete Record Buster acceptance remain unfinished.

## Local best in the completion result (2026-10-06)

Original bounded ASM `246ec38..246ed20` reads exactly six around-player fields:
string name, long pcId/gradeId/score and int32 rank/difficulty, then calls
`255a0a8` with userId0. That constructor is not a JSON reader. The existing
ranking views separately require userId. Operation19000 does not invoke generic
loot/CP delivery; the skip/nonempty-loot/friendship guards remain intact.

Fresh recorded highs now include the captured local participant with the
original rank1 grade and full best score/difficulty. Lower, tied and practice
results reuse the indexed acknowledged best capture, not today's name/party or
the unrecorded score. Zero/default records and unmatched legacy history stay
empty. This is explicit solo-offline ranking policy, not publisher neighbours.
The shared row builder and acknowledged-player lookup serve completion and
all six views without new schema, dependency or native-profile precredit.

Prize proof accepts old immutable empty-list receipts unchanged; nonempty rows
must exactly match that best's captured player and original grade/stage. Pending
retries keep the original envelope. Existing save/ACK/floors/prizes are retained.
Extended `test_pvb.cjs` and `test_pvb_views.cjs` queue all942 stages, zero/int64,
lower/tie/name/party changes, practice, legacy missing history, exact retries,
old-empty proof and altered/duplicate/null rows: **DEFERRED / NOT RUN**.
Native result rendering, natural earning, signatures/save ordering, recovery,
crash/ANR and performance still need the consolidated acceptance pass.
Coverage remains175 routes/107 partial/68 unsupported/zero complete. Actual
save/listener/APK/MuMu and all161 original sources are untouched; no workers or
GitHub Actions, co-op last.

The subsequent `currency/hard/consume`10500 follow-up captures the native
Record Buster daily stock/reset-time refill, replacing the old minimum-only
purchase ACK. See [refill persistence](stamina-consume-contract.md). Native
natural battle costs and end-to-end SP/save ordering remain pending.

## Executed isolated checks (2026-10-06)

`node tools/test_pvb.cjs` and `node tools/test_pvb_views.cjs` passed on disposable
SQLite saves: all942 original stages/152 event records, local-best result rows,
original solo ranking Presents, int64/objectives, replay, restart, save/ACK and
rollback. This supersedes their earlier NOT RUN notes only. Native result UI,
natural earning, scoring/ranking parity, signatures and end-to-end recovery
remain pending; no real save, listener, APK or emulator was changed.
