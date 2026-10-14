# First-clear LAST-before-FIRST recovery

SOURCE ONLY / PARTIAL / UNTESTED. The paired ARM64 adapter is NOT BUILT,
SIGNED, INSTALLED or run. Live saves, listener and emulator remain untouched.
This implements one date prefix, not full stage completion or native acceptance.

## Original client contract

Pristine2451924:24528e0 sets state4 and adds cumulative then daily counts.
It calls time service25d86b4/25d8704, loads the returned int64 timestamp and
calls LAST setter26667cc at2451998 (original bytes8d530894). FIRST getter
24519a4 skips initialization when FIRST is nonzero. When FIRST is zero,
24519b4 reads the live LAST field (+1f8), and24519c0 calls FIRST setter266660c
with that value. Generic events/objectives/features/story follow.

Therefore recovery must preserve the already-saved LAST timestamp rather
than substitute today's clock. The original FIRST initializer can use it
without a timestamp wire field or replacement time provider. Original
LAST26667cc retains X1 in X20, using the int64 protected getter/setter path.
Evidence is retained in `.work/stage-clear-last-date-original-20261010.txt`;
this is source reading, not execution or an original publisher trace.

## Paired adapter, source only

`tools/offline_client.py` redirects only BL2451998 to128 guarded original
zero bytes153f260:153f2e0. Its clear caller LRSP178 must match ASLR-relative
246d4a0. Foreign/recursive callers tail-call original26667cc with unchanged
arguments and never read the retained common JSON pointer.

The exact common caller retains row/date in X19/X20 with a30-byte frame,
preserving callee registers and link. Its original wrapper is atSP318:
30 thunk +180 clear +168 common slot. The original member13b1f5c,
int13b28d0/default0 parser reads `offlineStageLastDateApplied`. Exact1 skips
only the saved LAST assignment; other values restore original X0/X1 and
call the original setter. X1 remains64-bit, never narrowed to W1.

The original time service/wrapper allocation and cleanup still run. FIRST
still reads live LAST and initializes normally. Original counter controls,
event count, generic events, features/story and recursive callers remain.
No clock replacement, timestamp injection, auth/signature or ACK bypass is
added. Native exceptions/unwind/JSON lifetime and other ABIs are unverified.

## Server and persistence contract

Only original5000/16000/25000 skipCount0 with captured cumulative/daily/
first/last all0 can enter this branch. The single live owned state4 root
must have cumulative1, daily1, FIRST0 and a positive safe-integer LAST.
Existing atomic `stage_delivery.observed` records one canonical
`clearLastDate:<actual timestamp>` checkpoint. It is not a client-supplied
control or a newly authored date.

The checkpoint freezes LAST. It cannot disappear/change; FIRST stays0 or
must have the existing full original date proof with FIRST equal to recorded
LAST. Date-before-daily, daily reset while FIRST remains0, counter rewind,
invalid/conflicting date keys, foreign ownership or extra root changes refuse.
The existing reset policy after a full dated root is retained, not expanded.

Cold recovery preserves exact source queue/capture/body/root/tasks/scores,
stock/loot/CP/XP/guest/owner proof and derives date-control1 with counts-control1.
Original source operation, baseline, count, quantities, task IDs, token,
signature and queue remain immutable. No precredit/refund/reset/extra Iris or
early floor/done/ACK is created. This LAST-only prefix does not itself prove
a complete FIRST. A later full-stage push with its own persisted clear marker
can cold-recover the exact complete first clear on the same day under the
narrower contract in [stage-reward-contract.md](stage-reward-contract.md).

Original/current cached confirm, login and pull rederive without writes.
Malformed/missing/altered derived date controls, coherent original-source
control injection, conflicting checkpoints or changed timestamps refuse.
An earlier derived envelope is stale once a later prefix is saved; it cannot
silently execute obsolete work. Original cached envelopes or fresh requests
can derive current controls. Full remaining native callback initializes
FIRST from the recorded LAST; actual mixed save and real ACK own floors/done.

Existing transactions/checkpoints are reused. No DDL, dependency, new issuer,
historical scan or per-item query is added. Earlier DDL remains unapplied.

## Deferred cases, not results

`tools/test_stage_caps.cjs` has64 counter/date contexts: retained32 counter
cases plus32 LAST-only cases across four original families, four captured
before states and both cumulative-first/both-count prefixes. Their inputs,
ordering, signatures and clock movement remain synthetic fixtures.

Written cases include prefix save rollback/hot suppression/no early ACK,
same-day later clock with unchanged recorded LAST, original/current cached
confirm/login/pull/restart/source identity, mixed closed loot/ranks/XP/CP,
counter-to-date composition, date/root rewind guards, duplicate/conflicting/
zero/leading-zero/unsafe date keys, invalid date controls/source injection,
FIRST equal to recorded LAST despite the next clock read, full-save cold
refusal/real mixed ACK/daily reset/atomic floor-done-queue-reply rollback and
once-only subsequent clear.

`tools/test_client_native_patch.py` now defines original hook/padding,
callerLRSP178/ASLR246d4a0/rootSP318/default/exact1 parser, int64 argument/
register/frame-link preservation, branches/literal, unchanged original
provider/FIRST/clear/helper/setter/unwind spans, mismatch refusal and other
ABI assertions. NONE RUN; these are not passes or generated-patch proof.

Uncheckpointed or partial FIRST, repeat/skip/daily-only/midnight interleave/
subscriber/story/feature/coupled/coalesced-legacy recovery and remaining packets
are unfinished. A separately checkpointed complete first/repeat clear can now
retain a later client-day daily reset under `stage-reward-contract.md`.
Original zero-epoch/history, native lifetime/unwind/events/signatures/save
ordering/UI/scoring/performance/no-crash-no-freeze remain unverified.
Counts remain124 partial /51 unsupported /0 feature-complete. All149 packets
and variants precede consolidated acceptance; co-op last.

This supersedes only LAST-only cold refusal in
[the cumulative-before-daily contract](stage-clear-cumulative-recovery-contract.md)
and [the original paired counter contract](stage-clear-counts-recovery-contract.md).
Their other controls and guards remain.
