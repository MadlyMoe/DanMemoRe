# Familia item callback saved before payment

SOURCE ONLY / PARTIAL / UNTESTED. The paired ARM64 patch is unbuilt and
uninstalled. This covers a modern22200 donation whose additive count and
timestamp are fully saved while the original item cost is still unpaid.

## Original client and eligibility

The original client parses `consumedItem.amount`, debits that quantity at
`25722c4`, then calls `2570f30` at `257231c`. That callback adds the
quantity to the date-aware donation count and writes the timestamp. Its
consumed-item wrapper is still live at original SP+78 when the callback
runs. See `.work/familia-item-unpaid-original-20261010.txt` and the
[paid branch](familia-item-complete-recovery-contract.md).

Cold login/confirm/pull require the original positive-cost queued item,
receipt, token, signature, original cap/contribution and owned Familia
identity. The live item amount and cumulative amount must exactly equal
the retained before values. The actual count and timestamp must both be
complete; their retained observations and capture version must match
the private checkpoint. A changed wallet, missing checkpoint, half-saved
counter/time, legacy receipt or foreign membership cannot use this path.

The source queue keeps its positive price. Confirm derives the same price
with nested `consumedItem.offlineDonationCounterApplied:1`; login and
binary pull only validate. Singular/plural cached operations must match
the original source or the current derived reply exactly. Captured popup
fields remain checked. The marker is never accepted in queued source.
An old marker reply becomes stale after the genuine item debit is saved;
an untouched cached original can then derive the paid amount-zero reply.

## Native and persistence boundary

The existing zero-adder hook skips a debit only for a paid amount-zero
projection. The original positive debit, affordability check, row,
signature, AppTime and cleanup remain for this unpaid projection.
The callback hook at `257231c` now points to a208-byte leaf at `153f2e0`.
It checks the original caller before accessing the live JSON wrapper,
returns immediately on zero amount, and parses the nested marker only
for a positive amount from that caller. Exactly1 skips the already-saved
count/time callback; absent or other values call the original helper.
The leaf restores the original row/amount/int64 time, saved registers,
link and stack before returning or calling the helper. Other ABIs are
unchanged. This is source design, not native acceptance.
The additional [paid-before-callback branch](familia-item-paid-before-callback-contract.md)
uses a separate nested quantity when the original price was already saved.

The actual saved debit can update the retained charge flag, but it does
not acknowledge the operation. Only the real original token ACK updates
the completed callback day/count, removes the queue and records done.
There is no precredit, counter/time rewrite, repeated Familia points or
skill grant, new schema or extra history scan. Earlier schema changes
remain unapplied and actual saves are untouched.

Three new modes for each of the three original Faithstones add9 written
contexts: unpaid-complete, unpaid-exhausted and unpaid-progress. Nine
existing unpaid midnight/paused contexts also gain this cold branch.
Across paid and unpaid cases,36 cold contexts sit within99 recovery
contexts in `tools/test_familia_donation.cjs`. Deferred native assertions
are in `tools/test_client_native_patch.py`. NONE RUN.

Unpaid-progress covers the real debit arriving without ACK: the prior
marked cached reply must refuse, while an original cached reply derives
the paid zero amount, then the real ACK settles once. Changed stock,
malformed marker, poisoned queue/popup, lost checkpoint, altered owner,
rollback and an exhausted wallet are written cases only.

Partial counters/time/debit, old or coalesced histories, capped producer
attribution and historical group membership remain unfinished. Original
native save order, signing, events, lifecycle/unwind, UI, performance and
crash/freeze behavior are unverified. Route counts remain124 partial,
51 unsupported, zero marked complete; all packets precede consolidated
testing and peer-dependent systems come last.
