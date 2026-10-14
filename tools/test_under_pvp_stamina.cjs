'use strict';

// DEFERRED / NOT RUN. Native clock/save ordering and MuMu still need acceptance.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const { createServer,OFFLINE_UNAVAILABLE_CODE }=require('./danmemore_server.cjs');
const { request }=require('./test_danmemore_server.cjs');
const { underPvpSeasonAt,underPvpStamina }=require('./under_pvp.cjs');
const master=require('../data/danmemore-master.json'),seed=require('../data/danmemore-seed.json');
const hash=bytes=>crypto.createHash('md5').update(bytes).digest('hex');
const first=master.underPvp.underPvpInformation[69000000001],second=master.underPvp.underPvpInformation[69000000002];
const sp=(amount,at)=>({ underPvpSP:amount,underPvpSPUpdatedAt:at });

async function main() {
  const start=first.slot10+60,nextDay=start+86400;
  assert.deepEqual(underPvpStamina(sp(0,0),start,master),sp(3,start));
  assert.deepEqual(underPvpStamina(sp(0,start),start+3600,master),sp(0,start),'No hourly regeneration');
  assert.deepEqual(underPvpStamina(sp(1,start),nextDay,master),sp(3,nextDay));
  assert.deepEqual(underPvpStamina(sp(1,start),start+7*86400,master),sp(3,start+7*86400),'No missed-day backfill');
  assert.deepEqual(underPvpStamina(sp(9,start),nextDay,master),sp(9,nextDay),'Same-season pass stock survives');
  assert.deepEqual(underPvpStamina(sp(999999999,start),nextDay,master),sp(999999999,nextDay));
  assert.deepEqual(underPvpStamina(sp(9,start),second.slot10,master),sp(3,second.slot10));
  assert.deepEqual(underPvpStamina(sp(9,second.slot10),start,master),sp(3,start),'Native reset also follows a real clock rewind');
  assert.deepEqual(underPvpStamina(sp(9,0),start,master),sp(9,start),'No prior season is a top-up, not a reset');
  const midnight=(Math.floor((start+32400)/86400)+1)*86400-32400;
  assert.deepEqual(underPvpStamina(sp(0,midnight-1),midnight,master),sp(3,midnight),'UTC+9 daily boundary');
  for (const [id,row] of Object.entries(master.underPvp.underPvpInformation)) {
    assert.equal(underPvpSeasonAt(row.slot10,master).id,Number(id));
    assert.equal(underPvpSeasonAt(row.slot11-1,master).id,Number(id));
    assert.notEqual(underPvpSeasonAt(row.slot11,master)?.id,Number(id),'Original period end is exclusive');
    assert.deepEqual(underPvpStamina(sp(0,row.slot10-86400),row.slot10,master),sp(3,row.slot10));
    const rewardPhase=row.slot9+60;
    if (rewardPhase<row.slot11) assert.equal(underPvpStamina(sp(0,row.slot10),rewardPhase,master).underPvpSP,3,
      'Daily allowance continues through extended slots10/11, not only matching slots8/9');
  }
  const gap=master.underPvp.underPvpInformation[69000000019].slot11+86400;
  assert.equal(underPvpSeasonAt(gap,master),null);
  assert.deepEqual(underPvpStamina(sp(9,start),gap,master),sp(9,gap),'No active season grants nothing and preserves stock');
  for (const status of [null,sp(-1,start),sp(1000000000,start),sp(1,-1),sp(1,1.5)])
    assert.throws(()=>underPvpStamina(status,start,master),/reconciliation/);
  const broken=structuredClone(master);broken.underPvp.underPvpRule={};
  assert.throws(()=>underPvpStamina(sp(0,0),start,broken),/allowance unavailable/);
  const overlap=structuredClone(master);overlap.underPvp.underPvpInformation[69000000002].slot10=first.slot10;
  assert.throws(()=>underPvpSeasonAt(start,overlap),/Ambiguous/);

  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-under-pvp-sp-')),database=path.join(directory,'save.sqlite');
  let app,port,sequence=0,now=start;
  const open=async()=>{ app=createServer({ database,seed,master,wallNowSeconds:()=>now,log:()=>{} });
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port; };
  const close=async()=>{ if(app){ await app.close();app=null; } };
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const user=()=>app.store.read('UserInfo').data;
  const put=state=>{ const rows=user();Object.assign(rows[0].playerStatus,state);const bytes=JSON.stringify(rows);
    app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserInfo'").run(bytes,hash(bytes)); };
  const save=(state,extras={})=>{ const rows=user();Object.assign(rows[0].playerStatus,state);
    const putItems={ UserInfo:rows,...extras };
    return request(port,++sequence,{ badges:null,scripts:{},dataTokens:{},operations:[],checksums:{ before:{},
      after:Object.fromEntries(Object.entries(putItems).map(([name,data])=>[name,hash(JSON.stringify(data))])) },
      deltas:[{ signature:0,trigger:'UpdateUnderPvpState',putItems,deleteItems:{} }] },String(sequence),'user_data/push'); };
  const accepted=async state=>{ const reply=await save(state);assert.equal(reply.status,200,reply.body.toString());
    assert.deepEqual(sp(user()[0].playerStatus.underPvpSP,user()[0].playerStatus.underPvpSPUpdatedAt),state);return reply; };
  const rejected=async(state,extras={},offline=true)=>{ const before=snapshot(),reply=await save(state,extras);
    assert.equal(reply.status,503,reply.body.toString());if(offline)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Invalid/native-unissued SP saves preserve every SQLite table'); };
  try {
    await open();await accepted(sp(3,start));
    const firstSave=sequence,firstBody=user();
    const delta={ badges:null,scripts:{},dataTokens:{},operations:[],checksums:{ before:{},after:{ UserInfo:hash(JSON.stringify(firstBody)) } },
      deltas:[{ signature:0,trigger:'UpdateUnderPvpState',putItems:{ UserInfo:firstBody },deleteItems:{} }] };
    const stable=snapshot();
    assert.equal((await request(port,firstSave,delta,String(firstSave),'user_data/push')).status,200);
    assert.equal(snapshot(),stable,'Exact cached retry does not regrant daily SP');
    await close();await open();assert.equal(user()[0].playerStatus.underPvpSP,3);
    now=start+3600;await rejected(sp(6,now));await rejected(sp(2,start));await rejected(sp(3,now));
    now=nextDay;await accepted(sp(3,nextDay));await accepted(sp(3,nextDay));
    await rejected(sp(6,nextDay));await rejected(sp(3,nextDay+86400));
    put(sp(9,start));await accepted(sp(9,nextDay));
    now=second.slot10;await accepted(sp(3,now));
    now=start;await accepted(sp(3,start));
    await rejected(sp(3,nextDay));
    now=gap;await accepted(sp(3,gap));
    // An unrelated save retains spendable SP even if its timestamp is in the
    // future after a clock rewind; it is not itself a fresh daily entitlement.
    now=start;await accepted(sp(3,gap));
    put(sp(0,0));const pendingRecord={ ...seed.data.UserUnderPvPInfo[0],medalAmount:7 };
    app.store.db.exec("CREATE TRIGGER fail_under_sp_save BEFORE UPDATE ON profile WHEN NEW.name='UserInfo' BEGIN SELECT RAISE(ABORT,'SP rollback'); END");
    await rejected(sp(3,start),{ UserUnderPvPInfo:[pendingRecord] },false);
    app.store.db.exec('DROP TRIGGER fail_under_sp_save');
    app.store.db.exec("CREATE TRIGGER fail_under_sp_reply BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'SP reply rollback'); END");
    await rejected(sp(3,start),{ UserUnderPvPInfo:[pendingRecord] },false);
    app.store.db.exec('DROP TRIGGER fail_under_sp_reply');await accepted(sp(3,start));
    console.log('Under Telskyura daily projection/save checks passed; native acceptance still required');
  } finally { await close();fs.rmSync(directory,{recursive:true,force:true}); }
}

if (require.main===module) main().catch(error=>{ console.error(error);process.exitCode=1; });
module.exports={ main };
