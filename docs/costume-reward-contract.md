# Costume and linked-voice reward persistence

Latest SOURCE ONLY / UNTESTED [ordinary-ticket follow-up](gacha-ticket-reward-contract.md)
adds first ordinary-ticket capture to mixed shop recovery; fixture now178 written
contexts/32 NEW. Original wardrobe/linked-voice/full-ACK requirements remain,
NONE RUN. Earlier146-total/missing ordinary-ticket notes are historical.

## Dated PC-ticket follow-up — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

The shared dated shop helper now includes original PC selectors and their
evidenced first-shop constructor. Mixed recovery has146 deferred contexts;
older uncaptured PC-ticket bundle/count notes are superseded for that branch.
Costume-first/missing-voice recovery and other unfinished wardrobe branches
remain unavailable; no new voice packet or fake ACK. No tests or native changes.
See [pc-ticket-contract.md](pc-ticket-contract.md).

## Shop cold recovery follow-up — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Shop9000 now uses shared shopColdRecovery, not generic partial-costume cold
cancellation. A completely saved or captured preowned costume can be omitted.
Voice-first saves retain the original entry while its costume is still state1:
original2505fc4 enters the unlock branch and skips existing voice states2/3.
Already state2/3 costumes with missing required linked voices cannot re-enter
that helper; this prefix remains refused/retained, not given a fabricated voice
packet or fake ACK. Captured numeric/dated items still gate mixed recovery;
uncaptured items and paired units are unfinished. Generic Present2000/mission
6000 behavior is unchanged. Full original cost/count/date/source/queue/token/
signature/flag/voice/item actual ACK and atomic floors remain required.

New test_shop_mixed_recovery.cjs has134 WRITTEN ONLY contexts covering all33
original costume/equipment offers:32 offers/four save orders, four explicitly
unavailable PCTicket equipment-bundle prefixes, two original costume-pack
voice-first/read-state3 and costume-first-refusal cases. Synthetic owner0,
preowned/voice/stock/funding/cache/rollback fixtures are not native application
proof. Earlier general cold-refusal statements are superseded only for these
source-bound shop branches; docs/shop-reward-contract.md. NONE RUN/no native
patch/build/install/restart/emulator/actual save changes/no stability claim.

This implementation is **source-only: NOT RUN, built, installed or accepted in
MuMu**. It extends `gift/receive`, `shop/buy` and their shared `user_data/push`
save/ACK path. The actual player save and installed APK are untouched. Deferred
checks are `node tools/test_costume_rewards.cjs`, updated master/gift/shop
probes and save/recovery regressions; earlier native shop evidence is not
acceptance of this change.

## Frozen original contract

Client15.1.0 original ARM64 SHA-256:
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
Addresses below are raw, without Ghidra's `0x100000` image bias.

- Present operation2000 (`248cbb8:248e09c`) reads `receivedCostumes` as int32 IDs,
  not quantity-bearing objects. Shop operation9000 (`24219c4`) reads
  `boughtCostumes` and uses the same repository/helper.
- `2505fc4:25061b0` resolves a costume through `2504fd4`. Only an absent or
  state1 costume passes `2507b58`; `2507bc4` then sets its state to2 through
  `260d604`. Already owned costumes are not stacked or reset.
- The new-unlock branch resolves the **communication-voice** repository
  (`23a1d4c`), selects voices by costume (`23a273c`) and unlocks state1 voices
  (`23a4e9c` -> `23a5144`). The original costume-ID getter `23a483c` reads
  communicationVoice metadata slot9. This is not a playable-character or
  communication-character grant. Existing voice state2/3 is retained.
- `UserCharacterCostume` serializes `userId`, `costumeId`, `costumeState`
  (`260dcd4:260de38`). `260de38:260e04c` and `28025ec:2802800` deserialize
  those three fields and the corresponding `userId`, `voiceId`, `voiceState`.
  Native validators `260e150`/`2818818` require original metadata references
  and original enum values1/2/3. Startup arrays at `138e1e8`/`138e848` establish
  those three values; state0/4 is not accepted here.
- Lazy owned constructors `260d378:260d448` and `2823a64:2823b34` initialize
  **userId0**, ID0 and state1. `2507c94:2507dd8` and `23a4934:23a4e9c` set
  the real IDs and insert owned records without setting userId. Costume
  insertion `26c674c:26c6970` and the costume writer do not substitute another
  owner. Therefore these two local authenticated profile tables accept native
  userId0 as well as the local pulled owner. Foreign owners remain rejected;
  raw save fields/tokens are not rewritten. This exception does not loosen
  other tables or bypass authentication.

The decoder now exports all **394 original characterCostume definitions** and
**3354 original communicationVoice definitions**, with their archive source
paths/hashes. **42 voice rows** have nonzero costume references. For example,
Ais's costume1021002030 links140003391..140003396. The 394 definitions include
basic/NPC outfits; this count is not proof that every outfit was released or
obtainable as a player reward. The archive's exported achievement reward keys
have no costume matches; this pass does not invent costume mission rewards.

Static evidence is retained in `.work/gift-ordinary-operation-exact-20261004.txt`,
`gift-costume-add-exact-20261004.txt`, `gift-costume-state-exact-20261004.txt`,
`gift-costume-visual-fields-20261004.txt` (the historic filename says visual;
the traced class is CommunicationVoice), `gift-costume-user-contract-20261004.txt`,
`gift-costume-owner-fields-20261004.txt` and
`gift-costume-voice-initial-state-20261004.txt`. These are static decompilation/
assembly observations, not emulator acceptance.

## Implemented issue/save contract

Supported present encoding is the existing flat UserGift `itemId` set to a
known original costume ID, `amount:1`, and zero item-level/equipment/evolution/
PC-upgrade fields. This is a scoped offline encoding: the publisher's original
gift-list production/provenance and UI still need native evidence. Unknown or
parameterized encodings and quantities other than1 remain unavailable.
Repeated quantity1 gifts for the same costume produce one native unlock ID.
Shop products retain their original costume IDs, prices and mixed contents.

`costume_reward_claim` is a permanent operation-keyed receipt containing the
exact issued IDs and captured targets. Its nullable `before_states` now retains
actual pre-issue costume and linked-voice states separately from unlock minima;
`observed` retains new unlock checkpoints. A target retains its captured minimum,
whether it was new, and every original linked voice required by a new unlock.
The saved unlock minimum is max(2, existing state); a preowned costume has no
new linked-voice grant because the native helper does not repeat that branch.
Receipt validation binds exact int IDs, original joins, enum states, newness
and all linked voices. Newness is not recomputed from post-award inventory.

Gift receipts, gift claim IDs, mixed Iris/items/SP/casino/characters/equipment,
queue, sequence and exact reply commit in the existing transaction. Shop
receipts share its existing cost/count/reward/queue/reply transaction. No
native costume, voice, active outfit, playable character, bond, communication
character or signature is pre-published. Native effects own those changes.

ACK requires the saved costume at its captured unlock minimum and every
required voice at its captured minimum, in addition to the existing gift flags
or shop count/date and other reward requirements. Flags alone, costume alone,
foreign ownership, malformed/duplicate IDs or missing linked voices cannot
discard an award. Costume/voice/flag saves may be split; queued receipt targets
survive restart, cache eviction, session changes and gift expiry.

`costume_unlock_floor` materializes settled minima by (table, native ID).
Profile saves use that small current-ownership index, not scans of lifetime
receipts. CURRENT floor validation seeks changed costume/voice IDs by the
existing `(table_name,id)` primary key instead of loading every settled unlock
on each save. Profile, observations, floors, ACK and reply commit atomically. Earned costumes/
voices cannot be deleted or relocked below their captured minimum. Later
state3 updates remain accepted; the floor is an unlock guarantee, not a claim
that all notification/read-state transitions are reconstructed.

Missing or inconsistent legacy receipts cancel with code3000999 while keeping
the queue and history intact. The server does not manufacture an earlier
baseline from flags or already-awarded ownership. Fresh/pending and exact
cached gift/shop delivery validate retained receipts. Input errors and
unexpected SQLite failures stay genuine failures, never successful rewards.

## Current interrupted costume/voice delivery — acceptance pending

The original hash and exact unwind boundaries of `2505fc4`, `2507b58`,
`2507bc4`, `23a273c`, `23a4e9c` and `23a5144` were rechecked, and the complete
add/state artifacts were inspected. This is static evidence, **NOT a native run**.
The native helper skips linked voice acquisition for preowned costumes, and
retains already-unlocked linked voices when unlocking a new costume.

Fresh receipts capture original state1/2/3 for the costume and every linked
voice actually traversed by its new-unlock branch. Exact IDs, original joins,
newness and `max(2,before)` minima validate together. A preowned state2/3 voice
is not a new effect; an unchanged duplicate costume has no new voice effects.
Missing legacy before-states stay nullable/unknown, not inferred from awarded
rows or from the already-clamped minimum. Corrupt observations/baselines retain
the genuine queue and require reconciliation.

Shared2000/9000/6000 delivery observes each newly unlocked costume or voice
separately. A costume-only or voice-only save records its checkpoint with the
profile and omits only the queued operation from push responses. Every mixed
item/count/flag/voice/costume ACK requirement remains; partial hot/cached/cold
delivery cancels3000999 instead of replaying. Observed unlocks cannot relock
or disappear while pending, and captured preowned states cannot regress.
No native ownership/flags/signatures are precredited. No original costume
achievement rewards were recovered or invented; the6000 guard shares the
existing handler without manufacturing new mission rewards.

Observation updates use the operation primary key and occur only when changed.
Cached binary costume/voice/shop-count pulls must match current durable state,
including shop-only histories without Present claims. Completed old costume
callbacks cannot replay after ACK. Capture/save/observation/floor/queue/done/
sequence/reply remain atomic. These are source-level query guarantees, not
measured performance or usable interrupted-recovery proof.

## Deferred batch and remaining boundaries

The new synthetic probe is written but **NOT RUN**. It covers all394 metadata
targets and42 linked voices; no pre-credit/other-character changes; native
userId0 and local-owner rows; locked/new/preowned/read states; duplicate gifts;
flags-only and missing-voice ACK rejection; split saves/restart; indexed
ownership deletion/relock floors; both original costume-pack shop/gift issue
orders; original pack cost/count/tickets; malformed quantities/fields/IDs/
owners/enums/delete identities; missing/corrupt receipt and exact cached retry;
expiry; and mixed wallet/receipt/profile/floor/queue/ACK/reply rollback. CURRENT
extensions cover gift/shop costume-first and voice-first saves, typed before
states/observations, preowned voices not falsely observed, incomplete mixed
ticket/count/flag ACKs, missing legacy/null/corrupt captures, pending relock/
deletion, queue retention, hot/cache/cold/settled and stale binary pulls,
restart and observation/floor/done/reply rollback. `test_gift_delivery.cjs`
also adds both voice/flag save orders. All checks are **DEFERRED / NOT RUN**.

These are future encrypted-request/save fixtures, not gameplay proof. Native
wardrobe entry/selection, costume art/model/audio, voice gallery and other
natural voice conditions, signatures, hot/cold effects/popups/save/ACK ordering,
shop/gift provenance, natural eligibility, event-clock behavior, legacy
reconciliation UI and other unlock producers remain unverified or incomplete.
Current shop-only item/count/date checkpoints are documented separately in
`shop-reward-contract.md`; their runnable checks are deferred too. Neither
extension proves all9000/6000 or every mixed-reward interruption.
Equipment customization, raid/Lotto presents and co-op remain separate work;
co-op stays last. No feature-complete or crash-fix claim is made.
