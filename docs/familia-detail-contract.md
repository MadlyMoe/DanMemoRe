# Solo Familia public details and search

Source implementation only. Functional checks, APK deployment and MuMu acceptance are deferred, not passed. The actual player save and listener are unchanged.

## First-reward request durability — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-14)

`familia/first_reward/receive` now has a permanent request ledger separate from
the player-wide once-only reward receipt. Each accepted identity records the
actual received-body hash, current acknowledged Familia creation operation,
the one lifetime operation 22300, request time, whether that operation was
pending, and the exact raw response plus integrity hash. New issue, receipt,
request, sequence and generic reply still commit in one outer transaction.

The early replay path revalidates the original four-star-ticket terms,
canonical operation envelope, pending/done exclusivity and saved cumulative
acquisition floor. An untouched pending retry receives the same immutable
operation. If native inventory is saved first, the receipt atomically records
the exact cumulative target, operation signature, observation time and an
integrity hash. Hot retry and cold confirmation then keep the real operation
identity but project an empty `gainedItems` remainder, preventing another
ticket application while still requiring the actual ACK. Once acknowledged,
both that old key and a new eligibility check receive the existing empty
settled response. Generic cache bytes are no longer accepted as a substitute
for the permanent request record.
An older pending receipt is upgraded only when its saved ticket is exactly the
captured cumulative target and still carries the queued operation signature;
ambiguous legacy state remains pending and unavailable rather than inferred.

Every request is also bound to the Familia generation that existed when it was
accepted. If that group was later disbanded, replay requires the intact hashed
dissolution archive and original disband request. Recreating local Familia ID 1
therefore cannot make an old reward request belong to the replacement group or
change its state. Deferred `test_familia_first_reward.cjs` and
`test_familia_break.cjs` cases cover rollback, cache/session loss, restart,
pending and settled replay, corrupted response proof, legacy cache refusal,
observation rollback/corruption/signature mismatch, cold remaining-effect
confirmation, clock movement and disband/recreation. They are **WRITTEN ONLY /
NONE RUN**. Original quantity provenance, natural eligibility, native
effect/save/ACK ordering, UI/performance and crash/freeze/ANR acceptance remain
unfinished or unverified.

## Dissolution request durability — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-14)

`familia/break` still accepts only the original decoded null contract and still
requires the current master, settled creation charge and an empty operation
queue for a fresh dismissal. Its archive now carries an MD5 commitment over
the exact serialized generation snapshot. A separate indexed request ledger
records the actual encrypted body hash, dissolved creation operation, request
time and canonical `{code:0,result:0}` response/hash for every accepted
transport identity.

The original dismissal and later empty/null idempotent aliases therefore replay
from permanent receipts before generic reply-cache and stale-sequence handling.
They validate the immutable archive, original settled creation and response,
but deliberately do not inspect or mutate a later active Familia. Replaying an
old key after cache eviction, restart or recreation cannot dismiss the new
generation. A no-membership alias is attached only to the latest archive that
still has its original durable request proof; legacy archives are retained but
cannot be upgraded from an untrusted client-supplied cache hash.

The fresh transaction continues to archive the local row, name history,
skills, shop ownership/selections, board posts and generation-scoped GvG
settings before clearing only active group state and the saved profile label.
Player-wide first-reward, donation, item, currency, creation-cost and operation
history remain untouched. Archive, request, active-state deletion, profile
update, sequence and reply still share the outer transaction.

Deferred `test_familia_break.cjs` cases cover archive/request/reply rollback,
null versus empty actual-body identities, cache deletion and restart, exact
original/alias replay after recreation, forged bodies, damaged request response
and archive hashes, legacy cache-only refusal, and unchanged lifetime/player
ledgers. They are **WRITTEN ONLY / NONE RUN**. The 24-hour rejoin rule,
non-master leave, remote membership and native UI/performance/stability remain
unfinished or unverified.

## Message-board request and feed durability — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-14)

`familia/msg_board/send` now stores the current Familia creation operation, the
actual received-body hash and the canonical `{code:0,result:0}` response/hash
with every immutable board post. A retained request is validated before generic
reply-cache and sequence handling, then matched back to its exact post type and
canonical saved payload. Cache eviction, login/session reset and restart can
therefore return the original bytes without inserting a second post; a changed
body, generation, row, response or forged header cannot inherit that identity.
Existing rows are migrated only to the still-retained local Familia generation;
orphaned or inconsistent history remains unavailable rather than being erased.

Both feed routes now use one projection for fresh delivery and cached replay.
It validates each row's request identity, local author PC, generation, original
post type and payload, membership-relative timestamp, permanent expiry policy
and send-response proof. Nondefault stamp posts additionally require the exact
retained original shop product to have been purchased no later than the post.
The initial newest-50 page and all four existing pagination comparisons remain
unchanged, but cached bytes are accepted only while rebuilding the same request
against current SQLite history produces the same response. New posts therefore
force a fresh initial or boundary page instead of being hidden by an older
cached response.

Deferred `test_familia_board.cjs` cases cover exact cache-loss/restart replay,
forged request bytes, response damage, legacy cache-only success, initial-feed
and pagination-boundary invalidation, atomic post/reply rollback and unchanged
player/currency/operation state. They are **WRITTEN ONLY / NONE RUN**. Remote
history, moderation/reporting, publisher expiry, natural unlocks, native
presentation, performance and no-crash/freeze/ANR acceptance remain open.

## GVE stage counters or complete clear saved before its remaining result — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-12)

Operation `23100` calls the common stage-clear routine at `0x246fc74` and
returns at `0x246fc78`; its parameters wrapper remains at caller `SP+0x48`.
Cold recovery now accepts an exact observed cumulative-only prefix, both
counters before the completion date, LAST-before-FIRST, or the complete
state/counter/date clear.
A nonqualifying result may retain one of those prefixes with its record at the
issuance baseline or exact target. A qualifying/tied result requires either
its exact captured high-score party or the still-selected issued party plus
the exact absent-or-acknowledged prior best snapshot. The signed operation remains unchanged;
recovery derives counter control `2` for cumulative-only, counter control `1`
after both counters, and `offlineStageLastDateApplied:1` only for a saved date.

Three source-only 128-byte ARM64 adapters at `0x1623030`, `0x16230b0`, and
`0x1623130` admit only saved return `0x246fc78`. The count/date adapters load
the wrapper at `SP+0x1f8`; the cumulative setter adapter uses `SP+0x278` and
skips only that setter for exact control `2`. Other callers tail-call the
original counter helper, cumulative setter, or LAST-date setter without reading
JSON. Record import, party copy, later stage effects, save/signature, queue and
ACK stay original. Deferred
`test_gve_completion.cjs` and `test_client_native_patch.py` cases cover the
clear-first envelope, immutable source queue, forged controls, later record and
full ACK, exact caller/stack/branches, zero-cave spans and corruption guards.
WRITTEN ONLY / NONE RUN. Daily-without-cumulative or LAST-before-both-counters,
changed/unowned pending selections, ambiguous prior history, other ABIs and
native/UI acceptance remain open.

## Qualifying GVE record saved before party or stage clear — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-12)

Original operation `23100` imports the absolute `UserGvERecord` before it
computes and performs the qualifying high-score party copy. Re-importing the
exact target row is therefore idempotent, but the original copy remains safe
only while the issued `activeGvEPartyId`, six PC/assist identities and three
Memoria identities are still selected and owned.

`stageColdRecovery` now admits that record-only prefix after durable `record`
observation and exact target-row proof. It additionally requires the untouched
root clear, the exact captured selected-party identities, and either no prior
best party for a zero baseline or the exact previously acknowledged full party
and `gve_party_floor`. Changed selection, missing ownership, ambiguous prior
history, party/clear prefixes and unrelated effects still retain the result.
The unchanged signed operation performs the original party copy and clear; no
wire control, record/party/clear/reward prewrite or early ACK is introduced.

Deferred `test_gve_completion.cjs` cases cover a higher qualifying record
saved over an acknowledged prior best, current-selection rejection, immutable
source queue, hot retry, pull, confirm, restart/login, original party/clear
save and full ACK. WRITTEN ONLY / NONE RUN; native import/copy/save ordering,
UI, crash and performance remain unverified.

## Qualifying GVE clear saved before party or record — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-12)

Although operation `23100` mutates record, party and stage in that order, the
native table uploads may persist separately. A cold save can therefore contain
a supported complete or incremental clear prefix while the qualifying party
copy is still absent. The existing caller-scoped counter/date controls already
skip only the saved clear work on replay.

`stageColdRecovery` now admits that state when the record is still at its exact
issuance baseline or target, every clear observation is one of the supported
cumulative/count/date/state checkpoints, and the issued current party remains
selected and owned. As with record-first recovery, a zero prior best requires
no historical party row/floor while an earned prior best requires its exact
acknowledged capture, floor and current full row. The unchanged operation then
imports the record if needed, performs the original party copy, and uses the
existing clear controls; no party, record, clear, reward or ACK is prewritten.

Deferred `test_gve_completion.cjs` cases cover a higher qualifying complete
clear over an acknowledged prior best, changed-selection refusal, immutable
queue, hot retry, confirm, restart/login, remaining record/party saves and full
ACK. WRITTEN ONLY / NONE RUN; native split-upload ordering, UI, crash and
performance remain unverified.

## Qualifying GVE party saved before record or stage clear — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-12)

Original operation `23100` imports `UserGvERecord`, computes the positive
`scoreInt64 >= dailyHighScore` flag, and passes it in `W23/W6` to result setter
`0x2570234`. Consumer `0x14514a4` copies the current battle party through
`0x24abff0` and `0x246f998` only when that flag and `isRecorded` are true. The
parameters JSON pointer remains at caller `SP+0x48` through call `0x246fb88`.

`stageColdRecovery` now admits party-first qualifying/tied recovery only when
the durable `party` observation, current `UserGvEHighScoreParty`, captured full
snapshot, selected slots, event, and Familia generation all agree exactly. The
record must remain at its issuance baseline or exact earned target and no other
effect may be saved. It derives `offlineGvePartyApplied:1` without changing the
signed queue. The source-only 136-byte ARM64 thunk at `0x153ff80` replaces
`0x246fb70`, preserves `W6=W23`, and writes exact `1` only to private result
padding byte `+0x6a`. A 16-byte gate at `0x1540008` replaces the original
high-flag branch at `0x145152c`: it preserves that flag and skips only the
party-copy block when the private marker is set. Record import, high-score UI
semantics, stage clear, callbacks, save/signature and ACK remain original.

Deferred `test_gve_completion.cjs` and `test_client_native_patch.py` cases cover
party-first and party-plus-record hot/cold envelopes, pull, confirm,
restart/login, forged controls, exact snapshot retention, later record/clear
and full ACK. WRITTEN ONLY / NONE RUN. Qualifying record-first is tracked
separately above; qualifying clear-first with its party still pending is also
tracked above. Other ABIs and native/UI acceptance remain open.

## Nonqualifying GVE record saved before stage clear — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-12)

Original operation `23100` imports the absolute `UserGvERecord` before its
stage clear. The same handler copies the current battle party only when the
current `scoreInt64` is positive and at least `dailyHighScore`. Therefore an
exact observed lower or zero result can replay the unchanged operation without
another party copy: importing the same record is idempotent and the still-
unsaved stage clear remains original.

`stageColdRecovery` now admits only that narrow record-only prefix. It requires
the durable `record` observation, the exact current result row, the original
GVE receipt/selection/Familia generation, an untouched root stage, and no
other saved effect. Qualifying record-first uses the separate exact current-
selection and prior-best proof above; rewards and other mixed prefixes still
cancel. The party-first and complete-clear-first branches use their scoped
native controls. No score, party, clear, reward or ACK is prewritten.

Deferred `test_gve_completion.cjs` cases cover a lower-result record-first
save, side-effect-free cold derivation, exact result retry, binary pull,
confirm, restart/login, missing-clear ACK refusal and the real remaining clear
plus ACK. WRITTEN ONLY / NONE RUN; no tests, static acceptance, build, patcher,
installation, listener or emulator work was performed.

## Guild Raid rankings — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

Original wrappers `0x23a5708:0x23a5ac0`, `0x23a5c70:0x23a6028`, and
`0x23a6028:0x23a63d8` send only `{guildRaidInformationId}` for Familia top,
Familia around, and member rankings. Shared Familia row parser `0x23a6440`
reads `rank`, `score`, and nested `familia{id,name,godId}`. Member parser
`0x23a6c54` reads `rank`, `score`, and nested
`member{userId,name,leaderPc}` with the retained four-field raid leader.

The offline member row exists only when the selected original
`UserGuildRaidRecord.scoreInt64` exactly equals the sum of `params.p1` from all
acknowledged scored battles for the current Familia generation. The newest
validated battle capture supplies the player name and leader. Top and around
reuse that exact score and the saved local Familia identity. A proven zero
score returns the original empty ranking; no publisher player or Familia is
invented. Rank 1 is explicit single-cohort offline policy, not a recovered
global placement.

Acknowledged positive history remains readable after the authored event closes.
Cached empty and lower-score responses are rebuilt and refused after progress;
unchanged current responses replay across restart. Deferred
`test_guild_raid_status.cjs` cases cover request shapes, empty and earned rows,
archived reads, stale empty/lower-score caches, exact replay, and restart.
Nothing was run. Publisher/global placement, remote members and Familias,
pagination/ties, native list art/navigation/save ordering/performance, and
no-crash/freeze/ANR acceptance remain unfinished. Co-op stays last.

## Master transfer — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

Switch case 6 of shared wrapper `0x1b12c34:0x1b13914` sends exact
`{appointeeUserId,godId}` to `familia/manage/change_master`. It uses request
callback mapped `0x1c2880c`/raw `0x1b2880c` and final callback mapped
`0x1c28ca4`/raw `0x1b28ca4`. The final callback requires transport status and
root `result` to be zero and reads no other response field, so offline success
is exactly `code:0,result:0`.

Only the accepted archived-CPU member of the current settled player-created
Familia can become master, and the request must contain the current original
`godId`. The accepted membership moves from post 1 or 2 to post 3 in the same
transaction that stores a permanent receipt bound to the actual encrypted
request, Familia creation, appointee, god, prior post, former-master post, and
transfer time. `familia/mystatus`, `familia/get`, and search then project the
successor as master and the player as an ordinary post-1 member. Exact current
retries survive cache loss and restart; changed, duplicate, damaged, stale,
dissolved, or recreated-Familia requests refuse. Cached pre-transfer status,
details, and searches cannot restore the old master.

The original response and surviving messages establish the successor but do
not expose the former leader's resulting role. Post 1 is therefore explicit
offline policy to prevent a dual-master state, not a recovered publisher rule.
The original creation owner remains stored as immutable provenance so existing
donation, reward, and lifecycle receipts keep their identity. Current-master
permission checks revoke invite, member-role, kick, settings, god, union
preference, and disband controls from the former player leader.

Deferred `test_familia.cjs` cases cover malformed IDs and gods, transaction
rollback, transfer from post 1, member/detail/search projection, stale caches,
former-master permissions, duplicate refusal, cache-loss replay, restart, and
profile/operation immutability. Nothing was run. Successor leave and actual
peer acceptance, nonzero result mapping, remote concurrency, and native
UI/save-order/performance/no-crash acceptance remain unfinished. Co-op and
peer behavior remain last.

## Submaster appointment and dismissal — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

Switch cases 4 and 5 of shared wrapper `0x1b12c34:0x1b13914` send exact
`{appointeeUserId,godId}` to `familia/manage/appoint_submaster` and exact
`{dismissedUserId,godId}` to the client-spelled
`familia/manage/dismessed_submaster`. Both use request callback mapped
`0x1c2880c`/raw `0x1b2880c` and final callback mapped `0x1c28ca4`/raw
`0x1b28ca4`. The final callback requires transport status and root `result`
to be zero and reads no other response field for either mode, so each offline
success body is exactly `code:0,result:0`.

Only the accepted archived-CPU member of the current settled player-owned
Familia may transition from ordinary post 1 to submaster post 2 or back from
post 2 to post 1, and the request must carry the current original `godId`.
The durable accepted-member row owns `post`; one shared indexed receipt binds
the actual encrypted request, action, Familia creation, member, god, before
and after post, and change time. `familia/mystatus`, `familia/get`, and search
project that saved post. Exact current retries survive cache loss and restart;
changed, duplicate, damaged, stale, dissolved, or recreated-Familia requests
refuse, and old cached status or role replies cannot undo the transition.

Deferred `test_familia.cjs` cases cover malformed IDs and gods, receipt
rollback, appointment, dismissal, status/detail projection, stale replies,
cache loss, restart, and profile/operation immutability. Nothing was run.
Publisher caps, nonzero results, remote concurrency, successor leave/native
acceptance, and native UI/save-order/performance/no-crash acceptance remain
unfinished. Co-op and peer behavior remain last.

## Member removal — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

Switch case 3 of shared wrapper `0x1b12c34:0x1b13914` sends only
`{userId}` to `familia/kick`. It uses the same request callback at mapped
`0x1c2880c`/raw `0x1b2880c` and final callback at mapped `0x1c28ca4`/raw
`0x1b28ca4`. The final callback requires transport status and root `result`
to be zero. Only approval case 1 parses root `user`; kick case 3 does not, so
the offline success body is `code:0,result:0` without a fabricated member.

The handler can remove only the accepted archived-CPU applicant belonging to
the current settled player-owned Familia. It atomically moves that exact
membership from accepted state 1 to terminal state 2 and records a permanent
request receipt bound to the actual encrypted body, applicant, Familia
creation, and removal time. `familia/mystatus`, `familia/get`, and search then
derive the owner-only member list. Exact retries survive cache loss and
restart; an older approval replay, duplicate removal, damaged receipt,
dissolved Familia, or recreated Familia cannot restore or remove another row.

Deferred `test_familia.cjs` cases cover the exact request/response, malformed
requests, transaction rollback, member projection, stale approval, cache-loss
replay, and restart persistence. Nothing was run. Publisher permission roles,
nonzero results, multiple peers, ordinary remote members, and native
UI/save-order/performance/no-crash acceptance remain unfinished. Co-op and
peer behavior remain last.

## Join approval and rejection — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

The shared native wrapper at `0x1b12c34:0x1b13914` uses switch case 1
for `{userId,approve:true}` and case 2 for `{userId,approve:false}`; both
select `familia/join/approve`. The adjacent cases select kick and role
management routes and are not part of this packet. Correcting for the imported
image base, request closure vtable `0x4217fe8` reaches mapped callback
`0x1c2880c` (raw `0x1b2880c`), which installs final vtable `0x4218058`.
Its callable slot reaches mapped `0x1c28ca4` (raw `0x1b28ca4`).

The final callback combines transport status with root `result`; success
requires zero. For approval it also reads root `user`, parses it through shared
parser `0x2526e44` in mode 1, and publishes the parsed member. That object has
`userId`, `rank`, `name`, `description`, `totalStatusPoint`,
`lastLoginedAt`, and the five established `leaderPc` fields. Rejection reads
no `user` object and enters the completion path directly.

Only the exact pending applicant belonging to the current settled player-owned
Familia can be decided. Approval changes its durable state to accepted and
projects the captured archived CPU profile as an ordinary post-1 member in
`familia/mystatus`, `familia/get`, and Familia search. Rejection changes it to
terminal state without adding a member. Both branches atomically store a
permanent request receipt bound to the actual encrypted body, decision,
applicant, Familia creation identity, and decision time. Exact retries survive
reply-cache loss and restart; changed, duplicate, corrupt, dissolved, or
recreated-Familia requests cannot rewrite membership.

No reward, currency, native operation, or remote publisher account is created.
Deferred `test_familia.cjs` cases cover exact bodies and responses, malformed
requests, receipt rollback, both decisions, member/list/detail/search
projection, cache invalidation, cache-loss replay, and restart persistence.
Nothing was run. Nonzero result mappings, expiry/order/caps, multiple peers,
master-transfer lifecycle, and native UI/save-order/performance/no-crash
acceptance remain unfinished. Co-op and peer behavior remain last.

## Received join applications — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

The exact 15.1.0 wrapper at `0x252664c:0x2526a04` builds only
`{userId}` from the current local account and sends the misspelled wire route
`familia/join/list/recieved`. Correcting for the imported image base, closure
vtable `0x43be1e8` reaches mapped callback `0x2627358` (raw `0x2527358`).
The callback requires a successful transport, reads root `requests`, and sends
each row to raw parser `0x2526e44`.

Each applicant contains `userId`, `rank`, `name`, `description`,
`totalStatusPoint`, `lastLoginedAt`, and nested `leaderPc` fields `pcId`,
`jobRank`, `level`, `heroSublimateLevel`, and
`isUnlockedHeroSublimate`. The offline handler requires the request's exact
local user ID and a settled player-owned Familia. It persists one immutable
pending applicant backed by the third original archived Under PvP CPU
profile/party. That singleton is explicit deterministic offline policy, not a
claim about a surviving publisher peer or request.

The row is keyed by the current Familia creation operation, with its captured
profile, request time, and pending/terminal lifecycle state. Pending state
returns the singleton; terminal states return the native empty `requests`
shape. Malformed or foreign requests, unsettled/non-owner membership, and
missing or damaged saved rows refuse without changing profiles, currency,
membership, or native operations. Cached replies are recalculated against the
current owner and applicant state, so an old list cannot resurrect a terminal
request.

Deferred `test_familia.cjs` cases cover the exact request/response shape,
unsettled and malformed requests, transaction rollback, snapshot corruption,
lifecycle cache invalidation, restart replay, and profile/operation
immutability. Nothing was run. Approval/rejection, expiry/order/caps, multiple
peers, and native UI/save-order/performance/no-crash acceptance remain
unfinished. Co-op and peer behavior remain last.

## Outbound join application — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

The exact 15.1.0 wrapper at `0x1b3b090:0x1b3b318` sends only
`{familiaId}` to `familia/join/send`. Correcting for the imported image base,
closure vtable `0x421f8f0` dispatches through `0x1c40038`; nested vtable
`0x421f960` reaches final callback `0x1c4037c`. It reads root `state` and
`result`, and reads `joinableAt` only for result `20000007`. The pending path is
state 0/result 0, so the offline response is `code:0,state:0,result:0`; it does
not invent an operation or reward.

The exact wrapper at `0x1b5c2a0:0x1b5c450` sends JSON `null` to
`familia/join/list/sent`. Its calibrated callbacks `0x1c5f730` and `0x1c5fa74`
call shared parser `0x1b59570` in mode 1. That mode reads root `requests`, and
each row uses the same complete nested `familia`, `master`, and `memberCount`
contract as a search card. A pending local application therefore appears as
the same `CPURecruit` card; absent, terminal, or current-member state returns an
empty `requests` array.

The exact cancellation wrapper at `0x1b5c018:0x1b5c2a0` sends only
`{familiaId}`. Correcting for the imported image base, closure vtable
`0x422cc78` reaches mapped callback `0x1c5f33c` (raw `0x1b5f33c`); nested
vtable `0x422cce8` reaches final mapped callback `0x1c5f680` (raw
`0x1b5f680`). That callback checks only the transport status and, on zero,
immediately reloads `familia/join/list/sent`. It reads no JSON response fields,
so the offline success body is only `code:0`; no result, state, operation, or
reward is invented.

An unaffiliated profile receives one approval-required `CPURecruit` card from
`familia/search/random`. Its master/member fields use the second original
archived Under PvP CPU profile/party; god, style, and active-time IDs come from
the original Familia catalogs. The separate name, description, ID 2, approval
policy, and zero unearned counters are explicit deterministic offline policy,
not recovered publisher peer state. `familia/get` returns the standard details
envelope for this exact target and derives `sentRequest` from durable state.

One SQLite transaction stores the immutable target/settings/owner snapshot,
request time, current request identity, permanent actual-wire receipt, reply,
and sequence. Cancellation atomically changes only the exact pending
application to state 1 and stores a second permanent receipt binding the actual
wire, target/owner, original application identity, and cancellation time. Exact
replays survive reply-cache loss and restart while their lifecycle state remains
current. Profiles, membership, currency, reward queues, and native data are not
changed by cancellation.

Malformed or unknown targets, an existing membership, a duplicate/missing
pending application, corrupt saved state, and conflicting or stale identities
refuse without rewriting history. Cancellation invalidates cached send,
details, and sent-list responses; a later reapplication makes the old
cancellation stale rather than letting it cancel the new request. Accepting
another invitation or creating a local Familia marks the current application
terminal. After leaving or cancellation, a fresh request may apply again.

Deferred `test_familia.cjs` cases cover recommendation/details shape, exact
send/sent-list/cancel responses, malformed/duplicate requests, transaction
rollback, durable cache-loss/restart replay, cancellation and membership
terminal transitions, stale caches, immutable profile/operation state, and
reapplication. Nothing was run. CPU approval/actual membership, publisher
nonzero-result and `joinableAt` behavior, expiry/caps, and native
UI/save-order/performance/no-crash acceptance remain unfinished. Co-op and peer
behavior remain last.

## Non-master leave — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

The shared wrapper at `0x1b12678:0x1b129b0` inspects the cached member post. A
master (`post == 3`) sends `familia/break`; every other post sends
`familia/leave`. Both use default JSON null. The leave callback resolves through
vtables `0x4217a68` and `0x4217ad8`; final callback `0x1b26488` reads only root
`result`. Zero clears the cached Familia/profile label and refreshes native
Familia state.

The offline handler permits only the accepted CPU-owned `OfflineCPU`
membership. With no outstanding operations, one SQLite transaction records a
permanent request identity and full membership snapshot, moves the invitation
to terminal state 2, removes the negative membership settlement and current
membership-scoped skill/shop/board/union rows, deletes the active membership,
and clears saved `UserProfile.familiaName`. Player-wide rewards, currency,
items, activity, and historical gameplay receipts are retained. Exact retries
after reply-cache loss validate the terminal state and cannot delete a later
membership.

Deferred `test_familia.cjs` cases cover the exact null/result contract,
malformed and owner requests, active-state cleanup, consumed invitation list,
profile restoration, and permanent replay. Nothing was run. The modal's
original 24-hour rejoin restriction, decline/reinvite, publisher peers,
member-operation attribution, and native UI/save-order/performance/no-crash
acceptance remain unfinished.

## Incoming invitation acceptance — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

The exact 15.1.0 wrapper at `0x1b5d174:0x1b5d3fc` sends only
`{familiaId}`. Its request callback is reached through vtable `0x422d378`;
nested callback `0x1b61970` reads root `result`. Zero calls the success path at
`0x1b5d3fc`; the other observed branches retain the client's own error flow.

The handler accepts only the durable pending `OfflineCPU` invitation described
below. In one SQLite transaction it marks that invitation accepted, creates a
CPU-owned local membership, records a negative membership identity in the
settled-operation set so it cannot collide with normal positive client
operations, updates the saved `UserProfile.familiaName`, and binds the actual
wire bytes to a permanent request receipt. Exact retries survive reply-cache
loss without creating a second membership. Changed, missing, corrupt,
already-consumed, or conflicting requests refuse and preserve the prior state.

`familia/mystatus`, `familia/get`, and Familia search now project the archived
CPU leader as master and the actual local player as an ordinary member.
Creation, disband, and outbound invitations remain owner-only. Deferred
`test_familia.cjs` cases cover the exact response, malformed/conflicting
requests, membership projection, stale list cancellation, and permanent
replay. Nothing was run. Publisher invitation production and nonzero result
meaning, decline/role permissions, joined-member donations/events, and
native UI/save-order/performance/no-crash acceptance remain unfinished.

## Incoming invitation list — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

The exact 15.1.0 wrapper at `0x1b5b4e8:0x1b5b698` creates default JSON
null and sends `familia/invited/list`. Callback `0x1b61304` invokes shared
Familia-card parser `0x1b5a2ac`, which reads root `familias` and the same nested
`familia`, `master`, and `memberCount` shape used by Familia search. When the
parsed vector is empty, the callback deliberately opens
`common_dialog_confirm_title` with `familia_no_invitation`.

With no membership, the handler persists one immutable pending invitation and
returns its card. The card is clearly labeled `OfflineCPU`; its master and
leader fields come from the first original archived CPU profile/party, while
its compact Familia settings are deterministic offline policy. This is not a
claim that a publisher peer sent an invitation. Outbound invitations remain a
separate relationship. After acceptance or while any membership exists, the
handler returns the authored empty-vector state. A cached pre-accept list is
revalidated and cancelled after membership changes instead of restoring stale
UI state.

Deferred `test_familia.cjs` coverage checks the exact null request, card shape,
malformed payloads, acceptance, membership projection, stale-list rejection,
and replay. Nothing was run. Invitation expiry/order/decline, multiple peers,
and native dialog/list/back/performance/no-crash acceptance remain unfinished.

## Outbound invitation — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

The exact 15.1.0 wrapper at `0x1b17de8:0x1b18070` sends only `{userId}`.
Callback `0x1b37368` reads root `result`; zero follows the success path.
Nonzero `10001602` selects `familia_invitation_familia_size_max`, while other
nonzero results select `familia_error_dialog_default_message`.

The offline handler accepts only a candidate from the archived CPU projection
and only for the settled current local Familia. It atomically stores one
pending invitation per Familia/candidate, the complete candidate snapshot,
invitation time, an indexed status, a permanent request identity bound to the
actual wire bytes, and the JSON reply. New request numbers alias the same
pending invitation instead of duplicating it; the original request can be
replayed after reply-cache loss. Changed bytes, damaged rows, non-pending state,
unknown candidates, and a dissolved or recreated Familia refuse without
rewriting history.

This route deliberately does not auto-accept the invitation or insert an NPC
member: the original operation sends an invitation, while acceptance belongs
to a different client/account packet. It also creates no reward, currency, or
native-profile operation. Deferred `test_familia.cjs` cases cover exact shape,
settled ownership, idempotency, permanent replay, rollback, restart,
dissolution, and profile/queue immutability. Nothing was run. Original invite
caps, expiry/resend and nonzero result rules, peer acceptance, member
persistence, native dialogs/list refresh/save ordering/performance, and
no-crash/no-freeze acceptance remain unfinished.

## Invitation candidate search — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

The exact 15.1.0 wrapper at `0x1b0daa4:0x1b0dc88` calls request builder
`0x1b17a0c`, which emits only `searchType` and `limit`. Its five UI modes are
`1/1000`, `1/10000`, `2/1000`, `2/10000`, and `0/1`. Success callback
`0x1b36644` iterates root `users` and reads `userId`, `rank`, `name`,
`description`, `lastLoginedAt`, `totalStatusPoint`, and `leaderPc` containing
`pcId`, `level`, `jobRank`, `heroSublimateLevel`, and
`isUnlockedHeroSublimate`. Optional `userAdventureLevelInfo` is omitted rather
than invented.

The offline handler requires a settled local Familia owner and projects the 312
authored `dummyUnderPvpParty` rows through the existing original Under
Telskyura CPU decoder. These are archived game CPU teams, not fabricated
publisher players or remote accounts. Because the publisher meaning of the
three search types did not survive, deterministic ordering is disclosed policy:
type 0 by party ID, type 1 by rank then ID, and type 2 by total status then ID;
`limit` is an upper bound. Names use the archived dummy profile names with an
`[Offline CPU]` label. The read-only response is recalculated on transport
replay so a stale cache cannot restore changed membership or corrupted Familia
state.

Deferred `test_familia.cjs` coverage exercises all five pairs, exact response
fields, unique original candidates, ordering, malformed requests, no-group and
unsettled-group refusal, exact replay, and profile/operation immutability.
Nothing was run. Invite sending, acceptance/rejection, membership persistence,
publisher matching filters, native list art/navigation/performance, and
no-crash/no-freeze acceptance remain unfinished.

## Legacy weekday GVE result — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-11)

Original adventure mode19 and mode20 use the same stage-result producer for
`gveStageId`, battle statistics and leader. The old operation23000 handler in
this client unconditionally asserts `No implementation`; it cannot complete a
stage. The offline mode19 endpoint now issues the working original operation
23100 instead, under an explicit compatibility policy, reusing the modern GVE
score, saved record, captured party, stage-clear and real native-save/ACK path.
It never emits fatal23000 or generic5000, and does not prewrite a score,
reward, party or clear into the client's profile.

Admission requires one of the seven original mode19 event/stage joins, saved
local Familia ownership, the matching Monday–Sunday event label/ID and a JST
weekday matching the selected clock; its original adventure window starts in
2018 and has no end. The decoder now retains all seven original
`gveInformation` slot6 values (1–7) and the sixteen mode20 zero values, so
admission uses the authored byte rather than event-ID arithmetic. The export
also retains original slots7/8/9: all seven legacy rows are `5/23/5`, while
modern rows vary. The result handler checks that exact legacy catalog shape,
but does **not** interpret those three values as attempt costs or hours. The native weekday/attempt selector is still
unrecovered, so it is explicitly offline policy rather than publisher parity.
An issued result remains deliverable after the weekday changes. Wrong mode,
weekday, catalog, owner, stage, party, result or saved checkpoint refuses with
the existing retained-state path.

Deferred `test_gve_completion.cjs` cases cover wrong route/day, original23100
shape, no precredit/debit, changed-day retry/restart, native-shaped saves and
actual ACK. NONE RUN. Daily reset, attempt limits, earned missions/rewards,
publisher scoring, original23000 behavior, native mode19 presentation/save
ordering, clock changes, recovery and no-crash/no-freeze acceptance remain
unfinished or unverified. Earlier unsupported statements below are historical.

Read-only original ARM64 extraction now identifies `GvEUtils::isOpenPeriod`
(`0x2043e1c:0x20440d8`) and `isDisplayPeriod`
(`0x2043b60:0x2043e1c`). Both resolve the GVE event's adventure ID through
the original adventure catalog and call the native interval predicate
`0x2b3a5dc`. Open reads the adventure's slots6/7; display reads slots8/9.
The predicate has inclusive positive start, exclusive positive end and an
unbounded zero end. Neither function reads `gveInformation` slots7/8/9, so
their legacy `5/23/5` values are **not** evidence of hours or attempts. This
supports the existing open-window admission, but does not prove the separate
weekday selector, attempt debit/reset or publisher result behavior. Exact
decompilations are retained under `.work/gve-open-period-exact-20261011.txt`
and `.work/gve-display-period-exact-20261011.txt`; no test, build, listener or
emulator check was run.

## Original mission Valis cap-credit follow-up — source-only / UNTESTED

Fresh6000 Valis caps now share Present/shop stock/credit validation and update
the existing Familia spending ceiling only after actual issued signature plus
capped lifetime. Hash-bound original quantity/stock/credit and permanent real
mission claims/6000 capture survive ACK. Full stock/no prior charge/exact
saturation mint no credit; old22000/22100 settles first, later donations cannot
be refunded. The pending and permanent source both bind original Valis quantities
and claim identities. Lost new credit/floor is not imported from old donations.

Six-source floor adds achievement; exactly known old two/three/four/five-source
schemas preserve all rows in a v4 backup and retain existing v1/v2/v3 backups.
Unknown/custom/referenced/colliding schemas refuse. Private receipt columns,
partial indexes and migration are SOURCE ONLY / UNAPPLIED; no real save opened.
Sixteen original20000-Valis cases (including three mixed CP/Hero/dated/Iris
combined cases), four no-credit variants within those16, source-loss/rollback/
later charges and twelve schema modes are WRITTEN ONLY / NONE RUN. Synthetic
funding/eligibility/order is not native proof. This supersedes the older mission
Valis/five-source limitation only; coalesced/other producers/native signing/UI/
recovery/performance-stability still unfinished/unverified. Co-op last;
docs/achievement-reward-contract.md.

## Original shop Valis cap-credit follow-up — source-only / UNTESTED

Fresh9000 capped Valis rewards share Present stock/credit validation and update
the spending floor only after actual issued signature plus capped cumulative.
Hash-bound original quantity/stock/credit and permanent original-product shop
receipt survive ACK. Count/date alone/full stock/no prior charge mint no credit;
old native Familia charges settle before gain capture and later donations cannot
be refunded. Five-source floor schema adds `shop`; exactly known old two/three/
four-source schemas preserve rows in a v3 backup and keep any v1/v2 backups.
Unknown/custom/referenced/colliding schemas refuse. DDL SOURCE ONLY / UNAPPLIED,
no real save opened or migrated. Twelve original30000-Valis shop scenarios,
zero-credit/source-loss/rollback/later-donation and ten schema modes are WRITTEN
ONLY / NONE RUN. Coalesced/other producers/native earning-order-UI-recovery-
performance-stability remain unfinished/unverified; docs/shop-reward-contract.md.
Co-op last.

## Non-full event-box Valis signature follow-up — source-only / UNTESTED

Fresh15000 capped Valis gains now capture the actual saved before signature even
below the stock maximum and exclude it from issuance. Original24d8a18 returns
to the same24d88e8 signature-forwarding stock setter as the clamped branch.
The actual saved issued signature proves its original gain after first-save
spending; existing Valis credit then updates the same protected spending floor.
Cost/counters/full mixed rewards/real ACK and later donation charges remain.
Private numeric allowances bind the signature too, so a removed signed stock
capture cannot downgrade into old target-stock proof. No native precredit or
new schema; earlier receipt-column DDL remains SOURCE ONLY / UNAPPLIED.

Both original Valis prize pools now have24 deferred crossing/capped/stock-cap
Familia scenarios including spent-before-save and spending in counts-first saves.
WRITTEN ONLY / NONE RUN; initial funding/time/Familia are synthetic. Native
earning/signing/order/UI/recovery/stability remain unverified, coalesced earlier
unsaved charges still require settlement first. See the newer
[event-box contract](event-box-contract.md); no tests/checks/build/install/restart/
emulator/ADB/workers/Actions, saves untouched, all149 branches before testing.

## Capped Present Valis spending credit — source-only / UNTESTED

Original2000 Valis205000002 now shares the existing spending-ceiling ledger with
creation, donation and event-box sources. Private gift-item captures bind the
actual old stock/cumulative/signature, full grant quantity, native-clamped
targets and previous ceiling. Only a genuine saved issued signature plus capped
cumulative earns the positive stock-minus-lifetime credit, once. Received flags
alone and full-stock zero gains do not earn it. A source receipt remains after
real ACK, and later actual donations still lower the ceiling.

Pending22000/22100 native charges must settle first; reverse issuers already
require a settled queue. No native Valis/flag/signature precredit, second wallet,
fake ACK or invented coalesced charge/gain is introduced. Profile/token, private
observations, existing floor, queue/done and exact reply share one transaction.

The source floor schema adds present, losslessly preserving each exactly known
older schema in familia_valis_spending_floor_v2_backup and retaining any existing
v1 backup. Unknown schemas, references, custom indexes/triggers and backup
collisions refuse migration. New gift receipt columns/indexes and migration are
SOURCE ONLY / UNAPPLIED; no real save was opened or migrated.

Twelve Valis Present order fixtures, four no-charge caps and schema transitions,
rollback/restart/corruption/backup retention/later-donation cases are WRITTEN ONLY
/ NONE RUN. Native earning, signing/save order, UI, clock, cold recovery,
performance and stability remain unverified. All149 packets/branches before
testing, co-op last; see [Present contract](gift-reward-contract.md).

## Faithstone22200 indexed completed history — source-only / UNTESTED

The save handler now seeks the strongest acknowledged spending, lifetime
acquisition and current-day count proofs separately for each of the three
original items, instead of aggregating all lifetime donation receipts on every
item save. Ordered expression indexes reuse the existing permanent receipts
and `operation_done` relationship. Issued but unacknowledged receipts cannot
earn a floor, even if they sort before the strongest completed receipt. A
partial unknown-item index prevents fixed original-item lookups from silently
ignoring unsupported completed history. Existing missing/downgraded checkpoint
and current-day format2/3 capture validation remain in place.

No duplicate floor ledger, backfill, native prewrite, early charge/ACK, receipt
mutation or new packet shape is introduced. Existing receipt/profile/token/
queue/done/reply atomicity is unchanged; earlier indexes and saved data remain.
The new index DDL is SOURCE ONLY / UNAPPLIED, not a migration acceptance claim.

Deferred `test_familia_donation.cjs` adds all-three-item historical selection,
independent extrema in different receipts, stronger unacknowledged candidates,
unknown completed versus unacknowledged items, refunds, cumulative/count/date/
owner/removal regressions, reopen and next-day count resets with lifetime cost
proof retained. Synthetic legacy history and aggregate comparison are only a
selection oracle, not native earning, capped-gain attribution or a benchmark.
WRITTEN ONLY / NONE RUN. Query plans, latency, native save order/UI/recovery
and stability remain unverified; semantic clock/legacy/capped-producer gaps
remain unfinished. All149 packets/branches before testing, co-op last.

## Faithstone22200 paused forward-day reads — source-only / UNTESTED

Original `2570d3c` compares its second AppTime read with the stored donation
date; the retained instructions contain no120-second processing limit.
`2570f30` then writes the resulting count before writing the earlier supplied
timestamp. A suspended callback can therefore produce the reset quantity with
an earlier same-day timestamp even when processing resumes hours or days later.

The shared count-target helper now accepts a later-day observation as evidence
for that alternative. The120-second boundary remains only the old local fallback
when no forward-day observation is available, not a native pause limit. Ordinary
same-day saves without that evidence cannot invent a reset. Original before
capture/owner/item/quantity/daily40/stock-signature width and full actual debit/
real ACK rules remain. Native fields and callback wire are not prewritten.

When the actual observed reset count and timestamp pair needs the later-day
evidence, the existing receipt promotes to format3 and retains `count`, `at`
and `reconciledAt`. The last field records server reconciliation time, not the
native getter's exact time or the first count save's time. Count-first and
timestamp-first saves remain independent; price-less observations cannot ACK.
Known targets cannot switch or rewind; a later zero reset retains their actual
observed value. Unknown targets erased before observation still use format2
with actual zero and `erasedAt`, now including longer forward pauses. No target
is guessed, no extra bank/CP/skill credit or synthetic acknowledgement is added.

Format/observation/charge/callback-day checkpoint/native profiles/tokens/real
queue/done/exact reply remain in the existing atomic transaction. Completed
format3 retains the actual observed count, while format2 retains actual zero
and only a guaranteed-quantity daily lower bound. Relevant indexed daily-floor
reads validate both formats. The new version-aware missing-checkpoint index
also detects preserved erase/reconciliation keys with downgraded format markers,
including completed receipts on other days, without parsing all history.
Source index DDL is UNAPPLIED; existing earlier indexes/data and saves remain.

Deferred `test_familia_donation.cjs` adds all three original types with a
two-day-plus-one-hour pause: count-first, timestamp-first, count/time-first,
known count then zero reset, combined ACK, erased-count-first, cost-late and
timestamp-late. Existing cold/cached/hot/retained-queue/typed-input/partial and
ACK rollback cases are reused. New cases cover reconciliation field/type/time/
count corruption, pending and completed format downgrade, missing completed
count/charge checkpoints, actual ACK/exact retry/once-only contribution and
actual-versus-guaranteed daily floor rejection. WRITTEN ONLY / NONE RUN;
synthetic pauses, ordering and historical-day lookups are not native proof.

This supersedes the named forward-delay gaps only. Backwards clock/reset
history, unchanged ambiguous timestamps, legacy and capped-gain attribution,
native signing/save/order/UI/cold/performance/stability remain unfinished or
unverified. All149 packets and unfinished branches before testing, co-op last;
no checks/generators/builds/APK/restarts/emulator/ADB/workers/Actions.

## Faithstone22200 count erased before observation — source-only / UNTESTED

This supersedes only the bounded erased-count gap in the earlier midnight entry.
Original `2570f30` writes count before the callback timestamp, while `2570d3c`
can later reset count to zero without clearing that timestamp. A saved actual
full charge, changed/captured callback timestamp and zero on a later day can
therefore complete the original operation even if the intervening count was
never saved. Both pre-reset targets remain explicitly unknown.

The existing private receipt now promotes known format1 to format2 only after
that actual combination is observed. Format2 retains `count:null`, the actual
callback time and server observation time `erasedAt`; the last value is not
claimed to be the native getter's exact time. It requires a forward reset day,
the existing local120-second two-read boundary, a validated original before
capture and saved charge. The native item is kept at its actual zero. It cannot
be restored to either guessed target while pending, refunded, have its timestamp
rewound or lose/downgrade the new observation format. Missing legacy baselines
are not backfilled. Cost-late and time-late saves cannot settle until both real
effects are present; a natural zero reset alone still does not earn a donation.

Only a real22200 ACK completes the queue. Format/observation/charge/native
profiles/tokens/callback-day checkpoint/done/exact reply share the existing
transaction, with no native prewrite or extra bank/CP/skill credit. Completed
format2 saves the actual zero in `saved_count`, not either erased target.
The indexed callback-day floor uses only the guaranteed original quantity as
its lower bound, not a claim that this was the missing native count. Known
observed counts continue using their actual value. Existing lifetime spending
proof is unchanged. Completed format2 loses validity if its zero/charge/day
checkpoint is missing; relevant daily floor reads validate its full capture.

Source DDL adds a version-aware partial checkpoint index; UNAPPLIED. Existing
older indexes/data are retained, no real save opened or migrated. Deferred
`test_familia_donation.cjs` covers all three original item types with erased
count first, cost-late, timestamp-late and combined actual ACK, no native target
invention, retained partial queue/hot-cold-cache cancellation, erase-format
corruption/downgrade/target restoration refusal, issue/partial/ACK rollback,
real ACK/exact retry/once-only CP/skill, completed zero/charge checkpoint loss
and guaranteed daily floor refusal. WRITTEN ONLY / NONE RUN; synthetic order
and historical-day lookup are not native earning or backwards-clock proof.

Long second-read delays/backwards clocks, unchanged ambiguous timestamps,
legacy/capped-gain attribution and native signing/order/UI/cold/performance/
stability remain unfinished or unverified. All149 packets and unfinished
branches before testing; no checks/builds/restarts/emulator/workers/Actions.

## Faithstone22200 second AppTime read at midnight — source-only / UNTESTED

The retained original instructions show `2570f30` receiving the callback time,
then calling `2570d3c` before writing count and that earlier timestamp.
`2570d3c` independently fetches AppTime and can reset only count. The count
therefore need not use the calendar day of the timestamp being saved.

The shared pending receipt/effect path now admits the reset-to-quantity target
as well as the ordinary prior-count-plus-quantity target when the earlier time
is in the final120 seconds of its original day. This120-second range is an
explicit local compatibility bound, not a recovered publisher limit. Outside
that boundary, unchanged same-day rules remain. Original item quantity,
daily40 cap, ownership, stock/signature width and full debit/ACK rules remain.

The actual observed count chooses the target; observation cannot switch later.
A no-op count equal to the captured before count requires the actual complete
charge and saved callback timestamp. A later date-aware zero reset retains that
observed target and timestamp. Actual ACK stores the existing callback-day/count
checkpoint atomically with profiles/tokens/receipt/queue/done/exact reply; no
new schema or fabricated native count/time/cost/signature/CP/ACK is introduced.
If both possible counts are erased by a reset before either is observed, the
real queue remains pending: the earlier timestamp and full charge alone cannot
choose the missing target. Legacy missing captures remain unreconciled.

Deferred `test_familia_donation.cjs` adds all three original Faithstone types
with getter-midnight cost/count/date-first saves, an unchanged native count,
reset after count observation, reset before any count observation and rejection
far from midnight. Existing cold/cached/hot delivery, real queue retention,
counter/refund rewinds, corruption, rollback and real ACK cases remain queued.
WRITTEN ONLY / NONE RUN. This supersedes only the bounded forward-midnight-read
gap below; longer delays/backward clocks, erased ambiguous history, capped gains
and native save/signature/UI/cold/performance/stability remain unfinished or
unverified. All149 packets and unfinished branches before testing; co-op last.

## Creation22000 saved-cost recovery — source-only / UNTESTED

Original `251d308:251d454` reads `consumedValis`, converts it to an int32,
negates the full price and calls the Valis gain slot with the issued operation
signature. The hot response adapter `2520bb0:2520d94` separately consumes
`result=0` before caching the requested Familia settings. The original price
remains100000; neither stock nor signatures are prewritten by the server.

New issuance captures the actual owned six-field wallet and queued22000 in a
permanent private `familia_creation` receipt, hashes its immutable identity,
price, before stock/cumulative/signature, original settings and spending bound,
and marks the active row's capture format atomically. The existing issuer
excludes the before signature, including collision/wrap handling. Actual saved
charge and changed signature are independent evidence: a partial effect prevents
fresh/cached/hot/cold/plural/singular/login/confirm/binary-pull additive replay.
Push suppresses delivery only; the real queue and full actual debit/real ACK
remain mandatory. No early completed floor or fabricated acknowledgement.

Every accepted `familia/create` transport now also stores a permanent
actual-body `familia_creation_request` receipt with the creation operation,
request time, request-time pending state and exact response/hash. This identity
is resolved before the generic reply cache and session sequence. While pending,
an exact retry validates and returns the one captured22000 operation. After its
real ACK, the same identity returns an empty settled success and cannot remint
the charge. Because the native success callback caches the submitted settings,
the retry additionally requires the same current creation generation and exact
current settings: a rename, disband or recreation makes the old request stale.
A fresh request using the current settings may record a settled no-op. Legacy
generic cache-only creation success is refused rather than trusted.

Real ACK joins the existing native profile/token/receipt/floor/queue/done/exact
reply transaction. The shared owner-keyed Valis floor retains creation as an
explicit source and rejects stale refunds after disbanding or recreation.
Receipts survive both; later creation charges can tighten the bound. Settled
event-box cap credit continues using the same floor/source path. Original Valis
stock may exceed its nine-digit lifetime gain cap; a captured pre-existing
creation cumulative value above that cap permits its original int32 storage
range through2 billion only for this recovery proof. Ordinary gain validation
and capped producer rules are unchanged.

Source DDL is UNAPPLIED. The exact older two-source floor CHECK can be upgraded
transactionally by retaining the entire old table as `v1_backup` and copying
all owner rows unchanged. Unknown schemas, custom indexes/triggers, references
or an existing backup cancel without replacing floor proof; a refused schema
closes its database handle. No actual save was opened, migrated or restarted.

Legacy pending active rows with known original stock/cumulative/settings can
retain that evidence only after an actual full charge; their unknown original
signature is not guessed and cannot authorize redelivery. Missing new-format
receipts cannot become legacy. Previously completed old creations are not
backfilled. Mixed capped gains/debits, unrelated changed signatures and old
completed-history reconciliation still need producer attribution. Native signing,
callback/save/ACK order, Familia cache/profile rendering, cold recovery,
performance and stability remain unverified.

Deferred `test_familia.cjs`, `test_familia_break.cjs` and
`test_familia_creation_schema.cjs` cover split cost/signature/combined saves,
ordinary gain, stock-above-lifetime, legacy/missing capture, hot/cached/cold
replay, permanent request/receipt/reply rollback, cache loss/restart, response
corruption, legacy cache-only refusal, owner/shape/hash/refund/rewind refusal,
real ACK/settled exact retry, stale rename/disband/recreate isolation and guarded
lossless schema upgrade.
WRITTEN ONLY / NONE RUN; synthetic wallets and save ordering are not native
acceptance. All149 packets and unfinished branches before consolidated testing;
co-op last, no workers or Actions.

## Faithstone donation22200 partial-save recovery — source-only / UNTESTED

Original `2572068` consumes the item through vtable+50 with the operation
signature before obtaining AppTime and calling `2570f30`. Read directly from
the original library, `2570f30:2571034` gets the date-aware count, adds quantity,
writes count through `2871e48`, then timestamp through `2871f50`. The count
getter `2570d3c` can reset count to zero on a different JST calendar day without
clearing its timestamp. Reading these contracts is not gameplay verification.
See `.work/familia-donation-callback.txt` and the new selected raw instructions
in `.work/familia-item-counter-raw-20261009.txt`; no game/runtime was launched.

New receipts capture actual native count/time plus issue time, explicitly mark
their format and retain independent actual charge/count/time observations.
The shared save/delivery path validates22200 identity, original quantity and
Faithstone contribution/cap data, hot popup fields and the owned native item.
After any saved donation effect, fresh/cached/hot/cold/plural/singular/login/
confirm/binary-pull replay cancels or suppresses delivery only; the real queue
and full debit/counter/time/ACK requirements remain. A daily reset alone is not
callback proof. The newer [complete cold recovery contract](familia-item-complete-recovery-contract.md)
supersedes only the modern fully saved, privately checkpointed charge/count/time
refusal: confirm derives zero quantity and paired native guards skip both the
already-saved debit and additive count/time callback. Login/binary pull only
validate; the original positive source queue and real ACK remain required.
The newer [unpaid callback contract](familia-item-unpaid-recovery-contract.md)
also covers exact saved count/time before the debit: the cold reply retains
the price and marks only the already-applied callback. A real later debit
changes its replay phase; the original cached row can derive the paid path.
The [paid-before-callback contract](familia-item-paid-before-callback-contract.md)
handles the opposite saved prefix on the original issue day: zero debit
with the original positive callback quantity, followed by real count/time
save and ACK.
The [count-before-date contract](familia-item-count-before-date-contract.md)
also covers a visibly saved count before the timestamp on the same game day,
with the original date getter and remaining timestamp setter kept in place.
The [date-before-count contract](familia-item-date-before-count-contract.md)
covers a visibly saved timestamp on that day with unchanged count: the
original count setter runs, while a guarded leaf preserves the saved date.
An exact zero prior count also permits a zero or older prior timestamp;
nonzero older-day counts remain guarded.
The [older/zero-date count contract](familia-item-old-day-count-contract.md)
keeps the native zero-count getter path and setter when a changed count
was saved but the timestamp still belongs to an earlier day or is zero.
Half-saved/legacy/capped/coalesced recovery stays guarded; no case is executed.
No native stock/signature/counter, fake ACK or extra CP/level
reward is prewritten. The existing contribution/skill credit is once-only.

Count-first and timestamp-first fragments remain independent. Actual callback
time fixes the applicable original daily target, not necessarily the issue
day. A later native count reset retains the captured timestamp and target;
a frozen identical timestamp requires the complete saved debit/count to pin
that no-op. The local first-time clock window is issue minus5 seconds through
max(current clock, issue time) plus120 seconds, not a recovered publisher rule.
Actual ACK stores the callback day/count for completed daily floors with an
indexed day lookup. Debit floors still retain completed spending evidence.
Native profiles/tokens, observations, day checkpoint, queue/done and exact
reply use the existing atomic save transaction. Refunds, observed-field rewinds,
conflicting captured days and obsolete settled callbacks cannot replay credit.

Source DDL adds nullable captures/day fields, format/charge flags and private
indexes only; UNAPPLIED, no existing save opened or migrated. Known old-format
queues keep their missing baseline unknown, cannot redeliver, and cannot use
ambiguous counter-only recovery. Actual full charge/old day-count/time/real ACK
can settle them. Missing new-format captures or completed checkpoints require
reconciliation instead of being reclassified as legacy or backfilled.

Deferred test_familia_donation.cjs sources cover all three original items and
cost/count/date-first, combined, callback after midnight, reset after callback,
frozen clock, natural reset alone, legacy cost/counter paths, hot/cold/cached
handoffs, ownership/shape/capture corruption, refunds/rewinds, issue/save/receipt/
day/done/reply rollback and actual ACK/retry/once-only CP/skill persistence.
WRITTEN ONLY / NONE RUN. Funding/group/prior counts and field-order fixtures
are synthetic, not natural earning, native signing, UI or save-order proof.

Second AppTime-read midnight skew, large backwards-clock callbacks, capped
Faithstone acquisition/debit attribution, legacy reconciliation,22000 creation
recovery and natural UI/signature/save/ACK/cold/performance/no-crash-ANR remain
unfinished or unverified. All149 packets and unfinished branches before tests;
no tests/checks/generators/builds/APK/restarts/emulator/ADB/workers/Actions.

## Valis donation partial-save recovery — source-only / UNTESTED

Original22100 processor `243ac68:243b150` debits the full consumed Valis
before writing the donation counters through `2439d30:2439e20`. Count and
lastDonatedAt are separate native fields, parsed by `280a754:280a9cc`;
`2439fc4:243a168` resets the daily count without clearing that timestamp.
These original client contracts are not proof of observed native save order.

New receipts capture each selected owned counter's actual before fields and
retain monotonic count/date observations plus charge/effect flags. The shared
delivery filter suppresses an additive callback after any saved effect, while
retaining the real22100 queue. Fresh/cached requests, plural/singular delivery,
login, confirm and binary pull use that same receipt/operation identity and
original cost/quantity/counter validation. Untouched delivery projects the
required captured Familia/member CP fields without rewriting the queue.

The newer [paid cold recovery contract](familia-valis-paid-recovery-contract.md)
supersedes only modern charged22100 and exact-unpaid counter cold refusals above.
Actual captured charge and owned membership permit a zero-debit projection;
captured counter observations with exact pre-charge wallet retain full cost.
login/binary pull only validate the pending receipt. Native profiles need no
invented familiaId. Original queue/cost/bank and real full-save/ACK guards remain.
Five additional contexts and extended cost-first/midnight cases are written
only; the paired ARM64 zero-adder guard is not built or installed. Ambiguous unpaid,
legacy/coalesced/historical membership branches remain unfinished.

Only a complete actual charge, every issued counter field (or original daily
count reset with its issued timestamp) and the real acknowledgement settle the
operation. Partial observations, native profiles/tokens, queue/done, completed
spending floor and exact replies share the existing save transaction. No native
debit/signature/counter, early completed floor or fake ACK is prewritten. Saved
charge refunds and observed-field rewinds reject; old settled cached callbacks
cannot debit again or duplicate the bank contribution.

The new nullable before-counter/observation fields and private flags are SOURCE
ONLY / UNAPPLIED. Legacy receipts lacking both captures cannot be redelivered
outside a save; counter-only legacy recovery remains unavailable rather than
guessing its before state. A full saved charge/counters/real ACK can still settle
such an old queue. Missing one capture or corrupt evidence is retained, not
backfilled. Legacy reconciliation, coalesced older22000/22100 debit plus capped
reward and equivalent22000/22200 recovery remain unfinished.

Deferred test_familia_valis.cjs cases cover cost/counters/count/date first,
combined and midnight saves, legacy captures, hot/cold/cached/singular/plural
delivery, malformed ownership/evidence, refunds/rewinds, all save/receipt/floor/
done/reply rollback boundaries and real ACK/retry/once-only bank effects.
WRITTEN ONLY / NONE RUN; synthetic funding, initial group and field-order saves
are not native signing/order/UI acceptance. No checks, tests, generators, builds,
APK work, restarts, emulator/ADB, workers or Actions. All packets and unfinished
branches precede consolidated testing; co-op last.

## Valis donation and capped event-box credit follow-up — source-only / UNTESTED

New donations accept the original ordinary Valis stock range through2 billion,
including stock above the separately capped lifetime count. Actual22100 charges,
daily counters and acknowledgement remain mandatory. The receipt captures an
exact spending ceiling; a private owner-keyed floor retains its real completed
source, surviving group changes without erasing previous charges. Old completed
charge receipts can initialize it once, but missing new-format floor proof is
never guessed from legacy history. Normal saves seek/update the current floor
and source directly instead of repeatedly scanning lifetime donations.

The event-box producer may raise that ceiling only after its original saved
gain proof, and only by clamped stock gain minus clamped lifetime gain. The full
authored reward is still sent. Full-stock no-ops receive no spending credit;
their original changed-signature proof remains necessary for the real reward
ACK. A later donation retains its own stricter debit bound, so an earlier gain
cannot refund it. Native profiles/tokens, once-only observations/floor/queue/
done/replies reuse the existing atomic save transaction. No native stock or
signature is prewritten, and positive-credit draw receipts remain as permanent
source proof after ACK, not replayable callbacks.

The new private schema and initialization are written only, UNAPPLIED; no
existing save was opened or migrated. Deferred test_familia_valis.cjs cases for
both original pools, crossing/full lifetime/clamped stock, both split orders/
combined saves, rollback/replay/no precredit, spent gains, exact old-charge
initialization, retained credit sources, lost/corrupt floors, full-stock zero
credit and later donation stale-save refusal are WRITTEN ONLY / NONE RUN.
Coalesced older Valis debit plus capped gain, other capped producers/legacy
attribution and natural native signing/save/ACK/UI/performance/recovery remain
unfinished or unverified. All packets/branches before tests; no tests/checks/
builds/APK/restarts/emulator/ADB/workers/Actions. See docs/event-box-contract.md.

## Frozen-client evidence

EU 15.1.0 original ARM64 SHA-256: `e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`. Addresses below are original raw addresses; the Ghidra import adds `0x100000`.

- `0x1b3aadc:0x1b3ad7c` sends `familia/get` with JSON `{familiaId: int64}` from the member-list screen. It is not an empty `familia/mystatus` request.
- Callback vtable raw `0x411f6d8` slot `+0x30` resolves to `0x1b3f620:0x1b3f81c`. This dispatches another callback through vtable `0x411f748`, whose slot `+0x30` is `0x1b3f984:0x1b3fbb0`. That UI callback requires numeric root `result == 0` before parsing details.
- `0x1b3cb04:0x1b3e25c` iterates root `members`: `userId`, `name`, `description`, `rank`, `lastLoginedAt`, `totalStatusPoint`, `post`, `contributionPoint`, and nested `leaderPc` level/ID/job/hero fields. `userAdventureLevelInfo` is optional and is not fabricated.
- The same parser reads `familia` name/description, god/style/substyle, approval, contribution points, active/subactive time, `latestGuildRaidRank`, `latestGvgRank`, `latestGvgLeagueId`, plus root boolean `sentRequest`. Zero competition ranks explicitly render `-`.
- `0x1b3e4e8:0x1b3ea00` reads optional `familia.bgmId` and `backgroundImageId`, with native default paths when zero. Saved selections use the same validated original shop ownership as the home screen.

Exact read-only extraction artifacts: `.work/familia-public-detail-exact-20261006.txt`, `.work/familia-public-callback-exact-20261006.txt`, `.work/familia-public-ui-exact-20261006.txt`, `.work/familia-public-parsers-exact-20261006.txt`. All headless jobs exited zero; extraction is not gameplay verification.

## Implementation boundaries

Only the actual saved single-owner local group can be viewed. Its real settings, contributions/bank/skill points, themes and owner are reused from the existing Familia projection. Party 1 / slot 1 and original EXP/job/growth metadata determine the leader, not an invented level or peer. Native int32 display counters must fit before delivery; invalid values are rejected, not clamped or overwritten.

This local group has no guild-raid or GvG participation, so its three competition-result fields are zero, not fabricated ranks or publisher history. `sentRequest` is false because no remote recruitment request was created. This does not implement recruitment, remote membership or co-op.

Viewing details does not credit a page-login day, grant rewards, alter native profiles/tokens/signatures, or settle operations. It uses existing indexed private state and the normal atomic sequence/reply cache; there is no new schema or lifetime reward-history scan.

An exact cached reply is returned only when it still equals the current saved projection. Changed members/settings/themes/balances and disbanded/recreated groups require a fresh request through cancellation `3000999`; old details cannot restore an old snapshot. Missing/foreign groups also cancel without fake empty-list success or data erasure. Malformed requests and corrupt saved fields reject without changing the save.

`familia/achievement/get` is separate: wrapper `0x2373930:0x2373d54` sends `targetEventId`, with GVE-specific consumer strings. It is not aliased to the existing ordinary `achievement/familia/get`. Its source-only read projection is implemented below; co-op battle scores and earned rewards remain unfinished.

## Familia settings request durability — source only, NOT RUN

`familia/manage/change/info` and `familia/manage/change/god` now share a
permanent actual-body request ledger. Every real mutation increments the
current Familia's monotonic settings revision and captures the exact validated
before/after settings, route, membership generation, timestamp, rolling history
commitment and native success response. Indexed latest/previous links plus the
rolling commitment lead to the exact current settings without scanning every
historical edit; previous names remain bound to actual local history. Valid
repeated no-op requests retain a receipt at the current revision without
fabricating another change.

An exact historical retry after cache eviction, restart or later settings
changes returns its original success only; it never reapplies the old name,
god, style, times or approval flag. Status and details reads validate the
indexed revision head and its immediate history link. Actual request bytes, rather than the supplied hash
header, own identity. Missing history, corrupt responses, changed bodies,
dissolution/recreation and legacy generic caches without a receipt refuse while
retaining current settings. Deferred rollback, cache-loss, restart, forged
header, later-change, legacy-cache and generation cases are written in
`test_familia.cjs`; none have run.

## Familia shop request durability — source only, NOT RUN

`familia/shop/item/buy` and `familia/shop/item/set` now persist a permanent
request receipt in the same transaction as their bank/ownership or theme
mutation, sequence and reply. The receipt binds the actual decrypted body,
route, current Familia creation identity, original product type/reward/price,
mutation timestamp and exact response. A purchase retry after generic cache
loss or restart returns its historical `valis` and `purchasedProduct` bytes
without spending again, while validating that every captured owned product is
still a matching original purchase. Later unrelated purchases do not erase
that proof.

A theme retry additionally requires that the exact background/BGM, monotonic
setting revision and original timestamp remain current. A later same-type selection makes the older
request stale, so replay cannot silently restore an obsolete theme. Changed
body bytes cannot be redirected through a forged body-hash header, recreated
membership cannot inherit old shop receipts, and corrupt or legacy unreceipted
caches refuse without changing purchases, the Familia bank or current themes.
Deferred cache-loss, restart, forged-header, later-selection, rollback and
legacy-cache cases are written in `test_familia.cjs`; none have run.

## Familia home-progress cache integrity — source only, NOT RUN

`familia/skill/get` now uses the same current-state projection as the growth
path. Cached replies are byte-compared against the current membership,
validated contiguous original skill levels, authored cost/time receipts and
remaining skill points. An upgrade, point change, membership transition or
damaged saved row makes an older snapshot unavailable without deleting learned
skills. Actual received request bytes own cache identity, keeping the valid
null and `{}` wrapper forms distinct even if a body-hash header is forged.
Deferred stable, creation, post-growth and wrapper-conflict cases are written
in `test_familia_skills.cjs`; none have run.

`familia/skill/growth` additionally persists a permanent request receipt bound
to the actual body, Familia generation, requested skill and exact post-upgrade
response. An unchanged retry survives generic cache loss and restart without a
second point debit. Changed bodies, recreated membership, missing learned rows,
later skill/point state and damaged receipts recover without undoing the saved
upgrade. Legacy cached growth responses without this identity are retained but
not replayed. Deferred cache-loss, forged-hash and later-level invalidation
cases are written only.

Explicit `familia/mystatus {is_login:true}` packets now retain a permanent
actual-body request receipt containing the current Familia creation identity,
the original UTC+9 visit when one was eligible and the exact response. A retry
after generic cache loss rebuilds the full current mystatus response and must
match that generation, response and occurrence; it cannot record a later day.
A request made before membership or before its join time remains
side-effect-free forever. Recreated membership, changed bodies, corrupt visit
history and older cached login replies without this proof recover without
erasing retained visits.

Read-only mystatus cache replay now compares the complete current response as
well, covering membership, roles, settings, balances, shop selections and
first-reward eligibility rather than only a few membership fields. Deferred
cache-loss, pre-membership and forged-header cases are written and unexecuted.

`achievement/familia/add` now permanently binds every accepted record-type 401
request identity to the MD5 of its actual decrypted body, its original UTC+9
day and the canonical retained occurrence timestamp. An exact retry therefore
survives generic reply-cache loss, restart and later clock selection without
creating a second occurrence on a different day. Changed bodies/routes,
missing or altered occurrences and legacy cached successes without a durable
receipt refuse without deleting the recorded activity. Fresh receipt,
occurrence, sequence and reply persistence share the existing transaction.

The ordinary `achievement/familia/get` route now shares one response builder
between fresh requests and cached replay. Every retained response must still
match the current validated local membership, contribution-derived level,
lifetime observed home-login count, active original daily rows and current
UTC+9 visit/stamina occurrences. Creation, disbanding, contribution changes,
new activity or an event-clock window change therefore cancels an obsolete
snapshot without altering the stored observations. Missing or corrupt legacy
progress remains unavailable rather than being replaced with zero.

Replay lookup and persistence use the MD5 of the decrypted request bytes
actually received, not the caller-supplied body-hash header. Deferred cases in
`test_familia_achievements.cjs` cover unchanged replay, a forged header, stale
no-membership state after creation and a newly observed visit; none have run.
This does not add cooperative members, reward grants or publisher history, and
native screen behavior remains unverified.

## Name and filter searches

`familia/search/name` and `familia/search/option` now have real source handlers and are **partial**, not native-accepted. The same frozen wrapper `0x1b5c4a8:0x1b5ca3c` sends `{name:string}` or an object with optional `style` and `requireApproval`. Raw instructions `0x1b5c5e8..0x1b5c608` construct numeric style IDs `21000001..21000005` from selectors 1..5; this immediate is not a Ghidra-biased address. Approval selector zero omits the field, one sends false, two sends true. Unfiltered option requests are `{}`, not null; the name route does not accept option fields.

Transport vtable raw `0x412cf78 + 0x30` resolves to `0x1b60028:0x1b60214`, which schedules vtable `0x412cfe8 + 0x30` / `0x1b6036c:0x1b6041c`. The latter uses mode zero of parser `0x1b59570:0x1b5a020`, consuming root `familias`, then list UI `0x1b562c8:0x1b56580`. Each result contains nested `familia` ID/name/description/god/style/substyle/approval/contribution, `master.name` and int32 `memberCount`. The list parser itself does not remove the local owner's row. Exact completed read-only artifacts: `.work/familia-search-wrapper-exact-20261006.txt`, `.work/familia-search-callback-exact-20261006.txt`, `.work/familia-search-consumers-exact-20261006.txt` (its search-form decompile failed and is not contract evidence), `.work/familia-search-list-ui-exact-20261006.txt` and the full, correctly bounded `.work/familia-random-list-full-20261003.txt`.

Search reads the actual saved single-owner group using existing indexed state and shared settings/counter/shop validation. Its owner name is the actual owned `UserInfo` name; member count is one. There are no synthetic neighbours, joins, rewards, native profile writes, operation acknowledgements or page-login credits. A missing local group or a genuine filter mismatch produces an empty list; unknown saved remote membership and corrupt data remain unavailable without erasure.

Explicit **offline search policy**, not recovered publisher matching: names use literal case-sensitive substring matching, including Unicode; an empty name matches the current local group. Option filters match either original primary or secondary style and require the approval boolean to match when supplied; omitted filters are unrestricted. Event-clock changes preserve this actual membership rather than fabricate historical groups. Recommendations still do not advertise the player's own group. Remote discovery and recruitment remain unsupported, co-op last.

Cached search replies must equal the current projection. Creation after an empty reply, renaming/settings/owner changes that alter the result, disbanding or recreation require a fresh request through cancellation `3000999`; an old result cannot restore an old row. No schema, master-data or player-save migration is introduced.

## Deferred acceptance

Run `node tools/test_familia.cjs`, `node tools/test_familia_break.cjs` and `python tools/test_client_routes.py` in the consolidated batch, with existing Familia/save/recovery/Android/launcher regressions. Added cases cover exact required shape, ownership/leader validation, read-only save/queue behavior, original settings/themes, reply/sequence rollback, unchanged restart replay and stale snapshots after changes/disband/recreation.

Then verify the natural MuMu member/detail screen, row/portrait rendering, default and purchased themes/audio, optional Adventure Level display, back/cancel/re-entry, signed save order and no crash/loading loop/ANR. Source-only fields and written deferred assertions are not a working-screen claim.

The same deferred `test_familia.cjs` now covers search shapes, all five original styles, primary/secondary and approval combinations, Unicode/literal/case/empty-name policies, malformed/foreign/corrupt preservation, unchanged profile/queue/login-day state, failed-reply sequence rollback, unchanged restart replay, owner renaming and disband/recreation. Native search form availability, both controls, empty-state and result-row rendering, row-to-details navigation, cancel/back/re-entry, signatures/save order and no crash/freeze/ANR remain queued. No tests, listener restarts, APK builds/installs or emulator interactions were performed for these handlers.

## Familia event mission query follow-up — source only, NOT RUN

The remaining no-handler routes are in the final co-op/peer group. This
follow-up starts that group without claiming that the partial solo features
or this mission flow have passed final acceptance. Testing remains deferred
until packet implementation is finished; no workers or GitHub Actions.

Original `2373930:2373d54` sends exactly `{targetEventId:int64}`. Its callback
chain is `2374b7c:2374e7c` then `2374ffc:2375568`. The latter consumes
`achievements.obtained` and `achievements.not_obtained`. Exact row reader
`2373fc8:237447c` consumes only these three wire fields:

```json
{"achievementId":8000000045,"currentParam":1,"updatedAt":1596283200}
```

This is a shape example, not a recovered publisher response. `achievementId`
and `updatedAt` are native int64; `currentParam` is imported as int32. The
reader resolves the ID in `familiaAchievement`, then reads
the original long goal (slot7), name (slot5), expiry (slot12), and reward
type/key/quantity (slots13..15). It does not read a synthetic signature, reward
description, daily_achievements array or ordinary UserAchievement row.

Read-only original extraction artifacts:
`.work/gve-familia-event-mission-wrappers-exact-20261007.txt`,
`.work/gve-event-mission-callbacks-exact-20261007.txt`,
`.work/gve-event-mission-consumers-exact-20261007.txt` and
`.work/familia-event-mission-row-parser-exact-20261007.txt`.
Their headless processes completed before the outputs were read. This is
client-code extraction, not a functional or static acceptance check.

The existing decoder now exports all269 `familiaMissionAchievements` and23
`gveInformationIds`, separately from the unchanged nine-row daily export.
The new master has162 original sources. Original names, goals, reward keys,
quantities, event IDs and dates are retained; unknown slots are not assigned
new gameplay semantics. No original archive or binary was modified.

The handler requires actual owned, saved/ACKed local Familia creation. For
target0 it projects current Japanese-day page visits (301) and native stamina
occurrences (401) from the existing indexed private receipts, respecting
membership/occurrence dates. One actual member contributes at most1; authored
daily goals are5..25, not changed into one-member rewards. Native updatedAt
uses that observed occurrence timestamp, or0 when untouched. Merely opening
the list does not record a login, grant a reward or modify native profiles.

Original nonzero type-201 event targets now project the acknowledged best score
of the one actual local Familia member. This is an explicit offline solo policy,
not recovered publisher group aggregation. It is consistent with the existing
one-member GVE summary and Familia ranking projections. A nonempty score is
accepted only when the saved record exactly matches its indexed settled
checkpoint, the completion is ACKed for the current Familia generation, no
result remains pending, and the exact acknowledged best-party capture, native
party and indexed best pointer agree. Missing or conflicting history stays
retained and unavailable; no lost score is reconstructed as0.

The full int64 `eventHighScore` determines eligibility. Only the response's
int32 `currentParam` is clamped, and `updatedAt` is the acknowledged best-result
capture time. The time must fall inside the original mission window and current
membership. An acknowledged zero result without a historical party projects0.
Type-101 earning remains unavailable because its test label does not establish
a trustworthy condition.

Authored type-201 reward publication is now **SOURCE ONLY / NOT RUN**. A fresh
request whose exact acknowledged local GVE best crosses one or more active
thresholds records those IDs in `familia_mission_claim` and emits one aggregate
native type-6000 reward. `UserAchievement` stays empty because this wrapper has
no native personal-achievement rows; the separate source-bound reward ledger
pins event, current Familia generation, GVE operation, full score, completion
time, claim IDs, original catalog/source hash and the signed operation. Exact
pending retries replay that operation instead of minting another reward.

The original type-201 rewards currently resolve to Iris, Valis, Gacha Tickets,
Key Items and Hero Sublimate items. Iris is credited once in the server wallet.
Every item reuses the shared operation-6000 cumulative, dated-ticket, capped-
stock, Valis-floor, partial-save, cold-recovery and ACK custody paths. The server
does not precredit native profiles. A settled reward remains permanently
claimed; missing or changed source score, best party, Familia generation,
catalog hash, queue/done state, item receipt or operation refuses with all
evidence retained.

The later Valis rows begin above the maximum score one original bounded battle
can contribute for their selector0 events. They therefore remain source-handled
but naturally unreachable under the current one-real-member aggregation policy;
the server does not invent peer scores merely to exercise or award them.

The final archived catalog still has 259 type-201 rows explicitly titled
"Familia Members / Total earned score," one type-101 "Test Mission" goal 10,
and nine type-301/401 daily rows. The type-201 goal is a group total, so using
the one actual offline member's best score is explicit solo policy rather than
publisher multi-member parity. Type-101 earning remains unavailable. Daily
goals 5..25 remain unreachable from one real member and do not manufacture
members or rewards. Unknown IDs, missing/corrupt catalogs and foreign/unsaved
membership reject.

Exact cached replies must still equal the current projection; actual activity,
day/clock windows or membership changes require a fresh request via3000999.
Below a threshold only the existing atomic sequence/reply machinery writes.
Threshold publication adds the two private indexed reward/claim ledgers in the
same transaction as wallet credit, item captures, operation queue and reply.
Original guild stage IDs are indexed once from master metadata, and legacy
completion checks use the existing stage-ID primary key, not a lifetime scan.
No native migration, fake ACK or extra member is added.

New `test_familia_event_achievements.cjs` and extended
`test_gve_completion.cjs` cases are written but **DEFERRED / NOT RUN**.
It covers original catalog counts/joins, wire shapes, saved membership, daily
observations/timestamps, stale/unchanged replay, reply/meta rollback,
restart/day boundaries, untouched event missions, retained unknown native
history and missing/unsupported catalog conditions. The GVE fixture uses an
original event with type-201 missions and now also specifies one-threshold Iris
publication, multi-threshold aggregate rewards, missing item profiles,
transaction rollback, exact cached/pending/restart replay, native inventory-
first partial saves, cold recovery, final ACK, int64 eligibility/int32 display
clamping and corrupted provenance refusal. These cases are written only.
Original-master equality, source compatibility, reward delivery in the frozen
client, multi-member aggregation, native list/notification/rendering,
callback/signatures/back recovery and no-crash/freeze/ANR acceptance remain
pending. `guild_event/status/log` was also traced as a log retrieval packet,
not stamina consumption; no handler or fabricated empty log is claimed here.

## GVE-backed Familia mission progress — source only, NOT RUN

Wrapper `0x2373930` sends `{targetEventId}` and parser `0x2374ffc` separates
`achievements.obtained` from `achievements.not_obtained`; row parser
`0x2373fc8` consumes only ID, current progress and update time. No distinct
Familia-event reward-claim route was found, so crossing the threshold is an
automatic claim handoff rather than a later claim packet.

The progress half is deliberately strict. Settled local GVE state supplies real
progress only after exact record, Familia generation,
operation ACK, immutable best-result capture, party capture, native party and
party-floor agreement. Full score is used for authored int64 goals while the
display field is clamped to the client's int32 import width. The timestamp is
the acknowledged best completion, not request time or the event clock.

The automatic type-201 reward half now uses the persistent source/claim ledgers
and shared exact type-6000 delivery/ACK receipts described above. A reached row
moves to `obtained` only in the transaction that queues that signed reward;
partial native item saves suppress only their already observed item effects,
and final ACK requires every captured inventory target. Type-101 and multi-
member daily earning remain unavailable rather than guessed. Deferred cases are
written only; no test, build, listener, APK or emulator action has been run for
this work.
## Familia event log, daily-score and summary follow-up — source only, NOT RUN

Three further packets have partial source handlers; these are genuine untouched
local-group views, not completed battles or recovered publisher score arithmetic.

- `guild_event/status/log`: original `23757c4:2375bdc` sends
  `{gveId:int64,count:int32}`. `2375f14:23763a0` reads root `logs`, not a stamina
  debit. Earned rows require actual user/name/leader, attack timestamp, original
  GVE stage ID, totalDamage/finalScore and two high-score booleans.
- `guild_event/score/user/daily/get`: original `1a1ccb4:1a1d0d4` sends `{gveId}`.
  Caller `1a1cbf0:1a1ccb4` binds vtable `40d23b8`; slot30 resolves to
  `1a21530:1a218c4`, which consumes int64 root `score`. This does not establish
  publisher accumulation, reset or reward arithmetic.
- `gve/summary/get`: original `145ee1c:145f0bc` sends `{gveId}`. Callback
  `1469ac4:1469ca4`, then `1469ddc:1469eb0`, calls actual parser
  `1464838:1464edc`. It consumes `summary.familiaScore` (int64),
  `summary.userRank` (int32), and a `ranking` array. No synthetic peers are added.

The shared guard requires actual settled local membership, the original23 event
IDs and original stage identities, and validates current settings/ownership.
Only untouched native records/high-score parties, no pending operations and no
original mode19/20 stage receipts can return `logs:[]`, `score:0`, or
`summary:{familiaScore:0,userRank:0},ranking:[]`. Nonempty, malformed or unknown
earned history cancels with the save retained—even on exact cached requests.
The same history guard now protects event missions. Count accepts the native
nonnegative int32 range; zero does not bypass the history guard.

Reads use existing profile storage and indexed stage receipts. There is no new
schema, log backfill, player write, operation, ACK, stamina reset/debit, wallet
credit or reward. Event-clock selection does not manufacture participation or
active-event permissions. Earned views, daily reset/rewards, score aggregation,
ranking and multi-member participation remain unfinished.

The original operation registry also exposes a client roadblock: pointer
`432a008` binds operation23000 to `246f5bc:246f6bc`, named
`DomainAdventureRepository::processGvEStageCompletion`. Its body asserts
`Error: No implementation`; it does not parse results or call generic completion.
No23000 is emitted. Exact endpoint/producer binding and a real client result
implementation still need work; generic5000 is not claimed as its replacement.

Read-only artifacts: `.work/gve-result-operation23000-exact-20261007.txt`,
`.work/gve-summary-consumer-stamina-20261007.txt`,
`.work/gve-summary-json-parser-correct-20261007.txt` and
`.work/gve-daily-score-ui-consumer-20261007.txt`. The first body in
`.work/gve-summary-parser-daily-producer-20261007.txt` is explicitly invalid:
an address subtraction error placed it inside an unrelated UI function. It is
not contract evidence. Native GuildEventStaminas reader `27a8e64:27a92b4`
reads `userId/staminas/lastResetAt`; nearby `280d16c` is ShootingInfo, not stamina.

Deferred assertions extend `test_familia_event_achievements.cjs`: exact response
shapes and bounds, saved membership, untouched replay/read-only behavior,
rollback, retained unknown history and stale cache. Run these and all existing
save/recovery/Familia/clock/launcher checks only after packet implementation is
finished, followed by natural native screens/back/save/no-crash-ANR acceptance.
No functional/static checks, builds, installs, listener restarts or emulator work
were performed. No workers or GitHub Actions were used.

## Familia union preferences follow-up — source only, NOT RUN

`familia/union/setting` now has a partial durable local handler. Original wrapper
`251dc48:251e174` sends exactly `familiaId:int64`, `status:int32` and
`condition:int32`. The transport callback reaches `2524aac:2524d0c`, which copies
the two requested preferences on success; it does not create or join a union.
Original submitter `1b20300:1b20520` also consults calendar predicate `2525764`.
The selector enums and calendar-lock windows are not yet recovered.

Only an actual saved/ACKed local Familia owner can change these preferences.
Two small private SQLite tables retain the current choice and permanent request
receipt, keyed to the actual Familia creation operation. They commit with the
existing sequence/reply transaction. Unchanged retries can survive cache eviction
and restart; old requests cannot overwrite a later choice or a recreated group
that reused Familia ID1. Previous generation rows remain retained separately.
No native player profile, signature, wallet, award operation or ACK is written.

Original parser `251b54c` reads union metadata only if all six fields exist:
`unionStatus`, `unionCondition`, `unionResult`, `unionWithFamiliaName`,
`unionRegisteredAt`, `unionTimeDuring`. The last two are time fields. Current
Familia projections include both saved preferences and genuinely unmatched
result/name/time defaults (`0`, empty string, `0`, `0`); no matching group,
participant, registration time or enrollment permission is invented. Shared
cached Familia replies cancel if membership, settings, balances or this bundle
changed, retaining current state rather than restoring an old snapshot.

Nonnegative int32 preferences are deliberately stored opaquely. This is an
offline storage boundary, **not** proof of publisher enum validity, calendar
eligibility or completed matching. New `test_familia_union_setting.cjs` is
written, **DEFERRED / NOT RUN**, covering request bounds, actual owner/creation
ACK, atomic rollback, no native precredit, replay/cache/restart and disband/recreate
generations. Its integer fixtures do not establish legal native selector values.
Native selector/callback/save/re-entry/back/recovery/stability remains unverified.

## Familia battle result mapping correction — extraction only

The earlier operation23000 assertion is specific to that old handler, not proof
that all Familia event results are unusable. Original registry mappings also bind
operation23100 to `246f6bc:2470234`, a working GVE score/`userGvERecord`/
`gainedItems` reader, and23200 to `2470534:2470ac8`, a working GuildRaid
stage/loop/boss/rank/last-battle/training/damage/record/reward-exists reader.
Both clear stage/battle state.23200 does not directly consume `gainedItems`.

The shared original GVE completion producer also assembles `gveStageId` and
`userGvEScore` with totalDamage/maxDamage/actionCount/defeat/turnCount telemetry.
GuildRaid preinitiation callback `218f3f8:218f734` compares the returned
`guildRaidStageId` and `loopCount` to the actual selected native context before
updating its repository. Original content contains43 raid events,957 stages and
19 defeat-reward definitions. Their existence does not establish an implemented
server battle/reward flow or publisher score formula.

Exact endpoint-to-operation binding, complete request/party and boss row shapes,
original scoring, attempts, earned records/loops and separate defeat claims remain
unfinished. No23100/23200 result, reward or generic5000 replacement is emitted by
these unsupported completion routes. The exploratory filename
`.work/guild-raid-result23100-exact-20261007.txt` is explicitly annotated as GVE,
not a GuildRaid binding. Other extraction artifacts include
`.work/guild-raid-result23200-exact-20261007.txt`,
`.work/guild-raid-entry-callbacks-and-state-20261007.txt`,
`.work/familia-union-setting-callback-exact-20261007.txt`,
`.work/familia-union-setting-result-and-lock-exact-20261007.txt` and
`.work/familia-union-setting-submit-exact-20261007.txt`.

This follow-up performed source edits and read-only original-client extraction
only. All functional/static acceptance checks, builds, installs, listener restarts
and emulator work remain deferred until packet implementation is finished.

## GVE historical player details — source only, NOT RUN

`gve/player_info/get` now has a partial source handler for an actual local
player's saved historical GVE party. Wrapper `1463cd4:1464184` sends exactly
`gveId:int64` and `targetUserId:int64`. Its callback vtable `3f52930`, slot30,
resolves to `146a964:146ace4`, which invokes shared public-profile parser
`24cd18c` and GVE cache importer `236f5d4:236f7cc`. The latter reads only
root `gveParty`; no `gveRecord` root is consumed by this callback. The response
therefore has `code`, `playerInfo` and `gveParty`, without invented adventure data.

JSON party reader `27d49d8:27d52dc` and MessagePack `2809804:280a00c` agree on
`userId`, `gveId`, `slots`, `memoriaSlots` and `familiaPc`. Familia data is a
`skillIds` vector read by `286314c:28632ac` and `28636b8:2863824`, not a borrowed
character. The handler preserves the actual historical PC/guest/null-slot and
Memoria snapshots through the existing historical party validators. Familia
skill IDs must resolve to original `familiaSkill.pcSkillId` values. Current
equipped units, inventory and Familia upgrades do not reconstruct old battles.

Actual saved/ACKed local Familia membership, the local requested user, an owned
nonzero earned record and one saved high-score party for that event are required.
Pending23000/23100 results, unknown or missing history, duplicate selected rows,
foreign ownership, malformed snapshots or invalid public profile cancel through
3000999 with saves retained. No party or zero-score fallback is manufactured.
The current public profile can change independently of the historical party;
cached replies must equal both current projections before replay. Both native
GVE record and high-score-party merge identities are now explicitly `gveId`.

Record JSON reader `27d42f8:27d49d8` confirms the ten fields already recovered
from MessagePack: `userId`, `gveId`, `score` (int32), `eventHighScore`,
`dailyHighScore`, `lastResetScoreAt`, `gveHighScoreStageId`,
`isReceiveFamiliaRankingReward` (boolean), `scoreInt64` and
`lastReceivedDailyRewardAt` (all other numeric fields int64). Shape/range gates
retain these saved values; they do not establish publisher score accumulation,
daily-reset arithmetic or stage-to-party earning provenance.

Further battle extraction confirms rate getter `16aaba8:16aacfc` returns
float32. The shared producer at `217cc34..217cde4` assembles `gveStageId` and
`userGvEScore` with int32 totalDamage/maxDamage/actionCount/turnCount and boolean
defeat, followed by four-field `leaderPc`. The current original export has144
mode20 stages and no authored objectives for them. These observations clarify
the next result implementation but are **not** an implemented completion:
`gve/stage/complete` and `guild_event/stage/complete` remain unsupported, and no
23100 operation, invented score, reward, stamina change or native ACK is issued.

Read-only artifacts are `.work/gve-earned-record-and-dispatch-20261007.txt`,
`.work/gve-player-info-wrapper-exact-20261007.txt`,
`.work/gve-player-info-result-party-exact-20261007.txt` and
`.work/gve-player-info-envelope-skill-exact-20261007.txt`. The162-source master
and original binary/archive are unchanged. No new SQLite schema is needed.

New `test_gve_player_info.cjs` is written, **DEFERRED / NOT RUN**. It checks
synthetic imported history, exact roots, saved membership, unchanged snapshots,
current-team independence, malformed/foreign/duplicate data retention, stale
profile/party caches, transaction rollback and restart/disband. Actual earning,
stage/score-party provenance, original slot/skill selection limits, remote users,
callback signatures and native rendering/back/save/recovery/stability/performance
still require implementation or later acceptance. No checks, builds, installs,
listener restarts, emulator interaction, workers or GitHub Actions were run.

## Modern Familia battle completion — source only, NOT RUN

`guild_event/stage/complete` now partially handles original adventure mode20
through the working GVE operation23100. This supersedes earlier no-result-handler
statements for that route only. Mode19 `gve/stage/complete` still cannot safely
emit the original23000 assertion and remains unsupported; no generic5000 alias.

The original master export now contains165 sources:23 event/adventure windows,
179 GVE stages (144 modern),21 turn-bonus rows and150 action-bonus rows. GVE
slot9 is int32, not int64; slots5/8 remain original floats. Modern stage ordinary
rewards/XP are zero and there are no authored objectives. These original values
are preserved with archive hashes, without assigning unknown publisher meanings.

`offline-gve-v1` is explicitly an offline reconstruction, not recovered publisher
arithmetic. It uses float32 damage/coefficient products, a turn interval and the
original action table. The archive carries two identical rows for every
selector-100001 action threshold; the scorer collapses only byte-equivalent
duplicates and refuses conflicting values. Ninety later stages instead use
selector0, for which the original table has no rows; that authored sentinel
applies the neutral action multiplier1 rather than making those events
unplayable. The current run uses scoreInt64/score (int32 display clamping); the
highest earned battle score is retained separately in eventHighScore/
dailyHighScore. This does not implement publisher accumulation or daily reset.
Raw window6..7 admission is
an offline policy with the original start-inclusive/end-exclusive boundary;
exact pending retries retain their original result at or after expiry.
Unrecovered loot/CP/guest/skip/secret branches cancel without synthetic rewards.

The existing SQLite transaction now captures stage/token/body identity, actual
saved Familia creation generation, telemetry, exact native result/record,
pre-clear state and the owned leader/name at result issue. It queues23100 without
prewriting native records, party, clear, flags, stamina, signatures or currency.
Shared stage delivery observes record-first and clear-first saves. Full ACK
requires both the unique actual counter/date clear and exact earned native
UserGvERecord. Split saves retain the queue, suppress unsafe replay on push and
survive restart; cold partial redelivery still recovers instead of reapplying.

Only full ACK publishes indexed gve_record and the existing stage-state floor.
Native deletion/rewind/unearned record replacement, conflicting request bodies,
duplicate completed delivery and attribution to a recreated Familia are rejected.
The shared table reader also checks settled/pending GVE record floors, so fresh
and cached save/pull replies cannot publish a missing or rewound earned record.
Unknown imported earnings remain retained and unavailable. Earned logs and the
daily-score read use acknowledged indexed receipts and the exact settled native
record; captured leader/name are historical rather than today's party/profile.
Logs are bounded to1000 rows. Earned summary/ranking rows still cancel rather
than returning an invented empty board. High-score party earning is not added.

New `test_gve_completion.cjs` and updated master assertions are written,
**DEFERRED / NOT RUN**. Its source fixtures cover both selector0 and the
duplicated selector100001 action curve. Later group Valis thresholds remain
unreachable by one member's original bounded battle score and are not
fabricated. Original scoring/rounding, daily reset/accumulation,
attempts/stamina, missions/rewards, high-score party provenance, peer aggregation,
native callback/save/signature/render/back/recovery/no-crash-ANR/performance remain
unfinished or unverified. No tests, static acceptance checks, builds, installs,
listener restarts, emulator work, workers or GitHub Actions were performed.

## Earned GVE summary and Familia ranking — source only, NOT RUN

`gve/ranking/user/familia/get` now has a partial handler, and `gve/summary/get`
can project the acknowledged local best result. This supersedes the earlier
earned-summary cancellation only for original, captured, settled modern results;
unknown legacy earnings remain retained and unavailable.

Wrapper `146344c:14636d4` sends exactly `gveId:int64`. Vtable `3f52730`, slot30,
resolves to `1469f34`; its nested callback at `3f527a0`, slot30, resolves to
`146a24c`, which invokes `1464fa0:1465348`. That importer consumes only root
`ranking` while retaining the existing summary fields. It and the original
summary reader `1464838:1464edc` agree on each row:

```json
{"rank":1,"score":1234,"user":{"id":1000000001,"pcId":100000001,"name":"captured name"},"familia":{"name":"current local Familia"}}
```

The numbers above illustrate the wire shape, not authored scores or units.
`rank` and `pcId` are int32; `score` and `user.id` are int64. The summary adds
`summary.familiaScore` and `summary.userRank`; the Familia ranking response does
not add an unused summary or Record Buster-style playerInfo root.

Both reads require actual saved/ACKed membership, the original event, matching
Familia creation generation and exact settled native/private GVE record. A new
partial SQLite index finds the acknowledged qualifying-best battle matching
eventHighScore and stage. Its captured leader/name survive lower/zero runs and
current-team changes. A positive tied best selects the latest qualifying captured
stage/name/leader, following the native inclusive comparison.
Missing/corrupt/unacknowledged history or unknown portrait identities
cancel instead of fabricating a best team. Pending23000/selected23100 results,
changed records and former-Familia history also retain their recovery gates.

The explicit solo-offline projection has one real positive-score member at rank1;
familiaScore is that member's retained best battle score. This is not recovered
publisher contribution totals, aggregation or global ranking. Genuine untouched
or acknowledged zero-earned-history has no ranked rows; a later zero run retains
its real earlier best. Missing legacy history is never reconstructed as zero.
Shared cached-view revalidation rejects changed highs or
Familia identity/settings and preserves unchanged best projections after lower
repeats. Reads do not award/reset scores, stamina, flags, rewards or native parties.

The native row importer copies/extends an existing ranking vector. Actual first
summary/Familia-tab transitions, repeated fetch/list refresh/dedup/pagination and
callback/UI ordering are not verified. Full high-score party earning/details,
character usage, peer history and original resets/rewards remain unfinished.
Character callback `146a710` separately passes root ranking to `14603c0`, whose
viewer reads `normal`/`assist`; that is not evidence of earned character usage.

Read-only extraction artifacts are `.work/gve-familia-ranking-wrapper-exact-20261007.txt`,
`.work/gve-familia-ranking-callback-and-party-exact-20261007.txt`,
`.work/gve-familia-ranking-native-consumers-exact-20261007.txt` and
`.work/gve-familia-and-character-ranking-row-parsers-exact-20261007.txt`.
The expanded24abce8 party tail in the combined artifact is explicitly not used as
GVE active-party evidence. Original cached Ghidra project changes were discarded.

## GVE character ranking — partial source only, NOT RUN

`gve/ranking/character/get` now accepts exactly `{gveId}`. Original wrapper
`1464184:1464528`, request callback `146a3e8` and nested callback `146a710`
lead to viewer `14603c0`. The viewer reads `ranking.normal` and `ranking.assist`;
exact parser `146071c:1460864` reads only `rank:int32` and `pcId:int32` from
each row. It does not consume usage counts, percentages or a public profile.

The handler reuses the saved historical party reader shared with player details.
Both now require the original high-score stage/event join. An existing private
settled record must also match the saved native record, acknowledged operation
and current Familia creation generation. Original owned positive records,
unique actual historical parties, validated guest/null PCs, Memoria and Familia
skills remain required. Missing, corrupt, foreign, duplicate or pending history
recovers with the save retained; it is not rebuilt from today's equipped team.

Explicit offline policy: the one actual local historical party contributes one
usage for each distinct nonzero PC in its normal/assist category. All present
units consequently tie at rank1, with deterministic PC-ID ordering. Familia
skill IDs are not fabricated assist PCs. A truly untouched Familia can return
empty vectors only after the existing no-earned-history/no-queued-result gate.
This supports imported native history, not publisher-wide character popularity
or proof of an original result-to-best-party earning contract. New modern results
without an actual full high-score snapshot remain unavailable. A genuinely
acknowledged zero-earned-history without a best party now returns actual empty
vectors using the shared settled Familia-board guards. A pending or unknown
zero record cannot bypass those guards.

Cached reads revalidate the historical identity lists and membership. Changed
unit usage cannot restore an older list; unrelated current profile/name/team
changes do not rewrite the historical projection. Reads issue no operation,
party, score, currency, stamina, flag, signature or reward writes.

`test_gve_player_info.cjs` is extended for these source-only paths and shared
guards, **DEFERRED / NOT RUN**. Full best-party capture/save ordering, publisher
usage/tie/peer aggregation and natural ranking callbacks, tabs, portrait art,
signed saves, back/recovery/no-crash-ANR/performance remain unfinished/unverified.
Evidence: `.work/gve-character-rows-record-offsets-exact-20261007.txt`; the cached
Ghidra project was read-only. No tests, builds, installs, listener restarts,
emulator sessions, workers or GitHub Actions were run.

## Native GVE best-party qualification — source fix, NOT RUN

The original operation23100 handler `246f6bc` imports UserGvERecord, then
compares its encrypted scoreInt64 at `+1a0`: positive and `>=` dailyHighScore
at `+b8`. It passes that flag to result setter `2470234`, offset `+68`, with
isRecorded at `+69`. Result consumer `14514a4:145160c` requires both flags,
obtains the battle party through `24abff0` and invokes `236f998:236fb00`.
That repository creates a missing high-score party through
`237a7f0:237ab0c`, or updates an existing party through
`237ab0c:237b090`. The party is copied by the client, not supplied as an extra
operation root or manufactured from server-side current-unit stats.

Record-field literals were rechecked directly: `35a084a` is
gveHighScoreStageId, not eventHighScore; `35a087e` is eventHighScore.
`35a08ab` is lastReceivedDailyRewardAt, whose setter `286b994` writes `+170`.
`359ef48` is scoreInt64, whose setter `286ba74` writes `+1a0`; initialization
with finalScore therefore initializes scoreInt64, not a reward timestamp.
`35a085e` maps to dailyHighScore and setter `286b614` writes `+b8`.

The former response returned the retained best in scoreInt64, so a lower
battle still qualified for copying its party over the best. The shared
`gveResultRecord` builder now keeps current scoreInt64/score separate from the
retained event/daily highs. Positive higher/tied runs update the high-stage
identity and qualification receipts; lower and zero runs do not qualify.
The existing `is_new_high`/`is_daily_high` private flags now mean inclusive
positive qualification, not strictly greater. Daily-reset history with
different event/daily highs is still unavailable rather than guessed.

Issuing and shared stage delivery/save/ACK/retry use that same canonical
record transformation. Inconsistent older lower/tie captures retain their
queued results and recover; they are not silently rewritten or redelivered.
Every changed lower current-score record must save, as must the actual clear,
before ACK. Ranking/summary projections use retained eventHighScore and the
indexed qualifying capture, so the last lower/zero score cannot replace the
best board. Genuine acknowledged zero-earned-history can show empty character
ranking without fabricating a full party.

`test_gve_completion.cjs` is extended for zero-history, current-versus-best
fields, lower-run record save, retained legacy capture and inclusive tie cases,
**DEFERRED / NOT RUN**. Full immutable high-score party capture/ACK publication,
native selection/freshness, daily reset and publisher scoring/aggregation remain
unfinished. The expanded special-party tail in the `24abff0` decompile is not
used as proof of a saved active-party field or default-party contract.

Evidence: `.work/gve-best-party-create-update-exact-20261007.txt`,
`.work/gve-best-party-result-handoff-exact-20261007.txt`, corrected field notes in
`.work/gve-character-rows-record-offsets-exact-20261007.txt` and the original
23100 result artifact. All extraction was read-only against the original ELF;
no tests, builds, installs, listener/emulator sessions, workers or Actions ran.

`test_gve_completion.cjs` is extended, **DEFERRED / NOT RUN**. No tests, static
acceptance checks, builds, installs, listener restarts, emulator work, workers or
GitHub Actions were performed. Native save/signature/render/back/recovery/stability
and performance remain pending for the final batch.

## GVE result-to-party identity binding — implementation only

Bounded original `24abff0:24ac0c4` reads the encrypted UserInfo field `+4b8`,
whose JSON writer maps it to `activeGvEPartyId` (`358a145`). The similarly named
`activeGuildEventPartyId` is `+5f8` (`358a1e8`); the common leader producer uses
ordinary `activePartyId` at `+48`. These fields are not interchangeable. The
static seed happens to give parties500/900 the same initial units, which would
hide the wrong field in an undifferentiated fixture.

New modern results now capture the actual selected party ID, all six normal /
assist identity slots and all three Memoria identity slots in indexed private
`gve_party_selection`, atomically with the existing result/queue/reply. Issue
requires original identities, actual ownership and selected slot1 matching the
request leader. Canonical delivery/ACK/retry requires the retained selection;
an exact retry does not recapture today's team. Missing/corrupt older selections
retain their receipts and recover; no backfill from today's party is invented.

The shared acknowledged qualifying-best reader now validates that capture for
summary/Familia ranking and details/character ranking. For locally earned history,
the actual historical native party must match the captured normal/assist/Memoria
identities, including every selected nonzero position. Imported history without
a private result floor retains its existing read-only validation. No PC stats,
equipment, skill selection, hidden flags or full snapshots are reconstructed.

This is still partial: immutable full-snapshot observation/publication, unchanged
snapshot dirty behavior and pre/post-ACK UI-copy ordering are not established.
`2371f34:23723d4` and `24bc940:24bcacc` were extracted read-only for that next step;
the latter appears at Ghidra display `025bc940`, not raw `25bc940`. Deferred checks
cover differing selection fields, retained retry/missing capture and mismatched
historical party retention, but have **NOT RUN**. All175 native acceptances remain
pending. Evidence: `.work/gve-active-party-offsets-20261007.txt` and
`.work/gve-party-dirty-contract-exact-20261007.txt`. No tests, checks, builds,
installs, listener/emulator sessions, workers or GitHub Actions ran.

## Observed native GVE full-party persistence — partial, NOT RUN

The original DomainOtherPC vtable at raw `42ad9b0`, slot `+198`, resolves
`23788c0:2378f68`. The best-party slot updater uses this full copy for normal /
assist PCs, including native stats and equipment ability vectors. Its constructor
`23770f0:2377198` invokes the same copy for an existing non-null native PC.
Memoria copying uses `24f8154:24f81f4`. No server-generated full stats are added.

Slot-number setter `286ed04:286ede0` only marks a dirty change when the encrypted
value differs. Weapon / armour vector clear routines `2869108:28691ec` and
`2869750:2869834` append deletion identities only for existing elements. These
reads do **not** establish that every unchanged qualifying party sends a fresh
dirty row. UI-copy, recursive dirty propagation and ACK ordering still need
completion and later native acceptance; missing observations are not backfilled.

An actual `UserGvEHighScoreParty` put while its qualifying23100 is queued now
binds the complete merged native snapshot to that receipt and captured selection.
Private `gve_party_capture` freezes the full JSON; indexed `gve_party_floor`
points to the latest observed event snapshot. These writes, native profile/token,
stage observation, queue/ACK, request/reply and sequence use the existing atomic
save transaction. First party-only saves count as an observed effect for replay
suppression, even before record/clear saves; restart does not lose that proof.

The full snapshot must preserve the current Familia generation and selected
identities. Rewriting the same capture, deleting or replacing an observed party
without a new qualifying queued result, and lower / zero replacement are rejected
with data retained. Native read guards check the complete snapshot, not identities
alone. Earned player/character details additionally require the actual immutable
capture for the acknowledged qualifying-best receipt; today's team/stats cannot
substitute. Imported history without a private result floor retains its existing
read-only path.

This deliberately does not require an unproven pre-ACK copy order. ACK still uses
the actual clear and exact native record; an unobserved full party cannot publish
earned details. Copy-after-ACK and genuinely unchanged omitted-row cases remain
unfinished, not manufactured as fresh observations. `test_gve_completion.cjs` is
extended for actual-row snapshot/floor/observation, rollback, split save/restart,
ACK-only detail publication, full-stat/identity tampering, lower-result protection
and an actual same-value tied-result put; **NONE RUN**. All175 native acceptances
remain pending. Evidence: `.work/gve-party-copy-dirty-setters-exact-20261008.txt`,
`.work/gve-party-field-copy-exact-20261008.txt` and
`.work/gve-party-vector-dirty-exact-20261008.txt`. No tests/static acceptance
checks/builds/installs/listener/emulator sessions/workers/Actions ran.

## GVE post-ACK copy and unchanged-party dirty marker — source only, NOT RUN

This supersedes the earlier source-only copy-after-ACK limitation above. A real
full `UserGvEHighScoreParty` put after clear/record ACK can now bind to the unique
indexed acknowledged qualifying-best receipt in the current Familia generation.
Its exact settled record and clear floors, original captured selection and
canonical result are required; a new result cannot start until the previous
qualifying best has its actual immutable full-party save. Exact pending retries
retain their own receipt. Late copies of already issued results remain admissible
after the original event window expires, without admitting a new expired battle.

The late snapshot/floor and `party` observation use the existing atomic native
save transaction. They do not create a new operation, clear, score, reward or ACK.
Malformed/missing/ambiguous proof retains history and recovers. All result readers
reuse the canonical `gveResultSelection` and indexed `bestGveCapture` helpers;
no full stats or party observations are inferred from today's units.

The ARM64 patcher source now redirects **only** battle-party slot-copy call
`2371f70` to a guarded32-byte thunk in the original unused span
`153f050:153f070`. It calls the real encrypted SlotNumber setter, then marks
that slot dirty even when its number is unchanged. The shared setter equality
branch `286ed64` and JSON/MsgPack import callers are unchanged. Original dirty
slot writers serialize both PCs fully; the GVE root writer serializes all slots,
FamiliaPC and Memoria slots fully. No qualification, score, save-signature or
purchase-authentication predicate is patched. Evidence is retained in
`.work/gve-copy-marker-scoped-20261008.txt` and the two original slot-writer
extractions named there. The patcher was **not executed** and no native binary
or APK was patched, built, signed or installed.

Deferred source checks cover post-ACK save after restart/expiry, late-capture
transaction rollback, blocked next battle before actual copy, no additive
redelivery/new queue and exact native patch spans/caller/setter preservation.
**NONE RUN.** Recursive root dirty collection, actual UI/hot/cold save/ACK order,
unchanged-team repeats, signatures/render/recovery/no-crash/ANR/performance and
all175 native acceptances remain pending. No tests, static acceptance checks,
builds, installs, listener/emulator sessions, workers or Actions ran.

## GVE Familia top / nearby / member rankings — partial source only, NOT RUN

Three previously unsupported packets now have source handlers:
`guild_event/ranking/familia/top/get`,
`guild_event/ranking/familia/around/get` and
`guild_event/ranking/familia/get`. Original wrappers
`237cd6c:237d134`, `237d2e4:237d6ac` and `237d6ac:237da88` send exactly
`{gveId:int64}`. Top/around callbacks `237e860` / `237ef10` consume
`belongsFamilia:boolean` plus root `ranking`; row factory `237dca8` reads
`{rank:int32,score:int64,familia:{id:int64,name,godId:int32}}`.

The member callback `237f5c0` has a different response:
`member_daily_ranking`, `member_total_ranking` and
`familia_score_rank:{rank:int32,score:int64}`. Both member vectors use `237e268`,
reading `{userId:int64,userName,rank:int32,score:int64,
leaderPc:{pcId:int32,jobRank:int32}}`. Optional nullable `adventureLevelId`
defaults0 in the original consumer; no unobserved historical level is invented.
The ELF data-segment VA/file-offset difference is applied when locating callback
vtables. Exact extraction and field evidence is retained in
`.work/gve-familia-ranking-fields-20261008.txt`; an earlier scratch extraction
using flat data offsets is explicitly excluded as callback evidence.

The handlers reuse the settled native/private GVE record, current saved Familia
creation generation, pending-result exclusion, actual best ACK and indexed
canonical selection/name/leader capture. Actual current Familia name and original
god ID supply the group row; `belongsFamilia` is true only after saved membership
passes the existing gate. Untouched or genuinely acknowledged zero history has
empty scored vectors. Positive daily/event best scores produce one actual local
member/group at rank1. This is explicit solo-offline policy, **not** recovered
publisher totals/contribution/global ranking, resets, cutoffs, rewards or peers.
Unknown/corrupt/foreign/unacknowledged history stays retained and unavailable.

A genuinely untouched unaffiliated player may view top/around with
`belongsFamilia:false` and no invented group rows; the member-only packet still
requires actual saved membership. These public empty views retain the original
event-ID and no-unknown-history guards. After actual saved creation, their cached
false membership must recover instead of overwriting the current true state.

Existing cached-view revalidation and request/reply/sequence transactions are
reused. Changed score/Familia name/god cannot replay an old group board; unchanged
member-only/lower-best projections remain reusable. No schema migration or native
profile/party/score/wallet/flag writes, new operations, rewards or authentication
changes are introduced. Co-op and peer battle work remains last.

`test_gve_completion.cjs` now contains deferred cases for all three exact formats,
required shapes, missing membership, untouched/zero/pending/earned/lower/tied
history, high/name/god caches, invalid leader/missing ACK, reply rollback,
unchanged native rows and restart. **NONE RUN.** Actual native tab transitions,
refresh-vector clearing/deduplication, sentinel/optional-level/name/art/score-width
rendering, natural earning/save/signature/callback/back/recovery and
no-crash/ANR/performance remain pending with all175 native acceptances. No tests,
static acceptance checks, builds, installs, listener/emulator sessions, workers
or GitHub Actions ran.

## Event-isolated GVE history — source follow-up, NOT RUN

The old untouched-history guard rejected all nonempty GVE record/party vectors
and every pending operation, regardless of the queried event. Consequently a
saved battle in eventA prevented zero/empty views for genuinely untouched eventB.
The shared guard now uses the selected original GVE event/stage join and existing
indexed `stage_completion` receipts. It validates saved record/party vectors,
then checks only that event's record, party, clear and known pending stage deltas.
An imported native clear (state/counters/dates) without a receipt is still history;
it cannot silently become a zero board after a missing record. Original stage
catalog completeness, duplicate/foreign/malformed vectors and unproven zero rows
remain unavailable with data retained.

The same scoped path is used for summary, user/Familia/character rankings, daily
score, logs and untouched event-mission views. `pendingGveResult` is shared by
result admission, settled reads and player-details gating. An acknowledged party
for eventA may be read while a known eventB result is saving; same-event results
must still settle. Opaque/malformed/unknown23100 and unimplemented legacy23000
cannot be safely scoped and retain their global recovery gate. Unaffiliated
top/around empty views also keep the stricter whole-history guard. Cached replies
are revalidated against the requested projection: eventB earning invalidates
eventB's old empty view, not eventA's unchanged history.

No schema migration, native score/party/profile/wallet/flag/reset/grant changes or
guessed historical backfill is introduced. The native stage blob is scanned to
detect orphaned imported clears; indexing is deferred unless final acceptance
shows a measured bottleneck. Earned mission rewards, publisher resets/aggregates
and peer behavior are still unfinished.

The existing deferred GVE check now contains independent-event empty/mission
views while another event is saved or pending; imported clear/orphaned receipt/
zero row/party/opaque result/selected generic delta retention; unrelated ordinary
delta independence; cached empty recovery; and two distinct original modern
events with synthetic native full-party/record/clear puts, ACK, independent saved
parties/scores/wallets, date movement and restart. **NONE RUN.** Actual original
client event-clock/menu/party-copy/save/signature/callback/render/back/recovery,
no-crash/ANR and performance remain pending with all175 native acceptances.

Separate read-only original archive extraction identifies seven mode19
weekday-named Familia Missions, sharing permanent-start adventure671900001
(`window6=1523498400`, `window7=0`), not modern finite events. First three rows have
slot6 bytes1/2/3 alongside Mon/Tue/Wed labels, slot4 episodes7190000101/102/103
and raw slots7/8/9=5/23/5. Exact runtime weekday/attempt semantics and dedicated
client compatibility for the unimplemented23000 handler still require work.
`gve/stage/complete` remains unsupported; no23000, generic5000 or modern23100
alias is emitted for this route. Source changes and extraction only: no tests,
static acceptance checks, builds, installs, listener/emulator sessions, workers
or Actions ran.

## Familia raid status — source-only partial fresh lobby, NOT RUN

`guild_raid/status/get` now has a source handler. This is a fresh, actual solo
Familia lobby, not a complete raid or recovered publisher service. Request
`1567948:1567c00` sends exactly `guildRaidInformationId:int64`. Correct raw vtable
slots `3fa0f30 ->15734c8` and `3fa10a0 ->1573c34` lead to availability
`156cb3c:156cd14`, status `156ceb0:156d43c`, UI `156d43c:156eed0`, repository
`23ab614:23ab7bc` and model `23a9ef0:23aa260`. Ghidra display addresses are raw
plus100000; the unrelated24ab58c/24ab7a8 exploratory bodies are annotated and
are not raid contract evidence.

Exact wire roots are `available`, `guildRaidStageId`, `loopCount`,
`bosses:[{enemyIndex,hp}]`, `rank`, `ranking`, `defeatCount`,
`defeatRewardExists`, `displayDefeatStageId`, `displayDefeatLoopCount`, and
`lastBattleInfo:{logType}`. `logType` is not `type`. Native model23a9ef0 imports
both enemyIndex and HP as int32, while UI156d43c reads HP and sums it as int64.
Its authored maximum HP comes from five `guildRaidStage` slots8..12, indexed0..4.

Original extraction adds43 `guildRaidEvents` and957 `guildRaidStages` to the
167-source master export, joining authored type22 adventure windows and native
stage identities. Names, dates and five HP quantities are unchanged. Selector
columns retain raw slot names: slots2/3 are int32; slot4 is int64 (43 nonempty
rows), not int32. S1's first stage58300000001 retains HP1584000/1584000/3168000;
absent boss slots3/4 are omitted, not assigned an enemy or guessed HP.

Explicit **offline fresh-lobby policy**: actual owned local creation must have
saved/ACKed, the event clock must be within its authored active window and not
before membership, and the first selector1/1/no-link stage must be unique. It
returns that original stage at loop1, full authored HP, no ranked players,
defeats, pending reward or last battle. This is not proof of publisher admission,
selector/tier progression, attempt limits, training, reset or loop scaling rules.

Original stage receipts use indexed lookups. Native clear counts/dates/state,
raid records, readDefeatCount, unknown/foreign raid state, active raid battle and
pending23200/raid-native/selected-stage deltas prevent a fresh projection. Data
is retained; no historical HP, rank, defeat or score is replaced by zero. Exact
cached replies re-read clock, membership, original catalog and saved history.
The shared existing profile/operation/reply transaction machinery is reused;
no schema migration, server-native profile/counter/wallet/party/flag/reset/attempt
write, result, reward, ACK or peer is manufactured by this packet. The native
stage blob scan is deliberate; index owned rows only if later measured slow.

`test_guild_raid_status.cjs` is written, **DEFERRED / NOT RUN**: all original
initial seasons/HP/root shapes; malformed/unknown IDs; membership/ACK/windows;
read-only profiles/queue/wallet; retained corrupt/earned/active/pending/imported
clear/orphaned receipts; stale cache/catalog changes; reply/meta rollback,
restart and expiry. The master check's source count is updated but not executed.
Native availability/modal/first entry/boss art/HP/loop/rank/no-last-battle display,
repository import/native saves/signatures/cold reload/back/cancel/recovery,
performance and no-crash/freeze/ANR all remain pending.

Raid completion, attempts/training, damage and loop settlement,
earned rankings/details/logs, defeat rewards and peer participation remain
unsupported. No23200 or generic completion replacement is emitted. Read-only
extraction and source implementation only; no tests/static acceptance, builds,
installs, listener/emulator sessions, workers or Actions ran.

## Familia raid preinitiation — source-only partial entry, NOT RUN

`guild_raid/status/preinitiation` now has an initial solo entry handler. Original
wrapper2174e48:21752f0 sends exactly `guildRaidInformationId:int64`; it does not
send a party, stage, loop or training flag. Callback218f3f8:218f734 compares the
returned `guildRaidStageId` and `loopCount` against its private selected context
before importing23ab614, or refreshes/reselects when they differ. Its training
byte is private callback context, not evidence of a request field.

The existing fresh status/catalog/window/history guards are shared. Actual
`UserInfo.activeGuildRaidPartyId` must select one owned `UserParty`, with six
valid original normal/assist identities and three Memoria selections. Selected
units must actually be owned and joined; cards reuse the existing native
Memoria validator, preserving initializer owner0 rather than rewriting it.
Missing selection is unavailable, never replaced with a guessed default party.

Two additive indexed private tables capture the current original catalog,
unchanged status and canonical party identity selection, plus the actual
encrypted-wire request receipt. They bind to the acknowledged local Familia
creation generation and commit with existing sequence/reply transaction. No
native profile, party, counter, attempt, damage, score, reward, wallet, result
operation or ACK is manufactured. Fresh untouched re-selection can replace an
entry; active/earned/pending history remains blocked by the shared status guard.

Exact transport replay requires the same generation, entry capture, current
party, catalog/window and retained history. It survives cache eviction and
restart without reviving an old group or recapturing corrupt/missing metadata.
An entry dated after the rewound clock cannot be replayed. Native membership,
party and history are retained when recovery cancels3000999.

This is explicit offline initial admission, not publisher eligibility,
attempt/training/tier/reset rules. Party capture currently freezes identities,
not full historical combat stats. Result23200 production/damage/loop settlement,
native record/save/ACK proof, earned rankings/logs, defeat rewards and peers
remain unfinished. The existing deferred raid check is extended in source for
selection/ownership/owner0, durable replay/cache/restart/generation conflicts,
history/catalog/window guards and private-entry/request/meta/reply rollback.
**NONE RUN**. Native chosen-stage matching, battle entry/import/signatures/save,
cold return/back/recovery/render/performance/no-crash/freeze/ANR wait until all
packet implementation is finished. No test/static acceptance, build, install,
listener/emulator session, workers or Actions ran.

## Saved raid-damage codec — source-only packet work, NOT RUN

The shared `user_data/push` and actual native profile reads now validate the
saved raid score using original2672784:2672e24 and2673e6c:267404c. Its root is
`userGuildRaidScore:{guildRaidStageId:int64,enemyDamage:[...]}`. The enemy-row
writer is **raw28769d0:2876cac**, not the biased29769d0 address. Each row has
exactly six fields: `encounterNumber`, `enemyPartyId`, `enemyIndex`, `domesticHp`
and `damage` are int32; `enemyId` is int64. The per-character battleLog writer's
similarly named `enemyDamage` scalar is not this saved raid payload.

Saved signed fields, vector order and repeated observations are preserved.
Positive raid-stage IDs must join the original type22 stage/event catalog; the
zero-stage default requires an empty vector. Missing/foreign/malformed fields,
wrong widths, unsafe long values and deleting the singleton reject or cancel
with native data retained. Local and native initializer owner0 remain valid;
no owner, damage or HP normalization is performed. An inactive stageId0 or
changed event clock does not erase an otherwise valid retained raid score.

The existing SQLite profile/token/save-time/sequence/reply transaction is used;
there is no new schema, HP/score/counter mutation, reward, result or ACK. This is
codec support, not proof of original encounter/enemy joins, duplicate/overkill
or overflow semantics, attempt/training rules or combat validity. Full23200
damage/loop/score/native record/reward/save-ACK settlement still needs its
producer. Result2470bc8 publishes a local DomainGuildRaidRecord event; it does
not by itself prove the native record fields or earning rules.

Deferred source fixtures cover exact widths/roots, active saved combat,
retained finished-stage payloads, ordered/signed observations, restart/expiry,
catalog/corrupt read rejection and atomic failed-save rollback with unchanged
wallet, queue and entry receipts. Synthetic enemy IDs are width probes only,
not authored enemy data or native gameplay evidence. **NONE RUN**. Native signed
save/resume/import/order/back/recovery/render/performance/no-crash/freeze/ANR,
plus shared ordinary stage/guest/CP/save/pull/cache regressions, wait until all
packets are implemented. No tests/static acceptance/build/install/listener/
emulator/workers/Actions ran.

## Saved raid-record codec — source-only packet work, NOT RUN

`UserGuildRaidRecord` now uses the same guarded native read/save path as raid
damage. Original JSON import27d7f9c:27d83ec, MsgPack import280c3e8:280c728 and
writer2751464:2751734 agree on exactly six fields: `userId`, `guildRaidId`,
`lastSpRecoveryAt` and `scoreInt64` are int64; `score` and `spRecoveryCount` are
signed int32. Constructor2883a64:2883bf4 starts all six at0. Initializer owner0
and the actual local owner are retained; an existing record cannot change owner.
Positive event IDs must join original type22 metadata, independently of the
current event clock. There is no signature field, damage-total substitution,
invented recovery limit, score floor, reset or score/legacy-int conversion.

The generic identity inference already chooses guildRaidId for valid unique
rows. Its duplicate-ID fallback could instead replace the entire vector.
Explicit event identity plus duplicate rejection now keeps unrelated event
records when a delta puts/deletes only one event. Existing profile/token,
save-time/sequence/reply transactions are reused; no native SQL migration,
server precredit, reward, operation or ACK is added. Invalid saved fields remain
stored and cause cancellation; they are not silently repaired or replaced.

Deferred source fixtures cover two original event IDs, partial puts/deletes,
signed int32 and safe-int64 widths, duplicate/malformed/unknown/foreign/changed
owner rejection, cold/corrupt reads, event-clock retention and atomic reply
rollback with unchanged wallet/queue/entry receipts. **NONE RUN**. This is a
codec, not scoring, battle validity, SP recovery or earned settlement support.
The shared completion callback2477e3c's optional `stageInfo` is a union-raid
model keyed by unionRaidStageId; it is **not** a guild-raid record update.
The23200 event is not a native score-record update. Subsequent read-only tracing
found achievement consumers2125824,2125cac and2126134; the event byte is
`isTraining`, not `defeatNow`, and all three skip training. Native record setters
are called by JSON/MsgPack import, so scored settlement still needs a separate
server record delivery/import path.

Exact read-only artifacts: `.work/guild-raid-record-json-msgpack-and-status-20261008.txt`,
`.work/guild-raid-record-constructor-exact-20261008.txt`,
`.work/guild-raid-player-and-completion-callbacks-20261008.txt` and
`.work/guild-raid-party-mode-and-stage-info-20261008.txt`.

## Familia raid player details — source-only partial snapshot read, NOT RUN

`guild_raid/player_info/get` now handles the actual local player only. Original
wrapper23a6f5c:23a7304 sends exactly `{userId:int64}`, without an event ID.
Callback23a8b6c:23a9098 imports shared playerInfo24cd18c and party24b2f88 in
mode4. The latter first reads root `party`, parsed by27d7628:27d7f9c as
UserOtherParty: userId, partyType, index, slots, attackPattern, partyStrength,
memoriaSlots. Optional userAdventureLevelInfo is not fabricated; its literal
is raw3336919, not3436919.

The handler returns `{code:0,playerInfo,party}` only for exactly one actual
stored local mode4 UserOtherParty combat snapshot, using the existing full
competitive-party validator. It preserves the snapshot, including full unit,
equipment, command/hidden and Memoria fields; selected UserParty IDs are not
combat stats. It does not borrow UserPvPParty, compute a current team, create a
missing cache row or manufacture peer/history data. No battle capture producer
is added by this read route: a normal fresh save without a snapshot remains
unavailable until that producer is implemented.

Malformed requests reject; remote, missing, duplicate or corrupt snapshots
cancel3000999 with stored data retained. Exact cached replies rebuild the
current profile/snapshot and cancel when either changed. The event clock does
not rewrite an existing public snapshot, and the native request contains no
event date. No profile/wallet/queue write or new schema is required beyond
existing atomic sequence/reply metadata.

Deferred source fixtures cover exact roots, snapshot passthrough, missing or
duplicate/foreign/wrong-mode/corrupt parties, rejected remote IDs and malformed
requests, profile drift/stale cache, restart/date retention and reply rollback.
The synthetic full-unit vector probes field widths, **not** native capture or
stat parity. **NONE RUN**. Original snapshot production, actual UI/import/save
signatures/order, hot/cold recovery/back and no-crash/freeze/ANR remain pending.
Raid completion23200, attempts/training, damage/loops/score/record settlement,
rankings/logs/defeat rewards and peers remain unfinished. Read-only extraction
and source edits only; no tests/static acceptance/build/install/listener/
emulator/workers/Actions ran.

## Familia raid training completion — source-only partial packet, NOT RUN

`guild_raid/stage/complete` now has a bounded unranked training branch, not a
generic5000 replacement. The complete original request producer217bd08:218492c,
case22, adds guildRaidStageId:int64, loopCount:int32, exactly five ordered
bosses `{enemyIndex:0..4,damage:int32}` and an explicit isTraining boolean.
Counter getter1f0ccec:1f0cd88 returns the individual indexed counter or0; these
are neither remaining boss HP nor the saved six-field enemyDamage observations.
Only nontraining requests call battleLog producer21854bc. Common adventureRecord
fields are normalAttackCount, skillCount, specialSkillCount, linkageSkillCount,
deathCount, continueCount and turnCount. Optional loot, CP, guest, objectives
and skip result producers are still unavailable and explicitly cancel.

The handler requires the actual acknowledged local Familia generation, original
first-stage/loop1 catalog, active event window, durable original entry and same
selected owned party, active native UserAdventureState.stageId, and a valid
non-rewound native stage baseline. It retains the entry/catalog/party capture,
original request, native stage/battle/record/defeat-state baselines and permanent
actual encrypted-wire request identity in indexed private SQLite rows. The
existing queue, transport/reply transaction and stage_completion receipt are
reused. No native stage, record, inventory, wallet or signature is precredited.

Native23200 at2470534 consumes the original result roots and calls2451924 to
clear the actual stage and266f7b4 to reset stageId to0, even for training. The
source emits23200 with the summed raw int32 counters in totalDamage:int64;
unchanged authored boss HP, loop and rank; no recorded score, defeat or reward;
and lastBattleInfo.logType0. Awarded score0 and isRecorded:false are explicit
offline unranked policy, not recovered publisher scoring or an authored score
formula. Scored attempts, damage clipping/overkill, loop advancement, record
imports, achievement emissions, rankings, battle logs and defeat prizes are
not implemented by this branch. Negative/wrapped counters cancel rather than
being clamped into invented damage. Identity-only party capture is not frozen
combat-stat proof.

Shared delivery/save/ACK handling now includes23200. A real native stage clear
and battle stageId0 must both be saved before ACK; the original score payload,
local owner, raid record and defeat state must remain unchanged. Split saves
are observed durably. A partially applied result is suppressed on save replies
and cancelled on other redispatches, preventing another additive clear. Cold
pending delivery uses the original capture; conflicting requests/tokens,
missing or corrupt captures, former-Familia history and settled transport
replay cancel3000999 without replacement or a second result.

Lobby/entry reads permit an acknowledged training clear only when its original
completion/delivery receipts, Familia generation and exact latest counter
match the saved stage floor. Imported/unknown/scored history stays unavailable;
native counters are never reset to make another entry possible. An old training
receipt does not claim scored admission, attempts, recovery or peer semantics.

The existing deferred raid source check is extended for five-counter roots,
int32/int64 widths, invalid counter/index/HP substitution, nontraining rejection,
no native/wallet precredit, permanent replay, clear-plus-state0 ACK requirements,
split-save cold continuation and training lobby re-entry. **NONE RUN**. Native
unlocks/entry/requests/result UI/HP/totalDamage/signatures/order/hot-cold import,
save/ACK/back/cancellation/recovery and no-crash/freeze/ANR remain unverified.
No tests/static acceptance, builds, APK operations, listener restarts, emulator,
workers or Actions. Co-op/peers remain last.

Read-only evidence: `.work/guild-raid-completion-producer-and-event-consumers-20261008.txt`,
`.work/guild-raid-damage-counter-getter-20261008.txt`,
`.work/guild-raid-result23200-exact-20261007.txt` and
`.work/guild-raid-record-json-msgpack-and-status-20261008.txt`.

## Saved raid-attempt fields — source-only codec, NOT RUN

Native writer25eb7dc:25ec054 serializes `graidSP`, `consumedNormalSP` and
`recoveredGraidSP` as signed int32, and `graidSPLastResetAt` as int64.
The shared UserInfo read and user_data/push paths now enforce those widths
without changing their values, unrelated player status or current event date.
The existing SQLite profile/token/save-time/reply transaction is reused.
Missing/malformed or unsafe fields cancel with stored data retained; no schema,
reset, refill cap, attempt deduction, purchase, reward or server precredit is added.
`consumedNormalSP` is not a new raid-only timer or recovery field.

The existing deferred raid check contains width, token, atomic rejected-save,
reply rollback, cold retention, event-clock retention and corrupt-read cases.
**NONE RUN.** Scored raid completion, actual native attempts/recovery and record
delivery remain unfinished; native save/import/signature/UI/crash acceptance
waits until all packet implementation is finished. No tests, static acceptance,
builds, installs, listener restarts, emulator operations, workers or Actions.
Evidence: `.work/guild-raid-player-status-json-and-defeat-reader-20261008.txt`.

## Familia raid logs — source-only partial packet, NOT RUN

`guild_raid/status/log` now handles untouched and acknowledged unranked-training
history. Original1568434:15686d4 sends exactly `guildRaidInformationId:int64`;
there is no GVE ID or count. Raw vtable3fa1398+30 invokes1574ff0, which schedules
3fa1408+30 ->1575308 ->156b464:156bed8. The UI reads root `logs`. Nonempty rows
use `params.p2` to look up the original raid stage name, `params.p1:int64`,
`playerName`, optional `userId`, `attackedAt:int64` and `leaderPc` containing
pcId/jobRank/heroSublimateLevel:int32 and isUnlockedHeroSublimate:boolean.
The meaning of params.p1 is not inferred from similarly named GVE damage fields.

The handler reuses saved local membership, authored event-window/catalog and
native/private history guards. It returns `{code:0,logs:[]}` only when no scored
history needs settlement; proven training retains lastBattleInfo.logType0.
Active, pending, imported, malformed or earned history cancels with native data
retained, rather than becoming an empty successful history. Exact cached replies
revalidate the same state. There is no profile/record/flag/wallet write, operation,
reward, extra schema, guessed peer or manufactured training log.

The existing deferred raid source check now includes exact request/response,
cached empty views, corrupt history, active/pending rejection, all original
event windows, reply rollback and post-ACK training reads. **NONE RUN.** Scored
log production, publisher ordering/limits and earned history remain unfinished.
Actual native list/sentinel/render/callback/back/save/recovery and crash/ANR
acceptance waits until all packet implementation is finished.
Evidence: `.work/guild-raid-log-callback-exact-20261008.txt` and
`.work/guild-raid-log-reader-exact-20261008.txt`.

## Original raid defeat-reward catalog — extraction, not a reward claim

The master exporter now includes all19 original `guildRaidDefeatReward.enc`
definitions, bringing the original export to168 source tables. Native23aa998
and157412c both read `guildRaidDefeatReward:[{defeatRewardId,guildRaidStageId}]`,
look up defeatRewardId:int64, and consume five int32 item/amount pairs from
slots2..11. Positive pairs retain their original order and quantities; absent
pairs are ignored exactly as in the native readers. No event/tier eligibility,
reward frequency, historical claim or stage-to-reward assignment is invented.

Examples from the archive are reward58500000001's five large Power and five
large Armor falna, and58500000003's20 small Familia donation items plus five
large Ability falna. IDs and inventory classes come from the original catalogs,
not community reconstruction. The existing master source check is extended in
source only, **NOT RUN**. `guild_raid/reward/defeat` remains unsupported until
earned defeat eligibility and once-only native inventory/flag/save settlement
are implemented. No grant, wallet mutation, reward operation or ACK was issued.
No tests/static acceptance/build/install/listener/emulator/workers/Actions ran.

## Scored raid request decoding — source-only partial contract, NOT RUN

The shared raid completion parser now handles the original nontraining request
shape. It requires `battleLog` when `isTraining:false` and rejects it on training
requests. Full21854bc:2186640 appends PC objects through150b824, then appends
`["gauge",int64]` through150b6dc. The payload is a mixed array, not an object
with a gauge property and not the saved six-field enemy observations.

Each PC object has exactly these signed-int32 fields:
pcId, pcLv, assiId, assiLv, wpPerf, amPerf, str, int, agi, vit, luck, hp, mp,
physical, magic, defense, actCnt, spCnt and lsCnt. Its int64 fields are wpId,
wpAbi1..5, amId, amAbi1..5, pcDamage and enemyDamage. Equipment helper2186740
preserves64-bit IDs/abilities and32-bit performance; helper2186640 collects
ten stats, and the producer adds main/assist components before serialization.
These widths do not establish earned damage, score, ownership or frozen stats.
Safe integer values and row order are retained, with no normalization or guessed
relation to the five boss counters. Unsafe64-bit JSON numbers reject rather
than losing precision. The final gauge pair is required and never converted
to a score.

Well-formed scored requests now reach the explicit unfinished-settlement
cancellation instead of failing as malformed fields. Scoring, attempt debit,
recovery, boss damage/loop advancement, record updates and defeat eligibility
remain unfinished. No result, native precredit, schema change or synthetic
success is added. Existing training completion and private receipt validation
use the same parser. The deferred fixture source covers mixed-array shape,
signed widths, missing/extra fields, training/scored separation and unchanged
profile/queue/wallet on rejection. **NONE RUN.** All tests, static acceptance,
syntax checks, builds, installs, listener restarts and emulator runs remain
deferred until all packet implementation is finished.

Additional native binding evidence changes the record-delivery approach:
23210 maps to23aa998, the original defeat-reward operation;23200 itself does
not directly update UserGuildRaidRecord. Full20d2c08:20d2ec8 now establishes
the general JSON-response import path: it matches user_data/confirm, pull and
push to their special handlers; other object responses directly invoke20bd9f0.
That importer reads named `data` tables, maps their native keys through2730214,
uses the selected-table JSON importer27b84e8, and persists data/tokens in a
local transaction. Thus a stage response does have a named-table import path;
the earlier lack-of-caller-proof limitation is superseded by this extraction.
Ordering relative to23200 and native save/ACK still needs to be bound before
issuing scored replacements.

By contrast, confirm's20bb99c/20bbe1c path checks literal `serverCommand` at
raw34a3fed, **not** `data`. Commands2/3 invoke native save sender20c0d88 with
different flags; that function sends user_data/push, not a table pull. No new
server command or speculative record import is emitted. Factory23aa5fc calls
26ffc0c's append-only vector/map insertion, so it is not an existing-record
updater. Defeat wrapper1568080 sends only guildRaidInformationId:int64.

Evidence: `.work/guild-raid-damage-producer-and-result-setters-20261008.txt`,
`.work/guild-raid-score-log-and-record-import-20261008.txt`,
`.work/guild-raid-native-record-sync-20261008.txt` and
`.work/guild-raid-record-repository-storage-20261008.txt`; new caller evidence:
`.work/guild-raid-generic-response-and-reward-request-20261008.txt`.

## Raid initialization records and event-scoped admission — NOT RUN

Lobby, log, preinitiation and training completion no longer require an entirely
empty UserGuildRaidRecord table. A validated selected-event row whose score,
scoreInt64, spRecoveryCount and lastSpRecoveryAt are all0 is accepted unchanged,
matching the zero initialization in2883a64. Either the native initializer owner0
or the actual local owner is retained; no record is generated or rewritten.
Valid records from other original events are not mistaken for selected-event
earnings or deleted when the event clock changes. A nonzero selected score,
recovery count or recovery timestamp still requires earned-state settlement.
Malformed, duplicate, foreign or unknown-event rows continue to cancel.

Training completion privately captures the actual selected-event record and
keeps the same exact-record save/ACK guard, including cold continuation. Its
retained UserGuildRaidState may name another known original raid when its read
defeat count is0; training23200 does not change that state, so there is no reason
to retarget or erase it. Both issuance and receipt validation enforce the same
catalog/owner/zero-count rule. Existing native clear, stage floor, pending
operation, active battle and private history guards are unchanged. Zero record
fields alone are not proof that unknown historical clears were safe to reset.
Scored admission, score/attempt/recovery/loop settlement and earned prizes are
still unfinished.

The existing deferred raid fixture source now covers both initializer/local
owners, selected zero records with unrelated earned records, nonzero-field
rejection, read/entry retention and restart. Its written training case captures
the zero-owned selected record plus another event's record/state and requires
them to remain unchanged through split saves and ACK. **NONE RUN.** Source and
original-client extraction only; no tests, static acceptance, syntax checks,
builds, installs, listener restarts, emulator operations, workers or Actions.

## Original stage defeat-reward links — extraction, NOT a claim

Native1570edc:1570fd4 selects guildRaidStage rows through29b7740 and matches
their guildRaidInformationId at FBS6/slot1. Preview15704a0:15706e8 then reads
each stage's int64 defeatRewardId at FBS1e/slot13, deduplicates that ID and
looks up the original guildRaidDefeatReward through29b6684. The original
archive contains957 stage links to all19 reward definitions. Skipped stage
slot6 is not this link; its meaning remains unrecovered.

The exporter now retains those links as `guildRaidStageDefeatRewards`, reusing
the same decoded original stage rows and requiring each link's original reward
definition. They are deliberately separate from `guildRaidStages`, whose
existing projection remains unchanged so the new extraction does not alter
the stage catalogs hashed by prior training receipts. No native record, stage,
inventory, wallet, event state or reward flag is changed.

Original extraction completed with164 characters and168 source tables. The
existing master fixture source now includes stage-link coverage, the19 reward
targets, original examples and separation from the captured stage projection;
**NOT RUN**. The link identifies the authored reward, not whether a defeat was
earned, whether a claim is eligible, or how many loops/claims are available.
Scored settlement and once-only23210/native inventory/save/ACK handling remain
unfinished. No tests, static acceptance, syntax checks, builds, installs,
listener restarts, emulator operations, workers or Actions.

Evidence: `.work/guild-raid-defeat-reward-preview-binding-20261008.txt` and
`.work/guild-raid-reward-preview-stage-selection-20261008.txt`.

## Original raid attempts and training persistence — source only, NOT RUN

The native attempt getters now bind the original guildRaidInformation slots4,
5 and6 through25455e0,25451cc and2545468. All43 authored events contain dailySP2,
normalSPRecoveryLimit2 and normalSPCost100. The exporter reuses the same decoded
rows, exporting a separate `guildRaidAttemptRules` map without changing the
existing event/stage projections or their captured hashes. This is original
archive data, not a guessed refill cap or purchase rule.

Reset predicate2544e64 checks a later calendar day, plus the separate event-start
boundary: now>=adventure.window6 and lastReset<window6.25450bc replaces raid SP
with the event's daily value, clears consumedNormalSP/recoveredGraidSP and writes
now. It does not keep a higher stock as Record Buster's reset does. The server's
read-only projection uses the existing region5/JST calendar and never writes a
native reset. Battle entry2172598 calls2541b54->254522c only when1434c08's training
flag is false; the native mutation subtracts one and clamps the signed result
at0. The server must not predebit preinitiation or charge again on completion.

Ordinary completion246c564, when its authored recovery feature condition is
enabled, sends the original stage stamina cost (including its own multiplier
and skip count) to2541b5c. That adds to consumedNormalSP through254549c, then tests
2545594.2545418 takes the smaller of the native float32/truncated consumed/cost
quotient and the remaining event recovery limit.254525c adds that count to raid
SP, subtracts cost*count from consumedNormalSP and adds the count to
recoveredGraidSP. These are local player-status changes, not a new server
packet, purchase authorization or a fabricated10700 operation. This extraction
does not yet prove every ordinary-stage cost/condition/multiplier interleaving.

New preinitiation captures privately retain the actual four saved SP fields and
the original rules hash. They reuse the existing SQLite entry/wire/reply
transaction and leave profiles, tokens, wallets and operations unchanged.
Training completion validates the retained capture; its save/ACK path permits
either the unchanged baseline or the exact native daily/event reset with the
client's actual saved timestamp, not a server issue-time guess. Unexplained
attempt debits, additions or recovery-counter changes are rejected with saved
state retained. Unrelated UserInfo fields are not frozen. Old three-field
training captures retain their previous acceptance boundary, without backfill;
scored handling will require a fresh proven attempt baseline.

The existing master and raid fixture source is extended for original rules,
JST midnight/event start/rewind/high-stock/signed fields, capture/catalog/rule
changes, old entry replay, training debit/recovery rejection, split saves,
actual-reset observation and cold ACK. **NONE RUN.** Scored settlement, record
replacement/import ordering, loop transitions, earned logs/rankings and
once-only defeat claims remain unfinished. No tests, static acceptance, syntax
checks, builds, installs, listener restarts, emulator operations, workers or
Actions ran. Original extraction completed164 characters/168 source tables.

Evidence: `.work/guild-raid-player-attempt-reset-and-recovery-20261008.txt`,
`.work/guild-raid-player-attempt-mutations-and-caps-20261008.txt`,
`.work/guild-raid-attempt-original-cost-reset-and-wrapper-20261008.txt`, and
`.work/guild-raid-attempt-spend-and-normal-sp-producers-20261008.txt`.

## Scored raid completion and earned history — source only, NOT RUN

This source milestone supersedes the earlier fresh-only lobby, unsupported
scored-completion and empty-history limits above. It is not native acceptance.

Original `UserData.init`20baf70 registers its `GameServerResult` callback through
2088ea8 in the GameServer vector at+48.208a48c runs these bool callbacks before
20898c8 invokes the feature callback; failed imports stop the success path.
The callback20d2c08 reaches20bd9f0 named-table `data`/`dataTokens` import.
The latter uses27b84e8 and20c2ac8 with a native transaction. This is distinct
from the append-only raid-record factory. Original23200/2470534 clears the
stage named by its returned `guildRaidStageId`, so that result must retain the
stage fought even when the next lobby advances to another original stage.

The explicitly reconstructed `offline-guild-raid-v1` policy now settles scored
damage: score is HP actually removed, totalDamage is the unmodified sum of the
five request counters, and remaining HP is bounded at0. The selected native
record accumulates scoreInt64; its signed legacy score, owner and recovery
fields remain unchanged. This is not a recovered publisher scoring formula.
Defeat advances the original slot2/slot3 ordering and follows the authored
slot4 link at the final rotation. Loop count advances between rotations and
the linked repeat retains authored HP; publisher scaling remains unknown.
The battle result retains the fought stage/loop and defeated HP vector.

Fresh scored entry needs the existing captured four-field SP baseline and
original rule hash. Completion accepts the actual saved native subtract-one
state, including a proven native reset before that debit; it never charges
the server again. Later saves retain that post-debit snapshot or an exact
native daily/event reset. Missing legacy baselines do not become scored
captures. Full ordinary-SP recovery interleavings still need implementation.

One additive private scored-capture table and an event/generation/operation
index reuse the existing entry, permanent wire identity, queue, stage-delivery
and reply transactions. They capture the full before/target record vectors,
post-debit attempts, actual player name/original-growth display leader and
next status. Issuance does not prewrite native profiles, wallet or inventory.
Named record imports carry the exact full target vector and a stable token;
the same pending frame is available on hot retry, login, confirm and binary
pull. Confirm tokens expose the pending import rather than an older baseline.

The next native push can prove import by reporting that token, or by putting
the exact record vector. This is a client-reported import observation, not a
cryptographic attestation or proof that the native ordering has been tested.
Import alone does not suppress or acknowledge additive23200. Stage clear,
finished adventure state and import proof are required for ACK; the record,
stage floors, queue removal and reply commit together. Interrupted saves keep
their original receipts. Record checkpoints reject deletion/rewind without
altering unrelated original-event records. Only acknowledged scored captures
advance lobby HP/stage/loop/defeat state and create log rows. Both lastBattleInfo
and history use original `logType`, `playerName`, `attackedAt`, `params.p1/p2`
and the four-field leader; p1 is the explicit offline awarded score policy.
Practice remains unscored and does not manufacture earned log rows.

Deferred `test_guild_raid_scoring.cjs` covers43 event graphs, all original stage
transitions/final links, removed-HP versus raw damage, widths/overflow and
retained legacy/recovery fields. Existing raid fixture source adds observed
SP-shaped spending, damage/defeat, no precredit, wire replay, import-only and
split/cold ACK, earned status/logs and rewind rejection. **NONE RUN.**
Consolidated native acceptance must cover actual entry/reset/SP save timing,
battle/damage, import/hot/cold callbacks/signatures/save/ACK, clock changes,
back/recovery/UI/log/rotation/performance and no crash/freeze/ANR.

Defeat-reward23210 claims, ranking prizes, peer/co-op, publisher score/scaling
and complete ordinary-SP producer interleavings remain incomplete. Unknown
or imported histories remain retained, not reset into a fresh event. No tests,
syntax/static acceptance checks, builds, installs, listener restarts, emulator
operations, workers or Actions ran. The full-game goal remains active.

Evidence: `.work/raid-response-listener-registration-20261008.txt`,
`.work/raid-response-hook-ordering-20261008.txt`,
`.work/guild-raid-generic-response-and-reward-request-20261008.txt`,
`.work/guild-raid-native-record-sync-20261008.txt`,
`.work/guild-raid-result23200-exact-20261007.txt` and the original master data.

### Raid defeat rewards23210 — partial source implementation, NOT RUN

Original1568080 sends only `guildRaidInformationId:int64`. The hot reply and
operation23210 use `guildRaidDefeatReward`, with `defeatRewardId:int64` and
`guildRaidStageId:int64` per entry. Factory23aa998 grants the five authored
positive int32 item/amount pairs through25d3a5c; it does not accept a substitute
`gainedItems` root. All957 original stage links point into19 reward definitions,
whose40 nonzero pairs use the existing six ordinary inventory codecs.

Corrected address binding:157412c calls **raw25d9db4/25d9f48**, not the unrelated
26c9db4/26c9f48. The latter earlier extraction must not guide save-schema changes.
The actual bridge runs1574af4, whose1574c04 emits
`ArgoGlobalMenuUIState.RefreshHeaderEvent`. This refreshes the header; it is not
evidence of a `UserGuildRaidState.readDefeatCount` mutation or claim-state setter.

The source route collects only this Familia generation's own acknowledged,
scored23200 boss defeats. Training, unfinished results, imported history and
unknown peers do not generate rewards. One authored reward per acknowledged
offline boss defeat is an explicitly reconstructed policy, not recovered
publisher participation/frequency rules. Repeated final rotations keep their
separate earned defeats and exact authored item quantities.

Private source/hash/item receipts and unique per-defeat reservations retain
actual encrypted request identities and signed queue operations. Original
definitions are rechecked on delivery. Issuance does not change profiles,
inventory, wallet, records or native flags. Existing inventory acquisition
reservations include the new item producer; changed-item indexed floors retain
completed acquisitions. Partial native saves persist observations, reject
rewind and suppress additive redelivery on push; hot/cold retries after an
observed grant use controlled recovery instead of granting twice. ACK requires
all original item acquisitions before the existing transaction commits profile
deltas, observations, done state, queue removal and reply together.

Claim availability is derived from unreserved acknowledged defeats. Pending
claims block new raid entry/results and the existing all-operation disband guard
protects their Familia generation. ACK clears availability without clearing
defeat counts, earned score, stage/loop progress, logs or unrelated-event rows.
Clock rewind cannot create a fresh claim before its source defeat. Captured
pending rewards retain their original issuance window for replay. Native
counter-cap overflow is cancelled rather than truncated or precredited.

Deferred `test_guild_raid_rewards.cjs` covers original joins and quantities;
existing raid fixture adds no-precredit/retry/split-save/cold-recovery/ACK/rewind
source cases. **NONE RUN**, including syntax/static checks. The generator source
and checklist were edited only; no generator, server, test, build, packaging,
installation, listener restart, emulator, worker or Actions execution occurred.
The metadata tally is125 partial/50 unsupported known routes, zero accepted
feature-complete routes; this is implementation bookkeeping, not gameplay proof.

Publisher peer eligibility/frequency, native seen-marker transitions, ranking
prizes, normal-SP interleavings, signature/callback/save/UI/recovery/capacity
acceptance and co-op remain incomplete or unverified. Full-game goal remains
active. Additional read-only evidence:
`.work/guild-raid-player-status-json-and-defeat-reader-20261008.txt` and
`.work/guild-raid-defeat-corrected-callback-20261008.txt`.

### Native raid seen-state — source follow-up, NOT RUN

Raw1566f14 reads the singleton `UserGuildRaidState`: when the selected original
event differs, it calls28846f8 with the new `guildRaidId:int64`,28847d8 with
`readDefeatCount:int32=0`, then20c0d88 with `GuildRaidResetCount`. Raw15696ec reads
the UI's received `defeatCount` at+48c, uses the previous seen count for popup
text, writes that received count through28847d8 and pushes the same trigger.
15688c4 and its two native continuation wrappers reach that popup. These are
seen/display mutations, **not a reward-claim flag or a23210 factory effect**.
The protected setters mark the original singleton dirty when its value changes.

The shared source codec now admits the original owned three-field singleton
and nonnegative signed-int32 seen count. Zero is valid for initialization/event
reset; an event ID must be0 or a known original type22 event, and ID0 cannot
carry a positive count. Positive markers must be bounded by acknowledged
scored history for that original event. A new `(raid_id,operation_id)` index
supports the newest matching acknowledged receipt lookup; no global lifetime
SUM/MAX or native profile rewrite is added. Original typed status and explicit
offline scoring policy are rechecked; missing/corrupt source, unknown/imported
counts and foreign owners remain retained with controlled recovery.

This is player-wide UI state, so prior acknowledged Familia-generation history
can still support a retained marker after changing groups. It does not become
the new group's score, HP, claim or reward eligibility. Historical/coalesced
seen values are not forced into a fabricated monotonic reward ledger. Pending
battle saves preserve the captured marker, or the actual current-event marker
bounded by the entry's already acknowledged defeat count; a newly pending
defeat cannot acknowledge itself through this field.

Original-table read/push paths, completion captures, lobby/log/preinitiation and
training/scored delivery/save/ACK now reuse that checkpoint instead of requiring
`readDefeatCount=0`. Earlier zero-only descriptions are historical and superseded
for this branch.23210 keeps its independent unique acknowledged-defeat claims
and inventory proof. Seen/reset saves cannot grant items, clear claims, change
earned score/stage/loop/logs, refill attempts or credit/debit currency.

Deferred `test_guild_raid_seen_state.cjs` and extended raid source cases cover
codec/history bounds, pending versus acknowledged results, event/Familia
history, positive-marker entry/training/save/ACK, restart and claim independence.
**NONE RUN**: no tests, static/syntax acceptance, generator execution, builds,
packaging, install, listener restart, emulator, workers or Actions. Existing
saves remain untouched. Source bookkeeping stays125 partial/50 unsupported,
zero feature-complete/accepted routes. Actual native signed popup/reset/save
ordering, coalesced saves, clock/group transitions, peer history and all-game
crash/freeze/performance acceptance remain unverified; ordinary-SP producer
interleavings and further protocol branches still require implementation.

Read-only evidence: `.work/guild-raid-seen-state-native-20261008.txt`,
`.work/guild-raid-seen-popup-callsite-20261008.txt`, and original MessagePack
reader27a8c50's `guildRaidId`/`readDefeatCount` setter bindings.

## Stage-clear Familia activity payload — source only, untested

Original246c564's operation5000 factory clears the temporary recovery indicator
through2541bd0, selects the currently active original raid through246dc50 and
checks adventureStage's encrypted boolean at FBS62/slot47. It adds the authored
stage stamina cost at FBS10/slot6 multiplied by max(1,skipCount), NOT the stage
XP at slot16. If root `activeTimeAvailable` is true, it reads `activeTime:int32`,
`subActiveTime:int32` and `completedAt:int64`;246de00 resolves the primary and
secondary familiaActivityTime rows and1572598 checks their original daily hours.
1572818 uses the next authored slot2 index when secondary time is0. Eligible
hours multiply the charge by guildRaidInformation FBS12/slot7 as float32 before
truncation.2541b5c passes that charge to254549c and the native recovery predicate.
This is not a new purchase,10700 or server-side stamina debit.

The ordinary `adventure/stage/complete` issuer no longer forces this branch off
for an actual settled owned local Familia. It captures the real primary and
secondary IDs plus the selectable completion clock, not values supplied by the
stage request. The existing operation queue, immutable stage_delivery JSON and
stage/token request receipt persist that exact payload; exact retries retain it
after settings/clock changes. Shared stage receipt consumers validate its native
widths and original time IDs, retaining invalid captures. Nonmembers and legacy
false-branch captures keep `activeTimeAvailable:false`; foreign, unreadable or
unsettled ownership/settings are cancelled without changing the save. Rewinding
the event clock before creation does not undo settled ownership for this ordinary
stage activity payload; raid entry/completion membership-time guards are separate.
Other result types and original stage/event catalog hashes are unchanged.

No attempt, normal stamina, item, wallet, stage or native profile is precredited
by this branch. The original client applies the recovery; the shared UserInfo
save codec retains its three signed counters and reset timestamp. The following
source follow-up supersedes the earlier missing-target/observation/ACK statement
for newly captured ordinary5000 operations only. Broader producer interleavings,
clock transitions and native acceptance remain incomplete; this payload alone
must not be counted as complete normal-SP recovery or playable raid support.

`test_stage_raid_activity.cjs` and a nonmember assertion in the existing stage-XP
fixture are WRITTEN ONLY / NOT RUN. Additional member/replay/private receipt and
native arithmetic/save-order cases are in the consolidated checklist. No tests,
static/syntax acceptance, build, packaging/install, listener restart, emulator,
workers or Actions were run. Coverage remains125 partial/50 unsupported,
zero feature-complete routes. Read-only original evidence:
`.work/guild-raid-normal-sp-recovery-and-campaign-20261008.txt` and
`.work/guild-raid-original-active-time-predicate-20261008.txt`.

## Ordinary-stage normal-SP recovery receipts — source only, untested

The original earning-event lookup246dc50 uses slots6/7, while the retained SP
rules lookup1566a54 uses slots8/9. Both use start-inclusive/end-exclusive windows;
they must not be collapsed into a single end date. Separate original projections
retain existing stage/event/rule catalog shapes:21524 stage stamina/enable rows
(20583 enabled),43 float32 multipliers (all2), and12 activity index/hour rows.
These are original-data extraction, not an executed gameplay check.

EU boot1df0ce0 selects region5;2a3951c uses UTC+9.1572598 constructs intervals
from the completion day's year/month/day and advances only an overnight end.
15728e0 falls back to authored index0 when the next index is absent.22:00-to00:00
does not become a blanket previous-day bonus at midnight. PLT bindings confirm
the calendar getter uses gmtime, while construction uses mktime and the original
timezone offset. Eligible native charges use stage slot6, max(1,skipCount), and
float32 multiplier/truncation, not slot16 XP.

2544e64/25450bc supplies the native daily/event reset.254549c adds the charge;
2545594/2545418/254525c checks cost, divides float32, truncates, limits remaining
recoveries, adds attempts with the original nonnegative clamp, subtracts consumed
cost and advances the recovery counter. No invented maximum attempt stock is
added. A missing retained event supplies dailySP0 and no recovery allowance.
Native int32 overflow cancels with state retained rather than emitting an
overflowing charge; the general signed save codec is not normalized.

Each new5000 captures actual UserInfo's four-field attempt baseline, earning and
retained event IDs, charge, clock and catalog hash in private
`stage_raid_stamina_claim`, keyed by the existing operation ID. Issuance shares
the existing queue/stage/currency/request transaction; it does not precredit
native UserInfo, stamina, attempts, items or wallet. Legacy operations with no
receipt keep an unknown baseline; results are not used to backfill one.

Shared stage receipt/effect/save/ACK callers accept the original calculated
result or its actual native reset/application timestamp, observing `raidSP` only
when it differs from the captured baseline. The first observation is persisted
alongside native profile, stage observations, acknowledgement, queue and reply
in the existing atomic save transaction. A bare ACK cannot discard an unsaved
attempt effect. Observed recovery blocks additive redelivery; pending receipts
protect the captured or earned counters against unexplained spending/rewind.
Subsequent legitimate native resets are distinguished from those mutations.
Corrupt captures, catalog drift or incompatible earning/retained windows cancel
and retain the operation rather than recapturing it for another event.

Pending positive recovery producers serialize using queue-correlated primary-key
lookups, not lifetime SUM/MAX scans. Raid lobby/preinitiation and completion also
retain unresolved ordinary recovery. Disabled/no-earning stage captures do not
unnecessarily block another ordinary stage or raid. This pending-operation
boundary is not an all-time attempt ledger after acknowledgement.

Deferred `test_master_data.cjs`, `test_stage_raid_activity.cjs` and
`test_stage_experience.cjs` source now covers original projections, hours/windows,
arithmetic/reset/width edges, issue/save/ACK rollback, no precredit, split save,
partial retry cancellation, cold retention and corrupt receipt rejection.
**NONE RUN**. Actual settled-member replay, coalesced/delayed producers, all
midnight/event-end/rewind interleavings, post-ACK earning/spending checkpoints,
other original producer branches and signed native callback/save/UI acceptance
remain incomplete or unverified. This extends partial packets; it does not
establish complete recovery, stable gameplay or all149-original-packet support.

No tests, syntax/static acceptance, generator execution, build, packaging,
installation, listener restart, emulator, workers or Actions. Existing live
saves remain untouched; the new private DDL is source only. Source bookkeeping
remains125 partial/50 unsupported/0 feature-complete. Read-only original evidence
also includes `.work/guild-raid-original-calendar-and-time-wrap-20261008.txt`
and `.work/guild-raid-original-region-and-calendar-constructor-20261008.txt`.

## Post-ACK attempts and entry-bound debit — source only, untested

This follow-up supersedes the preceding missing-post-ACK-ledger statement for
captured ordinary5000 recovery and actual owned raid-entry spending. It does
not establish support for every unknown producer or native acceptance. Read-only
original ARM64 direct-call extraction finds246d2f4 calling2541b5c for recovery,
2172f2c calling2541b54 for nontraining entry, and getter reset paths through
2544e64/25450bc.254522c gets the stock, subtracts one and clamps nonnegative;
25451f8 has an add-stock implementation but no direct call found. That does not
prove the absence of indirect producers; no refill/purchase entitlement is
invented from the unused method.

Private `guild_raid_attempt_checkpoint` retains one exact four-field snapshot
per local user, established only by an observed original reset, captured recovery
or entry-bound debit. Untouched/imported codec-only history is not backfilled as
earned progress. Once established, subsequent saves must preserve it or match
one of those actual transitions; stale counters cannot restore an acknowledged
recovery or spent attempt merely because the operation queue is now empty.
High/negative signed values are not globally normalized, and no new stock cap is
introduced. UserInfo reads and fresh/cached token confirmation and binary pulls
also retain the checkpoint rather than exporting an inconsistent saved profile.

A debit requires the actual acknowledged Familia generation, original stage and
event, selected owned party, immutable entry capture, native saved baseline/reset,
and exact single-attempt decrement. The native saved raid-stage marker may still
be0; the original adventure-stage join and captured selected raid-stage ID bind
that branch without guessing a replacement. No stage/attempt debit is prewritten
at preinitiation or completion. The existing profile/save/sequence/reply
transaction persists the checkpoint and debit receipt atomically.

Private `guild_raid_attempt_debit` is keyed by the original entry request receipt.
The entry and completion receipts retain nullable `request_key` and
`entry_request_key` columns. Two same-second fresh selections can have identical
capture JSON/hash/date; their actual request identities are nevertheless distinct.
This prevents a later scored entry from retroactively making a historical
training capture look charged. Exact replay keeps its entry identity; an older
entry request cannot silently bind to a newer identical selection. Legacy NULL
identities remain unknown, not inferred from the latest entry or a timestamp.

The recorded debit remains anchored to its original four-field result after a
legitimate daily reset. Shared scored issuance and immutable completion receipt
reading accept that actual later reset without demanding a second debit after
midnight. A charged entry cannot be submitted as training, even when the later
reset made its current counters look like the original training baseline. A
second debit on the same entry, unexplained counter changes, missing/corrupt
private identity/evidence and incompatible party/history cancel with state
retained. A new selection is required for another battle's debit.

Deferred `test_stage_experience.cjs` source adds checkpoint insert/update/profile/
reply rollback, post-ACK rewind rejection, cold retention, corrupt checkpoint and
fresh/cached confirmation/pull refusal, and legitimate next-day reset. Deferred
`test_guild_raid_status.cjs` adds same-second entry identity, debit/checkpoint
atomic rollback, duplicate spend/restoration rejection, spent-receipt persistence,
charged-training refusal, and a scored battle crossing midnight before result
issuance/save/import/ACK. **WRITTEN ONLY / NONE RUN.**

All producer/delta ordering combinations, entry-before-adventure split saves,
retirement/reentry, event end/provider changes, multiple delayed resets and
recovery/spending interleavings, indirect stock producers, imported history,
signature/callback/UI/recovery/performance/no-crash-ANR and all-game coverage
remain incomplete or unverified. These are partial packet source extensions,
not a feature-complete or stability claim. The two private tables and additive
nullable migrations exist in source only; existing live saves/listener/APK/MuMu
are untouched. No tests, syntax/static acceptance, generator, build, install,
restart, emulator, workers or Actions.125 partial/50 unsupported/0 feature-complete
bookkeeping is unchanged; co-op remains last.

## Union Raid training completion — source-only partial, NOT RUN

The mode-28 completion producer at raw `0x217bd08:0x218492c` appends
`unionRaidStageId`, `unionRaidStageIndex`, `loopCount`, five ordered
`bosses[{enemyIndex,damage}]`, `isTraining`, and `debug` to the shared Adventure
completion body. The shared wrapper at `0x2472bec:0x2473704` dispatches mode 28
to `union_raid/stage/complete`. Its callback at `0x2477e3c` accepts optional
`stageInfo`; parser `0x248f070` consumes `unionRaidStageId`, five boss HP rows,
`loopCount`, `defeatCount`, and `familiaScore`.

The source-only handler admits only training on the exact active saved first
Adventure stage `1280000101101` / Union Raid stage `415000001`, with stage index
0, loop 1, debug false, five ordered damage rows, settled current Familia
membership, empty native Union Raid progress/ticket tables, and no pending
mode-28 operation. Original master data proves this stage has zero XP, no reward,
and no objectives. Auxiliary loot, task, friendship, skip, guest, and secret-
mission changes are refused.

The response is only `{code:0,stageInfo}` with the unchanged five authored
5,787-HP bosses, loop 1, defeat count 0, and score 0. The server writes an
immutable SQLite receipt binding the actual request identity/body, token,
Familia generation, saved stage, saved battle, and exact response. Exact retries
can be replayed after cache loss or restart; conflicting bodies/tokens and stale
Familia/stage/battle snapshots refuse. It does not issue a guessed operation,
precredit rewards, debit SP, alter HP/score, mutate native profiles, or pretend
that the client acknowledged a save.

Deferred `test_union_raid_completion.cjs` covers request widths/shapes, all
fresh-state guards, active stage/battle binding, pending operations, immutable
profile/wallet/queue state, exact replay, token conflicts, restart, and receipt
rollback/corruption. **WRITTEN ONLY / NOT RUN.** Nontraining/scored progression,
reward and defeat settlement, operation/save acknowledgement, battle cleanup,
native UI/performance/no-crash/no-freeze/ANR behavior, and multiplayer remain
unfinished; co-op stays last. No tests, static checks, build, listener, APK,
ADB, or MuMu work was run.

## Union Raid fresh status — source-only partial, NOT RUN

The final client wrapper at raw `0x2143f6c:0x2144404` emits exact
`{unionRaidInfoId:int32,debug:false}`. Mapped success callback `0x2246c0c`
passes the same root through status parser `0x2244b00`, stage repository
`0x2491e0c`, defeat parser `0x22447d4`, and battle/result parser `0x2244ed0`.
The fresh response therefore supplies `available`, `unionId`, `medalAmount`,
`defeatRewardExists`, both update timestamps, `stageInfo`,
`displayDefeatInfo`, `rank`, `unionBattleInfo`,
`unionIntermediateBattleInfo`, and `resultInfo`. Each stage row contains
`unionRaidStageId`, `bosses[{enemyIndex,hp}]`, `loopCount`, `defeatCount`, and
`familiaScore` with the native signed widths recovered from those parsers.

The final archive contains one event (`413000001`, Grand Familia Battle S1),
alliances `414000001/414000002`, medal `410000001`, and 23 stages. The unique
untouched entry is stage `415000001`, Adventure stage `1280000101101`, with
five authored Needle Rabbit HP values of 5,787. Its source hashes are retained
in the handler for the information, alliance, stage, and medal tables. No event
calendar timestamp survived in the event master.

The new handler admits only the exact event request and a settled current local
Familia membership whose join time has begun. It uses the first authored
alliance as an explicit solo-offline cohort policy and returns the untouched
entry stage with zero medal, timestamps, defeat count, and Familia score plus
empty defeat/battle/intermediate/result vectors. It writes no profile, wallet,
operation, stage, or SQLite progress state.

Nonempty `UserUnionRaidInformation`, `UserUnionRaidMedal`, Union Raid SP-ticket
tables, a saved or active Adventure mode-28 stage, or a related pending
operation refuse with recovery code 3000999 and remain untouched. Cached replies
rebuild the projection and cannot conceal a later native progress/battle save.
This is deliberately not a reset or a fabricated migration path.

Deferred `test_union_raid_status.cjs` covers exact shape, malformed/debug
requests, absent/unsettled membership, cache identity and invalidation, retained
native progress/tickets, active battle, membership-clock rewind, profile/queue/
wallet immutability, and restart. **WRITTEN ONLY / NOT RUN.** Alliance selection,
calendar activation, medal/SP persistence, preinitiation, battle settlement,
stage progression, earned logs, skills, rewards, rankings, peers, native UI/save/
recovery/performance/no-crash-ANR, and multiplayer remain unfinished or
unverified; co-op remains last. No tests, static checks, build, listener, APK,
ADB, or MuMu work was run for this source change.

## Union Raid empty status log — source-only partial, NOT RUN

The raw wrapper at `0x2387d10:0x2388018` sends exact
`{unionRaidInfoId:int32}`. Its mapped success callback `0x248841c` iterates the
root `logs` vector. Nonempty entries expose `logId`, `familiaName`, `godId`, and
`completedAt` before shared log construction at `0x2491258`; this establishes
the response root without guessing a generic result field.

The new handler returns `{code:0,logs:[]}` only through the same fresh-lobby
guard as `union_raid/status/get`: current settled local Familia membership is
required, while any native Union Raid information, medal or SP-ticket row,
saved or active mode-28 Adventure stage, or related pending operation refuses
with recovery code 3000999 and remains untouched. Cached replies recompute this
projection and cannot conceal a later save. There is no implemented Union Raid
battle-settlement producer yet, so the server does not invent nonempty rows.

Deferred `test_union_raid_status.cjs` cases cover the exact and malformed
request shapes, empty replay, stale-cache invalidation, every shared saved-state
guard, clock rewind, restart, and read-only behavior. **WRITTEN ONLY / NOT RUN.**
Earned entry decoding and production still depend on stage settlement. Native
log rendering, back navigation, recovery, performance,
no-crash/no-freeze/ANR behavior, and multiplayer remain unverified; co-op stays
last. No tests, static checks, build, listener, APK, ADB, or MuMu work was run.

## Union Raid fresh-stage preinitiation — source-only partial, NOT RUN

The raw wrapper at `0x21752f0:0x2175c28` sends exact
`{unionRaidInfoId,unionRaidStageIndex,unionRaidStageId,defeatCount,debug}`.
Mapped callback `0x228fa74` requires a root `stageInfo`, verifies its stage ID
and defeat count against the selected Adventure context, and imports it through
repository `0x2492474`. Parser `0x248f070` consumes `unionRaidStageId`,
`bosses[{enemyIndex,hp}]`, `loopCount`, `defeatCount`, and 64-bit
`familiaScore`.

The handler admits only the source-backed untouched stage `415000001`, locally
mapped to the first returned index 0 with defeat count 0 and debug false. It
returns the same five authored 5,787-HP bosses, loop 1, and score 0 already
published by `status/get`. The shared guard requires settled current Familia
membership and refuses any native Union Raid information, medal, SP-ticket,
mode-28 Adventure stage, or related pending operation without changing it.
Cached replies recompute that projection. The route performs no server-side SP
debit, battle mutation, reward, or completion precredit.

Deferred `test_union_raid_status.cjs` cases cover every request field, exact
stage response, replay and stale caches, all shared saved-state guards, clock
rewind, profile/queue/wallet immutability, and restart. **WRITTEN ONLY / NOT
RUN.** Progressed stages, SP consumption, battle settlement and native save
ordering remain unfinished. Actual entry/party handoff, UI, recovery,
performance, no-crash/no-freeze/ANR behavior, and multiplayer remain unverified;
co-op stays last. No tests, static checks, build, listener, APK, ADB, or MuMu
work was run.

## Union Raid skill progress read - source-only partial, NOT RUN

The raw wrapper at `0x2347a24:0x2347d18` sends exact
`{unionRaidInfoId:int32}`. Callback `0x2448f74` invokes parser `0x2447d18` only
after transport status 0. That parser requires the root `unionRaidSkills`
vector and consumes `unionRaidSkillId` plus `medalAmount` from every row before
resolving the authored skill row and its group. This is a progress projection,
not an empty generic success packet.

The final `unionRaidSkillGroup.enc` source has nine groups and SHA-256
`a60b9b30404539fc1ff05fc0fb84d249ecb3b49034f55c5254d879f636048d69`.
The final `unionRaidSkill.enc` source has 450 rows, 50 levels per group, and
SHA-256 `1d652dd897e3e3bddc36f5fa374cf1c9dcc45ed993fb02bd81320d1f1dc93b12`.
Its thresholds are cumulative 33,000-medal steps except the authored group-8
level-1/level-2 duplicate at 66,000. The in-server compact catalog reproduces
only those recovered IDs, groups, levels, effects, and thresholds and rejects
itself unless all 450 rows match that layout.

Private `union_raid_skill_progress` stores cumulative positive investment by
event, immutable Familia creation operation, and skill group. The handler
requires the exact event and settled current local Familia membership, rejects
unknown groups, unsafe/corrupt amounts, excess progress, and rows predating the
membership generation, then returns rows in group order. It selects the highest
authored threshold reached; therefore group 8 at 66,000 resolves to level 2.
Partial investment below level 1 retains the group's first skill ID so the
client can associate it with the correct group. A fresh profile returns the
source-valid empty vector. Cached replies rebuild from the current membership
and progress and cannot hide a later investment.

Deferred `test_union_raid_status.cjs` cases cover exact/malformed requests,
absent membership, fresh empty state, persisted partial progress, the duplicate
threshold, corrupt or excessive investment, stale-cache refusal, and restart
persistence. **WRITTEN ONLY / NOT RUN.** The following source milestone now
implements the original medal debit, cumulative update, returned
`userMedalAmount`, atomic replay, exact debit observation, and settled no-op
recovery. Medal earning, natural applied effects, native UI/save ordering/
performance/no-crash/no-freeze/ANR behavior, and multiplayer remain unfinished
or unverified; co-op stays last. No tests, syntax/static checks, generators,
builds, listener, APK, ADB, or MuMu work was run.

## Union Raid skill investment - source-only partial, NOT RUN

This milestone supersedes the preceding wholly unsupported growth and medal
debit statements. The actual ELF wrapper `0x2347fe4:0x23486fc` sends exactly
`unionRaidInfoId`, `unionRaidSkillGroupId`, `medalId`, and `medalAmount` as signed
int32 fields. The last is the amount to invest, as emitted by the upgrade-screen
caller at `0x1504e18`. Callback `0x23491f4:0x2349590` reads `userMedalAmount` and
applies effects only when it is lower than the captured stock. The medal-domain
vtable slot `+0x48` resolves to `0x25105a4`, which sets only the current amount
through `0x289cf60`; signature argument 0 preserves the saved signature.
The callback then parses `unionRaidSkill.medalAmount` through `0x23486fc`,
emits the actual spending delta, and emits an event-information-slot-28-scaled
contribution event. These are client events, not a server operation queue.

Native writer `0x2755b60`, JSON reader `0x27de020`, and MessagePack reader near
`0x2810e70` agree on seven `UserUnionRaidMedal` fields: int64 `userId`, signed
int32 `medalId`, `amount`, `reservedAmount`, and `cumulativeAmount`, signed byte
`bookEntryState`, and uint32 `signature`. The native map keys by `medalId`.
The original amount setter requires stock below 1,000,000,000. Source guards
preserve owned or lazy-owner-0 rows, enforce the original ID and stock widths,
and retain the full unchanged baseline apart from the observed amount debit.

The partial handler admits a settled current local Familia, the original event
and any of its nine groups, a positive amount covered by existing unreserved
Alliance Medals, and investment no higher than the original maximum threshold.
It records cumulative group progress and returns
`{code:0,userMedalAmount,unionRaidSkill:{medalAmount}}`. It does not grant medals
or prewrite the native inventory. Existing imported stock is the spending
baseline; new medal earnings require a recovered reward producer.

`union_raid_skill_growth` binds the actual encrypted-wire MD5 and request identity
to the event, immutable Familia generation, group, investment, before/after
progress, complete medal baseline, original catalog fingerprint, timestamp, and
response. `union_raid_medal_checkpoint` points to the newest investment receipt.
Each progress row pins its growth request ID through an additive nullable
column migration; older imported rows retain NULL until an investment occurs.
These writes and the existing sequence/reply cache commit in the same SQLite
transaction. Indexed latest-group seeks validate all nine progress rows without
a lifetime scan. Missing/corrupt receipts, changed progress, restored stock,
clock rewind, and incompatible generation retain state and refuse.

An exact pending request can replay after cache eviction or restart. A second
investment waits for the first debit to save, preventing overlap. The native
`user_data/push` accepts the captured baseline or exact amount-debited target;
observing the target commits `effect_saved` with the profile, token, save time,
sequence, and reply. Afterwards the baseline cannot be restored. An exact
settled retry walks any later same-group receipts as a contiguous progress/time
chain, requires the current progress pointer and latest medal mutation to be
fully saved, and returns the current saved medal balance plus current group
progress. This response is deliberately not the historical response: native
`0x24491f4` applies the debit and emits both events only when the returned amount
is lower than its request-time stock, so returning the equal current amount is a
side-effect-free completion. Replaying the old lower balance after later earning
or spending would debit again. A pending later investment or an unacknowledged
Medal Present therefore remains unavailable. Read/pull/confirm paths validate
the retained medal checkpoint; cached binary pulls already compare current
native bytes. Membership changes do not erase player-wide medal spending proof
or historical skill receipts.

New `test_union_raid_skills.cjs` contains synthetic imported-stock and save-order
cases for malformed requests, insufficient/reserved stock, below-level-1
investment, group-8 duplicate thresholds, original maximum, pending/conflicting
requests, restart, cache loss, settled current-state no-op replies, later saved
other-group and same-group investments, later Medal Presents, pending-later-effect
refusal, progress/response/checkpoint corruption, balance restoration, and
issue/native-save transaction rollback. **WRITTEN ONLY / NOT RUN.** Battle/reward
medal earning, natural contribution and spending achievement effects,
event-calendar admission, original signatures, actual upgrade UI/save order/
combat effects, performance/no-crash/no-freeze/ANR, and multiplayer remain
unfinished or unverified. Current inventory: 176 partial / 0 unsupported / 0 verified complete
across 176 routes. No tests, static/syntax checks, generators, builds, listener,
APK, ADB, MuMu, workers, or Actions were run; co-op stays last.

## Union Raid input and initializer corrections - source-only, NOT RUN

The training handler previously tested `adventureStageId` as signed int32,
rejecting the actual original `1280000101101` before it could reach its captured
stage/battle checks. It now accepts a positive safe int64 representation and
still requires the exact original stage. This fixes the admission error; it
does not finish the remaining training-clear/save/ACK handoff.

Original medal-domain `0x250fe00` calls constructor `0x25109c0`, sets the actual
local owner and original medal ID, and appends the otherwise zero-stock row
through `0x271a23c` when the domain item is first read. A serialized row is
therefore not, by itself, earned raid progress. The shared untouched-inventory
guard now permits a fully validated `UserUnionRaidMedal` row only when amount,
reserved amount, and cumulative amount are all zero. It preserves the owner,
book state, signature, and row unchanged through status, empty status-log,
preinitiation, and the existing training receipt. Positive earned history,
other nonempty raid tables, active battles, and pending effects remain guarded.
Absent/unsettled membership and clocks before membership now take the existing
503/native-cancellation recovery path consistently across Union Raid routes.

Both raid completion producers call shared `0x21854bc` for nontraining battle
telemetry. `validRaidBattleLog` now shares the existing original codec between
Guild Raid and Union Raid: exact PC objects contain 19 signed-int32 and 14 safe
int64 fields, followed by `["gauge",int64]`. Training must omit `battleLog`;
nontraining must supply it. Correctly shaped nontraining requests reach the
explicit unavailable settlement branch with the saved battle retained. The
per-PC `enemyDamage` scalar and five stage-boss `damage` counters remain distinct.

Deferred status/completion/skill sources add the real large stage ID, unsafe
stage widths, zero-medal owners and cold retention, each nonzero medal counter,
scored versus training telemetry, signed-width edges, malformed gauge/PC rows,
and membership recovery. **WRITTEN ONLY / NOT RUN.** No tests, static/syntax
checks, generators, builds, listener restart, APK, ADB, MuMu, workers, or Actions.
Counts remain 173 partial / 3 unsupported / 0 verified complete across 176
routes; this is an extension to existing partial branches.

## Union Raid battle-log contract - recovered source, still UNSUPPORTED

The original wrapper `0x238d0e8:0x238d3c4` sends only
`{unionRaidInfoId:int32}`. Callback-vtable slot `+0x30` at `0x42aebe8` targets
`0x238db44:0x238e434`. On successful transport it iterates the root `logs` and
builds a `DomainUnionRaidBattleLog` through `0x239cd8c`; this route is distinct
from `union_raid/status/log` and the scored completion request's `battleLog`.

| Response field | Native shape | Recovered meaning |
| --- | --- | --- |
| `logs` | array of objects | Individual displayed attack entries |
| `userId` | int64 | Entry player; used to open that player's details |
| `playerName` | string | Historical displayed player name |
| `attackedAt` | int64 | Entry time formatted by the original AppTime code |
| `leaderPc` | object | `pcId`, `jobRank`, `heroSublimateLevel` as int32, plus boolean `isUnlockedHeroSublimate` |
| `params.p1` | int64 | Numeric attack value; original earning/conversion remains to be established |
| `params.p2` | int32 | Original Union Raid stage ID; helper `0x2148290` joins `unionRaidStage` and reads its name |

Repository refresh predicate `0x238d3c4` refreshes after a strict greater-than-10
second interval or a changed AppTime hour/date comparison. Its successful parse
records the refresh timestamp, even for an empty vector. A clock change must
therefore be covered by the eventual native cache/rendering pass.

No accepted scored Union Raid completion/log producer exists yet. Training
receipts cannot be relabeled as earned attack history, and the parser contract
does not supply an earning rule. The route remains unregistered/unsupported and
uses the existing cancellation recovery; no empty success, fabricated battle,
SQL log seed, or peer is added. The next implementation dependency is the actual
scored completion/save handoff and its immutable historical player/stage/value
capture, followed by the real populated read projection, retention/replay,
current-Familia scoping, and native entry/detail/back/cache/stability acceptance.

## Union Raid information initialization and view saves - source-only, NOT RUN

Writer `0x275684c`, JSON reader `0x27df548`, and MessagePack reader
`0x2811eb4` agree on exactly five `UserUnionRaidInformation` fields:
`userId` (int64), `unionRaidId` and `unionId` (int32),
`lastDisplayedUnionRaidRecord` (int64), and `readDefeatCount` (int32).
There is no signature field. Native lookup `0x26a9c7c` keys the row by
`unionRaidId`. The final original catalogs retain event `413000001` and
alliances `414000001` / `414000002`; their existing source hashes remain
those in `ORIGINAL_UNION_RAID_LOBBY`.

This is not necessarily earned raid progress. After `available:true`, status
importer `0x2144b00` looks up the current event. If absent, it constructs the
zero-default row through `0x21473b4` / `0x28a1bd8`, sets the actual local owner
through `0x28a1d2c`, sets the event through `0x28a1e08`, appends through
`0x271de8c`, and sets the returned alliance through `0x28a1ee8`. Therefore
rejecting every nonempty information table prevents subsequent entry after
our own successful lobby response.

The source now uses the explicit native merge identity and exact owned row
codec on shared reads and native saves. Untouched status/log/entry/training
admit a current-alliance zero-defeat initializer, including benign viewed-record
timestamps. A zero-alliance initializer remains addressable and can adopt the
returned first authored alliance. Other-alliance and earned history are retained
and remain unavailable to the untouched lobby; no alternative alliance or
earned score is fabricated.

The existing `user_data/push` transaction persists information alongside the
native profile token, save metadata, sequence and reply. New information requires
settled current local Familia membership and the returned alliance with zero
defeats. Existing information cannot be deleted, change owner/event/alliance,
or alter its defeat counter without a recovered producer. Its viewed-record
timestamp may change: `0x2146278` stores the returned update timestamp, while
`0x214635c` stores current AppTime. In particular, the returned timestamp may
be zero after a current-time view marker, so this field is not a monotonic
earned-score checkpoint. `0x2146014` writes the displayed sum of stage defeat
counts; new nonzero counts still require real settlement evidence.

Deferred `test_union_raid_status.cjs` cases cover missing membership, first native
save, saved initialization and cached lobby/log/entry, exact owners/IDs/fields,
duplicate rows, other alliance, unsafe timestamp/counter widths, forbidden
counter/deletion changes, benign view changes, original zero-alliance adoption,
retained imported history, profile-update rollback and cold retention. The
completion fixture retains initialized information and zero-stock medals.
**WRITTEN ONLY / NOT RUN.** No schema migration, existing save repair, server
profile prewrite, operation, clear, ACK, reward or peer is added.

The shared completion callback was also read from the pristine binary:
`0x2477e3c` optionally folds `gainedServerItems.items[{itemId,amount}]` into the
result, optionally imports `stageInfo`, and runs the save/completion callbacks.
The generic `5000` handler has a stage-clear and battle-stage-zero path, but
that alone does not prove the missing scored Union Raid response or its earning
rules. No guessed `23000`, `23300`, or generic completion replacement is issued.
Scored settlement, training clear/save handoff, rewards, attack-history production,
viewed-defeat progression, import/replay/recovery ordering and native
UI/performance/no-crash/no-freeze/ANR acceptance remain unfinished or unverified.

The saved audit now includes the already-existing `gvg/tournament/get` route that
was omitted from its JSON snapshot. This is bookkeeping, not new gameplay.
Current inventory remains **173 partial / 3 unsupported / 0 verified complete
across 176 routes**. No tests, static/syntax checks, generators, builds, listener
restart, APK, ADB, MuMu, workers or Actions; co-op last.

## Union Raid training clear and save handoff - partial source-only, NOT RUN

This milestone supersedes only the earlier training bare-reply/no-clear statements.
Scored completion and its history/ranking/reward producers remain unfinished.
The frozen client already registers `5000` at `0x246c564`, which reads the captured
Adventure stage, calls original clear `0x2451924`, then clears the owned active
battle's stage ID through `0x266f7b4`. The surviving original first-stage data is
mode28, stage `1280000101101`, zero XP, zero ordinary/S/objective rewards and zero
authored raid-SP cost. The shared completion callback separately reads optional
`stageInfo` and performs its original save/completion chain.

**Explicit offline compatibility policy:** use that existing signed clear consumer
for zero-reward practice. This is not recovered publisher training wire parity and
does not establish scored settlement. Ordinary completion routes still reject
mode28; only the fully validated Union training route opts into the adapter. It
keeps the existing first-stage HP/loop/defeat/score snapshot, emits no earned raid
score/history/medal/reward, and does not inject a native profile clear or ACK.
The normal-stage Familia activity-contribution branch is not applied to practice.

`union_raid_training_completion` gains an additive nullable `operation_id` column,
a unique command index and an indexed latest-stage seek. Legacy bare-reply rows
remain unchanged with NULL and cancel rather than acquire fabricated completion
evidence. New permanent actual-wire request/token/before-stage/battle/Familia/
canonical-response captures bind the one signed5000 to existing `stage_completion`
and `stage_delivery`. Those rows, queue, sequence and reply use the existing
transaction. Their original zero-reward recipe and stored response are rechecked
on delivery, native save, and retained-history access.

Shared native-save handling observes the owned active battle becoming stage0 as
well as the normal clear-state/counter/date prefixes. ACK requires exactly one
saved cumulative clear and the actual cleared battle in the captured current
Familia. Bare ACK, only-clear or only-battle evidence cannot settle the command.
Partially saved direct retries cancel with their queue retained; cold login/
confirm/pull use the existing original counter/date controls. A battle-only saved
prefix is idempotent and does not justify skipping an unsaved additive clear.
Missing, altered, settled and foreign-generation captures do not issue a second
clear. No native signature, token, clear, battle cleanup or ACK is prewritten.

Status/log/entry now distinguish an owned native zero-progress first-stage
initializer from earned progress. After ACK, an indexed latest practice receipt
must match the retained clear floor and exact cumulative successor before that
practice stage is admitted again. Old or unexplained counts cannot become a fresh
lobby. Historical acknowledged practice is global player history, not a new
Familia score. Other stages, active/pending battles and scored/imported history
remain guarded; there is no shared raid HP or score reset.
New dated practice results also require the current clock to be later than the
last acknowledged clear, before issuing any command; exact pending retries retain
their original capture instead of being treated as a new clear.

Extended `test_union_raid_completion.cjs` sources cover real command shape and
profile/wallet immutability at issuance, canonical receipt, issue and ACK rollback,
bare/one-sided/extra-clear ACK refusal, exact pending/conflicting/corrupt/legacy/
settled retries, split clear then battle saves, cold counter/date controls,
restart, lobby/entry retention and a second practice with a new token.
The same-second/rewound new-result guard has a written refusal case.
**WRITTEN ONLY / NOT RUN.** Native party/attempt eligibility, hot and cold result
UI/back/save ordering, achievement-event effects, interrupted/partial interleavings,
clock boundaries, original signatures, ABI coverage and no-crash/no-freeze/ANR/
performance acceptance still need the consolidated pass. Auxiliary loot/CP/guest/
objective/skip variants and all scored progression/rewards/history remain unfinished.

Inventory remains **173 partial / 3 unsupported / 0 verified complete across176**.
No tests, static/syntax checks, generators, builds, listener restart, APK, ADB,
MuMu, workers or Actions were used; existing saves were not edited; co-op last.

## Alliance Medal Present acquisition and spending lineage - source-only, NOT RUN

This extends the existing `gift/receive` and native save/recovery branches. It does
not establish scored Union Raid settlement or invent an earning quantity.
Original `unionRaidMedal.enc` has one row: `410000001`, `union_medal_item.1`,
`Alliance Medal`; SHA-256
`b456f52c4891c51a11f56e1e91f6af04e201cf79ce68cd55901b7ea176663f9b`.
The old generated item catalog omitted this separate family. A bounded runtime
overlay now registers its exact `UserUnionRaidMedal` / `medalId` profile, refuses
conflicting profile/key or supplied source hash/count, and leaves the input
master object unchanged. The original-table decoder source registers it as well.
The generated export has not been rebuilt during implementation-only work.

Original domain vtable `0x42bd028` selects generic positive item gain `0x24d8844`.
Its book getter `0x25108a8` returns1, while the corresponding book setter
`0x25108b0` is a no-op. Therefore the ordinary gain's book1-to3 call does **not**
rewrite this family's saved book byte. Amount setter `0x25105a4` calls native
amount setter `0x289cf60`, then signature setter `0x289d238` only for a nonzero
signature. Generic gain completes the amount/signature update, then the positive
lifetime addition, before its acquisition event. Maximum `0x24d8d6c` is999999999;
lifetime addition `0x24d8d94` uses signed-int32 addition followed by the same cap.
Negative/wrapped addition is refused rather than converted into an invented gain.
Native constructor `0x289cbd0` starts zero amount/reserved/lifetime/signature and
book1. Lazy missing-row getter `0x250fe00` assigns actual local owner and original
medal ID; an existing validated lazy/local row keeps its owner/book/reserved fields.

An actual saved flat `UserGift` with that original item now reaches native2000's
`receivedItems`, not a fake successful special-item acknowledgment. Indexed
`union_raid_medal_present` archives the actual signed command, summed quantity,
before row or NULL, exact after row and preceding saved skill request ID.
`union_raid_medal_present_checkpoint` pins the newest acquisition. These additive
DDL statements are source only/unapplied. Command, generic item target, selected
gift claims, queue, sequence and reply use the existing issuance transaction.
Neither native medal stock, the lazy initializer, gift received flag nor operation
ACK is prewritten. Both stock counters cap independently; a fully capped gain
still needs the actual changed command signature as evidence.

Shared save planning accepts the captured before row, an absent row's exact native
zero initializer, or its captured complete after row. It does not guess a partial
field remainder or normalize book/reserved/signature/owner. The actual after row
sets the permanent observation together with generic `gift_item_claim.stock_state`,
profile/token/meta, sequence and reply in one transaction; claim flags may arrive
separately. ACK requires the actual inventory observation plus the normal gift
received/removed evidence. Source cold login/confirm/pull omit the saved medal
entry while retaining original unsaved stamina or other captured item entries;
the original queued command and its signature are kept. Direct partially applied
retries cancel with state retained rather than issue another additive award.

The latest acquisition and latest skill-debit checkpoints now reconcile together.
A fresh skill investment waits for the Present's actual save and ACK. A later
reward waits for the prior skill debit to be saved, captures that exact parent
after row, and changes only stock/lifetime/signature through native gain. Spending
still preserves lifetime/signature/book/reserved fields. The immutable parent is
validated even after later investments and retains its original investment clock
floor; a reward cannot erase that floor. Latest indexed seeks avoid a full award
history scan. Missing/corrupted commands, floors, targets, restored native rows,
foreign fields and settled retries retain history instead of creating new proof.
Other Alliance Medal reward producers remain guarded until they have their own
original earning/capture path; adding the catalog does not authorize generic
uncaptured mission, shop, scratch or stage rewards.

Connected status handoff: raw `0x2144ccc` reads root `medalAmount` as int32,
looks up the original event medal ID from slot0x3a, resolves the domain item through
`0x250f2d8`, then `0x2144d3c` invokes its amount setter with signature0. Returning
the old fresh-only zero after a genuine award would overwrite live medal stock.
Lobby/log/entry/training therefore now admit only medal history whose actual
award was saved and acknowledged and whose latest skill debit was observed.
Status returns that exact saved current amount, preserving lifetime/book/reserved/
signature, with no server-side native prewrite. Pending captures refuse even when
the first lazy medal row is still absent or zero. Cached status compares the new
projection and cannot replay an obsolete zero-balance view. Imported/unknown medal
earnings, SP tickets, scored stage/defeat history and active battles remain guarded;
known medals are not evidence of raid HP, score, rewards or attack history.

New deferred `test_union_raid_medal_presents.cjs` covers absent/local/lazy owners,
book/reserved preservation, crossing/full caps and changed signature, signed
overflow, issue/save/ACK/reply rollback, pending/conflicting/cold/settled replay,
flags-first and inventory-first saves, malformed command/target/floor retention,
deletion/rewind refusal, two awards around a real local skill investment, parent
clock/stock retention and both mixed medal/stamina save orders.
Earned/spent status, log and entry reads plus practice preserve the independent
medal lineage; pending and cached-zero views are refused without native writes.
The generic
24-family Present fixture excludes this new guarded family; original master
fixtures now require its provenance/profile after the deferred export rebuild.
All cases are **WRITTEN ONLY / NOT RUN**.

Native Present reward rendering, the unchanged `issueUnionRaidMedal` presentation
array, natural award/save/ACK ordering, signatures, interrupts, ABI coverage,
skill contribution/effects and no-crash/no-freeze/ANR/performance remain unverified.
Scored raid HP/loop/score/medal earning/history/rankings/defeat rewards and other
unfinished packets/branches remain incomplete. No authored Union stage medal
column has been treated as a proved per-hit/per-enemy/wave earning formula.
Counts at that milestone were **173 partial / 3 unsupported / 0 verified complete across176**.
No tests, static/syntax checks, generators, builds, listener restart, APK, ADB,
MuMu, workers or Actions; existing saves untouched and co-op last.

## Native Union Raid attempts and30000 result path - source-only, NOT RUN

Original PlayerStatus JSON writer `0x25ebd10:0x25ebe40` writes
`unionRaidBossSP` and `unionRaidNormalSP` through signed-int32 getters, with SXTW
into JSON integer values; `unionRaidBossSPUpdatedAt` and
`unionRaidNormalSPUpdatedAt` use the signed-int64 getter. Import span
`0x25ec998:0x25ecbd4` reaches original setters `0x25eb280`, `0x25eb360`,
`0x25eb440` and `0x25eb520` respectively. Corresponding original MessagePack
writer/import string references are at `0x25ed9e8:0x25edab8` and
`0x25ee200:0x25ee35c`. The stock/timestamp fields are not item quantities,
stage HP or the Familia raid's separate four-field attempt state.

Shared native `UserInfo` reads and `user_data/push` now validate those four fields
without changing their actual numbers or unrelated PlayerStatus contents. Signed
stock and safe signed-int64 clock values remain intact, including width-boundary
values that are not claims of playable balances. Missing/string/fractional/unsafe
fields refuse with the stored profile retained. Save/profile/token/meta/sequence/
reply reuse the existing transaction; no native defaults, zero repairs, stock
caps, timer refresh, event reset, earned/debited stock, schema, signature,
operation or ACK is created merely by receiving a save.

New `test_union_raid_attempts.cjs` source queues zero and signed-width preservation,
wrong type/missing fields, unrelated-field retention, profile/meta/reply rollback,
exact MessagePack pull, restart and changed-clock retention, and corrupt-read
cancellation with unchanged serialized profile. It uses only disposable synthetic
rows, not a real player save or native attempt producer. **WRITTEN ONLY / NOT RUN.**

The original result command is now identified: registry constant30000 at rebased
`0x3597560` maps through rebased pointer `0x442a350` (raw `0x432a350`) to
raw consumer `0x2470cbc`. This is a newly recovered source contract, **not an
implemented scored result** and not evidence that the existing practice adapter
matches publisher wire behavior. The native consumer reads `stageInfo`, its
int32 Union stage ID/loop count and boss vector. It resolves the original stage's
Adventure stage ID, independently processes optional `gainedItems.items` and
`gainedServerItems.items` through domain gain, and checks original book state on
the latter item path. Optional `gainedServerItems.UserUnionRaidMedal` is an array
of full seven-field native rows imported by `0x27de020`; it is not a numeric medal
counter or a guessed alias. Rank, lastBattleInfo, defeat flags, int64 score/total
damage, recorded and training flags go to the native result/event path.
`0x2471628` calls original stage clear `0x2451924`; `0x2471690` calls owned battle
stage-ID cleanup `0x266f7b4` with0. Native dirty/import/clear/result/save/ACK order
and achievement-event effects still require a complete producer and acceptance.

Read-only setter-call extraction also identifies the separate stock producer
families: boss SP helpers at `0x253eec4:0x253f660`, normal SP helpers at
`0x2547a18:0x2548094`. These call the exact four setters; they are not evidence
for guessing publisher timing or allowing arbitrary reward rows. Their original
initialization/elapsed time/ticket/debit and active-event predicates must be bound
before scored settlement. No30000 command is emitted from this milestone and no
attack, reward, log, ranking or defeat claim is fabricated.

At that extraction milestone, full scored settlement, earned history and the
30000 ACK path remained unfinished. The source-only implementation below
supersedes that implementation gap, but not publisher-parity or acceptance gaps.

## Union Raid scored result and battle log - source-only partial, NOT RUN

The nontraining mode-28 completion now requires the exact current original stage
and loop, event window, settled current Familia generation, durable preinitiation,
actual native normal-SP debit observation, active owned battle, and the selected
owned `activeGuildRaidPartyId` party. It issues native operation type30000 with
the recovered `stageInfo`, empty `gainedItems.items` and
`gainedServerItems.items`, rank, last-battle, defeat, int64 score/damage,
recorded, and training roots. No native profile, stage, battle, medal, wallet,
reward, or ACK is precredited.

Private indexed receipts bind the encrypted request identity and token to the
attempt debit row, stage and battle baselines, progress before/after, party,
player name, leader snapshot, signed operation, and exact response. The ACK is
accepted only after the native stage is actually cleared and the owned battle
stage ID is0. That same transaction advances a materialized
`union_raid_progress` row and the existing stage floor before moving the
operation to `operation_done`; pending or corrupt history cannot appear in reads.

Explicit `offline-union-raid-v1` scoring counts only authored HP actually removed,
so overkill cannot increase score. It accumulates local Familia score and, when
all five current bosses reach0, increments defeat/loop and restores the one
recovered authored stage's five HP values. This is a local preservation policy,
not the unavailable publisher scaling, medal, or contribution formula.

`union_raid/battle/log` now accepts exact `{unionRaidInfoId}` and projects only
acknowledged current-Familia receipts into the recovered
`{userId,playerName,attackedAt,leaderPc,params:{p1,p2}}` shape. `p1` is that
bounded local score and `p2` is original stage415000001. No empty earned rows,
historical peers, or seeded rankings are fabricated. Status and preinitiation
consume the same ordered progress checkpoint.

Deferred `test_union_raid_scored.cjs` plus the existing completion/status cases
are **WRITTEN ONLY / NOT RUN**. Publisher scaling, medals, defeat rewards, member
ranking, peers, interrupted partial-save cold recovery, native signatures,
natural save ordering, cache/details/back/render/performance and no-crash/freeze/
ANR remain incomplete or unverified. Counts are now **174 partial / 2 unsupported
/ 0 verified complete across176**. No tests, static/syntax checks, generators,
builds, listener restart, APK, ADB, MuMu, workers or Actions; co-op last.

## Original Union Raid timer rules and persistent entry - partial source, NOT RUN

This corrects the older statement that no calendar survived. It was absent from
the exported Union catalog, not from the original archive. `unionRaidInformation`
field2 is **int64 Adventure ID**, not int32: row413000001 joins original
Adventure672800001 (`adventure.union_raid.1`, type28). Adventure source SHA-256 is
`19c1c2155371270fd4c7d3b23490509f76e93b9387146feed3acfa1003486da5`.
Its original four timestamps are window6=1661439600, window7=1661925599,
window8=1661439600, window9=1663811999. Native active-information getter
`0x14df658` and boss reset lookup `0x253f258` join this Adventure and use its
slots8/9. Shared predicate `0x2a3a5dc` is start-inclusive/end-exclusive.
No publisher dates, current activation or substitute duration are invented.

Information slots6..9 are respectively boss daily SP3, normal initial SP5,
normal maximum SP10 and normal interval3600 seconds. Boss constructor
`0x253ee4c:0x253eed4` loads slot6 into both its threshold and refill amount and
initializes amount/update time only when the saved clock is0. Getter
`0x253efb4` tests stock before calling the daily refresh `0x253f000`; stock at
or above3 keeps its old clock even on a different day. Below threshold, a changed
original client-local day replaces stock with3 and the update clock with the
actual getter time. This is not an hourly boss refill or a cumulative top-up.

Normal constructor `0x2547988:0x2547a28` uses slots9/8/7 for interval/max/initial
and initializes only a zero clock. Getter `0x2547ab0` refreshes only below10;
`0x2547afc` computes whole elapsed hours, adds/caps to10 and advances its old
timestamp by the whole-hour portion, preserving the fractional remainder.
High stock—including original extra stock up to the separate item-add cap99—
is not lowered or its clock advanced by a getter. When no original active event
is found, constructor rule members remain0; no invented daily/hourly allowance
is projected. Explicit event-reset methods `0x253f1e0` and `0x2547d74` are not
ordinary getters and have not been silently substituted for every read.
Unsafe elapsed arithmetic or native signed addition wrap refuses rather than
normalizes a saved balance. Codec-only width preservation remains separate.

Decoder source now exports `unionRaidEvents` and `unionRaidAttemptRules` from that
original join. Runtime source supplies an exact nonmutating fallback for the old
generated export and refuses conflicting supplied fields/hash/counts. The source
export is **NOT REGENERATED** during implementation-only work; existing event/
raid capture hashes remain unchanged. No original content or real save is edited.

`union_raid/status/preinitiation` now has real private persistence beyond its
stageInfo reply. Additive source-only tables `union_raid_entry` and
`union_raid_entry_request` capture the actual received-wire MD5/request identity,
current acknowledged Familia generation, exact owned four-field native baseline,
canonical original calendar/rule hash, possible getter projection, captured time
and unchanged original stageInfo response. Latest entry lookup is indexed by
generation/event; historical request receipts remain permanent. Entry, request,
sequence and reply commit in the existing transaction, without prewriting a
native profile/token, attempt, signature, operation, stage clear, HP, reward or ACK.

An exact retained retry uses its captured time rather than a new timer projection.
Current actual counters, response, membership, origin binding and hash must still
match. Changed bytes/routes, an overwritten/superseded request, active battle,
clock rewind, corrupt JSON/projection/catalog or missing origin binding retains
state and cancels. An old reply with no permanent entry proof is not backfilled.
Fresh re-selection uses the existing idle unscored lobby guard. A projection is
only a captured native possibility: it is not a claimed native save, spent attempt
or scored authorization. Full party selection and scored30000 settlement must
consume actual original entry/debit/save evidence before damage or rewards earn.
The earlier first-stage practice policy remains explicit; this source milestone
does not silently make all lobby/skill/chat/scored availability calendar-complete.

New deferred `test_union_raid_entry.cjs` covers issuer/reply rollback, native/
wallet/queue immutability, actual baseline/projection, exact retained retry after
cache loss/restart, byte/route conflict, supersession, malformed/missing proof,
changed actual counters, active battle, rewound time and session retention.
Expanded `test_union_raid_attempts.cjs` source covers active/inactive start/end,
zero clocks, daily vs hourly refresh, fractional remainder, high stock, future
clocks, signed wrap refusal and four-field projection. Master source cases require
the real dates/rules/hash after the deferred export rebuild. **NONE RUN.**

Scored30000 production and its attempt/debit/save/ACK/cold recovery, original
stage selection and rewards/HP/loop/score/history/ranking/defeat producers, ticket
sources, native availability, signatures, actual getter timing/initialization/
event-reset/achievement interactions, ABI and UI/back/no-crash/no-freeze/ANR/
performance acceptance remain unfinished or unverified. Counts remain **173
partial / 3 unsupported / 0 verified complete across176**. No tests, static/syntax
checks, generators, builds, listener restart, APK, ADB, MuMu, workers or Actions;
existing saves preserved and full-game goal active, co-op last.

## Observed native normal-entry debit - source-only partial, NOT RUN

Original mode28 stage-entry branch tests the training getter before selecting
the Union stage kind. Kind0 at `0x2173360:0x2173368` calls the normal consume
wrapper with amount1; training bypasses it. Native `0x2548038` first runs the
normal getter, resets the update clock to the actual time when stock is at or
above its threshold, then calls the original add helper with the negative amount.
The resulting decrement clamps stock to0..99; it is not a generic field-minus1
with an always-refreshed clock. Kind1 uses the separate boss consume branch;
kind2 selects its original configured resource path, still unfinished here.

The existing attempt projection now supports the individual queried family,
preserving the other family's raw saved pair when its getter was not called.
`unionRaidNormalEntryDebit` returns only the original one-point normal transition
after that getter and refuses to label zero stock a paid attempt. This is source
modeling, not a server-issued charge or a claim that native call timing was tested.

Shared source `user_data/push` now records a qualifying observed transition when
the actual owned active battle is first-stage1280000101101 and matches the current
acknowledged Familia's original entry. Entry origin/hash/calendar/time and full
four-field before/after observations are validated. Combined, stock-first and
battle-first saves can reach one permanent `union_raid_attempt_debit` record,
keyed by the actual entry request. The immutable entry JSON/hash, generation,
original event, observed time, complete native battle and saved stock are retained.
Insertion and validation reuse the profile/token/meta/sequence/reply transaction;
rollback does not leave a receipt while losing its native save. Repeated puts do
not create another debit or charge, and unchanged training stock creates no paid
record. A pre-existing opaque active battle is not backfilled merely by observing
unchanged stock. Entry decoding is shared with the preinitiation handler rather
than maintaining a second interpretation of its original capture.

This is an observed normal-entry branch, **not scored settlement**. Unmatched
imports/transitions remain width-codec-only until their original earning/ticket/
event-reset/debit/interleaving paths are integrated. No global post-debit stock
conservation floor or paid-result authorization is claimed yet. Exact delayed
getter/save timing, live cached-rule/event-reset behavior, boss/special-stage
costs, tickets and resource changes after the observation remain unfinished.
The future30000 producer must consume the real bound observation and validate
intervening native state before any HP/loop/score/medal/reward/history can earn.

New `test_union_raid_attempt_debit.cjs` source queues combined and both split
save orders, unchanged training, issuer/profile/reply rollback, no native/queue/
wallet precharge, immutable entry and battle/stock captures, exact repeated puts,
restart and malformed archive refusal. Expanded attempt cases cover individual
family initialization, normal threshold clock refresh, high-stock cap and zero
stock. All cases are **WRITTEN ONLY / NOT RUN**. Counts remain **173 partial /
3 unsupported / 0 verified complete across176**. No tests, static/syntax checks,
generators, builds, listener restart, APK, ADB, MuMu, workers or Actions; existing
saves untouched, full-game goal active and co-op last.

## Paid-attempt custody and native getter saves - source-only partial, NOT RUN

Observed normal-entry debits now establish `union_raid_attempt_checkpoint`, a
private one-row owned-player pointer plus exact actually saved four-field stock
and observed save time. The pointer must match the newest permanent debit's
SQLite rowid and original entry request. Read/save checks validate the original
entry/debit archive and reject missing, unreadable, downgraded or mismatched proof
and externally restored native counters, retaining the stored save. An indexed
rowid-tail seek is used instead of a scan over lifetime entries. Existing debit
history without its checkpoint is not backfilled into acceptance.

Later unchanged state or a proved family-specific native getter save may preserve
or advance custody. The actual saved family clock identifies constructor/day/
hour updates and must match the original getter projection; unchanged clocks
cannot authorize a stock increase. Unqueried counterpart fields remain unchanged.
Profile/token/meta, new debit when present, pointer/state, sequence and reply
commit together. Getter-save rollback cannot leave a checkpoint that claims an
unsaved balance. A later actual single-entry debit may become the new pointer;
this does not issue another charge, command, clear, reward or ACK.

After custody exists, unimplemented ticket/recovery/reset/debit/interleaving
transitions use semantic offline cancellation instead of storing arbitrary stock
or inventing a matching producer. Before any real debit, imported stock remains
codec-only. Delayed getter/save and live cached-rule/event-reset behavior, boss/
special-stage costs and tickets are still unfinished; this is not full resource
or scored-result support. Scored30000 must consume real captured debit and current
conserved state before reward/HP/loop/score/history can earn. Medal item/amount are
authored, but the normal battle's multiplication rule is still unproved; a traced
`UnionRaidStartEvent` is not enemy-defeat reward evidence.

Expanded deferred debit cases cover restored counters, missing/corrupt floor,
legitimate hourly refresh, getter/checkpoint rollback, old-state rewind and
restart. **WRITTEN ONLY / NONE RUN.** Current classification remains **173
partial / 3 unsupported / 0 verified complete across176**. No tests, static/
syntax checks, generators, builds, listener restart, APK, ADB, MuMu, workers or
Actions; existing saves preserved, co-op last and full-game goal remains active.

## Union Raid combined ticket recovery - source-only partial, NOT RUN

Original `unionRaidBossSpTicketItem.enc` contains one high-rank ticket411000001
with key `union_raid_boss_sp_ticket_item.1`; its source SHA-256 is
`29d708a0ce7527c47a1e15f1e3b77b18d4d4e290ce671b52b52da21be21d7595`.
Original `unionRaidNormalSpTicketItem.enc` contains one low-rank ticket412000001
with key `union_raid_normal_sp_ticket_item.1`; its source SHA-256 is
`7818a9a4d76838c4a8645ac6705c51ef150b431724a8c7a3655a514e91aed819`.
Both original descriptions restore one challenge attempt and mention event-
limited use. Decoder source exports these exact IDs/keys/families/native tables;
the old generated master receives a nonmutating, conflict-checked fallback.
Neither item is registered in generic acquisition producers before its real
reward/reset captures exist. No master generator was executed.

The native popup consumer `0x1515d58:0x1515e98` chooses boss or normal item type,
adds the selected count through `0x2541dcc` or `0x2541e50`, consumes the same
count through vtable+0x50 with signature0, and pushes with reason `ItemUsed`.
Capacity accessors `0x253f1a4` and `0x2547d38` both return99, distinct from daily3
and hourly-max10. Family additions use the original getter before capped signed
addition; the native selection must fit remaining capacity. Generic negative
item gain does not increase cumulative stock. Boss vtable42b9a58+0x38 is the
no-op book setter, and amount setter24b14a0 ignores signature0. Eight-field
writers2790414/2790760 preserve owner, ticketId, amount, reservedAmount,
bookEntryState, UInt32 signature, cumulativeAmount and Int64 lastResetAt. The
local consumption path is not proof of a publisher expiry/reset producer.

Matching combined idle owned-player/ticket saves now commit permanent full
before/after ticket and native SP observations to `union_raid_ticket_use`.
Per-item indexed latest stock pointers and a latest owned recovered-attempt
checkpoint preserve actual deductions/credits across repeated saves and restart.
No extra command, SP prewrite, battle charge, reward, score, clear or ACK is
issued. Original getter saves and later real bound entry debits advance ticket
custody; existing paid-attempt custody advances to the same actually saved SP.
All profile/token/meta, receipt/pointer, sequence and reply writes share the save
transaction. Missing/corrupt proofs or restored stock/attempts retain the old save
behind semantic recovery. Native validated ticket stock by itself is not scored
history and no longer blocks an idle raid lobby.

Acquisition, original server-controlled expiry/reset commands, split saves,
delayed/cached-rule/event-clock interleavings, simultaneous battle-debit/recovery
and scored30000 earning remain unfinished. These branches are not counted as
implemented by cancellation. Deferred `test_union_raid_tickets.cjs`, expanded
debit cases and future master-export assertions are **WRITTEN ONLY / NONE RUN**.
Counts remain **173 partial / 3 unsupported / 0 verified complete across176**.
No tests, static/syntax acceptance, generators, builds, listener restart, APK,
ADB, MuMu, workers or Actions; saves preserved, co-op last and full goal active.

## Union Raid ticket Presents and award-use lineage - source-only partial, NOT RUN

Both ticket item IDs/keys/native profiles now enter the source decoder and exact
runtime fallback. Conflicting supplied identities/hashes refuse rather than
overwrite existing catalogs. Original itemType rows200000044/45 cap each ticket
stock at999999999. Native domain vtables42b9a58 and42bd548 share positive
generic gain24d8844 and cumulative gain24d8d94. Their book setters24b17ac and
2518250 are no-ops. User constructors289d8c0 and289e754 initialize zero current,
reserved, signature, cumulative and reset fields with book1; lazy getters assign
the actual owner and ticket ID. Acquisition therefore preserves existing owner,
book, reserved and lastResetAt values, independently caps current/lifetime stock,
and saves the actual new native2000 signature even at full cap. Overflow of the
native signed addition is rejected before any issuer writes.

Actual saved flat Presents can now issue the original receivedItems quantities,
with permanent composite operation/ticket command, full before/after and immediate
award/use predecessor captures. No native row, claim flag or ACK is prewritten.
Per-ticket indexed latest award and stock pointers reconcile award -> use -> award
without scanning lifetime history or erasing deductions. Parent captures bind the
actual latest observed use or acknowledged preceding award. Generic gift stock
observation and full native row observation advance together with profile/token/
meta, stock pointers, flags/ACK, sequence and reply; internal readers cannot see
only one of those observations advanced. Missing/corrupt pointers or source,
restored stock, malformed archived command identities and unproved transitions
retain existing saves behind recovery.

Native zero initialization and flags-first/inventory-first save orders are
supported in source. Another same-item acquisition or ticket use waits for the
award's observed native row and real ACK. Cold command recovery omits only saved
entries, retaining unsaved mixed-family or stamina entries. Fresh/cached confirm
checks both families even before any ticket-use history exists. Claimed original
Presents are a real acquisition producer, not an invented raid reward schedule.
Other producers and original server-controlled expiry/reset, split ticket/SP
recovery, delayed/cached-rule/event-clock ordering and scored30000 still remain.

Deferred `test_union_raid_ticket_presents.cjs` covers both families, missing/owned/
lazy rows, cap/full-cap/signature/overflow, issuer/save/ACK rollback, initializer,
flags-first/inventory-first, replay/restart/corrupt/missing proof, mixed families/
stamina and award-use-award-use conservation. The generic Present matrix excludes
these separately guarded families; future master assertions include the exact
keys/profiles. **WRITTEN ONLY / NONE RUN.** Counts remain **173 partial /3
unsupported /0 verified complete across176**. No tests, static/syntax acceptance,
generator/build/restart/APK/ADB/MuMu/workers/Actions; saves preserved, co-op last
and full-game goal active.

## Split Union Raid ticket saves - source-only partial, NOT RUN

The original1515d58 sequence applies family SP before consuming the selected
ticket count and sending ItemUsed. Shared native saves can now preserve either
stock-first or uniquely matching attempts-first halves on one permanent use.
Additive stock_saved/sp_saved flags and an optional actual SP observation time
preserve old combined records. Unobserved SP is JSON null; unobserved stock is
only its captured target. No missing native effect, command, flag or ACK is
prewritten. Timer-only ItemUsed getter changes do not become recovery proof.

One indexed incomplete use retains its original catalog/time/baseline/full-stock
capture. The matching half advances that same row and actual stock/attempt
checkpoints with profile/token/meta, sequence and reply. Exact repeated puts do
not create a second use. Attempts-first original credit/time is kept unchanged
when stock arrives after ordinary getter saves. Supported getter delays remain
inside the original broad event window; saved clocks cannot rewind and a getter-
equivalent change cannot be promoted into recovered credit. Acquisitions, another
ticket family use, gameplay entry and bound battle debits wait for settlement.
Changed quantities/metadata, corrupt flags, conflicting or superseded partial
history retain all data behind semantic recovery.

Full client reload with a missing native half, day-reset ambiguity, cached-rule/
event-clock boundary and expiry/reset, simultaneous/coalesced recoveries/debits,
other earning sources and scored30000 remain unfinished. Retaining and matching
the second half after listener restart does not establish native cold-client
recovery or stability. New test_union_raid_ticket_split.cjs queues both families/
orders, first/matching-half rollback, repetition/restart, missing-effect retention,
acquisition conflicts, getter interleaving/immutable SP, restoration and malformed
flags. Existing combined source cases now permit stock-first. **WRITTEN ONLY /
NONE RUN**;173 partial/3 unsupported/0 verified complete across176. No tests,
static/syntax acceptance, generator/build/restart/APK/ADB/MuMu/workers/Actions;
saves preserved, co-op last and the full-game goal remains active.

## Guild Raid score rank projection - source-only, NOT RUN

The original completion and `guild_raid/status/get` consumers read a signed-int32
`rank`, while the separately recovered member and Familia ranking routes publish
the one acknowledged local cohort at rank 1. A positive scored completion and
the following status now use that same offline policy: an acknowledged positive
`UserGuildRaidRecord.scoreInt64` projects `rank: 1`; training and an untouched or
zero-damage lobby remain rank 0. The unrecovered peer-summary `ranking` array
stays empty rather than inventing remote Familias.

New scored receipts capture the local rank in both the completion reply and
saved status. Older immutable source-only receipts may contain rank 0 from before
ranking routes were implemented; reads project those to rank 1 only when the
receipt's validated target record proves a positive score. The original
completion operation and settlement remain unchanged. Rank values other than the
zero legacy value or the score-derived current value are retained behind
recovery instead of being normalized.

The local current-membership `familia/get` projection now derives
`latestGuildRaidRank` from the chronologically latest scored completion that is
both acknowledged and bound to that exact `creation_operation_id`. It reuses
the validated `guildRaidProgress` receipt and requires its target to equal the
saved native `UserGuildRaidRecord`; an imported or rewound record alone cannot
publish rank. A positive score is rank 1; no scored completion or
an acknowledged zero score is rank 0. A pending result, a former Familia
generation and the unaffiliated CPU join target cannot publish the rank.
Existing cached rank-0 details therefore become stale after the first real
scored ACK. The GvG rank fields remain zero because no corresponding earned
local result exists.

The shared progress lookup now selects the latest acknowledged scored receipt
even when its `stage_delivery` row is missing, then refuses it explicitly. It
cannot silently fall back to an older valid delivery and hide damaged current
history. Legacy immutable rank-0 delivery/status rows are still projected
forward without being rewritten when their validated target record proves the
positive score.

Deferred `test_guild_raid_scoring.cjs` and `test_guild_raid_status.cjs` cases
cover zero damage, positive nondefeat and defeat results, every authored stage
transition, current member/Familia score agreement, cold restart and legacy
rank-0 projection. The extended status case also covers `familia/get` cache
invalidation, current-generation rank persistence, corrupt rank, missing
latest-delivery and native-record rewind retention. WRITTEN ONLY / NONE RUN. Publisher-wide placement, peer
summary rows, native rendering/back navigation, performance and
no-crash/no-freeze/no-ANR acceptance remain unfinished. Coverage remains 176
partial / 0 unsupported / 0 verified complete; no tests, checks, generator,
build, listener, APK, ADB, MuMu, workers or Actions were run.

## GVE daily-score rollover and event-best separation - source-only, NOT RUN

The frozen client exposes `lastResetScoreAt` in both record importers, but the
only recovered setter references are those JSON/MessagePack imports. No client
gameplay path owns the transition. The offline operation23100 result producer
now projects one monotonic JST `clientDay` rollover from the immutable battle
admission timestamp. On a later day its daily comparison starts at zero,
`dailyHighScore` and `lastResetScoreAt` advance from the actual result, and a
clock rewind cannot reset or mint another daily qualification. This is an
explicit offline calendar policy, not recovered publisher timezone, scoring,
accumulation or reward arithmetic.

Event and daily custody are now separate. `bestGveCapture` selects the latest
acknowledged `is_new_high` receipt at `eventHighScore` and remains the source of
ranking score, historical name and leader. `gve_party_floor` instead identifies
the latest positive `is_daily_high` receipt copied into
`UserGvEHighScoreParty`. Split saves, late party binding, next-result admission,
player details and character usage validate that current daily-party receipt
without overwriting the immutable event-best capture. A lower positive result
on the next day can therefore update the daily score and native party while the
event board remains on the earlier high.

The deferred `test_gve_completion.cjs` scenario covers a next-JST-day lower
result, exact ten-field record, daily qualification flags, native party/record/
clear ACK, daily-score view, unchanged event ranking and player-detail party.
It is WRITTEN ONLY / NOT RUN. No tests, static checks, build, listener, APK,
ADB or emulator work was performed. Coverage remains 176 partial, 0 unsupported
and 0 verified complete; native rollover/copy/save/signature/UI/crash/performance
acceptance remains deferred until packet implementation is complete.

## GVE attempt-table codecs and route split - source-only, NOT RUN

Frozen ARM64 `AdventureManager::init` has two separate branches. Adventure
type 19 calls the wrapper at `2541144`, which loads the global player GVE
stamina domain and tail-calls `253e904` with amount 1. Adventure type 20 calls
`253dfac` with the selected original adventure-stage ID and consumes one entry
from `UserGuildEventStaminas`. The global `gveSP` fields therefore must not be
reused as modern Guild Event stamina, and the per-stage rows must not be used
for the legacy weekday route.

`UserInfo.playerStatus.gveSP` is guarded as signed int32 and
`gveSPLastResetAt` as a safe int64-compatible integer on both profile reads and
native saves. `UserGuildEventStaminas` requires its exact singleton root, owned
user ID, safe reset clock, unique `{guildEventStageId,sp}` rows, an original
adventure type 20 stage identity and non-negative int32 SP. The separate saved
`UserAdventureState.userGvEScore` codec is exactly
`{gveStageId:int64,totalDamage:int32,turnCount:int32}` and must join its original
stage and mode. Malformed, duplicate, legacy-stage and foreign-stage rows are
retained/unavailable instead of normalized into usable attempts.

The exact getter rules are now implemented source-side. Legacy `253e46c`
updates only on a later native day: an empty/nonpositive stock becomes one,
positive carry-over is preserved, and `lastResetAt` is stamped. `253e904` then
consumes one and clamps to `[0,999999999]`. Modern `1a23828` selects one enabled
type-20 event by Adventure display slots 8/9 using start-inclusive/end-exclusive
time. `253d944` resets every existing row on a later native day or after the
active event's open slot 6, `253db9c` uses authored `gveInformation` slot 9 as
the default (5, 0, 20 or 99 across the sixteen archived events), `253dcc0`
creates a missing selected-stage row, and `253dfac` consumes one with a zero
floor.

The ordinary `AdventureEnter` native save is now the custody boundary. An exact
initialized GVE battle plus its global or per-stage post-debit state is validated
before the shared SQLite transaction, then an immutable `gve_attempt_entry` is
inserted atomically with the profile rows. A new 23100 result binds the newest
unspent receipt for the current Familia generation and matching mode/event/stage;
the completion and entry retain each other's immutable IDs. Pending delivery,
real acknowledgement and settled history reads revalidate that bidirectional
link plus the original admitted timestamp. Existing linked rows are backfilled
losslessly by schema migration, while a missing or mismatched side is retained
for reconciliation rather than silently treated as an imported battle. An
abandoned newer entry cannot be charged to an older result. One pre-custody
imported battle remains compatible when no receipt exists, rather than corrupting
an in-progress save during migration.

The call at `20c0d88` iterates the dirty-domain map and constructs one batched
user-data payload after `AdventureManager::init`; the type-19/type-20 branch then
calls it once with `AdventureEnter`. The source implementation therefore keeps
the battle identity and attempt debit in one SQLite transaction instead of
inventing an unsupported independent half-save. Durable request replay covers a
lost response. A later valid `AdventureEnter` atomically marks every earlier
uncompleted current-Familia receipt as superseded by the new entry, preserving
the evidence without leaving an abandoned attempt eligible for a result. A
bound result uses the receipt's admitted event time for weekday/window and daily
record attribution, so changing the selectable event clock after battle entry
does not turn an otherwise valid completion into error 1003.
The original `AdventureRetire` save is a separate terminal transition: it must
move the matching active GVE battle to stage/GVE ID zero with the native empty
score, and atomically stamps only that newest open receipt as retired. It neither
refunds the consumed attempt nor lets a later result reuse it. Any older open
rows from the pre-supersession schema are retained and linked behind the same
active receipt during this transition.

Deferred `test_gve_completion.cjs` cases now also specify all seven legacy and
sixteen modern authored defaults, modern and legacy reset/create/debit saves,
durable receipt creation, re-entry supersession, post-entry clock movement,
one-time result binding, native retire closure, pending and acknowledged restart,
and corruption refusal for either side of the entry/result pointer. WRITTEN ONLY
/ NONE RUN. Natural native legacy entry and real dirty-map batch/replay behavior
still require the consolidated acceptance pass. This remains partial and unverified,
not a playable/stable claim. No tests/static checks/build/install/listener/
emulator or GitHub Actions ran; all 176 routes remain partial and native
acceptance is deferred until packet implementation is complete.

## Union Raid completion settled retry - source-only partial, NOT RUN

An exact `union_raid/stage/complete` identity no longer becomes an artificial
communication error solely because its original operation5000 practice result
or operation30000 scored result was correctly saved and acknowledged. Pending
retries retain the original guarded response. A settled retry reconstructs the
immutable command only from its permanent completion or stage-delivery capture,
requires no queued copy and one done row, the same current Familia generation,
one owned saved stage, the real cleared `UserAdventureState`, and the current
training history or exact scored `union_raid_progress` checkpoint. The scored
path additionally requires the original status-after bytes and acknowledged
stage floor through the existing full capture validator.

The retry returns the original result-screen roots but removes the singular
operation and returns `operations:[]`. It therefore cannot repeat the clear,
normal-SP debit, HP/loop/defeat/score transition, stage save or acknowledgement.
An older identity after a later acknowledged result deliberately refuses rather
than projecting stale progress. Former-Familia, active-battle, missing/corrupt
command, missing floor, and both/neither queue/done states also retain data and
refuse.

Deferred `test_union_raid_completion.cjs` source now covers the acknowledged
practice no-op and restart. Scored popup-only replay, corruption, later-result
and native result/back/save-order cases are listed in the consolidated plan.
All are WRITTEN ONLY / NONE RUN. No tests, static/syntax checks, generators,
builds, listener restart, APK, ADB, MuMu, workers or Actions were used. Native
presentation, crash/freeze/ANR/performance and publisher parity remain
unverified; counts remain 176 partial / 0 unsupported / 0 verified complete.

## Union Raid acknowledged-defeat progression handoff - source-only partial, NOT RUN

`union_raid/status/get` now reconstructs all exclusively acknowledged scored
completions for the current Familia generation in operation order. Every
immutable capture must begin at the preceding `statusAfter`, and the final
projection must equal the materialized `union_raid_progress` row. Missing,
duplicated, reordered, foreign-Familia, pending, corrupt, or disconnected
history therefore remains unavailable instead of fabricating a later loop.

The native five-field `UserUnionRaidInformation` row may now retain a positive
`readDefeatCount` only up to the acknowledged progress count. Unviewed real
defeats are returned as `displayDefeatInfo[{stageId,loopCount}]`, with the stage
and pre-defeat loop taken from their immutable type-30000 capture. Once the
client saves the corresponding viewed count, those rows disappear without
changing score, rewards, or battle history.

`union_raid/status/preinitiation` accepts the exact current nonnegative defeat
count. A prior entry whose attempt was consumed can be replaced only if that
debit has exactly one exclusively done scored completion and the completion is
the current progress checkpoint and stage. An unused old entry cannot skip to
changed progress, and a consumed but unsettled entry cannot be overwritten.

Deferred pure display mapping assertions and the consolidated positive-defeat,
viewed-counter, second-loop entry, history-corruption, stale-entry, rollback,
restart, and native-flow cases are WRITTEN ONLY / NONE RUN. The battle,
intermediate, and result score arrays stay empty because publisher bonus/enemy
semantics have not been recovered. Native defeat animation, second-loop
battle/save/ACK order, result/back UI, performance, and crash/freeze/ANR
acceptance remain unverified. No tests, checks, generators, build, listener
restart, APK, ADB, MuMu, workers, or Actions were used.

## Union Raid total-score status log - source-only partial, NOT RUN

Final `unionRaidLogGroup.enc` SHA-256
`cd7624ad2042def5654e3b0b17b0e6a959152f8a21ef1842e01b06ffde7a0adf`
contains the sole group `432000001`. Final `unionRaidLog.enc` SHA-256
`09268903584c84eb8bfd46788a3806f59d1d22674f12039430c841c355c74491`
contains 28 contiguous IDs `433000001..433000028`: seven rows for each
type 1-4. Exact callback `0x248841c` resolves every wire `logId` through this
master, reads its type and score, and uses types 2-4 to interpolate an enemy
label. Type 1 instead carries the authored `Total Score\nOver {0}!` message and
thresholds 500,000, 1,000,000, 1,500,000, 3,000,000, 5,000,000, 7,500,000,
and 10,000,000.

Each newly issued scored type-30000 completion now stores the current validated
Familia name and god ID with its existing immutable score transition. The
schema migration adds nullable columns so old databases are preserved rather
than rewritten. `union_raid/status/log` reconstructs the full acknowledged
current-Familia score history and emits a type-1 row at the timestamp of the
first receipt crossing each threshold, newest first. A gap, rewind, missing
crossing capture, missing historical Familia snapshot, or conflicting original
catalog retains the data and refuses rather than substituting current settings.
An old score history below 500,000 still returns the truthful empty list.

Types 2-4 remain absent because their per-enemy score producer and enemy-index
semantics have not been recovered; no enemy milestone or label is fabricated.
The decoder and deferred master/pure assertions cover exact rows, thresholds,
ordering, empty-below-threshold behavior, discontinuity, and missing snapshots.
They are WRITTEN ONLY / NONE RUN. Native log text/list order, back navigation,
cache/restart recovery, performance, and crash/freeze/ANR acceptance remain
unverified. No tests, checks, generator, build, listener restart, APK, ADB,
MuMu, workers, or Actions were used.

## Union Raid member ranking - source-only partial, NOT RUN

Raw wrapper `0x2394820:0x2394d24` sends exactly
`{rankingType:int32,unionRaidInfoId:int32}`. Recovered callers use ranking types
1, 2 and 3. The shared member-ranking parser at `0x23a6c54` consumes root
`ranking` rows containing `rank`, `score`, and
`member{userId,name,leaderPc{pcId,jobRank,heroSublimateLevel,isUnlockedHeroSublimate}}`.

`union_raid/ranking/member/get` now validates that exact body and the sole
recovered event. Type 1 projects one local rank-1 row only after all visible
battle rows come from acknowledged immutable type-30000 results and their `p1`
scores sum exactly to the materialized current-Familia `familiaScore`. The row
uses the latest captured player name and owned leader snapshot. A zero score is
an empty ranking. Final original `message.enc` SHA-256
`a5814e507ed34a86886336f396d99a14e3bc47173891a492ce39d9dfe72760a5`
labels types 1, 2, and 3 as Total, Monster, and Medal (rows 40630016-40630018),
and rows 40630147-40630148 define Medal Score as medals used during Alliance
upgrade. Type 3 therefore sums the exact positive `medal_amount` values in every
validated durable `union_raid_skill_growth` receipt for the current event and
Familia generation and publishes the current validated local owner/leader at
rank 1. Imported or synthetic skill progress without a local growth receipt is
deliberately excluded. Type 2 remains empty because no local Monster/enemy
ranking producer has been recovered. The server does not substitute total score,
invent a peer population, or assign an unsupported publisher rank. Cached reads
rebuild the same projection so later score, receipt, or member changes cannot be
hidden behind an old response.

Deferred `test_union_raid_status.cjs`, `test_union_raid_scored.cjs`, and
`test_union_raid_skills.cjs` cases cover
exact and malformed category bodies, no-membership refusal, fresh empty rows,
acknowledged local totals, type-2 emptiness, type-3 exact receipt totals, imported
progress exclusion, score/log/progress disagreement, damaged snapshots, cache
invalidation, current-Familia generation changes and restart. WRITTEN ONLY / NONE
RUN. Native ranking tabs/details/back rendering, publisher population semantics,
Monster/enemy producers, peers/co-op, save order,
performance and no-crash/no-freeze acceptance remain unfinished or unverified.
Current classification is 176 partial / 0 unsupported / 0 verified complete
across 176 tracked routes. No tests, static checks, generator, build, listener
restart, APK, ADB, MuMu, workers or Actions; existing saves remain untouched and
the full-game goal remains active.

## Union Raid defeat acknowledgement - source only, NOT RUN

The final native wrapper at raw `0x2144404:0x21447d4` sends exactly
`{unionRaidInfoId,debug:false}`. Its relocated success closure at `0x22470ec`
does not parse or import reward data; it ignores the JSON argument and invokes
only the captured completion callback. The final original
`unionRaidDefeatReward.enc` SHA-256 is
`7b77330efb6be5f2d6de103d7a2b6572fa2ca3a5267290f0558cfad376c3305d`.
It contains one decoded row, `{id:418000001,key:""}`, and no item identity,
quantity, operation type or inventory table. Separate daily, total, SP and
Familia ranking reward tables are not evidence for an item payout on this
callback.

`union_raid/reward/defeat` now accepts only that exact request for the current
settled Familia generation after all Union Raid operations are saved. It finds
only acknowledged immutable type-30000 receipts whose captured transition
increments `defeatCount` by one and whose command sets `defeatNow:true`. One
transaction stores the actual request/body hash, sorted source operation IDs,
original-catalog/source hash, claim time and exact `{code:0}` response, plus one
unique claim row per defeat operation. Exact retries revalidate and return the
same response after cache loss; copied or changed requests, cross-generation
claims and missing, malformed or rewound receipts retain state and fail closed.
No inventory row, currency, medal, Present, signed command or native profile is
created by this route.

`status/get` now computes `defeatRewardExists` from acknowledged unclaimed
defeat operations instead of trusting the historical boolean in the last
progress JSON. Claiming changes the projection from true to false without
rewriting that battle receipt. The next scored ACK compares its captured
`statusBefore` against the same projection, allowing a later defeat to make the
flag true again while preserving ordered score/HP progress.

Deferred master, scored, claim, replay, cache/session/restart, later-defeat,
former-Familia, corruption and rollback cases are written into the consolidated
checklist and existing test sources; **NONE RUN**. The master decoder source is
updated, but its generated export is intentionally not refreshed in this phase.
No test, static/syntax check, generator, build, listener, APK, ADB, MuMu, worker
or GitHub Actions execution occurred. Current bookkeeping is 175 partial / 1
unsupported / 0 verified complete across 176 routes. Native popup/save/UI/back,
publisher item rewards, the separate ranking reward systems, performance and
no-crash/no-freeze/ANR acceptance remain unfinished; co-op stays last.

## Missing-half Union Raid import - source-only partial, NOT RUN

The original cold pull20bcb3c imports MessagePack table values through27f0fec
at20bcd20 with w3=0. Its subsequent20c2ac8 serialization calls27e1350 with
w3=0. UserInfo importer25f9748 explicitly clears its dirty byte at25fac24
(`strb wzr,[x19,#0x8a0]`). This is a clean data import, not proof of a newly
uploaded native delta.
The existing scored Guild Raid record projection is a server precedent only;
its23200 consumer imports records explicitly and is not a general SP command.
Neither140000 (an item-reset token tag) nor the serial-PvP30100/30200 consumers
is reused as an invented Union Raid grant.

Fresh confirmation or a pull requesting the missing table now captures one
immutable per-use projection/hash pointer, bound to the original native use,
baseline, exact deduction, catalog and capture clock. For stock-first recovery,
the selected-family original getter/credit must have one distinguishable target;
the original selected-family balance/clock are placed in a clone of current
UserInfo. Other attributes and the other family's actually saved pair remain
unchanged. For attempts-first recovery, the target is only the original full
ticket row after deduction. Confirmation and pull share a derived token, without
writing a native profile, observed-effect flag, command, reward, charge or ACK.
Unrelated-table pulls do not issue an import; cached/read-only paths cannot
manufacture a capture. Lost/corrupt binding, active battle, unsafe calendar/clock
or ambiguous original recovery retains saved data.

A captured attempt projection is an additional valid delayed-save root, so
uploading that snapshot later does not require a fictional current-time getter.
Actual native rows alone close the existing pending use through the original
atomic save transaction. A current unrelated UserInfo change is retained in
subsequent projections, whose tokens invalidate stale cached confirmations and
pulls. Cached push replies still compare actually saved tokens rather than a
cold import projection, so a valid unrelated options save is replayable while
the missing half is pending. Permanent captures use indexed per-use lookup,
not lifetime scans.

The newer marked-import adapter below supersedes the unimplemented ARM64 flush
note in this milestone only for source. An idle cold client's natural import
and upload remain unverified. This server branch is therefore NOT full native
cold-client recovery acceptance. The deferred
test_union_raid_ticket_import.cjs covers synthetic both-family/order recovery,
capture/save/reply rollback, unchanged actual flags/profiles/ACKs, requested-table
scope, token/MessagePack coherence, replay/restart, unrelated-field changes,
missing/corrupt binding, delayed imports and no duplicate use. WRITTEN ONLY /
NONE RUN. Day-reset ambiguity, advanced unsaved clocks, cached-rule/event expiry,
coalesced uses/debits, other earning sources, scored30000 and native stability
remain incomplete. Counts remain173 partial/3 unsupported/0 verified complete
across176; no tests/static checks/build/install/restart/emulator/workers/Actions.
Existing saves remain untouched and the full-game goal stays active, co-op last.

## Marked native Union Raid import save - source-only partial, NOT RUN

Original UserInfo25f9748 clears dirty byte8a0 at25fac24. Boss28111ec and
normal28115f4 row importers clear their dirty byte158 at2811518/2811920.
Their cold parent27f0fec calls them with returns27f298c,27fe6fc and27fe854,
then retains ticket rows through271b150/271c064. The outer pull call returns
at20bcd24. Pull frame SP200/208 has no original local access; the new intent
occupies those two slots only for that invocation. All original row setters,
repository insertion, table serialization and parser/token validation remain.

Only the missing-half wire row carries int1 `offlineUnionTicketUse`. The
canonical target/token and native SQLite profiles never contain this optional
marker; the shared native put/delete boundary rejects it in all three tables.
The ARM64 patch source checks both original return addresses before reading
the live import map or outer pull frame. Original MessagePack integer kinds2/3
with exact value1 are required; missing, bool, string, other kind/quantity or
foreign callers retain the original clean import. The marker's fixed21-byte
CString is inline. Its hook records only the imported row's dirty-byte pointer
in pull SP208, with intent1 atSP200. It does not dirty the row during import.
Two different marked pointers make intent2 and suppress the forced save.

At original20bd150 the thunk first runs20c839c parser cleanup. Only original
pull successW20 and one nonnull intent1 pointer permit setting that row's dirty
byte to1. It clears the per-pull intent before queueing original20c0d88 with
the same ItemUsed reason/three zero arguments/empty callback as1515e98. No
grant, deduction, counter, signature, authentication, command or ACK is changed
or bypassed. Original canonical writers supply the real uploaded row, and the
existing permanent recovery capture closes only when that upload matches.
Failed/unmarked/ambiguous pulls cannot force dirtying or enqueue this recovery.
No text-section writable global, lifetime scan or fresh command is introduced.

Padding153f720:153f8f0 and original instruction fingerprints are encoded only
in patch source; no binary patcher, build, static/syntax check, signing,
installation, listener or emulator has run. Deferred native-patch cases cover
spans, original code retention, all scoped continuations/branches, frame/marker/
type/argument ownership, deferred dirtying, conflict suppression and mismatch
refusal. Server cases assert marker scope/nonpersistence and reject saved wire
markers. WRITTEN ONLY / NONE RUN. Natural cold import/save/sequence/tokens,
failure/retry/multi-table timing, pointer lifetime, both ABIs and native
performance/no-crash/no-freeze remain unverified. ARMv7, day-reset ambiguity,
advanced unsaved clocks, cached rules/event expiry, coalesced uses/debits, other
earning and scored30000 are unfinished. Counts remain173 partial/3 unsupported/
0 verified complete across176; co-op last, full-game goal active, saves untouched.

## Projection refresh after observed raid timer advancement - source-only, NOT RUN

A pending UserInfo projection may become unusable after an uncredited native
getter saves a newer selected-family clock. Fresh confirmation or a pull of
that missing table now derives a replacement from the original use and original
getter rules. It does not add the quantity to a previously projected state or
to today's saved stock. A projection that is still deliverable stays unchanged;
stock-row projections are not timer-rebased. Cached/read-only paths never create
or revise captures. Owned idle state, the actual native attempt checkpoint,
nonrewound clock and one distinguishable original target are required. Unknown
or erased/getter-equivalent credits remain retained rather than fabricated.

The additive import_parent_hash pointer and indexed import history retain the
old full projection/hash, actually saved uncredited snapshot/time and successor
hash. Current and immediate predecessor checks bind the revision to the same
original use, a genuine selected-family clock advance and unchanged other-family
native pair. These are bounded indexed lookups, not recursive lifetime scans.
Historical capture, current replacement, pointers, sequence and reply commit
together. No native profile, ticket stock, actual-effect flag, command or ACK is
prewritten. An older client snapshot cannot rewind the newer actually saved
clock; only the matching canonical native upload settles the original use.
History remains after settlement and restart, and missing/corrupt/downgraded
predecessor or history checkpoints retain all saved data.

Deferred test_union_raid_ticket_import_clock.cjs queues successive normal-hourly
revisions, capture/reply rollback, unchanged actual profiles/flags/queue,
original one-ticket conservation and clock/other-family retention, token and
MessagePack coherence, stale cache/obsolete snapshot refusal, repetition/restart,
missing/damaged history and pointer, canonical completion/no second use and an
erased boss-credit daily-reset refusal. WRITTEN ONLY / NONE RUN. Getter-equivalent
day/full-cap states, unsaved/mixed-family clocks, cached rules/event expiry,
coalesced uses/debits, other earning, scored30000, ABI parity and native
performance/no-crash/no-freeze acceptance remain unfinished. Counts remain173
partial/3 unsupported/0 verified complete across176. No tests/static acceptance,
generator/build/install/listener/emulator/workers/Actions; saves preserved and
full-game goal active, co-op last.

## Getter-equivalent raid import upload witness - source-only, NOT RUN

Original pull20bce60:20bcef4 stores dataTokens under `user_data/token/` without
turning them into a checksum. Original save20c110c:20c11ec reads that prefix
from LevelDB and adds each returned string to the request's dataTokens object
at20c13a4:20c13dc. Its before/after checksum maps are constructed separately.
Recovery versions now bind the original use, import capture and canonical
payload hash. Even an unchanged canonical row has a recovery version distinct
from its data checksum. Original checksum/auth handling remains untouched.

A day reset or full-cap getter can make a real ticket use's later counter state
identical to an uncredited getter. A unique original target may now be projected
in that case, without marking an effect observed at confirmation or pull time.
Only a fresh successful requested UserInfo pull captures a small indexed
delivery/version/target receipt with the existing sequence/reply transaction.
Read-only/cached pulls and confirmation cannot create this proof. Failed delivery
or reply storage rolls it back. It does not write a native profile, resource,
completion flag, operation or ACK.

For an alias, actual user_data/push must include the owned canonical UserInfo
row, the native adapter's ItemUsed reason and the echoed version of a recorded
delivery for the current import capture. The four saved attempt fields must be
the delivered state or its original getter successor, with no saved-clock
rewind. A version alone, empty save, no actual pull, ordinary timer update,
unknown/stale version or incorrect native state cannot finish an alias. The
matching actual save stores its permanent sp_delivery_token and delivered root
with profile/token/flags/checkpoints/sequence/reply, without another ticket
deduction or grant. Missing/corrupt delivery proof retains the save after closure
and restart. Naturally distinguishable original credit saves retain their
existing save observation path without requiring this extra witness.

Deferred test_union_raid_ticket_import_witness.cjs queues both-family day/cap
aliases, unchanged-row version mismatch, confirmation/read-only/no-pull proof
refusal, delivery/reply/save rollback, cache/restart, wrong/unknown version,
trigger/state and empty save, corrupt/lost proof, actual canonical completion,
duplicate/no second use/command/ACK and restored-stock refusal. Older import and
clock cases now permit alias projection while retaining unobserved effects.
WRITTEN ONLY / NONE RUN. High-stock older-clock reconciliation, mixed/unsaved
timing, cached rules/event expiry, coalesced uses/debits, other earning,
scored30000, ABI parity and native lifecycle/version echo/performance/no-crash/
no-freeze remain unfinished. Counts remain173 partial/3 unsupported/0 verified
complete across176; no tests/static acceptance/build/install/listener/emulator/
workers/Actions, saves preserved and full-game goal active, co-op last.

## Original frozen high-stock clock restoration - source-only, NOT RUN

The original boss getter tests stock before the daily predicate; the normal
getter tests stock before hourly refresh. At boss daily3 / normal maximum10 or
higher, the original selected balance and clock remain unchanged. After a ticket
raises stock to that threshold, its correct native clock can be older than a
later actually saved uncredited getter. Serving the original captured high-stock
target now preserves that native clock rather than inventing a newer timestamp.
The target must still be derived from the same original use, and the original
getter must leave its selected pair unchanged. Low-stock refresh stays intact.

Actual save permits only that selected-family clock restoration and only for a
real requested recovery pull followed by an owned canonical UserInfo ItemUsed
upload carrying its recorded version. The selected balance and clock must equal
the exact delivered original high-stock pair. Rewinding the other family, an
invented clock, changed/low stock, no actual pull, missing/unknown version or
other trigger remains rejected. Actual profile/token, observed delivery pointer,
stock/attempt checkpoints, sequence and reply commit together. Confirmation and
delivery do not alter native profiles, grant stock, deduct another ticket or
issue a command/ACK; permanent proof remains after closure/restart.

Deferred test_union_raid_ticket_frozen_clock.cjs queues both families, early/late
projection capture, original threshold/old-clock preservation, unchanged actual
profiles/flags/queue, no-pull/missing/unknown version and wrong trigger, altered
other/selected clock and low stock, save rollback, actual matching upload,
duplicate/no second use/command/ACK and restart. WRITTEN ONLY / NONE RUN. This is
not general clock rollback or proof of native stability. Mixed/unsaved ordering,
cached rules/event expiry, coalesced uses/debits, other earning, scored30000, ABI
parity and natural import/version/save/debit/performance/no-crash/no-freeze remain
unfinished. Counts remain173 partial/3 unsupported/0 verified complete across176;
no tests/static acceptance/build/install/listener/emulator/workers/Actions,
saves preserved, co-op last and the full-game goal remains active.

## Guild War information phase cache - source-only, NOT RUN

The final `gvg/info/get` wrapper sends exact `{gvgId}`. Callback `0x232ca28`
requires `result: 0`, then consumer `0x232e2d0` reads signed-int32 `term` and
int64 `nextTermTime`. The existing original-clock projection is now a shared
builder used by both fresh responses and exact cached replay validation. Term 0
precedes preparation, term 1 covers preparation, term 2 covers battle through
`battleEndAt` inclusively, and term 3 covers the remainder through
`eventEndAt`. Each response carries the next authored transition time.

Crossing a phase boundary invalidates the old exact response with recovery
3000999; it can no longer restore a stale term after the event clock advances.
A well-formed known event outside its original window uses the same recovery
path rather than malformed-request status. The packet remains read-only and
creates no Familia, opponent, battle, score, reward or profile history.

The extended deferred `test_gvg_status_get.cjs` case covers exact malformed
requests, all four term payloads, unchanged replay, every stale boundary,
inclusive battle end and final expiry. WRITTEN ONLY / NONE RUN. Native phase
screen refresh/back behavior, anomalous archived schedules, battle producers,
multiplayer, performance and no-crash/no-freeze/no-ANR acceptance remain
unfinished. Coverage remains 176 partial / 0 unsupported / 0 verified complete;
no tests, checks, build, listener, APK, ADB, MuMu, workers or Actions were run.
