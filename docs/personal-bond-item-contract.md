# Personal Bond inventory handoffs

SOURCE ONLY / PARTIAL / UNTESTED. No tests, acceptance checks, build, installation,
listener restart or actual player-save changes. This extends existing packets,
not a new route or proof that gacha or character upgrades work.

## Original client

Pristine15.1.0 ARM64 dispatch27f4214 calls263f970:263fc14. The exact six fields are
userId, limitBreakItemId, amount, bookEntryState, signature and cumulativeAmount.
There is no reservedAmount, dateList, reset/acquisition timestamp or
generalLimitBreakItemId alias. Book263ea38 is UInt8; signature263eb1c is full
UInt32, not a byte or signed31-bit value. Constructor263e5dc initializes book1
and the other serialized fields0. Owned insertion2385664:2385778 assigns the
actual player, original master ID and zero stock before26bb49c.

Domain2385284 uses item_type.limit_break_item. Original itemType.enc identifies
200000020/maximum999999999. Vtable42ae540 maps direct stock2385b04,
stock/full-signature setter2385b1c, ordinary gain24d8844, maximum24d8d6c and
lifetime24d8d94. Setter skips only zero signatures; there is no dated/reset rule.

## Source handling and original data

Strict owned, original, unique six-field rows are required at save boundaries.
Malformed incoming rows refuse400; malformed retained baselines refuse503
without repair. All784 original IDs share existing2000/6000/9000 capped captures,
bounded positive additions, spending closure, actual issued signature/capped
lifetime effects, full mixed acknowledgement, transactional writes and completed
stock protection. No new ledger, schema, wire, issuer, master rewrite or native
precredit. Lottery1000/1001 validates its absolute queued target, saved row and
issue baseline with the native contract; absolute semantics remain separate.

limitBreakItem.enc:784 rows, source SHA-256
e8bcd2e13386b83eb881b6c4f010a64528af6b9596d0b579710d1560999e6d21.
Thirteen original non-War-Game missions award one bond each for299000443,
299000558 or299000625; all original IDs and windows are retained.

The542 standalone offers award one bond:491 allow one purchase,48 allow two,
two allow three and one allows five. Costs use original Event Items or Key
Items. There are no linked personal-bond packs or final event-box prizes in the
recovered catalog; none were invented.

## Deferred cases

WRITTEN ONLY / NONE RUN:2808 cap scenarios, comprising seven Present save orders,
13 original missions times seven orders and542 original offers times five
orders. Additional cases cover six malformed/duplicate pushes, native widths,
corrupt captures, spending closure, full mixed ACK, rollback, cold-exact retries,
completed restoration refusal and exhausted original one-purchase limits.
test_gacha_persistence.cjs also retains book255/full UInt32 signatures and refuses
malformed queued absolute targets; stage/feature fixtures omit reservedAmount.
These synthetic unexecuted cases are not native earning/application proof.

## Unfinished

The newer gacha-persistence-contract.md absolute-stock follow-up adds source-only
saturated1000/1001 targets, actual-operation signatures, captured stock allowance,
partial-save/spending suppression and completed saturated-stock protection.
Its128 new cases are WRITTEN ONLY / NONE RUN; ordinary caps alone did not prove
that branch. The 2026-10-14 source follow-up also rejects a stock decrease before
any pending absolute-setter field is observed, retaining the original receipt;
its positive-stock cases are WRITTEN ONLY / NONE RUN. Legacy/coalesced recovery,
complete character enhancement/consumption,
coalesced/legacy callbacks, other constructors/producers and native
signing/order/UI/clock/recovery/performance/stability remain incomplete/unverified.
General/Prism bonds have a separate contract.

Audit125 partial/50 unsupported unchanged; earlier DDL source-only/unapplied.
All149 packets/variants precede consolidated server/emulator acceptance; co-op last.
