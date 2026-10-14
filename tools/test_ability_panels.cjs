'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = value => crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-panels-'));
  const database = path.join(directory, 'save.sqlite');
  const pcId = 1011001001, jobs = master.pcProfiles[pcId].jobIds;
  const board = Object.entries(master.pcAbilityPanels).filter(([,panel]) => panel.groupId === master.pcJobPanelGroups[jobs[0]]);
  const normal = board.filter(([,panel]) => master.pcAbilityTypes[panel.abilityId] !== 1);
  const [panelId, panel] = normal[0], mask = 1 << (panel.index - 1);
  const value = { consumeId: 81031001, detailId: Number(panelId), payload: { pcId } };
  let app, port, sequence = 0;
  const open = async () => {
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const send = (body, action = 'currency/hard/consume') => request(port, ++sequence, body, String(sequence), action);
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const save = (putItems = {}, operation = null, deleteItems = {}) => ({ badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: Object.fromEntries([...new Set([...Object.keys(putItems), ...Object.keys(deleteItems)])]
      .map(name => [name, md5(putItems[name] ?? [])])) },
    deltas: Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ putItems, deleteItems, signature: 0, trigger: 'AbilityPanel' }] : [],
    operations: operation ? [{ id: operation.id, verifier: operation.token }] : [] });
  const balance = () => [app.store.hardCurrency(), app.store.paidCurrency()];
  const currentSet = () => structuredClone(app.store.read('UserPCJobSet').data.find(row => row.pcId === pcId));
  const openedSet = () => {
    const set = currentSet();
    set.pcJobs.find(row => row.pcJobId === jobs[0]).abilityPanelState |= mask | 0x2000000;
    return set;
  };
  try {
    await open();
    assert.equal((await send(value)).status, 400, 'An empty wallet cannot buy a panel');
    assert.deepEqual(app.store.operations(), []);
    // Synthetic isolated wallet only. Prices, IDs and groups are original data.
    app.store.changeHardCurrency(panel.irisCost - 1); app.store.changePaidCurrency(1000);
    const funded = balance();
    assert.equal((await send({ ...value, detailId: 1 })).status, 400);
    assert.equal((await send({ ...value, payload: { pcId: 1011002001 } })).status, 400, 'A catalog PC is not proof of ownership');
    const modern = currentSet(), legacy = currentSet(); legacy.pcJobs[0].abilityPanels = [{}];
    parse(await send(save({ UserPCJobSet: [legacy] }), 'user_data/push'));
    assert.equal((await send(value)).status, 503, 'Unknown legacy list conversion does not charge Iris');
    assert.deepEqual(balance(), funded);
    parse(await send(save({ UserPCJobSet: [modern] }), 'user_data/push'));
    for (const trigger of [
      "CREATE TRIGGER panel_fail BEFORE INSERT ON ability_panel_purchase BEGIN SELECT RAISE(ABORT,'receipt failure'); END",
      "CREATE TRIGGER panel_fail BEFORE INSERT ON hard_currency_consume_request BEGIN SELECT RAISE(ABORT,'transport failure'); END",
      "CREATE TRIGGER panel_fail BEFORE INSERT ON reply_cache WHEN NEW.action='currency/hard/consume' BEGIN SELECT RAISE(ABORT,'reply failure'); END",
    ]) {
      app.store.db.exec(trigger);
      assert.equal((await send(value)).status, 503);
      assert.deepEqual(balance(), funded); assert.deepEqual(app.store.operations(), []);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM ability_panel_purchase').get().n, 0);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM hard_currency_consume_request').get().n, 0);
      app.store.db.exec('DROP TRIGGER panel_fail');
    }
    const sentSequence = ++sequence, result = parse(await request(port, sentSequence, value, String(sentSequence), 'currency/hard/consume'));
    const operation = result.operation;
    assert.equal(operation.type, 10300); assert.deepEqual(operation.parameters, value);
    assert.deepEqual(result.operations, [operation]); assert.deepEqual(balance(), [0,999]);
    const transport=app.store.db.prepare(`SELECT body_hash,operation_id FROM hard_currency_consume_request
      WHERE request_key=?`).get(`${sentSequence}/${sentSequence}`);
    assert.equal(transport.operation_id,operation.id);assert.match(transport.body_hash,/^[0-9a-f]{32}$/);
    assert.ok(!(currentSet().pcJobs[0].abilityPanelState & mask), 'Do not pre-publish the client-owned opened bit');
    assert.deepEqual(parse(await request(port, sentSequence, value, String(sentSequence), 'currency/hard/consume')), result);
    assert.equal((await request(port,sentSequence,{...value,detailId:Number(normal[1][0])},String(sentSequence),
      'currency/hard/consume')).status,400,'One received request identity cannot name a different panel');
    assert.deepEqual(parse(await send({ payload: { pcId }, detailId: Number(panelId), consumeId: 81031001 })), result);
    assert.deepEqual(balance(), [0,999]);
    assert.equal((await send({ ...value, detailId: Number(normal[1][0]) })).status, 503, 'No overlapping unsaved panel on the same PC');
    assert.equal((await send(save({}, operation), 'user_data/push')).status, 400, 'ACK requires its opened bit');
    assert.equal((await send(save({}, null, { UserPCJobSet: [currentSet()] }), 'user_data/push')).status, 400,
      'An unapplied paid operation cannot lose its target job');
    assert.equal((await send(save({ UserPCJobSet: [{ ...currentSet(), pcJobs: {} }] }, operation), 'user_data/push')).status, 400);
    const wrongOwner = { ...openedSet(), userId: 2 };
    assert.equal((await send(save({ UserPCJobSet: [wrongOwner] }, operation), 'user_data/push')).status, 400);
    const wrongJob = currentSet(); wrongJob.pcJobs[1].abilityPanelState |= mask;
    assert.equal((await send(save({ UserPCJobSet: [wrongJob] }, operation), 'user_data/push')).status, 400);
    assert.deepEqual(app.store.operations(), [operation]);
    // Session cache eviction and listener restart do not repeat the debit.
    app.store.beginSession(); await close(); await open();
    assert.deepEqual(parse(await request(port,sentSequence,value,String(sentSequence),'currency/hard/consume')),result);
    assert.deepEqual(parse(await send(value)), result); assert.deepEqual(balance(), [0,999]);
    assert.deepEqual(app.store.operations(), [operation]);
    const opened = openedSet();
    parse(await send(save({ UserPCJobSet: [opened] }), 'user_data/push'));
    await close(); await open();
    const stale = structuredClone(opened); stale.pcJobs[0].abilityPanelState &= ~mask;
    assert.equal((await send(save({ UserPCJobSet: [stale] }), 'user_data/push')).status, 400, 'Split save cannot regress its purchased bit');
    parse(await send(save({}, operation), 'user_data/push'));
    assert.deepEqual(app.store.operations(), []);
    assert.equal((await request(port,sentSequence,value,String(sentSequence),'currency/hard/consume')).status,503,
      'A settled request identity cannot create or replay another purchase');
    assert.equal((await send(save({}, null, { UserPCJobSet: [opened] }), 'user_data/push')).status, 400);
    const duplicate = structuredClone(opened); duplicate.pcJobs.push({ ...duplicate.pcJobs[0] });
    assert.equal((await send(save({ UserPCJobSet: [duplicate] }), 'user_data/push')).status, 400);
    assert.equal((await send(value)).status, 400, 'An opened panel cannot charge again');
    const rankUp = board.find(([,row]) => master.pcAbilityTypes[row.abilityId] === 1);
    assert.ok(rankUp);
    assert.equal((await send({ ...value, detailId: Number(rankUp[0]) })).status, 400, 'Rank up uses a different progression path');
    const secondBoard = Object.entries(master.pcAbilityPanels).find(([,row]) =>
      row.groupId === master.pcJobPanelGroups[jobs[1]] && master.pcAbilityTypes[row.abilityId] !== 1);
    assert.equal((await send({ ...value, detailId: Number(secondBoard[0]) })).status, 400, 'Locked rank cannot be opened');
    // Synthetic rank2 prerequisite still cannot let operation10300 select the
    // wrong first incomplete board. Completing the original prior panel bits
    // makes that same operation safe; this is NOT native rank-up proof.
    const pc = { ...app.store.read('UserPC').data.find(row => row.pcId === pcId), currentJobIndex: 2 };
    parse(await send(save({ UserPC: [pc] }), 'user_data/push'));
    assert.equal((await send({ ...value, detailId: Number(secondBoard[0]) })).status, 503);
    const complete = currentSet();
    for (const [,row] of board) complete.pcJobs[0].abilityPanelState |= 1 << (row.index - 1);
    parse(await send(save({ UserPCJobSet: [complete] }), 'user_data/push'));
    const next = parse(await send({ ...value, detailId: Number(secondBoard[0]) })).operation;
    assert.equal(next.type, 10300); assert.deepEqual(balance(), [0,999 - secondBoard[1].irisCost]);
    const nextSave = currentSet(); nextSave.pcJobs[1].abilityPanelState |= 1 << (secondBoard[1].index - 1);
    parse(await send(save({ UserPCJobSet: [nextSave] }, next), 'user_data/push'));
    await close(); await open();
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM ability_panel_purchase').get().n, 2);
    assert.deepEqual(app.store.operations(), []);
    const lbJob = master.pcLimitBreakJobs[pcId], lbGroup = master.pcJobPanelGroups[lbJob];
    const lbPanels = Object.entries(master.pcAbilityPanels).filter(([,row]) => row.groupId === lbGroup);
    const lbFirst = lbPanels.find(([,row]) => row.index === 1), lbSecond = lbPanels.find(([,row]) => row.index === 6);
    const lbValue = { ...value, detailId: Number(lbFirst[0]) }, beforeLb = balance();
    assert.equal((await send(lbValue)).status, 400, 'Maximum normal rank is required');
    const maximum = { ...app.store.read('UserPC').data.find(row => row.pcId === pcId), currentJobIndex: jobs.length };
    parse(await send(save({ UserPC: [maximum] }), 'user_data/push'));
    assert.equal((await send(lbValue)).status, 400, 'Zero limit breaks cannot open the extra board');
    parse(await send(save({ UserPC: [{ ...maximum, limitbreakCount: 1 }] }), 'user_data/push'));
    assert.equal((await send(lbValue)).status, 503, 'Do not invent a missing native extra-job save');
    const lbSet = currentSet();
    lbSet.pcJobs.push({ ...lbSet.pcJobs[0], pcJobId: lbJob, abilityPanelState: 0x2000000 });
    parse(await send(save({ UserPCJobSet: [lbSet] }), 'user_data/push'));
    assert.equal((await send(lbValue)).status, 503, 'Operation10300 must not target an unfinished earlier rank board');
    for (const job of lbSet.pcJobs.filter(row => jobs.includes(row.pcJobId)))
      for (const panel of Object.values(master.pcAbilityPanels).filter(row => row.groupId === master.pcJobPanelGroups[job.pcJobId]))
        job.abilityPanelState |= 1 << (panel.index - 1);
    parse(await send(save({ UserPCJobSet: [lbSet] }), 'user_data/push'));
    assert.equal((await send({ ...lbValue, detailId: Number(lbSecond[0]) })).status, 400, 'Only indices1..5 are unlocked by the first limit break');
    assert.deepEqual(balance(), beforeLb);
    const lbResult = parse(await send(lbValue)), lbOp = lbResult.operation;
    assert.deepEqual(balance(), [beforeLb[0],beforeLb[1] - lbFirst[1].irisCost]);
    app.store.beginSession(); await close(); await open();
    assert.deepEqual(parse(await send(lbValue)), lbResult);
    const openedLb = currentSet(); openedLb.pcJobs.find(row => row.pcJobId === lbJob).abilityPanelState |= 1;
    assert.equal((await send(save({ UserPC: [{ ...maximum, limitbreakCount: 0 }], UserPCJobSet: [openedLb] }, lbOp), 'user_data/push')).status, 400);
    parse(await send(save({ UserPCJobSet: [openedLb] }, lbOp), 'user_data/push'));
    parse(await send(save({ UserPC: [{ ...maximum, limitbreakCount: 2 }] }), 'user_data/push'));
    const secondLbOp = parse(await send({ ...lbValue, detailId: Number(lbSecond[0]) })).operation;
    const secondLbSave = currentSet(); secondLbSave.pcJobs.find(row => row.pcJobId === lbJob).abilityPanelState |= 1 << 5;
    parse(await send(save({ UserPCJobSet: [secondLbSave] }, secondLbOp), 'user_data/push'));
    assert.equal((await send(save({ UserPC: [{ ...maximum, limitbreakCount: 1 }] }), 'user_data/push')).status, 400,
      'A later PC save cannot relock a purchased second-limit-break panel');
    await close(); await open();
    assert.deepEqual(app.store.operations(), []);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM ability_panel_purchase').get().n, 4);
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    console.log('Ability panels: original costs, free/paid debit, rollback, hot/cold delivery, rank/limit-break/index/order guards and saved-bit persistence OK; native UI pending');
  } finally {
    await close(); fs.rmSync(directory, { recursive: true, force: true });
  }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
