'use strict';

// Disposable native-shaped mission/SP deltas, not natural eligibility or UI proof.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createServer} = require('./danmemore_server.cjs');
const {request} = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = value => crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-achievement-time-'));
  const database = path.join(directory,'profile.sqlite');
  let app,port,sequence = 21166,now = 1571441370,firstClaim;
  const open = async () => {
    app = createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    port = app.server.address().port;
  };
  const close = async () => { if(app) { await app.close(); app = null; } };
  const send = (action,value) => request(port,++sequence,value,'0',action);
  const parse = reply => { assert.equal(reply.status,200,reply.body.toString()); return JSON.parse(reply.body); };
  const put = (name,rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows),md5(rows),name);
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const claim = rows => send('achievement/complete',{achievementIds:rows.map(({achievementId,completedAt})=>({achievementId,completedAt}))});
  const push = (putItems,operations = []) => send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
      Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
    deltas:[{signature:0,trigger:'DailyMissionReceived',putItems,deleteItems:{}}],
    operations:operations.map(row=>({id:row.id,verifier:row.token})),
  });
  const row = (achievementId,completedAt = 1571429698) => ({userId:seed.userId,achievementId,
    completedAt,lastResetAt:1571410831,progressParam:10,readState:1,signature:0,state:3});
  const reject = async promise => {
    const before = snapshot(), reply = await promise;
    assert.equal(reply.status,400,reply.body.toString()); assert.equal(snapshot(),before);
  };
  try {
    await open();
    const info = structuredClone(app.store.read('UserInfo').data);
    info[0].playerStatus.baseSP = 59; put('UserInfo',info);
    for(const id of [6010000001,6010000002]) {
      const rows = [row(id)]; put('UserAchievement',rows);
      assert.ok(master.achievements[id].expireAt < now,'Reproduce the historical 1003, not the 2018 anchor window');
      const beforeInfo = app.store.read('UserInfo').data, wallet = app.store.hardCurrency();
      const result = parse(await claim(rows)), identity = sequence, operation = result.operation;
      firstClaim ??= {row:rows[0],body:{achievementIds:[{achievementId:id,completedAt:rows[0].completedAt}]},
        identity,result};
      assert.equal(operation.type,6000); assert.equal(result.issueStamina,50);
      assert.deepEqual(result.operations,[operation]); assert.deepEqual(result.receivedItems,[]);
      assert.equal(app.store.hardCurrency(),wallet); assert.deepEqual(app.store.read('UserInfo').data,beforeInfo);
      assert.equal(app.store.db.prepare('SELECT sp_minimum FROM stamina_reward_claim WHERE operation_id=?').get(operation.id).sp_minimum,
        beforeInfo[0].playerStatus.baseSP+50);
      app.store.db.exec('DELETE FROM reply_cache'); await close(); await open();
      const pending = snapshot();
      assert.deepEqual(parse(await request(port,identity,{achievementIds:[{achievementId:id,completedAt:rows[0].completedAt}]},'0','achievement/complete')),result);
      assert.equal(snapshot(),pending,'Native 0/sequence identity retry is read-only');
      await reject(push({},[operation]));
      const acquired = structuredClone(beforeInfo); acquired[0].playerStatus.baseSP += 50;
      parse(await push({UserAchievement:rows.map(r=>({...r,state:4})),UserInfo:acquired},[operation]));
      assert.deepEqual(app.store.operations(),[]); assert.equal(app.store.read('UserInfo').data[0].playerStatus.baseSP,acquired[0].playerStatus.baseSP);
      assert.ok(app.store.db.prepare('SELECT id FROM operation_done WHERE id=?').get(operation.id));
    }
    // WRITTEN ONLY: an interrupted reward may cross a reset only after an
    // earlier committed push durably observed its exact state-4 claim flag.
    for(const [index,id] of [6010000001,6010000002].entries()) {
      now+=86400;
      const pendingRow={...row(id,now-20),lastResetAt:now-3600},beforeInfo=structuredClone(app.store.read('UserInfo').data);
      put('UserAchievement',[pendingRow]);
      const pendingResult=parse(await claim([pendingRow])),pendingIdentity=sequence,operation=pendingResult.operation,
        receipt=app.store.achievementPcReceipt(operation).receipt,
        replacement=index===0?{...pendingRow,state:2}:{...pendingRow,completedAt:now-10,lastResetAt:now-1800,state:3};
      await reject(push({UserAchievement:[replacement]}));
      parse(await push({UserAchievement:[{...pendingRow,state:4}]}));
      assert.ok(app.store.achievementPcReceipt(operation).observed.includes(`claim:${id}`));
      assert.equal(app.store.staminaReward(operation).effect_saved,0);
      parse(await push({UserAchievement:[replacement]}));
      app.store.db.exec('DELETE FROM reply_cache');await close();await open();
      const hot=parse(await request(port,pendingIdentity,{achievementIds:[{achievementId:id,
        completedAt:pendingRow.completedAt}]},'0','achievement/complete'));
      assert.deepEqual(hot.UserAchievement,[pendingRow]);assert.equal(hot.issueStamina,50);
      assert.deepEqual(hot.operation.parameters.UserAchievement,[]);
      assert.equal(hot.operation.parameters.issueStamina,50);
      const recovered=parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id);
      assert.deepEqual(recovered.parameters.UserAchievement,[]);
      assert.equal(recovered.parameters.issueStamina,50);
      const acquired=structuredClone(beforeInfo);acquired[0].playerStatus.baseSP=app.store.staminaReward(operation).sp_minimum;
      parse(await push({UserInfo:acquired},[operation]));
      assert.ok(app.store.db.prepare('SELECT id FROM operation_done WHERE id=?').get(operation.id));
      assert.deepEqual(app.store.read('UserAchievement').data,[replacement]);
      if(replacement.state===3) {
        const nextResult=parse(await claim([replacement])),nextOperation=nextResult.operation,
          nextInfo=structuredClone(acquired);nextInfo[0].playerStatus.baseSP+=50;
        parse(await push({UserAchievement:[{...replacement,state:4}],UserInfo:nextInfo},[nextOperation]));
      }
      assert.equal(receipt.operation_json,JSON.stringify(operation),'The interrupted source operation remains immutable');
    }
    // WRITTEN ONLY: the inverse native interruption saves every non-claim
    // effect before daily reset replaces the still-state3 flag. The durable
    // SP receipt, never the candidate reset/SP rows in one push, closes it.
    for(const [index,id] of [6010000001,6010000002].entries()) {
      now+=86400;
      const pendingRow={...row(id,now-20),lastResetAt:now-3600},beforeInfo=structuredClone(app.store.read('UserInfo').data);
      put('UserAchievement',[pendingRow]);
      const pendingResult=parse(await claim([pendingRow])),pendingIdentity=sequence,operation=pendingResult.operation,
        replacement=index===0?{...pendingRow,state:2}:{...pendingRow,completedAt:now-10,lastResetAt:now-1800,state:3},
        acquired=structuredClone(beforeInfo);
      acquired[0].playerStatus.baseSP=app.store.staminaReward(operation).sp_minimum;
      await reject(push({UserAchievement:[replacement],UserInfo:acquired}));
      parse(await push({UserInfo:acquired}));
      assert.equal(app.store.staminaReward(operation).effect_saved,1);
      assert.ok(!app.store.achievementPcReceipt(operation).observed.includes(`claim:${id}`));
      parse(await push({UserAchievement:[replacement]}));
      app.store.db.exec('DELETE FROM reply_cache');await close();await open();
      const hot=parse(await request(port,pendingIdentity,{achievementIds:[{achievementId:id,
        completedAt:pendingRow.completedAt}]},'0','achievement/complete'));
      assert.deepEqual(hot.UserAchievement,[pendingRow]);assert.equal(hot.issueStamina,50);
      assert.deepEqual(hot.operation.parameters.UserAchievement,[]);
      assert.equal(hot.operation.parameters.issueStamina,0);
      const recovered=parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id);
      assert.deepEqual(recovered.parameters.UserAchievement,[]);
      assert.equal(recovered.parameters.issueStamina,0);
      parse(await push({},[operation]));
      assert.ok(app.store.db.prepare('SELECT id FROM operation_done WHERE id=?').get(operation.id));
      assert.deepEqual(app.store.read('UserAchievement').data,[replacement]);
      if(replacement.state===3) {
        const nextResult=parse(await claim([replacement])),nextOperation=nextResult.operation,
          nextInfo=structuredClone(acquired);nextInfo[0].playerStatus.baseSP+=50;
        parse(await push({UserAchievement:[{...replacement,state:4}],UserInfo:nextInfo},[nextOperation]));
      }
    }
    // WRITTEN ONLY: a settled category-1 receipt remains replayable after the
    // native row advances through reset state2 and a later completion. It may
    // not use that replacement to redeliver the old operation or mint SP.
    const {operation:_oldHot,operations:_oldPending,...oldPopup}=firstClaim.result,
      oldSettled={...oldPopup,operations:[]},oldCompleted=firstClaim.row.completedAt,
      resetAt=now+1,reset={...firstClaim.row,state:2,lastResetAt:resetAt};
    parse(await push({UserAchievement:[reset]}));
    app.store.db.exec('DELETE FROM reply_cache'); await close(); await open();
    let beforeReplay=snapshot();
    assert.deepEqual(parse(await request(port,firstClaim.identity,firstClaim.body,'0','achievement/complete')),oldSettled);
    assert.equal(snapshot(),beforeReplay,'Settled reset-state replay is read-only');
    now+=86400;
    const nextGeneration={...firstClaim.row,completedAt:now-1,lastResetAt:resetAt,state:3};
    parse(await push({UserAchievement:[nextGeneration]}));
    beforeReplay=snapshot();
    assert.deepEqual(parse(await request(port,firstClaim.identity,firstClaim.body,'0','achievement/complete')),oldSettled);
    assert.equal(snapshot(),beforeReplay,'A later daily generation does not remint the old reward');
    const nextResult=parse(await claim([nextGeneration])),nextIdentity=sequence,nextOperation=nextResult.operation,
      nextInfo=structuredClone(app.store.read('UserInfo').data);
    nextInfo[0].playerStatus.baseSP+=50;
    parse(await push({UserAchievement:[{...nextGeneration,state:4}],UserInfo:nextInfo},[nextOperation]));
    const nextSettled={...Object.fromEntries(Object.entries(nextResult).filter(([key])=>
      !['operation','operations'].includes(key))),operations:[]};
    now=oldCompleted;
    app.store.db.exec('DELETE FROM reply_cache'); await close(); await open();
    beforeReplay=snapshot();
    assert.deepEqual(parse(await request(port,firstClaim.identity,firstClaim.body,'0','achievement/complete')),oldSettled,
      'Event-clock rewind does not invalidate the durable newer generation');
    assert.deepEqual(parse(await request(port,nextIdentity,{achievementIds:[{achievementId:nextGeneration.achievementId,
      completedAt:nextGeneration.completedAt}]},'0','achievement/complete')),nextSettled);
    assert.equal(snapshot(),beforeReplay,'Settled cross-generation retries remain read-only after a clock rewind');
    for(const invalid of [
      {...firstClaim.row,state:3},
      {...nextGeneration,state:1},
      {...nextGeneration,userId:2},
      {...nextGeneration,lastResetAt:firstClaim.row.lastResetAt-1},
      {...nextGeneration,completedAt:firstClaim.row.completedAt-1},
    ]) {
      put('UserAchievement',[invalid]); await reject(request(port,firstClaim.identity,firstClaim.body,'0','achievement/complete'));
    }
    put('UserAchievement',[{...nextGeneration,state:4}]);
    assert.deepEqual(master.achievementTimeBonuses,[6010000001,6010000002],'Original condition602 classification only');
    // Do not exempt every Daily, erase expiry, trust future completions or mint claims for foreign/uncompleted rows.
    for(const invalid of [row(6010000003),row(6010000008),row(6010000001,now+1),
      {...row(6010000001,now-1),userId:2},{...row(6010000001,now-1),state:2}]) {
      put('UserAchievement',[invalid]); await reject(claim([invalid]));
    }
    const next = row(6010000001,now); put('UserAchievement',[next]);
    app.store.db.exec("CREATE TRIGGER fail_bonus BEFORE INSERT ON achievement_request BEGIN SELECT RAISE(ABORT,'bonus rollback'); END");
    const before = snapshot(); assert.equal((await claim([next])).status,503); assert.equal(snapshot(),before);
    app.store.db.exec('DROP TRIGGER fail_bonus');
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    console.log('Original condition602 time bonuses: historical claims, SP/flags/ACK, native request0 retries, expiry/future/owner guards and rollback OK (isolated checks)');
  } finally {
    await close();
    const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('danmemore-achievement-time-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
