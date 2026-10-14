'use strict';

// DEFERRED / NOT RUN. Synthetic eligibility/flags/signatures only, not native
// first entry, CP earning, achievements, event/save order or playable UI proof.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE} = require('./danmemore_server.cjs');
const {request,stageXpFixture} = require('./test_danmemore_server.cjs');
const {itemDeltas} = require('./test_friendship_rewards.cjs');
const master = require('../data/danmemore-master.json'), seed = require('../data/danmemore-seed.json');
const md5 = rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-character-clear-'));
  let app,database,port,sequence=0;
  const characterId=101000001,quest=1020010101101,story=1030010101101,
    fields=['friendship','friendshipAis','friendshipLef'];
  const open = async (metadata=master)=>{
    app=createServer({database,seed,master:metadata,wallNowSeconds:()=>1790866800,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close = async ()=>{if(app){await app.close();app=null;}};
  const send = (action,body)=>request(port,++sequence,body,String(sequence),action);
  const parse = reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const put = (name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const stages = ()=>app.store.read('UserAdventureStage').data;
  const character = ()=>app.store.read('UserCharacter').data.find(row=>row.characterId===characterId);
  const snapshot = ()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected = async (pending,status,before=snapshot())=>{
    const reply=await pending;assert.equal(reply.status,status,reply.body.toString());assert.equal(snapshot(),before);
    if(status===503)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  // Never auto-supply unlock effects to negative ACK checks.
  const push = (putItems={},operations=[],deleteItems={})=>send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name] ?? [])]))},
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length ?
      [{signature:0,trigger:'AdventureComplete',putItems,deleteItems}] : [],
    operations:operations.map(row=>({id:row.id,verifier:row.token})),
  });
  const body = (id,hero=0,target=null)=>({adventureStageId:id,token:'character-clear',adventureStageTaskIds:[],adventureGainedItems:[],
    friendshipStates:target===null ? [] : [{characterId,friendship:target,
      friendshipLv:master.characters[characterId].levels.findLast(([,points])=>points<=target)[0],userHeroType:hero}],
    secretMissionCompleted:false,isEnemyAnnihilated:true,adventureRecord:{continueCount:0,deathCount:0,turnCount:3}});
  const receipt = operation=>app.store.db.prepare('SELECT * FROM stage_delivery WHERE operation_id=?').get(operation.id);
  const flag = (id,state=1)=>({...stages().find(row=>row.adventureStageId===id) ?? stages()[0],adventureStageId:id,
    state,tasks:[],token:'synthetic-character-stage',cumulativeClearCount:state===4 ? 1 : 0,dailyClearCount:0,
    firstCompleteDateTime:state===4 ? 1790866700 : 0,lastCompleteDateTime:state===4 ? 1790866700 : 0});
  const setup = (root,points,hero=0,absent=false)=>{
    put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,heroType:hero})));
    put('UserCharacter',app.store.read('UserCharacter').data.map(row=>row.characterId===characterId ?
      {...row,...Object.fromEntries(fields.map((field,index)=>[field,points[index]]))} : row));
    put('UserAdventureStage',stages().filter(row=>![2,3].includes(master.stages[row.adventureStageId]?.adventureType))
      .concat(Object.keys(master.stageProgression).map(Number).filter(id=>[2,3].includes(master.stages[id]?.adventureType) &&
        (!absent || id===root)).map(id=>flag(id,id===root ? 1 : 0))));
  };
  const remaining = (operation,target=null,hero=0)=>{
    const before=operation.parameters.UserAdventureStage[0],result=itemDeltas(app.store,operation),
      {UserInfo}=stageXpFixture(app.store,{},[operation]); // EXP/SP only; discard synthetic unlock convenience.
    if(UserInfo)result.UserInfo=UserInfo;
    result.UserAdventureStage=[{...before,state:4,cumulativeClearCount:before.cumulativeClearCount+1,
      firstCompleteDateTime:before.firstCompleteDateTime || 1790866800,lastCompleteDateTime:1790866800}];
    if(target!==null)result.UserCharacter=[{...character(),[fields[hero]]:target}];
    return result;
  };
  try {
    const vectors=[
      [quest,[54,0,0],null,quest+1],
      [story,[840,0,0],null,null], // Next story threshold9: level8 is insufficient.
      [story,[1166,0,0],null,story+1],
      [story,[0,0,1166],null,story+1], // Inactive track, not the current hero.
      [story,[0,0,0],1166,story+1], // New CP must be used AFTER its pre-clear refresh.
      [story,[0,0,0],1166,story+1,1],
      [story,[0,0,0],1166,story+1,2],
    ];
    for(const [index,[root,points,target,next,hero=0]] of vectors.entries())for(const unlockFirst of next ? [true,false] : [false])for(const owner of [seed.userId,0]) {
      database=path.join(directory,`direct-${index}-${unlockFirst}-owner-${owner}.sqlite`);await open();setup(root,points,hero,unlockFirst);
      put('UserCharacter',app.store.read('UserCharacter').data.map(row=>row.characterId===characterId ? {...row,userId:owner} : row));
      const initial=app.store.read('UserAdventureStage'),requestBody=body(root,hero,target),
        operation=parse(await send('adventure/stage/complete',requestBody)).operation,captured=receipt(operation),
        graph=JSON.parse(captured.story_progression),refresh=captured.friendship_unlocks ? JSON.parse(captured.friendship_unlocks) : null;
      assert.equal(captured.next_unlock,null);
      assert.deepEqual(graph.character.before,points);assert.equal(graph.character.characterId,characterId);
      assert.deepEqual(graph.effects,next ? [{stageId:next,kind:'open'}] : []);
      assert.equal(refresh?.effects.some(effect=>effect.stageId===next) ?? false,false,
        'Pre-clear refresh cannot treat the root as already complete');
      assert.deepEqual(app.store.read('UserAdventureStage'),initial,'Issuance cannot precredit native flags/signatures');
      assert.equal(operation.parameters.UserAdventureStage.length,1);
      assert.equal(app.store.hardCurrency(),root===story ? 5 : 0,'No extra narrative rewards for merely opening the next story');
      for(const raw of [null,'bad-json',JSON.stringify({...graph,character:null}),JSON.stringify({...graph,graphHash:'wrong'}),
        JSON.stringify({...graph,character:{...graph.character,levelsHash:'wrong'}}),
        JSON.stringify({...graph,character:{...graph.character,before:[0,-1,0]}}),
        JSON.stringify({...graph,inputs:graph.inputs.slice(1)})]) {
        app.store.db.prepare('UPDATE stage_delivery SET story_progression=? WHERE operation_id=?').run(raw,operation.id);
        await rejected(send('user_data/confirm',undefined),503);
        app.store.db.prepare('UPDATE stage_delivery SET story_progression=? WHERE operation_id=?').run(captured.story_progression,operation.id);
      }
      const rest=remaining(operation,target,hero),opens=[...(refresh?.effects ?? []),...graph.effects].map(effect=>flag(effect.stageId));
      for(const userId of [owner===0 ? seed.userId : 0,2,'0',null])
        await rejected(push({UserCharacter:[{...character(),userId}]}),400);
      if(next) {
        await rejected(push(rest,[operation]),400);
        for(const bad of [{state:0},{state:5},{userId:2}])await rejected(push({...rest,UserAdventureStage:[
          ...rest.UserAdventureStage,...opens.map(row=>row.adventureStageId===next ? {...row,...bad} : row)]},[operation]),400);
      }
      // The gating CP tracks must remain owned, even with no CP reward in this packet.
      const gatingHero=points.findIndex(value=>value>0);
      if(gatingHero>=0)await rejected(push({UserCharacter:[{...character(),[fields[gatingHero]]:0}]}),400);
      if(next) {
        const first=unlockFirst ? {UserAdventureStage:opens} : rest;
        for(const [table,event]of [['profile','UPDATE'],['stage_delivery','UPDATE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER fail_partial BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'character partial'); END`);
          await rejected(push(first),503);app.store.db.exec('DROP TRIGGER fail_partial');
        }
        assert.deepEqual(parse(await push(first)).operations,[]);assert.deepEqual(app.store.operations(),[operation]);
        await close();await open();
        for(const [action,value]of [['user/login',undefined],['user_data/confirm',undefined],['user_data/pull',{tables:['UserAdventureStage','UserCharacter']}]])
          await rejected(send(action,value),503);
        await rejected(push({},[operation]),400);
        parse(await push(unlockFirst ? rest : {UserAdventureStage:opens}));
      }else parse(await push({...rest,UserAdventureStage:[...rest.UserAdventureStage,...opens]}));
      for(const [table,event]of [['stage_state_floor','INSERT'],['operation_done','INSERT'],['reply_cache','INSERT'],
        ...(next ? [['stage_unlock_floor','INSERT'],['stage_friendship_floor','INSERT']] : [])]) {
        app.store.db.exec(`CREATE TRIGGER fail_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'character ACK'); END`);
        await rejected(push({},[operation]),503);app.store.db.exec('DROP TRIGGER fail_ack');
      }
      parse(await push({},[operation]));await close();await open();
      assert.equal(character().userId,owner);
      if(next) {
        assert.equal(app.store.db.prepare('SELECT operation_id FROM stage_unlock_floor WHERE stage_id=?').get(next).operation_id,operation.id);
        await rejected(push({UserAdventureStage:[{...flag(next),state:0}]}),400);
        await rejected(push({},[],{UserAdventureStage:[{adventureStageId:next}]}),400);
      }
      const earnedHero=target!==null ? hero : gatingHero;
      if(earnedHero>=0) {
        assert.equal(app.store.db.prepare('SELECT friendship FROM stage_friendship_floor WHERE character_id=? AND user_hero_type=?')
          .get(characterId,earnedHero).friendship,target ?? points[earnedHero]);
        await rejected(push({UserCharacter:[{...character(),[fields[earnedHero]]:0}]}),400);
      }
      const repeat=parse(await send('adventure/stage/complete',{...requestBody,token:'repeat-character-clear'})).operation;
      assert.deepEqual(repeat.parameters.gainedItems,[],'First-clear item reward is once-only');
      assert.equal(app.store.hardCurrency(),root===story ? 5 : 0);parse(await push(remaining(repeat,target,hero),[repeat]));await close();
    }
    database=path.join(directory,'preowned-successor.sqlite');await open();setup(story,[1166,0,0]);
    put('UserAdventureStage',stages().map(row=>row.adventureStageId===story+1 ? {...row,state:1} : row));
    const preowned=parse(await send('adventure/stage/complete',body(story))).operation;
    assert.deepEqual(JSON.parse(receipt(preowned).story_progression).effects,[]);
    await rejected(push({UserAdventureStage:[{...flag(story+1),state:0}]}),400);
    parse(await push(remaining(preowned),[preowned]));await close();
    // Authored quest episode1 -> episode2. No invented difficulty2 and no partial-episode shortcut.
    const terminal=1020010101104,episodeNext=1020010102101;
    for(const [points,completeEarlier,expected]of [[840,true,true],[54,true,false],[840,false,false]]) {
      database=path.join(directory,`episode-${points}-${completeEarlier}.sqlite`);await open();setup(terminal,[points,0,0]);
      const earlier=[quest,quest+1,quest+2];
      put('UserAdventureStage',stages().map(row=>earlier.includes(row.adventureStageId) ? flag(row.adventureStageId,
        completeEarlier || row.adventureStageId!==quest+2 ? 4 : 1) : row));
      const operation=parse(await send('adventure/stage/complete',body(terminal))).operation,graph=JSON.parse(receipt(operation).story_progression);
      assert.deepEqual(graph.effects,expected ? [{stageId:episodeNext,kind:'open'}] : []);
      const rest=remaining(operation);if(expected)rest.UserAdventureStage.push(flag(episodeNext));
      parse(await push(rest,[operation]));await close();
    }
    // Terminal normal narrative succeeds without demanding a nonexistent next difficulty.
    database=path.join(directory,'story-terminal.sqlite');await open();setup(story+3,[2000000000,0,0]);
    put('UserAdventureStage',stages().map(row=>[story,story+1,story+2].includes(row.adventureStageId) ? flag(row.adventureStageId,4) : row));
    const terminalOperation=parse(await send('adventure/stage/complete',body(story+3))).operation;
    assert.deepEqual(JSON.parse(receipt(terminalOperation).story_progression).effects,[]);
    parse(await push(remaining(terminalOperation),[terminalOperation]));await close();
    // Original provider drift must not silently rebase an old pending capture.
    database=path.join(directory,'catalog-drift.sqlite');await open();setup(story,[1166,0,0]);
    parse(await send('adventure/stage/complete',body(story)));await close();
    await open({...master,stageUnlocks:{...master.stageUnlocks,[story+1]:{...master.stageUnlocks[story+1],value:10}}});
    await rejected(send('user_data/confirm',undefined),503);
    console.log('Character-stage clear graph, CP ordering, split saves and persisted ACK floors: synthetic checks OK; native acceptance pending');
  }finally{await close();fs.rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
