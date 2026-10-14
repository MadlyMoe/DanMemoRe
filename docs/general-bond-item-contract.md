# General Bond and Prism Bond inventory handoffs

SOURCE ONLY / PARTIAL / UNTESTED. No tests, acceptance checks, build, installation,
listener restart or actual player-save changes. Not full Prism exchange,
character limit-break or subscription acceptance.

## Original client

Pristine15.1.0 ARM64 dispatch27f6524 calls26415bc:2641860. The exact six fields are
userId, limitBreakItemId, amount, bookEntryState, signature and cumulativeAmount.
The ID is not generalLimitBreakItemId. There is no reservedAmount, dateList,
reset or acquisition timestamp. Book2640684 is UInt8; signature2640768 is full
UInt32. Constructor2640228 initializes book1 and other serialized fields0.
Owned insertion2539cbc:2539e20 assigns actual player/original master ID, zeroes
stock and inserts via26d0b18.

Domain2539948 binds item_type.general_limit_break_item. Original itemType.enc
identifies200000022/maximum999999999. Vtable42be9f0 maps direct stock253a15c,
stock/full-signature setter253a174, ordinary gain24d8844, maximum24d8d6c and
lifetime24d8d94. Setter253a1ac/253a1c0 forwards all nonzero signature bits.
No expiry/reset rules were invented.

## Source handling

All nine original IDs require unique owned six-field rows. Unknown IDs are not
accepted under a general-bond profile. Malformed retained rows refuse503 without
alteration; malformed pushes refuse400. Existing2000/6000/9000 ordinary rewards
now capture capped stock/bounded additions/spending closure/actual signature and
capped lifetime effects/full mixed ACK/transactional saves/completed guards.
No schema, wire, issuer, master rewrite, new ledger or native precredit.

fullSubscriptionItem now uses the actual original profile for general bonds,
allowing book0..255 and signature0..4294967295. Subscription/gacha ticket rules
are unchanged. The two28100 shard exchanges retain their separate absolute
replacements, captured baselines, original cost/dates, shop counters, effects
and persistent retries. Native23e0338:23e0628 imports lower-case
userGeneralLimitBreakItem through2640d10, not ordinary positive gain.

## Original catalog and deferred cases

generalLimitBreakItem.enc: nine rows, source SHA-256
75029ea5dfabcff875bef5af07532d1cb4a41be8212a6ffbbeab706291463fd3.
IDs291000002/3/5/6/7/8/9/11/12. No original non-War-Game missions or final
event-box prizes for this class; none were invented.

Thirty-four standalone offers: six unlimited Key Item offers,24 one-purchase
Event Item offers, two monthly one-purchase currency offers and two unlimited
dated Subscription Ticket exchanges. Each original quantity is1. The32 ordinary
offers retain their original costs, limits and windows.

Ninety-four original packs link to94 paid-currency products:91 allow one
purchase, two allow two and one allows three. Full mixed contents are retained,
including packs containing two different general bonds.

WRITTEN ONLY / NONE RUN:505 new ordinary cap scenarios, comprising all nine IDs
times seven Present orders (63),32 original offers times five orders (160) and
94 paid mixed packs times three orders (282). Additional cases cover six
malformed/duplicate saves, native widths, capture corruption, partial spending,
full mixed ACK, rollback, cold-exact retries, once-only payment and restoration
refusal. Both original28100 products have deferred full UInt32/book255 issue-save-
reopen cases,13 malformed original baselines and corrupt full-row targets.
Synthetic unexecuted inputs are not native provenance/earning/order/signing proof.

## Unfinished

The newer subscription-contract.md Prism capped full-row follow-up supersedes
the earlier saturated28100 refusal and missing split/spent-save handling only.
Its283 deferred scenarios are source-only/UNTESTED; nullable receipt DDL is
UNAPPLIED and old unknown captures remain retained. Ordinary caps alone are not
absolute exchange support. Unsafe spending before untouched imports, legacy
recovery, additional exchange interleaving, character upgrade consumption, other
constructors/producers, coalesced/legacy callbacks and native
signing/order/UI/clock/recovery/performance/stability remain incomplete/unverified.

Earlier DDL source-only/unapplied; audit125 partial/50 unsupported unchanged.
All149 packets/variants precede consolidated acceptance; co-op remains last.
