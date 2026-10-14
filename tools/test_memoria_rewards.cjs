'use strict';

// Earlier synthetic checks are historical. New/changed recovery cases are
// DEFERRED / NOT RUN; signed native Memoria and shop acceptance remain pending.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request,rewardCharacterFixture,rewardCostumeFixture,rewardUnitStoryFixture,rewardCommunicationFixture } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = value => crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-memoria-rewards-'));
  let database = path.join(directory, 'profile.sqlite'), app, port, sequence = 0;
  const open = async () => {
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => {
    if (app?.server.listening) await new Promise(resolve => app.server.close(resolve));
    app?.store.close(); app = null;
  };
  const send = (body, action = 'achievement/complete') => request(port, ++sequence, body, String(sequence), action);
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows), md5(rows), name);
  const push = (putItems = {}, operations = [], deleteItems = {}, trigger = 'Achievement') => send({ badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: Object.fromEntries(Object.entries(putItems).map(([name, rows]) => [name, md5(rows)])) },
    deltas: [{ signature: 0, trigger, putItems, deleteItems }],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })) }, 'user_data/push');
  const snapshot = () => Object.fromEntries(['profile','operation_queue','operation_done','achievement_reward_state',
    'achievement_claim','achievement_item_claim','achievement_pc_delivery','achievement_memoria_floor','gift_pc_floor',
    'shop_request','shop_transport','shop_item_claim','shop_spend','hard_currency','reply_cache','runtime']
    .map(table => [table, app.store.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
  const claimRow = ([id, row]) => ({ userId: seed.userId, achievementId: Number(id), completedAt: row.startAt || 1,
    lastResetAt: 0, progressParam: 1, readState: 1, signature: 0, state: 3 });
  const claimBody = rows => ({ achievementIds: rows.map(({ achievementId, completedAt }) => ({ achievementId, completedAt })) });
  const itemId = master.items.memoria_exp_item_general;
  const item = { userId: seed.userId, memoriaExpItemId: itemId, amount: 2, cumulativeAmount: 5,
    bookEntryState: 1, signature: 0, lastAquiredAt: 0, reservedAmount: 0 };
  const reject = async (response,status = 503,before = snapshot(),raw = false) => {
    const value = await response; assert.equal(value.status,status,value.body.toString()); assert.deepEqual(snapshot(),before);
    if (raw) assert.equal(value.body.length,0,'Injected SQLite failure is not semantic cancellation');
    else if (status === 503) assert.equal(JSON.parse(value.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  try {
    await open();
    const memoriaRewards = Object.entries(master.achievements).filter(([, row]) => row.rewardType === 30);
    const expRewards = Object.entries(master.achievements).filter(([, row]) => row.rewardType === 31);
    assert.equal(memoriaRewards.length, 30); assert.equal(expRewards.length, 10);
    const ids = memoriaRewards.map(([, row]) => master.memorias[row.rewardKey]);
    const baseline = ids.slice(0, 2).map((memoriaId, index) => ({ userId: index ? seed.userId : 0, memoriaId,
      totalExp: index ? 5000 : 0, signature: 0 }));
    const claims = [...memoriaRewards, ...expRewards.slice(0, 8)].map(claimRow);
    put('UserAchievement', claims); put('UserMemoria', baseline); put('UserMemoriaExpItem', [item]);
    const value = claimBody(claims);
    for (const changes of [{ userId: 2 }, { totalExp: -1 }, { totalExp: 0.5 }, { totalExp: '0' }, { totalExp: 100000000 }]) {
      put('UserMemoria', [{ ...baseline[0], ...changes }, baseline[1]]);
      const before = snapshot();
      assert.equal((await send(value)).status, 503,'Corrupt stored cards must cancel without rewriting legacy inventory');
      assert.deepEqual(snapshot(), before);
      for (const action of ['user/login','user_data/confirm']) await reject(send(undefined,action));
      await reject(send({ tables:['UserMemoria'] },'user_data/pull'));
    }
    put('UserMemoria', baseline);
    for (const changes of [{ userId: 2 }, { amount: -1 }, { amount: 1000000000 }, { cumulativeAmount: -1 },
      { cumulativeAmount: 0.5 }, { cumulativeAmount: 999999920 }, { cumulativeAmount: 1000000000 }]) {
      put('UserMemoriaExpItem', [{ ...item, ...changes }]);
      const before = snapshot();
      assert.equal((await send(value)).status, 400);
      assert.deepEqual(snapshot(), before);
    }
    put('UserMemoriaExpItem', [item]);
    for (const table of ['achievement_reward_state','achievement_pc_delivery','operation_queue','reply_cache']) {
      const before = snapshot();
      app.store.db.exec(`CREATE TRIGGER fail_memoria BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'memoria failure'); END`);
      assert.equal((await send(value)).status, 503);
      assert.deepEqual(snapshot(), before, 'Issuance, receipt and cached reply must commit together');
      app.store.db.exec('DROP TRIGGER fail_memoria');
    }
    const response = await send(value), originalSequence = sequence, result = parse(response), operation = result.operations[0];
    assert.equal(operation.type, 6000);
    assert.deepEqual(result.receivedMemorias, ids.map(memoriaId => ({ memoriaId, level: 1 })));
    assert.deepEqual(result.receivedItems, [{ itemId, amount: 80 }]);
    assert.deepEqual(operation.parameters.receivedMemorias, result.receivedMemorias);
    assert.deepEqual(operation.parameters.receivedItems, result.receivedItems);
    const cardTargets = JSON.parse(app.store.db.prepare('SELECT memoria_targets FROM achievement_pc_delivery WHERE operation_id=?').get(operation.id).memoria_targets);
    assert.equal(cardTargets.length,new Set(ids).size);
    assert.deepEqual(cardTargets.slice(0,2),baseline.map(row => ({ memoriaId:row.memoriaId,isFirst:false,beforeExp:row.totalExp,minimum:row.totalExp })));
    assert.deepEqual(app.store.read('UserMemoria').data, baseline, 'Native application must initialize new cards');
    assert.deepEqual(app.store.read('UserMemoriaExpItem').data, [item], 'Do not pre-apply an item operation');
    assert.deepEqual(parse(await send(value)).operations, [operation]);
    await close(); await open();
    const cached = await request(port, originalSequence, value, String(originalSequence), 'achievement/complete');
    assert.deepEqual(cached.body, response.body);
    assert.deepEqual(parse(await send(value)).operations, [operation]);
    const received = claims.map(row => ({ ...row, state: 4 }));
    // Synthetic native-shaped saves prove protocol durability, not emulator UI.
    const memorias = ids.map((memoriaId, index) => baseline[index] ?? { userId: 0, memoriaId, totalExp: 0, signature: operation.signature });
    const inventory = [{ ...item, amount: 0, cumulativeAmount: 85 }];
    assert.equal((await push({}, [operation])).status, 400);
    assert.equal((await push({ UserAchievement: received, UserMemoriaExpItem: inventory }, [operation])).status, 400);
    for (const changes of [{ userId: 2 }, { totalExp: -1 }, { totalExp: 0.5 }, { totalExp: 100000000 }]) {
      const invalid = memorias.map((row, i) => i === 2 ? { ...row, ...changes } : row), before = snapshot();
      assert.equal((await push({ UserAchievement: received, UserMemoria: invalid, UserMemoriaExpItem: inventory }, [operation])).status, 400);
      assert.deepEqual(snapshot(), before, 'Invalid acquisition must roll back the entire acknowledgement');
    }
    for (const changes of [{ userId: 2 }, { cumulativeAmount: 84 }, { cumulativeAmount: 1000000000 }, { amount: -1 }]) {
      assert.equal((await push({ UserAchievement: received, UserMemoria: memorias,
        UserMemoriaExpItem: [{ ...inventory[0], ...changes }] }, [operation])).status, 400);
    }
    for (const [table, event] of [['profile','UPDATE'], ['operation_queue','DELETE'], ['achievement_reward_state','DELETE']]) {
      const before = snapshot();
      app.store.db.exec(`CREATE TRIGGER fail_memoria BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'memoria failure'); END`);
      assert.equal((await push({ UserAchievement: received, UserMemoria: memorias, UserMemoriaExpItem: inventory }, [operation])).status, 503);
      assert.deepEqual(snapshot(), before, 'Reward save, acknowledgement and receipt cleanup must commit together');
      app.store.db.exec('DROP TRIGGER fail_memoria');
    }
    const downgraded = memorias.map((row, i) => i === 1 ? { ...row, totalExp: 0 } : row);
    await reject(push({ UserMemoria: downgraded }),400);
    await close(); await open();
    assert.equal((await push({ UserAchievement: received, UserMemoriaExpItem: inventory }, [operation])).status, 400,
      'A rejected downgrade does not initialize the outstanding new Memoria cards');
    parse(await push({ UserMemoria: memorias }));
    const cardObservations = JSON.parse(app.store.db.prepare('SELECT observed FROM achievement_pc_delivery WHERE operation_id=?').get(operation.id).observed);
    assert.deepEqual(cardObservations,cardTargets.filter(row => row.isFirst).map(row => `memoria:${row.memoriaId}`).sort(),
      'Unchanged preowned cards, including zero EXP, are not new delivery effects');
    assert.equal((await push({ UserMemoriaExpItem: inventory }, [operation])).status, 400, 'Received items alone cannot discard claim flags');
    parse(await push({ UserAchievement: received }));
    assert.equal((await push({}, [operation])).status, 400, 'Saved cards and claims cannot discard outstanding EXP items');
    parse(await push({ UserMemoriaExpItem: inventory }));
    await close(); await open();
    parse(await push({}, [operation]));
    assert.deepEqual(app.store.operations(), []);
    assert.deepEqual(app.store.read('UserMemoria').data, memorias);
    assert.deepEqual(app.store.read('UserMemoriaExpItem').data, inventory);
    await reject(push({ UserMemoria: [{ ...baseline[1],totalExp:0 }] }),400);
    const deleteCard = { UserMemoria:[{ memoriaId:baseline[0].memoriaId }] }, deleteSave = {
      badges:null,scripts:{},dataTokens:{},checksums:{ before:{},after:{ UserMemoria:md5([]) } },
      deltas:[{ signature:0,trigger:'Achievement',putItems:{},deleteItems:deleteCard }],operations:[] };
    await reject(send(deleteSave,'user_data/push'),400);
    assert.equal((await send(value)).status, 400);

    // Two distinct authored rewards reserve successive cumulative targets.
    // Fresh claim history with synthetic existing inventory, not reclaimed IDs.
    await close(); database = path.join(directory, 'concurrent.sqlite'); await open();
    put('UserMemoria', memorias); put('UserMemoriaExpItem', inventory);
    const later = expRewards.slice(8).map(claimRow);
    put('UserAchievement', later);
    const first = parse(await send(claimBody([later[0]]))).operations[0];
    const second = parse(await send(claimBody([later[1]]))).operations[0];
    assert.deepEqual(first.parameters.receivedItems, [{ itemId, amount: 10 }]);
    assert.deepEqual(second.parameters.receivedItems, [{ itemId, amount: 10 }]);
    assert.deepEqual(parse(await send(claimBody([later[1]]))).operations, [second]);
    parse(await push({ UserAchievement: later.map(row => ({ ...row, state: 4 })),
      UserMemoriaExpItem: [{ ...item, amount: 0, cumulativeAmount: 95 }] }));
    await close(); await open();
    assert.equal((await push({}, [second])).status, 400, 'One gain cannot acknowledge two pending rewards');
    parse(await push({}, [first]));
    assert.equal((await push({}, [second])).status, 400, 'Reservation survives the first receipt being removed');
    parse(await push({ UserMemoriaExpItem: [{ ...item, amount: 0, cumulativeAmount: 105 }] }, [second]));
    await close(); await open();
    assert.deepEqual(app.store.operations(), []);
    assert.equal(app.store.db.prepare('SELECT count(*) AS count FROM achievement_reward_state').get().count, 0);
    assert.equal(app.store.read('UserMemoriaExpItem').data[0].cumulativeAmount, 105);
    assert.deepEqual(app.store.read('UserMemoria').data, memorias);

    // A fresh inventory creates the exact native-shaped row; mixed PC awards
    // still require their own acquisition and the complete set of claim flags.
    await close(); database = path.join(directory, 'empty-inventory.sqlite'); await open();
    const pcReward = Object.entries(master.achievements).find(([, row]) => row.rewardType === 29);
    const freshClaims = [memoriaRewards[0], expRewards[0], pcReward].map(claimRow);
    put('UserAchievement', freshClaims);
    const fresh = parse(await send(claimBody(freshClaims))).operations[0];
    assert.deepEqual(fresh.parameters.receivedMemorias, [{ memoriaId: ids[0], level: 1 }]);
    assert.deepEqual(fresh.parameters.receivedItems, [{ itemId, amount: 10 }]);
    const pcId = master.pcs[pcReward[1].rewardKey];
    assert.deepEqual(fresh.parameters.receivedPCs, [pcId]);
    const freshReceived = freshClaims.map(row => ({ ...row, state: 4 }));
    const pcs = app.store.read('UserPC').data;
    const acquiredPcs = [...pcs, { ...pcs[0], pcId, joiningState: 1 }];
    const acquiredBoards = [...app.store.read('UserPCJobSet').data,
      { userId: seed.userId, pcId, pcJobs: [], signature: 0 }];
    const freshRows = { UserAchievement: freshReceived, UserMemoria: [baseline[0]],
      UserMemoriaExpItem: [{ ...item, amount: 10, cumulativeAmount: 10 }] };
    assert.equal((await push(freshRows, [fresh])).status, 400);
    assert.equal((await push({ ...freshRows, UserPC: acquiredPcs, UserMemoriaExpItem: [] }, [fresh])).status, 400);
    assert.equal((await push({ ...freshRows, UserPC: acquiredPcs }, [fresh])).status, 400,
      'A mission unit cannot settle without its native-owned ability-board set');
    await reject(push({ ...freshRows, UserPC: acquiredPcs, UserPCJobSet: acquiredBoards }, [fresh]),400);
    const acquiredCharacters = rewardCharacterFixture(app.store.read('UserCharacter').data,[pcId]);
    assert.equal((await push({ ...freshRows, UserPC: acquiredPcs, UserPCJobSet: acquiredBoards,UserCharacter:acquiredCharacters,
      ...rewardCostumeFixture(app.store.read('UserCharacterCostume').data,[pcId],app.store.read('UserCommunicationVoice').data),
      ...rewardUnitStoryFixture(app.store.read('UserAdventureStage').data,[pcId]) }, [fresh])).status,400,
      'A fresh mission unit also needs its native communication entry');
    parse(await push({ ...freshRows, UserPC: acquiredPcs, UserPCJobSet: acquiredBoards,UserCharacter:acquiredCharacters,
      ...rewardCostumeFixture(app.store.read('UserCharacterCostume').data,[pcId],app.store.read('UserCommunicationVoice').data),
      ...rewardUnitStoryFixture(app.store.read('UserAdventureStage').data,[pcId]) }));
    parse(await push(rewardCommunicationFixture(app.store,[pcId],Math.floor(Date.now()/1000)),[fresh]));
    assert.deepEqual(app.store.read('UserMemoria').data, [baseline[0]]);
    assert.equal(app.store.read('UserMemoriaExpItem').data[0].cumulativeAmount, 10);

    const cappedClaims = expRewards.slice(1, 3).map(claimRow);
    put('UserAchievement', [...freshReceived, ...cappedClaims]);
    put('UserMemoriaExpItem', [{ ...item, amount: 999999999, cumulativeAmount: 999999989 }]);
    const capped = parse(await send(claimBody([cappedClaims[0]]))).operations[0];
    parse(await push({ UserAchievement: [{ ...cappedClaims[0], state: 4 }],
      UserMemoriaExpItem: [{ ...item, amount: 999999999, cumulativeAmount: 999999999 }] }, [capped]));
    const beforeCapRejection = snapshot();
    assert.equal((await send(claimBody([cappedClaims[1]]))).status, 400);
    assert.deepEqual(snapshot(), beforeCapRejection, 'Saturation must not enqueue an unacknowledgeable grant');
    // These original category8 rewards have dated windows, not zero expiry.
    // Their retained completedAt is inside that window; no catalog is altered.
    const splitCard = memoriaRewards[0], splitExp = expRewards[0],
      iris = Object.entries(master.achievements).find(([,row]) => row.rewardType === 3 && row.rewardKey === 'currency.gem' && !row.expireAt);
    assert(splitCard && splitExp && iris);
    for (const kind of ['card','flags','item']) for (const reverse of [false,true]) {
      await close(); database = path.join(directory,`split-${kind}-${reverse}.sqlite`); await open();
      const claims = [splitCard,splitExp,iris].map(claimRow), value = claimBody(claims);
      put('UserAchievement',claims); put('UserMemoria',[]); put('UserMemoriaExpItem',[]);
      const pulled = { tables:['UserAchievement','UserMemoria','UserMemoriaExpItem'] };
      assert.equal((await send(pulled,'user_data/pull')).status,200); const pullIdentity = sequence;
      const wallet = app.store.hardCurrency(), reply = await send(value), identity = sequence, op = parse(reply).operations[0];
      assert.equal(app.store.hardCurrency(),wallet+iris[1].rewardAmount);
      const memoriaId = master.memorias[splitCard[1].rewardKey],
        card = { userId:0,memoriaId,totalExp:kind === 'item' && reverse ? 7 : 0,signature:op.signature };
      const exp = { ...item,amount:0,cumulativeAmount:splitExp[1].rewardAmount };
      const effects = { card:{ UserMemoria:[card] },flags:{ UserAchievement:claims.map(row => ({ ...row,state:4 })) },
        item:{ UserMemoriaExpItem:[exp] } };
      const first = reverse ? Object.assign({},...Object.entries(effects).filter(([key]) => key !== kind).map(([,rows]) => rows)) : effects[kind];
      await reject(push(first,[op]),400);
      for (const [table,event] of [['achievement_pc_delivery','UPDATE'],['profile','UPDATE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_mission_split BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'mission split rollback'); END`);
        await reject(push(first),503,snapshot(),true); app.store.db.exec('DROP TRIGGER fail_mission_split');
      }
      const partial = parse(await push(first)); assert.deepEqual(partial.operations,[]); assert.deepEqual(app.store.operations(),[op]);
      const capture = app.store.db.prepare('SELECT * FROM achievement_pc_delivery WHERE operation_id=?').get(op.id);
      assert.deepEqual(JSON.parse(capture.memoria_targets),[{ memoriaId,isFirst:true,beforeExp:null,minimum:0 }]);
      await close(); await open();
      await reject(send(value)); await reject(request(port,identity,value,String(identity),'achievement/complete'));
      for (const action of ['user/login','user_data/confirm']) await reject(send(undefined,action));
      await reject(send(pulled,'user_data/pull')); await reject(push({},[op]),400);
      for (const invalid of [null,'null','[]','{}',JSON.stringify([{ memoriaId,isFirst:true,beforeExp:0,minimum:0 }])]) {
        app.store.db.prepare('UPDATE achievement_pc_delivery SET memoria_targets=? WHERE operation_id=?').run(invalid,op.id);
        await reject(send(value)); await reject(push({},[op]));
        app.store.db.prepare('UPDATE achievement_pc_delivery SET memoria_targets=? WHERE operation_id=?').run(capture.memoria_targets,op.id);
      }
      const all = Object.assign({},...Object.values(effects)); parse(await push(all));
      const removed = { ...deleteSave,checksums:{ before:{},after:{ UserMemoria:md5([]) } },
        deltas:[{ signature:0,trigger:'Achievement',putItems:{},deleteItems:{ UserMemoria:[{ memoriaId }] } }] };
      await reject(send(removed,'user_data/push'),400);
      for (const [table,event] of [['achievement_memoria_floor','INSERT'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_mission_card_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'mission card ACK rollback'); END`);
        await reject(push({},[op]),503,snapshot(),true); app.store.db.exec('DROP TRIGGER fail_mission_card_ack');
      }
      parse(await push({},[op])); parse(await push({},[op]));
      assert.deepEqual({ ...app.store.db.prepare('SELECT * FROM achievement_memoria_floor WHERE memoria_id=?').get(memoriaId) },
        { memoria_id:memoriaId,minimum_exp:card.totalExp },'Real ACK retains actual saved EXP above issuance');
      assert.equal(app.store.hardCurrency(),wallet+iris[1].rewardAmount); assert.deepEqual(app.store.operations(),[]);
      await reject(send(removed,'user_data/push'),400);
      await reject(request(port,identity,value,String(identity),'achievement/complete'));
      await reject(request(port,pullIdentity,pulled,String(pullIdentity),'user_data/pull'));
    }
    // Existing6000/9000 offline pairing: original catalog, no invented bundle
    // or native precredit. Four authored zero-length windows remain inactive.
    const shopCards = Object.entries(master.shopProducts).filter(([,row]) => row.rewardType === 5);
    assert.equal(shopCards.length,34);
    const inactive = shopCards.filter(([,row]) => row.startAt === row.endAt && row.endAt > 0);
    assert.equal(inactive.length,4);
    const active = shopCards.filter(([,row]) => !row.endAt); assert.equal(active.length,30);
    for (const [index,[id,product]] of active.entries()) {
      await close(); database = path.join(directory,`shop-card-${id}.sqlite`); await open();
      const value = { shopProductId:Number(id) }, profile = master.itemProfiles[product.priceItemId],
        card = { userId:index % 2 ? seed.userId : 0,memoriaId:product.rewardId,totalExp:index % 3 === 2 ? 5000 : 0,signature:0 },
        baseline = index % 3 ? [card] : [], cost = { userId:seed.userId,[profile.idField]:product.priceItemId,
          amount:product.price,cumulativeAmount:product.price,bookEntryState:3,lastResetAt:0,signature:0 };
      put('UserMemoria',baseline); put(profile.table,[cost]);
      const pulled = { tables:['UserMemoria'] };
      assert.equal((await send(pulled,'user_data/pull')).status,200); const pullIdentity = sequence;
      for (const [closedId] of inactive) await reject(send({ shopProductId:Number(closedId) },'shop/buy'),400);
      parse(await push({ [profile.table]:[{ ...cost,amount:0 }] },[],{},'EventShopBuy'));
      if (!index) for (const table of ['achievement_pc_delivery','achievement_reward_state','shop_request','shop_transport','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_shop_card BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'shop card rollback'); END`);
        await reject(send(value,'shop/buy'),503,snapshot(),true); app.store.db.exec('DROP TRIGGER fail_shop_card');
      }
      const reply = await send(value,'shop/buy'), identity = sequence, bought = parse(reply), [award,purchase] = bought.operations;
      if (!baseline.length) card.signature = award.signature;
      assert.deepEqual(bought.operations.map(row => row.type),[6000,9000]);
      assert.deepEqual(bought.operation,{ ...purchase,operations:[award] },
        'Every active card exchange uses the same signed prefix and9000 callback');
      if (!index) {
        const {operation:hot,...legacy}=bought;
        app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?')
          .run(Buffer.from(JSON.stringify(legacy)).toString('base64'),`${identity}/${identity}`);
        const retained=snapshot();
        assert.deepEqual(parse(await request(port,identity,value,String(identity),'shop/buy')),bought);
        assert.deepEqual(snapshot(),retained,'Card cache repair does not recharge, replace captures or reissue rewards');
      }
      assert.deepEqual(award.parameters,{ UserAchievement:[],receivedItems:[],receivedCostumes:[],receivedPCs:[],
        receivedMemorias:[{ memoriaId:card.memoriaId,level:1 }],issueAmount:0,issueStamina:0,issueCasinoMedal:0,issueUnionRaidMedal:0 });
      const capture = app.store.db.prepare('SELECT * FROM achievement_pc_delivery WHERE operation_id=?').get(award.id),
        target = { memoriaId:card.memoriaId,isFirst:!baseline.length,beforeExp:baseline.length ? card.totalExp : null,minimum:card.totalExp };
      assert.deepEqual(JSON.parse(capture.memoria_targets),[target]);
      assert.deepEqual(app.store.read('UserMemoria').data,baseline,'Issuance must not initialize or overwrite native cards');
      assert.deepEqual(parse(await send(value,'shop/buy')).operations,bought.operations);
      const aliasIdentity=sequence;
      if(!index) {
        app.store.db.prepare('DELETE FROM reply_cache WHERE key IN (?,?)')
          .run(`${identity}/${identity}`,`${aliasIdentity}/${aliasIdentity}`);
        const retained=snapshot();
        for(const requestId of [identity,aliasIdentity])
          assert.deepEqual(parse(await request(port,requestId,value,String(requestId),'shop/buy')),bought);
        assert.deepEqual(snapshot(),retained,'Cache eviction must retain one paired Memoria purchase and charge');
      }
      const original = app.store.db.prepare('SELECT * FROM shop_request WHERE operation_id=?').get(purchase.id);
      assert.deepEqual(JSON.parse(original.rewards),[{ type:5,id:card.memoriaId,minimum:card.totalExp }]);
      assert.equal(original.operation_json,JSON.stringify(purchase));
      assert.equal(original.reward_operation_json,JSON.stringify(award));
      if (!index) {
        for (const [table,column,operationId,invalid] of [
          ['achievement_pc_delivery','memoria_targets',award.id,null],
          ['achievement_pc_delivery','operation_json',award.id,'{}'],
          ['shop_request','operation_json',purchase.id,null],
          ['shop_request','reward_operation_json',purchase.id,'{}'],
          ['shop_request','reward_operation_id',purchase.id,award.id+100],
          ['shop_request','rewards',purchase.id,'[]'],
          ['achievement_reward_state','targets',award.id,'[]']]) {
          const retained = app.store.db.prepare(`SELECT ${column} value FROM ${table} WHERE operation_id=?`).get(operationId).value;
          app.store.db.prepare(`UPDATE ${table} SET ${column}=? WHERE operation_id=?`).run(invalid,operationId);
          await reject(send(value,'shop/buy')); await reject(push());
          await close(); await open(); await reject(send(value,'shop/buy'));
          app.store.db.prepare(`UPDATE ${table} SET ${column}=? WHERE operation_id=?`).run(retained,operationId);
        }
        app.store.db.prepare('DELETE FROM achievement_pc_delivery WHERE operation_id=?').run(award.id);
        await close(); await open(); await reject(send(value,'shop/buy'));
        assert.equal(app.store.db.prepare('SELECT 1 FROM achievement_pc_delivery WHERE operation_id=?').get(award.id),undefined,
          'Restart must not reconstruct a missing purchase capture from current inventory');
        app.store.db.prepare(`INSERT INTO achievement_pc_delivery(operation_id,operation_json,pc_targets,memoria_targets,observed)
          VALUES(?,?,?,?,?)`).run(capture.operation_id,capture.operation_json,capture.pc_targets,capture.memoria_targets,capture.observed);
      }
      if (!baseline.length) await reject(push({},[award]),400);
      // Native6000 does not mutate a preowned card already above level1.
      // Its real ACK can precede the separately saved9000 purchase count.
      const earlyAck = index === 1;
      if (earlyAck) parse(await push({},[award]));
      await reject(push({},[purchase]),400);
      for (const changes of [{ userId:2 },{ userId:'0' },{ memoriaId:0 },{ memoriaId:999999999 },{ memoriaId:card.memoriaId+0.5 },
        { totalExp:-1 },{ totalExp:0.5 },{ totalExp:100000000 }])
        await reject(push({ UserMemoria:[{ ...card,...changes }] }),400);
      await reject(push({ UserMemoria:[card,card] }),400);
      const missingId = { ...card }; delete missingId.memoriaId;
      await reject(push({ UserMemoria:[{ ...missingId,id:card.memoriaId }] }),400);
      if (card.totalExp) await reject(push({ UserMemoria:[{ ...card,totalExp:0 }] }),400);
      const productRow = { userId:seed.userId,shopProductId:Number(id),count:bought.count,
        lastExchangedAt:bought.lastExchangedAt,readState:1 },
        effects = [{ UserMemoria:[card] },{ UserShopProduct:[productRow] }];
      if (index % 2) effects.reverse();
      if (!index) for (const [table,event] of [['achievement_pc_delivery','UPDATE'],['profile','UPDATE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_shop_card_save BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'shop card save rollback'); END`);
        await reject(push(effects[0]),503,snapshot(),true); app.store.db.exec('DROP TRIGGER fail_shop_card_save');
      }
      parse(await push(effects[0])); await close(); await open();
      const firstCard=app.store.read('UserMemoria').data.find(row=>row.memoriaId===card.memoriaId),
        firstAward={...award,parameters:{...award.parameters,receivedMemorias:firstCard?[]:award.parameters.receivedMemorias}},
        firstQueue=app.store.operations(),firstProfiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
      assert.deepEqual(parse(await send(undefined,'user_data/confirm')).operations,earlyAck?[purchase]:[firstAward,purchase]);
      parse(await send(undefined,'user/login'));assert.equal((await send(pulled,'user_data/pull')).status,200);
      assert.deepEqual(app.store.operations(),firstQueue);assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),firstProfiles);
      parse(await push(effects[1]));
      assert.deepEqual(JSON.parse(app.store.db.prepare('SELECT observed FROM achievement_pc_delivery WHERE operation_id=?')
        .get(award.id).observed),baseline.length ? [] : [`memoria:${card.memoriaId}`]);
      assert.equal(app.store.operations().length,earlyAck ? 1 : 2,'Split saves never synthesize acknowledgements');
      await reject(send(value,'shop/buy')); await reject(request(port,identity,value,String(identity),'shop/buy'));
      const recovered={...award,parameters:{...award.parameters,receivedMemorias:[]}},queue=app.store.operations();
      assert.deepEqual(parse(await send(undefined,'user_data/confirm')).operations,earlyAck?[purchase]:[recovered,purchase]);
      parse(await send(undefined,'user/login'));assert.deepEqual(app.store.operations(),queue);
      assert.deepEqual(app.store.read('UserMemoria').data,[card]);
      if (!index) for (const [table,event] of [['achievement_memoria_floor','INSERT'],['operation_done','INSERT'],
        ['operation_queue','DELETE'],['achievement_reward_state','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_shop_card_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'shop card ACK rollback'); END`);
        await reject(push({},bought.operations),503,snapshot(),true); app.store.db.exec('DROP TRIGGER fail_shop_card_ack');
      }
      if (earlyAck) parse(await push({},[purchase]));
      else if (index % 4) {
        const first = index % 4 === 1 ? purchase : award, second = first === purchase ? award : purchase;
        parse(await push({},[first])); await close(); await open();
        assert.deepEqual(parse(await send(undefined,'user_data/confirm')).operations,[second.type===6000?recovered:second]);
        parse(await push({},[second]));
      } else parse(await push({},bought.operations));
      assert.deepEqual(app.store.operations(),[]);
      assert.equal(app.store.db.prepare('SELECT minimum_exp FROM achievement_memoria_floor WHERE memoria_id=?')
        .get(card.memoriaId).minimum_exp,card.totalExp);
      assert.deepEqual(app.store.read('UserMemoria').data,[card]);
      assert.equal(app.store.read('UserMemoria').token,md5([card]),'Native owner/signature bytes must not be normalized after ACK');
      if(!index) {
        app.store.db.prepare('DELETE FROM reply_cache WHERE key IN (?,?)')
          .run(`${identity}/${identity}`,`${aliasIdentity}/${aliasIdentity}`);
        const {operation:ignoredOperation,operations:ignoredOperations,...popup}=bought,
          settled={...popup,operations:[]},settledState=snapshot();
        for(const requestId of [identity,aliasIdentity])
          assert.deepEqual(parse(await request(port,requestId,value,String(requestId),'shop/buy')),settled);
        assert.deepEqual(snapshot(),settledState,'Settled Memoria exchange cannot redeliver its card or charge');
        for(const invalid of [null,'{}']) {
          app.store.db.prepare('UPDATE shop_request SET reward_operation_json=? WHERE operation_id=?').run(invalid,purchase.id);
          await reject(request(port,identity,value,String(identity),'shop/buy'));
          app.store.db.prepare('UPDATE shop_request SET reward_operation_json=? WHERE operation_id=?')
            .run(original.reward_operation_json,purchase.id);
        }
        app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(award.id);
        await reject(request(port,identity,value,String(identity),'shop/buy'));
        app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(award.id);
        app.store.db.prepare('INSERT INTO operation_queue(id,type,parameters,token,signature) VALUES(?,?,?,?,?)')
          .run(award.id,award.type,JSON.stringify(award.parameters),award.token,award.signature);
        await reject(request(port,identity,value,String(identity),'shop/buy'));
        app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(award.id);
      }
      await reject(push({ UserMemoria:[{ ...card,userId:card.userId ? 0 : seed.userId }] }),400);
      await reject(push({},[],{ UserMemoria:[{ memoriaId:card.memoriaId }] }),400);
      if (card.totalExp) await reject(push({ UserMemoria:[{ ...card,totalExp:0 }] }),400);
      const advanced={ ...card,totalExp:card.totalExp+1 };
      parse(await push({ UserMemoria:[advanced] }));
      assert.equal(app.store.db.prepare('SELECT minimum_exp FROM achievement_memoria_floor WHERE memoria_id=?')
        .get(card.memoriaId).minimum_exp,advanced.totalExp);
      await reject(push({ UserMemoria:[card] }),400);
      await reject(request(port,pullIdentity,pulled,String(pullIdentity),'user_data/pull'));
      if(!index) {
        const newer={...advanced,totalExp:advanced.totalExp+1};
        for(const [table,event] of [['achievement_memoria_floor','UPDATE'],['profile','UPDATE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER fail_memoria_progress BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'progress rollback'); END`);
          await reject(push({UserMemoria:[newer]}),503,snapshot(),true);
          app.store.db.exec('DROP TRIGGER fail_memoria_progress');
        }
        parse(await push({UserMemoria:[newer]}));
        // Older valid legacy floor beside newer actual saved EXP is not permission to rewind.
        app.store.db.prepare('UPDATE achievement_memoria_floor SET minimum_exp=? WHERE memoria_id=?').run(card.totalExp,card.memoriaId);
        await reject(push({UserMemoria:[advanced]}),400);
        const latest={...newer,totalExp:newer.totalExp+1};
        parse(await push({UserMemoria:[latest]}));
        await close();await open();
        await reject(push({UserMemoria:[newer]}),400);
        const currentPull=await send(pulled,'user_data/pull');assert.equal(currentPull.status,200);
        for(const action of ['user/login','user_data/confirm']) parse(await send(undefined,action));
        put('UserMemoria',[{...latest,totalExp:card.totalExp}]);
        for(const action of ['user/login','user_data/confirm']) await reject(send(undefined,action));
        await reject(send(pulled,'user_data/pull'));
        await reject(push({UserMemoria:[latest]}));
        put('UserMemoria',[latest]);
        await reject(push({},[],{UserMemoria:[{memoriaId:card.memoriaId}]}),400);
      }
    }
    await close();database=path.join(directory,'legacy-no-floor.sqlite');await open();
    const legacy={...baseline[0],totalExp:5000};put('UserMemoria',[legacy]);
    parse(await push({UserMemoria:[{...legacy,totalExp:5001}]}));
    assert.equal(app.store.db.prepare('SELECT count(*) n FROM achievement_memoria_floor').get().n,0,
      'Uncheckpointed legacy rows do not fabricate reward ownership or ACK history');
    console.log('SOURCE mission/shop Memoria fixtures: original30 mission/34 shop cards, zero/local owners, actual EXP floors, stale rewind/corrupt read rejection, split/either ACK orders, atomic rollback/restart/no legacy backfill; native acceptance still pending');
  } finally {
    await close();
    const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('danmemore-memoria-rewards-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
