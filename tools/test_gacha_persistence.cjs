'use strict';

// DEFERRED. Synthetic initialization/acquisition deltas, not native gameplay proof.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request, drawAcknowledgement } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-gacha-persistence-'));
  const random = crypto.randomInt, now = master.lotteries[171000002].startAt+60;
  let app, port, database, sequence = 100;
  const open = async () => {
    app = createServer({ database,seed,master,wallNowSeconds:() => now,log:() => {} });
    await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const fresh = async name => { await close(); database = path.join(directory,`${name}.sqlite`); await open(); };
  const send = (action,value) => request(port,++sequence,value,String(sequence),action);
  const parse = response => { assert.equal(response.status,200,response.body.toString()); return JSON.parse(response.body); };
  const put = (name,rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const reject = async (pending,status,unavailable = false,before = snapshot()) => {
    const response = await pending; assert.equal(response.status,status,response.body.toString()); assert.equal(snapshot(),before);
    if (unavailable) assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const pushBody = (putItems = {},operations = [],deleteItems = {}) => ({
    badges:null,scripts:{},dataTokens:{},checksums:{ before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name => [name,md5(putItems[name] ?? [])])) },
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature:0,trigger:'LotteryDraw',putItems,deleteItems }] : [],
    operations:operations.map(row => ({ id:row.id,verifier:row.token })),
  });
  const push=(...args)=>send('user_data/push',pushBody(...args));
  const applied = result => drawAcknowledgement(result,{},app.store.read('UserCharacter').data,
    app.store.read('UserCharacterCostume').data,app.store.read('UserCommunicationVoice').data).deltas[0]?.putItems ?? {};
  const settledDraw = result => {
    const { operation,operations,...popup }=result;return {...popup,operations:[]};
  };
  const body = progressCount => ({ lotteryId:171000002,buttonIndex:2,consumeAmount:40,pickCount:1,progressCount,
    currentStepIndex:0,isScratch:false,clientChargeHardCurrency:0,clientFreeHardCurrency:app.store.hardCurrency(),
    clientTotalHardCurrency:app.store.hardCurrency() });
  const gift = (id,itemId) => ({ userId:seed.userId,id,itemId,amount:2,title:'Synthetic saved original bond item',message:'',
    senderType:1,senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,
    pcHeroSublimateCount:0,state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0 });
  try {
    crypto.randomInt = (...args) => args.length === 1 ? 0 : random(...args);
    await fresh('regular'); app.store.changeHardCurrency(400);
    const firstBody = body(0), first = parse(await send('lottery/draw',firstBody)), firstIdentity = sequence;
    const pcId = first.UserPC[0].pcId, bondId = master.bonds[pcId], native = applied(first);
    assert.equal(app.store.read('UserPC').data.some(row => row.pcId === pcId),false);
    assert.equal(app.store.read('UserPCJobSet').data.some(row => row.pcId === pcId),false);
    // WRITTEN ONLY / NOT RUN: a native progress save may confirm, but cannot undo the issued paid draw.
    const staleLottery={...first.UserLottery[0],buttons:first.UserLottery[0].buttons.map(row=>
      row.buttonType===2 ? {...row,count:0} : row)};
    await reject(push({UserLottery:[staleLottery]}),400);
    await reject(push({},[],{UserLottery:[{lotteryId:firstBody.lotteryId}]}),400);
    parse(await push({UserLottery:first.UserLottery}));
    for (const edits of [{}, { UserPC:native.UserPC },
      { ...native,UserPC:native.UserPC.map(row => ({ ...row,userId:9 })) },
      { ...native,UserPCJobSet:native.UserPCJobSet.map(row => ({ ...row,userId:9 })) }])
      await reject(push(edits,[first.operation]),400);
    parse(await push({ UserPC:native.UserPC })); await reject(push({},[first.operation]),400);
    await close(); await open(); parse(await push({ UserPCJobSet:native.UserPCJobSet }));
    await reject(push({},[first.operation]),400);
    parse(await push({ UserCharacter:native.UserCharacter }));
    if(native.UserCharacterCostume) {
      await reject(push({},[first.operation]),400);
      parse(await push({UserCharacterCostume:native.UserCharacterCostume,
        ...(native.UserCommunicationVoice ? {UserCommunicationVoice:native.UserCommunicationVoice} : {})}));
    }
    parse(await push({},[first.operation]));
    await reject(push({UserLottery:[staleLottery]}),400);
    await reject(push({},[],{ UserPC:[{ pcId }] }),400);
    await reject(push({},[],{ UserPCJobSet:[{ pcId }] }),400);
    const character = native.UserCharacter[0];
    await reject(push({ UserCharacter:[{ ...character,characterState:1 }] }),400);
    await reject(push({},[],{ UserCharacter:[{ characterId:character.characterId }] }),400);
    const firstSettled=settledDraw(first),settledState=snapshot();
    assert.deepEqual(parse(await request(port,firstIdentity,firstBody,String(firstIdentity),'lottery/draw')),firstSettled);
    assert.equal(snapshot(),settledState,'Acknowledged draw replay cannot charge, grant or reopen its operation');
    app.store.beginSession(); await close(); await open();
    assert.deepEqual(parse(await request(port,firstIdentity,firstBody,String(firstIdentity),'lottery/draw')),firstSettled);
    const firstClaim=app.store.db.prepare('SELECT * FROM lottery_draw_claim WHERE operation_id=?').get(first.operation.id),
      firstTransport=app.store.db.prepare('SELECT * FROM lottery_transport WHERE request_key=?').get(`${firstIdentity}/${firstIdentity}`),
      firstHistory=app.store.db.prepare('SELECT * FROM iris_transaction WHERE id=?').get(firstClaim.iris_history_id);
    app.store.db.prepare('UPDATE lottery_draw_claim SET operation_json=NULL WHERE operation_id=?').run(first.operation.id);
    await reject(request(port,firstIdentity,firstBody,String(firstIdentity),'lottery/draw'),503,true);
    app.store.db.prepare('UPDATE lottery_draw_claim SET operation_json=? WHERE operation_id=?').run(firstClaim.operation_json,first.operation.id);
    app.store.db.prepare('UPDATE lottery_transport SET value_hash=? WHERE request_key=?').run('0'.repeat(32),firstTransport.request_key);
    await reject(request(port,firstIdentity,firstBody,String(firstIdentity),'lottery/draw'),503,true);
    app.store.db.prepare('UPDATE lottery_transport SET value_hash=? WHERE request_key=?').run(firstTransport.value_hash,firstTransport.request_key);
    app.store.db.prepare('DELETE FROM iris_transaction WHERE id=?').run(firstClaim.iris_history_id);
    await reject(request(port,firstIdentity,firstBody,String(firstIdentity),'lottery/draw'),503,true);
    app.store.db.prepare(`INSERT INTO iris_transaction(id,created_at,transaction_type,reason,free_before,paid_before,free_after,paid_after,purchase_key)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(firstHistory.id,firstHistory.created_at,firstHistory.transaction_type,firstHistory.reason,
        firstHistory.free_before,firstHistory.paid_before,firstHistory.free_after,firstHistory.paid_after,firstHistory.purchase_key);
    assert.deepEqual(parse(await request(port,firstIdentity,firstBody,String(firstIdentity),'lottery/draw')),firstSettled);
    await reject(request(port,firstIdentity,{ ...firstBody,lotteryId:42 },String(firstIdentity),'lottery/draw',
      { 'X-ARGO-REQUEST-BODY-HASH':'0'.repeat(32) }),400);
    await reject(request(port,firstIdentity,firstBody,String(firstIdentity),'tutorial/draw'),400);

    const secondBody = body(1), stockBefore = app.store.read('UserLimitBreakItem');
    const second = parse(await send('lottery/draw',secondBody)), secondIdentity = sequence;
    const secondSource=app.store.db.prepare('SELECT body_hash FROM lottery_request WHERE operation_id=?').get(second.operation.id).body_hash;
    app.store.db.prepare('UPDATE lottery_request SET body_hash=? WHERE operation_id=?').run('0'.repeat(32),second.operation.id);
    await reject(request(port,secondIdentity,secondBody,String(secondIdentity),'lottery/draw'),503,true);
    app.store.db.prepare('UPDATE lottery_request SET body_hash=? WHERE operation_id=?').run(secondSource,second.operation.id);
    assert.deepEqual(second.lotteryPCs,[{ pcId,isFirst:false }]); assert.equal(second.UserLimitBreakItem[0].amount,1);
    assert.deepEqual(app.store.read('UserLimitBreakItem'),stockBefore,'No native stock/acquisition/token pre-credit');
    await reject(push({},[second.operation]),400);
    const stock = {...second.UserLimitBreakItem[0],signature:second.operation.signature};
    for (const changes of [{ cumulativeAmount:0 },{ userId:9 },{ amount:-1 },{ amount:2,cumulativeAmount:1 }])
      await reject(push({ UserLimitBreakItem:[{ ...stock,...changes }] },[second.operation]),400);
    const stable = snapshot(); await close(); await open(); assert.equal(snapshot(),stable);
    assert.deepEqual(parse(await request(port,secondIdentity,secondBody,String(secondIdentity),'lottery/draw')),second);
    parse(await push({ UserLimitBreakItem:[stock] }));
    await reject(push({ UserLimitBreakItem:[{ ...stock,cumulativeAmount:0 }] }),400);
    const spent = { ...stock,amount:0 };
    //WRITTEN ONLY: save replies suppress applied bonds; cold/hot recovery uses actual observed stock without regranting it.
    assert(!parse(await push({ UserLimitBreakItem:[spent] })).operations.some(row=>row.id===second.operation.id));
    const originalQueue=app.store.operations(),retainedStock=app.store.read('UserLimitBreakItem'),
      observedReceipt=app.store.db.prepare('SELECT * FROM lottery_bond_claim WHERE operation_id=?').get(second.operation.id),
      retainedWallet=app.store.hardCurrency(),beforeRecovery=snapshot(),
      recovered=app.store.lotteryRecovery(second.operation);
    assert.deepEqual(recovered.parameters.UserLimitBreakItem,[{...second.UserLimitBreakItem[0],amount:0}]);
    assert.deepEqual(app.store.lotteryRecovery(second.operation,recovered),recovered);
    assert.equal(snapshot(),beforeRecovery,'Projection never writes native stock, observations, queue or ACK');
    assert.equal(recovered.id,second.operation.id);assert.equal(recovered.token,second.operation.token);
    assert.equal(recovered.signature,second.operation.signature);
    for(const edits of [{amount:-1},{amount:2},{amount:0,cumulativeAmount:0},{amount:0,signature:second.operation.signature},
      {amount:0,userId:9},{amount:0,reservedAmount:0}]) {
      const forged={...recovered,parameters:{...recovered.parameters,
        UserLimitBreakItem:[{...recovered.parameters.UserLimitBreakItem[0],...edits}]}};
      assert.throws(()=>app.store.lotteryRecovery(second.operation,forged),/envelope differs/);
      assert.equal(snapshot(),beforeRecovery);
    }
    parse(await send('user/login'));
    const confirmed=parse(await send('user_data/confirm')).operations.find(row=>row.id===second.operation.id);
    assert.deepEqual(confirmed,recovered);
    const hotRecovery=parse(await request(port,secondIdentity,secondBody,String(secondIdentity),'lottery/draw'));
    assert.deepEqual(hotRecovery.operation,recovered);assert.deepEqual(hotRecovery.operations,[recovered]);
    assert.deepEqual(hotRecovery.UserLimitBreakItem,recovered.parameters.UserLimitBreakItem);
    assert.deepEqual(app.store.operations(),originalQueue);assert.deepEqual(app.store.read('UserLimitBreakItem'),retainedStock);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM lottery_bond_claim WHERE operation_id=?').get(second.operation.id),observedReceipt);
    assert.equal(app.store.hardCurrency(),retainedWallet);
    for(const [table,event] of [['lottery_bond_floor','INSERT'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_recovery_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'recovered bond ACK rollback'); END`);
      await reject(push({UserLimitBreakItem:[spent]},[second.operation]),503);
      app.store.db.exec('DROP TRIGGER fail_recovery_ack');
    }
    parse(await push({ UserLimitBreakItem:[spent] },[second.operation]));
    assert.deepEqual(parse(await request(port,secondIdentity,secondBody,String(secondIdentity),'lottery/draw')),settledDraw(second));
    await reject(push({ UserLimitBreakItem:[{ ...spent,cumulativeAmount:0 }] }),400);
    await reject(push({},[],{ UserLimitBreakItem:[{ limitBreakItemId:bondId }] }),400);
    const twice = app.store.issueDraw([pcId,pcId]);
    assert.deepEqual(twice.parameters.UserLimitBreakItem.map(row => [row.amount,row.cumulativeAmount]),[[2,3]]);
    assert.equal(app.store.read('UserLimitBreakItem').data.find(row => row.limitBreakItemId === bondId).amount,0);
    parse(await push(applied(twice),[twice.operation]));
    //WRITTEN ONLY: observing one duplicate bond must not suppress a still-uninitialized different unit.
    const otherPcId=Object.keys(master.pcProfiles).map(Number).find(id=>id!==pcId && master.bonds[id] &&
      !app.store.read('UserPC').data.some(row=>row.pcId===id)),mixed=app.store.issueDraw([pcId,otherPcId]),
      mixedBond={...mixed.parameters.UserLimitBreakItem[0],signature:mixed.operation.signature};
    parse(await push({UserLimitBreakItem:[mixedBond]}));
    const mixedSpent={...mixedBond,amount:1};parse(await push({UserLimitBreakItem:[mixedSpent]}));
    const mixedReceipt=app.store.db.prepare('SELECT * FROM lottery_bond_claim WHERE operation_id=?').get(mixed.operation.id),
      mixedSnapshot=snapshot(),mixedRecovery=app.store.lotteryRecovery(mixed.operation);
    assert.equal(snapshot(),mixedSnapshot);assert.equal(mixedRecovery.parameters.UserLimitBreakItem[0].amount,1);
    assert.deepEqual(mixedRecovery.parameters.UserPC,mixed.parameters.UserPC);
    assert.deepEqual(mixedRecovery.parameters.lotteryPCs,mixed.parameters.lotteryPCs);
    assert(!app.store.read('UserPC').data.some(row=>row.pcId===otherPcId),'Recovery cannot pre-initialize its remaining unit');
    assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===mixed.operation.id),mixedRecovery);
    await reject(push({},[mixed.operation]),400);
    await reject(push({UserLimitBreakItem:[{...mixedSpent,amount:2}]}),400);
    app.store.db.prepare('UPDATE lottery_bond_claim SET stock_state=?,effect_saved=0 WHERE operation_id=?')
      .run(JSON.stringify({...JSON.parse(mixedReceipt.stock_state),observed:false}),mixed.operation.id);
    await reject(send('user/login'),503,true);
    app.store.db.prepare('UPDATE lottery_bond_claim SET stock_state=?,effect_saved=? WHERE operation_id=?')
      .run(mixedReceipt.stock_state,mixedReceipt.effect_saved,mixed.operation.id);
    const mixedApplied={...applied(mixed),UserLimitBreakItem:[mixedSpent]};
    parse(await push(mixedApplied,[mixed.operation]));
    assert.deepEqual(app.store.operations(),[]);
    assert.equal(app.store.read('UserLimitBreakItem').data.find(row=>row.limitBreakItemId===bondId).amount,1);
    assert(app.store.read('UserPC').data.some(row=>row.pcId===otherPcId));
    //WRITTEN ONLY: one observed/spent setter is projected; a different untouched setter keeps its full original target.
    const paired=app.store.issueDraw([pcId,otherPcId]),otherBondId=master.bonds[otherPcId],
      firstPaired={...paired.parameters.UserLimitBreakItem.find(row=>row.limitBreakItemId===bondId),signature:paired.operation.signature};
    parse(await push({UserLimitBreakItem:[firstPaired]}));
    const firstPairedSpent={...firstPaired,amount:0};parse(await push({UserLimitBreakItem:[firstPairedSpent]}));
    const pairedBefore=snapshot(),pairedRecovery=app.store.lotteryRecovery(paired.operation),
      untouched=paired.parameters.UserLimitBreakItem.find(row=>row.limitBreakItemId===otherBondId);
    assert.equal(snapshot(),pairedBefore);
    assert.equal(pairedRecovery.parameters.UserLimitBreakItem.find(row=>row.limitBreakItemId===bondId).amount,0);
    assert.deepEqual(pairedRecovery.parameters.UserLimitBreakItem.find(row=>row.limitBreakItemId===otherBondId),untouched);
    assert(!app.store.read('UserLimitBreakItem').data.some(row=>row.limitBreakItemId===otherBondId));
    const forgedPaired={...pairedRecovery,parameters:{...pairedRecovery.parameters,
      UserLimitBreakItem:pairedRecovery.parameters.UserLimitBreakItem.map(row=>row.limitBreakItemId===otherBondId?{...row,amount:0}:row)}};
    assert.throws(()=>app.store.lotteryRecovery(paired.operation,forgedPaired),/envelope differs/);
    assert.equal(snapshot(),pairedBefore);
    assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===paired.operation.id),pairedRecovery);
    await reject(push({},[paired.operation]),400);
    const otherNative={...untouched,signature:paired.operation.signature};
    for(const [table,event] of [['profile','UPDATE OF data'],['lottery_bond_claim','UPDATE OF stock_state'],
      ['lottery_bond_floor','INSERT'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_paired_recovery BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'paired recovery rollback'); END`);
      await reject(push({UserLimitBreakItem:[firstPairedSpent,otherNative]},[paired.operation]),503);
      app.store.db.exec('DROP TRIGGER fail_paired_recovery');
    }
    parse(await push({UserLimitBreakItem:[firstPairedSpent,otherNative]},[paired.operation]));
    assert.deepEqual(app.store.operations(),[]);
    assert.equal(app.store.read('UserLimitBreakItem').data.find(row=>row.limitBreakItemId===bondId).amount,0);
    assert.equal(app.store.read('UserLimitBreakItem').data.find(row=>row.limitBreakItemId===otherBondId).amount,untouched.amount);
    const oldBond = app.store.read('UserLimitBreakItem').data.find(row => row.limitBreakItemId === bondId);
    for (const changes of [{ userId:9 },{ amount:2,cumulativeAmount:1 },
      {signature:undefined},{signature:0x100000000},{signature:'0'},{bookEntryState:256},{reservedAmount:0},
      {lastResetAt:0},{dateList:[]}]) {
      put('UserLimitBreakItem',[{ ...oldBond,...changes }]); const before = snapshot();
      assert.throws(() => app.store.issueDraw([pcId]),/Invalid saved bond/); assert.equal(snapshot(),before);
    }
    put('UserLimitBreakItem',[oldBond]);

    //WRITTEN ONLY / NOT RUN: native full-row lottery targets retain UInt8 book/UInt32 signature without adding reserved fields.
    const wideBond={...oldBond,bookEntryState:255,signature:0xffffffff};put('UserLimitBreakItem',[wideBond]);
    const wideDraw=app.store.issueDraw([pcId]),wideParameters=JSON.stringify(wideDraw.parameters),
      malformedParameters=JSON.stringify({...wideDraw.parameters,
        UserLimitBreakItem:wideDraw.parameters.UserLimitBreakItem.map(row=>({...row,reservedAmount:0}))});
    assert.deepEqual(wideDraw.parameters.UserLimitBreakItem,[{...wideBond,amount:wideBond.amount+1,cumulativeAmount:wideBond.cumulativeAmount+1}]);
    app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(malformedParameters,wideDraw.operation.id);
    app.store.db.prepare('UPDATE lottery_draw_claim SET parameters=? WHERE operation_id=?').run(malformedParameters,wideDraw.operation.id);
    await reject(send('user/login'),503,true);
    app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(wideParameters,wideDraw.operation.id);
    app.store.db.prepare('UPDATE lottery_draw_claim SET parameters=? WHERE operation_id=?').run(wideParameters,wideDraw.operation.id);
    parse(await push(applied(wideDraw),[wideDraw.operation]));await close();await open();
    assert.deepEqual(app.store.read('UserLimitBreakItem').data,[{...wideDraw.parameters.UserLimitBreakItem[0],signature:wideDraw.operation.signature}]);
    assert.deepEqual(app.store.operations(),[]);

    // A native character state can save BEFORE its unit and owned boards.
    // Interrupted callbacks must not skip/repeat that first-acquisition effect.
    for (const absent of [false,true]) {
      await fresh(`character-first-${absent}`); app.store.changeHardCurrency(400);
      // This fixture exercises the original lazy state1-to2 acquisition path,
      // not the seed's already joined character (whose callback has no effect).
      put('UserCharacter',absent
        ? seed.data.UserCharacter.filter(row => row.characterId !== character.characterId)
        : seed.data.UserCharacter.map(row => row.characterId === character.characterId ? { ...row,characterState:1 } : row));
      const before = app.store.read('UserCharacter'), value = body(0), result = parse(await send('lottery/draw',value)), identity = sequence,
        puts = applied(result), savedCharacter = puts.UserCharacter[0];
      assert.deepEqual(app.store.read('UserCharacter'),before,'Draw issuance must not pre-credit character state');
      const original = app.store.db.prepare('SELECT pc_targets FROM lottery_draw_claim WHERE operation_id=?').get(result.operation.id).pc_targets,
        targets = JSON.parse(original), legacy = structuredClone(targets);
      assert.equal(targets[0].target.character.beforeState,1);
      assert.equal(targets[0].target.character.state,2);
      delete legacy[0].target.character;
      app.store.db.prepare('UPDATE lottery_draw_claim SET pc_targets=? WHERE operation_id=?').run(JSON.stringify(legacy),result.operation.id);
      await reject(send('user/login'),503,true); await reject(push(puts,[result.operation]),503,true);
      assert.deepEqual(app.store.operations(),[result.operation]);
      app.store.db.prepare('UPDATE lottery_draw_claim SET pc_targets=? WHERE operation_id=?').run(original,result.operation.id);
      for (const changes of [{ userId:9 },{ characterState:'2' },{ friendship:-1 }])
        await reject(push({ UserCharacter:[{ ...savedCharacter,...changes }] }),400);
      assert(!parse(await push({ UserCharacter:[savedCharacter] })).operations.some(row => row.id === result.operation.id));
      await reject(push({},[result.operation]),400);
      await reject(push({ UserCharacter:[{ ...savedCharacter,characterState:1 }] }),400);
      await reject(push({},[],{ UserCharacter:[{ characterId:savedCharacter.characterId }] }),400);
      await close(); await open();
      const originalQueue=app.store.operations(),nativeUnits=app.store.read('UserPC'),nativeBoards=app.store.read('UserPCJobSet'),
        nativeCharacter=app.store.read('UserCharacter'),wallet=app.store.hardCurrency(),beforeRecovery=snapshot();
      assert.deepEqual(app.store.lotteryRecovery(result.operation),result.operation);
      assert.equal(snapshot(),beforeRecovery);
      parse(await send('user/login'));
      assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===result.operation.id),result.operation);
      assert.deepEqual(parse(await request(port,identity,value,String(identity),'lottery/draw')),result);
      assert.deepEqual(app.store.operations(),originalQueue);assert.deepEqual(app.store.read('UserPC'),nativeUnits);
      assert.deepEqual(app.store.read('UserPCJobSet'),nativeBoards);assert.deepEqual(app.store.read('UserCharacter'),nativeCharacter);
      assert.equal(app.store.hardCurrency(),wallet);
      const {UserCharacter,...remainingAcquisition}=puts;
      parse(await push(remainingAcquisition,[result.operation]));
      await close(); await open();
      await reject(push({ UserCharacter:[{ ...savedCharacter,characterState:1 }] }),400);
      const duplicate = app.store.issueDraw([result.UserPC[0].pcId]);
      assert.equal(JSON.parse(app.store.db.prepare('SELECT pc_targets FROM lottery_draw_claim WHERE operation_id=?')
        .get(duplicate.operation.id).pc_targets)[0].target.character,undefined,'Duplicate PC has no new-character branch');
      parse(await push(applied(duplicate),[duplicate.operation]));
      await reject(push({},[],{ UserCharacter:[{ characterId:savedCharacter.characterId }] }),400);
    }

    // An absolute bond setter and an additive present cannot overlap in either
    // issue order, even if one effect was already saved without its ACK.
    for (const giftFirst of [true,false]) {
      await fresh(`ordering-${giftFirst}`);
      const init = app.store.issueDraw([pcId]); parse(await push(applied(init),[init.operation]));
      const savedGift = gift(1,bondId); put('UserGift',[savedGift]);
      const receive = () => send('gift/receive',{ userId:seed.userId,giftIds:[1] });
      if (giftFirst) {
        const present = parse(await receive()).operations[0], before = snapshot();
        assert.throws(() => app.store.issueDraw([pcId]),/additive item reward/); assert.equal(snapshot(),before);
        const bond = { userId:seed.userId,limitBreakItemId:bondId,amount:2,cumulativeAmount:2,bookEntryState:3,signature:0 };
        parse(await push({ UserLimitBreakItem:[bond],UserGift:[{ ...savedGift,state:1 }] },[present]));
        const draw = app.store.issueDraw([pcId]); assert.equal(draw.parameters.UserLimitBreakItem[0].amount,3);
        parse(await push(applied(draw),[draw.operation]));
      } else {
        const draw = app.store.issueDraw([pcId]); await reject(receive(),400);
        parse(await push(applied(draw))); await reject(receive(),400); parse(await push({},[draw.operation]));
        const present = parse(await receive()).operations[0];
        assert.equal(app.store.giftItemRewards(present)[0].cumulative_amount,3);
      }
    }

    await fresh('tutorial');
    const tutorialBody = { lotteryId:1,pcId:1011002001 };
    const tutorial = parse(await send('tutorial/draw',tutorialBody)), tutorialIdentity = sequence;
    assert.equal(tutorial.operation.type,1001);
    const tutorialSource=app.store.db.prepare('SELECT body_hash FROM lottery_request WHERE operation_id=?').get(tutorial.operation.id).body_hash;
    app.store.db.prepare('UPDATE lottery_request SET body_hash=? WHERE operation_id=?').run('0'.repeat(32),tutorial.operation.id);
    await reject(request(port,tutorialIdentity,tutorialBody,String(tutorialIdentity),'tutorial/draw'),503,true);
    app.store.db.prepare('UPDATE lottery_request SET body_hash=? WHERE operation_id=?').run(tutorialSource,tutorial.operation.id);
    await reject(push(applied(tutorial),[tutorial.operation]),400); // Unit alone is not completion.
    const flag = { userId:seed.userId,tutorialId:780030005,isEnd:true };
    parse(await push(applied(tutorial))); parse(await push({ UserTutorial:[flag] },[tutorial.operation]));
    await reject(push({ UserTutorial:[{ ...flag,isEnd:false }] }),400);
    await reject(push({},[],{ UserTutorial:[{ tutorialId:flag.tutorialId }] }),400);
    assert.deepEqual(parse(await request(port,tutorialIdentity,tutorialBody,String(tutorialIdentity),'tutorial/draw')),
      settledDraw(tutorial));
    await reject(send('tutorial/draw',tutorialBody),400);

    await fresh('rollback'); app.store.changeHardCurrency(400);
    for (const table of ['iris_transaction','operation_queue','lottery_draw_claim','lottery_transport','lottery_request','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_draw BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'draw rollback'); END`);
      await reject(send('lottery/draw',body(0)),503); app.store.db.exec('DROP TRIGGER fail_draw');
    }
    const award = parse(await send('lottery/draw',body(0)));
    for (const table of ['gift_pc_floor','operation_done']) {
      app.store.db.exec(`CREATE TRIGGER fail_ack BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'draw ack rollback'); END`);
      await reject(push(applied(award),[award.operation]),503); app.store.db.exec('DROP TRIGGER fail_ack');
    }
    const beforeReceipt = app.store.db.prepare('SELECT * FROM lottery_draw_claim').get();
    app.store.db.prepare('DELETE FROM lottery_draw_claim').run();
    await reject(send('user/login',undefined),503,true); await reject(push(applied(award),[award.operation]),503,true);
    assert.equal(app.store.operations()[0].id,award.operation.id);
    app.store.db.prepare(`INSERT INTO lottery_draw_claim(operation_id,type,parameters,pc_targets,operation_json,iris_history_id)
      VALUES(?,?,?,?,?,?)`).run(beforeReceipt.operation_id,beforeReceipt.type,beforeReceipt.parameters,beforeReceipt.pc_targets,
        beforeReceipt.operation_json,beforeReceipt.iris_history_id);
    parse(await push(applied(award),[award.operation]));
    const bondDraw = app.store.issueDraw([award.UserPC[0].pcId]);
    const bondReceipt = app.store.db.prepare('SELECT * FROM lottery_bond_claim').get();
    app.store.db.prepare('UPDATE lottery_bond_claim SET amount=amount+1').run();
    await reject(send('user/login',undefined),503,true); await reject(push(applied(bondDraw),[bondDraw.operation]),503,true);
    app.store.db.prepare('UPDATE lottery_bond_claim SET amount=?').run(bondReceipt.amount);
    app.store.db.exec("CREATE TRIGGER fail_bond_floor BEFORE INSERT ON lottery_bond_floor BEGIN SELECT RAISE(ABORT,'bond floor rollback'); END");
    await reject(push(applied(bondDraw),[bondDraw.operation]),503); app.store.db.exec('DROP TRIGGER fail_bond_floor');
    parse(await push(applied(bondDraw),[bondDraw.operation]));
    app.store.db.exec("CREATE TRIGGER fail_bond BEFORE INSERT ON lottery_bond_claim BEGIN SELECT RAISE(ABORT,'bond rollback'); END");
    const before = snapshot(); assert.throws(() => app.store.issueDraw([award.UserPC[0].pcId]),/bond rollback/);
    assert.equal(snapshot(),before); app.store.db.exec('DROP TRIGGER fail_bond');

    //WRITTEN ONLY / NOT RUN: native absolute stock, actual-operation signature and lifetime-only actual stock difference.
    const capBaselines=[{amount:7,cumulativeAmount:10},{amount:0,cumulativeAmount:999999998},{amount:7,cumulativeAmount:999999998},
      {amount:7,cumulativeAmount:999999999},{amount:999999998,cumulativeAmount:999999998},
      {amount:999999998,cumulativeAmount:999999999},{amount:999999999,cumulativeAmount:999999999}];
    for(const [baselineIndex,counters] of capBaselines.entries()) for(const [type,count] of [[1000,1],[1000,11],[1001,1]])
      for(const order of ['stock-first','signature-first','cumulative-first','together','spent-first','spent-before-signature']) {
        await fresh(`absolute-cap-${baselineIndex}-${type}-${count}-${order}`);
        const capPc=1011002001,capId=master.bonds[capPc],initial=app.store.issueDraw([capPc]);
        parse(await push(applied(initial),[initial.operation]));
        const baseline={userId:seed.userId,limitBreakItemId:capId,bookEntryState:255,
          signature:order==='signature-first'?0xffffffff:0x7fffffff,...counters};
        put('UserLimitBreakItem',[baseline]);
        const beforeIssue=snapshot();
        for(const table of ['operation_queue','lottery_draw_claim','lottery_bond_claim']) {
          app.store.db.exec(`CREATE TRIGGER fail_absolute_issue BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'absolute cap issue rollback'); END`);
          assert.throws(()=>app.store.issueDraw(Array(count).fill(capPc),{},type),/absolute cap issue rollback/);
          assert.equal(snapshot(),beforeIssue);app.store.db.exec('DROP TRIGGER fail_absolute_issue');
        }
        const originalRoll=crypto.randomInt;let issued;
        try {crypto.randomInt=()=>baseline.signature===0xffffffff?1:baseline.signature;
          issued=app.store.issueDraw(Array(count).fill(capPc),{},type);} finally {crypto.randomInt=originalRoll;}
        const op=issued.operation,wire=issued.parameters.UserLimitBreakItem[0],amount=Math.min(999999999,baseline.amount+count),
          cumulativeAmount=Math.min(999999999,baseline.cumulativeAmount+amount-baseline.amount),
          target={...baseline,amount,cumulativeAmount,signature:op.signature},
          claim=app.store.db.prepare('SELECT * FROM lottery_bond_claim WHERE operation_id=?').get(op.id),
          capture=JSON.parse(claim.stock_state),delta=amount-baseline.amount;
        assert.equal(op.signature,1);assert.deepEqual(wire,{...baseline,amount,cumulativeAmount});
        assert.deepEqual(app.store.read('UserLimitBreakItem').data,[baseline],'Draw must not precredit native stock, lifetime or signature');
        assert.deepEqual(capture,{policy:'offline-lottery-bond-stock-v1',beforeSignature:baseline.signature,signature:op.signature,
          amountAdded:0,observed:false,effect:false});
        //WRITTEN ONLY / NOT RUN: spending before any absolute-setter field is saved cannot be mistaken for a partial draw effect.
        if(baseline.amount>0) {
          const receiptBeforeSpend=app.store.db.prepare('SELECT * FROM lottery_bond_claim WHERE operation_id=?').get(op.id);
          await reject(push({UserLimitBreakItem:[{...baseline,amount:baseline.amount-1}]}),400);
          assert.deepEqual(app.store.read('UserLimitBreakItem').data,[baseline]);
          assert.deepEqual(app.store.db.prepare('SELECT * FROM lottery_bond_claim WHERE operation_id=?').get(op.id),receiptBeforeSpend);
        }
        for(const change of [{stock_state:null},{stock_state:'{'},{effect_saved:1},...[
          {policy:'offline-gift-stock-cap-v1'},{beforeSignature:op.signature},{signature:baseline.signature},
          {amountAdded:delta+1},{observed:true},{effect:true,observed:true},
        ].map(value=>({stock_state:JSON.stringify({...capture,...value})}))]) {
          app.store.db.prepare(`UPDATE lottery_bond_claim SET ${Object.keys(change).map(key=>`${key}=?`).join(',')} WHERE operation_id=?`)
            .run(...Object.values(change),op.id);
          await reject(send('user/login'),503,true);await reject(push({},[op]),503,true);
          app.store.db.prepare('UPDATE lottery_bond_claim SET stock_state=?,effect_saved=0 WHERE operation_id=?').run(claim.stock_state,op.id);
        }
        await reject(push({},[op]),400);
        await reject(push({UserLimitBreakItem:[wire]},[op]),400);
        for(const edits of [{amount:amount+1},{cumulativeAmount:cumulativeAmount-1},{signature:baseline.signature},
          {signature:0x100000000},{reservedAmount:0},{userId:9}])
          await reject(push({UserLimitBreakItem:[{...target,...edits}]},[op]),400);
        const full={UserLimitBreakItem:[target],...(type===1001?{UserTutorial:[{userId:seed.userId,tutorialId:780030005,isEnd:true}]}:{})};
        if(order!=='together') {
          let partial=order==='stock-first'?{...baseline,amount}:order==='signature-first'?{...baseline,signature:op.signature}:
            order==='cumulative-first'?{...baseline,cumulativeAmount}:order==='spent-first'?{...target,amount:0}:
            {...baseline,amount:0,cumulativeAmount};
          //A stock-only synthetic prefix can exceed lifetime; native saved rows must retain amount<=cumulativeAmount.
          if(partial.amount>partial.cumulativeAmount) {
            await reject(push({UserLimitBreakItem:[partial]}),400);partial={...partial,cumulativeAmount};
          }
          for(const [table,event] of [['profile','UPDATE OF data'],['lottery_bond_claim','UPDATE OF stock_state'],['reply_cache','INSERT']]) {
            if(JSON.stringify(partial)===JSON.stringify(baseline) && table==='lottery_bond_claim') continue;
            app.store.db.exec(`CREATE TRIGGER fail_absolute_partial BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'absolute cap partial rollback'); END`);
            await reject(push({UserLimitBreakItem:[partial]}),503);app.store.db.exec('DROP TRIGGER fail_absolute_partial');
          }
          const response=parse(await push({UserLimitBreakItem:[partial]})),state=JSON.parse(app.store.db.prepare('SELECT stock_state FROM lottery_bond_claim WHERE operation_id=?').get(op.id).stock_state);
          assert.equal(state.amountAdded,Math.max(0,partial.amount-baseline.amount));
          if(state.effect) assert(!response.operations.some(row=>row.id===op.id));
          await close();await open();assert.equal(app.store.operations()[0].id,op.id);
          if(!state.observed && state.effect && (partial.amount!==amount || partial.cumulativeAmount!==cumulativeAmount || partial.signature!==op.signature))
            await reject(send('user/login'),503,true);
          if(state.observed) {
            const retained=snapshot(),projected=app.store.lotteryRecovery(op);
            assert.equal(projected.parameters.UserLimitBreakItem[0].amount,partial.amount);
            assert.equal(snapshot(),retained);
            parse(await send('user/login'));
            assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===op.id),projected);
          }
          if(state.observed) await reject(push({UserLimitBreakItem:[{...partial,amount:partial.amount+1}]}),400);
          full.UserLimitBreakItem=[order==='spent-first'||order==='spent-before-signature'?{...target,amount:0}:target];
        }
        for(const [table,event] of [['lottery_bond_claim','UPDATE'],['lottery_bond_floor','INSERT'],['operation_done','INSERT'],
          ['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          const already=JSON.parse(app.store.db.prepare('SELECT stock_state FROM lottery_bond_claim WHERE operation_id=?').get(op.id).stock_state);
          if(already.observed && table==='lottery_bond_claim') continue;
          app.store.db.exec(`CREATE TRIGGER fail_absolute_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'absolute cap ACK rollback'); END`);
          await reject(push(full,[op]),503);app.store.db.exec('DROP TRIGGER fail_absolute_ack');
        }
        const ackWire=pushBody(full,[op]),ackResponse=await send('user_data/push',ackWire),ackIdentity=sequence;
        parse(ackResponse);await close();await open();assert.deepEqual(app.store.operations(),[]);
        const retained=snapshot();assert.deepEqual((await request(port,ackIdentity,ackWire,String(ackIdentity),'user_data/push')).body,ackResponse.body);
        assert.equal(snapshot(),retained,'Exact cold acknowledgement cannot add bonds or reopen their allowance');
        assert.equal(app.store.db.prepare('SELECT effect_saved FROM lottery_bond_claim WHERE operation_id=?').get(op.id).effect_saved,1);
        const saved=app.store.read('UserLimitBreakItem').data[0];assert.equal(saved.signature,op.signature);assert.equal(saved.cumulativeAmount,cumulativeAmount);
        parse(await push({UserLimitBreakItem:[{...saved,amount:0}]}));
        if(cumulativeAmount===999999999) await reject(push({UserLimitBreakItem:[{...saved,amount:1}]}),400);
        await reject(push({},[],{UserLimitBreakItem:[{limitBreakItemId:capId}]}),400);
        const next=app.store.issueDraw([capPc]);
        assert.deepEqual(next.parameters.UserLimitBreakItem.map(row=>[row.amount,row.cumulativeAmount]),[[1,Math.min(999999999,cumulativeAmount+1)]]);
        parse(await push(applied(next),[next.operation]));
      }

    //WRITTEN ONLY / NOT RUN: a genuinely charged original regular draw must work at full stock/lifetime without reroll/debit replay.
    await fresh('paid-full-bond');app.store.changeHardCurrency(200);
    const paidFirst=parse(await send('lottery/draw',body(0)));parse(await push(applied(paidFirst),[paidFirst.operation]));
    const paidPc=paidFirst.UserPC[0].pcId,paidId=master.bonds[paidPc],paidBaseline={userId:seed.userId,limitBreakItemId:paidId,
      amount:999999999,cumulativeAmount:999999999,signature:0xffffffff,bookEntryState:255};
    put('UserLimitBreakItem',[paidBaseline]);const paidBody=body(1),wallet=app.store.hardCurrency(),
      paidResponse=await send('lottery/draw',paidBody),paidIdentity=sequence,paidDraw=parse(paidResponse);
    assert.deepEqual(paidDraw.lotteryPCs,[{pcId:paidPc,isFirst:false}]);assert.equal(app.store.hardCurrency(),wallet-40);
    assert.deepEqual(paidDraw.UserLimitBreakItem,[paidBaseline]);assert.notEqual(paidDraw.operation.signature,paidBaseline.signature);
    assert.deepEqual((await request(port,paidIdentity,paidBody,String(paidIdentity),'lottery/draw')).body,paidResponse.body);
    assert.equal(app.store.hardCurrency(),wallet-40);assert.deepEqual(app.store.read('UserLimitBreakItem').data,[paidBaseline]);
    await reject(push({UserLimitBreakItem:[paidBaseline]},[paidDraw.operation]),400);
    parse(await push(applied(paidDraw),[paidDraw.operation]));await close();await open();
    assert.equal(app.store.hardCurrency(),wallet-40);assert.equal(app.store.read('UserLimitBreakItem').data[0].signature,paidDraw.operation.signature);
    assert.deepEqual(parse(await request(port,paidIdentity,paidBody,String(paidIdentity),'lottery/draw')),settledDraw(paidDraw));

    //WRITTEN ONLY / NOT RUN: nullable migration preserves an old uncaptured receipt and refuses to infer signature/stock proof.
    await fresh('legacy-absolute-stock');const legacyUnit=app.store.issueDraw([1011002001]);parse(await push(applied(legacyUnit),[legacyUnit.operation]));
    const legacyDraw=app.store.issueDraw([1011002001]),legacyClaim=app.store.db.prepare('SELECT * FROM lottery_bond_claim WHERE operation_id=?').get(legacyDraw.operation.id),
      {stock_state:legacyState,...legacyColumns}=legacyClaim,legacyProfile=app.store.read('UserLimitBreakItem');
    await close();const legacyDb=new (require('node:sqlite').DatabaseSync)(database);
    legacyDb.exec('ALTER TABLE lottery_bond_claim DROP COLUMN stock_state');legacyDb.close();await open();
    const migrated=app.store.db.prepare('SELECT * FROM lottery_bond_claim WHERE operation_id=?').get(legacyDraw.operation.id),
      {stock_state:migratedState,...migratedColumns}=migrated;
    assert.equal(migratedState,null);assert.deepEqual(migratedColumns,legacyColumns);assert.deepEqual(app.store.read('UserLimitBreakItem'),legacyProfile);
    await reject(send('user/login'),503,true);await reject(push(applied(legacyDraw),[legacyDraw.operation]),503,true);
    assert.equal(app.store.operations()[0].id,legacyDraw.operation.id);assert.equal(app.store.db.prepare('SELECT stock_state FROM lottery_bond_claim WHERE operation_id=?').get(legacyDraw.operation.id).stock_state,null);
    app.store.db.prepare('UPDATE lottery_bond_claim SET stock_state=? WHERE operation_id=?').run(legacyState,legacyDraw.operation.id);
    parse(await push(applied(legacyDraw),[legacyDraw.operation]));
    console.log('Synthetic gacha ownership, absolute bonds, tutorial flags, transport and save/ACK persistence: OK; NOT native acceptance');
  } finally { crypto.randomInt = random; await close(); fs.rmSync(directory,{ recursive:true,force:true }); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
