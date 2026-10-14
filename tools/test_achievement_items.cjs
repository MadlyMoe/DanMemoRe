'use strict';

// DEFERRED: synthetic eligibility/inventory deltas exercise SQLite and protocol ordering,
// not natural mission unlocks, native inventory application or repeat policies.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
const cappedTables=new Set(['UserStatusBoardItem','UserCpItem','UserExpItem','UserEquipmentMaterial','UserStaminaTicket',
  'UserKeyItem','UserEquipmentEnhanceItem','UserEquipmentEvolveItem','UserHeroSublimateItem','UserHeroSublimateUnlockItem','UserAdventureTicket','UserMemoriaExpItem','UserAlarmVoiceItem','UserLimitBreakItem']);

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-achievement-items-'));
  const realNow = Date.now, realRandomInt = crypto.randomInt;
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
  const pushBody = (putItems = {}, operations = [], deleteItems = {}) => ({
    badges: null, scripts: {}, dataTokens: {}, checksums: { before: {}, after: Object.fromEntries(
      [...new Set([...Object.keys(putItems), ...Object.keys(deleteItems)])].map(name => [name, md5(putItems[name] ?? [])])) },
    deltas: Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature: 0, trigger: 'Achievement', putItems, deleteItems }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })),
  });
  const push = (...args) => send('user_data/push',pushBody(...args));
  const claim = rows => send('achievement/complete', { achievementIds: rows.map(({ achievementId, completedAt }) => ({ achievementId, completedAt })) });
  const claimRow = id => ({ userId: seed.userId, achievementId: Number(id), completedAt: now,
    lastResetAt: 0, progressParam: 1, readState: 1, signature: 0, state: 3 });
  const itemRow = (id, cumulative, amount = 0) => {
    const { table, idField } = master.itemProfiles[id];
    return { userId: seed.userId, [idField]: id, signature: 0, bookEntryState: 3, cumulativeAmount: cumulative,
      ...(table === 'UserGachaTicket' ? { dateList: Array.from({ length: amount }, () => ({ aquiredAt: now })) } : { amount }),
      ...(['UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial','UserCurrency','UserKeyItem','UserStaminaTicket','UserEquipmentEnhanceItem','UserEquipmentEvolveItem','UserHeroSublimateItem','UserHeroSublimateUnlockItem','UserMemoriaExpItem','UserAlarmVoiceItem'].includes(table) ? { reservedAmount: 0 } : {}),
      ...(table==='UserKeyItem'?{exploit:false}:{}),
      ...(table==='UserAdventureTicket'?{lastResetAt:0}:{}),
      ...(table==='UserMemoriaExpItem'?{lastAquiredAt:0}:{}),
    };
  };
  const reject = async (response,status = 503,before = snapshot(),structured = true) => {
    const value = await response; assert.equal(value.status,status,value.body.toString()); assert.equal(snapshot(),before);
    if (status === 503 && structured) assert.equal(JSON.parse(value.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  try {
    const types = new Map();
    for (const [id, original] of Object.entries(master.achievements)) {
      const itemId = master.items[original.rewardKey], profile = master.itemProfiles[itemId];
      //Grade missions now require real local War Game receipts; this generic
      //inventory probe uses other authored IDs, not manufactured PvP history.
      if (profile && !master.warGameAchievements[id] && !['currency.gem','currency.casino_medal'].includes(original.rewardKey) && !types.has(profile.table))
        types.set(profile.table, { id, original, itemId, profile });
    }
    assert.equal(types.size, 17);
    for (const [name, { id, original, itemId, profile }] of types) for (const order of ['flags','items']) {
      now = Math.max(1, original.startAt); await fresh(`${name}-${order}`);
      const row = claimRow(id), baseline = itemRow(itemId, 11, 7), bodyRows = [row];
      put('UserAchievement', bodyRows); put(name, [baseline]);
      const untouched = snapshot();
      for (const changes of [{ userId: 2 }, { cumulativeAmount: -1 }, { cumulativeAmount: '11' },
        ...(cappedTables.has(name)||['UserGachaTicket','UserCurrency'].includes(name)?[]:[{ cumulativeAmount: 999999999 }]),
        ...(name === 'UserGachaTicket' ? [{ dateList: null }] : [{ amount: -1 }]),
        ...(name==='UserAdventureTicket'?[{lastResetAt:undefined},{lastResetAt:-1},{lastResetAt:'0'},{reservedAmount:0},
          {dateList:[]},{bookEntryState:-1},{bookEntryState:256},{signature:-1},{signature:0x100000000},{signature:'0'}]:[]),
        ...(name==='UserAlarmVoiceItem'?[{reservedAmount:undefined},{reservedAmount:-1},{reservedAmount:'0'},
          {reservedAmount:1000000000},{bookEntryState:-1},{bookEntryState:256},{signature:-1},
          {signature:0x100000000},{signature:'0'},{lastResetAt:0},{lastAquiredAt:0},{dateList:[]},{voiceId:itemId}]:[]),
        ...(name==='UserLimitBreakItem'?[{bookEntryState:undefined},{bookEntryState:-1},{bookEntryState:256},
          {signature:undefined},{signature:-1},{signature:0x100000000},{signature:'0'},{reservedAmount:0},
          {lastResetAt:0},{lastAquiredAt:0},{dateList:[]},{generalLimitBreakItemId:itemId}]:[]),
        ...(name==='UserMemoriaExpItem'?[{lastAquiredAt:undefined},{lastAquiredAt:-1},{lastAquiredAt:'0'},
          {reservedAmount:undefined},{reservedAmount:-1},{bookEntryState:-1},{bookEntryState:256},{signature:-1},
          {signature:0x100000000},{lastResetAt:0},{lastAcquiredAt:0},{dateList:[]}]:[])]) {
        put(name, [{ ...baseline, ...changes }]); const invalid = snapshot();
        assert.equal((await claim(bodyRows)).status,['UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial'].includes(name) ||
          name==='UserKeyItem' && changes.cumulativeAmount!==999999999?503:400);
        assert.equal(snapshot(), invalid);
      }
      put(name, [baseline]); assert.equal(snapshot(), untouched);
      for (const table of ['operation_queue','achievement_pc_delivery','achievement_claim','achievement_item_claim','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_claim BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'mission rollback'); END`);
        const before = snapshot(); assert.equal((await claim(bodyRows)).status, 503);
        assert.equal(snapshot(), before, 'Receipt, queue, wallet and reply roll back together');
        app.store.db.exec('DROP TRIGGER fail_claim');
      }
      const response = await claim(bodyRows), identity = sequence, result = parse(response), operation = result.operations[0];
      assert.equal(operation.type, 6000);
      assert.deepEqual(result.operation,operation,'Native hot transport must apply the same signed6000 before displaying its popup');
      assert.deepEqual(result.receivedItems, [{ itemId, amount: original.rewardAmount }]);
      const {operation: singular,...legacyReply}=result;
      app.store.db.prepare("UPDATE reply_cache SET body=? WHERE action='achievement/complete'")
        .run(Buffer.from(JSON.stringify(legacyReply)).toString('base64'));
      const legacySnapshot=snapshot();
      assert.deepEqual(parse(await request(port,identity,{achievementIds:bodyRows.map(({achievementId,completedAt})=>
        ({achievementId,completedAt}))},String(identity),'achievement/complete')),result,
      'An old plural-only cached envelope gains hot delivery without reissuing the reward');
      assert.equal(snapshot(),legacySnapshot,'Envelope repair is read-only: no second receipt, queue, reward or native save');
      assert.deepEqual(app.store.read(name).data, [baseline], 'The native operation owns inventory application');
      const target = app.store.db.prepare('SELECT * FROM achievement_item_claim WHERE operation_id=?').get(operation.id);
      assert.equal(target.cumulative_amount, 11 + original.rewardAmount);
      const pending = snapshot(); assert.equal((await push({}, [operation])).status, 400); assert.equal(snapshot(), pending);
      assert.deepEqual(JSON.parse(app.store.db.prepare('SELECT pc_targets FROM achievement_pc_delivery WHERE operation_id=?').get(operation.id).pc_targets),[]);
      assert.deepEqual(parse(await claim(bodyRows)).operations,[operation], 'Unapplied item-only receipt retries exactly');
      const received = { ...row, state: 4 }, acquired = {...itemRow(itemId, 11 + original.rewardAmount, 7 + original.rewardAmount),
        ...(name==='UserGachaTicket'?{signature:operation.signature,dateList:[...baseline.dateList,
          ...Array.from({length:original.rewardAmount},()=>({aquiredAt:now}))]}:{})};
      const first = order === 'flags' ? { UserAchievement:[received] } : { [name]:[acquired] };
      for (const [table,event] of [['achievement_pc_delivery','UPDATE'],['profile','UPDATE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_mission_partial BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'mission partial rollback'); END`);
        // Injected raw SQLite failures return an empty503, not the structured
        // cancellation used by deliberate missing/invalid delivery guards.
        await reject(push(first),503,undefined,false); app.store.db.exec('DROP TRIGGER fail_mission_partial');
      }
      const checkpoint = parse(await push(first)); assert.deepEqual(checkpoint.operations,[]);
      assert.deepEqual(app.store.operations(),[operation]);
      assert.deepEqual(JSON.parse(app.store.db.prepare('SELECT observed FROM achievement_pc_delivery WHERE operation_id=?').get(operation.id).observed),
        [order === 'flags' ? `claim:${row.achievementId}` : `item:${itemId}`]);
      await close(); await open();
      await reject(claim(bodyRows));
      await reject(request(port, identity, { achievementIds: [{ achievementId: row.achievementId, completedAt: row.completedAt }] },
        String(identity), 'achievement/complete'));
      const recovered={...operation,parameters:{...operation.parameters,
        UserAchievement:order==='flags'?[]:operation.parameters.UserAchievement,
        receivedItems:order==='items'?[]:operation.parameters.receivedItems}};
      assert.deepEqual(app.store.achievementColdRecovery(operation),recovered);
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[recovered]);
      parse(await send('user/login',undefined));
      assert.equal((await send('user_data/pull',{ tables:['UserAchievement',name] })).status,200);
      if (order === 'flags') await reject(push({ UserAchievement:[row] }),400);
      else {
        await reject(push({ [name]:[baseline] }),400);
        await reject(push({},[],{ [name]:[{ [profile.idField]:itemId }] }),400);
      }
      for (const changes of [{ userId: 2 }, { cumulativeAmount: acquired.cumulativeAmount - 1 },
        { cumulativeAmount: '12' }, ...(name === 'UserGachaTicket' ? [{ dateList: [{ aquiredAt: '1' }] }] : [{ amount: -1 }])]) {
        const before = snapshot(); assert.equal((await push({ [name]: [{ ...acquired, ...changes }] }, [operation])).status, 400);
        assert.equal(snapshot(), before);
      }
      parse(await push({ [name]: [acquired],UserAchievement:[received] })); await close(); await open();
      parse(await push({ [name]: [{...itemRow(itemId, acquired.cumulativeAmount),...(name==='UserGachaTicket'?{signature:operation.signature}:{})}] }));
      app.store.db.exec("CREATE TRIGGER fail_ack BEFORE DELETE ON operation_queue BEGIN SELECT RAISE(ABORT,'ack rollback'); END");
      const beforeAck = snapshot(); assert.equal((await push({}, [operation])).status, 503); assert.equal(snapshot(), beforeAck);
      app.store.db.exec('DROP TRIGGER fail_ack');
      if (name === 'UserGachaTicket') {
        const retainedTarget=app.store.db.prepare('SELECT * FROM achievement_item_claim WHERE operation_id=?').get(operation.id);
        app.store.db.prepare('DELETE FROM achievement_item_claim WHERE operation_id=?').run(operation.id);
        const legacy = snapshot(), failed = await push({}, [operation]);
        assert.equal(failed.status, 503); assert.equal(JSON.parse(failed.body).code, OFFLINE_UNAVAILABLE_CODE);
        assert.equal(snapshot(), legacy, 'Unknown legacy baseline stays queued, never guessed');
        app.store.db.prepare(`INSERT INTO achievement_item_claim(${Object.keys(retainedTarget).join(',')})
          VALUES(${Object.keys(retainedTarget).map(()=>'?').join(',')})`).run(...Object.values(retainedTarget));
        app.store.db.prepare('DELETE FROM achievement_claim WHERE operation_id=?').run(operation.id);
        await close(); await open();
        assert.equal(app.store.db.prepare('SELECT operation_id FROM achievement_claim WHERE achievement_id=? AND completed_at=?')
          .get(row.achievementId, row.completedAt).operation_id, operation.id, 'Known pending queue restores only its real claim identity');
      }
      parse(await push({}, [operation])); await close(); await open();
      assert.deepEqual(app.store.operations(), []);
      const after = snapshot();
      assert.equal((await push({ [name]: [baseline] })).status, 400);
      assert.equal((await push({}, [], { [name]: [{ [profile.idField]: itemId }] })).status, 400);
      assert.equal(snapshot(), after);
      const reconciled = parse(await push({ UserAchievement: [row] }));
      assert.equal(reconciled.data.UserAchievement[0].state, 4);
      assert.equal(app.store.read('UserAchievement').data[0].state, 4);
      assert.equal(reconciled.dataTokens.UserAchievement, md5([received]));
      app.store.db.exec('DELETE FROM reply_cache'); await close(); await open();
      const settled = snapshot(); assert.equal((await claim(bodyRows)).status, 400); assert.equal(snapshot(), settled);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM achievement_claim').get().n, 1);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM achievement_item_claim').get().n, 1);
      assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    }
    // Ten authentic first-per-table mission rewards carry multiple ordinary
    // items. A partial first constructor cannot be replayed as the full gain.
    const partialTypes=[...types].filter(([,value])=>value.original.rewardAmount>1);
    assert.equal(partialTypes.length,10);
    for(const [name,{id,original,itemId,profile}] of partialTypes) {
      now=Math.max(1,original.startAt);await fresh(`partial-first-${name}`);
      const row=claimRow(id);put('UserAchievement',[row]);put(name,[]);
      const operation=parse(await claim([row])).operations[0],
        target=app.store.db.prepare('SELECT * FROM achievement_item_claim WHERE operation_id=? AND item_id=?')
          .get(operation.id,itemId),partial=itemRow(itemId,1,1);
      assert.equal(target.cap_version,0);assert.equal(target.table_name,profile.table);
      assert.equal(target.cumulative_amount,original.rewardAmount);assert.ok(original.rewardAmount>1);
      put(name,[partial]);await close();await open();
      const before=snapshot();await reject(send('user_data/confirm'),503,before);await reject(send('user/login'),503,before);
      assert.deepEqual(app.store.operations(),[operation],'Partial first-constructor mission reward stays queued without additive replay');
    }
    // Mixed uncapped/captured items prune independently after an interrupted native save.
    now=1; await fresh('mixed-ordinary-capped-cold');
    const mixedIds=[6020000112,6020000100],mixedRows=mixedIds.map(id=>claimRow(id)),
      staminaId=master.items['stamina_ticket.jagamarukun'],ticketId=master.items['gacha_ticket.character_4'],
      staminaBefore=itemRow(staminaId,3,3),ticketBefore=itemRow(ticketId,2,2);
    put('UserAchievement',mixedRows);put('UserStaminaTicket',[staminaBefore]);put('UserGachaTicket',[ticketBefore]);
    const mixedOperation=parse(await claim(mixedRows)).operations[0],
      staminaAfter=itemRow(staminaId,4,4),ticketAfter={...itemRow(ticketId,3,3),signature:mixedOperation.signature},
      mixedRecovered={...mixedOperation,parameters:{...mixedOperation.parameters,
        receivedItems:mixedOperation.parameters.receivedItems.filter(row=>row.itemId===ticketId)}};
    parse(await push({UserStaminaTicket:[staminaAfter]}));await close();await open();
    assert.deepEqual(app.store.achievementColdRecovery(mixedOperation),mixedRecovered);
    assert.deepEqual(parse(await send('user_data/confirm')).operations,[mixedRecovered]);
    parse(await push({UserGachaTicket:[ticketAfter],UserAchievement:mixedRows.map(row=>({...row,state:4}))},[mixedOperation]));
    assert.deepEqual(app.store.operations(),[]);

    // Server-owned Iris still needs its mission flag, not another inventory gain.
    // This does not establish native reset eligibility for a different date.
    const [irisId, irisReward] = Object.entries(master.achievements).find(([, a]) =>
      a.rewardType === 3 && a.rewardKey === 'currency.gem' && !a.expireAt);
    now = Math.max(1, irisReward.startAt); await fresh('iris');
    const irisRow = claimRow(irisId), irisBefore = app.store.hardCurrency();
    put('UserAchievement', [irisRow]);
    for (const table of ['achievement_claim','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_iris BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'Iris rollback'); END`);
      const before = snapshot(); assert.equal((await claim([irisRow])).status, 503); assert.equal(snapshot(), before);
      assert.equal(app.store.hardCurrency(), irisBefore);
      app.store.db.exec('DROP TRIGGER fail_iris');
    }
    const irisOp = parse(await claim([irisRow])).operations[0];
    assert.equal(app.store.hardCurrency(), irisBefore + irisReward.rewardAmount);
    const beforeFlags = snapshot(); assert.equal((await push({}, [irisOp])).status, 400); assert.equal(snapshot(), beforeFlags);
    parse(await push({ UserAchievement: [{ ...irisRow, state: 4 }] })); await close(); await open();
    await reject(claim([irisRow]));
    assert.equal(app.store.hardCurrency(), irisBefore + irisReward.rewardAmount);
    parse(await push({}, [irisOp]));
    app.store.db.prepare('DELETE FROM achievement_claim WHERE operation_id=?').run(irisOp.id);
    await close(); await open();
    assert.equal(app.store.db.prepare('SELECT operation_id FROM achievement_claim WHERE achievement_id=? AND completed_at=?')
      .get(irisRow.achievementId, irisRow.completedAt).operation_id, irisOp.id, 'Actual successful cache backfills the completed identity');
    const corrected = parse(await push({ UserAchievement: [irisRow] }));
    assert.equal(corrected.data.UserAchievement[0].state, 4);
    parse(await push({ UserAchievement: [{ ...irisRow, state: 2 }] }));
    assert.equal(app.store.read('UserAchievement').data[0].state, 2, 'Reset-in-progress is not rewritten as received');
    now++;
    parse(await push({ UserAchievement: [{ ...irisRow, completedAt: now }] }));
    assert.equal(app.store.read('UserAchievement').data[0].state, 3, 'A different date is not treated as the same receipt');
    app.store.db.exec('DELETE FROM reply_cache'); await close(); await open();
    const completed = snapshot(); assert.equal((await claim([irisRow])).status, 400); assert.equal(snapshot(), completed);
    assert.equal(app.store.hardCurrency(), irisBefore + irisReward.rewardAmount);

    // Two real authored IDs for the same item: one gain must not satisfy both.
    const shared = Object.entries(master.achievements).filter(([, a]) => a.rewardKey === 'stamina_ticket.jagamarukun' && !a.startAt && !a.expireAt).slice(0, 2);
    assert.equal(shared.length, 2); now = 1; await fresh('concurrent');
    const rows = shared.map(([id]) => claimRow(id)), itemId = master.items['stamina_ticket.jagamarukun'];
    put('UserAchievement', rows); put('UserStaminaTicket', [itemRow(itemId, 0)]);
    const first = parse(await claim([rows[0]])).operations[0], second = parse(await claim([rows[1]])).operations[0];
    const firstAmount = shared[0][1].rewardAmount, total = firstAmount + shared[1][1].rewardAmount;
    assert.equal(app.store.db.prepare('SELECT cumulative_amount FROM achievement_item_claim WHERE operation_id=?').get(second.id).cumulative_amount, total);
    parse(await push({ UserAchievement: rows.map(row => ({ ...row, state: 4 })), UserStaminaTicket: [itemRow(itemId, firstAmount)] }));
    const partial = snapshot(); assert.equal((await push({}, [first, second])).status, 400); assert.equal(snapshot(), partial);
    parse(await push({}, [first])); await close(); await open();
    assert.equal((await push({}, [second])).status, 400);
    parse(await push({ UserStaminaTicket: [itemRow(itemId, total)] }, [second]));
    assert.deepEqual(app.store.operations(), []);

    // WRITTEN ONLY: original box/mission sources serialize actual ticket ACKs; unsupported coalescing cannot guess their nonce/order.
    for (const boxFirst of [true, false]) {
      now = master.eventBoxes[193000001].startAt; await fresh(`box-mission-${boxFirst}`);
      const row = claimRow(6050000008), ticketId = master.items['gacha_ticket.normal'];
      const contents = master.eventBoxes[193000001].steps[0].contents;
      const ticketIndex = contents.findIndex(prize => master.items[prize.rewardKey] === ticketId);
      assert.ok(ticketIndex >= 0);
      const ticketRoll = contents.slice(0,ticketIndex).reduce((sum,prize) => sum + prize.weight,0);
      crypto.randomInt = (...args) => args.length === 1 ? ticketRoll : realRandomInt(...args);
      assert.equal(master.achievements[row.achievementId].rewardAmount, 1);
      assert.equal(ticketId, 296000001);
      put('UserAchievement', [row]); put('UserGachaTicket', []);
      const stock = { userId: seed.userId, eventItemId: 290000028, amount: 1000, cumulativeAmount: 1000, signature: 0, bookEntryState: 3 };
      put('UserEventItem', [stock]);
      let drawn, mission;
      const draw = () => send('event_box/draw', { eventBoxId: 193000001, drawCount: 1 });
      const saveBox=async(cumulative)=> {
        const op=drawn.operations[0];
        parse(await push({UserGachaTicket:[{...itemRow(ticketId,cumulative,cumulative),signature:op.signature}],
          UserEventItem:[{...stock,amount:1000-drawn.consumedItem.amount}],
          UserEventBox:[{userId:seed.userId,eventBoxId:193000001,currentStepId:194000001,totalDrawCount:drawn.consumedItem.amount}],
          UserEventBoxContent:drawn.UserEventBoxContent,UserEventBoxStep:drawn.UserEventBoxStep},[op]));
      };
      const saveMission=async(cumulative)=> {
        const op=mission.operations[0];
        parse(await push({UserAchievement:[{...row,state:4}],
          UserGachaTicket:[{...itemRow(ticketId,cumulative,cumulative),signature:op.signature}]},[op]));
      };
      if(boxFirst) {
        drawn=parse(await draw());await reject(claim([row]),400);await saveBox(1);await close();await open();
        mission=parse(await claim([row]));await saveMission(2);
      } else {
        mission=parse(await claim([row]));await reject(draw());await saveMission(1);await close();await open();
        drawn=parse(await draw());await saveBox(2);
      }
      assert.deepEqual(drawn.chosenItems.map(({itemId,amount})=>({itemId,amount})),[{itemId:ticketId,amount:1}]);
      assert.equal(app.store.db.prepare('SELECT cumulative_amount FROM achievement_item_claim WHERE operation_id=?')
        .get(mission.operations[0].id).cumulative_amount,boxFirst?2:1);
      assert.equal(app.store.db.prepare('SELECT cumulative_amount FROM event_box_reward_claim WHERE operation_id=?')
        .get(drawn.operations[0].id).cumulative_amount,boxFirst?1:2);
      await close(); await open(); assert.deepEqual(app.store.operations(), []);
      assert.equal(app.store.read('UserGachaTicket').data[0].cumulativeAmount, 2);
    }
    // WRITTEN ONLY / NOT RUN: fourteen classes, all13 personal-bond and four non-replenishing Adventure Ticket missions.
    const cappedTypes=[...types].filter(([name])=>cappedTables.has(name));assert.equal(cappedTypes.length,14);
    for(const itemId of [298000002,298000003,298000006]) {
      const [id,original]=Object.entries(master.achievements).find(([id,row])=>master.items[row.rewardKey]===itemId && !master.warGameAchievements[id]);
      cappedTypes.push(['UserAdventureTicket',{id,original,itemId,profile:master.itemProfiles[itemId]}]);
    }
    const firstBondMission=types.get('UserLimitBreakItem'),bondMissions=Object.entries(master.achievements)
      .filter(([id,row])=>id!==firstBondMission.id && master.itemProfiles[master.items[row.rewardKey]]?.table==='UserLimitBreakItem' &&
        !master.warGameAchievements[id]);
    assert.equal(bondMissions.length,12);
    for(const [id,original] of bondMissions) {
      const itemId=master.items[original.rewardKey];
      cappedTypes.push(['UserLimitBreakItem',{id,original,itemId,profile:master.itemProfiles[itemId]}]);
    }
    for(const [name,{id,original,itemId,profile}] of cappedTypes)
      for(const order of ['stock-first','flags-first','signature-first','together','spent-first','cumulative-first','spent-before-signature']) {
        now=Math.max(1,original.startAt);await fresh(`mission-cap-${id}-${order}`);
        const quantity=original.rewardAmount,row=claimRow(id),received={...row,state:4},
          cumulative=order==='flags-first'?999999999-quantity:['stock-first','cumulative-first'].includes(order)?999999998:999999999,
          amount=order==='stock-first'||order==='spent-before-signature'?0:order==='signature-first'?999999999:
            order==='together'?999999998:7,
          baseline={...itemRow(itemId,cumulative,amount),...(['UserAlarmVoiceItem','UserLimitBreakItem'].includes(name)?{bookEntryState:255}:{}),
            ...(name==='UserMemoriaExpItem'?{lastAquiredAt:now-315360001,bookEntryState:255}:{}),
            signature:order==='signature-first'?0xffffffff:0x7fffffff},
          wallet=app.store.hardCurrency();
        put('UserAchievement',[row]);put(name,[baseline]);
        for(const table of ['operation_queue','achievement_pc_delivery','achievement_item_claim','achievement_claim','achievement_request','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER mission_cap_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'mission issue rollback'); END`);
          const before=snapshot();assert.equal((await claim([row])).status,503);assert.equal(snapshot(),before);
          app.store.db.exec('DROP TRIGGER mission_cap_issue_fail');
        }
        const realInt=crypto.randomInt;let response;
        try {crypto.randomInt=()=>baseline.signature===0xffffffff?1:baseline.signature;response=await claim([row]);}
        finally {crypto.randomInt=realInt;}
        const identity=sequence,result=parse(response),op=result.operation,
          target=app.store.db.prepare('SELECT * FROM achievement_item_claim WHERE operation_id=?').get(op.id),
          capture=JSON.parse(target.stock_state),acquired={...baseline,amount:Math.min(999999999,amount+quantity),
            cumulativeAmount:999999999,signature:op.signature};
        assert.deepEqual(result.operations,[op]);assert.equal(op.signature,1);assert.equal(op.type,6000);
        assert.deepEqual(result.receivedItems,[{itemId,amount:quantity}]);assert.equal(app.store.hardCurrency(),wallet);
        assert.equal(target.cap_version,1);assert.equal(target.id_field,profile.idField);
        assert.equal(target.cumulative_amount,999999999);assert.deepEqual(capture,{policy:'offline-achievement-stock-cap-v1',
          beforeCumulative:cumulative,beforeAmount:amount,amount:acquired.amount,beforeSignature:baseline.signature,
          signature:op.signature,amountAdded:0,observed:false,effect:false});
        assert.deepEqual(app.store.read(name).data,[baseline],'Mission issuance never precredits native inventory/signatures');
        assert.deepEqual(parse(await claim([row])).operation,op);
        const noEffect=snapshot();assert.equal((await push({},[op])).status,400);assert.equal(snapshot(),noEffect);
        for(const changes of [{cap_version:0},{stock_state:null},{cap_version:0,stock_state:null},{stock_state:'{'},
          ...[{policy:'offline-shop-stock-cap-v1'},{beforeSignature:op.signature},{signature:baseline.signature},
            {amountAdded:capture.amount-capture.beforeAmount+1,effect:true},{beforeAmount:-1},{observed:true},{extra:true}]
            .map(change=>({stock_state:JSON.stringify({...capture,...change})}))]) {
          app.store.db.prepare(`UPDATE achievement_item_claim SET ${Object.keys(changes).map(k=>`${k}=?`).join(',')} WHERE operation_id=?`)
            .run(...Object.values(changes),op.id);
          await reject(claim([row]));await reject(push({},[op]));
          app.store.db.prepare('UPDATE achievement_item_claim SET cap_version=1,stock_state=? WHERE operation_id=?').run(target.stock_state,op.id);
        }
        for(const change of [{userId:2},{amount:-1},{signature:-1},{signature:0x100000000},{signature:baseline.signature},
          ...(['UserEquipmentEnhanceItem','UserEquipmentEvolveItem','UserHeroSublimateItem','UserHeroSublimateUnlockItem'].includes(name)?
            [{reservedAmount:-1},{bookEntryState:256},{lastResetAt:0},{dateList:[]}]:[]),
          ...(name==='UserAdventureTicket'?[{lastResetAt:undefined},{lastResetAt:-1},{lastResetAt:'0'},{reservedAmount:0},
            {dateList:[]},{bookEntryState:-1},{bookEntryState:256},{heroSublimateItemId:itemId}]:[]),
          ...(name==='UserAlarmVoiceItem'?[{reservedAmount:undefined},{reservedAmount:-1},{bookEntryState:-1},{bookEntryState:256},
            {lastResetAt:0},{lastAquiredAt:0},{dateList:[]},{voiceId:itemId}]:[]),
          ...(name==='UserLimitBreakItem'?[{bookEntryState:undefined},{bookEntryState:-1},{bookEntryState:256},
            {signature:undefined},{reservedAmount:0},{lastResetAt:0},{lastAquiredAt:0},{dateList:[]},{generalLimitBreakItemId:itemId}]:[]),
          ...(name==='UserMemoriaExpItem'?[{lastAquiredAt:undefined},{lastAquiredAt:-1},{lastAquiredAt:'0'},
            {lastAquiredAt:now},{reservedAmount:undefined},{reservedAmount:-1},{bookEntryState:-1},{bookEntryState:256},
            {lastResetAt:0},{lastAcquiredAt:0},{dateList:[]},{memoriaId:itemId}]:[])]) {
          const before=snapshot();assert.equal((await push({UserAchievement:[received],[name]:[{...acquired,...change}]},[op])).status,400);
          assert.equal(snapshot(),before);
        }
        let finalItem=acquired;
        if(order!=='together' && order!=='flags-first') {
          const partial=order==='stock-first'||order==='spent-before-signature'?{...baseline,amount:acquired.amount}:
            order==='cumulative-first'?{...baseline,cumulativeAmount:999999999}:order==='spent-first'?{...acquired,amount:0}:acquired;
          for(const [table,event] of [['profile','UPDATE'],['achievement_item_claim','UPDATE OF stock_state'],['reply_cache','INSERT']]) {
            app.store.db.exec(`CREATE TRIGGER mission_cap_save_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'mission partial rollback'); END`);
            const before=snapshot();assert.equal((await push({[name]:[partial]})).status,503);assert.equal(snapshot(),before);
            app.store.db.exec('DROP TRIGGER mission_cap_save_fail');
          }
          const saved=parse(await push({[name]:[partial]}));assert.deepEqual(saved.operations,[]);assert.equal(saved.operation,undefined);
          assert.deepEqual(app.store.operations(),[op]);
          const observed=JSON.parse(app.store.db.prepare('SELECT stock_state FROM achievement_item_claim WHERE operation_id=?').get(op.id).stock_state);
          assert.equal(observed.effect,true);assert.equal(observed.observed,['signature-first','spent-first'].includes(order));
          assert.equal(observed.amountAdded,Math.max(0,partial.amount-amount));
          if(order==='spent-before-signature'||observed.observed) {
            parse(await push({[name]:[{...partial,amount:0}]}));const spent=snapshot();
            assert.equal((await push({[name]:[{...partial,amount:1}]})).status,400);assert.equal(snapshot(),spent);
            finalItem={...acquired,amount:0};
          }
        } else if(order==='flags-first') {
          const saved=parse(await push({UserAchievement:[received]}));assert.deepEqual(saved.operations,[]);
          const flags=snapshot();assert.equal((await push({},[op])).status,400);assert.equal(snapshot(),flags);
        }
        if(order!=='together') {
          await close();await open();await reject(claim([row]));
          await reject(request(port,identity,{achievementIds:[{achievementId:row.achievementId,completedAt:row.completedAt}]},
            String(identity),'achievement/complete'));
          if(['flags-first','signature-first','spent-first'].includes(order)) {
            const source=app.store.operations(),expected={...op,parameters:{...op.parameters,
              UserAchievement:order==='flags-first'?[]:[row],receivedItems:order==='flags-first'?op.parameters.receivedItems:[]}},
              inventory=structuredClone(app.store.read(name).data);
            assert.deepEqual(parse(await send('user_data/confirm')).operations,[expected]);
            parse(await send('user/login'));
            assert.equal((await send('user_data/pull',{tables:['UserAchievement',name]})).status,200);
            assert.deepEqual(app.store.operations(),source);assert.deepEqual(app.store.read(name).data,inventory);
          } else {
            for(const action of ['user/login','user_data/confirm']) await reject(send(action,undefined));
            await reject(send('user_data/pull',{tables:['UserAchievement',name]}));
          }
        }
        const final={UserAchievement:[received],[name]:[finalItem]};
        for(const [table,event] of [['profile','UPDATE'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER mission_cap_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'mission ACK rollback'); END`);
          const before=snapshot();assert.equal((await push(final,[op])).status,503);assert.equal(snapshot(),before);
          app.store.db.exec('DROP TRIGGER mission_cap_ack_fail');
        }
        const ackWire=pushBody(final,[op]),ack=await send('user_data/push',ackWire),ackIdentity=sequence;parse(ack);
        await close();await open();assert.deepEqual(app.store.operations(),[]);
        const retained=snapshot();assert.deepEqual((await request(port,ackIdentity,ackWire,String(ackIdentity),'user_data/push')).body,ack.body);
        assert.equal(snapshot(),retained,'Exact ACK retry must not reapply a capped mission reward');
        const completed=JSON.parse(app.store.db.prepare('SELECT stock_state FROM achievement_item_claim WHERE operation_id=?').get(op.id).stock_state);
        assert.equal(completed.observed,true);assert.equal(completed.effect,true);assert.equal(app.store.hardCurrency(),wallet);
        parse(await push({[name]:[{...finalItem,amount:0}]}));
        for(const changes of [{amount:1},{amount:1,signature:op.signature===1?2:1},{cumulativeAmount:999999998}]) {
          const before=snapshot();assert.equal((await push({[name]:[{...finalItem,amount:0,...changes}]})).status,400);assert.equal(snapshot(),before);
        }
        const beforeDelete=snapshot();assert.equal((await push({},[],{[name]:[{[profile.idField]:itemId}]})).status,400);assert.equal(snapshot(),beforeDelete);
      }
    //WRITTEN ONLY / NOT RUN: the other nine authored Memoria EXP missions keep their original quantities and windows.
    const firstMemoriaMission=types.get('UserMemoriaExpItem'),memoriaMissions=Object.entries(master.achievements)
      .filter(([id,row])=>id!==firstMemoriaMission.id && master.itemProfiles[master.items[row.rewardKey]]?.table==='UserMemoriaExpItem' &&
        !master.warGameAchievements[id]);
    assert.equal(memoriaMissions.length,9);
    for(const [id,original] of memoriaMissions) {
      now=Math.max(1,original.startAt);await fresh(`memoria-mission-${id}`);
      const itemId=master.items[original.rewardKey],row=claimRow(id),baseline={...itemRow(itemId,999999999,0),
        signature:0xffffffff,bookEntryState:255,lastAquiredAt:now-315360001};
      put('UserAchievement',[row]);put('UserMemoriaExpItem',[baseline]);
      const response=parse(await claim([row])),op=response.operation;
      assert.deepEqual(response.receivedItems,[{itemId,amount:original.rewardAmount}]);
      const after={...baseline,amount:original.rewardAmount,signature:op.signature};
      parse(await push({UserAchievement:[{...row,state:4}],UserMemoriaExpItem:[after]},[op]));
      await close();await open();assert.deepEqual(app.store.operations(),[]);
      assert.deepEqual(app.store.read('UserMemoriaExpItem').data,[after]);
      await reject(push({UserMemoriaExpItem:[{...after,lastAquiredAt:now}]}),400);
      assert.deepEqual(parse(await claim([row])).operations,[],'An acknowledged authored Memoria EXP mission cannot grant twice');
    }
    // WRITTEN ONLY / NOT RUN: original CP + Hero + Iris missions share one full-width nonce and strict mixed ACK.
    for(const order of ['cp-first','hero-first','together']) {
      const cp=types.get('UserCpItem'),hero=types.get('UserHeroSublimateItem');
      now=Math.max(1,cp.original.startAt,hero.original.startAt,irisReward.startAt);await fresh(`mission-mixed-cap-${order}`);
      const rows=[claimRow(cp.id),claimRow(hero.id),claimRow(irisId)],received=rows.map(row=>({...row,state:4})),
        cpBefore={...itemRow(cp.itemId,999999999,7),signature:0xff},
        heroBefore={...itemRow(hero.itemId,999999999,11),signature:0x100},wallet=app.store.hardCurrency();
      put('UserAchievement',rows);put('UserCpItem',[cpBefore]);put('UserHeroSublimateItem',[heroBefore]);
      const realInt=crypto.randomInt;let response;
      try {crypto.randomInt=()=>0xff;response=await claim(rows);} finally {crypto.randomInt=realInt;}
      const identity=sequence,result=parse(response),op=result.operation,
        cpAfter={...cpBefore,amount:7+cp.original.rewardAmount,signature:op.signature},
        heroAfter={...heroBefore,amount:11+hero.original.rewardAmount,signature:op.signature},
        final={UserAchievement:received,UserCpItem:[cpAfter],UserHeroSublimateItem:[heroAfter]};
      assert.equal(op.signature,0x101);assert.equal(app.store.hardCurrency(),wallet+irisReward.rewardAmount);
      assert.deepEqual(result.receivedItems,[{itemId:cp.itemId,amount:cp.original.rewardAmount},
        {itemId:hero.itemId,amount:hero.original.rewardAmount}]);
      const targets=app.store.db.prepare('SELECT * FROM achievement_item_claim WHERE operation_id=?').all(op.id);
      assert.equal(targets.length,2);assert.ok(targets.every(t=>t.cap_version===1 && JSON.parse(t.stock_state).signature===op.signature));
      for(const table of ['UserCpItem','UserHeroSublimateItem']) {
        const incomplete={...final};delete incomplete[table];const before=snapshot();
        assert.equal((await push(incomplete,[op])).status,400);assert.equal(snapshot(),before);
      }
      const partial=order==='cp-first'?{UserCpItem:[cpAfter]}:order==='hero-first'?{UserHeroSublimateItem:[heroAfter]}:
        {UserCpItem:[cpAfter],UserHeroSublimateItem:[heroAfter]};
      parse(await push(partial));await close();await open();assert.deepEqual(app.store.operations(),[op]);
      await reject(claim(rows));await reject(request(port,identity,{achievementIds:rows.map(({achievementId,completedAt})=>
        ({achievementId,completedAt}))},String(identity),'achievement/complete'));
      assert.equal(app.store.hardCurrency(),wallet+irisReward.rewardAmount);
      for(const [table,event] of [['profile','UPDATE'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER mission_mixed_cap_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'mixed ACK rollback'); END`);
        const before=snapshot();assert.equal((await push(final,[op])).status,503);assert.equal(snapshot(),before);
        app.store.db.exec('DROP TRIGGER mission_mixed_cap_fail');
      }
      const ackWire=pushBody(final,[op]),ack=await send('user_data/push',ackWire),ackIdentity=sequence;parse(ack);
      await close();await open();assert.deepEqual(app.store.operations(),[]);const retained=snapshot();
      assert.deepEqual((await request(port,ackIdentity,ackWire,String(ackIdentity),'user_data/push')).body,ack.body);
      assert.equal(snapshot(),retained);assert.equal(app.store.hardCurrency(),wallet+irisReward.rewardAmount);
    }
    // WRITTEN ONLY / NOT RUN: every original mission ticket ID, seven native dated-save orders.
    const datedTypes=new Map();
    for(const [id,original] of Object.entries(master.achievements)) {
      const itemId=master.items[original.rewardKey];
      if(master.itemProfiles[itemId]?.table!=='UserGachaTicket' || master.warGameAchievements[id]) continue;
      if(!datedTypes.has(itemId) || datedTypes.get(itemId).original.rewardAmount<original.rewardAmount)
        datedTypes.set(itemId,{id,original});
    }
    assert.equal(datedTypes.size,18);
    for(const [itemId,{id,original}] of datedTypes)
      for(const order of ['append-first','flags-first','cumulative-first','signature-first','together','expired-before-save','prune-before-gain']) {
        const quantity=original.rewardAmount,duration=master.lotteryTickets[itemId];assert.ok(Number.isSafeInteger(duration) && duration>0);
        now=Math.max(duration+1,original.startAt,1);await fresh(`mission-dated-${itemId}-${order}`);
        const row=claimRow(id),received={...row,state:4},wallet=app.store.hardCurrency(),
          baseline={...itemRow(itemId,order==='flags-first'?999999999-quantity:
            ['signature-first','expired-before-save'].includes(order)?999999999:999999998),bookEntryState:-128,
            signature:order==='signature-first'?0xffffffff:0x7fffffff,dateList:['signature-first','expired-before-save'].includes(order)?[]:
              [{aquiredAt:order==='prune-before-gain'?now-duration-1:now-1},{aquiredAt:order==='prune-before-gain'?now-duration-1:now-1}]};
        put('UserAchievement',[row]);put('UserGachaTicket',[baseline]);
        for(const bad of [{...baseline,amount:1},{...baseline,bookEntryState:128},{...baseline,signature:0x100000000},
          {...baseline,dateList:[{aquiredAt:now,expireAt:now+duration}]}]) {
          put('UserGachaTicket',[bad]);await reject(claim([row]),400);put('UserGachaTicket',[baseline]);
        }
        for(const table of ['operation_queue','achievement_pc_delivery','achievement_item_claim','achievement_claim','achievement_request','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER mission_dated_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'dated mission issue rollback'); END`);
          const before=snapshot();assert.equal((await claim([row])).status,503);assert.equal(snapshot(),before);
          app.store.db.exec('DROP TRIGGER mission_dated_issue_fail');
        }
        const randomInt=crypto.randomInt;let response;
        try {crypto.randomInt=()=>baseline.signature===0xffffffff?1:baseline.signature;response=await claim([row]);}
        finally {crypto.randomInt=randomInt;}
        const identity=sequence,result=parse(response),op=result.operation,
          target=app.store.db.prepare('SELECT * FROM achievement_item_claim WHERE operation_id=?').get(op.id),capture=JSON.parse(target.gacha_state),
          newDates=Array.from({length:quantity},()=>({aquiredAt:now})),
          acquired={...baseline,cumulativeAmount:999999999,signature:op.signature,
            dateList:[...(order==='prune-before-gain'?[]:baseline.dateList),...newDates]},
          finalTicket=['append-first','signature-first','expired-before-save','cumulative-first'].includes(order)?{...acquired,dateList:[]}:acquired;
        assert.equal(op.type,6000);assert.equal(op.signature,1);assert.deepEqual(result.operations,[op]);
        assert.deepEqual(result.receivedItems,[{itemId,amount:quantity}]);assert.equal(target.cap_version,1);assert.equal(target.stock_state,null);
        assert.deepEqual(capture,{policy:'offline-achievement-gacha-cap-v1',beforeCumulative:baseline.cumulativeAmount,
          beforeDates:baseline.dateList,beforeSignature:baseline.signature,signature:op.signature,dateAdditions:0,observed:false,effect:false});
        assert.deepEqual(app.store.read('UserGachaTicket').data,[baseline]);assert.equal(app.store.hardCurrency(),wallet);
        assert.deepEqual(parse(await claim([row])).operation,op);assert.equal(app.store.pendingCappedGachaTicket(itemId),true);
        await reject(push({},[op]),400);
        const held=snapshot();assert.throws(()=>app.store.issueDraw([1011002001],{userGachaTicket:baseline},1000),/mission tickets/);
        assert.equal(snapshot(),held,'Pending dated6000 cannot be overtaken by a full-row lottery consumer');
        for(const changes of [{cap_version:0},{gacha_state:null},{cap_version:0,gacha_state:null},{gacha_state:'{'},{stock_state:'{}'},
          ...[{policy:'offline-shop-gacha-cap-v1'},{signature:baseline.signature},{beforeSignature:op.signature},
            {dateAdditions:quantity+1},{beforeCumulative:-1},{observed:true},{extra:true}]
            .map(change=>({gacha_state:JSON.stringify({...capture,...change})}))]) {
          app.store.db.prepare(`UPDATE achievement_item_claim SET ${Object.keys(changes).map(k=>`${k}=?`).join(',')} WHERE operation_id=?`)
            .run(...Object.values(changes),op.id);await reject(claim([row]));await reject(push({},[op]));
          app.store.db.prepare('UPDATE achievement_item_claim SET cap_version=1,stock_state=NULL,gacha_state=? WHERE operation_id=?')
            .run(target.gacha_state,op.id);
        }
        for(const bad of [{...acquired,userId:2},{...acquired,signature:baseline.signature},{...acquired,signature:0x100000000},
          {...acquired,bookEntryState:128},{...acquired,amount:quantity},{...acquired,dateList:[{aquiredAt:now,expireAt:now+duration}]}])
          await reject(push({UserAchievement:[received],UserGachaTicket:[bad]},[op]),400);
        if(order!=='together') {
          const partial=order==='append-first'?{UserGachaTicket:[{...baseline,dateList:[...baseline.dateList,...newDates]}]}:
            order==='flags-first'?{UserAchievement:[received]}:order==='cumulative-first'?{UserGachaTicket:[{...baseline,cumulativeAmount:999999999}]}:
              order==='prune-before-gain'?{UserGachaTicket:[{...baseline,dateList:[]}]}:{UserGachaTicket:[finalTicket]};
          for(const [table,event] of [['profile','UPDATE'],...(order==='prune-before-gain'?[]:
            [[order==='flags-first'?'achievement_pc_delivery':'achievement_item_claim',order==='flags-first'?'UPDATE':'UPDATE OF gacha_state']]),['reply_cache','INSERT']]) {
            app.store.db.exec(`CREATE TRIGGER mission_dated_save_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'dated mission save rollback'); END`);
            const before=snapshot();assert.equal((await push(partial)).status,503);assert.equal(snapshot(),before);
            app.store.db.exec('DROP TRIGGER mission_dated_save_fail');
          }
          parse(await push(partial));assert.deepEqual(app.store.operations(),[op]);
          const state=JSON.parse(app.store.db.prepare('SELECT gacha_state FROM achievement_item_claim WHERE operation_id=?').get(op.id).gacha_state);
          assert.equal(state.observed,['signature-first','expired-before-save'].includes(order));
          assert.equal(state.dateAdditions,order==='append-first'?quantity:0);
          assert.equal(state.effect,!['flags-first','prune-before-gain'].includes(order));
          if(order==='append-first') {
            parse(await push({UserGachaTicket:[{...baseline,dateList:[]}]}));
            await reject(push({UserGachaTicket:[{...baseline,dateList:newDates}]}),400);
          }
          if(state.observed) await reject(push({UserGachaTicket:[{...finalTicket,dateList:[{aquiredAt:now+1}]}]}),400);
          await close();await open();
          if(order==='prune-before-gain') {
            assert.deepEqual(parse(await claim([row])).operation,op,'Expiry alone must not mark6000 delivered');
            assert.deepEqual(parse(await send('user_data/confirm')).operations,[op]);
            parse(await send('user/login'));
            assert.equal((await send('user_data/pull',{tables:['UserAchievement','UserGachaTicket']})).status,200);
            assert.deepEqual(app.store.read('UserGachaTicket').data,[{...baseline,dateList:[]}]);
          }
          else {
            await reject(claim([row]));await reject(request(port,identity,{achievementIds:[{achievementId:row.achievementId,completedAt:row.completedAt}]},
              String(identity),'achievement/complete'));
            if(['flags-first','signature-first','expired-before-save'].includes(order)) {
              const expected={...op,parameters:{...op.parameters,UserAchievement:order==='flags-first'?[]:[row],
                receivedItems:order==='flags-first'?op.parameters.receivedItems:[]}},
                inventory=structuredClone(app.store.read('UserGachaTicket').data);
              assert.deepEqual(parse(await send('user_data/confirm')).operations,[expected]);
              parse(await send('user/login'));
              assert.equal((await send('user_data/pull',{tables:['UserAchievement','UserGachaTicket']})).status,200);
              assert.deepEqual(app.store.operations(),[op]);assert.deepEqual(app.store.read('UserGachaTicket').data,inventory);
            } else {
              for(const action of ['user/login','user_data/confirm']) await reject(send(action,undefined));
              await reject(send('user_data/pull',{tables:['UserAchievement','UserGachaTicket']}));
            }
          }
          await reject(push({},[op]),400);
        }
        const ackWire=pushBody({UserAchievement:[received],UserGachaTicket:[finalTicket]},[op]);
        for(const [table,event] of [['profile','UPDATE'],...(['signature-first','expired-before-save'].includes(order)?[]:
          [['achievement_item_claim','UPDATE OF gacha_state']]),['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER mission_dated_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'dated mission ACK rollback'); END`);
          const before=snapshot();assert.equal((await send('user_data/push',ackWire)).status,503);assert.equal(snapshot(),before);
          app.store.db.exec('DROP TRIGGER mission_dated_ack_fail');
        }
        const ack=await send('user_data/push',ackWire),ackIdentity=sequence;parse(ack);await close();await open();
        assert.deepEqual(app.store.operations(),[]);assert.equal(app.store.pendingCappedGachaTicket(itemId),false);
        assert.equal(JSON.parse(app.store.db.prepare('SELECT gacha_state FROM achievement_item_claim WHERE operation_id=?').get(op.id).gacha_state).observed,true);
        const retained=snapshot();assert.deepEqual((await request(port,ackIdentity,ackWire,String(ackIdentity),'user_data/push')).body,ack.body);
        assert.equal(snapshot(),retained);assert.equal(app.store.hardCurrency(),wallet);
        const spent={...finalTicket,dateList:[]};parse(await push({UserGachaTicket:[spent]}));
        await reject(push({UserGachaTicket:[{...spent,dateList:[{aquiredAt:now}]}]}),400);
        await reject(push({UserGachaTicket:[{...spent,cumulativeAmount:999999998}]}),400);
        await reject(push({},[],{UserGachaTicket:[{gachaTicketId:itemId}]}),400);
        const completed=snapshot();assert.throws(()=>app.store.issueDraw([1011002001],{userGachaTicket:{...spent,dateList:[{aquiredAt:now}]}},1000),/cannot be restored/);
        assert.equal(snapshot(),completed,'Shared full-row issuer retains completed mission dated-stock checkpoints');
      }
    // WRITTEN ONLY / NOT RUN: mixed dated/numeric captures and Iris retain one nonce and full ACK.
    for(const order of ['dated-first','numeric-first','together']) {
      const {id,original}=datedTypes.get(296000003),cp=types.get('UserCpItem'),hero=types.get('UserHeroSublimateItem');
      now=Math.max(1,original.startAt,cp.original.startAt,hero.original.startAt,irisReward.startAt);await fresh(`mission-dated-mixed-${order}`);
      const rows=[claimRow(id),claimRow(cp.id),claimRow(hero.id),claimRow(irisId)],received=rows.map(row=>({...row,state:4})),
        ticket={...itemRow(296000003,999999999),bookEntryState:-128,signature:0x101},
        cpBefore={...itemRow(cp.itemId,999999999,7),signature:0xff},heroBefore={...itemRow(hero.itemId,999999999,11),signature:0x100},
        wallet=app.store.hardCurrency();
      put('UserAchievement',rows);put('UserGachaTicket',[ticket]);put('UserCpItem',[cpBefore]);put('UserHeroSublimateItem',[heroBefore]);
      const randomInt=crypto.randomInt;let response;try {crypto.randomInt=()=>0xff;response=await claim(rows);} finally {crypto.randomInt=randomInt;}
      const result=parse(response),op=result.operation,identity=sequence,
        ticketAfter={...ticket,signature:op.signature,dateList:[{aquiredAt:now}]},
        cpAfter={...cpBefore,signature:op.signature,amount:7+cp.original.rewardAmount},
        heroAfter={...heroBefore,signature:op.signature,amount:11+hero.original.rewardAmount},
        final={UserAchievement:received,UserGachaTicket:[ticketAfter],UserCpItem:[cpAfter],UserHeroSublimateItem:[heroAfter]};
      assert.equal(op.signature,0x102);assert.equal(app.store.hardCurrency(),wallet+irisReward.rewardAmount);
      assert.deepEqual(result.receivedItems,[{itemId:296000003,amount:original.rewardAmount},{itemId:cp.itemId,amount:cp.original.rewardAmount},
        {itemId:hero.itemId,amount:hero.original.rewardAmount}]);
      for(const name of ['UserGachaTicket','UserCpItem','UserHeroSublimateItem']) {const partial={...final};delete partial[name];await reject(push(partial,[op]),400);}
      parse(await push(order==='dated-first'?{UserGachaTicket:[ticketAfter]}:order==='numeric-first'?{UserCpItem:[cpAfter],UserHeroSublimateItem:[heroAfter]}:
        {UserGachaTicket:[ticketAfter],UserCpItem:[cpAfter],UserHeroSublimateItem:[heroAfter]}));
      await close();await open();await reject(claim(rows));await reject(request(port,identity,{achievementIds:rows.map(({achievementId,completedAt})=>
        ({achievementId,completedAt}))},String(identity),'achievement/complete'));assert.deepEqual(app.store.operations(),[op]);
      const expected={...op,parameters:{...op.parameters,receivedItems:op.parameters.receivedItems.filter(item=>
        order==='dated-first'?item.itemId!==296000003:order==='numeric-first'?item.itemId===296000003:false)}},
        inventories=['UserGachaTicket','UserCpItem','UserHeroSublimateItem'].map(name=>[name,structuredClone(app.store.read(name).data)]);
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[expected]);parse(await send('user/login'));
      assert.equal((await send('user_data/pull',{tables:['UserAchievement',...inventories.map(([name])=>name)]})).status,200);
      for(const [name,inventory] of inventories) assert.deepEqual(app.store.read(name).data,inventory);
      assert.deepEqual(app.store.operations(),[op]);assert.equal(app.store.hardCurrency(),wallet+irisReward.rewardAmount);
      for(const [table,event] of [['profile','UPDATE'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER mission_dated_mixed_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'dated mixed rollback'); END`);
        const before=snapshot();assert.equal((await push(final,[op])).status,503);assert.equal(snapshot(),before);
        app.store.db.exec('DROP TRIGGER mission_dated_mixed_fail');
      }
      const ackWire=pushBody(final,[op]),ack=await send('user_data/push',ackWire),ackIdentity=sequence;parse(ack);await close();await open();
      const retained=snapshot();assert.deepEqual((await request(port,ackIdentity,ackWire,String(ackIdentity),'user_data/push')).body,ack.body);
      assert.equal(snapshot(),retained);assert.deepEqual(app.store.operations(),[]);assert.equal(app.store.hardCurrency(),wallet+irisReward.rewardAmount);
    }
    // WRITTEN ONLY / NOT RUN: same-item consumer-first1000 must settle before6000 takes a dated baseline.
    for(const itemId of [296000001,296000002]) {
      const {id,original}=datedTypes.get(itemId);now=Math.max(1,original.startAt);await fresh(`mission-dated-consumer-first-${itemId}`);
      const row=claimRow(id),ticket={...itemRow(itemId,999999999,2),signature:7};put('UserAchievement',[row]);put('UserGachaTicket',[ticket]);
      app.store.issueDraw([1011002001],{userGachaTicket:{...ticket,dateList:[ticket.dateList[0]]}},1000);
      await reject(claim([row]),400);await close();await open();await reject(claim([row]),400);
      assert.deepEqual(app.store.operations().map(op=>op.type),[1000]);assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM achievement_item_claim').get().n,0);
    }
    //252 NEW WRITTEN ONLY: all18 original mission ticket classes, first/owned inventory, seven save prefixes.
    for(const [itemId,{id,original}] of datedTypes) for(const baseline of ['first','owned'])
      for(const first of ['flags','initializer','book','cumulative','signature','dates','together']) {
      now=Math.max(master.lotteryTickets[itemId]+1,original.startAt,1);await fresh(`mission-first-${itemId}-${baseline}-${first}`);
      const row=claimRow(id),received={...row,state:4},quantity=original.rewardAmount,
        initial={userId:seed.userId,gachaTicketId:itemId,bookEntryState:baseline==='first'?1:-128,
          signature:baseline==='first'?0:0xffffffff,cumulativeAmount:baseline==='first'?0:100,
          dateList:baseline==='first'?[]:[{aquiredAt:now-master.lotteryTickets[itemId]},{aquiredAt:now-1}]};
      put('UserAchievement',[row]);put('UserGachaTicket',baseline==='first'?[]:[initial]);
      if(first==='initializer') for(const table of ['operation_queue','achievement_pc_delivery','achievement_item_claim','achievement_claim','achievement_request','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER mission_first_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'first-ticket mission issue rollback'); END`);
        await reject(claim([row]),503,undefined,false);app.store.db.exec('DROP TRIGGER mission_first_issue_fail');
      }
      const response=await claim([row]),hotIdentity=sequence,operation=parse(response).operation,
        target=app.store.db.prepare('SELECT * FROM achievement_item_claim WHERE operation_id=?').get(operation.id),
        capture=JSON.parse(target.gacha_state),acquired={...initial,bookEntryState:baseline==='first'?3:initial.bookEntryState,
          cumulativeAmount:initial.cumulativeAmount+quantity,signature:operation.signature,
          dateList:[...initial.dateList.filter(date=>date.aquiredAt+master.lotteryTickets[itemId]>now),
            ...Array.from({length:quantity},()=>({aquiredAt:now}))]},final={...acquired,dateList:[]},
        wallet=[app.store.hardCurrency(),app.store.paidCurrency()],
        native=first==='initializer'?initial:first==='book'?{...initial,bookEntryState:acquired.bookEntryState}:
          first==='cumulative'?{...initial,bookEntryState:acquired.bookEntryState,cumulativeAmount:acquired.cumulativeAmount}:
            first==='signature'?{...initial,signature:operation.signature}:first==='dates'?{...initial,bookEntryState:acquired.bookEntryState,
              cumulativeAmount:baseline==='first'?acquired.cumulativeAmount:initial.cumulativeAmount,dateList:acquired.dateList}:acquired,
        partial=['cumulative','signature','dates'].includes(first),prefix=first==='flags'?{UserAchievement:[received]}:
          {UserGachaTicket:[native],...(first==='together'?{UserAchievement:[received]}:{})};
      assert.equal(capture.policy,baseline==='first'?'offline-achievement-gacha-ticket-first-v1':'offline-achievement-gacha-ticket-v1');
      assert.equal(target.cap_version,1);assert.equal(target.stock_state,null);assert.equal(target.cumulative_amount,acquired.cumulativeAmount);
      assert.deepEqual(capture.beforeDates,initial.dateList);assert.equal(capture.beforeSignature,initial.signature);
      assert.deepEqual(operation.parameters.receivedItems,[{itemId,amount:quantity}]);
      assert.deepEqual(app.store.read('UserGachaTicket').data,baseline==='first'?[]:[initial],'No server-created native ticket inventory');
      assert.throws(()=>app.store.itemAcquisitionReservation(itemId,initial.cumulativeAmount),/Captured mission dated tickets/);
      assert.throws(()=>app.store.issueDraw([1011002001],{userGachaTicket:initial},1000),/mission tickets/);
      if(first==='initializer') for(const bad of [{...acquired,userId:0},{...acquired,pcTicketId:itemId},{...acquired,amount:quantity},
        {...acquired,signature:0x100000000},{...acquired,bookEntryState:128},{...acquired,dateList:[{aquiredAt:now,expireAt:now+1}]}])
        await reject(push({UserGachaTicket:[bad]}),400);
      parse(await push(prefix));await close();await open();
      if(partial) await reject(send('user_data/confirm'));
      else {
        const expected={...operation,parameters:{...operation.parameters,
          UserAchievement:['flags','together'].includes(first)?[]:operation.parameters.UserAchievement,
          receivedItems:first==='together'?[]:operation.parameters.receivedItems}},cold=await send('user_data/confirm'),coldIdentity=sequence;
        assert.deepEqual(parse(cold).operations,[expected]);parse(await send('user/login'));
        await close();await open();assert.deepEqual((await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm')).body,cold.body);
      }
      if(first!=='together') await reject(push({},[operation]),400);
      if(partial || ['flags','together'].includes(first)) {
        await reject(claim([row]));await reject(request(port,hotIdentity,{achievementIds:[{achievementId:row.achievementId,completedAt:row.completedAt}]},
          String(hotIdentity),'achievement/complete'));
      }
      const retained=app.store.db.prepare('SELECT gacha_state FROM achievement_item_claim WHERE operation_id=?').get(operation.id).gacha_state;
      for(const changed of [null,'{',JSON.stringify({...JSON.parse(retained),policy:'offline-gift-gacha-ticket-first-v1'})]) {
        app.store.db.prepare('UPDATE achievement_item_claim SET gacha_state=? WHERE operation_id=?').run(changed,operation.id);
        await reject(send('user_data/confirm'));app.store.db.prepare('UPDATE achievement_item_claim SET gacha_state=? WHERE operation_id=?').run(retained,operation.id);
      }
      for(const [table,event] of [['profile','UPDATE'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT'],
        ...(first==='together'?[]:[['achievement_item_claim','UPDATE'],['achievement_pc_delivery','UPDATE']])]) {
        app.store.db.exec(`CREATE TRIGGER mission_first_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'first-ticket mission ACK rollback'); END`);
        await reject(push({UserAchievement:[received],UserGachaTicket:[final]},[operation]),503,undefined,false);
        app.store.db.exec('DROP TRIGGER mission_first_ack_fail');
      }
      parse(await push({UserAchievement:[received],UserGachaTicket:[final]},[operation]));await close();await open();
      assert.deepEqual(app.store.operations(),[]);assert.deepEqual(app.store.read('UserGachaTicket').data,[final]);
      assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
      await reject(push({UserGachaTicket:[{...final,dateList:[{aquiredAt:now}]}]}),400);
      await reject(push({},[],{UserGachaTicket:[{gachaTicketId:itemId}]}),400);
      put('UserGachaTicket',[]);await reject(send('user_data/pull',{tables:['UserGachaTicket']}));put('UserGachaTicket',[final]);
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[]);
    }
    // WRITTEN ONLY / NOT RUN: the complete archived type-35 catalog uses the
    // native6000 medal scalar and the same full-row custody chain as Presents.
    const unionMedalAchievements=Object.entries(master.achievements).filter(([,row])=>row.rewardType===35);
    assert.deepEqual(unionMedalAchievements.map(([achievementId,row])=>({achievementId:Number(achievementId),category:row.category,
      rewardKey:row.rewardKey,rewardAmount:row.rewardAmount,startAt:row.startAt,expireAt:row.expireAt})),[
      {achievementId:6090000001,category:9,rewardKey:'union_medal_item.1',rewardAmount:1,startAt:1661439600,expireAt:1661925599},
      {achievementId:6090000002,category:9,rewardKey:'union_medal_item.1',rewardAmount:10,startAt:1661439600,expireAt:1661925599},
      {achievementId:6090000003,category:9,rewardKey:'union_medal_item.1',rewardAmount:1,startAt:1661439600,expireAt:1661925599},
      {achievementId:6090000004,category:9,rewardKey:'union_medal_item.1',rewardAmount:10,startAt:1661439600,expireAt:1661925599},
      {achievementId:6090000005,category:9,rewardKey:'union_medal_item.1',rewardAmount:1,startAt:1661439600,expireAt:1661925599},
      {achievementId:6090000006,category:9,rewardKey:'union_medal_item.1',rewardAmount:10,startAt:1661439600,expireAt:1661925599},
      {achievementId:6090000007,category:9,rewardKey:'union_medal_item.1',rewardAmount:15,startAt:1661439600,expireAt:1661925599},
      {achievementId:6090000008,category:9,rewardKey:'union_medal_item.1',rewardAmount:25,startAt:1661439600,expireAt:1661925599},
      {achievementId:6090000009,category:9,rewardKey:'union_medal_item.1',rewardAmount:10,startAt:1661439600,expireAt:1661925599},
      {achievementId:6090000010,category:9,rewardKey:'union_medal_item.1',rewardAmount:15,startAt:1661439600,expireAt:1661925599},
      {achievementId:6090000011,category:9,rewardKey:'union_medal_item.1',rewardAmount:25,startAt:1661439600,expireAt:1661925599},
      {achievementId:6090000012,category:9,rewardKey:'union_medal_item.1',rewardAmount:10,startAt:1661439600,expireAt:1661925599},
      {achievementId:6090000013,category:9,rewardKey:'union_medal_item.1',rewardAmount:15,startAt:1661439600,expireAt:1661925599},
      {achievementId:6090000014,category:9,rewardKey:'union_medal_item.1',rewardAmount:25,startAt:1661439600,expireAt:1661925599},
    ]);
    assert.equal(master.items['union_medal_item.1'],410000001);
    for(const order of ['medal-first','flags-first']) {
      const [achievementId,original]=unionMedalAchievements[0];
      now=original.startAt;await fresh(`mission-union-medal-${order}`);
      const row=claimRow(achievementId),received={...row,state:4};
      put('UserAchievement',[row]);put('UserUnionRaidMedal',[]);
      const result=parse(await claim([row])),operation=result.operations[0],amount=original.rewardAmount,
        initialized={userId:seed.userId,medalId:410000001,amount:0,reservedAmount:0,bookEntryState:1,signature:0,cumulativeAmount:0},
        acquired={...initialized,amount,signature:operation.signature,cumulativeAmount:amount};
      assert.equal(operation.type,6000);assert.equal(operation.parameters.issueUnionRaidMedal,amount);
      assert.deepEqual(operation.parameters.receivedItems,[]);assert.deepEqual(app.store.read('UserUnionRaidMedal').data,[]);
      const capture=app.store.db.prepare('SELECT * FROM union_raid_medal_present WHERE operation_id=?').get(operation.id);
      assert.equal(capture.amount,amount);assert.equal(capture.effect_saved,0);assert.equal(capture.growth_before_id,null);
      assert.deepEqual(JSON.parse(capture.before_json),null);assert.deepEqual(JSON.parse(capture.after_json),acquired);
      await reject(push({},[operation]),400);
      const partial=order==='medal-first'?{UserUnionRaidMedal:[acquired]}:{UserAchievement:[received]};
      parse(await push(partial));
      assert.equal(app.store.db.prepare('SELECT effect_saved FROM union_raid_medal_present WHERE operation_id=?')
        .get(operation.id).effect_saved,order==='medal-first'?1:0);
      await close();await open();await reject(claim([row]));
      const expected={...operation,parameters:{...operation.parameters,
        UserAchievement:order==='flags-first'?[]:operation.parameters.UserAchievement,
        issueUnionRaidMedal:order==='medal-first'?0:operation.parameters.issueUnionRaidMedal}};
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[expected]);
      parse(await push({UserAchievement:[received],UserUnionRaidMedal:[acquired]},[operation]));
      await close();await open();assert.deepEqual(app.store.operations(),[]);
      assert.deepEqual(app.store.read('UserUnionRaidMedal').data,[acquired]);
      await reject(push({UserUnionRaidMedal:[]}),400);
      await reject(push({UserUnionRaidMedal:[initialized]}),400);
    }
    console.log('Mission fixtures include102 numeric/mixed,10 partial-first-ordinary,383 dated/mixed/consumer-first and2 Alliance-Medal save-order contexts WRITTEN ONLY; native reward/save acceptance remains deferred');
  } finally {
    await close(); Date.now = realNow; crypto.randomInt = realRandomInt;
    const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('danmemore-achievement-items-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
