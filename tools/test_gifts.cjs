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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-gifts-'));
  const database = path.join(directory, 'profile.sqlite'), realNow = Date.now;
  let app, port, sequence = 0, now = 1790866800;
  const open = async () => {
    app = createServer({ database, seed, master, log: value => {
      if (value.status >= 400) console.log(JSON.stringify(value));
    } });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => {
    if (app?.server.listening) await new Promise(resolve => app.server.close(resolve));
    app?.store.close(); app = null;
  };
  const send = (value, action = 'gift/receive') => request(port, ++sequence, value, String(sequence), action);
  const receive = ids => send({ userId: seed.userId, giftIds: ids });
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const putGifts = gifts => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(gifts), md5(gifts), 'UserGift');
  const gift = (id, itemId = 205000002, amount = 1) => ({ userId: seed.userId, id, itemId, amount,
    title: 'Offline test gift', message: '', senderType: 1, senderId: 0, giftAcquiredType: 2,
    itemLevel: 0, equipmentId: 0, equipmentEvolveCount: 0, pcLimitBreakCount: 0, pcHeroSublimateCount: 0,
    state: 0, startAt: now, expireAt: now + 100, createdAt: now, dynamodbExpireAt: 0 });
  const snapshot = () => Object.fromEntries(['profile','hard_currency','gift_claim','gift_receive_request','gift_item_claim','gift_pc_claim','gift_pc_floor','stamina_reward_claim','casino_reward_claim','operation_queue','operation_done',
    'equipment_reward_claim','equipment_piece_claim','costume_reward_claim','costume_unlock_floor','runtime','reply_cache'].map(table => [table, app.store.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
  const push = (operations, gifts, deleted = false, extra = {}) => send({ badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: { ...Object.fromEntries(Object.entries(extra).map(([name, rows]) => [name, md5(rows)])),
      ...(gifts ? { UserGift: md5(gifts) } : {}) } },
    deltas: gifts || Object.keys(extra).length ? [{ signature: 0, trigger: 'GiftReceive',
      putItems: { ...extra, ...(gifts && !deleted ? { UserGift: gifts } : {}) },
      deleteItems: deleted ? { UserGift: gifts } : {} }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })) }, 'user_data/push');
  try {
    Date.now = () => now * 1000;
    await open();
    const source = [gift(1, 205000001, 50), gift(2, 205000001, 30), gift(3, 292000001, 4),
      gift(4, 205000005, 10), gift(5, 205000006, 900), gift(6), gift(7, 292000001, 3)];
    putGifts(source);
    let before = snapshot();
    for (const value of [null, {}, { userId: 2, giftIds: [1] }, { userId: seed.userId, giftIds: [] },
      { userId: seed.userId, giftIds: [1,1] }, { userId: seed.userId, giftIds: ['1'] },
      { userId: seed.userId, giftIds: [0] }, { userId: seed.userId, giftIds: [1.5] },
      { userId: seed.userId, giftIds: [Number.MAX_SAFE_INTEGER + 1] },
      { userId: seed.userId, giftIds: [999] }, { userId: seed.userId, giftIds: [1], extra: 0 },
      { userId: seed.userId, giftIds: Array.from({ length: 101 }, (_, i) => i + 1) }]) {
      assert.equal((await send(value)).status, 400);
      assert.deepEqual(snapshot(), before);
    }
    for (const change of [{ userId: 2 }, { state: 1 }, { state: 2 }, { amount: 0 }, { amount: -1 },
      { amount: 0.5 }, { amount: 0x80000000 }, { itemId: '205000002' }, { startAt: now + 1 },
      { startAt: -1 }, { expireAt: now }, { expireAt: now - 1 }, { expireAt: -1 }]) {
      putGifts([{ ...gift(10), ...change }]); before = snapshot();
      assert.equal((await receive([10])).status, 400);
      assert.deepEqual(snapshot(), before);
    }
    for (const change of [{ itemId: 42 }, { itemId: Object.values(master.pcs)[0], amount: 2 }, { itemLevel: 1 },
      { equipmentId: 1 }, { equipmentEvolveCount: 1 }, { pcLimitBreakCount: 1 }, { pcHeroSublimateCount: 1 }]) {
      putGifts([{ ...gift(10), ...change }]); before = snapshot();
      assert.equal((await receive([10])).status, 503);
      assert.deepEqual(snapshot(), before);
    }
    putGifts([gift(10), gift(10)]); before = snapshot();
    assert.equal((await receive([10])).status, 503, 'Duplicate saved Present IDs cannot issue an ambiguous claim');
    assert.deepEqual(snapshot(), before);
    assert.equal((await push([], [gift(10)])).status, 503, 'A save cannot silently overwrite duplicate existing Presents');
    assert.deepEqual(snapshot(), before);
    putGifts(source); before = snapshot();
    assert.equal((await push([], [gift(10), gift(10)])).status, 400, 'A native save cannot introduce duplicate Present IDs');
    assert.deepEqual(snapshot(), before);
    putGifts([gift(10, 292000001, 0x7fffffff), gift(11, 292000001, 1)]); before = snapshot();
    assert.equal((await receive([10,11])).status, 400);
    assert.deepEqual(snapshot(), before);
    putGifts(source); before = snapshot();
    for (const [table, event] of [['hard_currency','UPDATE'], ['operation_queue','INSERT'],
      ['gift_claim','INSERT'], ['gift_item_claim','INSERT'], ['stamina_reward_claim','INSERT'],
      ['casino_reward_claim','INSERT'], ['gift_receive_request','INSERT'], ['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_gift BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'gift failure'); END`);
      assert.equal((await receive([1,2,3,4,5,7])).status, 503);
      assert.deepEqual(snapshot(), before, 'Wallet, claims, queue, sequence and reply roll back together');
      app.store.db.exec('DROP TRIGGER fail_gift');
    }
    const first = await receive([7,5,4,3,2,1]), firstSequence = sequence;
    const received = parse(first), operation = received.operations[0];
    assert.deepEqual(received.operation,operation,'Native hot Present transport must apply the same signed2000 before its popup');
    for (const [name, value] of Object.entries(operation.parameters)) assert.deepEqual(received[name], value,
      `Gift result popup reads ${name} at the response root, not in operations[0]`);
    assert.deepEqual(received.issueAmounts, []); assert.deepEqual(received.issueUnionRaidMedal, []);
    assert.equal(received.issueCasinoMedal, 900);
    assert.equal(operation.type, 2000);
    assert.deepEqual(operation.parameters, { UserGift: source.filter(row => row.id !== 6),
      receivedItems: [{ itemId: 205000001, amount: 80 }, { itemId: 292000001, amount: 7 },
        { itemId: 205000005, amount: 10 }], receivedPCs: [], receivedExPCs: [], receivedEquipments: [],
      receivedCostumes: [], issueCasinoMedal: 900 });
    assert.equal(app.store.hardCurrency(), 80);
    assert.deepEqual(app.store.read('UserGift').data, source, 'Client must apply the operation before receiving state 1');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM gift_claim').get().n, 6);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM gift_receive_request').get(),{
      request_key:`${firstSequence}/${firstSequence}`,body_hash:md5({userId:seed.userId,giftIds:[7,5,4,3,2,1]}),
      operation_id:operation.id,gift_ids:JSON.stringify([1,2,3,4,5,7]),operation_json:JSON.stringify(operation)
    },'Present issuance retains its exact request bytes, sorted gift identity and signed operation');
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE action=?').run(
      Buffer.from(JSON.stringify({ code: 0, operations: [operation] })).toString('base64'), 'gift/receive');
    const legacyPending = snapshot();
    assert.deepEqual(parse(await request(port, firstSequence, { userId: seed.userId, giftIds: [7,5,4,3,2,1] },
      String(firstSequence), 'gift/receive')), received, 'Old cached reply adds the popup envelope without reissuing its reward');
    assert.deepEqual(snapshot(), legacyPending);
    const {operation:singular,...pluralOnly}=received;
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(
      Buffer.from(JSON.stringify(pluralOnly)).toString('base64'),`${firstSequence}/${firstSequence}`);
    const oldHotEnvelope=snapshot();
    assert.deepEqual(parse(await request(port,firstSequence,{userId:seed.userId,giftIds:[7,5,4,3,2,1]},
      String(firstSequence),'gift/receive')),received,'Existing popup fields with missing hot2000 also repair without reissuing');
    assert.deepEqual(snapshot(),oldHotEnvelope);
    assert.deepEqual(parse(await receive([1,2,3,4,5,7])).operations, [operation]);
    before = snapshot();
    assert.equal((await receive([1,6])).status, 503,
      'A mixed old/new claim requires the retained earlier claim or a completed-state refresh');
    assert.deepEqual(snapshot(), before);
    assert.equal((await push([operation])).status, 400);
    assert.deepEqual(snapshot(), before, 'A bare acknowledgement cannot discard a pending gift');
    const disjoint = parse(await receive([6])).operations[0];
    assert.deepEqual(disjoint.parameters.receivedItems, [{ itemId: 205000002, amount: 1 }]);
    app.store.beginSession(); await close(); await open();
    now += 1000;
    assert.deepEqual((await request(port, firstSequence, { userId: seed.userId, giftIds: [7,5,4,3,2,1] },
      String(firstSequence), 'gift/receive')).body, first.body,
    'Permanent pending request transport survives reply-cache eviction, restart and gift expiry');
    assert.deepEqual(parse(await receive([1,2,3,4,5,7])).operations, [operation], 'Expiry cannot invalidate an already-issued reward');
    assert.equal(app.store.hardCurrency(), 80);
    const resumed = parse(await receive([1,2,3,4,5,7]));
    assert.deepEqual(resumed.UserGift, operation.parameters.UserGift);
    assert.equal(resumed.issueCasinoMedal, 900, 'A pending retry preserves the root popup contract without new awards');
    const saved = operation.parameters.UserGift.map(row => ({ ...row, state: 1 }));
    const partial=parse(await push([], saved)); // Save and ACK may be separate transactions.
    assert(!partial.operations.some(row=>row.id===operation.id));
    assert.equal(partial.operation,undefined,'A saved Present must not reappear in the hot singular envelope');
    await close(); await open();
    assert.equal((await receive([7,5,4,3,2,1])).status, 503, 'A saved claim flag cannot redeliver additive rewards');
    assert.deepEqual(app.store.operations().find(row => row.id === operation.id), operation);
    assert.equal((await push([operation])).status, 400, 'Gift flags alone cannot discard unsaved casino medals');
    // Synthetic native-shaped acquisition, not native gift application proof.
    parse(await push([], undefined, false, { UserCasinoState: [{ ...seed.data.UserCasinoState[0],
      medalAmount: 900, cumulativeMedalAmount: 900, signature: operation.signature }] }));
    before = snapshot(); assert.equal((await push([operation])).status, 400);
    assert.deepEqual(snapshot(), before, 'Casino save and gift flags cannot replace the ordinary item acquisition');
    const expTarget = app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=? AND item_id=?')
      .get(operation.id,292000001);
    parse(await push([], undefined, false, { UserExpItem: [{ userId: seed.userId, expItemId: expTarget.item_id,
      amount: 7, cumulativeAmount: expTarget.cumulative_amount, reservedAmount: 0, bookEntryState: 3, signature: operation.signature }] }));
    before = snapshot(); assert.equal((await push([operation])).status, 400);
    assert.deepEqual(snapshot(), before, 'Received flags and ordinary/casino items cannot replace the saved SP increase');
    const staminaTarget = app.store.db.prepare('SELECT * FROM stamina_reward_claim WHERE operation_id=?').get(operation.id);
    const info = structuredClone(app.store.read('UserInfo').data);
    info[0].playerStatus.baseSP = staminaTarget.sp_minimum;
    parse(await push([], undefined, false, { UserInfo: info }));
    assert.equal((await push([operation])).status,400,'Saved ordinary rewards still need the native Iris lifetime');
    const gemTarget=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=? AND item_id=?')
      .get(operation.id,205000001),currencyRows=app.store.read('UserCurrency').data,
      gem=currencyRows.find(row=>row.currencyId===205000001) ?? {userId:seed.userId,currencyId:205000001,
        amount:0,reservedAmount:0,bookEntryState:1,signature:0,cumulativeAmount:0};
    parse(await push([],undefined,false,{UserCurrency:[...currencyRows.filter(row=>row.currencyId!==205000001),
      {...gem,bookEntryState:3,cumulativeAmount:gemTarget.cumulative_amount}]}));
    before = snapshot();
    app.store.db.exec("CREATE TRIGGER fail_ack BEFORE DELETE ON operation_queue BEGIN SELECT RAISE(ABORT,'ack failure'); END");
    assert.equal((await push([operation])).status, 503);
    assert.deepEqual(snapshot(), before);
    app.store.db.exec('DROP TRIGGER fail_ack');
    parse(await push([operation]));
    parse(await push([operation]));
    app.store.beginSession(); await close(); await open();
    const {operation:_hot,operations:_queued,...settledRoot}=received,
      settledRetry=parse(await request(port,firstSequence,{userId:seed.userId,giftIds:[7,5,4,3,2,1]},
        String(firstSequence),'gift/receive'));
    assert.deepEqual(settledRetry,{...settledRoot,operations:[]},
      'An acknowledged exact retry preserves mandatory popup fields without redelivering operation2000');
    before=snapshot();
    assert.equal((await request(port,firstSequence,{userId:seed.userId,giftIds:[7,5,4,3,2]},
      String(firstSequence),'gift/receive')).status,400,'Changed bytes cannot reuse a settled Present request identity');
    assert.deepEqual(snapshot(),before,'A conflicting settled retry changes no profile, receipt, queue or sequence');
    assert.equal((await request(port,firstSequence,{userId:seed.userId,giftIds:[7,5,4,3,2,1]},
      String(firstSequence),'achievement/complete')).status,400,'Another route cannot reuse a Present request identity');
    const requestReceipt=app.store.db.prepare('SELECT * FROM gift_receive_request WHERE request_key=?')
      .get(`${firstSequence}/${firstSequence}`);
    for(const [field,corrupt] of [['gift_ids','[1]'],['operation_id',operation.id+1000],['operation_json','{}']]) {
      app.store.db.prepare(`UPDATE gift_receive_request SET ${field}=? WHERE request_key=?`)
        .run(corrupt,requestReceipt.request_key);
      before=snapshot();
      assert.equal((await request(port,firstSequence,{userId:seed.userId,giftIds:[7,5,4,3,2,1]},
        String(firstSequence),'gift/receive')).status,503,`Corrupt ${field} cannot replay an acknowledged Present`);
      assert.deepEqual(snapshot(),before,`Corrupt ${field} refusal changes no durable state`);
      app.store.db.prepare(`UPDATE gift_receive_request SET ${field}=? WHERE request_key=?`)
        .run(requestReceipt[field],requestReceipt.request_key);
    }
    const firstClaim=app.store.db.prepare('SELECT * FROM gift_claim WHERE gift_id=1').get();
    app.store.db.prepare('DELETE FROM gift_claim WHERE gift_id=1').run();before=snapshot();
    assert.equal((await request(port,firstSequence,{userId:seed.userId,giftIds:[7,5,4,3,2,1]},
      String(firstSequence),'gift/receive')).status,503,'A settled request cannot outlive its permanent gift claim');
    assert.deepEqual(snapshot(),before);app.store.db.prepare(
      'INSERT INTO gift_claim(gift_id,operation_id,iris_capture_version) VALUES(?,?,?)')
      .run(firstClaim.gift_id,firstClaim.operation_id,firstClaim.iris_capture_version);
    app.store.db.prepare('INSERT INTO operation_queue(id,type,parameters,token,signature) VALUES(?,?,?,?,?)')
      .run(operation.id,operation.type,JSON.stringify(operation.parameters),operation.token,operation.signature);
    before=snapshot();
    assert.equal((await request(port,firstSequence,{userId:seed.userId,giftIds:[7,5,4,3,2,1]},
      String(firstSequence),'gift/receive')).status,503,'Queue and done cannot both own an acknowledged Present');
    assert.deepEqual(snapshot(),before);app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(operation.id);
    const valisTarget = app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=?').get(disjoint.id);
    const valisRows = app.store.read('UserCurrency').data, valis = valisRows.find(row => row.currencyId === 205000002) ??
      { userId: seed.userId, currencyId: 205000002, amount: 0, reservedAmount: 0, bookEntryState: 3, signature: 0 };
    parse(await push([disjoint], [{ id: 6 }], true, { UserCurrency: [...valisRows.filter(row => row.currencyId !== 205000002),
      { ...valis, amount: valis.amount + 1, cumulativeAmount: valisTarget.cumulative_amount }] }));
    assert.deepEqual(app.store.operations(), []);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM gift_claim').get().n, 7);
    putGifts(source.map(row => ({ ...row, expireAt: 0 })));
    await close(); await open();
    before = snapshot();
    assert.equal((await receive([1])).status, 503);
    assert.equal((await receive([6])).status, 503);
    assert.equal((await request(port,firstSequence,{userId:seed.userId,giftIds:[7,5,4,3,2,1]},
      String(firstSequence),'gift/receive')).status,503,'A settled exact identity cannot bless restored unclaimed Presents');
    assert.deepEqual(snapshot(), before, 'A stale profile cannot award gifts already recorded in the claim ledger');
    const irisGift=gift(30,205000001,9);
    putGifts([irisGift]);
    const irisOperation=parse(await receive([30])).operations[0],
      irisTarget=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=? AND item_id=?')
        .get(irisOperation.id,205000001);
    assert.equal(app.store.db.prepare('SELECT iris_capture_version FROM gift_claim WHERE gift_id=?').get(30).iris_capture_version,1);
    assert.equal(irisTarget.amount,9);
    assert.equal(app.store.hardCurrency(),89,'The local Iris wallet credits once at issue, not on cold replay');
    parse(await push([], [{...irisGift,state:1}]));
    await close();await open();
    assert.deepEqual(app.store.giftStaminaRecovery(irisOperation).parameters.receivedItems,
      irisOperation.parameters.receivedItems,'Flags-first cold replay retains the native Iris lifetime callback');
    assert.equal((await push([irisOperation])).status,400,'Gift flags and wallet credit cannot replace native Iris lifetime');
    const currencies=app.store.read('UserCurrency').data,
      owned=currencies.find(row=>row.currencyId===205000001) ?? {userId:seed.userId,currencyId:205000001,
        amount:0,reservedAmount:0,bookEntryState:1,signature:0,cumulativeAmount:0};
    parse(await push([],undefined,false,{UserCurrency:[...currencies.filter(row=>row.currencyId!==205000001),
      {...owned,bookEntryState:3,cumulativeAmount:irisTarget.cumulative_amount-1}]}));
    assert.throws(()=>app.store.giftStaminaRecovery(irisOperation),
      /Pure-Iris Present lifetime changed/,'A partial native lifetime cannot replay the full Iris gain');
    parse(await push([],undefined,false,{UserCurrency:[...currencies.filter(row=>row.currencyId!==205000001),
      {...owned,bookEntryState:3,cumulativeAmount:irisTarget.cumulative_amount}]}));
    assert.deepEqual(app.store.giftStaminaRecovery(irisOperation).parameters.receivedItems,[],
      'A fully saved native Iris lifetime is omitted from the derived cold callback');
    parse(await push([irisOperation]));
    assert.equal(app.store.hardCurrency(),89,'Cold ACK cannot grant Iris a second time');
    const mixedIris=[gift(31,205000001,7),gift(32,205000005,3)];
    putGifts(mixedIris);
    const mixedIrisOperation=parse(await receive([31,32])).operations[0],
      mixedGemTarget=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=? AND item_id=?')
        .get(mixedIrisOperation.id,205000001),
      mixedStamina=app.store.db.prepare('SELECT * FROM stamina_reward_claim WHERE operation_id=?')
        .get(mixedIrisOperation.id);
    parse(await push([],mixedIris.map(row=>({...row,state:1}))));
    assert.deepEqual(app.store.giftStaminaRecovery(mixedIrisOperation).parameters.receivedItems,
      mixedIrisOperation.parameters.receivedItems,'Mixed Iris and SP both retain untouched native callbacks');
    const mixedCurrencies=app.store.read('UserCurrency').data,mixedGem=mixedCurrencies.find(row=>row.currencyId===205000001);
    parse(await push([],undefined,false,{UserCurrency:[...mixedCurrencies.filter(row=>row.currencyId!==205000001),
      {...mixedGem,bookEntryState:3,cumulativeAmount:mixedGemTarget.cumulative_amount}]}));
    assert.deepEqual(app.store.giftStaminaRecovery(mixedIrisOperation).parameters.receivedItems,
      [{itemId:205000005,amount:3}],'Saved Iris lifetime omits only Iris, not unsaved SP');
    const mixedInfo=structuredClone(app.store.read('UserInfo').data);
    mixedInfo[0].playerStatus.baseSP=mixedStamina.sp_minimum;
    parse(await push([],undefined,false,{UserInfo:mixedInfo}));
    assert.deepEqual(app.store.giftStaminaRecovery(mixedIrisOperation).parameters.receivedItems,[]);
    parse(await push([mixedIrisOperation]));
    assert.equal(app.store.hardCurrency(),96);
    const legacy = gift(20);
    putGifts([legacy]);
    const oldOperation = app.store.issueOperation(2000, { UserGift: [legacy] });
    before = snapshot();
    assert.equal((await receive([20])).status, 400);
    assert.equal((await push([oldOperation], [{ ...legacy, state: 1 }])).status, 503);
    assert.deepEqual(snapshot(), before, 'Legacy sparse operations are preserved for explicit reconciliation, not guessed or dropped');
    console.log('Gifts: native flat payload, reward routing, once-only wallet, pending retries, split saves, rollback and restart OK; native application unverified');
  } finally {
    Date.now = realNow;
    await close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
