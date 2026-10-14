'use strict';

// DEFERRED: desktop fixtures only, not native WebView or gameplay acceptance.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE }=require('./danmemore_server.cjs');
const { request }=require('./test_danmemore_server.cjs');
const { subscriptionDetails }=require('./gacha_details.cjs');
const seed=require('../data/danmemore-seed.json');
const master=require('../data/danmemore-master.json');

async function main() {
  const root=fs.mkdtempSync(path.join(process.cwd(),'.work','subscription-details-test-'));
  const database=path.join(root,'profile.sqlite');
  let wall=2000000000,app;
  const create=(data=master,date='2024-06-20T12:00:00Z')=>createServer({ database,seed,master:data,
    eventDate:date,wallNowSeconds:()=>wall,log:()=>{} });
  const start=async()=>{ await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));return app.server.address().port; };
  const state=()=>JSON.stringify({ profiles:app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),
    wallet:[app.store.hardCurrency(),app.store.paidCurrency()],operations:app.store.operations(),
    billing:app.store.db.prepare('SELECT * FROM billing_purchase ORDER BY request_key').all(),
    memberships:app.store.db.prepare('SELECT * FROM billing_subscription_order ORDER BY request_key').all(),
    done:app.store.db.prepare('SELECT * FROM operation_done ORDER BY id').all() });
  const action='notice/subscription/get';
  try {
    app=create(); let port=await start(),before=state();
    for (const [sequence,id] of [[0,1301000001],[1,1301000002]]) {
      const first=await request(port,sequence,{ subscriptionId:id },'700',action);
      assert.equal(first.status,200);
      const response=JSON.parse(first.body);
      assert.deepEqual(Object.keys(response).sort(),['code','result']);
      assert.equal(response.code,0);
      assert.match(response.result,new RegExp(`data-subscription-id="${id}"`));
      assert.ok(response.result.includes(master.subscriptions[id].name.replaceAll("'",'&#39;')));
      assert.match(response.result,/Offline membership service — native acceptance pending/);
      assert.match(response.result,/native enrollment is not yet verified/);
      assert.match(response.result,/Daily\/monthly bonus delivery is implemented in server source/);
      assert.match(response.result,/not a live Apple, Google or publisher subscription/);
      assert.match(response.result,/No trial, renewal or reward is created/);
      assert.ok(!/<(?:script|iframe|img)\b|\b(?:src|href)=/i.test(response.result));
      assert.ok(!/undefined|NaN/.test(response.result));
      for (const item of [...master.subscriptions[id].bonusItems,...master.subscriptions[id].extendBonusItems])
        assert.match(response.result,new RegExp(`data-reward-id="${item.id}"`));
      const replay=await request(port,sequence,{ subscriptionId:id },'700',action);
      assert.equal(replay.status,200); assert.deepEqual(replay.body,first.body);
      assert.equal(state(),before,'Details and retries do not grant inventory, flags, membership, wallet or operations');
    }
    const first=await request(port,2,{ subscriptionId:1301000001 },'701',action);
    wall+=3600;
    assert.deepEqual((await request(port,2,{ subscriptionId:1301000001 },'701',action)).body,first.body);
    const reopened=await request(port,3,{ subscriptionId:1301000001 },'701',action);
    assert.equal(reopened.status,200); assert.notDeepEqual(reopened.body,first.body);
    assert.equal(state(),before);
    const fullState=()=>JSON.stringify({ game:state(),sequence:String(app.store.lastSequence()),
      cache:app.store.db.prepare('SELECT * FROM reply_cache ORDER BY key').all() });
    const cachedNotice=app.store.db.prepare('SELECT body FROM reply_cache WHERE key=?').get('700/0'),
      altered=JSON.parse(Buffer.from(cachedNotice.body,'base64'));
    altered.result=altered.result.replace('<h1>Syr&#39;s Daily Lunch Box Set</h1>','<h1>Altered details</h1>');
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?')
      .run(Buffer.from(JSON.stringify(altered)).toString('base64'),'700/0');
    const alteredState=fullState();
    assert.equal((await request(port,0,{subscriptionId:1301000001},'700',action)).status,503,
      'A cached page with only a surviving plan marker is not a valid historical snapshot');
    assert.equal(fullState(),alteredState,'Damaged subscription details remain unavailable without mutating gameplay');
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(cachedNotice.body,'700/0');
    for (const value of [undefined,{},[],{ subscriptionId:0 },{ subscriptionId:-1 },{ subscriptionId:'1301000001' },
      { subscriptionId:1.5 },{ subscriptionId:999 },{ subscriptionId:1301000001,extra:true }]) {
      const snapshot=fullState();
      assert.equal((await request(port,4,value,'702',action)).status,400);
      assert.equal(fullState(),snapshot,'Rejected details preserve sequence, cache and gameplay');
    }
    // A caller-supplied matching hash must not cross-plan replay a cached page.
    const cache=app.store.db.prepare('SELECT body_hash FROM reply_cache WHERE key=?').get('700/0');
    const snapshot=fullState();
    const conflict=await request(port,0,{ subscriptionId:1301000002 },'700',action,
      { 'X-ARGO-REQUEST-BODY-HASH':cache.body_hash });
    assert.equal(conflict.status,503); assert.equal(JSON.parse(conflict.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(fullState(),snapshot);
    app.store.db.exec(`CREATE TRIGGER fail_subscription_notice BEFORE INSERT ON reply_cache
      BEGIN SELECT RAISE(ABORT,'subscription notice reply rollback'); END;`);
    const failed=await request(port,4,{ subscriptionId:1301000001 },'703',action);
    assert.equal(failed.status,503);assert.equal(failed.body.length,0);
    assert.equal(fullState(),snapshot,'Reply failure rolls back sequence and preserves profiles');
    app.store.db.exec('DROP TRIGGER fail_subscription_notice');
    await app.close(); app=null;
    app=create();port=await start();before=state();
    assert.deepEqual((await request(port,2,{ subscriptionId:1301000001 },'701',action)).body,first.body);
    assert.equal(state(),before,'Restart replays the original page, not an entitlement');
    await app.close();app=null;
    app=create(master,'2019-10-18T12:00:00Z');port=await start();before=state();
    const archived=await request(port,4,{ subscriptionId:1301000002 },'704',action);
    assert.equal(archived.status,200,'Original details remain read-only outside their catalog date');
    assert.match(JSON.parse(archived.body).result,/2019-10-18/);assert.equal(state(),before);
    await app.close();app=null;
    const incomplete={ ...master,subscriptions:{ ...master.subscriptions,
      1301000001:{ ...master.subscriptions[1301000001],bonusItems:[] } } };
    app=create(incomplete,'2019-10-18T12:00:00Z');port=await start();before=state();
    const absent=await request(port,5,{ subscriptionId:1301000001 },'705',action);
    assert.equal(absent.status,503);assert.equal(JSON.parse(absent.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(state(),before,'Incomplete data does not synthesize an empty successful catalog');
    const plan=structuredClone(master.subscriptions[1301000001]);
    plan.name='<script>plan</script>';plan.productId='" onclick="bad';plan.description='<iframe>retired</iframe>';
    plan.bonusItems[0].name='<img src="bad">';
    const escaped=subscriptionDetails({ id:1301000001,plan,now:1630461600 });
    assert.ok(escaped.includes('&lt;script&gt;plan&lt;/script&gt;')&&escaped.includes('&lt;iframe&gt;'));
    assert.ok(!/<(?:script|iframe|img)\b/i.test(escaped));
    for (const changed of [null,{ ...plan,bonusItems:[] },{ ...plan,endAt:0 },
      { ...plan,extendBonusItems:[plan.extendBonusItems[0],plan.extendBonusItems[0]] }])
      assert.equal(subscriptionDetails({ id:1301000001,plan:changed,now:1630461600 }),null);
    console.log('Subscription detail fixture: both plans, original rewards, inline result, replay/clock/restart/rollback/escaping; native acceptance still pending');
  } finally {
    if (app) await app.close();
    fs.rmSync(root,{recursive:true,force:true});
  }
}

if (require.main===module) main().catch(error=>{ console.error(error);process.exitCode=1; });
