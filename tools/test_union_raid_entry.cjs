'use strict';
// DEFERRED / NOT RUN. Synthetic native state; entry capture is not a battle debit/result or emulator acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE,unionRaidAttemptSnapshot,unionRaidAttemptState}=require('./danmemore_server.cjs'),
  {request}=require('./test_danmemore_server.cjs'),seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-union-entry-')),database=path.join(directory,'profile.sqlite'),
    route='union_raid/status/preinitiation',value={unionRaidInfoId:413000001,unionRaidStageIndex:0,unionRaidStageId:415000001,defeatCount:0,debug:false};
  let app,port,sequence=0,now=1661443200;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;},
    close=async()=>{if(app)await app.close();app=null;},
    send=(action,body,id=++sequence)=>request(port,id,body,String(id),action),
    parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);},
    put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name),
    snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
      .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()])),
    profiles=()=>app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),
    reject=async(action,body,status=503,id=++sequence,semantic=true)=>{const before=snapshot(),reply=await send(action,body,id);
      assert.equal(reply.status,status,reply.body.toString());assert.equal(snapshot(),before);
      if(status===503 && semantic)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);},
    saveBody=rows=>({badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserInfo:md5(rows)}},
      deltas:[{signature:0,trigger:'UnionRaid',putItems:{UserInfo:rows},deleteItems:{}}],operations:[]});
  try {
    await open();await reject(route,value);
    const currency=[{userId:seed.userId,currencyId:master.currencies['currency.valis'],amount:200000,
      cumulativeAmount:200000,reservedAmount:0,signature:0}];put('UserCurrency',currency);
    const created=parse(await send('familia/create',{name:'Union entry',description:'Deferred native attempt capture',
      godId:20000001,style:21000001,subStyle:0,activeTime:22000001,subActiveTime:0,requireApproval:false})),charge=created.operations[0],paid=[{...currency[0],amount:100000}];
    parse(await send('user_data/push',{badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserCurrency:md5(paid)}},
      deltas:[{signature:0,trigger:'Familia',putItems:{UserCurrency:paid},deleteItems:{}}],operations:[{id:charge.id,verifier:charge.token}]}));
    const users=structuredClone(app.store.read('UserInfo').data);
    Object.assign(users[0].playerStatus,{unionRaidBossSP:1,unionRaidBossSPUpdatedAt:now-3600,
      unionRaidNormalSP:4,unionRaidNormalSPUpdatedAt:now-3661});put('UserInfo',users);
    for(const table of ['union_raid_entry','union_raid_entry_request','reply_cache']) {
      app.store.db.exec(`CREATE TEMP TRIGGER fail_union_entry BEFORE INSERT ON ${table}
        BEGIN SELECT RAISE(ABORT,'deferred entry rollback'); END`);
      await reject(route,value,503,++sequence,false);app.store.db.exec('DROP TRIGGER fail_union_entry');
    }
    const before=profiles(),queue=app.store.operations(),wallet=app.store.hardCurrency(),reply=await send(route,value),firstId=sequence,result=parse(reply),
      entry=app.store.db.prepare('SELECT * FROM union_raid_entry').get(),capture=JSON.parse(entry.capture_json),
      binding=app.store.db.prepare('SELECT * FROM union_raid_entry_request').get();
    assert.deepEqual(Object.keys(result),['code','stageInfo']);assert.equal(result.stageInfo.unionRaidStageId,415000001);
    assert.equal(entry.capture_hash,md5(entry.capture_json));assert.equal(binding.capture_hash,entry.capture_hash);
    assert.equal(binding.body_hash,capture.bodyHash);assert.equal(entry.entered_at,now);
    assert.deepEqual(capture.baseline,unionRaidAttemptSnapshot(users[0].playerStatus));
    assert.deepEqual(capture.projected,unionRaidAttemptState(master,users[0].playerStatus,now));
    assert.deepEqual(capture.response,result);assert.deepEqual(profiles(),before);assert.deepEqual(app.store.operations(),queue);
    assert.equal(app.store.hardCurrency(),wallet);assert.deepEqual((await send(route,value,firstId)).body,reply.body);
    await reject(route,{...value,debug:true},400,firstId);
    await reject('union_raid/status/get',{unionRaidInfoId:413000001,debug:false},400,firstId);
    now+=60;app.store.db.exec('DELETE FROM reply_cache');await close();await open();
    assert.deepEqual((await send(route,value,firstId)).body,reply.body,'Exact retained entry freezes its original projection time');
    assert.deepEqual(app.store.db.prepare('SELECT * FROM union_raid_entry').get(),entry);
    const next=parse(await send(route,value)),nextId=sequence,latest=app.store.db.prepare('SELECT * FROM union_raid_entry').get();
    assert.deepEqual(next,result);assert.notEqual(latest.request_key,entry.request_key);await reject(route,value,503,firstId);
    const badJson=latest.capture_json;
    for(const text of ['bad JSON',JSON.stringify({...JSON.parse(badJson),catalogHash:'0'.repeat(32)}),
      JSON.stringify({...JSON.parse(badJson),projected:{...capture.projected,unionRaidNormalSP:99}})]) {
      app.store.db.prepare('UPDATE union_raid_entry SET capture_json=?,capture_hash=?').run(text,md5(text));
      await reject(route,value);app.store.db.prepare('UPDATE union_raid_entry SET capture_json=?,capture_hash=?').run(badJson,latest.capture_hash);
    }
    const permanent=app.store.db.prepare('SELECT * FROM union_raid_entry_request WHERE request_key=?').get(latest.request_key);
    app.store.db.prepare('DELETE FROM union_raid_entry_request WHERE request_key=?').run(latest.request_key);
    await reject(route,value);await reject(route,value,503,nextId);
    app.store.db.prepare('INSERT INTO union_raid_entry_request VALUES(?,?,?,?,?)')
      .run(permanent.request_key,permanent.body_hash,permanent.creation_operation_id,permanent.union_raid_info_id,permanent.capture_hash);
    const changed=structuredClone(users);changed[0].playerStatus.unionRaidNormalSP=3;
    parse(await send('user_data/push',saveBody(changed)));await reject(route,value,503,nextId);
    assert.deepEqual(parse(await send(route,value)),result);const currentId=sequence;
    const battle=app.store.read('UserAdventureState').data;
    put('UserAdventureState',[{...battle[0],stageId:1280000101101}]);await reject(route,value);await reject(route,value,503,currentId);
    put('UserAdventureState',battle);now--;await reject(route,value,503,currentId);now++;
    app.store.beginSession();await close();await open();assert.deepEqual(parse(await send(route,value,currentId)),result);
    assert.deepEqual(app.store.read('UserInfo').data,changed);assert.deepEqual(app.store.operations(),queue);assert.equal(app.store.hardCurrency(),wallet);
  } finally {await close();assert.ok(path.basename(directory).startsWith('danmemore-union-entry-'));
    fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
