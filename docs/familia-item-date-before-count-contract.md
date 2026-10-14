# Familia donation timestamp saved before count

SOURCE ONLY / PARTIAL / UNTESTED. This covers a modern22200 item
donation whose callback timestamp is saved but whose count still equals
the captured before count. The item debit may be saved or still owed.
The paired ARM64 source is unbuilt and uninstalled.

The original `2570f30` helper reads a date-aware count, adds the
original quantity, writes count at `2570f7c`, then writes the int64
timestamp at `2570f88`. The getter can itself zero count on another
JST day. Read-only evidence is in
`.work/familia-item-date-only-original-20261010.txt`.

Cold replay requires the original positive queue, exact item/cap/
contribution/token/signature and current owned Familia. Private
`observed.at` must equal the actual saved date; private count remains
null and capture version unchanged. The date must visibly differ from
the captured before date and belong to the issue day. The actual count
must still equal its before value. A nonzero before count requires a
prior timestamp already in the issue day; an exact zero before count
also permits a zero or older timestamp no later than the saved date.
The current event clock is no earlier than the saved date and remains
in the issue day for the next120 seconds. Stock is either exactly
untouched with `charge_seen=0`, or exactly the original debit with
`charge_seen=1` and unchanged cumulative amount. Nonzero previous-day,
identical-date, near-midnight, legacy, coalesced or changed stock is
not inferred as this branch.

Confirm derives `offlineDonationDateApplied:1` only inside the live
`consumedItem`. Unpaid replay retains the original positive amount;
paid replay has amount0 plus the original positive
`offlineDonationCounterQuantity`. The source queue retains the
positive amount with no marker. The existing callback leaf restores
the positive count quantity after a saved debit; the count getter and
setter run normally. A new144-byte leaf at `153f440` checks immediate
return `2570f8c` and saved outer return `2572320` before accessing
the wrapper. Marker1 skips only the already-saved date setter;
ordinary/foreign calls retain the original int64 setter and X1.

Only exact original/current cached singular or plural operations and
captured popup are accepted. A later actual count or debit save makes
the earlier marked reply stale. The original cached reply derives the
current phase. Login/pull only validate; hot retries stay guarded.
Saved debit, count, date and original token ACK remain separate. The
existing atomic receipt/owned-row/queue/day/count/done/reply path is
reused, with no prewrite, duplicate contribution/skill, recredit,
new DDL or fabricated ACK. Earlier DDL remains unapplied.

`tools/test_familia_donation.cjs` extends existing date-first for all
three original Faithstones, writes paid/unpaid progress and exhausted
stock modes, and adds old-day and near-midnight refusals. Four more
zero-before-count modes add12 written contexts;105 cold within168
total recovery contexts. Native original-byte, dual
caller, root, int64 argument, branch and patched-span assertions are
written. All tests are DEFERRED / NONE RUN.

Nonzero old-day count, cross-day getter reset, indistinguishable timestamp, mixed/coalesced
stock, capped acquisition, legacy membership and other packets remain.
Original save order, signing, native lifecycle, ABI/unwind, UI,
performance and crash/freeze behavior are unverified. All149 packets
and variants precede consolidated testing; co-op remains last.
