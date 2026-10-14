# First-clear cumulative-before-daily recovery

SOURCE ONLY / PARTIAL / UNTESTED. The paired ARM64 adapter is NOT BUILT,
SIGNED, INSTALLED or run. Actual saves, listener and emulator remain untouched.
This extends one unfinished first-clear branch, not full stage completion.

## Original client contract

Pristine `libapp.so` helper24528e0:24529fc allocates50 bytes, retains its
original caller LR atSP48, resolves the live stage/reference, computes the
cumulative value and calls2666b1c at245293c. Original call bytes are78500894.
Only afterward does it read daily at2452944, add the same original count and
call2666dec at2452954. The helper releases its original reference and checks
its canary. A cumulative1/daily0 prefix therefore has a distinct remaining
daily assignment; replaying the whole helper would increment cumulative again.

The existing top-level counts adapter calls this helper at153f1a0 and returns
at153f1a4. Other original helper callers, including recursive story clears,
do not have that return address. The common parameter pointer is already
retained at commonSP168 before X21 is reused. Evidence is retained in
`.work/stage-clear-cumulative-original-20261010.txt`; this is original source
reading, not execution or native acceptance.

## Paired adapter, source only

`tools/offline_client.py` now redirects only BL245293c to128 guarded original
zero bytes153f1e0:153f260. On entry the thunk compares the original helper
caller LRSP48 to ASLR-relative153f1a4. Foreign/recursive callers tail-call the
original cumulative setter with unchanged arguments and never read the
common JSON slot.

For the retained common caller it saves original stage/value in X19/W20 and
preserves X19/X20/X29/link in a30-byte frame. The wrapper is read atSP398:
30 thunk +50 helper +30 retained counts shim +180 clear +168 common slot.
It unwraps that root and uses the original member13b1f5c/int13b28d0/default0
parser to read `offlineStageClearCountsApplied`. Exact2 skips only the
cumulative setter. Every other value restores the original stage/value and
calls the original setter. Registers/frame/link are restored in either case.

Existing exact1 still skips the entire counter helper when both additions
were already saved. Exact2 still executes the original helper, including
daily addition, reference ownership/cleanup and canary. Neither control
changes the original clear count used by later dates/events/features/story.
This does not bypass purchase authentication, operation signatures or ACKs.
Other ABIs and native exception/unwind/JSON lifetime behavior remain unverified.

## Server and persistence contract

Only operation5000/16000/25000 with original skipCount0 and captured
cumulative/daily/first/last all0 may use this branch. The live root must be a
single owned state4 row with cumulative1, daily0 and both dates0. The new
private `clearCumulative` observation is retained by the existing atomic
profile/capture transaction; it is not an incoming client control.

Cold recovery derives control2 only under exact source queue/capture/body,
root/owner/extra fields, requested tasks, scores, stock/loot, CP/XP and guest
proof. Source operation parameters, count, task IDs, quantities, token,
signature and queue remain unchanged. There is no counter reset, precredit,
extra Iris, refund or early floor/done/ACK.

An observed cumulative prefix cannot rewind cumulative. A later actual daily1
save retains `clearCumulative`, records `clearCounts` and changes derivation
to1. With both counters observed, daily0/date0 rewind is rejected. Dates before
daily are rejected. LAST-only after daily is now extended by
[the source-only date contract](stage-clear-last-date-recovery-contract.md),
which freezes the actual timestamp and preserves original FIRST initialization.
Positive FIRST requires the existing full-clear
date proof. The existing daily-reset policy after a full dated root is kept;
it is not new proof of clock behavior or intermediate native ordering.

Original/current cached confirm, login and pull reuse existing recovery. A
stale derived2 envelope after both counts are saved is not silently accepted
as current control1: it refuses without mutation. The original cached
envelope or a fresh request can derive1. Coherent source injection of either
control1 or2, malformed controls and duplicate observations still refuse.
Only full actual mixed save and real ACK create completed floors/done.

No DDL, dependency, new issuer, historical scan or per-item SQL query is added.
Earlier schema changes remain unapplied; live data has not been opened.

## Deferred cases, not results

`tools/test_stage_caps.cjs` retains32 counter contexts: the original16
both-count cases and16 additional cumulative-only cases. The newer date
contract adds32 contexts, bringing the counter/date matrix to64, NONE RUN.
Four original
families (ordinary positive EXP, pure zero-EXP/CP/loot scene, PvE, Element)
are combined with four captured before states1/2/3/4 and both counter prefixes.
Their opening/funds/stats/signatures/save ordering remain synthetic fixtures.

Written cases cover early/duplicate markers, daily-only rejection, owner/
extra/counter/date guards, prefix transaction rollback, hot suppression,
original/current cached delivery and restarts, mixed closed loot/ranks/XP/CP,
altered controls/source1/2 injections, next daily save/control2-to1/stale2
refusal, counter rewind rejection, full remaining callback, daily reset,
real ACK and floor/done/queue/reply rollback, and once-only subsequent clears.

`tools/test_client_native_patch.py` has additional original hook/padding,
callerLRSP48/ASLR153f1a4/rootSP398, exact2/default parser, argument/frame/
register restoration, branch/literal, unchanged daily/reference/canary/
unwind spans, mismatch refusal and other-ABI assertions. NONE RUN.

Daily-only/repeat/skip/fully saved FIRST/story/feature/subscriber/coupled acquisition and
coalesced/legacy recovery remain unfinished. Clock zero-epoch/historical
ambiguity, natural save ordering, JSON lifetime, exceptions/unwind, native
events/UI/signatures/scoring/performance and no-crash/no-freeze acceptance
remain unverified. Coverage remains124 partial /51 unsupported /0 complete.
All149 packets and discovered variants precede consolidated testing; co-op last.

This supersedes only the cumulative-only refusal and exact1-only derivation
in [the earlier paired counter contract](stage-clear-counts-recovery-contract.md).
Its both-count control1 and other guards remain.
