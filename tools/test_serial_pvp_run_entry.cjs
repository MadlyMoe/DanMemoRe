'use strict';

// DEFERRED / NOT RUN. Source fixtures, NOT native entry/combat acceptance.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const {serialPvpInitialize,serialPvpRunEntry,serialPvpSpStatus,initialUsage}=require('./serial_pvp.cjs');
const master=require('../data/danmemore-master.json'),seed=require('./test_serial_pvp_lobby.cjs').unlockedSeed();
const id=81000000001,season=master.serialPvp.serialPvpInformation[id],gradeId=81200010000,start=season.slot3;
const select='serial_pvp/grade/select',summary='serial_pvp/summary/get',refresh='serial_pvp/rival_list/update';
const sp=(n,t)=>({serialPvpSP:n,serialPvpSPUpdatedAt:t});
const md5=value=>crypto.createHash('md5').update(value).digest('hex');

async function main() {
  assert.deepEqual(serialPvpInitialize(sp(0,0),start,master),sp(5,start));
  assert.deepEqual(serialPvpInitialize(sp(999,start-1),start,master),sp(5,start),'Original reset is absolute, not an additive grant');
  assert.equal(serialPvpInitialize(sp(0,start),start,master),null,'Same season cannot grant a second allowance');
  assert.equal(serialPvpInitialize(sp(0,start+1),start,master),null,'A backward clock cannot reset a future timestamp');
  assert.equal(serialPvpInitialize(sp(0,0),season.slot6,master),null);
  assert.deepEqual(serialPvpRunEntry(sp(0,0),start,master).candidates,[{before:sp(5,start),after:sp(4,start)}]);
  assert.deepEqual(serialPvpRunEntry(sp(4,start),start+7,master).candidates,[{before:sp(4,start),after:sp(3,start)}],
    'Below natural cap the attempt deduction retains the timer');
  assert.deepEqual(serialPvpRunEntry(sp(5,start),start+7,master).candidates,[{before:sp(5,start),after:sp(4,start+7)}],
    'At/above natural cap spending restarts the timer');
  assert.throws(()=>serialPvpRunEntry(sp(0,start),start+28799,master),/one available attempt/);
  assert.deepEqual(serialPvpRunEntry(sp(0,start),start+28800,master).candidates,[{before:sp(1,start+28800),after:sp(0,start+28800)}]);
  assert.deepEqual(serialPvpRunEntry(sp(8,start),start+28800,master).candidates,
    [{before:sp(8,start),after:sp(7,start+28800)},{before:sp(5,start+28800),after:sp(4,start+28800)}]);
  const disabled=Object.values(master.serialPvp.serialPvpInformation).find(row=>row.slot3===row.slot4 && row.slot5<row.slot6);
  assert.deepEqual(serialPvpInitialize(sp(0,0),disabled.slot5,master),sp(5,disabled.slot3),
    'Native reset retains the original future matching stamp; it does not enable a disabled matching window');

  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-abyss-run-entry-'));
  let database=path.join(directory,'save.sqlite'),app,port,sequence=0,now=start,fixture=0;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const fresh=async()=>{await close();database=path.join(directory,`entry-${++fixture}.sqlite`);await open();};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const info=value=>{const rows=structuredClone(app.store.read('UserInfo').data);Object.assign(rows[0].playerStatus,value);return rows;};
  const push=putItems=>send('user_data/push',{badges:null,scripts:{},dataTokens:{},operations:[],
    checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(JSON.stringify(rows))]))},
    deltas:[{signature:0,trigger:'UpdateSerialPvpState',putItems,deleteItems:{}}]});
  const unchanged=async(action,value,status=503)=>{const before=snapshot(),reply=await send(action,value);
    assert.equal(reply.status,status,reply.body.toString());if(status===503)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before);};
  const lobbyCheckpoint=async()=>{
    const lobby=app.store.serialPvp.state(id);
    if(lobby.pending_usage)parse(await push({UserSerialPvpUsingLimitData:[initialUsage(id)]}));
    if(lobby.pending_status)parse(await push({UserSerialPvpGameStatus:[lobby.after.UserSerialPvpGameStatus]}));
  };
  try {
    await open();const initial=app.store.read('UserInfo');
    // Native menu initialization may save before the grade request.
    parse(await push({UserInfo:info(sp(5,start))}));
    assert.deepEqual(serialPvpSpStatus(app.store.read('UserInfo').data[0].playerStatus),sp(5,start));
    await unchanged('user_data/push',{badges:null,scripts:{},dataTokens:{},operations:[],checksums:{before:{},after:{UserInfo:md5(JSON.stringify(info(sp(6,start))))}},
      deltas:[{signature:0,trigger:'UpdateSerialPvpState',putItems:{UserInfo:info(sp(6,start))},deleteItems:{}}]});
    const before=app.store.read('UserInfo'),first=await send(select,{serialPvpId:id,gradeId}),firstSequence=sequence;
    parse(first);assert.deepEqual(app.store.read('UserInfo'),before,'Run selection cannot predebit a signed profile');
    const capture=app.store.serialPvp.runEntry(id);assert.equal(capture.observed,0);
    assert.deepEqual(capture.candidates,[{before:sp(5,start),after:sp(4,start)}]);
    await unchanged('user_data/pull',{tables:['UserInfo']});
    await unchanged('currency/hard/consume',{consumeId:81071001});
    await lobbyCheckpoint();
    await unchanged(select,{serialPvpId:id,gradeId});await unchanged(refresh,{serialPvpId:id,gradeId});
    parse(await send(summary,{serialPvpId:id})); // Does not overwrite the pending attempt checkpoint.
    await close();await open();assert.equal(app.store.serialPvp.runEntry(id).observed,0);
    app.store.db.exec('DELETE FROM reply_cache');
    assert.deepEqual((await request(port,firstSequence,{serialPvpId:id,gradeId},String(firstSequence),select)).body,first.body);
    parse(await push({UserInfo:info(sp(4,start+2))}));
    assert.equal(app.store.serialPvp.runEntry(id).observed,1);
    assert.deepEqual(app.store.serialPvp.runEntry(id).observedSp,sp(4,start+2));
    await close();await open();
    const after=snapshot();assert.equal((await request(port,firstSequence,{serialPvpId:id,gradeId},String(firstSequence),select)).status,503);
    assert.equal(snapshot(),after,'A cold/hot completed cost callback cannot spend again');
    const status=app.store.read('UserSerialPvpGameStatus').data[0];
    parse(await push({UserSerialPvpGameStatus:[{...status,updatedMatchingCount:1,executeRivalListUpdate:true}]}));
    parse(await send(refresh,{serialPvpId:id,gradeId}));await lobbyCheckpoint();
    assert.equal(app.store.serialPvp.runEntry(id).observed,1,'Refresh retains the run-entry proof without a new SP charge');
    assert.deepEqual(serialPvpSpStatus(app.store.read('UserInfo').data[0].playerStatus),sp(4,start+2));
    // The original class-lock text supersedes the earlier unplayed-reselect
    //fixture. New-run costs after loss/five wins live in completion fixtures.
    await unchanged(select,{serialPvpId:id,gradeId});await unchanged(select,{serialPvpId:id,gradeId:gradeId+1});
    assert.deepEqual(serialPvpSpStatus(app.store.read('UserInfo').data[0].playerStatus),sp(4,start+2));
    now+=10;await fresh();parse(await send(select,{serialPvpId:id,gradeId}));const next=app.store.serialPvp.runEntry(id);
    // Cost may save before the first callback's status/usage checkpoint, or together.
    parse(await push({UserInfo:info(next.candidates[0].after)}));await lobbyCheckpoint();
    assert.equal(app.store.serialPvp.runEntry(id).observed,1);
    now+=10;await fresh();parse(await send(select,{serialPvpId:id,gradeId}));const issuedAt=now,
      lateTarget=app.store.serialPvp.runEntry(id).candidates[0].after;
    now=season.slot6;await lobbyCheckpoint();parse(await push({UserInfo:info(lateTarget)}));
    assert.equal(app.store.serialPvp.runEntry(id).observed,1,'An exact issued below-cap spend can save after the event clock changes');
    now=issuedAt+10;await fresh();
    for(const table of ['serial_pvp_lobby','serial_pvp_run_entry','serial_pvp_lobby_request','reply_cache']) {
      const before=snapshot();app.store.db.exec(`CREATE TEMP TRIGGER abyss_entry_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
      assert.ok((await send(select,{serialPvpId:id,gradeId})).status>=500);assert.equal(snapshot(),before);
      app.store.db.exec('DROP TRIGGER abyss_entry_fail');
    }
    parse(await send(select,{serialPvpId:id,gradeId}));await lobbyCheckpoint();const spend=app.store.serialPvp.runEntry(id).candidates[0].after;
    for(const table of ['profile','serial_pvp_run_entry','reply_cache']) {
      const before=snapshot(),event=table==='reply_cache'?'INSERT':'UPDATE';
      app.store.db.exec(`CREATE TEMP TRIGGER abyss_entry_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
      assert.ok((await push({UserInfo:info(spend)})).status>=500);assert.equal(snapshot(),before);
      app.store.db.exec('DROP TRIGGER abyss_entry_fail');
    }
    parse(await push({UserInfo:info(spend)}));
    const retained=app.store.serialPvp.runEntry(id);
    app.store.db.prepare('UPDATE serial_pvp_run_entry SET candidates_json=? WHERE serial_pvp_id=?').run('[]',id);
    await unchanged(summary,{serialPvpId:id});
    app.store.db.prepare('UPDATE serial_pvp_run_entry SET candidates_json=? WHERE serial_pvp_id=?').run(retained.candidates_json,id);
    const legacyRow=app.store.db.prepare('SELECT * FROM serial_pvp_run_entry WHERE serial_pvp_id=?').get(id);
    app.store.db.prepare('DELETE FROM serial_pvp_run_entry WHERE serial_pvp_id=?').run(id);
    parse(await send(summary,{serialPvpId:id})); // Missing older spend proof does not erase readable native history.
    await unchanged(select,{serialPvpId:id,gradeId});await unchanged(refresh,{serialPvpId:id,gradeId});
    const columns=Object.keys(legacyRow);
    app.store.db.prepare(`INSERT INTO serial_pvp_run_entry(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`)
      .run(...Object.values(legacyRow));
    await unchanged(select,{serialPvpId:id,gradeId});
    now=start+1;await unchanged(select,{serialPvpId:id,gradeId}); // Clock rewind is not a new season allowance.
    const nextId=81000000002,nextSeason=master.serialPvp.serialPvpInformation[nextId];now=nextSeason.slot3;
    const prior=app.store.read('UserInfo');parse(await send(select,{serialPvpId:nextId,gradeId}));
    assert.deepEqual(app.store.read('UserInfo'),prior,'Dirty season initializer and run entry are not server-precredited');
    assert.deepEqual(app.store.serialPvp.runEntry(nextId).candidates,
      [{before:sp(5,now),after:sp(4,now)}]);
    parse(await push({UserInfo:info(sp(4,now))}));assert.equal(app.store.serialPvp.runEntry(nextId).observed,1);
    assert.notDeepEqual(app.store.read('UserInfo'),initial);
  } finally {await close();}
  console.log('Abyss source season/run-entry fixtures passed; native eligibility/save-order/combat acceptance remains unproved');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
