'use strict';

// DEFERRED / NOT RUN. Imported flat gifts prove neither natural earning nor native UI effects.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const {underPvpRematchSeasons,underPvpRematchGain,underPvpRematchDefault}=require('./under_pvp.cjs');
const master=require('../data/danmemore-master.json'),seed=require('../data/danmemore-seed.json'),id=69000000005,
  season=master.underPvp.underPvpInformation[id],itemId=season.slot22,table='UserUnderPvpRevengeTicket',statusTable='UserUnderPvpRevengeStatus';
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
const ticket=(ticketId,amount,cumulativeAmount=amount,reservedAmount=0)=>({userId:seed.userId,underPvpRevengeTicketId:ticketId,
  amount,cumulativeAmount,reservedAmount,bookEntryState:1,signature:0xffffffff});
const initial={...underPvpRematchDefault(id,master,seed.userId),initialSetting:true};

async function main() {
  const bindings=underPvpRematchSeasons(master);assert.equal(bindings.size,50);
  for (const ticketId of bindings.keys()) {
    assert.deepEqual(underPvpRematchGain(null,ticketId,2,master,seed.userId),{amount:2,cumulativeAmount:2,reservedAmount:0});
    const before=ticket(ticketId,3,0,7);
    assert.deepEqual(underPvpRematchGain(before,ticketId,5,master,seed.userId),{amount:8,cumulativeAmount:5,reservedAmount:7});
    assert.equal(before.amount,3,'Gain target does not pre-credit its baseline');
    for (const [stock,cumulative] of [[999999998,5],[5,999999998],[999999999,999999999]])
      assert.deepEqual(underPvpRematchGain(ticket(ticketId,stock,cumulative,7),ticketId,2,master,seed.userId),
        {amount:Math.min(999999999,stock+2),cumulativeAmount:Math.min(999999999,cumulative+2),reservedAmount:7});
    assert.throws(()=>underPvpRematchGain(ticket(ticketId,999999999),ticketId,0x7fffffff,master,seed.userId),/addition range/);
    for (const amount of [0,-1,1.2,0x80000000]) assert.throws(()=>underPvpRematchGain(null,ticketId,amount,master,seed.userId));
    assert.throws(()=>underPvpRematchGain({...before,userId:2},ticketId,2,master,seed.userId));
  }
  assert.throws(()=>underPvpRematchGain(null,330000001,2,master,seed.userId));
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-rematch-rewards-'));
  let app,port,database,sequence=0,now=season.slot10+100;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const fresh=async(name,tickets=[],statuses=[])=>{await close();database=path.join(directory,`${name}.sqlite`);now=season.slot10+100;
    await open();put(table,tickets);put(statusTable,statuses);};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected=async(action,value,offline=true)=>{const before=snapshot(),reply=await send(action,value);
    assert.equal(reply.status,503,reply.body.toString());if(offline)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Rejection preserves profiles, receipts, flags, queue, sequence and reply cache');};
  const gift=(giftId,ticketId,amount)=>({userId:seed.userId,id:giftId,itemId:ticketId,amount,title:'Synthetic original-ID rematch present',message:'',
    senderType:1,senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,
    pcLimitBreakCount:0,pcHeroSublimateCount:0,state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0});
  const receiveValue=gifts=>({userId:seed.userId,giftIds:gifts.map(row=>row.id)});
  const receive=gifts=>send('gift/receive',receiveValue(gifts));
  const save=(putItems={},operations=[],deleteItems={})=>({badges:null,scripts:{},dataTokens:{},
    operations:operations.map(row=>({id:row.id,verifier:row.token})),checksums:{before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name] ?? [])]))},
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length ? [{signature:0,trigger:'GiftReceive',putItems,deleteItems}] : []});
  const push=(putItems={},operations=[],deleteItems={})=>send('user_data/push',save(putItems,operations,deleteItems));
  const claims=()=>app.store.db.prepare('SELECT * FROM under_pvp_rematch_reward_claim ORDER BY operation_id,ticket_id').all();
  const pointer=()=>app.store.db.prepare('SELECT * FROM under_pvp_rematch_stock_state WHERE ticket_id=?').get(itemId);
  try {
    await fresh('all-original-tickets');const ids=[...bindings.keys()],gifts=ids.map((ticketId,index)=>gift(index+1,ticketId,2));
    gifts.push(gift(51,itemId,3));put('UserGift',gifts);
    const pullValue={tables:[table,statusTable]},oldPull=await send('user_data/pull',pullValue),pullIdentity=sequence;assert.equal(oldPull.status,200);
    const response=await receive(gifts),identity=sequence,result=parse(response),operation=result.operations[0];
    assert.equal(operation.type,2000);assert.equal(result.receivedItems.length,50);assert.equal(claims().length,50);
    assert.equal(claims().find(row=>row.ticket_id===itemId).amount,5,'Duplicate original IDs aggregate once');
    assert.equal(app.store.read(table).data.length,0,'No native stock, counter or signature pre-credit');
    assert.equal(app.store.read(statusTable).data.length,0,'Earning does not initialize a season');
    assert.equal(app.store.db.prepare('SELECT 1 FROM gift_item_claim WHERE operation_id=?').get(operation.id),undefined);
    assert.deepEqual((await request(port,identity,receiveValue(gifts),String(identity),'gift/receive')).body,response.body);
    const extra=gift(52,itemId,1);put('UserGift',gifts.concat(extra));await rejected('gift/receive',receiveValue([extra]));
    await rejected('user_data/push',save({},[operation]));await rejected('user_data/pull',pullValue);
    await rejected('under_pvp/summary/get',{underPvpId:id});
    for (const row of [ticket(itemId,6,5),ticket(itemId,5,4),ticket(itemId,5,5,1)])
      await rejected('user_data/push',save({[table]:[row]}));
    const flags=gifts.map(row=>({...row,state:1})),flagged=parse(await push({UserGift:flags}));
    assert.deepEqual(flagged.operations,[],'Flag-first save suppresses additive redelivery without discarding the queue');
    assert.ok(app.store.operations().some(row=>row.id===operation.id));
    await rejected('gift/receive',receiveValue(gifts));await rejected('user_data/confirm',null);
    await close();await open();now+=1000;
    const acquired=ids.map(ticketId=>ticket(ticketId,ticketId===itemId?5:2));
    parse(await push({[table]:acquired.slice(0,10)}));assert.equal(claims().filter(row=>row.effect_saved).length,10);
    await rejected('user_data/push',save({},[operation]));
    await rejected('user_data/push',save({[table]:[ticket(itemId,4)]}));
    parse(await push({[table]:acquired}));assert.equal(claims().filter(row=>row.effect_saved).length,50);
    parse(await push({},[operation]));assert.equal(app.store.operations().length,0);
    assert.equal((await request(port,identity,receiveValue(gifts),String(identity),'gift/receive')).status,503,'Completed cached awards never grant again');
    assert.equal((await request(port,pullIdentity,pullValue,String(pullIdentity),'user_data/pull')).status,503,'Old pulls cannot remove earned counters');
    await rejected('user_data/push',save({},[],{[table]:[{underPvpRevengeTicketId:itemId}]}));
    now=season.slot10+100;
    parse(await push({[table]:[ticket(itemId,3,5)],[statusTable]:[initial]}));
    assert.equal(pointer().kind,2,'First entry uses an absolute allowance after earlier earning');
    assert.equal(pointer().operation_id,operation.id);assert.equal(app.store.read(table).data.find(row=>row.underPvpRevengeTicketId===itemId).cumulativeAmount,5);
    await close();await open();app.store.db.exec('DELETE FROM reply_cache');
    assert.equal(app.store.underPvpRematchState().stock.get(id).target.amount,3);
    const later=gift(53,itemId,4);put('UserGift',[later]);const next=parse(await receive([later])).operations[0];
    parse(await push({[table]:[ticket(itemId,7,9)],UserGift:[{...later,state:1}]},[next]));
    assert.equal(pointer().kind,1);assert.equal(pointer().operation_id,next.id);assert.equal(pointer().battle_id,'');
    assert.equal(app.store.underPvpRematchState().stock.get(id).target.cumulativeAmount,9);
    await rejected('user_data/push',save({[table]:[ticket(itemId,3,5)]}));
    app.store.db.prepare('DELETE FROM under_pvp_rematch_stock_state WHERE ticket_id=?').run(itemId);
    await rejected('user_data/pull',pullValue);

    await fresh('allowance-before-grant');parse(await push({[table]:[ticket(itemId,3,0)],[statusTable]:[initial]}));
    const earned=gift(1,itemId,2);put('UserGift',[earned]);const afterInit=parse(await receive([earned])).operations[0];
    parse(await push({[table]:[ticket(itemId,5,2)]}));assert.equal(claims()[0].effect_saved,1);
    await rejected('user_data/push',save({},[afterInit]));await rejected('gift/receive',receiveValue([earned]));
    parse(await push({UserGift:[{...earned,state:1}]},[afterInit]));
    assert.equal(app.store.underPvpRematchState().stock.get(id).target.amount,5,'Amount may exceed cumulative due to the separate allowance');

    for (const first of ['stock','flag']) {
      await fresh(`earned-before-${first}-initializer`);const row=gift(1,itemId,5);put('UserGift',[row]);
      const issued=parse(await receive([row])).operations[0];
      parse(await push({[table]:[ticket(itemId,5)],UserGift:[{...row,state:1}]},[issued]));
      parse(await push(first==='stock' ? {[table]:[ticket(itemId,3,5)]} : {[statusTable]:[initial]}));
      assert.equal(app.store.underPvpRematchState().pending.length,1);
      assert.equal(pointer().kind,first==='stock'?2:1,'Flag-only initializer must not replace an unobserved stock target');
      await close();await open();now=master.underPvp.underPvpInformation[id+1].slot10+100;
      parse(await push(first==='stock' ? {[statusTable]:[initial]} : {[table]:[ticket(itemId,3,5)]}));
      assert.equal(app.store.underPvpRematchState().pending.length,0);assert.equal(pointer().kind,2);
      assert.equal(app.store.underPvpRematchState().stock.get(id).target.cumulativeAmount,5);
    }
    await fresh('mixed-reward-classes');const passId=330000001,passTable='UserUnderPvpStaminaTicket',valis=master.currencies['currency.valis'];
    put(passTable,[]);const money=app.store.read('UserCurrency').data.find(row=>row.currencyId===valis),
      mixed=[gift(1,itemId,2),gift(2,passId,2),gift(3,valis,10)];put('UserGift',mixed);
    const mixedOp=parse(await receive(mixed)).operations[0];assert.equal(app.store.underPvpRematchReward(mixedOp).length,1);
    assert.equal(app.store.underPvpPassReward(mixedOp).length,1);assert.equal(app.store.giftItemRewards(mixedOp).length,1);
    const currency={...(money ?? {userId:seed.userId,currencyId:valis,signature:123,readState:3}),
      amount:(money?.amount ?? 0)+10,cumulativeAmount:(money?.cumulativeAmount ?? 0)+10};
    const pass={userId:seed.userId,underPvpStaminaTicketId:passId,amount:2,bookEntryState:0,
      signature:0xffffffff,targetUnderPvpInfoId:master.underPvp.underPvpStaminaTicket[passId].slot7};
    parse(await push({[table]:[ticket(itemId,2)],[passTable]:[pass],UserCurrency:[currency],UserGift:mixed.map(row=>({...row,state:1}))},[mixedOp]));
    assert.equal(app.store.operations().length,0);assert.equal(claims()[0].effect_saved,1);

    for (const target of ['operation_queue','under_pvp_rematch_reward','under_pvp_rematch_reward_claim','gift_claim','reply_cache']) {
      await fresh(`issue-${target}`);const row=gift(1,itemId,2);put('UserGift',[row]);
      app.store.db.exec(`CREATE TRIGGER fail_rematch_reward BEFORE INSERT ON ${target} BEGIN SELECT RAISE(ABORT,'issue rollback'); END`);
      await rejected('gift/receive',receiveValue([row]),false);app.store.db.exec('DROP TRIGGER fail_rematch_reward');
      parse(await receive([row]));assert.equal(claims().length,1);
    }
    for (const target of ['profile','under_pvp_rematch_reward_claim','under_pvp_rematch_stock_state','operation_done','runtime','reply_cache']) {
      await fresh(`observe-${target}`);const row=gift(1,itemId,2);put('UserGift',[row]);const issued=parse(await receive([row])).operations[0];
      const timing=target==='profile' ? "BEFORE UPDATE ON profile WHEN NEW.name='UserUnderPvpRevengeTicket'" :
        ['under_pvp_rematch_reward_claim','runtime'].includes(target) ? `BEFORE UPDATE ON ${target}` : `BEFORE INSERT ON ${target}`;
      app.store.db.exec(`CREATE TRIGGER fail_rematch_reward ${timing} BEGIN SELECT RAISE(ABORT,'save rollback'); END`);
      await rejected('user_data/push',save({[table]:[ticket(itemId,2)],UserGift:[{...row,state:1}]},[issued]),false);
      app.store.db.exec('DROP TRIGGER fail_rematch_reward');
      parse(await push({[table]:[ticket(itemId,2)],UserGift:[{...row,state:1}]},[issued]));
      assert.equal(claims()[0].effect_saved,1);assert.equal(app.store.operations().length,0);
    }
    await fresh('missing-root');const legacy=gift(1,itemId,2);put('UserGift',[legacy]);const legacyOp=parse(await receive([legacy])).operations[0];
    app.store.db.prepare('DELETE FROM under_pvp_rematch_reward WHERE operation_id=?').run(legacyOp.id);
    await rejected('gift/receive',receiveValue([legacy]));await rejected('user_data/confirm',null);
    await rejected('user_data/push',save({[table]:[ticket(itemId,2)]},[legacyOp]));
    await fresh('corrupt-captures');const source=gift(1,itemId,2);put('UserGift',[source]);const captured=parse(await receive([source])).operations[0],
      root=app.store.db.prepare('SELECT * FROM under_pvp_rematch_reward WHERE operation_id=?').get(captured.id),claim=claims()[0];
    for (const [field,value] of [['before_ticket','0'],['before_ticket','{'],['after_stock','{}'],['after_stock',JSON.stringify({amount:3,cumulativeAmount:2,reservedAmount:0})]]) {
      app.store.db.prepare(`UPDATE under_pvp_rematch_reward_claim SET ${field}=? WHERE operation_id=?`).run(value,captured.id);
      await rejected('user_data/push',save({[table]:[ticket(itemId,2)]}));
      app.store.db.prepare(`UPDATE under_pvp_rematch_reward_claim SET ${field}=? WHERE operation_id=?`).run(claim[field],captured.id);
    }
    app.store.db.prepare('UPDATE under_pvp_rematch_reward SET parameters=? WHERE operation_id=?').run('{',captured.id);
    await rejected('gift/receive',receiveValue([source]));
    app.store.db.prepare('UPDATE under_pvp_rematch_reward SET parameters=? WHERE operation_id=?').run(root.parameters,captured.id);
    const changed=JSON.parse(root.parameters);changed.receivedItems[0].amount=3;
    app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(changed),captured.id);
    await rejected('gift/receive',receiveValue([source]));
    app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(root.parameters,captured.id);
    parse(await push({[table]:[ticket(itemId,2)],UserGift:[{...source,state:1}]},[captured]));

    await fresh('grant-during-initialization');parse(await push({[statusTable]:[initial]}));
    const waiting=gift(1,itemId,1);put('UserGift',[waiting]);await rejected('gift/receive',receiveValue([waiting]));
    parse(await push({[table]:[ticket(itemId,3,0)]}));parse(await receive([waiting]));
    await fresh('initialization-during-grant');const pending=gift(1,itemId,2);put('UserGift',[pending]);parse(await receive([pending]));
    await rejected('user_data/push',save({[table]:[ticket(itemId,3,2)],[statusTable]:[initial]}));

    for (const [amount,cumulative] of [[999999998,5],[5,999999998],[999999999,999999999]]) {
      await fresh(`cap-${amount}-${cumulative}`,[ticket(itemId,amount,cumulative,7)],[initial]);
      const row=gift(1,itemId,2);put('UserGift',[row]);const issued=parse(await receive([row])).operations[0],
        after=ticket(itemId,Math.min(999999999,amount+2),Math.min(999999999,cumulative+2),7);
      if (amount===999999999 && cumulative===999999999) {
        await rejected('user_data/push',save({},[issued]));
        parse(await push({UserGift:[{...row,state:1}]},[issued]));
        assert.equal(claims()[0].effect_saved,1,'Unchanged capped stock observes native flags, not an invented dirty row');
      } else parse(await push({[table]:[after],UserGift:[{...row,state:1}]},[issued]));
      assert.equal(app.store.underPvpRematchState().stock.get(id).target.reservedAmount,7);
    }
    await fresh('overflow',[ticket(itemId,999999999)],[initial]);const overflow=gift(1,itemId,0x7fffffff);put('UserGift',[overflow]);
    await rejected('gift/receive',receiveValue([overflow]));
    console.log('Rematch present source/save fixtures passed; natural earning and native acceptance still required');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
