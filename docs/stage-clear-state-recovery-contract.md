# Interrupted stage clear-state saves

SOURCE ONLY / PARTIAL / UNTESTED — 2026-10-10. No tests, static/syntax
acceptance, generators, builds, APK work, listener restarts, emulator/ADB,
workers or GitHub Actions. Actual saves and runtime remain untouched; earlier
DDL remains UNAPPLIED. This is not a crash fix or playable-acceptance result.

## Original callback and representable counters

The pristine ARM64 common246c564 resolves the live stage and calls2451924 at
246d49c. It does not replace that stage with the older wire baseline. The clear
routine assigns state4 at2451970 through2665308 before calling24528e0 at245197c.
The protected state setter compares the old/new byte and only writes/marks dirty
when changed; returning from an unchanged setter does not skip the later clear
routine.

24528e0 reads cumulative count at protected offset240, adds the original count
at2452934, and writes it through2666b1c. It independently reads daily count at
offset2b8, adds the same original count at245294c, and writes2666dec. Neither
addition is guarded by the already-cleared state. Both setters assert when
incoming W1 is at least0x3b9aca00, or1,000,000,000. The original upper bound is
therefore999999999, not the signed-int32 maximum.

The clear routine then sets the last date through26667cc; if the first date is
zero it copies the last date through266660c. Generic completion24529fc and
objective2452af0 events, feature23b10a8, story/difficulty/episode opening2451204
and recursive narrative clearing2451924 follow. The common callback subsequently
clears the in-progress stage ID through266f7b4 at246d4cc. Skipping the whole
routine would lose those effects. Pristine reading is recorded in
`.work/stage-clear-state-original-20261010.txt`; no native function was executed.

## Source-only remaining-effect proof

Shared5000/16000/25000 cold recovery now always checks the captured root row.
The former empty-observation fast path could bypass that check for a zero-EXP,
zero-CP, zero-objective scene and conceal changed counters or dates. Zero-effect
fresh and cached hot retries now use the same proof.
Expected validation failures while reading stored shared-stage effects produce
the unavailable/reconciliation response on hot delivery too. Actual incoming
save validation and unexpected failures are not converted into successes.

The actual root must be the single originally owned stage with its exact
captured cumulative/daily counts, dates and other fields. Only state4, requested
guarded objective flags and the independently assigned original PvE scores may
already differ. Existing original receipts, queue identity, task order/IDs,
received flags, guest windows, hero/CP/refill, XP/SP and whole captured item/rank
proofs remain in force. One or both changed counters, changed dates or foreign
progression still refuse: replaying their additive callback is not proven safe.

The existing `stage_delivery.observed` stores a private `clearState` key only
for these three types when the captured before state was not4. A real owned
state4 save can be observed atomically with the profile. It cannot regress or
disappear; hot delivery is suppressed while the original operation remains
queued. A stage already4 before issuance needs no new marker.

Cold login/pull/confirm can return the original callback while both counters
and dates still equal their capture. It keeps the original stage baseline,
count, task IDs, token, signature and source queue. Existing derived omission
of whole closed items/ranks and the paired XP/CP controls still compose. This
branch adds no wire control, native patch, fabricated remainder, counter reset,
precredit or early acknowledgement.

Issuance and captured cold replay also reject a before+count beyond the native
counter bound. Native stage deltas, full-clear ACKs and completed floors require
integer nonnegative representable counters. Key-only deletion requests retain
their original shape; legitimate daily resets to zero remain legal. Story
capture checks live counters and exhausted recursive daily increments, retained
story cumulative captures use the original bound, and remaining auto-clear
delivery checks its live counter range. These range checks do not prove general
partial story-counter/date recovery or midnight ordering.

Only the full actual clear, objectives, score and mixed rewards plus the real
ACK advance the completed floor and remove the queue entry. Existing atomic
profiles/observations/queue/done/exact replies are reused, with no new schema,
dependency, receipt table or historical scan. No live save was opened or changed.

## Deferred cases, not results

40 NEW / NONE RUN in `tools/test_stage_caps.cjs`:

- 32 state contexts: original positive-EXP ordinary1010000101101, zero-EXP
  scene1010000101103, PvE1120000904103 and Element1260000101101, each with all
  four supported before states1/2/3/4 and unchanged/state-only prefixes.
- Eight boundary contexts: those four original families and each of the two
  clear counters, including the last representable increment, invalid saves
  with and without ACK, a coherently exhausted pending capture, preservation
  after cold restart and refusal to issue the next unrepresentable clear.

Written assertions cover zero-marker cold/fresh-cached hot refusals, owner/date/
counter/extra-field/missing-duplicate corruption, flag observations/rollback/
forgery/duplicates, original and derived caches/login/pull/restart/exact bytes,
retained source queue, no early ACK/floor/Iris, received objectives/PvE scores,
whole numeric/dated loot and closed XP composition, additive clear refusal,
full mixed saves/ACKs, profile/capture/floor/done/queue/reply rollback and later
once-only clears. Existing99 objective contexts replace the now-supported
state4 refusal with a changed-state2 corruption case. Seven invalid baselines
were added to `tools/test_stage_persistence.cjs`.
Four existing recursive-story contexts in `tools/test_stage_unlocks.cjs` now
include cumulative/daily exhaustion before issuance and cold replay, plus
forged exhausted cumulative captures. These remain written only, not passes.

Original catalogs, IDs and quantities are retained. Opening/repeat counts,
party/stats, funds, signatures and save ordering are synthetic fixtures, not
native earning/signing/callback-order or publisher evidence.

Saved date/story/feature/event prefixes, coupled acquisition and coalesced/
legacy recovery remain unfinished. The named fresh non-skip both-counter and
cumulative-first prefixes are extended by
[the paired counter contract](stage-clear-counts-recovery-contract.md) and
[its cumulative-before-daily extension](stage-clear-cumulative-recovery-contract.md).
Other counter/date/history prefixes remain unfinished. Native events, daily reset/clock,
UI/save/signature order, ABI/scoring/performance/no-crash-no-freeze acceptance
remain unverified. Counts remain124 partial/51 unsupported/zero feature-complete.
All149 packets and discovered variants precede consolidated testing; co-op last.

This supersedes only the zero-marker baseline bypass, the captured state4-only
refusal and the prior signed-int32 clear-counter upper bound. Earlier mixed
reward, additive progression and native acceptance limits otherwise remain.
