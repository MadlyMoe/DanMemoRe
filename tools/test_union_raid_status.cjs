'use strict';
// DEFERRED / NOT RUN: execute only after every packet is implemented.
// Synthetic fresh-lobby probes are not native battle, save, UI or stability acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs'),{request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-union-raid-status-')),
    database=path.join(directory,'profile.sqlite'),value={unionRaidInfoId:413000001,debug:false},
    action='union_raid/status/get',logAction='union_raid/status/log',logValue={unionRaidInfoId:413000001},
    rankingAction='union_raid/ranking/member/get',rankingValues=[1,2,3].map(rankingType=>
      ({rankingType,unionRaidInfoId:413000001})),
    rewardAction='union_raid/reward/defeat',
    skillAction='union_raid/skill/get',skillValue={unionRaidInfoId:413000001},
    expected={code:0,available:true,unionId:414000001,medalAmount:0,
      defeatRewardExists:false,lastUpdateDateTime:0,lastUpdateIntermediateDateTime:0,
      stageInfo:[{unionRaidStageId:415000001,bosses:Array.from({length:5},(_,enemyIndex)=>({enemyIndex,hp:5787})),
        loopCount:1,defeatCount:0,familiaScore:0}],displayDefeatInfo:[],rank:0,unionBattleInfo:[],
      unionIntermediateBattleInfo:[],resultInfo:[]};
  const entryAction='union_raid/status/preinitiation',entryValue={unionRaidInfoId:413000001,
    unionRaidStageIndex:0,unionRaidStageId:415000001,defeatCount:0,debug:false},
    entryExpected={code:0,stageInfo:expected.stageInfo[0]};
  let app,port,sequence=0,now=1790834274;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app)await app.close();app=null;};
  const send=(body=value,id=++sequence,route=action)=>request(port,id,body,String(id),route),
    parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);},
    put=(name,data)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
      .run(JSON.stringify(data),md5(data),name),
    native=()=>app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),
    reject=async(body=value,id=++sequence,status=503,route=action)=>{
      const profiles=native(),queue=app.store.operations(),wallet=app.store.hardCurrency(),response=await send(body,id,route);
      assert.equal(response.status,status,response.body.toString());
      if(status===503)assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
      assert.deepEqual(native(),profiles);assert.deepEqual(app.store.operations(),queue);assert.equal(app.store.hardCurrency(),wallet);
    };
  const information={userId:seed.userId,unionRaidId:413000001,unionId:414000001,
    lastDisplayedUnionRaidRecord:0,readDefeatCount:0},
    saveInformation=async(rows,{remove=false,status=200}={})=>{
      const before=native(),queue=app.store.operations(),wallet=app.store.hardCurrency(),
        response=await request(port,++sequence,{badges:null,scripts:{},dataTokens:{},
          checksums:{before:{},after:{UserUnionRaidInformation:md5(remove?[]:rows)}},
          deltas:[{signature:0,trigger:'UnionRaid',deleteItems:remove?{UserUnionRaidInformation:rows}:{},
            putItems:remove?{}:{UserUnionRaidInformation:rows}}],operations:[]},String(sequence),'user_data/push');
      assert.equal(response.status,status,response.body.toString());
      if(status===200)parse(response);
      else {assert.deepEqual(native(),before);if(status===503)assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);}
      assert.deepEqual(app.store.operations(),queue);assert.equal(app.store.hardCurrency(),wallet);
    };
  try {
    await open();await reject();await reject(logValue,++sequence,503,logAction);
    for(const rankingValue of rankingValues)await reject(rankingValue,++sequence,503,rankingAction);
    await reject(value,++sequence,503,rewardAction);
    await saveInformation([information],{status:503});
    await reject(skillValue,++sequence,503,skillAction);
    await reject(entryValue,++sequence,503,entryAction);
    for(const bad of [null,{},[],true,{unionRaidInfoId:413000001},{unionRaidInfoId:413000001,debug:true},
      {unionRaidInfoId:1,debug:false},{...value,extra:1}])await reject(bad,++sequence,400);
    for(const bad of [null,{},[],true,{unionRaidInfoId:1},{...logValue,debug:false}])
      await reject(bad,++sequence,400,logAction);
    for(const bad of [null,{},[],true,{rankingType:1},{unionRaidInfoId:413000001},
      {rankingType:0,unionRaidInfoId:413000001},{rankingType:4,unionRaidInfoId:413000001},
      {rankingType:1.5,unionRaidInfoId:413000001},{rankingType:1,unionRaidInfoId:1},
      {...rankingValues[0],debug:false}])await reject(bad,++sequence,400,rankingAction);
    for(const bad of [null,{},[],true,{unionRaidInfoId:1},{...skillValue,debug:false}])
      await reject(bad,++sequence,400,skillAction);
    for(const bad of [null,{},[],true,{unionRaidInfoId:413000001},
      {...entryValue,unionRaidInfoId:1},{...entryValue,unionRaidStageIndex:-1},{...entryValue,unionRaidStageIndex:1},
      {...entryValue,unionRaidStageId:1},{...entryValue,defeatCount:-1},{...entryValue,defeatCount:1.5},
      {...entryValue,defeatCount:0x80000000},{...entryValue,debug:true},{...entryValue,extra:1}])
      await reject(bad,++sequence,400,entryAction);
    const currency=[{userId:seed.userId,currencyId:master.currencies['currency.valis'],amount:200000,
      cumulativeAmount:200000,reservedAmount:0,signature:0}];
    put('UserCurrency',currency);
    const created=parse(await request(port,++sequence,{name:'Union lobby',description:'Deferred original Union Raid fixture',
      godId:20000001,style:21000001,subStyle:0,activeTime:22000001,subActiveTime:0,requireApproval:false},String(sequence),'familia/create')),
      charge=created.operations[0],paid=[{...currency[0],amount:100000}];
    parse(await request(port,++sequence,{badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserCurrency:md5(paid)}},
      deltas:[{signature:0,trigger:'Familia',deleteItems:{},putItems:{UserCurrency:paid}}],
      operations:[{id:charge.id,verifier:charge.token}]},String(sequence),'user_data/push'));
    for(const bad of [null,{},[],true,{unionRaidInfoId:413000001},{unionRaidInfoId:413000001,debug:true},
      {unionRaidInfoId:1,debug:false},{...value,extra:1}]) await reject(bad,++sequence,400,rewardAction);
    await reject(value,++sequence,400,rewardAction); // No acknowledged defeat can be claimed.
    const before=native(),response=await send(),cached=sequence;
    assert.deepEqual(parse(response),expected);assert.deepEqual(native(),before);
    assert.deepEqual((await send(value,cached)).body,response.body);
    const logResponse=await send(logValue,++sequence,logAction),logCached=sequence;
    assert.deepEqual(parse(logResponse),{code:0,logs:[]});assert.deepEqual(native(),before);
    assert.deepEqual((await send(logValue,logCached,logAction)).body,logResponse.body);
    const rankingCached=[];
    for(const rankingValue of rankingValues) {
      const rankingResponse=await send(rankingValue,++sequence,rankingAction),cached=sequence;
      assert.deepEqual(parse(rankingResponse),{code:0,ranking:[]});assert.deepEqual(native(),before);
      assert.deepEqual((await send(rankingValue,cached,rankingAction)).body,rankingResponse.body);
      rankingCached.push(cached);
    }
    const entryResponse=await send(entryValue,++sequence,entryAction),entryCached=sequence;
    assert.deepEqual(parse(entryResponse),entryExpected);assert.deepEqual(native(),before);
    assert.deepEqual((await send(entryValue,entryCached,entryAction)).body,entryResponse.body);
    await saveInformation([information]);
    assert.deepEqual(app.store.read('UserUnionRaidInformation').data,[information]);
    assert.deepEqual(parse(await send(value,cached)),expected);
    assert.deepEqual(parse(await send(logValue,logCached,logAction)),{code:0,logs:[]});
    for(let index=0;index<rankingValues.length;index++)
      assert.deepEqual(parse(await send(rankingValues[index],rankingCached[index],rankingAction)),{code:0,ranking:[]});
    assert.deepEqual(parse(await send(entryValue,entryCached,entryAction)),entryExpected);
    for(const changed of [
      {...information,userId:0},{...information,userId:seed.userId+1},
      {...information,unionRaidId:0},{...information,unionRaidId:413000002},
      {...information,unionId:414000002},{...information,unionId:414000003},
      {...information,readDefeatCount:1},{...information,readDefeatCount:-1},
      {...information,readDefeatCount:0x80000000},
      {...information,lastDisplayedUnionRaidRecord:-1},{...information,lastDisplayedUnionRaidRecord:1.5},
      {...information,lastDisplayedUnionRaidRecord:Number.MAX_SAFE_INTEGER+1},
      {...information,signature:0},Object.fromEntries(Object.entries(information).filter(([key])=>key!=='readDefeatCount'))])
      await saveInformation([changed],{status:400});
    await saveInformation([information,information],{status:400});
    await saveInformation([{unionRaidId:413000001}],{remove:true,status:400});
    const viewed={...information,lastDisplayedUnionRaidRecord:now};
    await saveInformation([viewed]);
    assert.deepEqual(app.store.read('UserUnionRaidInformation').data,[viewed]);
    //2146278 uses the returned update, which can be zero after214635c's current-clock marker.
    await saveInformation([information]);
    await close();await open();assert.deepEqual(app.store.read('UserUnionRaidInformation').data,[information]);
    assert.deepEqual(parse(await send()),expected);
    app.store.db.exec(`CREATE TRIGGER fail_union_information BEFORE UPDATE ON profile
      WHEN NEW.name='UserUnionRaidInformation' BEGIN SELECT RAISE(ABORT,'union information rollback'); END`);
    await saveInformation([viewed],{status:503});app.store.db.exec('DROP TRIGGER fail_union_information');
    put('UserUnionRaidInformation',[{...information,unionId:0}]);
    assert.deepEqual(parse(await send()),expected);await saveInformation([information]);
    for(const imported of [{...information,unionId:414000002},{...information,readDefeatCount:1}]) {
      put('UserUnionRaidInformation',[imported]);await reject();await reject(entryValue,++sequence,503,entryAction);
      const retained={...imported,lastDisplayedUnionRaidRecord:now};
      await saveInformation([retained]);assert.deepEqual(app.store.read('UserUnionRaidInformation').data,[retained]);
      await saveInformation([information],{status:400});
    }
    put('UserUnionRaidInformation',[]);
    for(const userId of [0,seed.userId]) {
      const emptyMedal={userId,medalId:410000001,amount:0,reservedAmount:0,bookEntryState:0,
        signature:0xffffffff,cumulativeAmount:0};
      put('UserUnionRaidMedal',[emptyMedal]);
      assert.deepEqual(parse(await send()),expected);
      assert.deepEqual(parse(await send(logValue,++sequence,logAction)),{code:0,logs:[]});
      assert.deepEqual(parse(await send(entryValue,++sequence,entryAction)),entryExpected);
      assert.deepEqual(app.store.read('UserUnionRaidMedal').data,[emptyMedal]);
      for(const field of ['amount','reservedAmount','cumulativeAmount']) {
        const progress={...emptyMedal,[field]:1,...(field==='amount'?{cumulativeAmount:1}:
          field==='reservedAmount'?{amount:1,cumulativeAmount:1}:{})};
        put('UserUnionRaidMedal',[progress]);await reject();await reject(entryValue,++sequence,503,entryAction);
      }
    }
    put('UserUnionRaidMedal',[]);
    const skillResponse=await send(skillValue,++sequence,skillAction),skillCached=sequence;
    assert.deepEqual(parse(skillResponse),{code:0,unionRaidSkills:[]});
    assert.deepEqual((await send(skillValue,skillCached,skillAction)).body,skillResponse.body);
    const creationOperationId=app.store.db.prepare('SELECT creation_operation_id FROM local_familia').get().creation_operation_id;
    app.store.db.prepare(`INSERT INTO union_raid_skill_progress
      (union_raid_info_id,creation_operation_id,union_raid_skill_group_id,medal_amount,upgraded_at) VALUES(?,?,?,?,?)`)
      .run(413000001,creationOperationId,423000001,50000,now);
    app.store.db.prepare(`INSERT INTO union_raid_skill_progress
      (union_raid_info_id,creation_operation_id,union_raid_skill_group_id,medal_amount,upgraded_at) VALUES(?,?,?,?,?)`)
      .run(413000001,creationOperationId,423000008,66000,now);
    await reject(skillValue,skillCached,503,skillAction);
    assert.deepEqual(parse(await send(skillValue,++sequence,skillAction)),{code:0,unionRaidSkills:[
      {unionRaidSkillId:424000001,medalAmount:50000},{unionRaidSkillId:424000352,medalAmount:66000}]});
    app.store.db.prepare('UPDATE union_raid_skill_progress SET medal_amount=? WHERE union_raid_skill_group_id=?')
      .run(1650001,423000001);
    await reject(skillValue,++sequence,503,skillAction);
    app.store.db.prepare('UPDATE union_raid_skill_progress SET medal_amount=? WHERE union_raid_skill_group_id=?')
      .run(50000,423000001);
    for(const table of ['UserUnionRaidInformation','UserUnionRaidMedal','UserUnionRaidBossSpTicketItem',
      'UserUnionRaidNormalSpTicketItem']) {
      put(table,[{}]);await reject(value,cached);await reject();
      await reject(logValue,logCached,503,logAction);await reject(logValue,++sequence,503,logAction);
      await reject(entryValue,entryCached,503,entryAction);await reject(entryValue,++sequence,503,entryAction);put(table,[]);
    }
    const stages=app.store.read('UserAdventureStage').data;
    put('UserAdventureStage',[...stages,{adventureStageId:1280000101101}]);await reject(value,cached);
    await reject(logValue,logCached,503,logAction);await reject(entryValue,entryCached,503,entryAction);
    put('UserAdventureStage',stages);
    const battle=app.store.read('UserAdventureState').data;
    put('UserAdventureState',[{...battle[0],stageId:1280000101101}]);await reject();
    await reject(logValue,++sequence,503,logAction);await reject(entryValue,++sequence,503,entryAction);
    put('UserAdventureState',battle);
    const pending=app.store.db.prepare('INSERT INTO operation_queue(type,parameters,token,signature) VALUES(?,?,?,0)')
      .run(99999,JSON.stringify({UserUnionRaidMedal:[]}),md5('deferred-union-raid-operation'));
    await reject();await reject(logValue,++sequence,503,logAction);await reject(entryValue,++sequence,503,entryAction);
    app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(pending.lastInsertRowid);
    now--;
    await reject();await reject(logValue,++sequence,503,logAction);await reject(entryValue,++sequence,503,entryAction);
    now++;
    const initializedMedal={userId:seed.userId,medalId:410000001,amount:0,reservedAmount:0,
      bookEntryState:0,signature:0xffffffff,cumulativeAmount:0};
    put('UserUnionRaidMedal',[initializedMedal]);
    await saveInformation([information]);
    await close();await open();assert.deepEqual(parse(await send()),expected);
    assert.deepEqual(app.store.read('UserUnionRaidInformation').data,[information]);
    assert.deepEqual(app.store.read('UserUnionRaidMedal').data,[initializedMedal]);
    assert.deepEqual(parse(await send(logValue,++sequence,logAction)),{code:0,logs:[]});
    for(const rankingValue of rankingValues)
      assert.deepEqual(parse(await send(rankingValue,++sequence,rankingAction)),{code:0,ranking:[]});
    assert.deepEqual(parse(await send(entryValue,++sequence,entryAction)),entryExpected);
    assert.deepEqual(parse(await send(skillValue,++sequence,skillAction)),{code:0,unionRaidSkills:[
      {unionRaidSkillId:424000001,medalAmount:50000},{unionRaidSkillId:424000352,medalAmount:66000}]});
  } finally {
    await close();
    assert.ok(path.basename(directory).startsWith('danmemore-union-raid-status-'));
    fs.rmSync(directory,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
