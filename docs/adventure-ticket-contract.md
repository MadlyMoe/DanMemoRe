# Adventure Ticket inventory, rewards and reset handoffs

## Current scope — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-12)

The shared inventory guard now consumes the original seven-field
UserAdventureTicket row. Non-replenishing ticket rewards join existing capped
Present2000, mission6000 and shop9000 delivery/save paths. The four scheduled
tickets now have combined, split and original first-use constructor140000 reset save handling in source. This
is not complete Adventure Ticket gameplay or native acceptance.
No save was read or changed; no listener, test, generator, build or emulator ran.

## Coalesced reward then scheduled reset — newer partial source milestone

Original positive gain raises the lifetime counter and changes a new book1 row
to3 before the independent `23f89b8` reset replaces stock with one, writes the
reset-token signature and advances `lastResetAt`. A final native row can
therefore contain the reward lifetime counter but the reset stock/signature.

The reset planner now admits that exact combined row only when the shared
acquisition reservation proves every pending same-item reward and the saved
counter equals its final reserved target. Hash-bound policy
`offline-adventure-reset-v2` retains the actual before row, final cumulative
target, reset token/time and actual final row. The ordinary reward remains
queued until its own saved flags and real ACK; the reset path neither settles
nor recreates it. Missing/partial/extra lifetime gain still refuses.

The deferred reset fixture now covers an exact pending Present followed by the
combined final row, plus reset-token-first followed by that same exact final
row. Both prove that the Present queue remains, and the lower-counter refusal
is retained. Token-first initially records the ordinary v1 before-state and
consumed token; the later full inventory row upgrades that same checkpoint to
v2 without another token use.

The three-save form is also represented for one exact pending Present: token,
then the completed positive-gain row with the Present signature/lifetime/book3,
then the reset row with the original reset-token signature/time. Private
`offline-adventure-reset-reward-v1` binds that intermediate row and Present
operation before the final v2 upgrade. The source must be the only pending
same-item claim and remain queued or genuinely acknowledged. Its stock may be
lower than the pre-spend maximum, including zero, because the exact lifetime
counter proves the whole reward was acquired; later saves may only spend more.
A higher stock, mismatched signature, lifetime, book or reset timestamp refuses.

These cases are WRITTEN ONLY / NONE RUN. Multiple same-item producers or
unsettled resets, other field-by-field orders,
capped scheduled-ticket semantics and other producer-specific orders remain
unfinished; no native acceptance is claimed.

## Scheduled reset save handoffs — newer partial source milestone

Original23f8530 checks the most recent enabled weekday midnight at or before
the current day, not only the current weekday. DateTime2a3a360 is Monday-first;
the EU region5 clock uses+32400 seconds at2a39624. IDs298000004/8 enable every
day,298000007 Wednesday/Saturday and298000009 Tuesday. A missed scheduled day
remains eligible when lastResetAt is strictly earlier than that boundary;
rewinding the event clock does not independently replenish stock.

Original23f89b8 consumes reason140000/value original ticket ID/empty context,
sets amount1 with the full token signature and writes the current lastResetAt.
It does not increment lifetime acquisition or change the book byte. Saved
amount0 is allowed when that one ticket was already spent before the checkpoint.

The source accepts combined, token-first and inventory-first full native row
checkpoints. Original23f8dd0:23f8e38 constructs263c64c; it initializes book1 and
zero stock/signature/lastResetAt/cumulativeAmount. Original23f7d70 assigns the
actual player/ticket IDs and inserts the row. First-use captures retain that
exact constructor and beforePresent=false, never guess existing lost stock.
An absent token-first save leaves native inventory absent until an actual
client constructor/reset row arrives; a completed observed row cannot vanish.

One private hash-bound adventure_ticket_reset row per original scheduled
ticket retains the actual owned before-row or recovered native constructor,
before presence, token signature, first
observation time, consumed-token observation and actual saved reset row. This
is not a second stock balance, native precredit, guessed constructor or
publisher verifier authentication. Verifier remains an opaque native string.
Existing item_token_used/native_delete records retain consumed signatures;
only an actual client token deletion refills the offline-issued pool.

An inventory-first row must reference its still-issued token; a later deletion
must have that same original reason/item/context and cannot consume it for
another action. A token-first save leaves inventory untouched until the actual
row arrives. Either incomplete half excludes new additive producers through
the existing shared itemAcquisitionReservation, not a scan of lifetime history.
Stock spent between halves cannot be restored. The first observation clock is
retained across a later event-clock rewind; completed checkpoints retain reset
time/acquisition floors, and the next eligible reset replaces only the latest
private checkpoint while old signatures remain in the existing token ledger.

Capture insert/compare-prior update shares the profile/token/refill/queue/done/
exact-reply transaction. Corrupt, missing or mismatched capture/token proof
refuses without discarding saves. New DDL is SOURCE ONLY / UNAPPLIED; no real
save was opened or migrated. Twenty combined, eight calendar-boundary,24
split and12 native-constructor vectors plus corruption/refusal/rollback/next-reset cases are WRITTEN
ONLY in tools/test_adventure_ticket_resets.cjs; NONE RUN. Synthetic owned rows,
token metadata, time and save order are not native earning/application/UI proof.

Other producer constructors, field-by-field reset saves, multiple resets before
the earlier handoff settles and other coalesced/capped-gain attribution remain
unfinished. Stage entry/consumption, original verifier behavior and
native clock/recovery/performance/no-crash/no-freeze acceptance remain unproven.

## Original row and gain contract

Original reader263d2b0:263d6e8 consumes userId, adventureTicketId, amount,
bookEntryState, signature, lastResetAt and cumulativeAmount. There is no
reservedAmount or dateList. Book setter263caec uses protected UInt8;
signature263cbd0 uses protected UInt32; lastResetAt263ccb0 uses protected Int64.
The source retains safe nonnegative timestamps, full signatures and byte-wide
book values, and refuses missing/extra fields or the wrong primary-ID contract.
It does not manufacture missing fields in real inventory.

Vtable42b1ff8 binds direct amount getter23f8424, setter23f843c, common gain24d8844,
max24d8d6c and lifetime gain24d8d94. The setter forwards the full incoming
signature to263cbd0 and skips only zero. Constructor23f7b98 selects
item_type.adventure_ticket. Original itemType200000019 slot3 is999999999,
recovered directly from contents/1/master/divide_enc/itemType.enc. Stock and
acquisition additions retain signed native bounds before clamping.

## Ordinary stock is not scheduled replacement

The seven original boolean slots8..14 were read directly from adventureTicket.enc;
the weekday/time-zone mapping is recovered in the newer reset milestone above.

| Original ID | Original key suffix | Replenishment slots |
| --- | --- | --- |
| 298000001 | daily_quest | none |
| 298000002 | exp_quest | none |
| 298000003 | valis_quest | none |
| 298000004 | exp_quest_one_day | 8..14 |
| 298000005 | ad | none |
| 298000006 | herocharm | none |
| 298000007 | valis_rep | 10, 13 |
| 298000008 | ad_rep | 8..14 |
| 298000009 | herocharm_rep | 9 |

Original23f8530 checks the archived weekday slots and lastResetAt against the
client clock. When eligible,23f89b8 consumes an item token with reason140000
through25b0d30, calls the stock setter with amount1/full token signature and
writes the current Int64 timestamp. It replaces stock; it does not call the
ordinary positive lifetime acquisition path. The newer milestone supersedes
the combined/token-first/inventory-first eligibility/calendar gap only;
constructor, field-split and coalesced replacement/reward order remain
unfinished. The four replenishing IDs therefore do not gain ordinary capped
stock support merely because they share the same item type. No fake reset,
native signature, timestamp, token or stock precredit was added.

The five non-replenishing IDs reuse owned before-stock/full-signature capture,
positive-addition allowance, spending closure, actual issued-signature
observation, mixed reward/flag ACK, atomic save and completed-stock checkpoints.
Legacy capped receipts without original capture still require reconciliation.
This adds no schema, wire, issuer, inventory ledger or original master rewrite.

## Original rewards and deferred cases

The imported original catalog has172 standalone offers, no linked packs and no
final event-box prizes of this class. Its107 non-War-Game mission entries reward
daily_quest86, valis_quest17, exp_quest3 and herocharm1. Quantities, prices,
limits, availability windows and mixed-reward behavior are unchanged.

112 added cases are WRITTEN ONLY / NONE RUN:

- 35 Present cap orders: five non-replenishing IDs times seven save orders.
- 28 mission cap orders: actual6020000113,6020000114,6050000015 and6050000122
  quantities1,1,2,1, each with seven save orders.
- 45 shop cap orders: original207000002..207000007 Iris-priced offers and
  207000035..207000037 event-item-priced offers, each with five save orders.
  Original one/eleven-ticket quantities,10/100 Iris or60 event-item prices,
  limits and windows are retained; partial/cold/exact retries must not recharge.
- Four replenishing-ID ordinary reward/native-width/timestamp cases retain
  timestamps and refuse unsupported cap semantics without mutating inventory.

Cases include malformed native fields, full signatures, capture corruption,
partial spending/allowance closure, flags/full ACK, issue/save/ACK rollback,
cold-cache/exact reply and completed restore/rewind/deletion. Shared stage,
feature, Element and mission/Present constructors were updated only in deferred
fixtures. Synthetic gifts, funding, eligibility and save order are not native
earning, application, reset or UI proof.

Other inventory types/producers, unfinished reset140000 branches, stage entry/consumption,
constructors, coalesced/legacy delivery and native clock/recovery/performance/
stability remain unfinished or unverified. Counts remain125 partial/50
unsupported, with no complete routes claimed. Earlier DDL remains SOURCE ONLY /
UNAPPLIED; all149 packets/variants before consolidated testing, co-op last.
