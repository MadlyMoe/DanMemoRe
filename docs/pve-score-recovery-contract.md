# Interrupted PvE score saves

Newer [objective recovery](stage-objective-recovery-contract.md) allows proven
complete/received flags without resetting them, including objective-associated
independent current/high score prefixes. It supersedes only the unchanged-task
comparison and that partial-score refusal below. Additive progression still
refuses;102 additional cases are written only/UNTESTED.

SOURCE ONLY / PARTIAL / UNTESTED — 2026-10-10. No tests, syntax/static
acceptance checks, generators, builds, APK work, listener restarts or emulator/
ADB work. Actual saves were not opened or changed. No new schema/native patch;
earlier source DDL remains UNAPPLIED. This is not full gameplay acceptance.

## Original score assignment

Original16000 calls24589c0 at246e360, before rank items and common stage
completion. For adventure mode12 it assigns currentScore through2666c2c and
only raises highScore through2666d0c when the incoming value exceeds the old
one. Both protected int32 setters skip equal-value assignment and mark the
row dirty only when changed. They do not add clears, XP or reward items.
Read-only original source: `.work/pve-score-cold-original-20261010.txt`.

## Recovery and source proof

stageColdRecovery now permits the existing score observation for16000 alongside
the supported whole item/stock observations. A score-only save returns the
unchanged original delivery even when no item has yet been saved. A score and
fully observed captured item combination retains the existing whole loot/rank
omissions; partial item fields still refuse. The incoming score/result metadata
stays unchanged, so the original assignment can run idempotently while the
remaining common callback is still needed.

For an observed score, require one owned stage, nonnegative int32 captured
before/issued scores, a real changed-score target, exact currentScore and
highScore=max(original before high,issued score). Every other captured stage
field must match the original baseline, including clear/daily counters,
state, tasks, dates and ticket fields. A half-written clear or otherwise
unexplained stage change cannot slip through because its complete effect marker
is not yet present. A higher unexplained high score is retained/unavailable,
not adopted or lowered. A forged marker for an originally unchanged score
also refuses; zero-score/no-change stages otherwise keep their normal path.

The one token distinction is intentional: buildStageCompletion substitutes the
request token into the wire baseline, so that field is not a captured prior
native token. Its actual native string is retained for comparison, never
fabricated or written. Existing exact operation/source/type/signature/token,
stage_completion request/completion identity, pve_clear result and rank-source
guards remain. No unknown publisher request or alternative score is accepted.

All observed additive progression still refuses cold replay: clear, XP/SP/CP,
unit/board/guest/unlock/story/voice/refill/feature effects and mode records need
their own remaining-effect contracts. Existing untouched party/XP/hero/clock/
guest/refill guards are reused. Hot repeat suppression and real full mixed ACK
remain; recovery does not precredit profiles, change score receipts, remint Iris,
delete the original queue or fabricate acknowledgement. Login/pull validation
and exact original-or-current-derived confirmation caches use the same helper.

Derivation is read-only. Existing native profile/token, stage observations,
item captures, completed floors, queue/done and exact reply transactions remain.
No new table, migration, wire field, opcode, scoring formula or dependency.

## Deferred cases and limits

WRITTEN ONLY / NONE RUN: test_pve's existing36 first-score operations,36 lower
repeats and186 original unscored operations now exercise score-only delivery,
old/new cache, pure derivation, login/pull, exact restart bytes, once-only Iris,
no early ACK and immutable original source/queue. They include atomic save
rollback, changed current/high/counters/state/dates/tasks/owner/field/token
corruption, no-op forged marker, original pve_clear corruption and cached score
tampering. These are258 extended operations across222 existing stage cases,
not258 new contexts. One additional synthetic imported positive-score history
case lowers currentScore to0 while retaining highScore17 and the first date.

The352 existing original item-rank contexts in test_stage_caps now save the
score first, then exercise score-plus-item/rank/loot recovery and partial-item
refusal with the same full mixed ACK. They are extended, not new counts.
Fixture parties/stats/open stages/imported counters/dates/stock/signatures/save
order are synthetic, not natural earning, publisher scoring or native proof.

Native cold domain-vector lifecycle, repeated result notifications/screens,
actual save/clock/signature order, natural stage entry/unlocks, additive and
legacy recovery, duplicate-PC/repeated dated providers, remaining packets and
performance/no-crash/no-freeze acceptance remain incomplete or unverified.
Counts remain124 partial/51 unsupported/zero feature-complete. All149 packets
plus variants precede consolidated server/MuMu acceptance; co-op last.
No workers or GitHub Actions.
