'use strict';

// Deferred synthetic wire/persistence checks, NOT native party save ordering,
// publisher rankings, natural eligibility or the original character-usage metric.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const {pvbRankPrize}=require('./pvb_rewards.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
const id = 55100000001, original = master.pvbStages[id], event = master.pvbEvents[original.pvbId];
const routes = ['pvb/summary/get','pvb/group/ranking/get','pvb/total/ranking/get','pvb/friend/ranking/get',
  'pvb/character/ranking/get','pvb/player_info/get'];
const stageRow = adventureStageId => ({ userId: seed.userId, adventureStageId, signature: 0, state: 1,
  cumulativeClearCount: 0, dailyClearCount: 0, currentScore: 0, highScore: 0, firstCompleteDateTime: 0, lastCompleteDateTime: 0,
  firstTryDateTime: 0, lastTryDateTime: 0, ticketClosedAt: 0, ticketOpenedAt: 0, usedTicketId: 0, token: '', tasks: [] });
const battle = (token, pvbStageId = id, totalDamage = 1000) => ({ pvbStageId,
  adventureStageId: master.pvbStages[pvbStageId].adventureStageId, token, userPvBScore: { totalDamage, turnCount: 15 },
  adventureStageTaskIds: [], adventureGainedItems: [], friendshipStates: [], adventureRecord: { continueCount: 0 },
  isEnemyAnnihilated: false, secretMissionCompleted: false });

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-pvb-views-'));
  const database = path.join(directory, 'save.sqlite');
  let app, port, sequence = 0, now = event.window6;
  const open = async () => {
    app = createServer({ database, seed, master, wallNowSeconds: () => now, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const send = (action, body) => request(port, ++sequence, body, String(sequence), action);
  const parse = reply => { assert.equal(reply.status, 200, reply.body.toString()); return JSON.parse(reply.body); };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows), md5(rows), name);
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name, app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all()]));
  const viewBody = (action, extra = {}) => ({ pvbId: original.pvbId,
    ...(action === routes[1] ? { pvbGroupId: 1, pvbGroupRankingIndex: 0 } : {}),
    ...(action === routes[3] ? { page: 0 } : {}), ...(action === routes[5] ? { targetUserId: seed.userId } : {}), ...extra });
  const view = (action, extra) => send(action, viewBody(action, extra));
  const cachedView = async (action, body = viewBody(action)) => {
    const reply=await send(action,body);return {action,body,reply,identity:sequence};
  };
  const unavailable = async (action, extra) => {
    const before = snapshot(), response = await view(action, extra);
    assert.equal(response.status, 503); assert.equal(JSON.parse(response.body).code, OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(), before, 'Unavailable views preserve saves, history, queue and wallet');
  };
  const push = (putItems, operations = []) => send('user_data/push', { badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: Object.fromEntries(Object.entries(putItems).map(([name, rows]) => [name, md5(rows)])) },
    deltas: Object.keys(putItems).length ? [{ signature: 0, trigger: 'PvBComplete', putItems, deleteItems: {} }] : [],
    operations: operations.map(op => ({ id: op.id, verifier: op.token })) });
  const clear = operation => {
    const row = JSON.parse(app.store.db.prepare('SELECT stage_before_json FROM pvb_clear WHERE operation_id=?').get(operation.id).stage_before_json);
    return { ...row, state: 4, cumulativeClearCount: row.cumulativeClearCount + 1,
      firstCompleteDateTime: row.firstCompleteDateTime || now, lastCompleteDateTime: now };
  };
  const settle = op => push({ UserAdventureStage: [clear(op)], UserPvBRecord: [op.parameters.userPvbRecord] }, [op]);
  const select = party => {
    put('UserPvBParty', [party]);
    put('UserParty', app.store.read('UserParty').data.map(row => row.id !== 400 ? row : { ...row,
      slots: row.slots.map(slot => ({ ...slot,
        pcId: party.slots.find(item => item.slotNumber === slot.slotNumber).pc.pcId,
        assistingPcId: party.slots.find(item => item.slotNumber === slot.slotNumber).assistingPc.pcId })),
      memoriaSlots: party.memoriaSlots.map(slot => ({ slotNumber: slot.slotNumber, memoriaId: slot.otherMemoria.memoriaId })) }));
  };
  try {
    for(const id of Object.keys(master.pvbEvents)) for(const kind of ['group','total'])
      for(const row of master.pvbRankingRewards[kind][id]) {
        assert.deepEqual(pvbRankPrize(master,id,kind,row.minRank),row);
        if(row.maxRank) assert.deepEqual(pvbRankPrize(master,id,kind,row.maxRank),row);
        else assert.deepEqual(pvbRankPrize(master,id,kind,0x7fffffff),row);
      }
    assert.throws(()=>pvbRankPrize(master,original.pvbId,'group',0),/unavailable/);
    await open(); put('UserAdventureStage', [stageRow(original.adventureStageId)]);
    for (const pvbId of Object.keys(master.pvbEvents).map(Number)) {
      const summary = parse(await view(routes[0], { pvbId }));
      assert.equal(summary.userPvbRecord.pvbId, pvbId); assert.equal(summary.userPvbRecord.scoreInt64, 0);
      assert.equal(summary.pvbGroupRankingIndex, 0); assert.equal(summary.isFinalGroup, true); assert.deepEqual(summary.pvbGroupRanking, []);
    }
    const emptyViews=[await cachedView(routes[0]),
      await cachedView(routes[1],viewBody(routes[1],{pvbGroupId:0})),await cachedView(routes[2]),
      await cachedView(routes[3]),await cachedView(routes[3],{pvbId:original.pvbId}),await cachedView(routes[4])];
    assert.equal(app.store.read('UserPvBRecord').data.length, 0, 'Opening summary does not create native score records');
    assert.deepEqual(parse(emptyViews[1].reply).pvbGroupRanking, []);
    assert.deepEqual(parse(emptyViews[2].reply).pvbTotalRanking, []);
    assert.deepEqual(parse(emptyViews[3].reply).pvbFriendRanking, []);
    assert.deepEqual(parse(emptyViews[4].reply).pvbFriendRanking, [],
      'The native first/around-self request omits its page=-99 sentinel');
    assert.deepEqual(parse(emptyViews[5].reply), { code: 0, normal: [], assist: [] });
    await unavailable(routes[5]);
    const party = structuredClone(seed.data.UserPvBHighScoreParty[0]), firstPc = party.slots[0].pc.pcId;
    const secondPc = Number(Object.keys(master.pcProfiles).find(key => Number(key) !== firstPc));
    const assistPc = Number(Object.keys(master.pcProfiles).find(key => ![firstPc,secondPc].includes(Number(key))));
    party.slots[1].pc = { ...structuredClone(party.slots[0].pc), pcId: secondPc };
    for (const slot of party.slots.slice(0,2)) slot.assistingPc = { ...structuredClone(party.slots[0].pc), pcId: assistPc };
    party.memoriaSlots[0].otherMemoria = { memoriaId: Number(Object.keys(master.memoriaLevels)[0]), level: 2 };
    party.memoriaSlots[0].isHidden = true;
    select(party);
    const response = await send('pvb/stage/complete', battle('first')), identity = sequence, operation = parse(response).operation;
    const around = ({userId,...player}) => [player];
    assert.deepEqual(operation.parameters.pvbResult.aroundPlayerInfo, [{name:seed.data.UserInfo[0].name,
      pcId:firstPc,gradeId:55200000001,rank:1,score:2000,difficulty:1}]);
    assert.deepEqual(parse(await send('pvb/stage/complete',battle('first'))).operation,operation);
    assert.equal(operation.parameters.userPvbRecord.totalRank, 1);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM pvb_best_capture').get().n, 0);
    for (const route of routes) await unavailable(route);
    parse(await push({ UserAdventureStage: [clear(operation)], UserPvBRecord: [operation.parameters.userPvbRecord] }));
    await close(); await open();
    for (const route of routes) await unavailable(route);
    app.store.db.exec("CREATE TRIGGER fail_pvb_best BEFORE INSERT ON pvb_best_capture BEGIN SELECT RAISE(ABORT,'best pointer rollback'); END");
    let before = snapshot(); assert.equal((await push({}, [operation])).status, 503); assert.equal(snapshot(), before);
    app.store.db.exec('DROP TRIGGER fail_pvb_best'); parse(await push({}, [operation]));
    for(const cached of emptyViews) {
      const retained=snapshot(),reply=await request(port,cached.identity,cached.body,String(cached.identity),cached.action);
      assert.equal(reply.status,503,'Cached empty Record Buster view cannot hide an acknowledged score');
      assert.equal(snapshot(),retained,'Stale empty Record Buster recovery retains the acknowledged result');
    }
    const stableViews=[],summaryView=await cachedView(routes[0]),summary=parse(summaryView.reply),row=summary.pvbGroupRanking[0];
    stableViews.push(summaryView);
    assert.deepEqual(row, { userId: seed.userId, name: seed.data.UserInfo[0].name, pcId: firstPc,
      gradeId: 55200000001, rank: 1, score: 2000, difficulty: 1 });
    assert.equal(summary.userPvbRecord.scoreInt64, row.score);
    const groupView=await cachedView(routes[1]);stableViews.push(groupView);assert.deepEqual(parse(groupView.reply).pvbGroupRanking,[row]);
    const totalView=await cachedView(routes[2]);stableViews.push(totalView);assert.deepEqual(parse(totalView.reply).pvbTotalRanking,[row]);
    const friendView=await cachedView(routes[3]);stableViews.push(friendView);assert.deepEqual(parse(friendView.reply).pvbFriendRanking,[row]);
    const aroundView=await cachedView(routes[3],{pvbId:original.pvbId});stableViews.push(aroundView);
    assert.deepEqual(parse(aroundView.reply).pvbFriendRanking,[row]);assert.equal(parse(friendView.reply).hasNextPage,false);
    assert.deepEqual(parse(await view(routes[3], { page: 1 })).pvbFriendRanking, []);
    const characterView=await cachedView(routes[4]);stableViews.push(characterView);
    assert.deepEqual(parse(characterView.reply), { code: 0, normal: [firstPc,secondPc].sort((a,b) => a-b)
      .map((pcId,index) => ({ pcId, rank: index+1 })), assist: [{ pcId: assistPc, rank: 1 }] });
    const details = parse(await view(routes[5])),detailsSequence=sequence;
    assert.deepEqual(details.pvbParty, party); assert.deepEqual(details.pvbRecord, [summary.userPvbRecord]);
    assert.equal(details.playerInfo.userId, seed.userId); assert.equal(details.playerInfo.favoriteCharacterId, 100000005);
    assert.equal(details.playerInfo.favoriteCharacterCostumeId, 1022027000); assert.deepEqual(details.playerInfo.exploitIds, []);
    assert.equal(details.userAdventureLevelInfo, undefined, 'Do not invent optional adventure history');
    // Deferred native-width probes, not natural badge earning or UI acceptance.
    const badges=[69600000001,69600000002].map(titleBadgeId=>({userId:seed.userId,titleBadgeId}));
    parse(await push({UserTitleBadge:badges,UserInfo:app.store.read('UserInfo').data.map(user=>({...user,
      titleBadgeId:badges[0].titleBadgeId,subTitleBadgeId:badges[1].titleBadgeId}))}));
    const badgeDetails=parse(await view(routes[5]));
    assert.equal(badgeDetails.playerInfo.titleBadgeId,69600000001);
    assert.equal(badgeDetails.playerInfo.subTitleBadgeId,69600000002);
    assert.deepEqual(badgeDetails.playerInfo.exploitIds,[],'Long title IDs must never enter the legacy int32 vector');
    assert.deepEqual(badgeDetails.pvbParty,party);assert.deepEqual(badgeDetails.pvbRecord,details.pvbRecord);
    let badgeBefore=snapshot();
    assert.equal((await request(port,detailsSequence,viewBody(routes[5]),String(detailsSequence),routes[5])).status,503);
    assert.equal(snapshot(),badgeBefore,'A changed title cannot replay a stale public profile');
    const keyItems=app.store.read('UserKeyItem').data,
      keyItem=(keyItemId,amount,exploit)=>({userId:seed.userId,keyItemId,amount,reservedAmount:0,
        bookEntryState:1,signature:0,cumulativeAmount:1,exploit});
    const feats=[keyItem(241000011,1,true),keyItem(241000001,1,false),
      keyItem(241000012,0,true),keyItem(241000010,1,false)];
    put('UserKeyItem',feats);
    const featDetails=parse(await view(routes[5])),featSequence=sequence;
    assert.deepEqual(featDetails.playerInfo.exploitIds,[241000010,241000011],
      'Original feat flag and positive amount, not processed boolean or long titles, select the public feats');
    assert.deepEqual(featDetails.pvbParty,party);assert.deepEqual(featDetails.pvbRecord,details.pvbRecord);
    parse(await push({UserKeyItem:[{...feats[3],exploit:true}]}));
    assert.deepEqual(parse(await view(routes[5])).playerInfo.exploitIds,[241000010,241000011],
      'Processing a held feat does not remove or add its public identity');
    put('UserKeyItem',feats.map(row=>row.keyItemId===241000010?{...row,amount:0}:row));
    badgeBefore=snapshot();
    assert.equal((await request(port,featSequence,viewBody(routes[5]),String(featSequence),routes[5])).status,503);
    assert.equal(snapshot(),badgeBefore,'A changed feat inventory cannot replay a stale public profile');
    assert.deepEqual(parse(await view(routes[5])).playerInfo.exploitIds,[241000011]);
    for(const corrupt of [feats.map(row=>({...row,exploit:'true'})),[...feats,feats[0]],
      [{...feats[0],userId:seed.userId+1}],[{...feats[0],keyItemId:69600000001}],
      [{...feats[0],keyItemId:241999999}],[{...feats[0],lastResetAt:0}]]) {
      put('UserKeyItem',corrupt);await unavailable(routes[5]);
    }
    put('UserKeyItem',keyItems);
    assert.equal(parse(await view(routes[5])).playerInfo.titleBadgeId,69600000001);
    assert.equal((await request(port, identity, battle('first'), String(identity), 'pvb/stage/complete')).status, 503);
    const changed = structuredClone(party); changed.slots[0].pc.pcId = secondPc;
    select(changed);
    put('UserInfo',app.store.read('UserInfo').data.map(user=>({...user,name:`${user.name}-changed`})));
    for (const [token, damage] of [['lower',1],['tie',1000]]) {
      const op = parse(await send('pvb/stage/complete', battle(token,id,damage))).operation;
      assert.deepEqual(op.parameters.pvbResult.aroundPlayerInfo,around(row),'Name/party changes cannot rewrite a lower/tied historical result');
      parse(await settle(op));
      assert.deepEqual(parse(await view(routes[5])).pvbParty, party, 'A lower/tied result cannot replace historical best party');
      assert.equal(parse(await view(routes[2])).pvbTotalRanking[0].pcId, firstPc);
    }
    for(const cached of stableViews) assert.deepEqual((await request(port,cached.identity,cached.body,
      String(cached.identity),cached.action)).body,cached.reply.body,
    'Lower/tied results and current profile changes cannot invalidate the immutable Record Buster best');
    const stableDetails=await cachedView(routes[5]);parse(stableDetails.reply);
    const harderId = Number(Object.keys(master.pvbStages).find(key => master.pvbStages[key].pvbId === original.pvbId &&
      master.pvbStages[key].difficulty === 2));
    put('UserAdventureStage', [...app.store.read('UserAdventureStage').data,stageRow(master.pvbStages[harderId].adventureStageId)]);
    const harder = parse(await send('pvb/stage/complete', battle('harder',harderId))).operation;
    assert.deepEqual(harder.parameters.pvbResult.aroundPlayerInfo,around({...row,name:`${row.name}-changed`,pcId:secondPc,score:10000,difficulty:2}));
    parse(await settle(harder)); assert.deepEqual(parse(await view(routes[5])).pvbParty, changed);
    for(const cached of [...stableViews,stableDetails]) assert.equal((await request(port,cached.identity,cached.body,
      String(cached.identity),cached.action)).status,503,'Cached Record Buster view cannot hide a higher acknowledged score/team');
    const best = parse(await view(routes[2])).pvbTotalRanking[0]; assert.equal(best.score, 10000); assert.equal(best.difficulty, 2);
    //Original group/total quantities, disclosed solo rank1/end+1 delivery;
    //synthetic flags are NOT native tally timing or effect-save-ACK proof.
    now=event.window7;
    const beforePrize=parse(await view(routes[0])),summarySequence=sequence;
    const nativePull={tables:['UserGift','UserPvBRecord']};assert.equal((await send('user_data/pull',nativePull)).status,200);
    const pullSequence=sequence;parse(await send('user_data/confirm'));const confirmSequence=sequence;
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM pvb_ranking_reward').get().n,0);
    const presentsBefore=app.store.read('UserGift').data,walletBefore=app.store.hardCurrency();now++;
    const beforeSettlementProbe=snapshot();
    assert.equal((await request(port,summarySequence,viewBody(routes[0]),String(summarySequence),routes[0])).status,503,
      'Cached summary cannot skip newly eligible ranking-prize settlement');
    assert.equal(snapshot(),beforeSettlementProbe,'Cached prize probe is read-only and retains earned history');
    const delivery=app.store.db.prepare('SELECT operation_json FROM stage_delivery WHERE operation_id=?').get(harder.id).operation_json;
    const result=app.store.db.prepare('SELECT result_json FROM pvb_clear WHERE operation_id=?').get(harder.id).result_json;
    const replaceAround=rows=>{
      app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?')
        .run(JSON.stringify({...harder,parameters:{...harder.parameters,pvbResult:{...harder.parameters.pvbResult,aroundPlayerInfo:rows}}}),harder.id);
      app.store.db.prepare('UPDATE pvb_clear SET result_json=? WHERE operation_id=?')
        .run(JSON.stringify({...harder.parameters.pvbResult,aroundPlayerInfo:rows}),harder.id);
    };
    replaceAround([]);assert.equal(app.store.pvbRewards.proof(original.pvbId).id,harder.id,'Legacy empty-list captures remain readable');
    const local=harder.parameters.pvbResult.aroundPlayerInfo[0];
    for(const rows of [null,[null],[{...local,userId:seed.userId}],[{...local,name:row.name}],
      [{...local,pcId:firstPc}],[{...local,gradeId:1}],[{...local,score:2000}],[{...local,difficulty:1}],[local,local]]) {
      replaceAround(rows);await unavailable(routes[0]);
    }
    app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run(delivery,harder.id);
    app.store.db.prepare('UPDATE pvb_clear SET result_json=? WHERE operation_id=?').run(result,harder.id);
    for(const [table,event] of [['pvb_ranking_reward','INSERT'],['pvb_ranking_gift','INSERT'],['profile','UPDATE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_pvb_reward BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'PvB prize rollback'); END`);
      const before=snapshot();assert.equal((await view(routes[0])).status,503);assert.equal(snapshot(),before);
      app.store.db.exec('DROP TRIGGER fail_pvb_reward');
    }
    const awarded=parse(await view(routes[0])),prize=app.store.pvbRewards.receipt(original.pvbId);
    assert.deepEqual(awarded.userPvbRecord,{...beforePrize.userPvbRecord,isAggregate:true,isReceiveGroupReward:true,isReceiveTotalReward:true});
    assert.deepEqual(awarded.pvbGroupRanking,[best]);assert.equal(app.store.hardCurrency(),walletBefore);
    const items=['group','total'].flatMap(kind=>pvbRankPrize(master,original.pvbId,kind,1).rewards);
    assert.deepEqual(prize.gifts.map(({itemId,amount})=>({itemId,amount})),items);
    assert.deepEqual(app.store.read('UserGift').data,[...presentsBefore,...prize.gifts]);
    assert(prize.gifts.every(gift=>gift.startAt===event.window7+1 && gift.expireAt===0 && gift.giftAcquiredType===8));
    for(const [action,key,body] of [[routes[0],summarySequence,viewBody(routes[0])],
      ['user_data/pull',pullSequence,nativePull],['user_data/confirm',confirmSequence,undefined]]) {
      const before=snapshot();assert.equal((await request(port,key,body,String(key),action)).status,503);assert.equal(snapshot(),before);
    }
    for(const [field,bad] of [['catalog_hash','missing'],['before_json','{}'],['gifts_json','[null]']]) {
      const saved=app.store.db.prepare('SELECT * FROM pvb_ranking_reward WHERE pvb_id=?').get(original.pvbId);
      app.store.db.prepare(`UPDATE pvb_ranking_reward SET ${field}=? WHERE pvb_id=?`).run(bad,original.pvbId);
      await unavailable(routes[0]);app.store.db.prepare(`UPDATE pvb_ranking_reward SET ${field}=? WHERE pvb_id=?`).run(saved[field],original.pvbId);
    }
    const rewind=snapshot();assert.equal((await push({UserPvBRecord:[beforePrize.userPvbRecord]})).status,400);assert.equal(snapshot(),rewind);
    now=event.window7;
    const beforeClockRewind=snapshot();assert.equal((await send('pvb/stage/complete',battle('rewarded-rewind',harderId,100000))).status,503);
    assert.equal(snapshot(),beforeClockRewind);now=event.window7+1;
    const practice=parse(await send('pvb/stage/complete',battle('rewarded-practice',harderId,100000))).operation;
    assert.equal(practice.parameters.pvbResult.isRecorded,false);assert.deepEqual(practice.parameters.userPvbRecord,awarded.userPvbRecord);
    assert.deepEqual(practice.parameters.pvbResult.aroundPlayerInfo,around(best));
    parse(await settle(practice));
    now = event.window9 + 100; await close(); await open();
    assert.deepEqual(parse(await view(routes[2])).pvbTotalRanking, [best], 'Clock changes/restart preserve settled history');
    const other = Number(Object.keys(master.pvbEvents).find(key => Number(key) !== original.pvbId));
    assert.deepEqual(parse(await view(routes[2], { pvbId: other })).pvbTotalRanking, [], 'No cross-event scores');
    await unavailable(routes[1], { pvbGroupId: 999 }); await unavailable(routes[1], { pvbGroupRankingIndex: 1 });
    await unavailable(routes[5], { targetUserId: seed.userId + 1 });
    for (const route of routes) for (const extra of [{ pvbId: 1 }, { pvbId: String(original.pvbId) }, { extra: 0 }]) {
      before = snapshot(); assert.equal((await view(route, extra)).status, 400); assert.equal(snapshot(), before);
    }
    for (const page of [-99,-1,'0',0.5,0x80000000]) {
      before = snapshot(); assert.equal((await view(routes[3], { page })).status, 400); assert.equal(snapshot(), before);
    }
    const friends = app.store.read('UserFriendStatus').data;
    put('UserFriendStatus', [{ userId: seed.userId, friendId: seed.userId, followCount: 1, followerCount: 0 }]);
    await unavailable(routes[3]); put('UserFriendStatus', friends);
    const capture = app.store.db.prepare('SELECT * FROM pvb_best_capture WHERE pvb_id=?').get(original.pvbId);
    app.store.db.prepare('DELETE FROM pvb_best_capture WHERE pvb_id=?').run(original.pvbId);
    for (const route of routes) await unavailable(route);
    app.store.db.prepare('INSERT INTO pvb_best_capture(pvb_id,operation_id) VALUES(?,?)').run(capture.pvb_id, capture.operation_id);
    const saved = app.store.db.prepare('SELECT player_json FROM pvb_player_capture WHERE operation_id=?').get(capture.operation_id).player_json;
    app.store.db.prepare('UPDATE pvb_player_capture SET player_json=? WHERE operation_id=?')
      .run(JSON.stringify({ ...JSON.parse(saved), pvbParty: null }), capture.operation_id);
    assert.deepEqual(parse(await view(routes[2])).pvbTotalRanking, [best], 'A real captured portrait does not fabricate a full party');
    await unavailable(routes[4]); await unavailable(routes[5]);
    app.store.db.prepare('UPDATE pvb_player_capture SET player_json=? WHERE operation_id=?').run(saved, capture.operation_id);
    assert.equal(app.store.operations().length,0);assert.equal(app.store.hardCurrency(),walletBefore,'Publishing Presents does not claim them');
    parse(await send('user_data/confirm'));await close();await open();parse(await view(routes[0]));
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM pvb_ranking_reward').get().n,1,'Restart/summary/confirm cannot remint ranking prizes');
    const iris=prize.gifts.find(gift=>gift.itemId===205000001);assert(iris);
    const receive={giftIds:[iris.id],userId:seed.userId},claimed=parse(await send('gift/receive',receive)),giftOp=claimed.operations[0];
    assert.equal(giftOp.type,2000);assert.equal(app.store.hardCurrency(),walletBefore+iris.amount);
    let retained=snapshot();assert.equal((await push({},[giftOp])).status,400);assert.equal(snapshot(),retained);
    parse(await push({UserGift:[{...iris,state:1}]}));await close();await open();
    retained=snapshot();assert.equal((await send('gift/receive',receive)).status,503);assert.equal(snapshot(),retained);
    parse(await push({},[giftOp]));await close();await open();parse(await send('user_data/confirm'));
    assert.equal(app.store.hardCurrency(),walletBefore+iris.amount);assert.equal(app.store.operations().length,0);
    retained=snapshot();assert.equal((await push({UserGift:[iris]})).status,400);assert.equal(snapshot(),retained);
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    console.log('PvB source views/prize data/solo Presents/save-ACK/replay/rollback/restart checks passed; publisher tally/native acceptance pending');
  } finally { await close(); fs.rmSync(directory, { recursive: true, force: true }); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
