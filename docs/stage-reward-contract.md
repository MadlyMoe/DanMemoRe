# Stage rewards and interrupted saves

## Saved feature flag or story graph effect before the remaining stage result — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-12)

The original common clear callback enables feature flags through `23b10a8`,
which changes only flags still at zero. Already-positive flags have no repeated
effect. Its direct story-successor path `2452e28` rejects an already-open
nonzero successor before applying unlock work. Those two original behaviors
make their exact saved prefixes idempotent when the remainder of the same
signed stage operation must be replayed.

The completed-difficulty, next-episode and special-mode graph branches use the
same `2451204` state-1 setter for every ordinary open. Their eligibility paths
reject or skip an already-positive target. Recursive narrative clears do use
the additive clear helper, but every non-root invocation is reached only after
that same locked-state eligibility check. An exact saved state4 row therefore
skips the clear call itself on replay; its captured counters and dates must
still pass `savedStoryEffect`. The always-executed root clear does not inherit
this exception and remains on its separate count/date recovery controls.

`stageColdRecovery` now admits only captured required `feature:<id>` and
`unlock:<stageId>` and `autoclear:<stageId>` keys for direct or graph-produced
effects that are present in both the durable receipt and the currently
validated native rows. It returns the unchanged operation; the original graph
skips each already-positive target and performs the unsaved root clear,
counters, dates, rewards and other progression. There is no server
flag/stage/reward prewrite, new control field or early ACK. Missing, relocked,
foreign, malformed-counter/date, unobserved or graph-drifted rows still refuse.
The root clear/counters/dates and other unguarded additive progression are not
included because replay could apply them twice.

Deferred `test_feature_unlocks.cjs` and `test_stage_unlocks.cjs` cases now cover
side-effect-free cold derivation, direct/difficulty/chapter/event opens and
recursive narrative clears, original and cached stage retries, login, confirm,
binary pull, stale pull rejection, remaining native saves and full ACK.
Root-clear-first without its complete count/date proof retains cancellation. All are
WRITTEN ONLY / NONE RUN; no tests, static acceptance, build, patcher,
installation, listener or emulator work was performed.

## Stage ability boards saved before an absent unit — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-12)

The common stage callback calls the same shared unit initializer used by gacha.
That initializer reuses an already-owned valid `UserPCJobSet` before it creates
the missing `UserPC`, so a native interruption can durably leave the board set
first. `stageColdRecovery` now retains that prefix only for a captured fresh
first unit with no current PC, no completed unit floor, an exact valid board
set, and both durable and current `pcset:<pcId>` observation. Character,
no-linked-voice outfit, story and initial-guest prefixes may coexist only under
their existing independent proof gates. A foreign, invalid, missing,
unobserved or reordered board set still refuses recovery.

Recovery returns the unchanged signed operation so the original constructor
creates the unit and performs every remaining component effect. It does not
create a row, grant a reward, advance a flag or acknowledge the operation.
Normal stage ACK still requires the complete unit, boards, character and every
other captured effect. The deferred `test_stage_units.cjs` board-first case now
covers exact/cached/cold/login/confirm/pull projection, missing durable
observation refusal, remaining native saves and final ACK rollback. It is
WRITTEN ONLY / NONE RUN; no test, static acceptance, build, patcher, listener,
installation or emulator work was performed.

## Saved stage unit with unfinished boards, outfit or story — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-12)

This supersedes the earlier boards-only recovery. A captured first PC
still requires an actual valid owned unit, durable and actual `pc` observation,
valid owner/progress and no completed `gift_pc_floor`. A character row present
at issuance must retain its owner/state/CP; when the capture proves the row was
originally absent, the unchanged native character refresh may lazily create
state1 and advance it to2. A missing board set qualifies only when the
captured jobs are empty, no board row exists and no `pcset` observation was ever
committed. The original slot76 outfit and authored first unit story may now be
unfinished separately or together. Already-open outfit2/3 and nonzero story
states remain complete; a missing outfit with linked voice effects is still
guarded because this path cannot prove that coupled save.

A narrow guest-bearing form now uses the same recovery instead of rejecting an
otherwise identical saved unit. The stage capture must prove that the PC was
absent at issuance and identify the guest as exactly `initial` or `restored`;
the current `UserGuestEvent` must retain its captured owner and EXP minimum.
An initial guest additionally requires the durable and current
`guest:<pcId>` observation produced by its native save. A restored guest was
already present at issuance and therefore requires its captured baseline rather
than a fabricated new observation. Existing permanent unit floors and
`target.guest` remain excluded. Once the real `UserPC` is saved, controls1..4
resume only the remaining original component work; the server does not create,
reset or promote the guest.

Coupled CP is admitted only after every gained PC mapped to that character has
the exact unit recovery proof above. The current character must retain the
captured before points or exact saved target; an acquisition-created initial
row additionally retains owner0, state1/2/3, untouched other hero tracks and
its actual initializer observation. Saved refill HP/MP remain exactly the
captured before or target, and quest/voice/refill observations remain
character-attributed. When CP is saved but that fanout is unfinished, the same
derived operation composes `offlineStagePcResumes` with the existing
`offlineStageCpLevelPending` on the first original friendship entry. A fully
saved fanout needs only the unit control. This reuses the two existing native
guards and original callback order; it adds no state, protocol field or hook.

The per-occurrence `offlineStagePcResumes` value is a remaining-effect mask plus
one:1 means no extra component work,2 means boards,3 means outfit/story, and4
means both. Control5 means this exact duplicate occurrence's additive personal
bond is already covered by its complete captured numeric-stock checkpoint.
Only an eligible fresh first occurrence is1..4; an unsaved duplicate remains0.
The original gain list, results, quantity, type, identity, token and signature
are unchanged. A supplied older derived envelope may narrow unit effects, lose
its CP marker after the exact original fanout, or move a duplicate0 to5 after
the complete bond checkpoint. Control5 cannot move back or change identity, and
no other field may change.
Queued controls and native saved-table controls still reject. The server creates
no component and grants no completion or ACK credit.

Original22ded68/22dfe60/22deee8 remains the normal-board path. Original slot76
field9c/default0 lookup139c3ac, costume manager2504c48, conditional outfit/voice
helper2505fc4, adventure manager2469080 and conditional unit-story helper2473d9c
remain the unlock path. The ARM64 source guard153fd80 is304 bytes and admits only
exact signed/unsigned integers1..5. Values1..4 retain the192-byte helper153fec0,
which requires native
kind1, uses bit0 for a separate initialized shared-job pair with the original
atomic/virtual/d68330 cleanup, and bit1 for the original conditional outfit/story
helpers using the actual PC and common PC-key vtable. Value5 branches directly
to original246cc2c per-element cleanup after the original predicate has proved
the occurrence is a duplicate, skipping only246cb24:246cbf0's bond lookup/add.
Missing PC, invalid marker, fresh construction, every unmarked duplicate,
character/communication continuation, signing, save and ACK paths remain
unchanged. Native lifecycle acceptance is still deferred.

The deferred matrix is now174 WRITTEN ONLY cases:96 ordinary cases from two original reward identities ×
absent/pending/ready character × one/two occurrences × ready/missing boards × all four
outfit/story prefix combinations, plus six existing-unit guest cases from two
original guest identities × initial/restored-retained/restored-permanent capture.
Another72 cases cover two guest identities × three capture roles × all three
heroes × present/absent character × pending/complete CP fanout. The guest cases
cover the real unit+guest prefix, initial guest observation, restored baseline,
cold confirmation, binary pull, composed unit/CP controls and the fully closed
CP variant.
Quantity2/prerequisites/stats remain explicit
synthetic probes. Cases cover no precredit, lost saved-prefix proof, prior board
observation/captured-job refusal, malformed and cross-operation controls, hot/
cold/cache/pull/restart, board and unlock transactional rollback, both effect
orders (old4-to2 and old4-to3), monotonic convergence to1, opened outfit3
preservation, advanced unit/board retention, remaining real effects, preowned
wire-loot-plus-bond and fresh quantity-two saved-bond recovery, and final ACK
rollback. Deferred native assertions cover exact type/range,
effect bits, branches, stack slots, shared lifetimes, original helper targets,
spans and mismatch guards. NONE RUN.

The final archive's346 PC initial outfits have no linked voices; voice-only repair
after an already-open outfit remains rejected rather than invented. Coupled CP
without every saved unit proof and other coalesced progression, warm-cache dirty flush or lost journals, other ABIs, event emissions and natural UI/crash/
performance acceptance remain unfinished or unverified. No tests/static
acceptance/patcher/build/install/listener/emulator/workers/Actions.173 partial/
3 unsupported/0 verified complete across176, co-op last.

## Already-saved first acquisition and remaining character refresh — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-12)

The pristine common handler246c874:246c8cc calls22ec100 for every gainedPCs
occurrence. An existing joined PC takes the additive personal-bond path at
246cb24:246cbf0, rather than the fresh path's character/communication refresh.
Re-entering22ebbbc is not a remaining-effect solution: that constructor checks
existing ownership too.22eba54, however, returns the existing shared domain PC
and returns a zero shared pair on a missing lookup. Original array iterator
13e4300/13e43d0 stores its element at+10, not the object iterator's+8.

Shared stageColdRecovery classifies a captured first PC only after its
actual unit and every already-saved constructor component remain valid. Eligible
never-saved boards and no-linked-voice outfit/story targets are represented by
the newer remaining-effect control described above. A captured present character
must keep its owner/CP and original-or-acquired state; a capture-proven absent
row may remain absent for the original lazy refresh. A guest-bearing unit gains
this exception only with the exact captured initial/restored and current saved
guest proof described above; its coupled CP is admitted only through the exact
per-character/per-unit composition above. A completed unit
floor, lost saved components or lost proof do not gain this exception. Once-per-
table snapshots reuse the existing native-shaped validators; no state or
completion is inferred from ownership alone.

The derived parallel offlineStagePcResumes array preserves the original integer
gainedPCs, results, quantity, ordering and immutable operation identity/token/
signature. Only the original first occurrence of each eligible fresh PC is1..4;
later occurrences remain0 unless their exact complete captured numeric bond is
already saved, in which case only those occurrences become5.
Original queues/captures containing this control refuse, and no native saved
table may upload it. Hot singular/plural and cached replies now use the same
original-or-derived stage projection as cold confirmation. Actual native saves,
constructor/clear/XP/bond effects and genuine ACK remain required and atomic.

The existing ARM64 patcher source adds a304-byte guard at153fd80 and redirects
only246c880. A false original ownership predicate keeps the absent-PC path.
For a joined PC it requires two native JSON arrays, equal vector byte lengths,
an in-range16-byte-aligned original iterator offset and exact signed/unsigned
integer1..5 at that occurrence. Values1..4 use original22eb268/22eba54 with the unchanged
PC key, stores the shared result in original common SP88, performs only selected
original component helpers, and resumes246c8d0.
Value5 restores the guard frame and joins original246cc2c iterator cleanup,
skipping only the proved duplicate bond block.
The original character/communication predicates and shared cleanup then run,
without recreating/resetting the PC or granting an accidental first bond.
No marker/invalid marker keeps246c884; a missing lookup keeps246c8b8. Frame/link,
callee-saved state, current signature and real duplicate grants are retained.
Original save, signing, authentication, result dispatch and ACK are unchanged.

These earlier eight fixtures are subsumed by the174-case saved-component matrix
above. Actual remaining character/clear/XP and unmarked duplicate-bond saves still
settle the unchanged queue; all cases and native assertions remain WRITTEN ONLY.

NONE RUN. Existing-PC voice-only states outside the final PC dataset, coupled CP without every saved unit proof,
lost journals and other original
event/achievement/import/save/cache/ABI effects remain unfinished or unverified.
No tests/static acceptance/patcher/build/install/listener/emulator/workers/Actions;
173 partial/3 unsupported/0 verified complete across176, co-op last.

## Local stage receipts and save ACK transport — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-12)

Pristine OperationProcessor206a0c4 selects the type handler and computes the
original verifier before206a360 invokes it.206a39c:206a408 subsequently inserts
the successfully invoked operation into its separate ID-keyed local receipt
tree through206ba78. That tree is not consulted before the callback. The ARM64
patcher source now guards regular1000/tutorial1001/ordinary5000 at206a360: a positive matching ID,
type, signature, token and freshly computed original verifier suppress a
second callback while retaining the original processor result/save/ACK path.
Missing/mismatched local proof and all other types invoke the unchanged handler.
Regular22efdc0 and tutorial22f2088 both finish acquisition22f0170 before the
processor records their receipt; tutorial210c270 also finishes before return.
The unsigned1000..1001 gate compares the cached type to the actual incoming
type, so a regular receipt cannot suppress a tutorial callback or vice versa.
This is logical operation identity, not equality of derived JSON projections.
The strict nonempty long-string comparison is bounded to256 bytes. No signer,
reward acquisition, profile or server acknowledgement is bypassed/prewritten.

Read-only original20d2c08:20d2ec8 confirms its shared result carrier routes
user_data/push into20bd8f0. Both its special save handler and ordinary named-data
importer receive the carrier's JSON body at+58.20bd954 calls206a938 on that
response; the latter looks up the literal operations and erases local receipts
by each returned id. It does not queue pending rewards, and20be434 handles
UserLoginBonus instead of the server's additional dones field. Cold delivery
20bbca4, in contrast, parses full signed operations into the pending queue.

The shared server save producer now returns operations:[{id}] only for actual
acknowledgements committed by that request. Existing dones remains the same
list for saved history compatibility. A save-only fragment returns both empty,
retaining pending native receipts; confirm still returns full recoverable
pending rewards. Shared delivery validation reads the actual SQLite queue for
push rather than treating ACK-only IDs as rewards. All original saved-effect,
signature, profile/token/floor/queue/reply transaction checks remain intact.

Cached saves bind dones to the exact original request's ordered ACK IDs and
actual operation_done entries, rejecting pending, duplicate, foreign or missing
proof. Old cached pending-reward operations lists normalize in the response
only, using those proved ACKs; no cache, save, queue or receipt is rewritten.
Queue-only changes no longer invalidate an otherwise unchanged push ACK: it
does not deliver or hide that queue. Confirm retains its queue comparison and
all save replies retain current table-token/profile checks. No new native ACK
adapter, dependency, schema or forged completion is added.

Deferred server cases cover save-only/split/combined/repeated ACK, tutorial,
multiple ACKs with another pending operation, queue changes, restart, lost done
proof, corrupted ACK lists and legacy response normalization. Existing voice,
donation, CP, unlock, guest, Present and Prism source expectations now distinguish
native ACK IDs from pending rewards. The native guard has deferred exact span,
branch, frame, arguments, ID-tree, signature/token/verifier and fallback checks.
All cases are WRITTEN ONLY / NONE RUN. The source guard is now240 bytes and its
deferred cases include all three admitted types, signed/adjacent rejected types
and cached-type mismatch; other handler clock conditions are not inferred.
Live-journal absence, warm cache/save-flush
ordering, other operation types/ABIs, event side effects and full gameplay remain
unfinished or unverified. No tests/static acceptance/patcher/build/install/
listener/emulator/workers/Actions;173 partial/3 unsupported/0 verified complete
across176 routes, co-op last.

## Character/outfit/story saved before an absent unit — SOURCE ONLY / UNTESTED (2026-10-12)

The pristine common stage callback246c8cc creates an absent PC through22ebbbc.
Afterward246c968:246c990 independently resolves the character and calls
23e79f8/23e6888 only for state1. The same constructor's slot76 outfit helper
2505fc4 skips already-open2/3, and2473d9c opens only authored story0. Those
nonadditive prefixes can therefore survive a cold remaining acquisition
without being interpreted as completed units or duplicate bonds.

stageColdRecovery now reuses rewardPcKeys to classify committed original
character-row/character, no-linked-voice outfit and unit-story observations.
Each must belong to a captured first PC that is still absent, with no owned
board set or previous completed unit floor. Every admitted key must exist in
both the durable stage_delivery observation and the actual validated rows.
The earlier guest-record-first key uses those same absence/proof restrictions.
Changed owner/CP/state/catalog data, lost observations, prior ownership and
other unsupported PC/board/voice/CP prefixes retain their existing refusals.

Ordinary5000 constructor-only retries pass through the same recovery gate and
keep the whole original callback and gained-PC list; no new skip field, unit,
board, reward, flag, signature or ACK is prewritten. Cold projection remains
pure and the queue/capture immutable. Already-open state3 is retained, not
reset into state2/1. Full actual acquisition, clear/XP/other captured effects
and real ACK still settle the operation. Existing coalesced stage controls
remain separate; no general additive progression exemption is added.

Pending-stage candidate saves also compare to actual currently persisted
progress, not only the older issuance minimum. Shared unit/board/character
helpers reject lower saved unit EXP/job/LB/ascension fields, lost actual board
jobs/bits, changed character owner or lower state/CP. Initial outfit/story
states cannot regress, and captured guest owner/EXP cannot rewind after a later
save. Prior rows are read once per changed table inside the existing profile/
observation/floor/queue/reply transaction; no new ledger or schema is added.
HP/MP combat changes are not made monotonic by these acquisition guards.

Deferred test_stage_units.cjs updates the two existing character-first cases
and adds28 original-reward prefix cases: stages1160000601128/1160000901131
award1011020015/1011001029, whose archived slot76 outfits and authored stories
are used unchanged. Originally present/absent character × seven character/
outfit/story combinations. Synthetic prerequisites/stats are explicitly not
native eligibility or progression proof. Cases require pure original delivery,
strict persisted observations, preserved advanced3 unlocks, no unit/board
precredit, hot/exact cached/cold/login/confirm/binary pull, missing-observation
and relock refusal, incomplete ACK, prefix-observation rollback and six finish
rollback points, real remaining constructor/clear/XP saves and ACK. NONE RUN.
The advanced-prefix cases also reject stale2/1 unlock saves and stale unit EXP
or board-set initializers after newer actual saves. Two ordinary guest-first
cases preserve later guest EXP and reject its earlier initialized row; these
are synthetic preservation checks, not original earning proof. NONE RUN.

This is server-source remaining-effect support, not a native replay guarantee.
Warm native PC caches may differ from saved server rows; cache visibility,
dirty upload and original event/achievement side effects still need client
contract work and eventual native acceptance. Existing-unit/board-prefix,
linked-voice/coupled CP, other producer/import/legacy/clock branches remain
unfinished. No new native hook/schema/export/tests/static acceptance/build/
install/restart/emulator/ADB/workers/Actions. Counts173 partial/3 unsupported/
0 verified complete across176; co-op last, full goal active. Older character-
first cancellation notes are superseded only for these absent-unit prefixes.

## Saved guest record before an absent unit — SOURCE ONLY / UNTESTED (2026-10-12)

Original guest data identifies Ein1012030009 and Chloe1011041002, awarded by
stages1090002001108 and1090002701102. Neither appears in the recovered ordinary
lottery pools; this is stage acquisition, not an inferred new gacha banner.
The two pcGuest rows and100 level steps retain their original archive hashes,
thresholds and event-window contracts.

Pristine ARM64 stage246c874 calls22ec100 before choosing duplicate bond or
22ebbbc acquisition. An absent PC cannot take its joined duplicate branch.
The common DomainPC constructor22d8de8 matches pcGuest.slot1 to that PC and
calls26a82cc. Nonnull22d957c jumps to22d9650, bypassing guest factory22e7a8c,
owner/PC setters285c8b0/285c98c and registration26f19fc.22d8128 then wraps the
existing row, reading its saved EXP rather than resetting it. Evidence is the
bounded pristine instructions and stage-fresh-guest-construction-exact-20261006.txt
and stage-unit-duplicates-exact-20261006.txt, not a new runtime test.

stageColdRecovery now accepts committed guest:<pcId> observations only for an
original initial capture, absent captured/current PC and board set, and no old
completed gift_pc_floor. Existing exact owner/EXP/catalog capture and stage/CP/
XP/item/clear/clock checks remain. A native row without its committed
stage_delivery observation is not proof. Missing/invalid rows, lost completed
unit floors and closed temporary windows retain the save behind recovery;
other unsupported constructor/CP prefixes are not excused by a guest record.

Guest-only ordinary5000 hot/cache retries reuse this same guard. They retain
the whole original callback and gained-PC list, without a guest skip field,
synthetic unit/guest/bond, permanent ownership, reward, flag or ACK. Cold
login/pull/confirm can resume the valid prefix. Coalesced supported effects
still use their existing controls; this is not generic partial-stage replay.
Actual full native acquisition and normal stage save/ACK still settle it.

test_stage_units.cjs extends14 existing new/guest-first original-unit CP/
character variants and adds two saved-prefix-expiry cases. WRITTEN ONLY / NONE
RUN: pure unchanged recovery/queue/capture/guest rows, no unit/board precredit,
hot and exact cached retries, missing committed observation/row/lost floor,
restart/confirm/binary pull, incomplete ACK, observation/ACK/reply rollback,
real remaining constructor saves and original permanent-floor rules. At the
original exclusive expiry, hot/cache/login/confirm/pull reject with the row
and incomplete receipt retained, without a reset or newly owned unit.

No new native hook/schema/decoder export is needed for this guest-only branch.
Other constructor/CP combinations, guest reacquisition/reset/other producers,
coalesced/legacy/clock paths and natural native cache/import/dirty/save/ACK/
ownership/XP/signatures/UI/efficiency/no-crash/no-freeze remain unfinished or
unverified. No tests/static acceptance/build/install/restart/emulator/ADB/
workers/Actions. Counts173 partial/3 unsupported/0 verified complete across176;
co-op last, full goal active. Earlier guest-first cancellation notes are
superseded only for this original absent-unit prefix.

## Complete first-clear stage before other rewards — SOURCE ONLY / UNTESTED (2026-10-12)

A first clear may save its whole `UserAdventureStage` row before its other
captured rewards. The real stage push now pins that saved last-complete date
beside its observed full clear. Cold recovery requires the original
zero-counter/date baseline, the complete stage, and the persisted marker. It
derives the existing count/date skip controls, so the original callback can
apply its other effects without adding the clear twice. FIRST remains the
client's saved LAST value; no server stage, reward, or ACK is prewritten.
After that exact complete checkpoint, a later client day may retain the pinned
FIRST/LAST and cumulative count while lowering only the daily count. The same
count/date controls then resume the other effects without restoring the old
daily value. A same-day daily decrease, future/changed date, missing marker,
or counter-only cross-day prefix still refuses. The deferred full-first-row/
daily-reset/item/ACK cases are WRITTEN ONLY; the
ARM64 client adapter has not been rebuilt, installed or accepted in MuMu.

## Repeat-clear counter-prefix recovery — SOURCE ONLY / UNTESTED (2026-10-12)

A full repeat stage row may also save before its other rewards. A real
`UserAdventureStage` push now pins the newer last-complete timestamp beside
the observed `clear` marker. Cold login derives controls `1` for the
already-saved counters and last date, leaving the original callback to apply
only its remaining effects and real ACK. Once that complete checkpoint exists,
a later client-day daily reset may lower only `dailyClearCount`; recovery keeps
that live reset value while skipping the old counter/date setters. A same-day
decrease, future/changed date or missing pinned marker still refuses. This uses
the existing ARM64 controls; that client is not rebuilt or installed, and the
deferred full-stage-first/reset cases have not run.

The original `0x24528e0:0x24529fc` helper reads the existing cumulative
counter, calls its setter, then reads/adds the daily counter. A saved repeat
clear with the cumulative increment alone can therefore use the existing
`offlineStageClearCountsApplied:2` adapter to skip only that setter. If the
daily increment is also saved before the last-complete date, the existing
control `1` skips the whole counter helper. Both leave the last-date setter,
other rewards and real ACK to the original callback. This is limited to one non-skip repeat
from an owned state-4 stage with its prior first/last dates and counters intact.
The saved prefix must be exactly previous cumulative+1, daily unchanged or
previous daily+1, and both dates unchanged. An ordered cumulative-only then
both-count save advances control `2` to `1`. Counter-only cold replay requires
the prior last clear and current event clock to remain on the same client day;
only a fully checkpointed clear with its newer pinned LAST may cross that day
boundary. Other partially saved repeat shapes refuse.

The repeat ACK now requires the daily increment and a newer last-complete
timestamp, or an earlier observed complete clear followed by a daily reset.
The previous generic count-only clear check could mistake a repeat
cumulative-only prefix for a complete clear because its old last date was
already positive. This guard applies to ordinary, PvE and Seventh Zone
5000/16000/25000. PvB19000 uses its separate root/caller adapters and keeps its
record/score receipts, but applies the same complete-clear daily-reset rule.
Other peer-event result handlers retain their existing contracts. The queue,
source receipt, stage floor and native signing remain unchanged.
Two synthetic prefixes and their ordered transition/save/expiry/remaining-effect/ACK
cases plus complete-clear next-day reset cases are in `test_stage_caps.cjs`,
WRITTEN ONLY / NOT RUN. Native save order, same-second last dates, other partial repeat effects and
playable MuMu recovery remain unverified or unavailable.

## Archived battle-drop catalog and native rate scale — source only, untested

Pristine ARM64 `DropItem::executeLottery` at `0x1e981e4:0x1e984f0` asserts
that its three-slot rate sum is at most 10,000. Its selection helper
`0x1e997bc:0x1e998b8` draws in `1..10000`, walks ordered 12-byte
`(item, amount, rate)` entries, and can leave the default no-drop pair.
The original `dropItem` table contains 29,017 rows; its largest sum is
10,000. Row `285024070` contains an authored `-630` first rate followed by
`9700` and `930`, so the export preserves signed, ordered rates rather than
normalizing them or pretending each slot is an independent percentage.
Row `285011033` also has two empty item keys with nonzero amount/rate fields;
these are retained as zero-item slots, not silently discarded.

The decoder now exports `battleDropPools`, `battleEnemyParties`, and
`battleEncounters` into the lightweight master, retaining duplicate drop IDs
and encounter rows. The archive has 35,762 enemy-party rows and 36,760
encounters; 29 encounters reference party keys absent from the final
enemy-party table and remain unresolved. A Bell 1-1 encounter resolves to
party `331100100`, enemy rows `331100101`/`331100102`, and duplicated drop
references `285001001`/`285001004`. Deferred original-source assertions are
written in `test_master_data.cjs` but have not run.

This recovers the rate denominator and source joins, **not** the number of
trials per encounter or mapping from individual battle drops to the
`adventureGainedItems` packet. Bounded original disassembly shows
`executeLottery` calls the master-row lookup `0x1e98688`, converts its three
item keys through `DomainItemRepository::get` in `0x1e986fc`, and selects
through `0x1e997bc`. The neighboring `setFromUserDropItem` function
`0x1e97f74` is a separate setter, not a direct call in that lottery path;
the earlier overlapping decompile falsely joined them. This does not prove
that other battle paths never use `UserDropItem`. In fact, the separate
`0x1e97e3c:0x1e97f74` constructor takes a saved drop object when present and
calls that setter; it rolls the master row only when no saved object exists.
Battle paths at `0x2177274` and `0x2479180` also call the master lottery
directly. The stage request builder `0x1cf9b90` serializes each item/amount
entry supplied by its result vector; it does not include the source drop ID.
Its caller `0x1cfa3fc:0x1cfb4a0` obtains candidate battle objects through
`0x23b40a4`, filters them through `0x23c60b4`, and visits two virtual slots on
each accepted object. This is the **friendship-state**, not the loot-vector,
path: `0x1cfb4a0` reads the known native friendship getter `0x23e5a2c` and
coalesces character references; `0x22e6260` updates character-side points.
The separate item/amount vector reaches the request builder through
`0x18d9d68` from the caller's other aggregate. Exact `0x2478d68:0x2479180`
iterates its caller-supplied run count, invokes `0x2479180:0x2479c40` per run,
and sums item quantities by key; the latter calls the original
`DropItem::executeLottery` at `0x1e981e4` for its selected drop references.
The only direct branch into that aggregator is from `0x1cfa3fc:0x1cfb4a0`.
Its two direct callers, `0x194740c:0x1947684` and
`0x1d01570:0x1d017d0`, both pass the 32-bit value at their callback's
`param_2` pointer through `0x1cfa3fc` unchanged as the aggregate's run count.
Their relocated function type names identify the callbacks as
`ArgoHomeQuestPartyConfirmUIState::openUseSkipTicketModal` and
`ArgoAdventureResultUIState::openUseSkipTicketModal`. Thus this aggregate is
the **skip-ticket modal** result path, not evidence for the ordinary live-battle
trial count. Neither callback reads a master drop trial count at this call
site. The ordinary battle-to-packet linkage and saved-drop provenance remain
unrecovered.
Ghidra's displayed helper addresses were offset by `0x100000`; interpreting
them as raw addresses initially misidentified the friendship path. The
ordinary-battle packet vector and saved-drop producers still need tracing;
this does not establish every encounter's trial count or a publisher-side
loot rule.
Thus a master-only server lottery or exclusive item whitelist would reject a
valid saved-drop path or double-award a native result. Keep the submitted
client result subject to existing item identity, quantity, save and ACK guards
until the ordinary-battle and saved-drop paths are recovered.
The stage handler grants the client's positive result under its existing
inventory/save guards; it does not use the new drop catalog to reroll or
authorize that result. Do not count this as a completed stage packet or
as test/emulator acceptance.

Read-only pristine ARM64 tracing now finds a distinct live-battle path:
`0x21eb86c` state 4 calls `0x21eac34`, which calls `0x2176bc0` to prepare the
battle entities and `0x2177274` to visit their selected drop references.
The latter calls the same `0x1e981e4` lottery once per visited reference and
stores result objects in battle state. This is not the skip-modal loop at
`0x2478d68`. It does not yet prove how every battle result object reaches the
later item/amount packet vector, nor the saved `UserDropItem` branch or exact
trial count for every encounter. The server continues accepting the original
client result under existing identity, amount, inventory and ACK guards; it
does not independently reroll or stage-whitelist the drop.

## Skip-ticket completion debit — isolated source-only branch, untested

The two skip-modal callers above pass their selected count to
`0x246c510:0x246c564` before issuing the result. That function compares
original stage slot-6 stamina cost times the count with current normal SP,
then uses `0x234ae34:0x234afc8` to require enough combined ordinary and
assist skip tickets. The latter reads the two ticket stocks and uses ordinary
tickets first. On the common completion callback, `0x246c564:0x246db5c`
calls `0x246c4a0:0x246c510`, which passes the count and operation signature
to `0x234afc8:0x234b16c`; it writes both resulting ticket stocks through
their item setter and debits the stage cost times count from normal SP through
`0x2541098`. A zero-cost stage skips only the SP debit.

The stage issuer now records a `stage_skip_claim` alongside its queued result
when an already cleared stage has unreserved owned ticket rows where present,
enough **saved** tickets and normal SP, no pending operation, and only the
source-bounded level-up SP case below. It captures the original ordinary-first split and stage-cost charge;
the operation signature differs from any owned ticket baseline. Pending save
validation accepts only each exact absent/owned-before/spent ticket state and
before/charged SP balance. Both ticket rows must carry the operation signature
even when the assist balance does not decrease. The original item setter
`0x24d8844` promotes an **owned** book-entry state 1 to 3 before writing either
row, including the zero-delta assist row; negative spends do not add cumulative
acquisition.
Their observations persist independently,
and ACK requires both spent rows plus any nonzero SP debit before closing the result.
An untouched callback can replay; a partially saved one is retained for ACK,
not replayed as another spend. The new synthetic split-save case in
`tools/test_stage_skip.cjs` is **WRITTEN ONLY / NOT RUN**.

On the same real ACK transaction, both exact spent rows now establish indexed
`stage_skip_stock_floor` checkpoints. A later save, native row read or skip issue must retain
each row and its nondecreasing lifetime acquisition; stock cannot exceed the
last ACKed amount plus the subsequently observed acquisition difference. This
allows ordinary new gains and native daily refill (which adds a positive delta
to lifetime acquisition) without restoring an old spend. A missing completed
operation or skip receipt makes its floor unavailable, not silently waived.
The two settled floors must also point to the same completed stage delivery and
its captured skip count. Their exact ordinary/assist amounts and lifetime
acquisitions must reconstruct one original ordinary-first debit, with the
optional native daily-reset and no-reset outcomes kept as distinct whole-row
branches by the retained saved-effect observation. A forged or mismatched
saved floor is unavailable on ticket reads and saves. The new source/floor
corruption cases are **WRITTEN ONLY / NOT RUN**.
The deferred case attempts a post-ACK restoration with unchanged lifetime,
then corrupts only its disposable profile to require recoverable refusal on
fresh login/confirm/pull and a cached pull. This is a quantity replay guard, **not** proof
that an unclaimed increase in lifetime acquisition came from a valid producer;
the latter still needs its own packet/save receipt.

The direct skip lookup `0x234a6c0`/`0x234aa10` contains no same-day check:
`0x234a760` searches the master-backed domain wrappers and asserts on a missing
**master key**, not a missing saved ticket row. Original stock getter
`0x234c128` returns zero when its saved row is absent. The common setter
`0x24d8844` still calls `0x234c140`, which lazily constructs that missing row
through `0x234bb60`/`0x234c8a8`/`0x2647138`: zero stock, lifetime acquisition,
reservation and reset time, book-entry state 1, then the operation signature.
Its initial absent book getter returns zero, so unlike an already-owned
book-state-1 row this new row does **not** promote to 3 on that same write.
The source-only receipt now permits only that exact zero-stock construction
for a missing row while still requiring the other saved row to fund the skip.
The original JSON reader passes `signature` through the unsigned-int32 parser
`0x206b578` and setter `0x26476f8`; imported saved signatures in
`0x80000000..0xffffffff` are valid baselines. The isolated skip receipt and
shared assist-ticket inventory check now retain that range; server-issued
operation signatures still use their existing narrower range. The deferred
skip case includes both high-bit baselines and has not run.
The separate `0x234b188` -> `0x234c320`/`0x234c520` path compares the saved
reset date with the current client date, then applies a signed `5-current`
delta through the same setter and updates the reset timestamp. Therefore the
issuer no longer rejects a ticket solely because `lastResetAt` is older.
Its source-only deferred case uses such a retained row; this is not evidence
that a normal login would leave a stale daily row available.

The independent ordinary-ticket reset save now has a source-only receipt.
`0x234b188` is reached during startup and `0x180ef20` sends the resulting
`user_data/push`. `0x234c320` checks the current client day against the saved
reset date; `0x234c520` applies `5-current` through its virtual setter slot
`0x50` (the skip wrapper vtable at `0x42ac9d0` resolves it to `0x24d8844`),
then writes the current timestamp even when the delta is zero. A positive
delta increases lifetime acquisition; a negative delta does not. An owned
book state 1 promotes to 3 when the setter runs, while zero delta leaves
book state and signature unchanged. The server checks that exact independently
saved row transition and atomically records a single indexed
`stage_skip_daily_reset` checkpoint with the profile. Later saves and reads
cannot rewind its timestamp or stock without a later acquisition. It does not
mint five tickets server-side or infer an unpublished reset signature.
`test_stage_skip.cjs` contains a disposable-profile reset/replay/corrupt-read
case, WRITTEN ONLY / NOT RUN. Combined reset plus pending skip, reset plus
other item grants, native client clock mismatch and the complete login/save
sequence remain unfinished; no emulator acceptance is claimed.

An additional source-only **reset-then-skip** branch now covers the case where
the saved ordinary/assist stock cannot fund the submitted skip count, but the
original current-day five-ticket reset can. The server queues the stage
result without granting tickets or rewriting `UserSkipTicket`. Its capture
retains the old row and original issue day. The save must contain the exact
five-stock reset row or its ordinary-first, operation-signed spent successor,
with the original positive lifetime delta and book state; the first actual
reset timestamp is pinned. A split reset save blocks callback redelivery.
The full stage ACK still requires both signed ticket rows, any normal-SP
debit and the other stage effects. Only that ACK commits the daily-reset
checkpoint and spent-stock floors with the profile. A disposable deferred
case covers a reset and spend coalesced in one ticket save, then full ACK;
it is WRITTEN ONLY / NOT RUN. This supersedes only the prior blanket combined
reset+skip refusal. A saved-sufficient claim also captures an optional reset
when one is due: the native no-reset spend and reset-first spend are both
admissible, but the first saved ordinary-ticket row selects and pins one path.
Its signed assist spend must match that path. Only an actually saved reset
receives the daily checkpoint at full ACK, and the spent-stock floor uses the
actual saved rows. The separate deferred case covers this reset-first path
through full ACK; it is WRITTEN ONLY / NOT RUN. Reset+other gains, long delays
and native clock/save/UI behavior remain unsupported or unverified.

This is still **partial**, not a claim that skip clears are playable. Original
`0x25482b4` constructs the normal-SP timer with period 180 seconds;
`0x25486f0` clamps negative elapsed time to zero, and `0x254859c` adds whole
ticks to the level cap and advances `baseSPUpdatedAt` by those whole ticks.
`0x2548520` runs this getter before the skip preflight. `0x2548adc` sets the
current timestamp before a full-to-spent debit. Original callback
`0x246c4a0` tail-calls `0x2541098` for a positive stage charge;
`0x2548adc` first checks full stock through `0x25487e4`, then calls
`0x25488e0`, which reads `0x2548520` afresh before applying that charge.
The receipt captures the
owned saved balance/timestamp, exact regenerated balance/timestamp, original
level cap and issue time. A skip can now be issued when those earned ticks
fund its SP cost, with no server precredit. Its save path accepts only the
original before, regenerated, timestamp-before-debit and charged states;
the first observed full-bar timestamp is pinned across split saves and a
partial save blocks callback redelivery. A non-full delayed callback can now
save additional whole 180-second ticks after issuance when its exact tick
timestamp is no later than the current clock and the resulting balance stays
below the authored SP cap. Each saved extra-tick timestamp is pinned in order;
the signed debit must spend from the latest regenerated balance. A callback that
reaches the cap after issuance can first save the full balance at its exact
whole-tick regeneration timestamp. Its subsequent full-bar stamp uses the
callback time; the debit must retain that same stamped time. The observed
cap and first stamp cannot be rewound. A server clock reaching the cap time
does not by itself prove that the callback saved a cap phase: its saved SP
timestamp must also reach that phase. ACK still requires the actual debit.
The deferred normal, delayed, and cap-reaching cases are WRITTEN ONLY
/ NOT RUN. A native clock differing from the selected event clock, other SP
producers, and legacy receipts without this clock capture remain outside this
proof.

The shared pending-stage receipt now derives its permitted skip observations
from the same saved-phase validator used by `user_data/push`. This includes
the reset-first/no-reset choice, exact reset/SP stamps, cap phase and a
previous sub-cap tick retained after legitimate cap progression. Earlier
hard-coded keys omitted these phases, so a valid partial save could make the
next receipt read fail. A malformed or contradictory retained tick still
fails; no queued operation or player profile is rewritten by this change.
The written split-save/reset/ACK cases cover the next receipt read, plus a
forged old-tick refusal. None has been run.

An enabled stage with authored SP cost zero still spends skip tickets but
does not call the normal-SP debit: raw `0x246c4dc:0x246c50c` branches over
`0x2541098` when cost times count is below one. The enclosing callback calls
`0x246c4a0` for tickets/optional SP debit **before** `0x246c428` for stage XP;
the zero-cost branch has no SP debit to collide with its later level-up award.
The issuer and receipt therefore permit a level-up SP
award on a zero-cost skip, using the existing stage-XP acquisition/save/ACK
proof while the skip receipt requires only its signed tickets. The archived
master contains enabled zero-cost stages with positive XP; the deferred
combined-ACK case uses a clearly synthetic zero-cost override of Bell 1-1
to isolate the branch and is WRITTEN ONLY / NOT RUN. If that XP/SP save lands
first while both ticket rows remain untouched, cold confirm may replay only
the remaining original callback with `offlineStageXpApplied:1`; the existing
paired ARM64 adapter suppresses its already-saved XP/SP helper. The deferred
XP-first cold/ACK case is also WRITTEN ONLY / NOT RUN. Positive-cost skips
have only the bounded paid paths below. If both signed zero-cost ticket rows
save first, the guarded cold callback instead derives
`offlineStageSkipApplied:1` and skips only that already-saved ticket call;
the original XP/clear path and real ACK remain. The deferred ticket-first
cold/ACK case is WRITTEN ONLY / NOT RUN. A half-saved ticket pair or other
partial skip effect remains unavailable rather than redelivering it.

Paid skip plus level-up SP has bounded source-only full-bar and sub-cap
paths, including whole normal-SP ticks already due at issuance. The enclosing
callback's raw BL sites `0x246c6bc` (skip debit) and `0x246c6d0` (XP) establish
the debit-before-award order; `0x25488e0` reads current normal SP then adds
the crossed-level amount through the original setter. `0x25487e4` defines
full stamina as current SP **at or above** the authored level cap, so an
already-over-cap balance follows the full-bar timestamp path too. A fresh
claim is admitted only when the exact preflight SP funds the charge and the
level-up SP quantity exceeds the charge without int32 overflow. A full-bar
debit stamps its callback time; a sub-cap debit retains its whole-tick
regeneration timestamp. The XP
receipt then captures `preflight SP - charge` as the award's actual before
balance and that plus the original crossed-level SP as its final target. The
skip receipt accepts the original before/stamp/debit states and the exact later
XP/level/SP final state; a split debit save cannot be mistaken for an unsaved
grant. Both signed ticket rows, stage effects and the original full ACK remain
required. The synthetic debit-first split-save/ACK and wrong pre-debit SP
target rejection cases, a no-tick sub-cap atomic ACK after a later server
cap time, a due-tick regeneration/debit/award split save and an already-due
cap-reaching atomic ACK and an over-cap atomic ACK are WRITTEN ONLY / NOT RUN.
Each later saved below-cap whole-tick phase advances the pending XP/SP
baseline only after its exact regeneration timestamp and balance save; that
observation and the adjusted claim commit with the profile in one SQLite
transaction. A later tick reaching cap pins the original cap state, either
directly or after saved below-cap ticks, provided the SP debit has not
already been observed. That cap save advances the same receipt to the exact
full-bar debit-before-award balance. The callback timestamp, signed debit and
level-up award then require that saved cap observation. A single atomic save
may instead carry the exact later tick or cap, signed ticket spend, player XP,
and debit-then-award SP together; its newly observed phase and adjusted claim
commit with the same profile/ACK transaction. A final award without signed
tickets or with a different SP amount is refused. The deferred below-cap
rejection/tick/debit/ACK, cap-reaching rejection/cap/stamp/debit/ACK,
below-cap-tick-then-cap, repeated-below-cap-tick and atomic tick/cap
save/ACK cases are WRITTEN ONLY / NOT RUN.
For an interrupted skip after its full signed tickets and, when positive-cost,
SP debit save, cold delivery derives `offlineStageSkipApplied:1` only from retained
original observations and the still-exact saved rows. Positive-cost ticket-side-only
and SP-side-only checkpoints derive `offlineStageSkipTicketsApplied:1` and
`offlineStageSkipSpApplied:1`; a saved SP side may also carry the existing
`offlineStageXpApplied:1`. The ARM64 wrapper at the original outer skip call
retains two private guard bits while entering the unchanged helper. One guard
replaces only the helper's combined ordinary/assist ticket call, and the other
replaces only its final normal-SP tail call. Full recovery skips the helper;
ticket-only recovery skips tickets but executes SP, and SP-only recovery executes
tickets but skips SP. XP, clear, rewards and ACK remain on their original path.
Because both tickets share one original call, one saved ticket row, a mixed reset
branch, unexplained clock/stock changes and other partial effects still refuse.
Marker transitions may advance only from none to one side, or one side to full,
after the newly saved side is checkpointed; they cannot regress or switch sides.
Deferred full, one-ticket refusal, ticket-only, SP+XP-only and real-ACK cases plus
native pristine-cave/exact-int1/branch/untouched-range assertions are WRITTEN ONLY /
NOT RUN. The native hook is NOT BUILT/INSTALLED; other ABIs remain unavailable.
An independently issued later normal-SP producer may now share the save only
when its durable receipt starts at the exact signed skip-debit target and every
later producer forms one contiguous operation-ID-ordered before/minimum chain.
The final saved baseSP must equal the end of that chain; later stage/dispatch
level-up stamina also requires its captured EXP floor. This supports the
source-proven normal refill/reward families without treating an arbitrary high
SP balance as proof of the skip. The pending skip debit is also projected into
later reward/refill allocation, so a no-level-up paid skip no longer lets a
following refill reserve from the pre-debit stock. If an exact later whole tick
or cap phase is saved after that producer was captured, every still-unsaved
receipt in the suffix is shifted from its old before/minimum pair to the new
debit baseline in the same SQLite transaction as the skip observation. Both a
tick-only checkpoint followed by the real combined ACK and one atomic final
save are represented by WRITTEN ONLY / NOT RUN fixtures. A saved suffix, a
legacy saturated 10200 receipt with no captured original capacity,
unreceipted consumers and non-normal-SP mutations remain guarded. Other packet
branches plus native UI/save order and stability remain unverified.
Read-only original assembly/decompiler extraction is
retained at `.work/paid-skip-functions-20261011.txt`; its Ghidra image addresses
are the ELF addresses plus `0x100000`. The source patch changed, but no APK was
built or installed and no live save was changed.
Coalesced reset/other-effect saves, imported historical balances,
remaining level-up SP timing, overlapping producers and near-saturated lifetime
reset/other producer attribution remain unresolved. Existing pending skip
operations without this receipt stay retained, not silently backfilled.
Neither the new DDL nor the handler has been exercised against a server,
client save or emulator. Do not infer a fixed ticket trial count for ordinary
live combat from this skip-only source.

The original zero-quantity wire variants are now handled **in source only,
untested**. Nine archived drop rows have positive item keys and draw rates but
zero quantity: eight equipment-material `289990102` rows (for example pool
`285013720` at rate 9,600) and one event-item `290000479` row (pool
`285024776`). Native `0x2479180` aggregates zero, `0x18d9d68` retains the
pair and `0x1cf9b90` serializes it. The common callback calls gain(0), which
still runs its stock/signature setter and skips the positive-only lifetime
increment. The equipment material promotes book state 1 to 3; the event
item's slot `+0x30` returns 1 and its slot `+0x38` is a no-op, so its book
state is unchanged.

The final ARM64 `DomainEventItem` RTTI name relocation at `0x42c3368` binds
its typeinfo to the vtable at `0x42c3268`; slot `+0x50` at `0x42c32c0` points
to the same gain `0x24d8844`, slot `+0x48` points to event-item setter
`0x25ab4f8`, and slot `+0xb0` points to lifetime adder `0x24d8d94`.
The retained `0x25ab4f8` decompilation writes amount and applies a nonzero
signature. This is source evidence for the event-item zero setter, not a
native execution or final-save observation.

When the event-item row is absent, that setter calls lazy accessor
`0x25ab168`: `0x25ab8ec`/`0x25ab934` construct the user item,
`0x2641e74` initializes zero fields and book state 1, and the accessor
sets owner/ID/amount 0 before `0x26bc380` inserts it. Thus an absent
`290000479` row has an exact zero-stock, zero-lifetime, book-1 baseline;
the setter then signs it. These are ELF addresses; Ghidra's imported image
adds `0x100000` to its displayed addresses.

The equipment-material vtable at `0x42bd360` calls the same gain at
slot `+0x50`, book getter `0x2516e40`, book setter `0x2516e58` and stock
setter `0x2516a14`. Both setters call lazy accessor `0x2516790` for a
missing row. It calls `0x2517218`/`0x2517260` to construct the user item;
`0x283cfa4` initializes its zero fields and book state 1. The accessor sets
owner/ID, amount 0, reserved 0 and book 1, then inserts via `0x26d91f4`.
The common gain changes the new material book to 3 before signing stock 0.

For either exact original ID with one existing owned seven-field row or its
proved absent-row constructor, stage issuance retains `{itemId,amount:0}` in operation
5000/16000/25000 and atomically captures the old row or explicit absence in
`stage_zero_item_claim`. The operation signature differs from an old row's.
Save validation admits only the exact old row or the native signed row,
including the event item's unchanged book state or each exact new-row default;
ACK requires the signed row. Cold delivery omits a saved zero setter while
retaining other unfinished stage effects. It neither mints stock nor inserts
an ordinary positive-acquisition receipt. An indexed pending source holds
later acquisitions of that ID until stage ACK; the new DDL is **unapplied**.
Unknown/special zero IDs still refuse. Positive rewards keep their original
caps and reservations.

None of the nine zero drop pools joins a final `battleEnemyParties`/
`battleEncounters` path, so natural reachability in this final build is **not
proved**; a saved-drop path may differ. Deferred existing/new material and
event-item signed saves, early ACK, cold replay, source corruption and rollback
cases are written, not run.

One narrow stage-packet boundary is now enforced: both `adventureGainedItems`
fields are signed 32-bit values in the original request builders
(`0x1cf9da8`/`0x1cf9dd8` and `0x217c270`/`0x217c2b0`). The shared stage
completion route refuses values above `0x7fffffff` before issuing an
operation, leaving its queue and save untouched. The deferred ordinary-stage
cases cover both fields; no check has run. This is a wire-shape guard, **not**
drop-rate or stage-loot authorization.

The common stage handler now also bounds every supplied `adventureRecord`
counter to nonnegative signed int32. The original PVE request builder
`0x217c338:0x217c53c` sign-extends the seven battle-record fields before
serializing them. The shared server boundary applies that native width to
whichever record counters each stage mode submits. The deferred ordinary-stage
rollback case has not run.

## Original battle-drop linkage — read-only source discovery, not implemented

The final archive has 29,017 `dropItem` rows. Each row has an int32 ID and
three item-key / quantity / numeric slots (2–4, 5–7, 8–10). `enemyParty`
slot 1 groups enemy rows by party key and slots 32–36 reference `dropItem`
IDs; `adventureEncounter` slot 1 names the original stage and slot 5 names
that party key. For Bell 1-1, the encounter's party key `331100100` resolves
to enemy-party rows `331100101` and `331100102`, whose drop IDs `285001001`
and `285001004` are present in the archived drop table. The latter rows name
original Falna items. This is a real stage-to-drop source path, not yet a
server-side drop calculation or a quantity validator.

At that earlier discovery point, the numeric drop slots' scale and whether
each enemy-party slot represents separate trials, difficulty, or another
native condition were unproven. The newer section above resolves the
10,000-point rate scale and native per-run aggregation, not the enemy-party
slot semantics or selection of the caller's run count. Those must be
reconciled before authorizing loot from these rows. At this earlier
discovery point, there was no master regeneration, handler change, test,
build, listener restart, or emulator check; current stage packets remain
partial.

The old overlapping Ghidra output at raw `0x1e97f74:0x1e98468`
(`.work/drop-execute-bounded-20261011.txt`) was not a reliable function
boundary. Exact unwind ranges and raw disassembly separate the
`0x1e97f74:0x1e981e4` `UserDropItem` setter from
`0x1e981e4:0x1e984f0` `executeLottery`. The latter's 10,000-point
selection is established above; the stage-result packer at
`0x1cf9b90:0x1cfa3fc` serializes an aggregate `(itemId, amount)` vector
without per-drop IDs. Its caller at `0x1cfa3fc:0x1cfb4a0` assembles that
vector before the packet. The next implementation step is to recover its
trial count and all aggregate sources, not to add an independent server
lottery that could double-award loot.

Newer [same-level CP recovery](stage-cp-recovery-contract.md) retains every
original absolute CP target and duplicate when an existing saved character
has the exact target points without authored level growth. Unsaved targets
must retain their original before points.60 new cases/six extensions are
written only; CP level growth/initializers and clear replay remain unfinished.
No new schema/native adapter or runtime changes.

Newer [closed player-XP recovery](stage-xp-recovery-contract.md) uses an exact
saved non-skip EXP/level-up-SP capture and a narrow ARM64 zero-XP-count adapter,
keeping cache initialization and every other common effect. Ordered normal
refills retain current spent SP.30 new cases/seven extensions and adapter checks
are written only; client/server pairing is required and NOT BUILT/DEPLOYED.
Clear and other additive/coalesced replay remain unfinished.

Newer [objective recovery](stage-objective-recovery-contract.md) preserves live
complete1/received2 flags and all original objective IDs for5000/16000/25000,
alone or with complete captured items/PvE scores. Exact before/task identity
and unchanged additive stage fields remain mandatory.102 additional cases are
written only/UNTESTED; missing constructors and additive replay remain unfinished.

Newer [PvE score recovery](pve-score-recovery-contract.md) permits the exact
idempotent score assignment alone or with complete captured item grants while
all other captured stage fields remain unchanged. Clear/XP and other additive
progression remain unfinished; original source/queue/full ACK remain. No new
schema/native patch; all cases are written only/UNTESTED.

Newer [PvE rank-item recovery](pve-rank-item-recovery-contract.md) handles
fully observed captured numeric rank-only/shared rank-plus-loot grants without
duplicating either provider. Early shared capped signatures keep remaining
stock allowances open; exact full-counter spent-first proof remains valid.
352 original-catalog contexts are written only;
saved/coalesced progression, duplicate-PC and repeated dated replay remain
unfinished. No new DDL or native acceptance is claimed.

Newer [item-only cold recovery](stage-item-recovery-contract.md) permits original
5000/16000/25000 continuation only when captured wire items are fully observed
and all non-item effects remain untouched. Shared clock/hero/XP/SP/guest guards,
immutable original queue and full real ACK remain.16 new mixed contexts and
extensions to existing dated/PvE/Element cases are deferred; saved/coalesced
progression and duplicate-PC provider recovery remain unfinished. The newer
rank-item milestone above supersedes the earlier captured numeric rank refusal.

## Newer first/owned ordinary stage-ticket acquisition

SOURCE ONLY / PARTIAL / UNTESTED: [stage ticket rewards](stage-ticket-reward-contract.md)
adds original first/owned dated captures to5000/16000/25000, with real mixed
save/ACK proof, same-item interlocks and indexed completed checkpoint reads.
No native profile precredit, new DDL or partial/coalesced stage cold replay;
488 new deferred contexts are written only. Existing chapter, XP/SP, numeric,
unit and progression contracts remain. Actual saves/listener/APK/emulator
untouched; no feature-complete claim, co-op last.

## Current: coalesced stage-earned chapter enabling and consumption (2026-10-09)

SOURCE ONLY / PARTIAL / UNTESTED. All test execution, syntax/static acceptance,
builds, APK work, listener restarts and emulator/ADB checks remain deferred
until every packet and unfinished branch is implemented. No workers or GitHub
Actions; existing player saves, original master/archive and runtime untouched.

Cached original `2451924 ->23b10a8` clears a stage and sets matching zero flags
to1 before its `FeatureUnlock` save. Cached `1a5893c:1a58bf0` then reads ready1,
opens the selected chapter's first normal node, sets2 and saves. A saved
intermediate1 is not required when the client's saves coalesce. The original
four chapter mappings and22 featureLock rules are reused, not invented unlocks
or new packet fields. Original source artifacts remain the ones cited below;
no new extraction or acceptance check was run.

Fresh explicit zero/absent-to2 chapter saves can now bind to the **unique exact
pending5000 feature producer**. The existing private
`stage_main_entry.enabling_json` records the original prerequisite/catalog,
actual captured prerequisite `beforeState`, operation ID and immutable original
operation JSON hash. `before_json` retains the actual flag0/absence. The
three-field already-saved lazy enabling capture and SQL NULL real-saved1 path
remain valid without migration or backfill. A missing, conflicting or malformed
original source remains unavailable, never inferred from current consumed2.

The shared feature save predicate accepts2 without an earlier saved1 only when
that actual push also has the exact operation-linked chapter-consumption plan.
Owner/date, original flag baseline and first-node graph guards remain. Full
mixed stage save and ACK still require actual clear, XP/SP, inventory,
objectives and other unlocks; a flag2-only save does not acknowledge or redeliver
the stage callback. Chapter flag, first-node open and stage clear can save
separately or coalesce with the real ACK. A bare stage-only open while the flag
is0 remains unattributed; later explicit2 captures that actual preowned open
without manufacturing an earlier chapter callback or open floor.

Queued sources use the existing exact pending-stage receipt validation.
Acknowledged sources retain their immutable JSON hash, original clear graph,
actual operation_done, matching feature floor and feature observation after the
queue is removed. A persisted consumed capture cannot lose its original stage
observation and silently recreate it. Source reads reuse the same recovered
feature/clear contracts as ordinary earned-feature floors, with primary-key
lookups and at most four chapter entries; no new table or lifetime scan.
Profiles/tokens, private captures, observations, open/feature/clear floors,
queue/done, sequence and exact reply remain in the existing transaction. No
native profile/flag/stage/signature precredit or extra wallet/reward grant.

`test_feature_unlocks.cjs` was extended but **NOT RUN**. New deferred synthetic
vectors cover all four mappings, actual0/absence, flag-first/open-first/combined/
clear-first/stage-ACK-before-open and all-effects-with-ACK saves, source-ID/hash/baseline/catalog
corruption, missing observations, owner/date mismatch, profile/entry/observation/
open-floor/feature-floor/done/reply rollback, exact repeat, cold reopen, stale
binary pulls, retained queues and original0-to2 capture without saved1. The
earlier saved1 branch and shared-node refusal vectors remain queued. Existing
chapter/stage/shared-reward/persistence/recovery checks are also deferred.

This supersedes the pending-result unsaved0-to1-to2 gap **only for the exact
captured feature producer and an independent first-node graph**. Shared-node
producer attribution, initial Bell/tutorial bootstrap, other flags/reset
lifecycles, legacy lost-source reconciliation, natural signatures/effect-save-
ACK ordering, usable cold/back recovery, rendering, crashes/ANRs and performance
remain incomplete or unverified. Route counts and verified-gameplay claims are
unchanged; audit metadata was edited manually, its generator was not run.

## Current: saved-ready chapter entry before an independent stage ACK (2026-10-09)

SOURCE ONLY / PARTIAL / UNTESTED. No tests, syntax/static acceptance checks,
builds, APK work, listener restarts, emulator/ADB, workers or GitHub Actions.
All earlier acceptance notes below are historical and do not verify this change.
All original packets and unfinished branches must be implemented before the
consolidated test pass; co-op remains last.

Cached original `1a5893c:1a58bf0` in
`.work/stage-coalesced-main-entry-exact-20261006.txt` reads the actual ready1,
opens the selected part's first normal stage through `246b35c`, sets the flag2
and saves. It does not wait for server-side stage-result acknowledgement.
The original `2451924 ->23b10a8` clear/feature producer and lazy `23af3c0`
contracts remain distinct. This is source evidence, not natural save-order or
UI acceptance.

`mainEntryPlan` no longer rejects every chapter entry merely because a covered
stage result is pending. The four existing Ais/Lefiya/Ryu/SoA mappings may
consume their **actually saved ready1** with that result still queued. A
required pending feature must already have its persisted `feature:<flagId>`
observation and matching original owner/date. Chapter entry cannot substitute
flag2 for an unobserved ready1. Its first-stage identity must be outside the
pending result's root, next-stage, story-clear/open and CP quest-unlock effects;
shared-node producers remain unavailable without new attribution.

The existing chapter capture, split flag/open observations and actual open
floor are reused. Stage clear/EXP/loot/objectives/other unlocks still require
their original saved effects and real full ACK. Completing chapter entry does
not mark the stage operation done, dequeue it, create an early feature floor,
precredit native rows or grant extra rewards. The actual later stage ACK keeps
the existing original feature baseline and operation-linked floor, even though
the observed ready1 has since become2. No schema, migration, wire, dependency,
export or live-save changes.

Extended `tools/test_feature_unlocks.cjs` is WRITTEN ONLY / NOT RUN. Deferred
synthetic cases cover all four mappings, zero versus absent flag baselines,
flag-first/clear-first stage saves, flag/open/combined chapter saves, original
owner/date and saved1 capture, retained stage queue/no fake ACK or early feature
floor, profile/checkpoint/open-floor/reply rollback, repeat puts, cold reopen,
old cached pulls, missing feature observations, stage/flag/node rewind, full
later feature-floor/done/reply ACK rollback and shared-node refusal. Existing
chapter/stage/persistence/recovery checks remain deferred too.

This supersedes only the blanket pending-result rejection for a **saved ready1
and independent entry node**. Unsaved0-to1-to2 during a pending result,
shared-node or other independent producer attribution, initial Bell/tutorial
bootstrap, other consumed/reset flag lifecycles, missing legacy checkpoints,
signatures/natural callback-save-ACK ordering, usable cold/back recovery,
rendering, crashes/ANRs and performance remain unfinished or unverified.
Route counts and gameplay acceptance claims are unchanged; audit metadata was
edited manually, not regenerated.

Partial support. On2026-10-06/07, named isolated checks and limited native stage cases passed, including the natural Bell1-4 boss clear below. All195 stage-unit fixtures now pass across filtered runs; a single-process full run still has an unresolved Windows fatal exit. Historical source-only notes are superseded only for named checks/cases, not every stage or reward. The original player database was not opened or changed; co-op remains last.

## Original S-clear Iris reward (2026-10-07)

Latest user direction: finish packet implementation before any more functional
checks or emulator gameplay testing. The live Element run was stopped through
its existing handle (terminal exit1 after950/1382 difficulties at3167 seconds),
not a full pass or an assertion failure. The unlock check had already finished
exit0 before that direction: synthetic empty objectives were replaced with
original IDs/states and indexed once, with production checks unchanged.
Bell2-5 had reached stage/complete21261 and AdventureComplete21262 ACK23;
its result/cold persistence were not inspected. The game/listener were stopped
normally; all further acceptance is deferred, co-op last.
Launcher Offline was observed. Cleanup-only Saves scrolling then lost ADB;
restoring the original next-launch selection did not complete. The last observed
selection remains Adventure16 `eb8b83ee` /2019-10-18. No further emulator action,
gameplay, restart/reset or original5 access followed this failure. Earlier
Bell2-4 restoration/cold evidence below is historical, not the latest state.

The archive's `adventureStage` slots21/22/23 contain a separate S-clear recipe,
not the first-clear recipe at18/19/20 or an objective reward. Exact pristine
ARM64 `1d16f04:1d181e8` reads the key/amount at vtable offsets0x30/0x32.
`1d192c0:1d19f90` renders this reward when completed-objective count exceeds2;
`247be70:247be98` and `247be98:247bec0` distinguish objective states1/2.
Original captions are `quest_result_rank_reward_text` (star reward) and
`quest_result_rank_complete_reward_text` (S-clear reward). The new separate
`stageSRewards` export preserves all21,524 recipes, including disabled type0
rows. All previous master fields, capture hashes and161 source hashes match
the preceding export exactly. Active recipes are type3/currency.gem, amount1
or5; no invented rates, item quantities or extra native wire fields.

Shared ordinary/PVE/Element completion now credits the original Iris bonus
when the three original objectives first become complete, including objectives
received on earlier runs. It reuses `stage_reward` with `s-stage:<stageId>`
and the existing hard-currency/operation/completion transaction. Partial stars,
zero-objective stages and disabled recipes do not earn it. Typed unique saved
objectives are required. Unknown recipe shapes fail safely. Retry/cache
eviction/restart cannot remint; failed issuance rolls back wallet, reward
receipt and queue together. Existing complete/ACK guards remain unchanged.

Once-only issuance and suppressing an imported already-three-star baseline
are explicit offline policies, not recovered publisher-server code. Historical
clears and pending old-build operations are not retroactively credited or
rewritten. This supersedes the previously missing S-recipe/issuance path only,
not all reward or combat parity. `test_stage_s_rewards.cjs` passes original
archive equality, partial-to-full accumulated objectives,1/5 Iris, legacy
suppression, three rollback boundaries, foreign objectives, requestId0 replay,
cache eviction, restart and split save/ACK. Full stage-persistence/master/PVE/
recovery/launcher checks also passed before the testing stop. The broad Element
matrix was intentionally interrupted, not a pass. These six checks and the
subsequent feature-unlock check passed on this revision before the user deferred
all testing; earlier checks below are historical unless explicitly rechecked.

### Patched native Bell2-4 S-clear

Local offline build/install produced launcher7f3333af/serverbd11b06e/
masterf6175215. Packaged/installed/runtime master and all seven modules match
source; the installed game split1c991fc2/native090b500c remain unchanged.
Protected Adventure16 `eb8b83ee`, fixed date2019-10-18, used normal Bell2-4
entry and its already-saved auto settings. Three BattleEnd saves21236..21238
preceded stage/complete21239 for original1010000102104: five turns,
seven normal attacks/five skills, no continue/death, actual annihilation,
objectives682000019/20/21,784 run Valis and DEX falna1.
Operation5000 ID22 succeeded; real AdventureComplete21240 saved effects
and acknowledged22. The rendered S-result displays star Iris3 and S-clear
Iris1; Miach CP4 Agi+3 and the original first-clear Mag.Falna(S)x2 modals
render, then usable stage selection/town show Iris6->10, rank4/SP129-of23
and Valis53372. Bell2-4 shows Clear/S and Bell2-5 NEW.

Normal launcher Stop left no game PID/listener28766. Read-only separate
`.work/s-clear-native-stopped-20261007.sqlite` verifies integrityok, queue0,
ACK22, exactly one completion and `s-stage:1010000102104` amount1,
clearCount1/three received state2 objectives/clear floor1, EXP1551/rank4/SP129,
freeIris10/paid0, Valis53372/cumulative65372 and the three indexed item claims.
A normal cold launch then retained town Iris10/Valis53372/rank4/SP129,
Bell2-4 Clear/S and Bell2-5 NEW. After a second normal Stop, separate read-only
`.work/s-clear-native-cold-stopped-20261007.sqlite` is integrityok and matches
the first copy's wallet, all stage receipts/completions/clear floors/item
claims, six CP floors35/35/25/35/125/25, queue/done, full playerStatus and
native stage/currency/falna rows. Cold confirm21243 and AreaChanged21248
succeeded; no duplicate S-reward receipt or credit.
This supersedes the missing S-bonus accounting only for this native case;
individual battle turns, other modes/stages and broad crash/ANR stability
remain unverified. No native SQL write, funding, clock/reset/flag injection,
workers or GitHub Actions; co-op remains last.

Final second normal Stop and launcher Saves scrolling restored only next-launch
metadata `d8924112` / Adventure5 /2022-08-20. Selected badge/metadata and
Home Offline/19 profiles verified, with no game PID/listener28766. The
original Adventure5 database was never opened/read/launched/changed.

Before the fix, normal Bell2-3 completed on the preceding624efcdc build:
stage/complete21223 issued5000 ID21 after three real BattleEnd saves.
Blocking21225 and AdventureComplete21227 saved/ACKed21. Rank3-to4,
maxSP22-to23 and stamina107-to130 rendered. Its result displayed star Iris3
plus S-clear1 but the stopped read-only test save retained only wallet3-to6:
EXP1201/rank4/SP130, Valis52588/cumulative64588, stage4/clearCount1/tasks1,
queue0/done21/integrityok. MuMu's Android process exited abnormally after
the result screen; targeted ADB reconnect timed out. Its normal manager Launch
recovered ADB and the save, without reset, VM-service shutdown or unrelated
kills. This recovery is not an emulator-crash root-cause fix or stability pass.

## Permanent guest EXP save checkpoint (2026-10-07)

A disposable HTTP regression reproduced a real persistence gap: after an acknowledged permanent guest saved more EXP, an old GuestEvent snapshot was still accepted with200 and rewound that progress. Shared `user_data/push` now validates against both the existing permanent checkpoint and actual retained native EXP, then advances that same indexed `gift_pc_floor` inside the profile/checkpoint/reply transaction. Initial stage ACK and later reward-floor merging likewise retain the actual saved EXP, not just the older issuance capture. Typed owner/identity/long EXP and all unit/board/character/wardrobe obligations remain required. Per-save indexes are reused; no schema, native row/signature, reward or new operation is added.

This applies **only to an already proven permanent guest checkpoint**, or its real stage ACK. Temporary guests, uncheckpointed legacy rows and unit-only legacy floors gain no guest ownership, promotion or EXP grants. An older guest checkpoint beside a newer valid native profile cannot excuse a rewind. Natural EXP earning/promotion, expiry/reset/rejoin and lost legacy checkpoint reconciliation remain incomplete.

Both original preowned permanent guests pass the red-to-green rewind regression, checkpoint/profile/reply forced rollback, restart, stale save/pull/confirm, owner/delete/corrupt-state rejection, legacy no-backfill and later Present merge checks. All54 absent-unit permanent acquisition/CP save-order fixtures pass with additional EXP in final ACK; all112 fresh/retained temporary fixtures and all29 ordinary/preowned cases also pass, totaling195 distinct fixtures across existing filename filters. This is synthetic native-shaped HTTP/SQLite proof, **not guest native gameplay acceptance**. The original unfiltered run and the second-guest-only long run terminated with Windows C0000409 at different fixtures without JS assertions; the root cause remains unresolved, and no single-process pass is claimed.

`test_gift_characters` also passes after correcting two fixture assumptions: an existing unjoined bootstrap unit is rejected, not treated as an owned/fresh unit; already satisfied native character/costume state needs no invented dirty save before ACK. Production ownership guards were not weakened. Latest ordinary board, stage-save, gacha-save, communication wardrobe and launcher checks pass; unrelated accumulated passes are prior revisions.

Local offline APK rebuild/replacement installation succeeded. Installed APK SHA256 `a3e99da8b6f937437969e5837ec5a71c2140497a2cd260d7b3d215dc8414b7fa`; packaged/installed seven runtime modules match source, server SHA256 `ac57cd9b18973242f8d8113328cefd1aea35ea667897f78074c3a55d9c0518c3`. Isolated Adventure16 `eb8b83ee`, date2019-10-18, reached town through confirm21094 and saves/pulls21095..21102, retaining rank3/SP60/Iris17/Valis30138. Quest selection and unlocked Bell Episode2 render. The profile has no GuestEvent rows, so this smoke does **not** certify native guest EXP behavior or all-game stability. No workers or GitHub Actions; co-op last.

### Native Bell Battle2-1 on this build

Normal UI selected Bell Cranel Pt.2 / BATTLE2-1, Party2 and GO. Story rendered and its original SKIP was used. Previously saved auto-battle settings were left unchanged; individual combat turns were not visually inspected. Native AdventureEnter21103 and three BattleEnd saves21105..21107 led to actual stage/complete21108 for original ID1010000102101:6 turns,11 normal attacks/four skills, no continue/death,882 run Valis and three objective IDs. Native TutorialUpdate21109 and AdventureComplete21110 saved/ACKed operation5000 ID15. S-clear, Bell/Ais CP2 Str+5 and Hestia CP2 HP+20 modals rendered, then usable stage selection returned.

After normal launcher Stop, copied **only the separate eb8b83ee DB/WAL/SHM**, opened with read-only DatabaseSync: queue0, operation15 done, integrityok, original stage state4/clearCount1/all three tasks state2, player EXP721/rank3/SP59, Valis31020/cumulative43020 and all six exact CP floors20/20/20/10/10/110. UI Iris17->20 corresponds to the three objectives; no additional grant or S-bonus accounting is inferred. Native guest rows remain empty. Temporary device-only root was used only to copy the stopped test profile and restored to shell uid2000; original Adventure5 DB was never opened.

Full Stop/relaunch then succeeded through fresh login, confirm21112, WorldInitState21113, AreaChanged21117 and TutorialUpdate21118. The legitimate Orario tutorial was closed normally; responsive town retained rank3/SP59/Iris20/Valis31020. Reopening Bell Pt.2 displayed BATTLE2-1 Clear/S and newly unlocked BATTLE2-2; the latter was not entered or played. Screenshots: `.work/mumu-guest-checkpoint-cold-final-20261007.png` and `.work/mumu-guest-checkpoint-cold-stage-20261007.png`. Android reported no ANR since boot, which is bounded session evidence, not long-session stability proof. Final normal Stop left no game PID or listener28766; only next-launch metadata was restored to Adventure5/date2022-08-20, Offline with19 profiles. Original Adventure5 was not launched or inspected.

## Natural Bell1-4 boss clear (2026-10-07)

Isolated Adventure16 `eb8b83ee`, date2019-10-18, used actual Party2:
Bell/Hestia, Ais/Eina and Liliruca/Miach. Three real BattleEnd saves preceded
stage/complete21012:13 turns,26 normal attacks/eight skills, no continue or
death, actual annihilation and all three original objectives. Operation5000
ID11 awarded1322 run Valis. Real DailyMissionComplete, CumulateMissionComplete,
TutorialUpdate, Blocking and AdventureComplete saves acknowledged11.

S-result/three tasks, CP, first-clear5 Iris and rank3/SP60-of22 rendered.
Player EXP481, Valis20138 and wallet9->17 were saved (5 first-clear plus
three objective Iris). The separate S-clear1 UI accounting remains unresolved;
no guessed extra Iris was added. Boss clearCount1/objective states2 and
Chapter2 first-stage state1 were retained; native Hard Mode unlock and
Chapter2 selection rendered, not a Chapter2 battle. Subsequent real Rookie3
claim added10000 Valis; Rookie4 granted Agi.Falna(S)x10. Cold town after the
CP recovery retained rank3/SP60/Iris17/Valis30138/Rookie4-of36.

The latest local offline APK/server hashes and bounded11000 recovery are in
`friendship-reward-contract.md`; all seven packaged modules match source.
Current stage persistence/EXP and PC stat checks pass. Full stage-unit checks
exit1 without a final success, and filtered fixture passes are not full-matrix
acceptance. Other stages/modes, rewards, natural fanout, publisher parity and
long-session no-crash/no-ANR remain unverified or incomplete.

## Native Bell1-1 and Android SQLite portability (2026-10-06)

The native ordinary completion initially returned1003 because the shared item reservation query called `json_extract`, which MuMu's Android SQLite does not provide. Both callers now reuse `underPvpMedalMinimum`: read the bounded per-season medal checkpoints and validate their existing full battle receipts in JavaScript. No lifetime battle scan, schema change, native pre-credit or relaxed acquisition/ACK guard was introduced. The launcher source check rejects SQLite JSON-extension calls in every packaged server module.

The local offline build/install succeeded; all seven packaged modules match source bytes and the installed runtime server matches SHA-256 `669d1e81b50f18c381cb638add2a7ba033283f804e832932bb7b0c085c23bd3f`. Debug APK SHA-256: `bcc62704ec52572e7463bd10989aa6301ee7ebd68057771175df2b2d5b221480`.

Isolated native profile `eb8b83ee` (Adventure16), event date2019-10-18, resumed the same interrupted stage `1010000101101` and token `1000000001-498701826` through the actual YES prompt. The resumed client submitted `annihilated:false`; no synthetic victory flag was substituted. Request20865 succeeded with operation5000 ID2; real AreaChanged, DailyMissionComplete, Blocking ACK2 and AdventureComplete saves settled it. S-clear and CP screens rendered, Bell1-2 became available, and back-to-town/cold restart worked without replaying the reward.

Read-only native SQLite inspection proved: empty operation queue; operation2 ACKed; clear/unlock/96-EXP/three CP/two falna/Valis effects observed; Bell1-1 clearCount1 and three objectives retained; Bell1-2 state1; player EXP96; Valis10408; falna294000004 and294000013 each1; Bell/Ais/Hestia friendship5 each; integrity_check `ok`. Town displayed3 Iris even though the result screen displayed a3-star reward3 and S-clear1; exact Iris display/accounting semantics remain unverified. No all-stage, drop-table, publisher-parity, natural CP level/stat/SP reward or long-session stability claim follows from this case.

Under Telskyura battle and gift HTTP/SQLite checks also passed after the shared query fix. Their synthetic native-shaped saves are not native acceptance. The corrected chronological full1382-difficulty Element check is still running and began before this source edit; it is not recorded as passed. The launcher/game were stopped and the original Adventure5/date2022-08-20 selection restored without opening that database.

## Native Bell1-2, party save and rank-up (2026-10-06)

The same isolated Adventure16 profile naturally entered Bell1-2
`1010000101102` with edited Party2 (Bell/Hestia and Ais). Real AdventureEnter,
AreaChanged and three BattleEnd saves preceded completion20929. The client
submitted `isEnemyAnnihilated:true`, six turns, all three original objectives,
408 Valis loot, one Strength Falna and three CP targets10. Operation5000 ID8
applied through actual CumulateMissionComplete, Blocking ACK8,
AdventureComplete and AreaChanged saves; no battle outcome or native row was
injected.

The native S-result, rank1-to2 popup, CP screen and original first-clear
Skill Falna(S)x2 popup rendered. Read-only saved proof: Bell1-2 state4,
clearCount1, preserved first date1571407074, all three objectives eventually
state2, Bell1-3 state1, player EXP192/rank2/baseSP41, Valis29816/cumulative30816,
Strength Falna294000001 amount/cumulative11, Skill Falna294000016
amount/cumulative2, Bell/Ais/Hestia CP10 each, queue empty and done IDs1..8.
The old Skill item294000013 remained1; it is not the Bell1-2 reward ID.

An actual launcher Stop followed by relaunch produced fresh confirmation20935
and native AreaChanged20940, reopened town at rank2/stamina41-of21/Iris4/Valis29816
and retained the stage, rewards, two Rookie claimed flags and edited Party2.
`PRAGMA integrity_check` returned `ok`. Screenshots:
`.work/native-bell12-clear-20261006.png`,
`.work/native-bell12-unlock-20261006.png`,
`.work/native-bell12-cold-20261006.png`.

This uses the hot6000 build/hash recorded in `achievement-reward-contract.md`,
not a new APK build. The result again showed three-star Iris3 plus S-clear1,
while the wallet rose1-to4 from the three recorded objective awards. Exact
display/accounting semantics remain unresolved; no guessed fourth credit was
added. Other story/chapter completion, battles/rewards/unlocks,
other defeat/retire paths and game-wide stability remain partial or unverified.
The original player database was not opened or changed.

## Native Bell1-3 story and Bell1-4 defeat/retreat (2026-10-06)

The original Bell1-3 `1010000101103` novel rendered and its native Skip
completed through stage/complete20941. Actual story-shaped request fields were
only adventureStageId/token/adventureRecord; no synthetic loot, objectives,
CP or victory flag was added. Operation5000 ID9 granted the original five
Iris once, native AdventureComplete20942 saved UserAdventureLevelInfo/
UserAdventureStage/UserInfo and ACK9, and the first-clear popup rendered.
Bell1-3 state4/clearCount1/first date1571407497 and Bell1-4 availability were
observed; wallet4-to9, no EXP/SP reward was invented for the story.

Native Boss1-4 was then entered normally. Auto Battle won its first two
waves, but the original third-wave wolves defeated both current members at
turn7. The genuine continue prompt showed insufficient Iris9 for cost10.
Choosing NO then QUIT produced AdventureRetire20947 and AreaChanged20948,
returned to the usable stage selector and discarded the run's272 Valis.
Wallet stayed9, Valis remained29816/cumulative30816, and Boss1-4 stayed
state2/clearCount0/objectives0; no completion operation or fake win was issued.
This is a defeated-retreat case, not a successful boss/chapter clear or proof
of every continue/retire branch.

Another actual Stop/relaunch produced cold confirmation20949 and native town
save20954. Town retained rank2/stamina40-of21/Iris9/Valis29816/Rookie2-of36,
UserAdventureState.stageId0 and empty loot/events, queue empty and
integrity_check `ok`. Screenshots: `.work/native-bell13-clear-20261006.png`,
`.work/native-bell14-retreat-20261006.png`,
`.work/native-bell13-retreat-cold-20261006.png`.

`test_stage_unlocks.cjs` passed synthetic main/event/special progression,
exact prerequisites, split native-shaped saves/ACKs, restart, stale reads and
rollback. A duplicate Very Hard fixture row was removed before issuance;
the real unique-stage guard still rejects duplicates. Bodyless confirmation
and raw injected SQL503 probes were corrected without relaxing production
save/receipt/ACK requirements. Natural whole-episode/difficulty/feature
fanout and other progression/rewards remain unverified.
The launcher/game were then stopped and original Adventure5/date2022-08-20
selection restored in the launcher, without launching or reading its database.

## Original client evidence

Frozen EU 15.1.0 ARM64 SHA-256: `e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.

- Ordinary operation5000 at raw `0x246e0dc:0x246e204` delegates to `0x246c564:0x246db5c`.
- That common handler resolves each `gainedItems[{itemId,amount}]` through `DomainItemRepository::get` at `0x24e3a5c` and calls item vtable slot `0x50`. It applies loot, PC/costume/friendship/objective effects before its final stage-clear call at `0x2451924`. A clear flag alone therefore cannot prove that every reward reached the save.
- The existing client-derived inventory mappings and acquisition receipts are reused. The archived first stage `1010000101101` awards **10,000 Valis**; its two requested objectives award **2 Iris** in total. Battle-loot telemetry is not a recovered drop table or quantity validator.
- Exact read-only extraction artifacts: `.work/ordinary-stage-handler-exact-20261006.txt` and `.work/ordinary-stage-common-exact-20261006.txt`. The address metadata identifies the original item-repository lookup, not a guessed server route.

## Source behavior

Ordinary5000 now uses the same permanent `pve_item_claim` acquisition targets as PVE16000 and Element25000. Original first-clear items and aggregated client loot reserve distinct cumulative targets across the existing item producers. There is no native inventory, character, clear-flag or signature pre-credit. Original first-clear/objective Iris remains the once-only server-wallet path, not an invented ordinary item row.

An ACK requires the owned clear, its increased lifetime count and preserved first-clear date, requested objective flags, each recorded item acquisition, each captured initialized-PC and owned ability-board proof, and each captured hero-track friendship target. Mode-specific PVE ranks/scores, Element difficulty scores and PvB event records retain their separate proofs. Amount spending and emptied gacha-ticket date lists remain valid when cumulative acquisition survives.

Additive private tables support the common5000/16000/19000/25000 flow:

- `stage_delivery`: exact queued operation including token/signature/parameters, already-owned PC IDs, captured per-PC progress and board targets, actual prior score-record presence, captured friendship baselines/targets/hero/original-level hash, and observed effect keys. The friendship and PC-target columns are nullable for legacy rows, not populated from post-result saves.
- `stage_state_floor`: one ACKed lifetime-clear/first-date/objective checkpoint per stage. Requested objective IDs are unioned across later ACKs, not overwritten by a repeat with fewer objectives.
- `stage_friendship_floor`: at most three positive ACKed point floors per character, indexed by character and hero. Shared with11000 friendship and21000 dispatch ACKs; the existing table name is retained. Later increased points remain valid; removal or regression does not. Legacy completed11000/21000 rows are not retrospectively assigned floors without a new valid ACK.

New clear/objective/ordinary-item/new-PC/PVE-score/Element-record/PvB-record/friendship observations commit atomically with the native save. Already-owned PCs and unchanged friendship targets are not falsely counted as newly applied rewards. A newly created zero-score PvB record is an actual observation even without a new high score.

After an observed partial save, push responses omit only its delivery; the real operation remains queued until all ACK proofs arrive. Hot completion retries, cached callbacks, cold login/pull/confirm and completed-operation retries cancel with3000999 rather than applying the additive operation again. Saved observations cannot be restored to their pre-effect values. The existing canonical-clear reconciliation still handles an old pre-clear delta arriving with a valid later ACK.

Cached binary pulls touching stage progress, PCs, their job sets, characters, the active hero, score records or recorded stage inventory must match the current durable snapshot. Old pulls cannot reimport pre-award state after ACK.

Completed inventory floors now seek the latest completed target by changed item ID using existing indexes, instead of grouping lifetime gift/box/mission/stage award history. Stage floors and queued captures use primary-key lookups. This is source-level query design, not a measured performance result.

## Stage characters and ability boards

The common handler calls original `22ebbbc:22ec100` only for an absent gained PC, just like gacha and ordinary character presents. Its initialization path `22dba90:22dbf38` creates an owned UserPCJobSet; ordinary rank setting does not open every normal board. Existing exact evidence is `.work/gift-pc-repository-initialize-20261004.txt`, alongside the common5000 artifact above and `.work/gacha-acquisition-exact-20261004.txt`. Original stage `1010000108101` awards PC `1011003001` through rewardType50. No new native run was performed.

Fresh stage captures reuse `giftPcTarget` for every distinct gained PC. Already-owned units retain actual EXP, rank, limit break, ascension, unlock and board-bit minima. New units require owned joined initialization plus the owned job set; a lazy empty job list is valid, an absent or foreign set is not. Original job IDs and unsigned32 masks are validated for every saved board row through the shared gacha/present/stage proof, including rows absent from an empty new-unit target. Ascension progress without its unlock is rejected. Wire `gainedPCs` remains the original integer array, with no fabricated UserPC fields or duplicate-bond wire loot.

### Duplicate stage characters

Bounded original ARM64 `246c86c..246c8cc` calls the owned-PC predicate `22ec100:22ec21c`, initializing only a missing PC. The duplicate branch `246cb24..246cbf0` resolves the original `pc.slot8` string through personal-bond repository `2384210:2384588`, whose original comparison reads `limitBreakItem.slot2`. It calls that bond's additive vtable slot0x50 with **amount1 for each duplicate array occurrence**, not `skipCount`. `29b5dc0:29b5e04` uses root accessor `299cdb0:299cea4`, whose original literal is `pc`. Existing `master.bonds` already performs this same original PC-key join. For example, PC1011003001 maps to personal bond299000016, not to an item with the PC's numeric ID. Read-only exact artifacts `.work/stage-unit-duplicates-exact-20261006.txt` and `.work/stage-bond-resolution-exact-20261006.txt` finished exit0; `.work/stage-bond-native-asm-20261006.txt` records bounded original instructions. Decompiler-only output is not relied on for the grant count.

5000/16000/25000 now reserve those additive bonds in existing `pve_item_claim`, together with any loot or PVE-rank grant of the same item. No bond is inserted into `gainedItems`: the native PC branch already grants it. An absent first occurrence initializes the unit; subsequent occurrences reserve one bond each. The existing shared item reservation serializes an absolute gacha bond setter against the pending additive stage target. No actual inventory, character, signature or clear is pre-credited.

The existing private `stage_delivery.pc_targets` JSON records a duplicate's original bond ID/count and combined acquisition minimum alongside its unit target. The receipt validates that metadata against the original integer array and captured preowned IDs, and requires the matching item claim. This avoids accepting an old receipt that captured only same-bond wire loot but omitted its duplicate. No SQL schema or native response field is added. Legacy duplicate receipts without this original capture remain unavailable with their queue intact; nonduplicate/empty-PC compatibility is preserved. Never synthesize a baseline from current post-award stock.

Bond acquisition is a separate observed item effect. Early ACK without it is rejected; either bond-first or clear-first persistence suppresses additive redelivery while retaining the exact operation. Existing native save/profile/observation/ACK/floor/sequence/reply transaction, changed-ID acquisition floors, cold/hot/cached recovery and binary-pull comparison are reused. Spending the current bond amount to0 remains valid if cumulative acquisition survives. Cached stage-sensitive pulls also cover `UserGuestEvent`.

The native ownership predicate has an additional **timed guest** path: DomainPC+0x108 uses `22e5ac4:22e5ae4`, followed by window check `22d8614:22d8730`. The domain constructor `22d8de8:22d98f0` binds original `pcGuest` (root `29a58d8:29a59cc`, vector `29b8488:29b84cc`), and `22d83c4:22d8614` changes the guest flag through cumulative-EXP ownership. The latest follow-up below recovers the permanent-ownership algorithm and decoder fields, but the current master artifact still lacks the original guest catalogs. With that artifact, stage-PC issuance and pending saves continue requiring unique permanent joined ownerType1 and **no guest-event record for the reward PC**. Unrelated guest records do not block ordinary rewards. This is not timed-guest-feature support or publisher ownership parity.

#### Guest-event identity and save isolation

Original UserData dispatcher `27f99d0` calls bounded parser `2808780:2808994`. The parser resolves original literals `userId` (`31beaa4`), `pcId` (`31beb23`) and `totalExp` (`356d153`), using long/int/long getters and setters `285c8b0`, `285c98c` and `285ca6c`. The PC setter binds the protected field at row+0x30. Dispatcher `27f9a54` and registration `26f19fc:26f1c28` read that field into the same PC-keyed map at UserData+0x1b00; registration asserts against duplicate PC keys. DomainPC constructor uses master `pcGuest.slot1` to query that map via `26a82cc:26a8358`. Thus a different PC's guest progress is not an ownership prerequisite for the reward PC. Exact read-only `.work/stage-guest-event-key-exact-20261006.txt` finished exit0; bounded instructions/literals are recorded in `.work/stage-guest-event-key-native-asm-20261006.txt`. Tiny tail-call decompiler bodies may still merge callees and are not their actual function bounds.

The shared save merge now fixes UserGuestEvent's identity to `pcId`, never a guessed `guestEventId` or incidental alias. The server's incoming-save guard requires own typed fields, unique positive int32 PC keys, known original PC identities, a zero/local owner and nonnegative JavaScript-safe long EXP. Zero is the original lazy constructor's owner; the domain initializer calls sourceType0 through bounded `20bad50:20bad70`, selecting original storage key `user/game_user_id`. The safe-integer limit is a server representation boundary, not a recovered publisher EXP maximum; EXP above int32 remains representable. PC-only native delete selectors retain their original shape. Other captured fields are retained, not stripped, defaulted or rewritten; protected signature generation and natural guest progression are not claimed. Native profile reads/pulls and incoming saves reuse the same typed guard; unknown/malformed legacy rows remain unavailable without data normalization or loss.

Only matching unresolved guest state blocks a stage-PC grant or pending save. Unrelated guest saves may coexist with a pending result without becoming reward observations or ACKs. Introducing selected unresolved guest state while that permanent-PC grant is pending cancels and rolls back. Empty-PC completions do not acquire a new guest ownership dependency. The existing duplicate-bond/loot/PC/board/clear receipts, mixed ACK, floors, SQL tables, source hashes, response fields and event clock are unchanged. Cached guest-event binary pulls retain the existing current-snapshot comparison.

The extended stage-unit check is **DEFERRED / NOT RUN**: the original eight character/bond save orders carry unrelated guest state, typed PC-key update/delete, zero/local owners, EXP above int32, wrong alias/duplicate/string/unknown/out-of-range IDs, malformed/foreign owners and EXP, missing fields, damaged saved profiles and retained queues, matching guest cancellation before issuance/during pending saves, unrelated pending save without a fake observation/ACK, guest-sensitive stale pulls/restarts, and empty-PC repeat with matching guest state. A ninth permanently-earned-guest fixture is described below. Guest membership, progress values and eligibility are synthetic; only native field names/types/key lookup and the bounded ownership algorithm are recovered. No original guest catalog values, prizes, clocks, entitlements or signatures are manufactured.

#### Permanent guest ownership: decoder and source branch

Read-only `.work/stage-guest-ownership-bounded-exact-20261006.txt` finished exit0; `.work/stage-guest-ownership-native-asm-20261006.txt` records bounded original instructions, literal roots and archive hashes. The first range in earlier `.work/stage-guest-ownership-exact-20261006.txt` merged adjacent FDEs and is explicitly **not relied on**. Original `pcGuest.enc` is304 bytes, SHA256 `b78b69bbe560772ba0e2e59709a1d46431b1d8b99aaf9a4c89a224ded54ecf9f`; `pcGuestLevelStep.enc` is6320 bytes, SHA256 `bc538dee0ef2028ad15a1982dc289973738b67e069afa68e82009384f15aaa26`. These files were located and hashed, not decoded into the current master export.

The decoder now selects only proven fields: `pcGuest` slots0/1 are int group identity/PC ID, slots5/6 are long start/end; `pcGuestLevelStep` slots1/2/3/4 are int guest group/level/EXP threshold/marker. Unused step-row identity and other guest fields are left uninterpreted. Preserve the original guest vector order: DomainPC binds the **first** PC match, not a last-row dictionary entry. Group selector `179c9c4:179cad0` joins the guest's slot0 to the step's slot1; bounded comparator `179e258:179e7b0` sorts the selected steps by **descending level**, not by EXP threshold. `22d83c4:22d8614` picks the first qualifying threshold and compares that level to the first marker15 level. The factory's absent-marker fallback is INT_MAX, not the highest authored level. Duplicate-level ambiguity cancels rather than assigning an invented tie-break. Absolute guest EXP setter `22d8730:22d87b8` caps to the first sorted step threshold; it is not a new additive reward packet.

`stageGuestIsPermanent` and the existing stage ownership guard now implement that permanent classification when complete, typed original catalog rows are available. A permanently earned matching guest still requires the existing unique local joined ownerType1 PC and normal captured unit/board/bond proof. An unrelated historical guest row whose PC is absent from a complete original guest catalog has no DomainPC guest component. Missing/partial/malformed catalogs are unavailable, not evidence of ordinary ownership. No new receipt ledger, SQL migration, response field, signature, item/PC precredit or clock policy is added. Current `data/danmemore-master.json` remains the unchanged156-source artifact **without these two catalogs**, so this source branch is not yet usable with the current export. The deferred master check now pins both original hashes and requires the158-source regenerated export; that gate is presently unmet.

The exact window predicate `2a3a5dc:2a3a61c` uses positive inclusive start / positive exclusive end; nonpositive bounds are open. `22ec100:22ec21c` still requires joiningState1 after an active temporary window; a cleared permanent guest flag skips the window, not joined ownership. Temporary guest-stage reward save/replay and event-clock transitions remain unimplemented; they are not silently treated as permanent. Guest roster/earning, other producers, EXP progression/reset/floors, original memberships/threshold values and native cache/signature acceptance remain incomplete.

Extended `test_stage_units.cjs` queues synthetic threshold edges, EXP above int32, original INT_MAX fallback, level-versus-EXP ordering, absent/missing/malformed catalogs and ambiguous levels, plus a ninth preowned permanent-guest/bond clear-first save/restart/ACK/rollback case and attempted loss of permanent classification while pending. These catalog IDs, memberships, thresholds, dates and source counters are explicitly synthetic, not publisher data or proof of natural earning. Both it and the updated158-source master check are **DEFERRED / NOT RUN**, as are all native/MuMu checks.

Extended `node tools/test_stage_units.cjs` remains **DEFERRED / NOT RUN**. Queued probes include the original one-unit Lili first-clear/preowned conversion, missing/malformed bond mapping/capture/item claim, same-bond loot merging, early ACK, owned inventory validation, both split-save orders, restarts/exact retries/cancellation, acquisition spending versus rewinds/deletion, stale bond-only binary pulls, shared absolute/additive reservations and issue/observation/ACK/reply rollback. A quantity2 scratch catalog is explicitly synthetic and checks first-new/second-duplicate array behavior only; guest rows use recovered field names/types with synthetic membership/progress, and the temporary absolute queue is a reservation safety probe, not a recovered native draw. All shared stage/skip/PVE/Element/PvB/gift/mission/gacha/dispatch/save/recovery regressions remain queued. Native naturally earned rewards, default initialization/stats/skills/communication effects, guest eligibility, actual signatures/save order, back navigation and crash/ANR acceptance remain pending.

New-PC and new-job-set observations are separate. Either half alone suppresses additive stage delivery on save replies while retaining the operation; cold/cached/hot delivery cancels until the missing saves and real ACK arrive. Observed ownership or boards cannot be deleted. A preowned PC is not a new reward observation, but its captured progress and bits must remain intact even while pending. Completed stage PC targets merge into the existing primary-key `gift_pc_floor` only in the actual ACK transaction, shared with gift/gacha targets rather than a new lifetime ledger. Profiles, observations, floor, queue/done, sequence and exact reply roll back together.

The nullable `pc_targets` migration preserves old unknown baselines. A legacy pending result with nonempty gained PCs and no original target remains queued and unavailable; no current post-award progress is substituted. Empty-PC legacy results require no invented target. Completion without a PC reward does not load the full character/job-set profiles for this capture.

The updated disposable `test_stage_units.cjs` is **DEFERRED / NOT RUN**. It covers unit-first, boards-first, clear-first, combined and preowned cases; missing/foreign/malformed job sets and unit progress, original IDs, lazy/unsigned masks, pending/completed deletion and captured-bit/EXP regression, higher later EXP/bits, hot/cache/cold retries, matching versus stale board-only binary pulls, retained legacy queues, empty-PC legacy compatibility, once-only reward and issue/observation/ACK/reply rollback. Its progress/stats/signatures/prerequisites are synthetic, not evidence of original initialization or natural progression. Repeat shared gift/gacha/panel/mission-unit and all stage-mode checks in the consolidated pass. Native defaults, HP/stats/skills, communication-character effects, signatures and checkpoint ordering remain unproved.

## Stage friendship points and hero selection

The original common handler consumes only `{characterId,friendship}` and calls `DomainCharacter::setFriendship` at raw `0x23e6b08:0x23e7564`. This is an **absolute** point setter. Its getter `0x23e5a2c:0x23e5afc` and setter both select the current global `UserInfo.heroType`, not a hero field in the result. Hero0/1/2 writes `friendship`/`friendshipAis`/`friendshipLef` through raw `0x260903c:0x260914c`, `0x2609310:0x2609420` and `0x2609420:0x2609530`, marking dirty only on change. The native point cap is **2,000,000,000**, not signed-int32 max. Level lookup `0x23e7d60:0x23e7f40` uses the archived ordered CP thresholds.

Exact read-only artifacts: `.work/stage-friendship-setter-exact-20261006.txt` and `.work/stage-friendship-hero-fields-exact-20261006.txt`; all source evidence is from the original binary hash above. Earlier recorded stage requests carry four fields including level and hero; no current native run was performed.

Fresh5000/16000/25000 captures validate those request fields against the unique owned saved character, current hero, original level steps and non-regressing points within the native cap. Identical repeated character targets retain native wire multiplicity but share one private capture; conflicting duplicates cancel. The response stays the original two-field shape. PvB19000 still rejects friendship effects.

Unobserved delivery requires the issued hero to remain selected. A hero-change save cannot leave unsaved CP on the prior hero; once those points are saved, a later hero change is valid, while existing partial-delivery suppression retains the queue. An ACK requires each captured field on the correct owned character, not any other hero's points. Observed new CP cannot be rewound/deleted while pending, and positive targets become indexed floors only in the actual ACK transaction. Profile/observation/floor/queue/done/sequence/reply updates roll back together. No CP, reward flag, stat bit or signature is pre-credited.

Fresh stage,11000 friendship and21000 dispatch results touching the same character serialize until its pending result is ACKed. Exact pending retries retain their original capture. This queue-bounded guard prevents an older absolute target overwriting a later producer; it is not an inferred publisher concurrency protocol.

Legacy pending results with nonempty CP and a missing original capture remain explicitly unavailable, with queue/history retained. A legacy result with empty CP needs no invented CP baseline. The setter's level-change stat refresh and notifications are visible in code, but this change does **not** recover CP-level item/Iris/received-flag payloads or their issuing order. No new root XP field or guessed friendship reward is inserted into5000.

## Remaining limits

- This is not complete battle validation or a complete gameplay implementation. Special/cached XP party selection, guest roster/eligibility/full stats, CP-level rewards/flags/stat refresh, special-mode unlocks, duplicate-PC bonds and full unit/board/stat initialization still need recovered producer/effect/save proofs. Saved ordinary guest EXP inputs are now supported as detailed below, not complete guest gameplay. Main-story successor/episode/difficulty/story-scene source boundaries are documented below; none has new native acceptance. Partial saves containing only the other unresolved effects are not covered by these checkpoints. Request CP targets are bound to owned state and original levels, not yet to a recovered battle-party/drop/reward calculation. The archived stage table has no rewardType14 first-clear costume stages; the native generic costume branch is not evidence of authored costume rewards.
- Loot submitted in the completion request still lacks original enemy/drop-table validation. Synthetic test loot must not be presented as archived drop data.
- The inherited ordinary acquisition ceiling is999999999. Full class-specific caps and native signatures remain an acceptance gap; the new code rejects saturation rather than silently clamping rewards.
- Iris/stamina/casino IDs in ordinary `gainedItems` cancel before queueing: their special native acquisition providers are not established by the generic item-profile mapping. This does not disable the separate original Iris first-clear/objective wallet credit or implemented stamina/casino reward routes.
- Old pending stages without original delivery captures or ordinary inventory baselines remain queued and explicitly unavailable. No post-award balance is guessed as an old baseline, and no queue/history is erased. Legacy reconciliation is still required.
-3000999 recovery text, dismissed loading overlays, usable back/home navigation, real signed hot/cold delivery and absence of crashes/ANRs require the consolidated native pass.

## Deferred checks

Run `node tools/test_stage_friendship.cjs` and `node tools/test_stage_items.cjs`, then updated `test_stage_persistence.cjs`, `test_stage_units.cjs`, `test_pve.cjs`, `test_element_completion.cjs`, `test_pvb.cjs`, `test_pvb_views.cjs`, `test_expedition.cjs` and `test_danmemore_server.cjs`. All are **NOT RUN** for this change. Repeat friendship/dispatch/mission/box/gift/shop/scratch/shared-inventory, save/recovery, Android and launcher regressions before native acceptance.

The new disposable check covers original first-clear Valis, synthetic mixed ordinary loot/date-list tickets, both split-save orders, missing/foreign/rewound inventory, checkpoint and ACK rollback, retained queues, corrupted/missing captures, stale callbacks/pulls, cold recovery, completed clear/objective/inventory floors, spending, once-only Iris and repeat-stage rewards. Synthetic saves are not proof of natural progression, native signatures or client rendering.

The new friendship check covers all three tracks, repeated absolute targets, point/level/hero validation, two split orders, wrong-track ACK, hero changes, overlap cancellation, unchanged CP, native cap, legacy/malformed captures, point deletion/rewind, cold/cached delivery, old binary pulls, positive floors and issue/observation/ACK/reply rollback. Both repeat and cap cases are synthetic telemetry, not original battle rewards. Additional mode-specific native CP effects, original earning/level rewards, interrupted recovery, signatures and no-crash/ANR/performance remain pending.

## Player EXP and level-up stamina follow-up

Source implementation only, functional/native checks **DEFERRED / NOT RUN**. Original ARM64 hash above was rechecked. Each read-only extraction finished with process exit0 and successful script completion before its output was inspected; Ghidra jobs ran serially.

The common5000/16000/25000 handler calls raw `246c428:246c4a0` **before** loot. This reads encrypted `adventureStage` **slot16**, initializes the equipment-bonus cache at `247b3f0:247b5ac`, reads multiplier kind1 via `247aefc:247afcc`, truncates the float32 product, then multiplies by `max(1,skipCount)` in signed-int32. The tail call reaches original `DomainPlayerStatus::changeTotalExp` (`2540b54:2540e78`). `2540618:2540914` derives level from the ordered original thresholds and clamps total EXP at the last level. Every newly crossed level adds that original level's `playerLevelStep.slot3` maxSP through `2548998`. There is no separate invented EXP response field. PvB19000 does not use this common provider.

Artifacts: `.work/stage-player-xp-provider-exact-20261006.txt`, `.work/stage-player-xp-boost-exact-20261006.txt`, `.work/stage-player-xp-party-exact-20261006.txt`, and `.work/stage-clear-xp-exact-20261006.txt`; existing `.work/expedition-party-xp-exact-20261004.txt` and `.work/expedition-boost-combine-exact-20261004.txt` supply the shared level/equipment proof. The decoder now exports `stageExperience` for **21,524** original stages without changing existing stage objects or the148 source-table provenance records. Stage1010000101101 has96 EXP; story1010000101103 and the Lili first-clear1010000108101 have0.

Native party selector `2230394:223083c` can choose several battle parties and a cached normal-party object; main-PC enumeration is `23b767c:23b7894`, and equipment sum `247afcc:247b378` resolves equipped weapon/armour abilities. The current implementation supports **ordinary completion modes, six main slots with a saved matching supporter replacement, and no saved active special-mode processing state** for positive EXP. It uses the same ordinary-mode boundary as existing5000 issuance, not a main-story-only gate; all13 parent types with positive archived EXP fall within that boundary. It reuses the existing dispatch equipment/float32 calculator with six slots. Guest production, alternate-party/cache lifecycle and native acceptance remain pending; this selection boundary is not complete natural battle-party proof. Other positive-EXP modes cancel before issuance; original zero-EXP callbacks continue without inventing a baseline. Signed-int32 multiplication overflow also cancels before issuance rather than handing the client a wrapped negative award.

`stage_xp_claim` captures actual pre-result player EXP, original amount, selected party/equipment inputs, float32 bonus, capped target, crossed-level SP quantity and actual/reserved pre-SP target. Profiles, level, SP, flags and signatures are never pre-credited. Fresh positive-EXP stage/dispatch results serialize while another player-EXP result is pending; exact existing retries keep their original target. Party/equipment changes are rejected until the captured EXP is saved, preventing a redelivery from using a different multiplier. Independent attribution of every EXP/SP producer is still not established.

Ordinary stage EXP inputs now follow native **slot-number order**, not the incidental JSON array order. Original bounded ARM64 ASM confirms `23b27ec:23b398c` constructs the ordinary slots then calls `23c1168:23c1768` at `23b298c`; that sorter compares the protected getter `23c60ac:23c60b4`. `23c5ea8:23c5f24` binds the saved slot at domain offset0x10, and the getter loads that saved slot's first protected field. `23b767c:23b7894` subsequently enumerates this ordered collection for the equipment provider. Fresh captures sort their validated six inputs; receipt reads sort validated historical inputs **only in memory**. Both delivery and pre-EXP save pinning consume the normalized receipt. Stored receipts, awarded amount, EXP/SP reservations, profiles, signatures and queue identities are not rewritten. Thus equivalent array reorderings do not block a pending result, while changing a unit's actual slot or equipped abilities still rejects.

Saved guests now require consistent embedded/outer main and assist identities. Bounded ASM `23b2b60` tests the embedded main PC before constructing a supporter, and `23b40a4:23b4694` substitutes matching slot numbers rather than appending a seventh PC. A main0 guest (even with an assist) and a nonmatching slot do not add a main PC. For a matched guest, factory `22db608:22dba84` uses the nested main PC and equipment; main/assist ownerType comes from the actual protected byte getter `1f4557c`. Main DomainPC vtable `42a88b8+0x100/+0x110` resolves to bounded `22e3fac:22e41c4` weapon and `22e4358:22e4570` armor: ownerType3 reads embedded snapshots, including native slotIndex0/foreign user IDs; every other byte value uses the **nested guest PC's** local equipment indices, not an owned PC found by guest pcId. Borrowed gear validation is explicitly separate from owned inventory validation; `Array.every`'s numeric second argument cannot relax ownership. Main-only enumeration excludes assist equipment from the multiplier. Captured guest/source/piece identities and five ability IDs use the existing private receipt and pre-EXP save pinning; no guest or gear is imported into owned profiles, and no SQLite table/migration, invented peer, wire field, native precredit or legacy backfill is added.

Snapshot equipment factory `2596058:259629c` passes sourceType4 to `259539c`; bounded `2597434:259784c`'s0x51 mask includes4, selecting saved abilities like owned gear. The existing fixed+saved calculation is **unchanged**: original bounded `259784c:2597a50` reads all FIVE fixed abilities at FlatBuffer vtable offsets0x40/42/44/46/48, corresponding to schema slots30..34 (`4+2*index`). Its decompiler output misleadingly omits the last two reads; a proposed three-fixed-ability change was discarded before finalizing. Read-only jobs `.work/stage-guest-equipment-bind-exact-20261006.txt` and `.work/stage-guest-equipment-abilities-exact-20261006.txt` finished exit0; `.work/stage-guest-xp-native-asm-20261006.txt` records bounded original proof and unchanged hashes. Existing slot-selection/order artifacts retain the slot-substitution proof. Small tail-call getters' merged decompiler bodies are **not** their actual bounds. Guest roster/eligibility/full stats, alternate/cached-party lifetime and native acceptance remain incomplete.

Extended `node tools/test_stage_experience.cjs` is **NOT RUN**: reordered fresh inputs, equivalent pre-EXP party/UserInfo saves, original and historical capture ordering, hot/exact cached/cold retries, preserved raw legacy receipts, real unit/equipment changes and inconsistent embedded alias rejection. New synthetic saved-guest fixtures queue borrowed slot0 weapon/armor, missing local indices ignored for ownerType3, non-type3 nested-index lookup without an owned guest PC, backline replacement, unmatched/main0-assist omission, no extra seventh main or owned imports, malformed IDs/owner byte/slot/equipment/type/ability cancellation, six-only guest receipt validation, guest/piece pinning, EXP-before-loot interruption, cold recovery and profile/floor/queue/reply ACK rollback. The existing missing-capture, split EXP/SP/loot, ACK/floor/rollback/restart probes remain queued. These are not naturally earned guests or signed native acceptance. Actual player SQLite, listener, APK and MuMu are unchanged; no workers or GitHub Actions.

An EXP-only saved result is now an observed stage effect, even with no clear/loot delta. Push suppresses its delivery only, while hot/cache/cold login/pull/confirm retries cancel3000999 with the real queue retained. The actual ACK requires valid owned EXP and derived level at the target, clear/objectives/loot/PC/CP/mode-specific proofs, and independently saved crossed-level SP acquisition. Saved SP proof survives legitimate later spending. Observed EXP cannot be rewound while pending; actual ACK merges its target into one indexed `stage_xp_floor` row, shared through the existing player validation with dispatch floors. The floor uses recovered awarded targets, not arbitrary higher later EXP. Profile, observation, SP proof, floor, done/queue, sequence and exact reply changes share the save transaction. Legacy positive-EXP operations without their original capture remain queued/unavailable; no post-award baseline is inferred.

New `node tools/test_stage_experience.cjs` is **NOT RUN**: original96/zero EXP, real original+15% gear with synthetic owned piece (110 EXP), fresh level2/21 SP, missing EXP/SP/level, both partial-save orders, queued/malformed/missing captures, pre-save party changes, no pre-credit, rollback, cold/cache replay, spending, pending/completed deletion/regression, stale UserInfo pulls, known zero-EXP legacy compatibility and level999 saturation. Old focused stage inventory/CP/persistence checks now explicitly use a synthetic EXP/SP prerequisite helper only for their final mixed save/ACK; the new negative EXP checks do not use it. Those helpers are not native proof. Adapt/repeat remaining ordinary battle, skip, special-mode, stage-mode, dispatch, shared stamina/reward/save/recovery/Android/launcher fixtures in the consolidated pass. Native signatures, natural eligibility, actual save ordering, bonus/cache/guest/mode selection, level-up achievement notifications, usable recovery/back navigation, no crash/ANR and performance remain unverified. The actual save/listener/APK/MuMu were unchanged.

## Direct main-story successor unlock follow-up

Source only; functional/native checks **DEFERRED / NOT RUN**. Four serial read-only Ghidra jobs completed with exit0 and successful decompilation before their outputs were read: `.work/stage-unlock-state-exact-20261006.txt`, `.work/stage-unlock-refresh-exact-20261006.txt`, `.work/stage-unlock-level-link-exact-20261006.txt`, and `.work/stage-unlock-difficulty-gate-exact-20261006.txt`. The original binary hash remains the one above.

After the current clear, `2452d30:2452e28` selects index+1; `2450500:245063c` selects the current episode's authored difficulty, and `2480344:248042c` looks up that index in its actual stage collection. IDs are **not** incremented to guess the next stage. `245110c:2451204` similarly selects index-1 for the predecessor check. `2452e28:24539ec` rejects a saved nonzero next-stage state before evaluating its unlock condition. Condition0 has no extra condition; condition1 requires all stages of the immediately lower difficulty to be state4 via `2480114:24801bc`. At difficulty1 the direct successor's just-cleared predecessor satisfies `24544e4:24546f0`; at later difficulties the callback also requires normal difficulty's aggregate state2. `247ff64:2480114` returns that state2 only when all normal stages are state4. Thus difficulty3 may require **both normal and hard completion**, not just hard completion; even later-difficulty condition0 retains its normal-completion gate. Finally `2451204:24512f0` writes the next stage's **state1**, not state2; `24512f0:2451750` emits the original unlock/event notifications. State0 is locked. States1/2/3/4 are preserved as already open, not falsely observed as a newly applied unlock.

The decoder exports `stageProgression` for all **21,524** original stages: slot1 episode ID, slot3 index, slot4 difficulty and slot14 unlock condition. All episode/difficulty/index keys are unique in this archive. Main-story adventureType1 has3,129 stages, with1,043 at each difficulty; its conditions are0 or1, and condition1 appears only at difficulties2/3. Existing stage objects and all148 source-table hashes are unchanged. For example, zero-EXP story1010000101103 opens1010000101104 through their authored index3->4; hard-story1010000101203's successor uses the completed normal-difficulty prerequisite. This is original graph data, not proof that a particular player naturally unlocked those stages.

Fresh main-story captures add nullable `stage_delivery.next_unlock`: the exact authored graph hash, selected successor ID (0 means no direct successor), actual prior successor state or absent-row marker, and actual normal/immediately-lower difficulty saved states/absent markers for the applicable gates. Originally open successors skip those irrelevant prerequisite profile reads, matching the native early return. This original direct-only capture remains; the additional episode/difficulty/auto-clear source boundary below supersedes its earlier direct-only implementation limit. Neither capture invents an episode profile, pre-opens a stage, adds a new wire field, assigns a signature or infers a legacy baseline. The shared fresh-completion boundary rejects locked/out-of-enum/foreign/duplicate current-stage rows before issuance.

A newly unlocked successor is an independent observation, even without current clear/loot/EXP/CP. Either split order suppresses additive delivery on push only and retains the real queue; hot/cached/cold login/pull/confirm callbacks cancel3000999 until the existing complete mixed ACK arrives. A pending originally open successor cannot disappear or relock; it is not a new observation. Unsaved condition1 unlocks retain their captured completed lower difficulty. Missing/foreign/duplicate/out-of-enum target rows cannot satisfy ACK. A new unlock must be saved uniquely and owned in state1/2/3/4 alongside all existing stage proofs. The actual ACK also preserves a successor that was already open in the original capture.

`stage_unlock_floor` stores one acknowledged open-stage checkpoint per successor with its actual ACKed operation ID. It is inserted in the same transaction as profiles, observations, other floors, queue/done, sequence and exact reply. Changed stage IDs use primary-key floor lookups; deletion/relocking/foreign ownership is rejected, while later ready/in-battle/cleared positive states remain valid. Existing binary-pull snapshot checks cover unlock-only changes in UserAdventureStage. Old main-story pending results with NULL/malformed captures stay queued/unavailable; their actual post-award state is not substituted. Non-main-story results retain their previous explicit source boundary, not a newly claimed generic unlock proof.

New `node tools/test_stage_unlocks.cjs` is **NOT RUN**. It covers a zero-EXP original story successor, present-locked/absent/already-open baselines, unlock-first/clear-first, invalid current/target ownership/enums/duplicates, lower-difficulty gates, a terminal with no direct successor, malformed/missing/graph-drift captures, full versus missing unlock ACK, preowned non-observation, issue/observation/floor/ACK/reply rollback, cold/cache retries, deletion/relocking, later in-battle state, once-only original Iris and repeat clears. All prerequisites/saves/signatures are synthetic. Existing focused stage fixtures explicitly add synthetic successor prerequisites for their mixed ACKs; dedicated unlock negatives do not use that helper. Repeat all stage-mode/skip/EXP/CP/unit/shared-reward/save/recovery/Android/launcher regressions in the consolidated pass.

The direct capture's successor0 proves only absence of a direct-next effect, not absence of episode-wide effects. Broader main-story source support follows below; adventure/window/ticket modes and native acceptance remain gaps. Actual player save/listener/APK/MuMu unchanged; no workers or GitHub Actions; co-op last. Current inventory stays96 partial/73 unsupported/zero feature-complete.

## Main-story episode/difficulty and auto-cleared narrative follow-up

Source only, all functional/native checks **DEFERRED / NOT RUN**. The original ARM64 SHA above was rechecked. Exact FDE-bound, serial read-only extractions finished with process exit0 and successful script/decompilation before reading: `.work/stage-episode-links-exact-20261006.txt`, `.work/stage-episode-availability-initialize-exact-20261006.txt`, `.work/stage-owned-initialization-exact-20261006.txt`, `.work/stage-constructor-defaults-exact-20261006.txt` and `.work/stage-user-constructor-exact-20261006.txt`.

Original `245d164:245d25c` and `245d06c:245d164` select episode index+1/-1 within the parent adventure; `247ec14:247ecfc` matches the original index, not ID arithmetic. Episode state is derived from stages: `245cad8:245cc70` is locked only when all normal saved stages are absent/locked; `245c9e0:245cad8` uses normal-difficulty aggregate2 for completed episodes. There is no new native episode save table to fabricate. The decoder exports all **1,230** `adventureEpisode` records (slot2 parent adventure, slot3 index). The **141 main-story episode keys are unique**; special modes have repeated indices and must not reuse this main-story graph contract. All148 original source hashes remain unchanged.

After direct-next processing, `2451924:24528e0` checks whether every stage of the current difficulty is4. `248066c:24806cc` selects the next difficulty. For main-story type1, every eligible next-difficulty stage is visited: battle nodes open1, story kind51 recursively clear with count1. Recursive clears apply the same direct/difficulty rules. At later difficulties, a direct kind51 successor auto-clears only when the **current stage's normal counterpart** is4; otherwise the eligible successor opens1. Condition1 and the separate normal-completion gate still apply. Only normal difficulty then opens the next authored episode's first normal stage, always by open1 even if narrative. `247f064:247f08c` tests parent adventureType13; it is **not** a main-story time/availability flag. The special type13 all-next-locked guard at `248042c:24804d0` is not imported into type1.

Lazy initialization `2450814:2450af4` -> `245c1cc:245c214` -> `245c214:245c258` -> `2664c94:26650c4` initializes zero counters/dates before explicit identity/state initialization. It does not zero every field (the constructor also has nonzero multiplier/token defaults). `20bad50:20bad70` selects global `user/game_user_id`, not a costume-style userId0 exception. For main story, only condition0/index1/level1/episode-index1 starts open1; other absent nodes in this graph default locked0. These are extracted defaults, not a new signed-client initialization run.

Fresh `stage_delivery.story_progression` records only the actual consulted stage state/counter/first-date inputs or explicit absence, original graph hash and ordered open/auto-clear effects. A bounded graph walk follows native direct-next/difficulty/next-episode order, using virtual root completion and state0->positive transitions. It reuses the existing stage receipts and floors; no parallel progression subsystem, native profile pre-credit, XP/loot/PC/CP reward, synthetic signature or wire row is added. Auto-clear invokes the flag/counter/date helper, not the common loot provider. **24** archived later-difficulty narrative nodes list nonzero first-clear rewards; those are not automatically minted by this helper.

Actual unique owned saves are required for every planned effect. Auto-clears additionally require the increased counter, positive last date and preserved first date (a new first date equals last date), using `savedStageClear`. All consulted previously completed/open prerequisites remain intact while pending. Fresh main-story results serialize behind another pending main-story result to avoid overlapping graph mutations; this is an explicit offline safety boundary, not a recovered publisher concurrency rule. Partial chapter-open/story-clear/difficulty-only saves suppress delivery on push only; actual queue and full mixed ACK remain. Observed effects cannot rewind. Cold/cached/hot retries stay unavailable until complete saves and ACK, rather than rerunning the additive root clear.

Actual ACK merges all new opens into the existing indexed `stage_unlock_floor`, and auto-clears into `stage_state_floor` with their real saved counters/first dates/objectives. All writes share profile/observation/done/queue/sequence/reply rollback. Post-ACK deletion/relocking or cleared-counter/date/objective rewind is rejected via changed-ID primary-key lookups, not lifetime graph-history scans. Existing stage-sensitive binary pull checks cover these flags. NULL/malformed/graph-drift legacy captures remain queued/unavailable; an empty effect list is valid only with the original consulted inputs. No post-result save is guessed as a missing baseline.

Extended `node tools/test_stage_unlocks.cjs` is **NOT RUN**: incomplete terminal versus completed episode, locked/absent/preowned next difficulties, ordered hard/VH fanout, direct narrative auto-clear, next chapter, no auto-clear loot, missing counters/dates/ownership/duplicates, either split order, partial/cold/restart/queue retention, overlapping issuance, malformed/missing/drift captures, transactional rollback, ACK floors/deletion/rewind and once-only root Iris/repeats. Updated older stage fixtures explicitly synthesize all receipt effects only for their mixed ACKs; dedicated negatives do not use that helper. All eligibility/defaults/deltas/signatures in these checks are synthetic. Repeat all ordinary/skips/PVE/Element/PvB/EXP/CP/PC/shared-item/save/recovery/Android/launcher regressions in the consolidated pass.

Special-mode/window/ticket graphs, completed/unlocked achievement event propagation, independent producer attribution, native dirty/default/signature lifecycle and ordering, natural progression, legacy reconciliation, usable recovery/back navigation, no-crash/ANR and performance remain incomplete/unverified. Main-story source graph coverage is not a claim that the game is playable. Actual save/listener/APK/MuMu unchanged; no workers/Actions; co-op last. Inventory remains96 partial/73 unsupported/zero complete.

## Event/special adventureType16/17 graph follow-up

Source only; functional/native checks **DEFERRED / NOT RUN**. The binary hash above was rechecked. Two serial, read-only FDE-bound jobs finished with process exit0 and successful script/decompile before reading `.work/stage-event-state-getter-exact-20261006.txt` (`2450cb8:2450ef4`) and `.work/stage-event-refresh-collection-exact-20261006.txt` (`245ab94:245ac6c`, `247ea14:247ec14`). The already recovered `2452e28:24539ec` condition switch and predecessor helper are reused.

The decoder adds `stageUnlocks` for **21,524** original records: slot15 integer threshold/value and slot38 long `targetId`. Only condition9 interprets this target as a prerequisite stage; other conditions can refer to items or other domains. Condition9 resolves **that ID** through the original stage repository and requires its state4; it does not calculate a normal counterpart by replacing digits. All **2,052** type16 stages and **33** type17 stages use only condition0/9 in this archive; their condition9 references remain within their own mode. Type16 has1,378 such references, including15 first-normal-stage links to a different episode. Type17 has7, and `1170000101211` explicitly depends on `1170000101110`, not `1170000101111`. Existing `stageProgression` objects and all148 source hashes stay unchanged.

After a condition passes, `2452e28` keeps the original predecessor/previous-episode rule at **every type16 difficulty**. Type17 instead bypasses that rule at difficulties2/3; difficulty1 still uses it. Neither mode inherits main-story's whole-normal aggregate gate. `2450cb8` gives missing type16 rows the same conditional first-normal-node default as main story; missing type17 rows return0. Both modes' episodes have original index1 only, so there is no index2/0 next/previous episode in these graphs. Repeated type16 parent/index1 keys are retained as ambiguous, not selected arbitrarily; this callback never needs that ambiguous index. The original `247ea14` collection can additionally filter time-qualified episodes; no generic unfiltered special-mode collection or event-clock eligibility is claimed here.

The same nullable `stage_delivery.story_progression` graph walk now handles1/16/17 with mode-scoped IDs, original graph hashes and mode-specific eligibility. Existing main-story hashes are preserved byte-for-byte in their construction. Other modes' hashes additionally bind exact slot38 prerequisites. Covered fresh results serialize behind another covered result; actual consulted completed/open prerequisites cannot disappear or rewind. No new progression table, native profile pre-credit, bootstrap/unlock policy, auto-clear reward or wire field is added. Original next-stage, completed-difficulty, recursive kind51 clear and normal next-episode ordering still determines the effect list.

For a completed normal type16 episode with all hard nodes locked, the first eligible hard narrative can auto-clear and open the next battle; the newly open battle then blocks its successors. This is **not** main-story's all-battle fanout. Type17 later-difficulty condition0/9 applies its own bypass, rather than a synthetic all-normal requirement. The existing unique-owned open/clear proof, independent effect observations, push-only partial suppression, retained mixed ACK/queue, cold/cache cancellation, indexed open/lifetime-clear/date/objective floors and transaction rollback are reused unchanged. A legacy type16/17 pending result without its actual graph capture now stays explicitly unavailable and retained; no post-result baseline is substituted.

Extended `node tools/test_stage_unlocks.cjs` and `test_master_data.cjs` are **NOT RUN**. New synthetic vectors cover locked/absent sequential type16 difficulty entry (only first narrative + next battle), no auto-loot, either partial-save order, actual prerequisite preservation, corrupted/missing/drift effect lists, clear-count proof, cold restart, floor/ACK rollback, deletion/rewind, repeats/once-only root Iris, condition9 exact prerequisite with otherwise incomplete normal stages, and type17's explicit non-corresponding-index dependency. Updated existing mixed-ACK helpers already consume every recorded graph effect; negative unlock cases do not use them. All defaults/eligibility/deltas/signatures remain synthetic, not natural native progression. Repeat all stage-mode/skip/shared-reward/EXP/CP/unit/save/recovery/Android/launcher checks in the consolidated pass.

This is support for the **clear callback's graph effects**, not feature-complete type16/17 or generic event handling. Cross-episode condition9 refresh/first-entry bootstrap, event availability/clock filtering, other condition switches/modes (including9/13), daily-clear counter reset/save proof, completion/unlock achievement propagation and native signatures/dirty/event order still need recovery. `245ab94` is a distinct force-state4 helper with no counter/date increment; it is not incorrectly substituted for recursive `2451924` auto-clear. Independent producer attribution, legacy reconciliation, usable interrupted recovery/back, no-crash/ANR and performance remain unverified. Actual save/listener/APK/MuMu unchanged; no workers/Actions; co-op last. Inventory remains96 partial/73 unsupported/zero complete.

## CP-triggered character-quest/story refresh

SOURCE ONLY; functional, synthetic and native acceptance **DEFERRED / NOT RUN**. Original binary hash unchanged. Serial read-only FDE-bound decompiles completed with process exit0/script success before reading `.work/stage-refresh-firstentry-events-exact-20261006.txt`, `stage-firstentry-label-producers-exact-20261006.txt`, `stage-quest-table-origin-exact-20261006.txt`, `stage-quest-init-exact-20261006.txt`, `stage-quest-rebuild-exact-20261006.txt`, `stage-quest-original-identity-exact-20261006.txt`, `stage-quest-current-hero-level-exact-20261006.txt` and `stage-quest-predecessors-exact-20261006.txt`. Printed addresses are raw+0x100000; all recorded function boundaries subtract that bias. The first-entry artifact was regenerated at the corrected `29b6a3c:29b6a80` getter; an earlier, unrelated GC function is not evidence.

`23e6b08` writes the selected global-hero CP track, compares its old/new levels, and skips refresh when that level did not change. A level change calls `2418b0c`, resolving character key against **communicationCharacter slot2**; the matching quest's **slot1** supplies an adventure grouping label. Repository initialization `2418188 ->29b5b5c ->299c51c` confirms this original table rather than an invented/missing quest table. `246c0c4` matches **adventure slot5**, enumerates its normal stages, calls the non-virtual base `2452e28`, and opens eligible locked nodes with `2451204`. It never clears or grants loot. In the battle common callback, this occurs **before root clear**; no virtual state4 is used in the CP refresh capture.

Condition5 calls `241a3c8`, which takes **MAX(1, Bell CP level, Ais CP level, Lefiya CP level)**, not just today's hero level, and compares the original stage slot15 threshold. Eligibility also requires the authored previous stage4, or no previous stage plus previous episode's normal aggregate completion. Missing type2/3 owned rows default0. The matched archive contains288 type2 quest stages and96 type3 character-story stages, all normal difficulty/condition5; 26 original communication rows map to78 parent adventures across types2/3/4. Type4's319 unit-story stages use condition6, which this directly called base predicate rejects; their distinct unlock provider is still missing, not guessed from CP. These are **not** type16 event chapters: type16's grouping label is empty. The earlier inference that this CP setter refresh explains type16's cross-episode condition9 links is superseded by the actual table joins.

The decoder adds `adventureProgression` for543 original rows (type, slot5 grouping label, slot11 episode-list type). All148 source-table hashes remain unchanged. Matched type2/3 parents have episode-list type0, so the `247ea14` time-qualified filter for slot11 values3/4 is not silently applied or invented here. Other initializer `247401c` reads **nextEpisodeNotice** through `29b6a3c/299fa7c` before a type11 refresh; its triggering initialization and save attribution remain unresolved. Local tutorial main-story bootstrap `1a5893c ->246b35c`, quest-state first entry `2418d64 ->246b840`, and `24529fc/2452af0` achievement events are recovered callers, not implemented network packets or precredited flags.

Fresh battle5000/16000/25000 and shared CP11000/dispatch21000 captures now bind actual active-track before/target points and original level hashes, plus a nullable `friendship_unlocks` graph receipt: all three consulted hero tracks, original grouping/threshold/episode hash, actual before/absent stage states and open-only effects. The two existing receipt tables are extended; no new progression system or native response field is added. Missing legacy CP baselines stay NULL and unavailable/queued; they are never recreated from post-result saves. Overlapping quest labels serialize across these producers until independent native attribution is recovered. Stage clear and CP refresh graphs remain separately ordered, so an uncompleted root cannot prematurely satisfy a pre-clear refresh prerequisite.

Unique owned positive-state flags are required before full mixed ACK. CP and each new unlock observe independently; changed/open/completed prerequisites and all three consulted tracks cannot rewind. Partial saves suppress delivery only in `user_data/push`, retain the real queue, and cancel hot/cached/cold redelivery with3000999. Actual ACK reuses `stage_unlock_floor` and `stage_friendship_floor`, including real saved consulted inactive tracks, within the existing profile/observations/done/queue/sequence/reply transaction. Stale binary pulls now also guard CP/dispatch-only quest flags and ordinary inventory snapshots when no battle receipt exists. No flag/signature/profile precredit, auto-clear or extra reward is issued by this refresh.

New runnable `node tools/test_friendship_unlocks.cjs` is **NOT RUN**: stage/CP-item sources, all three active heroes, locked/absent flags, original threshold/max-inactive-track versus unchanged-active-level behavior, both save orders, missing/foreign/relocked flags, legacy/malformed/drift point/graph receipts, retained queue, hot/cache/cold restart, mixed ACK/floor/observation/reply rollback and permanent rewind/deletion guards. Extended `test_friendship_rewards.cjs` adds a real21000 route's synthetic CP threshold crossing. The existing mixed-ACK convenience helper supplies synthetic unlock flags only for requested ACKs; dedicated negative checks do not use it. Master-data assertions and shared stage/CP/dispatch/item/EXP/save/recovery/Android/launcher suites remain queued, not accepted. Other existing CP suites still need their hand-built ACK saves reviewed against the new proof requirement during the consolidated pass.

The missing direct type2/3 source graph below supersedes that limit; native acceptance remains pending. Still incomplete: first-entry bootstrap, type4 unit-story unlocks, type16 cross-episode/event-clock refresh, other modes/conditions, daily-clear reset/proof, CP stat and received-reward flags, completion/unlock achievement propagation, original CP earning/drop/party validation, independent attribution, native signatures/dirty/event-save order, legacy reconciliation, usable back/recovery, no-crash/ANR and performance. Source/syntax checks are not playable or full feature coverage. Counts96 partial/73 unsupported/zero complete; actual save/listener/APK/MuMu unchanged, no workers/Actions, co-op last.

## Character quest/story clear progression (types2/3)

SOURCE ONLY; functional/synthetic/native checks **DEFERRED / NOT RUN**. Reuses original SHA and the successfully completed FDE-bound `2451924:24528e0` extraction in `.work/stage-clear-xp-exact-20261006.txt`, plus the identity/condition5/three-track-level evidence above. No native job, listener, build/install, player DB or emulator test was run for this follow-up.

The existing graph now handles all288 type2 quest and96 type3 character-story stages. Both are normal-difficulty-only and use the authored CP threshold. A normal kind51 direct successor opens1; it does **not** auto-clear, increment counters or grant its Iris. Only after every current normal stage is4 can the next authored episode's first eligible normal node open. The original callback explicitly treats a NULL `248066c` next-difficulty result as an empty collection. Previously unconditionally requiring difficulty2 would have made a completed character quest/story fail; the shared graph now visits a next difficulty only when that original collection exists, preserving current main/type16/type17 behavior and their hash construction.

The same `stage_delivery.story_progression` captures actual owned three-track CP before points and original character-level hash, alongside original identity/grouping/threshold/episode hash and consulted stage state/count/date/absence. This capture exists even if the stage has no CP reward. Receipt recomputation uses those issuance points, not today's already-mutated save. Operation CP targets replace their captured active-track before points **before** computing the MAX of all three hero levels. Separately captured CP-refresh opens seed the clear graph once; the refresh still runs against pre-clear stage state and must not falsely see root4. The two captures must agree on their shared three-track baseline. A higher inactive hero level can satisfy a successor; unchanged-active-level behavior still controls the separate refresh.

No native flags/CP/signatures/profile are precredited, no extra wire field or schema is added, and no legacy baseline is guessed after an interrupted result. Overlapping root/CP quest labels and covered clear results retain the existing serialization boundary. Missing/corrupt/original-drift captures remain queued/unavailable. Actual owned CP baselines and consulted completed/open stages cannot rewind while pending; new opens observe independently of root clear, CP, original loot and EXP/SP. Partial saves suppress callback delivery on push only, retain queue/full mixed ACK, and cancel hot/cached/cold replay3000999 rather than repeat additive clear effects.

Actual ACK reuses indexed `stage_unlock_floor`, lifetime `stage_state_floor`, and `stage_friendship_floor` for the real saved consulted hero points, including inactive tracks and packets with no CP reward. These commit with profiles/observations/queue/done/sequence/exact reply. Changed-key checks protect deletion/relock and CP rewind; no lifetime graph/history replay or parallel progression ledger is introduced.

New runnable `node tools/test_character_stage_unlocks.cjs` is **NOT RUN**. Original Bell vectors cover next quest CP3, next story CP9, level8 failing9, inactive-track eligibility, a new CP target before clear without premature refresh, locked/absent successors, open-only/no extra story Iris, full versus missing/foreign/relocked flags, both split-save orders, cold restart/retained queue, malformed/NULL/level-hash/graph/provider drift, original reward/EXP/SP mixed ACK, observation/profile/floor/done/reply rollback, CP/flag rewind/deletion and once-only root rewards/repeat clear. Authored quest episode1->2 requires complete normal episode and threshold8; incomplete episode and CP3 do not open it. A terminal normal-only narrative never asks for invented difficulty2. Helpers supply only item/EXP prerequisites; dedicated negative ACKs never auto-supply graph opens. All defaults/prerequisites/signatures are synthetic, not native progression acceptance.

First-entry bootstrap/quest-state save attribution, type4 condition6, other event/ticket providers and availability, daily counters/reset, achievements, CP stats/received flags/original earning, independent producer order/attribution, signed native lifecycle, legacy recovery/back navigation, no-crash/ANR and performance remain incomplete. No route is newly feature-complete:96 partial/73 unsupported/zero complete; actual save/listener/APK/MuMu unchanged, no workers or GitHub Actions, co-op last.

## Local character first-entry saves

SOURCE ONLY; functional/synthetic/native checks **DEFERRED / NOT RUN**. The original ARM64 SHA-256 was rechecked unchanged: `E49A8CC7991F8946365A28AEBAD605CE566B034826DD4B34A982AB18B38303B3`. Serial, read-only, exact FDE-bound jobs finished with terminal exit0 and successful script/decompile before reading `.work/stage-firstentry-state-producers-exact-20261006.txt`, `stage-firstentry-owned-state-exact-20261006.txt`, `stage-firstentry-user-factory-exact-20261006.txt`, `stage-firstentry-constructor-points-exact-20261006.txt` and `stage-firstentry-user-defaults-exact-20261006.txt`. Reused first-entry label/refresh artifacts above; printed Ghidra addresses subtract0x100000 to obtain these raw boundaries.

`2418d64:2418f04` resolves the original communication character, calls `241ac00:241ae98` with state2, obtains its grouping label and calls `246b840:246bcdc`. The latter considers only the **first episode's first normal stage** of each matching parent, not every normal stage as the separate CP-level refresh does. Original condition5 uses MAX of all three hero levels. Matched type2/3 parents use the non-time-filtered episodeType0 collection; type4 condition6 still fails this directly called base predicate. This is a **local callback/save producer**, not a newly discovered HTTP route, reward or network operation.

`241ae98:241b0d8` lazily creates `UserCommunicationCharacter` through `241e268:241e2b0 ->241e2b0:241e2f4 ->260b124:260b334`, initializes the original communication ID, costume and zero touch counters, and registers it in userdata. Its constructor sets this local table's owner0, characterState1, unselected costume0 and zero join time; the factory does not replace that owner. The row+160 internal mask=-1 is not serialized-signature-default evidence; the earlier UINT32_MAX constructor claim is withdrawn pending separate field/serialization verification. Raw supplied signatures remain unchanged. State2 ensures/selects a costume, updates join time, then publishes the communication-character event before the stage helper. `260b6b0:260b794` and `260b794:260b874` dirty only changed values. `23e7f40:23e7f68 ->23e5afc:23e5cb8` returns CP points0 for each hero when the actual native `UserCharacter` is absent. These recovered defaults are not license to replace a missing earned CP baseline, fabricate signatures or precreate native rows. The latest first-entry costume/voice source checkpoints and still-missing repeated joins/CP refresh/native acceptance are detailed in [the shared acquisition contract](character-acquisition-contract.md).

Fresh absent/state0/1-to2 entries now capture actual owned communication before fields or explicit absence, original identity/graph/level hashes, all consulted stage states or absence, and actual three-track CP points or the separately marked native-absent zero default. A bounded `stage_entry` checkpoint uses the original communication ID primary key. Character state/time/owner and individual new opens observe independently in either save order; an observed partial cannot rewind. Absent CP can remain absent or initialize to unique owned zero points, but unrelated new points or a missing previously acknowledged positive CP floor cannot masquerade as this default. Owner0 acceptance is scoped to `UserCommunicationCharacter`, including the existing shared public-profile reader; other player/CP ownership rules are unchanged. Actual signatures and costume fields are preserved, and costume identity is checked against the original character, not invented.

Completed entries reuse indexed `stage_unlock_floor` with `operation_id=0` **only as a local-source discriminator** plus `entry_character_id`; no operation0 or fake `operation_done` ACK is created. Positive protocol-origin floors still require their real ACK. New opens and consulted positive CP floors commit only with the actual completed save, inside existing profile/checkpoint/sequence/reply rollback. A malformed or missing checkpoint/floor stays unavailable; stored originals are not recaptured from post-save values. Pending entries prevent overlapping CP/quest producers and cold/hot/cached gameplay resumption with3000999 while still accepting finishing pushes. Stale binary communication/stage/CP pulls cannot restore the old snapshot. No native flags, wallet, rewards, CP, signatures or extra response fields are precredited.

New runnable `node tools/test_stage_entry.cjs` is **NOT RUN**. Deferred synthetic vectors cover original first-only/CP thresholds/inactive MAX, locked/absent flags, character-first and flags-first split saves, native-absent CP and zero-owner communication initialization, preserved signature, no CP precreation/operation/loot, malformed capture/before fields, missing or wrong-origin completed floors, restart/login/pull/confirm and stale binary replay, partial removal/rewind, ownership/costume/time rejection, and profile/checkpoint/floor/CP-floor/sequence/reply rollback. Completed flags/consulted positive CP cannot relock/regress; unrelated home touch activity does not replay entry. Repeat shared stage/CP/clear/dispatch/item/save/recovery/public-profile/competitive/Familia/Android/launcher regressions in the consolidated pass. These fixtures do not prove natural native defaults, availability, event order, attribution or signatures.

This supersedes only the previously missing **character first-transition source save path**. Main/tutorial `DomainSystemFlag` to main-adventure label/hero bootstrap remains missing; recovered `1a5893c:1a58bf0`, `23afb0c:23afc3c`, `23afc3c:23afc98`, `23aff6c:23affbc` and `23b086c:23b0a0c` are not a complete mapping. Repeated already-joined state2 callbacks (including same-second nondirty saves), exact default-costume grant/selection/availability order, completed communication-state lifecycle, zero-owner CP initialization, CP stats/received rewards/voices/achievement propagation, type4 and other event providers/windows, daily resets, independent producer attribution, legacy backfill/recovery/back navigation, no-crash/ANR and performance remain incomplete/unverified. Inventory remains96 partial/73 unsupported/zero complete; actual save/listener/APK/MuMu untouched, no workers/Actions, co-op last.

## Main-story part entry flag saves

SOURCE ONLY; all functional/synthetic/native checks **DEFERRED / NOT RUN**. Original SHA-256 unchanged. Serial read-only FDE-bound `.work/stage-main-entry-mapping-exact-20261006.txt` (`246a2f8:246a658`, `245cc70:245ce04`, `2480344:248042c`, `1a57c14:1a57ddc`, `11275ec:1128734`) and `stage-main-entry-flag-exact-20261006.txt` (`1127084:11272e4`, `25ff5c0:25ff6a0`, `23afda0:23afde8`) finished with terminal `NATIVE_EXIT=0` and successful scripts before reading. The earlier lookup-only job lost its terminal status and is not used to claim exit0; its ranges were recovered in the completed mapping job. Printed Ghidra addresses subtract0x100000.

`1a57c14` selects a story-part system-flag label and calls `1a5893c`; this selection is **not the active CP hero**. The latter tests flagValue1, opens that part through `246b35c`, sets flagValue2 and triggers the local root save. Relative ELF relocations resolve the relevant GOT entries to static string objects, not directly to C strings. `11275ec` constructs the part labels. The flag-label initializer `1127084` has Ghidra PIC/unreachable warnings around `__cxa_atexit`; its missing tail is **not** treated as trustworthy decompiled control flow. FDE-bounded original ARM64 disassembly separately proves its actual object/string construction instructions and reads these strings from their original addresses:

| Entry flag | Original flag string / raw address | Main adventure / first normal node |
| --- | --- | --- |
| 91218009 | `system_flag.feature.story_ais_quest` / `34916d5` | `adventure.main.part2`,670100002 /1010000201101 |
| 91218010 | `system_flag.feature.story_lef_quest` / `34916f9` | `adventure.main.part3`,670100003 /1010000301101 |
| 91218014 | `system_flag.feature.story_ryu_quest` / `349171d` | `adventure.main.part4`,670100004 /1010000401101 |
| 91218025 | `system_flag.feature.story_soa_quest` / `3491741` | `adventure.main.part5`,670100005 /1010000501101 |

Flag GOT slots4329da8/4327308/4327a78/4328d40 resolve to objects44866d0/44866e8/4486700/4486718, respectively. Part GOT slots4328d30/4328448/4327758/4329cc0 resolve to4486b50/4486b68/4486b80/4486b98; their constructors use original strings3492185/349219a/34921af/34921c4. Caller selection2/4/5 means Lefiya/Ryu/SoA; the default here is Ais/part2, not Bell/part1. This corrects the earlier unproven hero-based interpretation.

`246a2f8` matches **adventure slot1**, unlike communication grouping slot5. The decoder therefore adds a separate543-row `adventureKeys` map; existing `adventureProgression`, episode/stage/unlock/system-flag exports and their hash construction are unchanged. Before/after SHA-256 comparisons of each of those exports and all148 `sources` records matched. `246b35c` requires adventure type1, takes the first episode in its authored collection, normal difficulty1 and authored stage index1. All four recovered parents have episodeType1, not the time-qualified3/4 filter. Their first normal stages have condition0 and no predecessor/previous episode. Missing native stage rows can have a virtual open getter, but `2451204` obtains actual lazy userdata and sets its real state1; this is not an excuse to replace that actual save with a default. Preowned positive flags do not get another open/clear/reward effect.

Fresh entries now require the **actual saved flag1 baseline** and capture its original owner/value/date, exact key/parent/graph identity and actual first-stage state or absence. A four-identity `stage_main_entry` checkpoint observes the real flag2 and new open separately in either order. `25ff5c0` changes only flagValue and dirty state, not owner or lastUpdatedAt; its first observed save preserves those baseline fields. Consumed flags cannot be removed, transferred or rewound. Existing open/clear prerequisite preservation and unique owned flag proof are reused. The shared merge validates unique positive int32 system-flag IDs for puts and deletes, preventing string IDs or duplicate rows from escaping numeric checkpoint guards; negative vectors are written but unrun. New/changed checkpoint observations only are written; completed/unchanged entries are not rewritten on unrelated saves.

Actual completed saves reuse indexed `stage_unlock_floor` with local operation_id0 plus **exactly one** entry origin (`entry_flag_id` or `entry_character_id`). Positive protocol origins still require the real operation ACK; no operation0 or fake done row is made. Profiles/entry observations/floors/sequence/exact replies share existing transaction rollback. Pending entry versus covered clear producers serialize until independent attribution is recovered. Partial cold/hot/cached reads cancel3000999 while finishing pushes remain accepted; stale binary UserSystemFlag/stage pulls cannot resurrect an old snapshot. Unknown original data, captures or floor origins remain unavailable rather than manufacturing success, flags, timestamps, signatures, CP, loot or wire fields.

New runnable `node tools/test_main_stage_entry.cjs` and extended master/character-entry checks are **NOT RUN**. Synthetic vectors cover all four exact parts independently of current CP hero, locked/absent stages, owner0/local, both split-save orders, pending restart/login/pull/confirm/stale snapshot cancellation, no partial floors/packets/wallet changes, no-op checkpoint update suppression, graph/before/catalog corruption, field order, profile/entry/floor/reply rollback, completed flag/stage deletion or rewind, conflicting floor origins, preowned open/cleared stages and legacy consumed saves without recapture. Fixed the two entry probes' binary-pull checks to inspect status instead of attempting JSON parsing; this was static review, not execution. Repeat all existing chapter/character/CP/EXP/reward/save/public-profile/competitive/Familia/recovery/Android/launcher regressions in the consolidated pass.

This supersedes the missing **four story-part entry mapping/source save paths**, not complete tutorial/bootstrap or native acceptance. Initial Bell/part1 setup, producers that raise an original flag0 to1, unsaved1-to2 transitions without an actual baseline, signed lazy initialization/default-costume/voice/CP-stat/received-reward/achievement event order, independent producer attribution, other modes/type4/event windows/daily reset, legacy reconciliation and a usable partial cold-recovery/back path remain incomplete.3000999 cancellation alone is not proof that interrupted gameplay can resume. No-crash/ANR, natural UI progression and performance are unverified. Counts96 partial/73 unsupported/zero complete; actual player save/listener/APK/MuMu untouched, no workers/Actions, co-op last.

## Original stage-triggered feature enabling (22 rules)

SOURCE ONLY; functional/synthetic/native checks **DEFERRED / NOT RUN**. Original ARM64 SHA-256 remains `E49A8CC7991F8946365A28AEBAD605CE566B034826DD4B34A982AB18B38303B3`. Four serial, read-only, exact FDE-bound jobs ended with `NATIVE_EXIT=0` and successful scripts before their output was read: `.work/story-flag-providers-exact-20261006.txt`, `story-flag-prerequisite-exact-20261006.txt`, `story-flag-catalog-getters-exact-20261006.txt` and `story-flag-user-defaults-exact-20261006.txt`. Printed Ghidra addresses subtract0x100000. The initially selected `1e389cc:1e38ea0` and read-only neighbouring disassembly at16ac148/2aba424 were unrelated bias-conversion mistakes, **not** prerequisite evidence. Correct recovered callees are `1d48dcc:1d48edc`, `15ac148:15ac1c8` and `29ba424:29ba468`. The secure getter has PIC/assertion-tail warnings; its normal return and original FDE-bounded disassembly, plus the explicit `UserAdventureStageState` type string, establish the state getter, not the corrupted assertion tail.

`23af3c0:23af77c` initializes a DomainSystemFlag, reads its actual saved value and only when0 finds the **first original featureLock row whose slot3 matches the flag key**. Its slot2 is the prerequisite stage key. `1d48dcc` matches adventureStage **slot7**, decrypts that row's original ID, then `26a67c4:26a684c` performs a non-creating userdata lookup. Only an actual saved stage state4 enables the flag1. Missing userdata, a virtual stage getter default or an episode index is not a completed prerequisite.

The reused exact `2451924:24528e0` clear callback sets the actual stage4 and publishes achievement events before calling `23b10a8:23b1440` with the stage slot7 key. That manager uses `23b0a70:23b0e74` to obtain **all original matching slot2 rules**, sets only currently0 flags to1, and saves with `FeatureUnlock` when anything changed. Already-positive1/2 flags get no repeated enabling effect. `25ff5c0` changes flagValue/dirty state only, not owner/date. The exact `23afde8:23afe2c ->25ff2f8:25ff404` factory/constructor confirms zero SecureMemory values for the native owner/ID/value/date slots; reused `23af780` initialization sets only ID/default before insertion. A new enabling save must retain owner0/date0, while an existing row retains its captured owner/date. This does not establish later timestamp housekeeping, signatures or save/event coalescing. `29ba424 ->29aca44:29acb38` loads the original `featureLock` file; original string35a9f2d confirms its identity.

The decoder exports the22 original `featureUnlocks` pairs in source order and21,524 `stageKeys` separately. All13,894 authored empty stage keys are retained: archive-wide uniqueness/nonempty validation would have rejected real original data. Native first-match resolution is used; each of the22 referenced keys is unique in this archive. The additional source is `featureLock.enc`, SHA-256 `3dd7567133ab72e9622ec6a8ac8649dd45f4c400fce7e492a3836befb31c9c22`; total original tables149. Before/after hash comparisons confirmed unchanged old148 source records and existing stages/progression/unlock/adventure/flag exports.

| Original prerequisite stage | Enabled original flags |
| --- | --- |
|1010000102110 (`stage_014`)|event_quest, growth_quest, familia, closed_event_shop|
|1010000105111 (`stage_046`)|argo.review_modal, arena, expedition, profile_event_history|
|1010000107110 (`stage_062`)|blacksmith|
|1010000121109 (`stage_210`)|blacksmith_make, blacksmith_remake, blacksmith_enhance, blacksmith_evolve, blacksmith_sublimate|
|1010000114108 (`stage_138`)|story_ais_quest|
|1010000201107 (`main2_201107`)|story_lef_quest|
|1010000116110 (`stage_155`)|extra_sp_boss_quest|
|1010000201101 (`main2_201101`)|hero_choice_ais|
|1010000301101 (`main2_301101`)|hero_choice_lef|
|1010000123113 (`stage_234`)|story_ryu_quest|
|1010000403111 (`main2_403111`)|casino|
|1010000301108 (`main2_301108`)|story_soa_quest|

Fresh stage issuance adds nullable private `stage_delivery.feature_unlocks`, capturing original stage/rule/catalog identity and each actual owned flag before or explicit absence. The recovered clear graph's actual recursive clear effects, not ordinary opens, are included in source order. No field is added to native operation5000 and no flag/stage/date/signature/CP/reward is precredited. Actual zero/local owners and existing dates are preserved; absent native flags must initialize with owner0/date0. Each new flag1 observes independently of clear/EXP/SP/loot/objectives/other opens. Missing flags cannot satisfy ACK; observed flags cannot regress while pending. Already-positive flags preserve their captured owner/date and progress rather than receiving another effect.

Actual mixed ACK creates indexed `feature_unlock_floor` rows by original flag ID, linked to the **real** operation_done/stage_completion/source graph/flag observations. Local lazy initialization instead requires an already-saved actual stage4 and a real saved0-or-absent-to1 flag; its operation reference is NULL, with no invented queue/ACK. At most22 checkpoints are consulted, with no lifetime clear-history scan. Profiles/observations/floors/queue/done/sequence/exact replies use the existing transaction. Earned flags cannot delete, transfer, relock0 or lose their prerequisite; changed-key numeric stage-ID validation joins the existing flag-ID guard to reject string/duplicate identity poisoning. Cold reads validate checkpoint/origin/catalog; cached binary flag pulls cannot restore pre-enabling snapshots, including local-only initialization. Missing legacy stage captures stay NULL/unavailable, not backfilled from post-save flags. Existing four-part entry subsequently consumes an actual persisted ready1 flag through its own separate checkpoint.

New runnable `node tools/test_feature_unlocks.cjs` and extended master assertions are **NOT RUN**. Deferred vectors cover all22 rules/12 prerequisite stages, both flag/clear save orders, actual0 versus absent flag baselines, owner0/local, unchanged wire/profiles at issuance, missing flags before ACK, no partial floors, cold/restart/cache cancellation, flag removal/rewind, malformed/NULL/drift captures, checkpoint/origin corruption, original catalog drift, profile/observation/floor/done/reply rollback, once-only lazy initialization without queue/done, preowned repeat flags, typed stage IDs and wrong owner/date/value. Existing EXP/story convenience supplies only synthetic non-feature prerequisites; dedicated missing-feature checks never auto-supply flags. Completed main-stage and preowned reward-PC fixtures isolate these rules; they are **not** natural progression/earning/unit initialization proof. Review older hand-built stage ACK fixtures against the new feature requirements in the consolidated pass, alongside all chapter/unit/CP/item/EXP/competitive/Familia/save/recovery/Android/launcher checks.

This supersedes the missing22-rule **flag0-to1 source** paths and zero-owner/date constructor gap, not feature-complete APIs or native UI acceptance. Initial Bell/part1 bootstrap, coalesced unsaved0-to1-to2/first chapter entry, other flag producers/consumption or reset lifecycles, later timestamp housekeeping/signatures/dirty-save-event order and achievements remain incomplete or unverified. Legacy checkpoint-loss attribution, independent producer overlap, original combat/CP earning/stats/received flags/costume/voice effects, type4/event/daily providers and a usable partial cold/back recovery path remain gaps. Cancellation is not proof of recovery or playability. Counts96 partial/73 unsupported/zero complete; actual player DB/listener/APK/MuMu untouched, no workers/GitHub Actions, co-op last.

## Coalesced lazy chapter enabling and consumption

SOURCE ONLY, all functional/synthetic/native checks **DEFERRED / NOT RUN**. Serial read-only exact FDE-bound `.work/stage-coalesced-main-entry-exact-20261006.txt` (`1a5893c:1a58bf0`, `23af780:23af8e0`) completed with terminal `NATIVE_EXIT=0` and successful script before reading. Reused original `23af3c0`, `23b086c`, `246b35c` and the zero-owner/date constructor evidence above. No source binary changes or new native hooks.

`23af3c0` can enable an actual zero/absent flag to1 from the original **already-saved** stage4 without a root-save call. `1a5893c` obtains that DomainSystemFlag through `23b086c`, tests1, opens the selected part's first normal stage through `246b35c`, sets2 and then calls the root save. Therefore a persisted intermediate flag1 is not required to represent this specific lazy-initialization/consumption chain. `23af780` creates only ID/default on an absent native row; owner/date remain0. This is extracted callback behavior, **not** native notification/save coalescing or UI acceptance.

The same four original Ais/Lefiya/Ryu/SoA flag mappings now accept an explicit first flag2 save from an actual captured flag0 or absence, only with that flag's exact original featureLock prerequisite already saved as state4. `stage_main_entry.enabling_json` privately captures prerequisite identity/state4/catalog hash; `before_json` retains the actual zero/absence, never a fabricated saved flag1. SQL NULL keeps the previous real saved-flag1 path valid; malformed/missing coalesced captures cannot masquerade as that legacy path. New absent flags retain owner0/date0; existing owner/date are unchanged.

Explicit flag2-first and combined saves independently observe the required first-stage open using the existing chapter checkpoint. They also commit the original enabling floor from the actual zero/absence in the same profile/checkpoint/floor/sequence/reply transaction, with NULL feature operation reference and no fake queue/done row. Completed chapter entry requires both flag2 and its actual open, plus a retained enabling checkpoint/prerequisite. A stage-only save while the flag is zero/absent is **not** attributed to chapter consumption: it may be generic lazy initialization. Its later explicit flag2 save uses the actual already-open stage without inventing an earlier entry callback/open floor. This avoids creating a pending chapter lock for an unrelated initialization save.

Cold/restart/cache and actual earned-feature guards are reused. Captured flag2 cannot delete, transfer or rewind; the actual prerequisite cannot be removed/relocked. A captured already-open/cleared first stage is preserved after completion even when no new open effect/floor was emitted; this also fixes the existing real-saved-flag1 preowned-node path. Missing original source/catalog/floor proof stays unavailable, not backfilled from a consumed flag. No intermediate flag/profile/signature/CP/loot/wallet/wire field is precredited and no new packet route is invented. At most four chapter captures and22 enabling floors remain bounded.

Extended runnable `node tools/test_main_stage_entry.cjs` and adjusted `test_feature_unlocks.cjs` are **NOT RUN**. New synthetic vectors cover all four mappings, actual0/absence and local/zero owner/date, flag-first/stage-first/combined saves, generic stage-only initialization without a pending lock, no fake saved1/operations/wallet grant, already-saved versus same-push prerequisite, wrong owner/date, profile/entry/feature-floor/open-floor/reply rollback, source/catalog/floor corruption, restart/cold/cached old snapshots and flag/prerequisite deletion/rewind. Earlier real saved-flag1 fixtures remain. Synthetic completed prerequisites are not proof of natural earning/native initialization. Repeat chapter/stage/unit/CP/EXP/item/competitive/Familia/save/recovery/Android/launcher regressions in the consolidated pass.

This supersedes the unsaved0-to1-to2 **lazy, already-saved-prerequisite source path** for these four chapters only. An overlapping pending stage-clear result remains serialized; its unsaved clear/feature/chapter interleaving is not attributed here. Initial Bell/part1/tutorial/gacha bootstrap, other consumed/reset flags, later timestamp/signature/dirty-event/achievement ordering, independent producer overlap, legacy checkpoint-loss attribution, original combat/CP/other effects, type4/event/daily providers and usable partial cold/back recovery remain incomplete/unverified. The additional completed read-only lookup artifact `stage-bell-adventure-lookup-exact-20261006.txt` covers generic adventure lookup/UI functions, not a recovered Bell-specific bootstrap; its unreachable-block warnings are not trusted evidence. Counts96 partial/73 unsupported/zero complete. Actual player DB/listener/APK/MuMu untouched, no workers/Actions; co-op last.

## Current: preowned guest-stage duplicate bonds

SOURCE ONLY; all functional, synthetic and emulator checks **DEFERRED / NOT RUN**. This supersedes historical matching/temporary-guest rejection and unmaterialized catalog statements only for the already-saved joined guest duplicate path. The current original master contains both guest catalogs. No archive/master/APK edits are part of this change.

Original stage `1090002001108` awards Ein `1012030009`; `1090002701102` awards Chloe `1011041002`, each type50 quantity1. Native `246c874..246c8cc` invokes `22ec100`; duplicate success branches to `246cb24..246cbf0`, resolves original `pc.slot8` through personal-bond metadata, and grants exactly one bond. The recovered predicate requires saved joined ownership and, for temporary guests, the original inclusive-start/exclusive-end window. Permanent guests skip that window. Unlike CP lookup `22eba54`, it does **not** use the `2170c3c` positive saved-adventure override. Shared window validation is reused without merging these different eligibility rules.

Read-only exact-FDE acquisition artifact `.work/stage-guest-acquisition-exact-20261006.txt` (`22ebbbc:22ec100`) completed with exit0 and discarded analysis changes before reading. Bounded original ASM verifies duplicate predicate `22ec100:22ec21c` and the stage branches above; decompiler addresses are normalized by subtracting the Ghidra image base `0x100000`. Original ELF SHA-256 remains `e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`. Failed duplicate eligibility enters the different fresh/reacquisition initializer `22ebbbc`; it is not safely equivalent to permanent acquisition or another bond.

The existing stage completion handler now accepts eligible preowned guests. Existing `pc_targets.guest` privately captures their actual zero/local guest owner, guest EXP, issuance event time and guest-catalog hash alongside existing saved PC/boards and exact duplicate-bond acquisition proof. Non-guest capture format stays unchanged. Guest-bearing legacy receipts missing that original metadata remain queued/unavailable; no post-award reconstruction is attempted. No guest/unit/inventory/clear/XP/signature is precredited, and native wire fields, SQL schema and reward quantities are unchanged.

Pending saves preserve captured guest identity/EXP and owned joined unit/boards. Clear and bond effects still observe independently; full mixed clear/EXP/item/other obligations must be saved before real ACK. An untouched callback cannot redeliver when its temporary window expires. Once real stage effects are observed, existing push-only suppression retains the queue and original capture across expiry and restart, allowing the owed bond and clear to finish without reclassifying eligibility. Hot/cached/cold callbacks remain unavailable until ACK; cancellation is not proof of usable native recovery.

A duplicate temporary guest awards a **bond, not permanent ownership**. Actual ACK records the existing bond cumulative-acquisition and stage-clear floors but does not create a permanent `gift_pc_floor` for a captured temporary guest. Existing independently earned floors are never deleted. Captured permanent guests retain the previous unit/board minimum. This avoids making later temporary unjoining/removal impossible solely because a bond was earned; it does not implement guest expiration/reset or permanently earned guest EXP checkpoints.

Extended runnable `node tools/test_stage_units.cjs` is **NOT RUN**. Original stage/guest/window identities are used, with explicitly synthetic preowned stats, boards and prerequisites. Deferred vectors cover both guests, start-1/start/end-1/end, no positive-adventure override, permanent marker, missing/unjoined ownership, early ACK, malformed/missing guest captures, owner/EXP regression/deletion, both split orders and expiry, untouched hot/cached/cold expiry, observation/done/reply rollback, spendable stock with retained acquisition, no temporary permanent floor, permanent unit floor and repeat without remint. Older ordinary-PC probes now distinguish invalid duplicate guest rows from valid unrelated rows; pending permanent guest EXP regression is a save-validation rejection.

Fresh/expired/unjoined guest acquisition and reset, natural guest EXP/permanence/lifecycle, native initialization/signatures/effect-save-ACK timing, independent producer overlap, legacy reconciliation, usable cold/back recovery, rendering, crashes/ANRs and performance remain incomplete or unverified. Current coverage remains175 routes:107 partial,68 unsupported, zero complete. Actual player DB/listener/APK/MuMu untouched; no workers or GitHub Actions; co-op last.

## Current: fresh guest-stage acquisition

SOURCE ONLY; all functional/synthetic/emulator checks **DEFERRED / NOT RUN**. This extends the existing-row-only scope above for an original guest with **absent unit, boards and guest record**, during its authored event window. Retained guest EXP, orphan boards, unjoined/expired existing units and completed ownership floors are not guessed into a reset.

Serial read-only exact artifact `.work/stage-fresh-guest-construction-exact-20261006.txt` completed with exit0 and discarded analysis changes before reading. It covers `22d8de8:22d98f0`, `285c7e0:285c8b0`, `20b72d4:20b7410`, `26f19fc:26f1c28`. Bounded raw ASM `22d9550..22d966c` verifies the constructor's absent guest branch: original exact-PC lookup `26a82cc`, factory `22e7a8c`, zero-EXP constructor `285c7e0`, owner setter `285c8b0`, PC-ID setter `285c98c`, unique guest registration `26f19fc`, then DomainGuest `22d8128`. The owner comes from `20bad50(0)` / `20b72d4`, whose original binary string is `user/game_user_id`; it is the cached local game-user ID, **not a guessed zero owner**. Raw stage initializer registration is `26b1fb4` for UserPC; decompiler prefixes must be normalized exactly. Original ELF hash remains unchanged.

The shared stage handler now records private `guest.initial=true` with expected local owner, zero guest EXP, issuance event time and original catalog hash. Existing preowned guest format is unchanged. Fresh acquisition issues the original gained PC, not a duplicate bond. Native UserPC, boards, GuestEvent, character, wardrobe, health, clear, XP and signatures are still created/saved by the client, never precredited by issuance. SQL schema and native packet shape are unchanged. Legacy/malformed initial metadata stays queued unavailable rather than reconstructed from post-save state.

The new guest row observes as its own `guest:<pcId>` effect, independently of unit/boards/character/wardrobe/clear/XP/CP. Missing halves may arrive in separate saves; observed guest state cannot be removed or transferred. Real mixed ACK requires the initialized guest record as well as existing acquisition/reward proof. Partial push suppression, cold/cached cancellation, exact receipts and transactional profile/observation/done/reply rollback are reused. Temporary acquisition does not create a permanent PC floor; initial costume and linked voice floors are nevertheless retained through the existing independent wardrobe ledger.

Fresh matching CP refills use the same original initial stat projection as ordinary acquired units, plus the privately anticipated initialized GuestEvent and actual event/adventure runtime. These are validation inputs, not native rows. All three hero tracks reuse the saved CP/stat provider. Before initialization, absent planned guest state is permitted for eligibility lookup, but it cannot satisfy mixed/refill ACK. Unit-first and guest-first saves both remain possible; missing required HP/MP and altered growth/roster/gear/owner/CP/runtime still reject. This does not infer a missing native character row or its lazy CP constructor; that shared gap remains unavailable.

Extended runnable `node tools/test_stage_units.cjs` is **NOT RUN**. Both original stage/guest identities are used with explicit synthetic row shells/prerequisites. New vectors cover no CP/all three heroes, unit/guest/clear/CP-first saves, no issuance precredit or duplicate bond, retained guest/orphan board refusal, missing/wrong initialized guest, corrupted/missing initial metadata, independent guest observation/deletion, early ACK, observation/done/reply rollback, restart, untouched cached/cold expiry, temporary unjoining and retained costume floors. Existing ordinary/permanent/preowned duplicate checks remain queued, along with shared CP/stat/voice/wardrobe/XP/item/save/clock/recovery/Android/launcher regressions.

Native complete initialization/defaults/signatures, natural earning/availability, actual stat/health/effect-save-ACK/callback order, visual recovery/navigation, crashes/ANRs and performance are unverified. Guest reacquisition/reset and EXP/permanence lifecycle, missing-character lazy CP initialization, independent acquired communication-character floors, legacy reconciliation and independent producers remain incomplete. Coverage remains175 routes:107 partial/68 unsupported/zero complete. Actual player DB/listener/APK/MuMu untouched; archive/master unchanged; no workers or GitHub Actions; co-op last.

## Current: absent unit with retained guest progress

SOURCE ONLY; all functional/synthetic/emulator checks **DEFERRED / NOT RUN**. This extends the fresh acquisition path for an **absent UserPC and absent UserPCJobSet**, with an actual retained original GuestEvent. It is not in-place replacement/reset of an existing unit.

Serial read-only exact `.work/guest-reacquisition-register-exact-20261006.txt` completed with exit0 and discarded analysis changes before reading. `26b1fb4:26b21d8` registers UserPC by protected PC-ID getter at `+0x30`; an existing map entry takes the duplicate assertion instead of replacing it. `22dc28c:22dc4ec` performs joining. The previously extracted constructor's bounded `22d957c..22d965c` branch only initializes/registers GuestEvent when the exact-PC lookup is absent. An existing guest row bypasses those setters and is passed directly to DomainGuest: original owner and EXP are **reused, not reset to zero**. This is original client behavior, not inferred publisher-service reset policy.

Stage capture now distinguishes preowned units (unchanged metadata), fully fresh guest initialization (`initial:true`), and a fresh unit with retained GuestEvent (`restored:true`). The latter captures the actual zero/local guest owner and EXP. Temporary retained guests require their original event window; original permanent markers permit initialization outside it. Missing unit/boards remain mandatory; orphan boards, duplicate/foreign/malformed guest state, existing unjoined units and previous permanent ownership floors cannot be guessed into replacement. No native state, signature, wallet, bond or wire field is precredited; SQL schema is unchanged.

Retained guest owner/EXP/presence must survive every pending save. The native constructor does not create or dirty that already-present row, so an unchanged guest-only delta does **not** become a new effect or ACK. New unit/boards/character/wardrobe/clear/XP/CP obligations remain independent and mandatory. Partial suppression, untouched temporary-expiry cancellation, hot/cached/cold receipt checks and atomic rollback are reused. Captured temporary units still receive no permanent PC floor; captured permanent units retain the existing one. Original guest EXP/permanence lifecycle floors remain a separate gap.

Matching fresh-unit CP refills now capture the **actual retained** GuestEvent instead of forcing a zero-EXP initializer. Stage receipt validation also binds the CP input's exact owner/PC/EXP to its acquisition guest capture; a separately mutated but structurally valid zero-EXP shadow is unavailable. The same native initial regular-PC stat provider, saved three hero tracks, guest eligibility rules, split health saves and full mixed ACK are retained. A present retained guest row needs no invented dirty save.

Expanded runnable `node tools/test_stage_units.cjs` is **NOT RUN**. Both original guests now queue fully fresh, retained temporary and retained permanent cases; zero/local retained owner; no CP/all three heroes; unit/guest/clear/CP-first; unchanged retained guest without observation/ACK; absent versus retained row requirements; owner/EXP deletion/regression; corrupt/missing/conflicting role metadata and CP shadow; orphan/ambiguous-state refusal; no bond/reset/precredit; outside-window permanent initialization; hot/cached/cold expiry/restart; observation/done/reply rollback; full mixed ACK; temporary/permanent unit floors and independent costume floors. Prerequisites, unit fields, CP and saved guest progress are explicit synthetic inputs, not natural earning or native default/signature proof.

Native lifecycle removal/rejoin triggers, in-place reset, earned guest EXP/permanence floors, missing-character lazy CP initialization, independent acquired-character floor, original natural availability/earning/defaults/signatures/effect-save-ACK/UI/recovery/navigation, crashes/ANRs and performance remain incomplete or unverified. Coverage remains175 routes:107 partial/68 unsupported/zero complete. Actual player DB/listener/APK/MuMu and archive/master untouched; no workers/GitHub Actions; co-op last.

## Current: acknowledged permanent guest progress

SOURCE ONLY; all functional/synthetic/emulator checks **DEFERRED / NOT RUN**. This closes the post-ACK guest-progress gap for a stage acquisition or duplicate whose **captured** original guest is already permanent. It does not implement natural guest EXP earning or promotion. Original `22d8218`/`22d83c4` classification, typed `UserGuestEvent` owner/PC/long EXP, the two original guest groups and marker15 level data are reused; no new native extraction or publisher-service behavior is claimed.

Real mixed stage ACK now records optional exact `{userId,pcId,totalExp}` in the existing indexed `gift_pc_floor.targets` JSON alongside unit/boards/character/wardrobe minima. It records the actual private issuance snapshot, not a guessed permanent threshold or today's post-save progress. No SQL schema, native wire/signature/profile or reward quantity changes. Temporary captures still create no permanent unit/guest floor, even if unrelated guest EXP later changes; independent wardrobe floors and prior independently earned unit floors remain intact.

The shared target validator and floor merger preserve guest owner and the maximum **captured** EXP across later unit rewards, including producers whose new target has no guest field. Guest-only put/delete deltas now reach the same indexed completed-PC guard as unit and board updates. A permanent checkpoint requires an actual unique guest row, its captured zero/local owner and at least its captured EXP. Later typed long EXP gains are permitted; ordinary saves do not manufacture a new earning checkpoint. Metadata conflicts, removal, transfer and rewind reject atomically rather than silently degrading permanent ownership.

Cold guest reads validate nested guest metadata through bounded original guest-catalog/indexed floor lookups, not a lifetime receipt scan. Shared login/confirm handoffs reuse that read guard. Retained unit floors independently enable cached native-pull freshness checks, and cached guest-save replies must retain current table tokens. Damaged metadata or already-corrupt raw guest profiles remain unavailable with actual save/receipts retained; this is preservation and cancellation, **not automatic repair or proven usable native recovery**. Legacy unit floors without guest metadata remain readable and are never backfilled from current rows.

Cached confirmation also compares the actual GuestEvent token; unchanged character-present tokens cannot hide later valid guest EXP saves. A cold-restart cached-confirm vector joins the binary-pull/save-reply vectors below, still **DEFERRED / NOT RUN**.

Extended runnable `node tools/test_stage_units.cjs` is **NOT RUN**. Queued cases cover both original guests, permanent preowned and absent-unit acquisition, zero/local owner, full ACK without an invented guest dirty save, Guest-only rewind/transfer/deletion, long EXP gains, restart, stale binary pull/save reply, malformed nested metadata, raw profile corruption with cold login/confirm/pull, legacy no backfill, a synthetic later Present merge without guest metadata and floor insert/update/ACK/reply rollback. Synthetic saved progress and Present provenance are explicit probes, not proof of native defaults or natural earning. Existing temporary, CP, wardrobe, item, XP, signature, clock, recovery and Android/launcher checks remain queued.

Independent guest EXP producers/promotion floors, legacy lost-checkpoint reconciliation, expiration/removal/rejoin/reset lifecycle, missing-character CP and independent acquired-character floor remain incomplete. Native effect/save/ACK ordering, signatures, UI/navigation/recovery, crashes/ANRs and performance are unverified. Coverage remains175 routes:107 partial/68 unsupported/zero complete. Actual player DB/listener/APK/MuMu and original archive/master untouched; no workers/GitHub Actions; co-op last.

## Current: lazy character initialization before CP

SOURCE ONLY; functional/synthetic/emulator checks **DEFERRED / NOT RUN**. This extends stage completion and explicit CP completion for a genuinely absent original `UserCharacter`. It supersedes the missing-character CP refusal above, not proof of natural CP earning, complete gameplay or native UI acceptance.

Serial read-only `.work/cp-lazy-character-init-readonly-20261006.txt` completed with exit0 and discarded project changes before reading. Exact FDE ranges are `23e5a2c:23e5afc`, `23e5afc:23e5cb8`, `2608c70:2608e80`, `22e7678:22e76c0`, `26c4984:26c4ba8`. Bounded original ASM `22e76c0:22e7704` and `23e57bc:23e5910` confirms the factory calls the original constructor, assigns original character ID, retains owner0, sets state1 and registers by exact character ID. `23e5afc` returns0 for an absent row; `23e6b08` subsequently calls lazy `23e57bc` before its active-hero CP setter. Constructor CP offsets `+0x58/+0xd0/+0xf8` are zero. Decompiler addresses subtract `0x100000`; no native binary/APK edits.

The shared CP baseline now uses a private zero-owner/state1/three-zero-track projection only when actual native character state is absent. Existing acknowledged CP floors or captured unit-character owner/state/track minima cannot be reset into that role. Actual existing rows retain their prior capture format. Optional private `initial:true` binds the before-capture, refill character input and matching fresh stage-PC character acquisition; missing/conflicting role metadata remains unavailable rather than inferred from post-save rows. No profile, signature, wallet, CP field or wire row is precredited by that projection.

Constructor-row presence observes separately from gained CP, HP/MP refill, unit/boards/guest/character joining, wardrobe/voices, clear, quests, XP and inventory. Unobserved absence remains possible during split saves; a saved initializer must retain owner0, native initialized/joined state, typed points and untouched other hero tracks, and cannot later disappear. Full mixed ACK requires the actual unique row and all existing obligations. A same-level or zero-CP callback does not invent a stat refill but still requires its actual constructor row. Character/CP/health saves may arrive independently; existing guest clock/runtime, stat-input and save-order guards remain.

Real ACK reuses `stage_friendship_floor` to preserve zero CP as proof of initialized-row presence. Cold character reads validate the bounded original-character/three-hero floor set, preventing missing/rewound/corrupt earned CP from silently returning as an empty native table. Selected-character baseline checks also reuse indexed retained unit-character receipts. No new table/schema or lifetime reward scan. Existing transactions include native profiles, observations, floors, done/queue, sequence and exact reply. Cancellation preserves data; usable native cold/back recovery is not established.

Expanded runnable `test_friendship_refills.cjs` and `test_stage_units.cjs` are **NOT RUN**. Queued checks cover plain/CP-item/stage sources and all heroes; constructor/health/CP/clear/unit/guest-first; zero CP/unchanged-level no refill; owner/state/other-track mismatch; observed row deletion; missing role metadata; full mixed ACK; retained earned-character loss; both original guest acquisitions with absent character; floor/observation/done/reply rollback; restart and cold raw-profile loss with retained receipts. Fixture row shells, prerequisites, CP gains and signatures are explicit synthetic probes, not native defaults or natural earning proof.

Dispatch's absent-character party/stat/completion integration is now extended in `friendship-reward-contract.md`; native acceptance remains pending. Independent acquired-character floors not paired with these existing receipts, natural CP/guest earning, independent producer overlap and legacy lost-checkpoint reconciliation remain incomplete. Native full defaults, stats, signatures, effect/save/ACK/callback timing, actual navigation/recovery, no-crash/no-ANR and performance remain unverified. Coverage175 routes:107 partial/68 unsupported/zero complete. Actual player DB/listener/APK/MuMu and original master/archive untouched; no workers or GitHub Actions, co-op last.
