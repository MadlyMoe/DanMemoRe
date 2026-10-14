'use strict';

// DEFERRED synthetic encrypted requests/saves. NOT native scratch/ad proof.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = value => crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
const scratchId = 614000001, stepId = 615000001;
const prizes = master.adScratches[scratchId].steps[0].contents;
const state = (extra = {}) => ({ userId:0,adScratchId:scratchId,ticketAmount:8,currentStepId:stepId,loopCount:0,...extra });
const input = position => ({ adScratchId:scratchId,position,advertisementType:2 });

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-ad-scratch-'));
  let app, port, database, sequence = 0, now = 1686794400;
  const open = async () => {
    app = createServer({ database,seed,master,wallNowSeconds:() => now,log:() => {} });
    await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const put = (name,rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const fresh = async name => {
    await close(); database = path.join(directory,`${name}.sqlite`); await open();
    put('UserAdScratch',[state()]); put('UserAdScratchContent',[]);
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
      ? [{ signature:0,trigger:'AdScratchDraw',putItems,deleteItems }] : [],
    operations:operations.map(row => ({ id:row.id,verifier:row.token })),
  });
  const choose = async (index,position = 0) => {
    const original = crypto.randomInt;
    const current=app.store.read('UserAdScratch').data.find(row=>row.adScratchId===scratchId),
      opened=app.store.read('UserAdScratchContent').data.filter(row=>row.adScratchStepId===stepId && row.loopCount===current.loopCount),
      remaining=prizes.filter(prize=>!opened.some(row=>row.adScratchContentId===prize.id)).length;
    crypto.randomInt = (min,max) => max === undefined && min === remaining ? index : original(min,max);
    try { return await send('ad/scratch/draw',input(position)); }
    finally { crypto.randomInt = original; }
  };
  const inventory = operation => {
    const target = app.store.adScratchReceipt(operation).targets[0];
    if (!target) return {};
    const original = app.store.read(target.table_name).data.find(row => row[target.id_field] === target.item_id);
    return { [target.table_name]:[{ ...(original ?? { userId:seed.userId,[target.id_field]:target.item_id,bookEntryState:1 }),
      amount:(original?.amount ?? 0)+operation.parameters.pickedItem.amount,reservedAmount:original?.reservedAmount ?? 0,
      signature:operation.signature,cumulativeAmount:target.cumulative_amount }] };
  };
  const cardSave = operation => ({ UserAdScratch:[operation.parameters.UserAdScratch],
    UserAdScratchContent:operation.parameters.UserAdScratchContent });
  const save = async operation => parse(await push({ ...cardSave(operation),...inventory(operation) },[operation]));
  try {
    assert.equal(prizes.length,6);
    for (const [index,prize] of prizes.entries()) for(const owned of prize.rewardKey==='currency.gem'?[false]:[false,true]) {
      await fresh(`original-${index}-${owned}`);
      if(owned) {
        const profile=master.itemProfiles[prize.itemId];
        put(profile.table,[{userId:seed.userId,[profile.idField]:prize.itemId,amount:3,reservedAmount:0,
          bookEntryState:3,signature:7,cumulativeAmount:20}]);
      }
      const before = { state:app.store.read('UserAdScratch'),contents:app.store.read('UserAdScratchContent') };
      const profile = master.itemProfiles[prize.itemId], stock = profile && app.store.read(profile.table);
      const wallet = app.store.hardCurrency(), response = await choose(index,index), identity = sequence;
      const result = parse(response), operation = result.operations[0];
      assert.equal(operation.type,26100); assert.deepEqual(result.operation,operation);
      const source=app.store.adScratchReceipt(operation);
      assert.equal(source.iris_history_id===null,!prize.special);
      if(owned) {assert.equal(source.capture_version,1);assert.equal(source.targets[0].cap_version,1);
        assert.equal(source.targets[0].cumulative_amount,20+prize.amount);}
      if(prize.rewardKey==='currency.gem') {
        assert.equal(source.capture_version,0);
        app.store.db.prepare('UPDATE ad_scratch_draw SET capture_version=1 WHERE operation_id=?').run(operation.id);
        await reject(send('user_data/confirm',null),503,true);
        assert.equal(app.store.hardCurrency(),wallet+10);
        app.store.db.prepare('UPDATE ad_scratch_draw SET capture_version=0 WHERE operation_id=?').run(operation.id);
      }
      assert.deepEqual(result.pickedItem,{ itemId:prize.itemId,amount:prize.amount });
      assert.equal(result.reset,Boolean(prize.special)); assert.equal(result.UserAdScratch.ticketAmount,7);
      assert.equal(result.UserAdScratch.loopCount,prize.special ? 1 : 0);
      assert.equal(result.UserAdScratchContent[0].position,index); assert.equal(result.UserAdScratchContent[0].loopCount,0);
      assert.deepEqual(app.store.read('UserAdScratch'),before.state); assert.deepEqual(app.store.read('UserAdScratchContent'),before.contents);
      if (!prize.special) assert.deepEqual(app.store.read(profile.table),stock);
      assert.equal(app.store.hardCurrency(),wallet+(prize.special ? 10 : 0));
      await reject(push({},[operation]),400);
      parse(await push({ UserAdScratch:[operation.parameters.UserAdScratch] }));
      await close(); await open(); await reject(push({},[operation]),400);
      parse(await push({ UserAdScratchContent:operation.parameters.UserAdScratchContent }));
      if (!prize.special) await reject(push({},[operation]),400);
      const retry = parse(await send('ad/scratch/draw',input(index))); assert.deepEqual(retry.operations,[operation]);
      const exact = await request(port,identity,input(index),String(identity),'ad/scratch/draw'); assert.deepEqual(exact.body,response.body);
      const acquired = inventory(operation); parse(await push(acquired,[operation]));
      await close(); await open(); assert.equal(app.store.operations().length,0);
      assert.deepEqual(parse(await request(port,identity,input(index),String(identity),'ad/scratch/draw')).operations,[]);
      app.store.beginSession();
      assert.deepEqual(parse(await request(port,identity,input(index),String(identity),'ad/scratch/draw')).operations,[]);
      const settledSource=app.store.db.prepare('SELECT * FROM ad_scratch_draw WHERE operation_id=?').get(operation.id);
      app.store.db.prepare('UPDATE ad_scratch_draw SET operation_json=NULL WHERE operation_id=?').run(operation.id);
      await reject(request(port,identity,input(index),String(identity),'ad/scratch/draw'),503,true);
      app.store.db.prepare('UPDATE ad_scratch_draw SET operation_json=? WHERE operation_id=?').run(settledSource.operation_json,operation.id);
      if(index===0 && !owned) {
        app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(operation.id);
        await reject(request(port,identity,input(index),String(identity),'ad/scratch/draw'),503,true);
        app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(operation.id);
        app.store.db.prepare('INSERT INTO operation_queue(id,type,parameters,token,signature) VALUES(?,?,?,?,?)')
          .run(operation.id,operation.type,JSON.stringify(operation.parameters),operation.token,operation.signature);
        await reject(request(port,identity,input(index),String(identity),'ad/scratch/draw'),503,true);
        app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(operation.id);
        const floor=app.store.db.prepare('SELECT * FROM ad_scratch_state WHERE scratch_id=?').get(scratchId);
        app.store.db.prepare("UPDATE ad_scratch_state SET contents_json='[]' WHERE scratch_id=?").run(scratchId);
        await reject(request(port,identity,input(index),String(identity),'ad/scratch/draw'),503,true);
        app.store.db.prepare('UPDATE ad_scratch_state SET contents_json=? WHERE scratch_id=?').run(floor.contents_json,scratchId);
        const savedRows=app.store.read(profile.table).data;put(profile.table,[]);
        await reject(request(port,identity,input(index),String(identity),'ad/scratch/draw'),503,true);
        put(profile.table,savedRows);
      }
      if(prize.special) {
        const journal=app.store.db.prepare('SELECT * FROM iris_transaction WHERE id=?').get(settledSource.iris_history_id);
        app.store.db.prepare("UPDATE iris_transaction SET reason='damaged' WHERE id=?").run(journal.id);
        await reject(request(port,identity,input(index),String(identity),'ad/scratch/draw'),503,true);
        app.store.db.prepare('UPDATE iris_transaction SET reason=? WHERE id=?').run(journal.reason,journal.id);
      }
      await reject(request(port,identity,input(index+1),String(identity),'ad/scratch/draw'),400);
      await reject(push({ UserAdScratch:[state()] }),400);
      await reject(push({},[],{ UserAdScratchContent:[{ adScratchContentId:prize.id }] }),400);
      if (profile && !prize.special) {
        const row = acquired[profile.table][0];
        parse(await push({ [profile.table]:[{ ...row,amount:0 }] }));
        await reject(push({ [profile.table]:[{ ...row,cumulativeAmount:row.cumulativeAmount-1 }] }),400);
        await reject(push({},[],{ [profile.table]:[{ [profile.idField]:prize.itemId }] }),400);
      }
    }

    // WRITTEN ONLY: completed type2 advertisement grants and later draws form
    // one ordered scratch history. Old draw and grant identities return only
    // their settled results and never replay tickets, items or card setters.
    await fresh('settled-later-draw-view-chain');
    const firstResponse=await choose(0,0),firstIdentity=sequence,first=parse(firstResponse).operation;
    await save(first);
    put('UserAdvertisement',[{userId:seed.userId,advertisementType:2,remainingCount:4,lastUpdateAt:now}]);
    const grantResponse=await send('ad/view/complete',{type:2}),grantIdentity=sequence,grant=parse(grantResponse).operation,
      grantReceipt=app.store.adViewReceipt(grant);
    parse(await push({UserAdScratch:[grant.parameters.UserAdScratch],UserAdvertisement:[grantReceipt.afterAd]},[grant]));
    const secondResponse=await choose(0,1),second=parse(secondResponse).operation;
    await save(second);await close();await open();
    const finalCard=app.store.read('UserAdScratch'),finalBoard=app.store.read('UserAdScratchContent'),
      finalWallet=[app.store.hardCurrency(),app.store.paidCurrency()],finalQueue=app.store.operations(),
      firstReplay=parse(await request(port,firstIdentity,input(0),String(firstIdentity),'ad/scratch/draw')),
      grantReplay=parse(await request(port,grantIdentity,{type:2},String(grantIdentity),'ad/view/complete')),
      secondClaim=app.store.db.prepare('SELECT * FROM ad_scratch_draw WHERE operation_id=?').get(second.id),
      grantClaim=app.store.db.prepare('SELECT * FROM ad_view_claim WHERE operation_id=?').get(grant.id);
    assert.deepEqual(firstReplay,{code:0,operations:[]});assert.deepEqual(grantReplay,{code:0,operations:[]});
    assert.deepEqual(app.store.read('UserAdScratch'),finalCard);assert.deepEqual(app.store.read('UserAdScratchContent'),finalBoard);
    assert.deepEqual(app.store.operations(),finalQueue);assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],finalWallet);
    const secondTarget=app.store.adScratchReceipt(second,true).targets[0],secondInventory=app.store.read(secondTarget.table_name);
    put(secondTarget.table_name,[]);
    await reject(request(port,firstIdentity,input(0),String(firstIdentity),'ad/scratch/draw'),503,true);
    await reject(request(port,grantIdentity,{type:2},String(grantIdentity),'ad/view/complete'),503,true);
    put(secondTarget.table_name,secondInventory.data);
    app.store.db.prepare('UPDATE ad_scratch_draw SET operation_json=? WHERE operation_id=?').run(JSON.stringify(first),second.id);
    await reject(request(port,firstIdentity,input(0),String(firstIdentity),'ad/scratch/draw'),503,true);
    app.store.db.prepare('UPDATE ad_scratch_draw SET operation_json=? WHERE operation_id=?').run(secondClaim.operation_json,second.id);
    app.store.db.prepare('UPDATE ad_view_claim SET operation_json=NULL WHERE operation_id=?').run(grant.id);
    await reject(request(port,firstIdentity,input(0),String(firstIdentity),'ad/scratch/draw'),503,true);
    app.store.db.prepare('UPDATE ad_view_claim SET operation_json=? WHERE operation_id=?').run(grantClaim.operation_json,grant.id);
    app.store.db.prepare("UPDATE ad_view_claim SET effect_json='' WHERE operation_id=?").run(grant.id);
    await reject(request(port,firstIdentity,input(0),String(firstIdentity),'ad/scratch/draw'),503,true);
    app.store.db.prepare('UPDATE ad_view_claim SET effect_json=? WHERE operation_id=?').run(grantClaim.effect_json,grant.id);
    const secondColumns=Object.keys(secondClaim);
    app.store.db.prepare('DELETE FROM ad_scratch_draw WHERE operation_id=?').run(second.id);
    await reject(request(port,firstIdentity,input(0),String(firstIdentity),'ad/scratch/draw'),503,true);
    app.store.db.prepare(`INSERT INTO ad_scratch_draw(${secondColumns.join(',')}) VALUES(${secondColumns.map(()=>'?').join(',')})`)
      .run(...Object.values(secondClaim));
    app.store.db.prepare('UPDATE ad_scratch_draw SET before_json=after_json WHERE operation_id=?').run(second.id);
    await reject(request(port,firstIdentity,input(0),String(firstIdentity),'ad/scratch/draw'),503,true);
    await reject(request(port,grantIdentity,{type:2},String(grantIdentity),'ad/view/complete'),503,true);
    app.store.db.prepare('UPDATE ad_scratch_draw SET before_json=? WHERE operation_id=?').run(secondClaim.before_json,second.id);
    app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(grant.id);
    await reject(request(port,firstIdentity,input(0),String(firstIdentity),'ad/scratch/draw'),503,true);
    app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(grant.id);
    app.store.db.prepare('INSERT INTO operation_queue(id,type,parameters,token,signature) VALUES(?,?,?,?,?)')
      .run(grant.id,grant.type,JSON.stringify(grant.parameters),grant.token,grant.signature);
    await reject(request(port,firstIdentity,input(0),String(firstIdentity),'ad/scratch/draw'),503,true);
    app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(grant.id);

    // WRITTEN ONLY: all five original quantity-one ordinary prizes; the
    // imported inventory/tickets/timestamps/save prefixes are synthetic.
    const MAX=999999999;
    for(const [index,prize] of prizes.entries()) if(prize.rewardKey!=='currency.gem')
      for(const cumulative of [20,MAX-prize.amount-1,MAX-prize.amount,MAX]) for(const full of [false,true])
        for(const order of ['stock-first','lifetime-first','signature-first','spent-first']) {
          await fresh(`cap-${prize.id}-${cumulative}-${full}-${order}`);
          const profile=master.itemProfiles[prize.itemId],old={userId:seed.userId,[profile.idField]:prize.itemId,amount:full?MAX:3,
            cumulativeAmount:cumulative,reservedAmount:0,bookEntryState:3,signature:0xffffffff};
          put(profile.table,[old]);
          const untouched=app.store.read(profile.table),wallet=app.store.hardCurrency(),response=await choose(index,index),identity=sequence,
            operation=parse(response).operation,target=app.store.adScratchReceipt(operation).targets[0],capture=JSON.parse(target.stock_state),
            source=app.store.db.prepare('SELECT * FROM ad_scratch_draw WHERE operation_id=?').get(operation.id);
          assert.equal(prize.amount,1);assert.equal(target.cap_version,1);assert.equal(target.cumulative_amount,Math.min(MAX,cumulative+prize.amount));
          assert.equal(capture.policy,'offline-ad-scratch-stock-cap-v1');assert.equal(capture.beforeCumulative,cumulative);
          assert.equal(capture.beforeSignature,0xffffffff);assert.equal(capture.signature,operation.signature);
          assert.equal(capture.amount,Math.min(MAX,old.amount+1));assert.equal(source.operation_json,JSON.stringify(operation));
          assert.equal(source.capped_item_id,prize.itemId);assert.equal(source.capture_version,1);assert.equal(operation.parameters.pickedItem.amount,1);
          assert.equal(operation.parameters.issueAmount,0);assert.equal(app.store.hardCurrency(),wallet);
          assert.deepEqual(app.store.read(profile.table),untouched);
          if(target.cumulative_amount<MAX) await reject(push({[profile.table]:[{...old,
            cumulativeAmount:target.cumulative_amount+1,signature:operation.signature}]}),400);
          await reject(push({},[operation]),400);await close();await open();
          assert.deepEqual((await request(port,identity,input(index),String(identity),'ad/scratch/draw')).body,response.body);
          const after={...old,amount:Math.min(MAX,old.amount+1),cumulativeAmount:target.cumulative_amount,signature:operation.signature},
            prefix=order==='stock-first'?{...old,amount:after.amount}:
              order==='lifetime-first'?{...old,cumulativeAmount:target.cumulative_amount}:
                order==='signature-first'?{...old,signature:operation.signature}:{...after,amount:0},
            changed=JSON.stringify(prefix)!==JSON.stringify(old),observed=prefix.cumulativeAmount===target.cumulative_amount && prefix.signature===operation.signature;
          if(changed) {
            app.store.db.exec("CREATE TEMP TRIGGER fail_ad_cap_save BEFORE UPDATE ON pve_item_claim BEGIN SELECT RAISE(ABORT,'ad cap save rollback'); END");
            await reject(push({[profile.table]:[prefix]}),503);app.store.db.exec('DROP TRIGGER fail_ad_cap_save');
          }
          parse(await push({[profile.table]:[prefix]}));await close();await open();
          assert.equal(JSON.parse(app.store.adScratchReceipt(operation).targets[0].stock_state).observed,observed);
          if(!observed) await reject(push({},[operation]),400);
          if(changed) {
            await reject(request(port,identity,input(index),String(identity),'ad/scratch/draw'),503,true);
            const cold=parse(await send('user_data/confirm',null)).operations.find(row=>row.id===operation.id);
            if(observed) {
              const {pickedItem,...parameters}=operation.parameters;
              assert.deepEqual(cold,{...operation,parameters});
              assert.deepEqual(app.store.operations().find(row=>row.id===operation.id),operation,'Original signed queue remains unchanged');
            } else assert.equal(cold,undefined,'Unobserved prefix still cannot safely redeliver an additive item');
          }
          // Actual issued signature plus its exact target also proves a first
          // save after spending; an observed allowance must not be renewed.
          const final=observed?prefix:after;
          parse(await push({[profile.table]:[final]}));
          const settled=JSON.parse(app.store.adScratchReceipt(operation).targets[0].stock_state);
          assert.equal(settled.observed,true);assert.equal(settled.effect,true);assert(settled.amountAdded<=after.amount-old.amount);
          const beforeRecovery=app.store.read(profile.table),coldResponse=await send('user_data/confirm',null),coldIdentity=sequence,
            {pickedItem,...recoveryParameters}=operation.parameters;
          assert.deepEqual(parse(coldResponse).operations.find(row=>row.id===operation.id),{...operation,parameters:recoveryParameters});
          assert.deepEqual(app.store.read(profile.table),beforeRecovery,'Cold card recovery cannot award or prewrite inventory');
          await close();await open();
          assert.deepEqual((await request(port,coldIdentity,null,String(coldIdentity),'user_data/confirm')).body,coldResponse.body);
          await reject(push({},[operation]),400);
          app.store.db.prepare('UPDATE ad_scratch_draw SET capture_version=0 WHERE operation_id=?').run(operation.id);
          if(target.cumulative_amount<MAX) await reject(send('user_data/confirm',null),503,true);
          else assert.equal(app.store.adScratchReceipt(operation).capture_version,0,'Retained legacy MAX captures remain valid without guessing history');
          app.store.db.prepare('UPDATE ad_scratch_draw SET capture_version=2 WHERE operation_id=?').run(operation.id);
          await reject(send('user_data/confirm',null),503,true);
          app.store.db.prepare('UPDATE ad_scratch_draw SET capture_version=1 WHERE operation_id=?').run(operation.id);
          app.store.db.prepare('UPDATE pve_item_claim SET stock_state=? WHERE operation_id=?').run(
            JSON.stringify({...settled,amountAdded:after.amount-old.amount+1}),operation.id);
          await reject(push({},[operation]),503,true);
          app.store.db.prepare('UPDATE pve_item_claim SET stock_state=? WHERE operation_id=?').run(JSON.stringify(settled),operation.id);
          app.store.db.exec("CREATE TEMP TRIGGER fail_ad_cap_done BEFORE INSERT ON operation_done BEGIN SELECT RAISE(ABORT,'ad cap ACK rollback'); END");
          await reject(push(cardSave(operation),[operation]),503);app.store.db.exec('DROP TRIGGER fail_ad_cap_done');
          app.store.db.exec("CREATE TEMP TRIGGER fail_ad_cap_floor BEFORE INSERT ON ad_scratch_item_floor BEGIN SELECT RAISE(ABORT,'ad cap floor rollback'); END");
          await reject(push(cardSave(operation),[operation]),503);app.store.db.exec('DROP TRIGGER fail_ad_cap_floor');
          parse(await push(cardSave(operation),[operation]));await close();await open();
          assert.equal(app.store.db.prepare('SELECT operation_id FROM ad_scratch_item_floor WHERE item_id=?').get(prize.itemId).operation_id,operation.id);
          await reject(request(port,identity,input(index),String(identity),'ad/scratch/draw'),503,true);
          const spent={...final,amount:0};parse(await push({[profile.table]:[spent]}));await close();await open();
          await reject(push({[profile.table]:[after]}),400);
          await reject(push({[profile.table]:[{...spent,cumulativeAmount:target.cumulative_amount-1}]}),400);
          if(target.cumulative_amount<MAX) await reject(push({[profile.table]:[{...spent,cumulativeAmount:target.cumulative_amount+1}]}),400);
          await reject(push({},[],{[profile.table]:[{[profile.idField]:prize.itemId}]}),400);
          for(const field of ['operation_json','capped_item_id']) {
            app.store.db.prepare(`UPDATE ad_scratch_draw SET ${field}=NULL WHERE operation_id=?`).run(operation.id);
            await reject(push({[profile.table]:[spent]}),503,true);
            app.store.db.prepare(`UPDATE ad_scratch_draw SET ${field}=? WHERE operation_id=?`).run(source[field],operation.id);
          }
          app.store.db.prepare('DELETE FROM ad_scratch_item_floor WHERE item_id=?').run(prize.itemId);
          await reject(push({[profile.table]:[spent]}),503,true);
          app.store.db.prepare('INSERT INTO ad_scratch_item_floor(item_id,operation_id) VALUES(?,?)').run(prize.itemId,operation.id+1);
          await reject(push({[profile.table]:[spent]}),503,true);
          app.store.db.prepare('UPDATE ad_scratch_item_floor SET operation_id=? WHERE item_id=?').run(operation.id,prize.itemId);
          const originalTarget=app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').get(operation.id),columns=Object.keys(originalTarget);
          app.store.db.prepare('DELETE FROM pve_item_claim WHERE operation_id=?').run(operation.id);
          await reject(push({[profile.table]:[spent]}),503,true);
          app.store.db.prepare(`INSERT INTO pve_item_claim(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`)
            .run(...Object.values(originalTarget));
          if(target.cumulative_amount<MAX) {
            const claimColumns=Object.keys(source);
            app.store.db.prepare('DELETE FROM ad_scratch_draw WHERE operation_id=?').run(operation.id);
            app.store.db.prepare('DELETE FROM ad_scratch_item_floor WHERE item_id=?').run(prize.itemId);
            await reject(push({[profile.table]:[spent]}),503,true);
            app.store.db.prepare(`INSERT INTO ad_scratch_draw(${claimColumns.join(',')}) VALUES(${claimColumns.map(()=>'?').join(',')})`)
              .run(...Object.values(source));
            app.store.db.prepare('INSERT INTO ad_scratch_item_floor(item_id,operation_id) VALUES(?,?)').run(prize.itemId,operation.id);
          }
          parse(await push({[profile.table]:[spent]}));
        }

    // Fully acquired item with absent/card-only/board-only saves can resume
    // only absolute setters. Original callback23f0734 permits no pickedItem.
    for(const [index,prize] of prizes.entries()) if(prize.rewardKey!=='currency.gem')
      for(const flags of ['none','card-only','board-only']) for(const cumulative of [20,MAX]) for(const spentFirst of [false,true]) {
        await fresh(`cold-card-recovery-${prize.id}-${flags}-${cumulative}-${spentFirst}`);
        const profile=master.itemProfiles[prize.itemId],old={userId:seed.userId,[profile.idField]:prize.itemId,amount:3,
          cumulativeAmount:cumulative,reservedAmount:0,bookEntryState:3,signature:7};
        put(profile.table,[old]);
        const response=await choose(index,index),hotIdentity=sequence,operation=parse(response).operation,
          awarded={...old,amount:spentFirst?0:4,cumulativeAmount:Math.min(MAX,cumulative+prize.amount),signature:operation.signature};
        parse(await push({[profile.table]:[awarded]}));
        if(flags==='card-only') parse(await push({UserAdScratch:[operation.parameters.UserAdScratch]}));
        if(flags==='board-only') parse(await push({UserAdScratchContent:operation.parameters.UserAdScratchContent}));
        await close();await open();
        const nativeBefore=app.store.read(profile.table),wallet=app.store.hardCurrency(),queueBefore=app.store.operations(),
          sourceBefore=app.store.db.prepare('SELECT * FROM ad_scratch_draw WHERE operation_id=?').get(operation.id),
          capBefore=app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').get(operation.id),
          firstCold=await send('user_data/confirm',null),coldIdentity=sequence,cold=parse(firstCold).operations.find(row=>row.id===operation.id),
          {pickedItem,...parameters}=operation.parameters;
        assert.deepEqual(cold,{...operation,parameters});assert(!Object.hasOwn(cold.parameters,'pickedItem'));
        assert.equal(cold.signature,operation.signature);assert.equal(cold.token,operation.token);
        assert.deepEqual(app.store.operations(),queueBefore);assert.deepEqual(app.store.read(profile.table),nativeBefore);
        assert.equal(app.store.hardCurrency(),wallet);
        assert.deepEqual(app.store.db.prepare('SELECT * FROM ad_scratch_draw WHERE operation_id=?').get(operation.id),sourceBefore);
        assert.deepEqual(app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').get(operation.id),capBefore);
        await reject(request(port,hotIdentity,input(index),String(hotIdentity),'ad/scratch/draw'),503,true);
        await reject(send('ad/scratch/draw',input(index)),503,true);
        await reject(push({},[cold]),400);
        app.store.db.prepare('UPDATE pve_item_claim SET stock_state=? WHERE operation_id=?').run(
          JSON.stringify({...JSON.parse(capBefore.stock_state),observed:false}),operation.id);
        await reject(send('user_data/confirm',null),503,true);
        app.store.db.prepare('UPDATE pve_item_claim SET stock_state=? WHERE operation_id=?').run(capBefore.stock_state,operation.id);
        app.store.db.prepare('UPDATE ad_scratch_draw SET operation_json=NULL WHERE operation_id=?').run(operation.id);
        await reject(send('user_data/confirm',null),503,true);
        app.store.db.prepare('UPDATE ad_scratch_draw SET operation_json=? WHERE operation_id=?').run(sourceBefore.operation_json,operation.id);
        await close();await open();
        assert.deepEqual((await request(port,coldIdentity,null,String(coldIdentity),'user_data/confirm')).body,firstCold.body);
        app.store.beginSession();
        assert.deepEqual((await request(port,coldIdentity,null,String(coldIdentity),'user_data/confirm')).body,firstCold.body);
        parse(await push(cardSave(cold)));await close();await open();
        assert.deepEqual(app.store.read(profile.table),nativeBefore);
        // Both absolute setters are idempotent; unchanged inventory plus
        // original verifier closes the operation atomically, not a fake ACK.
        app.store.db.exec("CREATE TEMP TRIGGER fail_cold_card_ack BEFORE INSERT ON operation_done BEGIN SELECT RAISE(ABORT,'cold card ACK rollback'); END");
        await reject(push({},[cold]),503);app.store.db.exec('DROP TRIGGER fail_cold_card_ack');
        parse(await push({},[cold]));await close();await open();
        assert.equal(app.store.operations().length,0);assert.deepEqual(app.store.read(profile.table),nativeBefore);
        await reject(request(port,coldIdentity,null,String(coldIdentity),'user_data/confirm'),503,true);
        assert.equal(app.store.db.prepare('SELECT operation_id FROM ad_scratch_item_floor WHERE item_id=?').get(prize.itemId).operation_id,operation.id);
      }

    // WRITTEN ONLY: first-ever ordinary rows can be saved before the two
    // absolute scratch setters. Cold delivery removes only the acquired item;
    // final acknowledgement still requires the original card and board state.
    let corruptedOrdinary=false,ordinaryCold=0;
    for(const [index,prize] of prizes.entries()) if(prize.rewardKey!=='currency.gem') {
      await fresh(`ordinary-absent-cold-${prize.id}`);
      const profile=master.itemProfiles[prize.itemId];put(profile.table,[]);
      const response=await choose(index,index),hotIdentity=sequence,operation=parse(response).operation,
        receipt=app.store.adScratchReceipt(operation),target=receipt.targets[0];
      assert.equal(receipt.acquisition_before,0);assert.equal(target.cap_version,0);
      assert.equal(target.stock_state,null);assert.equal(target.gacha_state,null);
      assert.equal(target.cumulative_amount,prize.amount);
      const awarded={userId:seed.userId,[profile.idField]:prize.itemId,amount:prize.amount,reservedAmount:0,
        bookEntryState:3,signature:operation.signature,cumulativeAmount:prize.amount};
      parse(await push({[profile.table]:[awarded]}));await close();await open();
      if(!corruptedOrdinary) {
        app.store.db.prepare('UPDATE pve_item_claim SET cap_version=1 WHERE operation_id=?').run(operation.id);
        await reject(send('user_data/confirm',null),503,true);
        app.store.db.prepare('UPDATE pve_item_claim SET cap_version=0 WHERE operation_id=?').run(operation.id);
        corruptedOrdinary=true;
      }
      const queueBefore=app.store.operations(),savedBefore=app.store.read(profile.table),coldResponse=await send('user_data/confirm',null),
        coldIdentity=sequence,cold=parse(coldResponse).operations.find(row=>row.id===operation.id),{pickedItem,...parameters}=operation.parameters;
      assert.deepEqual(cold,{...operation,parameters});assert(!Object.hasOwn(cold.parameters,'pickedItem'));
      assert.deepEqual(app.store.operations(),queueBefore);assert.deepEqual(app.store.read(profile.table),savedBefore);
      await reject(request(port,hotIdentity,input(index),String(hotIdentity),'ad/scratch/draw'),503,true);
      await reject(send('ad/scratch/draw',input(index)),503,true);await reject(push({},[cold]),400);
      parse(await push(cardSave(cold)));parse(await push({},[cold]));await close();await open();
      assert.equal(app.store.operations().length,0);assert.deepEqual(app.store.read(profile.table),savedBefore);
      await reject(request(port,coldIdentity,null,String(coldIdentity),'user_data/confirm'),503,true);
      await reject(push({[profile.table]:[{...awarded,amount:0,cumulativeAmount:prize.amount-1}]}),400);
      await reject(push({},[],{[profile.table]:[{[profile.idField]:prize.itemId}]}),400);
      ordinaryCold++;
    }
    assert.equal(ordinaryCold,5);assert.equal(corruptedOrdinary,true);

    // Owned empty rows are imported fixtures, not inferred constructors.
    for(const [index,prize] of prizes.entries()) if(prize.rewardKey!=='currency.gem') {
      await fresh(`ordinary-empty-${prize.id}`);
      const profile=master.itemProfiles[prize.itemId];
      put(profile.table,[{userId:seed.userId,[profile.idField]:prize.itemId,amount:0,reservedAmount:0,
        bookEntryState:3,signature:0,cumulativeAmount:0}]);
      const operation=parse(await choose(index,index)).operation;
      assert.equal(app.store.adScratchReceipt(operation).targets[0].cumulative_amount,prize.amount);
      assert.notEqual(operation.signature,0);
      await save(operation);await close();await open();
      assert.equal(app.store.operations().length,0);assert.equal(app.store.adScratchReceipt(operation,true).capture_version,1);
    }

    // Both producer orders require the first real item ACK; no coalesced gain
    // is inferred from lifetime. Quantities/funding/Present source are fixtures.
    for(const [index,prize] of prizes.entries()) if(prize.rewardKey!=='currency.gem')
      for(const firstScratch of [false,true]) for(const cumulative of [20,MAX]) {
      await fresh(`producer-order-${prize.id}-${firstScratch}-${cumulative}`);
      const profile=master.itemProfiles[prize.itemId],old={userId:seed.userId,[profile.idField]:prize.itemId,
        amount:3,reservedAmount:0,bookEntryState:3,signature:0xffffffff,cumulativeAmount:cumulative},
        gift={userId:seed.userId,id:1,itemId:prize.itemId,amount:2,title:'Synthetic capped producer order',message:'',
          senderType:1,senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,
          pcLimitBreakCount:0,pcHeroSublimateCount:0,state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0};
      put(profile.table,[old]);put('UserGift',[gift]);
      const first=firstScratch?parse(await choose(index,index)).operation:
        parse(await send('gift/receive',{userId:seed.userId,giftIds:[1]})).operations[0];
      if(firstScratch) await reject(send('gift/receive',{userId:seed.userId,giftIds:[1]}),503,true);
      else await reject(choose(index,index),503,true);
      assert(app.store.operations().some(row=>row.id===first.id));
      const quantity=firstScratch?1:2,
        awarded={...old,amount:old.amount+quantity,cumulativeAmount:Math.min(MAX,cumulative+quantity),signature:first.signature},
        firstFlags=firstScratch?cardSave(first):{UserGift:[{...gift,state:1}]};
      parse(await push({...firstFlags,[profile.table]:[awarded]},[first]));await close();await open();
      const next=firstScratch?parse(await send('gift/receive',{userId:seed.userId,giftIds:[1]})).operations[0]:
        parse(await choose(index,index)).operation,
        nextFlags=firstScratch?{UserGift:[{...gift,state:1}]}:cardSave(next),
        final={...awarded,amount:awarded.amount+(firstScratch?2:1),cumulativeAmount:Math.min(MAX,cumulative+3),signature:next.signature};
      parse(await push({...nextFlags,[profile.table]:[final]},[next]));await close();await open();
      assert.equal(app.store.operations().length,0);assert.equal(app.store.read(profile.table).data[0].amount,6);
      parse(await push({[profile.table]:[{...final,amount:0}]}));await reject(push({[profile.table]:[final]}),400);
    }

    await fresh('board-history'); const ordinary = parse(await choose(0,0)).operations[0]; await save(ordinary);
    await reject(send('ad/scratch/draw',input(0)),400);
    // This fixture leaves the original Iris prize as the only remaining row;
    // it is an imported baseline, NOT evidence of naturally earned ad views.
    await fresh('reset-import');
    put('UserAdScratchContent',prizes.slice(0,5).map((prize,index) => ({ userId:0,adScratchStepId:stepId,
      adScratchContentId:prize.id,position:index,loopCount:0 })));
    const reset = parse(await send('ad/scratch/draw',input(5))).operations[0]; await save(reset);
    assert.equal(app.store.read('UserAdScratchContent').data.length,6);
    assert.equal(app.store.read('UserAdScratch').data[0].loopCount,1);
    const later = parse(await choose(0,0)).operations[0]; await save(later);
    const contentRows = app.store.read('UserAdScratchContent').data;
    assert.equal(contentRows.length,6); assert.equal(contentRows.find(row => row.adScratchContentId === prizes[0].id).loopCount,1);
    assert.equal(contentRows.find(row => row.adScratchContentId === prizes[5].id).loopCount,0);

    await fresh('validation');
    for (const value of [null,{}, { ...input(0),extra:true }, { ...input(0),advertisementType:1 },
      { ...input(0),position:-1 }, { ...input(0),position:0x80000000 }, { ...input(0),position:'0' },
      { ...input(0),adScratchId:String(scratchId) }]) await reject(send('ad/scratch/draw',value),400);
    await reject(send('ad/scratch/draw',{ ...input(0),adScratchId:42 }),503,true);
    for (const change of [{ userId:9 },{ ticketAmount:-1 },{ ticketAmount:'1' },{ currentStepId:42 },{ loopCount:-1 }]) {
      put('UserAdScratch',[state(change)]); await reject(send('ad/scratch/draw',input(0)),400);
    }
    put('UserAdScratch',[state({ ticketAmount:0 })]); await reject(send('ad/scratch/draw',input(0)),400);
    put('UserAdScratch',[state()]); now = master.adScratches[scratchId].startAt-1;
    await reject(send('ad/scratch/draw',input(0)),400); now = 1686794400;
    const operation = parse(await choose(0,0)).operations[0];
    await reject(send('ad/scratch/draw',input(1)),400);
    for (const change of [{ userId:9 },{ ticketAmount:9 },{ ticketAmount:6 },{ currentStepId:42 },{ loopCount:2 }])
      await reject(push({ UserAdScratch:[{ ...operation.parameters.UserAdScratch,...change }] }),400);
    await reject(push({ UserAdScratch:[state(),state()] }),400);
    await reject(push({},[],{ UserAdScratch:[{ userId:0 }] }),400);
    const chosen = operation.parameters.UserAdScratchContent[0];
    for (const change of [{ userId:9 },{ position:-1 },{ position:1 },{ loopCount:1 },{ adScratchStepId:42 },{ adScratchContentId:42 }])
      await reject(push({ UserAdScratchContent:[{ ...chosen,...change }] }),400);
    await reject(push({ UserAdScratchContent:[chosen,chosen] }),400);
    await reject(push({},[],{ UserAdScratchContent:[{ userId:0 }] }),400);
    const target = inventory(operation), name = Object.keys(target)[0];
    await reject(push({ ...cardSave(operation),[name]:[{ ...target[name][0],userId:9 }] },[operation]),400);
    now = master.adScratches[scratchId].startAt-1;
    assert.deepEqual(parse(await send('ad/scratch/draw',input(0))).operations,[operation]); now = 1686794400;

    await fresh('missing-history'); const first = await choose(0,0), identity = sequence, pending = parse(first).operations[0];
    const receipt = app.store.db.prepare('SELECT * FROM ad_scratch_draw').get();
    app.store.db.prepare('DELETE FROM ad_scratch_draw').run(); await close(); await open();
    await reject(send('ad/scratch/draw',input(0)),503,true);
    await reject(request(port,identity,input(0),String(identity),'ad/scratch/draw'),503,true);
    await reject(send('user_data/confirm',null),503,true); await reject(push({},[pending]),503,true);
    const receiptColumns=Object.keys(receipt);
    app.store.db.prepare(`INSERT INTO ad_scratch_draw(${receiptColumns.join(',')}) VALUES(${receiptColumns.map(()=>'?').join(',')})`)
      .run(...Object.values(receipt));
    app.store.db.prepare('UPDATE ad_scratch_draw SET acquisition_before=acquisition_before+1').run();
    await reject(send('ad/scratch/draw',input(0)),503,true);
    app.store.db.prepare('UPDATE ad_scratch_draw SET acquisition_before=?').run(receipt.acquisition_before);
    app.store.db.prepare("UPDATE ad_scratch_draw SET after_contents='[]'").run();
    await reject(send('ad/scratch/draw',input(0)),503,true);
    app.store.db.prepare('UPDATE ad_scratch_draw SET after_contents=?').run(receipt.after_contents);
    app.store.db.prepare("UPDATE ad_scratch_state SET state_json='{}'").run();
    await reject(send('ad/scratch/draw',input(0)),503,true);

    for (const firstScratch of [false,true]) {
      await fresh(`shared-present-${firstScratch}`); const prize = prizes[0],profile=master.itemProfiles[prize.itemId],
        baseline={userId:seed.userId,[profile.idField]:prize.itemId,amount:3,reservedAmount:0,bookEntryState:3,
          signature:7,cumulativeAmount:20};
      const gift = { userId:seed.userId,id:1,itemId:prize.itemId,amount:2,title:'Synthetic shared scratch item',message:'',
        senderType:1,senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,
        pcLimitBreakCount:0,pcHeroSublimateCount:0,state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0 };
      put(profile.table,[baseline]);put('UserGift',[gift]);
      const first=firstScratch?parse(await choose(0,0)).operation:
        parse(await send('gift/receive',{userId:seed.userId,giftIds:[1]})).operations[0];
      if(firstScratch) await reject(send('gift/receive',{userId:seed.userId,giftIds:[1]}),503,true);
      else await reject(choose(0,0),503,true);
      assert.deepEqual(app.store.operations(),[first]);assert.deepEqual(app.store.read(profile.table).data,[baseline]);
      assert.equal(app.store.read('UserGift').data[0].state,0);
      const quantity=firstScratch?1:2,firstFlags=firstScratch?cardSave(first):{UserGift:[{...gift,state:1}]};
      parse(await push({...firstFlags,[profile.table]:[
        {...baseline,amount:3+quantity,cumulativeAmount:20+quantity,signature:first.signature}]},[first]));
      assert.equal(app.store.operations().length,0);
    }

    for (const iris of [false,true]) {
      await fresh(`rollback-${iris}`);
      for (const [table,event] of [['ad_scratch_state','INSERT'],['operation_queue','INSERT'],['ad_scratch_draw','INSERT'],
        [iris ? 'hard_currency' : 'pve_item_claim',iris ? 'UPDATE' : 'INSERT'],['ad_scratch_request','INSERT'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_scratch BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'scratch issue rollback'); END`);
        await reject(choose(iris ? 5 : 0,0),503); app.store.db.exec('DROP TRIGGER fail_scratch');
      }
      const pending = parse(await choose(iris ? 5 : 0,0)).operations[0], data = { ...cardSave(pending),...inventory(pending) };
      for (const [table,event] of [['profile','UPDATE'],['ad_scratch_state','UPDATE'],['operation_done','INSERT'],
        ['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_scratch BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'scratch save rollback'); END`);
        await reject(push(data,[pending]),503); app.store.db.exec('DROP TRIGGER fail_scratch');
      }
      parse(await push(data,[pending]));
    }
    console.log('Video-ad scratch reconstructed draw, original prizes, five ordinary cold recoveries, durable save/ACK/replay and rollback: OK (synthetic only)');
  } finally { await close(); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });

