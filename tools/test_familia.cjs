'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-familia-'));
  let database = path.join(directory, 'profile.sqlite');
  let app, port, sequence = 0;
  const open = async () => {
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => {
    if (app?.server.listening) await new Promise(resolve => app.server.close(resolve));
    app?.store.close(); app = null;
  };
  const send = (value, action = 'familia/create') => request(port, ++sequence, value, String(sequence), action);
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows), md5(rows), name);
  const save = (putItems, operations = []) => ({ badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: Object.fromEntries(Object.entries(putItems).map(([name, rows]) => [name, md5(rows)])) },
    deltas: [{ signature: 0, trigger: 'Familia', deleteItems: {}, putItems }],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })) });
  const settings = { name: 'Local家族', description: 'An actual solo local Familia.', godId: 20000001,
    style: 21000001, subStyle: 0, activeTime: 22000001, subActiveTime: 22000002, requireApproval: false };
  const noFamilia = { code: 0, result: 0, status: { familiaId: 0 }, members: [] };
  const currency = { userId: seed.userId, currencyId: master.currencies['currency.valis'],
    amount: 200000, cumulativeAmount: 250000, reservedAmount: 0, signature: 0 };
  const count = () => app.store.db.prepare('SELECT COUNT(*) n FROM local_familia').get().n;
  const detailValue = { familiaId: 1 };
  const getDetails = () => send(detailValue, 'familia/get').then(parse);
  const byName = value => send(value, 'familia/search/name');
  const byOption = value => send(value, 'familia/search/option');
  const inviteSearch = value => send(value, 'familia/invite/search');
  const inviteSend = value => send(value, 'familia/invite/send');
  const invitedList = () => send(null, 'familia/invited/list');
  const invitedAccept = value => send(value, 'familia/invited/accept');
  const appointSubmaster = value => send(value, 'familia/manage/appoint_submaster');
  const dismissSubmaster = value => send(value, 'familia/manage/dismessed_submaster');
  const changeMaster = value => send(value, 'familia/manage/change_master');
  const joinApprove = value => send(value, 'familia/join/approve');
  const kickMember = value => send(value, 'familia/kick');
  const randomSearch = () => send(null, 'familia/search/random');
  const receivedJoinList = value => send(value, 'familia/join/list/recieved');
  const sentJoinList = () => send(null, 'familia/join/list/sent');
  const joinCancel = value => send(value, 'familia/join/cancel');
  const joinSend = value => send(value, 'familia/join/send');
  const leave = value => send(value, 'familia/leave');
  const cpuIds = Object.keys(master.underPvp.dummyUnderPvpParty).map(Number).sort((a,b)=>a-b),
    firstCpuId=cpuIds[0],joinCpuId=cpuIds[1],joinTargetValue={familiaId:2};
  const searchFor = status => {
    const { id, name, description, godId, style, subStyle, requireApproval, contributionPoint } = status.familia;
    return { code: 0, familias: [{ familia: { id, name, description, godId, style, subStyle,
      requireApproval, contributionPoint }, master: { name: status.members.find(row => row.post === 3).name },
      memberCount: status.members.length }] };
  };
  const detailsFor = status => ({ code: 0, result: 0,
    familia: { ...status.familia, latestGuildRaidRank: 0, latestGvgRank: 0, latestGvgLeagueId: 0 },
    members: status.members, sentRequest: false });
  const rejectMalformedLeader = async action => {
    const parties = app.store.read('UserParty').data, pcs = app.store.read('UserPC').data;
    const leaderId = parties.find(row => row.id === 1).slots.find(row => row.slotNumber === 1).pcId;
    for (const change of [{ pcId: String(leaderId) }, { currentJobIndex: '1' }, { currentJobIndex: 0 },
      { currentJobIndex: 1.5 }, { currentJobIndex: master.pcProfiles[leaderId].jobIds.length + 1 }]) {
      put('UserPC', pcs.map(row => row.pcId === leaderId ? { ...row, ...change } : row));
      put('UserParty', change.pcId ? parties.map(row => row.id === 1 ? { ...row,
        slots: row.slots.map(slot => slot.slotNumber === 1 ? { ...slot, pcId: change.pcId } : slot) } : row) : parties);
      assert.equal((await send(action === 'familia/create' ? settings :
        action === 'familia/get' ? detailValue : {}, action)).status, 503, JSON.stringify(change));
    }
    put('UserParty', parties); put('UserPC', pcs);
  };
  try {
    await open();
    for (const value of [undefined, {}, { is_login: true }])
      assert.deepEqual(parse(await send(value, 'familia/mystatus')), noFamilia);
    const recommendationResponse=await randomSearch(),recommendationSequence=sequence,
      recommendation=parse(recommendationResponse),joinCard=recommendation.familias[0];
    assert.equal(recommendation.familias.length,1);assert.equal(joinCard.familia.id,2);
    assert.equal(joinCard.familia.name,'CPURecruit');assert.equal(joinCard.familia.requireApproval,true);
    assert.equal(joinCard.master.name.includes('[Offline CPU]'),true);assert.equal(joinCard.memberCount,1);
    const beforeJoinDetailsResponse=await send(joinTargetValue,'familia/get'),beforeJoinDetailsSequence=sequence,
      beforeJoinDetails=parse(beforeJoinDetailsResponse);
    assert.equal(beforeJoinDetails.familia.id,2);assert.equal(beforeJoinDetails.sentRequest,false);
    assert.deepEqual(beforeJoinDetails.members.map(row=>[row.userId,row.post]),[[joinCpuId,3]]);
    const emptyRequests={code:0,requests:[]},beforeSentResponse=await sentJoinList(),beforeSentSequence=sequence;
    assert.deepEqual(parse(beforeSentResponse),emptyRequests);
    for(const value of [undefined,{},[],0,false,'',{familiaId:2}])
      assert.equal((await send(value,'familia/join/list/sent')).status,400,JSON.stringify(value));
    for(const value of [undefined,null,{},[],0,false,'',{familiaId:0},{familiaId:-1},{familiaId:'2'},
      {familiaId:2.5},{familiaId:2,extra:0},{familiaId:1}])
      assert.equal((await joinSend(value)).status,400,JSON.stringify(value));
    const firstJoinResponse=await joinSend(joinTargetValue),firstJoinSequence=sequence;
    assert.deepEqual(parse(firstJoinResponse),{code:0,state:0,result:0});
    assert.equal(app.store.db.prepare('SELECT state FROM familia_join_application WHERE familia_id=2').get().state,0);
    assert.equal(parse(await send(joinTargetValue,'familia/get')).sentRequest,true);
    const pendingSentResponse=await sentJoinList(),pendingSentSequence=sequence,pendingSent=parse(pendingSentResponse);
    assert.deepEqual(pendingSent,{code:0,requests:[joinCard]});
    assert.equal((await request(port,beforeSentSequence,null,String(beforeSentSequence),'familia/join/list/sent')).status,503,
      'A cached empty sent list cannot hide a new pending application');
    assert.deepEqual((await request(port,firstJoinSequence,joinTargetValue,String(firstJoinSequence),'familia/join/send')).body,
      firstJoinResponse.body,'A join application replays without creating another application');
    assert.equal((await joinSend(joinTargetValue)).status,503,'A second request cannot duplicate a pending application');
    const emptyInvitations={code:0,familias:[]},incomingResponse=await invitedList(),incomingSequence=sequence,
      incoming=parse(incomingResponse),incomingFamilia=incoming.familias[0],preAcceptProfile=app.store.read('UserProfile').data[0];
    assert.equal(incoming.familias.length,1); assert.equal(incomingFamilia.familia.id,1);
    assert.equal(incomingFamilia.familia.name,'OfflineCPU'); assert.equal(incomingFamilia.memberCount,1);
    assert.equal(incomingFamilia.master.name.includes('[Offline CPU]'),true);
    for(const value of [{},[],0,false,'',{familiaId:1}])
      assert.equal((await send(value,'familia/invited/list')).status,400,JSON.stringify(value));
    for(const value of [undefined,null,{},[],0,false,'',{familiaId:0},{familiaId:-1},{familiaId:'1'},
      {familiaId:1.5},{familiaId:1,extra:0}])
      assert.equal((await invitedAccept(value)).status,400,JSON.stringify(value));
    const acceptValue={familiaId:1},acceptResponse=await invitedAccept(acceptValue),acceptSequence=sequence;
    assert.deepEqual(parse(acceptResponse),{code:0,result:0});
    const accepted=app.store.db.prepare('SELECT * FROM local_familia WHERE id=1').get();
    assert.equal(accepted.owner_id,firstCpuId); assert.equal(accepted.creation_operation_id,-1);
    assert.equal(app.store.db.prepare('SELECT state FROM familia_incoming_invitation WHERE familia_id=1').get().state,1);
    assert.equal(app.store.db.prepare('SELECT state FROM familia_join_application WHERE familia_id=2').get().state,2,
      'Joining another Familia terminates the pending application');
    assert.equal((await request(port,firstJoinSequence,joinTargetValue,String(firstJoinSequence),'familia/join/send')).status,503);
    assert.equal((await request(port,beforeJoinDetailsSequence,joinTargetValue,String(beforeJoinDetailsSequence),'familia/get')).status,503);
    assert.equal((await request(port,recommendationSequence,null,String(recommendationSequence),'familia/search/random')).status,503);
    assert.equal((await request(port,pendingSentSequence,null,String(pendingSentSequence),'familia/join/list/sent')).status,503);
    assert.deepEqual(parse(await sentJoinList()),emptyRequests);
    const joined=parse(await send({},'familia/mystatus'));
    assert.equal(joined.status.familiaId,1); assert.deepEqual(joined.members.map(row=>row.post),[3,1]);
    assert.deepEqual((await request(port,acceptSequence,acceptValue,String(acceptSequence),'familia/invited/accept')).body,
      acceptResponse.body,'Accepted invitation replays without a second membership mutation');
    assert.equal((await request(port,incomingSequence,null,String(incomingSequence),'familia/invited/list')).status,503,
      'A cached pending invitation cannot hide the accepted membership');
    assert.equal((await inviteSearch({searchType:0,limit:1})).status,503,'Joined members cannot issue owner invitations');
    for(const value of [{},[],0,false,'',{familiaId:1}])
      assert.equal((await leave(value)).status,400,JSON.stringify(value));
    const leaveResponse=await leave(null),leaveSequence=sequence;
    assert.deepEqual(parse(leaveResponse),{code:0,result:0}); assert.equal(count(),0);
    assert.equal(app.store.db.prepare('SELECT state FROM familia_incoming_invitation WHERE familia_id=1').get().state,2);
    assert.equal(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=-1').get(),undefined);
    assert.deepEqual(app.store.read('UserProfile').data,[{...preAcceptProfile,familiaName:''}]);
    assert.deepEqual((await request(port,leaveSequence,null,String(leaveSequence),'familia/leave')).body,leaveResponse.body,
      'Leave replays without deleting another membership');
    assert.deepEqual(parse(await invitedList()),emptyInvitations,'A consumed invitation does not reappear after leave');
    assert.equal((await leave(null)).status,503,'A fresh leave cannot consume the membership twice');
    assert.equal(parse(await send(joinTargetValue,'familia/get')).sentRequest,false);
    const secondJoinResponse=await joinSend(joinTargetValue),secondJoinSequence=sequence;
    assert.deepEqual(parse(secondJoinResponse),{code:0,state:0,result:0});
    const secondPendingDetailsResponse=await send(joinTargetValue,'familia/get'),secondPendingDetailsSequence=sequence;
    assert.equal(parse(secondPendingDetailsResponse).sentRequest,true);
    const secondPendingListResponse=await sentJoinList(),secondPendingListSequence=sequence;
    assert.deepEqual(parse(secondPendingListResponse),{code:0,requests:[joinCard]});
    for(const value of [undefined,null,{},[],0,false,'',{familiaId:0},{familiaId:-1},{familiaId:'2'},
      {familiaId:2.5},{familiaId:2,extra:0},{familiaId:1}])
      assert.equal((await joinCancel(value)).status,400,JSON.stringify(value));
    const beforeCancelProfiles=app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all(),
      beforeCancelOperations=app.store.operations();
    app.store.db.exec("CREATE TRIGGER fail_join_cancel BEFORE INSERT ON familia_join_cancel_request BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
    assert.notEqual((await joinCancel(joinTargetValue)).status,200);
    assert.equal(app.store.db.prepare('SELECT state FROM familia_join_application WHERE familia_id=2').get().state,0,
      'A failed cancellation must retain the pending application');
    app.store.db.exec('DROP TRIGGER fail_join_cancel');
    const cancelResponse=await joinCancel(joinTargetValue),cancelSequence=sequence;
    assert.deepEqual(parse(cancelResponse),{code:0});
    assert.equal(app.store.db.prepare('SELECT state FROM familia_join_application WHERE familia_id=2').get().state,1);
    assert.deepEqual(app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all(),beforeCancelProfiles);
    assert.deepEqual(app.store.operations(),beforeCancelOperations,'Cancellation has no reward or currency operation');
    assert.equal((await request(port,secondJoinSequence,joinTargetValue,String(secondJoinSequence),'familia/join/send')).status,503,
      'A cancelled application cannot be restored by its old send request');
    assert.equal((await request(port,secondPendingDetailsSequence,joinTargetValue,String(secondPendingDetailsSequence),'familia/get')).status,503,
      'Cached details cannot keep a cancelled application marked pending');
    assert.equal((await request(port,secondPendingListSequence,null,String(secondPendingListSequence),'familia/join/list/sent')).status,503,
      'Cached sent requests cannot restore a cancelled application');
    assert.equal(parse(await send(joinTargetValue,'familia/get')).sentRequest,false);
    assert.deepEqual(parse(await sentJoinList()),emptyRequests);
    assert.deepEqual((await request(port,cancelSequence,joinTargetValue,String(cancelSequence),'familia/join/cancel')).body,
      cancelResponse.body,'Cancellation replays without changing another application');
    assert.equal((await request(port,cancelSequence,{familiaId:3},String(cancelSequence),'familia/join/cancel')).status,400);
    assert.equal((await joinCancel(joinTargetValue)).status,503,'A fresh cancellation cannot consume the application twice');
    await close(); await open();
    assert.deepEqual((await request(port,cancelSequence,joinTargetValue,String(cancelSequence),'familia/join/cancel')).body,
      cancelResponse.body,'Cancellation receipt survives restart');
    assert.deepEqual(parse(await sentJoinList()),emptyRequests);
    const thirdJoinResponse=await joinSend(joinTargetValue),thirdJoinSequence=sequence;
    assert.deepEqual(parse(thirdJoinResponse),{code:0,state:0,result:0});
    const thirdPendingListResponse=await sentJoinList(),thirdPendingListSequence=sequence;
    assert.deepEqual(parse(thirdPendingListResponse),{code:0,requests:[joinCard]});
    assert.equal((await request(port,cancelSequence,joinTargetValue,String(cancelSequence),'familia/join/cancel')).status,503,
      'An old cancellation cannot cancel a newer application');
    const emptySearch = await byOption({}), emptySearchSequence = sequence;
    assert.deepEqual(parse(emptySearch), { code: 0, familias: [] });
    assert.deepEqual(parse(await byName({ name: 'Local家' })), { code: 0, familias: [] });
    for (const value of [undefined, null, {}, [], 1, { name: 1 }, { name: null }, { name: 'Local', style: 21000001 }])
      assert.equal((await byName(value)).status, 400, JSON.stringify(value));
    for (const value of [undefined, null, [], 1, true, false, { name: 'Local' }, { style: 0 }, { style: '21000001' },
      { style: 21000001.5 }, { style: 21000006 }, { requireApproval: 1 }, { requireApproval: null }, { extra: null }])
      assert.equal((await byOption(value)).status, 400, JSON.stringify(value));
    assert.equal((await send(detailValue, 'familia/get')).status, 503, 'No guild is not a fake empty member-list success');
    assert.equal((await inviteSearch({ searchType: 0, limit: 1 })).status, 503,
      'No guild is not a fake invitation-candidate success');
    assert.equal((await inviteSend({ userId: firstCpuId })).status, 503,
      'No guild cannot persist an outbound invitation');
    for (const value of [undefined, null, {}, { familiaId: 0 }, { familiaId: -1 }, { familiaId: '1' },
      { familiaId: 1.5 }, { familiaId: Number.MAX_SAFE_INTEGER + 1 }, { familiaId: 1, userId: seed.userId }])
      assert.equal((await send(value, 'familia/get')).status, 400, JSON.stringify(value));
    assert.equal((await send({ familiaId: 1, ...settings }, 'familia/manage/change/info')).status, 400);
    assert.equal((await send({ familiaId: 1, godId: 20000002 }, 'familia/manage/change/god')).status, 400);
    assert.equal((await send({ familiaId: 1 }, 'familia/msg_board/feed')).status, 400);
    assert.equal((await send({ is_login: false }, 'familia/mystatus')).status, 400);
    assert.equal((await send(settings)).status, 400, 'No currency means no free creation');
    put('UserCurrency', [currency]);
    for (const change of [{ name: '' }, { name: '12345678901' }, { name: ' Line' }, { name: 'One\nTwo' },
      { description: '' }, { description: 'a'.repeat(121) }, { description: 'a\n'.repeat(6) },
      { godId: 0 }, { style: 0 }, { subStyle: 1 }, { activeTime: 0 }, { subActiveTime: 0 },
      { godId: '20000001' }, { requireApproval: 1 }])
      assert.equal((await send({ ...settings, ...change })).status, 400, JSON.stringify(change));
    assert.equal(count(), 0); assert.deepEqual(app.store.operations(), []);
    const profile = app.store.read('UserProfile').data[0];
    for (const change of [{ familiaName: 'Old remote' }, { familiaId: 77 }, { userId: 2 }]) {
      put('UserProfile', [{ ...profile, ...change }]);
      assert.equal((await send(settings)).status, 503);
      assert.equal((await send({}, 'familia/mystatus')).status, 503);
      assert.equal((await send(detailValue, 'familia/get')).status, 503);
      assert.equal((await byName({ name: '' })).status, 503);
      assert.equal((await byOption({})).status, 503);
      assert.equal((await invitedList()).status,503);
    }
    put('UserProfile', [profile]);
    for (const change of [{ amount: 99999 }, { reservedAmount: 1 }, { userId: 2 },
      { amount: 0x80000000, cumulativeAmount: 0x80000000 }, { cumulativeAmount: 2000000001 }]) {
      put('UserCurrency', [{ ...currency, ...change }]);
      assert.equal((await send(settings)).status, 400);
    }
    put('UserCurrency', [currency]);
    await rejectMalformedLeader('familia/create');
    assert.equal(count(), 0); assert.deepEqual(app.store.operations(), [], 'Malformed leaders must not incur a charge');
    // Original data, not saved playerStatus.level or PCJobSet array order,
    // determines the public member's rank/leader fields.
    const info = app.store.read('UserInfo').data[0];
    put('UserInfo', [{ ...info, activePartyId: 2, name: 'Owner',
      playerStatus: { ...info.playerStatus, totalExp: 350, level: 999 } }]);
    put('UserProfile', [{ ...profile, introduction: 'Saved introduction', totalStatusPoint: 1234 }]);
    const status = app.store.read('UserStatus').data[0];
    put('UserStatus', [{ ...status, lastLoginedAt: 1790950000 }]);
    const pcs = app.store.read('UserPC').data;
    const leader = pcs.find(row => row.pcId === 1011001001);
    put('UserPC', pcs.map(row => row === leader ? { ...row, currentJobIndex: 3, totalExp: 10000000,
      limitbreakCount: 2, heroSublimateLevel: 1, isUnlockedHeroSublimate: true } : row));
    const pending = app.store.issueOperation(4000, {});
    assert.equal((await send(settings)).status, 400, 'Outstanding mutations must settle first');
    parse(await send(save({}, [pending]), 'user_data/push'));
    // Force a failure after issueOperation to prove row + charge queue atomicity.
    app.store.db.exec("CREATE TRIGGER fail_familia BEFORE INSERT ON local_familia BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
    assert.notEqual((await send(settings)).status, 200);
    assert.equal(count(), 0); assert.deepEqual(app.store.operations(), []);
    app.store.db.exec('DROP TRIGGER fail_familia');
    const response = await send(settings), originalSequence = sequence;
    const created = parse(response), operation = created.operations[0];
    assert.equal(created.result, 0); assert.equal(operation.type, 22000);
    assert.deepEqual(operation.parameters, { consumedValis: 100000 });
    assert.deepEqual(created.operation, { ...operation, parameters: { consumedValis: 100000, result: 0 } },
      'Native hot transport requires singular operation and callback result');
    const legacyCreated = { ...created }; delete legacyCreated.operation;
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE action=? AND key=?')
      .run(Buffer.from(JSON.stringify(legacyCreated)).toString('base64'), 'familia/create', `${originalSequence}/${originalSequence}`);
    assert.deepEqual((await request(port, originalSequence, settings, String(originalSequence), 'familia/create')).body,
      response.body, 'Legacy creation reply gains its hot envelope without another charge');
    assert.equal(count(), 1); assert.deepEqual(app.store.read('UserCurrency').data, [currency], 'Client operation owns the debit');
    assert.equal(app.store.db.prepare('SELECT state FROM familia_join_application WHERE familia_id=2').get().state,2,
      'Creating a Familia terminates the pending application');
    assert.equal((await request(port,thirdJoinSequence,joinTargetValue,String(thirdJoinSequence),'familia/join/send')).status,503,
      'An old join request cannot replace a newly created Familia');
    assert.equal((await request(port,thirdPendingListSequence,null,String(thirdPendingListSequence),'familia/join/list/sent')).status,503,
      'A cached pending request list cannot hide a newly created Familia');
    assert.deepEqual(parse(await send(settings)), created, 'New-request retry reuses the same creation');
    assert.equal((await send({ ...settings, name: 'Second' })).status, 400);
    const getStatus = () => send({ is_login: true }, 'familia/mystatus').then(parse);
    const own = await getStatus();
    assert.equal(own.status.familiaId, 1); assert.ok(own.status.joinedAt > 0);
    assert.equal(own.status.canReceiveFirstReward, false);
    assert.deepEqual(own.familia, { id: 1, ...settings, contributionPoint: 0, valis: 0, skillPoint: 0,
      bgmId: 0, backgroundImageId: 0, purchasedProduct: [] });
    assert.deepEqual(own.members, [{ userId: seed.userId, rank: 3, name: 'Owner', description: 'Saved introduction',
      totalStatusPoint: 1234, lastLoginedAt: 1790950000, post: 3, contributionPoint: 0,
      leaderPc: { pcId: 1011001001, jobRank: 3, level: 38, heroSublimateLevel: 1, isUnlockedHeroSublimate: true } }]);
    assert.equal((await inviteSearch({ searchType: 0, limit: 1 })).status, 503,
      'An unpaid Familia creation cannot search for invitation candidates');
    assert.equal((await inviteSend({ userId: firstCpuId })).status, 503,
      'An unpaid Familia creation cannot send an invitation');
    assert.equal((await receivedJoinList({ userId:seed.userId })).status,503,
      'An unpaid Familia creation cannot receive join applications');
    const nameRequest = { name: '家族' }, optionRequest = { style: 21000001, requireApproval: false };
    const nameResponse = await byName(nameRequest), nameSequence = sequence;
    const optionResponse = await byOption(optionRequest), optionSequence = sequence;
    const nameReplay = () => request(port, nameSequence, nameRequest, String(nameSequence), 'familia/search/name');
    const optionReplay = () => request(port, optionSequence, optionRequest, String(optionSequence), 'familia/search/option');
    assert.deepEqual(parse(nameResponse), searchFor(own));
    assert.deepEqual(parse(optionResponse), searchFor(own));
    assert.equal((await request(port, emptySearchSequence, {}, String(emptySearchSequence), 'familia/search/option')).status, 503,
      'An empty cached search cannot hide a newly created local group');
    for (const name of ['', 'Local', '家族', settings.name]) assert.deepEqual(parse(await byName({ name })), searchFor(own));
    for (const name of ['local', '%', '_', 'Local.*', 'Other'])
      assert.deepEqual(parse(await byName({ name })), { code: 0, familias: [] }, 'Names are literal and case-sensitive');
    for (const value of [{}, { style: 21000001 }, { requireApproval: false }])
      assert.deepEqual(parse(await byOption(value)), searchFor(own));
    for (const style of master.familiaStyleIds)
      assert.deepEqual(parse(await byOption({ style })), style === settings.style ? searchFor(own) : { code: 0, familias: [] });
    for (const value of [{ style: 21000002 }, { requireApproval: true }, { style: 21000001, requireApproval: true }])
      assert.deepEqual(parse(await byOption(value)), { code: 0, familias: [] }, 'Both filters must match');
    const detailResponse = await send(detailValue, 'familia/get'), detailSequence = sequence;
    assert.deepEqual(parse(detailResponse), detailsFor(own));
    const detailReplay = () => request(port, detailSequence, detailValue, String(detailSequence), 'familia/get');
    const visits = app.store.db.prepare('SELECT * FROM familia_home_login').all();
    const saved = app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all();
    assert.deepEqual(await getDetails(), detailsFor(own));
    assert.deepEqual((await detailReplay()).body, detailResponse.body);
    assert.equal((await send({ familiaId: 2 }, 'familia/get')).status, 503, 'Remote guilds stay unavailable');
    assert.deepEqual(app.store.db.prepare('SELECT * FROM familia_home_login').all(), visits, 'Viewing members is not a page-login reward');
    assert.deepEqual(app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all(), saved);
    assert.deepEqual(app.store.operations(), [operation], 'Viewing members neither spends nor ACKs creation');
    assert.deepEqual(parse(await byOption({})), searchFor(own));
    assert.deepEqual(parse(await byName(nameRequest)), searchFor(own));
    assert.deepEqual(app.store.db.prepare('SELECT * FROM familia_home_login').all(), visits, 'Search must not earn a home-login day');
    assert.deepEqual(app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all(), saved);
    assert.deepEqual(app.store.operations(), [operation], 'Search neither credits rewards nor ACKs creation');
    for (const change of [{ godId: 0 }, { style: 0 }, { activeTime: 0 }, { subStyle: 1 },
      { subActiveTime: -1 }, { requireApproval: 1 }, { id: 2 }]) {
      app.store.db.prepare('UPDATE local_familia SET settings=?').run(JSON.stringify({ ...settings, ...change }));
      assert.equal((await send(detailValue, 'familia/get')).status, 400, 'Corrupt settings must not reach native lookups');
      assert.equal((await send({}, 'familia/mystatus')).status, 400, 'Both views use the same original settings guard');
      assert.equal((await byOption({})).status, 400, 'Search validates saved settings before delivering original IDs');
    }
    app.store.db.prepare('UPDATE local_familia SET settings=?').run(JSON.stringify(settings));
    for (const column of ['contribution_point','valis','skill_point']) {
      for (const value of [-1, 0x80000000]) {
        app.store.db.prepare(`UPDATE local_familia SET ${column}=?`).run(value);
        assert.equal((await send(detailValue, 'familia/get')).status, 400, 'Invalid int32 display counters must not wrap');
        assert.equal((await send({}, 'familia/mystatus')).status, 400);
        assert.equal((await byName({ name: '' })).status, 400);
      }
      app.store.db.prepare(`UPDATE local_familia SET ${column}=0`).run();
    }
    const memberStatus = app.store.read('UserStatus').data;
    put('UserStatus', memberStatus.map(row => ({ ...row, lastLoginedAt: row.lastLoginedAt + 1 })));
    assert.equal((await detailReplay()).status, 503, 'Cached details cannot overwrite newer member activity');
    put('UserStatus', memberStatus);
    const lastSequence = app.store.lastSequence();
    app.store.db.exec("CREATE TRIGGER fail_detail BEFORE INSERT ON reply_cache WHEN NEW.action='familia/get' BEGIN SELECT RAISE(ABORT,'detail reply rollback'); END");
    assert.equal((await send(detailValue, 'familia/get')).status, 503);
    assert.equal(app.store.lastSequence(), lastSequence);
    assert.deepEqual(app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all(), saved);
    app.store.db.exec('DROP TRIGGER fail_detail');
    const searchSequence = app.store.lastSequence();
    app.store.db.exec("CREATE TRIGGER fail_search BEFORE INSERT ON reply_cache WHEN NEW.action='familia/search/option' BEGIN SELECT RAISE(ABORT,'search reply rollback'); END");
    assert.equal((await byOption({})).status, 503);
    assert.equal(app.store.lastSequence(), searchSequence);
    assert.deepEqual(app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all(), saved);
    assert.deepEqual(app.store.operations(), [operation]);
    app.store.db.exec('DROP TRIGGER fail_search');
    await rejectMalformedLeader('familia/mystatus');
    await rejectMalformedLeader('familia/get');
    assert.deepEqual(await getStatus(), own);
    assert.deepEqual(await getDetails(), detailsFor(own));
    assert.equal((await send({ familiaId: 1, ...settings }, 'familia/manage/change/info')).status, 400,
      'A settings edit cannot invalidate an unpaid creation receipt');
    assert.equal((await send({ familiaId: 1, godId: 20000002 }, 'familia/manage/change/god')).status, 400);
    assert.equal((await send(save({}, [operation]), 'user_data/push')).status, 400, 'Bare ACK cannot erase the creation charge');
    for (const change of [{ amount: 100001 }, { userId: 2 }, { cumulativeAmount: 0 },
      { amount: 0x80000000, cumulativeAmount: 0x80000000 + 150000 }, { cumulativeAmount: 2000000001 }]) {
      assert.equal((await send(save({ UserCurrency: [{ ...currency, amount: 100000, ...change }] }, [operation]), 'user_data/push')).status, 400);
      assert.deepEqual(app.store.read('UserCurrency').data, [currency]);
    }
    await close(); await open();
    assert.deepEqual(await getStatus(), own); assert.deepEqual(app.store.operations(), [operation]);
    assert.deepEqual((await detailReplay()).body, detailResponse.body, 'Unchanged member details survive restart');
    assert.deepEqual((await nameReplay()).body, nameResponse.body, 'Unchanged name-search replay survives restart');
    assert.deepEqual((await optionReplay()).body, optionResponse.body, 'Unchanged filtered-search replay survives restart');
    const replay = await request(port, originalSequence, settings, String(originalSequence), 'familia/create');
    assert.equal(replay.status, 200); assert.deepEqual(replay.body, response.body);
    // The native save can commit before its ACK. An earned 50 Valis in the
    // same delta must not be confused with an unpaid creation charge.
    const paid = { ...currency, amount: 100050, cumulativeAmount: 250050 };
    parse(await send(save({ UserCurrency: [paid] }), 'user_data/push'));
    await close(); await open();
    assert.equal((await send(settings)).status,503,'A saved creation cost must not be replayed before its real ACK');
    assert.deepEqual(app.store.operations(),[operation]);
    parse(await send(save({}, [operation]), 'user_data/push'));
    own.status.canReceiveFirstReward = true; own.existsFamiliaFirstReward = true;
    assert.deepEqual(parse(await send(settings)), { code: 0, result: 0, operations: [] });
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`${originalSequence}/${originalSequence}`);
    assert.deepEqual(parse(await request(port,originalSequence,settings,String(originalSequence),'familia/create')),
      {code:0,result:0,operations:[]},'The original creation identity settles without reissuing its paid operation');
    assert.deepEqual(app.store.read('UserCurrency').data, [paid]);
    assert.deepEqual(app.store.operations(), []); assert.equal(count(), 1);
    // WRITTEN ONLY / NOT RUN: exact1b17a0c selector pairs and1b36644 row shape.
    const inviteProfiles = app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all();
    const oneRequest = { searchType: 0, limit: 1 }, oneResponse = await inviteSearch(oneRequest), oneSequence = sequence;
    const one = parse(oneResponse), expectedCpuCount = Object.keys(master.underPvp.dummyUnderPvpParty).length;
    assert.equal(one.code, 0); assert.equal(one.users.length, 1);
    assert.deepEqual(Object.keys(one.users[0]).sort(),
      ['description','lastLoginedAt','leaderPc','name','rank','totalStatusPoint','userId'].sort());
    assert.deepEqual(Object.keys(one.users[0].leaderPc).sort(),
      ['heroSublimateLevel','isUnlockedHeroSublimate','jobRank','level','pcId'].sort());
    assert.notEqual(one.users[0].userId, seed.userId); assert.match(one.users[0].name, / \[Offline CPU\]$/);
    const ranked1000 = parse(await inviteSearch({ searchType: 1, limit: 1000 }));
    const ranked10000 = parse(await inviteSearch({ searchType: 1, limit: 10000 }));
    const status1000 = parse(await inviteSearch({ searchType: 2, limit: 1000 }));
    const status10000 = parse(await inviteSearch({ searchType: 2, limit: 10000 }));
    for (const result of [ranked1000,ranked10000,status1000,status10000]) {
      assert.equal(result.code, 0); assert.equal(result.users.length, expectedCpuCount);
      assert.equal(new Set(result.users.map(row => row.userId)).size, expectedCpuCount);
      assert.ok(result.users.every(row => row.userId !== seed.userId && row.name.endsWith(' [Offline CPU]') &&
        Number.isSafeInteger(row.rank) && row.rank > 0 && Number.isSafeInteger(row.totalStatusPoint) &&
        row.totalStatusPoint >= 0 && Number.isSafeInteger(row.leaderPc.pcId) && row.leaderPc.pcId > 0));
    }
    assert.deepEqual(ranked1000.users, ranked10000.users); assert.deepEqual(status1000.users, status10000.users);
    assert.deepEqual(ranked1000.users, [...ranked1000.users].sort((a,b) => b.rank-a.rank || a.userId-b.userId));
    assert.deepEqual(status1000.users, [...status1000.users]
      .sort((a,b) => b.totalStatusPoint-a.totalStatusPoint || a.userId-b.userId));
    assert.equal(one.users[0].userId, Math.min(...ranked1000.users.map(row => row.userId)));
    for (const value of [undefined,null,{},[],{ searchType: 0, limit: 1000 },{ searchType: 1, limit: 1 },
      { searchType: 2, limit: 10000, extra: true },{ searchType: '1', limit: 1000 },
      { searchType: 1, limit: '1000' },{ searchType: -1, limit: 1000 }])
      assert.equal((await inviteSearch(value)).status, 400, JSON.stringify(value));
    assert.deepEqual((await request(port, oneSequence, oneRequest, String(oneSequence), 'familia/invite/search')).body,
      oneResponse.body, 'Unchanged invitation candidate search replays exact bytes');
    assert.deepEqual(app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all(), inviteProfiles);
    assert.deepEqual(app.store.operations(), [], 'Invitation candidate search is read-only');
    // WRITTEN ONLY / NOT RUN:252664c request and2527358/2526e44 applicant shape.
    const expectedApplicant=[...ranked1000.users].sort((a,b)=>a.userId-b.userId)[2],
      receivedBeforeSequence=app.store.lastSequence();
    app.store.db.exec("CREATE TRIGGER fail_received_join BEFORE INSERT ON familia_join_received_application BEGIN SELECT RAISE(ABORT,'received join rollback'); END");
    assert.equal((await receivedJoinList({userId:seed.userId})).status,503);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_join_received_application').get().n,0);
    assert.equal(app.store.lastSequence(),receivedBeforeSequence,'Applicant row and request sequence roll back together');
    app.store.db.exec('DROP TRIGGER fail_received_join');
    const receivedResponse=await receivedJoinList({userId:seed.userId}),receivedSequence=sequence;
    assert.deepEqual(parse(receivedResponse),{code:0,requests:[expectedApplicant]});
    const receivedApplication=app.store.db.prepare('SELECT * FROM familia_join_received_application').get();
    assert.equal(receivedApplication.state,0); assert.ok(receivedApplication.requested_at>0);
    assert.deepEqual(JSON.parse(receivedApplication.candidate_json),expectedApplicant);
    for(const value of [undefined,null,{},[],0,false,'',{userId:0},{userId:-1},{userId:'1'},
      {userId:1.5},{userId:seed.userId+1},{userId:seed.userId,extra:true}])
      assert.equal((await receivedJoinList(value)).status,400,JSON.stringify(value));
    assert.deepEqual((await request(port,receivedSequence,{userId:seed.userId},String(receivedSequence),
      'familia/join/list/recieved')).body,receivedResponse.body,'Received applicant list replays exact bytes');
    app.store.db.prepare('UPDATE familia_join_received_application SET candidate_json=?').run('{}');
    assert.equal((await receivedJoinList({userId:seed.userId})).status,503,'Corrupt applicant snapshots are retained and refused');
    app.store.db.prepare('UPDATE familia_join_received_application SET candidate_json=?').run(receivedApplication.candidate_json);
    app.store.db.prepare('UPDATE familia_join_received_application SET state=1').run();
    assert.equal((await request(port,receivedSequence,{userId:seed.userId},String(receivedSequence),
      'familia/join/list/recieved')).status,503,'A cached pending applicant cannot survive a lifecycle change');
    const terminalReceived=await receivedJoinList({userId:seed.userId}),terminalReceivedSequence=sequence;
    assert.deepEqual(parse(terminalReceived),{code:0,requests:[]});
    app.store.db.prepare('UPDATE familia_join_received_application SET state=0').run();
    assert.equal((await request(port,terminalReceivedSequence,{userId:seed.userId},String(terminalReceivedSequence),
      'familia/join/list/recieved')).status,503,'A cached terminal list cannot hide a restored pending applicant');
    await close(); await open();
    assert.deepEqual((await request(port,receivedSequence,{userId:seed.userId},String(receivedSequence),
      'familia/join/list/recieved')).body,receivedResponse.body,'Received applicant identity survives restart');
    assert.deepEqual(app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all(),inviteProfiles);
    assert.deepEqual(app.store.operations(),[],'Receiving an application creates no native reward or currency operation');
    // WRITTEN ONLY / NOT RUN:1b12c34 cases1/2 and final callback1b28ca4.
    for(const value of [undefined,null,{},[],0,false,'',{userId:expectedApplicant.userId},
      {approve:false},{userId:0,approve:false},{userId:-1,approve:false},
      {userId:'1',approve:false},{userId:1.5,approve:false},{userId:expectedApplicant.userId,approve:0},
      {userId:expectedApplicant.userId+1,approve:false},{userId:expectedApplicant.userId,approve:false,extra:true}])
      assert.equal((await joinApprove(value)).status,400,JSON.stringify(value));
    const rejectBeforeSequence=app.store.lastSequence();
    app.store.db.exec("CREATE TRIGGER fail_join_approve BEFORE INSERT ON familia_join_approve_request BEGIN SELECT RAISE(ABORT,'join approval rollback'); END");
    assert.equal((await joinApprove({userId:expectedApplicant.userId,approve:false})).status,503);
    assert.equal(app.store.db.prepare('SELECT state FROM familia_join_received_application').get().state,0,
      'Failed decision receipt must roll back the applicant transition');
    assert.equal(app.store.lastSequence(),rejectBeforeSequence);
    app.store.db.exec('DROP TRIGGER fail_join_approve');
    const rejectRequest={userId:expectedApplicant.userId,approve:false},rejectResponse=await joinApprove(rejectRequest),
      rejectSequence=sequence;
    assert.deepEqual(parse(rejectResponse),{code:0,result:0});
    assert.equal(app.store.db.prepare('SELECT state FROM familia_join_received_application').get().state,2);
    assert.equal(app.store.db.prepare('SELECT approve FROM familia_join_approve_request').get().approve,0);
    assert.deepEqual(parse(await receivedJoinList({userId:seed.userId})),{code:0,requests:[]});
    assert.equal((await request(port,receivedSequence,{userId:seed.userId},String(receivedSequence),
      'familia/join/list/recieved')).status,503,'A cached pending list cannot restore a rejected applicant');
    assert.notEqual((await joinApprove({userId:expectedApplicant.userId,approve:true})).status,200,
      'A rejected applicant cannot be approved by a new request');
    app.store.db.prepare('DELETE FROM reply_cache WHERE action=? AND key=?')
      .run('familia/join/approve',`${rejectSequence}/${rejectSequence}`);
    const rejectedReceipt=app.store.db.prepare('SELECT * FROM familia_join_approve_request WHERE request_key=?')
      .get(`${rejectSequence}/${rejectSequence}`);
    app.store.db.prepare('UPDATE familia_join_approve_request SET body_hash=? WHERE request_key=?')
      .run('corrupt',rejectedReceipt.request_key);
    assert.equal((await request(port,rejectSequence,rejectRequest,String(rejectSequence),'familia/join/approve')).status,503,
      'Corrupt decision receipts are retained and refused');
    app.store.db.prepare('UPDATE familia_join_approve_request SET body_hash=? WHERE request_key=?')
      .run(rejectedReceipt.body_hash,rejectedReceipt.request_key);
    assert.deepEqual((await request(port,rejectSequence,rejectRequest,String(rejectSequence),'familia/join/approve')).body,
      rejectResponse.body,'Rejected decision survives reply-cache loss');
    await close(); await open();
    assert.deepEqual((await request(port,rejectSequence,rejectRequest,String(rejectSequence),'familia/join/approve')).body,
      rejectResponse.body,'Rejected decision survives restart');
    assert.deepEqual((await getStatus()).members,own.members,'Rejecting an applicant does not add a member');
    // WRITTEN ONLY / NOT RUN:1b17de8 request and1b37368 result0 persist one
    // pending outbound invitation without pretending the offline CPU accepted.
    const sendRequest = { userId:one.users[0].userId }, sendResponse = await inviteSend(sendRequest), sendSequence = sequence;
    assert.deepEqual(parse(sendResponse), { code:0,result:0 });
    const invitation = app.store.db.prepare('SELECT * FROM familia_invitation WHERE creation_operation_id=? AND user_id=?')
      .get(app.store.db.prepare('SELECT creation_operation_id FROM local_familia WHERE id=1').get().creation_operation_id,
        sendRequest.userId);
    assert.equal(invitation.state,0); assert.ok(invitation.invited_at>0);
    assert.deepEqual(JSON.parse(invitation.candidate_json),one.users[0]);
    assert.deepEqual(parse(await inviteSend(sendRequest)),{ code:0,result:0 },'A new retry aliases the pending invitation');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_invitation WHERE user_id=?').get(sendRequest.userId).n,1);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_invitation_request WHERE user_id=?').get(sendRequest.userId).n,2);
    for(const value of [undefined,null,{},[],{userId:0},{userId:-1},{userId:'1'},
      {userId:1.5},{userId:0x80000000},{userId:sendRequest.userId,extra:true},{userId:2147483647}])
      assert.equal((await inviteSend(value)).status,400,JSON.stringify(value));
    app.store.db.prepare('DELETE FROM reply_cache WHERE action=? AND key=?')
      .run('familia/invite/send',`${sendSequence}/${sendSequence}`);
    assert.deepEqual((await request(port,sendSequence,sendRequest,String(sendSequence),'familia/invite/send')).body,
      sendResponse.body,'Durable invitation identity survives reply-cache loss');
    const secondCpuId=ranked1000.users.find(row=>row.userId!==sendRequest.userId).userId,
      invitationCount=app.store.db.prepare('SELECT COUNT(*) n FROM familia_invitation').get().n;
    app.store.db.exec("CREATE TRIGGER fail_invitation_request BEFORE INSERT ON familia_invitation_request BEGIN SELECT RAISE(ABORT,'invitation rollback'); END");
    assert.equal((await inviteSend({userId:secondCpuId})).status,503);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_invitation').get().n,invitationCount,
      'Invitation and request rows roll back together');
    app.store.db.exec('DROP TRIGGER fail_invitation_request');
    assert.deepEqual(app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all(),inviteProfiles);
    assert.deepEqual(app.store.operations(),[],'Sending an invitation has no native reward or currency operation');
    assert.deepEqual(parse(await invitedList()),emptyInvitations,
      'An outbound CPU invitation is not an inbound invitation to the local account');
    assert.equal((await request(port,incomingSequence,null,String(incomingSequence),'familia/invited/list')).status,503,
      'The pre-accept invitation list cannot replay after membership changes');
    const emptyFeed = { code: 0, messages: [] };
    assert.deepEqual(parse(await send({ familiaId: 1 }, 'familia/msg_board/feed')), emptyFeed);
    for (const bad of [undefined, {}, { familiaId: 2 }, { familiaId: '1' }, { familiaId: 1, page: 0 }])
      assert.equal((await send(bad, 'familia/msg_board/feed')).status, 400);
    assert.deepEqual(app.store.read('UserCurrency').data, [paid]);
    assert.deepEqual(app.store.operations(), [], 'An empty board does not create mutations or fake posts');
    await close(); await open();
    assert.deepEqual(parse(await send({ familiaId: 1 }, 'familia/msg_board/feed')), emptyFeed);
    assert.deepEqual(await getStatus(), own); assert.deepEqual(app.store.read('UserCurrency').data, [paid]);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_invitation WHERE user_id=? AND state=0')
      .get(sendRequest.userId).n,1,'Pending outbound invitation survives restart');
    assert.deepEqual(parse(await invitedList()),emptyInvitations,'Incoming invitation view remains empty after restart');
    parse(await send(save({}, [operation]), 'user_data/push'));
    assert.deepEqual(app.store.read('UserCurrency').data, [paid], 'Repeated ACK must not spend twice');
    const stampId = 63000000001, backgroundId = 63000000014, otherBackgroundId = 63000000015,
      musicId = 63000000024;
    const buy = id => send({ familiaId: 1, familiaShopId: id }, 'familia/shop/item/buy');
    const set = id => send({ familiaId: 1, familiaShopId: id }, 'familia/shop/item/set');
    app.store.db.prepare('UPDATE local_familia SET valis=? WHERE id=1').run(25000000);
    const defaults = Object.entries(master.familiaShops).filter(([,row]) => row.isDefault);
    assert.equal(defaults.length, 2);
    for (const [id] of defaults) {
      assert.equal((await buy(Number(id))).status, 400, 'Original default themes must not be charged');
      assert.deepEqual(parse(await set(Number(id))), { code: 0, familiaShopId: Number(id) });
    }
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_shop_purchase').get().n, 0);
    assert.equal(app.store.db.prepare('SELECT valis FROM local_familia WHERE id=1').get().valis, 25000000,
      'Selecting authored defaults must not create a purchase or debit');
    const defaultsStatus = await getStatus();
    await close(); await open();
    assert.deepEqual(await getStatus(), defaultsStatus, 'Authored defaults must survive restart without being purchased');
    assert.equal((await send({ familiaId: '1', familiaShopId: stampId }, 'familia/shop/item/buy')).status, 400);
    assert.equal((await send({ familiaId: 2, familiaShopId: stampId }, 'familia/shop/item/buy')).status, 400);
    app.store.db.exec("CREATE TRIGGER fail_familia_shop BEFORE INSERT ON familia_shop_purchase BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
    assert.notEqual((await buy(stampId)).status, 200);
    assert.equal(app.store.db.prepare('SELECT valis FROM local_familia WHERE id=1').get().valis, 25000000,
      'Failed ownership write must roll back the Familia Valis debit');
    app.store.db.exec('DROP TRIGGER fail_familia_shop');
    app.store.db.exec("CREATE TRIGGER fail_familia_shop_reply BEFORE INSERT ON reply_cache WHEN NEW.action='familia/shop/item/buy' BEGIN SELECT RAISE(ABORT, 'test reply rollback'); END");
    assert.equal((await buy(stampId)).status, 503);
    assert.equal(app.store.db.prepare('SELECT valis FROM local_familia WHERE id=1').get().valis, 25000000);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_shop_purchase').get().n, 0,
      'Reply persistence failure must roll back both purchase and debit');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_shop_request').get().n,defaults.length,
      'Reply persistence failure must roll back the durable shop request too');
    app.store.db.exec('DROP TRIGGER fail_familia_shop_reply');
    const stampResponse = await buy(stampId), stampSequence = sequence;
    assert.deepEqual(parse(stampResponse), { code: 0, result: 0, valis: 20000000, purchasedProduct: [stampId] });
    assert.equal((await buy(stampId)).status, 400, 'A fresh duplicate purchase must not spend twice');
    assert.deepEqual(parse(await buy(backgroundId)), { code: 0, result: 0, valis: 10000000,
      purchasedProduct: [stampId, backgroundId] });
    assert.deepEqual(parse(await buy(musicId)), { code: 0, result: 0, valis: 5000000,
      purchasedProduct: [stampId, backgroundId, musicId] });
    assert.equal((await buy(otherBackgroundId)).status, 400, 'Insufficient Familia Valis must reject');
    assert.equal((await set(stampId)).status, 400, 'Stamps are owned but are not selectable themes');
    assert.equal((await set(otherBackgroundId)).status, 400, 'Unowned themes must reject');
    assert.equal((await set(999)).status, 400, 'Unknown themes must reject');
    app.store.db.exec("CREATE TRIGGER fail_familia_setting BEFORE INSERT ON familia_shop_setting BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
    assert.notEqual((await set(backgroundId)).status, 200);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_shop_setting').get().n, 2);
    app.store.db.exec('DROP TRIGGER fail_familia_setting');
    assert.deepEqual(parse(await set(backgroundId)), { code: 0, familiaShopId: backgroundId });
    const setResponse = await set(musicId), setSequence = sequence;
    assert.deepEqual(parse(setResponse), { code: 0, familiaShopId: musicId });
    const themed = await getStatus();
    assert.deepEqual(themed.familia, { ...own.familia, valis: 5000000,
      bgmId: master.familiaShops[musicId].rewardId,
      backgroundImageId: master.familiaShops[backgroundId].rewardId,
      purchasedProduct: [stampId, backgroundId, musicId] });
    assert.deepEqual(await getDetails(), detailsFor(themed));
    assert.equal((await detailReplay()).status, 503, 'Old public details cannot reset newer themes or balances');
    const stampKey=`${stampSequence}/${stampSequence}`,setKey=`${setSequence}/${setSequence}`,
      stampCache=app.store.db.prepare('SELECT * FROM reply_cache WHERE key=?').get(stampKey),
      setCache=app.store.db.prepare('SELECT * FROM reply_cache WHERE key=?').get(setKey),
      stampReceipt=app.store.db.prepare('SELECT * FROM familia_shop_request WHERE request_key=?').get(stampKey),
      stampHash=stampReceipt.body_hash,
      setHash=app.store.db.prepare('SELECT body_hash FROM familia_shop_request WHERE request_key=?').get(setKey).body_hash;
    assert.equal((await request(port,stampSequence,{familiaId:1,familiaShopId:backgroundId},String(stampSequence),
      'familia/shop/item/buy',{'X-ARGO-REQUEST-BODY-HASH':stampHash})).status,400,
    'A forged header cannot redirect a purchase receipt to different body bytes');
    assert.equal((await request(port,setSequence,{familiaId:1,familiaShopId:backgroundId},String(setSequence),
      'familia/shop/item/set',{'X-ARGO-REQUEST-BODY-HASH':setHash})).status,400,
    'A forged header cannot redirect a theme receipt to different body bytes');
    app.store.db.prepare('DELETE FROM reply_cache WHERE key IN (?,?)').run(stampKey,setKey);
    await close(); await open();
    assert.deepEqual(await getStatus(), themed, 'Familia shop ownership, selection and balance must survive restart');
    assert.deepEqual(await getDetails(), detailsFor(themed));
    const shopReplay = await request(port, stampSequence, { familiaId: 1, familiaShopId: stampId },
      String(stampSequence), 'familia/shop/item/buy');
    assert.equal(shopReplay.status, 200); assert.deepEqual(shopReplay.body, stampResponse.body);
    assert.equal(app.store.db.prepare('SELECT valis FROM local_familia WHERE id=1').get().valis, 5000000,
      'Transport replay must not spend twice');
    const setReplay = await request(port, setSequence, { familiaId: 1, familiaShopId: musicId },
      String(setSequence), 'familia/shop/item/set');
    assert.deepEqual(setReplay.body, setResponse.body,
      'A durable theme receipt survives generic reply-cache loss and restart');
    app.store.db.prepare('UPDATE familia_shop_request SET response=? WHERE request_key=?')
      .run('{"code":0,"result":0,"valis":1,"purchasedProduct":[]}',stampKey);
    assert.equal((await request(port,stampSequence,{familiaId:1,familiaShopId:stampId},String(stampSequence),
      'familia/shop/item/buy')).status,503,'A damaged durable purchase response cannot be replayed');
    app.store.db.prepare('UPDATE familia_shop_request SET response=? WHERE request_key=?')
      .run(stampReceipt.response,stampKey);
    const defaultMusicId=Number(defaults.find(([id,row])=>row.type===3)[0]);
    parse(await set(defaultMusicId));
    assert.equal((await request(port,setSequence,{familiaId:1,familiaShopId:musicId},String(setSequence),
      'familia/shop/item/set')).status,503,'A later same-type selection invalidates the older exact set receipt');
    parse(await set(musicId));
    assert.deepEqual(await getStatus(),themed,'Restoring the owned theme leaves the saved purchase state unchanged');
    // Preserve a pre-fix purchase instead of replaying its native null-number crash.
    app.store.db.prepare('DELETE FROM familia_shop_request WHERE request_key=?').run(stampKey);
    app.store.db.prepare(`INSERT INTO reply_cache(key,action,body_hash,content_type,body) VALUES(?,?,?,?,?)`)
      .run(stampCache.key,stampCache.action,stampCache.body_hash,stampCache.content_type,stampCache.body);
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(
      Buffer.from(JSON.stringify({ code: 0, purchasedProduct: [stampId] })).toString('base64'),
      stampKey);
    await close(); await open();
    assert.equal((await request(port, stampSequence, { familiaId: 1, familiaShopId: stampId },
      String(stampSequence), 'familia/shop/item/buy')).status, 503);
    assert.deepEqual(await getStatus(), themed, 'Legacy crash recovery must retain all purchases and their balance');
    app.store.db.prepare('DELETE FROM familia_shop_request WHERE request_key=?').run(setKey);
    app.store.db.prepare(`INSERT INTO reply_cache(key,action,body_hash,content_type,body) VALUES(?,?,?,?,?)`)
      .run(setCache.key,setCache.action,setCache.body_hash,setCache.content_type,setCache.body);
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(
      Buffer.from('{"code":0}').toString('base64'), setKey);
    assert.equal((await request(port, setSequence, { familiaId: 1, familiaShopId: musicId },
      String(setSequence), 'familia/shop/item/set')).status, 503);
    assert.deepEqual(await getStatus(), themed, 'Legacy theme reply must not reset the selection');
    app.store.db.prepare('UPDATE familia_shop_purchase SET price=price+1 WHERE familia_shop_id=?').run(stampId);
    assert.equal((await send({}, 'familia/mystatus')).status, 400, 'Unknown saved purchase terms must not become fake ownership');
    assert.equal((await send(detailValue, 'familia/get')).status, 400);
    assert.equal(app.store.db.prepare('SELECT valis FROM local_familia WHERE id=1').get().valis, 5000000);
    app.store.db.prepare('UPDATE familia_shop_purchase SET price=? WHERE familia_shop_id=?')
      .run(master.familiaShops[stampId].price, stampId);
    const edit = value => send(value, 'familia/manage/change/info');
    const changeGod = value => send(value, 'familia/manage/change/god');
    const editBody = { familiaId: 1, ...settings, name: 'Changed家', description: 'Edited locally.',
      style: 21000005, subStyle: 21000002, activeTime: 22000012, subActiveTime: 0, requireApproval: true };
    const familiaBefore = { ...app.store.db.prepare('SELECT * FROM local_familia WHERE id=1').get() };
    for (const body of [undefined, {}, { ...editBody, familiaId: '1' }, { ...editBody, familiaId: 2 },
      { ...editBody, name: '' }, { ...editBody, name: '12345678901' }, { ...editBody, name: ' padded' },
      { ...editBody, name: 'One\nTwo' }, { ...editBody, description: '' },
      { ...editBody, description: 'x'.repeat(121) }, { ...editBody, description: 'x\n'.repeat(6) },
      { ...editBody, godId: '20000001' }, { ...editBody, godId: 0 }, { ...editBody, style: 0 },
      { ...editBody, subStyle: 1 }, { ...editBody, activeTime: 0 }, { ...editBody, subActiveTime: -1 },
      { ...editBody, requireApproval: 1 }, { ...editBody, contributionPoint: 5000 }])
      assert.equal((await edit(body)).status, 400, JSON.stringify(body));
    for (const body of [undefined, {}, { familiaId: '1', godId: 20000002 }, { familiaId: 2, godId: 20000002 },
      { familiaId: 1, godId: 0 }, { familiaId: 1, godId: '20000002' },
      { familiaId: 1, godId: 20000002, name: 'Extra' }])
      assert.equal((await changeGod(body)).status, 400, JSON.stringify(body));
    assert.deepEqual({ ...app.store.db.prepare('SELECT * FROM local_familia WHERE id=1').get() }, familiaBefore);
    app.store.db.exec("CREATE TRIGGER fail_familia_edit BEFORE UPDATE ON local_familia BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
    assert.equal((await edit(editBody)).status, 503);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_name_history').get().n, 0,
      'A failed settings write must roll back the previous-name record');
    assert.deepEqual(await getStatus(), themed);
    app.store.db.exec('DROP TRIGGER fail_familia_edit');
    app.store.db.exec("CREATE TRIGGER fail_familia_edit_reply BEFORE INSERT ON reply_cache WHEN NEW.action='familia/manage/change/info' BEGIN SELECT RAISE(ABORT, 'test reply rollback'); END");
    assert.equal((await edit(editBody)).status,503);
    assert.deepEqual({ ...app.store.db.prepare('SELECT * FROM local_familia WHERE id=1').get() },familiaBefore,
      'Reply failure must roll back the settings and their revision');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_setting_request').get().n,0,
      'Reply failure must roll back the permanent settings receipt');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_name_history').get().n,0,
      'Reply failure must roll back the previous-name history');
    app.store.db.exec('DROP TRIGGER fail_familia_edit_reply');
    const editedResponse = await edit(editBody), editedSequence = sequence;
    assert.deepEqual(parse(editedResponse), { code: 0, result: 0 });
    assert.equal((await request(port,originalSequence,settings,String(originalSequence),'familia/create')).status,503,
      'A pre-rename creation callback cannot restore its submitted settings');
    assert.equal(app.store.db.prepare('SELECT settings_revision FROM local_familia WHERE id=1').get().settings_revision,1);
    const { familiaId, ...editedSettings } = editBody;
    const expectedEdited = { ...themed, familia: { ...themed.familia, ...editedSettings } };
    assert.deepEqual(await getDetails(), detailsFor(expectedEdited));
    assert.equal((await nameReplay()).status, 503, 'An old name result cannot restore renamed Familia settings');
    assert.equal((await optionReplay()).status, 503, 'Old filters cannot restore changed settings');
    assert.deepEqual(parse(await byName(nameRequest)), { code: 0, familias: [] });
    for (const value of [{}, { style: 21000005 }, { style: 21000002 }, { requireApproval: true },
      { style: 21000002, requireApproval: true }]) assert.deepEqual(parse(await byOption(value)), searchFor(expectedEdited));
    assert.deepEqual(parse(await byOption(optionRequest)), { code: 0, familias: [] });
    // Native can save an older UserProfile label after the authoritative edit.
    const currentProfile = app.store.read('UserProfile').data[0];
    parse(await send(save({ UserProfile: [{ ...currentProfile, familiaName: settings.name }] }), 'user_data/push'));
    assert.deepEqual(await getStatus(), expectedEdited, 'Delayed pre-rename save must not lock the Familia');
    assert.deepEqual(parse(await edit(editBody)), { code: 0, result: 0 }, 'New-request retry remains idempotent');
    const changedGod = { ...expectedEdited, familia: { ...expectedEdited.familia } };
    let godReplayBody,godReplayResponse,godReplaySequence;
    for (const godId of master.familiaGodIds) {
      const godBody={familiaId:1,godId},godResponse=await changeGod(godBody),didChange=godId!==changedGod.familia.godId;
      assert.deepEqual(parse(godResponse), { code: 0, result: 0 });
      if(didChange && !godReplayBody) {
        godReplayBody=godBody;godReplayResponse=godResponse;godReplaySequence=sequence;
      }
      changedGod.familia.godId = godId;
      assert.deepEqual(await getStatus(), changedGod, 'God edit must preserve every other setting and theme');
      assert.deepEqual(await getDetails(), detailsFor(changedGod));
    }
    const editKey=`${editedSequence}/${editedSequence}`,godKey=`${godReplaySequence}/${godReplaySequence}`,
      editHash=app.store.db.prepare('SELECT body_hash FROM familia_setting_request WHERE request_key=?').get(editKey).body_hash,
      godHash=app.store.db.prepare('SELECT body_hash FROM familia_setting_request WHERE request_key=?').get(godKey).body_hash;
    assert.equal((await request(port,editedSequence,{...editBody,name:'Forged'},String(editedSequence),
      'familia/manage/change/info',{'X-ARGO-REQUEST-BODY-HASH':editHash})).status,400,
    'A forged header cannot redirect an old settings receipt to changed body bytes');
    assert.equal((await request(port,godReplaySequence,{...godReplayBody,
      godId:master.familiaGodIds.find(id=>id!==godReplayBody.godId)},
      String(godReplaySequence),'familia/manage/change/god',{'X-ARGO-REQUEST-BODY-HASH':godHash})).status,400,
    'A forged header cannot redirect an old god receipt to changed body bytes');
    app.store.db.prepare('DELETE FROM reply_cache WHERE key IN (?,?)').run(editKey,godKey);
    await close(); await open();
    assert.deepEqual(await getStatus(), changedGod, 'Settings and previous names survive restart');
    const editReplay = await request(port, editedSequence, editBody, String(editedSequence), 'familia/manage/change/info');
    assert.equal(editReplay.status, 200); assert.deepEqual(editReplay.body, editedResponse.body);
    assert.deepEqual(await getStatus(), changedGod, 'An older transport replay must not undo newer settings');
    const godReplay=await request(port,godReplaySequence,godReplayBody,String(godReplaySequence),
      'familia/manage/change/god');
    assert.equal(godReplay.status,200);assert.deepEqual(godReplay.body,godReplayResponse.body);
    assert.deepEqual(await getStatus(),changedGod,'An older god retry must not restore that historical god');
    const editReceipt=app.store.db.prepare('SELECT * FROM familia_setting_request WHERE request_key=?').get(editKey);
    app.store.db.prepare('UPDATE familia_setting_request SET response=? WHERE request_key=?').run('{}',editKey);
    assert.equal((await request(port,editedSequence,editBody,String(editedSequence),
      'familia/manage/change/info')).status,503,'A damaged settings response cannot replay');
    app.store.db.prepare('UPDATE familia_setting_request SET response=? WHERE request_key=?')
      .run(editReceipt.response,editKey);
    app.store.db.prepare('UPDATE familia_setting_request SET after_settings=before_settings WHERE request_key=?')
      .run(editKey);
    assert.equal((await send({},'familia/mystatus')).status,503,
      'Status must refuse a broken settings revision chain without replacing it');
    app.store.db.prepare('UPDATE familia_setting_request SET after_settings=? WHERE request_key=?')
      .run(editReceipt.after_settings,editKey);
    assert.deepEqual(await getStatus(),changedGod,'Restored revision evidence exposes the unchanged current settings');
    const { subActiveTime, ...withoutSecondary } = { ...editBody, godId: changedGod.familia.godId };
    const noOpEditResponse=await edit(withoutSecondary),noOpEditSequence=sequence;
    assert.deepEqual(parse(noOpEditResponse), { code: 0, result: 0 });
    assert.deepEqual(await getStatus(), changedGod, 'Omitted secondary time means zero, as in the native settings copy');
    const noOpGodBody={familiaId:1,godId:changedGod.familia.godId},
      noOpGodResponse=await changeGod(noOpGodBody),noOpGodSequence=sequence;
    assert.deepEqual(parse(noOpGodResponse),{code:0,result:0});
    app.store.db.prepare('DELETE FROM familia_setting_request WHERE request_key IN (?,?)')
      .run(`${noOpEditSequence}/${noOpEditSequence}`,`${noOpGodSequence}/${noOpGodSequence}`);
    assert.equal((await request(port,noOpEditSequence,withoutSecondary,String(noOpEditSequence),
      'familia/manage/change/info')).status,503,'Legacy unreceipted settings cache must not replay');
    assert.equal((await request(port,noOpGodSequence,noOpGodBody,String(noOpGodSequence),
      'familia/manage/change/god')).status,503,'Legacy unreceipted god cache must not replay');
    assert.deepEqual(await getStatus(),changedGod,'Legacy cache refusal must preserve current settings');
    for (const change of [{ familiaName: 'Foreign' }, { familiaId: 77 }, { userId: 2 }]) {
      put('UserProfile', [{ ...currentProfile, ...change }]);
      assert.equal((await edit(editBody)).status, 503);
      assert.equal((await changeGod({ familiaId: 1, godId: 20000001 })).status, 503);
      assert.equal((await send(detailValue, 'familia/get')).status, 503);
    }
    put('UserProfile', [currentProfile]);
    assert.deepEqual(await getStatus(), changedGod);
    assert.deepEqual(await getDetails(), detailsFor(changedGod));
    const finalFamilia = { ...app.store.db.prepare('SELECT * FROM local_familia WHERE id=1').get() };
    const {settings_revision:finalSettingsRevision,settings_history_hash:finalSettingsHash,
        ...finalStableFamilia}=finalFamilia,
      {settings_revision:initialSettingsRevision,settings_history_hash:initialSettingsHash,
        ...initialStableFamilia}=familiaBefore;
    assert.ok(finalSettingsRevision>initialSettingsRevision,'Management changes advance only the settings revision');
    assert.match(finalSettingsHash,/^[0-9a-f]{32}$/,'Management changes retain an indexed rolling history proof');
    assert.equal(initialSettingsHash,'');
    assert.deepEqual({ ...finalStableFamilia, settings: initialStableFamilia.settings }, initialStableFamilia,
      'Management must not charge currency, change creation receipts, or mutate contributions');
    assert.deepEqual(app.store.read('UserCurrency').data, [paid]);
    assert.deepEqual(app.store.operations(), []);
    const beforeBreak = await byOption({}), beforeBreakSequence = sequence;
    assert.deepEqual(parse(beforeBreak), searchFor(changedGod));
    const searchSnapshot = app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all();
    const currentInfo = app.store.read('UserInfo').data;
    for (const change of [{ userId: 2 }, { name: 123 }]) {
      put('UserInfo', currentInfo.map(row => ({ ...row, ...change })));
      assert.equal((await byOption({})).status, 503, 'A foreign or corrupt owner is not a fake empty-search success');
    }
    put('UserInfo', currentInfo);
    put('UserInfo', currentInfo.map(row => ({ ...row, name: 'RenamedOwner' })));
    assert.deepEqual(parse(await byOption({})), { ...searchFor(changedGod), familias: searchFor(changedGod).familias
      .map(row => ({ ...row, master: { name: 'RenamedOwner' } })) });
    assert.equal((await request(port, beforeBreakSequence, {}, String(beforeBreakSequence), 'familia/search/option')).status, 503,
      'A cached row cannot restore an older owner name');
    put('UserInfo', currentInfo);
    assert.deepEqual(app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all(), searchSnapshot);
    parse(await send(null, 'familia/break'));
    assert.deepEqual(parse(await byOption({})), { code: 0, familias: [] });
    assert.equal((await request(port,editedSequence,editBody,String(editedSequence),
      'familia/manage/change/info')).status,503,'A dissolved membership cannot inherit an old settings receipt');
    assert.equal((await request(port,godReplaySequence,godReplayBody,String(godReplaySequence),
      'familia/manage/change/god')).status,503,'A dissolved membership cannot inherit an old god receipt');
    assert.equal((await request(port,sendSequence,sendRequest,String(sendSequence),'familia/invite/send')).status,503,
      'A dissolved Familia cannot revive an old outbound invitation');
    assert.equal((await request(port, beforeBreakSequence, {}, String(beforeBreakSequence), 'familia/search/option')).status, 503,
      'Cached searches cannot restore a disbanded group');
    const recreated = parse(await send({ ...settings, name: 'Reborn' })), newCharge = recreated.operations[0];
    parse(await send(save({ UserCurrency: [{ ...paid, amount: 0 }] }, [newCharge]), 'user_data/push'));
    assert.deepEqual(parse(await byName({ name: 'Reborn' })), searchFor(await getStatus()));
    assert.equal((await request(port, beforeBreakSequence, {}, String(beforeBreakSequence), 'familia/search/option')).status, 503,
      'The reused local ID cannot resurrect the previous search row');
    const recreatedList=await receivedJoinList({userId:seed.userId}),recreatedListSequence=sequence;
    assert.deepEqual(parse(recreatedList),{code:0,requests:[expectedApplicant]});
    const beforeApprovalProfiles=app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all();
    const approveRequest={userId:expectedApplicant.userId,approve:true},approveResponse=await joinApprove(approveRequest),
      approveSequence=sequence;
    assert.deepEqual(parse(approveResponse),{code:0,result:0,user:expectedApplicant});
    const approvedStatus=await getStatus();
    assert.deepEqual(approvedStatus.members,[own.members[0],{...expectedApplicant,post:1,contributionPoint:0}]);
    assert.deepEqual(await getDetails(),detailsFor(approvedStatus));
    assert.deepEqual(parse(await byOption({})),searchFor(approvedStatus));
    assert.deepEqual(app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all(),beforeApprovalProfiles);
    assert.deepEqual(app.store.operations(),[],'Approving an applicant creates no native reward or currency operation');
    assert.equal((await request(port,recreatedListSequence,{userId:seed.userId},String(recreatedListSequence),
      'familia/join/list/recieved')).status,503,'A cached pending list cannot restore an accepted applicant');
    app.store.db.prepare('DELETE FROM reply_cache WHERE action=? AND key=?')
      .run('familia/join/approve',`${approveSequence}/${approveSequence}`);
    await close(); await open();
    assert.deepEqual((await request(port,approveSequence,approveRequest,String(approveSequence),'familia/join/approve')).body,
      approveResponse.body,'Approved decision survives reply-cache loss and restart');
    assert.deepEqual(parse(await byOption({})), searchFor(await getStatus()),
      'Approved member survives disband/recreation/restart');
    // WRITTEN ONLY / NOT RUN:1b12c34 cases4/5 send member ID plus current godId.
    const roleProfiles=app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all(),
      appointRequest={appointeeUserId:expectedApplicant.userId,godId:settings.godId};
    for(const value of [undefined,null,{},[],0,false,'',{appointeeUserId:expectedApplicant.userId},
      {godId:settings.godId},{appointeeUserId:0,godId:settings.godId},
      {appointeeUserId:expectedApplicant.userId+1,godId:settings.godId},
      {appointeeUserId:expectedApplicant.userId,godId:999},
      {appointeeUserId:String(expectedApplicant.userId),godId:settings.godId},
      {...appointRequest,extra:true}])assert.equal((await appointSubmaster(value)).status,400,JSON.stringify(value));
    const appointBeforeSequence=app.store.lastSequence();
    app.store.db.exec("CREATE TRIGGER fail_member_role BEFORE INSERT ON familia_member_role_request BEGIN SELECT RAISE(ABORT,'member role rollback'); END");
    assert.equal((await appointSubmaster(appointRequest)).status,503);
    assert.equal(app.store.db.prepare(`SELECT member_post FROM familia_join_received_application
      WHERE creation_operation_id=(SELECT creation_operation_id FROM local_familia WHERE id=1)`).get().member_post,1);
    assert.equal(app.store.lastSequence(),appointBeforeSequence);
    app.store.db.exec('DROP TRIGGER fail_member_role');
    const appointResponse=await appointSubmaster(appointRequest),appointSequence=sequence;
    assert.deepEqual(parse(appointResponse),{code:0,result:0});
    const submasterStatusResponse=await send({is_login:true},'familia/mystatus'),submasterStatusSequence=sequence,
      submasterStatus=parse(submasterStatusResponse);
    assert.deepEqual(submasterStatus.members,[own.members[0],{...expectedApplicant,post:2,contributionPoint:0}]);
    assert.deepEqual(await getDetails(),detailsFor(submasterStatus));
    app.store.db.prepare('DELETE FROM reply_cache WHERE action=? AND key=?')
      .run('familia/manage/appoint_submaster',`${appointSequence}/${appointSequence}`);
    assert.deepEqual((await request(port,appointSequence,appointRequest,String(appointSequence),
      'familia/manage/appoint_submaster')).body,appointResponse.body,'Submaster appointment survives reply-cache loss');
    const dismissRequest={dismissedUserId:expectedApplicant.userId,godId:settings.godId};
    for(const value of [undefined,null,{},[],{dismissedUserId:expectedApplicant.userId},
      {dismissedUserId:expectedApplicant.userId+1,godId:settings.godId},
      {dismissedUserId:expectedApplicant.userId,godId:999},{...dismissRequest,extra:true}])
      assert.equal((await dismissSubmaster(value)).status,400,JSON.stringify(value));
    const dismissResponse=await dismissSubmaster(dismissRequest),dismissSequence=sequence;
    assert.deepEqual(parse(dismissResponse),{code:0,result:0});
    assert.equal((await request(port,submasterStatusSequence,{is_login:true},String(submasterStatusSequence),
      'familia/mystatus')).status,503,'Cached status cannot restore a dismissed submaster role');
    assert.equal((await request(port,appointSequence,appointRequest,String(appointSequence),
      'familia/manage/appoint_submaster')).status,503,'Old appointment cannot restore a dismissed role');
    assert.deepEqual((await getStatus()).members,[own.members[0],{...expectedApplicant,post:1,contributionPoint:0}]);
    assert.notEqual((await dismissSubmaster(dismissRequest)).status,200,'A fresh duplicate dismissal cannot demote twice');
    app.store.db.prepare('DELETE FROM reply_cache WHERE action=? AND key=?')
      .run('familia/manage/dismessed_submaster',`${dismissSequence}/${dismissSequence}`);
    await close(); await open();
    assert.deepEqual((await request(port,dismissSequence,dismissRequest,String(dismissSequence),
      'familia/manage/dismessed_submaster')).body,dismissResponse.body,'Submaster dismissal survives restart');
    assert.deepEqual((await getStatus()).members,[own.members[0],{...expectedApplicant,post:1,contributionPoint:0}]);
    assert.deepEqual(app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all(),roleProfiles);
    assert.deepEqual(app.store.operations(),[],'Familia member role changes create no native operation');
    // WRITTEN ONLY / NOT RUN:1b12c34 case3 sends exact userId to familia/kick.
    for(const value of [undefined,null,{},[],0,false,'',{userId:0},{userId:-1},{userId:'1'},
      {userId:1.5},{userId:expectedApplicant.userId+1},{userId:expectedApplicant.userId,extra:true}])
      assert.equal((await kickMember(value)).status,400,JSON.stringify(value));
    const kickBeforeSequence=app.store.lastSequence();
    app.store.db.exec("CREATE TRIGGER fail_familia_kick BEFORE INSERT ON familia_kick_request BEGIN SELECT RAISE(ABORT,'familia kick rollback'); END");
    assert.equal((await kickMember({userId:expectedApplicant.userId})).status,503);
    assert.equal(app.store.db.prepare(`SELECT state FROM familia_join_received_application
      WHERE creation_operation_id=(SELECT creation_operation_id FROM local_familia WHERE id=1)`).get().state,1,
    'Failed kick receipt must roll back member removal');
    assert.equal(app.store.lastSequence(),kickBeforeSequence);
    app.store.db.exec('DROP TRIGGER fail_familia_kick');
    const kickRequest={userId:expectedApplicant.userId},kickResponse=await kickMember(kickRequest),kickSequence=sequence;
    assert.deepEqual(parse(kickResponse),{code:0,result:0});
    assert.equal(app.store.db.prepare(`SELECT state FROM familia_join_received_application
      WHERE creation_operation_id=(SELECT creation_operation_id FROM local_familia WHERE id=1)`).get().state,2);
    const kickedStatus=await getStatus();
    assert.deepEqual(kickedStatus.members,[own.members[0]]);
    assert.deepEqual(await getDetails(),detailsFor(kickedStatus));
    assert.deepEqual(parse(await byOption({})),searchFor(kickedStatus));
    assert.equal((await request(port,approveSequence,approveRequest,String(approveSequence),'familia/join/approve')).status,503,
      'An old approval cannot restore a removed member');
    assert.notEqual((await kickMember(kickRequest)).status,200,'A fresh duplicate kick cannot remove the member twice');
    app.store.db.prepare('DELETE FROM reply_cache WHERE action=? AND key=?')
      .run('familia/kick',`${kickSequence}/${kickSequence}`);
    assert.deepEqual((await request(port,kickSequence,kickRequest,String(kickSequence),'familia/kick')).body,
      kickResponse.body,'Member removal survives reply-cache loss');
    await close(); await open();
    assert.deepEqual((await request(port,kickSequence,kickRequest,String(kickSequence),'familia/kick')).body,
      kickResponse.body,'Member removal survives restart');
    assert.deepEqual((await getStatus()).members,[own.members[0]]);
    assert.deepEqual(app.store.operations(),[],'Removing an offline member creates no native operation');
    // WRITTEN ONLY / NOT RUN:1b12c34 case6 sends appointeeUserId plus current godId.
    await close();database=path.join(directory,'master-transfer.sqlite');await open();
    put('UserCurrency',[currency]);
    const transferSettings={...settings,name:'Transfer'},transferCreation=parse(await send(transferSettings)),
      transferCharge=transferCreation.operations[0];
    parse(await send(save({UserCurrency:[{...currency,amount:100000,signature:transferCharge.signature}]},[transferCharge]),
      'user_data/push'));
    parse(await receivedJoinList({userId:seed.userId}));
    parse(await joinApprove({userId:expectedApplicant.userId,approve:true}));
    const transferBefore=await getStatus(),transferProfiles=app.store.db.prepare(
      'SELECT name,data,token FROM profile ORDER BY name').all(),transferRequest={
        appointeeUserId:expectedApplicant.userId,godId:transferSettings.godId};
    for(const value of [undefined,null,{},[],0,false,'',{appointeeUserId:expectedApplicant.userId},
      {godId:transferSettings.godId},{appointeeUserId:0,godId:transferSettings.godId},
      {appointeeUserId:expectedApplicant.userId+1,godId:transferSettings.godId},
      {appointeeUserId:expectedApplicant.userId,godId:999},
      {appointeeUserId:String(expectedApplicant.userId),godId:transferSettings.godId},
      {...transferRequest,extra:true}])assert.equal((await changeMaster(value)).status,400,JSON.stringify(value));
    const transferBeforeSequence=app.store.lastSequence();
    app.store.db.exec("CREATE TRIGGER fail_master_transfer BEFORE INSERT ON familia_master_transfer_request BEGIN SELECT RAISE(ABORT,'master transfer rollback'); END");
    assert.equal((await changeMaster(transferRequest)).status,503);
    assert.equal(app.store.db.prepare(`SELECT member_post FROM familia_join_received_application
      WHERE creation_operation_id=(SELECT creation_operation_id FROM local_familia WHERE id=1)`).get().member_post,1,
    'Failed master-transfer receipt must roll back the promoted member');
    assert.equal(app.store.lastSequence(),transferBeforeSequence);
    app.store.db.exec('DROP TRIGGER fail_master_transfer');
    const oldStatusResponse=await send({is_login:true},'familia/mystatus'),oldStatusSequence=sequence,
      oldDetailsResponse=await send(detailValue,'familia/get'),oldDetailsSequence=sequence,
      oldSearchResponse=await byOption({}),oldSearchSequence=sequence;
    parse(oldStatusResponse);parse(oldDetailsResponse);parse(oldSearchResponse);
    const transferResponse=await changeMaster(transferRequest),transferSequence=sequence;
    assert.deepEqual(parse(transferResponse),{code:0,result:0});
    const transferredStatus=await getStatus();
    assert.deepEqual(transferredStatus.members,[{...transferBefore.members[0],post:1},
      {...expectedApplicant,post:3,contributionPoint:0}]);
    assert.deepEqual(await getDetails(),detailsFor(transferredStatus));
    assert.deepEqual(parse(await byOption({})),searchFor(transferredStatus));
    assert.equal((await request(port,oldStatusSequence,{is_login:true},String(oldStatusSequence),'familia/mystatus')).status,503,
      'Cached status cannot restore the former master');
    assert.equal((await request(port,oldDetailsSequence,detailValue,String(oldDetailsSequence),'familia/get')).status,503,
      'Cached details cannot restore the former master');
    assert.equal((await request(port,oldSearchSequence,{},String(oldSearchSequence),'familia/search/option')).status,503,
      'Cached search cannot restore the former master');
    assert.equal((await inviteSearch({})).status,503,'Former master cannot invite members');
    assert.equal((await edit({familiaId:1,...transferSettings})).status,503,'Former master cannot edit settings');
    assert.equal((await changeGod({familiaId:1,godId:20000002})).status,503,'Former master cannot change god');
    assert.equal((await send({familiaId:1,status:0,condition:0},'familia/union/setting')).status,503,
      'Former master cannot change union preferences');
    assert.equal((await kickMember({userId:expectedApplicant.userId})).status,503,'Former master cannot kick the successor');
    assert.equal((await appointSubmaster(transferRequest)).status,503,'Former master cannot alter successor roles');
    assert.equal((await send(null,'familia/break')).status,503,'Former master cannot disband the Familia');
    assert.notEqual((await changeMaster(transferRequest)).status,200,'A fresh duplicate cannot transfer twice');
    app.store.db.prepare('DELETE FROM reply_cache WHERE action=? AND key=?')
      .run('familia/manage/change_master',`${transferSequence}/${transferSequence}`);
    assert.deepEqual((await request(port,transferSequence,transferRequest,String(transferSequence),
      'familia/manage/change_master')).body,transferResponse.body,'Master transfer survives reply-cache loss');
    await close();await open();
    assert.deepEqual((await request(port,transferSequence,transferRequest,String(transferSequence),
      'familia/manage/change_master')).body,transferResponse.body,'Master transfer survives restart');
    assert.deepEqual((await getStatus()).members,transferredStatus.members);
    assert.deepEqual(app.store.db.prepare('SELECT name,data,token FROM profile ORDER BY name').all(),transferProfiles);
    assert.deepEqual(app.store.operations(),[],'Familia master transfer creates no native operation');
    // Native positive additions cap at 999999999; the storage setter permits
    // 2000000000. A visible debit at either boundary remains provable.
    for (const cumulativeAmount of [999999999, 2000000000]) {
      await close();
      database = path.join(directory, `counter-${cumulativeAmount}.sqlite`);
      await open();
      const capped = { ...currency, cumulativeAmount };
      put('UserCurrency', [capped]);
      const creation = parse(await send(settings)), charge = creation.operations[0];
      if (cumulativeAmount === 999999999) {
        const ambiguous = { ...capped, amount: 100050, signature: charge.signature };
        parse(await send(save({ UserCurrency: [ambiguous] }), 'user_data/push'));
        await close(); await open();
        assert.equal((await send(save({}, [charge]), 'user_data/push')).status, 400,
          'Capped lifetime counter cannot prove a charge mixed with later earnings');
        assert.deepEqual(app.store.operations(), [charge], 'Ambiguous charge must stay queued');
        assert.equal((await send(settings)).status,503,'Observed signature with ambiguous capped gain cannot replay the debit');
      }
      parse(await send(save({ UserCurrency: [{ ...capped, amount: 100000,signature:charge.signature }] }, [charge]), 'user_data/push'));
      assert.deepEqual(app.store.operations(), [], 'Fully observable capped-counter debit can be acknowledged');
    }
    // WRITTEN ONLY / NOT RUN:22000 must retain price evidence across partial callbacks and group lifecycles.
    for(const mode of ['cost-first','signature-first','combined','ordinary-gain','stock-above-lifetime',
      'legacy-cost-first','legacy-untouched','lost-new-capture']) {
      await close();database=path.join(directory,`creation-recovery-${mode}.sqlite`);await open();
      const funded={...currency,amount:mode==='stock-above-lifetime'?2000000000:500000,
        cumulativeAmount:mode==='stock-above-lifetime'?999999999:500000,signature:7};
      put('UserCurrency',[funded]);
      const snapshot=()=>({profiles:app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),queue:app.store.operations(),
        receipts:app.store.db.prepare('SELECT * FROM familia_creation ORDER BY operation_id').all(),
        requests:app.store.db.prepare('SELECT * FROM familia_creation_request ORDER BY request_key').all(),
        familia:app.store.db.prepare('SELECT * FROM local_familia').all(),floor:app.store.db.prepare('SELECT * FROM familia_valis_spending_floor').all(),
        archives:app.store.db.prepare('SELECT * FROM familia_dissolution ORDER BY creation_operation_id').all(),
        done:app.store.db.prepare('SELECT * FROM operation_done ORDER BY id').all(),
        replies:app.store.db.prepare('SELECT * FROM reply_cache ORDER BY rowid').all(),sequence:String(app.store.lastSequence())});
      for(const table of ['familia_creation','familia_creation_request','reply_cache']) {
        const before=snapshot();app.store.db.exec(`CREATE TRIGGER creation_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'creation issue rollback'); END`);
        assert.equal((await send(settings)).status,503);assert.deepEqual(snapshot(),before);app.store.db.exec('DROP TRIGGER creation_issue_fail');
      }
      const before=snapshot(),issued=parse(await send(settings)),issueSequence=sequence,charge=issued.operations[0],initial=snapshot().receipts[0];
      assert.notEqual(charge.signature,funded.signature);assert.deepEqual(snapshot().profiles,before.profiles);
      assert.deepEqual(JSON.parse(initial.before_json),funded);assert.equal(initial.charge_seen,0);assert.equal(initial.effect_seen,0);
      assert.equal(snapshot().familia[0].creation_capture_version,1);assert.equal(app.store.familiaValisSpendingFloor().ceiling,null);
      assert.deepEqual(parse(await request(port,issueSequence,settings,String(issueSequence),'familia/create')),issued);
      const creationRequest=snapshot().requests[0];
      app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`${issueSequence}/${issueSequence}`);
      const cacheless=snapshot();await close();await open();assert.deepEqual(snapshot(),cacheless);
      assert.deepEqual(parse(await request(port,issueSequence,settings,String(issueSequence),'familia/create')),issued,
        'Permanent creation identity survives cache loss and restart');
      if(mode==='cost-first') {
        app.store.db.prepare("UPDATE familia_creation_request SET response_hash='lost' WHERE request_key=?")
          .run(`${issueSequence}/${issueSequence}`);
        assert.equal((await request(port,issueSequence,settings,String(issueSequence),'familia/create')).status,503);
        app.store.db.prepare('UPDATE familia_creation_request SET response_hash=? WHERE request_key=?')
          .run(creationRequest.response_hash,`${issueSequence}/${issueSequence}`);
        app.store.db.prepare('DELETE FROM familia_creation_request WHERE request_key=?').run(`${issueSequence}/${issueSequence}`);
        app.store.db.prepare(`INSERT OR REPLACE INTO reply_cache(key,action,body_hash,content_type,body) VALUES(?,?,?,?,?)`)
          .run(`${issueSequence}/${issueSequence}`,'familia/create',creationRequest.body_hash,'application/json',
            Buffer.from(JSON.stringify(issued)).toString('base64'));
        assert.equal((await request(port,issueSequence,settings,String(issueSequence),'familia/create')).status,503,
          'A generic creation reply cannot replace its permanent request receipt');
        app.store.db.prepare(`INSERT INTO familia_creation_request(${Object.keys(creationRequest).join(',')})
          VALUES(${Object.keys(creationRequest).map(()=>'?').join(',')})`).run(...Object.values(creationRequest));
        app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`${issueSequence}/${issueSequence}`);
      }
      assert.deepEqual(parse(await send(undefined,'user_data/confirm')).operations,[charge]);
      assert.deepEqual(parse(await send(save({}),'user_data/push')).operations,[charge]);
      if(mode.startsWith('legacy-')) {
        app.store.db.prepare('DELETE FROM familia_creation').run();app.store.db.prepare('UPDATE local_familia SET creation_capture_version=0').run();
      }
      if(mode==='lost-new-capture') {
        app.store.db.prepare('DELETE FROM familia_creation').run();const missing=snapshot();
        for(const [action,body] of [['familia/create',settings],['user_data/confirm',undefined],['user/login',undefined],
          ['user_data/pull',{tables:['UserCurrency']}],['user_data/push',save({})]]) {
          assert.equal((await send(body,action)).status,503);assert.deepEqual(snapshot(),missing);
        }
        app.store.db.prepare(`INSERT INTO familia_creation(${Object.keys(initial).join(',')}) VALUES(${Object.keys(initial).map(()=>'?').join(',')})`)
          .run(...Object.values(initial));
      }
      const native={...funded,amount:funded.amount-100000,signature:charge.signature};
      if(mode==='ordinary-gain') {native.amount+=50;native.cumulativeAmount+=50;}
      if(mode==='legacy-untouched') {
        const held=parse(await send(save({}),'user_data/push'));assert.deepEqual(held.operations,[]);assert.deepEqual(app.store.operations(),[charge]);
        assert.equal(snapshot().receipts.length,0,'Unknown legacy signatures are not invented by an unchanged save');
        assert.equal((await send(settings)).status,503);assert.equal((await send(save({},[charge]),'user_data/push')).status,400);
      } else if(mode!=='combined') {
        const first=mode==='signature-first'?{...funded,signature:charge.signature}:native,
          partialValue=save({UserCurrency:[first]});
        for(const [table,event] of [['profile','UPDATE'],['familia_creation',mode==='legacy-cost-first'?'INSERT':'UPDATE'],['reply_cache','INSERT']]) {
          const pending=snapshot();app.store.db.exec(`CREATE TRIGGER creation_partial_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'partial creation rollback'); END`);
          assert.equal((await send(partialValue,'user_data/push')).status,503);assert.deepEqual(snapshot(),pending);app.store.db.exec('DROP TRIGGER creation_partial_fail');
        }
        const partial=parse(await send(partialValue,'user_data/push')),saved=snapshot().receipts[0];
        assert.deepEqual(partial.operations,[]);assert.equal(partial.operation,undefined);assert.deepEqual(app.store.operations(),[charge]);
        assert.equal(saved.effect_seen,1);assert.equal(saved.charge_seen,mode==='signature-first'?0:1);
        assert.equal(app.store.familiaValisSpendingFloor().ceiling,null,'Partial proof is not a completed spending floor');
        const pending=snapshot();await close();await open();assert.deepEqual(snapshot(),pending);
        for(const [action,body] of [['familia/create',settings],['user_data/confirm',undefined],['user/login',undefined],
          ['user_data/pull',{tables:['UserCurrency']}]]) {
          assert.equal((await send(body,action)).status,503);assert.deepEqual(snapshot(),pending);
        }
        assert.equal((await request(port,issueSequence,settings,String(issueSequence),'familia/create')).status,503);assert.deepEqual(snapshot(),pending);
        if(mode==='signature-first') {assert.equal((await send(save({},[charge]),'user_data/push')).status,400);assert.deepEqual(snapshot(),pending);}
        assert.equal((await send(save({UserCurrency:[funded]}),'user_data/push')).status,400);assert.deepEqual(snapshot(),pending,
          'Saved cost or signature evidence cannot be reset to the original before state');
        for(const bad of [[],[first,first],[{...first,userId:0}],[{...first,cumulativeAmount:funded.cumulativeAmount-1}],
          [{...first,amount:2000000001}],[{...first,signature:0x100000000}]]) {
          assert.equal((await send(save({UserCurrency:bad}),'user_data/push')).status,400);assert.deepEqual(snapshot(),pending);
        }
        app.store.db.prepare("UPDATE familia_creation SET capture_hash='lost'").run();const corrupt=snapshot();
        assert.equal((await send(save({}),'user_data/push')).status,503);assert.deepEqual(snapshot(),corrupt);
        app.store.db.prepare('UPDATE familia_creation SET capture_hash=?').run(saved.capture_hash);
      }
      const finalValue=save({UserCurrency:[native]},[charge]);
      for(const [table,event] of [['profile','UPDATE'],['familia_creation',mode==='legacy-untouched'?'INSERT':'UPDATE'],
        ['familia_valis_spending_floor','UPDATE'],['operation_done','INSERT'],['reply_cache','INSERT']]) {
        if(table==='familia_creation' && !['signature-first','combined','legacy-untouched'].includes(mode)) continue;
        const pending=snapshot();app.store.db.exec(`CREATE TRIGGER creation_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'creation ACK rollback'); END`);
        assert.equal((await send(finalValue,'user_data/push')).status,503);assert.deepEqual(snapshot(),pending);app.store.db.exec('DROP TRIGGER creation_ack_fail');
      }
      const acknowledged=await send(finalValue,'user_data/push'),ackSequence=sequence;parse(acknowledged);
      const floor=app.store.familiaValisSpendingFloor();assert.equal(floor.ceiling,funded.amount-funded.cumulativeAmount-100000);
      assert.equal(floor.source_kind,'creation');assert.equal(floor.source_operation_id,charge.id);assert.deepEqual(app.store.operations(),[]);
      assert.equal(snapshot().receipts.length,1);assert.equal(snapshot().receipts[0].charge_seen,1);
      const complete=snapshot();await close();await open();assert.deepEqual(snapshot(),complete);
      assert.deepEqual((await request(port,ackSequence,finalValue,String(ackSequence),'user_data/push')).body,acknowledged.body);
      assert.deepEqual(parse(await request(port,issueSequence,settings,String(issueSequence),'familia/create')),
        {code:0,result:0,operations:[]});assert.deepEqual(snapshot(),complete);
      assert.equal((await send(save({UserCurrency:[funded]}),'user_data/push')).status,400);assert.deepEqual(snapshot(),complete);
      parse(await send(null,'familia/break'));const dissolved=snapshot();assert.equal(dissolved.receipts.length,1);
      assert.equal(dissolved.familia.length,0);assert.deepEqual(app.store.familiaValisSpendingFloor(),floor);
      assert.equal((await send(save({UserCurrency:[funded]}),'user_data/push')).status,400);assert.deepEqual(snapshot(),dissolved,
        'Disbanding must not erase a real completed creation charge');
      const second=parse(await send({...settings,name:'Recreated'})).operations[0],next={...native,amount:native.amount-100000,signature:second.signature};
      parse(await send(save({UserCurrency:[next]},[second]),'user_data/push'));assert.equal(snapshot().receipts.length,2);
      assert.equal(app.store.familiaValisSpendingFloor().ceiling,funded.amount-funded.cumulativeAmount-200000);
      const recreated=snapshot();await close();await open();assert.deepEqual(snapshot(),recreated);
      assert.equal((await request(port,issueSequence,settings,String(issueSequence),'familia/create')).status,503,
        'An old creation identity cannot attach to a recreated Familia');
      assert.equal((await send(save({UserCurrency:[native]}),'user_data/push')).status,400);assert.deepEqual(snapshot(),recreated);
      app.store.db.prepare('DELETE FROM familia_valis_spending_floor').run();await close();await open();
      assert.equal((await send(save({}),'user_data/push')).status,503,'Lost new creation proof cannot be reseeded from old donation history');
    }
    console.log('Solo Familia: owner/leader, public details, literal name/filter search, shop, settings/god edits, lifecycle, rollback, replay and restart: OK; native acceptance tracked separately');
  } finally {
    await close();
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-familia-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
