# Seventh Zone offline completion and ranking policy

## Summary and ranking-prize cache boundary — SOURCE ONLY / UNTESTED (2026-10-14)

Fresh and exact cached summaries now use the same original-event and native-score
builder. The cache path rebuilds every authored difficulty-to-stage row, so a
saved first score or later score change cannot be hidden by an older snapshot.
Unchanged records remain byte-identical. Malformed, foreign, duplicate and
unknown rows continue to recover without erasing them.

Cached summary replay also probes original ranking-prize eligibility without
writing. Once a local acknowledged best becomes eligible after the authored end,
the old summary is rejected so a fresh request can atomically create Presents
and its once-only publication marker. The probe itself cannot create either.
The new summary and prize cases are written but have not been run.

## Ranking cache boundary — SOURCE ONLY / UNTESTED (2026-10-14)

Fresh and exact cached top, around and character ranking responses now use the
same original-stage/local-best validator. It rechecks pending operation25000
exclusion, native record floors, the acknowledged best pointer, exact original
difficulty/stage/final score and immutable player/team capture before rebuilding
the rank-1 row or normal/assist usage. Empty-to-ranked and higher-score/team
transitions return recovery 3000999 instead of replaying an obsolete snapshot.
Lower/tied clears and unrelated current party, name or PC changes preserve the
byte-identical immutable-best response. The prior deferred test expectation that
an exact old top response survive a new high score has been removed. The new
cache cases are written in `test_element_rankings.cjs` but have not been run.

## Saved high-score and score-event recovery — SOURCE ONLY / UNTESTED (2026-10-11)

The original 25000 callback raises `UserElementEventRecord` only for a new high,
but then emits an
`ElementEventScoreEvent`. Its original listener at raw `0x2124e40` calls the
additive, int32-saturating achievement setter at raw `0x2358a98`. An exact saved
difficulty high score therefore does not prove that redelivering 25000 will
leave saved achievement progress unchanged. New25000 receipts now capture a
SHA-256 digest of the original owned `UserAchievement` rows, sorted by ID. Cold
redelivery requires that exact digest still match, in addition to the prior
original difficulty, score, record-before, policy, clear count and owned saved
high-score row. An independently saved achievement change is accepted by
`user_data/push` while the pending result is suppressed from that reply;
later cold redelivery refuses without deleting the operation or rewriting
rewards. Even achievement-first saves with no high-score row are guarded. A
missing digest on an older receipt also refuses cold redelivery
instead of inferring a pre-event baseline. Reordered identical rows remain valid.
No event progress is precredited or suppressed in the client.

The record-only/restart, missing-digest, independently advanced achievement,
item-save and full-save/ACK cases in `test_element_completion.cjs` are WRITTEN
ONLY; none have run. Other native event side effects or an undiscovered listener
would need their own capture. This is not full interrupted-save or native result
acceptance.

## Settled ranking capture boundary — SOURCE ONLY / UNTESTED (2026-10-11)

All three ranking reads now require the saved best-result pointer to refer to
the same original difficulty as the requested high score. Unreadable or invalid
private player snapshots return a recoverable unavailable response rather than
an internal parse error or a malformed player row. Existing scores and captures
are retained. Deferred cases cover a cross-difficulty pointer, malformed JSON
and a foreign player; none have been executed. This does not prove native ranking
screens, result production or broader Seventh Zone gameplay.

Earlier [item-only cold recovery](stage-item-recovery-contract.md) permits whole
fully observed captured25000 wire items to be omitted only when the same
achievement digest remains unchanged. An exact saved high-score record now
extends that path under the digest and original-result guards above. Actual
mixed ACK, original score/snapshot/window contracts and queue remain; deferred
cases only.

## Newer ordinary stage-ticket acquisition

SOURCE ONLY / PARTIAL / UNTESTED: [stage ticket rewards](stage-ticket-reward-contract.md)
extends25000's common path to first/owned ordinary dated captures with original
full loot quantities, independent difficulty record and full mixed ACK.
First/owned fixtures are written only. No native precredit, new DDL, stage cold
replay, tests/builds/install/restarts/emulator work; earlier source policy and
all unrelated limits remain. Actual saves untouched; co-op last.

Implemented in source; logical and emulator acceptance are deferred. This is an
explicit reconstruction, not publisher-server formula or feature-complete proof.

## Ability-lock inventory correction — SOURCE ONLY / UNTESTED (2026-10-09)

Earlier protected-byte signature claims are superseded:27dde3c/289c464 is
bookEntryState (UInt8), whereas27ddecc/289c548 is signature (UInt32).
The shared inventory reader now preserves the complete signature and book0..255;
existing captured Present cap/save handling applies to original220000001.
This does not establish native Seventh Zone ranking-prize acceptance or ability
consumption. Sixteen additional Present scenarios are written only, not run;
see gift-reward-contract.md. Saves/listener untouched, all testing deferred.

## Original client and archive evidence

Client15.1.0's shared completion wrapper `0x2472bec..0x2473704` selects
`element_event/stage/complete` for adventure modes26 and27. The request producer
`0x217bd08` includes `userElementEventScore` with nonnegative int32 statistics
`totalDamage`, `maxDamage`, `actionCount`, `turnCount`, `pcTotalDamage`, and boolean
`defeat`. The separate ordinary `isEnemyAnnihilated` flag is retained.

The original ARM64 producer proves that the two booleans are copies of the same
battle-context byte, correcting the earlier unproven non-equivalence assumption.
`0x1f0bcf0` returns the singleton at `0x445d0d0`; `0x217c6c8..0x217c710` copies
its byte at offset0x40 to `isEnemyAnnihilated`. The mode26/27 body
`0x217d1f4..0x217d504` gets that same singleton and copies the same byte at
`0x217d2d0` into `defeat`, whose original string is at `0x321052f`. Its final
branch `0x217d500` reaches the shared request `0x2180bec` without requiring
the byte to be true. A submitted false value means enemies were not annihilated;
it is not enough to infer whether the natural battle ended by timer, player
defeat or retirement.

The operation registry at `0x2069508` selects **25000**, whose result reader is
`0x2471ca0..0x2472324`. Operation30000 is Union Raid, not Seventh Zone. Result
parameters require root `adventureStageId` and `score`, as well as the ordinary
stage completion fields. `score` consumes the six original statistics and:

| Integer score fields (int64) | Rate fields (float32) |
| --- | --- |
| baseScore, maxDamageBonusScore, turnCountBonusScore | maxDamageBonusRate |
| pcDamageBonusScore, provisionalTotalScore, finalScore | actionCountBonusRate, turnCountBonusRate |

The native result context clamps base/turn/PC bonus values only for their int32
display slots; final and maximum-damage scores retain int64. The result reader
raises an actual difficulty record only when finalScore exceeds its previous
score, then invokes ordinary completion and emits an ElementEventScoreEvent.
The score event can add its score to an achievement counter independently of
that higher-only record update, so the two effects are not interchangeable.
There is no immediate leaderboard prize invented by this handler. Existing
achievement packets remain responsible for separately claimable mission rewards.

Native25000 calls ordinary completion at `0x2471ff8` for either boolean value;
its `0x2471fa8` branch only controls whether to raise the difficulty high score.
Generic completion calls the state4/clear-count setter at `0x246d49c`. The source
now accepts both matching outcome flags instead of rejecting all false values.
Mismatched flags reject before mutation; the flags are never rewritten and no
synthetic `isWin` is added. The existing score object, exact request-body hash,
raw-stat capture, reward receipts and native save/ACK path are reused without a
new schema. Existing historical captures are not rewritten or retroactively
assigned another outcome. Native eligibility/result UI still requires acceptance.

Archive exports retain all208 information IDs,417 stages/windows, and1382 unique
difficulty/adventure-stage joins:1362 mode26 and20 mode27. Original first-clear
items and quantities come from the ordinary adventure-stage table, including
equipment materials and the Final Trial gacha tickets. The16 authored turn bonus
rows and empty action-bonus table have encrypted-file hashes and row counts in
`data/danmemore-master.json.sources`. Unidentified scoring slots stay named
`slot4..slot11`; exporting them is not evidence of their publisher meanings.

## Reconstruction: offline-element-v1

For this offline policy, every multiplication converts the amount and product to
float32, then truncates toward zero. Rates are the original exported float32
values; this arithmetic has not been established as publisher parity.

| Component | Explicit offline rule |
| --- | --- |
| baseScore | totalDamage multiplied by original slot5 |
| maxDamageBonusScore | maxDamage multiplied by slot8; maxDamageBonusRate=slot8 |
| turnCountBonusScore | slot10 multiplied by the selected authored turn value/10000 |
| pcDamageBonusScore | mode27: pcTotalDamage multiplied by slot11; mode26:0 |
| provisionalTotalScore, finalScore | sum of the four components |

`actionCountBonusRate` is1 because the original action-bonus table has no rows;
no action-count multiplier or reward is fabricated. Turn bonuses apply only when
submitted `defeat` is true and turnCount>0. Among rows matching slot7, select the
first threshold at least the submitted turn count; after the final threshold20,
there is no turn bonus. The raw actionCount remains in the native score object.
These choices are documented offline rules, not inferred publisher facts.
Non-annihilated results retain their submitted damage, action count, turn count
and mode27 PC damage, with zero turn-bonus rate/score under this same policy.
Their lower scores never erase an existing native high or remint first-clear
prizes. Positive recorded scores may earn the existing offline ranking prize
after a real save/ACK; a zero/absent score does not manufacture a ranked result.

New runs use the authored stage window with inclusive start/end as an explicit
offline availability policy. Pending exact retries and ACKs remain deliverable
after expiry. Changing dates retains historical high scores and clear records;
it does not reset prizes or reconstruct unavailable online rankings. Natural
unlock/availability and precise publisher window behavior remain unverified.

## Native first-record int64 repair

`DomainElementEventStage::setScore` at `0x25d015c..0x25d05d8` keeps the incoming
int64 in X22. Its existing-record update preserves that width, but its new-record
path narrows X22 with `sxtw x1,w22` at `0x25d0300` before calling the nonnegative
int64 `UserElementEventRecord::setScore` at `0x288555c`. A sufficiently large
first score can become negative and assert. The ARM64 offline-client patch changes
only that instruction to `mov x1,x22`, guarded against mismatched original bytes.
It does not cap scores, change authentication, bypass save validation, or edit the
original binary. JavaScript/SQLite values are bounded by safe nonnegative integers,
not the full theoretical int64 range. The patch is **not built or installed yet**.

## Persistent receipts and save proof

`element_completion` durably captures difficulty, raw statistics, policy version,
exact score object, before/target high score, whether a record existed, and target
clear count. The existing permanent stage/token receipt owns retry identity and
once-only stage/objective prizes. Queue, receipts, currency and reply commit in
the same transaction. No native score, clear flag or ordinary inventory is
pre-credited. The historical `pve_item_claim` table name is reused for both scored
modes, without a schema rename: acquisitions share indexed reservation counters
with PVE, missions, boxes, shops and other recorded producers.

ACK requires the original stage/token/difficulty receipt, its exact score object,
unique owned clear row, preserved first-clear date, cumulative clear count,
objective flags, initialized PC rewards where applicable, difficulty high score
at least the target, and every ordinary inventory acquisition. Score0 with no
prior record legitimately produces no native difficulty row; an already-owned
zero record must remain owned. A lower repeat never reduces the previous score.
Split clear/score/inventory saves and ACK can cross restarts; a proven canonical
clear can reconcile a pre-clear stage retry, but cannot replace missing inventory
or a missing difficulty score. Unknown legacy receipts remain unavailable and
queued, not silently accepted.

The ACK transaction updates materialized `element_record` score/clear floors,
marks the operation done and removes it from the queue atomically. Future saves
cannot remove or rewind completed scores, acquisition counters, clear counts or
first-clear dates. Ordinary item spending is allowed because acquisition counters
are distinct from remaining amount. Floor queries use the small materialized
record table rather than scanning lifetime battle captures.

## Ranking views and historical team captures

The three wrappers `0x25d320c`, `0x25d388c`, and `0x1a5c36c` send exactly
`elementEventStageId`: the original661-stage group, not its663-difficulty,
660-information or126-adventure-stage ID. The character-screen caller
`0x1a69a34` resolves that group through `0x25d10ec` before sending the request.
Top/around callbacks `0x25d4174`/`0x25d4828` invoke cache readers
`0x25d54ac`/`0x25d5948`, both iterating root `ranking`. Row reader `0x25d56d0`
consumes int64 `userId`/`score`, string `userName`, int32 `rank`/`difficultyRank`,
and nested `leaderPc` with `pcId`, `jobRank`, `level`, `heroSublimateLevel`, and
`isUnlockedHeroSublimate`. The character callback chain
`0x1a72a24` -> `0x1a72e2c` -> `0x2141c44` uses root `normal`/`assist` arrays
of int32 `pcId`/`rank`, like Record Buster.

**Explicit solo-offline policy, not publisher ranking recovery:** the maximum
positive saved score among this group's original difficulties is ranked1. Ties
prefer the higher authored difficulty, then lower original difficulty ID.
`difficultyRank` uses that authored difficulty. Top and nearby show the same
genuine local player, with no invented neighbours. These ranking views do not
produce prizes; fresh summaries separately settle the source follow-up below.
Absent and owned-zero scores produce an empty ranking without changing native
ownership or creating a clear. Historical reads remain possible after expiry.

For a newly higher difficulty score, `element_player_capture` captures the actual
saved player name, selected `UserParty` main/assist identities and initialized
owned leader at issue. The leader's job rank/level use original ordered PC jobs,
growth EXP thresholds and job/limit-break caps, not guessed stats. This is a
selected-party save snapshot, **not a proven battle-start snapshot**; native
save/event ordering still needs acceptance. It does not manufacture a full
historical battle party or guest stats. If the selected party/leader cannot be
proved from existing saves, the completion's score/reward receipt is retained
without inventing a team; ranking history stays explicitly unavailable.

An indexed `element_best_capture` pointer is published only in the saved-score,
clear/inventory ACK transaction, when the captured new high exactly matches the
native saved score. Lower/tied clears do not retain unused team captures or
replace the best team. Party/leader/name edits afterwards cannot change historical
views. Queries use bounded original difficulties and primary-key capture/floor
lookups, never scan lifetime clear history. Pending25000 results in the selected
group temporarily make rankings unavailable; other groups remain independent.
Unknown legacy positive highs or unexplained newer scores cannot be relabelled
with today's party or silently reduced to a lower captured score. They return
the existing recoverable cancellation3000999, preserving all saved records,
receipts, pending operations and rewards. Character usage ranks frequencies only
within the captured winning team, with PC ID ascending as a tie-break; it is not
the original population-wide usage statistic.

## Deferred acceptance

Run `node tools/test_element_completion.cjs`, `node tools/test_element_summary.cjs`,
`node tools/test_element_rankings.cjs`,
`node tools/test_master_data.cjs`, `python tools/test_client_native_patch.py`,
and the shared PVE/mission/box/shop probes in the consolidated batch. The new
completion script contains synthetic checks across all1382 original difficulties,
both modes and both enemy outcomes, matching/mismatched typed flags, zero/int64
records, original first prizes, lower non-annihilated repeats, clock/window
boundaries, exact retry, split save/ACK, shared acquisition ordering, permanent
floors and request/ACK rollback. Synthetic battle statistics, unlocked stages and
extra loot fixtures do not prove natural progression, original drops, or publisher
scoring. These scripts have **not been run on this implementation**.
New mode26/27 non-annihilated first-result fixtures also queue untouched expiry
redelivery and clear/score/item saves across restarts. Ranking/team/prize helpers
now use the recovered matching false/false shape, not the earlier contradictory
true/false synthetic request. The ranking fixture's old settled additive replay
expectation is corrected to cancellation, consistent with the existing delivery
guard; no production replay behavior was relaxed.

Native hot/cold result screens, first-record large scores, rate/bonus display,
Final Trial PC-damage behavior, item/ticket grants and signatures, achievement
event/save ordering, natural unlocks, defeat results, battle EXP, unrecovered loot
provenance and expiry cleanup remain pending. None of this source slice has been
deployed to the emulator. See `docs/packet-test-plan.md`.

The new ranking script includes synthetic checks for all417 empty groups, exact
three response shapes, original leader growth/job fields, int64 scores, immutable
captured teams, different difficulties/events, lower/tied clears, pending split
saves/ACK, capture/best-pointer/reply rollback, cache/retry/restart/expiry,
malformed/stale records and preserved unavailable legacy or missing-team history.
It is written but **NOT RUN**. Native ranking refresh/cache transitions, portrait
and character-row rendering, team freshness, absent/zero UI, natural eligibility
and the original publisher aggregation/usage metric remain unverified.

## Original ranking-prize catalog and ability-lock inventory

The current source follow-up exports all128 original
`elementEventScoreRankingReward` rows under `elementRankingRewards`, across six
reward groups (24/20/21/21/21/21 tiers). Raw197c224/197c290 select the original
stage's long slot4 and compare it with the reward row's long slot1. This corrects
the old decoded stage label `elementId` to **`rewardGroupId`**: it is neither an
element affinity nor a stage/event ID. All417 original stage joins resolve;
five Final Trial stages select groups2..6, the other412 select group1.
Raw197b280 reads int32 rank bounds in slots2/3 and five item-ID/count pairs in
slots4..13 through raw24e3a5c's actual item registry. Unknown slot0 remains
absent. Raw197816c proves single-rank, open-ended maxRank0 and range labels;
the exporter preserves original tier/pair order and requires contiguous rank
coverage, known items, positive pairs and a final open-ended tier.

The original group1 rank1 prize includes item220000001. Its missing profile
was blocking reward decoding. The `lockAbilityItem` table's sole row maps
`lock_ability_item.1` to this ID; raw25d7798/25d7e04 prove master int32 slot0
and string key slot1. Raw27ddb4c loads exactly `userId`, **`lockAbilityId`**,
`amount`, `cumulativeAmount`, `signature`, `bookEntryState`, `reservedAmount`.
The native domain vtable raw42c4360+0x50 resolves to the existing ordinary
raw24d8844 acquisition function, not a skip/subscription ticket, expiry list or
full-row inventory replacement. Raw289c270/289c628 retain the999999999 amount
and reserved-amount upper bound. Raw289c464 calls raw28bda24; bounded ARM64
instructions there and in raw22e6718 prove a protected **byte** signature.
The shared inventory guard therefore requires the original seven-field shape,
canonical0..255 signature, valid ID/book state and nonnegative shared acquisition
counts/ceilings. It neither changes nor manufactures a native signature.

The master now has156 hashed original sources. New encrypted source hashes:
`elementEventScoreRankingReward` =
`c86578de6b5d0533934984ebdaec8fc52319f53f1f156ec36ddb0f9e0a63739a`;
`lockAbilityItem` =
`254401bcd6d50ab25476041697b6f67288f363b7c12bf027528d80d48066de95`.
Apart from the corrected stage field name and the two new exports/item profile,
the prior154 source hashes and previous master values remain unchanged. All29
distinct ranking-prize item IDs now resolve to real profiles.

The profile reuses the existing ordinary reward reservation, changed-ID
acquisition floors, queued2000 Present grant, split received-save handling,
native inventory save/ACK, replay and rollback paths. No new SQL table,
dependency, grant protocol, lifetime-history scan or native precredit was added.
This enables **already-authored ordinary rewards containing the item**; it does
not create a ranking prize or establish original equipment lock-consumption
semantics. At this catalog-only slice automatic prize production was absent.
The current follow-up below adds offline production in source, not native proof.

Extended `test_master_data.cjs` and the24-type `test_gift_items.cjs` are written
but **DEFERRED / NOT RUN**. Queue original selectors/ranges/pairs/hashes, absence
and owned inventory, byte signature boundaries, wrong alias/missing fields,
invalid counts/book state, no precredit, restart/once-only, received flag before
inventory/early ACK, partial suppression, changed-ID floors and rollback.
The synthetic item rows/gifts do not prove natural prize earning, native
signature generation, inventory/rendering, lock usage or emulator stability.
No real save, listener, APK or emulator was changed.175 routes remain103 partial,
72 unsupported and zero fully accepted; no workers or GitHub Actions, co-op last.

## Current: persistent offline ranking Presents

`tools/element_rewards.cjs` now supplies the source producer. It uses the same
positive local-best selection as top/nearby rankings: largest saved score among
the661-stage group's original difficulties, then higher authored difficulty and
lower difficulty ID for ties. The helper can select every original rank range,
but the current single-account leaderboard naturally selects rank1. The group
is the actual661-stage, **not** the reward selector1..6 or660-information ID.
This is disclosed solo-offline ranking, not recovered publisher/global rankings.

Fresh login, confirmation, relevant `UserGift`/`UserElementEventRecord` pulls and
element summaries settle after the original **inclusive stage end+1**. This is
an explicit offline cutoff, not recovered publisher tally timing. A pending25000
operation blocks that stage's production; another independently completed group
can settle. Imported highs, zero records, absent best/team captures and an
acknowledged lower repeat of an imported high do not manufacture earned prizes.

Eligibility requires the saved native difficulty score to match its genuine
acknowledged local best. It binds the original stage/difficulty join,25000
operation and token, immutable stage-delivery JSON, original record ownership
and score baseline, raw statistics and recomputed offline-element-v1 score,
captured owned player/team, actual stage/token completion index, operation-done
and no pending best operation, materialized score/clear floor, saved owned
state4/first-clear date and original ordinary item-acquisition receipts. No
publisher signatures, native scores, clears or items are prewritten to create
eligibility. Original selected-party capture freshness still needs native proof.

Two local SQLite tables, `element_ranking_reward` and `element_ranking_gift`,
persist one stage's production and its gift IDs. The receipt retains the exact
earned proof/hash, acknowledged operation, original catalog hash, stage-group
score ownership snapshot, issued time and ordered original gifts. Captures,
gift indexes, the existing native Present profile/token, sequence and reply are
committed by the existing outer packet transaction. This changes no native
Element record shape and invents no `isAggregate`/`isReceiveReward` flags: the
original native table only has userId/difficultyId/score.

An independent `reward_receipt_hash` column on the existing local best-pointer
table is published in that same transaction. Receipt validation requires this
marker, the prize capture and all gift indexes to agree. Even if both production
indexes are lost after the native claimed gifts were removed, the marker retains
the unavailable earned publication instead of producing another prize. No legacy
publication marker is fabricated from current scores; its additive schema change
has not been applied to the real player database.

The existing `createGifts` and2000 claim/save/ACK paths apply every authored
rank-one pair, including equipment ability-lock items and the Final Trial
Iris/key/hero prizes. RANKING8/COMPANY1 are original enums; permanent expiry0
is the existing explicit offline delivery policy. Prize production does not
credit the wallet/inventory. Original item quantities are neither scaled nor
substituted. Claimed gifts use existing once-only wallet/item receipts, received
save observations, partial suppression, acquisition floors and queue/ACK checks.
Native grant/signature/popups/rendering are not yet verified.

Shared read/save/gift guards retain unavailable/corrupt production or local
earning history rather than erase it or reaward. Unclaimed gifts cannot be
removed, received or changed without their real2000 claim; observed or completed
claims cannot be restored. The recorded group scores cannot rewind or acquire
an unissued new high. Event-clock rewind rejects a newly higher result for a
rewarded group; lower/tied practice still uses the ordinary25000 clear/save/ACK
path while preserving its recorded high and prize. Previously absent zero rows
may still initialize without creating another prize. Cached confirmation tokens,
summary scores and relevant binary pulls cannot hide/erase new publication;
cached comparisons remain read-only, not another producer.

Original grouping maps are built once. Eligibility reads primary-key best,
operation, floor and acquisition captures, with batched current stage identities;
publication traverses at most417 groups/1382 best pointers, not lifetime battle
history. No dependency, separate grant protocol or real profile migration was
added. Repeated proof/canonical validation is bounded but performance is
**unmeasured** and still belongs in the consolidated test pass.

`node tools/test_element_ranking_rewards.cjs` is written **DEFERRED / NOT RUN**.
It queues all128 tier boundaries through all417 stage selectors, one earned
scenario for each of the six reward groups, inclusive cutoff and pending/split
25000 saves, restart/once-only publication, exact item quantities/no precredit,
profile/capture/index/reply rollback, stale native pull/summary/confirmation,
score/gift rewinds, damaged/missing production and operation proof, clock rewind
and later practice, and exact2000 received flags/early ACK/partial suppression/
item-save/ACK rollback/restart/once-only delivery. Original metadata alone, the
synthetic stage/team saves and syntax checks do not establish playable gameplay.
Queue existing element completion/summary/ranking, master, gift/mission/box/shop,
PvB/War/Under/Serial, dispatch, save/recovery/clock and Android/launcher regression
checks too. Natural missions, unlocks, combat/scoring parity, unrecovered loot,
EXP/CP/skip/lock consumption, publisher timing/aggregation, native cache/result/
inventory/Present UI, no-crash/no-ANR and navigation remain unfinished/unverified.
Actual save/listener/APK/MuMu remain untouched; no workers/Actions; co-op last.

## Executed isolated ranking/prize checks (2026-10-06)

`node tools/test_element_ranking_rewards.cjs` passed on disposable SQLite saves:
all128 original tier boundaries/417 selectors, six earned prize groups, captured
25000 results, durable2000 claims, restart, corruption, clock/cache and rollback.
The fixture now sends bodyless confirmation and distinguishes injected database
failures from unsupported-feature cancellation. No server guard was weakened.
`node tools/test_element_rankings.cjs` also passed for all417 original groups,
three ranking wire shapes, acknowledged immutable teams, best-difficulty
selection, restart/retry/rollback and unavailable legacy history. Its legacy
fixture retains scores earned earlier in the same test rather than deleting
them with an obsolete snapshot. Native ticket fixtures include their required
book-entry/signature metadata; this is not proof of real native signatures.
These results supersede only these scripts' earlier NOT RUN notes. Native acceptance,
natural earning, publisher scoring/timing and gameplay completeness remain pending.
