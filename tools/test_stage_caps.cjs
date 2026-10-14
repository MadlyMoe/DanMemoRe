'use strict';

// WRITTEN ONLY. Disposable synthetic saves, not original loot rates,
// natural stage eligibility, native signing/order or playable acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {createServer,OFFLINE_UNAVAILABLE_CODE,pcInitialStatInput}=require('./danmemore_server.cjs');
const {request,stageXpFixture,rewardCharacterFixture,rewardCostumeFixture,rewardUnitStoryFixture}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
const max=999999999,valis=master.currencies['currency.valis'],ordinaryId=1010000101101;
const stageTicketIds=[...new Set(Object.values(master.stages).filter(row=>master.itemProfiles[master.items[row.rewardKey]]?.table==='UserGachaTicket')
  .map(row=>master.items[row.rewardKey]))];
const rankItems=Object.entries(master.pveScores).flatMap(([stageId,score])=>Object.entries(score.rewards)
  .filter(([,reward])=>reward.rewardType===0).map(([rank,reward])=>({stageId:Number(stageId),rank,
    itemId:master.items[reward.rewardKey],amount:reward.rewardAmount})));
const tables=['UserStatusBoardItem','UserCpItem','UserExpItem','UserEquipmentMaterial','UserVoteItem','UserStaminaTicket','UserKeyItem',
  'UserEquipmentEnhanceItem','UserEquipmentEvolveItem','UserLockAbilityItem','UserHeroSublimateItem','UserHeroSublimateUnlockItem',
  'UserAdventureTicket','UserMemoriaExpItem','UserAlarmVoiceItem','UserLimitBreakItem','UserGeneralLimitBreakItem','UserCurrency'];
const itemIdFor=table=>table==='UserCurrency'?valis:table==='UserAdventureTicket'?298000001:
  Number(Object.keys(master.itemProfiles).find(id=>master.itemProfiles[id].table===table));
const rowFor=(itemId,cumulativeAmount,amount=7)=>{
  const {table,idField}=master.itemProfiles[itemId];
  return {userId:seed.userId,[idField]:itemId,amount,cumulativeAmount,signature:7,
    ...(table==='UserCurrency'?{}:{bookEntryState:3}),
    ...(['UserCurrency','UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial','UserVoteItem','UserStaminaTicket','UserKeyItem',
      'UserEquipmentEnhanceItem','UserEquipmentEvolveItem','UserLockAbilityItem','UserHeroSublimateItem','UserHeroSublimateUnlockItem',
      'UserMemoriaExpItem','UserAlarmVoiceItem'].includes(table)?{reservedAmount:0}:{}),
    ...(table==='UserKeyItem'?{exploit:false}:{}),...(table==='UserAdventureTicket'?{lastResetAt:0}:{}),
    ...(table==='UserMemoriaExpItem'?{lastAquiredAt:0}:{})};
};

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-stage-caps-'));
  let app,database,port,sequence=0,rejection,now=1790866800,fixtureMaster=master;
  const open=async()=>{
    app=createServer({database,seed,master:fixtureMaster,wallNowSeconds:()=>now,log:line=>{
      const entry=JSON.parse(line);if(entry.event==='rejected') rejection=entry.reason;
    }});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async()=>{if(app){await app.close();app=null;}};
  const fresh=async name=>{await close();database=path.join(directory,`${name}.sqlite`);await open();};
  const send=(action,body)=>{rejection=undefined;return request(port,++sequence,body,String(sequence),action);};
  const parse=reply=>{assert.equal(reply.status,200,rejection ?? reply.body.toString());return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected=async(action,body,status=400,structured=true)=>{
    const before=snapshot(),reply=await send(action,body);
    assert.equal(reply.status,status,rejection ?? reply.body.toString());
    if(status===503 && structured) assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Refusal retains profiles, captures, queue, floors, sequence and exact replies');
  };
  const put=(table,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),table);
  const replaceItem=(itemId,row)=>{
    const profile=master.itemProfiles[itemId];
    put(profile.table,[...app.store.read(profile.table).data.filter(item=>item[profile.idField]!==row[profile.idField]),row]);
  };
  const payload=(putItems={},operations=[],deleteItems={})=>({badges:null,scripts:{},dataTokens:{},
    checksums:{before:{},after:Object.fromEntries([...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])]
      .map(table=>[table,md5(putItems[table] ?? [])]))},
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length?[{signature:0,trigger:'AdventureComplete',putItems,deleteItems}]:[],
    operations:operations.map(operation=>({id:operation.id,verifier:operation.token}))});
  const push=(putItems={},operations=[],deleteItems={})=>send('user_data/push',payload(putItems,operations,deleteItems));
  const stageRow=id=>({...seed.data.UserAdventureStage[0],adventureStageId:id,state:1,cumulativeClearCount:0,dailyClearCount:0,
    currentScore:0,highScore:0,firstCompleteDateTime:0,lastCompleteDateTime:0,firstTryDateTime:0,lastTryDateTime:0,
    token:'',tasks:Object.entries(master.stageTasks).filter(([,task])=>task.stageId===id).map(([taskId])=>({adventureStageTaskId:Number(taskId),state:0}))});
  const battle=(id,token,itemId,amount=5)=>({adventureStageId:id,token,adventureStageTaskIds:[],
    adventureGainedItems:[{itemId,amount}],friendshipStates:[],adventureRecord:{continueCount:0,deathCount:0,turnCount:1},
    isEnemyAnnihilated:true,secretMissionCompleted:false});
  const pveBattle=body=>{
    const ids=Object.keys(master.pcProfiles).map(Number),pc=pcId=>({pcId,level:50,currentJobIndex:4,limitbreakCount:0,usableSkillAmount:3,
      strength:111,intelligence:222,agility:333,vitality:444,luck:555,hp:6000,mp:300,physicalAttackPower:600,magicAttackPower:700,
      defensePower:800,weaponId:0,armorId:0,weaponAbilityIds:[],armorAbilityIds:[],heroSublimateLevel:0,isUnlockedHeroSublimate:false});
    return {...body,isEnemyAnnihilated:false,userPVEScore:{totalDamage:100,maxDamage:100,clearTurn:1,actionCount:1,frontPCs:1,memberPCs:1,deathCount:0},
      userPveParty:{userId:seed.userId,slots:[{slotNumber:0,pc:pc(ids[0]),assistingPc:pc(ids[2])},{slotNumber:1,pc:null,assistingPc:null}]}};
  };
  const cleared=operation=>{
    const before=operation.parameters.UserAdventureStage[0],score=operation.type===16000?operation.parameters.finalScore:before.currentScore,
      saved=app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===before.adventureStageId);
    return {...before,state:4,cumulativeClearCount:before.cumulativeClearCount+Math.max(1,operation.parameters.skipCount),
      firstCompleteDateTime:before.firstCompleteDateTime || now,lastCompleteDateTime:now,currentScore:score,highScore:Math.max(before.highScore,score),
      tasks:before.tasks.map(row=>({...row,state:Math.max(row.state,
        saved?.tasks.find(task=>task.adventureStageTaskId===row.adventureStageTaskId)?.state ?? 0,
        operation.parameters.adventureStageTaskIds.includes(row.adventureStageTaskId)?1:0)}))};
  };
  const allEffects=operation=>{
    const result={UserAdventureStage:[cleared(operation)]};
    for(const target of app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(operation.id)) {
      const before=app.store.read(target.table_name).data.find(row=>row[target.id_field]===target.item_id),
        capture=target.stock_state?JSON.parse(target.stock_state):null;
      if(target.table_name==='UserGachaTicket') {
        const quantity=operation.parameters.gainedItems.find(row=>row.itemId===target.item_id)?.amount,
          duration=master.lotteryTickets[target.item_id];
        (result.UserGachaTicket ??= []).push({... (before ?? {userId:seed.userId,gachaTicketId:target.item_id,bookEntryState:1,dateList:[]}),
          bookEntryState:before?.bookEntryState===1 || !before?3:before.bookEntryState,
          cumulativeAmount:target.cumulative_amount,signature:operation.signature,
          dateList:(before?.dateList??[]).filter(row=>now<row.aquiredAt+duration).concat(Array.from({length:quantity},()=>({aquiredAt:now})))});
        continue;
      }
      (result[target.table_name] ??= []).push({... (before ?? rowFor(target.item_id,0,0)),
        amount:capture?.amount ?? 0,cumulativeAmount:target.cumulative_amount,signature:operation.signature});
    }
    if(operation.type===25000) {
      const claim=app.store.db.prepare('SELECT * FROM element_completion WHERE operation_id=?').get(operation.id);
      result.UserElementEventRecord=[{userId:seed.userId,elementEventStageDifficultyId:claim.difficulty_id,score:claim.target_score}];
    }
    return stageXpFixture(app.store,result,[operation]);
  };
  const recover=async(operation,expected,originalCold)=>{
    const before=snapshot();assert.deepEqual(app.store.stageColdRecovery(operation),expected);
    assert.equal(snapshot(),before,'Deriving a stage replay does not mutate native saves, captures or the queue');
    const old=await request(port,originalCold.identity,undefined,String(originalCold.identity),'user_data/confirm');
    assert.deepEqual(parse(old).operations,[expected],'Cached original envelopes are re-derived from actual saved effects');
    const cold=await send('user_data/confirm'),identity=sequence;
    assert.deepEqual(parse(cold).operations,[expected]);parse(await send('user/login'));
    const pulled=await send('user_data/pull',{tables:['UserGachaTicket','UserCurrency','UserAdventureStage']});
    assert.equal(pulled.status,200,rejection ?? pulled.body.toString());
    await close();await open();
    assert.deepEqual((await request(port,identity,undefined,String(identity),'user_data/confirm')).body,cold.body);
    const bad=JSON.parse(cold.body),item=app.store.db.prepare('SELECT item_id FROM pve_item_claim WHERE operation_id=? ORDER BY item_id LIMIT 1')
      .get(operation.id);
    if(item) bad.operations[0].parameters.gainedItems=[{itemId:item.item_id,amount:0}];
    else bad.operations[0].parameters.UserAdventureStage[0].cumulativeClearCount++;
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(Buffer.from(JSON.stringify(bad)).toString('base64'),`${identity}/${identity}`);
    const poisoned=snapshot(),failed=await request(port,identity,undefined,String(identity),'user_data/confirm');
    assert.equal(failed.status,503,rejection ?? failed.body.toString());assert.equal(snapshot(),poisoned);
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(cold.body.toString('base64'),`${identity}/${identity}`);
    assert.deepEqual(app.store.operations(),[operation],'Recovery retains the whole original operation and real mixed ACK');
    assert.equal(app.store.db.prepare('SELECT operation_json FROM stage_delivery WHERE operation_id=?').get(operation.id).operation_json,JSON.stringify(operation));
  };
  try {
    // WRITTEN ONLY:64 first-clear counter/date contexts, not native callback/save/signature acceptance.
    for(const mode of ['ordinary','scene','pve','element']) for(const initialState of [1,2,3,4])
      for(const closedDaily of [true,false]) for(const savedLastDate of [false,true]) {
      now=mode==='element'?master.elementEventStages[66100000001].startAt:1790866800;
      await fresh(`closed-clear-counts-${mode}-${initialState}-${closedDaily}-${savedLastDate}`);
      const stageId=mode==='ordinary'?ordinaryId:mode==='scene'?1010000101103:mode==='pve'?1120000904103:1260000101101,
        original={...stageRow(stageId),state:initialState},numericId=master.items['status_board_item.special'],datedId=master.items['gacha_ticket.normal'],
        characterId=101000001,characters=app.store.read('UserCharacter').data,
        character=characters.find(row=>row.characterId===characterId);
      assert(character);assert.equal(master.characters[characterId].levels.findLast(([,points])=>points<=5)[0],1);
      put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,heroType:0})));
      put('UserCharacter',characters.map(row=>row.characterId===characterId?{...row,friendship:0}:row));
      put('UserAdventureStage',[original]);replaceItem(numericId,rowFor(numericId,max-1));replaceItem(valis,rowFor(valis,max-1));
      replaceItem(datedId,{userId:seed.userId,gachaTicketId:datedId,cumulativeAmount:100,bookEntryState:3,signature:7,dateList:[]});
      let body={...battle(stageId,`closed-clear-counts-${mode}-${initialState}-${closedDaily}-${savedLastDate}`,numericId,2),
        adventureStageTaskIds:original.tasks.map(row=>row.adventureStageTaskId),
        adventureGainedItems:mode==='scene'?[]:[{itemId:numericId,amount:2},{itemId:datedId,amount:2}],
        friendshipStates:mode==='scene'?[]:[{characterId,friendship:5,userHeroType:0,friendshipLv:1}]};
      if(mode==='pve') body=pveBattle(body);
      if(mode==='element') body={...body,userElementEventScore:{totalDamage:1000,maxDamage:100,actionCount:7,defeat:true,turnCount:2,pcTotalDamage:50},
        adventureRecord:{continueCount:0}};
      const action=`${mode==='pve'?'pve':mode==='element'?'element_event':'adventure'}/stage/complete`,
        operation=parse(await send(action,body)).operation,iris=app.store.hardCurrency(),
        originalCold={response:await send('user_data/confirm'),identity:sequence},
        root=app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===stageId),
        prefix={...root,state:4,cumulativeClearCount:1,dailyClearCount:closedDaily?1:0},
        closedKey=closedDaily?'clearCounts':'clearCumulative',control=closedDaily?1:2,
        expected={...operation,parameters:{...operation.parameters,offlineStageClearCountsApplied:control}};
      assert.deepEqual(parse(originalCold.response).operations,[operation]);
      for(const key of ['clearCounts','clearCumulative',`clearLastDate:${now}`]) {
        app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(JSON.stringify([key]),operation.id);
        await rejected('user_data/confirm',undefined,503);
      }
      app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run('[]',operation.id);
      put('UserAdventureStage',[{...prefix,cumulativeClearCount:0,dailyClearCount:1}]);
      await rejected('user_data/confirm',undefined,503);put('UserAdventureStage',[root]); // Daily-only is not the original cumulative-before-daily prefix.
      for(const [table,event] of [['profile','UPDATE'],['stage_delivery','UPDATE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER clear_counts_save_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'clear counts save rollback'); END`);
        await rejected('user_data/push',payload({UserAdventureStage:[prefix]}),503,false);app.store.db.exec('DROP TRIGGER clear_counts_save_fail');
      }
      assert(!parse(await push({UserAdventureStage:[prefix]})).operations.some(row=>row.id===operation.id));
      const savedReceipt=app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id),
        observed=JSON.parse(savedReceipt.observed);
      assert(observed.includes(closedKey));assert(!observed.includes('clear'));
      assert.equal(observed.includes('clearCounts'),closedDaily);
      assert.equal(observed.includes('clearState'),initialState!==4);
      await recover(operation,expected,originalCold);await rejected(action,body,503);
      assert.equal(app.store.hardCurrency(),iris);await rejected('user_data/push',payload({},[operation]));
      for(const change of [{cumulativeClearCount:0},...(closedDaily?[{dailyClearCount:0}]:[]),{state:1},{firstCompleteDateTime:1}])
        await rejected('user_data/push',payload({UserAdventureStage:[{...prefix,...change}]}));
      for(const change of [{cumulativeClearCount:2},{dailyClearCount:2},{firstCompleteDateTime:1},{lastCompleteDateTime:-1},
        {lastCompleteDateTime:0.5},{lastCompleteDateTime:Number.MAX_SAFE_INTEGER+1},
        {userId:2},{unexpectedField:true}]) {
        put('UserAdventureStage',[{...prefix,...change}]);await rejected('user_data/confirm',undefined,503);put('UserAdventureStage',[prefix]);
      }
      if(!closedDaily) await rejected('user_data/push',payload({UserAdventureStage:[{...prefix,lastCompleteDateTime:now}]}));
      const objectives={...prefix,tasks:prefix.tasks.map(row=>({...row,state:2})),...(mode==='pve'?{
        currentScore:operation.parameters.finalScore,highScore:Math.max(prefix.highScore,operation.parameters.finalScore)}:{})};
      parse(await push({UserAdventureStage:[objectives]}));await recover(operation,expected,originalCold);
      const effects=allEffects(operation),tables=new Set(app.store.db.prepare('SELECT table_name FROM pve_item_claim WHERE operation_id=?').all(operation.id)
        .map(row=>row.table_name)),mixed=Object.fromEntries([...tables].map(name=>[name,effects[name]]));
      if(mode!=='scene') mixed.UserCharacter=[{...app.store.read('UserCharacter').data.find(row=>row.characterId===characterId),friendship:5}];
      if(effects.UserInfo) {mixed.UserInfo=effects.UserInfo;expected.parameters.offlineStageXpApplied=1;}
      parse(await push(mixed));expected.parameters.gainedItems=[];
      if(mode==='pve') expected.parameters.rewardRanks=operation.parameters.rewardRanks.filter(rank=>master.pveScores[stageId].rewards[rank].rewardType===1);
      await recover(operation,expected,originalCold);
      assert.deepEqual(expected.parameters.friendshipStates,operation.parameters.friendshipStates);
      const cold=await send('user_data/confirm'),identity=sequence;assert.deepEqual(parse(cold).operations,[expected]);
      for(const invalidControl of [...(mode==='scene'?[]:[undefined]),0,closedDaily?2:1,3,String(control),null]) {
        const bad=JSON.parse(cold.body);bad.operations[0].parameters.offlineStageClearCountsApplied=invalidControl;
        app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(Buffer.from(JSON.stringify(bad)).toString('base64'),`${identity}/${identity}`);
        const before=snapshot(),reply=await request(port,identity,undefined,String(identity),'user_data/confirm');
        assert.equal(reply.status,503);assert.equal(snapshot(),before);
      }
      app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(cold.body.toString('base64'),`${identity}/${identity}`);
      for(const sourceControl of [1,2]) {
        const injected={...operation,parameters:{...operation.parameters,offlineStageClearCountsApplied:sourceControl}};
        app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(injected.parameters),operation.id);
        app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run(JSON.stringify(injected),operation.id);
        await rejected('user_data/confirm',undefined,503);
      }
      app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(operation.parameters),operation.id);
      app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run(JSON.stringify(operation),operation.id);
      const duplicate=[...JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id).observed),closedKey],
        currentReceipt=app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id);
      app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(JSON.stringify(duplicate),operation.id);
      await rejected('user_data/confirm',undefined,503);
      app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(currentReceipt.observed,operation.id);
      if(!closedDaily) {
        const currentStage=app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===stageId),
          both={...currentStage,dailyClearCount:1};
        assert(!parse(await push({UserAdventureStage:[both]})).operations.some(row=>row.id===operation.id));
        expected.parameters.offlineStageClearCountsApplied=1;
        await recover(operation,expected,originalCold);
        const before=snapshot(),stale=await request(port,identity,undefined,String(identity),'user_data/confirm');
        assert.equal(stale.status,503);assert.equal(snapshot(),before); // Stale derived2 is not the new both-count delivery; the original envelope can rederive1.
        await rejected('user_data/push',payload({UserAdventureStage:[currentStage]}));
        const saved=JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id).observed);
        assert(saved.includes('clearCumulative') && saved.includes('clearCounts'));
      }
      const recordedLastDate=now;
      if(savedLastDate) {
        const currentStage=app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===stageId),
          dated={...currentStage,lastCompleteDateTime:recordedLastDate};
        for(const [table,event] of [['profile','UPDATE'],['stage_delivery','UPDATE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER last_date_save_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'last date save rollback'); END`);
          await rejected('user_data/push',payload({UserAdventureStage:[dated]}),503,false);app.store.db.exec('DROP TRIGGER last_date_save_fail');
        }
        assert(!parse(await push({UserAdventureStage:[dated]})).operations.some(row=>row.id===operation.id));
        expected.parameters.offlineStageLastDateApplied=1;
        now+=60; // Within the same original day: FIRST must use saved LAST, not the next clock read.
        await recover(operation,expected,originalCold);
        assert.equal(app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===stageId).lastCompleteDateTime,recordedLastDate);
        await rejected('user_data/push',payload({},[operation]));
        const dateReceipt=app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id),
          keys=JSON.parse(dateReceipt.observed),dateKey=`clearLastDate:${recordedLastDate}`;
        assert(keys.includes(dateKey));assert(!keys.includes('clear'));
        for(const change of [{lastCompleteDateTime:0},{lastCompleteDateTime:recordedLastDate+1},
          {firstCompleteDateTime:recordedLastDate+1},{dailyClearCount:0}]) {
          await rejected('user_data/push',payload({UserAdventureStage:[{...dated,...change}]}));
          put('UserAdventureStage',[{...dated,...change}]);await rejected('user_data/confirm',undefined,503);put('UserAdventureStage',[dated]);
        }
        for(const corrupt of [[...keys,dateKey],[...keys,`clearLastDate:${recordedLastDate+1}`],
          keys.map(key=>key===dateKey?'clearLastDate:0':key),keys.map(key=>key===dateKey?'clearLastDate:01':key),
          keys.map(key=>key===dateKey?`clearLastDate:${Number.MAX_SAFE_INTEGER+1}`:key)]) {
          app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(JSON.stringify(corrupt),operation.id);
          await rejected('user_data/confirm',undefined,503);
        }
        app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(dateReceipt.observed,operation.id);
        const dateCold=await send('user_data/confirm'),dateIdentity=sequence;
        for(const flag of [undefined,0,2,'1',null]) {
          const bad=JSON.parse(dateCold.body);bad.operations[0].parameters.offlineStageLastDateApplied=flag;
          app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(Buffer.from(JSON.stringify(bad)).toString('base64'),`${dateIdentity}/${dateIdentity}`);
          const before=snapshot(),reply=await request(port,dateIdentity,undefined,String(dateIdentity),'user_data/confirm');
          assert.equal(reply.status,503);assert.equal(snapshot(),before);
        }
        app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(dateCold.body.toString('base64'),`${dateIdentity}/${dateIdentity}`);
        const injected={...operation,parameters:{...operation.parameters,offlineStageLastDateApplied:1}};
        app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(injected.parameters),operation.id);
        app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run(JSON.stringify(injected),operation.id);
        await rejected('user_data/confirm',undefined,503);
        app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(operation.parameters),operation.id);
        app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run(JSON.stringify(operation),operation.id);
        await recover(operation,expected,originalCold);
      }
      const remaining=allEffects(operation);
      for(const table of tables) delete remaining[table]; // Closed additive grants are NOT applied a second time by the derived native callback.
      if(mixed.UserCharacter) remaining.UserCharacter=mixed.UserCharacter;
      remaining.UserAdventureStage=remaining.UserAdventureStage.map(row=>row.adventureStageId===stageId?{...row,dailyClearCount:1,
        ...(savedLastDate?{firstCompleteDateTime:recordedLastDate,lastCompleteDateTime:recordedLastDate}:{})}:row);
      await rejected('user_data/push',payload({},[operation]));parse(await push(remaining));
      await rejected('user_data/confirm',undefined,503); // Real full-save ACK, not another replay, still closes the operation.
      const completed=app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===stageId);
      parse(await push({UserAdventureStage:[{...completed,dailyClearCount:0}]})); // Existing legitimate daily reset policy remains legal before ACK.
      assert(JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id).observed).includes('clearCounts'));
      const ackBody=payload({},[operation]);
      for(const [table,event] of [['stage_state_floor','INSERT'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER clear_counts_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'clear counts ACK rollback'); END`);
        await rejected('user_data/push',ackBody,503,false);app.store.db.exec('DROP TRIGGER clear_counts_ack_fail');
      }
      const ack=await send('user_data/push',ackBody),ackIdentity=sequence;parse(ack);await close();await open();
      assert.deepEqual((await request(port,ackIdentity,ackBody,String(ackIdentity),'user_data/push')).body,ack.body);
      assert.deepEqual(app.store.operations(),[]);assert.equal(app.store.hardCurrency(),iris);
      assert.equal(app.store.db.prepare('SELECT clear_count FROM stage_state_floor WHERE stage_id=?').get(stageId).clear_count,1);
      const saved=app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===stageId);
      await rejected('user_data/push',payload({UserAdventureStage:[{...saved,cumulativeClearCount:0}]}));
      const repeat=parse(await send(action,{...body,token:`${body.token}-repeat`})).operation;
      assert.equal(app.store.hardCurrency(),iris);assert(!Object.hasOwn(repeat.parameters,'offlineStageClearCountsApplied'));
      const repeatEffects=allEffects(repeat);
      repeatEffects.UserAdventureStage=repeatEffects.UserAdventureStage.map(row=>row.adventureStageId===stageId?{...row,dailyClearCount:1}:row);
      if(mixed.UserCharacter) repeatEffects.UserCharacter=mixed.UserCharacter;
      parse(await push(repeatEffects,[repeat]));
      assert.equal(app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===stageId).cumulativeClearCount,2);
    }
    // WRITTEN ONLY: repeat-clear saved counter prefixes and real remaining date/ACK, not native save-order proof.
    for(const bothCounts of [false,true]) {
      now=1790866800+3600;await fresh(`repeat-clear-${bothCounts?'both':'cumulative'}-first`);
      const repeatBaseline={...stageRow(ordinaryId),state:4,cumulativeClearCount:5,dailyClearCount:2,
        firstCompleteDateTime:now-200,lastCompleteDateTime:now-100},repeatBody={
          ...battle(ordinaryId,`repeat-clear-${bothCounts?'both':'cumulative'}-first`,valis),adventureGainedItems:[]};
      put('UserAdventureStage',[repeatBaseline]);
      const repeatOperation=parse(await send('adventure/stage/complete',repeatBody)).operation,
        repeatPrefix={...repeatBaseline,cumulativeClearCount:6,dailyClearCount:bothCounts?3:2};
      assert(!parse(await push({UserAdventureStage:[repeatPrefix]})).operations.some(row=>row.id===repeatOperation.id));
      const repeatObserved=JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?')
        .get(repeatOperation.id).observed);
      assert.equal(repeatObserved.includes('clearCounts'),bothCounts);
      assert.equal(repeatObserved.includes('clearCumulative'),!bothCounts);
      assert(!repeatObserved.includes('clear'));
      assert.equal(app.store.stageColdRecovery(repeatOperation).parameters.offlineStageClearCountsApplied,bothCounts?1:2);
      if(!bothCounts) {
        parse(await push({UserAdventureStage:[{...repeatPrefix,dailyClearCount:3}]}));
        const advanced=JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?')
          .get(repeatOperation.id).observed);
        assert(advanced.includes('clearCumulative') && advanced.includes('clearCounts') && !advanced.includes('clear'));
        assert.equal(app.store.stageColdRecovery(repeatOperation).parameters.offlineStageClearCountsApplied,1);
      }
      const repeatNow=now;now+=86400;
      await rejected('user_data/confirm',undefined,503);
      now=repeatNow;
      const repeatOther=allEffects(repeatOperation);delete repeatOther.UserAdventureStage;
      if(Object.keys(repeatOther).length)parse(await push(repeatOther));
      await rejected('user_data/push',payload({},[repeatOperation]));
      assert.match(rejection,/saved clear/,'An old positive last date cannot ACK the saved counter prefix');
      const repeatFinal={...repeatPrefix,dailyClearCount:3,lastCompleteDateTime:now};
      parse(await push({UserAdventureStage:[repeatFinal]},[repeatOperation]));
      assert.deepEqual(app.store.operations(),[]);
      assert.equal(app.store.db.prepare('SELECT clear_count FROM stage_state_floor WHERE stage_id=?')
        .get(ordinaryId).clear_count,6);
    }

    // WRITTEN ONLY: a first-clear stage saved in one delta must not replay its counters or dates before other rewards.
    now=1790866800;await fresh('first-clear-stage-first');
    {
      const before=stageRow(ordinaryId);
      put('UserAdventureStage',[before]);
      const operation=parse(await send('adventure/stage/complete',
          battle(ordinaryId,'first-clear-stage-first',valis))).operation,
        saved={...before,state:4,cumulativeClearCount:1,dailyClearCount:1,
          firstCompleteDateTime:now,lastCompleteDateTime:now};
      assert(!parse(await push({UserAdventureStage:[saved]})).operations.some(row=>row.id===operation.id));
      const observed=JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?')
        .get(operation.id).observed);
      assert(observed.includes('clear') && observed.includes('clearCounts') &&
        observed.includes(`clearLastDate:${now}`));
      const recovered=app.store.stageColdRecovery(operation);
      assert.equal(recovered.parameters.offlineStageClearCountsApplied,1);
      assert.equal(recovered.parameters.offlineStageLastDateApplied,1);
      assert(recovered.parameters.gainedItems.length>0,'Original unsaved item rewards remain in the callback');
      await rejected('user_data/push',payload({},[operation]));
      await rejected('user_data/push',payload({UserAdventureStage:[{...saved,lastCompleteDateTime:now+1}]}));
      put('UserAdventureStage',[{...saved,dailyClearCount:0}]);
      assert.throws(()=>app.store.stageColdRecovery(operation),/pinned client day/);
      put('UserAdventureStage',[saved]);
      now+=86400;
      parse(await push({UserAdventureStage:[{...saved,dailyClearCount:0}]}));
      const nextDay=parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id);
      assert.equal(nextDay.parameters.offlineStageClearCountsApplied,1);
      assert.equal(nextDay.parameters.offlineStageLastDateApplied,1);
      const remaining=allEffects(operation);
      remaining.UserAdventureStage=remaining.UserAdventureStage.filter(row=>row.adventureStageId!==ordinaryId);
      if(!remaining.UserAdventureStage.length) delete remaining.UserAdventureStage;
      if(Object.keys(remaining).length)parse(await push(remaining));
      parse(await push({},[operation]));
      assert.deepEqual(app.store.operations(),[]);
      assert.equal(app.store.db.prepare('SELECT clear_count FROM stage_state_floor WHERE stage_id=?')
        .get(ordinaryId).clear_count,1);
    }

    // WRITTEN ONLY: a complete repeat stage saved before its other rewards needs both original skip controls.
    now=1790866800+3600;await fresh('repeat-clear-stage-first');
    {
      const before={...stageRow(ordinaryId),state:4,cumulativeClearCount:5,dailyClearCount:2,
        firstCompleteDateTime:now-200,lastCompleteDateTime:now-100};
      put('UserAdventureStage',[before]);
      const operation=parse(await send('adventure/stage/complete',
          battle(ordinaryId,'repeat-clear-stage-first',valis))).operation,
        saved={...before,cumulativeClearCount:6,dailyClearCount:3,lastCompleteDateTime:now};
      assert(!parse(await push({UserAdventureStage:[saved]})).operations.some(row=>row.id===operation.id));
      const observed=JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?')
        .get(operation.id).observed);
      assert(observed.includes('clear') && observed.includes(`clearLastDate:${now}`));
      const recovered=app.store.stageColdRecovery(operation);
      assert.equal(recovered.parameters.offlineStageClearCountsApplied,1);
      assert.equal(recovered.parameters.offlineStageLastDateApplied,1);
      assert(recovered.parameters.gainedItems.length>0,'Unsaved original item rewards remain in the callback');
      await rejected('user_data/push',payload({},[operation]));
      await rejected('user_data/push',payload({UserAdventureStage:[{...saved,lastCompleteDateTime:now+1}]}));
      put('UserAdventureStage',[{...saved,dailyClearCount:0}]);
      assert.throws(()=>app.store.stageColdRecovery(operation),/pinned client day/);
      put('UserAdventureStage',[saved]);
      now+=86400;
      parse(await push({UserAdventureStage:[{...saved,dailyClearCount:0}]}));
      const nextDay=parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id);
      assert.equal(nextDay.parameters.offlineStageClearCountsApplied,1);
      assert.equal(nextDay.parameters.offlineStageLastDateApplied,1);
      const remaining=allEffects(operation);delete remaining.UserAdventureStage;
      if(Object.keys(remaining).length)parse(await push(remaining));
      parse(await push({},[operation]));
      assert.deepEqual(app.store.operations(),[]);
      assert.equal(app.store.db.prepare('SELECT clear_count FROM stage_state_floor WHERE stage_id=?')
        .get(ordinaryId).clear_count,6);
    }

    // WRITTEN ONLY:32 original stage-family/state contexts; synthetic clear-flag prefixes, never native save-order proof.
    for(const mode of ['ordinary','scene','pve','element']) for(const initialState of [1,2,3,4])
      for(const prefixKind of ['unchanged','state-only']) {
        now=mode==='element'?master.elementEventStages[66100000001].startAt:1790866800;
        await fresh(`clear-state-${mode}-${initialState}-${prefixKind}`);
        const stageId=mode==='ordinary'?ordinaryId:mode==='scene'?1010000101103:mode==='pve'?1120000904103:1260000101101,
          original={...stageRow(stageId),state:initialState,...(initialState===4?{
            cumulativeClearCount:5,dailyClearCount:2,firstCompleteDateTime:now-200,lastCompleteDateTime:now-100}: {})},
          numericId=master.items['status_board_item.special'],datedId=master.items['gacha_ticket.normal'];
        if(initialState===4) original.tasks=original.tasks.map((row,index)=>({...row,state:index===0?2:0}));
        const otherStages=app.store.read('UserAdventureStage').data.filter(row=>row.adventureStageId!==stageId),
          replaceStage=rows=>put('UserAdventureStage',[...otherStages,...rows]);
        replaceStage([original]);replaceItem(numericId,rowFor(numericId,max-1));replaceItem(valis,rowFor(valis,max-1));
        replaceItem(datedId,{userId:seed.userId,gachaTicketId:datedId,cumulativeAmount:100,bookEntryState:3,signature:7,dateList:[]});
        let body={...battle(stageId,`clear-state-${mode}-${initialState}-${prefixKind}`,numericId,2),
          adventureStageTaskIds:original.tasks.map(row=>row.adventureStageTaskId),
          adventureGainedItems:[{itemId:numericId,amount:2},{itemId:datedId,amount:2}]};
        if(mode==='pve') body=pveBattle(body);
        if(mode==='element') body={...body,userElementEventScore:{totalDamage:1000,maxDamage:100,actionCount:7,defeat:true,turnCount:2,pcTotalDamage:50},
          adventureRecord:{continueCount:0}};
        const action=`${mode==='pve'?'pve':mode==='element'?'element_event':'adventure'}/stage/complete`,
          issue=await send(action,body),issueIdentity=sequence,operation=parse(issue).operation,iris=app.store.hardCurrency(),
          floorBefore=app.store.db.prepare('SELECT * FROM stage_state_floor WHERE stage_id=?').get(stageId),
          originalCold={response:await send('user_data/confirm'),identity:sequence},
          baseline=app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===stageId);
        assert.deepEqual(parse(originalCold.response).operations,[operation]);
        if(mode==='scene') {
          assert.deepEqual(operation.parameters.friendshipStates,[]);assert.deepEqual(operation.parameters.adventureStageTaskIds,[]);
          assert.equal(app.store.db.prepare('SELECT 1 FROM stage_xp_claim WHERE operation_id=?').get(operation.id),undefined,
            'Exercise the zero-EXP, zero-CP, zero-objective, zero-observation baseline guard');
        }
        await recover(operation,operation,originalCold);
        // Both cold recovery and fresh/cached hot retries must check counters/dates before any saved effect marker exists.
        for(const change of [{cumulativeClearCount:baseline.cumulativeClearCount+1},{dailyClearCount:baseline.dailyClearCount+1},
          {firstCompleteDateTime:baseline.firstCompleteDateTime+1},{lastCompleteDateTime:baseline.lastCompleteDateTime+1},
          {firstTryDateTime:baseline.firstTryDateTime+1},{lastTryDateTime:baseline.lastTryDateTime+1},
          {state:initialState===2?3:2},{userId:2},{token:0},{unexpectedField:true}]) {
          replaceStage([{...baseline,...change}]);
          await rejected('user_data/confirm',undefined,503);await rejected(action,body,503);
          const before=snapshot(),cached=await request(port,issueIdentity,body,String(issueIdentity),action);
          assert.equal(cached.status,503,rejection ?? cached.body.toString());assert.equal(snapshot(),before);
          replaceStage([baseline]);
        }
        for(const rows of [[],[baseline,baseline]]) {
          replaceStage(rows);await rejected('user_data/confirm',undefined,503);await rejected(action,body,503);replaceStage([baseline]);
        }
        const prefix={...baseline,...(prefixKind==='state-only'?{state:4}:{})},
          changed=initialState!==4 && prefixKind==='state-only';
        if(changed) for(const [table,event] of [['profile','UPDATE'],['stage_delivery','UPDATE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER clear_state_save_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'clear state save rollback'); END`);
          await rejected('user_data/push',payload({UserAdventureStage:[prefix]}),503,false);
          app.store.db.exec('DROP TRIGGER clear_state_save_fail');
        }
        const prefixReply=parse(await push({UserAdventureStage:[prefix]}));
        assert.equal(prefixReply.operations.some(row=>row.id===operation.id),!changed,
          'A newly saved clear flag suppresses hot delivery but does not acknowledge the pending operation');
        const observations=JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id).observed);
        assert.equal(observations.includes('clearState'),changed);assert(!observations.includes('clear'));
        if(changed) await rejected('user_data/push',payload({UserAdventureStage:[baseline]}));
        await recover(operation,operation,originalCold);
        assert.equal(app.store.hardCurrency(),iris,'Clear-flag recovery never remints issued Iris');
        assert.deepEqual(app.store.db.prepare('SELECT * FROM stage_state_floor WHERE stage_id=?').get(stageId),floorBefore);
        await rejected('user_data/push',payload({},[operation]));
        const receipt=app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id);
        app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(JSON.stringify([...observations,'clearState']),operation.id);
        // A duplicate, a nonexistent save, or a flag already present before issuance cannot supply a new observation.
        await rejected('user_data/confirm',undefined,503);
        app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(receipt.observed,operation.id);
        const objectives={...prefix,tasks:prefix.tasks.map(row=>({...row,state:2})),...(mode==='pve'?{
          currentScore:operation.parameters.finalScore,highScore:Math.max(prefix.highScore,operation.parameters.finalScore)}:{})};
        parse(await push({UserAdventureStage:[objectives]}));await recover(operation,operation,originalCold);
        const effects=allEffects(operation),expected={...operation,parameters:{...operation.parameters,
          gainedItems:operation.parameters.gainedItems.filter(row=>![numericId,datedId].includes(row.itemId)),
          ...(mode==='pve'?{rewardRanks:operation.parameters.rewardRanks.filter(rank=>
            master.pveScores[stageId].rewards[rank].rewardType!==0 || ![numericId,datedId].includes(master.items[master.pveScores[stageId].rewards[rank].rewardKey]))}: {})}};
        parse(await push({UserStatusBoardItem:effects.UserStatusBoardItem,UserGachaTicket:effects.UserGachaTicket}));
        await recover(operation,expected,originalCold);
        if(effects.UserInfo) {
          parse(await push({UserInfo:effects.UserInfo}));expected.parameters.offlineStageXpApplied=1;
          await recover(operation,expected,originalCold);
        }
        const actual=app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===stageId);
        for(const change of [{cumulativeClearCount:actual.cumulativeClearCount+1},{dailyClearCount:actual.dailyClearCount+1},
          {firstCompleteDateTime:actual.firstCompleteDateTime+1},{lastCompleteDateTime:actual.lastCompleteDateTime+1}]) {
          replaceStage([{...actual,...change}]);await rejected('user_data/confirm',undefined,503);replaceStage([actual]);
        }
        const full=allEffects(operation);
        full.UserAdventureStage=full.UserAdventureStage.map(row=>row.adventureStageId===stageId?
          {...row,dailyClearCount:original.dailyClearCount+1}:row);
        replaceStage([full.UserAdventureStage.find(row=>row.adventureStageId===stageId)]);
        await rejected('user_data/confirm',undefined,503);replaceStage([actual]);
        await rejected('user_data/push',payload({},[operation]));parse(await push(full));
        const ackBody=payload({},[operation]);
        for(const [table,event] of [['stage_state_floor','INSERT'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER clear_state_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'clear state ACK rollback'); END`);
          await rejected('user_data/push',ackBody,503,false);app.store.db.exec('DROP TRIGGER clear_state_ack_fail');
        }
        const ack=await send('user_data/push',ackBody),ackIdentity=sequence;parse(ack);await close();await open();
        assert.deepEqual((await request(port,ackIdentity,ackBody,String(ackIdentity),'user_data/push')).body,ack.body);
        assert.deepEqual(app.store.operations(),[]);assert.equal(app.store.hardCurrency(),iris);
        const saved=app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===stageId),
          floor=app.store.db.prepare('SELECT * FROM stage_state_floor WHERE stage_id=?').get(stageId);
        assert.equal(saved.cumulativeClearCount,original.cumulativeClearCount+1);assert.equal(saved.dailyClearCount,original.dailyClearCount+1);
        assert.equal(floor.clear_count,saved.cumulativeClearCount);assert.equal(saved.firstCompleteDateTime,original.firstCompleteDateTime || now);
        assert(original.tasks.filter(row=>row.state===2).every(row=>saved.tasks.find(task=>task.adventureStageTaskId===row.adventureStageTaskId).state===2));
        await rejected('user_data/push',payload({UserAdventureStage:[{...saved,cumulativeClearCount:original.cumulativeClearCount}]}));
        await rejected('user_data/push',payload({},[],{UserAdventureStage:[{adventureStageId:stageId}]}));
        const repeat=parse(await send(action,{...body,token:`${body.token}-repeat`})).operation;
        assert.equal(app.store.hardCurrency(),iris,'A later clear must not reissue first-clear, objective or rank Iris');
        const repeatEffects=allEffects(repeat);
        repeatEffects.UserAdventureStage=repeatEffects.UserAdventureStage.map(row=>row.adventureStageId===stageId?
          {...row,dailyClearCount:saved.dailyClearCount+1}:row);
        parse(await push(repeatEffects,[repeat]));assert.equal(app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===stageId).cumulativeClearCount,
          original.cumulativeClearCount+2,'A real later result remains a distinct single clear');
      }
    // WRITTEN ONLY:8 native-counter boundary contexts; the setter asserts at1,000,000,000, not at signed-int32 maximum.
    for(const mode of ['ordinary','scene','pve','element']) for(const field of ['cumulativeClearCount','dailyClearCount']) {
      now=mode==='element'?master.elementEventStages[66100000001].startAt:1790866800;
      await fresh(`clear-counter-boundary-${mode}-${field}`);
      const stageId=mode==='ordinary'?ordinaryId:mode==='scene'?1010000101103:mode==='pve'?1120000904103:1260000101101,
        original={...stageRow(stageId),state:4,cumulativeClearCount:5,dailyClearCount:2,
          firstCompleteDateTime:now-200,lastCompleteDateTime:now-100,[field]:max-1},
        itemId=master.items['status_board_item.special'];
      original.tasks=original.tasks.map(row=>({...row,state:2}));
      put('UserAdventureStage',[original]);replaceItem(itemId,rowFor(itemId,max-1));
      let body=battle(stageId,`counter-boundary-${mode}-${field}`,itemId,2);
      if(mode==='pve') body=pveBattle(body);
      if(mode==='element') body={...body,userElementEventScore:{totalDamage:1000,maxDamage:100,actionCount:7,defeat:true,turnCount:2,pcTotalDamage:50},
        adventureRecord:{continueCount:0}};
      const action=`${mode==='pve'?'pve':mode==='element'?'element_event':'adventure'}/stage/complete`,
        operation=parse(await send(action,body)).operation,originalCold={response:await send('user_data/confirm'),identity:sequence};
      assert.deepEqual(parse(originalCold.response).operations,[operation]);await recover(operation,operation,originalCold);
      const effects=allEffects(operation);
      effects.UserAdventureStage=effects.UserAdventureStage.map(row=>row.adventureStageId===stageId?
        {...row,dailyClearCount:original.dailyClearCount+1}:row);
      for(const invalid of [-1,1000000000,0x7fffffff,'2',0.1]) {
        const rows=effects.UserAdventureStage.map(row=>row.adventureStageId===stageId?{...row,[field]:invalid}:row);
        await rejected('user_data/push',payload({UserAdventureStage:rows}));
        await rejected('user_data/push',payload({...effects,UserAdventureStage:rows},[operation]));
      }
      const profile=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserAdventureStage'").get(),
        before=operation.parameters.UserAdventureStage[0],bad={...operation,parameters:{...operation.parameters,
          UserAdventureStage:[{...before,[field]:max}]}};
      put('UserAdventureStage',[{...original,[field]:max}]);
      app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(bad.parameters),operation.id);
      app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run(JSON.stringify(bad),operation.id);
      await rejected('user_data/confirm',undefined,503);
      app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(operation.parameters),operation.id);
      app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run(JSON.stringify(operation),operation.id);
      app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserAdventureStage'").run(profile.data,profile.token);
      parse(await push(effects,[operation]));await close();await open();
      const saved=app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===stageId);
      assert.equal(saved[field],max,'The last representable native increment is retained');
      parse(await push({UserAdventureStage:[saved]}));
      await rejected(action,{...body,token:`${body.token}-exhausted`},400);
      assert.deepEqual(app.store.operations(),[],'Exhaustion cannot mint an operation that aborts the protected setter');
    }
    for(const table of tables) for(const variant of ['exact','crossing','saturated','near-full-stock','full-stock'])
      for(const order of ['stock-first','signature-first','lifetime-first','spent-first']) {
        now=1790866800;await fresh(`${table}-${variant}-${order}`);
        const itemId=itemIdFor(table),original=master.stages[ordinaryId],quantity=5+
          (original.rewardType && master.items[original.rewardKey]===itemId?original.rewardAmount:0),
          before=rowFor(itemId,variant==='exact'?max-quantity:variant==='crossing'?max-1:max,
            ['near-full-stock','full-stock'].includes(variant)?(table==='UserCurrency'?2000000000:max)-(variant==='near-full-stock'?1:0):7);
        replaceItem(itemId,before);
        const body=battle(ordinaryId,`${table}-${variant}-${order}`,itemId),action='adventure/stage/complete';
        for(const target of ['stage_delivery','pve_item_claim','stage_completion','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER stage_cap_issue_fail BEFORE INSERT ON ${target} BEGIN SELECT RAISE(ABORT,'stage cap issue rollback'); END`);
          await rejected(action,body,503,false);app.store.db.exec('DROP TRIGGER stage_cap_issue_fail');
        }
        const issued=parse(await send(action,body)).operation,claim=app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(issued.id,itemId),
          capture=JSON.parse(claim.stock_state),profile=master.itemProfiles[itemId],field=profile.idField;
        assert.equal(issued.parameters.gainedItems.find(row=>row.itemId===itemId).amount,quantity);
        assert.equal(claim.cap_version,1);assert.equal(claim.cumulative_amount,max);assert.notEqual(issued.signature,before.signature);
        assert.deepEqual(app.store.read(table).data.find(row=>row[field]===itemId),before,'Issuance never precredits inventory');
        assert.deepEqual(parse(await send(action,body)).operation,issued);
        for(const changes of [{policy:'unknown'},{amountAdded:capture.amount-capture.beforeAmount+1,effect:true},
          {observed:true,effect:true},{beforeSignature:issued.signature},{beforeCumulative:max+1}]) {
          app.store.db.prepare('UPDATE pve_item_claim SET stock_state=? WHERE operation_id=? AND item_id=?').run(JSON.stringify({...capture,...changes}),issued.id,itemId);
          await rejected(action,body,503);
          app.store.db.prepare('UPDATE pve_item_claim SET stock_state=? WHERE operation_id=? AND item_id=?').run(claim.stock_state,issued.id,itemId);
        }
        await rejected('user_data/push',payload({},[issued]));
        const stock={...before,amount:capture.amount},signature={...stock,signature:issued.signature},
          lifetime={...before,cumulativeAmount:max},final={...stock,signature:issued.signature,cumulativeAmount:max},
          states=order==='stock-first'?[stock,{...stock,cumulativeAmount:max},final]:order==='signature-first'?[signature,final]:
            order==='lifetime-first'?[lifetime,final]:[{...final,amount:0}];
        for(const state of states) {
          const pending=app.store.db.prepare('SELECT stock_state FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(issued.id,itemId);
          if(!JSON.parse(pending.stock_state).effect && state.amount===before.amount && state.signature===before.signature && state.cumulativeAmount===before.cumulativeAmount) continue;
          for(const target of ['profile','pve_item_claim','stage_delivery']) {
            app.store.db.exec(`CREATE TRIGGER stage_cap_save_fail BEFORE UPDATE ON ${target} BEGIN SELECT RAISE(ABORT,'stage cap save rollback'); END`);
            await rejected('user_data/push',payload({[table]:[state]}),503,false);app.store.db.exec('DROP TRIGGER stage_cap_save_fail');
          }
          const reply=parse(await push({[table]:[state]}));assert(!reply.operations.some(row=>row.id===issued.id),'A saved effect suppresses delivery, not ACK');
          await close();await open();await rejected(action,body,503);
          await rejected('user_data/push',payload({},[issued]));
        }
        const observed=JSON.parse(app.store.db.prepare('SELECT stock_state FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(issued.id,itemId).stock_state);
        assert.equal(observed.observed,true);
        parse(await push({[table]:[{...final,amount:0}]}));
        await rejected('user_data/push',payload({[table]:[{...final,amount:1}]}));
        const effects=allEffects(issued);effects[table]=effects[table].map(row=>row[field]===itemId?{...row,amount:0}:row);
        parse(await push(effects));
        const ackBody=payload({},[issued]);
        for(const [target,event] of [['stage_state_floor','INSERT'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER stage_cap_ack_fail BEFORE ${event} ON ${target} BEGIN SELECT RAISE(ABORT,'stage cap ACK rollback'); END`);
          await rejected('user_data/push',ackBody,503,false);app.store.db.exec('DROP TRIGGER stage_cap_ack_fail');
        }
        const ack=await send('user_data/push',ackBody),ackIdentity=sequence;parse(ack);await close();await open();
        assert.equal((await request(port,ackIdentity,ackBody,String(ackIdentity),'user_data/push')).body.toString(),ack.body.toString());
        await rejected('user_data/push',payload({[table]:[{...final,amount:1}]}));
        await rejected('user_data/push',payload({[table]:[{...final,amount:0,cumulativeAmount:max-1}]}));
        await rejected('user_data/push',payload({},[],{[table]:[{[field]:itemId}]}));
        const completeCapture=app.store.db.prepare('SELECT stock_state FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(issued.id,itemId).stock_state;
        app.store.db.prepare('UPDATE pve_item_claim SET stock_state=NULL WHERE operation_id=? AND item_id=?').run(issued.id,itemId);
        await rejected('user_data/push',payload({[table]:[{...final,amount:0}]}),503);
        app.store.db.prepare('UPDATE pve_item_claim SET stock_state=? WHERE operation_id=? AND item_id=?').run(completeCapture,issued.id,itemId);
        const repeat=parse(await send(action,{...body,token:`${body.token}-again`})).operation;
        assert.equal(repeat.parameters.gainedItems.find(row=>row.itemId===itemId).amount,5,'First-clear reward stays once-only');
        const repeatEffects=allEffects(repeat);parse(await push(repeatEffects,[repeat]));
      }
    // Original classes, synthetic loot and prefixes: no natural earning or native save-order acceptance.
    const datedCases=[...['gacha_ticket.normal','gacha_ticket.character_3'].flatMap(key=>[max-5,max-1,max].map(cumulative=>({itemId:master.items[key],cumulative}))),
      ...stageTicketIds.flatMap(itemId=>[null,100].map(cumulative=>({itemId,cumulative})))];
    for(const {itemId,cumulative} of datedCases)
      for(const order of ['clear-first','append-first','lifetime-first','signature-first','pruned-first','expired-before-save','empty-before','combined']) {
        now=1686794400;await fresh(`dated-${itemId}-${cumulative}-${order}`);
        const first=cumulative===null,duration=master.lotteryTickets[itemId],issuedAt=now,
          baseline={userId:seed.userId,gachaTicketId:itemId,cumulativeAmount:cumulative??0,bookEntryState:first?1:-128,signature:first?0:0xffffffff,
            dateList:first || order==='empty-before'?[]:[{aquiredAt:now-duration},{aquiredAt:now-1}]};
        if(first) put('UserGachaTicket',app.store.read('UserGachaTicket').data.filter(row=>row.gachaTicketId!==itemId));
        else replaceItem(itemId,baseline);
        const body=battle(ordinaryId,`dated-${itemId}-${cumulative}-${order}`,itemId),action='adventure/stage/complete';
        for(const table of ['operation_queue','pve_item_claim','stage_delivery','stage_completion','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER stage_dated_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'dated issue rollback'); END`);
          await rejected(action,body,503,false);app.store.db.exec('DROP TRIGGER stage_dated_issue_fail');
        }
        const operation=parse(await send(action,body)).operation,claim=app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,itemId),
          capture=JSON.parse(claim.gacha_state),dates=Array.from({length:5},()=>({aquiredAt:issuedAt})),
          acquired={...baseline,bookEntryState:first?3:baseline.bookEntryState,cumulativeAmount:claim.cumulative_amount,
            signature:operation.signature,dateList:baseline.dateList.filter(row=>now<row.aquiredAt+duration).concat(dates)};
        assert.equal(operation.parameters.gainedItems.find(row=>row.itemId===itemId).amount,5);assert.equal(claim.cap_version,1);
        assert.equal(claim.stock_state,null);assert.equal(claim.valis_state,null);assert.equal(claim.valis_seen,0);
        assert.equal(claim.cumulative_amount,Math.min(max,baseline.cumulativeAmount+5));
        assert.deepEqual(capture,{policy:first?'offline-stage-gacha-ticket-first-v1':cumulative>=max-5?'offline-stage-gacha-cap-v1':'offline-stage-gacha-ticket-v1',
          beforeCumulative:baseline.cumulativeAmount,beforeDates:baseline.dateList,
          beforeSignature:baseline.signature,dateAdditions:0,observed:false,effect:false,signature:operation.signature});
        assert.notEqual(operation.signature,baseline.signature);
        assert.deepEqual(app.store.read('UserGachaTicket').data.find(row=>row.gachaTicketId===itemId),first?undefined:baseline,'No dated native precredit');
        assert.deepEqual(parse(await send(action,body)).operation,operation);
        const originalCold={response:await send('user_data/confirm'),identity:sequence};
        assert.deepEqual(parse(originalCold.response).operations,[operation]);
        for(const [version,state] of [[0,null],[0,claim.gacha_state],[1,null],[1,'{'],
          [1,JSON.stringify({...capture,dateAdditions:6})],[1,JSON.stringify({...capture,signature:baseline.signature})],
          [1,JSON.stringify({...capture,beforeDates:[{aquiredAt:issuedAt,expireAt:issuedAt+1}]})],[1,JSON.stringify({...capture,observed:true})]]) {
          app.store.db.prepare('UPDATE pve_item_claim SET cap_version=?,gacha_state=? WHERE operation_id=? AND item_id=?').run(version,state,operation.id,itemId);
          await rejected(action,body,503);await rejected('user_data/push',payload({},[operation]),503);
          app.store.db.prepare('UPDATE pve_item_claim SET cap_version=1,gacha_state=? WHERE operation_id=? AND item_id=?').run(claim.gacha_state,operation.id,itemId);
        }
        for(const changes of [{userId:2},{signature:0x100000000},{bookEntryState:128},{amount:5},
          {dateList:[{aquiredAt:'1'}]},{dateList:acquired.dateList.concat({aquiredAt:issuedAt})}])
          await rejected('user_data/push',payload({UserGachaTicket:[{...acquired,...changes}]}));
        await rejected('user_data/push',payload({},[operation]));
        const effects=allEffects(operation);
        if(first) await rejected('user_data/push',payload({...effects,UserGachaTicket:[{...acquired,bookEntryState:1}]},[operation]));
        if(order==='clear-first') {
          const {UserGachaTicket,...other}=effects;parse(await push(other));await rejected('user_data/push',payload({},[operation]));
          for(const [cold,body] of [['user_data/confirm',undefined],['user/login',undefined],['user_data/pull',{tables:['UserGachaTicket']}]])
            await rejected(cold,body,503);
        }
        if(order==='pruned-first') {
          const reply=parse(await push({UserGachaTicket:[{...baseline,dateList:baseline.dateList.filter(row=>now<row.aquiredAt+duration)}]}));
          assert(reply.operations.some(row=>row.id===operation.id),'Expiry pruning alone still allows the original callback');
          assert.equal(JSON.parse(app.store.db.prepare('SELECT gacha_state FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,itemId).gacha_state).effect,false);
        }
        if(order==='expired-before-save') now+=duration+1;
        const nativeGainBefore={...baseline,bookEntryState:first?3:baseline.bookEntryState},
          partial=order==='append-first'?{...nativeGainBefore,dateList:acquired.dateList}:
            order==='lifetime-first'?{...nativeGainBefore,cumulativeAmount:claim.cumulative_amount}:
            order==='signature-first'?{...nativeGainBefore,signature:operation.signature,dateList:[]}:order==='expired-before-save'?{...acquired,dateList:[]}:acquired;
        if(!['clear-first','combined','pruned-first'].includes(order)) {
          for(const table of ['profile','pve_item_claim','stage_delivery']) {
            app.store.db.exec(`CREATE TRIGGER stage_dated_save_fail BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'dated save rollback'); END`);
            // A saturated lifetime-only row is unchanged and deliberately has no capture update.
            if(!(order==='lifetime-first' && cumulative===max))
              await rejected('user_data/push',payload({UserGachaTicket:[partial]}),503,false);
            app.store.db.exec('DROP TRIGGER stage_dated_save_fail');
          }
          const reply=parse(await push({UserGachaTicket:[partial]})),recorded=JSON.parse(app.store.db.prepare('SELECT gacha_state FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,itemId).gacha_state);
          assert.equal(recorded.effect,!(order==='lifetime-first' && cumulative===max));
          if(recorded.effect) assert(!reply.operations.some(row=>row.id===operation.id),'An effect suppresses replay without discarding ACK');
          await close();await open();
          if(recorded.effect) await rejected(action,body,503);else assert.deepEqual(parse(await send(action,body)).operation,operation);
          await rejected('user_data/push',payload({},[operation]));
          if(recorded.observed || !recorded.effect) await recover(operation,recorded.observed?
            {...operation,parameters:{...operation.parameters,gainedItems:operation.parameters.gainedItems.filter(row=>row.itemId!==itemId)}}:operation,originalCold);
          else for(const [cold,body] of [['user_data/confirm',undefined],['user/login',undefined],['user_data/pull',{tables:['UserGachaTicket']}]])
            await rejected(cold,body,503);
          if(recorded.dateAdditions) {
            parse(await push({UserGachaTicket:[{...partial,dateList:[]}]}));
            await rejected('user_data/push',payload({UserGachaTicket:[{...partial,dateList:[{aquiredAt:issuedAt}]}]}));
          }
        }
        const held=snapshot();assert.throws(()=>app.store.issueDraw([1011002001],{userGachaTicket:{...acquired,dateList:[]}},1000),/Capped Present tickets/);
        assert.equal(snapshot(),held,'A pending captured stage ticket blocks a full-row lottery replacement');
        const pendingGift={userId:seed.userId,id:1,itemId,amount:1,title:'Synthetic interlock',message:'',senderType:1,senderId:0,
          giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,pcHeroSublimateCount:0,
          state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0};
        put('UserGift',[pendingGift]);await rejected('gift/receive',{userId:seed.userId,giftIds:[1]},503);
        const final=['append-first','signature-first','expired-before-save','empty-before'].includes(order)?{...acquired,dateList:[]}:acquired;
        effects.UserGachaTicket=[final];
        const ackBody=payload(effects,[operation]);
        for(const [table,event] of [['pve_item_claim','UPDATE'],['stage_delivery','UPDATE'],['stage_state_floor','INSERT'],
          ['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER stage_dated_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'dated ACK rollback'); END`);
          const current=JSON.parse(app.store.db.prepare('SELECT gacha_state FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,itemId).gacha_state);
          if(!(table==='pve_item_claim' && current.observed && current.dateAdditions===(final.dateList.length?5:current.dateAdditions)))
            await rejected('user_data/push',ackBody,503,false);
          app.store.db.exec('DROP TRIGGER stage_dated_ack_fail');
        }
        const ack=await send('user_data/push',ackBody),identity=sequence;parse(ack);await close();await open();
        assert.equal((await request(port,identity,ackBody,String(identity),'user_data/push')).body.toString(),ack.body.toString());
        const nativeProfile=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserGachaTicket'").get(),nativeRows=JSON.parse(nativeProfile.data);
        for(const corrupted of [nativeRows.filter(row=>row.gachaTicketId!==itemId),nativeRows.map(row=>row.gachaTicketId===itemId?
            {...row,cumulativeAmount:claim.cumulative_amount-1}:row)]) {
          put('UserGachaTicket',corrupted);await rejected('user_data/pull',{tables:['UserGachaTicket']},503);
          app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserGachaTicket'").run(nativeProfile.data,nativeProfile.token);
        }
        parse(await push({UserGachaTicket:[{...final,dateList:[]}]}));
        await rejected('user_data/push',payload({UserGachaTicket:[{...final,dateList:[{aquiredAt:issuedAt}]}]}));
        await rejected('user_data/push',payload({UserGachaTicket:[{...final,dateList:[],cumulativeAmount:claim.cumulative_amount-1}]}));
        await rejected('user_data/push',payload({},[],{UserGachaTicket:[{gachaTicketId:itemId}]}));
        const source=app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id);
        app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run('[]',operation.id);
        await rejected('user_data/push',payload({UserGachaTicket:[{...final,dateList:[]}]}),503);
        app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(source.observed,operation.id);
        const kept=snapshot();assert.throws(()=>app.store.issueDraw([1011002001],{userGachaTicket:{...final,dateList:[{aquiredAt:issuedAt}]}},1000),/cannot be restored/);
        assert.equal(snapshot(),kept,'The shared full-row issuer cannot restore completed stage ticket stock');
        const next=parse(await send(action,{...body,token:`${body.token}-next`})).operation,nextEffects=allEffects(next);
        parse(await push(nextEffects,[next]));assert.equal(app.store.read('UserGachaTicket').data.find(row=>row.gachaTicketId===itemId).dateList.length,5);
        const gift={userId:seed.userId,id:1,itemId,amount:1,title:'Synthetic dated reward',message:'',senderType:1,senderId:0,
          giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,pcHeroSublimateCount:0,
          state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0};
        put('UserGift',[gift]);const present=parse(await send('gift/receive',{userId:seed.userId,giftIds:[gift.id]})).operations[0],
          previous=app.store.read('UserGachaTicket').data.find(row=>row.gachaTicketId===itemId),
          later={...previous,signature:present.signature,cumulativeAmount:Math.min(max,previous.cumulativeAmount+1),
            dateList:previous.dateList.concat({aquiredAt:now})};
        parse(await push({UserGift:[{...gift,state:1}],UserGachaTicket:[later]},[present]));await close();await open();
        parse(await push({UserGachaTicket:[later]}));assert.equal(later.dateList.length,6,
          'Completed stage source validation must not mistake a later original producer for an old allowance violation');
      }
    // WRITTEN ONLY:54 same-level CP contexts across all three shared completions, hero tracks and actual owner forms.
    for(const mode of ['ordinary','pve','element']) for(const hero of [0,1,2]) for(const owner of [seed.userId,0]) for(const subset of [1,2,3]) {
      now=mode==='element'?master.elementEventStages[66100000001].startAt:1790866800;
      await fresh(`cold-cp-${mode}-${hero}-${owner}-${subset}`);
      const stageId=mode==='ordinary'?ordinaryId:mode==='pve'?1120000904103:1260000101101,original=stageRow(stageId),
        numericId=master.items['status_board_item.special'],datedId=master.items['gacha_ticket.normal'],
        ids=[101000001,101000002],field=['friendship','friendshipAis','friendshipLef'][hero],
        targets=ids.map((characterId,index)=>({characterId,friendship:5+index*3,userHeroType:hero,
          friendshipLv:master.characters[characterId].levels.findLast(([,points])=>points<=5+index*3)[0]}));
      assert(targets.every(row=>row.friendshipLv===1),'Authored first-level thresholds, not invented CP levels');
      put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,heroType:hero})));
      put('UserCharacter',app.store.read('UserCharacter').data.map(row=>ids.includes(row.characterId)?
        {...row,userId:owner,friendship:0,friendshipAis:0,friendshipLef:0}:row));
      put('UserAdventureStage',[original]);replaceItem(numericId,rowFor(numericId,max-1));replaceItem(valis,rowFor(valis,max-1));
      replaceItem(datedId,{userId:seed.userId,gachaTicketId:datedId,cumulativeAmount:100,bookEntryState:3,signature:7,dateList:[]});
      let body={...battle(stageId,`cp-${mode}-${hero}-${owner}-${subset}`,numericId,2),
        adventureGainedItems:[{itemId:numericId,amount:2},{itemId:datedId,amount:2}],
        adventureStageTaskIds:original.tasks.map(row=>row.adventureStageTaskId),friendshipStates:[...targets,targets[0]]};
      if(mode==='pve') body=pveBattle(body);
      if(mode==='element') body={...body,userElementEventScore:{totalDamage:1000,maxDamage:100,actionCount:7,defeat:true,turnCount:2,pcTotalDamage:50},adventureRecord:{continueCount:0}};
      const action=`${mode==='ordinary'?'adventure':mode==='pve'?'pve':'element_event'}/stage/complete`,
        operation=parse(await send(action,body)).operation,iris=app.store.hardCurrency(),
        originalCold={response:await send('user_data/confirm'),identity:sequence};
      assert.deepEqual(parse(originalCold.response).operations,[operation]);
      assert.deepEqual(operation.parameters.friendshipStates,[...targets,targets[0]].map(({characterId,friendship})=>({characterId,friendship})));
      const retained=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserCharacter'").get(),
        restore=()=>app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserCharacter'").run(retained.data,retained.token),
        characters=app.store.read('UserCharacter').data;
      put('UserCharacter',characters.map(row=>row.characterId===ids[0]?{...row,[field]:1}:row));
      await rejected('user_data/confirm',undefined,503);restore();
      const saved=targets.filter((row,index)=>subset & 1<<index).map(target=>
        ({...characters.find(row=>row.characterId===target.characterId),[field]:target.friendship}));
      if(mode==='ordinary' && hero===0 && owner===seed.userId && subset===1)
        for(const [table,event] of [['profile','UPDATE'],['stage_delivery','UPDATE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER cp_prefix_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'CP prefix rollback'); END`);
          await rejected('user_data/push',payload({UserCharacter:saved}),503,false);app.store.db.exec('DROP TRIGGER cp_prefix_fail');
        }
      parse(await push({UserCharacter:saved}));await recover(operation,operation,originalCold);
      await rejected('user_data/push',payload({},[operation]));
      const current=app.store.read('UserCharacter').data,profile=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserCharacter'").get(),
        restoreSaved=()=>app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserCharacter'").run(profile.data,profile.token),
        selected=saved[0].characterId;
      for(const corruption of [current.map(row=>row.characterId===selected?{...row,[field]:row[field]+1}:row),
          current.filter(row=>row.characterId!==selected),current.concat(current.find(row=>row.characterId===selected)),
          current.map(row=>row.characterId===selected?{...row,[['friendship','friendshipAis','friendshipLef'][(hero+1)%3]]:-1}:row)]) {
        put('UserCharacter',corruption);await rejected('user_data/confirm',undefined,503);restoreSaved();
      }
      const users=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserInfo'").get();
      put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,heroType:(hero+1)%3})));
      await rejected('user_data/confirm',undefined,503);
      app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserInfo'").run(users.data,users.token);
      put('UserAdventureStage',[{...original,dailyClearCount:1}]);await rejected('user_data/confirm',undefined,503);put('UserAdventureStage',[original]);
      const prefix={...original,tasks:original.tasks.map(row=>({...row,state:2})),...(mode==='pve'?{
        currentScore:operation.parameters.finalScore,highScore:Math.max(original.highScore,operation.parameters.finalScore)}:{})};
      parse(await push({UserAdventureStage:[prefix]}));await recover(operation,operation,originalCold);
      const effects=allEffects(operation),old=app.store.read('UserStatusBoardItem').data.find(row=>row.statusBoardItemId===numericId);
      parse(await push({UserStatusBoardItem:[{...old,amount:old.amount+1}]}));await rejected('user_data/confirm',undefined,503);
      const itemTables=new Set(app.store.db.prepare('SELECT table_name FROM pve_item_claim WHERE operation_id=?').all(operation.id).map(row=>row.table_name));
      parse(await push(Object.fromEntries([...itemTables].map(table=>[table,effects[table]]))));
      let expected={...operation,parameters:{...operation.parameters,gainedItems:[],...(mode==='pve'?{
        rewardRanks:operation.parameters.rewardRanks.filter(rank=>master.pveScores[stageId].rewards[rank].rewardType===1)}:{})}};
      await recover(operation,expected,originalCold);
      if(mode==='ordinary') {
        parse(await push({UserInfo:effects.UserInfo}));
        expected={...expected,parameters:{...expected.parameters,offlineStageXpApplied:1}};
        await recover(operation,expected,originalCold);
      }
      assert.deepEqual(expected.parameters.friendshipStates,operation.parameters.friendshipStates,'No CP target, duplicate, quantity or hero is filtered from native replay');
      effects.UserCharacter=targets.map(target=>({...current.find(row=>row.characterId===target.characterId),[field]:target.friendship}));
      if(mode==='ordinary' && hero===0 && owner===seed.userId && subset===1)
        for(const [table,event] of [['stage_friendship_floor','INSERT'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER cp_mixed_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'CP mixed ACK rollback'); END`);
          await rejected('user_data/push',payload(effects,[operation]),503,false);app.store.db.exec('DROP TRIGGER cp_mixed_ack_fail');
        }
      parse(await push(effects,[operation]));await close();await open();assert.deepEqual(app.store.operations(),[]);
      for(const target of targets) {
        const row=app.store.read('UserCharacter').data.find(row=>row.characterId===target.characterId);
        assert.equal(row[field],target.friendship);assert.equal(row.userId,owner);
        assert.equal(app.store.db.prepare('SELECT friendship FROM stage_friendship_floor WHERE character_id=? AND user_hero_type=?')
          .get(target.characterId,hero).friendship,target.friendship);
      }
      assert.equal(app.store.hardCurrency(),iris,'CP cold replay does not repeat objective or rank Iris awards');
    }
    // Six source-only boundaries: lazy rows and captured CP-first level growth recover; real mixed ACK still required.
    for(const mode of ['ordinary','pve','element']) for(const initial of [false,true]) {
      now=mode==='element'?master.elementEventStages[66100000001].startAt:1790866800;await fresh(`cold-cp-boundary-${mode}-${initial}`);
      const stageId=mode==='ordinary'?ordinaryId:mode==='pve'?1120000904103:1260000101101,original=stageRow(stageId),
        characterId=101000001,itemId=master.items['status_board_item.special'],
        before=app.store.read('UserCharacter').data.find(row=>row.characterId===characterId),points=initial?5:17;
      put('UserAdventureStage',[original]);replaceItem(itemId,rowFor(itemId,10));
      if(initial) put('UserCharacter',app.store.read('UserCharacter').data.filter(row=>row.characterId!==characterId));
      else put('UserPC',app.store.read('UserPC').data.map(row=>master.pcProfiles[row.pcId].characterId===characterId?{...row,hp:7,mp:3}:row));
      let body={...battle(stageId,`cp-boundary-${mode}-${initial}`,itemId,2),friendshipStates:[{characterId,friendship:points,
        friendshipLv:master.characters[characterId].levels.findLast(([,threshold])=>threshold<=points)[0],userHeroType:0}]};
      if(mode==='pve') body=pveBattle(body);
      if(mode==='element') body={...body,userElementEventScore:{totalDamage:1000,maxDamage:100,actionCount:7,defeat:true,turnCount:2,pcTotalDamage:50},adventureRecord:{continueCount:0}};
      const action=`${mode==='ordinary'?'adventure':mode==='pve'?'pve':'element_event'}/stage/complete`,operation=parse(await send(action,body)).operation,
        originalCold={response:await send('user_data/confirm'),identity:sequence},
        saved={...before,...(initial?{userId:0,characterState:1,signature:0xffffffff}:{}),friendship:points};
      assert.deepEqual(parse(originalCold.response).operations,[operation]);parse(await push({UserCharacter:[saved]}));
      const expected=initial?operation:{...operation,parameters:{...operation.parameters,
        friendshipStates:operation.parameters.friendshipStates.map((row,index)=>index===0?{...row,offlineStageCpLevelPending:1}:row)}};
      await recover(operation,expected,originalCold);
      await rejected('user_data/push',payload({},[operation]));
      assert.deepEqual(app.store.operations(),[operation],'Recovery never acknowledges the unfinished mixed reward');
      parse(await push({...allEffects(operation),UserCharacter:[saved]},[operation]));await close();await open();
      assert.deepEqual(app.store.operations(),[]);assert.equal(app.store.read('UserCharacter').data.find(row=>row.characterId===characterId).userId,initial?0:before.userId);
      assert.equal(app.store.db.prepare('SELECT friendship FROM stage_friendship_floor WHERE character_id=? AND user_hero_type=0')
        .get(characterId).friendship,points);
    }
    // WRITTEN ONLY:297 level-fanout contexts;135 new CP-plus-refill/quest/voice/both-character prefixes, no native acceptance.
    for(const mode of ['ordinary','pve','element']) for(const hero of [0,1,2]) for(const role of ['owned','owner-zero','initial'])
      for(const order of ['hp-first','mp-first','quest-first','voice-first','cp-first','all-level-first',
        'cp-hp-first','cp-mp-first','cp-quest-first','cp-voice-first','cp-both-first']) {
        now=mode==='element'?master.elementEventStages[66100000001].startAt:1790866800;
        await fresh(`cold-cp-level-${mode}-${hero}-${role}-${order}`);
        const stageId=mode==='ordinary'?ordinaryId:mode==='pve'?1120000904103:1260000101101,original=stageRow(stageId),
          ids=[101000001,101000002],points=122,field=['friendship','friendshipAis','friendshipLef'][hero],
          numericId=master.items['status_board_item.special'],datedId=master.items['gacha_ticket.normal'],secondId=1011001002,
          aisId=Number(Object.keys(master.pcProfiles).find(id=>master.pcProfiles[id].characterId===ids[1] &&
            !master.pcGuests.some(row=>row.pcId===Number(id)))),
          beforeCharacters=app.store.read('UserCharacter').data,
          characters=ids.map((characterId,index)=>({...beforeCharacters.find(row=>row.characterId===characterId),
            userId:index===0 && role!=='owned'?0:seed.userId,characterState:1,friendship:0,friendshipAis:0,friendshipLef:0,
            ...(index===0 && role==='initial'?{substitutedPcSpineId:0,signature:0xffffffff}:{})})),
          targets=ids.map(characterId=>({characterId,friendship:points,userHeroType:hero,
            friendshipLv:master.characters[characterId].levels.findLast(([,threshold])=>threshold<=points)[0]}));
        put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,heroType:hero})));
        put('UserCharacter',beforeCharacters.filter(row=>!ids.includes(row.characterId)).concat(role==='initial'?characters.slice(1):characters));
        put('UserPC',app.store.read('UserPC').data.filter(row=>![secondId,aisId].includes(row.pcId)).concat([secondId,aisId].map(pcId=>
          ({...seed.data.UserPC[0],...pcInitialStatInput(pcId,master),joiningState:0,hp:7,mp:3}))).map(row=>
            ids.includes(master.pcProfiles[row.pcId].characterId)?{...row,hp:7,mp:3}:row));
        put('UserAdventureStage',app.store.read('UserAdventureStage').data.filter(row=>row.adventureStageId!==stageId).map(row=>
          [2,3].includes(master.stages[row.adventureStageId]?.adventureType)?{...row,state:0}:row).concat(original));
        put('UserCharacterCostume',app.store.read('UserCharacterCostume').data.filter(row=>row.costumeId===1022027000));
        put('UserCommunicationVoice',[]);replaceItem(numericId,rowFor(numericId,max-1));replaceItem(valis,rowFor(valis,max-1));
        replaceItem(datedId,{userId:seed.userId,gachaTicketId:datedId,cumulativeAmount:100,bookEntryState:3,signature:7,dateList:[]});
        let body={...battle(stageId,`cp-level-${mode}-${hero}-${role}-${order}`,numericId,2),
          adventureGainedItems:[{itemId:numericId,amount:2},{itemId:datedId,amount:2}],
          adventureStageTaskIds:original.tasks.map(row=>row.adventureStageTaskId),friendshipStates:[...targets,targets[0]]};
        if(mode==='pve') body=pveBattle(body);
        if(mode==='element') body={...body,userElementEventScore:{totalDamage:1000,maxDamage:100,actionCount:7,defeat:true,turnCount:2,pcTotalDamage:50},adventureRecord:{continueCount:0}};
        const action=`${mode==='ordinary'?'adventure':mode==='pve'?'pve':'element_event'}/stage/complete`,
          operation=parse(await send(action,body)).operation,iris=app.store.hardCurrency(),
          originalCold={response:await send('user_data/confirm'),identity:sequence},
          receipt=app.store.db.prepare('SELECT * FROM stage_delivery WHERE operation_id=?').get(operation.id),
          graph=JSON.parse(receipt.friendship_unlocks),effects=allEffects(operation),
          health=effects.UserPC,quests=graph.effects.map(({stageId})=>effects.UserAdventureStage.find(row=>row.adventureStageId===stageId)),
          levels={UserPC:health,UserAdventureStage:quests,UserCommunicationVoice:effects.UserCommunicationVoice},
          savedCharacters=characters.map(row=>({...row,[field]:points})),
          first=graph.refills.targets.find(row=>row.pcId===1011001001),
          input=graph.refills.inputs.find(row=>row.pc.pcId===first.pcId),
          partialHealth=fieldName=>({UserPC:[{...health.find(row=>row.pcId===first.pcId),
            [fieldName==='hp'?'mp':'hp']:input[fieldName==='hp'?'mp':'hp']}]}),
          cpFirst=order.startsWith('cp'),bothCp=order==='cp-both-first',
          cpReplay={...operation,parameters:{...operation.parameters,friendshipStates:operation.parameters.friendshipStates.map((row,index)=>
            index===0 || bothCp && index===1?{...row,offlineStageCpLevelPending:1}:row)}},
          prefix=cpFirst?{UserCharacter:bothCp?savedCharacters:[savedCharacters[0]],
            ...(order==='cp-hp-first'?partialHealth('hp'):order==='cp-mp-first'?partialHealth('mp'):
              order==='cp-quest-first'?{UserAdventureStage:quests}:order==='cp-voice-first'?{UserCommunicationVoice:levels.UserCommunicationVoice}:{})}:
            order==='hp-first'?partialHealth('hp'):order==='mp-first'?partialHealth('mp'):
            order==='quest-first'?{UserAdventureStage:quests}:order==='voice-first'?{UserCommunicationVoice:levels.UserCommunicationVoice}:
            levels;
        assert.deepEqual(parse(originalCold.response).operations,[operation]);assert(first.hpRequired && first.mpRequired);
        assert(graph.refills.targets.some(row=>row.pcId===secondId),'Unjoined matching units stay in the original refill scope');
        assert(quests.length && levels.UserCommunicationVoice.length,'Use actual captured original quest/voice obligations');
        if(mode==='ordinary' && hero===0 && role==='owned' && order==='hp-first')
          for(const [table,event] of [['profile','UPDATE'],['stage_delivery','UPDATE'],['reply_cache','INSERT']]) {
            app.store.db.exec(`CREATE TRIGGER cp_level_prefix_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'CP level prefix rollback'); END`);
            await rejected('user_data/push',payload(prefix),503,false);app.store.db.exec('DROP TRIGGER cp_level_prefix_fail');
          }
        parse(await push(prefix));await rejected('user_data/push',payload({},[operation]));
        if(cpFirst) {
          await recover(operation,cpReplay,originalCold);
          assert.equal(cpReplay.parameters.friendshipStates.filter(row=>row.offlineStageCpLevelPending===1).length,bothCp?2:1,
            'One original level fanout per pending character, never another fanout for duplicate absolute targets');
          if(order==='cp-first') {
            parse(await push(partialHealth('hp')));await recover(operation,cpReplay,originalCold);
          }
          if(mode==='ordinary' && hero===0 && role==='owned' && order==='cp-first') {
            const cached=await send('user_data/confirm'),cacheIdentity=sequence,originalStates=operation.parameters.friendshipStates;
            for(const states of [...[0,2,'1',null].map(value=>cpReplay.parameters.friendshipStates.map((row,index)=>index===0?
                  {...row,offlineStageCpLevelPending:value}:row)),
                originalStates.map((row,index)=>index===originalStates.length-1?{...row,offlineStageCpLevelPending:1}:row)]) {
              const bad=JSON.parse(cached.body);bad.operations[0].parameters.friendshipStates=states;
              app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(Buffer.from(JSON.stringify(bad)).toString('base64'),`${cacheIdentity}/${cacheIdentity}`);
              const before=snapshot(),reply=await request(port,cacheIdentity,undefined,String(cacheIdentity),'user_data/confirm');
              assert.equal(reply.status,503);assert.equal(snapshot(),before,'Changed/duplicate-target controls cannot impersonate the current derived receipt');
              app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(cached.body.toString('base64'),`${cacheIdentity}/${cacheIdentity}`);
            }
            const originalQueue=app.store.db.prepare('SELECT parameters FROM operation_queue WHERE id=?').get(operation.id).parameters,
              receiptJson=receipt.operation_json,forged={...operation,parameters:{...operation.parameters,
                friendshipStates:cpReplay.parameters.friendshipStates}};
            app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(forged.parameters),operation.id);
            app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run(JSON.stringify(forged),operation.id);
            await rejected('user_data/confirm',undefined,503);
            app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(originalQueue,operation.id);
            app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run(receiptJson,operation.id);
            await recover(operation,cpReplay,originalCold);
          }
        } else await recover(operation,operation,originalCold);
        parse(await push(levels));await recover(operation,operation,originalCold);
        parse(await push({UserCharacter:[savedCharacters[0]]}));await recover(operation,operation,originalCold);
        assert.equal(app.store.read('UserCharacter').data.find(row=>row.characterId===ids[1])[field],bothCp?points:0,
          'Closing Bell level effects does not waive the other character CP setter');
        const current=app.store.read('UserPC').data,profile=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserPC'").get(),
          restore=()=>app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserPC'").run(profile.data,profile.token);
        for(const corruption of [current.filter(row=>row.pcId!==secondId),current.concat(current.find(row=>row.pcId===secondId)),
            ...[{hp:first.hp+1},{mp:input.mp},{totalExp:1}].map(change=>current.map(row=>row.pcId===first.pcId?{...row,...change}:row))]) {
          put('UserPC',corruption);await rejected('user_data/confirm',undefined,503);restore();
        }
        const next=receipt.next_unlock?JSON.parse(receipt.next_unlock):null;
        if(next?.required && !quests.some(row=>row.adventureStageId===next.stageId)) {
          const stages=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserAdventureStage'").get(),
            opened=effects.UserAdventureStage.find(row=>row.adventureStageId===next.stageId);
          put('UserAdventureStage',app.store.read('UserAdventureStage').data.filter(row=>row.adventureStageId!==next.stageId).concat(opened));
          await rejected('user_data/confirm',undefined,503);
          app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserAdventureStage'").run(stages.data,stages.token);
        }
        parse(await push({UserCharacter:savedCharacters}));await recover(operation,operation,originalCold);
        parse(await push({UserAdventureStage:[{...original,tasks:original.tasks.map(row=>({...row,state:2})),...(mode==='pve'?{
          currentScore:operation.parameters.finalScore,highScore:Math.max(original.highScore,operation.parameters.finalScore)}:{})}]}));
        await recover(operation,operation,originalCold);
        const itemTables=new Set(app.store.db.prepare('SELECT table_name FROM pve_item_claim WHERE operation_id=?').all(operation.id).map(row=>row.table_name));
        parse(await push(Object.fromEntries([...itemTables].map(table=>[table,effects[table]]))));
        let expected={...operation,parameters:{...operation.parameters,gainedItems:[],...(mode==='pve'?{
          rewardRanks:operation.parameters.rewardRanks.filter(rank=>master.pveScores[stageId].rewards[rank].rewardType===1)}:{})}};
        await recover(operation,expected,originalCold);
        if(mode==='ordinary') {
          parse(await push({UserInfo:effects.UserInfo}));expected={...expected,parameters:{...expected.parameters,offlineStageXpApplied:1}};
          await recover(operation,expected,originalCold);
        }
        effects.UserCharacter=savedCharacters;
        if(mode==='ordinary' && hero===0 && role==='owned' && order==='hp-first')
          for(const [table,event] of [['stage_friendship_floor','INSERT'],['costume_unlock_floor','INSERT'],['operation_done','INSERT'],
            ['operation_queue','DELETE'],['reply_cache','INSERT']]) {
            app.store.db.exec(`CREATE TRIGGER cp_level_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'CP level ACK rollback'); END`);
            await rejected('user_data/push',payload(effects,[operation]),503,false);app.store.db.exec('DROP TRIGGER cp_level_ack_fail');
          }
        parse(await push(effects,[operation]));await close();await open();assert.deepEqual(app.store.operations(),[]);
        for(const target of graph.refills.targets) {
          const pc=app.store.read('UserPC').data.find(row=>row.pcId===target.pcId);assert.equal(pc.hp,target.hp);assert.equal(pc.mp,target.mp);
        }
        assert.equal(app.store.hardCurrency(),iris);assert.deepEqual(expected.parameters.friendshipStates,operation.parameters.friendshipStates);
        const damaged={...app.store.read('UserPC').data.find(row=>row.pcId===first.pcId),hp:5,mp:1};
        parse(await push({UserPC:[damaged]}));assert.equal(app.store.read('UserPC').data.find(row=>row.pcId===first.pcId).hp,5,
          'An acknowledged CP refill is not a permanent full-health floor');
      }
    // WRITTEN ONLY:54 initializer contexts, including zero CP, row-only pending growth and mixed existing/new rows.
    for(const mode of ['ordinary','pve','element']) for(const hero of [0,1,2])
      for(const variant of ['row-zero','row-same-level','row-pending-level','row-and-points','mixed-row','mixed-points']) {
        now=mode==='element'?master.elementEventStages[66100000001].startAt:1790866800;
        await fresh(`cold-cp-initial-${mode}-${hero}-${variant}`);
        const stageId=mode==='ordinary'?ordinaryId:mode==='pve'?1120000904103:1260000101101,original=stageRow(stageId),
          ids=[101000001,101000002],field=['friendship','friendshipAis','friendshipLef'][hero],
          mixed=variant.startsWith('mixed'),points=variant==='row-zero'?0:variant==='row-pending-level'?17:5,
          pointsSaved=['row-and-points','mixed-points'].includes(variant),
          numericId=master.items['status_board_item.special'],datedId=master.items['gacha_ticket.normal'],
          before=app.store.read('UserCharacter').data,
          initial=ids.map(characterId=>({...before.find(row=>row.characterId===characterId),userId:0,characterState:1,
            friendship:0,friendshipAis:0,friendshipLef:0,substitutedPcSpineId:0,signature:0xffffffff})),
          targets=ids.map(characterId=>({characterId,friendship:points,userHeroType:hero,
            friendshipLv:master.characters[characterId].levels.findLast(([,threshold])=>threshold<=points)[0]}));
        put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,heroType:hero})));
        put('UserCharacter',before.filter(row=>!ids.includes(row.characterId)).concat(mixed?
          [{...before.find(row=>row.characterId===ids[1]),friendship:0,friendshipAis:0,friendshipLef:0}]:[]));
        if(variant==='row-pending-level') put('UserPC',app.store.read('UserPC').data.map(row=>
          master.pcProfiles[row.pcId].characterId===ids[0]?{...row,hp:7,mp:3}:row));
        put('UserAdventureStage',[original]);replaceItem(numericId,rowFor(numericId,max-1));replaceItem(valis,rowFor(valis,max-1));
        replaceItem(datedId,{userId:seed.userId,gachaTicketId:datedId,cumulativeAmount:100,bookEntryState:3,signature:7,dateList:[]});
        let body={...battle(stageId,`cp-initial-${mode}-${hero}-${variant}`,numericId,2),
          adventureGainedItems:[{itemId:numericId,amount:2},{itemId:datedId,amount:2}],
          adventureStageTaskIds:original.tasks.map(row=>row.adventureStageTaskId),friendshipStates:[...targets,targets[0]]};
        if(mode==='pve') body=pveBattle(body);
        if(mode==='element') body={...body,userElementEventScore:{totalDamage:1000,maxDamage:100,actionCount:7,defeat:true,turnCount:2,pcTotalDamage:50},adventureRecord:{continueCount:0}};
        const action=`${mode==='ordinary'?'adventure':mode==='pve'?'pve':'element_event'}/stage/complete`,
          operation=parse(await send(action,body)).operation,iris=app.store.hardCurrency(),
          originalCold={response:await send('user_data/confirm'),identity:sequence},
          saved=[{...initial[0],[field]:pointsSaved?points:0},...(mixed?
            [{...app.store.read('UserCharacter').data.find(row=>row.characterId===ids[1]),[field]:points}]:[])];
        assert.deepEqual(parse(originalCold.response).operations,[operation]);
        assert(!app.store.read('UserCharacter').data.some(row=>row.characterId===ids[0]),'Issuance does not create the native CP row');
        if(mode==='ordinary' && hero===0 && variant==='row-zero')
          for(const [table,event] of [['profile','UPDATE'],['stage_delivery','UPDATE'],['reply_cache','INSERT']]) {
            app.store.db.exec(`CREATE TRIGGER cp_initial_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'CP initializer rollback'); END`);
            await rejected('user_data/push',payload({UserCharacter:saved}),503,false);app.store.db.exec('DROP TRIGGER cp_initial_fail');
          }
        const prefix=parse(await push({UserCharacter:saved}));assert(!prefix.operations.some(row=>row.id===operation.id));
        await recover(operation,operation,originalCold);await rejected('user_data/push',payload({},[operation]));
        const current=app.store.read('UserCharacter').data,profile=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserCharacter'").get(),
          restore=()=>app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserCharacter'").run(profile.data,profile.token);
        for(const corruption of [current.filter(row=>row.characterId!==ids[0]),current.concat(saved[0]),
            ...[{userId:seed.userId},{characterState:2},{characterState:3},
              {[['friendship','friendshipAis','friendshipLef'][(hero+1)%3]]:1},
              {[field]:1},{[field]:points+1}].map(change=>
                current.map(row=>row.characterId===ids[0]?{...row,...change}:row))]) {
          put('UserCharacter',corruption);await rejected('user_data/confirm',undefined,503);restore();
        }
        if(variant==='row-pending-level') {
          put('UserCharacter',current.map(row=>row.characterId===ids[0]?{...row,[field]:points}:row));
          const replay={...operation,parameters:{...operation.parameters,friendshipStates:operation.parameters.friendshipStates.map((row,index)=>
            index===0?{...row,offlineStageCpLevelPending:1}:row)}};
          await recover(operation,replay,originalCold);restore();
        }
        const users=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserInfo'").get();
        put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,heroType:(hero+1)%3})));
        await rejected('user_data/confirm',undefined,503);
        app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserInfo'").run(users.data,users.token);
        put('UserAdventureStage',[{...original,dailyClearCount:1}]);await rejected('user_data/confirm',undefined,503);put('UserAdventureStage',[original]);
        parse(await push({UserAdventureStage:[{...original,tasks:original.tasks.map(row=>({...row,state:2})),...(mode==='pve'?{
          currentScore:operation.parameters.finalScore,highScore:Math.max(original.highScore,operation.parameters.finalScore)}:{})}]}));
        await recover(operation,operation,originalCold);
        const effects=allEffects(operation),itemTables=new Set(app.store.db.prepare('SELECT table_name FROM pve_item_claim WHERE operation_id=?')
          .all(operation.id).map(row=>row.table_name));
        parse(await push(Object.fromEntries([...itemTables].map(table=>[table,effects[table]]))));
        const expected={...operation,parameters:{...operation.parameters,gainedItems:[],...(mode==='pve'?{
          rewardRanks:operation.parameters.rewardRanks.filter(rank=>master.pveScores[stageId].rewards[rank].rewardType===1)}:{})}};
        await recover(operation,expected,originalCold);
        assert.deepEqual(expected.parameters.friendshipStates,operation.parameters.friendshipStates,'Every initializer/CP target and duplicate stays in the original callback');
        effects.UserCharacter=targets.map((target,index)=>({... (mixed && index===1?current.find(row=>row.characterId===target.characterId):initial[index]),
          [field]:target.friendship}));
        if(mode==='ordinary' && hero===0 && variant==='row-zero')
          for(const [table,event] of [['stage_friendship_floor','INSERT'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
            app.store.db.exec(`CREATE TRIGGER cp_initial_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'CP initializer ACK rollback'); END`);
            await rejected('user_data/push',payload(effects,[operation]),503,false);app.store.db.exec('DROP TRIGGER cp_initial_ack_fail');
          }
        parse(await push(effects,[operation]));await close();await open();assert.deepEqual(app.store.operations(),[]);
        for(const target of targets) {
          const row=app.store.read('UserCharacter').data.find(row=>row.characterId===target.characterId);
          assert.equal(row[field],points);assert.equal(row.userId,mixed && target.characterId===ids[1]?seed.userId:0);
          assert.equal(app.store.db.prepare('SELECT friendship FROM stage_friendship_floor WHERE character_id=? AND user_hero_type=?')
            .get(target.characterId,hero).friendship,points);
        }
        assert.equal(app.store.hardCurrency(),iris,'Lazy CP recovery never repeats first-clear/objective/rank Iris');
      }
    // WRITTEN ONLY: original first-clear Liliruca acquisition cannot be mistaken for a CP-only initializer.
    for(const hero of [0,1,2]) {
      now=1790866800;await fresh(`cold-cp-initial-coupled-${hero}`);
      const stageId=1010000108101,pcId=master.pcs[master.stages[stageId].rewardKey],characterId=master.pcProfiles[pcId].characterId,
        before=app.store.read('UserCharacter').data.find(row=>row.characterId===characterId),itemId=master.items['status_board_item.special'],
        field=['friendship','friendshipAis','friendshipLef'][hero];
      put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,heroType:hero})));
      put('UserCharacter',app.store.read('UserCharacter').data.filter(row=>row.characterId!==characterId));
      put('UserAdventureStage',[stageRow(stageId)]);replaceItem(itemId,rowFor(itemId,10));
      const operation=parse(await send('adventure/stage/complete',{...battle(stageId,`cp-coupled-${hero}`,itemId,2),
        friendshipStates:[{characterId,friendship:5,userHeroType:hero,
          friendshipLv:master.characters[characterId].levels.findLast(([,points])=>points<=5)[0]}]})).operation;
      assert.deepEqual(operation.parameters.gainedPCs,[pcId]);
      parse(await push({UserCharacter:[{...before,userId:0,characterState:1,friendship:0,friendshipAis:0,friendshipLef:0,
        [field]:5,signature:0xffffffff}]}));
      for(const [route,value] of [['user_data/confirm',undefined],['user/login',undefined],['user_data/pull',{tables:['UserCharacter']}]] )
        await rejected(route,value,503);
      await rejected('user_data/push',payload({},[operation]));assert.deepEqual(app.store.operations(),[operation]);
    }
    // WRITTEN ONLY:99 objective contexts, including every nonempty pending subset and three already-complete baselines.
    for(const mode of ['ordinary','pve','element']) for(const baseline of ['pending','mixed','complete']) {
      const subsets=baseline==='pending'?[1,2,3,4,5,6,7]:baseline==='mixed'?[4]:[0],
        flags=baseline==='complete'?[2]:[1,2],scores=mode==='pve' && baseline!=='complete'?['untouched','current','high','complete']:['untouched'];
      for(const subset of subsets) for(const flag of flags) for(const scorePart of scores) {
        now=mode==='element'?master.elementEventStages[66100000001].startAt:1790866800;
        await fresh(`cold-objectives-${mode}-${baseline}-${subset}-${flag}-${scorePart}`);
        const stageId=mode==='ordinary'?ordinaryId:mode==='pve'?1120000904103:1260000101101,
          original=stageRow(stageId),numericId=master.items['status_board_item.special'],datedId=master.items['gacha_ticket.normal'];
        assert.equal(original.tasks.length,3,'Use the original authored objective IDs, not invented flags');
        if(baseline!=='pending') original.tasks=original.tasks.map((row,index)=>({...row,state:baseline==='mixed'?[1,2,0][index]:[1,1,2][index]}));
        put('UserAdventureStage',[original]);replaceItem(numericId,rowFor(numericId,max-1));replaceItem(valis,rowFor(valis,max-1));
        replaceItem(datedId,{userId:seed.userId,gachaTicketId:datedId,cumulativeAmount:100,bookEntryState:3,
          signature:7,dateList:[{aquiredAt:now-master.lotteryTickets[datedId]-1}]});
        let body={...battle(stageId,`objectives-${mode}-${baseline}-${subset}-${flag}-${scorePart}`,numericId,2),
          adventureStageTaskIds:original.tasks.map(row=>row.adventureStageTaskId),
          adventureGainedItems:[{itemId:numericId,amount:2},{itemId:datedId,amount:2}]};
        if(mode==='pve') body=pveBattle(body);
        if(mode==='element') body={...body,userElementEventScore:{totalDamage:1000,maxDamage:100,actionCount:7,defeat:true,turnCount:2,pcTotalDamage:50},adventureRecord:{continueCount:0}};
        const action=`${mode==='ordinary'?'adventure':mode==='pve'?'pve':'element_event'}/stage/complete`,
          operation=parse(await send(action,body)).operation,iris=app.store.hardCurrency(),
          originalCold={response:await send('user_data/confirm'),identity:sequence};
        assert.deepEqual(parse(originalCold.response).operations,[operation]);
        const prefix={...app.store.read('UserAdventureStage').data[0],tasks:original.tasks.map((row,index)=>({...row,
          state:subset & 1<<index?flag:baseline!=='pending' && row.state===1?2:row.state}))};
        if(mode==='pve') {
          assert(operation.parameters.finalScore>0,'This original scored fixture must exercise distinct current/high assignments');
          if(['current','complete'].includes(scorePart)) prefix.currentScore=operation.parameters.finalScore;
          if(['high','complete'].includes(scorePart)) prefix.highScore=operation.parameters.finalScore;
        }
        if(baseline==='pending' && subset===1 && flag===1 && scorePart==='untouched')
          for(const [table,event] of [['profile','UPDATE'],['stage_delivery','UPDATE'],['reply_cache','INSERT']]) {
            app.store.db.exec(`CREATE TRIGGER objective_prefix_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'objective save rollback'); END`);
            await rejected('user_data/push',payload({UserAdventureStage:[prefix]}),503,false);
            app.store.db.exec('DROP TRIGGER objective_prefix_fail');
          }
        parse(await push({UserAdventureStage:[prefix]}));
        await recover(operation,operation,originalCold);
        assert.equal(app.store.hardCurrency(),iris,'Cold objective replay never credits original Iris rewards again');
        await rejected('user_data/push',payload({},[operation]));
        const profile=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserAdventureStage'").get(),
          restore=()=>app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserAdventureStage'").run(profile.data,profile.token),
          first=original.tasks.findIndex((row,index)=>subset & 1<<index);
        const corruptions=[{cumulativeClearCount:prefix.cumulativeClearCount+1},{dailyClearCount:prefix.dailyClearCount+1},
          {state:2},{firstCompleteDateTime:1},{lastCompleteDateTime:1},{firstTryDateTime:1},{lastTryDateTime:1},
          {userId:2},{token:0},{unexpectedField:true},
          {tasks:[...prefix.tasks,{...prefix.tasks[0]}]},{tasks:[...prefix.tasks].reverse()},
          {tasks:prefix.tasks.slice(1)},
          {tasks:prefix.tasks.map((row,index)=>index?row:{...row,adventureStageTaskId:682000004})},
          ...(first>=0?[{tasks:prefix.tasks.map((row,index)=>index===first?{...row,state:0}:row)}]:[]),
          ...(baseline!=='pending'?[{tasks:prefix.tasks.map((row,index)=>original.tasks[index].state===2?{...row,state:1}:row)}]:[]),
          ...(mode==='pve'?[{currentScore:operation.parameters.finalScore+1},{highScore:operation.parameters.finalScore+1}]:[])];
        for(const change of corruptions) {
          put('UserAdventureStage',[{...prefix,...change}]);await rejected('user_data/confirm',undefined,503);restore();
        }
        const effects=allEffects(operation),numeric=effects.UserStatusBoardItem.find(row=>row.statusBoardItemId===numericId),
          oldNumeric=app.store.read('UserStatusBoardItem').data.find(row=>row.statusBoardItemId===numericId);
        parse(await push({UserStatusBoardItem:[{...oldNumeric,amount:oldNumeric.amount+1}]}));
        await rejected('user_data/confirm',undefined,503);
        parse(await push({UserStatusBoardItem:[numeric]}));
        const expected={...operation,parameters:{...operation.parameters,gainedItems:operation.parameters.gainedItems.filter(row=>row.itemId!==numericId),
          ...(mode==='pve'?{rewardRanks:operation.parameters.rewardRanks.filter(rank=>
            master.pveScores[stageId].rewards[rank].rewardType!==0 || master.items[master.pveScores[stageId].rewards[rank].rewardKey]!==numericId)}:{})}};
        await recover(operation,expected,originalCold);
        parse(await push({UserGachaTicket:effects.UserGachaTicket}));
        const datedExpected={...expected,parameters:{...expected.parameters,gainedItems:expected.parameters.gainedItems.filter(row=>row.itemId!==datedId)}};
        await recover(operation,datedExpected,originalCold);
        assert.deepEqual(datedExpected.parameters.adventureStageTaskIds,operation.parameters.adventureStageTaskIds,
          'Keep ALL original objective IDs: the live native complete/received guard performs idempotence');
        const ack=allEffects(operation);
        for(const row of prefix.tasks.filter(row=>row.state===2))
          assert.equal(ack.UserAdventureStage[0].tasks.find(task=>task.adventureStageTaskId===row.adventureStageTaskId).state,2);
        parse(await push(ack,[operation]));await close();await open();assert.deepEqual(app.store.operations(),[]);
        assert.equal(app.store.hardCurrency(),iris,'Only the original issue transaction grants objective/S/rank Iris');
      }
    }
    // Three additional source/capture cases: a received objective cannot complete an unrequested zero-state sibling.
    for(const mode of ['ordinary','pve','element']) {
      now=mode==='element'?master.elementEventStages[66100000001].startAt:1790866800;await fresh(`objective-source-${mode}`);
      const stageId=mode==='ordinary'?ordinaryId:mode==='pve'?1120000904103:1260000101101,original=stageRow(stageId),
        itemId=master.items['status_board_item.special'],id=original.tasks[0].adventureStageTaskId;
      put('UserAdventureStage',[original]);replaceItem(itemId,rowFor(itemId,max-1));replaceItem(valis,rowFor(valis,max-1));
      let body={...battle(stageId,`objective-source-${mode}`,itemId,2),adventureStageTaskIds:[id]};
      if(mode==='pve') body=pveBattle(body);
      if(mode==='element') body={...body,userElementEventScore:{totalDamage:1000,maxDamage:100,actionCount:7,defeat:true,turnCount:2,pcTotalDamage:50},adventureRecord:{continueCount:0}};
      const operation=parse(await send(`${mode==='ordinary'?'adventure':mode==='pve'?'pve':'element_event'}/stage/complete`,body)).operation,
        originalCold={response:await send('user_data/confirm'),identity:sequence};
      assert.deepEqual(parse(originalCold.response).operations,[operation]);
      const prefix={...original,tasks:original.tasks.map(row=>row.adventureStageTaskId===id?{...row,state:2}:row)};
      parse(await push({UserAdventureStage:[prefix]}));await recover(operation,operation,originalCold);
      put('UserAdventureStage',[{...prefix,tasks:prefix.tasks.map((row,index)=>index===2?{...row,state:1}:row)}]);
      await rejected('user_data/confirm',undefined,503);put('UserAdventureStage',[prefix]);
      const before=operation.parameters.UserAdventureStage[0];
      for(const tasks of [before.tasks.filter(row=>row.adventureStageTaskId!==id),null,[null],
        before.tasks.map((row,index)=>index?row:{...row,state:3}),
        before.tasks.map((row,index)=>index?row:{...row,adventureStageTaskId:Number.MAX_SAFE_INTEGER+1})]) {
        const missing={...operation,parameters:{...operation.parameters,UserAdventureStage:[{...before,tasks}]}};
        app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(missing.parameters),operation.id);
        app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run(JSON.stringify(missing),operation.id);
        await rejected('user_data/confirm',undefined,503);
      }
      app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(operation.parameters),operation.id);
      app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run(JSON.stringify(operation),operation.id);
      const capture=app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id);
      app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?')
        .run(JSON.stringify([...JSON.parse(capture.observed),'task:682000004']),operation.id);
      await rejected('user_data/confirm',undefined,503);
      app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(capture.observed,operation.id);
      parse(await push(allEffects(operation),[operation]));await close();await open();assert.deepEqual(app.store.operations(),[]);
    }
    //16 additional cold contexts: isolated wire gains, exact saved subsets and a captured original Valis reward.
    for(const kind of ['dated','numeric']) for(const first of [false,true]) for(const subset of [0,1,2,3]) {
      now=1686794400;await fresh(`cold-items-${kind}-${first}-${subset}`);
      const ids=[master.items['gacha_ticket.normal'],master.items[kind==='dated'?'gacha_ticket.character_3':'status_board_item.special']],
        datedIds=ids.filter(id=>master.itemProfiles[id].table==='UserGachaTicket');
      if(first) put('UserGachaTicket',app.store.read('UserGachaTicket').data.filter(row=>!datedIds.includes(row.gachaTicketId)));
      else for(const id of datedIds) replaceItem(id,{userId:seed.userId,gachaTicketId:id,cumulativeAmount:100,bookEntryState:-128,
        signature:0xffffffff,dateList:[{aquiredAt:now-1}]});
      if(kind==='numeric') replaceItem(ids[1],rowFor(ids[1],max-1));
      replaceItem(valis,rowFor(valis,max-1));
      const body={...battle(ordinaryId,`cold-items-${kind}-${first}-${subset}`,ids[0]),
        adventureGainedItems:[{itemId:ids[0],amount:5},{itemId:ids[1],amount:2}]},
        operation=parse(await send('adventure/stage/complete',body)).operation,effects=allEffects(operation),
        originalCold={response:await send('user_data/confirm'),identity:sequence};
      assert.deepEqual(parse(originalCold.response).operations,[operation]);
      const selected=new Set([valis,...ids.filter((id,index)=>subset & 1<<index)]),puts={};
      for(const id of selected) {
        const profile=master.itemProfiles[id];
        (puts[profile.table]??=[]).push(effects[profile.table].find(row=>row[profile.idField]===id));
      }
      const partial=parse(await push(puts));assert(!partial.operations.some(row=>row.id===operation.id));
      await rejected('adventure/stage/complete',body,503);await rejected('user_data/push',payload({},[operation]));
      const expected={...operation,parameters:{...operation.parameters,gainedItems:operation.parameters.gainedItems.filter(row=>!selected.has(row.itemId))}};
      if(subset===3) assert.deepEqual(expected.parameters.gainedItems,[],'The original empty iterator must retain all other stage effects and full ACK');
      await recover(operation,expected,originalCold);
      // The cold response is not an ACK; malformed retained state still refuses rather than reminting items.
      const source=app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id);
      app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run('[]',operation.id);
      await rejected('user_data/confirm',undefined,503);
      app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(source.observed,operation.id);
      parse(await push(effects,[operation]));await close();await open();assert.deepEqual(app.store.operations(),[]);
      for(const id of ids) {
        const profile=master.itemProfiles[id],current=app.store.read(profile.table).data.find(row=>row[profile.idField]===id);
        if(profile.table==='UserGachaTicket') {
          parse(await push({[profile.table]:[{...current,dateList:[]}]}));
          await rejected('user_data/push',payload({[profile.table]:[current]}));
        }
      }
    }
    for(const key of ['gacha_ticket.normal','gacha_ticket.character_3']) for(const type of [1000,1001]) for(const cumulative of [100,max]) {
      now=1686794400;await fresh(`dated-prior-consumer-${key}-${type}-${cumulative}`);
      const itemId=master.items[key],before={userId:seed.userId,gachaTicketId:itemId,cumulativeAmount:cumulative,bookEntryState:127,signature:7,dateList:[{aquiredAt:now}]};
      replaceItem(itemId,before);const consumer=app.store.issueDraw([1011002001],{userGachaTicket:{...before,dateList:[]}},type);
      await rejected('adventure/stage/complete',battle(ordinaryId,`dated-prior-consumer-${key}-${type}-${cumulative}`,itemId),503);
      assert.deepEqual(app.store.operations(),[consumer],'An unresolved original lottery replacement stays intact');
    }
    // The common reward path also receives authored PVE rank items and Element loot.
    for(const type of ['pve','element']) for(const kind of ['numeric','dated']) for(const cumulative of kind==='dated'?[null,100,max-1,max]:[max-1,max]) {
      now=type==='element'?master.elementEventStages[66100000001].startAt:1790866800;await fresh(`${type}-${cumulative}-${kind}`);
      const stageId=type==='pve'?1120000904103:1260000101101,itemId=master.items[kind==='dated'?'gacha_ticket.normal':'status_board_item.special'];
      put('UserAdventureStage',[stageRow(stageId)]);
      if(cumulative===null) put('UserGachaTicket',app.store.read('UserGachaTicket').data.filter(row=>row.gachaTicketId!==itemId));
      else replaceItem(itemId,kind==='dated'?{userId:seed.userId,gachaTicketId:itemId,
        cumulativeAmount:cumulative,bookEntryState:127,signature:7,dateList:[{aquiredAt:now-master.lotteryTickets[itemId]-1}]}:
        rowFor(itemId,cumulative));
      let body=battle(stageId,`${type}-${cumulative}-${kind}`,itemId,type==='pve'?1:5);
      if(type==='pve') body=pveBattle(body);
      else body={...body,userElementEventScore:{totalDamage:1000,maxDamage:100,actionCount:7,defeat:true,turnCount:2,pcTotalDamage:50},adventureRecord:{continueCount:0}};
      const operation=parse(await send(`${type==='pve'?'pve':'element_event'}/stage/complete`,body)).operation;
      assert.equal(operation.type,type==='pve'?16000:25000);
      if(type==='pve') {
        assert(operation.parameters.rewardRanks.includes('s'));
        assert.equal(operation.parameters.gainedItems.find(row=>row.itemId===itemId).amount,1,'Rank prize is not duplicated in gainedItems');
        if(kind==='numeric') assert.equal(JSON.parse(app.store.db.prepare('SELECT stock_state FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,itemId).stock_state).amount,9);
      }
      const effects=allEffects(operation),profile=master.itemProfiles[itemId],
        originalCold={response:await send('user_data/confirm'),identity:sequence};
      assert.deepEqual(parse(originalCold.response).operations,[operation]);
      parse(await push({[profile.table]:[effects[profile.table].find(row=>row[profile.idField]===itemId)]}));
      await rejected('user_data/push',payload({},[operation]));
      await recover(operation,{...operation,parameters:{...operation.parameters,
        gainedItems:operation.parameters.gainedItems.filter(row=>row.itemId!==itemId),
        ...(type==='pve' && kind==='numeric'?{rewardRanks:operation.parameters.rewardRanks.filter(rank=>
          master.pveScores[stageId].rewards[rank].rewardType!==0 || master.items[master.pveScores[stageId].rewards[rank].rewardKey]!==itemId)}:{})}},originalCold);
      parse(await push(effects,[operation]));
      await close();await open();assert.deepEqual(app.store.operations(),[]);
    }
    // WRITTEN ONLY: synthetic provider shape over original16000/native ticket setters. The archived rank catalog has no dated rank rows.
    {
      const stageId=1120000904103,itemId=master.items['gacha_ticket.normal'],rank='s',wireAmount=3,rankAmount=2,
        reward={...master.pveScores[stageId].rewards[rank],rewardType:0,rewardKey:'gacha_ticket.normal',rewardAmount:rankAmount,threshold:0};
      fixtureMaster={...master,pveScores:{...master.pveScores,[stageId]:{...master.pveScores[stageId],rewards:{
        ...master.pveScores[stageId].rewards,[rank]:reward}}}};
      try {
        now=1790866800;await fresh('pve-repeated-dated-provider');put('UserAdventureStage',[stageRow(stageId)]);
        const before={userId:seed.userId,gachaTicketId:itemId,cumulativeAmount:100,bookEntryState:3,signature:7,
          dateList:[{aquiredAt:now-1}]};
        replaceItem(itemId,before);
        const body=pveBattle({...battle(stageId,'pve-repeated-dated-provider',itemId,wireAmount),
          adventureGainedItems:[{itemId,amount:wireAmount}]}),operation=parse(await send('pve/stage/complete',body)).operation,
          originalCold={response:await send('user_data/confirm'),identity:sequence},claim=app.store.db.prepare(
            'SELECT * FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,itemId),duration=master.lotteryTickets[itemId];
        assert(operation.parameters.rewardRanks.includes(rank));assert.equal(claim.cumulative_amount,before.cumulativeAmount+wireAmount+rankAmount);
        const partial={...before,cumulativeAmount:claim.cumulative_amount,signature:operation.signature,
          dateList:[...before.dateList,...Array.from({length:wireAmount},()=>({aquiredAt:now}))]};
        parse(await push({UserGachaTicket:[partial]}));
        const partialState=JSON.parse(app.store.db.prepare('SELECT gacha_state FROM pve_item_claim WHERE operation_id=? AND item_id=?')
          .get(operation.id,itemId).gacha_state);
        assert.equal(partialState.dateAdditions,wireAmount);assert.equal(partialState.observed,false,
          'A final counter/signature cannot hide missing dates from another original provider');
        await rejected('user_data/confirm',undefined,503);
        const full={...partial,dateList:[...partial.dateList,...Array.from({length:rankAmount},()=>({aquiredAt:now}))]};
        parse(await push({UserGachaTicket:[full]}));
        const expected={...operation,parameters:{...operation.parameters,
          gainedItems:operation.parameters.gainedItems.filter(row=>row.itemId!==itemId),
          rewardRanks:operation.parameters.rewardRanks.filter(key=>key!==rank)}};
        await recover(operation,expected,originalCold);
        const effects=allEffects(operation);effects.UserGachaTicket=[full];
        parse(await push(effects,[operation]));await close();await open();assert.deepEqual(app.store.operations(),[]);
        assert.equal(full.dateList.filter(row=>now<row.aquiredAt+duration).length,wireAmount+rankAmount+1);
      } finally { fixtureMaster=master; }
    }
    // WRITTEN ONLY: all22 original item-rank rows, not fabricated rank quantities or natural gameplay proof.
    for(const reward of rankItems) for(const providers of ['rank-only','rank-loot'])
      for(const variant of ['exact','crossing','saturated','near-full-stock','full-stock','spent-between','spent-first','exact-spent-first']) {
        now=1790866800;await fresh(`pve-rank-stock-${reward.stageId}-${providers}-${variant}`);
        const {stageId,itemId,rank}=reward,profile=master.itemProfiles[itemId],hasLoot=providers==='rank-loot',quantity=reward.amount+Number(hasLoot),
          before=rowFor(itemId,['exact','exact-spent-first'].includes(variant)?max-quantity:variant==='crossing'?max-1:max,
            variant==='near-full-stock'?max-1:variant==='full-stock'?max:7);
        put('UserAdventureStage',[stageRow(stageId)]);replaceItem(itemId,before);
        const body=pveBattle({...battle(stageId,`rank-stock-${providers}-${variant}`,itemId,1),
          adventureGainedItems:hasLoot?[{itemId,amount:1}]:[]}),
          operation=parse(await send('pve/stage/complete',body)).operation,
          originalCold={response:await send('user_data/confirm'),identity:sequence},
          claim=app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,itemId),
          initial=JSON.parse(claim.stock_state),allowance=initial.amount-initial.beforeAmount,
          needsAdditions=hasLoot && before.cumulativeAmount+quantity>claim.cumulative_amount;
        assert(operation.parameters.rewardRanks.includes(rank));assert.deepEqual(parse(originalCold.response).operations,[operation]);
        assert.equal(initial.amount,Math.min(max,before.amount+quantity),'Private stock target includes exactly the original rank and retained loot');
        const stageBefore=operation.parameters.UserAdventureStage[0],scorePrefix={...app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===stageId),
          currentScore:operation.parameters.finalScore,highScore:Math.max(stageBefore.highScore,operation.parameters.finalScore)};
        parse(await push({UserAdventureStage:[scorePrefix]}));await recover(operation,operation,originalCold);
        let native={...before,amount:Math.min(max,before.amount+reward.amount),
          cumulativeAmount:Math.min(max,before.cumulativeAmount+reward.amount),signature:operation.signature};
        if(['spent-first','exact-spent-first'].includes(variant)) native={...native,amount:before.amount,cumulativeAmount:claim.cumulative_amount};
        parse(await push({[profile.table]:[native]}));
        const pending=JSON.parse(app.store.db.prepare('SELECT stock_state FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,itemId).stock_state);
        assert.equal(pending.observed,native.cumulativeAmount===claim.cumulative_amount &&
          (!needsAdditions || pending.amountAdded===allowance),'The first shared capped nonce is not proof that all positive stock additions were saved');
        await rejected('user_data/push',payload({},[operation]));
        if(!pending.observed) {
          for(const [cold,body] of [['user_data/confirm',undefined],['user/login',undefined],['user_data/pull',{tables:[profile.table]}]])
            await rejected(cold,body,503);
          const retained=app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id).observed,
            forged=[...JSON.parse(retained),`item:${itemId}`].sort();
          app.store.db.prepare('UPDATE pve_item_claim SET stock_state=? WHERE operation_id=? AND item_id=?')
            .run(JSON.stringify({...pending,observed:true}),operation.id,itemId);
          app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(JSON.stringify(forged),operation.id);
          await rejected('user_data/confirm',undefined,503);
          app.store.db.prepare('UPDATE pve_item_claim SET stock_state=? WHERE operation_id=? AND item_id=?').run(JSON.stringify(pending),operation.id,itemId);
          app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(retained,operation.id);
        }
        if(variant==='spent-first' && hasLoot) {
          assert.equal(pending.amountAdded,0);assert.equal(pending.observed,false);
          continue; // No retained full-addition proof: do not manufacture stock to finish an ambiguous late first save.
        }
        if(variant==='spent-between') {
          native={...native,amount:native.amount-1};parse(await push({[profile.table]:[native]}));
        }
        if(hasLoot && variant!=='exact-spent-first') {
          native={...native,amount:Math.min(max,native.amount+1),cumulativeAmount:claim.cumulative_amount};
          if(!pending.observed) for(const table of ['profile','pve_item_claim','stage_delivery']) {
            app.store.db.exec(`CREATE TRIGGER pve_rank_gain_fail BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'rank gain rollback'); END`);
            await rejected('user_data/push',payload({[profile.table]:[native]}),503,false);app.store.db.exec('DROP TRIGGER pve_rank_gain_fail');
          }
          parse(await push({[profile.table]:[native]}));
        }
        const complete=JSON.parse(app.store.db.prepare('SELECT stock_state FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,itemId).stock_state);
        assert.equal(complete.observed,true);if(needsAdditions) assert.equal(complete.amountAdded,allowance);
        if(variant==='exact-spent-first') assert.equal(complete.amountAdded,0,'Unclamped full lifetime delta proves all gains even after spending before first save');
        const expected={...operation,parameters:{...operation.parameters,
          gainedItems:operation.parameters.gainedItems.filter(row=>row.itemId!==itemId),
          rewardRanks:operation.parameters.rewardRanks.filter(key=>key!==rank)}};
        await recover(operation,expected,originalCold);
        assert.deepEqual(expected.parameters.rewardRanks,operation.parameters.rewardRanks.filter(key=>master.pveScores[stageId].rewards[key].rewardType===1),
          'Server-credited Iris ranks remain untouched');
        const effects=allEffects(operation);effects[profile.table]=effects[profile.table].map(row=>row[profile.idField]===itemId?native:row);
        parse(await push(effects,[operation]));await close();await open();assert.deepEqual(app.store.operations(),[]);
        const rankClaim=app.store.db.prepare('SELECT * FROM pve_rank_claim WHERE operation_id=? AND rank=?').get(operation.id,rank);
        app.store.db.prepare('UPDATE pve_rank_claim SET reward_amount=? WHERE operation_id=? AND rank=?').run(rankClaim.reward_amount+1,operation.id,rank);
        await rejected('user_data/push',payload({[profile.table]:[native]}),503);
        app.store.db.prepare('UPDATE pve_rank_claim SET reward_amount=? WHERE operation_id=? AND rank=?').run(rankClaim.reward_amount,operation.id,rank);
        if(needsAdditions && allowance>0) {
          app.store.db.prepare('UPDATE pve_item_claim SET stock_state=? WHERE operation_id=? AND item_id=?')
            .run(JSON.stringify({...complete,amountAdded:allowance-1}),operation.id,itemId);
          await rejected('user_data/push',payload({[profile.table]:[native]}),503);
          app.store.db.prepare('UPDATE pve_item_claim SET stock_state=? WHERE operation_id=? AND item_id=?').run(JSON.stringify(complete),operation.id,itemId);
        }
      }
    for(const variant of ['exact','saturated','mixed-full-stock']) {
      now=1790866800;await fresh(`duplicate-bond-${variant}`);
      const stageId=1010000108101,pcId=master.pcs[master.stages[stageId].rewardKey],itemId=master.bonds[pcId],
        owned={...app.store.read('UserPC').data[0],pcId,joiningState:1,currentJobIndex:master.pcProfiles[pcId].jobIds.length,
          totalExp:100,limitbreakCount:2,heroSublimateLevel:0,isUnlockedHeroSublimate:false},
        boards={userId:seed.userId,pcId,pcJobs:[{pcJobId:master.pcProfiles[pcId].jobIds[0],abilityPanelState:0x82000001,abilityPanels:[],signature:0}],signature:0};
      put('UserPC',[...app.store.read('UserPC').data.filter(row=>row.pcId!==pcId),owned]);
      put('UserPCJobSet',[...app.store.read('UserPCJobSet').data.filter(row=>row.pcId!==pcId),boards]);
      put('UserCharacter',rewardCharacterFixture(app.store.read('UserCharacter').data,[pcId]));
      put('UserCostume',rewardCostumeFixture(app.store.read('UserCostume').data,[pcId]));
      put('UserAdventureStage',[...rewardUnitStoryFixture(app.store.read('UserAdventureStage').data,[pcId])
        .filter(row=>row.adventureStageId!==stageId),stageRow(stageId)]);
      replaceItem(itemId,rowFor(itemId,variant==='exact'?max-1:max,variant==='mixed-full-stock'?max:7));
      const loot=variant==='mixed-full-stock'?[{itemId,amount:2}]:[],
        body={...battle(stageId,`duplicate-bond-${variant}`,itemId),adventureGainedItems:loot},
        operation=parse(await send('adventure/stage/complete',body)).operation,
        target=app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,itemId),
        capture=JSON.parse(target.stock_state);
      assert.deepEqual(operation.parameters.gainedPCs,[pcId]);assert.deepEqual(operation.parameters.gainedItems,loot);
      assert.equal(capture.amount,variant==='mixed-full-stock'?max:8,'Duplicate quantity1 remains separate from telemetry');
      await rejected('user_data/push',payload({},[operation]));
      const effects=allEffects(operation);parse(await push({UserLimitBreakItem:effects.UserLimitBreakItem}));
      await close();await open();await rejected('adventure/stage/complete',body,503);
      parse(await push(effects,[operation]));assert.equal(app.store.read('UserPC').data.find(row=>row.pcId===pcId).totalExp,owned.totalExp);
      const source=app.store.db.prepare('SELECT pc_before,pc_targets,observed FROM stage_delivery WHERE operation_id=?').get(operation.id);
      for(const [column,value] of [['pc_before','[]'],['pc_targets','null'],['observed','[]']]) {
        app.store.db.prepare(`UPDATE stage_delivery SET ${column}=? WHERE operation_id=?`).run(value,operation.id);
        await rejected('user_data/push',payload({UserLimitBreakItem:effects.UserLimitBreakItem}),503);
        app.store.db.prepare(`UPDATE stage_delivery SET ${column}=? WHERE operation_id=?`).run(source[column],operation.id);
      }
    }
    // A real local donation establishes the ceiling; synthetic initial funds are not earning proof.
    for(const variant of ['credit','exact-no-credit','stock-cap']) for(const order of ['stock-first','spent-first']) {
      now=1790866800;await fresh(`valis-floor-${variant}-${order}`);
      const funded=rowFor(valis,variant==='exact-no-credit'?max-10005:max,variant==='stock-cap'?2000000000:1000000);replaceItem(valis,funded);
      put('UserProfile',[{...app.store.read('UserProfile').data[0],familiaId:1,familiaName:'Solo'}]);
      app.store.db.prepare(`INSERT INTO local_familia(id,owner_id,settings,joined_at,contribution_point,valis,skill_point,
        creation_operation_id,creation_valis_before,creation_cumulative_before) VALUES(1,?,?,?,?,?,?,?,?,?)`)
        .run(seed.userId,JSON.stringify({name:'Solo',description:'Offline',godId:20000001,style:21000001,subStyle:0,activeTime:22000001,
          subActiveTime:22000002,requireApproval:false}),now,850,0,0,999,0,0);
      const donation=parse(await send('familia/donate/valis',{familiaId:1,amounts:[{donateValisId:24000001,amount:1}]})).operations[0],
        charged={...funded,amount:funded.amount-donation.parameters.consumedValis},
        counters=Object.keys(master.familiaValisDonations).map(Number).map(donationId=>({userId:seed.userId,donationId,
          count:donationId===24000001?1:0,lastDonatedAt:donationId===24000001?now:0}));
      parse(await push({UserCurrency:[charged],UserFamiliaValisDonation:counters},[donation]));
      const floor=app.store.familiaValisSpendingFloor(),body=battle(ordinaryId,`valis-floor-${variant}-${order}`,valis),
        operation=parse(await send('adventure/stage/complete',body)).operation,
        claim=app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,valis),
        stock=JSON.parse(claim.stock_state),credit=JSON.parse(claim.valis_state),final={...charged,amount:stock.amount,cumulativeAmount:max,signature:operation.signature};
      assert.equal(credit?.credit ?? 0,variant==='exact-no-credit'?0:variant==='stock-cap'?100:10005);
      assert.equal(app.store.familiaValisSpendingFloor().ceiling,floor.ceiling);
      if(order==='stock-first') {
        parse(await push({UserCurrency:[{...charged,amount:stock.amount}]}));
        assert.equal(app.store.familiaValisSpendingFloor().ceiling,floor.ceiling,'A stock prefix grants no permanent credit');
      }
      const effects=allEffects(operation);effects.UserCurrency=[{...final,amount:order==='spent-first'?0:final.amount}];
      for(const target of ['pve_item_claim','familia_valis_spending_floor']) {
        app.store.db.exec(`CREATE TRIGGER stage_valis_fail BEFORE UPDATE ON ${target} BEGIN SELECT RAISE(ABORT,'stage Valis rollback'); END`);
        await rejected('user_data/push',payload(effects,[operation]),503,false);app.store.db.exec('DROP TRIGGER stage_valis_fail');
      }
      parse(await push(effects,[operation]));await close();await open();
      assert.equal(app.store.familiaValisSpendingFloor().ceiling,floor.ceiling+(credit?.credit ?? 0));
      assert.equal(app.store.familiaValisSpendingFloor().source_kind,credit?'stage':'donation');
      await rejected('user_data/push',payload({UserCurrency:[{...final,amount:final.amount+1}]}));
      if(variant==='stock-cap' && order==='stock-first') {
        const oldFloor=app.store.familiaValisSpendingFloor(),repeat=parse(await send('adventure/stage/complete',{...body,token:`${body.token}-full`})).operation,
          repeatClaim=app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(repeat.id,valis);
        assert.equal(repeatClaim.valis_state,null,'Already-full stock grants no new spending credit');
        parse(await push(allEffects(repeat),[repeat]));assert.deepEqual(app.store.familiaValisSpendingFloor(),oldFloor);
      }
      if(credit) {
        app.store.db.prepare('UPDATE pve_item_claim SET valis_state=NULL WHERE operation_id=? AND item_id=?').run(operation.id,valis);
        await rejected('user_data/push',payload({UserCurrency:[{...final,amount:0}]}),503);
      }
    }
    now=1790866800;await fresh('signed-valis-overflow');replaceItem(valis,rowFor(valis,max,2000000000));
    await rejected('adventure/stage/complete',battle(ordinaryId,'signed-valis-overflow',valis,200000000));
    // Old nullable receipts stay unknown after additive source-only DDL, not silently repaired.
    now=1790866800;await fresh('legacy-stage-schema');
    const itemId=master.items['status_board_item.special'];replaceItem(itemId,rowFor(itemId,max));
    const body=battle(ordinaryId,'legacy-stage-schema',itemId),operation=parse(await send('adventure/stage/complete',body)).operation,
      claims=app.store.db.prepare('SELECT * FROM pve_item_claim ORDER BY operation_id,item_id').all();await close();
    const legacy=new DatabaseSync(database);
    legacy.exec(`DROP TABLE pve_item_claim;CREATE TABLE pve_item_claim(operation_id INTEGER NOT NULL,item_id INTEGER NOT NULL,
      table_name TEXT NOT NULL,id_field TEXT NOT NULL,cumulative_amount INTEGER NOT NULL CHECK(cumulative_amount BETWEEN 1 AND 999999999),PRIMARY KEY(operation_id,item_id))`);
    for(const row of claims) legacy.prepare('INSERT INTO pve_item_claim VALUES(?,?,?,?,?)').run(row.operation_id,row.item_id,row.table_name,row.id_field,row.cumulative_amount);
    legacy.close();await open();
    assert.equal(app.store.db.prepare('SELECT cap_version FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,itemId).cap_version,0);
    await rejected('adventure/stage/complete',body,503);
    assert.deepEqual(app.store.operations(),[operation]);
  } finally {
    await close();assert.equal(path.dirname(fs.realpathSync(directory)),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-stage-caps-'));fs.rmSync(directory,{recursive:true,force:true});
  }
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
