# First and owned mission gacha-ticket rewards

SOURCE ONLY / PARTIAL / UNTESTED — 2026-10-10. No tests, acceptance checks,
builds, APK work, listener restarts or emulator/ADB work. Existing saves were
not opened or changed. No new DDL; earlier source DDL remains UNAPPLIED.

## Original source

Original6000 `236215c..2362170` calls native item slot50 with full positive
quantity in w25 and the whole-operation signature in w20. Empty item iteration
continues to independent PC/Memoria/casino fields. Ordinary tickets use the
same original `2575ac0 ->2576fa4/2576fec/2637738` first constructor and
`24d8844` gain described in [ticket acquisition](gacha-ticket-reward-contract.md).
Private first defaults are empty dates/book1/signature0/lifetime0; actual native
owner/ID insertion and book1-to3 gain are not server-written inventory.
Read-only evidence: `.work/mission-gacha-first-original-20261010.txt`.

The original catalog has2223 mission rows mapping18 ordinary-ticket IDs; no
PC-selector ticket mission rewards were invented. Original quantities are
preserved, including quantity5 for296000002. Eligibility, repeat windows and
PvP-source requirements remain original; catalog counts are not earning proof.

## Source changes

Fresh isolated mission gains use existing `achievement_item_claim.gacha_state`
and cap_version1: `offline-achievement-gacha-ticket-first-v1` for absent rows,
`offline-achievement-gacha-ticket-v1` for owned below-cap rows. Existing owned
saturated policies remain unchanged. Shared dated helpers retain native widths,
actual nonce, full original quantities/clamps and bounded additions. First rows
may be missing only before effects; book3/full lifetime/issued nonce proves
observation. No native profile precredit, partial remainder or fake ACK.

Existing cold login/pull/confirm recovery can keep untouched original quantities
or omit fully observed tickets alongside captured numeric/SP/Iris and supported
other rewards. Mission flags remain independent. Incomplete field observations
retain the actual operation and refuse replay. Existing hot/save-callback and
exact original-or-derived cache policies remain. Full original real ACK still
requires all claims/items/scalars and any unit/card/other captured effects.

Captured pending mission tickets block another same-item producer and native
lottery full-row replacement until actual ACK. Completed ticket reads use the
existing achievement_item_table indexed lifetime seek over18 static original
IDs; no lifetime history scan. Existing gift checkpoints/owned-date restoration
guards and atomic profile/capture/claim/queue/done/reply writes remain. Missing
completed rows, rewound lifetime, lost source proof and restored spent dates
refuse with the save retained; no legacy/coalesced history repair.

## Deferred cases

252 NEW WRITTEN ONLY `test_achievement_items.cjs` contexts: all18 original
classes, first/owned baselines, seven save prefixes. Cases include exact original
quantity/nonce/native fields/private baseline/no precredit/constructor flags,
same-item/full-row consumer interlocks, source tamper, cold bytes/restart,
early actual ACK, rollback, spent-date restoration/deletion and missing completed
rows. Named dated/mixed/consumer-first cases now383; earlier101 numeric cases
remain. Existing generic fixtures preserve actual nonce/full retained capture;
the two event-box/mission cases now require serialized real ACKs, not guessing
coalesced source order. No extra contexts counted for maintenance.

384 NEW WRITTEN ONLY `test_achievement_scalar_recovery.cjs` contexts: original
6020000100 ticket296000003 quantity1, Hero quantity2, SP50 and Iris10; every
flag/item subset, three SP states, first/owned ordinary-ticket baselines.192
following original10-Iris10200 refills. Scalar file now1264 named contexts/632
refills. Original capped cases remain; synthetic prerequisites/save prefixes
are not native earning/construction/signing/order/UI/performance proof. NONE RUN.

Other first producers, legacy/coalesced gains, uncaptured reward mixtures,
partial unit construction and remaining packet variants are unfinished. Casino0
still depends on the earlier unbuilt/uninstalled native adapter. Counts remain
124 partial/51 unsupported/zero feature-complete; all149 plus variants precede
consolidated server/native acceptance, co-op last.
