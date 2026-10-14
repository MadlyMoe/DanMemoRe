# Ordinary gacha-ticket reward acquisition

## Pending replay after ticket pruning — source only, untested (2026-10-14)

A ticket draw keeps its immutable operation1000 and exact captured post-spend
row for receipt validation. If native expiry cleanup removes another retained
date before the unit draw is fully acknowledged, replaying that old operation
or response root can reintroduce the pruned date even though the current row is
valid and its expenditure has not rewound.

The shared lottery recovery projection now admits only the immutable captured
ticket row or the one currently validated saved row. Pending login, confirmation
and exact draw retries project that current row into both plural/singular
operation delivery and the top-level `userGachaTicket` result. The original
queued operation, token, request, captured removed indexes and expenditure floor
are not rewritten. An older derived row that is neither original nor current
refuses instead of overwriting newer ticket state. Unit, bond, selector, scratch,
progress and real ACK requirements are unchanged.

The deferred lottery fixture prunes one retained post-spend date, checks pure
projection and exact retry roots, then acknowledges with the projected current
row. It is WRITTEN ONLY / NONE RUN. Natural expiry timing, multiple later
producer/prune steps, native import/save order, UI and stability remain
unverified. No tests, checks, builds, listener, APK, ADB, emulator, workers or
Actions ran; 176 partial / 0 unsupported / 0 verified complete.

## Consumed ticket-date lineage — source only, untested (2026-10-14)

The permanent ticket expenditure already stores the exact pre/post native
six-field row and the stable indexes removed by `lottery/ticket/draw`. Its
save guard previously compared only `cumulativeAmount - dateList.length`. A
same-length replacement could therefore restore one consumed `aquiredAt`
while deleting a different retained date without changing the spent count.

Pending and completed ticket saves now compare the current date multiset with
the captured post-draw multiset. Dates retained by the draw may disappear
through normal expiry or later spending. New dates beyond that multiset require
at least the same increase in cumulative lifetime acquisition, so a zero-gain
date swap is rejected. Genuine later acquisitions remain bounded by their
existing producer receipts and cumulative counter; duplicate timestamps are
counted as a multiset. No ticket row, date, counter, signature, queue or ACK is
prewritten or reconstructed.

The deferred lottery fixture adds an equal-spent-count consumed-date swap after
the real draw floor and requires transactional refusal. It is WRITTEN ONLY /
NONE RUN. Same-second independent acquisitions remain indistinguishable within
their actual lifetime increase; legacy history with no capture is not guessed.
Native expiry, producer interleavings, UI, save order and stability remain
unverified. No tests, checks, builds, listener, APK, ADB, emulator, workers or
Actions ran; 176 partial / 0 unsupported / 0 verified complete.

Latest [stage follow-up](stage-ticket-reward-contract.md) adds first/owned
ordinary5000/16000/25000 captures, same-item ACK interlocks and indexed completed
stage lifetime/source guards.83 authored rewards/30 classes are catalog counts,
not natural earning proof;488 additional contexts are WRITTEN ONLY / NONE RUN.
Stage partial/coalesced cold replay and every unrelated source limit remain.

The [mission follow-up](mission-ticket-reward-contract.md) adds first/owned
ordinary6000 ticket captures for18 original mission classes and indexed completed
mission lifetime reads.252 item/384 mixed contexts are WRITTEN ONLY / NONE RUN.
Other producer first acquisitions and all unrelated source limits below remain.

SOURCE ONLY / PARTIAL / UNTESTED — 2026-10-10. No tests, acceptance checks,
builds, packaging, installation, listener restarts or emulator/ADB work.
Actual saves/listener untouched; previous source DDL remains UNAPPLIED.

## Original client evidence

Original EU15.1.0 ARM64 first getter `2575ac0:2575c1c` uses
`2576fa4 ->2576fec ->2637738` for a missing backing row. That no-JSON
constructor initializes empty dates, book1, signature0 and lifetime0. The
getter assigns the actual owner (`20bad50 ->26378ac`), original master ID
(`2637988`), then inserts through `26b87f0`. These defaults are private receipt
baselines, never inventory written ahead of the client.

Common gain `24d8844` changes book1 to3, otherwise preserves the owned book
value, and forwards the full original positive quantity/actual nonce to the
dated setter and lifetime counter. Native fields remain exactly `userId`,
`gachaTicketId`, `dateList{aquiredAt}`, signed-byte `bookEntryState`, UInt32
`signature`, and `cumulativeAmount`. No amount/reservation/reset aliases or
serialized expiry are introduced. Expiry is at equality. The original catalog
contains261 ordinary-ticket IDs, all duration2592000; no new item, duration,
gift provenance or earning source was invented. Read-only extraction notes:
`.work/gacha-ticket-first-original-20261010.txt`.

## Shared source implementation

Fresh isolated Presents capture first ordinary tickets as
`offline-gift-gacha-ticket-first-v1`, and owned below-cap tickets as
`offline-gift-gacha-ticket-v1`. Existing owned saturated receipts retain their
cap policy. First shop tickets use `offline-shop-gacha-ticket-first-v1` and the
existing bound `capturePolicy`; owned shop policies remain unchanged.
All reuse dated receipt fields, original full quantities/native clamps, actual
nonce, exact table/ID/owner and bounded multiset additions. First rows may be
absent only before effects; book3/full lifetime/issued signature are required
for observation. No speculative inventory rows or second grants.

Pure dated-ticket Presents, including PC/ordinary mixtures and several classes,
reuse source-bound cold login/pull/confirm recovery. Retain untouched full
positive quantities; omit only fully observed items. Native gift flags remain
independent. Incomplete date/lifetime/signature effects refuse without guessed
remainders. Existing mixed shop recovery accepts these first captures; actual
original purchase count/date/all-reward ACK is still required.

Same-item producers and lottery full-row replacements wait for actual captured
reward ACK. Owned ticket deletion/lifetime rewind and restoration of spent or
expired dates without new acquisition are rejected. Completed Present reads
use indexed lifetime seeks over bounded original catalogs, one prepared query
per read. Real shop ACK alone advances its existing indexed source pointer;
lost pointer/source proof refuses. Existing atomic profile/capture/claim/queue/
done/reply updates are reused. No new DDL, save migration or inventory repair.

## Written deferred cases

`test_pc_ticket_inventory.cjs` now1599 contexts,687 NEW:126 representative
first/owned/seven-prefix/three-flag ordinary-ticket cases;24 mixed PC/ordinary
saved-subset/flag cases;516 remaining-catalog first/owned cases;21 first-shop
prefixes for original207000010/207000009/207000139 quantities/prices/windows.
Earlier PC cases remain. Future cases include source tampering, actual ACK,
rollback, restart/cache, no precredit, spent-date restoration, foreign fields,
completed-row/source-pointer loss and no second payment.

`test_shop_mixed_recovery.cjs` now178 contexts,32 NEW: all8 original nonempty
ordinary-ticket equipment/costume offers, four first-dated save prefixes each.
Original quantities, gear/wardrobe/voice handoffs and real source checkpoint
closure remain. Generic gift/shop fixtures retain actual nonce/old live dates
and original first-gain book3. NONE EXECUTED; synthetic prerequisites do not
prove earning provenance, native signing/save order, UI or stability.

Unfinished: other producer first acquisitions, legacy/coalesced histories,
mixed Presents with non-ticket rewards, partial unit/wardrobe construction and
remaining packet variants. Supersedes only missing ordinary-ticket constructor/
Present/pure dated recovery and912/146 fixture-total notes. Counts stay124
partial/51 unsupported/zero feature-complete; co-op last.

## Ticket draw input follow-up — source only, untested

`lottery/ticket/draw` now requires the existing exact native six-field ticket
validator before spending dates or returning the replacement row. The former
generic dated-item check admitted a row with no UInt32 signature or with
extra `amount`/`expireAt` fields, which the original `2638ac0`/`263aff0`
serialization does not produce. The deferred lottery fixture now uses native
ticket rows and tries malformed versions with an otherwise spendable single
draw; no check has run. No save, listener, APK or emulator state was changed.

The offline event-clock translator now preserves a saved ticket's age when its
native wall-clock acquisition predates the selected clock anchor by less than
the original ticket lifetime. It no longer treats a much older virtual date
from a previous clock selection as newly acquired after rewinding the clock.
Far-future dates remain future. This is a bounded offline provenance policy,
not recovered publisher behavior; overlapping arbitrary future virtual and
wall dates still need an explicit acquisition-lineage record. Deferred clock
assertions are written only, not run. No native profile or server save changed.

## Permanent ticket expenditure — source only, untested (2026-10-13)

Each fresh `lottery/ticket/draw` now stores the exact validated six-field row
before and after spending, original lifetime, captured event-clock translations
and stable removed indexes in `lottery_draw_claim.ticket_spend_json`. The real
ACK must include the exact replacement row. It advances
`lottery_ticket_spend_floor` using lifetime acquisitions minus retained dates,
bound to that completed operation. Pending/cold/settled replay, later draws and
later ticket saves reject a missing/corrupt capture, missing floor or restored
consumed dates without deleting the original evidence. Later acquisition,
expiry and spending can move the lifetime difference forward.

Settled exact retries keep the original result units but replace absolute
`UserLottery`, `userGachaTicket` and linked `UserScratch` roots with their current
validated saved rows. This avoids replaying an old post-draw snapshot after a
later draw or scratch action.

Deferred `test_lottery.cjs` cases cover restart, capture corruption, missing
ticket delta, settled popup-only replay, floor loss and stale-row restoration;
they are WRITTEN ONLY and have not run. Native setter/save/ACK order, UI and
stability remain unverified.
