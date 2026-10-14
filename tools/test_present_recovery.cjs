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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-present-recovery-'));
  const database = path.join(directory, 'profile.sqlite');
  const realNow = Date.now, realRandom = crypto.randomInt;
  const bonusId = 780000002, original = master.loginExplorers[bonusId];
  let app, port, sequence = 0;
  const open = async () => {
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const send = async (action, value) => {
    const reply = await request(port, ++sequence, value, String(sequence), action);
    assert.equal(reply.status, 200); return JSON.parse(reply.body);
  };
  const invariant = () => Object.fromEntries(['hard_currency','gift_claim','login_explorer_claim','operation_done']
    .map(table => [table, app.store.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
  const profiles = () => app.store.db.prepare("SELECT * FROM profile WHERE name NOT IN ('UserGift','UserLoginBonusExplorer') ORDER BY name").all();
  try {
    Date.now = () => original.startAt * 1000;
    crypto.randomInt = (...args) => args.length === 1 && args[0] === 10000 ? 0 : realRandom(...args);
    await open();
    await send('login_bonus_explorer/draw', { loginBonusExplorerId: bonusId });
    const gift = app.store.read('UserGift').data[0];
    const received = await send('gift/receive', { userId: seed.userId, giftIds: [gift.id] });
    const operation = received.operations[0];
    const legacy = { ...gift, senderType: 0, giftAcquiredType: 0 };
    const unowned = { ...legacy, id: 999 };
    const legacyBonus = app.store.read('UserLoginBonusExplorer').data.map(row => ({ ...row, playableState: 0 }));
    for (const [name, rows] of [['UserGift',[legacy,unowned]], ['UserLoginBonusExplorer',legacyBonus]])
      app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows), md5(rows), name);
    operation.parameters.UserGift = [legacy];
    app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(operation.parameters), operation.id);
    const legacyBody = { code: 0, operations: [operation] };
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE action=?')
      .run(Buffer.from(JSON.stringify(legacyBody)).toString('base64'), 'gift/receive');
    const before = invariant(), untouched = profiles(), balance = app.store.hardCurrency();
    await close(); await open();
    assert.deepEqual(invariant(), before, 'Metadata repair neither rewards nor retires a claim');
    assert.deepEqual(profiles(), untouched, 'Unrelated profile tables are unchanged');
    assert.deepEqual(app.store.read('UserGift').data, [gift, unowned], 'Only proven local deliveries are repaired');
    assert.equal(app.store.read('UserLoginBonusExplorer').data[0].playableState, 1);
    const pending = app.store.operations()[0];
    assert.deepEqual(pending, { ...operation, parameters: { ...operation.parameters, UserGift: [gift] } },
      'Pending ID, verifier, signature and rewards are preserved');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM legacy_explorer_gift_backup').get().n, 4);
    const replay = await request(port, sequence, { userId: seed.userId, giftIds: [gift.id] }, String(sequence), 'gift/receive');
    assert.equal(replay.status, 200);
    assert.deepEqual(JSON.parse(replay.body).UserGift, [gift], 'Cached legacy reply has corrected metadata and popup envelope');
    assert.equal(app.store.hardCurrency(), balance);
    const repaired = app.store.db.prepare('SELECT * FROM legacy_explorer_gift_backup ORDER BY kind,key').all();
    await close(); await open();
    assert.deepEqual(app.store.db.prepare('SELECT * FROM legacy_explorer_gift_backup ORDER BY kind,key').all(), repaired);
    assert.deepEqual(invariant(), before, 'Repeated startup is idempotent');
    const saved = { ...gift, state: 1 };
    await send('user_data/push', { badges: null, scripts: {}, dataTokens: {},
      checksums: { before: {}, after: { UserGift: md5([saved, unowned]) } },
      deltas: [{ signature: 0, trigger: 'GiftReceive', putItems: { UserGift: [saved] }, deleteItems: {} }],
      operations: [{ id: pending.id, verifier: pending.token }] });
    assert.deepEqual(app.store.operations(), []);
    assert.equal(app.store.hardCurrency(), balance);
    await close(); await open();
    assert.equal(app.store.read('UserGift').data.find(row => row.id === gift.id).state, 1);
    assert.equal(app.store.hardCurrency(), balance);
    console.log('Present recovery: original enums, ledger-scoped backups, cache replay, pending identities, once-only rewards and saved restart OK');
  } finally {
    Date.now = realNow; crypto.randomInt = realRandom;
    await close(); fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
