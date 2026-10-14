'use strict';

// Original rule identity with synthetic saves, NOT native acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),
  os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request,stageXpFixture}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-feature-unlocks-'));
  let app,database,port,sequence=0,lastLog='';
  const rules=master.featureUnlocks.map(rule=>({...rule,
    stageId:Number(Object.keys(master.stageKeys).find(id=>master.stageKeys[id]===rule.stageKey)),
    id:Number(Object.keys(master.systemFlags).find(id=>master.systemFlags[id].key===rule.flagKey)),
  }));
  const open=async()=>{
    app=createServer({database,seed,master,wallNowSeconds:()=>1790866800,log:line=>{lastLog=line;}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async()=>{if(app){await app.close();app=null;}};
  const send=(action,body)=>request(port,++sequence,body,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString() || lastLog);return JSON.parse(reply.body);};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows),md5(rows),name);
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected=async(pending,status,before=snapshot(),structured=true)=>{
    const reply=await pending;assert.equal(reply.status,status,lastLog);assert.equal(snapshot(),before);
    if(status===503 && structured)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const push=(putItems={},operations=[],deleteItems={})=>send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name] ?? [])]))},
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length ?
      [{signature:0,trigger:'FeatureUnlock',putItems,deleteItems}] : [],
    operations:operations.map(row=>({id:row.id,verifier:row.token})),
  });
  const flags=()=>app.store.read('UserSystemFlag').data;
  const stages=()=>app.store.read('UserAdventureStage').data;
  const taskIds=new Map();
  for(const [id,row]of Object.entries(master.stageTasks)) {
    if(!taskIds.has(row.stageId))taskIds.set(row.stageId,[]);
    taskIds.get(row.stageId).push(Number(id));
  }
  const tasks=(id,state)=>(taskIds.get(id) ?? []).map(adventureStageTaskId=>({adventureStageTaskId,state}));
  const stage=(id,state)=>({...stages().find(row=>row.adventureStageId===id) ?? stages()[0],
    adventureStageId:id,state,tasks:tasks(id,state===4?2:0),cumulativeClearCount:state===4?1:0,dailyClearCount:0,
    firstCompleteDateTime:state===4?1790866800:0,lastCompleteDateTime:state===4?1790866800:0,token:''});
  const setup=(selected,state=1,absent=false)=>{
    const ids=new Set(selected.map(rule=>rule.id));
    put('UserSystemFlag',flags().filter(row=>!absent || !ids.has(row.systemFlagId)).map(row=>
      ids.has(row.systemFlagId)?{...row,userId:0,flagValue:0,lastUpdatedAt:17}:row));
    const id=selected[0].stageId;
    // Synthetic completed prerequisites isolate this rule from unrelated chapter
    // graph opens. They do NOT prove natural unlocks or original initialization.
    const base=stages()[0];
    put('UserAdventureStage',[...stages().filter(row=>master.stages[row.adventureStageId]?.adventureType!==1),
      ...Object.keys(master.stages).map(Number).filter(stageId=>master.stages[stageId].adventureType===1).map(stageId=>
        ({...base,adventureStageId:stageId,state:4,tasks:tasks(stageId,2),cumulativeClearCount:1,dailyClearCount:0,
          firstCompleteDateTime:1790866800,lastCompleteDateTime:1790866800,token:''}))]
      .map(row=>row.adventureStageId===id?{...row,...stage(id,state)}:row));
    if(master.stages[id].rewardType===50) {
      const pcId=master.pcs[master.stages[id].rewardKey],owned={...app.store.read('UserPC').data[0],pcId,
        joiningState:1,currentJobIndex:1,totalExp:0,limitbreakCount:0,heroSublimateLevel:0,isUnlockedHeroSublimate:false};
      put('UserPC',[...app.store.read('UserPC').data.filter(row=>row.pcId!==pcId),owned]);
      put('UserPCJobSet',[...app.store.read('UserPCJobSet').data.filter(row=>row.pcId!==pcId),
        {userId:seed.userId,pcId,pcJobs:[],signature:0}]);
    }
  };
  const targets=selected=>selected.map(rule=>({...flags().find(row=>row.systemFlagId===rule.id) ??
    {userId:0,systemFlagId:rule.id,lastUpdatedAt:0},flagValue:1}));
  const body=id=>({adventureStageId:id,token:'feature-clear',adventureStageTaskIds:[],adventureGainedItems:[],friendshipStates:[],
    secretMissionCompleted:false,isEnemyAnnihilated:true,adventureRecord:{continueCount:0,deathCount:0,turnCount:3}});
  try {
    const groups=[...new Set(rules.map(row=>row.stageId))];
    for(const stageId of groups)for(const flagFirst of [true,false])for(const absent of [false,true]) {
      const selected=rules.filter(row=>row.stageId===stageId);
      database=path.join(directory,`${stageId}-${flagFirst}-${absent}.sqlite`);await open();setup(selected,1,absent);
      const initialFlags=app.store.read('UserSystemFlag'),pullBody={tables:['UserSystemFlag']};
      assert.equal((await send('user_data/pull',pullBody)).status,200);const oldPull=sequence;
      const operation=parse(await send('adventure/stage/complete',body(stageId))).operation,
        receipt=app.store.db.prepare('SELECT * FROM stage_delivery WHERE operation_id=?').get(operation.id),
        capture=JSON.parse(receipt.feature_unlocks),enabled=targets(selected),before=operation.parameters.UserAdventureStage[0],
        cleared={...before,state:4,cumulativeClearCount:before.cumulativeClearCount+1,
          firstCompleteDateTime:before.firstCompleteDateTime || 1790866800,lastCompleteDateTime:1790866800},
        // Existing convenience supplies EXP/SP/story prerequisites, never feature flags.
        stageSave=stageXpFixture(app.store,{UserAdventureStage:[cleared]},[operation]),flagSave={UserSystemFlag:enabled},
        issuedWallet=app.store.hardCurrency();
      // Explicit synthetic inventory acquisition, not natural reward earning.
      // Feature ACKs must still prove the same ordinary rewards as any stage.
      for(const reward of app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(operation.id)) {
        const previous=app.store.read(reward.table_name).data.find(row=>row[reward.id_field]===reward.item_id);
        (stageSave[reward.table_name] ??= []).push({...previous,userId:seed.userId,[reward.id_field]:reward.item_id,
          ...(reward.table_name==='UserAdventureTicket' && !previous?{lastResetAt:0,bookEntryState:1,signature:0}:{}),
          ...(reward.table_name==='UserMemoriaExpItem' && !previous?{lastAquiredAt:0,reservedAmount:0,bookEntryState:1,signature:0}:{}),
          ...(reward.table_name==='UserAlarmVoiceItem' && !previous?{reservedAmount:0,bookEntryState:1,signature:0}:{}),
          ...(reward.table_name==='UserLimitBreakItem' && !previous?{bookEntryState:1,signature:0}:{}),
          cumulativeAmount:reward.cumulative_amount,...(reward.table_name==='UserGachaTicket'?{dateList:[]}:{amount:0})});
      }
      assert.deepEqual(capture.flags.map(row=>row.id),selected.map(row=>row.id));
      assert.ok(capture.flags.every(row=>row.required && (absent?row.before===null:row.before.flagValue===0)));
      assert.deepEqual(app.store.read('UserSystemFlag'),initialFlags,'No flag precredit or fabricated wire row');
      assert.equal(operation.parameters.UserSystemFlag,undefined);
      await rejected(push({UserSystemFlag:[{...enabled[0],lastUpdatedAt:absent?1:18}]}),400);
      for(const raw of [null,'bad-json','{}',JSON.stringify({...capture,flags:[]}),
        JSON.stringify({...capture,flags:capture.flags.map(row=>({...row,catalogHash:'wrong'}))})]) {
        app.store.db.prepare('UPDATE stage_delivery SET feature_unlocks=? WHERE operation_id=?').run(raw,operation.id);
        await rejected(send('user_data/confirm',undefined),503);
        app.store.db.prepare('UPDATE stage_delivery SET feature_unlocks=? WHERE operation_id=?').run(receipt.feature_unlocks,operation.id);
      }
      await rejected(push(stageSave,[operation]),400);
      const first=flagFirst?flagSave:stageSave,second=flagFirst?stageSave:flagSave;
      for(const [table,event]of [['profile','UPDATE'],['stage_delivery','UPDATE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_feature BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'feature save'); END`);
        await rejected(push(first),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_feature');
      }
      parse(await push(first));assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM feature_unlock_floor').get().n,0);
      assert.deepEqual(app.store.operations(),[operation]);await close();await open();
      if(flagFirst) {
        const beforeRecovery=snapshot();assert.deepEqual(app.store.stageColdRecovery(operation),operation);assert.equal(snapshot(),beforeRecovery);
        parse(await send('user/login',undefined));assert.equal((await send('user_data/pull',pullBody)).status,200);
        assert.deepEqual(parse(await send('user_data/confirm',undefined)).operations.find(row=>row.id===operation.id),operation);
      } else {
        await rejected(send('user/login',undefined),503);await rejected(send('user_data/pull',pullBody),503);
      }
      await rejected(request(port,oldPull,pullBody,String(oldPull),'user_data/pull'),503);
      if(flagFirst) {
        await rejected(push({UserSystemFlag:[{...enabled[0],flagValue:0}]}),400);
        await rejected(push({},[],{UserSystemFlag:[{systemFlagId:enabled[0].systemFlagId}]}),400);
      }
      for(const table of ['profile','feature_unlock_floor','operation_done','reply_cache']) {
        const event=table==='profile'?'UPDATE':'INSERT';
        app.store.db.exec(`CREATE TRIGGER fail_feature_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'feature ACK'); END`);
        await rejected(push(second,[operation]),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_feature_ack');
      }
      parse(await push(second,[operation]));assert.deepEqual(app.store.operations(),[]);await close();await open();
      for(const rule of selected) {
        const floor=app.store.db.prepare('SELECT * FROM feature_unlock_floor WHERE flag_id=?').get(rule.id);
        assert.equal(floor.operation_id,operation.id);assert.equal(floor.stage_id,stageId);assert.equal(floor.owner,0);
        await rejected(push({UserSystemFlag:[{...enabled.find(row=>row.systemFlagId===rule.id),flagValue:0}]}),400);
        for(const [column,value]of [['catalog_hash','wrong'],['before_json','{}'],['owner',3],['stage_id',1]]) {
          app.store.db.prepare(`UPDATE feature_unlock_floor SET ${column}=? WHERE flag_id=?`).run(value,rule.id);
          await rejected(send('user_data/confirm',undefined),503);
          app.store.db.prepare(`UPDATE feature_unlock_floor SET ${column}=? WHERE flag_id=?`).run(floor[column],rule.id);
        }
      }
      app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(operation.id);
      await rejected(send('user_data/confirm',undefined),503);
      app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(operation.id);
      await rejected(push({UserAdventureStage:[{...cleared,state:0}]}),400);
      await rejected(request(port,oldPull,pullBody,String(oldPull),'user_data/pull'),503);
      assert.equal((await send('user_data/pull',pullBody)).status,200);assert.equal(app.store.hardCurrency(),issuedWallet);
      const repeated=parse(await send('adventure/stage/complete',{...body(stageId),token:'repeat'})).operation,
        again=JSON.parse(app.store.db.prepare('SELECT feature_unlocks FROM stage_delivery WHERE operation_id=?').get(repeated.id).feature_unlocks);
      assert.ok(again.flags.every(row=>!row.required),'Already-positive flags have no new effect');await close();
    }
    // DEFERRED: a persisted native ready1 may be consumed before its independent
    // stage-result ACK. All prerequisites/reward saves below are synthetic.
    const chapterEntries=new Map([[91218009,1010000201101],[91218010,1010000301101],
      [91218014,1010000401101],[91218025,1010000501101]]);
    for(const [flagId,firstId] of chapterEntries)for(const flagFirst of [true,false])for(const order of ['flag','stage','combined']) {
      const rule=rules.find(row=>row.id===flagId),absent=flagFirst;
      database=path.join(directory,`pending-entry-${flagId}-${flagFirst}-${order}.sqlite`);
      await open();setup([rule],1,absent);
      put('UserAdventureStage',stages().map(row=>row.adventureStageId===firstId?stage(firstId,0):row));
      const pullBody={tables:['UserSystemFlag','UserAdventureStage']};
      assert.equal((await send('user_data/pull',pullBody)).status,200);const oldPull=sequence;
      const operation=parse(await send('adventure/stage/complete',body(rule.stageId))).operation,
        before=operation.parameters.UserAdventureStage[0],enabled=targets([rule]),opened=stage(firstId,1),
        consumed={...enabled[0],flagValue:2},wallet=app.store.hardCurrency(),
        cleared={...before,state:4,cumulativeClearCount:before.cumulativeClearCount+1,
          firstCompleteDateTime:before.firstCompleteDateTime || 1790866800,lastCompleteDateTime:1790866800},
        stageSave=stageXpFixture(app.store,{UserAdventureStage:[cleared]},[operation]);
      for(const reward of app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(operation.id)) {
        const previous=app.store.read(reward.table_name).data.find(row=>row[reward.id_field]===reward.item_id);
        (stageSave[reward.table_name] ??= []).push({...previous,userId:seed.userId,[reward.id_field]:reward.item_id,
          ...(reward.table_name==='UserAdventureTicket' && !previous?{lastResetAt:0,bookEntryState:1,signature:0}:{}),
          ...(reward.table_name==='UserMemoriaExpItem' && !previous?{lastAquiredAt:0,reservedAmount:0,bookEntryState:1,signature:0}:{}),
          ...(reward.table_name==='UserAlarmVoiceItem' && !previous?{reservedAmount:0,bookEntryState:1,signature:0}:{}),
          ...(reward.table_name==='UserLimitBreakItem' && !previous?{bookEntryState:1,signature:0}:{}),
          cumulativeAmount:reward.cumulative_amount,...(reward.table_name==='UserGachaTicket'?{dateList:[]}:{amount:0})});
      }
      await rejected(push({UserSystemFlag:[{...consumed,userId:3}],UserAdventureStage:[opened]}),400);
      if(!flagFirst)parse(await push(stageSave));
      parse(await push({UserSystemFlag:enabled}));
      const ready=app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id);
      assert.ok(JSON.parse(ready.observed).includes(`feature:${flagId}`));
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM feature_unlock_floor').get().n,0);
      const flagSave={UserSystemFlag:[consumed]},openSave={UserAdventureStage:[opened]},
        first=order==='combined'?{...flagSave,...openSave}:order==='flag'?flagSave:openSave;
      for(const table of ['profile','stage_main_entry','reply_cache',...(order==='combined'?['stage_unlock_floor']:[])]) {
        app.store.db.exec(`CREATE TRIGGER fail_pending_entry BEFORE ${table==='profile'?'UPDATE':'INSERT'} ON ${table}
          BEGIN SELECT RAISE(ABORT,'pending chapter entry'); END`);
        await rejected(push(first),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_pending_entry');
      }
      parse(await push(first));
      assert.deepEqual(app.store.operations(),[operation]);await close();await open();
      await rejected(send('user_data/confirm',undefined),503);
      if(order!=='combined') {
        const second=order==='flag'?openSave:flagSave;
        for(const table of ['profile','stage_main_entry','stage_unlock_floor','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER fail_pending_finish BEFORE ${['profile','stage_main_entry'].includes(table)?'UPDATE':'INSERT'} ON ${table}
            BEGIN SELECT RAISE(ABORT,'pending chapter finish'); END`);
          await rejected(push(second),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_pending_finish');
        }
        parse(await push(second));
      }
      const entry=app.store.db.prepare('SELECT * FROM stage_main_entry WHERE flag_id=?').get(flagId),
        floor=app.store.db.prepare('SELECT * FROM stage_unlock_floor WHERE stage_id=?').get(firstId);
      assert.equal(entry.complete,1);assert.equal(entry.enabling_json,null);
      assert.deepEqual(JSON.parse(entry.before_json),enabled[0]);
      assert.deepEqual(JSON.parse(entry.capture_json).effects,[{stageId:firstId,kind:'open'}]);
      assert.equal(floor.operation_id,0);assert.equal(floor.entry_flag_id,flagId);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_done').get().n,0,'Chapter completion is not a stage ACK');
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM feature_unlock_floor').get().n,0);
      parse(await push(first));assert.deepEqual(app.store.operations(),[operation]);
      await rejected(push({UserSystemFlag:enabled}),400);
      await rejected(push({UserAdventureStage:[{...opened,state:0}]}),400);
      await rejected(push({},[],{UserSystemFlag:[{systemFlagId:flagId}]}),400);
      await close();await open();
      await rejected(request(port,oldPull,pullBody,String(oldPull),'user_data/pull'),503);
      app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?')
        .run(JSON.stringify(JSON.parse(ready.observed).filter(key=>key!==`feature:${flagId}`)),operation.id);
      await rejected(push({UserSystemFlag:[consumed]}),400);
      app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(ready.observed,operation.id);
      const finalSave=flagFirst?stageSave:{};
      for(const table of ['feature_unlock_floor','operation_done','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_pending_ack BEFORE INSERT ON ${table}
          BEGIN SELECT RAISE(ABORT,'pending chapter ACK'); END`);
        await rejected(push(finalSave,[operation]),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_pending_ack');
      }
      parse(await push(finalSave,[operation]));assert.deepEqual(app.store.operations(),[]);
      assert.equal(app.store.db.prepare('SELECT operation_id FROM feature_unlock_floor WHERE flag_id=?').get(flagId).operation_id,operation.id);
      assert.equal(flags().find(row=>row.systemFlagId===flagId).flagValue,2);
      assert.equal(app.store.hardCurrency(),wallet);
      await close();await open();assert.equal((await send('user_data/pull',pullBody)).status,200);
      await rejected(request(port,oldPull,pullBody,String(oldPull),'user_data/pull'),503);
      await rejected(push({UserAdventureStage:[{...cleared,state:0}]}),400);await close();
    }
    // DEFERRED: actual0/absence -> unsaved ready1 -> consumed2, bound to the
    // original pending result. No synthetic saved1 or fake stage ACK.
    for(const [flagId,firstId] of chapterEntries)for(const absent of [false,true])
      for(const order of ['flag','stage','combined','clear-first','ack-before-open','all-ack']) {
      const rule=rules.find(row=>row.id===flagId);
      database=path.join(directory,`coalesced-result-${flagId}-${absent}-${order}.sqlite`);
      await open();setup([rule],1,absent);
      put('UserAdventureStage',stages().map(row=>row.adventureStageId===firstId?stage(firstId,0):row));
      const beforeFlag=flags().find(row=>row.systemFlagId===flagId) ?? null,
        pullBody={tables:['UserSystemFlag','UserAdventureStage']};
      assert.equal((await send('user_data/pull',pullBody)).status,200);const oldPull=sequence;
      const operation=parse(await send('adventure/stage/complete',body(rule.stageId))).operation,
        source=app.store.db.prepare('SELECT * FROM stage_delivery WHERE operation_id=?').get(operation.id),
        before=operation.parameters.UserAdventureStage[0],opened=stage(firstId,1),
        consumed={...targets([rule])[0],flagValue:2},wallet=app.store.hardCurrency(),
        cleared={...before,state:4,cumulativeClearCount:before.cumulativeClearCount+1,
          firstCompleteDateTime:before.firstCompleteDateTime || 1790866800,lastCompleteDateTime:1790866800},
        stageSave=stageXpFixture(app.store,{UserAdventureStage:[cleared]},[operation]);
      for(const reward of app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(operation.id)) {
        const previous=app.store.read(reward.table_name).data.find(row=>row[reward.id_field]===reward.item_id);
        (stageSave[reward.table_name] ??= []).push({...previous,userId:seed.userId,[reward.id_field]:reward.item_id,
          cumulativeAmount:reward.cumulative_amount,...(reward.table_name==='UserGachaTicket'?{dateList:[]}:{amount:0})});
      }
      for(const changes of [{userId:3},{lastUpdatedAt:consumed.lastUpdatedAt+1}])
        await rejected(push({UserSystemFlag:[{...consumed,...changes}]}),400);
      if(order==='stage') {
        parse(await push({UserAdventureStage:[opened]}));
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_main_entry').get().n,0,
          'A bare stage open is not attributed to an unsaved chapter flag');
      }
      if(order==='clear-first')parse(await push(stageSave));
      const first=['flag','stage','ack-before-open'].includes(order)?{UserSystemFlag:[consumed]}:
        {...(order==='all-ack'?stageSave:{}),UserSystemFlag:[consumed],
          UserAdventureStage:[...(order==='all-ack'?stageSave.UserAdventureStage:[]),opened]},
        ack=order==='all-ack'?[operation]:[],
        tables=['profile','stage_main_entry','stage_delivery','reply_cache',
          ...(!['flag','stage','ack-before-open'].includes(order)?['stage_unlock_floor']:[]),
          ...(ack.length?['feature_unlock_floor','operation_done']:[])];
      for(const table of tables) {
        app.store.db.exec(`CREATE TRIGGER fail_result_entry BEFORE ${['profile','stage_delivery'].includes(table)?'UPDATE':'INSERT'} ON ${table}
          BEGIN SELECT RAISE(ABORT,'coalesced result entry'); END`);
        await rejected(push(first,ack),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_result_entry');
      }
      parse(await push(first,ack));
      const entry=app.store.db.prepare('SELECT * FROM stage_main_entry WHERE flag_id=?').get(flagId),
        enabling=JSON.parse(entry.enabling_json),capture=JSON.parse(entry.capture_json);
      assert.deepEqual(JSON.parse(entry.before_json),beforeFlag);
      assert.equal(enabling.operationId,operation.id);assert.equal(enabling.stageId,rule.stageId);
      assert.equal(enabling.beforeState,before.state);
      assert.equal(enabling.operationHash,crypto.createHash('md5').update(source.operation_json).digest('hex'));
      assert.equal(capture.before,order==='stage'?1:0);
      assert.deepEqual(capture.effects,order==='stage'?[]:[{stageId:firstId,kind:'open'}]);
      assert.equal(entry.flag_saved,1);assert.equal(entry.complete,Number(!['flag','ack-before-open'].includes(order)));
      assert.equal(flags().find(row=>row.systemFlagId===flagId).flagValue,2,'No fabricated persisted ready1');
      assert.equal(app.store.hardCurrency(),wallet);await close();await open();
      if(!ack.length) {
        assert.deepEqual(app.store.operations(),[operation]);
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM feature_unlock_floor').get().n,0);
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_done').get().n,0);
        await rejected(send('user_data/confirm',undefined),503);
        const observation=app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id).observed;
        app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?')
          .run(JSON.stringify(JSON.parse(observation).filter(key=>key!==`feature:${flagId}`)),operation.id);
        await rejected(push({UserSystemFlag:[consumed]}),503);
        app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(observation,operation.id);
        if(order==='flag')parse(await push({UserAdventureStage:[opened]}));
        parse(await push({UserSystemFlag:[consumed]}));assert.deepEqual(app.store.operations(),[operation]);
        const finalSave=order==='clear-first'?{}:stageSave;
        for(const table of ['feature_unlock_floor','operation_done','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER fail_result_ack BEFORE INSERT ON ${table}
            BEGIN SELECT RAISE(ABORT,'coalesced result ACK'); END`);
          await rejected(push(finalSave,[operation]),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_result_ack');
        }
        parse(await push(finalSave,[operation]));
      }
      assert.deepEqual(app.store.operations(),[]);
      if(order==='ack-before-open') {
        assert.equal(app.store.db.prepare('SELECT complete FROM stage_main_entry WHERE flag_id=?').get(flagId).complete,0);
        await close();await open();await rejected(send('user_data/confirm',undefined),503);
        for(const table of ['profile','stage_main_entry','stage_unlock_floor','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER fail_settled_open BEFORE ${['profile','stage_main_entry'].includes(table)?'UPDATE':'INSERT'} ON ${table}
            BEGIN SELECT RAISE(ABORT,'settled source chapter open'); END`);
          await rejected(push({UserAdventureStage:[opened]}),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_settled_open');
        }
        parse(await push({UserAdventureStage:[opened]}));
      }
      const floor=app.store.db.prepare('SELECT * FROM feature_unlock_floor WHERE flag_id=?').get(flagId);
      assert.equal(floor.operation_id,operation.id);assert.deepEqual(JSON.parse(floor.before_json),beforeFlag);
      assert.equal(app.store.db.prepare('SELECT complete FROM stage_main_entry WHERE flag_id=?').get(flagId).complete,1);
      for(const changed of [{operationId:operation.id+1},{operationHash:'wrong'},{beforeState:4},{catalogHash:'wrong'}]) {
        app.store.db.prepare('UPDATE stage_main_entry SET enabling_json=? WHERE flag_id=?')
          .run(JSON.stringify({...enabling,...changed}),flagId);
        await rejected(send('user_data/confirm',undefined),503);
        app.store.db.prepare('UPDATE stage_main_entry SET enabling_json=? WHERE flag_id=?').run(entry.enabling_json,flagId);
      }
      await rejected(push({UserSystemFlag:[{...consumed,flagValue:1}]}),400);
      await rejected(push({UserAdventureStage:[{...opened,state:0}]}),400);
      await rejected(push({UserAdventureStage:[{...cleared,state:0}]}),400);
      await close();await open();assert.equal((await send('user_data/pull',pullBody)).status,200);
      await rejected(request(port,oldPull,pullBody,String(oldPull),'user_data/pull'),503);
      assert.equal(app.store.hardCurrency(),wallet);await close();
    }
    for(const [flagId,firstId] of chapterEntries) {
      const rule=rules.find(row=>row.id===flagId);
      database=path.join(directory,`overlapping-entry-${flagId}.sqlite`);await open();setup([rule],4,false);
      put('UserSystemFlag',flags().map(row=>row.systemFlagId===flagId?{...row,flagValue:1}:row));
      put('UserAdventureStage',stages().map(row=>row.adventureStageId===firstId?stage(firstId,1):row));
      const operation=parse(await send('adventure/stage/complete',body(firstId))).operation;
      await rejected(push({UserSystemFlag:[{...flags().find(row=>row.systemFlagId===flagId),flagValue:2}]}),503);
      assert.deepEqual(app.store.operations(),[operation]);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_main_entry').get().n,0);await close();
    }
    for(const rule of rules)for(const absent of [false,true]) {
      database=path.join(directory,`lazy-${rule.id}-${absent}.sqlite`);await open();setup([rule],4,absent);
      const enabled=targets([rule]);
      // Four story flags may now consume unsaved ready1 directly to2, but only
      // through the separate original chapter-entry/prerequisite checkpoint.
      const consumedStory=[91218009,91218010,91218014,91218025].includes(rule.id);
      for(const changes of [{userId:3},...(!consumedStory?[{flagValue:2}]:[]),{lastUpdatedAt:-1}])
        await rejected(push({UserSystemFlag:[{...enabled[0],...changes}]}),400);
      await rejected(push({UserSystemFlag:[{...enabled[0],lastUpdatedAt:absent?1:18}]}),400);
      for(const table of ['profile','feature_unlock_floor','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_lazy BEFORE ${table==='profile'?'UPDATE':'INSERT'} ON ${table} BEGIN SELECT RAISE(ABORT,'lazy feature'); END`);
        await rejected(push({UserSystemFlag:enabled}),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_lazy');
      }
      parse(await push({UserSystemFlag:enabled}));assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_queue').get().n,0);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_done').get().n,0);
      assert.equal(app.store.db.prepare('SELECT operation_id FROM feature_unlock_floor WHERE flag_id=?').get(rule.id).operation_id,null);
      await rejected(push({},[],{UserSystemFlag:[{systemFlagId:rule.id}]}),400);
      await close();await open();assert.equal((await send('user_data/pull',{tables:['UserSystemFlag']})).status,200);
      const originalKey=master.stageKeys[rule.stageId];
      try{master.stageKeys[rule.stageId]='catalog-drift';await rejected(send('user_data/confirm',undefined),503);}
      finally{master.stageKeys[rule.stageId]=originalKey;}
      await close();
    }
    database=path.join(directory,'no-clear.sqlite');await open();setup([rules[0]],1,false);
    await rejected(push({UserSystemFlag:targets([rules[0]])}),400);
    await rejected(push({UserAdventureStage:[{...stage(rules[0].stageId,4),adventureStageId:String(rules[0].stageId)}]}),400);
    await close();database=path.join(directory,'local-owner.sqlite');await open();setup([rules[0]],4,false);
    put('UserSystemFlag',flags().map(row=>row.systemFlagId===rules[0].id?{...row,userId:seed.userId}:row));
    parse(await push({UserSystemFlag:targets([rules[0]])}));
    assert.equal(app.store.db.prepare('SELECT owner FROM feature_unlock_floor WHERE flag_id=?').get(rules[0].id).owner,seed.userId);
    console.log('Original22 feature unlock/save rules: synthetic checks OK; native acceptance pending');
  }finally{await close();fs.rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
