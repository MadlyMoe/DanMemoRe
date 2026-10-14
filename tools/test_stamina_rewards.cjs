'use strict';

// Isolated synthetic receipts/save ordering; not native SP application,
// regeneration, gift provenance, natural mission unlocks or gameplay acceptance.
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
const missions = Object.entries(master.achievements).filter(([, row]) => row.rewardType === 10);
const cap = 0x7fffffff;

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-stamina-rewards-'));
  let app, port, database, sequence = 0, now = Math.max(...missions.map(([, row]) => row.startAt)) + 5;
  const open = async () => {
    app = createServer({ database, seed, master, wallNowSeconds: () => now, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows), md5(rows), name);
  const info = amount => {
    const rows = structuredClone(app.store.read('UserInfo').data); rows[0].playerStatus.baseSP = amount; return rows;
  };
  const fresh = async name => {
    await close(); database = path.join(directory, `${name}.sqlite`); await open();
    put('UserInfo', info(7)); app.store.changeHardCurrency(100);
  };
  const send = (action, value) => request(port, ++sequence, value, String(sequence), action);
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name, app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all()]));
  const reject = async (reply, status, before, unavailable = false) => {
    const response = await reply; assert.equal(response.status, status, response.body.toString()); assert.equal(snapshot(), before);
    if (unavailable) assert.equal(JSON.parse(response.body).code, OFFLINE_UNAVAILABLE_CODE);
  };
  const gift = (id, amount = 10) => ({ userId: seed.userId, id, itemId: master.currencies['currency.stamina'], amount,
    title: 'Synthetic SP present', message: '', senderType: 1, senderId: 0, giftAcquiredType: 2, itemLevel: 0,
    equipmentId: 0, equipmentEvolveCount: 0, pcLimitBreakCount: 0, pcHeroSublimateCount: 0, state: 0,
    startAt: now - 1, expireAt: now + 100, createdAt: now, dynamodbExpireAt: 0 });
  const claim = (index = 0) => ({ userId: seed.userId, achievementId: Number(missions[index][0]), completedAt: now,
    lastResetAt: 0, progressParam: 1, readState: 1, signature: 0, state: 3 });
  const push = (putItems = {}, operations = [], deleteItems = {}) => send('user_data/push', {
    badges: null, scripts: {}, dataTokens: {}, checksums: { before: {}, after: Object.fromEntries(
      [...new Set([...Object.keys(putItems), ...Object.keys(deleteItems)])].map(name => [name, md5(putItems[name] ?? [])])) },
    deltas: Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature: 0, trigger: 'Stamina', putItems, deleteItems }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })),
  });
  const wire = (kind, id = 1, index = 0) => kind === 'gift' ? ['gift/receive', { userId: seed.userId, giftIds: [id] }]
    : kind === 'mission' ? ['achievement/complete', { achievementIds: [{ achievementId: Number(missions[index][0]), completedAt: now }] }]
      : ['currency/hard/consume', { consumeId: 81041001 }];
  const issue = async (kind, id = 1, index = 0) => {
    const [action, value] = wire(kind, id, index), response = await send(action, value), identity = sequence;
    return { kind, action, value, response, identity, op: parse(response).operations[0] };
  };
  const table = op => op.type === 10200 ? 'hard_currency_consume' : 'stamina_reward_claim';
  const receipt = op => app.store.db.prepare(`SELECT * FROM ${table(op)} WHERE operation_id=?`).get(op.id);
  const flags = () => ({ UserGift: app.store.read('UserGift').data.map(row => ({ ...row, state: 1 })),
    UserAchievement: app.store.read('UserAchievement').data.map(row => ({ ...row, state: 4 })) });
  try {
    assert.equal(missions.length, 2, 'Use both final authored SP missions; do not invent permanent missions');
    await fresh('aggregate-replay'); put('UserGift', [gift(1, 2), gift(2, 3)]);
    const body = { userId: seed.userId, giftIds: [2,1] }, response = await send('gift/receive', body), identity = sequence;
    const aggregate = parse(response), aggregateOp = aggregate.operations[0];
    assert.deepEqual(aggregate.receivedItems, [{ itemId: master.currencies['currency.stamina'], amount: 5 }]);
    assert.equal(receipt(aggregateOp).sp_minimum, 12); assert.equal(receipt(aggregateOp).amount, 5);
    await close(); await open(); now += 1000;
    assert.deepEqual(parse(await send('gift/receive', body)).operations, [aggregateOp], 'Pending reward survives present expiry');
    assert.deepEqual((await request(port, identity, body, String(identity), 'gift/receive')).body, response.body);
    parse(await push({ ...flags(), UserInfo: info(12) }, [aggregateOp]));
    app.store.beginSession(); await close(); await open();
    await reject(send('gift/receive', body), 503, snapshot(), true);
    now -= 1000;
    for (const [index, [id, original]] of missions.entries()) for (const order of ['flags','sp']) {
      await fresh(`mission-${id}-${order}`); put('UserAchievement', [claim(index)]);
      const first = await issue('mission', 1, index), target = receipt(first.op);
      assert.equal(target.amount, original.rewardAmount); assert.equal(target.sp_minimum, 7 + original.rewardAmount);
      assert.equal(app.store.read('UserInfo').data[0].playerStatus.baseSP, 7, 'No server-side SP/signature pre-credit');
      await reject(push(flags(), [first.op]), 400, snapshot());
      const partial = parse(await push(order === 'flags' ? flags() : { UserInfo:info(target.sp_minimum) }));
      assert(!partial.operations.some(row => row.id === first.op.id)); assert.deepEqual(app.store.operations(),[first.op]);
      await close(); await open();
      await reject(send(first.action,first.value),503,snapshot(),true);
      await reject(request(port,first.identity,first.value,String(first.identity),first.action),503,snapshot(),true);
      await reject(push({},[first.op]),400,snapshot());
      parse(await push({ ...flags(),UserInfo:info(target.sp_minimum) }));
      parse(await push({ UserInfo:info(0) })); parse(await push({},[first.op]));
    }
    for (const order of [['gift','mission','consume'],['gift','consume','mission'],['mission','gift','consume'],
      ['mission','consume','gift'],['consume','gift','mission'],['consume','mission','gift']]) {
      await fresh(order.join('-')); put('UserGift', [gift(1)]); put('UserAchievement', [claim()]);
      const initial = app.store.read('UserInfo'), events = [];
      let total = 7;
      for (const kind of order) {
        const first = await issue(kind), target = receipt(first.op); events.push(first);
        const gain = kind === 'gift' ? 10 : kind === 'mission' ? missions[0][1].rewardAmount
          : master.playerMaxSP[initial.data[0].playerStatus.level];
        assert.equal(target.sp_before, total); total += gain; assert.equal(target.sp_minimum, total);
        assert.deepEqual(app.store.read('UserInfo'), initial, 'All producers leave native application to the client');
        assert.deepEqual(parse(await send(first.action, first.value)).operations, [first.op]);
        assert.deepEqual((await request(port, first.identity, first.value, String(first.identity), first.action)).body, first.response.body);
      }
      assert.equal(app.store.hardCurrency(), 90, 'Only one original10-Iris refill is charged');
      const refill=events.find(row=>row.op.type===10200),originalQueue=app.store.operations(),purchase=receipt(refill.op),
        cold=parse(await send('user_data/confirm',undefined));
      assert.deepEqual(cold.operations,originalQueue,'The standalone refill uses the actual ordered gift/mission queue');
      assert.deepEqual(receipt(refill.op),purchase);
      const savedFlags=parse(await push(flags()));
      assert.ok(!savedFlags.operations.some(row=>row.id===refill.op.id),'A save-only response cannot reissue the purchase callback');
      assert.deepEqual(app.store.operations(),originalQueue);
      await reject(push({}, events.map(row => row.op)), 400, snapshot());
      for (let i = 0; i < events.length; i++) {
        const event = events[i], target = receipt(event.op);
        const applied=parse(await push({ UserInfo: info(target.sp_minimum) }));
        if(event.op.type===10200) assert.ok(!applied.operations.some(row=>row.id===event.op.id),
          'An observed normal refill is omitted without acknowledging another producer');
        await close(); await open();
        assert.equal(receipt(event.op).effect_saved, 1);
        if (i + 1 < events.length) await reject(push({}, [events[i + 1].op]), 400, snapshot());
        parse(await push({}, [event.op]));
      }
      parse(await push({ UserInfo: info(0) })); assert.deepEqual(app.store.operations(), []);
    }
    await fresh('split-spend'); put('UserGift', [gift(1), gift(2, 3)]);
    const first = await issue('gift'), target = receipt(first.op);
    parse(await push({ UserGift: [{ ...gift(1), state: 1 }], UserInfo: info(target.sp_minimum) }));
    parse(await push({ UserInfo: info(0) })); await close(); await open();
    const second = await issue('gift', 2); assert.equal(receipt(second.op).sp_before, 0);
    assert.equal(receipt(second.op).sp_minimum, 3, 'A saved/spent but unacknowledged award is not reserved again');
    parse(await push({}, [first.op]));
    parse(await push({ UserGift: [{ ...gift(2, 3), state: 1 }], UserInfo: info(3) }));
    parse(await push({ UserInfo: info(0) })); parse(await push({}, [second.op]));
    parse(await push({ UserInfo: info(0) }));

    await fresh('limits'); put('UserGift', [gift(1), gift(2, 5)]);
    for (const rows of [[], seed.data.UserInfo.concat(seed.data.UserInfo), [{ ...seed.data.UserInfo[0], userId: 9 }],
      (() => { const rows = structuredClone(seed.data.UserInfo); rows[0].playerStatus.baseSP = -1; return rows; })(),
      (() => { const rows = structuredClone(seed.data.UserInfo); rows[0].playerStatus.baseSP = '7'; return rows; })()]) {
      put('UserInfo', rows); await reject(send(...wire('gift')), 400, snapshot());
    }
    put('UserInfo', structuredClone(seed.data.UserInfo)); put('UserInfo', info(cap));
    await reject(send(...wire('gift')), 400, snapshot()); put('UserInfo', info(cap - 2));
    const capped = await issue('gift'); assert.equal(receipt(capped.op).sp_minimum, cap);
    assert.equal(receipt(capped.op).amount, 10, 'Native saturation does not rewrite the original reward quantity');
    await reject(send(...wire('gift', 2)), 400, snapshot());
    await reject(send(...wire('consume')), 400, snapshot());
    const foreign = info(cap); foreign[0].userId = 9;
    // The shared owned-player guard cancels before any SP reward/ACK mutation.
    await reject(push({ UserInfo: foreign, UserGift: [{ ...gift(1), state: 1 }] }, [capped.op]), 503, snapshot(), true);
    await reject(push({}, [capped.op], { UserInfo: [{ userId: seed.userId }], UserGift: [{ id: 1 }] }), 503, snapshot(), true);
    parse(await push({ UserInfo: info(cap) }, [capped.op], { UserGift: [{ id: 1 }] }));

    for (const kind of ['gift','mission','consume']) {
      await fresh(`missing-${kind}`); put('UserGift', [gift(1), gift(2)]); put('UserAchievement', [claim(), claim(1)]);
      const first = await issue(kind), target = receipt(first.op), name = table(first.op);
      app.store.db.prepare(`DELETE FROM ${name} WHERE operation_id=?`).run(first.op.id);
      await close(); await open();
      await reject(send(first.action, first.value), 503, snapshot(), true);
      await reject(request(port, first.identity, first.value, String(first.identity), first.action), 503, snapshot(), true);
      app.store.beginSession(); await close(); await open();
      await reject(send(first.action, first.value), 503, snapshot(), true);
      if (kind === 'consume') {
        await reject(request(port, first.identity, first.value, String(first.identity), first.action), 503, snapshot(), true);
        for(const [action,value] of [['user/login',undefined],['user_data/pull',{tables:['UserInfo']}],['user_data/confirm',undefined]])
          await reject(send(action,value),503,snapshot(),true);
      }
      await reject(push({ ...flags(), UserInfo: info(1000) }, [first.op]), 503, snapshot(), true);
      for (const [action, value] of [wire('gift', 2), wire('mission', 1, 1), wire('consume')])
        await reject(send(action, value), 503, snapshot(), true);
      assert.equal(app.store.operations().length, 1, 'Unknown historical baseline cannot be guessed or discarded');
      const keys = Object.keys(target);
      app.store.db.prepare(`INSERT INTO ${name}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`).run(...Object.values(target));
      if (kind !== 'consume') {
        app.store.db.prepare(`UPDATE ${name} SET amount=amount+1 WHERE operation_id=?`).run(first.op.id);
        await reject(send(first.action, first.value), 503, snapshot(), true);
        await reject(send(...wire('gift', 2)), 503, snapshot(), true);
        app.store.db.prepare(`UPDATE ${name} SET amount=? WHERE operation_id=?`).run(target.amount, first.op.id);
      }
      // Exact cached callbacks also validate receipts before any cache reset.
      await issue('gift', 2);
      app.store.db.prepare('UPDATE stamina_reward_claim SET amount=amount+1 WHERE operation_id=?')
        .run(app.store.operations().at(-1).id);
      const lastSequence = sequence, lastValue = wire('gift', 2)[1];
      await reject(request(port, lastSequence, lastValue, String(lastSequence), 'gift/receive'), 503, snapshot(), true);
    }
    for (const kind of ['gift','mission']) {
      await fresh(`rollback-${kind}`); put('UserGift', [gift(1)]); put('UserAchievement', [claim()]);
      for (const name of ['operation_queue','stamina_reward_claim', kind === 'gift' ? 'gift_claim' : 'achievement_claim','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_sp BEFORE INSERT ON ${name} BEGIN SELECT RAISE(ABORT,'SP issue rollback'); END`);
        await reject(send(...wire(kind)), 503, snapshot()); app.store.db.exec('DROP TRIGGER fail_sp');
      }
      const first = await issue(kind), acquired = { ...flags(), UserInfo: info(receipt(first.op).sp_minimum) };
      for (const [name, event] of [['profile','UPDATE'],['stamina_reward_claim','UPDATE'],['operation_done','INSERT'],
        ['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_sp_save BEFORE ${event} ON ${name} BEGIN SELECT RAISE(ABORT,'SP save rollback'); END`);
        await reject(push(acquired, [first.op]), 503, snapshot()); app.store.db.exec('DROP TRIGGER fail_sp_save');
      }
      parse(await push(acquired)); await close(); await open(); parse(await push({}, [first.op]));
      assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    }
    console.log('Stamina gift / both original mission / six Iris interleavings / split-save-spending / saturation / receipt rollback probes OK; native acceptance pending');
  } finally { await close(); fs.rmSync(directory, { recursive: true, force: true }); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
