'use strict';

// Disposable synthetic stock/signatures; native costs/save shape were observed
// separately. This checks persistence, not every original upgrade recipe.
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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-board-checkpoint-'));
  const database = path.join(directory,'save.sqlite'), pcId = 1011001001;
  let app,port,sequence = 0,rejection;
  const open = async () => {
    app = createServer({database,seed,master,log:line => {
      const entry = JSON.parse(line); if(entry.event === 'rejected') rejection = entry.reason;
    }});
    await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve)); port = app.server.address().port;
  };
  const close = async () => { if(app) { await app.close(); app = null; } };
  const send = (action,body) => { rejection = undefined; return request(port,++sequence,body,String(sequence),action); };
  const parse = reply => { assert.equal(reply.status,200,rejection ?? reply.body.toString()); return JSON.parse(reply.body); };
  const push = (putItems,trigger = 'StatusBoardOpen',deleteItems = {}) => send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name => [name,md5(putItems[name] ?? [])]))},
    deltas:[{putItems,deleteItems,signature:0,trigger}],operations:[]});
  const set = () => structuredClone(app.store.read('UserPCJobSet').data.find(row => row.pcId === pcId));
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({name}) => [name,app.store.db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()]));
  try {
    await open();
    const pull = {tables:['UserPCJobSet']}, pullSequence = ++sequence;
    const oldPull = await request(port,pullSequence,pull,String(pullSequence),'user_data/pull');
    assert.equal(oldPull.status,200);
    assert.equal(oldPull.headers['content-type'],'application/x-msgpack');
    assert.deepEqual((await request(port,pullSequence,pull,String(pullSequence),'user_data/pull')).body,oldPull.body);
    const before = set(), opened = set(); opened.pcJobs[0].abilityPanelState |= 1;
    parse(await push({UserPCJobSet:[opened]},'DailyMissionComplete'));
    assert.deepEqual(app.store.operations(),[],'A native board checkpoint is not a manufactured operation');
    const saved = snapshot();
    assert.equal((await push({UserPCJobSet:[before]},'AreaChanged')).status,400,
      'A stale non-Iris board save must not relock an earned panel');
    assert.equal(snapshot(),saved,'Rejected save retains profiles, tokens, wallet, queue, sequence and cache');
    const stalePull = await request(port,pullSequence,pull,String(pullSequence),'user_data/pull');
    assert.equal(stalePull.status,503);
    assert.equal(JSON.parse(stalePull.body).code,3000999,'Stale binary pulls cancel instead of hiding earned bits');
    assert.equal(snapshot(),saved);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM ability_panel_purchase').get().n,0);
    await close(); await open();
    assert.equal(set().pcJobs[0].abilityPanelState,opened.pcJobs[0].abilityPanelState);
    assert.equal((await push({},'AreaChanged',{UserPCJobSet:[opened]})).status,400);
    const changedOwner = {...opened,userId:2};
    assert.equal((await push({UserPCJobSet:[changedOwner]})).status,400);
    const pc = app.store.read('UserPC').data.find(row => row.pcId === pcId);
    assert.equal((await push({},'AreaChanged',{UserPC:[pc]})).status,400);
    const next = set(); next.pcJobs[0].abilityPanelState |= 2;
    for(const trigger of [
      "CREATE TRIGGER board_fail BEFORE UPDATE ON profile WHEN NEW.name='UserPCJobSet' BEGIN SELECT RAISE(ABORT,'profile failure'); END",
      "CREATE TRIGGER board_fail BEFORE UPDATE ON gift_pc_floor BEGIN SELECT RAISE(ABORT,'checkpoint failure'); END",
      "CREATE TRIGGER board_fail BEFORE INSERT ON reply_cache WHEN NEW.action='user_data/push' BEGIN SELECT RAISE(ABORT,'reply failure'); END",
    ]) {
      app.store.db.exec(trigger); const retained = snapshot();
      assert.equal((await push({UserPCJobSet:[next]})).status,503);
      assert.equal(snapshot(),retained,'Profile/checkpoint/reply failure rolls back the whole request');
      app.store.db.exec('DROP TRIGGER board_fail');
    }
    parse(await push({UserPCJobSet:[next]}));
    const reordered = {...next,pcJobs:[...next.pcJobs].reverse()};
    parse(await push({UserPCJobSet:[reordered]},'AreaChanged'));
    assert.equal((await push({UserPCJobSet:[opened]},'AreaChanged')).status,400);
    const floor = JSON.parse(app.store.db.prepare('SELECT targets FROM gift_pc_floor WHERE pc_id=?').get(pcId).targets);
    assert.equal(floor.pcJobs.find(row => row.pcJobId === master.pcProfiles[pcId].jobIds[0]).abilityPanelState & 3,3);
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    console.log('Native board checkpoints: no Iris receipt/precredit/operation, stale-bit/deletion/owner guards, later upgrades, reorder, cold persistence and atomic rollback OK; recipes/guests remain partial');
  } finally { await close(); fs.rmSync(directory,{recursive:true,force:true}); }
}
if(require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
