'use strict';
// DEFERRED / NOT RUN: execute only after every packet is implemented.
// Synthetic SQLite/HTTP checks do not establish native gameplay or scoring parity.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs'),{request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const hash=data=>crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-gve-completion-')),database=path.join(directory,'profile.sqlite'),
    rewardEventId=master.familiaMissionAchievements.find(mission=>mission.recordType===201 && mission.rewardType===1)?.eventId,
    [stageKey,original]=Object.entries(master.gveStages).filter(([,row])=>row.gveId===rewardEventId &&
      master.gveEvents[row.gveId].type===20).sort(([,left],[,right])=>right.slot5+right.slot8-left.slot5-left.slot8)[0],
    event=master.gveEvents[original.gveId],action='guild_event/stage/complete',rankingAction='gve/ranking/user/familia/get',
    familyActions=['guild_event/ranking/familia/top/get','guild_event/ranking/familia/around/get','guild_event/ranking/familia/get'],
    [otherStageKey,otherOriginal]=Object.entries(master.gveStages).find(([,row])=>row.gveId!==original.gveId &&
      master.gveEvents[row.gveId].type===20 && master.gveEvents[row.gveId].window6>event.window6 && row.slot5>0 && row.slot8>0),
    otherEvent=master.gveEvents[otherOriginal.gveId],otherRoutes=[...familyActions,'gve/summary/get',rankingAction,
      'gve/ranking/character/get','guild_event/score/user/daily/get','guild_event/status/log'];
  let app,port,sequence=0,now=event.window6+60;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
    app.store.read('UserGvERecord');app.store.read('UserGvEHighScoreParty');};
  const close=async()=>{if(app)await app.close();app=null;};
  const send=(route,body)=>request(port,++sequence,body,String(sequence),route);
  const ok=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);};
  const put=(name,data)=>{if(!app.store.db.prepare('SELECT 1 FROM profile WHERE name=?').get(name))app.store.read(name);
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(data),hash(data),name);};
  const native=()=>app.store.db.prepare('SELECT * FROM profile ORDER BY name').all();
  const itemRow=(itemId,cumulativeAmount,amount,signature=0)=>{
    const profile=master.itemProfiles[itemId];
    return {userId:seed.userId,[profile.idField]:itemId,signature,bookEntryState:3,cumulativeAmount,
      ...(profile.table==='UserGachaTicket'?{dateList:Array.from({length:amount},()=>({aquiredAt:now}))}:{amount}),
      ...(['UserCurrency','UserKeyItem','UserHeroSublimateItem'].includes(profile.table)?{reservedAmount:0}:{}),
      ...(profile.table==='UserKeyItem'?{exploit:false}:{})};
  };
  const rewardEnvelope=rows=>{
    const items=new Map();let issueAmount=0;
    for(const row of rows) if(row.rewardType===3) issueAmount+=row.rewardAmount;
    else {
      const itemId=master.items[row.rewardKey];items.set(itemId,(items.get(itemId)??0)+row.rewardAmount);
    }
    return {UserAchievement:[],receivedItems:[...items].map(([itemId,amount])=>({itemId,amount})),
      receivedCostumes:[],receivedPCs:[],receivedMemorias:[],issueAmount,issueStamina:0,
      issueCasinoMedal:0,issueUnionRaidMedal:0};
  };
  const missionRows=master.familiaMissionAchievements.filter(row=>row.eventId===original.gveId &&
    now>=row.startAt && (!row.expireAt || now<=row.expireAt));
  assert.ok(missionRows.length && missionRows.every(row=>row.recordType===201),
    'Deferred GVE fixture must use an original total-score Familia mission catalog');
  assert.equal(original.slot9,0,'Later reward-bearing GVE stages use the authored no-action-curve selector');
  const legacyEvents=Object.values(master.gveEvents).filter(row=>row.type===19),
    modernEvents=Object.values(master.gveEvents).filter(row=>row.type===20),
    modernDaily=modernEvents.map(row=>row.dailySP ?? row.slot9);
  assert.equal(legacyEvents.length,7);assert.equal(modernEvents.length,16);
  assert.deepEqual(modernDaily,[5,0,0,0,0,20,20,99,99,99,99,99,99,99,99,99]);
  assert.ok(legacyEvents.every(row=>(row.dailySP ?? row.slot9)===5 &&
    (!Object.hasOwn(row,'staminaEnabled') || row.staminaEnabled===false) &&
    (!Object.hasOwn(row,'episodeId') || row.episodeId>0)));
  assert.ok(modernEvents.every(row=>(!Object.hasOwn(row,'staminaEnabled') || row.staminaEnabled===true) &&
    (!Object.hasOwn(row,'episodeId') || row.episodeId===0)));
  assert.equal(master.gveActionBonuses.filter(row=>row.selector===original.slot9).length,0);
  const duplicatedActionCurve=master.gveActionBonuses.filter(row=>row.selector===100001);
  assert.equal(duplicatedActionCurve.length,150);assert.equal(new Set(duplicatedActionCurve.map(row=>row.actionThreshold)).size,75);
  for(const threshold of new Set(duplicatedActionCurve.map(row=>row.actionThreshold)))
    assert.equal(new Set(duplicatedActionCurve.filter(row=>row.actionThreshold===threshold).map(row=>row.value)).size,1,
      'The two archived action rows at each threshold must agree before deduplication');
  const missionResponse=async(progress,updatedAt)=>{
    const before=native(),pending=app.store.operations(),response=await send('familia/achievement/get',{targetEventId:original.gveId}),
      achievements=ok(response).achievements;
    assert.deepEqual(achievements.obtained,[],'A score below every original threshold cannot publish a reward');
    assert.deepEqual(achievements.not_obtained,missionRows.map(row=>({achievementId:row.id,
      currentParam:Math.min(progress,0x7fffffff),updatedAt})));
    assert.deepEqual(native(),before);assert.deepEqual(app.store.operations(),pending);
    return {response,sequence};
  };
  const save=async(tables,operation=null,trigger=null)=>send('user_data/push',{badges:null,scripts:{},dataTokens:{},
    checksums:{before:{},after:Object.fromEntries(Object.entries(tables).map(([name,data])=>[name,hash(data)]))},
    deltas:Object.keys(tables).length ? [{signature:0,trigger:trigger ?? (tables.UserCurrency ? 'Familia' : 'AdventureComplete'),deleteItems:{},putItems:tables}] : [],
    operations:operation ? [{id:operation.id,verifier:operation.token}] : []});
  const read=route=>send(route,{gveId:original.gveId});
  const emptyFamily=(route,joined=true)=>route.endsWith('/familia/get') ?
    {code:0,member_daily_ranking:[],member_total_ranking:[],familia_score_rank:{rank:0,score:0}} :
    {code:0,belongsFamilia:joined,ranking:[]};
  const reject=async(body,status=503)=>{const before=native(),pending=app.store.operations(),response=await send(action,body);
    assert.equal(response.status,status,response.body.toString());if(status===503)assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.deepEqual(native(),before);assert.deepEqual(app.store.operations(),pending);};
  const unaffiliatedFamilyReplies=[];
  const otherReplies=[],otherBody=route=>({gveId:otherOriginal.gveId,...(route==='guild_event/status/log' ? {count:10} : {})}),
    otherEmptyResponse=route=>route.startsWith('guild_event/ranking/familia/') ? emptyFamily(route) :
      route==='gve/summary/get' ? {code:0,summary:{familiaScore:0,userRank:0},ranking:[]} :
      route==='gve/ranking/character/get' ? {code:0,ranking:{normal:[],assist:[]}} :
      route==='guild_event/score/user/daily/get' ? {code:0,score:0} :
      route==='guild_event/status/log' ? {code:0,logs:[]} : {code:0,ranking:[]};
  const otherEmpty=async(remember=false)=>{
    const before=native(),pending=app.store.operations();
    for(const route of otherRoutes) {
      const response=await send(route,otherBody(route));assert.deepEqual(ok(response),otherEmptyResponse(route),
        'An acknowledged or pending OTHER event cannot block an actual untouched event');
      if(remember)otherReplies.push([route,sequence,response.body]);
    }
    const missions=ok(await send('familia/achievement/get',{targetEventId:otherOriginal.gveId})).achievements;
    assert.deepEqual(missions.obtained,[]);assert.ok(missions.not_obtained.every(row=>row.currentParam===0));
    assert.deepEqual(native(),before);assert.deepEqual(app.store.operations(),pending);
  };
  const otherUnavailable=async()=>{
    const before=native(),pending=app.store.operations();
    for(const route of otherRoutes) {
      const response=await send(route,otherBody(route));assert.equal(response.status,503);
      assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
    }
    for(const [route,id] of otherReplies)
      assert.equal((await request(port,id,otherBody(route),String(id),route)).status,503,'Cached empty views retain newly found history');
    assert.equal((await send('familia/achievement/get',{targetEventId:otherOriginal.gveId})).status,503);
    assert.deepEqual(native(),before);assert.deepEqual(app.store.operations(),pending);
  };
  try {
    await open();
    const rejectStaminaSave=async tables=>{
      const before=native(),pending=app.store.operations(),response=await save(tables);
      assert.equal(response.status,400,response.body.toString());assert.deepEqual(native(),before);
      assert.deepEqual(app.store.operations(),pending);
    };
    const userInfo=structuredClone(app.store.read('UserInfo').data),playerStatus=userInfo[0].playerStatus;
    await rejectStaminaSave({UserInfo:[{...userInfo[0],playerStatus:{...playerStatus,gveSP:0x80000000}}]});
    await rejectStaminaSave({UserInfo:[{...userInfo[0],playerStatus:{...playerStatus,gveSPLastResetAt:0.5}}]});
    const staminaRoot=structuredClone(app.store.read('UserGuildEventStaminas').data),legacyStage=Object.values(master.gveStages)
      .find(row=>master.gveEvents[row.gveId].type===19).adventureStageId,
      staminaRow={guildEventStageId:original.adventureStageId,sp:1};
    await rejectStaminaSave({UserGuildEventStaminas:[{...staminaRoot[0],staminas:[{...staminaRow,sp:-1}]}]});
    await rejectStaminaSave({UserGuildEventStaminas:[{...staminaRoot[0],staminas:[{...staminaRow,guildEventStageId:legacyStage}]}]});
    await rejectStaminaSave({UserGuildEventStaminas:[{...staminaRoot[0],staminas:[staminaRow,{...staminaRow}]}]});
    // Imported corruption must also remain unavailable on reads instead of
    // becoming an invented attempt balance. These are deferred source cases.
    put('UserInfo',[{...userInfo[0],playerStatus:{...playerStatus,gveSP:'1'}}]);
    assert.throws(()=>app.store.read('UserInfo'),/legacy GVE attempt fields/);put('UserInfo',userInfo);
    put('UserGuildEventStaminas',[{...staminaRoot[0],staminas:[{...staminaRow,sp:-1}]}]);
    assert.throws(()=>app.store.read('UserGuildEventStaminas'),/Guild Event stage stamina/);
    put('UserGuildEventStaminas',staminaRoot);
    for(const route of familyActions) {
      const response=await read(route);
      if(route.endsWith('/familia/get'))assert.equal(response.status,503,'Member rankings require actual saved membership');
      else {
        assert.deepEqual(ok(response),emptyFamily(route,false),'A genuinely untouched unaffiliated player has no invented groups');
        unaffiliatedFamilyReplies.push([route,sequence]);
      }
      assert.equal((await send(route,{gveId:0x7fffffff})).status,400,'Unaffiliated views still validate original event identity');
    }
    put('UserCurrency',[{userId:seed.userId,currencyId:master.currencies['currency.valis'],amount:500000,
      cumulativeAmount:500000,reservedAmount:0,signature:0}]);
    const created=ok(await send('familia/create',{name:'GveEarned',description:'Deferred completion fixture',godId:20000001,
      style:21000001,subStyle:0,activeTime:22000001,subActiveTime:0,requireApproval:false})),charge=created.operations[0];
    ok(await save({UserCurrency:app.store.read('UserCurrency').data.map(row=>({...row,amount:row.amount-100000}))},charge));
    for(const [route,id] of unaffiliatedFamilyReplies)
      assert.equal((await request(port,id,{gveId:original.gveId},String(id),route)).status,503,
        'A cached belongsFamilia:false cannot replace the actual saved membership');
    assert.deepEqual(ok(await read(rankingAction)),{code:0,ranking:[]},'Untouched real Familia has no invented peers');
    assert.equal((await send(rankingAction,{gveId:original.gveId,targetUserId:seed.userId})).status,400);
    for(const route of familyActions) {
      assert.deepEqual(ok(await read(route)),emptyFamily(route),'Untouched rankings cannot invent scored members or rivals');
      for(const body of [null,{gveId:original.gveId,targetUserId:seed.userId},{gveId:0},{gveId:0x7fffffff}])
        assert.equal((await send(route,body)).status,400);
    }
    await missionResponse(0,0);
    const template=structuredClone(seed.data.UserAdventureStage[0]),leader=seed.data.UserPC.find(row=>row.joiningState===1 && row.ownerType===1),
      stages=app.store.read('UserAdventureStage').data.filter(row=>row.adventureStageId!==original.adventureStageId);
    put('UserAdventureStage',[...stages,{...template,userId:seed.userId,adventureStageId:original.adventureStageId,state:1,
      cumulativeClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0,currentScore:0,highScore:0,tasks:[]}]);
    const value={adventureStageId:original.adventureStageId,token:'gve-first',adventureStageTaskIds:[],adventureGainedItems:[],
      friendshipStates:[],adventureRecord:{},isEnemyAnnihilated:true,secretMissionCompleted:false,gveStageId:Number(stageKey),
      userGvEScore:{totalDamage:100,maxDamage:10,actionCount:1,defeat:true,turnCount:1},
      leaderPc:{pcId:leader.pcId,jobRank:leader.currentJobIndex ?? 0,heroSublimateLevel:leader.heroSublimateLevel ?? 0,
        isUnlockedHeroSublimate:Boolean(leader.isUnlockedHeroSublimate)}};
    const selectedInfo=structuredClone(app.store.read('UserInfo').data),selectedParties=structuredClone(app.store.read('UserParty').data),
      selectedParty=selectedParties.find(row=>row.id===selectedInfo[0].activeGvEPartyId);
    assert.equal(selectedParty.slots.find(slot=>slot.slotNumber===1).pcId,leader.pcId);
    assert.notEqual(selectedInfo[0].activeGvEPartyId,selectedInfo[0].activeGuildEventPartyId);
    put('UserInfo',selectedInfo.map(row=>({...row,activeGvEPartyId:0})));await reject(value);put('UserInfo',selectedInfo);
    // Different +5f8 Guild Event/ordinary selections cannot redirect the
    // +4b8 GVE result consumer. This is a synthetic field-binding check only.
    put('UserParty',selectedParties.map(row=>row.id===selectedInfo[0].activeGuildEventPartyId ?
      {...row,slots:row.slots.map(slot=>({...slot,pcId:0,assistingPcId:0}))} : row));
    const clear=()=>app.store.read('UserAdventureStage').data.map(row=>row.adventureStageId===value.adventureStageId ?
      {...row,state:4,cumulativeClearCount:row.cumulativeClearCount+1,dailyClearCount:row.dailyClearCount+1,
        firstCompleteDateTime:row.firstCompleteDateTime || now,lastCompleteDateTime:now} : row);
    const entryAdventure=structuredClone(app.store.read('UserAdventureState').data),entryStamina=structuredClone(
      app.store.read('UserGuildEventStaminas').data),dailySP=event.dailySP ?? event.slot9;
    entryAdventure[0]={...entryAdventure[0],stageId:original.adventureStageId,
      userGvEScore:{gveStageId:Number(stageKey),totalDamage:0,turnCount:1}};
    const entryStaminaAfter=[{...entryStamina[0],lastResetAt:now,
      staminas:[{guildEventStageId:original.adventureStageId,sp:Math.max(0,dailySP-1)}]}];
    ok(await save({UserAdventureState:entryAdventure,UserGuildEventStaminas:entryStaminaAfter},null,'AdventureEnter'));
    const entryReceipt=app.store.db.prepare('SELECT * FROM gve_attempt_entry ORDER BY id DESC LIMIT 1').get();
    assert.equal(entryReceipt.mode,20);assert.equal(entryReceipt.stage_id,original.adventureStageId);
    assert.equal(entryReceipt.gve_stage_id,Number(stageKey));assert.equal(entryReceipt.completion_operation_id,null);
    const secondStamina=[{...entryStaminaAfter[0],staminas:entryStaminaAfter[0].staminas.map(row=>
      row.guildEventStageId===original.adventureStageId ? {...row,sp:Math.max(0,row.sp-1)} : row)}];
    ok(await save({UserAdventureState:entryAdventure,UserGuildEventStaminas:secondStamina},null,'AdventureEnter'));
    const replacement=app.store.db.prepare('SELECT * FROM gve_attempt_entry ORDER BY id DESC LIMIT 1').get(),
      abandoned=app.store.db.prepare('SELECT * FROM gve_attempt_entry WHERE id=?').get(entryReceipt.id);
    assert.equal(abandoned.superseded_by_entry_id,replacement.id);assert.equal(abandoned.abandoned_at,now);
    assert.equal(replacement.superseded_by_entry_id,null);assert.equal(replacement.completion_operation_id,null);
    const retiredAdventure=structuredClone(entryAdventure);
    retiredAdventure[0]={...retiredAdventure[0],stageId:0,userGvEScore:{gveStageId:0,totalDamage:0,turnCount:1}};
    ok(await save({UserAdventureState:retiredAdventure},null,'AdventureRetire'));
    assert.equal(app.store.db.prepare('SELECT retired_at FROM gve_attempt_entry WHERE id=?').get(replacement.id).retired_at,now);
    const thirdStamina=[{...secondStamina[0],staminas:secondStamina[0].staminas.map(row=>
      row.guildEventStageId===original.adventureStageId ? {...row,sp:Math.max(0,row.sp-1)} : row)}];
    ok(await save({UserAdventureState:entryAdventure,UserGuildEventStaminas:thirdStamina},null,'AdventureEnter'));
    const activeEntry=app.store.db.prepare('SELECT * FROM gve_attempt_entry ORDER BY id DESC LIMIT 1').get();
    assert.equal(activeEntry.retired_at,null);assert.equal(activeEntry.completion_operation_id,null);
    const admittedAt=now,zeroBody={...value,token:'gve-zero',isEnemyAnnihilated:false,
      userGvEScore:{totalDamage:0,maxDamage:0,actionCount:0,defeat:false,turnCount:0}};now=event.window7;
    const empty=ok(await send(action,zeroBody)).operation;
    now=admittedAt;
    assert.equal(empty.parameters.userGvERecord.scoreInt64,0);assert.equal(empty.parameters.userGvERecord.dailyHighScore,0);
    assert.equal(app.store.db.prepare('SELECT completion_operation_id FROM gve_attempt_entry WHERE id=?')
      .get(activeEntry.id).completion_operation_id,empty.id);
    const emptyCompletion=app.store.db.prepare('SELECT * FROM gve_completion WHERE operation_id=?').get(empty.id);
    assert.equal(emptyCompletion.created_at,admittedAt);assert.equal(emptyCompletion.attempt_entry_id,activeEntry.id);
    app.store.db.prepare('UPDATE gve_completion SET attempt_entry_id=NULL WHERE operation_id=?').run(empty.id);
    assert.equal((await send(action,zeroBody)).status,503,'A pending result cannot lose its consumed entry pointer');
    app.store.db.prepare('UPDATE gve_completion SET attempt_entry_id=? WHERE operation_id=?').run(activeEntry.id,empty.id);
    await close();await open();
    assert.equal(app.store.db.prepare('SELECT attempt_entry_id FROM gve_completion WHERE operation_id=?').get(empty.id).attempt_entry_id,
      activeEntry.id,'Restart preserves the bidirectional GVE attempt/result link');
    assert.deepEqual(ok(await send(action,zeroBody)).operation,empty);
    assert.equal((await read('gve/ranking/character/get')).status,503,'A zero result is not an acknowledged empty history yet');
    ok(await save({UserAdventureStage:clear(),UserGvERecord:[empty.parameters.userGvERecord]},empty));
    await close();await open();
    assert.deepEqual(ok(await read('gve/ranking/character/get')),{code:0,ranking:{normal:[],assist:[]}},
      'An actual acknowledged zero record must not require an invented best party');
    app.store.db.prepare('UPDATE gve_completion SET attempt_entry_id=NULL WHERE operation_id=?').run(empty.id);
    assert.equal((await read('gve/summary/get')).status,503,'Settled history cannot lose its consumed entry pointer');
    app.store.db.prepare('UPDATE gve_completion SET attempt_entry_id=? WHERE operation_id=?').run(activeEntry.id,empty.id);
    assert.deepEqual(ok(await read('gve/summary/get')),{code:0,summary:{familiaScore:0,userRank:0},ranking:[]});
    for(const route of familyActions)assert.deepEqual(ok(await read(route)),emptyFamily(route));
    await missionResponse(0,0);
    const before=native(),wallet=app.store.hardCurrency(),first=ok(await send(action,value)),op=first.operation;
    assert.equal(op.type,23100);assert.deepEqual(Object.keys(op.parameters).sort(),['gainedItems','isEnemyAnnihilated','score','userGvERecord']);
    assert.deepEqual(native(),before,'No native score/clear/party precredit');assert.equal(app.store.hardCurrency(),wallet);
    assert.deepEqual(ok(await send(action,value)).operation,op);await reject({...value,userGvEScore:{...value.userGvEScore,totalDamage:101}},400);
    const selectionJson=app.store.db.prepare('SELECT selection_json FROM gve_party_selection WHERE operation_id=?').get(op.id).selection_json,
      capturedSelection=JSON.parse(selectionJson);
    assert.equal(capturedSelection.partyId,selectedInfo[0].activeGvEPartyId);
    assert.equal(capturedSelection.slots.find(slot=>slot.slotNumber===1).pcId,leader.pcId);
    put('UserInfo',selectedInfo.map(row=>({...row,activeGvEPartyId:0})));
    assert.deepEqual(ok(await send(action,value)).operation,op,'An exact retry uses its original capture, not today\'s selection');
    const beforeEnd=now;now=event.window7;
    assert.deepEqual(ok(await send(action,value)).operation,op,'The original pending result remains deliverable at the exclusive end');
    now=beforeEnd;
    put('UserInfo',selectedInfo);
    app.store.db.prepare('DELETE FROM gve_party_selection WHERE operation_id=?').run(op.id);await reject(value);
    app.store.db.prepare('INSERT INTO gve_party_selection(operation_id,selection_json) VALUES(?,?)').run(op.id,selectionJson);
    assert.equal((await save({},op)).status,400,'ACK requires both actual saves');
    const snapshot={...structuredClone(seed.data.UserPvBHighScoreParty[0]),gveId:original.gveId,familiaPc:{skillIds:[]}},
      detail=()=>send('gve/player_info/get',{gveId:original.gveId,targetUserId:seed.userId});
    // Imported source fixture is NOT native stat/copy/order proof. Only an
    // actual put while the qualifying result is queued creates this capture.
    const beforeParty=native();
    app.store.db.exec("CREATE TRIGGER fail_gve_party BEFORE INSERT ON gve_party_capture BEGIN SELECT RAISE(ABORT,'deferred snapshot rollback'); END");
    assert.equal((await save({UserGvEHighScoreParty:[snapshot]})).status,503);
    assert.deepEqual(native(),beforeParty);assert.equal(app.store.operations()[0].id,op.id);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM gve_party_capture').get().n,0);
    app.store.db.exec('DROP TRIGGER fail_gve_party');
    ok(await save({UserGvEHighScoreParty:[snapshot]}));
    assert.deepEqual(JSON.parse(app.store.db.prepare('SELECT party_json FROM gve_party_capture WHERE operation_id=?').get(op.id).party_json),snapshot);
    assert.equal(app.store.db.prepare('SELECT operation_id FROM gve_party_floor WHERE gve_id=?').get(original.gveId).operation_id,op.id);
    assert.ok(JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(op.id).observed).includes('party'));
    const beforePartyRecovery=native(),partyRecovery=app.store.stageColdRecovery(op);
    assert.equal(Object.hasOwn(app.store.operations()[0].parameters,'offlineGvePartyApplied'),false,
      'The signed source queue cannot contain a server recovery control');
    assert.equal(partyRecovery.parameters.offlineGvePartyApplied,1);
    assert.deepEqual(app.store.stageColdRecovery(op,partyRecovery),partyRecovery);
    assert.throws(()=>app.store.stageColdRecovery(op,{...partyRecovery,parameters:{...partyRecovery.parameters,offlineGvePartyApplied:0}}),
      error=>error.status===503);
    assert.deepEqual(native(),beforePartyRecovery,'Qualifying party recovery derives only a wire control');
    assert.deepEqual(ok(await send(action,value)).operation,partyRecovery,'Exact hot retry skips only the already-saved party copy');
    assert.equal((await send('user_data/pull',{tables:['UserGvEHighScoreParty','UserGvERecord','UserAdventureStage']})).status,200);
    assert.deepEqual(ok(await send('user_data/confirm')).operations,[partyRecovery]);
    await close();await open();assert.equal((await send('user/login')).status,200);
    assert.equal((await detail()).status,503,'A saved snapshot cannot publish an unacknowledged result');
    ok(await save({UserGvERecord:[op.parameters.userGvERecord]}));
    assert.equal(app.store.stageColdRecovery(op).parameters.offlineGvePartyApplied,1,
      'The party-first control remains after the exact record import');
    assert.equal((await read('guild_event/score/user/daily/get')).status,503);
    for(const route of ['gve/summary/get',rankingAction,...familyActions])assert.equal((await read(route)).status,503,'Pending result cannot publish a ranking');
    assert.equal((await save({},op)).status,400);await close();await open();
    ok(await save({UserAdventureStage:clear()},op));assert.equal(app.store.operations().length,0);
    assert.equal(ok(await read('guild_event/score/user/daily/get')).score,op.parameters.userGvERecord.dailyHighScore);
    const log=ok(await send('guild_event/status/log',{gveId:original.gveId,count:10})).logs;
    assert.equal(log.length,2);assert.deepEqual(log[0].leaderPc,value.leaderPc);assert.equal(log[0].finalScore,op.parameters.score.finalScore);
    assert.equal(log[0].isHighScore,true);
    const rank=operation=>[{rank:1,score:operation.parameters.score.finalScore,
      user:{id:seed.userId,pcId:value.leaderPc.pcId,name:log[0].userName},familia:{name:'GveEarned'}}];
    const familyResponse=(route,operation)=>{
      const score=operation.parameters.userGvERecord.eventHighScore,member=amount=>({userId:seed.userId,
        userName:log[0].userName,rank:1,score:amount,leaderPc:{pcId:value.leaderPc.pcId,jobRank:value.leaderPc.jobRank}});
      return route.endsWith('/familia/get') ? {code:0,
        member_daily_ranking:[member(operation.parameters.userGvERecord.dailyHighScore)],member_total_ranking:[member(score)],
        familia_score_rank:{rank:1,score}} : {code:0,belongsFamilia:true,
          ranking:[{rank:1,score,familia:{id:1,name:'GveEarned',godId:20000001}}]};
    };
    const untouchedNative=native(),firstSummaryResponse=await read('gve/summary/get'),firstSummarySequence=sequence;
    assert.deepEqual(ok(firstSummaryResponse),{code:0,summary:{familiaScore:op.parameters.score.finalScore,userRank:1},ranking:rank(op)});
    assert.deepEqual(ok(await read(rankingAction)),{code:0,ranking:rank(op)});const firstRankingSequence=sequence;
    const firstFamilyReplies=[];
    for(const route of familyActions) {
      const response=await read(route);assert.deepEqual(ok(response),familyResponse(route,op));
      firstFamilyReplies.push([route,sequence,response.body]);
    }
    assert.ok(op.parameters.userGvERecord.eventHighScore<Math.min(...missionRows.map(row=>row.requiredParam)),
      'Progress fixture must not cross an automatic reward threshold');
    const firstMission=await missionResponse(op.parameters.userGvERecord.eventHighScore,
      app.store.db.prepare('SELECT created_at FROM gve_completion WHERE operation_id=?').get(op.id).created_at);
    assert.deepEqual(native(),untouchedNative,'Ranking reads do not precredit native party/record');
    const savedSettings=JSON.parse(app.store.db.prepare('SELECT settings FROM local_familia WHERE id=1').get().settings),
      otherGod=master.familiaGodIds.find(id=>id!==savedSettings.godId);
    assert.ok(otherGod,'Original alternate Familia art must exist for the deferred cache case');
    for(const edited of [{...savedSettings,godId:otherGod},{...savedSettings,name:'GveRenamed'}]) {
      ok(await send('familia/manage/change/info',{familiaId:1,...edited}));
      for(const [route,id,body] of firstFamilyReplies) {
        const replay=await request(port,id,{gveId:original.gveId},String(id),route);
        if(route.endsWith('/familia/get'))assert.deepEqual(replay.body,body,'Member-only projection is unchanged by Familia name/art');
        else {
          assert.equal(replay.status,503,'Old Familia name/god art must not overwrite the current board');
          const expected=familyResponse(route,op);expected.ranking[0].familia.name=edited.name;
          expected.ranking[0].familia.godId=edited.godId;assert.deepEqual(ok(await read(route)),expected);
        }
      }
      ok(await send('familia/manage/change/info',{familiaId:1,...savedSettings}));
    }
    assert.deepEqual(native(),untouchedNative,'Family ranking/settings views cannot rewrite the native earned score/party');
    await otherEmpty(true);
    // Source fixtures only: an imported native clear, orphaned server receipt,
    // zero record, party, or opaque pending result cannot become "untouched".
    const savedStages=structuredClone(app.store.read('UserAdventureStage').data),savedRecords=structuredClone(app.store.read('UserGvERecord').data),
      savedParties=structuredClone(app.store.read('UserGvEHighScoreParty').data),otherZero={...empty.parameters.userGvERecord,gveId:otherOriginal.gveId};
    put('UserAdventureStage',[...savedStages,{...template,userId:seed.userId,adventureStageId:otherOriginal.adventureStageId,state:4,
      cumulativeClearCount:1,firstCompleteDateTime:now,lastCompleteDateTime:now,currentScore:0,highScore:0,tasks:[]}]);
    await otherUnavailable();put('UserAdventureStage',savedStages);
    app.store.db.prepare('INSERT INTO stage_completion(stage_id,token,body_hash,operation_id) VALUES(?,?,?,?)')
      .run(otherOriginal.adventureStageId,'unproven-other-event',hash({}),9999999);
    await otherUnavailable();app.store.db.prepare('DELETE FROM stage_completion WHERE stage_id=? AND token=?')
      .run(otherOriginal.adventureStageId,'unproven-other-event');
    put('UserGvERecord',[...savedRecords,otherZero]);await otherUnavailable();put('UserGvERecord',savedRecords);
    put('UserGvEHighScoreParty',[...savedParties,{...structuredClone(snapshot),gveId:otherOriginal.gveId}]);
    await otherUnavailable();put('UserGvEHighScoreParty',savedParties);
    for(const id of [otherOriginal.gveId,0x7fffffff]) {
      const opaque=app.store.issueOperation(23100,{userGvERecord:{...otherZero,gveId:id}});
      await otherUnavailable();app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(opaque.id);
    }
    const genericOther=app.store.issueOperation(5000,{UserAdventureStage:[{adventureStageId:otherOriginal.adventureStageId}]});
    await otherUnavailable();app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(genericOther.id);
    const genericUnrelated=app.store.issueOperation(5000,{UserAdventureStage:[{adventureStageId:template.adventureStageId}]});
    await otherEmpty();app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(genericUnrelated.id);
    await otherEmpty();
    assert.deepEqual(ok(await detail()).gveParty,snapshot);
    const changedStats=structuredClone(snapshot);changedStats.slots.find(slot=>slot.slotNumber===1).pc.strength++;
    const protectedNative=native();assert.equal((await save({UserGvEHighScoreParty:[changedStats]})).status,400);
    assert.deepEqual(native(),protectedNative,'An unchanged identity list cannot authorize a full-stat rewrite');
    const mismatched=structuredClone(snapshot);mismatched.slots.find(slot=>slot.slotNumber===1).pc=null;
    put('UserGvEHighScoreParty',[mismatched]);
    const retained=native();assert.equal((await detail()).status,503);assert.equal((await read('gve/ranking/character/get')).status,503);
    assert.deepEqual(native(),retained,'A mismatched full native party stays retained, not silently rebuilt');
    put('UserGvEHighScoreParty',[snapshot]);
    const higher={...value,token:'gve-second',userGvEScore:{...value.userGvEScore,totalDamage:200}},second=ok(await send(action,higher)).operation;
    await otherEmpty();
    ok(await save({UserAdventureStage:clear()}));assert.equal((await save({},second)).status,400);
    for(const route of ['gve/summary/get',rankingAction,...familyActions])assert.equal((await read(route)).status,503);
    await close();await open();ok(await save({UserGvERecord:[second.parameters.userGvERecord]},second));
    assert.equal((await send('familia/achievement/get',{targetEventId:original.gveId})).status,503,
      'A score without its exact native best-party copy cannot publish mission progress');
    for(const [route,id] of [['gve/summary/get',firstSummarySequence],[rankingAction,firstRankingSequence]])
      assert.equal((await request(port,id,{gveId:original.gveId},String(id),route)).status,503,'Cached old high score cannot overwrite the earned board');
    for(const [route,id] of firstFamilyReplies)
      assert.equal((await request(port,id,{gveId:original.gveId},String(id),route)).status,503,'All Familia ranking caches reject an old high score');
    const secondSummaryResponse=await read('gve/summary/get'),secondSummarySequence=sequence;
    assert.deepEqual(ok(secondSummaryResponse).ranking,rank(second));assert.deepEqual(ok(await read(rankingAction)).ranking,rank(second));
    const secondFamilyReplies=[];
    for(const route of familyActions) {
      const response=await read(route);assert.deepEqual(ok(response),familyResponse(route,second));
      secondFamilyReplies.push([route,sequence,response.body]);
    }
    assert.equal((await detail()).status,503,'ACK cannot invent a best party before its native copy is saved');
    assert.equal(app.store.db.prepare('SELECT 1 FROM gve_party_capture WHERE operation_id=?').get(second.id),undefined);
    await reject({...value,token:'gve-before-late-copy'});
    await close();await open();
    const beforeLate=native(),lateNow=now,lateObservation=app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(second.id).observed;
    now=event.window7+1; // An issued historical copy remains eligible after the admission window closes.
    app.store.db.exec("CREATE TRIGGER fail_gve_late_party BEFORE INSERT ON gve_party_capture BEGIN SELECT RAISE(ABORT,'deferred late-copy rollback'); END");
    assert.equal((await save({UserGvEHighScoreParty:[changedStats]})).status,503);assert.deepEqual(native(),beforeLate);
    assert.equal(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(second.id).observed,lateObservation);
    assert.equal(app.store.operations().length,0,'A late copy cannot create or redeliver an additive clear');
    app.store.db.exec('DROP TRIGGER fail_gve_late_party');
    ok(await save({UserGvEHighScoreParty:[changedStats]}));now=lateNow;
    assert.ok(second.parameters.userGvERecord.eventHighScore<Math.min(...missionRows.map(row=>row.requiredParam)),
      'Higher progress fixture must remain below the unimplemented reward threshold');
    await missionResponse(second.parameters.userGvERecord.eventHighScore,
      app.store.db.prepare('SELECT created_at FROM gve_completion WHERE operation_id=?').get(second.id).created_at);
    assert.equal((await request(port,firstMission.sequence,{targetEventId:original.gveId},String(firstMission.sequence),
      'familia/achievement/get')).status,503,'Cached Familia mission progress cannot overwrite a newer settled high score');
    assert.deepEqual(ok(await detail()).gveParty,changedStats);
    assert.equal(app.store.db.prepare('SELECT operation_id FROM gve_party_floor WHERE gve_id=?').get(original.gveId).operation_id,second.id);
    assert.ok(JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(second.id).observed).includes('party'));
    assert.equal(app.store.operations().length,0);
    const settled=native(),queue=app.store.operations();
    assert.equal((await save({UserGvERecord:[]})).status,400);assert.deepEqual(native(),settled);assert.deepEqual(app.store.operations(),queue);
    const lower={...value,token:'gve-third',userGvEScore:{...value.userGvEScore,totalDamage:50}},third=ok(await send(action,lower)).operation;
    const lowerParty=structuredClone(changedStats);lowerParty.slots.find(slot=>slot.slotNumber===1).pc.strength++;
    const beforeLowerParty=native();assert.equal((await save({UserGvEHighScoreParty:[lowerParty]})).status,400);
    assert.deepEqual(native(),beforeLowerParty,'A lower result cannot replace the actual saved best party');
    assert.equal(third.parameters.userGvERecord.scoreInt64,third.parameters.score.finalScore);
    assert.equal(third.parameters.userGvERecord.score,Math.min(third.parameters.score.finalScore,0x7fffffff));
    assert.equal(third.parameters.userGvERecord.eventHighScore,second.parameters.userGvERecord.eventHighScore);
    assert.equal(third.parameters.userGvERecord.dailyHighScore,second.parameters.userGvERecord.dailyHighScore);
    assert.equal(third.parameters.userGvERecord.gveHighScoreStageId,second.parameters.userGvERecord.gveHighScoreStageId);
    assert.ok(third.parameters.userGvERecord.scoreInt64<third.parameters.userGvERecord.dailyHighScore,
      '246f6bc/14514a4 must NOT qualify a lower run for native best-party replacement');
    // Reproduce the former retained-best response in a disposable pending
    // fixture. Shared delivery/ACK cannot silently rewrite or redeliver it.
    const originalParameters=app.store.db.prepare('SELECT parameters FROM operation_queue WHERE id=?').get(third.id).parameters,
      originalDelivery=app.store.db.prepare('SELECT operation_json FROM stage_delivery WHERE operation_id=?').get(third.id).operation_json,
      originalTarget=app.store.db.prepare('SELECT target_record_json FROM gve_completion WHERE operation_id=?').get(third.id).target_record_json,
      legacy=structuredClone(app.store.operations().find(row=>row.id===third.id));
    legacy.parameters.userGvERecord.scoreInt64=second.parameters.userGvERecord.scoreInt64;
    legacy.parameters.userGvERecord.score=second.parameters.userGvERecord.score;
    app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(legacy.parameters),third.id);
    app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run(JSON.stringify(legacy),third.id);
    app.store.db.prepare('UPDATE gve_completion SET target_record_json=? WHERE operation_id=?')
      .run(JSON.stringify(legacy.parameters.userGvERecord),third.id);
    await reject(lower);
    app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(originalParameters,third.id);
    app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run(originalDelivery,third.id);
    app.store.db.prepare('UPDATE gve_completion SET target_record_json=? WHERE operation_id=?').run(originalTarget,third.id);
    ok(await save({UserGvERecord:[third.parameters.userGvERecord]}));
    const beforeThirdRecovery=native();assert.deepEqual(app.store.stageColdRecovery(third),third);
    assert.deepEqual(native(),beforeThirdRecovery);assert.deepEqual(ok(await send(action,lower)).operation,third);
    assert.equal((await send('user_data/pull',{tables:['UserGvERecord','UserAdventureStage']})).status,200);
    assert.deepEqual(ok(await send('user_data/confirm')).operations,[third]);
    await close();await open();assert.equal((await send('user/login')).status,200);
    assert.equal((await save({},third)).status,400,'The current lower score must also clear before ACK');
    ok(await save({UserAdventureStage:clear()},third));
    assert.equal(ok(await send('guild_event/status/log',{gveId:original.gveId,count:10})).logs[0].isHighScore,false);
    assert.deepEqual(ok(await read(rankingAction)).ranking,rank(second),'A lower repeat cannot replace the actual best battle');
    assert.deepEqual((await request(port,secondSummarySequence,{gveId:original.gveId},String(secondSummarySequence),'gve/summary/get')).body,
      secondSummaryResponse.body,'Unchanged best score keeps its original cached projection');
    for(const [route,id,body] of secondFamilyReplies) {
      assert.deepEqual(ok(await read(route)),familyResponse(route,second));
      assert.deepEqual((await request(port,id,{gveId:original.gveId},String(id),route)).body,body,
        'Lower current-run scores do not replace daily/total/local-Familia best projections');
    }
    now++;
    const clearFirstValue={...value,token:'gve-clear-first',userGvEScore:{...value.userGvEScore,totalDamage:25}},
      clearFirst=ok(await send(action,clearFirstValue)).operation,sourceQueue=structuredClone(app.store.operations());
    assert.ok(clearFirst.parameters.userGvERecord.scoreInt64<clearFirst.parameters.userGvERecord.dailyHighScore);
    ok(await save({UserAdventureStage:clear()}));
    const afterClearFirst=native(),clearRecovery=app.store.stageColdRecovery(clearFirst);
    assert.equal(clearRecovery.parameters.offlineStageClearCountsApplied,1);
    assert.equal(clearRecovery.parameters.offlineStageLastDateApplied,1);
    assert.equal(Object.hasOwn(clearRecovery.parameters,'offlineGvePartyApplied'),false);
    assert.deepEqual(app.store.operations(),sourceQueue,'Clear recovery cannot rewrite the signed source queue');
    assert.deepEqual(app.store.stageColdRecovery(clearFirst,clearRecovery),clearRecovery);
    assert.throws(()=>app.store.stageColdRecovery(clearFirst,{...clearRecovery,parameters:{
      ...clearRecovery.parameters,offlineStageClearCountsApplied:2}}),error=>error.status===503);
    assert.deepEqual(native(),afterClearFirst,'Clear-first recovery derives only duplicate-clear controls');
    assert.deepEqual(ok(await send(action,clearFirstValue)).operation,clearRecovery);
    assert.deepEqual(ok(await send('user_data/confirm')).operations,[clearRecovery]);
    await close();await open();assert.equal((await send('user/login')).status,200);
    assert.equal((await save({},clearFirst)).status,400,'A clear-first result still requires its exact GVE record');
    ok(await save({UserGvERecord:[clearFirst.parameters.userGvERecord]},clearFirst));
    assert.equal(app.store.operations().length,0);
    assert.deepEqual(ok(await read(rankingAction)).ranking,rank(second),'A lower clear-first run cannot replace the actual best battle');
    now++;
    const cumulativeFirstValue={...value,token:'gve-cumulative-first',userGvEScore:{...value.userGvEScore,totalDamage:15}},
      cumulativeFirst=ok(await send(action,cumulativeFirstValue)).operation,cumulativeSource=structuredClone(app.store.operations()),
      cumulativeOnly=()=>app.store.read('UserAdventureStage').data.map(row=>row.adventureStageId===value.adventureStageId ?
        {...row,cumulativeClearCount:row.cumulativeClearCount+1} : row),
      dailyAfterCumulative=()=>app.store.read('UserAdventureStage').data.map(row=>row.adventureStageId===value.adventureStageId ?
        {...row,dailyClearCount:row.dailyClearCount+1} : row),
      dateAfterCumulative=()=>app.store.read('UserAdventureStage').data.map(row=>row.adventureStageId===value.adventureStageId ?
        {...row,lastCompleteDateTime:now} : row);
    ok(await save({UserAdventureStage:cumulativeOnly()}));
    const afterCumulative=native(),cumulativeRecovery=app.store.stageColdRecovery(cumulativeFirst);
    assert.equal(cumulativeRecovery.parameters.offlineStageClearCountsApplied,2);
    assert.equal(Object.hasOwn(cumulativeRecovery.parameters,'offlineStageLastDateApplied'),false);
    assert.equal(Object.hasOwn(cumulativeRecovery.parameters,'offlineGvePartyApplied'),false);
    assert.deepEqual(app.store.operations(),cumulativeSource,'A cumulative checkpoint cannot rewrite the signed GVE queue');
    assert.throws(()=>app.store.stageColdRecovery(cumulativeFirst,{...cumulativeRecovery,parameters:{
      ...cumulativeRecovery.parameters,offlineStageClearCountsApplied:1}}),error=>error.status===503);
    assert.deepEqual(native(),afterCumulative,'Cumulative-only recovery derives only its counter control');
    assert.deepEqual(ok(await send(action,cumulativeFirstValue)).operation,cumulativeRecovery);
    assert.equal((await send('user_data/pull',{tables:['UserAdventureStage','UserGvERecord']})).status,200);
    assert.deepEqual(ok(await send('user_data/confirm')).operations,[cumulativeRecovery]);
    await close();await open();assert.equal((await send('user/login')).status,200);
    assert.equal((await save({},cumulativeFirst)).status,400,'A cumulative prefix is not a result ACK');
    ok(await save({UserAdventureStage:dailyAfterCumulative()}));
    const countsRecovery=app.store.stageColdRecovery(cumulativeFirst);
    assert.equal(countsRecovery.parameters.offlineStageClearCountsApplied,1);
    assert.equal(Object.hasOwn(countsRecovery.parameters,'offlineStageLastDateApplied'),false);
    assert.throws(()=>app.store.stageColdRecovery(cumulativeFirst,cumulativeRecovery),error=>error.status===503,
      'A stale cumulative-only delivery cannot replay after the daily counter saves');
    ok(await save({UserAdventureStage:dateAfterCumulative(),UserGvERecord:[cumulativeFirst.parameters.userGvERecord]},cumulativeFirst));
    assert.equal(app.store.operations().length,0);
    assert.deepEqual(ok(await read(rankingAction)).ranking,rank(second),'A lower cumulative-first run cannot replace the actual best battle');
    const best=app.store.db.prepare('SELECT leader_json FROM gve_completion WHERE operation_id=?').get(second.id),originalLeader=JSON.parse(best.leader_json);
    app.store.db.prepare('UPDATE gve_completion SET leader_json=? WHERE operation_id=?')
      .run(JSON.stringify({...originalLeader,pcId:0x7fffffff}),second.id);
    for(const route of ['gve/summary/get',rankingAction,...familyActions])assert.equal((await read(route)).status,503,'Unknown historical art identity retains the save');
    app.store.db.prepare('UPDATE gve_completion SET leader_json=? WHERE operation_id=?').run(best.leader_json,second.id);
    app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(second.id);
    for(const route of ['gve/summary/get',rankingAction,...familyActions])assert.equal((await read(route)).status,503,'Missing actual best ACK cannot be replaced with today\'s party');
    app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(second.id);
    await reject({...value,token:'gve-skip',skipCount:1});
    const pendingCount=app.store.db.prepare('SELECT COUNT(*) n FROM gve_completion').get().n;
    app.store.db.exec("CREATE TRIGGER fail_gve_reply BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'deferred rollback'); END");
    const beforeRankingFailure=native(),rankingQueue=app.store.operations(),replyCount=app.store.db.prepare('SELECT COUNT(*) n FROM reply_cache').get().n;
    for(const route of familyActions)assert.equal((await read(route)).status,503);
    assert.deepEqual(native(),beforeRankingFailure);assert.deepEqual(app.store.operations(),rankingQueue);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM reply_cache').get().n,replyCount,'Failed ranking replies roll back the cached request');
    await reject({...value,token:'gve-rollback'});assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM gve_completion').get().n,pendingCount);
    app.store.db.exec('DROP TRIGGER fail_gve_reply');await close();await open();
    assert.equal(ok(await read('guild_event/score/user/daily/get')).score,second.parameters.userGvERecord.dailyHighScore);
    assert.deepEqual(ok(await read(rankingAction)).ranking,rank(second));
    for(const route of familyActions)assert.deepEqual(ok(await read(route)),familyResponse(route,second),'Restart preserves acknowledged ranking history');
    now++;
    const recordFirstValue={...value,token:'gve-record-first-high',
      userGvEScore:{...value.userGvEScore,totalDamage:300}},
      recordFirst=ok(await send(action,recordFirstValue)).operation,recordFirstQueue=structuredClone(app.store.operations());
    assert.equal(recordFirst.parameters.userGvERecord.scoreInt64,recordFirst.parameters.userGvERecord.dailyHighScore);
    ok(await save({UserGvERecord:[recordFirst.parameters.userGvERecord]}));
    const afterRecordFirst=native(),recordFirstRecovery=app.store.stageColdRecovery(recordFirst);
    assert.deepEqual(recordFirstRecovery,recordFirst,'Record-first recovery reuses the absolute import and original party copy');
    assert.equal(Object.hasOwn(recordFirstRecovery.parameters,'offlineGvePartyApplied'),false);
    assert.equal(Object.hasOwn(recordFirstRecovery.parameters,'offlineStageClearCountsApplied'),false);
    assert.deepEqual(app.store.operations(),recordFirstQueue,'Record-first recovery cannot rewrite the signed GVE queue');
    assert.deepEqual(native(),afterRecordFirst,'Record-first recovery derives no native state or wire control');
    const recordFirstInfo=structuredClone(app.store.read('UserInfo').data);
    put('UserInfo',recordFirstInfo.map(row=>({...row,activeGvEPartyId:0})));
    assert.throws(()=>app.store.stageColdRecovery(recordFirst),error=>error.status===503,
      'A changed current selection cannot receive the pending qualifying party copy');
    put('UserInfo',recordFirstInfo);
    assert.deepEqual(ok(await send(action,recordFirstValue)).operation,recordFirstRecovery);
    assert.equal((await send('user_data/pull',{tables:['UserGvERecord','UserGvEHighScoreParty','UserAdventureStage']})).status,200);
    assert.deepEqual(ok(await send('user_data/confirm')).operations,[recordFirstRecovery]);
    await close();await open();assert.equal((await send('user/login')).status,200);
    assert.deepEqual(app.store.stageColdRecovery(recordFirst),recordFirstRecovery);
    ok(await save({UserAdventureStage:clear(),UserGvEHighScoreParty:[changedStats]},recordFirst));
    assert.deepEqual(ok(await read(rankingAction)).ranking,rank(recordFirst));
    assert.deepEqual(ok(await detail()).gveParty,changedStats);
    assert.equal(app.store.db.prepare('SELECT operation_id FROM gve_party_floor WHERE gve_id=?').get(original.gveId).operation_id,
      recordFirst.id);
    now++;
    const qualifyingClearValue={...value,token:'gve-qualifying-clear-first',
      userGvEScore:{...value.userGvEScore,totalDamage:400}},
      qualifyingClear=ok(await send(action,qualifyingClearValue)).operation,
      qualifyingClearQueue=structuredClone(app.store.operations());
    ok(await save({UserAdventureStage:clear()}));
    const afterQualifyingClear=native(),qualifyingClearRecovery=app.store.stageColdRecovery(qualifyingClear);
    assert.equal(qualifyingClearRecovery.parameters.offlineStageClearCountsApplied,1);
    assert.equal(qualifyingClearRecovery.parameters.offlineStageLastDateApplied,1);
    assert.equal(Object.hasOwn(qualifyingClearRecovery.parameters,'offlineGvePartyApplied'),false);
    assert.deepEqual(app.store.operations(),qualifyingClearQueue,'Qualifying clear recovery cannot rewrite the signed GVE queue');
    assert.deepEqual(native(),afterQualifyingClear,'Qualifying clear recovery derives only duplicate-clear controls');
    const qualifyingClearInfo=structuredClone(app.store.read('UserInfo').data);
    put('UserInfo',qualifyingClearInfo.map(row=>({...row,activeGvEPartyId:0})));
    assert.throws(()=>app.store.stageColdRecovery(qualifyingClear),error=>error.status===503,
      'A changed selection cannot receive a party copy after its qualifying clear saved');
    put('UserInfo',qualifyingClearInfo);
    assert.deepEqual(ok(await send(action,qualifyingClearValue)).operation,qualifyingClearRecovery);
    assert.deepEqual(ok(await send('user_data/confirm')).operations,[qualifyingClearRecovery]);
    await close();await open();assert.equal((await send('user/login')).status,200);
    assert.deepEqual(app.store.stageColdRecovery(qualifyingClear),qualifyingClearRecovery);
    ok(await save({UserGvERecord:[qualifyingClear.parameters.userGvERecord],
      UserGvEHighScoreParty:[changedStats]},qualifyingClear));
    assert.deepEqual(ok(await read(rankingAction)).ranking,rank(qualifyingClear));
    assert.deepEqual(ok(await detail()).gveParty,changedStats);
    assert.equal(app.store.db.prepare('SELECT operation_id FROM gve_party_floor WHERE gve_id=?').get(original.gveId).operation_id,
      qualifyingClear.id);
    const tie=ok(await send(action,{...qualifyingClearValue,token:'gve-positive-tie'})).operation;
    assert.equal(tie.parameters.userGvERecord.scoreInt64,tie.parameters.userGvERecord.dailyHighScore,
      'The native positive >= comparison accepts a tied best');
    const tieReceipt=app.store.db.prepare('SELECT is_new_high,is_daily_high FROM gve_completion WHERE operation_id=?').get(tie.id);
    assert.deepEqual({...tieReceipt},{is_new_high:1,is_daily_high:1});
    ok(await save({UserAdventureStage:clear(),UserGvERecord:[tie.parameters.userGvERecord],UserGvEHighScoreParty:[changedStats]},tie));
    assert.deepEqual(ok(await read(rankingAction)).ranking,rank(tie));
    for(const route of familyActions)assert.deepEqual(ok(await read(route)),familyResponse(route,tie));
    assert.deepEqual(ok(await detail()).gveParty,changedStats);
    assert.equal(app.store.db.prepare('SELECT operation_id FROM gve_party_floor WHERE gve_id=?').get(original.gveId).operation_id,tie.id);
    // WRITTEN ONLY / NOT RUN: a lower score on the next JST day replaces the
    // native daily-best party while the immutable event-best ranking stays on
    // the earlier tied event high.
    now+=86400;assert.ok(now<event.window7,'Deferred daily-reset fixture must remain inside the original event window');
    const dailyParty=structuredClone(changedStats);dailyParty.slots.find(slot=>slot.slotNumber===1).pc.strength++;
    const dailyValue={...value,token:'gve-next-day-lower',userGvEScore:{...value.userGvEScore,totalDamage:50}},
      daily=ok(await send(action,dailyValue)).operation,dailyRecord=daily.parameters.userGvERecord;
    assert.ok(daily.parameters.score.finalScore>0 && daily.parameters.score.finalScore<tie.parameters.score.finalScore);
    assert.equal(dailyRecord.eventHighScore,tie.parameters.userGvERecord.eventHighScore);
    assert.equal(dailyRecord.dailyHighScore,daily.parameters.score.finalScore);
    assert.equal(dailyRecord.lastResetScoreAt,now);assert.equal(dailyRecord.gveHighScoreStageId,Number(stageKey));
    assert.deepEqual({...app.store.db.prepare('SELECT is_new_high,is_daily_high FROM gve_completion WHERE operation_id=?').get(daily.id)},
      {is_new_high:0,is_daily_high:1});
    ok(await save({UserAdventureStage:clear(),UserGvERecord:[dailyRecord],UserGvEHighScoreParty:[dailyParty]},daily));
    assert.equal(ok(await read('guild_event/score/user/daily/get')).score,daily.parameters.score.finalScore);
    assert.deepEqual(ok(await read(rankingAction)).ranking,rank(tie));
    assert.deepEqual(ok(await detail()).gveParty,dailyParty);
    for(const route of familyActions)assert.deepEqual(ok(await read(route)),familyResponse(route,daily));
    assert.equal(app.store.db.prepare('SELECT operation_id FROM gve_party_floor WHERE gve_id=?').get(original.gveId).operation_id,daily.id);
    now=event.window7;await reject({...value,token:'gve-end-exclusive'},400);
    now=event.window7+1;await reject({...value,token:'gve-expired'},400);
    // Two real source protocol receipts/native puts/ACKs in distinct original
    // events must coexist. This is NOT native event-clock/UI/copy acceptance.
    now=otherEvent.window6+60;
    put('UserAdventureStage',[...app.store.read('UserAdventureStage').data.filter(row=>row.adventureStageId!==otherOriginal.adventureStageId),
      {...template,userId:seed.userId,adventureStageId:otherOriginal.adventureStageId,state:1,cumulativeClearCount:0,
        firstCompleteDateTime:0,lastCompleteDateTime:0,currentScore:0,highScore:0,tasks:[]}]);
    const otherValue={...value,adventureStageId:otherOriginal.adventureStageId,gveStageId:Number(otherStageKey),token:'gve-other-event',
      userGvEScore:{...value.userGvEScore,totalDamage:20000,maxDamage:10000}},beforeOtherWallet=app.store.hardCurrency(),
      otherOperation=ok(await send(action,otherValue)).operation;
    assert.ok(otherOperation.parameters.score.finalScore>0);assert.equal(otherOperation.type,23100);
    assert.deepEqual(ok(await detail()).gveParty,changedStats,'An unrelated pending event cannot hide the actual settled historical party');
    for(const route of familyActions)assert.deepEqual(ok(await read(route)),familyResponse(route,tie));
    const otherSnapshot={...structuredClone(changedStats),gveId:otherOriginal.gveId};
    ok(await save({UserGvEHighScoreParty:[...app.store.read('UserGvEHighScoreParty').data,otherSnapshot]}));
    const otherLastBeforeFirst=app.store.read('UserAdventureStage').data.map(row=>row.adventureStageId===otherOriginal.adventureStageId ?
      {...row,state:4,cumulativeClearCount:1,dailyClearCount:1,firstCompleteDateTime:0,lastCompleteDateTime:now} : row);
    ok(await save({UserAdventureStage:otherLastBeforeFirst}));
    const otherDateRecovery=app.store.stageColdRecovery(otherOperation);
    assert.equal(otherDateRecovery.parameters.offlineStageClearCountsApplied,1);
    assert.equal(otherDateRecovery.parameters.offlineStageLastDateApplied,1);
    assert.equal(otherDateRecovery.parameters.offlineGvePartyApplied,1);
    assert.equal((await save({},otherOperation)).status,400,'LAST-before-FIRST is not a complete result ACK');
    assert.deepEqual(ok(await send(action,otherValue)).operation,otherDateRecovery);
    await close();await open();assert.equal((await send('user/login')).status,200);
    const otherClear=app.store.read('UserAdventureStage').data.map(row=>row.adventureStageId===otherOriginal.adventureStageId ?
      {...row,firstCompleteDateTime:now} : row);
    ok(await save({UserAdventureStage:otherClear,UserGvERecord:[...app.store.read('UserGvERecord').data,
      otherOperation.parameters.userGvERecord]},otherOperation));
    for(const [route,id] of otherReplies)
      assert.equal((await request(port,id,otherBody(route),String(id),route)).status,503,'An earned event invalidates only its old empty projection');
    for(const route of familyActions)assert.deepEqual(ok(await send(route,otherBody(route))),familyResponse(route,otherOperation));
    assert.deepEqual(ok(await send('gve/player_info/get',{gveId:otherOriginal.gveId,targetUserId:seed.userId})).gveParty,otherSnapshot);
    assert.deepEqual(ok(await detail()).gveParty,changedStats);assert.equal(app.store.hardCurrency(),beforeOtherWallet);
    await close();await open();
    for(const route of familyActions) {
      assert.deepEqual(ok(await read(route)),familyResponse(route,tie));
      assert.deepEqual(ok(await send(route,otherBody(route))),familyResponse(route,otherOperation));
    }
    assert.deepEqual(ok(await detail()).gveParty,changedStats);
    assert.deepEqual(ok(await send('gve/player_info/get',{gveId:otherOriginal.gveId,targetUserId:seed.userId})).gveParty,otherSnapshot);
    // WRITTEN ONLY / NOT RUN: the old weekday route uses the shared real23100 result reader, never fatal23000.
    assert.deepEqual(Object.entries(master.gveEvents).filter(([,row])=>row.type===19).sort((a,b)=>Number(a[0])-Number(b[0]))
      .map(([id,row])=>[Number(id)-57000000000,row.weekday,row.key,row.name,row.slot7,row.slot8,row.slot9]),
      ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day,index)=>
        [index+1,index+1,`gve_information_${index+1}`,`Familia Mission (${day})`,5,23,5]));
    assert.ok(Object.values(master.gveEvents).filter(row=>row.type===20).every(row=>row.weekday===0));
    const [legacyStageId,legacyStage]=Object.entries(master.gveStages).find(([,row])=>master.gveEvents[row.gveId].type===19),
      legacyDay=master.gveEvents[legacyStage.gveId].weekday,legacyRoute='gve/stage/complete';
    now=1571400000;
    while(((Math.floor((now+32400)/86400)+3)%7)+1!==legacyDay)now+=86400;
    const legacyAt=now,legacyBody={...value,adventureStageId:legacyStage.adventureStageId,
      gveStageId:Number(legacyStageId),token:'gve-legacy-weekday'},legacyStages=app.store.read('UserAdventureStage').data;
    put('UserAdventureStage',[...legacyStages,{...template,userId:seed.userId,adventureStageId:legacyStage.adventureStageId,
      state:1,cumulativeClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0,currentScore:0,highScore:0,tasks:[]}]);
    assert.equal((await send(action,legacyBody)).status,400,'Modern endpoint cannot issue a legacy result');
    now+=86400;assert.equal((await send(legacyRoute,legacyBody)).status,400,'Wrong JST weekday cannot issue a new result');
    now=legacyAt;
    const legacyAdventure=structuredClone(app.store.read('UserAdventureState').data),legacyUsers=structuredClone(app.store.read('UserInfo').data);
    legacyAdventure[0]={...legacyAdventure[0],stageId:legacyStage.adventureStageId,
      userGvEScore:{gveStageId:Number(legacyStageId),totalDamage:0,turnCount:1}};
    legacyUsers[0]={...legacyUsers[0],playerStatus:{...legacyUsers[0].playerStatus,gveSP:0,gveSPLastResetAt:legacyAt}};
    ok(await save({UserAdventureState:legacyAdventure,UserInfo:legacyUsers},null,'AdventureEnter'));
    const legacyEntry=app.store.db.prepare('SELECT * FROM gve_attempt_entry ORDER BY id DESC LIMIT 1').get();
    assert.equal(legacyEntry.mode,19);assert.equal(JSON.parse(legacyEntry.before_json).gveSP,0);
    assert.equal(JSON.parse(legacyEntry.after_json).gveSP,0);
    const legacyBefore=native(),legacyWallet=app.store.hardCurrency();now+=86400;
    const legacyIssued=ok(await send(legacyRoute,legacyBody)),legacyOp=legacyIssued.operation;
    assert.equal(legacyOp.type,23100);assert.deepEqual(native(),legacyBefore);assert.equal(app.store.hardCurrency(),legacyWallet);
    assert.equal(app.store.db.prepare('SELECT created_at FROM gve_completion WHERE operation_id=?').get(legacyOp.id).created_at,legacyAt);
    await close();await open();
    assert.deepEqual(ok(await send(legacyRoute,legacyBody)),legacyIssued,'An issued result remains deliverable after its weekday');
    now=legacyAt;
    const legacyClear=app.store.read('UserAdventureStage').data.map(row=>row.adventureStageId===legacyStage.adventureStageId ?
      {...row,state:4,cumulativeClearCount:1,firstCompleteDateTime:now,lastCompleteDateTime:now} : row),
      legacyParty={...structuredClone(otherSnapshot),gveId:legacyStage.gveId};
    ok(await save({UserAdventureStage:legacyClear,UserGvERecord:[...app.store.read('UserGvERecord').data,
      legacyOp.parameters.userGvERecord],UserGvEHighScoreParty:[...app.store.read('UserGvEHighScoreParty').data,legacyParty]},legacyOp));
    assert.equal(app.store.operations().some(row=>row.id===legacyOp.id),false);
    assert.equal(app.store.read('UserGvERecord').data.find(row=>row.gveId===legacyStage.gveId).scoreInt64,
      legacyOp.parameters.score.finalScore);
    // WRITTEN ONLY / NOT RUN: one acknowledged local GVE best now publishes
    // source-bound original type201 rewards through one persistent operation6000.
    now=Math.max(event.window6+120,...missionRows.map(row=>row.startAt+1));
    assert.ok(now<event.window7 && missionRows.every(row=>now>=row.startAt && (!row.expireAt || now<=row.expireAt)),
      'Deferred reward fixtures require one shared original GVE/mission window');
    const orderedMissions=[...missionRows].sort((a,b)=>a.requiredParam-b.requiredParam || a.id-b.id),
      missionView=(row,score,updatedAt)=>({achievementId:row.id,currentParam:Math.min(score,0x7fffffff),updatedAt}),
      saveGveSource=async(operation,party)=>{
        const records=[...app.store.read('UserGvERecord').data.filter(row=>row.gveId!==original.gveId),operation.parameters.userGvERecord],
          parties=app.store.read('UserGvEHighScoreParty').data.map(row=>row.gveId===original.gveId?party:row);
        assert.equal(parties.filter(row=>row.gveId===original.gveId).length,1,'A reward source requires one actual native best party');
        ok(await save({UserAdventureStage:clear(),UserGvERecord:records,UserGvEHighScoreParty:parties},operation));
      };
    const firstRewardValue={...value,token:'gve-familia-first-reward',userGvEScore:{...value.userGvEScore,
        totalDamage:8000000,maxDamage:8000000,actionCount:1,turnCount:1}},
      firstRewardSource=ok(await send(action,firstRewardValue)).operation;
    assert.ok(firstRewardSource.parameters.score.finalScore>=orderedMissions[0].requiredParam &&
      firstRewardSource.parameters.score.finalScore<orderedMissions[1].requiredParam,
    'The first reward fixture must cross exactly one original threshold');
    await saveGveSource(firstRewardSource,changedStats);
    const firstCompletedAt=app.store.db.prepare('SELECT created_at FROM gve_completion WHERE operation_id=?')
      .get(firstRewardSource.id).created_at,
      firstRewardRows=missionRows.filter(row=>row.requiredParam<=firstRewardSource.parameters.score.finalScore),
      firstRewardIds=new Set(firstRewardRows.map(row=>row.id)),firstEnvelope=rewardEnvelope(firstRewardRows),
      firstRewardNative=native(),firstRewardWallet=app.store.hardCurrency(),missionBody={targetEventId:original.gveId},
      firstRewardReply=await send('familia/achievement/get',missionBody),firstRewardIdentity=sequence,
      firstRewardResult=ok(firstRewardReply),firstRewardOperation=firstRewardResult.operations[0];
    assert.equal(firstRewardRows.length,1);assert.equal(firstRewardRows[0].rewardType,3);
    assert.equal(firstRewardOperation.type,6000);assert.deepEqual(firstRewardOperation.parameters,firstEnvelope);
    assert.deepEqual(firstRewardResult.achievements.obtained,firstRewardRows.map(row=>
      missionView(row,firstRewardSource.parameters.score.finalScore,firstCompletedAt)));
    assert.deepEqual(firstRewardResult.achievements.not_obtained,missionRows.filter(row=>!firstRewardIds.has(row.id)).map(row=>
      missionView(row,firstRewardSource.parameters.score.finalScore,firstCompletedAt)));
    assert.equal(app.store.hardCurrency(),firstRewardWallet+firstEnvelope.issueAmount);
    assert.deepEqual(native(),firstRewardNative,'Familia mission publication cannot precredit native profiles');
    assert.deepEqual(app.store.familiaMissionRewardReceipt(firstRewardOperation).source.ids,[firstRewardRows[0].id]);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_mission_reward WHERE operation_id=?').get(firstRewardOperation.id).n,1);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_mission_claim WHERE operation_id=?').get(firstRewardOperation.id).n,1);
    assert.deepEqual((await request(port,firstRewardIdentity,missionBody,String(firstRewardIdentity),'familia/achievement/get')).body,
      firstRewardReply.body,'Cached first publication replays its exact signed reward');
    assert.deepEqual(ok(await send('familia/achievement/get',missionBody)).operations,[firstRewardOperation],
      'A fresh mission view replays the same pending reward without reminting it');
    ok(await save({},firstRewardOperation));
    const firstSettled=ok(await send('familia/achievement/get',missionBody));
    assert.equal(Object.hasOwn(firstSettled,'operations'),false);assert.deepEqual(firstSettled.achievements.obtained,
      firstRewardRows.map(row=>missionView(row,firstRewardSource.parameters.score.finalScore,firstCompletedAt)));

    now++;
    const allRewardValue={...value,token:'gve-familia-multi-reward',userGvEScore:{...value.userGvEScore,
        totalDamage:0x7fffffff,maxDamage:0x7fffffff,actionCount:1,turnCount:1}},
      allRewardSource=ok(await send(action,allRewardValue)).operation;
    assert.ok(allRewardSource.parameters.score.finalScore>0x7fffffff,'Full reward eligibility must use int64, not the display clamp');
    await saveGveSource(allRewardSource,changedStats);
    const allCompletedAt=app.store.db.prepare('SELECT created_at FROM gve_completion WHERE operation_id=?').get(allRewardSource.id).created_at,
      reachedRows=missionRows.filter(row=>row.requiredParam<=allRewardSource.parameters.score.finalScore),
      newRewardRows=reachedRows.filter(row=>!firstRewardIds.has(row.id)),newRewardIds=new Set(newRewardRows.map(row=>row.id)),
      remainingRows=missionRows.filter(row=>!firstRewardIds.has(row.id) && !newRewardIds.has(row.id)),
      probeRow=newRewardRows.find(row=>row.rewardType!==3 && master.items[row.rewardKey] && master.itemProfiles[master.items[row.rewardKey]]),
      probeItemId=master.items[probeRow?.rewardKey],probeProfile=master.itemProfiles[probeItemId];
    assert.ok(newRewardRows.length>1 && probeProfile && newRewardRows.every(row=>row.rewardType!==1) &&
      remainingRows.some(row=>row.rewardType===1),
      'One real offline member can reach the original item thresholds but cannot fabricate the later group Valis goals');
    const beforeMissingProfile={native:native(),wallet:app.store.hardCurrency(),queue:structuredClone(app.store.operations()),
      rewards:app.store.db.prepare('SELECT COUNT(*) n FROM familia_mission_reward').get().n,
      claims:app.store.db.prepare('SELECT COUNT(*) n FROM familia_mission_claim').get().n};
    delete master.itemProfiles[probeItemId];
    try { assert.equal((await send('familia/achievement/get',missionBody)).status,503); }
    finally { master.itemProfiles[probeItemId]=probeProfile; }
    assert.deepEqual(native(),beforeMissingProfile.native);assert.equal(app.store.hardCurrency(),beforeMissingProfile.wallet);
    assert.deepEqual(app.store.operations(),beforeMissingProfile.queue);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_mission_reward').get().n,beforeMissingProfile.rewards);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_mission_claim').get().n,beforeMissingProfile.claims);
    app.store.db.exec("CREATE TRIGGER fail_familia_mission_reward BEFORE INSERT ON familia_mission_reward BEGIN SELECT RAISE(ABORT,'deferred reward rollback'); END");
    assert.equal((await send('familia/achievement/get',missionBody)).status,503);
    assert.equal(app.store.hardCurrency(),beforeMissingProfile.wallet);assert.deepEqual(app.store.operations(),beforeMissingProfile.queue);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_mission_reward').get().n,beforeMissingProfile.rewards);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_mission_claim').get().n,beforeMissingProfile.claims);
    app.store.db.exec('DROP TRIGGER fail_familia_mission_reward');
    const allRewardNative=native(),allRewardWallet=app.store.hardCurrency(),allEnvelope=rewardEnvelope(newRewardRows),
      allRewardReply=await send('familia/achievement/get',missionBody),allRewardIdentity=sequence,
      allRewardResult=ok(allRewardReply),allRewardOperation=allRewardResult.operations[0];
    assert.equal(allRewardOperation.type,6000);assert.deepEqual(allRewardOperation.parameters,allEnvelope);
    assert.deepEqual(allRewardResult.achievements.obtained,reachedRows.map(row=>
      missionView(row,allRewardSource.parameters.score.finalScore,allCompletedAt)));
    assert.deepEqual(allRewardResult.achievements.not_obtained,remainingRows.map(row=>
      missionView(row,allRewardSource.parameters.score.finalScore,allCompletedAt)));
    assert.ok([...allRewardResult.achievements.obtained,...allRewardResult.achievements.not_obtained]
      .every(row=>row.currentParam===0x7fffffff),'Native Familia mission progress is display-clamped only after int64 eligibility');
    assert.equal(app.store.hardCurrency(),allRewardWallet+allEnvelope.issueAmount);assert.deepEqual(native(),allRewardNative);
    const allReceipt=app.store.familiaMissionRewardReceipt(allRewardOperation);
    assert.deepEqual(allReceipt.source.ids,[...newRewardIds].sort((a,b)=>a-b));
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_mission_claim WHERE operation_id=?').get(allRewardOperation.id).n,
      newRewardRows.length);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM achievement_item_claim WHERE operation_id=?').get(allRewardOperation.id).n,
      allEnvelope.receivedItems.length);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM achievement_item_claim WHERE operation_id=? AND valis_state IS NOT NULL')
      .get(allRewardOperation.id).n,0,'Unreached group Valis goals must not mint a native currency acquisition');
    assert.deepEqual((await request(port,allRewardIdentity,missionBody,String(allRewardIdentity),'familia/achievement/get')).body,
      allRewardReply.body,'Cached aggregate publication remains byte-identical');
    assert.deepEqual(ok(await send('familia/achievement/get',missionBody)).operations,[allRewardOperation]);
    await close();await open();
    assert.deepEqual(ok(await send('familia/achievement/get',missionBody)).operations,[allRewardOperation],
      'Restart preserves the source-bound aggregate reward');
    const inventoryTables={};
    for(const reward of allEnvelope.receivedItems) {
      const profile=master.itemProfiles[reward.itemId],target=app.store.db.prepare(
        'SELECT * FROM achievement_item_claim WHERE operation_id=? AND item_id=?').get(allRewardOperation.id,reward.itemId),
        rows=inventoryTables[profile.table]??structuredClone(app.store.read(profile.table).data),
        index=rows.findIndex(row=>row[profile.idField]===reward.itemId),before=index<0?null:rows[index];
      let acquired;
      if(target.gacha_state!==null) acquired={...(before??itemRow(reward.itemId,0,0)),bookEntryState:3,
        cumulativeAmount:target.cumulative_amount,signature:allRewardOperation.signature,
        dateList:[...(before?.dateList??[]),...Array.from({length:reward.amount},()=>({aquiredAt:now}))]};
      else if(target.stock_state!==null) {
        const capture=JSON.parse(target.stock_state);acquired={...before,cumulativeAmount:target.cumulative_amount,
          amount:capture.amount,signature:allRewardOperation.signature};
      } else acquired=before?{...before,cumulativeAmount:target.cumulative_amount,amount:before.amount+reward.amount}:
        itemRow(reward.itemId,target.cumulative_amount,reward.amount);
      if(index<0) rows.push(acquired);else rows[index]=acquired;inventoryTables[profile.table]=rows;
    }
    ok(await save(inventoryTables));assert.deepEqual(app.store.operations(),[allRewardOperation]);
    const recoveredReward={...allRewardOperation,parameters:{...allRewardOperation.parameters,receivedItems:[]}};
    assert.deepEqual(app.store.achievementColdRecovery(allRewardOperation),recoveredReward);
    assert.deepEqual(ok(await send('user_data/confirm')).operations,[recoveredReward]);
    ok(await save({},allRewardOperation));assert.deepEqual(app.store.operations(),[]);
    const completedMissions=ok(await send('familia/achievement/get',missionBody));
    assert.equal(Object.hasOwn(completedMissions,'operations'),false);
    assert.deepEqual(completedMissions.achievements.obtained,reachedRows.map(row=>
      missionView(row,allRewardSource.parameters.score.finalScore,allCompletedAt)));
    assert.deepEqual(completedMissions.achievements.not_obtained,remainingRows.map(row=>
      missionView(row,allRewardSource.parameters.score.finalScore,allCompletedAt)));
    await close();await open();assert.deepEqual(app.store.operations(),[]);
    assert.deepEqual(app.store.familiaMissionRewardReceipt(allRewardOperation,true).source.ids,[...newRewardIds].sort((a,b)=>a-b));
    const retainedHash=app.store.db.prepare('SELECT source_hash FROM familia_mission_reward WHERE operation_id=?').get(allRewardOperation.id).source_hash,
      completedNative=native();
    app.store.db.prepare('UPDATE familia_mission_reward SET source_hash=? WHERE operation_id=?').run('0'.repeat(32),allRewardOperation.id);
    assert.equal((await send('familia/achievement/get',missionBody)).status,503);
    assert.deepEqual(native(),completedNative);assert.deepEqual(app.store.operations(),[]);
    assert.equal(app.store.db.prepare('SELECT source_hash FROM familia_mission_reward WHERE operation_id=?').get(allRewardOperation.id).source_hash,
      '0'.repeat(32),'Corrupt reward provenance is retained for reconciliation, not erased');
    app.store.db.prepare('UPDATE familia_mission_reward SET source_hash=? WHERE operation_id=?').run(retainedHash,allRewardOperation.id);
    console.log('Deferred modern/legacy GVE SQLite/HTTP checks passed; NOT publisher scoring or native acceptance');
  } finally {
    await close();const resolved=fs.realpathSync(directory),temp=fs.realpathSync(os.tmpdir());
    if(path.dirname(resolved)!==temp || !path.basename(resolved).startsWith('danmemore-gve-completion-'))throw new Error('Unsafe fixture cleanup path');
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
