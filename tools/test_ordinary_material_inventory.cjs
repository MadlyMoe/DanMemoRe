'use strict';

// WRITTEN ONLY / NOT RUN: synthetic native-shaped rows, not earning,
// constructor defaults, client consumption, signing, or gameplay acceptance.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openStore } = require('./danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
const families = [
  ['UserExpItem','expItemId',3], ['UserCpItem','cpItemId',57],
  ['UserStatusBoardItem','statusBoardItemId',19], ['UserEquipmentMaterial','equipmentMaterialId',140],
];

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-ordinary-material-inventory-'));
  let store, database;
  const open = () => { store = openStore({ database,seed,master,wallNowSeconds:()=>1790866800 }); };
  const close = () => { if(store) {store.close();store=null;} };
  const put = (name,rows) => store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows),md5(rows),name);
  const snapshot = () => JSON.stringify(store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const body = (name,rows) => ({ badges:null,scripts:{},dataTokens:{},
    checksums:{before:{},after:{[name]:md5(rows)}},
    deltas:[{signature:0,trigger:'Inventory',putItems:{[name]:rows},deleteItems:{}}],operations:[],
  });
  const reject = (name,rows,status=400) => {
    const before=snapshot();assert.throws(()=>store.push(body(name,rows)),error=>error.status===status);
    assert.equal(snapshot(),before,'A rejected inventory save must not change profiles, tokens, queue, receipts or sequence');
  };
  try {
    for(const [name,idField,count] of families) {
      await close();database=path.join(directory,`${name}.sqlite`);open();
      const ids=Object.entries(master.itemProfiles).filter(([,profile])=>profile.table===name).map(([id])=>Number(id)).sort((a,b)=>a-b);
      assert.equal(ids.length,count);
      const rows=ids.map((id,index)=>({userId:seed.userId,[idField]:id,amount:7,reservedAmount:0,
        bookEntryState:[0,1,127,255][index%4],signature:[0,255,256,0xffffffff][index%4],cumulativeAmount:11}));
      put(name,rows);assert.deepEqual(store.read(name).data,rows);
      store.push(body(name,rows));const saved=store.read(name),pending=store.operations();
      await close();open();assert.deepEqual(store.read(name),saved);assert.deepEqual(store.operations(),pending);

      for(const id of [ids[0],ids.at(-1)]) for(const [bookEntryState,signature] of [[0,0],[1,255],[127,256],[255,0xffffffff]]) {
        const baseline=store.read(name).data.find(row=>row[idField]===id),row={...baseline,bookEntryState,signature};
        store.push(body(name,[row]));assert.deepEqual(store.read(name).data.find(item=>item[idField]===id),row);
      }
      const baseline=store.read(name).data[0],valid=store.read(name).data;
      for(const field of Object.keys(baseline)) {const missing={...baseline};delete missing[field];reject(name,[missing]);}
      for(const changes of [{userId:2},{[idField]:0},{[idField]:'1'},{amount:-1},{amount:1000000000},
        {reservedAmount:-1},{reservedAmount:'0'},{reservedAmount:1000000000},{bookEntryState:-1},{bookEntryState:256},
        {signature:-1},{signature:0x100000000},{signature:'0'},{cumulativeAmount:-1},{cumulativeAmount:1000000000},
        {lastResetAt:0},{lastAquiredAt:0},{dateList:[]},{itemId:baseline[idField]}]) reject(name,[{...baseline,...changes}]);
      reject(name,[baseline,baseline]);
      const foreign=Object.entries(master.itemProfiles).find(([,profile])=>profile.table===families.find(([table])=>table!==name)[0]);
      reject(name,[{...baseline,[idField]:Number(foreign[0])}]);

      for(const malformed of [[{...baseline,reservedAmount:undefined}],[{...baseline,signature:0x100000000}],
        [{...baseline,lastResetAt:0}],[baseline,baseline],{},null,[null]]) {
        put(name,malformed);const retained=snapshot();
        assert.throws(()=>store.read(name),error=>error.status===503);
        reject(name,[baseline],503);assert.equal(snapshot(),retained,'Do not fill missing fields or reconstruct a malformed retained save');
        put(name,valid);
      }
      store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run('{',md5('{'),name);
      const undecodable=snapshot();assert.throws(()=>store.read(name),error=>error.status===503);
      reject(name,[baseline],503);assert.equal(snapshot(),undecodable);put(name,valid);
      for(const table of ['profile','local_save_meta']) {
        store.db.exec(`CREATE TRIGGER inventory_rollback BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'inventory rollback'); END`);
        const before=snapshot();assert.throws(()=>store.push(body(name,[{...baseline,bookEntryState:baseline.bookEntryState===255?1:255}])),/inventory rollback/);
        assert.equal(snapshot(),before);store.db.exec('DROP TRIGGER inventory_rollback');
      }
      await close();open();assert.deepEqual(store.read(name).data,valid);
    }
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
