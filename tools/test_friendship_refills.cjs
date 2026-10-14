'use strict';

// Disposable synthetic saves check the listener contract,
// not native CP earning, computed maxima, signatures, callback order or UI.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE,pcInitialStatInput}=require('./danmemore_server.cjs');
const {request,friendshipUnlockFixture,friendshipRefillFixture,stageXpFixture}=require('./test_danmemore_server.cjs');
const {itemDeltas}=require('./test_friendship_rewards.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex'),fields=['friendship','friendshipAis','friendshipLef'],now=1790866800;

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-cp-refills-'));
  let app,database,port,sequence=0,wall=now,eventDate=null,lastRejection='';
  const open=async()=>{
    app=createServer({database,seed,master,eventDate,wallNowSeconds:()=>wall,
      log:line=>{const row=JSON.parse(line);if(row.event==='rejected')lastRejection=row.reason;}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async()=>{if(app){await app.close();app=null;}};
  const fresh=async(name,at=now)=>{
    await close();database=path.join(directory,`${name}.sqlite`);wall=now;
    eventDate=at===now?null:new Date(at*1000).toISOString();await open();
  };
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const send=(action,body)=>{lastRejection='';return request(port,++sequence,body,String(sequence),action);};
  const parse=reply=>{assert.equal(reply.status,200,lastRejection||reply.body.toString().slice(0,300));return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const reject=async(pending,status,before=snapshot(),structured=true)=>{
    const reply=await pending;assert.equal(reply.status,status,lastRejection||reply.body.toString().slice(0,300));assert.equal(snapshot(),before);
    if(status===503 && structured) assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const push=(putItems={},operations=[],deleteItems={})=>send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name]??[])]))},
    deltas:Object.keys(putItems).length||Object.keys(deleteItems).length ? [{signature:0,trigger:'FriendshipComplete',putItems,deleteItems}] : [],
    operations:operations.map(row=>({id:row.id,verifier:row.token}))});
  const characterId=101000001,pcId=1011001001,secondId=1011001002,
    unrelatedId=Number(Object.keys(master.pcProfiles).find(id=>master.pcProfiles[id].characterId===101000002));
  const setup=hero=>{
    const base=seed.data.UserPC[0];
    put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,heroType:hero})));
    put('UserCharacter',[{...seed.data.UserCharacter[0],characterId,friendship:0,friendshipAis:0,friendshipLef:0}]);
    put('UserPC',[{...base,hp:7,mp:3},{...base,pcId:secondId,joiningState:0,hp:8,mp:2},
      {...base,pcId:unrelatedId,hp:9,mp:4}]);
    put('UserPCJobSet',[]);put('UserEquipment',[]);put('UserGuestEvent',[]);
    put('UserCpItem',[{userId:seed.userId,cpItemId:215000001,amount:1,cumulativeAmount:1,reservedAmount:0,bookEntryState:3,signature:0}]);
    put('UserAdventureStage',app.store.read('UserAdventureStage').data.map(row=>
      [2,3].includes(master.stages[row.adventureStageId]?.adventureType)?{...row,state:0}:row));
  };
  const issue=async(hero,source='plain',points=122,id=characterId)=>{
    if(source==='item') {
      const factor=master.characters[id].favoriteItems.find(([itemId])=>itemId===215000001)?.[1]??1;
      points=Math.trunc(Math.fround(Math.fround(factor*Math.fround(master.cpItems[215000001]))));
    }
    const state={characterId:id,userHeroType:hero,friendship:points,
      friendshipLv:master.characters[id].levels.findLast(([,threshold])=>threshold<=points)[0]},
      body=source==='stage' ? {adventureStageId:1010000101101,token:'refill',adventureStageTaskIds:[],adventureGainedItems:[],
        friendshipStates:[state],secretMissionCompleted:false,isEnemyAnnihilated:true,
        adventureRecord:{continueCount:0,deathCount:0,turnCount:3}} :
        {friendshipStates:[state],...(source==='item'?{itemId:215000001,itemAmount:1}:{})},
      reply=parse(await send(source==='stage'?'adventure/stage/complete':'character/friendship/complete',body)),
      operation=reply.operation??reply.operations[0],table=operation.type===5000?'stage_delivery':'friendship_reward_claim',
      raw=app.store.db.prepare(`SELECT friendship_unlocks FROM ${table} WHERE operation_id=?`).get(operation.id).friendship_unlocks;
    return {operation,table,raw,capture:JSON.parse(raw),state};
  };
  const otherSaves=issued=>{
    const {operation,state}=issued,character=app.store.read('UserCharacter').data.find(row=>row.characterId===state.characterId);
    let result={...(operation.type===11000?itemDeltas(app.store,operation):{}),UserCharacter:[{...character,[fields[state.userHeroType]]:state.friendship}]};
    if(operation.type===5000) {
      for(const target of app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(operation.id)) {
        const before=app.store.read(target.table_name).data.find(row=>row[target.id_field]===target.item_id);
        (result[target.table_name]??=[]).push({...before,userId:seed.userId,[target.id_field]:target.item_id,signature:0,
          bookEntryState:3,amount:(before?.amount??0)+target.cumulative_amount-(before?.cumulativeAmount??0),
          cumulativeAmount:target.cumulative_amount});
      }
      const stage=operation.parameters.UserAdventureStage[0];
      result.UserAdventureStage=[{...stage,state:4,cumulativeClearCount:stage.cumulativeClearCount+1,
        firstCompleteDateTime:stage.firstCompleteDateTime||now,lastCompleteDateTime:now}];
      result=stageXpFixture(app.store,result,[operation]);
    } else result=friendshipUnlockFixture(app.store,result,[operation]);
    delete result.UserPC; // Deliberately absent; ACK convenience must not hide this provider.
    return result;
  };
  try {
    await fresh('positive-floor-migration');setup(0);
    const earned=await issue(0);
    parse(await push({...otherSaves(earned),...friendshipRefillFixture(app.store,[earned.operation])},[earned.operation]));
    await close();await open(); // Settle existing starter/legacy bootstrap first.
    const preserved=snapshot(),positiveFloors=app.store.db.prepare('SELECT * FROM stage_friendship_floor').all();
    // Disposable reconstruction of the former positive-only disk schema.
    app.store.db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE stage_friendship_floor RENAME TO fixture_zero_floor;
      CREATE TABLE stage_friendship_floor (character_id INTEGER NOT NULL,
        user_hero_type INTEGER NOT NULL CHECK(user_hero_type BETWEEN 0 AND 2),
        friendship INTEGER NOT NULL CHECK(friendship BETWEEN 1 AND 2000000000),
        PRIMARY KEY(character_id,user_hero_type));
      INSERT INTO stage_friendship_floor SELECT * FROM fixture_zero_floor;
      DROP TABLE fixture_zero_floor; COMMIT;`);
    await close();await open();
    assert.deepEqual(app.store.db.prepare('SELECT * FROM stage_friendship_floor_positive_backup').all(),positiveFloors);
    const tableHashes=value=>Object.fromEntries(JSON.parse(value).filter(([name])=>name!=='stage_friendship_floor_positive_backup').map(([name,rows])=>[name,md5(rows)]));
    assert.deepEqual(tableHashes(snapshot()),tableHashes(preserved),
      'Schema migration preserves every original table row, profile, queue and receipt');
    const zero=await issue(0,'plain',0,101000002);
    parse(await push({UserCharacter:[{userId:0,characterId:101000002,characterState:1,
      friendship:0,friendshipAis:0,friendshipLef:0,substitutedPcSpineId:0,signature:0xffffffff}],
      ...itemDeltas(app.store,zero.operation)},[zero.operation]));
    assert.equal(app.store.db.prepare('SELECT friendship FROM stage_friendship_floor WHERE character_id=101000002 AND user_hero_type=0').get().friendship,0);
    const migrated=snapshot();await close();await open();assert.equal(snapshot(),migrated,'Migration and zero-CP ACK survive restart without reapplying');
    for(const source of ['plain','item','stage']) for(const hero of [0,1,2]) for(const constructorFirst of [true,false]) {
      await fresh(`lazy-character-${source}-${hero}-${constructorFirst}`);setup(hero);put('UserCharacter',[]);
      const initial={userId:0,characterId,characterState:1,friendship:0,friendshipAis:0,friendshipLef:0,
        substitutedPcSpineId:0,signature:0xffffffff},before=app.store.read('UserCharacter'),issued=await issue(hero,source),
        {operation,capture,state}=issued,receipt=app.store.db.prepare(`SELECT friendship_before FROM ${issued.table} WHERE operation_id=?`).get(operation.id),
        friendship=JSON.parse(receipt.friendship_before),health=friendshipRefillFixture(app.store,[operation]),
        rest={...otherSaves(issued),UserCharacter:[{...initial,[fields[hero]]:state.friendship}]};
      assert.deepEqual(app.store.read('UserCharacter'),before,'Issuance never creates or credits a native character row');
      assert.equal(friendship[0].initial,true);assert.equal(friendship[0].before,0);
      assert.deepEqual(capture.refills.characters,[{userId:0,characterId,friendship:0,friendshipAis:0,friendshipLef:0,initial:true}]);
      assert.equal(operation.parameters.friendshipStates[0].initial,undefined,'Private initializer role is not native wire data');
      const {UserCharacter,...withoutCharacter}=rest;
      await reject(push({...withoutCharacter,...health},[operation]),400);
      for(const damage of [{userId:seed.userId},{characterState:0},{friendshipAis:-1},{friendshipLef:'0'},
        {[fields[(hero+1)%3]]:1}])
        await reject(push({...rest,UserCharacter:[{...rest.UserCharacter[0],...damage}],...health},[operation]),400);
      const lost=structuredClone(friendship);delete lost[0].initial;
      app.store.db.prepare(`UPDATE ${issued.table} SET friendship_before=? WHERE operation_id=?`).run(JSON.stringify(lost),operation.id);
      await reject(send('user_data/confirm'),503);
      app.store.db.prepare(`UPDATE ${issued.table} SET friendship_before=? WHERE operation_id=?`).run(receipt.friendship_before,operation.id);
      const first=constructorFirst ? {UserCharacter:[initial]} : {UserPC:health.UserPC.map(row=>
        ({...row,mp:app.store.read('UserPC').data.find(before=>before.pcId===row.pcId).mp}))};
      app.store.db.exec(`CREATE TRIGGER fail_lazy_character BEFORE UPDATE ON ${issued.table} BEGIN SELECT RAISE(ABORT,'lazy character observation rollback'); END`);
      await reject(push(first),503,snapshot(),false);app.store.db.exec('DROP TRIGGER fail_lazy_character');
      parse(await push(first));await close();await open();
      if(source==='stage') {
        const before=snapshot();assert.deepEqual(app.store.stageColdRecovery(operation),operation);assert.equal(snapshot(),before);
        assert.deepEqual(parse(await send('user_data/confirm')).operations,[operation]);parse(await send('user/login'));
      } else await reject(send('user_data/confirm'),503);
      await reject(push({},[operation]),400);
      if(constructorFirst) {
        const observed=JSON.parse(app.store.db.prepare(`SELECT observed FROM ${issued.table} WHERE operation_id=?`).get(operation.id).observed);
        assert(observed.includes(`cp-character-row:${characterId}`));
        await reject(push({},[],{UserCharacter:[{characterId}]}),400);
      }
      for(const table of ['stage_friendship_floor','operation_done','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_lazy_ack BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'lazy CP ACK rollback'); END`);
        await reject(push({...rest,...health},[operation]),503,snapshot(),false);app.store.db.exec('DROP TRIGGER fail_lazy_ack');
      }
      parse(await push({...rest,...health},[operation]));await close();await open();
      await reject(push({},[],{UserCharacter:[{characterId}]}),400);
      const saved=app.store.read('UserCharacter');put('UserCharacter',[]);
      try {
        await reject(send('user_data/pull',{tables:['UserCharacter']}),503);await close();await open();
        await reject(send('user_data/pull',{tables:['UserCharacter']}),503);await reject(send('user_data/confirm'),503);
        assert.equal(app.store.db.prepare('SELECT friendship FROM stage_friendship_floor WHERE character_id=? AND user_hero_type=?')
          .get(characterId,hero).friendship,state.friendship,'Missing native rows never erase acknowledged CP');
      } finally {app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(saved.data),saved.token,'UserCharacter');}
    }
    for(const points of [0,5]) for(const hero of [0,1,2]) {
      await fresh(`lazy-character-no-refill-${points}-${hero}`);setup(hero);put('UserCharacter',[]);
      const issued=await issue(hero,'plain',points),{operation,state}=issued,
        initial={userId:0,characterId,characterState:1,friendship:0,friendshipAis:0,friendshipLef:0,
          substitutedPcSpineId:0,signature:0xffffffff};
      assert.equal(issued.capture.refills,undefined,'Same-level CP does not invent a refill');
      await reject(push({},[operation]),400);
      parse(await push({UserCharacter:[{...initial,[fields[hero]]:points}],...itemDeltas(app.store,operation)},[operation]));
      assert.equal(app.store.db.prepare('SELECT friendship FROM stage_friendship_floor WHERE character_id=? AND user_hero_type=?')
        .get(characterId,hero).friendship,state.friendship,'Zero CP still preserves the real initialized row');
      await close();await open();await reject(push({},[],{UserCharacter:[{characterId}]}),400);
    }
    await fresh('lost-acquired-character');setup(0);
    put('UserPCJobSet',[{userId:seed.userId,pcId,pcJobs:[],signature:0}]);
    const unitFloor={...app.store.giftPcTarget({pcId,extra:false,pcLimitBreakCount:0,pcHeroSublimateCount:0}),
      character:{characterId,userId:0,present:false,beforeState:1,state:2,friendship:[0,0,0]}};
    app.store.db.prepare('INSERT INTO gift_pc_floor(pc_id,targets) VALUES(?,?)').run(pcId,JSON.stringify(unitFloor));
    put('UserCharacter',[]);
    await reject(send('character/friendship/complete',{friendshipStates:[{
      characterId,userHeroType:0,friendship:5,friendshipLv:master.characters[characterId].levels.findLast(([,points])=>points<=5)[0]}]}),503);
    for(const source of ['plain','item','stage']) for(const hero of [0,1,2]) for(const refillFirst of [false,true]) {
      await fresh(`${source}-${hero}-${refillFirst}`);setup(hero);
      const original=app.store.read('UserPC'),pull={tables:['UserPC','UserPCJobSet','UserEquipment']};
      assert.equal((await send('user_data/pull',pull)).status,200);const oldPull=sequence,issued=await issue(hero,source),
        {operation,capture}=issued,targets=capture.refills.targets,health=friendshipRefillFixture(app.store,[operation]);
      assert.deepEqual(targets.map(row=>row.pcId),[pcId,secondId],'All saved matching PCs, including unjoined variant');
      assert(targets.every(row=>row.hpRequired&&row.mpRequired));assert.deepEqual(app.store.read('UserPC'),original,'No refill/signature precredit');
      const hp={UserPC:health.UserPC.map(row=>({...row,mp:original.data.find(pc=>pc.pcId===row.pcId).mp}))},rest=otherSaves(issued);
      await reject(push(rest,[operation]),400);await reject(push({},[operation]),400);
      parse(await push(refillFirst?hp:rest));await close();await open();
      await reject(push({},[operation]),400);
      if(source==='stage' && refillFirst) {
        const before=snapshot();assert.deepEqual(app.store.stageColdRecovery(operation),operation);assert.equal(snapshot(),before);
        assert.deepEqual(parse(await send('user_data/confirm')).operations,[operation]);parse(await send('user/login'));
      } else await reject(send('user_data/confirm'),503);
      if(refillFirst) {
        const observed=JSON.parse(app.store.db.prepare(`SELECT observed FROM ${issued.table} WHERE operation_id=?`).get(operation.id).observed);
        assert(observed.includes(`cp-hp:${pcId}`));assert(!observed.includes(`cp-mp:${pcId}`));
        await reject(push({UserPC:[original.data[0]]}),400);
      }
      parse(await push(refillFirst?rest:hp));
      await reject(push({},[operation]),400);
      await reject(push({},[],{UserPC:[{pcId:secondId}]}),400);
      await reject(push({UserPC:[{...health.UserPC[0],totalExp:1}]}),400);
      await reject(push({UserCharacter:[{...app.store.read('UserCharacter').data[0],[fields[(hero+1)%3]]:122}]}),400);
      parse(await push(health));await close();await open();
      app.store.db.exec("CREATE TRIGGER fail_refill_ack BEFORE INSERT ON operation_done BEGIN SELECT RAISE(ABORT,'refill ACK rollback'); END");
      await reject(push({},[operation]),503,snapshot(),false);app.store.db.exec('DROP TRIGGER fail_refill_ack');
      parse(await push({},[operation]));await close();await open();
      assert.deepEqual(app.store.read('UserPC').data.find(row=>row.pcId===unrelatedId),original.data[2]);
      const damage={...app.store.read('UserPC').data.find(row=>row.pcId===pcId),hp:5,mp:1};
      parse(await push({UserPC:[damage]}));assert.deepEqual(app.store.read('UserPC').data.find(row=>row.pcId===pcId),damage,'No permanent HP/MP floor');
      await reject(request(port,oldPull,pull,String(oldPull),'user_data/pull'),503);
      assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    }
    await fresh('same-level');setup(0);const unchanged=await issue(0,'plain',5);
    assert(!Object.hasOwn(unchanged.capture,'refills'));parse(await push(otherSaves(unchanged),[unchanged.operation]));
    await fresh('capture-corruption');setup(0);const pending=await issue(0),refills=pending.capture.refills;
    for(const corrupt of [undefined,{...refills,catalogHash:'old'}, {...refills,targets:[]},
      {...refills,inputs:[...refills.inputs,refills.inputs[0]]}]) {
      app.store.db.prepare(`UPDATE ${pending.table} SET friendship_unlocks=? WHERE operation_id=?`)
        .run(JSON.stringify({...pending.capture,refills:corrupt}),pending.operation.id);
      await reject(send('user_data/confirm'),503);
      app.store.db.prepare(`UPDATE ${pending.table} SET friendship_unlocks=? WHERE operation_id=?`).run(pending.raw,pending.operation.id);
    }
    for(const alreadyMax of [['hp'],['mp'],['hp','mp']]) {
      await fresh(`unchanged-${alreadyMax.join('-')}`);setup(0);
      put('UserPC',app.store.read('UserPC').data.map(row=>{
        const target=refills.targets.find(target=>target.pcId===row.pcId);
        return target?{...row,...Object.fromEntries(alreadyMax.map(field=>[field,target[field]]))}:row;
      }));
      const issued=await issue(0),health=friendshipRefillFixture(app.store,[issued.operation]);
      assert(issued.capture.refills.targets.every(target=>
        target.hpRequired===!alreadyMax.includes('hp')&&target.mpRequired===!alreadyMax.includes('mp')));
      if(alreadyMax.length===2) assert.deepEqual(health,{},'No dirty health row when both maxima are unchanged');
      parse(await push({...otherSaves(issued),...health},[issued.operation]));
    }
    // Existing saved guests only. These Bell-shaped synthetic row shells do
    // NOT prove native guest acquisition, signatures, EXP earning or lifecycle.
    const guestSetup=(guest,hero,stageId=0,totalExp=0)=>{
      setup(hero);
      const id=master.pcProfiles[guest.pcId].characterId,ordinaryId=Number(Object.keys(master.pcProfiles)
        .find(pcId=>master.pcProfiles[pcId].characterId===id&&!master.pcGuests.some(row=>row.pcId===Number(pcId)))),
        character={...seed.data.UserCharacter[0],characterId:id,friendship:0,friendshipAis:0,friendshipLef:0};
      put('UserCharacter',[character]);
      put('UserPC',[guest.pcId,ordinaryId].map(pcId=>({...seed.data.UserPC[0],...pcInitialStatInput(pcId,master),
        joiningState:0,hp:7,mp:3})));
      put('UserGuestEvent',[{userId:0,pcId:guest.pcId,totalExp}]);
      put('UserAdventureState',[{...seed.data.UserAdventureState[0],userId:0,stageId}]);
      return {id,ordinaryId,points:master.characters[id].levels[1][1]};
    };
    // WRITTEN ONLY:18 stage cold cases; six new CP-first pending-fanout cases must still check guest eligibility.
    for(const hero of [0,1,2]) for(const originallyEligible of [false,true]) for(const closed of [false,true,'pending']) {
      const guest=master.pcGuests[0],stageId=1010000101103,override=1100000103101;
      await fresh(`stage-guest-cold-${hero}-${originallyEligible}-${closed}`,guest.endAt);
      const context=guestSetup(guest,hero,originallyEligible?override:0),rows=app.store.read('UserAdventureStage').data,
        before=rows.find(row=>row.adventureStageId===stageId) ?? seed.data.UserAdventureStage[0],
        stage={...before,userId:seed.userId,adventureStageId:stageId,state:1,cumulativeClearCount:0,dailyClearCount:0,
          firstCompleteDateTime:0,lastCompleteDateTime:0,token:'',tasks:Object.entries(master.stageTasks)
            .filter(([,task])=>task.stageId===stageId).map(([id])=>({adventureStageTaskId:Number(id),state:0}))},
        state={characterId:context.id,userHeroType:hero,friendship:context.points,friendshipLv:2};
      assert.equal(master.stageExperience[stageId],0,'Original zero-EXP scene isolates guest scope without a fabricated XP party');
      put('UserAdventureStage',rows.filter(row=>row.adventureStageId!==stageId).concat(stage));
      const operation=parse(await send('adventure/stage/complete',{adventureStageId:stageId,token:`guest-cold-${hero}-${originallyEligible}-${closed}`,
        adventureStageTaskIds:[],adventureGainedItems:[],friendshipStates:[state],secretMissionCompleted:false,isEnemyAnnihilated:true,
        adventureRecord:{continueCount:0,deathCount:0,turnCount:3}})).operation,
        raw=app.store.db.prepare('SELECT friendship_unlocks FROM stage_delivery WHERE operation_id=?').get(operation.id).friendship_unlocks,
        capture=JSON.parse(raw),issued={operation,table:'stage_delivery',raw,capture,state},
        original=app.store.read('UserPC').data,levelSaves=friendshipUnlockFixture(app.store,{},[operation]),
        selected=originallyEligible?guest.pcId:context.ordinaryId,
        character={...app.store.read('UserCharacter').data.find(row=>row.characterId===context.id),[fields[hero]]:context.points},
        expected=closed==='pending'?{...operation,parameters:{...operation.parameters,friendshipStates:
          operation.parameters.friendshipStates.map(row=>({...row,offlineStageCpLevelPending:1}))}}:operation,
        first=closed==='pending'?{UserCharacter:[character]}:closed?{...levelSaves,UserCharacter:[character]}:{UserPC:[{
          ...levelSaves.UserPC.find(row=>row.pcId===selected),mp:original.find(row=>row.pcId===selected).mp}]};
      assert.equal(capture.refills.targets.find(row=>row.pcId===guest.pcId).eligible,originallyEligible);
      const old=parse(await send('user_data/confirm')),oldIdentity=sequence;assert.deepEqual(old.operations,[operation]);
      parse(await push(first));
      const pure=snapshot();assert.deepEqual(app.store.stageColdRecovery(operation),expected);assert.equal(snapshot(),pure);
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[expected]);
      if(closed===true && !originallyEligible) {
        const row=app.store.read('UserPC').data.find(row=>row.pcId===guest.pcId);
        parse(await push({UserPC:[{...row,hp:2,mp:1}]}));
      }
      put('UserAdventureState',[{...seed.data.UserAdventureState[0],userId:0,stageId:originallyEligible?0:override}]);
      await close();await open();
      if(closed===true) {
        const before=snapshot();assert.deepEqual(app.store.stageColdRecovery(operation),operation);assert.equal(snapshot(),before);
        assert.deepEqual(parse(await request(port,oldIdentity,undefined,String(oldIdentity),'user_data/confirm')).operations,[operation]);
        assert.deepEqual(parse(await send('user_data/confirm')).operations,[operation]);parse(await send('user/login'));
      } else {
        await reject(send('user_data/confirm'),503);
        await reject(request(port,oldIdentity,undefined,String(oldIdentity),'user_data/confirm'),503);
        await reject(send('user/login'),503);
      }
      if(closed==='pending') {
        put('UserAdventureState',[{...seed.data.UserAdventureState[0],userId:0,stageId:originallyEligible?override:0}]);
        const before=snapshot();assert.deepEqual(app.store.stageColdRecovery(operation),expected);assert.equal(snapshot(),before);
        assert.deepEqual(parse(await request(port,oldIdentity,undefined,String(oldIdentity),'user_data/confirm')).operations,[expected]);
      }
      await reject(push({},[operation]),400);
      const rest=otherSaves(issued);
      rest.UserAdventureStage=rest.UserAdventureStage.map(row=>row.adventureStageId===stageId?
        {...row,firstCompleteDateTime:guest.endAt,lastCompleteDateTime:guest.endAt}:row);
      parse(await push({...rest,...friendshipRefillFixture(app.store,[operation])},[operation]));await close();await open();
      assert(!app.store.operations().some(row=>row.id===operation.id));
      if(closed===true && !originallyEligible) {
        const row=app.store.read('UserPC').data.find(row=>row.pcId===guest.pcId);assert.equal(row.hp,2);assert.equal(row.mp,1);
      }
    }
    for(const guest of master.pcGuests) for(const hero of [0,1,2]) for(const [at,stageId] of [
      [guest.startAt-1,0],[guest.startAt,0],[guest.endAt-1,0],[guest.endAt,0],
      [guest.startAt-1,-1],[guest.endAt,-1],
      [guest.startAt-1,1100000103101],[guest.endAt,1100000103101]]) {
      await fresh(`guest-${guest.pcId}-${hero}-${at}-${stageId}`,at);
      const {id,ordinaryId,points}=guestSetup(guest,hero,stageId),before=app.store.read('UserPC'),issued=await issue(hero,'plain',points,id),
        capture=issued.capture.refills,target=capture.targets.find(row=>row.pcId===guest.pcId),
        eligible=stageId>0||at>=guest.startAt&&at<guest.endAt,health=friendshipRefillFixture(app.store,[issued.operation]),
        rest=otherSaves(issued),refillFirst=hero===1;
      assert.deepEqual(capture.guestRuntime,{at,stageId});assert.equal(target.eligible,eligible);
      assert.deepEqual(capture.inputs.map(row=>row.pc.pcId),[guest.pcId,ordinaryId].sort((a,b)=>a-b));
      assert.deepEqual(app.store.read('UserPC'),before,'No guest health/signature precredit');
      assert.equal(Boolean(health.UserPC?.some(row=>row.pcId===guest.pcId)),eligible);
      assert(health.UserPC?.some(row=>row.pcId===ordinaryId),'Inactive guest must not cancel ordinary sibling refill');
      await reject(push(rest,[issued.operation]),400);
      const hp={UserPC:health.UserPC.map(row=>({...row,mp:3}))};
      parse(await push(refillFirst?hp:rest));await close();await open();
      await reject(push({},[issued.operation]),400);
      parse(await push(refillFirst?rest:hp));await reject(push({},[issued.operation]),400);
      await reject(push({},[],{UserPC:[{pcId:guest.pcId}]}),400);
      await reject(push({},[],{UserGuestEvent:[{pcId:guest.pcId}]}),400);
      // Once native effects are saved, scope stays pinned even after the
      // original window/adventure override changes; it is never recaptured.
      wall+=guest.endAt-at+1;
      put('UserAdventureState',[{...seed.data.UserAdventureState[0],stageId:eligible?0:1100000103101}]);
      await close();await open();
      const guestRow=app.store.read('UserPC').data.find(row=>row.pcId===guest.pcId);
      if(!eligible) parse(await push({UserPC:[{...guestRow,hp:2,mp:1}]}));
      parse(await push(health,[issued.operation]));await close();await open();
      assert.equal(app.store.read('UserGuestEvent').data[0].totalExp,0,'No guest EXP/ownership precredit');
      assert.equal(app.store.read('UserPC').data.find(row=>row.pcId===guest.pcId).hp,eligible?target.hp:2);
      assert(!app.store.operations().some(row=>row.id===issued.operation.id));
      parse(await push({UserPC:[{...app.store.read('UserPC').data.find(row=>row.pcId===guest.pcId),hp:1,mp:0}]}));
      const pull={tables:['UserAdventureState']};assert.equal((await send('user_data/pull',pull)).status,200);
      const priorSequence=sequence,adventure=app.store.read('UserAdventureState').data[0];
      parse(await push({UserAdventureState:[{...adventure,stageId:adventure.stageId>0?0:1100000103101}]}));
      await close();await open();
      await reject(request(port,priorSequence,pull,String(priorSequence),'user_data/pull'),503);
      assert.equal((await send('user_data/pull',pull)).status,200,'Fresh actual adventure state remains readable');
    }
    for(const guest of master.pcGuests) {
      const permanentExp=master.pcGuestLevelSteps.find(row=>row.guestId===guest.id&&row.marker===15).totalExp;
      for(const eligible of [false,true]) {
        await fresh(`guest-only-${guest.pcId}-${eligible}`,eligible?guest.startAt:guest.endAt);
        const {id,points}=guestSetup(guest,0);
        put('UserPC',app.store.read('UserPC').data.filter(row=>row.pcId===guest.pcId));
        const before=app.store.read('UserPC'),issued=await issue(0,'plain',points,id),health=friendshipRefillFixture(app.store,[issued.operation]);
        if(eligible) await reject(push(otherSaves(issued),[issued.operation]),400);
        else assert.deepEqual(health,{},'All-inactive roster owes CP only, not a fabricated health mutation');
        parse(await push({...otherSaves(issued),...health},[issued.operation]));
        if(!eligible) assert.deepEqual(app.store.read('UserPC'),before,'Skipped-only CP callback preserves actual health and token');
      }
      for(const totalExp of [permanentExp-1,permanentExp]) {
        await fresh(`guest-permanent-${guest.pcId}-${totalExp}`,guest.endAt);
        const {id,points}=guestSetup(guest,0,0,totalExp),issued=await issue(0,'plain',points,id),capture=issued.capture.refills,
          permanent=totalExp===permanentExp,target=capture.targets.find(row=>row.pcId===guest.pcId);
        assert.equal(Object.hasOwn(capture,'guestRuntime'),!permanent);
        assert.equal(target.eligible,permanent?undefined:false);
        parse(await push({...otherSaves(issued),...friendshipRefillFixture(app.store,[issued.operation])},[issued.operation]));
      }
      for(const [at,nextAt,stageId,totalExp=0] of [[guest.startAt-1,guest.startAt,0],[guest.endAt-1,guest.endAt,0],
        [guest.endAt,guest.endAt,1100000103101],[guest.endAt,guest.endAt,0,permanentExp]]) {
        await fresh(`guest-redelivery-${guest.pcId}-${at}-${stageId}-${totalExp}`,at);
        const {id,points}=guestSetup(guest,0),issued=await issue(0,'plain',points,id),confirm=undefined;
        parse(await send('user_data/confirm',confirm));const cachedSequence=sequence;
        wall+=nextAt-at;
        put('UserAdventureState',[{...seed.data.UserAdventureState[0],stageId}]);
        if(totalExp) put('UserGuestEvent',[{userId:0,pcId:guest.pcId,totalExp}]);
        await close();await open();
        await reject(send('user_data/confirm',confirm),503);
        await reject(request(port,cachedSequence,confirm,String(cachedSequence),'user_data/confirm'),503);
        await reject(push(otherSaves(issued),[issued.operation]),503);
        assert(app.store.operations().some(row=>row.id===issued.operation.id),'Eligibility drift retains actual receipt/queue');
      }
    }
    await fresh('guest-runtime-corruption',master.pcGuests[0].startAt);
    const originalGuest=master.pcGuests[0],guestContext=guestSetup(originalGuest,0),guestIssue=await issue(0,'plain',guestContext.points,guestContext.id),
      guestRefills=guestIssue.capture.refills;
    for(const broken of [{...guestRefills,guestRuntime:undefined},{...guestRefills,guestRuntime:null},
      {...guestRefills,guestRuntime:{...guestRefills.guestRuntime,at:'old'}},
      {...guestRefills,targets:guestRefills.targets.map(row=>({...row,eligible:false}))},
      {...guestRefills,inputs:guestRefills.inputs.map(row=>row.guest?{...row,guest:null}:row)}]) {
      app.store.db.prepare(`UPDATE ${guestIssue.table} SET friendship_unlocks=? WHERE operation_id=?`)
        .run(JSON.stringify({...guestIssue.capture,refills:broken}),guestIssue.operation.id);
      await reject(send('user_data/confirm'),503);
      app.store.db.prepare(`UPDATE ${guestIssue.table} SET friendship_unlocks=? WHERE operation_id=?`).run(guestIssue.raw,guestIssue.operation.id);
    }
    for(const state of [[],[seed.data.UserAdventureState[0],seed.data.UserAdventureState[0]],
      [{...seed.data.UserAdventureState[0],userId:seed.userId+1}],
      [{...seed.data.UserAdventureState[0],stageId:'stage'}]]) {
      await fresh(`guest-state-${state.length}-${typeof state[0]?.stageId}-${state[0]?.userId}`,originalGuest.startAt);
      const {id,points}=guestSetup(originalGuest,0);put('UserAdventureState',state);
      await reject(send('character/friendship/complete',{friendshipStates:[{characterId:id,userHeroType:0,friendship:points,friendshipLv:2}]}),503);
    }
    for(const cpFirst of [false,true]) {
      await fresh(`fresh-matching-${cpFirst}`);setup(0);
      const stageId=1010000108101,newPcId=master.pcs[master.stages[stageId].rewardKey],newCharacterId=master.pcProfiles[newPcId].characterId,
        newPoints=master.characters[newCharacterId].levels[19][1],character={...seed.data.UserCharacter[0],characterId:newCharacterId,
          characterState:1,friendship:0,friendshipAis:0,friendshipLef:0};
      put('UserCharacter',[...app.store.read('UserCharacter').data,character]);
      const stages=app.store.read('UserAdventureStage').data;
      put('UserAdventureStage',[...stages,{...stages[0],adventureStageId:stageId,state:1,
        cumulativeClearCount:0,dailyClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0,tasks:[]}]);
      const reply=parse(await send('adventure/stage/complete',{adventureStageId:stageId,token:'fresh-refill',adventureStageTaskIds:[],
        adventureGainedItems:[],friendshipStates:[{characterId:newCharacterId,userHeroType:0,friendship:newPoints,friendshipLv:20}],
        secretMissionCompleted:false,isEnemyAnnihilated:true,adventureRecord:{continueCount:0,deathCount:0,turnCount:3}})),operation=reply.operation??reply.operations[0],
        raw=app.store.db.prepare('SELECT friendship_unlocks FROM stage_delivery WHERE operation_id=?').get(operation.id).friendship_unlocks,
        capture=JSON.parse(raw),input=capture.refills.inputs.find(row=>row.pc.pcId===newPcId),
        newRow={...seed.data.UserPC[0],...pcInitialStatInput(newPcId,master),hp:input.hp,mp:input.mp},
        charSave={UserCharacter:[{...character,characterState:2,friendship:newPoints}]};
      assert.deepEqual(capture.refills.initialPcIds,[newPcId]);
      assert(!app.store.read('UserPC').data.some(row=>row.pcId===newPcId),'No acquisition/refill/signature precredit');
      for(const broken of [{...capture.refills,initialPcIds:[]},{...capture.refills,initialCatalogHash:'old'},
        {...capture.refills,inputs:capture.refills.inputs.map(row=>({...row,hp:0}))}]) {
        app.store.db.prepare('UPDATE stage_delivery SET friendship_unlocks=? WHERE operation_id=?')
          .run(JSON.stringify({...capture,refills:broken}),operation.id);
        await reject(send('user_data/confirm'),503);
        app.store.db.prepare('UPDATE stage_delivery SET friendship_unlocks=? WHERE operation_id=?').run(raw,operation.id);
      }
      if(cpFirst) parse(await push(charSave));
      parse(await push({UserPC:[newRow],UserPCJobSet:[{userId:seed.userId,pcId:newPcId,pcJobs:[]}]}));
      await close();await open();await reject(push({},[operation]),400);
      const stage=operation.parameters.UserAdventureStage[0],items={};
      for(const target of app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(operation.id)) {
        const before=app.store.read(target.table_name).data.find(row=>row[target.id_field]===target.item_id);
        (items[target.table_name]??=[]).push({...before,userId:seed.userId,[target.id_field]:target.item_id,signature:0,
          bookEntryState:3,amount:(before?.amount??0)+target.cumulative_amount-(before?.cumulativeAmount??0),
          cumulativeAmount:target.cumulative_amount});
      }
      const rest=stageXpFixture(app.store,{...items,...charSave,UserAdventureStage:[{...stage,state:4,
        cumulativeClearCount:stage.cumulativeClearCount+1,firstCompleteDateTime:stage.firstCompleteDateTime||now,lastCompleteDateTime:now}]},[operation]);
      delete rest.UserPC;parse(await push(rest));await reject(push({},[operation]),400);
      parse(await push(friendshipRefillFixture(app.store,[operation]),[operation]));
      await close();await open();assert(!app.store.operations().some(row=>row.id===operation.id));
    }
    console.log('Synthetic lazy-character/CP refill scope/split-save/checkpoint/restart/ACK/rollback/cache checks OK; native acceptance pending');
  } catch(error) { console.error('CP refill fixture failure:',path.basename(database??''),error); throw error; }
  finally {await close();fs.rmSync(directory,{recursive:true,force:true,maxRetries:4,retryDelay:100});}
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
