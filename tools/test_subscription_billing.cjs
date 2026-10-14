'use strict';

// DEFERRED: isolated desktop fixtures, NOT native SDK/enrollment/bonus proof.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createServer } = require('./danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const base = '/billing/v1.0/payment/subscription';

async function main() {
  const root = fs.mkdtempSync(path.join(process.cwd(),'.work','subscription-billing-test-'));
  const database = path.join(root,'profile.sqlite');
  let wall = 2000000000, app, port;
  const open = async (date = null, data = master) => {
    app = createServer({ database,seed,master:data,eventDate:date,
      wallNowSeconds:()=>wall,log:()=>{} });
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const send = (route,body,token) => new Promise((resolve,reject) => {
    const wire = body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body));
    const req = http.request({ host:'127.0.0.1',port,path:`${base}/${route}`,method:body === undefined ? 'GET' : 'POST',
      headers:{ 'Content-Type':'application/json','Content-Length':wire.length,
        ...(token ? { 'X-GREE-GAMELIB':encodeURIComponent(`authVersion=1&paymentApiToken=${token}`) } : {}) } }, res => {
      const chunks = []; res.on('data',chunk=>chunks.push(chunk));
      res.on('end',()=>resolve({ status:res.statusCode,body:Buffer.concat(chunks).toString() }));
    });
    req.on('error',reject); req.end(wire);
  });
  const read = async route => {
    const result = await send(route); assert.equal(result.status,200,result.body); return JSON.parse(result.body);
  };
  const orderBody = product => ({ product_id:product.product_id,country_code:product.country_code,
    currency_code:product.currency_code,translated_name:product.name,formatted_price:product.formatted_price,price:'0' });
  const commitBody = response => ({ purchase_id:response.entry.purchase_id,receipt:response.receipt,signature:response.signature });
  const orders = () => app.store.db.prepare('SELECT * FROM billing_subscription_order ORDER BY request_key').all();
  const nativeState = () => JSON.stringify({ profiles:app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),
    wallet:[app.store.hardCurrency(),app.store.paidCurrency()],operations:app.store.operations(),
    done:app.store.db.prepare('SELECT * FROM operation_done ORDER BY id').all(),
    runtime:app.store.db.prepare('SELECT * FROM runtime').all(),
    billing:app.store.db.prepare('SELECT * FROM billing_purchase').all() });
  try {
    await open('2022-01-31T00:00:00Z'); const originalState = nativeState();
    const listing = await read('productlist'), [tier1,tier2] = listing.entry.products;
    assert.equal(listing.result,'OK'); assert.equal(listing.entry.products.length,2);
    for (const [i,product] of listing.entry.products.entries()) {
      const id = 1301000001+i;
      assert.equal(product.name,master.subscriptions[id].name);
      assert.equal(product.product_id,master.subscriptions[id].productId);
      assert.equal(product.subscription_label,`tier${i+1}`); assert.equal(product.product_type,2);
      assert.equal(product.price,0); assert.equal(product.formatted_price,'Free (Offline)');
      assert.deepEqual([product.term,product.term_unit,product.free_term,product.free_term_unit],[1,'month',1,'month']);
      assert.match(product.description,/separate local gameplay packet/);
      assert.equal(product.thumbnail_url,'');
    }
    assert.deepEqual(await read('status'),{ result:'OK',entry:[] });
    assert.deepEqual((await read('history')).entry,{ offset:0,limit:100,has_next:false,subscriptions:[] });
    const oldBonus = app.store.read('UserSubscriptionBonus');
    for (const id of [1301000001,999]) {
      app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([{ userId:seed.userId,
        subscriptionId:id,purchaseStartAt:1643587200,expireAt:1646006400,lastReceivedAt:0,
        lastReceivedDay:0,dynamodbExpireAt:0 }]),'UserSubscriptionBonus');
      assert.equal((await send('status')).status,503,'Imported claims are not a local billing entitlement');
    }
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify(oldBonus.data),'UserSubscriptionBonus');
    assert.equal(nativeState(),originalState);
    const firstBody = orderBody(tier1);
    for (const bad of [{ ...firstBody,product_id:'unknown' },{ ...firstBody,price:'1' },
      { ...firstBody,price:null },{ ...firstBody,formatted_price:'$1' },{ ...firstBody,extra:0 }])
      assert.equal((await send('purchase',bad,'A'.repeat(32))).status,400);
    assert.equal((await send('purchase',firstBody)).status,400);
    assert.equal((await send('purchase',firstBody,'a'.repeat(32))).status,400);
    assert.equal(orders().length,0); assert.equal(nativeState(),originalState);

    app.store.db.exec("CREATE TRIGGER reject_subscription_order BEFORE INSERT ON billing_subscription_order BEGIN SELECT RAISE(ABORT,'order rollback'); END");
    assert.equal((await send('purchase',firstBody,'B'.repeat(32))).status,503);
    assert.equal(orders().length,0); assert.equal(nativeState(),originalState);
    app.store.db.exec('DROP TRIGGER reject_subscription_order');
    const first = await send('purchase',firstBody,'C'.repeat(32)); assert.equal(first.status,200);
    const firstOrder = JSON.parse(first.body), firstCommit = commitBody(firstOrder);
    assert.equal(JSON.parse(firstOrder.receipt).source,'danmemore-local');
    assert.equal(JSON.parse(firstOrder.receipt).price,0);
    assert.deepEqual(await send('purchase',firstBody,'C'.repeat(32)),first);
    assert.equal((await send('purchase',{ ...firstBody,price:0 },'C'.repeat(32))).status,400,
      'Body-hash identity uses actual bytes, not normalized JSON values');
    assert.equal(orders().length,1); assert.equal(orders()[0].committed_at,null);
    assert.deepEqual((await read('status')).entry,[],'Preparing an order cannot activate membership');
    assert.equal((await read('history')).entry.subscriptions.length,0);
    assert.equal(nativeState(),originalState,'Billing is not a native reward precredit');

    const alternative = await send('purchase',firstBody,'D'.repeat(32)); assert.equal(alternative.status,200);
    const second = await send('purchase',{ ...orderBody(tier2),price:'0.0' },'E'.repeat(32)); assert.equal(second.status,200);
    const secondCommit = commitBody(JSON.parse(second.body));
    const beforeCommits = JSON.stringify(orders());
    for (const bad of [{ ...firstCommit,receipt:secondCommit.receipt },{ ...firstCommit,signature:secondCommit.signature },
      { ...firstCommit,signature:'0'.repeat(64) },{ ...firstCommit,receipt:'publisher receipt' },
      { ...firstCommit,purchase_id:'danmemore-sub-'+ 'f'.repeat(24) },{ ...firstCommit,extra:0 }])
      assert.equal((await send('purchase/commit',bad)).status,400);
    assert.equal(JSON.stringify(orders()),beforeCommits);
    app.store.db.exec("CREATE TRIGGER reject_subscription_commit BEFORE UPDATE OF committed_at ON billing_subscription_order BEGIN SELECT RAISE(ABORT,'commit rollback'); END");
    assert.equal((await send('purchase/commit',firstCommit)).status,503);
    assert.equal(JSON.stringify(orders()),beforeCommits); assert.deepEqual((await read('status')).entry,[]);
    app.store.db.exec('DROP TRIGGER reject_subscription_commit');
    const activated = await send('purchase/commit',firstCommit); assert.equal(activated.status,200);
    assert.deepEqual(JSON.parse(activated.body),{ result:'OK' });
    assert.equal((await send('purchase/commit',commitBody(JSON.parse(alternative.body)))).status,400,
      'A second prepared order cannot overlap an active term');
    assert.equal((await send('purchase/commit',secondCommit)).status,200);
    const active = (await read('status')).entry;
    assert.deepEqual(active.map(row=>row.subscription_label),['tier1','tier2']);
    for (const row of active) {
      assert.deepEqual(Object.keys(row).sort(),['subscription_label','start_datetime','end_datetime','auto_renew','status',
        'provider','term_type','grace_period_type','count_purchase'].sort());
      assert.equal(row.start_datetime,'2022-01-31T00:00:00Z');
      assert.equal(row.end_datetime,'2022-02-28T00:00:00Z','Calendar-month last-day clamping');
      assert.deepEqual([row.status,row.auto_renew,row.provider,row.term_type,row.grace_period_type,row.count_purchase],
        [0,1,'offline',1,0,1]);
    }
    const history = (await read('history?offset=0&limit=1')).entry;
    assert.equal(history.has_next,true); assert.equal(history.subscriptions.length,1);
    assert.deepEqual(Object.keys(history.subscriptions[0]).sort(),
      ['subscription_label','provider','notification_type','notification_datetime'].sort());
    assert.equal(history.subscriptions[0].notification_type,'offline_activation');
    assert.equal((await read('history?offset=1&limit=1')).entry.has_next,false);
    assert.equal((await read('history?offset=2&limit=1')).entry.subscriptions.length,0);
    for (const query of ['limit=-1','limit=1001','limit=1.5','offset=-1','offset=NaN'])
      assert.equal((await send(`history?${query}`)).status,400);
    assert.equal((await send('purchase',firstBody,'F'.repeat(32))).status,400);
    assert.equal(nativeState(),originalState);

    await close(); await open();
    assert.deepEqual((await read('status')).entry,active,'Periods persist on restart');
    assert.deepEqual(await send('purchase/commit',firstCommit),activated);
    assert.deepEqual(await send('purchase',firstBody,'C'.repeat(32)),first);
    wall += 28*86400;
    assert.ok((await read('status')).entry.every(row=>row.status===1),'End boundary is exclusive');
    assert.equal((await read('history')).entry.subscriptions.length,2,'Expiration does not auto-renew');
    assert.deepEqual(await send('purchase/commit',firstCommit),activated,'Old commit does not extend expired term');
    const renewal = await send('purchase',firstBody,'1'.repeat(32)); assert.equal(renewal.status,200);
    assert.equal((await send('purchase/commit',commitBody(JSON.parse(renewal.body)))).status,200);
    const renewed = (await read('status')).entry.find(row=>row.subscription_label==='tier1');
    assert.equal(renewed.term_type,0); assert.equal(renewed.count_purchase,2); assert.equal(renewed.status,0);
    assert.equal(renewed.end_datetime,'2022-03-28T00:00:00Z');
    assert.equal((await read('history')).entry.subscriptions[0].notification_type,'offline_renewal');
    const stale = await send('purchase',orderBody(tier2),'2'.repeat(32)); assert.equal(stale.status,200);
    wall += 86400;
    assert.equal((await send('purchase/commit',commitBody(JSON.parse(stale.body)))).status,400,'Uncommitted orders expire after one local day');
    assert.equal(nativeState(),originalState);

    await close(); await open('2022-01-31T00:00:00Z');
    assert.equal((await read('status')).entry.find(row=>row.subscription_label==='tier1').status,1,
      'A clock rewind does not resurrect an older period or reset permanent purchase count');
    assert.equal((await send('purchase',firstBody,'3'.repeat(32))).status,400);
    assert.equal((await send('purchase/commit',commitBody(JSON.parse(stale.body)))).status,400);
    await close(); await open('2019-10-20T00:00:00Z');
    assert.deepEqual((await read('productlist')).entry.products,[],'Original release window gates enrollment');
    assert.ok((await read('status')).entry.every(row=>row.status===1));
    assert.deepEqual(await send('purchase',firstBody,'C'.repeat(32)),first,'An old order retry is read-only, not new enrollment');
    assert.equal((await send('purchase',firstBody,'4'.repeat(32))).status,400);
    assert.equal((await read('history')).entry.subscriptions.length,3);

    const saved = orders().find(row=>row.purchase_count===2);
    app.store.db.prepare('UPDATE billing_subscription_order SET response=? WHERE purchase_id=?').run('{"result":"OK"}',saved.purchase_id);
    assert.equal((await send('status')).status,503,'Missing/corrupt local order evidence cannot become entitlement');
    assert.equal((await send('history')).status,503);
    assert.equal((await send('purchase',firstBody,'1'.repeat(32))).status,503);
    app.store.db.prepare('UPDATE billing_subscription_order SET response=? WHERE purchase_id=?').run(saved.response,saved.purchase_id);
    await close(); await open(null,{ ...master,subscriptionDisplays:{} });
    assert.equal((await send('productlist')).status,503); assert.equal((await send('status')).status,503);
    await close(); await open();
    assert.equal(app.store.db.prepare('PRAGMA quick_check').get().quick_check,'ok');
    console.log('Subscription billing fixture checks completed; native enrollment and bonus delivery remain unverified');
  } finally {
    await close();
    const resolved = path.resolve(root), expected = path.resolve(process.cwd(),'.work');
    assert.equal(path.dirname(resolved),expected); assert.ok(path.basename(resolved).startsWith('subscription-billing-test-'));
    fs.rmSync(resolved,{ recursive:true,force:true });
  }
}
if (require.main === module) main().catch(error=>{ console.error(error);process.exitCode=1; });
