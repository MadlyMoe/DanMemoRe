'use strict';

// DEFERRED, NOT RUN after saved-status/completion-state/peer-receipt binding. Synthetic earned-unit and
// metadata-calculated totals are not original native signatures/UI proof.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, expeditionRates, expeditionRewards,expeditionCompletionStage } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const { itemDeltas } = require('./test_friendship_rewards.cjs');

async function main() {
  const original = master.expeditionStages[707000001], conditions = master.expeditionConditions[original.conditionGroupId];
  const startedFixture={ userId:seed.userId,expeditionStageId:707000001,completionState:3,dispatchState:1,
    startAt:1500000000,cumulativeClearCount:3,otherClearCount:9,firstTryDateTime:1400000000,
    firstCompleteDateTime:0,lastTryDateTime:1500000000,lastCompleteDateTime:1400000001 },
    finishFixture=expeditionCompletionStage(startedFixture,0,master);
  assert.deepEqual(finishFixture,{ ...startedFixture,completionState:5,dispatchState:0,
    firstCompleteDateTime:1500007200,lastCompleteDateTime:1500007200 });
  for (const draw of [0,1,2]) assert.deepEqual(expeditionCompletionStage(startedFixture,draw,master),finishFixture,
    'No-requirement completion becomes5 even after failure; counters do not increment');
  for (const stageId of [707000026,707000027,707000070]) for (const draw of [0,1,2]) {
    const current={ ...startedFixture,expeditionStageId:stageId,firstCompleteDateTime:1400000000 },
      expected=expeditionCompletionStage(current,draw,master);
    assert.equal(expected.completionState,draw===2?(stageId===707000070?1:5):4);
    assert.equal(expected.firstCompleteDateTime,current.firstCompleteDateTime);
    assert.equal(expected.lastCompleteDateTime,current.startAt+master.expeditionStages[stageId].duration);
    assert.equal(expected.cumulativeClearCount,current.cumulativeClearCount);
    assert.equal(expected.otherClearCount,current.otherClearCount);
  }
  for (const changed of [{ userId:2 },{ dispatchState:0 },{ completionState:0 },{ startAt:0 },
    { cumulativeClearCount:-1 },{ otherClearCount:0x80000000 }])
    assert.equal(expeditionCompletionStage({ ...startedFixture,...changed },0,master),null);
  assert.equal(expeditionCompletionStage(startedFixture,3,master),null);
  assert.equal(expeditionCompletionStage(startedFixture,0,{ ...master,expeditionStageRequirements:{} }),null);
  assert.equal(expeditionCompletionStage(startedFixture,0,{ ...master,expeditionStageRequirements:{
    ...master.expeditionStageRequirements,[startedFixture.expeditionStageId]:[{ id:1,changeState:2,type:1,value:'707000001' }] } }),null);
  const party = Array.from({ length: 8 }, (_, i) => ({ characterId: 101000030 + i, level: 20, status: 500 }));
  // Synthetic owned-unit prerequisites for identity/level checks only. These
  // are not earned characters, original stats/skills, native signatures or UI.
  const ownedUnits=party.map(({ characterId,level })=>{
    const [id,profile]=Object.entries(master.pcProfiles).find(([,pc])=>pc.characterId===characterId && pc.jobIds.length);
    return { ...seed.data.UserPC[0],pcId:Number(id),currentJobIndex:profile.jobIds.length,
      totalExp:master.pcLevels[profile.levelUpType].find(([at])=>at===level)[1],limitbreakCount:0,
      equippedWeaponIndex:0,equippedArmorIndex:0 };
  });
  assert.deepEqual(expeditionRates(original, conditions, []), { success: 0, greatSuccess: 0 });
  assert.deepEqual(expeditionRates(original, conditions, party), { success: 100, greatSuccess: 50 });
  assert.deepEqual(expeditionRates(original, conditions, party.slice(0, 4)), { success: 0, greatSuccess: 50 });
  assert.deepEqual(expeditionRates(original, conditions, party.slice(0, 7)), { success: 75, greatSuccess: 50 });
  const strong = party.slice(0, 4).map(row => ({ ...row, level: 80, status: 8000 }));
  assert.deepEqual(expeditionRates(original, conditions, strong), { success: 50, greatSuccess: 100 });
  const preferred = party.map((row, i) => ({ ...row, characterId: i ? row.characterId : conditions[0].characterId }));
  assert.deepEqual(expeditionRates(original, conditions, preferred), { success: 100, greatSuccess: 100 });
  const weakPreferred = [{ characterId: conditions[0].characterId, level: 1, status: 1 }];
  assert.deepEqual(expeditionRates(original, conditions, weakPreferred), { success: 0, greatSuccess: 1 },
    'Preferred unit must not be counted again by the wildcard');
  assert.deepEqual(expeditionRates(original, [conditions.at(-1), conditions.at(-1)], party.slice(0, 1)),
    { success: 0, greatSuccess: 50 }, 'A second wildcard cannot reuse the only unit');
  for (const [status, expected] of [[175,10], [515,26], [575,29]])
    assert.equal(expeditionRates(original, [conditions[0]], [{ ...weakPreferred[0], status }]).greatSuccess,
      expected, 'ARM float32 boundaries must not use JavaScript double-precision results');
  assert.throws(() => expeditionRates(original, conditions, [...party, party[0]]), /party rates/);
  assert.throws(() => expeditionRates(original, conditions, [{ ...party[0], level: '20' }]), /party rates/);
  assert.throws(() => expeditionRates({ ...original, requiredLevel: 0 }, conditions, party), /rate data/);
  assert.throws(() => expeditionRates(original, [{ ...conditions[0], type: 2 }], party), /rate data/);
  assert.throws(() => expeditionRates(original, conditions, party.map(row => ({ ...row, status: 0x7fffffff }))), /overflow/);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-expedition-'));
  const database = path.join(directory, 'profile.sqlite');
  const realNow = Date.now, realRandomInt = crypto.randomInt;
  let rewardRoll = 0, outcomeRolls = [0,99];
  crypto.randomInt = (max, ...args) => {
    if (args.length || ![100,10000].includes(max)) return realRandomInt(max, ...args);
    return max === 10000 ? rewardRoll : (outcomeRolls.shift() ?? 0);
  };
  let app, port, sequence = 0, now = 1700000000000;
  Date.now = () => now;
  const open = async () => {
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => {
    if (app?.server.listening) await new Promise(resolve => app.server.close(resolve));
    app?.store.close(); app = null;
  };
  const start = (value = { expeditionStageId: 707000001 }) =>
    request(port, ++sequence, value, '44', 'expedition/times');
  const complete = value => request(port, ++sequence, value, '44', 'expedition/complete');
  const snapshot = () => ({ stage: app.store.read('UserExpeditionStage'), operations: app.store.operations(),
    pcs:app.store.read('UserPC'),party:app.store.read('UserExpeditionParty'),
    characters: app.store.read('UserCharacter'), iris: app.store.hardCurrency(),
    claims: app.store.db.prepare('SELECT * FROM friendship_reward ORDER BY reward_id').all(),
    receipts: app.store.db.prepare('SELECT * FROM expedition_completion ORDER BY stage_id,start_at').all(),
    stageEvents:app.store.db.prepare('SELECT * FROM expedition_stage_event ORDER BY operation_id').all(),
    stageClaims:app.store.db.prepare('SELECT * FROM expedition_stage_claim ORDER BY operation_id,stage_id').all(),
    stageFloors:app.store.db.prepare('SELECT * FROM expedition_stage_floor ORDER BY stage_id').all(),
    done: app.store.db.prepare('SELECT id FROM operation_done ORDER BY id').all() });
  // Explicit synthetic prerequisite replacement for later outcome fixtures.
  // Never use this to prove a native unlock or bypass a handler rewind test.
  const fixtureStage=row=>{
    const rows=[...app.store.read('UserExpeditionStage').data.filter(item=>item.expeditionStageId!==row.expeditionStageId),row];
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),
      crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex'),'UserExpeditionStage');
    app.store.db.prepare('UPDATE expedition_stage_floor SET state_json=? WHERE stage_id=?').run(JSON.stringify(row),row.expeditionStageId);
  };
  // Synthetic native-shaped timer delta, not proof of client/UI acceptance.
  const save = (row, operation, extraPuts = {}) => {
    const putItems = { ...extraPuts, ...(row ? { UserExpeditionStage: [row] } : {}) };
    const dispatch=operation?.type===21000?operation:row && app.store.operations().find(item=>item.type===21000 &&
      item.parameters.UserExpeditionStage.expeditionStageId===row.expeditionStageId);
    if (row && dispatch) putItems.UserExpeditionStage=[...app.store.expeditionStageReceipt(dispatch,false).claims
      .filter(claim=>claim.stage_id!==row.expeditionStageId).map(claim=>claim.after),row];
    // Synthetic native-shaped party prerequisite and collection deletion.
    // Mapped owned units certify this synthetic identity/level fixture only.
    if (operation?.type===20000) putItems.UserExpeditionParty = [{ userId:seed.userId,
      expeditionStageId:operation.parameters.UserExpeditionStage.expeditionStageId,
      slots:Array.from({ length:4 },(_,i)=>({ slotNumber:i+1,pcId:ownedUnits[i*2].pcId,assistingPcId:ownedUnits[i*2+1].pcId })) }];
    const deleteItems = operation?.type===21000 ? { UserExpeditionParty:[{
      expeditionStageId:operation.parameters.UserExpeditionStage.expeditionStageId }] } : {};
    return { badges: null, scripts: {}, dataTokens: {},
      checksums: { before: {}, after: Object.fromEntries(Object.entries(putItems).map(([name, rows]) =>
        [name, crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex')]).concat(
          Object.keys(deleteItems).map(name=>[name,crypto.createHash('md5').update('[]').digest('hex')]))) },
      deltas: Object.keys(putItems).length || Object.keys(deleteItems).length ? [{ signature: 0, trigger: 'Expedition', deleteItems, putItems }] : [],
      operations: operation ? [{ id: operation.id, verifier: operation.token }] : [] };
  };
  let nativeParty = party;
  const body = entryPcs => {
    if (!entryPcs) {
      if (app.store.read('UserExpeditionParty').data.some(row=>row.expeditionStageId===707000001))
        nativeParty=app.store.expeditionPartyEntries(707000001).map(({ characterId,level,status })=>({ characterId,level,status }));
      // Retain pre-effect inputs after native party deletion for stale/replay
      // rejection fixtures. Never rebuild an already issued reward body.
      entryPcs=nativeParty;
    }
    return { expeditionStageId: 707000001,
    totalLevel: entryPcs.reduce((n, row) => n + row.level, 0),
    totalStatus: entryPcs.reduce((n, row) => n + row.status, 0), entryPcs,
    friendshipStates: entryPcs.map(({ characterId }) => {
      const friendship = app.store.read('UserCharacter').data.find(row => row.characterId === characterId).friendship;
      return { characterId, friendship, friendshipLv: master.characters[characterId].levels.findLast(([, p]) => p <= friendship)[0], userHeroType: 0 };
    }) };
  };
  const characterDeltas = states => ({ UserCharacter: states.map(state => ({
    ...app.store.read('UserCharacter').data.find(row => row.characterId === state.characterId),
    [['friendship','friendshipAis','friendshipLef'][state.userHeroType]]: state.friendship })) });
  try {
    // Check the documented offline sampler, not the unavailable publisher RNG.
    rewardRoll = 9999;
    assert.deepEqual(expeditionRewards(master.expeditionRewardGroups[711000129]),
      [{ rewardId: 205000002, amount: 128 }, { rewardId: 295000001, amount: 1 }],
      'Multiple guaranteed rows must not be normalized into mutually exclusive choices');
    assert.deepEqual(expeditionRewards(master.expeditionRewardGroups[711000101]), []);
    rewardRoll = 4999;
    assert.deepEqual(expeditionRewards(master.expeditionRewardGroups[711000101]), [{ rewardId: 205000001, amount: 2 }]);
    rewardRoll = 5000;
    assert.deepEqual(expeditionRewards(master.expeditionRewardGroups[711000101]), []);
    for (const group of [null, {}, { counts: [{ weight: 9999, count: 1 }], rewards: [] }])
      assert.throws(() => expeditionRewards(group), /reward data/);
    const sample = master.expeditionRewardGroups[711000101];
    rewardRoll = 0;
    assert.throws(() => expeditionRewards({ ...sample, counts: [{ weight: 10000, count: 2 }],
      rewards: [{ ...sample.rewards[0], amount: 0x7fffffff }] }), /overflow/);
    await open();
    const fixturePcs=[...app.store.read('UserPC').data.filter(row=>!ownedUnits.some(pc=>pc.pcId===row.pcId)),...ownedUnits];
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(fixturePcs),
      crypto.createHash('md5').update(JSON.stringify(fixturePcs)).digest('hex'),'UserPC');
    const initial = snapshot();
    for (const value of [null, {}, { expeditionStageId: 1 }, { expeditionStageId: '707000001' },
      { expeditionStageId: 707000001, extra: true }]) {
      assert.equal((await start(value)).status, 400);
      assert.deepEqual(snapshot(), initial);
    }
    const locked = Object.entries(master.expeditionStages).find(([, row]) => row.initialState === 2 &&
      now / 1000 >= row.startAt && (!row.endAt || now / 1000 < row.endAt));
    assert.ok(locked);
    assert.equal((await start({ expeditionStageId: Number(locked[0]) })).status, 400);
    const expired = Object.entries(master.expeditionStages).find(([, row]) => row.endAt && row.endAt < now / 1000);
    assert.ok(expired);
    assert.equal((await start({ expeditionStageId: Number(expired[0]) })).status, 400);
    app.store.db.exec("CREATE TRIGGER fail_expedition_start BEFORE INSERT ON operation_queue BEGIN SELECT RAISE(ABORT,'start failure'); END");
    assert.equal((await start()).status, 503);
    assert.deepEqual(snapshot(), initial);
    app.store.db.exec('DROP TRIGGER fail_expedition_start');
    app.store.db.exec("CREATE TRIGGER fail_start_receipt BEFORE INSERT ON expedition_start_request BEGIN SELECT RAISE(ABORT,'start receipt failure'); END");
    assert.equal((await start()).status,503);
    assert.deepEqual(snapshot(),initial,'Timer and request identity roll back together');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM expedition_start_request').get().n,0);
    app.store.db.exec('DROP TRIGGER fail_start_receipt');
    const response = await start(), startSequence=sequence;
    assert.equal(response.status, 200);
    const result = JSON.parse(response.body), operation = result.operations[0];
    assert.equal(operation.type, 20000);
    const startReceipt=app.store.db.prepare('SELECT * FROM expedition_start_request WHERE request_key=?')
      .get(`44/${startSequence}`);
    assert.equal(startReceipt.operation_json,JSON.stringify(operation));
    const row = operation.parameters.UserExpeditionStage;
    assert.equal(Array.isArray(row), false, 'Native start operation reads one map');
    assert.deepEqual(row, { userId: seed.userId, expeditionStageId: 707000001,
      completionState: 2, dispatchState: 0, startAt: now / 1000, cumulativeClearCount: 0,
      otherClearCount: 0, firstTryDateTime: now / 1000, firstCompleteDateTime: 0,
      lastTryDateTime: now / 1000, lastCompleteDateTime: 0 });
    assert.deepEqual(app.store.read('UserExpeditionStage'), initial.stage, 'Pending timer stays in the durable operation');
    const pending = snapshot();
    // WRITTEN ONLY / NOT RUN: retries validate the queued timer, not just its route and stage ID.
    const queuedStart=app.store.db.prepare('SELECT parameters FROM operation_queue WHERE id=?').get(operation.id).parameters;
    const badStart=JSON.parse(queuedStart);
    badStart.UserExpeditionStage.startAt=0;
    app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(badStart),operation.id);
    const corruptStart=snapshot();
    assert.equal((await start()).status,503);
    assert.deepEqual(snapshot(),corruptStart,'Rejected dispatch retry keeps its damaged source for recovery');
    app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(queuedStart,operation.id);
    assert.deepEqual(snapshot(),pending);
    now += 3600000;
    assert.deepEqual(JSON.parse((await start()).body), result, 'Retry must not move the dispatch time');
    await close(); await open();
    assert.deepEqual(snapshot(), pending);
    assert.deepEqual(JSON.parse((await start()).body), result, 'Restart preserves the pending timer and operation');
    // WRITTEN ONLY: received-byte identity survives the short reply cache and restart.
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`44/${startSequence}`);
    assert.deepEqual(JSON.parse((await request(port,startSequence,{expeditionStageId:707000001},'44','expedition/times')).body),result);
    assert.equal((await request(port,startSequence,{expeditionStageId:707000002},'44','expedition/times')).status,400);
    const retryTime = now;
    now = (master.expeditionStages[707000001].endAt + 1) * 1000;
    assert.deepEqual(JSON.parse((await start()).body), result, 'Expiration must not discard an already queued dispatch');
    now = retryTime;
    assert.throws(() => app.store.push(save(null, operation)), /saved dispatch timer/);
    const started = { ...row, dispatchState: 1, completionState: 3 };
    for (const malformed of [{ ...started, startAt: row.startAt + 1 }, { ...started, dispatchState: 0 },
      { ...started, completionState: 2 }, { ...started, firstTryDateTime: row.firstTryDateTime + 1 }]) {
      assert.throws(() => app.store.push(save(malformed, operation)), /saved dispatch timer/);
      assert.deepEqual(snapshot(), pending);
    }
    app.store.db.exec("CREATE TRIGGER fail_expedition_ack BEFORE DELETE ON operation_queue BEGIN SELECT RAISE(ABORT,'ack failure'); END");
    assert.throws(() => app.store.push(save(started, operation)), /ack failure/);
    assert.deepEqual(snapshot(), pending, 'Timer, acknowledgement and queue removal roll back together');
    app.store.db.exec('DROP TRIGGER fail_expedition_ack');
    app.store.push(save(started));
    const split = snapshot();
    await close(); await open();
    assert.deepEqual(snapshot(), split, 'Delta-before-ack survives process restart');
    app.store.push(save(null, operation));
    assert.equal(app.store.operations().length, 0);
    app.store.push(save(null, operation));
    const active = snapshot();
    const settledStart={code:0,operations:[]},exactStart=()=>request(port,startSequence,
      {expeditionStageId:707000001},'44','expedition/times');
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`44/${startSequence}`);
    assert.deepEqual(JSON.parse((await exactStart()).body),settledStart);
    for(const damaged of [null,'{}']) {
      app.store.db.prepare('UPDATE expedition_start_request SET operation_json=? WHERE request_key=?')
        .run(damaged,`44/${startSequence}`);
      assert.equal((await exactStart()).status,503);
    }
    app.store.db.prepare('UPDATE expedition_start_request SET operation_json=? WHERE request_key=?')
      .run(JSON.stringify(operation),`44/${startSequence}`);
    app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(operation.id);
    assert.equal((await exactStart()).status,503);
    app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(operation.id);
    app.store.db.prepare('INSERT INTO operation_queue(id,type,parameters,token,signature) VALUES(?,?,?,?,?)')
      .run(operation.id,operation.type,JSON.stringify(operation.parameters),operation.token,operation.signature);
    assert.equal((await exactStart()).status,503);
    app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(operation.id);
    assert.deepEqual(snapshot(),active,'Settled dispatch identity checks never change timer or completion state');
    assert.equal((await start()).status, 400, 'Already active expedition cannot be restarted');
    assert.deepEqual(snapshot(), active);
    await close(); await open();
    assert.deepEqual(snapshot(), active);
    assert.equal((await complete(body())).status, 400, 'Collection before the original timer ends must fail');
    assert.deepEqual(snapshot(), active);
    now = (row.startAt + original.duration) * 1000;
    // Put this character just below a CP level with original rewards.
    app.store.push(save(null, null, characterDeltas([{ characterId: party[0].characterId, friendship: 90300, userHeroType: 0 }])));
    const completionBody = body(), beforeCompletion = snapshot();
    for (const invalid of [null, {}, { ...completionBody, extra: true },
      { ...completionBody, expeditionStageId: 1 }, { ...completionBody, totalLevel: 0 },
      { ...completionBody, totalStatus: 0 }, { ...completionBody, entryPcs: [] },
      { ...completionBody, friendshipStates: [null, ...completionBody.friendshipStates.slice(1)] },
      { ...completionBody, friendshipStates: completionBody.friendshipStates.map(s => ({ ...s, friendship: s.friendship + 1 })) },
      { ...completionBody, friendshipStates: completionBody.friendshipStates.map(s => ({ ...s, friendshipLv: 99 })) },
      { ...completionBody, friendshipStates: completionBody.friendshipStates.map(s => ({ ...s, characterId: 1 })) },
      { ...completionBody,...body(party.map((p,i)=>i? p:{ ...p,level:p.level+1 })) },
      { ...completionBody,...body([...party.slice(0,7),party[0]]) },
      { ...completionBody,friendshipStates:completionBody.friendshipStates.map(s=>({ ...s,userHeroType:1,
        friendship:app.store.read('UserCharacter').data.find(row=>row.characterId===s.characterId).friendshipAis,
        friendshipLv:master.characters[s.characterId].levels.findLast(([,p])=>p<=app.store.read('UserCharacter').data
          .find(row=>row.characterId===s.characterId).friendshipAis)[0] })) }]) {
      assert.equal((await complete(invalid)).status, 400);
        assert.deepEqual(snapshot(), beforeCompletion);
    }
    for (const table of ['operation_queue','expedition_completion','expedition_completion_request']) {
      app.store.db.exec(`CREATE TRIGGER fail_collection BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'collection failure'); END`);
      outcomeRolls = [0,99];
      assert.equal((await complete(completionBody)).status, 503);
      assert.deepEqual(snapshot(), beforeCompletion, 'CP claims, currency, receipt and award roll back together');
      app.store.db.exec('DROP TRIGGER fail_collection');
    }
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM expedition_completion_request').get().n,0);
    outcomeRolls = [0,99];
    const collected = await complete(completionBody), completionSequence=sequence;
    assert.equal(collected.status, 200);
    const collectedBody = JSON.parse(collected.body), award = collectedBody.operations[0];
    assert.equal(award.type, 21000);
    assert.equal(collectedBody.drawStatus, 1);
    assert.deepEqual(award.parameters.UserExpeditionStage, started);
    const normalGroup = master.expeditionRewardGroups[original.successRewardGroupId];
    assert.deepEqual(collectedBody.gainedItems.filter(row => row.drawType === 0 && !row.isFriendshipReward),
      normalGroup.rewards.map(row => ({ rewardId: row.rewardId, amount: row.amount * normalGroup.counts[0].count,
        drawType: 0, isFriendshipReward: false })));
    assert.ok(collectedBody.gainedItems.some(row => row.drawType === 2 && row.rewardId === master.currencies['currency.gem']));
    assert.ok(collectedBody.gainedItems.some(row => row.isFriendshipReward));
    assert.equal(collectedBody.issueAmount, 76);
    assert.equal(collectedBody.friendshipStates[0].friendship, 90305);
    assert.equal(collectedBody.friendshipStates[0].friendshipLv, 41);
    assert.equal(app.store.hardCurrency(), 76);
    const awarded = snapshot();
    assert.equal(awarded.receipts.length, 1);
    // WRITTEN ONLY / NOT RUN: a queued collection must keep its captured dispatch timer.
    const queuedAward=app.store.db.prepare('SELECT parameters FROM operation_queue WHERE id=?').get(award.id).parameters;
    const badAward=JSON.parse(queuedAward);
    badAward.UserExpeditionStage.startAt=0;
    app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(badAward),award.id);
    const corruptAward=snapshot();
    assert.equal((await complete(completionBody)).status,503);
    assert.deepEqual(snapshot(),corruptAward,'Rejected collection retry keeps its reward and wallet unchanged');
    app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(queuedAward,award.id);
    assert.deepEqual(snapshot(),awarded);
    assert.deepEqual(JSON.parse((await complete(completionBody)).body), collectedBody);
    const reordered = Object.fromEntries(Object.entries(completionBody).reverse());
    reordered.friendshipStates = completionBody.friendshipStates.map(s => Object.fromEntries(Object.entries(s).reverse()));
    assert.deepEqual(JSON.parse((await complete(reordered)).body), collectedBody, 'JSON key ordering cannot reroll or reject a pending award');
    assert.equal((await complete({ ...completionBody, ...body(party.map(p => ({ ...p, level: p.level + 1 }))) })).status, 400);
    assert.equal((await start()).status, 400, 'Unacknowledged collection prevents the next dispatch');
    assert.equal((await request(port, ++sequence, { friendshipStates: collectedBody.friendshipStates },
      '44', 'character/friendship/complete')).status, 503, 'CP claims cancel until the overlapping expedition award is acknowledged');
    assert.deepEqual(snapshot(), awarded);
    await close(); await open();
    assert.deepEqual(JSON.parse((await complete(completionBody)).body), collectedBody);
    assert.deepEqual(snapshot(), awarded, 'Restart does not reroll or credit currency twice');
    // WRITTEN ONLY: a pending reward survives cache eviction under its original received request identity.
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`44/${completionSequence}`);
    assert.deepEqual(JSON.parse((await request(port,completionSequence,completionBody,'44','expedition/complete')).body),collectedBody);
    assert.equal((await request(port,completionSequence,{...completionBody,totalStatus:0},'44','expedition/complete')).status,400);
    const completedNative = { ...started, dispatchState: 0, completionState: 5,
      firstCompleteDateTime: row.startAt + original.duration, lastCompleteDateTime: row.startAt + original.duration };
    assert.throws(() => app.store.push(save(null, award, itemDeltas(app.store,award))), /saved peer-stage/);
    assert.throws(() => app.store.push(save(completedNative, award, itemDeltas(app.store,award))), /saved character points/);
    for (const invalid of [{ ...completedNative, startAt: row.startAt + 1 },
      { ...completedNative, completionState: 3 }, { ...completedNative, lastCompleteDateTime: now / 1000 + 1 },
      { ...completedNative, firstCompleteDateTime: now / 1000 + 1 },{ ...completedNative,userId:2 },
      { ...completedNative,cumulativeClearCount:started.cumulativeClearCount+1 },
      { ...completedNative,otherClearCount:started.otherClearCount+1 },
      { ...completedNative,firstTryDateTime:started.firstTryDateTime+1 },
      { ...completedNative,lastTryDateTime:started.lastTryDateTime+1 }])
      assert.throws(() => app.store.push(save(invalid, award, { ...characterDeltas(collectedBody.friendshipStates),
        ...itemDeltas(app.store,award) })), /saved peer-stage|Dispatch save|Owned dispatch/);
    assert.deepEqual(snapshot(), awarded);
    app.store.db.exec("CREATE TRIGGER fail_collection_ack BEFORE DELETE ON operation_queue BEGIN SELECT RAISE(ABORT,'collection ack failure'); END");
    assert.throws(() => app.store.push(save(completedNative, award, { ...characterDeltas(collectedBody.friendshipStates),
      ...itemDeltas(app.store,award) })), /collection ack failure/);
    assert.deepEqual(snapshot(), awarded);
    app.store.db.exec('DROP TRIGGER fail_collection_ack');
    app.store.push(save(completedNative, null, { ...characterDeltas(collectedBody.friendshipStates),
      ...itemDeltas(app.store,award) }));
    const savedCompletion = snapshot();
    await close(); await open();
    assert.deepEqual(snapshot(), savedCompletion);
    assert.equal((await complete(completionBody)).status,503,
      'A partially saved dispatch cannot re-deliver counter events before acknowledgement');
    app.store.push(save(null, award));
    app.store.push(save(null, award));
    assert.equal(app.store.operations().length, 0);
    assert.equal((await complete(completionBody)).status, 400);
    const settledCollection={code:0,...award.parameters,operations:[]},exactCollection=()=>request(port,
      completionSequence,completionBody,'44','expedition/complete');
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`44/${completionSequence}`);
    assert.deepEqual(JSON.parse((await exactCollection()).body),settledCollection,
      'The exact acknowledged collection reopens its result without redelivering operation21000');
    const settledSnapshot=snapshot(),rewardCapture=app.store.db.prepare(
      'SELECT operation_json FROM friendship_reward_claim WHERE operation_id=?').get(award.id).operation_json;
    for(const damaged of [null,'{}']) {
      app.store.db.prepare('UPDATE friendship_reward_claim SET operation_json=? WHERE operation_id=?').run(damaged,award.id);
      app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`44/${completionSequence}`);
      assert.equal((await exactCollection()).status,503);
    }
    app.store.db.prepare('UPDATE friendship_reward_claim SET operation_json=? WHERE operation_id=?').run(rewardCapture,award.id);
    app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(award.id);
    assert.equal((await exactCollection()).status,503);
    app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(award.id);
    app.store.db.prepare('INSERT INTO operation_queue(id,type,parameters,token,signature) VALUES(?,?,?,?,?)')
      .run(award.id,award.type,JSON.stringify(award.parameters),award.token,award.signature);
    assert.equal((await exactCollection()).status,503);
    app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(award.id);
    const xpFloor=app.store.db.prepare('SELECT * FROM expedition_xp_floor WHERE user_id=?').get(1);
    app.store.db.prepare('DELETE FROM expedition_xp_floor WHERE user_id=?').run(1);
    assert.equal((await exactCollection()).status,503);
    app.store.db.prepare('INSERT INTO expedition_xp_floor(user_id,total_exp,operation_id) VALUES(?,?,?)')
      .run(xpFloor.user_id,xpFloor.total_exp,xpFloor.operation_id);
    const stageFloor=app.store.db.prepare('SELECT * FROM expedition_stage_floor WHERE operation_id>=? ORDER BY stage_id LIMIT 1').get(award.id);
    app.store.db.prepare('DELETE FROM expedition_stage_floor WHERE stage_id=?').run(stageFloor.stage_id);
    assert.equal((await exactCollection()).status,503);
    app.store.db.prepare('INSERT INTO expedition_stage_floor(stage_id,state_json,operation_id) VALUES(?,?,?)')
      .run(stageFloor.stage_id,stageFloor.state_json,stageFloor.operation_id);
    const itemFloor=app.store.db.prepare(`SELECT floor.* FROM friendship_item_floor floor JOIN friendship_item_claim claim
      ON claim.item_id=floor.item_id WHERE claim.operation_id=? ORDER BY floor.item_id LIMIT 1`).get(award.id);
    app.store.db.prepare('DELETE FROM friendship_item_floor WHERE item_id=?').run(itemFloor.item_id);
    assert.equal((await exactCollection()).status,503);
    app.store.db.prepare('INSERT INTO friendship_item_floor(item_id,cumulative_amount) VALUES(?,?)')
      .run(itemFloor.item_id,itemFloor.cumulative_amount);
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`44/${completionSequence}`);
    assert.deepEqual(JSON.parse((await exactCollection()).body),settledCollection);
    assert.deepEqual(snapshot(),settledSnapshot,'Settled collection validation never mutates rewards, floors or game state');
    assert.equal((await start()).status, 400, 'A cleared stage cannot restart until a client unlock transition');
    const repeatedCp = JSON.parse((await request(port, ++sequence, { friendshipStates: collectedBody.friendshipStates },
      '44', 'character/friendship/complete')).body);
    assert.equal(repeatedCp.issueAmount, 0);
    assert.deepEqual(repeatedCp.gainedItems, []);
    app.store.push(save(null, repeatedCp.operations[0]));
    assert.throws(()=>app.store.push(save(started)),/Dispatch save/,'An old timer cannot rewind a completed stage');
    assert.equal((await complete(body())).status, 400, 'A stale active save cannot collect the same dispatch twice');
    assert.equal(app.store.hardCurrency(), 76);
    // A reopened fixture tests the subsequent dispatch without claiming unlock,
    // clear-counter or native reward-inventory behavior is implemented.
    const completed = { ...started, completionState: 4, dispatchState: 0,
      cumulativeClearCount: 3, otherClearCount: 9, firstCompleteDateTime: row.startAt + 7200,
      lastCompleteDateTime: row.startAt + 7200 };
    now += 7200000;
    fixtureStage(completed);
    const oldStart=snapshot();
    assert.deepEqual(JSON.parse((await request(port,startSequence,{expeditionStageId:707000001},'44','expedition/times')).body),settledStart,
      'A settled old dispatch identity returns no operation after reopening');
    assert.deepEqual(snapshot(),oldStart);
    const repeat = JSON.parse((await start()).body).operations[0];
    assert.notEqual(repeat.id, operation.id);
    assert.deepEqual(repeat.parameters.UserExpeditionStage, { ...completed,
      startAt: now / 1000, lastTryDateTime: now / 1000 });
    const repeatPending=snapshot();
    assert.deepEqual(JSON.parse((await exactStart()).body),settledStart);
    assert.deepEqual(snapshot(),repeatPending,'Old settled start cannot redirect to the newer pending timer');
    app.store.push(save({ ...repeat.parameters.UserExpeditionStage, dispatchState: 1 }, repeat));
    now += original.duration * 1000;
    outcomeRolls = [0,0];
    const beforeOldCollection=snapshot();
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`44/${completionSequence}`);
    assert.deepEqual(JSON.parse((await request(port,completionSequence,completionBody,'44','expedition/complete')).body),settledCollection,
      'A settled old request reopens only its own result beside a newer dispatch');
    assert.deepEqual(snapshot(),beforeOldCollection);
    const greatResponse = await complete(body());
    assert.equal(greatResponse.status, 200);
    const great = JSON.parse(greatResponse.body);
    assert.equal(great.drawStatus, 2);
    assert.equal(great.issueAmount, 1, 'Previously claimed CP rewards must not be issued again');
    assert.equal(snapshot().receipts.length, 2);
    const greatSaved = expeditionCompletionStage({ ...repeat.parameters.UserExpeditionStage,dispatchState:1 },great.drawStatus,master);
    app.store.push(save(greatSaved, great.operations[0], { ...characterDeltas(great.friendshipStates),
      ...itemDeltas(app.store,great.operations[0]) }));
    // Explicit synthetic reopening, not original unlock/event provenance.
    fixtureStage({ ...greatSaved,completionState:4 });
    const failedStart = JSON.parse((await start()).body).operations[0];
    app.store.push(save({ ...failedStart.parameters.UserExpeditionStage, dispatchState: 1 }, failedStart));
    now += original.duration * 1000;
    outcomeRolls = [99];
    // The failure fixture must change its synthetic saved levels too. Do not
    // weaken real status validation to keep a fabricated status1 request valid.
    const weakUnits=app.store.read('UserPC').data.map(pc=>ownedUnits.some(row=>row.pcId===pc.pcId)?{ ...pc,totalExp:0 }:pc);
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(weakUnits),
      crypto.createHash('md5').update(JSON.stringify(weakUnits)).digest('hex'),'UserPC');
    const failure = JSON.parse((await complete(body())).body);
    assert.equal(failure.drawStatus, 0);
    assert.equal(failure.issueAmount, 0);
    assert.ok(failure.gainedItems.every(row => row.drawType === 0), 'Failure does not roll the reconstructed additional group');
    app.store.push(save(expeditionCompletionStage({ ...failedStart.parameters.UserExpeditionStage,dispatchState:1 },failure.drawStatus,master),
      failure.operations[0], { ...characterDeltas(failure.friendshipStates), ...itemDeltas(app.store,failure.operations[0]) }));
    assert.equal(snapshot().receipts.length, 3);
    const boundary = Object.entries(master.expeditionStages).find(([id, row]) =>
      Number(id) !== 707000001 && row.initialState === 0 && row.endAt > row.startAt);
    now = (boundary[1].startAt - 1) * 1000;
    const unchanged = snapshot();
    assert.equal((await start({ expeditionStageId: Number(boundary[0]) })).status, 400);
    assert.deepEqual(snapshot(), unchanged);
    now = (boundary[1].endAt + 1) * 1000;
    assert.equal((await start({ expeditionStageId: Number(boundary[0]) })).status, 400);
    assert.deepEqual(snapshot(), unchanged);
    now = boundary[1].endAt * 1000;
    const boundaryStart = await start({ expeditionStageId: Number(boundary[0]) });
    assert.equal(boundaryStart.status, 200,
      'Native availability includes the final second');
    const oldStart = JSON.parse(boundaryStart.body).operations[0];
    app.store.push(save({ ...oldStart.parameters.UserExpeditionStage, dispatchState: 1, completionState: 3 }, oldStart));
    now = (boundary[1].endAt + 7776000 - 1) * 1000;
    const oldCollection = await complete({ ...body(), expeditionStageId: Number(boundary[0]) });
    assert.equal(oldCollection.status, 200, 'A dispatched stage can still be collected after its availability window');
    const oldAward = JSON.parse(oldCollection.body).operations[0];
    const deletion = save(null, oldAward, { ...characterDeltas(oldAward.parameters.friendshipStates),
      ...itemDeltas(app.store,oldAward) });
    deletion.deltas[0].deleteItems.UserExpeditionStage = [{ expeditionStageId: Number(boundary[0]) }];
    deletion.checksums.after.UserExpeditionStage = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    assert.throws(() => app.store.push(deletion), /saved peer-stage|Dispatch save/, 'Missing stages before the 90-day expiry cannot acknowledge');
    now += 1000;
    app.store.push({ ...deletion, operations: [] });
    await close(); await open();
    app.store.push(save(null, oldAward));
    assert.equal(app.store.operations().length, 0, 'Expired deletion-before-ack survives restart');
    assert.equal(snapshot().receipts.length, 4);
    console.log('Expedition: rates, availability, reconstructed rewards, all outcomes, once-only CP/currency, rollback, split save/ack and restart: OK (not native UI proof)');
  } finally {
    Date.now = realNow;
    crypto.randomInt = realRandomInt;
    await close();
    try { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
    catch (error) { console.error(`Test profile cleanup failed: ${error.message}`); process.exitCode = 1; }
  }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
