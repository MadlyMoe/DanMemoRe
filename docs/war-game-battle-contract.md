# War Game battle contracts: source implementation, acceptance pending

2026-10-06. Actual save, listener, APK and MuMu untouched. No workers,
GitHub Actions, functional tests or native builds/installs. Co-op last.
Original15.1.0 ARM64 SHA-256:
`E49A8CC7991F8946365A28AEBAD605CE566B034826DD4B34A982AB18B38303B3`.
All addresses below are raw ELF; Ghidra displays raw+0x100000.

## Original entry and response

`2140078:2140214` calls player-status25410ec/2544958 with quantity1, sets
processing1 through25f1ee0, then emits `PvPStartEvent` through2140214.
The debit precedes the native start request rather than being a new operation
in its response.2544958 resets the timer before consumption when stock>=10;
lower stock follows the original1800-second interval getter and retains its
projected timestamp. No Under medal, ticket or season allowance was copied.
Original UserInfo serialization25f8df4 names `processingPvPState`, reads
the protected int32 at+3f0 and emits that int32;25f1ee0 sets the same member.
The older `processingPvP` boolean is preserved, not inferred from that setter.

Start wrapper19342cc sends only pvpId. Callback1948880 reads battleId,
randomSeed:long and pvpPlayerInfo with userId:long/name:string/totalExp:int32/
gradeId:long/score:int32/friendRelationShip:int32. It applies pvpParty through
256111c, substitutedSpineIds through23ec300 and pvpRecord **ARRAY** through
213f9b4 before2140434 builds/enqueues the battle context and saves
`UpdatePvpState`. Resume2140d68 also sends only pvpId;2142f74 consumes result0
and the same context, with totalExp read as long. It restores processing1,
not another stamina debit. No native start/resume operation or ACK is invented.
World2213a84 dereferences the season record before battle/end, so an absent
lobby record alone is insufficient to start combat safely.

Completed serial read-only artifacts:
`pvp-battle-entry-native-sp-consume-exact-20261006.txt`,
`pvp-start-event-native-processing-exact-20261006.txt` and the existing
`pvp-response-consumers-exact-20261006.txt`.
Each new job used exact original unwind bounds and completed exit0; tiny
wrapper/callee tail expansion is not a larger recovered function body.
The processing serializer follow-up was inspected in original assembly.

## Explicit offline behavior

Start requires the requested original nonzero matching window and an owned,
idle, configured native competitive party. The existing details validator
was lifted intact into a shared function, not replaced by a stat builder.
The opponent is a visibly labelled **[Offline CPU] Mirror team**, with a
private identity and the actual frozen native party vectors. It is not a
publisher player, reconstructed original dummy-PvP roster or remote account.
Original dummy/matching/score tables remain uninterpreted where their field
semantics are unproved; no heuristic config inspection/export was performed.

For a genuinely untouched season, an explicit offline bootstrap uses the
native absent-lobby UI's1000 starting display score and the unique original
order0 grade. This is **not recovered publisher bootstrap or earned score**.
Existing initialized records are retained. Native rank/highest-grade/history/
reward flags are preserved or retain constructor defaults; no prize is minted.
The record is delivered to the original callback, never prewritten into the
native profile. Stamina/processing flags/signatures/inventory/wallet likewise
are not server-precredited.

## Durable entry and saves

Indexed `war_game_battle` freezes original catalog, native before-state,
selected party, response, ID/seed and save observations. A partial unique
index allows one active battle. `war_game_request` binds each received-wire
hash, action and transport identity permanently to that battle and response.
Issue, identity, sequence and reply use the existing outer SQLite transaction.
There is no lifetime scan, new dependency or second battle simulator.

The shared save transaction observes exact one-SP debit/timer, processing1
and the delivered record independently, allowing record-first or Info-first
split saves. At stock>=10, a receipt accepts an explicit offline -5/+120-second
skew around issue time and permanently pins the actual saved timestamp;
below10 it requires the exact raw/projected original timer. A timer-only save
is not debit proof. Already saved resource/record/processing cannot rewind
inside active combat. A separate nullable current-SP checkpoint permits exact
original interval recovery while the entry debit stays immutable; full/extra
stock still does not decay or reset its timer, and a second debit is rejected.
Selected IDs and native vectors remain frozen, but
unrelated PC counters or party HP/MP are not whole-table frozen.
Native record/vector comparisons use the standard semantic object comparison,
not JSON property order:2783df4's field order differs from bootstrap insertion
order. Received-wire identity and persisted response bytes remain exact checks.

Pending replacement/login/confirm/summary, another entry, competing mode
entry or refill cannot discard those checkpoints. Fully saved resume uses
the same seed/party/battle ID after restart/cache eviction or original matching
expiry, without another SP spend. Old start callbacks cannot repeat a saved
entry. Cached combat-related native pulls compare current full MessagePack
bytes, not old profile tokens alone. Wrong/corrupt/obsolete captures cancel
3000999 with state retained, without legacy/current-save backfill.
The existing shared event-clock selector now also waits for an active War Game
battle to finish, not merely an operation ACK. War Game has no new queue
operation, so queue-only checks would otherwise strand it in a different
native selected season. Ordinary time advancement and captured late resume
are not blocked; no clock/source-profile rewrite is manufactured.

## Deferred acceptance and remaining work

### Bounded entry clock follow-up (2026-10-12, PARTIAL / UNTESTED)

Original2140078 performs the local one-SP consume before its start request.
The passive getter and2544958 cap reset can therefore read the game clock
before the server records `issued_at`. Entry reconstruction now evaluates the
same already-established local -5/+120-second receipt window in addition to
the raw and exact issue-time states. This admits only distinct original
1800-second projections with positive stock. It covers a boundary crossed
between getter/consume and request arrival without treating a later server
projection as the only possible native debit.

Below-cap candidates retain their exact whole-interval timestamp. At cap,
the existing reset-before-subtraction validator still requires an actual
saved reset timestamp inside that bounded window and pins it after the first
save. The unchanged active receipt still needs exactly one debit plus native
processing1 and record proof before resume/end. No SP, timestamp, profile,
operation, signature or ACK is prewritten, and nothing outside the existing
window is inferred.

Two focused helper cases were added to `test_war_game_battles.cjs`: a request
arrival straddling a recovery boundary and a client-ahead boundary inside the
existing +120-second allowance. They are **WRITTEN ONLY / NOT RUN**. The full
split/coalesced save and finish matrix also remains deferred. Arbitrary skew,
unrelated SP producers/history and native clock/signature/save ordering, UI,
recovery and performance remain unfinished or unverified.

### Pre-debit save follow-up (2026-10-09, PARTIAL / UNTESTED)

Original2544958:2544b54 calls25ea800 to reset the timer **before**
25447d8 subtracts SP. Getter25444d0:2544610 first calls25ea720 to write
recovered stock, then25ea800 to write the completed1800-second timer.
25ea720 marks UserInfo dirty on a changed amount. These are independent
setters, not evidence that a real save collector always samples between them.
The planner now retains both stock-first and completed pre-debit recovery.

The existing nullable `sp_current_json` now also retains an actual native
pre-debit pair: the frozen baseline, exact issue-projected recovered stock
with the unchanged frozen timer, its completed natural projection, or a
cap/extra-SP timer reset inside the existing local -5/+120s window.
This is not a new publisher timing guarantee. `sp_saved_json` stays NULL
and `observed` contains no `sp` until the corresponding one-SP debit.
The frozen `before_json` remains unchanged; no profile, token, resource,
signature, operation or save is prewritten or repaired by issuance.

Once a changed pair is saved, another raw/projected branch cannot replace
it. A stock-first pair may save its corresponding completed timer separately
or coalesce that timer with the final debit. It cannot substitute the raw
debit or keep the old timer in a below-cap debit. A recovered cap pair may
still reach the original timer-reset setter,
either separately or in the final debit save. Once an actual changed reset
time is saved, it cannot be repinned. Resume/end and cold profile replacement
still require all original entry observations. An otherwise unobserved exact
start retry retains its original captured response, not another spend.
After debit, the existing immutable debit/passive-recovery checkpoint applies.
Profile/token, pending pair, observations, sequence and reply use the existing
shared save transaction; there are no new columns, exports or dependencies.

Extended `test_war_game_battles.cjs` is **WRITTEN ONLY / NOT RUN**:
timer-only/stock-first saves and repeated puts; rollback at profile/proof/reply;
pending retry/cache eviction/reopen; blocked premature resume/end; stock/time
rewinds, repinning and switching debit candidates; completed recovery before
debit; recovery to cap then timer reset; stock-first coalesced timer/debit
below-cap and at-cap; extra SP and raw-empty recovery; forged pending
stock capture, timer-first below-cap, completed-timer rewind to stock-only;
unchanged frozen before-state and wallet/queue. Synthetic vectors/funding
remain fixtures, not native earning or save-order proof.

Post-debit/finish stock-only fragments, projections outside the bounded
entry-clock window, native timestamp ambiguity, signatures and natural callback/save ordering
remain unfinished or unverified, along with ranked/global matching/prizes
and the rest of the packet branches. No tests, static/syntax acceptance,
builds, packaging, installs, listener restarts, emulator/ADB checks, workers,
Actions or metadata generator were run. All packets/branches must be
implemented before the consolidated pass; co-op remains last.

### Post-debit and finish recovery follow-up (2026-10-09, PARTIAL / UNTESTED)

The same original25444d0 stock-before-timer order now applies after a saved
entry debit and during a queued14000 finish. One shared planner preserves a
no-change pair, exact completed1800-second recovery, or a stock-first increase
bounded by recovery available at the actual save acceptance time. Full/extra
SP cannot use the getter to increase or restamp itself, and no second debit
or10400 refill is admitted through this branch.

There is no new column or migration. A newly observed post-debit stock-first
save stores `{sp,recoveryBefore,recoveredAt}` in existing `sp_current_json`.
`sp` is the actual received pair; `recoveryBefore` is the previous completed
native pair; `recoveredAt` is the server's acceptance clock, **not a recovered
publisher timestamp**. The exact before-pair must still project from the
immutable original paid debit. Stock must rise, retain that old timer, stay
at or below10 and be available at recoveredAt+5. The existing5-second arrival
tolerance remains explicit local policy. Legacy full pairs retain their
original exact validation; an inconsistent untagged pair is not inferred
into recovery or repaired. Missing/corrupt tags cancel with state retained.

Repeated and unrelated sensitive saves retain the same marker/clock. The
timer phase must preserve the already received amount and equal the original
projection from its captured complete before-pair. A second stock increase,
raw stock rewind, fractional timer or extra stock is rejected. Completion
uses the later of the current and retained acceptance clock as its arrival
bound so clock rewind does not erase an already valid observation. It then
returns to the legacy full-pair representation. This does not implement
arbitrary second AppTime-read skew or normalize native timestamps.

The paid entry remains immutable, with its existing processing/record/SP
observations. Already complete resume/finish does not require another entry
spend.14000 still requires its actual result record and processing0 before
ACK; it has no SP-reward application, so this change adds no new ACK barrier
for independent recovery. A tagged last-observed pair can remain in a closed
historical receipt; a later normal UserInfo timer save does not rewrite that
battle's debit, verdict or participation. This is not a global SP producer
ledger. Profile/token, marker, finish proofs/ACK and reply reuse the existing
atomic save transaction. No native prewrite, clock rewrite, new resource,
wire field, signature, operation or dependency is manufactured.

Extended fixture sources are **WRITTEN ONLY / NONE RUN**: post-debit cap
stock-first and timer saves, once-only debit, repeated puts, profile/proof/
reply rollback, durable marker/cache eviction/reopen/clock rewind, forged
marker/baseline/clock/extra-SP and inconsistent legacy-pair rejection;
two below-cap recovery cycles, before-interval and repeated-stock rejection,
unrelated PC-counter saves, timer convergence without another spend;
pending14000 below-cap recovery, finish-proof rollback, independent result/
processing saves and ACK, late normal timer save and unchanged usage/debit.
Synthetic values are not native order, signatures, earning or UI acceptance.

Entry projections outside the bounded window, arbitrary second-clock-read skew, global resource
producer/history attribution, native save/signature/order/UI/recovery/cold/
performance, ranked/global matching/prizes and other packet branches remain
unfinished or unverified. No tests/static/syntax acceptance/generator/build/
package/install/listener restart/emulator/ADB/workers/Actions were run.
All packets and unfinished branches precede consolidated testing; co-op last.

`node tools/test_war_game_battles.cjs` is **DEFERRED / NOT RUN**. It queues
explicit mirror/bootstrap and no-native-precredit checks; original pure
debit/timer examples; wire conflicts; matching boundaries; split save/restart/
expired-clock resume/passive recovery with pinned original debit; wrong stock/
timer/processing/party; unrelated counters;
corrupt nullable JSON/catalog/identity; and issue/profile/proof/reply rollback.
The test's manually closed marker is only stale-replay evidence, **not** an
implemented end or settlement. Existing War/Under/Serial/SP/save/pull/clock/
recovery/Android/launcher regressions remain deferred.

**battle/end remains unsupported.** Score/grade/highest-grade/history/usage/
prizes, active-battle closure, natural eligibility/bootstrap, actual event/save
ordering, signatures, constructors/AI, independent earning, interrupted back
navigation, delayed clock-skew convergence and no-crash/ANR/performance still
require implementation or native acceptance. Start/resume are partial, not a
playable War Game loop. Current audit:175 routes,102 partial,73 unsupported,
zero feature-complete. Syntax/static metadata checks do not satisfy visual play.

## 14000 settlement and usage follow-up (2026-10-06)

This follow-up supersedes the earlier unsupported-end/absent-closure statements.
All seven discovered War Game routes are now **partial**, not feature-complete.
Current inventory:175 routes,103 partial,72 unsupported. Actual save/listener/
APK/MuMu remain untouched, and every functional/native check remains deferred.

Original operation registration206982c..2069858 reads int32 key14000 at3497594,
then installs relocated4327100 ->213f600. Exact213f600:213f9b4 applies the root
pvpRecord array, reads pvpResult pvpId/gradeId/score/isWin, emits PvPEndEvent,
reports analytics through213ff0c, and clears processingPvPState through25f1ee0.
Only then does the World callback2215f4c save UpdatePvpState and show the result.
The score difference is a signed int32, including a bounded loss at score0.

Original2214df4 sends pvpId/battleId/result with isWin/isRetire booleans,
survivedPCs/spendTurns **int32 scalars**, and maxDamage:long. Original strings
and2783df4 serialization correct the earlier inferred streak naming:
213f9b4 reads **consecutiveWinCount** at34b6d53, not consecutiveLoseCount.
The callback does not produce consecutiveLoseCount/lastAdversaryIds/lastBattleId/
isReceiveReward. Those fields remain unchanged rather than pretending to save
server-supplied values that the native callback never applies.

Serial read-only jobs completed exit0 before their artifacts were consumed:
`pvp-end-operation-state-exact-20261006.txt` and
`pvp-end-usage-record-getter-exact-20261006.txt`. The original operation key,
relocation and request/streak strings were also checked directly in the ELF.
No publisher score, grade-threshold or prize algorithm was recovered.

The explicitly labelled mirror CPU now uses a disclosed **offline Elo K32
equal-score policy**: wins+16, losses/retirement-16, bounded at0. Wins/losses
and win streak follow the received client verdict. Existing current grade is
retained; highest grade advances only to that actually selected original grade
if its original order is higher. This is not publisher earning or grade
progression. Actual combat telemetry is client-authoritative offline, not
independently reconstructed combat. No Iris, prize, SP, rank, reward flag,
signature or native profile is precredited by battle/end.

Indexed war_game_end freezes verdict, policy/catalog, exact14000 envelope and
record/processing observations. The permanent received-wire/action/key ledger
also owns end replies. Equivalent fresh request identities reuse the same
queued operation; changed verdicts conflict. Split record-first/Info-first or
combined saves require the exact target record and processing0 before ACK.
An observed end cannot replay its end event: singular/plural push delivery is
suppressed while its queue remains; cold/profile replacement and ended-combat
resume cancel with state retained. Missing capture/legacy cached response is
never converted into a success or rebuilt from the current profile.

Actual profile/token/save proofs, active closure, latest per-season record,
usage increments, operation_done/queue removal, sequence and reply commit
inside the existing SQLite transactions. Per-season latest-record pointers
prevent saved score/counter rewinds even after another battle or restart.
Exact original passive SP recovery is still allowed; no extra debit/refill is
added on finish. Missing/corrupt pointers or captures retain state for recovery.

Each acknowledged offline attempt increments each distinct frozen normal/assist
PC once, including loss/retirement. Indexed counters and a checkpoint hash
avoid lifetime scans and do not infer imported publisher usage. The original
normal/assist rank+pcId view now consumes that earned local history, ordered by
count then ID with ordinal ranks. This is disclosed solo-offline participation,
not publisher ranking. Imported unexplained earlier wins/losses remain missing.

Extended `test_war_game_battles.cjs` is **DEFERRED / NOT RUN**: win/retirement/
floor/overflow/schema boundaries, no precredit, exact14000 hot/cold identity,
missing receipt/changed verdict, split save and suppressed callbacks, ACK before
proof, native record order, second fresh attempt, once-only participation,
record rewind, corrupted capture/index, and queue/receipt/profile/proof/closure/
usage/record/ACK/reply rollback. Shared War/Under/Serial/save/recovery/clock/
Android/launcher checks and every real-client flow remain deferred.

Original grade progression/prizes/season aggregation/history, native mission
observers/signatures/constructors/AI, independent combat validation, actual
effect-save-ACK ordering, interrupted navigation and no-crash/ANR/performance
remain unfinished or unverified. A source loop is not visually verified play.

## Original ordinary-grade progression follow-up (2026-10-06)

This supersedes the fixed-current-grade and missing-all-threshold statements
above. Source implementation remains partial:175 routes,103 partial,72
unsupported, zero feature-complete. Actual player save/listener/APK/MuMu are
untouched; functional/native tests remain deferred. No workers or Actions.

Read-only exact native jobs completed exit0 before their artifacts were read:
`pvp-grade-score-row-ui-exact-20261006.txt`,
`pvp-grade-row-model-exact-20261006.txt`,
`pvp-grade-range-cell-result-exact-20261006.txt`,
`pvp-grade-required-score-highclass-exact-20261006.txt` and the corrected exact
`pvp-grade-cell-score-threshold-exact-20261006.txt`.
1c42960 ->1c42e20 selects grade rows by the original season group;1c3ec70
binds its cell through1c47584. Exact1c47584:1c47f78 reads int32 slot7
(vtable0x12) into `home_arena_ranking_score_border`.1c41068 reads int32
slots5/6 (vtable0xe/0x10), formatting top/bottom ranking bounds rather than
score thresholds. Slot4 remains unidentified and is not exported or used.

The established decoder adds only minRank/maxRank/scoreBorder from those
proven slots. Same151 original source hashes,176 seasons and3420 grades;
all other exports and prior grade identities/windows remain unchanged.
Original season10000000138 has Little Rookie III1000, II1060, I1120,
Perseus III1200 and subsequent authored borders up to Hero III3600.
Hero II shares3600 but requires rank2..50; Hero I requires rank1.
Neither rank position is manufactured from a one-person mirror population.

New captured14000 results select the highest ordinary original grade whose
score border is reached. Losses can demote current grade but never rewind
highestGradeId; comparisons use original order, not ID arithmetic. Original
rank/history/reward flags stay unchanged. This is an explicitly disclosed
**offline grade-selection policy**, not proof of the publisher's server
promotion/rank eligibility algorithm. The existing offline EloK32 +16/-16
and floor0 remain; below the initial1000 border retains the lowest original
ordinary grade. No prize, SP, native profile or signature is precredited.

The existing receipt/save/ACK flow carries grade changes with its exact
record target; no new SQLite table, queue type, service or dependency.
Fresh battles pin the expanded catalog and v2 grade policy. A narrowly
projected legacy catalog retains exactly the previous five grade identity
fields/windows, so existing v1 in-flight and closed captures still validate
their original fixed-grade award. Those captures are never recomputed with
v2, mutated, dropped or backfilled from current profiles. Unknown catalog
changes still cancel with state retained.

Extended `test_war_game_battles.cjs` and `test_master_data.cjs` are
**DEFERRED / NOT RUN**. Queued checks cover ordinary borders/one-below edges
for all176 seasons, missing/ambiguous metadata, rank-gated exclusion, pure
promotion/demotion/highest-grade retention, earned handler-driven threshold
crossing and demotion across saves/restart, v1 in-flight/closed compatibility
and fresh v2 captures. Existing exact14000/no-precredit/split save/ACK/replay/
corrupt receipt/index/rollback and shared regressions remain queued.

Ranked grades, grade/season prizes, aggregation/history, native mission
observers/eligibility/signatures/constructors/AI, independent combat, real
event-save-ACK order, interrupted navigation and no-crash/ANR/performance
remain unfinished or unverified. Syntax and catalog integrity are not native
acceptance or visually verified play.

## Original grade-mission eligibility and6000 rewards (2026-10-06)

This supersedes the missing-all-grade-prizes/mission-eligibility statements,
not the remaining ranked-tier/season-prize or native-acceptance gaps. Source
coverage stays175 routes,103 partial,72 unsupported, zero feature-complete.
Actual player save/listener/APK/MuMu remain untouched; no workers or Actions.

Original ASM within23595e4:2359958 reads achievement int32 slot4 and branches
condition903 to235ae6c. Its tail-switch decompilation expands adjacent bodies;
that expansion is not a recovered whole-function switch. Exact235ae6c joins
achievement string slot10 to the original grade key, compares the selected
season record's highestGradeId with the required grade's group/order, then
sets progress to2358958's int32 slot9 goal. It does not directly grant rewards.
Exact2358854 changes progress only; original2358ba0/2358c00 transition a
state2 completed goal to state3 with the current native completedAt, and
2358d80 changes state3 to received4. No server-generated native mission flags.

Serial read-only exact jobs completed exit0 before artifact reads:
`pvp-grade-achievement-subscription-exact-20261006.txt`,
`pvp-grade-achievement-state-exact-20261006.txt`,
`pvp-grade-achievement-reset-exact-20261006.txt` and
`pvp-grade-achievement-reset-policy-exact-20261006.txt`; the existing exact
grade/season join and bounded original ASM were also inspected.23582a0 reads
int32 reset slot20 (vtable0x2c) and category slot2 (vtable0x8). For category3
with reset0 it returns false before date comparisons or resetting the claim.

The established decoder exports a separate `warGameAchievements` map from
these proven fields:1733 original condition903 missions, all category3,
goal1, reset0, with authored start/expiry windows. Its original achievement
source SHA-256 is7e2d49c44ba84ce9f95e5d2976c8d81ed7850ddbf1a22dfc421a5f4b7e7b8314.
All151 source hashes, previous master exports, `pvp` and original windows/
identities remain unchanged; existing v1/v2 battle hashes still validate.
The11 original reward types already use the generic6000 Iris/item delivery;
no guessed rewards, new reward service/table/dependency or native precredit.

Fresh `achievement/complete` now requires the owned native state3/goal and
an acknowledged local War Game finish whose highest original grade meets
the authored mission's group/order. Issued-but-unACKed promotion, imported
state3 flags without local history, another season or an unearned grade
cannot qualify. Later demotion does not remove earned highest-grade eligibility.
The same guard runs in the shared6000 receipt path for cached delivery, partial
saves and ACK. Missing/corrupt local history stays retained and unavailable;
old paid/queued claims are not repaired, backfilled or credited again.

The existing achievement_claim primary-key prefix seek also binds these
non-resetting mission IDs to their original completion date. A new timestamp
cannot grant the same authored mission twice. Same pending claim retries
reuse one exact6000; saved flags suppress delivery while the queue remains.
Wallet/queue/claim/capture/reply and native flag/item/save/ACK transactions
remain the existing generic mission machinery. Other condition types are not
given new eligibility semantics. Missing condition inventory fails closed.

Extended `test_war_game_battles.cjs` and `test_master_data.cjs` are
**DEFERRED / NOT RUN**: original1733 joins/goals/reset/reward types; earn the
1060 border inside the actual mission window, reject a pending promotion,
demote and retain highest-grade eligibility; owner/goal/higher/foreign grade,
expiry/missing catalog/reset metadata, exact6000 no-native-precredit/retry,
missing history during cached/save/ACK paths, received-flag interruption,
restart/date-change once-only and issue rollback. Generic item/PC-expiry
fixtures now select non903 authored IDs rather than forge PvP receipts.
All original mission/shared-reward/save/War/Under/Serial/recovery/clock/
Android/launcher regressions and real-client checks remain queued.

The native completion flags in these future checks are synthetic, not proof
of natural observer dispatch, signatures or effect-save-ACK ordering. The gate
uses acknowledged highest grade at claim time; independent first-reach/
completion-timestamp attribution and historic reset-clock recovery are not
proved. Ranked grades/season prizes/aggregation/history, constructors/AI,
independent combat, usable recovery/back and no-crash/ANR/performance remain
unfinished or unverified. Syntax/static integrity is not native playability.

## Original ordinary-season prizes through Presents (2026-10-06)

This supersedes missing-all-season-prize statements, not ranked-tier,
premium-bonus, publisher aggregation or native-acceptance gaps. Coverage stays
175 routes,103 partial,72 unsupported, zero feature-complete. Implementation
first/testing later remains in force: actual player SQLite/listener/APK/MuMu
are untouched; no workers or GitHub Actions.

The original reward UI provides a separate data source, not guessed mission
prizes. Exact1c42264:1c4235c filters `pvpRankingGradeReward` long slot1 by
season. Exact1c41068:1c41760 joins long slot2 to the original grade and passes
int32 slot3/4 and5/6 pairs to1c41760:1c41a2c. That icon function resolves the
first number through25e3a5c's actual item registry and renders the second as
the count; these numbers are item IDs, not reward-type enums. Exact
29ba4f0:29ba534 calls29acd20:29ace14, whose original string identifies
`pvpRankingGradeReward`. Unknown slot0 stays absent.

The established decoder exports `warGameSeasonRewards`, keyed by grade ID:
3420 exact authored rows across all176 seasons, retaining pair order. Source
`1/master/divide_enc/pvpRankingGradeReward.enc` SHA-256:
`b7a1f9bd0d737fb51de11f0131b3deb43154bb4a66dc2528d09d25fed9064130`.
There are now152 sources; the previous151 hashes and other master exports,
`pvp` identities and v1/v2 battle catalogs remain unchanged. All reward item
IDs join original item profiles. For season10000000138 the lowest ordinary
grade is Iris25; HeroIII is Iris750 plus HeroSublimateSmall8. Ranked rows
remain exported but cannot grant HeroII/I without an actual ranked producer.

Read-only exact jobs completed with actual exit0 before artifact reads:
`pvp-ranking-reward-row-icons-exact-20261006.txt` and
`pvp-ranking-reward-loader-flags-exact-20261006.txt`. The latter recovers
282f8b0's `isReceiveReward` byte at+1c8 and282f990's `isAggregate` byte at+1f0,
including dirty flags. Original branch scans and bounded ASM identify full
JSON27cbc10 and MessagePack2802800 loaders for `isReceiveReward`; the
213f9b4 partial14000 merge does not write it. Publication therefore changes
the server profile/token for a subsequent full native refresh; it does not
rewrite a previously issued combat operation or synthesize native signatures.

Explicit offline policy: after the original matching end, award the final
CURRENT ordinary grade from fully saved/acknowledged local battles, not the
highest historic mission grade. Original publisher prize timing/ranking
aggregation/premium eligibility are not recovered. A zero-length season or
unfinished competitive battle cannot produce a prize. Imported counters or
flags without complete local participation remain unavailable, not promoted
or reconstructed. No fake global rank1, grade promotion or population.

Existing `createGifts` and original RANKING8/COMPANY1 Present fields handle
production. Permanent expiry0 is a disclosed offline delivery policy.
`war_game_reward` binds one season to its immutable acknowledged final battle,
catalog/policy, pre-publication record and exact gift identities;
`war_game_gift` indexes those identities. Existing packet transactions commit
the capture, gifts, native publication flags/tokens, sequence and reply together.
The original combat floor remains unchanged. Only `isAggregate` and
`isReceiveReward` become true on publication; score, grade, rank, counters,
wallet, inventory and mission signatures are not precredited.

Fresh login/confirm, relevant full pulls and summary can produce due prizes.
Cached reads remain read-only. Old binary pulls or confirmation tokens cannot
erase/hide publication. Clock rewind cannot reopen an already rewarded season.
Shared save/read/claim guards retain missing/corrupt captures and reject gift
replacement or publication-flag rewinds. Claiming reuses the existing2000
gift_claim queue/once-only wallet/item/flag/save/ACK machinery. Native received
flags must save before ACK; interrupted observed operations suppress redelivery
with the queue retained. No second shop/reward service or new dependency.

Extended `test_war_game_battles.cjs` and `test_master_data.cjs` are
**DEFERRED / NOT RUN**: source joins/hash/pairs; original end boundary and
current-not-highest grade; no inventory precredit/ranked promotion; production
rollback on source/index/profile/reply writes; exact captures and publication,
restart/summary/once-only issuance; stale binary/confirmation token rejection;
gift owner/count and flag rewinds; corrupt/null capture retention; clock rewind;
2000 claim, early ACK rejection, split received flags, interruption/restart,
once-only wallet credit and unclaimed restoration rejection. Shared generic
gift/mission/War/Under/Serial/save/recovery/clock/Android/launcher regressions
and natural client checks remain queued. Synthetic flags are not native proof.

Actual prize refresh/navigation/effect-save-ACK ordering, natural mission
observers/signatures/constructors/AI, independent combat, ranked promotions,
premium bonuses, history/global aggregation, usable back recovery and
no-crash/ANR/performance remain unfinished or unverified. Source/static checks
do not make this a visually accepted playable feature.
# Current solo-local ranked-grade and prize branch (2026-10-09)

SOURCE ONLY / PARTIAL / UNTESTED. All tests, acceptance checks, builds,
packaging, listener restarts and emulator work remain deferred until every
original packet and unfinished branch is implemented. This supersedes only
the missing solo-local ranked-grade/prize branch below; it is not publisher
population ranking, matchmaking or verified gameplay.

Original `213f9b4:213fe18` explicitly reads the `pvpRecord` array's rank,
score, grade and highest-grade fields, with rank passed to `292ebac`.
The previously recovered original grade slots5/6 and7 remain the inclusive
rank bounds and required score border. Both requirements now participate in
the disclosed offline grade-selection policy: a rank does not skip a score
border. Original Hero I requires rank1; Hero II requires ranks2..50. The
single actual local participant has local rank1, not an invented remote
population. The mirror CPU is an opponent, not a second ranking participant.
Peer rankings and publisher scoring remain unavailable; co-op comes last.

New untouched zero-origin seasons pin a separate v3 battle/finish catalog.
Their real native14000 result carries local rank1 and the highest eligible
original grade; demotion retains highestGradeId, allowing the existing
acknowledged-history grade-mission guard to handle ranked grades as well.
No native record/rank, SP, operation acknowledgement or wallet is prewritten.
Follow-up v3 entries require the retained acknowledged local capture and
participation count. Imported noninitial scores, earlier ordinary-only
histories and missing provenance are not upgraded or backfilled. Existing
v1 fixed-grade and v2 ordinary-grade starts, finishes, operations and reply
identities retain their original captured policies, including after reopen.
No new schema, dependency or launcher module is needed.

At the original season end, fully saved and acknowledged v3 history can
select the original ranked grade's authored season reward row through the
existing once-only Presents publisher. Ranked reward receipts pin their own
grade/policy hash; previous ordinary reward hashes and captures are unchanged.
The original season10000000138 Hero I row contains1000 Iris205000001 and
15 of item99000001; neither is granted before its ordinary2000 Present claim.
Incomplete native saves, imported participation, forged rank/grade, stale
pulls, clock rewinds and duplicate publication remain subject to the shared
capture/save/ACK/gift guards and atomic profile/token/receipt/reply transaction.

Extended `test_war_game_battles.cjs` is WRITTEN ONLY / NOT RUN. It queues
all original ranked score/range edges, malformed/overlapping ranges, ranked
promotion/demotion/highest retention and old-policy exclusion. A disposable
zero-origin fixture earns Hero I through source-handler matches rather than
an injected native score; queued cases cover issue/save/reward rollback,
no rank or inventory precredit, reopen, unacknowledged mission refusal,
acknowledged mission eligibility, original two-item season Presents, summary
and once-only/rewind behavior. Actual fixture2000 acquisition is queued for
both1000 Iris and15 HeroSublimate item99000001, with flags-before-items,
early ACK refusal, split item save/reopen, ACK rollback and repeat-claim
persistence. Imported noninitial progress retains its ordinary policy rather
than gaining ranked provenance. Existing v1/v2/save/gift cases remain deferred.
Actual native signatures, callback/import/save/ACK ordering, ranked result
and prize rendering, all reward-item claims, cold navigation, performance
and no-crash/ANR acceptance are still unverified. Premium bonus eligibility,
publisher/peer standings, legacy provenance and other packet branches remain
unfinished; no feature-complete claim or coverage-count increase is made.
