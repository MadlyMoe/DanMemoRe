'use strict';

// DEFERRED synthetic native-shaped saves, NOT native character/board/EXP/stat
// initialization, gift provenance, natural progression or overall acceptance.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request,rewardCharacterFixture,rewardUnitStoryFixture } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = value => crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
const catalogIds = Object.values(master.pcs);
const ordinaryId = catalogIds.find(id => !master.pcHeroSublimateGroups[id] && !seed.data.UserPC.some(row => row.pcId === id));
const heroId = catalogIds.find(id => master.pcHeroSublimateGroups[id] && !seed.data.UserPC.some(row => row.pcId === id));

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-gift-characters-'));
  let database, app, port, sequence = 0, now = 1686794400;
  const open = async () => {
    app = createServer({ database, seed, master, wallNowSeconds: () => now, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const fresh = async name => { await close(); database = path.join(directory, `${name}.sqlite`); await open(); };
  const put = (name, data) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(data), md5(data), name);
  const send = (action, body) => request(port, ++sequence, body, String(sequence), action);
  const receive = gifts => send('gift/receive', { userId: seed.userId, giftIds: gifts.map(row => row.id) });
  const parse = reply => { assert.equal(reply.status, 200, reply.body.toString()); return JSON.parse(reply.body); };
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name, app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all()]));
  const push = (putItems = {}, operations = [], deleteItems = {}) => send('user_data/push', {
    badges: null, scripts: {}, dataTokens: {}, checksums: { before: {}, after: Object.fromEntries(
      [...new Set([...Object.keys(putItems), ...Object.keys(deleteItems)])].map(name => [name, md5(putItems[name] ?? [])])) },
    deltas: Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature: 0, trigger: 'GiftReceive', putItems, deleteItems }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })),
  });
  const gift = (id, pcId = ordinaryId, extra = {}) => ({ userId: seed.userId, id, itemId: pcId, amount: 1,
    title: 'Synthetic character present', message: '', senderType: 1, senderId: 0, giftAcquiredType: 2,
    itemLevel: 0, equipmentId: 0, equipmentEvolveCount: 0, pcLimitBreakCount: 0, pcHeroSublimateCount: 0,
    state: 0, startAt: now, expireAt: now + 100, createdAt: now, dynamodbExpireAt: 0, ...extra });
  const target = op => JSON.parse(app.store.db.prepare('SELECT targets FROM gift_pc_claim WHERE operation_id=?').get(op.id).targets);
  const saved = (pcId, minimum) => {
    const { pcJobs,character,wardrobe,unitStory, ...progress } = minimum;
    return { UserPC: [{ ...structuredClone(seed.data.UserPC[0]), pcId, ...progress, joiningState: 1, userId: seed.userId }],
      ...(character ? { UserCharacter:rewardCharacterFixture(app.store.read('UserCharacter').data,[pcId]) } : {}),
      ...(unitStory ? rewardUnitStoryFixture(app.store.read('UserAdventureStage').data,[pcId]) : {}),
      ...(wardrobe ? {UserCharacterCostume:wardrobe.targets.map(row=>({userId:0,costumeId:row.costumeId,costumeState:row.state})),
        UserCommunicationVoice:wardrobe.targets.flatMap(row=>row.voices.map(voice=>({userId:0,voiceId:voice.voiceId,voiceState:voice.state})))} : {}),
      UserPCJobSet: [{ userId: seed.userId, pcId, pcJobs: pcJobs.map(row => ({ ...row, signature: 0, abilityPanels: [] })) }] };
  };
  const rejected = async (response, status, before, unavailable = false) => {
    const reply = await response; assert.equal(reply.status, status, reply.body.toString()); assert.equal(snapshot(), before);
    if (unavailable) assert.equal(JSON.parse(reply.body).code, OFFLINE_UNAVAILABLE_CODE);
  };
  const fullMask = (jobId, count = 5) => Object.values(master.pcAbilityPanels)
    .filter(panel => panel.groupId === master.pcJobPanelGroups[jobId] && panel.index <= count * 5)
    .reduce((mask, panel) => mask | 1 << (panel.index - 1), 0x2000000);
  try {
    await fresh('catalog'); assert.equal(catalogIds.length, 1364);
    // Metadata/target coverage only. This does not exercise1364 native screens.
    const catalogPcs=new Map(app.store.read('UserPC').data.map(row=>[row.pcId,row]));
    for (const pcId of catalogIds) {
      const grant = app.store.giftPcGrants({ receivedPCs: [pcId], receivedExPCs: [] })[0];
      if(catalogPcs.get(pcId)?.joiningState===0) {
        const before=snapshot();assert.throws(()=>app.store.giftPcTarget(grant),error=>error.status===400);
        assert.equal(snapshot(),before,'Unjoined bootstrap is not an owned present target or a fresh initializer');continue;
      }
      const minimum = app.store.giftPcTarget(grant);
      assert.equal(minimum.limitbreakCount, 0); assert.ok(Array.isArray(minimum.pcJobs));
      if (!seed.data.UserPC.some(row => row.pcId === pcId)) assert.deepEqual(minimum.pcJobs, []);
    }
    for (const [name, pcId, upgrade] of [['ordinary', ordinaryId, {}], ['eligible-ordinary', heroId, {}],
      ['limit-one', ordinaryId, { pcLimitBreakCount: 1 }], ['limit-five', ordinaryId, { pcLimitBreakCount: 5 }],
      ['eligible-lb-zero-hero', heroId, { pcLimitBreakCount: 1 }],
      ['hero-six', heroId, { pcHeroSublimateCount: 6 }],
      ['both', heroId, { pcLimitBreakCount: 5, pcHeroSublimateCount: 6 }]]) {
      await fresh(name); const source = [gift(1, pcId, upgrade)]; put('UserGift', source);
      const beforePc = app.store.read('UserPC'), beforeJobs = app.store.read('UserPCJobSet'), bonds = app.store.read('UserLimitBreakItem');
      const response = await receive(source), identity = sequence, result = parse(response), op = result.operations[0], minimum = target(op);
      const extra = Boolean(upgrade.pcLimitBreakCount || upgrade.pcHeroSublimateCount);
      assert.deepEqual(result.receivedPCs, extra ? [] : [pcId]);
      assert.deepEqual(result.receivedExPCs, extra ? [{ pcId, pcLimitBreakCount: upgrade.pcLimitBreakCount ?? 0,
        pcHeroSublimateCount: upgrade.pcHeroSublimateCount ?? 0 }] : []);
      assert.deepEqual(app.store.read('UserPC'), beforePc); assert.deepEqual(app.store.read('UserPCJobSet'), beforeJobs);
      assert.deepEqual(app.store.read('UserLimitBreakItem'), bonds, 'Present characters do not fabricate gacha duplicate bonds');
      assert.equal(minimum.limitbreakCount, upgrade.pcLimitBreakCount ?? 0);
      assert.equal(minimum.heroSublimateLevel, upgrade.pcHeroSublimateCount ?? 0);
      assert.equal(minimum.isUnlockedHeroSublimate, extra && Boolean(master.pcHeroSublimateGroups[pcId]));
      assert.equal(minimum.currentJobIndex, extra ? master.pcProfiles[pcId].jobIds.length : 1);
      if (!extra) assert.deepEqual(minimum.pcJobs, [], 'Ordinary presents do not invent unopened board rows');
      for (const job of minimum.pcJobs) assert.equal(job.abilityPanelState,
        fullMask(job.pcJobId, job.pcJobId === master.pcLimitBreakJobs[pcId] ? minimum.limitbreakCount : 5));
      const flags = { UserGift: source.map(row => ({ ...row, state: 1 })) };
      await rejected(push(flags, [op]), 400, snapshot()); parse(await push(flags));
      await close(); await open(); now += 1000;
      await rejected(receive(source), 503, snapshot(), true);
      await rejected(request(port, identity, { userId: seed.userId, giftIds: [1] }, String(identity), 'gift/receive'), 503, snapshot(), true);
      assert.deepEqual(app.store.operations(), [op], 'Issued units remain queued after split claim flags and expiry');
      const applied = saved(pcId, minimum);
      for (const changes of [{ joiningState: 0 }, { userId: 9 }, { currentJobIndex: 0 },
        ...(minimum.limitbreakCount ? [{ limitbreakCount: minimum.limitbreakCount - 1 }] : []),
        ...(minimum.isUnlockedHeroSublimate ? [{ isUnlockedHeroSublimate: false }] : [])]) {
        const invalid = structuredClone(applied); Object.assign(invalid.UserPC[0], changes);
        await rejected(push(invalid, [op]), 400, snapshot());
      }
      parse(await push({ UserPC: applied.UserPC })); await rejected(push({}, [op]), 400, snapshot());
      if (!extra && !minimum.guest) await rejected(send('user_data/confirm'), 503, snapshot(), true);
      const missingBit = structuredClone(applied.UserPCJobSet);
      if (minimum.pcJobs.length) missingBit[0].pcJobs[0].abilityPanelState = 0;
      else missingBit[0].userId = 9;
      await rejected(push({ UserPCJobSet: missingBit }, [op]), 400, snapshot());
      parse(await push({ UserPCJobSet: applied.UserPCJobSet }));
      if (applied.UserCharacter) {
        if(!minimum.character.present || minimum.character.state!==minimum.character.beforeState)
          await rejected(push({},[op]),400,snapshot());
        parse(await push({ UserCharacter:applied.UserCharacter }));
      }
      if (applied.UserCharacterCostume) {
        if(minimum.wardrobe.before.some(row=>row.state===1 || row.voices.some(voice=>voice.state===1)))
          await rejected(push({},[op]),400,snapshot());
        parse(await push({UserCharacterCostume:applied.UserCharacterCostume,UserCommunicationVoice:applied.UserCommunicationVoice}));
      }
      await close(); await open();
      if (!extra && !minimum.guest) {
        const derived={...op,parameters:{...op.parameters,receivedPCs:[]}};
        assert.deepEqual(parse(await send('user_data/confirm')).operations,[derived],
          'Only the fully saved owned first character can be omitted from a cold Present callback');
        assert.deepEqual(app.store.operations(),[op],'Cold character recovery cannot acknowledge the source Present');
      }
      parse(await push({}, [op]));
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM gift_pc_floor').get().n, 1);
      await rejected(push({}, [], { UserPC: [{ pcId }] }), 400, snapshot());
      await rejected(push({}, [], { UserPCJobSet: [{ pcId }] }), 400, snapshot());
      await rejected(push({ UserPCJobSet: missingBit }), 400, snapshot());
      const advanced = structuredClone(applied); advanced.UserPC[0].totalExp += 77;
      parse(await push(advanced)); assert.deepEqual(app.store.read('UserLimitBreakItem'), bonds);
      app.store.beginSession(); await close(); await open(); await rejected(receive(source), 503, snapshot(), true);
      now -= 1000;
    }
    // WRITTEN ONLY: independent first-PC grants can recover one saved unit
    // while leaving another positive in the same immutable source operation.
    await fresh('two-first-cold');
    const secondId=catalogIds.find(id=>id!==ordinaryId && !master.pcHeroSublimateGroups[id] &&
      !seed.data.UserPC.some(row=>row.pcId===id) &&
      master.pcProfiles[id].characterId!==master.pcProfiles[ordinaryId].characterId);
    assert.ok(secondId);
    const firstGifts=[gift(1,ordinaryId),gift(2,secondId)];put('UserGift',firstGifts);
    const firstOp=parse(await receive(firstGifts)).operations[0],firstTarget=JSON.parse(app.store.db.prepare(
      'SELECT targets FROM gift_pc_claim WHERE operation_id=? AND pc_id=?').get(firstOp.id,ordinaryId).targets);
    parse(await push({UserGift:firstGifts.map(row=>({...row,state:1}))}));
    parse(await push(saved(ordinaryId,firstTarget)));await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,
      [{...firstOp,parameters:{...firstOp.parameters,receivedPCs:[secondId]}}]);
    assert.deepEqual(app.store.operations(),[firstOp]);
    // WRITTEN ONLY: the separate native character and SP loops can finish in either save order.
    for(const first of ['unit','stamina']) {
      await fresh(`first-pc-stamina-${first}`);
      const spId=master.currencies['currency.stamina'],gifts=[gift(1,ordinaryId),gift(2,spId,{amount:2})];
      put('UserGift',gifts);
      const operation=parse(await receive(gifts)).operations[0],unit={...saved(ordinaryId,target(operation)),
        UserGift:gifts.map(row=>({...row,state:1}))},
        receipt=app.store.db.prepare('SELECT * FROM stamina_reward_claim WHERE operation_id=?').get(operation.id),
        info=structuredClone(app.store.read('UserInfo').data);
      assert.deepEqual(operation.parameters.receivedPCs,[ordinaryId]);
      assert.deepEqual(operation.parameters.receivedItems,[{itemId:spId,amount:2}]);
      assert.equal(receipt.amount,2);
      info[0].playerStatus.baseSP=receipt.sp_minimum;
      parse(await push(first==='unit'?unit:{UserInfo:info}));await close();await open();
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,parameters:{...operation.parameters,
        ...(first==='unit'?{receivedPCs:[]}:{receivedItems:[]})}}]);
      assert.deepEqual(app.store.operations(),[operation]);
      await rejected(push({},[operation]),400,snapshot());
      parse(await push(first==='unit'?{UserInfo:info}:unit));
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,parameters:{...operation.parameters,
        receivedPCs:[],receivedItems:[]}}]);
      parse(await push({},[operation]));assert.deepEqual(app.store.operations(),[]);
    }
    await fresh('preowned');
    const old = { limitbreakCount: 3, heroSublimateLevel: 4, isUnlockedHeroSublimate: true,
      currentJobIndex: master.pcProfiles[heroId].jobIds.length, totalExp: 77,
      pcJobs: [...master.pcProfiles[heroId].jobIds, master.pcLimitBreakJobs[heroId]]
        .map(pcJobId => ({ pcJobId, abilityPanelState: fullMask(pcJobId, pcJobId === master.pcLimitBreakJobs[heroId] ? 3 : 5) })) };
    const owned = saved(heroId, old); put('UserPC', owned.UserPC); put('UserPCJobSet', owned.UserPCJobSet);
    const source = [gift(1, heroId), gift(2, heroId, { pcLimitBreakCount: 1, pcHeroSublimateCount: 2 }), gift(3, heroId)];
    put('UserGift', source); const duplicate = parse(await receive(source)), duplicateOp = duplicate.operations[0];
    assert.deepEqual(parse(await receive(source)).operations,[duplicateOp], 'Unchanged preowned units are not new save observations');
    assert.deepEqual(duplicate.receivedPCs, [heroId, heroId]); assert.deepEqual(target(duplicateOp), old);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM gift_pc_claim').get().n, 1, 'Nonadditive same-unit rewards share their exact native max semantics');
    parse(await push({ UserGift: source.map(row => ({ ...row, state: 1 })) }, [duplicateOp]));
    assert.deepEqual(app.store.read('UserPC').data, owned.UserPC);

    for (const [name, pcJobs] of [['empty', []], ['zero', [{ pcJobId: master.pcProfiles[ordinaryId].jobIds[0], abilityPanelState: 0 }]],
      ['unsigned', [{ pcJobId: master.pcProfiles[ordinaryId].jobIds[0], abilityPanelState: 0xffffffff }]]]) {
      await fresh(`preowned-${name}`);
      const original = { limitbreakCount: 0, heroSublimateLevel: 0, isUnlockedHeroSublimate: false,
        currentJobIndex: 1, totalExp: 77, pcJobs };
      const existing = saved(ordinaryId, original); put('UserPC', existing.UserPC); put('UserPCJobSet', existing.UserPCJobSet);
      const gifts = [gift(1)]; put('UserGift', gifts);
      const operation = parse(await receive(gifts)).operations[0]; assert.deepEqual(target(operation), original);
      parse(await push({ UserGift: gifts.map(row => ({ ...row, state: 1 })) }));
      await close(); await open();
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[operation],
        'Preowned ordinary character is an idempotent original callback, not a fabricated new unit');
      parse(await push({},[operation]));parse(await push(existing));
      assert.deepEqual(JSON.parse(app.store.db.prepare('SELECT targets FROM gift_pc_floor').get().targets), original);
    }

    await fresh('invalid');
    for (const change of [{ amount: 2 }, { itemLevel: 1 }, { pcLimitBreakCount: 6 }, { pcHeroSublimateCount: 7 },
      { pcLimitBreakCount: '1' }, { pcHeroSublimateCount: 1 }, { equipmentId: 1 }]) {
      const gifts = [gift(1, ordinaryId, change)]; put('UserGift', gifts);
      await rejected(receive(gifts), 503, snapshot(), true);
    }
    const gifts = [gift(1)]; put('UserGift', gifts);
    for (const [pcs, jobs] of [[[{ ...seed.data.UserPC[0], pcId: ordinaryId, userId: 9 }], []],
      [[{ ...seed.data.UserPC[0], pcId: ordinaryId }], []],
      [[], [{ userId: seed.userId, pcId: ordinaryId, pcJobs: [] }]]]) {
      put('UserPC', pcs); put('UserPCJobSet', jobs); await rejected(receive(gifts), 400, snapshot());
    }
    await fresh('history'); put('UserGift', gifts);
    const response = await receive(gifts), identity = sequence, op = parse(response).operations[0];
    const row = app.store.db.prepare('SELECT * FROM gift_pc_claim').get();
    for (const [column,replacement] of [['before_targets',null],['before_targets','{}'],['before_targets','not-json'],['observed','["unknown"]']]) {
      app.store.db.prepare(`UPDATE gift_pc_claim SET ${column}=?`).run(replacement);
      await rejected(receive(gifts),503,snapshot(),true);
      await rejected(push({},[op]),503,snapshot(),true);
      assert.deepEqual(app.store.operations(),[op]);
      app.store.db.prepare(`UPDATE gift_pc_claim SET ${column}=?`).run(row[column]);
    }
    app.store.db.prepare('DELETE FROM gift_pc_claim').run(); await close(); await open();
    await rejected(receive(gifts), 503, snapshot(), true);
    await rejected(request(port, identity, { userId: seed.userId, giftIds: [1] }, String(identity), 'gift/receive'), 503, snapshot(), true);
    await rejected(push({ UserGift: gifts.map(row => ({ ...row, state: 1 })) }, [op]), 503, snapshot(), true);
    assert.equal(app.store.operations().length, 1);
    app.store.db.prepare('INSERT INTO gift_pc_claim(operation_id,pc_id,reward,targets,before_targets,observed) VALUES(?,?,?,?,?,?)')
      .run(row.operation_id,row.pc_id,row.reward,row.targets,row.before_targets,row.observed);
    app.store.db.prepare('UPDATE gift_pc_claim SET reward=?').run('{}');
    await rejected(receive(gifts), 503, snapshot(), true); app.store.db.prepare('UPDATE gift_pc_claim SET reward=?').run(row.reward);
    parse(await push({ ...saved(ordinaryId, target(op)), UserGift: gifts.map(row => ({ ...row, state: 1 })) }, [op]));
    await close(); await open();
    const lowered = saved(ordinaryId, target(op)); lowered.UserPC[0].joiningState = 0;
    await rejected(push(lowered), 400, snapshot());

    // Preowned upgrades are not acquisitions. Each completed upgrade half
    // checkpoints against the actual pre-effect progress, even with no flags.
    for (const first of ['unit','boards']) {
      await fresh(`upgrade-${first}-first`);
      const prior = { limitbreakCount:0,heroSublimateLevel:0,isUnlockedHeroSublimate:false,
        currentJobIndex:1,totalExp:77,pcJobs:[] }, existing = saved(heroId,prior);
      put('UserPC',existing.UserPC); put('UserPCJobSet',existing.UserPCJobSet);
      const gifts = [gift(1,heroId,{ pcLimitBreakCount:2,pcHeroSublimateCount:3 })]; put('UserGift',gifts);
      const operation = parse(await receive(gifts)).operations[0], applied = saved(heroId,target(operation));
      const capture = app.store.db.prepare('SELECT * FROM gift_pc_claim WHERE operation_id=?').get(operation.id);
      assert.deepEqual(JSON.parse(capture.before_targets),{ isFirst:false,target:prior });
      assert.deepEqual(parse(await receive(gifts)).operations,[operation]);
      const part = first === 'unit' ? { UserPC:applied.UserPC } : { UserPCJobSet:applied.UserPCJobSet };
      app.store.db.exec("CREATE TRIGGER fail_upgrade_observe BEFORE UPDATE ON gift_pc_claim BEGIN SELECT RAISE(ABORT,'upgrade observation rollback'); END");
      await rejected(push(part),503,snapshot()); app.store.db.exec('DROP TRIGGER fail_upgrade_observe');
      const partial = parse(await push(part)); assert(!partial.operations.some(row => row.id === operation.id));
      assert.deepEqual(app.store.operations(),[operation]);
      assert.deepEqual(JSON.parse(app.store.db.prepare('SELECT observed FROM gift_pc_claim WHERE operation_id=?').get(operation.id).observed),
        [first === 'unit' ? 'unitUpgrade' : 'boardsUpgrade']);
      await close(); await open();
      await rejected(receive(gifts),503,snapshot(),true);
      parse(await send('user/login'));
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[operation],
        'Native max/OR ExPC callback must remain positive until both upgrade halves are saved');
      await rejected(push(first === 'unit' ? { UserPC:existing.UserPC } : { UserPCJobSet:existing.UserPCJobSet }),400,snapshot());
      parse(await push({ UserGift:gifts.map(row => ({ ...row,state:1 })) }));
      await rejected(push({},[operation]),400,snapshot());
      parse(await push(first === 'unit' ? { UserPCJobSet:applied.UserPCJobSet } : { UserPC:applied.UserPC }));
      await close(); await open();
      assert.deepEqual(parse(await send('user_data/confirm')).operations,
        [{...operation,parameters:{...operation.parameters,receivedExPCs:[]}}],
        'Only the fully saved preowned ExPC upgrade can be omitted from a cold callback');
      assert.deepEqual(app.store.operations(),[operation]);parse(await push({},[operation]));
      assert.deepEqual(app.store.operations(),[]);
      await rejected(push(existing),400,snapshot());
    }

    // WRITTEN ONLY: a preowned ExPC upgrade and its separate SP gift may save in either order.
    for(const first of ['upgrade','stamina']) {
      await fresh(`expc-stamina-${first}`);
      const prior={limitbreakCount:0,heroSublimateLevel:0,isUnlockedHeroSublimate:false,
        currentJobIndex:1,totalExp:77,pcJobs:[]},existing=saved(heroId,prior),
        spId=master.currencies['currency.stamina'];
      put('UserPC',existing.UserPC);put('UserPCJobSet',existing.UserPCJobSet);
      const gifts=[gift(1,heroId,{pcLimitBreakCount:2,pcHeroSublimateCount:3}),gift(2,spId,{amount:2})];
      put('UserGift',gifts);
      const operation=parse(await receive(gifts)).operations[0],upgraded={...saved(heroId,target(operation)),
        UserGift:gifts.map(row=>({...row,state:1}))},
        receipt=app.store.db.prepare('SELECT * FROM stamina_reward_claim WHERE operation_id=?').get(operation.id),
        info=structuredClone(app.store.read('UserInfo').data);
      assert.deepEqual(operation.parameters.receivedExPCs,[{pcId:heroId,pcLimitBreakCount:2,pcHeroSublimateCount:3}]);
      assert.deepEqual(operation.parameters.receivedItems,[{itemId:spId,amount:2}]);
      assert.equal(receipt.amount,2);
      info[0].playerStatus.baseSP=receipt.sp_minimum;
      parse(await push(first==='upgrade'?upgraded:{UserInfo:info}));await close();await open();
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,parameters:{...operation.parameters,
        ...(first==='upgrade'?{receivedExPCs:[]}:{receivedItems:[]})}}]);
      assert.deepEqual(app.store.operations(),[operation]);
      await rejected(push({},[operation]),400,snapshot());
      parse(await push(first==='upgrade'?{UserInfo:info}:upgraded));
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,parameters:{...operation.parameters,
        receivedExPCs:[],receivedItems:[]}}]);
      parse(await push({},[operation]));assert.deepEqual(app.store.operations(),[]);
    }

    // WRITTEN ONLY: native character and captured-item loops can finish independently.
    const stockItemId=Number(Object.entries(master.itemProfiles).find(([,profile])=>profile.table==='UserExpItem')?.[0]),
      datedItemId=Number(Object.entries(master.itemProfiles).find(([,profile])=>profile.table==='UserGachaTicket')?.[0]);
    assert.ok(stockItemId && datedItemId && master.lotteryTickets[datedItemId]>0);
    for(const [kind,itemId] of [['pc',stockItemId],['expc',datedItemId]]) for(const first of ['character','item']) {
      now=1686794400;await fresh(`${kind}-captured-item-${first}`);
      const pcId=kind==='pc'?ordinaryId:heroId,profile=master.itemProfiles[itemId],dated=kind==='expc',
        beforeItem={userId:seed.userId,[profile.idField]:itemId,bookEntryState:3,signature:0,
          ...(dated?{dateList:[],cumulativeAmount:5}:{amount:0,cumulativeAmount:999999998,reservedAmount:0})};
      put(profile.table,[beforeItem]);
      if(kind==='expc') {
        const prior={limitbreakCount:0,heroSublimateLevel:0,isUnlockedHeroSublimate:false,
          currentJobIndex:1,totalExp:77,pcJobs:[]},existing=saved(heroId,prior);
        put('UserPC',existing.UserPC);put('UserPCJobSet',existing.UserPCJobSet);
      }
      const gifts=[gift(1,pcId,kind==='expc'?{pcLimitBreakCount:2,pcHeroSublimateCount:3}:{}),
        gift(2,itemId,{amount:1})];put('UserGift',gifts);
      const operation=parse(await receive(gifts)).operations[0],characterField=kind==='pc'?'receivedPCs':'receivedExPCs',
        character={...saved(pcId,target(operation)),UserGift:gifts.map(row=>({...row,state:1}))},
        acquired=dated?{...beforeItem,dateList:[{aquiredAt:now}],cumulativeAmount:6,signature:operation.signature}:
          {...beforeItem,amount:1,cumulativeAmount:999999999,signature:operation.signature};
      assert.deepEqual(operation.parameters.receivedItems,[{itemId,amount:1}]);
      if(kind==='pc' && first==='item') {
        parse(await push({[profile.table]:[{...beforeItem,amount:1}]}));
        await rejected(send('user_data/confirm'),503,snapshot(),true);
      }
      parse(await push(first==='character'?character:{[profile.table]:[acquired]}));await close();await open();
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,parameters:{...operation.parameters,
        ...(first==='character'?{[characterField]:[]}:{receivedItems:[]})}}]);
      assert.deepEqual(app.store.operations(),[operation]);
      await rejected(push({},[operation]),400,snapshot());
      parse(await push(first==='character'?{[profile.table]:[acquired]}:character));
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,parameters:{...operation.parameters,
        [characterField]:[],receivedItems:[]}}]);
      parse(await push({},[operation]));assert.deepEqual(app.store.operations(),[]);
    }

    // WRITTEN ONLY: one original2000 may carry both character arrays, stock and SP.
    const mixedHeroId=catalogIds.find(id=>master.pcHeroSublimateGroups[id] &&
      !seed.data.UserPC.some(row=>row.pcId===id) && !master.pcProfiles[id].initialCostumeId &&
      master.pcProfiles[id].characterId!==master.pcProfiles[ordinaryId].characterId);
    assert.ok(mixedHeroId && !master.pcProfiles[ordinaryId].initialCostumeId);
    for(const first of ['ordinary','upgrade']) {
      now=1686794400;await fresh(`ordinary-and-expc-${first}`);
      const preowned=saved(mixedHeroId,{limitbreakCount:0,heroSublimateLevel:0,
        isUnlockedHeroSublimate:false,currentJobIndex:1,totalExp:77,pcJobs:[]});
      put('UserPC',preowned.UserPC);put('UserPCJobSet',preowned.UserPCJobSet);
      const profile=master.itemProfiles[stockItemId],spId=master.currencies['currency.stamina'],
        beforeItem={userId:seed.userId,[profile.idField]:stockItemId,bookEntryState:3,
          signature:0,amount:0,cumulativeAmount:999999998,reservedAmount:0};
      put(profile.table,[beforeItem]);
      const gifts=[gift(1,ordinaryId),gift(2,mixedHeroId,{pcLimitBreakCount:2,pcHeroSublimateCount:3}),
        gift(3,stockItemId,{amount:1}),gift(4,spId,{amount:2})];
      put('UserGift',gifts);
      const op=parse(await receive(gifts)).operations[0],spReceipt=app.store.db.prepare(
        'SELECT * FROM stamina_reward_claim WHERE operation_id=?').get(op.id);
      assert.deepEqual(op.parameters.receivedPCs,[ordinaryId]);
      assert.deepEqual(op.parameters.receivedExPCs,[{pcId:mixedHeroId,pcLimitBreakCount:2,pcHeroSublimateCount:3}]);
      assert.deepEqual(op.parameters.receivedItems,[{itemId:stockItemId,amount:1},{itemId:spId,amount:2}]);
      const rewardTarget=pcId=>JSON.parse(app.store.db.prepare(
        'SELECT targets FROM gift_pc_claim WHERE operation_id=? AND pc_id=?').get(op.id,pcId).targets);
      const saveOne=async pcId=>{
        const part=saved(pcId,rewardTarget(pcId));
        part.UserPC=[...app.store.read('UserPC').data.filter(row=>row.pcId!==pcId),...part.UserPC];
        part.UserPCJobSet=[...app.store.read('UserPCJobSet').data.filter(row=>row.pcId!==pcId),...part.UserPCJobSet];
        parse(await push(part));
      };
      parse(await push({UserGift:gifts.map(row=>({...row,state:1}))}));
      await saveOne(first==='ordinary'?ordinaryId:mixedHeroId);
      await close();await open();
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...op,parameters:{...op.parameters,
        ...(first==='ordinary'?{receivedPCs:[]}:{receivedExPCs:[]})}}]);
      await rejected(push({},[op]),400,snapshot());
      await saveOne(first==='ordinary'?mixedHeroId:ordinaryId);
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...op,parameters:{...op.parameters,
        receivedPCs:[],receivedExPCs:[]}}]);
      parse(await push({[profile.table]:[{...beforeItem,amount:1,cumulativeAmount:999999999,
        signature:op.signature}]}));
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...op,parameters:{...op.parameters,
        receivedPCs:[],receivedExPCs:[],receivedItems:[{itemId:spId,amount:2}]}}]);
      const info=structuredClone(app.store.read('UserInfo').data);
      info[0].playerStatus.baseSP=spReceipt.sp_minimum;
      parse(await push({UserInfo:info}));
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...op,parameters:{...op.parameters,
        receivedPCs:[],receivedExPCs:[],receivedItems:[]}}]);
      parse(await push({},[op]));assert.deepEqual(app.store.operations(),[]);
    }

    // WRITTEN ONLY: character and captured casino loops can finish in either save order.
    for(const kind of ['pc','expc']) for(const first of ['character','medal']) {
      now=1686794400;await fresh(`${kind}-captured-medal-${first}`);
      const pcId=kind==='pc'?ordinaryId:heroId,medalId=master.currencies['currency.casino_medal'],
        beforeCasino={...seed.data.UserCasinoState[0],medalAmount:7,cumulativeMedalAmount:100,signature:0};
      put('UserCasinoState',[beforeCasino]);
      if(kind==='expc') {
        const existing=saved(heroId,{limitbreakCount:0,heroSublimateLevel:0,isUnlockedHeroSublimate:false,
          currentJobIndex:1,totalExp:77,pcJobs:[]});
        put('UserPC',existing.UserPC);put('UserPCJobSet',existing.UserPCJobSet);
      }
      const gifts=[gift(1,pcId,kind==='expc'?{pcLimitBreakCount:2,pcHeroSublimateCount:3}:{}),
        gift(2,medalId,{amount:2})];put('UserGift',gifts);
      const operation=parse(await receive(gifts)).operations[0],field=kind==='pc'?'receivedPCs':'receivedExPCs',
        character={...saved(pcId,target(operation)),UserGift:gifts.map(row=>({...row,state:1}))},
        receipt=app.store.db.prepare('SELECT * FROM casino_reward_claim WHERE operation_id=?').get(operation.id),
        acquired={...beforeCasino,medalAmount:9,cumulativeMedalAmount:receipt.cumulative_amount,
          signature:operation.signature};
      assert.equal(receipt.cap_version,1);assert.equal(receipt.amount,2);
      assert.equal(operation.parameters.issueCasinoMedal,2);
      if(first==='medal') {
        parse(await push({UserCasinoState:[{...beforeCasino,medalAmount:8}]}));
        await rejected(send('user_data/confirm'),503,snapshot(),true);
      }
      parse(await push(first==='character'?character:{UserCasinoState:[acquired]}));await close();await open();
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,parameters:{...operation.parameters,
        ...(first==='character'?{[field]:[]}:{issueCasinoMedal:0})}}]);
      assert.deepEqual(app.store.operations(),[operation]);
      await rejected(push({},[operation]),400,snapshot());
      parse(await push(first==='character'?{UserCasinoState:[acquired]}:character));
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,parameters:{...operation.parameters,
        [field]:[],issueCasinoMedal:0}}]);
      parse(await push({},[operation]));assert.deepEqual(app.store.operations(),[]);
    }

    // WRITTEN ONLY: independent item, medal and character callbacks share one immutable Present.
    now=1686794400;await fresh('first-pc-item-medal');
    const mixedProfile=master.itemProfiles[stockItemId],mixedMedalId=master.currencies['currency.casino_medal'],
      mixedItemBefore={userId:seed.userId,[mixedProfile.idField]:stockItemId,bookEntryState:3,
        signature:0,amount:0,cumulativeAmount:999999998,reservedAmount:0},
      mixedCasinoBefore={...seed.data.UserCasinoState[0],medalAmount:7,cumulativeMedalAmount:100,signature:0};
    put(mixedProfile.table,[mixedItemBefore]);put('UserCasinoState',[mixedCasinoBefore]);
    const mixedGifts=[gift(1,ordinaryId),gift(2,stockItemId,{amount:1}),gift(3,mixedMedalId,{amount:2})];
    put('UserGift',mixedGifts);
    const mixedOperation=parse(await receive(mixedGifts)).operations[0],
      mixedCharacter={...saved(ordinaryId,target(mixedOperation)),UserGift:mixedGifts.map(row=>({...row,state:1}))},
      mixedMedalReceipt=app.store.db.prepare('SELECT * FROM casino_reward_claim WHERE operation_id=?').get(mixedOperation.id);
    parse(await push({[mixedProfile.table]:[{...mixedItemBefore,amount:1,cumulativeAmount:999999999,
      signature:mixedOperation.signature}]}));await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...mixedOperation,
      parameters:{...mixedOperation.parameters,receivedItems:[]}}]);
    parse(await push({UserCasinoState:[{...mixedCasinoBefore,medalAmount:9,
      cumulativeMedalAmount:mixedMedalReceipt.cumulative_amount,signature:mixedOperation.signature}]}));
    assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...mixedOperation,
      parameters:{...mixedOperation.parameters,receivedItems:[],issueCasinoMedal:0}}]);
    await rejected(push({},[mixedOperation]),400,snapshot());
    parse(await push(mixedCharacter));
    assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...mixedOperation,
      parameters:{...mixedOperation.parameters,receivedPCs:[],receivedItems:[],issueCasinoMedal:0}}]);
    parse(await push({},[mixedOperation]));assert.deepEqual(app.store.operations(),[]);

    // WRITTEN ONLY: character and equipment arrays retain independent native save proof.
    const weaponId=Number(Object.keys(master.equipments).find(id=>master.equipments[id].type===1));
    for(const kind of ['pc','expc']) for(const first of ['character','equipment']) {
      now=1686794400;await fresh(`${kind}-equipment-${first}`);
      const pcId=kind==='pc'?ordinaryId:heroId,field=kind==='pc'?'receivedPCs':'receivedExPCs';
      if(kind==='expc') {
        const existing=saved(heroId,{limitbreakCount:0,heroSublimateLevel:0,isUnlockedHeroSublimate:false,
          currentJobIndex:1,totalExp:77,pcJobs:[]});
        put('UserPC',existing.UserPC);put('UserPCJobSet',existing.UserPCJobSet);
      }
      const gifts=[gift(1,pcId,kind==='expc'?{pcLimitBreakCount:2,pcHeroSublimateCount:3}:{}),
        gift(2,0,{equipmentId:weaponId,amount:2})];put('UserGift',gifts);
      const operation=parse(await receive(gifts)).operations[0],
        character={...saved(pcId,target(operation)),UserGift:gifts.map(row=>({...row,state:1}))},
        {type,...spec}=app.store.equipmentSpec(weaponId),original=master.equipments[spec.equipmentId],
        piece=slotIndex=>({userId:seed.userId,...spec,slotIndex,createAt:now,exp:0,
          durability:original.durability,reservedDurability:original.durability,
          isProtected:false,isUnbreakable:false,
          ...Object.fromEntries(Array.from({length:5},(_,i)=>[`lockedAbility${i+1}`,false]))}),
        pieces=[piece(1),piece(2)];
      assert.equal(type,1);assert.deepEqual(operation.parameters.receivedEquipments,[{equipmentId:weaponId,amount:2}]);
      if(first==='character') {
        parse(await push(character));await close();await open();
        assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,
          parameters:{...operation.parameters,[field]:[]}}]);
        await rejected(push({},[operation]),400,snapshot());
      }
      parse(await push({UserEquipment:[pieces[0]]}));
      await rejected(send('user_data/confirm'),503,snapshot(),true);
      parse(await push({UserEquipment:[pieces[1]]}));await close();await open();
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,
        parameters:{...operation.parameters,...(first==='character'?{[field]:[]}:{}),receivedEquipments:[]}}]);
      if(first==='equipment') {
        await rejected(push({},[operation]),400,snapshot());
        parse(await push(character));
      }
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,
        parameters:{...operation.parameters,[field]:[],receivedEquipments:[]}}]);
      parse(await push({},[operation]));assert.deepEqual(app.store.operations(),[]);
    }

    // WRITTEN ONLY: distinct costume, voices and character effects save independently.
    const costumeId=1021002030,costumeVoices=Object.entries(master.communicationVoices)
      .filter(([,voice])=>voice.costumeId===costumeId).map(([id])=>Number(id));
    assert.ok(costumeVoices.length);
    for(const kind of ['pc','expc']) for(const first of ['character','costume']) {
      now=1686794400;await fresh(`${kind}-costume-${first}`);
      put('UserCharacterCostume',[]);put('UserCommunicationVoice',[]);
      const pcId=kind==='pc'?ordinaryId:heroId,field=kind==='pc'?'receivedPCs':'receivedExPCs';
      if(kind==='expc') {
        const existing=saved(heroId,{limitbreakCount:0,heroSublimateLevel:0,isUnlockedHeroSublimate:false,
          currentJobIndex:1,totalExp:77,pcJobs:[]});
        put('UserPC',existing.UserPC);put('UserPCJobSet',existing.UserPCJobSet);
      }
      const gifts=[gift(1,pcId,kind==='expc'?{pcLimitBreakCount:2,pcHeroSublimateCount:3}:{}),
        gift(2,costumeId)];put('UserGift',gifts);
      const operation=parse(await receive(gifts)).operations[0],minimum=target(operation),
        character={...saved(pcId,minimum),UserGift:gifts.map(row=>({...row,state:1}))},
        costume={UserCharacterCostume:[{userId:0,costumeId,costumeState:2}]},
        voices={UserCommunicationVoice:costumeVoices.map(voiceId=>({userId:0,voiceId,voiceState:2}))};
      assert.ok(!minimum.wardrobe?.targets?.some(row=>row.costumeId===costumeId));
      assert.deepEqual(operation.parameters.receivedCostumes,[costumeId]);
      if(first==='character') {
        parse(await push(character));await close();await open();
        assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,
          parameters:{...operation.parameters,[field]:[]}}]);
        await rejected(push({},[operation]),400,snapshot());
        parse(await push(costume));
        await rejected(send('user_data/confirm'),503,snapshot(),true);
        parse(await push(voices));
      } else {
        parse(await push(voices));await close();await open();
        assert.deepEqual(parse(await send('user_data/confirm')).operations,[operation]);
        parse(await push(costume));
        assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,
          parameters:{...operation.parameters,receivedCostumes:[]}}]);
        await rejected(push({},[operation]),400,snapshot());
        parse(await push(character));
      }
      await close();await open();
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,
        parameters:{...operation.parameters,[field]:[],receivedCostumes:[]}}]);
      parse(await push({},[operation]));assert.deepEqual(app.store.operations(),[]);
    }
    await fresh('character-duplicate-costume-gifts');
    put('UserCharacterCostume',[]);put('UserCommunicationVoice',[]);
    const duplicateCostumeGifts=[gift(1,ordinaryId),gift(2,costumeId),gift(3,costumeId)];
    put('UserGift',duplicateCostumeGifts);
    const duplicateCostumeOperation=parse(await receive(duplicateCostumeGifts)).operations[0];
    assert.deepEqual(duplicateCostumeOperation.parameters.receivedCostumes,[costumeId]);
    parse(await push({UserCommunicationVoice:costumeVoices.map(voiceId=>({userId:0,voiceId,voiceState:2}))}));
    parse(await push({UserCharacterCostume:[{userId:0,costumeId,costumeState:2}]}));
    assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...duplicateCostumeOperation,
      parameters:{...duplicateCostumeOperation.parameters,receivedCostumes:[]}}]);
    parse(await push({...saved(ordinaryId,target(duplicateCostumeOperation)),
      UserGift:duplicateCostumeGifts.map(row=>({...row,state:1}))}));
    parse(await push({},[duplicateCostumeOperation]));assert.deepEqual(app.store.operations(),[]);
    const overlappingPc=catalogIds.find(id=>!seed.data.UserPC.some(row=>row.pcId===id) &&
      master.characterCostumes[master.pcProfiles[id]?.initialCostumeId] && master.pcLimitBreakJobs[id]);
    assert.ok(overlappingPc);
    for(const first of ['costume','character','expc']) {
      now=1686794400;await fresh(`character-costume-overlap-${first}`);
      put('UserCharacterCostume',[]);put('UserCommunicationVoice',[]);
      const overlappingCostume=master.pcProfiles[overlappingPc].initialCostumeId,
        overlappingGifts=[gift(1,overlappingPc,first==='expc'?{pcLimitBreakCount:1}:{}),
          gift(2,overlappingCostume)],field=first==='expc'?'receivedExPCs':'receivedPCs';
      put('UserGift',overlappingGifts);
      const operation=parse(await receive(overlappingGifts)).operations[0],minimum=target(operation),
        wardrobe=minimum.wardrobe?.targets?.find(row=>row.costumeId===overlappingCostume),
        character={...saved(overlappingPc,minimum),UserGift:overlappingGifts.map(row=>({...row,state:1}))},
        costume={UserCharacterCostume:[{userId:0,costumeId:overlappingCostume,costumeState:wardrobe?.state}]};
      assert.ok(wardrobe && wardrobe.voices.length===0);
      if(first==='costume') {
        parse(await push({UserGift:overlappingGifts.map(row=>({...row,state:1}))}));
        assert.deepEqual(parse(await send('user_data/confirm')).operations,[operation]);
      }
      if(first==='character') parse(await push(character));
      else {
        parse(await push(costume));
        if(first==='costume') {
          const receipt=app.store.db.prepare('SELECT targets,before_states,observed FROM costume_reward_claim WHERE operation_id=?')
            .get(operation.id),alteredTargets=JSON.parse(receipt.targets),alteredBefore=JSON.parse(receipt.before_states);
          alteredTargets[0].isNew=false;alteredBefore[0].state=2;
          app.store.db.prepare('UPDATE costume_reward_claim SET targets=?,before_states=?,observed=? WHERE operation_id=?')
            .run(JSON.stringify(alteredTargets),JSON.stringify(alteredBefore),'[]',operation.id);
          await rejected(send('user_data/confirm'),503,snapshot(),true);
          app.store.db.prepare('UPDATE costume_reward_claim SET targets=?,before_states=?,observed=? WHERE operation_id=?')
            .run(receipt.targets,receipt.before_states,receipt.observed,operation.id);
        }
      }
      await close();await open();
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,
        parameters:{...operation.parameters,...(first==='character'?{[field]:[]}:{}),receivedCostumes:[]}}]);
      if(first!=='character') {
        await rejected(push({},[operation]),400,snapshot());
        parse(await push(character));
      }
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[{...operation,
        parameters:{...operation.parameters,[field]:[],receivedCostumes:[]}}]);
      parse(await push({},[operation]));assert.deepEqual(app.store.operations(),[]);
    }

    // WRITTEN ONLY: the original LB helper skips a lower request after an
    // independent higher level; it cannot repair this older missing board.
    await fresh('later-lb-board-gap');
    const lbBefore={limitbreakCount:0,heroSublimateLevel:0,isUnlockedHeroSublimate:false,
      currentJobIndex:1,totalExp:77,pcJobs:[]},lbOwned=saved(ordinaryId,lbBefore);
    put('UserPC',lbOwned.UserPC);put('UserPCJobSet',lbOwned.UserPCJobSet);
    const lbGifts=[gift(1,ordinaryId,{pcLimitBreakCount:2})];put('UserGift',lbGifts);
    const lbOp=parse(await receive(lbGifts)).operations[0],higher=saved(ordinaryId,target(lbOp)).UserPC;
    higher[0].limitbreakCount=3;parse(await push({UserPC:higher}));
    await rejected(send('user_data/confirm'),503,snapshot(),true);
    assert.deepEqual(app.store.operations(),[lbOp]);

    await fresh('new-upgrade-initialization');
    const initializing = [gift(1,heroId,{ pcLimitBreakCount:2,pcHeroSublimateCount:3 })]; put('UserGift',initializing);
    const initialization = parse(await receive(initializing)).operations[0], originalCapture =
      app.store.db.prepare('SELECT before_targets FROM gift_pc_claim WHERE operation_id=?').get(initialization.id);
    const base = JSON.parse(originalCapture.before_targets); assert.equal(base.isFirst,true);
    const initialized = saved(heroId,base.target);
    parse(await push({ UserPC:initialized.UserPC }));
    await rejected(receive(initializing),503,snapshot(),true);
    await rejected(send('user_data/confirm'),503,snapshot(),true);
    await rejected(push({ UserGift:initializing.map(row => ({ ...row,state:1 })) },[initialization]),400,snapshot());
    parse(await push(initialized));await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,[initialization],
      'A complete saved first-unit base must keep the pending ExPC upgrade positive');
    const upgraded = saved(heroId,target(initialization));
    parse(await push({ ...upgraded,UserGift:initializing.map(row => ({ ...row,state:1 })) }));
    await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,
      [{...initialization,parameters:{...initialization.parameters,receivedExPCs:[]}}]);
    parse(await push({},[initialization]));

    await fresh('rollback-mixed');
    const mixed = [gift(1, heroId, { pcLimitBreakCount: 1, pcHeroSublimateCount: 2 }),
      gift(2, master.currencies['currency.gem'], { amount: 33 }),
      gift(3, master.currencies['currency.valis'], { amount: 5 }),
      gift(4, master.currencies['currency.stamina'], { amount: 2 }),
      gift(5, master.currencies['currency.casino_medal'], { amount: 3 })];
    put('UserGift', mixed);
    for (const [name, event] of [['hard_currency','UPDATE'],['operation_queue','INSERT'],['gift_pc_claim','INSERT'],
      ['gift_item_claim','INSERT'],['stamina_reward_claim','INSERT'],['casino_reward_claim','INSERT'],['gift_claim','INSERT'],
      ['gift_receive_request','INSERT'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_pc BEFORE ${event} ON ${name} BEGIN SELECT RAISE(ABORT,'character grant rollback'); END`);
      await rejected(receive(mixed), 503, snapshot()); app.store.db.exec('DROP TRIGGER fail_pc');
    }
    const mixedOp = parse(await receive(mixed)).operations[0], applied = saved(heroId, target(mixedOp));
    const item = app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=? AND item_id=?')
      .get(mixedOp.id,master.currencies['currency.valis']),
      gemTarget=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=? AND item_id=?')
        .get(mixedOp.id,master.currencies['currency.gem']);
    const sp = app.store.db.prepare('SELECT * FROM stamina_reward_claim WHERE operation_id=?').get(mixedOp.id);
    const medal = app.store.db.prepare('SELECT * FROM casino_reward_claim WHERE operation_id=?').get(mixedOp.id);
    const info = structuredClone(app.store.read('UserInfo').data); info[0].playerStatus.baseSP = sp.sp_minimum;
    const currencyRows=app.store.read('UserCurrency').data,
      valis = currencyRows.find(row => row.currencyId === item.item_id),
      gem=currencyRows.find(row=>row.currencyId===gemTarget.item_id) ?? {userId:seed.userId,currencyId:gemTarget.item_id,
        amount:0,reservedAmount:0,bookEntryState:1,signature:0,cumulativeAmount:0};
    Object.assign(applied, { UserGift: mixed.map(row => ({ ...row, state: 1 })), UserInfo: info,
      UserCurrency: [...currencyRows.filter(row=>![item.item_id,gemTarget.item_id].includes(row.currencyId)),
        { ...valis, userId: seed.userId, currencyId: item.item_id,
          amount: (valis?.amount ?? 0) + 5, cumulativeAmount: item.cumulative_amount },
        {...gem,bookEntryState:3,cumulativeAmount:gemTarget.cumulative_amount}],
      UserCasinoState: [{ ...seed.data.UserCasinoState[0], medalAmount: 3, cumulativeMedalAmount: medal.cumulative_amount }] });
    assert.equal(app.store.hardCurrency(), 33);
    for (const [name, event] of [['profile','UPDATE'],['gift_pc_floor','INSERT'],['operation_done','INSERT'],
      ['operation_queue','DELETE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_pc_save BEFORE ${event} ON ${name} BEGIN SELECT RAISE(ABORT,'character save rollback'); END`);
      await rejected(push(applied, [mixedOp]), 503, snapshot()); app.store.db.exec('DROP TRIGGER fail_pc_save');
    }
    parse(await push(applied)); await close(); await open(); parse(await push({}, [mixedOp]));
    assert.equal(app.store.hardCurrency(), 33); assert.deepEqual(app.store.operations(), []);
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    console.log('Present character catalog/normal/ExPC5/6/hero eligibility/boards/preowned maxima/pure cold recovery/mixed grants/save receipts/rollback probes OK; unjoined bootstrap rejected, native acceptance pending');
  } finally {
    await close(); const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('danmemore-gift-characters-')); fs.rmSync(resolved, { recursive: true, force: true });
  }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
