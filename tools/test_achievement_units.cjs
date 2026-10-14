'use strict';

// DEFERRED synthetic prerequisites and character/board saves; NOT native
// acquisition, signatures, stats, earning, reset policies or UI acceptance.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request,rewardCharacterFixture,rewardCostumeFixture,rewardUnitStoryFixture,
  communicationWardrobeFixture,rewardCommunicationFixture } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-achievement-units-'));
  let database = path.join(directory, 'profile.sqlite');
  const realNow = Date.now;
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
  const send = (value, action = 'user_data/push') => request(port, ++sequence, value, String(sequence), action);
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({ name }) => [name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected = async (pending,status,before = snapshot()) => {
    const reply = await pending; assert.equal(reply.status,status,reply.body.toString());
    if (status === 503) assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Failed mission handoff must retain profiles, queue, captures, floors, sequence and replies');
  };
  const save = (putItems, operations = []) => ({ badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: Object.fromEntries(Object.entries(putItems).map(([name, rows]) =>
      [name, crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex')])) },
    deltas: [{ signature: 0, trigger: 'Achievement', deleteItems: {}, putItems }],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })) });
  try {
    await open();
    const achievements = Object.entries(master.achievements).filter(([, row]) => row.rewardType === 29);
    assert.equal(achievements.length, 3);
    const pcs = app.store.read('UserPC').data;
    const completedAt = Math.floor(Date.now() / 1000);
    const claims = achievements.map(([id]) => ({ userId: seed.userId, achievementId: Number(id), completedAt,
      lastResetAt: 0, progressParam: 1, readState: 1, signature: 0, state: 3 }));
    parse(await send(save({ UserAchievement: claims })));
    const pullBody = { tables:['UserPC','UserPCJobSet','UserCharacter','UserAchievement'] };
    assert.equal((await send(pullBody,'user_data/pull')).status,200); const pullSequence = sequence;
    const value = { achievementIds: claims.map(({ achievementId, completedAt }) => ({ achievementId, completedAt })) };
    const response = await send(value, 'achievement/complete'), originalSequence = sequence;
    const result = parse(response), operation = result.operations[0];
    const ids = achievements.map(([, row]) => master.pcs[row.rewardKey]);
    const boards = ids.map(pcId => ({ userId:seed.userId,pcId,pcJobs:[],signature:0 }));
    assert.deepEqual(result.receivedPCs, ids);
    assert.equal(operation.type, 6000);
    assert.deepEqual(operation.parameters.receivedPCs, ids);
    assert.deepEqual(app.store.read('UserPC').data, pcs, 'Do not pre-publish uninitialized units');
    assert(!app.store.read('UserPCJobSet').data.some(row => ids.includes(row.pcId)), 'No board pre-credit');
    const capture = app.store.db.prepare('SELECT * FROM achievement_pc_delivery WHERE operation_id=?').get(operation.id);
    assert.equal(JSON.parse(capture.pc_targets).length,3);
    assert(JSON.parse(capture.pc_targets).every(row => row.isFirst && !row.target.pcJobs.length));
    assert.equal(JSON.parse(capture.communication_targets).length,3);
    for (const [column,replacement] of [['operation_json','{}'],['pc_targets','[]'],['pc_targets','not-json'],
      ['communication_targets','[]'],['communication_targets','not-json'],['communication_targets',null],['observed','["unknown"]']]) {
      app.store.db.prepare(`UPDATE achievement_pc_delivery SET ${column}=? WHERE operation_id=?`).run(replacement,operation.id);
      await rejected(send(value,'achievement/complete'),503);
      app.store.db.prepare(`UPDATE achievement_pc_delivery SET ${column}=? WHERE operation_id=?`).run(capture[column],operation.id);
    }
    assert.equal(app.store.hardCurrency(), 0);
    assert.deepEqual(parse(await send(value, 'achievement/complete')).operations, [operation]);
    assert.equal((await send(save({}, [operation]))).status, 400);
    const received = claims.map(row => ({ ...row, state: 4 }));
    assert.equal((await send(save({ UserAchievement: received }, [operation]))).status, 400);
    // Synthetic initialized deltas check server durability, not native UI acquisition.
    const units = ids.map(pcId => ({ ...pcs[0], pcId, userId: seed.userId, joiningState: 1,
      currentJobIndex:1,totalExp:0,limitbreakCount:0,heroSublimateLevel:0,isUnlockedHeroSublimate:false }));
    for (const change of [{ joiningState: 0 }, { userId: 2 }]) {
      assert.equal((await send(save({ UserPC: units.map(row => ({ ...row, ...change })), UserAchievement: received }, [operation]))).status, 400);
      assert.deepEqual(app.store.read('UserPC').data, pcs);
    }
    for (const edits of [boards.map(row => ({ ...row,userId:2 })),
      boards.map(row => ({ ...row,pcJobs:[null] })),
      boards.map(row => ({ ...row,pcJobs:[{ pcJobId:1,abilityPanelState:0 }] }))])
      await rejected(send(save({ UserPC:units,UserPCJobSet:edits,UserAchievement:received },[operation])),400);
    app.store.db.exec("CREATE TRIGGER fail_mission_observe BEFORE UPDATE ON achievement_pc_delivery BEGIN SELECT RAISE(ABORT,'mission observation rollback'); END");
    await rejected(send(save({ UserPC:units })),503); app.store.db.exec('DROP TRIGGER fail_mission_observe');
    const partial = parse(await send(save({ UserPC: units })));
    assert(!partial.operations.some(row => row.id === operation.id)); assert.deepEqual(app.store.operations(),[operation]);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM gift_pc_floor').get().n,0,'Stage/mission minimum only after actual ACK');
    assert.equal((await send(save({}, [operation]))).status, 400,
      'Saving units separately must not acknowledge unsaved claim flags');
    parse(await send(save({ UserAchievement: received })));
    await rejected(send(save({ UserAchievement:claims })),400);
    await close(); await open();
    const replay = await request(port, originalSequence, value, String(originalSequence), 'achievement/complete');
    assert.equal(replay.status,503); assert.equal(JSON.parse(replay.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.deepEqual(app.store.operations(), [operation]);
    // Units and claim flags still lack their owned job sets.
    await rejected(send(save({},[operation])),400);
    parse(await send(save({ UserPCJobSet:boards })));
    await rejected(send(save({},[operation])),400);
    const characters = rewardCharacterFixture(app.store.read('UserCharacter').data,ids);
    parse(await send(save({ UserCharacter:characters,
      ...rewardCostumeFixture(app.store.read('UserCharacterCostume').data,ids,app.store.read('UserCommunicationVoice').data),
      ...rewardUnitStoryFixture(app.store.read('UserAdventureStage').data,ids) })));
    await rejected(send(save({},[operation])),400);
    parse(await send(save(rewardCommunicationFixture(app.store,ids,completedAt))));
    const recovered={...operation,parameters:{...operation.parameters,UserAchievement:[],receivedPCs:[]}};
    assert.deepEqual(parse(await send(null,'user_data/confirm')).operations,[recovered]);
    parse(await send(null,'user/login'));assert.equal((await send(pullBody,'user_data/pull')).status,200);
    assert.deepEqual(app.store.operations(),[operation],'Cold recovery must not synthesize an ACK');
    for (const table of ['gift_pc_floor','operation_done','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_mission_ack BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'mission ACK rollback'); END`);
      await rejected(send(save({},[operation])),503); app.store.db.exec('DROP TRIGGER fail_mission_ack');
    }
    parse(await send(save({}, [operation])));
    await close(); await open();
    assert.deepEqual(app.store.operations(), []);
    assert.deepEqual(app.store.read('UserPC').data.filter(row => ids.includes(row.pcId)), units);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM gift_pc_floor').get().n,3);
    for (const name of ['UserPC','UserPCJobSet']) {
      const removal = save({ [name]:[] }); removal.deltas[0].deleteItems = { [name]:[{ pcId:ids[0] }] };
      await rejected(send(removal),400);
    }
    await rejected(request(port,pullSequence,pullBody,String(pullSequence),'user_data/pull'),503);
    await rejected(request(port,originalSequence,value,String(originalSequence),'achievement/complete'),503);
    assert.equal((await send(value, 'achievement/complete')).status, 400);
    assert.equal(app.store.hardCurrency(), 0);

    // A fresh PC can share an already joined communication character. Even
    // with an identical join time, its wardrobe and any first quest must save.
    for(const [characterId,preComplete] of [[101000021,false],[101000002,false],[101000021,true]]) {
      await close(); database=path.join(directory,`joined-communication-${characterId}-${preComplete}.sqlite`); await open();
      const joinedPc=ids.find(pcId=>master.pcProfiles[pcId].characterId===characterId);
      assert(joinedPc);
      const joinedId=Number(Object.entries(master.communicationCharacters).find(([,row])=>
        row.characterId===characterId)[0]),wardrobe=communicationWardrobeFixture(app.store,joinedId),
        joinedRows=[...app.store.read('UserCommunicationCharacter').data,
          {userId:0,characterId:joinedId,signature:0,costumeId:wardrobe.costumeId,characterState:2,
            joinDateTime:completedAt,touchCountBust:0,touchCountOther:0}],joinedJson=JSON.stringify(joinedRows);
      app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserCommunicationCharacter'")
        .run(joinedJson,crypto.createHash('md5').update(joinedJson).digest('hex'));
      if(preComplete) parse(await send(save(wardrobe.putItems)));
      const joinedClaim=claims.find(row=>master.pcs[master.achievements[row.achievementId].rewardKey]===joinedPc);
      parse(await send(save({UserAchievement:[joinedClaim]})));
      const joinedValue={achievementIds:[{achievementId:joinedClaim.achievementId,completedAt}]},
        joinedOperation=parse(await send(joinedValue,'achievement/complete')).operations[0],
        joinedReceipt=app.store.achievementPcReceipt(joinedOperation);
      assert.equal(joinedReceipt.communications[0].communicationId,joinedId);
      assert(joinedReceipt.communications[0].refresh);
      const source=joinedReceipt.receipt.communication_targets,bad=JSON.parse(source);
      bad[0].refresh.graphHash='invalid';
      app.store.db.prepare('UPDATE achievement_pc_delivery SET communication_targets=? WHERE operation_id=?')
        .run(JSON.stringify(bad),joinedOperation.id);
      await rejected(send(joinedValue,'achievement/complete'),503);
      app.store.db.prepare('UPDATE achievement_pc_delivery SET communication_targets=? WHERE operation_id=?')
        .run(source,joinedOperation.id);
      const joinedUnit=units.find(row=>row.pcId===joinedPc),joinedBoard=boards.find(row=>row.pcId===joinedPc),
        joinedCompletion={UserPC:[joinedUnit],UserPCJobSet:[joinedBoard],
          UserCharacter:rewardCharacterFixture(app.store.read('UserCharacter').data,[joinedPc]),
          UserAchievement:[{...joinedClaim,state:4}]};
      if(preComplete) {
        assert.deepEqual(parse(await send(null,'user_data/confirm')).operations,[joinedOperation],
          'Previously complete communication must not suppress an uninitialized mission PC');
        parse(await send(save(joinedCompletion,[joinedOperation])));
        assert.deepEqual(app.store.operations(),[]);
        assert.equal(app.store.db.prepare('SELECT owner FROM mission_communication_floor WHERE character_id=?')
          .get(joinedId).owner,0);
        const falseSource=joinedOperation.id+1000;
        app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(falseSource);
        app.store.db.prepare('UPDATE mission_communication_floor SET source_operation_id=? WHERE character_id=?')
          .run(falseSource,joinedId);
        await rejected(send(null,'user/login'),503);
        app.store.db.prepare('UPDATE mission_communication_floor SET source_operation_id=? WHERE character_id=?')
          .run(joinedOperation.id,joinedId);
        app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(falseSource);
        app.store.db.prepare('UPDATE achievement_pc_delivery SET communication_targets=? WHERE operation_id=?')
          .run('[]',joinedOperation.id);
        await rejected(send(null,'user/login'),503);
        app.store.db.prepare('UPDATE achievement_pc_delivery SET communication_targets=? WHERE operation_id=?')
          .run(source,joinedOperation.id);
        await rejected(send(save({UserCommunicationCharacter:[{...joinedRows.at(-1),characterState:1,costumeId:0}]})),400);
        continue;
      }
      await rejected(send(save(joinedCompletion,[joinedOperation])),400);
      parse(await send(save(joinedCompletion)));
      await rejected(send(save({},[joinedOperation])),400);
      parse(await send(save(rewardCommunicationFixture(app.store,[joinedPc],completedAt))));
      app.store.db.exec("CREATE TRIGGER fail_joined_wardrobe_floor BEFORE INSERT ON costume_unlock_floor BEGIN SELECT RAISE(ABORT,'mission wardrobe floor'); END");
      await rejected(send(save({},[joinedOperation])),503);
      app.store.db.exec('DROP TRIGGER fail_joined_wardrobe_floor');
      parse(await send(save({},[joinedOperation])));
      assert.deepEqual(app.store.operations(),[]);
      assert.equal(app.store.db.prepare('SELECT owner FROM mission_communication_floor WHERE character_id=?')
        .get(joinedId).owner,0);
      await rejected(send(save({UserCommunicationCharacter:[{...joinedRows.at(-1),characterState:1,costumeId:0}]})),400);
      for(const effect of joinedReceipt.communications[0].refresh.effects)
        assert.equal(app.store.db.prepare('SELECT operation_id FROM stage_unlock_floor WHERE stage_id=?')
          .get(effect.stageId).operation_id,joinedOperation.id);
    }

    // A pre-owned PC performs no native acquisition: the claim flag still matters,
    // especially when the same operation also issues server-owned currency.
    // Use a fresh claim history: earlier successful missions cannot be reminted.
    await close(); database = path.join(directory, 'pre-owned.sqlite'); await open();
    const progressUnits = units.map((row,index) => index ? row : { ...row,totalExp:100,limitbreakCount:2,currentJobIndex:3 });
    const progressBoards = boards.map((row,index) => index ? row : { ...row,
      pcJobs:[{ pcJobId:master.pcProfiles[row.pcId].jobIds[0],abilityPanelState:0x82000001 }] });
    parse(await send(save({ UserPC: progressUnits,UserPCJobSet:progressBoards })));
    const [currencyId, currency] = Object.entries(master.achievements).find(([, row]) =>
      row.rewardType === 3 && row.rewardKey === 'currency.gem' && !row.expireAt);
    const mixedClaims = [claims[0], { ...claims[0], achievementId: Number(currencyId) }];
    parse(await send(save({ UserAchievement: mixedClaims })));
    const mixedValue = { achievementIds: mixedClaims.map(({ achievementId, completedAt }) => ({ achievementId, completedAt })) };
    const mixed = parse(await send(mixedValue, 'achievement/complete')).operations[0];
    const preowned = JSON.parse(app.store.db.prepare('SELECT pc_targets FROM achievement_pc_delivery WHERE operation_id=?').get(mixed.id).pc_targets)[0];
    assert.equal(preowned.isFirst,false); assert.equal(preowned.target.totalExp,100);
    assert.deepEqual(preowned.target.pcJobs,progressBoards[0].pcJobs);
    await rejected(send(save({ UserPC:[{ ...progressUnits[0],totalExp:99 }] })),400);
    await rejected(send(save({ UserPCJobSet:[{ ...progressBoards[0],pcJobs:[] }] })),400);
    assert.deepEqual(mixed.parameters.receivedPCs, [ids[0]]);
    assert.equal(app.store.hardCurrency(), currency.rewardAmount);
    assert.equal((await send(save({}, [mixed]))).status, 400, 'Pre-owned unit is not proof of a saved claim');
    assert.deepEqual(parse(await send(mixedValue, 'achievement/complete')).operations, [mixed]);
    assert.equal(app.store.hardCurrency(), currency.rewardAmount, 'Pending retries must not duplicate currency');
    const unchanged={...mixed,parameters:{...mixed.parameters,receivedPCs:[]}};
    assert.deepEqual(parse(await send(null,'user_data/confirm')).operations,[unchanged]);
    assert.deepEqual(app.store.operations(),[mixed]);assert.equal(app.store.hardCurrency(),currency.rewardAmount);
    const mixedReceived = mixedClaims.map(row => ({ ...row, state: 4 }));
    for (const change of [{ userId: 2 }, { state: 3 }, { completedAt: completedAt - 1 }]) {
      const invalid = mixedReceived.map((row, index) => index ? { ...row, ...change } : row);
      assert.equal((await send(save({ UserAchievement: invalid }, [mixed]))).status, 400);
      assert.equal(app.store.read('UserAchievement').data.find(row => row.achievementId === Number(currencyId)).state, 3);
      assert.deepEqual(app.store.operations(), [mixed]);
    }
    const missingClaim = save({ UserAchievement: [mixedReceived[0]] }, [mixed]);
    missingClaim.deltas[0].deleteItems = { UserAchievement: [mixedClaims[1]] };
    assert.equal((await send(missingClaim)).status, 400, 'Non-expiring claim must not disappear');
    parse(await send(save({ UserAchievement: mixedReceived }, [mixed])));
    await close(); await open();
    assert.deepEqual(app.store.operations(), []);
    assert.deepEqual(app.store.read('UserPC').data.filter(row => ids.includes(row.pcId)), progressUnits,
      'Duplicate acquisition must preserve initialized units');
    await rejected(send(save({ UserPC:[{ ...progressUnits[0],totalExp:99 }] })),400);
    await rejected(send(save({ UserPCJobSet:[{ ...progressBoards[0],pcJobs:[] }] })),400);
    parse(await send(save({ UserPC:[{ ...progressUnits[0],totalExp:101 }] })));
    assert.equal((await send(mixedValue, 'achievement/complete')).status, 400);
    assert.equal(app.store.hardCurrency(), currency.rewardAmount);

    // The native category-3 exception is strict: expiry + 30 days must be past.
    await close(); database = path.join(directory, 'expiry.sqlite'); await open();
    parse(await send(save({ UserPC: units,UserPCJobSet:boards })));
    const [expiredId, expired] = Object.entries(master.achievements).find(([id, row]) =>
      !master.warGameAchievements[id] && row.category === 3 && row.rewardType === 3 && row.rewardKey === 'currency.gem' &&
      row.expireAt > achievements[0][1].startAt);
    Date.now = () => expired.expireAt * 1000;
    const expiringClaims = [claims[0], { ...claims[0], achievementId: Number(expiredId) }]
      .map(row => ({ ...row, completedAt: expired.expireAt }));
    parse(await send(save({ UserAchievement: expiringClaims })));
    const expiringValue = { achievementIds: expiringClaims.map(({ achievementId, completedAt }) => ({ achievementId, completedAt })) };
    const expiring = parse(await send(expiringValue, 'achievement/complete')).operations[0];
    const removed = save({ UserAchievement: [{ ...expiringClaims[0], state: 4 }] }, [expiring]);
    removed.deltas[0].deleteItems = { UserAchievement: [expiringClaims[1]] };
    Date.now = () => (expired.expireAt + 2592000) * 1000;
    assert.equal((await send(removed)).status, 400);
    Date.now = () => (expired.expireAt + 2592001) * 1000;
    parse(await send(removed));
    assert.deepEqual(app.store.operations(), []);
    assert.equal(app.store.read('UserAchievement').data.some(row => row.achievementId === Number(expiredId)), false);
    assert.equal(app.store.hardCurrency(), expired.rewardAmount);
    // Board-first and flag-first interruption must also suppress the complete
    // additive operation, never discard or preinitialize its missing units.
    Date.now = () => completedAt * 1000;
    for (const order of ['boards','flags']) {
      await close(); database = path.join(directory,`${order}-first.sqlite`); await open();
      parse(await send(save({ UserAchievement:claims })));
      for (const table of ['achievement_pc_delivery','achievement_claim','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_mission_issue BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'mission issue rollback'); END`);
        await rejected(send(value,'achievement/complete'),503); app.store.db.exec('DROP TRIGGER fail_mission_issue');
      }
      const issued = parse(await send(value,'achievement/complete')).operations[0];
      const first = order === 'boards' ? { UserPCJobSet:boards } : { UserAchievement:received };
      const checkpoint = parse(await send(save(first)));
      assert(!checkpoint.operations.some(row => row.id === issued.id)); assert.deepEqual(app.store.operations(),[issued]);
      assert(!app.store.read('UserPC').data.some(row => ids.includes(row.pcId)));
      await close(); await open();
      await rejected(send(value,'achievement/complete'),503);
      if(order==='flags') {
        const expected={...issued,parameters:{...issued.parameters,UserAchievement:[]}};
        assert.deepEqual(parse(await send(null,'user_data/confirm')).operations,[expected]);parse(await send(null,'user/login'));
        assert.equal((await send(pullBody,'user_data/pull')).status,200);assert.deepEqual(app.store.operations(),[issued]);
        assert(!app.store.read('UserPC').data.some(row=>ids.includes(row.pcId)),'Missing units remain native work, not preinitialized');
      } else {
        await rejected(send(null,'user_data/confirm'),503);await rejected(send(null,'user/login'),503);
        await rejected(send(pullBody,'user_data/pull'),503);
      }
      if (order === 'flags') await rejected(send(save({ UserAchievement:claims })),400);
      else {
        const deletion = save({ UserPCJobSet:[] }); deletion.deltas[0].deleteItems = { UserPCJobSet:[{ pcId:ids[0] }] };
        await rejected(send(deletion),400);
      }
      await rejected(send(save({},[issued])),400);
      const oldCapture = app.store.db.prepare('SELECT * FROM achievement_pc_delivery WHERE operation_id=?').get(issued.id);
      app.store.db.prepare('DELETE FROM achievement_pc_delivery WHERE operation_id=?').run(issued.id);
      await rejected(send(value,'achievement/complete'),503);
      await rejected(send(save({ UserPC:units,UserPCJobSet:boards,UserAchievement:received },[issued])),503);
      assert.deepEqual(app.store.operations(),[issued],'Missing legacy baseline cannot erase the pending reward');
      app.store.db.prepare('INSERT INTO achievement_pc_delivery(operation_id,operation_json,pc_targets,observed) VALUES(?,?,?,?)')
        .run(oldCapture.operation_id,oldCapture.operation_json,oldCapture.pc_targets,oldCapture.observed);
      parse(await send(save({ UserPC:units,UserPCJobSet:boards,UserAchievement:received,
        UserCharacter:rewardCharacterFixture(app.store.read('UserCharacter').data,ids),
        ...rewardCostumeFixture(app.store.read('UserCharacterCostume').data,ids,app.store.read('UserCommunicationVoice').data),
        ...rewardUnitStoryFixture(app.store.read('UserAdventureStage').data,ids) })));
      await close(); await open(); parse(await send(save({},[issued])));
      assert.deepEqual(app.store.operations(),[]);
      assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    }
    console.log('Achievement unit rewards: original IDs, owned boards/typed receipts, split saves/floors/recovery/rollback, pre-owned mixed rewards and expiry; native acceptance pending');
  } finally {
    Date.now = realNow;
    await close();
    const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('danmemore-achievement-units-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
