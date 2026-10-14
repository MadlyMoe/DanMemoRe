'use strict';

// Disposable synthetic saves, NOT native signatures,
// initialization, earning, scene/save order or no-crash acceptance.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request,rewardCharacterFixture,rewardCostumeFixture,rewardUnitStoryFixture}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const pcId=1011001005,costumeId=1021001005,stageId=1040010101101,now=1686794400;
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-pc-costumes-'));
  let app,port,database,sequence=0;
  const open=async()=>{
    app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async()=>{if(app){await app.close();app=null;}};
  const fresh=async name=>{await close();database=path.join(directory,`${name}.sqlite`);await open();};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const send=(action,body)=>request(port,++sequence,body,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const push=(putItems={},operations=[],deleteItems={})=>send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name] ?? [])]))},
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length ? [{signature:0,trigger:'Acquisition',putItems,deleteItems}] : [],
    operations:operations.map(row=>({id:row.id,verifier:row.token}))});
  const reject=async(pending,status,unavailable=false,before=snapshot())=>{
    const reply=await pending;assert.equal(reply.status,status,reply.body.toString());assert.equal(snapshot(),before);
    if(unavailable) assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const source={userId:seed.userId,id:1,itemId:pcId,amount:1,title:'Synthetic original PC',message:'',senderType:1,senderId:0,
    giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,pcHeroSublimateCount:0,
    state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0};
  const receive=()=>send('gift/receive',{userId:seed.userId,giftIds:[1]});
  try {
    assert.equal(master.pcProfiles[pcId].initialCostumeId,costumeId);
    assert(!seed.data.UserPC.some(row=>row.pcId===pcId));
    await fresh('catalog');
    for(const id of Object.values(master.pcs)) {
      // The home bootstrap retains an unjoined Hestia row, not an owned
      // reward unit. Its existing recovery boundary must stay strict.
      const before=app.store.read('UserPC').data.find(row=>row.pcId===id);
      if(before && before.joiningState!==1) {
        assert.throws(()=>app.store.giftPcTarget({pcId:id,extra:false,pcLimitBreakCount:0,pcHeroSublimateCount:0}),error=>error.status===400);
        continue;
      }
      const target=app.store.giftPcTarget({pcId:id,extra:false,pcLimitBreakCount:0,pcHeroSublimateCount:0}),
        first=!seed.data.UserPC.some(row=>row.pcId===id),original=master.pcProfiles[id].initialCostumeId;
      assert.equal(Object.hasOwn(target,'wardrobe'),Boolean(first && original));
      if(target.wardrobe) assert.deepEqual(target.wardrobe.targets.map(row=>row.costumeId),[original]);
      const stories=rewardUnitStoryFixture(app.store.read('UserAdventureStage').data,[id]).UserAdventureStage ?? [];
      assert.equal(Object.hasOwn(target,'unitStory'),Boolean(first && stories.length));
      if(target.unitStory) assert.equal(target.unitStory.stageId,stories[0].adventureStageId);
    }
    // The final archive's346 slot76 costumes have NO linked voice rows. The
    // shared helper must not substitute communication/default/CP voice pools.
    const initialIds=new Set(Object.values(master.pcProfiles).map(row=>row.initialCostumeId).filter(Boolean));
    assert.equal(initialIds.size,346);
    assert(!Object.values(master.communicationVoices).some(row=>initialIds.has(row.costumeId)));
    for(const kind of ['gift','gacha']) for(const beforeState of [null,1,2,3]) for(const first of ['costume','unit','story']) {
      await fresh(`${kind}-${beforeState}-${first}`);
      const initial=beforeState===null ? [] : [{userId:beforeState%2 ? 0 : seed.userId,costumeId,costumeState:beforeState}];
      put('UserCharacterCostume',initial);
      const storyState=beforeState===null ? null : beforeState===1 ? 0 : beforeState===2 ? 1 : 4,
        initialStories=storyState===null ? [] : [{userId:seed.userId,adventureStageId:stageId,state:storyState,
          currentScore:0,highScore:0,cumulativeClearCount:0,firstCompleteDateTime:0}];
      put('UserAdventureStage',initialStories);
      const originalCostumes=app.store.read('UserCharacterCostume'),originalVoices=app.store.read('UserCommunicationVoice');
      let operation;
      if(kind==='gift') {put('UserGift',[source]);operation=parse(await receive()).operations[0];}
      else operation=app.store.issueDraw([pcId]).operation; // Synthetic producer, NOT native draw/cost proof.
      const capture=kind==='gift' ? JSON.parse(app.store.db.prepare('SELECT targets FROM gift_pc_claim WHERE operation_id=?').get(operation.id).targets) :
        JSON.parse(app.store.db.prepare('SELECT pc_targets FROM lottery_draw_claim WHERE operation_id=?').get(operation.id).pc_targets)[0].target;
      assert.deepEqual(app.store.read('UserCharacterCostume'),originalCostumes);
      assert.deepEqual(app.store.read('UserCommunicationVoice'),originalVoices);
      assert.deepEqual(app.store.read('UserAdventureStage').data,initialStories,'Issue does not pre-open the unit story');
      assert.deepEqual(capture.unitStory,{stageId,beforeState:storyState});
      assert.equal(capture.wardrobe.before[0].state,beforeState ?? 1);
      assert.deepEqual(capture.wardrobe.targets,[{costumeId,state:Math.max(2,beforeState ?? 1),isNew:(beforeState ?? 1)===1,voices:[]}]);
      const {pcJobs,character,wardrobe,unitStory,...progress}=capture,
        acquired={UserPC:[{...structuredClone(seed.data.UserPC[0]),pcId,...progress,userId:seed.userId,joiningState:1}],
          UserPCJobSet:[{userId:seed.userId,pcId,pcJobs:pcJobs.map(row=>({...row,signature:0,abilityPanels:[]}))}],
          UserCharacter:rewardCharacterFixture(app.store.read('UserCharacter').data,[pcId]),
          ...rewardCostumeFixture(initial,[pcId],originalVoices.data),
          ...rewardUnitStoryFixture(initialStories,[pcId]),
          ...(kind==='gift' ? {UserGift:[{...source,state:1}]} : {})};
      const half=first==='costume' ? {UserCharacterCostume:acquired.UserCharacterCostume} :
        first==='story' ? {UserAdventureStage:acquired.UserAdventureStage} : {UserPC:acquired.UserPC};
      parse(await push(half));await close();await open();
      await reject(push({},[operation]),400);
      if(kind==='gacha' && first!=='unit') {
        const before=snapshot(),queue=app.store.operations(),savedCostumes=app.store.read('UserCharacterCostume'),savedStories=app.store.read('UserAdventureStage');
        assert.deepEqual(app.store.lotteryRecovery(operation),operation);assert.equal(snapshot(),before);
        parse(await send('user/login'));
        assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id),operation);
        assert.deepEqual(app.store.operations(),queue);assert.deepEqual(app.store.read('UserCharacterCostume'),savedCostumes);
        assert.deepEqual(app.store.read('UserAdventureStage'),savedStories);
      } else if(first==='unit' || first==='costume' && (beforeState ?? 1)===1 || first==='story' && !(storyState>0)) {
        if(kind==='gift') await reject(receive(),503,true);
        else await reject(send('user/login'),503,true);
      }
      if((beforeState ?? 1)===1 && first==='costume') {
        await reject(push({UserCharacterCostume:[{userId:0,costumeId,costumeState:1}]}),400);
        await reject(push({},[],{UserCharacterCostume:[{costumeId}]}),400);
      }
      if(first==='story' && !(storyState>0)) {
        await reject(push({UserAdventureStage:[{...acquired.UserAdventureStage[0],state:0}]}),400);
        await reject(push({},[],{UserAdventureStage:[{adventureStageId:stageId}]}),400);
      }
      const bad=structuredClone(acquired);bad.UserCharacterCostume[0].userId=9;
      await reject(push(bad,[operation]),400);
      // Floor insertion must roll back every native profile/receipt/ACK/reply.
      app.store.db.exec("CREATE TRIGGER fail_pc_wardrobe BEFORE INSERT ON costume_unlock_floor BEGIN SELECT RAISE(ABORT,'wardrobe floor rollback'); END");
      await reject(push(acquired,[operation]),503);app.store.db.exec('DROP TRIGGER fail_pc_wardrobe');
      parse(await push(acquired,[operation]));await close();await open();
      assert.deepEqual(app.store.operations(),[]);
      assert.equal(app.store.read('UserAdventureStage').data[0].state,storyState>0 ? storyState : 1);
      assert.deepEqual(JSON.parse(app.store.db.prepare('SELECT targets FROM gift_pc_floor WHERE pc_id=?').get(pcId).targets).unitStory,capture.unitStory);
      await reject(push({},[],{UserAdventureStage:[{adventureStageId:stageId}]}),400);
      await reject(push({UserAdventureStage:[{...acquired.UserAdventureStage[0],state:0}]}),400);
      await reject(push({UserAdventureStage:[{...acquired.UserAdventureStage[0],userId:9}]}),400);
      const completedStories=app.store.read('UserAdventureStage').data;
      put('UserAdventureStage',[]);
      assert.throws(()=>app.store.read('UserAdventureStage'),error=>error.status===503,'Cold reads preserve a missing earned story for reconciliation');
      await reject(send('user/login'),503,true);
      put('UserAdventureStage',completedStories);
      assert.equal(app.store.db.prepare("SELECT state FROM costume_unlock_floor WHERE table_name='UserCharacterCostume' AND id=?").get(costumeId).state,
        Math.max(2,beforeState ?? 1));
      await reject(push({},[],{UserCharacterCostume:[{costumeId}]}),400);
      await reject(push({UserCharacterCostume:[{userId:0,costumeId,costumeState:1}]}),400);
      assert.deepEqual(app.store.read('UserCommunicationVoice'),originalVoices,'PC acquisition never grants unrelated voices');
    }
    await fresh('legacy-target');put('UserGift',[source]);
    const operation=parse(await receive()).operations[0],receipt=app.store.db.prepare('SELECT targets FROM gift_pc_claim WHERE operation_id=?').get(operation.id),
      target=JSON.parse(receipt.targets);delete target.wardrobe;
    app.store.db.prepare('UPDATE gift_pc_claim SET targets=? WHERE operation_id=?').run(JSON.stringify(target),operation.id);
    await reject(receive(),503,true);await reject(push({},[operation]),503,true);
    assert.deepEqual(app.store.operations(),[operation],'Missing native pre-effect capture is retained, never retroactively backfilled');
    await fresh('legacy-story');put('UserGift',[source]);
    const storyOperation=parse(await receive()).operations[0],storyReceipt=app.store.db.prepare('SELECT targets FROM gift_pc_claim WHERE operation_id=?').get(storyOperation.id),
      storyTarget=JSON.parse(storyReceipt.targets);delete storyTarget.unitStory;
    app.store.db.prepare('UPDATE gift_pc_claim SET targets=? WHERE operation_id=?').run(JSON.stringify(storyTarget),storyOperation.id);
    await reject(receive(),503,true);await reject(push({},[storyOperation]),503,true);
    assert.deepEqual(app.store.operations(),[storyOperation],'Missing unit-story capture is not reconstructed from a later save');
    console.log('Synthetic PC slot76 wardrobe/unit-story capture, split saves, floors and rollback: OK (not native acceptance)');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
