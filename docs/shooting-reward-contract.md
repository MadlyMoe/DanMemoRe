# Offline shooting daily rewards

Source-only, NOT logically tested, built, installed or accepted in MuMu.
The actual player save and running client/listener have not been changed.
Both shooting routes remain PARTIAL, not feature-complete.

The `shooting/ranking/get` read now accepts a past JST day in exactly one
original shooting event window, including an archived event, and looks up only
that event/day's retained local best. An absent result stays an empty ranking;
future dates, dates outside the archived calendars and overlapping event
identities refuse. This removes the previous today/yesterday-only read limit
without replaying a run or inventing a prize; the existing earned-prize
settlement still runs before ranking reads. The older-day and invalid-calendar
cases are written in `test_shooting.cjs` but have not been run.

Fresh and cached ranking replies now use the same event/day projection. Before
replaying an exact cached response, a read-only settlement probe checks whether
a matching native score has newly become observable or an original next-day
prize is now eligible. Either condition returns recovery 3000999 without
recording the observation, changing medals or creating a Present; the client
must issue a fresh packet so settlement and its reply commit together. With no
pending settlement, score, PC, saved name and medal counters must still rebuild
byte-identically. The new cache cases are written in `test_shooting.cjs` and
`test_shooting_rewards.cjs` but have not been run.

## Original evidence

Frozen EU15.1.0 ARM64 SHA-256:
`e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3`.
Addresses below are raw, without Ghidra's `0x100000` image bias.

- `shootingGameDailyRankingReward.enc`, SHA-256
  `d653f687b8d4f57470494bf83b0a4d97702fc4f827b903eb1815ae222cf1c34f`:
  all ten rows now exported with original information ID, dates, ranks, item and quantity.
  The 2021 competition's five tiers grant Iris100/50/30/20/10.
  After epoch1617894000, tiers grant ticket295000002x5,295000003x5,
  295000001x5/x3/x1. A maxRank0 sentinel is preserved, not interpreted
  as proof of original publisher ranking behavior. Solo rank1 needs no sentinel.
- Message40610001, key `shooting_daily_ranking_score_reward_txt`:
  `AIS WARS Rank {} Reward`. Original message.enc SHA-256:
  `a5814e507ed34a86886336f396d99a14e3bc47173891a492ce39d9dfe72760a5`.
- `2406f34:2407144` reads daily best only on the saved JST day;
  `2407144:24072c4` sets daily best/PC/save date;
  `24072c4:24074d4` reads daily PC only on that day.
- Exact reward MessagePack import `27a92b4:27a9590` consumes userId,
  int32 goldCount/silverCount/bronzeCount and int64 lastReceivedDailyRewardAt,
  then resets its native dirty byte. Original aggregation/tally/delivery
  phases have NOT been recovered from these import/setter routines.
- Exact `UserShootingGame` import `280d16c:280d9d4` has thirteen fields,
  a nested-object `playableChara` array, int32 `upDownControl` and
  int32 dailyPlayCount. The earlier boolean-control fixture is corrected;
  native nested-character factory `29601e0:2960238` and constructor
  `2960238:2960280` confirm an object row, not a scalar ID.
  `288ca4c:288cb2c` stores the protected int32 control value.

## Explicit offline behavior

A real recorded `shooting/stage/complete` plus a matching owned
`UserShootingGame` daily score/PC/date/play-count save can earn one reward
after its JST day ends. Saved score alone or completion alone cannot mint it.
Native-first and late saves are captured immutably with SQLite profile updates.
Zero-score matching uses the original getter's effective zero on a different
saved day, without clearing its old raw daily-best fields. Natural first-run
and rollover ordering still require native verification. Completion never prewrites gameplay coins,
total score, play count, unlocks, native signatures or inventory.

Solo rank1, goldCount+1, next-day publication, inclusive run-time reward
calendar and permanent Present expiry are disclosed offline policies, NOT
claims that the publisher behaved that way. Original quantities and dates
are retained. The archive supplies no 2020 daily prize; none is substituted.

An earned day commits its score/request/save proof, original catalog digest,
before/after medal profile, profile token, original19-field RANKING8/COMPANY1
Present and reply in one transaction. Presents have an offline label.
No native ticket or Iris is credited merely by publishing a prize.
Fresh login/confirm/ranking/Gift-or-Medal pulls settle; cached replay stays
read-only. Indexed lookups avoid lifetime request/claimed-Present scans.
Unproven legacy scores remain intact without importing invented rewards.

Actual `gift/receive`/operation2000 collection uses the existing once-only
wallet and cumulative item acquisition machinery. Its permanent claim binding
survives restart and claimed-Gift cleanup. Split flags/inventory saves retain
the queue; push omits an already-observed additive effect, while hot/cached/cold
redelivery cancels until the real acknowledgement. Missing/corrupt catalog,
score, medal, Present or claim proof preserves state instead of repairing it
with fabricated success. Stale pulls, medal rewind, unclaimed-Gift deletion,
restoration and settled-day clock rewind cannot remint rewards.

## Deferred acceptance

`node tools/test_shooting_rewards.cjs` and updated shooting/master checks are
queued, NOT RUN. Shared gift, serial ranking, explorer, save/recovery, Android
and launcher regressions are also pending. Verify native owner identity,
score/PC eligibility, zero-score defaults, medal refresh/notification/cache,
Presents popups, signatures, natural hot/cold save/ACK order, back/recovery,
no crash/ANR and performance in the later consolidated batch.
No run ID is transmitted: a retry using a different identity cannot be proven
to be a new run. Original global ranking/tie/aggregation rules, legacy import,
and full minigame reward/progression acceptance remain incomplete.
