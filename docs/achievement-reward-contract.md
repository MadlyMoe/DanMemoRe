# Mission reward delivery checkpoints

## Pending hot retry projection — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-14)

An exact `achievement/complete` retry no longer has to return a communication
error merely because part of its signed operation6000 was already saved. The
permanent request identity still resolves the immutable queued operation. The
delivery layer validates that original, derives the existing bounded cold
recovery envelope, and substitutes only that wire envelope into the hot plural
and singular operation fields. Popup roots remain the original reward summary.

Saved claim flags, PC/board/character/wardrobe/entry effects, Memorias, items,
SP, casino medals and Alliance Medals are removed independently; supported
unsaved effects remain. Iris and Lotto entitlements keep their existing
server-side semantics. A cached derived envelope must exactly equal the current
derivation or the immutable original. The queue, token, signature, request,
profile, wallet and ACK state are not rewritten, and the original token remains
mandatory. Unsupported, partial-without-proof, changed, stale, missing or
rewound effects still refuse.

Deferred condition602 cases now exercise flag-first and SP-first exact hot
retries after restart, followed by cold parity and the real ACK. The transport
fixture also covers a mixed Iris/Valis reward after flags save, two existing
identities, a new semantic identity, cached-derived replay, detached
singular/plural refusal, final ACK and settled replay. Other mixed subsets and
native popup/application order remain unfinished; NONE RUN. Native UI,
performance and stability remain unverified.

## Pending daily-reset handoffs — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-14)

A pending operation6000 may have its exact category-1 claim flag saved and
recorded before its remaining SP or other effects and ACK. If the native daily
reset then replaces that state-4 row, the prior strict check rejected the reset
and could strand an otherwise recoverable signed operation.

Two earlier committed states can authorize crossing that reset. The first is
the exact old `claim:<achievementId>` state-4 observation. The inverse native
interruption is also safe when every non-claim effect is already durable: all
required PC/board/character/wardrobe/entry/Memoria/item observations plus the
private SP, casino, and Alliance Medal receipts. Iris and Lotto entitlements
are already server-side at issue. Candidate reward and replacement rows in one
push cannot authorize themselves; the proof must predate that push.

Without either proof, reset state 2 or a later completion remains invalid and
the original operation/profile are retained. With it, the same owner,
category-1, monotonic `lastResetAt`, and generation rules used by settled
transport allow the replacement row. Cold recovery omits already-saved
effects and the obsolete old flag, and the real original token may acknowledge.
A later state-3 generation remains independently claimable; it is not consumed
or credited by the older operation. No reward, replacement row, ACK, or queue
entry is prewritten.

The deferred condition602 fixture now covers reset-state and later-state
replacement in both flag-first and SP-first orders, rejection before durable
proof, rejection of an atomic SP-plus-replacement attempt, restart/cold
remainder, real old ACK against the replacement row, and a subsequent genuine
later claim. NONE RUN. Other mixed-effect inverse orders, native dirty-table
ordering, natural reset/evening eligibility, UI, performance and crash/freeze
acceptance remain unverified.

## Settled daily-generation transport replay — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-14)

Category-1 `UserAchievement` rows are reused by the native daily reset. The
permanent operation6000 request receipt previously required the acknowledged
generation's exact state-4 row forever. A legitimate reset-state row or later
completion therefore made an exact old request retry return a communication
error even though its signed operation was already done.

Settled request validation now accepts only two source-shaped replacements:
state 2 for the same completion generation, or state 2/3/4 with a strictly
newer `completedAt`. The owner must remain local and `lastResetAt` cannot move
behind the captured generation. This settled transport path applies only to
category 1 after the original operation is in `operation_done`; the separate
pending handoff above requires prior durable state-4 proof or completion of
every non-claim effect. An accepted
old retry returns its original popup roots with `operations:[]`, without
rewriting the profile, queue, receipt, wallet, SP, sequence, or newer claim.

`test_achievement_time_bonus.cjs` now has deferred cases for reset state 2,
later completion and award, cache loss/restart, event-clock rewind, read-only
old/new settled retries, and rejection of same-generation state 3, foreign
owner, invalid state, reset rewind and older completion. NONE RUN. Natural
evening eligibility, the client's reset/save order, native retry presentation,
performance and crash/freeze acceptance remain unverified; no build, listener,
APK, emulator, ADB, worker or Action was used.

## Partial ordinary-item refusal — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-14)

Operation6000 applies each positive `receivedItems` amount additively. A valid
native row whose cumulative counter lies between the immutable captured
baseline and target therefore cannot be treated as an untouched reward: doing
so would replay the full amount. Uncapped mission recovery now derives the
baseline as target minus the original operation quantity. Only an absent zero
baseline or one exact valid baseline row remains eligible for redelivery; a row
at or above the target is saved, and every between-state refuses with the
signed operation and inventory retained. Hot imports fail atomically and cold
login/pull/confirm use the existing unavailable recovery response. Claim flags,
PCs, Memorias, scalar rewards, capped/date/Valis paths and the full real ACK are
unchanged; no remainder or reward is invented.

`test_achievement_items.cjs` now includes ten WRITTEN ONLY authentic
first-per-table mission rewards whose original quantities exceed one. Each
starts from an absent row, captures the original operation, imports one unit,
restarts, and requires both confirmation and login to refuse without changing
the queue. Existing 17-family full item-first/flag-first and mixed captured
cases remain. NONE RUN. Native constructor/signature/save timing, UI,
performance, crash/freeze acceptance and legacy partial reconciliation remain
unverified; no build, listener, APK, emulator, ADB, worker or Action was used.

## Archived reward-type coverage — source inventory, not acceptance

The final archived achievement table has 42,429 rows. `achievement/complete`
now maps every authored reward type, including the 14 category-9 type-35
missions in the 2022 Union window. Those rows all award original item
`union_medal_item.1` / `410000001` in quantities 1, 10, 15 or 25 through the
native type-6000 `issueUnionRaidMedal` field. They are not converted into
ordinary items or precredited by the server.

SOURCE ONLY / PARTIAL / UNTESTED: fresh type-35 claims capture the exact
achievement tuples, original quantity, operation identity, and complete native
`UserUnionRaidMedal` before/after row in the existing medal custody ledger. The
client may save the mission flag or medal first; cold delivery removes only the
effect actually observed, and ACK requires both. A second award waits for the
earlier award's real save and ACK, while later skill spending remains chained to
the acknowledged reward checkpoint. The deferred fixture covers the exact
14-row catalog, both save orders, restart, ACK and rewind refusal; it has not
been run. Natural peer-derived eligibility for these Union missions remains in
the co-op-last phase. Native callback/save acceptance and the rest of the route
still require the consolidated verification pass.

## First/owned ordinary ticket follow-up — SOURCE ONLY / PARTIAL / UNTESTED

[Mission ticket rewards](mission-ticket-reward-contract.md) now capture first
and owned below-cap rewards across the18 original mission ticket classes, using
the original constructor/nonce/full quantity and shared cold recovery. No native
profile precredit or new DDL. Completed reads reuse indexed original-catalog
checkpoints; pending same-item producers require actual ACK.252 new item and384
new mixed scalar contexts are WRITTEN ONLY / NONE RUN. Named dated item cases
now383; scalar cases1264/refills632. This supersedes only earlier missing first/
ordinary-ticket recovery and880/440 scalar totals; other source limits remain.

## Source-bound shop Memoria recovery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

achievementColdRecovery now also admits the original empty-claim6000 used by
Memoria shop purchases. achievementPcReceipt still requires the exact original
product/price/quantity, child6000 and parent9000 receipts, first/preowned card
target, nonce/verifier/source queues and original zero scalar fields. This does
not admit arbitrary unbound empty rewards or create a card on the server.
Untouched cards retain original memoriaId/level1; actually owned observed or
preowned cards are omitted after validating captured minimum EXP and retained
growth. Actual save/ACK and card floor requirements remain; either real parent
or child ACK may close first without losing the other original binding.

90 new deferred shop cases and the existing all30 Memoria shop cases are
WRITTEN ONLY / NONE RUN. Cold login/pull/confirm use the shared helper; original
queues/captures/tokens/signatures/cost/purchase limits remain unchanged. See
shop-reward-contract.md for count/date-only9000 recovery and remaining mixed
shop branches. No schema/new native patch/precredit/fake ACK. Casino0 still
requires the earlier unbuilt/uninstalled ARM64 adapter. Actual saves/listener
untouched; not native acceptance or a crash/stability fix.

## Mission unit and Memoria cold recovery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Original6000's receivedPCs iterator23621c0..2362568 exits at2362220 to the
independent receivedMemorias iterator236256c.22eba54(force0) looks up each PC;
nonnull2362258 skips first construction, otherwise2362278 calls22ebbbc. Memoria
field parsing23625e4..236260c reads original memoriaId/level;236264c..2362650
preserves an already sufficient card, while absent2362698 calls24f99d4. Empty
Memoria iteration exits23625d4 to independent casino processing23626e0. Read-only
original ELF evidence is retained in .work/achievement-character-cold-original-
20261010.txt; all3 original mission PCs have no original temporary-guest mapping.

achievementColdRecovery now allows original reward types29/30 alongside supported
SP/Iris, captured numeric/dated items and captured casino. It reuses the original
achievement_pc_delivery first/preowned PC/card targets and existing observation
helpers: a first PC may be omitted only after PC, owned job set, character state,
default outfit/linked voices and unit-story observations required by its actual
capture are complete. An entirely untouched first PC remains its original wire
integer. Any incomplete constructor refuses without synthesizing missing pieces.
Preowned units retain their actual growth/boards and need no repeated constructor.
First Memorias are omitted only after their actual owned row/minimum is observed;
preowned cards are validated against captured EXP and omitted without downgrade.
Later legitimate unit/card growth is preserved. Independent claim flags and
item/SP/casino proof remain; original source queues, claim tuples, quantities,
tokens/signatures, once-credited Iris and full actual original ACK are unchanged.

Shared cold login/pull/confirm and10200/28000 prefix planning use the same helper;
hot additive retries still refuse and save replies withhold pending callbacks.
No new DDL, capture backfill, reward credit, native initialization, client patch
or fake ACK. Unrecovered shop mixtures, uncaptured ordinary rewards, partial
unit constructors, separate costumes/raid mixtures and other unfinished branches
remain outside this recovery path. Casino0 remains dependent on the earlier
SOURCE ONLY ARM64 adapter, NOT built/installed; no native stability claim.

57 NEW WRITTEN ONLY test_achievement_character_recovery.cjs contexts:27 mixed
all3 unit IDs/first-preowned-observed PC/card/rotating flag-numeric-SP states with
27 original10-Iris10200 refills,6 unit-only/boards-only partial refusals and every
30 original Memoria mission flags-first/card/later EXP-signature recovery. Updated
EXISTING test_achievement_units.cjs asserts flags-first and fully observed cold
recovery, preowned mixed currency preservation, while boards-first still refuses.
No extra contexts are counted for those updates. Source/profile/wallet/queue,
exact cached bytes/restart, corrupt captures, missing-effect ACK, rollback and
actual original save/ACK remain deferred. Synthetic eligibility/rows/signatures/
funding/save order are not native gameplay proof. NONE RUN. Earlier1332 named
contexts/656 refills remain separate (1389/683 across the three recovery files).
Earlier DDL UNAPPLIED, actual saves/listener untouched; counts124 partial/51
unsupported unchanged. No tests/checks/generators/build/APK/install/restart/
emulator/ADB/workers/Actions; all149 and variants before acceptance, co-op last.

## Captured casino before-state — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Fresh isolated6000 casino missions now capture the actual owned medal stock,
lifetime total and UInt32 signature in the existing casino_reward_claim ledger.
SOURCE ONLY DDL adds nullable before_stock and cap_version default0; existing
rows remain uncaptured, with no guessed backfill. Fresh captures use version1,
bind the original queued quantity/token/signature/parameters, exclude the native
before-signature when issuing the nonce, and clamp both counters at the original
99999999999. Thus a fully capped lifetime counter is not itself acquisition proof:
the issued signature must actually be saved. No native balance is precredited.

casinoRewardEffects validates retained before-state, monotonic cumulative amount,
remaining stock additions and observation metadata. Spending during an incomplete
gain does not renew its addition allowance. Actual native saves compare-and-swap
the JSON observation in the same transaction as profile/claim observations/ACK/
queue/cache; failure rolls everything back. Missing version1 captures, malformed
state or native acquisition with lost observation refuse, rather than synthesizing
proof. Once observed, later legitimate casino spending/gains/signatures remain;
cold recovery does not replay the medals or impose their old stock as a floor.

Untouched captured medals can retain their original positive quantity even when
other mission flags/items/SP are already saved. Incomplete casino stock/cumulative/
signature effects refuse both hot and cold redelivery until a complete actual
save, with no guessed remainder. Legacy or overlapping unobserved casino producers
retain the existing uncaptured reservation behavior. Coalesced gains before the
first observation and mixed units/Memorias/costumes/raid recovery remain unfinished.
Observed casino0 still requires the earlier SOURCE ONLY ARM64 adapter, NOT built
or installed; this is not native gameplay acceptance or an emulator crash fix.

164 NEW WRITTEN ONLY deferred contexts:144 pending-casino mixed cases extend the
earlier288 to432, plus12 fully capped lifetime/stock/claim contexts,6 partial-field
contexts and2 spending-allowance/lost-observation contexts. Existing pure/overlap
cases now retain capture versions and latest observations on fixture restoration.
The432 mixed contexts include216 original10-Iris10200 refills; earlier880 mission
contexts/440 refills remain separate (1332 named contexts/656 following refills).
All assertions, cap/nonce-wrap guards, cache/restart/rollback/ACK and missing or
corrupt capture checks are WRITTEN ONLY, NONE RUN. Synthetic rows/save order are
not proof of native earning or play. Source DDL UNAPPLIED; actual saves/listener
untouched. Counts124 partial/51 unsupported unchanged; all149 and variants remain
the objective, co-op last. No tests/checks/generators/build/APK/install/restart/
emulator/ADB/workers/Actions. This entry supersedes only fresh isolated captured
casino issuance/recovery limits in earlier entries, not their legacy limits.

## Observed casino-medal cold recovery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Original6000 unconditionally calls23ff788 at236271c with int64 X1 quantity and
W2 signature. That method updates medalAmount and the signature even for0;
only its cumulative increase is gated positive. A zero-medal derived reply is
therefore NOT safe with the old client. `offline_client.py` now contains a
guarded ARM64-only source adapter: redirect236271c to zero padding153f07c,
CBZ X1 to RET for0, otherwise tail-call unchanged23ff788. Original positive/
negative math, caps, signature/error handling and caller arguments/link remain.
Exact original call/padding byte guards apply; ARMv7 unchanged. Adapter is
SOURCE ONLY, NOT built/installed; reference/unwind/native acceptance deferred.

`achievementColdRecovery` now handles original casino quantities alongside
scalar and captured numeric/dated rewards only after the existing casino
receipt/owned cumulative/mission observation guards prove medals observed.
Derived issueCasinoMedal becomes0 without replaying or rewinding a later spent
casino balance/signature. Other item/SP/claim components retain their own
complete actual save/ACK proof. Original queues, quantities, claim tuples,
signatures, tokens and once-credited Iris are unchanged. Cold canonical order/
cache identity and shared10200/28000 planning remain; hot partial retries refuse
and save replies withhold. No synthetic ACK, new schema or balance repair.

Unobserved casino rewards have no exact before-stock capture. An untouched
handoff retains its original reply, but any other observed component still
refuses partial redelivery until acknowledgement/captured native reconciliation.
Neither a claim flag nor saved SP is treated as proof of casino gain. This
does not recover partially applied medals, saturated cumulative issuance or
ambiguous/coalesced casino producer history.

288 NEW WRITTEN ONLY `test_casino_rewards.cjs` contexts cover both original
casino missions100/1000 with their separate2018 windows, original ticket1/
Hero2/SP50/Iris10, three five-row flag subsets/all4 item subsets, three SP
states, saved/spent casino and two balance/cap baselines.144 add original
10-Iris10200. Profile/source/wallet/queue/observations retained, altered/missing
casino receipt refusal, early ACK, later casino signature/balance preservation,
original/derived cache bytes/restart/stale projection, rollback and real save/ACK
closure are deferred. Older pure casino cases now cover pending refusal and
observed/spent cold projection. Native patch assertions were written but NOT
run. Earlier880 mission contexts remain separate (1168 named contexts/584
following refills across the two files). Synthetic earning/funding/rows/
signatures/spending/caps/save order are not native gameplay proof. NONE RUN.

Uncaptured rewards, units/Memorias/costumes/raid mixtures, unobserved casino
partial saves, legacy/coalesced/ambiguous history, partial XP, regeneration,
constructors/signing/timing and UI/performance/stability remain unfinished.
Earlier DDL UNAPPLIED, actual saves/listener untouched, no APK produced;
counts124 partial/51 unsupported unchanged/no feature-complete or crash-fix claim.

## Captured dated-ticket cold recovery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

This extends captured numeric recovery to original `UserGachaTicket` items
with complete cap_version1 dated captures. Exactly one stock/date capture
must exist per item. Original2576654 retains the incoming signature in w19,
updates its date vector at257667c..25766bc, then forwards the nonzero signature
at25766c0..25766d8 to2638798. Combined with6000's independent item iterator,
fully observed dated rows can be omitted without repeating their gain.

The existing dated multiset, addition allowance, original before-state,
signature/cumulative and native six-field-row guards remain. Actual complete
observation is required; partial append/cumulative/signature gains refuse.
Expiry pruning alone is not acquisition: an otherwise untouched pending item
keeps its original positive amount, and removed dates are never reconstructed.
Pending lottery-consumption interlocks remain; this does not authorize a draw
using a retained capped ticket. Source queue/quantities/claims/signature/token,
scalar SP/Iris handling, canonical order/cache identity and full actual original
ACK proof are unchanged. Hot partial retries refuse and save replies withhold.

384 NEW WRITTEN ONLY dated mixed cases reuse the existing shared fixture:
original ticket296000003 quantity1 (mission6020000100, duration2592000), Hero2,
SP50 and Iris10; all16 flag/all4 item subsets, three SP states, two baselines,
cap crossing/saturation, expired-before dates and empty-after-observation
vectors.192 add original10-Iris10200. With112 scalar and384 earlier numeric
cases, this file now contains880 contexts and440 following refills. No new
mission, quantity, timestamp field or reset policy was fabricated. Synthetic
expiry/consumption saves are not proof that a pending lottery draw succeeds.
Partial date/cumulative/signature refusal, lost/corrupt captures, no renewal,
cache bytes/restart/stale projection, rollback and real save/ACK closure remain
deferred. Existing every-original18-ticket and dated/numeric/Iris cases now
distinguish recoverable full observations/flags-only/expiry-only states from
incomplete gains; no extra contexts are counted for those updates. NONE RUN.

Uncaptured rewards, units/Memorias/costumes/casino/raid mixtures, ambiguous or
coalesced history, partial XP, regeneration, constructors/signing/timing and
UI/performance/stability remain unfinished/unverified. No new schema/patch;
earlier DDL UNAPPLIED, real saves/listener untouched, counts124 partial/51
unsupported unchanged. No feature-complete or native crash-fix claim.

## Captured numeric mission cold recovery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

This extends the scalar milestone below only to original ordinary rewards with
complete `cap_version=1` numeric stock captures, including guarded Valis v2.
Original6000's item loop exits at2362044 for empty receivedItems and proceeds
to the independent receivedPCs field23621c0. Positive items invoke gain slot50
at2362170 with original quantity w25 and whole-operation signature w20. Derived
cold replies therefore omit fully observed item rows, never replace quantities
with0 or recalculate a partial remainder. Unobserved captured items must remain
strictly untouched; any incomplete stock/cumulative/signature effect refuses.

`achievementColdRecovery` replaces the scalar helper across delivery, shared
SP-prefix allocation, exact original/derived confirmation and store exports.
It binds every received item and aggregated quantity to original mission data,
then reuses existing stock/allowance/signature/cumulative/spending/Valis-floor
guards. Observed items remain omitted after legitimate spending; no stock,
Iris, SP, spending ceiling, source receipt or claim is regenerated. Original
flags, captured SP order, cache/full-queue/token identity and actual complete
native ACK requirements remain. Hot partial retries still refuse, save replies
withhold6000 and original private queues remain until real acknowledgement.

384 NEW WRITTEN ONLY mixed contexts join112 scalar contexts in
`test_achievement_scalar_recovery.cjs`: original CP3/Hero2/SP50/Iris10, all16
flag subsets, all4 item-observation subsets, pending/saved/spent SP, two SP
baselines and item cap crossing/saturation.192 mixed contexts add a following
original10-Iris10200 (248 following refills total). Cover no duplicate credit
or renewal of spent stock/SP, original/derived bytes, cache/restart/stale reply,
partial-stock/cumulative/signature refusal, corrupt/missing captures, rollback
and ordered actual save/ACK closure. Older numeric-item cases now distinguish
recoverable flags-first/fully observed states from incomplete effects; existing
Valis cases add cold/restart/cache preservation of actual spending credit.
All are written only, NONE RUN. Synthetic eligibility/funding/rows/signatures/
cap/spending/save order do not prove native earning or callback application.

Uncaptured or dated items, units, Memorias, costumes, casino/raid mixtures,
legacy/coalesced/ambiguous history, partial XP, regeneration and native
constructors/UI/clock/performance/stability remain unfinished/unverified.
No new schema/patch, earlier DDL UNAPPLIED, real saves/listener untouched;
counts124 partial/51 unsupported unchanged and no route feature-complete.

## Scalar mission cold recovery — SOURCE ONLY / PARTIAL / UNTESTED (2026-10-10)

Original6000 parses `issueAmount` without locally adding Iris, and calls the
SP adder only for positive `issueStamina` (2361df0..2361e34). Its independent
claim receiver2358d80 changes state3 to4. Recovery now filters actually observed
claim rows and sets only already-observed SP to0 in a derived cold reply.
Original queued parameters, quantities, claim tuples, signatures and tokens
remain unchanged; Iris stays credited once by the existing claim transaction.
This is limited to original SP/Iris-only missions with empty received arrays
and zero casino/raid rewards. Other mixtures retain their partial-save refusal.

Unobserved SP requires the owned baseline and exact captured earlier XP/SP
chain. Observed/spent SP is neither replayed nor made a historical floor.
Login/pull/confirm validate the canonical original outgoing queue before
deriving a reply; cached replies require current tokens and exact full-queue
identity. Hot partial retries refuse, and save replies withhold partial6000.
Only actual original flag/SP save proof can acknowledge the operation.
Stored invalid claim state becomes unavailable503 on this recovery path;
submitted-save validation retains400 and raw SQL failures are not reclassified.

`test_achievement_scalar_recovery.cjs` contains112 NEW WRITTEN ONLY contexts:
two SP baselines including cap crossing, five original SP/Iris combinations,
every claim-flag subset and pending/saved/spent SP.56 low-SP contexts include
a following original10-Iris10200. Restart/cache bytes, original/derived identity,
no duplicate credit or stamina renewal, corrupted captures/baselines, rollback,
early ACK and actual save/ACK closure are deferred. Original two50-SP time
bonuses and original10-Iris mission are retained; synthetic earning, funding,
rows, signatures and save ordering do not prove native gameplay. NONE RUN.

No new schema or native patch; earlier DDL UNAPPLIED and real saves/listener
untouched. Counts124 partial/51 unsupported unchanged, no route feature-complete.
Mixed rewards, ambiguous/coalesced history, partial XP, regeneration, saturated
issuance, constructors, UI/performance and stability remain unfinished/unverified.

## Personal Bond missions — SOURCE ONLY / UNTESTED (2026-10-10)

Original six-field UserLimitBreakItem rows now share6000 ordinary capped reward
captures/allowance/spending closure/actual full signature/capped lifetime effects/
full mixed ACK/atomic saves/completed guards. Deferred91 cases cover all13
original quantity1 missions times seven save orders; original reward IDs and
windows are retained. Numerical/mixed mission base206 plus nine extra Memoria
missions;131 dated cases remain separate. No original General Bond missions
exist in this catalog and none were invented. Native malformed fields/corrupt
captures/rollback/retry/restart/restoration scenarios are written only, NONE RUN.
Full-row lottery caps, consumption, coalesced/legacy callbacks and native
acceptance remain incomplete/unverified; personal-bond-item-contract.md.
No saves/listener changes; earlier DDL unapplied, counts125 partial/50 unsupported.

## Memoria EXP and alarm-voice items — SOURCE ONLY / UNTESTED (2026-10-10)

Original eight-field Memoria EXP and seven-field alarm-voice rows now share
ordinary capped6000 delivery and strict saved-inventory acknowledgement guards.
Memoria's expiry gate does not recognize its own original item type, so its
acquisition timestamp is retained rather than expired/refreshed by the event clock.
All ten authored Memoria missions and the original alarm-voice mission retain
their quantities/windows. Seven alarm mission cap orders extend the numeric/mixed
base batch to115, with nine additional Memoria mission cases and131 separate
dated-ticket cases. All are WRITTEN ONLY / NONE RUN; no saves/schema/listener changed.
See [Memoria EXP contract](memoria-exp-item-contract.md) and
[alarm-voice item contract](alarm-voice-item-contract.md). Newer source evidence
supersedes older missing-cap/expiry-path claims only, not enhancement/consumption,
legacy/coalesced saves or native acceptance gaps. Route counts remain125/50.

## Adventure Ticket inventory and caps — SOURCE ONLY / UNTESTED (2026-10-09)

Shared native validation now requires the actual seven-field Adventure Ticket
row, including lastResetAt rather than reservedAmount. Five original
non-replenishing IDs join existing capped2000/6000/9000 captures, allowance,
actual signature, mixed ACK, atomic save and completed-stock guards. Four
scheduled-reset IDs need the separate original140000 token/stock replacement
path, not ordinary capped reward semantics. Original107 mission entries retain
their actual quantities;28 new deferred mission cases cover all four authored
ticket reward IDs. No new schema, wire, original data rewrite or native precredit.
Full evidence,112 total WRITTEN ONLY cases and remaining reset/consumption gaps
are in [Adventure Ticket contract](adventure-ticket-contract.md). NONE RUN;
counts/saves/listener unchanged, earlier DDL UNAPPLIED, no acceptance claimed.

## Hero Ascension unlock inventory/caps — SOURCE ONLY / UNTESTED (2026-10-09)

Original UserHeroSublimateUnlockItem reader2633e00:2634238 consumes exactly
userId, heroSublimateUnlockItemId, amount, bookEntryState, reservedAmount,
signature and cumulativeAmount. Book setter2633634 uses protected
UInt8/28bda24/22e6718; signature26337f8 uses protected UInt32/28bac48/1e99d08.
Domain stock setter256bfa4 forwards the full incoming signature to26337f8,
skipping only zero. Vtable42c1400 binds common gain24d8844/max24d8d6c/
lifetime24d8d94. Original itemType200000034, recovered from itemType.enc,
has maximum999999999. The original item98000001 already has the correct
UserHeroSublimateUnlockItem/heroSublimateUnlockItemId mapping; no master changes.

The existing seven-field owner/native-width guard and shared twelve-class
numeric cap capture/effects/positive allowance/signature exclusion/real mixed
ACK/atomic save/completed stock checkpoint paths now include this class for
2000/6000/9000. No new wire, issuer, native inventory/signature/claim precredit,
schema, constructor or second stock ledger. Other producers remain partial.
Wrong Hero subtype IDs, missing reserved fields, dates/reset fields and invalid
book/signature widths are refused, not normalized into an invented native row.

Nineteen added cases are WRITTEN ONLY / NONE RUN: seven Present cap-save
orders, five original207001786 shop save orders and seven mission cap-save
orders using actual6020015760/quantity5. Original shop quantity1, price30
event290000233, limit10 and windows remain. The archive contains111 standalone
unlock offers, no linked bundles or final event-box prizes; none were fabricated.
Existing fixture constructors retain reservedAmount, and separate Ascension vs
unlock IDs are explicitly exercised. Signature/partial spending/allowance/full
ACK/rollback/cold-cache/completed restore/rewind cases reuse existing fixtures.

Other remaining classes/producers, absent constructors, coalesced/legacy and
native eligibility/signing/order/UI/clock/recovery/performance/stability remain
unfinished/unverified. Memoria EXP's original264a200 reader includes
lastAquiredAt and its24feb98 stock getter uses time checks; that separate path
has not been replaced by an ordinary reset-free numeric cap assumption.
Counts remain125 partial/50 unsupported. Earlier DDL SOURCE ONLY / UNAPPLIED,
saves/listener untouched, no tests/checks/generators/build/APK/install/restart/
emulator/ADB/workers/Actions. All packets/variants before testing; co-op last.

## Capped mission Valis spending credit — SOURCE ONLY / UNTESTED (2026-10-09)

This supersedes only the earlier mission-Valis cap refusal and five-source
spending-floor limitation, not complete6000 gameplay or any native acceptance.
Original6000 forwards the authored item quantity/full signature through
2362154:2362170; Valis retains stock maximum2000000000 and lifetime999999999.
Fresh captures bind actual owned stock/cumulative/UInt32 signature, unchanged
original quantity and clamped targets to offline-achievement-stock-cap-v2.
The existing numeric Present/shop validator and full mixed reward/flag ACK remain.
No native inventory, signature, claim flag, token or extra wallet was precredited.

When an earlier Familia charge established a spending ceiling, positive stock
gain minus lifetime gain is captured under offline-achievement-valis-floor-v1,
hash-bound to the stock capture. Only real issued signature plus capped lifetime
observation applies that credit once. Spending before the first save does not
erase the original reward; stock additions still consume original allowance,
and spending never refunds it. Full-stock/no-charge/exact-saturation callbacks
mint no spending credit. Pending22000/22100 must settle before gain capture.

Private achievement_item_claim gains nullable valis_state/default0 valis_seen
and two partial indexes. Compare-prior observation/credit/floor updates share
the profile/token/receipt/queue/done/exact-reply transaction. Original claim
identities and summed original Valis quantities bind both pending receipts and
the permanent floor source after ACK. Missing/corrupt captures, claims, queued
signature/parameters or lost credit floor require reconciliation; a lost new
floor is not rebuilt from older donation history. Later real charges remain
protected against restoring previously spent Valis.

The existing floor adds source_kind achievement, not another inventory ledger.
Exactly known old two/three/four/five-source schemas retain all rows in a v4
backup; existing v1/v2/v3 backups are preserved. Unknown/custom/referenced or
colliding schemas are refused. All new DDL/migration is SOURCE ONLY / UNAPPLIED;
no real save was opened or migrated.

Sixteen new test_familia_valis.cjs scenarios are WRITTEN ONLY / NONE RUN:
original mission6010000010/20000 Valis, three cap variants times four save orders
and four no-credit cases. The three combined cases include original CP/Hero/
dated-ticket/Iris missions and require every item/claim before full ACK. Cover
source/hash corruption, issue/partial/ACK/floor rollback, first-save spending,
cold/cache suppression, once-only Iris/exact ACK replay, permanent source/claim/
floor loss and later donations. The twelve deferred schema modes add original
five-source/v3-backup preservation and retain old corruption/custom/refusal cases.
Generic mission fixtures no longer classify a valid saturated Valis baseline
as malformed. Synthetic funding/earned flags/orders are not native earning,
eligibility or signing proof.

Counts remain125 partial/50 unsupported. Other cap producers/classes, absent
constructors, coalesced and legacy reconciliation, natural eligibility/reset,
native signing/save order/UI/clock/recovery/performance/stability remain
unfinished/unverified. No tests/checks/generators/build/APK/install/restart/
emulator/ADB/workers/Actions ran; saves/listener unchanged. All original packets
and variants before consolidated testing, co-op last.

## Current capped6000 delivery — SOURCE ONLY / UNTESTED (2026-10-09)

This milestone supersedes earlier cap refusals only for the nine authored
numeric mission classes and original dated gacha tickets below. It is not
complete mission gameplay or native acceptance. Historical executed checks
later in this document do not verify these changes. No tests, static acceptance
checks, generators, builds, packaging, installation, listener restart, emulator,
ADB, workers or GitHub Actions were used. Actual saves remain untouched; new
private receipt columns are SOURCE ONLY / UNAPPLIED.

Fresh read-only original ARM64 evidence:6000 at2361de4 retains incoming w3 in
w20. Positive item quantities reach2362154:2362170, resolve the original item,
call ordinary gain slot50 with original quantity w25 and the same full signature
w20. Dated setter2576654 retains w2 in w19, appends/prunes its original vector
at257667c:25766bc, then forwards nonzero signature to2638798 at25766c0:25766d8.
Expiration pruning alone is not reward application. The existing six-field
UserGachaTicket contract retains signed book byte, UInt32 signature and exact
dateList entries containing aquiredAt; no numeric amount/guessed expiry field.

### Nine numeric mission classes

UserStatusBoardItem, UserCpItem, UserExpItem, UserEquipmentMaterial,
UserStaminaTicket, UserKeyItem, UserEquipmentEnhanceItem,
UserEquipmentEvolveItem and UserHeroSublimateItem use the existing common
maximum999999999 and actual owned stock/signature capture. Private
achievement_item_claim gains cap_version/default0 and nullable stock_state;
these preserve existing rows, not reconstruct missing legacy captures.
Immutable queued receivedItems supplies the original quantity, so no duplicated
SQL amount or native inventory ledger was added.

Original signed addition bounds, exact capture fields/policy, full old-signature
exclusion, strict owner/inventory fields, and same-item producer reservations
remain. Positive stock increases consume original allowance across partial
saves; spending never refunds allowance. Only actual issued signature plus
capped cumulative proves the item observed and closes unused allowance.
Already-saturated lifetime alone cannot ACK. Partial effects suppress additive
redelivery without fabricating an observed item or discarding the real queue.
Claim flags, PCs/Memorias, SP/casino, Iris and other mixed rewards retain their
existing full-ACK conditions.

The66 numeric/mixed cases in test_achievement_items.cjs are WRITTEN ONLY / NONE
RUN: nine original classes times seven save orders, plus three original
CP/Hero/Iris mixed orders. Cover exact/crossing/saturated counters, empty/full
stock, full-width/collision-wrap signatures, corrupt/legacy captures, partial
spending/allowance closure, issue/save/ACK rollback, hot/cold/cache suppression,
strict flags, exact ACK replay and completed restore/rewind/removal refusal.
Synthetic eligibility/save orders are not natural mission earning or native
callback/signing/save proof.

### All18 authored dated mission ticket IDs

Fresh capped tickets additionally capture actual before cumulative/date
multiset/UInt32 signature in nullable gacha_state under
offline-achievement-gacha-cap-v1. Exactly one numeric or dated capture is
allowed; original quantities, mission identities/windows and wire are unchanged.
Missing owned constructors, pending same-item producers or queued1000/1001
ticket replacements cannot be silently attributed. The existing Present/shop
dated validator bounds positive additions by original quantity across saves;
expiry/pruning does not refund allowance. Real signature plus capped cumulative
can prove a first-save-expired reward even with no dates remaining. Expiry alone
keeps the operation unapplied and safely eligible for redelivery.

Compare-prior stock_state/gacha_state writes share the native profile/token/
observation/receipt/queue/done/exact-reply transaction. Existing indexed completed
mission receipts guard dated stock increases without another ledger. The common
lottery full-row issuer and ticket-draw guard now include pending/completed
mission receipts, in addition to Present/shop/event-box receipts. Old cap0/NULL
or missing/ambiguous captures require reconciliation, not guessed allowance or
fake success.

The131 new dated cases are WRITTEN ONLY / NONE RUN: all18 original mission
ticket IDs times seven save orders, three mixed dated/CP/Hero/Iris orders and
two consumer-first1000 refusal cases. Select actual largest authored quantities
per ID, including original five-character_3 ticket mission6030024772; preserve
original windows and all eighteen original2592000-second ticket durations.
Cases cover duplicate dates, signed book/UInt32 widths, append/flags/cumulative/
signature/combined/expired-first/prune-only saves, corrupted/downgraded/mixed
captures, both issue orders, all transaction rollback phases, cold/cache
cancellation, full mixed ACK, once-only Iris and exact ACK replay, spent/expired
restore refusal in save and shared issuer. Consumer-first cases prove only their
written refusal expectations, not native settlement acceptance.

Still unfinished/unverified: capped mission Valis spending credit, other capped
item classes/producers, absent constructors, coalesced attribution, missing
legacy history, natural eligibility/reset/signatures/save order, UI/clock/cold
recovery/performance/no-crash/no-freeze acceptance. Counts remain125 partial/
50 unsupported; no route or game system was promoted to complete. Implement all
original packets/variants before the consolidated test pass; co-op stays last.

The original source changes below were deferred. The executed2026-10-06
ordinary hot/cold claim follow-up at the end supersedes that status only for
its named cases and checks; character/card and broader mission acceptance
remain pending. No workers or GitHub Actions. Co-op stays last. This is not
complete6000 support or game-wide no-crash acceptance.

## Original login-time bonus expiry and native delivery (2026-10-07)

`achievement/complete` remains PARTIAL, with another real branch implemented
and exercised. On separate Adventure16 `eb8b83ee`, date2019-10-18, the
claimable noon bonus6010000001 reproduced1003: its2018 master `expireAt`
was incorrectly treated as permanent expiry. Read-only original ARM64
2358578:23586b4 returns active for condition602;2358dcc:2358ef0 returns
not-expired for that condition. Both read original master slot4 through
vtable offset0xc. Extraction now exports only the two condition602 IDs as
`achievementTimeBonuses`, separately from existing captures. Every previous
master field and all161 source hashes match the installed pre-change master.
Other Daily/event lifetime windows, owned state3/date matching, future-date,
reward/signature and save/ACK guards remain unchanged. No guessed timezone,
completion flag, native SQL write or outfit/currency grant was introduced.

The focused disposable check failed400 before the change and now passes both
original50-SP bonuses, actual native requestId0/sequence retry after cache
eviction/restart, no precredit, exact SP/flags/ACK, expired and not-yet-active
other Dailies, future/foreign/uncompleted rejection and issuance rollback.
`test_achievement_transport`, recovery and launcher checks also pass; the
native-patch static check passes separately. Full master validation still
fails at the already-missing `takarakujiItems` export; full stamina regression
still fails at line145 expecting400 but receiving guarded503. Both failures
reproduce on pre-change source/master; neither is relabeled a pass.

Local offline build/install and pulled-installed APK SHA256 match:
`b77bb817abe2d621b6c319a4f78530e79c9a1280f8fdc9fd66d188066bcec962`.
Packaged/installed/runtime server matches
`624efcdca775f426f6706ccf3fb7f35ba1febbbfef20109194671b94f80b0a4b`;
master matches`4ffa095477ec1fabb29774dd806992779d1b4855b9debcbba9a2fa0c35808f4f`.
All seven packaged/runtime modules and unchanged installed ARM64 split/native
hashes were checked. Natural noon claim21176 issued6000 ID19 and real
DailyMissionReceived21177 saved/ACKed it. Popup shows Stamina x50; SP59->109.
Cold title/town/mission navigation retains109 and the removed reward button.
Stopped read-only test-save copy verifies one bonus claim, observed SP
receipt59/109, state4, retained request identity0/21176, ACK19 and queue0.
Valis claim21167/ACK21168 on the preceding2448efad build also verifies its
actual-wire0/21167 identity and Valis31020->51020; cold current build retains
both receipts, player EXP721/rank3 and integrity ok.

Rookie5 remains0/1: the save has only Hestia's basic outfit. The original
CostumeChange21166 saves normally, but choosing the already-equipped outfit
does not satisfy an actual change. No costume or completion was injected.
The evening bonus, daily reset/clock changes, native interrupted callbacks,
all other mission branches/rewards and game-wide stability remain pending.
Final normal ToolsStop leaves no game PID/listener28766. Earlier first Stop
left the game PID and needed a scoped ADB force-stop; subsequent stops worked,
so lifecycle reliability is not certified. While scrolling the stopped
launcher's Saves list to restore next-launch metadata, Android reported a
launcher input-dispatch ANR, then a system gesture-monitor ANR and watchdog
graphics stalls. ADB shell stayed reachable but screenshots/UI dumps failed;
Windows MuMu showed Android Device Running Error32888. Its normal Restart
button left a stuck front end; only that exact MuMu front-end process was
closed, after which the manager reopened Android normally. No emulator disks,
saves, VM services, other apps or ADB server were reset. ADB UI dumps/screenshots
and Saves scrolling work again. The test database and WAL hashes still match
the post-claim cold copies; the transient SHM differs and is not claimed equal.
Adventure5 next-launch metadata is now restored to d8924112/date2022-08-20,
with native Home Offline/19 profiles, no game PID or listener28766. Its original
database has not been read/opened/launched. Recovery is not an ANR root-cause
fix or game-wide stability proof.
No workers or Actions; co-op stays last.

## Durable mission-claim request identity (2026-10-07)

Partial `achievement/complete` support now survives reply-cache eviction,
session reset and listener restart. A disposable regression first reproduced
an unapplied original request failing400 after its cached reply was removed.
The new indexed `achievement_request` binds the actual encrypted request
bytes and native request/sequence pair to the existing6000 reward receipt.
The shared original request validator still requires1..100 unique positive
achievement/completion-date pairs. No response schema, native reward handler,
signature, claim eligibility, profile owner or save/ACK guard changed.

An untouched pending retry reads the exact signed operation and its existing
hot envelope. Changed bytes, even with a copied body-hash header, and another
action using that identity reject without mutation. Semantic retries with a
new identity bind to the same original operation atomically; they never
credit Iris or reserve inventory again. Existing mixed-reward delivery guards
cancel3000999 after any observed partial save. Once settled, the retained
identity cancels rather than replaying rewards, even after cache, session
and operation-done history removal. Missing/corrupt identities or original
captures remain unavailable; legacy cached replies cannot supply an unknown
actual-wire identity. There is no guessed migration/backfill or fake success.

Identity insertion shares the existing claim, wallet, acquisition, queue,
sequence and reply transaction. The red-to-green
`node tools/test_achievement_transport.cjs` passes original Iris+Valis batch,
pending/partial/settled and semantic retries, restart/cache/session eviction,
actual-wire/header/action conflicts, missing/corrupt history and new/duplicate
issuance rollback. Full mission-item, Memoria, shop, recovery and launcher
checks also pass on server SHA256
`2448efad10f40d1a57e7795809d62b0f3fff4ecbb608aa2095d5e284080afec0`.
The native-patch static check passes separately.

The first broader mission-item rerun exited1 without a success report;
subsequent traced and regular runs reached their final success and exit0.
Intermittent Windows long-test failures remain unresolved; these passes are
not game-wide stability evidence. Native natural eligibility, request-ID
reuse across genuine sessions, effect/save/ACK/recovery UI and performance
still need acceptance beyond the bounded follow-up above. That follow-up
supersedes this revision's original not-built/not-installed status:2448efad
was first installed, followed by the condition602 build624efcdc. Actual native
cache eviction/interruption was not injected. No workers or Actions were used,
and co-op remains last.

## Naturally earned Rookie3 and4 (2026-10-07)

Isolated Adventure16 `eb8b83ee` cleared Bell1-4 naturally, satisfying
Rookie3 `6050000003` at3/3. Hot achievement/complete21022 issued6000 ID12;
actual DailyMissionReceived21023 ACKed it and rendered10000 Valis.
Valis20138->30138 (cumulative42138), Iris17 unchanged. A real Miach town
conversation then satisfied Rookie4; claim21026 issued6000 ID14 and
DailyMissionReceived21027 ACKed it. The popup was **Agi.Falna(S)x10**,
not Skill Falna. Next mission: change Hestia's outfit, Rookie4-of36.

Cold town on the latest CP handoff build retained those displayed totals and
progress. Latest APK/runtime hashes are recorded in
`friendship-reward-contract.md`. This adds two bounded ordinary6000 cases,
not all36 missions, event/reset behavior or game-wide stability. No injected
funding, rewards, completion flags or original player-database access.

## Client evidence

### Memoria checkpoint follow-up (2026-10-07)

Executed `test_memoria_rewards.cjs` and `test_achievement_items.cjs` now
supersede the deferred notes below only for their disposable-save cases.
Shared save/real6000 ACK advances existing Memoria checkpoints to actual
accepted EXP; later saves retain both actual prior EXP and checkpoint.
Missing/regressed checkpointed stored cards cancel without erasure. The
existing indexed floor commits with profile/queue/done/reply, with no schema,
native grants, changed owner/signature/token or legacy-floor backfill.
Stale EXP is red-to-green, including zero/local owners, actual higher ACK EXP,
older checkpoint beside newer row, cold corruption, deletion and rollback.
All30 mission cards/10 EXP-item rewards and34 shop metadata/30 active card
products pass synthetic fixtures. Actual native card earning, upgrade costs,
signing and mixed reward/save order remain unverified. See
[the shop follow-up](shop-reward-contract.md) for the eight current checks,
installed build and bounded ordinary9000 native proof.

Original15.1.0 ARM64 `libapp.so` SHA-256:
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
The current turn rechecked this hash and ELF unwind bounds and read the whole
existing `.work/achievement-operation-exact-20261006.txt`, raw
`2361db4:23631b0`. Ghidra addresses include an additional0x100000 bias.

6000 applies SP, costume/voice and ordinary item vtable0x50 awards, then PCs,
Memoria, casino and optional union-raid medals before final received flags.
The PC absent-only acquisition branch and original owned lazy boards remain
as documented in `achievement-character-contract.md`. The Memoria branch
reads `memoriaId` and `level`, initializes an absent card and only raises a
preowned card below the requested EXP. The source still issues original
level1/EXP0 for the30 authored card rewards; unchanged preowned cards are not
converted to items. Existing10 original Memoria EXP-item rewards are ordinary
acquisitions. Native claim receive is2358d80; category3 deletion is strictly
`expireAt + 2592000 < currentTime`.

## Source implementation

### Native Memoria owner follow-up

Current bounded original ASM identifies a real previously rejected local
initialization path. `24facec:24fad34` and `24fad34:24fad78` allocate the row
through `2896604:2896710`: long userId0, int32 memoriaId0/totalExp0 and
signature0. Absent acquisition `24f99d4:24f9e60` sets the original ID through
28967ec, operation signature through2896a0c, inserts through270ed4c and applies
level EXP. Neither the acquisition nor `270ed4c:270ef78` sets userId.
`280f0e0:280f358` parses userId as long, ID/EXP as int32 and signature as uint32;
the resolved pooled strings are the actual four field names. Table import
`27fd388..27fd548` lies inside FDE27f0fec:28025ec and keys its protected int32
memoriaId, not userId or an inferred generic id. All inspection was read-only.

Shared card read/save/reward/ACK validation now accepts native owner0 as well
as the local account ID, while preserving actual owner/EXP/signature values
and profile tokens. Existing rows cannot switch either local owner value in
a client save. Known original IDs, exact per-ID uniqueness and EXP range
0..99999999 remain required. Foreign or malformed stored cards cancel3000999
without erasure; malformed new saves reject atomically. Native key selection
is explicit, so a generic id or duplicate incoming rows cannot replace a card.
This reuses existing reward captures, minima, observations and real ACK floors;
no new schema, profile precredit, signature generation or owner normalization.

The deferred `test_memoria_rewards.cjs` now uses actual zero-owner new-card
shapes and retained zero/local preowned cards for original30 mission and30
active shop rewards. It retains four inactive original shop windows and queues
both save orders/ACK orders, an unchanged preowned-card ACK before9000 saves,
owner/signature/token preservation, duplicate/wrong-key/foreign/changed owner
rejection, bad legacy login/confirm/pull, split/restart/rollback/floor checks.
Corrected the earlier synthetic shop assertion: an unchanged preowned6000
card may legitimately ACK before the separately required9000 purchase count.
Checks remain NOT RUN. Native serializer/save ordering, complete upgrade/cost
rules, signed callbacks and visual acceptance remain unverified.

The existing `achievement_pc_delivery` table and helper/API names are retained
for compatibility. Fresh genuine mission6000 operations now capture their
exact operation/parameters/token/signature even without PCs. An empty PC
target array is known-empty, not an uninitialized unit. Existing item targets,
claim/date bindings and SP/casino receipts provide their ordinary/received/
special-effect proof. Paired shop6000 with no mission rows remains separate
and must have its retained shop binding; it is not declared a mission.

Additive nullable `memoria_targets` captures each distinct original card's
actual absent/preowned status, nullable before EXP and minimum. It is checked
against the exact original card rewards and existing pending reward minima.
Unknown legacy card baselines stay unavailable; actual empty wire card arrays
can establish an empty target for an older PC capture without guessing saved
state. Old PC-free operations lacking the original delivery capture remain
queued for reconciliation. No snapshot is minted from today's post-award
inventory, and no native profile, flag or signature is prewritten.

All mission paths now observe separately received claims, ordinary cumulative
targets, initialized new PCs/boards, initialized new cards and existing SP/
casino effects. New-card EXP0 is an effect; unchanged preowned EXP0 is not.
Preowned EXP cannot regress while pending. Saved item/card and observed flag
halves cannot rewind or disappear. Item/SP/casino spending remains governed
by the existing acquisition/saved-effect receipts.

A legacy casino receipt without retained before-stock now counts as saved only
when its lifetime target is exact and the native row still carries the queued
operation6000 signature. A foreign signature at that same counter refuses cold
recovery and final ACK instead of replaying or silently omitting the medals.
An earlier mission receipt can also use a later exact signed operation as an
ordered witness only through a strictly increasing contiguous all-v0 pending
prefix. Gaps, saturation and mixed partial captures refuse. Later casino-reward
reservations use the same captured/direct/ordered proof. No medal, signature,
claim flag, operation or ACK is prewritten.

Partial push replies omit only6000 delivery; they do not settle the operation
or replace its complete mixed flag/unit/board/item/card/SP/casino proof. Hot,
cached, login, confirm and pull callbacks cancel3000999 until ACK/reconciliation.
Queue and history stay intact on unavailable/corrupt/changed captures. This
does not prove that the client recovery screen is usable.

Actual ACKs atomically record a per-card primary-key
`achievement_memoria_floor` alongside the existing PC/item histories,
profiles, observations, queue/done, sequence and reply. It retains the captured
preowned EXP minimum and presence even for new EXP0 cards. Changed card IDs
seek that floor rather than scanning lifetime mission history. Cached binary
claims/cards/PCs/boards/item/SP/casino snapshots must match durable state.
Captured before-card checks and actual ACK also honor prior floors; no legacy
card floors are inferred. This is not measured performance or a complete
native Memoria upgrade/consumption implementation.

## Deferred batch

Written checks: `node tools/test_achievement_items.cjs` (all17 mapped item
profiles, flag/item first orders, Iris-only flags, typed missing/unknown item
proof and rollback), `node tools/test_memoria_rewards.cjs` (original30 cards/
10 EXP rewards, new versus preowned/EXP0, mixed card/flag/item splits both
orders, missing/corrupt baselines, preowned downgrade rejection, private
floors/deletion, stale binary/callbacks, rollback/restart and once-only Iris).
Updated casino, including exact and foreign-signature v0 receipt cases, both
authored SP and Lotto ticket probes use cancellation after received flags, not
additive redelivery. Shared PC probes retain their existing legacy-empty-card
compatibility case. All are **DEFERRED / NOT RUN**.

Repeat original-master, mission/PC/item/stamina/casino/Lotto, shared shop/gift/
stage/gacha/dispatch, save/recovery and Android/launcher regressions. Native
ownership/default fields/signatures, natural mission eligibility/reset policy,
communication/costume/voice effects, reward attribution, card art/popups/
upgrades, event-clock and expiry interleavings, original actual-wire retry
identity after cache eviction, legacy reconciliation, usable back/recovery
and no-crash/no-ANR/performance remain incomplete or unverified. A fresh
already-claimed request after generic cache eviction still returns400. No route
is claimed feature-complete.

## War Game grade conditions follow-up (2026-10-06)

Original condition903 now has a source eligibility guard in fresh claims and
this shared6000 receipt path, so cached redelivery, partial saves and ACK
cannot bypass missing acknowledged local grade history. The separate original
mission catalog leaves existing achievement/reward exports unchanged. These
1733 category3/reset0 missions are non-resetting; the indexed claim ID prefix
rejects reawards under a different completedAt, without changing other mission
reset policies. Rewards still use the existing Iris/items/flags/save machinery;
no new native flags, historic receipts or additional credit are manufactured.
See [the War Game contract](war-game-battle-contract.md) for native evidence,
scope and deferred checks. Generic all17-item and PC-expiry probes now select
other authored IDs instead of bypassing903 eligibility. All checks remain
DEFERRED / NOT RUN; native natural progression/signatures/ordering and
independent completion-date attribution remain unverified.

## Executed ordinary hot/cold claims (2026-10-06)

On isolated MuMu profile `eb8b83ee` (Adventure16, event2019-10-18), a naturally
earned daily quest claim6010000010 displayed20,000 Valis but did not apply its
queued6000 ID4 or received flags during the hot callback. Wallet remained9408
and the Reward button remained available. No reward/save reset or precredit
was used to repair that pending claim.

Completed read-only original-binary extractions are
`.work/achievement-hot-transport-exact-20261006.txt` and
`.work/achievement-common-transport-exact-20261006.txt`. Wrapper150a994 sends
through209b70c; common hot transport209bd48 applies the root singular
`operation` before popup callbacks17eec6c/1b1bf14 read the root reward fields.
The old response had only plural `operations` plus those popup fields.

Shared delivery now aliases the same signed6000 for fresh, pending and legacy
cached `achievement/complete` responses. Its existing partial-effect guard
also suppresses singular6000 when omitting plural delivery. It does not
reissue rewards, change parameters/receipts/signatures, prewrite native
inventory/flags or weaken save-before-ACK proof.

After an actual stop/relaunch, pending ID4 applied through cold confirmation.
The Guild removed its Reward button and wallet became29408. A fresh earned
board-upgrade claim6010000011 then returned hot6000 ID5 at sequence20903;
native DailyMissionReceived20904 saved UserAchievement/UserStaminaTicket and
ACKed the real operations before dismissing the two-Potato-Snack popup. The
earlier received flag was settled by this same actual native save, not by a
server-created delta.

Read-only isolated SQLite proof: both mission flags state4 with their original
completedAt values; two distinct achievement receipts; queue empty; done IDs1
through5; Valis amount29408/cumulative30408; Potato Snacks295000001
amount2/cumulative2. `PRAGMA integrity_check` returned `ok`. Another actual
stop/relaunch retained these values, rendered town/Guild without repeated
rewards, and showed both claimed missions removed. Screenshots are
`.work/native-daily-missions-hot-20261006.png` and
`.work/native-daily-missions-cold-20261006.png`.

Local offline Gradle debug build/install succeeded. APK SHA256:
`6e036670246cc799fa9900b272cc1cd0a46ffdde8d3a5b0d3d663d1384b6c7ca`;
source and installed runtime server SHA256:
`3774c2c5e17bd621bead791b9240bd91f8a8d92c15e46239439710254ede5a7e`.
All seven packaged server-module byte hashes match their current source.

`node tools/test_achievement_items.cjs` passed: all17 original mapped item
classes, received/item save orders, once-only history, saturation, rollback,
restart, both event-box/mission reservation orders and old plural-only cached
envelope repair without database mutation. Two fixture errors were corrected:
bodyless session requests now use empty wire bodies, and the controlled box
roll selects the actual original normal-ticket prize rather than the first
different ticket. Raw injected SQLite503 failures remain distinct from
deliberate structured cancellation; no production guard was relaxed.

This is partial ordinary mission support, not all17 native item classes or
full6000 acceptance. Natural character/card/SP/casino/Lotto rewards, mixed
native effects, reset/expiry/clock interleavings, cache-evicted retry recovery,
long-session stability and other gameplay remain unverified. The original
Adventure5 database was not opened or changed; only test-save state was used.

## Executed Rookie mission and party progression (2026-10-06)

The original Rookie counter measures claimed missions, not cleared quests.
Bell1-1 had already naturally saved mission6050000001 state3/progress1;
opening its checklist recognized1/1 and exposed Reward despite the town
counter0/36. Hot claim20917 delivered6000 ID6 and ten Strength Falna294000001;
real DailyMissionReceived20918 saved inventory/received flags/SystemFlag and
ACK6. The next checklist entry was Change party, not another Bell1-1 replay.

Native Party2 editing added the actually owned Ais1011002003 alongside Bell
and Hestia. PartyChange20920 saved UserParty/UserAchievement/UserInfo and
naturally completed6050000002 state3/progress1. Claim20922 delivered6000 ID7
and ten Endurance Falna294000004; DailyMissionReceived20923 saved the real
received flag/item and ACK7. No native mission flag, inventory or party was
prewritten. Original received completion times1571404295 and1571406591 remain
bound to separate achievement_claim rows.

After a real Bell1-2 clear, launcher Stop/relaunch and fresh native town
save20940, read-only SQLite retained both Rookie flags state4, Party2's Bell/
Hestia and Ais slots, Endurance Falna amount10/cumulative11 and Strength
Falna amount/cumulative11 (ten Rookie plus one naturally earned Bell1-2 drop).
The town showed2/36 and the next mission; queue empty, done1..8 and
integrity_check `ok`. No repeated Rookie award appeared on startup.
Screenshots include `.work/native-rookie-mission2-20261006.png`,
`.work/native-party-change-mission-20261006.png` and
`.work/native-bell12-cold-20261006.png`.

These two Rookie cases extend the ordinary hot6000 proof, not all36 Rookie
missions, other mission categories, native card/unit rewards or all event
reset/expiry behavior. The existing APK/server hashes above are unchanged.
The isolated `test_feature_unlocks.cjs` and `test_main_stage_entry.cjs` also
passed: original22 rules/four chapter entries, synthetic prerequisite saves,
split orders, real test ACKs, rollback, cold corruption and stale-read guards.
Their fixtures now explicitly supply ordinary reward acquisitions and
distinguish raw injected SQLite503 failures from structured cancellation;
production acquisition/ACK checks were not weakened. Those tests are not
natural native feature/chapter-unlock acceptance.

## Fresh mission claim identity recovery (source only)

The fresh `achievement/complete` branch now sends known already-issued pairs
through the existing503/code3000999 recovery response, rather than400. The
permanent `(achievement_id,completed_at)` claim index remains sufficient to
refuse a second grant after queue, reply-cache, session or operation-done
cleanup; it is not promoted into proof of native reward consumption. A batch
overlapping a pending mission claim also cancels before eligibility/issuance,
including a subset or conflicting completion date. An exact untouched
pending batch retains the existing signed6000 reuse/delivery guards.

Fresh/subset/reordered/mixed issued-and-new batches cannot mint a command,
bind a transport identity, credit Iris, reserve inventory, alter native flags
or ACK. Malformed and genuinely unknown pairs keep their normal validation.
The shared transaction retains all existing save and issuance boundaries;
no schema, client authentication or reward contract changes are needed.

The expanded transport cases are WRITTEN ONLY / NONE RUN. This supersedes
only the earlier fresh already-issued400 source limit, not natural mission
eligibility, native back/recovery behavior or full6000 gameplay acceptance.
This route remains partial and this follow-up is untested; no build,
installation, listener restart or emulator check occurred.

## Permanent acknowledged request replay (source only)

The permanent `achievement_request` identity now survives both reply-cache
eviction and a real operation6000 acknowledgement. Its retained operation comes
only from the canonical `achievement_pc_delivery.operation_json` capture. The
server re-derives Iris, SP, casino medals, ordinary items, Lotto tickets, PCs and
Memorias from every captured original achievement before accepting that operation;
client-shaped reward fields are not trusted as their own provenance.

Pending exact requests keep the original signed operation and every existing
partial-save delivery guard. A settled exact request instead requires an
`operation_done` row with no live queue, received or legitimately expired claim
flags, current/floored PC-board, communication, Memoria and item effects, permanent
Lotto ranges, and saved SP/casino observations where applicable. It returns all
original root popup fields with `operations:[]`. The native reward handler therefore
has no operation to reapply, while the route callback can still dismiss its wait UI.

Changed request bytes or routes, a queue/done collision, a missing operation,
catalog-inconsistent capture, restored state3 claim, missing receipt, or rewound
effect produces the existing recoverable unavailable response without changing
wallets, inventory, flags, receipts or history. A new request identity still cannot
claim an already-issued mission.

The extended transport and shared reward fixtures are WRITTEN ONLY / NONE RUN.
Legacy claims created before these permanent captures, native post-ACK popup/back
behavior, natural eligibility, performance and crash/freeze acceptance remain
unverified. No build, installation, listener restart, ADB or emulator work occurred.

## Ordinary item split-save cold recovery (source only)

Every newly issued ordinary operation6000 item already carries an immutable
`achievement_item_claim` table/ID-field/cumulative target, while
`achievement_pc_delivery.observed` records each `item:<id>` in the same native
profile transaction. Cold recovery now uses that existing proof for uncapped
items as well as the previously supported capped-stock and dated-ticket
captures. A saved item is removed from the replayed `receivedItems`; an
untouched item retains its exact original positive quantity.

The server re-derives all 17 authentic item classes and quantities from the
archived achievement catalog before projection. It requires the unique owned
row at or above the captured cumulative target and requires that result to
match the retained observation. Captured saturated stock/date/signature paths
keep their stronger checks. Missing or malformed receipts, rewound inventory,
legacy saturation without a cap capture, unknown catalog reward families, and
partial capped effects still refuse without deleting the real operation.

The deferred item matrix now covers both flag-first and item-first restart
recovery for all 17 families plus a mixed uncapped Stamina Ticket and captured
dated Gacha Ticket operation. These cases are WRITTEN ONLY / NONE RUN. Native
operation application, popup/back behavior, save ordering, performance and
crash/freeze acceptance remain for the consolidated post-implementation pass.
