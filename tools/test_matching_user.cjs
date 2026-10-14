'use strict';

// DEFERRED source-only bootstrap contract. Do not run before packet implementation is complete.
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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-matching-user-'));
  const database = path.join(directory, 'profile.sqlite');
  let app, port, requestId = 100;
  const open = async () => {
    app = createServer({ database, seed, master, eventDate: '2019-10-18', log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => { if (app) await app.close(); app = null; };
  const send = (sequence, value) =>
    request(port, sequence, value, String(++requestId), 'matching_user/game_user_id');
  const parse = response => {
    assert.equal(response.status, 200, response.body.toString());
    assert.match(response.headers['content-type'], /^application\/json/);
    return JSON.parse(response.body);
  };
  const expected = { code: 0, game_user_id: seed.userId, aesIv: 'DanMemoReLocalIV' };
  const snapshot = () => JSON.stringify(app.store.db.prepare(`SELECT name FROM sqlite_master WHERE type='table'
    AND name NOT LIKE 'sqlite_%' ORDER BY name`).all().map(({name}) =>
    [name, app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}"`).all()]));
  const unavailable = response => {
    assert.equal(response.status, 503);
    assert.equal(response.headers['x-argo-server-response-code'], String(OFFLINE_UNAVAILABLE_CODE));
  };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows), md5(rows), name);
  try {
    await open();
    const queued = app.store.issueOperation(4000, {});
    app.store.setSequence(77n);
    app.store.saveReply('retained/77', 'test', 'hash', 'application/json', Buffer.from('{}'));
    const before = snapshot();
    assert.deepEqual(parse(await send(0, undefined)), expected);
    assert.equal(snapshot(), before, 'Matching bootstrap must not begin a session, consume work, cache a reply or advance sequence');
    assert.deepEqual(parse(await send(999999, undefined)), expected,
      'Matching bootstrap is sequence-independent and stable for reconnect discovery');
    assert.equal(snapshot(), before);
    for (const value of [null, {}, [], 0, '', { game_user_id: seed.userId }]) {
      const saved = snapshot();
      assert.equal((await send(1, value)).status, 400);
      assert.equal(snapshot(), saved);
    }
    assert.equal(app.store.db.prepare("SELECT COUNT(*) AS n FROM reply_cache WHERE action='matching_user/game_user_id'").get().n, 0);
    assert.equal(app.store.lastSequence(), 77n);
    assert.deepEqual(app.store.operations(), [queued]);

    app.store.changeHardCurrency(123);
    const changed = snapshot();
    assert.deepEqual(parse(await send(0, undefined)), expected);
    assert.equal(snapshot(), changed, 'Unrelated durable gameplay state cannot change or be touched by bootstrap identity');
    const login = parse(await request(port, 0, undefined, String(++requestId), 'user/login'));
    assert.equal(login.game_user_id, expected.game_user_id);
    assert.equal(login.aesIv, expected.aesIv);

    await close();
    await open();
    assert.deepEqual(parse(await send(0, undefined)), expected);
    assert.equal(app.store.hardCurrency(), 123);
    assert.deepEqual(app.store.operations(), [queued]);

    const info = app.store.read('UserInfo').data, status = app.store.read('UserStatus').data;
    for (const [damage, restore] of [
      [() => app.store.db.prepare('UPDATE runtime SET user_id=2 WHERE id=1').run(),
        () => app.store.db.prepare('UPDATE runtime SET user_id=? WHERE id=1').run(seed.userId)],
      [() => app.store.db.prepare('UPDATE local_save_meta SET user_id=2').run(),
        () => app.store.db.prepare('UPDATE local_save_meta SET user_id=?').run(seed.userId)],
      [() => put('UserInfo', info.map(row => ({ ...row, userId: 2 }))), () => put('UserInfo', info)],
      [() => put('UserStatus', status.map(row => ({ ...row, userId: 2 }))), () => put('UserStatus', status)],
      [() => app.store.db.prepare("UPDATE profile SET data='not-json' WHERE name='UserInfo'").run(), () => put('UserInfo', info)],
    ]) {
      damage();
      const damaged = snapshot();
      unavailable(await send(0, undefined));
      assert.equal(snapshot(), damaged, 'Invalid saved bootstrap identity must be retained without repair or partial mutation');
      restore();
      assert.deepEqual(parse(await send(0, undefined)), expected);
    }
    console.log('Local matching-user bootstrap: persistent SQLite owner, stable IV, empty wire, restart and corruption refusal: OK; native acceptance pending');
  } finally {
    await close();
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-matching-user-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
