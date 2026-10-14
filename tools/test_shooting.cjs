'use strict';

// DEFERRED: do not execute until the all-packet implementation phase is complete.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-shooting-'));
  const database = path.join(directory, 'profile.sqlite'), realNow = Date.now;
  let app, port, sequence = 0, now = Date.parse('2026-10-01T14:59:59Z');
  const open = async (data = master) => {
    app = createServer({ database, seed, master: data, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => {
    if (app?.server.listening) await new Promise(resolve => app.server.close(resolve));
    app?.store.close(); app = null;
  };
  const send = (value, action = 'shooting/stage/complete') => request(port, ++sequence, value, String(sequence), action);
  const ranking = (value = { rankingDateAt: Math.floor(now / 1000 / 3600) * 3600 }) => send(value, 'shooting/ranking/get');
  const body = { pcId: 67300000001, score: 12345 };
  const scores = () => app.store.db.prepare('SELECT info_id,day,score,pc_id,recorded_at FROM shooting_best ORDER BY info_id,day')
    .all().map(row => ({ ...row }));
  const profile = () => app.store.db.prepare('SELECT * FROM profile ORDER BY name').all();
  const snapshot = () => ({ scores: scores(), profile: profile(), operations: app.store.operations(),
    requests:app.store.db.prepare('SELECT * FROM shooting_complete_request ORDER BY request_key').all(),
    rewards:app.store.db.prepare('SELECT * FROM shooting_daily_reward ORDER BY info_id,day').all(),
    runtime: app.store.db.prepare('SELECT * FROM runtime').all(), cache: app.store.db.prepare('SELECT * FROM reply_cache ORDER BY key').all() });
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  // Synthetic client saves verify persistence, not native minigame/UI ordering.
  const save = putItems => ({ badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: Object.fromEntries(Object.entries(putItems)
      .map(([name, rows]) => [name, crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex')])) },
    deltas: [{ signature: 0, trigger: 'ShootingGame', deleteItems: {}, putItems }], operations: [] });
  try {
    Date.now = () => now;
    await open();
    const pristineProfile = profile();
    const initialValue={rankingDateAt:Math.floor(now/1000/3600)*3600},initialRanking=await ranking(initialValue),
      initialRankingSequence=sequence;
    assert.deepEqual(parse(initialRanking), { code: 0, ranking: [] });
    assert.deepEqual((await request(port,initialRankingSequence,initialValue,String(initialRankingSequence),'shooting/ranking/get')).body,
      initialRanking.body,'Unchanged exact shooting ranking replay stays byte-identical');
    assert.deepEqual(scores(), []);
    assert.deepEqual(profile(), pristineProfile);
    const beforeInvalid = snapshot();
    for (const value of [null, {}, { ...body, score: -1 }, { ...body, score: 0.1 },
      { ...body, score: '1' }, { ...body, score: Number.MAX_SAFE_INTEGER + 1 },
      { ...body, pcId: '67300000001' }, { ...body, pcId: 1011003001 }, { ...body, pcId: 0 },
      { ...body, extra: 1 }]) {
      assert.equal((await send(value)).status, 400);
      assert.deepEqual(snapshot(), beforeInvalid);
    }
    for (const value of [null, {}, { rankingDateAt: -1 }, { rankingDateAt: '1790863200' },
      { rankingDateAt: now / 1000 + 86400 }, { rankingDateAt: master.shootingGames[67000000001].endAt + 86400 },
      { rankingDateAt: now / 1000, userId: 1 }, { rankingDateAt: now / 1000, userId: 0 },
      { rankingDateAt: now / 1000, userId: String(seed.userId) }, { rankingDateAt: now / 1000, extra: 1 }]) {
      assert.equal((await ranking(value)).status, 400);
      assert.deepEqual(snapshot(), beforeInvalid);
    }
    for (const table of ['shooting_best','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_shooting BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'score failure'); END`);
      assert.equal((await send(body)).status, 503);
      assert.deepEqual(snapshot(), beforeInvalid, 'Score, response cache and sequence roll back together');
      app.store.db.exec('DROP TRIGGER fail_shooting');
    }
    const first = await send(body), firstSequence = sequence;
    assert.deepEqual(parse(first), { code: 0 });
    const day = Math.floor((now / 1000 + 32400) / 86400), recordedAt = now / 1000;
    assert.deepEqual(scores(), [{ info_id: 67000000002, day, score: body.score, pc_id: body.pcId, recorded_at: recordedAt }]);
    const expected = { userId: seed.userId, name: seed.data.UserInfo[0].name, rank: 1,
      pcId: body.pcId, score: body.score, goldCount: 0, silverCount: 0, bronzeCount: 0 };
    assert.equal((await request(port,initialRankingSequence,initialValue,String(initialRankingSequence),'shooting/ranking/get')).status,503,
      'Cached empty shooting board cannot hide a newly recorded score');
    assert.deepEqual(parse(await ranking()).ranking, [expected]);
    assert.deepEqual(parse(await ranking({ rankingDateAt: now / 1000, userId: seed.userId })).ranking, [expected]);
    assert.deepEqual(parse(await ranking({ rankingDateAt: now / 1000 - 86400 })).ranking, []);
    assert.deepEqual(parse(await ranking({ rankingDateAt: now / 1000 - 172800 })).ranking, [],
      'An older original event day without a local result remains empty');
    assert.deepEqual(profile(), pristineProfile);
    assert.deepEqual(app.store.operations(), []);
    now += 500;
    parse(await send(body));
    parse(await send({ pcId: 67300000002, score: body.score }));
    parse(await send({ pcId: 67300000003, score: 1 }));
    assert.equal(scores()[0].pc_id, body.pcId, 'Tie retains the first character');
    assert.equal(scores()[0].recorded_at, recordedAt, 'Replays/lower scores do not alter the best run');
    const best = { pcId: 67300000004, score: 9000000000 };
    const beforeUpdate = snapshot();
    app.store.db.exec("CREATE TRIGGER fail_shooting BEFORE UPDATE ON shooting_best BEGIN SELECT RAISE(ABORT,'update failure'); END");
    assert.equal((await send(best)).status, 503);
    assert.deepEqual(snapshot(), beforeUpdate);
    app.store.db.exec('DROP TRIGGER fail_shooting');
    parse(await send(best));
    const bestValue={rankingDateAt:Math.floor(now/1000/3600)*3600},bestRanking=await ranking(bestValue),
      bestRankingSequence=sequence;
    assert.equal(parse(bestRanking).ranking[0].score, best.score, 'Native score is int64, not int32');
    now = Date.parse('2026-10-01T15:00:00Z');
    assert.deepEqual((await request(port,bestRankingSequence,bestValue,String(bestRankingSequence),'shooting/ranking/get')).body,
      bestRanking.body,'A retained historical board remains stable across JST midnight without settlement proof');
    assert.deepEqual(parse(await ranking()).ranking, [], 'UTC+9 midnight starts a new leaderboard');
    const yesterday = { rankingDateAt: now / 1000 - 86400, userId: seed.userId };
    assert.deepEqual(parse(await ranking(yesterday)).ranking, [{ ...expected, ...best }]);
    now = Date.parse('2026-10-02T15:00:00Z');
    assert.deepEqual(parse(await ranking({ rankingDateAt: recordedAt })).ranking, [{ ...expected, ...best }],
      'An acknowledged older JST day remains readable beyond yesterday');
    now = Date.parse('2026-10-01T15:00:00Z');
    const beforeReplay = scores();
    await close(); await open();
    assert.deepEqual((await request(port, firstSequence, body, String(firstSequence), 'shooting/stage/complete')).body, first.body);
    assert.deepEqual(scores(), beforeReplay, 'Restarted exact replay does not move the score into the new day');
    assert.equal((await request(port, firstSequence, { ...body, score: 2 }, String(firstSequence), 'shooting/stage/complete')).status, 400);
    parse(await send({ pcId: body.pcId, score: 0 }));
    assert.equal(parse(await ranking()).ranking[0].score, 0, 'A real zero-score run is not a missing record');
    assert.equal(scores().length, 2);
    assert.deepEqual(profile(), pristineProfile, 'Completion cannot duplicate local coins, total score or play count');

    const saved = { userId: seed.userId, shootingGameInfoId: 67000000002, aisCoinAmount: 100,
      dailyPlayAt: now / 1000, dailyPlayCount: 1, destroyBossCount: 1, highScore: best.score,
      highScoreOfDay: 0, highScorePcIdOfDay: body.pcId, highScoreSaveAt: recordedAt,
      playableChara: [], totalScore: best.score + body.score, upDownControl: 1 };
    const medals = { ...seed.data.UserShootingGameRankingReward[0], goldCount: 2, silverCount: 3, bronzeCount: 4 };
    parse(await send(save({ UserShootingGame: [saved, { ...saved, shootingGameInfoId: 67000000001, aisCoinAmount: 20 }],
      UserShootingGameRankingReward: [medals], UserInfo: [{ ...seed.data.UserInfo[0], name: 'Local Player' }] }), 'user_data/push'));
    assert.equal((await request(port,bestRankingSequence,bestValue,String(bestRankingSequence),'shooting/ranking/get')).status,503,
      'Cached shooting board cannot retain stale saved name or medal counters');
    parse(await send(save({ UserShootingGame: [{ ...saved, aisCoinAmount: 125 }] }), 'user_data/push'));
    const afterSave = profile();
    parse(await send({ ...body, score: 500 }));
    assert.deepEqual(profile(), afterSave);
    assert.equal(app.store.read('UserShootingGame').data.length, 2, 'Updating one minigame preserves the other profile');
    await close(); await open();
    assert.deepEqual(profile(), afterSave);
    assert.deepEqual(parse(await ranking()).ranking, [{ ...expected, name: 'Local Player', score: 500,
      goldCount: 2, silverCount: 3, bronzeCount: 4 }]);
    app.store.push(save({ UserShootingGameRankingReward: [{ ...medals, goldCount: -1 }] }));
    assert.equal((await ranking()).status, 400);
    app.store.push(save({ UserShootingGameRankingReward: [medals] }));

    // Original archived calendar, including the 2020/2021 independent boards.
    const beforeCalendar = scores();
    for (const time of [master.shootingGames[67000000001].startAt - 1,
      master.shootingGames[67000000001].endAt + 1, master.shootingGames[67000000002].endAt + 1]) {
      now = time * 1000;
      assert.equal((await send(body)).status, 400);
      assert.deepEqual(scores(), beforeCalendar);
    }
    for (const time of [master.shootingGames[67000000001].startAt, master.shootingGames[67000000001].endAt,
      master.shootingGames[67000000002].startAt, master.shootingGames[67000000002].endAt]) {
      now = time * 1000;
      parse(await send(body));
      assert.equal(parse(await ranking()).ranking[0].score, body.score);
    }
    assert.ok(scores().some(row => row.info_id === 67000000001));
    assert.equal(parse(await ranking({ rankingDateAt: master.shootingGames[67000000001].startAt })).ranking[0].score,
      body.score, 'A retained local score remains readable after its original event closes');
    const finalScores = scores();
    await close(); await open({ ...master, shootingPcIds: undefined });
    assert.equal((await send(body)).status, 503);
    assert.deepEqual(scores(), finalScores);
    await close(); await open({ ...master, shootingGames: { ...master.shootingGames,
      67000000003: master.shootingGames[67000000002] } });
    assert.equal((await send(body)).status, 503);
    assert.deepEqual(scores(), finalScores);
    console.log('Shooting scores/rankings: original IDs/calendar, UTC+9 rollover, rollback, replay, restart and unchanged client rewards OK');
  } finally {
    Date.now = realNow;
    await close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
