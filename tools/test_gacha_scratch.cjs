'use strict';

// DEFERRED synthetic saves/encrypted requests. NOT native reward or reset proof.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request, drawAcknowledgement } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = value => crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-gacha-scratch-'));
  let app, database, port, sequence = 0, now;
  const open = async () => {
    app = createServer({ database,seed,master,wallNowSeconds:() => now,log:() => {} });
    await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const put = (name,rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const fresh = async (name,id = 611000001,step = master.scratches[id].steps[0],tickets = 20) => {
    await close(); database = path.join(directory,`${name}.sqlite`);
    const lottery = Object.entries(master.lotteryScratches).find(([,links]) => links.some(link => link.scratchId === id))[0];
    now = master.lotteries[lottery].startAt+60; await open();
    put('UserScratch',[{ userId:0,scratchId:id,currentStepId:step.id,ticketAmount:tickets,loopCount:0 }]);
    put('UserScratchContent',[]);
  };
  const send = (action,value) => request(port,++sequence,value,String(sequence),action);
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
      ? [{ signature:0,trigger:'ScratchDraw',putItems,deleteItems }] : [],
    operations:operations.map(row => ({ id:row.id,verifier:row.token })),
  });
  const choose = async (index,id = 611000001,position = index) => {
    const original = crypto.randomInt;
    const state = app.store.read('UserScratch').data.find(row => row.scratchId === id);
    const step = master.scratches[id].steps.find(step => step.id === state.currentStepId),
      opened=app.store.read('UserScratchContent').data.filter(row=>row.scratchStepId===step.id && row.loopCount===state.loopCount),
      length = step.contents.filter(prize=>!opened.some(row=>row.scratchContentId===prize.id)).length;
    crypto.randomInt = (...args) => args.length === 1 && args[0] === length ? index : original(...args);
    try { return await send('scratch/draw',{ scratchId:id,position }); } finally { crypto.randomInt = original; }
  };
  const inventory = operation => {
    const target = app.store.gachaScratchReceipt(operation).targets[0], amount = operation.parameters.pickedItem.amount;
    const old = app.store.read(target.table_name).data.find(row => row[target.id_field] === target.item_id);
    const row = { ...(old ?? { userId:seed.userId,[target.id_field]:target.item_id,bookEntryState:3 }),
      signature:operation.signature,cumulativeAmount:target.cumulative_amount };
    if (target.table_name === 'UserGachaTicket') row.dateList = [ ...(old?.dateList ?? []),
      ...Array.from({ length:amount },() => ({ aquiredAt:now })) ];
    else {row.amount = (old?.amount ?? 0)+amount;row.reservedAmount=old?.reservedAmount ?? 0;}
    return { [target.table_name]:[row] };
  };
  const cardSave = operation => ({ UserScratch:[operation.parameters.UserScratch],UserScratchContent:operation.parameters.UserScratchContent });
  const save = async operation => parse(await push({ ...cardSave(operation),...inventory(operation) },[operation]));
  const body = (lotteryId,buttonType,drawCount = 1) => {
    const lottery = master.lotteries[lotteryId], button = lottery.buttons[buttonType-1];
    return { lotteryId,buttonIndex:buttonType,consumeAmount:button.consumeAmount,pickCount:button.pickCount,
      progressCount:0,currentStepIndex:0,isScratch:true,clientFreeHardCurrency:app.store.hardCurrency(),
      clientChargeHardCurrency:app.store.paidCurrency(),clientTotalHardCurrency:app.store.hardCurrency()+app.store.paidCurrency(),
      ...(button.consumeType === 2 ? { drawCount } : {}) };
  };
  try {
    let tested = 0;
    for (const [id,card] of Object.entries(master.scratches)) for (const step of card.steps) for (const [index,prize] of step.contents.entries())
      for(const owned of [false,true]) {
      await fresh(`prize-${prize.id}-${owned}`,Number(id),step);
      if(owned) {
        const profile=master.itemProfiles[prize.itemId],dated=profile.table==='UserGachaTicket';
        put(profile.table,[{userId:seed.userId,[profile.idField]:prize.itemId,bookEntryState:3,signature:7,cumulativeAmount:20,
          ...(dated?{dateList:[{aquiredAt:now}]}:{amount:3,reservedAmount:0})}]);
      }
      const before = app.store.read('UserScratch'), stock = app.store.read(master.itemProfiles[prize.itemId].table), wallet = app.store.hardCurrency();
      const response = await choose(index,Number(id)), identity = sequence, result = parse(response), operation = result.operation;
      assert.equal(operation.type,18000); assert.deepEqual(result.operations,[operation]);
      if(owned) {
        const receipt=app.store.gachaScratchReceipt(operation);
        assert.equal(receipt.source.captureVersion,1);assert.equal(receipt.targets[0].cap_version,1);
        assert.equal(receipt.targets[0].cumulative_amount,20+prize.amount);
      }
      assert.deepEqual(result.pickedItem,{ itemId:prize.itemId,amount:prize.amount,scratchContentId:prize.id });
      assert.equal(result.UserScratch.ticketAmount,19); assert.equal(result.UserScratchContent[0].scratchStepId,step.id);
      assert.deepEqual(app.store.read('UserScratch'),before); assert.deepEqual(app.store.read(master.itemProfiles[prize.itemId].table),stock);
      assert.equal(app.store.hardCurrency(),wallet);
      if (prize.special && card.steps.length === 1) assert.equal(result.UserScratch.loopCount,1);
      else assert.equal(result.UserScratch.currentStepId,prize.special ? card.steps[Math.min(step.index,card.steps.length-1)].id : step.id);
      await reject(push({},[operation]),400);
      parse(await push({ UserScratch:[result.UserScratch] })); await close(); await open();
      await reject(push({},[operation]),400); parse(await push({ UserScratchContent:result.UserScratchContent }));
      await reject(push({},[operation]),400);
      const acquired = inventory(operation); parse(await push(acquired,[operation]));
      await close(); await open(); assert.equal(app.store.operations().length,0);
      const settled=parse(await request(port,identity,{ scratchId:Number(id),position:index },String(identity),'scratch/draw'));
      assert.deepEqual(settled.operations,[]);assert.equal(Object.hasOwn(settled,'operation'),false);
      assert.deepEqual(settled.pickedItem,operation.parameters.pickedItem);
      app.store.beginSession();
      assert.deepEqual(parse(await request(port,identity,{scratchId:Number(id),position:index},String(identity),'scratch/draw')).operations,[]);
      if(tested===0) {
        const source=app.store.db.prepare('SELECT * FROM gacha_scratch_claim WHERE operation_id=?').get(operation.id);
        app.store.db.prepare('UPDATE gacha_scratch_claim SET operation_json=NULL WHERE operation_id=?').run(operation.id);
        await reject(request(port,identity,{scratchId:Number(id),position:index},String(identity),'scratch/draw'),503,true);
        app.store.db.prepare('UPDATE gacha_scratch_claim SET operation_json=? WHERE operation_id=?').run(source.operation_json,operation.id);
        app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(operation.id);
        await reject(request(port,identity,{scratchId:Number(id),position:index},String(identity),'scratch/draw'),503,true);
        app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(operation.id);
        app.store.db.prepare('INSERT INTO operation_queue(id,type,parameters,token,signature) VALUES(?,?,?,?,?)')
          .run(operation.id,operation.type,JSON.stringify(operation.parameters),operation.token,operation.signature);
        await reject(request(port,identity,{scratchId:Number(id),position:index},String(identity),'scratch/draw'),503,true);
        app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(operation.id);
        const floor=app.store.db.prepare('SELECT * FROM gacha_scratch_state WHERE scratch_id=?').get(Number(id));
        app.store.db.prepare("UPDATE gacha_scratch_state SET contents_json='[]' WHERE scratch_id=?").run(Number(id));
        await reject(request(port,identity,{scratchId:Number(id),position:index},String(identity),'scratch/draw'),503,true);
        app.store.db.prepare('UPDATE gacha_scratch_state SET contents_json=? WHERE scratch_id=?').run(floor.contents_json,Number(id));
        const itemProfile=master.itemProfiles[prize.itemId],savedRows=app.store.read(itemProfile.table).data;
        put(itemProfile.table,[]);await reject(request(port,identity,{scratchId:Number(id),position:index},String(identity),'scratch/draw'),503,true);
        put(itemProfile.table,savedRows);
      }
      await reject(push({ UserScratch:before.data }),400);
      await reject(push({},[],{ UserScratchContent:[{ scratchContentId:prize.id }] }),400);
      const profile = master.itemProfiles[prize.itemId], item = acquired[profile.table][0];
      await reject(push({ [profile.table]:[{ ...item,cumulativeAmount:item.cumulativeAmount-1 }] }),400);
      tested++;
    }
    assert.equal(tested,320); // All160 original prizes, with original seed and explicitly owned baselines.

    // WRITTEN ONLY: an old exact identity remains replayable after every later
    // completed claim forms one continuous card/board chain. Broken, pending or
    // identity-swapped successors must retain the save and refuse the replay.
    await fresh('settled-later-draw-chain');
    const firstResponse=await choose(0,611000001,0),firstIdentity=sequence,firstResult=parse(firstResponse),first=firstResult.operation;
    await save(first);
    const secondResponse=await choose(0,611000001,1),second=parse(secondResponse).operation,
      secondItems=inventory(second),secondTable=Object.keys(secondItems)[0];
    await save(second);await close();await open();
    const finalCard=app.store.read('UserScratch'),finalBoard=app.store.read('UserScratchContent'),finalInventory=app.store.read(secondTable),
      finalWallet=[app.store.hardCurrency(),app.store.paidCurrency()],finalQueue=app.store.operations(),
      oldReplay=parse(await request(port,firstIdentity,{scratchId:611000001,position:0},String(firstIdentity),'scratch/draw')),
      secondClaim=app.store.db.prepare('SELECT * FROM gacha_scratch_claim WHERE operation_id=?').get(second.id);
    assert.deepEqual(oldReplay.operations,[]);assert.equal(Object.hasOwn(oldReplay,'operation'),false);
    assert.deepEqual(oldReplay.pickedItem,first.parameters.pickedItem);assert.deepEqual(oldReplay.UserScratch,first.parameters.UserScratch);
    assert.deepEqual(app.store.read('UserScratch'),finalCard);assert.deepEqual(app.store.read('UserScratchContent'),finalBoard);
    assert.deepEqual(app.store.read(secondTable),finalInventory);assert.deepEqual(app.store.operations(),finalQueue);
    assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],finalWallet);
    put(secondTable,[]);
    await reject(request(port,firstIdentity,{scratchId:611000001,position:0},String(firstIdentity),'scratch/draw'),503,true);
    put(secondTable,finalInventory.data);
    app.store.db.prepare('UPDATE gacha_scratch_claim SET operation_json=? WHERE operation_id=?').run(JSON.stringify(first),second.id);
    await reject(request(port,firstIdentity,{scratchId:611000001,position:0},String(firstIdentity),'scratch/draw'),503,true);
    app.store.db.prepare('UPDATE gacha_scratch_claim SET operation_json=? WHERE operation_id=?').run(secondClaim.operation_json,second.id);
    app.store.db.prepare('UPDATE gacha_scratch_claim SET operation_json=NULL WHERE operation_id=?').run(second.id);
    await reject(request(port,firstIdentity,{scratchId:611000001,position:0},String(firstIdentity),'scratch/draw'),503,true);
    app.store.db.prepare('UPDATE gacha_scratch_claim SET operation_json=? WHERE operation_id=?').run(secondClaim.operation_json,second.id);
    const secondColumns=Object.keys(secondClaim);
    app.store.db.prepare('DELETE FROM gacha_scratch_claim WHERE operation_id=?').run(second.id);
    await reject(request(port,firstIdentity,{scratchId:611000001,position:0},String(firstIdentity),'scratch/draw'),503,true);
    app.store.db.prepare(`INSERT INTO gacha_scratch_claim(${secondColumns.join(',')}) VALUES(${secondColumns.map(()=>'?').join(',')})`)
      .run(...Object.values(secondClaim));
    app.store.db.prepare('UPDATE gacha_scratch_claim SET before_json=after_json WHERE operation_id=?').run(second.id);
    await reject(request(port,firstIdentity,{scratchId:611000001,position:0},String(firstIdentity),'scratch/draw'),503,true);
    app.store.db.prepare('UPDATE gacha_scratch_claim SET before_json=? WHERE operation_id=?').run(secondClaim.before_json,second.id);
    app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(second.id);
    await reject(request(port,firstIdentity,{scratchId:611000001,position:0},String(firstIdentity),'scratch/draw'),503,true);
    app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(second.id);
    app.store.db.prepare('INSERT INTO operation_queue(id,type,parameters,token,signature) VALUES(?,?,?,?,?)')
      .run(second.id,second.type,JSON.stringify(second.parameters),second.token,second.signature);
    await reject(request(port,firstIdentity,{scratchId:611000001,position:0},String(firstIdentity),'scratch/draw'),503,true);
    app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(second.id);

    const linked=Object.entries(master.lotteryScratches).flatMap(([lotteryId,links])=>links.map(link=>({lotteryId:Number(lotteryId),link})))
      .find(({lotteryId,link})=>master.lotteries[lotteryId].buttons[link.buttonType-1].consumeType!==2);
    assert(linked);
    await fresh('settled-later-grant-chain',linked.link.scratchId);put('UserLottery',[]);
    app.store.changeHardCurrency(1000);app.store.changePaidCurrency(1000);
    const beforeGrantResponse=await choose(0,linked.link.scratchId,0),beforeGrantIdentity=sequence,
      beforeGrant=parse(beforeGrantResponse).operation;
    await save(beforeGrant);
    const grantInput=body(linked.lotteryId,linked.link.buttonType),grantResult=parse(await send('lottery/draw',grantInput)),grant=grantResult.operation;
    const unitsOnly=drawAcknowledgement(grantResult);unitsOnly.operations=[];
    parse(await send('user_data/push',unitsOnly));parse(await push({UserScratch:[grantResult.UserScratch]},[grant]));
    await close();await open();
    const grantWallet=[app.store.hardCurrency(),app.store.paidCurrency()],grantQueue=app.store.operations(),
      grantReplay=parse(await request(port,beforeGrantIdentity,{scratchId:linked.link.scratchId,position:0},
      String(beforeGrantIdentity),'scratch/draw'));
    assert.deepEqual(grantReplay.operations,[]);assert.deepEqual(grantReplay.pickedItem,beforeGrant.parameters.pickedItem);
    assert.deepEqual(app.store.read('UserScratch').data,[grantResult.UserScratch]);assert.deepEqual(app.store.operations(),grantQueue);
    assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],grantWallet);
    const grantClaim=app.store.db.prepare('SELECT operation_json FROM gacha_scratch_claim WHERE operation_id=?').get(grant.id);
    app.store.db.prepare('UPDATE gacha_scratch_claim SET operation_json=NULL WHERE operation_id=?').run(grant.id);
    await reject(request(port,beforeGrantIdentity,{scratchId:linked.link.scratchId,position:0},
      String(beforeGrantIdentity),'scratch/draw'),503,true);
    app.store.db.prepare('UPDATE gacha_scratch_claim SET operation_json=? WHERE operation_id=?').run(grantClaim.operation_json,grant.id);

    // WRITTEN ONLY: original six reward families; funding, save prefixes and
    // timestamps are synthetic fixtures, not natural client acceptance.
    const capPrizes=new Map(),MAX=999999999;
    for(const [id,card] of Object.entries(master.scratches)) for(const step of card.steps)
      for(const [index,prize] of step.contents.entries()) {
        const profile=master.itemProfiles[prize.itemId],previous=capPrizes.get(profile.table);
        if(!previous || previous.prize.amount<prize.amount) capPrizes.set(profile.table,{id:Number(id),step,index,prize,profile});
      }
    assert.equal(capPrizes.size,6);
    for(const {id,step,index,prize,profile} of capPrizes.values()) {
      const dated=profile.table==='UserGachaTicket',baselines=[...new Set([20,MAX-prize.amount-1,MAX-prize.amount,MAX-1,MAX])];
      for(const cumulative of baselines) for(const full of dated?[false]:[false,true])
        for(const order of ['stock-first','lifetime-first','signature-first','spent-first']) {
          await fresh(`cap-${prize.id}-${cumulative}-${full}-${order}`,id,step);
          const old={userId:seed.userId,[profile.idField]:prize.itemId,bookEntryState:dated?-128:255,signature:0xffffffff,cumulativeAmount:cumulative,
            ...(dated?{dateList:[{aquiredAt:now}]}:{amount:full?MAX:3,reservedAmount:0})};
          put(profile.table,[old]);
          const untouched=app.store.read(profile.table),response=await choose(index,id),identity=sequence,
            operation=parse(response).operation,target=app.store.gachaScratchReceipt(operation).targets[0],
            column=dated?'gacha_state':'stock_state',capture=JSON.parse(target[column]);
          assert.equal(target.cap_version,1);assert.equal(target.cumulative_amount,Math.min(MAX,cumulative+prize.amount));
          assert.equal(capture.beforeCumulative,cumulative);assert.equal(capture.beforeSignature,0xffffffff);
          assert.equal(capture.signature,operation.signature);assert.notEqual(operation.signature,old.signature);
          assert.equal(operation.parameters.pickedItem.amount,prize.amount);
          assert.deepEqual(app.store.read(profile.table),untouched);
          assert.equal(app.store.db.prepare('SELECT operation_json FROM gacha_scratch_claim WHERE operation_id=?').get(operation.id).operation_json,
            JSON.stringify(operation));
          assert.equal(app.store.db.prepare('SELECT capped_item_id FROM gacha_scratch_claim WHERE operation_id=?').get(operation.id).capped_item_id,prize.itemId);
          assert.equal(app.store.gachaScratchReceipt(operation).source.captureVersion,1);
          await reject(push({},[operation]),400);
          if(target.cumulative_amount<MAX) await reject(push({[profile.table]:[{...old,
            cumulativeAmount:target.cumulative_amount+1,signature:operation.signature}]}),400);
          if(dated) {
            const before=snapshot();
            assert.throws(()=>app.store.issueDraw([1011002001],{userGachaTicket:{...old,dateList:[]}},1000),/Capped Present tickets/);
            assert.equal(snapshot(),before);
          }
          await close();await open();
          assert.deepEqual((await request(port,identity,{scratchId:id,position:index},String(identity),'scratch/draw')).body,response.body);
          const after={...old,cumulativeAmount:target.cumulative_amount,signature:operation.signature,
            ...(dated?{dateList:[...old.dateList,...Array.from({length:prize.amount},()=>({aquiredAt:now+1}))]}:
              {amount:Math.min(MAX,old.amount+prize.amount)})},
            prefix=order==='stock-first'?{...old,...(dated?{dateList:after.dateList}:{amount:after.amount})}:
              order==='lifetime-first'?{...old,cumulativeAmount:target.cumulative_amount}:
                order==='signature-first'?{...old,signature:operation.signature}:
                  {...after,...(dated?{dateList:[]}:{amount:0})};
          const prefixObserved=prefix.cumulativeAmount===target.cumulative_amount && prefix.signature===operation.signature,
            changed=JSON.stringify(prefix)!==JSON.stringify(old);
          if(changed) {
            app.store.db.exec("CREATE TEMP TRIGGER fail_cap_scratch_save BEFORE UPDATE ON pve_item_claim BEGIN SELECT RAISE(ABORT,'cap save rollback'); END");
            await reject(push({[profile.table]:[prefix]}),503);
            app.store.db.exec('DROP TRIGGER fail_cap_scratch_save');
          }
          parse(await push({[profile.table]:[prefix]}));await close();await open();
          assert.equal(JSON.parse(app.store.gachaScratchReceipt(operation).targets[0][column]).observed,prefixObserved);
          if(!prefixObserved) await reject(push({},[operation]),400);
          if(changed) {
            await reject(request(port,identity,{scratchId:id,position:index},String(identity),'scratch/draw'),503,true);
            const pulled=parse(await send('user_data/confirm',null));
            if(prefixObserved) assert.deepEqual(pulled.operations.find(row=>row.id===operation.id),
              {...operation,parameters:{...operation.parameters,pickedItem:{...operation.parameters.pickedItem,amount:0}}});
            else assert(!pulled.operations?.some(row=>row.id===operation.id),'Unproven additive prefix must not be redelivered');
          }
          // Issued signature plus its exact target closes an acquisition even
          // when its stock was already spent/pruned before the first save.
          const final=prefixObserved?prefix:after;
          parse(await push({[profile.table]:[final]}));
          const completedCapture=JSON.parse(app.store.gachaScratchReceipt(operation).targets[0][column]);
          assert.equal(completedCapture.observed,true);assert.equal(completedCapture.effect,true);
          if(!dated) assert(completedCapture.amountAdded<=Math.min(MAX,old.amount+prize.amount)-old.amount);
          else assert(completedCapture.dateAdditions<=prize.amount);
          const coldResponse=await send('user_data/confirm',null),coldIdentity=sequence,
            coldOperation=parse(coldResponse).operations.find(row=>row.id===operation.id);
          assert.deepEqual(coldOperation,{...operation,parameters:{...operation.parameters,
            pickedItem:{...operation.parameters.pickedItem,amount:0}}});
          assert.deepEqual(app.store.operations(),[operation]);
          assert.deepEqual(app.store.read(profile.table).data,[final]);
          await close();await open();
          assert.deepEqual((await request(port,coldIdentity,null,String(coldIdentity),'user_data/confirm')).body,coldResponse.body);
          await reject(push({},[operation]),400);
          const corrupted={...completedCapture,[dated?'dateAdditions':'amountAdded']:
            (dated?prize.amount:Math.min(MAX,old.amount+prize.amount)-old.amount)+1};
          app.store.db.prepare(`UPDATE pve_item_claim SET ${column}=? WHERE operation_id=?`).run(JSON.stringify(corrupted),operation.id);
          await reject(push({},[operation]),503,true);
          app.store.db.prepare(`UPDATE pve_item_claim SET ${column}=? WHERE operation_id=?`).run(JSON.stringify(completedCapture),operation.id);
          app.store.db.exec("CREATE TEMP TRIGGER fail_cap_scratch_ack BEFORE INSERT ON operation_done BEGIN SELECT RAISE(ABORT,'cap ACK rollback'); END");
          await reject(push(cardSave(operation),[operation]),503);app.store.db.exec('DROP TRIGGER fail_cap_scratch_ack');
          parse(await push(cardSave(operation),[operation]));await close();await open();
          assert.equal(app.store.db.prepare('SELECT operation_id FROM gacha_scratch_item_floor WHERE item_id=?').get(prize.itemId).operation_id,operation.id);
          await reject(request(port,identity,{scratchId:id,position:index},String(identity),'scratch/draw'),503,true);
          const spent={...final,...(dated?{dateList:[]}:{amount:0})};
          parse(await push({[profile.table]:[spent]}));await close();await open();
          await reject(push({[profile.table]:[after]}),400);
          await reject(push({[profile.table]:[{...spent,cumulativeAmount:target.cumulative_amount-1}]}),400);
          if(target.cumulative_amount<MAX) await reject(push({[profile.table]:[{...spent,cumulativeAmount:target.cumulative_amount+1}]}),400);
          await reject(push({},[],{[profile.table]:[{[profile.idField]:prize.itemId}]}),400);
          const source=app.store.db.prepare('SELECT operation_json FROM gacha_scratch_claim WHERE operation_id=?').get(operation.id);
          app.store.db.prepare('UPDATE gacha_scratch_claim SET operation_json=NULL WHERE operation_id=?').run(operation.id);
          await reject(push({[profile.table]:[spent]}),503,true);
          app.store.db.prepare('UPDATE gacha_scratch_claim SET operation_json=? WHERE operation_id=?').run(source.operation_json,operation.id);
          app.store.db.prepare('UPDATE gacha_scratch_claim SET capped_item_id=NULL WHERE operation_id=?').run(operation.id);
          await reject(push({[profile.table]:[spent]}),503,true);
          app.store.db.prepare('UPDATE gacha_scratch_claim SET capped_item_id=? WHERE operation_id=?').run(prize.itemId,operation.id);
          app.store.db.prepare('DELETE FROM gacha_scratch_item_floor WHERE item_id=?').run(prize.itemId);
          await reject(push({[profile.table]:[spent]}),503,true);
          app.store.db.prepare('INSERT INTO gacha_scratch_item_floor(item_id,operation_id) VALUES(?,?)').run(prize.itemId,operation.id);
          app.store.db.prepare('UPDATE gacha_scratch_item_floor SET operation_id=? WHERE item_id=?').run(operation.id+1,prize.itemId);
          await reject(push({[profile.table]:[spent]}),503,true);
          app.store.db.prepare('UPDATE gacha_scratch_item_floor SET operation_id=? WHERE item_id=?').run(operation.id,prize.itemId);
          const originalTarget=app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').get(operation.id);
          app.store.db.prepare('DELETE FROM pve_item_claim WHERE operation_id=?').run(operation.id);
          await reject(push({[profile.table]:[spent]}),503,true);
          const columns=Object.keys(originalTarget);
          app.store.db.prepare(`INSERT INTO pve_item_claim(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`)
            .run(...Object.values(originalTarget));
          if(target.cumulative_amount<MAX) {
            const originalSource=app.store.db.prepare('SELECT source_json FROM gacha_scratch_claim WHERE operation_id=?').get(operation.id).source_json;
            app.store.db.prepare('UPDATE gacha_scratch_claim SET source_json=? WHERE operation_id=?').run(JSON.stringify({position:index}),operation.id);
            await reject(push({[profile.table]:[spent]}),503,true);
            app.store.db.prepare('UPDATE gacha_scratch_claim SET source_json=? WHERE operation_id=?').run(originalSource,operation.id);
            const originalClaim=app.store.db.prepare('SELECT * FROM gacha_scratch_claim WHERE operation_id=?').get(operation.id),
              claimColumns=Object.keys(originalClaim);
            app.store.db.prepare('DELETE FROM gacha_scratch_claim WHERE operation_id=?').run(operation.id);
            app.store.db.prepare('DELETE FROM gacha_scratch_item_floor WHERE item_id=?').run(prize.itemId);
            await reject(push({[profile.table]:[spent]}),503,true);
            app.store.db.prepare(`INSERT INTO gacha_scratch_claim(${claimColumns.join(',')}) VALUES(${claimColumns.map(()=>'?').join(',')})`)
              .run(...Object.values(originalClaim));
            app.store.db.prepare('INSERT INTO gacha_scratch_item_floor(item_id,operation_id) VALUES(?,?)').run(prize.itemId,operation.id);
          }
          parse(await push({[profile.table]:[spent]}));
          if(dated) {
            const before=snapshot();
            assert.throws(()=>app.store.issueDraw([1011002001],{userGachaTicket:{...spent,dateList:after.dateList}},1000),/cannot be restored/);
            assert.equal(snapshot(),before);
          }
        }
    }

    // WRITTEN ONLY: required18000 pickedItem keeps its native identity with
    // zero quantity only after actual item acquisition; absolute flags still save.
    for(const {id,step,index,prize,profile} of capPrizes.values())
      for(const flags of ['none','card-only','board-only']) for(const spentFirst of [false,true]) for(const cumulative of [20,MAX]) {
        await fresh(`cold-scratch-${prize.id}-${flags}-${spentFirst}-${cumulative}`,id,step);
        const dated=profile.table==='UserGachaTicket',column=dated?'gacha_state':'stock_state',
          old={userId:seed.userId,[profile.idField]:prize.itemId,bookEntryState:3,signature:7,cumulativeAmount:cumulative,
            ...(dated?{dateList:[{aquiredAt:now}]}:{amount:3,reservedAmount:0})};
        put(profile.table,[old]);
        const response=await choose(index,id),hotIdentity=sequence,operation=parse(response).operation,
          awarded={...old,cumulativeAmount:Math.min(MAX,cumulative+prize.amount),signature:operation.signature,...(dated?
            {dateList:spentFirst?[]:[...old.dateList,...Array.from({length:prize.amount},()=>({aquiredAt:now+1}))]}:
            {amount:spentFirst?0:old.amount+prize.amount})};
        parse(await push({[profile.table]:[awarded]}));
        if(flags==='card-only') parse(await push({UserScratch:[operation.parameters.UserScratch]}));
        if(flags==='board-only') parse(await push({UserScratchContent:operation.parameters.UserScratchContent}));
        await close();await open();
        const nativeBefore=app.store.read(profile.table),wallet=app.store.hardCurrency(),queueBefore=app.store.operations(),
          sourceBefore=app.store.db.prepare('SELECT * FROM gacha_scratch_claim WHERE operation_id=?').get(operation.id),
          capBefore=app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').get(operation.id),
          firstCold=await send('user_data/confirm',null),coldIdentity=sequence,
          cold=parse(firstCold).operations.find(row=>row.id===operation.id);
        assert.deepEqual(cold,{...operation,parameters:{...operation.parameters,pickedItem:{...operation.parameters.pickedItem,amount:0}}});
        assert.equal(cold.parameters.pickedItem.itemId,prize.itemId);
        assert.equal(cold.parameters.pickedItem.scratchContentId,prize.id);
        assert.equal(cold.signature,operation.signature);assert.equal(cold.token,operation.token);
        assert.deepEqual(app.store.operations(),queueBefore);assert.deepEqual(app.store.read(profile.table),nativeBefore);
        assert.equal(app.store.hardCurrency(),wallet);
        assert.deepEqual(app.store.db.prepare('SELECT * FROM gacha_scratch_claim WHERE operation_id=?').get(operation.id),sourceBefore);
        assert.deepEqual(app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').get(operation.id),capBefore);
        assert.throws(()=>app.store.gachaScratchReceipt(cold),/durable receipt/);
        assert.throws(()=>app.store.gachaScratchRecovery({...operation,parameters:{...operation.parameters,
          pickedItem:{...operation.parameters.pickedItem,amount:prize.amount+1}}}),/durable receipt/);
        await reject(request(port,hotIdentity,{scratchId:id,position:index},String(hotIdentity),'scratch/draw'),503,true);
        await reject(send('scratch/draw',{scratchId:id,position:index}),503,true);
        await reject(push({},[cold]),400);
        app.store.db.prepare(`UPDATE pve_item_claim SET ${column}=? WHERE operation_id=?`).run(
          JSON.stringify({...JSON.parse(capBefore[column]),observed:false}),operation.id);
        await reject(send('user_data/confirm',null),503,true);
        app.store.db.prepare(`UPDATE pve_item_claim SET ${column}=? WHERE operation_id=?`).run(capBefore[column],operation.id);
        app.store.db.prepare('UPDATE gacha_scratch_claim SET operation_json=NULL WHERE operation_id=?').run(operation.id);
        await reject(send('user_data/confirm',null),503,true);
        app.store.db.prepare('UPDATE gacha_scratch_claim SET operation_json=? WHERE operation_id=?').run(sourceBefore.operation_json,operation.id);
        await close();await open();
        assert.deepEqual((await request(port,coldIdentity,null,String(coldIdentity),'user_data/confirm')).body,firstCold.body);
        app.store.beginSession();
        assert.deepEqual((await request(port,coldIdentity,null,String(coldIdentity),'user_data/confirm')).body,firstCold.body);
        parse(await push(cardSave(cold)));await close();await open();
        assert.deepEqual(app.store.read(profile.table),nativeBefore);
        parse(await push(cardSave(cold)));await close();await open();
        assert.deepEqual(app.store.read(profile.table),nativeBefore);
        app.store.db.exec("CREATE TEMP TRIGGER fail_cold_scratch_ack BEFORE INSERT ON operation_done BEGIN SELECT RAISE(ABORT,'cold scratch ACK rollback'); END");
        await reject(push({},[cold]),503);app.store.db.exec('DROP TRIGGER fail_cold_scratch_ack');
        app.store.db.exec("CREATE TEMP TRIGGER fail_cold_scratch_floor BEFORE INSERT ON gacha_scratch_item_floor BEGIN SELECT RAISE(ABORT,'cold scratch floor rollback'); END");
        await reject(push({},[cold]),503);app.store.db.exec('DROP TRIGGER fail_cold_scratch_floor');
        parse(await push({},[cold]));await close();await open();
        assert.equal(app.store.operations().length,0);assert.deepEqual(app.store.read(profile.table),nativeBefore);
        assert.deepEqual(parse(await request(port,hotIdentity,{scratchId:id,position:index},String(hotIdentity),'scratch/draw')).operations,[]);
        if(flags==='none' && !spentFirst && cumulative===20) {
          const completed=app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').get(operation.id),
            capture=JSON.parse(completed[column]);
          app.store.db.prepare(`UPDATE pve_item_claim SET ${column}=? WHERE operation_id=?`)
            .run(JSON.stringify({...capture,observed:false}),operation.id);
          await reject(request(port,hotIdentity,{scratchId:id,position:index},String(hotIdentity),'scratch/draw'),503,true);
          app.store.db.prepare(`UPDATE pve_item_claim SET ${column}=? WHERE operation_id=?`).run(completed[column],operation.id);
          app.store.db.prepare('DELETE FROM gacha_scratch_item_floor WHERE item_id=?').run(prize.itemId);
          await reject(request(port,hotIdentity,{scratchId:id,position:index},String(hotIdentity),'scratch/draw'),503,true);
          app.store.db.prepare('INSERT INTO gacha_scratch_item_floor(item_id,operation_id) VALUES(?,?)').run(prize.itemId,operation.id);
        }
        await reject(request(port,coldIdentity,null,String(coldIdentity),'user_data/confirm'),503,true);
        assert.equal(app.store.db.prepare('SELECT operation_id FROM gacha_scratch_item_floor WHERE item_id=?').get(prize.itemId).operation_id,operation.id);
      }

    // WRITTEN ONLY: all six authentic item-table families from an absent row.
    // Numeric rows remain ordinary cap-version-0 acquisitions; the original
    // dated Gacha Ticket uses its native first-constructor capture.
    let corruptedOrdinary=false,ordinaryCold=0;
    for(const {id,step,index,prize,profile} of capPrizes.values()) {
      await fresh(`ordinary-absent-cold-${prize.id}`,id,step);put(profile.table,[]);
      const response=await choose(index,id),hotIdentity=sequence,operation=parse(response).operation,
        receipt=app.store.gachaScratchReceipt(operation),target=receipt.targets[0],dated=profile.table==='UserGachaTicket';
      assert.equal(receipt.acquisition_before,0);assert.equal(target.cumulative_amount,prize.amount);
      assert.equal(target.cap_version,dated?1:0);
      if(dated) {
        const capture=JSON.parse(target.gacha_state);
        assert.equal(target.stock_state,null);assert.equal(capture.policy,'offline-gacha-scratch-gacha-first-v1');
        assert.equal(capture.beforeCumulative,0);assert.deepEqual(capture.beforeDates,[]);assert.equal(capture.beforeSignature,0);
      } else {assert.equal(target.stock_state,null);assert.equal(target.gacha_state,null);}
      const awarded=inventory(operation);parse(await push(awarded));await close();await open();
      if(!dated && !corruptedOrdinary) {
        app.store.db.prepare('UPDATE pve_item_claim SET cap_version=1 WHERE operation_id=?').run(operation.id);
        await reject(send('user_data/confirm',null),503,true);
        app.store.db.prepare('UPDATE pve_item_claim SET cap_version=0 WHERE operation_id=?').run(operation.id);
        corruptedOrdinary=true;
      }
      const queueBefore=app.store.operations(),savedBefore=app.store.read(profile.table),coldResponse=await send('user_data/confirm',null),
        coldIdentity=sequence,cold=parse(coldResponse).operations.find(row=>row.id===operation.id);
      assert.deepEqual(cold,{...operation,parameters:{...operation.parameters,pickedItem:{...operation.parameters.pickedItem,amount:0}}});
      assert.deepEqual(app.store.operations(),queueBefore);assert.deepEqual(app.store.read(profile.table),savedBefore);
      await reject(request(port,hotIdentity,{scratchId:id,position:index},String(hotIdentity),'scratch/draw'),503,true);
      await reject(send('scratch/draw',{scratchId:id,position:index}),503,true);await reject(push({},[cold]),400);
      parse(await push(cardSave(cold)));parse(await push({},[cold]));await close();await open();
      assert.equal(app.store.operations().length,0);assert.deepEqual(app.store.read(profile.table),savedBefore);
      assert.deepEqual(parse(await request(port,hotIdentity,{scratchId:id,position:index},String(hotIdentity),'scratch/draw')).operations,[]);
      await reject(request(port,coldIdentity,null,String(coldIdentity),'user_data/confirm'),503,true);
      const row=savedBefore.data[0],rewound={...row,cumulativeAmount:prize.amount-1,
        ...(dated?{dateList:[]}:{amount:Math.max(0,prize.amount-1)})};
      await reject(push({[profile.table]:[rewound]}),400);
      await reject(push({},[],{[profile.table]:[{[profile.idField]:prize.itemId}]}),400);
      ordinaryCold++;
    }
    assert.equal(ordinaryCold,6);assert.equal(corruptedOrdinary,true);

    // A partially materialized additive first reward is ambiguous and must be
    // retained for reconciliation instead of replaying the full quantity.
    let partialOrdinary=0;
    for(const {id,step,index,prize,profile} of capPrizes.values()) if(profile.table!=='UserGachaTicket' && prize.amount>1) {
      await fresh(`ordinary-partial-${prize.id}`,id,step);put(profile.table,[]);
      const operation=parse(await choose(index,id)).operation,target=app.store.gachaScratchReceipt(operation).targets[0];
      assert.equal(target.cap_version,0);assert(prize.amount>1);
      put(profile.table,[{userId:seed.userId,[profile.idField]:prize.itemId,amount:1,reservedAmount:0,
        bookEntryState:3,signature:operation.signature,cumulativeAmount:1}]);
      await close();await open();const queueBefore=app.store.operations(),savedBefore=app.store.read(profile.table);
      await reject(send('user_data/confirm',null),503,true);
      assert.deepEqual(app.store.operations(),queueBefore);assert.deepEqual(app.store.read(profile.table),savedBefore);
      partialOrdinary++;
    }
    assert.equal(partialOrdinary,4);

    // A native empty first constructor is still the untouched baseline. It
    // must keep the positive prize until the real acquisition is saved.
    const emptyCase=[...capPrizes.values()].find(({profile})=>profile.table==='UserHeroSublimateItem');
    {
      const {id,step,index,prize,profile}=emptyCase;
      await fresh(`ordinary-empty-after-issue-${prize.id}`,id,step);put(profile.table,[]);
      const operation=parse(await choose(index,id)).operation;
      put(profile.table,[{userId:seed.userId,[profile.idField]:prize.itemId,amount:0,reservedAmount:0,
        bookEntryState:1,signature:0,cumulativeAmount:0}]);
      await close();await open();const cold=parse(await send('user_data/confirm',null)).operations.find(row=>row.id===operation.id);
      assert.deepEqual(cold,operation);assert.equal(cold.parameters.pickedItem.amount,prize.amount);
      const finalInventory=inventory(operation);finalInventory[profile.table][0].bookEntryState=3;
      parse(await push({...cardSave(operation),...finalInventory},[operation]));await close();await open();
      assert.equal(app.store.operations().length,0);
    }

    // WRITTEN ONLY: owned empty rows, not guessed native constructors.
    for(const {id,step,index,prize,profile} of capPrizes.values()) {
      await fresh(`ordinary-empty-${prize.id}`,id,step);
      const dated=profile.table==='UserGachaTicket',old={userId:seed.userId,[profile.idField]:prize.itemId,
        bookEntryState:3,signature:0,cumulativeAmount:0,...(dated?{dateList:[]}:{amount:0,reservedAmount:0})};
      put(profile.table,[old]);
      const operation=parse(await choose(index,id)).operation;
      assert.equal(app.store.gachaScratchReceipt(operation).targets[0].cumulative_amount,prize.amount);
      assert.notEqual(operation.signature,old.signature);
      await save(operation);await close();await open();
      assert.equal(app.store.operations().length,0);
      assert.equal(app.store.gachaScratchReceipt(operation,true).targets[0].cap_version,1);
    }

    // WRITTEN ONLY: original scratch quantities, synthetic Present source.
    // Same-item producers serialize; later legitimate gains keep old captures pure.
    for(const {id,step,index,prize,profile} of capPrizes.values()) for(const firstScratch of [false,true]) {
      await fresh(`ordinary-producer-${prize.id}-${firstScratch}`,id,step);
      const dated=profile.table==='UserGachaTicket',old={userId:seed.userId,[profile.idField]:prize.itemId,
        bookEntryState:3,signature:7,cumulativeAmount:20,...(dated?{dateList:[{aquiredAt:now}]}:{amount:3,reservedAmount:0})},
        gift={userId:seed.userId,id:1,itemId:prize.itemId,amount:prize.amount,title:'Synthetic ordinary scratch producer order',message:'',
          senderType:1,senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,
          pcLimitBreakCount:0,pcHeroSublimateCount:0,state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0};
      put(profile.table,[old]);put('UserGift',[gift]);
      const receive=()=>send('gift/receive',{userId:seed.userId,giftIds:[1]}),
        first=firstScratch?parse(await choose(index,id)).operation:parse(await receive()).operations[0];
      if(firstScratch) await reject(receive(),503,true);else await reject(choose(index,id),503,true);
      const awarded={...old,cumulativeAmount:20+prize.amount,signature:first.signature,...(dated?
        {dateList:[...old.dateList,...Array.from({length:prize.amount},()=>({aquiredAt:now+1}))]}:{amount:old.amount+prize.amount})},
        firstFlags=firstScratch?cardSave(first):{UserGift:[{...gift,state:1}]};
      parse(await push({...firstFlags,[profile.table]:[awarded]},[first]));await close();await open();
      const next=firstScratch?parse(await receive()).operations[0]:parse(await choose(index,id)).operation,
        final={...awarded,cumulativeAmount:20+2*prize.amount,signature:next.signature,...(dated?
          {dateList:[...awarded.dateList,...Array.from({length:prize.amount},()=>({aquiredAt:now+2}))]}:{amount:awarded.amount+prize.amount})},
        nextFlags=firstScratch?{UserGift:[{...gift,state:1}]}:cardSave(next);
      parse(await push({...nextFlags,[profile.table]:[final]},[next]));await close();await open();
      const scratch=firstScratch?first:next;
      assert.equal(app.store.operations().length,0);assert.equal(app.store.gachaScratchReceipt(scratch,true).targets[0].cap_version,1);
      const spent={...final,...(dated?{dateList:[]}:{amount:0})};parse(await push({[profile.table]:[spent]}));
      await reject(push({[profile.table]:[final]}),400);
    }

    const datedPrize=capPrizes.get('UserGachaTicket');
    for(const type of [1000,1001]) for(const cumulative of [20,MAX]) {
      const {id,step,index,prize,profile}=datedPrize;
      await fresh(`cap-scratch-prior-consumer-${type}-${cumulative}`,id,step);
      const before={userId:seed.userId,gachaTicketId:prize.itemId,bookEntryState:1,signature:0xffffffff,
        cumulativeAmount:cumulative,dateList:[{aquiredAt:now}]};
      put(profile.table,[before]);
      const consumer=app.store.issueDraw([1011002001],{userGachaTicket:{...before,dateList:[]}},type).operation;
      await reject(choose(index,id),503,true);
      assert(app.store.operations().some(row=>row.id===consumer.id));
    }

    // Every original link, including paid first-use, recurring 11 pulls,
    // ticket pulls and free New-Year draws. Imported currency is a prerequisite,
    // not proof of publisher purchase/unlock semantics.
    for (const [lotteryId,links] of Object.entries(master.lotteryScratches)) for (const link of links) {
      await fresh(`grant-${lotteryId}-${link.buttonType}`,link.scratchId); now = master.lotteries[lotteryId].startAt+60;
      put('UserScratch',[]); put('UserLottery',[]); app.store.changeHardCurrency(1000); app.store.changePaidCurrency(1000);
      const lottery = master.lotteries[lotteryId], button = lottery.buttons[link.buttonType-1], ticket = button.consumeType === 2;
      if (ticket) put('UserGachaTicket',[{ userId:seed.userId,gachaTicketId:lottery.ticketId,bookEntryState:1,
        signature:0,cumulativeAmount:3,dateList:Array.from({ length:3 },() => ({ aquiredAt:now })) }]);
      const input = body(Number(lotteryId),link.buttonType,ticket ? 3 : 1), action = ticket ? 'lottery/ticket/draw' : 'lottery/draw';
      const response = await send(action,input), identity = sequence, result = parse(response), operation = result.operation;
      assert.equal(result.UserScratch.ticketAmount,ticket ? 3 : 1); assert.equal(result.UserScratch.scratchId,link.scratchId);
      assert.deepEqual(app.store.read('UserScratch').data,[]);
      assert.deepEqual((await request(port,identity,input,String(identity),action)).body,response.body);
      await reject(request(port,identity,input,String(identity),'scratch/draw'),400);
      await reject(push({},[operation]),400);
      const unitsOnly = drawAcknowledgement(result); unitsOnly.operations = [];
      parse(await send('user_data/push',unitsOnly)); await reject(push({},[operation]),400);
      parse(await push({ UserScratch:[{ ...result.UserScratch,ticketAmount:0 }] }));
      parse(await push({ UserScratch:[result.UserScratch] },[operation])); await close(); await open();
      await reject(request(port,identity,input,String(identity),action),503,true);
      app.store.beginSession(); await reject(request(port,identity,input,String(identity),action),503,true);
      await reject(push({ UserScratch:[{ ...result.UserScratch,ticketAmount:0 }] }),400);
    }

    await fresh('validation');
    assert.match(app.store.db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name='pve_item_captured_source'").get().sql,
      /ON pve_item_claim\(item_id,operation_id DESC\) WHERE cap_version=1/);
    assert.match(app.store.db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name='gacha_scratch_history'").get().sql,
      /ON gacha_scratch_claim\(scratch_id,operation_id\)/);
    for (const value of [null,{}, { scratchId:611000001,position:-1 },{ scratchId:'611000001',position:0 },
      { scratchId:611000001,position:6 },{ scratchId:611000001,position:0,extra:true }])
      await reject(send('scratch/draw',value),400);
    await reject(send('scratch/draw',{ scratchId:42,position:0 }),503,true);
    await reject(send('unknown/scratch/draw',{ scratchId:611000001,position:0 }),503,true);
    await reject(send('ad/scratch/draw',{ scratchId:611000001,position:0 }),400);
    for (const change of [{ userId:9 },{ ticketAmount:-1 },{ loopCount:0x80000000 },{ currentStepId:42 }]) {
      const original = app.store.read('UserScratch').data[0]; put('UserScratch',[{ ...original,...change }]);
      await reject(choose(0),400); put('UserScratch',[original]);
    }
    const ordinary = parse(await choose(1)).operation; await save(ordinary);
    await reject(send('scratch/draw',{ scratchId:611000001,position:1 }),400);

    await fresh('history'); const queued = parse(await choose(0)).operation, identity = sequence;
    await close(); await open();
    assert.deepEqual(parse(await send('scratch/draw',{ scratchId:611000001,position:0 })).operation,queued);
    const receipt = app.store.db.prepare('SELECT * FROM gacha_scratch_claim WHERE operation_id=?').get(queued.id);
    app.store.db.prepare('UPDATE gacha_scratch_claim SET acquisition_before=acquisition_before+1 WHERE operation_id=?').run(queued.id);
    await reject(request(port,identity,{ scratchId:611000001,position:0 },String(identity),'scratch/draw'),503,true);
    await reject(push({},[queued]),503,true);
    app.store.db.prepare('UPDATE gacha_scratch_claim SET acquisition_before=? WHERE operation_id=?').run(receipt.acquisition_before,queued.id);
    app.store.db.exec("CREATE TEMP TRIGGER fail_scratch_floor BEFORE UPDATE ON gacha_scratch_state BEGIN SELECT RAISE(ABORT,'floor rollback'); END");
    await reject(push({ ...cardSave(queued),...inventory(queued) },[queued]),503);
    app.store.db.exec('DROP TRIGGER fail_scratch_floor'); await save(queued);

    await fresh('issue-rollback');
    app.store.db.exec("CREATE TEMP TRIGGER fail_scratch_claim BEFORE INSERT ON gacha_scratch_claim BEGIN SELECT RAISE(ABORT,'claim rollback'); END");
    await reject(choose(0),503); app.store.db.exec('DROP TRIGGER fail_scratch_claim');
    app.store.db.exec("CREATE TEMP TRIGGER fail_scratch_reply BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'reply rollback'); END");
    await reject(choose(0),503); app.store.db.exec('DROP TRIGGER fail_scratch_reply');
    console.log('Deferred gacha scratch catalog, six absent-item cold recoveries, four partial-item refusals, empty-constructor recovery, grants, save proofs, identity/alias separation, replay and rollback probes: OK');
  } finally { await close(); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
