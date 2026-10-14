# War Game friend-ranking contract

## Friend-list cache integrity — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-14)

`friend/following/list`, `friend/follower/list` and `friend/support/list` now
share their request/status validation and response builder between fresh and
exact cached delivery. The complete cached JSON is rebuilt against the current
single-account `UserFriendStatus`, not only the follower timestamp field. A new
`followerListLastViewedAt` invalidates the follower page that exposes it, while
following/support remain byte-identical if the rest of the validated status is
unchanged. Foreign, nonempty or malformed social state is retained behind
recovery instead of being replaced by empty lists.

Fresh receipts and cache lookup bind actual received-wire MD5. A matching
caller-supplied hash therefore cannot turn the native empty support request into
JSON or redirect a page request. Deferred cases cover all three stable replays,
viewed-at drift, unrelated-view stability, spoofed support body and restart.
WRITTEN ONLY / NONE RUN. Real supporters, peers and borrowed units remain
co-op-last. Native list UI, navigation, performance and no crash/freeze/ANR
remain unverified. No checks, builds, listener, APK, ADB, emulator, workers or
Actions ran; 176 partial / 0 unsupported / 0 verified complete.

## Direct friend-packet cache integrity — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-14)

`friend/get`, `friend/follow` and `friend/unfollow` now use one request validator
and response builder for fresh and exact cached packets. A self `friend/get`
rebuilds the public profile from the current saved owner/status/leader data, so
an old cached name, description, rank, login time or leader cannot survive a
newer native save. Unknown IDs continue to return the original user-not-found
business result10000003; no remote user, relationship or mutation is fabricated.

Fresh reply receipts and replay checks now bind these routes to the MD5 of the
actual received wire bytes rather than a caller-supplied hash label. Thus even
two follow requests that would both return user-not-found cannot redirect the
same cache identity to a different target. Stale or conflicting replay retains
the current profile and reply evidence.

Deferred friend cases cover stable exact replay for all three routes, local
profile drift, fresh projection and a spoofed-hash follow target. WRITTEN ONLY /
NONE RUN. Positive peer import/follow persistence remains co-op-last. Native
profile/search/follow UI, back navigation, performance and no crash/freeze/ANR
remain unverified. No checks, builds, listener, APK, ADB, emulator, workers or
Actions ran; 176 partial / 0 unsupported / 0 verified complete.

Implemented source-only on 2026-10-06. No functional tests, native builds,
installs or MuMu acceptance were performed in this turn. The actual player
save and listener were not touched. Co-op remains last; no workers or Actions.

## Original client evidence

Original 15.1.0 ARM64 SHA-256:
`E49A8CC7991F8946365A28AEBAD605CE566B034826DD4B34A982AB18B38303B3`.
Addresses below are raw ELF addresses. Ghidra's displayed addresses add
`0x100000`. Each final artifact uses original unwind bounds; read-only jobs
completed with exit0. Intermediate incorrect ranges were replaced before
being used as evidence.

- `259e144:259e758` sends `pvpId` and, for ordinary pages, int32 `page` to
  `pvp/friend/ranking/get`. The relocated sentinel at `4326ae8 -> 3557390`
  is -99. That request **omits** page; it does not serialize page=-99.
- Callback vtable `42c2e68` points at `25a05f8:25a0d38`. It reads root
  `friendRanking`, then each entry's long `userId`, string `name`, int32
  `pcId`, long `gradeId`, int32 `rank` and int32 `score`. It consumes boolean
  `hasNextPage` to insert/remove the next cached page. PvB's differently named
  root array was not reused.
- `2783df4:2784324` serializes UserPvPRecord's fourteen fields:
  userId/pvpId/gradeId/rank/score/winCount/loseCount/consecutiveWinCount/
  consecutiveLoseCount/lastAdversaryIds/lastBattleId/isReceiveReward/
  isAggregate/highestGradeId. The long season is distinct from long grade.
- `235ae6c:235b140` resolves the selected original information's long slot0
  and calls `26a7044:26a70cc` with that identity. The latter looks up the
  native record map at UserDataFBS+ee0. SQLite now explicitly keys this table
  by pvpId and rejects duplicate season identities; grade fallback cannot
  merge two same-season rows with different grades.
- `29ada78:29adb6c` loads pvpInformation; `29ba8a8:29ba8ec` obtains its row
  vector. `1713f94:1713fbc` and `1713fbc:1714010` compare long slot0.
- `29acf08:29acffc` loads pvpGrade; `29ba578:29ba5bc`,
  `1c4529c:1c45310`, `1735930:1735958` and `1735958:17359ac` resolve and
  compare its long slot0. Only proven original identities are exported;
  unknown columns are not assigned guessed scoring/reward/season semantics.

Final read-only artifacts in `.work/`:
`pvp-friend-ranking-wrapper-exact-20261006.txt`,
`pvp-friend-ranking-callback-exact-20261006.txt`,
`pvp-information-loader-exact-20261006.txt`,
`pvp-information-vector-exact-20261006.txt`,
`pvp-information-identity-exact-20261006.txt`,
`pvp-grade-identity-exact-20261006.txt`,
`pvp-grade-long-key-exact-20261006.txt`,
`pvp-grade-season-join-exact-20261006.txt` and
`pvp-record-season-key-exact-20261006.txt`. The latter grade artifacts show
slot1 selectors but do **not** establish a grade-to-request-season join.

## Archive and offline behavior

The existing decoder exports `pvpInformationIds` (176) and `pvpGradeIds`
(3420), with provenance for these two original files:

- `1/master/divide_enc/pvpInformation.enc`:
  `6858af02c06d0c392989d202300fe50757acb73fbc831a87e4d2177ac038d9a9`.
- `1/master/divide_enc/pvpGrade.enc`:
  `1ef1ebfeab12a2ba7a0a1cebbcbbc4f351ff7b90e6dca96f171c010ea3ad57e7`.

There are now 151 hashed master sources. Static comparisons found no changes
to any prior 149 source or 108 export. No content archive is added to Git.

The read-only packet accepts an original season and omitted page or explicit
nonnegative int32 page. Without a saved record/positive original grade it
returns a genuine empty board. Otherwise page0 contains the actual local
profile's public leader, saved grade and saved score. **Rank1 is explicitly
the one-profile offline comparison**, not a restored publisher/global rank.
The saved native rank is not changed. Later pages return an empty array and
hasNextPage=false. No native row, score, reward, currency, friend, flag,
signature, operation or earned-history receipt is created by viewing.

The request chooses its explicit archived season. A clock change does not
substitute another season, reset a record or remint rewards. Active War Game
selection/windows and historical grade-selector joins remain unrecovered;
this read projection does not claim that all seasons are currently playable.

Malformed/foreign/duplicate/unknown native records, unavailable original
catalogs or public leaders, and nonempty/invalid remote social state cancel
through the existing3000999 recovery response with the save retained. The
same typed single-profile friend guard is shared by friend/support/follower/
following lists and PvB's friend board, including their cached callbacks.
UserFriendStatus's self-key is not treated as a remote followed user.

Fresh view sequence and cache commit in the existing transaction. War Game
cache identity binds actual received wire bytes, not a caller's body-hash
label. Exact retries survive a restart; a changed result/profile or invalid
social state cancels an old cached view rather than replaying stale data.
No permanent per-view table, lifetime scan or new dependency was added.

## Deferred acceptance and remaining gaps

`node tools/test_pvp_friend_ranking.cjs` is written but **NOT RUN**. It queues
all176 empty-season projections, six exact row fields, omitted/explicit page
rules, typed/malformed/legacy state, original identity bounds, multi-season
native pushes/duplicate rejection, no view precredit, raw-wire conflicts,
restart/cache/stale/clock handling, shared friend/PvB guards and rollback.
Its manually supplied scores/grades are synthetic fixtures, not native
combat or natural earning proof. Updated `test_friends.cjs` and
`test_master_data.cjs` plus general save/PvB/Serial eligibility/recovery/
Android/launcher regressions are also deferred.

Native initialization (including any observed local-zero owners), battle
score/grade/highest-grade producers, authentic grade/season selector joins,
matching periods/clock transitions, score loss and settlement/rewards,
natural eligibility, signatures, UI portrait/grade labels, hot/cold native
callback/cache/save ordering, return/back recovery and no-crash/ANR/performance
are not established. Real peers/co-op remain unimplemented. This route is
**partial**, not feature-complete;169 discovered routes still await final
native acceptance.

## Inventory correction and additional views (2026-10-06)

The earlier169-route total was an undercount, not an exhaustive inventory.
Original string pooling is byte-level: `pvp/player_info/get` is an actually
referenced suffix inside `under_pvp/player_info/get`, not a separate string
or a slash-component suffix. The discovery tool now keeps all path-shaped
byte suffixes and still requires an actual reference from a network wrapper.
It recovered these six genuine original routes without removing any of the
previous165 native contracts:

| Route | Exact raw wrapper |
| --- | --- |
| `pvp/battle/start` | `19342cc:193451c` |
| `pvp/battle/restart` | `2140d68:2141210` |
| `pvp/battle/end` | `2214df4:22156b4` |
| `pvp/summary/get` | `259dc04:259df90` |
| `pvp/player_info/get` | `1c5ce14:1c5d354`, `25657f4:2565e24` |
| `pvp/character/ranking/get` | `1c5e498:1c5e7f4` |

The merged inventory is now171 native contracts plus four local-only routes:
**175 audited routes,100 partial,75 unsupported, zero feature-complete**.
This supersedes previous169-route totals; other indirect routes may still be
undiscovered. The original ARM64 SHA above is unchanged.

Three additional source-only view handlers reuse the existing save and reply
transaction. No native build, functional probe or MuMu test was run. The actual
player save, listener and APK are untouched; no workers or GitHub Actions.

- Summary sends only pvpId. Callback `259f950:25a0094` reads `pvpRanking`
  with the same six-field entry shape as the friend board, then invokes
  `213f9b4:213fe18` on root `pvpRecord` **array** entries. It also invokes
  `25f1ee0:25f1fc0` with zero: the native setter changes encrypted int state
  at UserInfo+3f0 and marks the data dirty. The handler therefore refuses
  saved non-idle processingPvP/processingPvPState rather than silently
  abandoning an unfinished match. A valid actual initialized record is
  returned unchanged, alongside the explicit one-profile offline board.
  Missing/zero-grade initialization cancels; no initial grade or score is
  guessed, and no native row/reward is precredited.
- Player information accepts pvpId/targetUserId, or targetUserId alone when
  `25657f4` receives no information object. Callback `1c607b0:1c60d44`
  invokes public profile `24cd18c:24cd650`, party `256111c:2561314`, spine
  substitution `23ec300:23ec520` and record `2564f50:25653e0` repositories.
  Their roots are `playerInfo`, `pvpParty`, `substitutedSpineIds` and
  `pvpRecord`; party reader `2771584:2771de4` reads userId/slots/attackPattern/
  memoriaSlots. Optional `userAdventureLevelInfo` is parsed by
  `2776f54:2777634` only when present; it is omitted rather than fabricated.
  Only the actual local account is available. Scoped reads return that saved
  season; unscoped reads retain all saved seasons. Scoped reads require actual
  initialization, not a fabricated zero-grade record.
- Character-ranking wrapper sends pvpId; the network callback schedules
  `1c62128:1c62234`, which invokes `1c5fb5c:1c5fe50`. That callback calls
  shared `2141c44` to read `normal`/`assist` rank+pcId arrays. Untouched selected
  seasons return genuinely empty arrays. Any played/positive-score/history
  state without settled usage captures cancels with the save retained. The
  current party is not passed off as historic usage or publisher popularity.

Public details reuse the existing owned profile projection and the existing
Under Telskyura selected-party checks, now shared as `localPvpParty`. A real
six-slot native snapshot must match activePvPPartyId (or activeUnderPvpPartyId
for Under), owned joined PCs, selected attack pattern and memoria IDs. Actual
stats are retained, not reconstructed from hypothetical gear/board bonuses.
Shared fourteen-field record checks preserve malformed/foreign/duplicate/
unknown-season state through the existing3000999 cancellation. This is source
recovery behavior, not proof that native return/back navigation works.

All four War Game views bind cached replies to the **actual received wire**,
not a caller-supplied hash label. Retry compares the current response bytes;
changed profile, selected party, native record or summary processing cancels
stale cached data. The existing SQLite transaction commits sequence/reply
atomically. No per-view table, new dependency, profile rewrite or lifetime
history scan was added. Read requests retain their explicit archived season
through clock changes; active matching/window policy is still unrecovered.

Final read-only artifacts, completed with terminal exit0, are
`pvp-missing-api-wrappers-exact-20261006.txt`,
`pvp-missing-api-callbacks-exact-20261006.txt`,
`pvp-response-consumers-exact-20261006.txt`,
`pvp-party-ranking-entry-exact-20261006.txt`,
`pvp-character-ranking-callback-exact-20261006.txt` and
`pvp-processing-setter-exact-20261006.txt`. The prior record-default artifact
traces `21439b4` to `282e5c4:282e910`, but zero-valued native storage is not
evidence for a publisher initial score/grade assignment.

### Deferred checks and next gameplay work

Updated `python -B tools/test_client_routes.py` queues pooled-token regression
and all six native wrapper identities. Extended
`node tools/test_pvp_friend_ranking.cjs` queues all176 empty usage/friend views,
initialized summary, exact scoped/unscoped player roots, selected-party/vector/
ownership checks, no precredit, unavailable initialization/remote/played
history, malformed inputs, unfinished processing, raw-wire conflicts, stale
profiles, hot/cold replay and reply-transaction rollback across all four views.
These are synthetic fixtures, not native earning or natural eligibility proof.
They are **NOT RUN**. Shared Under/PvB/Serial, save/recovery, Android and launcher
regressions and full native navigation/performance acceptance remain deferred.

Battle start/restart/end remain unsupported. The recovered start sends pvpId
only; restart also sends pvpId only and consumes result/battleId/randomSeed/
pvpPlayerInfo/pvpParty/pvpRecord. End sends pvpId/battleId/result containing
isWin/isRetire/spendTurns/maxDamage/survivedPCs. Their original matching,
cost/resume/battle/save/reward order still requires recovery; an HTTP handler
count cannot substitute for those effects. Initial grade/score, grade-season
selector joins, active windows, attempts/tickets, native combat and settlement,
prizes, positive character usage, signatures, portraits/labels, save/event
ordering, usable cold/back recovery and no-crash/ANR/performance remain gaps.
Co-op remains last.

## Absent-season lobby and original grade selector (2026-10-06)

This source correction supersedes the initialized-record-only summary and
scoped-details restriction above. Original `1c510dc:1c51cc4` looks up the
season's actual UserPvPRecord and explicitly handles **no record**. It uses
`home_arena_pvp_grade_default`, `home_arena_pvp_rank_default`,
`home_arena_pvp_rate_default` and a **UI-only score1000** in that branch.
An empty season therefore must not be forced into a server-created grade or
earned score merely to show the lobby.

`pvp/summary/get` now returns empty `pvpRanking`/`pvpRecord` arrays when no
actual season record exists. An existing zero-grade row is returned unchanged.
No profile, owner, rank, score, flag, reward or signature is prewritten. Scoped
local player details can likewise return an empty season record array; the
actual configured six-slot native competitive-party requirement is unchanged.
The summary's idle processing guard still applies to empty seasons: its
callback may clear processing, so absence cannot abandon an unfinished match.
Cached empty summaries are revalidated against current records and processing;
later initialization cancels stale absence instead of erasing progress.

The existing decoder now exports `master.pvp` with176 information rows and
3420 grades. It reuses the same151 original hashed tables; all110 previous
exports and source identities remain unchanged. Recovered fields are:

| Table | Original slots retained |
| --- | --- |
| pvpInformation | long0 id, long1 slot1, long3 startAt, long4 endAt |
| pvpGrade | long0 id, long1 groupId, string2 key, string3 name, string8 art, int32 9 order |

`1c5c740:1c5ca10` reads information.slot0 and passes that long through
`1c5ca10:1c5cb30` to `1c41a2c:1c41fc8`, which stores it as the grade-modal
selector. `1c42960` passes that selector to `1c42e20:1c42f18`, which compares
grade.slot1. This proves the grade group is the **actual season ID**; no
arithmetic on IDs is used. All176 original groups join their corresponding
information rows. Shared War Game view validation now cancels a grade from
the wrong season with the save retained. Highest-grade field identity remains
checked against original grade IDs, but its cross-season earning/rollover
producer has not been established and is not rewritten.

`13bcf2c:13bd0bc` selects the first original information row using time slots3/4
and `2a3a5dc:2a3a61c`, which has an inclusive start and **exclusive end** (zero
bounds are open). It additionally compares nonzero slot1 against the original
build constant returned by `1df15f0:1df15fc` (`0x5db13de0`). Slot1 is kept under
its untranslated name; it is not declared a publisher version or matchmaking
rule. Four authored zero-length windows are preserved, not extended or
silently fixed. This exports calendar evidence; active battle matching and
patched-client clock behavior are still unimplemented/unverified.

The serial read-only native jobs all reached terminal exit0 before their
artifacts were read:

- `pvp-current-season-battle-context-exact-20261006.txt`
- `pvp-resource-grade-context-next-exact-20261006.txt`
- `pvp-grade-selector-resource-context-exact-20261006.txt`
- `pvp-native-empty-record-battle-init-exact-20261006.txt`
- `pvp-native-season-group-lobby-exact-20261006.txt`
- `pvp-grade-group-entry-restart-access-exact-20261006.txt`
- `pvp-calendar-selector-getters-exact-20261006.txt`

Additional battle evidence: start `2140434:21407a8` builds the context through
`21425e0`/`2142640`/`2142700`, installs it in the battle manager and root-saves
`UpdatePvpState`. `2140c90:2140d68` requires a current original season and
UserInfo's int processing state1 to allow restart. The original resource
helpers were traced but their full SP mutation/refresh/order semantics are
not yet established; no server debit or fake restart result was added.

Extended deferred checks cover all176 absent summaries with no profile
mutation, actual zero-grade row preservation, scoped empty details, native
season-grade joins, zero-length calendar preservation, wrong-season grade
rejection across all four views, cold empty-summary replay and later saved
initialization/stale-cache retention. `test_master_data.cjs` and
`test_pvp_friend_ranking.cjs` were syntax-checked, **not functionally run**.
The original metadata decoder and audit/checklist generators ran; no native
build/install, emulator test, listener launch or actual player-save mutation.

Progress remains **175 audited routes:100 partial,75 unsupported, zero
feature-complete**. Native absence rendering/back navigation is not visually
accepted. Battle start/restart/end, SP costs, true bootstrap/zero-owner saves,
CPU matching, score/grade/highest-grade producers, settlement/prizes/positive
usage, signatures, client callback/save order, hot/cold recovery and
no-crash/ANR/performance remain gaps. Co-op remains last; no workers or Actions.

## Shared native record persistence and battle follow-up (2026-10-06)

Status remains **source-only; functional/native tests NOT RUN**. The existing
fourteen-field record validator is now in the store rather than duplicated
inside the view handlers. Every read of UserPvPRecord, including fresh binary
pulls and competitive prerequisite readers, uses its original season/grade,
ownership, exact fields, types and duplicate checks. The final merged native
save delta is checked before save plans or profile/token/checksum/operation/
sequence/reply commits. Invalid proposed rows return400. Invalid retained
baselines cancel503/3000999 without silently repairing them or replacing them
with a new record. Valid multiple seasons still merge by pvpId.

Cached native pulls containing UserPvPRecord now compare the full current
MessagePack response. Unchanged hot/cold retries can retain their bytes;
changed or malformed current data cancels instead of restoring an old native
snapshot. Empty generic profiles do not require unrelated War Game catalog
data, but actual War Game requests and nonempty records still require original
identities. Catalog sets are built once; this reuses the existing SQLite
transaction and adds no table, dependency or lifetime history scan.

This is **structural save safety**, not publisher score/grade earning proof,
an anti-rewind settlement receipt, seasonal cleanup, highest-grade rollover
or proof of actual native callback/save interleavings. Existing cross-season
highest-grade telemetry is retained; its original ID is checked without
guessing its producer. No grade, score, resource, signature or processing flag
is prewritten by these changes.

Read-only original battle tracing established two important boundaries:

- World PvP `2213a84:2214154` looks up the season record with `26a7044` and
  dereferences its grade before calling battle/end. An empty-record lobby
  response does **not** supply battle initialization. A correct start must
  establish that actual record before combat reaches this path.
- World end callback `2215f4c:2216170` invokes `UpdatePvpState`, then reads root
  pvpResult with isWin:boolean, score:int32, scoreDifference:int32 and
  gradeId:long. `22156b4:22157f0` passes these values to the result UI. Earlier
  start/restart calls `1f14998`/`1f14fc4` reach `25e805c`, whose original
  setter is **UserAnotherForce::setGauge**. This is not SP consumption proof.
  The additional protected long reset remains unnamed until its accessor is
  recovered; no Under SP/medal costs or guessed timestamp field were copied.

The original CPU/matching/score loaders, table/vector getters and FlatBuffer
verifier chains have been recovered for dummyPvpPartySlot,
dummyPvpUserProfile, dummyPvpPc, pvpTutorialDummyPartyGroup, dummyPvpParty,
pvpMatchingCondition and pvpScoreCondition. Their vector/index getters had no
direct BL callers in the original text scan. `2a1ed0c:2a20ef0` instead reaches
the table verifier chain. Scalar field widths alone do not identify field
meanings or distinguish int32 from float32; they are not a recovered CPU
stat mapping or server score algorithm. No heuristic key/config inspection,
guessed typed export or transplanted Under matching policy was performed.

Completed read-only artifacts include
`pvp-end-effect-sp-factory-cpu-vector-exact-20261006.txt`,
`pvp-sp-singleton-entry-exact-20261006.txt` and the
`pvp-cpu-score-{flatbuffer,row-vector,field-width}-verifiers-exact-20261006.txt`
chain. The first mixed result/resource artifact used two non-exact resource
bounds; those two functions were discarded and replaced by the exact
singleton-entry artifact. Their exploratory "sp" filenames are not evidence
of SP semantics. All jobs finished and discarded read-only project changes.

Extended `test_pvp_friend_ranking.cjs` queues invalid mixed-profile saves,
shared malformed reads/fresh and cached record pulls, valid multi-season
updates, unchanged cold and stale binary retries, and pull/save reply rollback.
The Abyss eligibility fixture now uses actual original season/grade joins,
not season1 with a positive score and grade0. These remain **synthetic checks,
DEFERRED / NOT RUN**, not native earned score/bootstrap/signature proof.
Audit and consolidated checklist retain **175 routes:100 partial,75
unsupported, zero feature-complete**. War Game start/restart/end remain
unsupported. Actual save, listener, APK and MuMu are untouched; no workers or
GitHub Actions, co-op last.

Five changed CJS files passed syntax-only checks; audit/checklist generators
ran and static inventory/checklist agreement remained175. Whitespace checks
passed and the original ARM64 SHA above remained unchanged. No functional
fixture, native build/install, listener or emulator run was performed.

## Ordinary War Game stamina follow-up (2026-10-06)

Operation10400 now has a captured stock/timer refill save proof, replacing
its earlier minimum-only observation. Original fixed1800-second recovery,
below10-only native getter refresh, whole-interval timestamps and native5/
cap15 constants were recovered; the generic consume recovery1 is not5.
The native getter's decompiler PIC rewrite hid the refresh branch, so its
exact original assembly was checked. Existing purchase/save/ACK transactions
retain nullable issue-time/baseline evidence, reject wrong higher totals or
timestamps and suppress an already observed additive callback while keeping
the pending queue. Fresh pending/stale cached UserInfo pulls cannot replace
those resources. See [the exact refill contract](stamina-consume-contract.md).

The formerly suspected battle-manager initializer22bbda4 is a branch to
22bbfdc:22bc088, a shared-context deque pushback, not World initialization
or SP spending. Native resource consume2544958 requires a positive supplied
quantity and resets the timer when starting at stock>=10; the actual War Game
battle cost/caller is still unrecovered. This is not evidence to transplant
Under SP/medal costs, matching or scoring. War Game start/restart/end remain
unsupported. Extended stamina fixtures are DEFERRED / NOT RUN; original ELF
analysis and syntax checks are not native playability/recovery acceptance.
Actual save/listener/APK/MuMu untouched; no workers or GitHub Actions.

## War Game start/resume implementation (2026-10-06)

Start and resume now have source-only handlers, superseding their prior
unsupported status above. [The battle contract](war-game-battle-contract.md)
documents original one-SP/processing/event flow, exact response roots,
explicit labelled mirror CPU and offline starting1000/original order0 grade
policy, shared existing native party validator and durable split-save receipts.
This is not recovered publisher matching/bootstrap or native acceptance.
No native resource/record/flag/signature precredit or invented operation/ACK.
End/score/grade/history/usage/prize/closure implementation remains missing;
the whole War Game loop is not yet playable. New tests are DEFERRED / NOT RUN.
Audit now175 routes:102 partial,73 unsupported, zero complete. Actual save,
listener, APK and MuMu untouched; no workers or GitHub Actions, co-op last.

## War Game14000 settlement follow-up (2026-10-06)

The [battle contract](war-game-battle-contract.md) now documents source-only
end/save/ACK closure, persistent local score/win/loss/streak receipts, and
earned local normal/assist usage views. These supersede missing-end/closure/
usage statements above. All seven War Game routes are partial;175 routes now
103 partial,72 unsupported, zero complete. Original14000 callback semantics
are recovered; +/-16 mirror-score earning and usage are explicitly offline
policies. Original grade progression/prizes/aggregation/native acceptance
remain unfinished. Extended checks remain DEFERRED / NOT RUN. Actual save,
listener, APK and MuMu untouched; no workers or GitHub Actions, co-op last.

## Ordinary-grade progression follow-up (2026-10-06)

The battle contract now documents original score-border and ranking-bound
fields, score-only promotion/demotion, retained highest grade and unchanged
v1 capture policy. This supersedes the missing-all-grade-progression statement.
Hero II/I ranking, prizes/aggregation and native acceptance remain pending.
All176 seasons/3420 original grades use the same151 source hashes; unknown
slot4 remains absent. Extended checks remain DEFERRED / NOT RUN. Coverage is
unchanged:175 routes,103 partial,72 unsupported, zero feature-complete.
Actual save/listener/APK/MuMu untouched; no workers or Actions, co-op last.

## Original grade-mission rewards follow-up (2026-10-06)

The battle contract now documents condition903's original highest-grade
group/order eligibility,1733 authored non-resetting grade missions, and reuse
of6000 reward/save/ACK delivery. This supersedes missing-all-grade-prize/
mission-eligibility statements, not ranked-tier/season-prize/native gaps.
Pending promotion/imported flags cannot mint a reward; acknowledged highest
grade still qualifies after demotion. The shared receipt guard covers fresh,
cached and save/ACK paths; the existing indexed claim ID blocks changed-date
reawards. No native flag/grade/signature precredit or historic backfill.
All151 source hashes and other master exports remain unchanged. Extended
checks are DEFERRED / NOT RUN;175 routes,103 partial,72 unsupported, zero
feature-complete. Actual save/listener/APK/MuMu untouched; no workers or
Actions, co-op last. Natural observers/first-reach timestamps/native ordering,
ranked tiers/season prizes/aggregation/no-crash acceptance remain pending.

## Ordinary-season Presents follow-up (2026-10-06)

The [battle contract](war-game-battle-contract.md) now records3420 original
`pvpRankingGradeReward` rows, exact item-ID/count pairs and original flag
loaders. The separate reward map adds one hashed source (152 total); prior151
source hashes and other exports remain unchanged. Source-only offline policy
awards the final CURRENT ordinary grade after the original season end and
acknowledged local participation, not the highest mission grade or fake rank1.
Existing Presents/2000 delivery handles claiming, indexed permanent captures
prevent double production, and full profile tokens publish only aggregation/
reward flags. Rewinds, stale pulls/confirmation tokens and missing/corrupt
captures cannot replace earned state. No wallet/inventory/native signature
precredit. This supersedes missing-all-season-prize statements, not publisher
ranking/timing/premium-bonus or native-acceptance gaps. Extended checks are
DEFERRED / NOT RUN. Coverage remains175 routes,103 partial,72 unsupported,
zero complete; actual save/listener/APK/MuMu untouched, no workers/Actions.
