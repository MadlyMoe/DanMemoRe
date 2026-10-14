# Friendship and dispatch inventory persistence

## Permanent friendship-completion identity (2026-10-13 source milestone)

SOURCE ONLY / PARTIAL / UNTESTED. Every newly successful
`character/friendship/complete` request atomically retains its actual-wire request
key/hash, a semantic hash of the exact friendship states and optional CP-item
debit, and the canonical signed operation11000 already captured with its reward
claims. An exact pending retry must still have that live queue entry and returns
the same operation without reissuing Iris, items, points or spending.

After the real client save and operation acknowledgement, the exact request must
have one done row and no queue, the canonical operation and original request,
saved character-point and quest floors, communication voices, required HP/MP
refills, every ordinary/capped acquisition and the captured CP-item expenditure.
It returns the original popup fields with `operations:[]`; an old request cannot
redirect to a later point grant or spend the item twice. Missing/noncanonical
captures, both/neither pending and done states, or lost saved effects refuse
without mutation. Legacy settled operations lacking the canonical capture are
not reconstructed from current balances.

The bounded original11000/21000 callbacks still contain no proven direct
`UserCharacterFriendshipReward` producer. Those rows remain optional independent
saves: any observed owner/date/received checkpoint is protected across replay,
but absence is not promoted into a mandatory ACK effect. This preserves the
separate received-flag contract instead of weakening the actual point, inventory,
unlock, voice, refill and spending obligations.

Deferred cases cover request-row rollback, pending cache-evicted replay, settled
popup-only replay, capture/done/queue corruption, lost floors and expenditure,
partial optional-flag corruption, unchanged state, split saves and ACK rollback.
They are WRITTEN ONLY / NONE RUN. Native presentation/save order, legacy settled
requests, natural earning/eligibility, UI/performance/stability remain unverified;
175 partial / 1 unsupported / 0 verified complete across176, co-op last.

## Shared numeric clamped-stock allowances (2026-10-10, newer source milestone)

SOURCE ONLY / PARTIAL / UNTESTED. This supersedes only the full-wire-quantity positive-addition allowance in older captured numeric reward notes. Original common gain24d8844 adds the full positive quantity, clamps stock at the authored slot88 maximum before the slot48 stock/signature setter, then adds the full quantity separately to slotb0 lifetime. The existing2000/6000/9000/11000/21000 numeric stock-capture validator and effect handler now bound positive additions by `capture.amount - capture.beforeAmount` for every supported numeric family, including zero when stock was already full. Valis already used that bound; dated arrays remain quantity-based and event-box numeric allowances were changed separately.

Original wire quantities, capped lifetime targets, signatures, prices, flags, mixed rewards and full ACK requirements remain unchanged. Spending never refunds the recorded positive allowance, and actual issued signature plus capped lifetime still closes it even after first-save spending. Stored oversized old counters are retained/refused rather than repaired or erased. Existing capture/profile/token/receipt/queue/done/exact-reply atomic transaction, original family fields/timestamps and indexed completed checkpoints remain in use. No dependency, schema, separate ledger, native precredit or listener change.

There are88 additional WRITTEN ONLY scenarios:68 in `tools/test_gift_items.cjs` (17 supported numeric families × near-full/full stock × stock-first/signature-first) and20 in `tools/test_friendship_rewards.cjs` (three original CP and seven dispatch sources × near-full/full stock prefixes). Gift captures retain the original aggregated quantity5 while their actual clamped gain is1 or0. The cases define prefix/ACK rollback, no precredit, cold exact bytes, deliberately oversized retained counters, early ACK, spending without replenishment, full mixed observation and completed restore/delete/rewind refusal. Existing shop/mission corruption cases now exceed actual clamped gain, including full-stock zero, rather than testing only full quantity plus one. NONE RUN; synthetic funding/provenance/eligibility/signing/order is not native acceptance.

Counts remain125 partial/50 unsupported, no completed feature claimed. Other producer/constructor/coalesced-legacy and native UI/clock/recovery/performance/stability branches remain unfinished or unverified. Original catalog has no shared event-box ticket keys; hypothetical edited catalogs were not implemented. Legacy dungeon3000 allocation/price is still unrecovered and not considered implemented gameplay. Actual saves were not read or changed, earlier DDL SOURCE ONLY / UNAPPLIED; no tests/checks/generators/build/APK/install/restart/emulator/ADB/workers/Actions. All149 packets and variants precede consolidated acceptance; co-op last.

## Shared Valis stock-first saves (2026-10-10, newer source milestone)

SOURCE ONLY / PARTIAL / UNTESTED. This supersedes only the stock-only-prefix limitation in the preceding Valis milestone. It covers captured Present2000, mission6000, shop9000, friendship11000, event-box15000 and dispatch21000 rewards, not every producer or historical save. Counts remain125 partial/50 unsupported; no tests, checks, generators, builds, deployment, migrations or emulator work ran.

The original common gain clamps stock before updating lifetime and signature. A stock-first save can temporarily exceed the existing Familia stock-minus-lifetime ceiling without refunding an earlier charge. The existing captured reward now bounds this prefix: exactly one retained active original Valis producer, no pending Familia creation/donation, no completed duplicate and a before-row consistent with the actual floor. The temporary allowance is not permanent credit. Actual capped lifetime plus the issued signature still observes credit once, and the full mixed native ACK is still required. Positive stock additions consume only the captured clamped stock difference; spending does not refill it, including full-stock zero-difference gains.

Fresh event-box Valis rewards crossing or exactly reaching the lifetime cap now retain their original signed before/target stock, rather than capturing stock only when lifetime was already capped. Partial cumulative saves cannot rewind, a missing observation is not reconstructed from a changed signature, and stock/credit observations must agree. Original quantities, wire shapes, prices, windows, counters, mixed rewards and existing atomic receipt/profile/token/queue/done/exact-reply transaction remain unchanged. No new schema or native precredit was added; earlier DDL remains UNAPPLIED.

There are21 additional WRITTEN ONLY stock-prefix scenarios:15 in `tools/test_familia_valis.cjs` (six event-box, three Present, three shop, three mission) and six in `tools/test_friendship_rewards.cjs` (CP and dispatch across three baselines). Three existing exact-after-charge/no-credit cases also exercise stock-first spending. Cases define rollback, cold exact bytes, missing/corrupt capture, exhausted allowance, cumulative-only no-credit, early ACK refusal and eventual full observation. NONE RUN; synthetic eligibility/funding/order/signing are not native acceptance.

Overlapping producers, unknown legacy captures, other constructors/producer classes and native UI/clock/recovery/performance/no-crash/no-freeze remain unfinished or unverified. All149 packets and variants precede the consolidated test pass; co-op last.

## Capped Valis CP and dispatch rewards (2026-10-10, newer source milestone)

SOURCE ONLY / PARTIAL / UNTESTED. This supersedes the older named Valis/Familia cap-credit refusal, not full11000/21000 or historical native acceptance. Counts remain125 partial/50 unsupported. No tests, syntax/static acceptance checks, generators, builds, APK work, listener restarts or emulator/ADB checks ran. Actual saves were not opened or changed; every DDL change below is SOURCE ONLY / UNAPPLIED.

Original quantities and wire shapes remain unchanged. Both packets use the shared native gain described below: stock clamps at the Valis maximum2000000000, lifetime clamps at999999999 using the full positive quantity, and signed additions must remain within int32. Dispatch still multiplies each original wire Valis row separately in float32, including its CP row, using the retained original equipment bonus. The existing issuer excludes the actual old UInt32 signature. There is no native stock, signature, reward-flag, XP/SP or ACK precredit.

Valis now uses the existing friendship stock capture with policy `offline-friendship-stock-cap-v2`. Its nullable `valis_state` and default0 `valis_seen` bind `offline-friendship-valis-floor-v1` to the stock capture by hash. After an existing Familia charge, positive stock gain minus lifetime gain is captured as a spending-ceiling credit; full-stock/no-charge/exact-saturation cases mint none. Only actual capped lifetime plus the issued signature applies that credit, once. Existing bounded positive-addition/spending closure, full mixed reward/CP/dispatch ACK, unsafe replay suppression and cold recovery still apply. Compare-prior capture/credit/floor writes share the existing profile/token/queue/done/exact-reply transaction; no parallel wallet or new reward ledger is introduced.

The existing Familia floor accepts a seventh source kind, `friendship`, covering both packets. Its source validation retains the exact original operation/token/signature/parameters, queued-or-completed identity, normalized quantity, original CP type6 reward IDs/hero/level/quantities, and dispatch timer/stage/XP/equipment-bonus receipts. Observed credit/hash/ceiling must agree. Indexed completed capped checkpoints now include Valis; spent stock cannot be restored, removed or rewound without another validated producer. Missing/corrupt original sources, captures or floor refuse through existing recovery and retain saves instead of reconstructing credit. Older22000/22100 charges must settle before a capped reward; a later real donation cannot be refunded by replaying the old credit.

Source DDL adds only nullable/defaulted columns and partial source/credit indexes to existing friendship tables. The floor migration accepts exactly the previous two-through-six-source definitions, preserves their rows in `familia_valis_spending_floor_v5_backup`, and preserves existing v1/v2/v3/v4 backups. Unknown, custom-index/trigger, referenced or colliding schemas refuse unchanged. No actual migration ran.

There are32 additional WRITTEN ONLY scenarios in `tools/test_friendship_rewards.cjs`: two original CP/dispatch sources × three cap baselines × four save orders, plus eight no-credit/exact-after-charge cases. They define actual boosted quantity/signature/first-spent/flags-full mixed ACK, issue/save/ACK rollback, cold exact replies, capture/source/CP-claim/floor loss, later donation, completed restoration/deletion/rewind and nullable old-column preservation. Shared original gear fixtures are reused. The schema fixture now defines14 modes, including previous six-source migration and existing v4 backup preservation. NONE RUN; synthetic funding/Familia/eligibility/gear/signing/order are not native acceptance.

Shared currency fixtures use the native six-field shape already recovered for Familia creation: `userId`, `currencyId`, `amount`, `cumulativeAmount`, `reservedAmount`, `signature`. They no longer append an invented book field; missing seed tables in lightweight test mocks remain empty rather than requiring a database interface. This fixture correction is not full native currency constructor/schema acceptance.

Stock-only prefixes above an existing Familia ceiling, other producers/constructors, overlapping pending/unknown legacy flows, CP-item cap ambiguity and native signing/UI/clock/recovery/performance/no-crash/no-freeze acceptance remain unfinished or unverified. This is not whole-game completion. Finish all149 packets and variants before the consolidated test pass; co-op last.

## Earlier capped non-Valis CP and dispatch milestone (2026-10-10)

SOURCE ONLY / PARTIAL / UNTESTED. This supersedes the named ordinary non-Valis lifetime-saturation refusal only, not full11000/21000 or the historical acceptance below. Current source coverage remains125 partial/50 unsupported. No tests/checks/generators/build/APK/install/listener restart/emulator/ADB/workers/Actions ran; actual saves were not opened or changed. DDL below is SOURCE ONLY / UNAPPLIED.

Original11000 uses `24e3a5c` at `23eb690`, then gain slot `0x50` at `23eb69c`. Original21000 uses `24e3a5c` at `2309060` and gain slot `0x50` at `23090f8`. Shared `24d8844` performs signed stock addition at `24d88b8`, compares with the original maximum, and passes the actual operation signature to the stock setter. Its positive quantity at `24d890c` feeds lifetime slot `0xb0`; `24d8d94:24d8ddc` adds that full original quantity and clamps lifetime at `999999999`, not the stock difference. Neither grant should fail merely because lifetime reaches its cap. Unsafe signed additions are still refused before issuance; no overflow interpretation is invented.

The existing friendship receipt now retains `operation_json`; its item rows have default0 `cap_version` and nullable `stock_state`. They capture original before-stock/lifetime/signature, issued signature, clamped stock and bounded positive additions with separate effect/observed flags. Old captures are not reconstructed. Same-item pending/coalesced grants must settle before a new capped CP/dispatch receipt; this preserves unknown interleavings rather than claiming their support. Original quantities, CP reward IDs/received flags, dispatch reward groups/weights/timers, float32 Valis boosts, XP/SP and native wire shapes remain unchanged. No stock, signature, character, flags or native ACK is precredited. The existing issuer excludes captured old signatures, including full UInt32 values, without changing signing policy.

The shared capped-stock handler validates every split save against the actual prior owned row. Positive additions are limited to the original quantity; spending never restores allowance. Stock/cumulative-only prefixes do not acknowledge a reward. Actual capped lifetime plus the issued signature closes the acquisition; already-spent first saves remain possible. Observed effects suppress unsafe push redelivery without retiring the queue; additive cold retries still use recovery until every owed effect is acknowledged. Full ACK requires capped acquisition, all other ordinary rewards, CP points/constructors/quest/voice/refill effects, actual consumption when present, and dispatch progression/XP/SP obligations. Existing profile/token/queue/done/floor/exact-reply transaction also compare-updates the retained item capture.

Completed capped stock cannot be deleted, rewound or increased without another validated pending producer. Its existing lifetime floor additionally requires the retained original operation/quantity and observed stock capture. The new partial `(item_id, operation_id DESC)` source index covers `cumulative_amount=999999999`; newest completed lookups seek past at most the bounded pending queue, not lifetime-history scans. Unknown/missing/corrupt completed provenance refuses while retaining saves.

`tools/test_friendship_rewards.cjs` contains73 additional WRITTEN ONLY scenario definitions:70 three-CP/seven-dispatch-class × seven-save-order cases, two subsequent original-item Present gains after acknowledged/spent capped stock, and one old-schema nullable/unknown-preservation fixture. Original quantities and windows are retained. Native fields/full old signatures/collision exclusion, malformed capture/envelope refusal, first-spent/split saves, full ACK obligations, issue/save/ACK rollback, cold exact ACK bytes, completed stock restoration/deletion/lifetime rewind and source loss are defined. The shared synthetic helper now preserves native reserved fields and produces capped signed rows without depending on a DB-only mock interface. NONE RUN; synthetic funding/eligibility/constructors/signing/order are not native earning/application proof.

Capped Valis and its Familia spending-credit rules remain unfinished, as do other producer/constructor variants, coalesced or unknown legacy recovery, CP-item cap ambiguity, native signing/UI/clock/performance and no-crash/no-freeze acceptance. Not every reward or gameplay system is complete. Finish all149 packets and variants before the consolidated server/emulator pass; co-op last.

Historical2026-10-07 status: **PARTIAL**. The zero-CP checkpoint and cold-confirmation
follow-up is built/installed. Full friendship/refill/transport checks pass;
the earlier native stat-only recovery remains a separate case. Historical
source-only sections are superseded only for named checks/cases.
Full11000/21000, fresh hot native acceptance and broader gameplay remain
pending. Co-op last.

## Zero-CP checkpoint and cold confirmation (2026-10-07)

An original lazy constructor can legitimately save and ACK zero CP.
The existing `stage_friendship_floor` CHECK incorrectly required1 or more,
so that valid initializer failed its SQLite transaction. The CHECK now
permits0..2000000000. Only the exact known former three-column schema is
migrated; custom indexes/triggers or unknown positive-only schemas reject.
The original table remains as `stage_friendship_floor_positive_backup` and
its explicit columns are copied unchanged in one transaction. No CP,
inventory, signature, character row or reward is precredited or reset.

Shared login/confirmation delivery now reads `UserCharacter` through its
existing earned-CP/initialized-row validation. A missing earned character
cannot receive a successful cold confirmation. Masterless legacy diagnostic
reads tolerate absent metadata only without earned checkpoints; an actual
earned checkpoint still cancels and preserves its damaged data.

The full disposable `test_friendship.cjs`, `test_friendship_refills.cjs` and
`test_friendship_transport.cjs` pass. Positive fixtures explicitly save item
consumption and all owed quest/voice/refill effects; negative bare and split
ACK probes remain strict. Coverage includes all three heroes, plain/item/
stage sources, zero/positive lazy constructors, independent save orders,
ordinary and original guest windows, preserved former-schema migration,
matching fresh stage units, restart, rollback and damaged cold/cached saves.
Full PC stat/battle-stat, stage persistence, native board checkpoint,
communication wardrobe, CP voices and launcher source checks also pass.
The complete stage-unit matrix remains **not passed**.

Latest installed debug APK SHA-256:
`ae85ec236faca7717fee579f8308631e1d1f3dabd78922b93165e8d8bfe2bdac`.
Installed runtime server SHA-256:
`0c29053f4694ec1fe2f1bbe2434df6c2e0340b3599757bd371d0a9cf40288200`.
All seven APK server modules match source bytes. On isolated Adventure16,
event2019-10-18, cold town retained rank3/SP60/Iris17/Valis30138. A stopped-
listener read-only DB/WAL copy verifies the zero-compatible CHECK, all six
original positive checkpoints equal their retained backup, Miach CP105,
ACK13, an empty queue and `integrity_check=ok`. No original Adventure5 DB
was opened; no synthetic native funding, items, units, flags or ACKs.

MuMu capture/ADB stalled on the preceding build and recovered after scoped
reconnection and normal instance UI recovery. That is not proof of a game
root-cause fix or long-session stability. Bell/Ais/Hestia Interact screens
render and Back navigates out, but CP/Favorites/Outfits controls did not open
through attempted ADB/direct-window input. The save also has no owned
`UserCpItem` rows; no fresh native CP-item request/consumption or hot11000
ACK was obtained. These observations do not establish the cause of the
menu behavior. Rookie5, all reward kinds and full gameplay remain pending.

## CP hot handoff and bounded cold recovery (2026-10-07)

Original raw town wrapper `2210094:22109a0` and CP-item wrapper
`15d6340:15d6c54` use hot transport `209b70c/209bd48`, which reads root
`operation`, not only cold `operations`. Shared delivery now supplies the
same signed11000 in that singular field, including old cached replies;
observed split pushes suppress both fields without removing the queue.
No profile/signature/reward precredit, schema change or manufactured ACK.

On isolated Adventure16 `eb8b83ee`, date2019-10-18, a naturally earned
Miach conversation21024 on the prior build issued11000 ID13. Actual
FriendshipUpdate21025 saved CP5->105/level3 and PC1012037002 HP86->96,
MP22, but omitted ACK13 because the hot envelope lacked the singular field.

Recovery permits only fully saved nonadditive/stat-only11000 with unchanged
exact points, active hero and every captured initializer/quest/voice/refill
obligation. Original `23e6b08` writes absolute CP and skips those refreshes
when its active CP level is unchanged. Additive items/Iris, consumed CP
items, missing effects or changed points/hero still cancel. Cold
confirm21028 registered the original13; actual AreaChanged21033 ACKed it.
The queue cleared, integrity_check was `ok`, saved Miach CP stayed105 and
usable town retained rank3/SP60-of22/Iris17/Valis30138/Rookie4-of36.

`node tools/test_friendship_transport.cjs` passes exact hot/legacy envelopes,
strict partial-save rejection, narrow cold recovery, additive/consumed
rejection, changed-point refusal and profile/floor/done/reply rollback on
disposable native-shaped fixtures. It is not natural earning or UI proof.
The older positive friendship fixture initially omitted required quest
refresh; the full corrected test now passes as recorded above, without
weakening production guards. Full `test_stage_units.cjs` previously exited1
without a final success; only explicitly filtered cases passed. It has not
been rerun on the zero-CP checkpoint revision and is not counted as passed.

Earlier hot-handoff APK SHA-256, not the latest installed build:
`3c924d36ecf725a89604f97ed2ed46715744aff9db3489b41889b0f09d5ace59`.
Earlier hot-handoff runtime server SHA-256:
`d7de78ec6809c92a663fb05af1dc868316bb9887cd1ddd4cffcded7c6caac043`.
All seven packaged modules match their source bytes. No original player DB
was opened; no workers or GitHub Actions. Fresh hot native11000, all
heroes/items/reward kinds/dispatch interleavings and general stability remain
unverified. Coverage stays175 routes:107 partial,68 unsupported,0 complete.

Original client15.1.0 ARM64 SHA-256:
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
Addresses below are raw, not Ghidra's extra0x100000 mapping bias.

## Recovered native grants

- Operation11000 at23eb274:23eb9bc consumes optional CP itemId/itemAmount,
  applies gainedItems[{itemId,amount}] through24e3a5c/virtual gain0x50,
  refreshes authoritative Iris and applies friendshipStates. Original CP
  rewards contain four ordinary inventory classes: EXP, Falna, Hero Ascension
  and Valis. Stat-only rewards are not fabricated inventory grants.
- Operation21000 at2308e08:2309498 reads
  gainedItems[{rewardId,amount,drawType,isFriendshipReward}]. Casino medals call
  23ff788 directly; other items use24e3a5c/virtual gain0x50. Original groups
  contain eight ordinary classes: Falna, EXP, Valis, equipment materials,
  equipment evolution items, equipment enhancement items and stamina tickets,
  plus CP items. Casino medals are a ninth, separate branch, not an ordinary
  acquisition in UserCurrency.
- That dispatch handler also casts each Valis quantity to float32 and applies
  the type2 multiplier from247aefc. It grants player XP from the outcome group's
  experience field using type1, then2540b54 handles levels/SP. The bonus-map
  rebuild247b5ac resolves the saved stage's four main PC slots (not assists).
  Combination247afcc reads their equipped weapon/armour at DomainPC vtable
  offsets100/110, resolving equipment abilities, **not PC skill effects**.
- Owned equipment2597434 includes saved abilityId1..5;259784c appends the five
  fixed original equipment slots30..34. Duplicates are preserved, not guessed
  away. Type1024/kind1 boosts player XP; kind2 boosts Valis. The sum, addition,
  division and per-row multiplication are float32; the divisor is10000 from
  raw33f9ea4. Conversion truncates to signed int32 after each Valis row.
- `equipmentAbility.enc` exports1720 rows (eight type1024, including debug
  rows, not obtainability proof), SHA256
  `0174d16a2bb342d0e22d76e8a29659ac76a7506b0897eee671abf55ea3f66473`.
  The36 original `equipmentEvolveAbilityContent.enc` rows, SHA256
  `55ea3447ece126744e7e2efba7e36d0844c5078c27096f7df2ae53f3af949251`,
  contain no type1024 ability, so no expedition boost is omitted by not
  reconstructing other evolution effects. A changed export must be recovered.
- Player XP2540b54 adds the boosted outcome-group experience and rebuilds the
  player level via2540618. The final original level999 threshold41775382011
  clamps totalExp. The level setter saves the derived level. Each gained level
  also adds that original level's maxSP through2548998/25488e0. The exact
  setter25ea560:25ea640 changes secure baseSP and the userdata dirty bit;
  it does not change baseSPUpdatedAt or consumedNormalSP. Additions saturate
  at2147483647, not at the player's ordinary stamina capacity. Regeneration
  and independent attribution of all SP producers remain unrecovered/unverified.
- Native collection23147dc removes both the party repository and its saved
  UserExpeditionParty row via26f3a50, preserving a deletion delta. Constructor
  2310e14 creates exactly four slots. This deletion is required at reward ACK,
  not an unchanged party forever.

## Recovered request party

Exact2307dbc:2308378 traverses each slot's main230b740 and assist230bb38,
then2308378:2308ca4 resolves each PC's original slot7 character key. The
request contains that character ID in both arrays. The original literal strings
confirm that `entryPcs.status` is22d373c's sum of seven native status kinds and
`entryPcs.level` is PC vtable0x88. Separately, friendshipStates uses active-hero
CP points23e5a2c and derived CP level23e7d60, not the unit level. Active heroType
comes from saved UserInfo, not a caller-selected alternative CP track.

The PC export now preserves1368 profiles:1341 join to original characters;
27 blank NPC/debug character keys remain explicitly zero/unmapped. Original
`pc.enc` SHA256 is
`f273ac4093f78a5ad118201c81a329fc444812d9ba2a13db06a9b08d3a8289d2`.
This is metadata mapping, not unit obtainability or membership proof.

Fresh completion now binds the full request-entry **multiset** to saved main
and assist PCs, including duplicate-character multiplicity. Each must be a
unique owned joined ownerType1 row with a mapped original character and valid
saved unit progression. Unit levels reuse the existing original job/growth/
limit-break calculation from element-player capture; currentJobIndex is not
jobRank. Saved four-slot party ownership permits the native lazy userId0 but
not another player. Friendship state must use the owned saved active hero
track. Binding occurs before reward rolls, CP claims, Iris or queue writes;
pending same-body receipts are not recomputed against post-effect CP values.

Native slot-vector order for all legacy/reordered saves, main/assist role
eligibility, guest-owner variants and unsaved client-before-request ordering
remain gaps. Fresh completion now also binds each reported status to the
owned saved unit's calculated dispatch total, as described below. That source
implementation is not native acceptance or a claim of publisher-equivalent
party validation or sampling.

## Unit-status foundation (source only)

Base/growth and explicit modifier arithmetic are implemented, **not tested or
installed**. Original pc slots48..54 and56 supply native kinds1,2,4,8,16,32,64,
128. Exact ARM64 instructions22d01ac:22d0438 prove these assignments; its
decompiled listing drops later calls because of incorrect PIC inference.
The original pcLevelStep slots4..11 supply increments in that same kind order.
The client adds every row through the derived unit level, including level1;
it does not add only the last row. The export retains1368 base vectors and
4000 growth rows across40 groups, preserving native iteration order. Original
pcLevelStep SHA256:
`07bb7befd8461d549770c3d751a37fae31b72be5f5acaefbba1cbfeaae469264`.

`pcBaseStatus` reuses saved job/growth/limit-break progression. Fresh dispatch
member validation now requires that original base/growth join. It does not
overwrite saved HP/MP or use the base vector as a finished combat total.
Missing or malformed joins cancel without inventing zero growth.

The shared `pcStatusFromComponents` implements22d5bb8 with its boolean=false:
secure base map+0x0, flat map+0x18 and percentage map+0x30. The ARM64 multiply is
signed-int32 before division, division truncates towards zero, and additions
wrap int32. The divisor10000 is read from original ELF relocation43283e0 to
rodata34a8204 (`10 27 00 00`), not a percentage assumption. Total22d373c adds
kinds1,64,2,4,8,32,16 in that order and excludes128. There is no kind1/8 special
scaling/minimum in this dispatch path. All three explicit vectors are required;
missing modifier providers are not treated as zero.

The native refresh chain22cfe28/22d0f90 runs base22d01ac, then22d0438,
22d0638,22d075c,22d0adc and22d0c14. The owned ownerType1 path through
growth, first-board, CP, rank/substituted/weapon-conditioned abilities and
ascension is now wired into fresh dispatch validation in source only.
22d0adc produces map+0x1b0, used by dispatch22d373c.22d0c14 produces later
battle map+0x1c0; those equipment values are not added to dispatch without proof.
Deferred `test_pc_status.cjs` covers source-derived base/growth, rank/limit-break
caps, missing providers, signed arithmetic, truncation, overflow and128
exclusion; synthetic modifiers are not native full-stat proof. Master and
dispatch/element/PVE regressions remain deferred.

### First ability-board pass

`pcAbility.enc` now exports3655 original effects with type, mode, amount,
status mask, condition and weapon mask. Its unchanged original SHA256 is
`54c9a297add8e614844624e7980d4403893b3238a01694eb27c2d461a17ebd42`.
22cdfcc reads slots5/6/7, not the display/type field1. Mode1 contributes to
base; mode16 contributes to percentage. Mode4/8/32 and other effects update
different native maps, not these eight base/percentage components.

22d0438/22dc97c visits every original ordered normal job, plus the extra
limit-break board only when limitbreakCount is positive.22c9ed4 selects panels
by their original index1..25 bits. Duplicate opened ability IDs each count;
saved row order and currentJobIndex do not substitute for original board order.
20f0058 uses condition slot8 and weapon mask slot9. This first pass supplies
no weapon, so condition0 applies and weapon condition1 does not.

Modern22deee8 creates a cleared missing job set/job lazily, with mask0x2000000
from the original ELF relocation4327808 to34f5698. That display bit25 is not
an opened stat panel. The provider therefore permits missing modern rows
without creating or saving them. Unknown nonempty legacy UserPC.jobs or
abilityPanels lists, duplicate/foreign/unknown jobs, invalid masks or missing
original groups/effects cancel rather than clear progress or invent zero
modifiers. Constructor22c97b8 resolves even unopened panel effects, so a
missing original effect is rejected even on an unopened board. Substituted
type51 abilities are handled by the later pass below, not this raw-board pass.

### Three-track CP base bonuses

22d0638 ARM64 instructions add CP to the base map before percentage, for
kinds1,64,2,4,8,16,32, never128.23e8a74/23e8c68/25120a4 sums every original
stat reward whose required level is earned on each of hero0/1/2. It does
not use only the active hero or require inventory reward claim flags. Native
reward types8/9/10/11/12/13/14 map respectively to HP/MP/STR/END/MAG/DEX/AGI.
The original characterFriendshipReward SHA256 remains
`beaefb9d9b31b7de30e9bddf7e04c94c4e7065864585a90ca7a1624ed0853963`.

`pcFriendshipStats` binds the owned PC's original character to its one owned
saved row and derives levels separately from friendship/friendshipAis/
friendshipLef. Missing tracks, invalid points/thresholds/rewards or ambiguous
ownership are not replaced with zero CP. Bell at378 points (level6) on all
three tracks has original combined HP104, STR5, END5, DEX25 and AGI22 bonuses;
this is metadata arithmetic, not proof of native earning or displayed totals.

Fresh dispatch member validation composes these providers with the later
passes below before any reward roll/receipt/wallet/queue mutation, without
changing the save. OwnerType3 and unknown legacy board conversion remain
unsupported. No new SQLite receipt schema or client/signature pre-credit is added.

### Rank, weapon conditions and substituted abilities

The owned DomainPC virtual rank getter22e5c10 resolves the saved ordered
current job through22dfe60 and reads that original job's slot4 rank. It does
not substitute currentJobIndex for jobRank.22dcdb8 selects original positive
PC long slots30/32/34/36/38 when their corresponding slot31/33/35/37/39 gate
is at most that rank. The export preserves all five pairs for all1368 PCs.

20f0058 condition0 is unconditional; condition1 requires a present weapon
whose original type slot36 is1 and kind slot4 overlaps the effect's weapon
mask. The exact raw getters are2596f00 and2596ed0; Ghidra labels include a
0x100000 bias. Owned getter22e3fac uses the saved equippedWeaponIndex and
actual owned equipment row. Missing/ambiguous/foreign weapon inputs recover
without treating an unresolved weapon as unequipped. First-board effects still
receive no weapon; these rank and replacement effects receive the owned one.

20f0570 collects positive PC long slots93..95 in original order. Only the
positive-limit-break board supplies the later replacement pass.22c97b8
increments a replacement ordinal for every original type51 marker, including
closed markers;22ca2cc applies a replacement only if that marker is open.
Sorting panels by index would change that ordinal. The decoder verifies that
the frozen panel source IDs remain strictly ascending and retains that original
row order. There are21 profiles with nonempty replacement lists. The raw
board's original effects and the later replacement effects remain distinct.

Original initializer11c78c0 copies21 power-of-two kinds from rodata34f5ad4 to
the vector at44bcc68. Modes1/16 therefore retain kind128 in the eight base/
percentage components too, although dispatch total22d373c excludes it.
The other13 kinds and other effect maps are not full combat support.

### Hero ascension and final dispatch binding

Original heroSublimateLevelStep contributes133 rows across19 groups0..18,
with seven contiguous levels0..6 per group. Its SHA256 is
`cdc4607881443e3cc25b6c1fbc2c6953f7b86b2ce0b2120985eb5f3d45999c27`;
the master export now includes112 original sources.1618674 selects original
rows from level0 through the saved level, inclusive;1618e00 matches slot1
group and slot7 level.22d7058 adds slots8..14 to the **flat** component in
kind order1,64,2,4,8,16,32, not the base component before percentage.

22d0adc requires nonzero original PC slot90 and the owned unlock boolean.
Direct ARM64 getter instructions22e5d1c/22e5d28 resolve saved
heroSublimateLevel and isUnlockedHeroSublimate. The provider validates those
fields and original rows instead of inventing an ascension group or level.
For original group1, accumulated level1 adds HP125/MP7/STR36/END5/DEX9/MAG21/
AGI8; level6 adds HP1175/MP70/STR350/END50/DEX83/MAG180/AGI75. These are original
metadata calculations, not proof of legitimately earned ascension.

`pcDispatchStatus` combines growth + first-board base + all-track CP + passive
base, applies first-board + passive percentage with native signed arithmetic,
then adds ascension flat. Fresh request entries must match saved
character+derived level+calculated status as a multiset, and totalStatus must
still equal their sum. A changed stat with a consistently recalculated request
total is rejected before rolling or writing rewards. Existing pending retries
retain their captured pre-effect body hash rather than recomputing against CP
earned by their own reward. None of this pre-credits saved stats or signatures.

## Durable handoff

### Dispatch completion-state rules (source only)

The master now exports original `expeditionStageRequirement`:368 rows,
288 linked rules across144 of227 stages and80 unused zero-stage rows. Every
stage has an explicit array, including empty arrays; an absent export is not
treated as "no requirements". Original SHA256:
`d64087b2ced00c3f642103938b6accc0e071471a5f77f06e7b436d5ea194bd52`.
Slots1/2/3/4 are stage ID/requested state change/requirement type/value. The
frozen linked combinations are change0/type2/count and change2/type1/stage ID.

Exact23021b0 sets completionState4, dispatchState0 and completion times, then
broadcasts the outcome. Raw rodata34ff6d0 contains state/change pairs
`0:2, 1:0, 4:2, 5:2`.230afe0 type1 matches its specified stage ID only on a
great result2; type2 compares the native otherClearCount to its threshold.
2303164 change2 sets locked state1, while change0 sets ready state2. If the
completed stage remains4,2302524 sets terminal state5 when it has no rules or
the outcome is great. Thus failure/normal outcomes on a rule-bearing stage
stay4, no-rule stages finish5 even on failure, and original cyclic stage
707000070 can finish1 on its own great-result rule. The former ACK check
rejected that native locked result and allowed unrelated states indiscriminately.

The own finish path does not increment either clear counter. The synchronous
peer observer2302b78 increments otherClearCount **once** on normal/great outcomes
when the current state has a matching type2 rule, evaluates requirements in
source order, changes state and resets the counter after a type2 transition.
Evaluation still runs on failure: an already-reached threshold can transition
without another increment. State2/3 have no observer mapping. A hidden default
row is created only when a rule actually mutates it, not for every original ID.

Additional read-only recovery:

- Repository2306684 builds every original stage, with saved-row binding and
  requirement vectors; the factory does **not** subscribe stage observers.
- Unlock manager20ffb34 visits the entire repository.20ffcdc registers its
  21000f8 callback only for nonempty rules and nonexpired stages.2304264 uses
  `endAt < now`; the final second is included and future startAt is not filtered.
- 21000f8 forwards the completed stage ID/outcome to2302b78.2302524 also emits
  `ExpeditionStageDisposedEvent` via2302790, not another completion outcome.
  Scratch evidence: expedition-peer-observer-scope/binding-exact-20261004-3.txt
  and expedition-unlock-manager-scope-exact-20261004-3.txt under .work.

`expeditionCompletionStages` now calculates the own broadcast phase plus every
subscribed peer transition. The native observer does not filter dispatchState:
an already-running repeat in state4 may be relocked1, then unlocked2, while its
timer remains active. Fresh collection permits these states only with a matching
captured peer-stage proof; it does not accept an arbitrary locked active save.

`expedition_stage_event` retains the listener-period anchor, exact subscription
set and sparse pre-effect saved rows. `expedition_stage_claim` retains each
changed stage's exact projected after-state and separately observed save flag;
its composite primary key serves pending lookup. `expedition_stage_floor`
retains actual observed rows/deletion tombstones. The stage/effect/operation
index finds the newest observed proof for each of the fixed227 original IDs;
missing or older floors recover without lifetime-history scans. There is no
native profile, counter, timer, signature or entitlement pre-credit.

New issues project the bounded pending queue in issued-ID order, reserving
peer effects without writing userdata. Save validation recognizes exact captured
prefixes, including later resets and known timer transitions; counter >= checks
would be wrong here. Stage-only saves may arrive before rewards/ACK and retain
observed proof across restart. ACK requires every affected peer/own effect to
have been observed, alongside existing item/CP/XP/SP/party proof. Profile/floor/
observed flags/queue/done/reply commit through the existing atomic save path.
Earlier pending snapshots cannot rewind a later observed floor. Original expiry
deletion remains allowed only for a non-dispatched projected row at endAt+90d.

Partially saved21000 is omitted from save replies to avoid firing counter events
twice, with its queue intact. Cached/fresh/cold confirm/login/pull re-delivery
recovers3000999 until ACK/reconciliation instead of inventing idempotence. Legacy
queues lack a recoverable peer baseline and also recover, never reminting rewards.
An observed20000 timer changed by a later peer event is likewise omitted from
save replies or recovered on other re-delivery paths: its older absolute baseline
must not overwrite the newly observed lock/counter state.
Unrecognized saved transitions or changed cold subscription periods preserve
the entire save/queue/history. The session anchor is an offline approximation
of native userdata initialization; exact native clock-boundary behavior remains
unverified. Historical tombstone re-materialization after an event-clock rewind
still requires reconciliation rather than silently discarding prior proof.

This is **source implementation only**. Actual native callback/save ordering,
delayed ACK behavior, naturally earned chained unlocks, hot/cold initialization,
disposal/UI listeners, signatures, gameplay stability and measured efficiency
are not proven. Issued-ID prefix ordering is a bounded compatibility rule, not
verified native ordering for every overlap. It is not full dispatch progression
acceptance or completed recovery/back navigation.

`friendship_reward_claim` binds the exact11000/21000 parameters and any CP
item expenditure baseline to the queued ID. `friendship_item_claim` records
each original item's quantity, native table/ID field and cumulative target.
Both handoffs join the existing shared acquisition reservation system, so
already-recorded mission/present/box/shop/PVE/character rewards cannot use the
same saved increase as a newly issued friendship/dispatch reward. The casino
branch uses the existing indexed `casino_reward_claim` with2000/6000/21000.

### Current hero-track and earned-point guards

Source-only follow-up, **NOT RUN/built/installed/native accepted**. The original
item wrapper `15d6340:15d6c54` and town wrapper `2210094:22109a0` both read the
current global hero for `userHeroType`. The town path also sets points locally
through `23eadfc:23eaf34` before submitting its request. Both original
operation handlers11000/21000 resolve each character and call the same
absolute `23e6b08` point setter used by stages. They do **not** select a hero
from the extra wire field. See the original binary hash above and exact
`.work/friendship-reward-confirm-exact-20261006.txt`,
`.work/friendship-reward-row-exact-20261006.txt`, and the item-wrapper entry
in `.work/friendship-reward-wrappers-exact-20261006.txt`.

Fresh11000 now binds its requested hero to the unique owned saved UserInfo
and character, validates original level and the native2000000000 point cap,
and rejects a baseline below a known earned floor. Fresh21000 already binds
the active hero to its actual saved party. Pending receipts for both types
require original single-hero, unique-character, bounded point/level targets.
ACK proof requires the correct unique owned character field within that cap,
not a duplicate row or another hero's points. Pending character saves cannot
delete these targets, change ownership or persist out-of-range points.

Unobserved delivery cannot retarget a result after a hero change, including
cached callbacks and cold login/pull/confirm. A UserInfo hero switch must
first save each target's points on its issued hero. After those points save,
a later hero change is valid: push suppresses only the now-wrong-hero
delivery while retaining the real operation and all inventory/timer/XP/SP/
party ACK proofs. Other wrong-hero callbacks cancel3000999 until ACK.
This is not full interrupted-effect recovery: partial ordinary inventory or
CP saves with the original hero still selected are not newly checkpointed
by this guard.

Each actual11000/21000 ACK now extends the existing `stage_friendship_floor`
checkpoint (name retained) for its positive original targets. At most three
rows per character, changed-ID indexed seeks and a queue-bounded operation
map are used, not lifetime CP history scans. Points, signatures, stat bits,
reward flags and profiles are not pre-credited. Floor/profile/ACK/queue/
sequence/reply commit together. Later higher points remain valid; deletion
or regression below an earned floor does not. No old completed claim is
given a fabricated historical floor. Cached native character/hero pulls
must match current durable state after any friendship claim.

NEW deferred `node tools/test_friendship_heroes.cjs` covers all three tracks,
wrong-hero requests/ACK/cached or cold delivery, ownership/duplicates/cap,
CP-before-hero-switch with pending loot, restart, old pulls, positive floors
and ACK/reply rollback. Extended friendship/dispatch checks select the
actual saved hero and cover21000 cached delivery/floors; independent point
arithmetic fixtures use separate disposable saves instead of rewinding
earned points. Native unsaved-hero/request/save ordering, natural earning,
received-flag production, CP-level reward UI/stat refresh/signatures and
usable cold/back recovery remain unverified; no runtime claim is made.

Rewards, original CP claim IDs, Iris, timer receipt, queue and response remain
inside the same request transaction. There is no pre-credit of native item
stock or signatures. Acknowledgement requires saved CP/timer state **and**
unique owned mapped inventory reaching each target; a CP flag or completion
date alone cannot discard those rewards. Casino proof is UserCasinoState,
not an invented ordinary UserCurrency row.

CP-item expenditure compares stock minus cumulative acquisition with the
captured before values. A later gift does not hide consumption or incorrectly
make valid remaining stock exceed an obsolete stock-only bound. Saved deltas
may precede ACK across process restart; later legitimate spending does not
erase lifetime acquisition. `friendship_item_floor` retains the actual observed
cumulative acquisition at ACK, with indexed per-item lookups and profile/ACK/
floor/queue changes committed together. Rewind/deletion and missing retained
floors reject; missing legacy baselines are not reconstructed from post-award
balances or received flags.

`expedition_xp_claim` captures the actual saved party/owned gear inputs, both
float32 multipliers, boosted XP, saved/reserved XP baseline, capped XP target
and a separate observed native party-deletion bit.
Dispatch Valis now reserves its **boosted** per-row quantities in the existing
shared item ledger; the temporary two-way Valis serialization is removed.
Recorded present/dispatch rewards reserve separate increases in either issue
order. XP targets use indexed newest reservations, not a lifetime history sum.
The source rejects signed-int32 multiplication overflow and ordinary acquisition
saturation rather than inventing a cap grant. All frozen boosts are nonnegative;
negative/newer effects are not silently supported.

XP/derived level, native party deletion, timer, CP and all recorded inventory
effects must be saved before21000 ACK. `expedition_xp_floor` retains actual
observed XP with an operation binding, including an XP save preceding ACK,
atomically with profile/queue/floor changes. Rewind, deletion, malformed levels,
missing retained floors and dangling receipts reject without fabricating XP.
XP uses original int64 thresholds; PVE's player capture no longer rejects valid
experience merely for exceeding signed int32. No XP, SP or gear/signature is
pre-credited by the server.

The XP receipt now also records the sum of the original maxSP for **every**
gained level, its reserved normal-SP baseline/minimum and an observed-save bit.
It joins the existing gift/mission/normal-Iris reservation path rather than
creating a second wallet or pre-crediting UserInfo. Unobserved pending effects
reserve separate targets up to the native cap; observed effects may already
have been spent and do not reserve again. A UserInfo save must reach both this dispatch's XP/derived
level and SP target before marking its level-up SP observed. SP alone cannot
observe an unsaved XP level-up. ACK requires that observation or the proposed
save's matching evidence, atomically with the profile, XP floor and queue.
After observation, legitimate spending before or after ACK remains valid:
there is no permanent SP floor.

No gained level records zero SP fields. A positive level-up at the signed-int32
SP cap retains the original quantity and capped target; this real native
saturation is not a fabricated refill and does not reject the XP award. The
existing gift/mission/refill full-cap rejection policy is unchanged. Old XP
tables receive nullable SP columns only; a retained pending row without these
baselines cancels3000999 and stays queued, never backfilled from later balances.
Legacy completed receipts and other XP/SP producer provenance remain gaps.

Pending delivery keeps the captured bonus inputs; prospective saves may retain
them or delete the party as the native collection does, but cannot replace
the pending booster party. An actual saved deletion is now an explicit receipt
effect. Save replies still omit immediate21000 redelivery. Cold
login/pull/confirm can resume only when each earlier effect is untouched with
captured multiplier1 or completely saved and independently skipped; a native
marker skips only the already-saved second party deletion. Boosted unsaved
effects, legacy unobserved absence and saved stage prefixes still cancel. The
queue and required ACK proof remain, and gear becomes independent after ACK.

Fresh/pending/cached delivery, confirm, login and fresh/cached binary pulls
validate the new receipts. Unknown or corrupt history cancels3000999 with the
queue/save/wallet preserved. This can still block login until explicit
reconciliation; it is not a completed legacy recovery or usable-back-navigation
claim. Unexpected database failures remain failures, not fake successful ACKs.

## Deferred acceptance

### CP received-flag persistence follow-up

SOURCE ONLY, DEFERRED / NOT RUN. Completed read-only original recovery now
establishes the four fields `userId`, `rewardId`, `receivedAt`, `isReceived`:
exact260f150:260f3d0 MessagePack and260eb50:260ee58 JSON parsers; literals at
31beaa4/350041c/358b7f1/358b7fc. The first three are protected LONGs at row
offsets0/30/60, the last a protected bool at90. Constructor260e3d0:260e4dc
initializes them to zero/false; dirty bytec0 and internal markerb8 are NOT extra
wire fields or a guessed signature. Native27f55c8 and26c7630 key by rewardId.
Evidence: `.work/friendship-received-flags-exact-20261006.txt` and first four
complete sections of `.work/friendship-reward-model-exact-20261006.txt`.
The latter's final2510b4c:2510b94 section is truncated and MUST NOT be used.

Original23e8d78/23e9fec/23ea0a4 are vector helpers, not received-flag setters.
The bounded immediate-call scan found260e778 only in the two row parsers;
this does NOT establish that flags have no indirect producer. The complete
original11000/21000 instruction ranges contain item/CP application, not a
direct received-table mutation. Therefore received flags are optional separate
saves, NOT a newly required client ACK effect and NOT inventory-delivery proof.
Native received-flag production, owner/date rules and publisher ownership remain
unrecovered; local zero/owned row acceptance is an offline compatibility policy.

The shared native-ID merge now rejects duplicate/malformed IDs. Reads and saves
require the original known reward and complete typed fields; truthy strings or
numbers no longer silently suppress real rewards. Invalid imported flags stay
untouched/unavailable and are no longer converted into issued claims on startup.
Valid old received rows retain their existing suppression, without inventing
historical producer/time proof. Missing legacy producer bindings remain NULL.

Fresh11000/21000 issuance privately binds each actually issued original reward
ID to the existing friendship_reward_claim operation. No rewardIds field leaks
onto the wire. New true flags require that actual queued/completed producer and
its captured original character/hero/earned level; they cannot forge an unrelated
or unissued reward. Three nullable columns on the existing friendship_reward
table retain producer ID and actually observed owner/time. A partial index covers
only observed flags; neither native userdata nor a historical flag is precredited.
Existing profile/save/queue/ACK/sequence/reply transactions commit flag checkpoints
atomically. Saved received flags cannot be deleted, unreceived or have owner/time
rewritten, across restart, ACK or stale cached binary pulls. Flags alone leave the
queue and full item/CP/quest/voice/XP/timer/party requirements intact.

New `test_friendship_received_flags.cjs` queues all three heroes, flag-first and
post-ACK saves, zero/local owners and zero/positive dates, private wire binding,
unissued/missing legacy proof, malformed/duplicate/foreign fields, unchanged real
userdata before issuance, received-only incomplete ACK/delivery, stable floors,
restart/missing profile proof/stale pulls/repeat reward suppression, corrupt import
preservation and checkpoint/profile/reply rollback. The existing real21000
dispatch fixture adds an explicit synthetic flag-only save and negative ACK.
All are DEFERRED / NOT RUN, not native production or client signature proof.
The original master and actual player save/listener/APK/MuMu remain untouched.
CP stat callbacks/received-flag production/achievement effects, legacy recovery
and native earning/render/back/no-crash-ANR/performance remain incomplete.
175 routes103 partial/72 unsupported/zero complete; no workers/Actions, co-op last.

`node tools/test_friendship_rewards.cjs` and updated friendship, expedition,
general server and disposable Android HTTP probes are written **NOT RUN**.
They use original reward IDs/quantities with synthetic prerequisites and saves,
cover table mappings, missing inventory, CP-item conservation, casino,
overlapping present/boosted dispatch reservations in both orders, fixed/custom
gear bonuses, XP/level and party-deletion proof, partial-save redelivery
suppression, XP99/100 boundaries, values above signed int32, original maximum
level, split save/restart, spending, completed floors, preserved missing receipts
and transaction rollback. Added SP cases cover per-level sums, no level change,
full/near-int32 caps, XP-before-observation proof, both expedition/present and
expedition/refill issue orders, observed-but-unacknowledged spending/reuse,
nullable legacy migration, corrupt receipts and SP-observation/ACK/reply rollback.
These are synthetic lower-bound reservations, not exact native refill totals
when another queued effect changes level. Updated master provenance probes are
also NOT RUN.
Added party cases defer all three active hero tracks, both main/assist paths,
duplicate-character multiplicity, wrong saved levels despite recomputed totals,
substituted/missing/foreign/unjoined/guest/unmapped units, invalid progression,
owned userId0 party initialization, original character joins/hash and shared
element/PVE capture regressions. Fixtures are synthetic owned prerequisites,
not earned PCs or native unit stats/skills/signatures.
These fixtures are not native signatures/effects or
natural earning proof. Syntax checks and audit/checklist generation alone are
not gameplay tests.

Added source-only stat fixtures defer all-three-track accumulation and CP
threshold boundaries, CP-before-percentage, unopened lazy boards, original
repeated effects, saved row reordering, first-pass weapon exclusion, positive
limit-break inclusion, missing exports even on closed panels, malformed/
foreign/duplicate CP/board rows and nonempty legacy lists. Dispatch handler
cancellation cases use whole-database unchanged snapshots; these are written
but NOT RUN. Added fixtures cover original rank gates versus currentJobIndex,
weapon type/kind/absence, repeated effects, kind128, a closed first replacement
marker with an open second marker, limit-break exclusion, ascension level0..6/
unlock/group/flat ordering, and the aggregate owned chain. Fresh dispatch cases
reject altered stats and stale CP-derived totals without database changes.
The owned source chain is wired, not independently native-verified.

Added completion-rule fixtures defer all failure/normal/great states on
empty-rule, ordinary-rule and original self-cycle stages, preserved timestamps
and counters, missing/malformed rule exports, wrong ownership/duplicate rows,
counter/attempt-time tampering, and real-handler normal-rule ACK/recovery with
whole-database rollback checks. Master provenance covers112 sources and the
368/288/144 requirement counts. These scripts are written **NOT RUN**; original
metadata and synthetic completed saves are not native event/save/ACK proof.

New `test_expedition_progress.cjs` is also **NOT RUN**: original scope/future/
end/self-cycle/threshold branches, lazy predecessor rows, normal/great counters,
failure threshold evaluation, active timer relock/unlock, two disjoint synthetic
owned teams collecting original026/028, a pending repeat20000 across those
peer events, separate stage-save/restart/reward-save/batch ACK, suppression of
counter/timer replays, prior-prefix/missing-floor rejection, and injected
claim/floor/profile/reply/queue/ACK rollback. Synthetic preplayed stages and
owned units are prerequisites only, not naturally earned gameplay proof.

Still incomplete/unverified: native hero-track selection and CP stat effects,
non-item CP eligibility, actual native bonus/XP/level/SP proof, publisher expedition RNG,
additional-group passive eligibility, native acceptance of request stat/character
congruence with the saved party, guest/equipment owner variants, concurrent other XP producers, unlocks/
clear counters, all other inventory producers, native hot/cold effect-save-ACK
order and cancellation navigation. No complete-feature or crash-fix claim.

## Latest CP-level voice save follow-up

The original23e6b08 changed-active-level callback now uses shared communication voice capture/receipt/effect proof through the existing friendship_unlocks JSON. Own-hero CP thresholds and global costume voices are observed independently of points/quest flags;11000/21000 and shared stage ACKs require actual voices, with existing indexed costume floors and stale-binary-pull protection. No costume auto-grant/selection/join-time change, native precredit, new SQL table or wire field. Unchanged levels stay voiceless; changed-level legacy receipts missing captures are preserved/unavailable. See [the shared acquisition contract](character-acquisition-contract.md) for bounded original instructions and remaining gaps.

New `test_friendship_voices.cjs`, extended quest/hero checks and explicit synthetic shared stage/CP/dispatch ACK fixtures are **DEFERRED / NOT RUN**. They are not natural eligibility, signed native callbacks or multi-character dispatch acceptance. CP reward stats/received flags/achievement effects, other voice producers, legacy usable recovery and native earning/order/render/back/no-crash-ANR/performance remain incomplete.175 routes103 partial/72 unsupported/zero complete; actual player save/listener/APK/MuMu untouched, no workers/GitHub Actions, co-op last.

## Latest native battle-stat foundation (not refill-save integration)

Original23e6b08:23e7564 refreshes every eligible owned PC matching the character
after an active CP-level change.23e758c scans original **PCs**, not CP rewards;
22eba54 performs native repository/guest eligibility.22d0f90 recalculates the
stat maps, then22d0d30 fills HP and MP. HP22d1774 uses kind1/true at22d5bb8;
MP22d17f0 uses kind64/false.26115ac/26116bc write protected UserPC fields and
dirty the row only if changed, asserting each result is below100000. The
dispatch map alone is therefore not sufficient to implement those refills.

New pure `pcBattleStatus` reuses the existing owned dispatch component chain
and applies the ordered native equipment effects after the dispatch-map copy
22d0c14.22d6bf4 mode1 adds base,16 adds percentage,32768 adds an HP/MAG factor
bonus,8192 **sets** its override. Other combat maps do not alter these eight
base stats.22d5d04 chooses a nonzero override before the bonus; otherwise
signed-int32 ADD to10000 clamps at zero.22d5bb8 then uses signed MUL W/SDIV
and minimum1 for HP/MAG only. MP is not scaled. Dispatch retains its original
false argument and seven-kind total. No source calculation writes player HP,
MP, signatures, profiles, queue receipts or floors.

Original259c678/259c740 compares **0x4000=16384**, not4096. Its amount selects
equipmentAbilityValuePcRarity.slot3. The new68-row export preserves source
order and actual slots4..10: rank, limitbreak, level, ascension, effect mode,
mask, amount.259cab8 qualifies a later rank immediately; positive ascension
thresholds are independent of the ordinary level/rank/limitbreak/board gate.
259cf94 selection1 clears previous matches;259cba0 otherwise groups by **mask**,
adds signed amounts, and retains the first matched effect mode. No absent
debug-group rows are fabricated. Source SHA256:
`b4a6566ec83ef0298dfdfdc1125baaa63c9436ea42ae21dbf3411ae3bf084025`.
The159-source export preserves all prior158 source hashes and other master
values. Exact bounded read-only analysis outputs are
`.work/cp-battle-stat-equipment-exact-20261006.txt`,
`.work/cp-battle-provider-bind-exact-20261006.txt`, and
`.work/cp-battle-equipment-vector-exact-20261006.txt`; all jobs exited0 and
discarded project changes before artifact inspection.

**At the foundation-only checkpoint, unimplemented:** collecting the full eligible owned gear vector
(fixed/saved/evolved/durability and guest variants), the original board gate,
changed-level HP/MP capture and split-save/ACK proof. The calculator requires
an explicit complete ordered ability vector and board boolean; it does not
guess either. Native22e47dc visits weapon before armour and259867c supplies
each gear vector. A permanent HP/MP floor would incorrectly forbid later
combat spending and must not replace callback-specific observation.

## Prior owned gear and modern-board stat provider (before refill-save integration)

Pure `pcOwnedEquipment`, `pcBoardIsComplete`, and `pcOwnedBattleStatus` now
connect actual local ownerType1 gear/modern job rows to the stat calculator.
Existing equipment slot/row validation is shared with inventory and dispatch;
borrowed snapshots still require explicit `true`, never Array.every's index.
No new database/wire fields or player/native writes are introduced.

22e47dc visits weapon before armour.259867c concatenates saved five IDs
(2597434), fixed master slots30..34 (259784c), then evolution vectors
(2597a50). Zero IDs disappear; duplicates remain additive and retain order.
22e3fac/22e4358 resolve actual saved weapon/armour slots.25835ec dispatches
1..500 versus10001..10500;2583748/25838bc match UserEquipment.slotIndex
without checking durability. Thus broken equipment still enters this particular
stat vector. A missing positive equipped slot is deliberately unavailable in
the offline provider, not silently treated as bare gear. Guest and legacy
variants are not invented.

The new1,664-row original `equipmentEvolve` export contains slots0/1/2/5:
row ID, equipment ID, rarity, ability-group ID.29afeb0 names the original
table;29bb2c0 loads it;22a378c indexes slot1 and22a4bbc retrieves that vector.
20fdfbc takes its **first** slot2 rarity match.259539c constructs consecutive
steps **base+1 through12**, stopping at the **first missing row**, and2581938
collects each slot5 group's original evolution-content rows in source order.
Empty group0 is valid.2599718 returns **MAX(saved rarity, original base)**;
2597a50 consumes constructed groups at or below that rarity. XP/performance
are not rarity gates. The original cap12 is raw4326e40 ->34aa3f0; the bounded
loop25957b0..25957c4 confirms its inclusive endpoint.

Source SHA256:
`0e2b19c9e6d7d3a1d9343300979394639f7c9c321f5652291924f9bf8ef5225d`.
The160-source export retains every prior159 source hash and master value:
prior-source JSON digest `3da209827ba9d8ee98c450a9013c92de17c63d61369b6fef891df03ca445f8d7`,
prior non-source projection digest `18b3d9108f8c8f6cec53d16ab434571cd43f193aef5dd62fadb25386753b9d65`.

22d3b74 first uses22ca7a4 to check **all actual current-job panel bits**.
Current original rank is compared with the last normal original job rank,
not the saved job index. Before the last rank, or without positive LB, a
completed current board qualifies. At the last rank with LB,22ca9ec checks
only indices **LB*5-4..LB*5**.22cacdc tests whether those bits are closed;
22cc618 permits them only when eligible22cab50 and index<=LB*5. For the
original extra job7 at final rank with positive LB, those eligibility checks
hold. Older LB groups and display flag bit25 do not enter this gate.

Read-only exact jobs `.work/cp-owned-equipment-provider-exact-20261006.txt`,
`.work/cp-gear-vector-constructor-exact-20261006.txt`,
`.work/cp-gear-evolution-join-exact-20261006.txt`,
`.work/cp-owned-equipment-lookup-exact-20261006.txt`, and
`.work/cp-refill-owned-eligibility-exact-20261006.txt` all exited0/discarded
project changes before inspection. Original bounded ASM additionally supplies
the table binding, MAX rarity getter, cap and board eligibility branch.

Extended `tools/test_pc_battle_status.cjs` and original master checks are
**DEFERRED / NOT RUN**. Cases cover ordered/broken/duplicate gear, saved
rarity0, missing slots, evolution source order/gaps/cap12, current/latest-LB
panels versus older/display bits, malformed/legacy inputs, shared composition
and no mutation. Existing equipment-reward/stage-guest/dispatch/stat/CP/save
and recovery/native checks also remain queued. Source parsing and syntax are
not natural gameplay acceptance or a verified persistence fix.

**Still unimplemented:** CP callback all-owned/guest eligibility, changed-level
HP/MP captures, split actual observations/ACK and later legitimate spending.
22eba54 now has exact lookup evidence: original PC identity, then guest
eligibility with a current user-state override.22e5ac4 checks an attached guest
runtime flag; it is not a guessed joiningState filter. Guest lifecycle and
that override are not implemented here. No permanent HP/MP floor, server
precredit, signature fabrication or completed-route claim is introduced.
175 routes remain103 partial/72 unsupported/zero complete; all native visual
acceptance pending. Actual player save/listener/APK/MuMu untouched; no workers
or GitHub Actions, co-op last.

New `test_pc_battle_status.cjs` and extended original master checks are
**DEFERRED / NOT RUN**. Synthetic vectors/board booleans prove no native
provider, signature, actual refill, natural earning, save order or rendering.
Syntax/whitespace checks and original-data/audit generation are not gameplay
tests.175 routes103 partial/72 unsupported/zero complete; actual save,
listener, APK and MuMu untouched; no workers or GitHub Actions, co-op last.

## CP refill save checkpoints and ACK (source only)

Changed active CP **level**, not merely points, now attaches a refill capture
to the existing `friendship_unlocks` JSON used by11000,21000 and covered stage
callbacks. It records the relevant original catalog hash, three captured hero
tracks, every matching saved owned PC, growth/modern boards/equipped gear,
actual before HP/MP and native post-CP maxima. No SQL table or native wire field
is added; no health, CP or signature is precredited.

Exact22eb3d0:22eb94c builds the runtime repository from every saved UserPC at
profile+2d0/2d8, with no current-party or joiningState filter.22eba0c and
22d8a90 create the actual original-ID/saved-row domain unit.22d8de8 attaches
the first original PCGuest regardless of joiningState.22e5ac4 checks its
runtime guest flag, not a join flag.22d83c4 clears that flag at the original
permanent-EXP marker, so actual permanent GuestEvent ownership can use the
recovered owned stat chain. Temporary guests remain unavailable:22d8614 uses
original start/end and service clock, and22eba54 additionally consults the
current native user-state override through2170c3c. Its profile+c28/c30 table
meaning and guest stat providers have not been recovered. No guessed party,
userId or processing flag substitutes for them.

Original246c564 acquires gained PCs **before** applying friendshipStates.
Consequently, a stage awarding a fresh matching PC and a changed CP level
remains unavailable until its native initialized health baseline is recovered.
An invented zero/maximum baseline or silently omitted fresh unit would be wrong.

26115ac/26116bc dirty protected HP/MP only when the value changes. Capture
therefore marks each field required only when its actual before value differs
from its recovered maximum. Existing operation `observed` JSON retains
`cp-hp:<pcId>` and `cp-mp:<pcId>` independently. Saves may arrive before or
after CP, quests and voices; partial delivery is suppressed without deleting
the queued operation or waiving mixed ACK. Observed halves cannot rewind;
every matching unit must retain its growth, gear identity, captured hero stat
levels and full native stat result. Lazy modern boards may materialize when
the native stat result is identical. Required fields do not gain permanent
floors: after ACK, legitimate battle damage and MP spending remain allowed.
Cached pulls of PC/boards/equipment/guest state are compared with current
saved state and cannot restore older health or stat inputs.

All observations reuse the existing atomic profile/checkpoint/operation/reply
transaction. Same-character CP producers serialize until ACK. A changed-level
legacy receipt missing its before-stat capture stays queued and unavailable;
it is not reconstructed from possibly already-saved post-callback state.

The read-only exact job `.work/cp-refill-repository-scope-exact-20261006.txt`
(22eb3d0:22eb94c,22d8614:22d8730,2170c3c:2170d20) exited0 before inspection.
Bounded original ASM supplies missing tail/getter branches. Existing exact
setter, guest lifecycle and ordinary-stage artifacts establish ordering and
ownership scope. Original160 master sources remain unchanged this phase.

New `tools/test_friendship_refills.cjs`, the real21000 dispatch extension,
and explicit shared synthetic refill fixtures are **DEFERRED / NOT RUN**.
The new check queues plain/item/stage and all three heroes, multiple matching
units including an unjoined variant, HP-first/CP-first saves, missing MP/early
ACK, restart observations, observed rewind/deletion/growth/inactive-level
changes, legacy/corrupt captures, ACK rollback, stale pulls and legitimate later
damage/spending. Voice-only fixtures remain voice-only; quest/voice/hero
negative suites explicitly supply other providers without hiding their target
missing save. Unchanged health-field and guest/new-unit/native scenarios remain
on the consolidated checklist.

No test, listener, player DB write, build/install or emulator interaction ran
in this phase. Syntax and audit/checklist generation are not natural maxima,
signatures, dirty-save ordering, native callback, rendering or stable-play
proof.175 routes remain103 partial/72 unsupported/zero complete, all175 native
acceptance checks pending. Temporary guests, first acquisition/legacy board
providers, mixed-mode native save semantics and usable interrupted recovery
remain incomplete. No workers or GitHub Actions; co-op last.

## Latest ordinary fresh-unit CP refill stat initialization (source only)

This supersedes the prior fresh-matching-unit unavailable branch only for
ordinary non-guest stage acquisitions. The common initializer22ebbbc reads
vtable offsets0x5e/0x60: original PC **slots45/46**, not47/48.22d2ecc resolves
starting level to original EXP;22dffa4 ->22dfa18 maps starting rank to its
ordered job index. The new separate `pcInitialStates` projection exports all
1,368 original pairs: every starting level1, ranks1=338/2=31/3=67/4=932.
Every starting rank equals its first original job rank; the original level1
EXP is0. A rank2 unit such as Lili therefore uses job index1, not Bell's rank1.

22e6c3c/22e6c84 allocate the actual protected UserPC through2610a64.
That constructor and owned setup22dba90 establish owned type1, initial index1,
zero EXP/LB/ascension, no equipped slots or legacy jobs, and a fresh lazy
UserPCJobSet.22d8de8 initializes missing skills, constructs the stat provider
through22cec38 and performs full HP/MP before the common add finishes.
22ebbbc subsequently adds original starting EXP0, maps to the same first
job index, then joins the unit/character.22cfa24 refreshes stats and fills only
positive HP/MP increases; adding0 leaves these starting values unchanged.
The native246c564 stage callback acquires the PC before applying CP changes.

`pcInitialStatInput` supplies only these private calculator inputs. It does
not invent skill slots, signatures, verifiers, full native rows or saved HP.
The shared owned calculator obtains the initial before-CP maxima from actual
captured three-track character points and the original lazy board/passive/
growth providers. It then obtains the post-CP maxima through the same path.
Fresh guests still require their original runtime eligibility and stat
providers; their zero/lazy GuestEvent is not invented here.

Stage capture binds fresh matching PC IDs to its existing `pc_before` and
`pc_targets` receipt. Only those IDs may be absent from the pending matching
roster until their real native unit saves arrive. Their private initial stat
inputs, before HP/MP, original starting-catalog hash and post-CP targets are
recomputed and checked on receipt/replay. Missing or changed input/legacy
capture remains queued and unavailable. Existing owned-only refill captures
retain their previous catalog hash, since no old master projection changed.
The same split HP/MP observations, actual board/unit/character/wardrobe/
stage/XP/CP requirements and atomic mixed ACK continue to apply. No new SQL
table, native wire field, precredit, extra reward or permanent HP/MP floor.

Read-only exact jobs `.work/cp-fresh-pc-initial-input-exact-20261006.txt`
(2610a64:2611148,22cec38:22cef6c,22dfa18:22dfd78) and
`.work/cp-fresh-pc-level-setter-exact-20261006.txt`
(22cf8a8:22cf9cc,22cfa24:22cfd34,22d2ecc:22d2fac) both exited0 before
inspection and discarded project changes. Bounded original constructors and
the relocated stat vtable42a83e8 establish call targets; original-master
diagnostics establish all starting pairs, not emulator acceptance.

All160 source hashes are unchanged (source JSON digest
`edc93cce3032d5770cf599acc2f0f3c7015a66096fee36f29b954b7fefbb5d03`).
Removing only `pcInitialStates` yields the unchanged prior master projection
digest `ac31c03d38d47f226b884fb6420c00c78900ac51ffd76e20ed3b7404f36789c7`.
No archived values are replaced and no community quantities are introduced.

Extended `test_friendship_refills.cjs` adds an ordinary Lili acquisition plus
CP level20 in both unit-first/CP-first save orders, restart, missing mixed ACK,
and corrupt initial-ID/catalog/HP inputs. Extended `test_pc_battle_status.cjs`
checks the private projection and missing/wrong catalog cases;
`test_master_data.cjs` checks every original starting level/rank mapping.
All are **DEFERRED / NOT RUN**. Synthetic Bell-shaped saved-row shells are
explicitly not proof of Lili's actual skills, signatures, earning or defaults.

Full native initialization/signatures, temporary guest clock/user-state/stat
providers, native mixed dirty-save ordering and callback acceptance, legacy
recovery and visual stable play remain pending. Syntax/source regeneration
is not gameplay testing.175 routes103 partial/72 unsupported/zero complete;
actual player DB/listener/APK/MuMu untouched, no workers or GitHub Actions.

## Latest saved temporary-guest CP refill (source only)

This extends partial `character/friendship/complete` and its shared stage/
dispatch/save paths. It supersedes the earlier temporary-guest-unavailable
statements for **already saved** guest PCs and GuestEvent rows only. Fresh
guest acquisition and lazy missing native-row initialization remain gaps.

Bounded original23e6dac:23e6e74 calls repository22eba54 with force0. A null
lookup skips only that PC's refresh/fullHP-MP, not CP or ordinary sibling PCs.
22e5ac4 reads DomainPC+108 guest component/+38 temporary flag. Existing
22d83c4 permanent-marker classification remains unchanged. For a temporary
guest,22d8614:22d8730 reads the first original PCGuest start/end and calls
2a3a5dc:2a3a61c: positive start is inclusive, positive end exclusive, nonpositive
bounds are unrestricted. A failed window check additionally permits the
2170c3c:2170d20 saved-adventure override. No joiningState/party filter applies.

2170b6c:2170be4 reads UserData+C28/C30. The bounded original MessagePack
dispatcher277e5fc:277e638 maps this to `adventureState`; `townCommunication`
is the NEXT key at277e63c, not this table. JSON2674270:2674c80 maps original
string34b7e0c=`stageId` to266f7b4:266f894, which writes protected LONG+30.
2170c3c tests exactly this value>0. Negative/zero stage IDs are inactive;
no guessed stage existence or invented processing flag replaces the predicate.
Missing, duplicate, foreign or malformed singleton rows remain unavailable.

22d8de8 installs22cec38's stat provider at DomainPC+50 BEFORE attaching the
guest component at+108. Its original vtable42a83e8 has refresh+80=22d0f90,
level+88=22d3e64, EXP+B0=22cfa18. The latter reads UserPC protected totalExp
at+58;22d10b0 derives regular PC growth, not GuestEvent EXP. The recovered
owned growth/boards/CP/ascension/equipment chain is therefore reused for an
eligible saved guest. No second guessed guest-stat calculator is added.

The existing private `friendship_unlocks.refills` JSON gains optional
`guestRuntime:{at,stageId}` only when a captured saved guest is temporary.
All matching PCs remain captured, including unjoined and inactive guests.
Eligible temporary guests require the same actual post-CP HP/MP checkpoints
as ordinary PCs. Expired inactive guests get a private `eligible:false`
target with no required health mutation; their roster, guest identity and
captured EXP must still be retained. They do not cancel ordinary sibling
refills. Already-owned/permanent/fresh ordinary receipts keep the same keys
and catalog hash. Missing/corrupt temporary runtime captures are retained,
not backfilled from current state.

Before the first same-character CP or required refill checkpoint, fresh/
cached delivery AND save validation reject changed eligibility, including
expiry, an opening window, adventure override changes or permanent promotion.
After such a real saved checkpoint, the original eligibility/health scope
stays pinned through subsequent clock/adventure changes until full mixed ACK.
This is an explicit conservative offline replay policy, not evidence of native
callback timing. It prevents replay from inventing/skipping a health obligation.
There is no SQL schema/native wire change, health/CP/guest EXP/ownership/
signature precredit, manufactured ACK or permanent health floor. Later battle
damage remains legal after genuine ACK.

Existing stage/CP cached binary freshness lists now also include
`UserAdventureState`: an old pull cannot restore a different guest override
after the native row changes, including after ACK/cold restart. Fresh pulls
still expose the actual current row/token. The deferred saved-guest check
also covers this adventure-only stale-versus-fresh pull boundary.

Read-only exact jobs `.work/cp-temporary-guest-runtime-exact-20261006.txt`
(22e5ac4:22e5ae4,2170b6c:2170be4,2170c3c:2170d20,22eba54:22ebbbc) and
`.work/cp-guest-adventure-state-exact-20261006.txt`
(2674270:2674c80 plus adjacent row inspections) exited0 before reading and
discarded all project changes. Bounded original raw instructions and vtable
values resolve PIC/tail ambiguities. All addresses here subtract Ghidra's
extra0x100000 bias; the ELF hash at the top of this document is unchanged.

Extended `test_friendship_refills.cjs` queues both original guests, all three
heroes, start-1/start/end-1/end, signed inactive stage IDs, positive adventure
override, unjoined roster, ordinary siblings, split HP-first/CP-first saves,
cold restart, missing halves/early ACK, guest/PC deletion, original permanent
markers, corrupted/missing captures and ambiguous/foreign/malformed singleton
rows, fresh/cached eligibility drift, unchanged guest EXP and later damage.
**DEFERRED / NOT RUN**; synthetic row shells/signatures are not native proof.

Native callback timing/maxima/save order/signatures, actual guest lifecycle/
EXP earning/reset/lazy construction/fresh acquisition, full initialized
skills/defaults, legacy usable recovery, visual back/render/no-crash-ANR and
performance remain unverified or incomplete.175 routes107 partial/68
unsupported/zero complete. Original master/actual player DB/listener/APK/MuMu
untouched; no workers or GitHub Actions, co-op last.

## Current: absent native character before CP

SOURCE ONLY; all functional/synthetic/native checks **DEFERRED / NOT RUN**.
The original absent CP getter returns0; its setter lazily constructs exact
character ID with owner0/state1/three zero CP tracks. The shared stage and
explicit CP handlers now privately capture that role instead of requiring
an existing row. Actual native initialization, gained points, health/mana,
quests, voices, item spending/rewards and other mixed saves remain required
before real ACK. No profile/wire/signature precredit or guessed CP earning.

Constructor presence checkpoints independently. Missing/corrupt roles and
owner/state/untouched-track mismatch retain queue/save unavailable; observed
rows cannot delete. Zero CP at real ACK reuses the current CP-floor table to
preserve initialized-row presence, and bounded cold-read floor validation
rejects missing/rewound saved progress without resetting it. Earned CP and
indexed unit-character receipt minima cannot become a new zero baseline.

Exact read-only extraction, original addresses and queued tests are recorded
in `stage-reward-contract.md`, section **Current: lazy character initialization
before CP**. Extended `test_friendship_refills.cjs` and `test_stage_units.cjs`
cover all three heroes, direct/item/stage sources, constructor/health/unit/
guest/CP-first, no level-change/zero CP, role corruption, missing/foreign
rows, other-track changes, full mixed ACK, original both guest acquisitions,
earned-row loss, floor/observation/ACK/reply rollback and cold restart.
**NOT RUN**; synthetic shells/signatures/gains are not native acceptance.

Independent acquired-character floors outside existing unit/CP receipts, original natural earning and
producer overlap, full defaults/signatures/stat/save/callback/UI/recovery/
no-crash-no-ANR/performance remain incomplete or unverified.175 routes107
partial/68 unsupported/zero complete; actual player DB/listener/APK/MuMu and
master/archive unchanged, no workers/GitHub Actions, co-op last.

## Current: dispatch lazy-character caller integration

SOURCE ONLY; functional/synthetic/native checks **DEFERRED / NOT RUN**.
This extends `expedition/complete` operation21000, not a new complete route
or evidence of native playability. It supersedes the earlier missing dispatch
party/stat caller integration, without changing its eligibility/rate gaps.

Re-read exact original `2308378:2308ca4` in
`.work/expedition-entry-character-exact-20261004.txt`: request CP uses
`23e5a2c`, then `23e7d60`, independently of PC level and dispatch status.
Re-read `2308e08` in `.work/friendship-expedition-items-exact-20261004.txt`:
the CP callback resolves original character identity and calls `23e6b08`.
The previously recovered lazy initializer applies to this caller too.
Current bounded original ELF disassembly, exact FDE `23e8c68:23e8d78`,
confirms `23e8cd0` calls `23e5afc`, `23e8cdc` derives its original CP level
and `23e8cf8` filters the original stat rewards. Combined with the recovered
three-hero `23e8a74` loop, an absent row uses zero points on all three tracks,
not invented zero stat bonuses. All Ghidra addresses subtract `0x100000`.
Original ELF/master hashes are unchanged from the preceding section.

Party-stat calculation and completion CP validation now reuse
`friendshipCharacterBefore`. Genuine absence uses only the private
owner0/state1/three-zero-track projection. Duplicate, foreign or malformed
saved characters and lost acknowledged CP/unit-character progress remain
unavailable, not reset. Main/assist owned joined units, original character
mapping, exact level/status multiset, active hero, reported current CP and
repeated-character agreement stay required before any reward roll, claim,
currency grant or queue insertion. No native row, signature, CP value or
private initializer marker is added to wire data by this integration.

The existing21000 private capture/effect/ACK path now receives this role.
Constructor presence and gained CP observe independently; real native row,
inventory, XP/SP, timer/peer-stage effects, party deletion and any changed
quest/voice/refill obligations still determine full ACK. Existing CP floors,
pending observations, source-receipt validation and atomic profile/queue/
floor/done/sequence/reply handling are reused; no new schema or handler.

Extended runnable `node tools/test_friendship_rewards.cjs` is **NOT RUN**.
Queued all-hero/main-assist duplicate-character cases cover constructor-first
and CP-first; no native precredit/private wire marker; missing constructor
at full mixed ACK; owner/state/point/untouched-track mismatch; altered pending
request; unobserved restart/redelivery; constructor/CP observations; observed
deletion; cached-result and old native-pull rejection; observation/floor/done/
reply rollback; real mixed ACK; earned CP rewind/deletion and cold profile
loss with retained floors. Synthetic constructor shells/signatures/parties,
units and raw fixture mutations are not natural eligibility or native proof.
Existing changed-level dispatch refill/quest/voice, gear/XP/SP/item/clock/
stage/save/recovery/Android/launcher checks remain deferred.

## Current: dispatch XP/casino/item interrupted callback

SOURCE ONLY; tests, patcher, build, install and native acceptance are
**DEFERRED / NOT RUN**. Original ARM64 operation21000 retains its root JSON in
X21. At `2308ee0` it tests the positive XP quantity and calls the additive
XP/level/SP path before hard currency, gained items, friendship effects, party
removal and expedition-stage completion. This creates bounded recoverable
prefixes when UserInfo, the direct casino state and/or exact gained-item rows
persisted but every unrelated later effect did not.

`expeditionColdRecovery` accepts positive exact saved XP with its required
level-up SP observation. It also accepts an unsaved boosted XP amount only after
the captured party deletion is durably observed and the exact receipt amount is
retained as the native replay control. Iris may be zero or positive only when the operation's
gem rows plus bound original type5 CP claims exactly equal `issueAmount`.
Generic `DomainCurrency::setAmount` ignores the gem row and the positive
`issueAmount` branch posts a no-argument notification. The durable server wallet
was already credited transactionally at issuance and recovery does not credit
it again.

Raw `23ff788` is the separate additive casino path: it reads current stock,
checks the original 99,999,999,999 cap, writes the operation signature and then
adds the lifetime counter. Fresh isolated21000 casino rewards now capture their
exact before stock, cumulative amount and signature in version1 receipts while
forcing a distinct operation signature. A complete saved target removes only
casino rows from the projected delivery; it composes independently with the XP
marker. Partial or legacy ambiguous casino effects are omitted from push replies
but refuse cold replay instead of guessing a remainder. The retained source
operation is unchanged.

Every non-Iris/non-casino gained item already has an immutable
`friendship_item_claim`. An ordinary row at its reserved cumulative target, or
a version1 capped row with its complete captured stock/signature/lifetime
observation, now removes every matching original `gainedItems` occurrence from
the projection. Independent saved item subsets compose with the XP marker and
casino omission. A row at its exact issuance baseline remains untouched;
anything between those states is suppressed on push and refused on cold replay.
Filtering is sufficient because the original handler iterates the wire rows;
no second native adapter or userdata prewrite is introduced.

The shared `23e6b08` friendship setter is absolute and skips its level fanout
when the active level is unchanged. A saved same-level point target can therefore
remain in the original operation, but only when each observed target is exactly
at its issued value, each unobserved target is exactly at its captured baseline,
and there are no lazy character initializers, quest opens, communication voices
or HP/MP refill obligations. Push still suppresses immediate redelivery. A level
crossing, later higher point total or any linked effect stays queued and refuses
cold replay; no CP marker or inferred remainder is added.

The issued active hero and booster inputs remain exact. While the party exists,
its full captured rows still have to match. A `UserExpeditionParty` save that
actually removes the captured stage now records `party_effect_saved`; absence
without that durable observation remains unavailable. Once observed, deletion
cannot be rewound while the result is pending. Native `247b5ac` resets its
bonus map before scanning the now-empty party. For unsaved XP, recovery retains
the receipt's final boosted integer as the callback input so the original path
still applies the exact result under the empty-party multiplier1. For unsaved
Valis, the projection replaces each remaining original wire row independently
with its own float32-truncated captured result; the native multiplier1 then
applies that exact amount without aggregating duplicate or CP rows. Completely
saved Valis remains omitted through the existing item receipt. XP at the authored cap is unchanged.
Friendship observations must remain replay-safe. Expedition-stage claims may
be wholly unsaved, wholly observed, or an exact mixed prefix that the original
transition model proves idempotent under the broadcast recovery below.
Level-changing friendship partials, unsafe mixed stage prefixes, unobserved
deletion, changed-party, spent-unproved and forged-marker states stay queued
and unavailable. The stored signed operation is never rewritten and no
profile, wallet, reward, party, stage, floor or ACK is precredited.

The source patcher uses256 bytes of the already-proved executable zero span at
`16231b0`. Exact integer `offlineExpeditionXpApplied:1` substitutes zero for the
original W23 only at `2308ee0`; an exact receipt-bound value above1 substitutes
the final boosted XP amount after proved party deletion. The same caller-scoped parser stores exact party and
complete-stage markers in unused original callback stack padding.
Only the BL at `2309274` is redirected: exact 1 returns without calling
`23147dc`, while absent/other values tail-call the original deletion. The
complete-stage gate described below may additionally skip only its fully saved
transition pair; cleanup, save, signature and ACK paths remain unchanged.
Casino and item recovery need no hook because saved rows are absent and each
remaining boosted Valis row already carries its captured final amount. Ordered stamina projection
treats saved XP as closed so a later normal refill uses the current spendable
SP and post-XP level without granting level-up SP twice.

Deferred `test_friendship_rewards.cjs` and `test_client_native_patch.py` cases
cover zero-Iris, original failure-group711000058 Iris, XP-only, casino-only,
combined XP+casino, ordinary item-only at the XP cap, captured capped-item and
unboosted observed-party-deletion recovery; boosted XP and per-row boosted-Valis
party-deletion recovery with forged-envelope refusal, restart, saved-Valis
omission and cached-marker rebinding after the XP save;
same-level CP replay and complete level-up-fanout recovery; immutable queue/wallet;
monotonic cached hot/login/pull/confirm replay; partial-inventory suppression;
later normal refill ordering; final remaining effects/ACK; and exact native
cave/parser/stack-marker/deletion-gate/branch/literal/span/corruption guards.
Partially saved friendship fanouts and unsafe mixed stage prefixes,
non-exact legacy casino histories, other ABIs, natural
native save timing, UI, performance and no-crash/no-freeze
acceptance remain unfinished. Classification stays175
partial/1 unsupported/0 verified complete across176; co-op last.

Independent producer/legacy checkpoint attribution, original natural earning,
full native initialization/signatures/stat and mixed callback/save order,
usable recovery/navigation, no-crash/no-ANR and performance remain incomplete
or unverified. The current classification remains175 partial/1 unsupported/
zero verified complete across176 tracked routes. Actual
player DB/listener/APK/MuMu and original master/archive untouched; no workers
or GitHub Actions, co-op last.

## Current: repeated dispatch item-row prefix recovery

SOURCE ONLY; deferred cases are **WRITTEN / NOT RUN**. Original operation21000
iterates `gainedItems` in wire order and invokes the native acquisition routine
once per row before friendship, party deletion and stage effects. The durable
receipt intentionally aggregates equal item IDs, but an interrupted callback
can therefore leave its cumulative counter at the sum of one or more complete
rows rather than at the aggregate target.

For an uncapped, non-dated item, recovery accepts that intermediate value only
when the current cumulative delta from the captured baseline equals an exact
prefix sum of that item's original wire-row quantities. A captured numeric
capped item uses the same row quantities but must match both the native clamped
lifetime counter and the receipt's retained stock addition for one unique
prefix. Capped Valis additionally requires its full stock addition before the
receipt may become complete; lifetime saturation after an earlier row is not
enough. Valis quantities use the original per-row float32 multiplier and int32
truncation before either comparison. The derived envelope removes exactly those
original row indices; it does not manufacture a remainder or rewrite the queued
operation. If party deletion is also observed, every remaining Valis row is
independently projected to its captured final amount under native multiplier1.
An original or earlier exact-prefix cached envelope is accepted only when each
item's retained rows match one unique prefix no later than current durable
progress; recovery then returns the current projection. This permits a cached
first-row omission to rebind after the aggregate item becomes fully saved.

A fractional row, out-of-order quantity, changed or duplicate inventory row,
dated ticket, foreign cumulative/stock value, or edited cached envelope still
refuses. Complete item targets continue to omit every occurrence through the
existing receipt. The deferred uncapped two-Valis-row fixture saves exactly the
first row, resumes with the second, restarts, observes party deletion, resumes
with the second row's final boosted quantity, saves the full target, rebinds the
older first-row cache, rejects an edited envelope and finishes through the
ordinary save/ACK. A separate capped fixture makes the first row saturate the
lifetime counter while leaving stock incomplete, resumes only the second row,
then saves the full stock target and ACK. None of those cases were executed.
Other capped item classes, dated partials, actual native persistence timing,
UI, performance and no-crash/no-freeze behavior remain unverified. Counts stay
175 partial / 1 unsupported / 0 verified complete across176; co-op last.

## Current: completed dispatch stage-broadcast recovery

SOURCE ONLY; deferred cases are **WRITTEN / NOT RUN** and the patcher, build,
listener, APK and emulator remain untouched. This extends the interrupted
`expedition/complete` operation21000 path above. Original `23021b0` first sets
the selected stage to completion state4 and dispatch state0, writes completion
times, synchronously broadcasts the outcome to every subscribed peer, and then
may finish the selected stage at state5. `23034dc` repeats the selected absolute
dispatch-state0 setter. The callback invokes those two calls consecutively at
`2309284` and `2309290` before the independent 90-day cleanup predicate at
`2309298`.

Every own or peer row projected by that synchronous broadcast already has an
exact `expedition_stage_claim` and a durable native-save observation. Cold
recovery derives the private marker only when **all** claims for the operation
are observed. A mixed observed/unobserved set carries no marker and may replay
the original `23021b0` broadcast only after reconstructing its exact transition
from the current durable rows. Replay must touch only the operation's captured
claim IDs, leave every observed claim byte-for-byte unchanged, and reach every
unobserved claim's captured target. Anything else refuses; in particular, an
observed type-2 peer counter that would increment again cannot resume this way.
Existing floor validation still requires the actual current rows or a later
captured transition; no stage, counter, timer, floor, reward or ACK is
prewritten. Same-push delivery remains suppressed so the callback cannot
re-enter before the save response completes.

The derived operation adds only exact integer
`offlineExpeditionStageApplied:1`. The existing private ARM64 parser at
`16231b0` is now 256 bytes and stores that value in unused original callback
stack padding at SP+0; binary stack-access recovery confirms the pristine
`2308e08:2309498` function never reads or writes SP+0..7. The new caller-only
gate replacing the BL at `2309284` tail-calls original `23021b0` for an absent
or non-1 value. Exact1 jumps to `2309294`, skipping only the already-saved
`23021b0` plus `23034dc` pair while retaining the original X0 reload before the
expiry predicate. Expiry cleanup, temporary release, native save,
signature and acknowledgement remain original. The XP and party markers still
occupy their independent slots and compose with this marker.

Deferred `test_expedition_progress.cjs` now covers a real multi-row own/peer
broadcast, one safe mixed replay that leaves its observed claim unchanged, one
unsafe saved-counter refusal, exact hot replay, restart, confirm, pull, login,
forged-marker refusal and final ordinary reward/party/ACK completion.
`test_client_native_patch.py` covers the 256-byte zero span, three literals,
stack slots, both gates, exact branch targets, untouched surrounding callback
and original call-site bytes. None were executed. Unsafe partial broadcasts,
foreign or non-exact friendship fanouts, other ABIs, actual native save timing,
UI/recovery navigation, performance and no-crash/no-freeze behavior remain
unfinished or unverified. Classification remains 175 partial / 1 unsupported /
0 verified complete across 176 tracked routes; co-op last.

## Current: ordered pending dispatch callback recovery

SOURCE ONLY; deferred cases are **WRITTEN / NOT RUN** and no listener, APK or
emulator was touched. A later operation21000 captures item and friendship
baselines after the rewards reserved by every earlier queued dispatch. It
therefore cannot be reconstructed safely while one of those predecessors is
still unacknowledged: comparing it directly with current saved inventory would
misclassify the earlier reservation as a missing part of the later reward.

Delivery now serializes the original signed dispatch queue by operation ID.
Login, pull, confirm and push suppress every later operation21000 while an
earlier one remains queued. A direct `expedition/complete` retry for the later
operation returns503 and retains all state. The client must save and acknowledge
the oldest callback through the ordinary atomic operation transaction; only
after that durable removal can the next operation derive its stage, inventory,
friendship, XP and party recovery markers against the new current baseline.
Nothing creates a virtual inventory view, rewrites either signed operation,
precredits rewards or acknowledges on the client's behalf.

The deferred two-dispatch fixture now covers first-only resume delivery, direct
later refusal, first ACK rollback and commit, restart, second recovery and
second ACK rollback and commit. It also retains the independent multi-row
own/peer broadcast case. Longer/interleaved real-client sequences, other ABIs,
native callback/save timing, UI recovery, performance and no-crash/no-freeze
behavior remain unverified. Classification remains 175 partial / 1 unsupported /
0 verified complete across 176 tracked routes; co-op last.

## Current: exact legacy casino recovery across native reward callbacks

SOURCE ONLY; deferred cases are **WRITTEN / NOT RUN**. Version0 casino claims
predate the retained native before-stock snapshot, so a cumulative counter alone
cannot prove which pending producer supplied it. Recovery now accepts only the
bounded attributable checkpoint where current `cumulativeMedalAmount` equals the
claim target exactly and current `UserCasinoState.signature` equals the original
queued operation signature. Dispatch21000 omits the already-applied casino
`gainedItems` row. Present2000 and mission6000 now use the same proof to zero only
their already-applied `issueCasinoMedal`, while retaining all other callback
effects and the real ACK. Later casino-reward reservation and final ACK validation
also require this captured-or-exact proof instead of a bare reached counter.

Cold `20bbca4` queues signed operations and the unchanged `206a0c4` processor
applies them in order. An earlier v0 receipt may therefore use a later pending
operation as its witness only when the whole intervening casino prefix is v0,
strictly increases by each captured amount, and ends at that later operation's
exact target and signature. Any older pending casino receipt before the prefix
must already have a captured complete observation. Equal saturated targets,
gaps, mixed partial captures and a foreign final signature remain unavailable.

A higher cumulative value, lower value, malformed inventory or foreign signature
still refuses and remains queued. No old balance, spending allowance or missing
history is inferred, and no medal, signature, operation or ACK is prewritten.
The deferred fixtures in `test_casino_rewards.cjs` and
`test_friendship_rewards.cjs` convert fresh isolated receipts to the exact legacy
shape, prove the target under a foreign signature remains unavailable, save the
exact signature, exercise a two-operation mission-to-Present ordered prefix,
resume without the casino fields/row and complete the remaining effects and ACK.
Noncontiguous, saturated, mixed-partial or spent/changed legacy producers, other
native orderings, UI, performance and no-crash/no-freeze behavior remain
unverified. Classification remains 175 partial / 1 unsupported / 0 verified
complete across 176 tracked routes; co-op last.

## Current: per-character dispatch friendship-fanout recovery

SOURCE ONLY; deferred cases are **WRITTEN / NOT RUN**. Original `23e6b08` is an
absolute point setter that compares CP level before and after the write and
runs its quest, communication and unit-refill fanout only when that level
changes. An interrupted callback may therefore be replayed after a level
crossing only when every crossing point is exactly at its issued target and
every captured quest unlock, new communication voice and required HP/MP refill
is durably observed. On replay, the setter reads the already-current target
level on both sides and naturally skips the completed fanout.

The replay predicate admits those complete observations alongside the existing
same-level case. For a multi-character operation, it attributes quest
unlocks through the character's original communication/adventure label, kind-0
voices through that same communication identity, native global kind-2 costume
voice refreshes to every applicable crossing, and refill fields through each
unit's original character. A saved crossing needs only its own complete
attributed fanout. Another character may remain at its exact captured baseline;
the original callback then skips the completed setter and still enters the
untouched character's crossing in either wire position.

An exact saved crossing with an incomplete fanout now derives
`offlineExpeditionCpLevelPending:1` on only that character's original
`friendshipStates` row. The shared equality hook first rejects the common-stage
caller, then a second ARM64 adapter at `16232b0` accepts only the operation21000
return address `2309220`, reads the still-live current entry at original caller
SP+18 and re-enters the original fanout at `23e6cbc`. Absent/default controls,
other callers and non-1 values preserve the original equal-level epilogue.
Quest opens and captured voice refreshes remain their original idempotent
setters. Every relevant unit HP/MP field must be exactly its captured input or
captured final value because `22d0d30` restores absolute maxima. Once every
attributed effect is durable, an older cached marker is removed and the equal
setter naturally skips the completed fanout.

Lazy character initialization, higher/later points, foreign effects, changed
refill values, marker edits or a marker on an unqualified row still refuse. The
original operation, item/XP/party/stage effects, signature and actual ACK remain
unchanged; no point, unlock, voice, stat or reward is prewritten.

The deferred dispatch fixture saves crossing points first, derives the exact
per-character marker, rejects wrong-value and wrong-character markers, restarts
and resumes the marked operation. It then saves the captured fanout, proves the
older marker is dropped, resumes the unchanged operation and completes its
remaining ordinary effects and ACK. A
second source-only fixture places one complete and one untouched crossing in
both callback orders, requires only the complete character's attributed quest
effect, rejects its missing effect, and then requires the second effect after
both point targets are saved. None were run. Changed temporary-guest
eligibility, other ABIs, native save timing, UI recovery, performance and
no-crash/no-freeze behavior remain unverified.
Classification remains 175 partial / 1 unsupported / 0 verified complete
across 176 tracked routes; co-op last.

## Current: CP-item debit, ordinary reward and friendship-fanout recovery

SOURCE ONLY; deferred cases are **WRITTEN / NOT RUN**. Original operation11000
handler `23eb274:23eb9bc` first tests `itemId`, parses `itemAmount` and applies
the negative CP-item quantity through the original repository. It then applies
`issueAmount`, iterates `gainedItems`, and finally invokes the shared absolute
friendship setter for every `friendshipStates` row. The existing caller-only
adapter still resumes an incomplete saved level fanout at `23e6cbc` from return
`23eb7d0`.

The request now classifies its captured CP-item state independently of Iris and
ordinary rewards. The exact captured amount/cumulative pair is untouched. A
net stock-minus-acquisition value at or below the captured post-debit value proves
the original debit was saved; later acquisition changes both counters together
and later spending can only strengthen that proof. Every intermediate, missing,
duplicate or malformed CP-item row refuses.

The current issuer aggregates every original CP reward by item ID, so new
operation11000 responses have one `gainedItems` row per retained item receipt.
A retained legacy operation may instead contain multiple positive rows for one
item while keeping the same aggregate receipt. Uncapped progress must equal an
exact cumulative sum of complete rows from the start. Captured capped progress
must identify the same unique prefix through both its clamped lifetime counter
and retained stock addition under the operation signature. Complete observations
omit every matching row; untouched rows remain in their original order. Dated,
fractional, reordered or ambiguous partial states refuse. The shared acquisition
reservation must still end exactly at this receipt, so a later pending or
completed same-item producer cannot be mistaken for this earlier reward.

Positive `issueAmount` is now admitted only when every operation-bound original
CP reward still matches its character, hero and reached level and the sum of its
type-5 rewards equals the signed field exactly. Original `23eb56c:23eb5d4`
parses that value and, when positive, posts the same no-argument header-refresh
event through raw `25d9db4/25d9f48`; it does not add Iris to a local inventory
row. The authoritative offline wallet was already credited once in the request
transaction. Recovery retains the original display/refresh amount and never
credits the wallet again, so no extra marker or native hook is required.

For saved debit proof the server projects only
`offlineFriendshipItemApplied:1` on the response copy. A new 96-byte ARM64 shim
at `1623370`, reached only from original branch `23eb2c8`, preserves the
original missing-item branch, skips to `23eb56c` only for exact marker1, and
otherwise returns to `23eb2cc` for the full original debit. It composes with the
per-character `offlineFriendshipCpLevelPending:1` marker and ordinary row
projection. No additional native hook is needed for ordinary rewards: the
original array loop simply receives only the still-unsaved rows. Unsaved rewards,
points, fanout, save/signature and the real ACK remain original. A completed
fanout removes only its row marker; saved reward rows stay omitted and the debit
marker remains until ACK.

The deferred transport fixture covers untouched debit plus saved points, saved
debit plus incomplete fanout, positive original Iris with forged-sum refusal,
retained uncapped and near-cap two-row ordinary rewards through untouched, exact
first-prefix and complete saves, monotonic item omission, forged row refusal,
marker composition, restart,
completed-fanout marker removal and the final real ACK. The native fixture
records the pristine cave, original branch bytes, literal, calls, long-branch
targets and untouched spans. None were executed. Dated partial rows, ambiguous
capped prefixes, other ABIs and native save
order/UI/performance/no-crash behavior remain unfinished or unverified.
Classification remains 175 partial / 1 unsupported / 0 verified complete
across 176 tracked routes; co-op last.
