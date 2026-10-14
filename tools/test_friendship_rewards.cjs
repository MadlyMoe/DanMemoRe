'use strict';

// DEFERRED: authored quantities and synthetic native-shaped saves, not earned
// eligibility, actual native boosters/XP/SP, signatures or client/UI acceptance.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createServer,OFFLINE_UNAVAILABLE_CODE,expeditionCompletionStage } = require('./danmemore_server.cjs');
const { request,friendshipUnlockFixture } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

function itemDeltas(store,operation) {
  const result = {}, amounts = new Map();
  const boosts = operation.type === 21000 ? store.expeditionBoosts(
    store.expeditionBoostInputs(operation.parameters.UserExpeditionStage.expeditionStageId)) : null;
  for (const row of operation.parameters.gainedItems) {
    const id = row.itemId ?? row.rewardId;
    const amount = operation.type === 21000 && id === master.currencies['currency.valis']
      ? Math.trunc(Math.fround(Math.fround(row.amount)*boosts.boost_valis)) : row.amount;
    amounts.set(id,(amounts.get(id) ?? 0)+amount);
  }
  for (const [id,amount] of amounts) {
    if (id === master.currencies['currency.gem']) continue;
    if (operation.type === 21000 && id === master.currencies['currency.casino_medal']) {
      const before = store.read('UserCasinoState').data[0];
      result.UserCasinoState = [{ ...before,medalAmount:before.medalAmount+amount,
        cumulativeMedalAmount:before.cumulativeMedalAmount+amount,signature:operation.signature }];
      continue;
    }
    const profile = master.itemProfiles[id], before = (store.read(profile.table).data ?? []).find(row => row[profile.idField] === id),
      capped=[11000,21000].includes(operation.type) && (before?.cumulativeAmount ?? 0)+amount>=999999999,
      maximum=id===master.currencies['currency.valis']?2000000000:999999999;
    const item = { ...before,userId:seed.userId,[profile.idField]:id,signature:capped?operation.signature:before?.signature ?? 0,
      ...(profile.table==='UserAdventureTicket' && !before?{lastResetAt:0}:{}),
      ...(profile.table==='UserCurrency' && !before?{reservedAmount:0}:{}),
      ...(profile.table==='UserMemoriaExpItem' && !before?{lastAquiredAt:0,reservedAmount:0}:{}),
      ...(['UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial','UserEquipmentEnhanceItem','UserEquipmentEvolveItem',
        'UserHeroSublimateItem','UserHeroSublimateUnlockItem','UserStaminaTicket','UserAlarmVoiceItem'].includes(profile.table) && !before?{reservedAmount:0}:{}),
      ...(profile.table==='UserCurrency'?{}:{bookEntryState:before?.bookEntryState ?? (profile.table==='UserStaminaTicket'?1:3)}),
      amount:capped?Math.min(maximum,(before?.amount ?? 0)+amount):(before?.amount ?? 0)+amount,
      cumulativeAmount:capped?999999999:(before?.cumulativeAmount ?? 0)+amount };
    (result[profile.table] ??= []).push(item);
  }
  if (operation.type === 11000 && operation.parameters.itemId !== undefined) {
    const before = store.read('UserCpItem').data.find(row => row.cpItemId === operation.parameters.itemId);
    result.UserCpItem = [{ ...before,amount:before.amount-operation.parameters.itemAmount }];
  }
  if (operation.type === 21000) {
    const before = store.read('UserInfo').data[0], stage = master.expeditionStages[operation.parameters.UserExpeditionStage.expeditionStageId];
    const group = master.expeditionRewardGroups[[stage.failureRewardGroupId,stage.successRewardGroupId,stage.greatRewardGroupId][operation.parameters.drawStatus]];
    const amount = Math.trunc(Math.fround(Math.fround(group.experience)*boosts.boost_xp));
    const totalExp = Math.min(master.playerLevels.at(-1)[1],before.playerStatus.totalExp+amount);
    const level = master.playerLevels.findLast(([,exp]) => exp<=totalExp)[0];
    let stamina = 0;
    for (let next=before.playerStatus.level+1;next<=level;next++) stamina+=master.playerMaxSP[next];
    result.UserInfo = [{ ...before,playerStatus:{ ...before.playerStatus,totalExp,
      level,baseSP:Math.min(0x7fffffff,before.playerStatus.baseSP+stamina) } }];
  }
  return result;
}

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-friendship-rewards-'));
  const realRandom = crypto.randomInt;
  let app,port,database,sequence=0,now=1700000000;
  // Deterministic synthetic selection of all positive authored prize weights.
  crypto.randomInt = (max,...args) => !args.length && max === 10000 ? 0 :
    !args.length && max === 100 ? 99 : realRandom(max,...args);
  const open = async (metadata = master) => {
    app = createServer({ database,seed,master:metadata,wallNowSeconds:() => now,log:() => {} });
    await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve)); port=app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app=null; } };
  const fresh = async (name,metadata = master) => { await close(); database=path.join(directory,`${name}.sqlite`); now=1700000000; await open(metadata); };
  const send = (action,value) => request(port,++sequence,value,String(sequence),action);
  const parse = response => { assert.equal(response.status,200,response.body.toString()); return JSON.parse(response.body); };
  const put = (name,rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected = async (pending,status,unavailable=false,before=snapshot()) => {
    const response=await pending; assert.equal(response.status,status,response.body.toString()); assert.equal(snapshot(),before);
    if (unavailable) assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const pushBody = (putItems={},operations=[],deleteItems={}) => {
    putItems=friendshipUnlockFixture(app.store,putItems,operations);
    if (operations.some(op=>op.type===21000)) deleteItems={ ...deleteItems,UserExpeditionParty:operations.filter(op=>op.type===21000)
      .map(op=>({ expeditionStageId:op.parameters.UserExpeditionStage.expeditionStageId })) };
    return {
    badges:null,scripts:{},dataTokens:{},checksums:{ before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name => [name,md5(putItems[name] ?? [])])) },
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature:0,trigger:'FriendshipComplete',putItems,deleteItems }] : [],
    operations:operations.map(row => ({ id:row.id,verifier:row.token })),
  }; };
  const push = (...args) => send('user_data/push',pushBody(...args));
  const cpState = (id,level) => ({ characterId:id,friendship:master.characters[id].levels.find(row => row[0]===level)[1],
    friendshipLv:level,userHeroType:0 });
  const cpRequest = state => ({ friendshipStates:[state] });
  // Explicit SYNTHETIC CP-only constructor shell, not a complete native
  // initialization/signature. The negative ACK path never supplies it.
  const characterRows = operation => ({ UserCharacter:operation.parameters.friendshipStates.map(state => ({
    ...(app.store.read('UserCharacter').data.find(row => row.characterId===state.characterId) ??
      {userId:0,characterId:state.characterId,characterState:1,friendship:0,friendshipAis:0,friendshipLef:0,
        substitutedPcSpineId:0,signature:0xffffffff}),
    [['friendship','friendshipAis','friendshipLef'][state.userHeroType]]:state.friendship })) });
  const equipDispatchBoost = () => {
    const pc=app.store.read('UserPC').data.find(row=>row.pcId===seed.data.UserPC[0].pcId),
      gear=(equipmentId,slotIndex,abilityId1)=>({userId:seed.userId,equipmentId,slotIndex,createAt:1,
        abilityId1,abilityId2:0,abilityId3:0,abilityId4:0,abilityId5:0,exp:0,rarity:0,performance:4,durability:0,
        reservedDurability:0,isProtected:false,isUnbreakable:false,lockedAbility1:false,lockedAbility2:false,
        lockedAbility3:false,lockedAbility4:false,lockedAbility5:false});
    put('UserEquipment',[gear(24000006300,1,21000035001),gear(24000012090,10001,21000034001)]);
    put('UserPC',[{...pc,equippedWeaponIndex:1,equippedArmorIndex:10001}]);return pc;
  };
  const dispatch = async (stageId,rejectIssue=false,reportedEntries=null,expectedStatus=503) => {
    const original=master.expeditionStages[stageId]; now=Math.max(original.startAt+original.duration+1,1500000000);
    const started={ userId:seed.userId,expeditionStageId:stageId,completionState:3,dispatchState:1,startAt:now-original.duration,
      cumulativeClearCount:0,otherClearCount:0,firstTryDateTime:now-original.duration,firstCompleteDateTime:0,
      lastTryDateTime:now-original.duration,lastCompleteDateTime:0 };
    put('UserExpeditionStage',[...app.store.read('UserExpeditionStage').data.filter(row => row.expeditionStageId!==stageId),started]);
    const parties=app.store.read('UserExpeditionParty').data;
    if (!parties.some(row => row.expeditionStageId===stageId)) put('UserExpeditionParty',[...parties,{
      userId:seed.userId,expeditionStageId:stageId,slots:Array.from({ length:4 },(_,i)=>({
        slotNumber:i+1,pcId:i?0:seed.data.UserPC[0].pcId,assistingPcId:0 })) }]);
    const entries=reportedEntries ?? app.store.expeditionPartyEntries(stageId),heroType=app.store.read('UserInfo').data[0].heroType;
    const body={ expeditionStageId:stageId,totalLevel:entries.reduce((sum,row)=>sum+row.level,0),
      totalStatus:entries.reduce((sum,row)=>sum+(row.status ?? 1),0),
      entryPcs:entries.map(({ characterId,level,status=1 })=>({ characterId,level,status })),
      friendshipStates:entries.map(({ characterId })=>{
        const character=app.store.read('UserCharacter').data.find(row=>row.characterId===characterId),
          friendship=character ? character[['friendship','friendshipAis','friendshipLef'][heroType]] : 0;
        return { characterId,friendship,friendshipLv:master.characters[characterId].levels.findLast(([,points])=>points<=friendship)[0],userHeroType:heroType };
      }) };
    if (rejectIssue) { await rejected(send('expedition/complete',body),expectedStatus,expectedStatus===503 && reportedEntries!==null); return; }
    const result=parse(await send('expedition/complete',body)),operation=result.operations[0];
    assert.equal(result.drawStatus,0,'The weak synthetic party selects the authored failure-group fixture');
    return { operation,body,rows:{ ...characterRows(operation),UserExpeditionStage:[
      expeditionCompletionStage(started,result.drawStatus,master)] } };
  };
  try {
    // DEFERRED real21000 route: absent original character, all heroes and
    // duplicate-character main/assist multiplicity, constructor-first/CP-first.
    // Native party/unit eligibility, defaults, ordering and signatures unproved.
    for(const hero of [0,1,2]) for(const assist of [false,true]) for(const constructorFirst of [false,true]) {
      await fresh(`dispatch-lazy-character-${hero}-${assist}-${constructorFirst}`);
      const info=app.store.read('UserInfo').data[0],first=app.store.read('UserPC').data[0],
        characterId=master.pcProfiles[first.pcId].characterId,field=['friendship','friendshipAis','friendshipLef'][hero],
        initial={userId:0,characterId,characterState:1,friendship:0,friendshipAis:0,friendshipLef:0,
          substitutedPcSpineId:0,signature:0xffffffff},variant=Number(Object.keys(master.pcProfiles).find(id=>
          Number(id)!==first.pcId && master.pcProfiles[id].characterId===characterId && master.pcProfiles[id].jobIds.length));
      put('UserInfo',[{...info,heroType:hero}]);put('UserCharacter',[]);
      put('UserPC',assist ? [first,{...first,pcId:variant,totalExp:0,currentJobIndex:1}] : [first]);
      const party={userId:0,expeditionStageId:707000001,slots:Array.from({length:4},(_,i)=>({
        slotNumber:i+1,pcId:i ? 0 : first.pcId,assistingPcId:i || !assist ? 0 : variant}))};
      put('UserExpeditionParty',[party]);
      const absentEntries=app.store.expeditionPartyEntries(707000001);
      put('UserCharacter',[initial]);assert.deepEqual(app.store.expeditionPartyEntries(707000001),absentEntries,
        'Private absent-CP status equals explicit synthetic zero-track status, not zero status bonuses');
      put('UserCharacter',[]);
      await dispatch(707000001,true,absentEntries.map((entry,i)=>i ? entry : {...entry,status:entry.status+1}),400);
      const oldPull={tables:['UserCharacter']};parse(await send('user_data/pull',oldPull));const oldIdentity=sequence,
        before=app.store.read('UserCharacter'),{operation,rows,body}=await dispatch(707000001),identity=sequence,
        receipt=app.store.db.prepare('SELECT friendship_before FROM friendship_reward_claim WHERE operation_id=?').get(operation.id),
        capture=JSON.parse(receipt.friendship_before),target=operation.parameters.friendshipStates[0],items=itemDeltas(app.store,operation);
      assert.deepEqual(app.store.read('UserCharacter'),before,'Dispatch never precreates or precredits the native character');
      assert.equal(body.entryPcs.length,assist ? 2 : 1);assert.equal(body.friendshipStates.length,body.entryPcs.length);
      assert(body.friendshipStates.every(row=>row.friendship===0 && row.userHeroType===hero));
      assert.equal(capture.length,1);assert.equal(capture[0].initial,true);assert.equal(capture[0].before,0);
      assert.equal(operation.parameters.friendshipStates.length,1);assert.equal(target.initial,undefined,'No private role on the wire');
      const {UserCharacter,...withoutCharacter}=rows;
      await rejected(push({...withoutCharacter,...items},[operation]),400);
      await rejected(send('expedition/complete',{...body,friendshipStates:body.friendshipStates.map(row=>({...row,friendship:1}))}),400);
      for(const damage of [{userId:seed.userId},{characterState:0},{[field]:-1},{[['friendship','friendshipAis','friendshipLef'][(hero+1)%3]]:1}])
        await rejected(push({...rows,...items,UserCharacter:[{...rows.UserCharacter[0],...damage}]},[operation]),400);
      parse(await send('expedition/complete',body));await close();await open();
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[operation],'Unobserved original callback survives restart');
      const firstRow=constructorFirst ? initial : rows.UserCharacter[0];
      app.store.db.exec("CREATE TRIGGER fail_dispatch_lazy BEFORE UPDATE ON friendship_reward_claim BEGIN SELECT RAISE(ABORT,'dispatch constructor checkpoint rollback'); END");
      await rejected(push({UserCharacter:[firstRow]}),503);app.store.db.exec('DROP TRIGGER fail_dispatch_lazy');
      parse(await push({UserCharacter:[firstRow]}));
      const observed=JSON.parse(app.store.db.prepare('SELECT observed FROM friendship_reward_claim WHERE operation_id=?').get(operation.id).observed);
      assert(observed.includes(`cp-character-row:${characterId}`));
      assert.equal(observed.includes(`cp:${characterId}:${hero}`),!constructorFirst);
      await rejected(push({},[],{UserCharacter:[{characterId}]}),400);await rejected(push({},[operation]),400);
      await close();await open();
      await rejected(send('user_data/confirm'),503,true);await rejected(send('expedition/complete',body),503,true);
      await rejected(request(port,identity,body,String(identity),'expedition/complete'),503,true);
      await rejected(request(port,oldIdentity,oldPull,String(oldIdentity),'user_data/pull'),503,true);
      for(const table of ['stage_friendship_floor','operation_done','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_dispatch_lazy_ack BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'dispatch lazy ACK rollback'); END`);
        await rejected(push({...rows,...items},[operation]),503);app.store.db.exec('DROP TRIGGER fail_dispatch_lazy_ack');
      }
      parse(await push({...rows,...items},[operation]));
      assert.equal(app.store.read('UserCharacter').data[0].userId,0);
      assert.equal(app.store.db.prepare('SELECT friendship FROM stage_friendship_floor WHERE character_id=? AND user_hero_type=?')
        .get(characterId,hero).friendship,target.friendship);
      await rejected(push({UserCharacter:[{...rows.UserCharacter[0],[field]:target.friendship-1}]}),400);
      await rejected(push({},[],{UserCharacter:[{characterId}]}),400);await close();await open();
      const retained=app.store.read('UserCharacter');put('UserCharacter',[]);
      try {
        await rejected(send('user_data/pull',oldPull),503,true);await close();await open();
        await rejected(send('user_data/confirm'),503,true);
        // Raw disposable setup of another party, not a native party rejoin:
        // prove status reads reject the lost earned row, not an absent party.
        put('UserExpeditionParty',[party]);
        assert.throws(()=>app.store.expeditionPartyEntries(707000001),/Acknowledged character CP/);
      } finally {app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(retained.data),retained.token,'UserCharacter');}
    }
    // The real21000 route crosses a CP threshold in this disposable fixture.
    // The shared negative suite tests missing flags; this mixed helper supplies
    // synthetic unlock saves only when an ACK is explicitly requested.
    await fresh('dispatch-cp-quest-refresh');
    put('UserCharacter',app.store.read('UserCharacter').data.map(row=>row.characterId===101000001 ?
      {...row,friendship:12,friendshipAis:0,friendshipLef:0} : row));
    put('UserPC',app.store.read('UserPC').data.map(row=>row.pcId===1011001001?{...row,hp:7,mp:3}:row));
    put('UserExpeditionParty',[{userId:seed.userId,expeditionStageId:707000001,slots:Array.from({length:4},(_,i)=>({
      slotNumber:i+1,pcId:i ? 0 : 1011001001,assistingPcId:0}))}]);
    put('UserAdventureStage',app.store.read('UserAdventureStage').data.map(row=>[2,3].includes(master.stages[row.adventureStageId]?.adventureType) ?
      {...row,state:0} : row));
    const refreshed=await dispatch(707000001),cpGraph=JSON.parse(app.store.db.prepare('SELECT friendship_unlocks FROM friendship_reward_claim WHERE operation_id=?')
      .get(refreshed.operation.id).friendship_unlocks);
    assert.equal(refreshed.operation.parameters.friendshipStates[0].friendship,17);
    assert.deepEqual(cpGraph.effects,[{stageId:1030010101101,kind:'open'}]);
    assert.deepEqual(cpGraph.refills.targets.map(row=>[row.pcId,row.hpRequired,row.mpRequired]),[[1011001001,true,true]]);
    assert.equal(app.store.read('UserPC').data.find(row=>row.pcId===1011001001).hp,7,'No dispatch refill precredit');
    const refill=cpGraph.refills.targets[0],pc=app.store.read('UserPC').data.find(row=>row.pcId===refill.pcId);
    parse(await push({UserPC:[{...pc,hp:refill.hp}]}));
    const refillObserved=JSON.parse(app.store.db.prepare('SELECT observed FROM friendship_reward_claim WHERE operation_id=?')
      .get(refreshed.operation.id).observed);
    assert(refillObserved.includes(`cp-hp:${refill.pcId}`));assert(!refillObserved.includes(`cp-mp:${refill.pcId}`));
    // Explicit synthetic flag-only save for the real21000 producer binding;
    // NOT proof that the native dispatch callback emits this table/date.
    const cpReward=app.store.db.prepare('SELECT reward_id FROM friendship_reward WHERE operation_id=?').get(refreshed.operation.id),
      receivedFlag={userId:seed.userId,rewardId:cpReward.reward_id,receivedAt:now,isReceived:true};
    const flagReply=parse(await push({UserCharacterFriendshipReward:[receivedFlag]}));
    assert(!flagReply.operations.some(row=>row.id===refreshed.operation.id),'Partial refill suppresses redelivery, never acknowledges dispatch');
    assert(app.store.operations().some(row=>row.id===refreshed.operation.id),'Dispatch flag is not reward delivery proof');
    await rejected(push({},[refreshed.operation]),400);
    parse(await push({...refreshed.rows,...itemDeltas(app.store,refreshed.operation)},[refreshed.operation]));
    assert.deepEqual(app.store.read('UserCharacterFriendshipReward').data,[receivedFlag]);
    assert.equal(app.store.db.prepare('SELECT operation_id FROM stage_unlock_floor WHERE stage_id=?').get(1030010101101).operation_id,refreshed.operation.id);
    await fresh('dispatch-missing-completion-rules',{ ...master,expeditionStageRequirements:{} });
    await dispatch(707000001,true);
    await fresh('dispatch-normal-requirement-stage');
    const requiredDispatch=await dispatch(707000026),requiredItems=itemDeltas(app.store,requiredDispatch.operation);
    assert.equal(requiredDispatch.rows.UserExpeditionStage[0].completionState,4);
    await rejected(push({ ...requiredDispatch.rows,UserExpeditionStage:[{
      ...requiredDispatch.rows.UserExpeditionStage[0],completionState:5 }],...requiredItems },[requiredDispatch.operation]),503);
    parse(await push({ ...requiredDispatch.rows,...requiredItems },[requiredDispatch.operation]));
    // Deferred saved-member checks. Duplicate character identities must retain
    // their multiplicity; different PC variants and assists are not discarded.
    for (const heroType of [0,1,2]) for (const owner of [seed.userId,0]) {
      await fresh(`member-hero-${heroType}-owner-${owner}`);
      const info=app.store.read('UserInfo').data[0],first=app.store.read('UserPC').data[0];
      put('UserInfo',[{ ...info,heroType }]);
      put('UserCharacter',app.store.read('UserCharacter').data.map(row=>
        row.characterId===master.pcProfiles[first.pcId].characterId ? { ...row,userId:owner } : row));
      const otherId=Number(Object.keys(master.pcProfiles).find(id=>Number(id)!==first.pcId &&
        master.pcProfiles[id].characterId===master.pcProfiles[first.pcId].characterId && master.pcProfiles[id].jobIds.length));
      put('UserPC',[first,{ ...first,pcId:otherId,totalExp:0,currentJobIndex:1 }]);
      put('UserExpeditionParty',[{ userId:0,expeditionStageId:707000001,slots:Array.from({ length:4 },(_,i)=>({
        slotNumber:i+1,pcId:i?0:first.pcId,assistingPcId:i?0:otherId })) }]);
      const { operation,rows,body }=await dispatch(707000001);
      assert.equal(body.entryPcs.length,2); assert.equal(operation.parameters.friendshipStates.length,1);
      assert.equal(operation.parameters.friendshipStates[0].userHeroType,heroType);
      const identity=sequence,changedInfo=app.store.read('UserInfo').data.map(row=>({ ...row,heroType:(heroType+1)%3 })),
        items=itemDeltas(app.store,operation),target=operation.parameters.friendshipStates[0];
      // Frozen21000 uses current global hero, not its wire userHeroType.
      if (target.friendship>body.friendshipStates[0].friendship) await rejected(push({ UserInfo:changedInfo }),400);
      const oldInfo=app.store.read('UserInfo').data; put('UserInfo',changedInfo);
      await rejected(send('expedition/complete',body),503,true);
      await rejected(request(port,identity,body,String(identity),'expedition/complete'),503,true);
      put('UserInfo',oldInfo);
      for (const userId of [owner===0 ? seed.userId : 0,2,'0',null])
        await rejected(push({ ...rows,UserCharacter:rows.UserCharacter.map(row=>({ ...row,userId })) },[operation]),400);
      parse(await push({ ...rows,...items },[operation]));
      assert.equal(app.store.read('UserCharacter').data.find(row=>row.characterId===target.characterId).userId,owner);
      if (target.friendship>0) {
        assert.equal(app.store.db.prepare('SELECT friendship FROM stage_friendship_floor WHERE character_id=? AND user_hero_type=?')
          .get(target.characterId,heroType).friendship,target.friendship);
        const native=rows.UserCharacter[0],key=['friendship','friendshipAis','friendshipLef'][heroType];
        await rejected(push({ UserCharacter:[{ ...native,[key]:target.friendship-1 }] }),400);
      }
    }
    for (const mutation of ['missing-assist','foreign-assist','unjoined-assist','guest-assist','bad-level','unmapped']) {
      await fresh(`member-${mutation}`); const first=app.store.read('UserPC').data[0];
      const id=mutation==='unmapped'?Number(Object.keys(master.pcProfiles).find(id=>master.pcProfiles[id].characterId===0)):
        Number(Object.keys(master.pcProfiles).find(id=>Number(id)!==first.pcId && master.pcProfiles[id].characterId>0 && master.pcProfiles[id].jobIds.length));
      const assist={ ...first,pcId:id };
      if (mutation==='foreign-assist') assist.userId=2;
      if (mutation==='unjoined-assist') assist.joiningState=0;
      if (mutation==='guest-assist') assist.ownerType=2;
      if (mutation==='bad-level') assist.currentJobIndex=0;
      put('UserPC',mutation==='missing-assist'?[first]:[first,assist]);
      put('UserExpeditionParty',[{ userId:seed.userId,expeditionStageId:707000001,slots:Array.from({ length:4 },(_,i)=>({
        slotNumber:i+1,pcId:i?0:first.pcId,assistingPcId:i?0:id })) }]);
      const before=snapshot(); assert.throws(()=>app.store.expeditionPartyEntries(707000001),/Dispatch request|dispatch unit/);
      assert.equal(snapshot(),before);
    }
    // Deferred source-metadata recovery: supply a synthetic request so a
    // missing provider reaches the actual handler, not just the local helper.
    for (const provider of ['pcBaseStats','pcLevelGrowth','pcAbilities','pcHeroSublimateSteps']) {
      await fresh(`member-missing-${provider}`,{ ...master,[provider]:{} });
      await dispatch(707000001,true,[{ pcId:1011001001,characterId:101000001,level:1 }]);
      const before=snapshot();
      assert.throws(()=>app.store.expeditionPartyEntries(707000001),/dispatch unit status/);
      assert.equal(snapshot(),before);
    }
    for (const mutation of ['foreign-cp','missing-track','duplicate-cp','foreign-board','duplicate-board','legacy-jobs','legacy-panels',
      'bad-hero-level','missing-hero-unlock','dangling-weapon']) {
      await fresh(`member-modifier-${mutation}`);
      const pcs=app.store.read('UserPC').data,characters=app.store.read('UserCharacter').data,
        sets=app.store.read('UserPCJobSet').data,first=pcs.find(row=>row.pcId===1011001001);
      if (mutation==='foreign-cp' || mutation==='missing-track') put('UserCharacter',characters.map(row=>
        row.characterId===101000001?{ ...row,...(mutation==='foreign-cp'?{ userId:2 }:{ friendshipAis:undefined }) }:row));
      if (mutation==='duplicate-cp') put('UserCharacter',[...characters,{ ...characters.find(row=>row.characterId===101000001) }]);
      const set=sets.find(row=>row.pcId===first.pcId);
      if (mutation==='foreign-board') put('UserPCJobSet',sets.map(row=>row===set?{ ...row,userId:2 }:row));
      if (mutation==='duplicate-board') put('UserPCJobSet',[...sets,{ ...set }]);
      if (mutation==='legacy-jobs') put('UserPC',pcs.map(row=>row===first?{ ...row,jobs:[{}] }:row));
      if (mutation==='legacy-panels') put('UserPCJobSet',sets.map(row=>row===set?{ ...row,
        pcJobs:row.pcJobs.map((job,i)=>i?job:{ ...job,abilityPanels:[{}] }) }:row));
      if (['bad-hero-level','missing-hero-unlock','dangling-weapon'].includes(mutation)) put('UserPC',pcs.map(row=>row===first?{
        ...row,...(mutation==='bad-hero-level'?{ heroSublimateLevel:7 }:mutation==='missing-hero-unlock'?
          { isUnlockedHeroSublimate:undefined }:{ equippedWeaponIndex:499 }) }:row));
      await dispatch(707000001,true,[{ pcId:1011001001,characterId:101000001,level:1 }]);
    }
    await fresh('member-status-congruence');
    put('UserExpeditionParty',[{ userId:seed.userId,expeditionStageId:707000001,slots:Array.from({ length:4 },(_,i)=>({
      slotNumber:i+1,pcId:i?0:1011001001,assistingPcId:0 })) }]);
    const member=app.store.expeditionPartyEntries(707000001)[0];
    await dispatch(707000001,true,[{ ...member,status:member.status+1 }],400);
    // Preserve the reported total's consistency: changing an inactive CP
    // track still changes native status, so the old status must now reject.
    const savedCharacters=app.store.read('UserCharacter').data;
    put('UserCharacter',savedCharacters.map(row=>row.characterId===member.characterId?{ ...row,friendshipAis:378 }:row));
    await dispatch(707000001,true,[member],400);

    const tables=new Map();
    for (const [id,character] of Object.entries(master.characters)) for (const [,level,type,,itemId,hero] of character.rewards) {
      const idItem=type===6?master.currencies['currency.valis']:[0,1,15].includes(type)?itemId:0;
      const profile=master.itemProfiles[idItem];
      if (hero===0 && profile && !tables.has(profile.table)) tables.set(profile.table,cpState(Number(id),level));
    }
    assert.equal(tables.size,4);
    for (const [table,state] of tables) {
      await fresh(`cp-${table}`); const beforeProfiles=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all();
      const body=cpRequest(state),response=parse(await send('character/friendship/complete',body)),operation=response.operations[0];
      assert.ok(app.store.friendshipRewardReceipt(operation).items.some(row => row.table_name===table));
      assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),beforeProfiles,'No native inventory precredit');
      const flags=characterRows(operation); await rejected(push(flags,[operation]),400);
      const items=itemDeltas(app.store,operation);
      const target=app.store.friendshipRewardReceipt(operation).items[0],row=items[target.table_name][0];
      for (const change of [{ userId:2 },{ cumulativeAmount:target.cumulative_amount-1 },{ cumulativeAmount:'1' },{ amount:-1 }])
        await rejected(push({ ...flags,...items,[target.table_name]:[{ ...row,...change }] },[operation]),400);
      parse(await push({ ...flags,...items })); await close(); await open();
      assert.deepEqual(parse(await send('character/friendship/complete',body)).operations,[operation]);
      const spent=Object.fromEntries(Object.entries(items).map(([name,rows]) => [name,rows.map(row => ({ ...row,amount:0 }))]));
      parse(await push(spent,[operation])); parse(await push({},[operation]));
      for (const target of app.store.db.prepare('SELECT * FROM friendship_item_claim WHERE operation_id=?').all(operation.id)) {
        const saved=app.store.read(target.table_name).data.find(row => row[target.id_field]===target.item_id);
        await rejected(push({ [target.table_name]:[{ ...saved,cumulativeAmount:target.cumulative_amount-1 }] }),400);
        await rejected(push({},[],{ [target.table_name]:[{ [target.id_field]:target.item_id }] }),400);
      }
      await close(); await open(); assert.deepEqual(app.store.operations(),[]);
    }

    // All eight ordinary dispatch classes plus its direct CasinoState branch.
    const dispatchTables=new Map();
    for (const [id,stage] of Object.entries(master.expeditionStages)) for (const row of master.expeditionRewardGroups[stage.failureRewardGroupId].rewards) {
      if (row.rewardId===master.currencies['currency.gem']) continue;
      const key=row.rewardId===master.currencies['currency.casino_medal']?'casino':master.itemProfiles[row.rewardId].table;
      if (!dispatchTables.has(key)) dispatchTables.set(key,Number(id));
    }
    assert.equal(dispatchTables.size,9);
    for (const [table,stageId] of dispatchTables) {
      await fresh(`dispatch-${table}`); const fixture=await dispatch(stageId),{ operation,rows,body }=fixture;
      const receipt=app.store.friendshipRewardReceipt(operation),items=itemDeltas(app.store,operation);
      assert.ok(table==='casino'?app.store.casinoRewardReceipt(operation):receipt.items.some(row => row.table_name===table));
      await rejected(push(rows,[operation]),400);
      parse(await push({ ...rows,...items })); await close(); await open();
      await rejected(send('expedition/complete',body),503,true);
      const spent=Object.fromEntries(Object.entries(items).map(([name,entries]) => [name,entries.map(row =>
        name==='UserCasinoState'?{ ...row,medalAmount:0 }:name==='UserInfo'?row:{ ...row,amount:0 })]));
      parse(await push(spent,[operation]));
      if (table==='casino') {
        const state=app.store.read('UserCasinoState').data[0];
        await rejected(push({ UserCasinoState:[{ ...state,cumulativeMedalAmount:state.cumulativeMedalAmount-1 }] }),400);
      }
    }

    //WRITTEN ONLY / NOT RUN: original non-Valis CP and dispatch prizes, not native earning/signing/order proof.
    const capSources=[...tables].filter(([table])=>table!=='UserCurrency').map(([table,state])=>({kind:'cp',table,state})).concat(
      [...dispatchTables].filter(([table])=>!['UserCurrency','casino'].includes(table)).map(([table,stageId])=>({kind:'dispatch',table,stageId})));
    assert.equal(capSources.filter(row=>row.kind==='cp').length,3);assert.equal(capSources.filter(row=>row.kind==='dispatch').length,7);
    for(const source of capSources) for(const scenario of [
      {order:'stock-first',cumulative:999999998,amount:0},{order:'flags-first',cumulative:999999999,amount:7},
      {order:'signature-first',cumulative:999999999,amount:999999999},{order:'together',cumulative:999999999,amount:999999998},
      {order:'spent-first',cumulative:999999999,amount:7},{order:'cumulative-first',cumulative:999999998,amount:7},
      {order:'spent-before-signature',cumulative:999999999,amount:0},
      {order:'clamped-stock-first',cumulative:999999999,amount:999999998},
      {order:'full-stock-prefix',cumulative:999999999,amount:999999999},
    ]) {
      const {table,kind,state,stageId}=source,{order,cumulative,amount}=scenario;
      await fresh(`capped-${kind}-${table}-${order}`);
      const itemId=kind==='cp'?master.characters[state.characterId].rewards.find(row=>row[5]===0 && row[1]<=state.friendshipLv &&
        master.itemProfiles[row[4]]?.table===table)[4]:master.expeditionRewardGroups[master.expeditionStages[stageId].failureRewardGroupId]
        .rewards.find(row=>master.itemProfiles[row.rewardId]?.table===table).rewardId,
        idField=master.itemProfiles[itemId].idField,baseline={userId:seed.userId,[idField]:itemId,amount,cumulativeAmount:cumulative,
          reservedAmount:0,bookEntryState:table==='UserStaminaTicket'?1:255,signature:order==='signature-first'?0xffffffff:0x7fffffff};
      put(table,[baseline]);const issuedProfiles=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all();
      const randomInt=crypto.randomInt;let operation,body,flags;
      try {
        crypto.randomInt=(min,...args)=>args.length?baseline.signature===0xffffffff?1:baseline.signature:randomInt(min);
        if(kind==='cp') {body=cpRequest(state);operation=parse(await send('character/friendship/complete',body)).operations[0];flags=characterRows(operation);}
        else {const fixture=await dispatch(stageId);({operation,body}=fixture);flags=fixture.rows;}
      } finally {crypto.randomInt=randomInt;}
      if(kind==='cp') assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),issuedProfiles,'No capped CP reward precredit');
      assert.equal(operation.signature,1);assert.deepEqual(app.store.read(table).data,[baseline]);
      const target=app.store.db.prepare('SELECT * FROM friendship_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,itemId),
        capture=JSON.parse(target.stock_state),items=itemDeltas(app.store,operation),acquired=items[table].find(row=>row[idField]===itemId),
        final=friendshipUnlockFixture(app.store,{...flags,...items},[operation]),action=kind==='cp'?'character/friendship/complete':'expedition/complete';
      assert.equal(target.cap_version,1);assert.equal(target.cumulative_amount,999999999);
      assert.deepEqual(capture,{policy:'offline-friendship-stock-cap-v1',beforeCumulative:cumulative,beforeAmount:amount,
        amount:Math.min(999999999,amount+target.amount),beforeSignature:baseline.signature,amountAdded:0,observed:false,effect:false,signature:operation.signature});
      const requestClaim=app.store.db.prepare('SELECT * FROM friendship_reward_claim WHERE operation_id=?').get(operation.id);
      assert.equal(requestClaim.operation_json,JSON.stringify(operation));
      if(order==='stock-first') {
        for(const change of [{cap_version:0},{stock_state:null},{stock_state:'{'},
          ...[{policy:'offline-gift-stock-cap-v1'},{beforeAmount:-1},{beforeSignature:operation.signature},{amountAdded:target.amount+1},
            {observed:true}].map(change=>({stock_state:JSON.stringify({...capture,...change})}))]) {
          app.store.db.prepare(`UPDATE friendship_item_claim SET ${Object.keys(change).map(field=>`${field}=?`).join(',')} WHERE operation_id=? AND item_id=?`)
            .run(...Object.values(change),operation.id,itemId);await rejected(send(action,body),503,true);
          app.store.db.prepare('UPDATE friendship_item_claim SET cap_version=1,stock_state=? WHERE operation_id=? AND item_id=?')
            .run(target.stock_state,operation.id,itemId);
        }
        app.store.db.prepare('UPDATE friendship_reward_claim SET operation_json=NULL WHERE operation_id=?').run(operation.id);
        await rejected(send(action,body),503,true);
        app.store.db.prepare('UPDATE friendship_reward_claim SET operation_json=? WHERE operation_id=?').run(requestClaim.operation_json,operation.id);
        for(const rollbackTable of ['profile','friendship_item_claim']) {
          app.store.db.exec(`CREATE TRIGGER capped_friendship_save_fail BEFORE UPDATE ON ${rollbackTable} BEGIN SELECT RAISE(ABORT,'capped friendship rollback'); END`);
          await rejected(push(final),503);app.store.db.exec('DROP TRIGGER capped_friendship_save_fail');
        }
      }
      await rejected(push({...final,[table]:items[table].map(row=>row[idField]===itemId?{...row,signature:baseline.signature}:row)},[operation]),400);
      const clampedPrefix=['clamped-stock-first','full-stock-prefix'].includes(order),
        prefix=order==='flags-first'?Object.fromEntries(Object.entries(final).filter(([name])=>name!==table)):
        order==='together'?final:{[table]:[{...baseline,
          amount:order==='stock-first'||clampedPrefix?acquired.amount:['signature-first','cumulative-first'].includes(order)?amount:0,
          cumulativeAmount:order==='stock-first'?cumulative:999999999,
          signature:['signature-first','spent-first'].includes(order)?operation.signature:baseline.signature}]};
      parse(await push(prefix));const stock=JSON.parse(app.store.db.prepare('SELECT stock_state FROM friendship_item_claim WHERE operation_id=? AND item_id=?')
        .get(operation.id,itemId).stock_state);
      assert.equal(stock.observed,['signature-first','spent-first','together'].includes(order));
      if(clampedPrefix) {
        const delta=acquired.amount-baseline.amount;assert.equal(stock.amountAdded,delta);
        assert.equal(delta,order==='full-stock-prefix'?0:1);
        app.store.db.prepare('UPDATE friendship_item_claim SET stock_state=? WHERE operation_id=? AND item_id=?')
          .run(JSON.stringify({...stock,amountAdded:delta+1,effect:true}),operation.id,itemId);
        await rejected(send(action,body),503,true);
        app.store.db.prepare('UPDATE friendship_item_claim SET stock_state=? WHERE operation_id=? AND item_id=?')
          .run(JSON.stringify(stock),operation.id,itemId);
        parse(await push({[table]:[{...baseline,amount:0}]}));
        await rejected(push({[table]:[{...baseline,amount:1}]}),400);
        stock.effect=true;
      }
      const oldObserved=JSON.stringify(stock);await close();await open();
      assert.equal(app.store.db.prepare('SELECT stock_state FROM friendship_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,itemId).stock_state,oldObserved);
      const recoverableDispatchItem=kind==='dispatch' && stock.observed && order!=='together';
      if(recoverableDispatchItem) {
        const recovered=app.store.expeditionColdRecovery(operation);
        assert(!recovered.parameters.gainedItems.some(row=>row.rewardId===itemId));
        assert.deepEqual(parse(await send(action,body)).operations[0],recovered);
      } else if(stock.effect || order==='flags-first' || order==='together') await rejected(send(action,body),503,true);
      else assert.deepEqual(parse(await send(action,body)).operations[0],operation,'Untouched capped reward remains replayable');
      const finished={...final,[table]:items[table].map(row=>row[idField]===itemId?{...row,amount:order==='together'?row.amount:0}:row)};
      parse(await push(finished));
      if(order==='stock-first') for(const rollbackTable of ['friendship_item_floor','operation_done','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER capped_friendship_ack_fail BEFORE INSERT ON ${rollbackTable} BEGIN SELECT RAISE(ABORT,'capped friendship ACK rollback'); END`);
        await rejected(push(finished,[operation]),503);app.store.db.exec('DROP TRIGGER capped_friendship_ack_fail');
      }
      const ack=pushBody(finished,[operation]),ackIdentity=sequence+1,response=await send('user_data/push',ack);parse(response);
      assert.equal(app.store.operations().length,0);assert.equal(app.store.db.prepare('SELECT cumulative_amount FROM friendship_item_floor WHERE item_id=?').get(itemId).cumulative_amount,999999999);
      await close();await open();const exact=await request(port,ackIdentity,ack,String(ackIdentity),'user_data/push');
      assert.equal(exact.status,200);assert.deepEqual(exact.body,response.body,'Cold exact ACK bytes are retained');
      const saved=app.store.read(table).data.find(row=>row[idField]===itemId);
      if(saved.amount>0) parse(await push({[table]:[{...saved,amount:0}]}));
      await rejected(push({[table]:[{...saved,amount:1}]}),400);
      await rejected(push({[table]:[{...saved,amount:0,cumulativeAmount:999999998}]}),400);
      await rejected(push({},[],{[table]:[{[idField]:itemId}]}),400);
      app.store.db.prepare('UPDATE friendship_reward_claim SET operation_json=NULL WHERE operation_id=?').run(operation.id);
      await rejected(push({[table]:[{...saved,amount:0}]}),503,true);
      app.store.db.prepare('UPDATE friendship_reward_claim SET operation_json=? WHERE operation_id=?').run(requestClaim.operation_json,operation.id);
      if(order==='stock-first' && [capSources[0],capSources.find(row=>row.kind==='dispatch')].includes(source)) {
        const present={userId:seed.userId,id:1,itemId,amount:2,title:'Synthetic capped producer follow-up',message:'',senderType:1,
          senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,pcLimitBreakCount:0,pcHeroSublimateCount:0,equipmentEvolveCount:0,
          state:0,startAt:now,expireAt:0,createdAt:now,dynamodbExpireAt:0};
        put('UserGift',[present]);const grant=parse(await send('gift/receive',{userId:seed.userId,giftIds:[1]})).operation;
        const current=app.store.read(table).data.find(row=>row[idField]===itemId);
        assert.equal(current.amount,0);
        parse(await push({UserGift:[{...present,state:1}],[table]:[{...current,amount:2,signature:grant.signature}]},[grant]));
        assert.equal(app.store.read(table).data.find(row=>row[idField]===itemId).amount,2);
        parse(await push({[table]:[{...current,amount:0,signature:grant.signature}]}));
        await rejected(push({[table]:[{...current,amount:1,signature:grant.signature}]}),400);
      }
      if(source===capSources[0] && order==='stock-first') {
        const legacy=app.store.db.prepare('SELECT * FROM friendship_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,itemId);
        app.store.db.exec('ALTER TABLE friendship_item_claim DROP COLUMN stock_state; ALTER TABLE friendship_item_claim DROP COLUMN cap_version');
        await close();await open();const unknown=app.store.db.prepare('SELECT * FROM friendship_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,itemId);
        assert.equal(unknown.cap_version,0);assert.equal(unknown.stock_state,null);assert.equal(unknown.cumulative_amount,legacy.cumulative_amount);
        assert.equal(app.store.read(table).data.find(row=>row[idField]===itemId).amount,0);
        await rejected(push({[table]:[{...saved,amount:0}]}),503,true);
      }
    }

    //WRITTEN ONLY / NOT RUN: capped original Valis prizes and synthetic Familia funding/save order.
    const valis=master.currencies['currency.valis'],valisSources=[{kind:'cp',state:tables.get('UserCurrency')},
      {kind:'dispatch',stageId:707000007}],currencyRows=row=>[...app.store.read('UserCurrency').data.filter(item=>item.currencyId!==valis),row],
      donate={familiaId:1,amounts:[{donateValisId:24000001,amount:1}]};
    const settleDonation=async () => {
      const before=app.store.read('UserCurrency').data.find(row=>row.currencyId===valis),
        operation=parse(await send('familia/donate/valis',donate)).operation,
        charged={...before,amount:before.amount-operation.parameters.consumedValis},
        counters=app.store.read('UserFamiliaValisDonation').data.map(row=>{
          const target=operation.parameters.valisDonation.find(item=>item.donateValisId===row.donationId);
          return target?{...row,count:target.count,lastDonatedAt:operation.parameters.donatedAt}:row;
        });
      parse(await push({UserCurrency:currencyRows(charged),UserFamiliaValisDonation:counters},[operation]));return charged;
    };
    const localFamilia=() => {
      put('UserProfile',[{...app.store.read('UserProfile').data[0],familiaId:1,familiaName:'Solo'}]);
      app.store.db.prepare(`INSERT INTO local_familia(id,owner_id,settings,joined_at,contribution_point,valis,skill_point,
        creation_operation_id,creation_valis_before,creation_cumulative_before) VALUES(1,?,?,?,?,?,?,?,?,?)`)
        .run(seed.userId,JSON.stringify({name:'Solo',description:'Offline',godId:20000001,style:21000001,
          subStyle:0,activeTime:22000001,subActiveTime:22000002,requireApproval:false}),1,850,0,0,999,0,0);
    };
    const issueValis=async source => source.kind==='cp'?{
      operation:parse(await send('character/friendship/complete',cpRequest(source.state))).operations[0],body:cpRequest(source.state),
    }:dispatch(source.stageId);
    for(const source of valisSources) for(const variant of ['crossing','capped','stock-cap'])
      for(const order of ['flags-first','reward-first','combined','spent-before-save','stock-prefix']) {
        const {kind}=source;await fresh(`capped-valis-${kind}-${variant}-${order}`);localFamilia();
        if(kind==='dispatch') equipDispatchBoost();
        const funded={userId:seed.userId,currencyId:valis,reservedAmount:0,
          amount:variant==='stock-cap'?2000000000:1000000,cumulativeAmount:variant==='crossing'?999999998:999999999,
          signature:0xffffffff};put('UserCurrency',currencyRows(funded));
        const charged=await settleDonation(),floor=app.store.familiaValisSpendingFloor(),profiles=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all();
        if(kind==='cp' && variant==='crossing' && order==='flags-first')
          for(const table of ['friendship_reward','friendship_reward_claim','friendship_item_claim','operation_queue','reply_cache']) {
            app.store.db.exec(`CREATE TRIGGER friendship_valis_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'Valis issue rollback'); END`);
            await rejected(send('character/friendship/complete',cpRequest(source.state)),503);
            app.store.db.exec('DROP TRIGGER friendship_valis_issue_fail');
          }
        const {operation,body,rows}=await issueValis(source),action=kind==='cp'?'character/friendship/complete':'expedition/complete',
          flags=rows ?? characterRows(operation),target=app.store.db.prepare('SELECT * FROM friendship_item_claim WHERE operation_id=? AND item_id=?')
            .get(operation.id,valis),state=JSON.parse(target.valis_state),stock=JSON.parse(target.stock_state),
          items=itemDeltas(app.store,operation),gained=items.UserCurrency.find(row=>row.currencyId===valis),
          saved=order==='spent-before-save'?{...gained,amount:gained.amount-17}:gained,
          credit=gained.amount-charged.amount-(gained.cumulativeAmount-charged.cumulativeAmount),
          final={...flags,...items,UserCurrency:currencyRows(saved)};
        assert.ok(credit>0);assert.equal(target.cap_version,1);assert.equal(target.valis_seen,0);
        assert.deepEqual(state,{policy:'offline-friendship-valis-floor-v1',beforeAmount:charged.amount,beforeCumulative:charged.cumulativeAmount,
          grantAmount:target.amount,amount:gained.amount,cumulative:999999999,ceilingBefore:floor.ceiling,credit});
        assert.equal(stock.policy,'offline-friendship-stock-cap-v2');assert.equal(stock.valisFloorHash,md5(state));
        assert.notEqual(operation.signature,funded.signature);assert.deepEqual(app.store.read('UserCurrency').data,currencyRows(charged));
        if(kind==='cp') assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),profiles);
        if(kind==='dispatch') assert.equal(app.store.db.prepare('SELECT boost_valis FROM expedition_xp_claim WHERE operation_id=?')
          .get(operation.id).boost_valis,Math.fround(1.2));
        assert.equal(app.store.familiaValisSpendingFloor().ceiling,floor.ceiling);
        for(const changes of [{valis_state:null},{valis_state:'{'},{valis_seen:1},
          {valis_state:JSON.stringify({...state,credit:credit+1})},{stock_state:JSON.stringify({...stock,valisFloorHash:null})}]) {
          app.store.db.prepare(`UPDATE friendship_item_claim SET ${Object.keys(changes).map(field=>`${field}=?`).join(',')} WHERE operation_id=? AND item_id=?`)
            .run(...Object.values(changes),operation.id,valis);await rejected(send(action,body),503,true);
          app.store.db.prepare('UPDATE friendship_item_claim SET valis_state=?,stock_state=?,valis_seen=0 WHERE operation_id=? AND item_id=?')
            .run(target.valis_state,target.stock_state,operation.id,valis);
        }
        await rejected(push({...final,UserCurrency:currencyRows({...saved,signature:funded.signature})},[operation]),400);
        if(kind==='cp' && variant==='crossing' && order==='flags-first') {
          const claim=app.store.db.prepare('SELECT * FROM friendship_reward WHERE operation_id=?').all(operation.id).find(row=>
            Object.values(master.characters).some(character=>character.rewards.some(reward=>reward[0]===row.reward_id && reward[2]===6)));
          assert.ok(claim);app.store.db.prepare('DELETE FROM friendship_reward WHERE reward_id=?').run(claim.reward_id);
          await rejected(push(final),503,true);
          app.store.db.prepare('INSERT INTO friendship_reward(reward_id,operation_id,received_owner,received_at) VALUES(?,?,?,?)')
            .run(claim.reward_id,claim.operation_id,claim.received_owner,claim.received_at);
        }
        if(order==='stock-prefix') {
          const prefix={...charged,amount:gained.amount},delta=gained.amount-charged.amount;
          for(const [table,event] of [['profile','UPDATE'],['friendship_item_claim','UPDATE'],['reply_cache','INSERT']]) {
            app.store.db.exec(`CREATE TRIGGER friendship_prefix_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'Valis prefix rollback'); END`);
            await rejected(push({UserCurrency:currencyRows(prefix)}),503);app.store.db.exec('DROP TRIGGER friendship_prefix_fail');
          }
          const wire=pushBody({UserCurrency:currencyRows(prefix)}),response=await send('user_data/push',wire),identity=sequence;parse(response);
          const observed=app.store.db.prepare('SELECT * FROM friendship_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,valis);
          assert.equal(JSON.parse(observed.stock_state).amountAdded,delta);assert.equal(JSON.parse(observed.stock_state).observed,false);
          assert.equal(observed.valis_seen,0);assert.equal(app.store.familiaValisSpendingFloor().ceiling,floor.ceiling);
          await close();await open();const held=snapshot();
          assert.deepEqual((await request(port,identity,wire,String(identity),'user_data/push')).body,response.body);assert.equal(snapshot(),held);
          app.store.db.prepare('UPDATE friendship_item_claim SET stock_state=? WHERE operation_id=? AND item_id=?')
            .run(JSON.stringify({...JSON.parse(observed.stock_state),amountAdded:delta+1}),operation.id,valis);
          await rejected(push({UserCurrency:currencyRows(prefix)}),503,true);
          app.store.db.prepare('UPDATE friendship_item_claim SET stock_state=? WHERE operation_id=? AND item_id=?')
            .run(observed.stock_state,operation.id,valis);
          const spent={...prefix,amount:prefix.amount-17};parse(await push({UserCurrency:currencyRows(spent)}));
          await rejected(push({UserCurrency:currencyRows({...spent,amount:spent.amount+1})}),400);
          parse(await push({UserCurrency:currencyRows({...spent,cumulativeAmount:gained.cumulativeAmount})}));
          assert.equal(app.store.familiaValisSpendingFloor().ceiling,floor.ceiling);
          Object.assign(saved,{amount:spent.amount});await rejected(push({},[operation]),400);
          await rejected(send(action,body),503,true);
        } else if(order!=='combined') {
          const first=order==='flags-first'?flags:{UserCurrency:currencyRows(saved)};
          for(const [table,event] of [['profile','UPDATE'],...(order==='flags-first'?[]:
              [['friendship_item_claim','UPDATE'],['familia_valis_spending_floor','UPDATE']]),['reply_cache','INSERT']]) {
            app.store.db.exec(`CREATE TRIGGER friendship_valis_save_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'Valis save rollback'); END`);
            await rejected(push(first),503);app.store.db.exec('DROP TRIGGER friendship_valis_save_fail');
          }
          parse(await push(first));assert.equal(app.store.familiaValisSpendingFloor().ceiling,floor.ceiling+(order==='flags-first'?0:credit));
          await close();await open();await rejected(send(action,body),503,true);await rejected(push({},[operation]),400);
        }
        for(const [table,event] of [['profile','UPDATE'],...(['flags-first','combined','stock-prefix'].includes(order)?
            [['friendship_item_claim','UPDATE'],['familia_valis_spending_floor','UPDATE']]:[]),
            ['friendship_item_floor','INSERT'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER friendship_valis_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'Valis ACK rollback'); END`);
          await rejected(push(final,[operation]),503);app.store.db.exec('DROP TRIGGER friendship_valis_ack_fail');
        }
        const ack=pushBody(final,[operation]),response=await send('user_data/push',ack),identity=sequence;parse(response);
        assert.equal(app.store.familiaValisSpendingFloor().ceiling,floor.ceiling+credit);
        assert.equal(app.store.familiaValisSpendingFloor().source_kind,'friendship');assert.deepEqual(app.store.operations(),[]);
        assert.equal(app.store.db.prepare('SELECT valis_seen FROM friendship_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,valis).valis_seen,1);
        await close();await open();assert.deepEqual((await request(port,identity,ack,String(identity),'user_data/push')).body,response.body);
        const captured=app.store.db.prepare('SELECT * FROM friendship_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,valis),
          receipt=app.store.db.prepare('SELECT operation_json FROM friendship_reward_claim WHERE operation_id=?').get(operation.id);
        for(const changes of [{valis_seen:0},{valis_state:null},{stock_state:'{}'}]) {
          app.store.db.prepare(`UPDATE friendship_item_claim SET ${Object.keys(changes).map(field=>`${field}=?`).join(',')} WHERE operation_id=? AND item_id=?`)
            .run(...Object.values(changes),operation.id,valis);
          assert.throws(()=>app.store.familiaValisSpendingFloor(),/Valis|capture|friendship/);
          app.store.db.prepare('UPDATE friendship_item_claim SET valis_seen=?,valis_state=?,stock_state=? WHERE operation_id=? AND item_id=?')
            .run(captured.valis_seen,captured.valis_state,captured.stock_state,operation.id,valis);
        }
        app.store.db.prepare('UPDATE friendship_reward_claim SET operation_json=NULL WHERE operation_id=?').run(operation.id);
        assert.throws(()=>app.store.familiaValisSpendingFloor(),/source|friendship/);
        app.store.db.prepare('UPDATE friendship_reward_claim SET operation_json=? WHERE operation_id=?').run(receipt.operation_json,operation.id);
        const originalClaims=app.store.db.prepare('SELECT * FROM friendship_reward WHERE operation_id=?').all(operation.id),
          originalValis=originalClaims.find(row=>Object.values(master.characters).some(character=>character.rewards.some(reward=>reward[0]===row.reward_id && reward[2]===6)));
        if(originalValis) {
          app.store.db.prepare('DELETE FROM friendship_reward WHERE reward_id=?').run(originalValis.reward_id);
          assert.throws(()=>app.store.familiaValisSpendingFloor(),/Valis|CP|quantity/);
          app.store.db.prepare('INSERT INTO friendship_reward(reward_id,operation_id,received_owner,received_at) VALUES(?,?,?,?)')
            .run(originalValis.reward_id,originalValis.operation_id,originalValis.received_owner,originalValis.received_at);
        }
        const retainedFloor=app.store.familiaValisSpendingFloor();app.store.db.prepare('DELETE FROM familia_valis_spending_floor').run();
        await close();await open();await rejected(push(),503,true);
        app.store.db.prepare('INSERT INTO familia_valis_spending_floor(user_id,ceiling,source_operation_id,source_kind) VALUES(?,?,?,?)')
          .run(retainedFloor.user_id,retainedFloor.ceiling,retainedFloor.source_operation_id,retainedFloor.source_kind);
        const beforeLater=app.store.read('UserCurrency').data.find(row=>row.currencyId===valis),later=await settleDonation();
        assert.equal(app.store.familiaValisSpendingFloor().ceiling,later.amount-later.cumulativeAmount);
        await rejected(push({UserCurrency:currencyRows(beforeLater)}),400);
        parse(await push({UserCurrency:currencyRows({...later,amount:0})}));
        await rejected(push({UserCurrency:currencyRows({...later,amount:1})}),400);
        await rejected(push({UserCurrency:currencyRows({...later,amount:0,cumulativeAmount:999999998})}),400);
        await rejected(push({},[],{UserCurrency:[{currencyId:valis}]}),400);
        if(kind==='cp' && variant==='crossing' && order==='flags-first') {
          app.store.db.exec(`DROP INDEX friendship_valis_observed; DROP INDEX friendship_valis_capture; ALTER TABLE friendship_item_claim DROP COLUMN valis_state;
            ALTER TABLE friendship_item_claim DROP COLUMN valis_seen`);await close();await open();
          const legacy=app.store.db.prepare('SELECT * FROM friendship_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,valis);
          assert.equal(legacy.valis_state,null);assert.equal(legacy.valis_seen,0);assert.equal(legacy.stock_state,captured.stock_state);
          await rejected(push({UserCurrency:currencyRows({...later,amount:0})}),503,true);
        }
      }
    for(const source of valisSources) for(const variant of ['crossing','capped','stock-cap','exact-after-charge']) {
      await fresh(`capped-valis-zero-${source.kind}-${variant}`);if(source.kind==='dispatch') equipDispatchBoost();
      let quantity;
      if(variant==='exact-after-charge') {
        const probe=await issueValis(source);quantity=app.store.db.prepare('SELECT amount FROM friendship_item_claim WHERE operation_id=? AND item_id=?')
          .get(probe.operation.id,valis).amount;
        await fresh(`capped-valis-zero-${source.kind}-${variant}-funded`);if(source.kind==='dispatch') equipDispatchBoost();localFamilia();
      }
      const funded={userId:seed.userId,currencyId:valis,reservedAmount:0,amount:variant==='stock-cap'?2000000000:1000000,
        cumulativeAmount:variant==='crossing'?999999998:variant==='exact-after-charge'?999999999-quantity:999999999,signature:7};
      put('UserCurrency',currencyRows(funded));if(variant==='exact-after-charge') await settleDonation();
      const ceiling=app.store.familiaValisSpendingFloor().ceiling,{operation,rows}=await issueValis(source),
        target=app.store.db.prepare('SELECT * FROM friendship_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,valis),
        items=itemDeltas(app.store,operation);
      assert.equal(target.valis_state,null);assert.equal(target.valis_seen,0);assert.equal(JSON.parse(target.stock_state).valisFloorHash,null);
      if(variant==='exact-after-charge') {
        const baseline=app.store.read('UserCurrency').data.find(row=>row.currencyId===valis),
          acquired=items.UserCurrency.find(row=>row.currencyId===valis),prefix={...baseline,amount:acquired.amount};
        parse(await push({UserCurrency:currencyRows(prefix)}));assert.equal(app.store.familiaValisSpendingFloor().ceiling,ceiling);
        parse(await push({UserCurrency:currencyRows({...prefix,amount:prefix.amount-17})}));
        await rejected(push({UserCurrency:currencyRows({...prefix,amount:prefix.amount-16})}),400);
        acquired.amount-=17;
      }
      parse(await push({...(rows ?? characterRows(operation)),...items},[operation]));
      assert.equal(app.store.familiaValisSpendingFloor().ceiling,ceiling);
    }

    // Indexed reservations across both handoffs and an ordinary present.
    const gift = itemId => ({ userId:seed.userId,id:1,itemId,amount:2,title:'Synthetic receipt overlap',message:'',senderType:1,
      senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,pcHeroSublimateCount:0,
      state:0,startAt:now,expireAt:0,createdAt:now,dynamodbExpireAt:0 });
    for (const giftFirst of [true,false]) {
      await fresh(`overlap-${giftFirst}`); const fixture=await dispatch(707000001),operation=fixture.operation;
      // Remove this fixture's result before issue-order setup by using a fresh
      // database; never erase a real queue to make a handler pass.
      const itemId=operation.parameters.gainedItems.find(row => master.itemProfiles[row.rewardId].table==='UserStatusBoardItem').rewardId;
      await fresh(`overlap-ordered-${giftFirst}`); let dispatchOp,giftOp,rows;
      const present=gift(itemId); put('UserGift',[present]);
      if (giftFirst) giftOp=parse(await send('gift/receive',{ userId:seed.userId,giftIds:[1] })).operations[0];
      ({ operation:dispatchOp,rows }=await dispatch(707000001));
      if (!giftFirst) giftOp=parse(await send('gift/receive',{ userId:seed.userId,giftIds:[1] })).operations[0];
      const first=giftFirst?giftOp:dispatchOp,second=giftFirst?dispatchOp:giftOp;
      const firstTable=giftFirst?'gift_item_claim':'friendship_item_claim',secondTable=giftFirst?'friendship_item_claim':'gift_item_claim';
      const a=app.store.db.prepare(`SELECT cumulative_amount FROM ${firstTable} WHERE operation_id=? AND item_id=?`).get(first.id,itemId);
      const b=app.store.db.prepare(`SELECT cumulative_amount FROM ${secondTable} WHERE operation_id=? AND item_id=?`).get(second.id,itemId);
      assert.ok(b.cumulative_amount>a.cumulative_amount);
      const profile=master.itemProfiles[itemId],items=itemDeltas(app.store,dispatchOp);
      const native=items[profile.table].find(row => row[profile.idField]===itemId);
      native.amount=b.cumulative_amount; native.cumulativeAmount=b.cumulative_amount;
      parse(await push({ ...rows,...items,UserGift:[{ ...present,state:1 }] },[dispatchOp,giftOp]));
    }

    // Original fixed plus saved custom abilities:15%+5% for each bonus. The
    // synthetic gear is not an obtainable reward or actual native gear proof.
    for (const giftFirst of [true,false]) {
      await fresh(`valis-${giftFirst}`); const valis=master.currencies['currency.valis'],present=gift(valis);
      const pc=equipDispatchBoost();
      put('UserGift',[present]);
      let giftOp;
      if (giftFirst) giftOp=parse(await send('gift/receive',{ userId:seed.userId,giftIds:[1] })).operations[0];
      const { operation,rows }=await dispatch(707000007),xp=app.store.db.prepare('SELECT * FROM expedition_xp_claim WHERE operation_id=?').get(operation.id);
      if (!giftFirst) giftOp=parse(await send('gift/receive',{ userId:seed.userId,giftIds:[1] })).operations[0];
      assert.equal(xp.boost_xp,Math.fround(1.2)); assert.equal(xp.boost_valis,Math.fround(1.2));
      const duplicateInputs=JSON.parse(xp.inputs);
      duplicateInputs[0].weapon.abilities[0]=21000035002;
      duplicateInputs[0].armor.abilities[0]=21000034002;
      assert.deepEqual(app.store.expeditionBoosts(duplicateInputs),{ boost_xp:Math.fround(1.3),boost_valis:Math.fround(1.3) },
        'Saved custom and fixed original abilities stack, even when their IDs are the same');
      const expected=operation.parameters.gainedItems.filter(row=>row.rewardId===valis)
        .reduce((sum,row)=>sum+Math.trunc(Math.fround(Math.fround(row.amount)*Math.fround(1.2))),0);
      const claim=app.store.db.prepare('SELECT * FROM friendship_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,valis);
      assert.equal(claim.amount,expected);
      const items=itemDeltas(app.store,operation),saved=items.UserCurrency.find(row => row.currencyId===valis);
      const missingSp={ ...items,UserInfo:[{ ...items.UserInfo[0],playerStatus:{ ...items.UserInfo[0].playerStatus,
        baseSP:app.store.read('UserInfo').data[0].playerStatus.baseSP } }] };
      if (xp.sp_amount) await rejected(push({ ...rows,...missingSp },[operation]),400);
      const withoutXp={ ...items }; delete withoutXp.UserInfo;
      await rejected(push({ ...rows,...withoutXp },[operation]),400);
      await rejected(push({ ...rows,...items,UserInfo:[{ ...items.UserInfo[0],playerStatus:{ ...items.UserInfo[0].playerStatus,totalExp:xp.minimum_exp-1 } }] },[operation]),400);
      await rejected(push({ UserPC:[{ ...pc,equippedWeaponIndex:0,equippedArmorIndex:10001 }] }),400);
      saved.amount+=2; saved.cumulativeAmount+=2;
      parse(await push({ ...rows,...items,UserGift:[{ ...present,state:1 }] },[operation,giftOp]));
      assert.equal(app.store.db.prepare('SELECT cumulative_amount FROM friendship_item_floor WHERE item_id=?').get(valis).cumulative_amount,saved.cumulativeAmount);
      const floor=app.store.db.prepare('SELECT * FROM expedition_xp_floor WHERE user_id=?').get(seed.userId);
      assert.equal(floor.total_exp,items.UserInfo[0].playerStatus.totalExp);
      await rejected(push({ UserInfo:[{ ...items.UserInfo[0],playerStatus:{ ...items.UserInfo[0].playerStatus,totalExp:0,level:1 } }] }),400);
      parse(await push({ UserPC:[pc] })); // gear is mutable after the reward ACK
    }

    // WRITTEN ONLY cross-producer reservations and original queued level
    // capacities, not native callback ordering or client application proof.
    for (const kind of ['gift','consume']) for (const xpFirst of [true,false]) {
      await fresh(`sp-${kind}-${xpFirst}`); app.store.changeHardCurrency(100);
      const info=app.store.read('UserInfo').data[0];
      put('UserInfo',[{ ...info,playerStatus:{ ...info.playerStatus,totalExp:99,level:1,baseSP:7 } }]);
      const present={ ...gift(master.currencies['currency.stamina']),amount:10 };
      if (kind==='gift') put('UserGift',[present]);
      const issueOther=async()=>parse(await send(kind==='gift'?'gift/receive':'currency/hard/consume',
        kind==='gift'?{ userId:seed.userId,giftIds:[1] }:{ consumeId:81041001 })).operations[0];
      let other; if (!xpFirst) other=await issueOther();
      const { operation,rows }=await dispatch(707000001);
      if (xpFirst) other=await issueOther();
      const xp=app.store.staminaReward(operation),second=kind==='gift'?app.store.staminaReward(other):app.store.fixedConsumeReceipt(other);
      assert.equal(xp.amount,master.playerMaxSP[2]+master.playerMaxSP[3],'Every gained original level adds its own maxSP');
      assert.equal(xp.sp_before,xpFirst?7:second.sp_minimum);
      assert.equal(second.sp_before,xpFirst?xp.sp_minimum:7);
      if(kind==='consume') {
        const level=xpFirst?master.playerLevels.findLast(([,threshold])=>threshold<=xp.minimum_exp)[0]:info.playerStatus.level;
        assert.equal(second.sp_minimum,Math.min(0x7fffffff,second.sp_before+master.playerMaxSP[level]));
      }
      assert.equal(app.store.read('UserInfo').data[0].playerStatus.baseSP,7,'No SP pre-credit');
      const items=itemDeltas(app.store,operation),native=items.UserInfo[0];
      native.playerStatus.baseSP=Math.max(xp.sp_minimum,second.sp_minimum);
      const flags=kind==='gift'?{ UserGift:[{ ...present,state:1 }] }:{};
      parse(await push({ ...rows,...items,...flags },[],{ UserExpeditionParty:[{ expeditionStageId:707000001 }] }));
      assert.equal(app.store.staminaReward(operation).effect_saved,1);
      await close(); await open();
      // Observed, still-unacknowledged SP may be spent and must not reserve its
      // old target again for a later reward.
      native.playerStatus.baseSP=0; parse(await push({ UserInfo:[native] }));
      put('UserGift',[...app.store.read('UserGift').data,{ ...present,id:2 }]);
      const later=parse(await send('gift/receive',{ userId:seed.userId,giftIds:[2] })).operations[0];
      assert.equal(app.store.staminaReward(later).sp_before,0);
      native.playerStatus.baseSP=10;
      parse(await push({ UserInfo:[native],UserGift:app.store.read('UserGift').data.map(row=>({ ...row,state:1 })) },[operation,other,later]));
      assert.deepEqual(app.store.operations(),[]);
    }

    // WRITTEN ONLY: the exact native21000 first effect saved XP/level/SP, while
    // Iris, casino, items, friendship, party removal and stage updates remain untouched.
    await fresh('dispatch-xp-first-recovery');app.store.changeHardCurrency(100);
    const dispatchInfo=app.store.read('UserInfo').data[0];
    put('UserInfo',[{...dispatchInfo,playerStatus:{...dispatchInfo.playerStatus,totalExp:99,level:1,baseSP:7}}]);
    const xpFirstFixture=await dispatch(707000001),xpFirstOperation=xpFirstFixture.operation,
      xpFirstItems=itemDeltas(app.store,xpFirstOperation);
    assert.equal(xpFirstOperation.parameters.issueAmount,0);assert.equal(app.store.casinoRewardReceipt(xpFirstOperation),null);
    assert.throws(()=>app.store.expeditionColdRecovery(xpFirstOperation,{...xpFirstOperation,
      parameters:{...xpFirstOperation.parameters,offlineExpeditionXpApplied:1}}),error=>error.status===503);
    const xpSave=parse(await push({UserInfo:xpFirstItems.UserInfo}));
    assert.deepEqual(xpSave.operations,[],'An XP-first save reply must not immediately replay the additive callback');
    assert.deepEqual(app.store.operations(),[xpFirstOperation],'XP-first suppression is not an ACK or queue rewrite');
    const recoveredDispatch=app.store.expeditionColdRecovery(xpFirstOperation);
    assert.equal(recoveredDispatch.parameters.offlineExpeditionXpApplied,1);
    assert.equal(app.store.staminaReward(xpFirstOperation).effect_saved,1);
    assert.deepEqual(parse(await send('expedition/complete',xpFirstFixture.body)).operations[0],recoveredDispatch);
    for(const [action,value] of [['user_data/confirm',undefined],['user_data/pull',{tables:['UserInfo']}],['user/login',undefined]]) {
      const resumed=parse(await send(action,value)).operations.find(row=>row.id===xpFirstOperation.id);
      assert.deepEqual(resumed,recoveredDispatch);
    }
    const refill=parse(await send('currency/hard/consume',{consumeId:81041001})).operations[0],
      refillReceipt=app.store.fixedConsumeReceipt(refill);
    assert.equal(refillReceipt.sp_before,xpFirstItems.UserInfo[0].playerStatus.baseSP,
      'A later normal refill starts at actual spendable SP after the saved dispatch prefix');
    const ordered=parse(await send('user_data/confirm')).operations;
    assert.deepEqual(ordered.find(row=>row.id===xpFirstOperation.id),recoveredDispatch);
    assert.deepEqual(ordered.find(row=>row.id===refill.id),refill);
    const completedInfo=structuredClone(xpFirstItems.UserInfo);
    completedInfo[0].playerStatus.baseSP=refillReceipt.sp_minimum;
    parse(await push({...xpFirstFixture.rows,...xpFirstItems,UserInfo:completedInfo},[xpFirstOperation,refill]));
    assert.deepEqual(app.store.operations(),[]);

    // WRITTEN ONLY: original failure group711000058 carries one Iris. The
    // server wallet is already durable; native21000 only repeats its generic
    // no-op gem setter/issue notification after the XP marker skips addition.
    await fresh('dispatch-xp-first-iris-recovery');
    const irisInfo=app.store.read('UserInfo').data[0];
    put('UserInfo',[{...irisInfo,playerStatus:{...irisInfo.playerStatus,totalExp:99,level:1,baseSP:7}}]);
    const irisBefore=app.store.hardCurrency(),irisFixture=await dispatch(707000020),irisOperation=irisFixture.operation,
      irisItems=itemDeltas(app.store,irisOperation),irisAfterIssue=app.store.hardCurrency();
    assert.ok(irisOperation.parameters.issueAmount>0);
    assert.equal(irisAfterIssue,irisBefore+irisOperation.parameters.issueAmount);
    const irisSave=parse(await push({UserInfo:irisItems.UserInfo}));
    assert.deepEqual(irisSave.operations,[]);assert.deepEqual(app.store.operations(),[irisOperation]);
    const irisRecovered=app.store.expeditionColdRecovery(irisOperation);
    assert.equal(irisRecovered.parameters.offlineExpeditionXpApplied,1);
    assert.equal(irisRecovered.parameters.issueAmount,irisOperation.parameters.issueAmount);
    assert.equal(app.store.hardCurrency(),irisAfterIssue,'Recovery projection never credits Iris twice');
    assert.deepEqual(parse(await send('expedition/complete',irisFixture.body)).operations,[irisRecovered]);
    assert.equal(app.store.hardCurrency(),irisAfterIssue,'Exact hot replay never credits Iris twice');
    parse(await push({...irisFixture.rows,...irisItems},[irisOperation]));
    assert.deepEqual(app.store.operations(),[]);

    // WRITTEN ONLY: direct native23ff788 applies casino stock, signature and
    // lifetime after XP. A complete captured save removes only that reward row;
    // the source operation and every other callback remain unchanged.
    await fresh('dispatch-xp-first-casino-recovery');
    const casinoInfo=app.store.read('UserInfo').data[0],casinoStage=dispatchTables.get('casino');
    put('UserInfo',[{...casinoInfo,playerStatus:{...casinoInfo.playerStatus,totalExp:99,level:1,baseSP:7}}]);
    const casinoFixture=await dispatch(casinoStage),casinoOperation=casinoFixture.operation,
      casinoItems=itemDeltas(app.store,casinoOperation),casinoId=master.currencies['currency.casino_medal'],
      casinoReceipt=app.store.casinoRewardReceipt(casinoOperation);
    assert.equal(casinoReceipt.cap_version,1);assert.ok(casinoItems.UserCasinoState);
    parse(await push({UserInfo:casinoItems.UserInfo}));
    const xpCasinoPending=app.store.expeditionColdRecovery(casinoOperation);
    assert.equal(xpCasinoPending.parameters.offlineExpeditionXpApplied,1);
    assert(xpCasinoPending.parameters.gainedItems.some(row=>row.rewardId===casinoId));
    const casinoSaved=parse(await push({UserCasinoState:casinoItems.UserCasinoState}));
    assert.deepEqual(casinoSaved.operations,[],'A saved casino prefix is suppressed, not acknowledged');
    const casinoRecovered=app.store.expeditionColdRecovery(casinoOperation);
    assert.equal(casinoRecovered.parameters.offlineExpeditionXpApplied,1);
    assert(!casinoRecovered.parameters.gainedItems.some(row=>row.rewardId===casinoId));
    assert.deepEqual(app.store.operations(),[casinoOperation]);
    assert.deepEqual(parse(await send('expedition/complete',casinoFixture.body)).operations,[casinoRecovered]);
    parse(await push({...casinoFixture.rows,...casinoItems},[casinoOperation]));
    assert.deepEqual(app.store.operations(),[]);

    // WRITTEN ONLY: an old v0 receipt has no before-stock capture. Exact native
    // lifetime target plus the queued operation signature is attributable;
    // the same target under a foreign signature remains unavailable.
    await fresh('dispatch-legacy-casino-exact-recovery');
    const legacyInfo=app.store.read('UserInfo').data[0];
    put('UserInfo',[{...legacyInfo,playerStatus:{...legacyInfo.playerStatus,totalExp:99,level:1,baseSP:7}}]);
    const legacyFixture=await dispatch(casinoStage),legacyOperation=legacyFixture.operation,
      legacyItems=itemDeltas(app.store,legacyOperation),legacyBefore=app.store.read('UserCasinoState').data[0];
    app.store.db.prepare('UPDATE casino_reward_claim SET cap_version=0,before_stock=NULL WHERE operation_id=?')
      .run(legacyOperation.id);
    assert.equal(app.store.casinoRewardReceipt(legacyOperation).cap_version,0);
    const legacyTarget=legacyItems.UserCasinoState[0],foreignSignature=legacyBefore.signature===legacyOperation.signature?
      (legacyOperation.signature===1?2:1):legacyBefore.signature;
    parse(await push({UserCasinoState:[{...legacyTarget,signature:foreignSignature}]}));
    assert.equal(app.store.casinoRewardEffects(legacyOperation).legacyExact,false);
    await rejected(send('user_data/confirm'),503,true);
    parse(await push({UserCasinoState:[legacyTarget]}));
    const legacyEffects=app.store.casinoRewardEffects(legacyOperation),legacyRecovered=app.store.expeditionColdRecovery(legacyOperation);
    assert.equal(legacyEffects.captured,false);assert.equal(legacyEffects.legacyExact,true);
    assert(!legacyRecovered.parameters.gainedItems.some(row=>row.rewardId===casinoId));
    await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===legacyOperation.id),legacyRecovered);
    parse(await push({...legacyFixture.rows,...legacyItems},[legacyOperation]));
    assert.deepEqual(app.store.operations(),[]);

    await fresh('dispatch-partial-casino-suppression');
    const partialFixture=await dispatch(casinoStage),partialOperation=partialFixture.operation,
      partialBefore=app.store.read('UserCasinoState').data[0];
    assert.equal(app.store.casinoRewardReceipt(partialOperation).cap_version,1);
    const partialReply=parse(await push({UserCasinoState:[{...partialBefore,medalAmount:partialBefore.medalAmount+1}]}));
    assert.deepEqual(partialReply.operations,[]);assert.deepEqual(app.store.operations(),[partialOperation]);
    await rejected(send('user_data/confirm'),503,true);

    // WRITTEN ONLY: at the player-XP cap, a fully saved ordinary gainedItems
    // row is the first durable effect and can be omitted without a native hook.
    const ordinaryStage=[...dispatchTables].find(([table])=>!['UserCurrency','casino'].includes(table))?.[1];
    assert.ok(ordinaryStage);
    await fresh('dispatch-item-first-at-xp-cap-recovery');
    const itemInfo=app.store.read('UserInfo').data[0],maximumExp=master.playerLevels.at(-1)[1];
    put('UserInfo',[{...itemInfo,playerStatus:{...itemInfo.playerStatus,totalExp:maximumExp,
      level:master.playerLevels.at(-1)[0]}}]);
    const itemFixture=await dispatch(ordinaryStage),itemOperation=itemFixture.operation,
      itemReceipt=app.store.friendshipRewardReceipt(itemOperation),itemChanges=itemDeltas(app.store,itemOperation),
      itemTarget=itemReceipt.items.find(row=>row.cap_version===0 && row.table_name!=='UserCurrency'),
      acquiredItem=itemChanges[itemTarget?.table_name]?.find(row=>row[itemTarget?.id_field]===itemTarget?.item_id);
    assert.ok(itemTarget && acquiredItem);
    const itemBefore=app.store.read(itemTarget.table_name).data,
      itemRows=[...itemBefore.filter(row=>row[itemTarget.id_field]!==itemTarget.item_id),acquiredItem];
    const itemSave=parse(await push({[itemTarget.table_name]:itemRows}));
    assert.deepEqual(itemSave.operations,[],'A saved dispatch item prefix is suppressed, not acknowledged');
    const itemRecovered=app.store.expeditionColdRecovery(itemOperation);
    assert.equal(itemRecovered.parameters.offlineExpeditionXpApplied,undefined);
    assert(!itemRecovered.parameters.gainedItems.some(row=>row.rewardId===itemTarget.item_id));
    assert.deepEqual(parse(await send('expedition/complete',itemFixture.body)).operations,[itemRecovered]);
    assert.deepEqual(app.store.operations(),[itemOperation]);
    parse(await push({...itemFixture.rows,...itemChanges},[itemOperation]));
    assert.deepEqual(app.store.operations(),[]);

    // WRITTEN ONLY:23147dc is after XP/items/friendship and before stage
    // transitions. A saved deletion with native boost1 skips only that second
    // deletion; the original unsaved rewards and stage callback still run.
    await fresh('dispatch-party-deletion-recovery');
    const partyFixture=await dispatch(707000001),partyOperation=partyFixture.operation,
      partyItems=itemDeltas(app.store,partyOperation),partyXp=app.store.expeditionXpReceipt(partyOperation);
    assert.equal(partyXp.boost_xp,1);assert.equal(partyXp.boost_valis,1);
    const partySave=parse(await push({},[],{UserExpeditionParty:[{
      expeditionStageId:partyOperation.parameters.UserExpeditionStage.expeditionStageId}]}));
    assert.deepEqual(partySave.operations,[],'A saved party deletion is suppressed, not acknowledged');
    assert.equal(app.store.expeditionXpReceipt(partyOperation,false).party_effect_saved,1);
    const partyRecovered=app.store.expeditionColdRecovery(partyOperation);
    assert.equal(partyRecovered.parameters.offlineExpeditionPartyApplied,1);
    assert.equal(partyRecovered.parameters.offlineExpeditionXpApplied,undefined);
    assert.deepEqual(app.store.operations(),[partyOperation]);
    await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===partyOperation.id),partyRecovered);
    parse(await push({...partyFixture.rows,...partyItems},[partyOperation]));
    assert.deepEqual(app.store.operations(),[]);

    // WRITTEN ONLY: an XP-only fixture can retain its captured boosted amount
    // after party deletion; Valis still needs independent per-row recovery.
    await fresh('dispatch-party-deletion-boosted-xp-recovery');equipDispatchBoost();
    const boostedPartyFixture=await dispatch(707000001),boostedPartyOperation=boostedPartyFixture.operation,
      boostedPartyXp=app.store.expeditionXpReceipt(boostedPartyOperation),
      boostedPartyItems=itemDeltas(app.store,boostedPartyOperation);
    assert(boostedPartyXp.boost_xp>1 && boostedPartyXp.amount>300);
    assert(!boostedPartyOperation.parameters.gainedItems.some(row=>row.rewardId===master.currencies['currency.valis']));
    const boostedPartySave=parse(await push({},[],{UserExpeditionParty:[{
      expeditionStageId:boostedPartyOperation.parameters.UserExpeditionStage.expeditionStageId}]}));
    assert.deepEqual(boostedPartySave.operations,[]);assert.equal(app.store.expeditionXpReceipt(boostedPartyOperation,false).party_effect_saved,1);
    const boostedPartyRecovered=app.store.expeditionColdRecovery(boostedPartyOperation);
    assert.equal(boostedPartyRecovered.parameters.offlineExpeditionXpApplied,boostedPartyXp.amount);
    assert.equal(boostedPartyRecovered.parameters.offlineExpeditionPartyApplied,1);
    assert.throws(()=>app.store.expeditionColdRecovery(boostedPartyOperation,{...boostedPartyRecovered,parameters:{
      ...boostedPartyRecovered.parameters,offlineExpeditionXpApplied:boostedPartyXp.amount+1}}),error=>error.status===503);
    await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===boostedPartyOperation.id),boostedPartyRecovered);
    const boostedXpSave=parse(await push({UserInfo:boostedPartyItems.UserInfo}));
    assert.deepEqual(boostedXpSave.operations,[]);
    const boostedPartyXpSaved=app.store.expeditionColdRecovery(boostedPartyOperation,boostedPartyRecovered);
    assert.equal(boostedPartyXpSaved.parameters.offlineExpeditionXpApplied,1);
    assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===boostedPartyOperation.id),boostedPartyXpSaved);
    parse(await push({...boostedPartyFixture.rows,...boostedPartyItems},[boostedPartyOperation]));
    assert.deepEqual(app.store.operations(),[]);

    // WRITTEN ONLY: after the same observed deletion, each remaining Valis row
    // carries its own float32-truncated final amount instead of an aggregate.
    await fresh('dispatch-party-deletion-boosted-valis-recovery');equipDispatchBoost();
    const boostedValisInfo=app.store.read('UserInfo').data[0],boostedValisPc=app.store.read('UserPC').data[0],
      boostedValisCharacterId=master.pcProfiles[boostedValisPc.pcId].characterId,
      boostedValisCharacter=app.store.read('UserCharacter').data.find(row=>row.characterId===boostedValisCharacterId),
      boostedValisMaster=master.characters[boostedValisCharacterId],
      boostedValisStage=master.expeditionStages[707000007],
      boostedValisFriendship=master.expeditionRewardGroups[boostedValisStage.failureRewardGroupId].friendship,
      boostedValisReceived=new Set(app.store.read('UserCharacterFriendshipReward').data.filter(row=>row.isReceived).map(row=>row.rewardId)),
      boostedValisReward=boostedValisMaster.rewards.find(row=>{
        const threshold=boostedValisMaster.levels.find(([level])=>level===row[1])?.[1];
        return row[2]===6 && row[5]===boostedValisInfo.heroType && !boostedValisReceived.has(row[0]) && threshold>=boostedValisFriendship &&
          boostedValisMaster.levels.findLast(([,points])=>points<=threshold-boostedValisFriendship)?.[0]<row[1];
      }),boostedValisThreshold=boostedValisMaster.levels.find(([level])=>level===boostedValisReward?.[1])?.[1],
      boostedValisField=['friendship','friendshipAis','friendshipLef'][boostedValisInfo.heroType];
    assert.ok(boostedValisCharacter && boostedValisReward && Number.isSafeInteger(boostedValisThreshold) &&
      boostedValisThreshold>=boostedValisFriendship && boostedValisFriendship>0);
    put('UserCharacter',app.store.read('UserCharacter').data.map(row=>row.characterId===boostedValisCharacterId?
      {...row,[boostedValisField]:boostedValisThreshold-boostedValisFriendship}:row));
    const boostedValisFixture=await dispatch(707000007),boostedValisOperation=boostedValisFixture.operation,
      boostedValisXp=app.store.expeditionXpReceipt(boostedValisOperation),
      boostedValisItems=itemDeltas(app.store,boostedValisOperation),
      sourceValisRows=boostedValisOperation.parameters.gainedItems.filter(row=>row.rewardId===valis),
      expectedValisRows=sourceValisRows.map(row=>({...row,
        amount:Math.trunc(Math.fround(Math.fround(row.amount)*boostedValisXp.boost_valis))})),
      boostedValisBefore=app.store.read('UserCurrency').data.find(row=>row.currencyId===valis),
      boostedValisAfter=boostedValisItems.UserCurrency.find(row=>row.currencyId===valis);
    assert(boostedValisXp.boost_valis>1 && sourceValisRows.length>=2);
    // WRITTEN ONLY: the native gainedItems loop applies each duplicate row
    // separately. An exact first-row cumulative prefix omits only that row;
    // a later saved party deletion also projects every remaining Valis row.
    const valisClaim=app.store.friendshipRewardReceipt(boostedValisOperation).items.find(row=>row.item_id===valis),
      firstValis=expectedValisRows[0].amount,partialValis={...boostedValisAfter,
        amount:boostedValisBefore.amount+firstValis,cumulativeAmount:boostedValisBefore.cumulativeAmount+firstValis};
    assert.equal(valisClaim.cap_version,0);assert(firstValis>0 && partialValis.cumulativeAmount<valisClaim.cumulative_amount);
    assert.deepEqual(parse(await push({UserCurrency:currencyRows(partialValis)})).operations,[]);
    const prefixEffects=app.store.expeditionItemEffects(boostedValisOperation,valisClaim?[valisClaim]:[]);
    assert.equal(prefixEffects.partial,false);assert.equal(prefixEffects.appliedRows.size,1);
    const prefixRecovered=app.store.expeditionColdRecovery(boostedValisOperation);
    assert.deepEqual(prefixRecovered.parameters.gainedItems.filter(row=>row.rewardId===valis),sourceValisRows.slice(1));
    await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===boostedValisOperation.id),prefixRecovered);
    parse(await push({},[],{UserExpeditionParty:[{
      expeditionStageId:boostedValisOperation.parameters.UserExpeditionStage.expeditionStageId}]}));
    const boostedValisRecovered=app.store.expeditionColdRecovery(boostedValisOperation),
      recoveredValisRows=boostedValisRecovered.parameters.gainedItems.filter(row=>row.rewardId===valis);
    assert.deepEqual(recoveredValisRows,expectedValisRows.slice(1));
    assert.deepEqual(boostedValisOperation.parameters.gainedItems.filter(row=>row.rewardId===valis),sourceValisRows);
    const forgedValis=structuredClone(boostedValisRecovered);
    forgedValis.parameters.gainedItems.find(row=>row.rewardId===valis).amount++;
    assert.throws(()=>app.store.expeditionColdRecovery(boostedValisOperation,forgedValis),error=>error.status===503);
    await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===boostedValisOperation.id),boostedValisRecovered);
    const boostedValisRow=boostedValisItems.UserCurrency.find(row=>row.currencyId===valis),
      boostedValisSave=parse(await push({UserCurrency:currencyRows(boostedValisRow)}));
    assert.deepEqual(boostedValisSave.operations,[]);
    const boostedValisSaved=app.store.expeditionColdRecovery(boostedValisOperation,boostedValisRecovered);
    assert(!boostedValisSaved.parameters.gainedItems.some(row=>row.rewardId===valis));
    assert.deepEqual(app.store.expeditionColdRecovery(boostedValisOperation,prefixRecovered),boostedValisSaved,
      'An older exact row-prefix cache must monotonically rebind after full item and party saves');
    assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===boostedValisOperation.id),boostedValisSaved);
    parse(await push({...boostedValisFixture.rows,...boostedValisItems},[boostedValisOperation]));
    assert.deepEqual(app.store.operations(),[]);

    // WRITTEN ONLY: a capped Valis lifetime counter can saturate on the first
    // duplicate row while stock still proves that later rows are missing.
    await fresh('dispatch-capped-valis-row-prefix-recovery');equipDispatchBoost();
    put('UserCharacter',app.store.read('UserCharacter').data.map(row=>row.characterId===boostedValisCharacterId?
      {...row,[boostedValisField]:boostedValisThreshold-boostedValisFriendship}:row));
    const cappedValisSeed=app.store.read('UserCurrency').data.find(row=>row.currencyId===valis),
      cappedValisBefore={...cappedValisSeed,amount:1000000,cumulativeAmount:999999998,signature:7};
    put('UserCurrency',currencyRows(cappedValisBefore));
    const cappedValisFixture=await dispatch(707000007),cappedValisOperation=cappedValisFixture.operation,
      cappedValisXp=app.store.expeditionXpReceipt(cappedValisOperation),
      cappedValisItems=itemDeltas(app.store,cappedValisOperation),
      cappedSourceRows=cappedValisOperation.parameters.gainedItems.filter(row=>row.rewardId===valis),
      cappedExpectedRows=cappedSourceRows.map(row=>({...row,
        amount:Math.trunc(Math.fround(Math.fround(row.amount)*cappedValisXp.boost_valis))})),
      cappedValisAfter=cappedValisItems.UserCurrency.find(row=>row.currencyId===valis),
      cappedValisClaim=app.store.friendshipRewardReceipt(cappedValisOperation).items.find(row=>row.item_id===valis),
      cappedFirstAmount=cappedExpectedRows[0].amount,cappedValisPrefix={...cappedValisAfter,
        amount:cappedValisBefore.amount+cappedFirstAmount,cumulativeAmount:999999999};
    assert(cappedSourceRows.length>=2 && cappedFirstAmount>0);assert.equal(cappedValisClaim.cap_version,1);
    assert(cappedValisPrefix.amount<cappedValisAfter.amount);
    assert.deepEqual(parse(await push({UserCurrency:currencyRows(cappedValisPrefix)})).operations,[]);
    const cappedPrefixState=JSON.parse(app.store.db.prepare(
      'SELECT stock_state FROM friendship_item_claim WHERE operation_id=? AND item_id=?').get(cappedValisOperation.id,valis).stock_state);
    assert.equal(cappedPrefixState.amountAdded,cappedFirstAmount);assert.equal(cappedPrefixState.observed,false);
    const cappedPrefixRecovered=app.store.expeditionColdRecovery(cappedValisOperation);
    assert.deepEqual(cappedPrefixRecovered.parameters.gainedItems.filter(row=>row.rewardId===valis),cappedSourceRows.slice(1));
    await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===cappedValisOperation.id),cappedPrefixRecovered);
    assert.deepEqual(parse(await push({UserCurrency:currencyRows(cappedValisAfter)})).operations,[]);
    const cappedValisSaved=app.store.expeditionColdRecovery(cappedValisOperation,cappedPrefixRecovered);
    assert(!cappedValisSaved.parameters.gainedItems.some(row=>row.rewardId===valis));
    parse(await push({...cappedValisFixture.rows,...cappedValisItems},[cappedValisOperation]));
    assert.deepEqual(app.store.operations(),[]);

    await fresh('dispatch-partial-ordinary-item-suppression');
    const partialItemInfo=app.store.read('UserInfo').data[0];
    put('UserInfo',[{...partialItemInfo,playerStatus:{...partialItemInfo.playerStatus,totalExp:maximumExp,
      level:master.playerLevels.at(-1)[0]}}]);
    const partialItemFixture=await dispatch(ordinaryStage),partialItemOperation=partialItemFixture.operation,
      partialItemReceipt=app.store.friendshipRewardReceipt(partialItemOperation),
      partialItemTarget=partialItemReceipt.items.find(row=>row.cap_version===0 && row.table_name!=='UserCurrency' && row.amount>1),
      partialItemChanges=itemDeltas(app.store,partialItemOperation),
      partialAcquired=partialItemChanges[partialItemTarget?.table_name]?.find(row=>
        row[partialItemTarget?.id_field]===partialItemTarget?.item_id);
    assert.ok(partialItemTarget && partialAcquired);
    const partialItemBefore=app.store.read(partialItemTarget.table_name).data,
      partialItemRows=[...partialItemBefore.filter(row=>row[partialItemTarget.id_field]!==partialItemTarget.item_id),
        {...partialAcquired,amount:partialAcquired.amount-1,cumulativeAmount:partialItemTarget.cumulative_amount-1}],
      partialItemReply=parse(await push({[partialItemTarget.table_name]:partialItemRows}));
    assert.deepEqual(partialItemReply.operations,[]);assert.deepEqual(app.store.operations(),[partialItemOperation]);
    await rejected(send('user_data/confirm'),503,true);

    // WRITTEN ONLY:23e6b08 is an absolute CP setter and skips its level fanout
    // when the captured before/after levels match. Exact saved points may replay;
    // an incomplete crossing fanout is re-entered only through its private row marker.
    await fresh('dispatch-same-level-friendship-recovery');
    const pointFixture=await dispatch(ordinaryStage),pointOperation=pointFixture.operation,
      pointCapture=app.store.friendshipRewardReceipt(pointOperation);
    assert(pointCapture.friendship.every(row=>!row.initial && master.characters[row.characterId].levels
      .findLast(([,points])=>points<=row.before)[0]===row.friendshipLv));
    const pointSave=parse(await push({UserCharacter:pointFixture.rows.UserCharacter}));
    assert.deepEqual(pointSave.operations,[]);assert.deepEqual(app.store.operations(),[pointOperation]);
    const pointEffects=app.store.friendshipEffects(pointOperation);
    assert(pointEffects.length);assert(app.store.friendshipPointReplay(pointCapture,pointEffects));
    await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===pointOperation.id),pointOperation);
    parse(await push({...pointFixture.rows,...itemDeltas(app.store,pointOperation)},[pointOperation]));
    assert.deepEqual(app.store.operations(),[]);

    await fresh('dispatch-level-up-friendship-recovery');
    const crossingInfo=app.store.read('UserInfo').data[0],crossingPc=app.store.read('UserPC').data[0],
      crossingId=master.pcProfiles[crossingPc.pcId].characterId,crossingLevels=master.characters[crossingId].levels,
      crossingGain=master.expeditionRewardGroups[master.expeditionStages[ordinaryStage].failureRewardGroupId].friendship,
      crossing=crossingLevels.find(([level,points])=>points>=crossingGain &&
        crossingLevels.findLast(([,threshold])=>threshold<=points-crossingGain)[0]<level),
      crossingField=['friendship','friendshipAis','friendshipLef'][crossingInfo.heroType];
    assert.ok(crossing && crossingGain>0);
    put('UserCharacter',app.store.read('UserCharacter').data.map(row=>row.characterId===crossingId?
      {...row,[crossingField]:crossing[1]-crossingGain}:row));
    const crossingFixture=await dispatch(ordinaryStage),crossingOperation=crossingFixture.operation,
      crossingCapture=app.store.friendshipRewardReceipt(crossingOperation);
    assert(crossingCapture.friendship.some(row=>master.characters[row.characterId].levels
      .findLast(([,points])=>points<=row.before)[0]!==row.friendshipLv));
    const crossingSave=parse(await push({UserCharacter:crossingFixture.rows.UserCharacter}));
    assert.deepEqual(crossingSave.operations,[]);assert.deepEqual(app.store.operations(),[crossingOperation]);
    const crossingPointEffects=app.store.friendshipEffects(crossingOperation),crossingRecovery=
      app.store.friendshipPointRecovery(crossingCapture,crossingPointEffects),
      crossingPending=app.store.expeditionColdRecovery(crossingOperation);
    assert.ok(crossingRecovery?.pending.size,'Saved crossing points require their remaining per-character fanout');
    assert.ok(crossingPending.parameters.friendshipStates.some(row=>row.offlineExpeditionCpLevelPending===1));
    const markerIndex=crossingPending.parameters.friendshipStates.findIndex(row=>row.offlineExpeditionCpLevelPending===1),
      forgedValue={...crossingPending,parameters:{...crossingPending.parameters,
        friendshipStates:crossingPending.parameters.friendshipStates.map((row,index)=>index===markerIndex?
          {...row,offlineExpeditionCpLevelPending:2}:row)}},
      forgedCharacter={...crossingPending,parameters:{...crossingPending.parameters,
        friendshipStates:crossingPending.parameters.friendshipStates.map((row,index)=>index===markerIndex?
          {...row,characterId:row.characterId+999}:row)}};
    assert.throws(()=>app.store.expeditionColdRecovery(crossingOperation,forgedValue),error=>error.status===503);
    assert.throws(()=>app.store.expeditionColdRecovery(crossingOperation,forgedCharacter),error=>error.status===503);
    await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===crossingOperation.id),crossingPending);
    const crossingFanout=friendshipUnlockFixture(app.store,{},[crossingOperation]);
    assert.ok(Object.keys(crossingFanout).length,'Crossing fixture must carry at least one captured fanout effect');
    const fanoutSave=parse(await push(crossingFanout));
    assert.deepEqual(fanoutSave.operations,[]);assert.deepEqual(app.store.operations(),[crossingOperation]);
    const crossingEffects=app.store.friendshipEffects(crossingOperation);
    assert(crossingEffects.some(key=>key.startsWith('cp:')));
    assert(app.store.friendshipPointReplay(crossingCapture,crossingEffects));
    assert.deepEqual(app.store.expeditionColdRecovery(crossingOperation,crossingPending),crossingOperation,
      'A cached per-character marker must disappear after the complete fanout is durable');
    await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===crossingOperation.id),crossingOperation);
    parse(await push({...crossingFixture.rows,...itemDeltas(app.store,crossingOperation)},[crossingOperation]));
    assert.deepEqual(app.store.operations(),[]);

    // WRITTEN ONLY: a completed crossing may precede or follow an untouched
    // character when only that completed character's own fanout is durable.
    await fresh('dispatch-multi-character-fanout-recovery');
    const multiSources=[...new Map(Object.values(master.communicationCharacters).map(row=>[row.characterId,row.key]))]
      .flatMap(([characterId,key])=>{
        const stage=Object.entries(master.stageProgression).find(([stageId,row])=>{
          const episode=master.episodeProgression[row.episodeId],adventure=master.adventureProgression[episode?.adventureId];
          return row.level===1 && row.unlockCondition===5 && master.stageUnlocks[stageId] && adventure?.label===key;
        }),levels=master.characters[characterId]?.levels,row=app.store.read('UserCharacter').data.find(row=>row.characterId===characterId);
        return stage && levels?.length>1 && row ? [{characterId,stageId:Number(stage[0]),levels,row}] : [];
      }).slice(0,2);
    assert.equal(multiSources.length,2,'Original character quests must provide two independent crossing fixtures');
    const multiTargets=multiSources.map(({characterId,levels})=>({characterId,userHeroType:0,before:levels[0][1],
      friendship:levels[1][1],friendshipLv:levels[1][0]})),multiUnlocks={effects:multiSources.map(({stageId})=>({stageId,kind:'open'}))},
      completedKeys=[`cp:${multiTargets[0].characterId}:0`,`unlock:${multiSources[0].stageId}`];
    put('UserCharacter',app.store.read('UserCharacter').data.map(row=>{
      const index=multiTargets.findIndex(target=>target.characterId===row.characterId);
      return index<0?row:{...row,friendship:index===0?multiTargets[index].friendship:multiTargets[index].before};
    }));
    for(const friendship of [multiTargets,[...multiTargets].reverse()])
      assert(app.store.friendshipPointReplay({friendship,unlocks:multiUnlocks},completedKeys));
    assert(!app.store.friendshipPointReplay({friendship:multiTargets,unlocks:multiUnlocks},completedKeys.slice(0,1)));
    put('UserCharacter',app.store.read('UserCharacter').data.map(row=>row.characterId===multiTargets[1].characterId?
      {...row,friendship:multiTargets[1].friendship}:row));
    assert(!app.store.friendshipPointReplay({friendship:multiTargets,unlocks:multiUnlocks},[
      ...completedKeys,`cp:${multiTargets[1].characterId}:0`]));
    assert(app.store.friendshipPointReplay({friendship:multiTargets,unlocks:multiUnlocks},[
      ...completedKeys,`cp:${multiTargets[1].characterId}:0`,`unlock:${multiSources[1].stageId}`]));

    await fresh('sp-needs-xp');
    const pending=await dispatch(707000001),xpSp=app.store.staminaReward(pending.operation);
    assert.ok(xpSp);
    const beforeInfo=app.store.read('UserInfo').data[0];
    parse(await push({ UserInfo:[{ ...beforeInfo,playerStatus:{ ...beforeInfo.playerStatus,baseSP:xpSp.sp_minimum } }] }));
    assert.equal(app.store.staminaReward(pending.operation).effect_saved,0,'SP alone cannot observe an unsaved XP level-up');
    await rejected(push(pending.rows,[pending.operation]),400);
    parse(await push({ ...pending.rows,...itemDeltas(app.store,pending.operation) },[pending.operation]));

    for (const baseSP of [0x7ffffffe,0x7fffffff]) {
      await fresh(`sp-cap-${baseSP}`); const info=app.store.read('UserInfo').data[0];
      put('UserInfo',[{ ...info,playerStatus:{ ...info.playerStatus,totalExp:99,level:1,baseSP } }]);
      const { operation,rows }=await dispatch(707000001),target=app.store.staminaReward(operation);
      assert.equal(target.amount,43); assert.equal(target.sp_before,baseSP); assert.equal(target.sp_minimum,0x7fffffff);
      await rejected(push(rows,[operation]),400);
      parse(await push({ ...rows,...itemDeltas(app.store,operation) },[operation]));
      assert.equal(app.store.db.prepare('SELECT sp_effect_saved FROM expedition_xp_claim WHERE operation_id=?').get(operation.id).sp_effect_saved,1);
    }

    for (const beforeExp of [99,350,0x80000000,master.playerLevels.at(-1)[1]-1,master.playerLevels.at(-1)[1]]) {
      await fresh(`xp-${beforeExp}`); const info=app.store.read('UserInfo').data[0];
      put('UserInfo',[{ ...info,playerStatus:{ ...info.playerStatus,totalExp:beforeExp,
        level:master.playerLevels.findLast(([,exp])=>exp<=beforeExp)[0] } }]);
      const { operation,rows }=await dispatch(707000001),items=itemDeltas(app.store,operation);
      const saved=parse(await push({ ...rows,...items },[],{ UserExpeditionParty:[{ expeditionStageId:707000001 }] }));
      assert.deepEqual(saved.operations,[],'A native deleted party must not reapply a pending dispatch with different boosts');
      assert.deepEqual(app.store.operations(),[operation],'Suppressed redelivery is not a reward ACK or queue deletion');
      const sp=app.store.db.prepare('SELECT sp_amount,sp_effect_saved FROM expedition_xp_claim WHERE operation_id=?').get(operation.id);
      assert.equal(sp.sp_effect_saved,sp.sp_amount?1:0);
      if (beforeExp===350 || beforeExp===master.playerLevels.at(-1)[1]) assert.equal(sp.sp_amount,0);
      await close(); await open();
      for (const [action,value] of [['user_data/confirm',undefined],['user_data/pull',{ tables:['UserInfo'] }],['user/login',undefined]])
        await rejected(send(action,value),503,true);
      const spent=structuredClone(items.UserInfo); spent[0].playerStatus.baseSP=0;
      parse(await push({ UserInfo:spent },[operation]));
      assert.equal(app.store.read('UserInfo').data[0].playerStatus.totalExp,items.UserInfo[0].playerStatus.totalExp);
      assert.ok(items.UserInfo[0].playerStatus.totalExp<=master.playerLevels.at(-1)[1]);
      app.store.db.prepare('DELETE FROM expedition_xp_floor WHERE user_id=?').run(seed.userId);
      await rejected(push({ UserInfo:app.store.read('UserInfo').data }),503,true);
    }
    for (const table of ['expedition_xp_claim','expedition_completion','reply_cache']) {
      await fresh(`dispatch-issue-${table}`);
      app.store.db.exec(`CREATE TRIGGER fail_issue BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'dispatch XP issue rollback'); END`);
      await dispatch(707000001,true);
    }
    for (const table of ['expedition_xp_floor','expedition_xp_claim','operation_done','profile','operation_queue','reply_cache']) {
      await fresh(`dispatch-save-${table}`); const { operation,rows }=await dispatch(707000001);
      const mode=['profile','expedition_xp_claim'].includes(table)?'UPDATE':table==='operation_queue'?'DELETE':'INSERT';
      app.store.db.exec(`CREATE TRIGGER fail_save BEFORE ${mode} ON ${table} BEGIN SELECT RAISE(ABORT,'dispatch XP save rollback'); END`);
      await rejected(push({ ...rows,...itemDeltas(app.store,operation) },[operation]),503);
    }
    for (const missing of ['expedition_xp_claim','friendship_reward_claim','friendship_item_claim']) {
      await fresh(`dispatch-lost-${missing}`); const { operation }=await dispatch(707000001);
      app.store.db.prepare(`DELETE FROM ${missing} WHERE operation_id=?`).run(operation.id);
      for (const [action,value] of [['user_data/confirm',undefined],['user_data/pull',{ tables:['UserInfo'] }],['user/login',undefined]])
        await rejected(send(action,value),503,true);
    }
    // Model the previous table shape in this disposable fixture only. Adding
    // nullable columns preserves the old receipt; it must not invent SP proof.
    await fresh('legacy-sp-columns'); const legacyFixture=await dispatch(707000001);
    await close(); const legacy=new DatabaseSync(database);
    try {
      for (const column of ['sp_amount','sp_before','sp_minimum','sp_effect_saved']) legacy.exec(`ALTER TABLE expedition_xp_claim DROP COLUMN ${column}`);
    } finally { legacy.close(); }
    await open();
    const unknown=app.store.db.prepare('SELECT * FROM expedition_xp_claim WHERE operation_id=?').get(legacyFixture.operation.id);
    for (const column of ['sp_amount','sp_before','sp_minimum','sp_effect_saved']) assert.equal(unknown[column],null);
    for (const [action,value] of [['user_data/confirm',undefined],['user_data/pull',{ tables:['UserInfo'] }],['user/login',undefined]])
      await rejected(send(action,value),503,true);
    assert.deepEqual(app.store.operations(),[legacyFixture.operation]);

    for (const [column,value] of [['sp_amount',1],['sp_before',-1],['sp_minimum',0],['sp_effect_saved',2]]) {
      await fresh(`bad-${column}`); const { operation,rows }=await dispatch(707000001);
      app.store.db.prepare(`UPDATE expedition_xp_claim SET ${column}=? WHERE operation_id=?`).run(value,operation.id);
      await rejected(push({ ...rows,...itemDeltas(app.store,operation) },[operation]),503,true);
      for (const [action,input] of [['user_data/confirm',undefined],['user_data/pull',{ tables:['UserInfo'] }],['user/login',undefined]])
        await rejected(send(action,input),503,true);
    }

    for (const owner of [seed.userId,0]) {
      await fresh(`cost-owner-${owner}`); const cpItemId=215000001;
      put('UserCharacter',app.store.read('UserCharacter').data.map(row=>row.characterId===101000002 ? { ...row,userId:owner } : row));
      put('UserCpItem',[{ userId:seed.userId,cpItemId,amount:20,cumulativeAmount:30,reservedAmount:0,signature:0,bookEntryState:3 }]);
      const body={ friendshipStates:[{ characterId:101000002,friendship:600,friendshipLv:master.characters[101000002].levels
        .findLast(([,points]) => points<=600)[0],userHeroType:0 }],itemId:cpItemId,itemAmount:3 };
      const operation=parse(await send('character/friendship/complete',body)).operations[0],flags=characterRows(operation);
      await rejected(push(flags,[operation]),400);
      // A separate gain+5 does not hide required consumption-3.
      parse(await push({ ...flags,UserCpItem:[{ userId:seed.userId,cpItemId,amount:25,cumulativeAmount:35,reservedAmount:0,signature:0,bookEntryState:3 }] }));
      await rejected(push({},[operation]),400);
      parse(await push({ UserCpItem:[{ userId:seed.userId,cpItemId,amount:22,cumulativeAmount:35,reservedAmount:0,signature:0,bookEntryState:3 }] },[operation]));
      await close(); await open();
      assert.equal(app.store.read('UserCharacter').data.find(row=>row.characterId===101000002).userId,owner);
    }

    // Source-only injection and preserved cold-path failures, never fake ACK.
    for (const table of ['friendship_reward_claim','friendship_item_claim','friendship_completion_request','operation_queue','reply_cache']) {
      await fresh(`issue-${table}`); app.store.db.exec(`CREATE TRIGGER fail_issue BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'friendship issue rollback'); END`);
      await rejected(send('character/friendship/complete',cpRequest(tables.get('UserExpItem'))),503);
    }
    for (const table of ['stage_friendship_floor','friendship_item_floor','operation_done','profile','operation_queue']) {
      await fresh(`save-${table}`); const op=parse(await send('character/friendship/complete',cpRequest(tables.get('UserExpItem')))).operations[0];
      const mode=table==='profile'?'UPDATE':table==='operation_queue'?'DELETE':'INSERT';
      app.store.db.exec(`CREATE TRIGGER fail_save BEFORE ${mode} ON ${table} BEGIN SELECT RAISE(ABORT,'friendship save rollback'); END`);
      await rejected(push({ ...characterRows(op),...itemDeltas(app.store,op) },[op]),503);
    }
    for (const missing of ['friendship_reward_claim','friendship_item_claim']) {
      await fresh(`lost-${missing}`); const op=parse(await send('character/friendship/complete',cpRequest(tables.get('UserExpItem')))).operations[0];
      app.store.db.prepare(`DELETE FROM ${missing} WHERE operation_id=?`).run(op.id);
      for (const [action,value] of [['user_data/confirm',undefined],['user_data/pull',{ tables:['UserCharacter'] }],['user/login',undefined]])
        await rejected(send(action,value),503,true);
      assert.deepEqual(app.store.operations(),[op]);
    }
    await fresh('lost-floor');
    const op=parse(await send('character/friendship/complete',cpRequest(tables.get('UserExpItem')))).operations[0];
    parse(await push({ ...characterRows(op),...itemDeltas(app.store,op) },[op]));
    const target=app.store.db.prepare('SELECT * FROM friendship_item_claim WHERE operation_id=?').get(op.id);
    app.store.db.prepare('DELETE FROM friendship_item_floor WHERE item_id=?').run(target.item_id);
    await rejected(push({ [target.table_name]:app.store.read(target.table_name).data }),503,true);
    console.log('Friendship/dispatch inventory, equipment boosts, XP and per-level SP receipts: synthetic checks OK; actual native effects/SP/UI not certified');
  } finally {
    crypto.randomInt=realRandom; await close(); fs.rmSync(directory,{ recursive:true,force:true });
  }
}

module.exports = { itemDeltas };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode=1; });
