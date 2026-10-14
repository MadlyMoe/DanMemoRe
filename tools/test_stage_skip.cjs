'use strict';

// Deferred synthetic save/ACK case. Do not run before packet implementation is complete.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer}=require('./danmemore_server.cjs');
const {request,stageXpFixture}=require('./test_danmemore_server.cjs');
const original=require('../data/danmemore-seed.json');
const master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const at=1790866800,seed=structuredClone(original),stageId=1010000101101,
    stage=seed.data.UserAdventureStage.find(row=>row.adventureStageId===stageId),
    directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-stage-skip-')),
    database=path.join(directory,'profile.sqlite');
  Object.assign(stage,{state:4,cumulativeClearCount:1,dailyClearCount:1,
    firstCompleteDateTime:at-100,lastCompleteDateTime:at-100});
  seed.data.UserSkipTicket=[288000001,288000002].map((skipTicketId,index)=>({
    userId:seed.userId,skipTicketId,amount:1,cumulativeAmount:1,reservedAmount:0,
    bookEntryState:index?1:3,signature:index?0xffffffff:0x80000000,lastResetAt:index?at:at-86400
  }));
  const app=createServer({database,seed,master,wallNowSeconds:()=>at});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const port=app.server.address().port;
  let overlapApp,overlapDelayedApp,overlapAtomicApp,bareApp,lateApp,capApp,resetApp,coalescedApp,optionalApp,zeroApp,zeroTicketFirstApp,paidApp,paidTicketOnlyApp,paidSpOnlyApp,paidSubcapApp,paidDueApp,paidCapApp,paidOvercapApp,paidDelayedApp,paidLaterCapApp,paidTwoPhaseApp,paidRepeatedApp,paidAtomicTickApp,paidAtomicCapApp;
  let sequence=0;
  const send=(action,body)=>request(port,++sequence,body,String(sequence),action);
  const push=(putItems={},operations=[])=>{
    putItems=stageXpFixture(app.store,putItems,operations);
    return send('user_data/push',{badges:null,scripts:{},dataTokens:{},
      checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
      deltas:Object.keys(putItems).length?[{signature:0,trigger:'AdventureComplete',putItems,deleteItems:{}}]:[],
      operations:operations.map(row=>({id:row.id,verifier:row.token}))});
  };
  try {
    const body={adventureStageId:stageId,token:'owned-skip-debit',skipCount:1,
      adventureStageTaskIds:[],adventureGainedItems:[],friendshipStates:[],
      adventureRecord:{continueCount:0,deathCount:0,turnCount:3},
      isEnemyAnnihilated:true,secretMissionCompleted:false};
    const result=await send('adventure/stage/complete',body);
    assert.equal(result.status,200,result.body.toString());
    const operation=JSON.parse(result.body).operation,
      capture=JSON.parse(app.store.db.prepare('SELECT capture_json FROM stage_skip_claim WHERE operation_id=?')
        .get(operation.id).capture_json);
    assert.equal(capture.charge,1);
    assert.equal(capture.spBefore,20);
    assert.equal(capture.spClock.savedSP,20);
    assert.equal(capture.spClock.maxSP,20);
    assert.equal(capture.reset.optional,true,'Saved stock also permits the no-reset callback');
    const spent=seed.data.UserSkipTicket.map(row=>({...row,
      amount:row.skipTicketId===288000001?0:1,signature:operation.signature,
      bookEntryState:row.bookEntryState===1?3:row.bookEntryState}));
    assert.equal((await push({UserSkipTicket:spent})).status,200);
    assert.equal((await push({},[operation])).status,400,'Ticket-only save cannot ACK an unpaid SP/clear');
    const clockOnly=app.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,
      baseSPUpdatedAt:at}}));
    assert.equal((await push({UserInfo:clockOnly})).status,200,
      'The native full-to-spent callback saves its timestamp before the SP debit');
    assert.equal((await push({UserInfo:clockOnly.map(row=>({...row,playerStatus:{...row.playerStatus,
      baseSPUpdatedAt:at+1}}))})).status,400,'A future skip timestamp cannot be saved');
    const before=operation.parameters.UserAdventureStage[0],savedStage={...before,
      state:4,cumulativeClearCount:before.cumulativeClearCount+1,
      dailyClearCount:before.dailyClearCount+1,lastCompleteDateTime:at};
    const xp=app.store.db.prepare('SELECT minimum_exp FROM stage_xp_claim WHERE operation_id=?').get(operation.id);
    const info=app.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,
      baseSP:capture.spBefore-capture.charge,totalExp:xp.minimum_exp,
      level:master.playerLevels.findLast(([,threshold])=>threshold<=xp.minimum_exp)[0]}}));
    assert.equal((await push({UserInfo:info,UserAdventureStage:app.store.read('UserAdventureStage').data
      .map(row=>row.adventureStageId===stageId?savedStage:row)},[operation])).status,200);
    assert(app.store.db.prepare('SELECT id FROM operation_done WHERE id=?').get(operation.id));
    assert.equal(app.store.db.prepare('SELECT 1 FROM stage_skip_daily_reset WHERE user_id=?')
      .get(seed.userId),undefined,'A no-reset skip must not checkpoint an unused daily reset');
    assert.equal(app.store.db.prepare('SELECT amount FROM stage_skip_stock_floor WHERE skip_ticket_id=?')
      .get(288000001).amount,0);
    const savedDelivery=app.store.db.prepare('SELECT operation_json FROM stage_delivery WHERE operation_id=?')
      .get(operation.id).operation_json;
    const wrongDelivery=JSON.parse(savedDelivery);
    wrongDelivery.parameters.skipCount=2;
    app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?')
      .run(JSON.stringify(wrongDelivery),operation.id);
    assert.throws(()=>app.store.read('UserSkipTicket'),/Settled skip-ticket source/,
      'A completed operation cannot lend its ticket floor to a different skip debit');
    app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?')
      .run(savedDelivery,operation.id);
    app.store.db.prepare('UPDATE stage_skip_stock_floor SET amount=1 WHERE skip_ticket_id=?')
      .run(288000001);
    assert.throws(()=>app.store.read('UserSkipTicket'),/Settled skip-ticket stock differs/,
      'A settled ticket floor must equal the actual ordinary-first debit');
    app.store.db.prepare('UPDATE stage_skip_stock_floor SET amount=0 WHERE skip_ticket_id=?')
      .run(288000001);
    const restored=spent.map(row=>row.skipTicketId===288000001?{...row,amount:1}:row);
    assert.equal((await push({UserSkipTicket:restored})).status,400,
      'A later save cannot restore the consumed ticket without a new acquisition');
    assert.deepEqual(app.store.read('UserSkipTicket').data,spent);

    overlapApp=createServer({database:path.join(directory,'paid-skip-followed-by-refill.sqlite'),
      seed:structuredClone(seed),master,wallNowSeconds:()=>at});
    await new Promise(resolve=>overlapApp.server.listen(0,'127.0.0.1',resolve));
    overlapApp.store.changeHardCurrency(10);
    const overlapPort=overlapApp.server.address().port,
      overlapResult=await request(overlapPort,1,{...body,token:'paid-skip-before-refill'},'1','adventure/stage/complete');
    assert.equal(overlapResult.status,200,overlapResult.body.toString());
    const overlapOperation=JSON.parse(overlapResult.body).operation,
      overlapSkip=JSON.parse(overlapApp.store.db.prepare('SELECT capture_json FROM stage_skip_claim WHERE operation_id=?')
        .get(overlapOperation.id).capture_json),
      refillResult=await request(overlapPort,2,{consumeId:81041001},'2','currency/hard/consume');
    assert.equal(refillResult.status,200,refillResult.body.toString());
    const refillOperation=JSON.parse(refillResult.body).operation,
      refillReceipt=overlapApp.store.db.prepare('SELECT * FROM hard_currency_consume WHERE operation_id=?')
        .get(refillOperation.id),
      overlapXp=overlapApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?').get(overlapOperation.id);
    assert.equal(refillReceipt.sp_before,overlapSkip.spBefore-overlapSkip.charge,
      'A later refill reserves from the earlier pending signed skip debit');
    const overlapTickets=seed.data.UserSkipTicket.map(row=>({...row,
        amount:row.skipTicketId===288000001?0:row.amount,signature:overlapOperation.signature,
        bookEntryState:row.bookEntryState===1?3:row.bookEntryState})),
      overlapBefore=overlapOperation.parameters.UserAdventureStage[0],
      overlapStage={...overlapBefore,state:4,cumulativeClearCount:overlapBefore.cumulativeClearCount+1,
        dailyClearCount:overlapBefore.dailyClearCount+1,lastCompleteDateTime:at},
      overlapInfo=overlapApp.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,
        totalExp:overlapXp.minimum_exp,level:master.playerLevels.findLast(([,threshold])=>threshold<=overlapXp.minimum_exp)[0],
        baseSP:refillReceipt.sp_minimum,baseSPUpdatedAt:at}})),
      overlapPut=stageXpFixture(overlapApp.store,{UserInfo:overlapInfo,UserSkipTicket:overlapTickets,
        UserAdventureStage:overlapApp.store.read('UserAdventureStage').data.map(row=>
          row.adventureStageId===stageId?overlapStage:row)},[overlapOperation,refillOperation]),
      overlapAck=await request(overlapPort,3,{badges:null,scripts:{},dataTokens:{},checksums:{before:{},
        after:Object.fromEntries(Object.entries(overlapPut).map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:overlapPut,deleteItems:{}}],
        operations:[overlapOperation,refillOperation].map(row=>({id:row.id,verifier:row.token}))},'3','user_data/push');
    assert.equal(overlapAck.status,200,'A contiguous later refill may save and ACK with its paid skip source');
    assert(overlapApp.store.db.prepare('SELECT id FROM operation_done WHERE id=?').get(overlapOperation.id));
    assert(overlapApp.store.db.prepare('SELECT id FROM operation_done WHERE id=?').get(refillOperation.id));

    const delayedSeed=structuredClone(seed),delayedStatus=delayedSeed.data.UserInfo[0].playerStatus;
    Object.assign(delayedStatus,{baseSP:17,baseSPUpdatedAt:at-30});
    let overlapDelayedNow=at;
    overlapDelayedApp=createServer({database:path.join(directory,'paid-skip-refill-delayed-tick.sqlite'),
      seed:delayedSeed,master,wallNowSeconds:()=>overlapDelayedNow});
    await new Promise(resolve=>overlapDelayedApp.server.listen(0,'127.0.0.1',resolve));
    overlapDelayedApp.store.changeHardCurrency(10);
    const overlapDelayedPort=overlapDelayedApp.server.address().port,
      delayedStageResult=await request(overlapDelayedPort,1,{...body,token:'paid-skip-refill-before-tick'},'1','adventure/stage/complete');
    assert.equal(delayedStageResult.status,200,delayedStageResult.body.toString());
    const delayedOperation=JSON.parse(delayedStageResult.body).operation,
      delayedSkip=JSON.parse(overlapDelayedApp.store.db.prepare(
        'SELECT capture_json FROM stage_skip_claim WHERE operation_id=?').get(delayedOperation.id).capture_json),
      delayedRefillResult=await request(overlapDelayedPort,2,{consumeId:81041001},'2','currency/hard/consume');
    assert.equal(delayedRefillResult.status,200,delayedRefillResult.body.toString());
    const delayedRefillOperation=JSON.parse(delayedRefillResult.body).operation,
      delayedRefillBefore=overlapDelayedApp.store.db.prepare(
        'SELECT * FROM hard_currency_consume WHERE operation_id=?').get(delayedRefillOperation.id),
      delayedXp=overlapDelayedApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?')
        .get(delayedOperation.id);
    assert.equal(delayedXp.sp_amount,0,'The delayed producer fixture must isolate a no-level-up skip');
    assert.equal(delayedRefillBefore.sp_before,delayedSkip.spBefore-delayedSkip.charge);
    assert.equal(delayedRefillBefore.sp_level,delayedStatus.level);
    assert.equal(delayedRefillBefore.sp_capacity,master.playerMaxSP[delayedStatus.level]);
    overlapDelayedNow+=200;
    const tickAt=at+150,tickInfo=overlapDelayedApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,baseSP:18,baseSPUpdatedAt:tickAt}})),
      tickPut=stageXpFixture(overlapDelayedApp.store,{UserInfo:tickInfo},[]),
      tickSave=await request(overlapDelayedPort,3,{badges:null,scripts:{},dataTokens:{},checksums:{before:{},
        after:Object.fromEntries(Object.entries(tickPut).map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:tickPut,deleteItems:{}}],operations:[]},
      '3','user_data/push');
    assert.equal(tickSave.status,200,'A later whole tick may shift an untouched later refill receipt');
    const delayedRefillAfter=overlapDelayedApp.store.db.prepare(
      'SELECT * FROM hard_currency_consume WHERE operation_id=?').get(delayedRefillOperation.id);
    assert.equal(delayedRefillAfter.sp_before,delayedRefillBefore.sp_before+1);
    assert.equal(delayedRefillAfter.sp_minimum,delayedRefillBefore.sp_minimum+1);
    const delayedTickets=delayedSeed.data.UserSkipTicket.map(row=>({...row,
        amount:row.skipTicketId===288000001?0:row.amount,signature:delayedOperation.signature,
        bookEntryState:row.bookEntryState===1?3:row.bookEntryState})),
      delayedStageBefore=delayedOperation.parameters.UserAdventureStage[0],
      delayedStage={...delayedStageBefore,state:4,cumulativeClearCount:delayedStageBefore.cumulativeClearCount+1,
        dailyClearCount:delayedStageBefore.dailyClearCount+1,lastCompleteDateTime:overlapDelayedNow},
      delayedInfo=overlapDelayedApp.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,
        totalExp:delayedXp.minimum_exp,level:master.playerLevels.findLast(([,threshold])=>threshold<=delayedXp.minimum_exp)[0],
        baseSP:delayedRefillAfter.sp_minimum,baseSPUpdatedAt:tickAt}})),
      delayedPut=stageXpFixture(overlapDelayedApp.store,{UserInfo:delayedInfo,UserSkipTicket:delayedTickets,
        UserAdventureStage:overlapDelayedApp.store.read('UserAdventureStage').data.map(row=>
          row.adventureStageId===stageId?delayedStage:row)},[delayedOperation,delayedRefillOperation]),
      delayedAck=await request(overlapDelayedPort,4,{badges:null,scripts:{},dataTokens:{},checksums:{before:{},
        after:Object.fromEntries(Object.entries(delayedPut).map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:delayedPut,deleteItems:{}}],
        operations:[delayedOperation,delayedRefillOperation].map(row=>({id:row.id,verifier:row.token}))},
      '4','user_data/push');
    assert.equal(delayedAck.status,200,'The shifted refill chain may complete its real combined acknowledgement');

    const atomicSeed=structuredClone(seed),atomicStatus=atomicSeed.data.UserInfo[0].playerStatus;
    Object.assign(atomicStatus,{baseSP:17,baseSPUpdatedAt:at-30});
    let overlapAtomicNow=at;
    overlapAtomicApp=createServer({database:path.join(directory,'paid-skip-refill-atomic-tick.sqlite'),
      seed:atomicSeed,master,wallNowSeconds:()=>overlapAtomicNow});
    await new Promise(resolve=>overlapAtomicApp.server.listen(0,'127.0.0.1',resolve));
    overlapAtomicApp.store.changeHardCurrency(10);
    const overlapAtomicPort=overlapAtomicApp.server.address().port,
      atomicStageResult=await request(overlapAtomicPort,1,{...body,token:'paid-skip-refill-atomic-tick'},'1','adventure/stage/complete');
    assert.equal(atomicStageResult.status,200,atomicStageResult.body.toString());
    const atomicStageOperation=JSON.parse(atomicStageResult.body).operation,
      atomicRefillResult=await request(overlapAtomicPort,2,{consumeId:81041001},'2','currency/hard/consume');
    assert.equal(atomicRefillResult.status,200,atomicRefillResult.body.toString());
    const atomicRefillOperation=JSON.parse(atomicRefillResult.body).operation,
      atomicRefillBefore=overlapAtomicApp.store.db.prepare(
        'SELECT * FROM hard_currency_consume WHERE operation_id=?').get(atomicRefillOperation.id),
      atomicXp=overlapAtomicApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?')
        .get(atomicStageOperation.id);
    assert.equal(atomicXp.sp_amount,0,'The atomic delayed producer fixture must isolate a no-level-up skip');
    assert.equal(atomicRefillBefore.sp_level,atomicStatus.level);
    assert.equal(atomicRefillBefore.sp_capacity,master.playerMaxSP[atomicStatus.level]);
    overlapAtomicNow+=200;
    const atomicTickets=atomicSeed.data.UserSkipTicket.map(row=>({...row,
        amount:row.skipTicketId===288000001?0:row.amount,signature:atomicStageOperation.signature,
        bookEntryState:row.bookEntryState===1?3:row.bookEntryState})),
      atomicStageBefore=atomicStageOperation.parameters.UserAdventureStage[0],
      atomicStage={...atomicStageBefore,state:4,cumulativeClearCount:atomicStageBefore.cumulativeClearCount+1,
        dailyClearCount:atomicStageBefore.dailyClearCount+1,lastCompleteDateTime:overlapAtomicNow},
      atomicInfo=overlapAtomicApp.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,
        totalExp:atomicXp.minimum_exp,level:master.playerLevels.findLast(([,threshold])=>threshold<=atomicXp.minimum_exp)[0],
        baseSP:atomicRefillBefore.sp_minimum+1,baseSPUpdatedAt:tickAt}})),
      atomicPut=stageXpFixture(overlapAtomicApp.store,{UserInfo:atomicInfo,UserSkipTicket:atomicTickets,
        UserAdventureStage:overlapAtomicApp.store.read('UserAdventureStage').data.map(row=>
          row.adventureStageId===stageId?atomicStage:row)},[atomicStageOperation,atomicRefillOperation]),
      atomicAck=await request(overlapAtomicPort,3,{badges:null,scripts:{},dataTokens:{},checksums:{before:{},
        after:Object.fromEntries(Object.entries(atomicPut).map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:atomicPut,deleteItems:{}}],
        operations:[atomicStageOperation,atomicRefillOperation].map(row=>({id:row.id,verifier:row.token}))},
      '3','user_data/push');
    assert.equal(atomicAck.status,200,'An atomic delayed tick may shift and settle the later refill chain');
    const atomicRefillAfter=overlapAtomicApp.store.db.prepare(
      'SELECT * FROM hard_currency_consume WHERE operation_id=?').get(atomicRefillOperation.id);
    assert.equal(atomicRefillAfter.sp_before,atomicRefillBefore.sp_before+1);
    assert.equal(atomicRefillAfter.sp_minimum,atomicRefillBefore.sp_minimum+1);
    const pullValue={tables:['UserSkipTicket']};
    assert.equal((await send('user_data/pull',pullValue)).status,200);
    const pullSequence=sequence;
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?')
      .run(JSON.stringify(restored),'UserSkipTicket');
    assert.throws(()=>app.store.read('UserSkipTicket'),/Spent skip tickets/);
    for(const [action,value] of [['user/login',undefined],['user_data/confirm',undefined],
      ['user_data/pull',pullValue]]) assert.equal((await send(action,value)).status,503,
      `Corrupt settled ticket stock must not be returned by ${action}`);
    assert.equal((await request(port,pullSequence,pullValue,String(pullSequence),'user_data/pull')).status,503,
      'Cached native pull must not replay pre-debit ticket stock');

    const bareSeed=structuredClone(seed);
    bareSeed.data.UserSkipTicket=[bareSeed.data.UserSkipTicket[0]];
    bareSeed.data.UserInfo[0].playerStatus.baseSP=0;
    bareSeed.data.UserInfo[0].playerStatus.baseSPUpdatedAt=at-360;
    bareApp=createServer({database:path.join(directory,'missing-assist.sqlite'),seed:bareSeed,
      master,wallNowSeconds:()=>at});
    await new Promise(resolve=>bareApp.server.listen(0,'127.0.0.1',resolve));
    const barePort=bareApp.server.address().port;
    const bareResult=await request(barePort,1,{...body,token:'missing-assist-row'},'1','adventure/stage/complete');
    assert.equal(bareResult.status,200,bareResult.body.toString());
    const bareOperation=JSON.parse(bareResult.body).operation,
      bareCapture=JSON.parse(bareApp.store.db.prepare('SELECT capture_json FROM stage_skip_claim WHERE operation_id=?')
        .get(bareOperation.id).capture_json);
    assert.equal(bareCapture.assist,null);
    assert.equal(bareCapture.spClock.savedSP,0);
    assert.equal(bareCapture.spBefore,2,'Two original 180-second ticks fund the one-SP skip');
    assert.equal(bareCapture.spClock.regenAt,at);
    const bareRows=[{...bareSeed.data.UserSkipTicket[0],amount:0,signature:bareOperation.signature},
      {userId:bareSeed.userId,skipTicketId:288000002,amount:0,cumulativeAmount:0,
        reservedAmount:0,bookEntryState:1,signature:bareOperation.signature,lastResetAt:0}];
    const barePut=stageXpFixture(bareApp.store,{UserSkipTicket:bareRows},[]);
    const bareSave=await request(barePort,2,{badges:null,scripts:{},dataTokens:{},
      checksums:{before:{},after:Object.fromEntries(Object.entries(barePut).map(([name,rows])=>[name,md5(rows)]))},
      deltas:[{signature:0,trigger:'AdventureComplete',putItems:barePut,deleteItems:{}}],operations:[]},
    '2','user_data/push');
    assert.equal(bareSave.status,200,bareSave.body.toString());
    assert.deepEqual(bareApp.store.read('UserSkipTicket').data,bareRows);
    for(const [index,amount] of [2,1,2].entries()) {
      const putItems={UserInfo:bareApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,baseSP:amount,baseSPUpdatedAt:at}}))};
      const save=await request(barePort,index+3,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserInfo:md5(putItems.UserInfo)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems,deleteItems:{}}],operations:[]},
      String(index+3),'user_data/push');
      assert.equal(save.status,index===2?400:200,
        index===2?'Observed skip SP debit cannot rewind':'Native regeneration and debit save must be admitted');
    }

    let lateNow=at;
    lateApp=createServer({database:path.join(directory,'late-sp-skip.sqlite'),seed:structuredClone(bareSeed),
      master,wallNowSeconds:()=>lateNow});
    await new Promise(resolve=>lateApp.server.listen(0,'127.0.0.1',resolve));
    const latePort=lateApp.server.address().port,
      lateResult=await request(latePort,1,{...body,token:'delayed-third-sp-tick'},'1','adventure/stage/complete');
    assert.equal(lateResult.status,200,lateResult.body.toString());
    const lateOperation=JSON.parse(lateResult.body).operation;
    lateNow+=180;
    const lateInfo=lateApp.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,
      baseSP:2,baseSPUpdatedAt:lateNow}})),
      latePut={UserInfo:lateInfo},
      lateSave=await request(latePort,2,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserInfo:md5(lateInfo)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:latePut,deleteItems:{}}],operations:[]},
      '2','user_data/push');
    assert.equal(lateSave.status,200,'A third earned tick may precede the native skip SP debit');
    assert(lateApp.store.db.prepare('SELECT 1 FROM stage_skip_claim WHERE operation_id=?')
      .get(lateOperation.id),'The delayed callback retains its pending receipt');
    assert(JSON.parse(lateApp.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?')
      .get(lateOperation.id).observed).includes(`skip:spTick:${lateNow}`),
    'A saved extra tick must remain a valid pending-stage observation');
    const lateRewind=lateInfo.map(row=>({...row,playerStatus:{...row.playerStatus,baseSP:3}}));
    assert.equal((await request(latePort,3,{badges:null,scripts:{},dataTokens:{},
      checksums:{before:{},after:{UserInfo:md5(lateRewind)}},
      deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserInfo:lateRewind},deleteItems:{}}],operations:[]},
    '3','user_data/push')).status,400,'An observed delayed debit cannot become an unspent refill');

    const capSeed=structuredClone(bareSeed);
    capSeed.data.UserInfo[0].playerStatus.baseSP=19;
    capSeed.data.UserInfo[0].playerStatus.baseSPUpdatedAt=at-90;
    let capNow=at,capSequence=1;
    capApp=createServer({database:path.join(directory,'cap-reached-skip.sqlite'),seed:capSeed,
      master,wallNowSeconds:()=>capNow});
    await new Promise(resolve=>capApp.server.listen(0,'127.0.0.1',resolve));
    const capPort=capApp.server.address().port,
      capResult=await request(capPort,1,{...body,token:'delayed-full-sp-tick'},'1','adventure/stage/complete');
    assert.equal(capResult.status,200,capResult.body.toString());
    const capSave=(amount,timestamp)=>{
      const rows=capApp.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,
        baseSP:amount,baseSPUpdatedAt:timestamp}})),sequence=++capSequence;
      return request(capPort,sequence,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserInfo:md5(rows)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserInfo:rows},deleteItems:{}}],operations:[]},
      String(sequence),'user_data/push');
    };
    capNow+=90;
    assert.equal((await capSave(20,capNow)).status,200,'The exact cap-reaching tick may save first');
    assert(JSON.parse(capApp.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?')
      .get(JSON.parse(capResult.body).operation.id).observed).includes('skip:spCap'),
    'The saved cap phase remains an admitted pending-stage observation');
    capNow+=5;
    assert.equal((await capSave(20,capNow)).status,200,'The full-bar callback stamps its own time');
    assert.equal((await capSave(19,capNow)).status,200,'The same stamped balance funds the skip debit');
    assert.equal((await capSave(20,capNow)).status,400,'The full-bar debit cannot be undone');
    capNow++;
    assert.equal((await capSave(19,capNow)).status,400,'The observed full-bar stamp cannot drift');
    const capId=JSON.parse(capResult.body).operation.id,
      capObserved=JSON.parse(capApp.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?')
        .get(capId).observed);
    capApp.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?')
      .run(JSON.stringify([...capObserved,'skip:spTick:invalid']),capId);
    assert.equal((await capSave(19,capNow)).status,503,'A forged old tick cannot survive cap-phase receipt validation');

    resetApp=createServer({database:path.join(directory,'daily-reset.sqlite'),seed:structuredClone(seed),
      master,wallNowSeconds:()=>at});
    await new Promise(resolve=>resetApp.server.listen(0,'127.0.0.1',resolve));
    const resetPort=resetApp.server.address().port,
      resetRows=seed.data.UserSkipTicket.map(row=>row.skipTicketId===288000001?{...row,
        amount:5,cumulativeAmount:5,lastResetAt:at,signature:17}:row),
      resetBody=rows=>({badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserSkipTicket:md5(rows)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserSkipTicket:rows},deleteItems:{}}],operations:[]});
    assert.equal((await request(resetPort,1,resetBody(resetRows),'1','user_data/push')).status,200,
      'Original daily reset must replace stock and add only the positive acquisition delta');
    assert.equal(resetApp.store.db.prepare('SELECT reset_at FROM stage_skip_daily_reset WHERE user_id=?')
      .get(seed.userId).reset_at,at);
    assert.equal((await request(resetPort,2,resetBody(seed.data.UserSkipTicket),'2','user_data/push')).status,400,
      'A later native save cannot rewind the acknowledged reset');
    assert.deepEqual(resetApp.store.read('UserSkipTicket').data,resetRows);
    resetApp.store.db.prepare("UPDATE profile SET data=? WHERE name='UserSkipTicket'")
      .run(JSON.stringify(seed.data.UserSkipTicket));
    assert.throws(()=>resetApp.store.read('UserSkipTicket'),/Daily skip-ticket reset cannot be rewound/);

    const coalescedSeed=structuredClone(seed);
    coalescedSeed.data.UserSkipTicket[0].amount=0;
    coalescedSeed.data.UserSkipTicket[1].amount=0;
    coalescedApp=createServer({database:path.join(directory,'reset-then-skip.sqlite'),seed:coalescedSeed,
      master,wallNowSeconds:()=>at});
    await new Promise(resolve=>coalescedApp.server.listen(0,'127.0.0.1',resolve));
    const coalescedPort=coalescedApp.server.address().port,
      coalescedResult=await request(coalescedPort,1,{...body,token:'reset-before-skip'},'1','adventure/stage/complete');
    assert.equal(coalescedResult.status,200,coalescedResult.body.toString());
    const coalescedOperation=JSON.parse(coalescedResult.body).operation,
      coalescedCapture=JSON.parse(coalescedApp.store.db.prepare('SELECT capture_json FROM stage_skip_claim WHERE operation_id=?')
        .get(coalescedOperation.id).capture_json);
    assert.equal(coalescedCapture.reset.day,Math.floor((at+32400)/86400));
    const coalescedRows=coalescedSeed.data.UserSkipTicket.map(row=>row.skipTicketId===288000001?{...row,
      amount:4,cumulativeAmount:6,lastResetAt:at,signature:coalescedOperation.signature}:{...row,
      signature:coalescedOperation.signature,bookEntryState:3});
    let coalescedSequence=1;
    const coalescedPush=(putItems,acks=[])=>{
      putItems=stageXpFixture(coalescedApp.store,putItems,acks);
      const sequence=++coalescedSequence;
      return request(coalescedPort,sequence,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
        deltas:Object.keys(putItems).length?[{signature:0,trigger:'AdventureComplete',putItems,deleteItems:{}}]:[],
        operations:acks.map(row=>({id:row.id,verifier:row.token}))},String(sequence),'user_data/push');
    };
    assert.equal((await coalescedPush({UserSkipTicket:coalescedRows})).status,200);
    assert.equal(coalescedApp.store.db.prepare('SELECT 1 FROM stage_skip_daily_reset WHERE user_id=?')
      .get(seed.userId),undefined,'A combined reset is not checkpointed before real ACK');
    const coalescedBefore=coalescedOperation.parameters.UserAdventureStage[0],
      coalescedXp=coalescedApp.store.db.prepare('SELECT minimum_exp FROM stage_xp_claim WHERE operation_id=?')
        .get(coalescedOperation.id),
      coalescedInfo=coalescedApp.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,
        baseSP:coalescedCapture.spBefore-coalescedCapture.charge,baseSPUpdatedAt:at,
        totalExp:coalescedXp.minimum_exp,
        level:master.playerLevels.findLast(([,threshold])=>threshold<=coalescedXp.minimum_exp)[0]}})),
      coalescedStage={...coalescedBefore,state:4,
        cumulativeClearCount:coalescedBefore.cumulativeClearCount+1,
        dailyClearCount:coalescedBefore.dailyClearCount+1,lastCompleteDateTime:at};
    assert.equal((await coalescedPush({UserInfo:coalescedInfo,
      UserAdventureStage:coalescedApp.store.read('UserAdventureStage').data.map(row=>
        row.adventureStageId===stageId?coalescedStage:row)},[coalescedOperation])).status,200);
    assert.equal(coalescedApp.store.db.prepare('SELECT reset_at FROM stage_skip_daily_reset WHERE user_id=?')
      .get(seed.userId).reset_at,at,'Combined reset checkpoint commits with its actual skip ACK');

    const optionalSeed=structuredClone(seed);
    optionalSeed.data.UserSkipTicket[1].amount=0;
    optionalApp=createServer({database:path.join(directory,'optional-reset-skip.sqlite'),seed:optionalSeed,
      master,wallNowSeconds:()=>at});
    await new Promise(resolve=>optionalApp.server.listen(0,'127.0.0.1',resolve));
    const optionalPort=optionalApp.server.address().port,
      optionalResult=await request(optionalPort,1,{...body,token:'saved-stock-reset-first'},'1','adventure/stage/complete');
    assert.equal(optionalResult.status,200,optionalResult.body.toString());
    const optionalOperation=JSON.parse(optionalResult.body).operation,
      optionalCapture=JSON.parse(optionalApp.store.db.prepare('SELECT capture_json FROM stage_skip_claim WHERE operation_id=?')
        .get(optionalOperation.id).capture_json);
    assert.equal(optionalCapture.reset.optional,true);
    const optionalRows=optionalSeed.data.UserSkipTicket.map(row=>row.skipTicketId===288000001?{...row,
      amount:4,cumulativeAmount:5,lastResetAt:at,signature:optionalOperation.signature}:{...row,
      signature:optionalOperation.signature,bookEntryState:3}),
      optionalPut={UserSkipTicket:optionalRows},
      optionalSave=await request(optionalPort,2,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserSkipTicket:md5(optionalRows)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:optionalPut,deleteItems:{}}],operations:[]},
      '2','user_data/push');
    assert.equal(optionalSave.status,200,'Saved-sufficient stock may still follow the native reset-before-spend path');
    const optionalBefore=optionalOperation.parameters.UserAdventureStage[0],
      optionalXp=optionalApp.store.db.prepare('SELECT minimum_exp FROM stage_xp_claim WHERE operation_id=?')
        .get(optionalOperation.id),
      optionalInfo=optionalApp.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,
        baseSP:optionalCapture.spBefore-optionalCapture.charge,baseSPUpdatedAt:at,
        totalExp:optionalXp.minimum_exp,
        level:master.playerLevels.findLast(([,threshold])=>threshold<=optionalXp.minimum_exp)[0]}})),
      optionalStage={...optionalBefore,state:4,
        cumulativeClearCount:optionalBefore.cumulativeClearCount+1,
        dailyClearCount:optionalBefore.dailyClearCount+1,lastCompleteDateTime:at},
      optionalPut2=stageXpFixture(optionalApp.store,{UserInfo:optionalInfo,
        UserAdventureStage:optionalApp.store.read('UserAdventureStage').data.map(row=>
          row.adventureStageId===stageId?optionalStage:row)},[optionalOperation]),
      optionalAck=await request(optionalPort,3,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(optionalPut2).map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:optionalPut2,deleteItems:{}}],
        operations:[{id:optionalOperation.id,verifier:optionalOperation.token}]},'3','user_data/push');
    assert.equal(optionalAck.status,200,'The observed reset-first path may complete its full native save/ACK');
    assert.equal(optionalApp.store.db.prepare('SELECT reset_at FROM stage_skip_daily_reset WHERE user_id=?')
      .get(seed.userId).reset_at,at);
    assert.equal(optionalApp.store.db.prepare('SELECT amount FROM stage_skip_stock_floor WHERE skip_ticket_id=?')
      .get(288000001).amount,4);
    optionalApp.store.db.prepare(`UPDATE stage_skip_stock_floor SET amount=0,cumulative_amount=1
      WHERE skip_ticket_id=?`).run(288000001);
    assert.throws(()=>optionalApp.store.read('UserSkipTicket'),/Settled skip-ticket stock differs/,
      'A reset-first ACK cannot be reinterpreted as the optional no-reset branch');
    optionalApp.store.db.prepare(`UPDATE stage_skip_stock_floor SET amount=4,cumulative_amount=5
      WHERE skip_ticket_id=?`).run(288000001);

    // Synthetic zero-cost fixture isolates the original callback's no-SP-debit branch.
    const zeroMaster=structuredClone(master),zeroSeed=structuredClone(seed);
    zeroMaster.stageRaidStamina[stageId].stamina=0;
    zeroSeed.data.UserInfo[0].playerStatus.totalExp=99;
    zeroApp=createServer({database:path.join(directory,'zero-cost-level-up-skip.sqlite'),seed:zeroSeed,
      master:zeroMaster,wallNowSeconds:()=>at});
    await new Promise(resolve=>zeroApp.server.listen(0,'127.0.0.1',resolve));
    const zeroPort=zeroApp.server.address().port,
      zeroResult=await request(zeroPort,1,{...body,token:'zero-cost-level-up-skip'},'1','adventure/stage/complete');
    assert.equal(zeroResult.status,200,zeroResult.body.toString());
    const zeroOperation=JSON.parse(zeroResult.body).operation,
      zeroXp=zeroApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?').get(zeroOperation.id),
      zeroSkip=JSON.parse(zeroApp.store.db.prepare('SELECT capture_json FROM stage_skip_claim WHERE operation_id=?')
        .get(zeroOperation.id).capture_json);
    assert.equal(zeroSkip.charge,0);
    assert.equal(zeroXp.sp_amount,21);
    const zeroBefore=zeroOperation.parameters.UserAdventureStage[0],
      zeroInfo=zeroApp.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,
        totalExp:zeroXp.minimum_exp,level:2,baseSP:zeroXp.sp_minimum}})),
      zeroTickets=zeroSeed.data.UserSkipTicket.map(row=>({...row,
        amount:row.skipTicketId===288000001?0:row.amount,signature:zeroOperation.signature,
        bookEntryState:row.bookEntryState===1?3:row.bookEntryState})),
      zeroStage={...zeroBefore,state:4,cumulativeClearCount:zeroBefore.cumulativeClearCount+1,
        dailyClearCount:zeroBefore.dailyClearCount+1,lastCompleteDateTime:at},
      zeroXpSave=await request(zeroPort,2,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserInfo:md5(zeroInfo)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserInfo:zeroInfo},deleteItems:{}}],operations:[]},
      '2','user_data/push');
    assert.equal(zeroXpSave.status,200,'The level-up SP may save before zero-cost skip tickets');
    const zeroCold=await request(zeroPort,3,undefined,'3','user_data/confirm');
    assert.equal(zeroCold.status,200,'Untouched zero-cost tickets may cold-replay without duplicate XP');
    assert.equal(JSON.parse(zeroCold.body).operations.find(row=>row.id===zeroOperation.id)
      ?.parameters.offlineStageXpApplied,1);
    const
      zeroPut=stageXpFixture(zeroApp.store,{UserInfo:zeroInfo,UserSkipTicket:zeroTickets,
        UserAdventureStage:zeroApp.store.read('UserAdventureStage').data.map(row=>
          row.adventureStageId===stageId?zeroStage:row)},[zeroOperation]),
      zeroAck=await request(zeroPort,4,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(zeroPut).map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:zeroPut,deleteItems:{}}],
        operations:[{id:zeroOperation.id,verifier:zeroOperation.token}]},'4','user_data/push');
    assert.equal(zeroAck.status,200,'Zero-cost skip may ACK its independent level-up SP and ticket spend');

    zeroTicketFirstApp=createServer({database:path.join(directory,'zero-cost-ticket-first.sqlite'),
      seed:structuredClone(zeroSeed),master:zeroMaster,wallNowSeconds:()=>at});
    await new Promise(resolve=>zeroTicketFirstApp.server.listen(0,'127.0.0.1',resolve));
    const zeroTicketFirstPort=zeroTicketFirstApp.server.address().port,
      zeroTicketFirstResult=await request(zeroTicketFirstPort,1,
        {...body,token:'zero-cost-ticket-first'},'1','adventure/stage/complete');
    assert.equal(zeroTicketFirstResult.status,200,zeroTicketFirstResult.body.toString());
    const zeroTicketFirstOperation=JSON.parse(zeroTicketFirstResult.body).operation,
      zeroTicketFirstXp=zeroTicketFirstApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?')
        .get(zeroTicketFirstOperation.id),
      zeroTicketFirstTickets=zeroSeed.data.UserSkipTicket.map(row=>({...row,
        amount:row.skipTicketId===288000001?0:row.amount,signature:zeroTicketFirstOperation.signature,
        bookEntryState:row.bookEntryState===1?3:row.bookEntryState})),
      zeroTicketFirstSave=await request(zeroTicketFirstPort,2,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserSkipTicket:md5(zeroTicketFirstTickets)}},
        deltas:[{signature:0,trigger:'AdventureComplete',
          putItems:{UserSkipTicket:zeroTicketFirstTickets},deleteItems:{}}],operations:[]},
      '2','user_data/push');
    assert.equal(zeroTicketFirstSave.status,200,'Zero-cost tickets can save before XP');
    const zeroTicketFirstCold=await request(zeroTicketFirstPort,3,undefined,'3','user_data/confirm');
    assert.equal(zeroTicketFirstCold.status,200,'Saved zero-cost tickets can resume the remaining callback');
    const zeroTicketFirstRecovered=JSON.parse(zeroTicketFirstCold.body).operations
      .find(row=>row.id===zeroTicketFirstOperation.id);
    assert.equal(zeroTicketFirstRecovered?.parameters.offlineStageSkipApplied,1);
    assert.equal(zeroTicketFirstRecovered?.parameters.offlineStageXpApplied,undefined);
    const zeroTicketFirstBefore=zeroTicketFirstOperation.parameters.UserAdventureStage[0],
      zeroTicketFirstInfo=zeroTicketFirstApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,totalExp:zeroTicketFirstXp.minimum_exp,level:2,
          baseSP:zeroTicketFirstXp.sp_minimum}})),
      zeroTicketFirstStage={...zeroTicketFirstBefore,state:4,
        cumulativeClearCount:zeroTicketFirstBefore.cumulativeClearCount+1,
        dailyClearCount:zeroTicketFirstBefore.dailyClearCount+1,lastCompleteDateTime:at},
      zeroTicketFirstPut=stageXpFixture(zeroTicketFirstApp.store,{UserInfo:zeroTicketFirstInfo,
        UserAdventureStage:zeroTicketFirstApp.store.read('UserAdventureStage').data.map(row=>
          row.adventureStageId===stageId?zeroTicketFirstStage:row)},[zeroTicketFirstOperation]),
      zeroTicketFirstAck=await request(zeroTicketFirstPort,4,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(zeroTicketFirstPut)
          .map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:zeroTicketFirstPut,deleteItems:{}}],
        operations:[{id:zeroTicketFirstOperation.id,verifier:zeroTicketFirstOperation.token}]},
      '4','user_data/push');
    assert.equal(zeroTicketFirstAck.status,200,'Ticket-first zero-cost skip keeps the original XP/clear ACK');

    // The original callback spends skip SP before its later XP/level-up setter.
    const paidSeed=structuredClone(seed);
    Object.assign(paidSeed.data.UserInfo[0].playerStatus,
      {totalExp:99,baseSP:20,baseSPUpdatedAt:at-30});
    paidApp=createServer({database:path.join(directory,'paid-level-up-skip.sqlite'),seed:paidSeed,
      master,wallNowSeconds:()=>at});
    await new Promise(resolve=>paidApp.server.listen(0,'127.0.0.1',resolve));
    const paidPort=paidApp.server.address().port,
      paidResult=await request(paidPort,1,{...body,token:'paid-level-up-skip'},'1','adventure/stage/complete');
    assert.equal(paidResult.status,200,paidResult.body.toString());
    const paidOperation=JSON.parse(paidResult.body).operation,
      paidXp=paidApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?').get(paidOperation.id),
      paidSkip=JSON.parse(paidApp.store.db.prepare('SELECT capture_json FROM stage_skip_claim WHERE operation_id=?')
        .get(paidOperation.id).capture_json),
      paidBefore=paidOperation.parameters.UserAdventureStage[0];
    assert.equal(paidSkip.spBefore,20);
    assert.equal(paidXp.sp_before,19);
    assert.equal(paidXp.sp_minimum,40);
    const paidTickets=paidSeed.data.UserSkipTicket.map(row=>({...row,
        amount:row.skipTicketId===288000001?0:row.amount,signature:paidOperation.signature,
        bookEntryState:row.bookEntryState===1?3:row.bookEntryState})),
      paidSpentInfo=paidApp.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,
        baseSP:paidSkip.spBefore-paidSkip.charge,baseSPUpdatedAt:at}})),
      wrongAwardInfo=paidSpentInfo.map(row=>({...row,playerStatus:{...row.playerStatus,
        totalExp:paidXp.minimum_exp,level:2,baseSP:paidSkip.spBefore+paidXp.sp_amount}})),
      wrongAward=await request(paidPort,2,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserInfo:md5(wrongAwardInfo)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserInfo:wrongAwardInfo},deleteItems:{}}],
        operations:[]},'2','user_data/push');
    assert.equal(wrongAward.status,400,'Pre-debit level-up arithmetic must not be accepted');
    const paidSpentPut={UserInfo:paidSpentInfo,UserSkipTicket:paidTickets},
      paidSpentSave=await request(paidPort,3,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(paidSpentPut).map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:paidSpentPut,deleteItems:{}}],operations:[]},
      '3','user_data/push');
    assert.equal(paidSpentSave.status,200,'The signed ticket/SP debit may save before the level-up award');
    const paidColdDebit=await request(paidPort,4,undefined,'4','user_data/confirm'),
      paidColdDebitOperation=JSON.parse(paidColdDebit.body).operations?.find(row=>row.id===paidOperation.id);
    assert.equal(paidColdDebit.status,200,'A fully saved paid debit can resume the original remaining callback');
    assert.equal(paidColdDebitOperation?.parameters.offlineStageSkipApplied,1);
    assert.equal(paidColdDebitOperation?.parameters.offlineStageXpApplied,undefined);
    const paidFinalInfo=paidApp.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,
        totalExp:paidXp.minimum_exp,level:2,baseSP:paidXp.sp_minimum}})),
      paidXpSave=await request(paidPort,5,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserInfo:md5(paidFinalInfo)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserInfo:paidFinalInfo},deleteItems:{}}],
        operations:[]},'5','user_data/push');
    assert.equal(paidXpSave.status,200,'The original remaining XP/SP may save after the paid debit');
    const paidColdXp=await request(paidPort,6,undefined,'6','user_data/confirm'),
      paidColdXpOperation=JSON.parse(paidColdXp.body).operations?.find(row=>row.id===paidOperation.id);
    assert.equal(paidColdXp.status,200,'A saved paid debit and XP resume only the remaining clear');
    assert.equal(paidColdXpOperation?.parameters.offlineStageSkipApplied,1);
    assert.equal(paidColdXpOperation?.parameters.offlineStageXpApplied,1);
    const
      paidStage={...paidBefore,state:4,cumulativeClearCount:paidBefore.cumulativeClearCount+1,
        dailyClearCount:paidBefore.dailyClearCount+1,lastCompleteDateTime:at},
      paidPut=stageXpFixture(paidApp.store,{UserInfo:paidFinalInfo,
        UserAdventureStage:paidApp.store.read('UserAdventureStage').data.map(row=>
          row.adventureStageId===stageId?paidStage:row)},[paidOperation]),
      paidAck=await request(paidPort,7,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(paidPut).map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:paidPut,deleteItems:{}}],
        operations:[{id:paidOperation.id,verifier:paidOperation.token}]},'7','user_data/push');
    assert.equal(paidAck.status,200,'The saved debit must survive its later XP/SP award and real ACK');

    paidTicketOnlyApp=createServer({database:path.join(directory,'paid-ticket-only-cold.sqlite'),
      seed:structuredClone(paidSeed),master,wallNowSeconds:()=>at});
    await new Promise(resolve=>paidTicketOnlyApp.server.listen(0,'127.0.0.1',resolve));
    const paidTicketOnlyPort=paidTicketOnlyApp.server.address().port,
      paidTicketOnlyResult=await request(paidTicketOnlyPort,1,
        {...body,token:'paid-ticket-only-cold'},'1','adventure/stage/complete');
    assert.equal(paidTicketOnlyResult.status,200,paidTicketOnlyResult.body.toString());
    const paidTicketOnlyOperation=JSON.parse(paidTicketOnlyResult.body).operation,
      paidTicketOnlyCapture=JSON.parse(paidTicketOnlyApp.store.db.prepare(
        'SELECT capture_json FROM stage_skip_claim WHERE operation_id=?').get(paidTicketOnlyOperation.id).capture_json),
      paidTicketOnlyXp=paidTicketOnlyApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?')
        .get(paidTicketOnlyOperation.id),
      paidTicketOnlyRows=paidSeed.data.UserSkipTicket.map(row=>({...row,
        amount:row.skipTicketId===288000001?0:row.amount,signature:paidTicketOnlyOperation.signature,
        bookEntryState:row.bookEntryState===1?3:row.bookEntryState})),
      paidOneTicketRows=paidTicketOnlyRows.map(row=>row.skipTicketId===288000002?
        structuredClone(paidSeed.data.UserSkipTicket.find(old=>old.skipTicketId===row.skipTicketId)):row),
      paidOneTicketSave=await request(paidTicketOnlyPort,2,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserSkipTicket:md5(paidOneTicketRows)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserSkipTicket:paidOneTicketRows},deleteItems:{}}],
        operations:[]},'2','user_data/push');
    assert.equal(paidOneTicketSave.status,200,'One saved ticket row is retained as an incomplete native prefix');
    assert.equal((await request(paidTicketOnlyPort,3,undefined,'3','user_data/confirm')).status,503,
      'One-ticket partial state cannot bypass the original combined ticket call');
    const paidTicketOnlySave=await request(paidTicketOnlyPort,4,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserSkipTicket:md5(paidTicketOnlyRows)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserSkipTicket:paidTicketOnlyRows},deleteItems:{}}],
        operations:[]},'4','user_data/push');
    assert.equal(paidTicketOnlySave.status,200,'Both signed ticket rows complete the ticket-side checkpoint');
    const paidTicketOnlyCold=await request(paidTicketOnlyPort,5,undefined,'5','user_data/confirm'),
      paidTicketOnlyRecovered=JSON.parse(paidTicketOnlyCold.body).operations
        .find(row=>row.id===paidTicketOnlyOperation.id);
    assert.equal(paidTicketOnlyCold.status,200,'Ticket-only paid skip resumes at the original SP debit');
    assert.equal(paidTicketOnlyRecovered?.parameters.offlineStageSkipTicketsApplied,1);
    assert.equal(paidTicketOnlyRecovered?.parameters.offlineStageSkipApplied,undefined);
    assert.equal(paidTicketOnlyRecovered?.parameters.offlineStageSkipSpApplied,undefined);
    const paidTicketOnlyBefore=paidTicketOnlyOperation.parameters.UserAdventureStage[0],
      paidTicketOnlyInfo=paidTicketOnlyApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,totalExp:paidTicketOnlyXp.minimum_exp,level:2,
          baseSP:paidTicketOnlyXp.sp_minimum,baseSPUpdatedAt:at}})),
      paidTicketOnlyStage={...paidTicketOnlyBefore,state:4,
        cumulativeClearCount:paidTicketOnlyBefore.cumulativeClearCount+1,
        dailyClearCount:paidTicketOnlyBefore.dailyClearCount+1,lastCompleteDateTime:at},
      paidTicketOnlyPut=stageXpFixture(paidTicketOnlyApp.store,{UserInfo:paidTicketOnlyInfo,
        UserAdventureStage:paidTicketOnlyApp.store.read('UserAdventureStage').data.map(row=>
          row.adventureStageId===stageId?paidTicketOnlyStage:row)},[paidTicketOnlyOperation]),
      paidTicketOnlyAck=await request(paidTicketOnlyPort,6,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(paidTicketOnlyPut)
          .map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:paidTicketOnlyPut,deleteItems:{}}],
        operations:[{id:paidTicketOnlyOperation.id,verifier:paidTicketOnlyOperation.token}]},
      '6','user_data/push');
    assert.equal(paidTicketOnlyAck.status,200,'Ticket-only cold replay applies SP/XP/clear once and ACKs');
    assert.equal(paidTicketOnlyCapture.charge,1);

    paidSpOnlyApp=createServer({database:path.join(directory,'paid-sp-only-cold.sqlite'),
      seed:structuredClone(paidSeed),master,wallNowSeconds:()=>at});
    await new Promise(resolve=>paidSpOnlyApp.server.listen(0,'127.0.0.1',resolve));
    const paidSpOnlyPort=paidSpOnlyApp.server.address().port,
      paidSpOnlyResult=await request(paidSpOnlyPort,1,{...body,token:'paid-sp-only-cold'},'1',
        'adventure/stage/complete');
    assert.equal(paidSpOnlyResult.status,200,paidSpOnlyResult.body.toString());
    const paidSpOnlyOperation=JSON.parse(paidSpOnlyResult.body).operation,
      paidSpOnlyXp=paidSpOnlyApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?')
        .get(paidSpOnlyOperation.id),
      paidSpOnlyInfo=paidSpOnlyApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,totalExp:paidSpOnlyXp.minimum_exp,level:2,
          baseSP:paidSpOnlyXp.sp_minimum,baseSPUpdatedAt:at}})),
      paidSpOnlySave=await request(paidSpOnlyPort,2,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserInfo:md5(paidSpOnlyInfo)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserInfo:paidSpOnlyInfo},deleteItems:{}}],
        operations:[]},'2','user_data/push');
    assert.equal(paidSpOnlySave.status,200,'SP debit and later XP may share one profile save before ticket rows');
    const paidSpOnlyCold=await request(paidSpOnlyPort,3,undefined,'3','user_data/confirm'),
      paidSpOnlyRecovered=JSON.parse(paidSpOnlyCold.body).operations.find(row=>row.id===paidSpOnlyOperation.id);
    assert.equal(paidSpOnlyCold.status,200,'SP-side paid skip resumes at the original combined ticket call');
    assert.equal(paidSpOnlyRecovered?.parameters.offlineStageSkipSpApplied,1);
    assert.equal(paidSpOnlyRecovered?.parameters.offlineStageXpApplied,1);
    assert.equal(paidSpOnlyRecovered?.parameters.offlineStageSkipApplied,undefined);
    assert.equal(paidSpOnlyRecovered?.parameters.offlineStageSkipTicketsApplied,undefined);
    const paidSpOnlyBefore=paidSpOnlyOperation.parameters.UserAdventureStage[0],
      paidSpOnlyTickets=paidSeed.data.UserSkipTicket.map(row=>({...row,
        amount:row.skipTicketId===288000001?0:row.amount,signature:paidSpOnlyOperation.signature,
        bookEntryState:row.bookEntryState===1?3:row.bookEntryState})),
      paidSpOnlyStage={...paidSpOnlyBefore,state:4,
        cumulativeClearCount:paidSpOnlyBefore.cumulativeClearCount+1,
        dailyClearCount:paidSpOnlyBefore.dailyClearCount+1,lastCompleteDateTime:at},
      paidSpOnlyPut=stageXpFixture(paidSpOnlyApp.store,{UserSkipTicket:paidSpOnlyTickets,
        UserAdventureStage:paidSpOnlyApp.store.read('UserAdventureStage').data.map(row=>
          row.adventureStageId===stageId?paidSpOnlyStage:row)},[paidSpOnlyOperation]),
      paidSpOnlyAck=await request(paidSpOnlyPort,4,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(paidSpOnlyPut)
          .map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:paidSpOnlyPut,deleteItems:{}}],
        operations:[{id:paidSpOnlyOperation.id,verifier:paidSpOnlyOperation.token}]},
      '4','user_data/push');
    assert.equal(paidSpOnlyAck.status,200,'SP/XP-only cold replay applies tickets and clear once and ACKs');

    const paidSubcapSeed=structuredClone(paidSeed);
    paidSubcapSeed.data.UserInfo[0].playerStatus.baseSP=19;
    let paidSubcapNow=at;
    paidSubcapApp=createServer({database:path.join(directory,'paid-level-up-subcap.sqlite'),
      seed:paidSubcapSeed,master,wallNowSeconds:()=>paidSubcapNow});
    await new Promise(resolve=>paidSubcapApp.server.listen(0,'127.0.0.1',resolve));
    const paidSubcapPort=paidSubcapApp.server.address().port,
      paidSubcapResult=await request(paidSubcapPort,1,{...body,token:'paid-level-up-subcap'},'1',
        'adventure/stage/complete');
    assert.equal(paidSubcapResult.status,200,paidSubcapResult.body.toString());
    const paidSubcapOperation=JSON.parse(paidSubcapResult.body).operation,
      paidSubcapXp=paidSubcapApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?')
        .get(paidSubcapOperation.id),
      paidSubcapBefore=paidSubcapOperation.parameters.UserAdventureStage[0];
    assert.equal(paidSubcapXp.sp_before,18);
    assert.equal(paidSubcapXp.sp_minimum,39);
    paidSubcapNow+=200; // A later ACK must not invent a cap tick absent from the saved callback phase.
    const paidSubcapInfo=paidSubcapApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,totalExp:paidSubcapXp.minimum_exp,level:2,
          baseSP:paidSubcapXp.sp_minimum}})),
      paidSubcapTickets=paidSubcapSeed.data.UserSkipTicket.map(row=>({...row,
        amount:row.skipTicketId===288000001?0:row.amount,signature:paidSubcapOperation.signature,
        bookEntryState:row.bookEntryState===1?3:row.bookEntryState})),
      paidSubcapStage={...paidSubcapBefore,state:4,
        cumulativeClearCount:paidSubcapBefore.cumulativeClearCount+1,
        dailyClearCount:paidSubcapBefore.dailyClearCount+1,lastCompleteDateTime:at},
      paidSubcapPut=stageXpFixture(paidSubcapApp.store,{UserInfo:paidSubcapInfo,
        UserSkipTicket:paidSubcapTickets,UserAdventureStage:paidSubcapApp.store.read('UserAdventureStage').data
          .map(row=>row.adventureStageId===stageId?paidSubcapStage:row)},[paidSubcapOperation]),
      paidSubcapAck=await request(paidSubcapPort,2,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(paidSubcapPut)
          .map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:paidSubcapPut,deleteItems:{}}],
        operations:[{id:paidSubcapOperation.id,verifier:paidSubcapOperation.token}]},'2','user_data/push');
    assert.equal(paidSubcapAck.status,200,'No-tick sub-cap award survives a later full ACK');

    const paidDueSeed=structuredClone(paidSeed);
    Object.assign(paidDueSeed.data.UserInfo[0].playerStatus,
      {baseSP:17,baseSPUpdatedAt:at-400});
    paidDueApp=createServer({database:path.join(directory,'paid-level-up-due-ticks.sqlite'),
      seed:paidDueSeed,master,wallNowSeconds:()=>at});
    await new Promise(resolve=>paidDueApp.server.listen(0,'127.0.0.1',resolve));
    const paidDuePort=paidDueApp.server.address().port,
      paidDueResult=await request(paidDuePort,1,{...body,token:'paid-level-up-due-ticks'},'1',
        'adventure/stage/complete');
    assert.equal(paidDueResult.status,200,paidDueResult.body.toString());
    const paidDueOperation=JSON.parse(paidDueResult.body).operation,
      paidDueXp=paidDueApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?')
        .get(paidDueOperation.id),
      paidDueSkip=JSON.parse(paidDueApp.store.db.prepare('SELECT capture_json FROM stage_skip_claim WHERE operation_id=?')
        .get(paidDueOperation.id).capture_json),
      paidDueBefore=paidDueOperation.parameters.UserAdventureStage[0];
    assert.equal(paidDueSkip.spClock.savedSP,17);
    assert.equal(paidDueSkip.spBefore,19,'Two due ticks fund the paid skip before its level-up award');
    assert.equal(paidDueSkip.spClock.regenAt,at-40);
    assert.equal(paidDueXp.sp_before,18,'The award starts after regeneration and the signed debit');
    assert.equal(paidDueXp.sp_minimum,39);
    const paidDueRegen=paidDueApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,baseSP:19,baseSPUpdatedAt:at-40}})),
      paidDueRegenSave=await request(paidDuePort,2,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserInfo:md5(paidDueRegen)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserInfo:paidDueRegen},deleteItems:{}}],
        operations:[]},'2','user_data/push');
    assert.equal(paidDueRegenSave.status,200,'The original due-tick phase can save before the skip debit');
    const paidDueSpent=paidDueApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,baseSP:18}})),
      paidDueTickets=paidDueSeed.data.UserSkipTicket.map(row=>({...row,
        amount:row.skipTicketId===288000001?0:row.amount,signature:paidDueOperation.signature,
        bookEntryState:row.bookEntryState===1?3:row.bookEntryState})),
      paidDueSpentPut={UserInfo:paidDueSpent,UserSkipTicket:paidDueTickets},
      paidDueSpentSave=await request(paidDuePort,3,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(paidDueSpentPut)
          .map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:paidDueSpentPut,deleteItems:{}}],
        operations:[]},'3','user_data/push');
    assert.equal(paidDueSpentSave.status,200,'The tick-adjusted signed debit can save before XP');
    const paidDueFinal=paidDueApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,totalExp:paidDueXp.minimum_exp,level:2,
          baseSP:paidDueXp.sp_minimum}})),
      paidDueStage={...paidDueBefore,state:4,
        cumulativeClearCount:paidDueBefore.cumulativeClearCount+1,
        dailyClearCount:paidDueBefore.dailyClearCount+1,lastCompleteDateTime:at},
      paidDuePut=stageXpFixture(paidDueApp.store,{UserInfo:paidDueFinal,
        UserAdventureStage:paidDueApp.store.read('UserAdventureStage').data
          .map(row=>row.adventureStageId===stageId?paidDueStage:row)},[paidDueOperation]),
      paidDueAck=await request(paidDuePort,4,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(paidDuePut)
          .map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:paidDuePut,deleteItems:{}}],
        operations:[{id:paidDueOperation.id,verifier:paidDueOperation.token}]},'4','user_data/push');
    assert.equal(paidDueAck.status,200,'The due-tick debit and later XP/SP award can ACK together');

    const paidCapSeed=structuredClone(paidSeed);
    Object.assign(paidCapSeed.data.UserInfo[0].playerStatus,
      {baseSP:19,baseSPUpdatedAt:at-200});
    paidCapApp=createServer({database:path.join(directory,'paid-level-up-due-cap.sqlite'),
      seed:paidCapSeed,master,wallNowSeconds:()=>at});
    await new Promise(resolve=>paidCapApp.server.listen(0,'127.0.0.1',resolve));
    const paidCapPort=paidCapApp.server.address().port,
      paidCapResult=await request(paidCapPort,1,{...body,token:'paid-level-up-due-cap'},'1',
        'adventure/stage/complete');
    assert.equal(paidCapResult.status,200,paidCapResult.body.toString());
    const paidCapOperation=JSON.parse(paidCapResult.body).operation,
      paidCapXp=paidCapApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?')
        .get(paidCapOperation.id),
      paidCapSkip=JSON.parse(paidCapApp.store.db.prepare('SELECT capture_json FROM stage_skip_claim WHERE operation_id=?')
        .get(paidCapOperation.id).capture_json),
      paidCapBefore=paidCapOperation.parameters.UserAdventureStage[0];
    assert.equal(paidCapSkip.spBefore,20,'An already-due tick can reach the old-level cap');
    assert.equal(paidCapSkip.spClock.regenAt,at-20);
    assert.equal(paidCapXp.sp_before,19);
    assert.equal(paidCapXp.sp_minimum,40);
    const paidCapInfo=paidCapApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,totalExp:paidCapXp.minimum_exp,level:2,
          baseSP:paidCapXp.sp_minimum,baseSPUpdatedAt:at}})),
      paidCapTickets=paidCapSeed.data.UserSkipTicket.map(row=>({...row,
        amount:row.skipTicketId===288000001?0:row.amount,signature:paidCapOperation.signature,
        bookEntryState:row.bookEntryState===1?3:row.bookEntryState})),
      paidCapStage={...paidCapBefore,state:4,
        cumulativeClearCount:paidCapBefore.cumulativeClearCount+1,
        dailyClearCount:paidCapBefore.dailyClearCount+1,lastCompleteDateTime:at},
      paidCapPut=stageXpFixture(paidCapApp.store,{UserInfo:paidCapInfo,
        UserSkipTicket:paidCapTickets,
        UserAdventureStage:paidCapApp.store.read('UserAdventureStage').data
          .map(row=>row.adventureStageId===stageId?paidCapStage:row)},[paidCapOperation]),
      paidCapAck=await request(paidCapPort,2,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(paidCapPut)
          .map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:paidCapPut,deleteItems:{}}],
        operations:[{id:paidCapOperation.id,verifier:paidCapOperation.token}]},'2','user_data/push');
    assert.equal(paidCapAck.status,200,'Due-tick cap and full-bar stamp may reach the exact award target');

    const paidOvercapSeed=structuredClone(paidSeed);
    paidOvercapSeed.data.UserInfo[0].playerStatus.baseSP=22;
    paidOvercapApp=createServer({database:path.join(directory,'paid-level-up-overcap.sqlite'),
      seed:paidOvercapSeed,master,wallNowSeconds:()=>at});
    await new Promise(resolve=>paidOvercapApp.server.listen(0,'127.0.0.1',resolve));
    const paidOvercapPort=paidOvercapApp.server.address().port,
      paidOvercapResult=await request(paidOvercapPort,1,{...body,token:'paid-level-up-overcap'},'1',
        'adventure/stage/complete');
    assert.equal(paidOvercapResult.status,200,paidOvercapResult.body.toString());
    const paidOvercapOperation=JSON.parse(paidOvercapResult.body).operation,
      paidOvercapXp=paidOvercapApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?')
        .get(paidOvercapOperation.id),
      paidOvercapSkip=JSON.parse(paidOvercapApp.store.db.prepare('SELECT capture_json FROM stage_skip_claim WHERE operation_id=?')
        .get(paidOvercapOperation.id).capture_json),
      paidOvercapBefore=paidOvercapOperation.parameters.UserAdventureStage[0];
    assert.equal(paidOvercapSkip.spBefore,22,'Native full-stamina includes a balance above the old cap');
    assert.equal(paidOvercapSkip.spClock.maxSP,20);
    assert.equal(paidOvercapXp.sp_before,21);
    assert.equal(paidOvercapXp.sp_minimum,42);
    const paidOvercapInfo=paidOvercapApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,totalExp:paidOvercapXp.minimum_exp,level:2,
          baseSP:paidOvercapXp.sp_minimum,baseSPUpdatedAt:at}})),
      paidOvercapTickets=paidOvercapSeed.data.UserSkipTicket.map(row=>({...row,
        amount:row.skipTicketId===288000001?0:row.amount,signature:paidOvercapOperation.signature,
        bookEntryState:row.bookEntryState===1?3:row.bookEntryState})),
      paidOvercapStage={...paidOvercapBefore,state:4,
        cumulativeClearCount:paidOvercapBefore.cumulativeClearCount+1,
        dailyClearCount:paidOvercapBefore.dailyClearCount+1,lastCompleteDateTime:at},
      paidOvercapPut=stageXpFixture(paidOvercapApp.store,{UserInfo:paidOvercapInfo,
        UserSkipTicket:paidOvercapTickets,
        UserAdventureStage:paidOvercapApp.store.read('UserAdventureStage').data
          .map(row=>row.adventureStageId===stageId?paidOvercapStage:row)},[paidOvercapOperation]),
      paidOvercapAck=await request(paidOvercapPort,2,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(paidOvercapPut)
          .map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:paidOvercapPut,deleteItems:{}}],
        operations:[{id:paidOvercapOperation.id,verifier:paidOvercapOperation.token}]},'2','user_data/push');
    assert.equal(paidOvercapAck.status,200,'Over-cap full-stamina skip retains its debit and award');

    const paidDelayedSeed=structuredClone(paidSeed);
    Object.assign(paidDelayedSeed.data.UserInfo[0].playerStatus,
      {baseSP:17,baseSPUpdatedAt:at-30});
    let paidDelayedNow=at;
    paidDelayedApp=createServer({database:path.join(directory,'paid-level-up-later-tick.sqlite'),
      seed:paidDelayedSeed,master,wallNowSeconds:()=>paidDelayedNow});
    await new Promise(resolve=>paidDelayedApp.server.listen(0,'127.0.0.1',resolve));
    const paidDelayedPort=paidDelayedApp.server.address().port,
      paidDelayedResult=await request(paidDelayedPort,1,{...body,token:'paid-level-up-later-tick'},'1',
        'adventure/stage/complete');
    assert.equal(paidDelayedResult.status,200,paidDelayedResult.body.toString());
    const paidDelayedOperation=JSON.parse(paidDelayedResult.body).operation,
      paidDelayedBefore=paidDelayedOperation.parameters.UserAdventureStage[0],
      paidDelayedInitial=paidDelayedApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?')
        .get(paidDelayedOperation.id);
    assert.equal(paidDelayedInitial.sp_before,16);
    assert.equal(paidDelayedInitial.sp_minimum,37);
    paidDelayedNow+=200;
    const paidDelayedUnproved=paidDelayedApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,totalExp:paidDelayedInitial.minimum_exp,level:2,
          baseSP:38,baseSPUpdatedAt:at+150}})),
      paidDelayedUnprovedSave=await request(paidDelayedPort,2,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserInfo:md5(paidDelayedUnproved)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserInfo:paidDelayedUnproved},deleteItems:{}}],
        operations:[]},'2','user_data/push');
    assert.equal(paidDelayedUnprovedSave.status,400,'A later tick cannot mint an unobserved award');
    assert.equal(paidDelayedApp.store.db.prepare('SELECT sp_before FROM stage_xp_claim WHERE operation_id=?')
      .get(paidDelayedOperation.id).sp_before,16,'Refused atomic award cannot move the queued SP target');
    const paidDelayedTick=paidDelayedApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,baseSP:18,baseSPUpdatedAt:at+150}})),
      paidDelayedTickSave=await request(paidDelayedPort,3,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserInfo:md5(paidDelayedTick)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserInfo:paidDelayedTick},deleteItems:{}}],
        operations:[]},'3','user_data/push');
    assert.equal(paidDelayedTickSave.status,200,'A saved whole tick pins the later native SP baseline');
    const paidDelayedAdjusted=paidDelayedApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?')
      .get(paidDelayedOperation.id);
    assert.equal(paidDelayedAdjusted.sp_before,17);
    assert.equal(paidDelayedAdjusted.sp_minimum,38);
    assert(JSON.parse(paidDelayedApp.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?')
      .get(paidDelayedOperation.id).observed).includes(`skip:spTick:${at+150}`));
    const paidDelayedSpent=paidDelayedApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,baseSP:17}})),
      paidDelayedTickets=paidDelayedSeed.data.UserSkipTicket.map(row=>({...row,
        amount:row.skipTicketId===288000001?0:row.amount,signature:paidDelayedOperation.signature,
        bookEntryState:row.bookEntryState===1?3:row.bookEntryState})),
      paidDelayedSpentPut={UserInfo:paidDelayedSpent,UserSkipTicket:paidDelayedTickets},
      paidDelayedSpentSave=await request(paidDelayedPort,4,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(paidDelayedSpentPut)
          .map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:paidDelayedSpentPut,deleteItems:{}}],
        operations:[]},'4','user_data/push');
    assert.equal(paidDelayedSpentSave.status,200,'The signed debit uses the saved later tick');
    const paidDelayedFinal=paidDelayedApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,totalExp:paidDelayedAdjusted.minimum_exp,level:2,
          baseSP:paidDelayedAdjusted.sp_minimum}})),
      paidDelayedStage={...paidDelayedBefore,state:4,
        cumulativeClearCount:paidDelayedBefore.cumulativeClearCount+1,
        dailyClearCount:paidDelayedBefore.dailyClearCount+1,lastCompleteDateTime:paidDelayedNow},
      paidDelayedPut=stageXpFixture(paidDelayedApp.store,{UserInfo:paidDelayedFinal,
        UserAdventureStage:paidDelayedApp.store.read('UserAdventureStage').data
          .map(row=>row.adventureStageId===stageId?paidDelayedStage:row)},[paidDelayedOperation]),
      paidDelayedAck=await request(paidDelayedPort,5,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(paidDelayedPut)
          .map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:paidDelayedPut,deleteItems:{}}],
        operations:[{id:paidDelayedOperation.id,verifier:paidDelayedOperation.token}]},'5','user_data/push');
    assert.equal(paidDelayedAck.status,200,'Saved later tick and paid level-up ACK atomically');

    const paidLaterCapSeed=structuredClone(paidSeed);
    Object.assign(paidLaterCapSeed.data.UserInfo[0].playerStatus,
      {baseSP:19,baseSPUpdatedAt:at-30});
    let paidLaterCapNow=at;
    paidLaterCapApp=createServer({database:path.join(directory,'paid-level-up-later-cap.sqlite'),
      seed:paidLaterCapSeed,master,wallNowSeconds:()=>paidLaterCapNow});
    await new Promise(resolve=>paidLaterCapApp.server.listen(0,'127.0.0.1',resolve));
    const paidLaterCapPort=paidLaterCapApp.server.address().port,
      paidLaterCapResult=await request(paidLaterCapPort,1,{...body,token:'paid-level-up-later-cap'},'1',
        'adventure/stage/complete');
    assert.equal(paidLaterCapResult.status,200,paidLaterCapResult.body.toString());
    const paidLaterCapOperation=JSON.parse(paidLaterCapResult.body).operation,
      paidLaterCapBefore=paidLaterCapOperation.parameters.UserAdventureStage[0],
      paidLaterCapInitial=paidLaterCapApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?')
        .get(paidLaterCapOperation.id);
    assert.equal(paidLaterCapInitial.sp_before,18);
    assert.equal(paidLaterCapInitial.sp_minimum,39);
    paidLaterCapNow+=200;
    const paidLaterCapUnproved=paidLaterCapApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,totalExp:paidLaterCapInitial.minimum_exp,level:2,
          baseSP:40,baseSPUpdatedAt:paidLaterCapNow}})),
      paidLaterCapUnprovedSave=await request(paidLaterCapPort,2,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserInfo:md5(paidLaterCapUnproved)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserInfo:paidLaterCapUnproved},deleteItems:{}}],
        operations:[]},'2','user_data/push');
    assert.equal(paidLaterCapUnprovedSave.status,400,'Unobserved cap cannot mint a paid level-up');
    assert.equal(paidLaterCapApp.store.db.prepare('SELECT sp_before FROM stage_xp_claim WHERE operation_id=?')
      .get(paidLaterCapOperation.id).sp_before,18,'Refused cap award cannot move the queued SP target');
    const paidLaterCapRegen=paidLaterCapApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,baseSP:20,baseSPUpdatedAt:at+150}})),
      paidLaterCapRegenSave=await request(paidLaterCapPort,3,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserInfo:md5(paidLaterCapRegen)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserInfo:paidLaterCapRegen},deleteItems:{}}],
        operations:[]},'3','user_data/push');
    assert.equal(paidLaterCapRegenSave.status,200,'The exact later cap tick can save first');
    const paidLaterCapAdjusted=paidLaterCapApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?')
      .get(paidLaterCapOperation.id);
    assert.equal(paidLaterCapAdjusted.sp_before,19);
    assert.equal(paidLaterCapAdjusted.sp_minimum,40);
    assert(JSON.parse(paidLaterCapApp.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?')
      .get(paidLaterCapOperation.id).observed).includes('skip:spCap'));
    const paidLaterCapStamp=paidLaterCapApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,baseSPUpdatedAt:paidLaterCapNow}})),
      paidLaterCapStampSave=await request(paidLaterCapPort,4,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserInfo:md5(paidLaterCapStamp)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserInfo:paidLaterCapStamp},deleteItems:{}}],
        operations:[]},'4','user_data/push');
    assert.equal(paidLaterCapStampSave.status,200,'Full-bar callback stamps its own later time');
    const paidLaterCapSpent=paidLaterCapApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,baseSP:19}})),
      paidLaterCapTickets=paidLaterCapSeed.data.UserSkipTicket.map(row=>({...row,
        amount:row.skipTicketId===288000001?0:row.amount,signature:paidLaterCapOperation.signature,
        bookEntryState:row.bookEntryState===1?3:row.bookEntryState})),
      paidLaterCapSpentPut={UserInfo:paidLaterCapSpent,UserSkipTicket:paidLaterCapTickets},
      paidLaterCapSpentSave=await request(paidLaterCapPort,5,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(paidLaterCapSpentPut)
          .map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:paidLaterCapSpentPut,deleteItems:{}}],
        operations:[]},'5','user_data/push');
    assert.equal(paidLaterCapSpentSave.status,200,'The stamped full-bar SP debit can save');
    const paidLaterCapFinal=paidLaterCapApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,totalExp:paidLaterCapAdjusted.minimum_exp,level:2,
          baseSP:paidLaterCapAdjusted.sp_minimum}})),
      paidLaterCapStage={...paidLaterCapBefore,state:4,
        cumulativeClearCount:paidLaterCapBefore.cumulativeClearCount+1,
        dailyClearCount:paidLaterCapBefore.dailyClearCount+1,lastCompleteDateTime:paidLaterCapNow},
      paidLaterCapPut=stageXpFixture(paidLaterCapApp.store,{UserInfo:paidLaterCapFinal,
        UserAdventureStage:paidLaterCapApp.store.read('UserAdventureStage').data
          .map(row=>row.adventureStageId===stageId?paidLaterCapStage:row)},[paidLaterCapOperation]),
      paidLaterCapAck=await request(paidLaterCapPort,6,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(paidLaterCapPut)
          .map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:paidLaterCapPut,deleteItems:{}}],
        operations:[{id:paidLaterCapOperation.id,verifier:paidLaterCapOperation.token}]},'6','user_data/push');
    assert.equal(paidLaterCapAck.status,200,'Saved later cap, signed debit and level-up ACK together');

    const paidTwoPhaseSeed=structuredClone(paidSeed);
    Object.assign(paidTwoPhaseSeed.data.UserInfo[0].playerStatus,
      {baseSP:18,baseSPUpdatedAt:at-30});
    let paidTwoPhaseNow=at;
    paidTwoPhaseApp=createServer({database:path.join(directory,'paid-level-up-tick-then-cap.sqlite'),
      seed:paidTwoPhaseSeed,master,wallNowSeconds:()=>paidTwoPhaseNow});
    await new Promise(resolve=>paidTwoPhaseApp.server.listen(0,'127.0.0.1',resolve));
    const paidTwoPhasePort=paidTwoPhaseApp.server.address().port,
      paidTwoPhaseResult=await request(paidTwoPhasePort,1,{...body,token:'paid-level-up-tick-then-cap'},'1',
        'adventure/stage/complete');
    assert.equal(paidTwoPhaseResult.status,200,paidTwoPhaseResult.body.toString());
    const paidTwoPhaseOperation=JSON.parse(paidTwoPhaseResult.body).operation,
      paidTwoPhaseBefore=paidTwoPhaseOperation.parameters.UserAdventureStage[0],
      paidTwoPhaseInitial=paidTwoPhaseApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?')
        .get(paidTwoPhaseOperation.id);
    assert.equal(paidTwoPhaseInitial.sp_before,17);
    paidTwoPhaseNow+=380;
    const paidTwoPhaseTick=paidTwoPhaseApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,baseSP:19,baseSPUpdatedAt:at+150}})),
      paidTwoPhaseTickSave=await request(paidTwoPhasePort,2,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserInfo:md5(paidTwoPhaseTick)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserInfo:paidTwoPhaseTick},deleteItems:{}}],
        operations:[]},'2','user_data/push');
    assert.equal(paidTwoPhaseTickSave.status,200,'The first saved tick remains below cap');
    assert.equal(paidTwoPhaseApp.store.db.prepare('SELECT sp_before FROM stage_xp_claim WHERE operation_id=?')
      .get(paidTwoPhaseOperation.id).sp_before,18);
    const paidTwoPhaseCap=paidTwoPhaseApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,baseSP:20,baseSPUpdatedAt:at+330}})),
      paidTwoPhaseCapSave=await request(paidTwoPhasePort,3,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserInfo:md5(paidTwoPhaseCap)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserInfo:paidTwoPhaseCap},deleteItems:{}}],
        operations:[]},'3','user_data/push');
    assert.equal(paidTwoPhaseCapSave.status,200,'The second saved whole tick reaches cap before debit');
    const paidTwoPhaseAdjusted=paidTwoPhaseApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?')
      .get(paidTwoPhaseOperation.id),
      paidTwoPhaseObserved=JSON.parse(paidTwoPhaseApp.store.db.prepare(
        'SELECT observed FROM stage_delivery WHERE operation_id=?').get(paidTwoPhaseOperation.id).observed);
    assert.equal(paidTwoPhaseAdjusted.sp_before,19);
    assert.equal(paidTwoPhaseAdjusted.sp_minimum,40);
    assert(paidTwoPhaseObserved.includes(`skip:spTick:${at+150}`));
    assert(paidTwoPhaseObserved.includes('skip:spCap'));
    const paidTwoPhaseStamp=paidTwoPhaseApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,baseSPUpdatedAt:paidTwoPhaseNow}})),
      paidTwoPhaseStampSave=await request(paidTwoPhasePort,4,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserInfo:md5(paidTwoPhaseStamp)}},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserInfo:paidTwoPhaseStamp},deleteItems:{}}],
        operations:[]},'4','user_data/push');
    assert.equal(paidTwoPhaseStampSave.status,200,'The full-bar callback stamp follows the saved cap tick');
    const paidTwoPhaseSpent=paidTwoPhaseApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,baseSP:19}})),
      paidTwoPhaseTickets=paidTwoPhaseSeed.data.UserSkipTicket.map(row=>({...row,
        amount:row.skipTicketId===288000001?0:row.amount,signature:paidTwoPhaseOperation.signature,
        bookEntryState:row.bookEntryState===1?3:row.bookEntryState})),
      paidTwoPhaseSpentPut={UserInfo:paidTwoPhaseSpent,UserSkipTicket:paidTwoPhaseTickets},
      paidTwoPhaseSpentSave=await request(paidTwoPhasePort,5,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(paidTwoPhaseSpentPut)
          .map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:paidTwoPhaseSpentPut,deleteItems:{}}],
        operations:[]},'5','user_data/push');
    assert.equal(paidTwoPhaseSpentSave.status,200,'The signed cap debit retains the callback stamp');
    const paidTwoPhaseRegenAfterSpend=paidTwoPhaseApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,baseSP:20}})),
      paidTwoPhaseRegenAfterSpendSave=await request(paidTwoPhasePort,6,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserInfo:md5(paidTwoPhaseRegenAfterSpend)}},
        deltas:[{signature:0,trigger:'AdventureComplete',
          putItems:{UserInfo:paidTwoPhaseRegenAfterSpend},deleteItems:{}}],
        operations:[]},'6','user_data/push');
    assert.equal(paidTwoPhaseRegenAfterSpendSave.status,400,
      'A spent paid skip cannot regenerate to cap before its captured level-up award');
    assert.equal(paidTwoPhaseApp.store.read('UserInfo').data[0].playerStatus.baseSP,19);
    const paidTwoPhaseFinal=paidTwoPhaseApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,totalExp:paidTwoPhaseAdjusted.minimum_exp,level:2,
          baseSP:paidTwoPhaseAdjusted.sp_minimum}})),
      paidTwoPhaseStage={...paidTwoPhaseBefore,state:4,
        cumulativeClearCount:paidTwoPhaseBefore.cumulativeClearCount+1,
        dailyClearCount:paidTwoPhaseBefore.dailyClearCount+1,lastCompleteDateTime:paidTwoPhaseNow},
      paidTwoPhasePut=stageXpFixture(paidTwoPhaseApp.store,{UserInfo:paidTwoPhaseFinal,
        UserAdventureStage:paidTwoPhaseApp.store.read('UserAdventureStage').data
          .map(row=>row.adventureStageId===stageId?paidTwoPhaseStage:row)},[paidTwoPhaseOperation]),
      paidTwoPhaseAck=await request(paidTwoPhasePort,7,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(paidTwoPhasePut)
          .map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:paidTwoPhasePut,deleteItems:{}}],
        operations:[{id:paidTwoPhaseOperation.id,verifier:paidTwoPhaseOperation.token}]},'7','user_data/push');
    assert.equal(paidTwoPhaseAck.status,200,'Saved sub-cap tick and later cap can complete one paid ACK');

    const paidRepeatedSeed=structuredClone(paidSeed);
    Object.assign(paidRepeatedSeed.data.UserInfo[0].playerStatus,
      {baseSP:17,baseSPUpdatedAt:at-30});
    let paidRepeatedNow=at;
    paidRepeatedApp=createServer({database:path.join(directory,'paid-level-up-repeated-ticks.sqlite'),
      seed:paidRepeatedSeed,master,wallNowSeconds:()=>paidRepeatedNow});
    await new Promise(resolve=>paidRepeatedApp.server.listen(0,'127.0.0.1',resolve));
    const paidRepeatedPort=paidRepeatedApp.server.address().port,
      paidRepeatedResult=await request(paidRepeatedPort,1,{...body,token:'paid-level-up-repeated-ticks'},'1',
        'adventure/stage/complete');
    assert.equal(paidRepeatedResult.status,200,paidRepeatedResult.body.toString());
    const paidRepeatedOperation=JSON.parse(paidRepeatedResult.body).operation,
      paidRepeatedBefore=paidRepeatedOperation.parameters.UserAdventureStage[0];
    paidRepeatedNow+=380;
    for(const [sequence,sp,stamp,before] of [[2,18,at+150,17],[3,19,at+330,18]]) {
      const rows=paidRepeatedApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,baseSP:sp,baseSPUpdatedAt:stamp}})),
        saved=await request(paidRepeatedPort,sequence,{badges:null,scripts:{},dataTokens:{},
          checksums:{before:{},after:{UserInfo:md5(rows)}},
          deltas:[{signature:0,trigger:'AdventureComplete',putItems:{UserInfo:rows},deleteItems:{}}],
          operations:[]},String(sequence),'user_data/push');
      assert.equal(saved.status,200,'Each native below-cap tick may save in order');
      assert.equal(paidRepeatedApp.store.db.prepare('SELECT sp_before FROM stage_xp_claim WHERE operation_id=?')
        .get(paidRepeatedOperation.id).sp_before,before);
    }
    const paidRepeatedObserved=JSON.parse(paidRepeatedApp.store.db.prepare(
      'SELECT observed FROM stage_delivery WHERE operation_id=?').get(paidRepeatedOperation.id).observed);
    assert(paidRepeatedObserved.includes(`skip:spTick:${at+150}`));
    assert(paidRepeatedObserved.includes(`skip:spTick:${at+330}`));
    const paidRepeatedXp=paidRepeatedApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?')
      .get(paidRepeatedOperation.id);
    assert.equal(paidRepeatedXp.sp_minimum,39);
    const paidRepeatedSpent=paidRepeatedApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,baseSP:18}})),
      paidRepeatedTickets=paidRepeatedSeed.data.UserSkipTicket.map(row=>({...row,
        amount:row.skipTicketId===288000001?0:row.amount,signature:paidRepeatedOperation.signature,
        bookEntryState:row.bookEntryState===1?3:row.bookEntryState})),
      paidRepeatedSpentPut={UserInfo:paidRepeatedSpent,UserSkipTicket:paidRepeatedTickets},
      paidRepeatedSpentSave=await request(paidRepeatedPort,4,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(paidRepeatedSpentPut)
          .map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:paidRepeatedSpentPut,deleteItems:{}}],
        operations:[]},'4','user_data/push');
    assert.equal(paidRepeatedSpentSave.status,200,'The debit must spend from the latest saved tick');
    const paidRepeatedFinal=paidRepeatedApp.store.read('UserInfo').data.map(row=>({...row,
        playerStatus:{...row.playerStatus,totalExp:paidRepeatedXp.minimum_exp,level:2,
          baseSP:paidRepeatedXp.sp_minimum}})),
      paidRepeatedStage={...paidRepeatedBefore,state:4,
        cumulativeClearCount:paidRepeatedBefore.cumulativeClearCount+1,
        dailyClearCount:paidRepeatedBefore.dailyClearCount+1,lastCompleteDateTime:paidRepeatedNow},
      paidRepeatedPut=stageXpFixture(paidRepeatedApp.store,{UserInfo:paidRepeatedFinal,
        UserAdventureStage:paidRepeatedApp.store.read('UserAdventureStage').data
          .map(row=>row.adventureStageId===stageId?paidRepeatedStage:row)},[paidRepeatedOperation]),
      paidRepeatedAck=await request(paidRepeatedPort,5,{badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:Object.fromEntries(Object.entries(paidRepeatedPut)
          .map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems:paidRepeatedPut,deleteItems:{}}],
        operations:[{id:paidRepeatedOperation.id,verifier:paidRepeatedOperation.token}]},'5','user_data/push');
    assert.equal(paidRepeatedAck.status,200,'Ordered saved tick phases can complete the paid skip');

    for(const [kind,startingSP,finalSP,stamp] of [
      ['tick',17,38,at+150],['cap',19,40,at+200]
    ]) {
      const atomicSeed=structuredClone(paidSeed);
      Object.assign(atomicSeed.data.UserInfo[0].playerStatus,
        {baseSP:startingSP,baseSPUpdatedAt:at-30});
      let atomicNow=at;
      const atomicApp=createServer({database:path.join(directory,`paid-level-up-atomic-${kind}.sqlite`),
        seed:atomicSeed,master,wallNowSeconds:()=>atomicNow});
      if(kind==='tick') paidAtomicTickApp=atomicApp;
      else paidAtomicCapApp=atomicApp;
      await new Promise(resolve=>atomicApp.server.listen(0,'127.0.0.1',resolve));
      const atomicPort=atomicApp.server.address().port,
        issued=await request(atomicPort,1,{...body,token:`paid-level-up-atomic-${kind}`},'1',
          'adventure/stage/complete');
      assert.equal(issued.status,200,issued.body.toString());
      const atomicOperation=JSON.parse(issued.body).operation,
        atomicXp=atomicApp.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?')
          .get(atomicOperation.id),
        atomicBefore=atomicOperation.parameters.UserAdventureStage[0],
        atomicTickets=atomicSeed.data.UserSkipTicket.map(row=>({...row,
          amount:row.skipTicketId===288000001?0:row.amount,signature:atomicOperation.signature,
          bookEntryState:row.bookEntryState===1?3:row.bookEntryState}));
      atomicNow+=200;
      const atomicInfo=atomicApp.store.read('UserInfo').data.map(row=>({...row,
          playerStatus:{...row.playerStatus,totalExp:atomicXp.minimum_exp,level:2,
            baseSP:finalSP,baseSPUpdatedAt:stamp}})),
        wrongInfo=atomicInfo.map(row=>({...row,
          playerStatus:{...row.playerStatus,baseSP:finalSP+1}})),
        wrongPut={UserInfo:wrongInfo,UserSkipTicket:atomicTickets},
        wrong=await request(atomicPort,2,{badges:null,scripts:{},dataTokens:{},
          checksums:{before:{},after:Object.fromEntries(Object.entries(wrongPut)
            .map(([name,rows])=>[name,md5(rows)]))},
          deltas:[{signature:0,trigger:'AdventureComplete',putItems:wrongPut,deleteItems:{}}],
          operations:[]},'2','user_data/push');
      assert.equal(wrong.status,400,'An atomic paid skip must reject a non-native SP award');
      assert.equal(atomicApp.store.db.prepare('SELECT sp_before FROM stage_xp_claim WHERE operation_id=?')
        .get(atomicOperation.id).sp_before,startingSP-1);
      const atomicStage={...atomicBefore,state:4,
          cumulativeClearCount:atomicBefore.cumulativeClearCount+1,
          dailyClearCount:atomicBefore.dailyClearCount+1,lastCompleteDateTime:atomicNow},
        atomicPut=stageXpFixture(atomicApp.store,{UserInfo:atomicInfo,UserSkipTicket:atomicTickets,
          UserAdventureStage:atomicApp.store.read('UserAdventureStage').data.map(row=>
            row.adventureStageId===stageId?atomicStage:row)},[atomicOperation]),
        ack=await request(atomicPort,3,{badges:null,scripts:{},dataTokens:{},
          checksums:{before:{},after:Object.fromEntries(Object.entries(atomicPut)
            .map(([name,rows])=>[name,md5(rows)]))},
          deltas:[{signature:0,trigger:'AdventureComplete',putItems:atomicPut,deleteItems:{}}],
          operations:[{id:atomicOperation.id,verifier:atomicOperation.token}]},'3','user_data/push');
      assert.equal(ack.status,200,`Exact atomic paid ${kind} callback can save and ACK`);
      assert(atomicApp.store.db.prepare('SELECT id FROM operation_done WHERE id=?').get(atomicOperation.id));
      const settledXp=atomicApp.store.db.prepare('SELECT sp_before,sp_minimum FROM stage_xp_claim WHERE operation_id=?')
          .get(atomicOperation.id),
        settledObserved=JSON.parse(atomicApp.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?')
          .get(atomicOperation.id).observed);
      assert.equal(settledXp.sp_before,finalSP-atomicXp.sp_amount);
      assert.equal(settledXp.sp_minimum,finalSP);
      assert(settledObserved.includes(kind==='tick'?`skip:spTick:${stamp}`:'skip:spCap'));
      assert(settledObserved.includes('skip:sp'));
    }

  } finally {
    if(overlapAtomicApp) await overlapAtomicApp.close();
    if(overlapDelayedApp) await overlapDelayedApp.close();
    if(overlapApp) await overlapApp.close();
    if(paidAtomicCapApp) await paidAtomicCapApp.close();
    if(paidAtomicTickApp) await paidAtomicTickApp.close();
    if(paidRepeatedApp) await paidRepeatedApp.close();
    if(paidTwoPhaseApp) await paidTwoPhaseApp.close();
    if(paidLaterCapApp) await paidLaterCapApp.close();
    if(paidDelayedApp) await paidDelayedApp.close();
    if(paidOvercapApp) await paidOvercapApp.close();
    if(paidCapApp) await paidCapApp.close();
    if(paidDueApp) await paidDueApp.close();
    if(paidSubcapApp) await paidSubcapApp.close();
    if(paidSpOnlyApp) await paidSpOnlyApp.close();
    if(paidTicketOnlyApp) await paidTicketOnlyApp.close();
    if(paidApp) await paidApp.close();
    if(zeroTicketFirstApp) await zeroTicketFirstApp.close();
    if(zeroApp) await zeroApp.close();
    if(optionalApp) await optionalApp.close();
    if(coalescedApp) await coalescedApp.close();
    if(resetApp) await resetApp.close();
    if(capApp) await capApp.close();
    if(lateApp) await lateApp.close();
    if(bareApp) await bareApp.close();
    await app.close();
    fs.rmSync(directory,{recursive:true,force:true});
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
