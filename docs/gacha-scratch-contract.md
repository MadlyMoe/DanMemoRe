# Gacha scratch bonus and draw persistence

## Archived scratch notice — SOURCE ONLY / UNTESTED (2026-10-11)

`notice/show` now renders the original catalog name, description, round order,
reward IDs/keys, quantities and special-cell markers for all seven gacha
scratches and the one ad scratch. It uses the existing native `html` response;
opening it does not draw, consume a ticket, or issue a prize. An unknown ID or
incomplete archived row refuses instead of showing the generic notice. The
page intentionally does not assert unrecovered publisher cell odds or reset
behavior. Deferred notice cases are written only; no test, build, install,
listener restart or emulator check was run for this change.

Status: **SOURCE ONLY, NOT RUN, built, installed or native-accepted**.
The actual player save and emulator have not been changed. Existing reward
reservations and request/save transactions are reused; co-op remains last.

## Owned rewards below the lifetime cap — source-only persistence/recovery

2026-10-10 NEWER SOURCE ONLY / PARTIAL / UNTESTED. Fresh18000 draws now retain
the same bounded numeric/date capture for every actually owned prize row,
including ordinary and owned-empty inventories below999999999. The original
six vtable/common24d8844 contracts below apply independently of saturation:
stock/signature is set before full positive lifetime addition, each clamps
separately, and dated stock follows the original getter/setter. Full original
wire quantity, price, entitlement, card progression, uniform offline selection
policy and master prize are unchanged. No guessed absent-row constructor,
stock/date precredit, native save repair, wallet or new table/column is introduced.
One partial captured-item source lookup index is added IN SOURCE ONLY / UNAPPLIED.

The private receipt uses existing cap_version1/stock_state/gacha_state fields
as captured-owned versions, not a claim that every target is saturated.
Private source_json.captureVersion1 binds fresh capture ownership without
adding a native packet field. Required original envelope/item-source key,
before lifetime/stock/dates/UInt32 signature and distinct issued signature
remain retained. Only gachaScratch capture validators admit a target below the
cap; other producer kinds still require their original capped target. The
target is min999999999(before+original quantity). Pending saves cannot exceed
that lifetime target; positive stock/date additions stay bounded and never
renew through spending or expiry. Actual issued signature plus the exact
target observes acquisition; lifetime alone does not. Split saves update the
capture with the existing compare-prior atomic transaction.

Fully observed fresh owned ordinary prizes now use the existing confirm-only
zero-additional-quantity card/board recovery and matching ARM64 guard. Hot
retries and unproven prefixes still cancel/withhold. Same-item producers must
ACK the captured scratch first, and scratch must settle prior producers or
1000/1001 full-row ticket replacements; no coalesced grant is reconstructed.
Both absolute card/board saves and actual item observation still gate ACK.

Completed-source validation now covers all captured scratch targets, not only
MAX. Indexed item-source/materialized floor seeks run even if its
pve_item_claim row is lost. A newest-completed captured-item seek refuses a
missing original stage/scratch/ad producer even if both receipt and floor
disappear; it does not scan lifetime history. Pure retained capture validation does not compare
a later legitimate producer against an old allowance. A changed owned row
cannot erase/rewind lifetime or restore spent stock/dates without a proved
new producer. Below-cap lifetime growth requires the existing original pending
acquisition reservation; ordinary positive stock/date growth is bounded by
that lifetime growth unless a separately validated captured prefix already
supplies its original allowance. Full-row lottery replacements use the same
completed proof, so expired dates cannot reappear merely from old snapshots.
No lifetime aggregation or second reward ledger is added.

304 additional WRITTEN ONLY scenarios in test_gacha_scratch.cjs:160 explicitly
owned original-prize cases;88 ordinary/near-cap numeric-date save-order cases;
36 ordinary no-card/card-only/board-only retained-versus-spent recovery cases;
six owned-empty rows;12 both Present/scratch producer orders;two additional
below-cap prior1000/1001 consumers. Existing cap cases also retain exact target
assertions and new missing-item-claim/private capture-version/lifetime-growth
refusals. All remain deferred, including native patch/server regressions.
Imported rows/funding/Present sources/signing/save order are synthetic, not
natural earning, absent-row construction or native callback acceptance.

Missing constructors, legacy/uncaptured/coalesced sources, other producer
prefixes and native UI-clock-performance-stability remain unfinished/unverified.
125 partial/50 unsupported unchanged; all DDL/indexes SOURCE ONLY / UNAPPLIED;
actual saves/listener untouched; matching ARM64 adapter NOT built/installed.
No tests/checks/generators/builds/APK/install/restarts/emulator/ADB/workers/Actions.
All149 original packets/variants before acceptance; co-op last.

## Observed item, incomplete card/board — source-only cold recovery

2026-10-10 NEWER SOURCE ONLY / PARTIAL / UNTESTED. Operation18000 requires
pickedItem; unlike ad26100, it cannot safely omit that field. Original24be070
reads itemId/amount before invoking slot50. Callback24c0ec8 resolves the
original prize through scratchContentId rather than the wire quantity.

Fresh/cached user_data/confirm derives a zero-additional-quantity delivery only
from the retained original18000 receipt when every capped item acquisition is
actually observed. Required itemId/scratchContentId and absolute UserScratch/
UserScratchContent snapshots remain unchanged. The original signed queue,
token, signature, full prize quantity, private capture and inventory/wallet are
not rewritten or pre-credited. Incoming cached envelopes must equal the exact
original or current derivation; missing proof or unknown envelopes refuse.
Hot retries, unproven prefixes, lower-cap/coalesced/legacy branches and
login/pull/push keep withholding behavior. Spending/expiry never renews a prize.

The original common gain24d8844 still changes book/signature state and emits
an item event for quantity0; dated slot48 also adjusts AppTime-aware stock.
Consequently a matching ARM64 client adapter is added IN SOURCE ONLY:
redirect only18000's24be31c slot50 call into original executable padding
153f070:153f07c. CBZ W1 returns for zero; other quantities BR X8 with the
same item, signature and link. Absolute setters, required prize/master UI
identity, original positive/negative gains, cleanup, verifier and ACK are
unchanged. Other reward handlers/ABIs are not patched. No APK was built or
installed; unmodified-client zero-gain side effects are NOT accepted as safe.

All six original prize families bind slot50 to24d8844. The source ELF mapping,
original instruction, gap and binding evidence is recorded in
`.work/gacha-scratch-zero-gain-contract-20261010.txt`; original image SHA256 is
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
Both original absolute saves and retained acquired-item proof still gate the
same atomic ACK/materialized floor. No fake-success ACK or new DDL is added.

Thirty-six WRITTEN ONLY test_gacha_scratch.cjs cases cover six reward families,
no-card/card-only/board-only saves and first-save spent/pruned versus retained
stock. They retain queue/source/capture/inventory/wallet, refuse hot retries/
early ACK/lost observation/envelope, preserve cached/session/restart bytes,
save absolute flags idempotently and exercise ACK/floor rollback/final closure.
Existing cap cases now distinguish observed zero-quantity delivery from
unproven-prefix withholding. Deferred test_client_native_patch.py assertions
cover original-byte mismatch guards, exact leaf/call target/register/link and
unchanged surrounding spans. NONE RUN. Synthetic source/save fixtures are not
native popup/event/signature/timing/earning acceptance.

125 partial/50 unsupported unchanged; earlier DDL SOURCE ONLY / UNAPPLIED;
actual saves/listener untouched. Native UI-clock-performance-stability,
other constructors/producers and broader recovery remain unfinished/unverified.
No tests/checks/builds/APK/install/restarts/emulator/ADB/workers/Actions.
All149 original packets/variants before acceptance; co-op last.

## Capped reward milestone — 2026-10-10

SOURCE ONLY / PARTIAL / UNTESTED. Operation18000 at24be070 forwards the full
original pickedItem amount and issued signature to ordinary slot50. That shared
native path clamps stock and lifetime independently; dated tickets use2576654
and six native fields. The archive has six scratch reward families: dated
gacha tickets, Falna, CP food/books/flowers, EXP, equipment enhancement and
Hero Falna. It has no scratch Valis prize; no Valis credit or invented prize
was added to this branch.

Fresh exact/crossing/saturated owned rewards retain their original full wire
quantities. Existing numeric/date captures retain the before stock/lifetime/
UInt32 signature, signed addition bounds and distinct positive issue signature.
Stock additions are bounded by the actual clamped gain; dated additions by the
original quantity. Spending/pruning never replenishes that allowance. No native
inventory, date, ticket, picked-board state or signature is pre-credited.

Split stock/lifetime/signature saves update the capture with a compare-prior
write in the existing atomic save transaction. The issued signature plus capped
lifetime is actual acquisition proof, including first-save spending/expiration.
Bare lifetime saturation or a saved card cannot acknowledge the item. ACK still
needs the full original card and board projections. An observed additive item
is not redelivered through hot retries or cold confirmation; its original queue
and receipt remain until acknowledgement. Card/board setters are absolute, so
card-only saves do not suppress an as-yet-unobserved inventory callback.

The nullable original operation envelope/indexed capped item key and materialized
gacha_scratch_item_floor are SOURCE DDL ONLY / UNAPPLIED. Completed item lookups
resolve the latest original capped source by item/operation ID, not a lifetime reward
aggregate; missing/downgraded/rewound proof is retained and refused, never
reconstructed from saturated stock. Later legitimate producers use their own
pending allowance; completed dated source validation does not attribute those
later dates to the old grant. Completed stock cannot be restored or deleted.
Both prior1000/1001 replacement and scratch-before-ticket-consumer order require
the first operation's real ACK. Other reward producers keep their own contracts.

Deferred additions in test_gacha_scratch.cjs cover all six original families,
exact/crossing/saturated lifetime where original quantities permit it, zero/full
stock, four save orders, wide native fields, no precredit, early ACK, cold exact
bytes, suppressing observed retries, capture/envelope/floor corruption or loss,
save/ACK rollback, completed stock restore/delete/rewind and both ticket issuer
orders. NONE RUN. These are synthetic funding/tickets/times/save-order fixtures,
not natural earning or native callback acceptance.

Missing constructors, legacy/coalesced effects, partial-effect recovery,
original probabilities/reset policy and native UI-clock/performance/stability
remain unfinished/unverified.125 partial/50 unsupported unchanged; no complete
feature claim. Saves/listener untouched; no tests, checks, generators, builds,
packaging, restart, emulator/ADB, workers or Actions.

## Frozen-client evidence

Client15.1.0 original ARM64 SHA256:
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
Addresses below are original, without Ghidra's100000 load bias.

- `scratch/draw` is stored at352bc48, three bytes inside the null-terminated
  `ad/scratch/draw` string at352bc45. Wrapper24be47c:24be8bc sends exactly
  integer `scratchId` and `position`. A null-string-only inventory omitted it.
  The inventory now considers slash-boundary multi-component suffixes, but
  accepts contracts only when an actual wrapper calls the network helper.
  This also discovers `familia/get`; neither discovery proves exhaustiveness.
- Operation18000,24be070:24be47c, requires a `UserScratch` object, a
  `UserScratchContent` array and `pickedItem.itemId/amount`. The delayed
  callback24c0ec8:24c0fb0 additionally reads **pickedItem.scratchContentId**
  and resolves the original master prize before notifying the UI.
- Setter24c2cd8 uses absolute `ticketAmount/currentStepId/loopCount`.
  Setter24c2e34 uses `scratchStepId/scratchContentId/position/loopCount`.
  Lazy24c1b80/24c2f48 and constructors24c4e28/24c5024 do not assign an owner;
  these two locally authenticated tables accept native userId0 or local owner
  only. Other owners reject, without rewriting saved bytes or tokens.
- Original1000 handler22ef854 optionally applies a `UserScratch` object.
  Native25a6af0 requires an available, incomplete card. The exported lottery
  link field `once` (slot5) actually means recurring when true. Otherwise
  button1 uses25a6928: **any positive lastPickedAt means already used**;
  other buttons compare saved purchase count with original link slot3 `count`.
  First-use is not a calendar-day test. Other lottery daily limits stay separate.
- Availability24c2390 is the union of linked lottery start/end windows;
  positive ends extend by2592000 seconds, with an inclusive scratch boundary.
  Actual lottery draws still enforce their unextended raw banner window.
- Native scratch UI1caafc8 queries positions0..11 and creates choices only
  below the current original prize count; saves reject out-of-board positions.

Read-only exact decompilation artifacts are `.work/gacha-scratch-*-exact-20261004.txt`
and the earlier lottery-state/more decompilations. Compiler analysis of native
code is not execution proof of callback, popup or persistence order.

## Original archive data

The decoder exports7 `scratch` cards,27 `scratchStep` rows,160
`scratchContent` prizes and22 already-exported `lotteryScratch` links.
Each source has the encrypted archive path and SHA256 in `master.sources`.
The master now contains108 source tables. These are original card/prize
quantities, not invented pool items or captured publisher packets.
Scratch slot3 stays named `slot3`: its semantics are not established.
All prizes map to existing ordinary inventory profiles; gacha-ticket prizes
use native `dateList` and cumulative acquisition, not a fabricated amount field.

## Explicit offline policies

There are no probability weights in these three original scratch tables.
Draws choose uniformly without replacement within the saved current stage/loop.
This is **not publisher odds**. On the last unclaimed special prize, finite
cards advance to the next original stage; the last finite stage stays completed.
Single-stage cards repeat with loopCount+1. That progression is an offline
policy consistent with descriptions, **not recovered publisher reset semantics**.
Native popup/transition interpretation must be verified before accepting it.

A linked eligible purchase earns one ticket; a ticket purchase batch earns one
per drawCount. Eligibility/count fields are client-derived, but this absolute
ticket encoding/quantity multiplication is an offline reconstruction, not an
observed publisher response. No ticket is minted from a forged client boolean:
the request marker must match original link eligibility and saved card history.

## Durable effects and native-save proof

`gacha_scratch_claim` permanently binds operation type, original card/prize or
lottery source, captured before/after ticket/card/board snapshots, issued
parameters, timestamp and shared ordinary acquisition target.
`gacha_scratch_state` materializes a per-card settled/imported baseline.
Pending grant/draw exclusion avoids conflicting scratch projections.
There is no native scratch-ticket, picked-content, item or signature pre-credit.
Existing lottery count/wallet handling remains the shared lottery transaction.
Settled linked-lottery replay requires that materialized server baseline to still
exist and exactly match the current saved `UserScratch`/`UserScratchContent`
projection. Legitimate later scratch draws remain valid because they advance both
the saved card and its floor together. Floor loss, ticket rewind or forged board
progress refuses without restoring the original grant or changing the queue.

The native operation grants the inventory. Split card, board and inventory
saves can arrive before ACK, including across a listener restart. ACK requires
the captured ticket/card/board state and cumulative item acquisition; flags
alone cannot discard an earned reward. Completed floors prevent ticket
restoration, board removal and acquisition rewind without scanning lifetime
claims. Later ordinary item spending remains possible.

Queue, count/cost, imported floor, prize target, permanent request identity,
sequence and reply use the existing transaction and roll back together.
`gacha_scratch_request` binds action plus hash of received encrypted bytes to
one effect; it does not trust a caller's hash header. Exact pending retries do
not reroll or debit. A newly captured exact draw identity retried after its real
save and ACK returns the original result/card fields with no singular operation
and `operations:[]`. This preserves the prize identity required by the native
result callback without reapplying its additive item or absolute card setters.
The path requires the canonical signed18000 operation, done-without-queue state,
exact current acknowledged card/board floor and saved cumulative item target;
capped numeric and dated prizes additionally require their observed native
capture and source floor. Missing, corrupt, ambiguous, later-progressed or old
uncaptured receipts still cancel3000999 without mutation.

Canonical route names take precedence over suffix aliases, and noncanonical
known aliases use the longest match: ad scratch cannot route to gacha scratch,
and an unknown canonical prefixed route remains unsupported.

## Deferred acceptance

`tools/test_gacha_scratch.cjs`, updated lottery/master/client-route probes and
`docs/packet-test-plan.md` are runnable checks left **unexecuted** as requested.
Synthetic imported tickets/currency and hand-authored native-shaped saves are
prerequisites, not natural progression or original unit initialization proof.

The new probe covers160 original prize projections and22 links, ticket batches,
paid/free pulls, missing/split saves, indexed floors, settled linked-grant floor
loss/current-projection mismatch, exact settled draw result-only replay, cold replay, action/alias
conflicts, original joins, malformed history and issue/receipt/reply/ACK rollback.
Still pending: natural earning, first-ever/threshold/recurring UI branches,
post-banner30-day boundaries/clock changes, multi-stage full traversal/repeat
animation, art/grid hit-testing, native inventory signatures and cold effect
ordering, mixed gift/box/mission/ad reward sources in both issue orders, legacy
recovery UI and all underlying gacha PC/bond initialization/persistence gaps.
No crash-fix, full-gacha, shop, social or whole-game acceptance is claimed.

## Settled draw transport (source-only, 2026-10-14)

The permanent `scratch/draw` identity can now distinguish a completed draw from
a lost request. It revalidates the original card, position, prize, quantity and
signed operation, then walks every later same-card claim in operation order.
Each later grant or draw must have a canonical completed operation, no live
queue, and an exact before-state matching the preceding after-state; the final
after-state must equal the materialized current card/board floor. It also
requires the current native inventory lifetime to include the original prize.
Capped numeric and Gacha Ticket rewards retain their exact observed
signature/stock-or-date capture, and the current indexed item source may only
advance through another validated completed scratch acquisition.

On success, the response keeps the original `UserScratch`, selected
`UserScratchContent` and display-only `pickedItem`, but deliberately excludes the
singular operation and returns an empty operation list. This mirrors the existing
settled lottery result strategy: the known result can render, while operation18000
cannot grant or save anything twice. Fully captured later draws and linked
lottery ticket grants are admitted through the continuous history proof; a
missing, pending, corrupt, identity-swapped or discontinuous successor refuses
without changing state.

Deferred cases now cover every original prize result after ACK and restart, all
six item families through ordinary/capped cold recovery, later completed draw
and grant chains, and canonical-operation, done/queue, chain/floor, inventory,
observed-capture and item-source corruption. They have not been executed.

## First item and Gacha Ticket interrupted recovery (source-only, 2026-10-14)

An absent ordinary numeric prize now retains a cap-version-0 typed cumulative
claim. An absent or valid empty constructor at cumulative zero remains untouched
and therefore keeps the original positive `pickedItem`. The exact full target is
recognized as saved; a cold operation18000 preserves `itemId` and
`scratchContentId` but sets `amount:0`, because the original callback requires
that identity even when it must skip the additive item effect. Card and board
setters remain absolute and final ACK still requires them.

The original absent `UserGachaTicket` prize is different. Its versioned capture
records the recovered native constructor baseline: empty `dateList`, book state1,
signature0 and cumulative amount0. Completion requires the exact final dates,
cumulative amount, operation signature and book state3 before zero-quantity cold
delivery. This prevents the first ticket from being treated as an unverifiable
legacy cap while retaining the original native construction path.

Six absent-row family contexts, four authentic multi-quantity partial-addition
refusals and one post-issue empty-constructor replay are written in
`tools/test_gacha_scratch.cjs` but **not run**. Partial, duplicate, malformed,
rewound and corrupted-cap states retain the queue instead of duplicating a
reward. Publisher odds/reset semantics, native construction/save ordering,
animations, recovery UI, performance and crash-free acceptance remain deferred.
