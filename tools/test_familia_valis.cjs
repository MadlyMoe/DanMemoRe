'use strict';

// WRITTEN ONLY / NOT RUN: source fixtures are deferred until every packet branch is implemented.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, encodeMsgpack, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = value => crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-familia-valis-'));
  let database = path.join(directory, 'profile.sqlite');
  const realRandomInt=crypto.randomInt;
  let app, port, sequence = 0, now = 1571400000;
  const open = async () => {
    app = createServer({ database, seed, master, wallNowSeconds: () => now, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows), md5(rows), name);
  const send = (value, action = 'familia/donate/valis') => request(port, ++sequence, value, String(sequence), action);
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const save = (putItems, operations = []) => ({ badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: Object.fromEntries(Object.entries(putItems).map(([name, rows]) => [name, md5(rows)])) },
    deltas: [{ signature: 0, trigger: 'FamiliaValisDonation', deleteItems: {}, putItems }],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })) });
  const bank = () => app.store.db.prepare('SELECT * FROM local_familia').get();
  const receiptCount = () => app.store.db.prepare('SELECT COUNT(*) n FROM familia_valis_donation').get().n;
  const initialCounters = Object.keys(master.familiaValisDonations).map(Number).map(donationId =>
    ({ userId: seed.userId, donationId, count: 0, lastDonatedAt: 0 }));
  //WRITTEN ONLY: stock/cumulative prefixes cannot grant credit or refill their captured clamped stock allowance.
  const stockPrefix=async (charged,gained,operation,ceiling,table,snapshot) => {
    const rows=row=>[...app.store.read('UserCurrency').data.filter(item=>item.currencyId!==charged.currencyId),row],
      wire=row=>save({UserCurrency:rows(row)}),prefix={...charged,amount:gained.amount},delta=gained.amount-charged.amount;
    assert.ok(delta>0);
    for(const [name,event] of [['profile','UPDATE'],[table,'UPDATE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER valis_prefix_fail BEFORE ${event} ON ${name} BEGIN SELECT RAISE(ABORT,'Valis prefix rollback'); END`);
      const held=snapshot();assert.equal((await send(wire(prefix),'user_data/push')).status,503);assert.deepEqual(snapshot(),held);
      app.store.db.exec('DROP TRIGGER valis_prefix_fail');
    }
    const body=wire(prefix),response=await send(body,'user_data/push'),identity=sequence;parse(response);
    const capture=app.store.db.prepare(`SELECT * FROM ${table} WHERE operation_id=?`).get(operation.id);
    assert.equal(capture.valis_seen,0);assert.equal(app.store.familiaValisSpendingFloor().ceiling,ceiling);
    if(table==='event_box_request') {
      assert.equal(JSON.parse(capture.stock_amount_added).find(row=>row.itemId===charged.currencyId).amount,delta);
      assert.ok(!JSON.parse(capture.reward_seen).includes(charged.currencyId));
    } else {
      assert.equal(JSON.parse(capture.stock_state).amountAdded,delta);assert.equal(JSON.parse(capture.stock_state).observed,false);
    }
    await close();await open();const held=snapshot();
    assert.deepEqual((await request(port,identity,body,String(identity),'user_data/push')).body,response.body);assert.deepEqual(snapshot(),held);
    const column=table==='event_box_request'?'draw_state':'stock_state';
    app.store.db.prepare(`UPDATE ${table} SET ${column}=NULL WHERE operation_id=?`).run(operation.id);
    const unknown=snapshot();assert.equal((await send(wire(prefix),'user_data/push')).status,503);assert.deepEqual(snapshot(),unknown);
    app.store.db.prepare(`UPDATE ${table} SET ${column}=? WHERE operation_id=?`).run(capture[column],operation.id);
    const spent={...prefix,amount:prefix.amount-17};parse(await send(wire(spent),'user_data/push'));
    const exhausted=snapshot();assert.equal((await send(wire({...spent,amount:spent.amount+1}),'user_data/push')).status,400);
    assert.deepEqual(snapshot(),exhausted,'Spending does not refill the already saved clamped Valis gain');
    parse(await send(wire({...spent,cumulativeAmount:gained.cumulativeAmount}),'user_data/push'));
    assert.equal(app.store.familiaValisSpendingFloor().ceiling,ceiling);
    const unacknowledged=snapshot();assert.equal((await send(save({},[operation]),'user_data/push')).status,400);
    assert.deepEqual(snapshot(),unacknowledged);return {...gained,amount:spent.amount};
  };
  try {
    await open();
    assert.deepEqual(app.store.read('UserFamiliaValisDonation').data, initialCounters);
    const profile = app.store.read('UserProfile').data[0];
    put('UserProfile', [{ ...profile, familiaId: 1, familiaName: 'Solo' }]);
    const currencies = app.store.read('UserCurrency').data;
    const valis = { userId: seed.userId, currencyId: master.currencies['currency.valis'],
      amount: 1000000, cumulativeAmount: 1000000, reservedAmount: 0, signature: 0 };
    currencies.push(valis);
    put('UserCurrency', currencies);
    app.store.db.prepare(`INSERT INTO local_familia(id,owner_id,settings,joined_at,contribution_point,valis,skill_point,
      creation_operation_id,creation_valis_before,creation_cumulative_before) VALUES(1,?,?,?,?,?,?,?,?,?)`)
      .run(seed.userId, JSON.stringify({ name: 'Solo', description: 'Offline', godId: 20000001, style: 21000001,
        subStyle: 0, activeTime: 22000001, subActiveTime: 22000002, requireApproval: false }), now, 850, 0, 0, 999, 0, 0);
    const value = { familiaId: 1, amounts: initialCounters.map((row, i) => ({ donateValisId: row.donationId, amount: i + 1 })) };
    for (const table of ['familia_valis_donation', 'reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_valis BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'rollback'); END`);
      assert.notEqual((await send(value)).status, 200);
      assert.equal(bank().valis, 0); assert.equal(receiptCount(), 0); assert.deepEqual(app.store.operations(), []);
      app.store.db.exec('DROP TRIGGER fail_valis');
    }
    const response = parse(await send(value)), operation = response.operations[0], originalSequence = sequence;
    assert.deepEqual(response.operation, operation, 'Native hot responses consume singular operation before the feature callback');
    assert.equal(operation.type, 22100);
    assert.deepEqual(operation.parameters, { consumedValis: 32100, donatedAt: now,
      familiaContributionPoint: 850, memberContributionPoint: 850,
      valisDonation: initialCounters.map((row, i) => ({ donateValisId: row.donationId, count: i + 1 })) });
    assert.equal(bank().valis, 32100); assert.equal(bank().contribution_point, 850); assert.equal(bank().skill_point, 0);
    assert.equal(response.familiaContributionPoint, 850); assert.equal(response.memberContributionPoint, 850);
    assert.equal(app.store.read('UserCurrency').data.find(row => row.currencyId === valis.currencyId).amount, 1000000,
      'The server must not pre-debit native-owned currency');
    assert.deepEqual(parse(await send({ amounts: [...value.amounts].reverse().map(row => ({ amount: row.amount,
      donateValisId: row.donateValisId })), familiaId: 1 })), response, 'Equivalent fresh retry retains one receipt/operation');
    assert.deepEqual(parse(await request(port, originalSequence, value, String(originalSequence), 'familia/donate/valis')), response);
    for (const bad of [null, { ...value, familiaId: 2 }, { familiaId: 1, amounts: [] },
      { familiaId: 1, amounts: [{ donateValisId: 1, amount: 1 }] },
      { familiaId: 1, amounts: [{ donateValisId: 24000001, amount: '1' }] },
      { familiaId: 1, amounts: [value.amounts[0], value.amounts[0]] },
      { familiaId: 1, amounts: [{ donateValisId: 24000001, amount: 1, extra: true }] }])
      assert.equal((await send(bad)).status, 400);
    assert.equal((await send(save({}, [operation]), 'user_data/push')).status, 400, 'Bare ACK cannot erase the debit');
    assert.equal((await send({ familiaId: 1, familiaShopId: 63000000001 }, 'familia/shop/item/buy')).status, 400);
    valis.amount -= 32100;
    parse(await send(save({ UserCurrency: currencies }), 'user_data/push'));
    assert.equal((await send(save({}, [operation]), 'user_data/push')).status, 400, 'Split currency save still requires counters');
    let counters = initialCounters.map((row, i) => ({ ...row, count: i + 1, lastDonatedAt: now }));
    parse(await send(save({ UserFamiliaValisDonation: counters }, [operation]), 'user_data/push'));
    assert.deepEqual(app.store.operations(), []); assert.equal(receiptCount(), 1);
    const next = { familiaId: 1, amounts: counters.map(row => ({ donateValisId: row.donationId, amount: 5 - row.count })) };
    const second = parse(await send(next)).operations[0];
    assert.equal(second.parameters.consumedValis, 23400);
    valis.amount -= 23400; counters = counters.map(row => ({ ...row, count: 5 }));
    parse(await send(save({ UserCurrency: currencies, UserFamiliaValisDonation: counters }, [second]), 'user_data/push'));
    assert.equal(bank().valis, 55500);
    await close(); await open();
    assert.equal(bank().valis, 55500); assert.equal(receiptCount(), 2);
    for (const donateValisId of Object.keys(master.familiaValisDonations).map(Number))
      assert.equal((await send({ familiaId: 1, amounts: [{ donateValisId, amount: 1 }] })).status, 400);
    const staleCurrency = currencies.map(row => row.currencyId === valis.currencyId ? { ...row, amount: 1000000 } : row);
    assert.equal((await send(save({ UserCurrency: staleCurrency }), 'user_data/push')).status, 400);
    assert.equal((await send(save({ UserFamiliaValisDonation: counters.map(row => ({ ...row, count: 0 })) }), 'user_data/push')).status, 400);
    assert.equal(app.store.read('UserCurrency').data.find(row => row.currencyId === valis.currencyId).amount, 944500);
    now = (Math.floor((now + 32400) / 86400) + 1) * 86400 - 32400;
    const third = parse(await send({ familiaId: 1, amounts: [{ donateValisId: 24000001, amount: 1 }] })).operations[0];
    assert.deepEqual(third.parameters.valisDonation, [{ donateValisId: 24000001, count: 1 }]);
    valis.amount -= 100;
    parse(await send(save({ UserCurrency: currencies }), 'user_data/push'));
    await close(); await open();
    assert.equal((await send(save({}, [third]), 'user_data/push')).status, 400);
    counters = counters.map(row => row.donationId === 24000001 ? { ...row, count: 1, lastDonatedAt: now } : row);
    parse(await send(save({ UserFamiliaValisDonation: counters }, [third]), 'user_data/push'));
    const settled = bank().valis;
    app.store.db.prepare('UPDATE local_familia SET valis=?').run(0x7fffffff);
    assert.equal((await send({ familiaId: 1, amounts: [{ donateValisId: 24000001, amount: 1 }] })).status, 400);
    app.store.db.prepare('UPDATE local_familia SET valis=?').run(settled);
    const currentCurrency = app.store.read('UserCurrency').data;
    put('UserCurrency', currentCurrency.map(row => row.currencyId === valis.currencyId ? { ...row, amount: 50 } : row));
    assert.equal((await send({ familiaId: 1, amounts: [{ donateValisId: 24000001, amount: 1 }] })).status, 400);
    put('UserCurrency', currentCurrency);
    await close(); await open();
    assert.equal(bank().valis, 55600); assert.equal(receiptCount(), 3); assert.deepEqual(app.store.operations(), []);
    assert.equal(app.store.read('UserCurrency').data.find(row => row.currencyId === valis.currencyId).amount, 944400);
    assert.deepEqual(app.store.read('UserFamiliaValisDonation').data, counters);
    // Original prize quantities and handler-earned charges; initial bank/funding/clock are synthetic, not native acceptance.
    for(const boxId of [193000030,193000034]) for(const variant of ['crossing','capped','stock-cap'])
      for(const order of ['reward-first','counts-first','combined','spent-before-save','stock-prefix']) {
        await close();database=path.join(directory,`valis-cap-credit-${boxId}-${variant}-${order}.sqlite`);
        const original=master.eventBoxes[boxId],step=original.steps.find(step=>step.contents.some(row=>row.rewardKey==='currency.valis')),
          prize=step.contents.find(row=>row.rewardKey==='currency.valis');now=original.startAt;await open();
        put('UserProfile',[{...app.store.read('UserProfile').data[0],familiaId:1,familiaName:'Solo'}]);
        const funded={...valis,amount:variant==='stock-cap'?2000000000:1000000,
          cumulativeAmount:variant==='crossing'?999999998:999999999,signature:7};
        put('UserCurrency',[...app.store.read('UserCurrency').data.filter(row=>row.currencyId!==funded.currencyId),funded]);
        app.store.db.prepare(`INSERT INTO local_familia(id,owner_id,settings,joined_at,contribution_point,valis,skill_point,
          creation_operation_id,creation_valis_before,creation_cumulative_before) VALUES(1,?,?,?,?,?,?,?,?,?)`)
          .run(seed.userId,JSON.stringify({name:'Solo',description:'Offline',godId:20000001,style:21000001,
            subStyle:0,activeTime:22000001,subActiveTime:22000002,requireApproval:false}),now,850,0,0,999,0,0);
        const snapshot=()=>({profiles:app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),queue:app.store.operations(),
          floor:app.store.db.prepare('SELECT * FROM familia_valis_spending_floor').all(),bank:bank(),
          donations:app.store.db.prepare('SELECT * FROM familia_valis_donation ORDER BY operation_id').all(),
          boxes:app.store.db.prepare('SELECT * FROM event_box_request ORDER BY operation_id').all(),
          prizes:app.store.db.prepare('SELECT * FROM event_box_claim ORDER BY step_id,content_id').all(),
          laps:app.store.db.prepare('SELECT * FROM event_box_lap_claim ORDER BY step_id,content_id,lapped_count').all(),
          acquisitions:app.store.db.prepare('SELECT * FROM event_box_reward_claim ORDER BY operation_id,item_id').all(),
          done:app.store.db.prepare('SELECT * FROM operation_done ORDER BY id').all(),
          replies:app.store.db.prepare('SELECT * FROM reply_cache ORDER BY rowid').all()}),
          currencyRows=row=>[...app.store.read('UserCurrency').data.filter(item=>item.currencyId!==funded.currencyId),row],
          donate={familiaId:1,amounts:[{donateValisId:24000001,amount:1}]};
        const donated=parse(await send(donate)).operations[0],charged={...funded,amount:funded.amount-donated.parameters.consumedValis},
          nativeCounters=initialCounters.map(row=>row.donationId===24000001?{...row,count:1,lastDonatedAt:now}:row),
          donationSave=save({UserCurrency:currencyRows(charged),UserFamiliaValisDonation:nativeCounters},[donated]);
        assert.equal(donated.parameters.consumedValis,100);assert.equal(app.store.read('UserCurrency').data.find(row=>row.currencyId===funded.currencyId).amount,funded.amount);
        for(const [table,event] of [['profile','UPDATE'],['familia_valis_spending_floor','UPDATE'],['operation_done','INSERT'],['reply_cache','INSERT']]) {
          const queued=snapshot();app.store.db.exec(`CREATE TRIGGER valis_charge_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'Valis charge rollback'); END`);
          assert.equal((await send(donationSave,'user_data/push')).status,503);assert.deepEqual(snapshot(),queued);app.store.db.exec('DROP TRIGGER valis_charge_fail');
        }
        parse(await send(donationSave,'user_data/push'));
        const oldCeiling=charged.amount-charged.cumulativeAmount;
        assert.equal(app.store.familiaValisSpendingFloor().ceiling,oldCeiling);
        if(boxId===193000030 && variant==='capped' && order==='reward-first') {
          app.store.db.prepare('UPDATE familia_valis_donation SET spending_ceiling=NULL WHERE operation_id=?').run(donated.id);
          app.store.db.prepare('DELETE FROM familia_valis_spending_floor').run();await close();await open();
          assert.equal(app.store.familiaValisSpendingFloor().ceiling,oldCeiling,'Only explicit old completed charges initialize the legacy floor');
        }
        const ticket={userId:seed.userId,eventItemId:master.items[original.costKey],amount:1000,cumulativeAmount:1000,signature:0,bookEntryState:1},
          nativeBox={userId:seed.userId,eventBoxId:boxId,currentStepId:step.id,totalDrawCount:0},draw={eventBoxId:boxId,drawCount:1};
        parse(await send(save({UserEventItem:[ticket],UserEventBox:[nativeBox]}),'user_data/push'));
        const roll=step.contents.slice(0,step.contents.indexOf(prize)).reduce((sum,row)=>sum+row.weight,0);
        crypto.randomInt=(...args)=>args.length===1?Math.min(roll,args[0]-1):realRandomInt(...args);
        const beforeDraw=snapshot();
        for(const table of ['operation_queue','event_box_request','event_box_reward_claim','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER valis_credit_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'Valis credit issue rollback'); END`);
          assert.equal((await send(draw,'event_box/draw')).status,503);assert.deepEqual(snapshot(),beforeDraw);app.store.db.exec('DROP TRIGGER valis_credit_issue_fail');
        }
        const drawn=parse(await send(draw,'event_box/draw')),drawSequence=sequence,grant=drawn.operations[0],
          receipt=app.store.db.prepare('SELECT * FROM event_box_request WHERE operation_id=?').get(grant.id),capture=JSON.parse(receipt.valis_state),
          credited={...charged,amount:Math.min(2000000000,charged.amount+prize.amount),
            cumulativeAmount:Math.min(999999999,charged.cumulativeAmount+prize.amount),signature:grant.signature},
          expectedCredit=credited.amount-charged.amount-(credited.cumulativeAmount-charged.cumulativeAmount),
          boxCounts={UserEventItem:[{...ticket,amount:ticket.amount-original.cost}],UserEventBox:[{...nativeBox,totalDrawCount:original.cost}],
            UserEventBoxContent:drawn.UserEventBoxContent,UserEventBoxStep:drawn.UserEventBoxStep};
        assert.equal(JSON.parse(receipt.draw_state).policy,'offline-event-box-v4');assert.equal(receipt.valis_seen,0);
        assert.deepEqual(capture,{policy:'offline-event-box-valis-floor-v1',beforeAmount:charged.amount,beforeCumulative:charged.cumulativeAmount,
          grantAmount:prize.amount,amount:credited.amount,cumulative:credited.cumulativeAmount,ceilingBefore:oldCeiling,credit:expectedCredit});
        assert.equal(expectedCredit,variant==='stock-cap'?100:variant==='crossing'?prize.amount-1:prize.amount);
        assert.equal(drawn.chosenItems[0].amount,prize.amount,'Cap credit never shortens the original grant');
        assert.equal(app.store.familiaValisSpendingFloor().ceiling,oldCeiling);assert.deepEqual(snapshot().profiles,beforeDraw.profiles);
        let queued=snapshot();await close();await open();assert.deepEqual(snapshot(),queued);
        assert.deepEqual(parse(await send(draw,'event_box/draw')),drawn);
        queued=snapshot();
        for(const broken of [null,JSON.stringify({...capture,credit:capture.credit+1}),JSON.stringify({...capture,grantAmount:capture.grantAmount+1})]) {
          app.store.db.prepare('UPDATE event_box_request SET valis_state=? WHERE operation_id=?').run(broken,grant.id);
          const corrupt=snapshot();assert.equal((await send(draw,'event_box/draw')).status,503);assert.deepEqual(snapshot(),corrupt);
          app.store.db.prepare('UPDATE event_box_request SET valis_state=? WHERE operation_id=?').run(receipt.valis_state,grant.id);
        }
        assert.equal((await send(save(boxCounts,drawn.operations),'user_data/push')).status,400);assert.deepEqual(snapshot(),queued);
        let final=save({...boxCounts,UserCurrency:currencyRows(credited)},drawn.operations);
        if(order==='counts-first') {
          parse(await send(save(boxCounts),'user_data/push'));
          assert.equal(app.store.familiaValisSpendingFloor().ceiling,oldCeiling);
          assert.equal(app.store.db.prepare('SELECT valis_seen FROM event_box_request WHERE operation_id=?').get(grant.id).valis_seen,0);
          credited.amount-=17; // Actual issued signature proves capped callbacks even after first-save spending.
          final=save({UserCurrency:currencyRows(credited)},drawn.operations);
        } else if(order==='reward-first') {
          const rewardSave=save({UserCurrency:currencyRows(credited)});
          for(const [table,event] of [['profile','UPDATE'],['event_box_request','UPDATE'],['familia_valis_spending_floor','UPDATE'],['reply_cache','INSERT']]) {
            const pending=snapshot();app.store.db.exec(`CREATE TRIGGER valis_credit_save_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'Valis credit observation rollback'); END`);
            assert.equal((await send(rewardSave,'user_data/push')).status,503);assert.deepEqual(snapshot(),pending);app.store.db.exec('DROP TRIGGER valis_credit_save_fail');
          }
          parse(await send(rewardSave,'user_data/push'));assert.equal(app.store.familiaValisSpendingFloor().ceiling,oldCeiling+expectedCredit);
          assert.ok(app.store.operations().some(row=>row.id===grant.id));assert.equal((await send(save({},drawn.operations),'user_data/push')).status,400);
          credited.amount-=17;parse(await send(save({UserCurrency:currencyRows(credited)}),'user_data/push'));
          final=save(boxCounts,drawn.operations);
        } else if(order==='spent-before-save') {
          credited.amount-=17;
          final=save({...boxCounts,UserCurrency:currencyRows(credited)},drawn.operations);
        } else if(order==='stock-prefix') {
          Object.assign(credited,await stockPrefix(charged,credited,grant,oldCeiling,'event_box_request',snapshot));
          final=save({...boxCounts,UserCurrency:currencyRows(credited)},drawn.operations);
        }
        await close();await open();assert.equal((await send(draw,'event_box/draw')).status,['combined','spent-before-save'].includes(order)?200:503);
        for(const [table,event] of [['profile','UPDATE'],['event_box_request','UPDATE'],
          ...(order==='reward-first'?[]:[['familia_valis_spending_floor','UPDATE']]),['operation_done','INSERT'],['reply_cache','INSERT']]) {
          const pending=snapshot();app.store.db.exec(`CREATE TRIGGER valis_credit_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'Valis credit ACK rollback'); END`);
          assert.equal((await send(final,'user_data/push')).status,503);assert.deepEqual(snapshot(),pending);app.store.db.exec('DROP TRIGGER valis_credit_ack_fail');
        }
        const acknowledgement=await send(final,'user_data/push'),ackSequence=sequence;parse(acknowledgement);
        assert.equal(app.store.familiaValisSpendingFloor().ceiling,oldCeiling+expectedCredit);assert.deepEqual(app.store.operations(),[]);
        assert.equal(app.store.db.prepare('SELECT valis_seen FROM event_box_request WHERE operation_id=?').get(grant.id).valis_seen,1,
          'Real ACK retains the permanent cap-credit source, not a native callback to replay');
        const settled=snapshot();await close();await open();assert.deepEqual(snapshot(),settled);
        assert.deepEqual((await request(port,ackSequence,final,String(ackSequence),'user_data/push')).body,acknowledgement.body);
        assert.equal((await request(port,drawSequence,draw,String(drawSequence),'event_box/draw')).status,503);assert.deepEqual(snapshot(),settled);
        const refunded={...credited,amount:credited.cumulativeAmount+oldCeiling+expectedCredit+1};
        assert.equal((await send(save({UserCurrency:currencyRows(refunded)}),'user_data/push')).status,400);assert.deepEqual(snapshot(),settled);
        const recordedFloor=app.store.familiaValisSpendingFloor();
        app.store.db.prepare('UPDATE familia_valis_spending_floor SET ceiling=ceiling+1').run();
        const badFloor=snapshot();assert.equal((await send(save({}),'user_data/push')).status,503);assert.deepEqual(snapshot(),badFloor);
        app.store.db.prepare('UPDATE familia_valis_spending_floor SET ceiling=?').run(recordedFloor.ceiling);
        app.store.db.prepare('DELETE FROM familia_valis_spending_floor').run();await close();await open();
        assert.equal((await send(save({}),'user_data/push')).status,503,'A lost new credit floor must not be reseeded from legacy donations');
        app.store.db.prepare('INSERT INTO familia_valis_spending_floor(user_id,ceiling,source_operation_id,source_kind) VALUES(?,?,?,?)')
          .run(recordedFloor.user_id,recordedFloor.ceiling,recordedFloor.source_operation_id,recordedFloor.source_kind);
        if(boxId===193000030 && variant==='stock-cap' && order==='combined') {
          const unchangedFloor=app.store.familiaValisSpendingFloor(),zero=parse(await send(draw,'event_box/draw')),
            zeroReceipt=app.store.db.prepare('SELECT * FROM event_box_request WHERE operation_id=?').get(zero.operations[0].id);
          assert.equal(zeroReceipt.valis_state,null);assert.equal(JSON.parse(zeroReceipt.draw_state).policy,'offline-event-box-v3');
          credited.signature=zero.operations[0].signature;
          parse(await send(save({UserCurrency:currencyRows(credited),UserEventItem:[{...ticket,amount:1000-original.cost*2}],
            UserEventBox:[{...nativeBox,totalDrawCount:original.cost*2}],UserEventBoxContent:zero.UserEventBoxContent,
            UserEventBoxStep:zero.UserEventBoxStep},zero.operations),'user_data/push'));
          assert.deepEqual(app.store.familiaValisSpendingFloor(),unchangedFloor,'A full-stock no-op grants no spending credit');
          assert.equal(app.store.db.prepare('SELECT 1 FROM event_box_request WHERE operation_id=?').get(zero.operations[0].id),undefined);
        }
        const nextDonation=parse(await send(donate)).operations[0],remaining={...credited,amount:credited.amount-100},
          nextCounters=nativeCounters.map(row=>row.donationId===24000001?{...row,count:2}:row);
        if(boxId===193000030) {
          const pending=snapshot();assert.equal((await send(draw,'event_box/draw')).status,503);assert.deepEqual(snapshot(),pending,
            'Settle the actual older Valis debit before capturing a saturated gain; no guessed coalesced order');
        }
        assert.equal((await send(save({},[nextDonation]),'user_data/push')).status,400);
        parse(await send(save({UserCurrency:currencyRows(remaining),UserFamiliaValisDonation:nextCounters},[nextDonation]),'user_data/push'));
        assert.equal(app.store.familiaValisSpendingFloor().ceiling,remaining.amount-remaining.cumulativeAmount);
        assert.equal(bank().valis,200);assert.equal(receiptCount(),2);await close();await open();
        assert.equal((await send(save({UserCurrency:currencyRows(credited)}),'user_data/push')).status,400,
          'An earlier cap credit cannot refund a later donation');
      }
    crypto.randomInt=realRandomInt;
    //WRITTEN ONLY / NOT RUN: synthetic flat Presents use the original Valis item/prize quantity, not natural publisher delivery proof.
    for(const variant of ['crossing','capped','stock-cap']) for(const order of ['flags-first','reward-first','combined','spent-before-save','stock-prefix']) {
      await close();database=path.join(directory,`valis-present-credit-${variant}-${order}.sqlite`);now=1571400000;await open();
      put('UserProfile',[{...app.store.read('UserProfile').data[0],familiaId:1,familiaName:'Solo'}]);
      const funded={...valis,amount:variant==='stock-cap'?2000000000:1000000,
        cumulativeAmount:variant==='crossing'?999999998:999999999,signature:7},
        currencyRows=row=>[...app.store.read('UserCurrency').data.filter(item=>item.currencyId!==funded.currencyId),row],
        quantity=master.eventBoxes[193000034].steps.flatMap(step=>step.contents).find(row=>row.rewardKey==='currency.valis').amount,
        makeGift=id=>({userId:seed.userId,id,itemId:funded.currencyId,amount:quantity,title:'Synthetic captured Valis Present',message:'',
          senderType:1,senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,
          pcHeroSublimateCount:0,state:0,startAt:now,expireAt:0,createdAt:now,dynamodbExpireAt:0}),
        gifts=[makeGift(1)],receive={userId:seed.userId,giftIds:[1]},received=gifts.map(row=>({...row,state:1})),
        snapshot=()=>({profiles:app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),queue:app.store.operations(),
          floor:app.store.db.prepare('SELECT * FROM familia_valis_spending_floor').all(),bank:bank(),
          donations:app.store.db.prepare('SELECT * FROM familia_valis_donation ORDER BY operation_id').all(),
          claims:app.store.db.prepare('SELECT * FROM gift_claim ORDER BY gift_id').all(),
          items:app.store.db.prepare('SELECT * FROM gift_item_claim ORDER BY operation_id,item_id').all(),
          done:app.store.db.prepare('SELECT * FROM operation_done ORDER BY id').all(),
          replies:app.store.db.prepare('SELECT * FROM reply_cache ORDER BY rowid').all()}),
        donate={familiaId:1,amounts:[{donateValisId:24000001,amount:1}]};
      assert.equal(quantity,100000);put('UserCurrency',currencyRows(funded));put('UserGift',gifts);
      app.store.db.prepare(`INSERT INTO local_familia(id,owner_id,settings,joined_at,contribution_point,valis,skill_point,
        creation_operation_id,creation_valis_before,creation_cumulative_before) VALUES(1,?,?,?,?,?,?,?,?,?)`)
        .run(seed.userId,JSON.stringify({name:'Solo',description:'Offline',godId:20000001,style:21000001,
          subStyle:0,activeTime:22000001,subActiveTime:22000002,requireApproval:false}),now,850,0,0,999,0,0);
      const donation=parse(await send(donate)).operation,charged={...funded,amount:funded.amount-donation.parameters.consumedValis},
        counters=initialCounters.map(row=>row.donationId===24000001?{...row,count:1,lastDonatedAt:now}:row);
      const unsettled=snapshot();assert.equal((await send(receive,'gift/receive')).status,503);assert.deepEqual(snapshot(),unsettled,
        'A prior native Familia debit must settle before its Valis gain baseline is captured');
      parse(await send(save({UserCurrency:currencyRows(charged),UserFamiliaValisDonation:counters},[donation]),'user_data/push'));
      const ceiling=app.store.familiaValisSpendingFloor().ceiling,beforeIssue=snapshot();
      for(const table of ['operation_queue','gift_item_claim','gift_claim','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER present_credit_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'present credit issue rollback'); END`);
        assert.equal((await send(receive,'gift/receive')).status,503);assert.deepEqual(snapshot(),beforeIssue);app.store.db.exec('DROP TRIGGER present_credit_issue_fail');
      }
      const drawn=parse(await send(receive,'gift/receive')),receiveSequence=sequence,grant=drawn.operation,
        target=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=?').get(grant.id),capture=JSON.parse(target.valis_state),
        gained={...charged,amount:Math.min(2000000000,charged.amount+quantity),cumulativeAmount:999999999,signature:grant.signature},
        credit=gained.amount-charged.amount-(gained.cumulativeAmount-charged.cumulativeAmount),
        credited=order==='spent-before-save'?{...gained,amount:gained.amount-17}:gained;
      assert.equal(credit,variant==='stock-cap'?100:variant==='crossing'?quantity-1:quantity);
      assert.deepEqual(capture,{policy:'offline-gift-valis-floor-v1',beforeAmount:charged.amount,beforeCumulative:charged.cumulativeAmount,
        grantAmount:quantity,amount:gained.amount,cumulative:999999999,ceilingBefore:ceiling,credit});
      assert.equal(JSON.parse(target.stock_state).policy,'offline-gift-stock-cap-v2');
      assert.equal(JSON.parse(target.stock_state).valisFloorHash,md5(capture));assert.equal(target.valis_seen,0);
      assert.deepEqual(drawn.receivedItems,[{itemId:funded.currencyId,amount:quantity}]);assert.deepEqual(drawn.operations,[grant]);
      assert.deepEqual(snapshot().profiles,beforeIssue.profiles);assert.equal(app.store.familiaValisSpendingFloor().ceiling,ceiling);
      for(const changes of [{valis_state:null},{valis_state:'{'},{valis_state:JSON.stringify({...capture,credit:credit+1})},
        {valis_seen:1},{stock_state:JSON.stringify({...JSON.parse(target.stock_state),policy:'offline-gift-stock-cap-v1'})},
        {stock_state:JSON.stringify({...JSON.parse(target.stock_state),valisFloorHash:null})}]) {
        app.store.db.prepare(`UPDATE gift_item_claim SET ${Object.keys(changes).map(field=>`${field}=?`).join(',')} WHERE operation_id=?`)
          .run(...Object.values(changes),grant.id);
        const corrupt=snapshot();assert.equal((await send(receive,'gift/receive')).status,503);assert.deepEqual(snapshot(),corrupt);
        app.store.db.prepare('UPDATE gift_item_claim SET valis_state=?,valis_seen=0,stock_state=? WHERE operation_id=?')
          .run(target.valis_state,target.stock_state,grant.id);
      }
      if(order==='flags-first') {
        parse(await send(save({UserGift:received}),'user_data/push'));assert.equal(app.store.familiaValisSpendingFloor().ceiling,ceiling);
        const missing=snapshot();assert.equal((await send(save({},[grant]),'user_data/push')).status,400);assert.deepEqual(snapshot(),missing);
      }
      if(['reward-first','spent-before-save'].includes(order)) {
        for(const [table,event] of [['profile','UPDATE'],['gift_item_claim','UPDATE'],['familia_valis_spending_floor','UPDATE'],['reply_cache','INSERT']]) {
          const queued=snapshot();app.store.db.exec(`CREATE TRIGGER present_credit_save_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'present credit save rollback'); END`);
          assert.equal((await send(save({UserCurrency:currencyRows(credited)}),'user_data/push')).status,503);assert.deepEqual(snapshot(),queued);
          app.store.db.exec('DROP TRIGGER present_credit_save_fail');
        }
        parse(await send(save({UserCurrency:currencyRows(credited)}),'user_data/push'));
        assert.equal(app.store.familiaValisSpendingFloor().ceiling,ceiling+credit);await close();await open();
        const held=snapshot();assert.equal((await send(receive,'gift/receive')).status,503);
        assert.equal((await request(port,receiveSequence,receive,String(receiveSequence),'gift/receive')).status,503);assert.deepEqual(snapshot(),held);
        // WRITTEN ONLY: captured capped Valis is not recredited by a cold Present callback after its saved charge floor.
        const cold=parse(await send(undefined,'user_data/confirm'));
        assert.deepEqual(cold.operations.find(row=>row.id===grant.id)?.parameters.receivedItems,[]);
        assert.equal(app.store.familiaValisSpendingFloor().ceiling,ceiling+credit);
        assert.deepEqual(app.store.operations(),[grant]);
        const missing=snapshot();assert.equal((await send(save({},[grant]),'user_data/push')).status,400);assert.deepEqual(snapshot(),missing);
      }
      if(order==='stock-prefix') Object.assign(credited,await stockPrefix(charged,gained,grant,ceiling,'gift_item_claim',snapshot));
      const final=save({UserGift:received,UserCurrency:currencyRows(credited)},[grant]);
      for(const [table,event] of [['gift_item_claim','UPDATE'],['familia_valis_spending_floor','UPDATE'],['operation_done','INSERT'],['reply_cache','INSERT']]) {
        if(['reward-first','spent-before-save'].includes(order) && ['gift_item_claim','familia_valis_spending_floor'].includes(table)) continue;
        const queued=snapshot();app.store.db.exec(`CREATE TRIGGER present_credit_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'present credit ACK rollback'); END`);
        assert.equal((await send(final,'user_data/push')).status,503);assert.deepEqual(snapshot(),queued);app.store.db.exec('DROP TRIGGER present_credit_ack_fail');
      }
      const ack=await send(final,'user_data/push'),ackSequence=sequence;parse(ack);assert.deepEqual(app.store.operations(),[]);
      assert.equal(app.store.familiaValisSpendingFloor().source_kind,'present');assert.equal(app.store.familiaValisSpendingFloor().ceiling,ceiling+credit);
      assert.equal(app.store.db.prepare('SELECT valis_seen FROM gift_item_claim WHERE operation_id=?').get(grant.id).valis_seen,1);
      await close();await open();const settled=snapshot();assert.deepEqual((await request(port,ackSequence,final,String(ackSequence),'user_data/push')).body,ack.body);
      assert.equal((await request(port,receiveSequence,receive,String(receiveSequence),'gift/receive')).status,503);assert.deepEqual(snapshot(),settled);
      for(const change of [{stock_state:JSON.stringify({...JSON.parse(snapshot().items[0].stock_state),observed:'true'})},
        {valis_seen:0},{valis_state:null}]) {
        const saved=snapshot().items[0];app.store.db.prepare(`UPDATE gift_item_claim SET ${Object.keys(change).map(field=>`${field}=?`).join(',')} WHERE operation_id=?`)
          .run(...Object.values(change),grant.id);
        assert.throws(()=>app.store.familiaValisSpendingFloor(),/Present|capture/);
        app.store.db.prepare('UPDATE gift_item_claim SET stock_state=?,valis_state=?,valis_seen=? WHERE operation_id=?')
          .run(saved.stock_state,saved.valis_state,saved.valis_seen,grant.id);
      }
      const recordedFloor=app.store.familiaValisSpendingFloor();app.store.db.prepare('DELETE FROM familia_valis_spending_floor').run();await close();await open();
      assert.equal((await send(save({}),'user_data/push')).status,503,'A missing new Present credit floor cannot be imported from old charges');
      app.store.db.prepare('INSERT INTO familia_valis_spending_floor(user_id,ceiling,source_operation_id,source_kind) VALUES(?,?,?,?)')
        .run(recordedFloor.user_id,recordedFloor.ceiling,recordedFloor.source_operation_id,recordedFloor.source_kind);
      if(variant==='stock-cap' && order==='combined') {
        const zeroGift=makeGift(2);put('UserGift',[zeroGift]);const zero=parse(await send({userId:seed.userId,giftIds:[2]},'gift/receive')).operation;
        assert.equal(app.store.db.prepare('SELECT valis_state FROM gift_item_claim WHERE operation_id=?').get(zero.id).valis_state,null);
        parse(await send(save({UserGift:[{...zeroGift,state:1}],UserCurrency:currencyRows({...credited,signature:zero.signature})},[zero]),'user_data/push'));
        assert.deepEqual(app.store.familiaValisSpendingFloor(),recordedFloor,'A full-stock callback cannot mint spending credit');
      }
      const donationBefore=app.store.read('UserCurrency').data.find(row=>row.currencyId===funded.currencyId),
        later=parse(await send(donate)).operation,remaining={...donationBefore,amount:donationBefore.amount-later.parameters.consumedValis},
        nextCounters=counters.map(row=>row.donationId===24000001?{...row,count:2}:row);
      parse(await send(save({UserCurrency:currencyRows(remaining),UserFamiliaValisDonation:nextCounters},[later]),'user_data/push'));
      assert.equal(app.store.familiaValisSpendingFloor().ceiling,remaining.amount-remaining.cumulativeAmount);assert.equal(bank().valis,200);
      const laterCharge=snapshot();assert.equal((await send(save({UserCurrency:currencyRows(donationBefore)}),'user_data/push')).status,400);
      assert.deepEqual(snapshot(),laterCharge,'An earlier Present cap credit cannot refund a later real donation');
    }
    // WRITTEN ONLY / NOT RUN: original Valis shop207000044/quantity30000, synthetic funded currency/price/order, no native earning proof.
    for(const variant of ['crossing','capped','stock-cap']) for(const order of ['counts-first','reward-first','combined','spent-before-save','stock-prefix']) {
      const productId=207000044,product=master.shopProducts[productId],body={shopProductId:productId};
      assert.equal(product.rewardId,valis.currencyId);assert.equal(product.rewardType,0);assert.equal(product.amount,30000);
      assert.equal(master.itemProfiles[product.priceItemId].table,'UserEventItem');assert.equal(product.limit,2);
      await close();database=path.join(directory,`valis-shop-credit-${variant}-${order}.sqlite`);now=product.startAt;await open();
      put('UserProfile',[{...app.store.read('UserProfile').data[0],familiaId:1,familiaName:'Solo'}]);
      const funded={...valis,amount:variant==='stock-cap'?2000000000:1000000,
        cumulativeAmount:variant==='crossing'?999999998:999999999,signature:7},
        currencyRows=row=>[...app.store.read('UserCurrency').data.filter(item=>item.currencyId!==funded.currencyId),row],
        cost={userId:seed.userId,eventItemId:product.priceItemId,amount:product.price*3,cumulativeAmount:product.price*3,
          bookEntryState:1,signature:0},savedCost={...cost,amount:cost.amount-product.price},
        snapshot=()=>({profiles:app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),queue:app.store.operations(),
          floor:app.store.db.prepare('SELECT * FROM familia_valis_spending_floor').all(),bank:bank(),
          donations:app.store.db.prepare('SELECT * FROM familia_valis_donation ORDER BY operation_id').all(),
          shops:app.store.db.prepare('SELECT * FROM shop_request ORDER BY operation_id').all(),
          items:app.store.db.prepare('SELECT * FROM shop_item_claim ORDER BY operation_id,item_id').all(),
          spends:app.store.db.prepare('SELECT * FROM shop_spend ORDER BY id').all(),
          done:app.store.db.prepare('SELECT * FROM operation_done ORDER BY id').all(),
          replies:app.store.db.prepare('SELECT * FROM reply_cache ORDER BY key').all(),sequence:app.store.lastSequence()}),
        shopSave=(rows,operations=[])=>({...save(rows,operations),deltas:[{signature:0,trigger:'EventShopBuy',deleteItems:{},putItems:rows}]}),
        donate={familiaId:1,amounts:[{donateValisId:24000001,amount:1}]};
      put('UserCurrency',currencyRows(funded));put('UserShopProduct',[]);put('UserEventItem',[cost]);
      app.store.db.prepare(`INSERT INTO local_familia(id,owner_id,settings,joined_at,contribution_point,valis,skill_point,
        creation_operation_id,creation_valis_before,creation_cumulative_before) VALUES(1,?,?,?,?,?,?,?,?,?)`)
        .run(seed.userId,JSON.stringify({name:'Solo',description:'Offline',godId:20000001,style:21000001,
          subStyle:0,activeTime:22000001,subActiveTime:22000002,requireApproval:false}),now,850,0,0,999,0,0);
      parse(await send(shopSave({UserEventItem:[savedCost]}),'user_data/push'));
      const donation=parse(await send(donate)).operation,charged={...funded,amount:funded.amount-donation.parameters.consumedValis},
        counters=initialCounters.map(row=>row.donationId===24000001?{...row,count:1,lastDonatedAt:now}:row),unsettled=snapshot();
      assert.notEqual((await send(body,'shop/buy')).status,200);assert.deepEqual(snapshot(),unsettled,
        'Settle an older native Familia charge before capturing shop Valis');
      parse(await send(save({UserCurrency:currencyRows(charged),UserFamiliaValisDonation:counters},[donation]),'user_data/push'));
      const ceiling=app.store.familiaValisSpendingFloor().ceiling,beforeIssue=snapshot();
      for(const table of ['operation_queue','shop_request','shop_item_claim','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER shop_credit_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'shop credit issue rollback'); END`);
        assert.equal((await send(body,'shop/buy')).status,503);assert.deepEqual(snapshot(),beforeIssue);app.store.db.exec('DROP TRIGGER shop_credit_issue_fail');
      }
      const bought=parse(await send(body,'shop/buy')),identity=sequence,grant=bought.operation,
        target=app.store.db.prepare('SELECT * FROM shop_item_claim WHERE operation_id=?').get(grant.id),capture=JSON.parse(target.valis_state),
        gained={...charged,amount:Math.min(2000000000,charged.amount+product.amount),cumulativeAmount:999999999,signature:grant.signature},
        credit=gained.amount-charged.amount-(gained.cumulativeAmount-charged.cumulativeAmount),
        credited=order==='spent-before-save'?{...gained,amount:gained.amount-17}:gained,
        row={userId:seed.userId,shopProductId:productId,count:bought.count,lastExchangedAt:bought.lastExchangedAt,readState:1};
      assert.equal(credit,variant==='stock-cap'?100:variant==='crossing'?product.amount-1:product.amount);
      assert.deepEqual(capture,{policy:'offline-shop-valis-floor-v1',beforeAmount:charged.amount,beforeCumulative:charged.cumulativeAmount,
        grantAmount:product.amount,amount:gained.amount,cumulative:999999999,ceilingBefore:ceiling,credit});
      assert.equal(JSON.parse(target.stock_state).valisFloorHash,md5(capture));assert.equal(target.valis_seen,0);
      assert.deepEqual(bought.boughtItems,[{itemId:funded.currencyId,amount:product.amount}]);assert.deepEqual(snapshot().profiles,beforeIssue.profiles);
      assert.equal(app.store.familiaValisSpendingFloor().ceiling,ceiling);
      for(const changes of [{valis_state:null},{valis_state:'{'},{valis_state:JSON.stringify({...capture,credit:credit+1})},
        {valis_seen:1},{stock_state:JSON.stringify({...JSON.parse(target.stock_state),valisFloorHash:null})}]) {
        app.store.db.prepare(`UPDATE shop_item_claim SET ${Object.keys(changes).map(field=>`${field}=?`).join(',')} WHERE operation_id=?`)
          .run(...Object.values(changes),grant.id);const corrupt=snapshot();
        assert.equal((await send(body,'shop/buy')).status,503);assert.deepEqual(snapshot(),corrupt);
        app.store.db.prepare('UPDATE shop_item_claim SET valis_state=?,stock_state=?,valis_seen=0 WHERE operation_id=?')
          .run(target.valis_state,target.stock_state,grant.id);
      }
      const partial=order==='counts-first'?{UserShopProduct:[row]}:{UserCurrency:currencyRows(credited)};
      if(order==='stock-prefix') Object.assign(credited,await stockPrefix(charged,gained,grant,ceiling,'shop_item_claim',snapshot));
      else if(order!=='combined') {
        for(const [table,event] of [['profile','UPDATE'],[order==='counts-first'?'shop_request':'shop_item_claim','UPDATE'],
          ...(order==='counts-first'?[]:[['familia_valis_spending_floor','UPDATE']]),['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER shop_credit_save_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'shop credit save rollback'); END`);
          const held=snapshot();assert.equal((await send(shopSave(partial),'user_data/push')).status,503);assert.deepEqual(snapshot(),held);
          app.store.db.exec('DROP TRIGGER shop_credit_save_fail');
        }
        parse(await send(shopSave(partial),'user_data/push'));
        assert.equal(app.store.familiaValisSpendingFloor().ceiling,ceiling+(order==='counts-first'?0:credit));
        await close();await open();const held=snapshot();assert.equal((await send(body,'shop/buy')).status,503);
        assert.equal((await request(port,identity,body,String(identity),'shop/buy')).status,503);
        assert.equal((await send(save({},[grant]),'user_data/push')).status,400);assert.deepEqual(snapshot(),held);
      } else assert.deepEqual(parse(await request(port,identity,body,String(identity),'shop/buy')).operation,grant);
      if(order!=='combined') {
        if(order==='stock-prefix') {
          const held=snapshot(),refused=await send(undefined,'user_data/confirm');
          assert.equal(refused.status,503);assert.equal(JSON.parse(refused.body).code,OFFLINE_UNAVAILABLE_CODE);assert.deepEqual(snapshot(),held);
        } else {
          const {replies:beforeReplies,sequence:beforeSequence,...before}=snapshot(),
            expected={...grant,parameters:{...grant.parameters,boughtItems:order==='counts-first'?grant.parameters.boughtItems:[]}},
            cold=await send(undefined,'user_data/confirm'),coldIdentity=sequence;
          assert.deepEqual(parse(cold).operations,[expected]);parse(await send(undefined,'user/login'));
          const tables=['UserCurrency','UserShopProduct','UserEventItem'],pulled=await send({tables},'user_data/pull');
          assert.equal(pulled.status,200);assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull({tables})));
          const {replies:afterReplies,sequence:afterSequence,...after}=snapshot();assert.deepEqual(after,before);
          await close();await open();assert.deepEqual((await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm')).body,cold.body);
          assert.equal(app.store.familiaValisSpendingFloor().ceiling,ceiling+(order==='counts-first'?0:credit));
        }
      }
      const final=shopSave({UserCurrency:currencyRows(credited),UserShopProduct:[row]},[grant]);
      for(const [table,event] of [['shop_item_claim','UPDATE'],['familia_valis_spending_floor','UPDATE'],['operation_done','INSERT'],
        ['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        if(['reward-first','spent-before-save'].includes(order) && ['shop_item_claim','familia_valis_spending_floor'].includes(table)) continue;
        app.store.db.exec(`CREATE TRIGGER shop_credit_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'shop credit ACK rollback'); END`);
        const held=snapshot();assert.equal((await send(final,'user_data/push')).status,503);assert.deepEqual(snapshot(),held);
        app.store.db.exec('DROP TRIGGER shop_credit_ack_fail');
      }
      const ack=await send(final,'user_data/push'),ackIdentity=sequence;parse(ack);assert.deepEqual(app.store.operations(),[]);
      assert.equal(app.store.familiaValisSpendingFloor().ceiling,ceiling+credit);assert.equal(app.store.familiaValisSpendingFloor().source_kind,'shop');
      assert.equal(app.store.db.prepare('SELECT valis_seen FROM shop_item_claim WHERE operation_id=?').get(grant.id).valis_seen,1);
      await close();await open();const held=snapshot();assert.deepEqual((await request(port,ackIdentity,final,String(ackIdentity),'user_data/push')).body,ack.body);
      assert.equal((await request(port,identity,body,String(identity),'shop/buy')).status,503);assert.deepEqual(snapshot(),held);
      for(const changes of [{valis_seen:0},{valis_state:null},{stock_state:'{}'}]) {
        const saved=app.store.db.prepare('SELECT * FROM shop_item_claim WHERE operation_id=?').get(grant.id);
        app.store.db.prepare(`UPDATE shop_item_claim SET ${Object.keys(changes).map(field=>`${field}=?`).join(',')} WHERE operation_id=?`)
          .run(...Object.values(changes),grant.id);assert.throws(()=>app.store.familiaValisSpendingFloor(),/shop|capture|Valis/);
        app.store.db.prepare('UPDATE shop_item_claim SET valis_seen=?,valis_state=?,stock_state=? WHERE operation_id=?')
          .run(saved.valis_seen,saved.valis_state,saved.stock_state,grant.id);
      }
      const source=app.store.db.prepare('SELECT * FROM shop_request WHERE operation_id=?').get(grant.id);
      app.store.db.prepare('UPDATE shop_request SET operation_json=NULL WHERE operation_id=?').run(grant.id);
      assert.throws(()=>app.store.familiaValisSpendingFloor(),/shop|source/);
      app.store.db.prepare('UPDATE shop_request SET operation_json=? WHERE operation_id=?').run(source.operation_json,grant.id);
      const floor=app.store.familiaValisSpendingFloor();app.store.db.prepare('DELETE FROM familia_valis_spending_floor').run();await close();await open();
      assert.equal((await send(save({}),'user_data/push')).status,503,'A lost shop cap-credit floor cannot be reconstructed from old donations');
      app.store.db.prepare('INSERT INTO familia_valis_spending_floor(user_id,ceiling,source_operation_id,source_kind) VALUES(?,?,?,?)')
        .run(floor.user_id,floor.ceiling,floor.source_operation_id,floor.source_kind);
      if(variant==='stock-cap' && order==='combined') {
        parse(await send(shopSave({UserEventItem:[{...savedCost,amount:savedCost.amount-product.price}]}),'user_data/push'));
        const zero=parse(await send(body,'shop/buy')),zeroOp=zero.operation;
        assert.equal(app.store.db.prepare('SELECT valis_state FROM shop_item_claim WHERE operation_id=?').get(zeroOp.id).valis_state,null);
        parse(await send(shopSave({UserShopProduct:[{...row,count:zero.count,lastExchangedAt:zero.lastExchangedAt}],
          UserCurrency:currencyRows({...credited,signature:zeroOp.signature})},[zeroOp]),'user_data/push'));
        assert.deepEqual(app.store.familiaValisSpendingFloor(),floor,'A full-stock shop callback cannot mint a spending credit');
      }
      const beforeDonation=app.store.read('UserCurrency').data.find(item=>item.currencyId===funded.currencyId),
        later=parse(await send(donate)).operation,remaining={...beforeDonation,amount:beforeDonation.amount-later.parameters.consumedValis},
        nextCounters=counters.map(item=>item.donationId===24000001?{...item,count:2}:item);
      parse(await send(save({UserCurrency:currencyRows(remaining),UserFamiliaValisDonation:nextCounters},[later]),'user_data/push'));
      assert.equal(app.store.familiaValisSpendingFloor().ceiling,remaining.amount-remaining.cumulativeAmount);assert.equal(bank().valis,200);
      const laterCharge=snapshot();assert.equal((await send(save({UserCurrency:currencyRows(beforeDonation)}),'user_data/push')).status,400);
      assert.deepEqual(snapshot(),laterCharge,'A prior shop cap credit cannot refund a later real donation');
    }

    // WRITTEN ONLY / NOT RUN: original mission Valis, synthetic earned flags/stock/order, not natural eligibility or native signing proof.
    const [missionId,missionReward]=Object.entries(master.achievements).find(([id,row])=>row.rewardType===1 &&
      row.rewardKey==='currency.valis' && !row.expireAt && !master.warGameAchievements[id]);
    assert.equal(missionId,'6010000010');assert.equal(missionReward.rewardAmount,20000);
    for(const variant of ['crossing','capped','stock-cap']) for(const order of ['flags-first','reward-first','combined','spent-before-save','stock-prefix']) {
      const mixed=order==='combined'?['UserCpItem','UserHeroSublimateItem','UserGachaTicket'].map(name=>{
        const [id,original]=Object.entries(master.achievements).find(([id,row])=>master.itemProfiles[master.items[row.rewardKey]]?.table===name &&
          !row.expireAt && !master.warGameAchievements[id]);return {id,original,itemId:master.items[original.rewardKey],profile:master.itemProfiles[master.items[original.rewardKey]]};
      }):[],iris=order==='combined'?Object.entries(master.achievements).find(([,row])=>row.rewardType===3 && row.rewardKey==='currency.gem' && !row.expireAt):null;
      await close();database=path.join(directory,`valis-mission-credit-${variant}-${order}.sqlite`);
      now=Math.max(1571400000,missionReward.startAt,...mixed.map(row=>row.original.startAt),iris?.[1].startAt??0);await open();
      put('UserProfile',[{...app.store.read('UserProfile').data[0],familiaId:1,familiaName:'Solo'}]);
      const funded={...valis,amount:variant==='stock-cap'?2000000000:1000000,
        cumulativeAmount:variant==='crossing'?999999998:999999999,signature:7},
        currencyRows=row=>[...app.store.read('UserCurrency').data.filter(item=>item.currencyId!==funded.currencyId),row],
        claimRow=id=>({userId:seed.userId,achievementId:Number(id),completedAt:now,lastResetAt:0,progressParam:1,readState:1,signature:0,state:3}),
        claims=[claimRow(missionId),...mixed.map(row=>claimRow(row.id)),...(iris?[claimRow(iris[0])]:[])],received=claims.map(row=>({...row,state:4})),
        body={achievementIds:claims.map(({achievementId,completedAt})=>({achievementId,completedAt}))},
        missionSave=(rows,operations=[])=>({...save(rows,operations),deltas:[{signature:0,trigger:'Achievement',deleteItems:{},putItems:rows}]}),
        snapshot=()=>({profiles:app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),queue:app.store.operations(),bank:bank(),
          floor:app.store.db.prepare('SELECT * FROM familia_valis_spending_floor').all(),wallet:app.store.hardCurrency(),
          donations:app.store.db.prepare('SELECT * FROM familia_valis_donation ORDER BY operation_id').all(),
          items:app.store.db.prepare('SELECT * FROM achievement_item_claim ORDER BY operation_id,item_id').all(),
          claims:app.store.db.prepare('SELECT * FROM achievement_claim ORDER BY achievement_id,completed_at').all(),
          requests:app.store.db.prepare('SELECT * FROM achievement_request ORDER BY request_key').all(),
          delivery:app.store.db.prepare('SELECT * FROM achievement_pc_delivery ORDER BY operation_id').all(),
          done:app.store.db.prepare('SELECT * FROM operation_done ORDER BY id').all(),
          replies:app.store.db.prepare('SELECT * FROM reply_cache ORDER BY key').all(),sequence:app.store.lastSequence()}),
        donate={familiaId:1,amounts:[{donateValisId:24000001,amount:1}]};
      put('UserCurrency',currencyRows(funded));put('UserAchievement',claims);
      for(const [index,item] of mixed.entries()) {
        item.before={userId:seed.userId,[item.profile.idField]:item.itemId,signature:8+index,bookEntryState:1,cumulativeAmount:999999999,
          ...(item.profile.table==='UserGachaTicket'?{dateList:[]}:{amount:7}),
          ...(item.profile.table==='UserHeroSublimateItem'?{reservedAmount:0}:{})};put(item.profile.table,[item.before]);
      }
      app.store.db.prepare(`INSERT INTO local_familia(id,owner_id,settings,joined_at,contribution_point,valis,skill_point,
        creation_operation_id,creation_valis_before,creation_cumulative_before) VALUES(1,?,?,?,?,?,?,?,?,?)`)
        .run(seed.userId,JSON.stringify({name:'Solo',description:'Offline',godId:20000001,style:21000001,
          subStyle:0,activeTime:22000001,subActiveTime:22000002,requireApproval:false}),now,850,0,0,999,0,0);
      const donation=parse(await send(donate)).operation,charged={...funded,amount:funded.amount-donation.parameters.consumedValis},
        counters=initialCounters.map(row=>row.donationId===24000001?{...row,count:1,lastDonatedAt:now}:row),unsettled=snapshot();
      assert.notEqual((await send(body,'achievement/complete')).status,200);assert.deepEqual(snapshot(),unsettled);
      parse(await send(save({UserCurrency:currencyRows(charged),UserFamiliaValisDonation:counters},[donation]),'user_data/push'));
      const ceiling=app.store.familiaValisSpendingFloor().ceiling,beforeIssue=snapshot();
      for(const table of ['operation_queue','achievement_item_claim','achievement_pc_delivery','achievement_claim','achievement_request','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER mission_credit_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'mission credit issue rollback'); END`);
        assert.equal((await send(body,'achievement/complete')).status,503);assert.deepEqual(snapshot(),beforeIssue);
        app.store.db.exec('DROP TRIGGER mission_credit_issue_fail');
      }
      const bought=parse(await send(body,'achievement/complete')),identity=sequence,grant=bought.operation,
        target=app.store.db.prepare('SELECT * FROM achievement_item_claim WHERE operation_id=? AND item_id=?').get(grant.id,funded.currencyId),
        capture=JSON.parse(target.valis_state),gained={...charged,amount:Math.min(2000000000,charged.amount+missionReward.rewardAmount),
          cumulativeAmount:999999999,signature:grant.signature},credit=gained.amount-charged.amount-(gained.cumulativeAmount-charged.cumulativeAmount),
        credited=order==='spent-before-save'?{...gained,amount:gained.amount-17}:gained,
        extras=Object.fromEntries(mixed.map(item=>[item.profile.table,[{...item.before,signature:grant.signature,
          ...(item.profile.table==='UserGachaTicket'?{dateList:Array.from({length:item.original.rewardAmount},()=>({aquiredAt:now}))}:
            {amount:7+item.original.rewardAmount})}]]));
      assert.equal(credit,variant==='stock-cap'?100:variant==='crossing'?missionReward.rewardAmount-1:missionReward.rewardAmount);
      assert.deepEqual(capture,{policy:'offline-achievement-valis-floor-v1',beforeAmount:charged.amount,beforeCumulative:charged.cumulativeAmount,
        grantAmount:missionReward.rewardAmount,amount:gained.amount,cumulative:999999999,ceilingBefore:ceiling,credit});
      assert.equal(JSON.parse(target.stock_state).policy,'offline-achievement-stock-cap-v2');
      assert.equal(JSON.parse(target.stock_state).valisFloorHash,md5(capture));assert.equal(target.valis_seen,0);
      assert.deepEqual(bought.receivedItems,[{itemId:funded.currencyId,amount:missionReward.rewardAmount},...mixed.map(item=>({itemId:item.itemId,amount:item.original.rewardAmount}))]);
      assert.deepEqual(snapshot().profiles,beforeIssue.profiles);assert.equal(app.store.familiaValisSpendingFloor().ceiling,ceiling);
      assert.equal(app.store.hardCurrency(),beforeIssue.wallet+(iris?.[1].rewardAmount??0));
      for(const changes of [{valis_state:null},{valis_state:'{'},{valis_state:JSON.stringify({...capture,credit:credit+1})},
        {valis_seen:1},{stock_state:JSON.stringify({...JSON.parse(target.stock_state),valisFloorHash:null})}]) {
        app.store.db.prepare(`UPDATE achievement_item_claim SET ${Object.keys(changes).map(field=>`${field}=?`).join(',')} WHERE operation_id=? AND item_id=?`)
          .run(...Object.values(changes),grant.id,funded.currencyId);const corrupt=snapshot();
        assert.equal((await send(body,'achievement/complete')).status,503);assert.deepEqual(snapshot(),corrupt);
        app.store.db.prepare('UPDATE achievement_item_claim SET valis_state=?,stock_state=?,valis_seen=0 WHERE operation_id=? AND item_id=?')
          .run(target.valis_state,target.stock_state,grant.id,funded.currencyId);
      }
      const partial=order==='flags-first'?{UserAchievement:received}:{UserCurrency:currencyRows(credited)};
      if(order==='stock-prefix') Object.assign(credited,await stockPrefix(charged,gained,grant,ceiling,'achievement_item_claim',snapshot));
      else if(order!=='combined') {
        for(const [table,event] of [['profile','UPDATE'],[order==='flags-first'?'achievement_pc_delivery':'achievement_item_claim','UPDATE'],
          ...(order==='flags-first'?[]:[['familia_valis_spending_floor','UPDATE']]),['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER mission_credit_save_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'mission credit save rollback'); END`);
          const held=snapshot();assert.equal((await send(missionSave(partial),'user_data/push')).status,503);assert.deepEqual(snapshot(),held);
          app.store.db.exec('DROP TRIGGER mission_credit_save_fail');
        }
        parse(await send(missionSave(partial),'user_data/push'));
        assert.equal(app.store.familiaValisSpendingFloor().ceiling,ceiling+(order==='flags-first'?0:credit));
        await close();await open();const held=snapshot();assert.equal((await send(body,'achievement/complete')).status,503);
        assert.equal((await request(port,identity,body,String(identity),'achievement/complete')).status,503);
        assert.equal((await send(missionSave({},[grant]),'user_data/push')).status,400);assert.deepEqual(snapshot(),held);
      }
      //WRITTEN ONLY: original captured Valis cold projection preserves actual spending credit; no second gain or ceiling increase.
      if(['flags-first','reward-first','spent-before-save'].includes(order)) {
        const expected={...grant,parameters:{...grant.parameters,
          UserAchievement:order==='flags-first'?[]:grant.parameters.UserAchievement,
          receivedItems:order==='flags-first'?grant.parameters.receivedItems:[]}},
          retained=(()=>{const {replies,sequence,...state}=snapshot();return state;})();
        const cold=await send(undefined,'user_data/confirm'),coldIdentity=sequence;
        assert.deepEqual(parse(cold).operations,[expected]);parse(await send(undefined,'user/login'));
        assert.equal((await send({tables:['UserCurrency','UserAchievement']},'user_data/pull')).status,200);
        await close();await open();
        assert.deepEqual((await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm')).body,cold.body);
        const {replies,sequence:requestSequence,...afterCold}=snapshot();assert.deepEqual(afterCold,retained);
      }
      const finalRows={UserCurrency:currencyRows(credited),UserAchievement:received,...extras},final=missionSave(finalRows,[grant]);
      for(const name of Object.keys(extras)) {const missing={...finalRows};delete missing[name];const held=snapshot();
        assert.equal((await send(missionSave(missing,[grant]),'user_data/push')).status,400);assert.deepEqual(snapshot(),held);}
      for(const [table,event] of [['profile','UPDATE'],['achievement_item_claim','UPDATE'],['familia_valis_spending_floor','UPDATE'],
        ['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        if(['reward-first','spent-before-save'].includes(order) && ['achievement_item_claim','familia_valis_spending_floor'].includes(table)) continue;
        app.store.db.exec(`CREATE TRIGGER mission_credit_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'mission credit ACK rollback'); END`);
        const held=snapshot();assert.equal((await send(final,'user_data/push')).status,503);assert.deepEqual(snapshot(),held);
        app.store.db.exec('DROP TRIGGER mission_credit_ack_fail');
      }
      const ack=await send(final,'user_data/push'),ackIdentity=sequence;parse(ack);assert.deepEqual(app.store.operations(),[]);
      assert.equal(app.store.familiaValisSpendingFloor().ceiling,ceiling+credit);assert.equal(app.store.familiaValisSpendingFloor().source_kind,'achievement');
      assert.equal(app.store.db.prepare('SELECT valis_seen FROM achievement_item_claim WHERE operation_id=? AND item_id=?').get(grant.id,funded.currencyId).valis_seen,1);
      await close();await open();const held=snapshot();assert.deepEqual((await request(port,ackIdentity,final,String(ackIdentity),'user_data/push')).body,ack.body);
      assert.equal((await request(port,identity,body,String(identity),'achievement/complete')).status,503);assert.deepEqual(snapshot(),held);
      assert.equal(app.store.hardCurrency(),beforeIssue.wallet+(iris?.[1].rewardAmount??0));
      for(const changes of [{valis_seen:0},{valis_state:null},{stock_state:'{}'}]) {
        const saved=app.store.db.prepare('SELECT * FROM achievement_item_claim WHERE operation_id=? AND item_id=?').get(grant.id,funded.currencyId);
        app.store.db.prepare(`UPDATE achievement_item_claim SET ${Object.keys(changes).map(field=>`${field}=?`).join(',')} WHERE operation_id=? AND item_id=?`)
          .run(...Object.values(changes),grant.id,funded.currencyId);assert.throws(()=>app.store.familiaValisSpendingFloor(),/mission|capture|Valis/);
        app.store.db.prepare('UPDATE achievement_item_claim SET valis_seen=?,valis_state=?,stock_state=? WHERE operation_id=? AND item_id=?')
          .run(saved.valis_seen,saved.valis_state,saved.stock_state,grant.id,funded.currencyId);
      }
      const source=app.store.db.prepare('SELECT operation_json FROM achievement_pc_delivery WHERE operation_id=?').get(grant.id);
      app.store.db.prepare("UPDATE achievement_pc_delivery SET operation_json='{}' WHERE operation_id=?").run(grant.id);
      assert.throws(()=>app.store.familiaValisSpendingFloor(),/mission|source/);
      app.store.db.prepare('UPDATE achievement_pc_delivery SET operation_json=? WHERE operation_id=?').run(source.operation_json,grant.id);
      app.store.db.prepare('DELETE FROM achievement_claim WHERE achievement_id=? AND completed_at=?').run(Number(missionId),now);
      assert.throws(()=>app.store.familiaValisSpendingFloor(),/mission|source|identity/);
      app.store.db.prepare('INSERT INTO achievement_claim(achievement_id,completed_at,operation_id) VALUES(?,?,?)').run(Number(missionId),now,grant.id);
      const floor=app.store.familiaValisSpendingFloor();app.store.db.prepare('DELETE FROM familia_valis_spending_floor').run();await close();await open();
      assert.equal((await send(save({}),'user_data/push')).status,503,'A lost mission cap-credit floor cannot be rebuilt from old donations');
      app.store.db.prepare('INSERT INTO familia_valis_spending_floor(user_id,ceiling,source_operation_id,source_kind) VALUES(?,?,?,?)')
        .run(floor.user_id,floor.ceiling,floor.source_operation_id,floor.source_kind);
      const beforeDonation=app.store.read('UserCurrency').data.find(item=>item.currencyId===funded.currencyId),later=parse(await send(donate)).operation,
        remaining={...beforeDonation,amount:beforeDonation.amount-later.parameters.consumedValis},
        nextCounters=counters.map(item=>item.donationId===24000001?{...item,count:2}:item);
      parse(await send(save({UserCurrency:currencyRows(remaining),UserFamiliaValisDonation:nextCounters},[later]),'user_data/push'));
      assert.equal(app.store.familiaValisSpendingFloor().ceiling,remaining.amount-remaining.cumulativeAmount);assert.equal(bank().valis,200);
      const laterCharge=snapshot();assert.equal((await send(save({UserCurrency:currencyRows(beforeDonation)}),'user_data/push')).status,400);
      assert.deepEqual(snapshot(),laterCharge,'A mission cap credit cannot refund a later real donation');
    }
    // WRITTEN ONLY / NOT RUN: no-charge cap grants and exact saturation after a real charge mint no credit.
    for(const variant of ['crossing','capped','stock-cap','exact-after-charge']) {
      await close();database=path.join(directory,`valis-mission-zero-credit-${variant}.sqlite`);now=1571400000;await open();
      const funded={...valis,signature:7,amount:variant==='stock-cap'?2000000000:1000000,
        cumulativeAmount:variant==='crossing'?999999998:variant==='exact-after-charge'?999999999-missionReward.rewardAmount:999999999},
        currencyRows=row=>[...app.store.read('UserCurrency').data.filter(item=>item.currencyId!==funded.currencyId),row],
        row={userId:seed.userId,achievementId:Number(missionId),completedAt:now,lastResetAt:0,progressParam:1,readState:1,signature:0,state:3};
      put('UserCurrency',currencyRows(funded));put('UserAchievement',[row]);
      if(variant==='exact-after-charge') {
        put('UserProfile',[{...app.store.read('UserProfile').data[0],familiaId:1,familiaName:'Solo'}]);
        app.store.db.prepare(`INSERT INTO local_familia(id,owner_id,settings,joined_at,contribution_point,valis,skill_point,
          creation_operation_id,creation_valis_before,creation_cumulative_before) VALUES(1,?,?,?,?,?,?,?,?,?)`)
          .run(seed.userId,JSON.stringify({name:'Solo',description:'Offline',godId:20000001,style:21000001,
            subStyle:0,activeTime:22000001,subActiveTime:22000002,requireApproval:false}),now,850,0,0,999,0,0);
        const charge=parse(await send({familiaId:1,amounts:[{donateValisId:24000001,amount:1}]})).operation;
        funded.amount-=charge.parameters.consumedValis;
        parse(await send(save({UserCurrency:currencyRows(funded),UserFamiliaValisDonation:initialCounters.map(item=>item.donationId===24000001?
          {...item,count:1,lastDonatedAt:now}:item)},[charge]),'user_data/push'));
      }
      const floor=app.store.familiaValisSpendingFloor(),result=parse(await send({achievementIds:[{achievementId:row.achievementId,completedAt:now}]},'achievement/complete')),
        op=result.operation,target=app.store.db.prepare('SELECT * FROM achievement_item_claim WHERE operation_id=?').get(op.id);
      assert.equal(target.valis_state,null);assert.equal(target.valis_seen,0);assert.equal(JSON.parse(target.stock_state).valisFloorHash,null);
      const rows={UserCurrency:currencyRows({...funded,amount:Math.min(2000000000,funded.amount+missionReward.rewardAmount),
        cumulativeAmount:999999999,signature:op.signature}),UserAchievement:[{...row,state:4}]},wire=save(rows,[op]);
      if(variant==='exact-after-charge') {
        const gained=rows.UserCurrency.find(item=>item.currencyId===funded.currencyId);
        Object.assign(gained,await stockPrefix(funded,gained,op,floor.ceiling,'achievement_item_claim',()=>({
          profiles:app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),items:app.store.db.prepare('SELECT * FROM achievement_item_claim').all(),
          floor:app.store.db.prepare('SELECT * FROM familia_valis_spending_floor').all(),queue:app.store.operations(),
          done:app.store.db.prepare('SELECT * FROM operation_done').all(),replies:app.store.db.prepare('SELECT * FROM reply_cache ORDER BY key').all()})));
      }
      wire.deltas[0].trigger='Achievement';parse(await send(wire,'user_data/push'));
      assert.deepEqual(app.store.familiaValisSpendingFloor(),floor);assert.deepEqual(app.store.operations(),[]);
    }

    // WRITTEN ONLY / NOT RUN: paid22100 resumes zero debit; captured counter prefixes with exact unpaid wallet retain original cost.
    for(const mode of ['cost-first','counters-first','count-first','date-first','combined','midnight',
      'legacy-cost-first','legacy-counter-only','paid-count-first','paid-date-first','paid-mixed','paid-complete','paid-exhausted']) {
      await close();database=path.join(directory,`valis-recovery-${mode}.sqlite`);now=1571400000;await open();
      put('UserProfile',[{...app.store.read('UserProfile').data[0],familiaName:'Solo'}]);
      const funds=mode==='paid-exhausted'?Object.values(master.familiaValisDonations).reduce((sum,row)=>sum+row.valis,0):5000000,
        funded={...valis,amount:funds,cumulativeAmount:funds,signature:7};
      put('UserCurrency',[...app.store.read('UserCurrency').data.filter(row=>row.currencyId!==funded.currencyId),funded]);
      app.store.db.prepare(`INSERT INTO local_familia(id,owner_id,settings,joined_at,contribution_point,valis,skill_point,
        creation_operation_id,creation_valis_before,creation_cumulative_before) VALUES(1,?,?,?,?,?,?,?,?,?)`)
        .run(seed.userId,JSON.stringify({name:'Solo',description:'Offline',godId:20000001,style:21000001,
          subStyle:0,activeTime:22000001,subActiveTime:22000002,requireApproval:false}),now,850,0,0,999,0,0);
      const snapshot=()=>({profiles:app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),queue:app.store.operations(),
        receipts:app.store.db.prepare('SELECT * FROM familia_valis_donation ORDER BY operation_id').all(),bank:bank(),
        history:app.store.db.prepare('SELECT name FROM familia_name_history ORDER BY name').all(),
        floor:app.store.db.prepare('SELECT * FROM familia_valis_spending_floor').all(),
        done:app.store.db.prepare('SELECT * FROM operation_done ORDER BY id').all(),
        replies:app.store.db.prepare('SELECT * FROM reply_cache ORDER BY rowid').all(),sequence:String(app.store.lastSequence())}),
        currencyRows=row=>[...app.store.read('UserCurrency').data.filter(item=>item.currencyId!==funded.currencyId),row],
        donate={familiaId:1,amounts:initialCounters.map(row=>({donateValisId:row.donationId,amount:1}))};
      const before=snapshot(),issued=parse(await send(donate)),issueSequence=sequence,operation=issued.operations[0],
        nativeCost={...funded,amount:funded.amount-operation.parameters.consumedValis,signature:operation.signature},
        nativeCounters=initialCounters.map(row=>({...row,count:1,lastDonatedAt:now}));
      assert.deepEqual(issued.operation,operation);assert.deepEqual(snapshot().profiles,before.profiles);
      assert.equal(snapshot().receipts[0].effect_seen,0);assert.equal(snapshot().receipts[0].charge_seen,0);
      assert.equal(snapshot().receipts[0].counter_seen,'[]');assert.deepEqual(JSON.parse(snapshot().receipts[0].before_counters),initialCounters);
      assert.equal(bank().valis,operation.parameters.consumedValis);assert.equal(app.store.familiaValisSpendingFloor().ceiling,null);
      assert.deepEqual(parse(await request(port,issueSequence,donate,String(issueSequence),'familia/donate/valis')),issued);
      const untouchedResponse=await send(undefined,'user_data/confirm'),untouchedSequence=sequence,untouched=parse(untouchedResponse);
      assert.deepEqual(untouched.operations.find(row=>row.id===operation.id),operation,'Cold output receives the same required captured Familia-cache parameters');
      const noEffect=parse(await send(save({}),'user_data/push'));
      assert.deepEqual(noEffect.operations.find(row=>row.id===operation.id),operation);assert.equal(snapshot().receipts[0].effect_seen,0);
      if(mode.startsWith('legacy-')) app.store.db.prepare('UPDATE familia_valis_donation SET before_counters=NULL,counter_seen=NULL').run();
      if(mode==='legacy-counter-only') {
        const legacy=snapshot();assert.equal((await send(save({UserFamiliaValisDonation:nativeCounters}),'user_data/push')).status,503);
        assert.deepEqual(snapshot(),legacy,'A missing original before-counter capture cannot be guessed from counter-only effects');
      }
      if(mode!=='combined') {
        let first=save({UserCurrency:currencyRows(nativeCost)});
        if(mode==='counters-first') first=save({UserFamiliaValisDonation:nativeCounters});
        if(mode==='count-first') first=save({UserFamiliaValisDonation:nativeCounters.map(row=>({...row,lastDonatedAt:0}))});
        if(mode==='date-first') first=save({UserFamiliaValisDonation:nativeCounters.map(row=>({...row,count:0}))});
        if(mode==='paid-count-first') first=save({UserCurrency:currencyRows(nativeCost),
          UserFamiliaValisDonation:nativeCounters.map(row=>({...row,lastDonatedAt:0}))});
        if(mode==='paid-date-first') first=save({UserCurrency:currencyRows(nativeCost),
          UserFamiliaValisDonation:nativeCounters.map(row=>({...row,count:0}))});
        if(mode==='paid-mixed') first=save({UserCurrency:currencyRows(nativeCost),
          UserFamiliaValisDonation:nativeCounters.map((row,i)=>i===0?{...row,lastDonatedAt:0}:i===1?{...row,count:0}:row)});
        if(mode==='paid-complete') first=save({UserCurrency:currencyRows(nativeCost),UserFamiliaValisDonation:nativeCounters});
        for(const [table,event] of [['profile','UPDATE'],['familia_valis_donation','UPDATE'],['reply_cache','INSERT']]) {
          const queued=snapshot();app.store.db.exec(`CREATE TRIGGER valis_partial_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'partial donation rollback'); END`);
          assert.equal((await send(first,'user_data/push')).status,503);assert.deepEqual(snapshot(),queued);app.store.db.exec('DROP TRIGGER valis_partial_fail');
        }
        const partial=parse(await send(first,'user_data/push')),partialReceipt=snapshot().receipts[0];
        assert.deepEqual(partial.operations,[],'Omission is delivery suppression only, not completion');
        assert.equal(partialReceipt.effect_seen,1);assert.ok(app.store.operations().some(row=>row.id===operation.id));
        assert.equal(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id),undefined);
        assert.equal(app.store.familiaValisSpendingFloor().ceiling,null,'A partial donation does not publish its completed spending floor');
        if(['counters-first','count-first','date-first'].includes(mode)) {
          assert.equal(partialReceipt.charge_seen,0);
          assert.deepEqual(JSON.parse(partialReceipt.counter_seen),initialCounters.map(row=>({donationId:row.donationId,
            count:mode!=='date-first',date:mode!=='count-first'})));
        } else assert.equal(partialReceipt.charge_seen,1);
        const pending=snapshot();await close();await open();assert.deepEqual(snapshot(),pending);
        const recoverable=!mode.startsWith('legacy-') && (partialReceipt.charge_seen===1 ||
            ['counters-first','count-first','date-first'].includes(mode)),
          recovered={...operation,parameters:{...operation.parameters,consumedValis:partialReceipt.charge_seen?0:operation.parameters.consumedValis}},
          nativeState=value=>({profiles:value.profiles.filter(row=>['UserCurrency','UserFamiliaValisDonation','UserProfile'].includes(row.name)),
            queue:value.queue,receipts:value.receipts,bank:value.bank,history:value.history,floor:value.floor,done:value.done});
        if(recoverable) {
          const retained=snapshot();assert.equal(app.store.familiaValisDelivery(app.store.operations()[0],'user_data/confirm'),true);
          assert.deepEqual(snapshot(),retained,'Deriving a captured paid or exact-unpaid donation changes no save, checkpoint, bank or queue');
          const old=parse(await request(port,untouchedSequence,undefined,String(untouchedSequence),'user_data/confirm'));
          assert.deepEqual(old.operations,[recovered]);assert.deepEqual(snapshot(),retained,'Cached original donation envelopes derive only their proven remaining charge without writes');
          assert.equal(app.store.operations()[0].parameters.consumedValis,operation.parameters.consumedValis);
          if(mode==='paid-exhausted') assert.equal(app.store.read('UserCurrency').data.find(row=>row.currencyId===funded.currencyId).amount,0);
        }
        for(const [action,body] of [['familia/donate/valis',donate],['user/login',undefined],['user_data/confirm',undefined],
          ['user_data/pull',{tables:['UserCurrency','UserFamiliaValisDonation']}]]) {
          const retained=snapshot(),response=await send(body,action);
          if(recoverable && action!=='familia/donate/valis') {
            assert.equal(response.status,200,response.body.toString());
            if(action==='user_data/confirm') assert.deepEqual(parse(response).operations,[recovered]);
            if(action==='user_data/pull') assert.equal(response.headers['content-type'],'application/x-msgpack');
            assert.deepEqual(nativeState(snapshot()),nativeState(retained),'Login/pull validation and captured confirm never prewrite a debit, credit or acknowledgement');
          } else {assert.equal(response.status,503);assert.deepEqual(snapshot(),retained);}
        }
        assert.equal((await request(port,issueSequence,donate,String(issueSequence),'familia/donate/valis')).status,503);
        if(mode!=='paid-complete') {const retained=snapshot();assert.equal((await send(save({},[operation]),'user_data/push')).status,400);assert.deepEqual(snapshot(),retained);}
        if(recoverable) {
          const cold=await send(undefined,'user_data/confirm'),identity=sequence;
          assert.deepEqual(parse(cold).operations,[recovered]);
          for(const change of [...(!partialReceipt.charge_seen?[{consumedValis:0}]:[]),
            {consumedValis:1},{consumedValis:-1},{consumedValis:'0'},{consumedValis:undefined},
            {donatedAt:operation.parameters.donatedAt+1},{familiaContributionPoint:operation.parameters.familiaContributionPoint+1},
            {valisDonation:operation.parameters.valisDonation.map((row,i)=>i?row:{...row,count:row.count+1})},{unexpectedField:true}]) {
            const bad=JSON.parse(cold.body);bad.operations[0].parameters={...bad.operations[0].parameters,...change};
            app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(Buffer.from(JSON.stringify(bad)).toString('base64'),`${identity}/${identity}`);
            const retained=snapshot(),reply=await request(port,identity,undefined,String(identity),'user_data/confirm');
            assert.equal(reply.status,503);assert.deepEqual(snapshot(),retained);
          }
          app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(untouchedResponse.body.toString('base64'),`${identity}/${identity}`);
          assert.deepEqual(parse(await request(port,identity,undefined,String(identity),'user_data/confirm')).operations,[recovered]);
          app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(cold.body.toString('base64'),`${identity}/${identity}`);
          const queued=app.store.db.prepare('SELECT parameters FROM operation_queue WHERE id=?').get(operation.id);
          app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify({...JSON.parse(queued.parameters),consumedValis:0}),operation.id);
          const poisoned=snapshot();assert.equal((await send(undefined,'user_data/confirm')).status,503);assert.deepEqual(snapshot(),poisoned);
          app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(queued.parameters,operation.id);
          const profile=app.store.read('UserProfile').data,member=profile[0];
          assert.equal(Object.hasOwn(member,'familiaId'),false,'The seeded native profile does not need an invented membership id');
          for(const change of [{familiaId:2},{familiaName:'Remote'},{familiaName:null},{userId:0}]) {
            put('UserProfile',[{...member,...change}]);const foreign=snapshot();
            assert.equal((await send(undefined,'user_data/confirm')).status,503);assert.deepEqual(snapshot(),foreign);put('UserProfile',profile);
          }
          for(const change of [{familiaId:1},{familiaName:''}]) {
            put('UserProfile',[{...member,...change}]);const retained=snapshot();
            assert.deepEqual(parse(await request(port,identity,undefined,String(identity),'user_data/confirm')).operations,[recovered]);
            assert.deepEqual(snapshot(),retained,'Optional offline id and delayed native label retain the existing owned membership');put('UserProfile',profile);
          }
          app.store.db.prepare('INSERT INTO familia_name_history(name) VALUES(?)').run('BeforeRename');
          put('UserProfile',[{...member,familiaName:'BeforeRename'}]);const renamed=snapshot();
          assert.deepEqual(parse(await request(port,identity,undefined,String(identity),'user_data/confirm')).operations,[recovered]);
          assert.deepEqual(snapshot(),renamed,'An actual recorded previous name preserves the settled local membership');put('UserProfile',profile);
          app.store.db.prepare('DELETE FROM familia_name_history WHERE name=?').run('BeforeRename');
          const owned=app.store.db.prepare('SELECT owner_id,settings FROM local_familia WHERE id=1').get();
          for(const change of [{owner_id:0,settings:owned.settings},{owner_id:owned.owner_id,settings:'{'}]) {
            app.store.db.prepare('UPDATE local_familia SET owner_id=?,settings=? WHERE id=1').run(change.owner_id,change.settings);
            const foreign=snapshot();assert.equal((await send(undefined,'user_data/confirm')).status,503);assert.deepEqual(snapshot(),foreign);
            app.store.db.prepare('UPDATE local_familia SET owner_id=?,settings=? WHERE id=1').run(owned.owner_id,owned.settings);
          }
          if(!partialReceipt.charge_seen) {
            const currencies=app.store.read('UserCurrency').data;
            for(const change of [{amount:funded.amount-1},{amount:funded.amount-operation.parameters.consumedValis},
              {amount:funded.amount+1},{cumulativeAmount:funded.cumulativeAmount+1}]) {
              put('UserCurrency',currencyRows({...funded,...change}));const ambiguous=snapshot();
              assert.equal((await send(undefined,'user_data/confirm')).status,503);assert.deepEqual(snapshot(),ambiguous,
                'Counter-only replay cannot guess a missing charge flag, spend, refund or coalesced gain from an altered wallet');
              put('UserCurrency',currencies);
            }
            app.store.db.prepare('UPDATE familia_valis_donation SET spending_ceiling=? WHERE operation_id=?')
              .run(partialReceipt.amount_before-partialReceipt.cumulative_before-partialReceipt.amount-1,operation.id);
            const coalesced=snapshot();assert.equal((await send(undefined,'user_data/confirm')).status,503);assert.deepEqual(snapshot(),coalesced,
              'A lower captured expenditure bound cannot become a standalone unpaid donation debit');
            app.store.db.prepare('UPDATE familia_valis_donation SET spending_ceiling=? WHERE operation_id=?')
              .run(partialReceipt.spending_ceiling??null,operation.id);
          }
          await close();await open();const retained=snapshot();
          assert.deepEqual((await request(port,identity,undefined,String(identity),'user_data/confirm')).body,cold.body);
          assert.deepEqual(snapshot(),retained,'Current derived donation replies survive restart exactly without writes');
        }
        for(const changes of [{before_counters:null,counter_seen:'[]'},
          {before_counters:JSON.stringify(nativeCounters),counter_seen:'[]'},
          {before_counters:JSON.stringify(initialCounters),counter_seen:JSON.stringify([{donationId:24000001,count:'yes',date:false}])},
          {before_counters:JSON.stringify(initialCounters),counter_seen:JSON.stringify([{donationId:999,count:true,date:false}])}]) {
          app.store.db.prepare('UPDATE familia_valis_donation SET before_counters=?,counter_seen=?').run(changes.before_counters,changes.counter_seen);
          const corrupt=snapshot();assert.equal((await send(save({}),'user_data/push')).status,503);assert.deepEqual(snapshot(),corrupt);
          app.store.db.prepare('UPDATE familia_valis_donation SET before_counters=?,counter_seen=?').run(partialReceipt.before_counters,partialReceipt.counter_seen);
        }
        const owner=snapshot(),wrongOwner=app.store.read('UserFamiliaValisDonation').data.map((row,i)=>i?row:{...row,userId:0});
        assert.equal((await send(save({UserFamiliaValisDonation:wrongOwner}),'user_data/push')).status,400);assert.deepEqual(snapshot(),owner);
        if(partialReceipt.charge_seen) {
          assert.equal((await send(save({UserCurrency:currencyRows(funded)}),'user_data/push')).status,400);assert.deepEqual(snapshot(),owner);
        } else {
          assert.equal((await send(save({UserFamiliaValisDonation:initialCounters}),'user_data/push')).status,400);assert.deepEqual(snapshot(),owner,
            'An observed count or timestamp cannot return to the captured before state');
        }
        if(mode==='midnight') {
          now=(Math.floor((now+32400)/86400)+1)*86400-32400;
          for(const row of nativeCounters) row.count=0;
        }
      }
      const savedCharge=['cost-first','midnight'].includes(mode) || mode.startsWith('paid-'),beforeAckCurrency=app.store.read('UserCurrency'),
        final=save(mode==='paid-complete'?{}:savedCharge?{UserFamiliaValisDonation:nativeCounters}:
          {UserCurrency:currencyRows(nativeCost),UserFamiliaValisDonation:nativeCounters},[operation]);
      for(const [table,event] of [['profile','UPDATE'],['familia_valis_donation','UPDATE'],['familia_valis_spending_floor','UPDATE'],
        ['operation_done','INSERT'],['reply_cache','INSERT']]) {
        if(mode==='paid-complete' && ['profile','familia_valis_donation'].includes(table)) continue; // ACK-only completion needs no profile/effect write.
        // Old queues have no before-counter fields to record; their real charge observation is already retained.
        if(table==='familia_valis_donation' && mode.startsWith('legacy-')) continue;
        const queued=snapshot();app.store.db.exec(`CREATE TRIGGER valis_recovery_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'donation ACK rollback'); END`);
        assert.equal((await send(final,'user_data/push')).status,503);assert.deepEqual(snapshot(),queued);app.store.db.exec('DROP TRIGGER valis_recovery_ack_fail');
      }
      const acknowledged=await send(final,'user_data/push'),ackSequence=sequence;parse(acknowledged);
      if(savedCharge) assert.deepEqual(app.store.read('UserCurrency'),beforeAckCurrency,'Remaining counters or ACK alone never rewrite the saved currency row/token/signature');
      assert.deepEqual(app.store.operations(),[]);assert.equal(bank().valis,operation.parameters.consumedValis);assert.equal(receiptCount(),1);
      assert.equal(app.store.familiaValisSpendingFloor().ceiling,-operation.parameters.consumedValis);
      const complete=snapshot();await close();await open();assert.deepEqual(snapshot(),complete);
      assert.deepEqual((await request(port,ackSequence,final,String(ackSequence),'user_data/push')).body,acknowledged.body);
      assert.equal((await request(port,issueSequence,donate,String(issueSequence),'familia/donate/valis')).status,503);assert.deepEqual(snapshot(),complete,
        'A settled cached donation response cannot redeliver22100 or credit the bank again');
    }
    console.log('Familia Valis: archived options/caps, bank transfer, rollback/replay, paid zero-debit counter/ACK recovery, stale-save rejection, midnight reset and split-save restart: OK');
  } finally {
    crypto.randomInt=realRandomInt;
    await close();
    assert.equal(fs.realpathSync(path.dirname(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-familia-valis-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
