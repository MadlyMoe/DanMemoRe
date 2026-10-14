'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, openStore, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request, friendshipUnlockFixture } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const { itemDeltas } = require('./test_friendship_rewards.cjs');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-friendship-'));
  let database = path.join(directory, 'profile.sqlite');
  let app, port, sequence = 0;
  const open = async () => {
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => {
    if(app) { await app.close(); app=null; }
  };
  const state = { characterId: 101000002, friendship: 90304, friendshipLv: 41, userHeroType: 0 };
  const eligible = hero => master.characters[state.characterId].rewards.filter(row => row[1] <= state.friendshipLv && row[5] === hero);
  const claim = (states = [state], extra = {}) => request(port, ++sequence, { friendshipStates: states, ...extra }, '55', 'character/friendship/complete');
  // Synthetic save ordering checks, not evidence of native CP/UI acceptance.
  const save = (putItems = {}, operations = []) => ({ badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: Object.fromEntries(Object.entries(putItems).map(([name, rows]) =>
      [name, crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex')])) },
    deltas: Object.keys(putItems).length ? [{ signature: 0, trigger: 'FriendshipComplete', deleteItems: {}, putItems }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })) });
  const saved = () => ({ profiles: app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),
    iris: app.store.hardCurrency(), operations: app.store.operations(),
    rewards: app.store.db.prepare('SELECT reward_id FROM friendship_reward ORDER BY reward_id').all(),
    uses: app.store.db.prepare('SELECT * FROM friendship_item_use ORDER BY operation_id').all(),
    done: app.store.db.prepare('SELECT id FROM operation_done ORDER BY id').all() });
  const characterAt = (hero, points) => ({ ...app.store.read('UserCharacter').data.find(row => row.characterId === state.characterId),
    [['friendship','friendshipAis','friendshipLef'][hero]]: points });
  try {
    await open();
    const untouched = saved();
    app.store.db.exec("CREATE TRIGGER fail_cp BEFORE INSERT ON operation_queue BEGIN SELECT RAISE(ABORT,'injected CP queue failure'); END");
    assert.equal((await claim()).status, 503);
    assert.deepEqual(saved(), untouched, 'Claims, Iris and queued awards roll back together');
    app.store.db.exec('DROP TRIGGER fail_cp');
    const first = await claim();
    assert.equal(first.status, 200);
    const result = JSON.parse(first.body), award = result.operations[0];
    assert.equal(award.type, 11000);
    assert.equal(result.operations.length, 1);
    assert.equal(result.issueAmount, 75);
    assert.deepEqual(result.gainedItems.sort((a, b) => a.itemId - b.itemId),
      [{ itemId: 99000001, amount: 1 }, { itemId: 294000019, amount: 2 }]);
    assert.equal(saved().rewards.length, eligible(0).length);
    const pending = saved();
    assert.throws(() => app.store.push(save({}, [award])), /missing its saved character points/);
    assert.throws(() => app.store.push(save({ UserCharacter: [characterAt(1, state.friendship)] }, [award])),
      /missing its saved character points/);
    assert.deepEqual(saved(), pending);
    await close(); await open();
    assert.deepEqual(JSON.parse((await claim()).body), result, 'Pending claim keeps its ID, items and currency amount');
    assert.deepEqual(saved(), pending);
    app.store.db.exec("CREATE TRIGGER fail_cp_ack BEFORE DELETE ON operation_queue BEGIN SELECT RAISE(ABORT,'injected CP acknowledgement failure'); END");
    const awardSaves = () => friendshipUnlockFixture(app.store,
      { UserCharacter: [characterAt(0, state.friendship)], ...itemDeltas(app.store,award) }, [award]);
    assert.throws(() => app.store.push(save(awardSaves(), [award])), /injected CP acknowledgement failure/);
    assert.deepEqual(saved(), pending);
    app.store.db.exec('DROP TRIGGER fail_cp_ack');
    app.store.push(save(awardSaves()));
    const split = saved();
    await close(); await open();
    assert.deepEqual(saved(), split, 'Character delta may be saved before its operation acknowledgement');
    app.store.push(save({}, [award]));
    app.store.push(save({}, [award]));
    await close(); await open();
    const retried = await claim();
    assert.equal(retried.status, 200);
    const retry = JSON.parse(retried.body);
    assert.equal(app.store.hardCurrency(), 75, 'Split acknowledgement must not credit the same CP rewards twice');
    assert.equal(retry.issueAmount, 0);
    assert.deepEqual(retry.gainedItems, []);
    app.store.push(save({}, retry.operations));
    for (const hero of [1,2]) {
      app.store.push(save({ UserInfo:app.store.read('UserInfo').data.map(row => ({ ...row,heroType:hero })) }));
      const before = app.store.hardCurrency(), rows = eligible(hero);
      const granted = JSON.parse((await claim([{ ...state, userHeroType: hero }])).body);
      assert.equal(granted.operations.length, 1);
      assert.equal(granted.operations[0].type, 11000);
      assert.equal(granted.issueAmount, rows.filter(row => row[2] === 5).reduce((sum, row) => sum + row[3], 0));
      assert.equal(app.store.hardCurrency(), before + granted.issueAmount, 'Hero reward tracks are independent');
      app.store.push(save(friendshipUnlockFixture(app.store,
        { UserCharacter: [characterAt(hero, state.friendship)], ...itemDeltas(app.store,granted.operations[0]) }, granted.operations), granted.operations));
      await close(); await open();
      const repeated = JSON.parse((await claim([{ ...state, userHeroType: hero }])).body);
      assert.equal(repeated.issueAmount, 0); assert.deepEqual(repeated.gainedItems, []);
      app.store.push(save({}, repeated.operations));
    }
    assert.equal(saved().rewards.length, [0,1,2].flatMap(eligible).length);
    const earned=saved(); await close();
    const earnedWithoutMaster=openStore({database,seed});
    assert.throws(()=>earnedWithoutMaster.read('UserCharacter'),
      error=>error.status===503 && /reconciliation/.test(error.message),
      'A missing catalog cannot waive acknowledged CP floors');
    earnedWithoutMaster.close(); await open();
    assert.deepEqual(saved(),earned,'Missing catalog cancellation preserves earned data and receipts');

    // Reconstruct the former server's invalid marker queue and cached replies.
    await close(); database = path.join(directory, 'legacy.sqlite'); await open();
    const legacyResult = JSON.parse((await claim()).body), legacySequence = sequence;
    const markers = eligible(0).map(row => app.store.issueOperation(11100, { rewardItemId: row[0] }));
    const ordinary = app.store.issueOperation(11100, { rewardItemId: 294000019 });
    const unknown = app.store.issueOperation(11100, { rewardItemId: 123456789 });
    const modified = app.store.issueOperation(11100, { rewardItemId: eligible(1)[0][0], other: true });
    const cachedResult = { ...legacyResult, operations: [...legacyResult.operations, ...markers] };
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(Buffer.from(JSON.stringify(cachedResult)).toString('base64'), `55/${legacySequence}`);
    const oldCache = app.store.reply(`55/${legacySequence}`);
    for (const action of ['user_data/push','user_data/confirm'])
      app.store.saveReply(`fixture-${action}`, action, oldCache.body_hash, oldCache.content_type,
        Buffer.from(JSON.stringify({ code: 0, operations: [...markers, ordinary], dones: [] })));
    app.store.db.exec('DELETE FROM friendship_reward');
    // One already-acknowledged marker exists only in the old cached response.
    app.store.push(save({}, [markers[0]]));
    const received = eligible(1).find(row => row[2] === 5);
    const legacyFlags=[{ userId: seed.userId, rewardId: received[0], isReceived: true, receivedAt: 1 }], beforeUnprovenFlag=saved();
    assert.throws(()=>app.store.push(save({UserCharacterFriendshipReward:legacyFlags})),/no recovered reward producer/);
    assert.deepEqual(saved(),beforeUnprovenFlag);
    // Reconstruct an existing legacy disk image, NOT a valid gameplay save.
    app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserCharacterFriendshipReward'")
      .run(JSON.stringify(legacyFlags),crypto.createHash('md5').update(JSON.stringify(legacyFlags)).digest('hex'));
    const beforeMigration = saved();
    await close();
    const withoutMaster = openStore({ database, seed });
    assert.deepEqual(withoutMaster.operations(), beforeMigration.operations, 'Never guess marker IDs without the original data');
    for(const name of ['UserCharacter','UserPC','UserDpItem'])
      assert.deepEqual(withoutMaster.read(name).data,
        JSON.parse(beforeMigration.profiles.find(row=>row.name===name).data),
        'Catalog-free legacy inspection must neither crash nor invent progress');
    withoutMaster.close();
    await open();
    assert.deepEqual(app.store.operations(), [...legacyResult.operations, ordinary, unknown, modified],
      'Repair removes only exact CP-record markers; real, unknown and modified operations are untouched');
    assert.deepEqual(saved().profiles, beforeMigration.profiles);
    assert.equal(app.store.hardCurrency(), 75);
    assert.equal(saved().rewards.length, eligible(0).length + 1, 'Import legacy markers and saved true flags into the ledger');
    const backups = app.store.db.prepare('SELECT data FROM legacy_friendship_operation_backup ORDER BY id').all().map(row => JSON.parse(row.data));
    assert.deepEqual(backups, markers, 'Every removed marker has a recoverable exact backup');
    for (const action of ['user_data/push','user_data/confirm']) {
      const response = JSON.parse(Buffer.from(app.store.reply(`fixture-${action}`).body, 'base64'));
      assert.deepEqual(response.operations, [ordinary]);
    }
    const replay = await request(port, legacySequence, { friendshipStates: [state] }, '55', 'character/friendship/complete');
    assert.equal(replay.status, 200, 'Repair preserves the original request identity, avoiding stale-sequence failure');
    assert.deepEqual(JSON.parse(replay.body), legacyResult);
    const migrated = saved();
    await close(); await open();
    assert.deepEqual(saved(), migrated, 'Migration is idempotent');
    app.store.push(save({}, markers)); // Late legacy acknowledgements remain harmless.
    app.store.push(save(friendshipUnlockFixture(app.store,
      { UserCharacter: [characterAt(0, state.friendship)], ...itemDeltas(app.store,legacyResult.operations[0]) }, legacyResult.operations), legacyResult.operations));
    const afterMigration = JSON.parse((await claim()).body);
    assert.equal(afterMigration.issueAmount, 0); assert.deepEqual(afterMigration.gainedItems, []);
    assert.equal(app.store.hardCurrency(), 75);
    app.store.push(save({}, afterMigration.operations));
    app.store.push(save({ UserInfo:app.store.read('UserInfo').data.map(row => ({ ...row,heroType:1 })) }));
    const otherHero = JSON.parse((await claim([{ ...state, userHeroType: 1 }])).body);
    assert.equal(otherHero.issueAmount, eligible(1).filter(row => row[2] === 5).reduce((sum, row) => sum + row[3], 0) - received[3]);

    await close(); database = path.join(directory, 'items.sqlite'); await open();
    const itemId = 215000001;
    const itemRow = (amount, cpItemId = itemId) => ({ userId: seed.userId, cpItemId, amount, reservedAmount: 0, bookEntryState: 3, signature: 0,
      cumulativeAmount: Math.max(amount,app.store.read('UserCpItem').data.find(row => row.cpItemId === cpItemId)?.cumulativeAmount ?? 0) });
    const giftState = (friendship, characterId = state.characterId, userHeroType = 0) => ({ characterId, friendship,
      friendshipLv: master.characters[characterId].levels.findLast(([, points]) => points <= friendship)[0], userHeroType });
    app.store.push(save({ UserCpItem: [itemRow(20)] }));
    const beforeGift = saved(), gift = giftState(600), use = { itemId, itemAmount: 3 };
    for (const [states, extra] of [
      [[giftState(599)], use], [[giftState(601)], use], [[gift], { ...use, itemAmount: 21 }],
      [[gift], { ...use, itemAmount: 0 }], [[gift], { ...use, itemAmount: 0x80000000 }],
      [[gift, giftState(300, 101000001)], use],
    ]) assert.equal((await claim(states, extra)).status, 400);
    assert.deepEqual(saved(), beforeGift);
    const basePoints = master.cpItems[itemId];
    try {
      delete master.cpItems[itemId];
      assert.equal((await claim([gift], use)).status, 503);
      assert.deepEqual(saved(), beforeGift, 'Missing original points cannot grant guessed progress');
    } finally { master.cpItems[itemId] = basePoints; }
    app.store.db.exec("CREATE TRIGGER fail_item_use BEFORE INSERT ON friendship_item_use BEGIN SELECT RAISE(ABORT,'injected item-use failure'); END");
    assert.equal((await claim([gift], use)).status, 503);
    assert.deepEqual(saved(), beforeGift, 'Item reservation, CP reward ledger, Iris and queue commit together');
    app.store.db.exec('DROP TRIGGER fail_item_use');
    const giftedWire = await claim([gift], use);
    assert.equal(giftedWire.status, 200);
    const gifted = JSON.parse(giftedWire.body), giftPending = saved();
    assert.equal(gifted.operations.length, 1);
    assert.equal(app.store.read('UserCpItem').data[0].amount, 20, 'The native operation owns consumption until its saved delta');
    assert.equal(saved().uses[0].remaining, 17);
    assert.equal((await claim([giftState(300, 101000001)], use)).status, 400,
      'The same saved stock cannot fund concurrent pending gifts to different characters');
    const giftSaves = () => friendshipUnlockFixture(app.store,
      {UserCharacter:[characterAt(0,600)],...itemDeltas(app.store,gifted.operations[0])},gifted.operations);
    const withoutConsumption = () => { const rows=giftSaves(); delete rows.UserCpItem; return rows; };
    assert.throws(() => app.store.push(save(withoutConsumption(), gifted.operations)), /missing its saved item consumption/);
    assert.deepEqual(saved(), giftPending);
    app.store.push(save({ UserCharacter: [characterAt(0, 600)] }));
    await close(); await open();
    const partiallyApplied = await claim([gift], use);
    assert.equal(partiallyApplied.status,503,'An additive/consumed partially saved CP callback must not replay');
    assert.equal(JSON.parse(partiallyApplied.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.throws(() => app.store.push(save(withoutConsumption(), gifted.operations)), /missing its saved item consumption/);
    app.store.push(save(giftSaves()));
    const consumedBeforeAck = saved();
    await close(); await open();
    assert.deepEqual(saved(), consumedBeforeAck);
    app.store.push(save({}, gifted.operations));
    app.store.push(save({}, gifted.operations));
    assert.deepEqual(saved().uses, []);
    assert.equal((await claim([gift], use)).status, 400, 'A new stale request cannot consume the same gift again');

    const special = Object.entries(master.characters).find(([, row]) => row.favoriteItems.some(([, factor]) => factor === 40));
    for (const [characterId, cpItemId, count, start, expected] of [
      [101000001, itemId, 1, 0, 100], // ordinary food for Bell
      [101000001, 215000003, 1, 0, 200], // favorite book for Bell
      [101000078, 215000010, 1, 0, 500], // Artemis's original 100x special item
      [Number(special[0]), 215000007, 1, 0, 200], // original 40x favorite
      [state.characterId, itemId, 8388609, 0, 1677721856], // float32, not JS double multiplication
      [state.characterId, itemId, 1, 1999999950, 2000000000], // native cap
    ]) {
      // Independent synthetic starting points are not legitimate rewinds of
      // previously earned CP. Keep every arithmetic fixture in its own save.
      await close(); database = path.join(directory,`points-${characterId}-${cpItemId}-${count}-${start}.sqlite`); await open();
      const character = app.store.read('UserCharacter').data.find(row => row.characterId === characterId);
      app.store.push(save({ UserCharacter: [{ ...character, friendship: start }], UserCpItem: [itemRow(count, cpItemId)] }));
      const reply = await claim([giftState(expected, characterId)], { itemId: cpItemId, itemAmount: count });
      assert.equal(reply.status, 200, `${characterId}/${cpItemId}: original gift points`);
      const response = JSON.parse(reply.body);
      app.store.push(save(friendshipUnlockFixture(app.store,
        { UserCharacter: [{ ...character, friendship: expected }], ...itemDeltas(app.store,response.operations[0]) },response.operations), response.operations));
      assert.deepEqual(saved().uses, []);
    }
    console.log('Friendship: once-only hero rewards, original item points/favorites, consumption, split saves, rollback, restart and legacy repair: OK');
  } catch(error) {
    console.error('Friendship fixture failure:',path.basename(database),error); throw error;
  } finally {
    await close();
    fs.rmSync(directory, { recursive: true, force: true, maxRetries:4, retryDelay:100 });
  }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
