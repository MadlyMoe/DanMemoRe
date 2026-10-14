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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-friends-'));
  const database = path.join(directory, 'profile.sqlite');
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
  const send = (body, action = 'user_data/push') => request(port, ++sequence, body, String(sequence), action);
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows),md5(rows),name);
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const saved = { userId: seed.userId, friendId: seed.userId, followCount: 0, followerCount: 0,
    followerListLastViewedAt: 1790866800, noticeBadgeDisplay: false };
  const lists = viewedAt => ({
    'friend/following/list': { code: 0, current: 0, pageCount: 0, followingCount: 0, following: [] },
    'friend/follower/list': { code: 0, current: 0, pageCount: 0, followersCount: 0, followers: [], followerListLastViewedAt: viewedAt },
    'friend/support/list': { code: 0, is_fullset: true, supporters: [] },
  });
  const body = action => action === 'friend/support/list' ? undefined : { page: 0 };
  const checkLists = async viewedAt => {
    const replies=new Map();
    for (const [action, expected] of Object.entries(lists(viewedAt))) {
      const response = await send(body(action), action), requestSequence = sequence;
      assert.deepEqual(parse(response), expected, action);
      const replay = await request(port, requestSequence, body(action), String(requestSequence), action);
      assert.equal(replay.status, 200); assert.deepEqual(replay.body, response.body);
      replies.set(action,{requestSequence,response});
    }
    return replies;
  };
  try {
    await open();
    const selfBody={userId:seed.userId},selfReply=await send(selfBody,'friend/get'),selfSequence=sequence;
    assert.deepEqual(parse(selfReply), {
      code: 0, result: 0, user: { userId: seed.userId, name: 'Player', description: '', rank: 1,
        relationship: 0, lastLoginedAt: 0,
        leaderPc: { pcId: 1011001001, jobRank: 1, level: 1, heroSublimateLevel: 0,
          isUnlockedHeroSublimate: false } },
    });
    assert.equal((await request(port,selfSequence,selfBody,String(selfSequence),'friend/get')).body,selfReply.body,
      'Unchanged local profile retains its exact cached response');
    const infos=app.store.read('UserInfo').data;
    put('UserInfo',infos.map(row=>({...row,name:'Updated Player'})));
    const staleSelf=snapshot();
    assert.equal((await request(port,selfSequence,selfBody,String(selfSequence),'friend/get')).status,503,
      'Cached self lookup cannot hide a newer saved public profile');
    assert.equal(snapshot(),staleSelf,'Stale self lookup retains the newer saved profile and cache evidence');
    assert.equal(parse(await send(selfBody,'friend/get')).user.name,'Updated Player');
    put('UserInfo',infos);
    const misses=new Map();
    for (const action of ['friend/get', 'friend/follow', 'friend/unfollow']) {
      const missBody={userId:seed.userId+1},response=await send(missBody,action),requestSequence=sequence;
      assert.deepEqual(parse(response),{code:0,result:10000003});
      assert.equal((await request(port,requestSequence,missBody,String(requestSequence),action)).body,response.body);
      misses.set(action,{requestSequence});
    }
    const follow=misses.get('friend/follow'),followKey=`${follow.requestSequence}/${follow.requestSequence}`,
      followHash=app.store.db.prepare('SELECT body_hash FROM reply_cache WHERE key=?').get(followKey),beforeSpoof=snapshot();
    assert.equal((await request(port,follow.requestSequence,{userId:seed.userId+2},String(follow.requestSequence),'friend/follow',
      {'X-ARGO-REQUEST-BODY-HASH':followHash.body_hash})).status,400,
    'A matching hash header cannot redirect a cached friend mutation to another user');
    assert.equal(snapshot(),beforeSpoof,'Rejected friend replay leaves saved state and cache unchanged');
    for (const body of [null, {}, { userId: 0 }, { userId: '1' }, { userId: seed.userId, extra: true }])
      assert.equal((await send(body, 'friend/get')).status, 400);
    const initialLists=await checkLists(0),support=initialLists.get('friend/support/list'),
      supportKey=`${support.requestSequence}/${support.requestSequence}`,
      supportHash=app.store.db.prepare('SELECT body_hash FROM reply_cache WHERE key=?').get(supportKey),beforeSupportSpoof=snapshot();
    assert.equal((await request(port,support.requestSequence,{},String(support.requestSequence),'friend/support/list',
      {'X-ARGO-REQUEST-BODY-HASH':supportHash.body_hash})).status,400,
      'A matching hash header cannot turn the native empty support request into JSON');
    assert.equal(snapshot(),beforeSupportSpoof,'Rejected support replay leaves saved state and cache unchanged');
    // Native empty-list readers 0x24ce540/0x24cec58 create a status row whose
    // friendId is the current user ID, not evidence of a followed peer.
    parse(await send({ badges: null, scripts: {}, dataTokens: {}, operations: [],
      checksums: { before: {}, after: { UserFriendStatus: md5([saved]) } },
      deltas: [{ signature: 0, trigger: 'FriendList', putItems: { UserFriendStatus: [saved] }, deleteItems: {} }] }));
    const status = app.store.read('UserFriendStatus');
    assert.deepEqual(status.data, [saved]);
    const follower=initialLists.get('friend/follower/list'),beforeStaleFollower=snapshot();
    assert.equal((await request(port,follower.requestSequence,{page:0},String(follower.requestSequence),
      'friend/follower/list')).status,503,'Cached follower list cannot hide a newer viewed-at checkpoint');
    assert.equal(snapshot(),beforeStaleFollower,'Stale follower list retains saved status and cache evidence');
    for(const action of ['friend/following/list','friend/support/list']) {
      const retained=initialLists.get(action);
      assert.equal((await request(port,retained.requestSequence,body(action),String(retained.requestSequence),action)).body,
        retained.response.body,`${action} remains stable across an unrelated viewed-at change`);
    }
    await checkLists(saved.followerListLastViewedAt);
    assert.deepEqual(app.store.read('UserFriendStatus'), status, 'Reading lists must preserve the saved status and token');
    await close(); await open();
    await checkLists(saved.followerListLastViewedAt);
    assert.deepEqual(app.store.read('UserFriendStatus'), status);
    for (const change of [{ followCount: 1 }, { followerCount: 1 }, { friendId: 42 }, { userId: 42 },
      { followCount:'0' },{ followerCount:false },{ followerListLastViewedAt:-1 },{ noticeBadgeDisplay:0 }]) {
      const rows = [{ ...saved, ...change }];
      put('UserFriendStatus',rows);
      const before = app.store.read('UserFriendStatus');
      for (const action of Object.keys(lists(0)))
        assert.equal((await send(body(action), action)).status, 503, 'Unavailable peer state must not be erased');
      assert.deepEqual(app.store.read('UserFriendStatus'), before);
    }
    console.log('Friend packets: local profile lookup, native not-found errors, lists, replay and restart OK; unavailable peer state preserved');
  } finally {
    await close();
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-friends-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
