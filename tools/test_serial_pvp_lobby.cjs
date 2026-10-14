'use strict';

// DEFERRED / NOT RUN. Synthetic protocol/save fixtures, NOT native acceptance.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const {initialRecord,initialStatus,initialUsage,serialPvpCpuRivals,serialPvpRows,serialPvpStamina,serialPvpUnlockConfig}=require('./serial_pvp.cjs');
const {underPvpCpuParty}=require('./under_pvp.cjs');
const rawSeed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
function unlockedSeed() {
  const value=structuredClone(rawSeed),id=serialPvpUnlockConfig(master).id;
  value.data.UserSystemFlag.find(row=>row.systemFlagId===id).flagValue=2;
  return value; // Temporary synthetic prerequisite ONLY; never alter the real seed/player save.
}
const seed=unlockedSeed();
const md5=value=>crypto.createHash('md5').update(value).digest('hex');
const id=81000000001,season=master.serialPvp.serialPvpInformation[id],gradeId=81200010000;
const summary='serial_pvp/summary/get',select='serial_pvp/grade/select',refresh='serial_pvp/rival_list/update';
const statusTable='UserSerialPvpGameStatus',usageTable='UserSerialPvpUsingLimitData',recordTable='UserSerialPvpRecord';

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-abyss-lobby-'));
  let database=path.join(directory,'save.sqlite'),app,port,sequence=0,now=season.slot3,fixture=0;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const fresh=async()=>{await close();database=path.join(directory,`lobby-${++fixture}.sqlite`);await open();};
  const send=(action,body)=>request(port,++sequence,body,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const put=(name,rows)=>{const data=JSON.stringify(rows);app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(data,md5(data),name);};
  const profiles=()=>JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const unchanged=async(action,body,status=503)=>{const before=snapshot(),reply=await send(action,body);
    assert.equal(reply.status,status,reply.body.toString());if(status===503)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before);};
  const push=putItems=>send('user_data/push',{badges:null,scripts:{},dataTokens:{},operations:[],
    checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(JSON.stringify(rows))]))},
    deltas:[{signature:0,trigger:'UpdateSerialPvpState',putItems,deleteItems:{}}]});
  const checkpoint=async stamp=>{
    const state=app.store.serialPvp.state(id);
    if(state.pending_usage) parse(await push({[usageTable]:[initialUsage(id)]}));
    if(state.pending_status) parse(await push({[statusTable]:[{...state.after[statusTable],lastRivalListUpdateAt:stamp ?? now}]}));
    const entry=app.store.serialPvp.runEntry(id);
    if(entry && !entry.observed) {
      const info=structuredClone(app.store.read('UserInfo').data);
      Object.assign(info[0].playerStatus,entry.candidates.at(-1).after);
      parse(await push({UserInfo:info}));
    }
  };
  const refreshIntent=async()=>{
    const status=app.store.read(statusTable).data.find(row=>row.serialPvpId===id);
    parse(await push({[statusTable]:[{...status,updatedMatchingCount:status.updatedMatchingCount+1,executeRivalListUpdate:true}]}));
  };
  try {
    for(const grade of Object.keys(master.serialPvp.serialPvpGrade).map(Number)) for(const generation of [0,1,23]) {
      const rivals=serialPvpCpuRivals(id,grade,generation,master);
      assert.equal(rivals.length,5);assert.equal(new Set(rivals.map(row=>row.serialPvpPlayerInfo.userId)).size,5);
      for(const rival of rivals) {
        assert.equal(rival.serialPvpPlayerInfo.gradeId,grade);assert.equal(rival.serialPvpPlayerInfo.isDummy,true);
        assert.equal(rival.serialPvpPlayerInfo.score,0);assert.match(rival.serialPvpPlayerInfo.name,/\[Offline CPU\]$/);
        assert.deepEqual(rival.serialPvpParty,{...underPvpCpuParty(rival.serialPvpPlayerInfo.userId,master),partyType:9});
      }
    }
    assert.equal(serialPvpRows(statusTable,[initialStatus(id)],master,seed.userId).size,1);
    assert.throws(()=>serialPvpRows(statusTable,[initialStatus(id),initialStatus(id)],master,seed.userId),/identity/);
    assert.throws(()=>serialPvpRows(recordTable,[{...initialRecord(id),userId:seed.userId+1}],master,seed.userId),/identity/);
    await open();const initialProfiles=profiles();
    const first=parse(await send(summary,{serialPvpId:id}));
    assert.deepEqual(first,{code:0,result:0,serialPvpRecord:[],currentScore:0,selectedGradeId:0,
      currentWinCount:0,existResult:false,rivalList:[],serialPvpRanking:[]});
    for(const body of [null,{serialPvpId:String(id)},{serialPvpId:0},{serialPvpId:id,gradeId}]) await unchanged(summary,body,400);
    await unchanged(summary,{serialPvpId:id,userId:seed.userId+1});
    await unchanged(refresh,{serialPvpId:id,gradeId});
    const selected=await send(select,{serialPvpId:id,gradeId}),selectedSequence=sequence,result=parse(selected);
    assert.equal(result.gradeId,gradeId);assert.equal(result.rivalList.length,5);
    assert.deepEqual(result.serialPvpUsingLimitData,{serialPvpId:id,usedPcList:[],usedMemoriaList:[]});
    assert.ok(!Array.isArray(result.serialPvpUsingLimitData));assert.equal(profiles(),initialProfiles,'No native profile precredit');
    assert.deepEqual((await request(port,selectedSequence,{serialPvpId:id,gradeId},String(selectedSequence),select)).body,selected.body);
    await unchanged(select,{serialPvpId:id,gradeId:81200010001});
    await unchanged('user_data/pull',{tables:[statusTable]});
    parse(await send(summary,{serialPvpId:id})); // Summary is safe while the UI is saving its issued selection.
    await close();await open();assert.equal(app.store.serialPvp.state(id).pending_usage,1);
    parse(await push({[usageTable]:[initialUsage(id)]}));assert.equal(app.store.serialPvp.state(id).pending_usage,0);
    assert.equal(app.store.serialPvp.state(id).pending_status,1);
    const badStatus={...initialStatus(id),updateRivalList:false,lastRivalListUpdateAt:now+121};
    await unchanged('user_data/push',{badges:null,scripts:{},dataTokens:{},operations:[],checksums:{before:{},after:{[statusTable]:md5(JSON.stringify([badStatus]))}},
      deltas:[{signature:0,trigger:'UpdateSerialPvpState',putItems:{[statusTable]:[badStatus]},deleteItems:{}}]});
    await checkpoint(now+2);assert.equal(app.store.serialPvp.state(id).pending_status,0);
    const stable=parse(await send(summary,{serialPvpId:id}));assert.equal(stable.selectedGradeId,gradeId);
    assert.equal(stable.serialPvpUsingLimitData.userId,0);assert.equal(stable.serialPvpUsingLimitData.serialPvpId,id);
    app.store.db.exec('DELETE FROM reply_cache');
    assert.equal((await request(port,selectedSequence,{serialPvpId:id,gradeId},String(selectedSequence),select)).status,503,
      'Saved additive run-entry callback cannot replay its cost');
    const spoof=await request(port,selectedSequence,{serialPvpId:id,gradeId:81200010001},String(selectedSequence),select);
    assert.equal(spoof.status,400);
    now+=10;await unchanged(refresh,{serialPvpId:id,gradeId});await refreshIntent();
    await close();await open(); // Intent is a real persisted native save, not a process-local allowance.
    parse(await send(refresh,{serialPvpId:id,gradeId}));
    assert.equal(app.store.serialPvp.state(id).generation,2);
    assert.equal((await request(port,selectedSequence,{serialPvpId:id,gradeId},String(selectedSequence),select)).status,503);
    await checkpoint();
    for(let count=2;count<=3;count++) {
      now+=10;await refreshIntent();parse(await send(refresh,{serialPvpId:id,gradeId}));await checkpoint();
      assert.equal(app.store.read(statusTable).data[0].updatedMatchingCount,count);
    }
    const exhausted=app.store.read(statusTable).data[0],invalid={...exhausted,updatedMatchingCount:4,executeRivalListUpdate:true};
    await unchanged('user_data/push',{badges:null,scripts:{},dataTokens:{},operations:[],checksums:{before:{},after:{[statusTable]:md5(JSON.stringify([invalid]))}},
      deltas:[{signature:0,trigger:'UpdateSerialPvpState',putItems:{[statusTable]:[invalid]},deleteItems:{}}]});
    //1bc4628 can save0 before its battle packet. That reset cannot create an
    //extra refresh until an actual captured battle consumes the transition.
    const reset={...exhausted,updatedMatchingCount:0};
    for(const [table,event] of [['profile','UPDATE'],['serial_pvp_matching_checkpoint','UPDATE'],['reply_cache','INSERT']]) {
      const before=snapshot();app.store.db.exec(`CREATE TEMP TRIGGER abyss_counter_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
      assert.ok((await push({[statusTable]:[reset]})).status>=500);assert.equal(snapshot(),before);
      app.store.db.exec('DROP TRIGGER abyss_counter_fail');
    }
    parse(await push({[statusTable]:[reset]}));await close();await open();
    await unchanged(refresh,{serialPvpId:id,gradeId});
    const fake={...reset,updatedMatchingCount:1,executeRivalListUpdate:true};
    await unchanged('user_data/push',{badges:null,scripts:{},dataTokens:{},operations:[],checksums:{before:{},after:{[statusTable]:md5(JSON.stringify([fake]))}},
      deltas:[{signature:0,trigger:'UpdateSerialPvpState',putItems:{[statusTable]:[fake]},deleteItems:{}}]});
    await unchanged(select,{serialPvpId:id,gradeId}); // No reselect/debit before run closure.
    for(const grade of [81200010001,81200010002,81200010003,81200010004]) {
      now+=10;await fresh();parse(await send(select,{serialPvpId:id,gradeId:grade}));await checkpoint();
      assert.equal(parse(await send(summary,{serialPvpId:id})).selectedGradeId,grade);
    }
    now+=28800;
    const recovered=structuredClone(app.store.read('UserInfo').data);
    Object.assign(recovered[0].playerStatus,serialPvpStamina(recovered[0].playerStatus,now,master));
    parse(await push({UserInfo:recovered}));
    // Issued saves may arrive late. Summary remains a DISPLAY-period read,
    // but selection/refresh retain their separate MATCHING gate.
    now+=10;await refreshIntent();parse(await send(refresh,{serialPvpId:id,gradeId:81200010004}));const issuedAt=now;
    now=season.slot4;await checkpoint(issuedAt);
    const postMatchProfiles=profiles(),postMatch=parse(await send(summary,{serialPvpId:id})),postMatchSequence=sequence;
    assert.equal(postMatch.selectedGradeId,81200010004);assert.deepEqual(postMatch.serialPvpRanking,[]);
    assert.equal(profiles(),postMatchProfiles,'Viewing a closed matching period grants no native progress/reward');
    await unchanged(select,{serialPvpId:id,gradeId:81200010004});await unchanged(refresh,{serialPvpId:id,gradeId:81200010004});
    now=season.slot6-1;assert.deepEqual(parse(await send(summary,{serialPvpId:id})),postMatch);
    now=season.slot6;await unchanged(summary,{serialPvpId:id});
    const expired=snapshot();
    assert.equal((await request(port,postMatchSequence,{serialPvpId:id},String(postMatchSequence),summary)).status,503);
    assert.equal(snapshot(),expired,'Even cached summary identities must respect DISPLAY expiry');
    for(const [key,row] of Object.entries(master.serialPvp.serialPvpInformation)) {
      now=row.slot3;
      if(row.slot3===row.slot4) await unchanged(summary,{serialPvpId:Number(key)});
      else assert.equal(parse(await send(summary,{serialPvpId:Number(key)})).currentScore,0);
    }
    now=season.slot3+200;
    const replenished=structuredClone(app.store.read('UserInfo').data);
    Object.assign(replenished[0].playerStatus,{serialPvpSP:5,serialPvpSPUpdatedAt:now});put('UserInfo',replenished);
    put(recordTable,[{...initialRecord(id,seed.userId),score:12,cumulativeScore:12}]);
    await unchanged(summary,{serialPvpId:id});put(recordTable,[]);
    put(usageTable,[{...initialUsage(id),usedPcList:[{pcId:1010000101,turnCount:1}]}]);
    await unchanged(select,{serialPvpId:id,gradeId});put(usageTable,[initialUsage(id)]);
    put('UserSerialPvpInfo',[{userId:seed.userId,resumeRivalUserId:999}]);await unchanged(summary,{serialPvpId:id});
    put('UserSerialPvpInfo',seed.data.UserSerialPvpInfo);
    // Both the capture and its response/sequence must roll back when transport persistence fails.
    await fresh();const before=snapshot();app.store.db.exec("CREATE TEMP TRIGGER abyss_reply_fail BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'injected'); END");
    assert.equal((await send(select,{serialPvpId:id,gradeId})).status,500);assert.equal(snapshot(),before);
    app.store.db.exec('DROP TRIGGER abyss_reply_fail');
    parse(await send(select,{serialPvpId:id,gradeId}));const checkpointBefore=snapshot();
    app.store.db.exec("CREATE TEMP TRIGGER abyss_profile_fail BEFORE UPDATE ON profile WHEN NEW.name='UserSerialPvpGameStatus' BEGIN SELECT RAISE(ABORT,'injected'); END");
    assert.equal((await push({[statusTable]:[app.store.serialPvp.state(id).after[statusTable]]})).status,500);
    assert.equal(snapshot(),checkpointBefore);app.store.db.exec('DROP TRIGGER abyss_profile_fail');await checkpoint();
    const saved=app.store.serialPvp.state(id);app.store.db.prepare('UPDATE serial_pvp_lobby SET rivals_json=? WHERE serial_pvp_id=?').run('[]',id);
    await unchanged(summary,{serialPvpId:id});app.store.db.prepare('UPDATE serial_pvp_lobby SET rivals_json=? WHERE serial_pvp_id=?').run(saved.rivals_json,id);
  } finally {await close();}
  console.log('Abyss source lobby fixtures passed; native combat/UI/save acceptance remains unproved');
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main,unlockedSeed};
