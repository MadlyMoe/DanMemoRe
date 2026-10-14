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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-familia-first-'));
  const database = path.join(directory, 'profile.sqlite');
  let app, port, sequence = 0, eventDate = '2019-10-20';
  const open = async () => {
    app = createServer({ database, seed, master, eventDate, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const send = (action, value) => request(port, ++sequence, value, String(sequence), action);
  const parse = reply => { assert.equal(reply.status, 200, reply.body.toString()); return JSON.parse(reply.body); };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows), md5(rows), name);
  const save = (putItems = {}, operations = []) => send('user_data/push', { badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: Object.fromEntries(Object.entries(putItems).map(([name, rows]) => [name, md5(rows)])) },
    deltas: [{ signature: 0, trigger: 'FamiliaFirstRewardGet', putItems, deleteItems: {} }],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })) });
  const status = async () => parse(await send('familia/mystatus', {}));
  const claim = () => send('familia/first_reward/receive', { userId: seed.userId });
  const receiptCount = () => app.store.db.prepare('SELECT COUNT(*) n FROM familia_first_reward').get().n;
  const requestCount = () => app.store.db.prepare('SELECT COUNT(*) n FROM familia_first_reward_request').get().n;
  try {
    await open();
    const recommendation=parse(await send('familia/search/random'));
    assert.equal(recommendation.familias.length,1);assert.equal(recommendation.familias[0].familia.id,2);
    assert.equal(recommendation.familias[0].familia.name,'CPURecruit');
    assert.deepEqual(parse(await send('familia/search/random', null)),recommendation);
    for (const value of [{}, { userId: seed.userId }, { count: 50 }])
      assert.equal((await send('familia/search/random', value)).status, 400);
    assert.equal((await claim()).status, 400, 'Absent membership cannot earn a reward');
    const currency = { userId: seed.userId, currencyId: master.currencies['currency.valis'],
      amount: 200000, cumulativeAmount: 200000, reservedAmount: 0, signature: 0 };
    put('UserCurrency', [currency]);
    const creation = parse(await send('familia/create', { name: 'First', description: 'Isolated reward verification.',
      godId: 20000001, style: 21000001, subStyle: 0, activeTime: 22000001, subActiveTime: 22000002,
      requireApproval: false })).operations[0];
    assert.equal((await status()).status.canReceiveFirstReward, false);
    assert.equal((await claim()).status, 400, 'Creation charge must be saved first');
    parse(await save({ UserCurrency: [{ ...currency, amount: 100000 }] }, [creation]));
    assert.equal((await status()).status.canReceiveFirstReward, true);
    assert.equal(Object.hasOwn((await status()).familia, 'canReceiveFirstReward'), false,
      'Native parser reads status, not the similarly adjacent Familia object');
    assert.equal(parse(await send('user/login')).existsFamiliaFirstReward, true);
    const itemId = master.familiaFirstReward.itemId;
    const beforeTicket = { userId: seed.userId, gachaTicketId: itemId, bookEntryState: 1, cumulativeAmount: 2,
      dateList: [{ aquiredAt: 1571400000 }, { aquiredAt: 1571400001 }], signature: 0 };
    put('UserGachaTicket', [beforeTicket]);
    const untouched = () => ({ familia: { ...app.store.db.prepare('SELECT * FROM local_familia').get() },
      iris: app.store.hardCurrency(), paidIris: app.store.paidCurrency(),
      profiles: app.store.db.prepare("SELECT * FROM profile WHERE name!='UserGachaTicket' ORDER BY name").all() });
    const before = untouched();
    for (const value of [null, {}, { userId: 2 }, { userId: String(seed.userId) }, { userId: seed.userId, familiaId: 1 }])
      assert.equal((await send('familia/first_reward/receive', value)).status, 400, JSON.stringify(value));
    for (const change of [{ userId: 2 }, { cumulativeAmount: -1 }, { cumulativeAmount: 999999999 },
      { cumulativeAmount: '2' }, { dateList: null }, { dateList: [{ aquiredAt: '1' }] }]) {
      put('UserGachaTicket', [{ ...beforeTicket, ...change }]);
      assert.equal((await claim()).status, 400, JSON.stringify(change));
      assert.equal(receiptCount(), 0); assert.deepEqual(app.store.operations(), []);
    }
    put('UserGachaTicket', [beforeTicket]);
    for (const sql of [
      "CREATE TRIGGER fail_first BEFORE INSERT ON familia_first_reward BEGIN SELECT RAISE(ABORT, 'receipt rollback'); END",
      "CREATE TRIGGER fail_first BEFORE INSERT ON familia_first_reward_request BEGIN SELECT RAISE(ABORT, 'request rollback'); END",
      "CREATE TRIGGER fail_first BEFORE INSERT ON reply_cache WHEN NEW.action='familia/first_reward/receive' BEGIN SELECT RAISE(ABORT, 'reply rollback'); END",
    ]) {
      app.store.db.exec(sql); assert.equal((await claim()).status, 503);
      assert.equal(receiptCount(), 0); assert.equal(requestCount(), 0); assert.deepEqual(app.store.operations(), []);
      assert.equal((await status()).status.canReceiveFirstReward, true);
      app.store.db.exec('DROP TRIGGER fail_first');
    }
    const reply = await claim(), originalSequence = sequence, response = parse(reply), operation = response.operations[0];
    assert.equal(operation.type, 22300);
    assert.deepEqual(operation.parameters, { gainedItems: [{ itemId, amount: 1 }] });
    assert.deepEqual(response.gainedItems, operation.parameters.gainedItems);
    assert.deepEqual(response.operation, { ...operation, parameters: { ...operation.parameters,
      result: 0, gainedItems: response.gainedItems, existsFamiliaFirstReward: false } });
    assert.equal(response.existsFamiliaFirstReward, false); assert.equal(receiptCount(), 1); assert.equal(requestCount(), 1);
    assert.deepEqual(app.store.read('UserGachaTicket').data, [beforeTicket], 'Only the native operation grants inventory');
    assert.equal((await status()).status.canReceiveFirstReward, false);
    assert.deepEqual(parse(await claim()), response, 'New identity reuses the pending reward');
    assert.equal(requestCount(), 2, 'Every accepted transport identity permanently binds to the one reward operation');
    const replay = () => request(port, originalSequence, { userId: seed.userId }, String(originalSequence), 'familia/first_reward/receive');
    assert.deepEqual((await replay()).body, reply.body);
    app.store.db.prepare("DELETE FROM reply_cache WHERE action='familia/first_reward/receive'").run();
    assert.deepEqual((await replay()).body, reply.body, 'Permanent request proof survives generic cache loss');
    await close(); await open();
    assert.deepEqual((await replay()).body, reply.body); assert.deepEqual(parse(await claim()), response);
    assert.equal((await save({}, [operation])).status, 400, 'Bare ACK cannot discard an ungranted ticket');
    for (const change of [{ cumulativeAmount: 2 }, { cumulativeAmount: '3' }, { userId: 2 }, { dateList: null }]) {
      assert.equal((await save({ UserGachaTicket: [{ ...beforeTicket, cumulativeAmount: 3, ...change }] }, [operation])).status, 400);
      assert.deepEqual(app.store.read('UserGachaTicket').data, [beforeTicket]);
    }
    assert.equal((await save({UserGachaTicket:[{...beforeTicket,cumulativeAmount:3,
      dateList:[...beforeTicket.dateList,{aquiredAt:app.store.gameNowSeconds()}],signature:0}]})).status,400,
    'A cumulative target without the native operation signature is not proof of application');
    const gained = { ...beforeTicket, cumulativeAmount: 3,
      dateList: [...beforeTicket.dateList, { aquiredAt: app.store.gameNowSeconds() }], signature: operation.signature };
    app.store.db.exec("CREATE TRIGGER fail_first_observation BEFORE UPDATE OF observed_cumulative ON familia_first_reward BEGIN SELECT RAISE(ABORT,'observation rollback'); END");
    assert.equal((await save({UserGachaTicket:[gained]})).status,503);
    assert.deepEqual(app.store.read('UserGachaTicket').data,[beforeTicket]);
    assert.equal(app.store.db.prepare('SELECT observed_cumulative FROM familia_first_reward').get().observed_cumulative,null);
    app.store.db.exec('DROP TRIGGER fail_first_observation');
    parse(await save({ UserGachaTicket: [gained] }));
    const observed=app.store.db.prepare('SELECT * FROM familia_first_reward WHERE user_id=?').get(seed.userId);
    assert.equal(observed.observed_cumulative,3);assert.equal(observed.observed_signature,operation.signature);
    assert.match(observed.observation_hash,/^[0-9a-f]{32}$/);
    const savedReplay=parse(await replay());
    assert.deepEqual(savedReplay.gainedItems,[],'A saved pre-ACK ticket is omitted from hot redelivery');
    assert.deepEqual(savedReplay.operations,[{...operation,parameters:{gainedItems:[]}}]);
    assert.deepEqual(savedReplay.operation,{...operation,parameters:{gainedItems:[],result:0,
      existsFamiliaFirstReward:false}});
    app.store.db.prepare("UPDATE familia_first_reward SET observation_hash='00000000000000000000000000000000' WHERE user_id=?")
      .run(seed.userId);
    assert.equal((await send('user_data/confirm',null)).status,503,
      'A damaged saved-effect observation cannot suppress the native ticket grant');
    app.store.db.prepare('UPDATE familia_first_reward SET observation_hash=? WHERE user_id=?')
      .run(observed.observation_hash,seed.userId);
    app.store.db.prepare(`UPDATE familia_first_reward SET observed_cumulative=NULL,observed_signature=NULL,
      observed_at=NULL,observation_hash=NULL WHERE user_id=?`).run(seed.userId);
    await close(); await open();
    const migrated=app.store.db.prepare('SELECT * FROM familia_first_reward WHERE user_id=?').get(seed.userId);
    assert.equal(migrated.observed_cumulative,3);assert.equal(migrated.observed_signature,operation.signature);
    assert.match(migrated.observation_hash,/^[0-9a-f]{32}$/,
      'An exact legacy split-save target migrates without replaying the reward');
    const confirmation=parse(await send('user_data/confirm',null));
    assert.deepEqual(confirmation.operations,[{...operation,parameters:{gainedItems:[]}}],
      'Cold confirmation retains the real operation identity but has no remaining ticket effect');
    parse(await save({}, [operation]));
    assert.deepEqual(app.store.operations(), []); assert.equal(receiptCount(), 1);
    const finished = { code: 0, result: 0, gainedItems: [], operations: [], existsFamiliaFirstReward: false };
    assert.deepEqual(parse(await replay()), finished,
      'An exact pre-ACK transport retry becomes a safe settled response instead of reminting its operation');
    assert.deepEqual(parse(await claim()), finished);
    const settledSequence=sequence,settledReplay=()=>request(port,settledSequence,{userId:seed.userId},
      String(settledSequence),'familia/first_reward/receive');
    assert.equal(requestCount(),4);
    app.store.db.prepare("DELETE FROM reply_cache WHERE action='familia/first_reward/receive'").run();
    await close(); await open();
    assert.deepEqual(parse(await settledReplay()),finished,'Settled request identity survives restart and cache loss');
    const originalRequest=app.store.db.prepare('SELECT * FROM familia_first_reward_request WHERE request_key=?')
      .get(`${originalSequence}/${originalSequence}`);
    app.store.db.prepare("UPDATE familia_first_reward_request SET response_hash='00000000000000000000000000000000' WHERE request_key=?")
      .run(originalRequest.request_key);
    assert.equal((await replay()).status,503,'A damaged permanent delivery capture cannot replay');
    app.store.db.prepare('UPDATE familia_first_reward_request SET response_hash=? WHERE request_key=?')
      .run(originalRequest.response_hash,originalRequest.request_key);
    const legacySequence=900000002,legacyKey=`${legacySequence}/${legacySequence}`,
      legacyWire=Buffer.from(JSON.stringify({userId:seed.userId}));
    app.store.db.prepare('INSERT INTO reply_cache(key,action,body_hash,content_type,body) VALUES(?,?,?,?,?)')
      .run(legacyKey,'familia/first_reward/receive',crypto.createHash('md5').update(legacyWire).digest('hex'),
        'application/json',Buffer.from(JSON.stringify(finished)).toString('base64'));
    assert.equal((await request(port,legacySequence,{userId:seed.userId},String(legacySequence),
      'familia/first_reward/receive')).status,503,
    'A generic cached success cannot replace a permanent Familia reward request');
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(legacyKey);
    assert.equal((await save({ UserGachaTicket: [beforeTicket] })).status, 400, 'Stale saves cannot erase the granted ticket');
    // Spending the ticket before a repeated ACK is valid: lifetime acquisition
    // still proves the award even when no unspent dateList entry remains.
    const spent = { ...gained, dateList: [] };
    parse(await save({ UserGachaTicket: [spent] }, [operation]));
    app.store.db.exec('DELETE FROM reply_cache');
    await close(); eventDate = '2022-08-20'; await open();
    assert.deepEqual(parse(await claim()), finished, 'Event-clock changes cannot reset a lifetime reward');
    assert.equal((await status()).status.canReceiveFirstReward, false);
    assert.equal(parse(await send('user/login')).existsFamiliaFirstReward, false);
    assert.deepEqual(app.store.read('UserGachaTicket').data, [spent]);
    assert.deepEqual(untouched(), before, 'Reward must not alter any unrelated profile or wallet');
    assert.deepEqual(parse(await send('familia/search/random')), { code: 0, familias: [] }, 'Own Familia is not a remote recommendation');
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    console.log('Familia first reward: native operation22300, once-only receipt, save/ACK, replay, rollback, clock and restart: OK');
  } finally {
    await close();
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-familia-first-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
