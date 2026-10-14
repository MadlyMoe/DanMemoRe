'use strict';

// DEFERRED / NOT RUN. Synthetic saves do not prove native signatures/UI order.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = value => crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-character-present-'));
  const database = path.join(directory, 'profile.sqlite'), realNow = Date.now;
  const event = master.characterPresents[52000000001], [character, other] = event.characters;
  let app, port, sequence = 0, now = event.startAt;
  const open = async () => {
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => {
    if (app?.server.listening) await new Promise(resolve => app.server.close(resolve));
    app?.store.close(); app = null;
  };
  const send = (value, action = 'present/character/reward/get') => request(port, ++sequence, value, String(sequence), action);
  const claim = (id = character.id) => send({ characterPresentCharacterInfoId: id });
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows), md5(rows), name);
  const points = (row = character, currentPoint = row.requiredPoint) => ({ userId: seed.userId,
    characterPresentCharacterInfoId: row.id, currentPoint, isComplete: false });
  const inventory = (row = character) => ({ userId: seed.userId, staminaTicketId: row.rewardItemId,
    amount: 2, cumulativeAmount: 5, reservedAmount: 0, bookEntryState: 1, signature: 0 });
  const snapshot = () => Object.fromEntries(app.store.db.prepare(`SELECT name FROM sqlite_master
    WHERE type='table' AND name!='event_clock' ORDER BY name`).all()
    .map(({name}) => [name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const durable = () => {
    const state = snapshot();
    for (const name of ['runtime','reply_cache','expedition_listener_clock']) delete state[name];
    return state;
  };
  const push = (operations, putItems = {}, deleteItems = {}, trigger = 'CharacterPresentUseItem') => send({ badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: Object.fromEntries([...new Set([...Object.keys(putItems), ...Object.keys(deleteItems)])]
      .map(name => [name, md5(putItems[name] ?? [])])) },
    deltas: Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature: 0, trigger, putItems, deleteItems }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })) }, 'user_data/push');
  const unavailable = response => {
    assert.equal(response.status,503);
    assert.equal(response.headers['x-argo-server-response-code'],String(OFFLINE_UNAVAILABLE_CODE));
  };
  try {
    Date.now = () => now * 1000;
    await open();
    const useItem = event.items[0];
    assert.deepEqual(useItem,{ id:52100000001,itemId:290000181,point:5 });
    const eventItem = (amount = 100, cumulativeAmount = 100) => ({ userId:seed.userId,eventItemId:useItem.itemId,
      amount,cumulativeAmount,reservedAmount:0,bookEntryState:1,signature:0 });
    // Synthetic inventory funding, not proof of natural original campaign drops.
    put('UserCharacterPresentCharacterInfo',[]);
    put('UserEventItem',[]);
    parse(await push([], { UserCharacterPresentCharacterInfo:event.characters.map(row => points(row,0)) }));
    assert.equal(app.store.read('UserCharacterPresentCharacterInfo').data.length,20,'Each original long character-row ID is independent');
    parse(await push([], {}, { UserCharacterPresentCharacterInfo:[{characterPresentCharacterInfoId:character.id}] }));
    parse(await push([], { UserCharacterPresentCharacterInfo:[points(character,0)],UserEventItem:[eventItem(0,0)] }));
    parse(await push([], {}, { UserEventItem:[{eventItemId:useItem.itemId}] }));
    assert.deepEqual(app.store.read('UserEventItem').data,[],'Empty unearned item rows may be cleaned up');
    put('UserEventItem',[eventItem()]);
    let before = snapshot();
    for (const row of [points(character,1),points(character,-5),points(character,5.5),points(character,'5'),
      points(character,0x80000000),{ ...points(character,5),userId:2 },{ ...points(character,5),isComplete:1 },
      { ...points(character,5),characterPresentCharacterInfoId:42 }]) {
      assert.equal((await push([], { UserCharacterPresentCharacterInfo:[row],UserEventItem:[eventItem(99)] })).status,400);
      assert.deepEqual(snapshot(),before);
    }
    unavailable(await push([], { UserCharacterPresentCharacterInfo:[points(character,5)],UserEventItem:[eventItem(99)] },{},'CharacterPresentApplication'));
    assert.deepEqual(snapshot(),before,'A different save trigger is not the original point-use path');
    const itemRows = event.items;
    try {
      event.items = [];
      unavailable(await push([], { UserCharacterPresentCharacterInfo:[points(character,5)],UserEventItem:[eventItem(99)] }));
      assert.deepEqual(snapshot(),before,'Missing original item metadata cannot be guessed from the100-point threshold');
    } finally { event.items = itemRows; }
    put('UserEventItem',[]); before = snapshot();
    unavailable(await push([], { UserCharacterPresentCharacterInfo:[points(character,5)] }));
    assert.deepEqual(snapshot(),before,'A point-first save cannot reserve missing owned stock');
    put('UserEventItem',[eventItem()]); before = snapshot();
    for (const rows of [[eventItem(100)], [{ ...eventItem(99),userId:2 }], [eventItem(101)],
      [eventItem(99,99)], [eventItem(-1)], [eventItem(99.5)], [eventItem(99),eventItem(99)]]) {
      assert.equal((await push([], { UserCharacterPresentCharacterInfo:[points(character,5)],UserEventItem:rows })).status,400);
      assert.deepEqual(snapshot(),before);
    }
    assert.equal((await push([], { UserCharacterPresentCharacterInfo:[points(character,5),points(character,5)],
      UserEventItem:[eventItem(98)] })).status,400);
    assert.deepEqual(snapshot(),before);
    const pullValue = { tables:['UserCharacterPresentCharacterInfo','UserEventItem'],consistentRead:true,recovery:false };
    assert.equal((await send(pullValue,'user_data/pull')).status,200); const oldPull = sequence;
    parse(await send(null,'user_data/confirm')); const oldConfirm = sequence;
    before = snapshot();
    for (const [table,kind] of [['profile','UPDATE'],['local_save_meta','UPDATE'],['reply_cache','INSERT'],['runtime','UPDATE']]) {
      app.store.db.exec(`CREATE TRIGGER fail_present_points BEFORE ${kind} ON ${table} BEGIN SELECT RAISE(ABORT,'point save failure'); END`);
      unavailable(await push([], { UserCharacterPresentCharacterInfo:[points()],UserEventItem:[eventItem(80)] }));
      assert.deepEqual(snapshot(),before,'Points, item cost, token, wall checkpoint, sequence and reply commit together');
      app.store.db.exec('DROP TRIGGER fail_present_points');
    }
    const earnedResponse = await push([], { UserCharacterPresentCharacterInfo:[points()],UserEventItem:[eventItem(80)] }), earnedSequence = sequence;
    parse(earnedResponse);
    assert.equal(app.store.read('UserCharacterPresentCharacterInfo').data.find(row => row.characterPresentCharacterInfoId === character.id).currentPoint,100);
    assert.deepEqual(app.store.read('UserEventItem').data,[eventItem(80)]);
    assert.deepEqual(app.store.operations(),[],'Earning points does not auto-claim11100 or grant a ticket');
    const cachedSave = { badges:null,scripts:{},dataTokens:{},
      checksums:{before:{},after:{UserCharacterPresentCharacterInfo:md5([points()]),UserEventItem:md5([eventItem(80)])}},
      deltas:[{signature:0,trigger:'CharacterPresentUseItem',putItems:{UserCharacterPresentCharacterInfo:[points()],UserEventItem:[eventItem(80)]},deleteItems:{}}],operations:[] };
    await close(); await open(); now = event.endAt + 100;
    before = snapshot();
    assert.deepEqual((await request(port,earnedSequence,cachedSave,String(earnedSequence),'user_data/push')).body,earnedResponse.body);
    assert.deepEqual(snapshot(),before,'Unchanged cached native checkpoint survives restart without spending again');
    unavailable(await request(port,oldPull,pullValue,String(oldPull),'user_data/pull'));
    unavailable(await request(port,oldConfirm,null,String(oldConfirm),'user_data/confirm'));
    assert.deepEqual(snapshot(),before,'Stale native data/tokens cannot restore pre-earned points or unspent items');
    // Native mutation occurs before one save; delayed checkpoints survive clock changes.
    parse(await push([], { UserCharacterPresentCharacterInfo:[points(character,105),points(other,5)],UserEventItem:[eventItem(82,104)] }));
    assert.equal(app.store.read('UserCharacterPresentCharacterInfo').data.find(row => row.characterPresentCharacterInfoId === character.id).currentPoint,105,
      'The native int32 accumulator is not capped at the100-point reward threshold');
    before = snapshot();
    unavailable(await request(port,earnedSequence,cachedSave,String(earnedSequence),'user_data/push'));
    assert.deepEqual(snapshot(),before,'Old save replies cannot reintroduce stale tokens after a later checkpoint');
    for (const [puts,deletes] of [[{UserCharacterPresentCharacterInfo:[points(character,100)]},{}],
      [{},{UserCharacterPresentCharacterInfo:[{characterPresentCharacterInfoId:character.id}]}],
      [{UserEventItem:[eventItem(83,104)]},{}], [{UserEventItem:[eventItem(80,100)]},{}],
      [{},{UserEventItem:[{eventItemId:useItem.itemId}]}]]) {
      assert.equal((await push([],puts,deletes)).status,400);
      assert.deepEqual(snapshot(),before,'Earned points and consumed copies cannot be restored or removed');
    }
    parse(await push([], { UserCharacterPresentCharacterInfo:[{ ...points(character,105),isComplete:true }] }));
    parse(await push([], { UserCharacterPresentCharacterInfo:[points(character,105)] }));
    parse(await push([], { UserEventItem:[eventItem(86,108)] }));
    const everyCharacter = app.store.read('UserCharacterPresentCharacterInfo').data.map(row => ({...row,currentPoint:row.currentPoint+5}));
    parse(await push([], { UserCharacterPresentCharacterInfo:everyCharacter,UserEventItem:[eventItem(66,108)] }));
    assert.deepEqual(app.store.read('UserCharacterPresentCharacterInfo').data,everyCharacter,'All20 original characters share the aggregated original item cost');
    assert.deepEqual(app.store.read('UserEventItem').data,[eventItem(66,108)]);
    assert.equal((await send(pullValue,'user_data/pull')).status,200);
    parse(await send(null,'user_data/confirm'));
    await close(); await open();
    assert.deepEqual(app.store.read('UserCharacterPresentCharacterInfo').data,everyCharacter);
    assert.deepEqual(app.store.read('UserEventItem').data,[eventItem(66,108)]);
    // Offline item-first recovery: actual saved spending can fund a delayed
    // point half once. This synthetic order is NOT native coalescing acceptance.
    const creditRow = () => app.store.db.prepare('SELECT * FROM character_present_point_credit WHERE item_id=?').get(useItem.itemId);
    assert.equal(creditRow(),undefined,'Old net spending is never backfilled into new point credit');
    for (const [table,kind] of [['character_present_point_credit','INSERT'],['profile','UPDATE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_split_spend BEFORE ${kind} ON ${table} BEGIN SELECT RAISE(ABORT,'split spending rollback'); END`);
      before = snapshot();
      unavailable(await push([], { UserEventItem:[eventItem(65,108)] }));
      assert.deepEqual(snapshot(),before,'Private credit, stock, tokens, sequence and reply must roll back together');
      app.store.db.exec('DROP TRIGGER fail_split_spend');
    }
    parse(await push([], { UserEventItem:[eventItem(65,108)] }));
    assert.deepEqual(creditRow(),{item_id:useItem.itemId,event_id:52000000001,point:5,remaining:1,spent_floor:43,owed:0,owed_floor:0});
    assert.deepEqual(app.store.read('UserCharacterPresentCharacterInfo').data,everyCharacter,'Item-first spending must not prewrite any native points');
    app.store.db.exec('ALTER TABLE character_present_point_credit DROP COLUMN owed_floor; ALTER TABLE character_present_point_credit DROP COLUMN owed');
    await close(); await open();
    assert.deepEqual(creditRow(),{item_id:useItem.itemId,event_id:52000000001,point:5,remaining:1,spent_floor:43,owed:0,owed_floor:0},
      'Additive migration retains all five old fields without guessing an old point-first cost');
    now = event.endAt+86400;
    before = snapshot();
    const splitPoint = { ...everyCharacter.find(row => row.characterPresentCharacterInfoId === character.id),
      currentPoint:everyCharacter.find(row => row.characterPresentCharacterInfoId === character.id).currentPoint+5 };
    unavailable(await push([], { UserCharacterPresentCharacterInfo:[{...splitPoint,currentPoint:splitPoint.currentPoint+330}] }));
    unavailable(await push([], { UserCharacterPresentCharacterInfo:[splitPoint] },{},'CharacterPresentApplication'));
    assert.equal((await push([], { UserEventItem:[eventItem(66,108)] })).status,400);
    assert.deepEqual(snapshot(),before,'Costs exceeding credit plus owned stock, wrong triggers and restoration cannot consume credit');
    const capturedCredit = creditRow();
    app.store.db.prepare('UPDATE character_present_point_credit SET point=10 WHERE item_id=?').run(useItem.itemId);
    before = snapshot();
    unavailable(await push([], { UserCharacterPresentCharacterInfo:[splitPoint] }));
    assert.deepEqual(snapshot(),before,'A changed original conversion capture cannot fund points');
    app.store.db.prepare('UPDATE character_present_point_credit SET point=5 WHERE item_id=?').run(useItem.itemId);
    app.store.db.prepare('DELETE FROM character_present_point_credit WHERE item_id=?').run(useItem.itemId);
    before = snapshot();
    unavailable(await push([], { UserCharacterPresentCharacterInfo:[{...splitPoint,currentPoint:splitPoint.currentPoint+325}] }));
    assert.deepEqual(snapshot(),before,'Missing legacy credit must not be reconstructed from current net spending');
    app.store.db.prepare('INSERT INTO character_present_point_credit(item_id,event_id,point,remaining,spent_floor) VALUES(?,?,?,?,?)').run(
      capturedCredit.item_id,capturedCredit.event_id,capturedCredit.point,capturedCredit.remaining,capturedCredit.spent_floor);
    for (const [table,kind] of [['character_present_point_credit','UPDATE'],['profile','UPDATE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_split_points BEFORE ${kind} ON ${table} BEGIN SELECT RAISE(ABORT,'split point rollback'); END`);
      before = snapshot();
      unavailable(await push([], { UserCharacterPresentCharacterInfo:[splitPoint] }));
      assert.deepEqual(snapshot(),before,'Points and the consumed private credit must commit together');
      app.store.db.exec('DROP TRIGGER fail_split_points');
    }
    const pointHalf = {badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{
      UserCharacterPresentCharacterInfo:md5([splitPoint])}},deltas:[{signature:0,trigger:'CharacterPresentUseItem',
      putItems:{UserCharacterPresentCharacterInfo:[splitPoint]},deleteItems:{}}],operations:[]};
    const pointReply = await send(pointHalf,'user_data/push'), pointSequence = sequence;
    parse(pointReply);
    assert.equal(creditRow().remaining,0);
    assert.deepEqual(app.store.read('UserEventItem').data,[eventItem(65,108)],'Delayed points do not deduct the same item twice');
    await close(); await open();
    before = snapshot();
    assert.deepEqual((await request(port,pointSequence,pointHalf,String(pointSequence),'user_data/push')).body,pointReply.body);
    assert.deepEqual(snapshot(),before,'Exact retry cannot recreate or consume spending credit twice');
    app.store.db.prepare("DELETE FROM reply_cache WHERE action='user_data/push'").run();
    parse(await push([], { UserCharacterPresentCharacterInfo:[splitPoint] }));
    assert.equal(creditRow().remaining,0,'A fresh identity after cache eviction does not re-credit unchanged native points');
    before = snapshot();
    unavailable(await push([], { UserCharacterPresentCharacterInfo:[{...splitPoint,currentPoint:splitPoint.currentPoint+330}] }));
    assert.deepEqual(snapshot(),before,'Consumed credit cannot fund points beyond retained owned stock');
    // All20 original character IDs may consume the same original item pool;
    // an intervening ordinary acquisition preserves, but never mints, credit.
    parse(await push([], { UserEventItem:[eventItem(45,108)] }));
    assert.equal(creditRow().remaining,20);
    parse(await push([], { UserEventItem:[eventItem(55,118)] }));
    assert.equal(creditRow().remaining,20);
    const delayedAll = app.store.read('UserCharacterPresentCharacterInfo').data.map(row=>({...row,currentPoint:row.currentPoint+5}));
    parse(await push([], { UserCharacterPresentCharacterInfo:delayedAll }));
    assert.equal(creditRow().remaining,0);
    assert.deepEqual(app.store.read('UserCharacterPresentCharacterInfo').data,delayedAll);
    parse(await push([], { UserEventItem:[eventItem(53,118)] }));
    assert.equal(creditRow().remaining,2);
    const combinedPoint = {...delayedAll[0],currentPoint:delayedAll[0].currentPoint+15};
    parse(await push([], { UserCharacterPresentCharacterInfo:[combinedPoint],UserEventItem:[eventItem(52,118)] }));
    assert.equal(creditRow().remaining,0,'Combined saves consume two prior copies plus one newly spent copy, not three fresh copies');
    // Other triggers and mixed/clipped acquisitions cannot bank attribution.
    parse(await push([], { UserEventItem:[eventItem(51,118)] },{},'CharacterPresentApplication'));
    parse(await push([], { UserEventItem:[eventItem(51,119)] }));
    assert.equal(creditRow().remaining,0);
    const unearned = {...combinedPoint,currentPoint:combinedPoint.currentPoint+260};
    before = snapshot();
    unavailable(await push([], { UserCharacterPresentCharacterInfo:[unearned] }));
    assert.deepEqual(snapshot(),before);
    // Offline point-first recovery binds FUTURE costs to actual owned stock,
    // not old spending. No native item prewrite or automatic11100 claim.
    app.store.db.prepare('DELETE FROM character_present_point_credit WHERE item_id=?').run(useItem.itemId);
    const pointFirst = {...combinedPoint,currentPoint:combinedPoint.currentPoint+5},
      pendingHalf = {...pointHalf,checksums:{before:{},after:{UserCharacterPresentCharacterInfo:md5([pointFirst])}},
        deltas:[{...pointHalf.deltas[0],putItems:{UserCharacterPresentCharacterInfo:[pointFirst]}}]},
      itemPull = {tables:['UserEventItem'],consistentRead:true,recovery:false};
    parse(await send(itemPull,'user_data/pull')); const preCostPull = sequence;
    for (const [table,kind] of [['character_present_point_credit','INSERT'],['profile','UPDATE'],
      ['local_save_meta','UPDATE'],['reply_cache','INSERT'],['runtime','UPDATE']]) {
      app.store.db.exec(`CREATE TRIGGER fail_point_first BEFORE ${kind} ON ${table} BEGIN SELECT RAISE(ABORT,'point-first rollback'); END`);
      before = snapshot(); unavailable(await send(pendingHalf,'user_data/push'));
      assert.deepEqual(snapshot(),before,'Native points, private pending cost, metadata, sequence and reply commit together');
      app.store.db.exec('DROP TRIGGER fail_point_first');
    }
    const pendingReply = await send(pendingHalf,'user_data/push'), pendingSequence = sequence;
    parse(pendingReply);
    const pendingCredit = {item_id:useItem.itemId,event_id:52000000001,point:5,remaining:0,spent_floor:68,owed:1,owed_floor:69};
    assert.deepEqual(creditRow(),pendingCredit);
    assert.deepEqual(app.store.read('UserEventItem').data,[eventItem(51,119)],'Points arriving first do not pre-debit native stock');
    assert.deepEqual(app.store.operations(),[],'A pending item cost is not a reward operation');
    before = snapshot();
    unavailable(await claim()); unavailable(await send(itemPull,'user_data/pull'));
    unavailable(await request(port,preCostPull,itemPull,String(preCostPull),'user_data/pull'));
    assert.deepEqual(snapshot(),before,'Fresh claims and old/fresh stock pulls cannot use or reload unpaid points');
    await close(); await open();
    assert.deepEqual(creditRow(),pendingCredit,'Restart retains the pending cost, not a guessed debit or point rollback');
    before = snapshot();
    assert.deepEqual((await request(port,pendingSequence,pendingHalf,String(pendingSequence),'user_data/push')).body,pendingReply.body);
    unavailable(await claim()); unavailable(await send(itemPull,'user_data/pull'));
    assert.deepEqual(snapshot(),before,'Exact point-half retry is once-only; a lost native item half remains unavailable');
    assert.equal((await send({...itemPull,tables:['UserCharacterPresentCharacterInfo']},'user_data/pull')).status,200);
    parse(await send(null,'user_data/confirm'));
    app.store.db.prepare("DELETE FROM reply_cache WHERE action='user_data/push'").run();
    parse(await push([], {UserCharacterPresentCharacterInfo:[pointFirst]}));
    assert.deepEqual(creditRow(),pendingCredit,'Cache eviction and a fresh unchanged point save cannot add a second cost');
    for (const [key,value] of [['owed_floor',70],['spent_floor',69],['remaining',1],['point',10]]) {
      app.store.db.prepare(`UPDATE character_present_point_credit SET ${key}=? WHERE item_id=?`).run(value,useItem.itemId);
      before = snapshot(); unavailable(await claim()); unavailable(await send(itemPull,'user_data/pull'));
      assert.deepEqual(snapshot(),before,'Corrupt retained funding is preserved and unavailable, never repaired from stock');
      app.store.db.prepare(`UPDATE character_present_point_credit SET ${key}=? WHERE item_id=?`).run(pendingCredit[key],useItem.itemId);
    }
    before = snapshot();
    unavailable(await push([], {UserEventItem:[eventItem(50,119)]},{},'CharacterPresentApplication'));
    unavailable(await push([], {UserEventItem:[eventItem(50,120)]}));
    assert.equal((await push([], {UserEventItem:[eventItem(52,119)]})).status,400);
    assert.equal((await push([], {UserCharacterPresentCharacterInfo:[combinedPoint]})).status,400);
    assert.deepEqual(snapshot(),before,'Wrong/mixed spending, stock restoration and point rewind cannot settle a pending cost');
    // Paying one old copy while adding one new cost leaves the count equal,
    // but MUST advance its exact retained spending floor/target atomically.
    const overlapPoint = {...pointFirst,currentPoint:pointFirst.currentPoint+5};
    for (const [table,kind] of [['character_present_point_credit','UPDATE'],['profile','UPDATE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_pending_cost BEFORE ${kind} ON ${table} BEGIN SELECT RAISE(ABORT,'pending-cost rollback'); END`);
      before = snapshot();
      unavailable(await push([], {UserCharacterPresentCharacterInfo:[overlapPoint],UserEventItem:[eventItem(50,119)]}));
      assert.deepEqual(snapshot(),before,'The equal-count pending floor changes in the same native save transaction');
      app.store.db.exec('DROP TRIGGER fail_pending_cost');
    }
    parse(await push([], {UserCharacterPresentCharacterInfo:[overlapPoint],UserEventItem:[eventItem(50,119)]}));
    assert.deepEqual(creditRow(),{...pendingCredit,spent_floor:69,owed_floor:70});
    const morePoints = {...overlapPoint,currentPoint:overlapPoint.currentPoint+10};
    parse(await push([], {UserCharacterPresentCharacterInfo:[morePoints]}));
    assert.deepEqual(creditRow(),{...pendingCredit,spent_floor:69,owed:3,owed_floor:72});
    parse(await push([], {UserEventItem:[eventItem(49,119)]}));
    assert.deepEqual(creditRow(),{...pendingCredit,spent_floor:70,owed:2,owed_floor:72});
    before = snapshot(); unavailable(await claim()); assert.deepEqual(snapshot(),before,'Partial payment cannot unlock a reward');
    parse(await push([], {UserEventItem:[eventItem(50,120)]}));
    assert.deepEqual(creditRow(),{...pendingCredit,spent_floor:70,owed:2,owed_floor:72},'An ordinary acquisition does not pay or forget the pending cost');
    parse(await push([], {UserEventItem:[eventItem(48,120)]}));
    assert.deepEqual(creditRow(),{...pendingCredit,spent_floor:72,owed:0,owed_floor:0});
    assert.deepEqual(app.store.read('UserCharacterPresentCharacterInfo').data.find(row=>row.characterPresentCharacterInfoId===character.id),morePoints);
    const pointFirstAll = app.store.read('UserCharacterPresentCharacterInfo').data.map(row=>({...row,currentPoint:row.currentPoint+5}));
    parse(await push([], {UserCharacterPresentCharacterInfo:pointFirstAll}));
    assert.deepEqual(creditRow(),{...pendingCredit,spent_floor:72,owed:20,owed_floor:92});
    parse(await push([], {UserEventItem:[eventItem(38,120)]}));
    assert.deepEqual(creditRow(),{...pendingCredit,spent_floor:82,owed:10,owed_floor:92});
    before = snapshot(); unavailable(await claim()); assert.deepEqual(snapshot(),before);
    // Original shop323 spends a different campaign item. A second trigger
    // in one batch cannot capture the point-use spending as shop payment too.
    const shopPrice = master.shopProducts[207001323], priceItem = {...eventItem(20,20),eventItemId:shopPrice.priceItemId},
      priceAfter = {...priceItem,amount:priceItem.amount-shopPrice.price};
    assert.equal(shopPrice.price,15); assert.equal(master.itemProfiles[shopPrice.priceItemId].table,'UserEventItem');
    put('UserEventItem',[eventItem(38,120),priceItem]);
    const campaignShopSpends = () => app.store.db.prepare('SELECT * FROM shop_spend WHERE item_id=? ORDER BY id').all(useItem.itemId),
      priorCampaignSpends = campaignShopSpends();
    parse(await send({...pendingHalf,checksums:{before:{},after:{UserEventItem:md5([eventItem(28,120),priceAfter])}},
      deltas:[{...pendingHalf.deltas[0],putItems:{UserEventItem:[eventItem(28,120)]}},
        {...pendingHalf.deltas[0],trigger:'ShopBuy',putItems:{UserEventItem:[priceAfter]}}]},'user_data/push'));
    assert.deepEqual(campaignShopSpends(),priorCampaignSpends,'Point-use spending never becomes reusable payment because another item has a shop delta');
    assert.equal(app.store.db.prepare('SELECT amount FROM shop_spend WHERE item_id=? ORDER BY id DESC LIMIT 1').get(shopPrice.priceItemId).amount,shopPrice.price);
    assert.deepEqual(creditRow(),{...pendingCredit,spent_floor:92,owed:0,owed_floor:0});
    assert.deepEqual(app.store.read('UserCharacterPresentCharacterInfo').data,pointFirstAll,'All20 original point-first gains persist without rewrites');
    assert.equal((await send(pullValue,'user_data/pull')).status,200);
    assert.deepEqual(app.store.operations(),[],'Settling spending makes existing reward claims available, not automatic');
    // Continue the existing11100 claim checks with explicit synthetic eligibility.
    now = event.startAt;
    put('UserCharacterPresentCharacterInfo', [points(), points(other)]);
    put('UserStaminaTicket', [inventory(), inventory(other)]);
    before = snapshot();
    for (const body of [null, {}, { characterPresentCharacterInfoId: String(character.id) },
      { characterPresentCharacterInfoId: 0 }, { characterPresentCharacterInfoId: character.id + 0.5 },
      { characterPresentCharacterInfoId: Number.MAX_SAFE_INTEGER + 1 }, { characterPresentCharacterInfoId: 42 },
      { characterPresentCharacterInfoId: character.id, extra: 1 }]) {
      assert.equal((await send(body)).status, 400);
      assert.deepEqual(snapshot(), before);
    }
    for (const at of [event.startAt - 1, event.endAt]) {
      now = at;
      assert.equal((await claim()).status, 400);
      assert.deepEqual(snapshot(), before);
    }
    now = event.startAt;
    put('UserCharacterPresentCharacterInfo',[points(character,99)]); before = snapshot();
    assert.equal((await claim()).status,400,'A well-typed unearned threshold is not eligible');
    assert.deepEqual(snapshot(),before);
    for (const changes of [{ userId: 2 }, { currentPoint: -1 }, { isComplete:1 },
      { currentPoint: 100.5 }, { currentPoint: '100' }, { currentPoint: 0x80000000 }]) {
      put('UserCharacterPresentCharacterInfo', [{ ...points(), ...changes }]); before = snapshot();
      unavailable(await claim());
      assert.deepEqual(snapshot(), before);
    }
    for (const rows of [[points(),points()], [{...points(),characterPresentCharacterInfoId:42}]]) {
      put('UserCharacterPresentCharacterInfo',rows); before = snapshot();
      unavailable(await send(pullValue,'user_data/pull'));
      assert.deepEqual(snapshot(),before,'Malformed legacy progress stays retained, not repaired from the catalog');
    }
    put('UserCharacterPresentCharacterInfo', [points(), points(other)]);
    for (const changes of [{ userId: 2 }, { amount: -1 }, { amount: 0.5 }, { amount: 0x7fffffff },
      { cumulativeAmount: -1 }, { cumulativeAmount: 5.5 }, { cumulativeAmount: 999999999 },
      { cumulativeAmount: 1000000000 }, { cumulativeAmount: 0x7fffffff }]) {
      put('UserStaminaTicket', [{ ...inventory(), ...changes }]); before = snapshot();
      assert.equal((await claim()).status, 400);
      assert.deepEqual(snapshot(), before);
    }
    put('UserStaminaTicket', [inventory(), inventory(other)]);
    put('UserCharacterPresentCharacterReward', [{ userId: seed.userId, characterPresentCharacterInfoId: character.id,
      receivedAt: now - 1, isReceived: true }]); before = snapshot();
    assert.equal((await claim()).status, 400, 'An unknown legacy claim must not be granted twice');
    assert.deepEqual(snapshot(), before);
    put('UserCharacterPresentCharacterReward', []); before = snapshot();
    for (const [table, eventType] of [['profile','UPDATE'], ['operation_queue','INSERT'],
      ['character_present_claim','INSERT'], ['character_present_reward_request','INSERT'], ['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_present BEFORE ${eventType} ON ${table} BEGIN SELECT RAISE(ABORT,'present failure'); END`);
      assert.equal((await claim()).status, 503);
      assert.deepEqual(snapshot(), before, 'Receipt, queue, profile and response must commit together');
      app.store.db.exec('DROP TRIGGER fail_present');
    }
    const response = await claim(), firstSequence = sequence, result = parse(response), operation = result.operations[0];
    assert.equal(result.rewardItemId, character.rewardItemId);
    assert.equal(operation.type, 11100);
    assert.deepEqual(operation.parameters, { rewardItemId: character.rewardItemId });
    const originalCapture = app.store.db.prepare('SELECT * FROM character_present_claim WHERE character_id=?').get(character.id);
    assert.equal(originalCapture.observed_cumulative,null);
    assert.equal(originalCapture.cumulative_before,5);
    assert.equal(originalCapture.cumulative_amount,6);
    assert.equal(originalCapture.operation_json,JSON.stringify(operation));
    const claimKey = `${firstSequence}/${firstSequence}`,
      requestReceipt = app.store.db.prepare('SELECT * FROM character_present_reward_request WHERE request_key=?').get(claimKey);
    assert.deepEqual(requestReceipt,{request_key:claimKey,body_hash:md5({characterPresentCharacterInfoId:character.id}),
      character_id:character.id,operation_id:operation.id});
    for (const [name,value] of [['cumulative_before',4],['operation_json',null],['operation_json','{}']]) {
      app.store.db.prepare(`UPDATE character_present_claim SET ${name}=? WHERE character_id=?`).run(value,character.id);
      before = snapshot(); unavailable(await claim()); assert.deepEqual(snapshot(),before);
      app.store.db.prepare(`UPDATE character_present_claim SET ${name}=? WHERE character_id=?`).run(originalCapture[name],character.id);
    }
    app.store.db.prepare('UPDATE operation_queue SET token=? WHERE id=?').run('f'.repeat(32),operation.id);
    before = snapshot(); unavailable(await claim()); unavailable(await send(null,'user_data/confirm'));
    assert.deepEqual(snapshot(),before,'A changed queue cannot recapture a different native operation');
    app.store.db.prepare('UPDATE operation_queue SET token=? WHERE id=?').run(operation.token,operation.id);
    const rewardRow = { userId: seed.userId, characterPresentCharacterInfoId: character.id, receivedAt: now, isReceived: true };
    assert.deepEqual(app.store.read('UserCharacterPresentCharacterReward').data, [rewardRow]);
    assert.deepEqual(app.store.read('UserStaminaTicket').data, [inventory(), inventory(other)], 'Native operation owns the item grant');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM character_present_claim').get().n, 1);
    assert.deepEqual(parse(await claim()).operations, [operation]);
    await close(); await open();
    now = event.endAt + 100;
    const retainedReply=app.store.db.prepare('SELECT * FROM reply_cache WHERE key=?').get(claimKey);
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(claimKey);
    before=snapshot();
    assert.deepEqual((await request(port, firstSequence, { characterPresentCharacterInfoId: character.id },
      String(firstSequence), 'present/character/reward/get')).body, response.body,
    'The permanent request receipt replays the original pending handoff without the reply cache');
    assert.deepEqual(snapshot(),before);
    assert.equal((await request(port,firstSequence,{characterPresentCharacterInfoId:other.id},String(firstSequence),
      'present/character/reward/get')).status,400,'A retained request key cannot be reused for another character');
    assert.deepEqual(snapshot(),before);
    for(const [field,value] of [['body_hash','x'],['character_id',0],['operation_id',operation.id+999]]) {
      app.store.db.prepare(`UPDATE character_present_reward_request SET ${field}=? WHERE request_key=?`).run(value,claimKey);
      const corrupt=snapshot(); unavailable(await request(port,firstSequence,{characterPresentCharacterInfoId:character.id},
        String(firstSequence),'present/character/reward/get'));
      assert.deepEqual(snapshot(),corrupt,'A corrupt permanent request receipt is retained for reconciliation');
      app.store.db.prepare(`UPDATE character_present_reward_request SET ${field}=? WHERE request_key=?`)
        .run(requestReceipt[field],claimKey);
    }
    app.store.db.prepare(`INSERT INTO reply_cache(key,action,body_hash,content_type,body) VALUES(?,?,?,?,?)`)
      .run(retainedReply.key,retainedReply.action,retainedReply.body_hash,retainedReply.content_type,retainedReply.body);
    assert.deepEqual(parse(await claim()).operations, [operation], 'A pending claim remains payable after event expiry');
    before = snapshot();
    assert.equal((await push([operation])).status, 400);
    assert.deepEqual(snapshot(), before, 'Bare ACK cannot lose the item');
    for (const changes of [{ cumulativeAmount: 5 }, { cumulativeAmount:7 }, { cumulativeAmount: 1000000000 }, { userId: 2 }, { amount: -1 }]) {
      assert.equal((await push([operation], { UserStaminaTicket: [{ ...inventory(), cumulativeAmount: 6, ...changes }] })).status, 400);
      assert.deepEqual(snapshot(), before);
    }
    assert.equal((await push([operation], {}, { UserStaminaTicket: [{ staminaTicketId: character.rewardItemId }] })).status, 400);
    assert.deepEqual(snapshot(), before);
    for (const changes of [{ userId: 2 }, { isReceived: 0 }, { receivedAt: now }]) {
      assert.equal((await push([], { UserCharacterPresentCharacterReward: [{ ...rewardRow, ...changes }] })).status, 400);
      assert.deepEqual(snapshot(), before, 'Stale deltas cannot roll back the committed reward receipt');
    }
    // WaitUIState::close is not a data pull. The callback changes isReceived
    // only, so the local receipt may still carry the original zero timestamp.
    let flagSaveSequence,flagSaveBody;
    for (const changes of [{ isReceived: false }, { receivedAt: 0, isReceived: false }, { receivedAt: 0, isReceived: true }]) {
      const flag = { ...rewardRow,...changes };
      const corrected = parse(await push([], { UserCharacterPresentCharacterReward:[flag] }));
      flagSaveSequence = sequence;
      flagSaveBody = {badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserCharacterPresentCharacterReward:md5([flag])}},
        deltas:[{signature:0,trigger:'CharacterPresentUseItem',putItems:{UserCharacterPresentCharacterReward:[flag]},deleteItems:{}}],operations:[]};
      assert.deepEqual(corrected.data.UserCharacterPresentCharacterReward, [rewardRow]);
      assert.equal(corrected.dataTokens.UserCharacterPresentCharacterReward, md5([rewardRow]));
      assert.deepEqual(app.store.read('UserCharacterPresentCharacterReward').data, [rewardRow]);
      assert.deepEqual(app.store.operations(), [operation], 'Reconciling a callback flag does not ACK its item grant');
    }
    // A consumable can be spent before its next save. Cumulative acquisition is
    // the durable proof; remaining amount must not be forced to baseline + 1.
    const saved = { ...inventory(), amount: 0, cumulativeAmount: 6 };
    const rewardPull = {tables:['UserStaminaTicket','UserCharacterPresentCharacterReward'],consistentRead:true,recovery:false};
    assert.equal((await send(rewardPull,'user_data/pull')).status,200); const unearnedPull = sequence;
    parse(await send(null,'user_data/confirm')); const unearnedConfirm = sequence;
    before = snapshot();
    for (const [table,kind] of [['profile','UPDATE'],['character_present_claim','UPDATE'],['local_save_meta','UPDATE'],
      ['reply_cache','INSERT'],['runtime','UPDATE']]) {
      app.store.db.exec(`CREATE TRIGGER fail_present_observation BEFORE ${kind} ON ${table} BEGIN SELECT RAISE(ABORT,'present observation failure'); END`);
      unavailable(await push([], { UserStaminaTicket:[saved] }));
      assert.deepEqual(snapshot(),before,'Native item, acquisition observation, metadata, sequence and reply commit together');
      app.store.db.exec('DROP TRIGGER fail_present_observation');
    }
    assert.deepEqual(parse(await push([], { UserStaminaTicket:[saved] })).operations,[],'A saved11100 grant is not delivered again in the save response');
    assert.equal(app.store.db.prepare('SELECT observed_cumulative FROM character_present_claim WHERE character_id=?').get(character.id).observed_cumulative,6);
    assert.deepEqual(app.store.operations(),[operation],'Observation suppresses delivery but never drops the pending ACK');
    await close(); await open();
    before = snapshot();
    assert.deepEqual(parse(await request(port,firstSequence,{characterPresentCharacterInfoId:character.id},String(firstSequence),
      'present/character/reward/get')).operations,[],'A captured saved grant is omitted from the original cached callback');
    const cachedBody = app.store.db.prepare('SELECT body FROM reply_cache WHERE key=?').get(claimKey).body;
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?')
      .run(Buffer.from(JSON.stringify({...result,operation})).toString('base64'),claimKey);
    const singularState = snapshot(), singular = parse(await request(port,firstSequence,{characterPresentCharacterInfoId:character.id},
      String(firstSequence),'present/character/reward/get'));
    assert.deepEqual(singular.operations,[]); assert.ok(!Object.hasOwn(singular,'operation'));
    assert.deepEqual(snapshot(),singularState,'A legacy singular envelope cannot evade saved-grant suppression');
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(cachedBody,claimKey);
    unavailable(await request(port,unearnedPull,rewardPull,String(unearnedPull),'user_data/pull'));
    unavailable(await request(port,unearnedConfirm,null,String(unearnedConfirm),'user_data/confirm'));
    assert.deepEqual(parse(await request(port,flagSaveSequence,flagSaveBody,String(flagSaveSequence),'user_data/push')).operations,[],
      'Cached flag saves also omit the observed additive reward');
    assert.deepEqual(snapshot(),before,'Read-only cached recovery cannot replay a saved stamina-ticket acquisition');
    const savedState = durable();
    for (const action of ['user_data/confirm','user_data/pull','present/character/reward/get']) {
      const recovered = await send(action==='user_data/pull' ? rewardPull : action==='present/character/reward/get'
        ? {characterPresentCharacterInfoId:character.id} : null,action);
      assert.equal(recovered.status,200,recovered.body.toString());
      if (action!=='user_data/pull') assert.deepEqual(parse(recovered).operations,[]);
      assert.deepEqual(durable(),savedState,'Fresh recovery reloads the real saved item without a grant or synthetic ACK');
    }
    before = snapshot();
    for (const rows of [[inventory()], [{...saved,userId:2}], [saved,saved]]) {
      assert.equal((await push([], { UserStaminaTicket:rows })).status,400);
      assert.deepEqual(snapshot(),before);
    }
    assert.equal((await push([], {}, {UserStaminaTicket:[{staminaTicketId:character.rewardItemId}]})).status,400);
    assert.deepEqual(snapshot(),before);
    // An older pending capture may have no recorded observation column value.
    // Its actual acquired inventory still blocks additive replay; no read backfill.
    const legacyClaim = app.store.db.prepare(`SELECT character_id,operation_id,received_at,item_id,cumulative_amount
      FROM character_present_claim WHERE character_id=?`).get(character.id);
    app.store.db.exec(`DROP INDEX character_present_observation;
      ALTER TABLE character_present_claim DROP COLUMN observed_cumulative;
      ALTER TABLE character_present_claim DROP COLUMN operation_json;
      ALTER TABLE character_present_claim DROP COLUMN cumulative_before`);
    await close(); await open(); before = snapshot();
    assert.deepEqual(app.store.db.prepare(`SELECT character_id,operation_id,received_at,item_id,cumulative_amount
      FROM character_present_claim WHERE character_id=?`).get(character.id),legacyClaim,'Additive migration preserves the actual old claim fields');
    assert.deepEqual(app.store.db.prepare(`SELECT cumulative_before,operation_json,observed_cumulative
      FROM character_present_claim WHERE character_id=?`).get(character.id),
    {cumulative_before:null,operation_json:null,observed_cumulative:null},'No missing legacy operation or baseline is reconstructed');
    unavailable(await claim()); assert.deepEqual(snapshot(),before);
    assert.equal((await push([], {UserStaminaTicket:[inventory()]})).status,400);
    assert.deepEqual(snapshot(),before,'Legacy NULL observation cannot restore a known acquired pending item');
    assert.deepEqual(parse(await push([], {UserStaminaTicket:[saved]})).operations,[]);
    assert.equal(app.store.db.prepare('SELECT observed_cumulative FROM character_present_claim WHERE character_id=?').get(character.id).observed_cumulative,6);
    app.store.db.prepare('UPDATE character_present_claim SET observed_cumulative=5 WHERE character_id=?').run(character.id);
    before = snapshot();
    unavailable(await claim()); unavailable(await send(rewardPull,'user_data/pull'));
    assert.deepEqual(snapshot(),before,'An invalid acquisition capture is retained, not rewritten from current inventory');
    app.store.db.prepare('UPDATE character_present_claim SET observed_cumulative=6 WHERE character_id=?').run(character.id);
    const capturedClaim = app.store.db.prepare('SELECT * FROM character_present_claim WHERE character_id=?').get(character.id);
    app.store.db.prepare('DELETE FROM character_present_claim WHERE character_id=?').run(character.id);
    before = snapshot();
    unavailable(await request(port,firstSequence,{characterPresentCharacterInfoId:character.id},String(firstSequence),'present/character/reward/get'));
    unavailable(await send(null,'user/login'));
    assert.deepEqual(snapshot(),before,'A lost original11100 receipt cannot be recreated from a cached success');
    app.store.db.prepare(`INSERT INTO character_present_claim(character_id,operation_id,received_at,item_id,cumulative_amount,observed_cumulative)
      VALUES(?,?,?,?,?,?)`).run(capturedClaim.character_id,capturedClaim.operation_id,capturedClaim.received_at,capturedClaim.item_id,
        capturedClaim.cumulative_amount,capturedClaim.observed_cumulative);
    before = snapshot();
    app.store.db.exec("CREATE TRIGGER fail_present_ack BEFORE DELETE ON operation_queue BEGIN SELECT RAISE(ABORT,'present ACK failure'); END");
    assert.equal((await push([operation])).status, 503);
    assert.deepEqual(snapshot(), before);
    app.store.db.exec('DROP TRIGGER fail_present_ack');
    parse(await push([operation]));
    parse(await push([operation]));
    assert.deepEqual(app.store.operations(), []);
    before = snapshot();
    const settledReplay=parse(await request(port,firstSequence,{characterPresentCharacterInfoId:character.id},
      String(firstSequence),'present/character/reward/get'));
    assert.equal(settledReplay.rewardItemId,character.rewardItemId);
    assert.deepEqual(settledReplay.operations,[],'A permanent settled replay never grants or redelivers the operation');
    unavailable(await request(port,unearnedPull,rewardPull,String(unearnedPull),'user_data/pull'));
    unavailable(await request(port,unearnedConfirm,null,String(unearnedConfirm),'user_data/confirm'));
    assert.equal((await push([], {UserStaminaTicket:[inventory()]})).status,400);
    assert.equal((await push([], {}, {UserStaminaTicket:[{staminaTicketId:character.rewardItemId}]})).status,400);
    assert.deepEqual(snapshot(),before,'A completed11100 acquisition cannot be replayed or erased');
    assert.equal((await send(rewardPull,'user_data/pull')).status,200);
    parse(await send(null,'user_data/confirm'));
    app.store.db.prepare('UPDATE character_present_claim SET observed_cumulative=NULL WHERE character_id=?').run(character.id);
    await close(); await open(); before = snapshot();
    assert.equal((await push([], {UserStaminaTicket:[inventory()]})).status,400);
    assert.deepEqual(snapshot(),before,'An existing settled claim/real ACK still proves its recorded minimum after an additive schema migration');
    assert.equal(app.store.db.prepare('SELECT observed_cumulative FROM character_present_claim WHERE character_id=?').get(character.id).observed_cumulative,null,
      'Do not invent a historical first-observation counter');
    const complete = parse(await claim());
    assert.equal(complete.rewardItemId, character.rewardItemId);
    assert.deepEqual(complete.operations, []);
    put('UserCharacterPresentCharacterReward', [{ ...rewardRow, isReceived: false, receivedAt: 0 }]);
    await close(); await open();
    assert.deepEqual(parse(await claim()).operations, []);
    assert.deepEqual(app.store.read('UserCharacterPresentCharacterReward').data, [rewardRow], 'Completed receipts repair stale UI flags without another grant');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM character_present_claim').get().n, 1);
    assert.deepEqual(app.store.read('UserStaminaTicket').data.find(row => row.staminaTicketId === character.rewardItemId), saved);
    now = event.endAt - 1;
    const second = parse(await claim(other.id));
    assert.equal(second.rewardItemId, other.rewardItemId);
    assert.equal(second.operations[0].type, 11100);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM character_present_claim').get().n, 2);
    const nearCap = event.characters[2];
    put('UserCharacterPresentCharacterInfo', [...app.store.read('UserCharacterPresentCharacterInfo').data, points(nearCap)]);
    put('UserStaminaTicket', [...app.store.read('UserStaminaTicket').data,
      { ...inventory(nearCap), cumulativeAmount: 999999998 }]);
    const nearCapOperation = parse(await claim(nearCap.id)).operations.find(row => row.parameters.rewardItemId === nearCap.rewardItemId);
    assert.ok(nearCapOperation);
    parse(await push([nearCapOperation], { UserStaminaTicket: [{ ...inventory(nearCap), amount: 3, cumulativeAmount: 999999999 }] }));
    assert.equal(app.store.read('UserStaminaTicket').data.find(row => row.staminaTicketId === nearCap.rewardItemId).cumulativeAmount, 999999999);
    // Real listener producers, synthetic funding: isolate one original item,
    // not all inventory. A previous gift must finish before the11100 capture.
    const isolated = event.characters[3];
    put('UserCharacterPresentCharacterInfo',[...app.store.read('UserCharacterPresentCharacterInfo').data,points(isolated)]);
    put('UserStaminaTicket',[...app.store.read('UserStaminaTicket').data,inventory(isolated)]);
    const [gift] = app.store.createGifts([{itemId:isolated.rewardItemId,amount:1}],'Deferred isolation fixture',2,now);
    const receive = value => send({userId:seed.userId,giftIds:[value.id]},'gift/receive');
    const giftOperation = parse(await receive(gift)).operations[0];
    before = snapshot(); unavailable(await claim(isolated.id)); assert.deepEqual(snapshot(),before);
    parse(await push([giftOperation], {UserGift:giftOperation.parameters.UserGift,
      UserStaminaTicket:[{...inventory(isolated),amount:3,cumulativeAmount:6}]}));
    const isolatedResponse = await claim(isolated.id), isolatedSequence = sequence,
      isolatedOperation = parse(isolatedResponse).operations.find(row=>row.type===11100);
    assert.ok(isolatedOperation);
    const [nextGift] = app.store.createGifts([{itemId:isolated.rewardItemId,amount:1}],'Deferred next acquisition',2,now);
    before = snapshot(); unavailable(await receive(nextGift)); assert.deepEqual(snapshot(),before,'Same-item producers wait for the isolated native grant');
    // A different original item remains independently claimable.
    const [unrelatedGift] = app.store.createGifts([{itemId:event.characters[4].rewardItemId,amount:1}],'Deferred independent item',2,now);
    const unrelatedOperation = parse(await receive(unrelatedGift)).operations[0];
    parse(await push([unrelatedOperation], {UserGift:unrelatedOperation.parameters.UserGift,
      UserStaminaTicket:[{...inventory(event.characters[4]),amount:0,cumulativeAmount:1}]}));
    const exactItem = {...inventory(isolated),amount:0,cumulativeAmount:7};
    parse(await push([], {UserStaminaTicket:[exactItem]}));
    assert.equal(app.store.db.prepare('SELECT observed_cumulative FROM character_present_claim WHERE character_id=?').get(isolated.id).observed_cumulative,7);
    // A later legitimate acquisition no longer blocks on the retained ACK.
    const laterGiftOperation = parse(await receive(nextGift)).operations[0];
    parse(await push([laterGiftOperation], {UserGift:laterGiftOperation.parameters.UserGift,
      UserStaminaTicket:[{...exactItem,cumulativeAmount:8}]}));
    await close(); await open();
    assert.ok(!parse(await request(port,isolatedSequence,{characterPresentCharacterInfoId:isolated.id},String(isolatedSequence),
      'present/character/reward/get')).operations.some(row=>row.id===isolatedOperation.id),
    'The cached original callback omits the isolated grant after later acquired copies and restart');
    const rewardFlags = app.store.read('UserCharacterPresentCharacterReward').data,
      isolatedFlag = rewardFlags.find(row=>row.characterPresentCharacterInfoId===isolated.id),
      otherFlags = rewardFlags.filter(row=>row.characterPresentCharacterInfoId!==isolated.id);
    for (const flags of [otherFlags,[...otherFlags,{...isolatedFlag,userId:2}],
      [...otherFlags,{...isolatedFlag,isReceived:false}],[...otherFlags,{...isolatedFlag,receivedAt:0}],
      [...otherFlags,isolatedFlag,isolatedFlag]]) {
      put('UserCharacterPresentCharacterReward',flags); before = snapshot();
      unavailable(await send(null,'user_data/confirm')); unavailable(await send(null,'user/login'));
      assert.deepEqual(snapshot(),before,'Cold recovery cannot replace missing, foreign, duplicate or changed claim flags');
    }
    put('UserCharacterPresentCharacterReward',rewardFlags);
    const coldState = durable(), pending = app.store.operations();
    parse(await send(null,'user/login'));
    assert.deepEqual(durable(),coldState,'Cold login changes session metadata only, not reward ownership or ACK history');
    assert.deepEqual(app.store.operations(),pending,'Cold recovery retains the original operation without inventing a verifier');
    const coldConfirm = parse(await send(null,'user_data/confirm'));
    assert.ok(!coldConfirm.operations.some(row=>row.id===isolatedOperation.id));
    assert.equal((await send(rewardPull,'user_data/pull')).status,200);
    assert.ok(!parse(await claim(isolated.id)).operations.some(row=>row.id===isolatedOperation.id));
    before = snapshot();
    const isolatedReplay=parse(await request(port,isolatedSequence,{characterPresentCharacterInfoId:isolated.id},
      String(isolatedSequence),'present/character/reward/get'));
    assert.equal(isolatedReplay.rewardItemId,isolated.rewardItemId);
    assert.ok(!isolatedReplay.operations.some(row=>row.id===isolatedOperation.id),
      'The permanent transport survives cache eviction without redelivering an observed grant');
    assert.deepEqual(snapshot(),before);
    assert.deepEqual(durable(),coldState,'Later inventory and cold/cache callbacks do not grant another ticket');
    parse(await push([isolatedOperation]));
    assert.ok(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(isolatedOperation.id));
    assert.equal(app.store.read('UserStaminaTicket').data.find(row=>row.staminaTicketId===isolated.rewardItemId).cumulativeAmount,8);
    console.log('Character presents: original point costs, both split orders with once-only credit/pending-cost floors, isolated11100 save/cold resume and real ACK/cache/migration/rollback OK; native signatures, lost-half cold reconciliation and UI remain unverified');
  } finally {
    Date.now = realNow;
    await close();
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('danmemore-character-present-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
