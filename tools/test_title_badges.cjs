'use strict';

// DEFERRED / NOT RUN until every packet and unfinished branch is implemented.
// Synthetic native-shaped flags prove neither badge earning nor client save order.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json');
const master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
const badge=id=>({userId:seed.userId,titleBadgeId:id});

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-title-badges-'));
  const database=path.join(directory,'save.sqlite');
  let app,port,sequence=0,now=1577836800;
  const open=async()=>{
    app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async()=>{if(app) {await app.close();app=null;}};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const snapshot=()=>app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]);
  const saveBody=(putItems,deleteItems={})=>{
    const after={};
    for(const name of new Set([...Object.keys(putItems),...Object.keys(deleteItems)])) {
      const current=app.store.read(name).data;
      const idField=name==='UserKeyItem'?'keyItemId':'titleBadgeId',
        changed=new Set([...(putItems[name] ?? []),...(deleteItems[name] ?? [])].map(row=>row[idField]));
      after[name]=md5(name==='UserInfo' ? putItems[name] :
        [...current.filter(row=>!changed.has(row[idField])),...(putItems[name] ?? [])]);
    }
    return {badges:null,scripts:{},dataTokens:{},checksums:{before:{},after},
      deltas:[{signature:0,trigger:'UpdateTitleBadge',putItems,deleteItems}],operations:[]};
  };
  const save=(putItems,deleteItems)=>send('user_data/push',saveBody(putItems,deleteItems));
  const rejected=async(body,status=400)=>{
    const before=snapshot(),reply=await send('user_data/push',body);
    assert.equal(reply.status,status,reply.body.toString());assert.deepEqual(snapshot(),before);
  };
  const pull=()=>send('user_data/pull',{tables:['UserTitleBadge']});
  try {
    await open();
    const first=badge(69600000001),second=badge(69600000002),third=badge(69600000003);
    parse(await save({UserTitleBadge:[first,second]}));
    assert.deepEqual(app.store.read('UserTitleBadge').data,[first,second]);
    parse(await save({UserTitleBadge:[third]}));
    assert.deepEqual(app.store.read('UserTitleBadge').data,[first,second,third],'Partial puts preserve other long IDs');
    const noUnderHistory=saveBody({UserTitleBadge:[badge(69610000001)]});
    await rejected(noUnderHistory,503);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM under_pvp_title_badge').get().n,0,
      'Known Under title ID is not earning proof; the season/prize/native participation are required');
    const selected=app.store.read('UserInfo').data.map(row=>({...row,titleBadgeId:first.titleBadgeId,subTitleBadgeId:second.titleBadgeId}));
    parse(await save({UserInfo:selected}));
    assert.equal(app.store.read('UserInfo').data[0].titleBadgeId,69600000001);
    // Original eight-field key-item codec and native processed-flag branch,
    // synthetic ownership only: this is not proof of a natural feat award.
    const feat=(keyItemId,amount=1)=>({userId:seed.userId,keyItemId,amount,reservedAmount:0,
      bookEntryState:1,signature:0,cumulativeAmount:1,exploit:false});
    const held=feat(241000010),normal=feat(241000001),empty=feat(241000011,0);
    parse(await save({UserKeyItem:[held,normal,empty]}));
    parse(await save({UserKeyItem:[{keyItemId:held.keyItemId,exploit:true}]}));
    const processed={...held,exploit:true};
    assert.deepEqual(app.store.read('UserKeyItem').data,[processed,normal,empty]);
    await rejected(saveBody({UserKeyItem:[{keyItemId:held.keyItemId,exploit:false}]}));
    await rejected(saveBody({}, {UserKeyItem:[{keyItemId:held.keyItemId}]}));
    await rejected(saveBody({UserKeyItem:[{...normal,exploit:true}]}));
    await rejected(saveBody({UserKeyItem:[{...empty,exploit:true}]}));
    for(const changes of [{userId:0},{userId:seed.userId+1},{keyItemId:69600000001},{keyItemId:241999999},
      {keyItemId:'241000010'},{amount:-1},{amount:2},{amount:'1'},{reservedAmount:-1},
      {reservedAmount:1000000000},{reservedAmount:'0'},{cumulativeAmount:-1},{cumulativeAmount:'1'},
      {bookEntryState:-129},{bookEntryState:128},{signature:-1},{signature:0x100000000},
      {signature:'0'},{exploit:1},{lastResetAt:0}])
      await rejected(saveBody({UserKeyItem:[{...processed,...changes}]}));
    await rejected(saveBody({UserKeyItem:[processed,processed]}));
    const missing=structuredClone(feat(241000012));delete missing.exploit;
    await rejected(saveBody({UserKeyItem:[missing]}));
    for(const [table,event] of [['profile','UPDATE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_key_item BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'key-item rollback'); END`);
      await rejected(saveBody({UserKeyItem:[feat(241000012)]}),503);
      app.store.db.exec('DROP TRIGGER fail_key_item');
    }
    parse(await save({UserKeyItem:[{keyItemId:held.keyItemId,amount:0,signature:0xffffffff}]}));
    const retainedKeys=app.store.read('UserKeyItem');
    assert.equal(retainedKeys.data[0].exploit,true,'Spending and processing are separate saved fields');
    for(const row of [{...third,userId:0},{...third,userId:seed.userId+1},{...third,titleBadgeId:0},
      {...third,titleBadgeId:69699999999},{...third,titleBadgeId:'69600000003'},
      {...third,titleBadgeId:Number.MAX_SAFE_INTEGER+1},{...third,signature:0}])
      await rejected(saveBody({UserTitleBadge:[row]}));
    await rejected(saveBody({UserTitleBadge:[third,third]}));
    await rejected(saveBody({}, {UserTitleBadge:[third]}));
    await rejected(saveBody({UserInfo:selected.map(row=>({...row,titleBadgeId:69610000001}))}));
    const fourth=badge(69600000004),combined={UserTitleBadge:[fourth],
      UserInfo:selected.map(row=>({...row,subTitleBadgeId:fourth.titleBadgeId}))};
    for(const [table,event] of [['profile','UPDATE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_title_badge BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'badge rollback'); END`);
      await rejected(saveBody(combined),503);
      app.store.db.exec('DROP TRIGGER fail_title_badge');
    }
    parse(await save(combined));
    const owned=app.store.read('UserTitleBadge'),info=app.store.read('UserInfo'),wallet=app.store.hardCurrency(),queue=app.store.operations();
    const response=await pull(),pullSequence=sequence;assert.equal(response.status,200);
    await close();now+=86400*1000;await open();
    assert.deepEqual(app.store.read('UserTitleBadge'),owned);assert.deepEqual(app.store.read('UserInfo'),info);
    assert.deepEqual(app.store.read('UserKeyItem'),retainedKeys);
    assert.equal(app.store.hardCurrency(),wallet);assert.deepEqual(app.store.operations(),queue);
    assert.equal((await pull()).status,200,'Clock movement does not expire earned native title rows');
    // Retain an unreadable/foreign imported table; do not normalize it into an empty list.
    const corrupt=[{...first,userId:seed.userId+1}];
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(corrupt),md5(corrupt),'UserTitleBadge');
    let before=snapshot(),reply=await pull();
    assert.equal(reply.status,503);assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);assert.deepEqual(snapshot(),before);
    before=snapshot();reply=await request(port,pullSequence,{tables:['UserTitleBadge']},String(pullSequence),'user_data/pull');
    assert.equal(reply.status,503);assert.deepEqual(snapshot(),before,'Cached binary pull must not replay the old valid table');
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(owned.data),owned.token,'UserTitleBadge');
    const keyPull={tables:['UserKeyItem']};assert.equal((await send('user_data/pull',keyPull)).status,200);
    const keySequence=sequence,badKey=[{...processed,exploit:'true'}];
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(badKey),md5(badKey),'UserKeyItem');
    before=snapshot();reply=await send('user_data/pull',keyPull);
    assert.equal(reply.status,503);assert.deepEqual(snapshot(),before);
    reply=await request(port,keySequence,keyPull,String(keySequence),'user_data/pull');
    assert.equal(reply.status,503);assert.deepEqual(snapshot(),before,'A cached key-item pull cannot mask corrupt native flags');
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(retainedKeys.data),retainedKeys.token,'UserKeyItem');
    parse(await save({UserInfo:info.data.map(row=>({...row,titleBadgeId:0,subTitleBadgeId:0}))}));
    assert.deepEqual(app.store.read('UserTitleBadge'),owned,'Unequipping titles is not deletion or a new award');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
  console.log('Native title-badge persistence fixtures passed; earning and client acceptance remain unproved');
}

if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
