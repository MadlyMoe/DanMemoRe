# PvE rank items and repeated native gains

Newer [score-only recovery](pve-score-recovery-contract.md) supersedes only the
blanket saved-score refusal below. Exact score assignment is idempotent while
captured additive stage fields remain unchanged. The352 deferred rank-item
contexts now include saved score plus item prefixes; none were run.

SOURCE ONLY / PARTIAL / UNTESTED — 2026-10-10. No tests, syntax/static
acceptance checks, generators, builds, APK work, listener restarts or emulator/
ADB work. Actual saves were not opened or changed. No new DDL; earlier source
DDL remains UNAPPLIED. This is not full PvE or gameplay acceptance.

## Original callback and catalog

Original16000 has a separate rank-item loop before common stage rewards.
At246e56c..246e57c it passes each original full rank quantity and whole
signature w19 to item slot50;246e6f4..246e6f8 passes the same signature into
common246c564. Rank items must not also be inserted into gainedItems.
RewardType1 Iris bypasses native item gain; its existing server credit stays
unchanged. Empty/end rank iteration246e3d4/246e4f0 continues the handler,
just as the common empty item iterator246c72c continues other stage effects.

The original nested catalog has36 scored stages/144 rank rows:122 Iris rows
and22 S-rank UserStatusBoardItem rewards.14 of those grant one294000019 and
eight grant two. No ordinary or PC-selector ticket rank rewards are authored.
Source notes: `.work/pve-rank-item-recovery-original-20261010.txt`.

## Save proof and remaining delivery

stageRewardSources derives full original quantity, physical native gain-call
count, authored item-rank keys and duplicate-PC attribution in one map from
the immutable original parameters, original pve_rank_claim rows and captured
pc_before. Every wire loot row is one gain; every rank row is one gain even
when quantity2; each duplicate PC is a separate quantity1 bond gain. These
are private derived fields, not new wire/save fields or history migrations.

For captured numeric items with more than one physical gain whose raw lifetime
sum exceeds the cap, the shared stock observer now requires all retained
positive clamped stock additions as well
as actual issued signature and final lifetime before closing acquisition.
The first capped rank callback may retain stock/effect without closing item
observation; the later common grant can consume the remaining allowance.
Spending never renews additions. At full stock the zero allowance can close
when actual native signature/lifetime are saved; further clamped gains are
state-idempotent. Single-gain callers retain their prior spent-first proof.
An exact full-quantity lifetime delta plus issued signature also retains
spent-first proof for repeated gains: no clamping has lost quantity evidence.

Old repeated-gain captures marked observed without full positive-addition
proof where lifetime clamping lost quantity evidence are retained/unavailable,
including completed source checkpoints.
They are not silently upgraded. Likewise, spending before the first save
can make a repeated grant ambiguous; no current signature/capped lifetime
is treated as proof of the lost additions and no stock is fabricated.

Cold recovery can omit all whole original loot rows and non-Iris rank keys
for a fully observed captured numeric target. It preserves every untouched
quantity and server-Iris rank, original result score, identity/token/signature,
rank claim, full source/queue and required real mixed ACK. No partial rank
quantity, reminted currency or fake acknowledgement is introduced. Existing
login/pull/confirm exact original-or-current-derived cache handling is reused.
Saved additive XP/clear/SP/CP/units/unlocks/records still refuse cold replay;
shared untouched hero/clock/guest/refill guards remain. Duplicate-PC recovery
uses its newer exact occurrence control. Repeated dated providers now require
the separate complete date-addition proof in stage-ticket-reward-contract.md.

The map replaces the previous amount-only receipt pass; it adds no history
scan or per-target rank query. Existing compare-prior capture, profile/token,
stage marker, completed floor, queue/done and exact reply transactions/indexed
source lookups remain. No issuer, schema, public opcode or native patch changed.

## Deferred cases and remaining work

WRITTEN ONLY / NONE RUN:352 new test_stage_caps contexts across all22 original
item-rank rows, rank-only versus rank-plus-one-loot providers and eight cases:
exact/crossing/saturated lifetime, near-full/full stock, spending between gains
and ambiguous spent-first versus exact-counter spent-first. Original rank
quantities are unchanged; loot one,
before stock/counters, open-stage prerequisites, party/stat values, signatures
and save order are synthetic, not natural eligibility/drop or native proof.

Cases retain early partial markers/positive allowances, atomic save rollback,
no early ACK, refusal of forged early observation, full loot/rank filtering,
unchanged Iris ranks, old/derived cache/restart/exact bytes, whole source/queue,
actual mixed ACK, original rank-source corruption and completed missing-addition
proof, plus preserved unclamped full-counter proof after spending. The existing
two shared numeric PvE mode examples now derive both whole
loot and rank omissions rather than reject all shared providers. Rank-only
cache corruption uses a retained item identity even with empty wire loot.

Native cold domain-vector reset/lifecycle, result UI, actual signature/save
order, scoring fidelity, late ambiguous saves, uncaptured/legacy history,
saved/coalesced progression, other duplicate-PC variants, other
producers and remaining packets are unfinished/unverified. Counts remain124
partial/51 unsupported/zero feature-complete. All149 packets plus variants
precede consolidated server/MuMu acceptance; co-op last. No workers or Actions.
