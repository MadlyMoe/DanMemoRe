'use strict';

// Disposable synthetic saves, not signed native progression or UI proof.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer,OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const master = require('../data/danmemore-master.json');
const seed = require('../data/danmemore-seed.json');
const md5 = rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-stage-unlock-'));
  let app,database,port,sequence=0,lastLog='';
  const open = async ()=>{
    app = createServer({database,seed,master,wallNowSeconds:()=>1790866800,log:line=>{lastLog=line;}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve)); port=app.server.address().port;
  };
  const close = async ()=>{ if (app) { await app.close();app=null; } };
  const rows = ()=>app.store.read('UserAdventureStage').data;
  const row = id=>rows().find(value=>value.adventureStageId===id);
  const put = data=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(data),md5(data),'UserAdventureStage');
  const send = (action,body)=>request(port,++sequence,body,String(sequence),action);
  const parse = reply=>{assert.equal(reply.status,200,lastLog);return JSON.parse(reply.body);};
  const snapshot = ()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected = async (pending,status,before=snapshot(),structured=true)=>{
    const reply=await pending;assert.equal(reply.status,status,lastLog);
    if(status===503 && structured)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Rejects must preserve profiles, queue, captures, floors, sequence and exact replies');
  };
  const push = (stages=[],operations=[],deleted=[])=>send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:stages.length || deleted.length ? {UserAdventureStage:md5(stages)} : {}},
    deltas:stages.length || deleted.length ? [{signature:0,trigger:'AdventureComplete',
      putItems:stages.length ? {UserAdventureStage:stages} : {},deleteItems:deleted.length ? {UserAdventureStage:deleted} : {}}] : [],
    operations:operations.map(value=>({id:value.id,verifier:value.token})),
  });
  const value = id=>({adventureStageId:id,token:'story-unlock',adventureStageTaskIds:[],adventureGainedItems:[],friendshipStates:[],
    secretMissionCompleted:false,isEnemyAnnihilated:true,adventureRecord:{continueCount:0,deathCount:0,turnCount:3}});
  const complete = body=>send('adventure/stage/complete',body);
  const clear = operation=>{
    const before=operation.parameters.UserAdventureStage[0];
    return {...before,state:4,cumulativeClearCount:before.cumulativeClearCount+1,
      firstCompleteDateTime:before.firstCompleteDateTime || 1790866800,lastCompleteDateTime:1790866800};
  };
  const receipt = operation=>app.store.db.prepare('SELECT * FROM stage_delivery WHERE operation_id=?').get(operation.id);
  const id=1010000101103,nextId=1010000101104;
  try {
    assert.equal(master.stageExperience[id],0);assert.equal(master.stages[id].type,51);
    assert.equal(master.stageProgression[id].index+1,master.stageProgression[nextId].index);
    for(const beforeState of [0,null,1])for(const unlockFirst of beforeState===1 ? [true] : [true,false]) {
      database=path.join(directory,`${beforeState}-${unlockFirst}.sqlite`);await open();
      const next={...row(nextId),state:1};
      put(rows().filter(saved=>beforeState!==null || saved.adventureStageId!==nextId).map(saved=>
        saved.adventureStageId===id ? {...saved,state:1} : saved.adventureStageId===nextId ? {...saved,state:beforeState} : saved));
      const body=value(id),initial=app.store.read('UserAdventureStage'),pullBody={tables:['UserAdventureStage']};
      assert.equal((await send('user_data/pull',pullBody)).status,200);const pullIdentity=sequence;
      if(beforeState===0 && unlockFirst) {
        for(const change of [{state:0},{state:5},{userId:2}]) {
          put(initial.data.map(saved=>saved.adventureStageId===id ? {...saved,...change} : saved));
          await rejected(complete(body),400);put(initial.data);
        }
        put(initial.data.concat(row(id)));await rejected(complete(body),400);put(initial.data);
        for(const table of ['stage_delivery','stage_completion','stage_reward','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER fail_issue BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'unlock issue'); END`);
          await rejected(complete(body),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_issue');
        }
      }
      const operation=parse(await complete(body)).operation,identity=sequence,capture=receipt(operation),target=JSON.parse(capture.next_unlock);
      assert.equal(target.stageId,nextId);assert.equal(target.beforeState,beforeState);assert.deepEqual(target.lowerStates,[]);
      assert.deepEqual(app.store.read('UserAdventureStage'),initial,'Issuance must not pre-open stages or assign signatures');
      assert.equal(operation.parameters.UserAdventureStage.length,1,'Do not insert a fabricated next-stage wire row');
      assert.equal(app.store.hardCurrency(),5);
      for(const changed of [null,'bad-json',JSON.stringify({...target,graphHash:'wrong'}),
        JSON.stringify({...target,stageId:nextId+1}),JSON.stringify({...target,beforeState:5}),
        JSON.stringify({...target,lowerStates:[[id,4]]})]) {
        app.store.db.prepare('UPDATE stage_delivery SET next_unlock=? WHERE operation_id=?').run(changed,operation.id);
        await rejected(complete(body),503);
        app.store.db.prepare('UPDATE stage_delivery SET next_unlock=? WHERE operation_id=?').run(capture.next_unlock,operation.id);
      }
      if(beforeState!==1) {
        await rejected(push([clear(operation)],[operation]),400);
        for(const bad of [{...next,state:0},{...next,state:5},{...next,userId:2}])
          await rejected(push([clear(operation),bad],[operation]),400);
        const first=unlockFirst ? [next] : [clear(operation)];
        for(const [table,event]of [['profile','UPDATE'],['stage_delivery','UPDATE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER fail_effect BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'unlock observation'); END`);
          await rejected(push(first),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_effect');
        }
        assert.deepEqual(parse(await push(first)).operations,[]);assert.deepEqual(app.store.operations(),[operation]);
        if(unlockFirst) {
          const before=snapshot();assert.deepEqual(app.store.stageColdRecovery(operation),operation);assert.equal(snapshot(),before);
          assert.deepEqual(parse(await complete(body)).operation,operation);
          assert.deepEqual(parse(await request(port,identity,body,String(identity),'adventure/stage/complete')).operation,operation);
          assert.equal((await send('user_data/pull',pullBody)).status,200);
          assert.deepEqual(parse(await send('user_data/confirm',undefined)).operations.find(row=>row.id===operation.id),operation);
          await close();await open();parse(await send('user/login',undefined));
        } else {
          await rejected(complete(body),503);
          await rejected(request(port,identity,body,String(identity),'adventure/stage/complete'),503);
          await rejected(send('user_data/pull',pullBody),503);await rejected(send('user_data/confirm',undefined),503);
          await close();await open();await rejected(send('user/login',undefined),503);
        }
        await rejected(push([],[operation]),400);
        if(unlockFirst) {
          await rejected(push([{...next,state:0}]),400);await rejected(push([],[],[next]),400);
        }
        parse(await push(unlockFirst ? [clear(operation)] : [next]));
        for(const table of ['stage_unlock_floor','stage_state_floor','operation_done','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER fail_ack BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'unlock ACK'); END`);
          await rejected(push([],[operation]),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_ack');
        }
      }else{
        assert.deepEqual(parse(await push([next])).operations,[],'An already-open stage cannot clear the pending native receipt');
        assert.deepEqual(app.store.operations(),[operation]);
        parse(await push([clear(operation)]));
      }
      parse(await push([],[operation]));assert.deepEqual(app.store.operations(),[]);
      const floor=app.store.db.prepare('SELECT * FROM stage_unlock_floor WHERE stage_id=?').get(nextId);
      assert.equal(Boolean(floor),true);
      if(floor) {
        assert.equal(floor.operation_id,operation.id);
        for(const bad of [{...next,state:0},{...next,state:5},{...next,userId:2}])await rejected(push([bad]),400);
        await rejected(push([],[],[next]),400);
        parse(await push([{...next,state:3}]));
      }
      await rejected(complete(body),503);
      await rejected(request(port,pullIdentity,pullBody,String(pullIdentity),'user_data/pull'),503);
      const repeat=parse(await complete({...body,token:'repeat-story'})).operation;
      assert.equal(app.store.hardCurrency(),5,'Original first-clear Iris must not be issued twice');
      assert.equal(JSON.parse(receipt(repeat).next_unlock).beforeState,3);
      parse(await push([clear(repeat)],[repeat]));
      await close();await open();
      assert.equal(Boolean(app.store.db.prepare('SELECT 1 FROM stage_unlock_floor WHERE stage_id=?').get(nextId)),Boolean(floor));
      await close();
    }
    for(const lowerComplete of [false,true]) {
      database=path.join(directory,`hard-${lowerComplete}.sqlite`);await open();
      const hard=1010000101203,hardNext=1010000101204,lowerIds=Object.entries(master.stageProgression)
        .filter(([,stage])=>stage.episodeId===7010000101 && stage.level===1).map(([stageId])=>Number(stageId));
      assert.equal(master.stageExperience[hard],0);assert.equal(master.stageProgression[hardNext].unlockCondition,1);
      // Synthetic hard-mode prerequisite rows are not archived default/init proof.
      const hardRows=rows().concat([{...row(id),adventureStageId:hard,state:1,tasks:[]},
        {...row(nextId),adventureStageId:hardNext,state:0,tasks:[]}]);
      put(hardRows.map(saved=>saved.adventureStageId===hard ? {...saved,state:1} :
        lowerComplete && lowerIds.includes(saved.adventureStageId) ? {...saved,state:4,cumulativeClearCount:1,
          firstCompleteDateTime:1790866700,lastCompleteDateTime:1790866700} : saved));
      const operation=parse(await complete(value(hard))).operation,target=JSON.parse(receipt(operation).next_unlock);
      assert.deepEqual(target.lowerStates.map(([stageId])=>stageId),lowerIds);
      assert.equal(target.lowerStates.every(([,state])=>state===4),lowerComplete);
      if(lowerComplete) {
        await rejected(push([{...row(lowerIds[0]),state:0}]),400);
        await rejected(push([clear(operation)],[operation]),400);
      }
      parse(await push([clear(operation),...(lowerComplete ? [{...row(hardNext),state:1}] : [])],[operation]));
      assert.equal(Boolean(app.store.db.prepare('SELECT 1 FROM stage_unlock_floor WHERE stage_id=?').get(hardNext)),lowerComplete);
      await close();
    }
    database=path.join(directory,'very-hard-normal-gate.sqlite');await open();
    const veryHard=1010000101303,veryHardNext=1010000101304,middleIds=Object.entries(master.stageProgression)
      .filter(([,stage])=>stage.episodeId===7010000101 && stage.level===2).map(([stageId])=>Number(stageId));
    assert.equal(master.stageExperience[veryHard],0);
    put(rows().filter(saved=>![...middleIds,veryHard,veryHardNext].includes(saved.adventureStageId))
      .concat(middleIds.map(stageId=>({...row(id),adventureStageId:stageId,state:4,tasks:[],
      cumulativeClearCount:1,firstCompleteDateTime:1790866700,lastCompleteDateTime:1790866700})),
    [{...row(id),adventureStageId:veryHard,state:1,tasks:[]},{...row(nextId),adventureStageId:veryHardNext,state:0,tasks:[]}]));
    const thirdOperation=parse(await complete(value(veryHard))).operation,thirdTarget=JSON.parse(receipt(thirdOperation).next_unlock);
    assert.equal(thirdTarget.lowerStates.length,8,'Later difficulty needs normal completion as well as the immediately lower difficulty');
    assert.equal(thirdTarget.lowerStates.filter(([stageId])=>middleIds.includes(stageId)).every(([,state])=>state===4),true);
    assert.equal(thirdTarget.lowerStates.every(([,state])=>state===4),false);
    parse(await push([clear(thirdOperation)],[thirdOperation]));
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_unlock_floor').get().n,0);
    await close();
    database=path.join(directory,'terminal.sqlite');await open();
    const terminal=1010000104111;
    assert.equal(master.stageExperience[terminal],0);
    // Other normal stages are incomplete: no episode fanout is expected.
    put(rows().filter(saved=>saved.adventureStageId!==terminal).concat({...row(id),adventureStageId:terminal,state:1,tasks:[]}));
    const finalOperation=parse(await complete(value(terminal))).operation;
    assert.equal(JSON.parse(receipt(finalOperation).next_unlock).stageId,0);
    parse(await push([clear(finalOperation)],[finalOperation]));
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_unlock_floor').get().n,0);
    await close();
    const episode=7010000104,chapterFirst=1010000105101,hardStory=[1010000104202,1010000104211],
      episodeIds=Object.keys(master.stageProgression).map(Number).filter(stageId=>master.stageProgression[stageId].episodeId===episode),
      episodeRow=(stageId,state=0)=>({...seed.data.UserAdventureStage.find(saved=>saved.adventureStageId===id),
        adventureStageId:stageId,state,tasks:[],token:'episode-fixture',cumulativeClearCount:state===4 ? 7 : 0,
        firstCompleteDateTime:state===4 ? 1790866600 : 0,lastCompleteDateTime:state===4 ? 1790866700 : 0});
    // Explicit synthetic defaults and eligibility, NOT evidence of a naturally earned chapter.
    for(const baseline of ['locked','absent','preowned']) for(const scenesFirst of baseline==='preowned' ? [true] : [true,false]) {
      database=path.join(directory,`episode-${baseline}-${scenesFirst}.sqlite`);await open();
      put(rows().filter(saved=>!episodeIds.includes(saved.adventureStageId) && saved.adventureStageId!==chapterFirst).concat(
        episodeIds.filter(stageId=>baseline!=='absent' || master.stageProgression[stageId].level===1).map(stageId=>
          episodeRow(stageId,stageId===terminal ? 1 : master.stageProgression[stageId].level===1 ? 4 :
            baseline==='preowned' && master.stageProgression[stageId].level===2 ? hardStory.includes(stageId) ? 4 : 1 : 0)),
        baseline==='absent' ? [] : [episodeRow(chapterFirst,baseline==='preowned' ? 1 : 0)]));
      const initial=app.store.read('UserAdventureStage');
      // WRITTEN ONLY:extend four recursive-clear contexts; exhausted child counters must not mint a root result.
      if(baseline!=='preowned') for(const field of ['cumulativeClearCount','dailyClearCount']) for(const limit of [999999999,1000000000]) {
        const child=initial.data.find(row=>row.adventureStageId===hardStory[0]) ?? episodeRow(hardStory[0]);
        put(initial.data.filter(row=>row.adventureStageId!==hardStory[0]).concat({...child,[field]:limit}));
        await rejected(complete(value(terminal)),limit===999999999?503:400);put(initial.data);
      }
      const operation=parse(await complete(value(terminal))).operation,
        captured=receipt(operation),story=JSON.parse(captured.story_progression),hardIds=episodeIds.filter(stageId=>master.stageProgression[stageId].level===2);
      assert.deepEqual(app.store.read('UserAdventureStage'),initial,'Chapter issue must not mutate native flags/defaults');
      assert.deepEqual(operation.parameters.gainedItems,[],'Auto-cleared story ticket rewards must not be minted');
      assert.deepEqual(operation.parameters.gainedPCs,[]);
      assert.equal(app.store.hardCurrency(),5,'Only the actual root first-clear Iris is issued');
      assert.equal(operation.parameters.UserAdventureStage.length,1);
      if(baseline==='preowned') {
        assert.deepEqual(story.effects,[],'Already open/cleared next difficulty and chapter have no new effects');
        await rejected(push([{...row(hardStory[0]),state:0}]),400);
        parse(await push([clear(operation)],[operation]));await close();continue;
      }
      assert.deepEqual(story.effects.filter(effect=>effect.kind==='clear').map(effect=>effect.stageId),hardStory);
      assert.deepEqual(new Set(story.effects.map(effect=>effect.stageId)),new Set([...hardIds,chapterFirst]));
      assert.equal(story.effects.find(effect=>effect.stageId===chapterFirst).kind,'open');
      for(const stageId of hardIds) assert.equal(new Map(story.inputs).get(stageId)?.state ?? null,baseline==='absent' ? null : 0);
      for(const field of ['cumulativeClearCount','dailyClearCount']) {
        const child=row(hardStory[0]) ?? episodeRow(hardStory[0]);
        put(initial.data.filter(row=>row.adventureStageId!==hardStory[0]).concat({...child,[field]:999999999}));
        await rejected(send('user_data/confirm'),503);await rejected(complete(value(terminal)),503);put(initial.data);
      }
      for(const corrupted of [null,'bad-json',JSON.stringify({...story,graphHash:'wrong'}),
        JSON.stringify({...story,inputs:story.inputs.slice(1)}),JSON.stringify({...story,effects:story.effects.slice(1)}),
        ...[999999999,1000000000].map(count=>JSON.stringify({...story,inputs:story.inputs.map(([stageId,before])=>
          [stageId,stageId===hardStory[0]?{...(before ?? {state:0,firstCompleteDateTime:0}),cumulativeClearCount:count}:before])}))]) {
        app.store.db.prepare('UPDATE stage_delivery SET story_progression=? WHERE operation_id=?').run(corrupted,operation.id);
        await rejected(complete(value(terminal)),503);
        app.store.db.prepare('UPDATE stage_delivery SET story_progression=? WHERE operation_id=?').run(captured.story_progression,operation.id);
      }
      const saved=story.effects.map(effect=>effect.kind==='clear' ? {...episodeRow(effect.stageId),state:4,
        cumulativeClearCount:1,firstCompleteDateTime:1790866800,lastCompleteDateTime:1790866800} : episodeRow(effect.stageId,1)),
        scenes=saved.filter(saved=>hardStory.includes(saved.adventureStageId)),opens=saved.filter(saved=>!hardStory.includes(saved.adventureStageId));
      await rejected(push([clear(operation),...opens],[operation]),400);
      for(const change of [{state:1},{cumulativeClearCount:0},{firstCompleteDateTime:0},{lastCompleteDateTime:0},
        {firstCompleteDateTime:1790866700},{userId:2}])
        await rejected(push([clear(operation),...opens,{...scenes[0],...change},scenes[1]],[operation]),400);
      await rejected(push([clear(operation),...saved,scenes[0]],[operation]),400);
      await rejected(complete({...value(1010000104102),token:'overlapping-episode'}),503);
      for(const [table,event] of [['profile','UPDATE'],['stage_delivery','UPDATE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_episode BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'chapter observation'); END`);
        await rejected(push(scenesFirst ? scenes : opens),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_episode');
      }
      assert.deepEqual(parse(await push(scenesFirst ? scenes : opens)).operations,[]);
      assert.deepEqual(app.store.operations(),[operation]);
      const beforeRecovery=snapshot();assert.deepEqual(app.store.stageColdRecovery(operation),operation);
      assert.equal(snapshot(),beforeRecovery);assert.deepEqual(parse(await complete(value(terminal))).operation,operation);
      assert.equal((await send('user_data/pull',{tables:['UserAdventureStage']})).status,200);
      assert.deepEqual(parse(await send('user_data/confirm',undefined)).operations.find(row=>row.id===operation.id),operation);
      await close();await open();parse(await send('user/login',undefined));
      if(scenesFirst) {
        await rejected(push([{...scenes[0],cumulativeClearCount:0}]),400);
        await rejected(push([],[],[scenes[0]]),400);
      }
      await rejected(push([clear(operation)],[operation]),400);
      parse(await push([clear(operation),...(scenesFirst ? opens : scenes)]));
      for(const table of ['stage_unlock_floor','stage_state_floor','operation_done','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_episode_ack BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'chapter ACK'); END`);
        await rejected(push([],[operation]),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_episode_ack');
      }
      parse(await push([],[operation]));assert.deepEqual(app.store.operations(),[]);
      for(const effect of story.effects) {
        assert.equal(app.store.db.prepare('SELECT operation_id FROM stage_unlock_floor WHERE stage_id=?').get(effect.stageId).operation_id,operation.id);
        if(effect.kind==='clear') {
          assert.equal(app.store.db.prepare('SELECT clear_count FROM stage_state_floor WHERE stage_id=?').get(effect.stageId).clear_count,1);
          await rejected(push([{...row(effect.stageId),state:1}]),400);
          await rejected(push([{...row(effect.stageId),cumulativeClearCount:0}]),400);
          await rejected(push([],[],[row(effect.stageId)]),400);
        }
      }
      await close();await open();
      assert.equal(row(hardStory[0]).state,4);assert.equal(row(chapterFirst).state,1);
      const repeat=parse(await complete({...value(terminal),token:'chapter-repeat'})).operation;
      assert.deepEqual(JSON.parse(receipt(repeat).story_progression).effects,[]);
      assert.equal(app.store.hardCurrency(),5);parse(await push([clear(repeat)],[repeat]));await close();
    }
    // Hard completion opens VH and auto-clears VH scenes, never the next chapter.
    database=path.join(directory,'episode-very-hard.sqlite');await open();
    const hardTerminal=1010000104211;
    put(rows().filter(saved=>!episodeIds.includes(saved.adventureStageId) && saved.adventureStageId!==chapterFirst).concat(
      episodeIds.map(stageId=>episodeRow(stageId,stageId===hardTerminal ? 1 : master.stageProgression[stageId].level<=2 ? 4 : 0)),
      episodeRow(chapterFirst)));
    const hardOperation=parse(await complete(value(hardTerminal))).operation,thirdStory=JSON.parse(receipt(hardOperation).story_progression);
    assert.deepEqual(new Set(thirdStory.effects.map(effect=>effect.stageId)),
      new Set(episodeIds.filter(stageId=>master.stageProgression[stageId].level===3)));
    assert.deepEqual(thirdStory.effects.filter(effect=>effect.kind==='clear').map(effect=>effect.stageId),[1010000104302,1010000104311]);
    assert.equal(thirdStory.effects.some(effect=>effect.stageId===chapterFirst),false);
    await close();
    // Direct hard-story successor auto-clears against the CURRENT normal counterpart.
    database=path.join(directory,'direct-auto-story.sqlite');await open();
    const autoRoot=1010000143209,autoNext=1010000143210,autoEpisode=7010000143,
      autoIds=Object.keys(master.stageProgression).map(Number).filter(stageId=>master.stageProgression[stageId].episodeId===autoEpisode);
    assert.equal(master.stageExperience[autoRoot],0);
    put(rows().filter(saved=>!autoIds.includes(saved.adventureStageId)).concat(autoIds.map(stageId=>
      episodeRow(stageId,stageId===autoRoot ? 1 : master.stageProgression[stageId].level===1 ? 4 : 0))));
    const autoOperation=parse(await complete(value(autoRoot))).operation,autoStory=JSON.parse(receipt(autoOperation).story_progression);
    assert.ok(autoStory.effects.some(effect=>effect.stageId===autoNext && effect.kind==='clear'));
    await rejected(push([clear(autoOperation),episodeRow(autoNext,1)],[autoOperation]),400);
    // Positive successor state alone cannot ACK the auto-clear.
    await close();
    const eventEpisode=7160000101,eventTerminal=1160000101136,eventScene=1160000101201,eventBattle=1160000101202,
      eventIds=Object.keys(master.stageProgression).map(Number).filter(stageId=>master.stageProgression[stageId].episodeId===eventEpisode);
    for(const absent of [false,true]) for(const sceneFirst of [false,true]) {
      database=path.join(directory,`event-fanout-${absent}-${sceneFirst}.sqlite`);await open();
      put(rows().filter(saved=>!eventIds.includes(saved.adventureStageId)).concat(eventIds.filter(stageId=>
        !absent || master.stageProgression[stageId].level===1).map(stageId=>episodeRow(stageId,
        stageId===eventTerminal ? 1 : master.stageProgression[stageId].level===1 ? 4 : 0))));
      const initial=app.store.read('UserAdventureStage'),operation=parse(await complete(value(eventTerminal))).operation,
        captured=receipt(operation),story=JSON.parse(captured.story_progression);
      assert.equal(captured.next_unlock,null,'The old direct-main-only capture is not fabricated for an event');
      assert.deepEqual(app.store.read('UserAdventureStage'),initial);
      assert.deepEqual(story.effects,[{stageId:eventScene,kind:'clear'},{stageId:eventBattle,kind:'open'}],
        'Mode16 must stop behind its newly open battle, not use main-story all-node fanout');
      assert.deepEqual(operation.parameters.gainedItems,[]);
      assert.equal(app.store.hardCurrency(),5);
      for(const corrupted of [null,JSON.stringify({...story,inputs:story.inputs.filter(([stageId])=>stageId!==1160000101102)}),
        JSON.stringify({...story,graphHash:'main-story-hash'}),JSON.stringify({...story,effects:story.effects.concat({stageId:1160000101203,kind:'open'})})]) {
        app.store.db.prepare('UPDATE stage_delivery SET story_progression=? WHERE operation_id=?').run(corrupted,operation.id);
        await rejected(complete(value(eventTerminal)),503);
        app.store.db.prepare('UPDATE stage_delivery SET story_progression=? WHERE operation_id=?').run(captured.story_progression,operation.id);
      }
      const scene={...episodeRow(eventScene),state:4,cumulativeClearCount:1,
        firstCompleteDateTime:1790866800,lastCompleteDateTime:1790866800},battle=episodeRow(eventBattle,1);
      await rejected(push([clear(operation),battle],[operation]),400);
      await rejected(push([clear(operation),{...scene,cumulativeClearCount:0},battle],[operation]),400);
      await rejected(push([{...row(1160000101102),state:1}]),400);
      assert.deepEqual(parse(await push([sceneFirst ? scene : battle])).operations,[]);
      await rejected(send('user_data/confirm',undefined),503);
      await close();await open();
      const beforeRecovery=snapshot();assert.deepEqual(app.store.stageColdRecovery(operation),operation);
      assert.equal(snapshot(),beforeRecovery);assert.deepEqual(parse(await complete(value(eventTerminal))).operation,operation);
      assert.equal((await send('user_data/pull',{tables:['UserAdventureStage']})).status,200);
      assert.deepEqual(parse(await send('user_data/confirm',undefined)).operations.find(row=>row.id===operation.id),operation);
      parse(await send('user/login',undefined));
      await rejected(push([],[operation]),400);
      parse(await push([clear(operation),sceneFirst ? battle : scene]));
      for(const table of ['stage_unlock_floor','stage_state_floor','operation_done']) {
        app.store.db.exec(`CREATE TRIGGER fail_event_ack BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'event ACK'); END`);
        await rejected(push([],[operation]),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_event_ack');
      }
      parse(await push([],[operation]));
      assert.equal(app.store.db.prepare('SELECT operation_id FROM stage_unlock_floor WHERE stage_id=?').get(eventBattle).operation_id,operation.id);
      assert.equal(app.store.db.prepare('SELECT clear_count FROM stage_state_floor WHERE stage_id=?').get(eventScene).clear_count,1);
      await rejected(push([{...row(eventScene),state:1}]),400);await rejected(push([],[],[row(eventBattle)]),400);
      const repeat=parse(await complete({...value(eventTerminal),token:'event-repeat'})).operation;
      assert.deepEqual(JSON.parse(receipt(repeat).story_progression).effects,[]);
      assert.equal(app.store.hardCurrency(),5);parse(await push([clear(repeat)],[repeat]));await close();
    }
    for(const normalReady of [false,true]) {
      database=path.join(directory,`event-exact-prerequisite-${normalReady}.sqlite`);await open();
      const eventRoot=1160000101208,eventNext=1160000101209,normalReference=master.stageUnlocks[eventNext].targetId;
      assert.equal(normalReference,1160000101109);
      put(rows().filter(saved=>!eventIds.includes(saved.adventureStageId)).concat(eventIds.map(stageId=>episodeRow(stageId,
        stageId===eventRoot ? 1 : stageId===normalReference && normalReady ? 4 : 0))));
      const operation=parse(await complete(value(eventRoot))).operation,story=JSON.parse(receipt(operation).story_progression);
      assert.deepEqual(story.effects,normalReady ? [{stageId:eventNext,kind:'open'}] : [],
        'Only the exact slot38 prerequisite is needed, not every normal stage');
      if(normalReady) await rejected(push([clear(operation)],[operation]),400);
      parse(await push([clear(operation),...(normalReady ? [episodeRow(eventNext,1)] : [])],[operation]));
      await close();
    }
    for(const normalReady of [false,true]) {
      database=path.join(directory,`mode17-exact-prerequisite-${normalReady}.sqlite`);await open();
      const specialRoot=1170000101210,specialNext=1170000101211,reference=1170000101110,
        specialIds=Object.keys(master.stageProgression).map(Number).filter(stageId=>master.stages[stageId].adventureType===17);
      assert.equal(master.stageUnlocks[specialNext].targetId,reference);
      assert.notEqual(reference,1170000101111,'The prerequisite is not the next index normal counterpart');
      put(rows().filter(saved=>!specialIds.includes(saved.adventureStageId)).concat(specialIds.map(stageId=>episodeRow(stageId,
        stageId===specialRoot ? 1 : stageId===reference && normalReady ? 4 : 0))));
      const operation=parse(await complete(value(specialRoot))).operation,story=JSON.parse(receipt(operation).story_progression);
      assert.deepEqual(story.effects,normalReady ? [{stageId:specialNext,kind:'open'}] : []);
      if(normalReady) await rejected(push([clear(operation)],[operation]),400);
      parse(await push([clear(operation),...(normalReady ? [episodeRow(specialNext,1)] : [])],[operation]));
      await close();
    }
    console.log('Synthetic main/event/special progression, exact prerequisites, split saves, ACK floors and rollback: OK; native acceptance remains partial');
  }finally{
    await close();fs.rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
