'use strict';

// Deferred synthetic wire/save probes. NOT native acceptance, natural unlocks,
// publisher arithmetic or lost online ranking/party history.
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
const entries = Object.entries(master.pvbStages), [firstKey, first] = entries[0], event = master.pvbEvents[first.pvbId];
const stats = { totalDamage: 1000, turnCount: 15 };
const scoreRules=Object.entries(master.pvbAchievementRules),
  [scoreThresholdId,scoreThresholdRule]=scoreRules.filter(([,row])=>row.conditionType===1201)
    .sort((a,b)=>a[1].scoreThreshold-b[1].scoreThreshold).find(([,row])=>
      scoreRules.some(([,other])=>other.conditionType===1202 && other.selector===row.selector) &&
      Object.values(master.pvbEvents).some(eventRow=>eventRow.key===row.selector)),
  [scoreEventId,scoreEvent]=Object.entries(master.pvbEvents).find(([,row])=>row.key===scoreThresholdRule.selector),
  [scoreStageKey,scoreStage]=entries.find(([,row])=>row.pvbId===Number(scoreEventId)),
  [scoreCumulativeId]=scoreRules.find(([,row])=>row.conditionType===1202 && row.selector===scoreEvent.key),
  [scoreGlobalId]=scoreRules.find(([,row])=>row.conditionType===1203),
  [scoreOtherId]=scoreRules.find(([,row])=>row.conditionType===1202 && row.selector!==scoreEvent.key),
  scoreStats={totalDamage:Math.ceil(scoreThresholdRule.scoreThreshold*1000/(2*scoreStage.slot5))+1,turnCount:15};
const tasks = id => Object.entries(master.stageTasks).filter(([, task]) => task.stageId === id).map(([id]) => Number(id));
const stageRow = id => ({ userId: seed.userId, adventureStageId: id, signature: 0, state: 1,
  cumulativeClearCount: 0, dailyClearCount: 0, currentScore: 0, highScore: 0, firstCompleteDateTime: 0, lastCompleteDateTime: 0,
  firstTryDateTime: 0, lastTryDateTime: 0, ticketClosedAt: 0, ticketOpenedAt: 0, usedTicketId: 0, token: '',
  tasks: tasks(id).map(adventureStageTaskId => ({ adventureStageTaskId, state: 0 })) });
const battle = (pvbStageId, token, score = stats) => ({ pvbStageId, adventureStageId: master.pvbStages[pvbStageId].adventureStageId,
  token, userPvBScore: score, adventureStageTaskIds: [], adventureGainedItems: [], friendshipStates: [],
  adventureRecord: { continueCount: 0 }, isEnemyAnnihilated: false, secretMissionCompleted: false });
const scoreAchievementRows=()=>[scoreThresholdId,scoreCumulativeId,scoreGlobalId,scoreOtherId].map(id=>({userId:seed.userId,
  achievementId:Number(id),completedAt:0,lastResetAt:0,progressParam:0,readState:0,signature:0,state:0}));
const scoreAchievementAfter=(rows,score)=>rows.map(row=>{
  const rule=master.pvbAchievementRules[row.achievementId],matches=rule.selector===scoreEvent.key;
  return {...row,progressParam:rule.conditionType===1201 && matches && score>=rule.scoreThreshold ? rule.requiredParam :
    (rule.conditionType===1202 && matches || rule.conditionType===1203) ?
      Math.min(0x7fffffff,row.progressParam+score) : row.progressParam};
});

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-pvb-'));
  let database, app, port, sequence = 0, now = event.window6;
  const open = async () => {
    app = createServer({ database, seed, master, wallNowSeconds: () => now, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const fresh = async name => { await close(); database = path.join(directory, `${name}.sqlite`); await open(); };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows), md5(rows), name);
  const send = (action, body) => request(port, ++sequence, body, String(sequence), action);
  const complete = body => send('pvb/stage/complete', body);
  const parse = reply => { assert.equal(reply.status, 200, reply.body.toString()); return JSON.parse(reply.body); };
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name, app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all()]));
  const push = (putItems = {}, operations = [], deleteItems = {}) => send('user_data/push', {
    badges: null, scripts: {}, dataTokens: {}, checksums: { before: {}, after: Object.fromEntries(
      [...new Set([...Object.keys(putItems), ...Object.keys(deleteItems)])].map(name => [name, md5(putItems[name] ?? [])])) },
    deltas: Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature: 0, trigger: 'PvbComplete', putItems, deleteItems }] : [],
    operations: operations.map(operation => ({ id: operation.id, verifier: operation.token })),
  });
  const cleared = operation => {
    const receipt = app.store.db.prepare('SELECT * FROM pvb_clear WHERE operation_id=?').get(operation.id), row = JSON.parse(receipt.stage_before_json);
    const completed = JSON.parse(receipt.task_ids);
    return { ...row, state: 4, cumulativeClearCount: row.cumulativeClearCount + 1,
      firstCompleteDateTime: row.firstCompleteDateTime || now, lastCompleteDateTime: now,
      tasks: row.tasks.map(task => completed.includes(task.adventureStageTaskId) ? { ...task, state: 1 } : task) };
  };
  const settle = operation => push({ UserAdventureStage: [cleared(operation)], UserPvBRecord: [operation.parameters.userPvbRecord] }, [operation]);
  try {
    await fresh('all-original-stages'); put('UserAdventureStage', entries.map(([, row]) => stageRow(row.adventureStageId)));
    assert.equal(entries.length, 942);
    for (const [key, original] of entries) {
      now = master.pvbEvents[original.pvbId].window6;
      const body = battle(Number(key), `original-${key}`), reply = await complete(body), identity = sequence, operation = parse(reply).operation;
      assert.equal(operation.type, 19000); assert.deepEqual(Object.keys(operation.parameters).sort(), ['pvbResult','userPvbRecord']);
      const result = operation.parameters.pvbResult, record = operation.parameters.userPvbRecord;
      assert.equal(result.adventureStageId, original.adventureStageId); assert.equal(result.isRecorded, true);
      assert.equal(result.totalDamage, 1000); assert.equal(result.baseScore, 1000); assert.equal(result.maxTurn, 15);
      assert.equal(result.turnBonusRate, 10000); assert.equal(result.turnBonusScore, 1000);
      assert.equal(result.provisionalTotalScore, 2000); assert.equal(result.difficultyBonusRate, original.slot5);
      assert.equal(result.finalScore, 2 * original.slot5); assert.equal(result.difficulty, original.difficulty);
      const player = JSON.parse(app.store.db.prepare('SELECT player_json FROM pvb_player_capture WHERE operation_id=?').get(operation.id).player_json);
      const grade = Object.entries(master.pvbGrades).find(([,row]) => row.pvbId === original.pvbId && row.slot3 <= 1 && (!row.slot4 || row.slot4 >= 1));
      assert.deepEqual(result.aroundPlayerInfo, [{ name:player.name,pcId:player.pcId,gradeId:Number(grade[0]),
        rank:1,score:record.scoreInt64,difficulty:master.pvbStages[record.pvbStageId].difficulty }]);
      assert.equal(record.totalRank, 1); assert.equal(record.groupRank, 1);
      assert(record.scoreInt64 >= result.finalScore); assert.equal(record.pvbId, original.pvbId);
      const owned = app.store.read('UserPvBRecord').data.find(row => row.pvbId === original.pvbId);
      assert(!owned || owned.scoreInt64 <= record.scoreInt64, 'No pre-credit of the new high score');
      assert.equal(app.store.read('UserAdventureStage').data.find(row => row.adventureStageId === original.adventureStageId).state, 1);
      parse(await settle(operation));
      assert.equal(app.store.read('UserPvBRecord').data.filter(row => row.pvbId === original.pvbId).length, 1, 'Difficulty changes retain one event record');
      assert.equal(app.store.db.prepare('SELECT scoring_policy FROM pvb_clear WHERE operation_id=?').get(operation.id).scoring_policy, 'offline-pvb-v1');
      if (key === firstKey) {
        await close(); await open();
        assert.equal((await request(port, identity, body, String(identity), 'pvb/stage/complete')).status, 503);
      }
    }
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM pvb_record').get().n, 152);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM pvb_stage_record').get().n, 942);
    assert.equal(app.store.hardCurrency(), 0, 'No automatic leaderboard or absent first-clear item prizes');

    // WRITTEN ONLY: all three original score listeners can precede the PvB record and clear.
    now=scoreEvent.window6;await fresh('score-event-retry');put('UserAdventureStage',[stageRow(scoreStage.adventureStageId)]);
    put('UserAchievement',scoreAchievementRows());
    const scoreBody=battle(Number(scoreStageKey),'score-event-retry',scoreStats),scoreOperation=parse(await complete(scoreBody)).operation,
      scoreReceipt=app.store.db.prepare(`SELECT achievement_before_digest,achievement_before_json,achievement_after_digest
        FROM pvb_clear WHERE operation_id=?`).get(scoreOperation.id);
    assert(scoreOperation.parameters.pvbResult.finalScore>=scoreThresholdRule.scoreThreshold);
    assert.match(scoreReceipt.achievement_before_digest,/^[a-f0-9]{64}$/);
    assert.equal(scoreReceipt.achievement_after_digest,null);
    await close(); await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,[scoreOperation]);
    const achievementBefore=app.store.read('UserAchievement').data,
      advanced=scoreAchievementAfter(achievementBefore,scoreOperation.parameters.pvbResult.finalScore),
      invalidAdvanced=advanced.map((row,index)=>index?row:{...row,state:1}),invalidScoreEvent=snapshot();
    assert.equal((await push({UserAchievement:invalidAdvanced})).status,503,
      'A PvB score event cannot smuggle a non-progress achievement change');
    assert.equal(snapshot(),invalidScoreEvent);
    const partialAdvanced=advanced.map((row,index)=>index===1?achievementBefore[index]:row);
    assert.equal((await push({UserAchievement:partialAdvanced})).status,503,
      'Skipping one applicable listener cannot suppress the whole native score event');
    assert.equal(snapshot(),invalidScoreEvent);
    const wrongEventAdvanced=advanced.map(row=>row.achievementId===Number(scoreOtherId)?
      {...row,progressParam:scoreOperation.parameters.pvbResult.finalScore}:row);
    assert.equal((await push({UserAchievement:wrongEventAdvanced})).status,503,
      'A PvB score event cannot advance another event key');
    assert.equal(snapshot(),invalidScoreEvent);
    assert.deepEqual(parse(await push({UserAchievement:advanced})).operations,[],
      'Save the native event progress but suppress another PvB result in the reply');
    assert.deepEqual(app.store.read('UserAchievement').data,advanced);
    const achievementAfter=app.store.read('UserAchievement').data,
      scoreAfter=app.store.db.prepare('SELECT achievement_after_digest FROM pvb_clear WHERE operation_id=?').get(scoreOperation.id);
    assert.match(scoreAfter.achievement_after_digest,/^[a-f0-9]{64}$/);
    await close(); await open();
    const recoveredScore={...scoreOperation,parameters:{...scoreOperation.parameters,offlinePvbScoreEventApplied:1}};
    assert.deepEqual(parse(await send('user_data/confirm')).operations,[recoveredScore]);
    assert.deepEqual(parse(await complete(scoreBody)).operation,recoveredScore);
    assert.equal((await send('user_data/pull',{tables:['UserAchievement']})).status,200);
    assert.deepEqual(app.store.read('UserAchievement').data,achievementAfter,
      'Recovery must not mutate or redeliver the independently saved score event');
    assert.equal(app.store.db.prepare('SELECT achievement_after_digest FROM pvb_clear WHERE operation_id=?')
      .get(scoreOperation.id).achievement_after_digest,scoreAfter.achievement_after_digest);
    put('UserAchievement',[...achievementAfter].reverse());
    assert.deepEqual(parse(await send('user_data/confirm')).operations,[recoveredScore],
      'Reordered but identical saved achievement rows keep the score event suppressed');
    put('UserAchievement',achievementBefore);
    const rewoundScore=snapshot();assert.equal((await send('user_data/confirm')).status,503);
    assert.equal(snapshot(),rewoundScore,'A captured PvB score event cannot be rewound to its original achievement baseline');
    put('UserAchievement',achievementAfter);
    app.store.db.prepare(`UPDATE pvb_clear SET achievement_before_json=NULL,achievement_after_digest=NULL
      WHERE operation_id=?`).run(scoreOperation.id);
    const legacyScore=snapshot();assert.equal((await send('user_data/confirm')).status,503);
    assert.equal(snapshot(),legacyScore,'Older PvB captures cannot invent an already-saved event transition');
    app.store.db.prepare(`UPDATE pvb_clear SET achievement_before_json=?,achievement_after_digest=? WHERE operation_id=?`)
      .run(scoreReceipt.achievement_before_json,scoreAfter.achievement_after_digest,scoreOperation.id);
    assert.deepEqual(parse(await send('user_data/confirm')).operations,[recoveredScore]);
    parse(await settle(scoreOperation));

    now=scoreEvent.window6;await fresh('record-only-cold');put('UserAdventureStage',[stageRow(scoreStage.adventureStageId)]);
    put('UserAchievement',scoreAchievementRows());
    const recordOnly=parse(await complete(battle(Number(scoreStageKey),'record-only-cold',scoreStats))).operation,
      recordDigest=app.store.db.prepare('SELECT achievement_before_digest FROM pvb_clear WHERE operation_id=?').get(recordOnly.id).achievement_before_digest;
    assert.deepEqual(parse(await push({UserPvBRecord:[recordOnly.parameters.userPvbRecord]})).operations,[],
      'A saved native record suppresses the result until its remaining effects are proved');
    await close(); await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,[recordOnly],
      'Exact record-only save can re-enter with the original untouched stage and event progress');
    assert.equal((await push({},[recordOnly])).status,400,'Record alone cannot ACK the original stage clear');
    app.store.db.prepare('UPDATE pvb_clear SET achievement_before_digest=NULL WHERE operation_id=?').run(recordOnly.id);
    const unknownRecord=snapshot();assert.equal((await send('user_data/confirm')).status,503);
    assert.equal(snapshot(),unknownRecord,'Legacy record-only capture cannot infer event progress');
    app.store.db.prepare('UPDATE pvb_clear SET achievement_before_digest=? WHERE operation_id=?').run(recordDigest,recordOnly.id);
    const untouchedStage=app.store.read('UserAdventureStage').data;
    put('UserAdventureStage',[{...untouchedStage[0],token:'unattributed-stage-save'}]);
    const changedStage=snapshot();assert.equal((await send('user_data/confirm')).status,503);
    assert.equal(snapshot(),changedStage,'Record-only retry cannot adopt an unexplained stage change');
    put('UserAdventureStage',untouchedStage);
    const recordAchievementBefore=app.store.read('UserAchievement').data,
      changedRecordAchievements=scoreAchievementAfter(recordAchievementBefore,recordOnly.parameters.pvbResult.finalScore);
    assert.deepEqual(parse(await push({UserAchievement:changedRecordAchievements})).operations,[]);
    const recoveredRecord={...recordOnly,parameters:{...recordOnly.parameters,offlinePvbScoreEventApplied:1}};
    await close();await open();assert.deepEqual(parse(await send('user_data/confirm')).operations,[recoveredRecord]);
    assert.deepEqual(app.store.read('UserAchievement').data,changedRecordAchievements,
      'A saved score event can safely follow the exact native record without replaying either effect');
    put('UserAchievement',recordAchievementBefore);
    assert.equal((await send('user_data/confirm')).status,503,'An observed score event cannot later be rewound');
    put('UserAchievement',changedRecordAchievements);
    assert.deepEqual(parse(await send('user_data/confirm')).operations,[recoveredRecord]);
    parse(await push({UserAdventureStage:[cleared(recordOnly)]},[recordOnly]));
    assert.equal(app.store.operations().length,0);

    // WRITTEN ONLY: state4 alone is repeatable; an already-added count is not.
    for(const savedRecord of [false,true]) {
      now=event.window6;await fresh(`state-only-${savedRecord}`);put('UserAdventureStage',[stageRow(first.adventureStageId)]);
      const stateOnly=parse(await complete(battle(Number(firstKey),`state-only-${savedRecord}`))).operation,
        nativeStage=app.store.read('UserAdventureStage').data[0];
      assert.deepEqual(parse(await push({UserAdventureStage:[{...nativeStage,state:4}],
        ...(savedRecord?{UserPvBRecord:[stateOnly.parameters.userPvbRecord]}:{})})).operations,[]);
      await close();await open();
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[stateOnly],
        'An exact saved state4 with untouched counters can re-enter the original clear');
      assert.equal((await push({},[stateOnly])).status,400,'State4 is not a full-clear ACK');
      parse(await push({UserAdventureStage:[cleared(stateOnly)],
        ...(!savedRecord?{UserPvBRecord:[stateOnly.parameters.userPvbRecord]}:{})},[stateOnly]));
      assert.equal(app.store.operations().length,0);
    }
    now=event.window6;await fresh('partial-pvb-count');put('UserAdventureStage',[stageRow(first.adventureStageId)]);
    const countBody=battle(Number(firstKey),'partial-pvb-count'),countOnly=parse(await complete(countBody)).operation,
      countBefore=app.store.read('UserAdventureStage').data[0];
    assert.deepEqual(parse(await push({UserAdventureStage:[{...countBefore,state:4,cumulativeClearCount:1}]})).operations,[],
      'A first native cumulative save is retained but never re-delivered as a second increment');
    await close();await open();const partialCount=snapshot();
    assert(JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(countOnly.id).observed)
      .includes('clearCumulative'),'The first saved count survives restart as an immutable observation');
    assert.equal((await push({UserAdventureStage:[{...countBefore,state:4}]})).status,400,
      'A later native save cannot rewind an observed cumulative clear');
    assert.equal(snapshot(),partialCount);
    const countRetry=parse(await complete(countBody)).operation;
    assert.equal(countRetry.parameters.offlineStageClearCountsApplied,2,
      'Exact PvB retry skips only the already-saved cumulative increment');
    const countConfirm=parse(await send('user_data/confirm')).operations[0];
    assert.deepEqual(countConfirm,countRetry,'Cold confirmation uses the same derived PvB remainder');
    assert.equal(snapshot(),partialCount);
    parse(await push({UserAdventureStage:[cleared(countOnly)],UserPvBRecord:[countOnly.parameters.userPvbRecord]},[countOnly]));
    assert.equal(app.store.operations().length,0);

    // WRITTEN ONLY: a repeat's cumulative and daily saves precede its new last date.
    now=event.window6+100;await fresh('repeat-pvb-count');
    const repeatBefore={...stageRow(first.adventureStageId),state:4,cumulativeClearCount:3,dailyClearCount:2,
      firstCompleteDateTime:now-80,lastCompleteDateTime:now-10};
    put('UserAdventureStage',[repeatBefore]);
    const repeat=parse(await complete(battle(Number(firstKey),'repeat-pvb-count'))).operation,
      repeatStage=app.store.read('UserAdventureStage').data[0];
    assert.deepEqual(parse(await push({UserAdventureStage:[{...repeatStage,cumulativeClearCount:4}]})).operations,[]);
    await close();await open();const repeatCount=snapshot();
    assert(JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(repeat.id).observed)
      .includes('clearCumulative'));
    assert.equal((await push({UserAdventureStage:[repeatStage]})).status,400,'Repeat count cannot rewind after restart');
    assert.equal(snapshot(),repeatCount);
    assert.deepEqual(parse(await push({UserAdventureStage:[{...repeatStage,cumulativeClearCount:4,dailyClearCount:3}]})).operations,[]);
    const repeatCounts=snapshot();
    assert.equal((await push({},[repeat])).status,400,'Count-only repeat is not a completed clear');
    assert.equal(snapshot(),repeatCounts);
    assert.equal((await push({UserAdventureStage:[{...cleared(repeat),cumulativeClearCount:5}]},[repeat])).status,400,
      'A repeat cannot acknowledge two native cumulative additions');
    assert.equal(snapshot(),repeatCounts);
    const repeatRecovery=parse(await send('user_data/confirm')).operations[0];
    assert.equal(repeatRecovery.parameters.offlineStageClearCountsApplied,1,
      'Partial repeat re-enters without either already-saved count increment');
    assert.equal(snapshot(),repeatCounts);
    parse(await push({UserAdventureStage:[{...cleared(repeat),dailyClearCount:0}],
      UserPvBRecord:[repeat.parameters.userPvbRecord]},[repeat]));
    assert.equal(app.store.operations().length,0);
    // WRITTEN ONLY: once the dated repeat clear is pinned, a later daily reset must not restore the old count.
    now=event.window6+200;await fresh('repeat-pvb-complete-daily-reset');
    const resetBefore={...stageRow(first.adventureStageId),state:4,cumulativeClearCount:3,dailyClearCount:2,
      firstCompleteDateTime:now-80,lastCompleteDateTime:now-10};
    put('UserAdventureStage',[resetBefore]);
    const resetOperation=parse(await complete(battle(Number(firstKey),'repeat-pvb-complete-daily-reset'))).operation,
      resetComplete={...resetBefore,cumulativeClearCount:4,dailyClearCount:3,lastCompleteDateTime:now};
    assert.deepEqual(parse(await push({UserAdventureStage:[resetComplete]})).operations,[]);
    put('UserAdventureStage',[{...resetComplete,dailyClearCount:0}]);
    assert.throws(()=>app.store.stageColdRecovery(resetOperation),/pinned client day/);
    put('UserAdventureStage',[resetComplete]);
    now+=86400;
    assert.deepEqual(parse(await push({UserAdventureStage:[{...resetComplete,dailyClearCount:0}]})).operations,[]);
    const resetRecovery=parse(await send('user_data/confirm')).operations.find(row=>row.id===resetOperation.id);
    assert.equal(resetRecovery.parameters.offlineStageClearCountsApplied,1);
    assert.equal(resetRecovery.parameters.offlineStageLastDateApplied,1);
    parse(await push({UserPvBRecord:[resetOperation.parameters.userPvbRecord]}));
    parse(await push({},[resetOperation]));
    assert.equal(app.store.read('UserAdventureStage').data[0].dailyClearCount,0);
    assert.equal(app.store.operations().length,0);
    // WRITTEN ONLY: operation issue time distinguishes an actual same-second repeat from a bare count prefix.
    now=event.window6+100;await fresh('same-second-pvb-repeat');
    const sameBefore={...repeatBefore,firstCompleteDateTime:now-80,lastCompleteDateTime:now};
    put('UserAdventureStage',[sameBefore]);
    const same=parse(await complete(battle(Number(firstKey),'same-second-repeat'))).operation;
    assert.equal(app.store.db.prepare('SELECT issued_at FROM pvb_clear WHERE operation_id=?').get(same.id).issued_at,now);
    assert.deepEqual(parse(await push({UserAdventureStage:[{...sameBefore,cumulativeClearCount:4,dailyClearCount:3}]})).operations,[]);
    await close();await open();
    app.store.db.prepare('UPDATE pvb_clear SET issued_at=NULL WHERE operation_id=?').run(same.id);
    const sameLegacy=snapshot();
    assert.equal((await send('user_data/confirm')).status,503,'Legacy receipts cannot invent same-second provenance');
    assert.equal(snapshot(),sameLegacy);
    app.store.db.prepare('UPDATE pvb_clear SET issued_at=? WHERE operation_id=?').run(now,same.id);
    const sameRecovery=parse(await send('user_data/confirm')).operations.find(row=>row.id===same.id);
    assert.equal(sameRecovery.parameters.offlineStageClearCountsApplied,1);
    assert.equal(Object.hasOwn(sameRecovery.parameters,'offlineStageLastDateApplied'),false,
      'An equal LAST is replayed by the original callback, not claimed as a dated prefix');
    parse(await push({UserPvBRecord:[same.parameters.userPvbRecord]}));
    parse(await push({},[same]));
    assert.equal(app.store.operations().length,0);

    now = event.window6; await fresh('objective-and-split'); put('UserAdventureStage', [stageRow(first.adventureStageId)]);
    const body = { ...battle(Number(firstKey), 'objectives'), adventureStageTaskIds: tasks(first.adventureStageId) };
    const response = await complete(body), identity = sequence, operation = parse(response).operation;
    assert.equal(app.store.hardCurrency(), 3); assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_reward').get().n, 3);
    // WRITTEN ONLY: the native 19000 cannot be redelivered from altered event, score or objective captures.
    const originalReceipt = app.store.db.prepare('SELECT * FROM pvb_clear WHERE operation_id=?').get(operation.id);
    for (const [field, altered] of [['pvb_stage_id', 0], ['scoring_policy', 'forged'],
      ['final_score', originalReceipt.final_score + 1], ['is_recorded', 0], ['task_ids', '[]']]) {
      app.store.db.prepare(`UPDATE pvb_clear SET ${field}=? WHERE operation_id=?`).run(altered, operation.id);
      const retained = snapshot(); assert.equal((await send('user_data/confirm')).status, 503);
      assert.equal(snapshot(), retained, `Changed ${field} must retain the actual pending result`);
      app.store.db.prepare(`UPDATE pvb_clear SET ${field}=? WHERE operation_id=?`).run(originalReceipt[field], operation.id);
    }
    const pending = snapshot(); assert.equal((await push({}, [operation])).status, 400); assert.equal(snapshot(), pending);
    assert.equal((await push({ UserAdventureStage: [cleared(operation)] }, [operation])).status, 400); assert.equal(snapshot(), pending);
    assert.equal((await push({ UserPvBRecord: [operation.parameters.userPvbRecord] }, [operation])).status, 400); assert.equal(snapshot(), pending);
    assert.equal((await push({ UserAdventureStage: [{ ...cleared(operation), tasks: stageRow(first.adventureStageId).tasks }],
      UserPvBRecord: [operation.parameters.userPvbRecord] }, [operation])).status, 400); assert.equal(snapshot(), pending);
    parse(await push({ UserAdventureStage: [cleared(operation)] })); await close(); await open();
    now = event.window9 + 1;
    assert.equal((await complete(body)).status, 503, 'An observed clear cannot be redelivered after expiry');
    assert.equal((await request(port, identity, body, String(identity), 'pvb/stage/complete')).status, 503);
    for (const changes of [{ userId: seed.userId + 1 }, { scoreInt64: 0 }, { scoreInt64: '2000' }, { score: -1 },
      { pvbStageId: 1 }, { pvbId: 1 }, { isAggregate: 1 }, { extra: 0 }]) {
      const before = snapshot(); assert.equal((await push({ UserPvBRecord: [{ ...operation.parameters.userPvbRecord, ...changes }] }, [operation])).status, 400);
      assert.equal(snapshot(), before);
    }
    parse(await push({ UserPvBRecord: [operation.parameters.userPvbRecord] })); await close(); await open();
    for (const table of ['pvb_record','pvb_stage_record','pvb_best_capture','operation_done','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_pvb_ack BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'PvB ACK rollback'); END`);
      const before = snapshot(); assert.equal((await push({}, [operation])).status, 503); assert.equal(snapshot(), before);
      app.store.db.exec('DROP TRIGGER fail_pvb_ack');
    }
    app.store.db.exec("CREATE TRIGGER fail_pvb_delete BEFORE DELETE ON operation_queue BEGIN SELECT RAISE(ABORT,'queue rollback'); END");
    let before = snapshot(); assert.equal((await push({}, [operation])).status, 503); assert.equal(snapshot(), before);
    app.store.db.exec('DROP TRIGGER fail_pvb_delete');
    const receipt = app.store.db.prepare('SELECT * FROM pvb_clear WHERE operation_id=?').get(operation.id);
    app.store.db.prepare('DELETE FROM pvb_clear WHERE operation_id=?').run(operation.id);
    before = snapshot(); const unavailable = await push({}, [operation]);
    assert.equal(unavailable.status, 503); assert.equal(JSON.parse(unavailable.body).code, OFFLINE_UNAVAILABLE_CODE); assert.equal(snapshot(), before);
    app.store.db.prepare(`INSERT INTO pvb_clear(operation_id,stage_id,pvb_stage_id,pvb_id,scoring_policy,battle_stats,result_json,
      target_record_json,stage_before_json,task_ids,final_score,is_recorded,achievement_before_digest) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...Object.values(receipt));
    parse(await push({ UserAdventureStage: [stageRow(first.adventureStageId)] }, [operation]));
    assert.equal(app.store.operations().length, 0, 'Proven canonical clear reconciles an old stage delta');
    await close(); await open();
    const completed = snapshot();
    for (const mutation of [
      () => push({ UserPvBRecord: [{ ...operation.parameters.userPvbRecord, scoreInt64: 0 }] }),
      () => push({}, [], { UserPvBRecord: [{ pvbId: first.pvbId }] }),
      () => push({ UserAdventureStage: [stageRow(first.adventureStageId)] }),
      () => push({ UserAdventureStage: [{ ...cleared(operation), tasks: stageRow(first.adventureStageId).tasks }] }),
      () => push({}, [], { UserAdventureStage: [{ adventureStageId: first.adventureStageId }] }),
    ]) { assert.equal((await mutation()).status, 400); assert.equal(snapshot(), completed); }
    app.store.db.exec('DELETE FROM reply_cache'); await close(); await open();
    before = snapshot(); assert.equal((await complete(body)).status, 503); assert.equal(snapshot(), before);

    now = event.window6;
    const lower = parse(await complete({ ...body, token: 'lower', userPvBScore: { totalDamage: 0, turnCount: 0 } })).operation;
    assert.deepEqual(lower.parameters.pvbResult.aroundPlayerInfo, operation.parameters.pvbResult.aroundPlayerInfo);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM pvb_objective_receipt WHERE operation_id=?').get(lower.id).n, 0,
      'Previously received objectives keep their original claim owner');
    assert.deepEqual(parse(await send('user_data/confirm')).operations, [lower],
      'A legitimate repeat may name objectives already received on this stage');
    assert.deepEqual(lower.parameters.userPvbRecord, operation.parameters.userPvbRecord); parse(await settle(lower));
    assert.equal(app.store.hardCurrency(), 3, 'Original objective Iris cannot be reminted');
    now = event.window7 + 1;
    const late = parse(await complete(battle(Number(firstKey), 'late-mission', { totalDamage: 2000000000, turnCount: 15 }))).operation;
    assert.equal(late.parameters.pvbResult.isRecorded, false); assert(late.parameters.pvbResult.finalScore > operation.parameters.pvbResult.finalScore);
    assert.deepEqual(late.parameters.pvbResult.aroundPlayerInfo, operation.parameters.pvbResult.aroundPlayerInfo,
      'Practice displays the recorded best, not its new unrecorded battle score');
    assert.deepEqual(late.parameters.userPvbRecord, operation.parameters.userPvbRecord, 'Post-competition scoring preserves the recorded high score');
    parse(await settle(late));
    now = event.window9; const atEnd = parse(await complete(battle(Number(firstKey), 'at-end'))).operation; parse(await settle(atEnd));
    now++; before = snapshot(); assert.equal((await complete(battle(Number(firstKey), 'past-end'))).status, 400); assert.equal(snapshot(), before);

    now = event.window6; await fresh('zero-int64-and-bonuses'); put('UserAdventureStage', [stageRow(first.adventureStageId)]);
    const zero = parse(await complete(battle(Number(firstKey), 'zero', { totalDamage: 0, turnCount: 0 }))).operation;
    assert.deepEqual(zero.parameters.pvbResult.aroundPlayerInfo, [], 'No invented participant for a default zero record');
    assert.equal(zero.parameters.userPvbRecord.pvbStageId, 0);
    const zeroPartial = parse(await push({ UserPvBRecord:[zero.parameters.userPvbRecord] }));
    assert(!zeroPartial.operations.some(row => row.id === zero.id), 'Creating a native zero-score record is an observed effect');
    assert.deepEqual(app.store.operations(), [zero]);
    assert.equal((await complete(battle(Number(firstKey), 'zero', { totalDamage:0,turnCount:0 }))).status, 503);
    parse(await settle(zero));
    assert.equal(app.store.read('UserPvBRecord').data.length, 1, '19000 creates a real owned zero-score record');
    for (const turnCount of [0,1,4,5,6,8,9,10,12,13,14,15,16]) {
      const op = parse(await complete(battle(Number(firstKey), `turn-${turnCount}`, { totalDamage: 1000, turnCount }))).operation;
      const capped = Math.min(turnCount, 15), bonus = master.pvbSurvivalBonuses.find(row => capped >= row.slot3 && capped <= row.slot4)?.value ?? 0;
      assert.equal(op.parameters.pvbResult.turnBonusRate, bonus); parse(await settle(op));
    }
    const hard = entries.find(([, row]) => row.pvbId === first.pvbId && row.difficulty === 5);
    put('UserAdventureStage', [...app.store.read('UserAdventureStage').data,stageRow(hard[1].adventureStageId)]);
    const high = parse(await complete(battle(Number(hard[0]), 'int64', { totalDamage: 0x7fffffff, turnCount: 15 }))).operation;
    assert(high.parameters.pvbResult.finalScore > 0x7fffffff); assert.equal(high.parameters.userPvbRecord.score, 0x7fffffff);
    assert.equal(high.parameters.pvbResult.aroundPlayerInfo[0].score, high.parameters.pvbResult.finalScore);
    assert.equal(high.parameters.userPvbRecord.scoreInt64, high.parameters.pvbResult.finalScore); parse(await settle(high));
    assert.equal(app.store.read('UserPvBRecord').data.length, 1, 'High score changing difficulty must not append another event record');

    now = event.window6; await fresh('legacy-best-without-player'); put('UserAdventureStage', [stageRow(first.adventureStageId)]);
    put('UserPvBRecord',[operation.parameters.userPvbRecord]);
    const legacy = parse(await complete(battle(Number(firstKey),'legacy-lower',{totalDamage:0,turnCount:0}))).operation;
    assert.deepEqual(legacy.parameters.userPvbRecord,operation.parameters.userPvbRecord);
    assert.deepEqual(legacy.parameters.pvbResult.aroundPlayerInfo,[],'Unknown legacy best never borrows the current portrait');
    parse(await settle(legacy));assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM pvb_best_capture').get().n,0);

    now = event.window6 - 1; await fresh('negative-and-rollback'); put('UserAdventureStage', [stageRow(first.adventureStageId)]);
    before = snapshot(); assert.equal((await complete(battle(Number(firstKey), 'too-early'))).status, 400); assert.equal(snapshot(), before);
    now = event.window6;
    for (const bad of [null, {}, { ...body, pvbStageId: '55100000001' }, { ...body, pvbStageId: 1 },
      { ...body, adventureStageId: 1010000101101 }, { ...body, userPvBScore: null },
      { ...body, userPvBScore: { ...stats, extra: 0 } },
      ...['totalDamage','turnCount'].flatMap(key => [-1,'1',0x80000000,0.5].map(value => ({ ...body, userPvBScore: { ...stats, [key]: value } }))),
    ]) { before = snapshot(); assert.equal((await complete(bad)).status, 400); assert.equal(snapshot(), before); }
    assert.equal((await send('adventure/stage/complete', body)).status, 400);
    for (const changes of [{ skipCount: 2 }, { adventureGainedItems: [{ itemId: 298000001, amount: 1 }] },
      { friendshipStates: [{ characterId: 100000001, friendship: 1, friendshipLv: 1, userHeroType: 0 }] }]) {
      before = snapshot(); const unsupported = await complete({ ...body, ...changes });
      assert.equal(unsupported.status, 503); assert.equal(JSON.parse(unsupported.body).code, OFFLINE_UNAVAILABLE_CODE); assert.equal(snapshot(), before);
    }
    for (const table of ['operation_queue','stage_completion','stage_reward','pvb_clear','pvb_objective_receipt','pvb_player_capture','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_pvb BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'PvB rollback'); END`);
      before = snapshot(); assert.equal((await complete(body)).status, 503); assert.equal(snapshot(), before);
      app.store.db.exec('DROP TRIGGER fail_pvb');
    }
    const pendingOp = parse(await complete(body)).operation;
    before = snapshot(); assert.equal((await complete({ ...body, userPvBScore: { totalDamage: 1, turnCount: 1 } })).status, 400); assert.equal(snapshot(), before);
    const another = entries.find(([, row]) => row.pvbId === first.pvbId && row.adventureStageId !== first.adventureStageId);
    assert.equal((await complete(battle(Number(another[0]), 'overlap'))).status, 400, 'One pending score update per event');
    parse(await settle(pendingOp));
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    console.log('PvB offline completion: 942 original stages, 152 event records, score/objective receipts, late-period scores, int64, retry/ACK and rollback OK; native acceptance pending');
  } finally { await close(); fs.rmSync(directory, { recursive: true, force: true }); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
