'use strict';

// DEFERRED / NOT RUN until all packets and unfinished branches are implemented.
// OFFLINE legacy cost plus active-battle receipt lifecycle, not native battle revival.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json');
const master=require('../data/danmemore-master.json');
const route='battle/continue',modern='currency/hard/consume';
const md5=bytes=>crypto.createHash('md5').update(bytes).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-continue-'));
  const database=path.join(directory,'save.sqlite');
  let app,port,sequence=0;
  const open=async()=>{
    app=createServer({database,seed,master,wallNowSeconds:()=>1577836800,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async()=>{if(app) {await app.close();app=null;}};
  const send=(action=route,value=undefined)=>request(port,++sequence,value,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const snapshot=()=>app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]);
  const saveBattle=rows=>{
    const data=JSON.stringify(rows);
    app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserAdventureState'").run(data,md5(data));
  };
  const rejected=async(promise,status=503)=>{
    const before=snapshot(),reply=await promise;
    assert.equal(reply.status,status,reply.body.toString());assert.deepEqual(snapshot(),before);
    if(status===503 && reply.body.length) assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const ack=operation=>send('user_data/push',{badges:null,scripts:{},dataTokens:{},
    checksums:{before:{},after:{}},deltas:[],operations:[{id:operation.id,verifier:operation.token}]});
  try {
    await open();
    assert.equal(master.consumes[81021001].key,'CONSUME_BATTLE_CONTINUE');
    assert.equal(master.consumes[81021001].amount,10);
    await rejected(send(),400); // Insufficient Iris is not a successful callback.
    app.store.changeHardCurrency(7);app.store.changePaidCurrency(500);
    const info=app.store.read('UserInfo'),battle=app.store.read('UserAdventureState');
    const idleBattle=[{...battle.data[0],stageId:0}];
    saveBattle(idleBattle);await rejected(send());saveBattle(battle.data);
    for(const [table,event] of [['hard_currency','UPDATE'],['operation_queue','INSERT'],
      ['hard_currency_consume','INSERT'],['battle_continue_purchase','INSERT'],
      ['hard_currency_consume_request','INSERT'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_continue BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'continue rollback'); END`);
      const before=snapshot(),reply=await send();
      assert.equal(reply.status,503);assert.equal(reply.body.length,0);assert.deepEqual(snapshot(),before);
      app.store.db.exec('DROP TRIGGER fail_continue');
    }
    const bought=parse(await send()),originalSequence=sequence,operation=bought.operation;
    assert.equal(operation.type,4000);assert.deepEqual(operation.parameters,{});
    assert.deepEqual(bought.operations,[operation]);
    assert.equal(app.store.hardCurrency(),0);assert.equal(app.store.paidCurrency(),497);
    assert.deepEqual(app.store.read('UserInfo'),info);assert.deepEqual(app.store.read('UserAdventureState'),battle);
    const receipt=app.store.db.prepare('SELECT * FROM hard_currency_consume WHERE operation_id=?').get(operation.id);
    assert.equal(receipt.consume_id,81021001);assert.equal(receipt.iris_cost,10);
    assert.equal(receipt.sp_field,'');assert.equal(receipt.sp_before,0);assert.equal(receipt.sp_minimum,0);
    const battleReceipt=app.store.db.prepare('SELECT * FROM battle_continue_purchase WHERE operation_id=?').get(operation.id);
    assert.equal(battleReceipt.stage_id,battle.data[0].stageId);
    assert.equal(battleReceipt.state_json,JSON.stringify(battle.data));
    assert.equal(battleReceipt.state_hash,md5(battleReceipt.state_json));
    assert.equal(app.store.db.prepare('SELECT body_hash FROM hard_currency_consume_request WHERE request_key=?')
      .get(`${originalSequence}/${originalSequence}`).body_hash,md5(Buffer.alloc(0)));
    for(const body of [null,{}, {consumeId:81021001}]) await rejected(send(route,body),400);
    const pendingWallet=app.store.paidCurrency();
    assert.deepEqual(parse(await send()),bought,'Pending callback must retain its4000 and one debit');
    assert.equal(app.store.paidCurrency(),pendingWallet);
    await rejected(send(modern,{consumeId:81021001}));
    saveBattle(idleBattle);await rejected(send());
    assert.ok(parse(await send('user_data/confirm')).operations.some(row=>row.id===operation.id),
      'Cold return-only delivery remains settleable after the captured encounter ends');
    saveBattle(battle.data);
    app.store.db.prepare('DELETE FROM reply_cache WHERE action=?').run(route);
    await close();await open();
    const retained=snapshot();
    assert.deepEqual(parse(await request(port,originalSequence,undefined,String(originalSequence),route)),bought);
    assert.deepEqual(snapshot(),retained,'Permanent retry must not change sequence, alias, queue or wallet');
    assert.ok(parse(await send('user_data/confirm')).operations.some(row=>row.id===operation.id));
    app.store.db.prepare('UPDATE hard_currency_consume SET iris_cost=11 WHERE operation_id=?').run(operation.id);
    await rejected(send('user_data/confirm'));await rejected(send());
    app.store.db.prepare('UPDATE hard_currency_consume SET iris_cost=10 WHERE operation_id=?').run(operation.id);
    app.store.db.prepare("UPDATE battle_continue_purchase SET state_hash='00000000000000000000000000000000' WHERE operation_id=?").run(operation.id);
    await rejected(send('user_data/confirm'));await rejected(send());await rejected(ack(operation));
    app.store.db.prepare('UPDATE battle_continue_purchase SET state_hash=? WHERE operation_id=?')
      .run(md5(battleReceipt.state_json),operation.id);
    for(const [table,event] of [['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_continue_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'ACK rollback'); END`);
      const before=snapshot(),reply=await ack(operation);
      assert.equal(reply.status,503);assert.equal(reply.body.length,0);assert.deepEqual(snapshot(),before);
      app.store.db.exec('DROP TRIGGER fail_continue_ack');
    }
    saveBattle(idleBattle);parse(await ack(operation));parse(await ack(operation));saveBattle(battle.data);
    assert.ok(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id));
    assert.equal(app.store.paidCurrency(),pendingWallet);
    app.store.db.prepare('DELETE FROM reply_cache WHERE action=?').run(route);
    await close();await open();
    await rejected(request(port,originalSequence,undefined,String(originalSequence),route));
    const next=parse(await send()).operation;
    assert.notEqual(next.id,operation.id);assert.equal(app.store.paidCurrency(),pendingWallet-10);
    parse(await ack(next));
    saveBattle(idleBattle);const beforeModernWallet=app.store.paidCurrency();
    await rejected(send(modern,{consumeId:81021001}));assert.equal(app.store.paidCurrency(),beforeModernWallet);
    saveBattle(battle.data);
    const current=parse(await send(modern,{consumeId:81021001})).operation;
    assert.equal(current.type,10100);
    assert.equal(app.store.db.prepare('SELECT stage_id FROM battle_continue_purchase WHERE operation_id=?')
      .get(current.id).stage_id,battle.data[0].stageId);
    const modernWallet=app.store.paidCurrency();await rejected(send());
    assert.equal(app.store.paidCurrency(),modernWallet);parse(await ack(current));
    // Preserve unpriced historical queues/caches; never retroactively charge them.
    const legacy=app.store.issueOperation(4000,{}),legacyBody=Buffer.from(JSON.stringify({code:0,operations:[legacy]}));
    const legacySequence=++sequence,legacyKey=`${legacySequence}/${legacySequence}`;
    app.store.saveReply(legacyKey,route,md5(Buffer.alloc(0)),'application/json',legacyBody);
    await rejected(request(port,legacySequence,undefined,String(legacySequence),route));
    await rejected(send());await rejected(send('user_data/confirm'));await rejected(ack(legacy));
    assert.ok(app.store.operations().some(row=>row.id===legacy.id));
    assert.equal(app.store.db.prepare('SELECT 1 FROM hard_currency_consume WHERE operation_id=?').get(legacy.id),undefined);
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
  console.log('Battle-continue active-stage/debit/retry/receipt fixtures passed; no native revival proof');
}

main().catch(error=>{console.error(error);process.exitCode=1;});
