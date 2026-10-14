# Outfit Refinement point and brush persistence

SOURCE ONLY; functional/synthetic/native checks **DEFERRED / NOT RUN**.
This extends `dress_point/complete`, operation29000, not full gameplay or
emulator acceptance. Actual player save/listener/APK/MuMu remain untouched.

## Permanent completion identity (2026-10-13 source milestone)

Every newly issued completion stores the actual request key and encrypted-wire
MD5, an order-independent semantic hash, canonical signed operation29000, the
exact newly claimed `(pcId, DP-level ID)` pairs, and the immutable Iris journal
row created for their original reward. These captures share the existing
profile, reward, wallet, operation and reply transaction.

An exact pending replay requires the live queue and returns its original
operation. After the real client save and acknowledgement, the same identity
requires the exclusive done state, canonical capture, every saved point target,
the retained permanent-PC floor, all captured reward rows and the original
bounded Iris transaction. Brush requests additionally retain their existing
acquisition-minus-stock expenditure proof. A valid settled retry returns the
original root fields with `operations: []`; it cannot apply DP, Iris or brushes
again. Changed bytes, noncanonical captures, missing effects, invalid journal
balances and queue/done ambiguity fail without mutating the retained state.

Legacy pending operations may still use their exact live queue. Legacy settled
operations issued before the permanent captures remain unavailable rather than
being reconstructed from current balances. Deferred cases cover pending and
settled cache eviction, restart, capture/state/floor/reward/journal/expenditure
corruption and rollback. They are written only and have not been executed.

## Original client evidence

Original ARM64 SHA256:
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
Original master SHA256:
`33050aa58301f430795a49909c37ae5eda1990730483e7761bceaef3a1be84db`.
Hashes and original unwind bounds were rechecked read-only this turn.

Existing `.work/dress-point-decompile.txt` request/callback/operation material
was inspected; its PIC/tail guesses are not authoritative. Bounded original
ASM confirms exact FDE `2579244:25797dc`: `25794e4` negates the requested
brush quantity, and `25794ec..25794f4` calls the inventory vtable+0x50 grant
with that negative amount. Exact request `25797dc:2579f3c` and callback
`257a710:257a7e0` bounds match the original binary. Decompiler addresses
subtract `0x100000`.

Bounded FDE `15eb9e4:15ebce8` loads the callback's absolute point total at
`15eba20`, then calls `22e60b4` at `15eba24`. That exact eight-byte helper
tail-calls `2614f70:2615080`, which assigns the existing native currentDP
field and marks it dirty rather than adding points again. Battle callback
`15ddd68:15de630` computes the total through `25786e4`, sets it at
`15dde4c` and clears battle participation at `15dde58`. The setter asserts
below2000000001. This proves field assignment, not all legitimate resets,
save signatures or guest expiry/rejoin behavior.

Original participation helper FDE `22e6260:22e62a4` reads the native
battlePlayCount at offset438, adds its integer argument and calls the dirty
setter `2614e90`; it then sets a UI/manager byte through `21e4bf0`, not a
second server award. A bounded original branch scan finds ordinary finish
`21795d0:217a958`, skip helper `1cfa3fc:1cfb4a0` and four competitive-mode
callers. Ordinary finish and skips enumerate owned slots (23c60b4==1),
then apply the increment to both main/assist components through slot10/28.
Ordinary calls at2179c44/2179ca0 use1; skips at1cfa834/1cfa890 use the
requested count. Other mode eligibility, victory/defeat gates, special/guest
party selection, duplicate-slot behavior and network/save ordering still
need separate acceptance. These callers are not treated as publisher packet
provenance or permission to grant participation again on the server.

Original `dpItem.enc` has one authored item219000001 with point value100;
its unchanged SHA256 is
`f315bd1d9e93bb2a4fbdd6128eb95452141d6688bc247e557765081808d1fb33`.
Existing native reward levels and the brush-versus-battle point calculation
are unchanged. Current generic inventory validation retains its existing
999999999 ceiling; this is not newly proved native stock-cap behavior.

## Implemented persistence

The old stock-only ACK ceiling rejected a legitimate later gift and had no
checkpoint preventing another brush subtraction on redelivery. Fresh private
`dress_point_request` now captures exact operation parameters and original
before stock, cumulative acquisition, cost and remaining stock. Expenditure
uses cumulative acquisition minus stock, as the existing CP-item proof does.
Later acquisition may raise stock above the old remaining amount without
waiving the original cost. Unique typed owned rows and non-regressing actual
acquisition are required; missing zero-stock rows are not fabricated.

Four nullable columns on that existing table retain parameters, cost capture,
saved-effect bit and minimum expenditure. Legacy unknown inputs stay unknown
and queued unavailable, never inferred from post-save stock. The native
brush row, cost, signature and wire are not precredited. The existing offline
policy that persists DP on initialized PCs at issuance is retained; changing
that callback/recovery design is outside this branch's completion claim.

Actual consumption saves checkpoint independently from ACK. The checkpoint
commits with profile writes, and full ACK still requires saved DP and cost.
Saved brush effects are omitted from push delivery; other hot/cached/cold
redelivery cancels3000999 until ACK/reconciliation, preserving the queue
instead of subtracting brushes twice. This is not proven usable native back
or cold recovery.

Completed brush captures remain linked to `operation_done`. A partial index
by item/minimum expenditure selects the latest observed spending obligation;
cold reads and later saves preserve acquisition and spent copies without
scanning lifetime history. Cached DP/PC native pulls and relevant save/confirm
tokens must be current. Checkpoint, profile, ACK, queue/done, sequence and
exact reply share the existing transaction. No data reset or automatic repair.

The prior guard disappeared after ACK; reward deduplication prevented more
Iris but still allowed currentDP to rewind. A narrow `dress_point_floor`
table now retains one acknowledged target and original producer per ordinary
permanent PC. It commits with the actual save/ACK/done/queue transaction;
only captured calculated points become a floor, not arbitrary extra points
in a save. Battle-only requests are retained too. Completed producers are
validated against their original parameters, target and real done marker,
and cannot redeliver an old UI callback. Point targets require a unique
typed owned/joined unit within the original point bound.

Changed-unit saves use indexed floors; cold reads group actual units once
and inspect at most the original PC catalog size of floors, not the lifetime
request history. Login, confirm and cached saves/native pulls also validate
the current profile. Deletion, duplicate units, bad owner/type, out-of-bound
totals and stale points preserve the save and require reconciliation.
Existing fields/costs/wallets are unchanged. No legacy target is backfilled
from reward counts or current rows. Both original event-guest PCs, including
their permanent recruitment path, are deliberately excluded from this floor
until their reset/rejoin lifecycle is recovered; pending target checks remain.

Native below-boundary conversion also needs no29000 request:15ddd68 assigns
currentDP and clears battlePlayCount before checking the resulting levels.
The new indexed `dress_point_progress` records actual saved currentDP and
`min(2000000000,currentDP+battlePlayCount)` for ordinary permanent units.
Both minima survive transfer from participation to points; the total is
capped so a real max-DP conversion may discard surplus. Previously saved
points cannot be converted back into participation. Checkpoints commit with
profile writes, and the existing offline29000 precredit path records its
computed target/budget in that same issuance transaction. That preserves
unspent battle counts when brushes add points instead of allowing a stale
count reset to hide behind the larger point total.

No battle count, new operation, wallet reward or signature is manufactured.
New zero-progress units need no checkpoint. First positive actual saves form
the baseline; legacy missing history is not inferred or backfilled. Cold
reads and cached PC pulls/save/confirm also guard this table even before any
29000 reward exists. This is preservation of actual saved native fields, not
proof of natural earning, mode eligibility or all independent producers.

## Deferred acceptance

Runnable `node tools/test_dress_points.cjs` was extended but **NOT RUN**.
Queued checks cover typed original acquisition, split save/ACK, later gifts,
double-consumption suppression, standalone checkpoint/profile rollback,
retained spending across restart, restored stock/cumulative rewind, stale
native pulls, missing capture and cold raw-profile loss with data retained.
Existing point/reward/boundary/overflow cases are updated. Funding, units,
signatures and raw corruption are explicit synthetic probes, not natural
earning or native acceptance. Shared stage/CP/guest/gift/shop/item/save/cache/
clock/recovery/Android/launcher checks remain deferred.

Additional deferred vectors cover battle-only receipt retention, exact
per-PC ACK floors, atomic floor/ACK rollback, post-ACK rewind/deletion/owner/
bound rejection, restart, duplicate/missing/stale cold rows with unchanged
tokens, pull/confirm cancellation with damaged data retained, target/producer
corruption, settled cached-callback rejection and event-guest exclusion.

Further deferred probes cover participation before any reward-level change,
below-boundary transfer with no packet/Iris grant, counter/point rewind,
typed count bounds, combined capped conversion, issuance and save/checkpoint
rollback, cold missing progress with data retained, stale native pulls before
the reward ledger exists, and event-guest exclusion from both checkpoint types.

Event-guest DP floors/reset/rejoin, natural participation/funding/eligibility, independent producers,
legacy lost-checkpoint attribution, native zero-row cleanup/caps/defaults/
signatures, mixed callback/save order, UI/back/recovery, no-crash/no-ANR and
performance remain incomplete or unverified. Coverage remains175 routes:
107 partial,68 unsupported,zero complete. No workers or GitHub Actions;
co-op last.
