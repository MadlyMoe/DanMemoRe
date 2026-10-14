# Offline Iris/scratch-ad completion and allowance

**Source-only: NOT logically tested, built, installed or accepted in MuMu.**
The actual save/emulator remain untouched. Deferred checks are
`node tools/test_ad_views.cjs`, scratch/save/recovery regressions and the native
video-ad button, SDK callback, allowance labels, timer, ticket and scratch UI.

## Recovered original behavior

Frozen15.1.0 ARM64 SHA-256:
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
Addresses are raw, without Ghidra's `0x100000` image bias.

- Wrappers `1cd821c:1cd84a8` and `1d58998:1d58c40` send exactly `{type}` to
  `ad/view/complete`. Original advertisement types are1 (Iris) and2 (scratch).
- Operation26000 (`20fd068:20fd478`) optionally applies `UserAdScratch` and
  `UserAdScratchContent`. Presence of the scratch object selects type2;
  absence selects type1. It calls `20fcf78` to spend one viewing allowance.
  It does not itself grant Iris through issueAmount.
- `20fc670:20fc75c` calls calendar refresh `20fc75c:20fcdc0`, then reads
  remainingCount. Type1 resets to1 on a different calendar day. Type2 truncates
  the old/current hours to six-hour boundaries, adds the number of elapsed
  blocks and caps remainingCount at**4**. A refresh sets lastUpdateAt to the
  current epoch; a consumption alone does not change that timestamp.
- `2a3951c:2a3975c` selects offset32400 for region5. Hour getter `2a39dbc` and
  daily comparison `2a3a450` use this clock: six-hour blocks are
  `floor((epoch+32400)/21600)`; daily boundaries use UTC+9, not a fabricated
  once-per-login allowance. This is not the explorer's04:00 daily reset.
- UserAdvertisement constructor `2886b80:2886c8c` starts at userId0/type0/
  remainingCount0/lastUpdateAt0. Lazy owner creation `20fcdc0:20fcf78` then
  explicitly assigns userId via `20bad50(0)` -> `20b72d4`, which reads
  `user/game_user_id`, assigns the requested type and inserts the owned row.
  Therefore this table requires the local player ID; the scratch-table userId0
  exception is **not** extended to UserAdvertisement.
- Deserializer `280cef4:280d16c` reads userId long, advertisementType int,
  remainingCount int and lastUpdateAt long.
- Global callback `1ce4ff4:1ce51c8` triggers ViewAdMovie and closes its wait
  view. Purchase-modal callback `1d66844:1d66960` refreshes the scratch view
  for type2; type1 instead processes/pulls saves, then `1d66a88:1d66d30`
  builds the displayed reward vector from the optional root `issueAmount`.
  That vector is not another wallet credit. The callbacks alone did not
  establish its amount; the original message now does.
- Original `contents/1/master/divide_enc/message.enc`, SHA-256
  `a5814e507ed34a86886336f396d99a14e3bc47173891a492ce39d9dfe72760a5`,
  contains message40320028, key `home_shop_modal_shop_purchase_all_list_27`:
  **"Watch videos to earn 10 Iris."** The decoder now exports
  `advertisementIrisReward` with original item205000001, amount10 and that
  authored evidence. All147 source tables and existing master values remain
  unchanged. This is original client/archive data, not a guessed scratch payout
  or recovered publisher response capture.

Evidence artifacts: `.work/ad-scratch-entitlement-exact-20261004.txt`,
`ad-view-state-exact-20261004.txt`, `ad-view-callback-exact-20261004.txt`,
`ad-view-calendar-constructor-exact-20261004.txt` and
`ad-view-result-policy-exact-20261004.txt`. Only the ranges listed above are
evidence. The first exploration's merged allocator range and its unrelated
2886888 constructor are not UserAdvertisement constructor proof.

## Implemented offline completion

**Type2** completes against the first active original adScratch card. It
adds one ticket using operation26000 and unchanged current step/loop/content.
The one-ticket encoding is an offline reconstruction consistent with the
authored card description, not a captured publisher packet. It does not pick
a scratch prize, debit Iris, contact an ad provider or fake a rewarded SDK
callback. Natural SDK completion still needs a local-client integration and
native verification. The server receives only the original `{type}` payload;
no publisher receipt/authentication service has been reconstructed.

**Type1** now credits the authoritative free-Iris wallet by the original10,
once in the same request transaction as its receipt and allowance reservation.
Paid Iris is unchanged. Its signed26000 parameters are exactly `{}`: absence
of scratch state selects the original Iris branch. The hot callback receives
root `issueAmount:10` for the reward display; this is not inserted into signed
parameters and is reconstructed from the validated receipt on transport replay.
No scratch card/window or ticket is needed. Native counter/profile/token and
signature changes still belong to26000, not a server pre-save.

Its allowance is one per original **JST midnight**, not every six hours or the
explorer's04:00 reset. Long gaps still yield one view, not missed-day rewards.
Original message/item/amount/hash evidence must match before issuance and
pending delivery; missing or changed data cancels without a credit.

If native rows are absent, captured baselines use the original lazy defaults:
zero ticket/loop, first original step, and zero allowance/lastUpdateAt0. Calendar
refresh makes up to four views available. Existing valid native state is
captured rather than erased. Foreign, duplicate, orphan or unknown legacy
state rejects without mutation. The existing scratch floor must match any
already settled ticket/card history.

`ad_view_state` materializes spent allowance by original type. A fresh grant
must match this floor after the deterministic native calendar refill; it cannot
restore consumed views from a stale save. Event-clock reversal does not refill
spent allowance. A persisted future calendar produces recoverable3000999
until aligned, rather than erasing the row or awarding another view.

The existing request transaction commits the allowance debit, operation26000,
captured card baseline (if previously present), permanent `ad_view_claim`,
received-wire `ad_view_request`, sequence and reply together. Native tables,
tokens, signatures and tickets are not pre-published; operation26000 owns the
client changes. No Iris wallet changes occur in this type2 path.

## Save, delayed application and replay

One pending ad completion or scratch draw blocks a different scratch effect.
Pending completion retries reuse the original operation rather than adding
another ticket or Iris credit. A pending type1 cannot alias a type2 request,
or vice versa. Type2 signed parameters contain scratch state and an empty
content array; type1 has empty parameters. Both use singular hot/plural cold
delivery.

Save deltas may first contain native lazy initialization, pre-effect state or
calendar refresh, then the ticket and consumed allowance in separate saves.
ACK requires the exact captured **ticket+1** projection, unchanged picked
contents and a unique owned UserAdvertisement row proving the allowance debit.
Ticket alone, counter alone or an unconsumed full allowance cannot drop26000.
For type1, ACK instead requires the uniquely owned consumed daily counter;
there is no invented native Iris inventory row or scratch-ticket requirement.

A delayed cold26000 re-runs native allowance refresh at **application time**.
Saved consumption is therefore validated against the captured pre-effect
counter at its saved calendar boundary, not against a guessed issue-time
timestamp. Initial lazy creation may have happened earlier within the same
block/day. A late saved counter must be at or beyond the issued boundary, at or
before the current clock, and match one native decrement after refill.

`ad_view_claim.effect_json` now records the first actual consumed counter save
for **both** types, even before ACK or a type2 ticket save. Once observed, only
that consumed state or its deterministic subsequent calendar refresh can be
saved. Returning to the pre-effect allowance, deleting it or editing the
checkpoint rejects. This proof commits with the native profile/save/reply,
including rollback if a later ACK step fails.

An observed26000 is omitted only from save responses while its queue remains
pending. Hot retry, cached reply, cold login/pull/confirm instead cancel3000999
until ACK/reconciliation: they must not spend another view or overwrite a
later calendar. This cancellation is not a successfully completed gameplay
route. Older scratch receipts migrate with amount0/unobserved defaults; an
already-provable consumed native row is also protected from redelivery.

ACK atomically saves native rows, the settled scratch ticket/card floor and
observed allowance floor, then records done/removes the queue and commits the
reply. Calendar-only saves can subsequently replenish the viewing counter
under the original six-hour/cap4 rule, **without earning another scratch ticket**.
The small materialized floors avoid scans of lifetime view receipts.

Permanent transport identities bind actual received bytes, survive generic
reply-cache eviction/session/restart and reject conflicts. Newly issued claims
also retain the canonical signed26000 operation. Type1 binds the exact
authoritative Iris journal row; type2 retains its acknowledged scratch floor.
After real native save and ACK, an exact old identity now returns
`{code:0,operations:[]}`: it cannot credit Iris, restore a ticket, spend a view,
or expose the old absolute operation parameters again. The settled read
requires done-without-queue, the captured operation, observed consumed counter,
current materialized allowance/profile consistency, and the type-specific Iris
journal or scratch history. A type2 ticket identity now proves its original
post-grant card through every later completed type2 grant and scratch draw to the
current materialized floor; this also corrects the older validator that still
required the pre-grant floor after ACK. Missing, pending, corrupt,
identity-swapped, discontinuous or ambiguous history returns the controlled
unavailable response without repair. Legacy settled claims lacking the new
immutable operation/journal capture remain unavailable.

Fresh, cached and cold pending deliveries continue to validate original
parameters, captured before/after state and allowance reservation. Missing or
corrupt pending history preserves the queue; no synthetic successful ad view is
returned.

## Incomplete branches and acceptance

This supersedes the earlier source-only "type1 payout unrecovered" boundary.
The publisher ad SDK is not restored. Original video availability/eligibility,
SDK-to-local-completion adapter, first-entry state creation/save order, owner
getter consumption, allowance/timer labels, native calendar/Iris popups, native
hot/cold effect/save/ACK ordering and recovery without restart remain pending.

This does **not** complete ads or gacha scratch18000. The packet audit remains
partial and all runtime acceptance stays unchecked. Co-op stays last.

The extended deferred check covers original10/free-versus-paid credit, no
native pre-save, daily boundaries/long gaps/calendar-only refresh, type
interleavings, original empty parameters/root display value, pending/settled
actual-wire replay without a second effect, type2 replay after later draw/ticket
progression, settled operation/journal/done/queue/chain corruption refusal,
observed cold cancellation, both split counter/ticket
orders, delayed application and later refresh before ACK, missing/changed
catalog or receipt evidence, counter/wallet bounds, restart and transactional
issue/observation/profile/floor/ACK/sequence/reply rollback. These checks have
**not been run**; syntax inspection is not logical or native acceptance.
