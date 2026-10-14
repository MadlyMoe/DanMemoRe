'use strict';

// Deferred synthetic contract/persistence checks, NOT native party-save order,
// publisher aggregation/usage, natural eligibility or emulator acceptance.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
const routes = ['element_event/ranking/top/get','element_event/ranking/around/get','element_event/ranking/character/get'];
const originals = Object.entries(master.elementEventScoring).map(([id, row]) => ({ ...row, id: Number(id) }));
const first = originals[0], event = master.elementEventStages[first.stageId];
const body = (row, token, damage = 1000) => ({ adventureStageId: row.adventureStageId, token,
  userElementEventScore: { totalDamage: damage, maxDamage: damage, actionCount: 0, defeat: false, turnCount: 0, pcTotalDamage: 0 },
  adventureStageTaskIds: [], adventureGainedItems: [], friendshipStates: [], adventureRecord: { continueCount: 0 },
  isEnemyAnnihilated: false, secretMissionCompleted: false });
const stageRow = adventureStageId => ({ userId: seed.userId, adventureStageId, signature: 0, state: 1,
  cumulativeClearCount: 0, dailyClearCount: 0, currentScore: 0, highScore: 0, firstCompleteDateTime: 0,
  lastCompleteDateTime: 0, firstTryDateTime: 0, lastTryDateTime: 0, ticketClosedAt: 0, ticketOpenedAt: 0,
  usedTicketId: 0, token: '', tasks: [] });

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-element-rankings-'));
  const database = path.join(directory, 'save.sqlite');
  let app, port, sequence = 0, now = event.startAt, rejection;
  const open = async () => {
    app = createServer({ database, seed, master, wallNowSeconds: () => now, log: line => {
      const entry = JSON.parse(line); if (entry.event === 'rejected') rejection = entry.reason;
    } });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const send = (action, value) => { rejection = undefined; return request(port, ++sequence, value, String(sequence), action); };
  const parse = reply => { assert.equal(reply.status, 200, rejection ?? reply.body.toString()); return JSON.parse(reply.body); };
  const view = (route, id = first.stageId) => send(route, { elementEventStageId: id });
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows), md5(rows), name);
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name, app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all()]));
  const unavailable = async route => {
    const before = snapshot(), reply = await view(route);
    assert.equal(reply.status, 503); assert.equal(JSON.parse(reply.body).code, OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(), before, 'Unavailable history must preserve profile, receipts, queues, wallet and sequence');
  };
  const push = (putItems = {}, operations = []) => send('user_data/push', { badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: Object.fromEntries(Object.entries(putItems).map(([name, rows]) => [name, md5(rows)])) },
    deltas: Object.keys(putItems).length ? [{ signature: 0, trigger: 'ElementComplete', putItems, deleteItems: {} }] : [],
    operations: operations.map(op => ({ id: op.id, verifier: op.token })) });
  const saves = op => {
    const before = op.parameters.UserAdventureStage[0];
    const receipt = app.store.db.prepare('SELECT * FROM element_completion WHERE operation_id=?').get(op.id);
    const scores = app.store.read('UserElementEventRecord').data;
    const records = scores.filter(row => row.elementEventStageDifficultyId !== receipt.difficulty_id);
    if (receipt.had_record || receipt.target_score > 0) records.push({ userId: seed.userId,
      elementEventStageDifficultyId: receipt.difficulty_id, score: receipt.target_score });
    const result = { UserAdventureStage: [{ ...before, state: 4, cumulativeClearCount: before.cumulativeClearCount + 1,
      firstCompleteDateTime: before.firstCompleteDateTime || now, lastCompleteDateTime: now }], UserElementEventRecord: records };
    for (const target of app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(op.id)) {
      const previous = app.store.read(target.table_name).data.find(row => row[target.id_field] === target.item_id);
      (result[target.table_name] ??= []).push({ bookEntryState: 3, signature: 0, ...previous, userId: seed.userId, [target.id_field]: target.item_id,
        ...(target.table_name==='UserAdventureTicket' && !previous?{lastResetAt:0}:{}),
        ...(target.table_name==='UserMemoriaExpItem' && !previous?{lastAquiredAt:0,reservedAmount:0,bookEntryState:1}:{}),
        ...(target.table_name==='UserAlarmVoiceItem' && !previous?{reservedAmount:0,bookEntryState:1}:{}),
        cumulativeAmount: target.cumulative_amount,
        ...(target.table_name === 'UserGachaTicket' ? { dateList: [] } : { amount: 0 }) });
    }
    return result;
  };
  const complete = (row, token, damage) => send('element_event/stage/complete', body(row, token, damage));
  const settle = op => push(saves(op), [op]);
  try {
    await open(); put('UserAdventureStage', originals.map(row => stageRow(row.adventureStageId)));
    for (const stageId of Object.keys(master.elementEventStages).map(Number)) for (const route of routes)
      assert.deepEqual(parse(await view(route, stageId)), route === routes[2] ? { code: 0, normal: [], assist: [] } : { code: 0, ranking: [] });
    const emptyViews=new Map();
    for(const route of routes) {
      const reply=await view(route);emptyViews.set(route,{reply,identity:sequence});
      parse(reply);
    }
    assert.equal(app.store.read('UserElementEventRecord').data.length, 0, 'Empty views cannot invent native score rows');
    const firstPc = seed.data.UserPC[0].pcId;
    const secondPc = Number(Object.keys(master.pcProfiles).find(id => Number(id) !== firstPc));
    const assistPc = Number(Object.keys(master.pcProfiles).find(id => ![firstPc,secondPc].includes(Number(id))));
    const originalPc = master.pcProfiles[firstPc], jobRank = master.pcJobRanks[originalPc.jobIds.at(-1)];
    const maximum = master.pcJobMaxLevels[jobRank] + 4;
    const totalExp = master.pcLevels[originalPc.levelUpType].at(-1)[1];
    const level = master.pcLevels[originalPc.levelUpType].findLast(([n, exp]) => n <= maximum && exp <= totalExp)[0];
    const leader = { ...structuredClone(seed.data.UserPC[0]), currentJobIndex: originalPc.jobIds.length,
      totalExp, limitbreakCount: 1, heroSublimateLevel: 2, isUnlockedHeroSublimate: true };
    put('UserPC', [leader, ...[secondPc,assistPc].map(pcId => ({ ...structuredClone(seed.data.UserPC[0]), pcId }))]);
    const party = structuredClone(seed.data.UserParty[0]);
    party.slots[1].pcId = secondPc;
    for (const slot of party.slots.slice(0,2)) slot.assistingPcId = assistPc;
    put('UserParty', [party]);
    const response = await complete(first, 'first'), identity = sequence, operation = parse(response).operation;
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM element_best_capture').get().n, 0, 'No best pointer before saved ACK');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM element_player_capture').get().n, 1);
    for (const route of routes) await unavailable(route);
    const fields = saves(operation); parse(await push(fields)); await close(); await open();
    for (const route of routes) await unavailable(route);
    app.store.db.exec("CREATE TRIGGER fail_element_best BEFORE INSERT ON element_best_capture BEGIN SELECT RAISE(ABORT,'best rollback'); END");
    const pending = snapshot(); assert.equal((await push({}, [operation])).status, 503); assert.equal(snapshot(), pending);
    app.store.db.exec('DROP TRIGGER fail_element_best'); parse(await push({}, [operation]));
    for(const [route,cached] of emptyViews) {
      const before=snapshot(),reply=await request(port,cached.identity,{elementEventStageId:first.stageId},
        String(cached.identity),route);
      assert.equal(reply.status,503,'Cached empty Seventh Zone view cannot hide an acknowledged score');
      assert.equal(snapshot(),before,'Stale ranking recovery retains the acknowledged result');
    }
    const row = { userId: seed.userId, userName: seed.data.UserInfo[0].name, rank: 1, score: operation.parameters.score.finalScore,
      difficultyRank: first.difficulty, leaderPc: { pcId: firstPc, jobRank, level, heroSublimateLevel: 2, isUnlockedHeroSublimate: true } };
    const stableViews=new Map();
    for (const route of routes.slice(0,2)) {
      const reply=await view(route);assert.deepEqual(parse(reply), { code: 0, ranking: [row] });
      stableViews.set(route,{reply,identity:sequence});
    }
    const usage = { code: 0, normal: [firstPc,secondPc].sort((a,b) => a-b).map((pcId,i) => ({ pcId, rank: i+1 })),
      assist: [{ pcId: assistPc, rank: 1 }] };
    const usageReply=await view(routes[2]);assert.deepEqual(parse(usageReply), usage);
    stableViews.set(routes[2],{reply:usageReply,identity:sequence});
    const settled = snapshot(), replay = await request(port, identity, body(first,'first'), String(identity), 'element_event/stage/complete');
    assert.equal(replay.status, 503); assert.equal(JSON.parse(replay.body).code, OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(), settled, 'A settled additive result cannot be replayed from the response cache');
    const changed = structuredClone(party); changed.slots[0].pcId = secondPc;
    put('UserParty', [changed]); put('UserInfo', [{ ...seed.data.UserInfo[0], name: 'Changed' }]);
    put('UserPC', app.store.read('UserPC').data.map(pc => ({ ...pc, totalExp: 0, heroSublimateLevel: 0, isUnlockedHeroSublimate: false })));
    for (const [token,damage] of [['lower',1],['tie',1000]]) {
      const op = parse(await complete(first, token, damage)).operation; parse(await settle(op));
      assert.deepEqual(parse(await view(routes[0])).ranking, [row], 'Lower/tied clears cannot replace immutable best identity/portrait');
      assert.deepEqual(parse(await view(routes[2])), usage);
    }
    for(const [route,cached] of stableViews) assert.deepEqual((await request(port,cached.identity,
      {elementEventStageId:first.stageId},String(cached.identity),route)).body,cached.reply.body,
    'Lower/tied results and current-party changes cannot invalidate the immutable best view');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM element_player_capture').get().n, 1, 'Do not retain unused lower/tied team captures');
    const high = parse(await complete(first, 'new-high', 0x7fffffff)).operation;
    assert(high.parameters.score.finalScore > 0x7fffffff); parse(await settle(high));
    for(const [route,cached] of stableViews) assert.equal((await request(port,cached.identity,
      {elementEventStageId:first.stageId},String(cached.identity),route)).status,503,
    'Cached Seventh Zone view cannot hide a higher acknowledged score/team');
    const improved = parse(await view(routes[0])).ranking[0];
    assert.equal(improved.userName, 'Changed'); assert.equal(improved.leaderPc.pcId, secondPc);
    assert.equal(improved.score, high.parameters.score.finalScore);
    const harder = originals.find(row => row.stageId === first.stageId && row.difficulty > first.difficulty);
    const otherDifficulty = parse(await complete(harder, 'harder', 1)).operation; parse(await settle(otherDifficulty));
    assert.deepEqual(parse(await view(routes[0])).ranking, [improved], 'Choose maximum saved score across original difficulties, not latest clear');
    const highest = parse(await complete(harder, 'hardest-high', 0x7fffffff)).operation; parse(await settle(highest));
    const choices = [improved,{ ...improved, score: highest.parameters.score.finalScore, difficultyRank: harder.difficulty }];
    choices.sort((a,b) => b.score - a.score || b.difficultyRank - a.difficultyRank);
    const winner = parse(await view(routes[0])).ranking[0]; assert.deepEqual(winner, choices[0]);
    const other = originals.find(row => row.stageId !== first.stageId);
    for (const route of routes) assert.deepEqual(parse(await view(route, other.stageId)), route === routes[2]
      ? { code: 0, normal: [], assist: [] } : { code: 0, ranking: [] });
    now = event.endAt + 100; await close(); await open(); app.store.beginSession();
    assert.deepEqual(parse(await view(routes[0])).ranking, [winner], 'Event expiry, restart and cache eviction retain true history');
    const state = app.store.read('UserElementEventRecord').data;
    put('UserElementEventRecord', [{ userId: seed.userId, elementEventStageDifficultyId: other.id, score: 0 }]);
    assert.deepEqual(parse(await view(routes[0], other.stageId)), { code: 0, ranking: [] }, 'Owned zero remains saved but is not an offline ranked score');
    put('UserElementEventRecord', state);
    for (const route of routes) for (const value of [null, {}, { elementEventStageId: 1 }, { elementEventStageId: event.infoId },
      { elementEventStageId: first.adventureStageId }, { elementEventStageId: String(first.stageId) },
      { elementEventStageId: first.stageId, extra: 0 }]) {
      const before = snapshot(); assert.equal((await send(route,value)).status, 400); assert.equal(snapshot(), before);
    }
    const pointer = app.store.db.prepare('SELECT * FROM element_best_capture WHERE difficulty_id=?')
      .get(winner.difficultyRank === first.difficulty ? first.id : harder.id);
    app.store.db.prepare('DELETE FROM element_best_capture WHERE difficulty_id=?').run(pointer.difficulty_id);
    for (const route of routes) await unavailable(route);
    app.store.db.prepare('INSERT INTO element_best_capture(difficulty_id,operation_id) VALUES(?,?)').run(pointer.difficulty_id,pointer.operation_id);
    const capture = app.store.db.prepare('SELECT player_json FROM element_player_capture WHERE operation_id=?').get(pointer.operation_id).player_json;
    app.store.db.prepare('UPDATE element_player_capture SET player_json=? WHERE operation_id=?')
      .run(JSON.stringify({ ...JSON.parse(capture), userId: seed.userId + 1 }), pointer.operation_id);
    for (const route of routes) await unavailable(route);
    app.store.db.prepare('UPDATE element_player_capture SET player_json=? WHERE operation_id=?').run('{',pointer.operation_id);
    for (const route of routes) await unavailable(route);
    app.store.db.prepare('UPDATE element_player_capture SET player_json=? WHERE operation_id=?').run(capture,pointer.operation_id);
    app.store.db.prepare('UPDATE element_completion SET difficulty_id=? WHERE operation_id=?').run(other.id,pointer.operation_id);
    for (const route of routes) await unavailable(route);
    app.store.db.prepare('UPDATE element_completion SET difficulty_id=? WHERE operation_id=?')
      .run(pointer.difficulty_id,pointer.operation_id);
    for (const bad of [state.map(record => ({ ...record, score: 0 })),
      [{ ...state[0], userId: seed.userId + 1 }], [{ ...state[0], score: '1' }], [state[0],state[0]]]) {
      put('UserElementEventRecord', bad);
      for (const route of routes) { const before = snapshot(); assert.equal((await view(route)).status, 400); assert.equal(snapshot(), before); }
    }
    put('UserElementEventRecord', state);
    for (const route of routes) {
      app.store.db.exec(`CREATE TRIGGER fail_element_view BEFORE INSERT ON reply_cache WHEN NEW.action='${route}' BEGIN SELECT RAISE(ABORT,'view rollback'); END`);
      const before = snapshot(); assert.equal((await view(route)).status, 503); assert.equal(snapshot(), before);
      app.store.db.exec('DROP TRIGGER fail_element_view');
    }
    const noTeam = originals.find(row => ![first.stageId,other.stageId].includes(row.stageId));
    now = master.elementEventStages[noTeam.stageId].startAt;
    app.store.db.exec("CREATE TRIGGER fail_element_capture BEFORE INSERT ON element_player_capture BEGIN SELECT RAISE(ABORT,'capture rollback'); END");
    const beforeCapture = snapshot(); assert.equal((await complete(noTeam,'capture-failure')).status, 503);
    assert.equal(snapshot(), beforeCapture, 'Capture failure rolls back clear rewards, queue, receipt and reply');
    app.store.db.exec('DROP TRIGGER fail_element_capture');
    put('UserParty', []);
    const missing = parse(await complete(noTeam,'missing-team')).operation; parse(await settle(missing));
    assert.equal(app.store.db.prepare('SELECT 1 FROM element_player_capture WHERE operation_id=?').get(missing.id), undefined);
    for (const route of routes) {
      const before = snapshot(), reply = await view(route,noTeam.stageId);
      assert.equal(reply.status, 503); assert.equal(JSON.parse(reply.body).code, OFFLINE_UNAVAILABLE_CODE); assert.equal(snapshot(), before);
    }
    put('UserParty', [changed]);
    // A legacy native high score has no trustworthy historical portrait. A
    // lower repeat or changed current team must not backfill it as history.
    now = master.elementEventStages[other.stageId].startAt;
    put('UserElementEventRecord', [...app.store.read('UserElementEventRecord').data.filter(row =>
      row.elementEventStageDifficultyId !== other.id), { userId: seed.userId, elementEventStageDifficultyId: other.id, score: 9000000000 }]);
    const legacy = parse(await complete(other,'legacy-lower',1)).operation; parse(await settle(legacy));
    for (const route of routes) {
      const before = snapshot(), reply = await view(route,other.stageId);
      assert.equal(reply.status, 503); assert.equal(JSON.parse(reply.body).code, OFFLINE_UNAVAILABLE_CODE); assert.equal(snapshot(), before);
    }
    assert.equal(app.store.operations().length, 0); assert.equal(app.store.hardCurrency(), 0, 'Rank views award no invented prizes');
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    console.log('Seventh Zone rankings: 417 original groups, three real wire shapes, acknowledged immutable teams, best-difficulty isolation, retry/restart/rollback and unavailable legacy history OK; native acceptance pending');
  } finally { await close(); fs.rmSync(directory, { recursive: true, force: true }); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
