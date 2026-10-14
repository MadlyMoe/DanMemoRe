'use strict';

// New/changed owned-stock recovery cases are WRITTEN ONLY / NOT RUN; historical cases are not current acceptance.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE, encodeMsgpack } = require('./danmemore_server.cjs');
const { request,rewardCharacterFixture,rewardCostumeFixture,rewardUnitStoryFixture } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const products = Object.values(master.shopProducts);
  assert.equal(products.length, 7528);
  assert.deepEqual(Object.fromEntries([0, 1, 2, 3, 4, 5].map(type =>
    [type, products.filter(product => product.rewardType === type).length])),
  { 0: 6515, 1: 601, 2: 346, 3: 16, 4: 16, 5: 34 });
  assert.equal(Object.keys(master.shopPacks).length, 353);
  assert.equal(Object.values(master.shopPacks).reduce((sum, pack) => sum + pack.contents.length, 0), 2577);
  assert.ok(products.every(product => [0, 1, 2].includes(product.priceType) &&
    [0, 1, 2, 3, 4, 5].includes(product.rewardType) && [0, 1, 3].includes(product.limitType) &&
    (product.priceType !== 2 || master.itemProfiles[product.priceItemId])));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-shop-'));
  let database = path.join(directory, 'profile.sqlite');
  let app, port, sequence = 0, lastLog = '', now = Math.floor(Date.now()/1000);
  const open = async () => {
    app = createServer({ database, seed, master, wallNowSeconds:()=>now, log: line => { lastLog = line; } });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const send = (value, action = 'shop/buy') => request(port, ++sequence, value, String(sequence), action);
  const parse = response => { assert.equal(response.status, 200, `${response.body} ${lastLog}`); return JSON.parse(response.body); };
  const saveBody = (operations, putItems = {}, deleteItems = {}, trigger = 'ShopBuy') => ({ badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: Object.fromEntries([...new Set([...Object.keys(putItems), ...Object.keys(deleteItems)])]
      .map(name => [name, md5(putItems[name] ?? [])])) },
    deltas: Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature: 0, trigger, putItems, deleteItems }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })) });
  const save = (...args) => send(saveBody(...args),'user_data/push');
  const snapshot = () => ({ wallet: app.store.hardCurrency(), paid: app.store.paidCurrency(), operations: app.store.operations(),
    equipmentRewards: app.store.db.prepare('SELECT * FROM equipment_reward_claim ORDER BY operation_id').all(),
    equipmentPieces: app.store.db.prepare('SELECT * FROM equipment_piece_claim ORDER BY piece_key').all(),
    costumeRewards: app.store.db.prepare('SELECT * FROM costume_reward_claim ORDER BY operation_id').all(),
    costumeFloors: app.store.db.prepare('SELECT * FROM costume_unlock_floor ORDER BY table_name,id').all(),
    receipts: app.store.db.prepare('SELECT * FROM shop_request ORDER BY operation_id').all(),
    transports: app.store.db.prepare('SELECT * FROM shop_transport ORDER BY request_key').all(),
    memoriaDelivery: app.store.db.prepare('SELECT * FROM achievement_pc_delivery ORDER BY operation_id').all(),
    memoriaTargets: app.store.db.prepare('SELECT * FROM achievement_reward_state ORDER BY operation_id').all(),
    memoriaFloors: app.store.db.prepare('SELECT * FROM achievement_memoria_floor ORDER BY memoria_id').all(),
    items: app.store.db.prepare('SELECT * FROM shop_item_claim ORDER BY operation_id,item_id').all(),
    stockFloors: app.store.db.prepare('SELECT * FROM shop_item_stock_floor ORDER BY item_id').all(),
    valisFloor: app.store.db.prepare('SELECT * FROM familia_valis_spending_floor ORDER BY user_id').all(),
    done: app.store.db.prepare('SELECT * FROM operation_done ORDER BY id').all(),
    spends: app.store.db.prepare('SELECT * FROM shop_spend ORDER BY id').all(),
    profiles: app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),
    replies: app.store.db.prepare('SELECT * FROM reply_cache ORDER BY key').all(), sequence: app.store.lastSequence() });
  const writeProfile = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows), md5(rows), name);
  const reject = async (response, status = 503, before = snapshot(), raw = false) => {
    const value = await response; assert.equal(value.status,status,value.body.toString()); assert.deepEqual(snapshot(),before);
    if (raw) assert.equal(value.body.length,0,'Injected SQLite failure is not semantic cancellation');
    else if (status === 503) assert.equal(JSON.parse(value.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const recover = async (operation,boughtItems,tables) => {
    const {replies:beforeReplies,sequence:beforeSequence,...before}=snapshot(),
      expected={...operation,parameters:{...operation.parameters,boughtItems}},
      cold=await send(undefined,'user_data/confirm'),identity=sequence;
    assert.deepEqual(parse(cold).operations,[expected]);parse(await send(undefined,'user/login'));
    const pulled=await send({tables},'user_data/pull');assert.equal(pulled.status,200);
    assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull({tables})));
    const {replies:afterReplies,sequence:afterSequence,...after}=snapshot();assert.deepEqual(after,before);
    await close();await open();
    assert.deepEqual((await request(port,identity,undefined,String(identity),'user_data/confirm')).body,cold.body);
    assert.deepEqual(app.store.operations(),[operation]);
  };
  try {
    await open(); app.store.changeHardCurrency(2000);
    let before = snapshot();
    for (const table of ['operation_queue', 'shop_request', 'shop_item_claim', 'shop_transport', 'reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_shop BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'shop rollback'); END`);
      assert.equal((await send({ shopProductId: 207000002 })).status, 503);
      assert.deepEqual(snapshot(), before);
      app.store.db.exec('DROP TRIGGER fail_shop');
    }
    for (let id = 207000002; id <= 207000007; id++) {
      const product = master.shopProducts[id], wallet = app.store.hardCurrency();
      const previous = app.store.read('UserAdventureTicket').data.find(row => row.adventureTicketId === product.rewardId);
      const response = await send({ shopProductId: id }), replaySequence = sequence;
      const bought = parse(response), operation = bought.operations[0];
      assert.deepEqual(bought.operation,operation,'Native hot shop transport consumes the same signed9000');
      if(id===207000002) {
        const receipt=app.store.db.prepare('SELECT * FROM shop_request WHERE operation_id=?').get(operation.id);
        assert.equal(receipt.operation_json,JSON.stringify(operation));
        assert.equal(receipt.reward_operation_json,null);
        const {operation:singular,...legacy}=bought;
        app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?')
          .run(Buffer.from(JSON.stringify(legacy)).toString('base64'),`${replaySequence}/${replaySequence}`);
        const retained=snapshot();
        assert.deepEqual(parse(await request(port,replaySequence,{shopProductId:id},String(replaySequence),'shop/buy')),bought);
        assert.deepEqual(snapshot(),retained,'Old plural-only envelope repair must not reissue or recharge');
      }
      assert.equal(bought.count, 1);
      assert.equal(bought.purchaseCount, undefined);
      assert.deepEqual(bought.boughtItems, [{ itemId: product.rewardId, amount: product.amount }]);
      assert.equal(app.store.hardCurrency(), wallet - product.price);
      assert.deepEqual(parse(await send({ shopProductId: id })), bought);
      const aliasSequence=sequence;
      if(id===207000002) {
        const bindings=app.store.db.prepare('SELECT * FROM shop_transport WHERE operation_id=? ORDER BY request_key').all(operation.id);
        assert.equal(bindings.length,2);
        assert(bindings.every(row => /^[0-9a-f]{32}$/.test(row.body_hash)));
        app.store.db.prepare('DELETE FROM reply_cache WHERE key IN (?,?)')
          .run(`${replaySequence}/${replaySequence}`,`${aliasSequence}/${aliasSequence}`);
        const retained=snapshot();
        for(const identity of [replaySequence,aliasSequence])
          assert.deepEqual(parse(await request(port,identity,{shopProductId:id},String(identity),'shop/buy')),bought);
        assert.deepEqual(snapshot(),retained,'Cache eviction must not reissue or charge a pending purchase');
        await reject(request(port,replaySequence,{shopProductId:id+1},String(replaySequence),'shop/buy'),400);
      }
      const purchase = { userId: seed.userId, shopProductId: id, count: bought.count,
        lastExchangedAt: bought.lastExchangedAt, readState: 1 };
      const item = { userId: seed.userId, adventureTicketId: product.rewardId, amount: 0,
        cumulativeAmount: (previous?.cumulativeAmount ?? 0) + product.amount,
        bookEntryState: 3, lastResetAt: 0, signature: operation.signature };
      before = snapshot();
      for (const rows of [{}, { UserShopProduct: [purchase] }, { UserAdventureTicket: [item] },
        { UserShopProduct: [{ ...purchase, count: 0 }], UserAdventureTicket: [item] },
        { UserShopProduct: [purchase], UserAdventureTicket: [{ ...item, userId: 2 }] },
        { UserShopProduct: [purchase], UserAdventureTicket: [{ ...item, cumulativeAmount: item.cumulativeAmount - 1 }] }]) {
        assert.equal((await save([operation], rows)).status, 400);
        assert.deepEqual(snapshot(), before, 'Bare or partial ACK cannot lose paid inventory');
      }
      parse(await save([], { UserShopProduct: [purchase], UserAdventureTicket: [item] }));
      await close(); await open();
      await reject(request(port, replaySequence, { shopProductId: id }, String(replaySequence), 'shop/buy'));
      await reject(send({ shopProductId: id }));
      before = snapshot();
      app.store.db.exec("CREATE TRIGGER fail_shop_ack BEFORE DELETE ON operation_queue BEGIN SELECT RAISE(ABORT,'ACK rollback'); END");
      assert.equal((await save([operation])).status, 503);
      assert.deepEqual(snapshot(), before);
      app.store.db.exec('DROP TRIGGER fail_shop_ack');
      parse(await save([operation])); parse(await save([operation]));
      assert.equal(app.store.hardCurrency(), wallet - product.price);
      assert.equal(app.store.operations().length, 0);
      if(id===207000002) {
        const {operation:ignoredOperation,operations:ignoredOperations,...popup}=bought,
          settled={...popup,operations:[]},retained=snapshot();
        assert.deepEqual(parse(await request(port,aliasSequence,{shopProductId:id},String(aliasSequence),'shop/buy')),settled);
        assert.deepEqual(snapshot(),retained,'Settled purchase replay cannot debit or redeliver inventory');
        const receipt=app.store.db.prepare('SELECT * FROM shop_request WHERE operation_id=?').get(operation.id);
        for(const [column,invalid] of [['operation_json','{}'],['reward_operation_json','{}']]) {
          app.store.db.prepare(`UPDATE shop_request SET ${column}=? WHERE operation_id=?`).run(invalid,operation.id);
          await reject(request(port,aliasSequence,{shopProductId:id},String(aliasSequence),'shop/buy'));
          app.store.db.prepare(`UPDATE shop_request SET ${column}=? WHERE operation_id=?`).run(receipt[column],operation.id);
        }
        app.store.db.prepare('INSERT INTO operation_queue(id,type,parameters,token,signature) VALUES(?,?,?,?,?)')
          .run(operation.id,operation.type,JSON.stringify(operation.parameters),operation.token,operation.signature);
        await reject(request(port,aliasSequence,{shopProductId:id},String(aliasSequence),'shop/buy'));
        app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(operation.id);
        app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(operation.id);
        await reject(request(port,aliasSequence,{shopProductId:id},String(aliasSequence),'shop/buy'));
        app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(operation.id);
        const restored=snapshot();
        assert.deepEqual(parse(await request(port,aliasSequence,{shopProductId:id},String(aliasSequence),'shop/buy')),settled);
        assert.deepEqual(snapshot(),restored,'Restored settled proof retains the popup-only response');
      }
      assert.equal((await save([], { UserShopProduct: [{ ...purchase, count: 0 }] })).status, 400);
      assert.equal((await save([], {}, { UserShopProduct: [{ shopProductId: id }] })).status, 400);
    }
    // Owned captures serialize same-item producers; a later original offer advances the completed source pointer.
    const single = parse(await send({ shopProductId: 207000002 }));
    await reject(send({ shopProductId: 207000003 }));
    const singleTarget=app.store.db.prepare('SELECT * FROM shop_item_claim WHERE operation_id=?').get(single.operation.id),
      singleInventory={...app.store.read('UserAdventureTicket').data.find(row=>row.adventureTicketId===298000001),
        cumulativeAmount:singleTarget.cumulative_amount,signature:single.operation.signature},
      singlePurchase={userId:seed.userId,shopProductId:single.shopProductId,count:single.count,lastExchangedAt:single.lastExchangedAt,readState:1};
    parse(await save(single.operations,{UserShopProduct:[singlePurchase],UserAdventureTicket:[singleInventory]}));
    const singleFloor=app.store.db.prepare('SELECT * FROM shop_item_stock_floor WHERE item_id=298000001').get();
    assert.equal(singleFloor.operation_id,single.operation.id);
    const bundle = parse(await send({ shopProductId: 207000003 }));
    const receipts = app.store.db.prepare('SELECT * FROM shop_request WHERE operation_id IN (?,?) ORDER BY operation_id')
      .all(single.operations[0].id, bundle.operations[0].id);
    assert.equal(receipts[1].cumulative_amount - receipts[0].cumulative_amount, 11);
    const inventory = { userId: seed.userId, adventureTicketId: 298000001, amount: 0,
      cumulativeAmount: receipts[0].cumulative_amount, bookEntryState: 3, lastResetAt: 0, signature: bundle.operation.signature };
    const purchases = [single, bundle].map(result => ({ userId: seed.userId, shopProductId: result.shopProductId,
      count: result.count, lastExchangedAt: result.lastExchangedAt, readState: 1 }));
    assert.equal((await save(bundle.operations, { UserShopProduct: purchases, UserAdventureTicket: [inventory] })).status, 400);
    for(const event of ['INSERT','UPDATE']) {
      app.store.db.exec(`CREATE TRIGGER fail_shop_floor BEFORE ${event} ON shop_item_stock_floor BEGIN SELECT RAISE(ABORT,'floor rollback'); END`);
      await reject(save(bundle.operations,{UserShopProduct:purchases,
        UserAdventureTicket:[{...inventory,cumulativeAmount:receipts[1].cumulative_amount}]}),503,snapshot(),true);
      app.store.db.exec('DROP TRIGGER fail_shop_floor');
    }
    parse(await save(bundle.operations, { UserShopProduct: purchases,
      UserAdventureTicket: [{ ...inventory, cumulativeAmount: receipts[1].cumulative_amount }] }));
    assert.equal(app.store.db.prepare('SELECT operation_id FROM shop_item_stock_floor WHERE item_id=298000001').get().operation_id,
      bundle.operation.id);
    app.store.db.prepare('UPDATE shop_item_stock_floor SET operation_id=? WHERE item_id=298000001').run(singleFloor.operation_id);
    await reject(send({tables:['UserAdventureTicket']},'user_data/pull'));
    app.store.db.prepare('UPDATE shop_item_stock_floor SET operation_id=? WHERE item_id=298000001').run(bundle.operation.id);
    await close(); await open();
    assert.equal(app.store.operations().length, 0);
    assert.equal(app.store.read('UserShopProduct').data.find(row => row.shopProductId === 207000002).count, 2);

    const exchange = master.shopProducts[207000228];
    const cost = { userId: seed.userId, statusBoardItemId: exchange.priceItemId, amount: 20,
      cumulativeAmount: 20, bookEntryState: 3, reservedAmount: 0, signature: 0 };
    writeProfile('UserStatusBoardItem', [cost]);
    const savedCost = { ...cost, amount: cost.amount - exchange.price };
    before = snapshot();
    app.store.db.exec("CREATE TRIGGER fail_shop_spend BEFORE INSERT ON shop_spend BEGIN SELECT RAISE(ABORT,'spend rollback'); END");
    assert.equal((await save([], { UserStatusBoardItem: [savedCost] }, {}, 'EventShopBuy')).status, 503);
    assert.deepEqual(snapshot(), before);
    app.store.db.exec('DROP TRIGGER fail_shop_spend');
    parse(await save([], { UserStatusBoardItem: [savedCost] }, {}, 'EventShopBuy'));
    const bought = parse(await send({ shopProductId: 207000228 })), operation = bought.operations[0];
    assert.deepEqual(bought.boughtItems, [{ itemId: exchange.rewardId, amount: exchange.amount }]);
    const receipt = app.store.db.prepare('SELECT * FROM shop_request WHERE operation_id=?').get(operation.id);
    assert.equal(receipt.reward_table, 'UserStatusBoardItem');
    assert.equal(receipt.period_key, 'lifetime');
    assert.equal(app.store.db.prepare('SELECT operation_id FROM shop_spend WHERE id=?').get(receipt.spend_id).operation_id, operation.id);
    before = snapshot();
    const exchangePurchase = { userId: seed.userId, shopProductId: 207000228, count: bought.count,
      lastExchangedAt: bought.lastExchangedAt, readState: 1 };
    assert.equal((await save([operation], { UserShopProduct: [exchangePurchase] })).status, 400);
    assert.deepEqual(snapshot(), before);
    const reward = { userId: seed.userId, statusBoardItemId: exchange.rewardId, amount: 1,
      cumulativeAmount: 1, bookEntryState: 3, reservedAmount: 0, signature: operation.signature };
    parse(await save([operation], { UserShopProduct: [exchangePurchase], UserStatusBoardItem: [savedCost, reward] }, {}, 'EventShopBuy'));
    assert.equal(app.store.operations().length, 0);
    assert.equal((await send({ shopProductId: 207000229 })).status, 400, 'Item exchanges require a saved client debit');
    await close(); await open();
    assert.equal(app.store.read('UserStatusBoardItem').data.find(row => row.statusBoardItemId === exchange.rewardId).amount, 1);

    assert.equal((await send({ shopProductId: 207000001 })).status, 400,
      'Paid-Iris packs cannot spend the free balance');
    app.store.changePaidCurrency(2000);
    let paidBalance = app.store.paidCurrency();
    const pack = parse(await send({ shopProductId: 207000001 })), packOperation = pack.operations[0];
    assert.equal(app.store.paidCurrency(), paidBalance - master.shopProducts[207000001].price);
    assert.deepEqual(pack.boughtItems, [{ itemId: 296000008, amount: 1 }, { itemId: 297000005, amount: 1 }]);
    assert.deepEqual({ ...app.store.db.prepare('SELECT price_type,price_amount FROM shop_request WHERE operation_id=?')
      .get(packOperation.id) }, { price_type: 1, price_amount: master.shopProducts[207000001].price });
    const packPurchase = { userId: seed.userId, shopProductId: 207000001, count: pack.count,
      lastExchangedAt: pack.lastExchangedAt, readState: 1 };
    const gachaTicket = { userId: seed.userId, gachaTicketId: 296000008, bookEntryState: 3,
      cumulativeAmount: 1, signature:packOperation.signature, dateList: [{ aquiredAt: pack.lastExchangedAt }] };
    const pcTicket = { userId: seed.userId, pcTicketId: 297000005, dateList:[{aquiredAt:pack.lastExchangedAt}], cumulativeAmount: 1,
      bookEntryState: 3, signature: packOperation.signature };
    for (const dateList of [null,[{ aquiredAt:-1 }],[{ aquiredAt:'not-a-date' }]])
      await reject(save([packOperation], { UserShopProduct:[packPurchase],UserGachaTicket:[{ ...gachaTicket,dateList }],
        UserPCTicket:[pcTicket] }, {}, 'GemShopPackBuy'),400);
    parse(await save([packOperation], { UserShopProduct: [packPurchase], UserGachaTicket: [gachaTicket],
      UserPCTicket: [pcTicket] }, {}, 'GemShopPackBuy'));
    assert.equal((await send({ shopProductId: 207000001 })).status, 400, 'Lifetime pack limit is durable');

    paidBalance = app.store.paidCurrency();
    const costumePack = parse(await send({ shopProductId: 207003535 })), costumeOperation = costumePack.operations[0];
    assert.equal(app.store.paidCurrency(), paidBalance - master.shopProducts[207003535].price);
    assert.deepEqual(costumePack.boughtCostumes, [1021002030]);
    assert.deepEqual(costumePack.boughtItems, [{ itemId: 296000014, amount: 2 }]);
    const costumePurchase = { userId: seed.userId, shopProductId: 207003535, count: costumePack.count,
      lastExchangedAt: costumePack.lastExchangedAt, readState: 1 };
    parse(await save([costumeOperation], { UserShopProduct: [costumePurchase],
      UserCharacterCostume: [{ userId: seed.userId, costumeId: 1021002030, costumeState: 2 }],
      UserCommunicationVoice: Object.entries(master.communicationVoices).filter(([,voice]) => voice.costumeId === 1021002030)
        .map(([id]) => ({ userId: 0, voiceId: Number(id), voiceState: 2 })),
      UserGachaTicket: [{ userId: seed.userId, gachaTicketId: 296000014, bookEntryState: 3,
        cumulativeAmount: 2, signature:costumeOperation.signature, dateList: [{ aquiredAt: costumePack.lastExchangedAt },
          { aquiredAt: costumePack.lastExchangedAt }] }] }, {}, 'GemShopPackBuy'));

    const pcProduct = master.shopProducts[207000023], twoPcTickets = { ...pcTicket,
      dateList:[{aquiredAt:now},{aquiredAt:now}],cumulativeAmount:2 };
    writeProfile('UserPCTicket', [twoPcTickets]);
    parse(await save([], { UserPCTicket: [{ ...twoPcTickets, dateList:[{aquiredAt:now}] }] }, {}, 'TicketShopBuy'));
    const pcBuy = parse(await send({ shopProductId: 207000023 }));
    assert.deepEqual(pcBuy.operations.map(row => row.type), [1000, 9000]);
    assert.deepEqual(pcBuy.operation,{ ...pcBuy.operations[1],operations:[pcBuy.operations[0]] },
      'Mixed hot adapter must queue the signed unit before9000 and retain9000 callback parameters');
    const pcIdentity = sequence;
    const { operation: pcHot, ...oldPcReply } = pcBuy;
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?')
      .run(Buffer.from(JSON.stringify(oldPcReply)).toString('base64'),`${pcIdentity}/${pcIdentity}`);
    const pcRetained = snapshot();
    assert.deepEqual(parse(await request(port,pcIdentity,{shopProductId:207000023},String(pcIdentity),'shop/buy')),pcBuy);
    assert.deepEqual(snapshot(),pcRetained,'Mixed cache repair must not mint operations, recharge or alter receipts');
    assert.deepEqual(parse(await send({shopProductId:207000023})),pcBuy);
    assert.deepEqual(pcBuy.operations[0].parameters.lotteryPCs, [{ pcId: pcProduct.rewardId, isFirst: true }]);
    assert.deepEqual(pcBuy.boughtItems, []);
    const pcReceipt=app.store.db.prepare('SELECT * FROM shop_request WHERE operation_id=?').get(pcBuy.operations[1].id);
    assert.equal(pcReceipt.operation_json,JSON.stringify(pcBuy.operations[1]));
    assert.equal(pcReceipt.reward_operation_json,JSON.stringify(pcBuy.operations[0]));
    const pcPurchase = { userId: seed.userId, shopProductId: 207000023, count: pcBuy.count,
      lastExchangedAt: pcBuy.lastExchangedAt, readState: 1 };
    const pc = { ...pcBuy.operations[0].parameters.UserPC[0], joiningState: 1 };
    // DEFERRED: a saved9000 count/date must not block the untouched paired1000 on cold confirmation.
    parse(await save([], { UserShopProduct: [pcPurchase] }, {}, 'TicketShopBuy'));
    const pcPending = app.store.operations();
    assert.deepEqual(pcPending,pcBuy.operations);
    assert.deepEqual(parse(await send(undefined,'user_data/confirm')).operations,pcPending);
    assert.deepEqual(app.store.operations(),pcPending,'Cold confirmation does not invent a unit ACK');
    before = snapshot();
    assert.equal((await save(pcBuy.operations, { UserShopProduct: [pcPurchase] })).status, 400);
    assert.deepEqual(snapshot(), before, 'A shop unit cannot be acknowledged before its initialized save');
    parse(await save(pcBuy.operations, { UserShopProduct: [pcPurchase], UserPC: [pc],
      UserPCJobSet:[{ userId:seed.userId,pcId:pc.pcId,pcJobs:[] }],
      UserCharacter:rewardCharacterFixture(app.store.read('UserCharacter').data,[pc.pcId]),
      ...rewardCostumeFixture(app.store.read('UserCharacterCostume').data,[pc.pcId],app.store.read('UserCommunicationVoice').data),
      ...rewardUnitStoryFixture(app.store.read('UserAdventureStage').data,[pc.pcId]) }, {}, 'TicketShopBuy'));
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`${pcIdentity}/${pcIdentity}`);
    const {operation:ignoredPcOperation,operations:ignoredPcOperations,...pcPopup}=pcBuy,
      pcSettled={...pcPopup,operations:[]},pcSettledState=snapshot();
    assert.deepEqual(parse(await request(port,pcIdentity,{shopProductId:207000023},String(pcIdentity),'shop/buy')),pcSettled);
    assert.deepEqual(snapshot(),pcSettledState,'Settled unit purchase cannot redeliver the unit or recharge its ticket');
    app.store.db.prepare('UPDATE shop_request SET reward_operation_json=? WHERE operation_id=?').run('{}',pcBuy.operations[1].id);
    await reject(request(port,pcIdentity,{shopProductId:207000023},String(pcIdentity),'shop/buy'));
    app.store.db.prepare('UPDATE shop_request SET reward_operation_json=? WHERE operation_id=?')
      .run(pcReceipt.reward_operation_json,pcBuy.operations[1].id);
    app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(pcBuy.operations[0].id);
    await reject(request(port,pcIdentity,{shopProductId:207000023},String(pcIdentity),'shop/buy'));
    app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(pcBuy.operations[0].id);
    app.store.db.prepare('INSERT INTO operation_queue(id,type,parameters,token,signature) VALUES(?,?,?,?,?)')
      .run(pcBuy.operations[0].id,pcBuy.operations[0].type,JSON.stringify(pcBuy.operations[0].parameters),
        pcBuy.operations[0].token,pcBuy.operations[0].signature);
    await reject(request(port,pcIdentity,{shopProductId:207000023},String(pcIdentity),'shop/buy'));
    app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(pcBuy.operations[0].id);

    parse(await save([], { UserPCTicket: [{ ...twoPcTickets, dateList:[] }] }, {}, 'TicketShopBuy'));
    const duplicatePcBuy = parse(await send({ shopProductId: 207000023 }));
    assert.deepEqual(duplicatePcBuy.operations.map(row => row.type), [1000, 9000]);
    assert.deepEqual(duplicatePcBuy.operation,{ ...duplicatePcBuy.operations[1],operations:[duplicatePcBuy.operations[0]] },
      'Duplicate units use the same signed bond prefix without rewriting9000');
    assert.deepEqual(duplicatePcBuy.operations[0].parameters.lotteryPCs, [{ pcId: pcProduct.rewardId, isFirst: false }]);
    const bond = {...duplicatePcBuy.operations[0].parameters.UserLimitBreakItem[0],signature:duplicatePcBuy.operations[0].signature};
    const duplicatePurchase = { ...pcPurchase, count: 2, lastExchangedAt: duplicatePcBuy.lastExchangedAt };
    parse(await save(duplicatePcBuy.operations, { UserShopProduct: [duplicatePurchase], UserLimitBreakItem: [bond] }, {}, 'TicketShopBuy'));

    const memoriaProduct = master.shopProducts[207005478], memoriaProfile = master.itemProfiles[memoriaProduct.priceItemId];
    const memoriaCost = { userId: seed.userId, [memoriaProfile.idField]: memoriaProduct.priceItemId,
      amount: memoriaProduct.price, cumulativeAmount: memoriaProduct.price, bookEntryState: 3,
      lastResetAt: 0, signature: 0 };
    writeProfile(memoriaProfile.table, [memoriaCost]);
    parse(await save([], { [memoriaProfile.table]: [{ ...memoriaCost, amount: 0 }] }, {}, 'EventShopBuy'));
    const memoriaBuy = parse(await send({ shopProductId: 207005478 }));
    assert.deepEqual(memoriaBuy.operations.map(row => row.type), [6000, 9000]);
    assert.deepEqual(memoriaBuy.operation,{ ...memoriaBuy.operations[1],operations:[memoriaBuy.operations[0]] },
      'Mixed hot adapter must queue the signed card before9000');
    assert.deepEqual(memoriaBuy.operations[0].parameters.receivedMemorias,
      [{ memoriaId: memoriaProduct.rewardId, level: 1 }]);
    const memoriaPurchase = { userId: seed.userId, shopProductId: 207005478, count: memoriaBuy.count,
      lastExchangedAt: memoriaBuy.lastExchangedAt, readState: 1 };
    const memoria = { userId: seed.userId, memoriaId: memoriaProduct.rewardId,
      totalExp: master.memoriaLevels[memoriaProduct.rewardId][0], signature: 0 };
    parse(await save(memoriaBuy.operations, { UserShopProduct: [memoriaPurchase], UserMemoria: [memoria] }, {}, 'EventShopBuy'));

    const equipmentExchange = master.shopProducts[207000143];
    const key = { userId: seed.userId, keyItemId: equipmentExchange.priceItemId, amount: 1,
      cumulativeAmount: 1, bookEntryState: 3, reservedAmount: 0, signature: 0, exploit: false };
    writeProfile('UserKeyItem', [key]);
    parse(await save([], { UserKeyItem: [{ ...key, amount: 0 }] }, {}, 'TicketShopBuy'));
    const equipment = parse(await send({ shopProductId: 207000143 })), equipmentOperation = equipment.operations[0];
    assert.deepEqual(equipment.boughtEquipments, [{ equipmentId: equipmentExchange.rewardId, amount: 1 }]);
    assert.deepEqual(equipment.boughtCostumes, []);
    const equipmentPurchase = { userId: seed.userId, shopProductId: 207000143, count: equipment.count,
      lastExchangedAt: equipment.lastExchangedAt, readState: 1 };
    parse(await save([equipmentOperation], { UserShopProduct: [equipmentPurchase],
      UserEquipment: [{ userId: seed.userId, equipmentId: equipmentExchange.rewardId,
        slotIndex: master.equipments[equipmentExchange.rewardId].type === 1 ? 1 : 10001, createAt: equipment.lastExchangedAt,
        exp: 0, rarity: 0,
        performance: master.equipments[equipmentExchange.rewardId].performance,
        durability: master.equipments[equipmentExchange.rewardId].durability, reservedDurability: master.equipments[equipmentExchange.rewardId].durability,
        ...Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`abilityId${i + 1}`, master.equipments[equipmentExchange.rewardId][`abilityId${i + 1}`]])),
        ...Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`lockedAbility${i + 1}`, false])),
        isProtected: false, isUnbreakable: false }] }, {}, 'TicketShopBuy'));
    await close(); await open();
    assert.equal(app.store.operations().length, 0);
    assert.equal(app.store.read('UserPCTicket').data[0].pcTicketId, 297000005);
    assert.equal(app.store.read('UserCharacterCostume').data.find(row => row.costumeId === 1021002030).costumeState, 2);
    assert.equal(app.store.read('UserEquipment').data[0].equipmentId, equipmentExchange.rewardId);
    const equipmentPack = parse(await send({ shopProductId: 207004301 }));
    assert.deepEqual(equipmentPack.boughtEquipments,
      [{ equipmentId: 24000006300, amount: 1 }, { equipmentId: 24000012090, amount: 1 }]);

    // Count/date/item can each be a separate collection save. Both orders
    // suppress only delivery; none may complete the mixed9000 acknowledgement.
    for (const kind of ['count','date','item']) for (const reverse of [false,true]) {
      await close(); database = path.join(directory, `split-${kind}-${reverse}.sqlite`); await open();
      app.store.changeHardCurrency(100); writeProfile('UserShopProduct',[]); writeProfile('UserAdventureTicket',[]);
      const body = { shopProductId:207000002 }, pulled = { tables:['UserShopProduct','UserAdventureTicket'] };
      assert.equal((await send(pulled,'user_data/pull')).status,200); const pullIdentity = sequence;
      const initial = await send(body), identity = sequence, purchase = parse(initial), op = purchase.operations[0];
      const target = app.store.db.prepare('SELECT * FROM shop_item_claim WHERE operation_id=?').get(op.id);
      const row = { userId:seed.userId,shopProductId:body.shopProductId,count:purchase.count,
        lastExchangedAt:purchase.lastExchangedAt,readState:1 };
      const item = { userId:seed.userId,adventureTicketId:target.item_id,amount:0,cumulativeAmount:target.cumulative_amount,
        bookEntryState:3,lastResetAt:0,signature:op.signature };
      const only = kind === 'item' ? { UserAdventureTicket:[item] } :
        { UserShopProduct:[{ ...row,...(kind === 'count' ? { lastExchangedAt:0 } : { count:0 }) }] };
      const rest = kind === 'item' ? { UserShopProduct:[row] } :
        { UserShopProduct:[{ ...row,...(kind === 'count' ? { count:0 } : { lastExchangedAt:0 }) }],UserAdventureTicket:[item] };
      const first = reverse ? rest : only;
      const receipt = app.store.db.prepare('SELECT * FROM shop_request WHERE operation_id=?').get(op.id);
      assert.deepEqual(JSON.parse(receipt.operation_json),op); assert.equal(receipt.before_shop,'null');
      assert.deepEqual(JSON.parse(receipt.observed),[]);
      await reject(save([op],first),400);
      for (const [table,event] of [['shop_request','UPDATE'],['profile','UPDATE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_shop_partial BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'split rollback'); END`);
        await reject(save([],first),503,snapshot(),true); app.store.db.exec('DROP TRIGGER fail_shop_partial');
      }
      const partial = parse(await save([],first)); assert.deepEqual(partial.operations,[]); assert.equal(partial.operation,undefined);
      assert.deepEqual(app.store.operations(),[op]);
      const keys = JSON.parse(app.store.db.prepare('SELECT observed FROM shop_request WHERE operation_id=?').get(op.id).observed);
      assert.deepEqual(keys, (reverse ? ['count','date',`i:${target.item_id}`].filter(key => key !==
        (kind === 'item' ? `i:${target.item_id}` : kind)) : [kind === 'item' ? `i:${target.item_id}` : kind]).sort());
      await close(); await open();
      await reject(send(body)); await reject(request(port,identity,body,String(identity),'shop/buy'));
      for (const action of ['user/login','user_data/confirm']) await reject(send(undefined,action));
      await reject(send(pulled,'user_data/pull')); await reject(save([op]),400);
      if (keys.includes('count') || keys.includes('date')) await reject(save([],{}, { UserShopProduct:[{ shopProductId:body.shopProductId }] }),400);
      if (keys.includes(`i:${target.item_id}`)) {
        await reject(save([],{}, { UserAdventureTicket:[{ adventureTicketId:target.item_id }] }),400);
        await reject(save([], { UserAdventureTicket:[{ ...item,cumulativeAmount:0 }] }),400);
      }
      // Preserve a saved half while writing the remaining fields; no rewind.
      parse(await save([], { UserShopProduct:[row],UserAdventureTicket:[item] }));
      for (const [table,event] of [['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_shop_complete BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'complete rollback'); END`);
        await reject(save([op]),503,snapshot(),true); app.store.db.exec('DROP TRIGGER fail_shop_complete');
      }
      parse(await save([op])); parse(await save([op]));
      assert.equal(app.store.hardCurrency(),100-master.shopProducts[body.shopProductId].price); assert.deepEqual(app.store.operations(),[]);
      await reject(request(port,identity,body,String(identity),'shop/buy'));
      await reject(request(port,pullIdentity,pulled,String(pullIdentity),'user_data/pull'));
      await reject(save([], { UserAdventureTicket:[{ ...item,cumulativeAmount:0 }] }),400);
      await reject(save([],{}, { UserAdventureTicket:[{ adventureTicketId:target.item_id }] }),400);
      await reject(save([], { UserShopProduct:[{ ...row,count:0 }] }),400);
    }

    // WRITTEN ONLY / NOT RUN: all67 alarm-voice/542 personal-bond/32 ordinary general-bond offers retain authored prices/windows/limits.
    assert.equal(Object.values(master.shopProducts).filter(product=>product.rewardType===0 && product.rewardId===217000001).length,67);
    assert.equal(Object.values(master.shopProducts).filter(product=>product.rewardType===0 && master.itemProfiles[product.rewardId]?.table==='UserLimitBreakItem').length,542);
    assert.equal(Object.values(master.shopProducts).filter(product=>product.rewardType===0 && master.itemProfiles[product.rewardId]?.table==='UserGeneralLimitBreakItem' &&
      master.itemProfiles[product.priceItemId]?.table!=='UserSubscriptionTicket').length,32);
    for(const productId of [207000047,207000258,207000041,207001358,207005147,207000927,
      207000933,207000932,207000931,207000930,207000929,207000928,207004052,207004053,207001787,207001786,
      207000002,207000003,207000004,207000005,207000006,207000007,207000035,207000036,207000037,
      ...Object.entries(master.shopProducts).filter(([,product])=>product.rewardType===0 &&
        (product.rewardId===217000001 || master.itemProfiles[product.rewardId]?.table==='UserLimitBreakItem' ||
          master.itemProfiles[product.rewardId]?.table==='UserGeneralLimitBreakItem' && master.itemProfiles[product.priceItemId]?.table!=='UserSubscriptionTicket')).map(([id])=>Number(id))])
      for(const order of ['stock-first','counts-first','reward-first','signature-first','spent-before-save']) {
        const product=master.shopProducts[productId],{table,idField}=master.itemProfiles[product.rewardId],
          priceProfile=master.itemProfiles[product.priceItemId],priceTable=priceProfile?.table;
        assert.equal(product.rewardType,0);assert.ok(product.priceType===0 || ['UserEventItem','UserKeyItem','UserCurrency'].includes(priceTable));
        assert.ok(!product.limit || product.limit>=1);now=Math.max(1,product.startAt);
        await close();database=path.join(directory,`capped-${productId}-${order}.sqlite`);await open();
        const baseline={userId:seed.userId,[idField]:product.rewardId,amount:order==='stock-first'?0:order==='signature-first'?999999999:7,
          cumulativeAmount:order==='stock-first'?999999998:order==='counts-first'?999999999-product.amount:999999999,
          signature:order==='signature-first'?0xffffffff:0x7fffffff,bookEntryState:['UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial','UserAlarmVoiceItem','UserLimitBreakItem','UserGeneralLimitBreakItem'].includes(table)?255:1,
          ...(['UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial','UserKeyItem','UserStaminaTicket','UserEquipmentEnhanceItem','UserEquipmentEvolveItem','UserHeroSublimateItem','UserHeroSublimateUnlockItem','UserAlarmVoiceItem'].includes(table)?{reservedAmount:0}:{}),
          ...(table==='UserKeyItem'?{exploit:false}:{}),...(table==='UserAdventureTicket'?{lastResetAt:0}:{})},
          cost=priceProfile?{userId:seed.userId,[priceProfile.idField]:product.priceItemId,amount:product.price*3,cumulativeAmount:product.price*3,
            signature:0,bookEntryState:1,...(priceTable==='UserKeyItem'?{reservedAmount:0,exploit:false}:
              ['UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial','UserCurrency'].includes(priceTable)?{reservedAmount:0}:{})}:null,
          savedCost=cost?{...cost,amount:cost.amount-product.price}:null,body={shopProductId:productId};
        writeProfile(table,[baseline]);writeProfile('UserShopProduct',[]);
        if(cost) {
          writeProfile(priceTable,[cost]);parse(await save([],{[priceTable]:[savedCost]}, {},'EventShopBuy'));
        } else app.store.changeHardCurrency(product.price*3);
        const wallet=app.store.hardCurrency();
        for(const receiptTable of ['operation_queue','shop_item_claim','shop_request','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER capped_shop_issue_fail BEFORE INSERT ON ${receiptTable} BEGIN SELECT RAISE(ABORT,'cap issue rollback'); END`);
          await reject(send(body),503,snapshot(),true);app.store.db.exec('DROP TRIGGER capped_shop_issue_fail');
        }
        const randomInt=crypto.randomInt;let initial;
        try {crypto.randomInt=()=>baseline.signature===0xffffffff?1:baseline.signature;initial=await send(body);}
        finally {crypto.randomInt=randomInt;}
        const identity=sequence,bought=parse(initial),op=bought.operation,
          target=app.store.db.prepare('SELECT * FROM shop_item_claim WHERE operation_id=?').get(op.id),capture=JSON.parse(target.stock_state),
          row={userId:seed.userId,shopProductId:productId,count:bought.count,lastExchangedAt:bought.lastExchangedAt,readState:1},
          acquired={...baseline,amount:Math.min(999999999,baseline.amount+product.amount),cumulativeAmount:999999999,signature:op.signature},
          finalItem=order==='counts-first'?acquired:{...acquired,amount:0};
        assert.equal(op.signature,1);assert.equal(target.cap_version,1);assert.equal(target.valis_state,null);
        assert.equal(target.valis_seen,0);assert.equal(target.amount,product.amount);assert.equal(target.cumulative_amount,999999999);
        assert.deepEqual(capture,{policy:'offline-shop-stock-cap-v1',beforeCumulative:baseline.cumulativeAmount,beforeAmount:baseline.amount,
          amount:acquired.amount,beforeSignature:baseline.signature,signature:op.signature,amountAdded:0,observed:false,effect:false});
        assert.deepEqual(app.store.read(table).data,[baseline],'No native shop reward precredit');
        assert.equal(app.store.hardCurrency(),wallet-(cost?0:product.price));
        assert.deepEqual(bought.boughtItems,[{itemId:product.rewardId,amount:product.amount}]);
        assert.deepEqual(parse(await send(body)).operation,op,'A wholly unapplied shop reward retries exactly');
        for(const changes of [{cap_version:0},{stock_state:null},{stock_state:'{'},
          {stock_state:JSON.stringify({...capture,beforeSignature:op.signature})},
          {stock_state:JSON.stringify({...capture,amountAdded:capture.amount-capture.beforeAmount+1,effect:true})},
          {stock_state:JSON.stringify({...capture,observed:true})},{valis_state:'{}'},{valis_seen:1}]) {
          app.store.db.prepare(`UPDATE shop_item_claim SET ${Object.keys(changes).map(field=>`${field}=?`).join(',')} WHERE operation_id=?`)
            .run(...Object.values(changes),op.id);await reject(send(body));
          app.store.db.prepare('UPDATE shop_item_claim SET cap_version=1,stock_state=?,valis_state=NULL,valis_seen=0 WHERE operation_id=?')
            .run(target.stock_state,op.id);
        }
        await reject(save([op],{UserShopProduct:[row],[table]:[{...acquired,signature:baseline.signature}]}),400);
        if(['UserEquipmentEnhanceItem','UserEquipmentEvolveItem','UserHeroSublimateItem','UserHeroSublimateUnlockItem'].includes(table))
          for(const changes of [{reservedAmount:-1},{bookEntryState:-1},{bookEntryState:256},{signature:0x100000000},
            {lastResetAt:0},{[table==='UserEquipmentEnhanceItem'?'equipmentEnhanceItemId':
              table==='UserEquipmentEvolveItem'?'equipmentEvolveItemId':table==='UserHeroSublimateItem'?'heroSublimateUnlockItemId':'heroSublimateItemId']:product.rewardId}])
            await reject(save([op],{UserShopProduct:[row],[table]:[{...acquired,...changes}]}),400);
        if(table==='UserAdventureTicket') {
          const missing=structuredClone(acquired);delete missing.lastResetAt;
          for(const invalid of [missing,...[{lastResetAt:-1},{lastResetAt:'0'},{reservedAmount:0},{dateList:[]},
            {bookEntryState:-1},{bookEntryState:256},{signature:0x100000000},{heroSublimateItemId:product.rewardId}]
            .map(changes=>({...acquired,...changes}))])
            await reject(save([op],{UserShopProduct:[row],[table]:[invalid]}),400);
        }
        if(table==='UserAlarmVoiceItem') {
          const missing=structuredClone(acquired);delete missing.reservedAmount;
          for(const invalid of [missing,...[{reservedAmount:-1},{reservedAmount:'0'},{bookEntryState:-1},
            {bookEntryState:256},{signature:0x100000000},{signature:'1'},{lastResetAt:0},{lastAquiredAt:0},
            {dateList:[]},{voiceId:product.rewardId}].map(changes=>({...acquired,...changes}))])
            await reject(save([op],{UserShopProduct:[row],[table]:[invalid]}),400);
        }
        if(['UserLimitBreakItem','UserGeneralLimitBreakItem'].includes(table)) {
          const missing=structuredClone(acquired);delete missing.signature;
          for(const invalid of [missing,...[{bookEntryState:-1},{bookEntryState:256},{signature:'1'},
            {signature:0x100000000},{reservedAmount:0},{lastResetAt:0},{lastAquiredAt:0},{dateList:[]},
            {generalLimitBreakItemId:product.rewardId}].map(changes=>({...acquired,...changes}))])
            await reject(save([op],{UserShopProduct:[row],[table]:[invalid]}),400);
        }
        if(['UserEquipmentEnhanceItem','UserEquipmentEvolveItem','UserHeroSublimateItem','UserHeroSublimateUnlockItem'].includes(table)) {
          app.store.db.prepare('UPDATE shop_item_claim SET id_field=? WHERE operation_id=?')
            .run(table==='UserEquipmentEnhanceItem'?'equipmentEnhanceItemId':
              table==='UserEquipmentEvolveItem'?'equipmentEvolveItemId':table==='UserHeroSublimateItem'?'heroSublimateUnlockItemId':'heroSublimateItemId',op.id);
          await reject(send(body));
          app.store.db.prepare('UPDATE shop_item_claim SET id_field=? WHERE operation_id=?').run(target.id_field,op.id);
        }
        const partial=order==='stock-first'?{[table]:[{...baseline,amount:product.amount}]}:
          order==='counts-first'?{UserShopProduct:[row]}:{[table]:[order==='spent-before-save'?finalItem:acquired]};
        await reject(save([op],partial),400);
        for(const [receiptTable,event] of [['profile','UPDATE'],[order==='counts-first'?'shop_request':'shop_item_claim','UPDATE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER capped_shop_save_fail BEFORE ${event} ON ${receiptTable} BEGIN SELECT RAISE(ABORT,'cap save rollback'); END`);
          await reject(save([],partial),503,snapshot(),true);app.store.db.exec('DROP TRIGGER capped_shop_save_fail');
        }
        parse(await save([],partial));assert.deepEqual(app.store.operations(),[op]);
        const observed=JSON.parse(app.store.db.prepare('SELECT stock_state FROM shop_item_claim WHERE operation_id=?').get(op.id).stock_state);
        assert.equal(observed.observed,!['stock-first','counts-first'].includes(order));
        assert.equal(observed.amountAdded,order==='counts-first'||order==='signature-first'||order==='spent-before-save'?0:product.amount);
        if(order!=='counts-first') {
          const spent=order==='stock-first'?{...baseline,amount:0}:finalItem;
          parse(await save([],{[table]:[spent]}));await reject(save([],{[table]:[{...spent,amount:1}]}),400,
            snapshot());
        }
        await close();await open();await reject(send(body));await reject(request(port,identity,body,String(identity),'shop/buy'));
        if(order==='stock-first') {
          for(const action of ['user/login','user_data/confirm']) await reject(send(undefined,action));
          await reject(send({tables:[table,'UserShopProduct']},'user_data/pull'));
        } else await recover(op,observed.observed?[]:op.parameters.boughtItems,[table,'UserShopProduct']);
        await reject(save([op]),400);
        const final={UserShopProduct:[row],[table]:[finalItem]};
        for(const [receiptTable,event] of [['shop_item_claim','UPDATE'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          if(!['counts-first','stock-first'].includes(order) && receiptTable==='shop_item_claim') continue;
          app.store.db.exec(`CREATE TRIGGER capped_shop_ack_fail BEFORE ${event} ON ${receiptTable} BEGIN SELECT RAISE(ABORT,'cap ACK rollback'); END`);
          await reject(save([op],final),503,snapshot(),true);app.store.db.exec('DROP TRIGGER capped_shop_ack_fail');
        }
        const finalWire=saveBody([op],final),ack=await send(finalWire,'user_data/push'),ackIdentity=sequence;parse(ack);await close();await open();
        assert.deepEqual(app.store.operations(),[]);assert.equal(JSON.parse(app.store.db.prepare('SELECT stock_state FROM shop_item_claim WHERE operation_id=?').get(op.id).stock_state).observed,true);
        const retained=snapshot();await reject(request(port,identity,body,String(identity),'shop/buy'));
        assert.deepEqual((await request(port,ackIdentity,finalWire,String(ackIdentity),'user_data/push')).body,ack.body);
        assert.deepEqual(snapshot(),retained,'Exact acknowledged reply cannot reapply native rewards');
        const spent={...finalItem,amount:0};parse(await save([],{[table]:[spent]}));
        await reject(save([],{[table]:[{...spent,amount:1}]}),400);await reject(save([],{[table]:[{...spent,cumulativeAmount:999999998}]}),400);
        if(product.limit===1) {
          await reject(send(body),400);
          assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM shop_item_claim').get().n,1);
          assert.equal(app.store.read(priceTable).data.find(row=>row[priceProfile.idField]===product.priceItemId).amount,cost.amount-product.price,
            'Exhausting an authored one-purchase limit cannot charge or reward twice');
          continue;
        }
        if(cost) {
          const nextCost={...savedCost,amount:savedCost.amount-product.price};
          parse(await save([],{[priceTable]:[nextCost]}, {},'EventShopBuy'));
        }
        const next=parse(await send(body)),nextOp=next.operation;
        assert.equal(next.count,2);assert.notEqual(nextOp.signature,op.signature);
        parse(await save([nextOp],{UserShopProduct:[{...row,count:next.count,lastExchangedAt:next.lastExchangedAt}],
          [table]:[{...spent,amount:product.amount,signature:nextOp.signature}]}));
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM shop_item_claim').get().n,2);
        if(cost) assert.equal(app.store.read(priceTable).data[0].amount,cost.amount-2*product.price);
        else assert.equal(app.store.hardCurrency(),wallet-2*product.price,'Partial saves/cold retries/exact ACK never charge Iris twice');
      }

    // WRITTEN ONLY / NOT RUN: seven enhancement packs/four Hero quantities plus all94 original paid general-bond packs.
    const generalBondPacks=Object.entries(master.shopProducts).filter(([,product])=>product.rewardType===2 &&
      master.shopPacks[product.rewardId].contents.some(item=>master.itemProfiles[item.rewardId]?.table==='UserGeneralLimitBreakItem'));
    assert.equal(generalBondPacks.length,94);
    for(const [productId,kind] of [
      ...[207003422,207003423,207003821,207004042,207004043,207004304,207004305,
        207003692,207001764,207001765,207001768].map(id=>[id,null]),
      ...generalBondPacks.map(([id])=>[Number(id),'UserGeneralLimitBreakItem'])])
      for(const order of ['stock-first','counts-first','spent-before-save']) {
        const product=master.shopProducts[productId],contents=master.shopPacks[product.rewardId].contents,
          grant=contents.find(item=>kind?master.itemProfiles[item.rewardId]?.table===kind:
            ['UserEquipmentEnhanceItem','UserHeroSublimateItem'].includes(master.itemProfiles[item.rewardId]?.table)),
          id=grant.rewardId,quantity=grant.amount*product.amount,{table,idField}=master.itemProfiles[id],body={shopProductId:productId};
        assert.equal(product.priceType,1);assert.equal(product.rewardType,2);assert.ok(contents.every(item=>item.type===0));
        if(table==='UserEquipmentEnhanceItem') assert.equal(quantity,100);
        else if(table==='UserGeneralLimitBreakItem') assert.equal(quantity,1);else assert.ok([5,6,10,15].includes(quantity));
        now=product.startAt;await close();database=path.join(directory,`stock-pack-${productId}-${id}-${order}.sqlite`);await open();
        const baseline={userId:seed.userId,[idField]:id,amount:order==='stock-first'?0:7,cumulativeAmount:999999998,
          bookEntryState:255,signature:0x7fffffff,...(table==='UserGeneralLimitBreakItem'?{}:{reservedAmount:0})};
        for(const table of new Set(contents.map(item=>master.itemProfiles[item.rewardId].table))) writeProfile(table,[]);
        writeProfile(table,[baseline]);writeProfile('UserShopProduct',[]);app.store.changePaidCurrency(product.price*3);
        const funded=snapshot();
        for(const receiptTable of ['operation_queue','shop_item_claim','shop_request','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER enhancement_pack_issue_fail BEFORE INSERT ON ${receiptTable} BEGIN SELECT RAISE(ABORT,'pack issue rollback'); END`);
          await reject(send(body),503,funded,true);app.store.db.exec('DROP TRIGGER enhancement_pack_issue_fail');
        }
        const randomInt=crypto.randomInt;let response;
        try {crypto.randomInt=()=>baseline.signature;response=await send(body);} finally {crypto.randomInt=randomInt;}
        const identity=sequence,bought=parse(response),op=bought.operation,
          target=app.store.db.prepare('SELECT * FROM shop_item_claim WHERE operation_id=? AND item_id=?').get(op.id,id),
          acquired={...baseline,amount:baseline.amount+quantity,cumulativeAmount:999999999,signature:op.signature},
          finalItem=order==='spent-before-save'?{...acquired,amount:0}:acquired,
          purchase={userId:seed.userId,shopProductId:productId,count:bought.count,lastExchangedAt:bought.lastExchangedAt,readState:1},
          extras={};
        assert.equal(op.signature,1);assert.equal(target.id_field,idField);assert.equal(target.cap_version,1);
        assert.equal(target.amount,quantity);assert.equal(JSON.parse(target.stock_state).beforeSignature,baseline.signature);
        assert.equal(app.store.paidCurrency(),funded.paid-product.price);
        assert.deepEqual(bought.boughtItems,contents.map(item=>({itemId:item.rewardId,amount:item.amount*product.amount})));
        assert.deepEqual(app.store.read(table).data,[baseline],'Pack issuance does not precredit native material');
        for(const item of bought.boughtItems.filter(item=>item.itemId!==id)) {
          const profile=master.itemProfiles[item.itemId];
          (extras[profile.table]??=[]).push({userId:seed.userId,[profile.idField]:item.itemId,cumulativeAmount:item.amount,
            bookEntryState:1,signature:op.signature,...(profile.table==='UserGachaTicket'?
              {dateList:Array.from({length:item.amount},()=>({aquiredAt:now}))}:
              {amount:item.amount,...(profile.table==='UserGeneralLimitBreakItem'?{}:{reservedAmount:0})})});
        }
        const final={...extras,[table]:[...(extras[table]??[]),finalItem],UserShopProduct:[purchase]};
        for(const name of Object.keys(extras)) {
          const missing={...final};delete missing[name];await reject(save([op],missing),400);
        }
        const partial=order==='counts-first'?{UserShopProduct:[purchase]}:
          {[table]:[order==='stock-first'?{...baseline,amount:quantity}:finalItem]};
        await reject(save([op],partial),400);parse(await save([],partial));
        await close();await open();assert.deepEqual(app.store.operations(),[op]);
        await reject(request(port,identity,body,String(identity),'shop/buy'));await reject(send(body));
        await reject(save([op]),400);
        for(const [table,event] of [['profile','UPDATE'],['shop_item_claim','UPDATE'],['operation_done','INSERT'],
          ['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          if(order==='spent-before-save' && table==='shop_item_claim') continue;
          app.store.db.exec(`CREATE TRIGGER enhancement_pack_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'pack ACK rollback'); END`);
          await reject(save([op],final),503,snapshot(),true);app.store.db.exec('DROP TRIGGER enhancement_pack_ack_fail');
        }
        const finalWire=saveBody([op],final),ack=await send(finalWire,'user_data/push'),ackIdentity=sequence;parse(ack);
        await close();await open();assert.deepEqual(app.store.operations(),[]);
        const retained=snapshot();
        assert.deepEqual((await request(port,ackIdentity,finalWire,String(ackIdentity),'user_data/push')).body,ack.body);
        assert.deepEqual(snapshot(),retained);assert.equal(app.store.paidCurrency(),funded.paid-product.price);
        parse(await save([],{[table]:[{...finalItem,amount:0}]}));
        await reject(save([],{[table]:[{...finalItem,amount:1}]}),400);
        await reject(save([],{[table]:[{...finalItem,amount:0,cumulativeAmount:999999998}]}),400);
      }

    // WRITTEN ONLY / NOT RUN: two original standalone offers and two paid mixed packs, seven dated-save orders.
    for(const productId of [207000033,207001506,207000001,207003535])
      for(const order of ['append-first','counts-first','cumulative-first','signature-first','together','expired-before-save','prune-before-gain']) {
        const product=master.shopProducts[productId],packed=product.rewardType===2 || product.rewardType===4 && product.priceType===1,
          contents=packed?master.shopPacks[product.rewardId].contents:[{type:product.rewardType,rewardId:product.rewardId,amount:product.amount}],
          ticketReward=contents.find(row=>row.type===0 && master.itemProfiles[row.rewardId].table==='UserGachaTicket'),
          id=ticketReward.rewardId,quantity=ticketReward.amount*(packed?product.amount:1),duration=master.lotteryTickets[id];
        assert.ok(Number.isSafeInteger(duration) && duration>0);now=product.startAt || 1571400000;
        await close();database=path.join(directory,`dated-${productId}-${order}.sqlite`);await open();
        const baseline={userId:seed.userId,gachaTicketId:id,bookEntryState:-128,signature:order==='signature-first'?0xffffffff:0x7fffffff,
          cumulativeAmount:['signature-first','expired-before-save'].includes(order)?999999999:999999998,
          dateList:['signature-first','expired-before-save'].includes(order)?[]:
            [{aquiredAt:order==='prune-before-gain'?now-duration-1:now-1},{aquiredAt:order==='prune-before-gain'?now-duration-1:now-1}]},
          body={shopProductId:productId},cost=product.priceType===2?{userId:seed.userId,eventItemId:product.priceItemId,
            amount:product.price*3,cumulativeAmount:product.price*3,bookEntryState:1,signature:0}:null,
          savedCost=cost?{...cost,amount:cost.amount-product.price}:null;
        writeProfile('UserGachaTicket',[baseline]);writeProfile('UserShopProduct',[]);
        if(cost) {writeProfile('UserEventItem',[cost]);parse(await save([],{UserEventItem:[savedCost]}, {},'EventShopBuy'));}
        else app.store.changePaidCurrency(product.price*3);
        const funded=snapshot();
        for(const receiptTable of ['operation_queue','shop_item_claim','shop_request','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER dated_shop_issue_fail BEFORE INSERT ON ${receiptTable} BEGIN SELECT RAISE(ABORT,'dated issue rollback'); END`);
          await reject(send(body),503,funded,true);app.store.db.exec('DROP TRIGGER dated_shop_issue_fail');
        }
        const randomInt=crypto.randomInt;let initial;
        try {crypto.randomInt=()=>baseline.signature===0xffffffff?1:baseline.signature;initial=await send(body);}
        finally {crypto.randomInt=randomInt;}
        const identity=sequence,bought=parse(initial),op=bought.operation,
          target=app.store.db.prepare('SELECT * FROM shop_item_claim WHERE operation_id=? AND item_id=?').get(op.id,id),
          capture=JSON.parse(target.gacha_state),newDates=Array.from({length:quantity},()=>({aquiredAt:now})),
          acquired={...baseline,cumulativeAmount:999999999,signature:op.signature,
            dateList:[...(order==='prune-before-gain'?[]:baseline.dateList),...newDates]},
          finalTicket=['append-first','signature-first','expired-before-save','cumulative-first'].includes(order)?{...acquired,dateList:[]}:acquired,
          row={userId:seed.userId,shopProductId:productId,count:bought.count,lastExchangedAt:bought.lastExchangedAt,readState:1},extra={};
        for(const item of bought.boughtItems.filter(item=>item.itemId!==id)) {
          const profile=master.itemProfiles[item.itemId];assert.equal(profile.table,'UserPCTicket');
          extra[profile.table]=[{userId:seed.userId,[profile.idField]:item.itemId,
            dateList:Array.from({length:item.amount},()=>({aquiredAt:now})),cumulativeAmount:item.amount,
            bookEntryState:3,signature:op.signature}];
        }
        if(bought.boughtCostumes.length) {
          extra.UserCharacterCostume=bought.boughtCostumes.map(costumeId=>({userId:seed.userId,costumeId,costumeState:2}));
          extra.UserCommunicationVoice=Object.entries(master.communicationVoices).filter(([,voice])=>bought.boughtCostumes.includes(voice.costumeId))
            .map(([voiceId])=>({userId:0,voiceId:Number(voiceId),voiceState:2}));
        }
        assert.equal(op.signature,1);assert.equal(target.cap_version,1);assert.equal(target.stock_state,null);assert.equal(target.valis_state,null);
        assert.deepEqual(capture,{policy:'offline-shop-gacha-cap-v1',beforeCumulative:baseline.cumulativeAmount,beforeDates:baseline.dateList,
          beforeSignature:baseline.signature,signature:op.signature,dateAdditions:0,observed:false,effect:false});
        assert.deepEqual(app.store.read('UserGachaTicket').data,[baseline],'The shop must not precredit dated inventory/signature/cumulative');
        assert.equal(app.store.paidCurrency(),funded.paid-(cost?0:product.price));
        assert.deepEqual(parse(await send(body)).operation,op);assert.equal(app.store.pendingCappedGachaTicket(id),true);
        const queued=snapshot();assert.throws(()=>app.store.issueDraw([1011002001],{userGachaTicket:baseline},1000),/Capped Present tickets|shop tickets/);
        assert.deepEqual(snapshot(),queued,'Lottery replacement cannot overtake a captured shop ticket');
        for(const changes of [{cap_version:0},{gacha_state:null},{gacha_state:'{'},{stock_state:'{}'},
          {gacha_state:JSON.stringify({...capture,policy:'offline-gift-gacha-cap-v1'})},
          {gacha_state:JSON.stringify({...capture,beforeSignature:op.signature})},
          {gacha_state:JSON.stringify({...capture,dateAdditions:quantity+1})},
          {gacha_state:JSON.stringify({...capture,observed:true})}]) {
          app.store.db.prepare(`UPDATE shop_item_claim SET ${Object.keys(changes).map(field=>`${field}=?`).join(',')} WHERE operation_id=? AND item_id=?`)
            .run(...Object.values(changes),op.id,id);await reject(send(body));
          app.store.db.prepare('UPDATE shop_item_claim SET cap_version=1,gacha_state=?,stock_state=NULL WHERE operation_id=? AND item_id=?')
            .run(target.gacha_state,op.id,id);
        }
        for(const invalid of [{...acquired,signature:baseline.signature},{...acquired,userId:2},{...acquired,signature:0x100000000},
          {...acquired,bookEntryState:128},{...acquired,amount:quantity},{...acquired,dateList:[{aquiredAt:now,expireAt:now+duration}]}])
          await reject(save([op],{UserShopProduct:[row],UserGachaTicket:[invalid],...extra}),400);
        const partial=order==='append-first'?{UserGachaTicket:[{...baseline,dateList:[...baseline.dateList,...newDates]}]}:
          order==='counts-first'?{UserShopProduct:[row]}:order==='cumulative-first'?{UserGachaTicket:[{...baseline,cumulativeAmount:999999999}]}:
            order==='prune-before-gain'?{UserGachaTicket:[{...baseline,dateList:[]}]}:{UserGachaTicket:[finalTicket]};
        await reject(save([op],partial),400);
        if(order!=='together') {
          for(const [receiptTable,event] of [['profile','UPDATE'],
            ...(order==='prune-before-gain'?[]:[[order==='counts-first'?'shop_request':'shop_item_claim','UPDATE']]),['reply_cache','INSERT']]) {
            app.store.db.exec(`CREATE TRIGGER dated_shop_save_fail BEFORE ${event} ON ${receiptTable} BEGIN SELECT RAISE(ABORT,'dated save rollback'); END`);
            await reject(save([],partial),503,snapshot(),true);app.store.db.exec('DROP TRIGGER dated_shop_save_fail');
          }
          parse(await save([],partial));assert.deepEqual(app.store.operations(),[op]);
          const state=JSON.parse(app.store.db.prepare('SELECT gacha_state FROM shop_item_claim WHERE operation_id=? AND item_id=?').get(op.id,id).gacha_state);
          assert.equal(state.observed,['signature-first','expired-before-save'].includes(order));
          assert.equal(state.dateAdditions,order==='append-first'?quantity:0);
          if(order==='append-first') {
            parse(await save([],{UserGachaTicket:[{...baseline,dateList:[]}]}));
            await reject(save([],{UserGachaTicket:[{...baseline,dateList:newDates}]}),400);
          }
          if(state.observed) await reject(save([],{UserGachaTicket:[{...finalTicket,dateList:[{aquiredAt:now+1}]}]}),400);
          await close();await open();
          if(order==='prune-before-gain') assert.deepEqual(parse(await send(body)).operation,op,'Expiry alone does not prove the reward callback');
          else {
            await reject(send(body));await reject(request(port,identity,body,String(identity),'shop/buy'));
            if(['counts-first','signature-first','expired-before-save'].includes(order))
              await recover(op,state.observed?op.parameters.boughtItems.filter(item=>item.itemId!==id):op.parameters.boughtItems,
                ['UserGachaTicket','UserPCTicket','UserShopProduct']);
            else {
              for(const action of ['user/login','user_data/confirm']) await reject(send(undefined,action));
              await reject(send({tables:['UserGachaTicket','UserShopProduct']},'user_data/pull'));
            }
          }
          await reject(save([op]),400);
        }
        if(packed) await reject(save([op],{UserShopProduct:[row],UserGachaTicket:[finalTicket]}),400,
          snapshot());
        const final=saveBody([op],{UserShopProduct:[row],UserGachaTicket:[finalTicket],...extra});
        for(const [receiptTable,event] of [['shop_item_claim','UPDATE'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          if(!packed && ['signature-first','expired-before-save'].includes(order) && receiptTable==='shop_item_claim') continue;
          app.store.db.exec(`CREATE TRIGGER dated_shop_ack_fail BEFORE ${event} ON ${receiptTable} BEGIN SELECT RAISE(ABORT,'dated ACK rollback'); END`);
          await reject(send(final,'user_data/push'),503,snapshot(),true);app.store.db.exec('DROP TRIGGER dated_shop_ack_fail');
        }
        const ack=await send(final,'user_data/push'),ackIdentity=sequence;parse(ack);await close();await open();
        assert.deepEqual(app.store.operations(),[]);assert.equal(app.store.pendingCappedGachaTicket(id),false);
        assert.equal(JSON.parse(app.store.db.prepare('SELECT gacha_state FROM shop_item_claim WHERE operation_id=? AND item_id=?').get(op.id,id).gacha_state).observed,true);
        const retained=snapshot();assert.deepEqual((await request(port,ackIdentity,final,String(ackIdentity),'user_data/push')).body,ack.body);
        await reject(request(port,identity,body,String(identity),'shop/buy'));assert.deepEqual(snapshot(),retained);
        const spent={...finalTicket,dateList:[]};parse(await save([],{UserGachaTicket:[spent]}));
        await reject(save([],{UserGachaTicket:[{...spent,dateList:[{aquiredAt:now}]}]}),400);
        await reject(save([],{UserGachaTicket:[{...spent,cumulativeAmount:999999998}]}),400);
        const held=snapshot();assert.throws(()=>app.store.issueDraw([1011002001],{userGachaTicket:{...spent,dateList:[{aquiredAt:now}]}},1000),/cannot be restored/);
        assert.deepEqual(snapshot(),held,'Shared issuer preserves a completed shop dated-stock checkpoint');
        const gift={userId:seed.userId,id:1,itemId:id,amount:1,title:'Synthetic saved ticket Present',message:'',senderType:1,senderId:0,
          giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,pcHeroSublimateCount:0,
          state:0,startAt:now,expireAt:0,createdAt:now,dynamodbExpireAt:0};
        writeProfile('UserGift',[gift]);
        const present=parse(await send({userId:seed.userId,giftIds:[1]},'gift/receive')).operation;
        assert.equal(app.store.pendingCappedGachaTicket(id),true);
        if(cost) {
          parse(await save([],{UserEventItem:[{...savedCost,amount:savedCost.amount-product.price}]}, {},'EventShopBuy'));
          await reject(send(body),400);
        }
        parse(await save([present],{UserGift:[{...gift,state:1}],UserGachaTicket:[{...spent,signature:present.signature,dateList:[{aquiredAt:now}]}]}));
        assert.equal(app.store.read('UserGachaTicket').data[0].dateList.length,1);
        assert.equal(app.store.paidCurrency(),funded.paid-(cost?0:product.price),'Deferred ticket cases never bypass a paid pack price');
      }

    // WRITTEN ONLY / NOT RUN: a same-item queued1000 full-row consumer must settle before9000 captures a dated baseline.
    for(const productId of [207000033,207001506,207000001,207003535]) {
      const product=master.shopProducts[productId],packed=product.rewardType===2 || product.rewardType===4 && product.priceType===1,
        contents=packed?master.shopPacks[product.rewardId].contents:[{type:0,rewardId:product.rewardId,amount:product.amount}],
        id=contents.find(row=>row.type===0 && master.itemProfiles[row.rewardId].table==='UserGachaTicket').rewardId;
      now=product.startAt || 1571400000;await close();database=path.join(directory,`dated-consumer-first-${productId}.sqlite`);await open();
      const ticket={userId:seed.userId,gachaTicketId:id,bookEntryState:1,signature:7,cumulativeAmount:999999999,
        dateList:[{aquiredAt:now},{aquiredAt:now}]};writeProfile('UserGachaTicket',[ticket]);
      if(product.priceType===2) {
        const cost={userId:seed.userId,eventItemId:product.priceItemId,amount:2*product.price,cumulativeAmount:2*product.price,bookEntryState:1,signature:0};
        writeProfile('UserEventItem',[cost]);parse(await save([],{UserEventItem:[{...cost,amount:product.price}]}, {},'EventShopBuy'));
      } else app.store.changePaidCurrency(2*product.price);
      app.store.issueDraw([1011002001],{userGachaTicket:{...ticket,dateList:[ticket.dateList[0]]}},1000);
      await reject(send({shopProductId:productId}),400);await close();await open();await reject(send({shopProductId:productId}),400);
      assert.deepEqual(app.store.operations().map(row=>row.type),[1000]);assert.equal(snapshot().items.length,0);
    }

    // WRITTEN ONLY / NOT RUN: an issued sale remains deliverable after its archived window closes.
    const windowProduct=master.shopProducts[207000142],windowBody={shopProductId:207000142};
    await close();database=path.join(directory,'window-pending.sqlite');now=windowProduct.startAt;await open();
    app.store.changePaidCurrency(windowProduct.price*2);
    const windowIssued=parse(await send(windowBody)),windowBalance=app.store.paidCurrency();
    now=windowProduct.endAt;await close();await open();
    assert.deepEqual(parse(await send(windowBody)),windowIssued,'The existing signed purchase survives expiry and restart');
    assert.equal(app.store.paidCurrency(),windowBalance,'Retry must not charge paid Iris again');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM shop_request WHERE product_id=?').get(windowBody.shopProductId).n,1);
    await close();database=path.join(directory,'window-fresh.sqlite');await open();
    app.store.changePaidCurrency(windowProduct.price*2);
    await reject(send(windowBody),400);

    // WRITTEN ONLY / NOT RUN: the original starter duration uses saved account creation, not local save metadata.
    const starterProduct=master.shopProducts[207000001],starterBody={shopProductId:207000001},born=1571400000;
    await close();database=path.join(directory,'starter-duration-pending.sqlite');now=born;await open();
    assert.equal(app.store.read('UserStatus').data[0].createdAt,born);
    app.store.changePaidCurrency(starterProduct.price*2);
    now=born+starterProduct.duration-1;
    const starterIssued=parse(await send(starterBody)),starterBalance=app.store.paidCurrency();
    now++;await close();await open();
    assert.deepEqual(parse(await send(starterBody)),starterIssued,'Issued starter purchase remains deliverable at expiry');
    assert.equal(app.store.paidCurrency(),starterBalance,'Expired retry must not debit again');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM shop_request WHERE product_id=?').get(starterBody.shopProductId).n,1);
    await close();database=path.join(directory,'starter-duration-expired.sqlite');now=born;await open();
    const originalStatus=[{...app.store.read('UserStatus').data[0],lastLoginedAt:born}];
    parse(await save([],{UserStatus:originalStatus}, {}, 'UserLogin'));
    assert.equal(app.store.read('UserStatus').data[0].createdAt,born);
    for(const changed of [[{...originalStatus[0],createdAt:born+1}],
      [{...originalStatus[0],userId:seed.userId+1}]])
      await reject(save([],{UserStatus:changed}),400);
    await reject(save([],{}, {UserStatus:originalStatus}),400);
    assert.deepEqual(app.store.read('UserStatus').data,originalStatus);
    app.store.changePaidCurrency(starterProduct.price*2);
    now=born+starterProduct.duration;
    await reject(send(starterBody),400);
    for(const bad of [[],[{...originalStatus[0],userId:seed.userId+1}],[{...originalStatus[0],createdAt:0}]]) {
      writeProfile('UserStatus',bad);await reject(send(starterBody),400);
    }
    writeProfile('UserStatus',originalStatus);
    now=born-1;
    app.store.db.exec("CREATE TRIGGER starter_issue_fail BEFORE INSERT ON operation_queue BEGIN SELECT RAISE(ABORT,'starter rollback'); END");
    await reject(send(starterBody),503,snapshot(),true);
    app.store.db.exec('DROP TRIGGER starter_issue_fail');
    parse(await send(starterBody));
    assert.equal(app.store.paidCurrency(),starterProduct.price,'Signed clock rewind follows the original duration comparison');

    await close(); database = path.join(directory,'typed-history.sqlite'); await open();
    app.store.changeHardCurrency(100); writeProfile('UserShopProduct',[]); writeProfile('UserAdventureTicket',[]);
    const typedBody = { shopProductId:207000002 }, typed = parse(await send(typedBody)).operations[0];
    const capture = app.store.db.prepare('SELECT * FROM shop_request WHERE operation_id=?').get(typed.id);
    for (const [column,invalid] of [['operation_json',null],['operation_json','{}'],['reward_operation_json','{}'],['before_shop',null],
      ['before_shop','{}'],['observed','["bogus"]'],['observed','["count","count"]'],['rewards','[]']]) {
      app.store.db.prepare(`UPDATE shop_request SET ${column}=? WHERE operation_id=?`).run(invalid,typed.id);
      await reject(send(typedBody)); await reject(save([typed])); assert.deepEqual(app.store.operations(),[typed]);
      app.store.db.prepare(`UPDATE shop_request SET ${column}=? WHERE operation_id=?`).run(capture[column],typed.id);
    }
    const typedItem = app.store.db.prepare('SELECT * FROM shop_item_claim WHERE operation_id=?').get(typed.id);
    app.store.db.prepare('DELETE FROM shop_item_claim WHERE operation_id=?').run(typed.id); await reject(send(typedBody));
    app.store.db.prepare(`INSERT INTO shop_item_claim(operation_id,item_id,amount,table_name,id_field,cumulative_amount) VALUES(?,?,?,?,?,?)`)
      .run(typedItem.operation_id,typedItem.item_id,typedItem.amount,typedItem.table_name,typedItem.id_field,typedItem.cumulative_amount);
    for (const column of ['token','signature']) {
      app.store.db.prepare(`UPDATE operation_queue SET ${column}=? WHERE id=?`).run(column === 'token' ? 'changed' : typed.signature+1,typed.id);
      await reject(send(typedBody)); app.store.db.prepare(`UPDATE operation_queue SET ${column}=? WHERE id=?`).run(typed[column],typed.id);
    }
    assert.deepEqual(parse(await send(typedBody)).operations,[typed], 'Unapplied receipt still retries exactly');
    console.log('SOURCE shop fixtures include125 numeric,33 enhancement-Hero pack,28 dated and4 consumer-first WRITTEN ONLY cases; native shop acceptance still pending');
  } finally {
    await close();
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('danmemore-shop-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
