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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-element-summary-'));
  const database = path.join(directory, 'profile.sqlite');
  const action = 'element_event/summary/get', infoId = master.elementEventInfoIds[0];
  const body = { elementEventInfoId: infoId };
  let app, port, sequence = 0, eventDate = '2020-03-13T12:00:00Z';
  const open = async () => {
    app = createServer({ database, seed, master, eventDate,
      wallNowSeconds: () => 1791028800, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const send = (value, route = action) => request(port, ++sequence, value, String(sequence), route);
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const profiles = () => app.store.db.prepare('SELECT * FROM profile ORDER BY name').all();
  const snapshot = () => ({ profiles: profiles(), operations: app.store.operations(),
    runtime: app.store.db.prepare('SELECT * FROM runtime').all(),
    cache: app.store.db.prepare('SELECT * FROM reply_cache ORDER BY key').all(),
    balance: [app.store.hardCurrency(), app.store.paidCurrency()] });
  const save = rows => ({ badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: { UserElementEventRecord: md5(rows) } },
    deltas: [{ signature: 0, trigger: 'ElementEventRecord', deleteItems: {},
      putItems: { UserElementEventRecord: rows } }], operations: [] });
  try {
    await open();
    const emptyReply=await send(body),emptySequence=sequence;
    assert.deepEqual(parse(emptyReply), { code: 0, adventureStageRecords: [] });
    const empty = snapshot();
    for (const value of [null, [], {}, { elementEventInfoId: 0 }, { elementEventInfoId: -1 },
      { elementEventInfoId: String(infoId) }, { elementEventInfoId: infoId + 0.5 },
      { elementEventInfoId: Number.MAX_SAFE_INTEGER + 1 }, { elementEventInfoId: 1 }, { ...body, extra: 0 }]) {
      assert.equal((await send(value)).status, 400);
      assert.deepEqual(snapshot(), empty, 'Invalid requests cannot change progress, operations, sequence or cache');
    }
    // Synthetic scores exercise original ID joins only. They are NOT evidence
    // of natural battle completion, a recovered scoring formula or rewards.
    const rows = Object.keys(master.elementEventDifficulties).map((id, i) => ({ userId: seed.userId,
      elementEventStageDifficultyId: Number(id), score: i === 0 ? 0 : i === 1 ? 9000000000 : i + 1 }));
    parse(await send(save(rows), 'user_data/push'));
    const emptyTransition=snapshot();
    assert.equal((await request(port,emptySequence,body,String(emptySequence),action)).status,503,
      'Cached empty summary cannot hide newly saved native scores');
    assert.deepEqual(snapshot(),emptyTransition,'Stale empty summary recovery preserves saved scores');
    const beforeReads = profiles(), balance = [app.store.hardCurrency(), app.store.paidCurrency()];
    const expected = selected => ({ code: 0, adventureStageRecords: rows
      .filter(row => master.elementEventDifficulties[row.elementEventStageDifficultyId].infoId === selected)
      .map(row => ({ adventureStageId: master.elementEventDifficulties[row.elementEventStageDifficultyId].adventureStageId,
        score: row.score })) });
    for (const elementEventInfoId of master.elementEventInfoIds)
      assert.deepEqual(parse(await send({ elementEventInfoId })), expected(elementEventInfoId));
    assert.deepEqual(profiles(), beforeReads, 'Summary reads must not rewrite scores, tokens, flags or rewards');
    assert.deepEqual(app.store.operations(), []);
    assert.deepEqual([app.store.hardCurrency(), app.store.paidCurrency()], balance);
    const firstSequence = ++sequence;
    const first = await request(port, firstSequence, body, String(firstSequence), action);
    assert.deepEqual(parse(first), expected(infoId));
    assert.deepEqual((await request(port,firstSequence,body,String(firstSequence),action)).body,first.body,
      'An unchanged summary retains its exact cached response');
    rows[0].score = 123456;
    parse(await send(save([rows[0]]), 'user_data/push'));
    const changed=snapshot();
    assert.equal((await request(port,firstSequence,body,String(firstSequence),action)).status,503,
      'A cached summary cannot overwrite a newer saved score');
    assert.deepEqual(snapshot(),changed,'Changed-summary recovery preserves native rows');
    assert.deepEqual(parse(await send(body)), expected(infoId), 'A fresh read sees the new persisted score');
    await close(); eventDate = '2023-12-01T12:00:00Z'; await open();
    assert.deepEqual(parse(await send(body)), expected(infoId), 'Clock changes preserve historical scores without unlocking gameplay');
    app.store.beginSession();
    assert.deepEqual(parse(await send(body)), expected(infoId), 'No dependency on the generic reply cache');
    const pending = app.store.issueOperation(4000, {}), withPending = snapshot();
    parse(await send(body));
    assert.deepEqual(profiles(), withPending.profiles);
    assert.deepEqual(app.store.operations(), [pending], 'Read packets retain earlier pending effects');
    const beforeFailure = snapshot();
    app.store.db.exec("CREATE TRIGGER summary_fail BEFORE INSERT ON reply_cache WHEN NEW.action='element_event/summary/get' BEGIN SELECT RAISE(ABORT,'reply failure'); END");
    const failed = await send(body);
    assert.equal(failed.status, 503);
    assert.notEqual(failed.headers['x-argo-server-response-code'], '3000999', 'Unexpected exceptions are not unavailable-feature recovery');
    assert.deepEqual(snapshot(), beforeFailure, 'Failed reply insertion rolls back the accepted sequence');
    app.store.db.exec('DROP TRIGGER summary_fail');
    const intact = app.store.read('UserElementEventRecord').data;
    for (const bad of [
      [{ ...rows[0], userId: seed.userId + 1 }], [{ ...rows[0], score: -1 }],
      [{ ...rows[0], score: '1' }], [{ ...rows[0], score: Number.MAX_SAFE_INTEGER + 1 }],
      [{ ...rows[0], elementEventStageDifficultyId: 1 }], [{ ...rows[0], extra: 0 }], [rows[0], rows[0]],
    ]) {
      // Corrupt only this temporary database. The handler must reject it, not
      // silently erase a record or return a fake empty summary.
      app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserElementEventRecord'").run(JSON.stringify(bad), md5(bad));
      const corrupt = snapshot();
      assert.equal((await send(body)).status, 400);
      assert.deepEqual(snapshot(), corrupt);
    }
    app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserElementEventRecord'").run(JSON.stringify(intact), md5(intact));
    parse(await send(save([{ userId: seed.userId, elementEventStageDifficultyId: 0, score: 0 }]), 'user_data/push'));
    assert.deepEqual(parse(await send(body)), expected(infoId), 'Schema-valid difficulty0 is not an authored stage');
    await close(); await open();
    assert.deepEqual(parse(await send(body)), expected(infoId));
    assert.deepEqual(app.store.operations(), [pending]);
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    console.log('Element summaries: original 208-event/1382-difficulty joins, persisted scores, empty records, retry, rollback, clock/restart and unchanged rewards OK; native UI and scoring pending');
  } finally {
    await close(); fs.rmSync(directory, { recursive: true, force: true });
  }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
