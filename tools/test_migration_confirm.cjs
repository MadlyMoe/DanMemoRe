'use strict';

// DEFERRED synthetic signed-save checkpoints, not native migration/transfer proof.
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

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-migration-'));
  const database = path.join(directory, 'profile.sqlite');
  let app, port, sequence = 0, wall = 1600000000;
  const open = async (eventDate = '2019-10-20') => {
    app = createServer({ database, seed, master, eventDate, wallNowSeconds: () => wall, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => { if (app) await app.close(); app = null; };
  const send = (action, value) => request(port, ++sequence, value, String(sequence), action);
  const value = { userId: String(seed.userId) };
  const confirm = (body = value) => send('user/migration/confirm', body);
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const expected = (name = 'Player', amount = null, createdAt = 1600000000, updatedAt = createdAt) => ({ code: 0,
    gamelibUser: { createdAt }, userMeta: { updatedAt }, userInfo: { name, userId: seed.userId },
    userCurrency: amount === null ? [] : [{ currencyId: master.currencies['currency.valis'], amount }] });
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows), md5(rows), name);
  const save = putItems => send('user_data/push', { badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: Object.fromEntries(Object.entries(putItems).map(([name, rows]) => [name, md5(rows)])) },
    deltas: [{ signature: 0, trigger: 'MigrationFixture', deleteItems: {}, putItems }], operations: [] });
  const snapshot = () => JSON.stringify(app.store.db.prepare(`SELECT name FROM sqlite_master WHERE type='table'
    AND name NOT IN ('runtime','reply_cache','event_clock') ORDER BY name`).all().map(({name}) =>
    [name, app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}"`).all()]));
  const unavailable = response => {
    assert.equal(response.status, 503);
    assert.equal(response.headers['x-argo-server-response-code'], String(OFFLINE_UNAVAILABLE_CODE));
  };
  try {
    await open();
    const queued = app.store.issueOperation(4000, {});
    const before = snapshot(), first = await confirm(), firstSequence = sequence;
    assert.deepEqual(parse(first), expected());
    assert.equal(snapshot(), before, 'Confirmation only caches a reply/sequence; it cannot ACK, authenticate or rewrite a save');
    const forgedSequence = ++sequence, forgedHash = '0'.repeat(32);
    const forged = await request(port, forgedSequence, value, String(forgedSequence), 'user/migration/confirm',
      { 'X-ARGO-REQUEST-BODY-HASH': forgedHash });
    assert.deepEqual(parse(forged), expected());
    assert.equal(app.store.db.prepare('SELECT body_hash FROM reply_cache WHERE request_key=?')
      .get(`${forgedSequence}/${forgedSequence}`).body_hash, md5(value),
    'Migration replay identity uses the received request bytes, not a caller-supplied hash');
    assert.notEqual(md5(value), forgedHash);
    assert.deepEqual((await request(port, forgedSequence, value, String(forgedSequence), 'user/migration/confirm',
      { 'X-ARGO-REQUEST-BODY-HASH': 'f'.repeat(32) })).body, forged.body,
    'Changing only the untrusted hash header cannot redirect an exact replay');
    for (const bad of [null, {}, [], 1, { userId: seed.userId }, { userId: '' }, { userId: null }, { ...value, password: 'x' }]) {
      assert.equal((await confirm(bad)).status, 400); assert.equal(snapshot(), before);
    }
    assert.equal((await send('user/migration/confirm')).status, 400);
    for (const id of ['2', `0${seed.userId}`, `${seed.userId} `, '9223372036854775807']) {
      unavailable(await confirm({ userId: id })); assert.equal(snapshot(), before);
    }
    const info = app.store.read('UserInfo').data, status = app.store.read('UserStatus').data;
    const valis = { userId: seed.userId, currencyId: master.currencies['currency.valis'],
      amount: 120000, cumulativeAmount: 140000, reservedAmount: 0, signature: 0 };
    wall += 40;
    parse(await save({ UserInfo: info.map(row => ({ ...row, name: 'SavedOwner' })), UserCurrency: [valis] }));
    assert.deepEqual(parse(await confirm()), expected('SavedOwner', 120000, 1600000000, wall));
    unavailable(await request(port, firstSequence, value, String(firstSequence), 'user/migration/confirm'));
    app.store.changePaidCurrency(555); app.store.changeHardCurrency(999);
    assert.deepEqual(parse(await confirm()), expected('SavedOwner', 120000, 1600000000, wall), 'Valis is not an Iris balance');
    const unchanged = await confirm(), unchangedSequence = sequence;
    await close(); wall += 20; await open('2018-01-01');
    assert.deepEqual((await request(port, unchangedSequence, value, String(unchangedSequence), 'user/migration/confirm')).body,
      unchanged.body, 'Restart and historical event-clock selection do not invent account/save dates');
    assert.deepEqual(parse(await confirm()), expected('SavedOwner', 120000, 1600000000, 1600000040));
    for (const sql of [
      "CREATE TRIGGER fail_save_meta BEFORE UPDATE ON local_save_meta BEGIN SELECT RAISE(ABORT,'metadata rollback'); END",
      "CREATE TRIGGER fail_save_meta BEFORE INSERT ON reply_cache WHEN NEW.action='user_data/push' BEGIN SELECT RAISE(ABORT,'reply rollback'); END",
    ]) {
      const saved = snapshot(), lastSequence = app.store.lastSequence();
      app.store.db.exec(sql);
      assert.equal((await save({ UserInfo: info.map(row => ({ ...row, name: 'RolledBack' })) })).status, 503);
      assert.equal(snapshot(), saved); assert.equal(app.store.lastSequence(), lastSequence);
      app.store.db.exec('DROP TRIGGER fail_save_meta');
    }
    const savedInfo = app.store.read('UserInfo').data;
    for (const rows of [[], [...savedInfo, ...savedInfo], savedInfo.map(row => ({ ...row, userId: 2 })),
      savedInfo.map(row => ({ ...row, name: 123 }))]) {
      put('UserInfo', rows); const saved = snapshot(); unavailable(await confirm()); assert.equal(snapshot(), saved);
    }
    put('UserInfo', savedInfo);
    for (const rows of [[], status.map(row => ({ ...row, userId: 2 }))]) {
      put('UserStatus', rows); unavailable(await confirm());
    }
    put('UserStatus', status);
    for (const rows of [[valis,valis], [{ ...valis, userId: 2 }], [{ ...valis, amount: -1 }],
      [{ ...valis, amount: 2000000001 }], [{ ...valis, amount: '1' }], [{ ...valis, currencyId: '205000002' }],
      [{ ...valis, currencyId: 205000099 }], [null]]) {
      put('UserCurrency', rows); const saved = snapshot(); unavailable(await confirm()); assert.equal(snapshot(), saved);
    }
    for (const amount of [0, 2000000000]) {
      put('UserCurrency', [{ ...valis, amount }]);
      assert.deepEqual(parse(await confirm()), expected('SavedOwner', amount, 1600000000, 1600000040));
    }
    put('UserCurrency', [valis]);
    put('UserCurrency', [{ ...valis, currencyId: master.currencies['currency.gem'], amount: 777 }, valis]);
    assert.deepEqual(parse(await confirm()), expected('SavedOwner', 120000, 1600000000, 1600000040),
      'Other original currency rows are not substituted for the requested Valis amount');
    put('UserCurrency', [valis]);
    wall = 1599999900;
    parse(await save({ UserInfo: savedInfo }));
    assert.deepEqual(parse(await confirm()), expected('SavedOwner', 120000, 1600000000, 1600000040), 'Wall-clock rollback cannot rewind the checkpoint');
    wall = 1600000060;
    const dates = app.store.db.prepare('SELECT * FROM local_save_meta').get();
    for (const change of [{ created_at: 0 }, { updated_at: 0 }, { created_at: 2147483648 }, { updated_at: 2147483648 },
      { created_at: 1600000050 }]) {
      app.store.db.prepare('UPDATE local_save_meta SET created_at=?,updated_at=? WHERE user_id=?')
        .run(change.created_at ?? dates.created_at, change.updated_at ?? dates.updated_at, seed.userId);
      const saved = snapshot(); unavailable(await confirm()); assert.equal(snapshot(), saved);
    }
    app.store.db.prepare('UPDATE local_save_meta SET created_at=?,updated_at=?').run(dates.created_at, dates.updated_at);
    // Simulate an old backup with no new metadata table. Opening it must not
    // manufacture today's creation/save time or erase its pending operation.
    app.store.db.exec('DROP TABLE local_save_meta');
    await close(); await open();
    assert.deepEqual({ ...app.store.db.prepare('SELECT * FROM local_save_meta').get() },
      { user_id: seed.userId, created_at: null, updated_at: null });
    const legacy = snapshot(); unavailable(await confirm()); assert.equal(snapshot(), legacy);
    parse(await save({ UserInfo: savedInfo })); unavailable(await confirm());
    parse(await save({ UserStatus: status.map(row => ({ ...row, createdAt: 1500000000 })) }));
    assert.deepEqual(parse(await confirm()), expected('SavedOwner', 120000, 1500000000, wall),
      'Legacy dates require an actual recorded checkpoint and an owned source creation timestamp');
    assert.deepEqual(app.store.operations(), [queued]);
    assert.equal(app.store.paidCurrency(), 555); assert.equal(app.store.hardCurrency(), 999);
    console.log('Local migration confirmation: original text/Valis fields, read-only owned save, clock, rollback, replay/restart and legacy preservation: OK; native transfer acceptance pending');
  } finally {
    await close();
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-migration-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
