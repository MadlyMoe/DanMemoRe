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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-board-'));
  const database = path.join(directory, 'profile.sqlite'), realNow = Date.now;
  let app, port, sequence = 0;
  const open = async () => {
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const send = (action, value) => request(port, ++sequence, value, String(sequence), action);
  const parse = reply => { assert.equal(reply.status, 200, reply.body.toString()); return JSON.parse(reply.body); };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows), md5(rows), name);
  const count = () => app.store.db.prepare('SELECT COUNT(*) n FROM familia_board_post').get().n;
  const text = message => send('familia/msg_board/send', { familiaId: 1, postType: 40550187, message });
  const feed = async () => parse(await send('familia/msg_board/feed', { familiaId: 1 })).messages;
  const page = async (no, cond, resultCount) => parse(await send('familia/msg_board/feed_by_no',
    { familiaId: 1, no, cond, resultCount })).messages;
  try {
    Date.now = () => Date.parse('2023-03-01T12:00:00Z');
    await open();
    assert.equal((await text('No membership')).status, 400);
    const currency = { userId: seed.userId, currencyId: master.currencies['currency.valis'],
      amount: 200000, cumulativeAmount: 200000, reservedAmount: 0, signature: 0 };
    put('UserCurrency', [currency]);
    const creation = parse(await send('familia/create', { name: 'Board', description: 'Local posts only.',
      godId: 20000001, style: 21000001, subStyle: 0, activeTime: 22000001, subActiveTime: 22000002,
      requireApproval: false })).operations[0];
    assert.equal((await text('Unsettled creation')).status, 400);
    const paid = { ...currency, amount: 100000 };
    parse(await send('user_data/push', { badges: null, scripts: {}, dataTokens: {},
      checksums: { before: {}, after: { UserCurrency: md5([paid]) } },
      deltas: [{ signature: 0, trigger: 'Familia', putItems: { UserCurrency: [paid] }, deleteItems: {} }],
      operations: [{ id: creation.id, verifier: creation.token }] }));
    const emptyFeedBody={familiaId:1},emptyFeedReply=await send('familia/msg_board/feed',emptyFeedBody),
      emptyFeedSequence=sequence;
    assert.deepEqual(parse(emptyFeedReply).messages, []);
    const unrelated = () => ({ profiles: app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),
      operations: app.store.operations(), iris: app.store.hardCurrency(), paidIris: app.store.paidCurrency() });
    const before = unrelated();
    const firstBody = { familiaId: 1, postType: 40550187, message: 'Hello, 家族 👋\nSaved offline.' };
    const firstReply = await send('familia/msg_board/send', firstBody), firstSequence = sequence;
    assert.deepEqual(parse(firstReply), { code: 0, result: 0 });
    const firstKey=`${firstSequence}/${firstSequence}`,
      firstReceipt=app.store.db.prepare('SELECT * FROM familia_board_post WHERE request_key=?').get(firstKey);
    assert.equal(firstReceipt.creation_operation_id,creation.id);
    assert.equal(firstReceipt.response,'{"code":0,"result":0}');
    assert.equal(firstReceipt.response_hash,crypto.createHash('md5').update(firstReceipt.response).digest('hex'));
    const first = (await feed())[0];
    assert.equal(first.feedNo, 1); assert.equal(first.userId, seed.userId);
    assert.equal(first.userName, app.store.read('UserInfo').data[0].name);
    assert.equal(first.pcId, 1011001001); assert.equal(first.postType, 40550187);
    assert.equal(first.message, firstBody.message); assert.equal(first.postedAt, Date.now() / 1000);
    assert.equal(first.expireAt, 0);
    const replay = () => request(port, firstSequence, firstBody, String(firstSequence), 'familia/msg_board/send');
    assert.deepEqual((await replay()).body, firstReply.body); assert.equal(count(), 1);
    assert.equal((await request(port,emptyFeedSequence,emptyFeedBody,String(emptyFeedSequence),
      'familia/msg_board/feed')).status,503,'A cached empty feed cannot hide the committed post');
    assert.equal((await request(port,firstSequence,{...firstBody,message:'Forged'},String(firstSequence),
      'familia/msg_board/send',{'X-ARGO-REQUEST-BODY-HASH':firstReceipt.body_hash})).status,400,
    'A forged hash header cannot redirect a retained board request to changed bytes');
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(firstKey);
    assert.deepEqual((await replay()).body,firstReply.body,
      'The permanent post receipt replays before the stale sequence gate when generic cache is absent');
    app.store.db.prepare("UPDATE familia_board_post SET response_hash='00000000000000000000000000000000' WHERE request_key=?")
      .run(firstKey);
    assert.equal((await replay()).status,503,'A damaged board response proof must not replay');
    app.store.db.prepare('UPDATE familia_board_post SET response_hash=? WHERE request_key=?')
      .run(firstReceipt.response_hash,firstKey);
    const legacySequence=900000000,legacyKey=`${legacySequence}/${legacySequence}`,
      legacyHash=crypto.createHash('md5').update(JSON.stringify(firstBody)).digest('hex');
    app.store.db.prepare('INSERT INTO reply_cache(key,action,body_hash,content_type,body) VALUES(?,?,?,?,?)')
      .run(legacyKey,'familia/msg_board/send',legacyHash,'application/json',firstReply.body.toString('base64'));
    assert.equal((await request(port,legacySequence,firstBody,String(legacySequence),
      'familia/msg_board/send')).status,503,'A legacy cached success cannot stand in for a missing durable post');
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(legacyKey);
    // Same text with a new identity is an intentional second post, not a retry.
    parse(await text(firstBody.message)); assert.equal(count(), 2);
    for (const value of [null, {}, { ...firstBody, familiaId: 2 }, { ...firstBody, familiaId: '1' },
      { ...firstBody, postType: '40550187' }, { ...firstBody, message: '' }, { ...firstBody, message: ' \n ' },
      { ...firstBody, message: 42 }, { ...firstBody, message: 'x\u0000y' }, { ...firstBody, message: 'a'.repeat(4097) },
      { ...firstBody, userId: 2 }, { postType: 40550187, message: 'Missing Familia' },
      { familiaId: 1, postType: 0, message: '23000001' },
      { familiaId: 1, postType: 0, message: 23000023 }, { familiaId: 1, postType: 0, message: 1 }])
      assert.equal((await send('familia/msg_board/send', value)).status, 400, JSON.stringify(value));
    assert.equal((await send('familia/msg_board/send', { familiaId: 1, postType: 1, message: 'Unknown' })).status, 503);
    assert.equal(count(), 2);
    // All 30 original defaults are immediately usable, not synthetic IDs.
    for (const [id, stamp] of Object.entries(master.familiaStamps)) if (stamp.isDefault)
      parse(await send('familia/msg_board/send', { familiaId: 1, postType: 0, message: Number(id) }));
    // Only actual purchases unlock the remaining 12 archived stamps.
    app.store.db.exec('UPDATE local_familia SET valis=1000000000 WHERE id=1');
    for (const [id, product] of Object.entries(master.familiaShops)) if (product.type === 1) {
      parse(await send('familia/shop/item/buy', { familiaId: 1, familiaShopId: Number(id) }));
      parse(await send('familia/msg_board/send', { familiaId: 1, postType: 0, message: product.rewardId }));
    }
    for (const postType of [40550040,40550110,40550111]) {
      const message = postType === 40550040 ? { p1: 'Elemental Dmg. (Up)' } :
        { p1: 'Fire Damage', p2: postType === 40550110 ? 1 : 45 };
      parse(await send('familia/msg_board/send', { postType, message: JSON.stringify(message) }));
      assert.deepEqual((await feed()).at(-1).message, message, 'Feed stores decoded suggestion parameters');
    }
    const total = count(); assert.equal(total, 47);
    assert.deepEqual((await page(10, 0, 3)).map(row => row.feedNo), [11,12,13]);
    assert.deepEqual((await page(10, 1, 3)).map(row => row.feedNo), [7,8,9]);
    assert.deepEqual((await page(10, 2, 3)).map(row => row.feedNo), [10,11,12]);
    assert.deepEqual((await page(10, 3, 3)).map(row => row.feedNo), [8,9,10]);
    assert.deepEqual(await page(0, 1, 3), []);
    const newerPageBody={familiaId:1,no:total,cond:0,resultCount:3},
      newerPageReply=await send('familia/msg_board/feed_by_no',newerPageBody),newerPageSequence=sequence;
    assert.deepEqual(parse(newerPageReply).messages, []);
    parse(await text('Paged feed cache invalidation'));
    assert.equal((await request(port,newerPageSequence,newerPageBody,String(newerPageSequence),
      'familia/msg_board/feed_by_no')).status,503,'A cached boundary page cannot hide a newer post');
    for (const change of [{ no: -1 }, { no: '1' }, { cond: -1 }, { cond: 4 }, { cond: '0' },
      { resultCount: 0 }, { resultCount: 1001 }, { resultCount: 1.5 }, { extra: true }])
      assert.equal((await send('familia/msg_board/feed_by_no',
        { familiaId: 1, no: 1, cond: 0, resultCount: 5, ...change })).status, 400);
    for (const message of ['bad JSON', JSON.stringify({ p1: '' }), JSON.stringify({ p1: 'X', p2: 2 }),
      JSON.stringify({ p1: 'X', p2: 1, p3: 'extra' })])
      assert.equal((await send('familia/msg_board/send', { postType: 40550110, message })).status, 400);
    for (const p2 of [1,46,'2',2.5]) assert.equal((await send('familia/msg_board/send',
      { postType: 40550111, message: JSON.stringify({ p1: 'Fire Damage', p2 }) })).status, 400);
    for (let i = 0; i < 8; i++) parse(await text(`Page ${i}`));
    const stored = await feed(); assert.equal(stored.length, 50); assert.equal(stored[0].feedNo, 7);
    assert.deepEqual((await page(6, 1, 50)).map(row => row.feedNo), [1,2,3,4,5]);
    const finalCount = count();
    app.store.db.exec("CREATE TRIGGER fail_board BEFORE INSERT ON familia_board_post BEGIN SELECT RAISE(ABORT,'rollback'); END");
    assert.equal((await text('Must roll back')).status, 503); assert.equal(count(), finalCount);
    app.store.db.exec('DROP TRIGGER fail_board');
    app.store.db.exec("CREATE TRIGGER fail_board_reply BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'rollback'); END");
    assert.equal((await text('Reply must roll back')).status, 503); assert.equal(count(), finalCount);
    app.store.db.exec('DROP TRIGGER fail_board_reply');
    // Preserve a committed post even when the generic cache is cleared.
    app.store.beginSession(); await close(); await open();
    assert.deepEqual((await replay()).body, firstReply.body); assert.equal(count(), finalCount);
    assert.deepEqual(await feed(), stored);
    const profile = app.store.read('UserProfile').data[0];
    put('UserProfile', [{ ...profile, familiaName: 'Foreign' }]);
    assert.equal((await text('Foreign member')).status, 503);
    assert.equal((await send('familia/msg_board/feed', { familiaId: 1 })).status, 503);
    const originalProfile = before.profiles.find(row => row.name === 'UserProfile');
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
      .run(originalProfile.data, originalProfile.token, originalProfile.name);
    assert.deepEqual(unrelated(), before, 'Board actions do not award, charge or overwrite player saves');
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    console.log('Familia board: native text/stamp/suggestion formats, all 42 original stamps, ownership, pagination, atomic replay and restart: OK');
  } finally {
    Date.now = realNow; await close();
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-board-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
