# Interrupted stage CP-level refills, quests and voices

SOURCE ONLY / PARTIAL / UNTESTED — 2026-10-10. No tests, syntax/static
acceptance, generators, builds, APK work, listener restarts, emulator/ADB,
workers or GitHub Actions. Actual saves/runtime remain untouched; earlier DDL
remains UNAPPLIED. This adds no schema, dependency, wire field or native patch.
It does not establish gameplay stability or full packet acceptance.

Newer [CP-first remaining level effects](stage-cp-level-pending-contract.md)
supersede only the captured incomplete post-CP refusal and39 named contexts.
Its paired ARM64 adapter is source-only/NOT BUILT-INSTALLED. Earlier descriptions
below are history; coupled/additive effects and native acceptance remain pending.

## Original level fanout

Original23e6b08:23e7564 writes absolute active-hero CP. Its equal-level branch
23e6cb8 goes directly to23e7240, skipping the entire level fanout. A changed
level enumerates matching original PC IDs through23e758c, looks up each saved
unit through22eba54 with force0, refreshes its virtual80 stat provider and
calls22d0d30. This includes matching unjoined units, not only the active party.
Ineligible temporary guests skip that unit's refresh/refill, not ordinary
sibling units or the character's CP, quest and voice updates.

The relocated42a83e8 table has slot80=22d0f90,1c0=22d2d60 and1d8=22d2e9c.
The latter two read full HP/MP through their stat getters and tail-call the
absolute protected setters26115ac/26116bc. They do not add missing health.
The original selected-hero level event is emitted, then an actual matching
communication character enables quest246c0c4 and voice23a2fd8 refreshes.
Generic event subscribers and repeated UI notifications are not proven here.

Quest246c0c4 calls2452e28 before2451204. A nonzero saved stage state branches
at2452e68 to2453470 and returns false, so repeating the refresh does not reset
an open/completed/received quest to state1 or grant clear rewards. Voice
23a2fd8 uses the selected communication key and each voice's own hero level
for kind0, not a maximum of the three tracks. Kind2 checks globally owned
costumes independently of that selected key.23a4e9c permits state1 only;
23a5144 preserves already-owned2/3. Missing communication skips quests/voices.
Read-only excerpts: .work/stage-cp-level-cold-original-20261010.txt.

## Shared recovery

stageColdRecovery attributes level effects per captured character: original
quest adventure label, its communication voices plus global costume voices
when communication exists, and matching captured unit refill keys. It does
not broadly whitelist every unlock or voice observation.

While CP remains at its captured before points, eligible HP and MP must each
equal the captured before or target. Saved attributed refill/quest/voice
prefixes can retain the original absolute point setter and guarded fanout.
Once CP equals its saved target, every required persistent level effect must
already be present, including exact target HP/MP: the native equal-level
branch cannot finish missing effects. Mixed saved and unsaved characters are
independent; all original absolute targets and duplicates remain delivered.
Owner0/state1 CP-only initial rows reuse the earlier saved-presence proof.
Saved coupled unit acquisition is excluded rather than guessed from a CP row.

Only accepted closed cp: keys reach stageUntouchedDelivery's guest proof.
HP-first must still check original guest eligibility because the original
setter will actually execute the fanout. A closed CP skips the native lookup;
its originally skipped guest is not forced to full health or given a health
floor. Original character/unit/board/gear/stat/guest/active-hero/clock/level
hash/source/queue/token/signature guards remain. Foreign story unlocks and
unknown/missing/duplicate rows are not adopted as this character's CP effects.

Pure login/pull/confirm and exact original/current-derived caches compose
with objective/PvE-score/whole captured numeric-dated-rank/closed XP-SP proofs.
Saved XP still needs the earlier ARM64 adapter, NOT BUILT/INSTALLED. No CP
precredit, forced old level, target filter, guessed remainder or early/fake
ACK is introduced. Genuine full mixed save/ACK establishes existing indexed
CP/presence/voice floors. Character/unit tables are read once; existing atomic
profile/capture/observation/floor/queue-done/exact-reply transactions remain.

## Deferred cases

WRITTEN ONLY / NONE RUN:174 new contexts.162 in test_stage_caps combine
three completion modes, three heroes, owned/owner0/initial rows and six
HP-first/MP-first/quest-first/voice-first/CP-first/all-level-first save orders.
Two characters and duplicate CP targets, matching joined/unjoined units,
mixed closed/pending CP, exact caches/login-pull-restart, immutable queues,
no early ACK/extra Iris, health/stat/missing/duplicate row corruption, foreign
story unlocks, received objectives/PvE scores, whole items/ranks, closed XP,
full mixed ACK, rollback and damage after ACK are covered by written cases.

Twelve test_friendship_refills cases combine three heroes, originally eligible
or skipped original guests, and HP-first or closed CP. They change only the
actual adventure override at the original guest window boundary, so eligibility
is isolated from unrelated clock changes. Fifteen existing positive contexts
are extended: six lazy stage, three HP-first, three voice-first and three
quest-first. Twelve existing boundaries now contain genuine missing effects:
three saved-growth refills and nine row-only future-growth cases. These are
synthetic fixtures, not native earning/signing/construction/save-order proof.

Incomplete post-CP effects, coupled acquisition, additive clear/raid-SP/unit/
board/guest/story/feature/record and coalesced/legacy recovery remain unfinished.
Event subscribers, original scoring, native UI/save/signature/clock/ABI/unwind/
performance/no-crash/no-freeze acceptance remain unverified. Counts stay124
partial/51 unsupported/zero feature-complete. All149 packets plus variants
precede consolidated testing; co-op comes last.

This supersedes only blanket saved-growth/refill/quest/voice refusals when the
new before-or-fully-saved per-character proof holds. Earlier milestones remain
historical, not full feature acceptance.
