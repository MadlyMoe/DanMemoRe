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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-login-explorer-'));
  const database = path.join(directory, 'profile.sqlite'), realNow = Date.now, realRandom = crypto.randomInt;
  const id = 780000001, original = master.loginExplorers[id], body = { loginBonusExplorerId: id };
  let app, port, sequence = 0, now = original.startAt, roll = 0;
  const open = async () => {
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => {
    if (app?.server.listening) await new Promise(resolve => app.server.close(resolve));
    app?.store.close(); app = null;
  };
  const send = (value = body, action = 'login_bonus_explorer/draw') => request(port, ++sequence, value, String(sequence), action);
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const rows = name => app.store.read(name).data;
  const put = (name, data) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(data), md5(data), name);
  const saveBonus = (row, remove = false) => {
    const records=Array.isArray(row)?row:[row];
    return send({ badges: null, scripts: {}, dataTokens: {},
      checksums: { before: {}, after: { UserLoginBonusExplorer: md5(remove ? [] : records) } },
      deltas: [{ signature: 0, trigger: 'LoginBonusExplorerDraw',
        putItems: remove ? {} : { UserLoginBonusExplorer: records },
        deleteItems: remove ? { UserLoginBonusExplorer: records } : {} }], operations: [] }, 'user_data/push');
  };
  const snapshot = () => Object.fromEntries(['profile','login_explorer_claim','gift_claim','hard_currency',
    'login_explorer_request','operation_queue','runtime','reply_cache'].map(table =>
    [table, app.store.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
  const resetAfter = at => (Math.floor((at + 18000) / 86400) + 1) * 86400 - 18000;
  try {
    Date.now = () => now * 1000;
    crypto.randomInt = (...args) => args.length === 1 && args[0] === 10000 ? roll : realRandom(...args);
    await open();
    let before = snapshot();
    for (const value of [null, {}, { loginBonusExplorerId: 1 }, { loginBonusExplorerId: String(id) },
      { loginBonusExplorerId: 0 }, { loginBonusExplorerId: id + 0.1 }, { ...body, userId: seed.userId }]) {
      assert.equal((await send(value)).status, 400);
      assert.deepEqual(snapshot(), before);
    }
    now = original.startAt - 1;
    assert.equal((await send()).status, 400);
    now = original.endAt;
    assert.equal((await send()).status, 400, 'Native date helper excludes endAt');
    now = Math.floor(realNow() / 1000);
    assert.equal((await send()).status, 400, 'Archived schedule is not silently reopened');
    assert.deepEqual(snapshot(), before);
    now = original.startAt;
    for (const [table, event] of [['profile','UPDATE'], ['login_explorer_claim','INSERT'],
      ['login_explorer_request','INSERT'], ['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_bonus BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'bonus failure'); END`);
      assert.equal((await send()).status, 503);
      assert.deepEqual(snapshot(), before, 'Both downloaded tables, claim, reply and sequence roll back together');
      app.store.db.exec('DROP TRIGGER fail_bonus');
    }
    // Also interrupt the SECOND profile update after the gift was written.
    app.store.db.exec("CREATE TRIGGER fail_bonus BEFORE UPDATE ON profile WHEN NEW.name='UserLoginBonusExplorer' BEGIN SELECT RAISE(ABORT,'bonus record failure'); END");
    assert.equal((await send()).status, 503);
    assert.deepEqual(snapshot(), before);
    app.store.db.exec('DROP TRIGGER fail_bonus');
    const first = await send(), firstSequence = sequence;
    assert.deepEqual(parse(first), { code: 0, loginBonusExplorerRewardRank: 0 });
    const firstRequest=app.store.db.prepare('SELECT * FROM login_explorer_request WHERE request_key=?')
      .get(`${firstSequence}/${firstSequence}`);
    assert.equal(firstRequest.bonus_id,id);assert.equal(firstRequest.rank,0);
    const gift = rows('UserGift')[0];
    assert.equal(gift.itemId, 205000001);
    assert.equal(gift.amount, 100);
    assert.equal(gift.state, 0);
    assert.equal(gift.senderType, 1, 'Original COMPANY sender enum');
    assert.equal(gift.giftAcquiredType, 2, 'Original LOGINBONUS source enum');
    assert.equal(gift.expireAt, 0, 'Offline delivery policy keeps the gift permanently');
    assert.deepEqual(rows('UserLoginBonusExplorer'), [{ userId: seed.userId, loginBonusExplorerId: id,
      receiptCount: 1, lastReceivedAt: now, playableState: 1 }]);
    assert.equal(app.store.hardCurrency(), 0, 'Drawing sends a gift, not an immediate wallet award');
    assert.deepEqual(app.store.operations(), []);
    // WRITTEN ONLY / NOT RUN: native count cannot outrun the server's issued draw ledger.
    const firstBonus=rows('UserLoginBonusExplorer')[0];
    before=snapshot();assert.equal((await saveBonus({...firstBonus,receiptCount:2})).status,400);
    assert.deepEqual(snapshot(),before);
    put('UserLoginBonusExplorer',[{...firstBonus,receiptCount:2}]);
    before=snapshot();assert.equal((await send()).status,503);
    assert.equal((await send({tables:['UserLoginBonusExplorer']},'user_data/pull')).status,503);
    assert.deepEqual(snapshot(),before);
    put('UserLoginBonusExplorer',[firstBonus]);
    const firstReceipt=app.store.db.prepare('SELECT * FROM login_explorer_claim WHERE bonus_id=?').get(id);
    app.store.db.prepare('UPDATE login_explorer_claim SET received_at=? WHERE bonus_id=? AND day=?')
      .run(firstReceipt.received_at+86400,id,firstReceipt.day);
    before=snapshot();assert.equal((await send()).status,503);
    assert.equal((await send({tables:['UserLoginBonusExplorer']},'user_data/pull')).status,503);
    assert.deepEqual(snapshot(),before);
    app.store.db.prepare('UPDATE login_explorer_claim SET received_at=? WHERE bonus_id=? AND day=?')
      .run(firstReceipt.received_at,id,firstReceipt.day);
    // WRITTEN ONLY / NOT RUN: the draw ledger must retain its actual unclaimed Present.
    const removeGift={ badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserGift:md5([])}},
      deltas:[{signature:0,trigger:'GiftReceive',putItems:{},deleteItems:{UserGift:[{id:gift.id}]}}],operations:[] };
    before=snapshot();assert.equal((await send(removeGift,'user_data/push')).status,400);assert.deepEqual(snapshot(),before);
    for(const altered of [[],[{...gift,amount:gift.amount+1}]]) {
      put('UserGift',altered);before=snapshot();
      assert.equal((await send()).status,503);
      assert.equal((await send({tables:['UserGift']},'user_data/pull')).status,503);
      assert.deepEqual(snapshot(),before);
      put('UserGift',[gift]);
    }
    const pulled = app.store.pull({ tables: ['UserLoginBonusExplorer','UserGift'] });
    assert.deepEqual(pulled.data.UserGift, [gift]);
    assert.equal(pulled.dataTokens.UserGift, md5([gift]));
    // WRITTEN ONLY / NOT RUN: client saves cannot undo the server's durable claim.
    const issued=rows('UserLoginBonusExplorer')[0];
    parse(await saveBonus(issued));
    for(const changed of [{...issued,receiptCount:0},{...issued,lastReceivedAt:0},
      {...issued,playableState:0},{...issued,userId:issued.userId+1},
      {...issued,playableState:'1'},{...issued,playableState:3}]) {
      before=snapshot();assert.equal((await saveBonus(changed)).status,400);assert.deepEqual(snapshot(),before);
    }
    before=snapshot();assert.equal((await saveBonus([issued,issued])).status,400);assert.deepEqual(snapshot(),before);
    before=snapshot();assert.equal((await saveBonus(issued,true)).status,400);assert.deepEqual(snapshot(),before);
    now = resetAfter(now) - 1;
    assert.deepEqual(parse(await send()), parse(first));
    assert.equal(rows('UserGift').length, 1);
    await close(); await open();
    // WRITTEN ONLY / NOT RUN: a successful retry cannot mask a lost native PLAYED state.
    const played=rows('UserLoginBonusExplorer');
    put('UserLoginBonusExplorer',[{...played[0],playableState:0}]);
    before=snapshot();assert.equal((await send()).status,503);assert.deepEqual(snapshot(),before);
    assert.equal((await send({tables:['UserLoginBonusExplorer']},'user_data/pull')).status,503);
    assert.deepEqual(snapshot(),before);
    put('UserLoginBonusExplorer',played);
    app.store.db.prepare("UPDATE profile SET data='{' WHERE name='UserLoginBonusExplorer'").run();
    before=snapshot();assert.equal((await send({tables:['UserLoginBonusExplorer']},'user_data/pull')).status,503);
    assert.deepEqual(snapshot(),before);
    put('UserLoginBonusExplorer',played);
    assert.deepEqual(parse(await send()), parse(first));
    const claim = parse(await send({ userId: seed.userId, giftIds: [gift.id] }, 'gift/receive')).operations[0];
    assert.deepEqual(claim.parameters.receivedItems, [{ itemId: 205000001, amount: 100 }]);
    assert.equal(app.store.hardCurrency(), 100);
    parse(await send({ badges: null, scripts: {}, dataTokens: {}, checksums: { before: {}, after: { UserGift: md5([]) } },
      deltas: [{ signature: 0, trigger: 'GiftReceive', putItems: {}, deleteItems: { UserGift: [{ id: gift.id }] } }],
      operations: [{ id: claim.id, verifier: claim.token }] }, 'user_data/push'));
    assert.deepEqual(parse(await send()),parse(first),'Claimed and deleted Present can replay its same-day draw');
    put('UserGift',[gift]);before=snapshot();
    assert.equal((await send()).status,503,'ACKed Present cannot be restored as unclaimed');
    assert.deepEqual(snapshot(),before);put('UserGift',[]);
    now += 1; roll = 499;
    // Original user_enum.enc: a saved row can become CAN_PLAY=2 on the next day.
    parse(await saveBonus({...rows('UserLoginBonusExplorer')[0],playableState:2}));
    const savedBeforeSecond=rows('UserLoginBonusExplorer');
    put('UserLoginBonusExplorer',[{...savedBeforeSecond[0],playableState:'1'}]);
    before=snapshot();assert.equal((await send()).status,503);assert.deepEqual(snapshot(),before);
    put('UserLoginBonusExplorer',savedBeforeSecond);
    assert.equal(parse(await send()).loginBonusExplorerRewardRank, 0, 'Eligibility resets exactly at 04:00 JST');
    assert.equal(rows('UserGift')[0].id, gift.id + 1, 'Deleted gift IDs remain reserved by durable claims');
    assert.equal(rows('UserLoginBonusExplorer')[0].receiptCount, 2);
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`${firstSequence}/${firstSequence}`);
    assert.deepEqual((await request(port, firstSequence, body, String(firstSequence), 'login_bonus_explorer/draw')).body,
      first.body, 'Permanent transport retry across the boundary returns the original result without reply cache');
    assert.equal(rows('UserLoginBonusExplorer')[0].receiptCount, 2);
    before=snapshot();
    assert.equal((await request(port,firstSequence,{loginBonusExplorerId:id+1},String(firstSequence),
      'login_bonus_explorer/draw')).status,400,'Changed draw cannot reuse a permanent request identity');
    assert.deepEqual(snapshot(),before);
    app.store.db.prepare('UPDATE login_explorer_request SET rank=1 WHERE request_key=?')
      .run(`${firstSequence}/${firstSequence}`);
    before=snapshot();
    assert.equal((await request(port,firstSequence,body,String(firstSequence),'login_bonus_explorer/draw')).status,503,
      'Corrupt durable draw receipt cannot roll again or select a later day');
    assert.deepEqual(snapshot(),before);
    app.store.db.prepare('UPDATE login_explorer_request SET rank=? WHERE request_key=?')
      .run(firstRequest.rank,`${firstSequence}/${firstSequence}`);
    // WRITTEN ONLY: a fresh same-day replay may read a later draw, but not a rewound or deleted saved record.
    const secondAt=now, afterSecond=rows('UserLoginBonusExplorer');
    now=original.startAt;
    assert.deepEqual(parse(await send()),parse(first));
    put('UserLoginBonusExplorer',[{...afterSecond[0],receiptCount:1,lastReceivedAt:original.startAt}]);
    before=snapshot();assert.equal((await send()).status,503);assert.deepEqual(snapshot(),before);
    put('UserLoginBonusExplorer',[]);
    before=snapshot();assert.equal((await send()).status,503);assert.deepEqual(snapshot(),before);
    put('UserLoginBonusExplorer',afterSecond);now=secondAt;
    for (const [sample, rank] of [[500,1],[2999,1],[3000,2],[6999,2],[7000,3],[9999,3]]) {
      now = resetAfter(now); roll = sample;
      assert.equal(parse(await send()).loginBonusExplorerRewardRank, rank);
      const reward = original.rewards[rank], latestGift = rows('UserGift').at(-1);
      assert.equal(latestGift.itemId, master.items[reward.rewardKey]);
      assert.equal(latestGift.amount, reward.amount);
    }
    // WRITTEN ONLY / NOT RUN: a surviving latest draw cannot hide a missing middle receipt.
    const middle=app.store.db.prepare('SELECT * FROM login_explorer_claim WHERE bonus_id=? AND receipt_count=4').get(id);
    app.store.db.prepare('DELETE FROM login_explorer_claim WHERE bonus_id=? AND day=?').run(id,middle.day);
    before=snapshot();assert.equal((await send()).status,503);
    assert.equal((await send({tables:['UserLoginBonusExplorer']},'user_data/pull')).status,503);
    assert.deepEqual(snapshot(),before);
    app.store.db.prepare('INSERT INTO login_explorer_claim(bonus_id,day,rank,receipt_count,received_at,gift_id) VALUES(?,?,?,?,?,?)')
      .run(middle.bonus_id,middle.day,middle.rank,middle.receipt_count,middle.received_at,middle.gift_id);
    const saved = rows('UserLoginBonusExplorer');
    now = resetAfter(now);
    put('UserLoginBonusExplorer', [{ ...saved[0], receiptCount: 0, lastReceivedAt: 0 }]);
    before = snapshot();
    assert.equal((await send()).status, 503);
    assert.deepEqual(snapshot(), before, 'A stale client save cannot replenish daily/cumulative eligibility');
    put('UserLoginBonusExplorer', saved);
    for (let count = 8; count < original.limit; count++) {
      parse(await send());
      assert.equal(rows('UserLoginBonusExplorer')[0].receiptCount, count + 1);
      assert.deepEqual(parse(await send()), { code: 0, loginBonusExplorerRewardRank: 3 });
      now = resetAfter(now);
    }
    before = snapshot();
    assert.equal((await send()).status, 400);
    assert.deepEqual(snapshot(), before, 'Cumulative draw limit survives daily rollover');
    await close(); await open();
    assert.equal((await send()).status, 400);
    const ticketId = 780000003;
    now = master.loginExplorers[ticketId].startAt; roll = 0;
    assert.equal(parse(await send({ loginBonusExplorerId: ticketId })).loginBonusExplorerRewardRank, 0);
    const ticketGift = rows('UserGift').at(-1), reward = master.loginExplorers[ticketId].rewards[0];
    assert.equal(ticketGift.itemId, master.items[reward.rewardKey]);
    const ticketClaim = parse(await send({ userId: seed.userId, giftIds: [ticketGift.id] }, 'gift/receive')).operations[0];
    assert.deepEqual(ticketClaim.parameters.receivedItems, [{ itemId: ticketGift.itemId, amount: reward.amount }]);
    assert.equal(app.store.hardCurrency(), 100, 'Ticket and uncollected Iris gifts cannot credit the wallet');
    assert.deepEqual(rows('UserLoginBonusExplorerProgress'), [], 'Presentation progress is not fabricated by a draw');
    console.log('Treasure hunt: archived rewards, reconstructed weighted draws, 04:00 JST reset, persistent gifts/counts, claim integration, rollback and restart OK; native UI unverified');
  } finally {
    Date.now = realNow; crypto.randomInt = realRandom;
    await close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
