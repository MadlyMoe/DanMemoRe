'use strict';

// WRITTEN ONLY / NOT RUN in the implementation-only phase; a later pass is not native acceptance.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request, drawAcknowledgement } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-event-box-'));
  const realNow = Date.now, realRandomInt = crypto.randomInt;
  let database = path.join(directory, 'profile.sqlite'), app, port, sequence = 0, forcedRoll = 0;
  const open = async () => {
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => {
    if (app?.server.listening) await new Promise(resolve => app.server.close(resolve));
    app?.store.close(); app = null;
  };
  const send = (value, action = 'event_box/draw') => request(port, ++sequence, value, String(sequence), action);
  const show = (value = { eventBoxId: 193000001, eventBoxStepId: 194000001 }) => send(value, 'event_box/show');
  const snapshot = () => ({ profiles: app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),
    operations: app.store.operations(), claims: app.store.db.prepare('SELECT * FROM event_box_claim ORDER BY step_id,content_id').all(),
    laps: app.store.db.prepare('SELECT * FROM event_box_lap_claim ORDER BY step_id,content_id,lapped_count').all(),
    rewards: app.store.db.prepare('SELECT * FROM event_box_reward_claim ORDER BY operation_id,item_id').all(),
    requests: app.store.db.prepare('SELECT * FROM event_box_request ORDER BY operation_id').all(),
    deliveries: app.store.db.prepare('SELECT * FROM event_box_delivery ORDER BY operation_id').all(),
    done: app.store.db.prepare('SELECT * FROM operation_done ORDER BY id').all() });
  // Synthetic deltas test our SQLite boundary, not native prize application.
  const save = (putItems = {}, operations = [], deleteItems = {}, trigger = 'EventBoxDraw') => ({ badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: Object.fromEntries([...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])]
      .map(name => [name, crypto.createHash('md5').update(JSON.stringify(putItems[name] ?? [])).digest('hex')])) },
    deltas: Object.keys(putItems).length + Object.keys(deleteItems).length ? [{ signature: 0, trigger, deleteItems, putItems }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })) });
  const stock = amount => ({ userId: seed.userId, eventItemId: 290000028, signature: 0, amount, cumulativeAmount: 1000, bookEntryState: 1 });
  const box = (totalDrawCount, currentStepId = 194000001) => ({ userId: seed.userId, eventBoxId: 193000001, currentStepId, totalDrawCount });
  const body = { eventBoxId: 193000001, drawCount: 10 };
  const rewardDelta = result => {
    const amounts = new Map(), putItems = {};
    for (const row of result.chosenItems) amounts.set(row.itemId, (amounts.get(row.itemId) ?? 0) + row.amount);
    for (const [id, amount] of amounts) {
      const { table, idField } = master.itemProfiles[id];
      const previous = app.store.read(table).data.find(row => row[idField] === id) ??
        { userId: seed.userId, [idField]: id, signature: 0, bookEntryState: 3, cumulativeAmount: 0,
          ...(table==='UserKeyItem'?{reservedAmount:0,exploit:false}:
            ['UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial'].includes(table)?{reservedAmount:0}:{}) };
      const row = { ...previous, cumulativeAmount: Math.min(999999999,previous.cumulativeAmount + amount),signature:result.operations[0].signature };
      if (table === 'UserGachaTicket') row.dateList = [...(previous.dateList ?? []),
        ...Array.from({ length: amount }, () => ({ aquiredAt: Math.floor(Date.now() / 1000) }))];
      else row.amount = Math.min(table==='UserCurrency' && id===205000002?2000000000:999999999,(previous.amount ?? 0)+amount);
      (putItems[table] ??= []).push(row);
    }
    return putItems;
  };
  const countDelta = (result, remaining, total) => ({ UserEventItem: [stock(remaining)], UserEventBox: [box(total)],
    UserEventBoxContent: result.UserEventBoxContent, UserEventBoxStep: result.UserEventBoxStep });
  const applyCounts = (result, remaining, total) => ({ ...countDelta(result, remaining, total), ...rewardDelta(result) });
  try {
    Date.now = () => Date.parse('2017-10-25T12:00:00Z');
    crypto.randomInt = (...args) => args.length === 1 ? Math.min(forcedRoll,args[0]-1) : realRandomInt(...args);
    await open();
    const beforeShow = snapshot(), firstShow = await show();
    assert.equal(firstShow.status, 200);
    const rates = JSON.parse(firstShow.body).currentStepContents;
    assert.equal(rates.length, 25);
    assert.equal(rates[0].rate, 0.01, 'Native wire probabilities are fractions, not percentages');
    assert.ok(Math.abs(rates.reduce((sum, row) => sum + row.rate, 0) - 1) < 1e-12);
    assert.deepEqual(snapshot(), beforeShow, 'Inspecting a box does not create profile rows or consume anything');
    for (const value of [null, {}, { eventBoxId: 193000001, eventBoxStepId: 194000002 },
      { eventBoxId: 1, eventBoxStepId: 194000001 }, { eventBoxId: '193000001', eventBoxStepId: 194000001 },
      { eventBoxId: 193000001, eventBoxStepId: 194000001, extra: 0 }]) assert.equal((await show(value)).status, 400);
    assert.equal((await send(body)).status, 400);
    app.store.push(save({ UserEventItem: [stock(1000)] }));
    const before = snapshot();
    for (const value of [null, {}, { ...body, drawCount: 0 }, { ...body, drawCount: -1 }, { ...body, drawCount: 101 },
      { ...body, drawCount: 1.5 }, { ...body, drawCount: '1' }, { ...body, eventBoxId: '193000001' },
      { ...body, eventBoxId: 1 }, { ...body, extra: 1 }]) {
      assert.equal((await send(value)).status, 400);
      assert.deepEqual(snapshot(), before);
    }
    Date.now = () => (master.eventBoxes[193000001].startAt - 1) * 1000;
    assert.equal((await send(body)).status, 400);
    Date.now = () => (master.eventBoxes[193000001].endAt + 1) * 1000;
    assert.equal((await send(body)).status, 400);
    Date.now = () => master.eventBoxes[193000001].startAt * 1000;
    for (const table of ['operation_queue','event_box_request','event_box_claim','event_box_reward_claim']) {
      app.store.db.exec(`CREATE TRIGGER fail_box BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'box failure'); END`);
      assert.equal((await send(body)).status, 503);
      assert.deepEqual(snapshot(), before, 'Queue, reservations and counts roll back together');
      app.store.db.exec('DROP TRIGGER fail_box');
    }
    const response = await send(body);
    assert.equal(response.status, 200, response.body.toString());
    const result = JSON.parse(response.body), award = result.operations[0];
    assert.equal(award.type, 15000);
    assert.deepEqual(result.consumedItem, { itemId: 290000028, amount: 100 });
    assert.deepEqual(result.chosenItems.map(row => row.eventBoxContentId), [195000001,195000002,
      195000003,195000003,195000003,195000003,195000003,195000004,195000004,195000004]);
    assert.deepEqual(result.UserEventBoxContent.map(row => row.pickedAmount), [1,1,5,3]);
    assert.equal(result.UserEventBoxStep[0].drawCount, 10);
    assert.equal(result.UserEventBoxStep[0].boost, false);
    assert.equal(result.currentStepContents[0].rate, 0);
    assert.equal(result.currentStepContents[3].rate, 2000 / 9350);
    assert.equal(app.store.read('UserEventItem').data[0].amount, 1000, 'Native operation consumes tickets once');
    assert.equal(app.store.read('UserEventBoxContent').data.length, 0, 'Prize counts stay queued until native application');
    assert.equal(snapshot().requests[0].total_count, 100, 'Misnamed totalDrawCount increases by cost, not draw count');
    const queued = snapshot();
    const untouchedProjection=app.store.eventBoxColdRecovery(award);
    assert.ok(untouchedProjection.parameters.chosenItems.every(row=>
      row.offlineEventBoxLifetimeControl===row.amount+1));
    const futureRewardProjection=structuredClone(untouchedProjection);
    futureRewardProjection.parameters.chosenItems[0].amount=0;
    futureRewardProjection.parameters.chosenItems[0].offlineEventBoxLifetimeControl=1;
    assert.throws(()=>app.store.eventBoxColdRecovery(award,futureRewardProjection),/recovery envelope/,
      'A cached projection cannot claim reward progress newer than the retained native save');
    const legacyFutureRewardProjection=structuredClone(award);
    legacyFutureRewardProjection.parameters.chosenItems[0].amount=0;
    assert.throws(()=>app.store.eventBoxColdRecovery(award,legacyFutureRewardProjection),/recovery envelope/,
      'An older control-free projection cannot claim reward progress newer than the retained native save');
    const futureCostProjection=structuredClone(untouchedProjection);
    futureCostProjection.parameters.consumedItem.amount=0;
    assert.throws(()=>app.store.eventBoxColdRecovery(award,futureCostProjection),/recovery envelope/,
      'A cached projection cannot claim a ticket debit newer than the retained native save');
    assert.deepEqual(JSON.parse((await show()).body).currentStepContents, result.currentStepContents);
    assert.deepEqual(JSON.parse((await send({ drawCount: 10, eventBoxId: 193000001 })).body), result);
    assert.equal((await send({ ...body, drawCount: 1 })).status, 400);
    assert.throws(() => app.store.push(save({}, [award])), /ticket consumption/);
    assert.throws(() => app.store.push(save({ UserEventItem: [stock(900)], UserEventBox: [box(100)] }, [award])), /prize counts/);
    assert.throws(() => app.store.push(save(applyCounts(result, 900, 10), [award])), /ticket consumption/);
    assert.throws(() => app.store.push(save(applyCounts(result, null, 100), [award])), /ticket consumption/);
    for(const userId of [0,1]) assert.throws(() => app.store.push(save({ ...applyCounts(result, 900, 100),
      UserEventItem: [{ ...stock(900), userId }] }, [award])), /ticket consumption|delivery ownership/,
    'Default native box ownership never relaxes actual ticket ownership');
    assert.throws(() => app.store.push(save({ ...applyCounts(result, 900, 100),
      UserEventBoxStep: result.UserEventBoxStep.map(row=>({ ...row,boost:true })) }, [award])), /prize counts/,
    'Correct integer counters cannot acknowledge a different native boost flag');
    assert.throws(() => app.store.push(save(countDelta(result, 900, 100), [award])), /reward inventory/,
      'Counters alone cannot discard awarded inventory');
    const targets = snapshot().rewards, validDelta = applyCounts(result, 900, 100);
    for (const target of targets) {
      for (const changes of [{ userId: 0 }, { userId: 2 }, { cumulativeAmount: target.cumulative_amount - 1 },
        { cumulativeAmount: '1' }, { cumulativeAmount: 1000000000 },
        ...(target.table_name === 'UserGachaTicket' ? [{ dateList: null }, { dateList: [{ aquiredAt: '1' }] }] : [{ amount: -1 }])]) {
        const invalid = { ...validDelta, [target.table_name]: validDelta[target.table_name].map(row =>
          row[target.id_field] === target.item_id ? { ...row, ...changes } : row) };
        assert.throws(() => app.store.push(save(invalid, [award])), /reward inventory/);
      }
    }
    assert.deepEqual(snapshot(), queued);
    await close(); await open();
    assert.deepEqual(snapshot(), queued);
    Date.now = () => (master.eventBoxes[193000001].endAt + 1) * 1000;
    assert.deepEqual(JSON.parse((await send(body)).body), result, 'Pending recovery remains possible after the draw window ends');
    Date.now = () => master.eventBoxes[193000001].endAt * 1000;
    app.store.db.exec("CREATE TRIGGER fail_save BEFORE DELETE ON operation_queue BEGIN SELECT RAISE(ABORT,'save failure'); END");
    assert.throws(() => app.store.push(save(applyCounts(result, 900, 100), [award])), /save failure/);
    assert.deepEqual(snapshot(), queued);
    app.store.db.exec('DROP TRIGGER fail_save');
    app.store.db.exec("CREATE TRIGGER fail_box_effect BEFORE UPDATE ON event_box_request BEGIN SELECT RAISE(ABORT,'effect failure'); END");
    assert.throws(()=>app.store.push(save(applyCounts(result,900,100))),/effect failure/);
    assert.deepEqual(snapshot(),queued,'Effect marker and profile saves roll back together');
    app.store.db.exec('DROP TRIGGER fail_box_effect');
    const savedResponse=await send(save(applyCounts(result,900,100)),'user_data/push');
    assert.equal(savedResponse.status,200,savedResponse.body.toString());
    assert.ok(!JSON.parse(savedResponse.body).operations.some(row=>row.type===15000),
      'A save reply must not reapply the additive ticket consumption');
    assert.equal(snapshot().requests[0].effect_seen,1);
    await close(); await open();
    const partial=snapshot();
    const recovered=await send(body);assert.equal(recovered.status,200,recovered.body.toString());
    const recoveredBody=JSON.parse(recovered.body),recoveredOperation=recoveredBody.operations.find(row=>row.id===award.id);
    assert.equal(recoveredOperation.parameters.consumedItem.amount,0);
    assert.ok(!Object.hasOwn(recoveredOperation.parameters,'offlineEventBoxCounterControl'));
    assert.ok(recoveredOperation.parameters.chosenItems.every(row=>row.amount===0 && row.offlineEventBoxLifetimeControl===-1));
    assert.deepEqual(app.store.eventBoxColdRecovery(award,untouchedProjection),recoveredOperation,
      'A valid older cached projection is replaced by the current retained remainder');
    for(const action of ['user/login','user_data/pull','user_data/confirm']) {
      assert.equal(app.store.eventBoxDelivery(award,action),true);
      assert.deepEqual(app.store.eventBoxColdRecovery(award),recoveredOperation);
    }
    for(const control of [-2,0,'1',award.parameters.chosenItems[0].amount+2]) {
      const malformed=structuredClone(recoveredOperation);
      malformed.parameters.chosenItems[0].offlineEventBoxLifetimeControl=control;
      assert.throws(()=>app.store.eventBoxColdRecovery(award,malformed),/recovery envelope/);
    }
    const falseComplete=structuredClone(recoveredOperation);
    falseComplete.parameters.chosenItems[0].amount=award.parameters.chosenItems[0].amount;
    assert.throws(()=>app.store.eventBoxColdRecovery(award,falseComplete),/recovery envelope/);
    if(recoveredOperation.parameters.chosenItems.length>1) {
      const mixed=structuredClone(recoveredOperation);
      delete mixed.parameters.chosenItems[0].offlineEventBoxLifetimeControl;
      assert.throws(()=>app.store.eventBoxColdRecovery(award,mixed),/recovery envelope/);
    }
    assert.deepEqual(snapshot(),partial,'Cold projection retains the save, queue and prize entitlement');
    app.store.push(save({}, [award])); app.store.push(save({}, [award]));
    assert.equal(snapshot().requests.length, 0);
    assert.equal(snapshot().claims.length, 4);
    assert.deepEqual(snapshot().rewards, targets, 'Completed reward acquisition receipts remain durable');
    const reward = targets[0], inventory = app.store.read(reward.table_name).data.find(row => row[reward.id_field] === reward.item_id);
    const settled = snapshot();
    assert.throws(() => app.store.reservedItemAcquisition(reward.item_id, 0), /older than a completed/,
      'A corrupted acquisition baseline cannot queue an impossible later award');
    assert.throws(() => app.store.push(save({ [reward.table_name]: [{ ...inventory, cumulativeAmount: reward.cumulative_amount - 1 }] })),
      /cannot be removed or rewound/);
    assert.throws(() => app.store.push(save({}, [], { [reward.table_name]: [{ [reward.id_field]: reward.item_id }] })),
      /cannot be removed or rewound/);
    assert.deepEqual(snapshot(), settled);
    app.store.push(save({ [reward.table_name]: [{ ...inventory,
      ...(reward.table_name === 'UserGachaTicket' ? { dateList: [] } : { amount: 0 }) }] }));
    assert.deepEqual(JSON.parse((await show()).body).currentStepContents, result.currentStepContents);
    const next = JSON.parse((await send(body)).body);
    assert.notEqual(next.operations[0].id, award.id);
    assert.ok(next.chosenItems.every(row => row.eventBoxContentId === 195000004), 'Exhausted finite prizes stay exhausted');
    assert.equal(next.UserEventBoxContent[0].pickedAmount, 13);
    app.store.push(save(applyCounts(next, 800, 200), next.operations));
    const final = JSON.parse((await send(body)).body);
    assert.deepEqual(final.chosenItems.map(row => row.eventBoxContentId), [195000004,195000004,...Array(8).fill(195000005)]);
    assert.deepEqual(final.UserEventBoxContent.map(row => row.pickedAmount), [15,8]);
    app.store.push(save(applyCounts(final, 700, 300), final.operations));
    const firstCount = app.store.read('UserEventBoxContent').data.find(row => row.eventBoxContentId === 195000001);
    const stale = snapshot();
    assert.throws(() => app.store.push(save({ UserEventBoxContent: [{ ...firstCount, pickedAmount: 0 }] })), /cannot regress/,
      'Old client counts cannot replenish a claimed limited prize');
    assert.deepEqual(snapshot(), stale);
    app.store.push(save({ UserEventItem: [stock(9)] }));
    assert.equal((await send({ ...body, drawCount: 1 })).status, 400);
    app.store.push(save({ UserEventItem: [stock(10)] }));
    const last = JSON.parse((await send({ ...body, drawCount: 1 })).body);
    app.store.push(save({ ...rewardDelta(last), UserEventBox: [box(310)], UserEventBoxContent: last.UserEventBoxContent,
      UserEventBoxStep: last.UserEventBoxStep }, last.operations, { UserEventItem: [{ eventItemId: 290000028 }] }));
    assert.equal(app.store.read('UserEventItem').data.length, 0, 'Deleting an exhausted ticket stack is valid');
    await close(); await open();
    assert.equal(app.store.read('UserEventBox').data[0].totalDrawCount, 310);
    assert.equal(snapshot().claims.find(row => row.content_id === 195000005).picked_amount, 9);
    const unsupportedBox = Object.entries(master.eventBoxes).find(([, b]) => b.steps[0].boostEnabled);
    assert.equal((await show({ eventBoxId: Number(unsupportedBox[0]), eventBoxStepId: unsupportedBox[1].steps[0].id })).status, 200,
      'An enabled boost catalog is not an already-boosted saved round');
    const step = app.store.read('UserEventBoxStep').data[0];
    app.store.push(save({ UserEventBoxStep: [{ ...step, lappedCount: 1 }] }));
    assert.equal((await show()).status, 503, 'Unrecovered step-level lap metadata remains unavailable');
    // Synthetic jump to the original final repeatable step; this is NOT
    // evidence of native traversal through all 16 rounds. Native reset fields
    // are from0x2414224 and the EventBoxReset caller0x16a903c.
    const finalStep = master.eventBoxes[193000001].steps.at(-1), special = finalStep.contents[0];
    assert.equal(finalStep.repeatable, 1); assert.equal(special.requiredForReset, 1);
    app.store.push(save({ UserEventBox: [box(310, finalStep.id)], UserEventItem: [stock(1000)] }));
    const showFinal = () => show({ eventBoxId: 193000001, eventBoxStepId: finalStep.id });
    const lapRow = { userId: seed.userId, eventBoxContentId: special.id, eventBoxStepId: finalStep.id,
      pickedAmount: 0, lappedCount: 1, rateVariationState: 2 };
    assert.throws(() => app.store.push(save({ UserEventBoxContent: [lapRow] })), /invent earlier rounds/);
    app.store.push(save({ UserEventBoxContent: [{ ...lapRow, lappedCount: 0, rateVariationState: 0 }] }));
    assert.throws(() => app.store.push(save({ UserEventBoxContent: [lapRow] })), /reset prizes/,
      'Missing special prize cannot unlock a repeat reset');
    let finalTotal = 310, finalStock = 1000;
    const applyFinal = result => {
      finalTotal += result.consumedItem.amount; finalStock -= result.consumedItem.amount;
      app.store.push(save({ ...rewardDelta(result), UserEventBox: [box(finalTotal, finalStep.id)], UserEventItem: [stock(finalStock)],
        UserEventBoxContent: result.UserEventBoxContent, UserEventBoxStep: result.UserEventBoxStep }, result.operations));
    };
    const drawFinal = async count => {
      const response = await send({ ...body, drawCount: count });
      assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body);
    };
    const firstLap = await drawFinal(1), pendingLap = snapshot();
    assert.throws(() => app.store.push(save({ UserEventBoxContent: [{...lapRow,lappedCount:3}] }, [], {}, 'EventBoxReset')), /advance every/);
    assert.deepEqual(snapshot(), pendingLap, 'An invalid reset cannot replace a pending draw or skip its rounds');
    applyFinal(firstLap);
    assert.equal(firstLap.UserEventBoxContent[0].lappedCount, 0);
    const firstHistory = snapshot().claims.filter(row => row.step_id === finalStep.id);
    assert.deepEqual(firstHistory.map(row => row.picked_amount), [1]);
    const noTicketSpend = finalStock;
    app.store.push(save({ UserEventBoxContent: [lapRow] }, [], {}, 'EventBoxReset'));
    assert.equal(app.store.read('UserEventItem').data.find(row => row.eventItemId === 290000028).amount, noTicketSpend);
    assert.deepEqual(snapshot().claims.filter(row => row.step_id === finalStep.id), firstHistory, 'Round0 ledger is never deleted');
    const resetProfile = snapshot();
    assert.throws(() => app.store.push(save({ UserEventBoxContent: [{ ...lapRow, lappedCount: 0 }] })), /rewound/);
    assert.throws(() => app.store.push(save({ UserEventBoxContent: [{ ...lapRow, lappedCount: 3 }] })), /repeat reset/);
    assert.throws(() => app.store.push(save({}, [], { UserEventBoxContent: [lapRow] })), /removed/);
    assert.deepEqual(snapshot(), resetProfile);
    // WRITTEN ONLY / NOT RUN: the next draw imports a positive step lap only from the proved native content reset.
    assert.equal(app.store.read('UserEventBoxStep').data.find(row => row.eventBoxStepId === finalStep.id).lappedCount,0);
    await close(); await open();
    assert.ok(JSON.parse((await showFinal()).body).currentStepContents.find(row => row.contentId === special.id).rate > 0,
      'A legitimate saved reset restores the finite prize in the next round');
    const beforeLapDraw = snapshot();
    for (const table of ['event_box_lap_claim','event_box_reward_claim','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER lap_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'lap failure'); END`);
      assert.equal((await send({ ...body, drawCount: 10 })).status, 503);
      assert.deepEqual(snapshot(), beforeLapDraw);
      app.store.db.exec('DROP TRIGGER lap_fail');
    }
    const secondLap = await drawFinal(10);
    assert.equal(secondLap.UserEventBoxContent.find(row => row.eventBoxContentId === special.id).lappedCount, 1);
    assert.equal(secondLap.UserEventBoxStep[0].lappedCount, 1, 'Draw advances the step from the saved content reset');
    assert.deepEqual(JSON.parse((await send({ ...body, drawCount: 10 })).body), secondLap);
    await close(); await open();
    assert.deepEqual(JSON.parse((await send({ ...body, drawCount: 10 })).body), secondLap);
    applyFinal(secondLap);
    assert.ok(snapshot().laps.some(row => row.content_id === special.id && row.lapped_count === 1 && row.picked_amount === 1));
    assert.ok(secondLap.UserEventBoxContent.length > 1);
    const resetRows = app.store.read('UserEventBoxContent').data.filter(row => row.eventBoxStepId === finalStep.id)
      .map(row => ({ ...row, pickedAmount: 0, lappedCount: row.lappedCount + 1, rateVariationState: 2 }));
    assert.throws(() => app.store.push(save({ UserEventBoxContent: [resetRows[0]] })), /every existing prize/);
    app.store.push(save({ UserEventBoxContent: resetRows }, [], {}, 'EventBoxReset'));
    const thirdLap = await drawFinal(1); applyFinal(thirdLap);
    assert.equal(thirdLap.UserEventBoxContent[0].lappedCount, 2);
    assert.equal(thirdLap.UserEventBoxStep[0].lappedCount, 2, 'A second saved reset advances one more step lap');
    assert.ok(snapshot().laps.some(row => row.content_id === special.id && row.lapped_count === 2));
    assert.equal(app.store.read('UserEventBoxStep').data.find(row => row.eventBoxStepId === finalStep.id).drawCount, 12,
      'Native repeat reset does not erase the step draw counter');
    await close(); await open();
    assert.deepEqual(app.store.operations(), []);
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    //WRITTEN ONLY / NOT RUN:15000 then2414224 can share one native save/ACK.
    //A newly awarded content row may first save already reset to lap1.
    await close();database=path.join(directory,'combined-reset.sqlite');await open();forcedRoll=0;
    app.store.push(save({UserEventBox:[box(0,finalStep.id)],UserEventItem:[stock(1000)]}));
    let combinedTotal=0,combinedStock=1000;
    for(const order of ['together','resources-first','counts-first']) {
      const reply=await send({...body,drawCount:1});assert.equal(reply.status,200,reply.body.toString());
      const drawn=JSON.parse(reply.body),operation=drawn.operations[0],requestSequence=sequence,
        beforeCounts=app.store.read('UserEventBoxContent').data,
        projected=new Map(beforeCounts.filter(row=>row.eventBoxStepId===finalStep.id).map(row=>[row.eventBoxContentId,row]));
      for(const target of drawn.UserEventBoxContent) projected.set(target.eventBoxContentId,target);
      const reset=[...projected.values()].map(row=>({...row,pickedAmount:0,lappedCount:row.lappedCount+1,rateVariationState:2})),
        total=combinedTotal+drawn.consumedItem.amount,remaining=combinedStock-drawn.consumedItem.amount,
        resources={...rewardDelta(drawn),UserEventBox:[box(total,finalStep.id)],UserEventItem:[stock(remaining)],
          UserEventBoxStep:drawn.UserEventBoxStep},combined={...resources,UserEventBoxContent:reset};
      assert.equal(drawn.UserEventBoxContent[0].eventBoxContentId,special.id);
      if(order==='together') assert.equal(beforeCounts.length,0,'No native first-award row is prewritten');
      for(const candidate of [save({UserEventBoxContent:reset},drawn.operations),
        save({...combined,...Object.fromEntries(Object.keys(rewardDelta(drawn)).map(name=>[name,[]]))},drawn.operations),
        save({...combined,UserEventBoxContent:reset.map(row=>({...row,lappedCount:row.lappedCount+1}))},drawn.operations),
        save({...combined,UserEventBoxContent:reset.map(row=>({...row,rateVariationState:0}))},drawn.operations),
        save({...combined,UserEventBoxContent:reset.map(row=>({...row,userId:2}))},drawn.operations),
        save({...combined,UserEventBoxStep:drawn.UserEventBoxStep.map(row=>({...row,drawCount:row.drawCount-1}))},drawn.operations)]) {
        const before=snapshot(),rejected=await send(candidate,'user_data/push');
        assert.notEqual(rejected.status,200,'Reset cannot replace actual cost, inventory, counter or ACK proof');
        assert.deepEqual(snapshot(),before);
      }
      if(order==='resources-first') {
        const saved=await send(save(resources),'user_data/push');assert.equal(saved.status,200,saved.body.toString());
        await close();await open();
      } else if(order==='counts-first') {
        const saved=await send(save({...resources,UserEventBoxContent:drawn.UserEventBoxContent}),'user_data/push');
        assert.equal(saved.status,200,saved.body.toString());await close();await open();
      }
      const captured=app.store.db.prepare('SELECT draw_state FROM event_box_request WHERE operation_id=?').get(operation.id);
      app.store.db.prepare('UPDATE event_box_request SET draw_state=NULL WHERE operation_id=?').run(operation.id);
      const unknown=snapshot(),legacy=await send(save(combined,drawn.operations),'user_data/push');
      assert.equal(legacy.status,503);assert.deepEqual(snapshot(),unknown);
      app.store.db.prepare('UPDATE event_box_request SET draw_state=? WHERE operation_id=?').run(captured.draw_state,operation.id);
      for(const [table,event] of [['profile','UPDATE'],['event_box_request','UPDATE'],['operation_done','INSERT'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER combined_reset_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'combined reset rollback'); END`);
        const before=snapshot(),failed=await send(save(combined,drawn.operations),'user_data/push');
        assert.equal(failed.status,503);assert.deepEqual(snapshot(),before);app.store.db.exec('DROP TRIGGER combined_reset_fail');
      }
      const candidate=save(combined,drawn.operations,{},'EventBoxReset'),saved=await send(candidate,'user_data/push'),saveSequence=sequence;
      assert.equal(saved.status,200,saved.body.toString());
      combinedTotal=total;combinedStock=remaining;
      assert.deepEqual(app.store.read('UserEventBoxContent').data.filter(row=>row.eventBoxStepId===finalStep.id),reset);
      assert.equal(app.store.read('UserEventBoxStep').data.find(row=>row.eventBoxStepId===finalStep.id).drawCount,
        drawn.UserEventBoxStep[0].drawCount,'Reset does not erase the step draw counter');
      assert.equal(app.store.read('UserEventBox').data[0].totalDrawCount,combinedTotal);
      assert.equal(app.store.read('UserEventItem').data.find(row=>row.eventItemId===290000028).amount,combinedStock);
      assert.ok(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id));
      assert.equal(app.store.operations().length,0);
      assert.equal(app.store.db.prepare('SELECT 1 FROM event_box_request WHERE operation_id=?').get(operation.id),undefined);
      const after=snapshot();await close();await open();assert.deepEqual(snapshot(),after);
      assert.deepEqual((await request(port,saveSequence,candidate,String(saveSequence),'user_data/push')).body,saved.body);
      assert.deepEqual(snapshot(),after,'Retry cannot consume, award or reset again');
      const oldDraw=await request(port,requestSequence,{...body,drawCount:1},String(requestSequence),'event_box/draw');
      assert.equal(oldDraw.status,503);assert.deepEqual(snapshot(),after);
      const shown=await show({eventBoxId:193000001,eventBoxStepId:finalStep.id});assert.equal(shown.status,200);
      assert.ok(JSON.parse(shown.body).currentStepContents.find(row=>row.contentId===special.id).rate>0);
    }
    //Required reset prizes must come from the captured result, not zeroed rows.
    forcedRoll=special.weight;const nonrequiredReply=await send({...body,drawCount:1});forcedRoll=0;
    assert.equal(nonrequiredReply.status,200);const nonrequired=JSON.parse(nonrequiredReply.body),
      prior=app.store.read('UserEventBoxContent').data.filter(row=>row.eventBoxStepId===finalStep.id),
      projection=new Map(prior.map(row=>[row.eventBoxContentId,row]));
    assert.ok(nonrequired.chosenItems.every(row=>row.eventBoxContentId!==special.id));
    for(const target of nonrequired.UserEventBoxContent) projection.set(target.eventBoxContentId,target);
    const unearnedReset=[...projection.values()].map(row=>({...row,pickedAmount:0,lappedCount:row.lappedCount+1,rateVariationState:2})),
      normalSave={...rewardDelta(nonrequired),UserEventBox:[box(combinedTotal+nonrequired.consumedItem.amount,finalStep.id)],
        UserEventItem:[stock(combinedStock-nonrequired.consumedItem.amount)],UserEventBoxStep:nonrequired.UserEventBoxStep,
        UserEventBoxContent:nonrequired.UserEventBoxContent};
    const missingRequired=snapshot(),rejectedReset=await send(save({...normalSave,UserEventBoxContent:unearnedReset},nonrequired.operations),'user_data/push');
    assert.equal(rejectedReset.status,400);assert.deepEqual(snapshot(),missingRequired);
    const normalReply=await send(save(normalSave,nonrequired.operations),'user_data/push');assert.equal(normalReply.status,200);
    //WRITTEN ONLY / NOT RUN: save2414224 before the real15000 ACK, retain its proof across split saves/reopen.
    await close();database=path.join(directory,'split-reset.sqlite');await open();forcedRoll=0;
    app.store.push(save({UserEventBox:[box(0,finalStep.id)],UserEventItem:[stock(1000)]}));
    let splitTotal=0,splitStock=1000;
    for(const order of ['reset-first','resources-reset-first','counts-reset-first','resources-then-reset']) {
      const reply=await send({...body,drawCount:1});assert.equal(reply.status,200);
      const drawn=JSON.parse(reply.body),operation=drawn.operations[0],drawSequence=sequence,
        originalCounts=app.store.read('UserEventBoxContent').data,
        projected=new Map(originalCounts.filter(row=>row.eventBoxStepId===finalStep.id).map(row=>[row.eventBoxContentId,row]));
      for(const target of drawn.UserEventBoxContent) projected.set(target.eventBoxContentId,target);
      const reset=[...projected.values()].map(row=>({...row,userId:order==='resources-reset-first'?0:row.userId,
        pickedAmount:0,lappedCount:row.lappedCount+1,rateVariationState:2})),
        resources={...rewardDelta(drawn),UserEventBox:[box(splitTotal+drawn.consumedItem.amount,finalStep.id)],
          UserEventItem:[stock(splitStock-drawn.consumedItem.amount)],UserEventBoxStep:drawn.UserEventBoxStep};
      if(order==='reset-first') assert.equal(originalCounts.length,0,'First native content save may already be reset');
      if(order==='counts-reset-first' || order==='resources-then-reset') {
        const preliminary=order==='counts-reset-first'?{UserEventBoxContent:drawn.UserEventBoxContent}:resources,
          saved=await send(save(preliminary),'user_data/push');assert.equal(saved.status,200);
        await close();await open();
      }
      const resetCandidate=save({...(order==='resources-reset-first'?resources:{}),UserEventBoxContent:reset},[],{},'EventBoxReset');
      for(const [table,event] of [['profile','UPDATE'],['event_box_request','UPDATE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER split_reset_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'split reset rollback'); END`);
        const before=snapshot(),failed=await send(resetCandidate,'user_data/push');
        assert.equal(failed.status,503);assert.deepEqual(snapshot(),before);app.store.db.exec('DROP TRIGGER split_reset_fail');
      }
      const savedReset=await send(resetCandidate,'user_data/push'),resetSequence=sequence;
      assert.equal(savedReset.status,200,savedReset.body.toString());
      assert.deepEqual(app.store.operations(),drawn.operations,'A reset save cannot synthesize or remove the real ACK');
      assert.equal(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id),undefined);
      const receipt=app.store.db.prepare('SELECT * FROM event_box_request WHERE operation_id=?').get(operation.id),
        proof=JSON.parse(receipt.reset_state);
      assert.equal(receipt.effect_seen,1);assert.equal(proof.policy,'offline-event-box-reset-v1');
      assert.deepEqual(proof.contents,[...projected.values()]);
      assert.deepEqual(app.store.read('UserEventBoxContent').data.filter(row=>row.eventBoxStepId===finalStep.id),reset);
      const retained=snapshot();await close();await open();assert.deepEqual(snapshot(),retained);
      assert.deepEqual((await request(port,resetSequence,resetCandidate,String(resetSequence),'user_data/push')).body,savedReset.body);
      assert.deepEqual(snapshot(),retained,'Exact reset-save retry must not advance another lap');
      const oldDraw=await request(port,drawSequence,{...body,drawCount:1},String(drawSequence),'event_box/draw');
      assert.equal(oldDraw.status,200,oldDraw.body.toString());
      const recoveredReset=JSON.parse(oldDraw.body);
      assert.deepEqual(recoveredReset.UserEventBoxContent,drawn.UserEventBoxContent,'Draw-result display retains the original awarded rows');
      assert.deepEqual(recoveredReset.operations[0].parameters.UserEventBoxContent,[],
        'The queued callback omits the already-retained reset rows');
      assert.deepEqual(snapshot(),retained,'Saved reset recovery must not advance another lap');
      for(const candidate of [save({UserEventBoxContent:drawn.UserEventBoxContent}),
        save({UserEventBoxContent:reset.map(row=>({...row,lappedCount:row.lappedCount+1}))}),
        save({UserEventBoxContent:reset.map(row=>({...row,pickedAmount:1}))}),
        save({UserEventBoxContent:reset.map(row=>({...row,rateVariationState:0}))}),
        save({UserEventBoxContent:reset.map(row=>({...row,userId:2}))}),
        save({},[],{UserEventBoxContent:reset})]) {
        const before=snapshot(),rejected=await send(candidate,'user_data/push');
        assert.notEqual(rejected.status,200);assert.deepEqual(snapshot(),before);
      }
      if(['reset-first','counts-reset-first'].includes(order)) {
        const noResources=snapshot(),early=await send(save({},drawn.operations),'user_data/push');
        assert.equal(early.status,400);assert.deepEqual(snapshot(),noResources,'Retained reset proof is not reward or spending proof');
        assert.equal(app.store.read('UserEventBox').data[0].totalDrawCount,splitTotal);
        assert.equal(app.store.read('UserEventItem').data.find(row=>row.eventItemId===290000028).amount,splitStock);
      }
      for(const corrupt of ['{',JSON.stringify({...proof,policy:'unknown'}),JSON.stringify({...proof,contents:[]}),
        JSON.stringify({...proof,contents:proof.contents.map(row=>({...row,lappedCount:row.lappedCount+1}))}),
        JSON.stringify({...proof,contents:proof.contents.map(row=>({...row,userId:2}))})]) {
        app.store.db.prepare('UPDATE event_box_request SET reset_state=? WHERE operation_id=?').run(corrupt,operation.id);
        const before=snapshot(),rejected=await send(save(resources,drawn.operations),'user_data/push');
        assert.equal(rejected.status,503);assert.deepEqual(snapshot(),before);
      }
      app.store.db.prepare('UPDATE event_box_request SET reset_state=? WHERE operation_id=?').run(receipt.reset_state,operation.id);
      app.store.db.prepare('UPDATE event_box_request SET reset_state=NULL WHERE operation_id=?').run(operation.id);
      const lostProof=snapshot(),unproven=await send(save(resources,drawn.operations),'user_data/push');
      assert.notEqual(unproven.status,200);assert.deepEqual(snapshot(),lostProof,'A lost reset capture cannot be inferred from reset rows');
      app.store.db.prepare('UPDATE event_box_request SET reset_state=? WHERE operation_id=?').run(receipt.reset_state,operation.id);
      app.store.db.prepare('UPDATE event_box_request SET effect_seen=0 WHERE operation_id=?').run(operation.id);
      const unseen=snapshot(),invalidObservation=await send(save(resources,drawn.operations),'user_data/push');
      assert.equal(invalidObservation.status,503);assert.deepEqual(snapshot(),unseen);
      app.store.db.prepare('UPDATE event_box_request SET effect_seen=1 WHERE operation_id=?').run(operation.id);
      const finalCandidate=save(['reset-first','counts-reset-first'].includes(order)?resources:{},drawn.operations);
      for(const [table,event] of [['operation_done','INSERT'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER split_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'split ACK rollback'); END`);
        const before=snapshot(),failed=await send(finalCandidate,'user_data/push');
        assert.equal(failed.status,503);assert.deepEqual(snapshot(),before);app.store.db.exec('DROP TRIGGER split_ack_fail');
      }
      const acknowledged=await send(finalCandidate,'user_data/push'),ackSequence=sequence;
      assert.equal(acknowledged.status,200,acknowledged.body.toString());
      splitTotal+=drawn.consumedItem.amount;splitStock-=drawn.consumedItem.amount;
      assert.ok(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id));
      assert.equal(app.store.operations().length,0);
      assert.equal(app.store.db.prepare('SELECT 1 FROM event_box_request WHERE operation_id=?').get(operation.id),undefined);
      assert.deepEqual(app.store.read('UserEventBoxContent').data.filter(row=>row.eventBoxStepId===finalStep.id),reset);
      assert.equal(app.store.read('UserEventBoxStep').data.find(row=>row.eventBoxStepId===finalStep.id).drawCount,drawn.UserEventBoxStep[0].drawCount);
      assert.equal(app.store.read('UserEventBox').data[0].totalDrawCount,splitTotal);
      assert.equal(app.store.read('UserEventItem').data.find(row=>row.eventItemId===290000028).amount,splitStock);
      const done=snapshot();await close();await open();assert.deepEqual(snapshot(),done);
      assert.deepEqual((await request(port,ackSequence,finalCandidate,String(ackSequence),'user_data/push')).body,acknowledged.body);
      assert.deepEqual(snapshot(),done,'Real ACK retry must not spend or award again');
      assert.equal((await show({eventBoxId:193000001,eventBoxStepId:finalStep.id})).status,200);
    }
    // Original10/50/100 UI settings can clamp to smaller affordable batches.
    // These funded fixtures cover source limits/persistence, NOT native UI.
    const bulkBoxes=[['193000001',master.eventBoxes[193000001]],
      ...[5,10].map(cost=>Object.entries(master.eventBoxes).find(([,b])=>b.cost===cost && b.steps[0].boostEnabled && !b.bonusKey))];
    for(const [idString,original] of bulkBoxes) {
      await close();database=path.join(directory,`bulk-${idString}.sqlite`);Date.now=()=>original.startAt*1000;await open();
      const id=Number(idString),step=original.steps[0],costId=master.items[original.costKey],special=step.contents[0];
      const tickets={...stock(10000),eventItemId:costId,cumulativeAmount:10000};
      app.store.push(save({UserEventItem:[tickets],UserEventBox:[{...box(250*original.cost,step.id),eventBoxId:id,userId:0}],
        UserEventBoxStep:[{userId:0,eventBoxStepId:step.id,drawCount:250,lappedCount:0,boost:false}]}));
      forcedRoll=step.boostEnabled?special.weight:0;
      for(const count of [50,100,47,11,2,99]) {
        const before=snapshot(),savedBox=app.store.read('UserEventBox').data[0],savedStep=app.store.read('UserEventBoxStep').data[0];
        if(count===100) {
          app.store.push(save({UserEventItem:[{...tickets,amount:original.cost*count-1}]}));
          const short=snapshot();assert.equal((await send({eventBoxId:id,drawCount:count})).status,400);
          assert.deepEqual(snapshot(),short,'An affordable clamp never permits a full100 debit with insufficient tickets');
          app.store.push(save({UserEventItem:[tickets]}));
          for(const table of ['operation_queue','event_box_request','event_box_claim','event_box_reward_claim','reply_cache']) {
            const atomic=snapshot();
            app.store.db.exec(`CREATE TRIGGER fail_bulk BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'bulk failure'); END`);
            assert.equal((await send({eventBoxId:id,drawCount:count})).status,503);
            assert.deepEqual(snapshot(),atomic,'Bulk policy/cost/prizes/queue/reply must roll back together');
            app.store.db.exec('DROP TRIGGER fail_bulk');
          }
        }
        const value={eventBoxId:id,drawCount:count},response=await send(value);assert.equal(response.status,200,response.body.toString());
        const drawn=JSON.parse(response.body),receipt=snapshot().requests[0],capture=JSON.parse(receipt.draw_state);
        assert.equal(drawn.chosenItems.length,count);assert.equal(drawn.consumedItem.amount,original.cost*count);
        assert.equal(drawn.UserEventBoxStep[0].drawCount,savedStep.drawCount+count);
        assert.equal(receipt.total_count,savedBox.totalDrawCount+original.cost*count);
        assert.deepEqual(capture.beforeStep,savedStep);assert.deepEqual(app.store.read('UserEventBoxStep').data[0],savedStep);
        if(step.boostEnabled) {
          assert.equal(drawn.UserEventBoxStep[0].boost,count===50);
          assert.equal(drawn.chosenItems.filter(row=>row.eventBoxContentId===special.id).length,count===100?1:0);
        }
        const queued=snapshot();assert.deepEqual(JSON.parse((await send(value)).body),drawn);
        assert.throws(()=>app.store.push(save({},drawn.operations)),/ticket consumption/);assert.deepEqual(snapshot(),queued);
        if(count===100) {
          app.store.db.prepare('UPDATE event_box_request SET draw_state=NULL WHERE operation_id=?').run(drawn.operations[0].id);
          const missing=snapshot();assert.equal((await send(value)).status,503);
          assert.throws(()=>app.store.push(save({},drawn.operations)),/original policy capture/);
          assert.deepEqual(snapshot(),missing,'A lost bulk capture is retained, never interpreted as an old10-draw receipt');
          app.store.db.prepare('UPDATE event_box_request SET draw_state=? WHERE operation_id=?').run(receipt.draw_state,drawn.operations[0].id);
        }
        await close();await open();assert.deepEqual(JSON.parse((await send(value)).body),drawn);
        const delta={...rewardDelta(drawn),UserEventItem:[{...tickets,amount:receipt.remaining}],
          UserEventBox:[{...savedBox,totalDrawCount:receipt.total_count}],
          UserEventBoxContent:drawn.UserEventBoxContent,UserEventBoxStep:drawn.UserEventBoxStep};
        app.store.push(save(delta));await close();await open();
        assert.equal((await send(value)).status,503,'An observed bulk draw cannot apply its additive cost/prizes twice');
        app.store.push(save({},drawn.operations));await close();await open();
        assert.deepEqual(app.store.operations(),[]);assert.equal(snapshot().requests.length,0);
        assert.equal(app.store.read('UserEventBoxStep').data[0].drawCount,savedStep.drawCount+count);
        assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
        assert.ok(snapshot().claims.length>=before.claims.length);
      }
    }
    // Permanent identity binds actual received bytes, not the caller hash or
    // decoded field order. Synthetic funded saves are NOT native acceptance.
    for(const [idString,original] of [...bulkBoxes,...Object.entries(master.eventBoxes).filter(([,b])=>b.bonusKey)]) {
      await close();database=path.join(directory,`transport-${idString}.sqlite`);Date.now=()=>original.startAt*1000;forcedRoll=0;await open();
      const id=Number(idString),step=original.steps[0],costId=master.items[original.costKey],count=original.bonusKey?10:100,
        tickets={...stock(10000),eventItemId:costId,cumulativeAmount:10000},value={eventBoxId:id,drawCount:count};
      app.store.push(save({UserEventItem:[tickets],UserEventBox:[{...box(0,step.id),eventBoxId:id,userId:0}],
        UserEventBoxStep:[{userId:0,eventBoxStepId:step.id,drawCount:0,lappedCount:0,boost:false}]}));
      const nativeSequence=++sequence,key=`${nativeSequence}/${nativeSequence}`,header='a'.repeat(32);
      const replay=(payload=value,action='event_box/draw',hash=header)=>
        request(port,nativeSequence,payload,String(nativeSequence),action,{'X-ARGO-REQUEST-BODY-HASH':hash});
      const transport=()=>app.store.db.prepare('SELECT * FROM event_box_transport ORDER BY request_key').all();
      const state=()=>JSON.stringify({...snapshot(),transport:transport(),sequence:app.store.lastSequence().toString(),
        replies:app.store.db.prepare('SELECT * FROM reply_cache ORDER BY key').all()});
      const rejects=async (call,status,unavailable=status===503)=>{
        const before=state(),response=await call();assert.equal(response.status,status,response.body.toString());
        if(unavailable) assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
        else if(status===503) {
          assert.equal(response.body.length,0,'Unexpected SQLite failures must remain real failures, not route cancellation');
          assert.equal(response.headers['x-argo-server-response-code'],undefined);
        }
        assert.equal(state(),before,'Rejected identity/receipt/recovery must change no gameplay, queue, identity, sequence or reply');
      };
      for(const table of ['event_box_transport','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_transport BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'transport issue failure'); END`);
        await rejects(()=>replay(),503,false);app.store.db.exec('DROP TRIGGER fail_transport');
      }
      const response=await replay();assert.equal(response.status,200,response.body.toString());
      const drawn=JSON.parse(response.body),operation=drawn.operations[0],identity=transport()[0];
      assert.equal(identity.request_key,key);assert.equal(identity.operation_id,operation.id);assert.match(identity.body_hash,/^[0-9a-f]{32}$/);
      assert.notEqual(identity.body_hash,header,'Permanent identity ignores a caller-supplied hash label');
      assert.equal(app.store.reply(key).body_hash,identity.body_hash,'The cached box reply is bound to the same received bytes');
      let untouched=state();assert.deepEqual(JSON.parse((await replay(value,'event_box/draw','b'.repeat(32))).body),drawn);
      assert.equal(state(),untouched,'Identical bytes with a different hash header cannot create another identity/award');
      await rejects(()=>replay({...value,drawCount:count-1}),400);
      await rejects(()=>replay({drawCount:count,eventBoxId:id}),400);
      await rejects(()=>replay(value,'event_box/show'),400);
      await rejects(()=>request(port,nativeSequence,undefined,String(nativeSequence),'user/login'),400);
      app.store.db.prepare('DELETE FROM event_box_transport WHERE request_key=?').run(key);
      await rejects(()=>replay(),503);assert.equal(app.store.operations()[0].id,operation.id,
        'A legacy cached reply without permanent identity retains its genuine pending operation');
      app.store.db.prepare('INSERT INTO event_box_transport(request_key,body_hash,operation_id) VALUES(?,?,?)')
        .run(key,identity.body_hash,identity.operation_id);
      app.store.db.prepare('UPDATE event_box_transport SET operation_id=? WHERE request_key=?').run(operation.id+999,key);
      await rejects(()=>replay(),503);
      app.store.db.prepare('UPDATE event_box_transport SET operation_id=? WHERE request_key=?').run(operation.id,key);
      const receipt=app.store.db.prepare('SELECT * FROM event_box_request WHERE operation_id=?').get(operation.id);
      app.store.db.prepare('DELETE FROM event_box_request WHERE operation_id=?').run(operation.id);
      await rejects(()=>replay(),503);await rejects(()=>send(value),503);
      assert.equal(app.store.operations()[0].id,operation.id,'Missing receipts cancel fresh-identity siblings too, without dropping the queue');
      const columns=Object.keys(receipt);
      app.store.db.prepare(`INSERT INTO event_box_request(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`)
        .run(...columns.map(name=>receipt[name]));
      app.store.db.prepare('UPDATE event_box_request SET body_hash=? WHERE operation_id=?').run('0'.repeat(32),operation.id);
      await rejects(()=>replay(),503);
      app.store.db.prepare('UPDATE event_box_request SET body_hash=? WHERE operation_id=?').run(receipt.body_hash,operation.id);
      app.store.db.exec('DELETE FROM reply_cache');app.store.beginSession();await close();await open();
      Date.now=()=>(original.endAt+1)*1000;untouched=state();
      assert.deepEqual(JSON.parse((await replay()).body),drawn);assert.equal(state(),untouched,
        'Exact untouched recovery survives cache/session eviction, restart and the original event expiry');
      Date.now=()=>original.startAt*1000;
      const aliasSequence=++sequence,alias=()=>request(port,aliasSequence,value,String(aliasSequence),'event_box/draw');
      const aliasResponse=await alias();assert.equal(aliasResponse.status,200,aliasResponse.body.toString());
      assert.deepEqual(JSON.parse(aliasResponse.body),drawn);assert.equal(transport().length,2);
      assert.ok(transport().every(row=>row.operation_id===operation.id),'New pending identities alias one real operation, not another draw');
      const bonus=receipt.bonus_state?JSON.parse(receipt.bonus_state):null,delta={...rewardDelta(drawn),
        UserEventItem:[{...tickets,amount:receipt.remaining},...(bonus?[{...stock(bonus.amount),eventItemId:bonus.itemId,
          cumulativeAmount:bonus.cumulativeAmount,bookEntryState:3}]:[])],
        UserEventBox:[{...box(receipt.total_count,step.id),eventBoxId:id,userId:0}],
        UserEventBoxContent:drawn.UserEventBoxContent,UserEventBoxStep:drawn.UserEventBoxStep};
      app.store.push(save({UserEventBoxStep:drawn.UserEventBoxStep}));app.store.db.exec('DELETE FROM reply_cache');
      await close();await open();await rejects(()=>replay(),503);await rejects(()=>alias(),503);
      const partial=state();assert.throws(()=>app.store.push(save({},[operation])),/ticket consumption/);assert.equal(state(),partial);
      app.store.push(save(delta));
      app.store.db.exec("CREATE TRIGGER fail_transport_ack BEFORE INSERT ON event_box_delivery BEGIN SELECT RAISE(ABORT,'transport ACK failure'); END");
      const beforeAck=state();assert.throws(()=>app.store.push(save({},[operation])),/transport ACK failure/);assert.equal(state(),beforeAck);
      app.store.db.exec('DROP TRIGGER fail_transport_ack');app.store.push(save({},[operation]));
      assert.equal(transport().length,2);assert.equal(app.store.operations().length,0);assert.equal(snapshot().requests.length,0);
      const archived=snapshot().deliveries.find(row=>row.operation_id===operation.id),
        settledDrawn={...drawn,operations:[]};delete settledDrawn.operation;
      assert.equal(archived.operation_json,JSON.stringify(operation));assert.equal(JSON.parse(archived.receipt_json).effect_seen,1);
      app.store.db.exec('DELETE FROM reply_cache');app.store.beginSession();await close();await open();untouched=state();
      assert.deepEqual(JSON.parse((await replay()).body),settledDrawn);assert.deepEqual(JSON.parse((await alias()).body),settledDrawn);
      assert.equal(state(),untouched,'Settled exact identities replay only their original popup and no gameplay state');
      for(const [column,value] of [['operation_json','{}'],['receipt_json','{}']]) {
        app.store.db.prepare(`UPDATE event_box_delivery SET ${column}=? WHERE operation_id=?`).run(value,operation.id);
        await rejects(()=>replay(),503);
        app.store.db.prepare(`UPDATE event_box_delivery SET ${column}=? WHERE operation_id=?`).run(archived[column],operation.id);
      }
      app.store.db.prepare('DELETE FROM event_box_delivery WHERE operation_id=?').run(operation.id);await rejects(()=>replay(),503);
      app.store.db.prepare('INSERT INTO event_box_delivery(operation_id,operation_json,receipt_json) VALUES(?,?,?)')
        .run(archived.operation_id,archived.operation_json,archived.receipt_json);
      app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(operation.id);await rejects(()=>replay(),503);
      app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(operation.id);
      app.store.db.prepare('INSERT INTO operation_queue(id,type,parameters,token,signature) VALUES(?,?,?,?,?)')
        .run(operation.id,operation.type,JSON.stringify(operation.parameters),operation.token,operation.signature);
      await rejects(()=>replay(),503);app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(operation.id);
      const nextResponse=await send(value);assert.equal(nextResponse.status,200,nextResponse.body.toString());
      const next=JSON.parse(nextResponse.body);assert.notEqual(next.operation.id,operation.id);assert.equal(transport().length,3);
      untouched=state();assert.deepEqual(JSON.parse((await replay()).body),settledDrawn);assert.equal(state(),untouched);
      assert.equal(app.store.operations()[0].id,next.operation.id,
        'A settled identity returns its own popup and cannot redirect to a newer same-body draw');
      assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    }
    // Original enabled catalogs, including BOTH archived ticket costs. These
    // funded/fast-forwarded fixtures are not natural earning/traversal proof.
    const preBoost=Object.entries(master.eventBoxes).filter(([,box])=>box.steps[0].boostEnabled && !box.bonusKey && !box.bonusEvery);
    assert.equal(preBoost.length,95); assert.deepEqual([...new Set(preBoost.map(([,box])=>box.cost))].sort((a,b)=>a-b),[5,10]);
    for(const [idString,original] of preBoost) {
      await close(); database=path.join(directory,`pre-boost-${idString}.sqlite`);
      Date.now=()=>original.startAt*1000; forcedRoll=0; await open();
      const id=Number(idString),step=original.steps[0],costId=master.items[original.costKey];
      assert.equal(step.boostAfter,300);
      const value={eventBoxId:id,eventBoxStepId:step.id},beforeView=snapshot();
      const cachedViewId=++sequence;
      const replayView=()=>request(port,cachedViewId,value,String(cachedViewId),'event_box/show');
      const view=await replayView();assert.equal(view.status,200,view.body.toString());
      assert.equal(JSON.parse(view.body).currentStepContents.length,step.contents.length);
      assert.deepEqual(snapshot(),beforeView,'Normal pool reads do not create boost flags or counters');
      let replayPull,replayConfirm;
      if(idString===preBoost[0][0]) {
        const pullId=++sequence,confirmId=++sequence;
        replayPull=()=>request(port,pullId,{tables:['UserEventItem','UserEventBox','UserEventBoxStep','UserEventBoxContent']},
          String(pullId),'user_data/pull');
        replayConfirm=()=>request(port,confirmId,undefined,String(confirmId),'user_data/confirm');
        assert.equal((await replayPull()).status,200);assert.equal((await replayConfirm()).status,200);
      }
      app.store.push(save({UserEventItem:[{...stock(1000),eventItemId:costId}],
        UserEventBox:[{...box(0,step.id),eventBoxId:id,userId:0}],
        UserEventBoxStep:[{userId:0,eventBoxStepId:step.id,drawCount:0,lappedCount:0,boost:false}],
        UserEventBoxContent:[{userId:0,eventBoxContentId:step.contents[0].id,eventBoxStepId:step.id,
          pickedAmount:0,lappedCount:0,rateVariationState:2}]}));
      const apply=draw=>app.store.push(save({...rewardDelta(draw),
        UserEventItem:[{...stock(app.store.read('UserEventItem').data.find(row=>row.eventItemId===costId).amount-draw.consumedItem.amount),eventItemId:costId}],
        UserEventBox:[{...box((app.store.read('UserEventBox').data.find(row=>row.eventBoxId===id)?.totalDrawCount??0)+draw.consumedItem.amount,step.id),eventBoxId:id,userId:0}],
        UserEventBoxStep:draw.UserEventBoxStep.map(row=>({...row,userId:0})),
        UserEventBoxContent:draw.UserEventBoxContent.map(row=>({...row,userId:0}))},draw.operations));
      const draw=async count=>{
        const response=await send({eventBoxId:id,drawCount:count});assert.equal(response.status,200,response.body.toString());
        return JSON.parse(response.body);
      };
      const first=await draw(1);assert.equal(first.UserEventBoxStep[0].drawCount,1);
      assert.equal(first.UserEventBoxStep[0].boost,false);assert.equal(first.consumedItem.amount,original.cost);
      const firstView=await show(value);assert.equal(firstView.status,200,firstView.body.toString());
      assert.deepEqual(JSON.parse(firstView.body).currentStepContents,first.currentStepContents);
      const oldView=await replayView();
      assert.equal(oldView.status,Buffer.from(view.body).equals(Buffer.from(firstView.body))?200:503,
        'A cached view cannot reinstate odds from before a prize was exhausted');
      for(const [table,rows] of [['UserEventBoxStep',first.UserEventBoxStep],['UserEventBoxContent',first.UserEventBoxContent],
        ['UserEventBox',[{...box(original.cost,step.id),eventBoxId:id}]]]) {
        const beforeInvalid=snapshot();
        assert.throws(()=>app.store.push(save({[table]:rows.map(row=>({...row,userId:2}))})),/event-box/);
        assert.deepEqual(snapshot(),beforeInvalid,'Foreign ownership cannot save any pending box effect');
      }
      if(idString===preBoost[0][0]) {
        // Any observed component suppresses the additive15000, even if later
        // funding restores the old ticket value before reward/counter saves.
        const partialCost={...stock(1000-original.cost),eventItemId:costId};
        const reply=await send(save({UserEventItem:[partialCost]}),'user_data/push');
        assert.equal(reply.status,200,reply.body.toString());
        assert.ok(!JSON.parse(reply.body).operations.some(row=>row.type===15000));
        assert.equal(snapshot().requests[0].effect_seen,1);
        await close();await open();
        const costRecovery=JSON.parse((await send({eventBoxId:id,drawCount:1})).body).operations[0];
        assert.equal(costRecovery.parameters.consumedItem.amount,0);
        assert.equal(costRecovery.parameters.offlineEventBoxCounterControl,original.cost+1);
        assert.ok(costRecovery.parameters.chosenItems.every(row=>row.offlineEventBoxLifetimeControl===row.amount+1));
        assert.equal((await replayConfirm()).status,200,'A cached confirmation receives the derived remaining draw');
        assert.equal((await replayPull()).status,200,'Binary pulls receive the same derived remaining draw');
        app.store.push(save({UserEventItem:[{...partialCost,amount:1000}]}));
        const restored=snapshot();
        const fundedRecovery=JSON.parse((await send({eventBoxId:id,drawCount:1})).body).operations[0];
        assert.equal(fundedRecovery.parameters.consumedItem.amount,0);
        assert.equal(fundedRecovery.parameters.offlineEventBoxCounterControl,original.cost+1);
        assert.ok(fundedRecovery.parameters.chosenItems.every(row=>row.offlineEventBoxLifetimeControl===row.amount+1));
        assert.deepEqual(snapshot(),restored,'Persisted debit observation survives funding and restart');
      }
      apply(first);
      if(replayPull) {
        const afterAck=snapshot();
        assert.equal((await replayPull()).status,503,'Settled cached pulls cannot restore pre-draw tickets/counters');
        assert.equal((await replayConfirm()).status,503,'Settled confirmation tokens cannot hide earned box progress');
        assert.deepEqual(snapshot(),afterAck);
        assert.equal((await send({tables:['UserEventItem','UserEventBox','UserEventBoxStep','UserEventBoxContent']},'user_data/pull')).status,200);
        assert.equal((await send(undefined,'user_data/confirm')).status,200);
      }
      const initial=app.store.read('UserEventBoxStep').data.find(row=>row.eventBoxStepId===step.id);
      assert.equal(initial.userId,0,'Native-created ownership is retained, not rewritten');
      assert.ok(app.store.read('UserEventBoxContent').data.every(row=>row.userId===0));
      app.store.push(save({UserEventBoxStep:[{...initial,drawCount:298}]}));
      const lastNormal=await draw(1);assert.equal(lastNormal.UserEventBoxStep[0].drawCount,299);apply(lastNormal);
      await close();await open();
      for(const count of [1,10]) {
        const continuation=await draw(count);assert.equal(continuation.UserEventBoxStep[0].boost,false);
        assert.ok(!continuation.chosenItems.some(row=>row.eventBoxContentId===step.contents[0].id),
          'An already-claimed special prize stays exhausted beyond the old300 ceiling');apply(continuation);
      }
      const saved=app.store.read('UserEventBoxStep').data.find(row=>row.eventBoxStepId===step.id);
      assert.throws(()=>app.store.push(save({UserEventBoxStep:[{...saved,drawCount:298}]})),/cannot be removed or rewound/);
      assert.throws(()=>app.store.push(save({},[],{UserEventBoxStep:[{eventBoxStepId:step.id}]})),/cannot be removed or rewound/);
      assert.throws(()=>app.store.push(save({UserEventBoxStep:[{...saved,drawCount:'299'}]})),/Invalid.*event-box step/);
      assert.throws(()=>app.store.push(save({UserEventBoxStep:[{...saved,userId:'0'}]})),/Invalid.*event-box step/);
      app.store.push(save({UserEventBoxStep:[{...saved,boost:true}]}));
      const exhaustedView=await show(value);assert.equal(exhaustedView.status,200);
      assert.equal(JSON.parse(exhaustedView.body).currentStepContents[0].rate,0,'Imported boost cannot restore an exhausted prize');
      assert.equal((await replayView()).status,503,'Cached pre-boost odds cannot erase a later boost flag');
    }
    // Explicit offline policy, not publisher boost/RNG parity. Every archived
    // enabled step has one original finite reset prize, not a synthetic reward.
    const boosted=Object.entries(master.eventBoxes).filter(([,row])=>row.steps[0].boostEnabled);
    const enabledSteps=Object.values(master.eventBoxes).flatMap(row=>row.steps).filter(row=>row.boostEnabled);
    assert.equal(boosted.length,98);assert.equal(enabledSteps.length,1470);
    for(const step of enabledSteps) {
      assert.equal(step.boostAfter,300);assert.equal(step.repeatable,0);
      assert.equal(step.contents.filter(row=>row.limited).length,1);
      assert.ok(step.contents.some(row=>row.requiredForReset && row.limited && row.limit===1));
    }
    for(const [idString,original] of boosted) for(const importedBoost of idString===boosted[0][0]?[false,true]:[false]) {
      await close();database=path.join(directory,`boost-${idString}-${importedBoost}.sqlite`);Date.now=()=>original.startAt*1000;await open();
      const id=Number(idString),step=original.steps[0],costId=master.items[original.costKey],special=step.contents[0];
      assert.equal(special.requiredForReset,1);forcedRoll=special.weight; // Miss the rare prize before boost.
      app.store.push(save({UserEventItem:[{...stock(2000),eventItemId:costId,cumulativeAmount:2000}],
        UserEventBox:[{...box((importedBoost?17:299)*original.cost,step.id),eventBoxId:id,userId:0}],
        UserEventBoxStep:[{userId:0,eventBoxStepId:step.id,drawCount:importedBoost?17:299,lappedCount:0,boost:importedBoost}]}));
      const delta=draw=>{
        const receipt=app.store.db.prepare('SELECT * FROM event_box_request WHERE operation_id=?').get(draw.operations[0].id),
          bonus=receipt.bonus_state?JSON.parse(receipt.bonus_state):null;
        return {...rewardDelta(draw),UserEventItem:[{...stock(receipt.remaining),eventItemId:costId,cumulativeAmount:2000},
          ...(bonus?[{...stock(bonus.amount),eventItemId:bonus.itemId,cumulativeAmount:bonus.cumulativeAmount,bookEntryState:3}]:[])],
          UserEventBox:[{...box(receipt.total_count,step.id),eventBoxId:id,userId:0}],
          UserEventBoxStep:draw.UserEventBoxStep,UserEventBoxContent:draw.UserEventBoxContent};
      };
      const draw=async count=>{const response=await send({eventBoxId:id,drawCount:count});
        assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);};
      if(importedBoost) {
        const active=await show({eventBoxId:id,eventBoxStepId:step.id});assert.equal(active.status,200);
        assert.equal(JSON.parse(active.body).currentStepContents[0].rate,1);
        const drawn=await draw(1);assert.equal(drawn.chosenItems[0].eventBoxContentId,special.id);
        assert.equal(drawn.UserEventBoxStep[0].drawCount,18);assert.equal(drawn.UserEventBoxStep[0].boost,false);
        assert.deepEqual(await draw(1),drawn,'A queued true-to-false flag is not a saved effect either');
        app.store.push(save(delta(drawn),drawn.operations));await close();await open();
        assert.deepEqual(app.store.operations(),[]);continue;
      }
      const boundary=await draw(1),queued=snapshot(),receipt=queued.requests[0],capture=JSON.parse(receipt.draw_state);
      assert.equal(boundary.UserEventBoxStep[0].drawCount,300);assert.equal(boundary.UserEventBoxStep[0].boost,true);
      assert.equal(boundary.currentStepContents[0].rate,1);assert.ok(boundary.currentStepContents.slice(1).every(row=>row.rate===0));
      assert.equal(capture.policy,'offline-event-box-v1');assert.equal(capture.beforeStep.boost,false);
      assert.equal(app.store.read('UserEventBoxStep').data[0].boost,false,'The new native flag is not pre-credited');
      assert.deepEqual(await draw(1),boundary,'A queued target boost flag is not a saved before-state effect');
      assert.throws(()=>app.store.push(save({...delta(boundary),UserEventBoxStep:boundary.UserEventBoxStep.map(row=>({...row,boost:false}))},boundary.operations)),
        /saved prize counts/);assert.deepEqual(snapshot(),queued);
      if(idString===boosted[0][0]) {
        for(const draw_state of [null,'{',JSON.stringify({...capture,policy:'unknown'}),
          JSON.stringify({...capture,catalogHash:'wrong'}),JSON.stringify({...capture,beforeCounts:[]})]) {
          app.store.db.prepare('UPDATE event_box_request SET draw_state=? WHERE operation_id=?').run(draw_state,boundary.operations[0].id);
          const corrupt=snapshot(),response=await send({eventBoxId:id,drawCount:1});assert.equal(response.status,503);
          assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
          assert.throws(()=>app.store.push(save(delta(boundary),boundary.operations)),/draw policy|original policy capture/);
          assert.deepEqual(snapshot(),corrupt,'Legacy/corrupt boosted receipts are retained, not reinterpreted');
        }
        app.store.db.prepare('UPDATE event_box_request SET draw_state=? WHERE operation_id=?').run(receipt.draw_state,boundary.operations[0].id);
        app.store.push(save({UserEventBoxStep:boundary.UserEventBoxStep}));await close();await open();
        const recovered=await send({eventBoxId:id,drawCount:1});assert.equal(recovered.status,200,recovered.body.toString());
        assert.deepEqual(JSON.parse(recovered.body).operations,boundary.operations,
          'An absolute flag target can retain the original callback while the unsaved debit, counter and prizes replay');
        assert.equal(app.store.eventBoxDelivery(boundary.operations[0],'user/login'),true);
        assert.throws(()=>app.store.push(save({},boundary.operations)),/ticket consumption/);
      }
      app.store.push(save(delta(boundary),boundary.operations));await close();await open();
      const view=await show({eventBoxId:id,eventBoxStepId:step.id});assert.equal(view.status,200);
      assert.equal(JSON.parse(view.body).currentStepContents[0].rate,1);
      const batchCount=original.bonusKey?10:100,batch=await draw(batchCount);assert.equal(batch.chosenItems[0].eventBoxContentId,special.id);
      assert.equal(batch.chosenItems.filter(row=>row.eventBoxContentId===special.id).length,1);
      assert.equal(batch.UserEventBoxStep[0].drawCount,300+batchCount);assert.equal(batch.UserEventBoxStep[0].boost,false);
      assert.equal(batch.currentStepContents[0].rate,0);app.store.push(save(delta(batch),batch.operations));
      await close();await open();assert.deepEqual(app.store.operations(),[]);
      assert.equal(app.store.read('UserEventBoxStep').data[0].boost,false);
    }
    // Exact native bonus arithmetic; synthetic funding/counters/saves are NOT
    // proof of natural earning, publisher RNG or native effect/save ordering.
    const bonusBoxes=Object.entries(master.eventBoxes).filter(([,row])=>row.bonusKey || row.bonusEvery);
    assert.deepEqual(bonusBoxes.map(([id])=>Number(id)),[193000051,193000052,193000095]);
    const bonusCases=[
      {name:'new-zero',total:0,before:null,amount:0,cumulative:0},
      {name:'threshold',total:29,before:[0,0],amount:1,cumulative:1},
      {name:'spent-replacement',total:59,before:[0,3],amount:2,cumulative:5},
      {name:'negative',total:29,before:[3,7],amount:1,cumulative:7},
      {name:'existing-noop',total:0,before:[0,7],amount:0,cumulative:7},
      {name:'saturated',total:29,before:[0,999999999],amount:1,cumulative:999999999},
    ];
    for(const [idString,original] of bonusBoxes) for(const scenario of bonusCases) {
      await close(); database=path.join(directory,`bonus-${idString}-${scenario.name}.sqlite`);
      Date.now=()=>original.startAt*1000; forcedRoll=0; await open();
      const id=Number(idString),step=original.steps[0],costId=master.items[original.costKey],bonusId=master.items[original.bonusKey];
      assert.equal(original.cost,1);assert.equal(original.bonusEvery,30);assert.equal(step.boostAfter,300);
      assert.equal(master.itemProfiles[bonusId].table,'UserEventItem');
      assert.ok(original.steps.every(row=>row.contents.every(content=>master.items[content.rewardKey]!==bonusId)));
      const tickets={...stock(1000),eventItemId:costId},bonusRow=(amount,cumulativeAmount)=>
        ({...stock(amount),eventItemId:bonusId,cumulativeAmount,bookEntryState:3});
      const baseline=scenario.before?bonusRow(...scenario.before):null;
      app.store.push(save({UserEventItem:[tickets,...(baseline?[baseline]:[])],
        UserEventBox:[{...box(scenario.total,step.id),eventBoxId:id,userId:0}],
        UserEventBoxStep:[{userId:0,eventBoxStepId:step.id,drawCount:0,lappedCount:0,boost:false}]}));
      const before=snapshot();
      assert.equal((await show({eventBoxId:id,eventBoxStepId:step.id})).status,200);
      assert.deepEqual(snapshot(),before,'Bonus pool inspection cannot create the implicit item');
      for(const drawCount of [11,50,100,101]) {
        assert.equal((await send({eventBoxId:id,drawCount})).status,400);
        assert.deepEqual(snapshot(),before,'Native bonus boxes retain the10-draw ceiling despite the local setting');
      }
      if(scenario.name==='new-zero') {
        const raw=app.store.read('UserEventItem').data,putRaw=(rows,token=crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex'))=>
          app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),token,'UserEventItem');
        for(const changes of [{userId:0},{userId:2},{amount:1},{amount:'0'},{cumulativeAmount:'0'},{cumulativeAmount:1000000000}]) {
          putRaw([...raw,{...bonusRow(0,0),...changes}]);const invalid=snapshot();
          assert.equal((await send({eventBoxId:id,drawCount:1})).status,400);
          assert.deepEqual(snapshot(),invalid,'Invalid initial bonus inventory cannot spend tickets or reserve a draw');
        }
        putRaw(raw,before.profiles.find(row=>row.name==='UserEventItem').token);
      }
      if(scenario.name==='new-zero') for(const table of ['operation_queue','event_box_request','event_box_reward_claim','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_bonus BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'bonus issue failure'); END`);
        assert.equal((await send({eventBoxId:id,drawCount:1})).status,503);
        assert.deepEqual(snapshot(),before,'Bonus capture/prizes/cost/queue/reply roll back together');
        app.store.db.exec('DROP TRIGGER fail_bonus');
      }
      const response=await send({eventBoxId:id,drawCount:1});assert.equal(response.status,200,response.body.toString());
      const drawn=JSON.parse(response.body),op=drawn.operations[0],receipt=snapshot().requests[0],capture=JSON.parse(receipt.bonus_state);
      assert.deepEqual(Object.keys(op.parameters).sort(),
        ['consumedItem','chosenItems','UserEventBoxContent','UserEventBoxStep','currentStepContents'].sort(),
        'Native15000 has no invented bonus field or extra chosen prize');
      assert.deepEqual(capture,{itemId:bonusId,beforePresent:Boolean(baseline),beforeAmount:baseline?.amount??0,
        beforeCumulative:baseline?.cumulativeAmount??0,amount:scenario.amount,cumulativeAmount:scenario.cumulative});
      assert.equal(receipt.bonus_seen,0);assert.equal(receipt.effect_seen,0);
      assert.equal(app.store.read('UserEventItem').data.find(row=>row.eventItemId===bonusId)?.amount,baseline?.amount,
        'Implicit bonus is not pre-credited');
      assert.equal(snapshot().rewards.some(row=>row.item_id===bonusId),scenario.amount>(baseline?.amount??0));
      assert.deepEqual(JSON.parse((await send({eventBoxId:id,drawCount:1})).body),drawn,
        'A capped preexisting cumulative count must not suppress an untouched draw');
      const savedBonus=bonusRow(scenario.amount,scenario.cumulative),other={...rewardDelta(drawn),
        UserEventItem:[{...tickets,amount:999}],UserEventBox:[{...box(scenario.total+1,step.id),eventBoxId:id,userId:0}],
        UserEventBoxContent:drawn.UserEventBoxContent.map(row=>({...row,userId:0})),
        UserEventBoxStep:drawn.UserEventBoxStep.map(row=>({...row,userId:0}))};
      const complete={...other,UserEventItem:[...other.UserEventItem,savedBonus]},queued=snapshot();
      assert.throws(()=>app.store.reservedItemAcquisition(bonusId,baseline?.cumulativeAmount??0),/absolute event-box bonus/);
      for(const changes of [{userId:0},{userId:2},{amount:'0'},{amount:-1},{amount:scenario.cumulative+1},
        {cumulativeAmount:'0'},{cumulativeAmount:1000000000},
        ...(scenario.cumulative>0?[{cumulativeAmount:scenario.cumulative-1}]:[])]) {
        assert.throws(()=>app.store.push(save({...complete,UserEventItem:[...other.UserEventItem,{...savedBonus,...changes}]},[op])),
          /bonus ownership or inventory|missing its saved implicit bonus|delivery ownership/);
        assert.deepEqual(snapshot(),queued,'Malformed/foreign/rewound implicit inventory cannot discard15000');
      }
      if(scenario.name!=='existing-noop') {
        assert.throws(()=>app.store.push(save(other,[op])),/missing its saved implicit bonus/);
        assert.deepEqual(snapshot(),queued);
      }
      if(scenario.name==='threshold') {
        for(const bonus_state of [null,'{',JSON.stringify({...capture,itemId:costId}),JSON.stringify({...capture,amount:2})]) {
          app.store.db.prepare('UPDATE event_box_request SET bonus_state=? WHERE operation_id=?').run(bonus_state,op.id);
          const corrupt=snapshot(),unavailable=await send({eventBoxId:id,drawCount:1});
          assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
          assert.throws(()=>app.store.push(save(complete,[op])),/bonus.*reconciliation|bonus acquisition baseline|bonus target/);
          assert.deepEqual(snapshot(),corrupt,'Missing/corrupt captures remain queued; no invented baseline');
        }
        app.store.db.prepare('UPDATE event_box_request SET bonus_state=? WHERE operation_id=?').run(receipt.bonus_state,op.id);
      }
      if(scenario.name==='existing-noop') {
        app.store.push(save(other,[op])); // No newly dirty bonus row is needed.
      } else {
        app.store.db.exec("CREATE TRIGGER fail_bonus_save BEFORE UPDATE ON event_box_request BEGIN SELECT RAISE(ABORT,'bonus save failure'); END");
        assert.throws(()=>app.store.push(save({UserEventItem:[savedBonus]})),/bonus save failure/);
        assert.deepEqual(snapshot(),queued,'Bonus observation and profile saves are one transaction');
        app.store.db.exec('DROP TRIGGER fail_bonus_save');
        // Positive unsaturated acquisition also proves a bonus spent BEFORE
        // its first save. Nonpositive/capped effects need one exact observation.
        const firstSaved=scenario.cumulative>(baseline?.cumulativeAmount??0)?{...savedBonus,amount:0}:savedBonus;
        const saveResponse=await send(save({UserEventItem:[firstSaved]}),'user_data/push');
        assert.equal(saveResponse.status,200,saveResponse.body.toString());
        assert.ok(!JSON.parse(saveResponse.body).operations.some(row=>row.type===15000));
        assert.equal(snapshot().requests[0].bonus_seen,1);assert.equal(snapshot().requests[0].effect_seen,1);
        await close();await open();
        const bonusRecovery=await send({eventBoxId:id,drawCount:1});assert.equal(bonusRecovery.status,200,bonusRecovery.body.toString());
        const recoveredBonusOperation=JSON.parse(bonusRecovery.body).operations[0],withoutBonusControl={...recoveredBonusOperation.parameters,
          chosenItems:recoveredBonusOperation.parameters.chosenItems.map(row=>{
            assert.equal(row.offlineEventBoxLifetimeControl,row.amount+1);
            const original={...row};delete original.offlineEventBoxLifetimeControl;return original;
          })};
        delete withoutBonusControl.offlineEventBoxBonusApplied;
        assert.equal(recoveredBonusOperation.parameters.offlineEventBoxBonusApplied,1);
        assert.deepEqual({...recoveredBonusOperation,parameters:withoutBonusControl},op,
          'Bonus-first recovery skips the saved absolute bonus even after its stock was spent');
        for(const action of ['user/login','user_data/pull','user_data/confirm'])
          assert.equal(app.store.eventBoxDelivery(op,action),true);
        app.store.push(save({UserEventItem:[{...savedBonus,amount:0}]}));
        const partial=snapshot();
        assert.throws(()=>app.store.push(save({},[],{UserEventItem:[{eventItemId:bonusId}]})),/cannot be removed or rewound/);
        assert.deepEqual(snapshot(),partial);
        app.store.db.exec("CREATE TRIGGER fail_bonus_ack BEFORE DELETE ON operation_queue BEGIN SELECT RAISE(ABORT,'bonus ACK failure'); END");
        assert.throws(()=>app.store.push(save(other,[op])),/bonus ACK failure/);
        assert.deepEqual(snapshot(),partial,'ACK cannot drop its cost/prize/bonus receipt after a failed commit');
        app.store.db.exec('DROP TRIGGER fail_bonus_ack');
        app.store.push(save(other));await close();await open();app.store.push(save({},[op]));
      }
      assert.deepEqual(app.store.operations(),[]);assert.equal(snapshot().requests.length,0);
      assert.equal(app.store.read('UserEventItem').data.find(row=>row.eventItemId===bonusId).cumulativeAmount,scenario.cumulative);
      assert.equal(app.store.reservedItemAcquisition(bonusId,scenario.cumulative),scenario.cumulative,
        'Settling the absolute bonus releases the shared item producer guard');
      if(scenario.amount>(baseline?.amount??0)) {
        const settled=snapshot();
        assert.throws(()=>app.store.push(save({},[],{UserEventItem:[{eventItemId:bonusId}]})),/cannot be removed or rewound/);
        assert.deepEqual(snapshot(),settled,'Positive bonus acquisition proof survives ACK/restart/spending');
      }
      Date.now=()=>(original.endAt+1)*1000;
      const expired=snapshot();assert.equal((await send({eventBoxId:id,drawCount:1})).status,400);
      assert.deepEqual(snapshot(),expired,'Even the one-second193000095 original window is not expanded');
    }
    // Separate fresh fixtures for every ordinary inventory type in the original
    // unboosted pools. Synthetic step/funding saves do not prove native unlocks.
    const candidates = new Map();
    for (const [id, original] of Object.entries(master.eventBoxes)) if (!original.bonusKey && !original.bonusEvery) {
      for (const step of original.steps) if (!step.boostEnabled && !step.boostAfter) {
        for (const content of step.contents) {
          const profile = master.itemProfiles[master.items[content.rewardKey]];
          if (profile && (profile.table !== 'UserCurrency' || content.rewardKey==='currency.valis') && !candidates.has(profile.table))
            candidates.set(profile.table, { id: Number(id), original, step, content, profile });
        }
      }
    }
    assert.equal(candidates.size, 9);
    for (const [name, { id, original, step, content, profile }] of candidates) {
      await close(); database = path.join(directory, `${name}.sqlite`);
      Date.now = () => original.startAt * 1000; await open();
      const costId = master.items[original.costKey], itemId = master.items[content.rewardKey];
      const tickets = { ...stock(1000), eventItemId: costId };
      app.store.push(save({ UserEventItem: [tickets], UserEventBox: [{ ...box(0, step.id), eventBoxId: id }] }));
      forcedRoll = step.contents.slice(0, step.contents.indexOf(content)).reduce((sum, row) => sum + row.weight, 0);
      const baseline = app.store.read(name).data;
      const putRaw = rows => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
        .run(JSON.stringify(rows), crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex'), name);
      const empty = { userId: seed.userId, [profile.idField]: itemId, signature: 0, bookEntryState: 3, cumulativeAmount: 0,
        ...(name === 'UserGachaTicket' ? { dateList: [] } : { amount: 0 }) };
      for (const changes of [{ userId: 2 }, { cumulativeAmount: -1 }, { cumulativeAmount: '0' },
        { cumulativeAmount: 999999999 }, ...(name === 'UserGachaTicket' ? [{ dateList: null }] : [{ amount: -1 }])]) {
        putRaw([{ ...empty, ...changes }]); const rejected = snapshot();
        assert.equal((await send({ eventBoxId: id, drawCount: 1 })).status, 400);
        assert.deepEqual(snapshot(), rejected, `${name}: invalid/saturated acquisition cannot spend or queue`);
      }
      putRaw(baseline);
      const response = await send({ eventBoxId: id, drawCount: 1 });
      assert.equal(response.status, 200, response.body.toString());
      const result = JSON.parse(response.body);
      assert.equal(result.chosenItems[0].eventBoxContentId, content.id);
      assert.deepEqual(app.store.read(name).data, baseline, 'Only the native operation grants inventory');
      const rewardRows = rewardDelta(result);
      app.store.push(save({ UserEventItem: [{ ...tickets, amount: 1000 - original.cost }],
        UserEventBox: [{ ...box(original.cost, step.id), eventBoxId: id }],
        UserEventBoxContent: result.UserEventBoxContent, UserEventBoxStep: result.UserEventBoxStep }));
      await close(); await open();
      assert.throws(() => app.store.push(save({}, result.operations)), /reward inventory/);
      app.store.push(save(rewardRows)); await close(); await open();
      if (name === 'UserGachaTicket') {
        const receipt = snapshot().rewards[0];
        app.store.db.prepare('DELETE FROM event_box_reward_claim WHERE operation_id=?').run(result.operations[0].id);
        const legacy = snapshot();
        assert.throws(() => app.store.push(save({}, result.operations)), /baseline requires reconciliation/);
        const unavailable = await send(save({}, result.operations), 'user_data/push');
        assert.equal(unavailable.status, 503);
        assert.equal(unavailable.headers['x-argo-server-response-code'], String(OFFLINE_UNAVAILABLE_CODE));
        assert.equal(JSON.parse(unavailable.body).code, OFFLINE_UNAVAILABLE_CODE);
        assert.deepEqual(snapshot(), legacy, 'Legacy reward without baseline remains queued, never fabricated');
        app.store.db.prepare(`INSERT INTO event_box_reward_claim
          (operation_id,item_id,table_name,id_field,cumulative_amount) VALUES(?,?,?,?,?)`).run(receipt.operation_id,
          receipt.item_id, receipt.table_name, receipt.id_field, receipt.cumulative_amount);
      }
      app.store.push(save({}, result.operations));
      const acquired = app.store.read(name).data.find(row => row[profile.idField] === itemId);
      app.store.push(save({ [name]: [{ ...acquired, ...(name === 'UserGachaTicket' ? { dateList: [] } : { amount: 0 }) }] }));
      await close(); await open(); assert.deepEqual(app.store.operations(), []);
      assert.equal(app.store.read(name).data.find(row => row[profile.idField] === itemId).cumulativeAmount, acquired.cumulativeAmount);
      assert.throws(() => app.store.reservedItemAcquisition(itemId, 0), /older than a completed/);
    }
    //WRITTEN ONLY / NOT RUN: both actual Valis pools, unlimited and required finite reset prize.
    for(const id of [193000030,193000034]) {
      const original=master.eventBoxes[id],step=original.steps.find(step=>step.contents.some(row=>row.rewardKey==='currency.valis')),
        prize=step.contents.find(row=>row.rewardKey==='currency.valis'),valisId=master.items[prize.rewardKey],costId=master.items[original.costKey];
      assert.equal(valisId,205000002);assert.equal(prize.amount,id===193000030?1000000:100000);
      await close();database=path.join(directory,`valis-${id}.sqlite`);Date.now=()=>original.startAt*1000;await open();
      const tickets={...stock(1000),eventItemId:costId},currency={userId:seed.userId,currencyId:valisId,amount:0,
        cumulativeAmount:0,reservedAmount:0,signature:0};
      app.store.push(save({UserEventItem:[tickets],UserEventBox:[{...box(0,step.id),eventBoxId:id}],UserCurrency:[currency]}));
      forcedRoll=step.contents.slice(0,step.contents.indexOf(prize)).reduce((sum,row)=>sum+row.weight,0);
      for(let cycle=0;cycle<2;cycle++) {
        const nativeBefore=app.store.read('UserCurrency').data,before=snapshot();
        app.store.db.exec("CREATE TRIGGER valis_issue_fail BEFORE INSERT ON event_box_reward_claim BEGIN SELECT RAISE(ABORT,'Valis issue rollback'); END");
        assert.equal((await send({eventBoxId:id,drawCount:1})).status,503);assert.deepEqual(snapshot(),before);
        app.store.db.exec('DROP TRIGGER valis_issue_fail');
        const response=await send({eventBoxId:id,drawCount:1});assert.equal(response.status,200,response.body.toString());
        const drawn=JSON.parse(response.body),drawSequence=sequence,operation=drawn.operations[0],
          counts={UserEventItem:[{...tickets,amount:1000-(cycle+1)*original.cost}],
            UserEventBox:[{...box((cycle+1)*original.cost,step.id),eventBoxId:id}],
            UserEventBoxContent:drawn.UserEventBoxContent,UserEventBoxStep:drawn.UserEventBoxStep},
          reward=rewardDelta(drawn),resetFirst=Boolean(prize.requiredForReset && cycle===0);
        assert.deepEqual(drawn.chosenItems,[{eventBoxContentId:prize.id,itemId:valisId,amount:prize.amount}]);
        assert.deepEqual(app.store.read('UserCurrency').data,nativeBefore,'Issuing15000 does not precredit native Valis');
        const acquisition=snapshot().rewards.find(row=>row.operation_id===operation.id);
        assert.equal(acquisition.table_name,'UserCurrency');
        assert.equal(acquisition.cumulative_amount,(cycle+1)*prize.amount);
        await close();await open();
        assert.deepEqual(JSON.parse((await send({eventBoxId:id,drawCount:1})).body),drawn);
        if(cycle===0) {
          const saved=await send(save(reward),'user_data/push');assert.equal(saved.status,200);
          if(resetFirst) {
            const reset=drawn.UserEventBoxContent.map(row=>({...row,pickedAmount:0,lappedCount:row.lappedCount+1,rateVariationState:2}));
            assert.equal((await send(save({UserEventBoxContent:reset},[],{},'EventBoxReset'),'user_data/push')).status,200);
            delete counts.UserEventBoxContent;
          } else {
            const invalid=snapshot(),reset=drawn.UserEventBoxContent.map(row=>({...row,pickedAmount:0,lappedCount:row.lappedCount+1,rateVariationState:2}));
            assert.equal((await send(save({UserEventBoxContent:reset},[],{},'EventBoxReset'),'user_data/push')).status,400);
            assert.deepEqual(snapshot(),invalid,'Unlimited Valis is not the authored required reset prize');
          }
        } else {
          assert.equal((await send(save(counts),'user_data/push')).status,200);
        }
        await close();await open();
        const incomplete=snapshot(),early=await send(save({},drawn.operations),'user_data/push');
        assert.equal(early.status,400);assert.deepEqual(snapshot(),incomplete,'Valis or counts alone are not a full draw ACK');
        const finalSave=save(cycle===0?counts:reward,drawn.operations);
        for(const [table,event] of [['event_box_request','UPDATE'],['operation_done','INSERT'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER valis_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'Valis ACK rollback'); END`);
          const pending=snapshot();assert.equal((await send(finalSave,'user_data/push')).status,503);assert.deepEqual(snapshot(),pending);
          app.store.db.exec('DROP TRIGGER valis_ack_fail');
        }
        const saved=await send(finalSave,'user_data/push'),saveSequence=sequence;assert.equal(saved.status,200,saved.body.toString());
        const coin=app.store.read('UserCurrency').data.find(row=>row.currencyId===valisId);
        assert.equal(coin.amount,prize.amount);assert.equal(coin.cumulativeAmount,(cycle+1)*prize.amount);
        assert.ok(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id));
        assert.deepEqual(app.store.operations(),[]);
        const done=snapshot();await close();await open();assert.deepEqual(snapshot(),done);
        assert.deepEqual((await request(port,saveSequence,finalSave,String(saveSequence),'user_data/push')).body,saved.body);
        assert.deepEqual(snapshot(),done);
        assert.equal((await request(port,drawSequence,{eventBoxId:id,drawCount:1},String(drawSequence),'event_box/draw')).status,503);
        assert.deepEqual(snapshot(),done,'A settled Valis draw cannot spend or credit twice');
        const shown=await show({eventBoxId:id,eventBoxStepId:step.id});assert.equal(shown.status,200);
        const valisRate=JSON.parse(shown.body).currentStepContents.find(row=>row.contentId===prize.id).rate;
        assert.equal(valisRate>0,!prize.limited || resetFirst,'Original finite depletion/reset and unlimited availability retained');
        assert.equal((await send(save({UserCurrency:[{...coin,amount:0}]}),'user_data/push')).status,200);
        const spent=snapshot();
        assert.notEqual((await send(save({UserCurrency:[{...coin,amount:0,cumulativeAmount:coin.cumulativeAmount-1}]}),'user_data/push')).status,200);
        assert.notEqual((await send(save({},[],{UserCurrency:[coin]}),'user_data/push')).status,200);
        assert.deepEqual(snapshot(),spent,'Spending Valis preserves its earned acquisition floor');
      }
    }
    //WRITTEN ONLY / NOT RUN: original24d8d94 clamps a crossing lifetime acquisition, not its chosen prize quantity.
    const plainCapBox=master.eventBoxes[193000001],plainCapStep=plainCapBox.steps.at(-1),
      plainCapPrize=plainCapStep.contents.find(row=>!row.limited && master.itemProfiles[master.items[row.rewardKey]]?.table==='UserStatusBoardItem');
    assert.ok(plainCapPrize);
    for(const [id,original,step,prize,count] of [
      ...[193000030,193000034].map(id=>{
        const original=master.eventBoxes[id],step=original.steps.find(step=>step.contents.some(row=>row.rewardKey==='currency.valis'));
        return [id,original,step,step.contents.find(row=>row.rewardKey==='currency.valis'),1];
      }),[193000001,plainCapBox,plainCapStep,plainCapPrize,2]]) {
      await close();database=path.join(directory,`cross-cap-${id}.sqlite`);Date.now=()=>original.startAt*1000;await open();
      const itemId=master.items[prize.rewardKey],profile=master.itemProfiles[itemId],costId=master.items[original.costKey],
        prior=app.store.read(profile.table).data.find(row=>row[profile.idField]===itemId),
        initial={...(prior??{userId:seed.userId,[profile.idField]:itemId,signature:0,bookEntryState:3,reservedAmount:0}),
          amount:0,cumulativeAmount:999999998},tickets={...stock(1000),eventItemId:costId},
        amount=prize.amount*count,draw={eventBoxId:id,drawCount:count};
      assert.ok(amount>1);assert.equal(step.boostEnabled,0);
      app.store.push(save({[profile.table]:[initial],UserEventItem:[tickets],UserEventBox:[{...box(0,step.id),eventBoxId:id}]}));
      forcedRoll=step.contents.slice(0,step.contents.indexOf(prize)).reduce((sum,row)=>sum+row.weight,0);
      const before=snapshot();
      for(const table of ['operation_queue','event_box_request','event_box_reward_claim','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER crossing_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'crossing issue rollback'); END`);
        assert.equal((await send(draw)).status,503);assert.deepEqual(snapshot(),before);app.store.db.exec('DROP TRIGGER crossing_issue_fail');
      }
      const response=await send(draw);assert.equal(response.status,200,response.body.toString());
      const drawn=JSON.parse(response.body),operation=drawn.operations[0],drawSequence=sequence,
        receipt=snapshot().rewards.find(row=>row.operation_id===operation.id),rewards=rewardDelta(drawn),
        counts={UserEventItem:[{...tickets,amount:1000-original.cost*count}],UserEventBox:[{...box(original.cost*count,step.id),eventBoxId:id}],
          UserEventBoxContent:drawn.UserEventBoxContent,UserEventBoxStep:drawn.UserEventBoxStep};
      assert.equal(receipt.cumulative_amount,999999999);
      assert.equal(drawn.chosenItems.length,count);
      assert.ok(drawn.chosenItems.every(row=>row.eventBoxContentId===prize.id && row.itemId===itemId && row.amount===prize.amount));
      assert.equal(rewards[profile.table][0].amount,amount,'Lifetime clamp does not shorten the authored spendable prize');
      assert.equal(rewards[profile.table][0].cumulativeAmount,999999999);
      assert.deepEqual(app.store.read(profile.table).data.find(row=>row[profile.idField]===itemId),initial,'Issue does not credit the native inventory');
      const queued=snapshot();await close();await open();assert.deepEqual(snapshot(),queued);
      assert.deepEqual(JSON.parse((await send(draw)).body),drawn,'Pending retries keep the exact capped target and original chosen quantity');
      assert.equal((await send(save(counts),'user_data/push')).status,200);
      const countsOnly=snapshot();assert.equal((await send(save({},drawn.operations),'user_data/push')).status,400);
      assert.deepEqual(snapshot(),countsOnly,'Cost and counters cannot ACK an unsaved capped acquisition');
      const missingGain={...rewards,[profile.table]:rewards[profile.table].map(row=>({...row,cumulativeAmount:999999998}))};
      const early=await send(save(missingGain,drawn.operations),'user_data/push');assert.equal(early.status,400);
      assert.deepEqual(snapshot(),countsOnly);
      const finalSave=save(rewards,drawn.operations);
      for(const [table,event] of [['profile','UPDATE'],['event_box_request','UPDATE'],['operation_done','INSERT'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER crossing_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'crossing ACK rollback'); END`);
        const pending=snapshot();assert.equal((await send(finalSave,'user_data/push')).status,503);assert.deepEqual(snapshot(),pending);
        app.store.db.exec('DROP TRIGGER crossing_ack_fail');
      }
      const acknowledged=await send(finalSave,'user_data/push'),ackSequence=sequence;
      assert.equal(acknowledged.status,200,acknowledged.body.toString());
      const acquired=app.store.read(profile.table).data.find(row=>row[profile.idField]===itemId);
      assert.equal(acquired.cumulativeAmount,999999999);assert.equal(acquired.amount,amount);
      assert.ok(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id));assert.deepEqual(app.store.operations(),[]);
      const settled=snapshot();await close();await open();assert.deepEqual(snapshot(),settled);
      assert.deepEqual((await request(port,ackSequence,finalSave,String(ackSequence),'user_data/push')).body,acknowledged.body);
      assert.equal((await request(port,drawSequence,draw,String(drawSequence),'event_box/draw')).status,503);assert.deepEqual(snapshot(),settled);
      assert.equal((await send(save({[profile.table]:[{...acquired,amount:0}]}),'user_data/push')).status,200);
      if(prize.requiredForReset) {
        const reset=app.store.read('UserEventBoxContent').data.filter(row=>row.eventBoxStepId===step.id)
          .map(row=>({...row,pickedAmount:0,lappedCount:row.lappedCount+1,rateVariationState:2}));
        assert.equal((await send(save({UserEventBoxContent:reset},[],{},'EventBoxReset'),'user_data/push')).status,200);
      }
      const spent=snapshot();
      assert.notEqual((await send(save({[profile.table]:[{...acquired,amount:0,cumulativeAmount:999999998}]}),'user_data/push')).status,200);
      assert.deepEqual(snapshot(),spent);
      const continued=await send(draw);assert.equal(continued.status,200,continued.body.toString());
      assert.equal(JSON.parse(snapshot().requests[0].draw_state).policy,'offline-event-box-v3');
      assert.equal(app.store.read(profile.table).data.find(row=>row[profile.idField]===itemId).amount,0,
        'The next capped-counter draw still waits for native stock application');
    }
    //WRITTEN ONLY / NOT RUN: actual first-step prizes must survive two draws; never invent Faithstone box content.
    const cappedOriginalPrizes=['UserCpItem','UserExpItem','UserEquipmentMaterial','UserVoteItem','UserStaminaTicket','UserKeyItem'].map(table=>{
      const entry=Object.entries(master.eventBoxes).find(([,box])=>!box.bonusKey && !box.bonusEvery &&
        box.steps[0]?.contents.some(row=>(!row.limited || row.limit>=2) && master.itemProfiles[master.items[row.rewardKey]]?.table===table));
      assert.ok(entry,`Missing original first-step ${table} prize`);
      const [id,original]=entry;
      const step=original.steps[0],prize=step.contents.find(row=>(!row.limited || row.limit>=2) && master.itemProfiles[master.items[row.rewardKey]]?.table===table);
      return [Number(id),original,step,prize,1];
    });
    //WRITTEN ONLY / NOT RUN: seven original numeric prize classes, four cap baselines, five native-field save orders.
    for(const [id,original,step,prize] of [[193000001,plainCapBox,plainCapStep,plainCapPrize],...cappedOriginalPrizes])
      for(const baseline of ['exact','crossing','stock-clamp','full-stock'])
        for(const order of ['stock-first','lifetime-first','signature-first','spent-before-save','combined']) {
          await close();database=path.join(directory,`numeric-crossing-${id}-${prize.id}-${baseline}-${order}.sqlite`);
          Date.now=()=>original.startAt*1000;await open();
          const itemId=master.items[prize.rewardKey],profile=master.itemProfiles[itemId],count=2,quantity=prize.amount*count,
            initial={userId:seed.userId,[profile.idField]:itemId,amount:baseline==='full-stock'?999999999:baseline==='stock-clamp'?999999998:7,
              cumulativeAmount:baseline==='exact'?999999999-quantity:999999998,signature:7,reservedAmount:0,
              bookEntryState:['UserVoteItem','UserStaminaTicket'].includes(profile.table)?1:3,
              ...(profile.table==='UserKeyItem'?{exploit:false}:{})},
            tickets={...stock(1000),eventItemId:master.items[original.costKey]},draw={eventBoxId:id,drawCount:count},
            ledger=()=>({...snapshot(),replies:app.store.db.prepare('SELECT * FROM reply_cache ORDER BY rowid').all()}),
            rejected=async (wire,status=400) => {const held=ledger();assert.equal((await send(wire,'user_data/push')).status,status);assert.deepEqual(ledger(),held);};
          assert.ok(quantity>1);
          app.store.push(save({[profile.table]:[initial],UserEventItem:[tickets],UserEventBox:[{...box(0,step.id),eventBoxId:id}]}));
          forcedRoll=step.contents.slice(0,step.contents.indexOf(prize)).reduce((sum,row)=>sum+row.weight,0);
          const before=ledger();
          for(const table of ['operation_queue','event_box_request','event_box_reward_claim','reply_cache']) {
            app.store.db.exec(`CREATE TRIGGER numeric_cross_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'numeric crossing issue rollback'); END`);
            assert.equal((await send(draw)).status,503);assert.deepEqual(ledger(),before);app.store.db.exec('DROP TRIGGER numeric_cross_issue_fail');
          }
          const response=await send(draw);assert.equal(response.status,200,response.body.toString());
          const drawn=JSON.parse(response.body),operation=drawn.operations[0],drawIdentity=sequence,rewards=rewardDelta(drawn),
            acquired=rewards[profile.table][0],delta=acquired.amount-initial.amount,receipt=snapshot().requests[0],capture=JSON.parse(receipt.draw_state),
            first=order==='stock-first'?{...initial,amount:acquired.amount}:order==='lifetime-first'?{...initial,cumulativeAmount:999999999}:
              order==='signature-first'?{...initial,signature:operation.signature}:order==='spent-before-save'?{...acquired,amount:0}:acquired,
            firstAdded=Math.max(0,first.amount-initial.amount),firstSeen=first.cumulativeAmount===999999999 && first.signature===operation.signature,
            firstEffect=first.amount!==initial.amount || first.cumulativeAmount!==initial.cumulativeAmount || first.signature!==initial.signature,
            firstWire=save({[profile.table]:[first]}),
            counts={UserEventItem:[{...tickets,amount:1000-original.cost*count}],UserEventBox:[{...box(original.cost*count,step.id),eventBoxId:id}],
              UserEventBoxContent:drawn.UserEventBoxContent,UserEventBoxStep:drawn.UserEventBoxStep};
          assert.ok(drawn.chosenItems.every(row=>row.itemId===itemId && row.amount===prize.amount));
          assert.equal(capture.policy,'offline-event-box-v3');assert.equal(acquired.cumulativeAmount,999999999);
          assert.deepEqual(capture.rewardStocks,[{itemId,beforeAmount:initial.amount,beforeCumulative:initial.cumulativeAmount,
            amount:acquired.amount,beforeSignature:initial.signature,signature:operation.signature}]);
          assert.notEqual(operation.signature,initial.signature);assert.equal(receipt.reward_seen,'[]');
          assert.deepEqual(app.store.read(profile.table).data.find(row=>row[profile.idField]===itemId),initial);
          assert.equal(delta,baseline==='full-stock'?0:baseline==='stock-clamp'?1:quantity);
          for(const patch of [
            {stock_amount_added:JSON.stringify([{itemId,amount:delta+1,signature:operation.signature}])},
            {draw_state:JSON.stringify({...capture,rewardStocks:[{...capture.rewardStocks[0],beforeCumulative:999999999-quantity-1}]})},
            {draw_state:JSON.stringify({...capture,policy:'offline-event-box-v2',rewardStocks:capture.rewardStocks.map(row=>
              Object.fromEntries(Object.entries(row).filter(([key])=>!['beforeSignature','signature'].includes(key))))})}
          ]) {
            const [column,value]=Object.entries(patch)[0];app.store.db.prepare(`UPDATE event_box_request SET ${column}=? WHERE operation_id=?`).run(value,operation.id);
            const unknown=ledger();assert.equal((await send(draw)).status,503);assert.deepEqual(ledger(),unknown);
            app.store.db.prepare(`UPDATE event_box_request SET ${column}=? WHERE operation_id=?`).run(receipt[column],operation.id);
          }
          for(const [table,event] of [['profile','UPDATE'],...(firstEffect?[['event_box_request','UPDATE']]:[]),['reply_cache','INSERT']]) {
            app.store.db.exec(`CREATE TRIGGER numeric_cross_save_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'numeric crossing save rollback'); END`);
            await rejected(firstWire,503);app.store.db.exec('DROP TRIGGER numeric_cross_save_fail');
          }
          const saved=await send(firstWire,'user_data/push'),firstIdentity=sequence;assert.equal(saved.status,200,saved.body.toString());
          const observed=snapshot().requests[0];assert.equal(observed.effect_seen,Number(firstEffect));
          assert.deepEqual(JSON.parse(observed.reward_seen),firstSeen?[itemId]:[]);
          assert.deepEqual(JSON.parse(observed.stock_amount_added),[{itemId,amount:firstAdded,signature:operation.signature}]);
          await close();await open();const cold=ledger();
          assert.deepEqual((await request(port,firstIdentity,firstWire,String(firstIdentity),'user_data/push')).body,saved.body);assert.deepEqual(ledger(),cold);
          const retry=await request(port,drawIdentity,draw,String(drawIdentity),'event_box/draw');
          assert.equal(retry.status,200,retry.body.toString());assert.deepEqual(ledger(),cold);
          if(firstEffect) {
            const projected=JSON.parse(retry.body).operations[0].parameters.chosenItems;
            if(firstSeen) assert.ok(projected.every(row=>row.amount===0 && row.offlineEventBoxLifetimeControl===-1));
            else {
              assert.equal(projected.reduce((sum,row)=>sum+row.amount,0),delta-firstAdded);
              assert.equal(projected.reduce((sum,row)=>sum+row.offlineEventBoxLifetimeControl-1,0),
                999999999-first.cumulativeAmount);
            }
          }
          await rejected(save({},drawn.operations));
          const spent={...first,amount:0};assert.equal((await send(save({[profile.table]:[spent]}),'user_data/push')).status,200);
          const remaining=firstSeen?0:delta-firstAdded;
          await rejected(save({[profile.table]:[{...spent,amount:remaining+1}]}));
          if(remaining) assert.equal((await send(save({[profile.table]:[{...spent,amount:remaining}]}),'user_data/push')).status,200);
          assert.equal((await send(save({[profile.table]:[spent]}),'user_data/push')).status,200);
          await rejected(save({[profile.table]:[{...spent,amount:1}]}));
          if(first.cumulativeAmount>initial.cumulativeAmount)
            await rejected(save({[profile.table]:[{...spent,cumulativeAmount:initial.cumulativeAmount}]}));
          const fullySaved={...acquired,amount:0},final=save({...counts,[profile.table]:[fullySaved]},drawn.operations);
          for(const [table,event] of [['profile','UPDATE'],['event_box_request','UPDATE'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
            app.store.db.exec(`CREATE TRIGGER numeric_cross_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'numeric crossing ACK rollback'); END`);
            await rejected(final,503);app.store.db.exec('DROP TRIGGER numeric_cross_ack_fail');
          }
          const acknowledged=await send(final,'user_data/push'),ackIdentity=sequence;assert.equal(acknowledged.status,200,acknowledged.body.toString());
          assert.deepEqual(app.store.operations(),[]);assert.deepEqual(JSON.parse(snapshot().requests[0].reward_seen),[itemId]);
          const settled=ledger();await close();await open();
          assert.deepEqual((await request(port,ackIdentity,final,String(ackIdentity),'user_data/push')).body,acknowledged.body);assert.deepEqual(ledger(),settled);
          for(const wire of [save({[profile.table]:[{...fullySaved,amount:1}]}),save({[profile.table]:[{...fullySaved,cumulativeAmount:999999998}]}),
            save({},[],{[profile.table]:[fullySaved]})]) await rejected(wire);
        }
    //WRITTEN ONLY / NOT RUN: already-capped lifetime counters need actual original stock-gain observations.
    for(const [id,original,step,prize,count] of [
      ...[193000030,193000034].map(id=>{
        const original=master.eventBoxes[id],step=original.steps.find(step=>step.contents.some(row=>row.rewardKey==='currency.valis'));
        return [id,original,step,step.contents.find(row=>row.rewardKey==='currency.valis'),1];
      }),[193000001,plainCapBox,plainCapStep,plainCapPrize,2],...cappedOriginalPrizes]) for(const countsFirst of [false,true]) {
      await close();database=path.join(directory,`capped-stock-${id}-${prize.id}-${countsFirst}.sqlite`);Date.now=()=>original.startAt*1000;await open();
      const itemId=master.items[prize.rewardKey],profile=master.itemProfiles[itemId],maximum=profile.table==='UserCurrency'?2000000000:999999999,
        initial={userId:seed.userId,[profile.idField]:itemId,amount:countsFirst?maximum-1:0,cumulativeAmount:999999999,
          signature:0,...(profile.table==='UserCurrency'?{reservedAmount:0}:{bookEntryState:['UserVoteItem','UserStaminaTicket'].includes(profile.table)?1:3}),
          ...(['UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial','UserVoteItem','UserStaminaTicket','UserKeyItem'].includes(profile.table)?{reservedAmount:0}:{}),
          ...(profile.table==='UserKeyItem'?{exploit:false}:{})},
        tickets={...stock(1000),eventItemId:master.items[original.costKey]},draw={eventBoxId:id,drawCount:count},
        expectedAmount=Math.min(maximum,initial.amount+prize.amount*count);
      app.store.push(save({[profile.table]:[initial],UserEventItem:[tickets],UserEventBox:[{...box(0,step.id),eventBoxId:id}]}));
      forcedRoll=step.contents.slice(0,step.contents.indexOf(prize)).reduce((sum,row)=>sum+row.weight,0);
      const before=snapshot();
      for(const table of ['operation_queue','event_box_request','event_box_reward_claim','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER capped_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'capped stock issue rollback'); END`);
        assert.equal((await send(draw)).status,503);assert.deepEqual(snapshot(),before);app.store.db.exec('DROP TRIGGER capped_issue_fail');
      }
      const response=await send(draw);assert.equal(response.status,200,response.body.toString());
      const drawn=JSON.parse(response.body),operation=drawn.operations[0],drawSequence=sequence,receipt=snapshot().requests[0],
        capture=JSON.parse(receipt.draw_state),rewards=rewardDelta(drawn),
        counts={UserEventItem:[{...tickets,amount:1000-original.cost*count}],UserEventBox:[{...box(original.cost*count,step.id),eventBoxId:id}],
          UserEventBoxContent:drawn.UserEventBoxContent,UserEventBoxStep:drawn.UserEventBoxStep};
      assert.equal(capture.policy,'offline-event-box-v3');assert.equal(receipt.reward_seen,'[]');
      assert.deepEqual(capture.rewardStocks,[{itemId,beforeAmount:initial.amount,beforeCumulative:999999999,amount:expectedAmount,
        beforeSignature:initial.signature,signature:operation.signature}]);
      assert.deepEqual(JSON.parse(receipt.stock_amount_added),[{itemId,amount:0,signature:operation.signature}]);
      assert.ok(drawn.chosenItems.every(row=>row.itemId===itemId && row.amount===prize.amount));
      assert.equal(rewards[profile.table][0].amount,expectedAmount);assert.equal(rewards[profile.table][0].cumulativeAmount,999999999);
      if(profile.table==='UserKeyItem') assert.equal(rewards[profile.table][0].exploit,false,'A box prize cannot fabricate a processed key-item flag');
      if(['UserVoteItem','UserStaminaTicket'].includes(profile.table)) assert.equal(rewards[profile.table][0].bookEntryState,1,
        'The native domain book setter is a no-op; the serialized book byte remains present');
      if(profile.table==='UserKeyItem') {
        const retained=snapshot();assert.equal(master.keyItems[itemId].isExploit,false);
        const withoutFlag={...rewards[profile.table][0]};delete withoutFlag.exploit;
        for(const malformed of [{...rewards[profile.table][0],exploit:true},withoutFlag]) {
          assert.equal((await send(save({[profile.table]:[malformed]}),'user_data/push')).status,400);
          assert.deepEqual(snapshot(),retained,'The original non-feat key prize cannot gain or lose its separate processed flag');
        }
      }
      assert.deepEqual(app.store.read(profile.table).data.filter(row=>row[profile.idField]===itemId),[initial],
        'Capped-counter issuance must not fabricate native stock/signatures');
      const queued=snapshot();await close();await open();assert.deepEqual(snapshot(),queued);
      assert.deepEqual(JSON.parse((await send(draw)).body),drawn,'Old capped cumulative alone must not suppress the first real15000');
      for(const changed of [{draw_state:null},{reward_seen:null},{reward_seen:'[1]'},{reward_seen:JSON.stringify([itemId])},
        {stock_amount_added:null},{stock_amount_added:'{'},{stock_amount_added:'[]'},
        {stock_amount_added:JSON.stringify([{itemId,amount:prize.amount*count+1,signature:operation.signature}])},
        {stock_amount_added:JSON.stringify([{itemId:1,amount:0,signature:operation.signature}])},
        {stock_amount_added:JSON.stringify([{itemId,amount:0}])},
        {stock_amount_added:JSON.stringify([{itemId,amount:0,signature:null}])},
        {stock_amount_added:JSON.stringify([{itemId,amount:0,signature:initial.signature}])},
        {draw_state:JSON.stringify({...capture,rewardStocks:[{...capture.rewardStocks[0],amount:expectedAmount-1}]})},
        {draw_state:JSON.stringify({...capture,rewardStocks:[{...capture.rewardStocks[0],beforeCumulative:999999999-prize.amount*count-1}]})}]) {
        const [column,value]=Object.entries(changed)[0];app.store.db.prepare(`UPDATE event_box_request SET ${column}=? WHERE operation_id=?`).run(value,operation.id);
        const corrupt=snapshot();assert.equal((await send(draw)).status,503);assert.deepEqual(snapshot(),corrupt);
        app.store.db.prepare(`UPDATE event_box_request SET ${column}=? WHERE operation_id=?`).run(receipt[column],operation.id);
      }
      assert.equal((await send(save(countsFirst?counts:rewards),'user_data/push')).status,200);
      const partial=snapshot();await close();await open();assert.deepEqual(snapshot(),partial);
      const recovered=await send(draw);assert.equal(recovered.status,200,recovered.body.toString());
      const recoveredOperation=JSON.parse(recovered.body).operations[0];
      assert.equal(recoveredOperation.parameters.consumedItem.amount,countsFirst?0:drawn.consumedItem.amount);
      assert.equal(recoveredOperation.parameters.chosenItems.reduce((sum,row)=>sum+row.amount,0),
        countsFirst?expectedAmount-initial.amount:0);
      assert.ok(recoveredOperation.parameters.chosenItems.every(row=>row.offlineEventBoxLifetimeControl===(countsFirst?1:-1)),
        'Recovery separates remaining capped stock from already-saved lifetime and complete rewards');
      assert.ok(app.store.operations().some(row=>row.id===operation.id));
      assert.equal(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id),undefined);
      const early=await send(save({},drawn.operations),'user_data/push');assert.equal(early.status,400);assert.deepEqual(snapshot(),partial);
      if(countsFirst) {
        const unchanged=await send(save({[profile.table]:[initial]},drawn.operations),'user_data/push');
        assert.equal(unchanged.status,400);assert.deepEqual(snapshot(),partial,'An old capped lifetime count and unchanged stock cannot ACK');
        const savedStock=save(rewards);
        for(const [table,event] of [['profile','UPDATE'],['event_box_request','UPDATE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER capped_stock_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'capped stock observation rollback'); END`);
          assert.equal((await send(savedStock,'user_data/push')).status,503);assert.deepEqual(snapshot(),partial);app.store.db.exec('DROP TRIGGER capped_stock_fail');
        }
        assert.equal((await send(savedStock,'user_data/push')).status,200);
      }
      assert.deepEqual(JSON.parse(snapshot().requests[0].reward_seen),[itemId]);
      const acquired=app.store.read(profile.table).data.find(row=>row[profile.idField]===itemId),observed=snapshot();
      for(const put of [{...acquired,cumulativeAmount:999999998},{...acquired,userId:2}]) {
        assert.notEqual((await send(save({[profile.table]:[put]}),'user_data/push')).status,200);assert.deepEqual(snapshot(),observed);
      }
      assert.notEqual((await send(save({},[],{[profile.table]:[acquired]}),'user_data/push')).status,200);assert.deepEqual(snapshot(),observed);
      if(!countsFirst) assert.equal((await send(save({[profile.table]:[{...acquired,amount:0}]}),'user_data/push')).status,200,
        'After the actual stock gain is saved, spending must not erase its observation');
      await close();await open();
      const finalSave=save(countsFirst?{}:counts,drawn.operations);
      for(const [table,event] of [['event_box_request','UPDATE'],['operation_done','INSERT'],['reply_cache','INSERT']]) {
        const pending=snapshot();app.store.db.exec(`CREATE TRIGGER capped_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'capped stock ACK rollback'); END`);
        assert.equal((await send(finalSave,'user_data/push')).status,503);assert.deepEqual(snapshot(),pending);app.store.db.exec('DROP TRIGGER capped_ack_fail');
      }
      const acknowledged=await send(finalSave,'user_data/push'),ackSequence=sequence;assert.equal(acknowledged.status,200,acknowledged.body.toString());
      assert.deepEqual(app.store.operations(),[]);assert.ok(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id));
      assert.equal(app.store.read(profile.table).data.find(row=>row[profile.idField]===itemId).amount,countsFirst?maximum:0);
      const settled=snapshot();await close();await open();assert.deepEqual(snapshot(),settled);
      assert.deepEqual((await request(port,ackSequence,finalSave,String(ackSequence),'user_data/push')).body,acknowledged.body);
      assert.equal((await request(port,drawSequence,draw,String(drawSequence),'event_box/draw')).status,503);assert.deepEqual(snapshot(),settled);
      if(countsFirst) {
        if(prize.requiredForReset) {
          const reset=app.store.read('UserEventBoxContent').data.filter(row=>row.eventBoxStepId===step.id)
            .map(row=>({...row,pickedAmount:0,lappedCount:row.lappedCount+1,rateVariationState:2}));
          assert.equal((await send(save({UserEventBoxContent:reset},[],{},'EventBoxReset'),'user_data/push')).status,200);
        }
        const full=snapshot(),next=await send(draw);assert.equal(next.status,200,next.body.toString());
        const issued=JSON.parse(next.body),capture=JSON.parse(snapshot().requests[0].draw_state);
        assert.equal(capture.policy,'offline-event-box-v3');assert.equal(capture.rewardStocks[0].beforeAmount,maximum);
        assert.equal(capture.rewardStocks[0].beforeSignature,acquired.signature);
        assert.equal(capture.rewardStocks[0].signature,issued.operations[0].signature);
        assert.notEqual(issued.operations[0].signature,acquired.signature);
        assert.deepEqual(snapshot().profiles,full.profiles,'Full-cap issuance does not forge a native signature change');
      }
    }
    //WRITTEN ONLY / NOT RUN: original numeric prizes bound additions across split saves; synthetic ordering is not native application proof.
    for(const [id,original,step,prize] of [
      ...[193000030].map(id=>{const original=master.eventBoxes[id],step=original.steps.find(step=>step.contents.some(row=>row.rewardKey==='currency.valis'));
        return [id,original,step,step.contents.find(row=>row.rewardKey==='currency.valis')];}),
      [193000001,plainCapBox,plainCapStep,plainCapPrize],...cappedOriginalPrizes]) for(const order of ['partial-spent','observed','spent-before-save','signature-first']) {
      await close();database=path.join(directory,`stock-allowance-${id}-${prize.id}-${order}.sqlite`);Date.now=()=>original.startAt*1000;await open();
      const itemId=master.items[prize.rewardKey],profile=master.itemProfiles[itemId],count=id===193000030?1:2,quantity=prize.amount*count,
        initial={userId:seed.userId,[profile.idField]:itemId,amount:['spent-before-save','signature-first'].includes(order)?7:0,
          cumulativeAmount:999999999,signature:order==='signature-first'?0x7fffffff:order==='spent-before-save'?0xffffffff:7,
          bookEntryState:['UserCurrency','UserVoteItem','UserStaminaTicket'].includes(profile.table)?1:3,
          ...(['UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial','UserCurrency','UserVoteItem','UserStaminaTicket','UserKeyItem'].includes(profile.table)?{reservedAmount:0}:{}),
          ...(profile.table==='UserKeyItem'?{exploit:false}:{})},tickets={...stock(1000),eventItemId:master.items[original.costKey]},
        draw={eventBoxId:id,drawCount:count},ledgerSnapshot=()=>({...snapshot(),replies:app.store.db.prepare('SELECT * FROM reply_cache ORDER BY rowid').all()});
      assert.ok(quantity>1);app.store.push(save({[profile.table]:[initial],UserEventItem:[tickets],UserEventBox:[{...box(0,step.id),eventBoxId:id}]}));
      forcedRoll=step.contents.slice(0,step.contents.indexOf(prize)).reduce((sum,row)=>sum+row.weight,0);
      const roll=crypto.randomInt;let response;
      try {if(order==='signature-first') crypto.randomInt=(...args)=>args.length===1?roll(...args):initial.signature;response=await send(draw);}
      finally {crypto.randomInt=roll;}
      assert.equal(response.status,200,response.body.toString());
      const drawn=JSON.parse(response.body),operation=drawn.operations[0],drawSequence=sequence,nativeReward=rewardDelta(drawn),
        acquired=nativeReward[profile.table][0],first=order==='observed'?acquired:
          order==='spent-before-save'?{...acquired,amount:0}:order==='signature-first'?{...initial,signature:operation.signature}:
          {...initial,amount:quantity-1},
        counts={UserEventItem:[{...tickets,amount:1000-original.cost*count}],UserEventBox:[{...box(original.cost*count,step.id),eventBoxId:id}],
          UserEventBoxContent:drawn.UserEventBoxContent,UserEventBoxStep:drawn.UserEventBoxStep};
      assert.ok(drawn.chosenItems.every(row=>row.itemId===itemId && row.amount===prize.amount));
      assert.equal(acquired.amount,initial.amount+quantity);assert.notEqual(operation.signature,initial.signature);
      if(order==='signature-first') assert.equal(operation.signature,1,'Below-cap signature exclusion advances and wraps on collision');
      assert.deepEqual(JSON.parse(snapshot().requests[0].stock_amount_added),[{itemId,amount:0,signature:operation.signature}]);
      const captured=snapshot().requests[0],capture=JSON.parse(captured.draw_state),unsigned={...capture,policy:'offline-event-box-v2',
        rewardStocks:capture.rewardStocks.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>!['beforeSignature','signature'].includes(key))))};
      app.store.db.prepare('UPDATE event_box_request SET draw_state=? WHERE operation_id=?').run(JSON.stringify(unsigned),operation.id);
      const downgrade=ledgerSnapshot();assert.equal((await send(draw)).status,503);assert.deepEqual(ledgerSnapshot(),downgrade,
        'The issued-signature allowance cannot downgrade into a legacy unsigned stock capture');
      app.store.db.prepare('UPDATE event_box_request SET draw_state=? WHERE operation_id=?').run(captured.draw_state,operation.id);
      for(const [table,event] of [['profile','UPDATE'],['event_box_request',order==='partial-spent' || order==='observed'?
        'UPDATE OF stock_amount_added':'UPDATE OF reward_seen'],['reply_cache','INSERT']]) {
        const pending=ledgerSnapshot();app.store.db.exec(`CREATE TRIGGER stock_allowance_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'stock allowance rollback'); END`);
        assert.equal((await send(save({[profile.table]:[first]}),'user_data/push')).status,503);assert.deepEqual(ledgerSnapshot(),pending);
        app.store.db.exec('DROP TRIGGER stock_allowance_fail');
      }
      assert.equal((await send(save({[profile.table]:[first]}),'user_data/push')).status,200);
      const receipt=snapshot().requests[0];assert.equal(receipt.effect_seen,1);
      assert.deepEqual(JSON.parse(receipt.stock_amount_added),[{itemId,amount:Math.max(0,first.amount-initial.amount),signature:operation.signature}]);
      assert.deepEqual(JSON.parse(receipt.reward_seen),order==='partial-spent'?[]:[itemId]);
      if(order==='partial-spent') {
        app.store.db.prepare('UPDATE event_box_request SET stock_amount_added=? WHERE operation_id=?')
          .run(JSON.stringify([{itemId,amount:0,signature:operation.signature}]),operation.id);
        const behind=ledgerSnapshot();assert.equal((await send(draw)).status,503);assert.deepEqual(ledgerSnapshot(),behind,
          'A lost allowance cannot be guessed from a newer native stock row');
        app.store.db.prepare('UPDATE event_box_request SET stock_amount_added=? WHERE operation_id=?').run(receipt.stock_amount_added,operation.id);
      }
      await close();await open();
      const coldRetry=await send(draw);
      assert.equal(coldRetry.status,200,coldRetry.body.toString());
      const cachedRetry=await request(port,drawSequence,draw,String(drawSequence),'event_box/draw');
      assert.equal(cachedRetry.status,200,cachedRetry.body.toString());
      const projected=JSON.parse(coldRetry.body).operations[0].parameters.chosenItems;
      assert.equal(projected.reduce((sum,row)=>sum+row.amount,0),order==='partial-spent'?1:0);
      assert.ok(projected.every(row=>row.offlineEventBoxLifetimeControl===(order==='partial-spent'?1:-1)),
        'Capped recovery replays only unsaved stock and skips a fully observed reward');
      assert.equal(app.store.eventBoxDelivery(operation,'user_data/push'),false);assert.ok(app.store.operations().some(row=>row.id===operation.id));
      const spentRow={...first,amount:0};assert.equal((await send(save({[profile.table]:[spentRow]}),'user_data/push')).status,200);
      const spent=ledgerSnapshot();assert.equal((await send(save({[profile.table]:[{...spentRow,amount:order==='partial-spent'?2:1}]}),'user_data/push')).status,400);
      assert.deepEqual(ledgerSnapshot(),spent,'Spending cannot refund the original quantity allowance or reopen an observed reward');
      let final=save(counts,drawn.operations);
      if(order==='partial-spent') {
        assert.equal((await send(save({[profile.table]:[{...spentRow,amount:1}]}),'user_data/push')).status,200);
        assert.deepEqual(JSON.parse(snapshot().requests[0].stock_amount_added),[{itemId,amount:quantity,signature:operation.signature}]);
        const exhausted=ledgerSnapshot();assert.equal((await send(save({[profile.table]:[{...spentRow,amount:2}]}),'user_data/push')).status,400);
        assert.deepEqual(ledgerSnapshot(),exhausted);
        assert.equal((await send(save(counts,drawn.operations),'user_data/push')).status,400,
          'The old signature cannot prove a non-full callback or earn an ACK');
        assert.deepEqual(ledgerSnapshot(),exhausted);
        final=save({...counts,[profile.table]:[{...spentRow,amount:1,signature:operation.signature}]},drawn.operations);
      }
      const ack=await send(final,'user_data/push'),ackSequence=sequence;
      assert.equal(ack.status,200,ack.body.toString());assert.deepEqual(app.store.operations(),[]);await close();await open();
      assert.deepEqual((await request(port,ackSequence,final,String(ackSequence),'user_data/push')).body,ack.body);
      const checkpoint={...app.store.read(profile.table).data.find(row=>row[profile.idField]===itemId),amount:0};
      assert.equal((await send(save({[profile.table]:[checkpoint]}),'user_data/push')).status,200);
      const completed=ledgerSnapshot();assert.equal((await send(save({[profile.table]:[{...checkpoint,amount:1}]}),'user_data/push')).status,400);assert.deepEqual(ledgerSnapshot(),completed,
        'The actual primary stock remains the checkpoint after the private pending request is settled');
      const gift={userId:seed.userId,id:1,itemId,amount:1,title:'Synthetic next capped prize Present',message:'',senderType:1,senderId:0,
        giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,pcHeroSublimateCount:0,state:0,
        startAt:original.startAt,expireAt:0,createdAt:original.startAt,dynamodbExpireAt:0};
      app.store.push(save({UserGift:[gift]}));const next=await send({userId:seed.userId,giftIds:[1]},'gift/receive');assert.equal(next.status,200,next.body.toString());
      const grant=JSON.parse(next.body).operation;assert.equal(app.store.read(profile.table).data.find(row=>row[profile.idField]===itemId).amount,0);
      assert.equal((await send(save({[profile.table]:[{...checkpoint,amount:1,signature:grant.signature}],UserGift:[{...gift,state:1}]},[grant]),'user_data/push')).status,200,
        'A separately captured Present can genuinely earn capped stock after an event-box grant');
    }
    //WRITTEN ONLY / NOT RUN: fully capped native numeric setters still receive the actual15000 signature.
    for(const [id,original,step,prize,count] of [
      ...[193000030,193000034].map(id=>{
        const original=master.eventBoxes[id],step=original.steps.find(step=>step.contents.some(row=>row.rewardKey==='currency.valis'));
        return [id,original,step,step.contents.find(row=>row.rewardKey==='currency.valis'),1];
      }),[193000001,plainCapBox,plainCapStep,plainCapPrize,2],...cappedOriginalPrizes]) for(const order of ['signature-first','counts-first','together']) {
      await close();database=path.join(directory,`full-cap-signature-${id}-${prize.id}-${order}.sqlite`);Date.now=()=>original.startAt*1000;await open();
      const itemId=master.items[prize.rewardKey],profile=master.itemProfiles[itemId],maximum=profile.table==='UserCurrency'?2000000000:999999999,
        initial={userId:seed.userId,[profile.idField]:itemId,amount:maximum,cumulativeAmount:999999999,
          signature:order==='signature-first'?7:order==='counts-first'?0xffffffff:0x7fffffff,
          ...(profile.table==='UserCurrency'?{reservedAmount:0}:{bookEntryState:['UserVoteItem','UserStaminaTicket'].includes(profile.table)?1:3}),
          ...(['UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial','UserVoteItem','UserStaminaTicket','UserKeyItem'].includes(profile.table)?{reservedAmount:0}:{}),
          ...(profile.table==='UserKeyItem'?{exploit:false}:{})},
        tickets={...stock(1000),eventItemId:master.items[original.costKey]},draw={eventBoxId:id,drawCount:count};
      app.store.push(save({[profile.table]:[initial],UserEventItem:[tickets],UserEventBox:[{...box(0,step.id),eventBoxId:id}]}));
      forcedRoll=step.contents.slice(0,step.contents.indexOf(prize)).reduce((sum,row)=>sum+row.weight,0);
      const before=snapshot();
      for(const table of ['operation_queue','event_box_request','event_box_reward_claim','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER full_cap_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'full-cap issue rollback'); END`);
        assert.equal((await send(draw)).status,503);assert.deepEqual(snapshot(),before);app.store.db.exec('DROP TRIGGER full_cap_issue_fail');
      }
      const previousRandom=crypto.randomInt;let collision=initial.signature!==0xffffffff;
      crypto.randomInt=(...args)=>{
        if(collision && args.length===2 && args[0]===1 && args[1]===0x80000000) {collision=false;return initial.signature;}
        return previousRandom(...args);
      };
      let response;
      try {response=await send(draw);} finally {crypto.randomInt=previousRandom;}
      assert.equal(response.status,200,response.body.toString());
      const drawn=JSON.parse(response.body),operation=drawn.operations[0],drawSequence=sequence,receipt=snapshot().requests[0],
        capture=JSON.parse(receipt.draw_state),nativeReward=rewardDelta(drawn),
        counts={UserEventItem:[{...tickets,amount:1000-original.cost*count}],UserEventBox:[{...box(original.cost*count,step.id),eventBoxId:id}],
          UserEventBoxContent:drawn.UserEventBoxContent,UserEventBoxStep:drawn.UserEventBoxStep};
      assert.equal(capture.policy,'offline-event-box-v3');assert.equal(receipt.reward_seen,'[]');
      assert.deepEqual(capture.rewardStocks,[{itemId,beforeAmount:maximum,beforeCumulative:999999999,amount:maximum,
        beforeSignature:initial.signature,signature:operation.signature}]);
      assert.notEqual(operation.signature,initial.signature);assert.ok(operation.signature>0 && operation.signature<=0x7fffffff);
      if(initial.signature!==0xffffffff) assert.equal(operation.signature,initial.signature===0x7fffffff?1:initial.signature+1,
        'A colliding signature advances within the original positive int32 range without another random loop');
      assert.ok(drawn.chosenItems.every(row=>row.itemId===itemId && row.amount===prize.amount));
      assert.equal(nativeReward[profile.table][0].amount,maximum);assert.equal(nativeReward[profile.table][0].cumulativeAmount,999999999);
      assert.equal(nativeReward[profile.table][0].signature,operation.signature);
      if(profile.table==='UserKeyItem') assert.equal(nativeReward[profile.table][0].exploit,false);
      if(['UserVoteItem','UserStaminaTicket'].includes(profile.table)) assert.equal(nativeReward[profile.table][0].bookEntryState,1);
      assert.deepEqual(snapshot().profiles,before.profiles,'Only the native callback can save the new item signature');
      const queued=snapshot();await close();await open();assert.deepEqual(snapshot(),queued);
      assert.deepEqual(JSON.parse((await send(draw)).body),drawn);
      assert.equal((await send(save(),'user_data/push')).status,200);
      assert.deepEqual(snapshot(),queued,'A no-effect push must not mark old capped stock as a saved draw');
      assert.equal((await send(save(counts,drawn.operations),'user_data/push')).status,400);
      assert.deepEqual(snapshot(),queued,'Full saved ticket/count targets cannot ACK the old native signature');
      for(const changes of [{policy:'offline-event-box-v2'},
        {rewardStocks:[{...capture.rewardStocks[0],signature:0}]},
        {rewardStocks:[{...capture.rewardStocks[0],signature:initial.signature}]},
        {rewardStocks:[{...capture.rewardStocks[0],signature:operation.signature===1?2:1}]},
        {rewardStocks:[{...capture.rewardStocks[0],beforeSignature:-1}]},
        {rewardStocks:[{...capture.rewardStocks[0],beforeSignature:0x100000000}]},
        {rewardStocks:[Object.fromEntries(Object.entries(capture.rewardStocks[0]).filter(([key])=>key!=='beforeSignature'))]}]) {
        app.store.db.prepare('UPDATE event_box_request SET draw_state=? WHERE operation_id=?').run(JSON.stringify({...capture,...changes}),operation.id);
        const corrupt=snapshot();assert.equal((await send(draw)).status,503);assert.deepEqual(snapshot(),corrupt);
        app.store.db.prepare('UPDATE event_box_request SET draw_state=? WHERE operation_id=?').run(receipt.draw_state,operation.id);
      }
      for(const badSignature of [initial.signature,0,operation.signature===1?2:1,'1',-1,0x100000000]) {
        const malformed=save({...counts,[profile.table]:[{...nativeReward[profile.table][0],signature:badSignature}]},drawn.operations);
        assert.equal((await send(malformed,'user_data/push')).status,400);assert.deepEqual(snapshot(),queued);
      }
      if(order!=='together') {
        const first=save(order==='signature-first'?nativeReward:counts);
        for(const [table,event] of [['profile','UPDATE'],['event_box_request','UPDATE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER full_cap_save_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'full-cap split rollback'); END`);
          assert.equal((await send(first,'user_data/push')).status,503);assert.deepEqual(snapshot(),queued);app.store.db.exec('DROP TRIGGER full_cap_save_fail');
        }
        assert.equal((await send(first,'user_data/push')).status,200);await close();await open();
        const recovered=await send(draw);assert.equal(recovered.status,200,recovered.body.toString());
        const recoveredOperation=JSON.parse(recovered.body).operations[0];
        assert.equal(recoveredOperation.parameters.consumedItem.amount,order==='counts-first'?0:drawn.consumedItem.amount);
        assert.ok(recoveredOperation.parameters.chosenItems.every(row=>row.amount===0 &&
          row.offlineEventBoxLifetimeControl===(order==='counts-first'?1:-1)),
          'Full-cap recovery runs a zero gain only when the native signature is still unsaved');
        assert.ok(app.store.operations().some(row=>row.id===operation.id));
        const partial=snapshot();assert.equal((await send(save({},drawn.operations),'user_data/push')).status,400);assert.deepEqual(snapshot(),partial);
        if(order==='counts-first') {
          assert.equal(snapshot().requests[0].reward_seen,'[]','Cost/counters cannot invent a full-cap signature observation');
          nativeReward[profile.table][0].amount=0;
          assert.equal((await send(save(nativeReward),'user_data/push')).status,200,
            'The actual new signature proves the native callback even if stock was spent before its first save');
        } else {
          const acquired=app.store.read(profile.table).data.find(row=>row[profile.idField]===itemId);
          assert.equal((await send(save({[profile.table]:[{...acquired,amount:0,signature:9}]}),'user_data/push')).status,200,
            'After recording the actual draw, later valid signature changes and spending do not erase that proof');
        }
        assert.deepEqual(JSON.parse(snapshot().requests[0].reward_seen),[itemId]);
        const observed=snapshot(),acquired=app.store.read(profile.table).data.find(row=>row[profile.idField]===itemId);
        assert.notEqual((await send(save({[profile.table]:[{...acquired,cumulativeAmount:999999998}]}),'user_data/push')).status,200);
        assert.notEqual((await send(save({},[],{[profile.table]:[acquired]}),'user_data/push')).status,200);
        assert.deepEqual(snapshot(),observed);await close();await open();
      } else if(prize.requiredForReset) counts.UserEventBoxContent=drawn.UserEventBoxContent
        .map(row=>({...row,pickedAmount:0,lappedCount:row.lappedCount+1,rateVariationState:2}));
      const finalSave=save(order==='together'?{...counts,...nativeReward}:order==='signature-first'?counts:{},drawn.operations);
      for(const [table,event] of [['event_box_request','UPDATE'],['operation_done','INSERT'],['reply_cache','INSERT']]) {
        const pending=snapshot();app.store.db.exec(`CREATE TRIGGER full_cap_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'full-cap ACK rollback'); END`);
        assert.equal((await send(finalSave,'user_data/push')).status,503);assert.deepEqual(snapshot(),pending);app.store.db.exec('DROP TRIGGER full_cap_ack_fail');
      }
      const acknowledged=await send(finalSave,'user_data/push'),ackSequence=sequence;assert.equal(acknowledged.status,200,acknowledged.body.toString());
      assert.deepEqual(app.store.operations(),[]);assert.ok(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id));
      const acquired=app.store.read(profile.table).data.find(row=>row[profile.idField]===itemId);
      assert.equal(acquired.cumulativeAmount,999999999);assert.equal(acquired.amount,order==='together'?maximum:0);
      const settled=snapshot();await close();await open();assert.deepEqual(snapshot(),settled);
      assert.deepEqual((await request(port,ackSequence,finalSave,String(ackSequence),'user_data/push')).body,acknowledged.body);
      assert.equal((await request(port,drawSequence,draw,String(drawSequence),'event_box/draw')).status,503);assert.deepEqual(snapshot(),settled);
    }
    //WRITTEN ONLY / NOT RUN: date pruning is not15000 proof;2576654 writes the actual signature after append/prune.
    const datedCapPrizes=['gacha_ticket.normal','gacha_ticket.character_3'].map(key=>{
      const entry=Object.entries(master.eventBoxes).find(([,original])=>!original.bonusKey && !original.bonusEvery &&
        !original.steps[0].boostEnabled && original.steps[0].contents.some(prize=>prize.rewardKey===key && (!prize.limited || prize.limit>=2)));
      assert.ok(entry,`Original first-step ticket prize unavailable: ${key}`);
      const [id,original]=entry,step=original.steps[0];
      return [Number(id),original,step,step.contents.find(prize=>prize.rewardKey===key && (!prize.limited || prize.limit>=2))];
    });
    for(const [id,original,step,prize] of datedCapPrizes) for(const baseline of ['capped','exact','crossing']) for(const order of
      ['append-first','reward-first','counts-first','pruned-first','expired-before-save','empty-before',
        ...(baseline==='capped'?[]:['lifetime-first','signature-first'])]) {
      await close();database=path.join(directory,`dated-cap-${id}-${prize.id}-${baseline}-${order}.sqlite`);Date.now=()=>original.startAt*1000;await open();
      const itemId=master.items[prize.rewardKey],duration=master.lotteryTickets[itemId],draw={eventBoxId:id,drawCount:2},
        initial={userId:seed.userId,gachaTicketId:itemId,
          cumulativeAmount:baseline==='capped'?999999999:baseline==='exact'?999999999-2*prize.amount:999999998,bookEntryState:1,
          signature:order==='counts-first'?0xffffffff:7,dateList:order==='empty-before'?[]:
            [{aquiredAt:original.startAt-duration-1},{aquiredAt:original.startAt},{aquiredAt:original.startAt}]},
        tickets={...stock(1000),eventItemId:master.items[original.costKey]};
      assert.ok(duration>0);
      app.store.push(save({UserGachaTicket:[initial],UserEventItem:[tickets],UserEventBox:[{...box(0,step.id),eventBoxId:id}]}));
      forcedRoll=step.contents.slice(0,step.contents.indexOf(prize)).reduce((sum,row)=>sum+row.weight,0);
      const before=snapshot();
      for(const table of ['operation_queue','event_box_request','event_box_reward_claim','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER dated_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'dated issue rollback'); END`);
        assert.equal((await send(draw)).status,503);assert.deepEqual(snapshot(),before);app.store.db.exec('DROP TRIGGER dated_issue_fail');
      }
      const response=await send(draw);assert.equal(response.status,200,response.body.toString());
      const drawn=JSON.parse(response.body),operation=drawn.operations[0],drawSequence=sequence,receipt=snapshot().requests[0],
        capture=JSON.parse(receipt.draw_state),nativeReward=rewardDelta(drawn),nativeTicket=nativeReward.UserGachaTicket[0],
        counts={UserEventItem:[{...tickets,amount:1000-original.cost*draw.drawCount}],
          UserEventBox:[{...box(original.cost*draw.drawCount,step.id),eventBoxId:id}],
          UserEventBoxContent:drawn.UserEventBoxContent,UserEventBoxStep:drawn.UserEventBoxStep};
      nativeTicket.dateList=nativeTicket.dateList.filter(date=>original.startAt<date.aquiredAt+duration);
      assert.equal(capture.policy,'offline-event-box-v3');assert.equal(receipt.reward_seen,'[]');
      assert.deepEqual(capture.rewardStocks,[{itemId,beforeCumulative:initial.cumulativeAmount,beforeDates:initial.dateList,
        beforeSignature:initial.signature,signature:operation.signature}]);
      assert.deepEqual(JSON.parse(receipt.gacha_dates_added),[{itemId,amount:0}],
        'The private date allowance starts empty, not with a pre-granted native quantity');
      assert.notEqual(operation.signature,initial.signature);
      assert.ok(drawn.chosenItems.every(row=>row.itemId===itemId && row.amount===prize.amount));
      assert.equal(nativeTicket.dateList.length,(order==='empty-before'?0:2)+2*prize.amount,
        'Duplicate acquisition times remain separate dated tickets; only the expired old entry is pruned');
      assert.ok(!Object.hasOwn(nativeTicket,'amount'));assert.deepEqual(snapshot().profiles,before.profiles,
        'Issuing15000 neither grants dated stock nor forges its native signature');
      const queued=snapshot();await close();await open();assert.deepEqual(snapshot(),queued);
      assert.deepEqual(JSON.parse((await send(draw)).body),drawn);
      assert.equal((await send(save(counts,drawn.operations),'user_data/push')).status,400);assert.deepEqual(snapshot(),queued);
      const lotteryEntry=Object.entries(master.lotteries).find(([,lottery])=>lottery.ticketId===itemId &&
        !lottery.selectionGroupIds?.length && lottery.startAt<=original.startAt && (!lottery.endAt || original.startAt<lottery.endAt) &&
        lottery.buttons.some(button=>button.consumeType===2 && button.pickCount>0));
      assert.ok(lotteryEntry);
      const [lotteryId,lottery]=lotteryEntry,buttonIndex=lottery.buttons.findIndex(button=>button.consumeType===2 && button.pickCount>0),
        button=lottery.buttons[buttonIndex],paid=app.store.paidCurrency(),free=app.store.hardCurrency();
      const ticketDraw=await send({lotteryId:Number(lotteryId),buttonIndex:buttonIndex+1,drawCount:1,
        consumeAmount:button.consumeAmount,pickCount:button.pickCount,progressCount:0,currentStepIndex:0,isScratch:false,
        clientChargeHardCurrency:paid,clientFreeHardCurrency:free,clientTotalHardCurrency:paid+free},'lottery/ticket/draw');
      assert.equal(ticketDraw.status,400);assert.match(ticketDraw.body.toString(),/Capped event-box tickets/);assert.deepEqual(snapshot(),queued);
      for(const changes of [{policy:'offline-event-box-v2'},
        {rewardStocks:[{...capture.rewardStocks[0],beforeDates:null}]},
        {rewardStocks:[{...capture.rewardStocks[0],beforeDates:[{aquiredAt:original.startAt,expireAt:original.startAt+duration}]}]},
        {rewardStocks:[{...capture.rewardStocks[0],beforeCumulative:999999999-2*prize.amount-1}]},
        {rewardStocks:[{...capture.rewardStocks[0],beforeSignature:0x100000000}]},
        {rewardStocks:[{...capture.rewardStocks[0],signature:initial.signature}]},
        {rewardStocks:[Object.fromEntries(Object.entries(capture.rewardStocks[0]).filter(([key])=>key!=='beforeDates'))]}]) {
        app.store.db.prepare('UPDATE event_box_request SET draw_state=? WHERE operation_id=?').run(JSON.stringify({...capture,...changes}),operation.id);
        const corrupt=snapshot();assert.equal((await send(draw)).status,503);assert.deepEqual(snapshot(),corrupt);
        app.store.db.prepare('UPDATE event_box_request SET draw_state=? WHERE operation_id=?').run(receipt.draw_state,operation.id);
      }
      const stripped=Object.fromEntries(Object.entries({...capture,policy:'offline-event-box-v1'}).filter(([key])=>key!=='rewardStocks'));
      app.store.db.prepare('UPDATE event_box_request SET draw_state=? WHERE operation_id=?').run(JSON.stringify(stripped),operation.id);
      const downgraded=snapshot();assert.equal((await send(draw)).status,503);assert.deepEqual(snapshot(),downgraded);
      app.store.db.prepare('UPDATE event_box_request SET draw_state=? WHERE operation_id=?').run(receipt.draw_state,operation.id);
      for(const gacha_dates_added of [null,'[]','{',JSON.stringify([{itemId,amount:-1}]),
        JSON.stringify([{itemId,amount:2*prize.amount+1}]),JSON.stringify([{itemId,amount:1}]),
        JSON.stringify([{itemId,amount:0,extra:1}]),JSON.stringify([{itemId:1,amount:0}])]) {
        app.store.db.prepare('UPDATE event_box_request SET gacha_dates_added=? WHERE operation_id=?').run(gacha_dates_added,operation.id);
        const corrupt=snapshot();assert.equal((await send(draw)).status,503);assert.deepEqual(snapshot(),corrupt);
        app.store.db.prepare('UPDATE event_box_request SET gacha_dates_added=? WHERE operation_id=?').run(receipt.gacha_dates_added,operation.id);
      }
      for(const changes of [{userId:0},{userId:2},{cumulativeAmount:999999998},{signature:initial.signature},
        {signature:-1},{signature:0x100000000},{signature:'1'},{bookEntryState:-129},{bookEntryState:128},
        {dateList:null},{dateList:[{aquiredAt:'1'}]},{dateList:[{aquiredAt:original.startAt,expireAt:original.startAt+duration}]},{amount:0}]) {
        assert.equal((await send(save({...counts,UserGachaTicket:[{...nativeTicket,...changes}]},drawn.operations),'user_data/push')).status,400);
        assert.deepEqual(snapshot(),queued,'A malformed dated row cannot settle the capped acquisition');
      }
      let finalPut={...counts,...nativeReward};
      if(order==='pruned-first') {
        const pruned={...initial,dateList:initial.dateList.slice(1)};
        assert.equal((await send(save({UserGachaTicket:[pruned]}),'user_data/push')).status,200);
        assert.equal(snapshot().requests[0].effect_seen,0);assert.equal(snapshot().requests[0].reward_seen,'[]');
        await close();await open();assert.deepEqual(JSON.parse((await send(draw)).body),drawn,
          'Natural expiry alone must leave the unapplied original callback deliverable');
      } else if(order==='expired-before-save') nativeTicket.dateList=[];
      else if(['append-first','reward-first','counts-first','lifetime-first','signature-first'].includes(order)) {
        const first=order==='counts-first'?counts:{UserGachaTicket:[order==='append-first'?{...nativeTicket,signature:initial.signature}:
          order==='lifetime-first'?{...initial,cumulativeAmount:999999999}:order==='signature-first'?{...initial,signature:operation.signature}:nativeTicket]},
          pending=snapshot();
        for(const [table,event] of [['profile','UPDATE'],['event_box_request','UPDATE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER dated_partial_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'dated partial rollback'); END`);
          assert.equal((await send(save(first),'user_data/push')).status,503);assert.deepEqual(snapshot(),pending);app.store.db.exec('DROP TRIGGER dated_partial_fail');
        }
        if(order==='append-first') {
          app.store.db.exec("CREATE TRIGGER dated_allowance_fail BEFORE UPDATE OF gacha_dates_added ON event_box_request BEGIN SELECT RAISE(ABORT,'date allowance rollback'); END");
          assert.equal((await send(save(first),'user_data/push')).status,503);assert.deepEqual(snapshot(),pending,
            'The native profile/token, effect marker and date allowance roll back if allowance persistence fails');
          app.store.db.exec('DROP TRIGGER dated_allowance_fail');
        }
        assert.equal((await send(save(first),'user_data/push')).status,200);await close();await open();
        const replayed=await send(draw);
        assert.equal(replayed.status,200,replayed.body.toString());
        assert.ok(app.store.operations().some(row=>row.id===operation.id));
        assert.equal(app.store.eventBoxDelivery(operation,'user_data/push'),false);
        for(const action of ['user/login','user_data/pull','user_data/confirm'])
          assert.equal(app.store.eventBoxDelivery(operation,action),true);
        const projected=JSON.parse(replayed.body).operations[0].parameters.chosenItems,
          grant=2*prize.amount,lifetime=999999999-initial.cumulativeAmount;
        if(order==='reward-first') assert.ok(projected.every(row=>row.amount===0 && row.offlineEventBoxLifetimeControl===-1));
        else {
          assert.equal(projected.reduce((sum,row)=>sum+row.amount,0),order==='append-first'?0:grant);
          assert.equal(projected.reduce((sum,row)=>sum+row.offlineEventBoxLifetimeControl-1,0),
            ['append-first','lifetime-first'].includes(order)?0:lifetime);
        }
        assert.deepEqual(JSON.parse(snapshot().requests[0].reward_seen),order==='reward-first'?[itemId]:[]);
        const partial=snapshot();assert.equal((await send(save({},drawn.operations),'user_data/push')).status,400);assert.deepEqual(snapshot(),partial);
        assert.deepEqual(JSON.parse(snapshot().requests[0].gacha_dates_added),[{itemId,
          amount:['counts-first','lifetime-first','signature-first'].includes(order)?0:2*prize.amount}]);
        if(order==='lifetime-first') {
          const current={...initial,cumulativeAmount:999999999},held=snapshot();
          assert.equal((await send(save({UserGachaTicket:[{...current,cumulativeAmount:initial.cumulativeAmount}]}),'user_data/push')).status,400);
          assert.deepEqual(snapshot(),held,'A partial capped dated acquisition cannot rewind its saved lifetime');
        }
        if(['lifetime-first','signature-first'].includes(order)) {
          const capturedPartial=snapshot().requests[0];
          app.store.db.prepare('UPDATE event_box_request SET gacha_dates_added=NULL WHERE operation_id=?').run(operation.id);
          const lost=snapshot();assert.equal((await send(draw)).status,503);assert.deepEqual(snapshot(),lost);
          app.store.db.prepare('UPDATE event_box_request SET gacha_dates_added=? WHERE operation_id=?').run(capturedPartial.gacha_dates_added,operation.id);
        }
        if(order==='append-first') {
          const extra={...nativeTicket,signature:initial.signature,dateList:[...nativeTicket.dateList,{aquiredAt:original.startAt}]};
          assert.equal((await send(save({UserGachaTicket:[extra]}),'user_data/push')).status,400);assert.deepEqual(snapshot(),partial,
            'A second partial save cannot spend the same original date allowance again');
          const counter=snapshot().requests[0].gacha_dates_added;
          app.store.db.prepare('UPDATE event_box_request SET gacha_dates_added=? WHERE operation_id=?')
            .run(JSON.stringify([{itemId,amount:0}]),operation.id);
          const corrupt=snapshot();assert.equal((await send(draw)).status,503);assert.deepEqual(snapshot(),corrupt);
          app.store.db.prepare('UPDATE event_box_request SET gacha_dates_added=? WHERE operation_id=?').run(counter,operation.id);
          const pruned={...nativeTicket,signature:initial.signature,dateList:nativeTicket.dateList.slice(1)};
          assert.equal((await send(save({UserGachaTicket:[pruned]}),'user_data/push')).status,200);await close();await open();
          const spent=snapshot();assert.equal((await send(save(first),'user_data/push')).status,400);assert.deepEqual(snapshot(),spent,
            'Pruning a saved partial stock does not replenish the original reward allowance');
          nativeTicket.dateList=pruned.dateList;
        }
        if(order==='reward-first') {
          const receipt=snapshot().requests[0];
          app.store.db.prepare("UPDATE event_box_request SET reward_seen='[]' WHERE operation_id=?").run(operation.id);
          const lost=snapshot();assert.equal((await send(draw)).status,503);assert.deepEqual(snapshot(),lost,
            'An actual issued signature plus capped lifetime cannot reconstruct a lost dated observation');
          app.store.db.prepare('UPDATE event_box_request SET reward_seen=? WHERE operation_id=?').run(receipt.reward_seen,operation.id);
          assert.equal((await send(save({UserGachaTicket:[{...nativeTicket,dateList:[],signature:9}]}),'user_data/push')).status,200);
          assert.deepEqual(JSON.parse(snapshot().requests[0].reward_seen),[itemId]);finalPut=counts;
          const observed=snapshot();assert.equal((await send(save(nativeReward),'user_data/push')).status,400);assert.deepEqual(snapshot(),observed,
            'The real signature consumes any unobserved allowance; expired/spent dates cannot reappear before ACK');
        } else if(order==='counts-first') {nativeTicket.dateList=[];finalPut=nativeReward;}
      }
      const finalSave=save(finalPut,drawn.operations);
      for(const [table,event] of [['event_box_request','UPDATE'],['operation_done','INSERT'],['reply_cache','INSERT']]) {
        const pending=snapshot();app.store.db.exec(`CREATE TRIGGER dated_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'dated ACK rollback'); END`);
        assert.equal((await send(finalSave,'user_data/push')).status,503);assert.deepEqual(snapshot(),pending);app.store.db.exec('DROP TRIGGER dated_ack_fail');
      }
      const acknowledged=await send(finalSave,'user_data/push'),ackSequence=sequence;assert.equal(acknowledged.status,200,acknowledged.body.toString());
      assert.deepEqual(app.store.operations(),[]);assert.ok(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id));
      assert.deepEqual(JSON.parse(snapshot().requests[0].reward_seen),[itemId]);
      const acquired=app.store.read('UserGachaTicket').data.find(row=>row.gachaTicketId===itemId),settled=snapshot();
      assert.ok(!Object.hasOwn(acquired,'amount'));assert.equal(acquired.cumulativeAmount,999999999);
      await close();await open();assert.deepEqual(snapshot(),settled);
      assert.deepEqual((await request(port,ackSequence,finalSave,String(ackSequence),'user_data/push')).body,acknowledged.body);
      assert.equal((await request(port,drawSequence,draw,String(drawSequence),'event_box/draw')).status,503);assert.deepEqual(snapshot(),settled);
      for(const put of [{...acquired,cumulativeAmount:999999998},{...acquired,userId:2}]) {
        assert.notEqual((await send(save({UserGachaTicket:[put]}),'user_data/push')).status,200);assert.deepEqual(snapshot(),settled);
      }
      assert.notEqual((await send(save({},[],{UserGachaTicket:[acquired]}),'user_data/push')).status,200);assert.deepEqual(snapshot(),settled);
      const pruned={...acquired,dateList:acquired.dateList.slice(1)};
      assert.equal((await send(save({UserGachaTicket:[pruned]}),'user_data/push')).status,200);await close();await open();
      const checkpoint=snapshot();
      for(const dateList of [[...pruned.dateList,{aquiredAt:original.startAt}],
        ...(acquired.dateList.length?[acquired.dateList]:[])]) {
        assert.equal((await send(save({UserGachaTicket:[{...pruned,signature:9,dateList}]}),'user_data/push')).status,400);
        assert.deepEqual(snapshot(),checkpoint,'Neither a changed signature nor a restart restores completed spent/expired stock');
      }
      const secondWire=await send({eventBoxId:id,drawCount:1});assert.equal(secondWire.status,200,secondWire.body.toString());
      const second=JSON.parse(secondWire.body),secondOperation=second.operations[0],secondReward=rewardDelta(second),
        beforeCost=app.store.read('UserEventItem').data.find(row=>row.eventItemId===tickets.eventItemId),
        beforeBox=app.store.read('UserEventBox').data.find(row=>row.eventBoxId===id),
        secondCounts={UserEventItem:[{...beforeCost,amount:beforeCost.amount-second.consumedItem.amount}],
          UserEventBox:[{...beforeBox,totalDrawCount:beforeBox.totalDrawCount+second.consumedItem.amount}],
          UserEventBoxContent:second.UserEventBoxContent,UserEventBoxStep:second.UserEventBoxStep};
      assert.equal(secondReward.UserGachaTicket[0].dateList.length,pruned.dateList.length+prize.amount);
      assert.notEqual(secondOperation.signature,pruned.signature);await close();await open();
      assert.equal((await send(save({...secondCounts,...secondReward},second.operations),'user_data/push')).status,200,
        'A new original capped reward grants only its own quantity after the earlier checkpoint');
      assert.deepEqual(app.store.operations(),[]);
      const nextSettled=snapshot(),nextTicket=app.store.read('UserGachaTicket').data.find(row=>row.gachaTicketId===itemId);
      assert.equal((await send(save({UserGachaTicket:[{...nextTicket,dateList:[...nextTicket.dateList,{aquiredAt:original.startAt}]}]}),'user_data/push')).status,400);
      assert.deepEqual(snapshot(),nextSettled,'The new real ACK also closes its date allowance');
    }
    //WRITTEN ONLY / NOT RUN: an older1000 full ticket replacement must ACK before a same-item capped15000 addition.
    for(const [id,original,step,prize] of datedCapPrizes) for(const baseline of ['capped','exact','crossing']) {
      await close();database=path.join(directory,`dated-consumer-first-${id}-${prize.id}-${baseline}.sqlite`);Date.now=()=>original.startAt*1000;await open();
      const itemId=master.items[prize.rewardKey],drawCount=baseline==='capped'?1:2,
        initial={userId:seed.userId,gachaTicketId:itemId,
        cumulativeAmount:baseline==='capped'?999999999:baseline==='exact'?999999999-drawCount*prize.amount:999999998,
        bookEntryState:1,signature:7,dateList:[{aquiredAt:original.startAt},{aquiredAt:original.startAt}]},
        tickets={...stock(1000),eventItemId:master.items[original.costKey]};
      app.store.push(save({UserGachaTicket:[initial],UserEventItem:[tickets],UserEventBox:[{...box(0,step.id),eventBoxId:id}]}));
      const [lotteryId,lottery]=Object.entries(master.lotteries).find(([,lottery])=>lottery.ticketId===itemId &&
        !lottery.selectionGroupIds?.length && lottery.startAt<=original.startAt && (!lottery.endAt || original.startAt<lottery.endAt) &&
        lottery.buttons.some(button=>button.consumeType===2 && button.pickCount>0)),
        buttonIndex=lottery.buttons.findIndex(button=>button.consumeType===2 && button.pickCount>0),button=lottery.buttons[buttonIndex],
        paid=app.store.paidCurrency(),free=app.store.hardCurrency();
      forcedRoll=0;
      const wire=await send({lotteryId:Number(lotteryId),buttonIndex:buttonIndex+1,drawCount:1,consumeAmount:button.consumeAmount,
        pickCount:button.pickCount,progressCount:0,currentStepIndex:0,isScratch:false,
        clientChargeHardCurrency:paid,clientFreeHardCurrency:free,clientTotalHardCurrency:paid+free},'lottery/ticket/draw');
      assert.equal(wire.status,200,wire.body.toString());const lotteryResult=JSON.parse(wire.body),pending=snapshot();
      assert.equal(lotteryResult.userGachaTicket.dateList.length,1);
      forcedRoll=step.contents.slice(0,step.contents.indexOf(prize)).reduce((sum,row)=>sum+row.weight,0);
      await close();await open();assert.deepEqual(snapshot(),pending);
      const blocked=await send({eventBoxId:id,drawCount});assert.equal(blocked.status,503);
      assert.match(blocked.body.toString(),/pending lottery replacement/);assert.deepEqual(snapshot(),pending);
      assert.equal((await send(drawAcknowledgement(lotteryResult),'user_data/push')).status,200);
      await close();await open();const acknowledged=snapshot(),response=await send({eventBoxId:id,drawCount});
      assert.equal(response.status,200,response.body.toString());const drawn=JSON.parse(response.body),receipt=snapshot().requests[0];
      assert.deepEqual(JSON.parse(receipt.draw_state).rewardStocks[0].beforeDates,lotteryResult.userGachaTicket.dateList);
      assert.deepEqual(snapshot().profiles,acknowledged.profiles,'The captured baseline is the acknowledged post-spend native row, not an invented gain');
      const counts={UserEventItem:[{...tickets,amount:1000-original.cost*drawCount}],UserEventBox:[{...box(original.cost*drawCount,step.id),eventBoxId:id}],
        UserEventBoxContent:drawn.UserEventBoxContent,UserEventBoxStep:drawn.UserEventBoxStep};
      assert.equal((await send(save({...counts,...rewardDelta(drawn)},drawn.operations),'user_data/push')).status,200);
      assert.deepEqual(app.store.operations(),[]);
      const earned=app.store.read('UserGachaTicket').data.find(row=>row.gachaTicketId===itemId),settled=snapshot();
      assert.throws(()=>app.store.issueDraw(lotteryResult.lotteryPCs.map(row=>row.pcId),
        {userGachaTicket:{...earned,dateList:[...earned.dateList,{aquiredAt:original.startAt}]}},1000),/cannot be restored/);
      assert.deepEqual(snapshot(),settled,'The shared full-row issuer cannot restore completed ticket stock');
      forcedRoll=0;
      const progress=app.store.read('UserLottery').data.find(row=>row.lotteryId===Number(lotteryId)).buttons[buttonIndex].count,
        consumed=await send({lotteryId:Number(lotteryId),buttonIndex:buttonIndex+1,drawCount:1,consumeAmount:button.consumeAmount,
          pickCount:button.pickCount,progressCount:progress,currentStepIndex:0,isScratch:false,
          clientChargeHardCurrency:app.store.paidCurrency(),clientFreeHardCurrency:app.store.hardCurrency(),
          clientTotalHardCurrency:app.store.paidCurrency()+app.store.hardCurrency()},'lottery/ticket/draw');
      assert.equal(consumed.status,200,consumed.body.toString());const consumedResult=JSON.parse(consumed.body);
      assert.equal(consumedResult.userGachaTicket.dateList.length,earned.dateList.length-button.consumeAmount);
      await close();await open();const spent=snapshot();
      assert.equal((await send(save({UserGachaTicket:[earned]}),'user_data/push')).status,400);assert.deepEqual(snapshot(),spent,
        'The durable primary profile also records actual queued ticket consumption before its unit ACK');
      assert.equal((await send(drawAcknowledgement(consumedResult),'user_data/push')).status,200);
      assert.deepEqual(app.store.operations(),[]);
    }
    // Actual original box/shop requests, in both issue orders. Funding is
    // synthetic; this checks shared reservations, not natural Seiros earning.
    for (const boxFirst of [true, false]) {
      await close(); database = path.join(directory, `box-shop-${boxFirst}.sqlite`);
      Date.now = () => master.eventBoxes[193000001].startAt * 1000; forcedRoll = 0; await open();
      const productId = 207000009, product = master.shopProducts[productId];
      assert.equal(product.rewardId, master.items['gacha_ticket.character_3']);
      const coin = { userId: seed.userId, currencyId: product.priceItemId, amount: product.price,
        cumulativeAmount: product.price, reservedAmount: 0, signature: 0 };
      app.store.push(save({ UserEventItem: [stock(1000)], UserCurrency: [coin] }));
      const buy = async () => {
        app.store.push(save({ UserCurrency: [{ ...coin, amount: 0 }] }, [], {}, 'SeirosShopBuy'));
        const response = await send({ shopProductId: productId }, 'shop/buy');
        assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body);
      };
      const draw = async () => {
        const response = await send({ ...body, drawCount: 1 });
        assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body);
      };
      let drawn, bought;
      if (boxFirst) { drawn = await draw(); bought = await buy(); }
      else { bought = await buy(); drawn = await draw(); }
      const drawOp = drawn.operations[0], shopOp = bought.operations[0];
      const first = boxFirst ? drawOp : shopOp, second = boxFirst ? shopOp : drawOp;
      const boxTarget = snapshot().rewards.find(row => row.operation_id === drawOp.id);
      const shopReceipt = app.store.db.prepare('SELECT rewards FROM shop_request WHERE operation_id=?').get(shopOp.id);
      const shopTarget = JSON.parse(shopReceipt.rewards)[0].cumulative;
      assert.equal(boxTarget.cumulative_amount, boxFirst ? 1 : 2);
      assert.equal(shopTarget, boxFirst ? 2 : 1);
      const oneTicket = rewardDelta(drawn).UserGachaTicket[0];
      app.store.push(save({ ...countDelta(drawn, 1000 - drawn.consumedItem.amount, drawn.consumedItem.amount),
        UserGachaTicket: [oneTicket], UserShopProduct: [{ userId: seed.userId, shopProductId: productId,
          count: bought.count, lastExchangedAt: bought.lastExchangedAt, readState: 1 }] }));
      const partial = snapshot();
      assert.throws(() => app.store.push(save({}, [first, second])), /saved (reward )?inventory/);
      assert.throws(() => app.store.push(save({}, [second])), /saved (reward )?inventory/);
      assert.deepEqual(snapshot(), partial, 'One acquisition cannot acknowledge both sources');
      app.store.push(save({}, [first])); await close(); await open();
      assert.throws(() => app.store.push(save({}, [second])), /saved (reward )?inventory/);
      const secondTicket = { ...oneTicket, cumulativeAmount: 2,
        dateList: [...oneTicket.dateList, { aquiredAt: Math.floor(Date.now() / 1000) }] };
      app.store.push(save({ UserGachaTicket: [secondTicket] }, [second]));
      await close(); await open();
      assert.deepEqual(app.store.operations(), []);
      assert.equal(app.store.read('UserGachaTicket').data[0].cumulativeAmount, 2);
      assert.equal(app.store.read('UserCurrency').data.find(row => row.currencyId === product.priceItemId).amount, 0);
      assert.equal(app.store.read('UserEventItem').data[0].amount, 1000 - drawn.consumedItem.amount);
    }
    console.log('Event boxes: permanent received-wire identities, native100/bonus10 batch limits, affordable clamps, original pools,98 boost catalogs/1470 metadata steps, offline guarantee transitions,3 implicit bonus catalogs, replacement/negative/no-op/capped saves, partial delivery suppression, all8 inventory types, repeat rounds, atomic ACK/restart; native UI and publisher boost/RNG parity unverified');
  } finally {
    Date.now = realNow; crypto.randomInt = realRandomInt;
    await close(); fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
