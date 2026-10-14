'use strict';

// Deferred only: do not execute during the packet-implementation phase.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {openStore}=require('./danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-creation-schema-'));
let store,db;
try {
  for(const mode of ['original','creation-v1','present-v2','shop-v3','achievement-v4','friendship-v5','stage-v6','existing-v1-backup','existing-v2-backup',
      'existing-v3-backup','existing-v4-backup','existing-v5-backup','existing-v6-backup','index','trigger','backup','foreign-key','unknown']) {
    const database=path.join(directory,`${mode}.sqlite`);
    store=openStore({database,seed,master});store.close();store=null;
    db=new DatabaseSync(database);
    db.exec(`DROP TABLE familia_valis_spending_floor;
      CREATE TABLE familia_valis_spending_floor(user_id INTEGER PRIMARY KEY,ceiling INTEGER,source_operation_id INTEGER,
        source_kind TEXT ${mode==='unknown'?'':['stage-v6','existing-v6-backup'].includes(mode)
          ?"CHECK(source_kind IN ('donation','event-box','creation','present','shop','achievement','friendship','stage'))":['friendship-v5','existing-v5-backup'].includes(mode)
          ?"CHECK(source_kind IN ('donation','event-box','creation','present','shop','achievement','friendship'))":['achievement-v4','existing-v4-backup'].includes(mode)
          ?"CHECK(source_kind IN ('donation','event-box','creation','present','shop','achievement'))":['shop-v3','existing-v3-backup'].includes(mode)
          ?"CHECK(source_kind IN ('donation','event-box','creation','present','shop'))":['present-v2','existing-v2-backup'].includes(mode)
          ?"CHECK(source_kind IN ('donation','event-box','creation','present'))":mode==='creation-v1' || mode==='existing-v1-backup'
            ?"CHECK(source_kind IN ('donation','event-box','creation'))":"CHECK(source_kind IN ('donation','event-box'))"});`);
    db.prepare('INSERT INTO familia_valis_spending_floor VALUES(?,?,?,?)').run(seed.userId,null,null,null);
    // Foreign-owner rows exercise lossless copying only, not donation-source validity.
    db.prepare('INSERT INTO familia_valis_spending_floor VALUES(?,?,?,?)').run(seed.userId+1,-123,9999,'donation');
    if(mode==='index') db.exec('CREATE INDEX custom_floor_source ON familia_valis_spending_floor(source_operation_id)');
    if(mode==='trigger') db.exec('CREATE TRIGGER custom_floor_guard BEFORE UPDATE ON familia_valis_spending_floor BEGIN SELECT RAISE(ABORT,\'retain guard\'); END');
    if(mode==='backup') db.exec('CREATE TABLE familia_valis_spending_floor_v7_backup(note TEXT); INSERT INTO familia_valis_spending_floor_v7_backup VALUES(\'retain me\')');
    if(mode==='existing-v1-backup') db.exec('CREATE TABLE familia_valis_spending_floor_v1_backup(note TEXT); INSERT INTO familia_valis_spending_floor_v1_backup VALUES(\'retain old backup\')');
    if(mode==='existing-v2-backup') db.exec(`CREATE TABLE familia_valis_spending_floor_v1_backup(note TEXT);
      INSERT INTO familia_valis_spending_floor_v1_backup VALUES('retain old backup');
      CREATE TABLE familia_valis_spending_floor_v2_backup(note TEXT);
      INSERT INTO familia_valis_spending_floor_v2_backup VALUES('retain present backup')`);
    if(mode==='existing-v3-backup') db.exec(`CREATE TABLE familia_valis_spending_floor_v3_backup(note TEXT);
      INSERT INTO familia_valis_spending_floor_v3_backup VALUES('retain shop backup')`);
    if(mode==='existing-v4-backup') db.exec(`CREATE TABLE familia_valis_spending_floor_v4_backup(note TEXT);
      INSERT INTO familia_valis_spending_floor_v4_backup VALUES('retain mission backup')`);
    if(mode==='existing-v5-backup') db.exec(`CREATE TABLE familia_valis_spending_floor_v5_backup(note TEXT);
      INSERT INTO familia_valis_spending_floor_v5_backup VALUES('retain friendship backup')`);
    if(mode==='existing-v6-backup') db.exec(`CREATE TABLE familia_valis_spending_floor_v6_backup(note TEXT);
      INSERT INTO familia_valis_spending_floor_v6_backup VALUES('retain stage backup')`);
    if(mode==='foreign-key') db.exec('CREATE TABLE custom_floor_reference(user_id INTEGER REFERENCES familia_valis_spending_floor(user_id))');
    const rows=db.prepare('SELECT * FROM familia_valis_spending_floor ORDER BY user_id').all(),
      schema=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name LIKE '%floor%' ORDER BY name").all();
    db.close();db=null;
    if(!['original','creation-v1','present-v2','shop-v3','achievement-v4','friendship-v5','stage-v6','existing-v1-backup','existing-v2-backup','existing-v3-backup','existing-v4-backup','existing-v5-backup','existing-v6-backup'].includes(mode)) {
      assert.throws(()=>openStore({database,seed,master}),/Unknown Valis floor schema requires reconciliation/);
      db=new DatabaseSync(database);
      assert.deepEqual(db.prepare('SELECT * FROM familia_valis_spending_floor ORDER BY user_id').all(),rows);
      assert.deepEqual(db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name LIKE '%floor%' ORDER BY name").all(),schema);
      if(mode==='backup') assert.equal(db.prepare('SELECT note FROM familia_valis_spending_floor_v7_backup').get().note,'retain me');
      db.close();db=null;continue;
    }
    store=openStore({database,seed,master});
    assert.deepEqual(store.db.prepare('SELECT * FROM familia_valis_spending_floor ORDER BY user_id').all(),rows);
    assert.deepEqual(store.db.prepare('SELECT * FROM familia_valis_spending_floor_v7_backup ORDER BY user_id').all(),rows);
    if(['existing-v1-backup','existing-v2-backup'].includes(mode)) assert.equal(store.db.prepare('SELECT note FROM familia_valis_spending_floor_v1_backup').get().note,'retain old backup');
    if(mode==='existing-v2-backup') assert.equal(store.db.prepare('SELECT note FROM familia_valis_spending_floor_v2_backup').get().note,'retain present backup');
    if(mode==='existing-v3-backup') assert.equal(store.db.prepare('SELECT note FROM familia_valis_spending_floor_v3_backup').get().note,'retain shop backup');
    if(mode==='existing-v4-backup') assert.equal(store.db.prepare('SELECT note FROM familia_valis_spending_floor_v4_backup').get().note,'retain mission backup');
    if(mode==='existing-v5-backup') assert.equal(store.db.prepare('SELECT note FROM familia_valis_spending_floor_v5_backup').get().note,'retain friendship backup');
    if(mode==='existing-v6-backup') assert.equal(store.db.prepare('SELECT note FROM familia_valis_spending_floor_v6_backup').get().note,'retain stage backup');
    const migratedSchema=store.db.prepare("SELECT sql FROM sqlite_master WHERE name='familia_valis_spending_floor'").get().sql;
    assert.match(migratedSchema,/'creation'/);
    assert.match(migratedSchema,/'present'/);
    assert.match(migratedSchema,/'shop'/);
    assert.match(migratedSchema,/'achievement'/);
    assert.match(migratedSchema,/'friendship'/);
    assert.match(migratedSchema,/'stage'/);
    assert.match(migratedSchema,/'union-raid'/);
    store.close();store=null;
    store=openStore({database,seed,master});
    assert.deepEqual(store.db.prepare('SELECT * FROM familia_valis_spending_floor ORDER BY user_id').all(),rows);
    assert.deepEqual(store.db.prepare('SELECT * FROM familia_valis_spending_floor_v7_backup ORDER BY user_id').all(),rows);
    if(['existing-v1-backup','existing-v2-backup'].includes(mode)) assert.equal(store.db.prepare('SELECT note FROM familia_valis_spending_floor_v1_backup').get().note,'retain old backup');
    if(mode==='existing-v2-backup') assert.equal(store.db.prepare('SELECT note FROM familia_valis_spending_floor_v2_backup').get().note,'retain present backup');
    if(mode==='existing-v3-backup') assert.equal(store.db.prepare('SELECT note FROM familia_valis_spending_floor_v3_backup').get().note,'retain shop backup');
    if(mode==='existing-v4-backup') assert.equal(store.db.prepare('SELECT note FROM familia_valis_spending_floor_v4_backup').get().note,'retain mission backup');
    if(mode==='existing-v5-backup') assert.equal(store.db.prepare('SELECT note FROM familia_valis_spending_floor_v5_backup').get().note,'retain friendship backup');
    if(mode==='existing-v6-backup') assert.equal(store.db.prepare('SELECT note FROM familia_valis_spending_floor_v6_backup').get().note,'retain stage backup');
    assert.equal(store.db.prepare("SELECT sql FROM sqlite_master WHERE name='familia_valis_spending_floor'").get().sql,migratedSchema);
    store.close();store=null;
  }
} finally {
  store?.close();db?.close();
  assert.equal(path.dirname(fs.realpathSync(directory)),fs.realpathSync(os.tmpdir()));
  assert.ok(path.basename(directory).startsWith('danmemore-creation-schema-'));
  fs.rmSync(directory,{recursive:true,force:true});
}
