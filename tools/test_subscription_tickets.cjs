'use strict';

// DEFERRED: synthetic owned rows, not native effects/signatures or earned shards.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer,OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-prism-exchange-'));
  let app,port,database,sequence=100,now=1630461660;
  const open = async () => {
    app = createServer({ database,seed,master,wallNowSeconds:() => now,log:() => {} });
    await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app=null; } };
  const fresh = async name => { await close(); database=path.join(directory,`${name}.sqlite`); now=1630461660; await open(); };
  const send = (action,value) => request(port,++sequence,value,String(sequence),action);
  const parse = response => { assert.equal(response.status,200,response.body.toString()); return JSON.parse(response.body); };
  const put = (name,rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected = async (pending,status,unavailable=false,before=snapshot()) => {
    const response=await pending; assert.equal(response.status,status,response.body.toString()); assert.equal(snapshot(),before);
    if (unavailable) assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const pushBody = (putItems={},operations=[],deleteItems={}) => ({
    badges:null,scripts:{},dataTokens:{},checksums:{ before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name => [name,md5(putItems[name] ?? [])])) },
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature:0,trigger:'SubscriptionTicketConsume',putItems,deleteItems }] : [],
    operations:operations.map(row => ({ id:row.id,verifier:row.token })),
  });
  const push = (...args) => send('user_data/push',pushBody(...args));
  const ticket = () => ({ userId:seed.userId,subscriptionTicketId:331000001,signature:0,bookEntryState:3,cumulativeAmount:13,
    dateList:[...Array.from({ length:3 },() => ({ aquiredAt:now-15552000,expireAt:now })),
      ...Array.from({ length:10 },() => ({ aquiredAt:now,expireAt:now+15552000 }))] });
  const bond = id => ({ userId:seed.userId,limitBreakItemId:id,signature:0,bookEntryState:3,amount:2,cumulativeAmount:7 });
  const nativeRows = operation => ({ UserSubscriptionTicket:operation.parameters.userSubscriptionTicket,
    UserGeneralLimitBreakItem:operation.parameters.userGeneralLimitBreakItem,UserShopProduct:operation.parameters.userShopProduct });
  const exchange = (itemId=207004490,count=1) => send('subscription/ticket/consume',{ itemId,count });
  const gift = (itemId,id=1) => ({ userId:seed.userId,id,itemId,amount:1,title:'Synthetic saved Prism item',message:'',senderType:1,
    senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,pcHeroSublimateCount:0,
    state:0,startAt:now,expireAt:0,createdAt:now,dynamodbExpireAt:0 });
  try {
    for (const [productId,rewardId] of [[207004490,291000002],[207004491,291000003]]) for (const count of [1,2]) {
      await fresh(`product-${productId}-${count}`); const before=ticket(),previous=bond(rewardId);
      put('UserSubscriptionTicket',[before]); put('UserGeneralLimitBreakItem',[previous]);
      const result=parse(await exchange(productId,count)),identity=sequence,operation=result.operation,rows=nativeRows(operation);
      await rejected(request(port,identity,{ itemId:productId,count:count+1 },String(identity),'subscription/ticket/consume',
        { 'X-ARGO-REQUEST-BODY-HASH':md5({ itemId:productId,count }) }),400);
      await rejected(request(port,identity,{ itemId:productId,count },String(identity),'shop/buy'),400);
      assert.equal(operation.type,28100); assert.deepEqual(result.operations,[operation]);
      assert.equal(rows.UserSubscriptionTicket[0].dateList.length,10-3*count);
      assert.equal(rows.UserSubscriptionTicket[0].cumulativeAmount,13);
      assert.equal(rows.UserGeneralLimitBreakItem[0].amount,2+count);
      assert.equal(rows.UserGeneralLimitBreakItem[0].cumulativeAmount,7+count);
      assert.equal(rows.UserShopProduct[0].count,count); assert.equal(rows.UserShopProduct[0].readState,0);
      assert.deepEqual(app.store.read('UserSubscriptionTicket').data,[before],'No pre-published cost');
      assert.deepEqual(app.store.read('UserGeneralLimitBreakItem').data,[previous],'No pre-published reward');
      assert.deepEqual(parse(await exchange(productId,count)).operation,operation);
      await rejected(exchange(productId,count+1),400);
      await rejected(push({ UserShopProduct:rows.UserShopProduct },[operation]),400);
      await rejected(push({},[operation]),400);
      parse(await push(rows)); await close(); await open(); now+=86400;
      assert.deepEqual(parse(await request(port,identity,{ itemId:productId,count },String(identity),'subscription/ticket/consume')).operation,operation);
      app.store.db.exec("CREATE TRIGGER fail_prism_ack BEFORE INSERT ON operation_done BEGIN SELECT RAISE(ABORT,'prism ACK rollback'); END");
      await rejected(push({},[operation]),503); app.store.db.exec('DROP TRIGGER fail_prism_ack');
      parse(await push({},[operation])); app.store.beginSession(); await close(); await open();
      await rejected(request(port,identity,{ itemId:productId,count },String(identity),'subscription/ticket/consume'),503,true);
      await rejected(request(port,identity,{ itemId:productId,count:count+1 },String(identity),'subscription/ticket/consume'),400);
      const spent={ ...rows.UserGeneralLimitBreakItem[0],amount:0 };
      parse(await push({ UserGeneralLimitBreakItem:[spent] }));
      await rejected(push({ UserGeneralLimitBreakItem:[{ ...spent,cumulativeAmount:7 }] }),400);
      await rejected(push({},[],{ UserGeneralLimitBreakItem:[{ limitBreakItemId:rewardId }] }),400);
      await rejected(push({ UserSubscriptionTicket:[before] }),400);
      await rejected(push({},[],{ UserSubscriptionTicket:[{ subscriptionTicketId:331000001 }] }),400);
      // A genuine later lifetime acquisition permits new dated stock, but
      // cannot restore previously consumed dated entries for free.
      const later={ ...rows.UserSubscriptionTicket[0],cumulativeAmount:14,
        dateList:[...rows.UserSubscriptionTicket[0].dateList,{ aquiredAt:now,expireAt:now+15552000 }] };
      parse(await push({ UserSubscriptionTicket:[later] }));
      const next=parse(await exchange(productId,1)).operation;
      assert.equal(next.parameters.userShopProduct[0].count,count+1);
      parse(await push(nativeRows(next),[next]));
    }
    await fresh('absent-bond'); put('UserSubscriptionTicket',[ticket()]);
    const operation=parse(await exchange()).operation;
    assert.equal(operation.parameters.userGeneralLimitBreakItem[0].amount,1);
    assert.equal(operation.parameters.userGeneralLimitBreakItem[0].limitBreakItemId,291000002);
    assert.equal(operation.parameters.userGeneralLimitBreakItem[0].generalLimitBreakItemId,undefined);
    const rows=nativeRows(operation); parse(await push(rows));
    const spentReply=parse(await push({ UserGeneralLimitBreakItem:[{ ...rows.UserGeneralLimitBreakItem[0],amount:0 }] }));
    assert.ok(!spentReply.operations?.some(row=>row.id===operation.id),'A saved absolute exchange cannot be replayed while spending');
    await rejected(send('user/login',undefined),503,true);
    parse(await push({ UserGeneralLimitBreakItem:[{ ...rows.UserGeneralLimitBreakItem[0],amount:0 }] },[operation]));

    //WRITTEN ONLY / NOT RUN: two original products, capped counters and full-row table/field save orders.
    const maximum=999999999,baselines=[{amount:7,cumulativeAmount:10},{amount:0,cumulativeAmount:maximum-1},
      {amount:7,cumulativeAmount:maximum-1},{amount:7,cumulativeAmount:maximum},
      {amount:maximum-1,cumulativeAmount:maximum-1},{amount:maximum-1,cumulativeAmount:maximum},{amount:maximum,cumulativeAmount:maximum}],
      orders=['together','shard-bond-shop','shard-shop-bond','bond-shard-shop','bond-shop-shard','shop-shard-bond','shop-bond-shard',
        'stock-prefix','cumulative-prefix','spent-first'];
    for(const [productId,rewardId] of [[207004490,291000002],[207004491,291000003]]) for(const count of [1,2])
      for(const baseline of baselines) for(const order of orders) {
        await fresh(`bounded-stock-${productId}-${count}-${baseline.amount}-${baseline.cumulativeAmount}-${order}`);
        const prior={...bond(rewardId),...baseline,bookEntryState:255,signature:0xffffffff},shards=ticket();
        put('UserSubscriptionTicket',[shards]);put('UserGeneralLimitBreakItem',[prior]);
        const issue=parse(await exchange(productId,count)),identity=sequence,grant=issue.operation,targets=nativeRows(grant),
          target=targets.UserGeneralLimitBreakItem[0],readStock=()=>JSON.parse(app.store.db.prepare(
            'SELECT stock_state FROM subscription_exchange_claim WHERE operation_id=?').get(grant.id).stock_state);
        assert.deepEqual(target,{...prior,amount:Math.min(maximum,prior.amount+count),cumulativeAmount:Math.min(maximum,prior.cumulativeAmount+count)});
        assert.equal(target.signature,prior.signature,'28100 imports the wire row; unlike lottery, it does not stamp the operation signature');
        assert.equal(targets.UserSubscriptionTicket[0].dateList.length,10-3*count);
        assert.equal(targets.UserSubscriptionTicket[0].cumulativeAmount,shards.cumulativeAmount);
        assert.deepEqual(app.store.read('UserGeneralLimitBreakItem').data,[prior]);assert.deepEqual(app.store.read('UserSubscriptionTicket').data,[shards]);
        assert.deepEqual(readStock(),{policy:'offline-prism-stock-v1',amountAdded:0,ticketObserved:false,bondObserved:false,shopObserved:false,effect:false});
        await rejected(push({},[grant]),400);
        const capture=JSON.stringify(readStock());
        for(const corrupt of [null,'{',JSON.stringify({...readStock(),policy:'foreign'}),JSON.stringify({...readStock(),amountAdded:target.amount-prior.amount+1}),
          JSON.stringify({...readStock(),bondObserved:1}),JSON.stringify({...readStock(),ticketObserved:true,effect:false}),
          JSON.stringify({...readStock(),ticketObserved:true,bondObserved:true,shopObserved:true,effect:true})]) {
          app.store.db.prepare('UPDATE subscription_exchange_claim SET stock_state=? WHERE operation_id=?').run(corrupt,grant.id);
          await rejected(send('user/login',undefined),503,true);await rejected(push(targets,[grant]),503,true);
        }
        app.store.db.prepare('UPDATE subscription_exchange_claim SET stock_state=? WHERE operation_id=?').run(capture,grant.id);
        const one={shard:{UserSubscriptionTicket:targets.UserSubscriptionTicket},bond:{UserGeneralLimitBreakItem:targets.UserGeneralLimitBreakItem},
          shop:{UserShopProduct:targets.UserShopProduct}};
        let fragments;
        if(order==='together') fragments=[targets];
        else if(order==='spent-first') fragments=[{...targets,UserGeneralLimitBreakItem:[{...target,amount:Math.max(0,target.amount-1)}]}];
        else if(order==='stock-prefix' || order==='cumulative-prefix') {
          let prefix=order==='stock-prefix'?{...prior,amount:target.amount}:{...prior,cumulativeAmount:target.cumulativeAmount};
          if(prefix.amount>prefix.cumulativeAmount) {
            await rejected(push({UserGeneralLimitBreakItem:[prefix]}),400);prefix={...prefix,cumulativeAmount:target.cumulativeAmount};
          }
          fragments=[{UserGeneralLimitBreakItem:[prefix]},one.bond,one.shard,one.shop];
        } else fragments=order.split('-').map(key=>one[key]);
        for(let i=0;i<fragments.length;i++) {
          const fragment=fragments[i],before=JSON.stringify(readStock()),allSame=Object.entries(fragment).every(([table,rows])=>
            JSON.stringify(app.store.read(table).data)===JSON.stringify(rows));
          if(!allSame && i===0) {
            for(const table of ['profile','subscription_exchange_claim','reply_cache']) {
              app.store.db.exec(`CREATE TRIGGER fail_prism_partial BEFORE ${table==='reply_cache'?'INSERT':'UPDATE'} ON ${table}
                BEGIN SELECT RAISE(ABORT,'Prism partial rollback'); END`);
              await rejected(push(fragment),503);app.store.db.exec('DROP TRIGGER fail_prism_partial');
            }
          }
          const saved=parse(await push(fragment));
          assert.deepEqual(saved.operations,[],
            'A stock fragment without an ACK cannot clear the pending native receipt');
          assert.equal(app.store.operations().length,1);assert.ok(readStock().amountAdded<=target.amount-prior.amount);
          if(i===0 && readStock().effect) {
            const partial=JSON.stringify(readStock());await close();await open();assert.equal(JSON.stringify(readStock()),partial);
            if(!app.store.db.prepare('SELECT effect_saved FROM subscription_exchange_claim WHERE operation_id=?').get(grant.id).effect_saved)
              await rejected(push({},[grant]),400);
            if(order!=='together') {
              await rejected(send('user/login',undefined),503,true);
              await rejected(request(port,identity,{itemId:productId,count},String(identity),'subscription/ticket/consume'),503,true);
            }
          }
          assert.ok(JSON.stringify(readStock())===before || readStock().effect);
        }
        const owned=app.store.read('UserGeneralLimitBreakItem').data[0],spent={...owned,amount:Math.max(0,owned.amount-1)};
        parse(await push({UserGeneralLimitBreakItem:[spent]}));
        if(spent.amount<owned.amount) await rejected(push({UserGeneralLimitBreakItem:[owned]}),400);
        const ackBody=pushBody({},[grant]);
        for(const table of ['subscription_exchange_claim','operation_done','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER fail_prism_final BEFORE ${table==='subscription_exchange_claim'?'UPDATE':'INSERT'} ON ${table}
            BEGIN SELECT RAISE(ABORT,'Prism final rollback'); END`);
          await rejected(send('user_data/push',ackBody),503);app.store.db.exec('DROP TRIGGER fail_prism_final');
        }
        const acknowledged=await send('user_data/push',ackBody),ackIdentity=sequence;parse(acknowledged);
        assert.equal(app.store.operations().length,0);assert.equal(readStock().bondObserved,true);
        await close();await open();
        const replay=await request(port,ackIdentity,ackBody,String(ackIdentity),'user_data/push');assert.equal(replay.status,200);
        assert.equal(Buffer.compare(replay.body,acknowledged.body),0,'Cold ACK retries keep the exact response bytes');
        assert.deepEqual(app.store.read('UserGeneralLimitBreakItem').data,[spent]);
        if(target.cumulativeAmount===maximum) {
          if(spent.amount<maximum) await rejected(push({UserGeneralLimitBreakItem:[{...spent,amount:spent.amount+1}]}),400);
          await rejected(push({},[],{UserGeneralLimitBreakItem:[{limitBreakItemId:rewardId}]}),400);
        }
        const retained=app.store.read('UserSubscriptionTicket').data[0],fewer={...retained,dateList:retained.dateList.slice(1)};
        parse(await push({UserSubscriptionTicket:[fewer]}));await rejected(push({UserSubscriptionTicket:[retained]}),400);
        await rejected(request(port,identity,{itemId:productId,count},String(identity),'subscription/ticket/consume'),503,true);
        if(fewer.dateList.length>=3) {
          const next=parse(await exchange(productId,1)).operation;assert.equal(next.parameters.userShopProduct[0].count,count+1);
          assert.equal(next.parameters.userGeneralLimitBreakItem[0].amount,Math.min(maximum,spent.amount+1));
          parse(await push(nativeRows(next),[next]));
        }
      }

    //WRITTEN ONLY / NOT RUN: an ordinary original-item Present may legitimately raise completed capped Prism stock.
    for(const [productId,rewardId] of [[207004490,291000002],[207004491,291000003]]) {
      await fresh(`capped-prism-present-${productId}`);put('UserSubscriptionTicket',[ticket()]);
      put('UserGeneralLimitBreakItem',[{...bond(rewardId),amount:7,cumulativeAmount:maximum,signature:0xffffffff,bookEntryState:255}]);
      const exchanged=parse(await exchange(productId)).operation;parse(await push(nativeRows(exchanged),[exchanged]));
      const saved=app.store.read('UserGeneralLimitBreakItem').data[0],spent={...saved,amount:0};parse(await push({UserGeneralLimitBreakItem:[spent]}));
      await rejected(push({UserGeneralLimitBreakItem:[{...spent,amount:1}]}),400);
      const present=gift(rewardId);put('UserGift',[present]);const received=parse(await send('gift/receive',{userId:seed.userId,giftIds:[present.id]}));
      const reward=received.operation ?? received.operations[0],gained={...spent,amount:1,signature:reward.signature};
      parse(await push({UserGift:[{...present,state:1}],UserGeneralLimitBreakItem:[gained]},[reward]));
      await close();await open();assert.deepEqual(app.store.read('UserGeneralLimitBreakItem').data,[gained]);
    }

    //WRITTEN ONLY / NOT RUN: nullable receipt migration preserves an old queue instead of inventing stock proof.
    await fresh('legacy-prism-stock-capture');put('UserSubscriptionTicket',[ticket()]);put('UserGeneralLimitBreakItem',[bond(291000002)]);
    const legacy=parse(await exchange()).operation,legacyCapture=app.store.db.prepare('SELECT stock_state FROM subscription_exchange_claim').get().stock_state,
      legacyRows=app.store.read('UserGeneralLimitBreakItem').data,legacyReceipt=app.store.db.prepare(
        'SELECT operation_id,product_id,quantity,issued_at,before_json,parameters,effect_saved FROM subscription_exchange_claim').get();
    await close();const oldDatabase=new(require('node:sqlite').DatabaseSync)(database);
    try {oldDatabase.exec('ALTER TABLE subscription_exchange_claim DROP COLUMN stock_state');} finally {oldDatabase.close();}
    await open();assert.equal(app.store.db.prepare('SELECT stock_state FROM subscription_exchange_claim').get().stock_state,null);
    assert.deepEqual(app.store.db.prepare('SELECT operation_id,product_id,quantity,issued_at,before_json,parameters,effect_saved FROM subscription_exchange_claim').get(),legacyReceipt);
    assert.deepEqual(app.store.read('UserGeneralLimitBreakItem').data,legacyRows);assert.equal(app.store.operations().length,1);
    await rejected(send('user/login',undefined),503,true);await rejected(push(nativeRows(legacy),[legacy]),503,true);
    app.store.db.prepare('UPDATE subscription_exchange_claim SET stock_state=? WHERE operation_id=?').run(legacyCapture,legacy.id);
    parse(await push(nativeRows(legacy),[legacy]));

    //WRITTEN ONLY / NOT RUN:26415bc six-field General Bond reader preserves UInt8 book/UInt32 signature on28100 full-row imports.
    for(const [productId,rewardId] of [[207004490,291000002],[207004491,291000003]]) {
      await fresh(`native-bond-width-${productId}`);
      const previous={...bond(rewardId),signature:0xffffffff,bookEntryState:255};
      put('UserSubscriptionTicket',[ticket()]);put('UserGeneralLimitBreakItem',[previous]);
      const grant=parse(await exchange(productId)).operation,targets=nativeRows(grant),target=targets.UserGeneralLimitBreakItem[0];
      assert.deepEqual(target,{...previous,amount:previous.amount+1,cumulativeAmount:previous.cumulativeAmount+1});
      assert.deepEqual(Object.keys(target).sort(),['userId','limitBreakItemId','amount','bookEntryState','signature','cumulativeAmount'].sort());
      assert.deepEqual(app.store.read('UserGeneralLimitBreakItem').data,[previous],'Exchange must not precredit the native bond');
      const missing=structuredClone(target);delete missing.signature;
      for(const incoming of [[missing],[{...target,reservedAmount:0}],[{...target,dateList:[]}],
        [{...target,lastResetAt:0}],[{...target,lastAquiredAt:0}],[{...target,generalLimitBreakItemId:rewardId}],
        [{...target,signature:0x100000000}],[{...target,signature:'1'}],[{...target,bookEntryState:256}],
        [{...target,limitBreakItemId:0}],[target,target]])
        await rejected(push({...targets,UserGeneralLimitBreakItem:incoming},[grant]),400);
      const good=JSON.stringify(grant.parameters),malformed=JSON.stringify({...grant.parameters,
        userGeneralLimitBreakItem:[{...target,reservedAmount:0}]});
      app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(malformed,grant.id);
      app.store.db.prepare('UPDATE subscription_exchange_claim SET parameters=? WHERE operation_id=?').run(malformed,grant.id);
      await rejected(send('user/login',undefined),503,true);
      app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(good,grant.id);
      app.store.db.prepare('UPDATE subscription_exchange_claim SET parameters=? WHERE operation_id=?').run(good,grant.id);
      parse(await push(targets,[grant]));await close();await open();
      assert.deepEqual(app.store.read('UserGeneralLimitBreakItem').data,[target]);assert.deepEqual(app.store.operations(),[]);
    }
    for(const changes of [{signature:undefined},{signature:-1},{signature:0x100000000},{signature:'0'},
      {bookEntryState:undefined},{bookEntryState:-1},{bookEntryState:256},{reservedAmount:0},{dateList:[]},
      {lastResetAt:0},{lastAquiredAt:0},{generalLimitBreakItemId:291000002},{limitBreakItemId:291000001}]) {
      await fresh(`invalid-native-bond-${Object.keys(changes)[0]}-${String(Object.values(changes)[0])}`);
      put('UserSubscriptionTicket',[ticket()]);put('UserGeneralLimitBreakItem',[{...bond(291000002),...changes}]);
      await rejected(exchange(),503,true);
    }

    for (const change of [{ amount:13 },{ userId:2 },{ dateList:null },{ dateList:[{ aquiredAt:now }] },
      { dateList:[{ aquiredAt:'1',expireAt:now }] },{ cumulativeAmount:0 }]) {
      await fresh('invalid'); put('UserSubscriptionTicket',[{ ...ticket(),...change }]); await rejected(exchange(),400);
    }
    await fresh('expired'); put('UserSubscriptionTicket',[{ ...ticket(),dateList:[{ aquiredAt:now-15552000,expireAt:now }] }]);
    await rejected(exchange(),400); put('UserSubscriptionTicket',[ticket()]);
    for (const value of [{ itemId:331000001,count:1 },{ shopProductId:207004490,count:1 },{ itemId:207004490,count:0 },
      { itemId:207004490,count:4 },{ itemId:207004490,count:'1' }])
      await rejected(send('subscription/ticket/consume',value),value.itemId===331000001 ? 503 : 400,value.itemId===331000001);
    now=1630461599; await rejected(exchange(),400); now=1630461660;
    await rejected(send('shop/buy',{ shopProductId:207004490 }),503,true);
    put('UserGeneralLimitBreakItem',[{ ...bond(291000002),limitBreakItemId:undefined,generalLimitBreakItemId:291000002 }]);
    await rejected(exchange(),503,true);

    for (const table of ['operation_queue','subscription_exchange_claim','subscription_exchange_request','reply_cache']) {
      await fresh(`rollback-${table}`); put('UserSubscriptionTicket',[ticket()]);
      app.store.db.exec(`CREATE TRIGGER fail_prism BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'prism issue rollback'); END`);
      await rejected(exchange(),503); app.store.db.exec('DROP TRIGGER fail_prism');
    }
    for (const table of ['profile','subscription_ticket_floor','subscription_reward_floor','operation_done','reply_cache']) {
      await fresh(`save-rollback-${table}`); put('UserSubscriptionTicket',[ticket()]);
      const grant=parse(await exchange()).operation;
      app.store.db.exec(`CREATE TRIGGER fail_prism_save BEFORE ${table==='profile' ? 'UPDATE' : 'INSERT'} ON ${table}
        BEGIN SELECT RAISE(ABORT,'prism save rollback'); END`);
      await rejected(push(nativeRows(grant),[grant]),503); app.store.db.exec('DROP TRIGGER fail_prism_save');
    }
    for (const itemId of [331000001,291000002]) for (const giftFirst of [true,false]) {
      await fresh(`gift-${itemId}-${giftFirst}`); put('UserSubscriptionTicket',[ticket()]);
      put('UserGeneralLimitBreakItem',[bond(291000002)]); const present=gift(itemId); put('UserGift',[present]);
      const claim = () => send('gift/receive',{ userId:seed.userId,giftIds:[1] });
      if (giftFirst) { parse(await claim()); await rejected(exchange(),400); }
      else { parse(await exchange()); await rejected(claim(),400); }
    }
    await fresh('missing-receipt'); put('UserSubscriptionTicket',[ticket()]);
    const result=parse(await exchange()),identity=sequence;
    app.store.db.prepare('DELETE FROM subscription_exchange_claim WHERE operation_id=?').run(result.operation.id);
    await rejected(exchange(),503,true);
    await rejected(request(port,identity,{ itemId:207004490,count:1 },String(identity),'subscription/ticket/consume'),503,true);
    await rejected(push(nativeRows(result.operation),[result.operation]),503,true);
    await rejected(send('user/login',undefined),503,true);
    await rejected(send('user_data/confirm',undefined),503,true);
    await rejected(send('user_data/pull',{ tables:['UserSubscriptionTicket','UserGeneralLimitBreakItem','UserShopProduct'] }),503,true);
    assert.equal(app.store.operations().length,1,'Unknown legacy queue is preserved');
    for (const table of ['subscription_ticket_floor','subscription_reward_floor']) {
      await fresh(`lost-${table}`); put('UserSubscriptionTicket',[ticket()]);
      const grant=parse(await exchange()).operation; parse(await push(nativeRows(grant),[grant]));
      app.store.db.exec(`DELETE FROM ${table}`);
      await rejected(exchange(),503,true);
      await rejected(push({ UserSubscriptionTicket:grant.parameters.userSubscriptionTicket }),503,true);
    }
    console.log('Prism shard28100 exchange / dated stock / saved effects / permanent retry / rollback: OK (no native acceptance)');
  } finally { await close(); fs.rmSync(directory,{ recursive:true,force:true }); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode=1; });
