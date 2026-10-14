# Telskyura Abyss local gameplay and native-save handoffs — source only

Frozen EU15.1.0 ARM64 SHA-256:
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.

`serial_pvp` is Telskyura Abyss, not Record Buster (`pvb`) or Under Telskyura
(`under_pvp`). The initial implementation added three **partial** routes:
`serial_pvp/summary/get`, `serial_pvp/grade/select`, and
`serial_pvp/rival_list/update`. No route is feature-complete. The actual player
save, running listener, APK and MuMu have not been changed in this slice.
No workers or GitHub Actions were used. Implementation precedes testing;
co-op remains last.

The latest resource slice adds original recovery-ticket identities, shared
issued item awards, guarded native ticket debit/SP saves and persistent
stock/recovery checkpoints; see [ticket recovery contract](serial-pvp-stamina-contract.md).
This is source-only, with its runnable checks and native acceptance deferred.

## Current native Abyss title save

SOURCE ONLY, **DEFERRED / NOT RUN**. Native2501050's automatic title type9 is
Abyss, not ordinary War Game or Under Telskyura (type2). Exact17241dc resolves
the title's original season ID, not the current display season. The client
requires that season's matching-end slot4 to be strictly before the clock,
inclusive original rank bounds and native isAggregate. It then creates the
two-long UserTitleBadge row and saves through UpdateTitleBadge.

The shared save path now admits new type9 rows only with their existing
earned-ranking receipt and exact published native record in the merged save.
This reuses the actual closed participation/score/processing save/ACK and
original prize proof described below; arbitrary imported aggregate flags or
forged ranks are not earning. The existing explicit solo-offline rank1 policy
remains unchanged. Other original tiers are not supplied with fictitious peers.
Gift collection is separate: claimed/cleaned Presents retain the same earning
receipt. Already owned titles survive rewind and unequip without re-awarding.
No new schema, private title ledger, award operation, badge precredit or prize
was added. Badge, selected title, native record, tokens and sequence/reply use
the existing outer transaction.

Extended test_serial_pvp_ranking_rewards.cjs queues before/exact-end/strictly
after cutoff, unearned/forged status, wrong tier/season, unpublished/corrupt/
missing receipt, merged rank changes, combined title selection, profile/reply
rollback, no duplicate gifts/wallet/operations, actual-wire retry, restart,
rewind, unequip and claimed-gift cleanup. **NONE RUN.** Native dirty collection,
signed import/save/ACK ordering, automatic title UI/rendering and no-crash/ANR
acceptance remain unverified. Other title acquisition producers remain partial.

## Current earned-ranking status publication

SOURCE ONLY, **DEFERRED / NOT RUN**. This supersedes earlier statements that
local prizes leave native rank/isAggregate/isReceiveReward permanently zero.
Original publisher aggregation and flag timing are NOT recovered. The explicit
solo-offline policy now publishes rank1, isAggregate=true and isReceiveReward=true
only when both original prizes have been durably committed to Presents after
actual closed participation and its native score/processing save/ACK. Here
"received" means delivery to the Present List, not individual gift collection.
The recovered route inventory has no separate Abyss reward-claim packet.

The native12-field record already imports these fields via exact JSON27dfde4
and MessagePack2812544. Exact28a3f28 and28a4008 write protected booleans at
record+0x148/+0x170 and dirty+0x228. Their neighboring28a3d54/28a3e4c functions
are adversary-list operations, NOT flag getters; no exception-tail pseudo-getter
or unverified UI consumer is used as evidence. Native menu notification,
cache/save ordering and publisher-side phase semantics remain unproved.

The existing earned receipt retains the immutable original30100 score record
and progress pointer, plus a published boolean. One outer packet transaction
covers both original gift captures, Gift profile/token, native ranking record/
token, publication checkpoint and sequence/reply. Only rank and these two
server-owned status fields change: score/cumulative/class/adversaries/matching,
native resume/processing, SP, inventory, wallet and signatures stay untouched.
Gift collection still uses the separate existing2000 claim/save/ACK path.

Fresh login, confirmation, summary, Gift pull or UserSerialPvpRecord pull can
settle an earned season; replay remains read-only. Summary/player details use
the published native record and result/get displays the committed local rank.
Historical save validation compares native published status against its earned
receipt while still pinning the original battle score vector. Stale or forged
rank/flag puts cancel rather than overwrite the server-owned status. Record
and Present pulls validate the same production proof. Missing or contradictory
publication/gift/score evidence cancels3000999 without changing saves.

Original two-key pre-publication outboxes can upgrade once only after their
original prizes and unchanged native score record are proven. The update adds
no new award, receipt, operation, gift ID or collection credit. It retains the
original issue date and works after clock rewind. Already published records
receive no repeated profile writes; restart, claim/cleanup and rewind do not
unset status. Existing UNIQUE/primary-key receipts and transaction are reused;
no extra table or native score/signature precredit.

Extended `node tools/test_serial_pvp_ranking_rewards.cjs` is **NOT RUN**:
fresh zero/positive summary and record pulls, current result rank, native token/
field preservation, source no-op saves, stale/forged status rejection, legacy
upgrade without duplicate awards, profile/publication/reply failure rollback,
no repeat writes, two-season historical saves, restart/rewind and gift cleanup.
Shared serial/completion/lobby/battle/view/gift/save/recovery/Android/launcher
regressions and actual signed native flag imports, caches, notifications,
menus/back navigation/no-crash/no-ANR/performance remain queued.95 partial/
74 unsupported/zero complete. Actual seed/save/listener/APK/MuMu unchanged;
no workers or GitHub Actions, co-op last.

## Current cross-season native resume and historical-save handoff

SOURCE ONLY, **DEFERRED / NOT RUN**. Native30100 clears processing to0 but
retains UserSerialPvpInfo.resumeRivalUserId. Requiring UID0 for a fresh season
therefore rejected legitimate next-season summary, selection and ranking views.
These paths now use the same idle-context proof: the newest captured START must
have its actual saved/ACKed END, owned resume ID, record/status/usage and latest
season progress pointer. An older successful END cannot hide a missing or
pending newer START. Existing UNIQUE operation-ID indexes provide newest seeks;
no lifetime battle scan or extra schema.

Native saves merge puts into full season tables. Old records, timestamps and
usage are validated against their own last acknowledged round; global resume
and processing are validated against the current season's actual start/end
capture, including the candidate native save before commit. This applies during
new-season30200 and30100 saves and after completion/restart. Unknown IDs, stale
or missing captures, restored old resume IDs, changed old score/timestamps and
missing modern progress pointers cancel3000999 without repairing/resetting
player data. Only original pre-streak defeat receipts retain the legacy
result-pointer fallback.

Cross-season pending lobby/attempt saves and issued-but-unobserved usage
summaries must settle first. A closed saved run can hand off. An unfinished
acknowledged winning run can hand off only after its original matching period
expires and the target season starts at/after that boundary. This is an
explicit offline expiration policy, NOT a recovered publisher abandonment
algorithm. Its original native rows and open-run receipt remain intact; no
closed result, rank, reward, SP debit/reset, signature or flag is invented.
Earned-season clock-rewind matching guards remain in force.

Extended `node tools/test_serial_pvp_ranking_rewards.cjs` is **NOT RUN**:
two different resume opponents, empty new-season summary/rank/usage, original
old-row retention through actual30200/30100 and merged saves, restart, pending
selection/finish/usage, wrong or zero restored UID, orphan processing, missing
modern progress pointer, changed historical record/timestamp, and expired
winning-run handoff without a fabricated reward. Existing completion/lobby/
battle/view/SP/save/recovery regressions and native natural earning, clock
navigation, signed save/ACK order, caches, back navigation, no-crash/no-ANR and
performance remain queued. Counts stay95 partial/74 unsupported/zero complete.

Exact27dfde4:27e0658 JSON and2812544:2812b20 MessagePack imports accept the
original12-field record including isReceiveReward/isAggregate. That proves
parser fields, not when these server-owned flags should become true. Their
consumer/earning/save phases are still open; this handoff does not flip them.
Actual seed/save/listener/APK/MuMu remain untouched; no workers or Actions.

## Current original ranking prizes and once-only Presents

SOURCE ONLY, **DEFERRED / NOT RUN**. This supersedes earlier wholly-unimplemented
ranking Present production, not publisher aggregation, native rank/aggregate/
reward flag transitions, combat providers, signatures, client ordering, UI or
no-crash/no-ANR acceptance. Counts remain169 discovered/95 partial/74 unsupported/
zero complete; all10 serial routes PARTIAL. Actual seed/save/listener/APK/MuMu
untouched. No workers or GitHub Actions; co-op last.

Exact1bb5050:1bb5098 reads information at vtable0x20, **slot14**, then tailcalls
1bb56a0:1bb58e4. It joins group.slot1 to that selector, excludes group.slot2=-1,
and joins item.slot1 to group ID; item.slot2/slot3 are int32 item ID/quantity.
Slot11 is NOT the reward selector. All50 original seasons currently select1.
Only explicit positive bounded rank ranges are interpreted; negative rank
sentinels and speculative grade awards remain unsupported.

The existing solo-offline board has one real local participant at rank1 after
an acknowledged closed run, including genuine zero-score participation.
Original group81400010001 yields Iris205000001 x200 and eleven-draw4-star
ticket296000014 x1 (rows81500000001/81500000002). These are original first-place
prizes under a disclosed **local solo rank**, not recovered publisher standings
or their aggregation algorithm. Empty history, open/unacknowledged combat and
unsaved lobby/attempts do not earn gifts.

Fresh login, confirmation or a pull requesting UserGift enables delivery at
the original matching-end boundary. Indexed owned result/latest-record/best-party
pointers bind the actual saved30100 proofs, native record, catalog, date and
original prize rows in one private per-account/per-season receipt. No lifetime
battle scan. Historical records use their own score proof, not a different
season's current global resume UID/processing. Earned seasons cannot reopen
matching after an event-clock rewind.

Original Lua generated/user_enum.enc identifies COMPANY1 and RANKING8; SHA-256:
`905df850cb98120346f0a638a658f2aabf99dd42127d247e2ee51ccc9f4303dd`.
Native265e2c0:265f3cc validates acquired type using the original1..36 enum vector
(startup138e5e0/rodata35a7b38). Native265d46c requires **19 flat Gift fields**,
not an Another Eden contents array or invented rankingRewardPresentList key.
An explicit offline title labels the source, matching-end is startAt, issuance
is createdAt, and expiry0 is disclosed permanent offline delivery policy.

The shared creator serves explorer login and ranking rewards; IDs exceed saved,
pending, claimed and permanently issued IDs. Gift profile/token, both private
ranking receipts and sequence/reply commit in the existing outer transaction.
Issuance writes only server-owned UserGift: no native ticket/SP/signature,
record flags/rank or wallet precredit. Cached binary pull checks are read-only,
guard current UserGift, and cannot restore stale Presents or issue outside a
fresh packet transaction.

Collection reuses gift/receive's2000, once-only Iris wallet credit and existing
native gacha dateList/cumulative receipt. Each private Gift retains its actual
claim operation ID after ACK; another operation_done ID is not collection proof.
Lost production/claim/score/catalog evidence, deleted/changed unclaimed gifts
and restored received gifts cancel3000999 without resetting history. After
either native gift-state or ordinary inventory effect saves, hot/cold/cached
redelivery cancels until ACK. Save replies suppress only that obsolete additive
delivery, retaining the queue and required gift-state/inventory ACK proofs.
Pending saved flags cannot rewind to unclaimed, and existing saved acquisition
checkpoints cannot be deleted or rewound before ACK; native profile values are
the durable observations, with no extra speculative flag schema.
Completed gift cleanup is allowed; permanent issuance/claim history prevents
restart/rewind duplication and ID recycling.

New `node tools/test_serial_pvp_ranking_rewards.cjs` is written but **NOT RUN**:
all50 selectors/prizes, bounded/sentinel tiers, empty/pending/zero/positive runs,
login and fresh pulls, two seasons with different resume opponents, reordered
native Gift fields,
issue boundaries, no native precredit, restart/rewind once-only, stale pulls,
changed/deleted gifts, real2000 ticket/Iris claims, both split save orders,
observed callback suppression, completed cleanup, corrupt claim bindings and
transaction rollback. Shared gifts/explorer/serial/save/recovery/Android/launcher
regressions are queued too. Native caches, aggregate/rank/reward notifications,
Presents rendering/popups, signed effects/ACK order, natural earning,
previous-season navigation, cold recovery and performance remain unproved.

## Current post-matching summary and shared local leaderboard

Summary/get now remains readable while the original DISPLAY season is active,
including matching-end through display-end (exclusive). Grade selection,
opponent refresh and NEW battle/start still require the original MATCHING
window; battle/start explicitly requests that stronger gate even though it
reuses summary's saved-state validation. Disabled zero-width matching seasons
remain unavailable. Saved combat/resume/end/resource handoffs are unchanged.
This uses the existing175dba4 display-season projection as the local viewing
policy, not a claim to have recovered the publisher's post-event service.

Exact233aafc:233b334 parses serialPvpRanking with2104004, the SAME native
entry parser used by ranking/get's234054c:23407ec. The summary no longer
unconditionally emits an empty board: one shared projection returns the
actual local account's saved best score/grade/leader and frozen full party.
Only a real acknowledged closed run contributes an entry; zero-score
participation still counts, no-history remains empty, and lost best-party
proof or an unrepresentable int32 score cancels without replacing history.
Rank1 is the existing explicit solo-offline policy, not restored publisher
ranking. Neither native UserSerialPvpRecord.rank nor reward flags are changed.

Native menu producers1bbb6b4:1bbb87c and1bbf260:1bbf438 request the current
season without userId;1bbf438:1bbf618 also supplies the actual userId.
Wrapper2338e10 only adds a userId field when it is positive, and233aafc
maintains separate total/user caches for these branches. Both local summary
request shapes therefore receive the same truthful single-account board;
remote users remain unavailable. These calls do NOT prove previous-season
summary availability, so no historical/disabled-window exception is invented.

Existing permanent actual-wire summary receipts, native checkpoint guards
and outer SQLite/reply transaction are reused. A clock change cannot reopen
matching; expiry rejects even cached identities. A changed score/name/party
or obsolete saved generation cancels an old receipt rather than overwriting
newer state. Old receipts with empty boards must reopen the screen after
this source upgrade. No new database schema, queue operation, inventory,
Presents, wallet credit, signature or aggregate/reward flag is added.

Original message40650147 says ranking rewards go to the Present List after
the event; `rankingRewardPresentList` is NOT a recovered wire field. Publisher
reward aggregation and rank/reward native-save transitions remain UNIMPLEMENTED;
the source-only once-only original prize provider is described above.

Updated test_serial_pvp_lobby/battles/completion checks are **DEFERRED / NOT
RUN**: saved unplayed start rejection after matching, both summary shapes,
empty/zero/positive/best-party boards, display boundaries, no profile/reward
precredit, cold actual-wire replay, missing best proof and receipt/reply
rollback. Native menu/cache rendering, post-event text, flag transitions,
effect-save ordering, back navigation and no-crash/no-ANR acceptance remain
unproved. Counts stay95 partial/74 unsupported/zero complete; all10 serial
routes PARTIAL. Actual seed/save/listener/APK/MuMu untouched; no workers or
GitHub Actions; co-op last. This supersedes the earlier wholly-unimplemented
post-event SUMMARY statement only; see the newer ranking Present slice above.

## Current original entry eligibility and persistent unlock

The entry slice now binds the existing lobby/start path, new Iris refill and
new local ticket consumption to the original unlock. Counts remain95 partial/
74 unsupported/zero complete,169 discovered; no additional packet is invented.
All10 serial routes remain PARTIAL. No functional or emulator checks were run.

Exact native2106d60:2107040 reads `system_flag.feature.serial_pvp` first;
**any nonzero value** permits entry immediately. Otherwise the first original
serialPvpEntryCondition row requires UserAdventureStage1010000105111.state4
and ANY UserPvPRecord.score>=1800. The condition text says "over1800", but the
actual comparison includes1800. This is neither a rank nor a high-grade or
cumulative-score test, and does not require a current-season PvP record.
UserData2791d44's vector+eb0 is named pvpRecord at2796840; exact serializer
2783df4:2784324 maps its protected+b8 to score/int32. Typed owned stage/War Game
identities, duplicate rows and native field widths are checked before entry;
zero-owner stage/PvP prerequisites remain conservatively unavailable pending
their separate producer proof. Nonzero unlocks avoid reading either table.

GOT432a9d8 -> static string44867a8 is initialized at11272b0..11272c4 from
original rodata34917e8. Original systemFlag.enc now exports64 long-ID rows:
flag91218027, default0/min0/max2/readonly=false. File SHA-256 is
`a9d9ec10a45a97bbaaf0869bbbded370e48f837ee50533fd9205873323583cee`.
There are147 total original hashed sources.1697db8:1697f2c decrypts the
readonly field's eight-byte block to ONE byte; it is not a plaintext boolean
or a four-byte int. Three other original flags are readonly. The separate
systemFlags export leaves old serial/CPU capture catalogs unchanged.

When the prerequisites pass, native2106d60 calls23afb0c with value2.
That setter checks original min/max/readonly and delegates to25ff5c0:
only flagValue/dirty state changes, not owner or timestamp.23af780 lazily
creates a missing row through23afda0/25ff2f8; the long owner and timestamp
start at0, only systemFlagId/default are set, and26aa90c inserts/indexes it
without an owner/time setter. Existing rows keep their actual owner/stamp.
New lazy rows therefore require owner0/stamp0, whereas a seeded owned row
must preserve its owner/stamp. A newly saved nonzero value requires those
actual native stage/score rows, including a combined prerequisite/flag save.
The entry function writes2, but the getter/setter permit1 too; the save guard
does not demand that an intermediate dirty2 was pushed before the first1.
Exact notification/save coalescing still needs native proof. Existing
nonzero1/2 values remain unlocked and may change within that nonzero range.

No API prewrites the native flag, grants its stage/score, modifies signatures
or adds a fake unlock operation. The existing user_data/push transaction
commits the native row/checksum plus primary-key serial_pvp_unlock observation
and reply. A pre-existing nonzero imported flag is observed on new lobby/refill
issuance, not re-earned. The checkpoint binds account/original flag/owner/catalog;
stale deletion/relock/identity/catalog changes cancel retaining progress. The
native nonzero flag is still the authority, not a fabricated server entitlement.
Unlocking itself is timeless; it does not open disabled/expired matching windows.
Existing captured run/resource/end saves keep their late-save behavior rather
than being gated again by today's training score or event clock.

NEW test_serial_pvp_eligibility.cjs and updated serial/master checks are
**DEFERRED / NOT RUN**: threshold1799/1800, stage3/4, any-record/sticky behavior,
typed/duplicate/foreign rows, no native precredit, split/combined save, imported
flags, lazy owner0, nonzero transition, unrelated flags, deletion/relock/corrupt
checkpoint, restart/actual-wire replay/late clock and profile/checkpoint/reply
rollback. Existing gameplay fixtures use one shared temporary unlocked clone;
the actual seed/player database is unchanged. War Game scoring is still
client-saved prerequisite evidence, not independently reconstructed publisher
training combat. Native earning, in-memory-before-save ordering, timestamp
housekeeping/notification transitions, signatures, menu/cold recovery and
no-crash/no-ANR acceptance remain open. Post-event summary/aggregation/reward
handoffs are still unfinished; co-op remains last. No workers or GitHub Actions.

## Current local rankings, character usage and saved self-details

Both remaining serial ranking routes now have **source-only PARTIAL** handlers:
`serial_pvp/ranking/get` and `serial_pvp/character/ranking/get`. All ten
discovered serial routes are PARTIAL, NONE feature-complete. Overall inventory
is now95 partial/74 unsupported/zero complete,169 discovered. This supersedes
the older eight-partial/two-unsupported counts below. Neither synthetic nor
native tests were run; actual saves/listener/APK/MuMu remain untouched.

Original ranking wrapper233ff34:2340318 sends only serialPvpId. Callback
234054c:23407ec parses TWO arrays, serialPvpTotalRanking and
serialPvpUserRanking. Both use2104004:21044d0: int64 userId/gradeId, string
name, int32 pcId/rank/score and party.slots. If slots is missing, the parser
omits the ENTIRE player. It separately reads the first pc object's
heroSublimateLevel and isUnlockedHeroSublimate, so a flat player/score or
made-up root-level sublimation field does not cover the constructor.
The native ranking score parser is int32 even though the owned record is
int64; an unrepresentable score cancels with saved progress retained, not
truncated/wrapped.233ff34 also caches by season; natural screen reconstruction,
hourly cache invalidation and freshness after a score/clock change still need
the deferred native batch.

**Explicit solo-offline board, not publisher restoration:** after a real
closed local run, both arrays contain the actual account at local rank1,
current saved best score, that run's original grade/leader and full frozen
ordinary type9 party. A lower later run does not substitute its party for the
saved best. Before any closed run the board is empty, not populated with CPU
offers or fictitious former players. A zero-score closed run is real local
participation, not silently treated as no history. No publisher rank,
matching/aggregate/reward flag, currency, native profile or operation is
granted by opening these pages.

Character request1bbc67c:1bbc92c likewise sends only serialPvpId. Its network
callback1bc32b0 schedules1bc35d4, which invokes shared2141c44:214216c. The latter
requires normal and assist arrays, each containing int32 rank/pcId. The
implemented ranking counts actual ACKed local round participation, including
loss/retirement and zero scores, once per distinct PC per kind per round.
It is NOT publisher-wide popularity, the CPU lobby, a best-party-only sample,
or turnCount cooldown values. Ties sort by original PC ID for a stable local
order. Original native cooldown/first-participation semantics are unchanged.

Indexed serial_pvp_usage aggregates update at30100 ACK in the existing save
transaction, alongside battle closure/progress/profile/ACK/reply. A catalog-
bound checkpoint pins last battle/operation, total round count and a digest
of those fields plus the actual counts. Repeat ACKs cannot add participation
again; partial effects/queued ends do not count. Normal views use the distinct-
unit aggregate and bounded round proofs, not a lifetime battle scan. A missing
initial index can be built ONCE from original validated closed/ACKed private
captures, never inferred from legacy native score/usage rows. The read-only
replay preview does not persist this build; actual indexing participates in
the new view's transaction. Partial/orphan/corrupt indexes or missing capture
history cancel without rewriting native saves. Source-only migration and
recovery ordering/performance still require testing.

Self player_info/get now selects the proven best party, or an actual captured
combat/acknowledged round when no completed best exists, even outside active
combat. It returns the actual current record ARRAY, existing generic profile
and root Familia name. It does not reconstruct historical levels/equipment
from today's UserPC/UserParty. This covers the rank-row -> self-details path
that previously canceled after finishing combat. Source replay validation
continues to bind actual wire/action/season/owner/catalog/current generation
and full response; old score, party, profile and expired-display replies
cannot silently replace a newer native cache. CPU details retain their
original labeled current-lobby policy and zero history.

Existing completion/views checks are extended and **DEFERRED / NOT RUN**:
empty boards, malformed owner/shape, pending-start/end cancellation, real
zero/positive score entries and party fields, no publisher/profile/queue
precredit, repeated-ACK suppression, all-round normal/assist frequency and
stable ties, no active battle needed for saved self-details, best-party
preservation after lower runs, cold/cache/stale-wire/expiry handling,
missing-pointer/digest corruption, one-time old-capture bootstrap and
aggregate/checkpoint/profile/ACK/view/reply rollback. Portrait and owned
team prerequisites are synthetic original-ID values confined to temporary
fixtures, not live unlock/profile repairs. CPU-view checks now use independent
class selections and a real refresh save, not prohibited unplayed reselection.
Natural eligibility, client stats, cache/render/constructor/portrait/order/
back navigation, no-crash/no-ANR and performance remain unverified. Co-op last;
no workers, GitHub Actions, tests, builds or installs in this follow-up.

## Current score-record and opponent-refresh follow-up

This supersedes the unchanged-record and unsupported-counter limitations in
the historical slices below. The eight implemented serial routes remain
**PARTIAL**, the two ranking routes unsupported; overall93 partial/76
unsupported/zero complete. No functional, synthetic or emulator test was run.
Syntax checks and regenerated audit/checklist metadata are not acceptance.

Native record parsers2812544/27dfde4 bind `score` to setter28a3734 (int64
offset0x88), `cumulativeScore` to28a3814 (0xb8), and `highestGradeId` to28a38f4
(0xe8).2337c14 reads the LAST of those, not cumulativeScore.1bbf93c compares
the requested original class tier with the maximum selectable class returned
by that record;40650036 says five wins unlock the next class. The native
setters omit unchanged dirty rows. Individual round, current run and saved
best scores must not be conflated.

**Disclosed local settlement policy, not recovered publisher scoring:**
each reflected round adds actual client roundScore to cumulativeScore; a
closed run replaces score/winCountAtHighScore/gradeIdAtHighScore only when
its actual round sum is strictly higher. Five wins advance highestGradeId to
the next authored class, capped at Hero, without relocking a higher class.
This update uses only original class IDs/tiers and actual captured telemetry.
The exact publisher cumulative-accrual timing, ties, participation and
score-component providers are not proved.40650178 supplies the out-of-period
gate: a finish issued outside MATCHING does not grow the record. The decision
is frozen at issuance; changing the clock before saving/ACK cannot alter it.
Ranks, matchingScore, adversary history, aggregate/reward flags, balances,
mission rewards and publisher peer rankings are unchanged.

Real30100 carries the issued record ARRAY. Indexed record_handoff tracks its
actual native observation; the finish ACK requires BOTH processing0 and the
exact record save. Record-first, processing-first and combined saves are
supported in source. Unchanged rows need not be dirtied again. Either changed
effect suppresses singular/plural callback redelivery while retaining the
queue for ACK; there is no profile/signature prewrite or achievement replay.
The existing SQLite save transaction includes record observation, battle
closure, active removal, progress/result/best-run pointers, native profiles,
ACK and reply. The best-run pointer preserves the frozen leader on a lower
subsequent run; result/get reports a local new-best indicator, NOT a publisher
rank/award. Legacy end/streak captures keep their original hashes/envelopes;
no score is retroactively granted for them.

Counter evidence is separate from score history. Original40650071 gives
three refreshes PER BATTLE, restored by battling.233a534 increments the owned
updatedMatchingCount and sets executeRivalListUpdate=true;1bc308c dispatches
its UpdateSerialPvpState save.233bc58 clears list/update flags and writes the
list clock but DOES NOT increment the count.1bc2e74 and1bc4628 set count0
and dispatch a native save around class/combat transitions. The native UI
reads authored rule.slot6 (3), not a run-length or guessed battle limit.

The listener now accepts the exact +1/execute=true save, bounded to the
original quota and one unconsumed intent per selected lobby generation.
rival_list/update requires that observed intent; the callback retains its
count while awaiting the original status/timestamp save. An indexed matching
checkpoint binds generation/count/reset intent. Native count0 before the
battle packet is accepted but locks new refreshes until a real captured start;
count0 after start must be observed before30200 ACK. New start captures freeze
their matching checkpoint so later refreshes do not invalidate historical
rounds/archives. No server-side profile reset, new attempt debit, fabricated
quota top-up or inferred failed-request reimbursement is performed. Exact
failed-refresh client recovery remains part of native acceptance.

Extended existing completion/lobby/run-entry/master checks are written and
**DEFERRED / NOT RUN**: higher/lower/tied records, each save order, late
clock-changed ACK, no-op omission, class-cap preservation, cold retry
suppression, best-run pointer and record/ACK rollback; three valid increments,
missing intent/fourth refresh rejection, cold persisted intent, pre/post-start
reset, pre-start reset reuse prevention and profile/counter/reply rollback.
Synthetic IDs/stats/ownership/signatures are NOT proof of natural class
eligibility, native constructor/rendering, real effect-save ordering,
achievement grade conversion, stability or performance. The original direct
end helper is raw210373c (RET), NOT the unrelated raw2203290 function in one
read-only artifact; Ghidra symbol addresses carry a0x100000 bias.

## Current five-round win-chain follow-up

This section supersedes the older fresh-run/first-defeat-only limitations
below. Wins now have a **source-only** local continuation: real30100 retains
the selected grade through wins1..4, appends actual client round scores and
increments currentWinCount. One loss/retirement or the fifth win closes the
run. Starting/resuming later rounds does not consume another SP. At this
historical slice record fields remained unchanged; the score-record section
above supersedes that restriction while rewards/rankings remain open. Totals:
93 partial/76 unsupported/zero complete; eight serial partial/two rankings
unsupported. Neither source fixtures nor native gameplay tests were run.

The rule is now grounded in original `message.enc`, SHA-256
`a5814e507ed34a86886336f396d99a14e3bc47173891a492ce39d9dfe72760a5`:
40650029 says the selected class cannot change until one loss or five wins;
40650069 says five consecutive wins or one loss finalizes a run.40650036
also describes class unlocking after five wins, but its actual native record
settlement remains unfinished. Original messages are exported separately as
`serialPvpMessages`, preserving existing serial catalog/legacy captures.
The earlier ability to replace an observed but unplayed selection is removed:
it contradicted the original class-lock rule and could consume extra attempts.

Native233d9cc/233dabc and2338490/2338674 reject positive turnCount units and
Memoria;1935f8c builds the corresponding original restriction popup.210648c
labels positive counts "Ready in {}" and zero "Played".193eb04 excludes ANY
existing usage entry from first-participation bonus, so zero entries must not
be deleted. The implemented eligibility check follows those observations.
**Duration is still an inferred offline policy:** each intervening completed
winning round decrements existing counters; participating nonempty PC/assist
and Memoria IDs receive authored rule.slot5 (3). The meaning of slot5 as a
cooldown duration is not independently recovered. It is NOT a three-use cap,
nor a claim of original publisher settlement/participation filtering parity.

30100 does not merge usage. After processing0/save/ACK, summary/get issues
the computed native usage object; its real UserSerialPvpUsingLimitData save
must be observed before the next30200. The listener never prewrites the
signed profile. Unissued usage saves, direct starts using a positive counter,
pending replacement pulls and unobserved next-round starts cancel safely.
Fresh grade selection after a closed run returns the native empty-usage reset
and waits for its actual save alongside the newly captured one-SP spend.

An owned indexed `serial_pvp_progress` pointer tracks the last ACKed round;
the existing result pointer changes only for closed runs. Per-battle
`serial_pvp_usage_handoff` stores issued/observed proof with a partial pending
index. Later30200 captures freeze predecessor identity, actual scores/wins,
owned party, usage and native processing/resume/timestamps. Validation follows
at most four winning predecessors, never lifetime history. Opponent refresh
archives the prior selected lobby proof; entry generation/SP proof stays
constant. All profile/progress/usage/active/result/ACK/reply changes participate
in the existing SQLite save transaction. Pre-streak completed defeat receipts
remain readable with their original catalog/envelope.

`test_serial_pvp_completion.cjs` now includes five-win runs, losses after
each possible winning round, rotating original-ID synthetic owned teams,
positive PC/Memoria rejection, zero Played retention/reuse, summary issuance
before native usage save, late clock-changed saves, no per-round SP spend,
class lock, refresh/archived predecessor proofs, cache/restart/stale-summary
recovery and usage/progress rollback. Lobby/run-entry fixtures were corrected
to isolate new selections rather than spending through an unplayed class lock.
All remain **DEFERRED / NOT RUN**. Synthetic stats/ownership/signatures do not
prove natural eligibility, native packet consumption, score providers,
participation filtering, achievement int32 grade conversion, UI/rendering,
ordering, navigation, stability or performance. Actual saves, listener, APK
and MuMu were untouched. No workers or GitHub Actions; co-op remains last.

## Prior fresh-run follow-up after defeat/retirement

This follow-up removes the one-lifetime-run restriction for the implemented
defeat/retirement branch. After the real30100 processing0 save and ACK, a new
grade selection can capture another attempt, save its lobby/SP checkpoints,
start and finish a fresh battle, and replace the latest result. All five
original grades remain available in their original season group. This is
**not win-streak progression**: wins, later fights within one run, unit-usage
progression, high-score/cumulative/matching settlement and rewards are still
unimplemented. Route totals remain93 PARTIAL/76 unsupported/zero complete;
eight serial routes PARTIAL/two rankings unsupported. The earlier statements
below that another run is wholly unavailable are superseded only for this
completed local defeat/retirement branch.

New indexed `serial_pvp_run_archive` freezes the validated original lobby and
observed attempt proof before a new selection replaces their mutable rows.
It keeps the original selected-request receipt and catalog checks; it does
not reconstruct unknown legacy progress. A fully observed selection replaced
before its first battle also retains its consumed-attempt proof. CPU vectors are reproducible from
the pinned original catalog/grade/generation, so the archive omits another
copy of all five large teams. Old finish captures stay valid independently
of the new lobby. Current results use the existing owned season pointer;
replacing it is an atomic upsert, with earlier battles/results retained in
their immutable capture tables. Current access does not scan lifetime runs.
Missing, unreadable or catalog-mismatched archives cancel with state retained.

The resume opponent UID and previous lastBattleStartAt are actual native
baselines, not forced zeros.30100 does not clear the UID. The next30200 can
replace it; when the original CPU rotation selects the same UID, the existing
correct value plus the new processing1 observation can prove the no-op setter
without requiring an invented dirty row. New capture, save and ACK still use
the existing transaction. Summary distinguishes a completed result from a
newly selected run: the latter exposes its new grade/opponents, zero current
score/wins and existResult=false. Selecting is still the attempt-spend
boundary, not battle/start or restart. A completed old entry cannot start
again without a newer saved selection; observed exact selection retries
cannot spend again. Pending checkpoints still serialize selection, pulls,
refills and starts. Native status saves retain the allowed observed clock
skew rather than forcing the issuance timestamp.

`test_serial_pvp_completion.cjs` is extended but **DEFERRED / NOT RUN**:
repeated fresh losses/retirements, all five grades, stock depletion, omitted
same-CPU UID rows, nonzero prior start stamps, observed selection replay,
old end/result identity rejection, immutable archive/cold restart/cache
eviction, retained history and new-selection/result-pointer rollback.
Distinct start timestamps are synthetic prerequisites; an identical-time
native no-op timestamp/omitted-row branch remains unproved. No test, listener
restart, APK build/install, MuMu interaction or actual player-save edit was
performed in this follow-up. Syntax checks are not gameplay acceptance.

Additional read-only native evidence:233d488/233d500 rebuild PC and memoria
maps from their owned usage arrays;233d81c/233d8f4 fetch entries by original
unit ID.233d9cc/233dabc return whether the saved turnCount is positive, and
193eb04 consumes these maps while deriving battle context. Only the summary
and grade-selection callbacks directly call21039e8 to merge usage. This does
not establish a guessed "three uses per unit", a five-fight round limit or
publisher usage settlement, and no such policy is enabled here.

## Current first-defeat/retirement finish slice

Eight discovered serial routes are now **PARTIAL**, two unsupported (the two
rankings), zero feature-complete. This supersedes older source-slice counts
and wholly-unsupported end/result statements below. End and result support
are deliberately limited: a fully saved first battle can end in defeat or
retirement. Wins, another run, high-score/cumulative/matching settlement,
turn-usage progression, aggregation, rewards and achievements remain open.
There is no claim of playable complete Abyss or native acceptance.

ARM64 instructions `1f0fec8:1f0ffe4` settle the previously unknown final
round calculation. They calculate the five protected components, reset
roundScore+38, add each component with int32 arithmetic, convert that sum to
float32, multiply by the native float32 grade rate, then **FCVTAS** into
int32 (nearest, ties away from zero). Ghidra incorrectly treated the first
obfuscated integer setter as a terminal branch and omitted the remaining
calculation; the instruction stream is authoritative. `1f0e15c` receives
the combat's **isWin**, not an assumed "is serial PvP" flag. `1f105ec` returns
the original grade.slot7 on wins or1 on losses; `1f10290` makes characterBonus
zero on loss. `serialPvpEndInput` checks the exact seven-field attack_result,
native int32/float32/rounding consistency, original grade, exact captured
private battle ID and coherent verdict. Components are **client-authoritative
local telemetry**, not independent server reconstruction of all native
combat/mission providers or proof against tampering. Negative/wrapped or
out-of-range conversion paths are conservatively unavailable.

The local first-defeat policy records the client's actual round score for
display, closes the local run and reports currentWinCount0, selectedGradeId0,
cycleScores with that one score, existResult=true, and serialPvpResult with
the captured original season/grade and isWin=false. Native record ARRAY is
the unchanged actual saved record. No fabricated high-score/rank, cumulative
score, adversary history, used-unit turns, reward flags, currency, item,
processing flag, signature or resume-opponent reset is prewritten. Rule
slot5/slot6 are not assigned a guessed number of rounds. Menu1b8e000 reads
rule.slot6 against status.updatedMatchingCount; that is **not** sufficient
evidence of a combat-round maximum.

The real **30100** contains the full direct callback fields for shared hot
transport and the same singular/plural envelope. Indexed `serial_pvp_end`
freezes verdict, original catalog, fully observed30200/start parent,
record/status/usage/resume/processing baseline and exact30100 envelope;
`serial_pvp_end_request` permanently binds actual-wire identity/action/body;
`serial_pvp_result` is an indexed owned season pointer, not a lifetime history
scan. Issue/queue/capture/sequence/reply share the existing transaction.
Missing/corrupt/legacy captures cancel3000999 with queue and save retained.
Unchanged pending retries reuse the same score and operation. Changed verdicts
conflict; observed/settled callbacks cannot emit their achievement event again.

30100's native **processing0** must save before its ACK. An unchanged record
need not emit a duplicate dirty row. Combined or processing-first/ACK-later
saves commit observation, active-pointer removal, battle closure, result
pointer, actual profiles and generic ACK/reply atomically. Partial push replies
suppress singular/plural30100 but retain its queue until real ACK. No native
processing2 or resume UID clearing is invented. Pending pulls, restart,
player-details and result replacement are blocked. Exact issued saves and
untouched finish delivery survive clock changes because30100 introduces no
new timestamp/cost. This is not full interrupted/cold reconciliation.

After complete save/ACK, `serial_pvp/result/get` accepts exactly serialPvpId
and uses the original **DISPLAY** period. It returns the saved single-score
roundScore ARRAY, captured int64 currentGradeId and actual frozen leader
PC for native display, winCount/previousRank/currentRank0, isHighScore=false,
aroundRankingData empty. These are explicit local first-defeat results,
not publisher ranked play or a high-score/reward claim. The existing
permanent view ledger pins owner, original catalog, finish operation and
full response across cache eviction/restart, and still checks expiry/current
native checkpoint on cached retries. Summary can return the saved result
without pretending the lingering resume UID is corrupt or resetting history;
new grades/runs remain unavailable until their progression is recovered.

`tools/test_serial_pvp_completion.cjs` is **DEFERRED / NOT RUN**. Written
isolated probes cover original rates/float32 rounding, malformed/inconsistent
scores, unsupported wins with no mutation, first loss/retirement, exact30100
fields, no native precredit, pending/fresh/exact retry, changed verdicts,
clock-changed delivery/save, both processing/ACK orders, singular/plural
suppression with retained queue, cold/cache-evicted requests, saved result and
summary, expiry, unchanged record/usage/UID/flags, corruption and atomic
issue/profile/observation/active/result/ACK/reply rollback. Synthetic stats,
save signatures and prerequisites are not native acceptance. Result-screen
rendering, original grade's int32 achievement-event conversion, actual
effect-save-ACK order, menu-retirement before a captured fight, back navigation,
crash/ANR behavior and performance still need the deferred native batch.

Follow-up source implementation adds native season allowance, grade/run-entry
SP spending, interval recovery and exact Iris10600 refill captures/save/ACK
guards. Selection now captures one attempt; a completed additive callback
cannot replay that debit. Opponent refresh does not charge another attempt.
The newer first-battle start/resume implementation below adds two partial routes;
see [Abyss attempt contracts](serial-pvp-stamina-contract.md).

## Original archive and client contracts

The decoder now exports all15 `contents/1/master/divide_enc/serialPvp*.enc`
tables separately, retaining original IDs, column order and source SHA-256:
50 information rows, five grades, one rule/entry condition/calculation,
10 matching conditions, four badges, eight reward groups/16 reward items,
50 SP tickets/score-bonus rows,34 Familia bonuses,15 turn bonuses,
four final-turn bonuses and42 missions. Unknown columns remain `slotN`;
exporting a table does not recover its gameplay formula.

Grade slot7 and calculation slots1/4 are original float32, not integer bit
patterns. The original `serial_pvp_infomation_N` spelling is retained.
S29..S36 have zero-width matching dates at1893423600 despite their earlier
display dates; S37..S50 also have zero-width display dates. These authored
disabled windows are not widened, shifted, or interpreted as unlimited.
The lobby uses matching slots3/4, start-inclusive/end-exclusive, as an explicit
conservative offline availability policy. Full native entry/display/result
phase behavior and the original1800 training-score eligibility remain pending.

Raw ELF offsets below have no Ghidra image-base bias:

| Route | Request wrapper | Response callback |
| --- | --- | --- |
| summary | 2338e10:23392b0 | 233aafc:233b334 |
| refresh | 2339c7c:233a0d8 | 233bc58:233c2a0 |
| grade selection | 233a0d8:233a534 | 233c85c:233cf24 |

Summary accepts `serialPvpId` and optional positive `userId`; the local account
only is supported. Selection/refresh accept `serialPvpId`/`gradeId`.
Summary reads **currentScore** into context+0 and **selectedGradeId** into+8,
plus int32 `currentWinCount`, boolean `existResult`, `serialPvpRanking`,
`rivalList`, `serialPvpRecord` and optional `serialPvpUsingLimitData`.
The selection callback reads root `gradeId` into the same selected-grade
context+8. No operation packet is fabricated for these direct callbacks.

Record merge2103740 iterates a **record array**. Its actual JSON merger is
27dfde4:27e0658, NOT28dfde4 (the latter is an unrelated container routine).
Usage merge21039e8 takes **one object**, reads its season and clears/rebuilds
`usedPcList[{pcId,turnCount}]` and `usedMemoriaList[{memoriaId,turnCount}]`.
An absent usage object is omitted from a fresh summary; a selected grade sends
the actual three-field reset object, not an array or invented owner.

Rival parser2339460 consumes `serialPvpPlayerInfo` with userId/name/totalExp/
gradeId/rank/score/preRank/titleBadgeId/subTitleBadgeId/leaderPcId/isDummy,
and `serialPvpParty` through the ordinary UserParty parser. It forces type9.
Refresh/selection callbacks clear update/execute booleans and set
`lastRivalListUpdateAt` from the clock, NOT the user ID. Only a newly created
status receives an explicit zero `lastBattleStartAt`.

## Native saves and local policy

UserSerialPvpRecord has12 native fields, including int64 score/cumulativeScore/
matchingScore and separate high-score grade/win fields. It has **no** current
score, current wins or selected-grade field. GameStatus has seven fields;
UsingLimitData has four. Native parsers2812190/2812544/2812b20 and constructors
1ba7850->28a31a0,233b900->28a251c establish these distinct classes. The lazy
classes allow owner0 or the actual local owner, never arbitrary accounts.
The default GameStatus starts update=true/execute=false with zero counters and
timestamps. Initial records are zero/false; these are not automatic prizes.
The three tables are explicitly keyed by season, not a shared grade.

The initial lobby slice accepts only empty/default current-season
records/usage and zero battle/matching counters. Unknown legacy progress,
resume opponents, active processing state or used units are preserved and
cancelled3000999 rather than cleared or presented as a fresh run. Unchanged
other-season native rows remain retainable. CurrentScore/wins0 and no pending
result are initial-run values only; existing high score is never substituted
for current score. Native eligibility is not bypassed or claimed proven.

**Offline CPU policy:** reuse existing original Under Telskyura dummy teams
without scaling their stats, changing their units, or inventing equipment,
ascension, boards or memoria. Five distinct opponents rotate deterministically
within the authored312-team pool. Selected Abyss grade labels identify the
local challenge, not a recovered historical assignment of these teams.
Opponent scores/ranks0 mean these offline CPUs have no published Abyss result;
all names end `[Offline CPU]`, isDummy=true, partyType9. No live players or
publisher leaderboard are fabricated. The archive has no recovered dedicated
Abyss dummy-team source. Complete native combat vectors/selection and real
grade-specific matchmaking behavior are unverified.

## Persistence and recovery

`serial_pvp_lobby` retains one indexed current capture per original season:
selected grade, generation, full catalog binding, before/after native rows,
issued time, exact original CPU projection and pending status/usage observations.
`serial_pvp_lobby_request` permanently binds action, actual encrypted-body hash,
request ID/sequence, generation and exact response. A claimed header hash cannot
substitute for the actual bytes. No profile, native signature, stock, resource,
score or reward is precredited. Selection/refresh capture, sequence and reply
commit in the existing outer transaction.

Native `UpdateSerialPvpState` saves observe exact captured effects before
another grade/refresh. Status, usage and the separate run-entry SP effect may
save in either order or together;
observations commit with profiles and reply. The actual native refresh timestamp
is pinned after observation, allowing an explicit offline -5/+120 second skew
around the captured issue time. A later event-clock change does not discard
an already issued save checkpoint. UI booleans may become dirty before asking
for a list; unissued score/count/time/battle/resume/usage changes and deletions
are rejected. A summary may safely read while its existing selection checkpoint
is being saved; it does not replace that generation or clear history.

Pending replacement pulls cancel, including UserInfo. Cached binary pulls are
compared against the current guarded profiles. Exact current-generation retries
remain stable after cache/session/listener restart; obsolete generations, lost
captures, corrupt CPU vectors/catalog/baselines or inconsistent responses cancel
without rematching. No lifetime history scan, event-date ordering, framework or
new dependency is added. Corrupt/interrupted legacy reconciliation remains
unfinished; history is retained.

## Deferred acceptance and remaining work

The follow-up adds `serial_pvp/battle/start` and `serial_pvp/battle/restart` as
**partial, source-only** routes. The other five discovered serial routes remain
unsupported by that slice. The newer player-details implementation below adds
one partial route, leaving four unsupported serial routes. End/results/scoring/used-unit turns are not implemented by this
start/resume slice; it is not a finishable or fully playable Abyss mode yet.

## Player details — source-only, both native consumers

`serial_pvp/player_info/get` now handles exactly `serialPvpId`/`userId` int64
identities for the captured local CPU lobby, and the local player once a fully
saved/acknowledged native first-battle party exists. Both native producers are
covered in the response shape, not proven in MuMu:

- Wrapper23415ac:2341ae0 -> callback2344e04:2345430 merges the
  **serialPvpRecord array** for self; remote records are parsed by27dfde4,
  projected by233796c, and cached under the requested owner.
- Wrapper1bbfce8:1bc0230 -> callback1bc790c:1bc7f9c also calls generic profile
  parser24cd18c, party parser24b2f88 with type9, and substituted-spine23ec300.
  This second path would not be handled by a record-only response.
- Generic profile needs root `playerInfo` and root `familiaName`; party parser
  accepts ordinary `serialPvpParty` and overwrites its partyType with9. This is
  **not** Under's four-field `pvpParty`. Optional `userAdventureLevelInfo` is
  omitted rather than fabricated.

The result includes both shapes: original frozen type9 team, generic player
portrait/profile, root Familia name, empty substitutedSpineIds, and record array.
CPU presentation reuses the existing Under CPU profile helper and original
communication portraits/costumes. Its description explicitly identifies the
local Abyss challenge label and reused authored Under team; an original Bell
portrait fallback is labeled when needed. CPU records are native zero-history
defaults owned by that CPU, not published peer ranks or copied player scores.

Self details use the actual owned saved season record and frozen first-battle
vector, with the shared owned-profile validation. A self view before that
capture, invalid portrait/costume, or a changed selected party cancels3000999;
fresh battle stats are not reconstructed from a stale shared UserPvPParty.
This restriction remains a feature gap, not full details support.

An indexed `serial_pvp_view_request` primary-key receipt binds actual encrypted
bytes, route/season/owner, original catalog, lobby generation and complete exact
response. It commits with the existing sequence/reply transaction. No profile,
SP, record, operation or signature is precredited or acknowledged by a view.
Fresh views regenerate the current projection; an old identity cannot replay
different records, portraits, parties or opponent generations after cache
eviction/restart. Pending selection or partial first-battle saves, missing or
corrupt captures, foreign/non-lobby owners, and expired/ambiguous original
DISPLAY windows cancel while preserving state. Details remain readable during
DISPLAY after MATCHING closes; historical-season detail availability is not
implemented. No lifetime history scan or new dependency was added.

`test_serial_pvp_views.cjs` and the extended first-battle fixture are
**DEFERRED / NOT RUN**. The batch covers all five original grades/current CPU
teams, both response shapes/portraits, owned captured-party views, no native
precredit, actual-wire identities, stale generations/clock, cache eviction and
restart, malformed/corrupt state and capture/reply rollback. Native portrait,
team/stat rendering, record arrays/caches, self/remote producer ordering,
natural entry eligibility, both menus/back/navigation/no-crash/no-ANR, and
shared Under/PvB/Familia profile regressions remain unverified. Actual save,
listener, APK and MuMu are untouched; no workers or GitHub Actions.

## End-operation evidence — not an implemented settlement

Original registry20692ec binds rodata34975e4's **30100** through GOT43284c0
to2108f5c:2109454. This is separate from30200 start. The end handler merges
serialPvpRecord ARRAY, sets int64 selectedGradeId/int32 currentWinCount,
replaces int64 cycleScores ARRAY, sets existResult, parses serialPvpResult
object, emits SerialPvpEndEvent through2109454 and sets processing state0.
It does not itself clear the resume opponent, spend SP, stamp game status or
merge turn usage. Processing2 producers221c684/221d23c are recovery/error
paths, not evidence that every successful battle must first save state2.
The end event reads serialPvpResult.gradeId through an int32 getter, whereas
direct result callback21ff780 reads it as int64. Original grade IDs exceed
int32; the conversion/event consumer must be traced before assuming parity.

The two actual end wrappers2107dfc:2108b20 and21fe9a4:21ff780 send root
serialPvpId/battleId/result. Nested result contains isWin/isRetire/**attack_result**,
not serialPvpScore. Its exact seven keys/getters are:

| Wire key | Getter | Protected score-info member |
| --- | --- | --- |
| battleMainScore | 1f0969c | +60 |
| battleSubScore | 1f096b0 | +88 |
| characterBonus | 1f096c4 | +b0 |
| technicalPlayBonus | 1f096ec | +d8 |
| technicalPartyBonus | 1f09700 | +100 |
| gradeBonusRate | 1f098cc | original grade.slot7 float32 |
| roundScore | 1f09674 | +38 |

This corrects preliminary getter-role assumptions: roundScore is not character
bonus, and the two technical field names must not be swapped. The UI base sum
1f09660 includes members+60/+88/+b0/+d8/+100, excluding+38; it does not establish
final grade multiplication/rounding, loss/retirement settlement or run length.
Getter1f09840 is the context's cycleScores length, not the round score. Result
callback1f0ae20 consumes roundScore ARRAY, currentGradeId, int32 highScorePcId/
winCount/previousRank/currentRank, isHighScore, and aroundRankingData. These
facts have not yet been turned into an end/result handler, usage progression,
run closure or rewards. No guessed rule.slot5/6 round limit or fake successful
settlement was added. Keep the full end/results/rankings/usage/reward work open.

### Native battle contract and30200

Start wrapper193d378:193d908 sends only serialPvpId, opponent userId, ordinary
userParty, and partyIndex. The UI adds1 to its zero-based party selection;
the wire value is positive/one-based. The server does not invent a mapping from
that index to native party IDs330..338. Party type9 and the seven-field ordinary
serialization275104c are validated through the existing competitive-party
validator. Actual saved activeSerialPvpPartyId, six slots/owned active units,
command flows, attack pattern and selected memoria must match. This is not
proof that every supplied calculated stat equals native equipment/board math.

Start callback1952504 reads battleId, serialPvpId, **root preRank**, randomSeed,
serialPvpPlayerInfo, serialPvpParty, substitutedSpineIds, record **ARRAY** and
selectedGradeId. Its constructor is21071e8; GameInstanceType0xe identifies the
combat context, not an operation code. Own party/opponent/seed/grade and the
original selected lobby/run entry are frozen privately. The opponent is still
the explicitly labeled local original-Under CPU policy, not publisher matching.
No second attempt is deducted by start or resume.

Operation registration20692ec:2069c78 binds **30200** to2108b20:2108e68 via
raw GOT432a898 (file offset431a898), not an inferred mode number. It sets native
processingSerialPvpState1 through25f3b3c, resumeRivalUserId through28995ac,
schedules2108e68, and marks the existing season status updateRivalList=true
through28a298c. It does not stamp lastBattleStartAt or spend SP. The later
direct callback1952504 stamps that time and schedules UpdateSerialPvpState.
The returned singular hot operation and plural cold operations contain the
same exact30200 token/signature/parameters. Parameters include the full direct
callback payload because shared hot transport209bd48/209e930 forwards them to
the route callback; there is no circular envelope or invented profile precredit.

Restart wrapper210770c:2107dfc sends **only serialPvpId/userId**. Gate2107040
requires an original active **DISPLAY** season, processing1 and nonzero resume
opponent. Restart callback210a9ac restores the record array, selected grade,
opponent party and the same context with its restart flag. It sets processing1
without consuming another attempt. Matching can be closed while display/resume
remains open. This local handler also requires all four start proofs and the
30200 acknowledgement; it returns the frozen direct fields without issuing a
second30200 or rematching/reseeding.

### Persistent battle/save ordering

Indexed `serial_pvp_battle`, `serial_pvp_active` and permanent actual-wire
`serial_pvp_battle_request` captures commit with the normal operation queue,
transport identity, sequence and reply. They bind original catalog, grade,
lobby/run-entry generations, nullable initial record, native status/usage/info,
owned party, one-based wire index and exact callback/operation. Capture loss,
missing active pointers, corrupt vectors/catalog/queue or uncaptured legacy
30200 cancel3000999 and retain state. No native signature, processing flag,
resume opponent, SP, record or reward is prewritten into player profiles.

Save observations distinguish processing, resume info, update flag and direct
callback timestamp. Split saves in either order or combined saves commit with
native profiles and acknowledgement/reply. ACK30200 requires its three own
effects, **not** the later direct timestamp. An unchanged already-true native
flag need not emit another dirty row once other operation effects are observed.
Resume waits for all four proofs. The actual start time is pinned within the
explicit local -5/+120-second issue window; an exact issued save can arrive
after the event clock changes. Untouched callbacks outside that clock window
cancel rather than return a callback whose stamp would be rejected. Broader
interrupted/cold reconciliation remains unfinished, not a guessed reset.

Any saved start effect prevents hot/cold/cache-evicted start replay. Push replies
suppress already-observed plural/singular30200 deliveries but retain the queue
until real ACK. Pending replacement pulls are blocked; after full start save
and ACK, guarded profiles can be pulled for native resume. Stale binary pulls
are compared to current sensitive tables, including owned party/PC state.
Lobby callbacks are blocked during active combat because summary can clear its
processing state. Refills/new grade/refresh are also serialized behind battle
completion. Unissued processing2/end, score/usage changes, opponent clearing,
party switching or timestamp rewriting cancel; this is not an implemented
result transition. Native finish state2 exists at221c684/221d23c and must be
recovered with end operation/result/achievement order before allowing it.

`tools/test_serial_pvp_battles.cjs` is **DEFERRED / NOT RUN**. Its isolated
source fixtures cover exact envelopes, no profile/SP precredit, captured CPU/
seed, untouched retries/cache eviction/restart, first processing save and
redelivery suppression, status-first/no-op flag, ACK before timestamp, late
clock-changed saves, display-only resume, selected-party pinning, unsupported
end/legacy queues/corruption and queue/capture/pointer/request/profile/
observation/ACK/reply rollback. Synthetic party stats, unlocks and save
signatures do not prove natural eligibility, native vectors, constructors,
actual effect-save-ACK order, communication recovery, no crash/ANR or speed.

`tools/test_serial_pvp_lobby.cjs` and extended master fixtures are **DEFERRED /
NOT RUN**. Written cases cover all grades, original team vectors,50 calendars,
22 disabled matching windows, five-CPU identity, malformed owners/types/IDs,
local/remote summaries, no precredit, pending retry/refresh/pull, split native
saves, timestamp skew, cache eviction/restart, legacy progress/usage/resume
preservation, catalog/CPU corruption and issue/save/profile/reply rollback.
Syntax checks and artifact regeneration are not semantic/native tests.

Next: battle end and complete native score calculation/rounds,
remaining constructor/resume resources and SP ticket producers, used-unit turns,
high-score/result/aggregation/reward flags, result/ranking/player-info/character
ranking, natural entry eligibility, concurrent/native checkpoint ordering and
safe cold recovery. Five other discovered serial routes remain unsupported.
Native grade menu, opponent rendering, save trigger order, navigation/recovery,
performance and no-crash/no-ANR acceptance are still unproved. Empty initial
ranking is not ranked play; CPU lobby support is not playable Abyss combat.
Native interval regeneration/Iris-refill source support has its separate
deferred checklist; no actual resource/UI acceptance is claimed here.

## Identical-second direct start timestamp

The direct start callback invokes the native `lastBattleStartAt` setter after
the separate `30200` operation effects. A later round can begin in the exact
same native second as the retained prior round, so that setter is a no-op and
does not require another dirty `UserSerialPvpGameStatus` row. The earlier
implementation accepted the `30200` ACK without the timestamp—as required by
the original ordering—but then left the battle unable to finish.

An exact `serial_pvp/battle/restart` can now prove the same no-op handoff. Native
gate `2107040` checks the active display season, processing state and nonzero
resume opponent but does not read `lastBattleStartAt`; callback `210a9ac`
rebuilds the frozen battle without another debit or `30200`. An exact valid
`serial_pvp/battle/end` independently proves the direct context ran. Before
either route records the no-op timestamp, the saved start must already have its
real `30200` ACK and every independent processing, resume-opponent, update-flag
and conditional matching-reset proof. The unchanged prior timestamp must be
positive and inside the existing captured `-5/+120` issue window. Current native
state must still match the captured start checkpoint. ACK alone, a view, an
invalid continuation, an old timestamp or a missing proof cannot promote the
capture. The observation and restart receipt or normal `30100` issue share the
route transaction; no profile, clock, score, SP or acknowledgement is prewritten.

The new same-second later-round cases in `tools/test_serial_pvp_completion.cjs`
alternate restart-proven and finish-proven recovery and are **DEFERRED / NOT
RUN**. Native callback timing, save omission, result UI, back navigation,
performance and crash/freeze acceptance remain pending until the consolidated
MuMu pass.
