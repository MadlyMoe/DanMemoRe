'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('./danmemore_server.cjs');
const { request, drawAcknowledgement } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const { poolRates, lotteryGuarantee } = require('./gacha_details.cjs');

async function main() {
  // WRITTEN ONLY: inventory every enabled authored button/step before native acceptance.
  let enabledButtons=0;
  const unresolved=[];
  for(const [id,lottery] of Object.entries(master.lotteries)) for(const button of lottery.buttons) {
    if(!button?.pickCount) continue;
    enabledButtons++;
    const steps=button.stepUpGroupId ? master.lotteryStepUps?.[button.stepUpGroupId] : [null];
    if(!steps?.length) {unresolved.push([Number(id),'missing-step-group',button.stepUpGroupId]);continue;}
    for(const step of steps) {
      const current=step ? {...button,...step} : button,group=step?.groupId ?? lottery.groupId,
        guarantee=lotteryGuarantee(master,lottery,current,current.fixedGroupId,group);
      if(!guarantee || !poolRates(master,group,lottery) ||
          guarantee.groupId && !poolRates(master,guarantee.groupId,lottery))
        unresolved.push([Number(id),step?.stepIndex ?? 0,group]);
    }
    for(const milestone of master.lotterySteps?.[id] ?? [])
      if(milestone.groupId && !poolRates(master,milestone.groupId,lottery))
        unresolved.push([Number(id),'milestone',milestone.groupId]);
  }
  assert.equal(enabledButtons,3638);
  assert.deepEqual(unresolved,[]);
  assert.equal(master.lotteries[171001832].special, false, 'Catalog grouping must not disable an ordinary ticket draw');
  assert.equal(master.lotteries[171001834].special, true, 'Character-selection ticket rules must stay gated');
  const root = fs.mkdtempSync(path.join(process.cwd(), '.work', 'lottery-test-'));
  const database = path.join(root, 'profile.sqlite'), realNow = Date.now, realRandomInt = crypto.randomInt;
  let app, sequence = 0, roll = 0, chosenRoll = 0;
  try {
    // Exercise the actual old Iris banner in its original window, not a
    // fabricated production price or an expired-banner exemption.
    Date.now = () => Date.parse('2017-06-01T12:00:00Z');
    crypto.randomInt = (...args) => args.length === 1 ? (args[0] === 100 ? roll : args[0] === 3 ? chosenRoll : 0) : realRandomInt(...args);
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const send = (value, ticket = false) => request(app.server.address().port, sequence++, value, String(sequence), ticket ? 'lottery/ticket/draw' : 'lottery/draw');
    const ack = result => app.store.push(drawAcknowledgement(result));
    const saved = () => ({ profiles: app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all(),
      iris: app.store.hardCurrency(), operations: app.store.operations(),
      requests: app.store.db.prepare('SELECT * FROM lottery_request ORDER BY operation_id').all(),
      done: app.store.db.prepare('SELECT * FROM operation_done ORDER BY id').all() });
    const pushLotteryRows=rows=>app.store.push({badges:null,dataTokens:{},scripts:{},operations:[],
      checksums:{before:{},after:{UserLottery:crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex')}},
      deltas:[{signature:0,trigger:'LotteryDraw',deleteItems:{},putItems:{UserLottery:rows}}]});
    const body = { lotteryId: 171000002, buttonIndex: 2, consumeAmount: 40, pickCount: 1,
      progressCount: 0, currentStepIndex: 0, isScratch: false, clientChargeHardCurrency: 0,
      clientFreeHardCurrency: 100, clientTotalHardCurrency: 100 };
    app.store.changeHardCurrency(100);
    const first = await send(body);
    assert.equal(first.status, 200, first.body.toString());
    const result = JSON.parse(first.body), state = saved();
    assert.deepEqual(JSON.parse(app.store.db.prepare('SELECT selection_json FROM lottery_draw_claim WHERE operation_id=?')
      .get(result.operation.id).selection_json),{policy:'offline-lottery-selector-none-v1',lotteryId:body.lotteryId});
    assert.deepEqual(result.lotteryPCs, [{ pcId: 1011001005, isFirst: true }]);
    assert.equal(app.store.hardCurrency(), 60);
    assert.equal(result.UserLottery[0].buttons[1].count, 1);
    // WRITTEN ONLY / NOT RUN: a native save cannot invent a second paid draw.
    const forgedFirst={...result.UserLottery[0],buttons:result.UserLottery[0].buttons.map(row=>
      row.buttonType===2 ? {...row,count:2} : row)};
    assert.throws(()=>app.store.push(drawAcknowledgement(result,{UserLottery:[forgedFirst]})),
      /Saved lottery purchase count must match the issued draw/);
    assert.deepEqual(saved(),state,'Forged forward progress cannot save the award or change its charge');
    // WRITTEN ONLY / NOT RUN: same-count saves cannot rewrite the issued timestamp or non-step state before ACK.
    for(const changed of [{lastPickedAt:result.UserLottery[0].buttons[1].lastPickedAt+1},{loopCount:1},
      {currentStepIndex:result.UserLottery[0].buttons[1].currentStepIndex+1}]) {
      const forged={...result.UserLottery[0],buttons:result.UserLottery[0].buttons.map(row=>
        row.buttonType===2?{...row,...changed}:row)};
      assert.throws(()=>app.store.push(drawAcknowledgement(result,{UserLottery:[forged]})),
        /Saved pending lottery button must match its issued draw/);
      assert.deepEqual(saved(),state,'A same-count pending save cannot rewrite its captured button state');
    }
    assert.equal(app.store.pull({ tables: ['UserPC'] }).data.UserPC.some(row => row.pcId === 1011001005), false,
      'Pending unit must reach native addDrawedPc without an already-existing placeholder');
    const prematureAck = drawAcknowledgement(result);
    prematureAck.deltas = []; prematureAck.checksums.after = {};
    assert.throws(() => app.store.push(prematureAck), /missing an initialized unit/);
    assert.deepEqual(saved(), state, 'An empty acknowledgement must not discard an unapplied award');
    assert.throws(() => app.store.issueDraw([1011002001], {}, 1001), /already pending/);
    assert.deepEqual(saved(), state, 'Tutorial and regular draws cannot overlap');
    roll = 99;
    assert.deepEqual(JSON.parse((await send(Object.fromEntries(Object.entries(body).reverse()))).body), result);
    assert.deepEqual(saved(), state, 'Retry must not reroll, debit, or modify counters');
    const pendingLotteryRows = app.store.read('UserLottery').data;
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([
      ...pendingLotteryRows, { userId: seed.userId + 1, lotteryId: body.lotteryId, buttons: [] }]), 'UserLottery');
    assert.equal((await send(body)).status, 400, 'Pending draw retry cannot ignore foreign saved lottery progress');
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify(pendingLotteryRows), 'UserLottery');
    assert.deepEqual(saved(), state, 'Rejected pending retry retains its original operation and wallet');
    assert.equal((await send({ ...body, selectedPcId1: 1011002001 })).status, 400);
    assert.deepEqual(saved(), state);
    app.store.db.exec("CREATE TRIGGER fail_ack BEFORE DELETE ON operation_queue BEGIN SELECT RAISE(ABORT,'injected acknowledgement failure'); END");
    assert.throws(() => ack(result), /injected acknowledgement failure/);
    assert.deepEqual(saved(), state, 'Initialized unit and acknowledgement commit atomically');
    app.store.db.exec('DROP TRIGGER fail_ack');
    app.store.push({ ...drawAcknowledgement(result), operations: [] });
    assert.equal(app.store.read('UserPC').data.find(row => row.pcId === 1011001005).joiningState, 1);
    const savedBeforeAck = saved();
    assert.equal(app.store.operations().length, 1, 'A unit delta may arrive before its acknowledgment');
    await app.close();
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    assert.deepEqual(saved(), savedBeforeAck, 'An initialized unit is not removed/reset while its acknowledgment is pending');
    app.store.push(prematureAck);
    app.store.push(prematureAck); // Already completed acknowledgements remain idempotent.
    const settledLotteryRows=app.store.read('UserLottery').data,settledState=saved();
    pushLotteryRows(settledLotteryRows);
    assert.deepEqual(saved(),settledState,'An exact completed lottery row remains a valid delayed native save');
    for(const changed of [{lastPickedAt:0},{loopCount:settledLotteryRows.find(row=>row.lotteryId===body.lotteryId)
      .buttons[1].loopCount+1},{currentStepIndex:settledLotteryRows.find(row=>row.lotteryId===body.lotteryId)
      .buttons[1].currentStepIndex+1}]) {
      const stale=settledLotteryRows.map(row=>row.lotteryId===body.lotteryId?{...row,buttons:row.buttons.map(button=>
        button.buttonType===2?{...button,...changed}:button)}:row);
      assert.throws(()=>pushLotteryRows(stale),/Saved lottery timestamp, loop or step must match authoritative progress/);
      assert.deepEqual(saved(),settledState,'A delayed same-count save cannot rewrite completed lottery progress');
    }
    const next = { ...body, progressCount: 1, clientFreeHardCurrency: 60, clientTotalHardCurrency: 60 };
    const lotteryRows = app.store.read('UserLottery').data, ownedLottery = lotteryRows.find(row => row.lotteryId === body.lotteryId);
    const putLottery = rows => app.store.db.prepare('UPDATE profile SET data=? WHERE name=?')
      .run(JSON.stringify(rows), 'UserLottery');
    for (const rows of [[...lotteryRows, { ...ownedLottery }],
      lotteryRows.map(row => row.lotteryId === body.lotteryId ? { ...row, userId: seed.userId + 1 } : row),
      lotteryRows.map(row => row.lotteryId === body.lotteryId ? { ...row, buttons: null } : row),
      lotteryRows.map(row => row.lotteryId === body.lotteryId ? { ...row, isNew: 'yes' } : row),
      ...['count','loopCount','currentStepIndex','lastPickedAt'].map(field => lotteryRows.map(row =>
        row.lotteryId === body.lotteryId ? { ...row, buttons: row.buttons.map(button =>
          button.buttonType === 2 ? { ...button, [field]: -1 } : button) } : row))]) {
      putLottery(rows);
      const retained = saved();
      assert.equal((await send(next)).status, 400, 'Duplicate, foreign or malformed lottery progress cannot fund a draw');
      assert.deepEqual(saved(), retained, 'Rejected saved progress cannot charge or rewrite the profile');
    }
    putLottery(lotteryRows);
    const beforeFailure = saved();
    app.store.db.exec("CREATE TRIGGER fail_draw BEFORE INSERT ON operation_queue BEGIN SELECT RAISE(ABORT,'injected queue failure'); END");
    assert.equal((await send(next)).status, 503);
    assert.deepEqual(saved(), beforeFailure, 'Queue failure rolls back debit, PCs and lottery counters');
    app.store.db.exec('DROP TRIGGER fail_draw');
    const second = JSON.parse((await send(next)).body);
    assert.deepEqual(second.lotteryPCs, [{ pcId: 1012027002, isFirst: true }], 'Last weight bucket must remain reachable');
    assert.equal(app.store.hardCurrency(), 20);
    ack(second);
    const insufficient = { ...next, progressCount: 2, clientFreeHardCurrency: 20, clientTotalHardCurrency: 20 };
    const unchanged = saved();
    for (const change of [{}, { buttonIndex: 0 }, { consumeAmount: 0 }, { pickCount: 11 }, { progressCount: 0 },
      { clientFreeHardCurrency: 100, clientTotalHardCurrency: 100 }])
      assert.equal((await send({ ...insufficient, ...change })).status, 400);
    assert.equal((await send({ ...insufficient, buttonIndex: 3 })).status, 400, 'Guaranteed button must validate its original cost and count');
    assert.equal((await send({ ...insufficient, buttonIndex: 4 })).status, 400);
    assert.deepEqual(saved(), unchanged);

    app.store.changeHardCurrency(800);
    const guaranteedBody = { ...body, buttonIndex: 3, consumeAmount: 400, pickCount: 11,
      clientFreeHardCurrency: 820, clientTotalHardCurrency: 820 };
    const guaranteedGroup = master.lotteries[body.lotteryId].buttons[2].fixedGroupId;
    const guaranteedPc = Object.values(master.lotteryPools[guaranteedGroup]).at(-1)[0];
    const originalPool = master.lotteryPools[guaranteedGroup], beforeMissingPool = saved();
    try {
      delete master.lotteryPools[guaranteedGroup];
      assert.equal((await send(guaranteedBody)).status, 503);
      assert.deepEqual(saved(), beforeMissingPool, 'Missing guaranteed pool must never fall back or spend currency');
    } finally { master.lotteryPools[guaranteedGroup] = originalPool; }
    const guaranteed = JSON.parse((await send(guaranteedBody)).body);
    assert.deepEqual(guaranteed.lotteryPCs.map(row => row.pcId), [...Array(9).fill(1012027002), guaranteedPc, guaranteedPc]);
    assert.equal(guaranteed.UserLottery[0].buttons[2].count, 1, 'Eleven units consume one purchase count');
    assert.equal(guaranteed.UserLottery[0].buttons[1].count, 2, 'Other button progress is preserved');
    assert.equal(app.store.hardCurrency(), 420);
    const afterGuarantee = saved();
    assert.deepEqual(JSON.parse((await send(guaranteedBody)).body), guaranteed);
    assert.deepEqual(saved(), afterGuarantee);
    ack(guaranteed);
    const guaranteedAgain = JSON.parse((await send({ ...guaranteedBody, progressCount: 1,
      clientFreeHardCurrency: 420, clientTotalHardCurrency: 420 })).body);
    assert.equal(guaranteedAgain.UserLottery[0].buttons[2].count, 2);
    assert.equal(guaranteedAgain.UserPC.length, 0);
    assert.equal(app.store.hardCurrency(), 20);
    ack(guaranteedAgain);

    Date.now = () => Date.parse('2018-04-15T12:00:00Z');
    app.store.changeHardCurrency(8000);
    const steps = master.lotteryStepUps[450000006];
    putLottery([...app.store.read('UserLottery').data, { userId: seed.userId, lotteryId: 171000121,
      isNew: false, buttons: [{ buttonType: 3, count: 0, lastPickedAt: 0, loopCount: 1, currentStepIndex: 1 }] }]);
    for (let purchase = 0; purchase < 22; purchase++) {
      const step = steps[Math.min(purchase, steps.length - 1)], iris = app.store.hardCurrency();
      const stepBody = { ...body, lotteryId: 171000121, buttonIndex: 3, pickCount: step.pickCount,
        consumeAmount: step.consumeAmount, currentStepIndex: step.stepIndex, progressCount: purchase,
        clientFreeHardCurrency: iris, clientTotalHardCurrency: iris };
      const beforeStep = saved();
      for (const change of [{ currentStepIndex: 0 }, { currentStepIndex: step.stepIndex + 1 }, { consumeAmount: step.consumeAmount - 1 }])
        assert.equal((await send({ ...stepBody, ...change })).status, 400);
      assert.deepEqual(saved(), beforeStep, 'Stale step or discount cannot advance progress');
      if (purchase === 4) {
        const pool = master.lotteryPools[step.fixedGroupId];
        try {
          delete master.lotteryPools[step.fixedGroupId];
          assert.equal((await send(stepBody)).status, 503);
          assert.deepEqual(saved(), beforeStep, 'Missing milestone pool does not debit or advance the step');
        } finally { master.lotteryPools[step.fixedGroupId] = pool; }
        app.store.db.exec("CREATE TRIGGER fail_step BEFORE INSERT ON operation_queue BEGIN SELECT RAISE(ABORT,'injected step failure'); END");
        assert.equal((await send(stepBody)).status, 503);
        assert.deepEqual(saved(), beforeStep, 'Step, Iris and units roll back together');
        app.store.db.exec('DROP TRIGGER fail_step');
      }
      const wire = await send(stepBody);
      assert.equal(wire.status, 200, wire.body.toString());
      const stepResult = JSON.parse(wire.body);
      const stepScheduleRow=app.store.db.prepare('SELECT schedule_json FROM lottery_draw_claim WHERE operation_id=?')
        .get(stepResult.operation.id),stepSchedule=JSON.parse(stepScheduleRow.schedule_json);
      assert.equal(stepSchedule.policy,'offline-lottery-schedule-v1');
      assert.equal(stepSchedule.currentStepIndex,step.stepIndex);
      assert.equal(stepSchedule.before.count,purchase);
      assert.equal(stepSchedule.after.currentStepIndex,Math.min(purchase+2,steps.length));
      assert.deepEqual(stepSchedule.pcIds,stepResult.lotteryPCs.map(row=>row.pcId));
      const pcAt = groupId => Object.values(master.lotteryPools[groupId]).at(-1)[0];
      assert.deepEqual(stepResult.lotteryPCs.map(row => row.pcId), [
        ...Array(step.pickCount - step.fixedCount).fill(pcAt(step.groupId)),
        ...Array(step.fixedCount).fill(pcAt(step.fixedGroupId)),
      ]);
      assert.equal(app.store.hardCurrency(), iris - step.consumeAmount);
      assert.equal(stepResult.UserLottery[0].buttons[2].count, purchase + 1);
      assert.equal(stepResult.UserLottery[0].buttons[2].loopCount, 1,
        'An imported native loop counter survives a valid step-up purchase');
      assert.equal(stepResult.UserLottery[0].buttons[2].currentStepIndex, Math.min(purchase + 2, steps.length));
      const afterStep = saved();
      if (purchase === 0) {
        // WRITTEN ONLY / NOT RUN: count and step cannot be rewound by a native save in the same loop.
        for(const changed of [{count:0},{count:2},{currentStepIndex:1},{currentStepIndex:3},
          {loopCount:stepResult.UserLottery[0].buttons[2].loopCount+1,count:0,currentStepIndex:1}]) {
          const stale={...stepResult.UserLottery[0],buttons:stepResult.UserLottery[0].buttons.map(row=>
            row.buttonType===3 ? {...row,...changed} : row)};
          assert.throws(()=>app.store.push(drawAcknowledgement(stepResult,{UserLottery:[stale]})),
            /Saved step-up progress must match the issued draw/);
          assert.deepEqual(saved(),afterStep,'Rejected step-up rewind keeps its result and Iris');
        }
      }
      if (purchase === 4) {
        app.store.db.prepare('UPDATE lottery_draw_claim SET schedule_json=? WHERE operation_id=?')
          .run('{"policy":"corrupt"}',stepResult.operation.id);
        const corruptScheduleState=saved();
        assert.equal((await send(stepBody)).status,503);
        assert.deepEqual(saved(),corruptScheduleState,'Corrupt step schedule cannot charge, reroll or advance progress');
        app.store.db.prepare('UPDATE lottery_draw_claim SET schedule_json=? WHERE operation_id=?')
          .run(stepScheduleRow.schedule_json,stepResult.operation.id);
        await app.close();
        app = createServer({ database, seed, master, log: () => {} });
        await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
      }
      assert.deepEqual(JSON.parse((await send(stepBody)).body), stepResult);
      assert.deepEqual(saved(), afterStep, 'Pending step draw survives retry/restart without a second charge or advance');
      ack(stepResult);
    }
    assert.equal(app.store.hardCurrency(), 1220, 'Terminal fallback remains 400 Iris, not the initial discount');
    putLottery([...app.store.read('UserLottery').data, { userId: seed.userId, lotteryId: 171000122,
      isNew: false, buttons: [{ buttonType: 3, count: 6, lastPickedAt: 0, loopCount: 2, currentStepIndex: 2 }] }]);
    const importedStep = master.lotteryStepUps[450000007][1];
    const importedBody = { ...body, lotteryId: 171000122, buttonIndex: 3, pickCount: importedStep.pickCount,
      consumeAmount: importedStep.consumeAmount, currentStepIndex: 2, progressCount: 6,
      clientFreeHardCurrency: 1220, clientTotalHardCurrency: 1220 };
    const importedBefore = saved();
    assert.equal((await send({ ...importedBody, currentStepIndex: 7 })).status, 400);
    assert.deepEqual(saved(), importedBefore, 'The wire step cannot override the saved native step');
    const importedWire = await send(importedBody);
    assert.equal(importedWire.status, 200, importedWire.body.toString());
    const importedResult = JSON.parse(importedWire.body), importedButton = importedResult.UserLottery[0].buttons[2];
    assert.equal(importedButton.count, 7);
    assert.equal(importedButton.currentStepIndex, 3);
    assert.equal(importedButton.loopCount, 2);
    assert.equal(app.store.hardCurrency(), 970);
    app.store.push(drawAcknowledgement(importedResult,{UserLottery:importedResult.UserLottery}));
    app.store.changeHardCurrency(-950);

    Date.now = realNow;
    const now = Math.floor(Date.now() / 1000), duration = master.lotteryTickets[296000020];
    const expired = { aquiredAt: now - duration }, future = { aquiredAt: now + 86400 };
    const ticket = { userId: seed.userId, gachaTicketId: 296000020, bookEntryState: 1, signature: 0, cumulativeAmount: 6,
      dateList: [future, { aquiredAt: now }, expired, { aquiredAt: now - 2 }, { aquiredAt: now - 1 }] };
    const unrelated = { ...ticket, gachaTicketId: 296000001 };
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([unrelated, ticket]), 'UserGachaTicket');
    const ticketBody = { ...body, lotteryId: 171000132, consumeAmount: 1, drawCount: 2,
      clientFreeHardCurrency: 20, clientTotalHardCurrency: 20 };
    roll = 0;
    const ticketWire = await send(ticketBody, true);
    const ticketSequence=sequence-1,ticketRequestId=sequence;
    assert.equal(ticketWire.status, 200, ticketWire.body.toString());
    const ticketResult = JSON.parse(ticketWire.body), bondId = master.bonds[1011500001];
    assert.deepEqual(ticketResult.lotteryPCs, [{ pcId: 1011500001, isFirst: true }, { pcId: 1011500001, isFirst: false }]);
    assert.equal(ticketResult.UserPC.length, 1);
    assert.deepEqual(ticketResult.UserLimitBreakItem.map(row => [row.limitBreakItemId,row.amount,row.cumulativeAmount]), [[bondId,1,1]]);
    assert.deepEqual(ticketResult.userGachaTicket.dateList, [future, { aquiredAt: now }, expired]);
    assert.equal(ticketResult.userGachaTicket.cumulativeAmount, 6);
    assert.equal(ticketResult.UserLottery[0].buttons[1].count, 2);
    assert.deepEqual(app.store.read('UserGachaTicket').data.find(row => row.gachaTicketId === unrelated.gachaTicketId), unrelated);
    assert.equal(app.store.hardCurrency(), 20, 'Ticket draws never spend Iris');
    const ticketClaim=app.store.db.prepare('SELECT * FROM lottery_draw_claim WHERE operation_id=?').get(ticketResult.operation.id),
      ticketCapture=JSON.parse(ticketClaim.ticket_spend_json);
    assert.equal(ticketCapture.policy,'offline-lottery-ticket-spend-v1');
    assert.deepEqual(ticketCapture.spentIndices,[3,4]);
    assert.deepEqual(ticketCapture.after,ticketResult.userGachaTicket);
    const pending = saved();
    await app.close();
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const ticketSource=app.store.db.prepare('SELECT body_hash FROM lottery_request WHERE operation_id=?')
      .get(ticketResult.operation.id).body_hash;
    app.store.db.prepare('UPDATE lottery_request SET body_hash=? WHERE operation_id=?')
      .run('0'.repeat(32),ticketResult.operation.id);
    const corruptSource=saved();
    assert.equal((await request(app.server.address().port,ticketSequence,ticketBody,String(ticketRequestId),
      'lottery/ticket/draw')).status,503);
    assert.deepEqual(saved(),corruptSource,'A retry cannot detach its original ticket-draw request capture');
    app.store.db.prepare('UPDATE lottery_request SET body_hash=? WHERE operation_id=?')
      .run(ticketSource,ticketResult.operation.id);
    const resumed = await request(app.server.address().port, sequence++, ticketBody, String(sequence), 'lottery/ticket/draw');
    assert.equal(resumed.status, 200);
    assert.deepEqual(JSON.parse(resumed.body), ticketResult);
    assert.deepEqual(saved(), pending, 'Ticket dates and duplicate bonds survive restart without duplication');
    assert.equal(app.store.pull({ tables: ['UserPC'] }).data.UserPC.some(row => row.pcId === 1011500001), false);
    app.store.db.prepare('UPDATE lottery_draw_claim SET ticket_spend_json=? WHERE operation_id=?')
      .run('{"policy":"corrupt"}',ticketResult.operation.id);
    assert.equal((await request(app.server.address().port,ticketSequence,ticketBody,String(ticketRequestId),
      'lottery/ticket/draw')).status,503);
    app.store.db.prepare('UPDATE lottery_draw_claim SET ticket_spend_json=? WHERE operation_id=?')
      .run(ticketClaim.ticket_spend_json,ticketResult.operation.id);
    const missingTicket=drawAcknowledgement(ticketResult);
    delete missingTicket.deltas[0].putItems.UserGachaTicket;
    delete missingTicket.checksums.after.UserGachaTicket;
    assert.throws(()=>app.store.push(missingTicket),/exact saved expenditure/);
    // WRITTEN ONLY / NOT RUN: pending replay must not restore a naturally pruned post-spend date.
    const prunedTicket={...ticketResult.userGachaTicket,dateList:ticketResult.userGachaTicket.dateList.slice(0,-1)},
      pruneSave=drawAcknowledgement(ticketResult,{UserGachaTicket:[prunedTicket]});
    pruneSave.operations=[];
    pruneSave.deltas[0].putItems={UserGachaTicket:[prunedTicket]};
    pruneSave.checksums.after={UserGachaTicket:crypto.createHash('md5').update(JSON.stringify([prunedTicket])).digest('hex')};
    app.store.push(pruneSave);
    const projectedTicketOperation=app.store.lotteryRecovery(ticketResult.operation);
    assert.deepEqual(projectedTicketOperation.parameters.userGachaTicket,prunedTicket);
    assert.deepEqual(app.store.lotteryRecovery(ticketResult.operation,projectedTicketOperation),projectedTicketOperation);
    const projectedTicketReplay=JSON.parse((await request(app.server.address().port,ticketSequence,ticketBody,
      String(ticketRequestId),'lottery/ticket/draw')).body);
    assert.deepEqual(projectedTicketReplay.userGachaTicket,prunedTicket);
    assert.deepEqual(projectedTicketReplay.operation.parameters.userGachaTicket,prunedTicket);
    assert.deepEqual(projectedTicketReplay.operations,[projectedTicketReplay.operation]);
    ack(projectedTicketReplay);
    const ticketFloor=app.store.db.prepare('SELECT * FROM lottery_ticket_spend_floor WHERE ticket_id=?')
      .get(ticket.gachaTicketId);
    assert.deepEqual(ticketFloor,{ticket_id:ticket.gachaTicketId,spent_count:3,operation_id:ticketResult.operation.id});
    const settledTicket=JSON.parse((await request(app.server.address().port,ticketSequence,ticketBody,String(ticketRequestId),
      'lottery/ticket/draw')).body);
    assert.deepEqual(settledTicket.operations,[]);
    assert.equal(Object.hasOwn(settledTicket,'operation'),false);
    assert.deepEqual(settledTicket.UserLottery,[app.store.read('UserLottery').data.find(row=>row.lotteryId===ticketBody.lotteryId)]);
    assert.deepEqual(settledTicket.userGachaTicket,
      app.store.read('UserGachaTicket').data.find(row=>row.gachaTicketId===ticket.gachaTicketId));
    app.store.db.prepare('DELETE FROM lottery_ticket_spend_floor WHERE ticket_id=?').run(ticket.gachaTicketId);
    assert.equal((await request(app.server.address().port,ticketSequence,ticketBody,String(ticketRequestId),
      'lottery/ticket/draw')).status,503);
    app.store.db.prepare('INSERT INTO lottery_ticket_spend_floor(ticket_id,spent_count,operation_id) VALUES(?,?,?)')
      .run(ticketFloor.ticket_id,ticketFloor.spent_count,ticketFloor.operation_id);
    const beforeStaleTicket=saved();
    assert.throws(()=>app.store.push(drawAcknowledgement(ticketResult,{UserGachaTicket:[ticket]})),/older than their acknowledged spending floor/);
    assert.deepEqual(saved(),beforeStaleTicket,'A stale ticket restoration cannot mutate profiles, receipts or replay state');
    // WRITTEN ONLY / NOT RUN: equal spent counts cannot hide restoration of one exact consumed date.
    const restoredDateSwap={...ticketResult.userGachaTicket,dateList:[...ticketResult.userGachaTicket.dateList.slice(0,-1),ticket.dateList[3]]},
      beforeDateSwap=saved();
    assert.equal(restoredDateSwap.cumulativeAmount-restoredDateSwap.dateList.length,ticketFloor.spent_count);
    assert.throws(()=>app.store.push(drawAcknowledgement(ticketResult,{UserGachaTicket:[restoredDateSwap]})),
      /restore a consumed date without a later acquisition/);
    assert.deepEqual(saved(),beforeDateSwap,'A same-count consumed-date swap cannot mutate ticket history');
    const failedTickets = saved();
    const third = { ...ticketBody, progressCount: 2 };
    assert.equal((await request(app.server.address().port, sequence++, third, String(sequence), 'lottery/ticket/draw')).status, 400);
    assert.deepEqual(saved(), failedTickets, 'Expired and future tickets cannot cover a batch');
    // WRITTEN ONLY / NOT RUN: only one owned, native-shaped ticket row may fund a draw.
    const validThird = { ...third, drawCount: 1 };
    const originalTickets = app.store.read('UserGachaTicket').data;
    const currentTicket = originalTickets.find(row => row.gachaTicketId === ticket.gachaTicketId);
    for (const corrupt of [
      [...originalTickets, currentTicket],
      originalTickets.map(row => row.gachaTicketId === ticket.gachaTicketId ? { ...row, userId: seed.userId + 1 } : row),
      originalTickets.map(row => row.gachaTicketId === ticket.gachaTicketId ? { ...row, signature: undefined } : row),
      originalTickets.map(row => row.gachaTicketId === ticket.gachaTicketId ? { ...row, signature: -1 } : row),
      originalTickets.map(row => row.gachaTicketId === ticket.gachaTicketId ? { ...row, amount: 2 } : row),
      originalTickets.map(row => row.gachaTicketId === ticket.gachaTicketId ? { ...row, dateList: [{ aquiredAt: now, expireAt: now + duration }] } : row),
      null,
    ]) {
      app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify(corrupt), 'UserGachaTicket');
      const beforeInvalid = saved();
      assert.equal((await request(app.server.address().port, sequence++, validThird, String(sequence), 'lottery/ticket/draw')).status, 400);
      assert.deepEqual(saved(), beforeInvalid, 'Invalid native ticket row cannot issue a draw or change saved state');
    }
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify(originalTickets), 'UserGachaTicket');

    const ownedAgain = app.store.issueDraw([1011500001,1011500001], {}, 1000);
    assert.deepEqual(ownedAgain.parameters.lotteryPCs.map(row => row.isFirst), [false,false]);
    assert.equal(ownedAgain.parameters.UserLimitBreakItem[0].amount, 3);
    assert.equal(app.store.read('UserLimitBreakItem').data.find(row => row.limitBreakItemId === bondId).cumulativeAmount, 1,
      'A queued absolute bond award does not pre-credit native stock/acquisition');
    assert.equal(app.store.read('UserPC').data.filter(row => row.pcId === 1011500001).length, 1);
    ack(ownedAgain);
    const limitedTicket = { ...ticket, gachaTicketId: 296000011, dateList: [{ aquiredAt: now }, { aquiredAt: now }] };
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([
      ...app.store.read('UserGachaTicket').data, limitedTicket]), 'UserGachaTicket');
    const limitedBody = { ...ticketBody, lotteryId: 171000037, pickCount: 11, drawCount: 1 };
    const limitedWire = await request(app.server.address().port, sequence++, limitedBody, String(sequence), 'lottery/ticket/draw');
    assert.equal(limitedWire.status, 200, limitedWire.body.toString());
    const limited = JSON.parse(limitedWire.body);
    assert.equal(limited.lotteryPCs.length, 11);
    assert.equal(limited.UserLottery[0].buttons[1].count, 1);
    assert.equal(limited.userGachaTicket.dateList.length, 1);
    // WRITTEN ONLY / NOT RUN: a fresh saved row cannot exceed its authored lifetime cap.
    const overLimit={...limited.UserLottery[0],buttons:limited.UserLottery[0].buttons.map(row=>
      row.buttonType===2?{...row,count:2}:row)};
    const beforeOverLimit=saved();
    assert.throws(()=>app.store.push(drawAcknowledgement(limited,{UserLottery:[overLimit]})),
      /Saved lottery purchase count exceeds its original limit/);
    assert.deepEqual(saved(),beforeOverLimit,'An over-limit save cannot settle the draw or change its ticket/wallet');
    // WRITTEN ONLY / NOT RUN: do not persist a row that later draw/Details cannot read.
    for(const invalid of [
      {...limited.UserLottery[0],userId:seed.userId+1},
      {...limited.UserLottery[0],isNew:'yes'},
      {...limited.UserLottery[0],buttons:null},
      {...limited.UserLottery[0],buttons:[...limited.UserLottery[0].buttons,limited.UserLottery[0].buttons[1]]},
    ]) {
      assert.throws(()=>app.store.push(drawAcknowledgement(limited,{UserLottery:[invalid]})),
        /Saved lottery progress has duplicate, foreign or malformed rows/);
      assert.deepEqual(saved(),beforeOverLimit,'Rejected new lottery row cannot persist a partial draw');
    }
    assert.throws(()=>app.store.push(drawAcknowledgement(limited,{UserLottery:[
      limited.UserLottery[0],{...limited.UserLottery[0]}]})),
    /Saved lottery progress has duplicate, foreign or malformed rows/);
    assert.deepEqual(saved(),beforeOverLimit,'Duplicate new banner rows cannot settle a draw');
    ack(limited);
    const afterLimited = saved();
    assert.equal((await request(app.server.address().port, sequence++,
      { ...limitedBody, drawCount: 2, progressCount: 1 }, String(sequence), 'lottery/ticket/draw')).status, 400);
    assert.deepEqual(saved(), afterLimited, 'Native eleven-unit ticket buttons cannot batch multiple draws');
    const exhausted = await request(app.server.address().port, sequence++, { ...limitedBody, progressCount: 1 },
      String(sequence), 'lottery/ticket/draw');
    assert.equal(exhausted.status, 400);
    assert.deepEqual(saved(), afterLimited, 'Once-only eleven draw cannot consume a second ticket');

    const batchTicket = { ...ticket, dateList: [0,1,2].map(offset => ({ aquiredAt: now - offset })) };
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([
      ...app.store.read('UserGachaTicket').data.filter(row => row.gachaTicketId !== batchTicket.gachaTicketId), batchTicket]), 'UserGachaTicket');
    const batch = JSON.parse((await request(app.server.address().port, sequence++,
      { ...ticketBody, buttonIndex: 4, drawCount: 3, progressCount: 2 }, String(sequence), 'lottery/ticket/draw')).body);
    assert.equal(batch.lotteryPCs.length, 3);
    assert.equal(batch.UserLottery[0].buttons[1].count, 5);
    assert.equal(batch.userGachaTicket.dateList.length, 0);
    ack(batch);
    // WRITTEN ONLY / NOT RUN: native single-pick ticket control permits ten draws, never eleven.
    const tenTicket = { ...ticket, cumulativeAmount: 16,
      dateList: Array.from({ length: 10 }, () => ({ aquiredAt: now })) };
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([
      ...app.store.read('UserGachaTicket').data.filter(row => row.gachaTicketId !== tenTicket.gachaTicketId), tenTicket]),
    'UserGachaTicket');
    const tenBody = { ...ticketBody, drawCount: 10, progressCount: 5 };
    const tenWire = await request(app.server.address().port, sequence++, tenBody, String(sequence), 'lottery/ticket/draw');
    assert.equal(tenWire.status, 200, tenWire.body.toString());
    const ten = JSON.parse(tenWire.body);
    assert.equal(ten.lotteryPCs.length, 10);
    assert.equal(ten.UserLottery[0].buttons[1].count, 15);
    assert.equal(ten.userGachaTicket.dateList.length, 0);
    ack(ten);
    const afterTen = saved();
    assert.equal((await request(app.server.address().port, sequence++,
      { ...tenBody, drawCount: 11, progressCount: 15 }, String(sequence), 'lottery/ticket/draw')).status, 400);
    assert.deepEqual(saved(), afterTen, 'An impossible eleven-ticket button cannot alter saved rewards');

    Date.now = () => Date.parse('2017-07-15T12:00:00Z');
    app.store.changePaidCurrency(20);
    const dailyBody = { ...body, lotteryId: 171000013, buttonIndex: 1, consumeAmount: 10, progressCount: 0,
      clientChargeHardCurrency: 20, clientFreeHardCurrency: app.store.hardCurrency(),
      clientTotalHardCurrency: 20 + app.store.hardCurrency() };
    // WRITTEN ONLY / NOT RUN: the day receipt and paid-Iris debit must roll back together.
    const beforeDailyFailure=saved();
    app.store.db.exec("CREATE TRIGGER fail_daily_claim BEFORE INSERT ON lottery_daily_claim BEGIN SELECT RAISE(ABORT,'injected daily claim failure'); END");
    assert.equal((await send(dailyBody)).status,503);
    assert.deepEqual(saved(),beforeDailyFailure);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM lottery_daily_claim').get().n,0);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM lottery_daily_progress').get().n,0);
    app.store.db.exec('DROP TRIGGER fail_daily_claim');
    const beforeDailyProgressFailure=saved();
    app.store.db.exec("CREATE TRIGGER fail_daily_progress BEFORE INSERT ON lottery_daily_progress BEGIN SELECT RAISE(ABORT,'injected daily progress failure'); END");
    assert.equal((await send(dailyBody)).status,503);
    assert.deepEqual(saved(),beforeDailyProgressFailure);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM lottery_daily_claim').get().n,0);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM lottery_daily_progress').get().n,0);
    app.store.db.exec('DROP TRIGGER fail_daily_progress');
    const dailyRequestId=sequence,dailyRequestSequence=sequence+1;
    const daily = JSON.parse((await send(dailyBody)).body);
    const dailyScheduleRow=app.store.db.prepare('SELECT schedule_json FROM lottery_draw_claim WHERE operation_id=?')
      .get(daily.operation.id),dailySchedule=JSON.parse(dailyScheduleRow.schedule_json);
    assert.equal(dailySchedule.policy,'offline-lottery-schedule-v1');
    assert.equal(dailySchedule.day,Math.floor((Math.floor(Date.now()/1000)+9*3600)/86400));
    assert.equal(dailySchedule.before.count,0);
    assert.equal(dailySchedule.after.count,1);
    assert.equal(app.store.paidCurrency(), 10);
    assert.equal(daily.UserLottery[0].buttons[0].count, 1);
    assert.deepEqual(app.store.db.prepare(`SELECT progress_json,source_operation_id FROM lottery_daily_progress
      WHERE lottery_id=? AND button_type=1 AND day=?`).get(dailyBody.lotteryId,dailySchedule.day),
      {progress_json:JSON.stringify(dailySchedule.after),source_operation_id:daily.operation.id},
      'The selected-day progress snapshot is committed with its draw operation');
    // WRITTEN ONLY / NOT RUN: a stale same-day native save cannot reopen a paid daily draw.
    const staleDaily={...daily.UserLottery[0],buttons:daily.UserLottery[0].buttons.map(row=>
      row.buttonType===1 ? {...row,count:0,lastPickedAt:0} : row)};
    const afterDaily=saved();
    assert.throws(()=>app.store.push(drawAcknowledgement(daily,{UserLottery:[staleDaily]})),
      /Saved lottery purchase count must match the issued draw/);
    assert.deepEqual(saved(),afterDaily,'Rejected daily rewind retains its charge and draw result');
    const shiftedDaily={...daily.UserLottery[0],buttons:daily.UserLottery[0].buttons.map(row=>
      row.buttonType===1?{...row,lastPickedAt:row.lastPickedAt+86400}:row)};
    assert.throws(()=>app.store.push(drawAcknowledgement(daily,{UserLottery:[shiftedDaily]})),
      /Saved pending lottery button must match its issued draw/);
    assert.deepEqual(saved(),afterDaily,'A same-count daily save cannot move its operation to another JST day');
    ack(daily);
    const dailySettledRows=app.store.read('UserLottery').data,dailySettledState=saved(),dailyShifted=dailySettledRows.map(row=>
      row.lotteryId===dailyBody.lotteryId?{...row,buttons:row.buttons.map(button=>button.buttonType===1?
        {...button,lastPickedAt:button.lastPickedAt+86400}:button)}:row);
    assert.throws(()=>pushLotteryRows(dailyShifted),/Saved lottery timestamp, loop or step must match authoritative progress/);
    assert.deepEqual(saved(),dailySettledState,'An acknowledged daily draw cannot be moved to another JST day by a stale save');
    const settledDaily=await request(app.server.address().port,dailyRequestId,dailyBody,String(dailyRequestSequence),'lottery/draw');
    assert.equal(settledDaily.status,200,settledDaily.body.toString());
    assert.deepEqual(JSON.parse(settledDaily.body).operations,[]);
    app.store.db.prepare('UPDATE lottery_draw_claim SET schedule_json=NULL WHERE operation_id=?').run(daily.operation.id);
    const missingDailySchedule=saved();
    assert.equal((await request(app.server.address().port,dailyRequestId,dailyBody,String(dailyRequestSequence),
      'lottery/draw')).status,503);
    assert.deepEqual(saved(),missingDailySchedule,'Settled daily draw without schedule proof cannot mutate state');
    app.store.db.prepare('UPDATE lottery_draw_claim SET schedule_json=? WHERE operation_id=?')
      .run(dailyScheduleRow.schedule_json,daily.operation.id);
    assert.throws(()=>app.store.push(drawAcknowledgement(daily,{UserLottery:[staleDaily]})),
      /Saved lottery purchase count must match the issued draw/);
    Date.now = () => Date.parse('2017-07-14T12:00:00Z');
    assert.throws(()=>app.store.push(drawAcknowledgement(daily,{UserLottery:[staleDaily]})),
      /Saved lottery purchase count must match the issued draw/,'An event-clock rewind cannot erase a later paid draw');
    Date.now = () => Date.parse('2017-07-15T12:00:00Z');
    assert.equal((await send({ ...dailyBody, progressCount: 1, clientChargeHardCurrency: 10,
      clientTotalHardCurrency: 10 + app.store.hardCurrency() })).status, 400, 'Daily paid draw is limited once per JST day');
    Date.now = () => Date.parse('2017-07-16T12:00:00Z');
    const beforeNextDay=saved();
    assert.throws(()=>app.store.push(drawAcknowledgement(daily,{UserLottery:[staleDaily]})),
      /Saved lottery purchase count must match the issued draw/,'A new day does not require erasing saved history');
    assert.deepEqual(saved(),beforeNextDay);
    const dailyReset = JSON.parse((await send({ ...dailyBody, clientChargeHardCurrency: 10,
      clientTotalHardCurrency: 10 + app.store.hardCurrency() })).body);
    assert.equal(dailyReset.UserLottery[0].buttons[0].count, 1, 'Daily count resets instead of accumulating');
    assert.equal(app.store.paidCurrency(), 0);
    ack(dailyReset);
    const dailyClaims=app.store.db.prepare(`SELECT day,operation_id FROM lottery_daily_claim
      WHERE lottery_id=? AND button_type=1 ORDER BY day`).all(dailyBody.lotteryId);
    assert.deepEqual(dailyClaims.map(row=>row.operation_id),[daily.operation.id,dailyReset.operation.id],
      'Each selected JST day keeps its own acknowledged draw receipt');
    assert.deepEqual(app.store.db.prepare(`SELECT day,source_operation_id FROM lottery_daily_progress
      WHERE lottery_id=? AND button_type=1 ORDER BY day`).all(dailyBody.lotteryId),dailyClaims.map(row=>
        ({day:row.day,source_operation_id:row.operation_id})),
      'Each selected JST day keeps its own immutable client progress snapshot');
    await app.close();
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    assert.deepEqual(app.store.db.prepare(`SELECT day,operation_id FROM lottery_daily_claim
      WHERE lottery_id=? AND button_type=1 ORDER BY day`).all(dailyBody.lotteryId),dailyClaims,
    'Daily draw receipts survive a cold listener restart');

    Date.now = () => Date.parse('2017-07-17T12:00:00Z');
    putLottery(app.store.read('UserLottery').data.map(row=>row.lotteryId===dailyBody.lotteryId
      ? {...row,buttons:row.buttons.map(button=>button.buttonType===1
        ? {...button,count:0,lastPickedAt:0} : button)} : row));
    Date.now = () => Date.parse('2017-07-15T12:00:00Z');
    app.store.changePaidCurrency(10);
    const beforeRewind = saved();
    const rewoundDraw = await send({ ...dailyBody, clientChargeHardCurrency: 10,
      clientTotalHardCurrency: 10 + app.store.hardCurrency() });
    assert.equal(rewoundDraw.status, 400, 'Rewinding the event clock cannot reset a later saved daily draw');
    assert.equal(app.store.paidCurrency(), 10, 'Rejected rewind cannot debit paid Iris');
    assert.deepEqual(saved(), beforeRewind, 'Rejected rewind cannot debit Iris or change saved progress');
    const rewoundNotice = await request(app.server.address().port, sequence++, { lotteryId: dailyBody.lotteryId },
      String(sequence), 'notice/show');
    assert.equal(rewoundNotice.status, 200, rewoundNotice.body.toString());
    assert.match(JSON.parse(rewoundNotice.body).html, /1 completed purchase\(s\)/,
      'Gacha details must show the indexed daily receipt after an event-clock rewind');
    assert.match(JSON.parse(rewoundNotice.body).html, /Already drawn on this selected JST day/);
    app.store.changePaidCurrency(-10);

    Date.now = () => Date.parse('2018-03-01T12:00:00Z');
    app.store.changeHardCurrency(400);
    const scratchBody = { ...body, lotteryId: 171000092, buttonIndex: 3, consumeAmount: 400, pickCount: 11,
      isScratch: true, clientChargeHardCurrency: 0, clientFreeHardCurrency: app.store.hardCurrency(),
      clientTotalHardCurrency: app.store.hardCurrency() };
    const scratch = JSON.parse((await send(scratchBody)).body);
    assert.equal(scratch.lotteryPCs.length, 11);
    assert.equal(scratch.UserScratch.scratchId,611000001);
    assert.equal(scratch.UserScratch.ticketAmount,1);
    assert.throws(() => ack(scratch), /missing saved ticket/);
    app.store.push(drawAcknowledgement(scratch,{ UserScratch:[scratch.UserScratch] }));
    // WRITTEN ONLY / NOT RUN: settled scratch-linked draw replay requires its retained server floor and current client projection.
    const scratchFloor=app.store.db.prepare('SELECT * FROM gacha_scratch_state WHERE scratch_id=?')
      .get(scratch.UserScratch.scratchId),scratchRows=app.store.read('UserScratch').data;
    app.store.db.prepare('DELETE FROM gacha_scratch_state WHERE scratch_id=?').run(scratch.UserScratch.scratchId);
    assert.throws(()=>app.store.lotterySettledReceipt(scratch.operation),/entitlement baseline/);
    app.store.db.prepare('INSERT INTO gacha_scratch_state(scratch_id,state_json,contents_json) VALUES(?,?,?)')
      .run(scratchFloor.scratch_id,scratchFloor.state_json,scratchFloor.contents_json);
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify(scratchRows.map(row=>
      row.scratchId===scratch.UserScratch.scratchId?{...row,ticketAmount:row.ticketAmount+1}:row)),'UserScratch');
    assert.throws(()=>app.store.lotterySettledReceipt(scratch.operation),/entitlement baseline/);
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify(scratchRows),'UserScratch');
    app.store.lotterySettledReceipt(scratch.operation);
    // WRITTEN ONLY / NOT RUN: matching a fabricated current profile and floor is
    // insufficient; the old lottery grant must reach them through completed
    // retained grant/draw receipts.
    const forgedScratch={...scratch.UserScratch,ticketAmount:scratch.UserScratch.ticketAmount+1};
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify(scratchRows.map(row=>
      row.scratchId===forgedScratch.scratchId?forgedScratch:row)),'UserScratch');
    app.store.db.prepare('UPDATE gacha_scratch_state SET state_json=? WHERE scratch_id=?')
      .run(JSON.stringify(forgedScratch),forgedScratch.scratchId);
    assert.throws(()=>app.store.lotterySettledReceipt(scratch.operation),/card or board chain/);
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify(scratchRows),'UserScratch');
    app.store.db.prepare('UPDATE gacha_scratch_state SET state_json=? WHERE scratch_id=?')
      .run(scratchFloor.state_json,scratchFloor.scratch_id);

    // A real later scratch draw is allowed only after its reward, card and board
    // are saved and the operation is acknowledged. Corrupting that successor
    // must also make replay of the older linked lottery identity unavailable.
    const laterScratchIdentity=sequence,laterScratchWire=await request(app.server.address().port,sequence++,{
      scratchId:scratch.UserScratch.scratchId,position:0},String(sequence),'scratch/draw');
    assert.equal(laterScratchWire.status,200,laterScratchWire.body.toString());
    const laterScratch=JSON.parse(laterScratchWire.body),laterReceipt=app.store.gachaScratchReceipt(laterScratch.operation),
      laterTarget=laterReceipt.targets[0],laterProfile=master.itemProfiles[laterTarget.item_id],
      laterRows=app.store.read(laterTarget.table_name).data,
      laterBefore=laterRows.find(row=>row[laterTarget.id_field]===laterTarget.item_id),
      laterItem={...(laterBefore ?? {userId:seed.userId,[laterTarget.id_field]:laterTarget.item_id,bookEntryState:3}),
        signature:laterScratch.operation.signature,cumulativeAmount:laterTarget.cumulative_amount};
    if(laterTarget.table_name==='UserGachaTicket') laterItem.dateList=[...(laterBefore?.dateList ?? []),
      ...Array.from({length:laterScratch.pickedItem.amount},()=>({aquiredAt:Math.floor(Date.now()/1000)}))];
    else {laterItem.amount=(laterBefore?.amount ?? 0)+laterScratch.pickedItem.amount;laterItem.reservedAmount=laterBefore?.reservedAmount ?? 0;}
    assert.equal(laterProfile.table,laterTarget.table_name);
    app.store.push(drawAcknowledgement(laterScratch,{UserScratch:[laterScratch.UserScratch],
      UserScratchContent:laterScratch.UserScratchContent,[laterTarget.table_name]:[laterItem]}));
    app.store.lotterySettledReceipt(scratch.operation);
    const laterClaim=app.store.db.prepare('SELECT operation_json FROM gacha_scratch_claim WHERE operation_id=?')
      .get(laterScratch.operation.id);
    app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(laterScratch.operation.id);
    assert.throws(()=>app.store.lotterySettledReceipt(scratch.operation),/durable receipt/);
    app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(laterScratch.operation.id);
    app.store.db.prepare('UPDATE gacha_scratch_claim SET operation_json=? WHERE operation_id=?')
      .run(JSON.stringify(scratch.operation),laterScratch.operation.id);
    assert.throws(()=>app.store.lotterySettledReceipt(scratch.operation),/operation identity|durable receipt/);
    app.store.db.prepare('UPDATE gacha_scratch_claim SET operation_json=? WHERE operation_id=?')
      .run(laterClaim.operation_json,laterScratch.operation.id);
    app.store.lotterySettledReceipt(scratch.operation);
    const laterReplay=await request(app.server.address().port,laterScratchIdentity,
      {scratchId:scratch.UserScratch.scratchId,position:0},String(laterScratchIdentity+1),'scratch/draw');
    assert.equal(laterReplay.status,200,laterReplay.body.toString());
    assert.deepEqual(JSON.parse(laterReplay.body).operations,[]);

    Date.now = () => Date.parse('2019-11-30T12:00:00Z');
    app.store.changePaidCurrency(250);
    const paidStepBody = { ...body, lotteryId: 171000771, buttonIndex: 2, consumeAmount: 10, pickCount: 1,
      currentStepIndex: 1, progressCount: 0, clientChargeHardCurrency: 250,
      clientFreeHardCurrency: app.store.hardCurrency(), clientTotalHardCurrency: 250 + app.store.hardCurrency() };
    const paidStep = JSON.parse((await send(paidStepBody)).body);
    assert.equal(paidStep.UserLottery[0].buttons[1].currentStepIndex, 2);
    assert.equal(app.store.paidCurrency(), 240);
    // WRITTEN ONLY / NOT RUN: every delivery path requires the permanent paid-only debit journal.
    const paidClaim=app.store.db.prepare(`SELECT iris_history_id,schedule_json FROM lottery_draw_claim
      WHERE operation_id=?`).get(paidStep.operation.id),paidSchedule=JSON.parse(paidClaim.schedule_json),
      paidJournal=app.store.db.prepare('SELECT * FROM iris_transaction WHERE id=?').get(paidClaim.iris_history_id);
    assert.equal(paidJournal.created_at,paidSchedule.issuedAt);
    assert.equal(paidJournal.free_after,paidJournal.free_before);
    assert.equal(paidJournal.paid_after,paidJournal.paid_before-paidStepBody.consumeAmount);
    app.store.db.prepare('UPDATE iris_transaction SET reason=? WHERE id=?').run('corrupt paid draw',paidClaim.iris_history_id);
    const corruptPaidState=saved();
    assert.throws(()=>app.store.lotteryDelivery(paidStep.operation,'user_data/pull'),/exact Iris expenditure/);
    assert.deepEqual(saved(),corruptPaidState,'Cold paid-only delivery cannot mutate state without its exact debit journal');
    app.store.db.prepare('UPDATE iris_transaction SET reason=? WHERE id=?')
      .run(paidJournal.reason,paidClaim.iris_history_id);
    ack(paidStep);
    app.store.db.prepare('UPDATE iris_transaction SET paid_after=paid_after+1 WHERE id=?').run(paidClaim.iris_history_id);
    assert.throws(()=>app.store.lotterySettledReceipt(paidStep.operation),/original payment mode/);
    app.store.db.prepare('UPDATE iris_transaction SET paid_after=? WHERE id=?')
      .run(paidJournal.paid_after,paidClaim.iris_history_id);
    app.store.lotterySettledReceipt(paidStep.operation);

    Date.now = () => Date.parse('2022-12-01T12:00:00Z');
    const selectionLottery = master.lotteries[171001834], selected = [];
    for (const groupId of selectionLottery.selectionGroupIds)
      selected.push(master.selectLineupPools[groupId].find(pcId => !selected.includes(pcId)));
    const selectionTicket = { userId: seed.userId, gachaTicketId: selectionLottery.ticketId, bookEntryState: 1, signature: 0,
      cumulativeAmount: 1, dateList: [{ aquiredAt: Math.floor(Date.now() / 1000) }] };
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([
      ...app.store.read('UserGachaTicket').data.filter(row => row.gachaTicketId !== selectionTicket.gachaTicketId), selectionTicket]), 'UserGachaTicket');
    const selectionBody = { ...body, lotteryId: 171001834, buttonIndex: 2, consumeAmount: 1, pickCount: 11,
      drawCount: 1, clientChargeHardCurrency: app.store.paidCurrency(), clientFreeHardCurrency: app.store.hardCurrency(),
      clientTotalHardCurrency: app.store.paidCurrency() + app.store.hardCurrency(),
      selectedPcId1: selected[0], selectedPcId2: selected[1], selectedPcId3: selected[2] };
    const selectionWire = await request(app.server.address().port, sequence++, selectionBody, String(sequence), 'lottery/ticket/draw');
    assert.equal(selectionWire.status, 200, selectionWire.body.toString());
    const selection = JSON.parse(selectionWire.body);
    assert.equal(selection.lotteryPCs.length, 11);
    assert.equal(selection.lotteryPCs.at(-1).pcId, selected[0],
      'A zero-pool selector guarantee draws a chosen 4-star unit');
    const selectionDetails = await request(app.server.address().port, sequence++,
      { lotteryId: 171001834 }, String(sequence), 'notice/show');
    assert.equal(selectionDetails.status, 200);
    assert.match(JSON.parse(selectionDetails.body).html, /One of your three selected 4★ units/);
    ack(selection);

    // Every archived select-lineup variant, including the paid Celestial
    // Festival's separate guaranteed pool. Previously only tickets were tested.
    const originalPools = JSON.stringify(master.lotteryPools);
    let paidSelectors = 0, ticketSelectors = 0, unavailableSelectors = 0;
    for (const [lotteryId, lottery] of Object.entries(master.lotteries).filter(([, row]) => row.selectionGroupIds?.length)) {
      Date.now = () => (lottery.startAt || lottery.endAt - 86400) * 1000 + 3600000;
      const choices = [];
      for (const groupId of lottery.selectionGroupIds)
        choices.push(master.selectLineupPools[groupId].find(pcId => !choices.includes(pcId)));
      const button = lottery.buttons[1], usesTicket = button.consumeType === 2;
      if (usesTicket) {
        ticketSelectors++;
        const owned = { userId: seed.userId, gachaTicketId: lottery.ticketId, bookEntryState: 1, signature: 0,
          cumulativeAmount: 1, dateList: [{ aquiredAt: Math.floor(Date.now() / 1000) }] };
        app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([
          ...app.store.read('UserGachaTicket').data.filter(row => row.gachaTicketId !== owned.gachaTicketId), owned]), 'UserGachaTicket');
      } else { paidSelectors++; app.store.changePaidCurrency(button.consumeAmount); }
      const balance = app.store.paidCurrency(), freeBalance = app.store.hardCurrency();
      const progress = app.store.read('UserLottery').data.find(row => row.lotteryId === Number(lotteryId))
        ?.buttons.find(row => row.buttonType === 2)?.count ?? 0;
      const drawBody = { ...body, lotteryId: Number(lotteryId), buttonIndex: 2, consumeAmount: button.consumeAmount,
        pickCount: button.pickCount, progressCount: progress, selectedPcId1: choices[0], selectedPcId2: choices[1],
        selectedPcId3: choices[2], clientChargeHardCurrency: balance, clientFreeHardCurrency: freeBalance,
        clientTotalHardCurrency: balance + freeBalance, ...(usesTicket ? { drawCount: 1 } : {}) };
      const selectedGuarantee = button.fixedCount === 1 && !button.fixedGroupId;
      roll = selectedGuarantee ? 99 : 0; // Expose a low-rank ordinary slot beside the selected guarantee.
      chosenRoll = selectedGuarantee ? Number(lotteryId) % 3 : 0;
      const beforeInvalid = saved();
      assert.equal((await send({ ...drawBody, selectedPcId2: choices[0] }, usesTicket)).status, 400);
      assert.deepEqual(saved(), beforeInvalid, `Invalid selection must not debit banner ${lotteryId}`);
      const selectorRequestId=sequence,selectorRequestSequence=sequence+1;
      const wire = await send(drawBody, usesTicket);
      if (lottery.endAt && lottery.endAt <= lottery.startAt) {
        unavailableSelectors++;
        assert.equal(wire.status, 400, 'Originally disabled equal-date banners remain unavailable');
        assert.deepEqual(saved(), beforeInvalid);
        continue;
      }
      assert.equal(wire.status, 200, `${lotteryId}: ${wire.body}`);
      const result = JSON.parse(wire.body);
      const selectorRow=app.store.db.prepare('SELECT selection_json FROM lottery_draw_claim WHERE operation_id=?')
        .get(result.operation.id),selectorCapture=JSON.parse(selectorRow.selection_json);
      assert.equal(selectorCapture.policy,'offline-lottery-selector-v1');
      assert.equal(selectorCapture.lotteryId,Number(lotteryId));
      assert.deepEqual(selectorCapture.selectionGroupIds,lottery.selectionGroupIds);
      assert.deepEqual(selectorCapture.selectedPcIds,choices);
      assert.deepEqual(selectorCapture.pcIds,result.lotteryPCs.map(row=>row.pcId));
      assert.equal(selectorCapture.groupIds.length,result.lotteryPCs.length);
      assert.equal(result.lotteryPCs.length, 11);
      if (selectedGuarantee) {
        assert.equal(result.lotteryPCs.at(-1).pcId, choices[chosenRoll],
          `Selected guarantee must be a chosen 4-star unit on ${lotteryId}`);
        assert.ok(result.lotteryPCs.slice(0, -1).every(row =>
          master.pcJobRanks[master.pcProfiles[row.pcId].jobIds[0]] < 4),
        `Ordinary slots may remain lower rarity on ${lotteryId}`);
      } else assert.ok(result.lotteryPCs.every(row => row.pcId === choices[0]),
        `Chosen unit must also be reachable in guaranteed pool on ${lotteryId}`);
      assert.equal(app.store.paidCurrency(), balance - (usesTicket ? 0 : button.consumeAmount));
      assert.equal(app.store.hardCurrency(), freeBalance);
      assert.equal(result.UserLottery[0].buttons[1].count, progress + 1);
      if (!usesTicket) assert.equal(master.pcJobRanks[master.pcProfiles[result.lotteryPCs.at(-1).pcId].jobIds[0]], 4);
      const pendingState = saved();
      assert.deepEqual(JSON.parse((await send(drawBody, usesTicket)).body), result);
      assert.deepEqual(saved(), pendingState, `Retry must not reroll or debit selector ${lotteryId}`);
      if (Number(lotteryId) === 171002133) {
        app.store.db.prepare('UPDATE lottery_draw_claim SET selection_json=? WHERE operation_id=?')
          .run('{"policy":"corrupt"}',result.operation.id);
        const corruptSelectorState=saved();
        assert.equal((await send(drawBody)).status,503);
        assert.deepEqual(saved(),corruptSelectorState,'Corrupt selector proof cannot reroll, debit or change progress');
        app.store.db.prepare('UPDATE lottery_draw_claim SET selection_json=? WHERE operation_id=?')
          .run(selectorRow.selection_json,result.operation.id);
        await app.close();
        app = createServer({ database, seed, master, log: () => {} });
        await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
        assert.deepEqual(JSON.parse((await send(drawBody)).body), result);
        assert.deepEqual(saved(), pendingState, 'Paid Celestial pending draw survives restart without a second debit');
      }
      ack(result);
      assert.equal(app.store.operations().length, 0);
      if(Number(lotteryId)===171002133) {
        const settled=await request(app.server.address().port,selectorRequestId,drawBody,String(selectorRequestSequence),'lottery/draw');
        assert.equal(settled.status,200,settled.body.toString());
        assert.deepEqual(JSON.parse(settled.body).operations,[]);
        app.store.db.prepare('UPDATE lottery_draw_claim SET selection_json=NULL WHERE operation_id=?').run(result.operation.id);
        const missingSelectorState=saved();
        assert.equal((await request(app.server.address().port,selectorRequestId,drawBody,String(selectorRequestSequence),
          'lottery/draw')).status,503);
        assert.deepEqual(saved(),missingSelectorState,'Settled selector without its permanent proof cannot mutate state');
        app.store.db.prepare('UPDATE lottery_draw_claim SET selection_json=? WHERE operation_id=?')
          .run(selectorRow.selection_json,result.operation.id);
      }
    }
    assert.equal(paidSelectors, 35); assert.equal(ticketSelectors, 14);
    assert.equal(unavailableSelectors, 10);
    assert.equal(JSON.stringify(master.lotteryPools), originalPools, 'Adding choices must not mutate original pool data');

    const anniversary = master.lotteries[171000203];
    Date.now = () => (anniversary.startAt + 3600) * 1000;
    roll = 99;
    const anniversaryTicket = { userId: seed.userId, gachaTicketId: anniversary.ticketId, bookEntryState: 1, signature: 0,
      cumulativeAmount: 1, dateList: [{ aquiredAt: Math.floor(Date.now() / 1000) }] };
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([
      ...app.store.read('UserGachaTicket').data.filter(row => row.gachaTicketId !== anniversary.ticketId),
      anniversaryTicket]), 'UserGachaTicket');
    const anniversaryBody = { ...body, lotteryId: 171000203, buttonIndex: 2, consumeAmount: 1, pickCount: 1,
      drawCount: 1, clientChargeHardCurrency: app.store.paidCurrency(), clientFreeHardCurrency: app.store.hardCurrency(),
      clientTotalHardCurrency: app.store.paidCurrency() + app.store.hardCurrency() };
    const anniversaryWire = await send(anniversaryBody, true);
    assert.equal(anniversaryWire.status, 200, anniversaryWire.body.toString());
    const anniversaryDraw = JSON.parse(anniversaryWire.body);
    assert.equal(master.pcJobRanks[master.pcProfiles[anniversaryDraw.lotteryPCs[0].pcId].jobIds[0]], 4);
    ack(anniversaryDraw);

    // WRITTEN ONLY: repeated lotteryCharacter rows are drawable pool slots.
    for (const [lotteryId, buttonIndex, poolId, bucketRoll] of [
      [171000047,3,172000078,67],[171000276,1,172000527,12]]) {
      const original=master.lotteries[lotteryId],button=original.buttons[buttonIndex-1];
      Date.now=()=> (original.startAt+3600)*1000;roll=bucketRoll;
      if(button.consumeType===1) app.store.changeHardCurrency(button.consumeAmount);
      else app.store.changePaidCurrency(button.consumeAmount);
      const beforePaid=app.store.paidCurrency(),beforeFree=app.store.hardCurrency(),
        drawBody={...body,lotteryId,buttonIndex,consumeAmount:button.consumeAmount,pickCount:button.pickCount,
          clientChargeHardCurrency:beforePaid,clientFreeHardCurrency:beforeFree,
          clientTotalHardCurrency:beforePaid+beforeFree},wire=await send(drawBody);
      assert.equal(wire.status,200,`${lotteryId}: ${wire.body}`);
      const draw=JSON.parse(wire.body),picked=lotteryId===171000047?draw.lotteryPCs.at(-1):draw.lotteryPCs[0];
      assert.ok(Object.values(master.lotteryPools[poolId]).some(pcs=>pcs.includes(picked.pcId)));
      assert.equal(app.store.paidCurrency(),beforePaid-(button.consumeType===3?button.consumeAmount:0));
      assert.equal(app.store.hardCurrency(),beforeFree-(button.consumeType===1?button.consumeAmount:0));
      ack(draw);
    }

    // The final Orgion archive references an absent weight row in both its
    // ordinary and featured guaranteed pools. Exercise every affected banner.
    roll = 98;
    for (const [lotteryId, buttonIndex] of [[171002164, 3], [171002165, 2], [171002166, 2],
      [171002167, 2], [171002168, 2]]) {
      const original = master.lotteries[lotteryId], button = original.buttons[buttonIndex - 1];
      Date.now = () => (original.startAt + 3600) * 1000;
      if (button.consumeType === 1) app.store.changeHardCurrency(button.consumeAmount);
      if (button.consumeType === 3) app.store.changePaidCurrency(button.consumeAmount);
      if (button.consumeType === 2) {
        const ticket = { userId: seed.userId, gachaTicketId: original.ticketId, bookEntryState: 1, signature: 0,
          cumulativeAmount: 1, dateList: [{ aquiredAt: Math.floor(Date.now() / 1000) }] };
        app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([
          ...app.store.read('UserGachaTicket').data.filter(row => row.gachaTicketId !== original.ticketId), ticket]), 'UserGachaTicket');
      }
      const beforePaid = app.store.paidCurrency(), beforeFree = app.store.hardCurrency();
      const orgionBody = { ...body, lotteryId, buttonIndex, consumeAmount: button.consumeAmount,
        pickCount: button.pickCount, clientChargeHardCurrency: beforePaid, clientFreeHardCurrency: beforeFree,
        clientTotalHardCurrency: beforePaid + beforeFree };
      if (button.consumeType === 2) orgionBody.drawCount = 1;
      const wire = await send(orgionBody, button.consumeType === 2);
      assert.equal(wire.status, 200, `${lotteryId}: ${wire.body}`);
      const draw = JSON.parse(wire.body);
      assert.equal(draw.lotteryPCs.length, 11);
      assert.equal(draw.lotteryPCs[0].pcId, 1012018004, 'The reconstructed 2% bucket remains drawable');
      assert.ok(Object.values(master.lotteryPools[button.fixedGroupId]).some(pcs =>
        pcs.includes(draw.lotteryPCs.at(-1).pcId)), 'The final slot uses its original guaranteed pool');
      assert.equal(app.store.paidCurrency(), beforePaid - (button.consumeType === 3 ? button.consumeAmount : 0));
      assert.equal(app.store.hardCurrency(), beforeFree - (button.consumeType === 1 ? button.consumeAmount : 0));
      ack(draw);
    }

    await app.close(); app = null;
    Date.now = () => Date.parse('2026-10-02T12:00:00Z');
    app = createServer({ database: path.join(root, 'historical.sqlite'), seed, master, eventDate: '2019-10-18', log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const wallTicket = { ...ticket, dateList: [{ aquiredAt: Math.floor(Date.now() / 1000) }] };
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([wallTicket]), 'UserGachaTicket');
    const historical = await request(app.server.address().port, sequence++, { ...ticketBody, drawCount: 1 },
      String(sequence), 'lottery/ticket/draw');
    assert.equal(historical.status, 200, 'Wall-clock ticket must be consumable on a historical event clock');
    console.log('Original pools plus free, paid, daily, ticket batch, scratch, step-up: 39 available selector draws and 10 originally disabled selectors: OK');
  } finally {
    Date.now = realNow; crypto.randomInt = realRandomInt;
    if (app) await app.close().catch(() => {});
    fs.rmSync(root, { recursive: true, force: true });
  }
}
// An unresolved async test must not exit successfully when Node has no handles.
process.exitCode = 1;
main().then(() => { process.exitCode = 0; }).catch(error => { console.error(error); });
