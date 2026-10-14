# Equipment delivery and native slot persistence

Latest SOURCE ONLY / UNTESTED [ordinary-ticket follow-up](gacha-ticket-reward-contract.md)
adds32 first-dated mixed-shop prefixes/all8 original ordinary-ticket mixed offers;
the fixture now178 WRITTEN ONLY contexts. Native gear piece/slot/full-ACK proof is
unchanged; NONE RUN. Earlier146-total/missing ordinary-ticket notes are historical.

## PC-ticket bundle follow-up — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Original207004301 now retains an owned/capped or evidenced first PC-ticket
capture alongside its unchanged two gear grants and original item quantities.
The shared146-case mixed fixture replaces the earlier134-case/uncaptured-ticket
description, adding capped and first-ticket count/date/reward/all-save prefixes.
Gear slot construction, actual full ACK and native gameplay remain deferred.
See [pc-ticket-contract.md](pc-ticket-contract.md); no tests or DDL applied.

## Shop cold recovery follow-up — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Shop9000 can now omit a completely observed original equipment grant while
retaining untouched original grants and independent purchase count/date.
Distinct original piece snapshots remain authoritative after sales or changes;
no count-based backfill or gear restoration. Incomplete per-grant quantities
still refuse rather than emitting a guessed remainder. Equipment observations
must exactly match the indexed permanent piece keys for their operation; erased
observations with surviving bindings, missing/rebound bindings or orphan proof
refuse. New operation/piece-key index is SOURCE DDL UNAPPLIED, not a new table.
Shared save/index/profile/ACK/queue/cache transaction is unchanged.

134 NEW WRITTEN ONLY mixed-shop cases include all16 pure equipment offers,
captured costume/item mixtures and four explicitly unavailable prefixes of
original207004301 (uncaptured PCTicket). Gear baselines, unique slots, recorded
sales, source/index loss, cached bytes/restart and actual ACK/rollback are
deferred. Native construction/allocation/timing/callbacks/gear features remain
unverified. Present2000 cold semantics are not broadened. Full contract and
remaining gaps: shop-reward-contract.md. No tests/build/restart/emulator; actual
saves untouched/no feature-complete claim/co-op last.

This implementation is **SOURCE ONLY, NOT RUN, built, installed or accepted in
MuMu**. `node tools/test_equipment_rewards.cjs`, updated master/gift/shop checks
and the wider save/recovery/character/item batch are deferred. No actual player
profile or emulator was touched. Native crafting, equipment sales, awakening,
reroll/stat/RNG and all client UI acceptance are not proved by synthetic saves.

## Original client evidence

Original15.1.0 ARM64 SHA-256:
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
All addresses are raw, without Ghidra's`0x100000` bias.

- Gift2000 `248cbb8:248e09c` reads `receivedEquipments` entries as int64
  `equipmentId` and int32 `amount`. It distinguishes the original
  giftParameterizedEquipment table (`29b9ad8`) from ordinary equipment.
- Ordinary creation `2584ea0:258500c` resolves the equipment, allocates a slot,
  initializes its abilities and performance, updates derived state and inserts
  each piece separately. It does not increment a stackable amount. The shared
  creation chain `23016f4` -> `230173c` -> `28399c4:2839f9c` initializes saved
  rarity0; the ordinary evolve0/force0 call skips the rarity setter. Requiring
  original base rarity here would reject an untouched ordinary native piece.
- Preset creation `258500c:25852ec` resolves original preset slot2 equipment ID,
  writes performance9 (not level9), applies slot3 evolution count and each
  nonzero slot4..8 ability override, retaining original defaults for zero
  overrides. Evolution `259b78c:259b8b4` writes rarity as original equipment
  slot6 plus the evolution count. Default abilities `259717c:2597230` come from
  equipment slots30..34; normal performance `25973e0:2597420` comes from slot29.
- Weapon allocation `2583a30:2583afc` uses slots1..500; armour
  `2583afc:2583bcc` uses10001..10500. Repository lookup `2583748:25838bc` and
  native UserDataFBS inventory are keyed by `slotIndex`, not equipment ID.
- Native serialization `2620bd4:26213f8` records userId, slotIndex, long
  equipmentId, durability, reservedDurability, exp, five long ability IDs,
  createAt, protection/unbreakable flags, performance, rarity and five locked
  ability flags. Reference validator `262659c:262672c` checks nonzero IDs
  against original equipment, not the preset table.
  In the original UserEquipment object, performance is at0xd8, EXP at0x270
  and rarity at0x298; names were verified against the writer's actual strings.
  `2599de4` updates durability/reserved durability, not rarity or performance.

The archive now exports332 equipment definitions and67 presets, each with its
original table hash, increasing the decoded source inventory from98 to100.
Named test presets are retained as original data, **not a claim they were all
released as player gifts**. No new gear, abilities, random rolls or prices are
invented.

## Implemented delivery contract

Present delivery accepts a known ordinary/preset `UserGift.equipmentId` with
itemId0 and zero unsupported per-gift level/evolution/PC fields. It aggregates
the original quantity into the native `receivedEquipments` array. Arbitrary
evolution or alternative untraced gift encodings stay unavailable; an authored
preset provides the supported explicit customization. Native gift-list display
and the publisher's original choice of UserGift encoding remain pending proof.

Shop delivery uses its existing original `boughtEquipments` array and authored
cost/count receipt. It now shares equipment delivery observation with presents;
the earlier current-equipment-count check cannot establish delivery of distinct
pieces and is replaced, not accepted as legacy proof.

`equipment_reward_claim` permanently retains operation-keyed exact aggregated
rewards, a single pre-issue inventory identity baseline and observed native
pieces. Identity is `(slotIndex,equipmentId,createAt)`. Present/shop receipts,
wallet or native item expenditure, original claim IDs/counts, queue, sequence and
exact reply commit in the existing transaction. The server does not pre-credit
equipment, slots, signatures, EXP, stats or RNG.

Before issuing new gear, owned complete inventory and unique native slots must
validate. Current occupied pieces and the bounded pending queue's still
unobserved present/shop quantities reserve separate weapon/armour capacity;
observed pieces are not counted a second time. Rewards beyond the native500
slots per category are not issued. Current generic capacity rejection and its
native UI require the consolidated test pass, not a claimed publisher message.

Native saves merge **by slotIndex**. Same-type copies therefore remain separate;
duplicate/missing/invalid slot identities reject instead of overwriting another
piece. Delivery requires newly saved, owned valid pieces absent from the
captured baseline, matching actual equipment ID, required saved rarity0 for
ordinary gear or original base+evolution for presets, exact traced
performance and ability defaults/overrides. More restrictive rarity targets are
matched first so a plain gift does not consume a preset's sole qualifying proof.

`equipment_piece_claim` permanently binds each native identity to exactly one
delivery operation by primary key. One saved piece cannot prove multiple awards
in one save or across separate saves/ACKs, in either issue order. These lookups
do not scan lifetime reward history. A vacated slot requires a different
creation identity before it can prove another delivery; an identical timestamp
replacement is indistinguishable and is not counted as another piece. Original
timestamp granularity, clock changes, slot reuse and concurrent other producers
still need native evidence. Modified ordinary rarity may be higher than its
initial0; presets cannot meet a lower rarity than their traced target.

Partial observations, the permanent piece binding, full profile, received gift/shop
flags, ACK and exact reply update atomically. Split saves survive restart.
Observed gear can subsequently be modified or sold without imposing a permanent
equipment count/progress floor. ACK still requires every original delivered
quantity's saved observation and the original gift/shop flag/count conditions.
Flag-only or preowned-count-only acknowledgement does not erase a pending award.

Pending and exact cached gift/shop callbacks bind the issued quantity, receipt,
baseline, original metadata and retained piece-use index. Missing/corrupt
history cancels3000999 with queue/history intact; no piece history is backfilled
from inventory counts or after-the-fact flags. Other invalid saves and database
failures remain actual failures, not fake successful equipment operations.

## Shared save-sync cache follow-up (2026-10-07)

**SOURCE ONLY, DEFERRED / NOT RUN, built or installed.** Cached binary pulls
now compare every requested native table's current encoded bytes and token,
through the existing profile and pending-delivery guards. This replaces the
reward-ledger-specific checks, which left ordinary equipment saves outside the
stale-reply protection. Other unchanged requested tables remain replayable;
unrelated saves do not invalidate every cached binary projection.

Cached pushes validate every returned table token, including every nonempty
input delta table. Confirmations require the exact current all-table token map.
Both compare the current normalized deliverable operation queue against the
cached envelope: a queued award cannot disappear behind an older empty reply,
and an acknowledged award cannot be restored from an older nonempty reply.
Existing expiry and partial-delivery suppression rules remain authoritative.
Actual saved-profile/floor validation still runs. Empty-table ACK replies and
unchanged exact retries are retained.

Stale replies cancel through existing3000999 recovery, without cache rewriting,
profile/receipt/queue/done/sequence mutation, automatic settlement or fabricated
ACKs. No schema or native patch was added. The extended existing
`test_offline_recovery.cjs` is written but **not executed**; it includes ordinary
gear saves without reward ledgers, unchanged/unrelated projections, unchanged
tokens with changed raw bytes, queue-only changes, actual synthetic ACKs,
malformed cached token maps and restart preservation. These fixtures are not
native crafting or crash-recovery proof. Original signatures/save ordering,
shared producer interleavings, usable cancellation/back/fresh synchronization,
native gear features and measured performance remain pending.

## Deferred checks and remaining scope

The new probe covers all399 original definition/preset targets as synthetic
wire/save fixtures, reverse inventory order, default/override fields,
aggregation, preowned exclusion, duplicate-type slot preservation, partial
observations, split save/restart, recorded delivery followed by sales,
present/shop issue orders, one-piece reuse after either issue order or a later
ACK, vacated same-timestamp versus new-timestamp slot reuse, independent capacity,
invalid encodings, expiry/cache, missing receipts/index, and issue/profile/
observation/index/ACK/reply rollback. Existing gift/shop probes are updated.
These are written checks, **not executed results or native gameplay proof**.

Full native gifting/shop application, present-list/popup rendering, natural
eligibility, bag-full handling, signatures/save/effect/ACK order, timestamp
precision, slot reuse, empty equipment placeholders, exact durability/stat/EXP
effects, crafting/recipe/shop ownership, enhancement, evolution/awakening,
remaking/ability locks, selling and all other equipment producers remain
incomplete or unverified. There is no completed equipment-system or crash-fix
claim. Co-op stays last; no workers or GitHub Actions were used.
