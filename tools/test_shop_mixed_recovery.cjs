'use strict';

// WRITTEN ONLY / NOT RUN. Original shop catalog quantities are retained;
// synthetic funding, slots, flags and signatures are not native gameplay proof.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE,encodeMsgpack}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json');
const master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
const contents=product=>product.rewardType===2 || product.rewardType===4 && product.priceType===1?
  master.shopPacks[product.rewardId].contents:[{type:product.rewardType,rewardId:product.rewardId,amount:product.amount}];
const offers=Object.entries(master.shopProducts).filter(([,product])=>contents(product)?.some(row=>[3,4].includes(row.type)));

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-shop-mixed-'));
  let app,database,port,sequence=0,now;
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
  const retained=()=>JSON.stringify(['profile','operation_queue','operation_done','shop_request','shop_item_claim','shop_item_stock_floor',
    'shop_spend','costume_reward_claim','costume_unlock_floor','equipment_reward_claim','equipment_piece_claim','hard_currency']
    .map(name=>[name,app.store.db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()]));
  const reject=async(pending,status=503,raw=false)=>{
    const before=snapshot(),reply=await pending;assert.equal(reply.status,status,reply.body.toString());assert.equal(snapshot(),before);
    if(status===503) raw?assert.equal(reply.body.length,0):assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const push=(putItems={},operations=[],deleteItems={})=>send('user_data/push',{badges:null,scripts:{},dataTokens:{},
    checksums:{before:{},after:Object.fromEntries([...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])]
      .map(name=>[name,md5(putItems[name]??[])]))},
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length?[{signature:0,trigger:'ShopBuy',putItems,deleteItems}]:[],
    operations:operations.map(operation=>({id:operation.id,verifier:operation.token}))});
  const equipment=(id,slot,created=now)=>{
    const {type,...spec}=app.store.equipmentSpec(id),original=master.equipments[spec.equipmentId];
    return {userId:seed.userId,...spec,slotIndex:slot,createAt:created,exp:0,durability:original.durability,
      reservedDurability:original.durability,isProtected:false,isUnbreakable:false,
      ...Object.fromEntries(Array.from({length:5},(_,index)=>[`lockedAbility${index+1}`,false]))};
  };
  try {
    assert.equal(offers.length,33);
    //132 ordinary,8 capped,4 first-PC,4 first-ordinary and32 first-dated mixed-bundle contexts; original quantities are retained.
    for(const [id,product] of offers) for(const {first,cap} of ['count','date','reward','all'].flatMap(first=>
      [...(Number(id)===207004301?[null,999999998,999999999,'first','first-ordinary']:[null]),
        ...(contents(product).some(row=>row.type===0 && master.itemProfiles[row.rewardId]?.table==='UserGachaTicket')?['first-dated']:[])]
        .map(cap=>({first,cap})))) {
      now=product.startAt || 1686794400;await fresh(`${id}-${first}-${cap??'ordinary'}`);
      const productId=Number(id),packed=product.rewardType===2 || product.rewardType===4 && product.priceType===1,
        amounts=new Map(),costumes=new Set(),gear=new Map();
      for(const content of contents(product)) {
        const quantity=content.amount*(packed?product.amount:1);
        if(content.type===0) amounts.set(content.rewardId,(amounts.get(content.rewardId)??0)+quantity);
        else if(content.type===3) gear.set(content.rewardId,(gear.get(content.rewardId)??0)+quantity);
        else {assert.equal(content.type,4);assert.equal(quantity,1);costumes.add(content.rewardId);}
      }
      const beforeItems=new Map(),tables=new Set(['UserShopProduct','UserEquipment','UserCharacterCostume','UserCommunicationVoice']);
      for(const [itemId] of amounts) {
        const profile=master.itemProfiles[itemId],dated=['UserGachaTicket','UserPCTicket'].includes(profile.table),
          firstTicket=dated && (cap==='first-dated' || profile.table==='UserPCTicket' && cap==='first'),
          firstOrdinary=!dated && cap==='first-ordinary';tables.add(profile.table);
        beforeItems.set(itemId,{userId:seed.userId,[profile.idField]:itemId,
          cumulativeAmount:firstTicket||firstOrdinary?0:profile.table==='UserPCTicket'?cap??100:100,
          signature:firstTicket||firstOrdinary?0:0xffffffff,bookEntryState:firstTicket||firstOrdinary?1:dated?-128:255,
          ...(dated?{dateList:firstTicket?[]:[{aquiredAt:Math.max(0,now-(master.lotteryTickets[itemId]??2592000)-1)}]}:
            {amount:firstOrdinary?0:7,reservedAmount:0})});
      }
      for(const table of new Set([...beforeItems.keys()].map(itemId=>master.itemProfiles[itemId].table)))
        put(table,[...beforeItems].filter(([itemId])=>master.itemProfiles[itemId].table===table &&
          !(cap==='first' && table==='UserPCTicket' || cap==='first-dated' && ['UserPCTicket','UserGachaTicket'].includes(table) ||
            cap==='first-ordinary' && !['UserPCTicket','UserGachaTicket'].includes(table))).map(([,item])=>item));
      const costumeIds=[...costumes],linked=costumeIds.flatMap(costumeId=>Object.entries(master.communicationVoices)
        .filter(([,voice])=>voice.costumeId===costumeId).map(([voiceId])=>Number(voiceId))),
        preownedCostumes=first==='count'?costumeIds.map(costumeId=>({userId:0,costumeId,costumeState:3})):[],
        preownedVoices=linked.filter((_,index)=>first==='date' && index%2===0)
          .map(voiceId=>({userId:0,voiceId,voiceState:3}));
      put('UserCharacterCostume',preownedCostumes);put('UserCommunicationVoice',preownedVoices);put('UserShopProduct',[]);
      const slots={1:1,2:10001},firstGear=[...gear.keys()][0],oldGear=firstGear?
        [equipment(firstGear,slots[app.store.equipmentSpec(firstGear).type]++,now-1)]:[];
      put('UserEquipment',oldGear);
      if(product.priceType===2) {
        const profile=master.itemProfiles[product.priceItemId];tables.add(profile.table);
        const cost={userId:seed.userId,[profile.idField]:product.priceItemId,amount:product.price,cumulativeAmount:product.price,
          bookEntryState:3,signature:0,reservedAmount:0,exploit:false};
        assert.equal(profile.table,'UserKeyItem');put(profile.table,[cost]);parse(await push({[profile.table]:[{...cost,amount:0}]}));
      } else {assert.equal(product.priceType,1);app.store.changePaidCurrency(product.price+1000,'Deferred source fixture');}
      const beforeProfiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
        bought=parse(await send('shop/buy',{shopProductId:productId})),operation=bought.operation,hotIdentity=sequence,
        wallet=[app.store.hardCurrency(),app.store.paidCurrency()],itemTargets=app.store.db.prepare('SELECT * FROM shop_item_claim WHERE operation_id=?').all(operation.id),
        recoverable=itemTargets.every(target=>target.cap_version===1 || target.cap_version===0 && target.stock_state===null &&
          target.gacha_state===null && target.valis_state===null && target.valis_seen===0),reward={},pieces=[];
      assert.equal(operation.type,9000);assert.deepEqual(bought.operations,[operation]);
      assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),beforeProfiles,'No server inventory, wardrobe or equipment precredit');
      assert.equal(recoverable,true,'Original mixed offers retain typed owned captures or immutable first-constructor targets');
      for(const [itemId,item] of beforeItems) {
        const profile=master.itemProfiles[itemId],target=itemTargets.find(row=>row.item_id===itemId),quantity=amounts.get(itemId);
        (reward[profile.table]??=[]).push({...item,cumulativeAmount:target.cumulative_amount,signature:operation.signature,
          ...(item.cumulativeAmount===0?{bookEntryState:3}:{}),
          ...(['UserGachaTicket','UserPCTicket'].includes(profile.table)?{dateList:Array.from({length:quantity},()=>({aquiredAt:now}))}:{amount:item.amount+quantity})});
      }
      for(const [equipmentId,amount] of gear) for(let at=0;at<amount;at++) pieces.push(equipment(equipmentId,slots[app.store.equipmentSpec(equipmentId).type]++));
      if(pieces.length) reward.UserEquipment=pieces;
      const targets=app.store.costumeRewards(operation);
      if(targets.length) reward.UserCharacterCostume=targets.map(target=>({userId:0,costumeId:target.costumeId,costumeState:target.state}));
      const voices=targets.flatMap(target=>target.voices);
      if(voices.length) reward.UserCommunicationVoice=voices.map(voice=>({userId:0,voiceId:voice.voiceId,voiceState:voice.state}));
      const productRow={userId:seed.userId,shopProductId:productId,count:bought.count,lastExchangedAt:bought.lastExchangedAt,readState:1},
        savedReward=['reward','all'].includes(first),partial=first==='count'?{UserShopProduct:[{...productRow,lastExchangedAt:0}]}:
          first==='date'?{UserShopProduct:[{...productRow,count:0}]}:first==='reward'?reward:{...reward,UserShopProduct:[productRow]};
      await reject(push({},[operation]),400);parse(await push(partial));await close();await open();
      const expected={...operation,parameters:{...operation.parameters,
        boughtItems:savedReward?[]:operation.parameters.boughtItems,
        boughtEquipments:savedReward?[]:operation.parameters.boughtEquipments,
        boughtCostumes:savedReward || first==='count'?[]:operation.parameters.boughtCostumes}};
      if(recoverable) {
        const held=retained(),cold=await send('user_data/confirm'),identity=sequence;
        assert.deepEqual(parse(cold).operations,[expected]);parse(await send('user/login'));
        const names=[...tables],pulled=await send('user_data/pull',{tables:names});assert.equal(pulled.status,200);
        assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull({tables:names})));assert.equal(retained(),held);
        await close();await open();assert.deepEqual((await request(port,identity,undefined,String(identity),'user_data/confirm')).body,cold.body);
        const bad=JSON.parse(cold.body);bad.operations[0].parameters.boughtEquipments=[{equipmentId:24000006300,amount:0}];
        app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(Buffer.from(JSON.stringify(bad)).toString('base64'),`${identity}/${identity}`);
        await reject(request(port,identity,undefined,String(identity),'user_data/confirm'));
        app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(cold.body.toString('base64'),`${identity}/${identity}`);
        if(savedReward && pieces.length) {
          const claim=app.store.db.prepare('SELECT * FROM equipment_reward_claim WHERE operation_id=?').get(operation.id);
          app.store.db.prepare("UPDATE equipment_reward_claim SET observed='[]' WHERE operation_id=?").run(operation.id);
          await reject(send('user_data/confirm'));
          app.store.db.prepare('UPDATE equipment_reward_claim SET observed=? WHERE operation_id=?').run(claim.observed,operation.id);
          const proof=app.store.db.prepare('SELECT * FROM equipment_piece_claim WHERE operation_id=? LIMIT 1').get(operation.id);
          app.store.db.prepare('DELETE FROM equipment_piece_claim WHERE piece_key=?').run(proof.piece_key);await reject(send('user_data/confirm'));
          app.store.db.prepare('INSERT INTO equipment_piece_claim(piece_key,operation_id) VALUES(?,?)').run(proof.piece_key,proof.operation_id);
          app.store.db.prepare('UPDATE equipment_piece_claim SET operation_id=? WHERE piece_key=?').run(operation.id+1000,proof.piece_key);
          await reject(send('user_data/confirm'));
          app.store.db.prepare('UPDATE equipment_piece_claim SET operation_id=? WHERE piece_key=?').run(proof.operation_id,proof.piece_key);
          parse(await push({},[],{UserEquipment:pieces.map(piece=>({slotIndex:piece.slotIndex}))}));
          await reject(request(port,identity,undefined,String(identity),'user_data/confirm'));
          assert.deepEqual(parse(await send('user_data/confirm')).operations,[expected]);
        }
      } else {await reject(send('user_data/confirm'));await reject(send('user/login'));}
      await reject(send('shop/buy',{shopProductId:productId}));
      await reject(request(port,hotIdentity,{shopProductId:productId},String(hotIdentity),'shop/buy'));
      const completion={...reward,UserShopProduct:[productRow]};
      if(savedReward && pieces.length) delete completion.UserEquipment;
      parse(await push(completion));
      for(const [itemId] of amounts) {
        const profile=master.itemProfiles[itemId],item=rows(profile.table).find(row=>row[profile.idField]===itemId);
        parse(await push({[profile.table]:[{...item,...(['UserGachaTicket','UserPCTicket'].includes(profile.table)?{dateList:[]}:{amount:0})}]}));
      }
      if(recoverable) {
        const final={...operation,parameters:{...operation.parameters,boughtItems:[],boughtEquipments:[],boughtCostumes:[]}};
        assert.deepEqual(parse(await send('user_data/confirm')).operations,[final]);
      }
      for(const [table,event] of [['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT'],
        ...(targets.length?[['costume_unlock_floor','INSERT']]:[]),...(itemTargets.some(target=>target.cap_version===1)?[['shop_item_stock_floor','INSERT']]:[])]) {
        app.store.db.exec(`CREATE TRIGGER mixed_shop_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'mixed ACK rollback'); END`);
        await reject(push({},[operation]),503,true);app.store.db.exec('DROP TRIGGER mixed_shop_ack_fail');
      }
      parse(await push({},[operation]));await close();await open();assert.deepEqual(app.store.operations(),[]);
      assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM equipment_piece_claim WHERE operation_id=?').get(operation.id).n,pieces.length);
      if(savedReward && pieces.length) assert.deepEqual(rows('UserEquipment'),oldGear,'Observed sold rewards are not reconstructed at ACK');
      for(const target of targets) assert.equal(rows('UserCharacterCostume').find(row=>row.costumeId===target.costumeId).costumeState,target.state);
    }
    // Eight original multi-quantity item rows in pack207004301 can be first
    // constructors. A partial native save is neither untouched nor delivered.
    const partialProductId=207004301,partialProduct=master.shopProducts[partialProductId],
      partialContents=contents(partialProduct),partialOrdinary=partialContents.filter(content=>content.type===0 &&
        !['UserGachaTicket','UserPCTicket'].includes(master.itemProfiles[content.rewardId]?.table) && content.amount>1);
    assert.equal(partialOrdinary.length,8);
    for(const selected of partialOrdinary) {
      now=partialProduct.startAt;await fresh(`partial-first-ordinary-${selected.rewardId}`);put('UserShopProduct',[]);
      const inventories=new Map();
      for(const content of partialContents.filter(row=>row.type===0 && row.rewardId!==selected.rewardId)) {
        const profile=master.itemProfiles[content.rewardId],dated=['UserGachaTicket','UserPCTicket'].includes(profile.table),
          item={userId:seed.userId,[profile.idField]:content.rewardId,cumulativeAmount:100,signature:0xffffffff,
            bookEntryState:dated?-128:255,...(dated?{dateList:[]}:{amount:7,reservedAmount:0})};
        if(!inventories.has(profile.table)) inventories.set(profile.table,[]);
        inventories.get(profile.table).push(item);
      }
      for(const [table,inventory] of inventories) put(table,inventory);
      app.store.changePaidCurrency(partialProduct.price+1000,'Deferred source fixture');
      const operation=parse(await send('shop/buy',{shopProductId:partialProductId})).operation,
        target=app.store.db.prepare('SELECT * FROM shop_item_claim WHERE operation_id=? AND item_id=?')
          .get(operation.id,selected.rewardId),profile=master.itemProfiles[selected.rewardId],
        partial={userId:seed.userId,[profile.idField]:selected.rewardId,cumulativeAmount:1,signature:operation.signature,
          bookEntryState:3,amount:1,reservedAmount:0};
      assert.equal(target.cap_version,0);assert.equal(target.amount,selected.amount);
      assert.equal(target.cumulative_amount,selected.amount);assert.ok(selected.amount>1);
      put(profile.table,[...(inventories.get(profile.table)??[]),partial]);await close();await open();
      const before=snapshot();await reject(send('user_data/confirm'),503,before);await reject(send('user/login'),503,before);
      assert.deepEqual(app.store.operations(),[operation],'Partial first-constructor shop reward stays queued without additive replay');
    }
    // Two NEW voice-prefix contexts: original pack and original linked helper, actual owned ticket baseline.
    for(const component of ['voice-first','costume-first']) {
      const productId=207003535,product=master.shopProducts[productId],costumeId=1021002030,ticketId=296000014;
      now=product.startAt;await fresh(component);put('UserShopProduct',[]);put('UserCharacterCostume',[]);put('UserCommunicationVoice',[]);
      put('UserGachaTicket',[{userId:seed.userId,gachaTicketId:ticketId,bookEntryState:-128,cumulativeAmount:100,signature:0xffffffff,dateList:[]}]);
      app.store.changePaidCurrency(product.price+1000,'Deferred source fixture');
      const bought=parse(await send('shop/buy',{shopProductId:productId})),operation=bought.operation,target=app.store.costumeRewards(operation)[0],
        costume={userId:0,costumeId,costumeState:2},voices=target.voices.map(voice=>({userId:0,voiceId:voice.voiceId,voiceState:2})),
        first={...(component==='voice-first'?{UserCommunicationVoice:[{...voices[0],voiceState:3}]}:{UserCharacterCostume:[costume]})};
      assert.ok(voices.length>1);parse(await push(first));await close();await open();
      if(component==='voice-first') {
        assert.deepEqual(parse(await send('user_data/confirm')).operations,[operation]);parse(await send('user/login'));
      } else {await reject(send('user_data/confirm'));await reject(send('user/login'));}
      await reject(push({},[operation]),400);
      parse(await push({UserCharacterCostume:[costume],UserCommunicationVoice:voices.map((voice,index)=>component==='voice-first' && index===0?{...voice,voiceState:3}:voice),
        UserGachaTicket:[{userId:seed.userId,gachaTicketId:ticketId,bookEntryState:-128,cumulativeAmount:102,signature:operation.signature,
          dateList:Array.from({length:2},()=>({aquiredAt:now}))}],
        UserShopProduct:[{userId:seed.userId,shopProductId:productId,count:bought.count,lastExchangedAt:now,readState:1}]}));
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,parameters:{...operation.parameters,boughtItems:[],boughtCostumes:[]}}]);
      parse(await push({},[operation]));await close();await open();
      assert.equal(rows('UserCommunicationVoice')[0].voiceState,component==='voice-first'?3:2);
    }
    console.log('Mixed shop synthetic scenarios:190 written contexts (132 ordinary,8 capped,4 first-PC,4 first-ordinary,32 first-dated,8 partial-first-ordinary,2 voice prefixes); native acceptance unverified');
  } finally {
    await close();const resolved=fs.realpathSync(directory);
    assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('danmemore-shop-mixed-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
