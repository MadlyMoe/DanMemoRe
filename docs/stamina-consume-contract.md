# Fixed-cost Iris consumption: source implementation, acceptance pending

## Two-field consume wrapper — source discovery only (2026-10-11)

The original ARM64 wrappers at `0x25db034`, `0x25db368` and `0x25db794`
send `{consumeId}`, `{consumeId,detailId}` and
`{consumeId,detailId,payload:{pcId}}`, respectively. A read-only scan of
direct `B`/`BL` calls in the pristine library found five calls to the fixed
wrapper (`0x2017ab4`, `0x254156c`, `0x2541784`, `0x25419d0`, `0x2542108`)
and one to the payload wrapper (`0x14878bc`). The fixed callers pass a
runtime ID; their surrounding call instructions do not establish a new
master consume row. The payload caller is the ability-panel path already
handled below.

The same direct-call and `.rela.dyn` relative-pointer scan found no reference
to `0x25db368`. A second read-only pass over the already analyzed pristine
ARM64 image also found no recognized code/data reference, relocation value or
literal function-pointer entry for raw `0x25db368` (rebased Ghidra address
`0x26db368`). Evidence is retained in
`.work/currency-hard-two-field-xrefs-20261014.txt`; the extractor also checked
both raw and rebased relocation values. The final client therefore contains
the wrapper but has no reachable authored caller in the recovered image. It is
not counted as an unsupported gameplay packet variant and no cost, operation
or save effect is invented for it. The server still returns recoverable
unavailable if a fabricated two-field request is sent. This source extraction
is not a test, build or native acceptance; the handler, saved profiles,
listener and emulator were not exercised.

Latest SOURCE ONLY / PARTIAL / UNTESTED [mission ticket prefix](mission-ticket-reward-contract.md)
adds first/owned ordinary tickets to the shared6000/10200 cold-prefix planner,
preserving original cost/SP/claim ordering and native observations.384 new mixed
contexts/192 refills are WRITTEN ONLY / NONE RUN; scalar totals1264/632.
Earlier880/440 totals and missing ordinary-ticket constructor notes are historical.

## Mission unit/card prefix — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Shared10200 prefix planning now accepts original29/30 mission rewards when PC/
job-set/character/wardrobe/story and Memoria observations are either complete or
entirely untouched. Observed/preowned rows are filtered without reinitializing
growth; incomplete unit construction refuses. Independent saved SP can be skipped
while untouched units/cards remain native work. Original quantities, sources,
cost/order/nonce/cache/full actual ACK remain. New57 deferred character recovery
contexts include27 original10-Iris refills; NONE RUN. Shop-paired Memorias and
uncaptured reward mixtures remain unfinished; earlier DDL and zero-casino adapter
unapplied/unbuilt/uninstalled. Actual saves/listener untouched.

## Captured casino mission prefix — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Shared10200 planning now permits an untouched before-state-captured6000 casino
gain while filtering independently observed flags/items/SP. Actual casino proof
uses the clamped cumulative target and issued signature, including full lifetime
saturation; partial casino effects and legacy overlapping partial saves still
refuse. No SP/refill ordering, cost, source queue, token, cache or actual ACK
requirement is weakened.432 mixed casino cases/216 following original refills are
WRITTEN ONLY; NONE RUN. Casino0 adapter remains unbuilt/uninstalled, source DDL
unapplied, saves/listener untouched. See docs/achievement-reward-contract.md.

## Observed casino-mission prefix — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Shared10200 planning can recover observed6000 SP with already-observed original
casino medals and captured numeric/dated items. Casino recovery requires the
SOURCE ONLY zero-call ARM64 adapter: original23ff788 rewrites signatures even
for0, while the adapter skips only0 and leaves nonzero gain logic unchanged.
Source queue/quantities/order/signature/token/cost/capacity and actual complete
ACK proof remain. Unobserved casino with other partial saves still refuses;
no before-stock capture or remainder is invented.288 NEW WRITTEN ONLY casino
contexts include144 following refills; NONE RUN/adapter NOT built-installed/
native reference-unwind-gameplay acceptance deferred. achievement-reward-contract.md.

## Captured dated-mission prefix — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Shared10200 planning can now skip already-observed6000 SP alongside original
captured dated tickets. `achievementColdRecovery` must validate every numeric
or dated item as untouched or fully observed; expiry pruning is not a gain and
partial date/cumulative/signature effects still refuse. Observed rows are
omitted, never restored or made a balance floor. Original queue/order/capacity/
10-Iris cost/capture/token and complete actual ACK proof remain.384 NEW WRITTEN
ONLY dated mixed contexts include192 refills (880 shared mission contexts/440
refills total). NONE RUN/not native gameplay or membership proof. Existing
pending lottery-consumption restrictions unchanged; achievement-reward-contract.md.

## Captured numeric-mission prefix — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

The shared10200 prefix path now uses `achievementColdRecovery` for observed6000
SP when every ordinary reward has its original numeric stock capture. Fully
observed items are omitted; untouched items retain positive original quantities;
incomplete gains, uncaptured/dated items or other mixtures still refuse. Source
queue/quantity/signature/token, owned saved/spent SP, original capacity/cost and
actual complete ACK requirements are unchanged.384 NEW WRITTEN ONLY mixed cases
include192 following refills; with the earlier scalar batch this is496 cases
and248 following refills. NONE RUN/not membership or native gameplay proof.
See docs/achievement-reward-contract.md; no new DDL or save/listener changes.

## Observed scalar-mission prefix — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Normal10200 may follow observed scalar-only6000 SP/Iris rewards only when the
original mission capture validates and its derived cold reply omits observed
claim flags and zeroes already-saved SP. Native2361e24 skips nonpositive SP.
Current saved/spent SP is the baseline; original quantities, claim tuples,
Iris credit, refill cost/capacity and full actual ACK proof are unchanged.
Pending mission SP still requires the exact original captured prefix chain.
Mixed rewards and ambiguous history remain refused.112 NEW WRITTEN ONLY mission
contexts include56 following refills; NONE RUN/no native crash-fix claim.
See docs/achievement-reward-contract.md. Earlier DDL UNAPPLIED/saves untouched.

## Observed pure-Present prefix — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Normal10200 can now follow a saved but unacknowledged pure-stamina2000 gift.
The shared planner skips that observed SP only after full gift claim/queue/
receipt validation and proof that the derived cold reply omits the stamina
row. Current native saved/spent SP is the baseline; the old gift minimum is
not replayed or made a floor. Cold gift/refill checks use canonical original
entries actually outgoing after the other delivery guards. Original10-Iris
cost/empty refill parameters/queue/cache/ACK transaction remain unchanged.
Mixed Iris/other-effect gifts still refuse partial cold replay; no provider
effect is silently discarded. See docs/gift-reward-contract.md for original
client iterator/claim-state evidence and72 NEW WRITTEN ONLY contexts,36 with
a following refill. NONE RUN; synthetic source/save/cap/spending order is not
native acceptance. Counts124 partial/51 unsupported unchanged/no new DDL or
precredit; actual saves/listener untouched. Other recovery branches remain
unfinished and the consolidated acceptance phase is still deferred.

## Shared ordered normal-SP delivery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

This extends the preceding XP-capacity work to standalone10200 purchases and
their fresh/retried/cold delivery. The shared `staminaPrefix` planner binds each
relevant earlier operation to its original queue type, parameters, signature and
token. Original5000/16000/25000/21000 XP captures advance EXP/level in order;
original2000/6000/10200/28000 stamina captures reserve the original bounded SP
targets. Fresh allocation and hot retries skip observed effects and saved EXP;
cold login/pull/confirm require the exact untouched EXP and unsaved SP chain.
The refill's captured before/minimum must match that position and its original
level capacity, including signed-int32 saturation. Missing or inconsistent
captures retain the operation rather than rewriting its target or charging again.

The delivery check runs after the other effect guards, using original canonical
queue entries whose IDs are actually outgoing. An observed membership SP prefix
is skipped only because the existing derived28000 reply removes its type0 grant;
the actual saved/spent SP remains the baseline, not the old membership minimum.
Existing full-queue cache identity and exact derived-membership checks remain.
Original10200 reads254857c then adds through25488e0. Original consume81041001,
10-Iris cost, empty parameters, purchase/request transaction and real ACK proof
remain unchanged. No native EXP/SP precredit, receipt repair, new DDL or ledger.

All normal10200 callbacks are withheld from `user_data/push` replies, while the
real queued operation and purchase receipt remain available for valid cold
confirmation or native save/ACK. Withholding is not an observation or ACK; it
does not prevent a legitimate intermediate save from committing. This is an
offline save-reply policy, not recovered publisher behavior or native proof.
Observed unacknowledged refills still cannot replay their additive callback.

Deferred only: four new standalone contexts in test_stamina_consumes.cjs cover
original levels1/3/999, cap crossing, unchanged native rows/wallet/queue, changed
SP/level, missing metadata, damaged receipts, queue identity, cached bytes after
restart and actual save/ACK closure. Eight new membership-before-refill contexts
in test_subscription_bonus.cjs cover trial/regular and independently saved
tickets/SP. The six existing gift/mission/refill permutations now cover original
cold ordering and save-reply withholding. Synthetic funding/rows/save order are
not native earning, application or attribution evidence. None were run.

Owned damaged native balances/EXP are unavailable503; malformed requests remain
400. The shared EXP getter takes503 only for this stored prefix-planner input;
its existing default400 for submitted save validation is unchanged. Five damaged
EXP/level variants in each of the four deferred standalone contexts cover failure
before charge, retained fresh/cached purchase/confirmation and login/pull replies,
and separate malformed-save rejection with unchanged rows/queue/receipts/wallet.
These are WRITTEN ONLY, not additional native-proven contexts or profile repair.
Lost/coalesced history, partially saved XP/SP attribution, special-mode XP,
regeneration, saturated membership issuance, native constructors, UI, clock,
performance and stability remain unfinished/unverified. Counts124 partial/51
unsupported unchanged. Earlier DDL remains UNAPPLIED; actual saves/listener were
not touched. No tests, checks, generators, builds, APK work, emulator or ADB.

### Pending paid-skip debit prefix — SOURCE ONLY / UNTESTED (2026-10-14)

The ordered planner now includes an earlier pending 5000/16000/25000 skip's
captured normal-SP debit even when that stage XP does not cross a player level.
It reconstructs only the retained signed skip receipt: initial preflight, latest
saved whole-tick or cap target, then the exact debit. A following 10200 or other
captured normal-SP reward therefore records its before balance after that debit,
not from the stale pre-skip profile.

The skip save accepts a later producer only when every newer producer receipt
forms a contiguous operation-ID-ordered before/minimum chain and saved baseSP is
exactly its final minimum. Captured stage/dispatch stamina suffixes also require
their player-EXP floor. Missing, reordered, changed or unreceipted transitions
remain unavailable; a merely larger balance is not effect proof. The deferred
stage-skip fixture adds a no-level-up paid skip followed by original 81041001,
then one combined native-shaped save and real ACK for both operations. It is
WRITTEN ONLY / NOT RUN. A later exact whole tick now shifts every untouched
receipt in that suffix by the same debit delta inside the native-save
transaction. Separate written-only cases cover a tick checkpoint followed by
the combined ACK and an atomic tick/refill/ACK save. New 10200 receipts retain
the exact derived player level and original capacity used at issuance, so saturation does
not erase the additive amount needed by a later transactional shift. Null
legacy receipts remain compatible while their current ordered level still
proves the target; a saturated null legacy suffix cannot be shifted. Already-saved effects, other consumers,
native callback/save order, UI and stability remain unfinished or unverified.

## Queued original XP/level capacity — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

New10200 purchases now select the original capacity after earlier queued
stage/dispatch XP. The existing owned native EXP/level/floor getter and original
stage/dispatch receipt validators are reused; saved EXP is not added again and
remaining before/minimum values must form the ordered native EXP chain. The
existing SP reservation and original10-Iris purchase/request/wallet transaction
remain unchanged. Missing/inconsistent capture cancels before a new charge.
No native EXP/SP precredit, receipt backfill, new schema/ledger or publisher
quantity is introduced. Existing purchased receipts remain immutable.

Original246c428/2540b54 update EXP and level before adding every crossed level's
maxSP;10200 then reads254857c. Membership28000 recovery now projects this same
EXP/level/SP order for retained untouched5000/16000/25000/21000 prefixes, including
positive EXP without level-up SP. A following10200 must match its original
capacity at that position, not blindly the last saved level. Old mismatched
targets remain withheld rather than rewritten/refunded/recharged. Existing
delivery guards still refuse partially applied XP effects. Broader standalone
old-refill reconciliation is not completed by this membership exception.

Deferred only:64 additional test_subscription_bonus.cjs contexts across original
normal stage/dispatch, trial/regular, first-saved/unsaved tickets, XP alone/either
gift-mission-refill order and eight no-level-up EXP cases; no precredit/recharge,
original quantity/capacity/order, capture/baseline loss-corruption, old-target
retention, failure before debit, cache restart/stale delivery and sequential
actual save/ACK. Existing test_friendship_rewards.cjs assertions updated for
original refill capacity before/after queued dispatch XP. NONE RUN; prerequisites
are synthetic, not native signature, earning, timing, callback or UI acceptance.
See docs/subscription-contract.md and docs/packet-test-plan.md.

Special-mode providers/partial-XP/unknown history/ambiguous regeneration/other
standalone recovery/constructors/saturated membership issuance/UI-clock-performance-
stability unfinished/unverified.124 partial/51 unsupported unchanged/earlier DDL
UNAPPLIED/saves-listener untouched/no tests-checks-generators-build-APK-install-
restart-emulator-ADB-workers-Actions/all149 variants before acceptance/co-op last.

## Normal-SP refill delivery and membership prefix — SOURCE ONLY / UNTESTED (2026-10-10)

Original10200/254169c reads the current player-level maximum254857c, then adds
it through25488e0 with signed-int32 saturation. The original999-level capacity
export and81041001 cost are retained. Membership28000 cold recovery now accepts
an earlier unobserved10200 only from its actual outgoing ordered queue and
existing purchase receipt: original source/type/cost/empty parameters/baseSP,
exact before-SP chain and recorded minimum matching the current original native
capacity. It is not a fixed-size Present or a fill-to-normal-maximum operation.
Changed native target/missing metadata/lost or corrupt receipt/observed marker
cannot supply the prefix; no new debit, refund, profile credit or backfill.

All10200 delivery now validates the existing receipt. An observed refill is
omitted from save replies while its original operation/receipt remains queued;
fresh/cached hot retry and cold login/pull/confirm refuse until the existing
real ACK settles it. Spending after a recorded acquisition remains allowed;
no permanent SP floor or fake-success ACK is added. This closes a source path
that otherwise could resend the additive refill in a split save reply, not a
verified native crash or complete refill/recovery fix.

Deferred only: test_subscription_bonus.cjs adds24 mixed-order contexts and updates
four refill-first contexts (40 including the existing12). Original quantities,
all six gift/mission/refill orders, enrollment/ticket variants, capacity changes,
missing metadata/receipts, corrupted purchase target/cost, no precredit/recharge,
cache restart/stale reply, observed-unacknowledged refusal and sequential actual
save/ACK are described. test_stamina_consumes.cjs enhances its existing10200
observed-retry/spending/ACK case. NONE RUN; fixtures are synthetic, not native
earning, SP attribution or callback acceptance. See docs/subscription-contract.md.
Existing test_stamina_rewards.cjs mixed orders also describe observed-refill
suppression and missing-purchase login/pull/confirm refusal; NONE RUN.

Stage/expedition XP-SP and broader standalone unsaved interleaving/regeneration,
saturated membership issuance, incomplete history and native UI/clock/stability
remain unfinished/unverified. No new DDL/patch/dependency/ledger; earlier DDL
UNAPPLIED/saves-listener untouched/counts124 partial/51 unsupported unchanged.
No tests/checks/generators/build/APK/install/restart/emulator/ADB/workers/Actions;
all149 variants before acceptance/co-op last.

## Battle continue — source only, untested (2026-10-12)

`battle/continue` is no longer an unpriced success placeholder. Its original
bodyless request and return-only4000 operation are retained, with the singular
hot envelope and plural cold queue. Original wrapper25da61c and callback25de520
do not supply a revival payload; the callback refreshes Gem state and invokes
its captured caller. No HP, battle state, native profile, signature, SP or
continue counter is prewritten.

For the offline legacy route, the authored `CONSUME_BATTLE_CONTINUE`81021001
price of10 Iris is deliberately reused. **This legacy mapping is offline
policy, not a recovered publisher legacy-route price.** The current revival
UI still uses `currency/hard/consume` with10100 and its existing original cost.
Both paths now require exactly one owned active `UserAdventureState` whose
positive stage ID exists in the original stage catalog. The exact native row
array, stage ID and hash are captured before spending. A hot retry must still
refer to that same saved encounter; it cannot charge or resume from the home
screen or a different stage. The native row has no defeated/party-wipe field,
so the server still cannot independently prove the modal's local defeat state.

The existing `hard_currency_consume` and `hard_currency_consume_request`
tables, free-first wallet ledger, signed operation queue and outer request/save
transactions are reused. One private `battle_continue_purchase` table binds
the operation to the captured active state. Charge, both receipts, actual body
hash, alias, sequence and reply commit together. A pending4000/10100 hot retry
reuses the original purchase only in the same encounter; cache eviction or
restart cannot create another debit. Settled identities cancel rather than
charging again, while a genuinely new active battle can buy another continue.
Pending4000 and10100 routes serialize, since their caller callbacks cannot be
interchanged safely.

Fresh/cached/cold delivery and real ACK validate both purchase receipts. Direct
hot retry additionally validates the unchanged encounter.4000, like10100, has
no native SP or profile effect to observe: cold delivery and ACK may settle the
known paid no-op after the encounter changes, but cannot invoke the original
hot modal callback. An ACK therefore is not proof that an encounter revived.
Old unpriced4000/10100 queues without a captured battle remain retained and
unavailable; startup never invents a receipt or retroactively charges them.
Corrupt/missing captures cancel with the queue and save intact. Unexpected
database failures remain failures, not successful gameplay or synthetic ACKs.

`test_battle_continue.cjs` and the general-server fixture are **WRITTEN ONLY /
NOT RUN**. Deferred cases cover bodyless/singular/plural contracts, free/paid
debit, pending aliases, cache eviction/cold retry, both modern/legacy pending
orders, idle-stage rejection without charge, exact encounter capture, changed
encounter hot-retry refusal, cold no-op settlement, obsolete identities,
corrupt captures, legacy retention and wallet / queue / receipt / alias / ACK /
reply rollback. All execution, static/syntax
checks, builds, restarts, installation and emulator use wait until **all
packets and unfinished branches are implemented**. No live save was opened
or changed. No native revival, crash fix or stability claim is made.

The sections below retain prior evidence and limitations; this source change
supersedes only their description of the unpriced legacy4000 placeholder.

Frozen EU15.1.0 ARM64 original SHA-256
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
This slice changes `currency/hard/consume`, not battle simulation or the old
`dungeon/ticket/issue` packet. No publisher server code is available.

## Recovered client path

The current revival-screen confirmation at0x20179f4 reads its original consume
identity and calls the fixed consume wrapper0x25db034. Its success callback
0x2017bdc closes the modal and emits the client event. Operation10100 is bound
to the return-only handler0x25da880, also used by operation4000. It does not
restore HP, increment a saved counter, or carry an encounter identifier.

The older `battle/continue` wrapper0x25da61c and `dungeon/ticket/issue`
wrapper0x25da884 have success callbacks0x25de520/0x25df224 that refresh the Gem
repository and then invoke their captured success callback. They do not parse
ticket allocations from the response. Their return-only operations4000/3000
are not evidence of a recovered ticket price or grant. No direct BL/tail-B
callers of these two older wrappers were found in this analysis; that is not
proof that every indirect path is unreachable. Their existing placeholders
remain partial and must not be counted as implemented dungeon purchases.

Later 2026-10-11 source work supersedes only the dungeon placeholder with a
disclosed offline restoration: one opaque gate for the surviving authored
81021001 ten-Iris recovery price, backed by permanent issue/request receipts.
It is not recovered publisher pricing or a `UserAdventureTicket` grant; see
[`legacy-dungeon-ticket-contract.md`](legacy-dungeon-ticket-contract.md).

Original `gamelibConsume` slot5 gives10 Iris for each fixed use:

| Original consume | Operation | Native effect |
| --- | --- | --- |
| 81021001, battle continue | 10100 | Return-only; modal/caller owns revival |
| 81041001, normal stamina | 10200 | Add the player-level maximum, saturate int32 |
| 81051001, War Game stamina | 10400 | Add5, cap15 |
| 81061001, Record Buster stamina | 10500 | Add5, cap10 |
| 81071001, Telskyura Abyss SP | 10600 | Original add1/cap999; exact stock/timestamp save proof and active original display period |

Normal effect0x254169c reads maximum0x254857c and delegates to0x2548998/
0x25488e0. The maximum is `playerLevelStep` slot3, through0x1d31664: all999
original level capacities are exported separately without changing existing
level/EXP pairs. War Game effect0x25418e8 calls5-valued0x2544728 and capped
addition0x25447d8. Record Buster effect0x2541b00 uses5-valued0x254668c and
capped addition0x25466b8. Its current getter0x25463b4 can raise an expired low
balance to5 but never lowers a persisted higher balance. The server therefore
now uses the captured Record Buster calendar/reset-time path described in the
current follow-up below, superseding its earlier minimum-only observation.

## Persistence and recovery

Existing request transactions, free-first/paid-remainder spending and operation
delivery are reused; no additional dependency or purchase service was added.
Free-first ordering remains an explicit offline policy, not publisher parity.

`hard_currency_consume` retains the purchase identity, operation, original cost,
SP baseline/minimum and an observed-save bit. `hard_currency_consume_request`
binds each actual request ID/sequence to that purchase and the received encrypted
wire hash. It does not trust a supplied hash header to identify a different body.
The debit, native queue, receipts, aliases, sequence and reply commit together.

New requests of the same fixed type while its operation is pending resume it
without a second debit. The exact pending identity works after generic-cache
eviction, session reset and restart without changing the sequence again. An
obsolete identity whose purchase is already settled returns cancellation3000999
instead of recharging or replaying an additive effect. A genuinely new request
after settlement remains a new purchase.

Normal acknowledgements require a valid owned `UserInfo` with the minimum SP
observed in the proposed or previously saved profile. Record Buster now requires
the actual captured stock/reset-time result described below.
Separate save-before-ACK records the observation in the same SQLite save
transaction. Later SP spending is valid after that observation; SP has no
permanent floor. Only current queued operations are scanned, using the receipt
primary key rather than lifetime-history scans. A stored balance already at its
native additive cap is rejected before spending as an offline safety policy.

New source-only gift/mission stamina receipts now share normal10200 reservation
and save observation. Gift2540e78 tail-calls normal2548998/25488e0; mission6000
reads `issueStamina` and uses the same function. Each unobserved pending reward
gets a distinct reserved SP target, even when its native gift/mission flags have
already been saved separately. A receipt's `sp_before` is its reserved baseline,
which may exceed the currently saved SP when earlier rewards are queued.
Observed-but-unacknowledged rewards are excluded from later reservations because
they can already have been spent. Normal refill receipts are validated against
the original consume/type/cost, empty native parameters, SP field and cap before
pending or cached delivery; missing or inconsistent legacy state stays queued.
The two final authored SP missions retain their original50-SP quantities/windows.
See [present reward receipts](gift-reward-contract.md).

Dispatch21000 level-up SP now uses this same pending reservation/observation
path. Native2540b54 adds the original maxSP separately for each gained level;
2548998/25488e0 saturates baseSP at2147483647. Its secure setter25ea560 does
not change the stamina timestamp or consumedNormalSP. The XP receipt retains
the original summed quantity, reserved baseline/minimum and observed bit; both
XP/derived level and SP must be saved before the level-up effect is observed.
No level gained means no SP claim. At full SP, a positive level-up keeps its
capped target and permits the XP award; other full-cap recovery policy is
unchanged. Nullable migration never invents missing old SP evidence. See
[dispatch receipts](friendship-reward-contract.md) for party deletion and cold
recovery limits. There is no new permanent spendable-SP floor.

No native SP is pre-credited by the server. Existing unrelated profile fields,
wallet grants, panel operations and pending awards are retained. Missing legacy
receipts are not backfilled from guessed costs or baselines: the old queue stays
intact and requires reconciliation. Malformed input and unexpected SQLite
failures stay genuine failures, not successful gameplay or unsupported-feature
cancellation.

## Deferred evidence and limits

Run `node tools/test_stamina_consumes.cjs`, the updated general/master checks,
ability-panel probes and recovery probes in the consolidated batch. Combined
consume/Abyss synthetic probes cover allfive costs/envelopes, pending identities and aliases,
session/restart/cache eviction, conflict rejection, completed-callback recovery,
distinct later purchases, three SP effects, all999 maximum exports, int32/PvP/PvB
caps, split save/ACK/later spending, ownership, insufficient Iris, legacy queues
and debit/queue/receipt/identity/reply/observed-save/ACK rollback points.
Also run `node tools/test_stamina_rewards.cjs` and the updated mixed gift probe:
all six present/mission/refill issue orders, both archived SP missions,
distinct targets, split saves/restart/spending and absent or changed receipts.
The updated `node tools/test_friendship_rewards.cjs` additionally defers
per-level dispatch sums, unchanged/max player level, full/near-int32 SP caps,
XP-coupled observation, both dispatch/present and dispatch/refill issue orders,
observed pending spending/reuse, nullable legacy migration and SP receipt/save/
ACK/reply rollback. These source lower-bound fixtures do not certify exact
native refill totals across queued player-level transitions.

These probes are written but **NOT RUN**. Only syntax and metadata-generation
checks have been performed. No launcher build, installation or MuMu test was
performed for this slice; the real player save is untouched.

Native hot/cold SP delivery, delta/ACK order, purchase eligibility, regeneration,
calendar transitions, native delivery of the recorded source interleavings,
uncaptured other stamina producers, comparison with
native displayed totals, unchanged callback navigation and long-session behavior
remain unverified. An observed balance is not independent proof of which native
event caused every SP increase. Serial-SP configuration/exact-save source proof
has now been added in [Abyss attempt contracts](serial-pvp-stamina-contract.md),
with separate deferred `test_serial_pvp_stamina.cjs` fixtures. Revival now has
an exact active-stage purchase receipt and same-encounter hot-retry guard, but
the client exposes no persisted defeated-state predicate; native modal/event
revival, dungeon-ticket publisher allocation/costs and obsolete-callback UI
remain incomplete. This is not a crash fix or complete gameplay certification.

## War Game timer and exact refill receipt (2026-10-06)

Operation10400 now supersedes the old War Game minimum-only observation.
Original `254421c:25443b0` constructs a fixed1800-second interval (`0x708`).
The exact `2544488:25444c8` assembly reads the encrypted stock at `+0x88`,
compares against9 and skips the refresh for stock>=10. Otherwise it calls
`25444d0:2544610`: elapsed time is clamped nonnegative by2544610, complete
intervals add SP up to10 and advance the saved timestamp by whole intervals,
preserving the remainder. No interval means no timestamp change. Full/extra
stock10..15 does not decay or refresh merely because time has elapsed.
Native2544728 returns5 and2544704 returns15; the refill preserves the timestamp.
The generic consume's exported recovery1 is **not** this native recovery5.
Consumption2544958 resets the timestamp when pre-consumption stock>=10, then
subtracts its supplied positive quantity. This does not prove a battle's cost.

The decompiler's PIC rewrite hid2544488's conditional refresh. Original
instruction bytes, not that misleading getter output, establish the branch.
Serialization25ed674/25ed6b8 binds `pvpSP` to protected stock `+0x88` and
`pvpSPUpdatedAt` to the protected long `+0xb0`;25ea800 sets that long and dirty
bit. Completed serial read-only artifacts are
`pvp-stamina-domain-getter-timer-cost-exact-20261006.txt`,
`pvp-stamina-interval-and-updated-at-exact-20261006.txt` and
`pvp-battle-manager-stamina-refill-exact-20261006.txt`. Their assembly branch
and serialization follow-up was inspected directly from the unchanged ELF.

Two nullable columns in the existing `hard_currency_consume` receipt retain
issue time and the exact native stock/timestamp baseline. Existing debit,
operation, received-wire identity, save/ACK and reply transactions are reused;
no new service, dependency or native-profile precredit. Pending callbacks have
bounded alternatives for the raw persisted stock or the original interval
projection at issue time, because the live client's unsaved timer may lead the
server profile. Acknowledgement requires one exact corresponding refill
stock **and timestamp**, or its previously committed observation. A matching
natural-refresh-only save is allowed but cannot acknowledge the refill.
Unrelated higher stock or timestamp changes cannot pass a minimum test.
Native int32 timer/addition overflow is retained as unavailable, not wrapped.

Before observation, unrelated stock/timer changes are rejected; after the
observed refill, later SP spending has no permanent floor. A split save
suppresses10400 from both singular/plural push delivery until ACK, preserving
the actual queued operation. Other pending replay/login/confirm paths cancel
instead of repeating its additive callback. Rewind or interval drift outside
the frozen timer alternatives cancels unobserved redelivery without a new
charge. UserInfo replacement pulls are blocked while the refill is pending;
cached binary pulls after a refill compare current full bytes and cannot
restore old stock. Missing/corrupt nullable legacy capture is not reconstructed
from the current save, deleted or acknowledged.

Extended `test_stamina_consumes.cjs` queues exact interval boundaries/remainders,
future timestamps/full/extra-stock preservation, int32 overflow, independent
native5 versus generic1, both raw/projected exact targets, natural-only save,
wrong higher stock/timestamps, changed clock/cold replay, split save/spending/
ACK, stale native pulls, nullable legacy/corrupt receipts and transactional
profile/observation/ACK/reply rollback. **DEFERRED / NOT RUN.** Syntax/static
checks do not establish native ordering, clock-skew/delayed callback convergence,
independent earning, usable interrupted recovery, purchase eligibility,
signatures, battle costs, matching or combat. War Game start/restart/end still
require implementation. Actual save/listener/APK/MuMu untouched; no workers,
GitHub Actions or functional test run. Audit stays175 routes,100 partial,
75 unsupported and zero feature-complete.

## Record Buster daily reset and refill persistence (2026-10-06)

SOURCE ONLY; functional/native acceptance remains **DEFERRED / NOT RUN**.
Original bounded `2546578:254668c` compares now against the protected long
at `+130`, then uses `2a3a450:2a3a5dc` to compare calendar dates. That helper
calls the ELF-resolved `gmtime` import at `d65350`, with original region5's
`+32400` offset from `2a3951c:2a3975c`. There is no30-minute tick in this mode.
`25463b4:2546578` raises stock below5 to5 on a new day and always writes the
reset time, even when retaining higher stock. Future/same-day times do not reset.
`254668c:2546694` returns5; `25466b8:2546704` reads the current getter before
adding5/capping10. `2541b00:2541b34` applies that recovery for operation10500.
JSON serialization at `25ed730..25ed7bc` binds stock to `pvbSP` and the long
at `+130` to **pvbSPLastResetAt**, not pvbSPUpdatedAt. Setters `25ea9c0` and
`25eaaa0` mark changed native data dirty.

`currency/hard/consume` now captures its original10-Iris cost, issue time and
actual stock/reset pair in two nullable columns of the existing receipt.
The existing10400 stock/timer validation, replay suppression, native pull/cache
guards and transactional save/ACK path are shared with10500. War Game's original
timer alternatives are unchanged. No native SP/reset/profile/signature is
precredited, and no new queue/service or permanent spendable-SP floor is added.

For an expired low balance the correct purchase result is10, not raw SP+5.
The captured native stock must match exactly. A live daily reset can happen
before the request without a save, or during a delayed callback: its actual
saved reset second may be within the original issue day up to the observed
server-clock checkpoint. This is a bounded clock/save compatibility rule, not
independent proof of a native earning source. A reset-only save can update the
captured pre-effect state but cannot ACK the purchase. Same-day/future baseline
timestamps remain unchanged. Wrong higher stock, replaced reset timestamps,
clock-rewind/next-day unobserved redelivery and damaged legacy captures cancel
or reject with saves/queue retained. Dates outside native signed32-bit calendar
handling remain unavailable rather than claiming unverified wrapping support.

A separately observed refill suppresses singular/plural push delivery until
real ACK; hot/cached/cold callbacks cannot repeat it. Later spending is legal
and the observed proof survives restart. Receipt metadata, wallet debit,
operation, actual-wire identity, profile/checkpoint, ACK/done/queue and reply
use the existing atomic transactions. Legacy NULL columns are not backfilled.

Extended `test_stamina_consumes.cjs` and the explicit general-server fixture
queue calendar midnight/stock preservation/same-day/future/int32 boundaries,
expired versus already-reset outcomes, exact stock/time, unsaved earlier reset,
natural-only save, delayed callback, changed-clock redelivery, corrupted/NULL
receipts, stale native pulls, split observation/restart/spending/ACK, replay,
once-only debit and profile/observation/done/queue/reply rollback. **NOT RUN**.
Native clock skew, natural battle costs, mixed producers, callback/save ordering,
signatures, UI/back/recovery/crash-ANR/performance remain unverified.175 routes,
107 partial/68 unsupported/zero complete; actual save/listener/APK/MuMu/master
untouched, no workers or GitHub Actions, co-op last.

## Executed isolated checks (2026-10-06)

`node tools/test_stamina_consumes.cjs` passed on disposable SQLite saves,
including both War Game/Record Buster exact refill paths, daily/timer boundaries,
delayed reset, clock changes, split save/restart/spending/ACK, stale pulls,
missing legacy captures and transaction rollback. Its confirmation fixture now
sends the original bodyless request rather than encrypted JSON null; server
validation is unchanged. This supersedes this script's earlier NOT RUN notes,
not the unexecuted general/Abyss/reward probes or native acceptance requirements.
No real save, listener, APK or emulator was changed.
