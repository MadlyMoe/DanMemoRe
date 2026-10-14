# Offline subscription packet contract

## Details snapshot integrity — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-14)

`notice/subscription/get` intentionally keeps the exact page returned to an old
request identity even after the event clock advances. Its cache path now parses
that page's displayed UTC+9 generation timestamp and rebuilds the complete body
from the selected original plan. The cached `{code,result}` JSON must match that
historical reconstruction byte for byte. A plan marker alone can no longer
admit damaged, truncated or altered HTML; malformed JSON, an invalid timestamp
or changed original catalog data recovers with 3000999 and retains the cached
evidence and gameplay state. Fresh identities still render the current event
clock. Viewing or validating a page creates no membership, bonus, inventory,
wallet or operation state.

The deferred details fixture now changes the cached heading while retaining the
correct plan marker and timestamp, then requires read-only recovery. Existing
stable old-clock, fresh-clock, restart and transaction cases remain. WRITTEN
ONLY / NONE RUN; native WebView rendering, scroll/close/back, enrollment/reward
effects, performance and no crash/freeze/ANR remain unverified. No checks,
builds, listener, APK, ADB, emulator, workers or Actions ran; 176 partial / 0
unsupported / 0 verified complete.

Latest SOURCE ONLY / PARTIAL / UNTESTED [mission ticket prefix](mission-ticket-reward-contract.md)
adds first/owned ordinary6000 tickets to shared28000 prefix planning; original
subscription entitlement, XP/SP ordering and actual native ACK remain unchanged.
384 new mixed contexts/192 following refills are WRITTEN ONLY / NONE RUN;
scalar totals1264/632 supersede earlier880/440 totals only, not native acceptance.

## Mission unit/card prefix — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Shared28000 prefix planning inherits original29/30 mission PC/card cold recovery:
fully observed/preowned rows are omitted, entirely untouched rows retain original
wire values, incomplete unit constructors refuse. Existing source-bound PC/boards/
character/wardrobe/story/card EXP proof, saved SP filtering, membership quantity/
ticket/order/cache/token/full actual ACK remain. No new membership context or
schema/native credit/constructor/ACK waiver. New57 character recovery contexts/
27 refills are WRITTEN ONLY, NONE RUN; shop-paired cards and other unfinished
branches remain partial. Actual saves/listener untouched.

## Captured casino mission prefix — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Shared28000 prefix validation uses the same captured6000 casino recovery as10200:
untouched original medals may remain positive after other components are saved;
observed medals become0 only with retained actual save proof. Fully capped issuance
needs a distinct saved nonce, not just a saturated counter. Partial casino effects
and legacy overlapping partial saves refuse. No membership target/quantity/ticket/
SP/order/token/cache/ACK changes or extra subscription test contexts. Updated432
mixed casino cases/216 refills are WRITTEN ONLY, NONE RUN; earlier zero-call adapter
unbuilt/uninstalled and source DDL unapplied. Actual saves/listener untouched.

## Observed casino-mission prefix — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Shared28000 planning now uses observed6000 casino recovery alongside captured
items/SP only when the original owned medal receipt observation validates.
The derived zero-medal reply requires the guarded ARM64 zero-call adapter,
SOURCE ONLY/NOT built-installed; the original0 adder otherwise rewrites casino
signature. No source quantity, membership target, ticket filter, order/token/
cache or actual ACK requirement changes. Unobserved casino partial saves still
refuse; no baseline or balance is fabricated.288 NEW WRITTEN ONLY casino cases
exercise the shared prefix via144 refills, not new membership cases or native
acceptance. NONE RUN; docs/achievement-reward-contract.md.

## Captured dated-mission prefix — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Shared28000 prefix recovery now accepts observed6000 SP with original captured
dated ticket rewards as well as captured numeric items. Every item requires
its exact original capture and complete observation or untouched state; expiry
pruning is not acquisition and incomplete gains still refuse. No date/item/SP/
Iris renewal or source/membership-target rewrite; original order/token/cache/
ticket filtering and full real ACK requirements stay intact.384 NEW WRITTEN
ONLY dated mixed mission cases exercise the shared planner via192 refills;
these are not new membership cases or native acceptance. NONE RUN. Pending
lottery-consumption interlocks remain; docs/achievement-reward-contract.md.

## Captured numeric-mission prefix — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Shared28000 prefix recovery now also accepts observed6000 SP alongside original
captured numeric mission items. The common `achievementColdRecovery` must prove
each item untouched or fully observed, filter only observed items/flags, and
zero only saved SP. Incomplete gains, dated/uncaptured items and other mixtures
remain refused. Original membership target/order/ticket filtering, canonical
queue/token identity and full actual ACK proof stay intact; no item/SP/Iris
renewal or spending-floor rewrite.384 NEW WRITTEN ONLY mixed mission cases
exercise the shared planner via192 refills; these are not new membership cases
or native acceptance. NONE RUN; docs/achievement-reward-contract.md.

## Observed scalar-mission prefix — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

The shared28000 prefix planner can skip observed scalar-only6000 SP/Iris rewards
only after original capture validation and proof of the derived zero-SP reply.
It keeps actual saved/spent SP as the baseline, canonical original outgoing
order, original membership reservations/ticket filtering and full real ACK
requirements. Mission Iris is not credited again, source quantities are not
rewritten, and unsaved SP retains exact captured before-state checks. Mixed
rewards/partial XP/ambiguous history remain unfinished.112 NEW WRITTEN ONLY
mission contexts exercise this shared planner via56 following10200 refills;
they are not additional membership cases or native acceptance. NONE RUN.
See docs/achievement-reward-contract.md; no new DDL or save/listener changes.

## Observed pure-Present prefix — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

An observed pure-stamina2000 gift may now precede28000 without renewing its SP:
the original claim/queue/receipt must validate and its exact derived cold reply
must omit that observed stamina row. Canonical original outgoing entries are
used for prefix calculations even when the final gift envelope is derived.
Real saved/spent SP is the baseline; original membership reservations/quantity/
ticket filtering/signature/token/full actual ACK proof remain unchanged. This
does not recover mixed Iris/ordinary/unit/equipment/casino gift effects or
partially saved XP/ambiguous history. See docs/gift-reward-contract.md for
original client evidence and72 WRITTEN ONLY gift contexts, including36 following
refills. Eight NEW WRITTEN ONLY test_subscription_bonus.cjs contexts add trial/
regular after observed/spent gift SP with unsaved/first-saved membership tickets,
canonical/derived full queue, no precredit/renewal, cache restart/stale queue and
real ordered gift/member save/ACK closure. NONE RUN; synthetic enrollment/rows/
signature/save order do not establish native membership acceptance.
Counts124 partial/51 unsupported unchanged; no new DDL/precredit/receipt repair,
actual saves/listener untouched and all acceptance remains deferred.

## Shared refill-prefix planner — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Membership28000 and normal10200 now share the original queue-bound XP/SP prefix
planner. This supersedes the standalone-refill gap below only for intact captures
and their guarded ordered delivery; missing/coalesced or partially saved XP is
not reconstructed. Fresh normal refills and hot retries reserve unobserved original
SP targets and remaining XP. Cold delivery requires the exact untouched EXP/SP
chain and original capacity at the refill's position. An already observed
membership SP is omitted by the existing derived28000 reply and is not added
again or made a permanent floor; real saved/spent SP remains the baseline.

Normal10200 is withheld from all save replies without removing its real queue,
changing its receipt, observing the effect or acknowledging it. Valid intermediate
saves may commit; later valid cold confirmation or actual native save/ACK remains
required. This offline reply policy is UNTESTED, not native acceptance or a claim
about the retired publisher server. Existing exact original/derived membership
envelopes and cached full-queue/token guards remain unchanged.

Eight additional WRITTEN ONLY test_subscription_bonus.cjs contexts cover both
trial/regular and independently saved/unsaved membership ticket/SP components
before a real original10-Iris10200 purchase. They assert no second grant/charge,
unchanged actual source captures/native profile/queue/wallet, derived cold output,
cache bytes after restart, no refill on save-only replies, stale full-queue refusal
and real ordered membership/refill save/ACK closure. Four standalone cases and
six expanded existing gift/mission/refill cases are described in
docs/stamina-consume-contract.md. None run; synthetic enrollment/funding/save order
is not native earning/application/attribution proof. Counts124 partial/51
unsupported unchanged; no feature-complete, crash-fix or stability claim.
No new DDL/ledger/native patch/precredit/receipt backfill; earlier DDL UNAPPLIED,
actual saves/listener untouched and acceptance remains deferred until all packets.
The shared prefix planner requests unavailable503 for invalid already-stored
EXP/level/floor input. The same getter retains its original400 default for
submitted-save validation; no state is repaired or credited. Five damaged-state
variants per standalone refill context are WRITTEN ONLY, including fresh/cached
delivery and separate malformed-save rejection. Other recovery gaps remain.

## Original XP/SP prefixes — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

This supersedes the earlier stage/expedition-SP prefix refusal only for an
untouched original captured reward actually retained in the guarded outgoing
queue. It does not restore partially saved XP or infer missing/coalesced history.
The native stage246c428 and dispatch2540b54 paths set EXP, refresh the player
level through2540618, then add each crossed original level's capacity through
2548998. Native10200 subsequently reads that resulting level's capacity.
Evidence: `.work/stage-player-xp-provider-exact-20261006.txt`,
`.work/expedition-boost-map-exact-20261004.txt` and the existing original
player-level/capacity export. No publisher server behavior is inferred.

Membership recovery now carries virtual EXP and level alongside SP for original
5000/16000/25000/21000 captures. Existing stage/dispatch receipt validators retain
the original base/boost/skip amounts, equipment inputs, capped EXP target and
per-level SP sum. Each XP before-value must equal the preceding virtual EXP;
the original minimum advances EXP/level even when there is no level-up SP.
Positive SP must still continue the exact unsaved before-SP/minimum chain.
The normal-SP refill check uses the level at its position in that same queue,
not the last saved level for every prefix. Existing delivery guards still reject
partially observed stage/dispatch effects before this recovery plan is used.

Fresh10200 issuance now reuses the owned native EXP/level/floor getter and the
same original XP receipts, walking only pending stage/dispatch operations in
order. Already-saved EXP is not added again; a remaining captured XP baseline
must exactly follow the virtual value before choosing the final original level
capacity. The existing SP reservation, original10-Iris cost, empty parameters,
wallet/receipt/request transaction and signed operation are unchanged. Missing
or inconsistent captures cancel before charging. Existing purchase receipts
are never rewritten; membership recovery retains/refuses an older refill target
that differs from the native capacity at its outgoing queue position.

`test_subscription_bonus.cjs` adds64 WRITTEN ONLY contexts: stage/dispatch,
trial/regular and unsaved/first-saved tickets;56 use XP alone, either order with
gift/original SP mission/refill, and eight retain positive EXP without crossing
a level. Original master96 stage EXP/300 dispatch EXP, level capacities20/21/22
and long EXP thresholds are used unchanged. Cases describe original full queues,
EXP/SP/capacity order, no precredit/recharge, missing/altered captures, incorrect
native baseline, old-capacity refill retention, failure before a new debit,
early ACK, login/pull/cache restart/stale replies, sequential source saves/ACKs
and original membership closure. Existing `test_friendship_rewards.cjs` dispatch
refill cases now assert the original capacity before or after queued XP.
NONE RUN. Elapsed dispatch, imported levels/rows, gift quantities, funding,
enrollment, signatures, constructors and callback/save ordering are synthetic
prerequisites, not native earning or application acceptance.

Special-mode providers, partial-XP recovery, ambiguous attribution/regeneration,
uncaptured/coalesced history, broader standalone old-refill reconciliation,
constructors, saturated membership issuance and full UI-clock-performance-
stability remain unfinished/unverified.124 partial/51 unsupported unchanged;
no new route is complete. No new schema, ledger, reward, native field or patch;
earlier DDL UNAPPLIED/actual saves-listener untouched. No tests/checks/generators,
build/APK/install/restart/emulator/ADB/workers/Actions; all149 packets and unfinished
variants before acceptance/co-op last.

## Earlier normal-SP refill — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

This supersedes the earlier unacknowledged10200-prefix refusal only when the
refill has not yet been observed and its original receipt still matches the
native effect. Original254169c reads the current level capacity through254857c
and1d31664, then25488e0 adds it with signed-int32 saturation. The capacity is
the original `playerLevelStep` slot3 export, not a fixed Present quantity.
The original81041001 price, empty10200 parameters and signed queue are unchanged.

Membership recovery now accepts2000/6000/10200 in its actual guarded outgoing
earlier queue. A10200 prefix must retain the existing paid purchase receipt,
original consume/type/cost, empty parameters, baseSP field and unsaved marker.
Its before-SP must continue the exact ordered chain, and its recorded minimum
must equal min(INT32_MAX, before-SP + the current original level capacity).
Missing capacity, a changed level with a different native target, altered or
missing receipts, a broken baseline or an observed effect cannot supply this
prefix. The retained minimum advances the virtual chain; no SP, wallet, receipt,
claim or queue is prewritten and no purchase is recharged or refunded.

The shared delivery path also validates10200 receipts and suppresses an observed
refill from save replies without deleting its queued operation. Fresh/cached
hot callbacks and cold login/pull/confirm remain unavailable until its existing
real native save/ACK settles it; legitimate spending after observation is not
turned into a permanent SP floor. Once that refill ACK retires, membership
recovery continues from the actual saved SP. No zero-SP native invocation,
synthetic success ACK, new DDL, dependency, ledger or native patch is introduced.

`test_subscription_bonus.cjs` adds24 WRITTEN ONLY mixed gift/mission/refill
contexts: all six source orders, trial/regular membership and unsaved/first-saved
tickets. Four existing refill-first contexts now expect the proven unsaved
queue to be delivered; together with the existing12 gift/mission contexts this
is40 contexts. Cases include original capacity/cost/quantity/order, no precredit,
early ACK, exact cached bytes/restart, lost/altered purchase receipts, changed
native level, missing capacity metadata, saved-unacknowledged refusal, sequential
source saves/ACKs and final original membership proof. The standalone10200 case
in `test_stamina_consumes.cjs` now also describes observed-reply suppression,
fresh/cached/login/pull/confirm refusal, retained queue and no second charge.
Existing `test_stamina_rewards.cjs` mixed producer orders also describe refill
suppression; its missing-purchase case now includes login/pull/confirm refusal.
NONE RUN. Imported rows, gift quantities, funding, enrollment and save order are
synthetic prerequisites, not native earning, signature or callback acceptance.

Stage/expedition XP-SP prefixes, ambiguous attribution/regeneration, uncaptured
history, broader standalone unsaved refill interleaving, constructors, saturated
membership issuance and full native UI-clock-performance-stability remain
unfinished or unverified.124 partial/51 unsupported are unchanged. Existing
DDL remains UNAPPLIED; actual saves/listener untouched. No tests/checks/generators,
builds/APK/install/restart/emulator/ADB/workers/Actions; all149 packets and their
unfinished variants before acceptance; co-op last.

## Ordered earlier SP grants — SOURCE ONLY / UNTESTED (2026-10-10)

This supersedes only the blanket unobserved-SP baseline refusal when earlier
original2000/6000 stamina grants are actually delivered before28000. The existing
reservation may already include these grants even though the server's current
saved SP does not. Requiring current SP to equal the membership's reserved
before-SP incorrectly blocks that cold queue order.

Recovery now runs after the existing operation-delivery guards and suppression.
It uses the actual outgoing earlier queue, not every pending receipt or completed
history. For login/pull it validates the same guarded future-confirmation plan
without emitting rewards. Each earlier positive SP grant must retain its original
queued type/parameters/token/signature and receipt, ordered before28000. Its
captured before-SP must equal the preceding virtual balance, its effect must not
already be observed, and original quantity/int32 saturation must reach the next
captured balance. The final virtual balance must exactly equal28000's before-SP.
No native balance or receipt is written by this calculation.

Missing, reordered, altered, suppressed or already-observed grants cannot satisfy
the chain. SP from a stage/expedition prefix and an unacknowledged10200 refill
remain explicit gaps here; they are not converted to ordinary presents. Once an
earlier refill completes its existing native save/ACK, normal membership recovery
can proceed against that actual saved balance. This does not infer regeneration,
publisher ordering, arbitrary interleaving or independent SP attribution.

The original2000/6000 and28000 operations, quantities, displays, request identities,
dates, wallet and signed queues are retained. Membership item filtering and full
original ticket/SP ACK requirements are unchanged. The same plan validates fresh
and cached confirmations; a changed queue/token/projection cannot replay an old
response. Only indexed current queue/receipt lookups are added, not a new ledger,
DDL, native patch, history aggregation, SP floor or profile precredit.

16 additional contexts are WRITTEN ONLY:12 trial/regular memberships with a
Present, one original SP mission, or Present-then-mission before28000, each with
unsaved or first-saved membership tickets; four earlier-refill contexts remain
unavailable until that refill ACK. Cases cover original reserved quantity/order,
missing/duplicate/reversed/changed prefixes, no precredit, selective confirmation,
early ACK, login/pull, exact cold restart bytes, sequential native-shaped prefix
saves/ACK, stale queue rejection and final membership closure. Present13 and all
enrollment/completion/save prerequisites are synthetic; the original mission reward
quantity is read unchanged from the master. NONE RUN; native application, timing,
signatures, actual enrollment/earning and UI stability remain unverified.

Source coverage is now124 partial/51 unsupported because the unrelated fake
legacy dungeon-ticket success was withdrawn. Earlier DDL is UNAPPLIED; actual
saves/listener untouched; no tests/checks/generators/builds/APK/install/restart/
emulator/ADB/workers/Actions. All149 variants before acceptance; co-op last.

## Bonus28000 component recovery — SOURCE ONLY / UNTESTED (2026-10-10)

This supersedes only the older blanket cold cancellation after a saved28000
component. It does not complete membership, billing, Prism exchange or native
acceptance. No tests/checks/generators/build/APK/install/restart/emulator/ADB/
workers/Actions were run, and no actual save was opened or migrated.

Original24981c0:2498a14 iterates `gainedBonus`; only type0 invokes additive
stamina recovery. It then independently checks and iterates the three optional
lower-case full-row arrays. Empty arrays do not invoke the corresponding userdata
setters. The exact original contract is retained in
`.work/subscription-bonus-operation-exact-20261004-5.txt`. Recovery therefore
removes observed rows from these arrays and removes already-observed type0
grants, rather than submitting a zero stamina gain or reimporting spent stock.

Cold confirmation is derived from the original retained queue and receipt:

- Every observed ticket still requires owned saved acquisition, its retained
  stock floor and bounded spending/date-pruning proof. Each unobserved ticket
  must still match its captured baseline; an unproven changed row is refused.
- Observed stamina keeps its existing acquisition flag and may already be spent.
  Without that flag, the owned saved SP must equal the captured pre-grant SP.
  Ambiguous regeneration, interleaving or an imported changed prefix is not
  treated as proof or guessed into a second grant.
- Login and binary pulls validate this recoverable state without delivering a
  reward. Only `user_data/confirm` emits the component-filtered operation. Hot
  membership retries remain unavailable once any effect is saved; save replies
  continue suppressing that original operation.
- Original token/signature/queue, request identity, claim time, quantities,
  display arrays, ticket dates/expiry, entitlement bindings, inventory and wallet
  stay unchanged. Fresh or cached confirmation accepts only the original or
  exact current derivation; stale tokens/changed projections are refused.
- Full original ticket and stamina proof is still mandatory for atomic ACK. A
  fully observed confirmation may contain no remaining effects because they
  were actually saved; it never marks them saved or completes the queue itself.

The same saved-ticket predicate is reused by persistence and recovery. No new
DDL, table, ledger, native field, constructor, SP floor, publisher request or
client patch was added. Existing offline daily-variant and monthly-retention
choices are unchanged and are not recovered publisher rules.

84 additional scenarios are WRITTEN ONLY: six trial,62 regular and14 expired
component/save-spending combinations, plus two imported unproven SP/date prefixes.
The existing partial-trial case now expects selective cold recovery. Deferred
cases cover no precredit, same signed queue/source, skipped acquired components,
remaining effects, login/pull, hot refusal, early ACK, lost item observation or
stock floor, lost SP flag with a conflicting save, exact cached bytes/restart,
changed-projection rejection, ACK rollback and closure without restoring spent
stock. NONE RUN; local receipts, imported rows, timestamps, spending and save
order are synthetic, not native earning, constructors, SP attribution or UI
callback evidence. Lost indistinguishable history, cap/calendar/batch variants,
native claim-row propagation and all broader membership acceptance remain
unfinished.125 partial/50 unsupported unchanged; earlier DDL UNAPPLIED and actual
saves/listener untouched. All149 packets and variants before acceptance; co-op last.

## Prism capped full-row save follow-up — SOURCE ONLY / UNTESTED (2026-10-10)

This supersedes the older saturated28100 refusal and missing split/spent-save
statements only. It does not complete subscription, character upgrades or native
acceptance. All149 packets/variants must be implemented before consolidated
tests. No tests/checks/generators/build/APK/install/restart/emulator/ADB/workers/
Actions were run; no actual save was opened or migrated.

Pristine23e0338 imports lower-case full-row arrays through27db51c/2640d10 and the
shop reader. It does not call lottery's stock-difference/operation-signature
setter. Native26415bc/2640684/2640768 retains the six General Bond fields and
UInt8 book/full UInt32 signature. Original products207004490/491 still cost
three unexpired331000001 shards per291000002/3 bond, without invented products,
prices or refreshed expiry. The local reconstructed target caps both stock and
lifetime at the original999999999 maximum; original shop counts must still fit
Int32. Full stock may discard overflow while still consuming the original cost;
this capped exchange policy is not a recovered publisher-server response.

The existing subscription_exchange_claim now has nullable stock_state, policy
offline-prism-stock-v1. It records bounded positive stock additions and separate
shard/bond/shop observations, bound to its original before/target rows, operation,
request bytes and quantity. Stock allowance is the captured absolute stock
difference, not the requested count after overflow. Spending never refunds it.
Lifetime cannot rewind or exceed the captured target; shard dates can only be
removed while pending. No native inventory, signatures, book bytes, shard debit,
shop count or completion flags are precredited.

Split table saves can arrive in any order. A stock/cumulative prefix does not
prematurely close unfilled stock. First observed already-spent bonds can close
on the complete three-table saved import or native ACK with all other effects;
after closure no addition remains. The wire bond signature/book are preserved,
not replaced with the operation signature. Observations and completed floors
commit atomically with profiles/tokens/queue/done/exact reply, using compare-prior
receipt updates. DDL SOURCE ONLY / UNAPPLIED; old missing captures remain NULL,
unknown and queued rather than reconstructed from post-exchange balances.

Any observed effect suppresses28100 only on push replies; it retains the pending
queue/ACK. Cold or cached replay requires an untouched baseline or exact fully
observed target, otherwise recovery refuses an unsafe absolute replacement.
Completed capped Prism stock uses the existing changed-ID guard; only a proven
pending original producer can add stock. Shard spending advances the existing
date floor on every subsequent save, including after ACK, so spent dates cannot
be restored just because an older exchange originally owned them. No new ledger
or lifetime aggregation was added.

WRITTEN ONLY / NONE RUN:283 new scenarios in test_subscription_tickets.cjs:
280 seven-counter-baseline/two-product/two-count/ten-save-order combinations,
two original-item ordinary Present gains after completed capped exchange, and
one nullable old-schema/unknown-receipt preservation case. Includes all six
table orders, stock/cumulative prefixes, first-spent import, caps/native widths,
corrupt captures, missing effects, partial/ACK rollback, cold exact ACK bytes,
no redelivery, spending/restoration/deletion refusal and subsequent exchange.
These synthetic source cases are not native signing/order/provenance acceptance.

Unsafe spending before an untouched full-row import, legacy capture recovery,
additional/coalesced producers, native earning/upgrade consumption, broader
membership/ticket validation and UI/clock/recovery/performance/no-crash/no-freeze
proof remain unfinished/unverified. Counts125 partial/50 unsupported unchanged;
no complete packet or feature claimed. Co-op remains last.

## General Bond native validation follow-up — SOURCE ONLY / UNTESTED (2026-10-10)

Original26415bc/2640684/2640768 requires six fields/limitBreakItemId with UInt8
book/full UInt32 signature. The28100 validator now uses the actual original
item profile rather than a table-only stub, permits those widths and rejects
missing/extra/unknown fields or identities without repairing saved rows. Ticket
validation is unchanged. Deferred cases cover both original exchange products
with book255/full signatures,13 malformed retained baselines, corrupt absolute
targets, atomic refusal and cold retention; NONE RUN. Ordinary capped Present/
shop General rewards now have their own shared capture handling, but saturated
28100 absolute replacements/interleaved spending are still explicitly unfinished.
See general-bond-item-contract.md. No live save/schema/listener changes or native
acceptance claimed; older full-row/consumption/recovery gaps remain.

Frozen client: 15.1.0. Original ARM64 SHA-256: `e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.

Current changes are source-only. No gameplay probes, native tests, build, installation, listener restart or actual player-save changes were performed. The details route, local membership service and bonus28000 route are partial, not acceptance of the subscription feature. Co-op remains last.

## Implemented details handoff

`notice/subscription/get` wrapper `1818db4:1818fc0` sends exactly `{subscriptionId}` from the selected original plan. Its callback `181c75c:181ca18` consumes top-level numeric `code`, then top-level string **`result`** on success. This differs from the `html` field used by the gacha/promotion notice routes.

The callback passes the string to `WebViewUIState::create` (`1fa1d4c:1fa1e60`). Its RTTI and initializer `1fa1e60:1fa1fa0` identify `WebViewUIState::initWithBody`, so the result is an inline HTML body, not a publisher URL. Relevant raw strings: `34c7fa2=code`, `34ffa19=result`. Ghidra addresses include an extra `0x100000`; this document uses raw ELF addresses.

The handler:

- Supports original IDs `1301000001` (Syr's Daily Lunch Box Set) and `1301000002` (Hostess of Fertility Full Course).
- Shows original names, catalog dates, event-clock snapshot, product/shop IDs, all daily variants, monthly ticket/shard rows and archived descriptions.
- Labels old prices, trial/payment/account/auto-renew terms as retired source text, not current offline billing terms. Shows the separate local membership and reward policy; native enrollment and bonus delivery acceptance remain pending.
- Escapes source text; adds no scripts, remote artwork, URLs, purchase buttons or publisher requests.
- Uses the existing SQLite request/reply transaction and exact snapshot cache. Reopening gives a new clock snapshot; exact retries retain the earlier page. Cached wrong-plan or missing-result pages recover3000999.
- Requires all four daily and two renewal rows for the selected frozen plan; missing data does not become an empty successful catalog.
- Allows read-only archived details outside catalog dates; those dates are not a purchased entitlement or availability bypass.
- Does not create operations, enroll/renew membership, grant stamina/tickets, mark claims, change signatures or modify player tables/wallet. Bookkeeping uses the normal event-clock high-water and transport sequence/cache paths.

## Original archive provenance

Five additional original tables are exported in the existing master file; total sources are now **117**. No additional asset download/extraction is needed for this source change.

| Source under `contents/1/master/divide_enc/` | Rows | SHA-256 |
| --- | ---: | --- |
| subscription.enc | 2 | 45e0a9c947fe45e8b9b4122e0e5f88d46cc5ef58e44e559d8fc082870d64e1fb |
| subscriptionItem.enc | 8 | 5cdb1bb86071546c1dd3cdd52ff413fc4559643fb712dac380391864887ac965 |
| subscriptionExtendItem.enc | 4 | 3c3ad4f411883e1450fcdca6234845f9e4e8929ce83242f20874de18d1babdca |
| subscriptionDisplay.enc | 3 | 4d68f668d51a93d552da031ef1cc3e3f3be923311f100f94cd01229856db2cdc |
| skipTicket.enc | 2 | 3d9d38cd2abb163e2dc31766dd5aa87b818007c389b5e84efb46e97ab61bb25b |

Daily rows for each tier contain stamina `205000005 x100` and either skip ticket `288000001 x5` or assist ticket `288000002 x5`. Unrecovered subscriptionItem slot5 is retained as `slot5`, not assigned a trial/current flag. Both variants are shown as raw source rows, not a doubled daily award.

Renewal rows contain tier1 ticket `296000015 x1` or tier2 Celestial Festival Ticket `296000149 x1`, plus Prism Bond Shard `331000001 x1`. Names are joined from original currency/gachaTicket/subscriptionTicket/skipTicket rows. Archived descriptions exclude monthly ticket/shard awards during the trial and date their30/180-day lifetimes from receipt. Local billing establishes eligibility; archive text alone does not establish a user's entitlement.

Subscription slot3 and skipTicket slots4–6 retain raw names until native meanings are recovered. Skip tickets are **not** registered as ordinary itemProfiles acquisitions: their native class and date/reset semantics are separate.

## Bonus handoff — source implemented, native acceptance pending

`subscription/bonus` wrapper `180ed48:180ef20` sends exactly `{isPurchase}`. Before requesting, `180ef20` invokes skip-ticket repository refresh (`234a268`, `234b188`) and `BeforeTicketBonusReceive`.

Callback `1811ef4:18120d4` delegates through `180ec60` to `181220c:18128d0`. On success it refreshes the subscription repository (`249669c`, `2496b30`), checks for an **errorCode field**, executes `TicketBonusReceive`, and reads:

- `displayBonus`: `type`, `quantity`, `subscriptionId`, `itemId`; type0 contributes stamina display, type2 skip-ticket display.
- `displayExtendBonus`: `quantity`, `subscriptionId`, `itemId`; grouped by the original plan tier for renewal display.

Raw strings: `328f1e7=errorCode`, `328f1f1=displayBonus`, `328f1fe=displayExtendBonus`, `328f211=quantity`, `328f21a=subscriptionId`, `35ee918=type`, `320163f=itemId`.

Native operation **28000** is registered through relocation `43291c8 -> 24981c0`. Handler `24981c0:2498a14` consumes:

- `gainedBonus`: type0 `quantity` uses PlayerStamina recovery `2540e78`, **not** ordinary stamina currency credit.
- Optional lower-case full-row arrays `userGachaTicket` (`gachaTicketId`), `userSkipTicket` (`skipTicketId`), `userSubscriptionTicket` (`subscriptionTicketId`), updating corresponding native domain userdata.

Raw array strings: `35476c6`, `34fa1e3`, `35476d2`, `3528635`, respectively. Empty/display-only success would not implement those effects.

The source now delivers actual operation28000, not display-only success. Success omits errorCode entirely, supplies both display arrays, and uses singular operation for the shared hot transport plus plural operations for the existing durable queue. isPurchase is UI context, not permission to claim again. Prism exchange28100 remains separate.

Explicit local reward policy and persistence:

- Each active committed tier earns its original100 stamina and5 assist skip tickets once per UTC+9 client day. New local memberships choose source slot5=1 explicitly; this is an **offline choice**, not recovered publisher slot5 semantics. Source slot5=0 remains visible but is not awarded simultaneously. The native default daily skip refill to5 is left alone.
- First per-tier trials earn no monthly ticket/shard. Each later regular commit atomically creates a once-only renewal entitlement. Missing entitlement evidence rejects; order retries do not recreate it. An atomic schema migration imports preexisting local regular periods once, without rebuilding a lost table over existing bonus claims.
- Unclaimed renewal entitlements are retained by this local service, including after membership expiry, oldest first in bounded batches of128. This is an **offline retention policy**, not reconstructed publisher monthly-forfeiture/calendar rules. Expired periods do not grant daily bonuses. No missed daily awards are backfilled.
- Monthly gacha tickets and shards use the captured **claim receipt time**, preserving the archived30-day gacha duration and original shard15552000 seconds. Retries retain that timestamp; they never refresh expiry. Tickets use native dateList/aquiredAt, shards add expireAt, and skip tickets use amount/cumulativeAmount/reservedAmount/lastResetAt. Existing row fields are retained; absent native book3/signature0 are local initialization defaults requiring native proof.
- Issuance captures full before/after rows without writing native profiles, signatures, SP, claim flags or wallet. Daily primary keys, monthly purchase IDs, exact operation receipts and actual-wire request identities commit with queue/sequence/reply. A settled old request recovers3000999 instead of reapplying rewards. A genuinely ineligible/already-claimed fresh request returns empty display arrays without an operation.
- Saved owned ticket acquisitions are required before ACK. Spendable amount/date multisets cannot exceed their last observed stock plus genuine additional cumulative acquisition. Deletion, cumulative rewind and missing observed floors reject. Shared dated-item reservations serialize overlapping full replacements versus gifts/missions/boxes/shop/Prism exchange; unrelated items remain available. Gacha's direct membership-ticket deduction also updates the stock floor atomically with its draw.
- SP uses the existing pending stamina receipt/reservation/save-proof path, shared with presents, missions, dispatch and Iris refill. It is not a UserCurrency grant or permanent SP floor; already-observed SP may be spent before ACK. This is a saved lower-bound observation, not independent attribution of every SP producer/regeneration event.
- Partial stock/SP saves remain queued and are omitted only from subsequent save replies, preventing unsafe absolute/additive reapplication. Fresh/cached/cold redelivery recovers until valid ACK or reconciliation. No queue/history is deleted to make login pass; cold recovery usability remains unverified and can still be blocked by old/partial receipts.

Daily claim-day units are owned server ledger units, not invented UserSubscriptionBonus.lastReceivedDay units. No native Bonus/ExtendBonus/TrialAlert rows are forged. Native claim-row propagation, publisher variant/forfeiture selection, default-book/signature correctness, actual SP/ticket effects and UI enrollment/popup/navigation/natural earning remain incomplete or unverified.

## Local no-charge membership service — source implemented

Five distinct SDK service paths are implemented separately from the 169 game API inventory:

| SDK path after `/billing/v1.0/payment/subscription/` | Method | Effect |
| --- | --- | --- |
| productlist | GET | Both original products, gated by original start-inclusive/end-exclusive catalog dates |
| purchase | POST | Prepare a persistent local order; **no membership or rewards yet** |
| purchase/commit | POST | Validate that order's local receipt and activate one period atomically |
| status | GET | Latest actual committed period for each tier, including inactive/expired status |
| history | GET | Paginated immutable committed activation/renewal records |

Original `Product.smali` requires product_id/name/price/description/thumbnail_url and parses product_type2, subscription_label, term/free_term and their period units. Both SKU strings are joined from original subscription rows. `DomainSubscription2495114:2495318` joins subscriptionDisplay.type to subscription.tier: the labels are **tier1/tier2**, not SKUs. Empty thumbnail_url is a source-only local catalog choice; artwork/native list rendering remains unverified.

Original `Shop.smali::a(Product,OrderListener)` sends exactly product_id/country_code/currency_code/translated_name/formatted_price/price, with an uppercase 32-hex paymentApiToken in X-GREE-GAMELIB. `Order.smali` reads entry.purchase_id and need_caution_for_minors, plus root product_id/receipt/signature. `Shop.smali::b(a0,PaymentListener)` separately posts purchase_id/receipt/signature to the subscription commit path. Its success adapter takes a root result OK; there is no ordinary consumable-store consumption after a subscription commit. No new client/store/auth patch was made.

The local service uses its own visibly `danmemore-local` receipt body and random per-order 256-bit opaque signature token. Commit requires the stored receipt and matching local token; external/provider receipts, unknown orders and cross-order tokens reject. This token is **not** a Google/Apple signature, purchased entitlement or verification result. No real charge, credentials, payment-provider request, wallet credit or marketplace authentication bypass occurs. Native propagation of these local receipt fields through the existing offline adapter remains pending; source fixtures echoing them are not native proof.

Original `Subscription.smali` requires each root entry-array row to have subscription_label/start_datetime/end_datetime/auto_renew/status/provider/term_type/grace_period_type/count_purchase. The SDK enums are VALID0/INVALID1, auto-renew NOT_ALLOWED1, regular term CHARGE0/free trial FREE1, and no grace0. CHARGE here describes the normal membership term, **not a monetary charge**: every local order price is zero. JNI `2b5fab8:2b60324` passes these getters into gamelib::Subscription; native `2b477a8:2b478a8` uses the `%Y-%m-%dT%H:%M:%S` date prefix. Responses use second-precision UTC ISO strings; native timezone conversion/expiry rendering is still unverified.

Provider is explicitly **offline**, not a falsely publisher-verified platform. Native `2495574:2495748` compares a trial provider to the original string `Google` (`35474ba`); that native branch and any needed own-client provider adapter are still unresolved. Source membership status is not proof the current game UI will accept enrollment or show the right platform notice.

Original `SubscriptionHistory.smali` requires entry.offset/limit/has_next/**subscriptions**, not the previous incorrect transactions array. Each `SubscriptionNotification` requires subscription_label/provider/notification_type/notification_datetime. Notification types `offline_activation` and `offline_renewal` are explicit local labels, not recovered publisher notification enums; native history-label handling remains unverified.

Explicit offline policy, not reconstructed publisher timing:

- First committed activation of **each tier** is a one-calendar-month trial. Later manual renewals are normal one-month periods, also free. No auto-renewal, background charge or bonus precredit.
- Month arithmetic uses the client's UTC+9 calendar and clamps a January31-style date to the next month's last day. End is exclusive and capped at the archived catalog end.
- Prepared orders expire after one event-clock day. Multiple prepared orders may exist, but commits cannot overlap an active or later committed period. A clock rewind cannot resurrect an earlier period or reset the permanent purchase count/trial.
- Exact order/commit retries retain their first response. A different wire body for the same identity rejects; the identity uses actual body bytes, not a claimed header digest. Replaying an older committed order after expiry cannot renew it.
- SQLite billing_subscription_order stores the order and nullable committed-period fields together. Unique per-tier purchase counts and committed-history indexes keep latest-status lookup bounded to two indexed seeks; pagination is indexed and no lifetime receipt scan is used per status request.
- Order creation and activation are separate atomic transactions. Missing/malformed metadata or corrupt local receipt/period evidence rejects without changing the native save, wallet, queue or history. Legacy positive native subscription claims without local entitlement evidence do not silently become an empty successful status.
- No UserSubscriptionBonus/ExtendBonus/FreeTrialEndAlert/SkipTicket/native inventory rows, signatures, game sequence or operation28000 are written by billing. That prevents activation success from being confused with actual reward delivery. The running listener and real save remain untouched by these source edits.

## Additional native claim-row evidence — do not invent native flags

| Native userdata | Original fields | Evidence |
| --- | --- | --- |
| UserSkipTicket | userId, skipTicketId, amount, bookEntryState, signature, lastResetAt, cumulativeAmount, reservedAmount | JSON2647f14:264848c |

The original skip-ticket signature reader uses UInt32 (`206b578`), so the
shared assist-ticket stock validator also accepts imported signatures through
`0xffffffff`; offline-issued signatures remain in the existing smaller range.
| UserSubscriptionBonus | userId, subscriptionId, purchaseStartAt, expireAt, lastReceivedAt, lastReceivedDay, dynamodbExpireAt | MessagePack280f7d4:280fb78 |
| UserSubscriptionExtendBonus | userId, receivedId, endDatetime, purchaseId, subscriptionId, isReceived, aquiredAt, dynamodbExpireAt | MessagePack280f358:280f7d4 |
| UserSubscriptionFreeTrialEndAlert | userId, subscriptionId, displayedAt | MessagePack280fb78:280fd8c |

Native ExtendBonus.endDatetime is int64 despite its name; purchaseId is a string and aquiredAt retains the original misspelling. Bonus has **no isReceived field**. Do not invent lastReceivedDay units, defaults or trial flags. Correction: the DomainSubscription pointer previously labeled Bonus is **FreeTrialEndAlert**:2495a10:2495bb8 lazily creates it through2496500, writes userId/subscriptionId through2898d44/2898e20, inserts it via typed271299c, and sets displayedAt through2898f00. It is notice dismissal, not claim proof. Operation28000 changes stamina and three inventory arrays, not native claim rows directly; their proper save/pull/update path still needs recovery.

Native skip refresh234b188/234c320/234c520 separately compares the client day and refills the **default** daily skip ticket to five before the bonus request, then records lastResetAt. This is not proof of a paid-assist award and must not be added twice. SubscriptionItem.slot5 variants and subscription.slot3 meanings remain unknown.

## Deferred acceptance

New `tools/test_subscription_bonus.cjs`, subscription details/billing fixtures and updated master/offline billing fixtures are **NOT RUN**. Details/billing checks retain their original provenance, exact shape, no read/activation precredit, local receipt, clock, retries, restart and rollback coverage. Bonus fixtures cover two trial daily grants, no duplicate default refill/monthly trial award, hot singular operation/errorCode omission, exact/UI-context replay, actual-wire/action conflicts, once-only day and renewal identities, receipt-dated monthly stock, expired-period retention without daily SP, no profile precredit, flags-only rejection, split save/restart, safe save-reply suppression/cold cancellation, spending before ACK, settled old requests, consumed-stock rewind/deletion/missing floors, two same-item gift issue orders, missing local entitlements/legacy rows/metadata and issue/save/floor/observation/ACK/reply rollback. Fixtures use isolated local receipts and synthetic saves, not marketplace or native acceptance. Other producer combinations, actual draws/Prism exchanges, migration crash/corruption, calendar/cap/batch boundaries and native effects still require the final batch.

Native WebView rendering/scroll/close/back, loaded metadata/version correspondence, natural requests, UI labels and no crash/ANR remain pending in the consolidated batch. Syntax checks and metadata export are not gameplay acceptance. See `docs/packet-test-plan.md`.
