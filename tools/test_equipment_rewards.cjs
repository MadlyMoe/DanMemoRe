'use strict';

// DEFERRED synthetic saves. Not native gifting/crafting/stat/RNG/UI proof.
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
const weapon = Number(Object.keys(master.equipments).find(id => master.equipments[id].type === 1));
const armour = Number(Object.keys(master.equipments).find(id => master.equipments[id].type === 2));

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-equipment-rewards-'));
  let app, port, database, sequence = 0, now = 1686794400;
  const open = async () => {
    app = createServer({ database, seed, master, wallNowSeconds: () => now, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const fresh = async name => { await close(); database = path.join(directory, `${name}.sqlite`); await open(); };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows), md5(rows), name);
  const send = (action, value) => request(port, ++sequence, value, String(sequence), action);
  const receive = gifts => send('gift/receive', { userId: seed.userId, giftIds: gifts.map(row => row.id) });
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const push = (putItems = {}, operations = [], deleteItems = {}, trigger = 'GiftReceive') => send('user_data/push', {
    badges: null, scripts: {}, dataTokens: {}, checksums: { before: {}, after: Object.fromEntries(
      [...new Set([...Object.keys(putItems), ...Object.keys(deleteItems)])].map(name => [name, md5(putItems[name] ?? [])])) },
    deltas: Object.keys(putItems).length || Object.keys(deleteItems).length ? [{ signature: 0, trigger, putItems, deleteItems }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })),
  });
  const gift = (id, equipmentId = weapon, amount = 1, extra = {}) => ({ userId: seed.userId, id, itemId: 0, amount,
    title: 'Synthetic original equipment gift', message: '', senderType: 1, senderId: 0, giftAcquiredType: 2,
    itemLevel: 0, equipmentId, equipmentEvolveCount: 0, pcLimitBreakCount: 0, pcHeroSublimateCount: 0,
    state: 0, startAt: now, expireAt: now + 100, createdAt: now, dynamodbExpireAt: 0, ...extra });
  const equipment = (id, slotIndex, extra = {}) => {
    const { type, ...spec } = app.store.equipmentSpec(id), original = master.equipments[spec.equipmentId];
    return { userId: seed.userId, ...spec, slotIndex, createAt: now, exp: 0,
      durability: original.durability, reservedDurability: original.durability, isProtected: false, isUnbreakable: false,
      ...Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`lockedAbility${i + 1}`, false])), ...extra };
  };
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name, app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all()]));
  const reject = async (response, status, before = snapshot(), unavailable = false) => {
    const result = await response; assert.equal(result.status, status, result.body.toString()); assert.equal(snapshot(), before);
    if (unavailable) assert.equal(JSON.parse(result.body).code, OFFLINE_UNAVAILABLE_CODE);
  };
  const observed = op => JSON.parse(app.store.db.prepare('SELECT observed FROM equipment_reward_claim WHERE operation_id=?').get(op.id).observed);
  try {
    await fresh('all-original-targets');
    const ids = [...Object.keys(master.equipments), ...Object.keys(master.equipmentGiftPresets)].map(Number);
    assert.equal(ids.length, 399);
    assert.equal(app.store.equipmentSpec(weapon).rarity, 0, 'Ordinary native saved rarity starts0');
    assert.equal(app.store.equipmentSpec(775000001).rarity,
      master.equipments[master.equipmentGiftPresets[775000001].equipmentId].rarity + master.equipmentGiftPresets[775000001].evolveCount);
    const gifts = ids.map((id, i) => gift(i + 1, id)); put('UserGift', gifts);
    const original = app.store.read('UserEquipment'), operations = [];
    for (let at = 0; at < gifts.length; at += 100) {
      const result = parse(await receive(gifts.slice(at, at + 100))); operations.push(result.operations[0]);
      assert.deepEqual(result.receivedEquipments, gifts.slice(at, at + 100).map(row => ({ equipmentId: row.equipmentId, amount: 1 })));
      assert.deepEqual(app.store.read('UserEquipment'), original, 'No server equipment/signature pre-credit');
    }
    const nextSlot = { 1: 1, 2: 10001 }, rows = ids.map(id => equipment(id, nextSlot[app.store.equipmentSpec(id).type]++));
    // Reverse native inventory order: a plain reward cannot consume the only
    // high-rarity preset proof. Different copies of one type must all survive.
    const flags = { UserGift: gifts.map(row => ({ ...row, state: 1 })) };
    await reject(push(flags, operations), 400); parse(await push({ ...flags, UserEquipment: [...rows].reverse() }));
    await close(); await open(); parse(await push({}, operations));
    assert.equal(app.store.read('UserEquipment').data.length, 399);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM equipment_piece_claim').get().n, 399);
    for (const op of operations) assert.equal(observed(op).length, op.parameters.receivedEquipments.length);

    await fresh('aggregate-preowned');
    const old = equipment(weapon, 1, { createAt: now - 1 }); put('UserEquipment', [old]);
    const source = [gift(1, weapon, 2), gift(2, weapon), gift(3, armour)]; put('UserGift', source);
    const response = await receive(source), identity = sequence, op = parse(response).operations[0];
    assert.deepEqual(op.parameters.receivedEquipments, [{ equipmentId: weapon, amount: 3 }, { equipmentId: armour, amount: 1 }]);
    const applied = [equipment(weapon, 2), equipment(weapon, 3), equipment(weapon, 4), equipment(armour, 10001)];
    await reject(push({ UserGift: source.map(row => ({ ...row, state: 1 })) }, [op]), 400);
    for (const invalid of [{ slotIndex: 10001 }, { userId: 9 }, { equipmentId: armour }, { performance: -1 },
      { rarity: -1 }, { createAt: -1 }, { abilityId1: Number.MAX_SAFE_INTEGER }, { isProtected: 0 }]) {
      await reject(push({ UserEquipment: [{ ...applied[0], ...invalid }] }, [op]), 400);
    }
    await reject(push({ UserEquipment: [applied[0], applied[0]] }), 400);
    const nativeOld = { ...old, performance: old.performance + 1 };
    parse(await push({ UserEquipment: [nativeOld, ...applied.slice(0, 2)] }));
    assert.equal(app.store.read('UserEquipment').data.length, 3, 'Slot identity keeps preowned and duplicate-type pieces');
    assert.equal(observed(op).length, 2);
    await reject(send('user_data/confirm'),503,snapshot(),true);
    parse(await push({ UserEquipment:[applied[2]] }));await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,
      [{...op,parameters:{...op.parameters,receivedEquipments:[{equipmentId:armour,amount:1}]}}],
      'A fully saved equipment type can be omitted while another type remains positive');
    parse(await push({ UserEquipment:[applied[3]], UserGift: source.map(row => ({ ...row, state: 1 })) }));
    assert.equal(observed(op).length, 4);
    // Recorded delivery is not a permanent inventory floor: selling/changing
    // a saved piece must not block an interrupted ACK or legitimate gameplay.
    parse(await push({}, [], { UserEquipment: applied.map(({ slotIndex }) => ({ slotIndex })) }));
    await close(); await open(); now += 1000;
    await reject(receive(source), 503, snapshot(), true);
    await reject(request(port, identity, { userId: seed.userId, giftIds: source.map(row => row.id) }, String(identity), 'gift/receive'), 503, snapshot(), true);
    assert.deepEqual(app.store.operations(), [op], 'Saved or sold pieces cannot cause another additive delivery');
    assert.deepEqual(parse(await send('user_data/confirm')).operations,
      [{...op,parameters:{...op.parameters,receivedEquipments:[]}}],
      'Permanent piece receipts, not current stock, suppress a cold regrant after sale');
    parse(await push({}, [op])); assert.equal(app.store.read('UserEquipment').data.length, 1);
    now -= 1000;

    for (const firstShop of [false, true]) {
      await fresh(`shop-gift-${firstShop}`);
      const product = master.shopProducts[207000143], profile = master.itemProfiles[product.priceItemId];
      const ticket = { userId: seed.userId, [profile.idField]: product.priceItemId, amount: 1, cumulativeAmount: 1,
        bookEntryState: 3, lastResetAt: 0, signature: 0 };
      put(profile.table, [ticket]); parse(await push({ [profile.table]: [{ ...ticket, amount: 0 }] }, [], {}, 'TicketShopBuy'));
      const gifts = [gift(1, product.rewardId)]; put('UserGift', gifts);
      let shop, present;
      for (const kind of firstShop ? ['shop','gift'] : ['gift','shop']) {
        if (kind === 'shop') shop = parse(await send('shop/buy', { shopProductId: 207000143 }));
        else present = parse(await receive(gifts));
      }
      const shopOp = shop.operations[0], giftOp = present.operations[0], later = [shopOp,giftOp].sort((a,b) => b.id - a.id)[0];
      const earlier = later.id === shopOp.id ? giftOp : shopOp;
      const flags = { UserGift: gifts.map(row => ({ ...row, state: 1 })), UserShopProduct: [{ userId: seed.userId,
        shopProductId: 207000143, count: shop.count, lastExchangedAt: shop.lastExchangedAt, readState: 1 }] };
      const slot = app.store.equipmentSpec(product.rewardId).type === 1 ? 1 : 10001;
      const first = equipment(product.rewardId, slot);
      await reject(push({ ...flags, UserEquipment: [first] }, [shopOp,giftOp]), 400);
      parse(await push({ ...flags, UserEquipment: [first] })); parse(await push({}, [later]));
      await close(); await open(); await reject(push({}, [earlier]), 400, snapshot());
      parse(await push({ UserEquipment: [equipment(product.rewardId, slot + 1)] }, [earlier]));
      assert.equal(app.store.read('UserEquipment').data.length, 2);
    }

    await fresh('sold-slot-reuse');
    const originalPiece = equipment(weapon, 1), firstGift = [gift(1)]; put('UserGift', firstGift);
    const firstAward = parse(await receive(firstGift)).operations[0];
    parse(await push({ UserEquipment: [originalPiece], UserGift: firstGift.map(row => ({ ...row, state: 1 })) }, [firstAward]));
    parse(await push({}, [], { UserEquipment: [{ slotIndex: 1 }] }));
    const secondGift = [gift(2)]; put('UserGift', secondGift);
    const secondAward = parse(await receive(secondGift)).operations[0];
    // A vacated slot does not turn an already-used exact identity into a new
    // delivery. Repeating old creation time is ambiguous even after restart.
    parse(await push({ UserEquipment: [originalPiece], UserGift: secondGift.map(row => ({ ...row, state: 1 })) }));
    assert.equal(observed(secondAward).length, 0);
    await close(); await open(); await reject(push({}, [secondAward]), 400, snapshot());
    parse(await push({ UserEquipment: [equipment(weapon, 1, { createAt: now + 1 })] }, [secondAward]));
    assert.equal(observed(secondAward).length, 1);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM equipment_piece_claim').get().n, 2);

    await fresh('capacity');
    put('UserEquipment', Array.from({ length: 499 }, (_, i) => equipment(weapon, i + 1)));
    const capGifts = [gift(1, weapon, 2), gift(2, weapon), gift(3, armour, 500)]; put('UserGift', capGifts);
    await reject(receive([capGifts[0]]), 400);
    const capOp = parse(await receive([capGifts[1]])).operations[0];
    await reject(receive([capGifts[0]]), 400, snapshot());
    assert.equal(app.store.equipmentRewardTarget([{ equipmentId: armour, amount: 500 }]).grants[0].amount, 500);
    assert.equal(observed(capOp).length, 0);

    await fresh('invalid-gifts');
    for (const change of [{ equipmentId: 42 }, { itemId: weapon }, { itemLevel: 1 }, { equipmentEvolveCount: 1 },
      { pcLimitBreakCount: 1 }, { pcHeroSublimateCount: 1 }, { amount: 501 }]) {
      const gifts = [gift(1, weapon, 1, change)]; put('UserGift', gifts);
      await reject(receive(gifts), 503, snapshot(), true);
    }

    await fresh('history'); const sourceGift = [gift(1)]; put('UserGift', sourceGift);
    const first = await receive(sourceGift), historyIdentity = sequence, pending = parse(first).operations[0];
    const receipt = app.store.db.prepare('SELECT * FROM equipment_reward_claim').get();
    app.store.db.prepare('DELETE FROM equipment_reward_claim').run(); await close(); await open();
    await reject(receive(sourceGift), 503, snapshot(), true);
    await reject(request(port, historyIdentity, { userId: seed.userId, giftIds: [1] }, String(historyIdentity), 'gift/receive'), 503, snapshot(), true);
    await reject(push({ UserGift: sourceGift.map(row => ({ ...row, state: 1 })) }, [pending]), 503, snapshot(), true);
    app.store.db.prepare('INSERT INTO equipment_reward_claim VALUES(?,?,?,?)').run(receipt.operation_id, receipt.rewards, receipt.baseline, receipt.observed);
    app.store.db.prepare('UPDATE equipment_reward_claim SET rewards=?').run('[]');
    await reject(receive(sourceGift), 503, snapshot(), true); app.store.db.prepare('UPDATE equipment_reward_claim SET rewards=?').run(receipt.rewards);
    parse(await push({ UserEquipment: [equipment(weapon, 1)], UserGift: sourceGift.map(row => ({ ...row, state: 1 })) }));
    const binding = app.store.db.prepare('SELECT * FROM equipment_piece_claim').get();
    app.store.db.prepare('DELETE FROM equipment_piece_claim').run(); await reject(push({}, [pending]), 503, snapshot(), true);
    app.store.db.prepare('INSERT INTO equipment_piece_claim VALUES(?,?)').run(binding.piece_key, binding.operation_id);
    parse(await push({}, [pending]));

    await fresh('rollback');
    const mixed = [gift(1, 775000001), gift(2, 0, 33, { itemId: master.currencies['currency.gem'] })]; put('UserGift', mixed);
    for (const table of ['hard_currency','operation_queue','equipment_reward_claim','gift_claim','reply_cache']) {
      const event = table === 'hard_currency' ? 'UPDATE' : 'INSERT';
      app.store.db.exec(`CREATE TRIGGER fail_gear BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'gear issue rollback'); END`);
      await reject(receive(mixed), 503, snapshot()); app.store.db.exec('DROP TRIGGER fail_gear');
    }
    const operation = parse(await receive(mixed)).operations[0];
    const gemTarget=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=? AND item_id=?')
      .get(operation.id,master.currencies['currency.gem']),currencyRows=app.store.read('UserCurrency').data,
      gem=currencyRows.find(row=>row.currencyId===gemTarget.item_id) ?? {userId:seed.userId,currencyId:gemTarget.item_id,
        amount:0,reservedAmount:0,bookEntryState:1,signature:0,cumulativeAmount:0};
    const save = { UserEquipment: [equipment(775000001, 1)], UserGift: mixed.map(row => ({ ...row, state: 1 })),
      UserCurrency:[...currencyRows.filter(row=>row.currencyId!==gemTarget.item_id),
        {...gem,bookEntryState:3,cumulativeAmount:gemTarget.cumulative_amount}] };
    for (const [table,event] of [['profile','UPDATE'],['equipment_reward_claim','UPDATE'],['equipment_piece_claim','INSERT'],
      ['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_gear_save BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'gear save rollback'); END`);
      await reject(push(save, [operation]), 503, snapshot()); app.store.db.exec('DROP TRIGGER fail_gear_save');
    }
    parse(await push(save, [operation])); assert.equal(app.store.hardCurrency(), 33);
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    console.log('Equipment399 targets/slot merging/presets/quantity/preowned/split save/sales/shared shop history/capacity/replay/rollback probes OK; native acceptance pending');
  } finally {
    await close(); const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('danmemore-equipment-rewards-')); fs.rmSync(resolved, { recursive: true, force: true });
  }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
