# CP-first interrupted stage level effects

SOURCE ONLY / PARTIAL / UNTESTED — 2026-10-10. Paired ARM64 adapter NOT BUILT
or INSTALLED. No tests, syntax/static acceptance, generators, builds, APK work,
listener restarts, emulator/ADB, workers or GitHub Actions. Actual saves/runtime
remain untouched; earlier DDL remains UNAPPLIED. This is not a playable/native
acceptance result. Other ABIs and unpaired clients do not implement this control.

## Why the original callback cannot finish by itself

The original stage common246c564 retains each friendshipStates JSON entry at
SP+70. It resolves the character and calls23e6b08 at246ce74, so the CP setter's
saved caller LR is246ce78. The setter has frameA0 and stores LR atSP+98.
It assigns the original absolute points before comparing old/current levels.
At23e6cb8 an equal level skips every refill/quest/voice effect to23e7240.
Thus saved exact CP with missing effects cannot recover through plain replay.

The original fanout23e6cbc initializes its own argument X0 from the character;
it does not require a fake old CP value. Original matching-unit lookup/stat
refresh/fullHP-MP and selected-hero notification are followed by the guarded
quest and own-hero/global-costume voice refreshes described in
[the existing level contract](stage-cp-level-recovery-contract.md). Original
state guards preserve already-saved quest/voice effects; full health setters
assign rather than add. Event subscribers and repeated UI notifications still
need consolidated native acceptance, not an invented completion marker.

## Source-only paired adapter

tools/offline_client.py redirects only23e6cb8 into112 originally zero bytes
153f0e0:153f150, after the earlier XP adapter. The original changed-level branch
immediately continues23e6cbc. For an equal level, it compares the original
saved LR atCP-SP+98 against position-independent246ce78. Every other caller
continues the original epilogue without accessing a presumed caller JSON.

Only that exact common call reads its still-live entry at shim-SP+130:
shim frame20 +CP frameA0 +common local70. Original13b1f5c and13b28d0 with
default0 read offlineStageCpLevelPending. Only exact numeric1 re-enters the
original fanout23e6cbc; absent/other values retain23e7240. The shim saves and
restores its frame/link and original callee-saved character/hero registers.
Original points, clamps, level calculation, protected dirty setter, fanout,
canary/cleanup, signatures, authentication and real save/ACK remain unchanged.

The source patch guards the exact original equal instruction and zero span.
Pristine unwind boundaries, bytes and original relocations were read; no
native function, patch builder or acceptance check was executed. Address
references, instruction encodings, exceptional unwinding/JSON errors, actual
frame/vector/cache/UI lifecycle and other ABIs remain deferred acceptance.

## Server derivation and persistence

stageColdRecovery retains its original receipt, immutable source operation and
queue, level hash, active hero, exact before-or-target points, captured tracks,
owner/state/initializer presence, units/boards/gear/stat inputs and attributed
quest/voice/refill proof. Saved exact-target CP with missing attributed persistent
keys is pending. Each eligible HP/MP must still be exactly captured before or
target; an observed field cannot rewind. A coupled acquisition is admitted only
when every matching gained PC has exact current/durable saved-unit, guest and
remaining-effect proof. Its acquisition-created character row must retain owner0,
state1/2/3 and untouched other hero tracks. Foreign story effects and additive
progression are not waived.

The server derives the control on the first original friendshipStates entry
per pending character only. Every original absolute value and duplicate stays
present. Fully closed and still-unsaved characters have no control. Pending
fanout still checks original temporary-guest eligibility despite saved points;
closed skipped guests retain their actual health and get no refill/health floor.
Mixed pending/closed/unsaved characters compose without a global forced level.
The pending CP marker composes with the existing unit control. After the exact
fanout is saved, a cached combined envelope may lose only its CP marker; a fully
closed CP branch retains only the unit control.

Pure login/pull/confirm and exact original/current-derived cache guards retain
all original quantities/signatures/tokens/queue and full genuine mixed ACK.
An exact original cached envelope can derive today's controls; mutated controls
that match neither original nor current derivation refuse. Injecting a control
into coherent source queue/capture fails the original two-field state shape.
Objective/PvE-score/whole captured item-rank omission and closed XP recovery
remain independent. No precredit, CP rollback, guessed remainder, new source
operation or early/fake ACK. Existing atomic observations/profiles/captures/
indexed CP-presence/voice floors/queue-done/exact replies are reused; no new
schema, dependency, per-character persistence query or history scan.

## Written cases, not results

213 NEW / NONE RUN: the prior141 contexts plus72 coupled stage-unit contexts
combine two original guest identities, three capture roles, three heroes,
present/absent character and pending/complete fanout. The prior135 stage_caps
contexts combine three modes, three heroes, owned/owner0/initial rows and five
CP+HP/MP/quest/voice/both-character prefixes.
The existing level matrix grows162 to297. Six pending CP-first guest cases
grow its matrix12 to18; changed native adventure override refuses until the
original eligibility is restored.39 existing contexts are extended:27 CP-first,
three saved-growth missing-refill boundaries and nine lazy-row-to-target cases.

Written coverage retains original targets/duplicates, two characters, joined
and unjoined units, pure cached/login/pull/restart/exact bytes, full immutable
queue, no early ACK/extra Iris, health/stat/row/owner/track/foreign-story corruption,
full mixed ACK/floors/rollback/post-ACK damage. Five invalid cache controls and
coherent original-source injection refuse; original cached replies still
re-derive. Native patch tests define branch/ADRP/saved-LR/JSON-frame/default-
control/literal/spans/unchanged setter-fanout/ABI/mismatch assertions, NOT RUN.
All prerequisites, signatures and save ordering are synthetic fixture data.

Coupled acquisition without every exact saved-unit proof, additive clear/raid-SP/
unit/board/guest/story/feature/record, coalesced/legacy and unknown item-prefix
recovery remain unfinished. Original
scoring and native earning/signing/notifications/JSON-vector/UI/save/clock/ABI/
unwind/errors/performance/no-crash-no-freeze acceptance remain unverified.
Counts stay173 partial/3 unsupported/zero verified complete across176. All176
tracked routes plus variants precede consolidated testing; co-op remains last.

This supersedes the captured incomplete post-CP fanout refusal, the exact
coupled saved-unit branch and39 named earlier contexts when the new source proof
holds. It does not supersede coupled acquisition without that proof,
additive-state or native acceptance limits.
