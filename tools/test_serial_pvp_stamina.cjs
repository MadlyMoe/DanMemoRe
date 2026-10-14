'use strict';

// DEFERRED / NOT RUN. Source protocol/timer fixtures, NOT native acceptance.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const {serialPvpSeasonAt,serialPvpSpConfig,serialPvpSpStatus,serialPvpStamina,serialPvpRefill,serialPvpInitialize}=require('./serial_pvp.cjs');
const seed=require('./test_serial_pvp_lobby.cjs').unlockedSeed(),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(value).digest('hex');
const id=81000000001,season=master.serialPvp.serialPvpInformation[id],start=season.slot5,
  consume='currency/hard/consume',body={consumeId:81071001};
const sp=(amount,at)=>({serialPvpSP:amount,serialPvpSPUpdatedAt:at});

async function main() {
  assert.deepEqual(serialPvpSpConfig(start,master),{id,initial:5,startsAt:season.slot3,naturalCap:5,cap:999,interval:28800,gain:1,
    catalog:serialPvpSpConfig(start,master).catalog});
  assert.equal(serialPvpSeasonAt(start-1,master),null);
  assert.equal(serialPvpSeasonAt(start,master).id,id);
  assert.equal(serialPvpSeasonAt(season.slot6,master),null);
  for(const [key,row] of Object.entries(master.serialPvp.serialPvpInformation)) {
    const found=serialPvpSeasonAt(row.slot5,master);
    if(row.slot5===row.slot6) assert.equal(found,null);
    else assert.equal(found.id,Number(key));
  }
  //The shorter matching end must not disable the still-visible SP timer.
  assert.equal(serialPvpSpConfig(season.slot4+1,master).id,id);
  assert.deepEqual(serialPvpStamina(sp(0,start),start+28799,master),sp(0,start));
  assert.deepEqual(serialPvpStamina(sp(0,start),start+28800,master),sp(1,start+28800));
  assert.deepEqual(serialPvpStamina(sp(0,start),start+28807,master),sp(1,start+28800));
  assert.deepEqual(serialPvpStamina(sp(0,start),start+28800*9+7,master),sp(5,start+28800*9));
  assert.deepEqual(serialPvpStamina(sp(8,start),start+28800,master),sp(5,start+28800),'Native positive tick lowers above-natural stock');
  assert.deepEqual(serialPvpStamina(sp(8,start+20),start,master),sp(8,start+20),'Rewind does not mint attempts or reset its timer');
  assert.deepEqual(serialPvpStamina(sp(8,start),season.slot6,master),sp(8,start),'Inactive timer is unchanged');
  assert.throws(()=>serialPvpSpStatus(sp(-1,start)),/reconciliation/);
  assert.throws(()=>serialPvpSpStatus(sp(1,String(start))),/reconciliation/);
  assert.throws(()=>serialPvpRefill(sp(999,start),start,master),/cap/);
  assert.throws(()=>serialPvpRefill(sp(0,start),season.slot6,master),/period/);
  assert.deepEqual(serialPvpRefill(sp(998,start),start,master).candidates,[{before:sp(998,start),after:sp(999,start)}]);
  assert.deepEqual(serialPvpRefill(sp(0,start),start+28800,master).candidates,
    [{before:sp(0,start),after:sp(1,start)},{before:sp(1,start+28800),after:sp(2,start+28800)}]);
  const reset=serialPvpInitialize(sp(0,0),start,master);
  assert.ok(serialPvpRefill(sp(0,0),start,master).candidates.some(row=>
    JSON.stringify(row.after)===JSON.stringify({...reset,serialPvpSP:6})),
  'Refill may follow an initialized but not yet saved native season allowance');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-abyss-sp-')),database=path.join(directory,'save.sqlite');
  let app,port,sequence=0,now=start;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const savedInfo=(value)=>{const rows=structuredClone(app.store.read('UserInfo').data);Object.assign(rows[0].playerStatus,value);return rows;};
  const put=value=>{const rows=savedInfo(value),data=JSON.stringify(rows);
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(data,md5(data),'UserInfo');};
  const push=(value,operations=[])=>{const rows=value?savedInfo(value):null;
    return send('user_data/push',{badges:null,scripts:{},dataTokens:{},operations:operations.map(row=>({id:row.id,verifier:row.token})),
      checksums:{before:{},after:rows?{UserInfo:md5(JSON.stringify(rows))}:{}},
      deltas:rows?[{signature:0,trigger:'SerialPvpSP',putItems:{UserInfo:rows},deleteItems:{}}]:[]});};
  const unchanged=async(action,value,status=503)=>{const before=snapshot(),reply=await send(action,value);
    assert.equal(reply.status,status,reply.body.toString());if(status===503)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before);};
  try {
    await open();app.store.changeHardCurrency(10000);put(sp(0,now));
    const nativeBefore=app.store.read('UserInfo'),wallet=app.store.hardCurrency(),first=await send(consume,body),firstSequence=sequence,
      result=parse(first),operation=result.operation;
    assert.equal(operation.type,10600);assert.deepEqual(operation.parameters,{});assert.deepEqual(result.operations,[operation]);
    assert.deepEqual(app.store.read('UserInfo'),nativeBefore,'No profile/signature precredit');
    assert.equal(app.store.hardCurrency(),wallet-10);
    assert.deepEqual(app.store.serialPvp.refillReceipt(operation).candidates,[{before:sp(0,now),after:sp(1,now)}]);
    const beforeAck=snapshot();assert.equal((await push(null,[operation])).status,400);assert.equal(snapshot(),beforeAck);
    const forged={badges:null,scripts:{},dataTokens:{},operations:[],checksums:{before:{},after:{UserInfo:md5(JSON.stringify(savedInfo(sp(2,now))))}},
      deltas:[{signature:0,trigger:'SerialPvpSP',putItems:{UserInfo:savedInfo(sp(2,now))},deleteItems:{}}]};
    await unchanged('user_data/push',forged);
    await unchanged('user_data/pull',{tables:['UserInfo']});
    assert.deepEqual(parse(await send(consume,body)),result);assert.equal(app.store.hardCurrency(),wallet-10);
    app.store.beginSession();await close();await open();
    assert.deepEqual((await request(port,firstSequence,body,String(firstSequence),consume)).body,first.body);
    const spoof=await request(port,firstSequence,{consumeId:81041001},String(firstSequence),consume);assert.equal(spoof.status,400);
    parse(await push(sp(1,now)));await close();await open();
    assert.equal(app.store.fixedConsumeReceipt(operation).effect_saved,1);
    await unchanged(consume,body); //Do not redeliver an already saved additive callback.
    parse(await push(null,[operation]));
    const obsoleteBefore=snapshot(),obsolete=await request(port,firstSequence,body,String(firstSequence),consume);
    assert.equal(obsolete.status,503);assert.equal(snapshot(),obsoleteBefore); //Old identity, not a deliberate new purchase.
    now+=28800;parse(await push(sp(2,now))); //Only native interval recovery, no arbitrary SP spending yet.
    const next=parse(await send(consume,body)).operation;assert.notEqual(next.id,operation.id);
    now=season.slot6;await unchanged(consume,body);
    parse(await push(sp(3,start+28800),[next])); //Late exact issued save survives clock change.
    await unchanged(consume,body);assert.equal(app.store.operations().length,0);
    //Natural aligned stamps may precede the opening hour used for config.
    now=start;put(sp(0,0));const aligned=serialPvpStamina(sp(0,0),now,master);
    parse(await push(aligned));assert.deepEqual(serialPvpSpStatus(app.store.read('UserInfo').data[0].playerStatus),aligned);
    now=start+10;put(sp(998,now));const capped=parse(await send(consume,body)).operation;
    parse(await push(sp(999,now),[capped]));await unchanged(consume,body);
    //Every durable mutation participates in the existing outer transaction.
    put(sp(0,now));
    for(const [table,label] of [['operation_queue','queue'],['hard_currency_consume','receipt'],['serial_pvp_sp_refill','capture'],
      ['hard_currency_consume_request','identity'],['reply_cache','reply']]) {
      const before=snapshot();app.store.db.exec(`CREATE TEMP TRIGGER abyss_sp_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
      assert.ok((await send(consume,body)).status>=500);assert.equal(snapshot(),before);app.store.db.exec('DROP TRIGGER abyss_sp_fail');
    }
    const final=parse(await send(consume,body)).operation;
    for(const [table,event] of [['profile','UPDATE'],['hard_currency_consume','UPDATE'],['operation_done','INSERT'],['reply_cache','INSERT']]) {
      const before=snapshot();app.store.db.exec(`CREATE TEMP TRIGGER abyss_sp_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
      assert.ok((await push(sp(1,now),[final])).status>=500);assert.equal(snapshot(),before);app.store.db.exec('DROP TRIGGER abyss_sp_fail');
    }
    parse(await push(sp(1,now),[final]));
    const legacy=app.store.issueOperation(10600,{});await unchanged(consume,body);
    assert.equal((await push(null,[legacy])).status,503);assert.ok(app.store.operations().some(row=>row.id===legacy.id));
  } finally {await close();}
  console.log('Abyss source stamina/refill fixtures passed; native timer/callback/save acceptance remains unproved');
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
