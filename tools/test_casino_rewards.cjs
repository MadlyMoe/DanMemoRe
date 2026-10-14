'use strict';

// Synthetic eligibility and native-shaped deltas exercise receipt/save ordering,
// not natural mission unlocks, native grant application or publisher gifts.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE, encodeMsgpack } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
const cap = 99999999999;

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-casino-rewards-'));
  const realNow = Date.now;
  let database, app, port, sequence = 0, now = 1;
  Date.now = () => now * 1000;
  const open = async () => {
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const fresh = async name => { await close(); database = path.join(directory, `${name}.sqlite`); await open(); };
  const send = (action, value) => request(port, ++sequence, value, String(sequence), action);
  const parse = reply => { assert.equal(reply.status, 200, reply.body.toString()); return JSON.parse(reply.body); };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows), md5(rows), name);
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name, app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all()]));
  const reject = async (promise,status=503,raw=false) => {
    const before=snapshot(),reply=await promise;assert.equal(reply.status,status,reply.body.toString());assert.equal(snapshot(),before);
    if(status===503) {if(raw) assert.equal(reply.body.length,0);else assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);}
  };
  const push = (putItems = {}, operations = [], deleteItems = {}) => send('user_data/push', {
    badges: null, scripts: {}, dataTokens: {}, checksums: { before: {}, after: Object.fromEntries(
      [...new Set([...Object.keys(putItems), ...Object.keys(deleteItems)])].map(name => [name, md5(putItems[name] ?? [])])) },
    deltas: Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature: 0, trigger: 'Achievement', putItems, deleteItems }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })),
  });
  const claim = row => send('achievement/complete', { achievementIds: [{ achievementId: row.achievementId, completedAt: row.completedAt }] });
  const receive = gifts => send('gift/receive', { userId: seed.userId, giftIds: gifts.map(row => row.id) });
  const claimRow = id => ({ userId: seed.userId, achievementId: Number(id), completedAt: now,
    lastResetAt: 0, progressParam: 1, readState: 1, signature: 0, state: 3 });
  const casino = (cumulative, amount = 0) => ({ ...seed.data.UserCasinoState[0], cumulativeMedalAmount: cumulative, medalAmount: amount });
  const restoreReceipt = receipt => app.store.db.prepare(`INSERT INTO casino_reward_claim
    (operation_id,amount,cumulative_amount,before_stock,cap_version) VALUES(?,?,?,?,?)`)
    .run(receipt.operation_id,receipt.amount,receipt.cumulative_amount,receipt.before_stock,receipt.cap_version);
  const gift = (id, itemId, amount) => ({ userId: seed.userId, id, itemId, amount,
    title: 'Synthetic offline receipt check', message: '', senderType: 1, senderId: 0, giftAcquiredType: 2,
    itemLevel: 0, equipmentId: 0, equipmentEvolveCount: 0, pcLimitBreakCount: 0, pcHeroSublimateCount: 0,
    state: 0, startAt: now, expireAt: now + 1000, createdAt: now, dynamodbExpireAt: 0 });
  try {
    const missions = Object.entries(master.achievements).filter(([, row]) => row.rewardType === 23);
    assert.equal(missions.length, 2);
    for (const [id, original] of missions) {
      now = original.startAt; await fresh(`mission-${id}`);
      const row = claimRow(id), baseline = casino(1000, 123);
      put('UserAchievement', [row]); put('UserCasinoState', [baseline]);
      for (const changes of [{ userId: 2 }, { medalAmount: -1 }, { medalAmount: '123' }, { medalAmount: cap + 1 },
        { cumulativeMedalAmount: -1 }, { cumulativeMedalAmount: '1000' }, { cumulativeMedalAmount: cap + 1 },
        { signature: -1 }, { signature: '0' }, { signature: 0x100000000 }]) {
        put('UserCasinoState', [{ ...baseline, ...changes }]); const before = snapshot();
        assert.equal((await claim(row)).status, 400); assert.equal(snapshot(), before);
      }
      put('UserCasinoState', [baseline, baseline]);
      const duplicates = snapshot(); assert.equal((await claim(row)).status, 400); assert.equal(snapshot(), duplicates);
      put('UserCasinoState', [baseline]);
      for (const table of ['operation_queue','casino_reward_claim','achievement_claim','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_reward BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'casino receipt rollback'); END`);
        const before = snapshot(); assert.equal((await claim(row)).status, 503); assert.equal(snapshot(), before);
        app.store.db.exec('DROP TRIGGER fail_reward');
      }
      const response = await claim(row), identity = sequence, result = parse(response), operation = result.operations[0];
      assert.equal(result.issueCasinoMedal, original.rewardAmount);
      assert.deepEqual(result.receivedItems, []);
      assert.deepEqual(app.store.read('UserCasinoState').data, [baseline], 'Only the native operation credits medals');
      const receipt = app.store.db.prepare('SELECT * FROM casino_reward_claim WHERE operation_id=?').get(operation.id);
      assert.equal(receipt.amount, original.rewardAmount); assert.equal(receipt.cumulative_amount, 1000 + original.rewardAmount);
      assert.equal(receipt.cap_version,1); assert.notEqual(operation.signature,baseline.signature);
      assert.deepEqual(JSON.parse(receipt.before_stock),{policy:'offline-mission-casino-stock-v1',beforeAmount:123,
        beforeCumulative:1000,beforeSignature:baseline.signature,amount:123+original.rewardAmount,signature:operation.signature,
        amountAdded:0,observed:false,effect:false});
      const beforeFlags = snapshot(); assert.equal((await push({}, [operation])).status, 400); assert.equal(snapshot(), beforeFlags);
      const received = { ...row, state: 4 };
      parse(await push({ UserAchievement: [received] }));
      assert.equal((await push({}, [operation])).status, 400, 'A mission flag cannot replace medal acquisition');
      await close(); await open();
      const interrupted = snapshot();
      for (const retry of [await claim(row), await request(port, identity,
        { achievementIds: [{ achievementId: row.achievementId, completedAt: row.completedAt }] },String(identity),'achievement/complete')]) {
        assert.equal(retry.status,503); assert.equal(JSON.parse(retry.body).code,OFFLINE_UNAVAILABLE_CODE); assert.equal(snapshot(),interrupted);
      }
      const pendingExpected={...operation,parameters:{...operation.parameters,UserAchievement:[]}};
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[pendingExpected]);parse(await send('user/login'));
      assert.equal((await send('user_data/pull',{tables:['UserAchievement','UserCasinoState']})).status,200);
      assert.deepEqual(app.store.operations(),[operation]);assert.deepEqual(app.store.read('UserCasinoState').data,[baseline]);
      for (const changes of [{ userId: 2 }, { cumulativeMedalAmount: receipt.cumulative_amount - 1 },
        { cumulativeMedalAmount: '1100' }, { medalAmount: -1 }, { medalAmount: cap + 1 }]) {
        const before = snapshot(); assert.equal((await push({ UserCasinoState: [{ ...casino(receipt.cumulative_amount), ...changes }] }, [operation])).status, 400);
        assert.equal(snapshot(), before);
      }
      const ordinary = snapshot();
      assert.equal((await push({ UserCurrency: [{ userId: seed.userId, currencyId: master.currencies['currency.casino_medal'],
        amount: original.rewardAmount, cumulativeAmount: receipt.cumulative_amount }] }, [operation])).status, 400);
      assert.equal(snapshot(), ordinary, 'A fabricated ordinary currency row is not the native casino singleton');
      parse(await push({ UserCasinoState: [{ ...casino(receipt.cumulative_amount, 123 + original.rewardAmount), signature: operation.signature }] }));
      parse(await push({ UserCasinoState: [casino(receipt.cumulative_amount)] })); // Spent before ACK is legitimate.
      await close(); await open();
      const expected={...operation,parameters:{...operation.parameters,UserAchievement:[],issueCasinoMedal:0}},
        native=structuredClone(app.store.read('UserCasinoState').data);
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[expected]);parse(await send('user/login'));
      assert.equal((await send('user_data/pull',{tables:['UserAchievement','UserCasinoState']})).status,200);
      assert.deepEqual(app.store.operations(),[operation]);assert.deepEqual(app.store.read('UserCasinoState').data,native);
      app.store.db.exec("CREATE TRIGGER fail_ack BEFORE DELETE ON operation_queue BEGIN SELECT RAISE(ABORT,'casino ACK rollback'); END");
      const beforeAck = snapshot(); assert.equal((await push({}, [operation])).status, 503); assert.equal(snapshot(), beforeAck);
      app.store.db.exec('DROP TRIGGER fail_ack');
      const savedReceipt=app.store.casinoRewardReceipt(operation);
      app.store.db.prepare('DELETE FROM casino_reward_claim WHERE operation_id=?').run(operation.id);
      const unknown = snapshot(), missing = await push({}, [operation]);
      assert.equal(missing.status, 503); assert.equal(JSON.parse(missing.body).code, OFFLINE_UNAVAILABLE_CODE);
      assert.equal(snapshot(), unknown, 'A legacy baseline is never guessed from a post-award balance');
      restoreReceipt(savedReceipt);
      parse(await push({}, [operation])); await close(); await open();
      const settled = snapshot(); assert.equal((await push({ UserCasinoState: [baseline] })).status, 400);
      assert.equal((await push({}, [], { UserCasinoState: [{ userId: seed.userId }] })).status, 400); assert.equal(snapshot(), settled);
      parse(await push({ UserCasinoState: [casino(receipt.cumulative_amount, 1)] }));
      app.store.db.exec('DELETE FROM reply_cache'); await close(); await open();
      assert.equal((await claim(row)).status, 400);
      assert.deepEqual(app.store.operations(), []);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM casino_reward_claim').get().n, 1);
      assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    }

    //432 WRITTEN ONLY cases: 288 earlier observed plus144 pending casino cases.
    // Both authored casino missions, mixed original
    // ticket1/Hero2/SP50/Iris10, three flag subsets/all four item subsets/three
    // SP states/pending-saved-spent medals/two cap baselines.216 queue original10200.
    // Requires the SOURCE ONLY zero-casino ARM64 adapter, not built/installed.
    for(const [id,original] of missions) for(const stock of [7,0x7fffffff-7])
      for(const flags of [0,17,31]) for(let items=0;items<4;items++)
        for(const spState of ['pending','saved','spent']) for(const casinoState of ['pending','saved','spent']) {
          now=original.startAt;await fresh(`casino-cold-${id}-${stock}-${flags}-${items}-${spState}-${casinoState}`);
          const rows=[6020000100,6020010401,6010000001,6020000001,Number(id)].map(claimRow),
            body={achievementIds:rows.map(({achievementId,completedAt})=>({achievementId,completedAt}))},
            info=structuredClone(seed.data.UserInfo),
            beforeCasino={...casino(stock===7?1000:cap-original.rewardAmount,stock===7?123:cap-7),signature:0x7fffffff},
            ticket={userId:seed.userId,gachaTicketId:296000003,bookEntryState:-128,signature:0xffffffff,cumulativeAmount:999999998,
              dateList:[{aquiredAt:now-master.lotteryTickets[296000003]-1},{aquiredAt:now-1}]},
            hero={userId:seed.userId,heroSublimateItemId:99000001,bookEntryState:3,signature:0x7fffffff,
              cumulativeAmount:999999998,amount:7,reservedAmount:0};
          info[0].playerStatus.baseSP=stock;put('UserInfo',info);put('UserAchievement',rows);put('UserCasinoState',[beforeCasino]);
          put('UserGachaTicket',[ticket]);put('UserHeroSublimateItem',[hero]);
          const walletBefore=app.store.hardCurrency();app.store.changeHardCurrency(100);
          const issued=await send('achievement/complete',body),identity=sequence,operation=parse(issued).operation,
            receipt=app.store.casinoRewardReceipt(operation),stamina=app.store.staminaReward(operation),
            acquiredTicket={...ticket,cumulativeAmount:999999999,signature:operation.signature,dateList:[{aquiredAt:now-1},{aquiredAt:now}]},
            acquiredHero={...hero,cumulativeAmount:999999999,signature:operation.signature,amount:9},
            acquiredCasino={...beforeCasino,cumulativeMedalAmount:receipt.cumulative_amount,
              medalAmount:Math.min(cap,beforeCasino.medalAmount+original.rewardAmount),signature:operation.signature};
          assert.equal(operation.parameters.issueCasinoMedal,original.rewardAmount);assert.equal(operation.parameters.issueStamina,50);
          assert.equal(operation.parameters.issueAmount,10);assert.equal(app.store.hardCurrency(),walletBefore+110);
          assert.equal(receipt.cumulative_amount,beforeCasino.cumulativeMedalAmount+original.rewardAmount);
          assert.deepEqual(operation.parameters.receivedItems,[{itemId:296000003,amount:1},{itemId:99000001,amount:2}]);
          assert.deepEqual(app.store.read('UserCasinoState').data,[beforeCasino],'Issuance must not precredit the native casino');
          assert.equal(receipt.cap_version,1);assert.notEqual(operation.signature,beforeCasino.signature);
          if(casinoState!=='pending') parse(await push({UserCasinoState:[acquiredCasino]}));
          if(casinoState==='spent') parse(await push({UserCasinoState:[{...acquiredCasino,medalAmount:0,
            signature:(operation.signature+1)>>>0}]})); // Later native activity must not have its signature rewound by zero recovery.
          if(flags) parse(await push({UserAchievement:rows.map((row,index)=>({...row,state:flags&(1<<index)?4:3}))}));
          if(items&1) parse(await push({UserGachaTicket:[acquiredTicket]}));
          if(items&2) parse(await push({UserHeroSublimateItem:[acquiredHero]}));
          if(spState!=='pending') {
            const native=structuredClone(info);native[0].playerStatus.baseSP=stamina.sp_minimum;parse(await push({UserInfo:native}));
            if(spState==='spent') {native[0].playerStatus.baseSP=9;parse(await push({UserInfo:native}));}
          }
          if(flags || items || spState!=='pending' || casinoState!=='pending') {
            await reject(send('achievement/complete',body));await reject(request(port,identity,body,String(identity),'achievement/complete'));
          } else {
            assert.deepEqual(parse(await send('achievement/complete',body)).operation,operation);
            assert.deepEqual((await request(port,identity,body,String(identity),'achievement/complete')).body,issued.body);
          }
          if(flags!==31 || items!==3 || spState==='pending' || casinoState==='pending') await reject(push({},[operation]),400);
          let refill;if(stock===7) refill=parse(await send('currency/hard/consume',{consumeId:81041001})).operation;
          const expected={...operation,parameters:{...operation.parameters,issueCasinoMedal:casinoState==='pending'?original.rewardAmount:0,issueStamina:spState==='pending'?50:0,
            UserAchievement:rows.filter((row,index)=>!(flags&(1<<index))),
            receivedItems:operation.parameters.receivedItems.filter((row,index)=>!(items&(1<<index)))}},
            queue=app.store.operations(),nativeProfiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
            source=app.store.achievementPcReceipt(operation).receipt,casinoReceipt=app.store.casinoRewardReceipt(operation),
            itemCaptures=app.store.db.prepare('SELECT * FROM achievement_item_claim WHERE operation_id=? ORDER BY item_id').all(operation.id),
            wallet=[app.store.hardCurrency(),app.store.paidCurrency()],tables=['UserAchievement','UserCasinoState','UserGachaTicket','UserHeroSublimateItem','UserInfo'];
          await close();await open();const cold=await send('user_data/confirm'),coldIdentity=sequence;
          assert.deepEqual(parse(cold).operations,refill?[expected,refill]:[expected]);assert.deepEqual(app.store.operations(),queue);
          assert.deepEqual(app.store.achievementPcReceipt(operation).receipt,source);assert.deepEqual(app.store.casinoRewardReceipt(operation),casinoReceipt);
          assert.deepEqual(app.store.db.prepare('SELECT * FROM achievement_item_claim WHERE operation_id=? ORDER BY item_id').all(operation.id),itemCaptures);
          assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),nativeProfiles);
          assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);parse(await send('user/login'));
          const pulled=await send('user_data/pull',{tables});assert.equal(pulled.status,200);assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull({tables})));
          await close();await open();assert.deepEqual((await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm')).body,cold.body);
          app.store.db.prepare('UPDATE casino_reward_claim SET amount=? WHERE operation_id=?').run(receipt.amount+1,operation.id);
          await reject(send('user_data/confirm'));await reject(send('user/login'));
          app.store.db.prepare('UPDATE casino_reward_claim SET amount=? WHERE operation_id=?').run(receipt.amount,operation.id);
          app.store.db.prepare('DELETE FROM casino_reward_claim WHERE operation_id=?').run(operation.id);
          await reject(send('user_data/confirm'));await reject(send('user_data/pull',{tables}));
          restoreReceipt(casinoReceipt);
          const completion={UserAchievement:rows.map(row=>({...row,state:4}))};
          if(!(items&1)) completion.UserGachaTicket=[acquiredTicket];if(!(items&2)) completion.UserHeroSublimateItem=[acquiredHero];
          if(spState==='pending') {const native=structuredClone(app.store.read('UserInfo').data);native[0].playerStatus.baseSP=stamina.sp_minimum;completion.UserInfo=native;}
          if(casinoState==='pending') {
            completion.UserCasinoState=[acquiredCasino];
            app.store.db.exec("CREATE TRIGGER fail_casino_capture BEFORE UPDATE ON casino_reward_claim BEGIN SELECT RAISE(ABORT,'casino capture rollback'); END");
            await reject(push(completion),503,true);app.store.db.exec('DROP TRIGGER fail_casino_capture');
          }
          const saved=parse(await push(completion));assert.ok(!saved.operations.some(row=>row.id===operation.id || row.id===refill?.id));
          if(flags!==31 || items!==3 || spState==='pending' || casinoState==='pending') await reject(request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm'));
          assert.deepEqual(app.store.read('UserCasinoState').data,[casinoState==='spent'?{...acquiredCasino,medalAmount:0,
            signature:(operation.signature+1)>>>0}:acquiredCasino]);
          for(const [table,event] of [['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
            app.store.db.exec(`CREATE TRIGGER fail_casino_cold_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'casino cold ACK rollback'); END`);
            await reject(push({},[expected]),503,true);app.store.db.exec('DROP TRIGGER fail_casino_cold_ack');
          }
          parse(await push({},[expected]));
          if(refill) {
            assert.deepEqual(parse(await send('user_data/confirm')).operations,[refill]);
            const native=structuredClone(app.store.read('UserInfo').data);native[0].playerStatus.baseSP=app.store.fixedConsumeReceipt(refill).sp_minimum;
            parse(await push({UserInfo:native},[refill]));
          }
          await close();await open();assert.deepEqual(app.store.operations(),[]);assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
          await reject(request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm'));
          await reject(send('achievement/complete',body));await reject(request(port,identity,body,String(identity),'achievement/complete'));
          await reject(push({UserAchievement:rows}),400);
          await reject(push({UserCasinoState:[beforeCasino]}),400);
        }

    //12 NEW WRITTEN ONLY fully saturated cumulative contexts: both authored
    // missions, three stock baselines and pending/saved claim flags. No native proof.
    for(const [id,original] of missions) for(const stock of [0,cap-7,cap]) for(const flags of [false,true]) {
      now=original.startAt;await fresh(`casino-full-cap-${id}-${stock}-${flags}`);
      const row=claimRow(id),before={...casino(cap,stock),signature:stock===0?0x7fffffff:0xffffffff};
      put('UserAchievement',[row]);put('UserCasinoState',[before]);
      const randomInt=crypto.randomInt;let operation;
      try {
        if(stock===0 && !flags) crypto.randomInt=()=>0x7fffffff;
        operation=parse(await claim(row)).operation;
      } finally {crypto.randomInt=randomInt;}
      assert.notEqual(operation.signature,before.signature);if(stock===0 && !flags) assert.equal(operation.signature,1);
      const receipt=app.store.casinoRewardReceipt(operation),capture=JSON.parse(receipt.before_stock),
        acquired={...before,medalAmount:Math.min(cap,stock+original.rewardAmount),signature:operation.signature};
      assert.equal(receipt.cumulative_amount,cap);assert.equal(receipt.cap_version,1);
      assert.equal(capture.amount,acquired.medalAmount);assert.equal(app.store.casinoRewardEffects(operation).observed,false);
      assert.deepEqual(app.store.read('UserCasinoState').data,[before]);
      if(flags) parse(await push({UserAchievement:[{...row,state:4}]}));
      await reject(push({UserAchievement:[{...row,state:4}]},[operation]),400);
      await close();await open();
      const pending={...operation,parameters:{...operation.parameters,UserAchievement:flags?[]:[row]}};
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[pending]);
      assert.equal(pending.parameters.issueCasinoMedal,original.rewardAmount);
      assert.deepEqual(app.store.read('UserCasinoState').data,[before]);
      app.store.db.exec("CREATE TRIGGER fail_full_cap_capture BEFORE UPDATE ON casino_reward_claim BEGIN SELECT RAISE(ABORT,'full cap observation rollback'); END");
      await reject(push({UserCasinoState:[acquired]}),503,true);app.store.db.exec('DROP TRIGGER fail_full_cap_capture');
      parse(await push({UserCasinoState:[acquired]}));
      assert.equal(app.store.casinoRewardEffects(operation).observed,true);
      const retained=app.store.casinoRewardReceipt(operation),state=JSON.parse(retained.before_stock);
      for(const bad of [null,'{broken',JSON.stringify({...state,beforeCumulative:cap-original.rewardAmount-1}),
        JSON.stringify({...state,beforeSignature:operation.signature}),JSON.stringify({...state,amountAdded:original.rewardAmount+1}),
        JSON.stringify({...state,effect:false})]) {
        app.store.db.prepare('UPDATE casino_reward_claim SET before_stock=? WHERE operation_id=?').run(bad,operation.id);
        await reject(send('user_data/confirm'));await reject(send('user/login'));
        app.store.db.prepare('UPDATE casino_reward_claim SET before_stock=? WHERE operation_id=?').run(retained.before_stock,operation.id);
      }
      app.store.db.prepare('UPDATE casino_reward_claim SET cap_version=0 WHERE operation_id=?').run(operation.id);
      await reject(send('user_data/confirm'));
      app.store.db.prepare('UPDATE casino_reward_claim SET cap_version=1 WHERE operation_id=?').run(operation.id);
      const spent={...acquired,medalAmount:0,signature:(operation.signature+1)>>>0};
      parse(await push({UserCasinoState:[spent]}));await close();await open();
      const observed={...pending,parameters:{...pending.parameters,issueCasinoMedal:0}};
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[observed]);
      assert.deepEqual(app.store.read('UserCasinoState').data,[spent]);
      parse(await push({UserAchievement:[{...row,state:4}]},[observed]));
      await close();await open();assert.deepEqual(app.store.operations(),[]);assert.deepEqual(app.store.read('UserCasinoState').data,[spent]);
    }

    //6 NEW WRITTEN ONLY incomplete gain contexts: stock, cumulative or signature
    // saved alone. Cold/hot recovery refuses without guessing a remaining gain.
    for(const [id,original] of missions) for(const part of ['stock','cumulative','signature']) {
      now=original.startAt;await fresh(`casino-partial-${id}-${part}`);
      const row=claimRow(id),before={...casino(1000,123),signature:0x7fffffff};
      put('UserAchievement',[row]);put('UserCasinoState',[before]);
      const operation=parse(await claim(row)).operation,receipt=app.store.casinoRewardReceipt(operation),
        partial={...before,...(part==='stock'?{medalAmount:124}:part==='cumulative'?{cumulativeMedalAmount:receipt.cumulative_amount}:
          {signature:operation.signature})};
      parse(await push({UserCasinoState:[partial]}));
      assert.equal(app.store.casinoRewardEffects(operation).effect,true);assert.equal(app.store.casinoRewardEffects(operation).observed,false);
      await reject(claim(row));await reject(push({},[operation]),400);await close();await open();
      for(const action of ['user/login','user_data/confirm']) await reject(send(action));
      await reject(send('user_data/pull',{tables:['UserCasinoState']}));
      parse(await push({UserCasinoState:[{...before,medalAmount:0,cumulativeMedalAmount:receipt.cumulative_amount,
        signature:operation.signature}],UserAchievement:[{...row,state:4}]},[operation]));
      await close();await open();assert.deepEqual(app.store.operations(),[]);
    }

    //2 NEW WRITTEN ONLY spending allowance contexts. Spending during a partial
    // grant does not replenish it; later observed casino play is independent.
    for(const [id,original] of missions) {
      now=original.startAt;await fresh(`casino-allowance-${id}`);
      const row=claimRow(id),before={...casino(1000,123),signature:0xffffffff};
      put('UserAchievement',[row]);put('UserCasinoState',[before]);
      const operation=parse(await claim(row)).operation,receipt=app.store.casinoRewardReceipt(operation);
      parse(await push({UserCasinoState:[{...before,medalAmount:124}]}));
      parse(await push({UserCasinoState:[{...before,medalAmount:0}]}));
      await reject(push({UserCasinoState:[{...before,medalAmount:original.rewardAmount}]}),400);
      parse(await push({UserCasinoState:[{...before,medalAmount:original.rewardAmount-1}]}));
      parse(await push({UserCasinoState:[{...before,medalAmount:0}]}));
      await reject(push({UserCasinoState:[{...before,medalAmount:1}]}),400);
      const acquired={...before,medalAmount:0,cumulativeMedalAmount:receipt.cumulative_amount,signature:operation.signature};
      // Simulate a lost observation in this disposable fixture; never infer proof from capped/native fields.
      const retained=app.store.read('UserCasinoState').data;put('UserCasinoState',[acquired]);
      await reject(send('user_data/confirm'));put('UserCasinoState',retained);
      parse(await push({UserCasinoState:[acquired]}));
      assert.equal(JSON.parse(app.store.casinoRewardReceipt(operation).before_stock).amountAdded,original.rewardAmount);
      parse(await push({UserCasinoState:[{...acquired,medalAmount:3,cumulativeMedalAmount:receipt.cumulative_amount+3,
        signature:(operation.signature+1)>>>0}]}));
      parse(await push({UserAchievement:[{...row,state:4}]},[operation]));
      await close();await open();assert.deepEqual(app.store.operations(),[]);
    }

    // Actual authored mission plus synthetic native-shaped presents reserve
    // distinct targets in either issue order, including a mixed Iris award.
    for (const missionFirst of [true, false]) {
      now = missions[0][1].startAt; await fresh(`overlap-${missionFirst}`);
      const row = claimRow(missions[0][0]), amount = missions[0][1].rewardAmount;
      const gifts = [gift(1, master.currencies['currency.casino_medal'], 900), gift(2, master.currencies['currency.gem'], 50)];
      put('UserAchievement', [row]); put('UserGift', gifts); put('UserCasinoState', [casino(1000, 123)]);
      let missionOp, giftOp;
      if (missionFirst) { missionOp = parse(await claim(row)).operations[0]; giftOp = parse(await receive(gifts)).operations[0]; }
      else { giftOp = parse(await receive(gifts)).operations[0]; missionOp = parse(await claim(row)).operations[0]; }
      const first = missionFirst ? missionOp : giftOp, second = missionFirst ? giftOp : missionOp;
      assert.equal(app.store.casinoRewardReceipt(giftOp).cap_version,Number(!missionFirst));
      if(missionFirst) assert.equal(app.store.casinoRewardReceipt(giftOp).before_stock,null);
      else assert.equal(JSON.parse(app.store.casinoRewardReceipt(giftOp).before_stock).policy,'offline-gift-casino-stock-v1');
      assert.equal(app.store.casinoRewardReceipt(missionOp).cap_version,Number(missionFirst));
      if(!missionFirst) assert.equal(app.store.casinoRewardReceipt(missionOp).before_stock,null);
      const partial = 1000 + (missionFirst ? amount : 900), final = 1000 + amount + 900;
      assert.equal(app.store.db.prepare('SELECT cumulative_amount FROM casino_reward_claim WHERE operation_id=?').get(first.id).cumulative_amount, partial);
      assert.equal(app.store.db.prepare('SELECT cumulative_amount FROM casino_reward_claim WHERE operation_id=?').get(second.id).cumulative_amount, final);
      assert.equal(app.store.hardCurrency(), 50); assert.equal(app.store.read('UserCasinoState').data[0].cumulativeMedalAmount, 1000);
      const gemTarget=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=? AND item_id=?')
        .get(giftOp.id,master.currencies['currency.gem']),currencyRows=app.store.read('UserCurrency').data,
        gem=currencyRows.find(row=>row.currencyId===gemTarget.item_id) ?? {userId:seed.userId,currencyId:gemTarget.item_id,
          amount:0,reservedAmount:0,bookEntryState:1,signature:0,cumulativeAmount:0};
      parse(await push({ UserAchievement: [{ ...row, state: 4 }], UserGift: gifts.map(row => ({ ...row, state: 1 })),
        UserCasinoState: [{...casino(partial),signature:first.signature}],
        UserCurrency:[...currencyRows.filter(row=>row.currencyId!==gemTarget.item_id),
          {...gem,bookEntryState:3,cumulativeAmount:gemTarget.cumulative_amount}] }));
      const before = snapshot(); assert.equal((await push({}, [first, second])).status, 400); assert.equal(snapshot(), before);
      parse(await push({}, [first])); await close(); await open();
      if(!missionFirst) await reject(send('user_data/confirm')); // Legacy overlapping mission still has no before-stock proof.
      assert.equal((await push({}, [second])).status, 400);
      parse(await push({ UserCasinoState: [casino(final)] }, [second]));
      await close(); await open(); assert.deepEqual(app.store.operations(), []);
      assert.equal(app.store.hardCurrency(), 50); assert.equal(app.store.read('UserCasinoState').data[0].medalAmount, 0);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM casino_reward_claim').get().n, 2);
    }

    // A saturated native lifetime still permits one captured Present; its
    // unchanged lifetime alone is not a saved effect or an early ACK.
    now = missions[0][1].startAt; await fresh('saturated-mixed-gift');
    const gifts = [gift(1, master.currencies['currency.gem'], 50), gift(2, master.currencies['currency.casino_medal'], 1000)];
    const beforeCasino={...casino(cap,cap-7),signature:0x7fffffff};
    put('UserGift', gifts); put('UserCasinoState', [beforeCasino]);
    const randomInt=crypto.randomInt;let operation;
    try {crypto.randomInt=()=>0x7fffffff;operation=parse(await receive(gifts)).operation;}
    finally {crypto.randomInt=randomInt;}
    assert.equal(operation.signature,1,'Present signature must avoid the original casino signature');
    const receipt=app.store.casinoRewardReceipt(operation);
    assert.equal(receipt.cap_version,1);assert.equal(receipt.cumulative_amount,cap);
    assert.equal(JSON.parse(receipt.before_stock).policy,'offline-gift-casino-stock-v1');
    assert.equal(app.store.hardCurrency(),50);assert.deepEqual(app.store.read('UserCasinoState').data,[beforeCasino]);
    await reject(push({},[operation]),400);
    const gemTarget=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=? AND item_id=?')
      .get(operation.id,master.currencies['currency.gem']),currencyRows=app.store.read('UserCurrency').data,
      gem=currencyRows.find(row=>row.currencyId===gemTarget.item_id) ?? {userId:seed.userId,currencyId:gemTarget.item_id,
        amount:0,reservedAmount:0,bookEntryState:1,signature:0,cumulativeAmount:0};
    parse(await push({UserCasinoState:[{...beforeCasino,signature:operation.signature}],
      UserGift:gifts.map(row=>({...row,state:1})),
      UserCurrency:[...currencyRows.filter(row=>row.currencyId!==gemTarget.item_id),
        {...gem,bookEntryState:3,cumulativeAmount:gemTarget.cumulative_amount}]}));
    assert.equal(app.store.casinoRewardEffects(operation).observed,false,
      'A signature alone cannot prove a stock gain when lifetime is already saturated');
    await reject(push({},[operation]),400);
    const acquired={...beforeCasino,medalAmount:cap,signature:operation.signature};
    parse(await push({UserCasinoState:[acquired]}));
    assert.equal(app.store.casinoRewardEffects(operation).observed,true);
    parse(await push({},[operation]));await close();await open();
    assert.deepEqual(app.store.operations(),[]);assert.equal(app.store.hardCurrency(),50);

    // WRITTEN ONLY: the native 2000 zero-medal adapter permits a cold reply
    // only after the captured medal effect is complete; flags remain separate.
    for(const saturated of [false,true]) {
      now=missions[0][1].startAt;await fresh(`casino-gift-cold-${saturated}`);
      const gifts=[gift(1,master.currencies['currency.casino_medal'],900)],
        before={...casino(saturated?cap:1000,saturated?cap-7:123),signature:0x7fffffff};
      put('UserGift',gifts);put('UserCasinoState',[before]);
      const operation=parse(await receive(gifts)).operation,receipt=app.store.casinoRewardReceipt(operation),
        acquired={...before,medalAmount:Math.min(cap,before.medalAmount+900),
          cumulativeMedalAmount:receipt.cumulative_amount,signature:operation.signature};
      assert.equal(receipt.cap_version,1);assert.deepEqual(app.store.read('UserCasinoState').data,[before]);
      parse(await push({UserGift:gifts.map(row=>({...row,state:1}))}));await close();await open();
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[operation]);
      parse(await push({UserCasinoState:[{...before,signature:operation.signature}]}));
      await reject(send('user_data/confirm'));
      parse(await push({UserCasinoState:[acquired]}));await close();await open();
      const derived={...operation,parameters:{...operation.parameters,issueCasinoMedal:0}};
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[derived]);
      assert.deepEqual(app.store.operations(),[operation],'Cold projection cannot acknowledge or rewrite the source operation');
      parse(await push({},[operation]));await close();await open();
      assert.deepEqual(app.store.operations(),[]);
    }
    for(const order of ['sp-first','casino-first']) {
      now=missions[0][1].startAt;await fresh(`casino-gift-sp-${order}`);
      const gifts=[gift(1,master.currencies['currency.casino_medal'],900),
        gift(2,master.currencies['currency.stamina'],13)],before={...casino(1000,123),signature:0x7fffffff};
      put('UserGift',gifts);put('UserCasinoState',[before]);
      const operation=parse(await receive(gifts)).operation,casinoReceipt=app.store.casinoRewardReceipt(operation),
        staminaReceipt=app.store.staminaReward(operation),sp=structuredClone(app.store.read('UserInfo').data),
        medal={...before,medalAmount:1900,cumulativeMedalAmount:casinoReceipt.cumulative_amount,
          signature:operation.signature};
      sp[0].playerStatus.baseSP=staminaReceipt.sp_minimum;
      parse(await push({UserGift:gifts.map(row=>({...row,state:1}))}));
      parse(await push(order==='sp-first'?{UserInfo:sp}:{UserCasinoState:[medal]}));
      await close();await open();
      const first={...operation,parameters:{...operation.parameters,
        receivedItems:order==='sp-first'?[]:operation.parameters.receivedItems,
        issueCasinoMedal:order==='casino-first'?0:900}};
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[first]);
      parse(await push(order==='sp-first'?{UserCasinoState:[medal]}:{UserInfo:sp}));
      const complete={...operation,parameters:{...operation.parameters,receivedItems:[],issueCasinoMedal:0}};
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[complete]);
      parse(await push({},[operation]));await close();await open();assert.deepEqual(app.store.operations(),[]);
    }
    // WRITTEN ONLY: v0 mission and Present receipts may omit an exact saved
    // medal gain only when the native row still carries that operation's signature.
    {
      const [id,original]=missions[0];now=original.startAt;await fresh('casino-legacy-exact-mission');
      const row=claimRow(id),before={...casino(1000,123),signature:0x7fffffff};
      put('UserAchievement',[row]);put('UserCasinoState',[before]);
      const operation=parse(await claim(row)).operation,receipt=app.store.casinoRewardReceipt(operation),
        foreign={...before,medalAmount:before.medalAmount+original.rewardAmount,
          cumulativeMedalAmount:receipt.cumulative_amount,signature:(operation.signature+1)>>>0};
      app.store.db.prepare('UPDATE casino_reward_claim SET before_stock=NULL,cap_version=0 WHERE operation_id=?').run(operation.id);
      put('UserCasinoState',[foreign]);
      assert.equal(app.store.casinoRewardEffects(operation).observed,true);
      assert.equal(app.store.casinoRewardEffects(operation).legacyExact,false);
      await reject(send('user_data/confirm'));
      const acquired={...foreign,signature:operation.signature};put('UserCasinoState',[acquired]);
      assert.equal(app.store.casinoRewardEffects(operation).legacyExact,true);
      const recovered={...operation,parameters:{...operation.parameters,issueCasinoMedal:0}};
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[recovered]);
      parse(await push({UserAchievement:[{...row,state:4}]},[recovered]));await close();await open();
      assert.deepEqual(app.store.operations(),[]);assert.deepEqual(app.store.read('UserCasinoState').data,[acquired]);
    }
    {
      now=missions[0][1].startAt;await fresh('casino-legacy-exact-gift');
      const gifts=[gift(910001,master.currencies['currency.casino_medal'],900)],
        before={...casino(1000,123),signature:0x7fffffff};
      put('UserGift',gifts);put('UserCasinoState',[before]);
      const operation=parse(await receive(gifts)).operation,receipt=app.store.casinoRewardReceipt(operation),
        foreign={...before,medalAmount:before.medalAmount+900,cumulativeMedalAmount:receipt.cumulative_amount,
          signature:(operation.signature+1)>>>0};
      app.store.db.prepare('UPDATE casino_reward_claim SET before_stock=NULL,cap_version=0 WHERE operation_id=?').run(operation.id);
      put('UserCasinoState',[foreign]);
      assert.equal(app.store.casinoRewardEffects(operation).observed,true);
      assert.equal(app.store.casinoRewardEffects(operation).legacyExact,false);
      await reject(send('user_data/confirm'));
      const acquired={...foreign,signature:operation.signature};put('UserCasinoState',[acquired]);
      assert.equal(app.store.casinoRewardEffects(operation).legacyExact,true);
      const recovered={...operation,parameters:{...operation.parameters,issueCasinoMedal:0}};
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[recovered]);
      parse(await push({UserGift:gifts.map(row=>({...row,state:1}))},[recovered]));await close();await open();
      assert.deepEqual(app.store.operations(),[]);assert.deepEqual(app.store.read('UserCasinoState').data,[acquired]);
    }
    // WRITTEN ONLY: cold operations are applied in queue order. A contiguous
    // all-v0 prefix can use the last operation's exact target/signature as its witness.
    {
      const [id,original]=missions[0];now=original.startAt;await fresh('casino-legacy-ordered-prefix');
      const row=claimRow(id),gifts=[gift(910002,master.currencies['currency.casino_medal'],900)],
        before={...casino(1000,123),signature:0x7fffffff};
      put('UserAchievement',[row]);put('UserGift',gifts);put('UserCasinoState',[before]);
      const mission=parse(await claim(row)).operation,present=parse(await receive(gifts)).operation,
        missionReceipt=app.store.casinoRewardReceipt(mission),presentReceipt=app.store.casinoRewardReceipt(present);
      assert.equal(missionReceipt.cap_version,1);assert.equal(presentReceipt.cap_version,0);
      app.store.db.prepare('UPDATE casino_reward_claim SET before_stock=NULL,cap_version=0 WHERE operation_id IN (?,?)')
        .run(mission.id,present.id);
      const foreign={...before,medalAmount:before.medalAmount+original.rewardAmount+900,
        cumulativeMedalAmount:presentReceipt.cumulative_amount,signature:(present.signature+1)>>>0};
      put('UserCasinoState',[foreign]);
      assert.equal(app.store.casinoRewardEffects(mission).legacySaved,false);
      assert.equal(app.store.casinoRewardEffects(present).legacyExact,false);
      await reject(send('user_data/confirm'));
      const acquired={...foreign,signature:present.signature};put('UserCasinoState',[acquired]);
      const missionEffects=app.store.casinoRewardEffects(mission),presentEffects=app.store.casinoRewardEffects(present);
      assert.equal(missionEffects.legacyExact,false);assert.equal(missionEffects.legacyOrdered,true);
      assert.equal(missionEffects.legacySaved,true);assert.equal(presentEffects.legacyExact,true);
      const recoveredMission={...mission,parameters:{...mission.parameters,issueCasinoMedal:0}},
        recoveredPresent={...present,parameters:{...present.parameters,issueCasinoMedal:0}};
      await close();await open();
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[recoveredMission,recoveredPresent]);
      parse(await push({UserAchievement:[{...row,state:4}],UserGift:gifts.map(gift=>({...gift,state:1}))},
        [recoveredMission,recoveredPresent]));await close();await open();
      assert.deepEqual(app.store.operations(),[]);assert.deepEqual(app.store.read('UserCasinoState').data,[acquired]);
    }
    console.log('Casino rewards: both original missions, native singleton, mixed gifts, separate targets, split saves, spending, lifetime history, legacy recovery, caps and rollback/restart OK; native acceptance unverified');
  } finally {
    await close(); Date.now = realNow;
    const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('danmemore-casino-rewards-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
