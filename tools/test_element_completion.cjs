'use strict';

// Deferred synthetic contract/persistence probes, not native gameplay or
// publisher-formula proof. Only disposable SQLite profiles are used.
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
const stats = { totalDamage: 1000, maxDamage: 100, actionCount: 7, defeat: true, turnCount: 2, pcTotalDamage: 50 };
const zero = { totalDamage: 0, maxDamage: 0, actionCount: 0, defeat: false, turnCount: 0, pcTotalDamage: 0 };
// IDs are not chronological: late-added difficulties can follow newer seasons.
// One persistent profile visits original windows in order, so a published prize
// is not accidentally followed by a newly invented high in that retired window.
const entries = Object.entries(master.elementEventScoring).sort(([,a],[,b])=>
  master.elementEventStages[a.stageId].startAt-master.elementEventStages[b.stageId].startAt || a.stageId-b.stageId || a.difficulty-b.difficulty);
const [firstKey, first] = entries[0], firstId = first.adventureStageId;
const event = master.elementEventStages[first.stageId];
const stageRow = id => ({ userId: seed.userId, adventureStageId: id, signature: 0, state: 1,
  cumulativeClearCount: 0, dailyClearCount: 0, currentScore: 0, highScore: 0,
  firstCompleteDateTime: 0, lastCompleteDateTime: 0, firstTryDateTime: 0, lastTryDateTime: 0,
  ticketClosedAt: 0, ticketOpenedAt: 0, usedTicketId: 0, token: '',
  tasks: Object.entries(master.stageTasks).filter(([, task]) => task.stageId === id)
    .map(([id]) => ({ adventureStageTaskId: Number(id), state: 0 })) });
const battle = (id, token, score = stats) => ({ adventureStageId: id, token, userElementEventScore: score,
  adventureStageTaskIds: [], adventureGainedItems: [], friendshipStates: [], adventureRecord: { continueCount: 0 },
  isEnemyAnnihilated: score.defeat, secretMissionCompleted: false });

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-element-complete-'));
  let database, app, port, sequence = 0, now = event.startAt, rejection, currentDifficulty;
  const open = async () => {
    app = createServer({ database, seed, master, wallNowSeconds: () => now, log: line => {
      const entry = JSON.parse(line); if (entry.event === 'rejected') rejection = entry.reason;
    } });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const fresh = async name => { await close(); database = path.join(directory, `${name}.sqlite`); await open(); };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows), md5(rows), name);
  const send = (action, body) => { rejection = undefined; return request(port, ++sequence, body, String(sequence), action); };
  const parse = reply => { assert.equal(reply.status, 200, `${currentDifficulty ?? ''}: ${rejection ?? reply.body.toString()}`); return JSON.parse(reply.body); };
  const complete = body => send('element_event/stage/complete', body);
  const summary = infoId => send('element_event/summary/get', { elementEventInfoId: infoId });
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name, app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all()]));
  const push = (putItems = {}, operations = [], deleteItems = {}) => send('user_data/push', {
    badges: null, scripts: {}, dataTokens: {}, checksums: { before: {}, after: Object.fromEntries(
      [...new Set([...Object.keys(putItems), ...Object.keys(deleteItems)])].map(name => [name, md5(putItems[name] ?? [])])) },
    deltas: Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature: 0, trigger: 'ElementComplete', putItems, deleteItems }] : [],
    operations: operations.map(operation => ({ id: operation.id, verifier: operation.token })),
  });
  const cleared = operation => {
    const row = operation.parameters.UserAdventureStage[0];
    return { ...row, state: 4, cumulativeClearCount: row.cumulativeClearCount + Math.max(1, operation.parameters.skipCount),
      firstCompleteDateTime: row.firstCompleteDateTime || now, lastCompleteDateTime: now,
      tasks: row.tasks.map(task => operation.parameters.adventureStageTaskIds.includes(task.adventureStageTaskId) ? { ...task, state: 1 } : task),
      ...(operation.type === 16000 ? { currentScore: operation.parameters.finalScore,
        highScore: Math.max(row.highScore, operation.parameters.finalScore) } : {}) };
  };
  const record = operation => {
    const receipt = app.store.db.prepare('SELECT * FROM element_completion WHERE operation_id=?').get(operation.id);
    return receipt.had_record || receipt.target_score > 0 ? [{ userId: seed.userId,
      elementEventStageDifficultyId: receipt.difficulty_id, score: receipt.target_score }] : [];
  };
  const acquired = operation => {
    const result = {};
    for (const target of app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(operation.id)) {
      const previous = app.store.read(target.table_name).data.find(row => row[target.id_field] === target.item_id);
      (result[target.table_name] ??= []).push({ bookEntryState: 3, signature: 0, ...previous, userId: seed.userId, [target.id_field]: target.item_id,
        ...(target.table_name==='UserAdventureTicket' && !previous?{lastResetAt:0}:{}),
        ...(target.table_name==='UserMemoriaExpItem' && !previous?{lastAquiredAt:0,reservedAmount:0,bookEntryState:1}:{}),
        ...(['UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial','UserAlarmVoiceItem'].includes(target.table_name) && !previous?{reservedAmount:0,bookEntryState:1}:{}),
        cumulativeAmount: target.cumulative_amount,
        ...(target.table_name === 'UserGachaTicket' ?
          {dateList:[],signature:operation.signature,bookEntryState:!previous || previous.bookEntryState===1?3:previous.bookEntryState} : { amount: 0 }) });
    }
    return result;
  };
  const settle = operation => push({ UserAdventureStage: [cleared(operation)],
    ...(record(operation).length ? { UserElementEventRecord: record(operation) } : {}), ...acquired(operation) }, [operation]);
  try {
    await fresh('all-original-difficulties'); put('UserAdventureStage', entries.map(([, row]) => stageRow(row.adventureStageId)));
    assert.equal(entries.length, 1382);
    let completedDifficulties=0;const started=Date.now();
    for (const [key, original] of entries) {
      currentDifficulty = key;
      const selected = master.elementEventStages[original.stageId], id = original.adventureStageId;
      assert(selected.startAt>=now,'Catalog coverage must not rewind behind published original seasons');now = selected.startAt;
      const body = battle(id, `original-${key}`), reply = await complete(body), identity = sequence, operation = parse(reply).operation;
      assert.equal(operation.type, 25000); assert.equal(operation.parameters.adventureStageId, id);
      assert.deepEqual(Object.keys(operation.parameters.score).sort(), ['totalDamage','maxDamage','actionCount','defeat','turnCount',
        'pcTotalDamage','baseScore','maxDamageBonusRate','maxDamageBonusScore','actionCountBonusRate','turnCountBonusRate',
        'turnCountBonusScore','pcDamageBonusScore','provisionalTotalScore','finalScore'].sort());
      assert.equal(operation.parameters.score.baseScore, Math.trunc(Math.fround(Math.fround(stats.totalDamage) * original.slot5)));
      assert.equal(operation.parameters.score.pcDamageBonusScore, master.stages[id].adventureType === 27
        ? Math.trunc(Math.fround(Math.fround(stats.pcTotalDamage) * original.slot11)) : 0);
      assert.equal(operation.parameters.score.turnCountBonusScore, Math.trunc(Math.fround(original.slot10 * Math.fround(3.8))));
      assert.deepEqual(operation.parameters.gainedItems, [{ itemId: master.items[master.stages[id].rewardKey], amount: master.stages[id].rewardAmount }]);
      assert.equal(app.store.read('UserAdventureStage').data.find(row => row.adventureStageId === id).state, 1);
      assert(!app.store.read('UserElementEventRecord').data.some(row => row.elementEventStageDifficultyId === Number(key)), 'No pre-credited native score');
      assert(!parse(await summary(selected.infoId)).adventureStageRecords.some(row => row.adventureStageId === id));
      parse(await settle(operation));
      assert.equal(parse(await summary(selected.infoId)).adventureStageRecords.find(row => row.adventureStageId === id).score, operation.parameters.score.finalScore);
      assert.equal(app.store.db.prepare('SELECT scoring_policy FROM element_completion WHERE operation_id=?').get(operation.id).scoring_policy, 'offline-element-v1');
      const survivingBody = battle(id, `surviving-${key}`, { ...stats, defeat: false });
      const surviving = parse(await complete(survivingBody)).operation;
      assert.equal(surviving.type, 25000); assert.equal(surviving.parameters.score.defeat, false);
      assert.equal(surviving.parameters.score.turnCountBonusRate, 0);
      assert.equal(surviving.parameters.score.turnCountBonusScore, 0);
      for (const field of ['totalDamage','maxDamage','actionCount','turnCount','pcTotalDamage',
        'baseScore','maxDamageBonusScore','pcDamageBonusScore'])
        assert.equal(surviving.parameters.score[field], operation.parameters.score[field]);
      assert.equal(surviving.parameters.score.finalScore,
        operation.parameters.score.finalScore - operation.parameters.score.turnCountBonusScore);
      assert.deepEqual(surviving.parameters.gainedItems, [], 'A non-annihilated repeat cannot remint first-clear prizes');
      assert.equal(surviving.parameters.isWin, undefined, 'Do not manufacture an ordinary victory field');
      const issued = snapshot();
      for (const changed of [{ ...survivingBody, isEnemyAnnihilated: true },
        { ...survivingBody, isEnemyAnnihilated: true, userElementEventScore: stats }]) {
        assert.equal((await complete(changed)).status, 400); assert.equal(snapshot(), issued);
      }
      assert.deepEqual(parse(await complete(survivingBody)).operation, surviving);
      parse(await settle(surviving));
      assert.equal(JSON.parse(app.store.db.prepare('SELECT battle_stats FROM element_completion WHERE operation_id=?')
        .get(surviving.id).battle_stats).defeat, false, 'The original outcome survives in its durable score capture');
      assert.equal(parse(await summary(selected.infoId)).adventureStageRecords.find(row => row.adventureStageId === id).score,
        operation.parameters.score.finalScore, 'A lower non-annihilated result preserves the previous native high');
      if (key === firstKey) {
        await close(); await open();
        assert.equal((await request(port, identity, body, String(identity), 'element_event/stage/complete')).status, 503);
      }
      if(++completedDifficulties%50===0) console.log(JSON.stringify({completedDifficulties,totalDifficulties:entries.length,
        elapsedSeconds:Math.round((Date.now()-started)/1000)}));
    }
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM element_record').get().n, 1382);
    assert.equal(app.store.hardCurrency(), 0, 'No invented ranking currency or immediate mission reward');
    now = event.startAt;
    const lower = parse(await complete(battle(firstId, 'lower-repeat', zero))).operation;
    assert.equal(lower.parameters.score.finalScore, 0); assert.deepEqual(lower.parameters.gainedItems, []);
    const prior = record(lower)[0].score; parse(await settle(lower));
    assert.equal(parse(await summary(event.infoId)).adventureStageRecords.find(row => row.adventureStageId === firstId).score, prior);
    const saved = snapshot();
    for (const [table, changes, deletes] of [
      ['UserElementEventRecord', [{ userId: seed.userId, elementEventStageDifficultyId: Number(firstKey), score: 0 }], {}],
      ['UserElementEventRecord', [], { UserElementEventRecord: [{ elementEventStageDifficultyId: Number(firstKey) }] }],
      ['UserAdventureStage', [{ ...cleared(lower), cumulativeClearCount: 2 }], {}],
      ['UserAdventureStage', [], { UserAdventureStage: [{ adventureStageId: firstId }] }],
    ]) { assert.equal((await push(changes.length ? { [table]: changes } : {}, [], deletes)).status, 400); assert.equal(snapshot(), saved); }
    app.store.db.exec('DELETE FROM reply_cache'); await close(); await open();
    const noCache = snapshot(); assert.equal((await complete(battle(firstId, `original-${firstKey}`))).status, 503); assert.equal(snapshot(), noCache);

    for (const owned of [false, true]) {
      now = event.startAt; await fresh(`zero-${owned}`); put('UserAdventureStage', [stageRow(firstId)]);
      if (owned) put('UserElementEventRecord', [{ userId: seed.userId, elementEventStageDifficultyId: Number(firstKey), score: 0 }]);
      const operation = parse(await complete(battle(firstId, `zero-${owned}`, zero))).operation;
      assert.equal(operation.parameters.score.finalScore, 0); parse(await settle(operation));
      const scores = parse(await summary(event.infoId)).adventureStageRecords;
      assert.deepEqual(scores, owned ? [{ adventureStageId: firstId, score: 0 }] : []);
      assert.equal(app.store.db.prepare('SELECT has_record FROM element_record').get().has_record, owned ? 1 : 0);
      if (owned) assert.equal((await push({}, [], { UserElementEventRecord: [{ elementEventStageDifficultyId: Number(firstKey) }] })).status, 400);
    }

    for (const mode of [26,27]) {
      const [, selected] = entries.find(([, row]) => master.stages[row.adventureStageId].adventureType === mode);
      const window = master.elementEventStages[selected.stageId]; now = window.startAt;
      await fresh(`surviving-late-save-${mode}`); put('UserAdventureStage', [stageRow(selected.adventureStageId)]);
      const body = battle(selected.adventureStageId, `surviving-late-${mode}`, { ...stats, defeat: false });
      const operation = parse(await complete(body)).operation;
      const prize = structuredClone(operation.parameters.gainedItems);
      await close(); now = window.endAt + 1; await open();
      assert.deepEqual(parse(await complete(body)).operation, operation, 'An untouched exact result remains deliverable after expiry');
      assert.deepEqual(operation.parameters.gainedItems, prize);
      parse(await push({ UserAdventureStage: [cleared(operation)] })); await close(); await open();
      const observed = snapshot(); assert.equal((await complete(body)).status, 503); assert.equal(snapshot(), observed);
      assert.equal((await push({}, [operation])).status, 400, 'A saved clear alone cannot discard score or prize acquisitions');
      parse(await push({ UserElementEventRecord: record(operation), ...acquired(operation) }));
      await close(); await open(); parse(await push({}, [operation]));
      assert.equal(app.store.operations().length, 0); const settled = snapshot();
      assert.equal((await complete(body)).status, 503); assert.equal(snapshot(), settled);
    }

    // WRITTEN ONLY: replay requires the original achievement footprint, not only the higher-only score row.
    now = event.startAt; await fresh('record-only-cold'); put('UserAdventureStage', [stageRow(firstId)]);
    const recordOnly = parse(await complete(battle(firstId, 'record-only-cold'))).operation;
    assert.equal(record(recordOnly).length, 1);
    parse(await push({ UserElementEventRecord: record(recordOnly) })); await close(); await open();
    const recordReceipt = app.store.db.prepare('SELECT target_score,achievement_before_digest FROM element_completion WHERE operation_id=?').get(recordOnly.id);
    assert.match(recordReceipt.achievement_before_digest,/^[a-f0-9]{64}$/);
    app.store.db.prepare('UPDATE element_completion SET target_score=? WHERE operation_id=?')
      .run(recordReceipt.target_score + 1, recordOnly.id);
    const corruptRecord = snapshot(); assert.equal((await send('user_data/confirm')).status, 503);
    assert.equal(snapshot(), corruptRecord, 'A changed private score capture cannot redeliver the native result');
    app.store.db.prepare('UPDATE element_completion SET target_score=? WHERE operation_id=?')
      .run(recordReceipt.target_score, recordOnly.id);
    const exactRecord = record(recordOnly);
    put('UserElementEventRecord', [{ ...exactRecord[0], score: exactRecord[0].score + 1 }]);
    const higherRecord = snapshot(); assert.equal((await send('user_data/confirm')).status, 503);
    assert.equal(snapshot(), higherRecord, 'An unexplained later high cannot be relabeled as this result');
    put('UserElementEventRecord', exactRecord);
    app.store.db.prepare('UPDATE element_completion SET achievement_before_digest=NULL WHERE operation_id=?').run(recordOnly.id);
    const legacyRecord = snapshot(); assert.equal((await send('user_data/confirm')).status, 503);
    assert.equal(snapshot(), legacyRecord, 'An older capture cannot guess whether the score event was saved');
    app.store.db.prepare('UPDATE element_completion SET achievement_before_digest=? WHERE operation_id=?')
      .run(recordReceipt.achievement_before_digest,recordOnly.id);
    const achievements=app.store.read('UserAchievement').data;
    put('UserAchievement',[{...achievements[0],progressParam:achievements[0].progressParam+1},...achievements.slice(1)]);
    const advancedProgress = snapshot(); assert.equal((await send('user_data/confirm')).status, 503);
    assert.equal(snapshot(), advancedProgress, 'An independently saved achievement cannot receive the event score twice');
    put('UserAchievement',[...achievements].reverse());
    assert.deepEqual(app.store.stageColdRecovery(recordOnly),recordOnly,
      'Reordered but identical achievement rows do not masquerade as an event effect');
    put('UserAchievement',achievements);
    const retainedRecord = snapshot(); assert.deepEqual(app.store.stageColdRecovery(recordOnly), recordOnly);
    assert.equal(snapshot(), retainedRecord); assert.deepEqual(parse(await send('user_data/confirm')).operations, [recordOnly]);
    assert.equal((await push({}, [recordOnly])).status, 400, 'A high-score save alone cannot ACK the clear or item');
    assert(recordOnly.parameters.gainedItems.length>0);
    parse(await push(acquired(recordOnly))); await close(); await open();
    assert.deepEqual(app.store.stageColdRecovery(recordOnly).parameters.gainedItems, [],
      'A wholly saved item can be omitted only while the score-event footprint remains unchanged');
    parse(await push({ UserAdventureStage: [cleared(recordOnly)] }, [recordOnly]));
    assert.equal(app.store.operations().length, 0);

    now = event.startAt; await fresh('achievement-before-record'); put('UserAdventureStage', [stageRow(firstId)]);
    parse(await complete(battle(firstId, 'achievement-before-record')));
    const beforeEvent = app.store.read('UserAchievement').data;
    const savedEvent={...beforeEvent[0],progressParam:beforeEvent[0].progressParam+1};
    assert.deepEqual(parse(await push({UserAchievement:[savedEvent]})).operations,[],
      'Save event progress without re-delivering the interrupted Element result');
    assert.equal(app.store.read('UserAchievement').data.find(row=>row.achievementId===savedEvent.achievementId).progressParam,
      savedEvent.progressParam);
    await close(); await open(); const eventFirstSaved = snapshot();
    assert.equal((await send('user_data/confirm')).status,503,
      'An event listener saved before its difficulty record cannot replay the score');
    assert.equal(snapshot(),eventFirstSaved);

    now = event.startAt; await fresh('int64-split-recovery'); put('UserAdventureStage', [stageRow(firstId)]);
    const highBody = battle(firstId, 'int64', { ...zero, totalDamage: 0x7fffffff, maxDamage: 0x7fffffff });
    const response = await complete(highBody), identity = sequence, high = parse(response).operation;
    assert(high.parameters.score.finalScore > 0x7fffffff, 'Native scores are not silently capped to int32');
    const pending = snapshot(); assert.equal((await push({}, [high])).status, 400); assert.equal(snapshot(), pending);
    assert.equal((await push({ UserAdventureStage: [cleared(high)], UserElementEventRecord: record(high) }, [high])).status, 400);
    assert.equal(snapshot(), pending, 'Score/clear cannot discard unreceived items');
    for (const [name, rows] of Object.entries(acquired(high))) {
      const field = Object.values(master.itemProfiles).find(row => row.table === name).idField;
      for (const changes of [{ userId: seed.userId + 1 }, { cumulativeAmount: rows[0].cumulativeAmount - 1 },
        { cumulativeAmount: '1' }, { amount: -1 }]) {
        const before = snapshot();
        assert.equal((await push({ UserAdventureStage: [cleared(high)], UserElementEventRecord: record(high),
          [name]: [{ ...rows[0], ...changes }] }, [high])).status, 400); assert.equal(snapshot(), before);
      }
      assert.equal((await push({ UserAdventureStage: [cleared(high)], UserElementEventRecord: record(high),
        [name]: [rows[0], { ...rows[0], [field]: rows[0][field] }] }, [high])).status, 400);
      assert.equal(snapshot(), pending);
    }
    parse(await push({ UserAdventureStage: [cleared(high)] })); await close(); await open();
    now = event.endAt + 1;
    assert.equal((await complete(highBody)).status, 503, 'An observed clear cannot be delivered again after expiry');
    assert.equal((await request(port, identity, highBody, String(identity), 'element_event/stage/complete')).status, 503);
    assert.equal((await complete({ ...highBody, token: 'another-run' })).status, 400);
    for (const changes of [{ userId: seed.userId + 1 }, { score: -1 }, { score: '1' },
      { score: high.parameters.score.finalScore - 1 }, { score: Number.MAX_SAFE_INTEGER + 1 }, { extra: 0 }]) {
      const before = snapshot(); assert.equal((await push({ UserElementEventRecord: [{ ...record(high)[0], ...changes }], ...acquired(high) }, [high])).status, 400);
      assert.equal(snapshot(), before);
    }
    parse(await push({ UserElementEventRecord: record(high) })); await close(); await open();
    assert.equal((await push({}, [high])).status, 400); parse(await push(acquired(high))); await close(); await open();
    for (const table of ['element_record','operation_done','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_element_ack BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'element ACK rollback'); END`);
      const before = snapshot(); assert.equal((await push({}, [high])).status, 503); assert.equal(snapshot(), before);
      app.store.db.exec('DROP TRIGGER fail_element_ack');
    }
    app.store.db.exec("CREATE TRIGGER fail_element_delete BEFORE DELETE ON operation_queue BEGIN SELECT RAISE(ABORT,'queue rollback'); END");
    const beforeDelete = snapshot(); assert.equal((await push({}, [high])).status, 503); assert.equal(snapshot(), beforeDelete);
    app.store.db.exec('DROP TRIGGER fail_element_delete');
    const receipt = app.store.db.prepare('SELECT * FROM element_completion WHERE operation_id=?').get(high.id);
    app.store.db.prepare('DELETE FROM element_completion WHERE operation_id=?').run(high.id);
    const legacy = snapshot(), unavailable = await push({}, [high]);
    assert.equal(unavailable.status, 503); assert.equal(JSON.parse(unavailable.body).code, OFFLINE_UNAVAILABLE_CODE); assert.equal(snapshot(), legacy);
    app.store.db.prepare(`INSERT INTO element_completion(operation_id,difficulty_id,stage_id,scoring_policy,battle_stats,score_json,
      final_score,before_score,target_score,had_record,clear_count) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(...Object.values(receipt));
    parse(await push({ UserAdventureStage: high.parameters.UserAdventureStage }, [high]));
    assert.equal(app.store.operations().length, 0, 'Proven canonical clear reconciles a pre-clear stage retry');
    await close(); await open();
    assert.equal(parse(await summary(event.infoId)).adventureStageRecords[0].score, high.parameters.score.finalScore);

    // Availability boundaries and strict request types are offline policy,
    // not evidence of the publisher's eligibility checks or battle stats.
    now = event.startAt - 1; await fresh('boundaries'); put('UserAdventureStage', [stageRow(firstId)]);
    let before = snapshot(); assert.equal((await complete(battle(firstId, 'early'))).status, 400); assert.equal(snapshot(), before);
    now = event.startAt; const atStart = parse(await complete(battle(firstId, 'start'))).operation; parse(await settle(atStart));
    now = event.endAt; const atEnd = parse(await complete(battle(firstId, 'end'))).operation; parse(await settle(atEnd));
    now++; before = snapshot(); assert.equal((await complete(battle(firstId, 'late'))).status, 400); assert.equal(snapshot(), before);
    now = event.startAt; await fresh('negative-and-rollback'); put('UserAdventureStage', [stageRow(firstId)]);
    const body = battle(firstId, 'negative', { ...stats, defeat: false });
    for (const bad of [null, {}, { ...body, userElementEventScore: null },
      ...['totalDamage','maxDamage','actionCount','turnCount','pcTotalDamage'].flatMap(key => [-1,'1',0x80000000,1.5]
        .map(value => ({ ...body, userElementEventScore: { ...body.userElementEventScore, [key]: value } }))),
      ...[0,'false',null,undefined].map(value => ({ ...body, isEnemyAnnihilated: value })),
      { ...body, isEnemyAnnihilated: true }, { ...body, userElementEventScore: stats },
      { ...body, userElementEventScore: { ...body.userElementEventScore, defeat: 1 } },
      { ...body, userElementEventScore: { ...body.userElementEventScore, extra: 0 } },
      { ...body, adventureStageId: 1010000101101 }]) {
      before = snapshot(); assert.equal((await complete(bad)).status, 400); assert.equal(snapshot(), before);
    }
    before = snapshot(); assert.equal((await send('adventure/stage/complete', body)).status, 400); assert.equal(snapshot(), before);
    for (const table of ['operation_queue','stage_completion','stage_reward','element_completion','pve_item_claim','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_element BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'element request rollback'); END`);
      before = snapshot(); assert.equal((await complete(body)).status, 503); assert.equal(snapshot(), before);
      app.store.db.exec('DROP TRIGGER fail_element');
    }
    const original = parse(await complete(body)).operation;
    before = snapshot(); assert.equal((await complete({ ...body, userElementEventScore: { ...body.userElementEventScore, turnCount: 3 } })).status, 400); assert.equal(snapshot(), before);
    parse(await settle(original));

    // Shared reservation ordering. The extra Falna is a synthetic battle-loot
    // fixture, not a claim that any Seventh Zone originally dropped this item.
    const special = master.items['status_board_item.special'], pveId = 1120000904103;
    const [missionId, mission] = Object.entries(master.achievements).find(([, row]) =>
      row.rewardKey === 'status_board_item.special' && row.category === 2 && !row.expireAt);
    const [, shared] = entries.find(([, row]) => master.elementEventStages[row.stageId].startAt >= mission.startAt);
    const pcId = Number(Object.keys(master.pcProfiles)[0]);
    const pc = { pcId, level: 50, currentJobIndex: 4, limitbreakCount: 0, usableSkillAmount: 3,
      strength: 1, intelligence: 1, agility: 1, vitality: 1, luck: 1, hp: 100, mp: 100,
      physicalAttackPower: 1, magicAttackPower: 1, defensePower: 1, weaponId: 0, armorId: 0,
      weaponAbilityIds: [], armorAbilityIds: [], heroSublimateLevel: 0, isUnlockedHeroSublimate: false };
    for (const order of [['element','pve','mission'], ['mission','pve','element']]) {
      now = master.elementEventStages[shared.stageId].startAt; await fresh(`shared-${order[0]}`);
      put('UserAdventureStage', [stageRow(shared.adventureStageId), stageRow(pveId)]);
      const claim = { userId: seed.userId, achievementId: Number(missionId), state: 3, completedAt: now,
        lastResetAt: 0, progressParam: 1, readState: 1, signature: 0 }; put('UserAchievement', [claim]);
      const issued = {}, expectedAmounts = { element: 1, pve: master.pveScores[pveId].rewards.s.rewardAmount, mission: mission.rewardAmount };
      let cumulative = 0;
      for (const source of order) {
        if (source === 'element') issued[source] = parse(await complete({ ...battle(shared.adventureStageId, `shared-${order[0]}`),
          adventureGainedItems: [{ itemId: special, amount: 1 }] })).operation;
        else if (source === 'mission') issued[source] = parse(await send('achievement/complete', {
          achievementIds: [{ achievementId: claim.achievementId, completedAt: now }] })).operations[0];
        else issued[source] = parse(await send('pve/stage/complete', { ...battle(pveId, `pve-${order[0]}`),
          userPVEScore: { totalDamage: 100, maxDamage: 100, clearTurn: 1, actionCount: 1, frontPCs: 1, memberPCs: 1, deathCount: 0 },
          userPveParty: { userId: seed.userId, slots: [{ slotNumber: 0, pc, assistingPc: null }] } })).operation;
        cumulative += expectedAmounts[source];
        assert.equal(app.store.db.prepare(`SELECT cumulative_amount FROM ${source === 'mission' ? 'achievement_item_claim' : 'pve_item_claim'}
          WHERE operation_id=? AND item_id=?`).get(issued[source].id, special).cumulative_amount, cumulative);
      }
      const inventory = {};
      // The two actual stage prizes have distinct rows; do not lose either
      // when building the synthetic merged inventory delta.
      for (const operation of [issued.element,issued.pve]) for (const [name, rows] of Object.entries(acquired(operation))) {
        const field = Object.values(master.itemProfiles).find(row => row.table === name).idField;
        const byId = new Map((inventory[name] ?? []).map(row => [row[field], row]));
        for (const row of rows) if (!byId.has(row[field]) || byId.get(row[field]).cumulativeAmount < row.cumulativeAmount) byId.set(row[field], row);
        inventory[name] = [...byId.values()];
      }
      inventory.UserStatusBoardItem = [{ userId: seed.userId, statusBoardItemId: special, amount: 0, cumulativeAmount: cumulative,
        reservedAmount: 0, bookEntryState: 3, signature: 0 }];
      parse(await push({ ...inventory, UserAdventureStage: [cleared(issued.element),cleared(issued.pve)],
        UserElementEventRecord: record(issued.element), UserAchievement: [{ ...claim, state: 4 }] }, Object.values(issued)));
      await close(); await open(); assert.equal(app.store.operations().length, 0);
      before = snapshot(); assert.equal((await push({ UserStatusBoardItem: [{ userId: seed.userId, statusBoardItemId: special,
        amount: 0, cumulativeAmount: cumulative - 1, reservedAmount: 0, bookEntryState: 3, signature: 0 }] })).status, 400); assert.equal(snapshot(), before);
    }
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    console.log('Element offline policy: both enemy outcomes across 1382 original difficulties, native result shape, int64 saves, shared inventory, retry/ACK and rollback OK; native acceptance pending');
  } finally { await close(); fs.rmSync(directory, { recursive: true, force: true }); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
