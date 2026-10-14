'use strict';
// DEFERRED / NOT RUN. Native-width/save probes, not attempt earning, timer, debit, result or emulator acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,encodeMsgpack,OFFLINE_UNAVAILABLE_CODE,unionRaidAttemptState,unionRaidAttemptSnapshot,unionRaidNormalEntryDebit}=require('./danmemore_server.cjs'),
  {request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-union-attempts-')),database=path.join(directory,'profile.sqlite'),
    fields=['unionRaidBossSP','unionRaidBossSPUpdatedAt','unionRaidNormalSP','unionRaidNormalSPUpdatedAt'];
  let app,port,sequence=0,now=1790834274;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;},
    close=async()=>{if(app)await app.close();app=null;},
    send=(route,body)=>request(port,++sequence,body,String(sequence),route),
    parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);},
    put=rows=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),'UserInfo'),
    snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
      .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()])),
    body=rows=>({badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserInfo:md5(rows)}},
      deltas:[{signature:0,trigger:'UnionRaid',putItems:{UserInfo:rows},deleteItems:{}}],operations:[]}),
    save=rows=>send('user_data/push',body(rows)),
    reject=async(route,value,status=400,semantic=false)=>{const before=snapshot(),reply=await send(route,value);
      assert.equal(reply.status,status,reply.body.toString());assert.equal(snapshot(),before);
      if(semantic)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);},
    pull=async()=>{const value={tables:['UserInfo']},before=app.store.read('UserInfo'),reply=await send('user_data/pull',value);
      assert.equal(reply.status,200,reply.body.toString());assert.equal(reply.headers['content-type'],'application/x-msgpack');
      assert.deepEqual(reply.body,encodeMsgpack(app.store.pull(value)));assert.deepEqual(app.store.read('UserInfo'),before);};
  try {
    // WRITTEN ONLY: original getter projection does not save or spend these balances.
    const start=1661439600,end=1663811999,at=start+7201,
      empty={unionRaidBossSP:0,unionRaidBossSPUpdatedAt:0,unionRaidNormalSP:0,unionRaidNormalSPUpdatedAt:0},
      before={unionRaidBossSP:1,unionRaidBossSPUpdatedAt:start,unionRaidNormalSP:4,unionRaidNormalSPUpdatedAt:start};
    assert.deepEqual(unionRaidAttemptState(master,empty,start),{unionRaidBossSP:3,unionRaidBossSPUpdatedAt:start,
      unionRaidNormalSP:5,unionRaidNormalSPUpdatedAt:start});
    assert.deepEqual(unionRaidAttemptState(master,empty,start-1),{...empty,unionRaidBossSPUpdatedAt:start-1,unionRaidNormalSPUpdatedAt:start-1});
    assert.deepEqual(unionRaidAttemptState(master,empty,end),{...empty,unionRaidBossSPUpdatedAt:end,unionRaidNormalSPUpdatedAt:end});
    assert.deepEqual(unionRaidAttemptState(master,before,at),{...before,unionRaidNormalSP:6,unionRaidNormalSPUpdatedAt:start+7200});
    const midnight=(Math.floor((start+32400)/86400)+1)*86400-32400;
    assert.deepEqual(unionRaidAttemptState(master,{...before,unionRaidBossSPUpdatedAt:midnight-1,unionRaidNormalSP:10},midnight),
      {...before,unionRaidBossSP:3,unionRaidBossSPUpdatedAt:midnight,unionRaidNormalSP:10});
    const high={...before,unionRaidBossSP:99,unionRaidNormalSP:99};
    assert.deepEqual(unionRaidAttemptState(master,high,midnight),high,'Native getters do not clamp high stock or refresh its old clock');
    assert.deepEqual(unionRaidAttemptState(master,{...before,unionRaidNormalSP:9},at),
      {...before,unionRaidNormalSP:10,unionRaidNormalSPUpdatedAt:start+7200});
    assert.deepEqual(unionRaidAttemptState(master,{...before,unionRaidBossSPUpdatedAt:at+1,unionRaidNormalSPUpdatedAt:at+1},at),
      {...before,unionRaidBossSPUpdatedAt:at+1,unionRaidNormalSPUpdatedAt:at+1});
    assert.throws(()=>unionRaidAttemptState(master,{...before,unionRaidNormalSPUpdatedAt:-Number.MAX_SAFE_INTEGER},at),/wrap signed addition/);
    assert.deepEqual(unionRaidAttemptSnapshot({...before,baseSP:999}),before);
    const debit=unionRaidNormalEntryDebit(master,before,at);
    assert.deepEqual(debit,{...before,unionRaidNormalSP:5,unionRaidNormalSPUpdatedAt:start+7200});
    assert.deepEqual(unionRaidNormalEntryDebit(master,{...before,unionRaidNormalSP:10},at),
      {...before,unionRaidNormalSP:9,unionRaidNormalSPUpdatedAt:at});
    assert.deepEqual(unionRaidNormalEntryDebit(master,{...before,unionRaidNormalSP:101},at),
      {...before,unionRaidNormalSP:99,unionRaidNormalSPUpdatedAt:at});
    assert.equal(unionRaidNormalEntryDebit(master,{...before,unionRaidNormalSP:0,unionRaidNormalSPUpdatedAt:at},at),null);
    assert.deepEqual(unionRaidAttemptState(master,empty,start,'normal'),{...empty,unionRaidNormalSP:5,unionRaidNormalSPUpdatedAt:start});
    await open();const baseline=structuredClone(app.store.read('UserInfo').data),queue=app.store.operations(),wallet=app.store.hardCurrency();
    for(const values of [
      {unionRaidBossSP:0,unionRaidBossSPUpdatedAt:0,unionRaidNormalSP:0,unionRaidNormalSPUpdatedAt:0},
      {unionRaidBossSP:-2147483648,unionRaidBossSPUpdatedAt:-Number.MAX_SAFE_INTEGER,
        unionRaidNormalSP:2147483647,unionRaidNormalSPUpdatedAt:Number.MAX_SAFE_INTEGER},
      {unionRaidBossSP:2147483647,unionRaidBossSPUpdatedAt:Number.MAX_SAFE_INTEGER,
        unionRaidNormalSP:-2147483648,unionRaidNormalSPUpdatedAt:-Number.MAX_SAFE_INTEGER}]) {
      const rows=[{...baseline[0],playerStatus:{...baseline[0].playerStatus,...values}}];
      parse(await save(rows));assert.deepEqual(app.store.read('UserInfo'),{data:rows,token:md5(rows)});
      await pull();assert.deepEqual(app.store.operations(),queue);assert.equal(app.store.hardCurrency(),wallet);
      // No inferred stock caps, timer refresh, negative-to-zero repair or unrelated-status replacement.
      const unrelated=Object.fromEntries(Object.entries(rows[0].playerStatus).filter(([key])=>!fields.includes(key))),
        original=Object.fromEntries(Object.entries(baseline[0].playerStatus).filter(([key])=>!fields.includes(key)));
      assert.deepEqual(unrelated,original);
      for(const [field,bad] of [['unionRaidBossSP',2147483648],['unionRaidBossSP',-2147483649],
        ['unionRaidBossSP','1'],['unionRaidBossSP',1.5],['unionRaidNormalSP',2147483648],['unionRaidNormalSP',-2147483649],
        ['unionRaidNormalSP',null],['unionRaidBossSPUpdatedAt',Number.MAX_SAFE_INTEGER+1],
        ['unionRaidBossSPUpdatedAt',0.5],['unionRaidBossSPUpdatedAt','0'],
        ['unionRaidNormalSPUpdatedAt',-Number.MAX_SAFE_INTEGER-1],['unionRaidNormalSPUpdatedAt',null]])
        await reject('user_data/push',body([{...rows[0],playerStatus:{...rows[0].playerStatus,[field]:bad}}]));
      for(const field of fields) {
        const changed=structuredClone(rows);delete changed[0].playerStatus[field];await reject('user_data/push',body(changed));
      }
      for(const [table,event] of [['profile','UPDATE'],['meta','INSERT'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TEMP TRIGGER fail_union_attempt_save BEFORE ${event} ON ${table}
          BEGIN SELECT RAISE(ABORT,'deferred Union attempt rollback'); END`);
        await reject('user_data/push',body(baseline),503);app.store.db.exec('DROP TRIGGER fail_union_attempt_save');
      }
      await close();await open();assert.deepEqual(app.store.read('UserInfo'),{data:rows,token:md5(rows)});
      now+=31536000;await pull();assert.deepEqual(app.store.read('UserInfo').data,rows);now-=31536000;
      // Existing undecodable native fields are retained behind recovery, never coerced or erased.
      const corrupt=[{...rows[0],playerStatus:{...rows[0].playerStatus,unionRaidNormalSP:'corrupt'}}];put(corrupt);
      assert.throws(()=>app.store.read('UserInfo'),/Union Raid attempt fields/);
      const wire=app.store.db.prepare('SELECT data,token FROM profile WHERE name=?').get('UserInfo');
      await reject('user_data/pull',{tables:['UserInfo']},503,true);
      assert.deepEqual(app.store.db.prepare('SELECT data,token FROM profile WHERE name=?').get('UserInfo'),wire);put(rows);
    }
    parse(await save(baseline));assert.deepEqual(app.store.read('UserInfo').data,baseline);
  } finally {await close();assert.ok(path.basename(directory).startsWith('danmemore-union-attempts-'));
    fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
