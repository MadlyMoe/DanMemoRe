'use strict';

// Disposable SYNTHETIC CP/quest/voice saves, not natural
// earning, original signatures, live native callback order, rendering or UI proof.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request,friendshipVoiceFixture,friendshipRefillFixture,stageXpFixture}=require('./test_danmemore_server.cjs');
const {itemDeltas}=require('./test_friendship_rewards.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const now=1790866800,md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex'),fields=['friendship','friendshipAis','friendshipLef'];

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-cp-voices-'));
  let app,port,database,sequence=0,rejection;
  const open=async()=>{
    app=createServer({database,seed,master,wallNowSeconds:()=>now,log:line=>{
      const entry=JSON.parse(line);if(entry.event==='rejected') rejection=entry.reason;
    }});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async()=>{if(app){await app.close();app=null;}};
  const fresh=async name=>{await close();database=path.join(directory,`${name}.sqlite`);await open();};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const send=(action,body)=>{rejection=undefined;return request(port,++sequence,body,String(sequence),action);};
  const parse=reply=>{assert.equal(reply.status,200,`${path.basename(database)}: ${rejection ?? reply.body.toString()}`);return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const reject=async(pending,status,before=snapshot(),structured=true)=>{
    const reply=await pending;assert.equal(reply.status,status,`${path.basename(database)}: ${rejection ?? reply.body.toString()}`);assert.equal(snapshot(),before);
    if(status===503) structured ? assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE) : assert.equal(reply.body.length,0);
  };
  const push=(putItems={},operations=[],deleteItems={})=>send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name] ?? [])]))},
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length ? [{signature:0,trigger:'FriendshipComplete',putItems,deleteItems}] : [],
    operations:operations.map(row=>({id:row.id,verifier:row.token}))});
  const setup=(communicationId=100000001,hero=0,points=[0,0,0])=>{
    const original=master.communicationCharacters[communicationId],characterId=original.characterId;
    put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,heroType:hero})));
    put('UserCharacter',[{...seed.data.UserCharacter[0],userId:0,characterId,
      friendship:points[0],friendshipAis:points[1],friendshipLef:points[2]}]);
    put('UserAdventureStage',app.store.read('UserAdventureStage').data.map(row=>
      [2,3].includes(master.stages[row.adventureStageId]?.adventureType) ? {...row,state:0} : row));
    // Preserve the listener's fixed home bootstrap; otherwise reopen, not CP,
    // would add Hestia's starter costume and invalidate the unchanged baseline.
    put('UserCharacterCostume',app.store.read('UserCharacterCostume').data.filter(row=>row.costumeId===1022027000));put('UserCommunicationVoice',[]);
    put('UserCpItem',[{userId:seed.userId,cpItemId:215000001,amount:1,cumulativeAmount:1,reservedAmount:0,bookEntryState:3,signature:0}]);
    return {communicationId,characterId,hero,points,original};
  };
  const issue=async(context,source='plain',target=master.characters[context.characterId].levels[3][1])=>{
    if(source==='item') {
      const original=master.characters[context.characterId],factor=original.favoriteItems.find(([id])=>id===215000001)?.[1] ?? 1;
      target=context.points[context.hero]+Math.trunc(Math.fround(Math.fround(factor*Math.fround(master.cpItems[215000001]))));
    }
    const state={characterId:context.characterId,userHeroType:context.hero,friendship:target,
      friendshipLv:master.characters[context.characterId].levels.findLast(([,points])=>points<=target)[0]},
      body=source==='stage' ? {adventureStageId:1010000101101,token:'voice-level',adventureStageTaskIds:[],adventureGainedItems:[],
        friendshipStates:[state],secretMissionCompleted:false,isEnemyAnnihilated:true,adventureRecord:{continueCount:0,deathCount:0,turnCount:3}} :
        {friendshipStates:[state],...(source==='item' ? {itemId:215000001,itemAmount:1} : {})},
      reply=parse(await send(source==='stage' ? 'adventure/stage/complete' : 'character/friendship/complete',body)),operation=reply.operation ?? reply.operations[0],
      table=source==='stage' ? 'stage_delivery' : 'friendship_reward_claim',
      raw=app.store.db.prepare(`SELECT friendship_unlocks FROM ${table} WHERE operation_id=?`).get(operation.id).friendship_unlocks;
    return {operation,table,raw,capture:JSON.parse(raw),state,body,identity:sequence};
  };
  const otherSaves=issued=>{
    const {operation,capture,state}=issued,result={...([11000,5000].includes(operation.type) ? itemDeltas(app.store,operation) : {}),
      ...friendshipRefillFixture(app.store,[operation])},
      before=app.store.read('UserCharacter').data.find(row=>row.characterId===state.characterId);
    result.UserCharacter=[{...before,[fields[state.userHeroType]]:state.friendship}];
    result.UserAdventureStage=capture.effects.map(({stageId})=>({...seed.data.UserAdventureStage[0],adventureStageId:stageId,state:1,
      token:'',tasks:[],cumulativeClearCount:0,dailyClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0}));
    if(operation.type===5000) {
      const stage=operation.parameters.UserAdventureStage[0];
      result.UserAdventureStage.push({...stage,state:4,cumulativeClearCount:stage.cumulativeClearCount+1,
        firstCompleteDateTime:stage.firstCompleteDateTime || now,lastCompleteDateTime:now});
      // Explicit synthetic XP/quest fixture for other providers; remove its
      // voice convenience so this suite genuinely exercises MISSING voice ACK.
      Object.assign(result,stageXpFixture(app.store,result,[operation]));delete result.UserCommunicationVoice;
    }
    if(!result.UserAdventureStage.length) delete result.UserAdventureStage;
    return result;
  };
  const checkPool=(context,issued)=>{
    const points=[...context.points];points[context.hero]=issued.state.friendship;
    const levels=points.map(points=>master.characters[context.characterId].levels.findLast(([,threshold])=>threshold<=points)[0]),
      costumes=new Map(app.store.read('UserCharacterCostume').data.map(row=>[row.costumeId,row.costumeState])),
      expected=Object.entries(master.communicationVoices).filter(([,row])=>row.kind!==1 && (row.kind===2 ? [2,3].includes(costumes.get(row.costumeId)) :
        row.communicationCharacterKey===context.original.key && row.friendshipLevel<=levels[row.userHeroType])).map(([id])=>Number(id));
    assert.deepEqual(issued.capture.voices.refreshVoices.map(row=>row.voiceId),expected,'Original own-hero thresholds/global costume voices, not MAX CP');
  };
  try {
    for(const source of ['plain','item','stage']) for(const hero of [0,1,2]) for(const voicesFirst of [false,true]) {
      await fresh(`${source}-${hero}-${voicesFirst}`);const context=setup(100000001,hero),costumes=app.store.read('UserCharacterCostume'),
        communication=app.store.read('UserCommunicationCharacter'),pullBody={tables:['UserCommunicationVoice','UserCharacterCostume']};
      assert.equal((await send('user_data/pull',pullBody)).status,200);const oldPull=sequence,issued=await issue(context,source);checkPool(context,issued);
      assert.deepEqual(app.store.read('UserCharacterCostume'),costumes,`${source}/${hero}/${voicesFirst} issue costumes`);assert.deepEqual(app.store.read('UserCommunicationCharacter'),communication);
      assert.deepEqual(app.store.read('UserCommunicationVoice').data,[],'No native voice precredit');
      const voices=friendshipVoiceFixture(app.store,[issued.operation]),rest=otherSaves(issued),firstVoice=voices.UserCommunicationVoice[0];
      await reject(push({...rest,UserCommunicationVoice:[{...firstVoice,userId:2}]},[issued.operation]),400);
      parse(await push(voicesFirst ? voices : rest));await close();await open();
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM costume_unlock_floor').get().n,0,'No partial voice floor');
      await reject(push({},[issued.operation]),400);
      if(source==='stage' && voicesFirst) {
        const before=snapshot();assert.deepEqual(app.store.stageColdRecovery(issued.operation),issued.operation);assert.equal(snapshot(),before);
        assert.deepEqual(parse(await send('user_data/confirm')).operations,[issued.operation]);parse(await send('user/login'));
      } else await reject(send('user_data/confirm',undefined),503);
      if(voicesFirst) await reject(push({UserCommunicationVoice:[{...firstVoice,voiceState:1}]}),400);
      parse(await push(voicesFirst ? rest : voices));await close();await open();
      for(const [table,event] of [['costume_unlock_floor','INSERT'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_voice_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'voice ACK rollback'); END`);
        await reject(push({},[issued.operation]),503,snapshot(),false);app.store.db.exec('DROP TRIGGER fail_voice_ack');
      }
      parse(await push({},[issued.operation]));await close();await open();
      assert.deepEqual(app.store.read('UserCharacterCostume'),costumes,`${source}/${hero}/${voicesFirst} settled costumes`);assert.deepEqual(app.store.read('UserCommunicationCharacter'),communication);
      await reject(push({},[],{UserCommunicationVoice:[{voiceId:firstVoice.voiceId}]}),400);
      await reject(request(port,oldPull,pullBody,String(oldPull),'user_data/pull'),503);
      assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    }
    for(const id of Object.keys(master.communicationCharacters).map(Number)) {
      await fresh(`identity-${id}`);const context=setup(id,0),issued=await issue(context);checkPool(context,issued);
      parse(await push({...otherSaves(issued),...friendshipVoiceFixture(app.store,[issued.operation])},[issued.operation]));
    }
    for(const hero of [0,1,2]) {
      await fresh(`own-hero-${hero}`);const points=[0,0,0];points[(hero+1)%3]=master.characters[101000001].levels[9][1];
      const context=setup(100000001,hero,points),issued=await issue(context);checkPool(context,issued);
      parse(await push({...otherSaves(issued),...friendshipVoiceFixture(app.store,[issued.operation])},[issued.operation]));
    }
    for(const ownedState of [2,3]) for(const costumeId of [...new Set(Object.values(master.communicationVoices).filter(row=>row.kind===2).map(row=>row.costumeId))]) {
      await fresh(`global-${costumeId}-${ownedState}`);const context=setup(),linked=Object.entries(master.communicationVoices).find(([,row])=>row.costumeId===costumeId);
      put('UserCharacterCostume',[{userId:0,costumeId,costumeState:ownedState}]);put('UserCommunicationVoice',[{userId:0,voiceId:Number(linked[0]),voiceState:3}]);
      const issued=await issue(context);checkPool(context,issued);assert.equal(issued.capture.voices.refreshVoices.find(row=>row.voiceId===Number(linked[0])).state,3);
      await reject(push({UserCommunicationVoice:[{userId:0,voiceId:Number(linked[0]),voiceState:2}]}),400);
      parse(await push({...otherSaves(issued),...friendshipVoiceFixture(app.store,[issued.operation])},[issued.operation]));await close();await open();
      assert.equal(app.store.db.prepare("SELECT state FROM costume_unlock_floor WHERE table_name='UserCharacterCostume' AND id=?").get(costumeId).state,ownedState);
      await reject(push({UserCharacterCostume:[{userId:0,costumeId,costumeState:ownedState-1}]}),400);
      await reject(push({},[],{UserCharacterCostume:[{costumeId}]}),400);
    }
    await fresh('unchanged-level');const context=setup(),unchanged=await issue(context,'plain',5);
    assert(!Object.hasOwn(unchanged.capture,'voices'),'No native refresh on unchanged active LEVEL');
    parse(await push(otherSaves(unchanged),[unchanged.operation]));assert.deepEqual(app.store.read('UserCommunicationVoice').data,[]);
    await fresh('corrupt-capture');const pending=await issue(setup()),voices=pending.capture.voices;
    for(const corrupt of [{...pending.capture,voices:undefined},{...pending.capture,voices:{...voices,catalogHash:'bad'}},
      {...pending.capture,voices:{...voices,refreshVoices:[]}},{...pending.capture,voices:{...voices,refreshCostumes:[]}}]) {
      app.store.db.prepare(`UPDATE ${pending.table} SET friendship_unlocks=? WHERE operation_id=?`).run(JSON.stringify(corrupt),pending.operation.id);
      await reject(send('user_data/confirm',undefined),503);await reject(push(otherSaves(pending)),503);
      app.store.db.prepare(`UPDATE ${pending.table} SET friendship_unlocks=? WHERE operation_id=?`).run(pending.raw,pending.operation.id);
    }
    console.log('Synthetic friendship-level voice capture, split saves/ACK/floors and replay checks OK; native acceptance pending');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
