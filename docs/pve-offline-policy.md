# PVE offline completion policy

## Settled history cache boundary — SOURCE ONLY / UNTESTED (2026-10-14)

Fresh and exact cached `pve/recent/clear/get` and
`pve/score/ranking/get` responses now use the same settled-history validator.
It reconstructs the indexed latest or best operation and revalidates its
immutable player/nullable-party snapshot, operation16000 delivery,
stage-completion receipt, score, policy, clear count and durable ACK. An old
empty reply therefore cannot hide a newly settled run, and an older recent
reply cannot hide a later party. Corrupt or changed private history returns
recovery 3000999 with the records retained. A lower repeat leaves the unchanged
best-score reply byte-identical. The cache cases are written in
`test_pve.cjs` but have not been run.

## Settled history read boundary — SOURCE ONLY / UNTESTED (2026-10-11)

`pve/recent/clear/get` and `pve/score/ranking/get` now require a retained,
settled `pve_clear` snapshot whenever a private history pointer exists; a
dangling or unsettled pointer is not treated as an empty ranking. Its stage
must match the requested stage; its player identity, saved score, historical
main PC and original nullable-party fields must be internally consistent.
The read also binds the selected score, clear count and scoring policy to its
settled original 16000 operation and stage-completion receipt; a mismatched
private capture is withheld rather than rendered as another result.
Unreadable or mismatched private history returns a recoverable unavailable
response with the data retained, rather than publishing another stage's party
or malformed player JSON. The existing completion-time party validation is
unchanged. Deferred cases cover malformed JSON, a cross-stage result, a
leader/party mismatch, a dangling pointer and altered operation/receipt/policy/count;
no tests, build or emulator viewing have run for this
source change. This does not recover publisher rankings or validate every
other PvE result and save path.

Newer [score-only recovery](pve-score-recovery-contract.md) permits the original
idempotent16000 score assignment when all captured additive stage fields remain
unchanged, including combinations with fully saved captured items. It preserves
the exact result, original higher high score, source/queue and real ACK.258
existing PvE operations/352 rank-item contexts are extended and one imported
zero-result case added; all WRITTEN ONLY / UNTESTED, no native acceptance.

Newer [rank-item recovery](pve-rank-item-recovery-contract.md) keeps a repeated
numeric rank/loot gain's positive allowance open after an early capped nonce
and omits both whole grants only after full retained item proof. Original
quantities/server-Iris ranks/full ACK remain; saved score/clear/other progression,
duplicate PCs, repeated dated and ambiguous late-first saves still refuse
unsafe replay.352 new original-catalog contexts, including retained exact-counter
spent-first proof, are written only. This is
SOURCE ONLY / PARTIAL / UNTESTED, not current isolated/native proof.

## Newer ordinary stage-ticket acquisition

SOURCE ONLY / PARTIAL / UNTESTED: [stage ticket rewards](stage-ticket-reward-contract.md)
extends16000's common path to first/owned ordinary dated captures while
retaining separate original rank-item gains, full quantities and mixed ACK.
No new native precredit, DDL or stage cold replay. First/owned cases and fixture
updates are deferred; older isolated evidence below does not verify this change.
Actual saves/listener/APK/emulator unchanged; co-op last.

Implemented in source; isolated HTTP/SQLite checks pass, native acceptance is pending. This is an
explicit reconstruction, not recovered publisher-server scoring.

## Original client and archive evidence

Client 15.1.0 selects `pve/stage/complete` for adventure mode 12 at the shared
completion dispatch `0x2472bec`. Mode follows stage -> episode -> adventure;
the stage's own `type` is a separate field. There are 222 mode-12 stages.

Original `adventureStageScoreBase` and `adventureStageScore` supply 36 score
stages. Their encrypted archive paths, SHA-256 hashes and row counts are
exported in `data/danmemore-master.json.sources`. Reward-map builder
`0x1c19ae0` selects the base row with selector 1, scales S/A/B/C thresholds
with float32 multiplication, and truncates toward zero. Rank display
`0x245405c` compares saved highScore inclusively. Reward triples occupy
Score slots4..6=C,7..9=B,10..12=A,13..15=S. Some S rewards are special
Falna items, including the final eight tables awarding two. Neither the
meaning of Score slots16..21 nor the publisher bonus formula is established.

Operation 16000 (`0x246e204`) consumes six integer score fields and lower-case
`rewardRanks`. Setter `0x24589c0` writes currentScore and raises highScore
only when the new score is higher. Rank helper `0x2458ad8` appends runtime
rank values, not persistent prize ownership. Non-Iris rank items are granted
from the original master map; Iris ranks are skipped by the native item grant.
The operation then invokes the ordinary stage-completion implementation.

The request producer copies the actual `isEnemyAnnihilated` byte at
`0x217c6c8..0x217c710`, separately from the mode switch at
`0x217cbb8..0x217cbdc`. Mode12 enters `0x217d5bc`, builds the seven PVE stats
and historical party through the bounded body `0x217d5bc..0x217fb5c`, whose
final branch at `0x217fb58` reaches the shared request at `0x2180bec` without
testing that byte. Native16000 calls generic completion at `0x246e6f8`;
that implementation calls `0x2451924` at `0x246d49c`, which sets state4 and
increments the clear count. Thus a submitted false annihilation flag is not
an ordinary-stage `isWin=false` contract. The earlier server gate rejected
this score-result branch incorrectly. The PVE gate has been removed;
the separate [Seventh Zone follow-up](element-offline-policy.md) now supports
its own recovered matching outcome fields. This is bounded original ARM64 evidence,
not emulator acceptance or proof of which natural defeat/timer paths submit.

## Reconstruction: offline-quality-v1

For a submitted result on a scored stage, each component is calculated
in quality points, then multiplied by the authored float32 stage multiplier
and truncated toward zero. The final score is the sum of these scaled components.

| Component | Quality points before scaling |
| --- | --- |
| baseScore | 100 |
| maxDamageBonus | min(100, floor(100 * maxDamage / totalDamage)) |
| turnBonus | min(100, floor(100 / clearTurn)) |
| actionBonus | min(100, floor(100 * frontPCs * clearTurn / actionCount)) |
| survivorBonus | min(100, floor(100 * max(0, memberPCs - deathCount) / memberPCs)) |

A zero denominator contributes zero. Ratios use JavaScript numeric arithmetic;
the point-to-score multiplication is explicitly float32. All submitted statistic
fields and output components must be nonnegative signed 32-bit integers. This
policy deliberately avoids claiming meanings for unidentified original fields.
The 186 unscored earlier mode-12 stages use zero components and an empty rank
list, preserving only their authored ordinary stage/objective rewards.
The native behavior of this unscored result path remains to be tested.
Both boolean annihilation outcomes use this same explicit score policy and
original16000 result operation. The request flag is never rewritten to true,
nor is a synthetic victory field added. An all-fallen/zero-damage submission
still uses its actual statistics, not a perfect-score replacement. Natural
defeat, retirement and timer eligibility/UI behavior remain unverified.

Every newly reached threshold can award its original prize once per stage/rank.
A saved earlier clear/highScore suppresses already-reached ranks; unknown legacy
prizes are not minted again. New immutable rank receipts survive generic response
cache eviction and event-clock changes. Iris is credited once server-side in the
request transaction. Non-Iris rank prizes are not duplicated in `gainedItems`.

## Persistence and historical parties

An immutable `pve_clear` captures the submitted battle statistics, scoring-policy
version, score, actual player identity and submitted `userPveParty`, linked to the
native operation and stage/token completion receipt. Nullable PC/assist slots and
original guest PC IDs are supported; current unit ownership is not required for
a historical party. Snapshots never overwrite current UserPC, party or equipment.
Offline display uses the first result-party main PC, not a guessed publisher profile
leader. The client request's snapshots, including historical stats and equipment
IDs, are preserved.

`pve_item_claim` reserves combined ordinary and non-Iris rank acquisitions using
the same cumulative counters as mission/box/shop and other recorded producers.
No native inventory is pre-credited. An ACK requires its stage/token receipt,
clear/objective flags, initialized PC rewards, current/high score, rank identities
and every reserved inventory acquisition. Separate saves and ACKs can cross a
restart. Once-proven canonical stage state can reconcile a repeated pre-clear
delta, but cannot stand in for missing inventory. Spending after acquisition is
allowed; completed item counters, clear counts and high scores cannot regress.
Unknown legacy completion snapshots remain queued and explicitly unavailable.

Only a settled ACK publishes history. Indexed `pve_record` pointers select the
latest actual clear and highest captured score, so a lower repeat changes the
recent party without replacing the best party. Ties retain the earlier best
snapshot. This is history recorded by this listener, not an invented reconstruction
of lost online records. Ranking and recent callbacks consume root player objects,
not a ranking-array envelope. The offline ranking contains only the real local
player, at rank1, and never fabricates remote peers. Clock changes retain these
records; original event-window eligibility remains unproven.

## Acceptance still pending

`node tools/test_pve.cjs` passed on 2026-10-06 with disposable SQLite saves:
all36 score tables/186 unscored stages, false outcomes/true repeats, progressive
original prizes, historical parties, restart, split save/ACK, replay and rollback.
The fixture now explicitly opens its stages and separately checks locked-stage
rejection; it does not prove natural unlocks. Failure assertions include the
server rejection reason. `test_master_data.cjs` remains deferred. Native hot delivery,
both annihilation flags and natural defeat/timer paths, all result-screen
branches, inventory grants/signatures, null/guest parties,
historical-party screens, unscored stages, cold recovery, natural availability,
remaining battle EXP/unlocks/loot provenance, publisher scoring parity and
unrecorded reward-source interleavings remain unverified. See the consolidated
packet checklist; do not count these routes as complete until those checks pass.
