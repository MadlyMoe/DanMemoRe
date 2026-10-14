'use strict';

// DEFERRED / NOT RUN: disposable synthetic points/saves, not native earning,
// CP stats, signatures, initialization, event order or visual acceptance.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE} = require('./danmemore_server.cjs');
const {request,friendshipVoiceFixture,friendshipRefillFixture} = require('./test_danmemore_server.cjs');
const {itemDeltas} = require('./test_friendship_rewards.cjs');
const master = require('../data/danmemore-master.json'), seed = require('../data/danmemore-seed.json');
const md5 = rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-cp-unlocks-'));
  let app,database,port,sequence=0;
  const open = async ()=>{
    app=createServer({database,seed,master,wallNowSeconds:()=>1790866800,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close = async ()=>{if(app){await app.close();app=null;}};
  const send = (action,body)=>request(port,++sequence,body,String(sequence),action);
  const parse = reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const put = (name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const snapshot = ()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected = async (pending,status,before=snapshot())=>{
    const reply=await pending;assert.equal(reply.status,status,reply.body.toString());assert.equal(snapshot(),before);
    if(status===503)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  // No automatic unlock fixture: absent quest flags must genuinely fail ACK.
  const push = (putItems={},operations=[],deleteItems={})=>send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name] ?? [])]))},
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length ?
      [{signature:0,trigger:'FriendshipComplete',putItems,deleteItems}] : [],
    operations:operations.map(row=>({id:row.id,verifier:row.token})),
  });
  const characterId=101000001,root=1010000101103,quest=1020010101101,story=1030010101101,
    field = hero=>['friendship','friendshipAis','friendshipLef'][hero],
    level = points=>master.characters[characterId].levels.findLast(([,threshold])=>threshold<=points)[0],
    owned = ()=>app.store.read('UserCharacter').data.find(row=>row.characterId===characterId);
  const setup = (hero,before=0,inactive=0,absent=false)=>{
    put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,heroType:hero})));
    put('UserCharacter',app.store.read('UserCharacter').data.map(row=>row.characterId===characterId ?
      {...row,friendship:0,friendshipAis:0,friendshipLef:0,[field(hero)]:before,[field((hero+1)%3)]:inactive} : row));
    put('UserAdventureStage',app.store.read('UserAdventureStage').data.filter(row=>!absent || ![quest,story].includes(row.adventureStageId))
      .map(row=>row.adventureStageId===root ? {...row,state:1} : row.adventureStageId===root+1 ? {...row,state:1} :
        [2,3].includes(master.stages[row.adventureStageId]?.adventureType) ? {...row,state:0} : row));
    put('UserCpItem',[{userId:seed.userId,cpItemId:215000001,amount:1,cumulativeAmount:1,reservedAmount:0,signature:0,bookEntryState:3}]);
  };
  const body = (source,hero,points=100)=>{
    const state={characterId,friendship:points,friendshipLv:level(points),userHeroType:hero};
    return source==='stage' ? {
      adventureStageId:root,token:'cp-quest-refresh',adventureStageTaskIds:[],adventureGainedItems:[],friendshipStates:[state],
      secretMissionCompleted:false,isEnemyAnnihilated:true,adventureRecord:{continueCount:0,deathCount:0,turnCount:3},
    } : {friendshipStates:[state],...(source==='gift' ? {itemId:215000001,itemAmount:1} : {})};
  };
  const issue = (source,hero,points=100)=>send(source==='stage' ? 'adventure/stage/complete' : 'character/friendship/complete',body(source,hero,points));
  const table = operation=>operation.type===5000 ? 'stage_delivery' : 'friendship_reward_claim';
  const capture = operation=>JSON.parse(app.store.db.prepare(`SELECT friendship_unlocks FROM ${table(operation)} WHERE operation_id=?`)
    .get(operation.id).friendship_unlocks);
  const flags = targets=>targets.map(({stageId})=>{
    const prior=app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===stageId) ??
      {...app.store.read('UserAdventureStage').data[0],adventureStageId:stageId,token:'',tasks:[],cumulativeClearCount:0,
        dailyClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0};
    return {...prior,state:1};
  });
  const remaining = (operation,hero,points)=>{
    // Explicit synthetic voice saves; this negative suite still never fills quest flags.
    const result = {...(operation.type===11000 ? itemDeltas(app.store,operation) : {}),...friendshipVoiceFixture(app.store,[operation]),
      ...friendshipRefillFixture(app.store,[operation])};
    result.UserCharacter=[{...owned(),[field(hero)]:points}];
    if(operation.type===5000){
      const before=operation.parameters.UserAdventureStage[0];
      result.UserAdventureStage=[{...before,state:4,cumulativeClearCount:before.cumulativeClearCount+1,
        firstCompleteDateTime:before.firstCompleteDateTime || 1790866800,lastCompleteDateTime:1790866800}];
    }
    return result;
  };
  try {
    for(const source of ['stage','gift'])for(const hero of [0,1,2])for(const unlockFirst of [true,false]) {
      database=path.join(directory,`${source}-${hero}-${unlockFirst}.sqlite`);await open();setup(hero,0,0,unlockFirst);
      const prior=app.store.read('UserAdventureStage'),pullBody={tables:['UserAdventureStage','UserCharacter']};
      assert.equal((await send('user_data/pull',pullBody)).status,200);const pullIdentity=sequence;
      const reply=parse(await issue(source,hero)),operation=reply.operation ?? reply.operations[0],identity=sequence,
        original=app.store.db.prepare(`SELECT friendship_unlocks FROM ${table(operation)} WHERE operation_id=?`).get(operation.id).friendship_unlocks,
        recovered=capture(operation),unlocked=flags(recovered.effects);
      assert.deepEqual(recovered.effects,[{stageId:quest,kind:'open'},{stageId:story,kind:'open'}]);
      assert.deepEqual(app.store.read('UserAdventureStage'),prior,'No native flag/signature precredit');
      for(const raw of [null,'{}','bad-json',JSON.stringify({...recovered,graphHash:'wrong'}),
        JSON.stringify({...recovered,characters:[]}),JSON.stringify({...recovered,inputs:[]}),
        JSON.stringify({...recovered,effects:[]})]) {
        app.store.db.prepare(`UPDATE ${table(operation)} SET friendship_unlocks=? WHERE operation_id=?`).run(raw,operation.id);
        await rejected(send('user_data/confirm',undefined),503);
        app.store.db.prepare(`UPDATE ${table(operation)} SET friendship_unlocks=? WHERE operation_id=?`).run(original,operation.id);
      }
      const beforeRaw=app.store.db.prepare(`SELECT friendship_before FROM ${table(operation)} WHERE operation_id=?`).get(operation.id).friendship_before;
      for(const raw of [null,'{}','bad-json',JSON.stringify(JSON.parse(beforeRaw).map(row=>({...row,levelsHash:'wrong'})))]) {
        app.store.db.prepare(`UPDATE ${table(operation)} SET friendship_before=? WHERE operation_id=?`).run(raw,operation.id);
        await rejected(send('user_data/confirm',undefined),503);
        app.store.db.prepare(`UPDATE ${table(operation)} SET friendship_before=? WHERE operation_id=?`).run(beforeRaw,operation.id);
      }
      const rest=remaining(operation,hero,100);
      await rejected(push(rest,[operation]),400);
      for(const bad of [{state:0},{state:5},{userId:2}])await rejected(push({...rest,UserAdventureStage:[
        ...(rest.UserAdventureStage ?? []),...unlocked.map((row,index)=>index ? row : {...row,...bad})]},[operation]),400);
      const first=unlockFirst ? {UserAdventureStage:unlocked} : rest;
      app.store.db.exec(`CREATE TRIGGER fail_observe BEFORE UPDATE ON ${table(operation)} BEGIN SELECT RAISE(ABORT,'CP unlock observe'); END`);
      await rejected(push(first),503);app.store.db.exec('DROP TRIGGER fail_observe');
      assert.deepEqual(parse(await push(first)).operations,[]);assert.deepEqual(app.store.operations(),[operation]);
      await close();await open();
      for(const [action,body]of [['user/login',undefined],['user_data/confirm',undefined],['user_data/pull',pullBody]])
        if(source==='stage' && unlockFirst) {
          const before=snapshot();assert.deepEqual(app.store.stageColdRecovery(operation),operation);assert.equal(snapshot(),before);
          const reply=await send(action,body);assert.equal(reply.status,200);
          if(action==='user_data/confirm') assert.deepEqual(parse(reply).operations,[operation]);
        } else await rejected(send(action,body),503);
      await rejected(request(port,identity,body(source,hero),String(identity),
        source==='stage' ? 'adventure/stage/complete' : 'character/friendship/complete'),503);
      if(unlockFirst) {
        await rejected(push({UserAdventureStage:[{...unlocked[0],state:0}]}),400);
        await rejected(push({},[],{UserAdventureStage:[{adventureStageId:quest}]}),400);
      }
      await rejected(push({},[operation]),400);
      parse(await push(unlockFirst ? rest : {UserAdventureStage:unlocked}));
      for(const [target,event]of [['stage_unlock_floor','INSERT'],['stage_friendship_floor','INSERT'],['operation_done','INSERT'],
        ['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_ack BEFORE ${event} ON ${target} BEGIN SELECT RAISE(ABORT,'CP unlock ACK'); END`);
        await rejected(push({},[operation]),503);app.store.db.exec('DROP TRIGGER fail_ack');
      }
      parse(await push({},[operation]));await close();await open();
      assert.equal(app.store.db.prepare('SELECT operation_id FROM stage_unlock_floor WHERE stage_id=?').get(quest).operation_id,operation.id);
      await rejected(push({UserAdventureStage:[{...unlocked[0],state:0}]}),400);
      await rejected(push({},[],{UserAdventureStage:[{adventureStageId:story}]}),400);
      await rejected(request(port,pullIdentity,pullBody,String(pullIdentity),'user_data/pull'),503);
      assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');await close();
    }
    for(const [before,target,inactive,expected]of [[0,16,54,2],[54,100,840,0],[0,5,0,0]]) {
      database=path.join(directory,`max-${before}-${target}-${inactive}.sqlite`);await open();setup(0,before,inactive);
      const operation=parse(await issue('plain',0,target)).operations[0],recovered=capture(operation);
      assert.equal(recovered.effects.length,expected,'Refresh on active-level change, eligibility from all three levels');
      const items=remaining(operation,0,target);items.UserAdventureStage=flags(recovered.effects);
      if(!items.UserAdventureStage.length)delete items.UserAdventureStage;
      parse(await push(items,[operation]));
      if(inactive && expected)await rejected(push({UserCharacter:[{...owned(),friendshipAis:0}]}),400);
      await close();
    }
    // First node in a later quest episode requires ALL prior normal nodes4;
    // CP refresh must not pretend that a still-pending battle already cleared.
    for(const completed of [false,true]) {
      database=path.join(directory,`quest-episode-${completed}.sqlite`);await open();setup(0,16);
      put('UserAdventureStage',app.store.read('UserAdventureStage').data.map(row=>
        [1020010101101,1020010101102,1020010101103,1020010101104].includes(row.adventureStageId) ?
          {...row,state:completed || row.adventureStageId!==1020010101104 ? 4 : 1} : row));
      const operation=parse(await issue('plain',0,840)).operations[0],recovered=capture(operation);
      assert.equal(recovered.effects.some(row=>row.stageId===1020010102101),completed);
      const items=remaining(operation,0,840);items.UserAdventureStage=flags(recovered.effects);
      parse(await push(items,[operation]));await close();
    }
    console.log('CP quest/story checkpoints: synthetic checks OK; natural native eligibility, flags/signatures/UI remain pending');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
