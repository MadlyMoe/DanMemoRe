'use strict';

// DEFERRED synthetic native-save order checks. No Twitter/native UI proof.
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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-present-application-'));
  const database = path.join(directory, 'profile.sqlite'), eventId = 52000000001;
  const event = master.characterPresents[eventId], ids = event.characters.map(row => row.id);
  let app, port, sequence = 0, at = event.startAt;
  const open = async () => {
    app = createServer({ database, seed, master, wallNowSeconds: () => at, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => { if (app) await app.close(); app = null; };
  const send = (action, value) => request(port, ++sequence, value, String(sequence), action);
  const payload = selected => ({ twitterId: '', characterPresentInfoId: eventId, characterPresentCharacterInfoIds: selected });
  const report = (value = payload([ids[0]])) => send('present/apply/twitter', value);
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const unavailable = response => {
    assert.equal(response.status, 503);
    assert.equal(response.headers['x-argo-server-response-code'], String(OFFLINE_UNAVAILABLE_CODE));
  };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows), md5(rows), name);
  const application = (id, flag = false) => ({ userId: seed.userId, characterPresentCharacterInfoId: id, isApplication: flag });
  const save = (putItems, deleteItems = {}, trigger = 'CharacterPresentApplication') => send('user_data/push', {
    badges: null, scripts: {}, dataTokens: {}, operations: [],
    checksums: { before: {}, after: Object.fromEntries([...new Set([...Object.keys(putItems), ...Object.keys(deleteItems)])]
      .map(name => [name, md5(putItems[name] ?? [])])) },
    deltas: [{ signature: 0, trigger, putItems, deleteItems }],
  });
  const snapshot = (gameplay = false) => JSON.stringify(app.store.db.prepare(`SELECT name FROM sqlite_master
    WHERE type='table' ORDER BY name`).all().filter(({name}) => !gameplay ||
      !['runtime','reply_cache','character_present_application_report'].includes(name)).map(({name}) =>
    [name, app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const receipts = () => app.store.db.prepare('SELECT * FROM character_present_application_report ORDER BY rowid').all();
  try {
    await open();
    // Native lazy row fields, but synthetic checkpoints/signatures, not a UI run.
    put('UserCharacterPresentApplicationInfo', ids.map(id => application(id)));
    put('UserCharacterPresentCharacterInfo', [{ userId: seed.userId, characterPresentCharacterInfoId: ids[0],
      currentPoint: event.characters[0].requiredPoint, isComplete: false }]);
    const reward = parse(await send('present/character/reward/get', { characterPresentCharacterInfoId: ids[0] }));
    assert.equal(reward.operations[0].type, 11100);
    const pullValue = { tables: ['UserCharacterPresentApplicationInfo'], consistentRead: true, recovery: false };
    assert.equal((await send('user_data/pull', pullValue)).status, 200);
    const oldPull = sequence;
    parse(await send('user_data/confirm', null));
    const oldConfirm = sequence;
    let before = snapshot();
    for (const value of [null, {}, { ...payload([ids[0]]), extra: 1 }, { ...payload([ids[0]]), twitterId: 1 },
      { ...payload([ids[0]]), characterPresentInfoId: String(eventId) }, { ...payload([ids[0]]), characterPresentInfoId: eventId + 1 },
      payload([]), payload([String(ids[0])]), payload([ids[0], ids[0]]), payload([42]), payload([Number.MAX_SAFE_INTEGER + 1])]) {
      assert.equal((await report(value)).status, 400); assert.equal(snapshot(), before);
    }
    for (const time of [event.startAt - 1, event.endAt]) {
      at = time; unavailable(await report()); assert.equal(snapshot(), before);
    }
    at = event.startAt;
    for (const [table, operation] of [['character_present_application_report','INSERT'], ['reply_cache','INSERT'], ['runtime','UPDATE']]) {
      app.store.db.exec(`CREATE TRIGGER fail_application BEFORE ${operation} ON ${table}
        BEGIN SELECT RAISE(ABORT,'application failure'); END`);
      before = snapshot(); unavailable(await report()); assert.equal(snapshot(), before);
      app.store.db.exec('DROP TRIGGER fail_application');
    }
    const gameBefore = snapshot(true), submitted = { ...payload([ids[0]]), twitterId: 'local-unverified' };
    const response = await report(submitted), first = sequence;
    assert.deepEqual(parse(response), { code: 0 });
    assert.equal(snapshot(true), gameBefore, 'Reporting before either native save cannot prewrite flags, points or grants');
    assert.equal(receipts().length, 1);
    assert.equal(receipts()[0].parameters, JSON.stringify(submitted));
    assert.deepEqual(app.store.operations(), reward.operations, 'Reporting does not deliver or ACK another reward');
    assert.deepEqual((await request(port, first, submitted, String(first), 'present/apply/twitter',
      { 'X-ARGO-REQUEST-BODY-HASH': 'different-header' })).body, response.body);
    assert.equal(receipts().length, 1, 'Actual bytes, not the caller hash header, identify a report');
    const selected = ids.map(id => application(id, id === ids[0]));
    parse(await save({ UserCharacterPresentApplicationInfo: selected }));
    const info = { ...app.store.read('UserInfo').data[0], twitterId: submitted.twitterId };
    parse(await save({ UserInfo: [info] }, {}, 'CharacterPresentTwitter'));
    assert.deepEqual(app.store.read('UserCharacterPresentApplicationInfo').data, selected);
    before = snapshot();
    unavailable(await request(port, oldPull, pullValue, String(oldPull), 'user_data/pull'));
    unavailable(await request(port, oldConfirm, null, String(oldConfirm), 'user_data/confirm'));
    assert.equal(snapshot(), before, 'Cached pulls/tokens cannot restore a pre-selection native profile');
    assert.equal((await send('user_data/pull', pullValue)).status, 200);
    parse(await send('user_data/confirm', null));
    const saved = snapshot(true);
    for (const id of ids) assert.deepEqual(parse(await report(payload([id]))), { code: 0 });
    assert.deepEqual(parse(await report(payload(ids))), { code: 0 });
    assert.equal(snapshot(true), saved, 'All original rows and a full set are reports, not reward producers');
    before = snapshot();
    for (const rows of [[application(ids[0]), application(ids[0])], [{ ...application(ids[0]), userId: 2 }],
      [{ ...application(ids[0]), isApplication: 1 }], [{ ...application(ids[0]), isApplication: undefined }], [application(42)]]) {
      assert.equal((await save({ UserCharacterPresentApplicationInfo: rows })).status, 400);
      assert.equal(snapshot(), before);
    }
    // Selecting a different set clears previous flags in the original client.
    const changed = ids.map(id => application(id, id === ids[1]));
    parse(await save({ UserCharacterPresentApplicationInfo: changed }));
    assert.deepEqual(app.store.read('UserCharacterPresentApplicationInfo').data, changed);
    assert.deepEqual(parse(await report(payload([ids[1]]))), { code: 0 });
    before = snapshot();
    for (const action of ['present/apply/twitter','user/login']) {
      assert.equal((await request(port, first, action === 'user/login' ? null : payload([ids[1]]), String(first), action)).status, 400);
      assert.equal(snapshot(), before, 'Old identities cannot be reused for another selection or route');
    }
    parse(await send('user/login', null));
    assert.deepEqual((await request(port, first, submitted, String(first), 'present/apply/twitter')).body, response.body);
    assert.deepEqual(app.store.operations(), reward.operations, 'A new session cannot lose an earlier pending item grant');
    app.store.db.exec('DELETE FROM reply_cache');
    at = event.endAt + 100;
    await close(); await open();
    before = snapshot();
    assert.deepEqual((await request(port, first, submitted, String(first), 'present/apply/twitter')).body, response.body);
    assert.equal(snapshot(), before, 'Restart/cache eviction/expiry replay cannot restore an old selected set');
    unavailable(await report()); assert.equal(snapshot(), before);
    for (const rows of [[{ ...application(ids[0]), userId: 2 }], [application(ids[0]), application(ids[0])]]) {
      put('UserCharacterPresentApplicationInfo', rows); before = snapshot();
      unavailable(await request(port, first, submitted, String(first), 'present/apply/twitter'));
      assert.equal(snapshot(), before, 'Unknown/foreign legacy state is retained, not repaired from a report');
    }
    put('UserCharacterPresentApplicationInfo', changed);
    const ownedInfo = app.store.read('UserInfo').data;
    put('UserInfo', [{ ...ownedInfo[0], userId: 2 }]); before = snapshot();
    unavailable(await request(port, first, submitted, String(first), 'present/apply/twitter'));
    assert.equal(snapshot(), before, 'A report cannot authorize a foreign local profile');
    put('UserInfo', ownedInfo);
    app.store.db.prepare('UPDATE character_present_application_report SET parameters=? WHERE request_key=?').run('{}', `${first}/${first}`);
    before = snapshot(); unavailable(await request(port, first, submitted, String(first), 'present/apply/twitter'));
    assert.equal(snapshot(), before, 'Corrupt submission captures cannot fabricate acceptance');
    // An old generic reply without its permanent capture is not proof of a submission.
    const legacy = receipts().find(row => row.request_key !== `${first}/${first}`), [legacyId,legacySequence] = legacy.request_key.split('/');
    app.store.saveReply(legacy.request_key, 'present/apply/twitter', 'legacy', 'application/json', Buffer.from('{"code":0}'));
    app.store.db.prepare('DELETE FROM character_present_application_report WHERE request_key=?').run(legacy.request_key);
    before = snapshot(); unavailable(await request(port, legacySequence, JSON.parse(legacy.parameters), legacyId, 'present/apply/twitter'));
    assert.equal(snapshot(), before, 'Missing legacy captures are retained as unavailable, not guessed');
    console.log('Local character-present reports: original IDs/window, both save orders, opaque text, once-only wire receipt, rollback and no gameplay mutation; native UI unverified');
  } finally {
    await close();
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('danmemore-present-application-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
