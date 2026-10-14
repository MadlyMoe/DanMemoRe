'use strict';
// DEFERRED / NOT RUN: execute only after every packet is implemented.
// Synthetic source-contract coverage is not native battle/save/UI acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs'),{request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-union-raid-completion-')),
    database=path.join(directory,'profile.sqlite'),stageId=1280000101101,raidStageId=415000001,
    value={adventureRecord:{normalAttackCount:1,skillCount:2,specialSkillCount:0,linkageSkillCount:0,
      deathCount:0,continueCount:0,turnCount:3},adventureStageId:stageId,token:'union-training-1',
      adventureStageTaskIds:[],adventureGainedItems:[],friendshipStates:[],isEnemyAnnihilated:true,
      secretMissionCompleted:false,unionRaidStageId:raidStageId,unionRaidStageIndex:0,loopCount:1,
      bosses:Array.from({length:5},(_,enemyIndex)=>({enemyIndex,damage:100+enemyIndex})),isTraining:true,debug:false},
    expected={code:0,stageInfo:{unionRaidStageId:raidStageId,
      bosses:Array.from({length:5},(_,enemyIndex)=>({enemyIndex,hp:5787})),loopCount:1,defeatCount:0,familiaScore:0}};
  let app,port,sequence=0,now=1790834274;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app)await app.close();app=null;};
  const send=(body=value,id=++sequence)=>request(port,id,body,String(id),'union_raid/stage/complete'),
    parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);},
    put=(name,data)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
      .run(JSON.stringify(data),md5(data),name),
    snapshot=()=>({profile:app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),
      queue:app.store.operations(),wallet:app.store.hardCurrency(),paid:app.store.paidCurrency(),
      receipts:app.store.db.prepare('SELECT * FROM union_raid_training_completion ORDER BY request_key').all(),
      scored:app.store.db.prepare('SELECT * FROM union_raid_scored_completion ORDER BY operation_id').all(),
      progress:app.store.db.prepare('SELECT * FROM union_raid_progress ORDER BY creation_operation_id').all(),
      deliveries:app.store.db.prepare('SELECT * FROM stage_delivery ORDER BY operation_id').all(),
      completions:app.store.db.prepare('SELECT * FROM stage_completion ORDER BY operation_id').all(),
      floors:app.store.db.prepare('SELECT * FROM stage_state_floor ORDER BY stage_id').all()}),
    reject=async(body=value,id=++sequence,status=400)=>{const before=snapshot(),response=await send(body,id);
      assert.equal(response.status,status,response.body.toString());
      if(status===503)assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
      assert.deepEqual(snapshot(),before);};
  try {
    await open();await reject(value,++sequence,503);
    const currency=[{userId:seed.userId,currencyId:master.currencies['currency.valis'],amount:200000,
      cumulativeAmount:200000,reservedAmount:0,signature:0}];
    put('UserCurrency',currency);
    const created=parse(await request(port,++sequence,{name:'Union training',description:'Deferred original Union Raid fixture',
      godId:20000001,style:21000001,subStyle:0,activeTime:22000001,subActiveTime:0,requireApproval:false},
      String(sequence),'familia/create')),charge=created.operations[0],paid=[{...currency[0],amount:100000}];
    parse(await request(port,++sequence,{badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserCurrency:md5(paid)}},
      deltas:[{signature:0,trigger:'Familia',deleteItems:{},putItems:{UserCurrency:paid}}],
      operations:[{id:charge.id,verifier:charge.token}]},String(sequence),'user_data/push'));
    const stage={...seed.data.UserAdventureStage[0],adventureStageId:stageId,state:1,token:'',tasks:[],
      cumulativeClearCount:0,dailyClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0},
      battle={...seed.data.UserAdventureState[0],stageId};
    put('UserAdventureStage',[stage]);put('UserAdventureState',[battle]);
    const ints=['pcId','pcLv','assiId','assiLv','wpPerf','amPerf','str','int','agi','vit','luck',
      'hp','mp','physical','magic','defense','actCnt','spCnt','lsCnt'],
      longs=['wpId','wpAbi1','wpAbi2','wpAbi3','wpAbi4','wpAbi5','amId','amAbi1','amAbi2','amAbi3','amAbi4','amAbi5','pcDamage','enemyDamage'],
      pc=Object.fromEntries([...ints,...longs].map(key=>[key,0])),battleLog=[pc,['gauge',0]],
      scored={...value,isTraining:false,battleLog};
    const malformed=[null,{},[],true,{...value,extra:1},{...value,debug:true},
      {...value,adventureStageId:0},{...value,adventureStageId:1.5},{...value,adventureStageId:Number.MAX_SAFE_INTEGER+1},
      {...value,battleLog},
      {...value,unionRaidStageId:1},{...value,unionRaidStageIndex:1},{...value,loopCount:2},
      {...value,skipCount:1},{...value,userGuestPc:{}},{...value,secretMissionCompleted:true},
      {...value,adventureStageTaskIds:[1]},{...value,adventureGainedItems:[{itemId:1,amount:1}]},
      {...value,friendshipStates:[{}]},{...value,bosses:value.bosses.slice(0,4)},
      {...value,bosses:value.bosses.map((boss,index)=>index===0?{...boss,enemyIndex:1}:boss)},
      {...value,bosses:value.bosses.map((boss,index)=>index===0?{...boss,damage:-1}:boss)},
      {...value,adventureRecord:{continueCount:0,deathCount:0,turnCount:1}}];
    for(const body of malformed)await reject(body);
    await reject({...value,isTraining:false}); // Original nontraining branch requires battleLog.
    await reject(scored,++sequence,503);
    await reject({...scored,battleLog:{gauge:0}});
    await reject({...scored,battleLog:[pc]});
    await reject({...scored,battleLog:[pc,['gauge',Number.MAX_SAFE_INTEGER+1]]});
    for(const [field,outside] of [['str',0x80000000],['wpId',Number.MAX_SAFE_INTEGER+1]])
      await reject({...scored,battleLog:[{...pc,[field]:outside},['gauge',0]]});
    await reject({...scored,battleLog:[{...pc,str:-0x80000000,wpId:Number.MAX_SAFE_INTEGER},['gauge',-1]]},++sequence,503);
    const base=snapshot();
    for(const table of ['UserUnionRaidInformation','UserUnionRaidMedal','UserUnionRaidBossSpTicketItem',
      'UserUnionRaidNormalSpTicketItem']) {put(table,[{}]);await reject(value,++sequence,503);put(table,[]);}
    put('UserAdventureState',[{...battle,stageId:1}]);await reject(value,++sequence,400);put('UserAdventureState',[battle]);
    const pending=app.store.db.prepare('INSERT INTO operation_queue(type,parameters,token,signature) VALUES(?,?,?,0)')
      .run(99999,JSON.stringify({UserUnionRaidMedal:[]}),md5('union-training-pending'));
    await reject(value,++sequence,503);app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(pending.lastInsertRowid);
    assert.deepEqual(snapshot(),base);
    app.store.db.exec(`CREATE TRIGGER fail_union_training BEFORE INSERT ON union_raid_training_completion
      BEGIN SELECT RAISE(ABORT,'union training rollback'); END`);
    await reject(value,++sequence,503);app.store.db.exec('DROP TRIGGER fail_union_training');
    const initializedMedal={userId:seed.userId,medalId:410000001,amount:0,reservedAmount:0,
      bookEntryState:0,signature:0xffffffff,cumulativeAmount:0};
    put('UserUnionRaidMedal',[initializedMedal]);
    const initializedInformation={userId:seed.userId,unionRaidId:413000001,unionId:414000001,
      lastDisplayedUnionRaidRecord:now,readDefeatCount:0};
    put('UserUnionRaidInformation',[initializedInformation]);
    const before=snapshot(),response=await send(),identity=sequence,body=parse(response);
    assert.equal(body.code,0);assert.deepEqual(body.stageInfo,expected.stageInfo);
    const operation=body.operation;
    assert.equal(operation.type,5000);assert.deepEqual(body.operations,[operation]);
    assert.deepEqual(operation.parameters.gainedItems,[]);assert.deepEqual(operation.parameters.gainedPCs,[]);
    assert.deepEqual(operation.parameters.friendshipStates,[]);assert.equal(operation.parameters.activeTimeAvailable,false);
    assert.equal(operation.parameters.UserAdventureStage[0].adventureStageId,stageId);
    assert.deepEqual(app.store.db.prepare('SELECT request_json,response_json,operation_id FROM union_raid_training_completion').get(),
      {request_json:JSON.stringify(value),response_json:JSON.stringify(body),operation_id:operation.id});
    const after=snapshot();assert.deepEqual(after.profile,before.profile);assert.deepEqual(after.queue,[operation]);
    assert.deepEqual(app.store.read('UserUnionRaidMedal').data,[initializedMedal]);
    assert.deepEqual(app.store.read('UserUnionRaidInformation').data,[initializedInformation]);
    assert.equal(after.wallet,before.wallet);assert.equal(after.paid,before.paid);assert.equal(after.receipts.length,1);
    assert.deepEqual((await send(value,identity)).body,response.body);
    await reject({...value,bosses:value.bosses.map(boss=>({...boss,damage:boss.damage+1}))},identity,400);
    await reject({...value,adventureRecord:{...value.adventureRecord,turnCount:4}},++sequence,400);
    await close();await open();assert.deepEqual(parse(await send(value,identity)),body);
    put('UserAdventureState',[{...battle,stageId:1}]);await reject(value,identity,400);put('UserAdventureState',[battle]);
    app.store.db.prepare('UPDATE union_raid_training_completion SET response_json=?').run('{}');
    await reject(value,identity,503);
    app.store.db.prepare('UPDATE union_raid_training_completion SET response_json=?').run(JSON.stringify(body));
    app.store.db.prepare('UPDATE union_raid_training_completion SET operation_id=NULL').run();
    await reject(value,identity,503); // Legacy bare replies do not acquire invented clear/ACK proof.
    app.store.db.prepare('UPDATE union_raid_training_completion SET operation_id=?').run(operation.id);
    const push=async({savedStage,savedBattle,ack=true,status=200}={})=>{
      const puts={...(savedStage?{UserAdventureStage:[savedStage]}:{}),...(savedBattle?{UserAdventureState:[savedBattle]}:{})},
        before=snapshot(),response=await request(port,++sequence,{badges:null,scripts:{},dataTokens:{},
          checksums:{before:{},after:Object.fromEntries(Object.entries(puts).map(([name,rows])=>[name,md5(rows)]))},
          deltas:Object.keys(puts).length?[{signature:0,trigger:'AdventureFinish',deleteItems:{},putItems:puts}]:[],
          operations:ack?[{id:operation.id,verifier:operation.token}]:[]},String(sequence),'user_data/push');
      assert.equal(response.status,status,response.body.toString());
      if(status===200)parse(response);else assert.deepEqual(snapshot(),before);
    },cleared={...operation.parameters.UserAdventureStage[0],state:4,cumulativeClearCount:1,dailyClearCount:1,
      firstCompleteDateTime:now,lastCompleteDateTime:now},clearedBattle={...battle,stageId:0};
    await push({status:400});
    await push({savedStage:cleared,status:400});
    await push({savedBattle:clearedBattle,status:400});
    await push({savedStage:{...cleared,cumulativeClearCount:2},savedBattle:clearedBattle,status:400});
    app.store.db.exec(`CREATE TRIGGER fail_union_ack BEFORE INSERT ON operation_done
      WHEN NEW.id=${operation.id} BEGIN SELECT RAISE(ABORT,'union ACK rollback'); END`);
    await push({savedStage:cleared,savedBattle:clearedBattle,status:503});app.store.db.exec('DROP TRIGGER fail_union_ack');
    await push({savedStage:cleared,ack:false});
    assert.deepEqual(app.store.operations(),[operation]);await reject(value,identity,503);
    await close();await open();
    const confirm=parse(await request(port,++sequence,{},String(sequence),'user_data/confirm')),
      pending=confirm.operations.find(row=>row.id===operation.id);
    assert.equal(pending.parameters.offlineStageClearCountsApplied,1);
    assert.equal(pending.parameters.offlineStageLastDateApplied,1);
    assert.equal(app.store.read('UserAdventureStage').data[0].cumulativeClearCount,1);
    await push({savedBattle:clearedBattle});
    assert.equal(app.store.operations().length,0);
    assert.ok(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id));
    assert.equal(app.store.db.prepare('SELECT clear_count FROM stage_state_floor WHERE stage_id=?').get(stageId).clear_count,1);
    const settledBefore=snapshot(),settledReplay=parse(await send(value,identity));
    assert.equal(Object.hasOwn(settledReplay,'operation'),false);
    assert.deepEqual(settledReplay.operations,[]);
    assert.deepEqual(settledReplay.stageInfo,body.stageInfo);
    assert.deepEqual(settledReplay.UserAdventureStage,body.UserAdventureStage);
    assert.deepEqual(snapshot(),settledBefore);
    app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(operation.id);
    await reject(value,identity,503);
    app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(operation.id);
    app.store.db.prepare('INSERT INTO operation_queue(id,type,parameters,token,signature) VALUES(?,?,?,?,?)')
      .run(operation.id,operation.type,JSON.stringify(operation.parameters),operation.token,operation.signature);
    await reject(value,identity,503);
    app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(operation.id);
    const settledFloor=app.store.db.prepare('SELECT * FROM stage_state_floor WHERE stage_id=?').get(stageId);
    app.store.db.prepare('UPDATE stage_state_floor SET clear_count=? WHERE stage_id=?')
      .run(settledFloor.clear_count+1,stageId);
    await reject(value,identity,503);
    app.store.db.prepare('UPDATE stage_state_floor SET clear_count=? WHERE stage_id=?')
      .run(settledFloor.clear_count,stageId);
    const settledDelivery=app.store.db.prepare('SELECT operation_json FROM stage_delivery WHERE operation_id=?').get(operation.id);
    app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run('{}',operation.id);
    await reject(value,identity,503);
    app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?')
      .run(settledDelivery.operation_json,operation.id);
    put('UserAdventureState',[battle]);await reject(value,identity,503);put('UserAdventureState',[clearedBattle]);
    await close();await open();
    assert.deepEqual(parse(await send(value,identity)),settledReplay);
    const lobby=parse(await request(port,++sequence,{unionRaidInfoId:413000001,debug:false},String(sequence),'union_raid/status/get'));
    assert.deepEqual(lobby.stageInfo,[expected.stageInfo]);
    assert.deepEqual(parse(await request(port,++sequence,{unionRaidInfoId:413000001,unionRaidStageIndex:0,
      unionRaidStageId:raidStageId,defeatCount:0,debug:false},String(sequence),'union_raid/status/preinitiation')),expected);
    assert.equal(app.store.read('UserAdventureState').data[0].stageId,0);
    assert.deepEqual(app.store.read('UserUnionRaidInformation').data,[initializedInformation]);
    assert.deepEqual(app.store.read('UserUnionRaidMedal').data,[initializedMedal]);
    const settled=snapshot();assert.equal(settled.wallet,before.wallet);assert.equal(settled.paid,before.paid);
    put('UserAdventureState',[battle]);
    await reject({...value,token:'union-training-same-second'},++sequence,503);
    now++;
    const next=parse(await send({...value,token:'union-training-2'}));
    assert.notEqual(next.operation.id,operation.id);assert.equal(next.operation.type,5000);
    assert.equal(next.operation.parameters.UserAdventureStage[0].cumulativeClearCount,1);
    await reject(value,identity,503); // An older settled result cannot replace a newer issued completion.
  } finally {
    await close();assert.ok(path.basename(directory).startsWith('danmemore-union-raid-completion-'));
    fs.rmSync(directory,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
