# Paid and exact-unpaid Familia Valis recovery contract

SOURCE ONLY / PARTIAL / UNTESTED. The paired ARM64 change is not built or
installed. This closes modern charged and exact-unpaid counter cold branches, not the
whole Familia feature or every interrupted save.

## Original client evidence

Pristine ARM64 operation22100, `243ac68:243b150`, reads the original
`consumedValis` and compares it with the live wallet at `243ad04`.
The ordinary path puts the negative debit in W1, the original signature in
W2, and calls the currency virtual method through X8 at `243aeac`.
Its original instruction bytes are `00013fd6`.

It then reads the original int64 `donatedAt` and assigns each selected
absolute count/date through `2439d30:2439e20`. That helper calls the count
setter `2871068` and timestamp setter `2871170`. The original comparisons
at `28710cc` and `28711d0` branch past dirty-byte writes when values are
equal. These are setter contracts, not proof of observed native save order.

Read-only evidence: `.work/familia-valis-paid-original-20261010.txt`.
No original native code, listener, save or emulator was executed.

## Source delivery and membership

Recovery requires the original pending operation identity, full positive
authored cost, original body hash/quantities, actual owned before-counter
capture and actual monotonic observations. A retained `charge_seen=1` plus live
saved Valis expenditure proof derives zero debit. An `effect_seen=1` receipt
with actual selected counter observations, `charge_seen=0`, and wallet amount
and cumulative exactly equal to its captured before values retains the original
full charge. The captured spending bound must also be that before balance minus
the original cost; a lower bound carrying another unresolved debit refuses.
The absolute counter setters make this a remaining currency debit,
not another count addition. Any ambiguous altered wallet, missing charge flag
after a saved debit, coalesced gain, or legacy missing capture remains guarded.

The source guard now follows the existing local membership policy: the actual
local group belongs to the saved user and its settings/name are readable.
The profile's `familiaName` is the native label. It need not invent
`familiaId`; when that optional offline field exists, it must match.
An empty delayed label or an actual indexed previous name can refer to the
existing local group. Unknown names, foreign IDs/owners and corrupt settings
refuse without changing the save. Event-clock rewinds do not recreate or
expire membership. Recreated/historical membership attribution is unfinished.

The queued operation retains its original full cost, captured contribution
points, counts, timestamp, token and signature. A delivery projection replaces
only `consumedValis` with zero after the retained charge; exact-unpaid replay
keeps the full original cost. Cached singular and
plural envelopes must exactly equal the original queued operation, its
captured-CP projection or the current derived envelope; altered fields refuse.

`user_data/confirm` carries that projection. Login and binary pull validate
the pending receipt but do not carry operations. A partially saved hot
`familia/donate/valis` retry remains guarded. Push suppression prevents
another additive callback and is not acknowledgement or completion.

## Paired native source

Only BLR `243aeac` redirects to the existing 12-byte zero-int32 thunk at
`153f070`: zero W1 returns; nonzero W1 tail-branches to original X8.
The derived zero cost passes the original affordability check, including an
exhausted wallet, without calling a zero currency adder that could rewrite its
signature or dirty state. Nonzero debit preserves original row X0, quantity
W1, signature W2, target X8 and link.

Original parsers, affordability failure, absolute count/date setters,
reference cleanup, canary and unwind paths remain. No new cave, currency
precredit, purchase authentication bypass or acknowledgement bypass is added.
ARM64 only; other ABIs are unchanged. Native lifecycle, zero-event behavior,
ordering, signing and UI remain unverified.

## Persistence and deferred cases

The existing atomic receipt/profile/queue/floor/done/reply transaction remains
the only settlement path. Complete actual charge and every selected original
counter field, or its permitted daily reset with the issued timestamp, plus
the real token acknowledgement are still required. The bank contribution is
credited once by the original offline issuer; recovery never credits it again.
That bank policy is an offline reconstruction, not recovered publisher logic.

After a saved charge, remaining counter-only saves need no currency delta.
When the same-day absolute counters/date are already complete, a real ACK-only
save can settle the receipt without another profile or effect checkpoint write.
No partial observation prewrites a completed floor or fake acknowledgement.

Five new written contexts cover paid count-first, date-first, mixed counters,
complete-but-unacknowledged fields and an exhausted wallet. Existing cost-first
and midnight contexts are extended: seven modern paid contexts within the
13-context recovery matrix. Three existing counters-first/count-first/date-first
contexts now cover exact-unpaid cold replay: ten modern cold contexts in total.
Changed unpaid amount minus one/full cost/plus one, cumulative plus one, and
cached zero-cost envelopes and lower captured spending ceilings refuse without
writes rather than guessing a debit or collapsing coalesced charges.
Cases also cover native profiles without synthetic
IDs, optional matching IDs, empty/recorded old labels, corrupted membership,
pure cached projections/login/pull/confirm/restart, unchanged source cost and
bank, no Currency row/token/signature rewrite, malformed cached controls,
coherent queued zero-cost injection, refunds/rewinds, early ACK rejection,
transaction rollback and exact settled retries. Native assertions preserve
the original parsers, setters, arguments, cleanup, mismatch guards and other ABI.

All cases are WRITTEN ONLY / NONE RUN. Funding, group membership, signatures
and save prefixes are synthetic, not natural earning/native signing/UI proof.
No new DDL or dependency; earlier nullable capture DDL remains UNAPPLIED.

Legacy/coalesced creation/donation/capped-reward attribution, equivalent22000/
22200 recovery, historical membership, midnight interleaving and other packet
branches remain unfinished. Coverage remains124 partial/51 unsupported/zero
feature-complete. All149 packets and discovered variants precede consolidated
testing; co-op last. Runtime and actual saves are untouched. No tests, checks,
generators, builds, APK work, listener restarts, emulator/ADB, workers or Actions.
