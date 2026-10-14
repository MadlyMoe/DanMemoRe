# Event-box source implementation

## Interrupted operation15000 delivery recovery — SOURCE ONLY / UNTESTED (2026-10-14)

Pending event-box draws no longer become permanently unavailable merely because
one native save reached the server before the real operation acknowledgement.
Fresh receipts retain the exact issued reward quantity and pre-acquisition
lifetime value, plus independent observations for the ticket debit and
`UserEventBox.totalDrawCount`. These private fields are transactional with the
existing profile, queue, token and reply update. Legacy receipts do not infer a
ticket debit from an arbitrary lower balance; only their exact captured
post-debit balance is accepted.

Cold login, pull, confirm and exact draw retries derive a signed operation15000
that contains only effects not already durably saved. Ticket debit and total
counter can now be replayed independently; already acquired ordinary rewards
become zero or remainder quantities. Capped numeric, Valis and dated-ticket
rewards derive stock and lifetime remainders independently from their retained
stock/date allowance and current cumulative counter. This admits stock-first,
lifetime-first, append-first, signature-first and fully observed prefixes without
restoring spent stock. Already retained repeat-reset content is omitted;
step/content state must equal an exact captured before or after row. Missing rows
are accepted only when the original native default is zero/false. The
response-root draw fields remain unchanged for result presentation; only the
queued operation is projected. Hot `user_data/push` still suppresses redelivery
and requires the real original acknowledgement.

The ARM64 client source adds an operation15000-only counter control, zero debit
guard and explicit saved-bonus gate. Every projected chosen row carries a
private lifetime control: `-1` skips a fully saved item; otherwise `N+1` keeps
the independently remaining lifetime quantity unambiguous when it is zero. A
caller-local wrapper reads only the current chosen JSON row and marks the shared
`24d8844` gain. The marked common path keeps stock and lifetime quantities
separate and omits only its already-fired `ChangeAmount` event. A zero/zero
incomplete row still reaches the original stock/signature setter, so full-cap or
append-first signature repair is not mistaken for a complete acquisition.
Missing controls preserve every original caller. The bonus gate prevents an
acquired bonus from being restored after legitimate spending; an unobserved
bonus must still match its exact captured before row. No inventory, queue state
or acknowledgement is prewritten, and the original operation ID, type, token
and signature remain bound. Half-saved implicit bonuses and contradictory or
lost captures still refuse instead of duplicating value. Other ABIs remain
guarded.

Deferred `tools/test_event_boxes.cjs` cases now describe reset-first,
boost-flag-first, cost/counter splits, fully saved capped rewards, untouched
capped rewards, stock/lifetime/signature splits and dated append/lifetime
splits. Envelope cases bind the all-or-none nested control, bounded quantities,
complete `-1` marker, zero-lifetime signature repair and monotonic cached
projections: a retained envelope may describe an older remainder, but cannot
claim a debit, stock or lifetime effect newer than the actual saved state. They
are WRITTEN ONLY and were not executed. Current classification remains **176 partial / 0
unsupported / 0 verified complete**. No syntax/static check, test, generator,
build, package, install, listener restart, emulator/ADB, worker or Action ran;
existing saves were not opened. Native callback/save ordering and runtime
acceptance remain for the consolidated post-implementation pass.

## Step lap after a saved repeat reset — SOURCE ONLY / UNTESTED (2026-10-11)

The original draw callback imports `UserEventBoxStep.lappedCount` from its
response (`2413ed4`), while local reset `2414224` advances existing prize-row
laps without incrementing the step row. On the next draw, the offline server
now advances the step lap by one only when every authored required reset prize
has exactly one saved content lap ahead. Mixed, skipped or rewound reset laps
refuse. The receipt recomputes the same target from its captured before rows;
pending-delivery detection compares the live step with that before row, so an
unsaved response is still delivered and a saved one cannot be reissued.

The exact next-draw timing is an explicit offline reconstruction, not recovered
publisher behavior. It leaves the original ticket cost, chosen prizes, boost,
content reset, inventory and real ACK unchanged. The existing deferred
repeat-reset fixture now obtains laps 1 and 2 from actual draw responses
instead of manually saving the step lap. It is WRITTEN ONLY / NOT RUN; native
save order, UI, clock behavior and stability remain unverified.

Current revision: **partial, source-only, UNTESTED**. All testing and acceptance
checks remain deferred until every original packet and unfinished branch is
implemented. No build, package, install, listener restart, emulator/ADB, workers
or Actions accompanied this source update; existing saves were not opened.
The historical2026-10-07 disposable/native evidence below applies only to its
older revisions, not the current reset/save/Valis/cap changes. Co-op remains last.

## Dated-ticket crossing and exact caps (2026-10-10, newer source milestone)

SOURCE ONLY / PARTIAL / UNTESTED. This supersedes only the dated15000 crossing/exact-cap and lifetime/signature-prefix limitations in older notes. Original DomainGachaTicket vtable42c1ef8 uses slot50 gain24d8844, slot48 dated stock/signature setter2576654 and slotb0 lifetime24d8d94. The recovered contract in `.work/event-box-gacha-cap-contract-20261009.txt` confirms the common full-quantity lifetime cap and actual signature after append/prune. Fresh exact/crossing dated rewards now retain their original owned before-date multiset, lifetime and UInt32 signature in the existing signed v3/v4 receipt, using original positive quantity/signed bounds. No date targets, expiry policy, constructor or schema is invented.

Unobserved date/lifetime/signature prefixes are bounded by the retained baseline; lifetime cannot rewind. New multiset entries consume the original captured quantity across saves, pruning never refills it, and actual capped lifetime plus issued signature closes the reward even with all acquired dates gone before first save. Pruning old dates alone still leaves an untouched callback deliverable; a lifetime-only change now suppresses unsafe redelivery but cannot ACK. Missing retained observation alongside an actual capped lifetime/issued signature is refused, not reconstructed. Full cost/counter/mixed ACK and atomic profile/token/receipt/queue/done/exact-reply transaction are unchanged. Same-item lottery replacement must settle before15000, and ticket consumption still waits for its actual ACK.

There are36 additional WRITTEN ONLY cases in `tools/test_event_boxes.cjs`:32 exact/crossing normal/character_3 ticket cases extend six previous orders and add lifetime-first/signature-first prefixes; four exact/crossing consumer-first cases extend the two original same-item replacement fixtures. They retain original prize quantities/limits, master durations and native six-field/single-field-date shapes. Cases define rollback, no precredit, partial lifetime rewind, lost capture/observation, pruning-only untouched recovery, bounded repeated appends, first-save expiration, cold retention/exact ACK bytes, completed restoration and both producer-consumer issue orders. NONE RUN; synthetic eligibility/funding/dates/signing/order are not native acceptance.

Counts125 partial/50 unsupported remain unchanged. Other producers/constructors, shared-box costs/bonuses, coalesced-legacy attribution and native UI/event-clock/recovery/performance/no-crash/no-freeze remain unfinished or unverified. Actual saves/listener untouched, earlier DDL SOURCE ONLY / UNAPPLIED; no tests/checks/generators/build/APK/install/restart/emulator/ADB/workers/Actions. All149 packets and variants precede the consolidated test pass; co-op last.

## Earlier numeric crossing and exact-cap saves (2026-10-10, source milestone)

SOURCE ONLY / PARTIAL / UNTESTED. This supersedes the named non-Valis crossing/exact-cap stock-capture and partial-save gaps only. The original240d260 reward applies the shared24d8844 stock/signature setter before24d8d94 adds the full original quantity to lifetime. Fresh numeric15000 rewards now retain the original owned before-stock/lifetime/UInt32 signature and clamped target whenever lifetime reaches or crosses999999999, not just when it was already capped. The same signed v3/v4 captures, original quantities, indexed reservations and native signed-sum checks are reused; no new schema, master data, wire policy or native precredit.

Existing receipt, effect, stock allowance, recovery and full ACK paths accept unobserved signed numeric stock/lifetime/signature prefixes at their captured lifetime baseline. Lifetime cannot rewind; actual capped lifetime plus issued signature observes the reward even when it was spent before the first save. A lifetime-only or signature-only prefix does not close the reward, and an unchanged full-stock prefix is not an effect. Every numeric event-box positive-addition allowance is now the actual clamped stock difference, including zero at full stock. Spending cannot refill it. Oversized old recorded allowances are retained/refused, not silently repaired. Missing signed proof, ambiguous pending sources and other constructors remain unresolved, not reconstructed.

There are140 additional WRITTEN ONLY cases in `tools/test_event_boxes.cjs`: seven actual status-board/CP/EXP/equipment-material/vote/stamina-ticket/key prize classes × four exact/crossing/near-full/full-stock baselines × five stock-first/lifetime-first/signature-first/spent-before-save/combined orders. Existing original prize IDs, quantities, limits, prices and dates are retained; native fields and unchanged boost thresholds are not invented. Cases define issue/prefix/full-ACK rollback, no precredit, corrupt/lost/downgraded captures, clamped positive allowance, zero gain, spending, cumulative rewind, early ACK, cold exact replies and completed restore/deletion refusal. Existing corruption fixtures now use an actually invalid below-target baseline, not a newly supported crossing baseline. NONE RUN; synthetic funding/selection/signing/order is not native acceptance.

Counts remain125 partial/50 unsupported. Original dated-ticket crossing, other producers/constructors/coalesced-legacy and native UI/clock/recovery/performance/stability remain unfinished or unverified. No tests/checks/generators/build/APK/install/restart/emulator/ADB/workers/Actions or actual save changes; earlier DDL SOURCE ONLY / UNAPPLIED. All149 packets and variants before the consolidated test pass; co-op last.

## Earlier non-full capped reward signatures — source-only / UNTESTED

This supersedes the named non-full-first-save-spending gap in older numeric
milestones below, not other reward producers or native acceptance. Fresh capped
numeric15000 rewards now capture the actual UInt32 before signature for all
seven original numeric classes and Valis, whether stock is full or below its
authored maximum. The issuer excludes every captured old signature. Existing
v3/v4 stock targets, original quantities, signed sum guards and wire are reused;
no new operation, native stock/signature precredit or schema is introduced.

Read-only original15.1.0 extraction confirms206a334 loads the operation signature,
206b1a8:206b1b8 forwards it and240cae4 retains it. Gain24d8844 keeps incoming w2
in w21 at24d8868. Its below-maximum branch24d8a18:24d8a28 computes old stock plus
quantity then returns to24d88e8. That same setter dispatch forwards w21 at
24d88f0:24d88f8 for both non-clamped and clamped stock. Valis257c9e4:257ca0c
retains it through the stock setter and calls the actual signature setter when
nonzero. This is binary contract evidence, not runtime/signing acceptance.

The genuine saved issued signature now earns retained reward_seen even if stock
is lower than its captured target, unchanged or already spent. A previously
observed reward retains proof through later spending/signature changes. This
closes unused additions in the existing persistent stock allowance; old capped
numbers or an old signature alone still cannot earn an ACK. Full original cost,
box/content/step/boost/implicit bonus/mixed reward obligations and actual ACK
remain in the same profile/token/private receipt/queue/done/exact-reply transaction.

Each numeric stock_amount_added entry now also binds its signature to the stock
capture. Stripping/downgrading only the signed capture therefore fails instead
of falling back to legacy target-stock proof. Missing/two-field/changed-signature
allowances require original reconciliation; no old issued signature is guessed.
The previously added nullable column remains SOURCE ONLY / UNAPPLIED. Actual
saves and listener were not opened, migrated or restarted.

Deferred test_event_boxes source expands the eight-class allowance cases to32:
partial-spent, observed, spent-before-save and signature-first. They cover UInt32
old signatures, collision/wrap below maximum, zero additions despite real proof,
downgrade refusal, targeted observation/allowance rollback, retained real queue,
old-signature ACK refusal followed by actual-signature ACK, restart/cached replay,
completed restore refusal and a separately captured next Present. Both original
Valis pools expand to24 Familia cap-credit cases, including first-save spending
for capped and crossing gains, rollback and later actual donation protection.
WRITTEN ONLY / NONE RUN; synthetic stock/time/order/funding is not publisher
earning, native application/signing or UI proof.

Other producers, coalesced unsaved charges/gains, mixed attribution and lost
legacy history remain unfinished. Native signing/save order, event-clock/UI,
cold recovery/performance/no-crash/no-freeze acceptance remain deferred. Metadata
is manually edited, generators NOT RUN; no tests/checks/build/APK/install/restart/
emulator/ADB/workers/Actions. All149 packets/branches before testing; co-op last.

## Numeric stock checkpoints and persistent additions — source-only / UNTESTED

The completed-stock guard now covers the seven original numeric classes and
Valis as well as dated gacha tickets. It compares unique owned rows with bounded
stock/lifetime/signatures against the actual durable primary profile at lifetime999999999.
Spending remains valid; an increase needs a separately validated pending capped
reward. A changed signature alone cannot restore old spent stock. Existing
indexed completed-item seeks across all six ordinary producers are reused, not
a second inventory ledger or a lifetime stock-history scan. Their remaining
capped gain branches are not thereby implemented.

Fresh numeric capped15000 captures now initialize private stock_amount_added
with zero additions per original item. Each positive saved balance difference
consumes its original chosen-quantity allowance across all partial saves.
Spending does not replenish it, and retained actual reward observation closes
the remainder. The prior serialized allowance is compared before an update in
the same profile/token/effect/reward/queue/done/exact-reply transaction. An
observed stock change suppresses additive replay without granting an early ACK.

Missing, malformed, wrong-item, over-quantity, downgraded or behind-current-
profile captures refuse reconciliation. No legacy allowance is guessed. The
nullable column DDL is SOURCE ONLY / UNAPPLIED; actual saves/listener are
unchanged. The newer signature section supersedes this milestone's missing
non-full callback proof only; an actual issued signature is still mandatory.

This milestone's deferred16 eight-class partial-spent/observed cases are expanded
by the newer signature section, using authored prizes/quantities and owners/reserved/key
fields. They cover allowance persistence, targeted rollback, corruption,
spending/refund/closure, cached suppression, restart, real ACK, completed restore
refusal and a separately captured next Present. Present fixtures also cover
all seven numeric types and no-charge Valis after completion. WRITTEN ONLY /
NONE RUN; synthetic ordering is not native earning/signing/application proof.
Remaining producer/coalesced/legacy/native order/UI/clock/recovery/performance/
stability gaps remain. Metadata is manually edited; no generator/check/test/
build/APK/install/restart/emulator/ADB/workers/Actions, all149 packets/branches
before testing, co-op last.

## Dated-stock checkpoints and pending allowances — source-only / UNTESTED

This supersedes the named event-box completed-stock gap below, not all capped
reward producers or native acceptance. A completed event-box acquisition at
the original999999999 lifetime cap now activates strict owned six-field
`UserGachaTicket` validation and a multiset subset check against the current
durable primary profile. Once dates are spent or pruned, a later save cannot
restore them merely by changing the signature. The same shared guard covers
`issueDraw` full-row replacements; legitimate ticket consumption remains a
subset. Existing indexed completed acquisition seeks are reused, with no
second inventory table or lifetime date-history scan.

A fresh capped15000 date reward now initializes the private
`event_box_request.gacha_dates_added` field with zero observed additions per
captured item. Each changed dated row consumes only its new multiset entries,
bounded by the original chosen quantity across **all** partial saves. Pruning
does not refund this allowance. Once the real issued signature has been
observed, no further date additions are permitted for that operation, even
when newly gained dates had already disappeared before their first save.
A later original capped reward creates only its own new allowance.

The allowance is not native stock or proof of reward application. Actual
signature observation, full original cost, counters and real ACK are still
required. Its native-profile/token/effect/receipt/queue/done/exact-reply updates
use the existing transaction. The allowance update also compares the prior
serialized value; a changed/missing value rolls back rather than overwriting
it. Missing, malformed, wrong-item, over-quantity or downgraded captures refuse
reconciliation, and observations cannot be older than additions still present
in the actual profile. No legacy allowance is guessed or backfilled.

The nullable receipt-column migration is **SOURCE ONLY / UNAPPLIED**. Existing
saves and listener were not opened or changed; old numeric/crossing receipts
with no date capture retain null metadata. Older saturated date captures that
lack the new allowance are preserved and require reconciliation, not a reset
to zero or fake ACK.

Deferred `test_event_boxes.cjs` sources extend both original normal/character_3
prizes with allowance initialization/corruption/refund refusal, a targeted
allowance-update rollback, duplicate/repeated partial appends, pruning without
budget refunds, signature closure before ACK, completed restoration refusal
across restart, a later real capped grant, shared full-row issuer refusal and
legitimate ticket consumption before unit ACK. **WRITTEN ONLY / NONE RUN**;
synthetic save/time/order and initialized unit fixtures are not native proof.

Other capped producers, genuinely unobserved/coalesced gain-spend attribution,
lost legacy private history after all affected stock disappeared, and native
signing/order/event-clock/UI/cold recovery/performance/stability remain
unfinished or unverified. No feature is promoted to complete.

## Saturated gacha-ticket lifetime rewards — source-only / UNTESTED

This supersedes only the named15000 date-ticket cap gap in the older notes
below; other producers and completed dated-stock restoration remain unfinished.
The original `UserGachaTicket` has six serialized fields: `userId`,
`gachaTicketId`, `dateList`, `bookEntryState`, `signature`, `cumulativeAmount`.
Each date has only `aquiredAt`; there is no numeric amount or serialized expiry.
Original `2638ac0` serializes a signed book byte and unsigned32-bit signature.
Source references are retained in
`.work/event-box-gacha-cap-contract-20261009.txt`.

Original `257624c` prunes dates when AppTime is at or beyond acquiredAt plus
the original master duration. That deletion is not reward delivery. Original
`2576654` writes the supplied nonzero signature after its date adjustment loop,
including unchanged stock; `2638798` marks a changed signature dirty. Thus a
distinct actual15000 signature can prove the capped callback even if its dates
expire or are spent before first observation, without inventing expiry targets.

The existing private v3/v4 reward-stock union now captures actual before dates,
cumulative amount, and signature. Existing operation issuance excludes the old
signature. Exact owned six-field saves, date shapes and native widths are
required. A multiset subset of old dates alone leaves the first callback
deliverable; new dates or a changed signature suppress unsafe replay but do not
ACK without the issued signature. The retained observation survives later
legitimate date pruning and signature changes. Full original ticket cost,
prize counters and real ACK remain mandatory. `lottery/ticket/draw` cannot
consume the same item while this capped event-box reward awaits ACK. Conversely,
a same-item queued1000/1001 `userGachaTicket` full replacement must ACK before
issuing the capped15000 addition, so older replacement delivery cannot erase
newly granted dates. Both directions use the existing operation queue.

Existing atomic profile/token/receipt/reward observation/queue/done/exact reply
handling is reused. No native precredit, guessed dates, new wire operation,
schema change or original-catalog regeneration. Existing saves were not opened;
earlier source-only schema changes remain unapplied.

Deferred `test_event_boxes.cjs` cases cover actual normal and character_3 prizes
with original quantities/finite limits, duplicate times, empty inventories,
append/reward/count-first saves, natural pruning alone, newly acquired dates
gone before first signature observation, capture loss/downgrade, malformed
rows, both original same-item ticket-draw issue orders, rollback, restart and once-only real
ACK/received-wire retry/settled cancellation. **WRITTEN ONLY / NONE RUN**;
synthetic funding, dates and save order are not native gameplay evidence.

Completed dated-stock restoration across other capped reward producers, mixed
coalesced attribution and native signing/save-order/event-clock/UI/cold recovery,
performance and stability remain unfinished or unverified. No route is promoted
to complete; historical inventory counts remain unchanged.

## Remaining numeric box-prize caps — source-only / UNTESTED

Original key-item, vote-item and stamina-ticket vtables `42bec28`, `42bf8b8`,
`42c1850` also bind gain24d8844, authored maximum24d8d6c and lifetime24d8d94.
Original itemType column3 sets all three stock maxima to999999999. Their
stock setters forward nonzero signatures through262d614/2841d5c/26356ac;
changed protected signatures dirty the row even when numeric stock is full.
The selected source reading is retained in
`.work/event-box-remaining-numeric-cap-contract-20261009.txt`.

These actual prize types now use the existing v2/v3 capture/stock/signature
observation and full cost/counters/real ACK path. Original quantities, native
int32-sum bounds, same-item producer exclusion, replay guards and atomic
receipt/profile/token/queue/done/reply updates remain; no stock/signature or
processed key-item flag is prewritten. Key rows keep their separate `exploit`
Boolean. Stamina and voting domain book getters return1 and setters are
no-ops, but their serialized book fields remain present: the original stamina
parser2636764 reads seven fields including `bookEntryState`, not six.

Deferred `test_event_boxes.cjs` now covers all six newly bound ordinary prize
classes. Selection admits finite prizes with at least two original copies so
the first stock-cap draw and next signature-cap draw remain available; it does
not change their limits or reset exhausted finite prizes. The actual stamina
example has limit15. Native-shaped reserved/book/flag fields and non-feat key
processed-flag rejection cases accompany the existing split/combined/rollback/
corruption/owner/removal/rewind/spending/restart/actual-wire replay cases.
WRITTEN ONLY / NONE RUN; funding and forced selection are not natural earning,
original RNG or native signature/save-order proof.

All numeric stock classes occurring in the original final box-prize catalog
now have source bindings for the named capped-stock branch. Date-based gacha
tickets remain a separate unfinished append/expiry branch, not numeric stock.
Non-full gains spent before first observation, mixed capped attribution and
native UI/callback/save/cold recovery/performance/stability remain unfinished
or unverified. No new schema/wire/operation/dependency or catalog regeneration;
no tests/checks/build/APK/install/restart/emulator/ADB/workers/Actions. All149
packets and unfinished branches before testing, co-op last.

## CP/EXP/equipment-material capped prizes — source-only / UNTESTED

Original DomainCpItem, DomainExpItem and DomainEquipmentMaterial vtables
`42b1040`, `42b4020`, `42bd360` bind ordinary gain slot50 to `24d8844`,
maximum slot88 to `24d8d6c`, and positive lifetime slotb0 to `24d8d94`.
The maximum getter reads authored itemType column3. Original final content
rows `item_type.cp_item`, `item_type.exp_item`, `item_type.equipment_material`
all set that stock maximum to999999999. The class stock setters `23ddebc`,
`243955c`, `2516a14` forward a nonzero signature even when the numeric stock
setter has no change, through `283ff8c`, `2645808`, `283d608` respectively.
Selected original reading is retained in `.work/event-box-ordinary-cap-contract-20261009.txt`.

These three actual prize classes now reuse the existing v2/v3 stock observation
path at saturated lifetime acquisition: actual clamped positive stock save, or
distinct actual operation signature when stock is already full. Original
quantity, stock and lifetime caps, int32-sum guard, same-item producer exclusion,
receipt validation, hot/cold suppression and full cost/counter/real ACK proof
remain. No native stock/signature prewrite, duplicate reward ledger, early ACK,
catalog generation or new schema/wire/operation is added by this branch.

Deferred `test_event_boxes.cjs` selects actual unlimited first-step prizes of
all three classes and reuses stock-first/counts-first and full-stock signature-
first/counts-first/combined cases, issue/partial/ACK rollback, corrupt captures,
old/invalid signature refusal, spending/removal/rewind, restart and settled
actual-wire replay cancellation. File identities now include the original
prize ID so different prizes in one box cannot share a synthetic save file.
WRITTEN ONLY / NONE RUN. Existing full-stock policy notes for Valis/Falna now
extend only to these named classes, not every inventory or date ticket.

The original box prize catalog has no Faithstone entries; none are invented.
Other class/date-ticket consumers, unsaved non-full gains spent before their
first observation, mixed producer attribution and native signing/save/order/
UI/recovery/performance/stability remain unfinished or unverified. Repeat the
shared gift/shop/mission/stage/inventory/save/cache/clock cases in the final
batch; no tests/checks/generator/build/install/restart/emulator/ADB/Actions.

## Completed Valis donation floors and capped rewards — source-only / UNTESTED

The earlier blanket cancellation after any completed Familia Valis donation is
superseded for new, settled event-box gains. Original ordinary gain24d8844 clamps
stock separately from lifetime acquisition24d8d94. A donation's old
`amount-cumulativeAmount` spending bound cannot account for a later stock gain
whose lifetime increment is shortened by the cap. The source now retains that
charge bound and raises it only by the exact proven difference:

`credit = max(0, clamped stock gain - clamped lifetime gain)`.

Private policy `offline-event-box-v4` binds a hash to a separate
`offline-event-box-valis-floor-v1` capture of original before stock/cumulative,
full authored grant, clamped targets, spending ceiling and positive credit.
Existing v1/v2/v3 captures and the original15000 wire/quantities remain unchanged.
Crossing lifetime gains use the actual increased acquisition as callback proof;
already-capped gains still require their v2 saved-stock observation. A full-stock
v3 signature callback grants zero spending credit, not the full chosen quantity.
Missing/corrupt/downgraded captures or mismatched observations cannot credit it.

One private `familia_valis_spending_floor` row is keyed by owner and points to
its exact completed donation or observed event-box receipt. Normal saves use
point lookups and updates, not a lifetime donation MIN scan. A source-only
initialization can import the tightest explicit old completed charge once;
new-format donation or cap captures prohibit rebuilding a missing floor from
legacy rows. Lost/corrupt source identities or values require reconciliation,
without native precredit or history erasure. Nullable donation `spending_ceiling`
and event-box `valis_state`/`valis_seen` columns are SOURCE ONLY / UNAPPLIED.
No existing save or listener has been opened, migrated or restarted.

Actual reward observation, native profile/tokens, the once-only credit flag,
floor/source pointer, real queue/done and exact response cache share the existing
transaction. A split reward save may record credit while the real15000 stays
queued; all original ticket, box/content/step/boost/bonus/reward/ACK obligations
remain. ACK retains positive-credit receipts as permanent source proof; they
are not queued callbacks and cannot grant again on old request/save retries.
Later native spending does not erase the source. A later donation captures its
own stricter ceiling and requires its full real debit/counters/22100 ACK; an
earlier cap credit cannot refund it. Valid Valis stock above its lifetime count
is admitted through the original2-billion stock limit, not discarded.

Deferred `test_familia_valis.cjs` sources cover both original Valis pools,
crossing/already-capped lifetime and stock-cap-clamped gains, handler-earned
donations, reward-first/counts-first/combined saves, issue/profile/observation/
floor/done/reply rollback, no native precredit, cold replay, first-save spending
when lifetime rises, post-observation spending, old cap/counters early-ACK
refusal, malformed/missing captures, strict refunds, exact ACK retries, permanent
source retention, lost/corrupt floor refusal, explicit old-charge initialization,
zero-credit full-stock signature callbacks and a later donation's retained cost.
WRITTEN ONLY / NONE RUN; starting Familia/funding/clock and forced original
selection are synthetic, not natural earning, RNG, signing or UI acceptance.

Unfinished: coalesced pending Valis debit plus capped gain (settle the older
22000/22100 debit first), other capped reward producers/item classes, mixed or
intermediate attribution and legacy gain reconciliation. Natural native save/
ACK/signature order, reset interleavings, cold/UI/recovery/performance/stability
and every other packet branch remain unverified. All implementation precedes
consolidated testing; no tests/checks/generator/build/APK/install/restart/
emulator/ADB/workers/Actions ran. Original data and existing saves are unchanged.

## Fully capped Valis/Falna signatures (2026-10-09, source-only / UNTESTED)

The newer donation-floor section above supersedes this milestone's blanket
completed-donation cancellation only; other stated limits still apply.

Original numeric setters skip dirtying unchanged stock and cumulative values;
the Valis/Falna book-state setters add no observable saved change. The original
15000 dispatcher nevertheless forwards its issued operation signature into the
item gain. Processor206a0c4 loads the operation signature at206a334; the bound
bridge206b178 loads it through x4 at206b1a8 and forwards w3 at206b1b4 to handler
240cab4. Its ordinary gain24d8844 retains that signature through stock setters
257c99c/231e9ec. Nonzero signatures reach native setters25fdd48/262f8d0, which
dirty the item only when the saved signature differs. These are original-code
observations, not execution or gameplay acceptance.

New fully capped Valis/Falna rewards use private draw policy
`offline-event-box-v3`. Each full-stock capture retains the original stock,
lifetime count, UInt32 saved signature and newly issued positive-int32 operation
signature. The issuer excludes every fully capped selected item's prior
signature, advancing and wrapping within the existing positive-int32 range on
collision. Other operation callers keep their existing default behavior. The
original chosen quantities, wire payload, token and native inventory remain
unchanged; no stock or signature is prewritten. V1/v2 draws retain their exact
representations, and a v3 draw can also retain ordinary positive-stock v2-shaped
captures. Corrupt or missing signature proof cannot downgrade into old cap proof.

The item's actual new saved signature, not its unchanged capped numbers, is
required before recording its existing private `reward_seen` observation. This
also permits stock spent before the first signature save. Later spending and
valid signature changes retain the observation without relaxing the lifetime
floor. An actual saved effect suppresses additive redelivery, but the real
15000 stays queued until all original cost, box/content/step/boost/bonus and
reward obligations plus the actual ACK are satisfied. Existing transaction,
rollback, exact-reply identity and reset-before-ACK proof remain in force.
No additional schema was introduced; the earlier nullable observation schema
is still source-only/unapplied. Existing saves were not opened or migrated.

Deferred fixture sources cover both authored Valis pools and the unlimited
Falna/two-draw prize at full stock and lifetime caps: collision/INT32 wrap,
UInt32 old signatures, unchanged numeric values, no precredit, cold delivery,
signature-first/counts-first/combined saves, old/malformed signature and capture
refusal, rollback, real queued ACK, first-save spending, later signature changes,
retained floors, repeat reset, exact retry and settled-draw cancellation.
WRITTEN ONLY / NONE RUN. This supersedes the older full-stock refusal only for
these original Valis/Falna classes; it is not complete event-box acceptance.
Other item/date-ticket classes, non-full gains spent before their first stock
observation, mixed/intermediate attribution, overlapping producers that cannot
settle first, legacy reconciliation and the completed Familia Valis donation
spending-floor/capped-credit branch remain unfinished. Natural native callback,
signature/save/ACK order, UI, recovery, cold persistence and performance remain
unverified. All packets and unfinished branches precede consolidated testing;
no tests/checks/generator/build/APK/restart/emulator/ADB/workers/Actions ran.

## Crossing the lifetime acquisition cap (2026-10-09, source-only / UNTESTED)

### Earlier v2 already-capped stock milestone — source-only / UNTESTED

The newer v3 section above supersedes this revision's fully capped-stock
refusal. Its numeric-stock proof and all other limits remain applicable.

Original ARM64 relocation/type-info reading binds `DomainCurrency` to
vtable42c2330 and `DomainStatusBoardItem` to42aa688. Both use ordinary gain
24d8844, maximum getter24d8d6c (encrypted `itemType` slot3), and cumulative
gain24d8d94. The original `itemType.enc` rows give currency200000005 a stock
maximum2,000,000,000 and status-board-item200000015 maximum999,999,999.
These stock maxima are separate from the999,999,999 lifetime cap. Valis
getter257c80c reads native amount at58; its setter257c99c delegates to25fdb88.
Falna getter231e9d4 reads the same amount field, setter231e9ec calls262f5fc,
and cumulative getter/setter231ebcc/231ebe4 use the separateF8 field.
This is original-code/data extraction, not gameplay testing.

Fresh already-capped Valis/Falna rewards now capture original before stock,
before lifetime count and the exact clamped post-gain stock in private draw
policy `offline-event-box-v2.rewardStocks`. The native chosen quantities and
15000 wire remain unchanged. No native stock, signature or reward is prewritten.
New nullable `event_box_request.reward_seen` records only item IDs whose exact
target stock was actually submitted in a native-shaped save. Source schema
only: no existing save/listener migration has been run. Existing v1 draws retain
their representation; missing/corrupt v2 capture or observation cannot be
reinterpreted as legacy saturated inventory proof.

The old capped cumulative count does not observe the first callback or satisfy
its reward ACK. An actual stock change suppresses additive redelivery; exact
target stock in a push records the gain. Later spending is allowed only after
that observation, with the original lifetime baseline retained. Every pending
cap capture prohibits acquisition removal/rewind, even when not ACKed. Actual
ticket/box/content/step/boost/bonus proof and the real15000 acknowledgement remain
mandatory. Profile, observation, effect, done/queue and exact save-reply identity
share the existing transaction. Temporary observation disappears only with the
real ACK; permanent draw/acquisition history and completed lifetime floor stay.

The shared ordinary inventory predicate now accepts Valis stock through its
original2-billion maximum, without widening other currency or lifetime limits.
Same-item producers must settle before capturing a cap gain. Fully capped stock,
other item classes/date-ticket proofs, gain spent before any observable stock
save and multi-delta intermediate attribution remain unfinished. Completed
Familia Valis donations still use an old amount-minus-cumulative spending floor;
new crossing/already-capped Valis draws explicitly cancel before issuance in
that context until separate capped-gain credit proof is implemented. No historic
donation, stock or acquisition floor is erased or relaxed.

Deferred source cases now cover both exact Valis pools and the original
unlimited Falna/two-draw prize, from capped lifetime with zero stock or stock
one below the original maximum. They queue stock clamp/full quantities,
issue/reply rollback, no precredit, cold first delivery, missing/corrupt
capture/observation refusal, stock-first/counts-first saves, old cumulative and
unchanged-stock early-ACK refusal, observation/profile/reply rollback, retained
real queue, suppression after any effect, post-observation spending/reopen,
owner/removal/rewind rejection and real ACK/retry/settled-draw cancellation.
The full-stock fixture now follows the v3 source branch above after any
required prize reset. Earlier crossing
fixtures now expect another observable capped-counter draw from zero stock.
All are WRITTEN ONLY / NOT RUN. Original quantities/weights/windows/data remain
unchanged; no new dependency/export/operation/table, repair, workers or Actions.
No tests, smoke/syntax/static acceptance checks, builds, APK work, listener
restart or emulator/ADB actions were performed. Other packet branches and
native signatures/order/UI/recovery/performance/stability remain unverified.

The following paragraph records the earlier below-cap crossing implementation;
its already-capped refusal is superseded only by the restricted source branch
above, not by complete cap/gameplay support.

Exact original24d8d94:24d8de0 reads cumulative acquisition through vtable0xa0,
adds the positive native gain and clamps the setter0xa8 to999999999. Event-box
chosen-item15000 uses the ordinary gain path before importing its absolute
content and step counters. The previous planner cancelled every selected reward
whose distinct reservation plus quantity crossed that lifetime cap.

Source now admits a crossing from a valid saved acquisition below the cap,
only when the indexed common reservation equals that actual baseline and no
other reward for the same item is pending. It retains min999999999 as the
ordinary acquisition target; chosenItems preserve each original full amount.
The existing saved inventory predicate, actual ticket/box/content/step/bonus
ACK proof, partial-delivery observation, transaction and completed acquisition
floor remain unchanged. A saved below-cap counter cannot satisfy the ACK. New
same-item producers at that cap still cannot reuse it as another observable
gain. Aggregate chosen quantity stays within999999999, making the retained
sum fit native signed int32 before the clamp.

No schema, special reward operation, changed wire/catalog/weight/quantity,
native stock/currency precredit, fake ACK, legacy repair or dependency was added.
Existing below-cap reservations and older receipts retain their representation.
The deferred fixture's native-shaped cumulative gain helper now applies the
original cap. Additional WRITTEN ONLY / NOT RUN cases use both exact Valis pools
and an original unlimited Falna prize/two-draw batch with synthetic lifetime
999999998/zero stock: original unshortened quantities, capped private target,
issue/ACK/reply rollback, no native precredit, cold pending replay, counts-first,
missing capped acquisition refusal, exact ACK retry/settled-draw cancellation,
later spending and retained acquisition floor, and refusal of a fresh draw
once that item's acquisition is already capped. The finite required Valis prize
is reset before that refusal, so finite depletion cannot mask the cap branch.
Original weights and forced original selection are not native RNG evidence.

Already-capped acquisition, spendable-stock saturation/signature proof,
overlapping producers that cannot settle first, legacy attribution and natural
callback/import/save/ACK/UI/cold/recovery/performance/no-crash-ANR remain
unfinished or unverified. Those limits are still on the full packet goal, not
treated as complete gameplay. All original packets and unfinished branches
remain ahead of consolidated testing; no tests/checks/build/install/restart/
emulator/ADB/workers/Actions ran, and no existing save was opened.

## Original Valis reward pools (2026-10-09, source-only / UNTESTED)

Two authored steps contain ordinary Valis rewards: box193000030/step194000465/
content195011676 gives1,000,000 Valis as an unlimited prize; box193000034/
step194000529/content195013310 gives100,000 Valis as a finite limit1 prize
required for repeat reset. Both map `currency.valis` to original205000002 and
the existing `UserCurrency.currencyId` profile. Each draw spends10 of its own
original event tickets. Their quantities, finite/reset rules, weights and
historical windows remain unchanged.

The draw's acquisition planner previously rejected every UserCurrency prize,
even though the generic receipt/save/ACK path already supports that table.
That check now admits original Valis only. Original15000's exact240cab4 handler
iterates chosen itemId/amount, resolves the ordinary item repository and invokes
gain slot0x50; it does not supply another currency reward packet. The existing
common acquisition reservation, cumulative receipt, saved inventory predicate,
partial-delivery suppression and completed acquisition floor therefore handle
Valis without a separate wallet credit, native prewrite or fake ACK. Iris,
stamina and casino-medal special currency paths are not enabled by this change.
No new schema, wire field, operation, export, dependency, catalog or save repair.

The deferred ordinary inventory fixture now includes Valis as a ninth table
class. Additional WRITTEN ONLY / NOT RUN cases use both exact original pools,
with explicit synthetic step/ticket/zero-currency prerequisites and forced
original-pool selection, not natural unlocking or RNG proof. They queue issue
rollback/no native precredit, original amounts and cumulative reservations,
cold pending replay, currency-first versus counters-first saves, incomplete ACK
refusal, finite Valis reset-before-ACK versus non-required unlimited reset
refusal, real ACK/reply rollback, exact saved retry/settled-draw cancellation,
finite depletion/reset versus unlimited availability, later spending and
acquisition rewind/removal refusal. All prior item/gift/shop/clock/save/delivery
and native event-box acceptance cases remain deferred.

Original catalog inspection found no shared ticket keys across its100 boxes;
the existing shared-ticket cancellation is unreachable with that catalog, not
implemented support for hypothetical edited catalogs. Other ordering/legacy/
step-lap/currency-cap/signature/UI/performance/recovery branches remain incomplete
or unverified. No tests/checks/build/restart/install/emulator/ADB/workers/Actions
ran, and existing saves were not opened. All original packets and unfinished
branches stay on the goal; consolidated testing remains deferred, co-op last.

## Repeat reset saved before the draw acknowledgement (2026-10-09)

The shared save planner now handles a native2414224 reset saved while its
original15000 draw is still pending. It derives the same exact pre-reset
counter view from the issued draw and original captured baseline, checks the
final repeatable step, every required reset prize and all existing/newly awarded
rows, then stores that proof beside the pending draw. The native profile keeps
the actual next-lap, zero-picked, variation2 rows; no draw counters, cost or
inventory are written ahead of the client.

Private `event_box_request.reset_state` is nullable and request-bound. Its
`offline-event-box-reset-v1` capture contains only the actual pre-reset rows,
including selected targets, not fictional rows for every catalog entry. A
retained capture must match the immutable original draw-policy counters and
every chosen prize, have valid owner-zero/local-user ownership, meet the original
finite reset-prize limits and carry the existing saved-effect observation.
Malformed, mismatched or missing proof cannot be used to infer an earlier lap.
The source schema addition has NOT been applied to any existing save or listener.

After a separate reset save, later pushes retain those exact reset rows and
cannot remove, rewind or repeat them while the draw is pending. The original
draw stays queued: its additive callback is suppressed after any saved effect,
not replayed to restore old counts or award another copy. A later actual ACK
uses the retained pre-reset counters solely for its counter proof, while ticket
consumption, box total, step draw/lap/boost, implicit bonus and every inventory
acquisition still need their actual native saved state. A reset-only save is
not reward or spending proof and cannot settle the draw. Resource saves can
precede, accompany or follow the reset without inventing an ACK.

Reset proof/profile/token/effect observation share the existing transaction and
save-reply identity. A later real ACK uses the existing done/queue/temporary
receipt cleanup transaction; permanent draw identity and acquisition/claim
history remain. No new operation, table, export, dependency, native prewrite,
legacy backfill or server-side item grant was added.

Deferred source cases cover first-ever row/reset-first, resources-with-reset,
counts-before-reset and resources-before-reset order, owner0, reopen and exact
reset-save retry, retained real queue/absent done record, refusal of additive
redelivery, early ACK/missing resources, reset rewind/removal/repeat/wrong owner,
lost/corrupt capture/policy/contents/lap/ownership/observation, reset and later ACK
rollback, real ACK without dirty rows after resources were saved, retained
native step/cost/item/claim history and exact ACK retry. They are WRITTEN ONLY /
NOT RUN. The previous combined-save cases remain deferred; their old no-ACK
refusal case was removed because a valid split reset now retains its own proof.

Other multi-delta/coalesced orders, legacy reconciliation, positive step laps,
shared-ticket sibling box effects, unmapped reward classes and natural native
signatures/callback-import-save-ACK timing/UI/cold/performance/no-crash-ANR remain
unfinished or unverified. This is source progress, not complete event-box or
packet gameplay. All original packets and unfinished branches remain in scope;
consolidated testing waits until implementation coverage is complete.

## Combined last-draw acknowledgement and repeat reset (2026-10-09)

Original15000 applies its captured chosen-prize counts, cost and rewards.
The original2414224 final-repeat-step reset then advances each existing prize
lap by one, clears pickedAmount and writes variation2, without resetting the
step draw counter. Native canReset2412f28 requires every authored reset prize
at its finite limit. A single save can contain the later reset state and the
draw's actual acknowledgement; previously the pending-draw guard rejected it.

The shared push planner now derives a request-bound pre-reset counter view
from the exact queued15000 and its retained original draw-policy baseline.
The view is validation-only: actual named-table writes retain the client's
post-reset rows. It includes a newly awarded row even if that native row's
first dirty save already has lap1. Existing rows must remain at the captured
baseline or exact draw target before projection, with valid native ownership;
no intermediate counts, unknown old provenance or additional laps are invented.

Every existing and newly awarded prize must reset together exactly once.
The final repeatable step and authored reset-prize eligibility guards remain.
That first source branch required the15000 real acknowledgement in the same
request; the retained split-reset proof above now removes that ordering limit.
Ticket consumption, box total, unchanged step draw/lap/boost targets,
implicit bonus and every actual inventory acquisition still use the ordinary
save/ACK proof. An absent ACK or an incomplete/forged reward save cannot clear
the queue. Profile/token/effect observation/real done record/queue/sequence/reply
share the existing transaction. No native profile prewrite, extra operation,
fake ACK, schema, dependency, new reward or cleanup/backfill was added.

`test_event_boxes.cjs` extensions are WRITTEN ONLY / NOT RUN. Disposable source
cases queue a first-ever awarded row saving directly as reset, all-at-once,
resources-first and counts-first/reopen ordering, no-ACK/missing-cost-item-step
proof, wrong owner/skipped lap/variation, missing legacy draw policy, receipt/
profile/actual-ACK/reply rollback, retained cost/history/native reset state,
same-wire save retry, settled-draw cancellation, reopened availability and
reset-prize-not-yet-earned refusal. The existing normal/reset/draw/bonus/bulk,
gift/item/clock/pull/delivery cases remain deferred. Synthetic funding and
forced original-pool selection are not natural earning or RNG proof.

Other multi-delta/coalesced orders, legacy
provenance, positive step-level laps and native signing/callback-import-save-ACK
timing/rendering/navigation/cold/performance/no-crash-ANR remain unfinished or
unverified. This source branch does not establish complete event-box gameplay
or complete packet coverage. Consolidated testing still starts only after all
original packets, variants and unfinished branches are implemented.

## Original evidence

The unchanged archive export contains 100 boxes, 1,585 steps and 40,678 contents.
Of 98 boost-enabled catalogs, 95 have no bonus item and have fully mapped first
step prizes across seven ordinary inventory classes. Their ticket costs are 5
or 10; the original step `boostAfter` field is 300. Three bonus catalogs now have
source-only implicit-item support: `193000051`, `193000052`, `193000095`. All cost
one ticket and use `bonusEvery:30`, mapping to owned `UserEventItem` IDs
`290000426`, `290000439`, `290000772`. None of their chosen-prize pools overlaps
its bonus item. This catalog projection is read-only, not a gameplay test.

Native evidence uses the original ARM64 `libapp.so`, SHA-256
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
Addresses below are raw ELF offsets; Ghidra display addresses add `0x100000`.
Bounded ranges come from the original `.eh_frame_hdr` function entries.

- Step callback `2413ed4:241404c` reads integer draw/lap and boolean boost.
  Serializer `2749834:2749ab4` emits `userId`, `eventBoxStepId`, `drawCount`,
  `lappedCount`, `boost`; JSON probabilities are fractions, not percentages.
- Constructors `283dc8c:283dd98`, `283e430:283e584` and
  `283ed98:283ef28` set the protected owner field to zero via `1ba5304`.
  Lazy box creation `2412acc:2412c98`, lazy step creation `241404c:2414224`
  and content callback `2413a90:2413c30` do not replace that owner.
- Counter update `2414578:2414660` adds **consumed ticket amount** to
  `UserEventBox.totalDrawCount`, not the number of prizes.
- Exact operation handler `240cab4:240dc38`, particularly `240d088:240d0dc`,
  then calls `changeAmount(trunc(totalDrawCount/bonusEvery)-currentAmount)`
  **before** granting chosen prizes. This is an absolute balance replacement,
  not a once-per-milestone gain. Spent bonus stock can be restored; excessive
  stock decreases. Native event-item vtable `42c3270+40` resolves to amount
  getter `25ab4e0:25ab4f8`, not cumulative getter `25ab6d8:25ab6f0`.
- Common item adjustment `24d8844:24d8b98` calls acquisition helper
  `24d8d94:24d8de0` only for positive deltas, clamping lifetime acquisition at
  999,999,999. Event-item lazy creation `25ab168:25ab2d0` sets the actual player
  ID; it does **not** inherit the three box-state tables' owner-zero exception.
- Earlier recovered per-prize reset `2414224` increments existing prize laps,
  zeros picked amounts and sets variation 2; it does not reset step draw count.
- Settings initialization within exact FDE `12705bc:127142c`, at
  `12713ac:12713d8`, constructs three int32 choices: read-only values 10/50
  at `3530a70` and immediate 100. Constructor `2411d60:2411dd8` inserts them
  into the ordered tree at `44f7ac0`; getter `241485c:24149a4` validates stored
  `event_box/max_draw_amount` against that tree and defaults to 10 at `432fe40`.
  This string is a local setting, **not a network route**.
- Settings UI `1698d78:1699640` creates the matching 10/50/100 controls;
  commit callback `16997f0:16998f8` stores the selected setting. Batch getter
  `241312c:2413360` uses `min(selectedMax,max(2,floor(float(stock)/float(cost))))`.
  Bonus configuration `2413374` instead forces default max 10. The lower bound
  2 is for that bulk button; single draws still exist and server stock validation
  is not relaxed when the native bulk lower bound exceeds affordable stock.

The read-only artifact `.work/event-box-native-default-owner-20261006.txt`
contains only the exact constructor, protected setter and step serializer
ranges above. Earlier exploratory artifacts contain some incorrectly bounded
sections; those sections are not evidence and must not be used.
Bonus evidence is in `.work/event-box-bonus-handler-exact-20261006.txt` and
`.work/event-box-bonus-item-exact-20261006.txt`, both completed serial read-only
Ghidra jobs with exit 0. Vtable resolutions and common-helper ordering were also
read directly from the original ELF relocations/instructions, without patching it.

## Implemented boundaries

The former conservative 300-draw ceiling is removed. All 98 enabled catalogs
contain 1,470 enabled non-repeatable steps; each has threshold 300 and exactly
one finite, required reset prize with limit one. Source policy
`offline-event-box-v1` keeps authored weights until exhaustion, then normalizes.
After 300 completed draws, the next selection guarantees that unclaimed original
reset prize. An imported active boost is honored even before the threshold. On
claiming the prize, boost clears and the remaining batch returns to ordinary
weights; an exhausted special is never restored. Original quantities/IDs/costs
and windows are unchanged. **This is an explicit offline guarantee policy, not
the recovered publisher's activation/odds/guarantee/RNG formula.** Existing
variation indicators are retained; unknown publisher arrow semantics are not
invented. At this earlier milestone, an imported positive step-level lap could
be read and carried through another draw only on an original repeatable step,
after every required reset
prize has a saved content lap at least that high. This is a source-only offline
preservation boundary, not proof of the publisher's step-lap producer. Nonrepeatable
step laps, a step lap ahead of its reset prize, and contradictory disabled-catalog
boosts still refuse. The deferred event-box case covers a saved reset followed by
a positive-step-lap draw; it has not been run or checked in MuMu.

Exact `2413ed4` consumes a server-supplied boost flag; `283e924:283ea04` writes
its protected boolean. New serial read-only Ghidra artifacts
`.work/event-box-boost-state-exact-20261006.txt` and
`.work/event-box-boost-counter-ui-exact-20261006.txt` completed with exit 0.
The latter's apparent slot-five UI reads are character-spine setup, **not boost
coefficients**. Earlier `boxStats`/`boxLaps` labels in the range scratch file are
not semantic evidence: `2413374` inspects bonus configuration and `2413958`
checks availability. The original client trace supplies response/state shape,
not a hidden publisher selection formula.

Source accepts positive integer draw counts through 100 for ordinary boxes,
including smaller affordable clamped counts, and retains the native 10 limit
for all three bonus-item boxes. Request and receipt validation share that limit.
The existing sequential selection, original costs, finite depletion, boost
transitions and compact before-state capture handle the entire batch inside the
existing SQLite transaction; there is no new queue or schema. A bulk receipt
missing its policy capture cancels with the real queue retained rather than
being interpreted as a legacy draw. Native limit evidence is in
`.work/event-box-draw-size-exact-20261006.txt`, completed serial read-only with
exit 0; constructor/constants were also read directly from the unchanged ELF.

Permanent `event_box_transport` uses a SQLite primary key for the actual native
request ID/sequence, MD5 of received bytes and original operation ID. It commits
with cost/prize reservations, the single queue, sequence and reply, and remains
after ACK removes the temporary `event_box_request`. Exact pending retries use
the original validated draw without RNG reroll or another debit/grant. A changed
payload, field-order encoding or route cannot reuse that identity; a different
hash header cannot relabel the received bytes. An untouched new request identity
for the same pending body aliases that one operation and is itself retained.
The cached draw reply also uses the received-byte hash.

The permanent guard runs before generic caches and session sequence checks.
After ACK, cache/login eviction or native done-history cleanup, an old identity
cancels with 3000999 instead of issuing a new draw or redirecting to a newer
pending draw with the same body. Partially saved effects still use the shared
delivery guard and preserve the queue until full ACK. An untouched pending draw
can recover after original expiry. Missing/corrupt temporary receipts cancel
both exact and new-identity pending requests; legacy cached replies without a
permanent identity retain their real queue and require reconciliation. Historical
bindings already absent from **both** cache and permanent history cannot be
reconstructed; this additive change does not invent their original wire bytes.
The existing receipt and save helpers are reused; there is no native profile,
currency, signature or queue pre-credit and no extra gameplay queue.

Only `UserEventBox`, `UserEventBoxStep` and `UserEventBoxContent` accept native
owner 0 or the local player's ID. Raw rows and tokens are retained; ticket and
reward inventory ownership is not relaxed. Step saves are typed and preserve
draw/lap history. ACK also requires the saved boolean boost flag.

Existing pending receipts derive pre-draw ticket, counter and acquisition
baselines. Additive SQLite migration `event_box_request.effect_seen` records any
changed saved component inside the ordinary save transaction. It survives later
funding and restart. A save reply then omits operation 15000; other redelivery
cancels through recovery code 3000999 until ACK/reconciliation. The real queue,
reward entitlement and complete cost/counter/inventory ACK checks remain intact.
Missing or contradictory legacy receipts are not guessed or discarded.

Additive `event_box_request.draw_state` records policy version, original step
hash, typed before-step and compact before-prize counters. Receipt validation
replays recorded choices against eligible weights without rerolling RNG, checks
the complete after-step, selected counters and exact displayed rates, and retains
unreconciled captures. Replay observation compares against the **before** boost
flag; false-to-true and true-to-false queued targets are not already-saved effects.
Flag-first native saves suppress additive delivery but still require every cost,
counter, bonus and prize ACK proof. Earlier untouched normal receipts remain
recoverable within their former boundary; an uncaptured legacy boosted draw is
not reinterpreted using this new policy.

For the three bonus boxes, additive receipt columns `bonus_state` and
`bonus_seen` retain the owned before/target amount and cumulative acquisition.
They commit with the existing queue, cost, counts, prize reservations and reply;
no new wire bonus field, extra chosen prize or inventory pre-credit is introduced.
Positive bonuses reuse the indexed ordinary acquisition ledger. Negative/zero
adjustments retain their captured absolute target rather than inventing a gain.
An existing unchanged balance needs no fresh acquisition proof. New zero rows,
negative adjustments and capped positive gains require an exact saved amount
observation once. Unsaturated positive cumulative gains can prove a bonus spent
before its first save. After observation, legitimate spending is allowed while
the acquisition proof remains; deletion/rewind cannot acknowledge or redeliver it.
A saturated lifetime count already present before a draw is not an observed effect.
Shared item producers serialize the same bonus item until ACK, including zero or
negative replacements; prior pending acquisitions must settle first. Other items
are unaffected. Missing/corrupt legacy bonus baselines cancel with the real queue
retained. The original `193000095` start/end timestamp is identical; its one-second
window is intentionally retained, not silently widened.

Cached show responses must match the current pool or the pending captured pool;
old odds cannot restore an exhausted prize or overwrite a saved active boost.
Cached binary pulls of box/ticket or indexed prize-inventory tables must match
current data. Cached confirmations cannot hide pending delivery or newer saved
tokens, including after ACK; partial delivery checks consult the live queue.

## Executed protocol checks and remaining work

The complete, unfiltered `node tools/test_event_boxes.cjs` reached its final
success message and exit 0. Disposable databases cover all 98 enabled first-step
catalogs, all 1,470 boost metadata rows, costs 1/5/10, the 299-to-300 offline
guarantee transition, finite depletion, owner-zero state with strictly owned
inventory, native 100/10 batch limits and affordable clamps. All three bonus
catalogs cover absent zero, positive/negative/no-op/capped absolute replacement,
split save/ACK, pre-save spending, observation and restart. Permanent received-byte
identities cover field-order/route conflicts, pending aliases, settled retries,
cache/session/history eviction and expiry without rerolls or duplicate grants.
Eight ordinary inventory classes, two repeat laps, shared shop reservations,
partial delivery, stale pulls/confirmations and issue/save/ACK/reply rollback pass.
Synthetic funding and fast-forward saves are confined to disposable databases;
they do not establish natural earning, native execution or publisher RNG parity.

Four stale fixture expectations were corrected without changing production:
injected SQLite faults return an empty HTTP 503 without an Argo response header;
numeric costs require numeric sorting; a foreign bonus owner may be rejected by
the common delivery-ownership guard; and original Seiros product `207000009`
awards the three-star ticket `296000002`, whereas `207000010` awards the two-star
ticket `296000001`. Both actual reservation orders and rollback checks remain.
These results supersede old NOT RUN notes only for this full test; broader
shared-source regressions and every native event-box checkbox remain pending.

### Limited native gateway progression

On the unchanged installed `3d2ec724` launcher/server `624efcdc`, the separate
Adventure 16 (`eb8b83ee`) stayed at 2019-10-18. Original Event/Boost/Other tabs
were locked: `system_flag.feature.event_quest` requires original `stage_014`,
Bell 2-10 (`1010000102110`). Active original box `193000031` costs 10 of
`290000267`; the test save has no event tickets. No flag, ticket, clock, funding
or native SQL injection was used to bypass eligibility.

Normal Bell 2-2 (`1010000102102`) entry and saved auto-battle completed three
real BattleEnd saves, story/result/CP/first-clear screens and unlocked Bell 2-3.
Actual stage request sequence 21201 issued operation 5000 ID 20; real
AdventureComplete push 21202 saved its effects and ACK. Result showed S/three
stars, 784 Valis, two ordinary falna and original first-clear End.Falna(S) x2.
The latter maps to `294000004`, not an invented Iris award. Each battle turn was
not visually observed; this is a bounded completion/save case, not combat parity.

Normal Tools Stop left no game PID or listener 28766. Read-only copied SQLite
`event-box-native-stopped-20261007.sqlite` has integrity ok, queue 0, retained
ACK 20 and one completion/floor (clear count 1, all three tasks). It retains
rank 3, EXP 961, SP 108, Valis 51,804/cumulative 63,804, free Iris 3, all six
actual CP targets and the four indexed item acquisitions. Cold title/town
retained SP 108/Iris 3/Valis 51,804; cold Bell Pt.2 selection also shows Bell 2-2
Clear/S and Bell 2-3 NEW. These are gateway/save proofs, **not native
event_box/show or event_box/draw acceptance**. S-result shows three-star Iris 3
plus S-clear Iris 1 while the wallet changed 0 to 3; this display/accounting
boundary remains unresolved and no guessed extra award was injected.
After the cold stage-selection check, a second normal Stop and separate read-only
`event-box-native-cold-stopped-20261007.sqlite` match the first copy's queue,
ACKs 18-20, operation-20 completion/floor, player totals, wallet, Valis, both
stage rows and all saved CP tracks. There is still one clear, not a replay grant.
Final normal Stop left no game PID/listener 28766. Native Saves selection restored
only next-launch metadata to Adventure 5 (`d8924112`), 2022-08-20; Home shows
Offline/19 profiles. Its original database was never read, opened or launched.

Unfinished: publisher boost/variation/guarantee/RNG parity, native acceptance of
the explicit offline policy, shared-ticket effects and hypothetical
overlapping chosen/bonus pools, natural
earning/unlocks/traversal, calendar restoration and expired-row cleanup,
uncaptured reward-source interleavings, legacy identities already missing from
both cache and history, legacy reconciliation, native art/signatures/effect-save-ACK
ordering, usable back navigation, no-crash/ANR proof and measured efficiency.
Nonpositive/capped bonuses spent before any exact observation still require
reconciliation; book-entry/signature transitions and the actual native dirty-row
order have not been accepted. The recovered formula is not native acceptance.

## Permanent settled draw replay (source only, 2026-10-13)

The permanent received-byte identity no longer loses every usable result after
the real operation15000 acknowledgement. A new `event_box_delivery` row is
inserted in the same SQLite transaction as ACK settlement, before the queue and
temporary non-Valis request receipt are removed. It contains the canonical
signed operation and the finalized receipt after all saved-effect, bonus,
capped-stock/date and Valis observations have been recorded. Failure to retain
that archive rolls back the ACK and all accompanying profile changes.

An exact request retry has two exclusive states. A queued operation uses the
existing pending receipt and remains subject to the existing no-reroll and
partial-save guards. A done operation must have a canonical archive, no queue,
the original body hash and draw body, monotonic saved box/step counters, the
lap-aware claim-ledger targets, every lifetime reward acquisition, every capped
reward observation and any required Valis credit observation. A surviving
Valis request receipt must byte-for-byte match its archived final row. The
settled response contains the original result fields but an empty operation
list and no singular operation, so the client can show the result without
reapplying ticket consumption, counts, bonus or inventory.

Missing or corrupt archives, missing counters/claims/acquisitions, and both or
neither queue/done states cancel without mutation. An old request stays bound
to its own archived draw even when a newer request has the same decoded body.
Legacy settled draws created before this archive existed are not inferred from
current inventory. Deferred fixtures cover archive/ACK rollback, exact and
alias replay after cache/session/restart/expiry, operation/receipt corruption,
lost archive/done state, queue/done ambiguity and an old identity beside a new
pending draw. They are WRITTEN ONLY / NOT RUN. No build, listener, APK, ADB or
MuMu action was performed, and native result presentation remains unverified.
