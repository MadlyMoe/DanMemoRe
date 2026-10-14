# Complete Familia item cold recovery

SOURCE ONLY / PARTIAL / UNTESTED. Paired ARM64 changes are not built or
installed. This implements the fully saved modern22200 callback awaiting a
real acknowledgement, not every interrupted Faithstone donation.
This page describes the paid branch. The newer
[unpaid callback contract](familia-item-unpaid-recovery-contract.md)
extends the source adapter and covers exact unspent stock with
saved count/time; its positive price and nested marker supersede only the
earlier blanket unpaid refusal and12-byte leaf description below.
The newer [paid-before-callback contract](familia-item-paid-before-callback-contract.md)
adds the cost-first branch and extends the current source adapter to208 bytes.

## Original client contract

Pristine `2572068:2572444` parses `consumedItem.itemId/amount`, resolves
the owned item and compares the live amount with the original quantity.
At `25722c4` it debits through the original virtual method with the operation
signature. It then reads AppTime and calls `2570f30` at `257231c`, passing
the row, original quantity and int64 timestamp.

`2570f30:2571034` gets the date-aware count through `2570d3c`, adds
quantity, writes count through `2871e48`, then time through `2871f50`.
Unlike22100, this is an additive counter. Merely changing a consumed quantity
to zero would still invoke the count getter and replace the timestamp.

Read-only evidence: `.work/familia-item-complete-original-20261010.txt`.
Original hook bytes are `00013fd6` and `05fbff97`;12 original zero bytes at
`153f2e0` were read as source. No original native code, save or listener ran.

## Eligibility and delivery

Cold login/confirm/pull require a modern original positive-quantity operation,
valid owned item/master cap/contribution data and exact queue/token/signature
identity. Its retained `charge_seen=1` must still match actual saved
expenditure. The saved counter/time must be complete, and computed observations
and capture version must exactly match the retained private checkpoint.

A complete-looking item row cannot rebuild lost private counter/time proof or
a missing charge flag during a read. Normal/frozen format1, actual erased-count
format2 and reconciled second-read format3 keep their existing semantics.
No erased target, callback time or format is invented.

Item and Valis recovery now share the existing owned Familia/profile policy.
The actual local group/settings belong to the user; the native profile name,
optional offline ID, empty delayed label or actual indexed previous name must
identify that group. A synthetic profile ID is not required. Foreign/corrupt
membership refuses without erasing the receipt. Historical/recreated membership
attribution remains unfinished.

The queued original positive amount, item, token/signature and original
contribution/skill credit are unchanged. Only eligible confirm delivery changes
`consumedItem.amount` to zero. Original/current singular and plural cached
rows must exactly match; existing captured popup contribution fields are kept
and validated when present. Altered item/quantity/extra/popup or coherently
zeroed queued source rejects rather than authorizing a fresh zero-cost donation.

Login and binary pull only validate the pending branch, not carry operations.
Hot donor retries remain guarded. Push omission prevents additive redelivery;
it does not remove the queue or acknowledge anything.

## Paired ARM64 source

Only BLR `25722c4` redirects to the existing zero-int32 adder guard at
`153f070`. Zero quantity skips the virtual debit, avoiding another signature/
book/dirty mutation; ordinary nonzero debit keeps original arguments and link.

The initial paid branch used a12-byte guarded leaf at `153f2e0`:
zero W1 returned, otherwise it branched to original `2570f30`.
The newer unpaid branch extends that leaf while preserving this zero path.
A fully checkpointed zero projection therefore skips the entire already-saved
count/time callback. Nonzero donations retain original row X0, quantity W1,
timestamp X2 and return link.

Original parsers, lookup, affordability failure, AppTime provider and wrapper
cleanup, item/JSON cleanup, canary/unwind, and nonzero helper/setters stay intact.
The paid projection has no source control field; the newer unpaid projection
uses a nested callback marker. No new count/time injection, purchase/authentication/
signature bypass or acknowledgement bypass is introduced. Other ABIs remain
unchanged. Native generic operation/event handling, lifecycle/unwind, signing,
clock, UI and no-crash/no-freeze behavior remain unverified.

## Persistence and deferred cases

Existing atomic item/profile token, private charge/count/time/format,
completed callback day/count, queue/done and exact-reply transactions remain.
Only complete actual charge/count/time and the real original token ACK settle
the receipt. Already saved normal/exhausted cases can use an ACK-only save
without rewriting the item row/token/signature/count/date. The private completed
day/count checkpoint still updates atomically.

No precredit, fake early ACK, native field/signature prewrite, repeated
contribution/skill reward, new issuer, DDL, dependency or history scan.
Earlier nullable DDL/index changes remain SOURCE ONLY / UNAPPLIED. Actual
saves and running listener/emulator were untouched.

Six new written contexts cover three original Faithstone types with
paid-complete and paid-exhausted modes. Twelve existing frozen-clock,
midnight-after-reset, erased-midnight and paused-erased contexts gain cold
recovery assertions:18 complete cold contexts within90 recovery contexts.

Cases cover pure original/current caches, plural/singular popup metadata,
login/pull/confirm/restart, unchanged positive source and once-only rewards,
lost private checkpoint/charge, foreign membership, malformed wire/queued
zero, refund/rewind/owner/shape/clock/format guards, ACK-only exact item
preservation, rollback and settled retry. Native assertions cover original
hooks/padding, zero/nonzero branches/arguments, unchanged parser/affordability/
AppTime/helper/cleanup spans, mismatch guards, split-file spans and other ABI.

WRITTEN ONLY / NONE RUN. Funding, group, signatures, clock and save-order
fixtures are synthetic, not native earning/signing/order/UI acceptance.

Half-saved charge/count/time, capped producer attribution, legacy/coalesced and
historical membership, other packets and co-op remain unfinished. Counts124
partial/51 unsupported/zero feature-complete unchanged. All149 packets plus
variants precede consolidated testing; co-op last. No tests, smoke/syntax/
static acceptance checks, generators, builds, APK work, restarts, emulator/ADB,
workers or Actions ran.
