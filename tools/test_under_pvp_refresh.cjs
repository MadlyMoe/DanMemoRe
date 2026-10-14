'use strict';

// DEFERRED / NOT RUN. Native-shaped saves are not natural UI/callback/signature proof.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const {underPvpGameStatuses,underPvpGameStatusDefault,underPvpRefreshLimit,underPvpRefreshIntent,
  underPvpSelectedRivalReset,underPvpRefreshDayMatches,underPvpRefreshTarget}=require('./under_pvp.cjs');
const master=require('../data/danmemore-master.json'),seed=require('../data/danmemore-seed.json');
const id=69000000001,season=master.underPvp.underPvpInformation[id],table='UserUnderPvPGameStatus',route='under_pvp/rival_list/update';
const md5=text=>crypto.createHash('md5').update(text).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-under-refresh-')),database=path.join(directory,'save.sqlite');
  let app,port,sequence=0,now=season.slot8+100;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const delta=rows=>({badges:null,scripts:{},dataTokens:{},operations:[],checksums:{before:{},after:{[table]:md5(JSON.stringify(rows))}},
    deltas:[{signature:0,trigger:'UpdateUnderPvpState',putItems:{[table]:rows},deleteItems:{}}]});
  const current=()=>app.store.read(table).data.find(row=>row.underPvpId===id) ?? underPvpGameStatusDefault(id);
  const push=row=>send('user_data/push',delta([row]));
  const rejected=async(action,value)=>{const before=snapshot(),reply=await send(action,value);
    assert.equal(reply.status,503,reply.body.toString());assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Cancelled refresh/save retains profiles, counters, snapshots, receipts and replies');};
  const body={underPvpId:id,isSelectedRivalIdReset:true};
  const refreshBody=()=>({...body,isSelectedRivalIdReset:underPvpSelectedRivalReset(current(),now)});
  try {
    const midnight=(Math.floor((season.slot8+32400)/86400)+1)*86400-32400;
    assert.equal(underPvpSelectedRivalReset(null,midnight),true);
    assert.equal(underPvpSelectedRivalReset({...currentStatus(),lastRivalListUpdateAt:midnight-1},midnight-1),false);
    assert.equal(underPvpSelectedRivalReset({...currentStatus(),lastRivalListUpdateAt:midnight-1},midnight),true);
    assert.equal(underPvpSelectedRivalReset({...currentStatus(),lastRivalListUpdateAt:midnight},midnight-1),true,'Date comparison is not a monotonic time test');
    assert.equal(underPvpSelectedRivalReset({...currentStatus(),updatedMatchingCount:3,executeRivalListUpdate:true,
      lastRivalListUpdateAt:midnight},midnight+1),false,'Manual intent does not select the day-reset flag');
    assert.throws(()=>underPvpSelectedRivalReset(null,Number.MAX_SAFE_INTEGER),/reconciliation/);
    const yesterday={...currentStatus(),lastRivalListUpdateAt:midnight-1};
    assert.equal(underPvpRefreshDayMatches(yesterday,midnight+5,false),true);
    assert.equal(underPvpRefreshDayMatches(yesterday,midnight+6,false),false);
    assert.equal(underPvpRefreshDayMatches(yesterday,midnight,0),false);
    const pristine=currentStatus();
    assert.deepEqual(underPvpRefreshIntent(null,id,master),{...pristine,updatedMatchingCount:1,executeRivalListUpdate:true});
    for(let count=0;count<3;count++) assert.deepEqual(underPvpRefreshIntent({...pristine,updatedMatchingCount:count},id,master),
      {...pristine,updatedMatchingCount:count+1,executeRivalListUpdate:true});
    assert.equal(underPvpRefreshIntent({...pristine,updatedMatchingCount:3},id,master),null);
    assert.equal(underPvpRefreshIntent({...pristine,executeRivalListUpdate:true},id,master),null);
    assert.deepEqual(pristine,currentStatus(),'Possible intent projection never mutates its native baseline');
    for (const seasonId of Object.keys(master.underPvp.underPvpInformation).map(Number))
      assert.equal(underPvpRefreshLimit(seasonId,master),3);
    const differentRule=structuredClone(master);
    differentRule.underPvp.underPvpRule[season.slot3].slot6=99;
    assert.equal(underPvpRefreshLimit(id,differentRule),3,'Under quota uses slot5, not the Abyss slot6');
    for(const row of [{...currentStatus(),extra:true},{...currentStatus(),updatedMatchingCount:-1},
      {...currentStatus(),updatedMatchingCount:0x80000000},{...currentStatus(),userId:seed.userId+1}])
      assert.throws(()=>underPvpGameStatuses([row],master,seed.userId),/reconciliation/);
    await open();parse(await send('under_pvp/summary/get',{underPvpId:id}));
    await rejected(route,{...body,isSelectedRivalIdReset:false});
    await rejected('user_data/push',delta([{...current(),updatedMatchingCount:2,executeRivalListUpdate:true}]));
    await rejected('user_data/push',delta([{...current(),executeRivalListUpdate:true}]));
    await rejected('user_data/push',delta([{...current(),updatedMatchingCount:1}]));
    for(let count=1;count<=3;count++) {
      const baseline=current();now++;
      parse(await push({...baseline,updatedMatchingCount:count,executeRivalListUpdate:true}));
      const profiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
      const issuedBody=refreshBody(),first=await send(route,issuedBody),identity=sequence;assert.deepEqual(parse(first),{code:0,result:0});
      assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profiles,'Issue never prewrites native counter/list flags');
      assert.equal(app.store.underPvpRefreshReceipt(id).saved,null);
      assert.equal(app.store.underPvpRefreshReceipt(id).selected_rival_reset,Number(issuedBody.isSelectedRivalIdReset));
      assert.deepEqual(parse(await request(port,identity,issuedBody,String(identity),route)),{code:0,result:0});
      await rejected(route,issuedBody);
      const target={...current(),updateRivalList:false,executeRivalListUpdate:false,lastRivalListUpdateAt:now};
      assert.ok(underPvpRefreshTarget(target,current(),true,now));
      await rejected('user_data/push',delta([{...target,updatedMatchingCount:0}]));
      await rejected('user_data/push',delta([{...target,lastRivalListUpdateAt:now+121}]));
      if(count===1) {
        await close();await open();app.store.db.exec('DELETE FROM reply_cache');
        assert.deepEqual(parse(await request(port,identity,issuedBody,String(identity),route)),{code:0,result:0},'Pending actual-wire refresh survives reopening');
        app.store.db.exec("CREATE TRIGGER fail_refresh_save BEFORE UPDATE ON under_pvp_refresh BEGIN SELECT RAISE(ABORT,'refresh save rollback'); END");
        await rejected('user_data/push',delta([target]));app.store.db.exec('DROP TRIGGER fail_refresh_save');
      }
      parse(await push(target));assert.equal(app.store.underPvpRefreshReceipt(id).saved.updatedMatchingCount,count);
      app.store.db.exec('DELETE FROM reply_cache');const before=snapshot(),old=await request(port,identity,issuedBody,String(identity),route);
      assert.equal(old.status,503);assert.equal(snapshot(),before,'Observed manual refresh cannot repeat its date/flags callback');
    }
    await rejected('user_data/push',delta([{...current(),updatedMatchingCount:4,executeRivalListUpdate:true}]));
    await rejected('user_data/push',delta([{...current(),updatedMatchingCount:0}]));
    now=midnight+6;
    await rejected(route,{...body,isSelectedRivalIdReset:false});
    parse(await send(route,refreshBody()));
    parse(await push({...current(),updateRivalList:false,executeRivalListUpdate:false,lastRivalListUpdateAt:now}));
    assert.equal(current().updatedMatchingCount,3,'The request day flag does not reset or replenish manual quota');
    // Automatic/reset callers have no manual increment. Their inner callback
    // may save the retained count before the outer resetRivalList callback.
    // Already-held flags/time are not marked as an observed native callback.
    const automaticBody={...body,isSelectedRivalIdReset:false};
    parse(await send(route,automaticBody));const automaticIdentity=sequence;
    assert.equal(app.store.underPvpRefreshReceipt(id).observed,0);now++;
    assert.deepEqual(parse(await request(port,automaticIdentity,automaticBody,String(automaticIdentity),route)),{code:0,result:0});
    const retained={...current(),lastRivalListUpdateAt:now};parse(await push(retained));
    assert.equal(app.store.underPvpRefreshReceipt(id).observed,1);
    assert.equal(current().updatedMatchingCount,3);
    parse(await push({...retained,updatedMatchingCount:0}));assert.equal(current().updatedMatchingCount,0);
    // A frozen-clock no-change callback need not dirty the native table.
    parse(await send(route,{...body,isSelectedRivalIdReset:false}));
    assert.equal(app.store.underPvpRefreshReceipt(id).saved.updatedMatchingCount,0);
    assert.equal(app.store.underPvpRefreshReceipt(id).observed,0,'Already-held target is separate from native observation');
    parse(await push(current()));
    assert.equal(app.store.underPvpRefreshReceipt(id).observed,0,'An unchanged put proves no callback-owned setter changed');
    now++;
    parse(await send(route,refreshBody()));const issued=now;now=season.slot11+86400;
    parse(await push({...current(),lastRivalListUpdateAt:now}));
    assert.equal(app.store.underPvpRefreshReceipt(id).issued_at,issued,'Late callback saves remain bound to their issued original season');
    assert.equal(app.store.underPvpRefreshReceipt(id).saved_at,now);
    await close();await open();now=issued+1;
    assert.equal(current().updatedMatchingCount,0,'Clock rewind is not an additional quota reset');
    const native=app.store.read(table).data;
    const corrupt=native.map(row=>row.underPvpId===id?{...row,updatedMatchingCount:2}:row),corruptJson=JSON.stringify(corrupt);
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(corruptJson,md5(corruptJson),table);
    await rejected(route,body);
    const nativeJson=JSON.stringify(native);app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(nativeJson,md5(nativeJson),table);
    const retainedReceipt=app.store.db.prepare('SELECT * FROM under_pvp_refresh WHERE under_pvp_id=?').get(id);
    for(const [field,bad] of [['catalog_hash','bad'],['saved_status','{}'],['before_status','null']]) {
      app.store.db.prepare(`UPDATE under_pvp_refresh SET ${field}=? WHERE under_pvp_id=?`).run(bad,id);
      await rejected(route,body);
      app.store.db.prepare(`UPDATE under_pvp_refresh SET ${field}=? WHERE under_pvp_id=?`).run(retainedReceipt[field],id);
    }
    // A held callback issued before midnight keeps its actual wire flag on
    // retry; a new request uses its own date. Neither changes quota by itself.
    now=midnight+86400-1;
    parse(await send(route,refreshBody()));parse(await push({...current(),lastRivalListUpdateAt:now}));
    const beforeMidnight=refreshBody();assert.equal(beforeMidnight.isSelectedRivalIdReset,false);
    parse(await send(route,beforeMidnight));const midnightIdentity=sequence;
    now+=7;await close();await open();app.store.db.exec('DELETE FROM reply_cache');
    assert.deepEqual(parse(await request(port,midnightIdentity,beforeMidnight,String(midnightIdentity),route)),{code:0,result:0});
    assert.equal(app.store.underPvpRefreshReceipt(id).selected_rival_reset,0);
    assert.equal(app.store.underPvpRefreshReceipt(id).issued_at,now-7,'Retry does not recompute issue date');
    parse(await push({...current(),lastRivalListUpdateAt:now}));
    await rejected(route,{...body,isSelectedRivalIdReset:true});
    // Explicit offline5s arrival tolerance, not a publisher protocol claim.
    now=midnight+2*86400+2;
    parse(await send(route,{...body,isSelectedRivalIdReset:false}));
    assert.equal(app.store.underPvpRefreshReceipt(id).selected_rival_reset,0);
    parse(await push({...current(),lastRivalListUpdateAt:now}));
    now=midnight+3*86400+6;
    await rejected(route,{...body,isSelectedRivalIdReset:false});
    const changedDay=refreshBody(),profiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
    app.store.db.exec("CREATE TRIGGER fail_refresh_issue BEFORE INSERT ON under_pvp_refresh BEGIN SELECT RAISE(ABORT,'refresh issue rollback'); END");
    await rejected(route,changedDay);app.store.db.exec('DROP TRIGGER fail_refresh_issue');
    parse(await send(route,changedDay));const changedDayIdentity=sequence,dayReceipt=app.store.underPvpRefreshReceipt(id);
    assert.equal(dayReceipt.selected_rival_reset,1);assert.equal(dayReceipt.manual,0);
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profiles,'Date flag capture never prewrites native profiles');
    for(const bad of [0,2]) {
      app.store.db.prepare('UPDATE under_pvp_refresh SET selected_rival_reset=? WHERE under_pvp_id=?').run(bad,id);
      const before=snapshot(),reply=await request(port,changedDayIdentity,changedDay,String(changedDayIdentity),route);
      assert.equal(reply.status,503);assert.equal(snapshot(),before,'Substituted day flag never repairs historical receipts');
      app.store.db.prepare('UPDATE under_pvp_refresh SET selected_rival_reset=? WHERE under_pvp_id=?').run(dayReceipt.selected_rival_reset,id);
    }
    app.store.db.prepare('UPDATE under_pvp_refresh SET selected_rival_reset=NULL WHERE under_pvp_id=?').run(id);
    app.store.db.exec('DELETE FROM reply_cache');
    const legacyBefore=snapshot();
    assert.deepEqual(parse(await request(port,changedDayIdentity,changedDay,String(changedDayIdentity),route)),{code:0,result:0});
    assert.equal(snapshot(),legacyBefore,'Legacy exact-wire date evidence is read, not backfilled');
    const altered=await request(port,changedDayIdentity,{...changedDay,isSelectedRivalIdReset:false},String(changedDayIdentity),route);
    assert.equal(altered.status,400);assert.equal(snapshot(),legacyBefore,'Legacy NULL cannot authorize a changed wire flag');
    assert.equal(app.store.underPvpRefreshReceipt(id).selected_rival_reset,null);
    app.store.db.prepare('UPDATE under_pvp_refresh SET selected_rival_reset=? WHERE under_pvp_id=?').run(dayReceipt.selected_rival_reset,id);
    parse(await push({...current(),lastRivalListUpdateAt:now}));
    assert.equal(app.store.underPvpRefreshReceipt(id).manual,0,'Unchanged counters do not resolve a possible intent as manual');
    for(let count=1;count<=3;count++) {
      if(count>1) now++;
      const original={...current()},intent=underPvpRefreshIntent(original,id,master),issuedBody=refreshBody(),
        profiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
      parse(await send(route,issuedBody));const identity=sequence,captured=app.store.underPvpRefreshReceipt(id),issued=now;
      assert.equal(captured.manual,0);assert.deepEqual(captured.intent,intent);assert.deepEqual(captured.requestBefore,original);
      assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profiles,'Possible intent is not an injected counter/save');
      await rejected('user_data/push',delta([{...intent,updatedMatchingCount:count+1,executeRivalListUpdate:false,
        updateRivalList:false,lastRivalListUpdateAt:now}]));
      await rejected('user_data/push',delta([{...intent,lastBattleStartAt:now}]));
      if(count===2) {
        for(const bad of [null,'null','{}',JSON.stringify({...intent,updatedMatchingCount:3})]) {
          app.store.db.prepare('UPDATE under_pvp_refresh SET possible_intent=? WHERE under_pvp_id=?').run(bad,id);
          await rejected('user_data/push',delta([{...intent,executeRivalListUpdate:false,lastRivalListUpdateAt:now}]));
          app.store.db.prepare('UPDATE under_pvp_refresh SET possible_intent=? WHERE under_pvp_id=?').run(captured.possible_intent,id);
        }
        app.store.db.exec("CREATE TRIGGER fail_deferred_intent BEFORE UPDATE ON under_pvp_refresh BEGIN SELECT RAISE(ABORT,'deferred intent rollback'); END");
        await rejected('user_data/push',delta([intent]));app.store.db.exec('DROP TRIGGER fail_deferred_intent');
      }
      if(count<3) {
        parse(await push(intent));const pending=app.store.underPvpRefreshReceipt(id);
        assert.deepEqual(pending.requestBefore,original,'Delayed intent does not replace the request capture');
        assert.equal(pending.manual,count===1?0:1);
        assert.equal(pending.observed,0);
        if(count===1) assert.deepEqual(pending.saved,original,'Held target remains ambiguous until the callback save');
        else {assert.equal(pending.saved,null);await rejected(route,issuedBody);}
        await close();await open();app.store.db.exec('DELETE FROM reply_cache');
        assert.deepEqual(parse(await request(port,identity,issuedBody,String(identity),route)),{code:0,result:0});
      } else now=season.slot11+3600;
      const target={...intent,executeRivalListUpdate:false,updateRivalList:false,lastRivalListUpdateAt:now};
      app.store.db.exec("CREATE TRIGGER fail_deferred_callback BEFORE UPDATE ON under_pvp_refresh BEGIN SELECT RAISE(ABORT,'deferred callback rollback'); END");
      await rejected('user_data/push',delta([target]));app.store.db.exec('DROP TRIGGER fail_deferred_callback');
      parse(await push(target));const resolved=app.store.underPvpRefreshReceipt(id);
      assert.equal(resolved.manual,1);assert.equal(resolved.observed,1);assert.deepEqual(resolved.saved,target);
      assert.deepEqual(resolved.requestBefore,original);assert.deepEqual(resolved.before,intent);
      assert.equal(resolved.issued_at,issued);assert.equal(current().updatedMatchingCount,count);
      await rejected('user_data/push',delta([{...target,updatedMatchingCount:0}]));
      app.store.db.exec('DELETE FROM reply_cache');const before=snapshot(),old=await request(port,identity,issuedBody,String(identity),route);
      assert.equal(old.status,503);assert.equal(snapshot(),before,'Resolved delayed callback cannot charge or apply again');
      if(count===3) now=issued+1;
    }
    await rejected('user_data/push',delta([{...current(),updatedMatchingCount:4,executeRivalListUpdate:true}]));
    // The alternative natural order: held automatic callback, NEW manual
    // intent save, then its own request. Never bind that intent to the old wire.
    parse(await send(route,refreshBody()));parse(await push({...current(),updatedMatchingCount:0,lastRivalListUpdateAt:now}));
    const heldBody=refreshBody();parse(await send(route,heldBody));const heldIdentity=sequence,
      held=app.store.underPvpRefreshReceipt(id),next=underPvpRefreshIntent(current(),id,master);
    parse(await push(next));assert.equal(app.store.underPvpRefreshReceipt(id).manual,0);
    assert.deepEqual(app.store.underPvpRefreshReceipt(id).saved,held.saved);
    parse(await send(route,refreshBody()));const nextReceipt=app.store.underPvpRefreshReceipt(id);
    assert.equal(nextReceipt.manual,1);assert.equal(nextReceipt.intent,null);assert.notEqual(nextReceipt.request_key,held.request_key);
    const before=snapshot(),obsolete=await request(port,heldIdentity,heldBody,String(heldIdentity),route);
    assert.equal(obsolete.status,503);assert.equal(snapshot(),before,'Old held wire cannot consume the new manual request');
    parse(await push({...next,executeRivalListUpdate:false,updateRivalList:false,lastRivalListUpdateAt:now}));
    assert.equal(current().updatedMatchingCount,1);
    // DEFERRED: close gates apply to fresh actions, not an exact issued wire.
    now=season.slot9-1;
    parse(await push({...current(),updatedMatchingCount:2,executeRivalListUpdate:true}));
    const pendingBody=refreshBody();parse(await send(route,pendingBody));const pendingIdentity=sequence,
      pending=app.store.underPvpRefreshReceipt(id),pendingKey=`${pendingIdentity}/${pendingIdentity}`,
      pendingCache=app.store.db.prepare('SELECT * FROM reply_cache WHERE key=?').get(pendingKey),
      pendingRivals=app.store.db.prepare('SELECT * FROM under_pvp_rivals WHERE under_pvp_id=?').get(id);
    assert.ok(pendingCache);assert.equal(pendingRivals.updated_at,pending.issued_at,'Fresh issuance freezes one private clock value');
    for(const time of [season.slot9,season.slot11,season.slot10-1]) {
      now=time;
      if(time!==season.slot9) {await close();await open();app.store.db.exec('DELETE FROM reply_cache');}
      const held=snapshot();
      assert.deepEqual(parse(await request(port,pendingIdentity,pendingBody,String(pendingIdentity),route)),{code:0,result:0});
      assert.equal(snapshot(),held,'Exact pending retry neither reissues nor rewrites its original capture after expiry/rewind');
      await rejected(route,pendingBody);
      if(time!==season.slot9) await rejected('under_pvp/summary/get',{underPvpId:id});
      const altered=await request(port,pendingIdentity,{...pendingBody,isSelectedRivalIdReset:!pendingBody.isSelectedRivalIdReset},
        String(pendingIdentity),route,{'X-ARGO-REQUEST-BODY-HASH':pendingCache.body_hash});
      assert.equal(altered.status,400);assert.equal(snapshot(),held,'A forged original header cannot replace actual captured wire');
    }
    for(const [field,bad] of [['request_key','wrong/refresh'],['catalog_hash','wrong'],
      ['issued_at',season.slot9],['generation',pending.generation+1]]) {
      app.store.db.prepare(`UPDATE under_pvp_refresh SET ${field}=? WHERE under_pvp_id=?`).run(bad,id);
      const held=snapshot(),reply=await request(port,pendingIdentity,pendingBody,String(pendingIdentity),route);
      assert.equal(reply.status,503);assert.equal(snapshot(),held,'Invalid issued ownership is retained without repair');
      app.store.db.prepare(`UPDATE under_pvp_refresh SET ${field}=? WHERE under_pvp_id=?`).run(pending[field],id);
    }
    for(const at of [pending.issued_at-6,pending.issued_at+121]) {
      app.store.db.prepare('UPDATE under_pvp_rivals SET updated_at=? WHERE under_pvp_id=?').run(at,id);
      const held=snapshot(),reply=await request(port,pendingIdentity,pendingBody,String(pendingIdentity),route);
      assert.equal(reply.status,503);assert.equal(snapshot(),held,'Unbounded snapshot/issue clock drift cannot authorize retry');
    }
    app.store.db.prepare('UPDATE under_pvp_rivals SET updated_at=? WHERE under_pvp_id=?').run(pending.issued_at+1,id);
    const legacyTime=snapshot();
    assert.deepEqual(parse(await request(port,pendingIdentity,pendingBody,String(pendingIdentity),route)),{code:0,result:0});
    assert.equal(snapshot(),legacyTime,'Bounded prior multi-clock capture is read, not normalized or backfilled');
    app.store.db.prepare('UPDATE under_pvp_rivals SET updated_at=? WHERE under_pvp_id=?').run(pendingRivals.updated_at,id);
    app.store.db.prepare('UPDATE under_pvp_refresh SET selected_rival_reset=NULL WHERE under_pvp_id=?').run(id);
    const legacyFlag=snapshot();
    assert.deepEqual(parse(await request(port,pendingIdentity,pendingBody,String(pendingIdentity),route)),{code:0,result:0});
    assert.equal(snapshot(),legacyFlag,'Legacy nullable day flag still requires exact owned wire/issue date, without backfill');
    app.store.db.prepare('UPDATE under_pvp_refresh SET selected_rival_reset=? WHERE under_pvp_id=?').run(pending.selected_rival_reset,id);
    const transport=app.store.db.prepare('SELECT * FROM under_pvp_view_request WHERE request_key=?').get(pendingKey);
    app.store.db.prepare('UPDATE under_pvp_view_request SET response=? WHERE request_key=?').run('{}',pendingKey);
    const corruptResponse=snapshot(),reply=await request(port,pendingIdentity,pendingBody,String(pendingIdentity),route);
    assert.equal(reply.status,503);assert.equal(snapshot(),corruptResponse);
    app.store.db.prepare('UPDATE under_pvp_view_request SET response=? WHERE request_key=?').run(transport.response,pendingKey);
    now=season.slot11+3600;
    const expiredTarget={...current(),updateRivalList:false,executeRivalListUpdate:false,lastRivalListUpdateAt:now};
    app.store.db.exec("CREATE TRIGGER fail_expired_refresh BEFORE UPDATE ON under_pvp_refresh BEGIN SELECT RAISE(ABORT,'expired refresh rollback'); END");
    await rejected('user_data/push',delta([expiredTarget]));app.store.db.exec('DROP TRIGGER fail_expired_refresh');
    parse(await push(expiredTarget));assert.equal(app.store.underPvpRefreshReceipt(id).observed,1);
    app.store.db.prepare('INSERT OR REPLACE INTO reply_cache(key,action,body_hash,content_type,body) VALUES(?,?,?,?,?)')
      .run(pendingCache.key,pendingCache.action,pendingCache.body_hash,pendingCache.content_type,pendingCache.body);
    const observed=snapshot(),completed=await request(port,pendingIdentity,pendingBody,String(pendingIdentity),route);
    assert.equal(completed.status,503);assert.equal(snapshot(),observed,'Observed callback cannot bypass durable guards through an old generic cache');
    assert.equal(app.store.operations().length,0);assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM under_pvp_refresh').get().n,1);
  } finally {await close();}
  console.log('Deferred Under refresh fixture completed; NOT native acceptance. Isolated fixtures retained at '+directory);
}
const currentStatus=()=>underPvpGameStatusDefault(id);

async function delayedFirstStatus() {
  for(const mode of ['split','combined','automatic','clock-step']) {
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-under-first-intent-')),database=path.join(directory,'save.sqlite');
    let app,port,sequence=0,now=season.slot8+100,stepClock=false;
    const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>stepClock?now++:now,log:()=>{}});
      await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
    const close=async()=>{if(app){await app.close();app=null;}};
    const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
    const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
    const push=async row=>parse(await send('user_data/push',{badges:null,scripts:{},dataTokens:{},operations:[],
      checksums:{before:{},after:{[table]:md5(JSON.stringify([row]))}},
      deltas:[{signature:0,trigger:'UpdateUnderPvpState',putItems:{[table]:[row]},deleteItems:{}}]}));
    try {
      await open();parse(await send('under_pvp/summary/get',{underPvpId:id}));
      assert.equal(app.store.read(table).data.find(row=>row.underPvpId===id),undefined);
      const body={underPvpId:id,isSelectedRivalIdReset:true};stepClock=mode==='clock-step';
      parse(await send(route,body));stepClock=false;const identity=sequence,
        capture=app.store.underPvpRefreshReceipt(id),intent=underPvpRefreshIntent(null,id,master);
      assert.equal(capture.requestBefore,null);assert.equal(capture.manual,0);assert.deepEqual(capture.intent,intent);
      assert.equal(app.store.db.prepare('SELECT updated_at FROM under_pvp_rivals WHERE under_pvp_id=?').get(id).updated_at,capture.issued_at,
        'A clock advancing between reads still yields one exact issue/snapshot time');
      assert.equal(app.store.read(table).data.find(row=>row.underPvpId===id),undefined,'Issuance does not synthesize the lazy native constructor');
      now=season.slot11+60;await close();await open();app.store.db.exec('DELETE FROM reply_cache');
      assert.deepEqual(parse(await request(port,identity,body,String(identity),route)),{code:0,result:0},
        'Lazy first-status pending wire survives display expiry without constructing a native row');
      assert.equal(app.store.read(table).data.find(row=>row.underPvpId===id),undefined);
      if(mode==='split') {
        await push(intent);assert.equal(app.store.underPvpRefreshReceipt(id).manual,1);
        assert.equal(app.store.underPvpRefreshReceipt(id).saved,null);
        await close();await open();app.store.db.exec('DELETE FROM reply_cache');
        assert.deepEqual(parse(await request(port,identity,body,String(identity),route)),{code:0,result:0});
      }
      const target={...(mode==='automatic'?currentStatus():intent),executeRivalListUpdate:false,
        updateRivalList:false,lastRivalListUpdateAt:now};await push(target);
      const saved=app.store.underPvpRefreshReceipt(id);
      assert.equal(saved.requestBefore,null);assert.equal(saved.manual,mode==='automatic'?0:1);
      assert.equal(saved.observed,1);assert.deepEqual(saved.saved,target);
      assert.equal(app.store.read(table).data.find(row=>row.underPvpId===id).userId,0);
      assert.equal(app.store.operations().length,0);
    } finally {await close();}
  }
}
if(require.main===module) main().then(delayedFirstStatus).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main,delayedFirstStatus};
