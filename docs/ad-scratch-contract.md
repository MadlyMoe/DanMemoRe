# Video-ad scratch draw persistence

**Source-only: NOT logically tested, built, installed or accepted in MuMu.**
The actual player save/emulator are untouched. Deferred checks are
`node tools/test_ad_scratch.cjs`, updated master/save/recovery probes and the
shared present/mission/shop/PVE/Element acquisition regressions. Syntax checks
and metadata/audit generation are not gameplay acceptance.

## Owned ordinary rewards — 2026-10-10

SOURCE ONLY / PARTIAL / UNTESTED. The original five ordinary quantity-one
26100 prizes now capture any actually owned numeric item row, including empty
rows and lifetime totals below the cap. Original prize quantities, card/board
state, ticket costs, ad allowance and the separate ten-Iris special prize are
unchanged. Missing rows do not acquire an invented constructor or stock capture.

The existing item receipt retains before stock, lifetime and UInt32 signature,
a distinct issued signature, signed native addition bounds and the exact target
`min(999999999, beforeCumulative + originalQuantity)`. Bounded positive stock
additions and actual issued-signature/target observation reuse the gacha-scratch
save path. Spending never renews the allowance. Full native card, board and item
proof remain required for the existing atomic save/ACK transaction. No native
precredit, wallet replacement or fake-success acknowledgement was added.

Private `ad_scratch_draw.capture_version` distinguishes fresh captures from
legacy receipts; its source migration is UNAPPLIED. Fresh below-cap captures
require version1. Existing version0 MAX captures remain valid only with their
original envelope and item proof; unknown history is not retrofitted. Iris
requires version0 and no item target. Other reward kinds retain their earlier
cap constraints; only numeric ad/gacha scratch admits ordinary targets here.

An outstanding captured same-item producer must be saved and acknowledged before
the next producer issues. Completed-source checks also cover ordinary ad targets,
retained proof loss, unsupported lifetime growth and stock restoration. Losing
both the ad source and its floor is refused by the existing newest captured-item
lookup; this does not add a lifetime-history scan or a second item ledger.

After proven item acquisition, original23f0734 permits confirm-only recovery
with the item omitted and absolute card/board snapshots retained. The signed
queue, token, original quantity and source are unchanged. Unproven prefixes,
legacy/uncaptured/coalesced recovery remain unfinished, not silently accepted.

153 additional scenarios are WRITTEN ONLY: five owned original-prize lanes,
80 ordinary/near-cap save orders,45 ordinary/spent cold-recovery combinations,
five owned-empty rows and18 extra Present/ad producer orders. Existing cases
cover marker downgrade/unknown version, proof loss, exact cold bytes/restart,
rollback, early ACK and restoration; old coalesced-success fixtures now require
the first real acknowledgement. Synthetic rows, Present quantities, funding,
timestamps and signing/order are not native earning or constructor evidence.
NONE RUN.125 partial/50 unsupported unchanged; no completed feature. Actual
saves/listener untouched; no tests/checks/generators/builds/APK/restarts/emulator/
ADB/workers/Actions. All149 packets and variants before acceptance; co-op last.

## Fully observed item, missing card/board — source-only recovery

2026-10-10 NEWER SOURCE ONLY / PARTIAL / UNTESTED. Original23f0734 first applies
the mandatory absolute UserAdScratch/UserAdScratchContent snapshots, then checks
whether pickedItem exists and has positive itemId/amount before invoking slot50.
This gives a native cold-recovery contract: retain the card/board snapshots but
omit pickedItem after the issued capped acquisition was actually saved.

Fresh and cached user_data/confirm now derive that delivery only from the exact
retained26100 operation and its original receipt, with every item cap capture
actually observed. This is a transient wire projection, not a rewritten queue,
signature, token, prize, quantity, entitlement or receipt. Cached projections
must equal either the retained original or the current exact derived delivery;
unknown envelopes cannot acquire this exception. Hot ad/scratch/draw retries
still cancel rather than send a missing hot-popup field. Login/binary pulls/
push and all unobserved stock-lifetime-signature prefixes keep their existing
withholding behavior. Gacha18000 does not inherit the optional-item exception.

The native client still owns both absolute saves. It can acknowledge the same
original verifier only once complete card/board and actual acquired-item proof
are present. The existing atomic save/ACK/materialized-floor transaction is
unchanged. No empty fake-success operation, manual native save repair, wallet
credit, extra reward, constructor, new DDL or listener/emulator work was added.
Later spending does not renew the item allowance or put pickedItem back.

The80 previously written ad-cap combinations now distinguish observed recovery
from unproven prefix withholding and cover exact derived cold bytes/restart and
unchanged inventory. Fifteen additional WRITTEN ONLY cases cover all five
original ordinary prizes with no card, card-only and board-only saves: unchanged
queue/envelope/capture/native item/wallet, hot cancellation, early ACK, lost
observation/envelope refusal, cached bytes, session/restart, idempotent absolute
saves, rollback and final ACK/floor. NONE RUN. Synthetic imported inventory,
tickets, timestamps and signing/order are not native callback or UI acceptance.

This supersedes only the earlier fully-observed capped ad-item/card-recovery
limitation. Unobserved prefixes, lower-cap/coalesced/legacy recovery, other
producers and actual UI-clock-performance-stability remain unfinished/unverified.
125 partial/50 unsupported unchanged. Existing DDL SOURCE ONLY / UNAPPLIED;
actual saves/listener untouched; no tests/checks/generators/builds/APK/restarts/
emulator/ADB/workers/Actions. All149 variants before acceptance/co-op last.

## Capped ordinary prizes — 2026-10-10

SOURCE ONLY / PARTIAL / UNTESTED. Original26100 at23f0734 sends the full
pickedItem amount and issued signature to ordinary slot50. The original card
has five ordinary quantity-one prizes: Jagamarukun295000001, Special Falna
294000019 and CP items215000001/3/5. Fresh exact/saturated owned numeric grants
now reuse the shared native stock/lifetime clamp, before-stock/before-lifetime/
UInt32 signature captures and a distinct issued signature. There is no quantity
greater than one in these ordinary prizes, so no original crossing-cap case or
Valis/dated-ticket reward was fabricated. Original Iris10, card/reset/loop
policies, earned tickets and the ad allowance remain unchanged.

Actual clamped positive additions, including zero full-stock gain, bound each
pending allowance. Spending never renews it. Split stock/lifetime/signature
saves commit the compare-prior capture alongside profile/token/queue/reply;
issued signature plus saturated lifetime proves acquisition even after spending
before the first save. Bare saturated lifetime does not prove delivery. ACK
still requires the complete native card and board plus actual item observation.
Observed additive items are withheld from hot retries/cold confirmation while
their queue and receipts remain; absolute card-only saves leave an unobserved
inventory reward deliverable. Partial-effect recovery is still unfinished.

New nullable original envelope/indexed capped-item key and materialized
ad_scratch_item_floor are SOURCE DDL ONLY / UNAPPLIED. The existing gacha
scratch checkpoint is shared with ad scratch through two fixed internal source
descriptors. Both validate the latest indexed completed source, exact original
operation and original prize quantity with pure retained captures, without
attributing later legitimate producer stock to an earlier allowance. Missing,
changed or rewound proof is retained/refused, never inferred from maxed stock.
Completed stock cannot be restored, deleted or its lifetime rewound. Either
capped Present/ad-scratch producer order requires the first actual item ACK.

test_ad_scratch.cjs has80 additional WRITTEN ONLY cases: five original ordinary
prizes/two lifetime baselines/two stock baselines/four save orders. These include
no precredit/unchanged Iris wallet, wide signature, prefix/ACK/floor rollback,
early ACK, cold exact bytes, observed retry suppression, allowance exhaustion,
capture/envelope/key/floor corruption or loss and completed restore-delete-
rewind. Two more original Present/ad-scratch ordering scenarios and existing
native-shaped inventory/history fixtures are updated. NONE RUN; funding,
tickets, timestamps, signatures and save ordering are synthetic, not original
publisher progression or natural client acceptance.

Missing constructors/other producers/coalesced-legacy/partial-effect recovery/
SDK eligibility/native UI-clock-performance-stability remain unfinished and
unverified.125 partial/50 unsupported unchanged; no completed feature claim.
Saves/listener untouched; no tests/checks/generators/builds/packaging/restarts/
emulator/ADB/workers/Actions. All149 packets and variants before acceptance;
co-op remains last.

## Original client and archive evidence

Original15.1.0 ARM64 SHA-256:
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
Addresses below are raw, without Ghidra's `0x100000` image bias.

- Wrapper `23f0bd4:23f10a4` sends `adScratchId`, int32 `position` and
  **advertisementType2** to `ad/scratch/draw`.
- Registry constants `34975d0`/`34975d4` bind **26000** to `20fd068` and
  **26100** to `23f0734`. These are ad completion and ad scratch respectively,
  not gacha scratch18000 and not Serial PvP30100/30200.
- `23f0734:23f0bd4` applies mandatory `UserAdScratch`, mandatory
  `UserAdScratchContent` array and optional `pickedItem` through the native
  item repository's gain method. It does **not** grant `issueAmount` separately.
  State setter `23f5508:23f5664` reads ticketAmount/currentStepId/loopCount;
  content setter `23f5664:23f5778` reads stepId/contentId/position/loopCount.
- Success callback `23f2dc8:23f3234` processes/pulls saved operations. Result
  callback `23f3b48:23f3d80` consumes pickedItem, optional positive issueAmount
  for Iris display, and mandatory boolean `reset`. Both singular hot operation
  and plural cold queue delivery retain those required fields.
- Saved deserializers `280c93c:280cc18` and `280cc18:280cef4` establish the
  five native fields in each scratch state/content row. Lazy creation
  `23f463c:23f4814` / `23f5778:23f5928` sets the original IDs but does not set
  userId; constructors `28858f8` / `288623c` initialize **userId0**. These two
  authenticated local profile tables therefore allow0 or the local player ID;
  foreign owners are rejected and raw save/token bytes are not rewritten.
- Availability `23f4e4c:23f4f40` reads encrypted **long** start/end slots5/6.
  Start and finite end are inclusive; end0 is open-ended. Native layout/cell
  bounds are **not yet recovered** from the UI/LWF bindings.
- Ad completion26000 optionally applies scratch rows and calls `20fcf78` to
  decrement the corresponding UserAdvertisement.remainingCount. Its initial
  allowance/refill is now reconstructed for scratch completion in
  [the ad-view handler](ad-view-contract.md), including the original daily
  ten-Iris amount; genuine SDK eligibility remains incomplete. This draw handler
  does not mint views.

Static artifacts are `.work/ad-scratch-wrapper-exact-20261004.txt`,
`ad-scratch-operation-callback-exact-20261004.txt`,
`ad-scratch-save-state-exact-20261004.txt`,
`ad-scratch-entitlement-exact-20261004.txt` and
`ad-scratch-native-grid-rules-20261004.txt`. Only the exact ranges listed above
are evidence; exploratory merged ranges and a generic vector-copy function
are not proof of grid bounds.

The decoder exports one original card614000001, step615000001 and six prizes.
It retains original keys/types/quantities, slot3 without a guessed meaning,
start1603638000/end0 and source SHA-256 provenance in `danmemore-master.json`.

| Content | Original reward | Quantity | Original special flag |
| --- | --- | --- | --- |
|616000001|Jagamarukun295000001|1|0|
|616000002|Special Falna294000019|1|0|
|616000003|CP food215000001|1|0|
|616000004|CP book215000003|1|0|
|616000005|CP flower215000005|1|0|
|616000006|Iris205000001|10|1|

## Implemented reconstructed offline policy

Only an existing valid saved card with earned tickets can draw. Its first
offline draw adopts the actual saved known card/content snapshot; it does not
reconstruct old rewards or past ad completions. Unknown historical IDs,
ownership or queued operations remain unavailable, with their history intact.

The archive has no prize weights. **Uniform sampling without replacement**
among remaining original prizes is an explicit offline reconstruction, not
publisher odds. A cell cannot be reused within the current loop. Requests
accept a nonnegative int32 position without asserting whether natural UI cells
are zero-based or one-based; the six-prize bound still prevents a seventh
award. This is not final native layout validation.

The authored `special` flag selects `reset:true`; the sole original step is
repeated with loopCount+1. This is a reconstructed reset policy, not proof of
the publisher's server algorithm. Old-loop rows remain saved, with a repeated
content ID overwritten only by its next-loop position. Exhausted/ambiguous
imported cards are not silently replenished.

Every draw deducts exactly one saved ticket in its native target and emits
the exact chosen item ID/amount. Native state/content/inventory/signatures are
**not pre-credited**. Iris10 is credited once to the authoritative local wallet;
the original Iris item is emitted once through `pickedItem`, while issueAmount10
is only the callback's display field. This Iris envelope is a scoped offline
reconstruction, not a captured publisher packet.

The existing request transaction commits the wallet, operation26100, imported
card baseline, permanent draw receipt, ordinary-item acquisition reservation,
transport identity, sequence and exact reply together. Failed commits roll
everything back. `ad_scratch_draw` captures the original prize, before/after
card projections, exact issued parameters and pre-award acquisition reservation.
Ordinary prizes reuse indexed `pve_item_claim` and the shared producer floor;
that historical table name does not classify scratch as PVE.

## Save, acknowledgement and replay

The pending receipt binds original joins/quantities, ticket-1, chosen position,
loop/reset and item acquisition to the exact queued operation. Split native
state/content/inventory saves may match the captured before or after projections
independently. ACK requires **both complete after projections** plus ordinary
inventory's cumulative acquisition target; ticket/card flags alone cannot drop
the prize. Iris uses the already committed server wallet, not a fabricated
ordinary UserCurrency acquisition proof.

ACK/profile/floor/queue/reply changes share one transaction. A materialized
`ad_scratch_state` floor prevents settled ticket restoration or board rewinds
without scanning lifetime draw history. Future genuine ticket producers must
extend this floor with their own entitlement receipts. Type2 ad completion now
does this through operation26000 and its save proof; unexplained increases
are not accepted as another ad award.

Pending requests reuse the captured choice, even after a clock rewind or
restart. `ad_scratch_request` permanently binds each transport identity to the
**received wire hash**, not a caller-supplied header. Conflicts reject. A newly
captured exact request retried after its real save and ACK returns
`{code:0,operations:[]}` instead of re-delivering the additive prize. It first
requires the canonical signed26100 operation, done-without-queue state, exact
acknowledged card/board history and current saved projection. Ordinary prizes
also require their cumulative acquisition; capped prizes require their observed
signature/stock checkpoint; Iris10 requires the exact operation-bound wallet
journal. Fully captured later operation26000 ticket grants and operation26100
draws must form a canonical completed before/after chain to the current floor.
Any missing, pending, corrupt, identity-swapped, discontinuous or legacy
uncaptured proof cancels with native3000999 without mutation. Fresh, cached and
cold queued deliveries continue to validate the pending durable receipt.

## Still incomplete

Video-ad SDK completion/natural entry, publisher probabilities/reset semantics,
native grid bounds,
hot/cold scratch animation/result/save/ACK order, item signatures and Iris
display/wallet convergence, natural eligibility/entry, artwork and recovery UI
remain unverified or unsupported. `ad/view/complete` now has source-only type1
Iris and type2 ticket/allowance handlers; the natural SDK path remains incomplete.
**Gacha scratch18000 is a separate incomplete feature**, now with a source-only
handler and ticket-grant/save safeguards described in
[its own contract](gacha-scratch-contract.md), NOT native acceptance. This ad route is partial,
not a claim that ads, all gacha or the whole game are playable. Co-op stays last.

## First ordinary-item interrupted recovery (source-only, 2026-10-14)

The five original non-Iris prizes can now start from a genuinely absent native
inventory row without being mislabeled as a capped-stock capture. Their durable
claim retains the exact table, ID field, zero acquisition baseline and authored
cumulative target. An absent row or a valid empty row at that baseline is still
untouched; the original positive `pickedItem` remains. An exact saved target is
complete and cold operation26100 omits only optional `pickedItem`, leaving the
absolute card and content setters for the client. Any between-baseline-and-target
row is an ambiguous partial additive save and refuses rather than replaying the
full prize.

Final acknowledgement still requires the original card and board projections
as well as the item. Completed cumulative acquisition cannot be deleted or
rewound. Cap-version corruption, malformed/duplicate rows and catalog drift
retain the real queue for reconciliation. Nothing is precredited.

Five absent-row item-first/restart/pruned-confirm/final-ACK contexts, one cap
corruption guard and completed rewind/delete guards are written in
`tools/test_ad_scratch.cjs` but **not run**. Original owned/capped paths, producer
ordering, rollback and replay cases remain in the same deferred suite. Native
constructor/signature timing, popup/animation/back behavior, performance and
crash-free acceptance remain deferred until every packet branch is implemented.

## Settled draw retry (source-only, 2026-10-14)

New draws retain a unique Iris-history pointer when the original special prize
credits ten free Iris. Once the client saves the complete card, board and item
effects and acknowledges operation26100, the same permanent request identity can
return an empty success across reply-cache loss, a new session and restart. The
server never replays `pickedItem`, `issueAmount`, `reset` or either absolute
scratch setter on this path.

The settled validator rechecks the original catalog join, quantities, signed
operation, request body, operation-done state and current native profile. It
then walks all later same-card operation26000 ticket grants and operation26100
draws in operation order. Every retained operation must be canonical, completed
without a live queue and join the preceding after-state to its exact before-state;
the final state must equal both the materialized floor and current saved card.
It also requires either the exact operation-bound Iris transaction or the saved
cumulative item acquisition; capped items retain their observed operation
checkpoint and may advance only through another validated completed scratch
source. Legacy draws without this capture, and every missing, pending, corrupt,
identity-swapped or discontinuous chain, remain unavailable without mutation.
The deferred suite now covers all six original prizes, later ticket/draw
progression, and canonical-operation, done/queue, chain/floor, item and Iris
journal damage. None of those cases has been run.
