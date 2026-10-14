# First-clear closed-counter recovery

SOURCE ONLY / PARTIAL / UNTESTED — 2026-10-10. Paired ARM64 adapter NOT BUILT
or INSTALLED. No tests, syntax/static acceptance, generators, builds, APK work,
listener restarts, emulator/ADB, workers or GitHub Actions. Actual saves/runtime
remain untouched and earlier DDL remains UNAPPLIED. This is not native,
playable, crash-free or duplicate-event acceptance evidence.

## Original ordering and response lifetime

The original2451924 assigns state4, calls24528e0 to add the original count to
both cumulative and daily counters, writes last then first-if-zero dates, and
continues completion/objective events, features and story progression. Its
frame is180 bytes, with the original caller LR atSP178. The top-level common
call246d49c returns246d4a0; recursive narrative calls have different return
addresses. The count helper must not run again after those two saved additions,
but skipping the entire clear routine would lose its later work.

The common246c564 incoming root JSON wrapper is initially held in X21. That
register is reused as W21 at246d2c8 and as another pointer at246d314, before
the clear call. Reading the saved X21 in the clear frame would therefore read
the wrong object. Common frame1d0 has canarySP160 and saved registers starting
SP170; the unused eight-byte padding atSP168 can retain the original incoming
parameter pointer for the late clear hook.

Pristine code/bytes and these lifetimes were read without executing native code;
see `.work/stage-clear-counts-original-20261010.txt`. Native exception/unwind,
JSON lifetime, clock mapping and event subscribers remain deferred acceptance.

## Source-only paired adapter

`tools/offline_client.py` redirects only246c58c's original MOVX21X0 to16
guarded original zero bytes153f1d0:153f1e0. The shim retains that MOV, stores
the incoming wrapper at commonSP168 and branches back246c590. It does not
change the common frame, input arguments, canary or saved registers.

Only245197c's original BL24528e0 redirects to128 guarded original zero bytes
153f150:153f1d0. The shim compares the clear frame's saved caller LRSP178
with ASLR-relative246d4a0. Every other caller tail-calls the original helper
without reading a supposed common JSON pointer. Recursive clears therefore
retain their original count additions.

The exact top-level call saves X19/X20 and frame/link in30 bytes, retains the
original domain/count, loads the root wrapper at newSP318=30+180+168, and
unwraps it in the same way as the original common parser. Original member
13b1f5c/int13b28d0/default0 lookup reads `offlineStageClearCountsApplied`.
Only exact1 skips the count helper; every other value restores the original
stage/count and calls it. Registers/frame/link are restored on either path.

Original event count W21, dates, features, story/difficulty/episode progression,
recursive count helpers and canaries remain unchanged. No counter reset,
signature/authentication bypass, precredit or save/ACK bypass is introduced.
Other ABIs and unpaired clients do not implement this control.

## Remaining-effect admission

The source currently admits only non-skip5000/16000/25000 whose original
cumulative/daily/first/last values are all zero, and whose actual single owned
root is now state4 with cumulative/daily both1 and both dates still zero.
One-counter prefixes, repeat histories, skips and changed dates remain
unrecoverable until their own remaining-effect contracts are implemented.

The existing `stage_delivery.observed` stores `clearCounts`. It cannot lose
the exact cumulative1 proof or rewind a closed count prefix. A native
LAST-before-FIRST partial date save can persist, but cold recovery refuses it.
Positive FIRST requires the full original saved-clear date proof, not a
first-only fabricated timestamp. After a full actual clear, the existing
legitimate daily0 reset policy retains an already-observed count effect and
still requires the real ACK. This does not prove midnight interleaving or
zero-epoch/historical clock behavior.

Pure cached/original/current confirm/login/pull derives only applied1, alongside
independently proven whole item/rank omissions and existing XP/CP controls.
Actual root/count/task IDs, source capture/queue, quantities, token and signature
remain original. Fresh coherent source/control injection fails. An original
cached envelope without controls is still allowed to rederive; an altered
current-derived body is not silently accepted as an original response.

Full clear, objectives, score, mixed effects and the real ACK remain mandatory
for completed floors and queue deletion. Existing atomic profiles/captures/
observations/queue/done/exact replies are reused. No new schema, issuer,
dependency or historical scan is introduced; live saves were not read or changed.

## Deferred cases, not results

Originally16 both-count contexts, now64 counter/date TOTAL / NONE RUN in
`tools/test_stage_caps.cjs` with16 additional cumulative-only contexts in
[the newer cumulative-before-daily contract](stage-clear-cumulative-recovery-contract.md).
Another32 contexts cover
[the LAST-before-FIRST contract](stage-clear-last-date-recovery-contract.md).
The original four families are retained:
(ordinary positive-EXP1010000101101, pure zero-EXP/CP/loot scene1010000101103,
PvE1120000904103 and Element1260000101101) by four supported before states
1/2/3/4. Opening/funds/stats/signatures/first-clear state4 and save order are
synthetic, not natural earning or native callback evidence.

Written cases include early/duplicate markers, daily-only/owner/date/extra/
rewind/order corruption, original-current caches/purity/login/pull/restart/exact
bytes, full source queue, requested received tasks/PvE score/whole numeric-dated
and rank rewards/closed XP/same-level CP composition, altered controls/coherent
source injection, retained LAST-only prefix with cold refusal, no early ACK/
floor/Iris, a full remaining callback without regranting closed loot, full-save
cold refusal until real ACK, full-root daily reset, transaction rollback and
once-only later clear. The pure-scene missing-control cache equals the original
envelope and correctly rederives instead of being misclassified as corruption.

`tools/test_client_native_patch.py` now defines original gate/cave bytes, root
stash andSP318, ASLR page/caller gate, branches/flag/default/literal, arguments/
callee-saved registers, unchanged later clear/common/helper bytes, complete
patch spans, other-ABI behavior and mismatched-image refusals. NONE RUN.

The newer contract extends only cumulative-first control2 recovery; control1
still skips both. Its cumulative-setter hook supersedes the original helper's
unchanged-byte assumption only at245293c, leaving daily/cleanup intact.
The newer LAST-before-FIRST contract supersedes only the LAST-only refusal
and original unchanged-call assumption at2451998, preserving saved LAST
and original FIRST initialization. Daily-only, repeats, skips, fully saved
FIRST/story/feature/event prefixes, coupled
acquisition and coalesced/legacy recovery remain unfinished. Native clock/
JSON/unwind/exception/subscriber/save-order/UI/scoring/performance/stability
acceptance remains unverified. Counts remain124 partial/51 unsupported/zero
feature-complete. All149 packets and variants precede consolidated testing;
co-op last. This supersedes only the named fresh both-count-before-date refusal
in [the previous clear-state contract](stage-clear-state-recovery-contract.md).
