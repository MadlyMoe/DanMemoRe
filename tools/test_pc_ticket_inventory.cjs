'use strict';

// WRITTEN ONLY / NOT RUN. Synthetic dates, funding, flags and signatures are not native gameplay acceptance.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json');
const master=require('../data/danmemore-master.json');
const ids=[297000005,297000006,297000007],duration=2592000;
const gachaIds=Object.keys(master.lotteryTickets).map(Number),recoveryIds=[...ids,...gachaIds.slice(0,3)];
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-pc-ticket-'));
  let app,database,port,sequence=0,now=1702519200;
  const close=async()=>{if(app){await app.close();app=null;}};
  const open=async()=>{
    app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const fresh=async name=>{await close();database=path.join(directory,`${name}.sqlite`);await open();};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const rows=name=>app.store.read(name).data;
  const put=(name,value)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(value),md5(value),name);
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const reject=async(pending,status=503)=>{
    const before=snapshot(),reply=await pending;assert.equal(reply.status,status,reply.body.toString());assert.equal(snapshot(),before);
    if(status===503 && reply.body.length) assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const push=(putItems={},operations=[],trigger='TicketShopBuy',deleteItems={})=>send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name]??[])]))},
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length?[{signature:0,trigger,putItems,deleteItems}]:[],
    operations:operations.map(operation=>({id:operation.id,verifier:operation.token}))});
  const ticket=(id,cumulativeAmount,dateList=[])=>({userId:seed.userId,[master.itemProfiles[id].idField]:id,dateList,cumulativeAmount,
    bookEntryState:-128,signature:0xffffffff});
  const gift=(id,itemId,amount)=>({userId:seed.userId,id,itemId,amount,title:'Deferred original-class fixture',message:'',
    senderType:1,senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,
    pcHeroSublimateCount:0,state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0});
  try {
    assert.deepEqual(Object.entries(master.itemProfiles).filter(([,profile])=>profile.table==='UserPCTicket').map(([id])=>Number(id)),ids);
    //21 NEW contexts: all three original dated classes, seven capped-save prefixes.
    for(const id of ids) for(const first of ['flags','append','signature','cumulative','pruned','expired','together']) {
      now=1702519200;await fresh(`present-${id}-${first}`);
      const gifts=[gift(1,id,2),gift(2,id,3)],received=gifts.map(row=>({...row,state:1})),
        before=ticket(id,first==='signature'?999999999:999999998,[{aquiredAt:now-duration}]);
      put('UserPCTicket',[before]);put('UserGift',gifts);
      const issued=parse(await send('gift/receive',{userId:seed.userId,giftIds:[1,2]})),operation=issued.operation,
        claim=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=?').get(operation.id),
        capture=JSON.parse(claim.gacha_state),acquired={...before,cumulativeAmount:999999999,signature:operation.signature,
          dateList:Array.from({length:5},()=>({aquiredAt:now}))};
      assert.equal(claim.cap_version,1);assert.equal(claim.stock_state,null);assert.equal(claim.table_name,'UserPCTicket');
      assert.equal(claim.id_field,'pcTicketId');assert.equal(capture.beforeSignature,0xffffffff);
      assert.equal(capture.signature,operation.signature);assert.deepEqual(rows('UserPCTicket'),[before]);
      for(const changes of [{amount:1},{lastResetAt:0},{reservedAmount:0},{gachaTicketId:id},
        {bookEntryState:128},{signature:0x100000000},{dateList:[{acquiredAt:now}]},{dateList:[{aquiredAt:-1}]}])
        await reject(push({UserPCTicket:[{...before,...changes}]},[],'GiftReceive'),400);
      const prefix=first==='flags'?{UserGift:received}:first==='append'?{UserPCTicket:[{...before,dateList:acquired.dateList}]}:
        first==='signature'?{UserPCTicket:[{...before,signature:operation.signature}]}:
          first==='cumulative'?{UserPCTicket:[{...before,cumulativeAmount:999999999}]}:
            first==='pruned'?{UserPCTicket:[{...before,dateList:[]}]}:
              first==='expired'?{UserPCTicket:[{...acquired,dateList:[]}]}:{UserGift:received,UserPCTicket:[acquired]};
      parse(await push(prefix,[],'GiftReceive'));await close();await open();
      if(first!=='together') await reject(push({},[operation],'GiftReceive'),400);
      const current=rows('UserPCTicket')[0];
      if(first==='append') {
        parse(await push({UserPCTicket:[{...current,dateList:[]}]},[],'GiftReceive'));
        await reject(push({UserPCTicket:[current]},[],'GiftReceive'),400);
      }
      // Native dates may already have been spent/expired before the final checkpoint; signature/lifetime still prove observation.
      const final={...acquired,dateList:[]};
      for(const [table,event] of [['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER pc_ticket_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'ticket ACK rollback'); END`);
        await reject(push({UserGift:received,UserPCTicket:[final]},[operation],'GiftReceive'));
        app.store.db.exec('DROP TRIGGER pc_ticket_ack_fail');
      }
      parse(await push({UserGift:received,UserPCTicket:[final]},[operation],'GiftReceive'));await close();await open();
      assert.equal(JSON.parse(app.store.db.prepare('SELECT gacha_state FROM gift_item_claim').get().gacha_state).observed,true);
      assert.deepEqual(app.store.operations(),[]);assert.deepEqual(rows('UserPCTicket'),[final]);
      await reject(push({UserPCTicket:[{...final,dateList:[{aquiredAt:now}]}]},[],'GiftReceive'),400);
      await reject(push({},[],'GiftReceive',{UserPCTicket:[{pcTicketId:id}]}),400);
    }
    //252 WRITTEN ONLY contexts:3 PC plus3 ordinary-ticket classes, first/owned, seven prefixes, all native gift flags.
    for(const id of recoveryIds) for(const baseline of ['first','owned']) for(const flag of ['unclaimed','claimed','deleted'])
      for(const first of ['flags','initializer','book','cumulative','signature','dates','together']) {
      now=1702519200;await fresh(`present-${id}-${baseline}-${flag}-${first}`);
      const {table,idField}=master.itemProfiles[id],pcTicket=table==='UserPCTicket',
        gifts=[gift(1,id,2),gift(2,id,3)],received=gifts.map(row=>({...row,state:1})),
        initial=baseline==='first'?{userId:seed.userId,[idField]:id,dateList:[],bookEntryState:1,signature:0,cumulativeAmount:0}:
          ticket(id,100,Array.from({length:7},()=>({aquiredAt:now-1})));
      put('UserGift',gifts);put(table,baseline==='first'?[]:[initial]);
      if(first==='initializer') for(const table of ['gift_item_claim','gift_claim','operation_queue','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER pc_present_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'PC Present issue rollback'); END`);
        await reject(send('gift/receive',{userId:seed.userId,giftIds:[1,2]}));app.store.db.exec('DROP TRIGGER pc_present_issue_fail');
      }
      const response=await send('gift/receive',{userId:seed.userId,giftIds:[1,2]}),hotIdentity=sequence,
        operation=parse(response).operations[0],claim=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=?').get(operation.id),
        capture=JSON.parse(claim.gacha_state),final={...initial,bookEntryState:baseline==='first'?3:initial.bookEntryState,
          cumulativeAmount:initial.cumulativeAmount+5,signature:operation.signature,dateList:[]},
        wallet=[app.store.hardCurrency(),app.store.paidCurrency()];
      assert.equal(capture.policy,pcTicket?(baseline==='first'?'offline-gift-pc-ticket-first-v1':'offline-gift-pc-ticket-v1'):
        baseline==='first'?'offline-gift-gacha-ticket-first-v1':'offline-gift-gacha-ticket-v1');
      assert.equal(capture.beforeCumulative,initial.cumulativeAmount);assert.equal(claim.cap_version,1);
      assert.deepEqual(rows(table),baseline==='first'?[]:[initial]);
      const pc=first==='initializer'?initial:first==='book'?{...initial,bookEntryState:final.bookEntryState}:
        first==='cumulative'?{...initial,bookEntryState:final.bookEntryState,cumulativeAmount:final.cumulativeAmount}:
          first==='signature'?{...initial,signature:operation.signature}:first==='dates'?{...initial,bookEntryState:final.bookEntryState,
            cumulativeAmount:baseline==='first'?final.cumulativeAmount:initial.cumulativeAmount,
            dateList:[...initial.dateList,...Array.from({length:5},()=>({aquiredAt:now}))]}:final,
        puts={...(first==='flags'?{}:{[table]:[pc]}),...(flag==='claimed'?{UserGift:received}:{})},
        deletes=flag==='deleted'?{UserGift:gifts.map(row=>({id:row.id}))}:{};
      parse(await push(puts,[],'GiftReceive',deletes));await close();await open();
      const partial=['cumulative','signature','dates'].includes(first);
      if(partial) await reject(send('user_data/confirm'));
      else {
        const expected={...operation,parameters:{...operation.parameters,receivedItems:first==='together'?[]:operation.parameters.receivedItems}},
          cold=await send('user_data/confirm'),coldIdentity=sequence;
        assert.deepEqual(parse(cold).operations,[expected]);parse(await send('user/login'));
        await close();await open();assert.deepEqual((await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm')).body,cold.body);
        const bad=JSON.parse(cold.body);bad.operations[0].parameters.receivedItems=[{itemId:id,amount:0}];
        app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(Buffer.from(JSON.stringify(bad)).toString('base64'),`${coldIdentity}/${coldIdentity}`);
        await reject(request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm'));
        app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(cold.body.toString('base64'),`${coldIdentity}/${coldIdentity}`);
      }
      if(first!=='together' || flag==='unclaimed') await reject(push({},[operation],'GiftReceive'),400);
      if(partial || first==='together' || flag!=='unclaimed') {
        await reject(send('gift/receive',{userId:seed.userId,giftIds:[1,2]}));
        await reject(request(port,hotIdentity,{userId:seed.userId,giftIds:[1,2]},String(hotIdentity),'gift/receive'));
      }
      for(const [table,event] of [['gift_item_claim','UPDATE'],['profile','UPDATE'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        if(first==='together' && (table==='gift_item_claim' || table==='profile' && flag!=='unclaimed')) continue;
        app.store.db.exec(`CREATE TRIGGER pc_present_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'PC Present ACK rollback'); END`);
        await reject(push({[table]:[final],...(flag==='unclaimed'?{UserGift:received}:{})},[operation],'GiftReceive'));
        app.store.db.exec('DROP TRIGGER pc_present_ack_fail');
      }
      parse(await push({[table]:[final],...(flag==='unclaimed'?{UserGift:received}:{})},[operation],'GiftReceive'));await close();await open();
      assert.deepEqual(app.store.operations(),[]);assert.deepEqual(rows(table),[final]);
      assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
      await reject(push({[table]:[{...final,dateList:[{aquiredAt:now}]}]},[],'GiftReceive'),400);
      await reject(push({},[],'GiftReceive',{[table]:[{[idField]:id}]}),400);
      put(table,[]);await reject(send('user_data/pull',{tables:[table]}));put(table,[final]);
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[]);
    }
    //48 WRITTEN ONLY contexts: all saved subsets/flags for3 PC classes and mixed PC/ordinary-ticket tables.
    for(const classes of [ids,[ids[0],...gachaIds.slice(0,2)]]) for(let subset=0;subset<8;subset++) for(const flag of ['unclaimed','claimed','deleted']) {
      now=1702519200;await fresh(`present-three-${classes[1]}-${subset}-${flag}`);
      const gifts=classes.map((id,index)=>gift(index+1,id,index+1)),received=gifts.map(row=>({...row,state:1})),
        fields=new Map(classes.map(id=>[master.itemProfiles[id].table,master.itemProfiles[id].idField])),tables=[...fields.keys()];
      put('UserGift',gifts);for(const table of tables) put(table,[]);
      const operation=parse(await send('gift/receive',{userId:seed.userId,giftIds:[1,2,3]})).operations[0],
        final=classes.map((id,index)=>({userId:seed.userId,[master.itemProfiles[id].idField]:id,bookEntryState:3,signature:operation.signature,
          cumulativeAmount:index+1,dateList:[]})),observed=final.filter((row,index)=>subset&(1<<index));
      const saved=Object.fromEntries(tables.map(table=>[table,observed.filter(row=>Object.hasOwn(row,fields.get(table)))])
        .filter(([,items])=>items.length)),
        complete=Object.fromEntries(tables.map(table=>[table,final.filter(row=>Object.hasOwn(row,fields.get(table)))]));
      parse(await push({...saved,...(flag==='claimed'?{UserGift:received}:{})},[],
        'GiftReceive',flag==='deleted'?{UserGift:gifts.map(row=>({id:row.id}))}:{}));await close();await open();
      const expected={...operation,parameters:{...operation.parameters,receivedItems:operation.parameters.receivedItems
        .filter(item=>!observed.some(row=>row[master.itemProfiles[item.itemId].idField]===item.itemId))}};
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[expected]);
      if(subset!==7 || flag==='unclaimed') await reject(push({},[operation],'GiftReceive'),400);
      parse(await push({...complete,...(flag==='unclaimed'?{UserGift:received}:{})},[operation],'GiftReceive'));
      await close();await open();assert.deepEqual(app.store.operations(),[]);
      for(const table of tables) {
        const idField=fields.get(table);
        assert.deepEqual([...rows(table)].sort((a,b)=>a[idField]-b[idField]),[...complete[table]].sort((a,b)=>a[idField]-b[idField]));
      }
    }
    //516 NEW WRITTEN ONLY contexts: every remaining original ordinary-ticket ID, first/owned full delivery.
    assert.equal(gachaIds.length,261);
    for(const id of gachaIds.slice(3)) for(const baseline of ['first','owned']) {
      now=1702519200;await fresh(`gacha-catalog-${id}-${baseline}`);
      const initial={userId:seed.userId,gachaTicketId:id,dateList:[],bookEntryState:baseline==='first'?1:-128,
        signature:baseline==='first'?0:0xffffffff,cumulativeAmount:baseline==='first'?0:100},gifts=[gift(1,id,1)];
      assert.equal(master.lotteryTickets[id],duration);put('UserGachaTicket',baseline==='first'?[]:[initial]);put('UserGift',gifts);
      const operation=parse(await send('gift/receive',{userId:seed.userId,giftIds:[1]})).operations[0],
        claim=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=?').get(operation.id),
        final={...initial,bookEntryState:baseline==='first'?3:initial.bookEntryState,signature:operation.signature,
          cumulativeAmount:initial.cumulativeAmount+1,dateList:[{aquiredAt:now}]};
      assert.equal(claim.cap_version,1);assert.equal(JSON.parse(claim.gacha_state).policy,
        baseline==='first'?'offline-gift-gacha-ticket-first-v1':'offline-gift-gacha-ticket-v1');
      assert.deepEqual(rows('UserGachaTicket'),baseline==='first'?[]:[initial],'No first native inventory prewrite');
      parse(await push({UserGachaTicket:[final],UserGift:gifts.map(row=>({...row,state:1}))},[operation],'GiftReceive'));
      await close();await open();assert.deepEqual(rows('UserGachaTicket'),[final]);assert.deepEqual(app.store.operations(),[]);
      parse(await push({UserGachaTicket:[{...final,dateList:[]}]},[],'GiftReceive'));
      await reject(push({UserGachaTicket:[final]},[],'GiftReceive'),400);
    }
    //2 NEW contexts: PC+Iris/SP mixtures retain their unsupported partial cold path, not silently omitted rewards.
    for(const key of ['currency.gem','currency.stamina']) {
      now=1702519200;await fresh(`present-mixed-${key}`);
      const gifts=[gift(1,ids[0],1),gift(2,master.currencies[key],1)];put('UserGift',gifts);put('UserPCTicket',[]);
      const operation=parse(await send('gift/receive',{userId:seed.userId,giftIds:[1,2]})).operations[0];
      parse(await push({UserPCTicket:[{userId:seed.userId,pcTicketId:ids[0],bookEntryState:3,signature:operation.signature,
        cumulativeAmount:1,dateList:[]}]},[],'GiftReceive'));await close();await open();
      await reject(send('user_data/confirm'));assert.deepEqual(app.store.operations(),[operation]);
    }
    //21 NEW WRITTEN ONLY contexts:3 original ordinary-ticket exchanges, seven first-constructor/save prefixes.
    for(const id of gachaIds.slice(0,3)) for(const first of ['count','initializer','book','cumulative','signature','dates','together']) {
      const [key,product]=Object.entries(master.shopProducts).find(([,row])=>row.rewardType===0 && row.rewardId===id &&
        (!row.endAt || row.endAt>row.startAt));
      now=product.startAt || 1702519200;await fresh(`gacha-first-shop-${key}-${first}`);
      const costProfile=master.itemProfiles[product.priceItemId],initial={userId:seed.userId,gachaTicketId:id,dateList:[],
        bookEntryState:1,signature:0,cumulativeAmount:0},cost={userId:seed.userId,[costProfile.idField]:product.priceItemId,
        amount:product.price+1,reservedAmount:0,bookEntryState:3,signature:0,cumulativeAmount:product.price+1};
      assert.equal(product.priceType,2);assert.equal(costProfile.table,'UserCurrency');
      put('UserGachaTicket',[]);put('UserShopProduct',[]);put(costProfile.table,[cost]);put('UserGift',[gift(1,id,1)]);
      parse(await push({[costProfile.table]:[{...cost,amount:1}]},[],'ShopBuy'));
      const bought=parse(await send('shop/buy',{shopProductId:Number(key)})),operation=bought.operations.find(row=>row.type===9000),
        claim=app.store.db.prepare('SELECT * FROM shop_item_claim WHERE operation_id=?').get(operation.id),capture=JSON.parse(claim.gacha_state),
        final={...initial,bookEntryState:3,cumulativeAmount:product.amount,signature:operation.signature},
        productRow={userId:seed.userId,shopProductId:Number(key),count:bought.count,lastExchangedAt:bought.lastExchangedAt,readState:1},
        prefix=first==='count'?{UserShopProduct:[productRow]}:{UserGachaTicket:[first==='initializer'?initial:
          first==='book'?{...initial,bookEntryState:3}:first==='cumulative'?{...initial,bookEntryState:3,cumulativeAmount:product.amount}:
            first==='signature'?{...initial,signature:operation.signature}:first==='dates'?{...final,signature:0,
              dateList:Array.from({length:product.amount},()=>({aquiredAt:now}))}:final]};
      assert.equal(capture.policy,'offline-shop-gacha-ticket-first-v1');assert.equal(claim.cap_version,1);
      assert.equal(capture.beforeCumulative,0);assert.equal(capture.beforeSignature,0);assert.deepEqual(capture.beforeDates,[]);
      assert.deepEqual(rows('UserGachaTicket'),[],'First shop capture never writes the native constructor to inventory');
      assert.equal(JSON.parse(app.store.db.prepare('SELECT rewards FROM shop_request WHERE operation_id=?').get(operation.id).rewards)
        .find(row=>row.id===id).capturePolicy,capture.policy);
      if(first==='initializer') for(const changes of [{userId:0},{bookEntryState:2},{pcTicketId:id},{amount:1},
        {signature:0x100000000},{dateList:[{aquiredAt:now}]}])
        await reject(push({UserGachaTicket:[{...initial,...changes}]}),400);
      parse(await push(prefix));await close();await open();
      if(['cumulative','signature','dates'].includes(first)) await reject(send('user_data/confirm'));
      else assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id).parameters.boughtItems,
        first==='together'?[]:operation.parameters.boughtItems);
      await reject(push({},[operation]),400);await reject(send('gift/receive',{userId:seed.userId,giftIds:[1]}));
      const targetState=app.store.db.prepare('SELECT gacha_state FROM shop_item_claim WHERE operation_id=?').get(operation.id).gacha_state;
      app.store.db.prepare('UPDATE shop_item_claim SET gacha_state=? WHERE operation_id=?')
        .run(JSON.stringify({...JSON.parse(targetState),beforeSignature:1}),operation.id);
      await reject(send('user_data/confirm'));
      app.store.db.prepare('UPDATE shop_item_claim SET gacha_state=? WHERE operation_id=?').run(targetState,operation.id);
      for(const table of ['operation_done','shop_item_stock_floor','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER gacha_first_ack_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'first gacha shop ACK rollback'); END`);
        await reject(push({UserGachaTicket:[final],UserShopProduct:[productRow]},[operation]));
        app.store.db.exec('DROP TRIGGER gacha_first_ack_fail');
      }
      parse(await push({UserGachaTicket:[final],UserShopProduct:[productRow]},[operation]));await close();await open();
      assert.deepEqual(app.store.operations(),[]);assert.deepEqual(rows('UserGachaTicket'),[final]);
      assert.equal(rows(costProfile.table).find(row=>row[costProfile.idField]===product.priceItemId).amount,1,'No second item charge');
      const floor=app.store.db.prepare('SELECT * FROM shop_item_stock_floor WHERE item_id=?').get(id);
      assert.equal(floor.operation_id,operation.id);app.store.db.prepare('DELETE FROM shop_item_stock_floor WHERE item_id=?').run(id);
      await reject(send('user_data/pull',{tables:['UserGachaTicket']}));
      app.store.db.prepare('INSERT INTO shop_item_stock_floor(item_id,table_name,operation_id) VALUES(?,?,?)')
        .run(floor.item_id,floor.table_name,floor.operation_id);
      await reject(push({UserGachaTicket:[{...final,dateList:[{aquiredAt:now}]}]}),400);
      await reject(push({},[],'ShopBuy',{UserGachaTicket:[{gachaTicketId:id}]}),400);
    }
    //529 NEW contexts: every authored selector shop cost uses its own product, price and availability window.
    const selectors=Object.entries(master.shopProducts).filter(([,product])=>product.priceType===2 && ids.includes(product.priceItemId));
    assert.equal(selectors.length,529);
    for(const [key,product] of selectors) {
      now=product.startAt || 1702519200;await fresh(`selector-${key}`);
      assert.equal(product.price,1);assert.equal(product.rewardType,1);
      const before=ticket(product.priceItemId,12,[{aquiredAt:now-duration},{aquiredAt:now-1},{aquiredAt:now}]),
        after={...before,dateList:[{aquiredAt:now}]},body={shopProductId:Number(key)};
      put('UserPCTicket',[before]);put('UserShopProduct',[]);
      if(product.endAt && product.endAt<=product.startAt) {
        await reject(send('shop/buy',body),400);
        assert.deepEqual(rows('UserPCTicket'),[before]);assert.deepEqual(app.store.operations(),[]);
        continue; // Six original zero-length selector windows are not made buyable by the offline server.
      }
      await reject(send('shop/buy',body),400);
      if(key===selectors.find(([,candidate])=>candidate.priceItemId===product.priceItemId)[0]) {
        parse(await push({UserPCTicket:[{...before,dateList:before.dateList.slice(1)}]}));
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM shop_spend').get().n,0,'Expiry at equality is not payment');
        await reject(send('shop/buy',body),400);
        put('UserPCTicket',[before]);
        parse(await push({UserPCTicket:[after]},[],'GiftReceive'));
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM shop_spend').get().n,0,'A different feature cannot mint a shop payment');
        put('UserPCTicket',[before]);
        app.store.db.exec("CREATE TRIGGER pc_ticket_spend_fail BEFORE INSERT ON shop_spend BEGIN SELECT RAISE(ABORT,'dated payment rollback'); END");
        await reject(push({UserPCTicket:[after]}));app.store.db.exec('DROP TRIGGER pc_ticket_spend_fail');
      }
      parse(await push({UserPCTicket:[after]}));await close();await open();
      const spend=app.store.db.prepare('SELECT * FROM shop_spend').get(),state=JSON.parse(spend.ticket_state);
      assert.equal(spend.amount,1);assert.equal(spend.before_amount,2);assert.equal(spend.after_amount,1);
      assert.deepEqual(state,{policy:'offline-pc-ticket-shop-spend-v1',before,after});
      await reject(push({UserPCTicket:[before]}),400);
      await reject(push({},[],'TicketShopBuy',{UserPCTicket:[{pcTicketId:product.priceItemId}]}),400);
      const bought=parse(await send('shop/buy',body)),identity=sequence;
      assert.deepEqual(bought.operations.map(operation=>operation.type),[1000,9000]);
      assert.deepEqual(bought.operations[0].parameters.lotteryPCs.map(pc=>pc.pcId),[product.rewardId]);
      assert.deepEqual(rows('UserPCTicket'),[after],'No second native date deduction or selector-ticket precredit');
      assert.equal(app.store.db.prepare('SELECT operation_id FROM shop_spend').get().operation_id,bought.operations[1].id);
      assert.deepEqual(parse(await request(port,identity,body,String(identity),'shop/buy')),bought);
      app.store.db.prepare('UPDATE shop_spend SET ticket_state=NULL WHERE id=?').run(spend.id);
      await reject(send('user_data/confirm'));
      app.store.db.prepare('UPDATE shop_spend SET ticket_state=? WHERE id=?').run(spend.ticket_state,spend.id);
      assert.equal(app.store.operations().length,2,'Retain both real unit and purchase handoffs, not fake ACK');
      // Original unit initializer/boards/default outfit/voice/story and duplicate bond ACK remain covered by their separate deferred fixtures.
    }
    //210 NEW contexts: all30 nonempty original PC-ticket pack windows, seven first-row/purchase prefixes.
    const pcPacks=Object.entries(master.shopProducts).filter(([,product])=>
      (product.rewardType===2 || product.rewardType===4 && product.priceType===1) &&
      master.shopPacks[product.rewardId]?.contents.some(content=>content.type===0 && ids.includes(content.rewardId))),
      activePacks=pcPacks.filter(([,product])=>!product.endAt || product.endAt>product.startAt);
    assert.equal(pcPacks.length,32);assert.equal(activePacks.length,30);
    for(const [key,product] of activePacks) for(const first of ['count','initializer','book','cumulative','signature','date-counter','together']) {
      now=product.startAt || 1702519200;await fresh(`first-${key}-${first}`);
      const amounts=new Map();
      for(const content of master.shopPacks[product.rewardId].contents) if(content.type===0)
        amounts.set(content.rewardId,(amounts.get(content.rewardId)??0)+content.amount*product.amount);
      const pcAmounts=[...amounts].filter(([id])=>ids.includes(id)),others=new Map();
      put('UserPCTicket',[]);put('UserShopProduct',[]);put('UserEquipment',[]);
      for(const [id] of [...amounts].filter(([id])=>!ids.includes(id))) {
        const profile=master.itemProfiles[id],dated=profile.table==='UserGachaTicket';
        assert.ok(dated || ['UserExpItem','UserStatusBoardItem'].includes(profile.table));
        const item={userId:seed.userId,[profile.idField]:id,cumulativeAmount:100,signature:0xffffffff,
          bookEntryState:dated?-128:255,...(dated?{dateList:[]}:{amount:7,reservedAmount:0})};
        if(!others.has(profile.table)) others.set(profile.table,[]);others.get(profile.table).push(item);
      }
      for(const [table,items] of others) put(table,items);
      assert.equal(product.priceType,1);app.store.changePaidCurrency(product.price+100,'Deferred first-ticket fixture funding');
      const gifts=[gift(1,pcAmounts[0][0],1)];put('UserGift',gifts);
      const body={shopProductId:Number(key)},bought=parse(await send('shop/buy',body)),operation=bought.operations.find(row=>row.type===9000),
        wallet=[app.store.hardCurrency(),app.store.paidCurrency()],claims=pcAmounts.map(([id])=>
          app.store.db.prepare('SELECT * FROM shop_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,id)),
        sourceBefore=claims.map(claim=>claim.gacha_state),initial=pcAmounts.map(([id])=>({userId:seed.userId,pcTicketId:id,
          dateList:[],bookEntryState:1,signature:0,cumulativeAmount:0})),
        final=pcAmounts.map(([id,quantity])=>({userId:seed.userId,pcTicketId:id,dateList:[],bookEntryState:3,
          signature:operation.signature,cumulativeAmount:quantity}));
      assert.deepEqual(rows('UserPCTicket'),[],'First-ticket issue is a private baseline, not a native inventory prewrite');
      for(let index=0;index<claims.length;index++) {
        const capture=JSON.parse(sourceBefore[index]);assert.equal(capture.policy,'offline-shop-pc-ticket-first-v1');
        assert.equal(capture.beforeSignature,0);assert.equal(capture.beforeCumulative,0);assert.deepEqual(capture.beforeDates,[]);
        assert.equal(claims[index].cumulative_amount,pcAmounts[index][1]);assert.equal(claims[index].cap_version,1);
        assert.equal(JSON.parse(app.store.db.prepare('SELECT rewards FROM shop_request WHERE operation_id=?').get(operation.id).rewards)
          .find(reward=>reward.id===claims[index].item_id).capturePolicy,capture.policy);
      }
      const prefix=first==='count'?{UserShopProduct:[{userId:seed.userId,shopProductId:Number(key),count:bought.count,
        lastExchangedAt:bought.lastExchangedAt,readState:1}]}:{UserPCTicket:initial.map((row,index)=>first==='initializer'?row:
        first==='book'?{...row,bookEntryState:3}:first==='cumulative'?{...row,bookEntryState:3,cumulativeAmount:final[index].cumulativeAmount}:
          first==='signature'?{...row,signature:operation.signature}:first==='date-counter'?{...final[index],signature:0,
            dateList:Array.from({length:final[index].cumulativeAmount},()=>({aquiredAt:now}))}:final[index])};
      const partial=['cumulative','signature','date-counter'].includes(first);
      if(first==='initializer') {
        for(const changes of [{userId:0},{bookEntryState:2},{amount:1},{dateList:[{aquiredAt:now}]},{signature:0x100000000}])
          await reject(push({UserPCTicket:initial.map((row,index)=>index?row:{...row,...changes})}),400);
      }
      parse(await push(prefix));await close();await open();
      if(partial) await reject(send('user_data/confirm'));
      else assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id).parameters.boughtItems,
        operation.parameters.boughtItems.filter(item=>first!=='together' || !ids.includes(item.itemId)));
      await reject(push({},[operation]),400); // Ticket observation alone is not a full bundle/purchase ACK.
      app.store.db.exec("CREATE TRIGGER pc_ticket_first_fail BEFORE UPDATE ON shop_item_claim BEGIN SELECT RAISE(ABORT,'first-ticket capture rollback'); END");
      await reject(push({UserPCTicket:final}));app.store.db.exec('DROP TRIGGER pc_ticket_first_fail');
      parse(await push({UserPCTicket:final}));await close();await open();
      const recovered=parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id);
      assert.deepEqual(recovered.parameters.boughtItems,operation.parameters.boughtItems.filter(item=>!ids.includes(item.itemId)));
      assert.deepEqual(recovered.parameters.boughtEquipments,operation.parameters.boughtEquipments);
      assert.deepEqual(recovered.parameters.boughtCostumes,operation.parameters.boughtCostumes);
      assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet,'Recovery never charges the original paid pack twice');
      await reject(send('gift/receive',{userId:seed.userId,giftIds:[1]}));
      await reject(push({UserPCTicket:final.map(row=>({...row,dateList:[{aquiredAt:now}]}))}),400);
      await reject(push({UserPCTicket:final.map(row=>({...row,bookEntryState:1}))}),400);
      await reject(push({},[],'TicketShopBuy',{UserPCTicket:final.map(row=>({pcTicketId:row.pcTicketId}))}),400);
      const retained=app.store.db.prepare('SELECT gacha_state FROM shop_item_claim WHERE operation_id=? AND item_id=?');
      const update=app.store.db.prepare('UPDATE shop_item_claim SET gacha_state=? WHERE operation_id=? AND item_id=?');
      const state=retained.get(operation.id,pcAmounts[0][0]).gacha_state;
      for(const change of [{policy:'offline-shop-gacha-v2'},{beforeSignature:1},{beforeCumulative:1},{beforeDates:[{aquiredAt:now}]}]) {
        update.run(JSON.stringify({...JSON.parse(state),...change}),operation.id,pcAmounts[0][0]);
        await reject(send('user_data/confirm'));update.run(state,operation.id,pcAmounts[0][0]);
      }
      assert.ok(app.store.operations().some(row=>row.id===operation.id),'Keep the real bundle handoff until every reward/count/date is saved');
    }
    console.log('Dated tickets:1599 written source contexts (839 Present,529 original selector costs,210 first-PC-pack prefixes,21 first-gacha-shop prefixes); no native acceptance');
  } finally {
    await close();const resolved=fs.realpathSync(directory);
    assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('danmemore-pc-ticket-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
