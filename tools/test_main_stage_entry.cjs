'use strict';

// Disposable synthetic chapter-entry saves, NOT native acceptance.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-main-entry-'));
  let app,database,port,sequence=0,lastLog='';
  const chapters=[[91218009,670100002,1010000201101],[91218010,670100003,1010000301101],
    [91218014,670100004,1010000401101],[91218025,670100005,1010000501101]];
  const open=async()=>{
    app=createServer({database,seed,master,wallNowSeconds:()=>1790866800,log:line=>{lastLog=line;}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async()=>{if(app){await app.close();app=null;}};
  const send=(action,body)=>request(port,++sequence,body,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected=async(pending,status,before=snapshot(),structured=true)=>{
    const reply=await pending;assert.equal(reply.status,status,lastLog);assert.equal(snapshot(),before);
    if(status===503 && structured)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const push=(putItems={},deleteItems={})=>send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name] ?? [])]))},
    deltas:[{signature:0,trigger:'FeatureUnlock',putItems,deleteItems}],operations:[],
  });
  const setup=(flagId,stageId,absent,owner)=>{
    put('UserSystemFlag',app.store.read('UserSystemFlag').data.map(row=>row.systemFlagId===flagId ?
      {...row,userId:owner,flagValue:1,lastUpdatedAt:17} : row));
    put('UserAdventureStage',[...app.store.read('UserAdventureStage').data.filter(row=>row.adventureStageId!==stageId),
      ...(!absent ? [{...stage(stageId),state:0}] : [])]);
  };
  const flag=id=>app.store.read('UserSystemFlag').data.find(row=>row.systemFlagId===id);
  const stage=id=>({...app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===id) ??
    app.store.read('UserAdventureStage').data[0],adventureStageId:id,state:1,tasks:[],cumulativeClearCount:0,
    dailyClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0,token:''});
  try {
    for(const [flagId,adventureId,stageId]of chapters)for(const absent of [false,true])for(const flagFirst of [true,false]) {
      database=path.join(directory,`${flagId}-${absent}-${flagFirst}.sqlite`);await open();setup(flagId,stageId,absent,absent?0:seed.userId);
      // Current CP hero is not the chapter-choice enum.
      put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,heroType:(adventureId%3)})));
      const current={...flag(flagId),flagValue:2},opened=stage(stageId),wallet=app.store.hardCurrency(),
        pullBody={tables:['UserSystemFlag','UserAdventureStage']};
      assert.equal((await send('user_data/pull',pullBody)).status,200);const oldPull=sequence;
      const first=flagFirst ? {UserSystemFlag:[current]} : {UserAdventureStage:[opened]};
      for(const [table,event]of [['profile','UPDATE'],['stage_main_entry','INSERT'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_entry BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'main entry'); END`);
        await rejected(push(first),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_entry');
      }
      const response=parse(await push(first)),receipt=app.store.db.prepare('SELECT * FROM stage_main_entry WHERE flag_id=?').get(flagId),
        capture=JSON.parse(receipt.capture_json);
      assert.deepEqual(capture.effects,[{stageId,kind:'open'}]);assert.equal(capture.flagId,flagId);assert.equal(capture.stageId,stageId);
      assert.equal(capture.before,absent?null:0);assert.equal(receipt.flag_saved,Number(flagFirst));assert.equal(receipt.complete,0);
      assert.deepEqual(response.operations,[]);assert.equal(app.store.hardCurrency(),wallet);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_queue').get().n,0);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_unlock_floor').get().n,0,'No partial floor or fake ACK');
      app.store.db.exec("CREATE TRIGGER no_unchanged_entry BEFORE UPDATE ON stage_main_entry BEGIN SELECT RAISE(ABORT,'unchanged entry'); END");
      parse(await push(first));app.store.db.exec('DROP TRIGGER no_unchanged_entry');
      for(const [column,raw]of [['capture_json','null'],['capture_json','bad-json'],['capture_json','{}'],
        ['capture_json',JSON.stringify({...capture,effects:[]})],['capture_json',JSON.stringify({...capture,graphHash:'wrong'})],
        ['before_json',JSON.stringify({...JSON.parse(receipt.before_json),flagValue:0})],['before_json','{}']]) {
        app.store.db.prepare(`UPDATE stage_main_entry SET ${column}=? WHERE flag_id=?`).run(raw,flagId);
        await rejected(send('user_data/confirm',undefined),503);
        app.store.db.prepare(`UPDATE stage_main_entry SET ${column}=? WHERE flag_id=?`).run(receipt[column],flagId);
      }
      const originalKey=master.adventureKeys[adventureId];
      try {master.adventureKeys[adventureId]='changed-catalog';await rejected(send('user_data/confirm',undefined),503);}
      finally {master.adventureKeys[adventureId]=originalKey;}
      await close();await open();
      for(const [action,body]of [['user/login',undefined],['user_data/confirm',undefined],['user_data/pull',pullBody]])
        await rejected(send(action,body),503);
      await rejected(request(port,oldPull,pullBody,String(oldPull),'user_data/pull'),503);
      if(flagFirst) {
        await rejected(push({UserSystemFlag:[{...current,flagValue:1}]}),400);
        await rejected(push({}, {UserSystemFlag:[{systemFlagId:flagId}]}),400);
      }else {
        await rejected(push({UserAdventureStage:[{...opened,state:0}]}),400);
        await rejected(push({}, {UserAdventureStage:[{adventureStageId:stageId}]}),400);
      }
      const second=flagFirst ? {UserAdventureStage:[opened]} : {UserSystemFlag:[current]};
      for(const [table,event]of [['profile','UPDATE'],['stage_main_entry','UPDATE'],['stage_unlock_floor','INSERT'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_finish BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'main finish'); END`);
        await rejected(push(second),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_finish');
      }
      parse(await push(second));await close();await open();
      const completed=app.store.db.prepare('SELECT * FROM stage_main_entry WHERE flag_id=?').get(flagId),
        floor=app.store.db.prepare('SELECT * FROM stage_unlock_floor WHERE stage_id=?').get(stageId);
      assert.equal(completed.complete,1);assert.equal(floor.operation_id,0);assert.equal(floor.entry_flag_id,flagId);
      assert.equal(floor.entry_character_id,null);assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_done').get().n,0);
      await rejected(push({UserSystemFlag:[{...current,flagValue:1}]}),400);
      await rejected(push({}, {UserSystemFlag:[{systemFlagId:flagId}]}),400);
      await rejected(push({UserAdventureStage:[{...opened,state:0}]}),400);
      await rejected(push({}, {UserAdventureStage:[{adventureStageId:stageId}]}),400);
      await rejected(request(port,oldPull,pullBody,String(oldPull),'user_data/pull'),503);
      app.store.db.prepare('DELETE FROM stage_unlock_floor WHERE stage_id=?').run(stageId);
      await rejected(send('user_data/confirm',undefined),503);
      app.store.db.prepare('INSERT INTO stage_unlock_floor(stage_id,operation_id,entry_flag_id) VALUES(?,0,?)').run(stageId,flagId);
      app.store.db.prepare('UPDATE stage_unlock_floor SET entry_character_id=? WHERE stage_id=?').run(100000001,stageId);
      await rejected(send('user_data/confirm',undefined),503);
      app.store.db.prepare('UPDATE stage_unlock_floor SET entry_character_id=NULL WHERE stage_id=?').run(stageId);
      assert.equal((await send('user_data/pull',pullBody)).status,200);
      parse(await push({UserSystemFlag:[{lastUpdatedAt:current.lastUpdatedAt,flagValue:2,userId:current.userId,systemFlagId:flagId}]}));
      assert.deepEqual(app.store.db.prepare('SELECT * FROM stage_main_entry WHERE flag_id=?').get(flagId),completed,'Do not replay entry');
      assert.equal(app.store.hardCurrency(),wallet);await close();
    }
    //23af3c0 ->1a5893c: ready1 can remain unsaved between original initialization
    // and consumption. Capture actual zero/absence, NOT a synthetic saved flag1.
    for(const [chapterFlagId,,firstId]of chapters)for(const absentFlag of [false,true])for(const order of ['flag','stage','combined']) {
      database=path.join(directory,`coalesced-${chapterFlagId}-${absentFlag}-${order}.sqlite`);await open();
      setup(chapterFlagId,firstId,true,absentFlag?0:seed.userId);
      put('UserSystemFlag',app.store.read('UserSystemFlag').data.filter(row=>!absentFlag || row.systemFlagId!==chapterFlagId)
        .map(row=>row.systemFlagId===chapterFlagId?{...row,flagValue:0}:row));
      const beforeFlag=flag(chapterFlagId) ?? null,
        rule=master.featureUnlocks.find(row=>row.flagKey===master.systemFlags[chapterFlagId].key),
        prerequisiteId=Number(Object.keys(master.stageKeys).find(id=>master.stageKeys[id]===rule.stageKey)),
        cleared={...stage(prerequisiteId),state:4,cumulativeClearCount:1,
          firstCompleteDateTime:1790866800,lastCompleteDateTime:1790866800},
        consumed={...beforeFlag ?? {userId:0,systemFlagId:chapterFlagId,lastUpdatedAt:0},flagValue:2},
        opened=stage(firstId),wallet=app.store.hardCurrency(),pullBody={tables:['UserSystemFlag','UserAdventureStage']};
      put('UserAdventureStage',[...app.store.read('UserAdventureStage').data.filter(row=>row.adventureStageId!==prerequisiteId),
        {...cleared,state:3}]);
      await rejected(push({UserSystemFlag:[consumed],UserAdventureStage:[cleared,opened]}),400,
        snapshot()); // A newly submitted clear is not the captured already-saved lazy prerequisite.
      put('UserAdventureStage',app.store.read('UserAdventureStage').data.map(row=>row.adventureStageId===prerequisiteId?cleared:row));
      assert.equal((await send('user_data/pull',pullBody)).status,200);const oldPull=sequence;
      for(const changes of [{userId:3},{lastUpdatedAt:consumed.lastUpdatedAt+1}])
        await rejected(push({UserSystemFlag:[{...consumed,...changes}]}),400);
      const first=order==='flag'?{UserSystemFlag:[consumed]}:order==='stage'?{UserAdventureStage:[opened]}:
        {UserSystemFlag:[consumed],UserAdventureStage:[opened]};
      const issueTables=order==='stage'?['profile','reply_cache']:['profile','stage_main_entry','feature_unlock_floor',
        ...(order==='combined'?['stage_unlock_floor']:[]),'reply_cache'];
      for(const table of issueTables) {
        app.store.db.exec(`CREATE TRIGGER fail_coalesced BEFORE ${table==='profile'?'UPDATE':'INSERT'} ON ${table} BEGIN SELECT RAISE(ABORT,'coalesced entry'); END`);
        await rejected(push(first),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_coalesced');
      }
      const firstResponse=parse(await push(first));assert.deepEqual(firstResponse.operations,[]);
      if(order==='stage') {
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_main_entry').get().n,0,
          'Generic stage-only initialization is not attributed to consuming a zero flag');
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM feature_unlock_floor').get().n,0);
        assert.equal((await send('user_data/pull',pullBody)).status,200);await close();await open();
      }else if(order==='flag') {
        const pending=app.store.db.prepare('SELECT * FROM stage_main_entry WHERE flag_id=?').get(chapterFlagId);
        assert.equal(pending.complete,0);assert.equal(pending.flag_saved,1);
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_unlock_floor').get().n,0);
        await close();await open();await rejected(send('user_data/confirm',undefined),503);
        await rejected(request(port,oldPull,pullBody,String(oldPull),'user_data/pull'),503);
        await rejected(push({UserSystemFlag:[{...consumed,flagValue:1}]}),400);
      }
      if(order!=='combined') {
        const second=order==='flag'?{UserAdventureStage:[opened]}:{UserSystemFlag:[consumed]},
          finishTables=order==='flag'?['profile','stage_main_entry','stage_unlock_floor','reply_cache']:
            ['profile','stage_main_entry','feature_unlock_floor','reply_cache'];
        for(const table of finishTables) {
          const event=table==='profile' || table==='stage_main_entry' && order==='flag'?'UPDATE':'INSERT';
          app.store.db.exec(`CREATE TRIGGER fail_coalesced_finish BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'coalesced finish'); END`);
          await rejected(push(second),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_coalesced_finish');
        }
        parse(await push(second));
      }
      const entry=app.store.db.prepare('SELECT * FROM stage_main_entry WHERE flag_id=?').get(chapterFlagId),
        enabling=JSON.parse(entry.enabling_json),capture=JSON.parse(entry.capture_json),
        featureFloor=app.store.db.prepare('SELECT * FROM feature_unlock_floor WHERE flag_id=?').get(chapterFlagId);
      assert.equal(entry.complete,1);assert.deepEqual(JSON.parse(entry.before_json),beforeFlag);
      assert.deepEqual(capture.effects,order==='stage'?[]:[{stageId:firstId,kind:'open'}]);
      assert.equal(enabling.stageId,prerequisiteId);assert.equal(enabling.beforeState,4);
      assert.match(enabling.catalogHash,/^[0-9a-f]{32}$/);assert.equal(featureFloor.operation_id,null);
      assert.equal(featureFloor.stage_id,prerequisiteId);assert.equal(featureFloor.owner,consumed.userId);
      assert.deepEqual(JSON.parse(featureFloor.before_json),beforeFlag);
      assert.equal(flag(chapterFlagId).flagValue,2,'No fabricated intermediate saved flag1');
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_queue').get().n,0);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_done').get().n,0);
      for(const raw of [null,'null','bad-json','{}',JSON.stringify({...enabling,beforeState:3}),
        JSON.stringify({...enabling,catalogHash:'wrong'})]) {
        app.store.db.prepare('UPDATE stage_main_entry SET enabling_json=? WHERE flag_id=?').run(raw,chapterFlagId);
        await rejected(send('user_data/confirm',undefined),503);
        app.store.db.prepare('UPDATE stage_main_entry SET enabling_json=? WHERE flag_id=?').run(entry.enabling_json,chapterFlagId);
      }
      if(order==='stage') {
        const savedStages=app.store.read('UserAdventureStage').data;
        put('UserAdventureStage',savedStages.filter(row=>row.adventureStageId!==firstId));
        await rejected(send('user_data/confirm',undefined),503);
        put('UserAdventureStage',savedStages);
      }
      app.store.db.prepare('DELETE FROM feature_unlock_floor WHERE flag_id=?').run(chapterFlagId);
      await rejected(send('user_data/confirm',undefined),503);
      app.store.db.prepare('INSERT INTO feature_unlock_floor(flag_id,operation_id,stage_id,before_json,owner,catalog_hash) VALUES(?,?,?,?,?,?)')
        .run(featureFloor.flag_id,featureFloor.operation_id,featureFloor.stage_id,featureFloor.before_json,featureFloor.owner,featureFloor.catalog_hash);
      await rejected(push({UserAdventureStage:[{...cleared,state:3}]}),400);
      await rejected(push({}, {UserAdventureStage:[{adventureStageId:prerequisiteId}]}),400);
      await rejected(push({UserAdventureStage:[{...opened,state:0}]}),400);
      await rejected(push({}, {UserAdventureStage:[{adventureStageId:firstId}]}),400);
      await rejected(push({}, {UserSystemFlag:[{systemFlagId:chapterFlagId}]}),400);
      await close();await open();assert.equal((await send('user_data/pull',pullBody)).status,200);
      await rejected(request(port,oldPull,pullBody,String(oldPull),'user_data/pull'),503);
      assert.equal(app.store.hardCurrency(),wallet);await close();
    }
    const [flagId,,stageId]=chapters[0];
    for(const state of [1,4]) {
      database=path.join(directory,`preowned-${state}.sqlite`);await open();setup(flagId,stageId,false,seed.userId);
      put('UserAdventureStage',app.store.read('UserAdventureStage').data.map(row=>row.adventureStageId===stageId?{...row,state}:row));
      parse(await push({UserSystemFlag:[{...flag(flagId),flagValue:2}]}));
      const row=app.store.db.prepare('SELECT * FROM stage_main_entry WHERE flag_id=?').get(flagId);
      assert.equal(row.complete,1);assert.deepEqual(JSON.parse(row.capture_json).effects,[]);
      assert.equal(app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===stageId).state,state);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_unlock_floor').get().n,0);
      await rejected(push({UserAdventureStage:[{...stage(stageId),state:0}]}),400);
      await rejected(push({}, {UserAdventureStage:[{adventureStageId:stageId}]}),400);await close();
    }
    database=path.join(directory,'unknown-legacy.sqlite');await open();setup(flagId,stageId,true,seed.userId);
    put('UserSystemFlag',app.store.read('UserSystemFlag').data.map(row=>row.systemFlagId===flagId?{...row,flagValue:2}:row));
    parse(await push({UserAdventureStage:[stage(stageId)]}));
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_main_entry').get().n,0,'Never recapture an old consumed flag');await close();
    database=path.join(directory,'invalid-native-fields.sqlite');await open();setup(flagId,stageId,false,seed.userId);
    for(const changes of [{userId:3},{lastUpdatedAt:18}])
      await rejected(push({UserSystemFlag:[{...flag(flagId),flagValue:2,...changes}]}),400);
    for(const systemFlagId of [String(flagId),0,-1,0x80000000]) {
      await rejected(push({UserSystemFlag:[{...flag(flagId),flagValue:2,systemFlagId}]}),400);
      await rejected(push({}, {UserSystemFlag:[{systemFlagId}]}),400);
    }
    await rejected(push({UserSystemFlag:[flag(flagId),flag(flagId)]}),400);
    await rejected(push({}, {UserSystemFlag:[{systemFlagId:flagId},{systemFlagId:flagId}]}),400);
    console.log('Four original chapter-entry flag/stage checkpoints: synthetic checks OK; native acceptance pending');
  }finally{await close();fs.rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
