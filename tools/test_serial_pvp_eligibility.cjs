'use strict';

// DEFERRED / NOT RUN. Temporary native-shaped prerequisite fixtures, NOT
// earned stage/training progress, native signatures/order or UI acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const {serialPvpUnlockConfig,serialPvpUnlockFlag,serialPvpEligibility}=require('./serial_pvp.cjs');
const master=require('../data/danmemore-master.json'),seed=require('../data/danmemore-seed.json');
const config=serialPvpUnlockConfig(master),id=81000000001,season=master.serialPvp.serialPvpInformation[id],
  summary='serial_pvp/summary/get',flagTable='UserSystemFlag';
const originalFlag=seed.data.UserSystemFlag.find(row=>row.systemFlagId===config.id);
const stage=(state=4)=>({...structuredClone(seed.data.UserAdventureStage[0]),adventureStageId:config.condition.slot1,state,tasks:[]});
const record=(score=1800,pvpId=master.pvpInformationIds[0])=>({userId:seed.userId,pvpId,
  gradeId:Number(Object.entries(master.pvp.grades).find(([,row])=>row.groupId===pvpId)[0]),rank:0,score,winCount:0,loseCount:0,
  consecutiveWinCount:0,consecutiveLoseCount:0,lastAdversaryIds:[],lastBattleId:'',isAggregate:false,isReceiveReward:false,highestGradeId:0});
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
async function main() {
  assert.equal(config.id,91218027);assert.equal(config.condition.slot1,1010000105111);assert.equal(config.condition.slot2,1800);
  const eligible=(state,score,flags=[originalFlag])=>serialPvpEligibility(flags,[stage(state)],[record(score)],master,seed.userId).eligible;
  assert.equal(eligible(4,1799),false);assert.equal(eligible(3,1800),false);assert.equal(eligible(4,1800),true);
  assert.equal(serialPvpEligibility([],[],[],master,seed.userId).eligible,false);
  assert.equal(serialPvpEligibility([],[stage()],[record()],master,seed.userId).eligible,true,'Missing native row uses original default0');
  assert.equal(serialPvpEligibility([originalFlag],[stage()],[record(1),record(1800,master.pvpInformationIds[1])],master,seed.userId).eligible,true,
    'Native checker uses ANY saved War Game score, not only a current-season ID');
  for(const value of [1,2]) assert.equal(serialPvpEligibility([{...originalFlag,flagValue:value}],null,null,master,seed.userId).eligible,true,
    'Sticky nonzero flag bypasses stage/training reads');
  for(const change of [{userId:seed.userId+1},{systemFlagId:String(config.id)},{flagValue:3},{flagValue:true},{lastUpdatedAt:-1},{extra:0}])
    assert.throws(()=>serialPvpUnlockFlag([{...originalFlag,...change}],master,seed.userId),/reconciliation/);
  assert.throws(()=>serialPvpUnlockFlag([originalFlag,originalFlag],master,seed.userId),/reconciliation/);
  assert.throws(()=>serialPvpEligibility([originalFlag],[stage(),stage()],[record()],master,seed.userId),/reconciliation/);
  assert.throws(()=>serialPvpEligibility([originalFlag],[{...stage(),userId:seed.userId+1}],[record()],master,seed.userId),/reconciliation/);
  for(const change of [{userId:seed.userId+1},{userId:0},{pvpId:0},{score:'1800'},{score:0x80000000},{rank:false},{lastBattleId:0},{extra:0}])
    assert.throws(()=>serialPvpEligibility([originalFlag],[stage()],[{...record(),...change}],master,seed.userId),/reconciliation/);
  assert.throws(()=>serialPvpEligibility([originalFlag],[stage()],[record(),record()],master,seed.userId),/reconciliation/);
  const changed=structuredClone(master);changed.systemFlags[config.id].readonly=true;
  assert.throws(()=>serialPvpUnlockConfig(changed),/reconciliation/);

  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-abyss-unlock-'));
  let database,app,port,sequence=0,fixture=0,now=season.slot3+100;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const fresh=async()=>{await close();database=path.join(directory,`${++fixture}.sqlite`);await open();};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const flags=value=>app.store.read(flagTable).data.map(row=>row.systemFlagId===config.id?{...row,flagValue:value}:row);
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const delta=(puts={},deletes={})=>({badges:null,scripts:{},dataTokens:{},operations:[],checksums:{before:{},after:
    Object.fromEntries([...new Set([...Object.keys(puts),...Object.keys(deletes)])].map(name=>[name,md5(puts[name] ?? [])]))},
    deltas:[{signature:0,trigger:'UpdateSerialPvpState',putItems:puts,deleteItems:deletes}]});
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected=async(action,value,status=503)=>{const before=snapshot(),reply=await send(action,value);
    assert.equal(reply.status,status,reply.body.toString());if(status===503)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Failed eligibility/save must retain native profiles, capture, sequence and reply');};
  const unlockRow=()=>app.store.db.prepare('SELECT * FROM serial_pvp_unlock WHERE user_id=?').get(seed.userId);
  try {
    await fresh();app.store.changeHardCurrency(100);
    await rejected(summary,{serialPvpId:id});await rejected('currency/hard/consume',{consumeId:81071001});
    await rejected('user_data/push',delta({[flagTable]:[{...originalFlag,flagValue:2}]}));
    put('UserAdventureStage',[stage()]);put('UserPvPRecord',[record(1799)]);
    await rejected(summary,{serialPvpId:id});await rejected('user_data/push',delta({[flagTable]:[{...originalFlag,flagValue:2}]}));
    put('UserPvPRecord',[record()]);const profiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
    parse(await send(summary,{serialPvpId:id}));
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profiles,'Eligibility never prewrites the native flag');
    assert.equal(unlockRow(),undefined,'Unsaved virtual eligibility is not a sticky checkpoint');
    const payload=delta({[flagTable]:[{...originalFlag,flagValue:2}]}),saved=await send('user_data/push',payload),identity=sequence;
    parse(saved);assert.equal(unlockRow().catalog_hash,config.catalog);
    await close();await open();const committed=snapshot();
    assert.ok([200,503].includes((await request(port,identity,payload,String(identity),'user_data/push')).status));assert.equal(snapshot(),committed);
    put('UserPvPRecord',[]);put('UserAdventureStage',[]);parse(await send(summary,{serialPvpId:id}));
    parse(await send('user_data/push',delta({[flagTable]:[{...originalFlag,flagValue:1}]})));
    await rejected('user_data/push',delta({[flagTable]:[{...originalFlag,flagValue:0}]}));
    await rejected('user_data/push',delta({}, {[flagTable]:[{systemFlagId:config.id}]}));
    await rejected('user_data/push',delta({[flagTable]:[{...originalFlag,flagValue:1,userId:0}]}));
    await rejected('user_data/push',delta({[flagTable]:[{...originalFlag,flagValue:1,lastUpdatedAt:now}]}));
    const other=app.store.read(flagTable).data.find(row=>row.systemFlagId!==config.id);
    parse(await send('user_data/push',delta({[flagTable]:[other]})));assert.equal(app.store.read(flagTable).data.find(row=>row.systemFlagId===config.id).flagValue,1);
    put(flagTable,flags(0));await rejected(summary,{serialPvpId:id});await rejected('user_data/pull',{tables:[flagTable]});
    put(flagTable,flags(1));const checkpoint=unlockRow();
    app.store.db.prepare('UPDATE serial_pvp_unlock SET catalog_hash=? WHERE user_id=?').run('corrupt',seed.userId);
    await rejected(summary,{serialPvpId:id});
    app.store.db.prepare('UPDATE serial_pvp_unlock SET catalog_hash=? WHERE user_id=?').run(checkpoint.catalog_hash,seed.userId);
    parse(await send(summary,{serialPvpId:id}));
    now=season.slot6;parse(await send('user_data/pull',{tables:[flagTable]}));await rejected(summary,{serialPvpId:id});

    await fresh();now=season.slot6; // Unlock itself is permanent, not gated by an active event window.
    const combined=delta({UserAdventureStage:[stage()],UserPvPRecord:[record()],[flagTable]:[{...originalFlag,flagValue:2}]});
    for(const [table,event] of [['profile','UPDATE'],['serial_pvp_unlock','INSERT'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TEMP TRIGGER abyss_unlock_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
      await rejected('user_data/push',combined,500);app.store.db.exec('DROP TRIGGER abyss_unlock_fail');
    }
    parse(await send('user_data/push',combined));assert.equal(unlockRow().system_flag_id,config.id);
    await close();await open();assert.equal(app.store.read(flagTable).data.find(row=>row.systemFlagId===config.id).flagValue,2);

    await fresh();now=season.slot3+100;put('UserAdventureStage',[stage()]);put('UserPvPRecord',[record()]);
    put(flagTable,app.store.read(flagTable).data.filter(row=>row.systemFlagId!==config.id));
    await rejected('user_data/push',delta({[flagTable]:[{...originalFlag,flagValue:2}]})); // Lazy constructor owner is0, not an invented account setter.
    parse(await send('user_data/push',delta({[flagTable]:[{...originalFlag,userId:0,flagValue:2}]})));
    assert.equal(unlockRow().flag_owner_id,0);parse(await send(summary,{serialPvpId:id}));
    await fresh();put('UserAdventureStage',[stage()]);put('UserPvPRecord',[record()]);
    parse(await send('user_data/push',delta({[flagTable]:[{...originalFlag,flagValue:1}]})));
    assert.ok(unlockRow(),'First serialized nonzero value may be1; the original setter range allows it with the same prerequisites');
  } finally {await close();}
  console.log('Abyss source eligibility fixtures passed; native earning/save/UI acceptance remains unproved');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
