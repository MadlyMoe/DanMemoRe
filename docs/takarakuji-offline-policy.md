# Lotto Orario ticket, result and payout contract

## Current offline result and surviving-prize payout — source only, untested

`takarakuji/get` now publishes a deterministic result after a local draw
boundary, freezes the exact numbered ticket set and stores the complete result
in SQLite. Seasons 2 and 11 use the two recovered dated announcements; the
other seasons use the explicitly reconstructed boundary fourteen days before
their authored event end. Season 1 has eight ranks and the remaining seasons
have six. The rank generator is `offline-geometric-v1`: it preserves the
observed lowest-rank-heavy shape, but is not claimed to reproduce publisher
winning numbers or odds.

Published results permit the native `playResultEffect=true` save and retain the
existing visual-state 1→2→3 checkpoint. Request replays keep their exact older
pending or published snapshots; a fresh request observes the current saved
effect flag. Ticket producers refuse new ranges after publication.

For seasons 1–4 and 11, every ticket rank is expanded through the exact
surviving `giftContent` item/quantity rows. Equal items are aggregated, native
quantity-sized chunks are created as permanent Ranking Presents, and indexed
result/catalog/gift/claim receipts make production and ordinary `2000` Present
claiming once-only across restart, cache loss and clock rewind. Seasons 5–10
have no surviving prize-content rows in the final archive, so they publish
their local ticket ranks but do not fabricate a payout from another season.

Deferred result, rollback, immutable replay, effect-save and payout-Present
cases are written in `tools/test_takarakuji.cjs`; none were executed. Native
result animation, Present rendering/save order and crash-free MuMu behavior
remain unverified.

## Historical pending-view request identity — superseded for fresh post-draw requests

Each new `takarakuji/get` request now records its received identity, actual
encrypted-body MD5, event ID and exact JSON response in a permanent primary-key
row. The row commits atomically with the pending-event marker, sequence and
ordinary reply cache. An exact replay after cache eviction or restart returns
the original ticket prefix, while a fresh request may include later genuine
mission or Present ticket receipts. Replay still validates the live permanent
ticket history and original active window; changed routes, corrupt responses,
missing legacy identities and missing or altered ticket ranges cancel without
changing the player save. This was the earlier pending-only boundary. Fresh
post-draw requests now use the result contract above; exact old request
identities still replay their captured pending snapshot.

Deferred cases cover permanent-row/reply rollback, restart, later ticket growth,
cross-route identity reuse and corrupt or legacy snapshots. They have not run.
Publisher winning numbers and exact odds remain unrecovered, and native
result/save ordering is still unverified.

## Pending receipt reader — source only, untested

Ticket reads now reuse the shared parsed pending-operation rows. A malformed
`receivedItems` shape or a receipt whose pending operation no longer has its
exact ticket item/amount cancels with the existing recoverable unavailable
response; it cannot throw from a second raw JSON parse or erase the operation,
issued range, or saved profile. The deferred Lotto case covers malformed list
shapes. No test, build, listener or emulator run accompanied this change.

## Original prize-content rows — source only, untested

The final archive also contains `gift.enc` (SHA-256
`fcc1856e41447b9ba79bc8c88d7e396f095f6519f095cfc565724eebf35c95c0`)
and `giftContent.enc` (SHA-256
`02d2160c462309da1451470f7095d566beb6ce73f4482b4137ab5ae68c3e0ce6`).
Their 33 gift headings and 82 content rows include complete rank-item quantities
for Lotto seasons 1–4. Content rows for season 11's six ranks also survive,
but its corresponding `gift` headings do not. No prize-content rows for seasons
5–10 were found in those final tables. These source rows are transcribed into
`data/danmemore-lotto-prizes.json`, and the Lotto `notice/show` page now displays
them with original item keys. Missing seasons are explicitly labeled missing.
The deferred master-data case compares every transcribed item and quantity
against the encrypted archive; the deferred Lotto case checks the page for
all eleven seasons. Neither case has run on this revision.

The archived rows now drive only the once-only payout described above after a
locally published result. Merely viewing Details still does not produce or
claim a Present. Existing player saves, listener and emulator were not touched.

Latest source follow-up on 2026-10-07: native three-field Lotto rows and saved
visual-effect checkpoints are implemented, **DEFERRED / NOT RUN**. No checks,
build, installation, listener restart or emulator use accompanies this change.
Native raffle acceptance remains pending; this historical paragraph predates
the current local result policy.

## Historical catalog/export evidence, not latest-source acceptance

Partial catalog support was verified on the earlier server/master revision
identified below. The shared decoder already read the eleven
original ticket definitions but omitted `takarakujiItems` from its returned
export. Adding that existing value fixes the missing-catalog cancellation in
`takarakuji/get`, Lotto `notice/show`, mission6000 and present2000 receipts.
Every previous exported field and all161 source hashes remain unchanged; no
ordinary inventory class, native grant, guessed prize or schema is added.

Full `test_takarakuji.cjs`, `test_master_data.cjs`, `test_achievement_time_bonus.cjs`,
`test_achievement_transport.cjs`, `test_stamina_rewards.cjs`,
`test_offline_recovery.cjs` and `test_launcher_lifecycle.cjs` reach final success
and exit0 on that earlier export/revision. The master fixture now expects original Hestia
character101000027, not101000005; the two foreign/deleted-player stamina ACK
fixtures expect the unchanged shared owned-player cancellation503/3000999,
not400. One earlier stamina process exited1 without final output; subsequent
traced and regular full runs passed. That intermittent process failure and
earlier Windows fatal failures remain unresolved, not stability passes.

Local offline Gradle build/install and pulled APK match
`3d2ec7248b40026d2445a5667705dca6c565edeb124b310a29ffe061d0df848f`;
packaged and running master match
`fdcd44c7f379e82ed0092682d89b6a49aea8dc1285c14120d5df0bfdb5f95970`.
Server remains `624efcdca775f426f6706ccf3fb7f35ba1febbbfef20109194671b94f80b0a4b`;
all seven runtime modules match source. Protected test Adventure16/eb8b83ee
stays on2019-10-18: no original raffle is active then, so no clock change or
ticket injection was used. Normal title/town/Guild/back render with rank3,
SP109 and Valis51020; the already-received noon bonus remains absent. A stopped
read-only test-save copy verifies integrityok, queue0, retained ACK18/19,
one noon claim/state4, EXP721 and no raffle ticket receipt. These are startup
and persistence checks, **not native Lotto screen/popup/result acceptance**.
Normal Tools Stop leaves no game PID/listener28766. Adventure5 next-launch
metadata/date2022-08-20 restored; its database was never read/opened/launched.

## Recovered original contract

The original 15.1.0 ARM64 library has SHA-256
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
Addresses below are raw library addresses, not Ghidra's additional `0x100000`
image bias. The final archive supplies:

- Eleven `takarakujiInfo` rows, IDs56000000001..56000000011: title, start/end
  timestamps and matching ticket item218000001..218000011.
- Eleven `takarakujiItem` rows, keys`takarakuji_item.takarakuji1`..11: original
  name and description. Both encrypted source files and their hashes/counts
  are retained in the normal gameplay metadata export.
- Twenty-three final `achievement` rows with rewardType18, covering seasons6..11
  and original quantities1,3,4,5,6,7. Their quantities are not all one ticket.
  Earlier seasons have event/ticket metadata but no recovered final mission
  awards from these23 rows; no earlier mission is invented.

Request wrapper25af544 sends exactly`{takarakujiInfoId}`. Callback25afd38 consumes:

```json
{
  "code": 0,
  "UserTakarakujiInfo": {
    "userId": 1000000001,
    "takarakujiInfoId": 56000000011,
    "playResultEffect": false
  },
  "player": { "prize": 99999999 },
  "tickets": [
    {
      "userId": 1000000001,
      "takarakujiInfoId": 56000000011,
      "number": 1,
      "prize": 99999999
    }
  ]
}
```

This is a shape/pending-policy example, **not an original publisher packet**.
User/event IDs are native int64; number/prize are int32; the effect flag is a
boolean. Repo25af1a4 initializes player.prize to99999999. UI1cba4c8 treats that
sentinel as no applicable prize effect;1c888d4 explicitly counts ticket prize
categories1..5 plus99999999, so the sentinel is not an arbitrary array index.
`player.prize` is a prize category, not an Iris amount. Actual labels, pending
presentation, ticket cells and result effects still need the native batch.

Availability25aeca8 reads the original start/end and calls2a3a5dc:
start-inclusive, end-exclusive. The same gate applies before replaying a cached
GET. Original event identifiers must not be confused with ticket item IDs.

DomainTakarakujiItem vtable42c3578 is not ordinary inventory: getter25ae5e8
returns1, while balance/reservation/acquisition getters return0 and setters
return without storing anything. Consequently, these IDs stay **outside**
`master.items` and ordinary `itemProfiles`. A fabricated native ticket-balance
or cumulative-acquisition row would not prove an award.

The present2000 ordinary-item loop248cbb8 resolves each received item through
generic repository24d9160/lookup24e3a5c, then calls vtable+50. Repository refresh
24d92e8 imports the original raffle-item repository25aca54/vector25ad08c and
registers those items by their actual int32 IDs through24df83c. That repository
loads the takarakujiItem table via29b8268/29a5138; constructor25add14 installs
42c3578. Its inherited changeAmount24d8844 calls the balance and cumulative
setters, but those raffle setters return without storing a balance. This is
the same real item path as mission awards, not an invented native inventory
class. The gift receive flag remains a separate2494810 state1 mutation.

UserTakarakujiInfo MessagePack reader28075d4 consumes userId, takarakujiInfoId,
playResultEffect. UserTakarakujiresultState reader28077f0 consumes the same
identities and state. Domain25aea6c creates visual state1;1cbb978 sets2 and
1cbbf7c/1cba4c8 set3 and trigger`TakarakujiStateUpdate`. These are display-effect
states, **not prize/payment authorization**. State3 can also finish a
no-applicable-prize effect; it must not be equated with an Iris acquisition.
Native zero-reference default rows remain valid but are not published as an
authored ticket event; unknown nonzero references or foreign ownership reject.
Validator281c328 uses the three-byte enum vector initialized at138e950 with
values1,2,3; zero is not an allowed visual enum merely because the reference
field may be zero.

## Saved visual-effect checkpoints — source only, checks deferred

The shared read/save guard now requires exactly the original three fields in
each Info or result-State row. Neither reader includes `signature`; the old
fixtures' extra field was removed. Owned, unique original event references and
native boolean/1..3 values are checked even without any ticket receipt. The
default zero reference remains permitted, not a new authored event.

Actual native PUTs advancing an original event to state2 or3 retain their
highest state in `takarakuji_effect_floor`, one indexed row per original event.
This commits with the native profile and existing sequence/reply transaction;
it cannot retain half a save after a failed reply. Ordered PUT observations
also reject3->2 within a single save. Existing pending-event permission is
still required to advance; no server operation, ACK or prize is invented.

Fresh and cached reads, login, confirm and saves enforce the retained floor
even if a damaged profile keeps its old token. Missing/rewound/malformed rows
cancel with data preserved. Restart or event expiry does not erase a captured
state. Unused state1/default-row cleanup remains separate from actual effect
progress and ticket entitlements. Startup never backfills checkpoints from
imported native rows or rewrites a profile.

`test_takarakuji.cjs` now contains deferred vectors for exact field shapes,
ordered saves, insert/update/reply rollback, restart/expiry, raw same-token
profile corruption, cold/cached cancellation and corrupt checkpoints. None
were run. These display states still do not establish winnings, Iris credit,
result publication or signed native acceptance.

## Implemented offline ticket policy

Mission6000 continues to use original receivedItems entries and received mission
flags. The server additionally owns actual ticket entitlements:

- Indexed `takarakuji_ticket_claim` stores one original item/event, number range
  and quantity per real operation. Numbers1..N are consecutive **offline
  identities**, not recovered publisher winning numbers or a lottery RNG.
- The range, `achievement_claim`, queue, mixed Iris/ordinary-item receipts and
  response commit in the existing transaction. A reply failure rolls them back
  together. There is no new framework or native inventory pre-credit.
- Tickets are visible once their server entitlement is committed, including
  while the native mission received flag is pending. A pending callback cannot
  be made dependent on a native balance setter that does not exist.
- ACK proves the correct original ticket receipt and native received mission
  identity/date; mixed ordinary rewards still require their own saved inventory.
  Permanent number ranges survive ACK, cache eviction, session reset, restart
  and clock changes. Exact pending retries reuse the operation and numbers.
- Per-event indexed range reads are checked against actual original mission
  receipt quantities. Unknown pending operations, orphan/gapped ranges and
  mismatched quantities cancel3000999 without erasing any queue or history.
- GET or a real ticket issue also records `takarakuji_pending_event`, at most
  eleven rows. This distinguishes this server's known pending view from an
  unrecovered legacy prize effect. Native visual1->2->3 can then save without
  minting a prize; viewed-result regressions/deletion remain rejected. Default
  state1/false-row cleanup cannot delete the server's ticket entitlements.
- A received legacy raffle mission without actual issued numbers, or an unknown
  legacy result effect, stays unavailable and preserved. Startup does not
  manufacture numbers from flags or recreate a lost ticket range.

A4096-ticket display ceiling is an explicit offline safety policy, **not an
original cap**. Oversized grants/views cancel rather than truncate the list or
feed an unbounded allocation to the client. Natural repeat/reset eligibility,
performance near that ceiling and expired native-row cleanup are not proven.

## Present2000 ticket producer

`gift/receive` now accepts all eleven original raffle item IDs in actual saved,
flat `UserGift` rows with zero equipment/unit upgrade fields. It does not
create a publisher gift catalog or declare such a gift naturally obtainable.
The existing gift owner, amount, source, start/expiry and duplicate-claim
checks remain in force. Gift availability uses the gift's own saved window;
no additional guessed raffle-event claiming deadline is imposed.

- Same-item gifts aggregate into the original `{itemId,amount}` receivedItems
  wire shape. A batch may also contain other raffle events and existing
  Iris/ordinary/stamina/character/equipment/costume rewards.
- Present2000 and mission6000 share the same event-indexed number allocator
  and permanent range table. They cannot independently restart numbering.
  Numbers and the4096 ceiling remain explicit offline policies.
- A nullable `operation_json` on the existing range retains the exact issued
  present envelope and its flat gift quantities. `gift_claim` is indexed by
  operation; original gift IDs, immutable capture, actual pending queue or
  completed ACK, item/event joins and range neighbors are checked before
  delivery, save/ACK or later ticket reads. No new ticket inventory or queue
  is introduced. Mission-only legacy rows retain NULL and their original
  mission quantity validation; legacy presents are not backfilled from flags.
- Existing transaction boundaries cover ranges, pending marker, gift claims,
  mixed wallet/acquisition receipts, original operation, sequence and reply.
  A rejected grant or failed reply cannot retain half the ticket allocation.
- Pending entitlements are visible before native receipt. They are not native
  inventory observation and do not waive the saved received/deleted gift flag
  or any mixed ordinary inventory/other reward requirement before real ACK.
  Split saves retain the queue and cancel unsafe cold redelivery under the
  existing present policy; they do not manufacture an ACK.
- Exact pending retries reuse the original operation. Completed gift IDs never
  remint; captured ranges survive gift deletion, queue retirement, cache/session
  eviction, restart and event-clock changes. Subsequent gifts continue the
  shared event numbers. Details reuse these validated counts without granting
  anything.
- Missing/corrupt captures, orphaned claim IDs, altered quantities/envelopes,
  gaps or duplicate range starts cancel3000999 with state retained. A received
  legacy raffle gift still in native storage without known numbers also
  cancels, rather than being reported as zero tickets. If *all* relevant range
  captures and native gift rows have already been externally erased after ACK,
  gift IDs alone cannot recover the original item, quantity or event; no
  automatic reconstruction is claimed.

Full `test_takarakuji.cjs` **passed on the earlier revision above**, not the
latest source follow-up: all eleven present
classes, aggregation, original2000 popup fields, no native profile pre-credit,
pending/exact/reordered retries, flags/ACK interruption, received-gift deletion,
restart/cache/session/clock changes, shared mission/present number ordering,
multi-event mixed Iris/ordinary reward proofs, legacy nullable migration,
immutable source/range corruption, issue/marker/reply/ACK rollback and4096 cap.
Native present provenance, signed ticket popups, actual effect/save/ACK order,
expired native cleanup, cold navigation/recovery and no-crash/performance proof
remain pending. This paragraph describes the earlier ticket-present producer;
the current result and prize-present contract is documented at the top.

## Event-specific Lotto details

Native1cbb2bc requests `notice/show` with exactly`{lottoOrarioId}`;
1cbb5a0 consumes root`html` and opens the existing webview. The source handler
now returns a self-contained Lotto page instead of the generic revival notice:

- Correct original event/item identities, names and descriptions; original
  start-inclusive/end-exclusive times to the second and page-generation clock
  in the executable's UTC+9 timezone.
- Actual validated permanent ticket count and number range, including committed
  pending mission awards. No ticket, effect flag, wallet, prize or ordinary
  inventory is changed by opening details. Only the normal reply/sequence cache
  is written; a details view does not create a pending-result permission marker.
- Matching original ticket mission IDs, quantities and authored start/expiry
  dates. No earlier mission is invented or shown as eligible merely because
  its date is active; natural unlocks and later claim deadlines are separate.
- Explicit pending or locally published status, reconstructed-odds disclosure,
  exact surviving prize rows and missing-season payout labels. The page cannot
  be mistaken for restored publisher winning numbers or odds.

The23 ticket missions are selected once at listener startup, not by scanning
all42429 original missions on each page request. Ticket validation reuses the
same indexed receipt checks as GET. Expired/unknown events, incomplete metadata,
unknown legacy results and missing/gapped/mismatched ticket history reject rather
than show a generic successful notice. The original window is also checked
before exact cached notice replay, and current receipt validation still applies.
Exact transport retries preserve their earlier page snapshot (including its
clock/count); a fresh request creates a new snapshot. Pre-change generic cached
Lotto replies cancel3000999 until a fresh details request, without mutating saves
or pending operations. HTML text is escaped; no scripts, remote service or asset
download is needed.

Updated `test_takarakuji.cjs` checks all11 event details and23 original mission
rows, empty/pending/saved ticket counts, cached/new request isolation, event
expiry, missing metadata/history, escaping/4096 compact display and reply
rollback. These checks **passed on the earlier revision above**, not the latest
source follow-up. Native webview rendering,
closing/back behavior, localization, historical screen art/date labels and
save/result ordering remain pending the consolidated test batch.

## Still not implemented or claimed

Before the local draw boundary, GET uses false/99999999 as its explicit pending
result. Afterward it uses the documented local rank policy and surviving prize
rows. Original winning numbers, exact sampling odds, prize rows for seasons
5–10 and publisher settlement timing remain unrecovered. No local result is
presented as restored publisher history.

The two Lotto master tables have no such draw/prize configuration. The final
message table contains the last season's hardcoded ticket/date labels. Its
`takarakuji_lottery_date` says `7/17(Mon)` and its distribution period says
`06/14(Wed) 18:00 〜 07/16(Sun) 06:59 (PST)`. The 2023 event window identifies
that Monday as 17 July 2023; the Lotto Details page now shows this announced
date and period, SOURCE ONLY / UNTESTED. The deferred archive assertion and
all-season Details cases are WRITTEN ONLY / NOT RUN. Neither message gives a
draw hour, publication time, winner or payout. Archived `ui_atlas/takarakuji/top.json` describes a
December20 drawing. The inspected rank1/2/3/5/8 icons and effect text contain ranks and
“Jackpot!”, not reward amounts. These are version-dependent display assets,
not an original schedule/prize table for all eleven seasons. Other archived
scripts/assets still need an exhaustive targeted search before declaring the
underlying result/prize configuration absent. The new details page does not
patch those native screen labels. Historical screen art/text and native result
ordering remain unverified.

The final 7,528-product shop catalog and all 353 archived bundle contents have
no Lotto ticket reward or ticket price, so this version has no shop-ticket
purchase branch to implement. The source assertion is WRITTEN ONLY / NOT RUN;
an older catalog could differ. Other ticket producers still need their own real
entitlement receipts and original source contracts. The current result/payout
layer remains an explicitly local reconstruction over those receipts. Co-op remains last;
no workers or GitHub Actions. The seven named local checks and bounded native
startup/persistence check above supersede earlier NOT RUN statements only for
those checks; all final Lotto native acceptance remains on the checklist.
