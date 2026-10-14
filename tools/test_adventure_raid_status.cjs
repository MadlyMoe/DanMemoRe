'use strict';
// DEFERRED / NOT RUN: execute only after all packet implementation is finished.
// Synthetic HTTP/SQLite coverage is not native raid UI, battle, save, or recovery acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request,stageXpFixture}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-adventure-raid-')),
    database=path.join(directory,'profile.sqlite'),value={raidGroupId:694000001},action='raid/status';
  let now=1530237600,sequence=0,app,port,configuredMaster=master;
  const open=async()=>{app=createServer({database,seed,master:configuredMaster,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app)await app.close();app=null;};
  const send=(body=value,at=++sequence)=>request(port,at,body,String(at),action);
  try {
    await open();
    const profiles=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),first=await send(),body=JSON.parse(first.body);
    assert.equal(first.status,200);assert.deepEqual(body,{code:0,raidGroupId:694000001,
      parts:[{id:695000001,lastUpdatedAt:1530237600,hp:10000,damage:0,completedAt:0}]});
    assert.deepEqual(app.store.db.prepare('SELECT group_id,part_id,hp,damage,last_updated_at,completed_at FROM adventure_raid_part_status').all(),
      [{group_id:694000001,part_id:695000001,hp:10000,damage:0,last_updated_at:1530237600,completed_at:0}]);
    assert.deepEqual(app.store.db.prepare('SELECT user_id,raid_id,group_id,selected_at FROM adventure_raid_context').all(),
      [{user_id:seed.userId,raid_id:693000001,group_id:694000001,selected_at:1530237600}]);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),profiles);
    assert.deepEqual((await send(value,sequence)).body,first.body);
    const currentHash=app.store.db.prepare('SELECT source_hash FROM adventure_raid_part_status').get().source_hash,
      legacyHash=crypto.createHash('md5').update(JSON.stringify({sources:{
        adventureRaid:'62edc7604e0f27634cf62a9076a92e484567c0749beae3d1b82ba232315f45e8',
        adventureRaidGroup:'782a7bb9004e384ae7e4d0723cf1a2a1c6cf3460394834364daaed052a7342cb',
        adventureRaidPart:'295bf7d000c74543e716b0b29b7ba8d888e8c0c53b71089c813a08d29f91e1f0',
        adventureRaidPartStage:'84c2e61d0286825f15a358069a3b3b7282707c60c85389c72b73fe2644c18776'},
      raid:{slot1:7160000101,slot2:7170000101,startAt:1530237600,endAt:1531202399},
      group:{name:'Battle Field',raidId:693000001,startAt:1530237600,endAt:1531202399},
      parts:[['695000001',{groupId:694000001,order:1,hp:10000}]]})).digest('hex');
    app.store.db.prepare('UPDATE adventure_raid_part_status SET source_hash=?').run(legacyHash);
    assert.equal((await send(value,sequence)).status,200);
    assert.equal((await send()).status,200);
    assert.equal(app.store.db.prepare('SELECT source_hash FROM adventure_raid_part_status').get().source_hash,currentHash);
    app.store.db.prepare('UPDATE adventure_raid_part_status SET source_hash=?,damage=1').run(legacyHash);
    const changedLegacy=await send();assert.equal(changedLegacy.status,503);
    assert.deepEqual(app.store.db.prepare('SELECT damage,source_hash FROM adventure_raid_part_status').get(),
      {damage:1,source_hash:legacyHash});
    app.store.db.prepare('UPDATE adventure_raid_part_status SET source_hash=?,damage=0').run(currentHash);
    await close();await open();assert.deepEqual(JSON.parse((await send()).body),body);
    const retained=app.store.db.prepare('SELECT * FROM adventure_raid_part_status').all();
    for(const bad of [null,{},[],{raidGroupId:0},{raidGroupId:1.5},{raidGroupId:694000001,extra:true}])
      assert.equal((await send(bad)).status,400);
    now=1531202400;
    const expired=await send();assert.equal(expired.status,503);assert.equal(JSON.parse(expired.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM adventure_raid_part_status').all(),retained);
    now=1530237600;await close();configuredMaster={...master,adventureRaidPartStages:{}};await open();
    const partial=await send();assert.equal(partial.status,503);assert.equal(JSON.parse(partial.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM adventure_raid_part_status').all(),retained);
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}

async function completion() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-adventure-raid-completion-')),
    database=path.join(directory,'profile.sqlite'),fixture=structuredClone(seed),stageId=1170000101102;
  fixture.data.UserAdventureStage.push({...fixture.data.UserAdventureStage[0],adventureStageId:stageId,tasks:[]});
  fixture.dataTokens.UserAdventureStage=md5(fixture.data.UserAdventureStage);
  let sequence=0,app,port;
  const send=(action,body)=>request(port,++sequence,body,String(sequence),action),parse=response=>{
    assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);
  };
  try {
    app=createServer({database,seed:fixture,master,wallNowSeconds:()=>1530237600,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
    parse(await send('raid/status',{raidGroupId:694000001}));
    const body={adventureStageId:stageId,token:'raid-completion',adventureStageTaskIds:[],adventureGainedItems:[],
      friendshipStates:[],isEnemyAnnihilated:true,secretMissionCompleted:false,
      adventureRecord:{continueCount:0,deathCount:0,turnCount:3,isRaid:true,raidDamage:21736}};
    assert.equal((await send('adventure/stage/complete',{...body,adventureRecord:{...body.adventureRecord,raidDamage:1}})).status,400);
    const operation=parse(await send('adventure/stage/complete',body)).operation;
    assert.equal(operation.type,5000);
    assert.deepEqual(app.store.db.prepare(`SELECT group_id,part_id,stage_id,damage,before_damage,after_damage
      FROM adventure_raid_completion WHERE operation_id=?`).get(operation.id),
      {group_id:694000001,part_id:695000001,stage_id:stageId,damage:21736,before_damage:0,after_damage:10000});
    assert.equal(parse(await send('raid/status',{raidGroupId:694000001})).parts[0].damage,0);
    const before=operation.parameters.UserAdventureStage[0],saved={...before,state:4,cumulativeClearCount:1,dailyClearCount:1,
      firstCompleteDateTime:1530237601,lastCompleteDateTime:1530237601},
      putItems=stageXpFixture(app.store,{UserAdventureStage:[saved]},[operation]),
      push={badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
        Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
        deltas:[{signature:0,trigger:'AdventureComplete',putItems,deleteItems:{}}],
        operations:[{id:operation.id,verifier:operation.token}]};
    parse(await send('user_data/push',push));
    const settled=parse(await send('raid/status',{raidGroupId:694000001})).parts[0];
    assert.deepEqual(settled,{id:695000001,lastUpdatedAt:1530237601,hp:10000,damage:10000,completedAt:1530237601});
    assert.equal((await send('adventure/stage/complete',body)).status,503);
  } finally {
    if(app) await app.close();
    fs.rmSync(directory,{recursive:true,force:true});
  }
}
main().then(completion).catch(error=>{console.error(error);process.exitCode=1;});
