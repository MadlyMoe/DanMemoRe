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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-familia-achievements-'));
  const database = path.join(directory, 'profile.sqlite');
  let app, port, sequence = 0, wall = 2000000000;
  const open = async (eventDate = '2019-10-18T12:00:00Z') => {
    app = createServer({ database, seed, master, eventDate, wallNowSeconds: () => wall, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => { if (app) await app.close(); app = null; };
  const send = (action, value) => request(port, ++sequence, value, String(sequence), action);
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const get = () => send('achievement/familia/get', {}).then(parse);
  const visit = () => send('familia/mystatus', { is_login: true }).then(parse);
  const count = () => app.store.db.prepare('SELECT COUNT(*) n FROM familia_home_login').get().n;
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows), md5(rows), name);
  const expected = (days, level, active, page = 0, stamina = 0) => ({ code: 0,
    records: { '3001': days, '3101': level ? 1 : 0, '3102': level },
    daily_achievements: active ? master.familiaDailyAchievements.map(row => ({
      achievementId: row.id, currentParam: row.recordType === 301 ? page : stamina })) : [] });
  try {
    await open();
    const empty = await send('achievement/familia/get', {}), emptySequence = sequence;
    assert.deepEqual(parse(empty), expected(0, 0, false));
    assert.deepEqual((await request(port, emptySequence, {}, String(emptySequence), 'achievement/familia/get')).body,
      empty.body, 'Unchanged Familia progress replays exactly');
    const forgedSequence=++sequence,forgedHash='0'.repeat(32),forged=await request(port,forgedSequence,{},
      String(forgedSequence),'achievement/familia/get',{'X-ARGO-REQUEST-BODY-HASH':forgedHash});
    assert.deepEqual(parse(forged),expected(0,0,false));
    assert.equal(app.store.db.prepare('SELECT body_hash FROM reply_cache WHERE request_key=?')
      .get(`${forgedSequence}/${forgedSequence}`).body_hash,md5({}),
    'Familia-progress cache identity uses received bytes, not the supplied hash header');
    assert.deepEqual(parse(await send('achievement/familia/get')), expected(0, 0, false));
    const noMemberVisit=await send('familia/mystatus',{is_login:true}),noMemberVisitSequence=sequence;
    parse(noMemberVisit);assert.equal(count(), 0, 'No membership means no page-login day');
    for (const bad of [{ familiaId: 1 }, { recordType: 3001 }, [], 1, { extra: null }])
      assert.equal((await send('achievement/familia/get', bad)).status, 400);
    parse(await send('achievement/familia/add', { recordType: 401 }));
    wall++;
    const valis = { userId: seed.userId, currencyId: master.currencies['currency.valis'],
      amount: 200000, cumulativeAmount: 250000, reservedAmount: 0, signature: 0 };
    put('UserCurrency', [valis]);
    const created = parse(await send('familia/create', { name: 'Solo', description: 'Isolated progress test.',
      godId: 20000001, style: 21000001, subStyle: 0, activeTime: 22000001, subActiveTime: 22000002, requireApproval: false }));
    const paid = [{ ...valis, amount: 100000 }], charge = created.operations[0];
    parse(await send('user_data/push', { badges: null, scripts: {}, dataTokens: {},
      checksums: { before: {}, after: { UserCurrency: md5(paid) } },
      deltas: [{ signature: 0, trigger: 'Familia', deleteItems: {}, putItems: { UserCurrency: paid } }],
      operations: [{ id: charge.id, verifier: charge.token }] }));
    assert.equal((await request(port,emptySequence,{},String(emptySequence),'achievement/familia/get')).status,503,
      'Old no-membership progress cannot survive Familia creation');
    assert.equal((await request(port,noMemberVisitSequence,{is_login:true},String(noMemberVisitSequence),
      'familia/mystatus')).status,503,'A pre-membership home request cannot become a later visit');
    assert.deepEqual(await get(), expected(0, 1, false), 'Reading progress must not record a login');
    parse(await send('familia/mystatus', {})); assert.equal(count(), 0);
    const beforeVisit=await send('achievement/familia/get',{}),beforeVisitSequence=sequence;
    assert.deepEqual(parse(beforeVisit),expected(0,1,false));
    const firstVisit = await send('familia/mystatus', { is_login: true }), visitSequence = sequence;
    parse(firstVisit); await visit(); assert.equal(count(), 1);
    assert.equal(app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`${visitSequence}/${visitSequence}`).changes,1,
      'Exercise the permanent home-login receipt without the generic cache');
    assert.equal((await request(port,beforeVisitSequence,{},String(beforeVisitSequence),'achievement/familia/get')).status,503,
      'An observed visit invalidates the prior progress snapshot');
    assert.deepEqual(await get(), expected(1, 1, false), 'Future original daily missions must not be published');
    assert.equal((await send('achievement/familia/add', { recordType: 301 })).status, 503);
    await close(); wall += 30; await open();
    assert.equal(count(), 1);
    const replay = await request(port, visitSequence, { is_login: true }, String(visitSequence), 'familia/mystatus');
    assert.deepEqual(replay.body, firstVisit.body); assert.equal(count(), 1);
    assert.equal((await request(port,visitSequence,{},String(visitSequence),'familia/mystatus',
      {'X-ARGO-REQUEST-BODY-HASH':md5({is_login:true})})).status,400,
    'A supplied old hash cannot redirect the durable home-login identity');
    await close(); await open(new Date((master.familiaDailyAchievements[0].startAt - 1) * 1000).toISOString());
    assert.deepEqual(await get(), expected(1, 1, false));
    wall++;
    assert.deepEqual(await get(), expected(1, 1, true), 'Authored start is inclusive');
    await visit(); await visit();
    assert.deepEqual(await get(), expected(2, 1, true, 1, 0));
    const add = await send('achievement/familia/add', { recordType: 401 }), addSequence = sequence;
    parse(add); parse(await send('achievement/familia/add', { recordType: 401 }));
    assert.deepEqual(await get(), expected(2, 1, true, 1, 1), 'One actual member, not fabricated cooperative totals');
    const activity = app.store.db.prepare('SELECT COUNT(*) n FROM familia_activity').get().n;
    assert.equal(app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`${addSequence}/${addSequence}`).changes,1,
      'Exercise the permanent activity receipt without the generic cache');
    await close(); await open('2020-07-30T14:59:59Z');
    await visit(); assert.equal(count(), 2, 'Same Japanese calendar date must not count twice');
    wall++;
    assert.deepEqual(await get(), expected(2, 1, true, 0, 0), 'Both cooperative counts reset at Japanese midnight');
    const activityReplay = await request(port, addSequence, { recordType: 401 }, String(addSequence), 'achievement/familia/add');
    assert.deepEqual(activityReplay.body, add.body);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_activity').get().n, activity);
    assert.equal((await request(port,addSequence,{recordType:301},String(addSequence),'achievement/familia/add',
      {'X-ARGO-REQUEST-BODY-HASH':md5({recordType:401})})).status,400,
    'A supplied old hash cannot redirect the durable activity identity');
    assert.deepEqual(await get(), expected(2, 1, true, 0, 0), 'Yesterday replay must not create today activity');
    await visit(); parse(await send('achievement/familia/add', { recordType: 401 }));
    assert.deepEqual(await get(), expected(3, 1, true, 1, 1));
    for (const [points, level] of [[899,1],[900,2],[3392,2],[3393,3]]) {
      app.store.db.prepare('UPDATE local_familia SET contribution_point=? WHERE id=1').run(points);
      assert.deepEqual(await get(), expected(3, level, true, 1, 1));
    }
    await close(); await open('2020-08-01T12:00:00Z');
    app.store.db.exec("CREATE TRIGGER fail_home_login BEFORE INSERT ON familia_home_login BEGIN SELECT RAISE(ABORT,'test rollback'); END");
    assert.notEqual((await send('familia/mystatus', { is_login: true })).status, 200);
    assert.equal(count(), 3); app.store.db.exec('DROP TRIGGER fail_home_login');
    app.store.db.exec("CREATE TRIGGER fail_home_reply BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'test reply rollback'); END");
    assert.notEqual((await send('familia/mystatus', { is_login: true })).status, 200);
    assert.equal(count(), 3, 'A failed reply rolls back its new login day');
    app.store.db.exec('DROP TRIGGER fail_home_reply');
    await visit(); assert.equal(count(), 4);
    await close(); await open('2020-07-30T12:00:00Z');
    await visit(); assert.equal(count(), 4, 'Revisiting a historical date is idempotent');
    assert.deepEqual(await get(), expected(4, 3, true, 1, 1));
    await close(); await open('2018-01-01T12:00:00Z');
    await visit(); assert.equal(count(), 4, 'Event-clock selection before membership must not invent a login');
    assert.deepEqual(await get(), expected(4, 3, false));
    const achievements = app.store.read('UserAchievement').data;
    const legacy = { userId: seed.userId, achievementId: 6060000001, progressParam: 99,
      completedAt: 1, lastResetAt: 0, readState: 1, signature: 0, state: 3 };
    put('UserAchievement', achievements.concat(legacy));
    assert.equal((await send('achievement/familia/get', {})).status, 503, 'Do not replace unknown historical progress with zero');
    assert.deepEqual(app.store.read('UserAchievement').data, achievements.concat(legacy));
    put('UserAchievement', achievements);
    app.store.db.prepare('UPDATE local_familia SET contribution_point=-1 WHERE id=1').run();
    assert.equal((await send('achievement/familia/get', {})).status, 400);
    assert.equal(count(), 4); assert.deepEqual(app.store.read('UserCurrency').data, paid);
    assert.deepEqual(app.store.operations(), [], 'Progress does not create unearned rewards or inventory operations');
    console.log('Familia progress: original daily IDs/windows, actual solo counts/levels, Japanese day boundary, rollback, replay and restart: OK');
  } finally {
    await close();
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-familia-achievements-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
