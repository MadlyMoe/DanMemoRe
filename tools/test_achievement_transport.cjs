'use strict';

// Disposable native-shaped saves, not natural mission eligibility/signature/UI proof.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE} = require('./danmemore_server.cjs');
const {request} = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-achievement-transport-'));
  const database = path.join(directory,'profile.sqlite');
  const now = 1692284400, realNow = Date.now;
  Date.now = () => now * 1000;
  let app,port,sequence = 0;
  const open = async () => {
    app = createServer({database,seed,master,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    port = app.server.address().port;
  };
  const close = async () => { if(app) { await app.close(); app = null; } };
  const send = (action,value) => request(port,++sequence,value,String(sequence),action);
  const parse = reply => { assert.equal(reply.status,200,reply.body.toString()); return JSON.parse(reply.body); };
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const reject = async (promise,status = 503) => {
    const before = snapshot(), reply = await promise;
    assert.equal(reply.status,status,reply.body.toString());
    if(status===503) assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Rejected retry must retain all saves, receipts, queue, wallet and sequence');
  };
  const push = (putItems = {},operations = []) => send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
      Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
    deltas:Object.keys(putItems).length ? [{signature:0,trigger:'DailyMissionReceived',putItems,deleteItems:{}}] : [],
    operations:operations.map(row=>({id:row.id,verifier:row.token})),
  });
  const rows = [6010000008,6050000003].map(achievementId=>({userId:seed.userId,achievementId,completedAt:now,
    lastResetAt:0,progressParam:1,readState:1,signature:0,state:3}));
  const body = {achievementIds:rows.map(({achievementId,completedAt})=>({achievementId,completedAt}))};
  const claim = () => send('achievement/complete',body);
  const retry = (id,value = body,action = 'achievement/complete',headers = {}) => request(port,id,value,String(id),action,headers);
  try {
    await open();
    const valis = {userId:seed.userId,currencyId:master.items['currency.valis'],signature:0,
      bookEntryState:3,cumulativeAmount:100,amount:100,reservedAmount:0};
    const currencies = [valis];
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(currencies),md5(currencies),'UserCurrency');
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),'UserAchievement');
    const wallet = app.store.hardCurrency(), before = snapshot();
    const result = parse(await claim()), identity = sequence, operation = result.operation;
    assert.equal(operation.type,6000);
    assert.equal(result.issueAmount,master.achievements[6010000008].rewardAmount);
    assert.deepEqual(result.receivedItems,[{itemId:valis.currencyId,amount:10000}]);
    assert.deepEqual(result.operations,[operation]);
    assert.equal(app.store.hardCurrency(),wallet+10);
    assert.deepEqual(app.store.read('UserCurrency').data,currencies,'No native inventory precredit');
    assert.notEqual(snapshot(),before);
    app.store.db.exec('DELETE FROM reply_cache'); await close(); await open();
    const retained = snapshot();
    assert.deepEqual(parse(await retry(identity)),result,'Original packet survives cache eviction and restart');
    assert.equal(snapshot(),retained,'Retry reads the original signed reward without reminting');

    const transport = app.store.db.prepare('SELECT * FROM achievement_request WHERE request_key=?').get(`${identity}/${identity}`);
    assert.equal(transport.operation_id,operation.id);
    assert.match(transport.body_hash,/^[0-9a-f]{32}$/);
    app.store.db.prepare('INSERT INTO reply_cache(key,action,body_hash,content_type,body) VALUES(?,?,?,?,?)')
      .run(transport.request_key,'achievement/complete',md5(body),'application/json',Buffer.from(JSON.stringify(result)).toString('base64'));
    app.store.db.prepare('DELETE FROM achievement_request WHERE request_key=?').run(transport.request_key);
    await reject(retry(identity));
    app.store.db.prepare('INSERT INTO achievement_request VALUES(?,?,?)').run(transport.request_key,transport.body_hash,transport.operation_id);
    app.store.db.exec('DELETE FROM reply_cache');
    await reject(retry(identity,{achievementIds:[body.achievementIds[0]]}),400);
    await reject(retry(identity,body,'gift/receive'),400);
    // A copied client header cannot replace the hash of actual encrypted bytes.
    await reject(retry(identity,{achievementIds:[...body.achievementIds].reverse()},'achievement/complete',
      {'X-ARGO-REQUEST-BODY-HASH':md5(body)}),400);
    assert.deepEqual(parse(await retry(identity,body,'achievement/complete',{'X-ARGO-REQUEST-BODY-HASH':'0'.repeat(32)})),result);
    assert.equal(snapshot(),retained);

    for(const changes of [{body_hash:'bad'},{operation_id:operation.id+1}]) {
      const [name,value] = Object.entries(changes)[0];
      app.store.db.prepare(`UPDATE achievement_request SET ${name}=? WHERE request_key=?`).run(value,transport.request_key);
      await reject(retry(identity));
      app.store.db.prepare(`UPDATE achievement_request SET ${name}=? WHERE request_key=?`).run(transport[name],transport.request_key);
    }
    const capture = app.store.db.prepare('SELECT * FROM achievement_pc_delivery WHERE operation_id=?').get(operation.id);
    app.store.db.prepare('DELETE FROM achievement_pc_delivery WHERE operation_id=?').run(operation.id);
    await reject(retry(identity));
    app.store.db.prepare(`INSERT INTO achievement_pc_delivery(operation_id,operation_json,pc_targets,observed,
      memoria_targets,communication_targets,communication_version) VALUES(?,?,?,?,?,?,?)`)
      .run(capture.operation_id,capture.operation_json,capture.pc_targets,capture.observed,capture.memoria_targets,
        capture.communication_targets,capture.communication_version);

    // Semantic retries with a new identity bind to the same receipt atomically.
    const duplicate = parse(await claim()), duplicateIdentity = sequence;
    assert.deepEqual(duplicate,result);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM achievement_request').get().n,2);
    await reject(send('achievement/complete',{achievementIds:[body.achievementIds[0]]}));
    await reject(send('achievement/complete',{achievementIds:[{...body.achievementIds[0],completedAt:now-1}]}));
    app.store.db.exec("CREATE TRIGGER fail_request BEFORE INSERT ON achievement_request BEGIN SELECT RAISE(ABORT,'transport rollback'); END");
    const failed = snapshot(); assert.equal((await claim()).status,503); assert.equal(snapshot(),failed);
    app.store.db.exec('DROP TRIGGER fail_request');
    await reject(push({},[operation]),400);
    parse(await push({UserAchievement:rows.map(row=>({...row,state:4}))}));
    app.store.db.exec('DELETE FROM reply_cache'); await close(); await open();
    const partialOperation={...operation,parameters:{...operation.parameters,UserAchievement:[]}},
      partialResult={...result,operation:partialOperation,operations:[partialOperation]},partialState=snapshot();
    assert.deepEqual(parse(await retry(identity)),partialResult);
    assert.deepEqual(parse(await retry(duplicateIdentity)),partialResult);
    assert.equal(snapshot(),partialState,'Existing partial hot identities are read-only');
    const partialFresh=parse(await claim()),partialIdentity=sequence;
    assert.deepEqual(partialFresh,partialResult);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM achievement_request').get().n,3);
    const cachedPartial=snapshot();assert.deepEqual(parse(await retry(partialIdentity)),partialResult);
    assert.equal(snapshot(),cachedPartial,'Cached derived mission envelope remains read-only');
    const partialKey=`${partialIdentity}/${partialIdentity}`,
      partialCache=app.store.db.prepare('SELECT body FROM reply_cache WHERE key=?').get(partialKey),
      detached=structuredClone(partialResult);
    detached.operation={...detached.operation,parameters:{...detached.operation.parameters,issueAmount:
      detached.operation.parameters.issueAmount+1}};
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?')
      .run(Buffer.from(JSON.stringify(detached)).toString('base64'),partialKey);
    await reject(retry(partialIdentity),400);
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(partialCache.body,partialKey);
    const acquired = currencies.map(row=>row.currencyId===valis.currencyId ? {...row,amount:row.amount+10000,
      cumulativeAmount:row.cumulativeAmount+10000} : row);
    parse(await push({UserCurrency:acquired},[operation]));
    assert.deepEqual(app.store.operations(),[]);
    const {operation:hotOperation,operations:pendingOperations,...popup}=result,
      settledResult={...popup,operations:[]};
    assert.deepEqual(hotOperation,operation); assert.deepEqual(pendingOperations,[operation]);
    assert.ok(app.store.db.prepare('SELECT 1 FROM reply_cache WHERE key=?').get(partialKey),
      'Retain the older derived cache to prove permanent settled identity precedence');
    await close(); await open();
    const settledState=snapshot();
    assert.deepEqual(parse(await retry(identity)),settledResult,
      'Exact acknowledged retry keeps mandatory popup fields without redelivering operation6000');
    assert.deepEqual(parse(await retry(duplicateIdentity)),settledResult);
    assert.deepEqual(parse(await retry(partialIdentity)),settledResult);
    assert.equal(snapshot(),settledState,'Settled retry does not remint rewards or rewrite receipts');

    const settledCapture=app.store.db.prepare('SELECT * FROM achievement_pc_delivery WHERE operation_id=?').get(operation.id);
    app.store.db.prepare('UPDATE achievement_pc_delivery SET operation_json=? WHERE operation_id=?').run('{}',operation.id);
    await reject(retry(identity));
    app.store.db.prepare('UPDATE achievement_pc_delivery SET operation_json=? WHERE operation_id=?')
      .run(settledCapture.operation_json,operation.id);
    const wrongEnvelope={...operation,parameters:{...operation.parameters,issueAmount:operation.parameters.issueAmount+1}};
    app.store.db.prepare('UPDATE achievement_pc_delivery SET operation_json=? WHERE operation_id=?')
      .run(JSON.stringify(wrongEnvelope),operation.id);
    await reject(retry(identity));
    app.store.db.prepare('UPDATE achievement_pc_delivery SET operation_json=? WHERE operation_id=?')
      .run(settledCapture.operation_json,operation.id);
    app.store.db.prepare('INSERT INTO operation_queue(id,type,parameters,token,signature) VALUES(?,?,?,?,?)')
      .run(operation.id,operation.type,JSON.stringify(operation.parameters),operation.token,operation.signature);
    await reject(retry(identity));
    app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(operation.id);
    const lostClaim=app.store.db.prepare('SELECT * FROM achievement_claim WHERE operation_id=? ORDER BY achievement_id LIMIT 1')
      .get(operation.id);
    app.store.db.prepare('DELETE FROM achievement_claim WHERE achievement_id=? AND completed_at=?')
      .run(lostClaim.achievement_id,lostClaim.completed_at);
    await reject(retry(identity));
    app.store.db.prepare('INSERT INTO achievement_claim(achievement_id,completed_at,operation_id) VALUES(?,?,?)')
      .run(lostClaim.achievement_id,lostClaim.completed_at,lostClaim.operation_id);
    const receivedAchievements=app.store.read('UserAchievement').data,
      restoredAchievements=receivedAchievements.map(row=>body.achievementIds.some(id=>id.achievementId===row.achievementId)?
        {...row,state:3}:row);
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
      .run(JSON.stringify(restoredAchievements),md5(restoredAchievements),'UserAchievement');
    await reject(retry(identity));
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
      .run(JSON.stringify(receivedAchievements),md5(receivedAchievements),'UserAchievement');
    await reject(claim());
    await reject(send('achievement/complete',{achievementIds:[body.achievementIds[0]]}));
    await reject(send('achievement/complete',{achievementIds:[...body.achievementIds].reverse()}));
    app.store.db.exec('DELETE FROM reply_cache; DELETE FROM operation_done');
    app.store.beginSession(); await close(); await open();
    await reject(retry(identity)); await reject(retry(duplicateIdentity)); await reject(retry(partialIdentity));
    await reject(claim());
    await reject(send('achievement/complete',{achievementIds:[{...body.achievementIds[0],completedAt:now-1}]}),400);
    assert.equal(app.store.hardCurrency(),wallet+10,'Settled retries never credit Iris twice');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM achievement_claim').get().n,2);
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');

    // A new genuine claim must roll back queue, wallet and all captures if identity insertion fails.
    const next = {...rows[0],achievementId:6020000001};
    parse(await push({UserAchievement:[next]}));
    const nextBody = {achievementIds:[{achievementId:next.achievementId,completedAt:now}]};
    await reject(send('achievement/complete',{achievementIds:[...nextBody.achievementIds,body.achievementIds[0]]}));
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM achievement_request').get().n,3,
      'Cancelled fresh/subset/mixed retries never bind a new reward identity');
    for(const table of ['achievement_request','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_issue BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'issue rollback'); END`);
      const state = snapshot(); assert.equal((await send('achievement/complete',nextBody)).status,503);
      assert.equal(snapshot(),state); assert.equal(app.store.hardCurrency(),wallet+10);
      app.store.db.exec('DROP TRIGGER fail_issue');
    }
    const nextResult = parse(await send('achievement/complete',nextBody));
    assert.equal(app.store.hardCurrency(),wallet+20);
    assert.notEqual(nextResult.operation.id,operation.id);
    console.log('Mission request identity: actual-wire binding, cache/session eviction, pending/partial/settled retries, corruption and atomic rollback OK (no native acceptance)');
  } finally {
    await close(); Date.now = realNow;
    const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('danmemore-achievement-transport-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
