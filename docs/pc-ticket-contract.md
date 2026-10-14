# PC selector tickets and original shop exchanges

Latest source follow-up: [ordinary gacha-ticket rewards](gacha-ticket-reward-contract.md)
extends shared constructors/Presents and mixed recovery. Deferred contexts now
1599 dedicated/178 mixed-shop, all WRITTEN ONLY / NONE RUN. Earlier912/146 totals
and missing ordinary-ticket constructor notes below are historical.

SOURCE ONLY / PARTIAL / UNTESTED — 2026-10-10. This is implementation evidence,
not native acceptance. New DDL is UNAPPLIED; existing saves and the listener have
not been opened or changed. No tests, acceptance checks, builds or emulator work.

## Present follow-up — SOURCE ONLY / PARTIAL / UNTESTED

Original2000/248cbb8 reaches its independent item loop248d2e8. Empty iteration
248d36c bypasses item gains; ordinary lookup248d3c0..248d3d4 reaches the item's
vtable+50 at248d470..248d484 with the full original quantity and actual nonce.
The PC class uses the same24d8844 gain and evidenced263a11c/23829a0 constructor
already described below. Later248daa0 repeats only state1 for an existing gift,
or skips a removed gift; it is independent of the omitted item iterator.

Fresh isolated PC Present rewards now use existing `gift_item_claim.gacha_state`
with private `offline-gift-pc-ticket-first-v1` or `offline-gift-pc-ticket-v1`.
First state is exact empty dates/book1/signature0/lifetime0 and is never written
to the native profile by issuance. Owned rows preserve actual signed flags and
UInt32 signatures. Full original quantities, clamps, bounded date additions,
actual nonce and lifetime observation use the shared dated helpers; first
observations also require book3. Other same-item producers/payments wait for the
actual Present ACK. Legacy/coalesced history is not promoted into a fresh capture.

Pure PC-ticket Presents, including more than one of the three original classes,
now share cold login/pull/confirm recovery. Original claim IDs/source fields and
quantities must match; only fully observed item rows are omitted. Untouched
positive quantities remain unchanged. Incomplete nonce/lifetime/date prefixes
refuse without guessing a remainder. Unclaimed/claimed/deleted native gift flags
remain independently guarded, and full native inventory plus actual claim flags
are still required for the real2000 ACK. Hot partial retries refuse and save
replies still withhold partially applied callbacks. Existing cache validation
permits only the exact original or exact derived envelope, not zero-quantity rows.

Completed PC Present lifetime reads now use the existing item/table/cumulative
index, one bounded seek per original PC-ticket ID. Missing native rows or a
rewound lifetime refuse with the save retained. Profile/capture/queue/done/reply
writes reuse the current transaction. No new schema, fabricated gifts/mission
rewards, inventory precredit or fake ACK were added in this follow-up.

152 NEW WRITTEN ONLY cases extend `test_pc_ticket_inventory.cjs` to912 contexts:
126 first/owned/all3 classes/seven prefixes/three native flag states;24 three-class
saved-subset/flag combinations;two PC+Iris/SP partial cold refusals. Future probes
cover original/derived cache/restart, actual ACK and rollback, typed row/source
loss, restored spent dates, completed missing-row reads and retained mixed
handoffs. Existing generic gift fixtures now carry the actual PC nonce.
NONE EXECUTED; synthetic Present rows are not original earning/provenance proof.

This supersedes earlier first-PC-Present/ordinary-PC-capture/pure-PC-cold gaps,
not all first rewards outside shop. PC mixtures with other reward classes,
remaining legacy/coalesced/constructor/producer/order/UI branches and actual
native acceptance remain incomplete. Counts stay124 partial/51 unsupported.

## Original contract

The pristine ARM64 library is
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
`N6toybox14DomainPCTicketE` has vtable42ae308; its stock getter is2382f08,
setter2383310, and ordinary gain24d8844. Serializer263aff0 and reader263b340
agree on exactly six fields:

- `userId`: actual local owner.
- `pcTicketId`: original signed-int32 ID.
- `dateList`: entries with the original spelling `{aquiredAt}`.
- `bookEntryState`: signed byte, not an unsigned generic item flag.
- `signature`: UInt32, not a signed-int32 inventory signature.
- `cumulativeAmount`: original lifetime acquisition counter, capped999999999.

There is no `amount`, `reservedAmount`, `lastResetAt` or `gachaTicketId` alias.
Malformed/duplicate/foreign retained rows refuse without deleting or repairing
the save. Owned signed flags and full UInt32 signatures are preserved.

Original `pcTicket.enc` SHA256 is
`cb4c0c690fe465fdc164d2e9f65f176f2eba84f7e9b3f30cf00a4b8ce102bfb2`.
Its three rows297000005/297000006/297000007 are adventurer/assist/limited
selectors; slot4 is2592000 seconds for each. The getter compares current time
against acquisition plus duration and removes the entry at equality
(2383028..238302c). It writes the retained list through2383178; the setter adds
current-clock dates23833a8 or removes the front238359c, then applies the actual
signature263acc8. Spending/expiration does not reduce lifetime acquisition.
Common gain24d8844 forwards the untouched positive quantity and signature,
changes book1 to3, and clamps stock/lifetime using the original limits.

## Shared implementation

The existing dated inventory/capture/effect helpers now admit the PC class with
its own exact ID field. Shared shop, Present, stage and mission cap paths retain
the original quantity, bounded date multiset additions, actual signature and
saved lifetime observation. Shared read/save guards reject removal, lifetime
rewind, and restoration of spent/expired entries without an original acquisition
allowance. Event-clock changes do not recreate entries already removed by a
native save. No PC-ticket mission or lottery cost has been invented: the retained
catalog contains neither. This does not broaden selector units into gacha prizes.

Owned shop tickets use the existing cap/ordinary dated captures and source-bound
checkpoint. The indexed same-item reservation requires actual reward ACK before
another producer or ticket-priced purchase can reuse that item. Unrelated
inventory remains independent. Existing cold login/pull/confirm preserves full
untouched grants and omits only fully observed ones; incomplete field effects
remain unavailable rather than generating a guessed remainder or fake ACK.

## First shop reward

Original23829a0 calls2383b64/2383bac/263a11c for an absent row, assigns actual
owner263a290 and original ID263a36c, then inserts26b96d4. The no-JSON constructor
263a11c starts with empty dates, book1, signature0 and lifetime0. The JSON-capable
constructor263b84c has the same defaults before import.

Fresh isolated absent PC-ticket shop rewards now retain private
`offline-shop-pc-ticket-first-v1` in the existing claim and bound reward receipt.
The baseline must be exactly zero lifetime/signature and empty dates for one of
the three original IDs. This is not a server-written `UserPCTicket` row. A missing
row is admitted only before any reward effect; after an effect it must remain.
Actual constructor saves may carry book1/3, but book3 cannot rewind and the first
reward is observed only with book3 plus its actual nonce and full lifetime target.
Other bundle rewards, purchase count/date and the real9000 ACK remain mandatory.
The existing indexed shop floor advances only inside that actual ACK transaction.
Lost/changed policy or source markers refuse, not backfill old receipts.

## Selector-ticket expenditure

The retained catalog has529 original unit shop products priced in these tickets:
229 adventurer,124 assist and176 limited selectors. Each costs one ticket and
uses its original selected unit/window. Six zero-length offers207002718 through
207002723 remain inactive; the other523 retain their original nonempty windows.
Their separate1000/9000 unit/purchase
handoffs still require native saves and real acknowledgements.

`TicketShopBuy`/other existing shop save triggers now capture actual before/after
PC date multisets in private `shop_spend.ticket_state` with
`offline-pc-ticket-shop-spend-v1`. Only removed unexpired entries count as payment
at the captured event-clock time. Expiry cleanup, another feature's save trigger,
coalesced gains/replacements or missing dated proof cannot mint payment. Price,
item/table/owner, unchanged lifetime, exact count difference and original dates
are revalidated by the shared purchase receipt. Recovery never charges again.
The column is SOURCE DDL UNAPPLIED; old numeric aliases have no guessed backfill.
Profile, receipt, queue, actual ACK and reply-cache writes remain transactional.

## Deferred cases and remaining work

`test_pc_ticket_inventory.cjs` contains760 WRITTEN ONLY contexts:21 synthetic
capped Present prefixes across all three native classes,523 original selector
costs plus six inactive-window refusals, and210 first-pack prefixes across all30 nonempty original PC-ticket pack
windows. Both zero-length offers remain inactive. The first-pack cases retain
other unfinished bundle handoffs; they are not full unit/bundle acceptance.

`test_shop_mixed_recovery.cjs` now has146 WRITTEN ONLY contexts:132 ordinary,
eight capped selector-ticket equipment-bundle prefixes, four first-ticket bundle
prefixes and two linked-voice prefixes. These supersede the earlier134-case
uncaptured207004301 limitation. Existing shop/gift native-shape fixtures were
updated. Future checks include spent-date restoration/removal, expiry at equality,
foreign triggers, rollback, restart/cache, source loss, same-item interlocks,
actual full bundle ACK and post-ACK checkpoint retention. NONE EXECUTED.

First PC rewards outside shop, absent GachaTicket constructors, coalesced/legacy
captures, unfinished unit/board/voice/story branches and other producer resets
remain incomplete. Original earning, native save/signature/clock order, selector
UI, crash/freeze/performance and full-game acceptance remain unverified. Route
counts stay124 partial/51 unsupported/zero feature-complete; co-op remains last.
