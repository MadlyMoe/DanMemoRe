# Present inventory receipts and remaining reward gaps

## Duplicate saved Present IDs — SOURCE ONLY / UNTESTED (2026-10-11)

Fresh `gift/receive` issuance now requires exactly one saved `UserGift` row for
each requested ID. A duplicate cannot silently select the first row and issue
an ambiguous signed operation; it returns the existing recoverable unavailable
response without changing the gifts, claim ledger, wallet or queue. The shared
native save boundary also rejects duplicate incoming IDs and refuses to
overwrite a profile that already has duplicate IDs. Missing IDs retain the
original invalid-request response. The deferred duplicate-row and save cases
in `test_gifts.cjs` are written but not run. This is a saved-data integrity
branch, not proof of reward delivery or native Present acceptance.

## Iris Present lifetime recovery, including captured mixtures — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

The original 2000 item iterator calls the normal gain slot for Iris 205000001.
`DomainCurrency` vtable `0x42c2330` binds gain slot `+0x50` to `0x24d8844`.
Its amount getter `0x257c80c` reads the separate Iris balance, while setter
`0x257c99c` skips the normal `UserCurrency.amount` write for the Iris ID.
The gain still calls lifetime slot `+0xb0` (`0x24d8d94`), which invokes the
`0x257d008` native cumulative setter. `0x257c268` creates the currency row
when absent. These are read-only original ARM64 observations, not native play.

New Iris-containing `gift/receive` claims now bind the original positive item
quantity and native cumulative target in `gift_item_claim`. An additive
`gift_claim.iris_capture_version` distinguishes them from existing saves and
uncaptured legacy claims; legacy rows default to zero. Issuance requires no unsettled
same-item producer, including an older unmarked Iris operation. The server-owned wallet is credited once in the same
transaction, while ACK also requires the client's saved exact Iris lifetime
target and saved gift flag. Flags or wallet credit alone cannot ACK it. Cold
replay retains the original Iris row while native lifetime is unchanged,
omits it only after the full target is saved, and refuses partial/foreign
changes. The same independent projection composes with already captured SP,
casino medals, capped items or dated tickets, PC/ExPC, equipment and costumes;
their own unchanged receipt and full-save requirements still apply. The source
operation, queue, token and full real ACK stay intact.

Older unmarked Iris claims, mixtures with uncaptured items/units, near-cap
coalescing and native wallet/UI/save timing remain guarded or unverified. The
new deferred pure-Iris and mixed-Iris/SP flags-first, partial-save, restart and
ACK cases in `test_gifts.cjs`, plus updated mixed-reward fixtures, are **WRITTEN
ONLY, NOT RUN**. No server, build, listener, save, APK or MuMu acceptance occurred.

## Equipment/costume with captured items, SP and medals Present cold recovery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

Original 2000 processes `receivedEquipments` and `receivedCostumes` in separate
loops from gift flags and other rewards. For a pure equipment gift, each
original equipment-ID grant now stays positive until its distinct bound native
pieces are all saved; a complete grant is omitted on cold confirm even if the
pieces were later sold. A partly constructed quantity refuses instead of
inventing a smaller remainder. Separate equipment types in one gift batch can
therefore progress independently. Source gift quantities, permanent piece
bindings, queue and full native ACK are unchanged.

For a pure costume gift, an already-owned unlock keeps its idempotent original
ID. A new locked costume can replay after linked voices save first; the native
helper revisits voices while the costume is still locked. Once costume and all
linked voices are saved, its ID is omitted. A saved costume with missing linked
voices refuses because replay would skip that native branch. The original
costume/voice receipt, owner/state guards, gift rows and full ACK remain.
An original Present containing both equipment and costumes projects these two
arrays independently under the same receipt and source-gift checks.
An SP gift may accompany either or both arrays: its independent receipt omits
the saved gain, while an unsaved gain still requires the exact ordered native
balance. Costume preflight leaves that ordered check to the shared Present
delivery path, so an earlier pending SP reward is not forgotten.
Captured casino medals may also accompany these arrays. An untouched grant
stays positive, a fully saved gain projects zero, and a partial stock/signature
effect refuses. A legacy medal receipt without its before-stock capture projects
zero only at its exact lifetime target under the queued operation signature.
The existing transactional casino observation update
now records saved Present gains as well as mission gains, so the next cold
request reads the same partial or complete receipt that the save established.
Captured capped-stock and dated-ticket items may accompany these rewards too.
Their original source quantities must match the item receipts, and only a
fully observed native item gain is omitted. Partial item effects or legacy
uncaptured item receipts cannot be projected as a smaller made-up grant.

Equipment/costume mixed with legacy Iris or uncaptured items, partial equipment copies,
and costume-first missing-voice repair remain unavailable. PC/ExPC mixtures,
including matching character/standalone costume unlocks, have the separate
captured path below.
The shared zero-casino ARM64 adapter is still source-only, unbuilt and
uninstalled. Deferred `test_equipment_rewards.cjs` and
`test_costume_rewards.cjs` split-save, sold-piece, combined equipment/costume,
ordered SP, captured-medal and capped-stock partial/full gains, voice-first and real-ACK cases
are written only; native rendering,
save order and crash-free behavior
have not been checked. This supersedes only the earlier blanket cold refusal
for these reward shapes.

## Ordinary-preowned and ExPC Present cold recovery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

The original 2000 ordinary `receivedPCs` branch skips an already-owned unit;
pure preowned ordinary character gifts can keep their positive IDs after saved
claim flags without inventing another acquisition. The separate ExPC branch
reads current limit-break and ascension levels and calls the native max/board-OR
helpers, not a duplicate-bond grant. Distinct ExPC gifts now keep an
unsaved or incomplete upgrade positive and omit only a fully saved owned
target. A newly acquired ExPC may replay an incomplete upgrade only after its
captured base unit, job set, character, wardrobe and story initialization is
complete. A partial first initializer still refuses because the existing-unit
lookup would skip missing base effects. If a later higher limit break would
make the old helper skip required missing limit-break board bits, recovery
refuses rather than claiming repair.

An ExPC batch may also contain original stamina gifts. The SP row is projected
independently: an unsaved gain keeps its positive original quantity only when
the owned balance matches the ordered before-state, and a saved gain is omitted
without renewing spent SP. The ExPC upgrade still needs its full captured
unit/board proof before omission; a partly saved upgrade stays positive only
where the original max/board helpers can safely finish it. Gift IDs and summed
SP must match the immutable source. Two deferred `test_gift_characters.cjs`
save-order cases cover upgrade-first and SP-first, early ACK refusal and real
closure. They have not run.

The original typed gift/PC receipts, immutable positive source operation and
full native save/ACK remain. No unit progress, board bits, signature or claim
is prewritten. The zero-casino ARM64 adapter remains source-only, unbuilt and
uninstalled. Duplicate ExPC IDs, guest-linked and other mixed reward batches, and
finer in-flight stat/board/save phases remain unfinished. This supersedes only
the older blanket cold refusal for these character and SP variants. Deferred preowned
ordinary, preowned two-half upgrade, first-ExPC base/upgrade and higher-limit-
break gap cases in `test_gift_characters.cjs` are written only; native UI,
signatures, ordering and no-crash behavior are unverified.

## First-character Present cold recovery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

Original 2000 iterates `receivedPCs` separately and initializes a unit only
when absent. For an isolated batch of distinct, ordinary first-acquisition
character gifts, cold delivery now keeps each unsaved ID and omits only an ID
whose owned unit, job set, character, wardrobe and unit-story effects meet its
retained original receipt. A partially saved unit/board/linked effect refuses;
gift flags alone do not count as character proof. The queued positive source,
gift rows, signature and full native save/ACK remain unchanged. The existing
zero-casino ARM64 adapter is needed because 2000 still calls that helper with
zero; it is source only and unbuilt. Duplicate PC IDs, guest-linked units and
mixtures with Iris, uncaptured items, equipment or costumes remain guarded.
Captured-medal mixtures have the separate conditions below. Pure preowned and ExPC variants have the separate conditions above. The deferred
first-character split-save/cold/ACK case in
`test_gift_characters.cjs` has not run; native character initialization, save
ordering, UI and no-crash behavior are unverified.

A distinct first-character batch may also include original stamina gifts.
The independent item loop keeps the positive SP row until its captured native
gain is saved; a saved gain is omitted even if later spent. The unit ID is
omitted only after its complete captured initialization. Unsaved SP still
requires the exact owned balance and ordered earlier reward baseline. Source
gifts must account for the exact character IDs and summed SP quantity; no
unit, SP, gift flag or ACK is prewritten. Two deferred `test_gift_characters.cjs`
save-order cases are written only. ExPC-plus-SP has the separate guarded path
above; captured items have the path below, while other mixtures remain
unfinished. Native order and gameplay have
not been verified.

## Character with captured items, medals, equipment or costumes — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

Original 2000 applies character and `receivedItems` loops separately. A
distinct ordinary PC or ExPC batch may now include source-bound capped stock,
dated tickets, SP, captured casino medals, equipment and distinct costume IDs.
The original gift rows must account for every character ID, each exact item
and equipment quantity, each one-unit costume gift (including repeated IDs),
summed SP and medal amount.
Typed item captures
retain the original positive quantity until its full native stock/date,
cumulative and signature effects are saved; only then is that item row omitted.
A partly applied gain refuses rather than inventing a smaller grant. Character
initialization or ExPC max/board effects retain their existing independent
proof, and unsaved SP still requires the ordered owned balance. Captured medals
retain their positive amount until the saved stock/cumulative/signature proof
is complete; a partial medal effect refuses. Equipment keeps its full original
quantity until every bound native piece is saved, including pieces later sold;
a partial set refuses rather than replaying an invented remainder. A new
costume may replay after linked voices save first; it is omitted only after
both the unlock and every linked voice are saved. Costume-first with missing
voices refuses, while an already-owned costume keeps its idempotent ID.
The original first-PC initializer and standalone costume callback both use
the locked-or-absent check: an already-unlocked costume is skipped. None of
the 346 distinct original character initial-costume IDs has linked voice rows.
When both gifts name that same initial costume, their captured target and
before-state must match exactly. A saved unlock can leave the still-absent PC
positive and omit the standalone costume ID; a complete PC omits both.
Saved partial unit, board, character or story effects still refuse. Distinct
costume gifts with missing linked voices still follow the earlier refusal.
No item, unit, equipment, costume, wallet,
flag, queue or ACK is prewritten or fabricated.

Four deferred `test_gift_characters.cjs` cases cover first-PC plus capped stock
and preowned ExPC plus a dated ticket, each in both save orders; one partially
saved stock also requires unavailable recovery. Four further deferred cases
cover first-PC and preowned ExPC with medals in both save orders, including a
partial-medal refusal and early ACK. One combined first-PC/item/medal case
checks all three independent save phases. NONE RUN. Uncaptured/coalesced items,
legacy/coalesced medals, Iris and guest mixtures and native callback, UI and
no-crash behavior remain unfinished or unverified. Four additional
first-PC/ExPC plus two-piece equipment cases cover both save orders, partial
equipment refusal, early ACK and full closure. Four more first-PC/ExPC plus
distinct costume cases cover both save orders, voice-first and costume-first
split effects, with one repeated-costume-source case. Three overlapping
character/costume cases cover flags-then-costume, character-first and first-
ExPC costume-first save orders, including a mismatched-capture refusal; all
are written only.

## Captured casino-medal Present and cold recovery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

Fresh `gift/receive` medal rewards now reuse the existing mission casino
before-stock/cumulative/signature receipt when no unobserved casino producer
overlaps. The original 2000 medal helper and its positive quantity are unchanged.
The issued signature excludes the saved medal signature. An already saturated lifetime counter can issue a Present without inventing a
counter increase; actual native signature and, if stock can grow, its full
observed gain are still needed for acknowledgement. A signature-only split save
cannot claim the reward. The saved stock, queued operation, received flags and
server-owned Iris are not prewritten or acknowledged. The transactional
`UserCasinoState` observation write now includes pending Present receipts, so
split saves keep their partial or complete progress across requests. An exact
legacy target under the queued operation signature may now project zero; a
higher counter may prove earlier rewards only inside a strictly increasing
all-v0 ordered prefix ending at its own exact operation signature. Gaps,
saturation, mixed partial captures and foreign signatures refuse.

Original Present2000 unconditionally calls the same casino helper at248d5ec,
even for zero; original bytes `67c8fd97` call23ff788. A zero amount can rewrite
the medal signature. The existing ARM64-only guarded zero-medal adapter now
also redirects this exact Present call to the same isolated stub: zero returns,
positive amounts tail-call the unchanged original helper with its quantity,
signature and return link. The adjacent original instructions and ARMv7 are
unchanged. This source patch is NOT built or installed.

Cold `user_data/confirm` may keep an untouched captured medal quantity positive
or project an actually observed complete gain to zero. It independently omits
saved stamina and captured ordinary-item rows, while preserving original gift
flags, queue, token, signature, amounts and full real native ACK. A partially
applied medal effect refuses instead of guessing a remainder. Captured medals
may accompany distinct ordinary PCs or ExPCs under the source-bound character
recovery above. Iris, uncaptured items, other character combinations and
noncontiguous/saturated/mixed-partial casino gains remain guarded. Deferred isolated cap, zero projection, medal/SP save orders,
early-ACK and both producer orders are written in `test_casino_rewards.cjs`;
the native adapter has a deferred exact-byte/branch-span check in
`test_client_native_patch.py`. None have run; native save, UI and crash-free
acceptance are unknown.

## Captured capped-item cold recovery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

The original Present2000 callback iterates `receivedItems` separately from
received gift flags. Cold confirmation now omits a fully observed capped stock
reward, including Valis, when every item in that flat Present has an original
signed capped-stock or dated-ticket capture. It reuses each receipt's native
inventory, signature, cumulative observation and existing Valis spending-floor
proof; a partially applied item still refuses. A flat Present may also mix
those captured items with original stamina: the retained stamina receipt and
owned SP baseline decide independently whether its item row is still owed.
The queued operation, gift flags and real native save/ACK requirements are not
changed. Uncaptured below-cap items, Iris, units, equipment, costumes,
casino and other mixed Presents remain guarded. Capped-item, both item/SP save
orders and spent-Valis-floor cold cases were added to `test_gift_items.cjs` and
`test_familia_valis.cjs`, but not run; native retry/UI stability is unknown.

Latest SOURCE ONLY / PARTIAL / UNTESTED follow-up:
[ordinary gacha-ticket rewards](gacha-ticket-reward-contract.md) covers first and
owned ordinary-ticket captures and mixed PC/ordinary cold recovery. Native gift
flags/actual ACK remain independent. Dedicated deferred contexts now1599,
NONE RUN; only named earlier constructor/pure-ticket limitations are superseded.

## PC-selector Present capture/recovery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

The existing dated helper now captures fresh first and owned PC-ticket Presents,
not only saturated counters. Original248d470..248d484 forwards full quantity and
actual nonce to item vtable+50; PC gain24d8844 and constructor263a11c/23829a0 are
shared with shop. No native inventory is prewritten. Pure PC gifts may retain
untouched positive quantities and omit fully observed rows while preserving
original gift IDs/claimed-or-deleted flags and real2000 ACK. Incomplete fields
and PC+other-reward mixtures still refuse after partial saves, not fake success.
Same-item producers/payments wait for the captured Present's actual ACK.
Completed PC lifetime reads use existing indexed claim history; no new schema.
152 new deferred cases bring the PC fixture to912; generic PC gift fixtures use
actual nonces. No tests, builds or native changes. See [pc-ticket-contract.md](pc-ticket-contract.md).
This supersedes only the named PC-only cold/first/ordinary capture gaps below;
pure-stamina behavior and other unfinished Present branches remain unchanged.

## Pure-stamina cold recovery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

This supersedes the blanket partial-Present cold refusal only for original
plain stamina gifts: one through100 bound UserGift rows, an original single
aggregated stamina receivedItems row, no other received reward arrays and no
casino grant. Mixed Iris still carries its own receivedItems row and remains
refused after partial saves, as do mixed ordinary/unit/equipment/costume/casino
or special-ticket gifts. Those native effects are not silently omitted.

Read-only original ELF inspection confirms receivedItems at32015e5, the
independent iterator248d2e8..248d52c and stamina call248d3b8/2540e78. The empty
iterator branches out at248d36c; no zero quantity needs to reach the positive
SP adder. Later248daa0..248db28 reads gift IDs independently, skips a missing
local gift at248dae0, and calls2494810 only for a present gift. That setter
passes state1 to265aba4. The original IDs/fields can therefore remain while
an already observed stamina row is omitted. Evidence is recorded in the
ignored `.work/gift-stamina-cold-original-20261010.txt`; no native patch or
native acceptance is claimed.

`giftStaminaRecovery` reuses full original queue/claim/receipt binding and
actual saved claimed/deleted flags. Pure unobserved SP requires the exact
owned native balance plus original guarded earlier XP/SP captures to reach
the retained before-SP target. Observed SP is omitted from the cold reply,
not granted again, rewritten to zero, restored after spending or imposed as
a permanent floor. Original amounts, claim IDs, signature/token and queued
JSON remain unchanged. Existing full original native SP/flag ACK proof still
settles the operation; cold projection alone is not an ACK or observation.
Hot retries after a partial save still refuse; save replies still withhold the
whole partially observed gift. Initial binding validation remains before
feature-specific delivery guards; ordered recovery runs after the guards.

Cold confirmation permits only the exact original or exact derived gift
envelope. Canonical original outgoing entries are shared with normal10200 and
membership28000 recovery, so an observed pure-stamina gift prefix is skipped
only after proving its derived reply omits SP. A following refill/membership
uses real current saved/spent SP, not the old gift target. Existing current
tokens/full-queue cache guards remain intact; no second charge/refund/backfill,
new schema/ledger, native precredit, fabricated gift or master change.

Deferred only:72 NEW test_gift_delivery.cjs contexts cover two SP baselines
including cap crossing, one/two gifts, all three single-gift/all nine two-gift
unclaimed/claimed/deleted flag combinations, and pending/saved/spent SP.
36 low-SP contexts also queue a real original10-Iris10200 purchase, preserving
the original target/order and closing gift then refill through real saves/ACKs.
They assert original/derived bytes after restart, profile/wallet/receipt/queue
preservation, early-ACK refusal, hot/cached refusal, missing captures, altered
envelopes/baselines, no grant renewal, transaction rollback, stale full-queue
refusal and completed claim/replay guards. Existing mixed-Iris refusal cases
remain unchanged. NONE RUN; synthetic gifts/quantity13/funding/rows/signatures/
cap crossing/spending/save order are not native reward provenance or play.
Eight additional NEW test_subscription_bonus.cjs contexts cover trial/regular
membership after observed/spent pure gift SP, with unsaved/first-saved tickets.
Canonical-to-derived whole-queue cold output, no precredit/renewed gift grant,
cache bytes/restart/stale queue and real ordered gift/member save/ACK closure
are WRITTEN ONLY; enrollment/signatures/save order are not native acceptance.

Counts124 partial/51 unsupported unchanged; no route feature-complete, native
crash fix or stability claim. Mixed effects, legacy/coalesced/ambiguous history,
regeneration, partially saved XP, constructors, clock/UI/performance and native
acceptance remain unfinished. No new DDL; earlier DDL UNAPPLIED. Actual saves
and listener untouched; no tests/checks/generators/build/APK/install/restart/
emulator/ADB/workers/Actions. All149 plus variants before acceptance; co-op last.

## Personal and General Bonds — SOURCE ONLY / UNTESTED (2026-10-10)

Original263f970/26415bc use six fields/limitBreakItemId, UInt8 book/full UInt32
signature and no reserved/date/reset fields. Both classes now share ordinary
2000 caps/allowance/spending closure/actual signature/capped lifetime effects/
full mixed ACK/atomic saves/completed guards. Retained malformed general-bond
rows refuse without repair. Deferred additions: seven Personal Bond cap orders
and all nine General Bond IDs times seven orders (63), plus malformed/duplicate
save cases. NONE RUN; synthetic provenance/order/signing is not native proof.
Consumption, absolute lottery/Prism saturation, constructors/coalesced/legacy and
native UI/recovery/performance/stability remain unfinished/unverified.
See personal-bond-item-contract.md and general-bond-item-contract.md. No actual
saves/listener/schema changes; counts125 partial/50 unsupported unchanged.

## Memoria EXP and alarm-voice items — SOURCE ONLY / UNTESTED (2026-10-10)

Strict original eight-field Memoria EXP and seven-field alarm-voice inventory
now use existing capped2000 capture/allowance/spending closure/actual signature/
full mixed ACK/atomic saves/completed-stock guards. Memoria acquisition timestamps
are retained; the original expiry gate excludes that item type.35 all-five-ID
Memoria cap orders and seven alarm-voice cap orders are WRITTEN ONLY / NONE RUN,
with native-field/corruption/rollback/retry/refund-refusal variants. No invented
Presents, native precredit, master/schema/save/listener changes or feature completion.
See [Memoria EXP contract](memoria-exp-item-contract.md) and
[alarm-voice item contract](alarm-voice-item-contract.md) for remaining gaps.

## Adventure Ticket inventory and caps — SOURCE ONLY / UNTESTED (2026-10-09)

Original seven-field Adventure Ticket rows retain lastResetAt, UInt8 book and
full UInt32 signature, with no reservedAmount/dateList. Five non-replenishing
IDs share the existing capped delivery/save guards; four scheduled-reset IDs
remain outside ordinary capped stock semantics pending original140000 reset
and token-order implementation.35 added Present cap orders and four reset-ID
ordinary/refusal cases are WRITTEN ONLY / NONE RUN. No native precredit, schema,
issuer or original master changes. See [Adventure Ticket contract](adventure-ticket-contract.md)
for original fields, weekday slots,112 deferred cases and remaining gaps.
Counts/saves/listener unchanged, previous DDL UNAPPLIED; no acceptance claimed.

## Hero Ascension unlock inventory and caps — SOURCE ONLY / UNTESTED (2026-10-09)

Original2633e00:2634238 seven-field UserHeroSublimateUnlockItem uses
heroSublimateUnlockItemId/reservedAmount, UInt8 book/UInt32 signature.
Domain256bfa4 forwards full signature to26337f8; vtable42c1400 shares ordinary
gain/max/lifetime, original itemType200000034 maximum999999999. Existing strict
row/capture/positive allowance/spending closure/actual-signature observation/
effect replay/full mixed ACK/atomic save/completed stock guards now cover this
twelfth numeric class. No new wire/schema/issuer/native precredit. Wrong Hero
subtype IDs/missing native fields/date-reset fields refuse reconciliation.

Seven new test_gift_items.cjs cap-save orders plus native-width/cross-ID fixture
cases are WRITTEN ONLY / NONE RUN. Synthetic Presents/order are not original
reward provenance or native acceptance. Original98000001 has111 standalone
shop offers/no linked bundles/no final event-box prizes, none invented.
Shared mission/shop and stage/Element fixture fields updated; other producer
caps/classes/constructors/coalesced/legacy/native signing/order/UI/recovery/
performance/stability remain unfinished/unverified. Earlier DDL UNAPPLIED,
saves/listener/counts unchanged, no tests/checks/generators/build/APK/install/
restart/emulator/ADB/workers/Actions, all149 variants before testing/co-op last;
docs/achievement-reward-contract.md.

## Hero Ascension inventory and caps — SOURCE ONLY / UNTESTED (2026-10-09)

Original2631eb0..2632278 reads seven UserHeroSublimateItem fields: userId,
heroSublimateItemId, amount, bookEntryState, reservedAmount, signature and
cumulativeAmount. Stock/cumulative setters2631590/2631944 reject1000000000;
book26316a0 is UInt8, signature2631864 is UInt32. Domain stock setter256d098
keeps w2 and passes nonzero signatures to2631864 at256d0e4; cumulative setter
256d290 calls2631944. Vtable42c15e8 uses ordinary24d8844 gain and24d8d6c
maximum. Constructor256c800 binds literal3578d1a/item_type.hero_sublimate_item
to original itemType200000033 maximum999999999. Its domain book getter256d370
returns1 and setter256d378 is a no-op; no native book update is invented.

Existing original99000001/profile ID mapping is retained. The shared strict
owned-row guard now keeps the exact seven fields/UInt8 book/UInt32 signature;
Hero Ascension joins eleven numeric classes with existing2000/9000 cap capture,
old-signature exclusion, positive allowance, spending closure, partial effects,
full mixed ACK, atomic saves/replies and completed-stock protection. No new wire,
DDL, inventory/signature/flag precredit, issuer or parallel ledger. Other reward
producers' cap branches remain unfinished even though row validation is shared.

WRITTEN ONLY / NONE RUN: seven additional Present cap-save orders; malformed
reserved/book/signature/reset/date/alternate ID and missing reserved fields;
signed overflow, partial/first-save-spent effects, allowance/closure, capture
corruption, strict received flags/ACK, rollback, cold-cache suppression,
completed restoration refusal and next Present. Synthetic Presents/order are
not native provenance/application proof. Original shop catalog contains107
standalone offers and112 linked bundles; final event-box data has no Hero prize.
The shop checklist adds17 original-offer/pack scenarios, retaining authored
quantities/costs/windows/limits/mixed rewards. Mission/stage/Element fixture
constructors now retain native reservedAmount; no fixture is executed.

Earlier DDL UNAPPLIED, saves/listener/counts unchanged, no tests/checks/generators/
build/APK/install/restart/emulator/ADB/workers/Actions. Other types/producers,
constructors/coalesced/legacy/native signing-order-UI-clock-recovery-performance-
stability remain unfinished or unverified. All packets/branches before testing,
co-op last; see shop-reward-contract.md.

## Ability-lock signature correction and caps — SOURCE ONLY / UNTESTED (2026-10-09)

Original UserLockAbilityItem reader27ddb4c sends bookEntryState to289c464
at27dde3c, but signature to289c548 at27ddecc. The former uses protected
UInt8 setter28bda24; the latter uses protected UInt32 setter28bac48 and
getter1e99d08. Domain stock setter25d7d10 forwards the entire incoming w2
signature through25d7d5c, skipping only zero. These observations supersede
older byte-signature/book0..3 claims, including the historical Seventh Zone
catalog note. The existing issuer is unchanged: no byte mask or new nonce policy.

Strict owned seven-field rows retain lockAbilityId, reservedAmount, book0..255
and signature0..4294967295. Original constructor25d7798 binds literal
item_type.lock_ability_item to itemType200000041, maximum999999999; vtable
42c4360 uses ordinary24d8844 gain. UserLockAbilityItem now joins the existing
ten-class numeric cap path. Actual before stock/lifetime/full signature,
positive-addition allowance, spending closure, partial effects, full mixed
received-flag ACK, atomic save/reply and completed stock guards are reused.
No new wire field, DDL, native stock/signature/flag precredit or parallel ledger.

WRITTEN ONLY / NONE RUN: test_gift_items.cjs adds seven lock cap-save orders,
six full-width signature scenarios and three mixed lock/CP orders (16 cases).
Include0xff to0x100 issuance, UInt32 old signatures, book4/255, low-byte
truncation refusal, capture corruption, issue/save/ACK rollback, split first
saves, allowance/closure, cold/cache suppression, exact ACK replay and
completed stock restoration refusal. Synthetic Presents/order are not native
reward provenance or callback proof. Original one item220000001 has no shop
offers, packs or final event-box prizes; none were invented.

Other producer/type caps, constructors/coalesced/legacy and native signing/
order/UI/clock/recovery/performance/stability remain unfinished or unverified.
Earlier DDL remains UNAPPLIED; real saves/listener/counts unchanged. No tests,
checks, generators, builds, APK/install/restarts, emulator/ADB, workers or
Actions; all packets/branches before testing, co-op last.

## Equipment-material native IDs and caps — SOURCE ONLY / UNTESTED (2026-10-09)

Original27d52dc/27d57b0 use enhanceItemId/evolveItemId and seven-field owned
numeric rows with reservedAmount, protected UInt8 book and UInt32 signature,
not a date/reset field. Corrected all three enhancement/five evolution master
profiles, decoder and shared primary-ID/row validation without rewriting actual
saves or old synthetic long-ID receipts. Literal original constructor itemType
keys bind999999999 stock caps and ordinary24d8844 gain. Both classes now share
the existing numeric2000/9000 capture/allowance/signature/effect/full-ACK/atomic
save/completed-stock guards; no new native grant or parallel ledger.

WRITTEN ONLY / NONE RUN: test_gift_items.cjs extends capped numeric fixtures with
all eight IDs/seven orders (56 cases), exact native reserved/book/signature/ID
fields, UInt8 book255, unknown/extra/reset/date/old-ID refusal, rollback, split
and first-save-spent gains, allowance/spending/closure, cold/cache recovery,
completed restore refusal and next Present. Generic absent/owned fixtures and
deferred mission/stage constructors retain native fields. Synthetic Presents
and funding are not original reward provenance or native callback proof.

No tests/checks/generators/build/APK/install/restart/emulator/ADB/workers/Actions;
earlier DDL remains UNAPPLIED, saves untouched, route counts unchanged. Other
producer/type cap branches, constructors/coalesced/legacy/native signing/order/
UI/clock/recovery/performance/stability remain unfinished or unverified. See
shop-reward-contract.md for the original670 standalone offers/seven packs and
shared source evidence. All packets/branches before testing, co-op last.

## Shared dated shop capture follow-up — SOURCE ONLY / UNTESTED

The existing capped Present dated capture/effect code now also serves original
9000 shop ticket gains. Its gift policy/exact fields/multiset allowance/actual
signature observation/pruning and received-flag/full mixed ACK requirements
remain; the shared function keeps validation/error handling. Both receipt types
permit exactly one numeric or dated capture. The shared full-row lottery issuer
now protects completed shop dated inventory alongside Present/event-box stock;
pending capped shop/Present gains and same-item lottery replacements retain their
required ACK order. New nullable shop gacha_state DDL SOURCE ONLY / UNAPPLIED;
existing gift schema/policies unchanged, saves untouched, all cases deferred.
Native earning/signing/order/UI/recovery/stability still unverified; see
docs/shop-reward-contract.md. This is not new Present/native acceptance.

## Shared shop numeric capture follow-up — SOURCE ONLY / UNTESTED

Existing Present numeric stock/allowance and Valis-credit validators now also
serve9000 shop captures. Present policies/exact fields/signature proof/original
quantity/allowance closure/hash-bound credit/received-flag/full mixed ACK remain;
dated Present logic is unchanged. This refactor is not native acceptance.
The shared Familia floor admits permanent observed shop sources and retains a
v3 backup plus any v1/v2 backups for known old schemas. New columns/indexes/
migration are SOURCE ONLY / UNAPPLIED, actual saves untouched. All gift cases
and new shop/Valis/schema cases remain deferred; docs/shop-reward-contract.md.

## 2026-10-09 capped Valis presents and completed stock — SOURCE ONLY / UNTESTED

The capped2000 path now includes original Valis205000002. Original248d47c
forwards the actual signature with the quantity;257c9e4 retains it through the
stock setter and25fdd48. Stock maximum2000000000 remains separate from lifetime
maximum999999999, with both signed additions checked before native clamping.
This supersedes only the Valis exclusion in the numeric milestone below.

After a real Familia charge, a capped gain can increase spendable Valis without
an equal lifetime increase. The private receipt binds actual before stock and
cumulative, original quantity, native-clamped targets, previous spending ceiling
and that difference as credit. Its hash is bound into the versioned stock
capture. Actual saved issued signature and capped cumulative earn the credit
once; received flags alone do not. Full-stock zero gains and grants without a
historical charge cannot manufacture a spending-credit source.

The credit updates the existing owner-keyed Familia spending floor in the same
transaction as profile/token, receipt observations, real queue/ACK and exact
reply. The retained Present receipt validates that floor after ACK. Later
donations still lower it, and earlier gift credit cannot refund them. Pending
Familia creation/donation charges settle before capturing the gain; those
issuers already require the real pending queue settled in the reverse order.
Coalesced unsaved charges/gains are not guessed.

Nullable valis_state, default-zero valis_seen and partial receipt indexes are
SOURCE ONLY / UNAPPLIED. The existing floor schema accepts the new present
source only through the two exactly known older schemas. Its transactional
copy keeps the v2 backup and any older v1 backup. Unknown schemas, references,
custom indexes/triggers or a conflicting backup refuse migration without
discarding data. No actual player save was opened or migrated.

Completed numeric caps now share the dated-stock checkpoint against the actual
durable primary profile. Existing indexed completed reward seeks cover all six
ordinary receipt producers; this does not implement their missing capped gain
branches. A saved spent balance cannot be increased just because its lifetime
counter remains999999999 or its signature changes. New captured2000 or15000
rewards must validate their own remaining addition allowance first. Genuine
spending and subsequent separately captured grants retain their normal paths.
No second inventory ledger or historical stock backfill is introduced.

Deferred sources add12 Valis/Familia order scenarios, four no-charge cap cases,
schema-transition/corruption/backup-preservation cases and seven-class completed
restore/next-grant cases. They retain issue/profile/credit/ACK/reply rollback,
restart, real received flags and later actual donation checks. The later donation
fixture now reads its actual latest saved signature. These are synthetic source
fixtures, WRITTEN ONLY / NONE RUN, not publisher gift eligibility or native proof.
Latest audit/checklist metadata is manually edited; generators were NOT RUN.

Other capped producers, absent-row constructors, mixed gain/spend attribution,
unknown legacy history and native callback/signing/order/clock/UI/cold recovery/
performance/stability remain unfinished or unverified. All149 packets/branches
must be implemented before testing; co-op stays last. No tests/checks/build/APK/
install/listener restart/emulator/ADB/workers/Actions accompanied these changes.

## 2026-10-09 ordinary capped stock presents — SOURCE ONLY / UNTESTED

The captured capped2000 path now also covers the seven original numeric types
already bound by the [numeric event-box contract](event-box-contract.md): Falna
(`UserStatusBoardItem`), CP items, EXP items, equipment materials, voting items,
stamina tickets and keys. This supersedes earlier cap refusals only for those
existing owned rows. Valis was outside this milestone; its separate Familia
spending-credit integration is described in the newer section above.

Original2000 `248d478:248d484` dispatches the original quantity and actual
issued signature to the resolved item's slot50. The seven class vtables bind
ordinary `24d8844` gain, authored stock maximum `24d8d6c` and lifetime gain
`24d8d94`; original maxima are999999999. Their stock setters forward the nonzero
signature even when numeric stock is full. Read-only original CP/EXP/material
setter inspections at23ddebc/243955c/2516a14 retain that signature forwarding.
No publisher response or native runtime acceptance is inferred.

New private `gift_item_claim.stock_state` retains the actual before stock,
cumulative and UInt32 signature, native-clamped stock target, original-quantity
addition allowance, distinct issued signature and actual effect/reward
observations. `cap_version=1` selects exactly one stock or dated capture;
ordinary legacy rows remain version0. This is an additive nullable-column
source migration only, **UNAPPLIED**. No native item/flag/signature is prewritten.

The original lifetime addition at24d8dbc is signed int32 before its clamp.
Both stock and lifetime sums must fit that range; this also corrects the dated
Present branch's lifetime-sum guard. A wrapping addition is rejected rather
than represented as a successful capped grant. Exact-cap, crossing-cap and
already-capped native targets preserve the complete original wire quantity.

An unchanged capped counter alone cannot suppress the first callback or ACK.
Actual saved stock/cumulative/signature changes suppress additive replay;
ACK requires the genuine issued signature and capped cumulative, plus every
mixed reward and received/deleted gift flag. Actual signature proof works even
if stock was spent before its first save, closes further additions, and remains
recorded through subsequent legitimate spending/signature changes. Positive
stock additions are bounded across partial saves by the original grant;
spending never refunds that allowance. Private updates compare the previous
capture and share the existing native profile/token/receipt/queue/done/exact
reply transaction. Same-item additive producers must settle before capture.

Missing, malformed, wrong-class, overlapping stock/date or downgraded cap
captures retain the real queue and require reconciliation. Legacy capped
receipts cannot invent before stock or signatures. Completed cumulative floors
remain intact; this does not claim a completed numeric stock-restoration ledger
for all reward producers after ACK.

Deferred `test_gift_items.cjs` sources add49 seven-class scenarios: exact/crossing/
saturated lifetime, empty/nearly-full/full stock, singular/plural and unchanged
quantities, UInt32/collision/wrap, flags/stock/signature/cumulative-first/combined
saves, first-save spending, persistent allowance after spending, malformed/
missing/downgraded/mixed captures, native field ownership/widths, signed-addition
overflow, profile/capture/ACK/reply rollback, restart/cached replay suppression,
next actual grant and completed acquisition rewind/removal refusal. The generic
fixture now includes native reserved fields for voting/stamina rows. All cases
are synthetic source fixtures, **WRITTEN ONLY / NONE RUN**, not natural gift
provenance, native earning/signing/order or UI acceptance.

The newer section supersedes this milestone's Valis integration and shared
numeric restoration gaps only. Other capped classes/producers, absent-row
constructor evidence, coalesced attribution and lost legacy history remain. Native clock/UI,
cold recovery, performance and no-crash/no-freeze acceptance remain deferred.
No tests/checks/generators/build/APK/install/restart/emulator/ADB/workers/Actions;
existing saves and listener untouched, counts unchanged, all149 packet branches
before testing, co-op last.

## 2026-10-09 capped gacha-ticket presents — SOURCE ONLY / UNTESTED

This supersedes the ordinary lifetime-overflow refusal only for existing owned
`UserGachaTicket` rows with a captured original dated/signature baseline. All
new cases below are written only. No tests, acceptance checks, generator,
build, installation, listener restart or emulator/ADB operation was performed.
New private receipt-column DDL is **SOURCE ONLY / UNAPPLIED**; existing saves
have not been opened or migrated.

Read-only inspection of original ARM64 `248cbb8:248e09c` confirms that
`248cbf8` retains the incoming signature in `w3`, `248d47c` loads it into `w2`,
and `248d480:248d484` calls the item's `+0x50` positive-gain method with the
original quantity. `248d490:248d498` then reads lifetime acquisition via `+0xa0`.
The existing [original dated-ticket contract](event-box-contract.md) identifies
the six-field serializer, lifetime clamp, append/prune setter and signature
write after that setter. Old capped lifetime numbers do not prove application.

Fresh gifts that reach or cross lifetime999999999 capture actual before dates,
cumulative and UInt32 signature in private `gift_item_claim.gacha_state`, with
`cap_version=1`. Original positive-int32 quantities and wire2000 are unchanged;
only the private target follows the native lifetime clamp. The shared issuer
excludes every captured old signature, including collision/wrap cases. It never
precredits native inventory, dates, signatures, received flags or acknowledgements.

Private date-addition allowance is bounded by the original aggregated quantity
across every partial save. Duplicate dates are quantities, not a set. Pruning
does not refund used allowance. Expiry pruning alone leaves the unapplied
callback deliverable; a saved addition, cumulative rise or signature change
suppresses additive redelivery without discarding the real queue. The actual
issued signature plus capped cumulative records reward proof, including a
first save where all gained dates have already expired. That proof closes the
remaining date allowance and survives later pruning or signature changes.

The existing save/reply transaction writes the profile, token, date allowance,
effect and reward observations, queue/done state and exact response atomically.
Private updates compare the previous capture, operation and item identity.
ACK still requires every mixed reward and actual received/deleted gift flag;
an old capped counter, dates alone or received flags cannot manufacture the
ticket callback. Missing, malformed, downgraded or behind-current-profile
captures retain queue/history and require reconciliation. Legacy capped gifts
do not get a guessed date allowance or before signature.

Completed gift and event-box cap receipts now share the actual durable primary
dated inventory as their stock checkpoint, including the common lottery
full-row issuer. Spent/expired dates cannot be restored without a separately
validated pending original grant. Pending capped gifts and same-item lottery
replacements must acknowledge before the other can issue; shared reservations
also keep competing same-item additive producers ordered.

Deferred `test_gift_items.cjs` sources cover normal and character_3 original
ticket IDs, exact/crossing/saturated targets, singular/plural delivery, quantity
aggregation, signed book bytes/UInt32 signatures, signature collision/wrap,
flags/date/signature-first and combined saves, duplicate/empty/expired dates,
allowance corruption/refund, malformed native rows, issue/profile/capture/ACK/
reply rollback, restart/cached suppression, next capped grant, completed stock
restoration/shared issuer refusal and original consumer-first lottery exclusion.
These are synthetic present/funding/time/order fixtures, not natural earning,
native callback/save-order acceptance or publisher behavior proof. **NONE RUN.**

Other capped present classes/producers, uncaptured absent-item constructors,
coalesced gain/spend attribution, lost legacy private history and native
signing, clock/UI, cold recovery, performance and no-crash/no-freeze acceptance
remain unfinished or unverified. This is partial implementation, not a fully
playable Present feature. All original packets/branches precede consolidated
testing; co-op remains last, no workers or GitHub Actions.

## 2026-10-07 hot2000 delivery — partially supported

The original bounded `gift/receive` wrapper `248c418:248c8a8` calls
`209b70c` at `248c624`. The common hot transport `209bd48` reads a singular
`operation`, before the Present callback. Its previously plural-only response
could show reward information without applying the queued2000 grant.

Shared delivery now adds the **same signed2000 object** as `operation` for a
single fresh, pending or old cached claim. The plural queue and root popup fields,
including `issueCasinoMedal`, remain unchanged. Observed split-save suppression
removes both delivery forms; it does not discard the queued grant or waive its
complete reward/received-flag ACK. No schema, native inventory, signatures,
funding, save flags or legacy baselines were fabricated.

Twelve full disposable checks passed on this revision: `test_gifts`,
`test_gift_delivery`, `test_gift_items`, `test_gift_characters`, `test_shop`,
`test_memoria_rewards`, `test_achievement_items`, `test_stage_persistence`,
`test_native_board_checkpoint`, `test_gacha_persistence`,
`test_communication_wardrobe` and `test_launcher_lifecycle` (all `.cjs`).
The missing hot alias first failed its regression, then passed. Interrupted
delivery covers eight reward kinds in both save orders; ordinary inventory
covers24 classes, mission interleavings, restart, once-only acquisition and
transaction rollback. Fixture corrections distinguish semantic cancellation503
from invalid-request400 and empty SQLite-failure503, use binary MessagePack pulls,
and actually omit initial character captures when testing a missing constructor.
Production validation remains intact. Earlier unexplained exit1 attempts are
not passes; these are later completed runs, not broad process-stability proof.

Local offline Gradle build and replacement installation succeeded. APK SHA-256:
`81a4c72a5bfc1907bbb5483e4ed34192dc23c54333f0eda46aebbd1f7fdeb8d7`;
server SHA-256:
`72d5ab4d17dff1fda1664185ed70748b694b78f09d4732c2a9573a1bd484c75d`.
All seven packaged/runtime modules match source, and the pulled installed APK
matches the local build. Adventure16 (`eb8b83ee`,2019-10-18) reached town via
normal login/confirm/WorldInitState/AreaChanged; native UserGift pulls21152/21153
returned an empty Present list. Opening it and closing back to usable town was
observed, **not an actual gift claim or native2000 application**. Rank3/SP59,
Iris0/Valis31020 remained displayed. No artificial Present was inserted.

Normal Tools Stop removed the game PID and listener28766. Adventure5/date2022-08-20
was restored only as next-launch metadata, Offline/19 profiles/shell uid2000;
its database was never opened or launched. No workers or GitHub Actions.
Natural Present provenance, native claim/signatures/save order/recovery and full
gameplay remain pending. Mixed shop1000/6000+9000 delivery is still an open gap;
the client reads a singular hot operation, so a source-only plural response is
not full native support. Co-op remains last.

## Historical implementation status

The current section supersedes the following NOT RUN notes only for its named
checks. Other tests and native reward acceptance remain deferred.

New ordinary-item persistence is source-only: **NOT RUN, built, installed or
accepted in MuMu**. Deferred checks are `node tools/test_gift_items.cjs`, the
updated `node tools/test_gifts.cjs`, and mission/box/shop/PVE/character-present,
casino, explorer/recovery and general server regressions. New stamina receipts
also have deferred `node tools/test_stamina_rewards.cjs` and fixed-consume
regressions. Character presents now also have deferred
`node tools/test_gift_characters.cjs`, updated master-data checks and
gacha/unit/panel/save-recovery regressions. Equipment delivery also has deferred
`node tools/test_equipment_rewards.cjs` plus updated master/shop/gift checks.
Costume and linked-voice delivery has deferred
`node tools/test_costume_rewards.cjs` and the shared shop/save regressions.
The real player save
is untouched. Earlier Iris/popup recovery evidence is not acceptance of these
new inventory guards.

Dispatch level-up SP now shares the same pending gift/mission/refill reservation
and observation path, with its own XP-coupled receipt. Per-level sums, cap and
legacy migration semantics are described in
[dispatch receipts](friendship-reward-contract.md); the added cross-producer
fixtures are deferred, not native SP attribution or refill-total proof.

## Original client contract

Original15.1.0 ARM64 SHA-256:
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
Addresses are raw, without Ghidra's`0x100000` image bias.

`gift/receive` consumes owned `userId` and distinct positive `giftIds`, at most100
per existing request. UserGift is a flat record, not a nested Another Eden gift.
Original operation2000 (`248cbb8:248e09c`) applies received items separately from
the received/deleted gift flag. Its receivedItems loop:

- Reads int32 itemId and amount.
- Handles stamina205000005 through PlayerStamina (`2540e78`), not a fabricated
  ordinary currency acquisition. Its exact eight-byte function loads the normal
  stamina object and tail-calls `2548998`, which requires a positive int32 amount
  and delegates to `25488e0`. The latter adds to normal SP and saturates at
  2147483647. Mission operation6000 at`2361db4` parses `issueStamina` and calls
  the same `2540e78` only for positive amounts; the archive has two type10
  missions, each50 SP, with their original2018 windows retained.
- Resolves other items through `DomainItemRepository` (`24e3a5c`), reads cumulative
  acquisition at vtable`0xa0`, calls gain`0x50`, and reads the resulting acquisition
  again. Generic gain is`24d8844`; cumulative gain`24d8d94` caps at999999999.

The six additional item classes inspected in this pass (PC/subscription tickets,
Outfit Refinement/vote/event/general-limit-break items) have that same gain and
cumulative-gain dispatch with real class-specific cumulative getters/setters.
Adventure tickets also have a real saved cumulative counter. The twenty-three
exported ordinary item-profile tables use their own original ID fields; gacha
tickets have an acquisition `dateList`, not an invented ordinary amount field.
This common item grant does **not** implement a retired publisher subscription
service merely because subscription-ticket inventory can be received.

Callback180c9ac and popup180a668 still require root reward fields, including the
mandatory numeric issueCasinoMedal. The signed2000 operation and popup envelope
are unchanged by adding server receipt storage.

Under Telskyura passes now use that same2000 item resolver but **not** ordinary
cumulative-item proof. All54 original IDs have a six-field saved row; the
pass cumulative getter/setter are no-ops. Source-only private quantity captures,
split native observations, gift flags before ACK, grant/spend stock pointers and
additive-redelivery cancellation are described in
[pass-present receipts](under-pvp-contract.md#pass-earning-from-flat-presents--source-only).
`test_under_pvp_pass_rewards.cjs` is deferred, NOT RUN. This supersedes the
flat-pass-present acquisition gap, not original natural earning/eligibility,
shop/mission/prize producers, expiry cleanup or native acceptance.

## Implemented ordinary-item save contract

- `gift_item_claim` permanently records operation, original item/quantity,
  corresponding native table/ID field and required lifetime acquisition target.
  Its operation/item primary key and item/table acquisition indexes support
  receipt lookup and shared reservations.
- A new claim aggregates repeated item entries, validates owned/unique existing
  inventory (or a truly absent item), and reserves a distinct acquisition target
  alongside already recorded mission, PVE/Element, box, shop, Familia and
  character-present awards. It never pre-publishes native inventory or item
  signatures. Existing Iris credit, casino receipt, gift IDs, item receipts,
  operation, sequence and exact reply share the current transaction.
- ACK requires every ordinary item receipt and its native saved cumulative
  acquisition, in addition to received/deleted gift flags. Missing, duplicate,
  foreign, malformed or stale inventory cannot discard a queued award. Save and
  ACK can be split across requests/restarts; current amounts can subsequently
  be spent, but completed lifetime acquisition cannot be removed or rewound.
- Fresh/pending and exact cached gift replies validate their actual issued item
  quantities and original table mappings. Receipt history survives ACK, reply
  cache eviction, sessions, restart and gift expiry. Unknown historical baselines
  are not guessed from received flags or from inventory saved after the fact.
- Shared reservation also detects an overlapping old gift with missing or
  inconsistent ordinary receipts. A later gift/mission/box/shop cannot reuse the
  same unproven acquisition. Explicit unavailable history cancels3000999 with
  queue/history intact; input errors and unexpected database failures remain
  genuine failures.
- Outside the captured existing gacha-ticket branch above, an acquisition that
  would exceed999999999 is rejected rather than queuing an impossible receipt
  or silently truncating the original quantity. Other original spendable-item
  caps and overflow UI still require implementation and the later native batch.

Deferred probes include all23 profile tables with present/absent inventory,
aggregate quantities, owner/type/dateList validation, flags-only rejection,
spending versus completed rewind/deletion, split saves, cache/session/restart,
expiry, two real original mission/gift issue orders, two same-item gifts,
missing/corrupt history preservation and receipt/reply/ACK rollback. Those are
synthetic protocol/save fixtures, **not native gameplay or publisher parity**.

## Shared interrupted Present delivery — source only

This follow-up closes the ordinary2000 retry gap: earlier special ranking and
Under-ticket guards did not cover every ordinary Present. Original operation
`248cbb8:248e09c` applies ordinary gain/cumulative effects separately from the
`2494810` received-state call. The unchanged frozen ARM64 hash was rechecked;
the read-only extraction is `.work/gift-ordinary-operation-exact-20261004.txt`.

The shared delivery/save guard now validates the exact still-queued operation,
token, signature, parameters and permanent `gift_claim` ID binding. It reuses
the existing item acquisition, stamina observation, equipment-piece, casino
acquisition and new-costume receipts, plus actual received/deleted Present
flags. No new observation table or fabricated native effect was added.

After one of those effects has saved, a save response omits only the additive
delivery. The queue remains intact until the existing full reward/flag ACK
proof passes. Fresh/cached claim retries and cold login/pull/confirm cancel
with3000999 instead of granting again. Restoring a pending claimed/deleted gift
to unclaimed, changing its original fields or rewinding an observed ordinary,
casino or new-costume acquisition fails without changing state. Changed Gift
IDs use indexed claim/done lookups to prohibit completed unclaimed or foreign
owner restoration; no lifetime Present history scan is introduced. Existing
SP observation permits subsequent spending, and recorded gear may still be sold.

Cached binary downloads touching Presents or their reward providers must match
the current saved snapshot. Completed cached claims cannot resend2000. Missing
or incompatible pending receipts retain queue/history and require reconciliation;
neither a saved flag nor a later balance manufactures an old baseline.

`node tools/test_gift_delivery.cjs` and updated gifts/item/character/equipment/
stamina scripts are **DEFERRED, NOT RUN**. The updated disposable check covers both
split orders across ordinary/SP/casino/gear/costume/unit/board rewards with mixed Iris,
retained queues, hot/cached/cold cancellation, spending/sales, missing voice ACK
proof, flag/source edits, obsolete pulls and profile/ACK/reply rollback. Repeat
earned ranking, Under tickets, explorer, shared award sources and recovery checks.
The current PC/board extension is described below. Linked-voice-only checkpoints
are now implemented by the shared costume receipt, with their deferred checks
and remaining limits in [the costume contract](costume-reward-contract.md).
Original provenance, native signatures/verifiers, actual
effect/save/ACK order, expiry/caps/legacy recovery, back/navigation and no-ANR
acceptance remain open. The actual player save/listener/APK/emulator is untouched.

## Implemented stamina save contract — acceptance pending

`stamina_reward_claim` stores the operation, unchanged original amount, reserved
normal-SP baseline/minimum and an observed-save bit. It is keyed by operation:
normal-SP checks walk only the existing bounded pending queue with primary-key
receipt lookups, not lifetime reward history. Gift quantity aggregation, receipt,
claim IDs, existing Iris/casino/ordinary rewards, operation and reply use the same
transaction. Mission SP uses the same receipt, alongside its existing claims and
other rewards. Neither path pre-credits `UserInfo`, `UserCurrency` or signatures.

Unobserved gift/mission SP and normal Iris-refill10200 targets are reserved
together. Each recorded reward requires its separate saved SP minimum; received
gift/deleted gift or mission-state4 flags alone cannot settle it. A proposed or
previous saved owned `UserInfo.playerStatus.baseSP` supplies the observation.
Saving before ACK records the bit atomically with the profile; after restart,
later spending is valid. Observed-but-unacknowledged and completed rewards do
not impose a permanent SP floor or reserve their already-spent SP again.

Pending and cached gift/mission callbacks validate the issued amount against
the retained receipt. Missing/changed historical receipt, unknown pending
baseline or invalid quantity cancels3000999 without clearing queue/history;
no baseline is manufactured from flags or post-award inventory. Unexpected
SQLite failures still remain genuine failures. Native int32 saturation keeps
the original reward quantity; rejecting another unobservable addition at a
stored/reserved full cap is an explicit offline safety policy.

The new deferred probe covers both original50-SP missions, aggregated presents,
expiry/replay, all six gift/mission/Iris issue orders, flags-only rejection,
distinct observed-save targets, split save/restart/later spending, observed
pending rewards not reserving twice, owned/malformed/deleted saves, int32/full
caps, missing/corrupt legacy and cached receipts, and issue/profile/observation/
ACK/reply rollback. The mixed gift probe now requires SP in addition to ordinary
inventory and casino medals. These scripts are **NOT RUN or deployed**.

## Implemented character present contract — acceptance pending

The same original2000 function has two distinct character branches, neither of
which is a gacha draw:

- `receivedPCs` is an array of int32 original PC IDs. The client looks up each
  unit and adds it through `22ebbbc:22ec100` only when absent. An already owned
  unit does not become a bond or get reset.
- `receivedExPCs` contains exactly `{pcId, pcLimitBreakCount,
  pcHeroSublimateCount}`. Native progress uses max(existing, requested), not
  additive upgrades. `22e1ab8:22e2148` applies limit-break upgrades; the original
  constant and saved setter`26147d4` cap them at5. Positive applicable upgrades
  raise normal rank and open normal boards. Extra-board panels are permitted
  only through index`limitbreakCount*5` (`22cc588:22cc618`).
- Ascension helper`22e2148:22e2610` checks original PC metadata slot90. Its
  constant and saved setter`2614c84` cap progress at6. For an eligible ExPC it
  also unlocks ascension and opens normal boards when the requested ascension
  count is0. The original decoder now exports the421 nonzero ascension groups;
  those values are not inferred from unit names or stars.
- Opening a panel ORs its index bit and`0x2000000` (`22cd338:22cd390`). Ordinary
  initialization`22dba90:22dbf38` creates an owned UserPCJobSet, while
  `2604e34:2604fb8` clears its existing job list. Normal rank
  `22da144:22da418` does not itself open every board. Consequently an ordinary
  new-unit receipt does not invent unopened job rows or masks. Existing unit
  progress and actual saved job bits are retained; upgraded receipts explicitly
  require their traced normal and permitted limit-break board bits.

`gift_pc_claim` permanently binds each operation/PC to its exact nonadditive
reward and saved-progress minimum. Both wire arrays retain their original
entries, while repeated same-unit rewards share their native maximum semantics.
`gift_pc_floor` materializes completed maximum progress and accumulated required
board bits by PC primary key. Normal profile saves do not scan lifetime receipt
history. Issuing a mixed PC/Iris/item/SP/casino gift commits all receipts, claim
IDs, queue and exact reply together, without pre-publishing native PCs, boards,
signatures or duplicate bonds.

ACK requires a unique owned joined UserPC and owned UserPCJobSet, their required
progress/board bits, and received/deleted gift flags. An ordinary lazy job set
may be empty; it cannot be missing or foreign. Flag-only acknowledgement of a
new unit fails. Already-owned units may satisfy their captured minimum without
a second grant. Split character/board/flag saves survive restart. Completed
ownership, upgrades and captured board bits cannot later be deleted or rewound;
later additional EXP/progress is allowed. Receipt, floor, profile, ACK and reply
updates use the existing transaction. Pending/cached callbacks verify their
issued reward and retained target; unknown/mismatched history cancels3000999
without discarding the queue or manufacturing a baseline.

### Current interrupted PC/board delivery extension

This extension is **SOURCE ONLY / NOT RUN**, superseding the earlier PC/board-only checkpoint gap, not the remaining native initialization/acceptance limits. The original binary SHA256 remains `e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`; its hash and unwind boundaries were rechecked without running a client or server. Exact2000 `248cbb8:248e09c`, initializer `22ebbbc:22ec100`, owned-job-set initialization `22dba90:22dbf38`, rank `22da144:22da418`, LB `22e1ab8:22e2148` and ascension `22e2148:22e2610` support the existing normal/ExPC distinction. The complete2000 artifact and initializer/rank artifacts were inspected; no failed extraction was used.

Fresh `gift_pc_claim.before_targets` captures `{isFirst,target}` from actual ownership and pre-upgrade EXP/rank/LB/ascension/unlock/board bits. Its nullable additive migration leaves legacy unknown baselines unknown; it never fills them from a post-award save. New-unit zero/lazy minima are proof bounds, not pre-published native default fields. Existing `gift_pc_claim.observed` records separate new unit, new owned job set and completed unit/board upgrade halves. Unchanged preowned ordinary/maxed gifts do not count as new effects or block their unobserved retry.

The shared `pcRewardEffects` and owned unit/board validators enforce the baseline while pending. New upgraded units may save ordinary initialization before their final upgrades; preowned upgrades may save either completed half first. Those observations suppress2000 delivery only in push responses, retaining its genuine queue and every mixed reward/flag/upgrade ACK requirement. Hot/cached/cold callbacks cancel3000999 until the missing saves and actual ACK arrive. Observed ownership, board presence and completed upgrade halves cannot be deleted or rewound; preowned captured progress must remain intact even before an effect is observed.

Only changed observation rows update through `(operation_id,pc_id)`; flags/profiles/PC observations/queue/done/floor/sequence/reply remain in the same transaction. Gift batches read each full PC/job-set profile once for fresh target capture and once per pending operation's observation calculation, rather than once per PC/half. No new lifetime ledger or native PC/board/signature/flag credit is introduced. The existing completed `gift_pc_floor` and stale binary pull guards are unchanged. This is source-level query design, not a latency measurement.

Malformed/missing baseline or observation history retains the queue and cancels instead of inventing prior ownership. Reconciliation of legacy missing captures remains open. The checkpoint marks original initialization or a **completed** upgrade half; finer in-flight upgrade mutations, native communication-character/stat/skill effects, signatures and exact effect/save ordering still need proof. Linked-voice-only observations now use the shared costume handler described in [the costume contract](costume-reward-contract.md); its new checks are also NOT RUN. No usable recovery, no-crash/no-ANR or fully playable Present feature is claimed.

The deferred character probe covers the1364 named original catalog IDs as
metadata targets, not proof that every catalog row was an obtainable player
unit. It includes ordinary and upgraded5/6 cases,421-group eligibility metadata,
preowned maxima/lazy/zero/unsigned masks, mixed rewards, no pre-credit or bonds,
split save/restart, expiry/replay, malformed ownership, missing/corrupt receipts,
completed rewind/deletion and issue/save/ACK rollback. Its current extension adds original before-targets, missing legacy/malformed observation queues, unobserved preowned retries, new upgraded-unit initialization and preowned unit-first/board-first upgrades with observation rollback and cold restart. Updated `test_gift_delivery.cjs` covers unit-only and board-only saves before claim flags, neither proof pre-credited, both save orders, hot/cache/cold suppression, stale pulls, pending deletion and ACK rollback. Repeat stage/gacha/mission/ability-board/save/recovery/Android/launcher regressions because the minimum helper is shared. These probes are **NOT
RUN**, and no APK or emulator save was changed.

## Equipment presents — source implementation, acceptance pending

Native2000 reads `{equipmentId,amount}` with a long equipment/preset ID and
creates individual slot-keyed pieces. All332 equipment definitions and67 original
presets are now exported. Present and shop delivery share permanent observed
piece receipts and an indexed permanent piece-to-operation binding, not stackable
inventory counts.
Saved copies merge by native `slotIndex`, preserving duplicates. Ownership,
original performance/rarity/ability effects and distinct new pieces are required
before ACK; split observations survive restart and later legitimate sales.
Missing history preserves the queue and cancels3000999. Source/probes are
**NOT RUN or deployed**. See [the equipment reward
contract](equipment-reward-contract.md) for exact native traces, supported gift
encoding, capacity, timestamp/other-producer limits and the deferred batch.

## Costume presents — source implementation, acceptance pending

Native2000 takes integer costume IDs and grants a new unlock, not stackable
quantity or a playable character. The decoder now exports394 original costume
definitions and3354 communication voices, including42 costume-linked rows.
Presents and shop use shared permanent receipts and indexed settled unlock
floors. Both saved costumes and their newly linked voices must exist before
ACK; split saves/restart, native locally created userId0, existing state2/3 and
idempotent duplicate unlocks retain the original helper behavior. Missing
history preserves the queue and cancels3000999. No native ownership/signature
is pre-credited. Source/probes are **NOT RUN or deployed**. See [the costume
reward contract](costume-reward-contract.md) for exact native evidence, scoped
gift encoding, owner0 semantics and the deferred batch. This is not native
wardrobe, voice-gallery or outfit-selection acceptance.

## Remaining work

Iris and casino keep their existing dedicated wallet/medal contracts. Stamina
uses the separate native SP contract above, never an ordinary UserCurrency
award. Native effect/save/ACK order, displayed totals, regeneration, stamina
ticket use, player-level changes and uncaptured producers still require evidence.
An observed SP balance is not independent proof of which native event increased
it. Ordinary and upgraded PC presents have the source implementation above,
not native acceptance. PC quantities other than1 remain explicitly unavailable;
no duplicate reward is guessed. Native EXP, derived stats/HP, skills,
communication-character effects, hot/cold initialization, signatures,
popup/save/ACK ordering and cross-gacha/mission/stage unit interleavings remain
unverified. Equipment presents use the separate source-only contract above;
arbitrary gift customization, unsupported costume encodings/quantities, raid
and Lotto presents remain unavailable. Costume/linked-voice delivery uses the
source-only contract above; native wardrobe/audio/other-producer acceptance is
pending. Native equipment gameplay still requires implementation/evidence.
Memoria levels, gift provenance,
original expiry cleanup, item caps and uncaptured award-source interleavings
also need implementation or further evidence.

Native hot/cold item application, received flags, popup/delta/ACK order, gacha
ticket expiry, item signatures, natural progression and recovery without a
restart remain unverified. Co-op remains last, and no GitHub Actions were used.

The original2000 ordinary-PC and ExPC arrays may coexist. The cold path now
projects distinct gifts from both arrays in one pending claim: each source
character ID and upgrade count must match, complete first-unit or ExPC effects
can be omitted independently, and incomplete first initialization or
irreparable older boards keep the queue unavailable. The already captured
items/tickets, SP, Iris, medals, equipment and costume effects use their own
independent saved-effect and source-quantity proofs within the same claim;
uncaptured rewards, duplicate character IDs and guests remain guarded. This is
SOURCE ONLY / UNTESTED; two mixed-character/stock/SP save-order cases are written
but not run, and native callback order, other combinations and UI still need
acceptance.

The older dungeon/ticket/issue wrapper25da884 still has no recovered price or
allocation callback; it refreshes Gem state and reports status. No direct
BL/tail-B caller was found in earlier/current static inspection, which does not
prove indirect unreachability. Its existing empty3000 acknowledgement is **not**
a completed Dungeon purchase implementation. This pass improves actual present
orb/item acquisition instead of inventing a price or award for that old wrapper.

Later 2026-10-11 source work supersedes only that placeholder behavior with the
explicit ten-Iris offline-gate policy in
[`legacy-dungeon-ticket-contract.md`](legacy-dungeon-ticket-contract.md). The
original price/allocation is still unrecovered and native acceptance is still
untested; this historical Present milestone remains otherwise unchanged.

## Prism Bond Shards and exchange28100 — source only

This supersedes the earlier ordinary-amount subscription-ticket mapping, not
any native acceptance claim. The frozen ARM64 hash remains
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
UserSubscriptionTicket JSON27db51c:27dba28 has `userId`,
`subscriptionTicketId`, `dateList`, `bookEntryState`, `signature` and
`cumulativeAmount`; it has no `amount`. Date-entry JSON2892dfc:2892fbc
reads the original misspelling `aquiredAt` and `expireAt`. Native amount
getter23e2334 counts entries with **expireAt > current server time**, pruning
expired entries. It does not use the gacha-ticket duration-only representation
or acquisition-time translation. Native gain23e2770 creates acquisition/expiry
dates, and removal23e2994 removes the first surviving entry. The original
subscriptionTicket.enc hash
`9f8a6c182f73bb51d9a29b7c5a3b5dc68b4cf484c894279bfb68b8220c4946be`
provides the one shard331000001, duration15552000 seconds and exchange count3.
Shared gift/mission/box/shop validation and deferred gift fixtures now recognize
this dated class. General bond JSON2640d10 uses **limitBreakItemId**, not
generalLimitBreakItemId; all nine original general-bond item mappings are fixed.
Old mismatched IDs/receipts remain preserved and unavailable for reconciliation.

Wrapper23dffb4:23e0338 sends `{itemId,count}`; UI16dfa94 supplies the
**shop product ID**, not shard or bond ID. Registrar20697fc loads28100
through3497590 and function pointer4325c60. Operation23e0338:23e0a7c
applies optional lower-case arrays `userSubscriptionTicket`,
`userGeneralLimitBreakItem`, `userShopProduct` as full absolute userdata.
Shop JSON2692790 uses userId/shopProductId/count/lastExchangedAt/**readState**,
not a signature. Native callback23e1510 forwards status to the shop callback.
Read-only evidence is in ignored `.work/subscription-ticket-*-20261004.txt`
and `.work/subscription-shop-model-exact-20261004.txt`.

Original products207004490/207004491 in shop204000210 exchange3 shards for
one291000002 Adventurer/291000003 Assist Prism Bond, starting1630461600,
without a purchase cap or finite end. The handler supports positive quantities,
counts only unexpired shards, preserves remaining dated entries, retains shard
lifetime acquisition and increments actual bond stock/acquisition and product
count. Existing fields are preserved; absent bond book state3/signature0 and
shop read state0 placeholders are explicit offline initialization choices,
**not reconstructed publisher signatures/default-state proof**. The normal
shop/buy route refuses these products instead of treating dated stock as a
pre-saved ordinary amount expenditure. No publisher subscription authentication,
paid status, entitlement renewal or free shard supply is created.

SQLite stores exact before/after queue receipts, product-indexed history and
permanent actual-wire/action request identities. Issue, request, queue, reply,
observed save, materialized inventory floors and ACK share existing transactions.
No native stock/signature/cost is prepublished. Pending exchanges serialize
their shard/bond items against recorded additive producers in either issue
order; unrelated items remain available. ACK needs saved shard expenditure,
bond lifetime acquisition and the product count/date, not flags alone. A full
save can precede ACK/restart; later spending with the proved ACK is supported.
Absolute pending redelivery after incompatible stock changes cancels3000999
with queue/history intact, rather than restoring spent items. Dates are checked
as a multiset, so equal-timestamp legitimate shards remain separate quantities.
The ticket floor bounds existing dated stock and permits additional entries
only with additional lifetime acquisition; the bond floor preserves acquisition
without forbidding later stock spending. Missing retained floors/receipts do not
silently remint a baseline. The two product indexes and item primary keys avoid
scanning lifetime exchange history on each save.

The cold-path correction also applies existing gacha/scratch/ad receipt checks
to login and fresh/cached binary pulls, which do not themselves contain
operations. Earlier source commentary claiming those paths were already
validated was incomplete; this is a new source correction, not evidence of a
successful native restart. Failed login resets roll back with validation.

`test_subscription_tickets.cjs` and updated gift/master checks are **DEFERRED,
NOT RUN**, with only syntax and metadata generation performed. Probes cover
both products/counts, absence/preownership, raw expiry equality, duplicate dates,
new dated acquisitions, no precredit, flags-only rejection, split save/restart,
permanent retry/action/wire conflicts, spending+ACK and obsolete delivery,
lost receipts/floors, shared gift ordering and issue/profile/floor/ACK/reply
rollback. Native hot/cold signatures/book/read state, userdata ownership,
multi-array save timing, expiry cleanup/clock rewind UI, natural shard earning,
all other producers, history compaction and cancellation/back navigation remain
unverified. Partial multi-table saves may require reconciliation; unknown legacy
operations can still block login. No APK build/install, actual-save edit,
crash-fix/full-feature claim or GitHub Actions. Co-op remains last.

## Permanent receive-request transport — source only

Every newly successful `gift/receive` transaction now stores the actual request
identity, MD5 of the received wire bytes, canonical sorted Gift IDs and the exact
signed operation2000. That receipt commits with the gift claims, all reward-class
receipts, one-time Iris wallet change and ordinary reply cache; no post-hoc profile
or inventory reconstruction is used.

An exact retry before acknowledgement validates the retained queue and all existing
gift/effect receipts, then reuses the normal guarded delivery path. After the real
save and ACK have moved that operation to `operation_done`, the same request instead
returns the captured mandatory root popup fields with `operations: []`. It cannot
credit Iris, recreate an operation or grant inventory again. A different request
identity remains a duplicate claim and is refused. Reusing the identity with changed
bytes or route, restoring a settled Present to state0, losing a claim/effect receipt,
or retaining both/neither queue and done evidence also refuses without mutation.

The extended gift, delivery, item and character cases are **WRITTEN ONLY / NOT
RUN**. They cover atomic request insertion, cache-evicted pending restart/expiry,
partial-save refusal, changed-body conflict, settled popup-only replay, new-identity
duplicate refusal and damaged receipt/claim/operation evidence. Legacy claims made
before `gift_receive_request`, native post-ACK callback visuals, natural Present
provenance, performance and crash/ANR behavior remain unavailable or unverified.

## Ordinary first-acquisition interrupted recovery — source only (2026-10-14)

Operation2000 already retained each ordinary Present item's original quantity,
typed native table/ID field and cumulative acquisition target. Cold recovery now
uses those immutable fields for cap-version-0 items instead of limiting mixed
projection to stock/date/Iris captures. The exact before lifetime is
`cumulative_amount - amount`: an absent row is valid only at a zero baseline,
and an existing row is untouched only when it is a valid native row at that
exact lifetime. The original positive `receivedItems` entry remains in both
cases.

Once the native row reaches the exact acquisition target, cold login, pull or
confirm omits only that additive item. `UserGift` state1, SP, Iris, medals,
characters, equipment, costumes and every other independent effect retain their
existing proofs, and the real operation ACK still requires all of them. A row
between the captured before and target lifetimes is ambiguous: replaying the
full quantity would duplicate stock, so it returns unavailable with the queue
and saved state intact. Duplicate/malformed rows, cap-version corruption,
rewind, deletion and catalog drift remain guarded. No profile or ACK is written
by recovery.

`tools/test_gift_items.cjs` now contains 24 absent-row item-first/restart/cold
projection/final-ACK cases across every mapped generic Present item table, plus
22 cap-version-0 partial-lifetime refusals and one cap corruption case. Existing
dated-ticket, capped stock, Iris, stamina, medal, character, equipment, costume,
producer-order, request and rollback cases remain required. Everything is
**WRITTEN ONLY / NOT RUN**. Native constructor/signature/save timing, natural
Present provenance, popup/back behavior, legacy reconciliation, performance and
crash-free acceptance remain deferred until packet implementation is complete.
