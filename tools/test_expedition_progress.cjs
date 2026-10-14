'use strict';

// DEFERRED, NOT RUN: source-derived rules and synthetic prerequisite/save
// fixtures. These are not naturally earned timers, native signatures, actual
// callback ordering, hot/cold application, UI acceptance or performance proof.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const { createServer,expeditionInitialStage,expeditionListenerScope,expeditionCompletionStages,
  OFFLINE_UNAVAILABLE_CODE }=require('./danmemore_server.cjs');
const { request }=require('./test_danmemore_server.cjs');
const { itemDeltas }=require('./test_friendship_rewards.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
const same=require('node:util').isDeepStrictEqual;

async function main() {
  const at=master.expeditionStages[707000026].startAt+86400,
    scope=expeditionListenerScope(master,at),end=master.expeditionStages[707000026].endAt;
  assert.ok(scope.includes(707000026) && scope.includes(707000027));
  const future=scope.find(id=>master.expeditionStages[id].startAt>at);
  assert.ok(future,'Listeners include authored future stages; startAt is not an observer filter');
  assert.ok(expeditionListenerScope(master,end).includes(707000026));
  assert.ok(!expeditionListenerScope(master,end+1).includes(707000026));
  assert.equal(expeditionListenerScope({ ...master,expeditionStageRequirements:{} },at),null);
  const started=id=>({ ...expeditionInitialStage(id,master),completionState:3,dispatchState:1,
    startAt:at-master.expeditionStages[id].duration,firstTryDateTime:at-master.expeditionStages[id].duration,
    lastTryDateTime:at-master.expeditionStages[id].duration });
  for (const outcome of [0,1,2]) {
    const own=started(707000026),before=new Map([[own.expeditionStageId,own]]),
      targets=expeditionCompletionStages(before,own,outcome,master,scope),next=targets.get(707000027);
    assert.equal(targets.get(707000026).completionState,outcome===2?5:4);
    assert.equal(targets.get(707000026).cumulativeClearCount,0);
    assert.equal(targets.get(707000026).otherClearCount,0);
    if (outcome===2) assert.deepEqual(next,{ ...expeditionInitialStage(707000027,master),completionState:1 });
    else assert.equal(next,undefined,'Hidden predecessor stage is not materialized by normal/failure');
    assert.deepEqual(before,new Map([[own.expeditionStageId,own]]),'Projection does not pre-credit actual userdata');
  }
  const own=started(707000026),peer={ ...expeditionInitialStage(707000027,master),completionState:1,otherClearCount:9 };
  for (const outcome of [0,1,2]) {
    const targets=expeditionCompletionStages(new Map([[own.expeditionStageId,own],[peer.expeditionStageId,peer]]),own,outcome,master,scope);
    assert.deepEqual(targets.get(peer.expeditionStageId),outcome===0?undefined:{ ...peer,completionState:2,otherClearCount:0 });
  }
  const reached={ ...peer,otherClearCount:10 };
  assert.deepEqual(expeditionCompletionStages(new Map([[own.expeditionStageId,own],[reached.expeditionStageId,reached]]),own,0,master,scope)
    .get(reached.expeditionStageId),{ ...reached,completionState:2,otherClearCount:0 },'Failure still evaluates an already reached threshold');
  const ready={ ...peer,completionState:2,otherClearCount:3 };
  assert.equal(expeditionCompletionStages(new Map([[own.expeditionStageId,own],[ready.expeditionStageId,ready]]),own,2,master,scope)
    .get(ready.expeditionStageId),undefined,'Ready state has no observer mapping');
  const normal=started(707000028),locked={ ...peer,otherClearCount:0 };
  for (const outcome of [1,2]) assert.equal(expeditionCompletionStages(new Map([[normal.expeditionStageId,normal],
    [locked.expeditionStageId,locked]]),normal,outcome,master,scope).get(locked.expeditionStageId).otherClearCount,1);
  const active={ ...started(707000027),completionState:4,otherClearCount:9 },
    relocked=expeditionCompletionStages(new Map([[own.expeditionStageId,own],[active.expeditionStageId,active]]),own,2,master,scope)
      .get(active.expeditionStageId);
  assert.deepEqual(relocked,{ ...active,completionState:1 },'Observers do not ignore an active repeat dispatch');
  const unlocked=expeditionCompletionStages(new Map([[normal.expeditionStageId,normal],[active.expeditionStageId,relocked]]),normal,1,master,scope)
    .get(active.expeditionStageId);
  assert.deepEqual(unlocked,{ ...active,completionState:2,otherClearCount:0 });
  assert.equal(expeditionCompletionStages(new Map([[active.expeditionStageId,relocked]]),relocked,1,master,scope)
    .get(active.expeditionStageId).completionState,4,'A proven relocked active timer can still finish');
  const cycle=started(707000070);
  assert.equal(expeditionCompletionStages(new Map([[cycle.expeditionStageId,cycle]]),cycle,2,master,scope).get(cycle.expeditionStageId).completionState,1);
  assert.equal(expeditionCompletionStages(new Map([[cycle.expeditionStageId,cycle]]),cycle,2,master,[]).get(cycle.expeditionStageId).completionState,5,
    'An expired/non-subscribed self-cycle does not observe its own event');

  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-expedition-progress-')),realRandom=crypto.randomInt;
  let database=path.join(directory,'profile.sqlite'),app,port,sequence=0,now=at,outcomeRolls=[0,0];
  crypto.randomInt=(max,...args)=>!args.length && max===100 ? (outcomeRolls.shift() ?? 0) :
    !args.length && max===10000 ? 0 : realRandom(max,...args);
  const open=async()=>{
    app=createServer({ database,seed,master,wallNowSeconds:()=>now,log:()=>{} });
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve)); port=app.server.address().port;
  };
  const close=async()=>{ if (app) { await app.close(); app=null; } };
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=response=>{ assert.equal(response.status,200,response.body.toString()); return JSON.parse(response.body); };
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name })=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const push=(putItems,ops=[],deleteItems={})=>send('user_data/push',{ badges:null,scripts:{},dataTokens:{},
    checksums:{ before:{},after:Object.fromEntries([...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])]
      .map(name=>[name,md5(putItems[name] ?? [])])) },
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length ?
      [{ signature:0,trigger:'ExpeditionComplete',putItems,deleteItems }] : [],
    operations:ops.map(operation=>({ id:operation.id,verifier:operation.token })) });
  const reject=async(promise,status,previous,unavailable=false)=>{
    const response=await promise; assert.equal(response.status,status,response.body.toString());
    assert.equal(snapshot(),previous);
    if (unavailable) assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  // Two synthetic disjoint owned teams allow overlapping issued collections.
  // Starting these historically locked stages is a fixture prerequisite only,
  // not evidence that natural unlock/dispatch was earned in the client.
  const units=(first)=>Array.from({ length:8 },(_,i)=>{
    const [id,original]=Object.entries(master.pcProfiles).find(([,row])=>row.characterId===first+i && row.jobIds.length);
    return { ...seed.data.UserPC[0],pcId:Number(id),currentJobIndex:original.jobIds.length,
      totalExp:master.pcLevels[original.levelUpType].find(([level])=>level===80)[1],limitbreakCount:0,
      equippedWeaponIndex:0,equippedArmorIndex:0 };
  });
  const body=id=>{
    const entries=app.store.expeditionPartyEntries(id);
    return { expeditionStageId:id,totalLevel:entries.reduce((n,row)=>n+row.level,0),totalStatus:entries.reduce((n,row)=>n+row.status,0),
      entryPcs:entries.map(({ characterId,level,status })=>({ characterId,level,status })),friendshipStates:entries.map(({ characterId })=>{
        const cp=app.store.read('UserCharacter').data.find(row=>row.characterId===characterId).friendship;
        return { characterId,friendship:cp,friendshipLv:master.characters[characterId].levels.findLast(([,value])=>value<=cp)[0],userHeroType:0 };
      }) };
  };
  try {
    await open();
    // Second team omits all four original028 preferred characters, so its
    // great rate is exactly zero, independently of synthetic level/stat size.
    const teams=[units(101000030),units(101000046)],all=teams.flat();
    put('UserPC',[...app.store.read('UserPC').data.filter(row=>!all.some(pc=>pc.pcId===row.pcId)),...all]);
    put('UserExpeditionStage',[started(707000026),started(707000028),{
      ...expeditionInitialStage(707000027,master),completionState:4,firstTryDateTime:at-86400,lastTryDateTime:at-86400,
      firstCompleteDateTime:at-43200,lastCompleteDateTime:at-43200 }]);
    put('UserExpeditionParty',teams.map((team,index)=>({ userId:seed.userId,expeditionStageId:[707000026,707000028][index],
      slots:Array.from({ length:4 },(_,i)=>({ slotNumber:i+1,pcId:team[i*2].pcId,assistingPcId:team[i*2+1].pcId })) })));
    const timer=parse(await send('expedition/times',{ expeditionStageId:707000027 })).operations[0];
    assert.equal(timer.type,20000);
    parse(await push({ UserExpeditionStage:[{ ...timer.parameters.UserExpeditionStage,dispatchState:1 }] }));
    const firstBody=body(707000026),initialRows=app.store.read('UserExpeditionStage');
    const first=parse(await send('expedition/complete',firstBody)).operations[0];
    assert.equal(first.parameters.drawStatus,2); assert.deepEqual(app.store.read('UserExpeditionStage'),initialRows);
    const firstReceipt=app.store.expeditionStageReceipt(first);
    assert.equal(firstReceipt.claims.find(row=>row.stage_id===707000027).after.completionState,1);
    outcomeRolls=[0,99];
    const second=parse(await send('expedition/complete',body(707000028))).operations[0];
    assert.equal(second.parameters.drawStatus,1);
    const secondReceipt=app.store.expeditionStageReceipt(second),peerTarget=secondReceipt.claims.find(row=>row.stage_id===707000027).after;
    assert.equal(peerTarget.otherClearCount,1);
    const targets=new Map([...firstReceipt.claims,...secondReceipt.claims].map(row=>[row.stage_id,row.after])),stageRows=[...targets.values()];
    let before=snapshot();
    await reject(push({ UserExpeditionStage:stageRows.map(row=>row.expeditionStageId===707000027?{ ...row,otherClearCount:2 }:row) }),503,before,true);
    for (const [table,mode] of [['expedition_stage_claim','UPDATE'],['expedition_stage_floor','INSERT'],['profile','UPDATE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_dispatch_proof BEFORE ${mode} ON ${table} BEGIN SELECT RAISE(ABORT,'dispatch proof rollback'); END`);
      before=snapshot(); await reject(push({ UserExpeditionStage:stageRows }),503,before);
      app.store.db.exec('DROP TRIGGER fail_dispatch_proof');
    }
    // Save peer/own stage effects separately before reward inventory/CP/XP.
    assert.ok(parse(await push({ UserExpeditionStage:stageRows })).operations.every(operation=>![20000,21000].includes(operation.type)));
    assert.ok(app.store.db.prepare('SELECT effect_saved FROM expedition_stage_claim').all().every(row=>row.effect_saved===1));
    await close(); await open();
    assert.equal(app.store.expeditionStageReceipt(first,false).claims.find(row=>row.stage_id===707000027).effect_saved,1);
    const floor=app.store.db.prepare('SELECT * FROM expedition_stage_floor WHERE stage_id=?').get(707000027);
    app.store.db.prepare('DELETE FROM expedition_stage_floor WHERE stage_id=?').run(707000027);
    before=snapshot(); await reject(push({ UserExpeditionStage:stageRows }),503,before,true);
    app.store.db.prepare('INSERT INTO expedition_stage_floor(stage_id,state_json,operation_id) VALUES(?,?,?)')
      .run(floor.stage_id,floor.state_json,floor.operation_id);
    before=snapshot(); await reject(push({ UserExpeditionStage:firstReceipt.claims.map(row=>row.after) }),503,before,true);
    // WRITTEN ONLY: a completely saved broadcast skips the own+peer
    // stageFinish/dispatch pair and continues every later callback.
    const firstClaims=app.store.expeditionStageReceipt(first,false).claims;
    assert.ok(firstClaims.length>1);
    const recoveredFirst=app.store.expeditionColdRecovery(first);
    assert.equal(recoveredFirst.parameters.offlineExpeditionStageApplied,1);
    assert.equal(recoveredFirst.parameters.offlineExpeditionXpApplied,undefined);
    assert.equal(recoveredFirst.parameters.offlineExpeditionPartyApplied,undefined);
    assert.throws(()=>app.store.expeditionColdRecovery(first,{...recoveredFirst,parameters:{
      ...recoveredFirst.parameters,offlineExpeditionStageApplied:2 }}),error=>error.status===503);
    assert.deepEqual(parse(await send('expedition/complete',firstBody)).operations[0],recoveredFirst);
    // The second operation reserves inventory after the still-unacknowledged
    // first result. Resume surfaces deliver only the oldest callback; a direct
    // later retry refuses until that durable predecessor is acknowledged.
    assert.throws(()=>app.store.expeditionColdRecovery(second),error=>error.status===503);
    before=snapshot();await reject(send('expedition/complete',body(707000028)),503,before,true);
    for (const [action,value] of [['user_data/confirm',undefined],['user_data/pull',{ tables:['UserExpeditionStage'] }],
      ['user/login',undefined]]) {
      const operations=parse(await send(action,value)).operations;
      assert.deepEqual(operations.find(row=>row.id===first.id),recoveredFirst);
      assert.equal(operations.some(row=>row.id===second.id),false);
    }
    const rewardPuts=operation=>({UserCharacter:operation.parameters.friendshipStates.map(state=>({
      ...app.store.read('UserCharacter').data.find(row=>row.characterId===state.characterId),friendship:state.friendship})),
      ...itemDeltas(app.store,operation)}),firstPuts=rewardPuts(first),firstDeletes={
        UserExpeditionParty:[{expeditionStageId:707000026}]};
    for (const [table,mode] of [['operation_done','INSERT'],['operation_queue','DELETE']]) {
      app.store.db.exec(`CREATE TRIGGER fail_dispatch_ack BEFORE ${mode} ON ${table} BEGIN SELECT RAISE(ABORT,'dispatch ACK rollback'); END`);
      before=snapshot(); await reject(push(firstPuts,[first],firstDeletes),503,before);
      app.store.db.exec('DROP TRIGGER fail_dispatch_ack');
    }
    parse(await push(firstPuts,[first],firstDeletes));
    assert.ok(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(first.id));
    assert.ok(app.store.operations().some(row=>row.id===second.id));
    await close();await open();
    const recoveredSecond=app.store.expeditionColdRecovery(second);
    assert.equal(recoveredSecond.parameters.offlineExpeditionStageApplied,1);
    for(const [action,value] of [['user_data/confirm',undefined],['user_data/pull',{tables:['UserExpeditionStage']}],['user/login',undefined]])
      assert.deepEqual(parse(await send(action,value)).operations.find(row=>row.id===second.id),recoveredSecond);
    const secondPuts=rewardPuts(second),secondDeletes={UserExpeditionParty:[{expeditionStageId:707000028}]};
    for (const [table,mode] of [['operation_done','INSERT'],['operation_queue','DELETE']]) {
      app.store.db.exec(`CREATE TRIGGER fail_dispatch_ack BEFORE ${mode} ON ${table} BEGIN SELECT RAISE(ABORT,'dispatch ACK rollback'); END`);
      before=snapshot(); await reject(push(secondPuts,[timer,second],secondDeletes),503,before);
      app.store.db.exec('DROP TRIGGER fail_dispatch_ack');
    }
    parse(await push(secondPuts,[timer,second],secondDeletes));
    assert.ok([timer,first,second].every(operation=>app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id)));
    assert.equal(app.store.operations().length,0);
    assert.equal(app.store.read('UserExpeditionStage').data.find(row=>row.expeditionStageId===707000027).otherClearCount,1);
    assert.ok(app.store.expeditionStagePlan().observedActive.has(707000027),'Persisted peer proof retains collectability of the relocked timer');

    // WRITTEN ONLY: isolated all-saved own+peer broadcast resumes through every
    // cold delivery surface, then the original remaining rewards and ACK finish.
    await close();database=path.join(directory,'stage-broadcast-recovery.sqlite');now=at;outcomeRolls=[0,0];await open();
    const recoveryTeam=teams[0],recoveryStage=started(707000026),recoveryPeer=expeditionInitialStage(707000027,master),
      existingStages=app.store.read('UserExpeditionStage').data,
      existingParties=app.store.read('UserExpeditionParty').data;
    put('UserPC',[...app.store.read('UserPC').data.filter(row=>!recoveryTeam.some(pc=>pc.pcId===row.pcId)),...recoveryTeam]);
    put('UserExpeditionStage',[...existingStages.filter(row=>![recoveryStage.expeditionStageId,recoveryPeer.expeditionStageId]
      .includes(row.expeditionStageId)),recoveryStage,recoveryPeer]);
    put('UserExpeditionParty',[...existingParties.filter(row=>row.expeditionStageId!==recoveryStage.expeditionStageId),{
      userId:seed.userId,expeditionStageId:recoveryStage.expeditionStageId,slots:Array.from({length:4},(_,i)=>({
        slotNumber:i+1,pcId:recoveryTeam[i*2].pcId,assistingPcId:recoveryTeam[i*2+1].pcId}))}]);
    const recoveryBody=body(recoveryStage.expeditionStageId),recoveryOperation=parse(await send('expedition/complete',recoveryBody)).operations[0],
      recoveryReceipt=app.store.expeditionStageReceipt(recoveryOperation),recoveryRows=new Map(app.store.read('UserExpeditionStage').data
        .map(row=>[row.expeditionStageId,row]));
    assert.equal(recoveryOperation.parameters.drawStatus,2);assert.ok(recoveryReceipt.claims.length>1);
    for(const claim of recoveryReceipt.claims) recoveryRows.set(claim.stage_id,claim.after);
    assert.ok(parse(await push({UserExpeditionStage:[...recoveryRows.values()]})).operations.every(row=>row.id!==recoveryOperation.id));
    await close();await open();
    const recoveryClaims=app.store.expeditionStageReceipt(recoveryOperation,false).claims;
    assert.ok(recoveryClaims.every(row=>row.effect_saved===1));
    const recovered=app.store.expeditionColdRecovery(recoveryOperation);
    assert.equal(recovered.parameters.offlineExpeditionStageApplied,1);
    assert.deepEqual(parse(await send('expedition/complete',recoveryBody)).operations[0],recovered);
    for(const [action,value] of [['user_data/confirm',undefined],['user_data/pull',{tables:['UserExpeditionStage']}],['user/login',undefined]])
      assert.deepEqual(parse(await send(action,value)).operations.find(row=>row.id===recoveryOperation.id),recovered);
    const recoveryPuts={UserCharacter:recoveryOperation.parameters.friendshipStates.map(state=>({
      ...app.store.read('UserCharacter').data.find(row=>row.characterId===state.characterId),friendship:state.friendship}))};
    for(const [name,rows] of Object.entries(itemDeltas(app.store,recoveryOperation))) recoveryPuts[name]=rows;
    parse(await push(recoveryPuts,[recoveryOperation],{UserExpeditionParty:[{expeditionStageId:recoveryStage.expeditionStageId}]}));
    assert.ok(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(recoveryOperation.id));

    // WRITTEN ONLY: one durably saved idempotent peer/own claim may coexist
    // with missing claims when replay from the exact mixed rows reaches only
    // original targets and leaves the saved claim unchanged.
    await close();database=path.join(directory,'stage-broadcast-mixed-idempotent.sqlite');now=at;outcomeRolls=[0,0];await open();
    const mixedTeam=teams[0],mixedStage=started(707000026),mixedPeer=expeditionInitialStage(707000027,master),
      mixedExistingStages=app.store.read('UserExpeditionStage').data,mixedExistingParties=app.store.read('UserExpeditionParty').data;
    put('UserPC',[...app.store.read('UserPC').data.filter(row=>!mixedTeam.some(pc=>pc.pcId===row.pcId)),...mixedTeam]);
    put('UserExpeditionStage',[...mixedExistingStages.filter(row=>![mixedStage.expeditionStageId,mixedPeer.expeditionStageId]
      .includes(row.expeditionStageId)),mixedStage,mixedPeer]);
    put('UserExpeditionParty',[...mixedExistingParties.filter(row=>row.expeditionStageId!==mixedStage.expeditionStageId),{
      userId:seed.userId,expeditionStageId:mixedStage.expeditionStageId,slots:Array.from({length:4},(_,i)=>(
        {slotNumber:i+1,pcId:mixedTeam[i*2].pcId,assistingPcId:mixedTeam[i*2+1].pcId}))}]);
    const mixedBody=body(mixedStage.expeditionStageId),mixedOperation=parse(await send('expedition/complete',mixedBody)).operations[0],
      mixedReceipt=app.store.expeditionStageReceipt(mixedOperation),mixedClaimIds=new Set(mixedReceipt.claims.map(row=>row.stage_id)),
      safeSavedClaim=mixedReceipt.claims.find(candidate=>{
        const current=new Map(mixedReceipt.rows);current.set(candidate.stage_id,candidate.after);
        const replay=expeditionCompletionStages(current,mixedOperation.parameters.UserExpeditionStage,
          mixedOperation.parameters.drawStatus,master,mixedReceipt.scope);
        return replay && [...replay.keys()].every(id=>mixedClaimIds.has(id)) && mixedReceipt.claims.every(claim=>{
          const currentStage=current.get(claim.stage_id) ?? expeditionInitialStage(claim.stage_id,master),
            replayedStage=replay.get(claim.stage_id) ?? currentStage;
          return claim.stage_id===candidate.stage_id ? same(replayedStage,currentStage) : same(replayedStage,claim.after);
        });
      });
    assert.ok(safeSavedClaim && mixedReceipt.claims.length>1);
    const mixedRows=new Map(app.store.read('UserExpeditionStage').data.map(row=>[row.expeditionStageId,row]));
    mixedRows.set(safeSavedClaim.stage_id,safeSavedClaim.after);
    const mixedSave=parse(await push({UserExpeditionStage:[...mixedRows.values()]}));
    assert(!mixedSave.operations.some(row=>row.id===mixedOperation.id));
    const mixedClaims=app.store.expeditionStageReceipt(mixedOperation,false).claims;
    assert.deepEqual(mixedClaims.filter(row=>row.effect_saved).map(row=>row.stage_id),[safeSavedClaim.stage_id]);
    const mixedRecovered=app.store.expeditionColdRecovery(mixedOperation);
    assert.deepEqual(mixedRecovered,mixedOperation);assert.equal(mixedRecovered.parameters.offlineExpeditionStageApplied,undefined);
    await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===mixedOperation.id),mixedOperation);
    const mixedFinalRows=new Map(app.store.read('UserExpeditionStage').data.map(row=>[row.expeditionStageId,row]));
    for(const claim of mixedReceipt.claims) mixedFinalRows.set(claim.stage_id,claim.after);
    parse(await push({...rewardPuts(mixedOperation),UserExpeditionStage:[...mixedFinalRows.values()]},[mixedOperation],{
      UserExpeditionParty:[{expeditionStageId:mixedStage.expeditionStageId}]}));
    assert.ok(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(mixedOperation.id));

    // WRITTEN ONLY: a saved type2 peer counter cannot replay because the same
    // event would increment it again before evaluating the threshold.
    await close();database=path.join(directory,'stage-broadcast-mixed-counter-refusal.sqlite');now=at;outcomeRolls=[0,99];await open();
    const unsafeTeam=teams[1],unsafeStage=started(707000028),unsafePeer={
      ...expeditionInitialStage(707000027,master),completionState:1,otherClearCount:0},
      unsafeExistingStages=app.store.read('UserExpeditionStage').data,unsafeExistingParties=app.store.read('UserExpeditionParty').data;
    put('UserPC',[...app.store.read('UserPC').data.filter(row=>!unsafeTeam.some(pc=>pc.pcId===row.pcId)),...unsafeTeam]);
    put('UserExpeditionStage',[...unsafeExistingStages.filter(row=>![unsafeStage.expeditionStageId,unsafePeer.expeditionStageId]
      .includes(row.expeditionStageId)),unsafeStage,unsafePeer]);
    put('UserExpeditionParty',[...unsafeExistingParties.filter(row=>row.expeditionStageId!==unsafeStage.expeditionStageId),{
      userId:seed.userId,expeditionStageId:unsafeStage.expeditionStageId,slots:Array.from({length:4},(_,i)=>(
        {slotNumber:i+1,pcId:unsafeTeam[i*2].pcId,assistingPcId:unsafeTeam[i*2+1].pcId}))}]);
    const unsafeOperation=parse(await send('expedition/complete',body(unsafeStage.expeditionStageId))).operations[0],
      unsafeReceipt=app.store.expeditionStageReceipt(unsafeOperation),
      unsafePeerClaim=unsafeReceipt.claims.find(row=>row.stage_id===unsafePeer.expeditionStageId),
      unsafeRows=new Map(app.store.read('UserExpeditionStage').data.map(row=>[row.expeditionStageId,row]));
    assert.equal(unsafeOperation.parameters.drawStatus,1);assert.equal(unsafePeerClaim.after.otherClearCount,1);
    unsafeRows.set(unsafePeerClaim.stage_id,unsafePeerClaim.after);
    assert(!parse(await push({UserExpeditionStage:[...unsafeRows.values()]})).operations.some(row=>row.id===unsafeOperation.id));
    assert.throws(()=>app.store.expeditionColdRecovery(unsafeOperation),/cannot be replayed idempotently/);
    before=snapshot();await reject(send('user_data/confirm'),503,before,true);
  } finally { crypto.randomInt=realRandom; await close(); fs.rmSync(directory,{ recursive:true,force:true }); }
  console.log('Deferred source-derived dispatch progression fixtures completed; not native/UI proof');
}
if (require.main===module) main().catch(error=>{ console.error(error.stack); process.exitCode=1; });
