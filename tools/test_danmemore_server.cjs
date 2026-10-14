'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const zlib = require('node:zlib');
const { createServer, encodeMsgpack, openStore, USER_AREA_TOKEN, SINGLETON_TABLES, pvbRefill } = require('./danmemore_server.cjs');

const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const key = Buffer.from('JsfcytENstRNhJBfkNQCCKb62jbZYccX');
const iv = Buffer.from('DanMemoReLocalIV');
const md5 = value => crypto.createHash('md5').update(value).digest('hex');

function encrypt(value) {
  const plain = Buffer.from(JSON.stringify(value)), compressed = zlib.deflateSync(plain);
  const padded = Buffer.concat([compressed, Buffer.alloc((16 - compressed.length % 16) % 16)]);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv); cipher.setAutoPadding(false);
  return { plain, wire: Buffer.concat([cipher.update(padded), cipher.final()]) };
}

function request(port, sequence, value, requestId = '7', action = 'user_data/push', headers = {}) {
  const { plain, wire } = value === undefined ? { plain: Buffer.alloc(0), wire: Buffer.alloc(0) } : encrypt(value);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method: 'POST', path: `/api/game_client/${action}`, headers: {
      Host: `127.0.0.1:28766`, 'Content-Length': wire.length, 'X-ARGO-CLIENT-VERSION': '15.1.0',
      'X-ARGO-CLIENT-VERSION-CODE': '170316722', 'X-ARGO-REQUEST-ID': requestId,
      'X-ARGO-REQUEST-SEQUENCE': String(sequence), 'X-ARGO-REQUEST-BODY-HASH': md5(plain),
      ...headers,
    } }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks), headers: response.headers }));
    });
    req.on('error', reject); req.end(wire);
  });
}

function get(port, pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: pathname, headers }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks), headers: response.headers }));
    }).on('error', reject);
  });
}

function rewardCharacterFixture(characters,pcIds) {
  // Explicit SYNTHETIC acquisition save, not a native row/signature producer.
  return [...new Set(pcIds.map(id => master.pcProfiles[id]?.characterId).filter(Boolean))].map(characterId => {
    const before = characters.find(row => row.characterId === characterId) ?? { userId:0,characterId,
      characterState:1,friendship:0,friendshipAis:0,friendshipLef:0,substitutedPcSpineId:0,signature:0xffffffff };
    return { ...before,characterState:before.characterState === 1 ? 2 : before.characterState };
  });
}

function rewardCostumeFixture(costumes,pcIds,voices = []) {
  // Explicit SYNTHETIC slot76 acquisition save; no communication-default/CP voices.
  const ids=[...new Set(pcIds.map(id=>master.pcProfiles[id]?.initialCostumeId).filter(Boolean))];
  if(!ids.length) return {};
  const targets=ids.map(costumeId=>{
    const before=costumes.find(row=>row.costumeId===costumeId) ?? {userId:0,costumeId,costumeState:1};
    return {...before,costumeState:Math.max(2,before.costumeState)};
  });
  const newlyOwned=new Set(ids.filter(id=>(costumes.find(row=>row.costumeId===id)?.costumeState ?? 1)===1)),
    linked=Object.entries(master.communicationVoices).filter(([,voice])=>newlyOwned.has(voice.costumeId)).map(([id])=>Number(id));
  return {UserCharacterCostume:targets,...(linked.length ? {UserCommunicationVoice:linked.map(voiceId=>{
    const before=voices.find(row=>row.voiceId===voiceId) ?? {userId:0,voiceId,voiceState:1};
    return {...before,voiceState:Math.max(2,before.voiceState)};
  })} : {})};
}

function rewardUnitStoryFixture(stages,pcIds) {
  // Explicit SYNTHETIC first-PC story delta, never added to generic XP saves.
  const ids=new Set(pcIds);
  const targets=Object.entries(master.stageProgression).filter(([id,row])=>row.unlockCondition===6 && row.level===1 &&
    ids.has(master.stageUnlocks[id].value) && master.pcProfiles[master.stageUnlocks[id].value].initialCostumeId &&
    master.adventureProgression[master.episodeProgression[row.episodeId].adventureId].type===4).map(([id])=>{
      const adventureStageId=Number(id),before=stages.find(row=>row.adventureStageId===adventureStageId) ??
        {userId:seed.userId,adventureStageId,state:0,currentScore:0,highScore:0,cumulativeClearCount:0,firstCompleteDateTime:0};
      return {...before,state:before.state===0 ? 1 : before.state};
    });
  return targets.length ? {UserAdventureStage:targets} : {};
}

function communicationWardrobeFixture(store,id) {
  // Explicit SYNTHETIC communication entry, not native costume/CP signatures
  // or a hidden first-entry delta added to generic stage/XP saves.
  const original=master.communicationCharacters[id],key=master.characters[original.characterId].key,
    initial=Object.entries(master.characterCostumes).filter(([,row])=>row.characterKey===key && row.initialUnlock),
    costumeId=Number([...initial].sort((a,b)=>b[1].priority-a[1].priority)[0][0]),
    costumes=store.read('UserCharacterCostume').data,voices=store.read('UserCommunicationVoice').data,
    character=store.read('UserCharacter').data.find(row=>row.characterId===original.characterId),
    levels=['friendship','friendshipAis','friendshipLef'].map(field=>master.characters[original.characterId].levels
      .findLast(([,points])=>points<=(character?.[field] ?? 0))[0]),
    initialized=initial.map(([id])=>{
      const costumeId=Number(id),before=costumes.find(row=>row.costumeId===costumeId) ?? {userId:0,costumeId,costumeState:1};
      return {...before,costumeState:Math.max(2,before.costumeState)};
    }),owned=new Map([...costumes,...initialized].map(row=>[row.costumeId,row.costumeState]));
  const eligible=Object.entries(master.communicationVoices).filter(([,row])=>row.kind!==1 && (row.kind===2 ?
    [2,3].includes(owned.get(row.costumeId)) : row.communicationCharacterKey===original.key && row.friendshipLevel<=levels[row.userHeroType]));
  return {costumeId,putItems:{UserCharacterCostume:initialized,UserCommunicationVoice:eligible.map(([id])=>{
    const voiceId=Number(id),before=voices.find(row=>row.voiceId===voiceId) ?? {userId:0,voiceId,voiceState:1};
    return {...before,voiceState:Math.max(2,before.voiceState)};
  })}};
}

function rewardCommunicationFixture(store,pcIds,joinDateTime) {
  // Deferred synthetic native callback effects for original mission type-29 units.
  const puts={UserCommunicationCharacter:new Map(),UserCharacterCostume:new Map(),
    UserCommunicationVoice:new Map(),UserAdventureStage:new Map()},stages=store.read('UserAdventureStage').data;
  for(const pcId of pcIds) {
    const matches=Object.entries(master.communicationCharacters).filter(([,row])=>
      row.characterId===master.pcProfiles[pcId].characterId);
    assert.equal(matches.length,1);
    const id=Number(matches[0][0]),quest=matches[0][1],wardrobe=communicationWardrobeFixture(store,id),
      before=store.read('UserCommunicationCharacter').data.find(row=>row.characterId===id);
    puts.UserCommunicationCharacter.set(id,{userId:before?.userId ?? 0,characterId:id,signature:before?.signature ?? 0,
      costumeId:wardrobe.costumeId,characterState:2,joinDateTime,touchCountBust:before?.touchCountBust ?? 0,
      touchCountOther:before?.touchCountOther ?? 0});
    for(const [name,rows] of Object.entries(wardrobe.putItems)) for(const row of rows)
      puts[name].set(name==='UserCharacterCostume'?row.costumeId:row.voiceId,row);
    for(const [adventureId,adventure] of Object.entries(master.adventureProgression)) {
      if(![2,3].includes(adventure.type) || adventure.label!==quest.key) continue;
      const episode=Object.entries(master.episodeProgression).find(([,row])=>row.adventureId===Number(adventureId) && row.index===1);
      const stage=episode && Object.entries(master.stageProgression).find(([,row])=>
        row.episodeId===Number(episode[0]) && row.level===1 && row.index===1);
      if(!stage || master.stageUnlocks[stage[0]]?.value>1) continue;
      const stageId=Number(stage[0]),saved=stages.find(row=>row.adventureStageId===stageId);
      if((saved?.state ?? 0)!==0) continue;
      puts.UserAdventureStage.set(stageId,{...(saved ?? {...seed.data.UserAdventureStage[0],tasks:[]}),
        adventureStageId:stageId,state:1});
    }
  }
  return Object.fromEntries(Object.entries(puts).filter(([,rows])=>rows.size).map(([name,rows])=>[name,[...rows.values()]]));
}

function drawAcknowledgement(result, extraPuts = {}, characters = seed.data.UserCharacter,
  costumes = seed.data.UserCharacterCostume, voices = seed.data.UserCommunicationVoice, stages = seed.data.UserAdventureStage) {
  // Synthetic client delta for ordering tests, NOT native stats/signature proof.
  //22f0530/22f0550 stamps the OPERATION signature and adds the actual stock difference;
  //wire row signature/cumulativeAmount are not imported by this native callback.
  // The canonical native PC writer omits delivery-only constructor recovery hints.
  const parameters = result.parameters ?? result, pcs = parameters.UserPC.map(({offlinePcBoardRecovery,offlinePcConstructorRecovery,...row}) => ({ ...row, joiningState: 1 }));
  const bonds = parameters.UserLimitBreakItem.map(row=>({...row,signature:result.operation.signature}));
  const putItems = { ...(pcs.length ? { UserPC:pcs,UserPCJobSet:pcs.map(row => ({ userId:seed.userId,pcId:row.pcId,pcJobs:[] })),
    UserCharacter:rewardCharacterFixture(characters,pcs.map(row => row.pcId)),
    ...rewardCostumeFixture(costumes,pcs.map(row=>row.pcId),voices),
    ...rewardUnitStoryFixture(stages,pcs.map(row=>row.pcId)) } : {}),
    ...(bonds.length ? { UserLimitBreakItem:bonds } : {}),
    ...(parameters.userGachaTicket ? {UserGachaTicket:[parameters.userGachaTicket]} : {}), ...extraPuts };
  return { badges: null, checksums: { before: {}, after: Object.fromEntries(Object.entries(putItems)
    .map(([name, rows]) => [name, md5(JSON.stringify(rows))])) }, dataTokens: {},
    deltas: Object.keys(putItems).length ? [{ deleteItems: {}, putItems, signature: 0, trigger: 'LotteryDraw' }] : [],
    operations: [{ id: result.operation.id, verifier: result.operation.token }], scripts: {} };
}

async function main() {
  const root = path.join(process.cwd(), '.work', 'danmemore-server-test');
  fs.rmSync(root, { recursive: true, force: true }); fs.mkdirSync(root, { recursive: true });
  let database = path.join(root, 'profile.sqlite');
  let app;
  try {
    const resources = path.join(root, 'manifests'); fs.mkdirSync(resources);
    fs.writeFileSync(path.join(resources, 'version.manifest.2'), 'version-two');
    fs.writeFileSync(path.join(resources, 'project.manifest.2'), 'project-two');
    fs.mkdirSync(path.join(resources, 'resources', 'gacha'), { recursive: true });
    fs.writeFileSync(path.join(resources, 'resources', 'gacha', 'lottery.enc'), 'restored-gacha');
    fs.mkdirSync(path.join(root, 'voice-packages', '7040020101'), { recursive: true });
    fs.writeFileSync(path.join(root, 'voice-packages', '7040020101', `${'a'.repeat(32)}.zip`), 'local-voice-zip');
    let store = openStore({ database, seed, master });
    const midnightJst = Date.parse('2026-10-01T15:00:00Z') / 1000;
    assert.equal(store.recordFamiliaActivity(401, midnightJst - 1), 1);
    assert.equal(store.recordFamiliaActivity(401, midnightJst - 1), 0);
    assert.equal(store.recordFamiliaActivity(401, midnightJst), 1);
    assert.throws(() => store.transaction(() => {
      store.recordFamiliaActivity(401, midnightJst + 86400); throw new Error('activity rollback');
    }), /activity rollback/);
    assert.equal(store.db.prepare('SELECT COUNT(*) n FROM familia_activity').get().n, 2);
    store.close(); store = openStore({ database, seed, master });
    store.beginSession();
    assert.equal(store.recordFamiliaActivity(401, midnightJst), 0);
    assert.equal(store.db.prepare('SELECT COUNT(*) n FROM familia_activity').get().n, 2);
    store.db.exec('DELETE FROM familia_activity');
    const initialStages = store.read('UserAdventureStage');
    const sampleStage = initialStages.data.find(row => row.adventureStageId === 1010000101101);
    store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([...initialStages.data,
      ...[1010000108101,1090006801129].map(adventureStageId => ({ ...sampleStage, adventureStageId, tasks: [] }))]), 'UserAdventureStage');
    const minimalBattle = { adventureStageTaskIds: [], adventureGainedItems: [], friendshipStates: [], secretMissionCompleted: false };
    const rewardPc = store.issueStageCompletion({ ...minimalBattle, adventureStageId: 1010000108101, token: 'pc-reward',
      adventureGainedItems: [{ itemId: 205000002, amount: 10 }, { itemId: 205000002, amount: 20 }] }, master);
    assert.deepEqual(rewardPc.parameters.gainedPCs, [1011003001]);
    assert.deepEqual(rewardPc.parameters.gainedItems, [{ itemId: 205000002, amount: 30 }]);
    // Stage kind 12 is an ordinary boss here; its parent adventure mode is 9.
    const twoPcs = store.issueStageCompletion({ ...minimalBattle, adventureStageId: 1090006801129, token: 'two-pc-reward' }, master);
    assert.deepEqual(twoPcs.parameters.gainedPCs, Array(2).fill(master.pcs['character.1_dio_s4_2']));
    const pendingStages = store.operations();
    const savedStages = store.read('UserAdventureStage');
    for (const type of [12,15,19,20,22,26,27,28]) {
      const adventureStageId = Number(Object.keys(master.stages).find(id => master.stages[id].adventureType === type));
      assert.ok(adventureStageId, `Original adventure mode ${type}`);
      assert.throws(() => store.issueStageCompletion({ ...minimalBattle, adventureStageId, token: 'wrong-route' }, master),
        /mode-specific completion route/);
    }
    assert.deepEqual(store.operations(), pendingStages);
    assert.deepEqual(store.read('UserAdventureStage'), savedStages);
    assert.equal(store.db.prepare('SELECT COUNT(*) n FROM stage_completion').get().n, 2);
    assert.equal(store.db.prepare('SELECT COUNT(*) n FROM stage_reward').get().n, 2);
    assert.equal(store.hardCurrency(), 0);
    store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(initialStages.data), initialStages.token, 'UserAdventureStage');
    store.db.exec('DELETE FROM operation_queue; DELETE FROM stage_completion; DELETE FROM stage_reward; DELETE FROM stage_delivery; DELETE FROM pve_item_claim');
    const shapes = require('../data/danmemore-user-tables.json').tables;
    assert.deepEqual(Object.keys(shapes).sort(), Object.keys(seed.dataTokens).sort());
    assert.deepEqual([...SINGLETON_TABLES].sort(), Object.keys(shapes).filter(name => shapes[name].shape === 'object').sort());
    const snapshot = store.pull({ tables: Object.keys(shapes) });
    for (const name of Object.keys(shapes)) {
      const saved = store.read(name).data;
      assert.deepEqual(snapshot.data[name], SINGLETON_TABLES.has(name) && saved.length ? saved[0] : saved, name);
    }
    assert.equal(store.read('UserInfo').data[0].activePartyId, 1);
    assert.equal(store.read('UserArea').token, USER_AREA_TOKEN);
    assert.equal(store.read('UserItemToken').data.length, 5);
    assert.equal(store.read('UserRandomSeed').data.length, 25);
    assert.equal(store.read('UserCommunicationCharacter').data.find(row => row.characterId === 100000005).costumeId, 1022027000);
    assert.equal(store.read('UserCharacterCostume').data.find(row => row.costumeId === 1022027000).costumeState, 2);
    assert.equal(store.read('UserPC').data.filter(row => row.pcId === 1012027001).length, 1);
    const homeCharacters = store.read('UserCommunicationCharacter');
    const home = homeCharacters.data.find(row => row.characterId === 100000005);
    store.push({ badges: null, checksums: { before: {}, after: { UserCommunicationCharacter: '11111111111111111111111111111111' } },
      dataTokens: {}, scripts: {}, operations: [], deltas: [{ signature: 0, trigger: 'Costume', deleteItems: {},
        putItems: { UserCommunicationCharacter: [{ ...home, costumeId: 1021001000, touchCountOther: 9 }] } }] });
    assert.equal(store.read('UserCommunicationCharacter').data.filter(row => row.characterId === home.characterId).length, 1);
    store.close(); store = openStore({ database, seed });
    assert.equal(store.read('UserCommunicationCharacter').data.find(row => row.characterId === home.characterId).touchCountOther, 9);
    store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(homeCharacters.data), homeCharacters.token, 'UserCommunicationCharacter');
    const adventureState = store.read('UserAdventureState');
    const legacyStates = [{ ...adventureState.data[0], stageId: 1010000101101 }, adventureState.data[0]];
    store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify(legacyStates), 'UserAdventureState');
    store.close(); store = openStore({ database, seed });
    assert.deepEqual(store.read('UserCommunicationCharacter'), homeCharacters);
    assert.deepEqual(store.read('UserAdventureState'), adventureState);
    assert.deepEqual(JSON.parse(store.db.prepare('SELECT data FROM legacy_singleton_backup WHERE name=?').get('UserAdventureState').data), legacyStates);
    const area = store.read('UserArea').data[0];
    assert.equal(md5(encodeMsgpack([{ userId: area.userId, areaId: area.areaId,
      lineBlockDwords: area.lineBlockDwords, encountCount: area.encountCount }])), USER_AREA_TOKEN);
    store.setSequence(99n); store.saveReply('old/99', 'test', 'hash', 'application/json', Buffer.from('{}')); store.beginSession();
    assert.equal(store.lastSequence(), -1n); assert.equal(store.reply('old/99'), undefined);
    store.close(); store = openStore({ database,seed,master });
    const beforeRollback = store.read('UserPC');
    assert.throws(() => store.transaction(() => {
      store.issueDraw([1011002001], {}, 1001);
      store.setSequence(100n);
      store.saveReply('rollback/100', 'tutorial/draw', 'hash', 'application/json', Buffer.from('{}'));
      throw new Error('Interrupted before commit');
    }), /Interrupted before commit/);
    assert.deepEqual(store.read('UserPC'), beforeRollback);
    assert.deepEqual(store.operations(), []);
    assert.equal(store.lastSequence(), -1n);
    assert.equal(store.reply('rollback/100'), undefined);
    const legacy = store.issueOperation(1000, { lotteryPCs: [{ pcId: 1011001999, isFirst: true }],
      UserCommunicationCharacter: [], UserHeroSublimatePCs: [] });
    store.close();
    store = openStore({ database, seed });
    assert.equal(store.operations()[0].parameters.UserPC[0].pcId, 1011001999);
    assert.equal(store.read('UserPC').data.some(item => item.pcId === 1011001999), false);
    const legacyParameters = store.operations()[0].parameters;
    const placeholder = legacyParameters.UserPC[0];
    const changedUnit = { ...placeholder, pcId: 1011001998, totalExp: 17 };
    legacyParameters.lotteryPCs.push({ pcId: changedUnit.pcId, isFirst: true });
    legacyParameters.UserPC.push(changedUnit);
    store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(legacyParameters), legacy.id);
    store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([
      ...store.read('UserPC').data, placeholder, changedUnit]), 'UserPC');
    store.close(); store = openStore({ database, seed });
    assert.equal(store.read('UserPC').data.some(item => item.pcId === placeholder.pcId), false, 'Old pending placeholder is withheld from pulls');
    assert.deepEqual(store.read('UserPC').data.find(item => item.pcId === changedUnit.pcId), changedUnit, 'Modified unit is never removed');
    assert.deepEqual(JSON.parse(store.db.prepare('SELECT data FROM legacy_draw_pc_backup WHERE pc_id=?').get(placeholder.pcId).data), placeholder);
    assert.throws(() => store.push({ badges: null, checksums: { before: {}, after: {} }, dataTokens: {}, deltas: [],
      operations: [{ id: legacy.id, verifier: legacy.token }], scripts: {} }), /receipt requires reconciliation/);
    assert.throws(() => store.push(drawAcknowledgement({ ...legacyParameters, operation: legacy })), /receipt requires reconciliation/);
    assert.equal(store.operations()[0].id,legacy.id, 'Unknown legacy acquisition is not guessed from current ownership');
    // Keep this unreconciled migration fixture isolated from the HTTP fixture.
    store.close();
    const logs = [];
    database = path.join(root,'http.sqlite');
    app = createServer({ database, seed, master, resourceDirectory: resources, work: root, log: line => logs.push(JSON.parse(line)) });
    await new Promise((resolve, reject) => app.server.listen(0, '127.0.0.1', error => error ? reject(error) : resolve()));
    const port = app.server.address().port;
    const startupSockets = await Promise.all(Array.from({ length: 12 }, () => new Promise((resolve, reject) => {
      const socket = net.connect(port, '127.0.0.1', () => {
        socket.write('GET /content/startup HTTP/1.1\r\nHost: 127.0.0.1\r\n');
        resolve(socket);
      });
      socket.once('error', reject);
    })));
    try {
      const authorize = await new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/billing/v1.0/auth/authorize',
          headers: { 'Content-Length': '0' } }, response => {
          response.resume(); response.on('end', () => resolve({ status: response.statusCode }));
        });
        req.on('error', reject); req.end();
      });
      assert.equal(authorize.status, 200, 'Startup downloads must not starve authentication');
    } finally {
      startupSockets.forEach(socket => socket.destroy());
    }
    const version = await get(port, '/api/asset/manifest/old/us/pkm/version.manifest.2');
    assert.equal(version.status, 200); assert.equal(version.body.toString(), 'version-two');
    const project = await get(port, '/content/manifests/us/pkm/project.manifest.2/old', { Range: 'bytes=1-3' });
    assert.equal(project.status, 206); assert.equal(project.body.toString(), 'roj');
    assert.equal(project.headers['content-range'], 'bytes 1-3/11');
    for (const prefix of ['api','content']) {
      const restored = await get(port, `/${prefix}/resources/gacha/lottery.enc`);
      assert.equal(restored.status, 200); assert.equal(restored.body.toString(), 'restored-gacha');
      const voice = await get(port, `/${prefix}/resources/voice/packages/7040020101/${'a'.repeat(32)}.zip`, { Range: 'bytes=0-4' });
      assert.equal(voice.status, 206); assert.equal(voice.body.toString(), 'local');
    }
    const products = await get(port, '/billing/v1.0/payment/productlist');
    assert.equal(products.status, 200); assert.equal(JSON.parse(products.body).entry.products.length, 6);
    assert.equal(products.headers.connection, 'close');
    const unsupportedBilling = await get(port, '/billing/v1.0/unknown');
    assert.equal(unsupportedBilling.status, 503); assert.equal(JSON.parse(unsupportedBilling.body).result, 'NG');
    assert.equal(unsupportedBilling.headers.connection, 'close');
    const current = app.store.read('UserInfo');
    const row = { ...current.data[0], activePartyId: 0, totalPlayingTime: current.data[0].totalPlayingTime + 1 };
    const body = { badges: null, checksums: { before: { UserInfo: current.token }, after: { UserInfo: '0123456789abcdef0123456789abcdef' } },
      dataTokens: { UserInfo: current.token }, deltas: [{ deleteItems: {}, putItems: { UserInfo: [row] }, signature: 0, trigger: 'Blocking' }], operations: [], scripts: {} };
    const first = await request(port, 1, body);
    assert.equal(first.status, 200); assert.equal(JSON.parse(first.body).dataTokens.UserInfo, body.checksums.after.UserInfo);
    assert.equal(first.headers.connection, 'close');
    assert.equal(JSON.parse(first.body).dataTokens.UserArea, undefined);
    assert.equal(app.store.read('UserArea').data[0].encountCount, 0);
    const replay = await request(port, 1, body);
    assert.equal(replay.status, 200); assert.deepEqual(replay.body, first.body);
    assert.equal(app.store.read('UserInfo').data[0].activePartyId, 0);
    assert.equal(app.store.read('UserInfo').data.length, 1, 'Changing a singleton foreign ID must replace its row');
    assert.deepEqual(app.store.pull({ tables: ['UserInfo'] }).data.UserInfo, row);
    const conflicting = structuredClone(body); conflicting.deltas[0].putItems.UserInfo[0].totalPlayingTime++;
    assert.equal((await request(port, 1, conflicting)).status, 400);
    const itemTokens = app.store.read('UserItemToken');
    const tokenBody = { badges: null, checksums: { before: { UserItemToken: itemTokens.token },
      after: { UserItemToken: '11111111111111111111111111111111' } }, dataTokens: { UserItemToken: itemTokens.token },
      deltas: [{ deleteItems: { UserItemToken: [itemTokens.data[0]] }, putItems: {}, signature: 0, trigger: 'Blocking' }],
      operations: [], scripts: {} };
    const tokenResponse = JSON.parse((await request(port, 2, tokenBody)).body);
    assert.equal(tokenResponse.data.UserItemToken.length, 1);
    assert.equal(tokenResponse.data.UserItemToken[0].userId, seed.userId);
    assert.ok(tokenResponse.data.UserItemToken[0].signature > 0);
    assert.equal(app.store.read('UserItemToken').data.length, 5);
    assert.equal(app.store.read('UserItemToken').token, tokenResponse.dataTokens.UserItemToken);
    const randomSeeds = app.store.read('UserRandomSeed');
    const seedBody = { badges: null, checksums: { before: { UserRandomSeed: randomSeeds.token },
      after: { UserRandomSeed: '22222222222222222222222222222222' } }, dataTokens: { UserRandomSeed: randomSeeds.token },
      deltas: [{ deleteItems: { UserRandomSeed: [randomSeeds.data[0]] }, putItems: {}, signature: 0, trigger: 'Blocking' }],
      operations: [], scripts: {} };
    const seedResponse = JSON.parse((await request(port, 3, seedBody)).body);
    assert.equal(seedResponse.data.UserRandomSeed.length, 1);
    assert.deepEqual(Object.keys(seedResponse.data.UserRandomSeed[0]).sort(), ['consumer', 'seed', 'signature', 'userId']);
    assert.equal(app.store.read('UserRandomSeed').data.length, 25);
    assert.equal(app.store.read('UserRandomSeed').token, seedResponse.dataTokens.UserRandomSeed);
    const tutorial = await request(port, 4, { lotteryId: 1, pcId: 1011002001 }, '8', 'tutorial/draw');
    assert.equal(tutorial.status, 200);
    const tutorialBody = JSON.parse(tutorial.body);
    const { operation, operations, ...tutorialResult } = tutorialBody;
    assert.deepEqual(tutorialResult.lotteryPCs, [{ pcId: 1011002001, isFirst: true }]);
    assert.equal(app.store.read('UserPC').data.some(row => row.pcId === 1011002001), false);
    assert.equal(tutorialResult.UserPC[0].pcId, 1011002001);
    assert.deepEqual(tutorialResult.UserLimitBreakItem, []);
    assert.deepEqual(tutorialResult.UserCommunicationCharacter, []);
    assert.deepEqual(tutorialResult.UserHeroSublimatePCs, []);
    assert.equal(tutorialResult.UserPC[0].userId, seed.userId);
    assert.equal(tutorialResult.UserPC[0].currentJobIndex, 1);
    assert.equal(operation.type, 1001);
    assert.ok(Number.isSafeInteger(operation.id) && operation.id > 0);
    assert.deepEqual(operations, [operation]);
    assert.deepEqual(app.store.operations(), [operation]);
    const tutorials = app.store.read('UserTutorial');
    assert.deepEqual(JSON.parse((await request(port, 4, { lotteryId: 1, pcId: 1011002001 }, '8', 'tutorial/draw')).body), tutorialBody);
    const pendingTutorial = JSON.parse((await request(port, 5, { lotteryId: 1, pcId: 1011002001 }, '21', 'tutorial/draw')).body);
    assert.deepEqual(pendingTutorial, tutorialBody);
    assert.equal(app.store.operations().filter(row => row.type === 1001).length, 1);
    const tutorialFlag = { userId: seed.userId, tutorialId: 780030005, isEnd: true };
    const acknowledge = drawAcknowledgement(tutorialBody, { UserTutorial: [tutorialFlag] });
    const tutorialAck=JSON.parse((await request(port, 6, acknowledge, '9')).body);
    assert.deepEqual(tutorialAck.operations,[{id:operation.id}]);
    assert.deepEqual(tutorialAck.dones,tutorialAck.operations);
    assert.equal(app.store.operations().length, 0);
    const acknowledgeAgain = { badges: null, checksums: { before: {}, after: {} }, dataTokens: {}, deltas: [],
      operations: acknowledge.operations, scripts: {} };
    const tutorialAckAgain=JSON.parse((await request(port, 7, acknowledgeAgain, '10')).body);
    assert.deepEqual(tutorialAckAgain.operations,[{id:operation.id}]);
    assert.deepEqual(tutorialAckAgain.dones,tutorialAckAgain.operations);
    assert.equal((await request(port, 7, { lotteryId: 1 }, '11', 'tutorial/draw')).status, 400);
    const jobSets = app.store.read('UserPCJobSet');
    const secondJobSet = { ...jobSets.data[0], pcId: 1011002001 };
    const jobSetPush = { badges: null, checksums: { before: { UserPCJobSet: jobSets.token },
      after: { UserPCJobSet: '33333333333333333333333333333333' } }, dataTokens: { UserPCJobSet: jobSets.token },
      deltas: [{ deleteItems: {}, putItems: { UserPCJobSet: [secondJobSet] }, signature: 0, trigger: 'LotteryDraw' }],
      operations: [], scripts: {} };
    assert.equal((await request(port, 8, { lotteryId: 1, pcId: 1011002001 }, '22', 'tutorial/draw')).status, 400);
    assert.equal((await request(port, 9, jobSetPush, '12')).status, 200);
    assert.deepEqual(app.store.read('UserPCJobSet').data.map(item => item.pcId).sort(), [1011001001, 1011002001]);
    const drawRequest = { buttonIndex: 2, clientChargeHardCurrency: 0, clientFreeHardCurrency: 0,
      clientTotalHardCurrency: 0, consumeAmount: 0, currentStepIndex: 0, isScratch: false,
      lotteryId: 171001765, pickCount: 1, progressCount: 0 };
    const draw = await request(port, 10, drawRequest, '13', 'lottery/draw');
    assert.equal(draw.status, 200);
    const drawBody = JSON.parse(draw.body);
    assert.equal(drawBody.lotteryPCs.length, 1);
    assert.ok(Object.values(master.lotteryPools[master.lotteries[drawRequest.lotteryId].groupId]).flat().includes(drawBody.lotteryPCs[0].pcId));
    assert.equal(drawBody.UserLottery[0].buttons[1].count, 1);
    assert.deepEqual(app.store.read('UserLottery').data, drawBody.UserLottery);
    assert.equal(drawBody.operation.type, 1000);
    const ownedAfterDraw = app.store.read('UserPC');
    const reorderedDraw = Object.fromEntries(Object.entries(drawRequest).reverse());
    const resumedDraw = await request(port, 11, reorderedDraw, '131', 'lottery/draw');
    assert.equal(resumedDraw.status, 200);
    assert.deepEqual(JSON.parse(resumedDraw.body), drawBody, 'New sequence must resume the same result');
    assert.deepEqual(app.store.read('UserPC'), ownedAfterDraw);
    assert.equal((await request(port, 12, { ...drawRequest, lotteryId: 2 }, '132', 'lottery/draw')).status, 400);
    const ticketRequest = { ...drawRequest, lotteryId: 171000132, consumeAmount: 1, drawCount: 1 };
    assert.equal((await request(port, 12, ticketRequest, '133', 'lottery/ticket/draw')).status, 400);
    app.store.push(drawAcknowledgement(drawBody));
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM lottery_request').get().n, 0);
    const now = Math.floor(Date.now() / 1000);
    const ticket = { userId: seed.userId, gachaTicketId: 296000020, bookEntryState: 1, cumulativeAmount: 2,
      dateList: [{ aquiredAt: now - 1 }, { aquiredAt: now }] };
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([ticket]), 'UserGachaTicket');
    const ticketDraw = await request(port, 12, ticketRequest, '14', 'lottery/ticket/draw');
    assert.equal(ticketDraw.status, 200);
    const ticketResult = JSON.parse(ticketDraw.body);
    assert.equal(ticketResult.lotteryPCs.length, 1);
    assert.ok(Object.values(master.lotteryPools[master.lotteries[ticketRequest.lotteryId].groupId]).flat().includes(ticketResult.lotteryPCs[0].pcId));
    assert.deepEqual(ticketResult.userGachaTicket.dateList, [{ aquiredAt: now }]);
    assert.deepEqual(app.store.read('UserGachaTicket').data, [ticketResult.userGachaTicket]);
    // DEFERRED legacy-cost mapping fixture; not native encounter/restoration proof.
    app.store.changeHardCurrency(master.consumes[81021001].amount);
    const continueWallet=app.store.hardCurrency()+app.store.paidCurrency();
    const battleContinue = await request(port, 13, undefined, '15', 'battle/continue');
    assert.equal(battleContinue.status, 200);
    const continueOperation=JSON.parse(battleContinue.body).operation;
    assert.equal(continueOperation.type, 4000);
    assert.deepEqual(JSON.parse(battleContinue.body).operations,[continueOperation]);
    assert.equal(app.store.hardCurrency()+app.store.paidCurrency(),continueWallet-master.consumes[81021001].amount);
    app.store.push({badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{}},deltas:[],
      operations:[{id:continueOperation.id,verifier:continueOperation.token}]});
    const gifts = app.store.read('UserGift');
    const gift = { userId: seed.userId, id: 1, senderType: 0, senderId: 0, title: 'Offline gift', message: '',
      itemId: 205000002, amount: 1, giftAcquiredType: 0, itemLevel: 0, equipmentId: 0, equipmentEvolveCount: 0,
      pcLimitBreakCount: 0, pcHeroSublimateCount: 0, startAt: 0, expireAt: 0, state: 0, createdAt: 0, dynamodbExpireAt: 0 };
    app.store.push({ badges: null, checksums: { before: { UserGift: gifts.token },
      after: { UserGift: '44444444444444444444444444444444' } }, dataTokens: { UserGift: gifts.token },
      deltas: [{ deleteItems: {}, putItems: { UserGift: [gift] }, signature: 0, trigger: 'Blocking' }],
      operations: [], scripts: {} });
    const received = await request(port, 14, { userId: seed.userId, giftIds: [gift.id] }, '16', 'gift/receive');
    assert.equal(received.status, 200);
    const giftOperation = JSON.parse(received.body).operations[0];
    assert.equal(giftOperation.type, 2000);
    assert.deepEqual(giftOperation.parameters.UserGift, [gift]);
    assert.deepEqual(giftOperation.parameters.receivedItems, [{ itemId: 205000002, amount: 1 }]);
    // DEFERRED explicit offline restoration: one opaque legacy gate at the
    // surviving authored 10-Iris recovery price, not publisher-price parity.
    const dungeonCost=master.consumes[81021001].amount;
    app.store.changeHardCurrency(dungeonCost);
    const dungeonIris=app.store.hardCurrency()+app.store.paidCurrency(),
      dungeonTicket = await request(port, 15, { id: 1 }, '17', 'dungeon/ticket/issue');
    assert.equal(dungeonTicket.status,200);
    const dungeonResult=JSON.parse(dungeonTicket.body),dungeonOperation=dungeonResult.operation;
    assert.equal(dungeonOperation.type,3000);assert.deepEqual(dungeonOperation.parameters,{});
    assert.deepEqual(dungeonResult.operations,[dungeonOperation]);
    assert.deepEqual(app.store.db.prepare('SELECT dungeon_id,iris_cost,amount FROM dungeon_ticket_issue WHERE operation_id=?')
      .get(dungeonOperation.id),{dungeon_id:1,iris_cost:dungeonCost,amount:1});
    assert.equal(app.store.db.prepare('SELECT COUNT(*) amount FROM dungeon_ticket_request WHERE operation_id=?')
      .get(dungeonOperation.id).amount,1);
    assert.equal(app.store.hardCurrency()+app.store.paidCurrency(),dungeonIris-dungeonCost);
    const dungeonReplay=await request(port,15,{id:1},'17','dungeon/ticket/issue');
    assert.equal(dungeonReplay.status,200);assert.deepEqual(dungeonReplay.body,dungeonTicket.body);
    assert.equal(app.store.hardCurrency()+app.store.paidCurrency(),dungeonIris-dungeonCost);
    const dungeonAlias=await request(port,16,{id:1},'18','dungeon/ticket/issue');
    assert.equal(dungeonAlias.status,200);assert.deepEqual(dungeonAlias.body,dungeonTicket.body);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) amount FROM dungeon_ticket_request WHERE operation_id=?')
      .get(dungeonOperation.id).amount,2);
    assert.equal(app.store.hardCurrency()+app.store.paidCurrency(),dungeonIris-dungeonCost);
    app.store.push({badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{}},deltas:[],
      operations:[{id:dungeonOperation.id,verifier:dungeonOperation.token}]});
    assert(!app.store.operations().some(row=>row.id===dungeonOperation.id));
    assert.equal((await request(port,15,{id:1},'17','dungeon/ticket/issue')).status,503);
    assert.equal(app.store.hardCurrency()+app.store.paidCurrency(),dungeonIris-dungeonCost);
    const stageResult = { adventureGainedItems: [{ amount: 408, itemId: 205000002 }, { amount: 1, itemId: 294000001 }],
      adventureRecord: { continueCount: 0, deathCount: 0, linkageSkillCount: 0, normalAttackCount: 3,
        skillCount: 2, specialSkillCount: 0, turnCount: 3 }, adventureStageId: 1010000101101,
      adventureStageTaskIds: [682000001, 682000002, 682000003], friendshipStates: [
        { characterId: 101000017, friendship: 5, friendshipLv: 1, userHeroType: 0 },
        { characterId: 101000036, friendship: 5, friendshipLv: 1, userHeroType: 0 },
        { characterId: 101000001, friendship: 5, friendshipLv: 1, userHeroType: 0 }],
      isEnemyAnnihilated: true, secretMissionCompleted: false, token: '1000000001-697473633' };
    const stageBefore = app.store.read('UserAdventureStage');
    const completed = await request(port, 17, stageResult, '19', 'adventure/stage/complete');
    assert.equal(completed.status, 200);
    const completion = JSON.parse(completed.body);
    assert.equal(completion.operations[0].type, 5000);
    assert.equal(completion.operations[0].parameters.UserAdventureStage[0].adventureStageId, stageResult.adventureStageId);
    assert.deepEqual(completion.operations[0].parameters.UserAdventureStage,
      [{ ...stageBefore.data.find(row => row.adventureStageId === stageResult.adventureStageId), token: stageResult.token }]);
    assert.deepEqual(app.store.read('UserAdventureStage'), stageBefore);
    assert.deepEqual((await request(port, 17, stageResult, '19', 'adventure/stage/complete')).body, completed.body);
    assert.deepEqual(completion.gainedItems, [{ itemId: 205000002, amount: 10408 }, { itemId: 294000001, amount: 1 }]);
    assert.equal(app.store.hardCurrency(), 3);
    assert.deepEqual(completion.friendshipStates,
      stageResult.friendshipStates.map(({ characterId, friendship }) => ({ characterId, friendship })));
    assert.equal(completion.skipCount, 0);
    assert.equal((await request(port, 18, { expeditionStageId: 1 }, '20', 'expedition/complete')).status, 400);
    let nextSequence = 19;
    const send = (value, action = 'user_data/push') => request(port, nextSequence++, value, '30', action);
    // A real PvE clear uses its own endpoint and operation 16000, never 5000.
    const pveResult = { ...stageResult, adventureStageId: 1120000901101,
      adventureStageTaskIds: [], token: 'pve-wrong-endpoint' };
    const pendingBeforeMisroute = app.store.operations();
    assert.equal((await send(pveResult, 'adventure/stage/complete')).status, 400);
    assert.equal((await send(pveResult, 'pve/stage/complete')).status, 400,
      'PVE now requires its actual battle statistics and historical party, not a generic stage payload');
    assert.equal((await send({ ...pveResult, adventureStageId: 1150000101101 }, 'pvb/stage/complete')).status, 400,
      'PvB requires its actual pvbStageId and userPvBScore, not a generic stage payload');
    assert.deepEqual(app.store.operations(), pendingBeforeMisroute);
    assert.deepEqual(app.store.read('UserAdventureStage'), stageBefore);
    assert.equal(app.store.hardCurrency(), 3);
    assert.deepEqual((await send(stageResult, 'adventure/stage/complete')).body, completed.body);
    assert.equal(app.store.hardCurrency(), 3);
    assert.equal((await send({ ...stageResult, token: 'different-pending-token' }, 'adventure/stage/complete')).status, 400);
    assert.equal((await send({ ...stageResult, adventureStageTaskIds: [682000004] }, 'adventure/stage/complete')).status, 400);
    const stageCompletedAt = Math.floor(Date.now() / 1000);
    const stageRow = { ...completion.UserAdventureStage[0], state: 4,
      cumulativeClearCount: completion.UserAdventureStage[0].cumulativeClearCount + 1,
      firstCompleteDateTime: completion.UserAdventureStage[0].firstCompleteDateTime || stageCompletedAt,
      lastCompleteDateTime: stageCompletedAt,
      tasks: completion.UserAdventureStage[0].tasks.map(task => stageResult.adventureStageTaskIds.includes(task.adventureStageTaskId)
        ? { ...task, state: 1 } : task) };
    const stageSaveBody = (operation, saved) => {
      const before = operation.parameters.UserAdventureStage[0];
      let putItems = { UserAdventureStage: [saved ?? { ...before, state:4,cumulativeClearCount:before.cumulativeClearCount+1,
        firstCompleteDateTime:before.firstCompleteDateTime || stageCompletedAt,lastCompleteDateTime:stageCompletedAt,
        tasks:before.tasks.map(task => operation.parameters.adventureStageTaskIds.includes(task.adventureStageTaskId)
          ? { ...task,state:1 } : task) }] };
      // Synthetic complete saves; the new stage inventory check owns the
      // separate missing/partial/spent-loot cases. Finish these stages before
      // switching protocol families, rather than leaving fake dangling clears.
      for (const target of app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(operation.id)) {
        const previous = app.store.read(target.table_name).data.find(row => row[target.id_field] === target.item_id);
        (putItems[target.table_name] ??= []).push({ ...previous,userId:seed.userId,[target.id_field]:target.item_id,
          ...(target.table_name==='UserAdventureTicket' && !previous?{lastResetAt:0,bookEntryState:1,signature:0}:{}),
          ...(target.table_name==='UserMemoriaExpItem' && !previous?{lastAquiredAt:0,reservedAmount:0,bookEntryState:1,signature:0}:{}),
          ...(target.table_name==='UserAlarmVoiceItem' && !previous?{reservedAmount:0,bookEntryState:1,signature:0}:{}),
          ...(target.table_name==='UserLimitBreakItem' && !previous?{bookEntryState:1,signature:0}:{}),
          cumulativeAmount:target.cumulative_amount,...(target.table_name==='UserGachaTicket' ?
            {dateList:[],signature:operation.signature,bookEntryState:!previous || previous.bookEntryState===1?3:previous.bookEntryState} : { amount:0 }) });
      }
      if (operation.parameters.friendshipStates?.length) {
        const key = ['friendship','friendshipAis','friendshipLef'][app.store.read('UserInfo').data[0].heroType];
        putItems.UserCharacter = operation.parameters.friendshipStates.map(row => ({
          ...app.store.read('UserCharacter').data.find(character => character.characterId === row.characterId), [key]:row.friendship }));
      }
      putItems = stageXpFixture(app.store,putItems,[operation]);
      return { badges:null,checksums:{ before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows]) => [name,md5(JSON.stringify(rows))])) },
        dataTokens:{},deltas:[{ deleteItems:{},putItems,signature:0,trigger:'AdventureComplete' }],
        operations:[{ id:operation.id,verifier:operation.token }],scripts:{} };
    };
    const stageAck = stageSaveBody(completion.operations[0],stageRow);
    assert.equal((await send(stageAck)).status, 200);
    assert.equal((await send({ ...acknowledgeAgain, operations: stageAck.operations })).status, 200);
    assert.equal(app.store.read('UserAdventureStage').data.find(row => row.adventureStageId === stageRow.adventureStageId).cumulativeClearCount,
      stageRow.cumulativeClearCount);
    assert.equal((await send(stageResult, 'adventure/stage/complete')).status, 503);
    // The reward ledger also prevents a stale client task snapshot from regranting Iris on the next run.
    const repeat = await send({ ...stageResult, token: 'next-run' }, 'adventure/stage/complete');
    assert.equal(repeat.status, 200); assert.equal(app.store.hardCurrency(), 3);
    assert.deepEqual(JSON.parse(repeat.body).gainedItems, stageResult.adventureGainedItems);
    assert.equal((await send(stageSaveBody(JSON.parse(repeat.body).operation))).status, 200);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_reward').get().n, 4);
    assert.equal((await send({ ...stageResult, adventureStageId: 1010000101102,
      adventureStageTaskIds: [682000001], token: 'wrong-stage-objective' }, 'adventure/stage/complete')).status, 400);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_reward').get().n, 4);
    const story = { adventureStageId: 1010000101103, adventureRecord: { continueCount: 0, deathCount: 0,
      normalAttackCount: 0, skillCount: 0, specialSkillCount: 0, turnCount: 0 }, token: 'story-clear' };
    assert.equal((await send({ ...story, adventureStageId: 1010000101102 }, 'adventure/stage/complete')).status, 400);
    assert.throws(() => app.store.transaction(() => {
      app.store.issueStageCompletion(story, master); throw new Error('stage reward rollback');
    }), /stage reward rollback/);
    assert.equal(app.store.hardCurrency(), 3);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_reward').get().n, 4);
    const storyResult = await send(story, 'adventure/stage/complete');
    assert.equal(storyResult.status, 200); assert.equal(app.store.hardCurrency(), 8);
    assert.deepEqual(JSON.parse(storyResult.body).gainedItems, []);
    assert.deepEqual(JSON.parse(storyResult.body).friendshipStates, []);
    assert.deepEqual((await send(story, 'adventure/stage/complete')).body, storyResult.body);
    assert.equal((await send(stageSaveBody(JSON.parse(storyResult.body).operation))).status, 200);
    assert.equal(app.store.hardCurrency(), 8);
    app.store.changeHardCurrency(-5);
    app.store.changeHardCurrency(-3); // Isolate the subsequent friendship balance assertions.

    const friendshipStates = [{ characterId: 101000002, friendship: 90304, friendshipLv: 41, userHeroType: 0 }];
    const friendBefore = app.store.read('UserCharacter');
    const friendship = await send({ friendshipStates }, 'character/friendship/complete');
    assert.equal(friendship.status, 200);
    const friendResult = JSON.parse(friendship.body);
    assert.equal(friendResult.operations[0].type, 11000);
    assert.deepEqual(friendResult.friendshipStates, friendshipStates);
    assert.equal(friendResult.issueAmount, 75);
    assert.deepEqual(friendResult.gainedItems.sort((a, b) => a.itemId - b.itemId),
      [{ itemId: 99000001, amount: 1 }, { itemId: 294000019, amount: 2 }]);
    assert.equal(friendResult.operations.length, 1, 'CP rewards must not use the ordinary-item operation 11100');
    assert.deepEqual(app.store.read('UserCharacter'), friendBefore);
    assert.equal(app.store.hardCurrency(), 75);
    const friendRetry = JSON.parse((await send({ friendshipStates }, 'character/friendship/complete')).body);
    assert.equal(friendRetry.operations.find(row => row.type === 11000).id, friendResult.operations[0].id);
    assert.equal(app.store.hardCurrency(), 75);
    const conflict = [{ ...friendshipStates[0], friendship: 90305 }];
    assert.equal((await send({ friendshipStates: conflict }, 'character/friendship/complete')).status, 503);
    const completedCharacter = { ...friendBefore.data.find(row => row.characterId === 101000002), friendship: 90304 };
    const friendshipItems = require('./test_friendship_rewards.cjs').itemDeltas(app.store,friendResult.operations[0]);
    assert.equal((await send({ badges: null,
      checksums: { before: { UserCharacter: friendBefore.token },
        after: { UserCharacter: '77777777777777777777777777777777', ...Object.fromEntries(Object.entries(friendshipItems)
          .map(([name,rows]) => [name,crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex')])) } },
      dataTokens: { UserCharacter: friendBefore.token },
      deltas: [{ deleteItems: {}, putItems: { UserCharacter: [completedCharacter], ...friendshipItems },
        signature: 0, trigger: 'FriendshipComplete' }],
      operations: friendResult.operations.map(row => ({ id: row.id, verifier: row.token })), scripts: {} })).status, 200);
    const collectedAgain = JSON.parse((await send({ friendshipStates }, 'character/friendship/complete')).body);
    assert.equal(collectedAgain.issueAmount, 0);
    assert.deepEqual(collectedAgain.gainedItems, []);
    assert.equal(app.store.hardCurrency(), 75);
    assert.equal((await send({ friendshipStates, itemId: 215000001, itemAmount: 1 }, 'character/friendship/complete')).status, 400);
    const currencyBeforeRollback = app.store.hardCurrency();
    assert.throws(() => app.store.transaction(() => { app.store.changeHardCurrency(-10); throw new Error('rollback charge'); }), /rollback charge/);
    assert.equal(app.store.hardCurrency(), currencyBeforeRollback);
    //The generic fixture date predates Abyss. Its10600 calendar/exact-save
    //contracts are deferred separately; no inactive return-only purchase.
    for (const [consumeId, type] of [[81041001,10200], [81021001,10100], [81051001,10400], [81061001,10500]]) {
      const before = app.store.hardCurrency();
      const charge = await send({ consumeId }, 'currency/hard/consume');
      assert.equal(charge.status, 200);
      const charged = JSON.parse(charge.body);
      assert.equal(charged.operations[0].type, type);
      assert.equal(app.store.hardCurrency(), before - 10);
      assert.deepEqual(JSON.parse((await send({ consumeId }, 'currency/hard/consume')).body), charged);
      assert.equal(app.store.hardCurrency(), before - 10);
      const savedInfo = structuredClone(app.store.read('UserInfo').data);
      const receipt = app.store.db.prepare('SELECT * FROM hard_currency_consume WHERE operation_id=?').get(charged.operations[0].id);
      if (receipt.sp_field) savedInfo[0].playerStatus[receipt.sp_field] = receipt.sp_minimum;
      if(type===10500) Object.assign(savedInfo[0].playerStatus,pvbRefill(JSON.parse(receipt.pvb_baseline),receipt.pvb_issued_at).candidates[0].after);
      assert.equal((await send({ ...acknowledgeAgain,
        checksums: { before: {}, after: receipt.sp_field ? { UserInfo: md5(JSON.stringify(savedInfo)) } : {} },
        deltas: receipt.sp_field ? [{ signature: 0, trigger: 'Stamina', putItems: { UserInfo: savedInfo }, deleteItems: {} }] : [],
        operations: charged.operations.map(row => ({ id: row.id, verifier: row.token })) })).status, 200);
    }
    assert.equal((await send({consumeId:81071001},'currency/hard/consume')).status,503);
    const balance = JSON.parse((await get(port, '/billing/v1.0/payment/balance')).body);
    assert.equal(balance.entry.balance_free_gem, 35);
    assert.equal(balance.entry.balance_total_gem, 35);
    assert.equal(balance.entry.balance_charge_gem, 0);
    assert.equal((await send({ consumeId: 81031001 }, 'currency/hard/consume')).status, 503);
    const achievements = app.store.read('UserAchievement');
    const completedAt = Math.floor(Date.now() / 1000);
    const claimed = { userId: seed.userId, achievementId: 6020000001, completedAt,
      lastResetAt: 0, progressParam: 2, readState: 1, signature: 0, state: 3 };
    const itemClaim = { ...claimed, achievementId: 6010000005 };
    const unsupportedClaim = { ...claimed, achievementId: 6090000001, completedAt: master.achievements[6090000001].expireAt };
    const saveAchievements = (rows, operations = []) => {
      const before = app.store.read('UserAchievement');
      return { badges: null, checksums: { before: { UserAchievement: before.token },
        after: { UserAchievement: md5(JSON.stringify(rows)) } }, dataTokens: { UserAchievement: before.token },
        deltas: [{ deleteItems: {}, putItems: { UserAchievement: rows }, signature: 0, trigger: 'Achievement' }],
        operations, scripts: {} };
    };
    assert.equal((await send(saveAchievements([claimed, itemClaim, unsupportedClaim]))).status, 200);
    const claimRequest = { achievementIds: [{ achievementId: claimed.achievementId, completedAt },
      { achievementId: itemClaim.achievementId, completedAt }] };
    assert.equal((await send({ achievementIds: [{ achievementId: claimed.achievementId, completedAt: completedAt + 1 }] },
      'achievement/complete')).status, 400);
    const claim = await send(claimRequest, 'achievement/complete');
    assert.equal(claim.status, 200);
    const claimResult = JSON.parse(claim.body), claimOperation = claimResult.operations[0];
    assert.equal(claimOperation.type, 6000);
    assert.equal(claimResult.issueAmount, 10);
    assert.deepEqual(claimResult.receivedItems, [{ itemId: 295000001, amount: 3 }]);
    assert.equal(app.store.hardCurrency(), 45);
    const claimRetry = JSON.parse((await send({ achievementIds: [...claimRequest.achievementIds].reverse() },
      'achievement/complete')).body);
    assert.equal(claimRetry.operations[0].id, claimOperation.id);
    assert.equal(app.store.hardCurrency(), 45);
    assert.equal((await send({ achievementIds: [claimRequest.achievementIds[0]] }, 'achievement/complete')).status, 400);
    const pendingCount = app.store.operations().length;
    assert.equal((await send({ achievementIds: [{ achievementId: unsupportedClaim.achievementId, completedAt: unsupportedClaim.completedAt }] },
      'achievement/complete')).status, 503);
    assert.equal(app.store.operations().length, pendingCount);
    assert.equal(app.store.hardCurrency(), 45);
    const receivedAchievements = [claimed, itemClaim].map(row => ({ ...row, state: 4 }));
    const rewardSave = saveAchievements(receivedAchievements, [{ id: claimOperation.id, verifier: claimOperation.token }]);
    const previousReward = app.store.read('UserStaminaTicket').data.find(row => row.staminaTicketId === 295000001);
    const rewardTickets = [{ ...(previousReward ?? { userId: seed.userId, staminaTicketId: 295000001,
      signature: 0, bookEntryState: 3 }), amount: (previousReward?.amount ?? 0) + 3,
      cumulativeAmount: (previousReward?.cumulativeAmount ?? 0) + 3 }];
    rewardSave.deltas[0].putItems.UserStaminaTicket = rewardTickets;
    rewardSave.checksums.after.UserStaminaTicket = md5(JSON.stringify(rewardTickets));
    assert.equal((await send(rewardSave)).status, 200);
    assert.equal((await send(claimRequest, 'achievement/complete')).status, 400);
    const activity = await send({ recordType: 401 }, 'achievement/familia/add');
    assert.equal(activity.status, 200); assert.deepEqual(JSON.parse(activity.body), { code: 0 });
    assert.deepEqual((await send({ recordType: 401 }, 'achievement/familia/add')).body, activity.body);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_activity').get().n, 1);
    assert.equal((await send({ recordType: 402 }, 'achievement/familia/add')).status, 503);
    assert.equal((await send({ recordType: '401' }, 'achievement/familia/add')).status, 400);
    assert.equal((await send({ recordType: 401, amount: 10 }, 'achievement/familia/add')).status, 400);
    const emptyFriends = {
      'friend/following/list': { code: 0, current: 0, pageCount: 0, followingCount: 0, following: [] },
      'friend/follower/list': { code: 0, current: 0, pageCount: 0, followersCount: 0, followers: [], followerListLastViewedAt: 0 },
      'friend/support/list': { code: 0, is_fullset: true, supporters: [] },
    };
    for (const [action, expected] of Object.entries(emptyFriends)) {
      const value = action === 'friend/support/list' ? undefined : { page: 0 };
      const response = await send(value, action);
      assert.equal(response.status, 200, action);
      assert.deepEqual(JSON.parse(response.body), expected);
      assert.deepEqual((await send(value, action)).body, response.body);
      assert.equal((await send({ page: -1 }, action)).status, 400);
      assert.equal((await send({ page: '0' }, action)).status, 400);
      assert.equal((await send({ page: 0, userId: seed.userId }, action)).status, 400);
    }
    const friendStatus = app.store.read('UserFriendStatus');
    for (const counts of [{ followCount: 1 }, { followerCount: 1 }, { friendId: 42 }]) {
      app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([counts]), 'UserFriendStatus');
      for (const action of Object.keys(emptyFriends))
        assert.equal((await send(action === 'friend/support/list' ? undefined : { page: 0 }, action)).status, 503);
      assert.deepEqual(app.store.read('UserFriendStatus').data, [counts], 'Unavailable social data must not be overwritten');
    }
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify(friendStatus.data), 'UserFriendStatus');
    const shopRequest = { shopProductId: 207000002 };
    assert.equal((await send({ shopProductId: 0 }, 'shop/buy')).status, 400);
    assert.equal((await send({ ...shopRequest, count: 2 }, 'shop/buy')).status, 400);
    assert.equal((await send({ shopProductId: 999 }, 'shop/buy')).status, 400);
    assert.equal((await send({ shopProductId: 207004301 }, 'shop/buy')).status, 400, 'Paid equipment pack cannot spend free Iris');
    assert.equal((await send({ shopProductId: 207000008 }, 'shop/buy')).status, 400, 'Item exchange requires its saved item debit');
    assert.equal((await send({ shopProductId: 207000003 }, 'shop/buy')).status, 400, 'Must not overspend Iris');
    assert.equal(app.store.hardCurrency(), 45);
    const bought = JSON.parse((await send(shopRequest, 'shop/buy')).body), purchase = bought.operations[0];
    assert.equal(purchase.type, 9000);
    assert.equal(bought.count, 1);
    assert.equal(bought.purchaseCount, undefined);
    assert.deepEqual(bought.boughtItems, [{ itemId: 298000001, amount: 1 }]);
    assert.deepEqual(bought.boughtCostumes, []);
    assert.deepEqual(bought.boughtEquipments, []);
    assert.equal(app.store.hardCurrency(), 35);
    assert.deepEqual(JSON.parse((await send(shopRequest, 'shop/buy')).body), bought);
    assert.equal(app.store.hardCurrency(), 35, 'Pending purchase must only debit once');
    const shopTable = app.store.read('UserShopProduct'), orbs = app.store.read('UserAdventureTicket');
    const shopDelta = { UserShopProduct: [{ userId: seed.userId, shopProductId: shopRequest.shopProductId,
      count: bought.count, lastExchangedAt: bought.lastExchangedAt, readState: 1 }],
      UserAdventureTicket: [{ userId: seed.userId, adventureTicketId: 298000001, amount: 1,
        cumulativeAmount: 1, bookEntryState: 3, lastResetAt: 0, signature: purchase.signature }] };
    const shopAck = { badges: null, checksums: {
      before: { UserShopProduct: shopTable.token, UserAdventureTicket: orbs.token },
      after: Object.fromEntries(Object.entries(shopDelta).map(([key, rows]) => [key, md5(JSON.stringify(rows))])) },
      dataTokens: {}, deltas: [{ deleteItems: {}, putItems: shopDelta, signature: 0, trigger: 'ShopBuy' }],
      operations: [{ id: purchase.id, verifier: purchase.token }], scripts: {} };
    assert.equal((await send(shopAck)).status, 200);
    assert.equal(app.store.read('UserShopProduct').data[0].count, 1);
    assert.equal(app.store.read('UserAdventureTicket').data[0].amount, 1);
    const nextPurchase = JSON.parse((await send(shopRequest, 'shop/buy')).body);
    assert.notEqual(nextPurchase.operations[0].id, purchase.id);
    assert.equal(nextPurchase.count, 2);
    assert.equal(app.store.hardCurrency(), 25);
    app.store.db.exec("CREATE TEMP TRIGGER reject_test_purchase BEFORE INSERT ON operation_queue WHEN NEW.type=9000 BEGIN SELECT RAISE(ABORT, 'test purchase rollback'); END");
    assert.equal((await send({ shopProductId: 207000004 }, 'shop/buy')).status, 503);
    app.store.db.exec('DROP TRIGGER reject_test_purchase');
    assert.equal(app.store.hardCurrency(), 25, 'Failed operation must roll back its debit');
    await app.close();
    app = null;
    store = openStore({ database, seed });
    assert.equal(store.read('UserInfo').token, body.checksums.after.UserInfo);
    assert.equal(store.read('UserInfo').data[0].totalPlayingTime, row.totalPlayingTime);
    assert.equal(store.read('UserArea').data[0].encountCount, 0);
    assert.equal(store.read('UserPC').data.some(item => item.pcId === 1011002001), true);
    assert.deepEqual(store.read('UserTutorial').data.find(item => item.tutorialId === tutorialFlag.tutorialId), tutorialFlag);
    assert.equal(store.read('UserTutorial').token, acknowledge.checksums.after.UserTutorial);
    assert.equal(store.hardCurrency(), 25);
    assert.equal(store.db.prepare('SELECT amount FROM stage_reward WHERE key=?').get('stage:1010000101103').amount, 5);
    assert.equal(store.db.prepare('SELECT operation_id FROM stage_completion WHERE stage_id=? AND token=?')
      .get(story.adventureStageId,story.token).operation_id, JSON.parse(storyResult.body).operation.id);
    assert.throws(() => store.issueStageCompletion(story, master), /cannot be delivered again/);
    assert.equal(store.hardCurrency(), 25);
    assert.deepEqual(store.operations().find(row => row.id === nextPurchase.operations[0].id), nextPurchase.operations[0]);
    assert.equal(store.read('UserShopProduct').data[0].count, 1);
    assert.equal(store.read('UserAdventureTicket').data[0].amount, 1);
    assert.equal(store.recordFamiliaActivity(401), 0);
    assert.equal(store.db.prepare('SELECT COUNT(*) n FROM familia_activity').get().n, 1);
    assert.equal(store.read('UserAchievement').data.find(row => row.achievementId === claimed.achievementId).state, 4);
    assert.deepEqual(store.read('UserCharacter').data.find(row => row.characterId === 101000002), completedCharacter);
    assert.deepEqual(store.read('UserCharacterFriendshipReward').data, seed.data.UserCharacterFriendshipReward ?? []);
    assert.equal(store.db.prepare('SELECT COUNT(*) n FROM friendship_reward').get().n,
      master.characters[101000002].rewards.filter(row => row[1] <= 41 && row[5] === 0).length);
    store.close();
    app = createServer({ database, seed, master, resourceDirectory: resources, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const restartPort = app.server.address().port;
    assert.equal((await request(restartPort, 0, undefined, '40', 'user/login')).status, 200);
    const restartedDraw = await request(restartPort, 1, ticketRequest, '41', 'lottery/ticket/draw');
    assert.equal(restartedDraw.status, 200);
    assert.deepEqual(JSON.parse(restartedDraw.body), JSON.parse(ticketDraw.body), 'Pending lottery result survives session and process restart');
    assert.equal(app.store.operations().filter(row => row.type === 1000).length, 1);
    console.log('DanMemoRe SQLite persistence, exact client state, replay, manifests, and restart recovery: OK');
  } finally {
    if (app) await app.close().catch(() => {});
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
    catch (error) { if (error.code !== 'EPERM') throw error; }
  }
}

// Explicit synthetic EXP/SP and story progression prerequisites for OLD focused suites.
// The dedicated experience/unlock suites check missing effects without this helper.
function stageXpFixture(store,putItems,operations) {
  const claims = operations.map(row=>store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?').get(row.id)).filter(Boolean);
  let result = { ...putItems };
  if (!putItems.UserInfo && claims.length) result.UserInfo = store.read('UserInfo').data.map(row=>{
    const totalExp = Math.max(row.playerStatus.totalExp,...claims.map(claim=>claim.minimum_exp)),
      baseSP = Math.max(row.playerStatus.baseSP,...claims.filter(claim=>!claim.sp_effect_saved).map(claim=>claim.sp_minimum));
    return { ...row,playerStatus:{ ...row.playerStatus,totalExp,baseSP,
      level:master.playerLevels.findLast(([,threshold])=>threshold<=totalExp)[0] } };
  });
  if (putItems.UserAdventureStage) for (const operation of operations) {
    const receipt = store.db.prepare('SELECT next_unlock FROM stage_delivery WHERE operation_id=?').get(operation.id),
      target = receipt?.next_unlock ? JSON.parse(receipt.next_unlock) : null;
    if (!target?.stageId || ![null,0].includes(target.beforeState) ||
        !target.lowerStates.every(([,state])=>state===4) || result.UserAdventureStage.some(row=>row.adventureStageId===target.stageId)) continue;
    const next = store.read('UserAdventureStage').data.find(row=>row.adventureStageId===target.stageId) ?? {
      ...operation.parameters.UserAdventureStage[0],adventureStageId:target.stageId,cumulativeClearCount:0,
      dailyClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0,tasks:[],token:'' };
    result.UserAdventureStage = result.UserAdventureStage.concat({ ...next,state:next.state || 1 });
  }
  if (putItems.UserAdventureStage) for (const operation of operations) {
    const receipt = store.db.prepare('SELECT story_progression FROM stage_delivery WHERE operation_id=?').get(operation.id),
      story = receipt?.story_progression ? JSON.parse(receipt.story_progression) : null;
    for (const effect of story?.effects ?? []) {
      const prior = new Map(story.inputs).get(effect.stageId), existing = result.UserAdventureStage
        .find(row=>row.adventureStageId===effect.stageId) ?? store.read('UserAdventureStage').data.find(row=>row.adventureStageId===effect.stageId),
        base = existing ?? {...operation.parameters.UserAdventureStage[0],adventureStageId:effect.stageId,
          cumulativeClearCount:0,dailyClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0,tasks:[],token:''},
        date = result.UserAdventureStage.find(row=>row.adventureStageId===operation.parameters.UserAdventureStage[0].adventureStageId)
          ?.lastCompleteDateTime || 1790866800;
      const saved = effect.kind==='open' ? {...base,state:base.state || 1} : {...base,state:4,
        cumulativeClearCount:Math.max(base.cumulativeClearCount,(prior?.cumulativeClearCount ?? 0)+1),
        firstCompleteDateTime:prior?.firstCompleteDateTime || date,lastCompleteDateTime:date};
      result.UserAdventureStage = result.UserAdventureStage.filter(row=>row.adventureStageId!==effect.stageId).concat(saved);
    }
  }
  return friendshipUnlockFixture(store,result,operations);
}
// Explicit SYNTHETIC voice delta, not native CP earning, signatures or callbacks.
// No costume auto-grant or selection belongs to the CP-level refresh.
function friendshipVoiceFixture(store,operations) {
  const owned=new Map(store.read('UserCommunicationVoice').data.map(row=>[row.voiceId,row])),targets=new Map();
  for(const operation of operations) {
    const table=[11000,21000].includes(operation.type) ? 'friendship_reward_claim' : 'stage_delivery',
      raw=store.db.prepare(`SELECT friendship_unlocks FROM ${table} WHERE operation_id=?`).get(operation.id)?.friendship_unlocks,
      capture=raw ? JSON.parse(raw) : null;
    for(const target of capture?.voices?.refreshVoices ?? []) {
      const before=targets.get(target.voiceId) ?? owned.get(target.voiceId) ?? {userId:0,voiceId:target.voiceId,voiceState:1};
      targets.set(target.voiceId,{...before,voiceState:Math.max(before.voiceState,target.state)});
    }
  }
  return targets.size ? {UserCommunicationVoice:[...targets.values()]} : {};
}
// Explicit SYNTHETIC health/mana saves from the pending callback capture.
// Do not add them to voice-only fixtures: split-save checks must stay split.
function friendshipRefillFixture(store,operations,putRows=[]) {
  const targets=new Map();
  for(const operation of operations) {
    const table=[11000,21000].includes(operation.type) ? 'friendship_reward_claim' : 'stage_delivery',
      raw=store.db.prepare(`SELECT friendship_unlocks FROM ${table} WHERE operation_id=?`).get(operation.id)?.friendship_unlocks;
    for(const target of (raw ? JSON.parse(raw) : null)?.refills?.targets ?? []) {
      if(!target.hpRequired && !target.mpRequired) continue;
      const row=targets.get(target.pcId) ?? putRows.find(row=>row.pcId===target.pcId) ?? store.read('UserPC').data.find(row=>row.pcId===target.pcId);
      if(!row) throw new Error('Synthetic refill fixture requires the actual saved unit');
      targets.set(target.pcId,{...row,...(target.hpRequired ? {hp:target.hp} : {}),...(target.mpRequired ? {mp:target.mp} : {})});
    }
  }
  return targets.size ? {UserPC:[...targets.values()]} : {};
}
// ACK-only mixed-suite quest, voice AND refill convenience. Dedicated negative refresh
// checks do NOT use it: fabricated saves/signatures are not native acceptance.
function friendshipUnlockFixture(store,putItems,operations) {
  let result = {...putItems};
  for (const operation of operations) {
    const table = [11000,21000].includes(operation.type) ? 'friendship_reward_claim' : 'stage_delivery',
      raw = store.db.prepare(`SELECT friendship_unlocks FROM ${table} WHERE operation_id=?`).get(operation.id)?.friendship_unlocks,
      capture = raw ? JSON.parse(raw) : null;
    for (const effect of capture?.effects ?? []) {
      if (result.UserAdventureStage?.some(row=>row.adventureStageId===effect.stageId)) continue;
      const owned = store.read('UserAdventureStage').data.find(row=>row.adventureStageId===effect.stageId),
        base = owned ?? {...store.read('UserAdventureStage').data[0],adventureStageId:effect.stageId,
          token:'',tasks:[],cumulativeClearCount:0,dailyClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0};
      result.UserAdventureStage = [...(result.UserAdventureStage ?? []),{...base,state:base.state || 1}];
    }
  }
  for(const row of friendshipVoiceFixture(store,operations).UserCommunicationVoice ?? [])
    if(!result.UserCommunicationVoice?.some(saved=>saved.voiceId===row.voiceId))
      result.UserCommunicationVoice=[...(result.UserCommunicationVoice ?? []),row];
  for(const row of friendshipRefillFixture(store,operations,result.UserPC).UserPC ?? [])
    result.UserPC=[...(result.UserPC ?? []).filter(saved=>saved.pcId!==row.pcId),row];
  return result;
}
module.exports = { request, get, drawAcknowledgement, rewardCharacterFixture, rewardCostumeFixture, rewardUnitStoryFixture, communicationWardrobeFixture, rewardCommunicationFixture, stageXpFixture,friendshipUnlockFixture,friendshipVoiceFixture,friendshipRefillFixture };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
