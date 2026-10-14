'use strict';

// DEFERRED: do not execute until the all-packet implementation phase is complete.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');

async function legacyImportFixture() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-casino-import-')),
    database=path.join(directory,'profile.sqlite'),imported=structuredClone(seed),priorNow=Date.now;
  const savedAt=Date.parse('2026-09-02T15:00:00Z')/1000;let clock=Date.parse('2026-09-03T15:00:00Z');
  imported.data.UserCasinoState=[{...imported.data.UserCasinoState[0],medalAmount:123,cumulativeMedalAmount:456,
    signature:7,score:321,lastScoreUpdatedAt:savedAt}];
  let app,port,sequence=0;
  const open=async()=>{app=createServer({database,seed:imported,master,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app?.server.listening)await new Promise(resolve=>app.server.close(resolve));app?.store.close();app=null;};
  const read=()=>request(port,++sequence,null,String(sequence),'casino/ranking/get');
  try {
    Date.now=()=>clock;await open();const profiles=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all();
    for(const table of ['casino_score_import','casino_score_observation']) {
      app.store.db.exec(`CREATE TRIGGER fail_casino_import BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'import failure'); END`);
      assert.equal((await read()).status,503);assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM casino_score').get().n,0);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM casino_score_import').get().n,0);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM casino_score_observation').get().n,0);
      assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),profiles);
      app.store.db.exec('DROP TRIGGER fail_casino_import');
    }
    const response=await read();assert.equal(response.status,200,response.body.toString());
    assert.deepEqual(JSON.parse(response.body).ranking,[{userId:seed.userId,name:seed.data.UserInfo[0].name,rank:1,score:321}]);
    assert.deepEqual(app.store.db.prepare('SELECT day,score,updated_at FROM casino_score').all(),
      [{day:Math.floor((savedAt+32400)/86400),score:321,updated_at:savedAt}]);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM casino_score_report').get().n,0,
      'A native bootstrap is not fabricated into a transport report');
    const receipt=app.store.db.prepare('SELECT * FROM casino_score_import WHERE id=1').get();
    assert.equal(receipt.score,321);assert.equal(receipt.updated_at,savedAt);
    const observation=app.store.db.prepare('SELECT * FROM casino_score_observation WHERE id=1').get();
    assert.equal(observation.mode,'imported');assert.equal(observation.state_json,receipt.state_json);
    assert.deepEqual(app.store.read('UserCasinoState').data,imported.data.UserCasinoState);
    assert.deepEqual(app.store.operations(),[]);await close();await open();
    assert.equal(JSON.parse((await read()).body).ranking[0].score,321,'Imported score survives restart without re-reading history');
    clock=Date.parse('2026-09-01T15:00:00Z');
    assert.deepEqual(JSON.parse((await read()).body).ranking,[],'Event-clock rewind does not redate or invalidate the imported score');
    app.store.db.prepare('UPDATE casino_score_import SET state_hash=? WHERE id=1').run('0'.repeat(32));
    assert.equal((await read()).status,503,'Corrupt import proof cannot publish or replace saved history');
    app.store.db.prepare('UPDATE casino_score_import SET state_hash=? WHERE id=1').run(receipt.state_hash);
    app.store.db.prepare('UPDATE casino_score_observation SET state_hash=? WHERE id=1').run('0'.repeat(32));
    assert.equal((await read()).status,503,'Corrupt first-observation boundary cannot be bypassed');
  } finally {Date.now=priorNow;await close();fs.rmSync(directory,{recursive:true,force:true});}
}

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-casino-ranking-'));
  const database = path.join(directory, 'profile.sqlite'), realNow = Date.now;
  let app, port, sequence = 0, now = Date.parse('2026-10-01T14:59:50Z');
  const open = async () => {
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => {
    if (app?.server.listening) await new Promise(resolve => app.server.close(resolve));
    app?.store.close(); app = null;
  };
  const send = (value, action = 'casino/ranking/update') => request(port, ++sequence, value, String(sequence), action);
  const read = value => send(value, 'casino/ranking/get');
  const scores = () => app.store.db.prepare('SELECT * FROM casino_score ORDER BY day').all().map(row => ({ ...row }));
  const reports = () => app.store.db.prepare('SELECT * FROM casino_score_report ORDER BY id').all().map(row => ({ ...row }));
  const observations = () => app.store.db.prepare('SELECT * FROM casino_score_observation ORDER BY id').all().map(row => ({ ...row }));
  const profiles = () => app.store.db.prepare('SELECT * FROM profile ORDER BY name').all();
  const snapshot = () => ({ scores: scores(), reports: reports(), observations: observations(), profiles: profiles(), operations: app.store.operations(),
    runtime: app.store.db.prepare('SELECT * FROM runtime').all(), cache: app.store.db.prepare('SELECT * FROM reply_cache ORDER BY key').all() });
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const body = { medalAmount: 100, medalUpdatedAt: now / 1000, reason: 'POKER' };
  try {
    Date.now = () => now;
    await open();
    const initial=await read(),initialSequence=sequence;
    assert.deepEqual(parse(initial), { code: 0, ranking: [] });
    assert.deepEqual((await request(port,initialSequence,null,String(initialSequence),'casino/ranking/get')).body,initial.body,
      'Unchanged exact completed-day ranking replay stays byte-identical');
    const pristine = profiles(), before = snapshot();
    for (const value of [null, {}, { ...body, medalAmount: 0 }, { ...body, medalAmount: -1 },
      { ...body, medalAmount: 0.5 }, { ...body, medalAmount: '100' }, { ...body, medalAmount: Number.MAX_SAFE_INTEGER + 1 },
      { ...body, medalUpdatedAt: 0 }, { ...body, medalUpdatedAt: -1 }, { ...body, medalUpdatedAt: '1790866790' },
      { ...body, medalUpdatedAt: now / 1000 + 1 }, { ...body, reason: 'poker' }, { ...body, reason: 1 },
      { ...body, reason: 'SHOP' }, { ...body, extra: 0 }]) {
      assert.equal((await send(value)).status, 400);
      assert.deepEqual(snapshot(), before);
    }
    for (const value of [{}, [], { page: 0 }]) {
      assert.equal((await read(value)).status, 400);
      assert.deepEqual(snapshot(), before);
    }
    for (const table of ['casino_score_report','casino_score','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_casino BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'casino failure'); END`);
      assert.equal((await send(body)).status, 503);
      assert.deepEqual(snapshot(), before, 'Score, sequence and response roll back atomically');
      app.store.db.exec('DROP TRIGGER fail_casino');
    }
    const first = await send(body), firstSequence = sequence;
    assert.deepEqual(parse(first), { code: 0 });
    const day = Math.floor((now / 1000 + 32400) / 86400);
    assert.deepEqual(scores(), [{ day, score: 100, updated_at: body.medalUpdatedAt }]);
    const firstReports=reports();
    assert.equal(firstReports.length,1);assert.equal(firstReports[0].request_key,`${firstSequence}/${firstSequence}`);
    assert.equal(firstReports[0].score,100);assert.equal(firstReports[0].updated_at,body.medalUpdatedAt);
    assert.equal(firstReports[0].before_score,null);assert.equal(firstReports[0].before_updated_at,null);
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`${firstSequence}/${firstSequence}`);
    assert.deepEqual((await request(port,firstSequence,body,String(firstSequence),'casino/ranking/update')).body,first.body,
      'Permanent score receipt survives reply-cache eviction');
    assert.deepEqual(reports(),firstReports,'Exact transport retry cannot append or mutate a score report');
    const conflicted={...body,medalAmount:101};
    assert.equal((await request(port,firstSequence,conflicted,String(firstSequence),'casino/ranking/update')).status,400);
    assert.deepEqual(reports(),firstReports,'Changed body cannot reuse a permanent score-report identity');
    app.store.db.prepare('UPDATE casino_score_report SET value_hash=? WHERE id=?').run('0'.repeat(32),firstReports[0].id);
    assert.equal((await request(port,firstSequence,body,String(firstSequence),'casino/ranking/update')).status,503,
      'Corrupt permanent score proof is retained and refused');
    app.store.db.prepare('UPDATE casino_score_report SET value_hash=? WHERE id=?')
      .run(firstReports[0].value_hash,firstReports[0].id);
    parse(await send(body));
    assert.equal(scores()[0].score, 100, 'Absolute totals must not be summed again');
    assert.equal(reports().length,2,'A distinct request keeps its own no-op audit receipt');
    assert.equal(reports()[1].before_score,100);assert.equal(reports()[1].before_updated_at,body.medalUpdatedAt);
    assert.deepEqual(parse(await read()).ranking, [], 'Offline board publishes only the completed day');
    now += 1000;
    const larger = { ...body, medalAmount: 9000000000, medalUpdatedAt: now / 1000 };
    const beforeUpdate = snapshot();
    app.store.db.exec("CREATE TRIGGER fail_casino BEFORE UPDATE ON casino_score BEGIN SELECT RAISE(ABORT,'update failure'); END");
    assert.equal((await send(larger)).status, 503);
    assert.deepEqual(snapshot(), beforeUpdate);
    app.store.db.exec('DROP TRIGGER fail_casino');
    parse(await send(larger));
    const best = scores();
    parse(await send({ ...larger, medalUpdatedAt: body.medalUpdatedAt, medalAmount: larger.medalAmount + 1 }));
    parse(await send(body));
    parse(await send({ ...larger, medalAmount: 10 }));
    assert.deepEqual(scores(), best, 'Older and decreasing daily snapshots do not overwrite accepted totals');
    parse(await send({ ...larger, medalAmount: larger.medalAmount + 5 }));
    assert.equal(scores()[0].score, larger.medalAmount + 5, 'Two wins can share an integer-second timestamp');
    now = Date.parse('2026-10-01T15:00:00Z');
    const expected = { userId: seed.userId, name: seed.data.UserInfo[0].name, rank: 1, score: larger.medalAmount + 5 };
    assert.equal((await request(port,initialSequence,null,String(initialSequence),'casino/ranking/get')).status,503,
      'Exact cached empty board cannot cross the completed-day boundary');
    const published=await read(),publishedSequence=sequence;
    assert.deepEqual(parse(published).ranking, [expected]);
    parse(await send({ medalAmount: 7, medalUpdatedAt: now / 1000, reason: 'POKER' }));
    assert.equal(scores().length, 2, 'New day starts a separate total');
    assert.deepEqual((await request(port,publishedSequence,null,String(publishedSequence),'casino/ranking/get')).body,published.body,
      'Current-day play cannot change the already completed board');
    const beforeRestart = scores();
    await close(); await open();
    assert.deepEqual((await request(port, firstSequence, body, String(firstSequence), 'casino/ranking/update')).body, first.body);
    parse(await send(body));
    assert.deepEqual(scores(), beforeRestart, 'Timestamped retry after midnight cannot credit the next day');
    assert.deepEqual((await request(port,publishedSequence,null,String(publishedSequence),'casino/ranking/get')).body,published.body,
      'Unchanged completed-day board survives restart');
    assert.deepEqual(profiles(), pristine, 'Ranking packets cannot award, consume or overwrite medals');
    assert.deepEqual(app.store.operations(), []);
    const changed = { ...seed.data.UserCasinoState[0], medalAmount: 123, cumulativeMedalAmount: 456,
      score: 7, lastScoreUpdatedAt: now / 1000 };
    const token = crypto.createHash('md5').update(JSON.stringify(changed)).digest('hex');
    parse(await send({ badges: null, scripts: {}, dataTokens: {}, checksums: { before: {}, after: { UserCasinoState: token } },
      deltas: [{ signature: 0, trigger: 'PokerAbortGame', deleteItems: {}, putItems: { UserCasinoState: [changed] } }],
      operations: [] }, 'user_data/push'));
    await close(); await open();
    assert.deepEqual(app.store.read('UserCasinoState').data, [changed]);
    assert.deepEqual(scores(), beforeRestart);
    now += 86400000;
    assert.equal((await request(port,publishedSequence,null,String(publishedSequence),'casino/ranking/get')).status,503,
      'Exact cached board cannot cross into the next completed day');
    const secondPublished=await read(),secondPublishedSequence=sequence;
    assert.equal(parse(secondPublished).ranking[0].score, 7);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM casino_score_import').get().n,0,
      'A post-listener native save is not reclassified as historical score');
    const initialObservation=app.store.db.prepare('SELECT * FROM casino_score_observation WHERE id=1').get();
    assert.equal(initialObservation.mode,'empty');
    assert.equal(JSON.parse(initialObservation.state_json).score,0,
      'The first zero native state permanently owns the import boundary');
    now += 86400000;
    assert.equal((await request(port,secondPublishedSequence,null,String(secondPublishedSequence),'casino/ranking/get')).status,503,
      'A cached populated board cannot survive into an empty completed day');
    assert.deepEqual(parse(await read()).ranking, [], 'No fabricated score for an unplayed day');
    assert.deepEqual(app.store.read('UserCasinoState').data, [changed]);
    await legacyImportFixture();
    console.log('Casino ranking: absolute daily totals, stale/retry handling, unchanged medals, rollback and restart OK; publication policy reconstructed');
  } finally {
    Date.now = realNow;
    await close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
