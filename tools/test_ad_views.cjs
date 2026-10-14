'use strict';

// DEFERRED synthetic protocol/save fixtures. NOT ad SDK/native acceptance.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer,OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = value => crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
const scratchId = 614000001, stepId = 615000001, epoch = 1686794400;
const block = at => Math.floor((at+32400)/21600);
const nextBlock = at => (block(at)+1)*21600-32400;
const day = at => Math.floor((at+32400)/86400);
const nextDay = at => (day(at)+1)*86400-32400;
const initial = (extra = {}) => ({ userId:0,adScratchId:scratchId,ticketAmount:0,currentStepId:stepId,loopCount:0,...extra });
const advertisement = (remainingCount,lastUpdateAt,extra = {}) =>
  ({ userId:seed.userId,advertisementType:2,remainingCount,lastUpdateAt,...extra });

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-ad-views-'));
  let app, port, database, sequence = 0, now = epoch, source=master;
  const open = async () => {
    app = createServer({ database,seed,master:source,wallNowSeconds:() => now,log:() => {} });
    await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const put = (name,rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const fresh = async (name,catalog=master) => {
    await close(); now = epoch; source=catalog; database = path.join(directory,`${name}.sqlite`); await open();
    for (const name of ['UserAdScratch','UserAdScratchContent','UserAdvertisement']) put(name,[]);
  };
  const send = (action,value) => request(port,++sequence,value,String(sequence),action);
  const view = (type=2) => send('ad/view/complete',{ type });
  const parse = response => { assert.equal(response.status,200,response.body.toString()); return JSON.parse(response.body); };
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const reject = async (pending,status,unavailable = false,before = snapshot()) => {
    const response = await pending; assert.equal(response.status,status,response.body.toString()); assert.equal(snapshot(),before);
    if (unavailable) assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const push = (putItems = {},operations = [],deleteItems = {}) => send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{ before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name => [name,md5(putItems[name] ?? [])])) },
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature:0,trigger:'ViewAdMovie',putItems,deleteItems }] : [],
    operations:operations.map(row => ({ id:row.id,verifier:row.token })),
  });
  const adsWith = ad => {
    const rows=app.store.read('UserAdvertisement').data.map(row=>row.advertisementType===ad.advertisementType ? ad : row);
    if(!rows.some(row=>row.advertisementType===ad.advertisementType)) rows.push(ad);
    return rows;
  };
  const saved = operation => {
    const receipt=app.store.adViewReceipt(operation);
    return { ...(receipt.advertisement_type===2 ? {UserAdScratch:[operation.parameters.UserAdScratch]} : {}),
      UserAdvertisement:adsWith(receipt.afterAd) };
  };
  const ack = async operation => parse(await push(saved(operation),[operation]));
  try {
    await fresh('initial-split-replay');
    const wallet = app.store.hardCurrency(), before = ['UserAdScratch','UserAdScratchContent','UserAdvertisement']
      .map(name => app.store.read(name));
    const first = await view(), identity = sequence, result = parse(first), operation = result.operations[0];
    assert.equal(operation.type,26000); assert.deepEqual(result.operation,operation);
    assert.deepEqual(operation.parameters,{ UserAdScratch:initial({ ticketAmount:1 }),UserAdScratchContent:[] });
    assert.equal(app.store.hardCurrency(),wallet);
    assert.deepEqual(['UserAdScratch','UserAdScratchContent','UserAdvertisement'].map(name => app.store.read(name)),before);
    await reject(push({},[operation]),400);
    // Original lazy creation and full allowance can save BEFORE the effect.
    parse(await push({ UserAdScratch:[initial()],UserAdvertisement:[advertisement(4,now)] }));
    await reject(push({},[operation]),400);
    parse(await push({ UserAdScratch:[operation.parameters.UserAdScratch] }));
    await close(); await open(); await reject(push({},[operation]),400);
    assert.deepEqual(parse(await view()).operations,[operation]);
    assert.deepEqual((await request(port,identity,{ type:2 },String(identity),'ad/view/complete')).body,first.body);
    await reject(send('ad/scratch/draw',{ adScratchId:scratchId,position:0,advertisementType:2 }),503,true);
    const ad = app.store.adViewReceipt(operation).afterAd;
    parse(await push({ UserAdvertisement:[ad] })); await close(); await open();
    parse(await push({},[operation])); assert.equal(app.store.operations().length,0);
    assert.equal(app.store.read('UserAdScratch').data[0].ticketAmount,1);
    assert.equal(app.store.read('UserAdvertisement').data[0].remainingCount,3);
    assert.deepEqual(parse(await request(port,identity,{ type:2 },String(identity),'ad/view/complete')),
      {code:0,operations:[]},'Acknowledged scratch-ticket callback replays without restoring the spent view or ticket');
    app.store.db.prepare('DELETE FROM reply_cache').run(); app.store.beginSession(); await close(); await open();
    assert.deepEqual(parse(await request(port,identity,{ type:2 },String(identity),'ad/view/complete')),{code:0,operations:[]});
    await reject(request(port,identity,{ type:1 },String(identity),'ad/view/complete'),400);
    await reject(push({ UserAdScratch:[initial()] }),400);
    await reject(push({ UserAdvertisement:[advertisement(4,now)] }),400);
    await reject(push({},[],{ UserAdvertisement:[{ advertisementType:2 }] }),400);

    await fresh('native-limits');
    for (let count = 1; count <= 4; count++) {
      const operation = parse(await view()).operations[0];
      assert.equal(operation.parameters.UserAdScratch.ticketAmount,count);
      assert.equal(app.store.adViewReceipt(operation).afterAd.remainingCount,4-count); await ack(operation);
    }
    await reject(view(),400);
    const boundary = nextBlock(now); now = boundary-1; await reject(view(),400);
    now = boundary; const next = parse(await view()).operations[0];
    assert.equal(app.store.adViewReceipt(next).afterAd.remainingCount,0); await ack(next);
    assert.equal(app.store.read('UserAdScratch').data[0].ticketAmount,5); await reject(view(),400);
    now = boundary-1; await reject(view(),503,true); now = boundary+21600*20;
    const capped = parse(await view()).operations[0]; assert.equal(app.store.adViewReceipt(capped).afterAd.remainingCount,3); await ack(capped);
    assert.equal(app.store.read('UserAdScratch').data[0].ticketAmount,6);
    await reject(push({ UserAdvertisement:[advertisement(4,now)] }),400);
    now = nextBlock(now);
    // Native calendar-only refresh earns viewing allowance, NOT a scratch ticket.
    parse(await push({ UserAdvertisement:[advertisement(4,now)] }));
    assert.equal(app.store.read('UserAdScratch').data[0].ticketAmount,6);
    await ack(parse(await view()).operations[0]);

    await fresh('late-cold-effect'); const late = parse(await view()).operations[0];
    now = nextBlock(now)+21600; await close(); await open();
    assert.deepEqual(parse(await send('user_data/confirm',null)).operations,[late]);
    // 26000 itself refreshes at application time. This is not the original
    // issue-time afterAd timestamp, but one valid native consumed projection.
    parse(await push({ UserAdvertisement:[advertisement(4,now)] }));
    await reject(push({ UserAdScratch:[late.parameters.UserAdScratch] },[late]),400);
    parse(await push({ UserAdScratch:[late.parameters.UserAdScratch] }));
    parse(await push({ UserAdvertisement:[advertisement(3,now)] },[late]));
    await close(); await open(); assert.equal(app.store.operations().length,0);
    assert.equal(app.store.read('UserAdScratch').data[0].ticketAmount,1);
    await ack(parse(await view()).operations[0]); assert.equal(app.store.read('UserAdScratch').data[0].ticketAmount,2);

    await fresh('draw-interleaving'); await ack(parse(await view()).operations[0]);
    const originalRandom = crypto.randomInt; crypto.randomInt = (min,max) => max === undefined && min === 6 ? 5 : originalRandom(min,max);
    let draw;
    try { draw = parse(await send('ad/scratch/draw',{ adScratchId:scratchId,position:0,advertisementType:2 })).operations[0]; }
    finally { crypto.randomInt = originalRandom; }
    assert.equal(draw.type,26100); assert.equal(draw.parameters.reset,true); await reject(view(),503,true);
    parse(await push({ UserAdScratch:[draw.parameters.UserAdScratch],UserAdScratchContent:draw.parameters.UserAdScratchContent },[draw]));
    const more = parse(await view()).operations[0]; assert.equal(more.parameters.UserAdScratch.loopCount,1); await ack(more);
    assert.equal(app.store.read('UserAdScratchContent').data.length,1);
    assert.equal(app.store.read('UserAdScratch').data[0].ticketAmount,1);

    await fresh('validation');
    for (const input of [null,{}, { type:0 },{ type:3 },{ type:'2' },{ type:2,extra:1 }])
      await reject(send('ad/view/complete',input),400);
    for (const extra of [{ userId:0 },{ userId:9 },{ advertisementType:3 },{ remainingCount:5 },{ remainingCount:-1 },{ lastUpdateAt:-1 }]) {
      put('UserAdvertisement',[advertisement(4,now,extra)]); await reject(view(),400);
    }
    put('UserAdvertisement',[advertisement(4,now+100)]); await reject(view(),503,true);
    put('UserAdvertisement',[advertisement(4,now),advertisement(4,now)]); await reject(view(),400); put('UserAdvertisement',[]);
    put('UserAdScratch',[initial({ ticketAmount:0x7fffffff })]); await reject(view(),400); put('UserAdScratch',[]);
    now = master.adScratches[scratchId].startAt-1; await reject(view(),503,true); now = epoch;
    const valid = parse(await view()).operations[0];
    for (const extra of [{ userId:0 },{ userId:9 },{ advertisementType:3 },{ remainingCount:5 },{ remainingCount:-1 },{ lastUpdateAt:-1 }])
      await reject(push({ UserAdvertisement:[advertisement(3,now,extra)] }),400);
    await reject(push({ UserAdvertisement:[advertisement(3,now),advertisement(3,now)] }),400);
    await reject(push({},[],{ UserAdvertisement:[{ userId:seed.userId }] }),400);
    await reject(push({ UserAdScratch:[initial({ ticketAmount:2 })] }),400);
    await reject(push({ UserAdScratch:[valid.parameters.UserAdScratch] },[valid]),400);

    await fresh('missing-history'); const history = await view(), historyId = sequence, pending = parse(history).operations[0];
    const receipt = app.store.db.prepare('SELECT * FROM ad_view_claim').get();
    app.store.db.prepare('DELETE FROM ad_view_claim').run(); await close(); await open();
    await reject(view(),503,true); await reject(send('user_data/confirm',null),503,true); await reject(push({},[pending]),503,true);
    await reject(request(port,historyId,{ type:2 },String(historyId),'ad/view/complete'),503,true);
    app.store.db.prepare(`INSERT INTO ad_view_claim(operation_id,advertisement_type,scratch_id,ad_before_json,ad_after_json,
      scratch_before_json,scratch_after_json,contents_json,parameters,issued_at,iris_amount,effect_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(...Object.values(receipt));
    app.store.db.prepare("UPDATE ad_view_claim SET scratch_after_json='{}'").run(); await reject(view(),503,true);
    app.store.db.prepare('UPDATE ad_view_claim SET scratch_after_json=?').run(receipt.scratch_after_json);
    app.store.db.prepare('UPDATE ad_view_state SET remaining=4').run(); await reject(view(),503,true);
    app.store.db.prepare('UPDATE ad_view_state SET remaining=3').run(); now = master.adScratches[scratchId].startAt-1;
    assert.deepEqual(parse(await view()).operations,[pending]); now = epoch;

    await fresh('rollback');
    for (const table of ['operation_queue','ad_view_state','ad_view_claim','ad_view_request','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_view BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'ad issue rollback'); END`);
      await reject(view(),503); app.store.db.exec('DROP TRIGGER fail_view');
    }
    put('UserAdScratch',[initial({ ticketAmount:2 })]);
    app.store.db.exec("CREATE TRIGGER fail_view BEFORE INSERT ON ad_scratch_state BEGIN SELECT RAISE(ABORT,'ad baseline rollback'); END");
    await reject(view(),503); app.store.db.exec('DROP TRIGGER fail_view'); put('UserAdScratch',[]);
    const issued = parse(await view()).operations[0], data = saved(issued);
    for (const [table,event] of [['profile','UPDATE'],['ad_scratch_state','INSERT'],['ad_view_state','UPDATE'],['ad_view_claim','UPDATE'],
      ['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_view BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'ad save rollback'); END`);
      await reject(push(data,[issued]),503); app.store.db.exec('DROP TRIGGER fail_view');
    }
    parse(await push(data,[issued]));

    await fresh('daily-iris');
    const startWallet=app.store.hardCurrency(),paid=app.store.paidCurrency(),untouched=['UserAdScratch','UserAdScratchContent','UserAdvertisement']
      .map(name=>app.store.read(name));
    const irisResponse=await view(1),irisIdentity=sequence,irisResult=parse(irisResponse),iris=irisResult.operation;
    assert.equal(irisResult.issueAmount,10);assert.deepEqual(irisResult.operations,[iris]);
    assert.equal(iris.type,26000);assert.deepEqual(iris.parameters,{});
    assert.equal(app.store.hardCurrency(),startWallet+10);assert.equal(app.store.paidCurrency(),paid);
    assert.deepEqual(['UserAdScratch','UserAdScratchContent','UserAdvertisement'].map(name=>app.store.read(name)),untouched);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM ad_scratch_state').get().n,0);
    const irisReceipt=app.store.adViewReceipt(iris);
    assert.equal(irisReceipt.advertisement_type,1);assert.equal(irisReceipt.iris_amount,10);
    assert.equal(irisReceipt.afterAd.remainingCount,0);assert.equal(irisReceipt.scratch_id,0);
    await reject(push({},[iris]),400);
    parse(await push({UserAdvertisement:[advertisement(1,now,{advertisementType:1})]}));
    await reject(push({},[iris]),400);
    assert.deepEqual(parse(await view(1)).operations,[iris]);assert.equal(app.store.hardCurrency(),startWallet+10);
    assert.deepEqual((await request(port,irisIdentity,{type:1},String(irisIdentity),'ad/view/complete')).body,irisResponse.body);
    await reject(view(),503,true); // A different type cannot alias this Iris operation.
    await close();await open();assert.deepEqual(parse(await send('user_data/confirm',null)).operations,[iris]);
    const split=parse(await push(saved(iris)));assert.deepEqual(split.operations,[]);
    assert.ok(app.store.db.prepare('SELECT effect_json FROM ad_view_claim WHERE operation_id=?').get(iris.id).effect_json);
    await reject(push({UserAdvertisement:[advertisement(1,now,{advertisementType:1})]}),400);
    await close();await open();
    for(const action of ['user/login','user_data/confirm']) await reject(send(action,null),503,true);
    await reject(send('user_data/pull',{tables:['UserAdvertisement'],consistentRead:true}),503,true);
    await reject(view(1),503,true);
    await reject(request(port,irisIdentity,{type:1},String(irisIdentity),'ad/view/complete'),503,true);
    parse(await push({},[iris]));assert.equal(app.store.operations().length,0);
    assert.equal(app.store.hardCurrency(),startWallet+10);await reject(view(1),400);
    const midnight=nextDay(now);now=midnight-1;await reject(view(1),400);now=midnight;
    const tomorrow=parse(await view(1)).operation;await ack(tomorrow);
    assert.equal(app.store.hardCurrency(),startWallet+20);await reject(view(1),400);
    now=midnight-1;await reject(view(1),503,true);now=midnight+86400*20;
    const afterGap=parse(await view(1)).operation;assert.equal(app.store.adViewReceipt(afterGap).afterAd.remainingCount,0);
    await ack(afterGap);assert.equal(app.store.hardCurrency(),startWallet+30);await reject(view(1),400);
    app.store.db.prepare('DELETE FROM reply_cache').run();app.store.beginSession();await close();await open();
    assert.deepEqual(parse(await request(port,irisIdentity,{type:1},String(irisIdentity),'ad/view/complete')),
      {code:0,operations:[]},'Acknowledged daily-Iris callback replays without a second wallet credit');
    assert.equal(app.store.hardCurrency(),startWallet+30);
    now=nextDay(now);parse(await push({UserAdvertisement:adsWith(advertisement(1,now,{advertisementType:1}))}));
    assert.equal(app.store.hardCurrency(),startWallet+30); // Calendar-only refresh never grants Iris.
    await ack(parse(await view(1)).operation);assert.equal(app.store.hardCurrency(),startWallet+40);
    const scratch=parse(await view()).operation;await reject(view(1),503,true);await ack(scratch);
    assert.equal(app.store.read('UserAdvertisement').data.length,2);assert.equal(app.store.hardCurrency(),startWallet+40);
    // Counter-first scratch save must not deliver26000 a second time while the ticket is still missing.
    const counterFirst=parse(await view()).operation,consumed=app.store.adViewReceipt(counterFirst).afterAd;
    assert.deepEqual(parse(await push({UserAdvertisement:adsWith(consumed)})).operations,[]);
    await close();await open();await reject(send('user_data/confirm',null),503,true);
    await reject(push({},[counterFirst]),400);parse(await push(saved(counterFirst),[counterFirst]));

    await fresh('daily-late-application');const lateIris=parse(await view(1)).operation;
    now=nextDay(now)+86400;await close();await open();
    parse(await push({UserAdvertisement:[advertisement(1,now,{advertisementType:1})]}));
    assert.deepEqual(parse(await send('user_data/confirm',null)).operations,[lateIris]);
    const lateSave=advertisement(0,now,{advertisementType:1});parse(await push({UserAdvertisement:[lateSave]}));
    now=nextDay(now);
    // Once observed, the next-day count1 is a calendar refresh, not permission to replay the old debit.
    const dailyRefresh=advertisement(1,now,{advertisementType:1});parse(await push({UserAdvertisement:[dailyRefresh]}));
    await close();await open();await reject(view(1),503,true);parse(await push({},[lateIris]));
    assert.equal(app.store.hardCurrency(),10);await ack(parse(await view(1)).operation);assert.equal(app.store.hardCurrency(),20);

    await fresh('daily-missing-evidence',{...master,advertisementIrisReward:undefined});await reject(view(1),503,true);
    await fresh('daily-changed-amount',{...master,advertisementIrisReward:{...master.advertisementIrisReward,amount:11}});
    await reject(view(1),503,true);
    await fresh('daily-corrupt-receipt');const corrupt=parse(await view(1)).operation;
    for(const [column,value] of [['iris_amount',11],['scratch_id',scratchId],['effect_json','{}'],['effect_json','null'],
      ['effect_json','false'],['effect_json','0'],['scratch_after_json','{}']]) {
      const previous=app.store.db.prepare(`SELECT ${column} value FROM ad_view_claim`).get().value;
      app.store.db.prepare(`UPDATE ad_view_claim SET ${column}=?`).run(value);
      await reject(view(1),503,true);await reject(send('user_data/confirm',null),503,true);await reject(push({},[corrupt]),503,true);
      app.store.db.prepare(`UPDATE ad_view_claim SET ${column}=?`).run(previous);
    }
    parse(await push(saved(corrupt),[corrupt]));
    await fresh('daily-wallet-overflow');app.store.db.prepare('UPDATE hard_currency SET free_amount=999999990').run();
    await reject(view(1),400);
    await fresh('daily-rollback');
    for(const [table,event] of [['hard_currency','UPDATE'],['operation_queue','INSERT'],['ad_view_state','INSERT'],
      ['ad_view_claim','INSERT'],['ad_view_request','INSERT'],['runtime','UPDATE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_view BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'Iris view rollback'); END`);
      await reject(view(1),503);app.store.db.exec('DROP TRIGGER fail_view');
    }
    const rollbackIris=parse(await view(1)).operation,rollbackSave=saved(rollbackIris);
    for(const [table,event] of [['profile','UPDATE'],['ad_view_claim','UPDATE'],['ad_view_state','UPDATE'],
      ['operation_done','INSERT'],['operation_queue','DELETE'],['runtime','UPDATE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_view BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'Iris ACK rollback'); END`);
      await reject(push(rollbackSave,[rollbackIris]),503);app.store.db.exec('DROP TRIGGER fail_view');
    }
    await ack(rollbackIris);assert.equal(app.store.hardCurrency(),10);
    await fresh('daily-settled-replay');
    const settledRequest=await view(1),settledIdentity=sequence,settled=parse(settledRequest).operation;
    await ack(settled);assert.deepEqual(parse(await request(port,settledIdentity,{type:1},String(settledIdentity),'ad/view/complete')),
      {code:0,operations:[]});assert.equal(app.store.hardCurrency(),10);
    const claim=app.store.db.prepare('SELECT operation_json,iris_history_id FROM ad_view_claim WHERE operation_id=?').get(settled.id),
      journal=app.store.db.prepare('SELECT reason FROM iris_transaction WHERE id=?').get(claim.iris_history_id);
    for(const [damage,restore] of [
      [() => app.store.db.prepare("UPDATE ad_view_claim SET operation_json='{}' WHERE operation_id=?").run(settled.id),
        () => app.store.db.prepare('UPDATE ad_view_claim SET operation_json=? WHERE operation_id=?').run(claim.operation_json,settled.id)],
      [() => app.store.db.prepare('UPDATE ad_view_claim SET iris_history_id=NULL WHERE operation_id=?').run(settled.id),
        () => app.store.db.prepare('UPDATE ad_view_claim SET iris_history_id=? WHERE operation_id=?').run(claim.iris_history_id,settled.id)],
      [() => app.store.db.prepare("UPDATE iris_transaction SET reason='damaged' WHERE id=?").run(claim.iris_history_id),
        () => app.store.db.prepare('UPDATE iris_transaction SET reason=? WHERE id=?').run(journal.reason,claim.iris_history_id)],
      [() => app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(settled.id),
        () => app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(settled.id)],
      [() => app.store.db.prepare('INSERT INTO operation_queue(id,type,parameters,token,signature) VALUES(?,?,?,?,?)')
        .run(settled.id,settled.type,JSON.stringify(settled.parameters),settled.token,settled.signature),
        () => app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(settled.id)],
    ]) {
      damage();const damaged=snapshot();
      await reject(request(port,settledIdentity,{type:1},String(settledIdentity),'ad/view/complete'),503,true,damaged);
      restore();assert.deepEqual(parse(await request(port,settledIdentity,{type:1},String(settledIdentity),'ad/view/complete')),
        {code:0,operations:[]});
    }
    assert.equal(app.store.hardCurrency(),10);
    console.log('Daily Iris10/scratch-ad entitlement, native allowance, observed replay, clock and rollback: OK (synthetic only)');
  } finally { await close(); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
