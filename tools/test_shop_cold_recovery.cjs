'use strict';

// DEFERRED / NOT RUN. Synthetic stock, paid funding and saved fields do not
// prove native earning, purchase callbacks, signatures or no-crash gameplay.
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
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-shop-cold-'));
  let app,database,port,sequence=0,now;
  const close=async()=>{if(app){await app.close();app=null;}};
  const open=async()=>{
    app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const send=(action,body)=>request(port,++sequence,body,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const rows=name=>app.store.read(name).data;
  const put=(name,value)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(value),md5(value),name);
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const retained=()=>JSON.stringify(['profile','operation_queue','operation_done','shop_request','shop_item_claim','shop_spend',
    'shop_item_stock_floor','familia_valis_spending_floor','hard_currency'].map(name=>[name,app.store.db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()]));
  const reject=async(pending,status=503,raw=false)=>{
    const before=snapshot(),reply=await pending;assert.equal(reply.status,status,reply.body.toString());assert.equal(snapshot(),before);
    if(status===503) raw?assert.equal(reply.body.length,0):assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const push=(putItems={},operations=[])=>send('user_data/push',{badges:null,scripts:{},dataTokens:{},
    checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,value])=>[name,md5(value)]))},
    deltas:Object.keys(putItems).length?[{signature:0,trigger:'EventShopBuy',putItems,deleteItems:{}}]:[],
    operations:operations.map(operation=>({id:operation.id,verifier:operation.token}))});
  const gift=(id,itemId)=>({userId:seed.userId,id,itemId,amount:1,title:'Deferred synthetic source',message:'',
    senderType:1,senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,
    pcLimitBreakCount:0,pcHeroSublimateCount:0,state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0});
  try {
    //96 WRITTEN ONLY: earlier64 crossing/saturated plus32 owned ordinary baselines;
    // count/date/one-item/all-item first saves. Bundle207000797 has eight grants.
    for(const productId of [207000047,207000258,207000041,207001358,207000033,207001506,207000797,207000008])
      for(const baselineKind of ['crossing','saturated','ordinary']) for(const first of ['count','date','one-item','all-items']) {
        const product=master.shopProducts[productId];now=product.startAt || 1571400000;
        await close();database=path.join(directory,`${productId}-${baselineKind}-${first}.sqlite`);await open();
        const contents=product.rewardType===2?master.shopPacks[product.rewardId].contents:
          [{type:product.rewardType,rewardId:product.rewardId,amount:product.amount}],amounts=new Map();
        for(const content of contents) {
          assert.equal(content.type,0);amounts.set(content.rewardId,(amounts.get(content.rewardId)||0)+content.amount*(product.rewardType===2?product.amount:1));
        }
        const before=new Map(),profileTables=new Set();
        for(const [id,quantity] of amounts) {
          const profile=master.itemProfiles[id],dated=profile.table==='UserGachaTicket',
            cumulativeAmount=baselineKind==='crossing'?999999999-quantity:baselineKind==='ordinary'?100:999999999,
            item={userId:seed.userId,[profile.idField]:id,cumulativeAmount,signature:0xffffffff,bookEntryState:dated?-128:255,
              ...(dated?{dateList:[{aquiredAt:Math.max(0,now-master.lotteryTickets[id]-1)}]}:
                {amount:baselineKind==='saturated' && first==='all-items'?999999999:7,reservedAmount:0})};
          assert.ok(dated || ['UserStatusBoardItem','UserCpItem','UserExpItem','UserEquipmentMaterial'].includes(profile.table));
          if(dated) assert.ok(master.lotteryTickets[id]>0);
          before.set(id,item);profileTables.add(profile.table);
        }
        for(const table of profileTables) put(table,[...rows(table).filter(row=>![...before].some(([id])=>
          master.itemProfiles[id].table===table && row[master.itemProfiles[id].idField]===id)),
          ...[...before].filter(([id])=>master.itemProfiles[id].table===table).map(([,item])=>item)]);
        const beforeProduct={userId:seed.userId,shopProductId:productId,count:product.limitType===3?7:0,
          lastExchangedAt:product.limitType===3?now-40*86400:0,readState:1},
          otherProducts=rows('UserShopProduct').filter(row=>row.shopProductId!==productId),value={shopProductId:productId};
        put('UserShopProduct',product.limitType===3 || first==='date'?[...otherProducts,beforeProduct]:otherProducts);
        let cost;
        if(product.priceType===2) {
          const profile=master.itemProfiles[product.priceItemId];assert.ok(['UserEventItem','UserCurrency'].includes(profile.table));
          cost={userId:seed.userId,[profile.idField]:product.priceItemId,amount:product.price,cumulativeAmount:product.price,signature:0,
            ...(profile.table==='UserCurrency'?{reservedAmount:0}:{bookEntryState:3})};
          put(profile.table,[...rows(profile.table).filter(row=>row[profile.idField]!==product.priceItemId),cost]);
          parse(await push({[profile.table]:[{...cost,amount:0}]}));
        } else {assert.equal(product.priceType,1);app.store.changePaidCurrency(product.price+100,'Deferred fixture funding');}
        const funded=[app.store.hardCurrency(),app.store.paidCurrency()],bought=parse(await send('shop/buy',value)),hotIdentity=sequence,
          operation=bought.operation,target={...beforeProduct,count:bought.count,lastExchangedAt:bought.lastExchangedAt},
          wallet=[funded[0],funded[1]-(product.priceType===1?product.price:0)],acquired=new Map();
        assert.equal(operation.type,9000);assert.deepEqual(bought.operations,[operation]);
        if(product.limitType===3) assert.equal(bought.count,1,'Original monthly projection may lower captured count7 to1');
        for(const [id,item] of before) {
          const quantity=amounts.get(id),dated=master.itemProfiles[id].table==='UserGachaTicket';
          const claim=app.store.db.prepare('SELECT * FROM shop_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,id),
            state=JSON.parse(claim.stock_state??claim.gacha_state),policy=`offline-shop-${dated?'gacha':'stock'}-${baselineKind==='ordinary'?'v2':'cap-v1'}`;
          assert.equal(claim.cap_version,1);assert.equal(state.policy,policy);assert.equal(state.beforeCumulative,item.cumulativeAmount);
          assert.equal(state.beforeSignature,item.signature);assert.notEqual(operation.signature,item.signature);
          const proof=JSON.parse(app.store.db.prepare('SELECT rewards FROM shop_request WHERE operation_id=?').get(operation.id).rewards).find(row=>row.id===id);
          assert.equal(proof.capturePolicy,baselineKind==='ordinary'?policy:undefined);
          acquired.set(id,{...item,cumulativeAmount:Math.min(999999999,item.cumulativeAmount+quantity),signature:operation.signature,
            ...(dated?{dateList:Array.from({length:quantity},()=>({aquiredAt:now}))}:{amount:Math.min(999999999,item.amount+quantity)})});
        }
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM shop_item_stock_floor').get().n,0,'Issue never writes a completed checkpoint');
        const savedIds=first==='all-items'?[...amounts.keys()]:first==='one-item'?[[...amounts.keys()][0]]:[],
          items=ids=>{
            const putItems={};for(const id of ids) {const table=master.itemProfiles[id].table;(putItems[table]??=[]).push(acquired.get(id));}return putItems;
          },partial=savedIds.length?items(savedIds):{UserShopProduct:[{...beforeProduct,
            ...(first==='count'?{count:target.count}:{lastExchangedAt:target.lastExchangedAt})}]};
        parse(await push(partial));await close();await open();
        const recovered={...operation,parameters:{...operation.parameters,boughtItems:operation.parameters.boughtItems.filter(row=>!savedIds.includes(row.itemId))}},
          source=retained(),cold=await send('user_data/confirm'),identity=sequence;
        assert.deepEqual(parse(cold).operations,[recovered]);assert.equal(retained(),source);
        parse(await send('user/login'));
        const tables=[...profileTables,'UserShopProduct'],pulled=await send('user_data/pull',{tables});
        assert.equal(pulled.status,200);assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull({tables})));assert.equal(retained(),source);
        await close();await open();assert.deepEqual((await request(port,identity,undefined,String(identity),'user_data/confirm')).body,cold.body);
        assert.deepEqual(app.store.operations(),[operation]);assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
        if(cost) {
          const profile=master.itemProfiles[product.priceItemId];assert.deepEqual(rows(profile.table).find(row=>row[profile.idField]===product.priceItemId),{...cost,amount:0});
        }
        await reject(send('shop/buy',value));await reject(request(port,hotIdentity,value,String(hotIdentity),'shop/buy'));
        await reject(push({},[recovered]),400);
        if(baselineKind==='ordinary' && first==='count' && [207000047,207000033].includes(productId)) {
          const gifts=[gift(1,product.rewardId),gift(2,215000001)];put('UserGift',gifts);
          await reject(send('gift/receive',{userId:seed.userId,giftIds:[1]}));
          const other=parse(await send('gift/receive',{userId:seed.userId,giftIds:[2]})).operations[0],profile=master.itemProfiles[215000001],
            previous=rows(profile.table).find(row=>row[profile.idField]===215000001),
            item={...(previous??{userId:seed.userId,cpItemId:215000001,amount:0,cumulativeAmount:0,bookEntryState:255,reservedAmount:0}),
              amount:(previous?.amount??0)+1,cumulativeAmount:(previous?.cumulativeAmount??0)+1,signature:other.signature};
          parse(await push({UserGift:[{...gifts[1],state:1}],[profile.table]:[item]},[other]));
          assert.deepEqual(app.store.operations(),[operation],'Unrelated original item producer does not close or block the shop receipt');
        }
        if(productId===207000047 && baselineKind==='crossing' || [207000047,207000033].includes(productId) && baselineKind==='ordinary' && first==='count') {
          const receipt=app.store.db.prepare('SELECT * FROM shop_request WHERE operation_id=?').get(operation.id);
          for(const [column,bad] of [['before_shop',null],['operation_json','{}'],['observed','["unbound"]'],['rewards','[]']]) {
            app.store.db.prepare(`UPDATE shop_request SET ${column}=? WHERE operation_id=?`).run(bad,operation.id);
            await reject(send('user_data/confirm'));await reject(send('user/login'));
            app.store.db.prepare(`UPDATE shop_request SET ${column}=? WHERE operation_id=?`).run(receipt[column],operation.id);
          }
          const item=app.store.db.prepare('SELECT * FROM shop_item_claim WHERE operation_id=?').get(operation.id);
          const column=item.stock_state!==null?'stock_state':'gacha_state';
          for(const change of [{[column]:null},{cap_version:0},{cap_version:0,[column]:null},
            ...(baselineKind==='ordinary'?[{[column]:JSON.stringify({...JSON.parse(item[column]),
              policy:column==='stock_state'?'offline-shop-stock-cap-v1':'offline-shop-gacha-cap-v1'})}]:[])]) {
            app.store.db.prepare(`UPDATE shop_item_claim SET ${Object.keys(change).map(key=>`${key}=?`).join(',')} WHERE operation_id=?`)
              .run(...Object.values(change),operation.id);
            await reject(send('user_data/confirm'));
            app.store.db.prepare('UPDATE shop_item_claim SET cap_version=?,stock_state=?,gacha_state=? WHERE operation_id=?')
              .run(item.cap_version,item.stock_state,item.gacha_state,operation.id);
          }
          if(baselineKind==='ordinary') {
            const proofs=JSON.parse(receipt.rewards);
            for(const change of [proofs.map(({capturePolicy,...proof})=>proof),proofs.map(proof=>({...proof,capturePolicy:'unbound'}))]) {
              app.store.db.prepare('UPDATE shop_request SET rewards=? WHERE operation_id=?').run(JSON.stringify(change),operation.id);
              await reject(send('user_data/confirm'));
              app.store.db.prepare('UPDATE shop_request SET rewards=? WHERE operation_id=?').run(receipt.rewards,operation.id);
            }
            // Coherent local receipt edits are not a replacement for the original authored quantity1.
            const altered=structuredClone(operation);altered.parameters.boughtItems[0].amount++;
            const state=JSON.parse(item[column]),cumulative=state.beforeCumulative+altered.parameters.boughtItems[0].amount,
              capture=column==='stock_state'?{...state,amount:state.beforeAmount+altered.parameters.boughtItems[0].amount}:state;
            app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(altered.parameters),operation.id);
            app.store.db.prepare('UPDATE shop_request SET operation_json=?,rewards=? WHERE operation_id=?')
              .run(JSON.stringify(altered),JSON.stringify(proofs.map(proof=>({...proof,cumulative}))),operation.id);
            app.store.db.prepare(`UPDATE shop_item_claim SET amount=?,cumulative_amount=?,${column}=? WHERE operation_id=?`)
              .run(altered.parameters.boughtItems[0].amount,cumulative,JSON.stringify(capture),operation.id);
            await reject(send('user_data/confirm'));await reject(send('user/login'));
            app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(operation.parameters),operation.id);
            app.store.db.prepare('UPDATE shop_request SET operation_json=?,rewards=? WHERE operation_id=?').run(receipt.operation_json,receipt.rewards,operation.id);
            app.store.db.prepare(`UPDATE shop_item_claim SET amount=?,cumulative_amount=?,${column}=? WHERE operation_id=?`)
              .run(item.amount,item.cumulative_amount,item[column],operation.id);
          }
          const expenditure=app.store.db.prepare('SELECT * FROM shop_spend WHERE operation_id=?').get(operation.id);
          for(const [column,bad] of [['operation_id',null],['amount',expenditure.amount+1],
            ['before_cumulative',expenditure.before_cumulative+1],['table_name','UserCurrency']]) {
            app.store.db.prepare(`UPDATE shop_spend SET ${column}=? WHERE id=?`).run(bad,expenditure.id);
            await reject(send('user_data/confirm'));await reject(send('user/login'));
            app.store.db.prepare(`UPDATE shop_spend SET ${column}=? WHERE id=?`).run(expenditure[column],expenditure.id);
          }
        }
        if(product.limitType===3 && first==='date') {
          parse(await push(items([...amounts.keys()])));
          // An old higher count is not proof that native reset count1 was saved.
          await reject(push({},[operation]),400);
          assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,parameters:{...operation.parameters,boughtItems:[]}}]);
        }
        parse(await push({...items([...amounts.keys()].filter(id=>!savedIds.includes(id))),UserShopProduct:[target]}));
        for(const [id,item] of acquired) acquired.set(id,{...item,...(master.itemProfiles[id].table==='UserGachaTicket'?{dateList:[]}:{amount:0})});
        parse(await push(items([...amounts.keys()])));await close();await open();
        await reject(request(port,identity,undefined,String(identity),'user_data/confirm'));
        const observed={...operation,parameters:{...operation.parameters,boughtItems:[]}},held=retained();
        assert.deepEqual(parse(await send('user_data/confirm')).operations,[observed]);assert.equal(retained(),held);
        for(const [table,event] of [['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER fail_shop_cold_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'shop cold ACK rollback'); END`);
          await reject(push({},[observed]),503,true);app.store.db.exec('DROP TRIGGER fail_shop_cold_ack');
        }
        if(baselineKind==='ordinary') {
          app.store.db.exec("CREATE TRIGGER fail_shop_floor BEFORE INSERT ON shop_item_stock_floor BEGIN SELECT RAISE(ABORT,'ordinary checkpoint rollback'); END");
          await reject(push({},[observed]),503,true);app.store.db.exec('DROP TRIGGER fail_shop_floor');
          assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM shop_item_stock_floor').get().n,0);
        }
        parse(await push({},[observed]));await close();await open();assert.deepEqual(app.store.operations(),[]);
        assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
        for(const [id,item] of acquired) {
          const profile=master.itemProfiles[id];assert.deepEqual(rows(profile.table).find(row=>row[profile.idField]===id),item);
          await reject(push({[profile.table]:[{...item,cumulativeAmount:item.cumulativeAmount-1}]}),400);
          if(baselineKind==='ordinary') {
            const dated=profile.table==='UserGachaTicket',floor=app.store.db.prepare('SELECT * FROM shop_item_stock_floor WHERE item_id=?').get(id),
              claim=app.store.db.prepare('SELECT * FROM shop_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,id),
              pull=()=>send('user_data/pull',{tables:[profile.table]});
            assert.deepEqual({...floor},{item_id:id,table_name:profile.table,operation_id:operation.id});
            await reject(push({[profile.table]:[{...item,...(dated?{dateList:[{aquiredAt:now}]}:{amount:1})}]}),400);
            await reject(push({[profile.table]:[{...item,cumulativeAmount:item.cumulativeAmount+1}]}),400);
            for(const changes of [{operation_id:operation.id+1},{table_name:'UserKeyItem'}]) {
              app.store.db.prepare(`UPDATE shop_item_stock_floor SET ${Object.keys(changes).map(key=>`${key}=?`).join(',')} WHERE item_id=?`)
                .run(...Object.values(changes),id);await reject(pull());
              app.store.db.prepare('UPDATE shop_item_stock_floor SET table_name=?,operation_id=? WHERE item_id=?').run(floor.table_name,floor.operation_id,id);
            }
            app.store.db.prepare('DELETE FROM shop_item_stock_floor WHERE item_id=?').run(id);await reject(pull());
            app.store.db.prepare('INSERT INTO shop_item_stock_floor(item_id,table_name,operation_id) VALUES(?,?,?)').run(id,floor.table_name,floor.operation_id);
            const column=dated?'gacha_state':'stock_state';
            for(const changes of [{[column]:null},{cap_version:0,[column]:null},
              {[column]:JSON.stringify({...JSON.parse(claim[column]),observed:false})}]) {
              app.store.db.prepare(`UPDATE shop_item_claim SET ${Object.keys(changes).map(key=>`${key}=?`).join(',')} WHERE operation_id=? AND item_id=?`)
                .run(...Object.values(changes),operation.id,id);await reject(pull());
              app.store.db.prepare('UPDATE shop_item_claim SET cap_version=?,stock_state=?,gacha_state=? WHERE operation_id=? AND item_id=?')
                .run(claim.cap_version,claim.stock_state,claim.gacha_state,operation.id,id);
            }
            app.store.db.prepare('DELETE FROM shop_item_claim WHERE operation_id=? AND item_id=?').run(operation.id,id);await reject(pull());
            app.store.db.prepare(`INSERT INTO shop_item_claim(${Object.keys(claim).join(',')}) VALUES(${Object.keys(claim).map(()=>'?').join(',')})`)
              .run(...Object.values(claim));
            const receipt=app.store.db.prepare('SELECT * FROM shop_request WHERE operation_id=?').get(operation.id);
            app.store.db.prepare('DELETE FROM shop_request WHERE operation_id=?').run(operation.id);await reject(pull());
            app.store.db.prepare(`INSERT INTO shop_request(${Object.keys(receipt).join(',')}) VALUES(${Object.keys(receipt).map(()=>'?').join(',')})`)
              .run(...Object.values(receipt));
            const saved=rows(profile.table);
            put(profile.table,saved.filter(row=>row[profile.idField]!==id));await reject(pull());put(profile.table,saved);
            parse(await push({[profile.table]:[{...item,signature:0xffffffff}]}));
            parse(await push({[profile.table]:[item]}));
          }
        }
        await reject(push({UserShopProduct:[beforeProduct]}),400);await reject(push({},[operation]),400);
        if(baselineKind==='ordinary' && first==='count' && [207000047,207000033].includes(productId)) {
          const source=rows('UserGift').find(row=>row.id===1),profile=master.itemProfiles[product.rewardId],
            earned=parse(await send('gift/receive',{userId:seed.userId,giftIds:[1]})).operations[0],
            previous=rows(profile.table).find(row=>row[profile.idField]===product.rewardId),
            item={...previous,cumulativeAmount:previous.cumulativeAmount+1,signature:earned.signature,
              ...(profile.table==='UserGachaTicket'?{dateList:[{aquiredAt:now}]}:{amount:1})};
          parse(await push({UserGift:[{...source,state:1}],[profile.table]:[item]},[earned]));await close();await open();
          assert.deepEqual(rows(profile.table).find(row=>row[profile.idField]===product.rewardId),item);
          assert.equal(app.store.db.prepare('SELECT operation_id FROM shop_item_stock_floor WHERE item_id=?').get(product.rewardId).operation_id,operation.id);
          await reject(push({[profile.table]:[{...item,...(profile.table==='UserGachaTicket'?{dateList:[...item.dateList,{aquiredAt:now}]}:{amount:2})}]}),400);
        }
      }
    // Six NEW independent field-prefix contexts; no partial field is a complete reward observation.
    for(const productId of [207000047,207000033]) for(const component of ['stock','cumulative','signature']) {
      const product=master.shopProducts[productId],profile=master.itemProfiles[product.rewardId],dated=profile.table==='UserGachaTicket';
      now=product.startAt;await close();database=path.join(directory,`ordinary-prefix-${productId}-${component}.sqlite`);await open();
      const before={userId:seed.userId,[profile.idField]:product.rewardId,cumulativeAmount:component==='stock'?999999997:100,signature:0xffffffff,bookEntryState:dated?-128:255,
        ...(dated?{dateList:[{aquiredAt:Math.max(0,now-master.lotteryTickets[product.rewardId]-1)}]}:{amount:7,reservedAmount:0})};
      put(profile.table,[before]);put('UserShopProduct',[]);
      const costProfile=master.itemProfiles[product.priceItemId],cost={userId:seed.userId,[costProfile.idField]:product.priceItemId,
        amount:product.price,cumulativeAmount:product.price,bookEntryState:3,signature:0};
      put(costProfile.table,[cost]);parse(await push({[costProfile.table]:[{...cost,amount:0}]}));
      const bought=parse(await send('shop/buy',{shopProductId:productId})),operation=bought.operation,
        acquired={...before,cumulativeAmount:before.cumulativeAmount+product.amount,signature:operation.signature,
          ...(dated?{dateList:Array.from({length:product.amount},()=>({aquiredAt:now}))}:{amount:before.amount+product.amount})},
        prefix={...before,...(component==='stock'?dated?{dateList:acquired.dateList}:{amount:acquired.amount}:
          component==='cumulative'?{cumulativeAmount:acquired.cumulativeAmount}:{signature:acquired.signature})};
      parse(await push({[profile.table]:[prefix]}));await close();await open();
      await reject(send('user_data/confirm'));await reject(send('user/login'));
      await reject(push({},[operation]),400);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM shop_item_stock_floor').get().n,0);
      parse(await push({[profile.table]:[acquired],UserShopProduct:[{userId:seed.userId,shopProductId:productId,
        count:bought.count,lastExchangedAt:bought.lastExchangedAt,readState:1}]}));
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,parameters:{...operation.parameters,boughtItems:[]}}]);
      parse(await push({},[operation]));await close();await open();
      assert.equal(app.store.db.prepare('SELECT operation_id FROM shop_item_stock_floor WHERE item_id=?').get(product.rewardId).operation_id,operation.id);
      if(component==='stock') {
        // The original second purchase crosses the lifetime cap without discarding the first owned checkpoint.
        assert.equal(product.amount,1);assert.equal(acquired.cumulativeAmount,999999998);
        put(costProfile.table,[{...cost,cumulativeAmount:cost.cumulativeAmount+product.price}]);
        parse(await push({[costProfile.table]:[{...cost,amount:0,cumulativeAmount:cost.cumulativeAmount+product.price}]}));
        const boughtAgain=parse(await send('shop/buy',{shopProductId:productId})),next=boughtAgain.operation,
          claim=app.store.db.prepare('SELECT * FROM shop_item_claim WHERE operation_id=?').get(next.id),
          finalItem={...acquired,cumulativeAmount:999999999,signature:next.signature,
            ...(dated?{dateList:[...acquired.dateList,{aquiredAt:now}]}:{amount:acquired.amount+1})};
        assert.equal(JSON.parse(claim.stock_state??claim.gacha_state).policy,dated?'offline-shop-gacha-v2':'offline-shop-stock-v2');
        parse(await push({[profile.table]:[finalItem],UserShopProduct:[{userId:seed.userId,shopProductId:productId,
          count:boughtAgain.count,lastExchangedAt:boughtAgain.lastExchangedAt,readState:1}]},[next]));
        const floor=app.store.db.prepare('SELECT * FROM shop_item_stock_floor WHERE item_id=?').get(product.rewardId);
        assert.equal(floor.operation_id,next.id);await close();await open();parse(await send('user_data/pull',{tables:[profile.table]}));
        app.store.db.prepare('DELETE FROM shop_item_stock_floor WHERE item_id=?').run(product.rewardId);
        await reject(send('user_data/pull',{tables:[profile.table]}));
        app.store.db.prepare('INSERT INTO shop_item_stock_floor(item_id,table_name,operation_id) VALUES(?,?,?)')
          .run(floor.item_id,floor.table_name,floor.operation_id);
      }
    }
    // One NEW first-constructor context: the real Falna Orb offer can save its
    // seven-field Adventure Ticket row before the purchase count/date.
    {
      const productId=207000002,product=master.shopProducts[productId],itemId=product.rewardId,
        profile=master.itemProfiles[itemId];
      now=1571400000;await close();database=path.join(directory,'first-adventure-ticket.sqlite');await open();
      assert.deepEqual(product,{priceType:0,priceItemId:0,price:10,limitType:0,limit:0,rewardType:0,
        rewardId:298000001,amount:1,startAt:0,endAt:0,shopId:204000001,duration:0});
      assert.deepEqual(profile,{table:'UserAdventureTicket',idField:'adventureTicketId'});
      const otherTickets=rows(profile.table).filter(row=>row[profile.idField]!==itemId),
        otherProducts=rows('UserShopProduct').filter(row=>row.shopProductId!==productId);
      put(profile.table,otherTickets);put('UserShopProduct',otherProducts);
      app.store.changeHardCurrency(product.price+100,'Deferred fixture funding');
      const funded=[app.store.hardCurrency(),app.store.paidCurrency()],
        bought=parse(await send('shop/buy',{shopProductId:productId})),operation=bought.operation,
        claim=app.store.db.prepare('SELECT * FROM shop_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,itemId),
        wallet=[funded[0]-product.price,funded[1]],target={userId:seed.userId,shopProductId:productId,
          count:bought.count,lastExchangedAt:bought.lastExchangedAt,readState:1};
      assert.equal(operation.type,9000);assert.deepEqual(bought.operations,[operation]);
      assert.deepEqual(operation.parameters.boughtItems,[{itemId,amount:1}]);
      assert.deepEqual([operation.parameters.boughtEquipments,operation.parameters.boughtCostumes],[[],[]]);
      assert.equal(claim.cap_version,0);assert.equal(claim.table_name,profile.table);assert.equal(claim.id_field,profile.idField);
      assert.equal(claim.amount,1);assert.equal(claim.cumulative_amount,1);
      assert.deepEqual([claim.stock_state,claim.gacha_state,claim.valis_state,claim.valis_seen],[null,null,null,0]);
      assert.equal(rows(profile.table).some(row=>row[profile.idField]===itemId),false,'Shop issuance must not precredit native inventory');
      assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
      const acquired={userId:seed.userId,adventureTicketId:itemId,amount:1,bookEntryState:3,
        signature:operation.signature,lastResetAt:0,cumulativeAmount:1};
      parse(await push({[profile.table]:[...otherTickets,acquired]}));await close();await open();
      assert.deepEqual(JSON.parse(app.store.db.prepare('SELECT observed FROM shop_request WHERE operation_id=?').get(operation.id).observed),[`i:${itemId}`]);
      app.store.db.prepare('UPDATE shop_item_claim SET cap_version=1 WHERE operation_id=? AND item_id=?').run(operation.id,itemId);
      await reject(send('user_data/confirm'));
      app.store.db.prepare('UPDATE shop_item_claim SET cap_version=0 WHERE operation_id=? AND item_id=?').run(operation.id,itemId);
      const recovered={...operation,parameters:{...operation.parameters,boughtItems:[]}},source=retained(),
        cold=parse(await send('user_data/confirm'));
      assert.deepEqual(cold.operations,[recovered]);assert.equal(retained(),source);
      parse(await send('user/login'));
      const tables=[profile.table,'UserShopProduct'],pulled=await send('user_data/pull',{tables});
      assert.equal(pulled.status,200);assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull({tables})));
      assert.equal(retained(),source);await reject(send('shop/buy',{shopProductId:productId}));
      await reject(push({},[operation]),400);
      parse(await push({UserShopProduct:[...otherProducts,target]},[recovered]));await close();await open();
      assert.deepEqual(app.store.operations(),[]);assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
      assert.deepEqual(rows(profile.table).find(row=>row[profile.idField]===itemId),acquired);
      assert.deepEqual(rows('UserShopProduct').find(row=>row.shopProductId===productId),target);
      await reject(push({[profile.table]:otherTickets}),400);
      await reject(push({UserShopProduct:otherProducts}),400);await reject(push({},[operation]),400);
    }
    console.log('SOURCE ONLY shop cold recovery:103 deferred contexts (earlier64 + new32 ordinary + new6 field prefixes + new1 first Adventure Ticket); native acceptance pending');
  } finally {
    await close();const resolved=fs.realpathSync(directory);
    assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('danmemore-shop-cold-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
