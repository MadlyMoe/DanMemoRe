'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('./danmemore_server.cjs');
const { request, stageXpFixture } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = value => crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-stage-save-'));
  const database = path.join(directory, 'profile.sqlite');
  let app, port, sequence = 0, rejection;
  const open = async () => {
    app = createServer({ database, seed, master, log: line => {
      const entry=JSON.parse(line);if(entry.event==='rejected') rejection=entry.reason;
    } });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => {
    if (app?.server.listening) await new Promise(resolve => app.server.close(resolve));
    app?.store.close(); app = null;
  };
  const send = (body, action = 'user_data/push') => {rejection=undefined;return request(port, ++sequence, body, String(sequence), action);};
  const parse = response => { assert.equal(response.status, 200, rejection ?? response.body.toString()); return JSON.parse(response.body); };
  const snapshot = () => Object.fromEntries(['profile','hard_currency','stage_completion','stage_reward','stage_delivery','stage_state_floor','stage_unlock_floor','pve_item_claim','stage_xp_claim','stage_xp_floor',
    'operation_queue','operation_done','runtime','reply_cache']
    .map(table => [table, app.store.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
  const pushBody = (operations, stages, remove = false) => {
    let putItems = stages && !remove ? { UserAdventureStage: stages } : {};
    // Synthetic saved inventory for combined stage+ACK probes. A bare ACK and
    // the separate clear-only save remain empty; neither silently gains loot.
    if (stages && !remove) for (const operation of operations)
      for (const target of app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(operation.id)) {
        const previous = app.store.read(target.table_name).data.find(row => row[target.id_field] === target.item_id);
        (putItems[target.table_name] ??= []).push({ ...previous, userId: seed.userId, [target.id_field]: target.item_id,
          ...(target.table_name==='UserAdventureTicket' && !previous?{lastResetAt:0,bookEntryState:1,signature:0}:{}),
          ...(target.table_name==='UserMemoriaExpItem' && !previous?{lastAquiredAt:0,reservedAmount:0,bookEntryState:1,signature:0}:{}),
          ...(target.table_name==='UserAlarmVoiceItem' && !previous?{reservedAmount:0,bookEntryState:1,signature:0}:{}),
          ...(target.table_name==='UserLimitBreakItem' && !previous?{bookEntryState:1,signature:0}:{}),
          cumulativeAmount: target.cumulative_amount, ...(target.table_name === 'UserGachaTicket' ?
            {dateList:[],signature:operation.signature,bookEntryState:!previous || previous.bookEntryState===1?3:previous.bookEntryState} : { amount: 0 }) });
      }
    if (stages && !remove) putItems = stageXpFixture(app.store,putItems,operations);
    return { badges: null, scripts: {}, dataTokens: {},
      checksums: { before: {}, after: { ...Object.fromEntries(Object.entries(putItems).map(([name,rows]) => [name,md5(rows)])),
        ...(remove ? { UserAdventureStage: md5([]) } : {}) } },
      deltas: stages ? [{ signature: 0, trigger: 'AdventureComplete', putItems,
        deleteItems: remove ? { UserAdventureStage: stages } : {} }] : [],
      operations: operations.map(row => ({ id: row.id, verifier: row.token })) };
  };
  const result = { adventureStageId: 1010000101101, token: 'stage-save-test',
    adventureStageTaskIds: [682000001,682000002], adventureGainedItems: [], friendshipStates: [],
    adventureRecord: { continueCount: 0, deathCount: 0, turnCount: 3 },
    isEnemyAnnihilated: true, secretMissionCompleted: false };
  const complete = body => send(body, 'adventure/stage/complete');
  // Synthetic native-shaped save, not proof of client UI/inventory consumption.
  const cleared = (operation, at) => {
    const row = operation.parameters.UserAdventureStage[0];
    return { ...row, state: 4, cumulativeClearCount: row.cumulativeClearCount + 1,
      dailyClearCount: row.dailyClearCount + 1,
      firstCompleteDateTime: row.firstCompleteDateTime || at, lastCompleteDateTime: at,
      tasks: row.tasks.map(task => ![1,2].includes(task.state) && operation.parameters.adventureStageTaskIds.includes(task.adventureStageTaskId)
        ? { ...task, state: 1 } : task) };
  };
  try {
    await open();
    const first = await complete(result), firstSequence = sequence;
    const operation = parse(first).operation;
    assert.equal(operation.type, 5000);
    assert.equal(app.store.hardCurrency(), 2);
    let before = snapshot();
    assert.equal((await send(pushBody([operation]))).status, 400, 'Bare ACK must not discard an unsaved clear');
    assert.deepEqual(snapshot(), before);
    await close(); await open();
    const replay = await request(port, firstSequence, result, String(firstSequence), 'adventure/stage/complete');
    assert.equal(replay.status, first.status);
    assert.deepEqual(replay.body, first.body);
    assert.deepEqual(parse(await complete(result)).operation, operation);
    assert.equal(app.store.hardCurrency(), 2);
    const saved = cleared(operation, 1790866800);
    before = snapshot();
    for (const change of [{ state: 3 }, { userId: 2 }, { cumulativeClearCount: 0 },
      { cumulativeClearCount: '1' }, { cumulativeClearCount: 0x80000000 },
      { firstCompleteDateTime: 0 }, { lastCompleteDateTime: 0 },
      { firstCompleteDateTime: saved.lastCompleteDateTime + 1 }, { lastCompleteDateTime: 0.5 },
      { tasks: operation.parameters.UserAdventureStage[0].tasks }, { tasks: [] },
      { tasks: saved.tasks.map(task => ({ ...task, state: 3 })) }]) {
      assert.equal((await send(pushBody([operation], [{ ...saved, ...change }]))).status, 400);
      assert.deepEqual(snapshot(), before, 'A rejected ACK cannot commit its delta or lose rewards');
    }
    assert.equal((await send(pushBody([operation], [saved], true))).status, 400);
    assert.deepEqual(snapshot(), before, 'Stage deletion is not evidence of its completion');
    const receipt = app.store.db.prepare('SELECT * FROM stage_completion WHERE operation_id=?').get(operation.id);
    app.store.db.prepare('DELETE FROM stage_completion WHERE operation_id=?').run(operation.id);
    const withoutReceipt = snapshot();
    assert.equal((await send(pushBody([operation], [saved]))).status, 503);
    assert.deepEqual(snapshot(), withoutReceipt, 'An unexplained legacy queue entry is retained, not silently marked done');
    app.store.db.prepare('INSERT INTO stage_completion(stage_id,token,body_hash,operation_id) VALUES(?,?,?,?)')
      .run(receipt.stage_id, receipt.token, receipt.body_hash, receipt.operation_id);
    assert.deepEqual(snapshot(), before);
    // Failure at any part of the save/receipt/cache transaction preserves all of it.
    for (const [table, event] of [['profile','UPDATE'], ['operation_done','INSERT'],
      ['operation_queue','DELETE'], ['reply_cache','INSERT'], ['runtime','UPDATE']]) {
      app.store.db.exec(`CREATE TRIGGER fail_stage_save BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'stage save failure'); END`);
      assert.equal((await send(pushBody([operation], [saved]))).status, 503);
      assert.deepEqual(snapshot(), before);
      app.store.db.exec('DROP TRIGGER fail_stage_save');
    }
    // A saved delta and its ACK may legitimately cross separate requests/restarts.
    const splitSave=parse(await send(pushBody([], [saved])));
    assert.deepEqual(splitSave.operations,[],'A save without an ACK must retain every native local reward receipt');
    assert.deepEqual(splitSave.dones,[]);
    assert.deepEqual(app.store.operations(), [operation]);
    await close(); await open();
    const recovered = parse(await send(pushBody([operation], operation.parameters.UserAdventureStage)));
    assert.deepEqual(recovered.data.UserAdventureStage, [saved]);
    assert.deepEqual(recovered.operations,[{id:operation.id}],'Native push removes only the actually committed receipt');
    assert.deepEqual(recovered.dones,recovered.operations);
    assert.deepEqual(app.store.operations(), []);
    const committed = snapshot();
    const repeatedAck=parse(await send(pushBody([operation])));
    assert.deepEqual(repeatedAck.operations,[{id:operation.id}]);
    assert.deepEqual(repeatedAck.dones,repeatedAck.operations);
    assert.deepEqual(app.store.read('UserAdventureStage').data, JSON.parse(committed.profile.find(row => row.name === 'UserAdventureStage').data));
    assert.equal(app.store.hardCurrency(), 2);
    assert.equal((await complete(result)).status, 503);
    const next = parse(await complete({ ...result, token: 'stage-save-next' })).operation;
    assert.deepEqual(next.parameters.gainedItems, []);
    before = snapshot();
    assert.equal((await send(pushBody([next]))).status, 400, 'An older saved clear cannot acknowledge a newer run');
    assert.deepEqual(snapshot(), before);
    const nextSaved = cleared(next, saved.lastCompleteDateTime + 10);
    assert.equal((await send(pushBody([next], [{ ...nextSaved, firstCompleteDateTime: nextSaved.lastCompleteDateTime }]))).status, 400);
    assert.deepEqual(snapshot(), before, 'Original first-clear date must survive subsequent clears');
    // Received objective state 2 also counts as saved completion (0x247be1c).
    nextSaved.tasks = nextSaved.tasks.map(task => result.adventureStageTaskIds.includes(task.adventureStageTaskId)
      ? { ...task, state: 2 } : task);
    nextSaved.dailyClearCount = 0; // A daily reset must not invalidate the lifetime-clear receipt.
    parse(await send(pushBody([next], [nextSaved])));
    await close(); await open();
    const stored = app.store.read('UserAdventureStage').data.find(row => row.adventureStageId === result.adventureStageId);
    assert.deepEqual(stored, nextSaved);
    assert.deepEqual(app.store.operations(), []);
    assert.equal(app.store.hardCurrency(), 2);
    before = snapshot();
    for (const skipCount of [-1, 1.5, '1', 0x80000000]) {
      assert.equal((await complete({ ...result, token: 'invalid-skip', skipCount })).status, 400);
      assert.deepEqual(snapshot(), before);
    }
    const originalProfile = app.store.read('UserAdventureStage');
    for (const change of [{ cumulativeClearCount: -1 }, { cumulativeClearCount: 0x7fffffff },
      { cumulativeClearCount: 999999999 }, { cumulativeClearCount: 1000000000 },
      { dailyClearCount: -1 }, { dailyClearCount: 999999999 }, { dailyClearCount: 1000000000 },
      { dailyClearCount: '2' }, { dailyClearCount: 0.1 },
      { cumulativeClearCount: '2' }, { firstCompleteDateTime: -1 }, { lastCompleteDateTime: 0.1 },
      { userId: 2 }, { tasks: null }]) {
      const rows = originalProfile.data.map(row => row.adventureStageId === result.adventureStageId ? { ...row, ...change } : row);
      app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify(rows), 'UserAdventureStage');
      before = snapshot();
      assert.equal((await complete({ ...result, token: 'bad-saved-stage' })).status, 400);
      assert.deepEqual(snapshot(), before, 'An invalid baseline must not create an unacknowledgeable result');
    }
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify(originalProfile.data), 'UserAdventureStage');
    // Reach the story node through its real preceding quest/clear/save/ACK.
    // Clearing 1-1 opens 1-2, not the still-locked story node at 1-3.
    assert.equal(app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===1010000101103).state,0);
    const preceding=parse(await complete({...result,adventureStageId:1010000101102,token:'story-prerequisite',adventureStageTaskIds:[]})).operation;
    parse(await send(pushBody([preceding],[cleared(preceding,saved.firstCompleteDateTime+20)])));
    assert.equal(app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===1010000101103).state,1);
    const third = parse(await complete({ ...result, token: 'stage-save-third' })).operation;
    const storyBody={adventureStageId:1010000101103,token:'story-save',adventureRecord:{continueCount:0,deathCount:0,turnCount:0}};
    before=snapshot();assert.equal((await complete(storyBody)).status,503);
    assert.deepEqual(snapshot(),before,'Dependent story callbacks must not capture overlapping pre-clear progression');
    // A corrected clock can put a repeat's last date before its preserved first
    // date; the client still increments the clear count. Do not invent a clamp.
    const thirdSaved = cleared(third, saved.firstCompleteDateTime - 1);
    parse(await send(pushBody([third],[thirdSaved])));
    const story = parse(await complete(storyBody)).operation;
    assert.equal(app.store.hardCurrency(),7);
    const storySaved = cleared(story, saved.firstCompleteDateTime + 30);
    before = snapshot();
    assert.equal((await send(pushBody([story]))).status, 400);
    assert.deepEqual(snapshot(), before, 'An unsaved story result cannot discard its ACK');
    parse(await send(pushBody([story], [storySaved])));
    await close(); await open();
    for (const row of [thirdSaved, storySaved])
      assert.deepEqual(app.store.read('UserAdventureStage').data.find(saved => saved.adventureStageId === row.adventureStageId), row);
    assert.deepEqual(app.store.operations(), []);
    assert.equal(app.store.hardCurrency(), 7);
    console.log('Stage saves: reject premature ACKs, preserve clear/objective flags, split save/ACK, atomic rollback, replay and restart OK; native UI unverified');
  } finally {
    await close();
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-stage-save-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
