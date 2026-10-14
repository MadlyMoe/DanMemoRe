# Shop delivery and save checkpoints

## First-constructor ordinary-item recovery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-14)

Original permanent product `207000002` sells one Falna Orb Adventure Ticket
`298000001` for 10 free Iris. The native operation9000 callback owns the item
loop separately from its absolute purchase-count/date setters. New issuance
already stores the absent row's immutable `UserAdventureTicket` table,
`adventureTicketId`, quantity and cumulative target in `shop_item_claim`, and
the save transaction records its `i:<itemId>` observation atomically in
`shop_request.observed`; it never precredits the row.

Cold login/pull/confirm recovery now uses that retained cap-version-0 proof.
A saved first-constructor row is omitted from `boughtItems`, while an untouched
row retains the original authored quantity. Purchase count/date, equipment and
costume effects remain independently projected. Cap-version-1 numeric, dated
ticket and Valis paths keep their existing stronger stock/signature/credit
checks. Unknown capture shapes, missing or rewound rows and catalog drift remain
unavailable with the real queue retained; the final ACK still requires all
original purchase effects.

`test_shop_cold_recovery.cjs` adds one WRITTEN ONLY end-to-end source fixture
for the authentic Falna Orb offer: first construction, item-first save,
restart, pruned confirm/login/pull, malformed cap refusal, final count/date save
and ACK, and completed row/count rewind refusal. Its deferred count is now 103.
`test_shop_mixed_recovery.cjs` adds four authentic count/date/reward/all orders
for equipment pack `207004301` with ordinary Falna/EXP rows absent, retaining
its dated tickets and equipment. The same pack contains eight authentic
multi-quantity ordinary rows. Each now has a written-only first-constructor
case whose imported cumulative/stock value 1 is below the captured target;
login and confirmation must retain the queue and refuse instead of replaying
the full authored amount. The shared guard accepts only the exact absent/zero
baseline, exact saved baseline or complete cumulative target. Its deferred
count is now 190. NONE RUN.
Native constructor/signature/save timing, popup/back behavior, performance,
crash/freeze acceptance and legacy reconciliation remain unverified. No build,
listener, APK, emulator, ADB, worker or GitHub Action was used.

## Timed starter pack — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

Only original product `207000001` has a nonzero `shopProduct.duration`:
`259200` seconds. In the pristine ARM64 client, `shop_product_state`
`0x241e7e4` chooses `shop_product_reset_count` `0x241ebc0` when FlatBuffer
slot `0x22` (duration) is nonzero; ordinary products instead use the original
start/end window at slots `0x1c`/`0x1e`. The duration branch compares current
client time minus a protected timestamp at the shared game object `+0xc18`
then `+0x138` with the authored duration. The pristine `UserStatus` serializer
at virtual `0x2786c70` labels its `+0x138` field `createdAt`; nearby it labels
`+0x60` `lastLoginedDateAt`. `shop_product_available` `0x241f994` uses the
signed comparison for visibility, including a negative age after clock rewind.
The separate `local_save_meta.created_at` is not this native field.

Fresh synthetic profiles now seed their zero `UserStatus.createdAt` at the
selected event-clock epoch, or the current wall epoch without an event clock;
existing saved profiles and positive authored seed dates are not rewritten.
`shop/buy` uses the saved owned `UserStatus.createdAt` for new duration-limited
issuance instead of calendar dates. An already-issued pending retry can settle
after the duration ends without a second charge. The read-only pack detail
names the recovered account-creation trigger. Native `user_data/push` may still
update login-status fields, but cannot replace the account owner/date or delete
the row, so a saved callback cannot reopen the starter window. Boundary,
missing/foreign status, changed/deleted creation row, clock rewind, pending retry and wallet/receipt rollback cases are written for
the consolidated test pass, not executed. Native save/ACK/UI and other shop
branches remain unverified; no tests, builds, listener or emulator were run.

## Paired unit purchase cold callback — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

Original9000 has no inline PC award. When its product count/date was saved before
the separate1000 unit operation, cold delivery may repeat those absolute setters
without granting a second unit or creating a new purchase. The existing paired
receipt, original signed queue, price proof and real unit/save ACK guards remain.
One deferred `test_shop.cjs` case covers count/date-first confirmation with the
1000 still pending; it has not been run. Partially saved unit constructors,
native callback order and gameplay remain unverified.

## Pending purchase across an event window — SOURCE ONLY / UNTESTED (2026-10-11)

`shop/buy` now applies the original product start/end window only when issuing
a new purchase. A retained pending operation for that product can be delivered
after the event clock reaches its end, without charging again or creating a
second receipt. An expired product with no pending operation remains unavailable.
The archived sale, original price and reward contract are unchanged. A deferred
paid-pack case covers expiry, restart, retry and fresh-purchase rejection; it
has not been run. Native shop UI, save/ACK, clock changes and stability remain
unverified.

Latest SOURCE ONLY / PARTIAL / UNTESTED follow-up:
[ordinary gacha-ticket rewards](gacha-ticket-reward-contract.md) adds first-ticket
captures/bound source pointers, preserving original prices/full quantities/ACK.
Mixed-shop deferred contexts now178/32 NEW, NONE RUN. No DDL applied or saves
changed; earlier missing GachaTicket constructor and146-total notes are historical.

## PC selector-ticket follow-up — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

The original PC class is now exact six-field dated inventory, not a numeric
`amount`. Owned captures, original30-day expiry, capped producer allowances,
actual dated selector-shop costs and spent-date restoration guards are shared
with existing persistence. First isolated shop rewards use the evidenced
263a11c/23829a0 constructor baseline privately, never prewriting native inventory.
Real count/date/all-reward ACK still gates the existing indexed source checkpoint.
`shop_spend.ticket_state` source DDL is UNAPPLIED. This supersedes only the earlier
uncaptured207004301 PC-ticket branch/134-case description: mixed recovery now
has146 deferred contexts, including four first-ticket full-bundle prefixes.
The760 dedicated cases are also written only. See [pc-ticket-contract.md](pc-ticket-contract.md).
First rewards outside shop/coalesced items/other unfinished branches/native
acceptance remain incomplete; no tests, native changes or actual save mutations.

## Mixed equipment and costume shop recovery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Original9000/24219c4 has independent boughtItems, boughtCostumes and optional
boughtEquipments loops, followed by unconditional241f39c absolute count/date
setters. Empty equipment/costume iteration bypasses only that reward body,
not the other loops or purchase setters. Retained original source:
.work/shop-contract-decompile.txt lines2213-2315; no native code was executed.

Shared shopColdRecovery now admits original inline types0/3/4 when every
ordinary item has its existing captured numeric/dated state. It retains exact
untouched positive quantities and omits only fully observed items/equipment
grants or actual fully owned costumes. Each equipment grant uses its retained
distinct native piece observations, not current inventory counts. Sales and
later modifications do not reconstruct delivered gear. Partial piece quantities
remain unavailable rather than becoming a guessed remainder. Pure equipment
and pure costume offers need no fabricated item capture. Original source/
catalog quantities/price debit/windows/limits/count/date/token/signature/queue
and actual full ACK requirements stay unchanged. No server precredit, native
patch, new wire field, new reward table or fake ACK was added.

The shared equipment receipt validator now requires exactly the same piece keys
in equipment_piece_claim and the original observed snapshots. Missing/rebound
bindings, erased observations with surviving piece bindings, or orphan bindings
refuse without rebuilding history from current inventory. A new SOURCE ONLY
equipment_piece_claim_operation(operation_id,piece_key) index keeps this check
operation-local; source DDL remains UNAPPLIED. The existing observation/index/
profile/queue/ACK/cache transaction is reused.

Original2505fc4 only enters linked voice acquisition for absent/state1 costume
rows through2507b58, sets costume state2, and checks each voice through23a4e9c
before23a5144 unlocks it. Existing voice states2/3 are retained. Therefore a
voice-first save can retain the original costume entry while it is still
locked; replay reaches its remaining unlock branch without downgrading voices.
A completely saved or preowned costume is omitted from cold delivery.
If the costume is already state2/3 but required linked voices are missing, its
original helper cannot re-enter that branch: retain/refuse rather than inventing
a voice packet or silently ACKing missing data. Source artifacts:
.work/gift-costume-add-exact-20261004.txt and
.work/gift-costume-state-exact-20261004.txt. Generic costumeDelivery delegates
shop9000 to the shared shop path; Present2000 and mission6000 behavior is not
broadened. Hot effect retries still cancel/save responses withhold callbacks.

134 NEW WRITTEN ONLY contexts in test_shop_mixed_recovery.cjs:
128 recovery candidates cover32 original offers/four count-date-reward-all save
orders (16 pure equipment, nine pure costumes, seven costume/ticket packs).
Four prefixes cover original207004301 as currently unavailable because its
297000006 PCTicket remains uncaptured; the rest of that original pack is not
changed or given a fabricated cap/constructor. Two extra original costume-pack
contexts cover voice-first recovery/read-state3 preservation and costume-first
missing-voice refusal, then full actual save/ACK. Original data/funding/quantities/
windows/limits/costs/native lazy owner0/preowned state3/voice joins/gear baselines/
unique native slots/cache bytes-restart/mutated cache/source-index loss/rollback/
sold gear/spent-expired items/full ACK are deferred, not executed results.
Synthetic prerequisites do not prove native earning, callbacks, allocation,
signatures, UI or no-crash gameplay.

Remaining branches include the uncaptured PCTicket equipment bundle, other
uncaptured first/coalesced items, costume-first missing voices, paired units,
untraced gear producers and native callback/clock/slot/UI/performance/stability.
Counts remain124 partial/51 unsupported, not feature completion. Actual saves
and listener untouched; no tests/checks/generators/build/APK/install/restart/
emulator/ADB/workers/Actions. All packets/variants precede acceptance, co-op last.

## Owned ordinary shop stock checkpoints — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Fresh isolated purchases with an actually owned numeric or six-field dated
inventory row now retain their below-cap before-state in the existing
shop_item_claim capture fields. Private offline-shop-stock-v2 /
offline-shop-gacha-v2 and shop_request reward capturePolicy bind that intent;
neither is a new client field. Original9000 still sends the full authored
positive quantity and distinct issued signature. Existing native stock/lifetime
clamps, dated additions/expiry, spending and Valis bounds are reused.
Original24219c4 forwards quantity/signature through vtable+50 without a shop-level
lifetime threshold. This is not constructor/callback proof: absent, coalesced
and legacy rows are not backfilled.

Cold recovery retains untouched grants, omits only completely observed items,
and refuses partial stock/date/cumulative/signature effects. Exact original
purchase count/date and every actual reward still gate ACK. Another same-item
producer waits for real9000 ACK; unrelated producers remain independent.
Pure completed-source validation does not apply pending stock effects to later
legitimate lifetime/signature changes. All inline item/equipment/costume grants
also bind original product/pack quantities, original issue-time windows and
limits, not a coherently edited local envelope.

New SOURCE ONLY DDL adds shop_item_stock_floor, one original operation pointer
per item, and two indexes for table reads/descending captured sources. Only
actual ACK writes or advances the pointer, atomically with saved profiles,
capture observations, operation_done, queue removal and reply cache.
Reads and later saves require retained completed source, actual observation,
native ownership and lifetime. Spending/expiry cannot restore stock/dates;
growth requires an original pending producer and its allowance. V2 lineage
survives later lifetime-cap crossings, preserving checkpoint-loss detection.
First legacy cap-v1 ACKs keep their old behavior; no inferred pointer backfill.
This small checkpoint schema supersedes the earlier no-new-schema statement
only for this owned-stock branch. All DDL remains UNAPPLIED.

38 NEW WRITTEN ONLY contexts extend test_shop_cold_recovery.cjs from64 to102:
32 eight-offer/four-save-order below-cap contexts and six independent numeric/
dated stock-cumulative-signature prefixes. Two prefixes also cross the cap on a
second original purchase. Coverage includes original eight-item paid bundle,
monthly count7-to1, source/marker/version/capture/target/pointer loss, coherent
quantity edits, no precredit, spent/expired replay refusal, rollback, cold
cached bytes and restart. Two contexts also defer same-item Present interlocks,
unrelated producer independence and legitimate later numeric/dated Present
growth without overwriting the shop pointer. Existing shop fixtures now carry
issued native signatures and defer serialized single/bundle actual ACKs,
pointer advancement/rewind and INSERT/UPDATE rollback. Synthetic Present
funding/source fixtures are not original gift provenance or native earning.
NONE RUN.

Uncaptured first constructors, replenishing Adventure Tickets, coalesced/mixed
equipment-costume-unit recovery, other resets/producers, signing/callback order
and native UI/performance/stability remain unfinished or unverified. History
cannot be inferred if both identifying records and native ownership are erased.
Counts remain124 partial/51 unsupported, not feature completion. Actual saves/
listener untouched; no tests, checks, builds, APK, restart, emulator, ADB,
workers or Actions. Co-op stays last.

## Captured ordinary shop cold recovery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Original9000 shop_apply24219c4 iterates boughtItems before the independent
costume/equipment loops, then unconditionally assigns absolute count/date
through241f39c. Empty item iteration skips the positive inventory adder, not
the product setters. Read-only source evidence: .work/shop-cold-original-
20261010.txt and the existing original shop decompilation/exact setter artifacts.

Shared shopColdRecovery now filters only fully observed original numeric/dated
item rows. Every ordinary target must retain its bound cap_version1 stock XOR
dated capture; untouched grants retain exact original positive quantities.
Incomplete stock/cumulative/signature or dated append/cumulative/signature
effects refuse without a guessed remainder. Existing positive-addition and
spending allowances, expired-date pruning, signed fields, full-width signatures
and Valis spending-floor validation remain. Original queue, source, item-price
expenditure, purchase count/period/date, verifier and signature are unchanged.
No second charge, native inventory precredit, schema change or fake ACK.

The saved item-price debit is now validated by the shared shopExpenditureReceipt
before parent or source-bound child recovery, including an already ACKed parent.
Missing/wrong operation bindings, table/ID/quantity, changed lifetime counters
or invalid saved before/after cost fields refuse without taking another payment.
It reuses the original indexed shop_spend record, not current spending balances.

Cold login/pull validate this shared path; confirmation emits only the derived
item list with unchanged count/date. Cached confirmations still require exact
current tokens, ordered queue and original-or-derived envelope. Hot retries
remain unavailable after effects, and save replies withhold pending callbacks.
Actual9000 ACK now requires exact captured purchase count/date: a pre-reset
higher count must not settle a date-only save while the native reset is missing.
Original shop periods, authored limits and prices are retained.

64 NEW WRITTEN ONLY cases in test_shop_cold_recovery.cjs cover eight original
offers, crossing/saturated lifetime baselines and four count/date/one-item/all-item
first saves. Original paid bundle207000797 retains all eight grants across three
native tables; original monthly207000008 captures count7-to1 without accepting
the old count. Cases retain native rows/cost/queue/wallet, byte-identical current
cache/restart, stale cache refusal, missing/corrupt source, real ACK/rollback and
spent stock/expired ticket dates without renewal. EXISTING test_shop.cjs ordinary
cap orders and standalone dated expectations now use recovery; partial stock,
append/cumulative and uncaptured mixed pack cases still refuse. NONE RUN.

EXISTING15 original Valis207000044/quantity30000 cases now also cover cold
count-first/observed/spent rewards without a second Familia spending credit;
incomplete stock-prefix effects still refuse. These additions remain WRITTEN
ONLY / NONE RUN. No new contexts or native Valis earning proof are claimed.

Uncaptured/legacy ordinary items, first item constructors, equipment/costume/unit
mixtures and remaining purchase/reset/producer branches remain unfinished.
Synthetic funding/stock/save order is not native earning, callback or no-crash
proof. Counts124 partial/51 unsupported unchanged; earlier DDL UNAPPLIED,
actual saves/listener untouched. No tests/checks/generators/build/APK/install/
restart/emulator/ADB/workers/Actions; all149 and variants before acceptance.

## Paired Memoria shop cold recovery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

The original30 active Memoria exchanges keep their amount1, price250 of item
205000004 and lifetime limit1; the other four authored zero-length windows
remain inactive. Their source-bound9000 has no inline item/costume/equipment
grants and may repeat only the captured absolute count/date. Separate6000
reuses the existing first/preowned card observation path; an already saved
card is omitted from its derived receivedMemorias without changing growth.
Empty-claim6000 is still restricted to the exact original6000/9000 binding,
including source product, quantities, targets, nonce and original receipts.

90 NEW WRITTEN ONLY cases in test_shop_memoria_recovery.cjs cover all30 active
exchanges and count/date/card first saves, absent/owned0/owned5000 cards,
lazy product rows, owner/signature/growth preservation, both individual ACK
orders and combined ACK, source corruption, premature ACK, restart/cache,
rollback and original lifetime limit/cost. EXISTING test_memoria_rewards.cjs
all30 shop cases now expect derived card recovery after first/full saves and
either first ACK. NONE RUN. No native card creation, fake closure or EXP reset.

The earlier SOURCE ONLY zero-casino ARM64 adapter is still unbuilt/uninstalled;
native6000 independently calls casino even when its quantity is0. Native shop
loader/callback/signature/card growth/order/clock/UI/performance/stability remain
unverified. This supersedes only older statements that pure paired Memorias
cannot cold-recover; it does not establish complete shop or Memoria gameplay.

## Personal and General Bond rewards — SOURCE ONLY / UNTESTED (2026-10-10)

Both original six-field bond classes now use ordinary9000 caps/positive allowance/
spending closure/actual signature/capped lifetime effects/full mixed ACK/atomic
saves/completed guards. Deferred additions retain542 original Personal offers
times five orders (2710),32 ordinary General offers times five orders (160) and
all94 original paid General mixed packs times three orders (282). One-purchase
and monthly limits/costs/windows remain original; same-table secondary bond rows
are retained alongside all other bundle rewards. No personal-bond packs exist.
General's two28100 shard exchanges remain separate absolute callbacks; saturated
exchange/full-row interleaved spending is still unfinished, not ordinary-cap
support or fake success. Tests are WRITTEN ONLY/NONE RUN, not native provenance/
order/signing proof. No master/schema/wire/issuer rewrite or precredit. See
personal-bond-item-contract.md and general-bond-item-contract.md; source counts
125 partial/50 unsupported unchanged, actual saves/listener untouched.

## Alarm-voice stock caps — SOURCE ONLY / UNTESTED (2026-10-10)

Original UserAlarmVoiceItem seven-field inventory/alarmVoiceItemId/reservedAmount,
UInt8 book and full UInt32 signature now join existing9000 capped capture,
positive allowance/spending closure/actual observation/full mixed ACK/atomic save
and completed-stock guards. All67 authored offers retain quantity1/event-item
price3/no purchase limit and their original windows.335 deferred cap orders
cover all67 offers through five existing save-order scenarios, plus native-row
refusal/capture corruption/rollback/cold-exact retries/once-only cost/completed
restore refusal. All are WRITTEN ONLY / NONE RUN; no original data, actual save,
schema or listener changes. No linked packs/final-box prizes were invented.
See [alarm-voice item contract](alarm-voice-item-contract.md). Alarm selection,
playback/scheduling/consumption, legacy/coalesced saves and native acceptance
remain unfinished/unverified;125 partial/50 unsupported counts unchanged.

## Adventure Ticket inventory and caps — SOURCE ONLY / UNTESTED (2026-10-09)

Original lastResetAt-based seven-field rows now use strict native validation.
Five non-replenishing Adventure Ticket IDs join the existing capped reward,
spending allowance, actual-signature/mixed-ACK, atomic save and completed-stock
path. Scheduled-reset IDs still need the separate140000 replacement handoff.
45 added cap orders retain original207000002..207000007 Iris-priced one/eleven
ticket offers and207000035..207000037 event-item-priced offers. Original172
standalone offers/no linked packs/no final event-box prizes were retained,
not fabricated. Deferred Iris cases cover once-only charging through partial
saves/cold retries/exact ACKs. See [Adventure Ticket contract](adventure-ticket-contract.md)
for112 total WRITTEN ONLY cases and remaining native reset/consumption gaps.
NONE RUN; no schema/wire/issuer/native precredit/data rewrite, counts/saves/
listener unchanged, previous DDL UNAPPLIED and no gameplay acceptance claimed.

## Hero Ascension unlock inventory and caps — SOURCE ONLY / UNTESTED (2026-10-09)

Original2633e00:2634238 seven-field heroSublimateUnlockItemId inventory retains
reservedAmount, UInt8 book and UInt32 signature. Domain256bfa4 forwards full
signature, vtable42c1400 uses common gain/max/lifetime, and original
itemType200000034 maximum999999999 is now in the shared cap validator. Existing
9000 captured before-stock/signature/quantity/positive allowance/effects/full
mixed ACK/atomic save/completed checkpoints reuse the same implementation.
No new wire/schema/issuer/native stock/signature/count precredit or master edit.

Original207001786 gives98000001 x1, costs30 event290000233, limit10, with its
actual2019 windows retained. Five new save orders and native-field/wrong-Hero-ID
cases are WRITTEN ONLY / NONE RUN. There are111 standalone unlock offers,
no linked bundles/no final event-box prizes; none were invented. Synthetic price
funding/order is not native earning or shop acceptance. Mission/Present caps
and stage/Element fixture fields also retain the native class. Other producers/
types/constructors/coalesced/legacy/native signing/order/UI/recovery/performance/
stability unfinished/unverified, prior DDL UNAPPLIED, saves/listener/counts
unchanged; no tests/checks/generators/build/APK/install/restart/emulator/ADB/
workers/Actions, all149 variants before testing/co-op last;
docs/achievement-reward-contract.md.

## Equipment-material inventory and caps — SOURCE ONLY / UNTESTED (2026-10-09)

Original ARM64 JSON readers27d52dc/27d57b0 use `enhanceItemId` and `evolveItemId`,
not equipmentEnhanceItemId/equipmentEvolveItemId. Each owns seven fields:
userId, native item ID, amount, reservedAmount, bookEntryState, signature and
cumulativeAmount. Book uses protected UInt8/22e6718; signature uses protected
UInt32/28bac48/1e99d08 and JSON206b578. Changed signatures dirty the native row
at286fab4/28707a4 even when numeric stock cannot rise. No dateList or lastResetAt
field belongs to these two rows. This is read-only original binary evidence,
not native save/signature acceptance.

Constructors2509780/24a1bdc bind literal original item_type.equipment_enhance_item
and item_type.equipment_evolve_item through244c118/24d876c; no itemType join was
guessed from the unrelated byte getter at master vtable offset16. Original
itemType200000028/29 slot3 stock maxima are999999999. Vtables42bcc48/42b6d18
bind common gain24d8844/max24d8d6c and the real stock/signature setters
250a028/24a24d4; lifetime/cumulative setters250a220/24a26cc use286fb08/28707f8.

Corrected only the eight existing master item-profile ID mappings (three enhance,
five evolve) and decoder source; all authored catalogs, quantities, prices,
windows and source hashes are retained. The shared primary-ID selector and
inventory validator now require the native keys and seven-field owned rows,
integer stock/reserved/cumulative, UInt8 book and UInt32 signature. No alias
normalization or existing save/receipt rewrite is performed. Old synthetic
long-ID rows or receipts require reconciliation rather than guessed conversion.

Both classes reuse the existing capped numeric Present2000/shop9000 capture,
issued-signature exclusion, bounded positive-addition allowance, spending rules,
effect/replay suppression, strict full ACK and completed-stock checkpoints.
No second stock ledger, native stock/signature/token precredit, fake success,
new wire fields or schema is added. Existing profile/token/receipt/queue/done/
exact-reply transactions remain. Other capped producers are still unfinished.

The original catalog actually has334 standalone enhancement offers,336 evolution
offers and seven enhancement packs (no evolution pack). Final event boxes have
neither material class; no prize or offer is manufactured. WRITTEN ONLY / NONE
RUN: test_shop.cjs extends existing five-order numeric cases with eight original
products/all eight item IDs (40 cases), including original key-item prices for
31000004/05. It adds21 cases across every original enhancement pack and three
save orders, retaining original100-material quantities, paid costs, dated tickets,
materials and generic bonds. Cover split/first-save-spent stock, UInt32 collision,
malformed native/old-ID rows and captures, mixed-reward missing ACK, atomic issue/
ACK rollback, cold/cache/exact retry, once-only debit and completed stock rewind.
test_gift_items.cjs adds56 capped cases/all eight IDs and seven orders, including
UInt8 book255, missing/extra reserved/date/reset/old-ID fields, bounded additions,
spending/closure/rollback/restart and the next Present. Synthetic wallets,
Presents and save ordering are not native earning or application proof.

Master-ID checks and affected mission/stage fixture constructors are written only.
No tests/checks/generator/build/APK/install/restart/emulator/ADB/workers/Actions
were run. No actual save opened or changed; earlier receipt DDL remains SOURCE
ONLY / UNAPPLIED. All routes stay partial/unsupported (125/50); constructors,
other capped producer branches, unsaved coalesced gain/spend, legacy recovery,
native signing/order/UI/clock/performance/stability remain unfinished or unverified.

## Capped dated shop tickets — SOURCE ONLY / UNTESTED (2026-10-09)

Original24219f0 keeps9000's incoming signature,2421b9c:2421ba8 calls bought
item slot50 with quantity and that signature. Common24d8a18:24d8a28 computes
stock plus quantity and24d88e8:24d88f8 forwards the signature into slot48.
Dated-ticket setter2576654 retains w2, adjusts the date vector by append/prune,
then25766c0:25766d8 forwards its nonzero signature to2638798. Thus a shop
ticket can still prove the gain when lifetime999999999 cannot increase.
This read-only original binary evidence is not runtime/native acceptance.

Fresh9000 rewards reaching/crossing the lifetime cap now also capture an actual
owned six-field UserGachaTicket baseline in nullable private `gacha_state`, with
`cap_version=1`, policy `offline-shop-gacha-cap-v1`, before cumulative/date
multiset/UInt32 signature and distinct issued signature. Exactly one dated or
numeric capture is allowed. Original bought quantity/window/price/limit and all
mixed rewards remain; no native dates, amount field, signature, token, product
flags or ACK are invented/precredited. Signed lifetime/date-count additions
must fit before native clamping. Missing owned constructor/history remains
unfinished rather than synthesized.

The existing Present dated capture/effect validator is shared without dropping
its exact fields, signed book-byte/UInt32 ownership checks or error handling.
Duplicate acquired dates are quantities. Positive additions across all partial
saves consume the original-quantity allowance; expiry/pruning never refunds it.
Expiry alone does not prove the callback or suppress its still-unapplied grant.
Actual issued signature plus capped cumulative proves delivery even when no new
date survives the first save and closes unused allowance. Actual effects suppress
additive hot/cold/cache replay while keeping the real pending queue and strict
product count/date, saved item or paid price, and full mixed reward ACK.

Compare-prior dated/numeric capture updates share the existing profile/token/
receipt/queue/done/exact-reply transaction. The common lottery replacement issuer
now also retains completed shop dated-stock checkpoints. Pending capped shop
or Present tickets cannot be overtaken by a same-item full-row lottery consumer;
the opposite order requires that1000/1001 replacement to ACK first. Existing
same-item additive producer reservations remain. Old capped receipts with no
dated capture are not silently given a guessed allowance/signature.

WRITTEN ONLY / NONE RUN: `test_shop.cjs` adds28 cases across original normal
207000033, character_3 207001506, beginner mixed pack207000001 and costume pack
207003535 (including original two-ticket quantity). Seven orders cover append,
count/date, cumulative, signature, combined, gained-dates-already-gone and
expiry-before-gain. Include duplicate dates/signed widths/collision-wrap, missing/
corrupt/mixed captures, old-signature ACK refusal, allowance pruning/refund/
closure, issue/partial/ACK rollback, cold/cache/exact ACK, all mixed ticket/
costume/voice effects, completed restoration/rewind refusal and a subsequent
captured Present. Four additional consumer-first cases retain the queued1000
and decline a new9000 after restart. Standalone price-save receipts and paid
pack costs remain enforced; synthetic funding/time/order/Present data is not
native earning or complete offer/catalog/UI acceptance.

New nullable shop gacha_state DDL is SOURCE ONLY / UNAPPLIED. Existing numeric/
Valis columns/migration are still unapplied. No real save opened or changed;
no tests/static/syntax checks/generators/build/APK/install/restart/emulator/ADB/
workers/Actions. Supersedes only the dated shop gain gap below. Other capped
classes/producers, subscription/constructor/coalesced/legacy reconciliation and
native signing/order/clock/UI/recovery/performance/stability remain unfinished
or unverified. Counts125 partial/50 unsupported; all149 original packets and
variants before testing, co-op last.

## Numeric and Valis caps — SOURCE ONLY / UNTESTED (2026-10-09)

Original9000 `shop_apply`24219c4 retains the incoming signature and forwards
each bought item's original quantity through slot50 with that signature.
The decompiled call is `(*item.slot50)(item,quantity,param_4)`; original2421ba4:
2421ba8 forwards the issued signature. Ordinary24d8844 gain, stock limits and
lifetime clamping therefore also apply to shop rewards. This is client evidence,
not live-server or native acceptance.

Fresh seven-class numeric/Valis rewards reaching lifetime999999999 retain actual
owned before-stock/cumulative/UInt32 signature, clamped stock, original quantity
and distinct issued9000 signature in private `shop_item_claim.stock_state`.
Existing Present numeric capture/effect validation is shared. Native stock limits
and both signed additions are checked before clamping. No original reward,
price, window, limit, native profile, token or ACK is invented or precredited.
Unknown constructors and overlapping same-item producers are not synthesized.

Positive additions across partial saves consume the original-quantity allowance;
spending never refunds it. Actual issued signature plus capped cumulative proves
delivery even after spending before the first save and closes unused allowance.
Effects suppress additive hot/cold/cached replay while retaining the real queue.
Count/date, paid or saved item cost, equipment/costume/unit/Memoria effects and
full mixed ACK remain required. Compare-prior capture updates share the existing
profile/token/receipt/queue/done/exact-reply transaction. Completed stock cannot
be restored without another validated grant.

Capped Valis205000002 binds quantity/clamped stock gain to
`offline-shop-valis-floor-v1`. Only actual saved9000 signature observation earns
positive stock-gain-minus-cumulative-gain credit once. The existing Familia floor
retains source kind `shop`, permanent original-product receipt and captured9000
after ACK. Count/date alone earns nothing, full-stock/no-charge grants mint no
credit and later donations remain protected. Older22000/22100 charges must settle
before gain capture; coalesced unsaved order remains unfinished, not guessed.

New cap_version/stock_state/valis_state/valis_seen columns/indexes are SOURCE ONLY
/ UNAPPLIED. Exactly known old two/three/four-source floor schemas migrate
losslessly to five sources with a v3 backup; existing v1/v2 backups are retained.
Unknown schemas, foreign references, custom indexes/triggers or a v3 collision
refuse migration. No real save was opened, migrated or changed.

WRITTEN ONLY / NONE RUN: `test_shop.cjs` adds30 six-authored-class/five-order
cases using actual offer quantity/price/window/limit. No standalone voting offer
exists, so none is fabricated. Include collision/wrap, capture corruption,
old-signature refusal, bounded additions/spending/closure, partial/ACK rollback,
cold/cache suppression, exact ACK retry, completed rewind/restoration refusal
and a second original purchase with another saved price expenditure.
`test_familia_valis.cjs` adds12 original207000044/30000-Valis cases plus zero
credit, source loss and later donation. `test_familia_creation_schema.cjs` has10
deferred modes including old Present schema and both prior backups. Funding,
clock/save order and local Familia fixtures are synthetic, not native earning.

Capped dated tickets, other producer/type branches, constructor/coalesced/legacy
reconciliation and native signing/order/clock/UI/recovery/performance/stability
remain unfinished or unverified. This supersedes only named cap gaps below, not
historical acceptance scope. No tests/checks/generators/build/APK/install/restart/
emulator/ADB/workers/Actions; saves/listener unchanged. Counts125 partial/50
unsupported, all149 original packets/variants before testing, co-op last.

## Mixed unit/card hot delivery (2026-10-07)

Partial `shop/buy` support now includes a signed1000 unit/bond or6000 Memoria
prefix before its signed9000 purchase. Original hot209bd48 queues only the
singular `operation`; save receiver20bd8f0/206a938 only removes acknowledged
operations, not new deliveries. Sending plural operations alone, or returning
the unit/card as the callback operation, cannot complete this purchase path.

The existing ARM64 patcher adds a guarded24-byte adapter in verified executable
alignment padding153f030 and redirects only the hot-parser call209c038. It
preserves frame/link and both arguments, invokes original cold loader20bbca4
on the optional prefix, then tail-calls original singular parser2069e14. The
unchanged processor206a0c4 verifies and applies both operations in order, and
callback209e930 retains9000 parameters. No reward handler, signature check,
purchase authentication, save/ACK check or publisher asset was rewritten.
This is an explicit offline-client transport extension, not recovered original
publisher mixed-shop wire parity; ARMv7 is unchanged. Exceptional allocation/
native unwinding through the small adapter has not been verified.

Shared response projection binds exactly one1000/6000 and one9000 to the
existing `shop_request.reward_operation_id`. Its singular9000 envelope has
`operations:[award]` outside the signed parameters; the durable cold array stays
`[award,purchase]`. Fresh, pending and old cached replies reuse the original
signed objects. No new operation, schema, profile precredit, debit or receipt
replacement. Existing split-effect suppression and every strict reward/count/
expenditure ACK requirement remain intact.

Full local shop and Memoria checks pass: new units, duplicate bonds, all30
active original card exchanges, original4 inactive windows, exact hot prefix,
old-cache repair with unchanged SQL snapshots, costs, split saves/either ACK
order, corruption, rollback and restart. Nine other full checks pass on this
revision; native-patch span/branch/argument/mismatch checks pass separately.
`test_gift_items.cjs` instead exited WindowsC0000409 at UserEventItem without
a JS exception or final success; its previous-revision pass is not a current
pass. The shared long-process failure remains unresolved.

Game ARM64 split and launcher built locally and replaced in MuMu without
Actions/workers. Installed native090b500c, server81f51c55 and launcher028f28c6
match their local artifacts; all seven packaged/runtime modules match source.
Separate Adventure16/date2019-10-18 reached title and town, opened Shop and
returned to town with rank3/SP59/Iris0/Valis31020. This is startup/navigation
evidence, NOT a native mixed purchase/effect-save-ACK acceptance: the stopped
read-only prior copy has no PC tickets, keys, event items or cards. No funding,
gift, unit, flag, clock or SQL injection was performed. Native mixed purchases,
all price/product windows, exceptional recovery and full stability remain
pending. Co-op last; the route remains partial.

Final normal Tools Stop removed the game PID and listener28766. A new stopped
read-only copy of only `eb8b83ee` has integrity `ok`, queue0, prior shop ACKs16/17,
Falna Orb amount/cumulative2, purchase count/date2/1571433573 and EXP721/rank3/
SP59/free-paid Iris0/0. PC tickets, keys, Memoria and event items are empty.
Only next-launch metadata was restored to Adventure5/date2022-08-20; its DB
was never opened or launched. Launcher Offline/19 profiles and shelluid2000
were verified. This confirms retained prior state, not a new mixed purchase.

The original implementation-first notes below are historical. The2026-10-07
follow-up supersedes their NOT RUN/source-only status only for its named
checks and ordinary shop purchase. No workers or GitHub Actions; co-op remains
last. Neither full shop support nor a fully playable game is established.

## Hot9000 delivery and Memoria EXP checkpoints (2026-10-07)

A real Adventure16 purchase207000002 initially displayed Falna Orb x1 and
charged10 naturally earned free Iris, but ItemShopBuy21128 saved no ticket
and ACKed no operation. A stopped, read-only copy of only `eb8b83ee` proved
operation16 still queued, no orb, product count/date0 and wallet10. The popup
alone was not reward delivery.

Original wrapper2421690 uses common209b70c/209bd48 transport. Reused the
existing hot-reward alias: an exactly single9000 `shop/buy` response now
includes the same signed `operation` as its existing `operations` array.
Fresh, pending and old plural-only cached replies share this path; observed
partial9000 remains suppressed. No new operation, altered receipt, fake ACK,
extra debit, native inventory write or relaxed mixed-reward proof.

On the replacement local offline APK, normal cold WorldInitState21131
saved/ACKed16 with UserAdventureTicket/UserShopProduct. A second normal
10-free-Iris purchase21137 issued17; hot ItemShopBuy21138 saved both tables
and ACKed17 immediately. Reward popup and usable town rendered. The stopped
copy has integrity `ok`, queue0/done16 and17, original Falna Orb298000001
amount/cumulative2, product count2/date1571433573 and free/paid Iris0/0.
Player EXP721/rank3/SP59 and displayed Valis31020 stayed intact. No injected
funding or test-profile SQL writes. Mixed1000/6000+9000 native delivery and
other prices/products remain unverified; the single-operation alias is not
claimed to deliver every mixed reward hot.

Shared Memoria saving also now advances existing acknowledged per-card
`achievement_memoria_floor` to actual accepted EXP, including actual6000
ACK EXP. A subsequent save must retain both that checkpoint and actual prior
native-shaped EXP. Reads reject missing/regressed checkpointed cards without
erasing damaged data. Reused the per-save index and existing primary-key
floor/profile/queue/done/reply transaction; no schema, native precredit,
owner/signature/token normalization or legacy-floor backfill. Complete card
upgrade/cost/provenance and native card acceptance remain pending.

Eight full disposable-save/source checks passed on server SHA-256
`8c4d41a95b48c3384b757fbd0cf1b5218740743722e8574ceb7cc3233fbce6b0`:
test_shop, test_memoria_rewards, test_achievement_items, test_stage_persistence,
test_native_board_checkpoint, test_gacha_persistence,
test_communication_wardrobe and test_launcher_lifecycle (all `.cjs`). Shop
includes old-cache alias repair with unchanged wallet/queue/receipts/replies;
Memoria includes stale EXP red-to-green, actual ACK EXP, older-floor/newer-row,
restart/corrupt reads/deletion/no legacy backfill and transactional rollback.
Fixtures now use actual original expiring reward rows, bodyless confirm and
distinguish semantic cancellation from empty SQLite503. Two initial local
shop/stage-save attempts exited1 without a JS assertion or final success;
traced full reruns passed. That process behavior remains unexplained and is
not a broad stability pass.

Installed APK SHA-256:
`6ea929abaa60761d5a3c22f1847818b168ed84bf93c69177ccdd8de61c66e09c`.
Installed base.apk and seven packaged/runtime modules matched local source.
The separate native profile has no Memoria rows, so these shop observations
do not prove native Memoria mission/shop receiving or card progression.
Cold confirmation21140/WorldInitState21141/AreaChanged21145 returned to usable
town with Iris0/Valis31020/rank3/SP59. A second stopped read-only copy retained
orb amount/cumulative2, count/date2/1571433573, queue0 and done16/17; integrity
was `ok`. No ANR recorded since this emulator boot is bounded evidence only.
Final normal Stop removed game PID/listener28766; restored only next-launch
Adventure5/date2022-08-20 metadata,Offline19 profiles and shell uid2000. The
original player database was never opened or launched.

## Frozen client evidence

Original15.1.0 ARM64 SHA-256:
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
Current read-only extraction verified ELF unwind bounds, not guessed starts.
Raw addresses below exclude Ghidra's0x100000 image bias.

- `24219c4:24222b8` applies9000: `boughtItems` through the original item
  repository/vtable0x50, integer `boughtCostumes` through2505fc4, and
  `boughtEquipments` through2584ea0. It then sets product count/date.
- `241f39c:241f48c` calls the shop state getter, the count setter, then
  the date setter. They are distinct saved fields, not one completion flag.
- Existing artifact `.work/shop-contract-decompile.txt` contains the full
  shop handler/state trace. The current exact setter is
  `.work/shop-exchange-exact-20261006.txt`; headless process exit0 and script
  success were checked before reading its complete output.

9000 does not contain inline PC/Memoria awards. Existing separate1000/6000
operations stay separate; this extension does not recover their publisher
pairing, natural eligibility, complete initialization or interruption proof.

Current read-only original6000 bounds are `2361db4:23631b0`. The bounded raw
`2362574..236269c` card loop reads ID/level, converts level to EXP through
24fb0f4, and looks up the card through24f9e60. For a preowned card it compares
24f9634 current EXP with requested EXP and calls24fbe18 only when the request
is higher; absent cards use24f99d4. A level1 shop reward must not reset a
preowned card to zero or become a duplicate item award.

## Source changes

Fresh `shop_request` rows capture the exact operation (including parameters,
token and signature), the actual saved count/date or explicit JSON-null absent
row, and changed observation keys. Nullable additive schema fields distinguish
unknown old receipts from a genuinely absent before row. No legacy snapshot is
inferred from current inventory. Native profiles, counters, flags and signatures
are not prewritten by issuance.

`shop_item_claim` retains a typed original item/quantity/table/ID-field and
reserved cumulative target per operation/item. It reuses shared acquisition
reservations and saved-item validation, including ticket date lists, instead
of accepting arbitrary positive cumulative numbers. Item costs still require
the existing exact saved expenditure; Iris costs remain once-only within the
existing issuance transaction. Mixed costume/voice/piece and paired-unit ACK
checks are retained, not substituted with a count or one item.

Count and date observations only represent a changed before-to-target field.
Periodic purchases can lower counts; pending states are compared with their
captured before/target projections, not a lifetime monotonic counter. Ordinary
item observations require their cumulative target; later spending remains
valid. Observed stock/counters cannot disappear or rewind while pending.
Existing shared costume/voice and equipment-piece observations also suppress
9000 delivery, including saved pieces subsequently sold.

Partial saves omit only9000 delivery in push responses, retaining its queue
and all mixed ACK requirements. Hot/cached/cold and completed callbacks cancel
with native recovery code3000999 until actual ACK/reconciliation. Missing,
null, changed or corrupt receipts retain history and queue; unavailable is
not fake purchase success or proof of a usable recovery screen.

Changed observation updates commit atomically with profiles, queue/done,
sequence and reply. Shared item reservation/completed-stock checks now seek
indexed shop-item targets. Changed product IDs seek completed counts by
product/period/count index instead of scanning all lifetime purchase JSON.
Only bounded pending legacy JSON remains for old reservations. Cached binary
shop/count/acquired-item pulls must match current durable state. Old completed
item targets are not guessed/backfilled; no measured performance claim.

### Memoria purchase capture extension

Native-owner follow-up: original2896604 initializes new Memoria userId0;
24f99d4 acquisition/insertion does not replace that owner. Shared saved-card
proof now accepts and preserves0 or the local account ID, rather than rejecting
the real native absent-card initialization. General card saves/read/session
reloads use explicit memoriaId identity, unique original rows and bounded EXP;
foreign/malformed rows or switching an existing owner remain rejected.
Owner/signature/token bytes are not normalized or prewritten. See the bounded
constructor/reader/import evidence and deferred checks in
`achievement-reward-contract.md`; native acceptance remains pending.

Shop Memoria6000 now reuses `achievement_pc_delivery`, its nullable
`memoria_targets`, `achievement_reward_state`, save observations and actual-ACK
`achievement_memoria_floor`. No new reward ledger, packet or native profile
precredit. Issuance captures actual absent/preowned EXP and binds that minimum
to the existing9000 receipt atomically with the real price expenditure and
reply. The reward-operation lookup has a nonunique index; ambiguous multiple
shop bindings are rejected rather than silently choosing one.

Empty mission claims are accepted only for one retained original Memoria shop
source: exact6000/9000 captures, original product/quantity/window/price/count,
queue or real done parent, and matching saved EXP targets. All34 original
products retain their catalog: four have equal start/end and remain inactive,
30 have open-ended windows. No raffle shop products were found or invented.
New-card saves observe presence; unchanged preowned cards, including EXP0,
are not falsely classified as new effects. Split card/count/date saves retain
the queue; hot/cached/cold observed callbacks still cancel3000999 pending ACK.
6000 and9000 ACK in either order retain the original capture; real6000 ACK
records the existing per-card presence/EXP floor. Preowned EXP loss, duplicate
or foreign ownership, pending/acknowledged card deletion and stale binary
card snapshots remain rejected. Missing legacy captures require reconciliation;
today's inventory never backfills a lost original baseline.

## Deferred acceptance and remaining gaps

Extended `node tools/test_shop.cjs` covers original product/pack metadata;
free/paid Iris and saved item costs; item/pack/unit/Memoria/costume/equipment
receipts; count/date/item split saves in both orders; missing mixed ACK proof;
queue retention; hot/cache/login/confirm/pull/restart and settled popup-only replay;
unchanged unapplied retry; stale binary stock/count imports; malformed ticket
dates; missing/null/corrupt source/baseline/observations/targets; changed queue
token/signature; paired signed-capture corruption; pending/completed deletion/rewind; and issuance/observation/
profile/done/queue/reply rollback. These are synthetic encrypted requests and
saves, NOT signed native play.

Extended `node tools/test_memoria_rewards.cjs` is also DEFERRED / NOT RUN:
all34 metadata/four inactive windows/30 active exchanges, absent/preowned0
and5000 EXP, real-shaped saved item cost, unchanged6000/9000 wire and unapplied
retry, card/product split saves in both orders, combined or either separate
ACK order, restart/cold/cache retention, lost/corrupt source/target/minimum
captures without recapture, purchase/save/observation/floor/done/queue/reply
rollback, pending/completed downgrade/deletion and allowed later EXP increases.
Synthetic cost funding is not proof of natural acquisition or signed play.

Repeat shared gift/mission/stage/dispatch/scratch/gacha/acquisition, costume/
equipment, save/recovery, original-master, Android and launcher checks in the
consolidated batch. Shop UI/popups/assets, native lazy ownership/read flags,
natural eligibility, signed effect-save-ACK order, late/reset/event-clock
interleavings, independent mixed-reward attribution, paired PC/board/Memoria
 effects, legacy requests without a retained actual-wire purchase identity,
legacy reconciliation and usable back/recovery/no-crash-ANR/performance remain
incomplete or unverified. No route is declared feature-complete.
## Hero Ascension capped rewards — SOURCE ONLY / UNTESTED (2026-10-09)

Original99000001 uses seven-field UserHeroSublimateItem/heroSublimateItemId,
UInt8 book and UInt32 signature. Constructor256c800's literal item-type binding
has maximum999999999; stock setter256d098 preserves full incoming signature.
The shared Present/shop numeric cap machinery now handles this class without
new wire/DDL/issuer/native stock/signature/token/ACK precredit. Actual owned
before stock/lifetime/signature, captured quantity/remaining positive allowance,
spending closure, partial effects/full mixed save-ACK, atomic receipt/reply and
completed-stock protections retain their existing semantics. Legacy missing
capture proof is not guessed; other producers' cap paths are still unfinished.

Original catalog:107 standalone offers and112 linked bundles containing this
item. All original amounts/prices/currencies/windows/limits/mixed rewards remain.
Four bundle quantities are5/6/10/15; final event-box data contains no Hero prize.
WRITTEN ONLY / NONE RUN: test_shop.cjs adds five capped-save orders for original
207001787 (one Hero item for20 event items290000232, limit30), and12 mixed paid
pack cases (four originals/three orders):207003692,207001764,207001765,207001768,
costing400/200/300/800 paid Iris respectively and retaining all dated tickets,
Falna, EXP items and bonds. Existing enhancement-pack fixture logic is reused.
Include real native field widths, malformed ID/capture, signature collision/wrap,
no prewrite, partial-spent saves, strict full mixed ACK, issue/save/ACK rollback,
cold/cache suppression/exact ACK reply, once-only debit/completed restore/rewind
refusal. Seven corresponding Present cap cases and mission/stage/Element row
constructors are also written only. Synthetic funding/order not native proof.

Saves/listener/counts unchanged; earlier DDL UNAPPLIED. No tests/checks/generators/
build/APK/install/restart/emulator/ADB/workers/Actions. Other types/producers,
constructors/coalesced/legacy/native signing-order-UI-clock-recovery-performance-
stability unfinished or unverified; all149 variants before testing/co-op last.
Native source details: gift-reward-contract.md.

## Permanent purchase request identity — SOURCE ONLY / UNTESTED

New `shop/buy` requests and distinct pending retries now bind the actual
received request bytes and their original 9000 operation in an indexed
`shop_transport` row, inside the existing purchase/charge/queue/reply
transaction. A retained identity is checked before the short-lived reply
cache. While its original operation is untouched and pending, it reuses that
operation and any still-pending paired reward without another debit or grant;
the existing shop receipt and partial-save delivery guards still apply. Every
new receipt also stores the canonical signed9000 and canonical paired1000/6000,
if present, so the identity remains provable after native ACK removes the queue.
An acknowledged exact retry validates the authored product, price, expenditure,
count/date, item/equipment/costume effects and paired unit/bond/Memoria floors,
requires exclusive done states for the purchase and paired reward, then returns
the original root popup fields with an empty operation list. It cannot charge,
grant, initialize or add a duplicate bond/card twice. Changed bytes or another
action cannot reuse the identity. Missing/noncanonical captures, lost saved
effects and queue/done ambiguity retain recoverable unavailability. Legacy
settled purchases whose signed captures were never recorded are not reconstructed
from today's inventory.

`test_shop.cjs` and `test_memoria_rewards.cjs` now have WRITTEN ONLY cases for
issue/transport rollback, cache-evicted original and alias replay (including
paired unit1000 and Memoria6000), changed bytes, partial-save cold refusal,
popup-only acknowledged replay, damaged signed captures and missing/ambiguous
purchase or paired-reward queue/done states. None was run; no player save,
listener, APK or emulator was touched. The shop route remains partial until
original native purchase, paired reward, save/ACK/UI and no-crash acceptance.
