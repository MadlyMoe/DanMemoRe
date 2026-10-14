# Interrupted player EXP and level-up stamina

Newer [same-level CP recovery](stage-cp-recovery-contract.md) permits exact
existing saved CP targets without level growth alongside the XP proof below.
All original CP entries remain.60 new cases/six extensions are written only;
CP level growth/initializers, clear and other additive recovery remain unfinished.

SOURCE ONLY / PARTIAL / UNTESTED — 2026-10-10. No tests, syntax/static
acceptance checks, generators, builds, packaging/signing/installations,
listener restarts, emulator/ADB, workers or GitHub Actions. Actual saves were
not opened or changed. Earlier source DDL remains UNAPPLIED; no new schema.
The new ARM64 adapter is written only, NOT BUILT OR INSTALLED. Server recovery
and this exact patched client must be deployed together during the later test
phase; an older/unpatched or other-ABI client cannot consume the new control.
This is not playable/native/feature-complete acceptance.

## Original callback and narrow offline control

Original common246c564 passes the live DomainStage argument and W19 count to
246c428 at246c6d0. The XP helper initializes original equipment-bonus cache
247b3f0, reads authored stage slot16, multiplies the original float32 boost,
truncates and multiplies by count, then tail-calls2540b54. That setter adds
EXP, clamps/derives level through2540618 and grants original maxSP for each
newly crossed level through2548998. This is additive, not score/task-style
idempotence. Original status initialization253fa2c calls2540618 at2540160,
so a loaded exact EXP/level already establishes the cached level.

The narrow ARM64 source adapter redirects only246c6d0, preserving original
stage/count arguments, frame/link and common JSON pointer X21. It reads the
offline-only integer offlineStageXpApplied using original13b1f5c and13b28d0
with default0. Only exact1 selects zero for the XP call's W1; absent/other
integer values retain the original count. It tail-calls unchanged246c428.
Thus the original cache initializer still runs, EXP changes by zero, and no
new level/SP step is introduced for the already-proven current level. W19
and every other common item/PC/CP/objective/clear/unlock/event/cleanup path
remain unchanged. No authentication, signature, save, ACK or positive XP
implementation is replaced. Original source reads, not patched-code checks:
.work/stage-xp-cold-native-original-20261010.txt.

The adapter occupies80 original zero bytes at153f090:153f0e0, after existing
adapters ending153f088. Its literal starts153f0c0. Original preceding FDE
ends153f018, the next starts1540018; selected span has no original RELA or
address references found by the read-only reader. Exceptional unwinding and
native ABI/cache/save/order behavior remain unverified. No adapter test,
assembler/compiler or APK tool was run.

## Exact save and replay proof

stageColdRecovery permits saved EXP only for original5000 non-skip
completions (skipCount0). Require the existing immutable owned stage, queue,
completion, authored EXP/party/equipment/float32 boost/amount/cap and actual
before/minimum captures. Actual EXP must equal the exact changed minimum,
with a consistent original level. If levels were crossed, require the actual
retained sp_effect_saved1 and SP observation; merely saved EXP with missing
level-up SP remains unavailable. Proven SP may have been spent afterward;
zero-XP replay does not remint it or restore its old target. Unknown higher,
partial, rewound or otherwise different EXP is not adopted.

An unobserved positive-XP delivery also requires the actual original before
EXP and no saved SP effect. Every positive-XP recovery gets the exact native
stage proof, even with no effect marker: a half-written clear/daily/date
cannot slip through an empty observation set. Complete/received objective
flags retain the original idempotent rules; all additive stage fields remain
at the before capture. Original party/equipment/hero/guest/clock guards remain.
Missing task constructors remain unavailable rather than synthesized.

The pure derived response adds offlineStageXpApplied1 only after that proof.
Fresh original callbacks have no extra field. The original private queued
parameters and stage_delivery.operation_json must never contain this field;
an injected control in both retained sources is rejected, not adopted. Cold
login/pull/confirm and original-or-current-derived cached confirmation reuse
the shared helper and exact envelope guards. Fully observed captured whole
numeric/dated/rank items can still be omitted; partial items refuse. Original
quantities/source/token/signature/queue and real mixed ACK remain mandatory.
No profile/EXP/SP/level/native-token precredit, remint, early/fake ACK, migration,
dependency, per-target query or history scan is introduced. Existing atomic
profile/token/observation/capture/floor/queue-done/reply transactions remain.

The ordered stamina-prefix planner recognizes this exact derived zero-XP/SP
callback before a later normal refill. It retains actual current spendable SP
and the proven level, rather than adding the saved level-up grant again. All
original queue identities/order/refill capacity/before/target/cost and real
ACK checks remain. Higher or differently projected EXP, incomplete XP/SP,
other additive producers, skip/dispatch recovery and malformed captures still
refuse. The new check is pure and reuses stageColdRecovery; its untouched
guest/XP checks do not call the stamina-prefix planner recursively.

Clear/raid-SP/CP/unit/board/guest/story/unlock/voice/refill/feature/record
observations are NOT made cold-replayable here. Original2451924 increments
counters and publishes achievements/features/graph events; it needs its own
remaining-effect contract rather than a blanket skip. Positive skip callbacks
also have a separate pre-XP SP debit, not waived by this XP control.

## Deferred cases and remaining work

WRITTEN ONLY / NONE RUN:30 new test_stage_experience contexts.26 cover all13
authored positive-XP parent families with/without original equipment boosts,
using synthetic imported completed stages. They exercise XP-before-SP refusal,
exact closure, later spending, pure recovery, old/new cache, login/pull,
restart/exact bytes, missing SP proof, unknown EXP, half-clear fields, injected
original control, mixed captured numeric/dated grants and no early ACK. They
deliberately retain the whole original queue rather than fabricate full ACK of
each mode's graph. Two main-stage no-level cases include a corrupted partial
EXP prefix and real mixed ACK. Two closed-XP-to-standalone-refill cases retain
actual spent SP, unchanged EXP, original level capacity, once-only synthetic
Iris cost, queue order, cold/restart bytes and full actual mixed ACK.

Seven existing contexts are extended, not new: two XP-first ordinary boosted/
unboosted cases and five original guest-provider variants now exercise cold
derivation while preserving their existing full save/ACK and rollback cases.
Clear-first/raid-SP saved cases stay unavailable. The shared loot fixture now
uses original nonce/captured numeric stock and actual dated additions. Native
patch span/branch/ADR/default/frame/argument/control and mismatch assertions
are written in test_client_native_patch.py, NOT RUN. All imported flags/stages,
party/gear/funds/stock/loot/signatures/dates/save orders are synthetic, not
natural earning, original eligibility or native gameplay proof.

Paired ARM64 deployment/exceptional unwinding/cache lifecycle/UI/save-signature-
clock order, ARMv7/other ABIs, incomplete XP/SP and skip/dispatch recovery,
additive/coalesced clear/raid/unit/CP/unlock/record effects, missing constructors,
scoring/other producers/remaining packets/performance/no-crash/no-freeze proof
remain unfinished or unverified. Counts remain124 partial/51 unsupported/zero
feature-complete. All149 plus variants precede consolidated server/MuMu tests;
co-op last. This supersedes only blanket closed non-skip player-XP/SP refusal
and its ordered normal-refill prefix refusal, not any unrelated limit.

Read-only final-archive review on2026-10-11 found zero positive
`stageExperience` rows among adventure types12,15,19,20,22,26,27,28.
`stageXpTarget` returns before the unimplemented special-party selector for
those stages. Recovering that selector is not a blocker for their authored
player EXP, though their completion, score, rewards and native play still need
their separate contracts. No check or emulator run accompanied this review.
