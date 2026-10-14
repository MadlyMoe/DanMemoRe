'use strict';

// DEFERRED synthetic cost/save/retry proof, NOT native revival, regeneration,
// lost battle-session recovery or publisher eligibility. Continue10100 also
// requires a captured active original stage; it is not defeated-state proof. War Game10400 now
// has bounded original timer/stock capture checks; Record Buster10500 uses
// its original daily reset/full-stock/timestamp capture;10200 now also
// checks ordered original level/SP capture and withholds save-reply callbacks
// until cold confirmation or real ACK. No native acceptance.
// Abyss10600 has its
// own original calendar/timer/exact-save fixtures in test_serial_pvp_stamina.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE, pvpStamina, pvpRefill, pvbStamina, pvbRefill } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
const action = 'currency/hard/consume';
const cases = [[81021001,10100,''],[81041001,10200,'baseSP'],[81051001,10400,'pvpSP'],
  [81061001,10500,'pvbSP']];

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-stamina-'));
  const database = path.join(directory, 'save.sqlite');
  let app, port, sequence = 0, wallNow = 1660950000;
  const open = async (metadata=master) => {
    app = createServer({ database, seed, master:metadata, wallNowSeconds: () => wallNow, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const send = (route, body) => request(port, ++sequence, body, String(sequence), route);
  const parse = reply => { assert.equal(reply.status, 200, reply.body.toString()); return JSON.parse(reply.body); };
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const putInfo = rows => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),'UserInfo');
  const save = (rows, operations = []) => send('user_data/push', { badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: rows ? { UserInfo: md5(rows) } : {} },
    deltas: rows ? [{ signature: 0, trigger: 'Stamina', putItems: { UserInfo: rows }, deleteItems: {} }] : [],
    operations: operations.map(op => ({ id: op.id, verifier: op.token })) });
  const settle = async op => {
    const receipt = app.store.db.prepare('SELECT * FROM hard_currency_consume WHERE operation_id=?').get(op.id);
    const rows = structuredClone(app.store.read('UserInfo').data);
    if (receipt.sp_field) rows[0].playerStatus[receipt.sp_field] = receipt.sp_minimum;
    if(op.type===10500) Object.assign(rows[0].playerStatus,pvbRefill(JSON.parse(receipt.pvb_baseline),receipt.pvb_issued_at).candidates[0].after);
    parse(await save(receipt.sp_field ? rows : null, [op]));
  };
  const rejected = async (route, body, status, unavailable = true) => {
    const before = snapshot(), response = await send(route, body);
    assert.equal(response.status, status, `${route}: ${response.body.toString()}`); assert.equal(snapshot(), before);
    if (status === 503 && unavailable) assert.equal(JSON.parse(response.body).code, OFFLINE_UNAVAILABLE_CODE);
    if (status === 503 && !unavailable) assert.equal(response.body.length,0,'Database errors remain real failures, not unsupported cancellation');
  };
  try {
    const at=wallNow;
    for (const [stock,elapsed,expected,timerAdvance] of [[0,1799,0,0],[0,1800,1,1800],
      [1,3607,3,3600],[9,5407,10,5400],[10,5407,10,0],[14,5407,14,0],[15,5407,15,0],[3,-7,3,0]]) {
      const status={pvpSP:stock,pvpSPUpdatedAt:at-elapsed};
      assert.deepEqual(pvpStamina(status,at),{pvpSP:expected,pvpSPUpdatedAt:status.pvpSPUpdatedAt+timerAdvance});
    }
    assert.throws(()=>pvpStamina({pvpSP:0,pvpSPUpdatedAt:0},(0x7fffffff+1)*1800),/overflow/);
    assert.throws(()=>pvpStamina({pvpSP:1,pvpSPUpdatedAt:-1},at),/reconciliation/);
    assert.throws(()=>pvpRefill({pvpSP:15,pvpSPUpdatedAt:at},at),/cap/);
    assert.deepEqual(pvpRefill({pvpSP:1,pvpSPUpdatedAt:at-3607},at).candidates,[
      {before:{pvpSP:1,pvpSPUpdatedAt:at-3607},after:{pvpSP:6,pvpSPUpdatedAt:at-3607}},
      {before:{pvpSP:3,pvpSPUpdatedAt:at-7},after:{pvpSP:8,pvpSPUpdatedAt:at-7}},
    ]);
    //War Game uses native2544728 constant5, NOT the generic master recovery1.
    assert.equal(master.consumes[81051001].recovery,1);
    const midnight=Math.floor((at+32400)/86400)*86400-32400;
    for(const [stock,last,when,expected,time] of [[0,midnight-1,midnight-1,0,midnight-1],
      [0,midnight-1,midnight,5,midnight],[3,midnight-1,at,5,at],[7,midnight-1,at,7,at],
      [12,midnight-1,at,12,at],[0,at-1,at,0,at-1],[0,at+1,at,0,at+1]])
      assert.deepEqual(pvbStamina({pvbSP:stock,pvbSPLastResetAt:last},when),{pvbSP:expected,pvbSPLastResetAt:time});
    assert.equal(pvbRefill({pvbSP:0,pvbSPLastResetAt:midnight-1},at).minimum,10);
    assert.equal(pvbRefill({pvbSP:0,pvbSPLastResetAt:at-1},at).minimum,5);
    assert.throws(()=>pvbRefill({pvbSP:10,pvbSPLastResetAt:at},at),/cap/);
    for(const invalid of [{pvbSP:-1,pvbSPLastResetAt:at},{pvbSP:0,pvbSPLastResetAt:null},
      {pvbSP:0,pvbSPLastResetAt:0x80000000}]) assert.throws(()=>pvbStamina(invalid,at),/reconciliation/);
    assert.throws(()=>pvbStamina({pvbSP:0,pvbSPLastResetAt:at},0x80000000),/reconciliation/);
    await open(); app.store.changeHardCurrency(7); app.store.changePaidCurrency(500);
    for (const [consumeId,type,field] of cases) {
      const beforeInfo = app.store.read('UserInfo'), beforeFree = app.store.hardCurrency(), beforePaid = app.store.paidCurrency();
      const first = await send(action, { consumeId }), requestSequence = sequence;
      const response = parse(first), op = response.operation;
      assert.equal(op.type,type); assert.deepEqual(op.parameters,{}); assert.deepEqual(response.operations,[op]);
      assert.deepEqual(app.store.read('UserInfo'),beforeInfo,'No server pre-credit of native stamina');
      assert.equal(app.store.hardCurrency(),Math.max(0,beforeFree-10));
      assert.equal(app.store.paidCurrency(),beforePaid-Math.max(0,10-beforeFree));
      const receipt = app.store.db.prepare('SELECT * FROM hard_currency_consume WHERE operation_id=?').get(op.id);
      assert.equal(receipt.sp_field,field); assert.equal(receipt.iris_cost,10);
      if(type===10100) {
        const battle=app.store.read('UserAdventureState'),capture=app.store.db.prepare(
          'SELECT * FROM battle_continue_purchase WHERE operation_id=?').get(op.id);
        assert.equal(capture.stage_id,battle.data[0].stageId);
        assert.equal(capture.state_hash,crypto.createHash('md5').update(capture.state_json).digest('hex'));
        assert.deepEqual(JSON.parse(capture.state_json),battle.data);
      }
      if (field) {
        const expected = type === 10200 ? beforeInfo.data[0].playerStatus.baseSP + master.playerMaxSP[beforeInfo.data[0].playerStatus.level]
          : type===10500 ? pvbRefill(beforeInfo.data[0].playerStatus,at).minimum
          : Math.min(15,beforeInfo.data[0].playerStatus[field]+5);
        assert.equal(receipt.sp_minimum,expected);
        let before = snapshot(); assert.equal((await save(null,[op])).status,400); assert.equal(snapshot(),before);
        const short = structuredClone(beforeInfo.data); short[0].playerStatus[field] = expected-1;
        before = snapshot(); assert.equal((await save(short,[op])).status,400); assert.equal(snapshot(),before);
      }
      assert.deepEqual((await request(port,requestSequence,{consumeId},String(requestSequence),action)).body,first.body);
      assert.deepEqual(parse(await send(action,{consumeId})),response,'New identity while pending resumes one operation');
      const chargedWallet = [app.store.hardCurrency(),app.store.paidCurrency()];
      let before = snapshot();
      assert.equal((await request(port,requestSequence,{consumeId:consumeId+1},String(requestSequence),action)).status,400);
      assert.equal(snapshot(),before);
      app.store.beginSession(); await close(); await open();
      assert.deepEqual((await request(port,requestSequence,{consumeId},String(requestSequence),action)).body,first.body,
        'Pending identity survives session-cache eviction and restart');
      assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],chargedWallet);
      if (field) {
        const rows = structuredClone(beforeInfo.data); rows[0].playerStatus[field] = receipt.sp_minimum;
        if(type===10500) Object.assign(rows[0].playerStatus,pvbRefill(beforeInfo.data[0].playerStatus,at).candidates[0].after);
        const applied=parse(await save(rows));
        if(type===10200) {
          assert.ok(!applied.operations.some(row=>row.id===op.id));assert.equal(applied.operation,undefined);
          assert.ok(app.store.operations().some(row=>row.id===op.id),'Observed refill remains queued until real ACK');
        }
        await close(); await open();
        assert.equal(app.store.db.prepare('SELECT effect_saved FROM hard_currency_consume WHERE operation_id=?').get(op.id).effect_saved,1);
        if(type===10200) {
          await rejected(action,{consumeId},503);await rejected('user_data/confirm',undefined,503);
          await rejected('user/login',undefined,503);await rejected('user_data/pull',{tables:['UserInfo']},503);
          const before=snapshot(),replayed=await request(port,requestSequence,{consumeId},String(requestSequence),action);
          assert.equal(replayed.status,503);assert.equal(JSON.parse(replayed.body).code,OFFLINE_UNAVAILABLE_CODE);
          assert.equal(snapshot(),before);assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],chargedWallet);
        }
        // Once saved, later legitimate spending must not become an SP floor.
        rows[0].playerStatus[field] = Math.max(0,receipt.sp_minimum-3);
        parse(await save(rows)); parse(await save(null,[op]));
      } else parse(await save(null,[op]));
      assert.equal(app.store.operations().some(row => row.id === op.id),false);
      before = snapshot();
      const old = await request(port,requestSequence,{consumeId},String(requestSequence),action);
      assert.equal(old.status,503); assert.equal(JSON.parse(old.body).code,OFFLINE_UNAVAILABLE_CODE);
      assert.equal(snapshot(),before,'Completed callback cannot charge or reapply stamina');
      app.store.beginSession(); await close(); await open();
      before = snapshot(); assert.equal((await request(port,requestSequence,{consumeId},String(requestSequence),action)).status,503);
      assert.equal(snapshot(),before);
      const next = parse(await send(action,{consumeId})).operation;
      assert.notEqual(next.id,op.id,'A distinct deliberate purchase remains possible after settling'); await settle(next);
    }
    // WRITTEN ONLY: four standalone normal-refill capture contexts. Imported
    // level/SP/EXP and funding are synthetic, not native earning/attribution.
    for(const [level,stock] of [[1,7],[3,7],[999,0],[1,0x7fffffff-7]]) {
      const rows=structuredClone(seed.data.UserInfo);
      Object.assign(rows[0].playerStatus,{level,totalExp:master.playerLevels.find(([value])=>value===level)[1],baseSP:stock});
      putInfo(rows);app.store.changeHardCurrency(100);
      // Stored recovery inputs are unavailable503; submitted save mutations
      // retain the original400 validation. Neither may debit or repair a row.
      const invalidExperience=[{totalExp:-1},{totalExp:0.5},{totalExp:master.playerLevels.at(-1)[1]+1},
        {totalExp:String(rows[0].playerStatus.totalExp)},{level:level===999?1:999}].map(status=>{
          const changed=structuredClone(rows);Object.assign(changed[0].playerStatus,status);return changed;
        });
      for(const changed of invalidExperience) {
        putInfo(changed);await rejected(action,{consumeId:81041001},503);putInfo(rows);
      }
      const issued=await send(action,{consumeId:81041001}),identity=sequence,operation=parse(issued).operation,
        receipt=app.store.fixedConsumeReceipt(operation),queue=app.store.operations(),wallet=[app.store.hardCurrency(),app.store.paidCurrency()];
      assert.equal(receipt.sp_minimum,Math.min(0x7fffffff,stock+master.playerMaxSP[level]));
      assert.equal(receipt.sp_level,level,'A normal refill receipt retains its exact derived issuance level');
      assert.equal(receipt.sp_capacity,master.playerMaxSP[level],
        'A normal refill receipt retains its exact authored issuance capacity even when saturated');
      assert.deepEqual(app.store.read('UserInfo').data,rows);
      const cold=await send('user_data/confirm',undefined),coldIdentity=sequence;
      assert.deepEqual(parse(cold).operations,[operation]);assert.deepEqual(app.store.operations(),queue);
      assert.deepEqual(app.store.fixedConsumeReceipt(operation),receipt);
      const noEffects=parse(await save(null));assert.ok(!noEffects.operations.some(row=>row.id===operation.id));
      assert.equal(app.store.fixedConsumeReceipt(operation).effect_saved,0,'Withholding a save reply is not observation or ACK');
      assert.deepEqual(app.store.read('UserInfo').data,rows);
      assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
      assert.equal((await send('user/login',undefined)).status,200);
      assert.equal((await send('user_data/pull',{tables:['UserInfo']})).status,200);
      await close();await open();
      assert.deepEqual((await request(port,identity,{consumeId:81041001},String(identity),action)).body,issued.body);
      assert.deepEqual((await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm')).body,cold.body);
      for(const changed of [{...operation,signature:operation.signature%0x7fffffff+1},{...operation,token:'altered-receipt-token'}])
        assert.throws(()=>app.store.normalRefillDelivery(changed,'user_data/confirm'),/original queued delivery/);
      assert.equal(app.store.normalRefillDelivery(operation,'user_data/confirm'),true);
      for(const changed of invalidExperience) {
        putInfo(changed);
        await rejected(action,{consumeId:81041001},503);await rejected('user_data/confirm',undefined,503);
        await rejected('user/login',undefined,503);await rejected('user_data/pull',{tables:['UserInfo']},503);
        for(const [cachedIdentity,route,value] of [[identity,action,{consumeId:81041001}],
          [coldIdentity,'user_data/confirm',undefined]]) {
          const before=snapshot(),response=await request(port,cachedIdentity,value,String(cachedIdentity),route);
          assert.equal(response.status,503);assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
          assert.equal(snapshot(),before);
        }
        putInfo(rows);
        assert.throws(()=>app.store.playerExperience(changed),error=>error.status===400);
        const before=snapshot();assert.equal((await save(changed)).status,400);assert.equal(snapshot(),before);
      }
      app.store.db.prepare('UPDATE hard_currency_consume SET sp_minimum=sp_minimum-1 WHERE operation_id=?').run(operation.id);
      await rejected(action,{consumeId:81041001},503);await rejected('user_data/confirm',undefined,503);
      app.store.db.prepare('UPDATE hard_currency_consume SET sp_minimum=? WHERE operation_id=?').run(receipt.sp_minimum,operation.id);
      app.store.db.prepare('UPDATE hard_currency_consume SET sp_capacity=sp_capacity+1 WHERE operation_id=?').run(operation.id);
      await rejected(action,{consumeId:81041001},503);await rejected('user_data/confirm',undefined,503);
      app.store.db.prepare('UPDATE hard_currency_consume SET sp_capacity=? WHERE operation_id=?')
        .run(receipt.sp_capacity,operation.id);
      app.store.db.prepare('UPDATE hard_currency_consume SET sp_level=sp_level+1 WHERE operation_id=?').run(operation.id);
      await rejected(action,{consumeId:81041001},503);await rejected('user_data/confirm',undefined,503);
      app.store.db.prepare('UPDATE hard_currency_consume SET sp_level=? WHERE operation_id=?').run(receipt.sp_level,operation.id);
      const changedStock=structuredClone(rows);changedStock[0].playerStatus.baseSP=stock+1;putInfo(changedStock);
      await rejected(action,{consumeId:81041001},503);await rejected('user_data/confirm',undefined,503);
      await rejected('user/login',undefined,503);await rejected('user_data/pull',{tables:['UserInfo']},503);putInfo(rows);
      if(receipt.sp_minimum!==0x7fffffff) {
        const other=Number(Object.keys(master.playerMaxSP).find(value=>master.playerMaxSP[value]!==master.playerMaxSP[level])),
          changedLevel=structuredClone(rows);
        Object.assign(changedLevel[0].playerStatus,{level:other,totalExp:master.playerLevels.find(([value])=>value===other)[1]});
        putInfo(changedLevel);await rejected(action,{consumeId:81041001},503);await rejected('user_data/confirm',undefined,503);putInfo(rows);
      }
      await close();await open({...master,playerMaxSP:{}});await rejected('user_data/confirm',undefined,503);
      await close();await open();
      assert.deepEqual(app.store.operations(),queue);assert.deepEqual(app.store.fixedConsumeReceipt(operation),receipt);
      assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
      assert.deepEqual((await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm')).body,cold.body);
      await settle(operation);assert.ok(!app.store.operations().some(row=>row.id===operation.id));
      assert.equal(app.store.read('UserInfo').data[0].playerStatus.baseSP,receipt.sp_minimum);
    }
    //Exact native timer alternatives, not a minimum/higher arbitrary stock.
    const expired=structuredClone(seed.data.UserInfo);
    expired[0].playerStatus.pvpSP=1;expired[0].playerStatus.pvpSPUpdatedAt=at-3607;putInfo(expired);
    const pullSequence=sequence+1,pullBody={tables:['UserInfo']};
    const beforePull=await send('user_data/pull',pullBody);assert.equal(beforePull.status,200);
    const refillBody={consumeId:81051001},issued=parse(await send(action,refillBody)).operation,issuedSequence=sequence;
    const captured=app.store.db.prepare('SELECT * FROM hard_currency_consume WHERE operation_id=?').get(issued.id);
    assert.equal(captured.pvp_issued_at,at);assert.equal(captured.sp_before,1);assert.equal(captured.sp_minimum,6);
    assert.deepEqual(JSON.parse(captured.pvp_baseline),{pvpSP:1,pvpSPUpdatedAt:at-3607});
    assert.deepEqual(app.store.read('UserInfo').data,expired);
    await rejected('user_data/pull',pullBody,503);
    assert.equal((await request(port,pullSequence,pullBody,String(pullSequence),'user_data/pull')).status,503);
    for(const [stock,timestamp] of [[9,at-3607],[8,at],[6,at-7],[8,at-6]]) {
      const invalid=structuredClone(expired);invalid[0].playerStatus.pvpSP=stock;invalid[0].playerStatus.pvpSPUpdatedAt=timestamp;
      const before=snapshot();assert.equal((await save(invalid,[issued])).status,400);assert.equal(snapshot(),before);
    }
    for(const [column,bad] of [['pvp_baseline',null],['pvp_baseline','{}'],['pvp_baseline','{'],['pvp_issued_at',-1],['sp_minimum',7]]) {
      app.store.db.prepare(`UPDATE hard_currency_consume SET ${column}=? WHERE operation_id=?`).run(bad,issued.id);
      await rejected(action,refillBody,503);
      app.store.db.prepare(`UPDATE hard_currency_consume SET ${column}=? WHERE operation_id=?`).run(captured[column],issued.id);
    }
    wallNow+=1800;
    await rejected(action,refillBody,503);await rejected('user_data/confirm',undefined,503);
    assert.equal((await request(port,issuedSequence,refillBody,String(issuedSequence),action)).status,503);
    await close();await open();await rejected(action,refillBody,503);
    wallNow=at-1;await rejected(action,refillBody,503);wallNow=at;
    const natural=structuredClone(expired);natural[0].playerStatus.pvpSP=3;natural[0].playerStatus.pvpSPUpdatedAt=at-7;
    parse(await save(natural));
    assert.equal(app.store.db.prepare('SELECT effect_saved FROM hard_currency_consume WHERE operation_id=?').get(issued.id).effect_saved,0);
    assert.equal(parse(await send(action,refillBody)).operation.id,issued.id);
    const recovered=structuredClone(natural);recovered[0].playerStatus.pvpSP=8;
    for(const [table,event,label] of [['profile','UPDATE','pvp_profile'],['hard_currency_consume','UPDATE','pvp_effect'],
      ['operation_done','INSERT','pvp_ack'],['reply_cache','INSERT','pvp_reply']]) {
      app.store.db.exec(`CREATE TRIGGER fail_${label} BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'pvp save rollback'); END`);
      const before=snapshot();assert.equal((await save(recovered,[issued])).status,503);assert.equal(snapshot(),before);
      app.store.db.exec(`DROP TRIGGER fail_${label}`);
    }
    const savedRefill=parse(await save(recovered));
    assert.ok(!savedRefill.operations.some(row=>row.id===issued.id));assert.equal(savedRefill.operation,undefined);
    await close();await open();
    await rejected(action,refillBody,503);await rejected('user_data/confirm',undefined,503);
    const spent=structuredClone(recovered);spent[0].playerStatus.pvpSP=2;
    parse(await save(spent));parse(await save(null,[issued]));
    assert.equal((await request(port,pullSequence,pullBody,String(pullSequence),'user_data/pull')).status,503,
      'Settled refill/spending cannot replay the old native resource profile');
    //Raw alternative preserves the exact old timestamp; it is not new regen.
    putInfo(expired);
    const raw=parse(await send(action,refillBody)).operation,rawSave=structuredClone(expired);
    rawSave[0].playerStatus.pvpSP=6;parse(await save(rawSave,[raw]));
    for(const [field,bad] of [['pvpSP',-1],['pvpSPUpdatedAt',-1],['pvpSPUpdatedAt',null]]) {
      const rows=structuredClone(expired);rows[0].playerStatus[field]=bad;putInfo(rows);
      await rejected(action,refillBody,400);
    }
    putInfo(expired);
    const retained=parse(await send(action,refillBody)).operation;
    app.store.db.prepare('UPDATE hard_currency_consume SET pvp_issued_at=NULL,pvp_baseline=NULL WHERE operation_id=?').run(retained.id);
    await rejected(action,refillBody,503);
    const beforeLegacy=snapshot();assert.equal((await save(null,[retained])).status,503);assert.equal(snapshot(),beforeLegacy);
    assert.ok(app.store.operations().some(row=>row.id===retained.id),'Missing capture stays queued, never backfilled');
    app.store.db.prepare('UPDATE hard_currency_consume SET pvp_issued_at=?,pvp_baseline=? WHERE operation_id=?')
      .run(at,JSON.stringify({pvpSP:1,pvpSPUpdatedAt:at-3607}),retained.id);
    await settle(retained);
    //Record Buster resets to at least5 first, then its purchase adds5/caps10.
    //A live reset may precede issue without a save, or happen in the callback.
    const pvbExpired=structuredClone(seed.data.UserInfo);
    pvbExpired[0].playerStatus.pvbSP=1;pvbExpired[0].playerStatus.pvbSPLastResetAt=midnight-1;putInfo(pvbExpired);
    const pvbPullSequence=sequence+1,pvbPull=await send('user_data/pull',pullBody);assert.equal(pvbPull.status,200);
    const pvbBody={consumeId:81061001},pvbIssued=parse(await send(action,pvbBody)).operation,pvbSequence=sequence;
    const pvbCaptured=app.store.db.prepare('SELECT * FROM hard_currency_consume WHERE operation_id=?').get(pvbIssued.id);
    assert.equal(pvbCaptured.pvb_issued_at,at);assert.equal(pvbCaptured.sp_before,5);assert.equal(pvbCaptured.sp_minimum,10);
    assert.equal(pvbCaptured.pvp_issued_at,null);assert.equal(pvbCaptured.pvp_baseline,null);
    assert.deepEqual(JSON.parse(pvbCaptured.pvb_baseline),{pvbSP:1,pvbSPLastResetAt:midnight-1});
    assert.deepEqual(app.store.read('UserInfo').data,pvbExpired,'Neither daily reset nor refill is precredited');
    const pvbWallet=[app.store.hardCurrency(),app.store.paidCurrency()];
    await rejected('user_data/pull',pullBody,503);
    assert.equal((await request(port,pvbPullSequence,pullBody,String(pvbPullSequence),'user_data/pull')).status,503);
    for(const [stock,timestamp] of [[9,at],[10,midnight-1],[10,at+1],[6,at],[5,midnight-1]]) {
      const invalid=structuredClone(pvbExpired);invalid[0].playerStatus.pvbSP=stock;invalid[0].playerStatus.pvbSPLastResetAt=timestamp;
      const before=snapshot();assert.equal((await save(invalid,[pvbIssued])).status,400);assert.equal(snapshot(),before);
    }
    for(const [column,bad] of [['pvb_baseline',null],['pvb_baseline','{}'],['pvb_baseline','{'],
      ['pvb_baseline','{"pvbSP":1,"pvbSPUpdatedAt":0}'],['pvb_issued_at',-1],['sp_before',1],['sp_minimum',6]]) {
      app.store.db.prepare(`UPDATE hard_currency_consume SET ${column}=? WHERE operation_id=?`).run(bad,pvbIssued.id);
      await rejected(action,pvbBody,503);
      app.store.db.prepare(`UPDATE hard_currency_consume SET ${column}=? WHERE operation_id=?`).run(pvbCaptured[column],pvbIssued.id);
    }
    wallNow=at+86400;await rejected(action,pvbBody,503);await close();await open();await rejected(action,pvbBody,503);
    wallNow=at-1;await rejected(action,pvbBody,503);wallNow=at;
    const pvbNatural=structuredClone(pvbExpired);pvbNatural[0].playerStatus.pvbSP=5;pvbNatural[0].playerStatus.pvbSPLastResetAt=at-3;
    let pvbBefore=snapshot();assert.equal((await save(pvbNatural,[pvbIssued])).status,400);assert.equal(snapshot(),pvbBefore);
    parse(await save(pvbNatural));
    assert.equal(app.store.db.prepare('SELECT effect_saved FROM hard_currency_consume WHERE operation_id=?').get(pvbIssued.id).effect_saved,0);
    assert.equal(parse(await send(action,pvbBody)).operation.id,pvbIssued.id);
    const pvbRecovered=structuredClone(pvbNatural);pvbRecovered[0].playerStatus.pvbSP=10;
    const changedReset=structuredClone(pvbRecovered);changedReset[0].playerStatus.pvbSPLastResetAt=at;
    pvbBefore=snapshot();assert.equal((await save(changedReset,[pvbIssued])).status,400);assert.equal(snapshot(),pvbBefore);
    for(const [table,event,label] of [['profile','UPDATE','pvb_profile'],['hard_currency_consume','UPDATE','pvb_effect'],
      ['operation_done','INSERT','pvb_ack'],['operation_queue','DELETE','pvb_queue'],['reply_cache','INSERT','pvb_reply']]) {
      app.store.db.exec(`CREATE TRIGGER fail_${label} BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'pvb save rollback'); END`);
      const before=snapshot();assert.equal((await save(pvbRecovered,[pvbIssued])).status,503);assert.equal(snapshot(),before);
      app.store.db.exec(`DROP TRIGGER fail_${label}`);
    }
    const pvbSaved=parse(await save(pvbRecovered));assert(!pvbSaved.operations.some(op=>op.id===pvbIssued.id));assert.equal(pvbSaved.operation,undefined);
    await close();await open();await rejected(action,pvbBody,503);await rejected('user_data/confirm',undefined,503);
    assert.equal((await request(port,pvbSequence,pvbBody,String(pvbSequence),action)).status,503);
    const pvbSpent=structuredClone(pvbRecovered);pvbSpent[0].playerStatus.pvbSP=2;
    parse(await save(pvbSpent));parse(await save(null,[pvbIssued]));
    assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],pvbWallet);
    assert.equal((await request(port,pvbPullSequence,pullBody,String(pvbPullSequence),'user_data/pull')).status,503);
    putInfo(pvbExpired);
    const pvbDelayed=parse(await send(action,pvbBody)).operation;wallNow=at+7;
    const delayedSave=structuredClone(pvbExpired);delayedSave[0].playerStatus.pvbSP=10;delayedSave[0].playerStatus.pvbSPLastResetAt=wallNow;
    parse(await save(delayedSave,[pvbDelayed]));wallNow=at;
    putInfo(pvbNatural);
    const pvbSameDay=parse(await send(action,pvbBody)).operation;await settle(pvbSameDay);
    assert.equal(app.store.read('UserInfo').data[0].playerStatus.pvbSPLastResetAt,at-3,'Same-day refill preserves the real reset time');
    putInfo(pvbExpired);
    const pvbLegacy=parse(await send(action,pvbBody)).operation;
    app.store.db.prepare('UPDATE hard_currency_consume SET pvb_issued_at=NULL,pvb_baseline=NULL WHERE operation_id=?').run(pvbLegacy.id);
    await rejected(action,pvbBody,503);pvbBefore=snapshot();assert.equal((await save(null,[pvbLegacy])).status,503);assert.equal(snapshot(),pvbBefore);
    assert(app.store.operations().some(op=>op.id===pvbLegacy.id),'Legacy refill stays queued without invented reset history');
    app.store.db.prepare('UPDATE hard_currency_consume SET pvb_issued_at=?,pvb_baseline=? WHERE operation_id=?')
      .run(at,JSON.stringify({pvbSP:1,pvbSPLastResetAt:midnight-1}),pvbLegacy.id);await settle(pvbLegacy);
    // Authored level maximum and native int32/PvP/PvB saturation boundaries.
    for (const [consumeId,field,start,target,level] of [
      [81041001,'baseSP',0,master.playerMaxSP[999],999],
      [81041001,'baseSP',0x7fffffff-7,0x7fffffff,1],
      [81051001,'pvpSP',14,15,1],[81061001,'pvbSP',9,10,1],
    ]) {
      const rows = structuredClone(seed.data.UserInfo); rows[0].playerStatus[field] = start;
      Object.assign(rows[0].playerStatus,{level,totalExp:master.playerLevels.find(([value])=>value===level)[1]});putInfo(rows);
      const op = parse(await send(action,{consumeId})).operation,
        boundaryReceipt=app.store.db.prepare('SELECT sp_minimum,sp_level,sp_capacity FROM hard_currency_consume WHERE operation_id=?').get(op.id);
      assert.equal(boundaryReceipt.sp_minimum,target);
      assert.equal(boundaryReceipt.sp_level,consumeId===81041001?level:null);
      assert.equal(boundaryReceipt.sp_capacity,consumeId===81041001?master.playerMaxSP[level]:null);
      await settle(op); if (field !== 'baseSP') await rejected(action,{consumeId},400);
    }
    putInfo(structuredClone(seed.data.UserInfo));
    for (const rows of [[],[{...seed.data.UserInfo[0],userId:9}],seed.data.UserInfo.concat(seed.data.UserInfo)]) {
      putInfo(rows); await rejected(action,{consumeId:81041001},503);
    }
    const malformed = structuredClone(seed.data.UserInfo); malformed[0].playerStatus.baseSP = -1; putInfo(malformed);
    await rejected(action,{consumeId:81041001},503); putInfo(structuredClone(seed.data.UserInfo));
    await rejected(action,{consumeId:81041001,extra:true},400);
    await rejected(action,{consumeId:81031001},503);
    // WRITTEN ONLY / NOT RUN: raw25db368 exists but has no final-image caller,
    // relocation or literal pointer; reject its fabricated shape without debit.
    await rejected(action,{consumeId:81011001,detailId:1},503);
    // Every mutation stage must roll back its wallet, receipt, queue and reply.
    for (const [table,label] of [['operation_queue','queue'],['hard_currency_consume','receipt'],
      ['hard_currency_consume_request','identity'],['reply_cache','reply']]) {
      app.store.db.exec(`CREATE TRIGGER fail_consume_${label} BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'consume rollback'); END`);
      await rejected(action,{consumeId:81041001},503,false); app.store.db.exec(`DROP TRIGGER fail_consume_${label}`);
    }
    app.store.db.exec("CREATE TRIGGER fail_consume_wallet BEFORE UPDATE ON hard_currency BEGIN SELECT RAISE(ABORT,'wallet rollback'); END");
    await rejected(action,{consumeId:81041001},503,false); app.store.db.exec('DROP TRIGGER fail_consume_wallet');
    const op = parse(await send(action,{consumeId:81041001})).operation;
    const receipt = app.store.db.prepare('SELECT * FROM hard_currency_consume WHERE operation_id=?').get(op.id);
    const saved = structuredClone(seed.data.UserInfo); saved[0].playerStatus.baseSP = receipt.sp_minimum;
    for (const [table,event,label] of [['hard_currency_consume','UPDATE','effect'],['operation_done','INSERT','ack'],['reply_cache','INSERT','save_reply']]) {
      app.store.db.exec(`CREATE TRIGGER fail_consume_${label} BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'save rollback'); END`);
      const before = snapshot(); assert.equal((await save(saved,[op])).status,503); assert.equal(snapshot(),before);
      app.store.db.exec(`DROP TRIGGER fail_consume_${label}`);
    }
    parse(await save(saved,[op]));
    app.store.changeHardCurrency(-app.store.hardCurrency()); app.store.changePaidCurrency(-app.store.paidCurrency());
    await rejected(action,{consumeId:81041001},400);
    const legacy = app.store.issueOperation(10200,{});
    await rejected(action,{consumeId:81041001},503);
    const before = snapshot(); assert.equal((await save(null,[legacy])).status,503); assert.equal(snapshot(),before);
    assert.ok(app.store.operations().some(row => row.id === legacy.id),'Unknown legacy receipt is preserved, not dropped or guessed');
    console.log('Stamina consume cost/identity/save checks passed; native acceptance still required');
  } finally {
    await close(); fs.rmSync(directory,{recursive:true,force:true});
  }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { main };
