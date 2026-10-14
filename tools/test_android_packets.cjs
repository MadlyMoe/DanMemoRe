'use strict';

// Run only against a newly created, disposable launcher profile, never a player's save.
const assert = require('node:assert/strict');
const { request, get, drawAcknowledgement } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const port = Number(process.argv[2] ?? 28768), resume = process.argv[3] === 'resume';

async function main() {
  let sequence = 1;
  const post = async (action, value) => {
    const response = await request(port, sequence++, value, '99', action);
    assert.equal(response.status, 200, `${action}: HTTP ${response.status}`);
    return JSON.parse(response.body);
  };
  await post('user/login');
  const confirm = await post('user_data/confirm');
  if (resume) {
    assert.equal(confirm.dataTokens.UserTutorial, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    assert.equal(confirm.dataTokens.UserCharacter, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    assert.equal(confirm.dataTokens.UserAchievement, 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
    const balance = JSON.parse((await get(port, '/billing/v1.0/payment/balance')).body);
    assert.equal(balance.entry.balance_free_gem, 75);
    console.log('Android SQLite tutorial and achievement flags, and Iris balance survived listener restart: OK');
    return;
  }
  assert.deepEqual(confirm.operations, [], 'Refusing a profile with outstanding player operations');
  assert.equal(confirm.dataTokens.UserTutorial, seed.dataTokens.UserTutorial, 'Refusing an existing tutorial save');
  assert.equal(confirm.dataTokens.UserCharacter, seed.dataTokens.UserCharacter, 'Refusing existing character progress');
  assert.equal(confirm.dataTokens.UserAchievement, seed.dataTokens.UserAchievement, 'Refusing existing achievement progress');
  assert.equal(JSON.parse((await get(port, '/billing/v1.0/payment/balance')).body).entry.balance_free_gem, 0,
    'Refusing an existing Iris balance');
  const draw = await post('tutorial/draw', { lotteryId: 1, pcId: 1011002001 });
  assert.equal(draw.operation.type, 1001);
  assert.deepEqual(await post('tutorial/draw', { lotteryId: 1, pcId: 1011002001 }), draw);
  const states = [{ characterId: 101000002, friendship: 90304, friendshipLv: 41, userHeroType: 0 }];
  const friend = await post('character/friendship/complete', { friendshipStates: states });
  assert.equal(friend.issueAmount, 75);
  assert.equal(friend.operations[0].type, 11000);
  assert.equal(friend.operations.length, 1);
  const completedCharacter = { ...seed.data.UserCharacter.find(row => row.characterId === 101000002), friendship: 90304 };
  const acknowledgement = drawAcknowledgement(draw, {
    UserTutorial: [{ userId: seed.userId, tutorialId: 780030005, isEnd: true }], UserCharacter: [completedCharacter],
    // Disposable HTTP fixture, not a native inventory application proof.
    ...require('./test_friendship_rewards.cjs').itemDeltas({ read:name => ({ data:seed.data[name] }) },friend.operations[0]),
  });
  acknowledgement.checksums.after.UserTutorial = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  acknowledgement.checksums.after.UserCharacter = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  acknowledgement.operations.push(...friend.operations.map(row => ({ id: row.id, verifier: row.token })));
  const ack = await post('user_data/push', acknowledgement);
  assert.equal(ack.dones.length, friend.operations.length + 1);
  const charge = await post('currency/hard/consume', { consumeId: 81041001 });
  assert.equal(charge.operations[0].type, 10200);
  assert.deepEqual(await post('currency/hard/consume', { consumeId: 81041001 }), charge);
  const achieved = { userId: seed.userId, achievementId: 6020000001, completedAt: Math.floor(Date.now() / 1000),
    lastResetAt: 0, progressParam: 2, readState: 1, signature: 0, state: 3 };
  await post('user_data/push', { badges: null, checksums: { before: { UserAchievement: confirm.dataTokens.UserAchievement },
    after: { UserAchievement: 'dddddddddddddddddddddddddddddddd' } }, dataTokens: {},
    deltas: [{ deleteItems: {}, putItems: { UserAchievement: [achieved] }, signature: 0, trigger: 'Achievement' }],
    operations: [], scripts: {} });
  const claimRequest = { achievementIds: [{ achievementId: achieved.achievementId, completedAt: achieved.completedAt }] };
  const claim = await post('achievement/complete', claimRequest);
  assert.equal(claim.operations[0].type, 6000);
  assert.equal(claim.issueAmount, 10);
  assert.deepEqual(await post('achievement/complete', claimRequest), claim);
  await post('user_data/push', { badges: null, checksums: { before: { UserAchievement: 'dddddddddddddddddddddddddddddddd' },
    after: { UserAchievement: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' } }, dataTokens: {},
    deltas: [{ deleteItems: {}, putItems: { UserAchievement: [{ ...achieved, state: 4 }] }, signature: 0, trigger: 'Achievement' }],
    operations: claim.operations.map(row => ({ id: row.id, verifier: row.token })), scripts: {} });
  const balance = JSON.parse((await get(port, '/billing/v1.0/payment/balance')).body);
  assert.equal(balance.entry.balance_free_gem, 75);
  console.log('Android native SQLite: tutorial replay, friendship and achievement rewards, acknowledgements and one-time Iris charge: OK');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
