'use strict';

// DEFERRED, NOT RUN: isolated local receipts and synthetic native-shaped saves.
// This does not prove SDK enrollment, signatures, native effects or UI recovery.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const { createServer,OFFLINE_UNAVAILABLE_CODE,expeditionCompletionStage }=require('./danmemore_server.cjs');
const { request,friendshipUnlockFixture }=require('./test_danmemore_server.cjs');
const { itemDeltas }=require('./test_friendship_rewards.cjs');
const seed=require('../data/danmemore-seed.json');
const master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
const fields={ UserSkipTicket:'skipTicketId',UserGachaTicket:'gachaTicketId',UserSubscriptionTicket:'subscriptionTicketId' };
const staminaMissions=Object.entries(master.achievements).filter(([,row])=>row.rewardType===10);

async function main() {
  const root=fs.mkdtempSync(path.join(process.cwd(),'.work','subscription-bonus-test-'));
  let app,port,database,now=1640995200,sequence=100,orderIdentity=0;
  const open=async (metadata=master)=>{
    app=createServer({ database,seed,master:metadata,wallNowSeconds:()=>now,log:()=>{} });
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve)); port=app.server.address().port;
  };
  const close=async()=>{ if (app) { await app.close(); app=null; } };
  const fresh=async name=>{ await close(); database=path.join(root,`${name}.sqlite`); now=1640995200; await open(); };
  const parse=response=>{ assert.equal(response.status,200,response.body.toString()); return JSON.parse(response.body); };
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const claim=(isPurchase=false)=>send('subscription/bonus',{ isPurchase });
  const put=(table,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),table);
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='event_clock' ORDER BY name")
    .all().map(({ name })=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected=async (work,status=400,unavailable=false)=>{
    const before=snapshot(),response=await work(); assert.equal(response.status,status,response.body.toString());
    assert.equal(snapshot(),before,'Rejected request must preserve profiles, receipts, queue, sequence and cache');
    if (unavailable) assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const sdk=(route,body,token)=>new Promise((resolve,reject)=>{
    const wire=body===undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body));
    const req=http.request({ host:'127.0.0.1',port,path:`/billing/v1.0/payment/subscription/${route}`,
      method:body===undefined ? 'GET' : 'POST',headers:{ 'Content-Type':'application/json','Content-Length':wire.length,
        ...(token ? { 'X-GREE-GAMELIB':encodeURIComponent(`authVersion=1&paymentApiToken=${token}`) } : {}) } },response=>{
      const chunks=[]; response.on('data',chunk=>chunks.push(chunk));
      response.on('end',()=>resolve({ status:response.statusCode,body:Buffer.concat(chunks) }));
    }); req.on('error',reject); req.end(wire);
  });
  const activate=async tier=>{
    const product=parse(await sdk('productlist')).entry.products.find(row=>row.subscription_label===`tier${tier}`);
    assert.ok(product);
    const order=parse(await sdk('purchase',{ product_id:product.product_id,country_code:product.country_code,
      currency_code:product.currency_code,translated_name:product.name,formatted_price:product.formatted_price,price:'0' },
    (++orderIdentity).toString(16).toUpperCase().padStart(32,'0')));
    parse(await sdk('purchase/commit',{ purchase_id:order.entry.purchase_id,receipt:order.receipt,signature:order.signature }));
    return app.store.db.prepare('SELECT * FROM billing_subscription_order WHERE purchase_id=?').get(order.entry.purchase_id);
  };
  const regular=async (tiers=[1,2])=>{
    const trials=[]; for (const tier of tiers) trials.push(await activate(tier));
    now=Math.max(...trials.map(row=>row.end_at));
    const result=[]; for (const tier of tiers) result.push(await activate(tier)); return result;
  };
  const push=(putItems={},operations=[],deleteItems={})=>send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{ before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(table=>[table,md5(putItems[table] ?? [])])) },
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature:0,trigger:'TicketBonusReceive',putItems,deleteItems }] : [],
    operations:operations.map(row=>({ id:row.id,verifier:row.token })),
  });
  const nativeRows=operation=>{
    const rows={};
    for (const [table,array] of [['UserSkipTicket','userSkipTicket'],['UserGachaTicket','userGachaTicket'],
      ['UserSubscriptionTicket','userSubscriptionTicket']]) if (operation.parameters[array].length) rows[table]=operation.parameters[array];
    const stamina=app.store.staminaReward(operation);
    if (stamina) rows.UserInfo=app.store.read('UserInfo').data.map(row=>({ ...row,playerStatus:{ ...row.playerStatus,baseSP:stamina.sp_minimum } }));
    return rows;
  };
  const gift=itemId=>({ userId:seed.userId,id:1,itemId,amount:1,title:'Isolated reward fixture',message:'',senderType:1,
    senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,pcHeroSublimateCount:0,
    state:0,startAt:now,expireAt:0,createdAt:now,dynamodbExpireAt:0 });
  try {
    await fresh('trial');
    for (const value of [undefined,{},[],{ isPurchase:0 },{ isPurchase:'false' },{ isPurchase:false,extra:0 }])
      await rejected(()=>send('subscription/bonus',value));
    const empty=parse(await claim());
    assert.deepEqual(empty,{ code:0,gainedBonus:[],displayBonus:[],displayExtendBonus:[] });
    assert.equal(app.store.operations().length,0);
    await activate(1); await activate(2);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM subscription_monthly_entitlement').get().n,0,'Trial has no renewal award');
    const defaultSkip={ userId:seed.userId,skipTicketId:288000001,signature:0,bookEntryState:3,amount:5,cumulativeAmount:5,reservedAmount:0,lastResetAt:now };
    put('UserSkipTicket',[defaultSkip]);
    const originalProfiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
    const result=parse(await claim()),identity=sequence,operation=result.operation;
    assert.equal(operation.type,28000); assert.deepEqual(result.operations,[operation]);
    assert.ok(!Object.hasOwn(result,'errorCode'));
    assert.equal(result.displayBonus.length,4); assert.deepEqual(result.displayExtendBonus,[]);
    assert.deepEqual(operation.parameters.userSkipTicket.map(row=>[row.skipTicketId,row.amount,row.cumulativeAmount]),[[288000002,10,10]]);
    assert.equal(app.store.staminaReward(operation).amount,200);
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),originalProfiles,'Issue is not inventory/SP precredit');
    assert.deepEqual(parse(await request(port,identity,{ isPurchase:false },String(identity),'subscription/bonus')).operation,operation);
    assert.deepEqual(parse(await claim(true)).operation,operation,'UI isPurchase does not regrant or reset the claim day');
    await rejected(()=>request(port,identity,{ isPurchase:true },String(identity),'subscription/bonus'));
    await rejected(()=>request(port,identity,{ isPurchase:false },String(identity),'shop/buy'));
    await rejected(()=>push({},[operation]));
    const rows=nativeRows(operation),partial=parse(await push({ UserSkipTicket:rows.UserSkipTicket }));
    assert.ok(!partial.operations.some(row=>row.id===operation.id),'Partial absolute reward is not redelivered in the save reply');
    assert.ok(app.store.operations().some(row=>row.id===operation.id),'Suppression preserves the real pending queue');
    await close(); await open();
    await rejected(()=>claim(),503,true);
    const resumed=parse(await send('user_data/confirm',undefined)).operations.find(row=>row.id===operation.id);
    assert.deepEqual(resumed,{...operation,parameters:{...operation.parameters,userSkipTicket:[]}});
    assert.equal((await send('user_data/pull',{ tables:['UserSkipTicket'] })).status,200);
    parse(await push({ UserInfo:rows.UserInfo }));
    const spent={ ...rows.UserSkipTicket[0],amount:2 };
    parse(await push({ UserSkipTicket:[spent] }));
    const spentInfo=rows.UserInfo.map(row=>({ ...row,playerStatus:{ ...row.playerStatus,baseSP:1 } }));
    parse(await push({ UserInfo:spentInfo }));
    app.store.db.exec("CREATE TRIGGER fail_bonus_ack BEFORE INSERT ON operation_done BEGIN SELECT RAISE(ABORT,'bonus ACK rollback'); END");
    await rejected(()=>push({},[operation]),503); app.store.db.exec('DROP TRIGGER fail_bonus_ack');
    parse(await push({},[operation]));
    assert.equal(app.store.read('UserSkipTicket').data.find(row=>row.skipTicketId===288000001).amount,5,'Membership did not duplicate the default refill');
    await rejected(()=>push({ UserSkipTicket:rows.UserSkipTicket }));
    await rejected(()=>push({},[],{ UserSkipTicket:[{ skipTicketId:288000002 }] }),503,true);
    assert.deepEqual(parse(await claim()),empty,'Same client day has no second reward');
    app.store.beginSession(); await close(); await open();
    await rejected(()=>request(port,identity,{ isPurchase:false },String(identity),'subscription/bonus'),503,true);
    now+=86400;
    const next=parse(await claim()).operation;
    assert.equal(next.parameters.userSkipTicket[0].amount,7); assert.equal(next.parameters.userSkipTicket[0].cumulativeAmount,20);
    parse(await push(nativeRows(next),[next]));
    now-=86400; assert.deepEqual(parse(await claim()),empty,'Clock rewind cannot erase a daily receipt');

    await fresh('regular'); const members=await regular(); now+=3600;
    const monthlyResult=parse(await claim(true)),monthly=monthlyResult.operation,monthlyIdentity=sequence;
    assert.equal(monthlyResult.displayExtendBonus.length,4);
    assert.deepEqual(monthly.parameters.userGachaTicket.map(row=>[row.gachaTicketId,row.cumulativeAmount,row.dateList]),
      [296000015,296000149].map(id=>[id,1,[{ aquiredAt:now }]]));
    assert.deepEqual(monthly.parameters.userSubscriptionTicket[0].dateList,
      [{ aquiredAt:now,expireAt:now+15552000 },{ aquiredAt:now,expireAt:now+15552000 }]);
    assert.ok(members.every(row=>app.store.db.prepare('SELECT operation_id FROM subscription_monthly_entitlement WHERE purchase_id=?').get(row.purchase_id).operation_id===monthly.id));
    assert.equal(app.store.read('UserGachaTicket').data.length,0);
    const monthlyRows=nativeRows(monthly);
    parse(await push({ UserGachaTicket:monthlyRows.UserGachaTicket }));
    await rejected(()=>push({},[monthly]));
    parse(await push({ UserSkipTicket:monthlyRows.UserSkipTicket,UserSubscriptionTicket:monthlyRows.UserSubscriptionTicket,UserInfo:monthlyRows.UserInfo },[monthly]));
    assert.deepEqual(parse(await claim()),empty);
    const used=monthlyRows.UserGachaTicket.map(row=>({ ...row,dateList:[] }));
    parse(await push({ UserGachaTicket:used }));
    await rejected(()=>push({ UserGachaTicket:monthlyRows.UserGachaTicket }));
    await rejected(()=>request(port,monthlyIdentity,{ isPurchase:true },String(monthlyIdentity),'subscription/bonus'),503,true);
    const floor=app.store.db.prepare('SELECT * FROM subscription_bonus_stock_floor WHERE table_name=? AND item_id=?').get('UserGachaTicket',296000015);
    app.store.db.prepare('DELETE FROM subscription_bonus_stock_floor WHERE table_name=? AND item_id=?').run(floor.table_name,floor.item_id);
    await rejected(()=>push({ UserGachaTicket:used }),503,true);
    app.store.db.prepare('INSERT INTO subscription_bonus_stock_floor VALUES(?,?,?,?,?)').run(floor.table_name,floor.item_id,floor.cumulative_amount,floor.amount,floor.date_list);

    // WRITTEN ONLY:82 synthetic component-save/spent combinations. This does
    // not prove native constructors, SP attribution or callback timing.
    for(const kind of ['trial','regular','expired']) for(const spentFirst of [false,true]) {
      const componentCount={trial:2,regular:5,expired:3}[kind];
      for(let mask=1;mask<(1<<componentCount);mask++) {
        await fresh(`cold-${kind}-${spentFirst}-${mask}`);
        if(kind==='trial') {await activate(1);await activate(2);}
        else {
          const periods=await regular();
          if(kind==='expired') now=Math.max(...periods.map(row=>row.end_at))+86400;
        }
        const profilesBefore=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
          hot=await claim(),hotIdentity=sequence,original=parse(hot).operation,full=nativeRows(original),
          stamina=app.store.staminaReward(original),components=[];
        assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profilesBefore);
        for(const [table,field] of Object.entries(fields)) for(const row of full[table] ?? [])
          components.push({table,rows:[row],key:`${table}:${row[field]}`});
        if(stamina) components.push({table:'UserInfo',rows:full.UserInfo,key:'stamina'});
        assert.equal(components.length,componentCount);
        const selected=components.filter((_,index)=>mask&(1<<index)),keys=new Set(selected.map(row=>row.key)),
          putComponents=list=>{
            const result={};for(const item of list) result[item.table]=[...(result[item.table] ?? []),...item.rows];
            return result;
          };
        const partial=parse(await push(putComponents(selected)));
        assert(!partial.operations.some(row=>row.id===original.id));
        if(spentFirst) {
          const spent=selected.map(item=>({...item,rows:item.rows.map(row=>item.table==='UserInfo'?
            {...row,playerStatus:{...row.playerStatus,baseSP:(stamina.sp_before+1)%2}}:
            item.table==='UserSkipTicket'?{...row,amount:0}:{...row,dateList:[]})}));
          parse(await push(putComponents(spent)));
        }
        await close();await open();
        const savedProfiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
          queue=app.store.operations(),receipt=app.store.db.prepare('SELECT * FROM subscription_bonus_claim WHERE operation_id=?').get(original.id),
          wallet=app.store.hardCurrency(),parameters={...original.parameters};
        for(const [table,field] of Object.entries(fields)) {
          const array={UserSkipTicket:'userSkipTicket',UserGachaTicket:'userGachaTicket',UserSubscriptionTicket:'userSubscriptionTicket'}[table];
          parameters[array]=parameters[array].filter(row=>!keys.has(`${table}:${row[field]}`));
        }
        if(keys.has('stamina')) parameters.gainedBonus=parameters.gainedBonus.filter(row=>row.type!==0);
        const expected={...original,parameters},cold=await send('user_data/confirm',undefined),coldIdentity=sequence,
          recovered=parse(cold).operations.find(row=>row.id===original.id);
        assert.deepEqual(recovered,expected);assert.deepEqual(app.store.operations(),queue);
        assert.equal(recovered.token,original.token);assert.equal(recovered.signature,original.signature);
        assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),savedProfiles);
        assert.deepEqual(app.store.db.prepare('SELECT * FROM subscription_bonus_claim WHERE operation_id=?').get(original.id),receipt);
        assert.equal(app.store.hardCurrency(),wallet);
        await rejected(()=>request(port,hotIdentity,{isPurchase:false},String(hotIdentity),'subscription/bonus'),503,true);
        await rejected(()=>claim(true),503,true);
        const login=parse(await send('user/login',undefined));assert(!Object.hasOwn(login,'operations'));
        assert.deepEqual(app.store.operations(),queue);
        assert.equal((await send('user_data/pull',{tables:['UserSkipTicket','UserGachaTicket','UserSubscriptionTicket']})).status,200);
        if(mask!==(1<<componentCount)-1) await rejected(()=>push({},[recovered]));
        const ticket=selected.find(row=>row.table!=='UserInfo');
        if(ticket) {
          const observed=JSON.parse(receipt.observed);
          app.store.db.prepare('UPDATE subscription_bonus_claim SET observed=? WHERE operation_id=?')
            .run(JSON.stringify(observed.filter(key=>key!==ticket.key)),original.id);
          await rejected(()=>send('user_data/confirm',undefined),503,true);
          app.store.db.prepare('UPDATE subscription_bonus_claim SET observed=? WHERE operation_id=?').run(receipt.observed,original.id);
          const id=ticket.rows[0][fields[ticket.table]],floor=app.store.db.prepare(
            'SELECT * FROM subscription_bonus_stock_floor WHERE table_name=? AND item_id=?').get(ticket.table,id);
          app.store.db.prepare('DELETE FROM subscription_bonus_stock_floor WHERE table_name=? AND item_id=?').run(ticket.table,id);
          await rejected(()=>send('user_data/confirm',undefined),503,true);
          app.store.db.prepare('INSERT INTO subscription_bonus_stock_floor VALUES(?,?,?,?,?)')
            .run(floor.table_name,floor.item_id,floor.cumulative_amount,floor.amount,floor.date_list);
        }
        if(keys.has('stamina')) {
          app.store.db.prepare('UPDATE stamina_reward_claim SET effect_saved=0 WHERE operation_id=?').run(original.id);
          await rejected(()=>send('user_data/confirm',undefined),503,true);
          app.store.db.prepare('UPDATE stamina_reward_claim SET effect_saved=1 WHERE operation_id=?').run(original.id);
        }
        await close();await open();
        assert.deepEqual((await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm')).body,cold.body);
        app.store.beginSession();
        assert.deepEqual((await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm')).body,cold.body);
        const remaining=components.filter(row=>!keys.has(row.key));
        if(remaining.length) {
          parse(await push(putComponents(remaining)));
          await rejected(()=>request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm'),503,true);
        }
        const finalProfiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
          settledProjection=parse(await send('user_data/confirm',undefined)).operations.find(row=>row.id===original.id);
        for(const array of ['userSkipTicket','userGachaTicket','userSubscriptionTicket']) assert.deepEqual(settledProjection.parameters[array],[]);
        assert(!settledProjection.parameters.gainedBonus.some(row=>row.type===0));
        app.store.db.exec("CREATE TRIGGER fail_cold_bonus_ack BEFORE INSERT ON operation_done BEGIN SELECT RAISE(ABORT,'cold bonus ACK rollback'); END");
        await rejected(()=>push({},[settledProjection]),503);app.store.db.exec('DROP TRIGGER fail_cold_bonus_ack');
        parse(await push({},[settledProjection]));await close();await open();
        assert.equal(app.store.operations().length,0);
        assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),finalProfiles);
        await rejected(()=>request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm'),503,true);
        await rejected(()=>request(port,hotIdentity,{isPurchase:false},String(hotIdentity),'subscription/bonus'),503,true);
      }
    }

    // Imported unproven prefixes are fixtures, not a repair of real profiles.
    for(const prefix of ['stamina','dated-ticket']) {
      await fresh(`unproven-cold-${prefix}`);
      if(prefix==='stamina') {await activate(1);await activate(2);}
      else {
        await regular();
        put('UserGachaTicket',[{userId:seed.userId,gachaTicketId:296000015,bookEntryState:3,signature:7,
          cumulativeAmount:3,dateList:[{aquiredAt:now-86400}]}]);
      }
      const original=parse(await claim()).operation,queue=app.store.operations();
      if(prefix==='stamina') {
        const receipt=app.store.staminaReward(original),info=app.store.read('UserInfo').data;
        put('UserInfo',info.map(row=>({...row,playerStatus:{...row.playerStatus,baseSP:(receipt.sp_before+1)%2}})));
      } else {
        const before=app.store.read('UserGachaTicket').data[0],target=original.parameters.userGachaTicket.find(row=>row.gachaTicketId===before.gachaTicketId);
        put('UserGachaTicket',[{...before,dateList:target.dateList}]);
      }
      await rejected(()=>send('user_data/confirm',undefined),503,true);
      await rejected(()=>send('user_data/pull',{tables:['UserInfo','UserGachaTicket']}),503,true);
      assert.deepEqual(app.store.operations(),queue);
    }

    // WRITTEN ONLY:36 original-order SP-prefix contexts; gift quantities,
    // funding, enrollment, completion flags and save order are synthetic prerequisites.
    for(const kind of ['trial','regular']) for(const order of [['gift'],['mission'],['gift','mission'],
      ['gift','mission','refill'],['gift','refill','mission'],['mission','gift','refill'],
      ['mission','refill','gift'],['refill','gift','mission'],['refill','mission','gift']])
      for(const ticketFirst of [false,true]) {
        await fresh(`sp-prefix-${kind}-${order.join('-')}-${ticketFirst}`);
        if(kind==='trial') {await activate(1);await activate(2);} else await regular();
        put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,baseSP:7}})));
        if(order.includes('refill')) app.store.changeHardCurrency(100);
        const prefix=[],flags=new Map();
        for(const producer of order) {
          if(producer==='gift') {
            const present={...gift(master.currencies['currency.stamina']),amount:13};put('UserGift',[present]);
            const operation=parse(await send('gift/receive',{userId:seed.userId,giftIds:[present.id]})).operations[0];
            prefix.push(operation);flags.set(operation.id,{UserGift:[{...present,state:1}]});
          } else if(producer==='mission') {
            assert.equal(staminaMissions.length,2);
            const achievementId=Number(staminaMissions[0][0]),completed={userId:seed.userId,achievementId,completedAt:now,
              lastResetAt:0,progressParam:1,readState:1,signature:0,state:3};
            put('UserAchievement',[completed]);
            const operation=parse(await send('achievement/complete',{achievementIds:[{achievementId,completedAt:now}]})).operations[0];
            assert.equal(app.store.staminaReward(operation).amount,staminaMissions[0][1].rewardAmount);
            prefix.push(operation);flags.set(operation.id,{UserAchievement:[{...completed,state:4}]});
          } else {
            const wallet=app.store.hardCurrency(),operation=parse(await send('currency/hard/consume',{consumeId:81041001})).operation,
              receipt=app.store.fixedConsumeReceipt(operation),status=app.store.read('UserInfo').data[0].playerStatus;
            assert.equal(operation.type,10200);assert.deepEqual(operation.parameters,{});
            assert.equal(wallet-app.store.hardCurrency(),master.consumes[81041001].amount);
            assert.equal(receipt.sp_minimum,Math.min(0x7fffffff,receipt.sp_before+master.playerMaxSP[status.level]));
            prefix.push(operation);flags.set(operation.id,{});
          }
        }
        const membership=parse(await claim()).operation,source=app.store.staminaReward(membership),
          originalQueue=app.store.operations(),wallet=app.store.hardCurrency(),
          refill=prefix.find(row=>row.type===10200),purchase=refill?app.store.fixedConsumeReceipt(refill):null;
        let reserved=7;
        for(const operation of prefix) {
          const receipt=operation.type===10200?app.store.fixedConsumeReceipt(operation):app.store.staminaReward(operation);
          assert.equal(receipt.sp_before,reserved);reserved=receipt.sp_minimum;
        }
        assert.equal(source.sp_before,reserved);
        if(ticketFirst) parse(await push({UserSkipTicket:membership.parameters.userSkipTicket}));
        await close();await open();
        const nativeBefore=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
          expected={...membership,parameters:{...membership.parameters,
            userSkipTicket:ticketFirst?[]:membership.parameters.userSkipTicket}},
          cold=await send('user_data/confirm',undefined),identity=sequence,result=parse(cold);
        assert.deepEqual(result.operations,[...prefix,expected]);assert.deepEqual(app.store.operations(),originalQueue);
        assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),nativeBefore);
        assert.equal(app.store.hardCurrency(),wallet);assert.deepEqual(app.store.staminaReward(membership),source);
        if(refill) assert.deepEqual(app.store.fixedConsumeReceipt(refill),purchase);
        assert.throws(()=>app.store.subscriptionBonusRecovery(membership),/Unobserved membership stamina/);
        assert.throws(()=>app.store.subscriptionBonusRecovery(membership,[prefix[0],prefix[0]]),/ordered|grant chain/);
        assert.throws(()=>app.store.subscriptionBonusRecovery(membership,[{...prefix[0],signature:prefix[0].signature%0x7fffffff+1}]),
          /original queued delivery/);
        if(prefix.length>1) assert.throws(()=>app.store.subscriptionBonusRecovery(membership,[...prefix].reverse()),/ordered|grant chain/);
        await rejected(()=>push({},[membership]));
        assert.equal((await send('user_data/pull',{tables:['UserInfo','UserSkipTicket']})).status,200);
        assert.equal((await send('user/login',undefined)).status,200);
        await close();await open();
        assert.deepEqual((await request(port,identity,undefined,String(identity),'user_data/confirm')).body,cold.body);
        for(const operation of prefix) {
          const before=operation.type===10200?app.store.fixedConsumeReceipt(operation):app.store.staminaReward(operation),
            info=app.store.read('UserInfo').data.map(row=>
            ({...row,playerStatus:{...row.playerStatus,baseSP:before.sp_minimum}}));
          parse(await push({...flags.get(operation.id),UserInfo:info},[operation]));
          const remaining=app.store.operations(),confirmed=parse(await send('user_data/confirm',undefined));
          assert.deepEqual(confirmed.operations,remaining.map(row=>row.id===membership.id?expected:row));
        }
        await rejected(()=>request(port,identity,undefined,String(identity),'user_data/confirm'),503,true);
        parse(await push(nativeRows(membership),[expected]));await close();await open();
        assert.equal(app.store.operations().length,0);
        assert.equal(app.store.read('UserInfo').data[0].playerStatus.baseSP,source.sp_minimum);
      }

    // WRITTEN ONLY: four refill-first queues use the native level capacity.
    // Saved-but-unacknowledged refills still cannot supply an unsaved prefix.
    for(const kind of ['trial','regular']) for(const ticketFirst of [false,true]) {
      await fresh(`sp-refill-prefix-${kind}-${ticketFirst}`);
      if(kind==='trial') {await activate(1);await activate(2);} else await regular();
      put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,baseSP:7}})));
      app.store.changeHardCurrency(100);
      const refill=parse(await send('currency/hard/consume',{consumeId:81041001})).operation,
        target=app.store.fixedConsumeReceipt(refill),membership=parse(await claim()).operation,
        source=app.store.staminaReward(membership),queue=app.store.operations();
      if(ticketFirst) parse(await push({UserSkipTicket:membership.parameters.userSkipTicket}));
      await close();await open();
      const saved=app.store.read('UserInfo').data,wallet=app.store.hardCurrency(),
        nativeBefore=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
        expected={...membership,parameters:{...membership.parameters,
          userSkipTicket:ticketFirst?[]:membership.parameters.userSkipTicket}},
        cold=await send('user_data/confirm',undefined),identity=sequence;
      assert.deepEqual(parse(cold).operations,[refill,expected]);assert.deepEqual(app.store.operations(),queue);
      assert.equal(source.sp_before,target.sp_minimum);
      assert.equal(target.sp_minimum,Math.min(0x7fffffff,target.sp_before+master.playerMaxSP[saved[0].playerStatus.level]));
      assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),nativeBefore);
      assert.deepEqual(app.store.fixedConsumeReceipt(refill),target);assert.deepEqual(app.store.staminaReward(membership),source);
      assert.equal(app.store.hardCurrency(),wallet);
      await rejected(()=>push({},[membership]));
      assert.equal((await send('user_data/pull',{tables:['UserInfo','UserSkipTicket']})).status,200);
      assert.equal((await send('user/login',undefined)).status,200);
      assert.deepEqual(parse(await send('currency/hard/consume',{consumeId:81041001})).operation,refill);
      assert.equal(app.store.hardCurrency(),wallet,'A retained refill does not charge twice');

      const otherLevel=Object.entries(master.playerMaxSP).find(([,capacity])=>capacity!==master.playerMaxSP[saved[0].playerStatus.level]);
      assert.ok(otherLevel,'Original level capacities must contain a differing native target');
      put('UserInfo',saved.map(row=>({...row,playerStatus:{...row.playerStatus,level:Number(otherLevel[0])}})));
      assert.throws(()=>app.store.subscriptionBonusRecovery(membership,[refill]),/native level capacity/);put('UserInfo',saved);
      app.store.db.prepare('UPDATE hard_currency_consume SET sp_minimum=? WHERE operation_id=?').run(target.sp_minimum+1,refill.id);
      assert.throws(()=>app.store.subscriptionBonusRecovery(membership,[refill]),/native level capacity/);
      await rejected(()=>send('user_data/confirm',undefined),503,true);
      app.store.db.prepare('UPDATE hard_currency_consume SET sp_minimum=? WHERE operation_id=?').run(target.sp_minimum,refill.id);
      app.store.db.prepare('UPDATE hard_currency_consume SET iris_cost=iris_cost+1 WHERE operation_id=?').run(refill.id);
      assert.throws(()=>app.store.subscriptionBonusRecovery(membership,[refill]),/purchase\/save receipt/);
      app.store.db.prepare('UPDATE hard_currency_consume SET iris_cost=? WHERE operation_id=?').run(target.iris_cost,refill.id);
      app.store.db.prepare('DELETE FROM hard_currency_consume WHERE operation_id=?').run(refill.id);
      assert.throws(()=>app.store.subscriptionBonusRecovery(membership,[refill]),/purchase\/save receipt/);
      const columns=Object.keys(target);
      app.store.db.prepare(`INSERT INTO hard_currency_consume(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`)
        .run(...columns.map(key=>target[key]));
      assert.deepEqual(app.store.fixedConsumeReceipt(refill),target);assert.deepEqual(app.store.operations(),queue);
      await close();await open({...master,playerMaxSP:{}});
      await rejected(()=>send('user_data/confirm',undefined),503,true);
      await close();await open();
      assert.deepEqual((await request(port,identity,undefined,String(identity),'user_data/confirm')).body,cold.body);

      const info=app.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,baseSP:target.sp_minimum}}));
      const observed=parse(await push({UserInfo:info}));assert.equal(app.store.fixedConsumeReceipt(refill).effect_saved,1);
      assert.ok(!observed.operations.some(row=>row.id===refill.id),'An observed refill is not resent before real ACK');
      await rejected(()=>send('user_data/confirm',undefined),503,true);
      await rejected(()=>send('user_data/pull',{tables:['UserInfo','UserSkipTicket']}),503,true);
      await rejected(()=>send('user/login',undefined),503,true);
      await rejected(()=>send('currency/hard/consume',{consumeId:81041001}),503,true);
      await rejected(()=>request(port,identity,undefined,String(identity),'user_data/confirm'),503,true);
      assert.deepEqual(app.store.operations(),queue);assert.equal(app.store.hardCurrency(),wallet);
      parse(await push({},[refill]));
      const recovered=parse(await send('user_data/confirm',undefined)).operations.find(row=>row.id===membership.id);
      assert.deepEqual(recovered,expected);
      parse(await push(nativeRows(membership),[recovered]));await close();await open();assert.equal(app.store.operations().length,0);
    }

    // WRITTEN ONLY: eight membership-after-observed-pure-gift contexts. Native
    // earning, funding/enrollment, elapsed time and save order are synthetic.
    for(const kind of ['trial','regular']) for(const spState of ['saved','spent']) for(const ticketFirst of [false,true]) {
      await fresh(`member-after-observed-gift-${kind}-${spState}-${ticketFirst}`);
      if(kind==='trial') {await activate(1);await activate(2);} else await regular();
      put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,baseSP:7}})));
      const present={...gift(master.currencies['currency.stamina']),amount:13};put('UserGift',[present]);
      const original=parse(await send('gift/receive',{userId:seed.userId,giftIds:[present.id]})).operation,
        reward=app.store.staminaReward(original),info=app.store.read('UserInfo').data.map(row=>
          ({...row,playerStatus:{...row.playerStatus,baseSP:reward.sp_minimum}}));
      parse(await push({UserInfo:info}));
      if(spState==='spent') parse(await push({UserInfo:info.map(row=>({...row,playerStatus:{...row.playerStatus,baseSP:9}}))}));
      const before=app.store.read('UserInfo').data[0].playerStatus.baseSP,
        profile=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
        membership=parse(await claim()).operation,source=app.store.staminaReward(membership);
      assert.equal(source.sp_before,before);
      assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profile);
      if(ticketFirst) parse(await push({UserSkipTicket:membership.parameters.userSkipTicket}));
      const recoveredGift={...original,parameters:{...original.parameters,receivedItems:[]}},
        recoveredMember={...membership,parameters:{...membership.parameters,
          userSkipTicket:ticketFirst?[]:membership.parameters.userSkipTicket}},queue=app.store.operations(),
        wallet=[app.store.hardCurrency(),app.store.paidCurrency()];
      await close();await open();
      const cold=await send('user_data/confirm',undefined),identity=sequence;
      assert.deepEqual(parse(cold).operations,[recoveredGift,recoveredMember]);assert.deepEqual(app.store.operations(),queue);
      assert.equal(app.store.read('UserInfo').data[0].playerStatus.baseSP,before);
      assert.deepEqual(app.store.staminaReward(membership),source);assert.equal(app.store.staminaReward(original).effect_saved,1);
      assert.equal((await send('user/login',undefined)).status,200);
      assert.equal((await send('user_data/pull',{tables:['UserInfo','UserGift','UserSkipTicket']})).status,200);
      await close();await open();
      assert.deepEqual((await request(port,identity,undefined,String(identity),'user_data/confirm')).body,cold.body);
      await rejected(()=>send('gift/receive',{userId:seed.userId,giftIds:[present.id]}),503,true);
      parse(await push({UserGift:[{...present,state:1}]},[recoveredGift]));
      assert.equal(app.store.read('UserInfo').data[0].playerStatus.baseSP,before,'Gift ACK cannot renew its observed/spent SP');
      assert.deepEqual(parse(await send('user_data/confirm',undefined)).operations,[recoveredMember]);
      await rejected(()=>request(port,identity,undefined,String(identity),'user_data/confirm'),503,true);
      parse(await push(nativeRows(membership),[recoveredMember]));await close();await open();
      assert.deepEqual(app.store.operations(),[]);assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
    }

    // WRITTEN ONLY: eight membership-before-refill contexts exercise both
    // unobserved and already-saved membership SP, without renewing that grant.
    for(const kind of ['trial','regular']) for(const ticketFirst of [false,true]) for(const spFirst of [false,true]) {
      await fresh(`membership-before-refill-${kind}-${ticketFirst}-${spFirst}`);
      if(kind==='trial') {await activate(1);await activate(2);} else await regular();
      put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,baseSP:7}})));
      app.store.changeHardCurrency(100);
      const membership=parse(await claim()).operation,source=app.store.staminaReward(membership);
      if(ticketFirst) parse(await push({UserSkipTicket:membership.parameters.userSkipTicket}));
      if(spFirst) parse(await push({UserInfo:nativeRows(membership).UserInfo}));
      const nativeBefore=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
        refill=parse(await send('currency/hard/consume',{consumeId:81041001})).operation,
        purchase=app.store.fixedConsumeReceipt(refill),queue=app.store.operations(),wallet=[app.store.hardCurrency(),app.store.paidCurrency()];
      assert.equal(purchase.sp_before,source.sp_minimum);
      assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),nativeBefore);
      assert.equal(app.store.staminaReward(membership).effect_saved,spFirst?1:0);
      await close();await open();
      const expected={...membership,parameters:{...membership.parameters,
          gainedBonus:spFirst?membership.parameters.gainedBonus.filter(row=>row.type!==0):membership.parameters.gainedBonus,
          userSkipTicket:ticketFirst?[]:membership.parameters.userSkipTicket}},
        cold=await send('user_data/confirm',undefined),identity=sequence;
      assert.deepEqual(parse(cold).operations,[expected,refill]);assert.deepEqual(app.store.operations(),queue);
      assert.deepEqual(app.store.fixedConsumeReceipt(refill),purchase);
      assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
      assert.equal((await send('user/login',undefined)).status,200);
      assert.equal((await send('user_data/pull',{tables:['UserInfo','UserSkipTicket']})).status,200);
      await close();await open();
      assert.deepEqual((await request(port,identity,undefined,String(identity),'user_data/confirm')).body,cold.body);
      const noEffects=parse(await push({}));assert.ok(!noEffects.operations.some(row=>row.id===refill.id));
      assert.equal(app.store.fixedConsumeReceipt(refill).effect_saved,0);
      parse(await push(nativeRows(membership),[expected]));
      assert.deepEqual(parse(await send('user_data/confirm',undefined)).operations,[refill]);
      await rejected(()=>request(port,identity,undefined,String(identity),'user_data/confirm'),503,true);
      const rows=app.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,baseSP:purchase.sp_minimum}}));
      parse(await push({UserInfo:rows},[refill]));await close();await open();
      assert.equal(app.store.operations().length,0);assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
    }

    // WRITTEN ONLY:64 original XP-prefix contexts. Imported levels, elapsed
    // dispatch, funding, completion flags and callback/save order are synthetic.
    for(const xpKind of ['stage','dispatch']) for(const kind of ['trial','regular']) for(const ticketFirst of [false,true])
      for(const [initialExp,order] of [[99,['xp']],[99,['gift','xp']],[99,['xp','gift']],
        [99,['mission','xp']],[99,['xp','mission']],[99,['refill','xp']],[99,['xp','refill']],
        [master.playerLevels.at(-2)[1],['xp']]]) {
        await fresh(`xp-prefix-${xpKind}-${kind}-${ticketFirst}-${initialExp}-${order.join('-')}`);
        if(kind==='trial') {await activate(1);await activate(2);} else await regular();
        put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,
          baseSP:7,totalExp:initialExp,level:master.playerLevels.findLast(([,threshold])=>threshold<=initialExp)[0]}})));
        if(order.includes('refill')) app.store.changeHardCurrency(100);
        const prefix=[],flags=new Map(),deletes=new Map();let xpOperation,xpTable,xpCapture;
        for(const producer of order) {
          let operation;
          if(producer==='gift') {
            const present={...gift(master.currencies['currency.stamina']),amount:13};put('UserGift',[present]);
            operation=parse(await send('gift/receive',{userId:seed.userId,giftIds:[present.id]})).operations[0];
            flags.set(operation.id,{UserGift:[{...present,state:1}]});
          } else if(producer==='mission') {
            const achievementId=Number(staminaMissions[0][0]),completed={userId:seed.userId,achievementId,completedAt:now,
              lastResetAt:0,progressParam:1,readState:1,signature:0,state:3};put('UserAchievement',[completed]);
            operation=parse(await send('achievement/complete',{achievementIds:[{achievementId,completedAt:now}]})).operations[0];
            flags.set(operation.id,{UserAchievement:[{...completed,state:4}]});
          } else if(producer==='refill') {
            operation=parse(await send('currency/hard/consume',{consumeId:81041001})).operation;
            const level=xpOperation?master.playerLevels.findLast(([,threshold])=>threshold<=xpCapture.minimum_exp)[0]:
              app.store.read('UserInfo').data[0].playerStatus.level,receipt=app.store.fixedConsumeReceipt(operation);
            assert.equal(receipt.sp_minimum,Math.min(0x7fffffff,receipt.sp_before+master.playerMaxSP[level]));
            assert.equal(receipt.iris_cost,master.consumes[81041001].amount);flags.set(operation.id,{});
          } else if(xpKind==='stage') {
            operation=parse(await send('adventure/stage/complete',{adventureStageId:1010000101101,
              token:'membership-xp',adventureStageTaskIds:[],adventureGainedItems:[],friendshipStates:[],
              adventureRecord:{continueCount:0,deathCount:0,turnCount:3},isEnemyAnnihilated:true,secretMissionCompleted:false})).operation;
            const before=operation.parameters.UserAdventureStage[0],rows={UserAdventureStage:[{...before,state:4,
              cumulativeClearCount:before.cumulativeClearCount+Math.max(1,operation.parameters.skipCount),
              firstCompleteDateTime:before.firstCompleteDateTime || now,lastCompleteDateTime:now}]},
              receipt=app.store.db.prepare('SELECT next_unlock FROM stage_delivery WHERE operation_id=?').get(operation.id),
              target=receipt.next_unlock?JSON.parse(receipt.next_unlock):null;
            if(target?.stageId && [null,0].includes(target.beforeState) && target.lowerStates.every(([,state])=>state===4))
              rows.UserAdventureStage.push({...app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===target.stageId),
                userId:seed.userId,adventureStageId:target.stageId,state:1});
            for(const item of app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(operation.id))
              (rows[item.table_name] ??= []).push({...app.store.read(item.table_name).data.find(row=>row[item.id_field]===item.item_id),
                userId:seed.userId,[item.id_field]:item.item_id,amount:0,cumulativeAmount:item.cumulative_amount});
            flags.set(operation.id,rows);xpOperation=operation;xpTable='stage_xp_claim';
          } else {
            const id=707000001,original=master.expeditionStages[id],started={userId:seed.userId,expeditionStageId:id,
              completionState:3,dispatchState:1,startAt:now-original.duration,cumulativeClearCount:0,otherClearCount:0,
              firstTryDateTime:now-original.duration,firstCompleteDateTime:0,lastTryDateTime:now-original.duration,lastCompleteDateTime:0};
            put('UserExpeditionStage',[...app.store.read('UserExpeditionStage').data.filter(row=>row.expeditionStageId!==id),started]);
            put('UserExpeditionParty',[{userId:seed.userId,expeditionStageId:id,slots:Array.from({length:4},(_,i)=>({
              slotNumber:i+1,pcId:i?0:seed.data.UserPC[0].pcId,assistingPcId:0}))}]);
            const entries=app.store.expeditionPartyEntries(id),hero=app.store.read('UserInfo').data[0].heroType,
              field=['friendship','friendshipAis','friendshipLef'][hero];
            operation=parse(await send('expedition/complete',{expeditionStageId:id,
              totalLevel:entries.reduce((sum,row)=>sum+row.level,0),totalStatus:entries.reduce((sum,row)=>sum+(row.status ?? 1),0),
              entryPcs:entries.map(({characterId,level,status=1})=>({characterId,level,status})),
              friendshipStates:entries.map(({characterId})=>{
                const friendship=app.store.read('UserCharacter').data.find(row=>row.characterId===characterId)?.[field] ?? 0;
                return {characterId,friendship,friendshipLv:master.characters[characterId].levels.findLast(([,points])=>points<=friendship)[0],userHeroType:hero};
              })})).operations[0];
            flags.set(operation.id,{...itemDeltas(app.store,operation),UserExpeditionStage:[
              expeditionCompletionStage(started,operation.parameters.drawStatus,master)],
              UserCharacter:operation.parameters.friendshipStates.map(state=>({
                ...(app.store.read('UserCharacter').data.find(row=>row.characterId===state.characterId) ??
                  {userId:0,characterId:state.characterId,characterState:1,friendship:0,friendshipAis:0,friendshipLef:0,
                    substitutedPcSpineId:0,signature:0xffffffff}),[field]:state.friendship}))});
            deletes.set(operation.id,{UserExpeditionParty:[{expeditionStageId:id}]});
            xpOperation=operation;xpTable='expedition_xp_claim';
          }
          prefix.push(operation);
          if(operation===xpOperation) xpCapture=app.store.db.prepare(`SELECT * FROM ${xpTable} WHERE operation_id=?`).get(operation.id);
        }
        assert.ok(xpCapture.minimum_exp>xpCapture.before_exp);
        assert.equal(app.store.read('UserInfo').data[0].playerStatus.totalExp,initialExp,'Queued EXP is not precredited');
        if(initialExp===99) assert.ok(xpCapture.sp_amount>0);else assert.equal(xpCapture.sp_amount,0);
        const membership=parse(await claim()).operation,source=app.store.staminaReward(membership),queue=app.store.operations(),
          before=app.store.read('UserInfo').data,wallet=[app.store.hardCurrency(),app.store.paidCurrency()];
        let reserved=7;
        for(const operation of prefix) {
          const reward=operation.type===10200?app.store.fixedConsumeReceipt(operation):app.store.staminaReward(operation);
          if(reward) {assert.equal(reward.sp_before,reserved);reserved=reward.sp_minimum;}
        }
        assert.equal(source.sp_before,reserved);
        if(ticketFirst) parse(await push({UserSkipTicket:membership.parameters.userSkipTicket}));
        await close();await open();
        const nativeBefore=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
          expected={...membership,parameters:{...membership.parameters,userSkipTicket:ticketFirst?[]:membership.parameters.userSkipTicket}},
          cold=await send('user_data/confirm',undefined),identity=sequence;
        assert.deepEqual(parse(cold).operations,[...prefix,expected]);assert.deepEqual(app.store.operations(),queue);
        assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),nativeBefore);
        assert.deepEqual(app.store.db.prepare(`SELECT * FROM ${xpTable} WHERE operation_id=?`).get(xpOperation.id),xpCapture);
        assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
        if(order.join('-')==='xp-refill') {
          const refill=prefix.find(row=>row.type===10200),receipt=app.store.fixedConsumeReceipt(refill);
          app.store.db.prepare('UPDATE hard_currency_consume SET sp_minimum=? WHERE operation_id=?')
            .run(Math.min(0x7fffffff,receipt.sp_before+master.playerMaxSP[before[0].playerStatus.level]),refill.id);
          assert.throws(()=>app.store.subscriptionBonusRecovery(membership,prefix),/native level capacity/);
          await rejected(()=>send('user_data/confirm',undefined),503,true);
          app.store.db.prepare('UPDATE hard_currency_consume SET sp_minimum=? WHERE operation_id=?').run(receipt.sp_minimum,refill.id);
          assert.deepEqual(app.store.fixedConsumeReceipt(refill),receipt);
          assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
        }
        app.store.db.prepare(`UPDATE ${xpTable} SET before_exp=before_exp+1,minimum_exp=minimum_exp+1 WHERE operation_id=?`).run(xpOperation.id);
        assert.throws(()=>app.store.subscriptionBonusRecovery(membership,prefix),/ordered unsaved player experience|experience.*receipt|level-up stamina/);
        app.store.db.prepare(`UPDATE ${xpTable} SET before_exp=?,minimum_exp=? WHERE operation_id=?`)
          .run(xpCapture.before_exp,xpCapture.minimum_exp,xpOperation.id);
        put('UserInfo',before.map(row=>({...row,playerStatus:{...row.playerStatus,totalExp:initialExp-1,
          level:master.playerLevels.findLast(([,threshold])=>threshold<=initialExp-1)[0]}})));
        assert.throws(()=>app.store.subscriptionBonusRecovery(membership,prefix),/ordered unsaved player experience/);
        if(!prefix.some(row=>row.type===10200))
          await rejected(()=>send('currency/hard/consume',{consumeId:81041001}),503,true);
        put('UserInfo',before);
        app.store.db.prepare(`DELETE FROM ${xpTable} WHERE operation_id=?`).run(xpOperation.id);
        assert.throws(()=>app.store.subscriptionBonusRecovery(membership,prefix),/capture|baseline|receipt/);
        if(!prefix.some(row=>row.type===10200))
          await rejected(()=>send('currency/hard/consume',{consumeId:81041001}),503,true);
        const columns=Object.keys(xpCapture);
        app.store.db.prepare(`INSERT INTO ${xpTable}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`)
          .run(...columns.map(key=>xpCapture[key]));
        await rejected(()=>push({},[membership]));
        assert.equal((await send('user_data/pull',{tables:['UserInfo','UserSkipTicket']})).status,200);
        assert.equal((await send('user/login',undefined)).status,200);
        await close();await open();
        assert.deepEqual((await request(port,identity,undefined,String(identity),'user_data/confirm')).body,cold.body);
        for(const operation of prefix) {
          const reward=operation.type===10200?app.store.fixedConsumeReceipt(operation):app.store.staminaReward(operation),
            users=app.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,
              baseSP:reward?.sp_minimum ?? row.playerStatus.baseSP,...(operation===xpOperation?{totalExp:xpCapture.minimum_exp,
                level:master.playerLevels.findLast(([,threshold])=>threshold<=xpCapture.minimum_exp)[0]}:{})}})),
            rows={...flags.get(operation.id),UserInfo:users},native=operation===xpOperation && xpKind==='dispatch'?
              friendshipUnlockFixture(app.store,rows,[operation]):rows;
          parse(await push(native,[operation],deletes.get(operation.id) ?? {}));
          assert.deepEqual(parse(await send('user_data/confirm',undefined)).operations,
            app.store.operations().map(row=>row.id===membership.id?expected:row));
        }
        await rejected(()=>request(port,identity,undefined,String(identity),'user_data/confirm'),503,true);
        parse(await push(nativeRows(membership),[expected]));await close();await open();
        assert.equal(app.store.operations().length,0);
        assert.equal(app.store.read('UserInfo').data[0].playerStatus.totalExp,xpCapture.minimum_exp);
        assert.equal(app.store.read('UserInfo').data[0].playerStatus.baseSP,source.sp_minimum);
      }

    await fresh('expired-regular'); const expired=await regular([1]); now=expired[0].end_at+86400;
    const earned=parse(await claim()).operation;
    assert.deepEqual(earned.parameters.displayBonus,[],'Expired membership does not grant daily SP/skip');
    assert.equal(earned.parameters.displayExtendBonus.length,2,'Own offline policy retains unclaimed renewal entitlements');
    assert.equal(app.store.staminaReward(earned),null);
    parse(await push(nativeRows(earned),[earned])); assert.deepEqual(parse(await claim()),empty);

    for (const first of ['gift','membership']) {
      await fresh(`dated-order-${first}`); await regular([1]); put('UserGift',[gift(296000015)]);
      if (first==='gift') {
        parse(await send('gift/receive',{ userId:seed.userId,giftIds:[1] }));
        await rejected(()=>claim());
      } else {
        parse(await claim());
        await rejected(()=>send('gift/receive',{ userId:seed.userId,giftIds:[1] }));
      }
    }
    for (const [point,sql] of [
      ['claim',"CREATE TRIGGER fail_bonus BEFORE INSERT ON subscription_bonus_claim BEGIN SELECT RAISE(ABORT,'claim rollback'); END"],
      ['daily',"CREATE TRIGGER fail_bonus BEFORE INSERT ON subscription_daily_claim BEGIN SELECT RAISE(ABORT,'day rollback'); END"],
      ['item',"CREATE TRIGGER fail_bonus BEFORE INSERT ON pve_item_claim BEGIN SELECT RAISE(ABORT,'item rollback'); END"],
      ['reply',"CREATE TRIGGER fail_bonus BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'reply rollback'); END"],
    ]) {
      await fresh(`issue-${point}`); await regular([1]); app.store.db.exec(sql);
      await rejected(()=>claim(),503); app.store.db.exec('DROP TRIGGER fail_bonus');
      assert.equal(app.store.operations().length,0);
      const issued=parse(await claim()).operation;
      const targets=nativeRows(issued);
      for (const trigger of [
        "CREATE TRIGGER fail_save BEFORE UPDATE ON profile BEGIN SELECT RAISE(ABORT,'profile rollback'); END",
        "CREATE TRIGGER fail_save BEFORE INSERT ON subscription_bonus_stock_floor BEGIN SELECT RAISE(ABORT,'floor rollback'); END",
        "CREATE TRIGGER fail_save BEFORE UPDATE OF observed ON subscription_bonus_claim BEGIN SELECT RAISE(ABORT,'observation rollback'); END",
      ]) {
        app.store.db.exec(trigger); await rejected(()=>push(targets,[issued]),503); app.store.db.exec('DROP TRIGGER fail_save');
      }
      parse(await push(targets,[issued]));
    }
    await fresh('missing-entitlement'); const regularMember=(await regular([1]))[0];
    app.store.db.prepare('DELETE FROM subscription_monthly_entitlement WHERE purchase_id=?').run(regularMember.purchase_id);
    await rejected(()=>claim(),503,true);
    await fresh('legacy'); put('UserSubscriptionBonus',[{ userId:seed.userId,subscriptionId:1301000001,
      purchaseStartAt:now,expireAt:now+86400,lastReceivedAt:0,lastReceivedDay:0,dynamodbExpireAt:0 }]);
    await rejected(()=>claim(),503,true);
    await fresh('metadata'); await activate(1); await close();
    await open({ ...master,skipTickets:{} }); await rejected(()=>claim(),503,true);
    console.log('Local membership reward fixtures completed; native acceptance and additional interleavings remain pending');
  } finally {
    await close(); const resolved=path.resolve(root),expected=path.resolve(process.cwd(),'.work');
    assert.equal(path.dirname(resolved),expected); assert.ok(path.basename(resolved).startsWith('subscription-bonus-test-'));
    fs.rmSync(resolved,{ recursive:true,force:true });
  }
}
if (require.main===module) main().catch(error=>{ console.error(error);process.exitCode=1; });
