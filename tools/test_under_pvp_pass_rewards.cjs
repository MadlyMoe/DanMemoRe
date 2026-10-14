'use strict';

// DEFERRED / NOT RUN. Synthetic flat gifts are NOT native earning/eligibility proof.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const { createServer,OFFLINE_UNAVAILABLE_CODE }=require('./danmemore_server.cjs');
const { request }=require('./test_danmemore_server.cjs');
const master=require('../data/danmemore-master.json'),seed=require('../data/danmemore-seed.json');
const table='UserUnderPvpStaminaTicket',itemId=330000001,season=master.underPvp.underPvpInformation[69000000001];
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
const ticket=(id,amount)=>({ userId:seed.userId,underPvpStaminaTicketId:id,amount,bookEntryState:0,
  signature:0xffffffff,targetUnderPvpInfoId:master.underPvp.underPvpStaminaTicket[id].slot7 });

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-pass-rewards-'));
  let app,port,database,sequence=0,now=season.slot10+100;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const fresh=async name=>{await close();database=path.join(directory,`${name}.sqlite`);await open();
    put(table,[]);const info=app.store.read('UserInfo').data;
    Object.assign(info[0].playerStatus,{underPvpSP:3,underPvpSPUpdatedAt:now});put('UserInfo',info);};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected=async(action,value,status=503,offline=true)=>{const before=snapshot(),reply=await send(action,value);
    assert.equal(reply.status,status,reply.body.toString());if(offline)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Failure retains profiles, receipts, flags, queue, sequence and reply cache');};
  const gift=(id,pass,amount)=>({userId:seed.userId,id,itemId:pass,amount,title:'Synthetic original-ID pass present',message:'',
    senderType:1,senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,
    pcLimitBreakCount:0,pcHeroSublimateCount:0,state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0});
  const receiveValue=gifts=>({userId:seed.userId,giftIds:gifts.map(row=>row.id)});
  const receive=gifts=>send('gift/receive',receiveValue(gifts));
  const save=(putItems={},operations=[],deleteItems={})=>({badges:null,scripts:{},dataTokens:{},
    operations:operations.map(row=>({id:row.id,verifier:row.token})),checksums:{before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name] ?? [])]))},
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length ? [{signature:0,trigger:'GiftReceive',putItems,deleteItems}] : []});
  const push=(putItems={},operations=[],deleteItems={})=>send('user_data/push',save(putItems,operations,deleteItems));
  const claims=()=>app.store.db.prepare('SELECT * FROM under_pvp_pass_reward_claim ORDER BY operation_id,ticket_id').all();
  try {
    await fresh('all-original-passes');
    const ids=Object.keys(master.underPvp.underPvpStaminaTicket).map(Number);assert.equal(ids.length,54);
    const gifts=ids.map((id,index)=>gift(index+1,id,2));gifts.push(gift(55,itemId,3));put('UserGift',gifts);
    const pullValue={tables:[table]},pullReply=await send('user_data/pull',pullValue),pullIdentity=sequence;
    assert.equal(pullReply.status,200);
    const response=await receive(gifts),identity=sequence,result=parse(response),operation=result.operations[0];
    assert.equal(operation.type,2000);assert.equal(result.receivedItems.length,54);assert.equal(claims().length,54);
    assert.equal(claims().find(row=>row.ticket_id===itemId).amount,5,'Repeated original-ID presents aggregate once');
    assert.equal(app.store.read(table).data.length,0,'No native inventory pre-credit');
    assert.equal(app.store.read('UserInfo').data[0].playerStatus.underPvpSP,3,'Earning passes grants no attempts');
    assert.equal(app.store.db.prepare('SELECT 1 FROM gift_item_claim WHERE operation_id=?').get(operation.id),undefined,
      'Passes have no fabricated ordinary cumulative receipt');
    assert.deepEqual((await request(port,identity,receiveValue(gifts),String(identity),'gift/receive')).body,response.body);
    const extra=gift(56,itemId,1);put('UserGift',gifts.concat(extra));
    await rejected('gift/receive',receiveValue([extra]));
    await rejected('user_data/push',save({},[operation]));
    await rejected('user_data/push',save({[table]:[ticket(itemId,6)]}));
    await rejected('user_data/pull',pullValue);
    const flags=gifts.map(row=>({...row,state:1}));
    const flagged=parse(await push({UserGift:flags}));assert.deepEqual(flagged.operations,[],'Flag-first save suppresses additive redelivery');
    assert.ok(app.store.operations().some(row=>row.id===operation.id),'Suppression retains the actual queue');
    await rejected('gift/receive',receiveValue(gifts));await rejected('user_data/confirm',null);
    await rejected('user_data/push',save({},[operation]));
    await close();await open();now+=1000;
    const acquired=ids.map(id=>ticket(id,id===itemId ? 5 : 2));
    parse(await push({[table]:acquired.slice(0,10)}));
    assert.equal(claims().filter(row=>row.effect_saved).length,10,'Per-ticket partial observation survives restart/expiry');
    await rejected('user_data/push',save({},[operation]));
    await rejected('user_data/push',save({[table]:[ticket(itemId,4)]}));
    await rejected('gift/receive',receiveValue(gifts));
    const observed=parse(await push({[table]:acquired}));assert.deepEqual(observed.operations,[]);
    assert.equal(claims().filter(row=>row.effect_saved).length,54);
    parse(await push({},[operation]));assert.equal(app.store.operations().length,0);
    assert.equal((await request(port,identity,receiveValue(gifts),String(identity),'gift/receive')).status,503,
      'Completed cached present cannot add the same passes again');
    assert.equal((await request(port,pullIdentity,pullValue,String(pullIdentity),'user_data/pull')).status,503,
      'Old binary pull cannot remove newly earned passes');
    await rejected('user_data/push',save({[table]:[ticket(itemId,6)]}));
    await rejected('user_data/push',save({},[],{[table]:[{underPvpStaminaTicketId:itemId}]}));
    now=season.slot10+100;
    const info=app.store.read('UserInfo').data;info[0].playerStatus.underPvpSP=4;
    parse(await push({[table]:[ticket(itemId,4)],UserInfo:info}));
    assert.equal(app.store.db.prepare('SELECT kind FROM under_pvp_pass_stock_state WHERE ticket_id=?').get(itemId).kind,0);
    await close();await open();app.store.db.exec('DELETE FROM reply_cache');
    assert.equal(app.store.underPvpPassStock(app.store.read(table).data).get(itemId).amount,4,'Consumed earned stock survives restart');
    const later=gift(57,itemId,4);put('UserGift',[later]);
    const next=parse(await receive([later])).operations[0];
    parse(await push({[table]:[ticket(itemId,8)],UserGift:[{...later,state:1}]},[next]));
    const state=app.store.db.prepare('SELECT * FROM under_pvp_pass_stock_state WHERE ticket_id=?').get(itemId);
    assert.equal(state.kind,1);assert.equal(state.use_id,1);assert.equal(state.operation_id,next.id);
    assert.equal(app.store.underPvpPassStock(app.store.read(table).data).get(itemId).amount,8,'A later grant follows consumption at a rewound clock');
    await rejected('user_data/push',save({[table]:[ticket(itemId,4)]}));
    app.store.db.prepare('DELETE FROM under_pvp_pass_stock_state WHERE ticket_id=?').run(itemId);
    await rejected('user_data/pull',pullValue);

    for (const target of ['operation_queue','under_pvp_pass_reward','under_pvp_pass_reward_claim','gift_claim','reply_cache']) {
      await fresh(`issue-${target}`);const row=gift(1,itemId,2);put('UserGift',[row]);
      app.store.db.exec(`CREATE TRIGGER fail_pass_reward BEFORE INSERT ON ${target} BEGIN SELECT RAISE(ABORT,'pass issue rollback'); END`);
      await rejected('gift/receive',receiveValue([row]),503,false);app.store.db.exec('DROP TRIGGER fail_pass_reward');
      parse(await receive([row]));assert.equal(claims().length,1);
    }
    for (const target of ['profile','under_pvp_pass_reward_claim','under_pvp_pass_stock_state','operation_done','reply_cache']) {
      await fresh(`observe-${target}`);const row=gift(1,itemId,2);put('UserGift',[row]);
      const issued=parse(await receive([row])).operations[0];
      const timing=target==='profile' ? "BEFORE UPDATE ON profile WHEN NEW.name='UserUnderPvpStaminaTicket'" :
        target==='under_pvp_pass_reward_claim' ? `BEFORE UPDATE ON ${target}` : `BEFORE INSERT ON ${target}`;
      app.store.db.exec(`CREATE TRIGGER fail_pass_reward ${timing} BEGIN SELECT RAISE(ABORT,'pass observation rollback'); END`);
      await rejected('user_data/push',save({[table]:[ticket(itemId,2)],UserGift:[{...row,state:1}]},[issued]),503,false);
      app.store.db.exec('DROP TRIGGER fail_pass_reward');
      parse(await push({[table]:[ticket(itemId,2)],UserGift:[{...row,state:1}]},[issued]));
      assert.equal(claims()[0].effect_saved,1);assert.equal(app.store.operations().length,0);
    }
    await fresh('legacy-missing-root');const legacy=gift(1,itemId,2);put('UserGift',[legacy]);
    const legacyOp=parse(await receive([legacy])).operations[0];
    app.store.db.prepare('DELETE FROM under_pvp_pass_reward WHERE operation_id=?').run(legacyOp.id);
    await rejected('gift/receive',receiveValue([legacy]));await rejected('user_data/confirm',null);
    const second=gift(2,itemId,1);put('UserGift',[legacy,second]);await rejected('gift/receive',receiveValue([second]));
    await rejected('user_data/push',save({[table]:[ticket(itemId,2)]},[legacyOp]));
    await fresh('corrupt-captures');const source=gift(1,itemId,2);put('UserGift',[source]);
    const captured=parse(await receive([source])).operations[0],root=app.store.db.prepare(
      'SELECT * FROM under_pvp_pass_reward WHERE operation_id=?').get(captured.id);
    app.store.db.prepare('UPDATE under_pvp_pass_reward SET parameters=? WHERE operation_id=?').run('{',captured.id);
    await rejected('gift/receive',receiveValue([source]));
    app.store.db.prepare('UPDATE under_pvp_pass_reward SET parameters=? WHERE operation_id=?').run(root.parameters,captured.id);
    app.store.db.prepare('UPDATE under_pvp_pass_reward_claim SET after_amount=3 WHERE operation_id=?').run(captured.id);
    await rejected('user_data/push',save({[table]:[ticket(itemId,2)]}));
    app.store.db.prepare('UPDATE under_pvp_pass_reward_claim SET after_amount=2 WHERE operation_id=?').run(captured.id);
    const changed=JSON.parse(root.parameters);changed.receivedItems[0].amount=3;
    app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(changed),captured.id);
    await rejected('gift/receive',receiveValue([source]));
    app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(root.parameters,captured.id);
    parse(await push({[table]:[ticket(itemId,2)],UserGift:[{...source,state:1}]},[captured]));

    await fresh('grant-during-debit-recovery');put(table,[ticket(itemId,2)]);
    parse(await push({[table]:[ticket(itemId,1)]}));assert.ok(app.store.underPvpPendingPass());
    const waiting=gift(1,itemId,1);put('UserGift',[waiting]);await rejected('gift/receive',receiveValue([waiting]));
    const recovered=app.store.read('UserInfo').data;recovered[0].playerStatus.underPvpSP=4;
    parse(await push({UserInfo:recovered}));parse(await receive([waiting]));
    await fresh('capacity');put(table,[ticket(itemId,999999999)]);const capped=gift(1,itemId,1);put('UserGift',[capped]);
    await rejected('gift/receive',receiveValue([capped]));
    put(table,[ticket(itemId,999999998)]);const full=parse(await receive([capped])).operations[0];
    parse(await push({[table]:[ticket(itemId,999999999)],UserGift:[{...capped,state:1}]},[full]));
    console.log('Under Telskyura pass-present source/save fixtures passed; native eligibility/effects/acceptance still required');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
