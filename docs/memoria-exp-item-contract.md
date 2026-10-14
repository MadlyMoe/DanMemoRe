# Memoria EXP item inventory and reward handoffs

## Current source milestone — PARTIAL / UNTESTED (2026-10-10)

This records implementation, not verified gameplay. No tests, static acceptance
checks, generators, builds, listener restarts or emulator/ADB checks were run.
Actual saves and the listener are untouched; earlier schema work remains
SOURCE ONLY / UNAPPLIED. Co-op comes last and the consolidated acceptance pass
starts only after all original packets and their unfinished branches are implemented.

## Original client contract

Pristine EU15.1.0 ARM64 reader264a200:264a840 serializes exactly eight fields:
`userId`, `memoriaExpItemId`, `amount`, `bookEntryState`, `signature`,
`lastAquiredAt`, `cumulativeAmount`, `reservedAmount`.
The original spelling is lastAquiredAt, not lastAcquiredAt or lastResetAt.
Setter26498f4 uses protected UInt8 book state;26499d8 uses protected UInt32
signature, without truncating to a byte.2649ab8 stores the Int64 timestamp;
the local implementation preserves safe nonnegative integer values.

Constructor2649418 initializes book1 and the other serialized fields0.
Factory24ff0f0/24fe1f8 assigns the actual current owner and original item ID,
then inserts the owned row. New client-saved rows therefore start with timestamp0;
the server does not pre-create inventory or credit stock on the client's behalf.

The time-aware getter24feb98 and setter24fed3c are gated through24d8ed4
and244ae20. That gate recognizes only item_type.gacha_ticket,
item_type.pc_ticket and item_type.subscription_ticket. Constructor24fdf58
uses item_type.memoria_exp_item, so the expiry/timestamp-refresh branch is
inactive for the actual Memoria EXP type. Neither its ordinary gains/spending
nor an event-clock change should clear stock or refresh lastAquiredAt.
This supersedes earlier suggestions that Memoria EXP required an event-clock
expiry path; it does not assert that all enhancement/consumption is implemented.

Vtable42bc4e0 uses ordinary gain24d8844, maximum24d8d6c and lifetime24d8d94.
Original itemType200000037 has maximum999999999, recovered directly from
itemType.enc. No synthetic expiry duration or replacement-stock rule is added.

## Original data retained

All five original memoriaExpItem.enc IDs remain unchanged:
1208000001 is general-purpose;1208100001..4 target1201000001..4 respectively.
The original data has no standalone shop offers, linked shop-pack offers or
final event-box prizes of these five items; none are invented.

Ten original non-War-Game missions reward10 of general item1208000001:
6080000002/4/5/7/8/10/20/22/56/58. Their category8, rewardType31 and
1630461600..2145898799 windows are retained. Archived master slot6 values
are not converted into an expiry policy for a type that fails the native gate.

## Shared implementation

The existing2000/6000/9000 numeric reward machinery now accepts these items:
actual owned before-row/full old-signature exclusion, bounded original quantity,
positive-addition allowance, spending closure, actual client signature/capped
cumulative observation, effect replay suppression, full mixed acknowledgement,
atomic save/receipt/queue/reply writes and completed-stock checkpoints.
No new wire format, native signing claim, issuer, master rewrite, schema or ledger.

User-data push requires unique, actual original eight-field rows and preserves
the prior acquisition timestamp; absent rows require timestamp0. Unknown or
incomplete retained legacy rows refuse reconciliation rather than having fields
invented or real saves rewritten. Mission acknowledgements use the same strict
item validator as the other reward producers.

## Deferred cases — WRITTEN ONLY / NONE RUN

51 new scenarios are written:35 Present cap orders for all five item IDs,
seven cap-save orders for the first authored mission, and nine additional
authored mission cases retaining their original quantity/window. They cover
native fields/widths, unchanged timestamps even beyond the dormant duration,
malformed/corrupt captures, partial spending/allowance closure, flags/full ACK,
rollback, cold/exact retries and completed stock restoration/rewind/deletion.
Generic stage/feature/Element/friendship fixture constructors retain the actual
timestamp/reserved fields; those are deferred test rows, not real player writes.

Synthetic gifts, funding, eligibility, time and save order are not native earning,
callback or UI proof. Individual-target enhancement, actual EXP consumption,
other producer constructors, field/coalesced saves, legacy reconciliation and
native signatures/order/UI/clock/recovery/performance/no-crash/no-freeze evidence
remain unfinished or unverified.125 partial/50 unsupported route counts remain
unchanged; no route or full Memoria feature is claimed complete.
