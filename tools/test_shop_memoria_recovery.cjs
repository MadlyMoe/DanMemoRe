'use strict';

// DEFERRED / NOT RUN. Synthetic cost stock, cards, product fields and save
// ordering are not native purchase, constructor or no-crash gameplay proof.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE,encodeMsgpack}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json');
const master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-shop-card-cold-'));
  let app,database,port,sequence=0,now=Math.floor(Date.now()/1000);
  const close=async()=>{if(app){await app.close();app=null;}};
  const open=async()=>{
    app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const fresh=async name=>{await close();database=path.join(directory,`${name}.sqlite`);await open();};
  const send=(action,body)=>request(port,++sequence,body,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const rows=name=>app.store.read(name).data;
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const retained=()=>JSON.stringify(['profile','operation_queue','operation_done','shop_request','shop_item_claim','shop_spend',
    'achievement_pc_delivery','achievement_reward_state','achievement_memoria_floor','hard_currency'].map(name=>
    [name,app.store.db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()]));
  const reject=async(pending,status=503,raw=false)=>{
    const before=snapshot(),reply=await pending;assert.equal(reply.status,status,reply.body.toString());assert.equal(snapshot(),before);
    if(status===503) raw?assert.equal(reply.body.length,0):assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const push=(putItems={},operations=[],trigger='EventShopBuy')=>send('user_data/push',{badges:null,scripts:{},dataTokens:{},
    checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,value])=>[name,md5(value)]))},
    deltas:Object.keys(putItems).length?[{signature:0,trigger,putItems,deleteItems:{}}]:[],
    operations:operations.map(row=>({id:row.id,verifier:row.token}))});
  try {
    const all=Object.entries(master.shopProducts).filter(([,product])=>product.rewardType===5),
      active=all.filter(([,product])=>!product.endAt),closed=all.filter(([,product])=>product.endAt===product.startAt && product.endAt>0);
    assert.equal(all.length,34);assert.equal(active.length,30);assert.equal(closed.length,4);
    //90 NEW WRITTEN ONLY contexts: all30 authored active exchanges and three
    // first saves, rotating absent/owned0/owned5000, lazy product rows and ACK orders.
    for(const [index,[id,product]] of active.entries()) for(const first of ['count','date','card']) {
      now=Math.max(now,product.startAt);await fresh(`${id}-${first}`);
      assert.equal(product.amount,1);assert.equal(product.limit,1);assert.equal(product.limitType,0);assert.equal(product.priceType,2);
      const profile=master.itemProfiles[product.priceItemId],value={shopProductId:Number(id)},
        card={userId:index%2?seed.userId:0,memoriaId:product.rewardId,totalExp:index%3===2?5000:0,signature:0},
        beforeCard=index%3?[card]:[],beforeProduct={userId:seed.userId,shopProductId:Number(id),count:0,lastExchangedAt:0,readState:1},
        otherProducts=rows('UserShopProduct').filter(row=>row.shopProductId!==Number(id)),
        cost={userId:seed.userId,[profile.idField]:product.priceItemId,amount:product.price,cumulativeAmount:product.price,
          bookEntryState:3,lastResetAt:0,signature:0};
      put('UserMemoria',beforeCard);put('UserShopProduct',index%2?[...otherProducts,beforeProduct]:otherProducts);
      put(profile.table,[cost]);parse(await push({[profile.table]:[{...cost,amount:0}]}));
      const wallet=[app.store.hardCurrency(),app.store.paidCurrency()],
        bought=parse(await send('shop/buy',value)),identity=sequence,[award,purchase]=bought.operations;
      assert.deepEqual(bought.operations.map(row=>row.type),[6000,9000]);
      assert.deepEqual(award.parameters.receivedMemorias,[{memoriaId:card.memoriaId,level:1}]);
      for(const key of ['boughtItems','boughtCostumes','boughtEquipments']) assert.deepEqual(purchase.parameters[key],[]);
      const target={...beforeProduct,count:purchase.parameters.count,lastExchangedAt:purchase.parameters.lastExchangedAt},
        acquired={...card,signature:beforeCard.length?card.signature:award.signature},
        checkpoint=first==='card'?{UserMemoria:[acquired]}:{UserShopProduct:[{...beforeProduct,
          ...(first==='count'?{count:target.count}:{lastExchangedAt:target.lastExchangedAt})}]};
      parse(await push(checkpoint));await close();await open();
      const cardSaved=rows('UserMemoria').some(row=>row.memoriaId===card.memoriaId),
        recovered={...award,parameters:{...award.parameters,receivedMemorias:cardSaved?[]:award.parameters.receivedMemorias}},
        source=retained(),cold=await send('user_data/confirm'),coldIdentity=sequence;
      assert.deepEqual(parse(cold).operations,[recovered,purchase]);assert.equal(retained(),source);
      parse(await send('user/login'));
      const tables=['UserMemoria','UserShopProduct',profile.table],pulled=await send('user_data/pull',{tables});
      assert.equal(pulled.status,200);assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull({tables})));
      assert.deepEqual(app.store.operations(),[award,purchase]);assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
      assert.deepEqual(rows(profile.table).filter(row=>row[profile.idField]===product.priceItemId),[{...cost,amount:0}]);
      await close();await open();assert.deepEqual((await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm')).body,cold.body);
      if(first!=='card' || !beforeCard.length) {
        await reject(send('shop/buy',value));await reject(request(port,identity,value,String(identity),'shop/buy'));
      } else assert.deepEqual(parse(await send('shop/buy',value)).operations,[award,purchase]);
      await reject(push({},[purchase]),400);if(!cardSaved) await reject(push({},[award]),400);
      if(!index) {
        const receipt=app.store.db.prepare('SELECT * FROM shop_request WHERE operation_id=?').get(purchase.id);
        for(const [column,bad] of [['before_shop',null],['operation_json','{}'],['reward_operation_id',purchase.id],['rewards','[]'],['spend_id',0]]) {
          app.store.db.prepare(`UPDATE shop_request SET ${column}=? WHERE operation_id=?`).run(bad,purchase.id);
          await reject(send('user_data/confirm'));await reject(send('user/login'));
          app.store.db.prepare(`UPDATE shop_request SET ${column}=? WHERE operation_id=?`).run(receipt[column],purchase.id);
        }
        const originalProducts=structuredClone(rows('UserShopProduct')),
          changed={...target,count:target.count+1};put('UserShopProduct',[...otherProducts,changed]);
        await reject(send('user_data/confirm'));put('UserShopProduct',originalProducts);
        await reject(push({UserShopProduct:[changed]}),400);
        await reject(push({UserShopProduct:[{...target,lastExchangedAt:target.lastExchangedAt+1}]}),400);
      }
      const grown={...acquired,totalExp:acquired.totalExp+7,signature:(award.signature+1)>>>0};
      if(!cardSaved) parse(await push({UserMemoria:[acquired]}));
      parse(await push({UserMemoria:[grown]})); // Growth after actual acquisition must survive recovery.
      parse(await push({UserShopProduct:[target]}));await close();await open();
      const observed={...award,parameters:{...award.parameters,receivedMemorias:[]}};
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[observed,purchase]);
      assert.deepEqual(rows('UserMemoria'),[grown]);assert.deepEqual(app.store.operations(),[award,purchase]);
      for(const [table,event] of [['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_shop_card_cold_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'shop card cold ACK rollback'); END`);
        await reject(push({},[observed,purchase]),503,true);app.store.db.exec('DROP TRIGGER fail_shop_card_cold_ack');
      }
      if(index%3===2) parse(await push({},[observed,purchase]));
      else {
        const firstAck=index%3?purchase:observed,second=firstAck.type===9000?observed:purchase;
        parse(await push({},[firstAck]));await close();await open();
        if(index===1) {
          const expenditure=app.store.db.prepare('SELECT * FROM shop_spend WHERE operation_id=?').get(purchase.id);
          app.store.db.prepare('UPDATE shop_spend SET operation_id=NULL WHERE id=?').run(expenditure.id);
          await reject(send('user_data/confirm'));await reject(send('user/login'));
          app.store.db.prepare('UPDATE shop_spend SET operation_id=? WHERE id=?').run(purchase.id,expenditure.id);
        }
        assert.deepEqual(parse(await send('user_data/confirm')).operations,[second]);parse(await push({},[second]));
      }
      await close();await open();assert.deepEqual(app.store.operations(),[]);assert.deepEqual(rows('UserMemoria'),[grown]);
      assert.equal(app.store.db.prepare('SELECT minimum_exp FROM achievement_memoria_floor WHERE memoria_id=?').get(card.memoriaId).minimum_exp,grown.totalExp);
      assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);await reject(send('shop/buy',value),400);
      await reject(push({UserMemoria:[acquired]}),400);
      await reject(push({UserShopProduct:[beforeProduct]}),400);
    }
    console.log('SOURCE ONLY shop Memoria cold recovery:90 deferred contexts/all30 active exchanges; native acceptance pending');
  } finally {
    await close();const resolved=fs.realpathSync(directory);
    assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('danmemore-shop-card-cold-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
