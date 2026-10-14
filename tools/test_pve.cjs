'use strict';

// Synthetic battle statistics/deltas prove the explicit offline policy and
// receipt ordering, NOT publisher scoring, native grants or natural unlocks.
// DEFERRED: do not execute until the all-packet implementation phase is complete.
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
const perfect = { totalDamage: 100, maxDamage: 100, clearTurn: 1, actionCount: 1, frontPCs: 1, memberPCs: 1, deathCount: 0 };
const pcIds = Object.keys(master.pcProfiles).map(Number);
const pc = (id, level = 50) => ({ pcId: id, level, currentJobIndex: 4, limitbreakCount: 0, usableSkillAmount: 3,
  strength: 111, intelligence: 222, agility: 333, vitality: 444, luck: 555, hp: 6000, mp: 300,
  physicalAttackPower: 600, magicAttackPower: 700, defensePower: 800, weaponId: 0, armorId: 0,
  weaponAbilityIds: [], armorAbilityIds: [], heroSublimateLevel: 0, isUnlockedHeroSublimate: false });
const party = (id = pcIds[0], level = 50) => ({ userId: seed.userId, slots: [
  { slotNumber: 0, pc: pc(id, level), assistingPc: pc(pcIds[2], 40) },
  { slotNumber: 1, pc: null, assistingPc: null },
] });
const stageRow = id => ({ ...(seed.data.UserAdventureStage.find(row => row.adventureStageId === id) ?? {
  userId: seed.userId, adventureStageId: id, signature: 0, state: 1, cumulativeClearCount: 0, dailyClearCount: 0,
  currentScore: 0, highScore: 0, firstCompleteDateTime: 0, lastCompleteDateTime: 0,
  firstTryDateTime: 0, lastTryDateTime: 0, ticketClosedAt: 0, ticketOpenedAt: 0, usedTicketId: 0, token: '',
  tasks: Object.entries(master.stageTasks).filter(([, task]) => task.stageId === id)
    .map(([id]) => ({ adventureStageTaskId: Number(id), state: 0 })),
}), state: 1 }); // This fixture starts an open stage; it does not prove native unlocks.
const battle = (id, token, stats = perfect, historical = party()) => ({ adventureStageId: id, token,
  adventureStageTaskIds: [], adventureGainedItems: [], friendshipStates: [],
  adventureRecord: { continueCount: 0, deathCount: stats.deathCount, turnCount: stats.clearTurn },
  isEnemyAnnihilated: true, secretMissionCompleted: false, userPVEScore: stats, userPveParty: historical });

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-pve-'));
  let database, app, port, sequence = 0, rejection;
  const open = async () => {
    app = createServer({ database, seed, master, wallNowSeconds: () => 1790866800, log: line => {
      const event = JSON.parse(line); if (event.event === 'rejected') rejection = event.reason;
    } });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const fresh = async name => { await close(); database = path.join(directory, `${name}.sqlite`); await open(); };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows), md5(rows), name);
  const send = (action, body) => { rejection = undefined; return request(port, ++sequence, body, String(sequence), action); };
  const parse = reply => { assert.equal(reply.status, 200, reply.body.toString() || rejection); return JSON.parse(reply.body); };
  const complete = body => send('pve/stage/complete', body);
  const history = (id, ranking = false) => send(ranking ? 'pve/score/ranking/get' : 'pve/recent/clear/get', { adventureStageId: id });
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name, app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all()]));
  const push = (putItems = {}, operations = [], deleteItems = {}) => send('user_data/push', {
    badges: null, scripts: {}, dataTokens: {}, checksums: { before: {}, after: Object.fromEntries(
      [...new Set([...Object.keys(putItems), ...Object.keys(deleteItems)])].map(name => [name, md5(putItems[name] ?? [])])) },
    deltas: Object.keys(putItems).length || Object.keys(deleteItems).length ? [{ signature: 0, trigger: 'AdventureComplete', putItems, deleteItems }] : [],
    operations: operations.map(operation => ({ id: operation.id, verifier: operation.token })),
  });
  const cleared = operation => {
    const row = operation.parameters.UserAdventureStage[0];
    return { ...row, state: 4, cumulativeClearCount: row.cumulativeClearCount + Math.max(1, operation.parameters.skipCount),
      firstCompleteDateTime: row.firstCompleteDateTime || 1790866800, lastCompleteDateTime: 1790866800,
      currentScore: operation.parameters.finalScore, highScore: Math.max(row.highScore, operation.parameters.finalScore) };
  };
  const acquired = operation => {
    const result = {};
    for (const target of app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(operation.id)) {
      const previous = app.store.read(target.table_name).data.find(row => row[target.id_field] === target.item_id);
      (result[target.table_name] ??= []).push({ ...previous, userId: seed.userId, [target.id_field]: target.item_id,
        cumulativeAmount: target.cumulative_amount,
        ...(['UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial'].includes(target.table_name) && !previous?
          {reservedAmount:0,bookEntryState:3,signature:0}:{}),
        ...(target.table_name === 'UserGachaTicket' ?
          {dateList:[],signature:operation.signature,bookEntryState:!previous || previous.bookEntryState===1?3:previous.bookEntryState} : {amount:0}) });
    }
    return result;
  };
  const settle = operation => push({ UserAdventureStage: [cleared(operation)], ...acquired(operation) }, [operation]);
  // WRITTEN ONLY: actual native score assignment is idempotent; no clear/XP/item effect is fabricated by recovery.
  const recoverScore = async operation => {
    const before=operation.parameters.UserAdventureStage[0],native=app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===before.adventureStageId),
      prefix={...native,currentScore:operation.parameters.finalScore,highScore:Math.max(before.highScore,operation.parameters.finalScore)},
      originalCold=await send('user_data/confirm'),oldIdentity=sequence,iris=app.store.hardCurrency(),changed=before.currentScore!==prefix.currentScore || before.highScore!==prefix.highScore;
    assert.deepEqual(parse(originalCold).operations,[operation]);
    if(changed) for(const [table,event] of [['profile','UPDATE'],['stage_delivery','UPDATE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER score_prefix_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'score prefix rollback'); END`);
      const retained=snapshot();assert.equal((await push({UserAdventureStage:[prefix]})).status,503);assert.equal(snapshot(),retained);
      app.store.db.exec('DROP TRIGGER score_prefix_fail');
    }
    parse(await push({UserAdventureStage:[prefix]}));
    const observed=JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id).observed);
    assert.equal(observed.includes('score'),changed);assert(!observed.includes('clear'));
    const profile=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserAdventureStage'").get(),rows=JSON.parse(profile.data);
    if(changed) for(const changes of [{currentScore:prefix.currentScore?prefix.currentScore-1:1},{highScore:prefix.highScore+1},
      {cumulativeClearCount:before.cumulativeClearCount+1},{dailyClearCount:before.dailyClearCount+1},
      {firstCompleteDateTime:before.firstCompleteDateTime+1},{lastCompleteDateTime:before.lastCompleteDateTime+1},
      {firstTryDateTime:before.firstTryDateTime+1},{lastTryDateTime:before.lastTryDateTime+1},
      {state:before.state===4?3:4},{token:0},{userId:2},{unexpectedField:true},
      ...(prefix.tasks.length?[{tasks:prefix.tasks.map((row,i)=>i?row:{...row,state:row.state===1?2:1})}]:[])]) {
      put('UserAdventureStage',rows.map(row=>row.adventureStageId===before.adventureStageId?{...row,...changes}:row));
      const retained=snapshot(),refused=await send('user_data/confirm');assert.equal(refused.status,503);
      assert.equal(JSON.parse(refused.body).code,OFFLINE_UNAVAILABLE_CODE);assert.equal(snapshot(),retained);
      app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserAdventureStage'").run(profile.data,profile.token);
    }
    if(!changed) {
      app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(JSON.stringify([...observed,'score']),operation.id);
      const retained=snapshot();assert.equal((await send('user_data/confirm')).status,503);assert.equal(snapshot(),retained);
      app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(JSON.stringify(observed),operation.id);
    }
    const source=app.store.db.prepare('SELECT score FROM pve_clear WHERE operation_id=?').get(operation.id);
    app.store.db.prepare('UPDATE pve_clear SET score=? WHERE operation_id=?').run(source.score+1,operation.id);
    const unavailable=snapshot();assert.equal((await send('user_data/confirm')).status,503);assert.equal(snapshot(),unavailable);
    app.store.db.prepare('UPDATE pve_clear SET score=? WHERE operation_id=?').run(source.score,operation.id);
    const retained=snapshot();assert.deepEqual(app.store.stageColdRecovery(operation),operation);assert.equal(snapshot(),retained);
    assert.deepEqual(parse(await request(port,oldIdentity,undefined,String(oldIdentity),'user_data/confirm')).operations,[operation]);
    const cold=await send('user_data/confirm'),identity=sequence;assert.deepEqual(parse(cold).operations,[operation]);
    parse(await send('user/login'));assert.equal((await send('user_data/pull',{tables:['UserAdventureStage']})).status,200);
    assert.equal(app.store.hardCurrency(),iris,'Replaying the score delivery does not re-credit server Iris');
    assert.deepEqual(app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===before.adventureStageId),prefix);
    const missing=snapshot();assert.equal((await push({},[operation])).status,400);assert.equal(snapshot(),missing);
    await close();await open();
    assert.deepEqual((await request(port,identity,undefined,String(identity),'user_data/confirm')).body,cold.body);
    const bad=JSON.parse(cold.body);bad.operations[0].parameters.finalScore++;
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(Buffer.from(JSON.stringify(bad)).toString('base64'),`${identity}/${identity}`);
    const poisoned=snapshot();assert.equal((await request(port,identity,undefined,String(identity),'user_data/confirm')).status,503);assert.equal(snapshot(),poisoned);
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(cold.body.toString('base64'),`${identity}/${identity}`);
    assert.deepEqual(app.store.operations(),[operation]);
    assert.equal(app.store.db.prepare('SELECT operation_json FROM stage_delivery WHERE operation_id=?').get(operation.id).operation_json,JSON.stringify(operation));
  };
  try {
    assert.equal(Object.keys(master.pveScores).length, 36);
    assert.deepEqual(master.pveScoreBase, { id: 686000001, selector: 1, s: 420, a: 340, b: 240, c: 0 });
    let cacheCovered=false;
    for (const [key, original] of Object.entries(master.pveScores)) {
      const id = Number(key); await fresh(`score-${id}`); put('UserAdventureStage', [stageRow(id)]);
      assert.deepEqual(parse(await history(id)), { code: 0 });
      const body = { ...battle(id, `score-${id}`), isEnemyAnnihilated: false },
        reply = await complete(body), identity = sequence, response = parse(reply), operation = response.operation;
      assert.equal(operation.type, 16000); assert.equal(operation.parameters.finalScore, 500 * original.multiplier);
      assert.deepEqual(operation.parameters.rewardRanks, ['c','b','a','s']);
      const issued = snapshot();
      assert.equal((await complete({ ...body, isEnemyAnnihilated: true })).status, 400);
      assert.equal(snapshot(), issued, 'Changing the captured outcome cannot reissue a pending score result');
      assert.deepEqual(parse(await complete(body)).operation, operation);
      assert.equal(operation.parameters.isWin, undefined, 'Do not invent an ordinary victory flag');
      for (const rank of ['c','b','a','s']) assert.equal(original.rewards[rank].threshold,
        Math.trunc(Math.fround(Math.fround(master.pveScoreBase[rank]) * original.multiplier)));
      const rankItem = original.rewards.s.rewardType === 0 ? master.items[original.rewards.s.rewardKey] : null;
      assert(!rankItem || !operation.parameters.gainedItems.some(row => row.itemId === rankItem), 'Native rank items cannot also be gainedItems');
      const iris = Object.values(original.rewards).filter(row => row.rewardType === 1).reduce((n, row) => n + row.rewardAmount, 0);
      const first = master.stages[id]; assert.equal(app.store.hardCurrency(), iris + (first.rewardKey === 'currency.gem' ? first.rewardAmount : 0));
      assert.equal(app.store.read('UserAdventureStage').data[0].state, 1, 'No pre-crediting the native clear');
      assert.deepEqual(parse(await history(id, true)), { code: 0 }, 'Unsettled battle is not published');
      const before = snapshot(); assert.equal((await push({}, [operation])).status, 400); assert.equal(snapshot(), before);
      if (app.store.db.prepare('SELECT 1 FROM pve_item_claim WHERE operation_id=?').get(operation.id)) {
        assert.equal((await push({ UserAdventureStage: [cleared(operation)] }, [operation])).status, 400, 'Flags/scores cannot discard inventory');
        assert.equal(snapshot(), before);
      }
      await recoverScore(operation);
      const pendingHistory=await history(id),pendingHistoryIdentity=sequence;
      assert.deepEqual(parse(pendingHistory),{code:0},'Unacknowledged PVE result is not published');
      parse(await settle(operation));
      if(!cacheCovered) assert.equal((await request(port,pendingHistoryIdentity,{adventureStageId:id},
        String(pendingHistoryIdentity),'pve/recent/clear/get')).status,503,
      'Cached empty PVE history cannot hide a settled result');
      const recentReply=await history(id),bestReply=await history(id,true),
        recent=parse(recentReply)[seed.userId],best=parse(bestReply)[seed.userId];
      assert.deepEqual(recent.pveParty, body.userPveParty); assert.equal(recent.score, operation.parameters.finalScore);
      assert.equal(recent.rank, undefined); assert.equal(best.rank, 1); assert.equal(best.score, recent.score);
      const savedClear = app.store.db.prepare('SELECT stage_id,player,scoring_policy,clear_count FROM pve_clear WHERE operation_id=?').get(operation.id);
      for (const change of [{ player: '{broken' }, { stage_id: id + 1 },
        { player: JSON.stringify({ ...recent, pcId: pcIds[2] }) },
        { scoring_policy: 'unknown' }, { clear_count: savedClear.clear_count + 1 }]) {
        const field = Object.keys(change)[0], value = change[field];
        app.store.db.prepare(`UPDATE pve_clear SET ${field}=? WHERE operation_id=?`).run(value, operation.id);
        const damaged = snapshot();
        assert.equal((await history(id)).status, 503, 'Corrupt settled PVE history must not reach the native player parser');
        assert.equal(snapshot(), damaged, 'Rejected history cannot rewrite saved battle data');
        app.store.db.prepare(`UPDATE pve_clear SET ${field}=? WHERE operation_id=?`).run(savedClear[field], operation.id);
      }
      const delivery = app.store.db.prepare('SELECT operation_json FROM stage_delivery WHERE operation_id=?').get(operation.id);
      app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run('{}', operation.id);
      const wrongOperation = snapshot();
      assert.equal((await history(id, true)).status, 503, 'Ranking cannot publish an altered settled operation');
      assert.equal(snapshot(), wrongOperation);
      app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run(delivery.operation_json, operation.id);
      app.store.db.prepare('UPDATE stage_completion SET operation_id=? WHERE operation_id=?').run(operation.id + 999, operation.id);
      const wrongCompletion = snapshot();
      assert.equal((await history(id)).status, 503, 'Recent history requires its original stage completion receipt');
      assert.equal(snapshot(), wrongCompletion);
      app.store.db.prepare('UPDATE stage_completion SET operation_id=? WHERE operation_id=?').run(operation.id, operation.id + 999);
      app.store.db.prepare('UPDATE pve_record SET recent_operation_id=? WHERE stage_id=?').run(operation.id + 999, id);
      const dangling = snapshot();
      assert.equal((await history(id)).status, 503, 'A missing settled result is not an empty ranking');
      assert.equal(snapshot(), dangling);
      app.store.db.prepare('UPDATE pve_record SET recent_operation_id=? WHERE stage_id=?').run(operation.id, id);
      app.store.db.prepare('UPDATE pve_record SET best_operation_id=? WHERE stage_id=?').run(operation.id + 999, id);
      const danglingBest = snapshot();
      assert.equal((await history(id, true)).status, 503, 'Best-score history also requires a settled result');
      assert.equal(snapshot(), danglingBest);
      app.store.db.prepare('UPDATE pve_record SET best_operation_id=? WHERE stage_id=?').run(operation.id, id);
      await close(); await open();
      assert.deepEqual(parse(await history(id))[seed.userId], recent);
      assert.equal((await request(port, identity, body, String(identity), 'pve/stage/complete')).status, 503,
        'A completed additive stage operation cannot be replayed from HTTP cache');
      const lowerBody = battle(id, `lower-${id}`, { ...perfect, clearTurn: 5, actionCount: 20, frontPCs: 4, totalDamage: 100, maxDamage: 20 }, party(pcIds[1], 30));
      const lower = parse(await complete(lowerBody)).operation;
      assert.equal(lower.parameters.finalScore, 340 * original.multiplier); assert.deepEqual(lower.parameters.rewardRanks, []);
      assert.deepEqual(lower.parameters.gainedItems, []);await recoverScore(lower);
      const recentBeforeLower=await history(id),recentBeforeLowerIdentity=sequence,
        bestBeforeLower=await history(id,true),bestBeforeLowerIdentity=sequence;
      assert.deepEqual(parse(recentBeforeLower)[seed.userId],recent);
      assert.deepEqual(parse(bestBeforeLower)[seed.userId],best);
      parse(await settle(lower));
      assert.deepEqual(parse(await history(id))[seed.userId].pveParty, lowerBody.userPveParty);
      assert.deepEqual(parse(await history(id, true))[seed.userId].pveParty, body.userPveParty, 'Lower repeat cannot replace the best historical party');
      if(!cacheCovered) {
        assert.equal((await request(port,recentBeforeLowerIdentity,{adventureStageId:id},String(recentBeforeLowerIdentity),
          'pve/recent/clear/get')).status,503,'Cached recent PVE history cannot hide a later settled party');
        assert.deepEqual((await request(port,bestBeforeLowerIdentity,{adventureStageId:id},String(bestBeforeLowerIdentity),
          'pve/score/ranking/get')).body,bestBeforeLower.body,'Unchanged best PVE history remains byte-identical');
        cacheCovered=true;
      }
      const settled = snapshot();
      assert.equal((await push({ UserAdventureStage: [{ ...cleared(lower), highScore: 0 }] })).status, 400);
      assert.equal((await push({}, [], { UserAdventureStage: [{ adventureStageId: id }] })).status, 400);
      assert.equal(snapshot(), settled);
      app.store.db.exec('DELETE FROM reply_cache'); await close(); await open();
      const historical = snapshot(); assert.equal((await complete(body)).status, 503); assert.equal(snapshot(), historical);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM pve_rank_claim WHERE stage_id=?').get(id).n, 4);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM pve_clear WHERE stage_id=?').get(id).n, 2);
    }
    // Earn ranks progressively, rather than reminting all prizes on each clear.
    const progressId = 1120000904103; await fresh('rank-progression'); put('UserAdventureStage', [stageRow(progressId)]);
    const progress = [
      [{ totalDamage: 0, maxDamage: 0, clearTurn: 0, actionCount: 0, frontPCs: 0, memberPCs: 1, deathCount: 1 }, ['c'], false],
      [{ ...perfect, clearTurn: 5, actionCount: 20, frontPCs: 4, maxDamage: 20 }, ['b','a']],
      [perfect, ['s']],
    ];
    for (const [stats, expected, isEnemyAnnihilated = true] of progress) {
      const operation = parse(await complete({ ...battle(progressId, `rank-${expected.join('')}`, stats), isEnemyAnnihilated })).operation;
      assert.deepEqual(operation.parameters.rewardRanks, expected); parse(await settle(operation));
    }
    // A recorded PVE reward and a mission reward must reserve different native
    // acquisitions in both issue orders, even when their flags save separately.
    const itemId = master.items['status_board_item.special'];
    const [missionId, mission] = Object.entries(master.achievements).find(([, row]) =>
      row.rewardKey === 'status_board_item.special' && row.rewardType === 4 && row.category === 2 && !row.expireAt);
    for (const first of ['pve','mission']) {
      await fresh(`shared-${first}`); put('UserAdventureStage', [stageRow(progressId)]);
      const claim = { userId: seed.userId, achievementId: Number(missionId), state: 3,
        completedAt: mission.startAt || 1790866800, lastResetAt: 0, progressParam: 1, readState: 1, signature: 0 };
      put('UserAchievement', [claim]);
      let pve, achievement;
      const issuePve = async () => { pve = parse(await complete(battle(progressId, `shared-${first}`))).operation; };
      const issueMission = async () => { achievement = parse(await send('achievement/complete', {
        achievementIds: [{ achievementId: claim.achievementId, completedAt: claim.completedAt }],
      })).operations[0]; };
      // Set the event clock to an authored mission window without inventing
      // daily eligibility. This fixture explicitly seeds a claimable mission.
      const selected = mission.startAt || 1790866800;
      app.store.db.prepare('INSERT INTO event_clock(id,selected_epoch,anchor_real_epoch,high_water) VALUES(1,?,?,?)')
        .run(selected, 1790866800, selected); await close(); await open();
      if (first === 'pve') { await issuePve(); await issueMission(); } else { await issueMission(); await issuePve(); }
      const pveTarget = app.store.db.prepare('SELECT cumulative_amount FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(pve.id, itemId);
      const missionTarget = app.store.db.prepare('SELECT cumulative_amount FROM achievement_item_claim WHERE operation_id=? AND item_id=?').get(achievement.id, itemId);
      assert.equal(Math.abs(pveTarget.cumulative_amount - missionTarget.cumulative_amount),
        first === 'pve' ? mission.rewardAmount : master.pveScores[progressId].rewards.s.rewardAmount);
      const earlier = Math.min(pveTarget.cumulative_amount, missionTarget.cumulative_amount);
      parse(await push({ UserAdventureStage: [cleared(pve)], UserAchievement: [{ ...claim, state: 4 }],
        ...acquired(pve), UserStatusBoardItem: [{ userId: seed.userId, statusBoardItemId: itemId, amount: 0, cumulativeAmount: earlier,
          reservedAmount: 0, bookEntryState: 3, signature: 0 }] }));
      const later = first === 'pve' ? achievement : pve;
      const before = snapshot(); assert.equal((await push({}, [later])).status, 400); assert.equal(snapshot(), before);
      parse(await push({ UserStatusBoardItem: [{ userId: seed.userId, statusBoardItemId: itemId, amount: 0,
        cumulativeAmount: Math.max(pveTarget.cumulative_amount, missionTarget.cumulative_amount), reservedAmount: 0, bookEntryState: 3, signature: 0 }] }, [pve, achievement]));
      await close(); await open(); assert.equal(app.store.operations().length, 0);
      const saved = snapshot(); assert.equal((await push({ UserStatusBoardItem: [{ userId: seed.userId,
        statusBoardItemId: itemId, amount: 0, cumulativeAmount: earlier, reservedAmount: 0, bookEntryState: 3, signature: 0 }] })).status, 400); assert.equal(snapshot(), saved);
    }
    // Every authored earlier mode12 stage, without fabricated score/rank data.
    const unscored = Object.entries(master.stages).filter(([id, row]) => row.adventureType === 12 && !master.pveScores[id]);
    assert.equal(unscored.length, 186);
    await fresh('unscored');
    for (const [key] of unscored) {
      const id = Number(key); put('UserAdventureStage', [...app.store.read('UserAdventureStage').data.filter(row => row.adventureStageId !== id), stageRow(id)]);
      const operation = parse(await complete({ ...battle(id, `unscored-${id}`), isEnemyAnnihilated: false })).operation;
      assert.equal(operation.type, 16000); assert.equal(operation.parameters.finalScore, 0);
      assert.deepEqual(operation.parameters.rewardRanks, []); await recoverScore(operation);parse(await settle(operation));
    }
    // Synthetic imported history covers lowering currentScore to0 without erasing a retained higher value.
    const unscoredId=Number(unscored[0][0]);await fresh('unscored-positive-score-history');
    put('UserAdventureStage',[{...stageRow(unscoredId),state:4,cumulativeClearCount:2,currentScore:7,highScore:17,
      firstCompleteDateTime:1790866600,lastCompleteDateTime:1790866700}]);
    const zero=parse(await complete({...battle(unscoredId,'unscored-positive-score-history'),isEnemyAnnihilated:false})).operation;
    assert.equal(zero.parameters.finalScore,0);assert.deepEqual(zero.parameters.rewardRanks,[]);
    await recoverScore(zero);parse(await settle(zero));
    const retainedZero=app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===unscoredId);
    assert.equal(retainedZero.currentScore,0);assert.equal(retainedZero.highScore,17);assert.equal(retainedZero.cumulativeClearCount,3);
    assert.equal(retainedZero.firstCompleteDateTime,1790866600);
    const id = 1120000901101; await fresh('negative'); put('UserAdventureStage', [stageRow(id)]);
    const body = { ...battle(id, 'negative'), isEnemyAnnihilated: false };
    put('UserAdventureStage', [{ ...stageRow(id), state: 0 }]);
    let before = snapshot(); assert.equal((await complete(body)).status, 400); assert.equal(snapshot(), before);
    put('UserAdventureStage', [stageRow(id)]);
    for (const bad of [{ ...body, userPVEScore: { ...perfect, totalDamage: -1 } },
      { ...body, isEnemyAnnihilated: 0 }, { ...body, isEnemyAnnihilated: 'false' },
      { ...body, isEnemyAnnihilated: null }, { ...body, isEnemyAnnihilated: undefined },
      { ...body, userPVEScore: { ...perfect, deathCount: '0' } },
      { ...body, userPVEScore: { ...perfect, maxDamage: 0x80000000 } },
      { ...body, userPVEScore: { ...perfect, extra: 0 } },
      { ...body, userPveParty: { ...party(), userId: 2 } },
      { ...body, userPveParty: { ...party(), slots: [] } },
      { ...body, userPveParty: { ...party(), slots: [party().slots[0], party().slots[0]] } },
      { ...body, userPveParty: { ...party(), slots: [{ ...party().slots[0], pc: pc(1) }] } },
      { ...body, userPveParty: { ...party(), slots: [{ ...party().slots[0], pc: { ...pc(pcIds[0]), weaponId: -1 } }] } },
      { ...body, adventureStageId: 1010000101101 }]) {
      const before = snapshot(); assert.equal((await complete(bad)).status, 400); assert.equal(snapshot(), before);
    }
    before = snapshot();
    assert.equal((await send('adventure/stage/complete', body)).status, 400); assert.equal(snapshot(), before);
    for (const table of ['operation_queue','stage_completion','stage_reward','pve_clear','pve_rank_claim','pve_item_claim','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_pve BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'PVE rollback'); END`);
      before = snapshot(); assert.equal((await complete(body)).status, 503); assert.equal(snapshot(), before);
      app.store.db.exec('DROP TRIGGER fail_pve');
    }
    const pending = parse(await complete(body)).operation;
    const unchanged = snapshot(); assert.equal((await complete({ ...body, userPVEScore: { ...perfect, clearTurn: 2 } })).status, 400); assert.equal(snapshot(), unchanged);
    assert.equal((await complete({ ...body, isEnemyAnnihilated: true })).status, 400); assert.equal(snapshot(), unchanged);
    assert.deepEqual(parse(await complete(body)).operation, pending);
    parse(await push({ UserAdventureStage: [cleared(pending)] })); await close(); await open();
    for (const changes of [{ currentScore: 0 }, { highScore: 0 }, { cumulativeClearCount: 0 }, { userId: 2 }]) {
      // Canonical saved score/clear can reconcile an old stage delta, but the
      // inventory must still arrive before ACK; no false positive is possible.
      before = snapshot(); assert.equal((await push({ UserAdventureStage: [{ ...cleared(pending), ...changes }] }, [pending])).status, 400); assert.equal(snapshot(), before);
    }
    parse(await push(acquired(pending))); await close(); await open();
    const savedReceipt = app.store.db.prepare('SELECT * FROM pve_clear WHERE operation_id=?').get(pending.id);
    app.store.db.prepare('DELETE FROM pve_clear WHERE operation_id=?').run(pending.id);
    before = snapshot();
    const legacy = await push({}, [pending]); assert.equal(legacy.status, 503);
    assert.equal(JSON.parse(legacy.body).code, OFFLINE_UNAVAILABLE_CODE); assert.equal(snapshot(), before);
    app.store.db.prepare('INSERT INTO pve_clear(operation_id,stage_id,score,scoring_policy,battle_stats,player,clear_count,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(savedReceipt.operation_id, savedReceipt.stage_id, savedReceipt.score, savedReceipt.scoring_policy,
        savedReceipt.battle_stats, savedReceipt.player, savedReceipt.clear_count, savedReceipt.created_at);
    for (const table of ['pve_record','operation_done','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_pve_ack BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'PVE ACK rollback'); END`);
      before = snapshot(); assert.equal((await push({}, [pending])).status, 503); assert.equal(snapshot(), before);
      app.store.db.exec('DROP TRIGGER fail_pve_ack');
    }
    parse(await push({ UserAdventureStage: pending.parameters.UserAdventureStage }, [pending]));
    assert.equal(app.store.operations().length, 0); assert.equal(parse(await history(id, true))[seed.userId].score, pending.parameters.finalScore);
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    console.log('PVE offline policy: non-annihilated results, 36 rank tables, 186 unscored stages, historical parties, save/ACK, once-only rewards and rollback OK');
  } finally { await close(); fs.rmSync(directory, { recursive: true, force: true }); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
