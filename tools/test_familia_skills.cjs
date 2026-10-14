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
const md5 = value => crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-familia-skills-'));
  const database = path.join(directory, 'profile.sqlite');
  let app, port, sequence = 0, now = 1571400000;
  const open = async () => {
    app = createServer({ database, seed, master, wallNowSeconds: () => now, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => {
    if (app?.server.listening) await new Promise(resolve => app.server.close(resolve));
    app?.store.close(); app = null;
  };
  const send = (value, action = 'familia/skill/get') => request(port, ++sequence, value, String(sequence), action);
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  try {
    await open();
    const empty = { code: 0, result: 0, familiaSkillIds: [], skillPoint: 0 };
    const initial=await send(),initialSequence=sequence;
    assert.deepEqual(parse(initial),empty);
    assert.deepEqual((await request(port,initialSequence,undefined,String(initialSequence),'familia/skill/get')).body,
      initial.body,'Unchanged Familia skill state replays exactly');
    const objectReply=await send({}),objectSequence=sequence;
    assert.deepEqual(parse(objectReply),empty);
    assert.equal((await request(port,objectSequence,undefined,String(objectSequence),'familia/skill/get',
      {'X-ARGO-REQUEST-BODY-HASH':md5({})})).status,400,
    'A supplied object hash cannot redirect an empty-body skill request');
    for (const value of [[], { familiaId: 1 }, { skillPoint: 99 }]) assert.equal((await send(value)).status, 400);
    app.store.db.prepare(`INSERT INTO local_familia(id,owner_id,settings,joined_at,skill_point,
      creation_operation_id,creation_valis_before,creation_cumulative_before) VALUES(1,?,?,?,?,?,?,?)`)
      .run(seed.userId, JSON.stringify({ name: 'Solo' }), now, 6, 999, 0, 0);
    assert.equal((await request(port,initialSequence,undefined,String(initialSequence),'familia/skill/get')).status,503,
      'Old no-membership skill state cannot survive Familia creation');
    assert.deepEqual(parse(await send()), { ...empty, skillPoint: 6 });
    app.store.db.prepare('INSERT INTO familia_skill_upgrade VALUES(?,?,?)').run(57401001001, 3, now);
    const learned = { code: 0, result: 0, familiaSkillIds: [57401001001], skillPoint: 6 };
    const learnedReply=await send(),learnedSequence=sequence;
    assert.deepEqual(parse(learnedReply),learned);
    await close(); await open();
    assert.deepEqual(parse(await send()), learned);
    for (const points of [-1, 0x80000000, 1.5]) {
      app.store.db.prepare('UPDATE local_familia SET skill_point=?').run(points);
      assert.equal((await send()).status, 400);
    }
    app.store.db.exec('UPDATE local_familia SET skill_point=6');
    app.store.db.exec('UPDATE familia_skill_upgrade SET cost=4');
    assert.equal((await send()).status, 400, 'Unknown saved costs must not be erased');
    app.store.db.exec('UPDATE familia_skill_upgrade SET cost=3');
    app.store.db.prepare('INSERT INTO familia_skill_upgrade VALUES(?,?,?)').run(57401001003, 3, now);
    assert.equal((await send()).status, 400, 'Missing saved levels must not be invented');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM familia_skill_upgrade').get().n, 2);
    app.store.db.prepare('DELETE FROM familia_skill_upgrade WHERE familia_skill_id=?').run(57401001003);

    const growth = id => ({ familiaId: 1, familiaSkillId: id });
    const state = () => ({ points: app.store.db.prepare('SELECT skill_point FROM local_familia').get()?.skill_point ?? null,
      upgrades: app.store.db.prepare('SELECT * FROM familia_skill_upgrade ORDER BY familia_skill_id').all() });
    const unchangedFailure = async (value, expected = 400) => {
      const before = state();
      assert.equal((await send(value, 'familia/skill/growth')).status, expected);
      assert.deepEqual(state(), before, 'Rejected request must preserve points and learned levels');
    };
    for (const value of [null, [], {}, { ...growth(57401001002), extra: 1 }, { familiaId: 2, familiaSkillId: 57401001002 },
      { familiaId: 1, familiaSkillId: '57401001002' }, growth(-1), growth(999999999), growth(57401001003)])
      await unchangedFailure(value);
    assert.deepEqual(parse(await send(growth(57401001001), 'familia/skill/growth')),
      { ...learned, familiaSkillId: 57401001001 }, 'Already learned level must not spend again');
    app.store.db.exec("CREATE TRIGGER fail_skill_insert BEFORE INSERT ON familia_skill_upgrade BEGIN SELECT RAISE(ABORT, 'rollback'); END");
    await unchangedFailure(growth(57401001002), 503);
    app.store.db.exec('DROP TRIGGER fail_skill_insert');
    app.store.db.exec("CREATE TRIGGER fail_skill_reply BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT, 'rollback'); END");
    await unchangedFailure(growth(57401001002), 503);
    app.store.db.exec('DROP TRIGGER fail_skill_reply');
    const upgradedResponse=await send(growth(57401001002),'familia/skill/growth'),upgradedSequence=sequence,
      upgraded=parse(upgradedResponse);
    assert.deepEqual(upgraded, { code: 0, result: 0, familiaSkillId: 57401001002,
      familiaSkillIds: [57401001002], skillPoint: 3 });
    assert.equal((await request(port,learnedSequence,undefined,String(learnedSequence),'familia/skill/get')).status,503,
      'A learned level and point debit invalidate the older skill snapshot');
    assert.equal(app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`${upgradedSequence}/${upgradedSequence}`).changes,1,
      'Exercise the permanent skill-growth receipt without the generic cache');
    const exact = await request(port, upgradedSequence, growth(57401001002), String(upgradedSequence), 'familia/skill/growth');
    assert.deepEqual(parse(exact), upgraded);
    assert.equal((await request(port,upgradedSequence,growth(57401001003),String(upgradedSequence),'familia/skill/growth',
      {'X-ARGO-REQUEST-BODY-HASH':md5(growth(57401001002))})).status,400,
    'A supplied old hash cannot redirect the durable skill-growth identity');
    assert.deepEqual(parse(await send({ familiaSkillId: 57401001002, familiaId: 1 }, 'familia/skill/growth')), upgraded);
    assert.deepEqual(app.store.operations(), [], 'Growth callback updates the server-owned state without a reward operation');
    await close(); await open();
    assert.deepEqual(parse(await send(growth(57401001002), 'familia/skill/growth')), upgraded);
    assert.equal(parse(await send(growth(57401001003), 'familia/skill/growth')).skillPoint, 0);
    assert.equal((await request(port,upgradedSequence,growth(57401001002),String(upgradedSequence),
      'familia/skill/growth')).status,503,'A later learned level invalidates the older growth snapshot');
    await unchangedFailure(growth(57401001004));

    app.store.db.exec('DELETE FROM familia_skill_upgrade');
    const all = Object.entries(master.familiaSkills).map(([id, row]) => ({ id: Number(id), ...row }));
    assert.equal(all.length, 315);
    let remaining = all.reduce((sum, row) => sum + row.cost, 0);
    app.store.db.prepare('UPDATE local_familia SET skill_point=?').run(remaining);
    now = 1640224800;
    const latest = new Map();
    for (const skill of all) {
      if (skill.type === 1 && [31,41].includes(skill.level)) {
        const later = now; now = skill.startAt - 1;
        await unchangedFailure(growth(skill.id)); now = later;
      }
      const result = parse(await send(growth(skill.id), 'familia/skill/growth'));
      remaining -= skill.cost; latest.set(skill.type, skill.id);
      assert.equal(result.skillPoint, remaining);
      assert.equal(result.familiaSkillId, skill.id);
      assert.deepEqual(result.familiaSkillIds, [...latest.values()]);
    }
    assert.equal(remaining, 0);
    assert.equal(state().upgrades.length, 315);
    for (const skill of all) assert.equal(parse(await send(growth(skill.id), 'familia/skill/growth')).skillPoint, 0);
    const maxed = { code: 0, result: 0, familiaSkillIds: [...latest.values()], skillPoint: 0 };
    await close(); await open(); assert.deepEqual(parse(await send()), maxed);
    now = 1540951199;
    assert.deepEqual(parse(await send()), maxed, 'Selecting an earlier clock must not erase learned levels');
    app.store.db.exec('DELETE FROM familia_skill_upgrade; UPDATE local_familia SET skill_point=3');
    await unchangedFailure(growth(57401001001));
    now = 1571400000;
    app.store.db.exec('UPDATE local_familia SET owner_id=999');
    await unchangedFailure(growth(57401001001), 503);
    app.store.db.exec('UPDATE local_familia SET owner_id=1000000001');
    app.store.db.exec('DELETE FROM local_familia');
    await unchangedFailure(growth(57401001001));
    console.log('Familia skills: all 315 original upgrades/costs, numeric native reply, eligibility, atomic rollback, once-only retries and restart: OK');
  } finally {
    await close();
    assert.equal(fs.realpathSync(path.dirname(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-familia-skills-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
