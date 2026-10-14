# Familia item debit saved before its callback

SOURCE ONLY / PARTIAL / UNTESTED. This covers modern22200 when the actual
item debit is saved, but its additive donation count and timestamp still
match the captured before state. The paired ARM64 source is unbuilt and
uninstalled.

The original client checks live stock against `consumedItem.amount` before
debiting at `25722c4`; a positive replay can fail after an exhausted
wallet. It then obtains AppTime and calls the additive count/time helper
`2570f30` at `257231c`. The consumed-item wrapper remains live through
that call. Read-only original evidence is in
`.work/familia-item-paid-before-callback-original-20261010.txt`.

Cold login/confirm/pull require the original positive queued amount,
item/cap/contribution/token/signature and owned local Familia. The
retained modern charge flag must be1 with exact original cost subtracted
from amount and unchanged cumulative amount.
The live count and timestamp must still equal the captured before values;
the private observed count/time must be null and its version unchanged.
The current JST day must equal the issue day. Missing baselines,
partially saved callbacks, rewound stock, legacy receipts, altered
membership or later days do not take this path.

Confirm derives `consumedItem.amount:0` with nested
`offlineDonationCounterQuantity` equal to the original positive amount.
The source queue never stores the marker or zero price. The zero debit
passes the original affordability check and the existing zero-adder
guard skips only that already-saved debit. A208-byte caller-guarded leaf
at `153f2e0` reads the live wrapper, restores the original row and
int64 AppTime, and calls the original helper with the retained quantity.
Paid complete callbacks still use zero amount without this marker and
skip the helper. Exact unpaid complete callbacks keep positive price
with `offlineDonationCounterApplied:1` and skip that helper. Other
ordinary donations use the original helper. Other ABIs remain unchanged.

Only exact original or current derived singular/plural cached envelopes
are accepted; captured popup fields remain checked. After the genuine
callback save, a formerly marked cached reply becomes stale, while an
untouched original cache can derive plain zero amount. The real original
token ACK alone settles completed day/count, queue and done atomically.
No item/counter/time prewrite, bank recredit, extra contribution/skill,
new DDL or fake ACK is introduced. Earlier DDL stays unapplied and
actual saves/listener remain untouched.

`tools/test_familia_donation.cjs` now writes a cost-first case for each
of three original Faithstones, three new exhausted-wallet cases and
three new callback-progress cases. The latter save the callback without
ACK and exercise stale cache/rederivation before real ACK. There are
45 cold contexts within105 total written contexts, NONE RUN. Native
branch, caller, root, literal, saved-register and split-span assertions
are also written in `tools/test_client_native_patch.py`, NONE RUN.

Midnight across replay, partial count/time saves, coalesced charges,
capped item gains, legacy/historical membership and remaining packets
are unfinished. Native save order, signing, unwind, UI, performance and
crash/freeze behavior are unverified. The ledger remains124 partial,
51 unsupported, zero feature-complete; co-op comes last.

The newer [count-before-date branch](familia-item-count-before-date-contract.md)
handles a visibly saved count with its date still unchanged; it guards the
original date getter's own reset before skipping the count setter.
