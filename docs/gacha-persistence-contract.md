# Gacha characters, absolute bonds and tutorial completion

## Static local-notice cache integrity — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-14)

`notice/promotion/show` and `notice/anime/get` now use one shared empty-request
validator and local response builder for both fresh delivery and exact cached
replay. An old promotion response must still equal the bundled offline notice;
an anime response must still equal the listener-local notice URL. Altered HTML,
obsolete URLs and wrong content types recover with 3000999 instead of being
trusted from `reply_cache`. The cache path validates the received bytes, so a
matching caller-supplied hash header cannot disguise a nonempty request body.
Rejection leaves profiles, operations, sequence and reply evidence unchanged.

Deferred notice cases cover unchanged exact replay for both routes, altered
promotion HTML and a spoofed-hash nonempty anime request. WRITTEN ONLY / NONE
RUN. Native automatic-news entry, WebView display/close/back, performance and no
crash/freeze/ANR remain unverified. No checks, builds, listener, APK, ADB,
emulator, workers or Actions ran; 176 partial / 0 unsupported / 0 verified
complete.

## Details-page cache revalidation — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-14)

Fresh and exact cached `notice/show` requests now share one renderer for all
five accepted selectors: gacha, scratch, pack, event box and Lotto. For the four
non-Lotto forms, an exact cached request rebuilds the current original-data page
and returns it only when the JSON bytes still match. Gacha details consequently
recheck the unique locally owned `UserLottery` row, button counts/loops/steps,
the selected JST day's durable daily claim and the event clock. An old page
cannot hide a draw, daily reset or calendar transition. Scratch, pack and event
box pages similarly remain tied to their current recovered catalog projection.

A mismatch uses recovery 3000999 and does not rewrite the profile, wallet,
operation queue or cached reply. Lotto deliberately retains its existing
durable snapshot rule: an exact identity revalidates the event and ticket proof
but returns its historical page bytes, since those bytes are the retained
details receipt rather than a live gacha-state view.

Deferred `test_notices.cjs` cases cover byte-identical stable replay for gacha,
scratch, pack and event box, plus stale gacha recovery after valid saved draw
progress with a byte-for-byte persistence snapshot. They are WRITTEN ONLY /
NONE RUN. Native WebView display, close/back behavior, real event-clock changes,
performance and no crash/freeze/ANR remain unverified. No checks, builds,
listener, APK, ADB, emulator, workers or Actions ran; 176 partial / 0 unsupported
/ 0 verified complete.

## Authoritative lottery button identity — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-14)

`issueDraw` commits the exact post-draw `UserLottery` row before returning the
signed operation. Its permanent schedule receipt separately binds the selected
button's count, timestamp, loop, step and optional JST day. The observed native
`LotteryDraw` save retained that issued count and timestamp. A global pending
draw also prevents another button purchase, while selected-day projection keeps
the pending banner frozen until its real acknowledgement. There is consequently
no evidenced newer pending button row to project.

When `user_data/push` includes `UserLottery` for a pending operation1000 with a
schedule receipt, the selected button must now equal that exact captured
post-draw row. A same-count save can no longer move `lastPickedAt` to another
day or rewrite `loopCount`/`currentStepIndex` before ACK. Existing whole-row
shape, authored limit, count and step guards still run first; legacy live queues
without a schedule capture retain their older bounded behavior. The profile,
wallet, receipt, queue and ACK all roll back on refusal. No progress, reset or
operation is manufactured, and row-level `isNew` handling is not broadened.

The same authoritative rule now covers every retained button after ACK. The
server already owns the saved row before the native callback: a fresh draw
prewrites its post-draw values, the event-clock projector performs daily reset
server-side, and original `userPickedCount` computes an in-process daily zero
without writing a replacement. A delayed same-count table save may therefore
repeat the exact timestamp/loop/step but cannot rewind or advance those fields.
This also prevents a zeroed `lastPickedAt` from reopening linked button-one
scratch eligibility. Newly introduced zero/default buttons, imported rows,
unknown historical banner IDs and the boolean display badge remain governed by
their existing validation; this change does not invent their history.

Deferred regular and daily cases rewrite only timestamp/loop/step while keeping
the issued count before and after ACK, and assert exact delayed-save acceptance,
atomic refusal and the unchanged real ACK.
They are WRITTEN ONLY / NONE RUN. Other native dirty-table orders, legacy queues,
event-clock crossings, UI/performance and no-crash/no-freeze acceptance remain
unverified. No tests, static checks, builds, listener, APK, ADB, emulator,
workers or Actions ran; 176 partial / 0 unsupported / 0 verified complete.

## Untouched duplicate-bond setter spend guard — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-14)

Original `22f0514:22f0560` applies a duplicate Personal Bond as an absolute
stock setter before adding its actual stock difference to lifetime acquisition.
While that signed operation is pending, a native character-enhancement save can
legitimately lower the same owned stock. If no field from the absolute setter
was saved first, treating that lower stock as a draw effect makes the receipt
ambiguous and a later replay can restore the spent bond.

The shared `UserLimitBreakItem` save planner now rejects only that ordering: an
unobserved operation1000/1001 setter cannot accept a stock value below the
durable pre-draw row. The queued draw, captured baseline, profile, wallet and
receipt remain unchanged. Once any real setter effect has been observed, the
existing bounded stock/lifetime/signature logic still permits later spending,
including first-save spending after the issued cumulative value or signature.
Completed draw floors and unrelated bond rows retain their existing rules. No
inventory, signature, lifetime, unit, queue or ACK is prewritten.

Deferred cases cover every positive-stock saturation baseline for regular1,
regular11 and tutorial1 draws, proving the untouched lower-stock delta rolls
back without changing the receipt and that the original operation can still be
saved afterward. They are WRITTEN ONLY / NONE RUN. Natural enhancement packets,
native dirty-table ordering, callback/recovery UI, performance and no-crash/
no-freeze acceptance remain unverified. Legacy queues already made ambiguous by
an earlier build are retained unavailable rather than repaired by guessing.
No tests, static checks, builds, listener, APK, ADB, emulator, workers or Actions
ran; 176 partial / 0 unsupported / 0 verified complete.

## Live regular/tutorial receipt replay — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-12)

The existing ARM64 local stage-receipt guard now admits regular1000 and
tutorial1001 as well. Pristine22efdc0 and22f2088 call acquisition22f0170
before their callbacks return; tutorial210c270 applies gacha_end before its
return. Processor206a408 records the completed invocation only afterward,
and its exception path206a6a4 resumes unwinding without recording that callback.
An interrupted acquisition therefore does not gain a receipt from this guard.

At206a360 the shared240-byte source guard requires the same positive operation
ID, actual incoming/cached type, signature, token and freshly computed original
verifier. The unsigned1000..1001 range cannot admit adjacent/negative/other
types; a1000 receipt cannot match1001. Only this live matching proof suppresses
a second acquisition callback. Existing signing, result/popup dispatch,
initializer recovery, bond/cost/result/counter/flag fields, save and real ACK
remain original. Server push now clears only actual committed ACK IDs; a
save-only fragment does not discard local pending receipts. No receipt, unit,
board, bond, tutorial flag, ownership, currency or ACK is manufactured.

Deferred native span/branch/type/frame/argument/signature/string/fallback and
original regular/tutorial entry-point checks are WRITTEN ONLY / NONE RUN.
Consolidated native acceptance must cover repeated exact/derived draws before
upload/after save-only, missing or changed receipt proof, distinct IDs,
cross-type attempts, interrupted constructors, account/clock/import/cold restart
and real tutorial flag/save/ACK order. This is not lost-journal recovery or
proof that a returned native callback saved every effect. Other handler clock
conditions are deliberately not inferred. Native dirty/cache/UI/exception/ABI
behavior remains unverified; no patcher execution, tests/static acceptance,
build/install/listener/emulator/workers/Actions. Counts173 partial/3 unsupported/
0 verified complete across176, co-op last.

## Existing owned unit with unfinished outfit/story unlocks — SOURCE ONLY / UNTESTED (2026-10-12)

The pristine22ebbbc constructor reads original PC master slot76 through
139c3ac(field9c,default0). A positive ID calls the costume singleton2504c48
and2505fc4, then adventure singleton2469080 and2473d9c with the original PC
key. The costume helper's2507b58 predicate grants only absent/locked state1;
2507bc4 opens it before conditional linked voices. The story helper rechecks
the real PC's same costume and2450ef4/2451204 opens only exact authored state0.
Already-open state2/3 costumes and nonzero stories are not reset or granted
again. Neither helper recreates the PC or changes its saved EXP/job progress.

Shared recovery now derives offlinePcConstructorRecovery:1 for a captured
first, valid owned unit with missing constructor outfit/story effects. Saved
guest effects must already be complete, board data must be valid or eligible
for the separate missing-set getter, and a completed gift_pc_floor forbids
repairing lost constructor data as a fresh acquisition. An unfinished outfit
with captured linked voices remains guarded: an already-owned outfit skips
its voice loop, so missing voices cannot be inferred to recover. All346 initial
outfits in the current original archive have no linked voices. Native character
refresh may remain pending. Actual rows/tokens/receipts/queue/wallet/results/
cost/signature/flags stay untouched by projection; only incomplete deliveries
carry a marker. Cached exact markers rebind to the immutable original through
actual unlock/board/character completion. Native saves reject either marker.

The ARM64 patcher source now routes only22f024c first through224 bytes at
153fa00, then through the unchanged independent153f900 board guard. Null PC
lookup keeps the original constructor. An existing native kind1 plus exact
signed/unsigned JSON int64 constructor marker1 calls only the original slot76
outfit/story helpers, preserving their manager/ID/PC-key arguments, all live
caller state and the original conditional setters and cleanup. Default0
costume skips both helpers, as in the original constructor. Board getter,
character/bond/save/ACK remain original and independently guarded. No callback,
inventory, outfit/story flag, new grant or automatic ACK is manufactured.

Pending draw save selection also includes UserAdventureStage/UserGuestEvent,
so a story-only delta reaches the same before/candidate effect guards and
actual completed-unit floor transaction. A saved story cannot be relocked by
a later pending delta just because that delta did not include UserPC. The
original full acquisition, tutorial gacha_end and real ACK remain mandatory.

24 additional test_gacha_unit_recovery.cjs cases are WRITTEN ONLY / NONE RUN:
1000/1001 × boards ready/missing × character ready/pending × neither/outfit/
story prefix. Cases retain original unit progress, initialized board bits,
advanced outfit/story3, receipt/queue/wallet/results; require pure projection,
strict/duplicate/cross-unit marker rejection, no saved hints or initializer
rewind, login/confirm/binary pull/restart, actual remaining unlock save,
story-relock refusal, stale markers after each completion, five transaction
rollback points, actual board/character/tutorial saves and real ACK. One
additional completed-data-loss case covers outfit and story floors. The old
unit-only rejection is superseded by this recovery matrix; missing original
captures still cancel. The synthetic native serializer drops both hints.
test_client_native_patch.py adds deferred exact constructor-stub spans, JSON/
kind/default gates, slot76/manager/PC-key arguments, branch chain, unchanged
original conditional helper ranges and fingerprint mismatch rejection.

This is source-level recovery only. Missing linked-voice/guest effects, other
coalesced/import/legacy/clock paths and ARMv7 remain unfinished. There is no
added stub unwind metadata; natural native cache/import/exception/lifetime/
dirty/save/ACK ordering, ABI/UI/efficiency/no-crash/no-freeze remain unverified.
No tests/static acceptance/patcher execution/generator/build/install/restart/
emulator/ADB/workers/Actions. Counts173 partial/3 unsupported/0 verified complete
across176; co-op last, full goal active. Older entries are superseded only for
these missing outfit/story and combined missing-board branches.

## Existing owned unit with no saved board set — SOURCE ONLY / UNTESTED (2026-10-12)

Original22f0170 copies each UserPC JSON entry to caller SP28 and looks up the
unit at22f0244. The CBNZ at22f024c bypasses22ebbbc for an existing unit. Both
lookup branches still reach the character refresh at22f02f0; that alone does
not guarantee an owned board getter runs. Original22ded68 reads the saved
currentJobIndex, then22dfe60 resolves the authored normal job and22deee8
reuses or lazily creates its original job set/job. This is not22dd5c8's
limit-break job getter or a fabricated board initializer.

Shared lotteryRecovery now retains the original unit entry with delivery-only
offlinePcBoardRecovery:1 only for a captured first unit that is actually owned
and valid, has its outfit/voice/story/guest constructor effects complete, has
no saved board set, and had no captured board jobs or completed gift_pc_floor.
A previously completed or preowned board set lost from the save is not reset
into a fresh one. Character refresh may still be pending. Projection changes
no profile, token, wallet, receipt, queue, result, cost, signature or flag. An
old derived envelope can bind to the same original after its actual board save
or complete constructor, but arbitrary markers/initializers/omissions cannot.
Incoming native UserPC/UserPCJobSet rows cannot contain the delivery-only key.
Candidate PC saves may not decrease already saved EXP, job index, limit breaks,
hero-ascension level or an unlocked hero-ascension flag during a pending draw.

The ARM64 patcher source redirects only22f024c through a guarded224-byte stub
at153f900. A null lookup takes the unchanged22f0250 constructor. An existing
PC invokes22ded68 only for native kind1 and an exact signed/unsigned JSON int64
marker1; bool/string/float/coercible integers do not qualify. The original
per-row map, live registers, frame/link and temporary shared-job ownership
are preserved. The original character/bond/setter/save/ACK logic remains.
The native getter creates/dirty-marks original missing rows; the server does
not prewrite boards or acknowledge them. The remaining actual acquisition,
tutorial gacha_end flag and real ACK are still required to settle the draw.

Eight additional test_gacha_unit_recovery.cjs cases and an untouched/lost-floor
case are WRITTEN ONLY / NONE RUN:1000/1001 × outfit/no outfit × pending/ready
character; pure derived projection, no precredit/second charge, immutable
receipt/queue/result/wallet, preserved later EXP, malformed/cross-unit/duplicate
markers, forbidden marker saves, incomplete ACK, login/confirm/binary pull and
restart, real normal-board save, stale derived envelopes after board/character
completion, five transaction rollback points and actual tutorial flag/ACK.
test_client_native_patch.py adds deferred stub spans, exact original hook,
arguments/JSON integer/kind gates, branch targets, shared-reference release,
unchanged original getter/constructor/bond ranges and mismatch rejection.

This closes only the source-level existing-unit/missing-board branch. Other
missing constructor effects, coalesced/import/legacy/clock branches and ARMv7
remain unfinished. The new stub has no added unwind metadata; natural native
cache/import/exception/lifetime/dirty/save/ACK order, ABI/UI/efficiency and
no-crash/no-freeze require the consolidated pass. No tests/static acceptance,
patch-generator execution/build/install/restart/emulator/ADB/workers/Actions.
Counts remain173 partial/3 unsupported/0 verified complete across176 routes;
co-op last, full goal active. Older entries below are superseded only here.

## Existing unit with its character unlock saved last — SOURCE ONLY / UNTESTED

Original22f0170 calls22ebbbc only for an absent PC, but both lookup branches
reach the separate character-key lookup and23e79f8/23e6888 refresh. The retained
gacha-acquisition-exact-20261004.txt shows that ordering. Keeping an existing
unit's original entry can therefore finish its missing character row/unlock
without recreating the unit; the state1 predicate still skips unlocked2/3.

Recovery now permits this only after the actual owned unit, owned boards and
all captured outfit/voice/story/guest constructor effects are complete. The
character still must satisfy its captured owner, CP and pre-state baseline.
Only an originally absent row may be lazily created; losing a preowned row
is not repaired by guessing. The entry stays on the wire until the character
target actually saves. Original results/type/identity/token/signature/cost/
counters/queue and real full acquisition/tutorial flag/ACK remain unchanged.
No native row/flag precredit, new schema/quantity or automatic ACK is added.

Eight further test_gacha_unit_recovery.cjs cases are WRITTEN ONLY / NONE RUN:
1000/1001 × outfit/no outfit × originally absent/present character. They
retain the unfinished entry, reject premature omission/ACK, preserve unit/
boards/capture/queue/wallet through projection/login/confirm/restart, require
the actual character save, and exercise five rollback points plus tutorial
flag handling. Existing-unit missing boards/outfit/story/other effects remain
unfinished; this supersedes only character-last cancellation after a complete
constructor. Natural native lookup/refresh/events/cache/dirty/save/ACK, ABI/
UI/efficiency/no-crash/no-freeze remain unverified. No tests/static acceptance/
generator/build/install/restart/emulator/ADB/workers/Actions. Counts173 partial/
3 unsupported/0 verified complete across176; co-op last, full goal active.

## Owned boards saved before an absent unit — SOURCE ONLY / UNTESTED (2026-10-12)

The original owned job getter at22def90 looks up UserPCJobSet through26a71dc.
At22df010:22df014, an existing row branches directly to22df0ec; only a missing
row runs22e71ac, owner/PC-ID assignment and2604e34 initialization.2603ed4 then
looks up the individual job at22df0f4; nonnull22df10c branches to22df2c4,
skipping its new-row constructor.22c93ec/22c97b8 wrap that existing job data
for the native board view. The current-job change22da294:22da330 affects the
fresh PC, not an absolute replacement of its saved board set.

The separate reset22dc040 can remove an owned set. A serial read-only direct
branch scan found its sole direct caller at22dbb2c, outside22ebbbc's fresh
constructor; its removal helper26d48cc is called at22dc174. This is bounded
source evidence, not proof excluding every indirect/native event. Natural
constructor/event/cache ordering still needs the consolidated native pass.

Shared recovery now permits an actually saved, valid owned job-set prefix
while the PC remains absent, independently or combined with the earlier
character/outfit/story prefixes. Existing pcRewardEffects already proves
unique local ownership, original job identities, valid panel masks and the
captured minima. The original complete initializer stays on the wire and the
saved set is not rewritten in SQLite or substituted for unit completion.
Native getters reuse existing rows and may create missing lazy rows. Unit
creation, any remaining character/outfit/story effects, tutorial flag and
actual ACK are still required. Existing-unit/missing components and corrupt,
foreign/unknown job data remain guarded. No new schema, reward, cost, signature,
native profile precredit, migration or automatic ACK is added.

`test_gacha_unit_recovery.cjs` has32 additional WRITTEN ONLY cases:
1000/1001 × empty/initialized-normal owned sets × eight combinations of the
three other prefix tables. They define unchanged saved bits/signatures,
original initializer/capture/queue/wallet retention, no missing-unit omission,
restart/confirm, incomplete ACK refusal, five completion rollback points and
actual remaining constructor/tutorial flag/ACK. The old board-only refusal
fixture now belongs to that recovery matrix; unit-only remains unavailable.
NONE RUN. This supersedes only board-before-absent-unit cancellation, not
existing-unit repairs or all board/gameplay acceptance. Native ABI/UI/event/
cache/dirty/save/ACK/performance/no-crash/no-freeze remain unverified. No tests,
static acceptance, generator/build/install/restart/emulator/ADB/workers/Actions;
counts173 partial/3 unsupported/0 verified complete across176, co-op last.

## Outfit/story saves before the unit — SOURCE ONLY / UNTESTED (2026-10-12)

Original22ebbbc calls2505fc4 for PC slot76's outfit, then2473d9c for its
authored unit story.2505fc4 checks2507b58 before2507bc4: absent/locked state1
is unlocked to2, while saved2/3 skips both the grant and its linked-voice loop.
The retained `gift-costume-add-exact-20261004.txt` and
`gift-costume-state-exact-20261004.txt` show that ordering. Original2473d9c
resolves the exact PC/outfit story and checks2450ef4's closed state0 before
2451204; saved nonzero story states are not reopened or lowered. Exact
`unit-story-costume-lookup-exact-20261007-v2.txt` and
`unit-story-stage-resolution-exact-20261007.txt` supply that lookup/predicate.

Shared per-unit recovery now accepts these actually saved constructor prefixes
while both the PC and its job-set rows remain absent: character row/unlock,
the captured original outfit, the captured original unit story, and their
combinations. It keeps the full original initializer, result list, operation
type/identity/token/signature and queue; it neither treats a prefix as a
complete unit nor creates native rows. Existing ownership/state/CP/story
baseline checks and exact-subset validation remain. Saved outfit2/3 and
nonzero story state are preserved by the original native conditional setters.
The completion/real-ACK predicates are unchanged.

The outfit branch requires no linked voices, matching all346 original PC
slot76 outfits' empty intersection with the archived voice links. It does
not assume a grant of an already-owned outfit can fill a missing linked voice.
Board-first, unit-present/missing constructor components, unknown effects,
corrupt/missing original captures and unrelated source overlaps remain
guarded. Their remaining-effect/import handling is not replaced with an empty
success or inferred completion. Gift2000 behavior is unchanged.

The expanded `test_gacha_unit_recovery.cjs` queues all seven combinations of
the three prefix tables for both1000/1001 (14 source cases), constructor
absence, no initializer omission/precredit/second charge, original receipt
and queue retention, later saved outfit/story3 preservation, restart,
remaining native constructor plus required tutorial flag/actual ACK, and
five save/ACK rollback points per prefix. Existing `test_pc_costumes.cjs`
gacha costume/story-first cases now expect this recovery while gift and
unit-first refusals remain. Deferred database-injection cases distinguish
raw SQLite503 from deliberately structured3000999 recovery; production error
handling is unchanged. ALL WRITTEN ONLY / NONE RUN.

This supersedes only absent-unit outfit/story prefix refusals. Natural native
constructor/event/dirty/save/ACK ordering, client cache/import ordering,
ARMv7 parity, UI, efficiency and no-crash/no-freeze still need consolidated
acceptance. No tests, static acceptance, generator, build, installation,
listener restart, emulator/ADB, workers or Actions ran. Counts173 partial/
3 unsupported/0 verified complete across176; co-op last and full goal active.

## Per-unit interrupted initialization recovery — SOURCE ONLY / UNTESTED (2026-10-12)

Original22f0170 iterates `UserPC`, not the separate `lotteryPCs` result list.
It initializes an absent PC through22ebbbc; character refresh follows both
missing/existing branches. Original23e79f8 lazily reads UserCharacter's byte
state and tests exactly1, before23e6888 sets2. The direct original instruction
ranges23e79f8:23e7a7c,220e470:220e4c0 and23e6888:23e6940 confirm that predicate
and protected setter call. A retained character-only state2 therefore does
not repeat its unlock/event while a still-absent unit is constructed.

The shared recovery helper is now `lotteryRecovery`, retaining the observed
absolute-bond behavior above and classifying every captured first unit:

- A wholly untouched initializer remains in `UserPC` with its original bytes.
- A character-row/unlock-only save remains replayable only while both PC and
  job-set rows are absent; owner/CP/state still satisfy the captured original
  baseline. Unknown or changed constructor effects are not inferred.
- An actually complete unit is omitted from `UserPC` only after the existing
  full ACK predicate proves its owned initialized unit, owned job set, original
  character target and any captured outfit/voices/unit-story/guest effects.
  Existing atomic per-unit floors remain unchanged. Later saved unit progress
  is preserved rather than replaced by an initializer.
- A unit/board/outfit/story partial that fails that complete predicate remains
  unavailable. Original22f0170 skips the missing-PC constructor for an already
  present PC; replaying it is not a repair for absent boards or wardrobe.

Validation errors in these existing saved profiles take503/code3000999
recovery instead of an incoming-packet400. The separate actual-save planner
keeps its original incoming validation and rollback; no malformed saved row
is repaired or discarded to obtain a successful delivery.

Mixed completed and untouched units are projected independently, including
two variants sharing a character whose state1-to2 unlock already saved.
The original `lotteryPCs` order/newness/results are never relabeled. Candidate
initializers must remain an exact ordered subset of the captured original
rows; only proved completed units may be omitted. Changed stats, extra or
duplicate/reordered rows and dropped unfinished units reject. Plural/singular
operations and hot `UserPC`/bond root fields share the derived delivery.
Counter/cost/pool/quantity, operation type/identity/token/signature and queue
remain original; no native unit/board/character/flag is prewritten or migrated.

Regular/ticket/shop character1000 and tutorial1001 retain their original native
handlers. An empty initializer list means actual saved constructor effects,
not an unsupported reward acknowledged with an empty success. Native operation
ACK still needs all remaining acquisition proof.1001 also still requires the
actual original gacha_end tutorial flag; unit completion never substitutes
for it, and its original label dispatcher is unchanged. Save responses keep
suppressing already-applied effects rather than re-entering a callback.

New `test_gacha_unit_recovery.cjs` and changed character-first/bond cases in
`test_gacha_persistence.cjs` are WRITTEN ONLY / NONE RUN: both1000/1001,
with/without an original outfit, complete single-unit omission, later saved
EXP preservation, unchanged queue/wallet/receipts, shared-character mixed
units, exact subset and malformed initializer refusal, missing original
capture, incomplete-unit/board/outfit guards, tutorial-flag requirement,
three real-ACK rollback points, restart and exact ACK replay. Natural native
initialization, tutorial dispatch/ACK timing, UI/signatures/efficiency and
no-crash/no-freeze remain unverified. Other constructor partials still need
their original remaining-effect/import contracts; this is not full gacha
or game-wide completion. No tests, checks, builds, installs, listener restart,
emulator/ADB, workers or Actions ran.173 partial/3 unsupported/0 verified
complete across176; co-op last.

## Observed duplicate-bond delivery after spending — SOURCE ONLY / UNTESTED (2026-10-12)

Original `addDrawedPc`22f0170 reads each absolute bond amount, resolves the
owned/lazy item, calls slot48 with the operation signature, then adds
`newAmount-oldAmount` through slotb0. The exact retained capture at
`.work/gacha-acquisition-exact-20261004.txt` shows that order; its displayed
addresses include Ghidra's100000 bias. Repeating an old target after spending
could therefore restore stock and acquire its difference again. Setting the
actually saved amount instead has a zero stock/lifetime difference.

The existing permanent bond receipt now permits that delivery only when the
native effect was already observed: `effect_saved` and captured `observed`
must agree, one valid owned row must retain the original target cumulative
amount and issued signature, and current stock cannot exceed the captured
target. No observation is inferred from a matching balance. Partial/lost or
corrupt proof, another producer's lifetime/signature, deleted stock and an
over-target balance remain unavailable. Unobserved setters retain their
entire original targets and existing before-state guards.

Shared hot/cold delivery projects only observed setters' `amount` to actual
saved stock, including zero. Original IDs, draw identity/token/signature,
cumulative fields, PC newness/initializers, counters, ticket costs, wallet,
scratch and tutorial handling remain unchanged. The queue and permanent
receipt are never rewritten. All delivered plural/singular operations and
hot draw root bond rows use the same projection. Cached supplied operations
are rebound to the original queue and may differ only in bounded amounts for
already-observed setters; other changed fields are rejected. Native save
replies still omit already-applied bond callbacks; the actual client ACK and
all remaining PC/bond proof are still required before queue removal.

This supports an observed/spent duplicate bond alongside an untouched bond
or wholly untouched new unit. It does not redeliver a partially initialized
unit: existing PC/board/character/wardrobe guards still cancel that case.
No second reward, wallet charge, native profile/flag precredit, invented
quantity, new schema or automatic ACK is added.

The expanded `test_gacha_persistence.cjs` cases are WRITTEN ONLY / NONE RUN:
ordinary spent-bond login/confirm/hot replay, immutable queue/receipt/wallet,
original/derived and forged envelopes, mixed new units/two different bonds,
lost observation, remaining native acquisition/ACK, six mixed save rollback
points, four observed-only ACK rollback points, and existing1000/1001
crossing/full-cap/spent-first variants. Original native zero-difference
setter/save/ACK behavior, UI, timing, performance and no-crash/no-freeze still
need consolidated acceptance. This supersedes only the prior observed-bond
cold cancellation limit; incomplete native unit/reward effects remain partial.
No tests, checks, builds, installs, listener restarts or emulator work ran.
Counts remain173 partial/3 unsupported/0 verified complete across176; co-op last.

## Indexed daily draw history — SOURCE ONLY / UNTESTED (2026-10-11)

All 729 daily buttons in the final lottery catalog have limit one and no
step-up group. `lottery/draw` now checks an indexed `(lottery, button, JST day)`
receipt before rolling or charging, and inserts its actual operation ID in the
same SQLite transaction as the charged draw. That transaction also retains the
exact canonical post-draw button row in `lottery_daily_progress`, bound to the
same operation. On startup, every operation-backed snapshot is re-derived from
its immutable schedule capture and exclusive pending-or-done state. A canonical
legacy visible daily row with no indexed operation is retained once with a null
source instead of being attributed to a guessed draw; history already absent
before this ledger cannot be reconstructed.

The selected event-clock JST day is then projected into `UserLottery`: daily
buttons use only that day's retained snapshot or their native zero row, while
non-daily button progress and unknown historical lottery rows remain unchanged.
A live pending daily operation temporarily keeps its own captured day row for
that button across local midnight, so the native result can still save and ACK;
after settlement the normal current-day projection/reset resumes.
Switching backward or forward therefore restores the correct daily button state
without erasing either day, fabricating a purchase, or reusing a later day's
counter. The profile bytes and token update together, and stale pull, push,
confirm and Details caches are removed in the same transaction. Missing/corrupt source
operations, ambiguous queue/done state, noncanonical snapshots, identity swaps
or a visible row that conflicts with its day snapshot refuse without changing
the profile. A newly issued day snapshot and its Iris debit, operation and claim
also roll back together.

The client's native `userPickedCount` (`0x25a635c`) still supplies the ordinary
forward-midnight reset while a listener remains running; new draws replace the
visible row and create the new day's snapshot. A future saved `lastPickedAt`
inside one process now refuses rather than silently borrowing another day's
state—the normal event-clock launcher restart performs the projection first.
The gacha Details page continues to read the indexed day claim. Deferred atomic
draw, two-day projection, rewind, restart, corrupt-snapshot rollback and Details
and pending-midnight cases are WRITTEN ONLY / NOT RUN. DDL is UNAPPLIED; native button rendering,
save/ACK ordering, APK and MuMu no-crash acceptance remain unverified.

## Saved draw progress rewind guard — SOURCE ONLY / UNTESTED (2026-10-11)

`lottery/draw` publishes its new `UserLottery` count and step in the same
transaction as the charge and queued result. A later `user_data/push` could
previously replace or delete that row with an older native delta, restoring a
paid or limited draw. Push now requires each existing known button's count to
equal the already-issued server count, rejecting rewinds and forged forward
progress. For step-up buttons the loop count and step index must equal the
issued values as well. An unused zero-count ordinary button may still be
omitted. The guard is scoped to original catalog buttons. A daily count cannot rewind merely
because a new JST day starts; the native read path derives that day's effective
count and the next issued draw updates the row. It refuses the stale
delta before a profile or operation is saved. Deferred regular
pending/completed, forward-forged, same-day daily and step-up cases are WRITTEN ONLY / NOT RUN.
The original draw-result parser at `0x22ef854` reads both loop/index fields from
the server result (`0x22efc88`, `0x22efc94`). A read-only direct-branch scan of
the preserved ARM64 `.text` found their other setter calls only in the two
serialization paths (`0x268d208`/`0x268d294`, `0x268d86c`/`0x268d8c4`), not
an independent gameplay loop producer. This does not exclude indirect or
inlined writes, but a native save must not manufacture a new server loop.
Original server loop-boundary behavior, daily history from before the new indexed
receipt, direct database tampering, and MuMu save/ACK remain unverified.

## Imported step-up progress — SOURCE ONLY / UNTESTED (2026-10-11)

The original `currentStepUpStep` (`0x25a5e24`) uses `stepIndex` (`0x25a7d4c`)
to read saved `UserLottery.buttons[].currentStepIndex` and selects from the
group supplied by `lotteryStepGroup` (`0x25a7bcc`). It does not derive the
step from purchase `count` or `loopCount`. The draw
handler now accepts a valid saved index even when an imported count differs
from `index - 1`; the wire index must still match, and original price, pool,
purchase limit, wallet debit, queue and native save checks remain. It advances
the saved index by one, retaining the existing final-step fallback and loop
counter. Gacha Details displays the saved index and its actual next price;
out-of-range saved indices show a warning instead of guessed odds. Deferred
draw/Details cases for a nonzero imported loop and mismatched count are written
but NOT RUN. Original publisher reset-cycle behavior and native rendering,
draw/save/ACK and no-crash acceptance remain unverified.

## Ticket-draw ownership — SOURCE ONLY / UNTESTED (2026-10-11)

`lottery/ticket/draw` now requires exactly one owned saved row for the original
ticket ID, a valid dated-ticket acquisition baseline, and no more retained dates
than lifetime acquisitions. It no longer chooses the first of duplicate rows
or spends a foreign row; a non-array profile also refuses cleanly. The existing
expiry ordering, draw, reward, real save and ACK paths are unchanged. Refusal
cases are written in `test_lottery.cjs` but have not run; native acceptance
remains unverified.

## Native ticket batch sizes — SOURCE ONLY / UNTESTED (2026-10-11)

The pristine ARM64 ticket-button setup `0x1c8cd70:0x1c8cdc4` divides the
available ticket count by the button's ticket cost. When the original button
`pickCount` is one, it caps the resulting selectable draw count at ten; for
other pick counts it forces one. The listener at `0x1c95c38:0x1c96904`
captures that count, confirmation `0x1c9dcc8` carries it, and `0x22ef044`
serializes it as `drawCount` for `lottery/ticket/draw`. The final archive has
95 one-unit and 341 eleven-unit ticket buttons; its four ticket banners with
milestone rows are all eleven-unit buttons, so no supported multi-ticket batch
crosses a milestone.

The server now accepts at most ten single-unit ticket draws and only one
eleven-unit ticket draw. The existing result, ticket-date consumption,
progress, operation and native-save guards are unchanged. A written-only
case covers a ten-unit issue/save and both impossible batch sizes. No case
has run and no native gacha screen, save, retry or no-crash behavior is verified.

## Repeated original pool entries — SOURCE ONLY / UNTESTED (2026-10-11)

The decoder appends every row from archived `lotteryCharacter.enc` (210587 rows,
SHA-256 `1ae7b59e756fabf2caa768c5a555070ee288c37d353e2372412c12ecf972df0b`)
to its weight bucket without deduplication. Pools `172000078` (banner `171000047`'s
guaranteed 11-draw slot) and `172000527` (banner `171000276`'s ordinary slots)
contain repeated PC IDs within buckets, while their original bucket weights
total 100%. The offline draw already chooses uniformly among the archived
entry array and the Details rate map adds each entry's contribution. Removing
the pool validator's uniqueness rejection now lets those two original banners
use their retained multiplicity instead of returning a communication error.
Details labels the repeated-entry rule. No deduplication, replacement weight
or guessed publisher odds were added; whether the publisher used an additional
server-side override is still unknown. Deferred Details/rate and paid/Iris draw
cases were written only, with no native render, save, ACK or stability check.

## Orgion Saga missing weight row — SOURCE ONLY / UNTESTED (2026-10-11)

Five original late-2023 banners (`171002164`–`171002168`) use ordinary pool
`172003107`; two also use guaranteed pool `172003108`. Both pools contain
weight bucket `174000091` with the same two featured 4★ units, but the sole
surviving `lotteryWeightGroup.enc` lacks that weight row. All other buckets in
each pool total 98%. The original banner art advertises doubled 4★ rates, and
the only remaining weight for a 100% pool is 2%. The shared draw/Details helper
now assigns **2% as an explicit offline reconstruction**, restricted to these
exact two pool IDs, the absent weight ID, featured pair, and intact 98% remainder.
It does not alter the decoded original data or normalize any other incomplete
pool. Details labels the reconstructed row and per-unit odds; original currency,
ticket, guarantee, receipt and save paths remain unchanged. Deferred cases for
both pool shapes and all five banners are written only. This is not proof of
publisher odds, native drawing, saving or stability.

## Zero-pool 4★ guarantees — SOURCE ONLY / UNTESTED (2026-10-11)

The final archive has 23 selector banners whose 11-draw button promises one
eligible 4★ unit but stores `fixedCount:1, fixedGroupId:0`. The Celestial and
Astrological Festival artwork states that guarantee. Their ordinary pools
contain only 2★/3★ units; each of the three selectable lineups contains 4★
units. The draw handler now keeps the first ten slots on the complete archived
ordinary pool and picks the final slot from the three distinct selected units.
The choice among those three is a disclosed uniform offline policy, **not** a
recovered publisher guarantee rate. Original ticket/Iris costs, selection
validation, windows, limits, durable operation/save/ACK and replay are reused.
`notice/show` labels this separately instead of claiming the ordinary pool is
the guaranteed pool. The one-unit JP Anniversary ticket banner has no separate
fixed group either; its complete archived ordinary pool is entirely 4★, so
that same pool supplies its single guaranteed result. Other unknown zero-pool
contracts still refuse. Deferred lottery and Details cases are written only;
no native draw/save/render or no-crash acceptance is claimed.

## Saved lottery owner and identity — SOURCE ONLY / UNTESTED (2026-10-11)

`lottery/draw`, `lottery/ticket/draw` and gacha `notice/show` now share one
read-only lookup for the selected `UserLottery` row, including before a pending
draw is replayed. Duplicate rows for the same banner, a foreign `userId`,
missing button array, duplicate/invalid button types, or invalid
count/loop/step/timestamp fields refuse without replacing the saved profile,
drawing a unit or charging currency. The normal empty-row constructor and original per-button
progress rules remain unchanged. The other native-default-owner exception
applies only to `UserScratch`/`UserScratchContent`, not this saved lottery row.
Deferred draw and notice cases are written but not run; native ownership,
save order and recovery UI are still unverified.

## Daily draw after an event-clock rewind — SOURCE ONLY / UNTESTED (2026-10-11)

The offline draw handler and its Details page now reset a saved daily button
count only when the event clock has advanced to a later JST day. A rewind keeps
the latest saved count and cannot make a later paid daily draw available again.
The original client has no recovered per-day purchase history, so this retains
the newest counter rather than reconstructing historical daily limits. The
deferred lottery case checks rejection without an Iris debit and matching
Details text. It is written only: no tests, build, installation, listener
restart, or emulator check has been run for this change.

## Absolute bond saturation and signature follow-up — SOURCE ONLY / UNTESTED (2026-10-10)

This supersedes the older saturation-refusal/unchanged-signature statements
below only. Earlier isolated/native observations do not verify this new source.
No tests/checks/build/APK/install/listener restart/emulator/ADB/workers/Actions;
no actual save was opened or migrated. All149 packets/variants precede testing.

Original22f0514:22f0560 reads the prior stock through vtable40, sets the absolute
wire amount through vtable48 with **the operation signature in w20**, reads the
resulting stock and passes resulting-minus-prior to vtableb0. Wire row signature
and cumulativeAmount are not imported. Common24d8d94 caps lifetime at999999999;
original itemType200000020 caps stock at999999999. The setter is absolute, not
ordinary positive gain. The server target now respects that original maximum:

- afterStock = min(999999999, beforeStock + duplicateCount).
- afterLifetime = min(999999999, beforeLifetime + afterStock - beforeStock).
- actual saved signature = operation.signature, not the wire row's old value.

Repeated duplicates and a fully saturated zero-stock-difference grant therefore
remain issuable. Operation signatures exclude every captured old bond signature;
book bytes and before-signatures retain their original UInt8/UInt32 widths.
No user inventory, lifetime, signature, unit or tutorial flag is precredited.

The existing lottery_bond_claim has a nullable stock_state capture, policy
offline-lottery-bond-stock-v1. It binds before/issued signatures and retains
positive stock additions, effect and observed flags alongside its original
before/target stock/lifetime columns. Compare-prior updates share the existing
profile/token/queue/operation_done/floor/exact-reply transaction. This is source
DDL only, UNAPPLIED; old rows receive NULL and are retained as unknown, not
reconstructed from post-award balances.

Positive additions cannot exceed the remaining actual absolute stock difference.
Spending never refunds allowance. Observed acquisition requires the actual
operation signature and exact native lifetime target; a split signature prefix
does not prematurely close remaining stock. Native ACK can close an already
spent first observation with that same signature/lifetime proof. Tutorial1001
still requires the original780030005 saved flag and all native unit effects.

Any recorded bond effect suppresses replay on user_data/push while retaining
the queued ACK. Cold delivery permits only an unchanged baseline or an exact
fully observed absolute target; incompatible partial/spent state cancels rather
than restoring stock/recomputing lifetime. Completed saturated floors now admit
stock increases only through a validated pending producer, including this
bounded lottery capture. Subsequent legitimate draws can grant spendable stock
even after lifetime has reached its cap.

WRITTEN ONLY / NONE RUN:126 synthetic scenarios (seven before-stock/lifetime
variants times regular1/regular11/tutorial1 times six save orders), plus one
original40-Iris charged draw at full stock/lifetime and one old-schema nullable
migration/retained-unknown case. Included are collision/wrap, old-signature ACK
refusal, native malformed rows, corrupt/missing captures, issue/partial-save/ACK
rollback, cold reopen, exact ACK byte replay, spending closure, stock restoration
and deletion refusal, next legitimate gain and no duplicate charge/reroll.
An impossible synthetic amount>lifetime prefix refuses; the row stays coherent.
Shared drawAcknowledgement and duplicate-unit shop fixtures now stamp the actual
operation signature. These cases do not prove native earning/save order/signing.

The newer subscription-contract.md Prism cap/split/spent-save follow-up is also
source-only/UNTESTED; it does not complete Prism or gacha. Unsafe spending before
an untouched absolute setter, additional/coalesced callbacks and recoverable
legacy receipt provenance remain unfinished. Native UI/clock/recovery/performance/no-crash/no-freeze proof
is deferred. Counts125 partial/50 unsupported unchanged; no full gacha feature
completion claimed. Co-op stays last.

Status (2026-10-07): **PARTIAL.** Isolated persistence checks passed; native
tutorial acquisition and one eligible free regular11 draw/save/ACK/cold roster
were observed on a separate MuMu profile. Older source-only/NOT RUN statements
below are historical, superseded only for these named checks and paths. The
original player save was not opened or changed. Shared character validators,
save transactions and acquisition reservations are reused. Co-op stays last.

## Frozen-client evidence

Original15.1.0 ARM64 SHA256:
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
Addresses are raw, without Ghidra's100000 bias. Exact unwind-bounded captures:
`.work/gacha-acquisition-exact-20261004.txt`,
`.work/gacha-bond-methods-20261004.txt` and
`.work/gacha-bond-setters-20261004.txt`.

- `addDrawedPc`22f0170:22f0a8c reads `UserPC[].pcId`, initializes only absent
  PCs through22ebbbc, and updates communication-character state through the
  original character lookup. Extra server placeholder stats are not consumed
  by this initializer. Existing units are not reset to placeholder values.
- `UserLimitBreakItem[]` consumes integer `limitBreakItemId` and **absolute
  amount**. Repository2384588 resolves the bond; vtable40 reads its old amount,
  vtable48 sets the new amount, and vtableb0 adds **new minus old** to cumulative
  acquisition. Wire `cumulativeAmount` is not read. Pre-publishing the new stock
  therefore skips that acquisition difference on cold delivery. Replaying an
  obsolete absolute target after spending can instead restore spent stock.
- DomainLimitBreakItem RTTI351aa44, vtable42ae540: get/set amount2385b04/2385b1c,
  get/set cumulative2385c10/2385c28. Userdata setters263e928:263ea38 and
  263ebfc:263ed0c reject values at or above1000000000. Common24d8d94 caps
  cumulative additions at999999999 and does not suppress negative differences.
  Source rejects a draw that could saturate either proof field.
- Tutorial1001 handler22f2044:22f2168 uses the same acquisition helper, then
  invokes **210c270** with label
  `tutorial.gacha_end` at338d380. The decompiler displays220c270 because of its
  load bias. This is distinct from regular1000.
- Original `contents/1/master/divide_enc/tutorial.enc`, SHA256
  `318894d411a171ba90b13e5935a6d07d10a68c53be1c96537fd17c9a285e9c58`,
  maps gacha_end to780030005 and gacha_finish to780030099. Five type9 children
  780030006..10 triggered by gacha_end complete initial_town/touch_gacha/gacha/
  gacha_draw/gacha_finish. No server-minted tutorial flags or repair is run.

Decompilation/table inspection is not native initialization/save-order proof.

## Source persistence contract

`issueDraw` is shared by ordinary/ticket/banner draws1000, tutorial1001 and
shop character redemptions1000. Original PC profiles and bond identities are
required; missing metadata is unavailable, not a zero-bond success. One bond
per duplicate is the existing explicit offline award policy, not a captured
publisher reward quantity. Batch duplicate counts aggregate by original bond ID.

- Permanent `lottery_draw_claim` binds queue type, exact parameters, distinct
  PC IDs/newness and minimum progress/actual prior ability-board bits. Native
  signatures, PC stats/EXP, boards and bonds are **not pre-credited**. Existing
  lottery counters retain their earlier server-authoritative implementation.
  Ticket expenditure now has the permanent receipt/floor below; native callback
  ordering and parity remain deferred.
- `lottery_bond_claim` captures before stock/acquisition and exact after targets.
  The native save must prove owned, valid cumulative acquisition before ACK.
  Observed proof survives split saves/restart; later spending remains allowed.
  A spent or otherwise incompatible pending absolute target cancels redelivery,
  preserving the queue so a subsequent valid save/ACK can settle it.
  A save spending that pending stock **without its ACK** would return the unsafe
  operation again: the request cancels and rolls back. Spending with the proved
  ACK in the same save is supported. Native no-ACK spending/recovery remains
  unaccepted, not silently reported as saved.
- Character ACK requires an owned joined unit **and an owned job set**, with
  captured progress and bits retained. Lazy ordinary job sets may be empty,
  not missing. The existing `gift_pc_floor` is reused for observed/completed
  character floors; new ordinary acquisition does not invent unopened boards.
- Indexed `lottery_bond_floor(item_id)` retains settled acquisition. Changed-ID
  saves use primary-key floor checks; shared reward reservation uses descending
  indexed newest-claim seeks, not lifetime gacha history scans. Pending effects
  remain bounded by the128-operation queue.
- Same-item additive gift/mission/box/shop/PVE/Element/Familia/character/scratch
  reservations cannot overlap an absolute bond draw, in either issue order.
  Unrelated rewards remain available. Producers lacking captured shared receipts
  still need integration; this is not a proof of all possible interleavings.
- Tutorial1001 ACK additionally requires an owned true gacha_end/gacha_finish
  flag. Its settled indexed claim prevents a fresh tutorial draw; flag deletion
  or rewind is rejected. Actual timing of that native flag versus ACK is deferred.
- Permanent `lottery_transport` binds action, hash of **received wire bytes** and
  an action-specific semantic request hash, not a supplied hash header. Every
  new `lottery_draw_claim` also retains the canonical signed1000/1001 envelope.
  Pending retry returns the original guarded draw. After settlement, an exact
  retry requires done without a queue, the canonical banner/payment/progress
  capture, initialized unit and duplicate-bond floors, tutorial completion and
  any linked scratch receipt. It returns the original result-unit/popup fields
  with no singular operation and `operations: []`; mutable `UserLottery`, ticket
  and scratch roots are projected from their current validated rows rather than
  an old absolute response. It therefore cannot restore an old target, reroll or
  remint rewards after reply-cache/session eviction.
- Charged regular draws bind their exact immutable `iris_transaction`, including
  the request's original free/paid before-balances, local reason and full debit.
  Exact request replay, pending login/pull delivery and settled replay all use the
  same validation. The authored button is re-derived from `schedule_json`; normal
  Iris draws must spend free Iris first and paid-only draws must leave free Iris
  unchanged. Free and ticket draws require no Iris journal. Missing, corrupt or
  wrong-mode debit history makes delivery unavailable rather than charging again,
  rerolling or trusting the current balance. New journals use the captured issue
  second; the validator tolerates the prior source revision's one-second boundary.
- Ticket draws now atomically retain the exact native-shaped ticket row before
  and after spending, original ticket lifetime, event-clock-translated eligibility
  order and the exact removed indexes. ACK requires the client to save that exact
  replacement. `lottery_ticket_spend_floor` then retains
  `cumulativeAmount - dateList.length` as the acknowledged lifetime spend, bound
  to its completed operation. Later acquisitions, expiries and spends may move
  forward, but a stale save cannot restore a consumed ticket. Pending retries,
  settled retries and later draws all validate the capture and floor. Legacy
  pending ticket draws without this capture remain live-queue-only; a newly
  captured or settled ticket draw cannot silently fall back to current stock.
- Selector draws now retain a canonical `selection_json` beside the permanent
  draw claim. It binds the banner/button/step/progress, all original selection
  group IDs, the three chosen PCs, every result slot's ordinary/guaranteed pool
  and the exact returned PC sequence. Pending delivery and settled exact replay
  re-derive those pools and the zero-pool selected guarantee from original master
  data. A result outside the chosen pools, a changed lineup, a corrupt capture or
  a settled legacy selector without this proof refuses without rerolling or
  charging. Legacy pending selectors may be checked against their live request;
  that compatibility does not manufacture permanent proof after ACK.
- Every fresh regular or ticket draw also retains `schedule_json`: its effective
  pre/post button row, request step and count, issue time, optional JST daily day,
  authored ordinary/guaranteed group for every result slot and exact returned PC
  sequence. Delivery and exact settled replay re-derive the schedule from the
  original banner, step and milestone tables. Daily captures additionally require
  their indexed `(lottery, button, day)` claim to remain bound to the same completed
  operation. Corrupt step/day/result evidence refuses without advancing progress,
  charging again or using today's clock to reinterpret an old draw. Legacy pending
  draws retain their live-queue path; a legacy settled daily/step draw without this
  new proof is unavailable rather than reconstructed from its current counter.
- A settled draw carrying a linked `UserScratch` ticket must retain its original
  scratch grant receipt and the materialized `gacha_scratch_state` floor. The
  current saved card/content projection must exactly equal that floor before an
  exact replay can return mutable scratch state. Every later same-card grant and
  draw receipt must be canonical, completed without a queue, and join the prior
  receipt's exact after-state to its own before-state until reaching that floor.
  Later draw rewards retain their acquisition and capped-source checks. Deleting
  or fabricating the floor, losing/corrupting a successor, or rewinding/reforging
  the saved card refuses without restoring the old grant.
- Legacy pending rows without the new semantic/envelope captures may use only
  their exact live queue and old `lottery_request`. Legacy settled rows remain
  unavailable because current inventory cannot reconstruct their signed draw.
- Fresh/pending/cached/login/pull delivery validates receipts against the actual
  signed queue. Missing or corrupt legacy receipts preserve queue/history and
  cancel; no historical bond baseline is inferred from already-precredited stock.
  Login session/cache reset now shares the request transaction and rolls back if
  cold delivery validation fails. Unreconciled legacy queues may consequently
  block login; automatic safe reconciliation remains unimplemented.

## Deferred acceptance

`node tools/test_gacha_persistence.cjs` is written but **NOT RUN**. Updated
lottery, server, shop and scratch probes are also deferred. Synthetic deltas
model the captured native effects; copied wire cumulativeAmount is explicitly
not native-consumption evidence. Fixtures do not prove natural earning or
original gift provenance.

Pending: flags-only/PC-only/missing-board rejection; split saves/restart; new
ownership and cumulative floors; duplicate batches and spending; both additive
present/bond issue orders; missing/corrupt receipt recovery; actual-wire/action
conflicts, mismatched canonical source captures and settled retries;
paid-only journal loss, wrong-mode pending/settled delivery, ticket-capture/floor
loss, stale ticket restoration, linked-scratch later grant/draw chains and
successor corruption, selector capture/result corruption, settled
selector capture loss, step/day schedule corruption and settled daily schedule
loss, and
issue/receipt/transport/reply/floor/ACK rollback.
The consolidated list is [packet-test-plan.md](packet-test-plan.md).

Native hot/cold initialization, real owner/signature/default EXP/stat/skill/HP
and communication effects, tutorial script/flag/ACK timing, original duplicate
quantities, absolute-effect replay after partial saves, native history compaction,
request-ID reuse across genuine fresh sessions, all reward-source interleavings,
legacy migration/recovery UI, selector/step/daily/paid/ticket/scratch screens,
clock changes and natural progression remain unverified or incomplete. No
crash-fix, full gacha support or feature-complete claim is made.

## Executed isolated persistence check (2026-10-06)

`node tools/test_gacha_persistence.cjs` passed on disposable SQLite profiles:
owned unit/board/character and costume acquisition, absolute duplicate bonds,
split saves/restart, tutorial flags, actual-wire retry identities, additive
reward exclusion, retained corrupt receipts and issuance/save/ACK rollback.
The character-first fixture now starts the original state1-to2 branch explicitly
instead of expecting a no-effect already-joined character to suppress delivery.
Its additive reservation assertion uses the existing shared item guard's message.
No server guard was weakened. This supersedes this script's older NOT RUN notes.

The current launcher was built locally, installed and started on a separate fresh
MuMu profile; its seven server modules match current source. That limited session
check does not establish native gacha consumption, initialization or save/ACK
acceptance. Original adventure data was not modified; full gacha remains partial.

## Native tutorial acquisition and cold restart (2026-10-06)

This supersedes the startup-only limitation above solely for one observed native path. On separate profile `eb8b83ee` (Adventure16), event date2019-10-18, the real tutorial draw171000570 selected Ais1011002003. The native keep-YES interaction succeeded; LotteryDraw saves and ACK settled operation1. SQLite retained the initialized unit (HP170/MP23/currentJobIndex1/joiningState1), owned boards, character, costume and true tutorial flags780030005/780030099. Pending operations became0, completed operations1. No server-created character stats or tutorial flag precredit was used.

Cold restart then exposed an independent first-entry checkpoint bug: our capture expected18 Reaction Voices in addition to the three native Daily Talk saves. Original repository initialization23a1e90 excludes kind1. The shared entry/CP capture now follows that repository; exact old entry receipts are backed up and reconciled only through actual existing saves and the ordinary planner. The same test profile restarted into town without the previous3000999 checkpoint error; its kept unit/ACK remained present and tutorial draw did not repeat in the observed restart.

The tutorial-completed asset handoff `/api/asset/notice/index` previously returned404. Exact GET/HEAD now uses the existing explicitly labelled offline notice page, ignores tracking queries without reflecting them, and does not mutate SQLite. `test_notices.cjs` passed including all2236 catalog pages, direct asset queries, HEAD and read-only assertions. Native News opened the page and its close button returned to town. The automatic tutorial-completed query was observed before the fix; its automatic re-entry sequence remains a separate unverified case.

Locally built/installed debug launcher SHA256: `29972cdb4e3511510aa568e48ec99a5499b7304b6ad17d3e5109b5c7dd0351fe`. All seven embedded modules matched current source; installed server SHA256 `9495cef7dcfacd08798ad1dc8d49021c877f0fb7b9a31777a4cf31bb016b2999`. Original selected Adventure5 was not launched or modified. Full normal/ticket/selector/step/paid/scratch gacha, every unit initializer, all reward interleavings, ordinary stage completion, long-session stability and publisher parity remain pending/incomplete. Overall direct-route inventory remains175:107 partial,68 unsupported,zero complete. No workers or GitHub Actions were used.

## Native free regular11 draw and cold roster (2026-10-07)

On isolated `eb8b83ee`, event date2019-10-18, banner171000713/button2
showed one remaining free11 draw and confirmed a0-Iris cost. Native
`lottery/draw`20985 issued operation10; `LotteryDraw`20986 saved actual
PCs/boards/characters/initial costume, duplicate bond and native stage fanout,
then acknowledged it. Ten new units and one duplicate bond rendered with the
Compound Outfit acquisition popup. Count1 and lastPickedAt1571410602 persisted;
Iris9 and Valis18816 were unchanged. No local funding, synthetic eligibility,
native reward precredit or purchase-provider authentication bypass was used.

After an actual stop/relaunch, confirm20988 returned successfully, News closed
to usable town, and the native enhancement roster showed13 owned units.
Operation10 remained done, the queue was empty and SQLite integrity wasok.
Screens: `.work/native-gacha-result-20261007.png` and
`.work/native-board-gacha-cold-20261007.png`. The isolated gacha persistence
suite was rerun successfully after the ordinary board-checkpoint change.

APK SHA256 `6ed35b42473ea2cafb945b308374094faf43321b9a32ca8622d6436bc2c68e22`;
source/installed runtime server SHA256
`4919254eea5d10e5ae10653c9eabf6a586f30c92ffd2a4adb3a3184cc76e7f64`.
All seven packaged modules matched current source. Original Adventure5/date
2022-08-20 selection was restored with game/listener stopped, without opening
its database. Other banners/pools/odds/art, paid/ticket/selector/scratch paths,
event resets, interruptions and full gacha stability remain unverified.
