# DanMemoRe

Preservation project to make *DanMachi: Memoria Freese* playable after its service shutdown.

Large original game contents are kept outside Git.

## Offline client

The original EU 15.1.0 APK stays untouched. The build creates a separately named
`com.eu.danmore` app whose game API, content, telemetry, billing, and archived
storage URLs point only to `127.0.0.1:28766`.

Put the extracted archive in `contents/`. For an ARM64 emulator such as MuMu,
put the untouched APKPure bundle at `.work/danmemo-15.1.0-arm64.xapk`; otherwise
the builder uses `contents/com.eu.danmemo_2023-12-22.apk`. Neither source is
tracked by Git.

```powershell
python tools/offline_client.py self-test
python tools/offline_client.py build
python tools/offline_client.py serve
```

With MuMu running, open a second terminal and install/launch it:

```powershell
python tools/offline_client.py install
python tools/offline_client.py preseed
```

Release users import the untouched archive without the repository tools. Copy
`contents-complete.zip` into storage visible to Android, open **DanMemoRe Launcher
→ Tools → Import preserved contents ZIP**, and select it with the system picker.
Like RevivalSide, the launcher extracts into its own private staging cache,
checks each original manifest asset's size and MD5 while streaming, applies the
offline manifests and banner artwork, and atomically activates the cache only
after all eight phases validate. The local listener then serves that cache over
`127.0.0.1:28766`; Memoria Freese's own downloader writes into the game's private
storage. Root, broad storage permission, and direct writes into the game's data
directory are not used. Launcher SQLite profiles and game saves are untouched.
Keep the emulator powered on until the import notification reports completion.
The release APK does not contain or download the 14 GB archive, and extraction
plus the game's installed copy requires roughly twice the archive size plus 2 GB.

`preseed` streams the complete extracted archive (all eight phases plus image,
atlas, voice, and cache roots) into the rooted emulator without making another
13 GB temporary copy. Downloaded content remains available directly from
`contents/` as a fallback. Static analysis of the
ARM client established the WFS response headers, JSON login fields, dedicated
MessagePack user-data path, local AES request format, and an unencrypted response
mode. OpenSSL must be available on `PATH` to decode user-data pushes.

If an existing installation asks for the same 290 MB of voices on every launch:

```powershell
python tools/offline_client.py repair-voice-cache
```

The archive mixes a newer voice manifest with twelve older expanded voice caches.
Keep the untouched `contents-complete.zip` locally for the repair's provenance check.
The repair validates every affected audio file against the untouched archive and
the emulator, then repacks those retained recordings with truthful local ZIP
hashes/sizes and matching native completion records. Original content is untouched;
unavailable newer recordings are not invented or marked downloaded. ZIP fallbacks
stay in ignored `.work/voice-packages` and the installed launcher's private runtime,
not Git or the APK. Prior manifests/markers are backed up under `.work`.
`preseed` runs this repair automatically. Re-run it after clearing/replacing game
content or reinstalling the launcher without its runtime files. Missing archived
episodes remain explicitly unavailable.

The local server supplies the minimum original-data starter profile, acknowledges
the client's own nested state deltas, and emulates the retired name-moderation
bootstrap. The ARM64 build also corrects the client's invalid fresh-account party
selection (`activePartyId` 0 while original party IDs begin at 1).

On MuMu this passes login, update verification, player registration, local asset
download, movie playback/skip, and reaches an interactive opening story. Unknown
actions fail closed with HTTP 503 and explicit native cancellation code3000999
rather than an empty network-error response. The ARM64 offline build displays
the failure message without changing authentication or save-integrity checks.
The shared cancellation/return path is implemented but its consolidated desktop
and emulator acceptance are still pending. Request metadata and locally decoded
user-data bodies are recorded only in ignored `.work/requests.jsonl` so later
routes can be reconstructed from the client rather than nonexistent server traffic.

Current boundary: this is a client-derived first-run bootstrap, not complete game
server coverage. The verified party-selection correction currently targets the
APKPure ARM64 build used by MuMu; the ARMv7 package still needs an equivalent fix.

Generated APKs, signing material, request logs, and the 14 GB content archive are
intentionally excluded from Git.

## SQLite launcher and packet status

`android/danmemore-launcher` runs the local Node server with Android's native
SQLite bridge. Gameplay changes, pending operations, request sequence and exact
retry responses commit together. Do not overwrite existing profiles with the
starter seed.

The [consolidated packet checklist](docs/packet-test-plan.md) lists every discovered
route, available probes and remaining final acceptance. Implement first, then
freeze the server/client builds for the batch; cooperative gameplay comes last.
Successful `gift/receive` calls now retain their exact request hash, sorted Present
IDs and signed operation in SQLite. Pending exact retries still pass through the
existing effect/flag guards; after real acknowledgement, the same request returns
the original mandatory popup fields without another reward operation. A new
request identity cannot reclaim that gift. This transport extension and its
deferred rollback/restart/corruption cases are source-only and have not been run.
`achievement/complete` now has the equivalent permanent settled transport. Its
acknowledged replay reconstructs the original popup-only response only after the
captured operation is re-derived from the original mission catalog and all durable
claim, reward-effect and done-state evidence still agrees. The reply contains no
operation6000, so it cannot credit Iris or reapply inventory. Its expanded restart,
corruption and rollback cases are also written only and have not been run.
`shop/buy` now retains the same permanent post-acknowledgement identity for both
its signed operation9000 and any paired unit1000 or Memoria6000 reward. An exact
cache-evicted retry validates the original product, payment, count/date and every
saved reward receipt, then returns the original popup fields with no operations;
it cannot charge or grant twice. Missing legacy captures and damaged or ambiguous
queue/done evidence remain unavailable. The new ordinary, paired-unit and paired-
Memoria cases are written only and have not been run.
Unsupported requests and explicitly unavailable branches roll back and use the
client's non-retrying cancellation path, retaining pending rewards and progress.
Stage EXP captures now compare ordinary battle parties in native slot-number
order. Reordering an unchanged save array no longer invalidates the pending
result; actual unit/equipment changes remain blocked until EXP is saved. Older
valid captures are normalized only in memory, without changing their award or
rewriting SQLite receipts. Ordinary stage EXP also resolves saved guests by
matching slot: borrowed equipment snapshots for ownerType3, otherwise the
guest's own saved equipment indices. Guests replace a main slot, never add a
seventh unit or become owned inventory. Existing reward math and receipts stay
unchanged. The extended checks remain **deferred**; guest production, cached and
special-party selection, and emulator acceptance are still pending.
Malformed requests, save-integrity failures and unexpected database errors are
not converted into success. Run `node tools/test_offline_recovery.cjs` in that
batch and verify message dismissal/back navigation natively, not just HTTP status.

The tutorial draw uses operation **1001**, not ordinary lottery operation 1000.
That dedicated client operation advances `tutorial.gacha_end`; its acknowledged
`UserTutorial.isEnd` flags survive restart. Repeated pending requests resume the
same draw. Adventure completion similarly lets operation 5000 apply the clear
counters once, then persists the client's delta. Stage completions retain their
run token across request/session retries; one-time reward entries commit with the
operation and Iris balance. Archived first-clear item/PC/Iris and objective Iris
rewards are supported. Rewards omitted by older builds are not retroactively
credited without reconciling the old save.
Stage acknowledgement now also retains the pending operation until any awarded
first-clear character has been initialized and saved, not just the clear flags.
Duplicate stage characters now reserve their original personal bond through the
same item receipt, including mixed loot and split saves. The bond is not also
added to wire loot, which would grant it twice. Old duplicate receipts without
an original bond capture cancel with their queue preserved. The original guest
catalog decoder and permanent-ownership rule are now implemented in source;
the regenerated158-source master includes both original guest catalogs.
That removes the data gate, not native guest acceptance.
Temporary guest save/replay and clock transitions remain incomplete.
Guest saves use the original unique pcId key and typed userId/totalExp fields;
malformed or unknown identities cancel without rewriting their saved history.
The guards and extended `test_stage_units.cjs` are implemented.
Desktop/native acceptance is deferred to the consolidated pass.
Regular and ticket draws also retain the pending request identity across process
and login-session restarts. A retry returns the same result; a different draw
cannot replace it before acknowledgement. All archived banner families use the
archived pools, weight groups, prices and ticket IDs instead of rotating character
thumbnails. Results, debit, per-button counters and duplicate bonds commit in one
SQLite transaction. Eleven-unit draws advance the purchase counter once, matching
the active client's remaining-purchase display. Basic guaranteed banners reserve
the archived number of slots for the original guaranteed pool; a missing pool
rejects the whole draw before spending anything. One-time ticket offers enforce
their purchase limit without discarding the remaining tickets.
New units are durable pending awards, not uninitialized owned-profile rows.
The native acquisition routine (`0x22f0170` -> `0x22ebbbc`) initializes skills/jobs
and marks the unit joined (`0x22dc28c`). A preexisting placeholder skips that path
on reload. The server therefore stores the initialized client delta when accepting
the award, and refuses an acknowledgment if the new unit has not been saved as
joined. Delta-before-ack and combined delta/ack both survive interruption.
Old exact, untouched pending placeholders are backed up in
`legacy_draw_pc_backup` and removed from the owned profile; the award remains queued.
Modified/initialized units are preserved. Native acceptance of this ordering fix
is still pending; synthetic acknowledgment tests do not validate unit skill/stat data.
Unlimited eleven-draw step-up banners use the archived step-specific price,
normal pool and guaranteed slots. Step, purchase count, Iris and draw result
commit together; a stale step cannot repeat a discount. The 303 exported schedules
deduplicate one identical archived copy. The New badge flag is presentation-only
(`0x25a6d64`, `LotteryNewIcon`), not an unsupported draw feature.
Fresh draws now retain their effective pre/post button state, step, optional JST
daily day, authored result groups and exact returned PCs in the permanent receipt.
Pending and settled replay re-derive that schedule from original master data and
require the original indexed daily claim, preventing an old step/day identity from
being reinterpreted after a clock change. These cases are source-only and untested.
Charged draws now run the same permanent Iris-journal validation on exact request
replay, login/pull delivery and settled replay. It re-derives free-first versus
paid-only spending from the captured authored button and rejects missing, damaged
or wrong-mode debits without delivering, charging or rerolling the operation.
The deferred paid-only corruption cases are written but not run.
Tickets are individual acquisition-date entries, consumed
oldest-unexpired first with the original 30-day lifetime, not an `amount` field.
The category-weight/uniform-member sampling, final-slot guarantee placement and one bond per duplicate are
reconstruction assumptions; they are not evidence of the original server's code.
For unlimited step-up schedules, retaining the last ordinary-price row after the
discount/guarantee sequence is also an offline reconstruction, covered through
22 purchases and a mid-sequence restart. Limited paid steps, legacy milestone
guarantees, scratch-marked draws, selected lineups, daily resets and button 4
ticket batches share the same transaction/replay path. Paid-only draws debit only
paid Iris. Original availability windows are retained.
Historical saves anchor the client's proven server-timestamp clock and every server
calendar check to one selected original date, advancing at normal speed. Only banners,
shops, and events from that timeframe appear. The launcher can change an idle save's
event date; it rejects the change while a gameplay operation still awaits persistence.
An accepted date switch, its selected-day `UserLottery` projection and deletion of
every derived route reply are one SQLite transaction. Invalid snapshot history or
a failed invalidation keeps the prior date, profile and cache together instead of
leaving a half-switched calendar or exposing an old-date response under the new one.
Daily gacha progress now has source-only per-JST-day SQLite snapshots. Each new
snapshot is bound to its canonical draw operation, and an event-clock restart
projects only the selected day's daily buttons into `UserLottery` while preserving
non-daily counters and every other retained day. Canonical pre-ledger visible rows
are kept without inventing an operation; damaged or conflicting history refuses
instead of resetting a paid draw. A result still pending across local JST midnight
keeps its original day row until the native ACK, then releases the next day reset.
The deferred multi-day, rewind, pending-midnight and corruption
cases are written but have not run, and no save/listener/APK/emulator was touched.
Main banners load `files/lottery/background/<lotteryId>.png`, not pickup character
art. The final archive retains exact backgrounds for 692 of 2,236 lotteries.
The other 1,544 receive labeled text cards with original titles and featured units.
For the 368 lotteries without authored pickups, examples are explicitly labeled
as pool previews, not rate-ups. `data/danmemore-gacha-art.json` records both layers.
Original lottery and pickup master files remain byte-for-byte unchanged. Generated
cards are bundled with the launcher and registered in the phase-3 download manifest;
preseeding installs them at the native banner paths.
Gacha Details shows original schedules, saved counters, costs, limits, milestones,
step-up schedules, separate normal/guaranteed pools and per-unit odds calculated
from original weight buckets. Selectable choices are labeled conditional and missing
weights are not normalized into invented rates.
Selector choices now contribute their original weight buckets to both normal
and separate guaranteed pools. The previous normal-only contribution left some
Celestial Festival guaranteed pools at 97%, causing a rejected draw. Tests cover
all 49 archived selectors: 39 date-valid draws and 10 originally disabled banners,
including paid-only deductions, chosen-unit reachability and pending restart.
Each new selector draw also retains its exact chosen lineup, authored slot pools
and returned PC sequence in the permanent draw receipt. Pending and settled
replay re-derive membership from the original pools; changed choices, out-of-pool
results or a lost settled selector proof refuse without rerolling or charging.
The extended cases are written only; native paid-selector acceptance is still
unverified.

`data/danmemore-master.json` contains the original gameplay fields
needed for friendship levels/rewards, achievements, item and currency identities,
fixed Iris costs, stage/objective rewards, expedition tables, event-box pools/costs,
and gacha pools/costs/step schedules/bond identities.
The stage reward export covers
21,524 stages and 43,470 objectives, including objectives without rewards.
It records source-file hashes. Archive keys and the 14 GB contents remain local.
Friendship completion queues operation 11000 for the correct hero reward track.
The former 11100 handoff was invalid: that operation awards an ordinary inventory
item, not a CP reward record. Exact legacy CP entries are backed up and removed
from the queue and cached replies; genuine item awards and the pending 11000
reward are preserved. A separate SQLite claim ledger prevents duplicate rewards
after the character save and operation acknowledgement arrive separately.
Rollback, all three hero tracks, restart and migration replay checks pass, but
these repairs are not deployed or verified in the native game. The 57 original
CP item point values and 164 character favorite lists now validate gift requests,
including native float32 rounding and the point cap. Newly queued gifts reserve
stock until consumption is saved, preventing overlapping use and premature
acknowledgment. Historical claims without saved evidence, old item operations
without reservations, and non-item point-gain eligibility remain unresolved.
Fixed-cost recovery uses original consume IDs and persistent Iris,
not a constant billing balance. New fixed-cost purchase receipts now survive
temporary reply-cache eviction, relogin and restart. Pending retries keep one
charge; obsolete completed callbacks cancel without charging or reapplying SP.
Normal stamina uses all999 original player-level capacities, War Game adds5
(cap15), and Record Buster adds5 (cap10). Native SP remains client-applied;
acknowledgement requires its saved increase, including split save/ACK. Once
observed, later legitimate spending is allowed instead of imposing an SP floor.
Unknown legacy receipts remain queued for reconciliation. Revival purchases now
capture one exact active original stage and reject idle or changed-encounter hot
retry, while return-only cold operations can still settle. Native defeated-state
and modal/event revival proof plus serial-SP effect proof are still incomplete. Present and mission
SP now share separate pending targets with normal Iris refills; already observed
SP can be spent without becoming a permanent save floor. Expedition level-up
SP now uses that same source-only path with XP-coupled observation and the sum
of each gained level's original capacity, including native int32 saturation.
These source changes
and `test_stamina_consumes.cjs` are NOT logically/native tested or deployed;
see [the recovery contract](docs/stamina-consume-contract.md).

Ordinary ability-panel Iris spending now uses the archived panel-specific prices,
unit/job membership and native operation10300. Its SQLite receipt, free/paid Iris
debit and queued effect commit together. The purchased job's opened bit must be
saved before acknowledgement and cannot disappear in a later save. Rank-up panels
cannot use Iris; locked or out-of-order boards and overlapping unsaved purchases
do not charge. The extra limit-break boards use original PC/job identities,
maximum normal rank and five unlocked panel indices per limit break. Their native
job state must already be saved; missing extra-job state, old nonempty panel lists
and other detailed consume forms remain explicitly unavailable. Later saves cannot
relock purchased limit-break panels by reducing their qualifying rank/count. The new handler and
`test_ability_panels.cjs` are implemented but NOT logically/native tested or
installed yet; they belong to the consolidated batch in
[the packet checklist](docs/packet-test-plan.md).

Seventh Zone's `element_event/summary/get` now projects actual saved high scores
through the original 208-event/1,382-difficulty joins. Empty records stay absent;
no scores, clears or rewards are fabricated. Reads preserve the wallet, profile
tokens and pending operations. The handler and `test_element_summary.cjs` are
implemented in source but NOT tested or installed yet. Both Seventh Zone completion
modes now have an operation25000 handler, persistent score/reward receipts, original
first-clear prizes, authored-window gating and save/ACK guards. Scoring uses the
explicit [offline-element-v1 reconstruction](docs/element-offline-policy.md), not
publisher formula parity. A scoped ARM64 first-record int64 repair is also in
source, not built/installed. Native rendering, event-cache/result transitions,
large first scores, achievement events and inventory signatures remain pending.

Seventh Zone top/nearby/character rankings also have source handlers for all417
original stage groups. They show the genuine local high-score player and captured
team only after saved-result acknowledgement; later party edits cannot rewrite
that history. Indexed SQLite best pointers avoid scanning lifetime clears.
Maximum-score selection and within-team usage are explicit solo-offline policies,
not publisher rankings. Missing legacy team history uses recoverable cancellation
without erasing scores or granting prizes. `test_element_rankings.cjs` is written
but NOT RUN; native rendering and team-save ordering are still pending, not installed.

The permanent Falna, EXP and Valis orb purchases use the archived single/bundle
prices and quantities. The same operation 9000 path now handles all 6,509 archived
ordinary-item exchange products whose reward is an inventory item. The server
records the client's saved cost decrease before accepting the purchase, then binds
that spend to the reward/count receipt. Original availability windows and lifetime,
daily, and monthly stock counters are enforced. Cost, reward, count, retry, rollback,
and restart behavior have automated SQLite coverage, not native UI proof. The 353
archived shop packs and their 2,577 contents are decoded; all 353 item, costume,
and equipment packs can be purchased with the archived paid-Iris prices, including mixed packs. Paid
Iris is a separate persistent balance and each pack debits it atomically. These
local purchases do not contact or impersonate a real payment provider. Legacy queued purchases without
receipts are retained for reconciliation. Direct equipment exchanges use the native
generated-inventory payload and require the saved equipment before ACK. Direct PC
and memoria exchanges pair operation 9000 with acquisition operations 1000 and 6000;
new units, duplicate bonds, and memoria saves must persist before ACK.

The launcher Tools page has separate **Add 1,000 free Iris** and **Add 1,000 paid
Iris** controls for the active local save. Paid Iris funds the archived paid-Iris
shop packs; free Iris remains the normal gameplay balance. Each click uses a durable request ID, retained on failure and across
launcher restarts, so a lost response cannot credit twice. Grants and receipts
commit together and do not consume the game's request sequence or alter client
inventory. Repeated grants have no daily/payment limit, subject to the local
999,999,999 per-balance ceiling. This is explicitly an offline control, not a real
store purchase, payment receipt or external entitlement. It does not repair or bypass
the original Google/Apple store integration. The launcher builds, but this control has not
been installed or visually verified in the emulator. All archived shop reward variants
are handled server-side, but native shop-screen verification is still outstanding.

Friend/follower/support lists have the original empty-list formats for a solo
account. Nonempty legacy friend status fails explicitly rather than being silently
erased. Other accounts, borrowed units and social mutations remain unsupported;
these list handlers also still need native UI verification.
The native list callback stores the current user's ID in `UserFriendStatus.friendId`.
That local marker is now accepted; it previously caused subsequent lists to fail.
Save/replay/restart tests preserve the status timestamp and still reject actual
nonempty or foreign-account social records.

Solo Familia creation/status now persist original settings, an actual owner and
the 100,000-Valis creation operation. The response derives the owner's rank and
leader level from original EXP/job tables. The client owns the debit; its saved
cost must precede acknowledgement. Capped cumulative earnings can make that cost
ambiguous and leave the operation queued. A stale currency save after completed
creation remains a broader save-consistency gap. The shared native hot-response
path needs a singular operation and forwards its parameters to the UI callback;
creation, first reward and item donation now use that existing delivery path.
Fresh MuMu creation saves its charge immediately, and cold recovery applies a
previously undelivered charge once. No remote peers or guild events are invented;
other Familia systems remain incomplete.
The latest source-only hardening also gives every accepted creation request a
permanent actual-body receipt tied to the immutable creation operation and
request-time pending/settled response. Exact retries bypass the generic cache:
they redeliver the same operation only while it is genuinely pending and return
an empty success after its real ACK. Renaming, disbanding or recreating the
Familia invalidates an older request before the native callback can recache its
submitted settings. Legacy cache-only creation replies are refused. These new
branches and their deferred rollback/cache-loss/corruption cases have not run.

Familia entry rewards now use native operation 22300 and a player-wide SQLite
receipt. Creation must be saved first; the native client alone grants the ticket,
and acknowledgement requires saved acquisition evidence. Retry, rollback, split
save/ack and restart preserve the pending reward; changing the event clock cannot
grant it again. The original message identifies a 4-star guaranteed ticket, but
its quantity was not recovered: **one ticket per local player is explicit offline
policy**, not an original publisher rate. Eligibility belongs inside `status`,
not `familia`. Two isolated MuMu saves show the reward popup and saved ticket;
cold entry retains the ticket without another popup or currency charge. These
fixtures have synthetic story/wallet prerequisites, not proven natural progression.
The latest source-only, untested hardening gives every accepted first-reward
request a permanent actual-body identity tied to its Familia creation
generation, lifetime operation and exact pending/settled response. Exact
pre-save retries recover only the retained operation. An exact ticket target
saved with that operation's signature creates an integrity-checked observation;
hot retry and cold confirmation then carry the same operation with an empty
remaining `gainedItems` list until the real ACK. After ACK they return an empty
settled response, including after generic-cache loss, restart, disband and
recreation. Damaged or legacy cache-only evidence is retained behind a
recoverable error rather than reminting the ticket. Deferred
cases are written but have not been run under the packet-implementation-only
phase, so earlier MuMu evidence does not verify this new path.
The original empty/null recommendation request now returns an empty `familias`
list without a communication error; a solo save has no other guilds to recommend.

Familia settings and god changes now update the actual local owner's persistent
settings. The original choices and text limits are enforced; edits preserve
balances, contributions, creation receipts and purchased themes. A saved earlier
local name is recognized after a rename, so a delayed native profile save cannot
lock the Familia. Creation's debit must settle before editing. Optional secondary
activity time defaults to zero on an edit, following the native request and cached
settings copy. Rollback, exact retry, newer-edit preservation and restart are tested;
the retired publisher's global name availability and cooldown rules are not invented.

The local Familia master's Leave button now implements `familia/break`, using
the original empty request and numeric result. One SQLite transaction archives
the group, learned skills, shop ownership/selections and board history before
clearing active membership. Player items, expenditure receipts and the lifetime
first-member reward remain intact; nothing is refunded or re-awarded. Pending
operations prevent disbanding. Exact retries cannot disband a later replacement
group, and known delayed local membership labels are reconciled by the existing
save path. MuMu verifies a real skill unlock, disbanding, restart without the old
group, recreation with the original 100,000-Valis charge, and another restart with
fresh guild progression and retained player inventory. This isolated fixture has
synthetic story/funding prerequisites. Non-master `familia/leave`, remote joining,
the client's stated 24-hour join restriction and complete cooperative battles
remain unsupported; this is not proof of full Familia gameplay.

The solo Familia message board now persists native text, stickers and the three
skill-suggestion message formats in indexed SQLite history. Posts retain the
real local author's name and leader, and exact retries cannot duplicate them,
even after the generic response cache is cleared. All 42 original sticker IDs
are exported: 30 defaults and 12 unlocked through actual Familia shop purchases.
Initial feeds return the newest 50 messages in ascending order; older/newer
requests preserve that native ordering. Page size, inclusive pagination modes,
permanent retention and text safety limits are explicit offline policies, not
recovered publisher settings. Unknown system notices and remote history are not
silently acknowledged or fabricated. MuMu verifies text, original sticker art,
localized skill suggestions, cold persistence and older-page loading on separate
test saves. The pagination test includes clearly labeled synthetic history;
natural progression and multiplayer remain unverified.

The `achievement/familia/get` handler reports observed local page-login days,
the actual one-member Familia, and its original contribution-based level. Explicit
page-login visits are persisted once per Japanese calendar day with the request
and reply; this is offline counting policy, not reconstructed publisher history.
Its daily tab uses all nine original type-301/401 `familiaAchievement` rows, not
ordinary daily missions, and respects their authored availability windows. It
reports only real observed local member activity. Unknown historical personal
progress rejects without resetting the save. Native MuMu verification on an
isolated test adventure now opens the room and all three mission tabs without
1003 or persistent loading. The original missions render on an active event date,
and a cold restart preserves login-day progress without counting that day twice.
This test adventure has synthetic story-unlock prerequisites; natural story
unlocking, cooperative reward delivery and full Familia gameplay remain unfinished.

The distinct `familia/achievement/get` GVE mission wrapper now has a source-only
type-201 reward producer. It uses the full acknowledged local best score for the
original int64 thresholds, clamps only the displayed progress to int32, records
per-threshold claims and emits one aggregate native type-6000 operation for the
original Iris, Valis, ticket, key-item and Hero Sublimate rewards. The reward is
bound to the exact GVE result, best-party capture and current Familia generation;
pending, partially saved, restarted and acknowledged states reuse the shared
mission inventory/recovery custody paths without precrediting native profiles.
Type-101 remains unavailable, and the original daily goals of 5..25 do not turn
one offline member into fictitious participants. Deferred source fixtures are
written but not run; frozen-client notifications, save order and stability still
await the consolidated pass after every packet is implemented.

Familia shop replies now provide the required post-purchase `valis` and selected
`familiaShopId`. Previously missing `valis` caused a native null-number exception
at `0x231d90c`. Status also restores `familia.purchasedProduct` on cold entry, so
owned stickers and themes do not become apparently unowned after a restart.
Malformed legacy cached replies reject without erasing purchases or repeating
their debit. The two original default-theme flags are recovered from
`familiaBgImage` and `familiaBGM`; defaults can be selected without a purchase,
while other themes still require ownership. Isolated tests cover these fields,
persistence and transaction rollback. Native MuMu now completes a Music_02
purchase at its original price and applies its setting without crashing.
Another cold restart retains ownership, its selected music and the exact balance;
switching back to the default music also succeeds without 1003 or a charge.
This remains limited test-adventure acceptance, not proof of every shop product,
audio playback, background selection or original Familia-bank accrual.

Familia skill reads and growth now use the 315 original levels across seven
elemental tracks, including their authored costs and release dates. Learning a
level atomically spends the local Familia's skill points and records its original
ID; an already learned level cannot charge again after a retry or restart. The
native reply supplies numeric learned IDs, remaining points and the newly learned
ID used by the completion popup. Tests exercise all 315 levels, skipped-level and
date rejection, insufficient points, transaction rollback and once-only retries.
MuMu completed Fire Damage unlock and Lv.2 upgrade, showed points 6 -> 3 -> 0,
disabled confirmation for an unaffordable upgrade, and restored Lv.2/zero points
in a fresh game process. This isolated adventure uses synthetic story and point
prerequisites; natural point accrual, higher-level native screens and Familia
battle effects remain unverified. No player save was changed by this skill test.

Faith Stone donations use the three original 5/10/20-point item values and their
per-item daily limits. Contribution, crossed-level skill-point rewards, operation
22200, item-debit receipt and exact retry response commit atomically. The client
still owns the inventory change; acknowledgement requires its saved amount,
donation count and UTC+9 date. Completed receipts also prevent stale saves from
refunding spent stones or resetting the same-day count, while allowing genuine
new acquisitions and daily rollover. Focused tests cover all three item values,
transaction rollback, conflicting pending requests, split save/ack and restart.
MuMu donated 40 of each original stone, saved every debit immediately, crossed
the level-2 threshold and displayed six skill points. All three daily limits
blocked further donations; a cold launch retained the items, level and points.
Changing the selected test save's clock through the launcher restored the next
day's allowance, and another donation saved normally without refunding stock
or repeating the level reward. Synthetic starting stones, contribution and
story unlocks limit this proof; natural item acquisition, concurrent rewards
and full Familia gameplay remain incomplete. The actual player save was preserved.

Valis donations now use all three original 100/1,000/10,000-Valis options, each
limited to five per client day. Bank credit, operation 22100 and a once-only receipt
commit together; acknowledgement requires the native wallet debit and daily
counters. Bare acknowledgements, stale saves and spending unsettled bank funds
reject. Hot replies require singular `operation`, with Familia cache totals inside
its parameters: the client forwards these parameters rather than the outer reply.
Missing that envelope first left the wallet unchanged, then crashed confirmation;
both cases were reproduced and corrected. MuMu's isolated save now confirms a
55,500 donation, wallet 200,000 -> 144,500, bank 0 -> 55,500, all daily limits used,
and a successful saved acknowledgement. Cold pending recovery and advancing the
historical clock into the next donation day were also checked. Bank-only transfer
is an explicit offline policy: the archive does not provide a Valis-to-contribution
rate, so no contribution points are invented. Synthetic test prerequisites do not
prove natural gameplay progression. Adventure 5 was byte-unchanged during testing.

Voting now uses all eight original elections and 243 candidates. Candidate totals
and rankings reflect only local accepted votes (an offline reconstruction). The
operation, ticket-spend baseline, tally and response commit together. Acknowledgement
requires both saved participation and expenditure; first-open ticket flags and
completed participation cannot regress. Expired operations remain stored but are
withheld from fresh/cached delivery because the native handler would skip them.
Proven delayed acknowledgements remain valid. Original windows are preserved, so
all archived elections are expired today; calendar restoration and native playability
are still unresolved. Desktop boundary, cap, rollback and restart tests pass.

Expedition dispatch starts use operation 20000 and the archived stage availability
and initial state. The timer is durable before the client applies it; retries and
process restarts resume that timer. Acknowledgment requires the corresponding saved
dispatch state. Locked, expired and already-active starts reject without mutations.
Each new received-byte request identity also retains the canonical signed timer.
After the real acknowledgement, an exact retry validates its completion record and
the monotonic dispatch-stage floor, then returns success with no operation. It cannot
restart the timer or redirect to a newer dispatch after the stage is reopened.
Legacy settled identities without that signed capture remain unavailable.
Availability includes the final second, matching the original client. Completion
now queues operation 21000 with the client-derived response shape. Each dispatch has
a durable receipt; reward selection, CP claims, Iris and its operation commit together.
Retries resume the same result, including after a character delta was saved before
acknowledgment. Acknowledgment requires the saved completion date and character CP;
the native deletion of expired stages after 90 days is also accepted. These checks
use synthetic client deltas, not native UI evidence. Neither expedition handler has
been deployed to the emulator.

Friendship11000 and expedition21000 now have **source-only, untested** inventory
receipts using the existing shared acquisition ledger: four original CP item
classes, eight ordinary expedition classes, and the separate casino-medal
branch. Acknowledgment requires saved item gains, not only CP/completion flags;
CP-item expenditure accounts for later gifts. Indexed observed-acquisition
floors persist with save/ACK and retain legitimate spending. Pending/cached and
cold delivery validates receipts without pre-crediting native inventory.
Dispatch Valis now reserves exact float32 quantities from its owned equipped
weapon/armour abilities, replacing the temporary Valis serialization. Source
also captures player XP through the original level999 cap and requires saved
XP/derived level plus the native collection's party deletion before ACK.
Observed XP floors survive split saves/restart. Save replies omit unsafe
redelivery after party deletion without discarding the queue. Actual native
effect/save ordering remains unverified. Level-up SP now has source-only
receipts for the sum of each gained level's original stamina capacity, shared
pending gift/mission/refill targets, XP-coupled save observation and legitimate
later spending. Signed-int32 saturation preserves the XP award even at full
SP. Older unknown SP receipts remain queued without guessed backfills.
Actual native SP totals, regeneration and other producer attribution remain
unfinished/unverified.
Fresh expedition requests now also bind main/assist character multiplicities
and original derived unit levels to saved owned units, using the active saved
hero track for CP. The PC export keeps1341 original character joins and27
explicitly unmapped NPC/debug keys. This reuses the existing unit-progression
calculation; combat-stat totals, role/guest variants and native request/save
ordering remain unverified. Added party/provenance checks are deferred.
Unit base/growth calculations now preserve 1368 original eight-kind base
vectors and 4000 growth rows. Dispatch member checks use the saved derived
level; a shared explicit-component combiner matches native signed arithmetic
and the seven-kind dispatch sum. **Source only, untested:** the remaining
ability/gear/CP/ascension providers are not yet connected, so reported final
combat totals are not independently verified. Deferred `tools/test_pc_status.cjs`
and the consolidated checklist track this separately from route completion.
Missing legacy evidence stays queued for
reconciliation and may block login. See [the reward contract](docs/friendship-reward-contract.md)
and deferred `tools/test_friendship_rewards.cjs`. No new gameplay/emulator tests,
actual-save changes, APK build/install or stability claim.

The expedition export now preserves 227 stages, 334 party conditions, 311 reward
groups/count rows and 697 reward rows. The native success/great-success formula
has isolated checks for empty slots, preferred characters, wildcard reuse and
float32 rounding and now selects completion outcomes. Reward sampling is explicitly
an **offline reconstruction**, not recovered publisher-server behavior: a success
roll precedes a conditional great-success roll; each reward row is independently
sampled at its authored weight per 10,000 for each authored draw, and successful
outcomes also roll the additional group. Weights are not normalized because group
totals vary below and above 10,000. This means the total number of awarded items can
vary from the draw count. Two reward-group fields, passive-based additional-reward
eligibility, party ownership/concurrency, unlock schedules and clear-counter updates
remain unresolved. Inventory/experience application and native UI acceptance are
also unverified. The export now correctly names stage text IDs `stageTextId`; these
are not schedule term-group IDs. CP rewards share the persistent claim ledger with
explicit friendship claims, preventing rewards from being granted twice.

Outfit Refinement (`dress_point/complete`, operation 29000) now uses all 30 original
level thresholds and the original Perseus Brush value. A request converts either
unclaimed battle participation or brushes, never both. Each outfit/level reward
is persisted once, independently of other units. Point changes, Iris, claim records
and the operation commit together; brushes remain reserved until the client's
consumption save. The native operation does not apply outfit points itself, so
the server saves those points on the existing initialized unit before replying.
This preserves the upgrade if a restart loses the original UI callback. Unrelated
unit fields are retained. Boundary, rollback, replay and restart tests pass, but
native response/save ordering and interrupted UI convergence remain unverified;
this handler has not been deployed. Bulk units that do not cross a level boundary
are absent from this request and still rely on ordinary client save deltas.

Event-box inspection and draws (`event_box/show`, `event_box/draw`, operation 15000)
now have an unboosted-round implementation. The export includes 100 original boxes,
1,585 rounds, 40,678 prize rows and the original event-ticket identities. Limited
prizes become unavailable when exhausted; ordinary prizes remain repeatable.
Ticket reservations, prize-count claims and the operation commit atomically.
Retries resume the same untouched draw across restart. After any saved ticket,
counter or inventory effect, save replies omit the additive operation; other
redelivery cancels through recovery until acknowledgment or reconciliation.
The queue and reward entitlement remain intact. Acknowledgment requires saved costs, prize counts and
awarded inventory;
an old save cannot replenish a prize already recorded in the claim ledger.
The client's misleading `totalDrawCount` field counts tickets spent, not prizes.
Probability fields are fractions (the UI multiplies by 100).

Source now continues beyond the former 300-draw stop in all 98 original enabled
box catalogs. The explicit `offline-event-box-v1` policy guarantees the original
unclaimed reset prize after 300 completed draws, honors an imported active boost,
then clears boost on exhaustion and resumes normal weights within the same batch.
This is **not** recovered publisher odds or RNG. Compact SQLite before-state
captures validate choices, rates and flag transitions; an unsaved target flag is
not mistaken for an applied draw. Step-level laps still require reconciliation.
The native saved draw options are 10/50/100, so ordinary batches now accept
up to 100 prizes, including smaller affordable counts; bonus-item boxes retain
the native limit of ten. The same receipt/save path captures the whole batch,
and a missing bulk policy capture cannot be replayed as a legacy draw.
These larger-batch probes are deferred, not native acceptance.
Permanent request identities now retain the received-byte hash and original
draw ID after acknowledgment/cache/login eviction. Exact untouched retries
recover one pending draw. The real ACK now archives that signed operation and
its finalized receipt atomically; an exact settled retry revalidates durable
box/step/prize claims and reward acquisitions, then returns the original popup
with no operation to apply. It cannot spend or grant twice. Partially saved
requests still cancel until the real acknowledgement. New identities may alias
one untouched pending draw, while old identities never redirect to a newer
same-body draw. Missing or damaged legacy identity/archive evidence is retained
for reconciliation, not guessed. These new probes are also deferred.
Native constructors leave `userId: 0`
in the three event-box state tables, so that local default is accepted without
rewriting it; ticket and reward inventory ownership stays strict. Cached pool
views cannot overwrite newer prize depletion or boost state. These new source
changes and their updated probes are not run, built or installed; see
[the event-box contract](docs/event-box-contract.md).

The three original bonus boxes now have source support too. The client replaces
bonus stock with tickets-spent divided by 30 **before** chosen prizes; only a
positive adjustment increases lifetime acquisition. Existing SQLite receipts now
capture that before/after state, require native saved bonus proof, and prevent
other producers or partial replay from duplicating it. This includes spent,
negative, unchanged and capped balances; no bonus is pre-credited or added to the
wire prize list. These probes remain deferred, and the original one-second window
of box `193000095` is not widened. No native acceptance is claimed.

The additive reward ledger records lifetime item-acquisition targets without
pre-crediting the profile. It uses the original item-to-profile mapping, including
dated gacha tickets; spending a prize before acknowledgment does not lose that
proof. Completed targets cannot be removed or overwritten by a pre-award save.
Pending shop, Familia-first, character-present and memoria-item receipts share
acquisition reservations, preventing one saved gain from acknowledging two
recorded sources. Acquisition-counter saturation rejects without spending or
queuing. A legacy pending draw without its original acquisition baseline remains
queued and explicitly requires reconciliation; no baseline is invented.
Missing completed acquisition progress also rejects before a later award is
queued, instead of creating an acknowledgment target the old save cannot reach.

The client's final-repeat reset is a saved `EventBoxReset`, not another network
route. It advances each existing prize row's `lappedCount` by one, clears its
picked count and sets its rate-change state to two; it leaves the step draw
counter unchanged. Unboosted final rounds now use an additive per-prize/per-round
SQLite claim ledger, preserving the legacy first-round history. The save guard
requires the original reset prizes, advances all existing rows together, and
rejects skipped rounds, count rewinds and deletion of prize history. Reset while
a draw reward is still pending remains explicitly unavailable, including a
combined reset/acknowledgment save.

Selection is an **offline reconstruction**: keep each authored weight unchanged
until its limited prize is exhausted, then normalize the remaining weights.
This does not establish the original server's redistribution, guarantees or RNG.
Unrecovered step-level lap state, shared-ticket counters, overlapping bonus/prize pools and unknown
inventory rewards reject explicitly. Historical availability windows are retained; calendar restoration,
publisher rate-change indicators, expired-inventory cleanup and interleavings with
reward sources lacking acquisition receipts remain incomplete. Repeat-round and
reward-acquisition probes cover all eight ordinary pool item types, split saves,
rollback/retry/restart, saturation, legacy pending claims and box/shop overlap in
both issue orders, now also including original box/mission requests sharing a
gacha ticket; these new checks have not been run. Native inventory application
and UI acceptance are not verified, and these handlers are not deployed.

Shooting-minigame completion and rankings now persist a solo daily best, with the
four original character IDs and original playable windows. Today/yesterday follow
the client's UTC+9 clock. Top and around-player views show only the local saved
score, name and existing medals; no opponents or competition prizes are invented.
The first tied score is retained (an offline reconstruction). Client-owned coins,
unlocks and cumulative counters remain ordinary save deltas, not duplicated by
score submission. Score/cache/sequence rollback, restarts, exact retries across
midnight and profile preservation pass isolated tests. Legacy score import,
character/score eligibility, ranking rewards and native UI/save ordering remain
unverified or incomplete. These handlers have not been deployed.

Casino ranking reports persist the client's absolute daily poker-winnings total,
not an additional medal award. Stale reports cannot replace newer totals, and
each accepted transport now has a permanent body/value-bound receipt with its
captured prior daily total. Exact retries remain idempotent after reply-cache
eviction or restart; a changed body cannot reuse the request identity. Reads replay
the bounded daily receipt chain and retain corrupt or disconnected history for
explicit reconciliation. Retries retain their original day across midnight.
Spendable medals and the poker hand still use ordinary client save deltas. The solo board publishes the previous
completed day: this is an **offline reconstruction**, not a recovered publisher
tally rule. It uses the executable's UTC+9 clock despite the archived English
label saying PST. A source-only bootstrap now checkpoints the first exact six-field
`UserCasinoState` observation, including a zero score. A positive score is imported
only when no local ranking history exists; zero state or pre-existing local history
permanently closes the legacy boundary, so a later native poker save cannot be
misclassified as pre-listener history. An imported score's original timestamp owns
the UTC+9 day, and hash-bound observation/import receipts prevent a later save or
clock rewind from being mistaken for more history. An incoming score update closes
or imports that checkpoint before recording the new day. Existing newer per-day reports remain authoritative;
no medals, poker state, operations or native profiles are written. Deferred import,
first-observation, request-receipt, cache-eviction, rollback, corruption and restart cases are written
but have not been run. Score eligibility and native poker/UI acceptance remain
unverified. Not deployed.

Gift claims now use DanMemo's flat `UserGift` record and deliver ordinary items,
stamina and currencies through operation 2000's separate reward fields. The old
handler sent only the gift record, which could mark a gift received without
delivering its contents. Iris, a durable claim ledger, the operation and reply
commit atomically. Retries of a pending gift set return the same operation,
including after expiry or restart; overlapping claims and stale-save reclaims
reject. Acknowledgement requires a saved received state or removal of the gift.
New source-only ordinary-item receipts additionally require the owned saved
lifetime acquisition for every mapped reward before ACK. All23 exported item
profile tables share indexed reservations with other recorded reward sources;
one item increase cannot settle two such awards. No inventory is pre-credited,
and completed acquisition history survives spending/restart. Unknown old item
baselines stay queued and recoverable. The new `test_gift_items.cjs` and updated
gift probes are **written but not run or deployed**; native acceptance and
regeneration remain pending. A separate source-only stamina receipt now requires
owned normal-SP save observation for presents and both archived50-SP missions.
Gift/mission/Iris targets cannot reuse one recorded increase; split saves survive
restart, and later spending remains valid. Unknown old SP receipts cancel with
the queue intact. `test_stamina_rewards.cjs` is added to the deferred batch.
Ordinary and upgraded character presents now also have source-only receipts.
The client uses integer PC IDs versus separate ExPC upgrade objects; duplicates
do not become bonds. Original limit-break5/ascension6 caps,421 eligible ascension
groups and upgraded normal/limit-break board effects bind the saved target.
Ordinary initialization may leave boards lazy; existing real progress is kept.
ACK requires owned characters/boards and gift flags, with permanent indexed
completed-progress floors and mixed-reward transaction rollback. Missing legacy
receipts preserve the queue. `test_gift_characters.cjs` is written but **NOT RUN
or deployed**; native stats/skills/communication effects and unit-source
interleavings remain unverified.
Equipment gifts now also deliver original normal/preset IDs with source-only
shared present/shop receipts. All332 definitions and67 presets retain original
data; duplicate copies merge by native slotIndex, not equipmentId. Distinct saved
piece observations, separate500 weapon/armour capacity and an indexed permanent
piece-to-operation binding prevent preowned or already-delivered pieces settling
another award. Ordinary native saved rarity0 and preset base+evolution are kept
distinct; vacated slots need a new creation identity to prove another delivery.
Split saves survive restart; later recorded-piece sales are allowed. No gear or
signatures are pre-credited. `test_equipment_rewards.cjs` and updated shop checks
are deferred; native gifting/crafting/stats/slot reuse/UI remain unverified.
See [the equipment reward contract](docs/equipment-reward-contract.md).
Costume gifts and shop packs now share source-only permanent unlock receipts.
All394 original definitions and42 costume-linked voices retain original joins;
new outfits unlock their linked voices, while owned outfits do not stack or
reset. ACK requires saved costume/voice unlocks as well as gift/shop flags.
Indexed settled minima reject later deletion/relocking without lifetime scans.
The native lazy constructors leave userId0 in these two profile tables; that
specific original shape is accepted without changing raw saves or other-owner
checks. Mixed costs/rewards/queue/reply stay in the existing transaction.
`test_costume_rewards.cjs` and updated master/gift/shop checks are **NOT RUN or
deployed**. Native wardrobe, audio, outfit selection and original gift provenance
remain unverified. See [the costume reward contract](docs/costume-reward-contract.md).

Video-ad scratch `ad/scratch/draw` now has a source-only reconstructed26100
handler using the archive's one card and six original prizes. Earned saved
tickets, a persisted once-only choice, ticket/card save proof, shared ordinary
item acquisition receipts and permanent request identities replace unsupported
cancellation for that draw branch. Explicit offline uniform/no-replacement and
special-flag reset policies are not publisher odds or algorithm parity.
Type2 ad completion now has a source-only26000 ticket handler and native
six-hour/cap4 viewing allowance, including delayed application, save/ACK proof,
calendar floors and permanent replay identities. Type1 credits the original
daily10-Iris reward under its JST-midnight allowance with durable replay proof.
Native ad SDK/natural earning and grid/animation/Iris acceptance remain incomplete;
gacha scratch18000 is separate. The new probes are
**NOT RUN/built/installed**, and the actual save is untouched. See
[the scratch contract](docs/ad-scratch-contract.md).
See also [the ad-completion contract](docs/ad-view-contract.md).
Gacha scratch now has a **source-only, untested**18000 handler and linked1000
ticket grants using7 original cards,27 stages,160 prizes and22 banner links.
It reuses ordinary reward acquisition reservations and adds durable scratch
receipts, save-before-ACK guards and action-bound retry identities. Original
first-use/count/recurring eligibility and the scratch30-day availability window
are traced; uniform odds and reset/step progression remain explicit offline
policies requiring native acceptance. No APK build/install or actual-save change
has been made. See [the gacha scratch contract](docs/gacha-scratch-contract.md).
Settled scratch-linked lottery replay now also requires the retained server card
floor to match the current saved card and board, and every later linked ticket
grant or scratch draw must form one canonical completed before/after chain from
the original grant to that floor. Later draw rewards are revalidated as part of
the chain. A deleted or fabricated floor, missing/corrupt successor, or client-side
ticket rewind/reforge refuses instead of projecting corrupted scratch state.
Core gacha persistence now has a **source-only, untested** shared character/
duplicate-bond receipt path for regular, ticket, tutorial and shop unit draws.
It removes bond pre-credit, requires owned units/ability boards and saved bond
acquisition, protects tutorial completion flags, and permanently captures each
new draw's exact request, semantic body and signed operation. Charged regular
draws also retain their exact Iris expenditure transaction. An acknowledged
exact retry validates the original units, bonds, tutorial/scratch state and
wallet debit, then returns the result units without another operation while
projecting current validated lottery/ticket/scratch state instead of stale roots; it
cannot reroll, charge or grant twice. Same-bond additive rewards serialize until the draw settles;
indexed character/bond floors retain progress without scanning gacha history.
Ticket draws additionally retain the exact expiring-ticket before/after rows,
event-clock eligibility order and removed indexes. Their real save and ACK advance
an indexed lifetime-spend floor, so stale profile data cannot restore consumed
tickets and a settled retry cannot spend them again.
Legacy settled draws without these captures remain unavailable. Native timing,
result presentation, legacy reconciliation and crash-free play remain unverified.
See [the gacha persistence contract](docs/gacha-persistence-contract.md) and
the deferred `tools/test_gacha_persistence.cjs`; no actual-save change or APK
build/install has been made.
The latest shared acquisition change also requires the native character state
alongside units/boards for stage, gacha, present and mission ACKs. It captures
original owner/state/three friendship baselines, checkpoints split saves and
protects character floors and cached pulls. Checks remain deferred; repeated
communication callbacks, other voice producers and native stability remain incomplete. See
[the shared character-state contract](docs/character-acquisition-contract.md).
Native zero-owner character rows now pass the shared CP/quest/dispatch/profile
checks without rewriting ownership. Save merges retain characterId identity and
reject owner changes; the extended checks remain deferred and unrun.
The common first-PC initializer now captures its original slot76 costume and
requires its actual native save with the unit/boards/character before ACK.
Split saves share existing costume proof and indexed persistent floors; no
native rows or extra wire fields are pre-credited. Original costume defaults,
priorities and voice kind/CP/hero requirements are now in the158-source master;
all prior exported fields are unchanged. `tools/test_pc_costumes.cjs` and shared
regressions remain **deferred/unrun**; this is not emulator stability acceptance.
Communication first-entry now captures original initial costumes, priority default
and eligible voices, with each hero's CP threshold and global owned-costume voices.
Actual split saves reuse existing persistent floors; absent CP, signatures and
owners are not pre-credited or rewritten. `tools/test_communication_wardrobe.cjs`
and updated first-entry checks are **deferred/unrun**. Repeated joined callbacks
and legacy wardrobe-less checkpoints remain gaps.
Friendship-level changes now reuse the same original voice proof through existing
stage/CP-item/dispatch receipts: actual voice saves are required before ACK, with
split-save observations, existing persistent floors and stale-pull protection.
Unchanged levels do not refresh; costume selection and join time remain untouched.
`tools/test_friendship_voices.cjs` and shared regressions are **deferred/unrun**;
CP stats/received flags, other voice producers and native acceptance remain gaps.
CP reward-received saves now use the original rewardId and four typed native
fields. New flags bind to their actual11000/21000 producer; observed owner/time
checkpoints commit with the existing save and cannot be deleted or replayed from
an old pull. Flags alone never acknowledge loot or CP. No flag-save requirement
is invented for native callbacks: production of these flags is still unrecovered.
`tools/test_friendship_received_flags.cjs` and the dispatch extension are
**deferred/unrun**; stat refresh and native acceptance remain incomplete.
The native battle-stat calculator now shares dispatch's recovered components
but applies equipment before percentages and separate HP/MAG scaling. The
original68 growth-dependent gear rows plus1,664 evolution joins extend the
master to160 hashed sources; all prior159 source hashes/values remain unchanged.
The owned gear/modern board provider now supplies ordered weapon/armour bonuses
and the current limit-break panel gate. `tools/test_pc_battle_status.cjs` is
**deferred/unrun**. CP level-up now captures all matching saved owned units,
their stat inputs and actual health/mana baselines in the shared reward receipt.
HP and MP saves are independently checkpointed; mixed callbacks cannot be
acknowledged until both native maxima are saved. No permanent health floor is
introduced: later battle damage and mana spending remain allowed. Old unit,
board, equipment and guest pulls cannot replay stale state. Permanent guests
require their actual ownership EXP. Fresh ordinary stage units now use the
original starting stat inputs before CP is applied, with no fabricated full
save row. Temporary guest providers, full native initialization/signatures
and legacy boards remain incomplete.
`tools/test_friendship_refills.cjs` and the dispatch extension are
**deferred/unrun**. No native gameplay acceptance is claimed.
See [the refill follow-up](docs/friendship-reward-contract.md#latest-ordinary-fresh-unit-cp-refill-stat-initialization-source-only).
Prism Bond Shard exchange now has a **source-only, untested** original
`subscription/ticket/consume`28100 handler for the Adventurer and Assist bonds.
It uses dated shard stock, original3-for1 prices, persistent before/after
receipts, saved acquisition/expenditure checks and durable retry protection.
The general-bond ID and shared dated-shard reward mapping are corrected;
ambiguous old saves are preserved for reconciliation, not rewritten.
Cold login and binary pulls now validate these pending absolute operations too.
The deferred `tools/test_subscription_tickets.cjs` covers the new slice;
native signatures, UI/save ordering, natural shard earning and publisher
subscription services remain unverified or unimplemented. Actual save/APK
remain unchanged. See [the reward contract](docs/gift-reward-contract.md).
Pooled native-string suffix discovery also adds `scratch/draw` and `familia/get`
to the route inventory; the latter remains unsupported and social/co-op work
stays last. Inventory counts are not proof that every route has been found.
See [the present reward
contract](docs/gift-reward-contract.md).
Character/costume quantities other than1, arbitrary gear customization, unknown
costume encodings and raid/Lotto presents remain unsupported. Legacy sparse
operations are preserved and rejected for explicit reconciliation, never silently
upgraded or discarded. Expiry-boundary/cap behavior and native inventory/UI
acceptance beyond the recovered Iris claim remain unverified; the current
start-inclusive/end-exclusive window is an offline policy. The installed reply
also includes the root reward fields required by the native receive popup;
operation-only replies previously crashed on a missing `issueCasinoMedal` number.

Treasure-hunt login bonuses now save their rank, cumulative count and reward gift
atomically before the client's immediate download of `UserLoginBonusExplorer`
and `UserGift`. The archive supplies all three schedules and twelve rewards;
eligibility resets at 04:00 JST, stops at the original cumulative limit, and
excludes the event end timestamp. Same-day retries return the existing rank;
new source-only permanent request receipts bind the exact wire identity to its
original bonus, 04:00-JST day, rank and gift. Exact retries therefore survive
reply-cache eviction, restart and clock movement without rolling or selecting a
later day's claim; changed request reuse and corrupt claim links refuse. The permanent gift
can then be collected through the repaired gift handler, without an immediate
or duplicate Iris award. Restart, rollback, stale-save rejection, all rank-weight
boundaries and gift-claim integration passed earlier desktop tests; the new
request-receipt cases are written but have not been run. Rank-ordered sampling
of the four archived weights and permanent gift delivery are explicit offline
reconstructions. Original enums identify COMPANY sender 1, LOGINBONUS source 2
and PLAYED state 1. The former zero sender/source/playable values were invalid
and caused native C002 on the following launch. Draws now store those valid
values. A ledger-scoped startup repair retains previous rows, pending operation
parameters and cached replies in `legacy_explorer_gift_backup`, without awarding
again or replacing the profile. Historical schedules follow the save's event
clock. MuMu verification recovered Adventure 5 on 2023-02-21, completed pending
claim 45, showed an empty present list and retained 40 free plus 4,026 paid Iris
through a full client/listener restart. SQLite integrity and unchanged wallet/
claim ledgers were checked against the pre-repair backup. This proves the
interrupted Iris claim's recovery, not every inventory reward or future popup.

Character-present rewards now use the original 20 character thresholds and item
IDs. The claim, received flag/date and operation 11100 commit together, with one
item per claim. Pending retries retain the operation; completed retries restore
the claim flag without another award. Acknowledgement requires saved cumulative
item acquisition, even if that consumable has since been used. Window boundaries,
rollback, stale flags and split saves across restart pass desktop tests. The
original 2019 event remains expired; calendar restoration and native verification
are not implemented by this change.
The native callback closes a waiting UI; it does not prove a fresh data pull.
Its unchanged zero timestamp is reconciled with the durable receipt and returned
as corrected save data. Saturated cumulative item counts currently reject rather
than issuing a reward whose application cannot be distinguished from old state.
Each successful character-present reward request now also stores its request key,
exact body hash, character row and original operation alongside that transaction.
That permanent identity allows an exact retry to recover after reply-cache loss,
restart, event expiry or acknowledgement without interpreting changed bytes as a
new claim. A still-pending operation is returned only while its native item save
is genuinely outstanding; an observed or completed operation is not redelivered.
This transport hardening and its deferred cases are source-only and untested.

The three original unit-reward missions now return their archived PC IDs through
operation 6000. New units are initialized by the client, not published as incomplete
roster entries. Already owned units do not produce invented duplicate bonds.
Initialized-save and restart tests pass; native acquisition remains unverified.
PC-bearing reward acknowledgements also require saved achievement claim flags,
including mixed Iris claims where the unit was already owned.

All 30 original memoria mission rewards and ten memoria EXP-item missions now
use their archived IDs. Operation 6000 supplies `{memoriaId, level: 1}` for cards
and ordinary item quantities for EXP books. Saved cards contain `totalExp`, not
a level field. A durable reward baseline prevents an acknowledgement from losing
an existing card's experience, and pending EXP-item claims reserve separate
cumulative targets. Tests cover absent/owned cards, all authored awards, mixed
claims, overlapping requests, split saves, rollback and restart. This is desktop
save evidence, not native inventory/UI verification or full mission completion.

Mission claims now keep permanent indexed completion identities and acquisition
receipts for all 17 mapped ordinary inventory types. Their original native item
classes share the same capped acquisition path. A pending retry matches the exact
completion date and resumes after a split received-flag save. Every non-shop
mission acknowledgement needs its received flag; ordinary item rewards also need
their owned saved inventory and cumulative acquisition. Spending the item is
valid, but completed acquisition history cannot be removed or rewound. Box and
mission rewards reserve separate targets alongside other recorded item producers.
The same completed receipt reconciles a stale claimable flag and its save token;
different dates and reset-in-progress states are not rewritten. This does not
establish original daily/repeat eligibility. Migration uses actual cached/queued
claim identities and explicit existing memoria-EXP baselines only: unknown legacy
item baselines stay queued and unavailable, never guessed or discarded.

`test_achievement_items.cjs` and the updated mission probes are written but
**not run or deployed**. Natural unlocks, native reward/save ordering, direct
stamina/casino rewards, raffle prize draws, union-raid medals, expired-item cleanup
and unrecorded reward-source interleavings remain incomplete or unverified.

Lotto Orario now has a source-only pending ticket view for all11 original events
and ticket-reward mappings for all23 final missions, including their original
multi-ticket quantities. These are server-owned numbered entitlements, not a
fabricated native inventory balance. Indexed number ranges, mission receipts,
mixed rewards, operations and replies commit together. Retries and received
flags cannot remint tickets; missing historical numbers remain recoverable and
are not guessed. Native visual-effect flags are separate from prize entitlement.
The original event clock windows also gate cached reads.

The Lotto details button now has a source-only event-specific page: exact
original dates, saved ticket count/number range and matching ticket-mission
quantities, with missing draw/prize rules clearly labeled. It uses the same
receipt validation as the ticket view; opening details never issues tickets or
grants prizes. Missions are indexed once at startup instead of scanning the full
original table per notice. Cached expiry and unknown-history recovery are also
covered by written, deferred probes; native webview acceptance is still pending.

Consecutive numbers and a4096-ticket display ceiling are explicit offline
policies, not original lottery RNG or caps. **Winning draws, odds, prize amounts
and settlement remain unimplemented**; GET uses the native no-applicable-result
sentinel with a false effect flag for a pending-only view. Historical labels/art,
native ticket/result rendering, natural mission eligibility and save ordering
still need verification. See [the Lotto contract](docs/takarakuji-offline-policy.md).
`test_takarakuji.cjs` and the updated master probes are **not run or deployed**.

Casino-medal mission and present rewards now share permanent indexed acquisition
receipts. The original client applies these through `UserCasinoState`, not an
ordinary currency row, and caps current/lifetime medals at 99,999,999,999. Separate
pending rewards reserve distinct lifetime targets without pre-crediting medals.
Acknowledgement needs the owned saved counter; spending medals remains valid,
while completed acquisition rewinds/deletion and saturating rewards reject. The
mixed Iris reward, receipt, queue and reply stay within the existing transaction.
Legacy claims with unknown acquisition baselines stay queued for reconciliation.
`test_casino_rewards.cjs` and the updated gift checks are **not run or deployed**;
native delivery, poker/shop interleavings and natural mission progress remain
unverified. Timed stamina recovery is not treated as an ordinary item counter.

```powershell
node tools/test_master_data.cjs
node tools/test_danmemore_server.cjs
node tools/test_stage_persistence.cjs
node tools/test_stage_units.cjs
node tools/test_ability_panels.cjs
node tools/test_offline_recovery.cjs
node tools/test_lottery.cjs
node tools/test_friendship.cjs
node tools/test_friendship_rewards.cjs
node tools/test_pc_status.cjs
node tools/test_expedition.cjs
node tools/test_dress_points.cjs
node tools/test_event_boxes.cjs
node tools/test_shooting.cjs
node tools/test_casino_ranking.cjs
node tools/test_casino_rewards.cjs
node tools/test_gifts.cjs
node tools/test_gift_items.cjs
node tools/test_gift_characters.cjs
node tools/test_equipment_rewards.cjs
node tools/test_costume_rewards.cjs
node tools/test_pc_costumes.cjs
node tools/test_communication_wardrobe.cjs
node tools/test_friendship_voices.cjs
node tools/test_ad_scratch.cjs
node tools/test_ad_views.cjs
node tools/test_stamina_rewards.cjs
node tools/test_present_recovery.cjs
node tools/test_login_explorer.cjs
node tools/test_character_present.cjs
node tools/test_achievement_units.cjs
node tools/test_achievement_items.cjs
node tools/test_takarakuji.cjs
node tools/test_memoria_rewards.cjs
node tools/test_friends.cjs
node tools/test_familia.cjs
node tools/test_familia_break.cjs
node tools/test_familia_first_reward.cjs
node tools/test_familia_donation.cjs
node tools/test_familia_valis.cjs
node tools/test_familia_achievements.cjs
node tools/test_familia_skills.cjs
node tools/test_familia_board.cjs
node tools/test_votes.cjs
node tools/test_shop.cjs
node tools/test_offline_iris.cjs
node tools/test_repair_tutorial.cjs
node tools/audit_protocols.cjs
node tools/packet_test_plan.cjs
```

`data/danmemore-protocol-audit.json` lists every statically discovered route,
native wrapper addresses and remaining gaps. Partial does **not** mean the feature
is complete: gacha special rules and native acceptance remain unverified,
and many social, event and competitive branches remain partial or unsupported.
Stage-result acknowledgements now require the saved lifetime clear count,
completion dates and earned objective flags. A bare acknowledgement previously
removed the pending result even when none of those changes had been saved; a
focused test reproduced that loss before the fix. Both combined save/ack and
split requests across restart are supported, without tying lifetime completion
to the daily counter. The existing SQLite transaction preserves the pending
result when saving, recording the acknowledgement, deleting the queue entry or
writing the reply fails. Invalid saved counter/date baselines reject before
awarding currency. Legacy operations without a matching completion receipt are
retained for reconciliation. These checks prove clear/objective persistence,
not every inventory, unit, experience or unlock delta, and are not yet verified
in the native client.
Union Raid `skill/get` now consumes the exact `unionRaidInfoId` request and
projects durable current-Familia invested-medal progress through the final
15.1.0 nine-group, 450-level skill catalog. Fresh progress is an empty vector;
persisted rows select the highest reached original cumulative threshold, retain
partial progress below level 1, and invalidate stale cached reads. The deferred
Union Raid status probe covers fresh, persisted, duplicate-threshold, corrupt,
cache and restart cases, but has not been run.

Union Raid `skill/growth` now captures a real positive investment from existing
valid saved Alliance Medals, updates current-Familia skill progress, and returns
the original `userMedalAmount` / `unionRaidSkill.medalAmount` callback fields.
SQLite commits the permanent request, investment, spending checkpoint, sequence,
and reply together. The native medal row is updated by the client; saving that
exact debit closes the checkpoint. Pending retries survive cache loss/restart,
and restored balances or investment progress refuse. An exact settled retry now
validates its current receipt chain and latest saved medal checkpoint, then
returns the current saved medal balance and current group progress. Native
callback `0x24491f4` compares that balance with its request-time stock; equality
skips the amount setter and both spending/contribution events while still
finishing the callback. This recovers a lost response without a second debit,
including after later fully saved investments, Medal Presents, or type-35
achievement rewards. A newer unsaved debit or unacknowledged medal reward still
refuses because the client's current stock cannot safely be reconstructed.
The 14 archived `union_medal_item.1` missions now issue their exact original
quantity through native operation6000, capture the complete before/after medal
row, support flag-first or inventory-first persistence, selectively recover the
unsaved effect after restart, and require both effects before ACK. The server
does not precredit medals. Deferred skill, Present and achievement-medal cases
cover these branches but have not been run. Natural peer-qualified mission
eligibility, native UI/save order, and applied combat effects remain unfinished
or unverified.

The Union Raid training parser now admits the original large Adventure stage ID,
and a validated zero-medal initializer row no longer blocks untouched status or
entry. Scored completion telemetry now uses the shared original raid codec before
the unavailable-settlement recovery path. Deferred cases are written but unrun.
The `battle/log` response contract is recovered; populated attack records come
only from acknowledged scored completion, so the route remains source-only and
unverified rather than fabricating history.

Union Raid's first available status also causes the original client to create an
owned five-field information row. That zero-defeat initializer and its viewed-record
timestamp now remain valid through lobby/entry/training instead of being rejected
as earned progress. Native saves use the exact event identity and the existing atomic
profile/token/save/reply transaction, preserving owner, alliance and defeat counters;
view timestamps do not grant score. Deferred initialization/view/restart/rollback
cases are written only. Scored settlement and the training-clear/save handoff have
later source-only implementations described below; native acceptance remains unfinished.
The saved audit now includes its previously omitted, existing
`gvg/tournament/get` partial route; this is not new gameplay acceptance.

Zero-reward first-stage Union Raid practice now issues the original signed `5000`
clear consumer as an explicit offline compatibility policy, not recovered publisher
training wire parity. The request, command, before-stage/battle/Familia and response
are captured atomically. Acknowledgement requires the actual saved clear and owned
active battle's stage ID becoming zero. Split-save observations and existing cold
counter/date controls retain replay protection; an indexed acknowledged practice
record allows re-entry. Older bare replies are preserved and guarded, not converted
into invented completion proof. No shared raid HP, score, medals, XP, loot or activity
contribution is granted. The extended completion cases are WRITTEN ONLY / NOT RUN;
native result/back/save order, recovery, signatures and no-crash/freezing acceptance
remain unverified. This is an extension of partial routes, not a completed raid mode.

Union Raid member ranking now accepts the exact original event and ranking types
1, 2 and 3. Type 1 publishes a local rank only when acknowledged scored-battle
rows sum exactly to the persisted Familia score, using the latest immutable
player/leader snapshot. Type 3 publishes the current local member at rank 1 from
the exact Medal amounts in durable, validated `skill/growth` receipts for the
current event and Familia generation; imported or synthetic skill progress is
not counted. The final original message table labels the three categories Total,
Monster, and Medal and defines Medal Score as medals used during Alliance upgrade
(SHA-256 `a5814e507ed34a86886336f396d99a14e3bc47173891a492ce39d9dfe72760a5`,
rows 40630016-40630018 and 40630147-40630148). Zero totals and the currently
unproducible type-2 Monster category remain honest empty lists. Cached responses
are revalidated against current battle, growth-receipt and member history. No peer
or publisher standings are fabricated. Deferred source cases are written but
unrun; native tabs, details, back navigation and stability remain unverified.

Scored Union Raid boss defeats now carry their original defeat-count prizes in
operation `30000`'s `gainedServerItems.items` channel. The final client archive
contains one information-to-group link and 44 exact reward rows covering defeat
counts 1 through 21. Each issued result permanently captures that source, its
ordered reward list, and per-item SQLite acquisition targets. Partial native
inventory saves suppress command redelivery, cannot be rewound, and cannot be
acknowledged until every target and the battle clear are actually saved. Older
already-issued empty scored receipts remain valid legacy captures and are not
retroactively granted items. `union_raid/reward/defeat` remains the native
bodyless acknowledgement callback rather than a second reward producer. The
ordinary saturated-stock branch also binds the original amount, cumulative
counter and signature to the issued operation. Saturated Valis additionally
captures the exact predecessor Familia spending floor and advances that ledger
atomically with its reward observation; missing, malformed or foreign lineage
remains guarded. The decoder,
deferred source cases, and consolidated checklist are updated but not run; no
build, listener, APK, emulator, or native stability acceptance has been performed
during the packet-only phase.

Exact `union_raid/stage/complete` retries now also retain the result screen
after the original practice5000 or scored30000 command has been saved and
acknowledged. The settled path reconstructs only the permanently captured
command, requires its exclusive done state, current Familia generation, saved
stage clear, battle reset and current training/scored progress checkpoint, and
returns the original result roots with an empty operation list. It therefore
cannot clear, score or grant twice. An older result after later Union Raid
progress, a changed Familia, missing floor, active battle, pending command or
damaged capture remains unavailable. Deferred practice and scored replay cases
are written only; native result/back behavior and save order remain unverified.

Acknowledged Union Raid defeats now continue into the next battle instead of
being forced back through a defeat-count-zero entry. `status/get` validates the
entire ordered current-Familia scored history against the persisted progress
pointer and emits native `displayDefeatInfo` stage/loop rows only for real
acknowledged defeats newer than `UserUnionRaidInformation.readDefeatCount`.
`status/preinitiation` accepts that exact current defeat count and can replace a
consumed entry only when its one attempt debit has one exclusively acknowledged
scored result matching the current stage. An unused stale entry still cannot
skip forward, and an unsettled consumed attempt cannot be overwritten. Deferred
mapping and progression cases are written but unrun; native defeat animation,
second-loop entry/save behavior, stability, and publisher battle/result bonus
semantics remain unverified.

Union Raid `status/log` now publishes the seven source-proven Familia total-score
milestones instead of remaining permanently empty. The final 15.1.0 log tables
contain one group and 28 rows; the type-1 rows cover 500,000 through 10,000,000
total score, while types 2-4 require an enemy label. Each new scored completion
captures the Familia name and god alongside its immutable before/after score.
The log response uses the first acknowledged receipt that crossed each type-1
threshold and its original completion time, with newest entries first. Missing
snapshots, discontinuous score history, or a changed source catalog refuse
instead of relabeling current Familia settings as historical data. Enemy-specific
types remain unimplemented until their score producer is recovered. Decoder and
deferred cases were updated but not run; native log rendering/back/stability is
still unverified.

The current inventory is **176 partial and 0 unsupported routes** across 176
tracked routes, with zero claimed feature-complete routes. The 15.1.0 completion switch at `0x24731b4`
selects seven additional endpoints through a relocated table, so direct string
references alone previously undercounted PvE, PvB, GvE, guild-event, guild-raid,
element-event and union-raid completion. The scanner now verifies that switch
and records its adventure-mode mapping in `data/danmemore-client-contracts.json`.
Other indirect calls may still remain undiscovered.

Acknowledged friendship completion now has permanent source-only request replay.
Each new `character/friendship/complete` identity retains its exact received bytes,
semantic point/item request and canonical signed operation11000. Pending retries
return only that live reward. After the real save and acknowledgement, the exact
request must prove its exclusive done state, original point and optional CP-item
debit, character/unlock floors, voices, HP/MP refills and every item acquisition;
it then returns the original popup fields without another operation. Optional
independently saved CP reward flags remain protected but are not fabricated as a
mandatory callback effect. Changed requests, missing captures or lost effects
remain errors rather than spending or granting twice. Deferred pending, settled,
corruption and rollback cases are written only; nothing was run or deployed.

Acknowledged Outfit Refinement now has permanent source-only request replay.
Every newly issued `dress_point/complete` identity retains its exact received
bytes, semantic point/item request, canonical signed operation29000, original DP
reward pairs and immutable Iris journal identity. Pending retries return only the
live operation. After the real save and acknowledgement, the exact request must
prove its exclusive done state, point targets and permanent-PC floors, original
reward claims and Iris transaction, plus any brush expenditure. It then returns
the original popup fields without another operation, so it cannot apply points,
Iris or brushes twice. Corrupt captures, journal balances, floors or expenditure
remain errors. Deferred pending, settled, corruption, restart and rollback cases
are written only; nothing was run, deployed, installed or accepted in MuMu.

Acknowledged dispatch collection now has permanent source-only request replay.
The exact original `expedition/complete` identity is restored from its retained
canonical operation21000 and must prove the exclusive done state plus the
original party/timer receipt, saved party removal, XP/SP and peer-stage floors,
friendship, quest, voice and refill observations, every item acquisition floor
and any casino acquisition. A valid settled retry returns the original result
fields with no operation, so it cannot grant rewards twice or redirect an old
request to a later run on the same stage. Missing or inconsistent evidence is
retained as an error rather than inferred from current state. Deferred pending,
settled, corruption and later-run cases are written only; nothing was run,
deployed, installed or accepted in MuMu.

Interrupted dispatch collection now has source-only recovery for selected/peer
expedition-stage broadcasts. Exact durable observations for every affected row
derive one private client marker and skip the already-saved stage-finish pair.
A mixed saved/unsaved prefix instead replays the original broadcast only when
the exact transition model proves that it touches no foreign row, leaves every
saved claim unchanged and reaches every unsaved claim's captured target. Unsafe
prefixes, including a saved peer counter that would increment twice, still
refuse. Expiry cleanup, remaining rewards, native save/signature and the real
operation acknowledgement stay original. Deferred server and native-contract
cases are written but have not been run, built, installed or accepted in MuMu.

Repeated non-dated dispatch item rows now have an exact interruption path.
Uncapped rows use their saved cumulative delta. Captured numeric capped rows
must match both the clamped lifetime counter and captured stock addition for an
exact prefix of original native row quantities; capped Valis is not considered
complete merely because lifetime saturated. Recovery omits only those row
indices, and Valis uses the original per-row float32 multiplier. Fractional,
reordered, dated or foreign values still refuse. This composes with observed
party deletion by projecting only the remaining Valis rows. Original and
earlier exact-prefix cached envelopes can monotonically rebind to the current
prefix or fully saved item state. This remains source-only and untested.

Pending expedition results are also delivered in capture order. A later
operation21000 may have inventory baselines that already reserve rewards from
an earlier unacknowledged result, so login/pull/confirm expose only the oldest
callback and a direct retry of the later completion refuses without mutation.
Only the client's real durable acknowledgement removes that predecessor; the
next callback is then derived against the newly current saved inventory. This
is source-only and untested, with no virtual inventory credit or queue rewrite.

A fully saved dispatch CP-level crossing can now resume as well, but only when
that character's originally captured quest unlocks, communication voices and
required unit HP/MP refills are also durably present. In a multi-character
callback, another character may remain at its exact captured baseline; replay
skips the completed setter fanout and still runs the untouched character's
original crossing in wire order. Effect ownership follows the original quest
label, communication identity/global costume refresh and unit character. A
points-only or partially saved crossing now derives a private marker on only
that character's dispatch row. The ARM64 caller gate accepts it only from
operation21000 and re-enters the original quest/voice/refill fanout without
rewriting the already-saved points. Every refill field must still be exactly
its captured before or final value; foreign effects, initializers, later points
and malformed or misplaced markers refuse. Completed fanouts drop an older
cached marker monotonically. This remains source-only and untested.

Non-Iris friendship operation11000 now has a bounded interruption path for
stat fanout, ordinary reward items and optional CP-item requests. Original handler
`23eb274:23eb9bc` debits the optional item before Iris, ordinary rewards and
friendship setters. Its shared setter returns at `23eb7d0` with the current row
at caller SP+10. One ARM64 adapter re-enters the original fanout only for
`offlineFriendshipCpLevelPending:1`; a separate marker-aware debit adapter skips
only the original item block for `offlineFriendshipItemApplied:1`. The server
derives that debit marker only from the retained acquisition-minus-stock proof,
and otherwise requires the exact untouched captured item baseline. Because the
current issuer aggregates CP rewards to one wire row per item, while retained
legacy operations may contain several positive rows for the same item. Exact
uncapped cumulative progress, or captured capped stock/lifetime/signature
progress, may omit only one complete ordered row prefix; a complete acquisition
omits every matching row. Dated and ambiguous partial shapes still refuse. A
later reserved producer for the same item also blocks attribution.
Exact points, unchanged active hero and captured before-or-final HP/MP
remain mandatory. Completed fanouts remove stale row markers; saved reward rows
stay omitted and a saved debit remains marked until the real ACK. Positive Iris
is also retained after its amount is rederived from the operation-bound original
type-5 CP rewards: the native branch posts only the existing header-refresh
notification, while the authoritative wallet was credited once at issuance.
Recovery never credits it again. Source and deferred fixtures were updated but
not run, built or installed.

Legacy casino-reward receipts without a before-stock snapshot now have one
bounded recovery path across Presents2000, missions6000 and dispatch21000: the
saved lifetime-medal counter must equal the receipt's target exactly and the
native inventory signature must equal that queued operation's signature. Earlier
receipts in one strictly increasing, contiguous all-v0 queue prefix may use its
last exact target/signature as their ordered witness, matching the client's
ordered cold-operation processor. Gaps, saturation, mixed partial captures and
foreign signatures remain ambiguous and refuse. Supported cases omit only the
already-applied medal field or row; the same proof gates later reward reservation
and the real client ACK.

Ordinary completion now rejects special-mode stages before issuing rewards.
The mode follows stage -> episode -> adventure; it is **not** the stage's own
battle/story `type`. The two-unit boss `1090006801129` remains an ordinary
completion (adventure mode 9), whereas `1120000901101` uses PvE mode 12.
All 21,524 stages now retain the parent `adventureType` from those original
archive tables. PvE completion now implements operation16000, durable historical
party snapshots, once-only original rank prizes, and indexed latest/best local
records. ACK guards require the real saved clear, score and inventory acquisitions;
lower repeats do not replace the best party. The two history routes emit the
native root-player-object shape, not the shooting/casino ranking array, and show
only the actual local player.

The archive's36 score tables retain original float32 rank thresholds and rewards,
including special Falna S prizes. The publisher bonus formula remains unrecovered:
the implementation uses the explicitly documented [offline-quality-v1 policy](docs/pve-offline-policy.md),
not guessed meanings for unidentified master fields. The186 earlier mode12 stages
without score tables receive no invented ranks or rank prizes. Defeat handling,
natural availability and publisher scoring parity remain unresolved. Source syntax
and local data export were checked; the new logical/native probes have **not** been
run and this implementation is **not deployed**. See `tools/test_pve.cjs`, updated
master-data checks and the consolidated packet checklist for the deferred batch.

Record Buster completion now has its separate native operation19000 handler for
all942 original stages across152 events. SQLite retains event-keyed high scores,
clear/objective receipts, once-only original objective Iris, interrupted results
and completed-state guards. It does not pre-credit the native save or invent
leaderboard neighbours/prizes. The explicitly documented
[offline-pvb-v1 reconstruction](docs/pvb-offline-policy.md) uses original raw
stage/survival values; publisher arithmetic and cutoff meanings remain unproven.
Later-period mission scores preserve the recorded high. All six Record Buster
view routes now have source handlers: summary, group/total/friend rankings,
main/assist character usage and local player details. An indexed acknowledged
best capture supplies the actual local score/portrait and matching native party;
lower/tied runs do not replace it. This is an explicitly solo-offline board,
not restored publisher ranks or prizes. Missing legacy history, mismatched or
absent historical parties, remote players/social records and unsupported badge
mapping recover unavailable without inventing data. Original grade artwork and
communication-character links are exported. Native party freshness, screen
entry/playability and result/profile ordering are **not** certified. New
logical/native checks remain deferred; this source slice is not deployed.

PvB repeat clears may now start in the same event-clock second as their previous
clear. The private result receipt records that issue second, so an exact
count-prefix can resume without treating an unchanged `lastCompleteDateTime` as
independent completion proof. Equality is accepted only by the real ACK for that
captured operation; legacy/null or mismatched issue times remain unavailable.
This source path and its deferred fixture are **NOT RUN or deployed**.

Regenerate and check the client-derived contracts with the local original binary
and route-candidate list (both intentionally outside Git):

```powershell
python tools/inventory_client_routes.py .work/arm64-original/lib/arm64-v8a/libapp.so .work/api-route-candidates.txt .work/client-route-functions.json --contracts data/danmemore-client-contracts.json
python tools/test_client_routes.py
node tools/audit_protocols.cjs
```

Android packet tests use a disposable profile; they do not prove native gameplay
acceptance.

`data/danmemore-user-tables.json` records the original client's container format
for all 147 saved tables: 19 singleton objects and 128 lists. SQLite keeps row
arrays internally, while pulls serialize populated singletons as objects. Updates
replace singleton rows even when a foreign ID changes. Legacy duplicate singleton
rows are retained in `legacy_singleton_backup` before selecting the last snapshot.
Startup also restores the required Hestia home entry and starter assist if absent,
preserving existing costume choices and interaction counts. The native result
screen uses this assist when the party has none; omitting it caused a null lookup
after an otherwise saved stage clear. Battle 1-2, interrupted-stage resume, the
result screen, and return to stage selection have been verified on MuMu.
Story-only completion's three-field request is also supported: Story 1-3 was
visually verified awarding five Iris and updating the displayed balance.
Boss 1-4 then awarded five first-clear Iris and two earned objective Iris (not
the failed no-loss objective), reached rank 3, and displayed CP level 2 rewards.

The background `achievement/familia/add` stamina activity (401) is persisted once
per Japanese calendar day, matching the native date marker. It no longer blocks
ordinary stage entry with communication error 1003. The home progress route uses
its actual local occurrence for cooperative daily missions; remote guild
aggregation, cooperative rewards and other activity types remain unsupported.

The legacy repeated-tutorial save accumulated more than three owned PCs while
leaving the tutorial unfinished. The original client then returns before sending
another draw, leaving the confirmation UI busy. `tools/repair_tutorial.cjs` is an
explicit, guarded repair for that state, with a mandatory SQLite backup. It uses
the original `tutorial.gacha_end` completion targets and retains every owned unit.
Do not run it against a live profile; stop both game and listener first. Repair
tests do not substitute for native tutorial, town and restart verification.
