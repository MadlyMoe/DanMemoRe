# Under Telskyura packet implementation

Status: **source-only, partial; NOT logically tested, built, installed or native accepted**.
Actual player save, listener, APK and MuMu remain untouched. No Actions/workers;
co-op comes last. Syntax checks and regenerated metadata are not gameplay proof.

## Current final ranking rows and type2 titles — source only, UNTESTED

Original24eb4f8/25f277c consumes `underPvpRanking` rows with exactly six
fields: userId (long), name (string), pcId (int32), gradeId (long), rank and
score (int32). The cached parser references3659b80/32beaa4/3597bfb/32beb23/
33c5eb9/3491ae9/32f13a0; strings were read from the original ARM64 client at
the existing100000 address bias. This was original binary/source reading,
not a syntax/static acceptance check, client run or new decompilation process.

Fresh summary now returns one real local final-standing row after an earned
publication. It uses the current owned player's name, actual final grade/
rank/score, and slot1 PC from the immutable fully saved battle party. Original
CPU rivals are not manufactured population standings. Unpublished or legacy
unattributed seasons still have no fabricated row. Fresh and permanent cached
summary comparison share the same constructor: stale pre-publication, empty
legacy or renamed-player rankings cancel instead of restoring older data.
No extra endpoint or native/private field is added to the six-field row.

Original2501050/type2 reads title.slot17's **own** Under season, requires
information.slot9 STRICTLY before AppTime, inclusive title.slot18/19 rank
bounds and native Under record isAggregate. It does not require the current
display season or claimed Presents. The original title data contains114
type2 conditions for19 seasons. New native `UserTitleBadge` puts now require
that exact original condition and actual earned published local rank; forged
aggregation, incomplete results, another season or a nonmatching rank cannot
substitute earning proof. Existing type9/Abyss validation remains separate.

New private `under_pvp_title_badge` receipts record actual local owner, badge,
season, fully saved battle, award clock and original-condition hash, in the
same native profile/token/selection/sequence/reply transaction. There is no
server-injected native badge, fabricated operation or wallet/item award.
Bounded original-catalog reads validate retained receipts and actual two-field
badge presence; related pushes/pulls and login/confirm use the guards. Once
owned, repeats, clock rewinds and equip/unequip changes keep the original
award date and source. Legacy already-owned badges retain their rows without
inventing an award date or backfilling a receipt. Source schema only; no
migration was executed.

Extended `test_under_pvp_ranking_rewards.cjs` and `test_title_badges.cjs` are
**WRITTEN ONLY / NONE RUN**: exact six-field native row/current name/frozen
leader/once-only local standing, stale empty/pre-publication/renamed replies,
no title from incomplete or unpublished history, strict equal-versus-after
cutoff, wrong rank/season, combined native badge plus selected title, profile/
receipt/reply rollback, repeated save/reopen, native badge loss, owner/season/
battle/date/catalog corruption, stale binary title pull, no wallet/operation
grant, before-claim eligibility and clock-rewind selection persistence.
Fixtures are disposable/synthetic; they do not prove natural client earning,
timing, signatures, row rendering, title UI or save ordering.

This supersedes only the prior missing six-field final-ranking constructor
and type2 new-save earning guard. Publisher population rankings/grade bonus,
legacy participation reconciliation, other unfinished Under branches and
all other packet variants remain incomplete or unverified. No tests/smoke/
syntax/static acceptance/generator/build/package/install/restart/emulator/
ADB/workers/Actions ran. All149 packets and unfinished branches before the
consolidated test pass; co-op last.

## Current solo-local final ranking prizes — source only, UNTESTED

`under_pvp_ranking.cjs` now selects the exact original first-place group
prize: information.slot7, reward.slot1, inclusive ranks.slot2/3, and five
item/amount pairs.slot4..13, recovered from original1bf9b08/1bfa564 and
29b7300. Current original group1 pays250 Iris and2 tickets296000014.
This does not interpret the final max-rank0 sentinel or the empty original
grade-ranking-prize table. It does not invent a bonus prize.

The policy is explicitly **a single participant in a local league**, not
publisher-wide rank1. At original matching close.slot9, a fresh login,
confirmation, relevant Gift/record pull or Under summary can publish local
rank1/aggregate=true and permanent ranking8 Presents. ReceiveReward already
defaults true in native288e5c8, but21dab6c does not merge it: publication
preserves its actual saved boolean rather than requiring an unissued setter.
That flag is not earning proof. Display.slot10/11 stays separate.
The initial prize milestone left `underPvpRanking` empty and type2 earning
unchecked. The newer source-only section above supersedes those two gaps;
publisher population standings and native acceptance are still not claimed.

Publication requires a fully saved local battle, no active Under battle or
native processing, and a retained zero-counter first battle plus once-only
local attempt count tied to the first/latest original captures. Native end
has no operation ACK: all original resource/info/status/result/processing0/
rematch proofs must save before incrementing participation. Two nullable
private floor columns are added in source only, inside the existing result
transaction. Legacy missing counts and imported nonzero participation retain
their saves and do not receive an inferred/backfilled prize; later play does
not erase that ambiguity. No lifetime battle scan or SQL JSON function is
used. No schema migration was executed.

Separate permanent season/gift receipts preserve exact native Present IDs,
original catalog/items and actual2000 claim/ACK ownership. Production does
not credit a wallet or native item stock: ordinary gift/receive handles Iris
and the original ticket acquisition/save/ACK. The shared allocator includes
retained Under gift IDs even after native cleanup. Record and gift read/
push/delivery guards retain publication identity and prevent unclaiming,
forging quantities, losing receipts or reverting rank/flags. Clock rewind
does not reopen matching in a published season. The combat floor remains
immutable; only its separately earned publication overlay changes summary
and native record expectations, including late refresh proof comparison.

Gift/profile/token/participation/receipt/publication/queue/sequence/reply
writes reuse the outer transaction. Cached comparisons stay read-only and
cannot restore an older rank or remove new Presents. Launcher runtime asset
selection includes the new module in source; no build/package/install ran.

New `test_under_pvp_ranking_rewards.cjs` is **WRITTEN ONLY / NOT RUN**: all
54 original season prize selections, malformed/overlapping rows, unfinished
and partial end, matching close boundary, publication and receipt rollback,
reopen/cache eviction/stale pull/summary, flags/gift forgery, receipt/counter
corruption, actual2000 ticket acquisition/native flags/ACK, duplicate claims,
clock rewind/fresh matching refusal, legacy missing counts and imported
participation and preserving a false received flag without manufacturing a
native setter. Fixtures are disposable and synthetic, not native earning,
signatures, timing, UI or rendering proof. Existing Under battle/refresh/
rematch/pass and gift/server regressions remain deferred too.

Remaining after the newer section above: imported/legacy participation
reconciliation, unavailable publisher population-rank/grade bonus rules,
other unfinished packet branches and native acceptance. All149 packets and
unfinished branches must be implemented before the consolidated test pass.
No tests/smoke/syntax/static acceptance/generator/build/package/install/
listener restart/emulator/ADB/workers/Actions ran for this change.

## Current nearby old/new battle stamp ordering — source only, UNTESTED

Original24eb9a0 changes the counter/intent, while1950f68/28924bc independently
saves battle AppTime. A counter/intent-only put carrying the exact previous
stamp now remains unobserved even inside the start tolerance when no new
processing evidence exists. The previous outside-window wait still applies.
New processing evidence can bind an unchanged in-window frozen-clock stamp;
restart/end still require every original start resource/info/status proof.

If that bound stamp still equals the captured previous value, its exact
gameStatusBefore exists, the native before-row still holds it, and no restart
or result has consumed it, an explicit native GameStatus put may replace it
with the first distinct timestamp inside the original start window. The same
predicate is used by callback-effect projection and battle observation, so a
delayed counter callback does not lose its link during that transition.
The first distinct stamp, an accepted restart's durable request, or an issued
result freezes the checkpoint; later different stamps cancel. Legacy missing
native-before fields do not gain guessed replacement permission.

Native profile/token, refresh and battle observations, sequence/reply still
share the existing transaction and rollback. No native prewrite, SP/medal
duplicate, result/usage manufacture, new wire field or schema column. A source
CREATE INDEX on existing battle-request (battle_id,action) keeps the consumer
lookup bounded instead of scanning request history; no migration was run.

Extended test_under_pvp_battles.cjs adds six **WRITTEN ONLY / NOT RUN** cases:
nearby counter-first, intent-first, cost-first then actual stamp, unchanged
frozen-clock stamp, accepted-restart boundary and issued-result boundary.
They first issue/settle a prior battle through source handlers, queue reopen,
missing legacy native-before rejection, atomic correction rollback, once-only
relative SP/medals/losses, first-distinct immutability and consumer-boundary
rejection across reopening. Fixture funding is synthetic, not natural earning
or native ordering proof. No case was executed.

This supersedes older blanket nearby-stamp unsupported notes only for an
unconsumed active owned capture. Post-consumer/settled stamp reconciliation,
older/replaced chains, other active interleavings, observed/older intent,
outer-zero/new-manual overlap, native signatures/timing/UI/full cold remain
unfinished or unverified. All149 packets/partials, ranking/prizes/type2 titles
and co-op-last stay on the goal. No tests/static/syntax acceptance/generator/
build/install/listener restart/emulator/workers/Actions ran.

## Current issued-refresh expiry/rewind retry — source only, UNTESTED

The permanent actual-wire refresh receipt is now read before the fresh
calendar gate. Only the same action, request key, encrypted body hash, season
and current refresh generation may use its validated original issued_at for
matching availability. The existing native owner, info/resume/processing,
pending rematch effects, settled progress and callback-baseline checks still
read current state. A changed payload cannot substitute an original body-hash
header. Summary/details/usage and fresh refresh/start requests retain their
current calendar policy; expiry is not permission to issue a new action.

Original24ec330's successful callback clears list flags and saves current
AppTime without rechecking season membership. An unobserved owned callback
therefore keeps its exact stored response across matching/display expiry or
a clock rewind. Missing/corrupt/replaced captures, current battle conflicts,
changed progress and already-observed callbacks still cancel without changing
native data. Returning the old response does not regenerate rivals, replace
a capture, replenish quota, credit resources or bypass native save proof.

New issuance freezes one private time for its calendar/date validation,
snapshot and refresh receipt. Earlier source read these times separately;
exact retries retain a bounded **local -5/+120s capture tolerance**, not a
publisher timing claim, without normalizing/backfilling old values. Ordinary
snapshot reads still use the current clock. This historical drift bound
remains unverified and needs genuine timing evidence before tightening.

Extended test_under_pvp_refresh.cjs is **WRITTEN ONLY / NOT RUN**: exact
matching-close/display-close/pre-display retry, present generic cache versus
reopen/cache eviction, fresh-action refusal, forged-header/changed-body
rejection, bad ownership/catalog/issue window/generation/response, bounded
legacy time/null date-flag retention, out-of-bound drift, late native save
rollback and observed-callback refusal even with a restored old generic
reply. Lazy first-status split/combined/automatic and advancing-clock fixtures
also queue post-display-expiry replay without manufacturing a native row.
No case was executed; native callback timing, signatures/UI/full cold remain
unverified. This supersedes older expiry-retry-unsupported notes only for the
current owned unobserved refresh. Older/replaced chains, active interleavings,
observed/older intents, overlapping outer-zero/new manual and nearby stamp
ambiguity remain unfinished. All149 packets/partials, ranking/prizes/type2
titles and co-op-last stay on the goal. No tests/static/syntax acceptance/
generator/build/install/listener restart/emulator/workers/Actions ran.

## Current completed-battle refresh recovery — source only, UNTESTED

Settlement removes under_pvp_active, but retains the independently observed
native battle timestamp and the per-season under_pvp_record_state pointer.
The refresh save planner now uses that existing latest completed receipt for
timestamp projection when there is no active battle or native processing,
both incoming and saved stamps equal that receipt's actual stamp, the exact
refresh request/season/frozen-before link still matches, and the native record
identity equals its settled result. Original24ec330 and1950f68 use independent
setters and the same save event; this is local recovery of captured effects,
not proof that every native save order occurs.

Only the private callback-effect projection sees the old timestamp. The native
stamp, result, usage, SP, medals, processing and completed battle stay intact.
The existing refresh generation, exact intent/quota, callback date and shared
profile/token/refresh/reply transaction checks remain. Expiry does not turn an
already issued save into a fresh refresh or fabricate a new battle. No new
schema, wire fields, operations, grants, history scan or legacy backfill.

Extended test_under_pvp_battles.cjs adds three **WRITTEN ONLY / NOT RUN**
cases: delayed combined callback, delayed intent followed by its callback,
and automatic outer-zero after a real handler-issued and settled battle.
They queue post-display-expiry reopening, original versus late callback list
time, no duplicate resources/result/usage, unchanged repeated puts, missing
or wrong frozen links, obsolete rival generation, missing floor/native result,
stamp changes and shared rollback. Fixture funding is synthetic; original
native signing, actual timing and natural earning are not accepted.

This supersedes the older blanket fully-settled-callback unsupported note only
for the idle latest owned record. Active other battles, older/replaced capture
chains, observed/older queued intents, overlapping outer-zero/new manual,
expiry-aware wire retries, nearby stamp ambiguity and error/no-op/full cold/
signature/native UI ordering remain unfinished or unverified. All149 packets
and partial branches stay on the goal; ranking/prizes/type2 titles remain
unfinished and co-op comes last. No tests/static/syntax acceptance/generator/
build/install/listener restart/emulator/workers/Actions ran for this change.

## Current delayed intent/battle handoff — source only, UNTESTED

The existing exact battle GameStatus baseline and refresh request key now
also bind delayed manual intent saves. No new schema, wire field, native
row, counter, timestamp, SP, medal or operation is manufactured. A shared
link predicate requires the same season/request, frozen native checkpoint
and unchanged previous battle timestamp. Ordinary automatic callbacks use
their held/saved checkpoint. Once a delayed incremented callback resolves
as manual, the link uses its **original requestBefore**, not the incremented
saved target; this keeps the original battle handoff valid without rewriting
the capture. Already-saved manual/legacy missing links do not gain guessed
coalesced-intent permission.

Original24eb9a0 changes count/execute and1950f68/28924bc independently stamps
battle time through the same native save event. The planner now handles
combined, counter-first, stamp-first, intent-first and intent-plus-stamp
saves when the captured link proves both effects. Idle-only exclusion is
relaxed solely for that owned battle link, including an already-saved
processing flag. Original actual timestamp/window, SP/medal or rematch cost,
resume/processing, record/result and once-only resource checks still apply.
Raw native battle timestamps stay in the profile and battle proof; private
refresh saved_status remains the callback-effect projection with its old
timestamp. Counter and battle observations commit with profile/token/reply
in the existing transaction or roll back together.

Counter-first and intent-first saves can still contain a positive timestamp
from the previous completed battle. When no new stamp has been observed and
that exact captured previous value is outside the new start window, the
planner waits for1950f68 instead of rejecting it or counting it as the new
start. Different unissued stamps and rewinds after an actual stamp remain
rejected. Previous values inside the start tolerance still use the existing
frozen-clock path; distinguishing nearby old/new callback stamps remains
unfinished pending original save-order evidence.

An unchanged held target **does not prove a callback-owned setter changed**.
An unchanged put or an independent stamp-only save therefore leaves its
observed flag0, rather than guessing that a pending increment was automatic.
The actual battle timestamp may still be recorded independently. A later
request-bound incremented callback can then resolve the retained possibility
without another battle, SP deduction or medal credit. This also retains
no-change setter ambiguity without blocking a separately saved NEW intent.

Extended test_under_pvp_battles.cjs is **WRITTEN ONLY / NOT RUN**: five new
delayed save orders at the original quota3 boundary, unchanged native-before/
wire privacy, first intent versus completed callback, stamp-only observation
separation, processing/cost-first callback, split-save reopen, missing/wrong/
legacy links and candidates, counter jumps/date/zero rejection, shared
battle/profile/refresh/reply rollback, exact restart/result and once-only
SP/medals. Existing automatic-zero and saved-manual cases are retained.
Two additional counter-first/intent-first history cases first issue and
settle a prior battle through the actual source handlers, then retain its
positive native stamp until the next stamp save. They do not inject a
historical floor. SP, medal and loss assertions are relative to the prior
state; fixture funding is synthetic, not proof of natural earning or native
acceptance. Both cases remain deferred.
test_under_pvp_refresh.cjs now also queues an unchanged native put remaining
unobserved. No case was executed.

This supersedes the earlier blanket delayed-intent/new-battle unsupported
note only for request-bound active captures. Callbacks after full settlement,
already-observed/older queued intents, overlapping automatic outer-zero/new
manual callers, expiry-aware wire retry, error/no-op/full cold/signature/
native UI ordering still need implementation or original evidence. All
other unfinished packets, Under ranking/prizes/type2 titles and co-op-last
remain on the goal. No tests/static/syntax acceptance/generator/build/
install/listener restart/emulator/workers/Actions; coverage remains partial.

## Current delayed manual refresh intent — source only, UNTESTED

Original24eb9a0 creates count1 for an absent GameStatus, otherwise adds one,
then sets executeRivalListUpdate=true. 1be57d0 dispatches the save event
before24e9570, but the refresh wire contains no caller identity or confirmed
save receipt. The offline handler must therefore handle request-before-save
and a combined intent/callback save as well as the already-saved intent.

Fresh private refresh captures now include nullable possible_intent: the
exact seven-field next native intent, only when the original slot5 quota
permits it and execute was false. This is a **possibility, not a native save,
manual charge or completed callback**. It does not alter the request baseline
or wire reply. Existing captures remain NULL without backfill; a missing,
substituted, malformed or wrong-count candidate cannot authorize this new
exception. Original lazy owner0/default fields are retained exactly.

The merged native save planner admits the exact delayed intent or its exact
incremented callback target, bound to the same request/generation/catalog,
unchanged baseline and idle processing/battle state. A changed-target
receipt with an intent-only save becomes manual/pending, still without a
saved callback target. A combined save records the actual incremented
target and observation in one transaction. After resolution, the derived
callback baseline is the captured intent; requestBefore and before_status
still retain the original issued request baseline. Date flags continue to
use that original request baseline, never a guessed post-intent date.

A held no-change target is different: its intent-only save may instead
belong to a **new** manual request. The old receipt remains unresolved and
does not block that new request. An exact old-wire retry may also read the
captured one-step native intent and complete its incremented callback. Only
the actual callback save resolves that held receipt. A subsequent fresh
request binds its own generation; obsolete old-wire callbacks cannot become
the new request. This does not infer manual usage from a button/date flag.

Native intent-only and callback observations share the existing profile,
token, request sequence and reply transaction. Receipt updates additionally
match their request key and generation. Intent-only pending targets use
SQL NULL, not JSON "null"; no native row/counter/clock/SP/item/signature or
operation is prewritten. Captured callbacks may save after the event clock
changes; this does not authorize a fresh out-of-window request. Quota3,
one-step counters, exact flags/owner/list/battle fields and no manual zero
reset remain required. The shared date-match helper is now exported from
under_pvp.cjs for both the save store and request handler, fixing the earlier
source scoping mistake; no runtime result is claimed.

Extended test_under_pvp_refresh.cjs is **WRITTEN ONLY / NOT RUN**: all three
quota uses; held split, changed-target split and combined/late callbacks;
native-before retention, no prewrite, replay/reopen/cache eviction, new
request after a held automatic target, stale-wire rejection, pending-new-
refresh exclusion, corrupt/NULL legacy candidate preservation, counter-
jump/unissued-battle/manual-zero/overflow rejection and intent/callback
profile/receipt/reply rollback. Separate lazy-first fixtures cover split,
combined and automatic constructor saves with owner0. Original pure intent
and shared date-tolerance cases are written, not executed.

Delayed intent combined with a new battle, already-observed callback versus
older queued intent, overlapping automatic outer-zero/new-manual callers,
expiry-aware wire retries, error/no-op/full cold/signature/save-order/UI
recovery still need implementation or original ordering evidence. Under
ranking/prizes/type2 titles and every other unfinished packet remain on the
goal. No tests/static/syntax acceptance/generator/build/install/listener
restart/emulator/workers/Actions; coverage remains partial. Original source
outside Git: under-pvp-matching-summary-state-exact-20261008,
under-pvp-refresh-ui-exact-20261008 and under-pvp-callbacks-exact-20261004-1.

## Current refresh request dates — source only, UNTESTED

Original24e9570 sends isSelectedRivalIdReset=true when GameStatus is absent
or its lastRivalListUpdateAt differs from AppTime's calendar date. Exact
2a3a450 compares year/month/day, not elapsed24hours or monotonically later
time. The existing region5 clock is UTC+9. A manual button therefore does
**not** imply true:24eb9a0 changes the counter/execute intent, not the last
refresh date. The new shared underPvpSelectedRivalReset projection keeps
these meanings separate; no native GameStatus field is added.

Fresh requests now validate the flag against the saved native baseline and
capture its exact boolean in the existing private refresh transaction.
The offline listener explicitly permits a sender date at most5seconds
before arrival to tolerate crossing midnight in transit. That5s allowance
is local compatibility policy, **not recovered publisher validation**.
Neither the flag nor a changed date grants manual quota, resets a native
counter, clears native resume/rematch state or manufactures a battle/prize.
The existing CPU list uses its ordinary generation-bound matching path;
publisher-side selected-rival storage has not been recovered or invented.

Receipt reads check typed0/1 flags against the captured before-status and
issue date. Actual-wire retries compare the captured flag, not the new
current date, and retain their issue time/generation. Observed, obsolete or
changed-baseline callback guards remain in force. A nullable legacy field
is retained without backfill. For an exact original-wire retry, the permanent
body hash proves the incoming flag, which must still match the captured
before-status/issue date. NULL alone, changed packets or missing transport
evidence cannot authorize a callback. Existing legacy save observation remains
subject to its prior exact baseline/target and quota guards. Private flag,
snapshot, permanent view identity and reply issuance share rollback; no
native profile/token, clock, wallet, operation or actual save is prewritten.

Extended test_under_pvp_refresh.cjs is **WRITTEN ONLY / NOT RUN**: absent
status, exact JST midnight, same-day manual intent, date rewind, bad numeric
dates, typed/incorrect flags, all three manual uses, day-change retention of
count3, frozen no-change retry after midnight/reopen/cache eviction, local
arrival tolerance, issue rollback, substituted private flags, legacy NULL
recovery from exact wire without backfill, changed legacy wire rejection and
unchanged native profiles/quota. Existing views/battles/rematch-results
fixture requests now derive flags from their captured native dates rather
than treating true as a manual-refresh marker. No cases were executed.

This supersedes earlier missing request-date validation notes, not native
clock/date/button/signature/save-order acceptance or publisher flag effects.
Identical-wire caller identity, unsaved manual intent, error/no-op/cold
recovery, ranking/prizes/type2 titles and all other unfinished packets remain
on the goal. No tests/static/syntax acceptance/generator/build/install/
listener restart/emulator/workers/Actions; implementation remains partial.
Original source outside Git: under-pvp-wrappers-exact-20261004-1 and
under-pvp-item-and-clock-exact-20261004-4.

## Current refresh-to-battle save handoff — source only, UNTESTED

Fresh battle captures now freeze the exact seven-field native GameStatus
baseline and, when applicable, the current automatic refresh request key.
The link requires the same live rival generation and an already-held/saved
refresh target. These private nullable fields never enter the start reply,
never create a native row and are not backfilled into historical captures.
Malformed/wrong-season/native-before timestamp captures cancel and retain
data; unbound older captures keep their existing ordinary save behavior but
cannot inherit a newly guessed coalesced reset proof.

Original1950f68 stamps lastBattleStartAt through28924bc and dispatches the
same Under save event as the independent GUI reset1bebd9c/1bede48 through
289213c. A native status put can therefore carry both effects. The shared
save planner now admits combined, timestamp-first and reset-first saves
when the frozen battle baseline and automatic refresh key prove the handoff.
The actual stamp still needs that issued battle's existing exact/windowed
observation, costs, resume and processing proofs; refreshing is not a battle
start, win, attempt debit or medal grant.

The private refresh saved_status is a **callback-effect projection**, not
a replacement native row: when a proven battle also changes its timestamp,
the projection retains the refresh baseline's unchanged lastBattleStartAt.
The raw new timestamp remains in the native profile and battle observation.
Both observations and profile/token save commit in the same existing
transaction. A later failure rolls them all back. Counter floors and
observed callback checks compare that projection, so a timestamp-first save
does not make a subsequent legitimate zero reset look corrupt. No unrelated
field, manual reset, wrong request/generation, missing capture or unissued
timestamp obtains this exception.

Extended test_under_pvp_battles.cjs is **WRITTEN ONLY / NOT RUN**: all three
orders, held no-change target versus actual observation, capture without
native prewrite, absent/wrong/legacy links, changed native-before counters,
out-of-window stamps, manual-only zero rejection, both-observation rollback,
split-save reopen, captured restart/result and once-only resource effects.
This supersedes the earlier unsupported coalesced-reset statement below,
not native signing/order/UI acceptance. Request-date validation is described
above; publisher flag effects, identical-wire callers, error/unsaved-intent/
cold recovery variants, final ranking/
prizes/type2 titles and all other unfinished packets remain on the goal.
No tests/static/syntax acceptance/generator/build/install/listener restart/
emulator/workers/Actions were run; route coverage remains partial.

## Current native refresh save handoff — source only, UNTESTED

Manual refresh now uses the original Under quota, not Abyss's slot6.
24e94cc binds information.slot3 to UnderRule; HUD1bd936c and click guard
1be8164 read native offset0xe, **slot5** (archive limit3). 1be57d0 calls
24eb9a0, saves counter+1/executeRivalListUpdate=true through the Under state
event, then requests24e9570. Native saves admit one increment with unchanged
owner/list/battle fields, within matching and without an active battle or
pending refresh. Jumps, overflow, flag-only intents and unissued zero resets
cancel atomically. Imported counters are not coerced or silently cleared.

Original2891dac defaults updateRivalList=true and execute=false. JSON27db02c
and MsgPack280e92c consume exactly seven GameStatus fields, including lazy
owner0; private receipt fields never enter that table. The separate native
UserUnderPvPRecord counter is not substituted for this GameStatus.

Automatic callers do not increment. Inner callback24ec330 clears list flags
and stamps actual AppTime, retaining the count. Original ELF RTTI identifies
outer1bebd9c as ArgoUnderPvPUIState::resetRivalList and1bede48 as
onStopRevenge: successful code0 also resets0. These are **refresh callbacks,
not battle-start resets**. Wire caller identity is absent, so automatic
receipts admit the retained count or zero; manual receipts never authorize
zero. Split inner/outer saves stay bound to captured generation/list time.

One indexed private under_pvp_refresh row per season captures native
baseline, original catalog, generation, permanent wire identity, issue time
and actual saved target/observation time. Issuance shares the existing
rival/view/reply transaction; observation shares native profile/token save.
No native profile, counter, timestamp, wallet, prize or operation is
prewritten. Missing/corrupt/legacy callback captures cancel without backfill.
Pending changed targets block another refresh/new battle and cannot lose
their generation to summary rebuilding. Pending retries keep their capture;
observed changed/manual callbacks cannot replay their native date/flags.
An already-held exact frozen-clock no-change target needs no dirty setter;
its separate private observed flag remains0 until an actual native save,
allowing a later retry/time change without inventing an observation. This
exception is not native callback/UI proof. Late actual saves can bind
issued or captured current observation time after a clock change, without
earning extra manual quota.

New test_under_pvp_refresh.cjs and adapted views/battles/rematch-results
fixtures are **WRITTEN ONLY / NOT RUN**. Queue quota versus Abyss slots,
exact codec/ownership, one-step intent, three uses/overflow, no prewrite,
pending retry/reopen, observed-replay refusal, callback rollback, retained
then zero automatic saves, no-change setters, late clock and corrupt capture
retention. A saved counter checkpoint also refuses unexplained restored
native counts; it permits only its retained count or the next saved intent.
Identical-wire GUI variants, publisher flag effects,
error paths and unsaved-intent/no-op recovery still need implementation or
native ordering evidence. The current coalesced handoff source is described
above; request-date validation is also source-only and native acceptance
remains deferred.
Signed import/save/cache/navigation/performance/no-crash-ANR acceptance is
deferred. All other unfinished packets, ranking/prizes/type2 title earning
and co-op-last work remain on the goal; route counts stay partial.
No tests/static/syntax acceptance/generator/build/install/listener restart/
emulator/workers/Actions were run. Original evidence outside Git is in
under-pvp-refresh-native-status-quota-exact-20261008 and
under-pvp-refresh-count-reset-exact-20261008; ELF RTTI41541b8/4154ab8 points
to original names336dd1f/336f180. Exact cached Ghidra GUI extraction was
read-only original-source research, not testing or a game build.

## Current post-matching read handoff — source only, UNTESTED

Summary/get, local/CPU player details and local character usage now remain
readable through the original DISPLAY period, including the interval after
matching closes. Existing175ed24 resolves slots10/11 with2a3a5dc's
start-inclusive/end-exclusive calendar. Original GUI availability1bcc3cc and
entry1bce048 call that same selector; character-usage callback1be9b30 also
resolves it. The detail wire has only userId, so it uses that unique display
season, not a similarly numbered old CPU or the shorter matching window.

Fresh battle starts and rival refresh now use the original slot8/9 matching
gate with an exclusive end. Exact24eb880:24eb9a0 reads native information
offsets0x14/0x16 (slots8/9), calls2a3a5dc and inverts its in-period result;
the GUI callers1bd74fc/1be27c0 use that closed-period guard. This supersedes
the former inclusive fresh-start/refresh end, not display access. A valid saved restart
or result remains bound to its issued battle and is not converted into a new
match. Pending/corrupt/lost battle, rematch, progress, native processing and
historical resume guards are unchanged. This is an offline viewing policy
grounded in the original calendar, not recovered publisher post-event service
or ranking aggregation.

The same indexed rival/view receipts bind native record identity, original
catalog, current CPU generation and full response. Read retries remain subject
to the active display season and existing freshness guards. Display expiry,
another season, corrupt evidence or an obsolete receipt cancels without
resetting scores, SP, inventory, flags, owned titles or battle history. These
reads neither issue prizes nor set rank/isAggregate/isReceiveReward. No extra
schema, ledger, native profile precredit, wallet change or operation was added.

Extended test_under_pvp_views.cjs and test_under_pvp_battles.cjs are
**WRITTEN ONLY / NOT RUN**. Cases queue matching-end/matching-end+1/display-end-1 reads,
display-end exclusion, wrong season, actual saved score/party usage versus
untouched empty history, local/CPU profile resolution, actual-wire replay,
restart, new-match/refresh rejection and unchanged native profiles/resources/
progress. New-start/refresh cancellation at the exact matching end preserves
the complete database; a new start one second before it retains its actual
native debit/status/processing capture through late saves, restart and result
at the end. View rollback fixtures stay within matching so they still target
the intended receipt/snapshot/reply failure. Historical normal captures from
the earlier inclusive policy remain readable through their existing receipt
validator; no save repair, clock rewrite, new end-time issue or backfill occurs.
Full local-profile post-season rendering, signed native import/save/
ACK/callback order, clock/navigation/cache/recovery/no-crash-ANR/performance
remain deferred until every packet and unfinished branch is implemented.
Actual save, listener, APK and MuMu remain untouched; no tests/static/syntax
checks/audit generation/build/install/restart/emulator/workers/Actions.

The next ranking-award work must use the original prize contract: modal
1bf9b08 reads **information.slot7**, not slot4/5, to select the group in
29b7300. Group slot1 joins that selector; inclusive rank bounds are slots2/3,
and the five original item/quantity pairs are slots4/5 through12/13. The
last row has maximum0; its sentinel semantics must be recovered, not guessed.
This extraction does not itself implement prize earning. The independent
grade-prize loader1bfaad8 uses information.slot4; its original table is empty.
No grade prizes, final ranks or type2 title awards are fabricated from views.
Evidence is retained outside Git in under-pvp-ranking-prize-modal-exact-20261008
and under-pvp-display-prize-bindings-exact-20261008 artifacts. Exclusive matching
evidence is in under-pvp-matching-summary-state-exact-20261008. The current
refresh section supersedes the former free-manual policy/missing-quota
evidence: slot5 and the actual native reset caller names are now recovered.
This does not establish publisher matching or native end-to-end acceptance.
Under final
ranking eligibility/earning/Presents publication and type2 save proof remain
unfinished; co-op and peer-dependent work still come last.

## Source handlers

Seven routes are now partial: summary, rival refresh, player details, local
character usage, battle start, restart and end. This is not seven completed
features. Captured-loss revenge battles, pass use, flat-present pass/rematch
earning and first-entry rematch initialization have source-only save paths
below. Publisher rankings/prizes, other producers, partially saved start
recovery and native combat acceptance remain unfinished.

Summary uses original seasons and grades, with three distinct labelled offline
CPU opponents. Indexed SQLite snapshots bind season, generation, original
catalog and native record identity. Automatic CPU refresh has no invented
currency cost; manual refresh uses the original saved count/slot5 quota.
Refresh never clears a pending battle. An original party ID is a local CPU
identity, not a publisher account. New matching uses original slots8/9 with an exclusive end;
read/display and daily-attempt periods use slots10/11, end exclusive, preserving gaps.

Player details accept only userId and resolve one active display season.
Responses contain playerInfo, the four-field pvpParty, a record ARRAY and empty
spine substitutions. CPU details require a currently selected rival. Local
details require a saved six-slot UserPvPParty matching the selected owned Under
party, attack pattern and memoria IDs. No combat stats or optional adventure
history are synthesized. Portraits use original communication characters and
costumes; two missing CPU portraits explicitly disclose a Bell placeholder.
Captured stat freshness after equipment/upgrades still requires native proof.

Character usage is **local settled-battle history**, not publisher popularity.
Untouched seasons are empty; legacy played records without captures cancel.
Once normal battle settlement is saved, unique main/assist PCs are counted once
per battle, sorted by count descending and PC ID for ties, then returned as
native normal/assist arrays of rank/pcId. Latest-team presence and bounded
counts are checked; full historical aggregate corruption detection is pending.

## Normal battle capture and saves

Start accepts exactly underPvpId, userId, rating, userParty, isRevenge and
revengeStartAt. Revenge is currently unavailable. The seven-field native party
contains six slots, each with pc/assistingPc/commandFlow/isHidden; each serialized
PC has the recovered25 fields. Typed vectors, selected owned/joined unit IDs,
command flows, attack pattern and memoria IDs are validated. The server keeps
the supplied native vectors; it does not invent equipment/board stats.

The current CPU generation, own party, opponent, original record, random seed,
battle ID, attempt baseline and medal baseline are frozen in SQLite. Start
returns native roots underPvpId/rating/isRevenge/battleId/randomSeed,
underPvpPlayerInfo/underPvpParty/underPvpRecord/substitutedSpineIds. It writes
**no native profile, wallet, attempts, medals or fabricated operation**.

Normal native construction consumes **one Under SP and credits100 season
medals**, not a pass deduction. Season slot17 resolves shop product207010001,
whose priceItemId is EventItem290000476. Amount and lifetime acquisition cap at
999999999. The client still produces its normal changes and signatures.

The shared save path separately observes the captured attempt deduction,
exact initial medal credit, resume opponent/rating, native battle-start time,
processing flag and issued result record. The first GameStatus checkpoint may precede common
battle costs. Timestamp skew is bounded to start minus5 through plus120 seconds;
the actual saved timestamp is then bound for restart/end. Native medal
signatures are retained, not fabricated or confused with opponent preRank.

**Corrected native completion gate:** UserInfo.processingUnderPvpState changes
0 ->1 at construction and1 ->0 after the issued result. The end handler does
not clear UserUnderPvPInfo.resumeRivalUserId/resumeRating. Those fields can retain
the last opponent. Requiring their deletion would strand a completed match.
The server now requires separately saved start/end processing observations,
and permits views only when the retained opponent matches the latest completed
capture. A positive processing flag or any unfinished capture still blocks
refresh. Last completed capture uses insertion order, not event-clock time.

Start captures the previous resume pair too: the first status checkpoint may
still contain the last completed match's opponent. Native setters dirty rows
only when values change. Replaying the same opponent/rating can therefore omit
UserUnderPvPInfo; a frozen event time can omit the unchanged GameStatus stamp.
New captured processing/cost proof can bind those unchanged values within the
start window without fabricated profile writes. Old capture schemas lacking
the previous pair or processing proof cancel for reconciliation; observations
are never inferred retrospectively from a legacy result receipt.

An issued pending SP deduction can save after an event-clock/season change.
It remains bound to the original captured day, timestamp and unchanged native
SP baseline (or its exact daily projection). It cannot overwrite intervening
recovery or an unrelated balance, and does not relax ordinary daily guards.
The first native GameStatus checkpoint uses the captured start window too;
rewinding the event clock before its save does not make that issued stamp future-invalid.

Initial medal credit must save exactly before interleaved acquisitions; start
requires prior pending acquisitions to save first. Shared item reservations
include pending Under credit. After observation, spending is allowed but
lifetime acquisitions cannot rewind. Resource floors use acquisition ordering,
not wall-clock ordering, so event-clock rewinds cannot select an older floor.

Restart accepts the captured season/opponent/rating/revenge timestamp plus
lastBattleStartAt. It requires all five start observations, reuses the same
battle ID/seed/opponent and changes no resources. Party selection and native
resume/cost/record state must still match the capture. Clock changes do not
create a new match or an additional charge.

End accepts the native three-field request, or its six-field extended variant,
with result {isWin,isRetire}. It requires the matching fully saved start and
freezes the first verdict. Its record and underPvpResult contain the native
result-dialog fields, including scoreDifference. Contradictory verdicts cancel.

Scoring is explicitly **offline-under-pvp-v1**, not recovered publisher math:
original rule values15/20/30 are assigned to easy/normal/hard wins; losses and
retirements grant0. Authored score thresholds choose grades and highest grade.
Win/loss/consecutive counters change once; rank, badge and prize data are not
invented. Native scoring/achievement behavior remains a pending acceptance boundary.

Issuing an end response is not save proof. Completion requires the issued
record identity to save, processingUnderPvpState to return to0, and all captured start
effects to have saved. Only then does the existing request transaction commit
the latest per-season record floor, local usage increments and active-pointer
removal. LastBattleStartAt may persist as the last completed timestamp; a
matching settled capture lets views reopen instead of trapping the player.

Profile updates, capture observations, usage/floors, sequence and replies share
the existing SQLite transaction. Lost/conflicting active pointers, missing or
corrupt captures, changed catalogs and rewound issued progression cancel with
3000999 while retaining history. Permanent action/actual-wire response receipts
precede the generic cache. Already observed start callbacks and saved end
callbacks cannot replay resource/achievement effects after restart or cache eviction.

**Still partial:** a shutdown after only the first native start checkpoint
cannot yet safely recover unobserved costs; it cancels instead of charging or
granting twice. Additional native achievement/end effects still need actual
client save observations. No operation-queue type is guessed.
The final batch must prove these branches and usable back/home cancellation;
source guards alone do not prove no loading loop, crash or ANR.

## Daily attempts and original teams

Daily SP uses recovered25459f0 UTC+9 day boundaries. A different day tops up
once to original allowance3, without hourly recovery or missed-day backfill.
Above-allowance stock survives within a season; two known different seasons
reset to the allowance. Missing prior/current seasons use the top-up branch,
with allowance0 outside original periods. Same-day amount/time stay unchanged.
The shared guard accepts unchanged state, exact current-day/season recovery,
or a once-only captured normal-battle deduction. No spendable-SP lifetime floor
or login/view auto-credit is installed. Pass consumption is described below;
original pass producers remain unfinished.

## Season-pass consumption and split saves

The source now handles consumption of existing native Under Telskyura pass
stock through user_data/push. There is no invented pass-consume API or operation.
All54 original pass IDs keep their authored season slot7 and recovery slot8
(one attempt). UserUnderPvpStaminaTicket has exactly six native fields:
userId, underPvpStaminaTicketId, amount, bookEntryState, signature and
targetUnderPvpInfoId. Signature is uint32. This row has **no cumulativeAmount
or dateList**; treating it as an ordinary cumulative item is incorrect.

Original UI1befe58 loops over the selected quantity and calls2541c14 once per
pass. That method resolves the original item, checks Under SP capacity before
spending, debits one pass through DomainItem24d8844, and adds its authored
recovery.2545f00 tests remaining capacity;2545d74/2545f40 adds SP up to
999999999 without changing underPvpSPUpdatedAt. The native modal limits its
selection display to99; a coalesced save can represent multiple original uses.
Both pass stock and Under SP caps are999999999. Original ItemType
200000036 is item_type.under_pvp_stamina_ticket; the retained itemType.enc hash
is the one recorded in Native evidence below.

The shared save validates unique owned native pass rows, exact authored target
season, nonnegative stock and typed book/signature fields. Zero-stock lazy rows
are accepted without awarding an attempt. Positive acquisition, deletion or
expiry-cleanup requests are not silently accepted as consumption. Spending must
belong to the current original slots10/11 season. Another unfinished battle or
pass recovery must settle before a new consumption is captured.

Two indexed SQLite tables retain the original pass debit and SP baseline:
under_pvp_pass_use stores original season/date/catalog, native baseline, exact
SP targets and an observed-save bit; under_pvp_pass_claim stores each ticket's
before/remaining stock. Latest stock is chosen by receipt insertion order,
not the event clock. Checks use at most54 indexed original-ticket seeks, not
an unbounded lifetime aggregate. Restored/deleted stock or changed/missing
referenced capture data cancels with3000999 while retaining history.

A combined pass/SP save settles together. A debit-only checkpoint records its
exact pending recovery without pre-crediting native SP. The later owned UserInfo
save must match the captured raw baseline plus recovery, or the original daily
projection plus recovery if daily reset was already dirty locally. It may save
after a clock/season change; it cannot overwrite intervening unrelated recovery.
After SP is observed, subsequent genuine uses have separate receipts. Exact
retries or fresh identities after cache eviction do not repeat already saved
debits/recovery. Profiles, claims, observation, sequence and reply share the
existing transaction. No permanent spendable-SP floor is added.

An unfinished pass recovery prevents starting a new battle and replacing its
resource profiles via a pull. Completed pass-sensitive cached pulls are compared
with current native data, so a stale binary reply cannot restore old pass stock
or SP. Login itself does not manufacture a missing recovery operation.

**Still partial:** consumption uses saved stock, not fabricated pass rewards.
The flat-present producer is now source-implemented below; other original
earning/shop/season-prize producers, expiry cleanup, native
signatures and full cold-start reconciliation remain unfinished or unverified.
An SP-first checkpoint without a saved pass debit is not proof of consumption.
No new route or complete gameplay feature is claimed from this local save path.

## Pass earning from flat presents — source only

**NOT RUN, built, installed or accepted in MuMu.** New deferred checks are
`node tools/test_under_pvp_pass_rewards.cjs`, the extended consumption rollback
fixture and shared present/battle/save/pull/recovery/master/launcher checks.
The actual player save and running listener are unchanged.

Original operation2000's receivedItems loop248cbb8 resolves24e3a5c and calls the
common gain slot0x50. Original2482c60 constructs passes from the master table;
24d92e8 enumerates the pass repository through2483248, then registers each
DomainUnderPvpStaminaTicket through24e134c into that same common item-ID map.
The root vtable42b5a38 dispatches gain to24d8844. Its cumulative getter2485320
returns0 and setter2485328 does nothing; book getter2485308 and setter2485310
also do nothing. A present therefore adds stock without a saved cumulative
counter, unlike ordinary items. Native pass rows remain exactly six fields.

The existing gift/receive handler now recognizes all54 original pass IDs
separately from ordinary itemProfiles. It uses only available owned flat UserGift
IDs and their actual quantities, aggregates duplicates, and retains the original
2000 operation/popup fields alongside other rewards. This creates **no gifts**
and proves neither historical obtainability nor seasonal prizes/shop products.
No original shop/bundle/mission pass source was established in this slice.

Private SQLite under_pvp_pass_reward stores the exact issued2000 parameters
and original pass calendar/catalog hash. Its normalized reward_claim rows bind
each quantity to before/after stock and track native observations. No pass,
signature, UserInfo SP or invented native cumulativeAmount is precredited.
Targets above the original999999999 cap cancel before issue rather than silently
discarding part of a present. One pass-present operation may await ACK at a
time; unrecorded older queued pass awards also block new pass issue. Unrelated
ordinary presents retain their existing behavior. A new pass award cannot
interleave with an unfinished debit-first SP recovery.

Native stock may save before/after gift flags or in separate per-ticket chunks.
Each increase must equal its issued quantity; acknowledgement needs every
observed pass plus the received/deleted gift flags. Partial inventory/flag saves
survive restart and gift expiry. Spending or a new pass award before ACK is
explicitly unavailable: native pass rows have no counter to distinguish a
coalesced gain-and-spend from an unobserved award. This is a deliberate partial
ordering limit, not successful gameplay coverage.

under_pvp_pass_stock_state keeps each ticket's latest consumption ID, latest
observed grant ID, last-transition kind and expected stock. Both indexed IDs
must still match their retained receipts. Grant→spend→later grant follows actual
saved order even when the event clock is frozen or rewound. Lookups use the
fixed54 original IDs and indexed newest-receipt seeks; shared root receipts are
memoized within a stock check, without lifetime sums/replay. Older exact
consumption-only captures remain accepted as baselines; they are never promoted
into guessed earning receipts. Completed stock cannot be removed or restored.

A flag-first or observed2000 is omitted only from save responses, with the
queue retained. Fresh/cached/hot/cold redelivery cancels3000999 until the valid
ACK rather than adding those passes again. Completed cached present replies
also cancel. Pending resource pulls cannot replace stock; stale binary pulls
cannot remove later earnings. Missing/corrupt sources, claims, catalog or stock
pointers retain history and cancel. Issue captures/claims/gift IDs/queue/sequence/
reply and native profile/observation/stock/ACK/done/reply updates share the existing
transactions. No new packet, queue type, auth bypass or permanent SP floor.

Deferred fixtures cover54 original-ID metadata targets, absent stock, duplicate
gift aggregation, flags-first/partial stock/restart/expiry/ACK, redelivery and
stale pulls, grant/spend/later-grant order, caps, missing legacy receipts and
issue/profile/observation/stock/ACK/reply rollback. Synthetic saved gifts are not
native eligibility or effect proof. Natural pass earning, hot/cold item events,
signatures/defaults/popups/checkpoint-ACK timing, all other producers, expiry
cleanup, full interrupted cold reconciliation and playable UI/performance still
require implementation or native acceptance. Co-op remains last.

The decoder exports14 original Under tables, bringing its inventory to131
sources:54 seasons,21 grades,1 rule,50 tutorial groups,252 matching rows,
0 grade rewards,9 group rewards,4 badges,54 passes,50 rematch tickets,
200 names,1034 PCs,810 slots and312 parties.37 original tutorial/opponent
grade mismatches are retained. No rewards are invented for empty tables.

Only four grades have authored teams (146/82/79/5 parties). All21 grades can
offer offline CPUs by reusing the highest authored lower grade where the target
has no party/tutorial pool. Original grade, score, EXP and vectors are retained;
there is no stat scaling or invented high-grade team. Profiles disclose reuse.
Original dummy numeric slots1..15 are projected to native PC fields, with
absent gear/board/ascension/memoria left empty and attack pattern2 as an explicit
local default. Vector mapping, empty assistants and combat suitability remain
unproved in the native game.

## First-entry rematch allowance — source only

Implemented, **NOT RUN/built/installed/native accepted**. This is a native save
transition, not a new packet or full rematch battle implementation.

Original UnderPvpInformation binds50 seasons through slot22 to50 unique
UnderPvpRevengeTicket rows332000001..332000050. Their slot21 allowance is3.
The first4 seasons have slot21=0/slot22=0 and cannot initialize an allowance.
The retained archive data and131 source hashes are unchanged.

Exact UI initializer1be26c4:1be2adc checks initialSetting through24e80e0. If
false and the original rematch ticket exists, it obtains a local210000 signature,
calls the ticket root's **amount setter+0x48** with slot21, then sets
initialSetting=true through24e7c60 and requests a save with trigger
UnderPvpStateRevengeDefault. It does **not** call common additive gain+0x50.
Consequently preowned stock9 becomes3, not12; cumulativeAmount and
reservedAmount are preserved. Newly initialized stock3/cumulativeAmount0 is
valid. This differs from native season passes and ordinary additive presents.

Native UserUnderPvpRevengeTicket is exactly7 fields:
userId,underPvpRevengeTicketId,amount,reservedAmount,bookEntryState,signature,
cumulativeAmount. JSON2754f98:27552d0 and MessagePack278f5cc:278f8d0 retain
the actual cumulative/reserved fields and uint32 signature. Lazy domain
constructor234dad8:234dc4c supplies the owned user and original ticket ID;
userdata2899d5c:2899f30 defaults amount/reserved/cumulative0 and book1.
The root book getter234e16c returns1; book setter234e174 is a no-op. Saved
book/signature metadata is type-checked, never generated or forcibly rewritten.

Native UserUnderPvpRevengeStatus is exactly6 fields: userId,underPvpId,
isRevenge,revengeUserId,initialSetting,revengeStartAt. Parser280fd8c:28100dc
and World merge27138b0 use underPvpId, not revengeUserId. Domain
24e7938:24e7ab8 supplies current owned user, original season, false flags and
zero rematch timestamp. Shared save now validates ownership, exact fields,
unique season/ticket keys and numeric/cap boundaries for both classes.

Private SQLite under_pvp_rematch_init has one retained row per initialized
season: original ticket/date/catalog, native pre-effect stock/status, and
separate ticket_saved/status_saved observations. The target is derived again
from original slot21, not a saved configurable reward. Profile, receipt,
observation, sequence and reply update in the existing transaction. No native
stock/signature/flag/counter is precredited; no fake operation is issued.

Ticket-first and flag-first saves are captured separately. A changed stock
must exactly equal the absolute allowance with unchanged cumulative/reserved
counters. If a preowned amount already equals3, a flag save can finish without
an unchanged amount row: no amount gain was required. Captured partial saves
finish after listener restart or event-clock/season changes using their original
baseline/date. Only the bounded50 season receipts are read, not lifetime
economic history or clock-sorted receipts.

Pending initialization blocks resource/flag replacement pulls and new Under
views/battles until the native checkpoint completes. Cached binary pulls must
equal the current payload instead of restoring old tickets or initialSetting.
Completed flags cannot reset and inventories cannot delete, rewind or gain
unissued amount/cumulative/reserved values. Malformed/corrupt/obsolete receipts
and mismatched catalogs retain state and cancel3000999. Legacy initialized
stock without a receipt is retained unchanged, not retroactively invented as a
fresh earning event.

Limits remain explicit: first entry is conservatively accepted only inside
original active slots10/11, not a claim of recovered publisher UI phase rules.
Normal-result eligibility/opponent/date transitions and captured-loss rematch
battles are now bound to new receipts as described below. Separate ticket-only
deduction is implemented in source; native battle construction/acceptance,
shop/prize acquisition, expiry and full cold reconciliation still need
work. Flat-present acquisition now has its separate source-only path below;
rematch IDs are not ordinary gift inventory and no historical shop availability
is inferred. No complete feature or crash
fix is claimed. Actual player save/listener/APK/MuMu were untouched.

Deferred: [test_under_pvp_rematch_init.cjs](../tools/test_under_pvp_rematch_init.cjs)
covers all50 original bindings, exact fields, absolute preowned resets, stock
above cumulative, both split-save orders, unchanged setter, lazy future rows,
once-only replay/restart/clock changes, stale pulls, legacy preservation,
pending/conflicting effects, corruption and profile/receipt/observation/reply
rollback. These synthetic saves are not natural eligibility, native signatures,
actual effect/save ordering, UI/navigation, stability or performance evidence.
Run shared Under/pass/gift/save/pull/recovery/master/Android/launcher checks in
the final batch, then actual native first-entry and rematch gameplay acceptance.

## Rematch result eligibility and period reset — source only

Implemented, **NOT RUN/built/installed/native accepted**. No new route is enabled;
this extends normal battle results and the existing native save transition.

Recovered callback21fbe48:21fc2ec reads underPvpResult.isWin and calls
24e82a0:24e8534 with the selected season and captured opponent. The opponent
comes from the selected underPvpPlayerInfo.userId, through encounter parameters
at+0x10, WorldUnderPvPState+0x480 and its result struct+8. It is not the owned
player ID or the current rival list after a refresh.

Native eligibility is exactly: the previous isRevenge flag is false, the settled
score is below the authored slot23 grade's slot5 ceiling (when configured),
the original slot22 ticket amount is positive and isWin is false. Retirement
therefore follows the loss branch here: the client does not inspect isRetire.
Eligible results set the opponent and current DomainAppTime date; every disabled
branch clears the flag/opponent but **retains the previous revengeStartAt**.
initialSetting and the ticket inventory/cumulative/reserved counters do not
change. Exact24e7b8c uses revengeUserId setter28996a0;24e7d34 uses timestamp
setter2899860. These are distinct fields.

The existing private under_pvp_battle capture now freezes the full six-field
before/after status, original ticket amount and result date alongside the verdict
and result record. The reply still uses the recovered result roots. It does not
precredit a profile, generate a signature or issue a fabricated operation.
The native changed-status save must match that result/opponent and retains its
actual timestamp within the existing conservative result-date skew window
[-5,+120] seconds; this window is an offline checkpoint policy, not a recovered
publisher tolerance. Once observed, the exact timestamp cannot be replaced.
Record, processing and changed-status saves can arrive in either order; all
required start proofs plus record/end-processing/rematch observations must be
present before usage, progress floor and active ownership settle atomically.

When all six native fields are unchanged, the result capture marks the private
rematch observation without demanding a dirty status row. This does not create
an absent native row or claim that the native lazy default-row save was accepted.
Changed pending results block replacement status/resource/progress pulls.
Captured results can finish after restart and event-clock changes without being
reinterpreted as a new outcome or selecting a new opponent/date.

Recovered UI1be26c4 calls reset24e8534 only when24eb880:24eb9a0 reports
the selected season outside original matching slots8/9. This membership test is
start-inclusive/end-exclusive. Reset clears only isRevenge and revengeUserId;
revengeStartAt and initialSetting survive. A changed reset requires no active
battle and the actual clock outside that matching window. One bounded private
under_pvp_rematch_reset pointer per season retains its completed parent and
reset date. It applies only to that result floor; a later battle supersedes it.
Clock rewinds cannot restore cleared eligibility. Original-season indexed floor
seeks and the latest reset pointers avoid scanning lifetime battle history.

Missing/corrupt result/status/date/parent/floor proof, forged/deleted/rewound
eligibility and inside-period resets retain saves and cancel3000999. Profiles,
observations, reset/floor/usage pointers, active ownership, sequence and reply
share the existing transactions. Previously issued/completed legacy battle
captures lacking this new evidence are **not** retrofilled from guesses; cold
reconciliation of those saves remains unfinished. Coalesced eligible-result and
immediate period reset before a status checkpoint also remains unsupported.
Ticket-only spending and captured-loss start/restart/result responses are now
implemented in the next section. Other ticket producers and native construction/
navigation/signature/achievement/performance proof are still required. These
changes are not a claim of fixed crashes or full gameplay.

Deferred: [test_under_pvp_rematch_results.cjs](../tools/test_under_pvp_rematch_results.cjs)
covers all54 authored seasons, score ceilings, stock/win/previous-flag branches,
retained disabled timestamps, period boundaries, split saves, unchanged fields,
late restart/clock completion, reset rewind/new-result floors, bad opponent/date,
stock invariance, corrupt/missing capture/floor/reset proof and issue/profile/
observation/reset/progress/reply rollback. It is **NOT RUN** and synthetic native
saves are not native rematch eligibility or UI proof. Include existing rematch
init, Under battle/view/pass/save/pull/recovery/master/Android/launcher checks
in the final batch, then native normal loss/retire/win and reset acceptance.

## Captured-loss rematch battles — source only

Implemented, **NOT RUN/built/installed/native accepted**. The three existing
start/restart/end routes now accept isRevenge=true for an eligible, fully saved
local normal loss. This is not remote PvP or a new fabricated packet.

Exact21db744:21dbe40 reads the response's isRevenge. Only the false branch
spends1 Under SP and adds100 season medals. The true branch resolves the
original season slot22 ticket, generates a local210000 signature and calls the
root amount setter+0x48 with max(amount-1,0). It does not add cumulative stock,
change reserved stock, spend SP or award medals. The server requires positive
saved ticket stock rather than treating the native empty-stock clamp as a free
battle. Signatures remain typed, client-produced values, not server substitutes.

Rematch entry requires the current completed normal loss floor, its saved
eligibility/opponent/date, initialSetting=true, positive original-season stock,
the same captured rating and the original matching period with its exclusive
end. The same-rating/captured-parent guard is an explicit offline policy; full
publisher freshness and selection rules remain unrecovered. Rival refreshes do
not replace the loss opponent. The owned party is captured afresh, while the
opponent/team/generation comes from the genuine normal loss capture. The reply
retains the existing native roots with isRevenge=true and its new battle ID/seed.
Offline-under-pvp-v1 scoring also applies to rematches; it is not publisher math.

The existing SQLite battle receipt adds mode, earlier normal parent ID, owned
six-field start status, native seven-field ticket baseline and ticket_saved.
The parent must be earlier in insertion order and a completed normal loss:
self/cyclic/rematch-parent pointers cancel before recursive validation. Native
profiles are not pre-debited or precredited. The one-ticket target preserves
cumulative/reserved counters, and the native profile and private observation
save in the same transaction. Cost-only and processing-first saves can finish
separately across listener restart and event-clock/season changes using the
captured start, not a new daily allowance. Unchanged resume opponent/rating and
frozen start stamp may omit their native dirty rows under the existing proofs.
Before the cost observation, persisted ticket stock must still exactly match
the captured baseline; corrupting that baseline cannot silently change the debit.

Rematch start proofs are ticket/info/status/processing, not normal SP/medal
proofs. Restart requires all four and returns the original opponent/seed without
another server charge; native restart construction still needs acceptance.
Mode/opponent/rating/rematch date/start stamp must match the active capture.
Accidental normal SP deductions and unissued100-medal credits are rejected;
legitimate separate medal acquisitions must have their existing issued receipts.
They use the current persisted inventory and shared pending-reservation evidence,
including capped counters, not a permanent ceiling from the rematch's start.
Pending ticket deductions block replacement ticket/status pulls. Result capture
requires the saved ticket target and unchanged full start status. The native
previous-isRevenge result branch clears flag/UID and retains the original date,
regardless of win/loss/retire. Record, processing and changed rematch status must
all save before progress/usage/active ownership completes atomically.

One indexed newest saved debit per original ticket is read in insertion order,
bounded by the50 original bindings. It supersedes the initial allowance stock
without rewriting the first-entry receipt or rescanning/summing lifetime play.
Stock cannot restore, gain an unissued amount/cumulative/reserved value, delete
at0 or regenerate when the clock rewinds. A later normal loss can enable another
rematch only while saved tickets remain; stock0 produces no further eligibility.
No rematch stock is registered as an ordinary gift/shopping item by this slice.
The separate flat-present path below preserves the real native ticket class.

The deferred existing [rematch fixture](../tools/test_under_pvp_rematch_results.cjs)
now includes all50 original spend targets and three consecutive normal-loss/
rematch win/loss/retire cycles, ending at SP0/tickets0. It covers refreshed lists,
same opponent/seed, no precredit or normal cost, both cost/processing orders,
late captured saves after clock change, restart/cache eviction, changed-status/
record split orders, duplicate/incorrect/missing cost, restored/deleted stock,
period boundaries, wrong mode/opponent/rating/date, self/missing/corrupt parents/
native baselines/saved-cost proofs, and issue/profile/observation/reply rollback.
An additional synthetic original-ID medal present/save/ACK then unrelated native
checkpoint covers completed reward interleaving without a stale start-stock guard.
These are synthetic native-shaped saves, **NOT RUN** and not UI/combat proof.

Still required: native rematch selection/availability/party/vector/signature and
restart constructor/save order/achievement/result/navigation/no-ANR acceptance,
full interrupted start/result and legacy cold reconciliation, coalesced result
and immediate reset, other original ticket producers/expiry, publisher scoring,
season prizes and the rest of gameplay. Actual save/listener/APK/MuMu untouched;
no Actions/workers; co-op last. No route is claimed feature complete.

## Rematch-ticket flat-present earning — source only

This extends the existing gift/receive operation2000 and shared save path,
not the set of registered routes. It accepts only already owned, available,
unclaimed flat UserGift rows with the original50 rematch IDs and positive
signed-int32 quantities. Repeated IDs aggregate once; ordinary currency,
characters, equipment, costumes and season passes retain their existing paths.
No present, historical product, prize or natural earning eligibility is invented.

Original common item registration24d92e8 obtains the World rematch collection
through25d5fc8, copies it through25d6710 and registers each root through24e222c.
234d0a0 is the preceding collection destructor, NOT a ticket factory. The tiny
25d6710 FDE is a tail wrapper; its decompile expands the adjacent copy helper.
This establishes rematch IDs in the common item resolver used by2000/248cbb8.
Root vtable42acc38 in ELF .data.rel.ro has +50->24d8844 and +b0->24d8d94.
Positive gain adds to amount and the REAL cumulativeAmount separately, each
capped999999999; reservedAmount is unchanged. Cumulative getter234e074 and
setter234e08c/289a4a4 are real, unlike season passes' no-ops. Root book getter
234e16c returns1 and setter234e174 does nothing, so no fabricated book3,
signature or cumulative-free grant is sent. Both additions are signed-int32
before native clamping: quantities that would overflow either addition cancel.
First-entry amount3/cumulative0 remains valid and is NOT this additive path.

Private SQLite under_pvp_rematch_reward retains exact native2000 parameters
and original ticket/season catalog hash. Per-ticket claims retain the full
seven-field pre-effect row (or null), quantity, recomputable three-counter
target and effect_saved observation. Original source gift IDs must remain bound
through gift_claim. No native stock, signature, flags, SP or medal pre-credit.
Missing/legacy/corrupt roots, quantities, catalog, source IDs or targets preserve
the queue/history and cancel3000999, rather than guessing an old earning event.

Ticket-first, flag-first and per-ticket partial saves are observed independently;
exact native stock and received/deleted gift flags must save before ACK. Captured
grants can finish after restart/expiry/clock changes. An unchanged both-counters-
capped grant may omit a dirty ticket row, but requires actual native claim flags;
this is not a fabricated increment. Once any flag/effect is saved, save responses
suppress additive redelivery while retaining the queue. Other hot/cold/cached
redelivery cancels until ACK; a completed cached gift cannot add stock again.
Pending grants block replacement ticket/status pulls and new Under views/battles.
Grant issuance during a pending allowance or active battle is explicitly
serialized; grant+spend/first-entry without the grant checkpoint/ACK is not yet
supported. Native coalescing and usable cold recovery still require work.

under_pvp_rematch_stock_state pins BOTH the newest observed grant operation ID
and saved debit battle ID, plus last transition kind: debit0, earning1,
initializer2. The original allowance may replace previously earned amount with3
while retaining its cumulative/reserved counters; later earning may follow
initialization or a debit, and later spending preserves acquired counters.
Each pointer updates atomically with profile/observation/queue/ACK/sequence/reply
in the existing transaction. Bounded original-ticket indexed seeks and memoized
root validation replace lifetime SUMs or rewindable clock ordering. Deletion,
restoration, missing pointers after earning and unissued counter changes cancel.
Exact legacy consumption-only stock is retained, not retroactively reminted.

Deferred: [test_under_pvp_rematch_rewards.cjs](../tools/test_under_pvp_rematch_rewards.cjs)
and the extended [result/battle fixture](../tools/test_under_pvp_rematch_results.cjs).
They cover all50 gain IDs, absent/legacy/initialized stock, duplicate gifts,
split/partial/flags-first saves, retry/cache/restart/expiry, allowance after
earning versus earning after allowance, saved debit/later grant/new debit at a
rewound clock, caps/overflow/reserved counters, stale pulls/deleted/restored
stock, missing/corrupt receipts/pointers and issue/observation/profile/stock/
done/sequence/reply rollback. **NOT RUN**: synthetic original-ID gifts and
native-shaped saves are not natural earning, signatures, popup/item-event,
checkpoint ordering, navigation, cold recovery, no-ANR or performance proof.
Other shop/mission/prize producers and expiry remain unsupported; routes remain
partial. Actual player save/listener/APK/MuMu untouched, no Actions/workers.

## Native evidence

Frozen15.1.0/build170316722, original ARM64 SHA-256:
e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3.
Addresses are raw ELF, not Ghidra's plus0x100000 addresses.

- Views:24e9c58/24ecec8/21dab6c/24ea2a8/24eb4f8/24ec330.
  Record merge changes only its10 identity fields, not all17 saved fields.
- Details:1bea954/24cd18c/24ee744/2771584/24ef9d0. Usage:
  1be4e00/1be98bc/1be9b30/2141c44. Substitutions:23ec300.
- Start:193cc48/1950f68/21db744; native party275104c, slots287b0b4
  and PC287c0cc serialize25 PC fields. Seed consumer1948d04.
- SP consume:253f83c/2541bec/2545f94/2545f40. Daily:
  25459f0/25458f8/175ed24/2545c18/2a3a450/2a3a5dc.
- Pass serializer27538d8/278e1f0, parsers27dabfc/280e5ec:
  six fields, uint32 signature, no cumulative counter. Domain248473c/248493c
  creates a lazy zero row and sets target from authored season slot7;
  target setter28918b0 dirties only changed values. Root vtable42b5a38 uses
  amount setter24851c8 and additive24d8844. Recovery getter24852bc reads slot8,
  season getter24852ec reads slot7. Native UI1bef764 limits the displayed
  quantity to99, confirmation1befe58 loops single2541c14 calls. Capacity
  check2545f00 and addition2545d74/2545f40 use999999999; no timestamp setter.
- Medal resolver21dbe40/2425e6c/241f7e0/24e3a5c. Root DomainEventItem
  vtable42c3270 (not nested42b0e70): amount getter25ab4e0,
  setter25ab4f8, additive mutation24d8844. Positive100 also calls cumulative
  increment24d8d94, capped999999999; setter25ab6f0 calls26425b8.
  Amount cap getter24d8d6c reads original ItemType slot3: event_item cap
  999999999. Original itemType.enc SHA-256:
  deef3197ff4c94b95331727418b425af74d6acdd4bb4745956466299cfd8626b.
- Restart21dd0a0/21df940; end21db08c/21faa44/21da864/21fb474.
  End merges record/result, emits UnderPvPEndEvent and clears world flag.
  Processing setter25f319c updates World offset0x698 and marks UserInfo dirty;
  getter1bce9ec's recovered type is UserProcessingUnderPvPState. Native serializer
  25f85dc writes the exact processingUnderPvpState key. Can-resume21dcef8 requires
  this flag1 plus a positive resume ID. Native resume setters288e144/288e224
  dirty only changed values; their call inventory includes start/deserialization,
  not end. The earlier Lua interpretation of callback212ebbc was incorrect:
  Under end registrations211a880/211c3c8 reuse the PvPEnd callback through
  achievement infrastructure211f4a8/211fa6c/21220c4, including grade-condition
  comparisons. This is not a Lua resume-clearing handler. Additional achievement
  semantics are not claimed complete from this one branch.

## Deferred consolidated checks

New node tools/test_under_pvp_battles.cjs and extended
tools/test_under_pvp_views.cjs / tools/test_under_pvp_stamina.cjs are **NOT RUN**.
New tools/test_under_pvp_passes.cjs is also **NOT RUN**: all54 original shapes,
uint32/ownership/target validation, quantity/capacity, dirty daily reset plus
pass, combined/debit-first split saves, frozen-time distinct uses, restart/cache
eviction/retry, forward-season pending recovery, stale binary resource pulls,
unissued/wrong SP and stock restoration/deletion rejection, corrupted captures,
profile/receipt/claim/observation/sequence/reply rollback. Battle fixtures also
cover pass-versus-unfinished-battle isolation and pending pass blocking start.
Fixtures seed explicit synthetic legacy stock; they do not prove native earning.
Include shared item/gift/shop/stamina/save/recovery/Android/master/launcher
regressions in the consolidated batch. The battle fixture covers normal
capture, no pre-credit, partial checkpoints, duplicate-cost rejection,
restart/cache eviction, seed/opponent continuity, result retry/verdict conflict,
native-shaped result saves in either record/processing-flag order, retained
last-opponent IDs, repeated-opponent/frozen-stamp saves with omitted unchanged
rows, unissued/rewound processing rejection, progress/acquisition floors, local usage, lost
active ownership and profile/capture/floor/reply rollback.
Late first checkpoints and exact costs after forward/backward clock/season
changes are included, along with wrong-cost/stamp and unissued recovery rejection.

Remaining native checks: natural unlock/entry, all ratings and win/loss/retire,
CPU vectors/gear/hidden/empty slots/art, actual signatures, exact SP timestamps,
split start shutdown, restart construction skipping costs, native achievement
effects and processing-state saves, clock changes, grade transitions, prizes/revenge/pass branches,
back/home cancellation, performance and no emulator crash/ANR. Nothing here
constitutes feature-complete or visual acceptance.
