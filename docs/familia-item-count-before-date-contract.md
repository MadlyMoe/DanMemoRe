# Familia donation count saved before timestamp

SOURCE ONLY / PARTIAL / UNTESTED. This covers a modern22200 item
donation when its original additive count is saved but its timestamp
still equals the captured before value. Payment may already be saved
or still be owed. The paired ARM64 source is unbuilt and uninstalled.

The original helper `2570f30` calls date-aware getter `2570d3c`,
adds the donation quantity, sets count at `2570f7c`, then sets the
int64 date at `2570f88`. The getter itself can reset count to zero
when the stored date belongs to another JST day. Read-only evidence:
`.work/familia-item-count-only-original-20261010.txt`.

The cold server branch requires an original positive queued item,
token/signature/cap/contribution, current owned Familia and modern
private capture. The actual count must equal the original issued
target and visibly differ from the before count. Its saved private
count must match; private time is still null and version unchanged.
The item timestamp must equal the captured before timestamp, which
must already be in the issue day. The current event clock must stay
in that day with at least120 seconds before rollover. Payment must
be either exactly untouched, or exactly the original cost lower
with cumulative stock unchanged and the retained charge flag set.
Previous-day, frozen, half-observed, changed-wallet, legacy or
coalesced evidence cannot enter this branch.

Confirm derives `offlineDonationCountApplied:1` inside `consumedItem`.
An unpaid replay keeps original positive `amount`; a paid replay uses
`amount:0` plus `offlineDonationCounterQuantity` equal to the
original positive amount. The source queue stays positive and has
no markers. The existing callback leaf sends that positive quantity
to original helper even when the item debit is already saved.
A separate144-byte leaf at `153f3b0` checks both original return
addresses, reads the live consumed-item wrapper, skips only the
already-saved count setter for marker1, then lets the original
timestamp setter finish. Other helpers and other ABIs are unchanged.

Cached singular/plural operations and popup fields must match the
source or current derived state exactly. If the date, debit or both
are saved later, the old derived reply becomes stale; an untouched
original cache derives the new phase. Only real saved payment,
complete count/time and the original token ACK settle the queue,
completed day/count and done record atomically. No counter/date/
stock prewrite, extra contribution/skill, recredit or new DDL.
Earlier DDL remains unapplied; actual saves/listener untouched.

`tools/test_familia_donation.cjs` writes four new Faithstone modes
for paid-progress, paid-exhausted, unpaid-progress and unpaid-exhausted,
and extends the existing unpaid count-first mode. It also writes
old-day and near-midnight refusals. There are60 cold contexts within123 total
written recovery contexts, NONE RUN. Native original-byte, caller,
root, branch and patched-span assertions are written only.

The separate [date-before-count contract](familia-item-date-before-count-contract.md)
covers only a visibly saved same-day timestamp with unchanged count.
The [older/zero-date count contract](familia-item-old-day-count-contract.md) covers
an exact changed count by letting the original zero-count getter path and setter run;
it does not use this same-day count-skip marker.
Other timestamp-first paths, ambiguous previous-day resets, coalesced spending, capped acquisition, legacy membership,
original native save order, signatures, unwind, UI, performance and
crash/freeze behavior remain unfinished or unverified. The ledger
remains124 partial/51 unsupported/zero feature-complete. All packets
precede consolidated testing; peer-dependent systems come last.
