# Alarm-voice item inventory and reward handoffs

## Current source milestone — PARTIAL / UNTESTED (2026-10-10)

Implementation only. No tests, smoke/static acceptance checks, generators,
builds, packaging, listener restarts, emulator/ADB checks, workers or Actions.
No actual player save was opened or migrated; earlier DDL remains UNAPPLIED.
All packets and variants precede consolidated testing; co-op remains last.

## Original client contract

Original EU15.1.0 ARM64 dispatch27f8ab8 calls reader280699c:2806c98.
It consumes exactly seven fields: `userId`, `alarmVoiceItemId`, `amount`,
`reservedAmount`, `bookEntryState`, `signature`, `cumulativeAmount`.
There is no voiceId, timestamp, reset field or dateList in this inventory row.
Setter2846444 uses UInt8 book state;2846528 uses UInt32 signature, not a byte.

Factory24372d0 and constructor2845ec4 initialize book1 and all other serialized
values0. Owned-row construction2436b2c:2436c50 assigns the actual player and
original item ID, sets amount/reserved0 and inserts through26e8334. The server
does not manufacture that row or grant stock before the native save.

Domain constructor243660c resolves item_type.alarm_voice_item through244c118.
Its original itemType200000026 has stock maximum999999999. Vtable42b3db8
uses direct getter2436ed0, setter2436ee8, ordinary gain24d8844,
maximum24d8d6c and lifetime24d8d94. Setter2436ee8 forwards the whole incoming
signature to2846528 and skips only zero; there is no expiry/reset behavior.

## Original data retained

alarmVoiceItem.enc contains one item217000001, key alarm_voice.item1.
The recovered shop catalog has67 standalone offers for it, all quantity1,
priceType2/event-item price3, no purchase limit and their original windows.
The first is207001822, cost item290000231,1560909600..1565157599.
There are no linked-pack offers or final event-box prizes; none are fabricated.

Original non-War-Game mission6010000009 rewards10, category1/rewardType17,
window0..1526630400. The source uses that original reward and eligibility window,
not a new mission or current-date entitlement.

## Shared implementation

The existing strict seven-field inventory validator now includes this class;
stock/reserved/lifetime are bounded, book retains its full native byte range and
signature retains its UInt32 range. User-data push checks actual master IDs,
ownership and unique rows, including when no reward is currently queued.
Malformed incoming rows are refused without changing the saved profile;
incomplete retained legacy rows are kept and require reconciliation.

The shared2000/6000/9000 cap capture and actual-save effect machinery handles
Present, mission and all original shop products of this class. It retains the
original quantity/full signature, excludes old signatures, bounds positive stock
additions, closes allowance on native observation, does not refund spent stock,
requires full mixed ACK and writes profile/receipts/queue/reply atomically.
Completed checkpoints protect against restoring or rewinding acknowledged stock.
No new inventory, wallet, schema, signing bypass or native precredit is introduced.

## Deferred cases — WRITTEN ONLY / NONE RUN

349 new cap scenarios are written: seven Present save orders, seven mission
save orders for6010000009 and all67 original shop products times five save orders.
Six standalone malformed/duplicate save cases and native field/width refusal
variants supplement those scenarios. They cover missing reserved fields, alternate
IDs/date/reset fields, book255/full old signatures, signed additions/capture
corruption, partial spending/allowance closure, flags/full ACK, all rollback phases,
cold/exact retries, once-only shop payment and completed stock restoration refusal.
Generic producer fixtures preserve the native reserved/book/signature fields.

The mission batch now has115 numeric/mixed base scenarios plus nine additional
Memoria missions; the131 dated-ticket scenarios remain separate. These numbers
describe written scenario loops, not executed or native-accepted coverage.

Synthetic Present provenance, funding, mission eligibility and save ordering do
not prove natural earning or application. Alarm voice selection/playback/scheduling,
stock consumption, other producer constructors, coalesced/legacy saves and native
signatures/order/UI/recovery/performance/no-crash/no-freeze evidence remain
unfinished or unverified. Route counts remain125 partial/50 unsupported;
no route or complete alarm feature is claimed finished.
