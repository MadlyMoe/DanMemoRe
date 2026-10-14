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
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-familia-break-'));
  let app, port, sequence = 0;
  const open = async () => {
    app = createServer({ database: path.join(directory, 'profile.sqlite'), seed, master,
      eventDate: '2019-10-20', log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const send = (action, value) => request(port, ++sequence, value, String(sequence), action);
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows), md5(rows), name);
  const save = (putItems, operations = []) => send('user_data/push', {
    badges: null, scripts: {}, dataTokens: {}, checksums: { before: {},
      after: Object.fromEntries(Object.entries(putItems).map(([name, rows]) => [name, md5(rows)])) },
    deltas: [{ signature: 0, trigger: 'Familia', putItems, deleteItems: {} }],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })),
  });
  const settings = { name: 'BreakTest', description: 'Isolated lifecycle test.', godId: 20000001,
    style: 21000001, subStyle: 0, activeTime: 22000001, subActiveTime: 22000002, requireApproval: false };
  const noFamilia = { code: 0, result: 0, status: { familiaId: 0 }, members: [] };
  const currency = { userId: seed.userId, currencyId: master.currencies['currency.valis'],
    amount: 500000, cumulativeAmount: 500000, reservedAmount: 0, signature: 0 };
  const ledger = () => Object.fromEntries(['hard_currency','familia_first_reward','familia_item_donation',
    'familia_valis_donation','familia_creation','familia_valis_spending_floor','operation_done']
    .map(table => [table, app.store.db.prepare(`SELECT * FROM ${table}`).all()]));
  try {
    await open();
    assert.equal((await send('familia/break')).status, 400, 'No membership is not a successful disband');
    put('UserCurrency', [currency]);
    const creation = parse(await send('familia/create', settings)).operations[0];
    assert.equal((await send('familia/break')).status, 400, 'Pending creation must not be discarded');
    parse(await save({ UserCurrency: [{ ...currency, amount: 400000 }] }, [creation]));
    const profile = app.store.read('UserProfile').data[0];
    put('UserProfile', [{ ...profile, familiaName: settings.name }]);
    const skill = Object.entries(master.familiaSkills).find(([, row]) => row.level === 1);
    app.store.db.prepare('INSERT INTO familia_skill_upgrade VALUES(?,?,?)').run(Number(skill[0]), skill[1].cost, app.store.gameNowSeconds());
    const background = Object.entries(master.familiaShops).find(([, row]) => row.type === 2 && !row.isDefault);
    app.store.db.prepare('INSERT INTO familia_shop_purchase VALUES(?,?,?,?,?)')
      .run(Number(background[0]), 2, background[1].rewardId, background[1].price, app.store.gameNowSeconds());
    app.store.db.prepare('INSERT OR REPLACE INTO familia_shop_setting VALUES(?,?,?)')
      .run(2, Number(background[0]), app.store.gameNowSeconds());
    app.store.db.prepare('UPDATE local_familia SET skill_point=6,valis=1500,contribution_point=900').run();
    const rewardResponse=await send('familia/first_reward/receive',{userId:seed.userId}),
      rewardSequence=sequence,reward=parse(rewardResponse).operations[0];
    const ticket = { userId: seed.userId, gachaTicketId: master.familiaFirstReward.itemId, bookEntryState: 1,
      cumulativeAmount: 1, dateList: [{ aquiredAt: app.store.gameNowSeconds() }], signature: reward.signature };
    assert.equal((await send('familia/break')).status, 400, 'Unsettled inventory reward must remain queued');
    parse(await save({ UserGachaTicket: [ticket] }, [reward]));
    const before = ledger(), beforeProfile = app.store.read('UserProfile').data;
    const detailBody = { familiaId: 1 }, detailResponse = await send('familia/get', detailBody), detailSequence = sequence;
    assert.equal(parse(detailResponse).familia.name, settings.name);
    for (const value of [{}, { familiaId: 1 }, { userId: seed.userId }])
      assert.equal((await send('familia/break', value)).status, 400, 'Only the native empty/null request is accepted');
    for (const sql of [
      "CREATE TRIGGER fail_break BEFORE INSERT ON familia_dissolution BEGIN SELECT RAISE(ABORT,'archive rollback'); END",
      "CREATE TRIGGER fail_break BEFORE INSERT ON familia_dissolution_request BEGIN SELECT RAISE(ABORT,'request rollback'); END",
      "CREATE TRIGGER fail_break BEFORE DELETE ON local_familia BEGIN SELECT RAISE(ABORT,'delete rollback'); END",
      "CREATE TRIGGER fail_break BEFORE INSERT ON reply_cache WHEN NEW.action='familia/break' BEGIN SELECT RAISE(ABORT,'reply rollback'); END",
    ]) {
      app.store.db.exec(sql); assert.equal((await send('familia/break')).status, 503);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM local_familia').get().n, 1);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_dissolution').get().n, 0);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_dissolution_request').get().n,0);
      assert.deepEqual(app.store.read('UserProfile').data, beforeProfile); assert.deepEqual(ledger(), before);
      app.store.db.exec('DROP TRIGGER fail_break');
    }
    const response = await send('familia/break', null), disbandSequence = sequence;
    assert.deepEqual(parse(response), { code: 0, result: 0 });
    assert.deepEqual(parse(await send('familia/mystatus')), noFamilia);
    assert.equal((await send('familia/get', detailBody)).status, 503, 'Disbanded guilds have no public details');
    assert.equal((await request(port, detailSequence, detailBody, String(detailSequence), 'familia/get')).status, 503,
      'A cached member list cannot restore a disbanded guild');
    assert.deepEqual(app.store.read('UserProfile').data, [{ ...profile, familiaName: '' }]);
    assert.deepEqual(ledger(), before); assert.deepEqual(app.store.operations(), []);
    const archive = app.store.db.prepare('SELECT * FROM familia_dissolution').get();
    const snapshot = JSON.parse(archive.snapshot);
    assert.equal(archive.snapshot_hash,crypto.createHash('md5').update(archive.snapshot).digest('hex'));
    const disbandKey=`${disbandSequence}/${disbandSequence}`,
      disbandReceipt=app.store.db.prepare('SELECT * FROM familia_dissolution_request WHERE request_key=?').get(disbandKey);
    assert.equal(disbandReceipt.creation_operation_id,creation.id);
    assert.equal(disbandReceipt.response,'{"code":0,"result":0}');
    assert.equal(disbandReceipt.response_hash,crypto.createHash('md5').update(disbandReceipt.response).digest('hex'));
    assert.equal(snapshot.familia.creation_operation_id, creation.id);
    assert.equal(snapshot.familia.skill_point, 6); assert.equal(snapshot.familia.valis, 1500);
    assert.equal(snapshot.familia_skill_upgrade.length, 1); assert.equal(snapshot.familia_shop_purchase.length, 1);
    for (const table of ['local_familia','familia_skill_upgrade','familia_shop_purchase','familia_shop_setting','familia_board_post'])
      assert.equal(app.store.db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n, 0, table);
    const aliasResponse=await send('familia/break'),aliasSequence=sequence,
      aliasKey=`${aliasSequence}/${aliasSequence}`;
    assert.deepEqual(parse(aliasResponse), { code: 0, result: 0 }, 'A retry without membership is idempotent');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_dissolution').get().n, 1);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_dissolution_request').get().n,2,
      'Every accepted disband transport identity is permanently bound to the same generation');
    const aliasReceipt=app.store.db.prepare('SELECT * FROM familia_dissolution_request WHERE request_key=?').get(aliasKey);
    assert.notEqual(aliasReceipt.body_hash,disbandReceipt.body_hash,'Empty and encrypted-null requests retain actual bytes');
    app.store.db.prepare("UPDATE familia_dissolution_request SET response_hash='00000000000000000000000000000000' WHERE request_key=?")
      .run(aliasKey);
    assert.equal((await request(port,aliasSequence,undefined,String(aliasSequence),'familia/break')).status,503,
      'A damaged disband response proof cannot replay');
    app.store.db.prepare('UPDATE familia_dissolution_request SET response_hash=? WHERE request_key=?')
      .run(aliasReceipt.response_hash,aliasKey);
    app.store.db.prepare("UPDATE familia_dissolution SET snapshot_hash='00000000000000000000000000000000' WHERE creation_operation_id=?")
      .run(creation.id);
    assert.equal((await request(port,disbandSequence,null,String(disbandSequence),'familia/break')).status,503,
      'A damaged dissolution archive cannot replay');
    app.store.db.prepare('UPDATE familia_dissolution SET snapshot_hash=? WHERE creation_operation_id=?')
      .run(archive.snapshot_hash,creation.id);
    const legacySequence=900000001,legacyKey=`${legacySequence}/${legacySequence}`;
    app.store.db.prepare('INSERT INTO reply_cache(key,action,body_hash,content_type,body) VALUES(?,?,?,?,?)')
      .run(legacyKey,'familia/break',crypto.createHash('md5').update(Buffer.alloc(0)).digest('hex'),
        'application/json',response.body.toString('base64'));
    assert.equal((await request(port,legacySequence,undefined,String(legacySequence),'familia/break')).status,503,
      'A generic cached success cannot replace a permanent dissolution request');
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(legacyKey);
    parse(await save({ UserProfile: [{ ...profile, familiaName: settings.name }] }));
    assert.equal(app.store.read('UserProfile').data[0].familiaName, '', 'A stale label cannot restore membership');
    assert.equal((await save({ UserProfile: [{ ...profile, familiaName: 'Foreign' }] })).status, 400);
    app.store.db.prepare("DELETE FROM reply_cache WHERE action IN ('familia/break','familia/first_reward/receive')").run();
    await close(); await open();
    assert.deepEqual(parse(await send('familia/mystatus')), noFamilia);
    assert.deepEqual({ ...app.store.db.prepare('SELECT * FROM familia_dissolution').get() }, { ...archive });
    const second = { ...settings, name: 'Second' };
    const newCreation = parse(await send('familia/create', second)).operations[0];
    parse(await save({ UserCurrency: [{ ...currency, amount: 300000 }] }, [newCreation]));
    parse(await save({ UserProfile: [{ ...profile, familiaName: settings.name }] }));
    assert.equal(app.store.read('UserProfile').data[0].familiaName, 'Second');
    assert.equal(parse(await send('familia/mystatus')).familia.name, 'Second');
    assert.equal(parse(await send('familia/get', detailBody)).familia.name, 'Second');
    assert.equal((await request(port, detailSequence, detailBody, String(detailSequence), 'familia/get')).status, 503,
      'An old detail snapshot cannot overwrite a recreated group using the local ID');
    assert.equal(parse(await send('familia/mystatus')).status.canReceiveFirstReward, false);
    assert.deepEqual(parse(await send('familia/first_reward/receive', { userId: seed.userId })).gainedItems, []);
    assert.deepEqual(app.store.read('UserGachaTicket').data, [ticket], 'Recreation cannot award the lifetime ticket again');
    const oldRewardReplay=parse(await request(port,rewardSequence,{userId:seed.userId},String(rewardSequence),
      'familia/first_reward/receive'));
    assert.deepEqual(oldRewardReplay,{code:0,result:0,gainedItems:[],operations:[],existsFamiliaFirstReward:false},
      'An old reward transport settles against its archived generation without redelivering the ticket');
    assert.equal(parse(await send('familia/mystatus')).familia.name,'Second',
      'An old reward transport cannot alter the recreated Familia');
    const replay = await request(port, disbandSequence, null, String(disbandSequence), 'familia/break');
    assert.deepEqual(replay.body, response.body);
    const aliasReplay=await request(port,aliasSequence,undefined,String(aliasSequence),'familia/break');
    assert.deepEqual(aliasReplay.body,aliasResponse.body);
    assert.equal(parse(await send('familia/mystatus')).familia.name, 'Second', 'Old transport replay must not disband the new group');
    assert.equal((await request(port, disbandSequence, {}, String(disbandSequence), 'familia/break')).status, 400);
    await close(); await open();
    assert.equal(parse(await send('familia/mystatus')).familia.name, 'Second');
    assert.equal(parse(await send('familia/get', detailBody)).familia.name, 'Second');
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    console.log('Familia disband: original empty contract, archive, rollback, stale labels, lifetime reward, recreation, replay and restart: OK');
  } finally {
    await close();
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-familia-break-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
