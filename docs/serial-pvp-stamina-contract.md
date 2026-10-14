# Telskyura Abyss attempts — source only, acceptance pending

## Current recovery-ticket implementation — source only

This follow-up extends the shared item-award and `user_data/push` save paths;
there is no discovered standalone Abyss ticket packet. All ten serial routes
remain PARTIAL, overall95 partial/74 unsupported/zero feature-complete. No
logical/native/emulator tests, live-save changes, listener restart or APK
build/install were performed. Co-op remains last; no workers or GitHub Actions.

Original native recovery UI1b9e8b0:1b9ef50 repeats the selected count. Its
wrapper2541eb8:2542050 resolves the original DomainSerialPvpSpTicketItem,
reads recovery via25746e0:25746f0 (**FlatBuffer offset0x18, slot10**), checks
full remaining capacity through2547248, calls item vtable+0x50(-1,0), then
25472e0 to add attempts. Root vtable42c1cc0+0x50 resolves the existing common
gain24d8844. Recovery0 has a base-SP fallback in the original wrapper; no
archived Abyss ticket uses it, so source does not enable an unobserved fallback.
All50 original rows have recovery1. Ticket recovery does not reset the SP
timer; a full ticket is not spent for a truncated/clamped recovery.

Serializer27918dc:2791c28 emits EIGHT fields: userId, ticketId, amount,
reservedAmount, bookEntryState, signature, cumulativeAmount and lastResetAt.
Lazy constructor2573e48:2573fa4 supplies the current account and original
ticket ID. This is neither a six-field Under pass nor a gacha date-list ticket.
The source requires typed original identities, inventory cap999999999,
uint32 signature, book states0..3, and retained cumulative/reserved/reset
history. Native reset/expiry producers for lastResetAt remain unproved; no
expiry deletion or guessed reset is accepted.

The decoder now registers these50 original item IDs/keys in the existing
item registry as UserSerialPvpSpTicketItem/ticketId, using the already decoded
rows and existing source hashes. Original raw serial tables and legacy
battle catalog hashes are unchanged. Existing present/shop/mission/dispatch
item receipts can therefore supply their actual ticket rewards; this change
does not invent any rewards or add ticket stock to the real player save.
Positive inventory changes must conserve amount/cumulative growth within
the shared issued-acquisition reservation. A pending award must settle before
that item is consumed; an arbitrary amount/cumulative increase is rejected.

Local ticket debit captures season, original rule/ticket catalog, observation
clock, SP baseline, exact native interval/initialization candidates, ticket
before/after stock and actual quantity. Only the active original DISPLAY
season's information.slot18 ticket may be consumed. Whole recovery must fit
the native cap. Missing ticket proof cannot be replaced with an Iris operation
or arbitrary SP credit. A pending lobby/run/refill/battle cannot overlap a new
ticket source. No signature/profile precredit or invented operation is emitted.

One indexed use receipt and one per-ticket stock checkpoint commit with the
existing native profile/reply transaction. Separate `stock_saved`/`sp_saved`
proofs now admit atomic, inventory-first and SP-first native uploads. SP-first
requires the exact original `SerialPvpSpRecovry` trigger, the active DISPLAY
season's single authored ticket ID, an owned unreserved stock row and exactly
one quantity whose authored recovery reaches the submitted SP row. It captures
the still-unsaved debit but does not apply it. The other exact half may arrive
after restart or an event-clock change and is checked against the captured
catalog/time rather than today's season. Natural timer saves may advance to a
captured pre-recovery candidate, but cannot overwrite the target. Pending pulls,
lobby callbacks, further spending/awards and Iris refill cannot replace the
unfinished state. Ambiguous, wrong-trigger, reserved-stock, restored or changed
halves cancel with state retained.

Current stock/cumulative/reset/reserved values are compared with their exact
checkpoint. At most50 indexed latest-use seeks validate conservation against
each original ticket's newest receipt, including after legitimate later awards.
Missing/corrupt receipts/checkpoints or stale stock restoration/deletion cancel
instead of backfilling a fabricated debit/grant. No lifetime SUM/replay scan is
introduced. Completed consumption cannot be undone by a new save; unchanged
retries cannot recredit attempts. Hot/cold cached native save behavior still
requires final acceptance.

Read-only evidence: `.work/serial-pvp-ticket-entry-20261005.txt`,
`serial-pvp-ticket-use-20261005.txt`, `serial-pvp-ticket-domain-20261005.txt`,
`serial-pvp-ticket-stock-20261005.txt`; all four extraction jobs exited0.
`tools/test_serial_pvp_tickets.cjs` is written but **DEFERRED / NOT RUN**:
all enabled original season bindings, malformed eight-field rows, full cap,
atomic/multi-ticket, inventory-first and uniquely inferred SP-first saves,
initialized/interval projections, late clock/restart recovery, actual-wire retries, stale/deleted stock, missing
award or debit proof, wrong-season/Iris conflicts, shared present acquisition
followed by consumption, corrupt pending/settled receipt or missing checkpoint,
and profile/use/checkpoint/observation/reply rollback. Existing master, gift,
shop/mission/dispatch, serial battle/entry/SP/save/recovery and launcher checks
also remain deferred. No syntax check or metadata regeneration was run;
natural earning/UI eligibility, native signatures/save order, navigation,
rendering, no-crash/ANR and performance remain unproved.

The following resource notes are historical implementation stages; the current
battle/score/ranking contract is in [serial-pvp-contract.md](serial-pvp-contract.md).

Frozen EU15.1.0 ARM64 SHA-256:
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
No workers, GitHub Actions, real-save edits, listener restart, APK build/install
or MuMu tests were performed. This adds season/run-entry and resource semantics to the existing
`currency/hard/consume`10600 and `user_data/push`/`pull` handlers, not a new
route or playable Abyss battle. Logical/native checks described below are deferred.

Follow-up: [fresh runs after saved defeat/retirement](serial-pvp-contract.md)
now preserve old run/attempt proof before another grade selection and use the
same single-attempt checkpoint. This extends the resource slice below; it is
not native acceptance, win-streak progression or complete Abyss gameplay.

## Season allowance and the actual attempt-spend boundary

Native menu1b851cc:1b86108 calls eligibility2106d60, obtains current display
information, and compares **raw** SP timestamp254227c with information slot3,
the matching start. If the saved stamp is older, initializer2542274 rebinds
the rule and sets stock to rule **slot1=5**, with the exact matching-start
stamp. It is an absolute initialization, not an additive gift or daily top-up.
An equal/newer/future timestamp cannot initialize again. Getter interval
recovery may then advance the new stamp. Native disabled matching rows with
earlier display dates can carry a future matching stamp; source saves retain
that original value without enabling their zero-width matching windows.

This implements the resource transition, not the whole eligibility gate.
Eligibility2106d60 has a retained local-unlock branch plus stage-state4 and
a training-record threshold branch. The original entry table supplies stage
1010000105111/1800. Complete flag, training-record field/producer and atomic
eligibility-save ordering remain unimplemented/unverified. No automatic
stage, training score, unlock flag or eligibility grant is fabricated.

The attempt is spent on successful **grade selection/start run**, not on each
`battle/start`. Confirmation1bc44e4 captures vtable4148b78 (+0x30 points to
1bc4628), calls1bbf088, which sends233a0d8 with callback4149b90 (+0x30
points to1bc5ff0). Network callback233c85c merges opponents/usage and saves
the native lobby checkpoint; successful result0 then invokes the captured
UI callback1bc4628. This calls consume wrapper2541e98 ->2547420 with1,
sets the matching counter back to0 through28a28ac, and schedules another
`UpdateSerialPvpState`. Failure/cancel branches do not call the spend callback.

2547420 reads stock directly. At/above natural cap5 it first stamps the
clock; below5 it keeps the timer. Subtraction254728c clamps to0..999.
The offline server requires at least1 effective attempt before issuing a
new selection; a clamped0 subtraction is not treated as a paid attempt.
It captures raw/interval-projected effective stock, including a potentially
initialized-but-unsaved season allowance. The UI callback owns the actual
debit; no signed UserInfo is changed early and no fake operation is created.

New indexed `serial_pvp_run_entry` binds season, grade, selecting request,
generation, original configuration, issue clock, raw baseline, exact
before/after candidates and committed native observation. The selecting
actual-wire receipt must still exist and match its original CPU response.
At/above-cap clock writes allow the same explicit offline -5/+120 second
skew as lobby timestamps, then pin the observed native stamp. Below-cap
timestamps must match exactly. These windows are local compatibility policy,
not publisher proof. Capture/request/sequence/reply are one transaction;
profile/effect observation/save reply are one transaction too.

Status/usage and SP may save separately, in either order, or together. An
untouched/higher baseline cannot observe a spend. New selection, opponent
refresh, refill and replacement pulls wait for the pending effect; safe
initial-run summaries do not replace it. A committed spend blocks replay of
that additive grade callback through hot/cold/cache-evicted transport paths.
Opponent refresh retains the consumed run-entry proof without another debit.
Captured exact saves can arrive after a clock change. A new deliberate grade
request is a new run and costs another attempt. Older selected lobbies without
an attempt capture remain readable but cannot be refreshed/reselected as an
assumed free/paid run; their native history is retained, not backfilled.
Duplicate unobserved callback
execution in native memory, interrupted legacy/cold recovery between the two
save stages, and overlapping unrelated producers remain acceptance gaps, not
claimed solved by server receipt counts.

## Original native configuration and timer

Raw ELF offsets have no Ghidra image-base bias. Native active-information
reader175dba4:175dcfc selects slots5/6, the original **display** period, with
the shared start-inclusive/end-exclusive interval check. It is distinct from
the conservative lobby's matching slots3/4. Original zero-width periods stay
disabled; there is no invented2030 release or widened matching window.

DomainPlayerSerialPvpSp binding2546cbc:2546d34 reads information slot9 and
rule lookup1b8e524:1b8e590. Rule slots2/3/4 are natural capacity, recovery
capacity and interval. The archived rule gives5,999 and28800 seconds.
`gamelibConsume` slot7, now exported as `recovery` with the same source hash,
supplies the Iris-refill amount: **1**, not rule slots5/6 or a guessed battle
count. Consume81071001 still costs the original10 Iris and dispatches10600.

Getter2546e8c calls interval updater2546ec8:2547010. Elapsed time is
max(0,now-serialPvpSPUpdatedAt); the positive whole-interval count is added
then capped at the natural limit. Timestamp advances by whole intervals,
retaining the remainder. No tick leaves both fields unchanged. Off-season
configuration disables the timer; a backward clock does not refill attempts
or reset a future saved timestamp. Unreconciled int32 tick/addition overflow
cancels rather than silently replacing native narrowing with JS arithmetic.

Important: the recovered updater really applies min(5,stock+ticks) even if
stored stock exceeds5. A positive tick can therefore lower refill stock.
This surprising behavior is preserved, not changed to a daily top-up or an
unproved permanent over-cap allowance. Native observation is still needed.

Refill2542238 delegates configured amount through254728c:25472e0. The
setter caps stock at999 and dirties the native resource without resetting
the timer. Its timestamp is separate from stock. The server never
precredits either field or substitutes an invented signed player profile.

## Capture, saving and retries

The existing free-first/paid-remainder wallet policy, signed native queue,
request identities and transaction boundary are reused. Free-first ordering
remains a reconstruction, not publisher proof. An indexed private
`serial_pvp_sp_refill` row binds operation ID, original season/catalog,
issue clock, exact native baseline and candidates. The existing
`hard_currency_consume` row retains its debit, SP field/baseline/target and
observed-save bit. Debit, queue, both captures, actual-wire request identity,
sequence and response commit together.

The captured candidates distinguish already-saved stock from a potentially
dirty native interval projection or season initialization before the purchase. Each records **both**
the before and exact after stock/timestamp. A native aligned timer stamp may
precede the season's opening hour: the configuration comes from the current
observation time, not that earlier aligned stamp. Captured refill saves may
arrive after a later event-clock change, without overwriting intervening
resource recovery. Unissued stock changes, invented spending, malformed
ownership/fields and arbitrary timestamp resets are rejected. A pending run
entry/refill cannot overlap another captured resource producer. Per-fight
battle and SP-ticket resource contracts are not enabled by this change.

10600 now needs an actual proposed UserInfo effect save, or its previously
committed observed-save bit, before acknowledgement. A higher untouched
baseline is not proof of an additive refill. The exact effect and observed
bit commit with the profile and ACK. A separate save before ACK is retained
across restart; its additive callback cannot redeliver, including hot retries,
cold login/confirm and cached responses. A push may omit an already-observed
delivery while keeping its real acknowledgement requirement. Singular10600
is removed too, not merely the plural queue entry.

Unobserved redelivery requires the original active season/config and an
unchanged captured native baseline. A clock change to another season cannot
apply the old purchase under different capacity. Pending UserInfo pulls
cancel before replacing native resources; cached binary pulls use the
existing current-profile comparison. Once ACKed, the old transport identity
cannot charge or apply again; a new deliberate request can purchase again.

Legacy10600 purchases with no resource capture are retained and cancelled;
empty older SP receipts are not reinterpreted as completed effects or
backfilled from guessed values. SQLite/integrity errors remain genuine
failures. Only the bounded pending queue/private primary key is inspected;
there is no lifetime history scan or permanent spendable-SP floor.

## Deferred verification and next gameplay work

`tools/test_serial_pvp_stamina.cjs` and new `tools/test_serial_pvp_run_entry.cjs`
are **NOT RUN**. The run-entry fixtures cover absolute initialization, same
season/rewind/future-stamp/nonmatching display behavior, direct versus dirty
initialized/projected entry, one-attempt affordability, 5-cap timer reset and
below-cap timer preservation, zero stock cancellation, no predebit, split
status/usage/SP saves and restart, permanent wire retries versus observed
callback suppression, refresh without debit, pending refill/pull conflicts,
late saves across event-clock changes, corrupt captures, issue/profile/
observation/sequence/reply rollback. Updated lobby fixtures now observe the
attempt effect instead of treating selection as free. Stamina fixtures cover original
calendar/display versus matching periods, disabled rows, tick boundaries and
remainders, over-natural stock, rewind/future stamps, inactive dates, 1/999
refill targets, raw/projected candidates, exact saves versus higher stock,
split save/ACK/restart, actual-wire conflicts, no precredit, stale/pending
pulls, saved additive delivery cancellation, late issued saves across clock
changes, obsolete versus new request identities, legacy retention and
queue/debit/capture/identity/profile/observation/ACK/reply rollback. Updated
master, generic consume/server, lobby, save/recovery and Android/launcher
regressions are also deferred. Syntax checks and regenerated metadata are
not semantic tests or native acceptance.

Native timer rebinding during live clock changes, operation10600 eligibility,
displayed attempts, hot/cold setter/save/ACK order, refill above5 through a
tick, queue interleavings/signatures, cancellation navigation, performance
and no-crash/no-ANR acceptance remain unproved. This is source gameplay
implementation, not a verified crash fix.

Battle start1952504 consumes battleId/serialPvpId/root preRank/randomSeed,
player/party and substitutedSpineIds, uses record ARRAY and selectedGradeId,
then sets lastBattleStartAt before constructor21071e8. Restart210a9ac
reconstructs party/context through210a008. Result callback22000e4 delegates
to21ff780, which consumes serialPvpResult{serialPvpId,isWin,score,gradeId}.
The follow-up now implements captured first-battle start30200 and direct resume
in source, without another attempt charge; see
[battle start/resume contract](serial-pvp-contract.md#native-battle-contract-and30200).
Processing/resume/update flag saves precede ACK30200; its separate direct
timestamp must also save before resume. Native combat/eligibility/constructor/
checkpoint acceptance remains deferred. End, score arithmetic, used-unit turns,
result aggregation/rewards and five other serial routes remain unsupported.
Do not count resource or start/resume source changes as complete battle support
or protocol parity.
