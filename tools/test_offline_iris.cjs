'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('./danmemore_server.cjs');
const { request, get } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-offline-iris-'));
  const database = path.join(directory, 'profile.sqlite');
  let app, port;
  const open = async () => {
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const send = (value, headers = {}, method = 'POST') => new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(value));
    const req = http.request({ host: '127.0.0.1', port, path: '/offline/iris', method,
      headers: { Host: '127.0.0.1:28766', 'Content-Type': 'application/json', 'Content-Length': body.length,
        'X-DanMemoRe-Offline': '1', ...headers } }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject); req.end(body);
  });
  const grant = { requestId: crypto.randomUUID(), profileId: 'profile', amount: 1000, kind: 'free' };
  const paidGrant = { ...grant, requestId: crypto.randomUUID(), kind: 'paid' };
  const snapshot = () => ({ free: app.store.hardCurrency(), paid: app.store.paidCurrency(),
    receipts: app.store.db.prepare('SELECT * FROM offline_iris_grant ORDER BY request_id').all(),
    profiles: app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(), operations: app.store.operations(),
    sequence: app.store.lastSequence() });
  try {
    await open();
    app.store.changeHardCurrency(321);
    app.store.db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE hard_currency RENAME TO hard_currency_current;
      CREATE TABLE hard_currency (id INTEGER PRIMARY KEY CHECK(id=1), free_amount INTEGER NOT NULL CHECK(free_amount>=0));
      INSERT INTO hard_currency(id,free_amount) SELECT id,free_amount FROM hard_currency_current;
      DROP TABLE hard_currency_current;
      COMMIT;`);
    await close(); await open();
    assert.deepEqual(app.store.db.prepare('PRAGMA table_info(hard_currency)').all().map(row => row.name),
      ['id','free_amount','paid_amount']);
    assert.equal(app.store.hardCurrency(), 321, 'Paid-Iris migration preserves the existing free balance');
    assert.equal(app.store.paidCurrency(), 0);
    app.store.changeHardCurrency(-321);
    const before = snapshot();
    for (const value of [null, {}, { ...grant, amount: 0 }, { ...grant, amount: -1 }, { ...grant, amount: 1.5 },
      { ...grant, amount: '1000' }, { ...grant, amount: 1000001 }, { ...grant, requestId: 'bad' },
      { ...grant, profileId: 'another-save' }, { ...grant, kind: 'other' }, { ...grant, receipt: 'not-a-real-payment' }]) {
      assert.equal((await send(value)).status, 400);
      assert.deepEqual(snapshot(), before);
    }
    for (const headers of [{ Origin: 'https://example.com' }, { 'X-DanMemoRe-Offline': '' },
      { 'Content-Type': 'text/plain' }, { Host: 'localhost:28766' }]) {
      assert.equal((await send(grant, headers)).status, 400);
      assert.deepEqual(snapshot(), before);
    }
    assert.equal((await send(grant, {}, 'PUT')).status, 400);
    app.store.db.exec("CREATE TRIGGER reject_offline_grant BEFORE INSERT ON offline_iris_grant BEGIN SELECT RAISE(ABORT,'grant rollback'); END");
    assert.equal((await send(grant)).status, 503);
    assert.deepEqual(snapshot(), before, 'Wallet and grant receipt are atomic');
    app.store.db.exec('DROP TRIGGER reject_offline_grant');
    const first = await send(grant);
    assert.equal(first.status, 200);
    assert.deepEqual(JSON.parse(first.body), { offline: true, ...grant, balanceAfter: 1000 });
    assert.deepEqual(await send(grant), first);
    assert.equal(app.store.hardCurrency(), 1000);
    const paid = await send(paidGrant);
    assert.equal(paid.status, 200);
    assert.deepEqual(JSON.parse(paid.body), { offline: true, ...paidGrant, balanceAfter: 1000 });
    assert.equal(app.store.paidCurrency(), 1000);
    assert.deepEqual(JSON.parse((await get(port, '/billing/v1.0/payment/balance')).body).entry,
      { balance_charge_gem: 1000, balance_free_gem: 1000, balance_total_gem: 2000 });
    assert.equal((await send({ ...paidGrant, kind: 'free' })).status, 400);
    assert.equal((await send({ ...grant, amount: 2000 })).status, 400);
    assert.deepEqual(snapshot().profiles, before.profiles, 'Server wallet does not overwrite client inventory');
    assert.deepEqual(app.store.operations(), before.operations);
    assert.equal(app.store.lastSequence(), before.sequence, 'Launcher grants do not consume native request sequence');
    await close(); await open();
    assert.deepEqual(await send(grant), first, 'Lost reply or restart cannot credit twice');
    const purchase = await request(port, 1, { shopProductId: 207000002 }, '1', 'shop/buy');
    assert.equal(purchase.status, 200);
    assert.equal(app.store.hardCurrency(), 990, 'Existing local shop spends the granted free Iris');
    const paidPack = await request(port, 2, { shopProductId: 207000001 }, '2', 'shop/buy');
    assert.equal(paidPack.status, 200);
    assert.equal(app.store.paidCurrency(), 600, 'Paid-Iris packs spend only the paid balance');
    assert.deepEqual(await send(grant), first);
    assert.equal(app.store.hardCurrency(), 990, 'An old grant retry cannot replenish spent currency');
    assert.equal((await send({ ...grant, requestId: crypto.randomUUID() })).status, 200);
    assert.equal(app.store.hardCurrency(), 1990);
    app.store.changeHardCurrency(999999999 - app.store.hardCurrency());
    const capped = snapshot();
    assert.equal((await send({ ...grant, requestId: crypto.randomUUID() })).status, 400);
    assert.deepEqual(snapshot(), capped, 'Native-safe wallet ceiling does not wrap or partially commit');
    console.log('Offline Iris: separate free/paid grants, original shop spending, profile isolation, atomic receipts, safe retries and restart OK; no real billing or native UI test');
  } finally {
    await close();
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('danmemore-offline-iris-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
