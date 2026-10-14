'use strict';

// DEFERRED / NOT RUN. Isolated synthetic prerequisites are NOT native combat,
// signatures, achievement dispatch, hot/cold ordering, UI or full Abyss proof.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const {initialRecord,initialUsage,serialPvpEndInput,serialPvpNextUsage,serialPvpPartyReady,serialPvpScoreRecord}=require('./serial_pvp.cjs');
const master=require('../data/danmemore-master.json'),seed=require('./test_serial_pvp_lobby.cjs').unlockedSeed();
const id=81000000001,season=master.serialPvp.serialPvpInformation[id],gradeId=81200010000;
const start='serial_pvp/battle/start',end='serial_pvp/battle/end',resultGet='serial_pvp/result/get';
const rankingGet='serial_pvp/ranking/get',usageGet='serial_pvp/character/ranking/get',detailsGet='serial_pvp/player_info/get';
const md5=value=>crypto.createHash('md5').update(value).digest('hex');
const unit=pcId=>({pcId,level:pcId?1:0,currentJobIndex:pcId?1:0,limitbreakCount:0,usableSkillAmount:0,
  strength:0,intelligence:0,agility:0,vitality:0,luck:0,hp:pcId?100:0,mp:pcId?16:0,
  physicalAttackPower:0,magicAttackPower:0,defensePower:0,weaponId:0,armorId:0,weaponAbilityIds:[],armorAbilityIds:[],
  heroSublimateLevel:0,isUnlockedHeroSublimate:false,attackPattern:0,currentDP:0,unlockedAdditionalAbilityAmount:0,hasAllStatusBoardOpened:false});
const savedParty=seed.data.UserParty.find(row=>row.id===seed.data.UserInfo[0].activeSerialPvpPartyId),
  party={userId:seed.userId,partyType:9,index:0,attackPattern:savedParty.attackPattern,partyStrength:0,
    slots:savedParty.slots.map(row=>({slotNumber:row.slotNumber,pc:unit(row.pcId),assistingPc:unit(row.assistingPcId),
      commandFlow:row.commandFlow,isHidden:false})),memoriaSlots:[]};
const verdict=(battleId,isRetire=false,score=0)=>({serialPvpId:id,battleId,result:{isWin:false,isRetire,
  attack_result:{battleMainScore:score,battleSubScore:0,characterBonus:0,technicalPlayBonus:0,
    technicalPartyBonus:0,gradeBonusRate:1,roundScore:score}}});
const fixtureSeed=()=>{
  const value=structuredClone(seed),favorite=master.communicationCharacters[value.data.UserProfile[0].favoriteCommunicationCharacterId],
    home=value.data.UserCommunicationCharacter.find(row=>row.characterId===value.data.UserProfile[0].favoriteCommunicationCharacterId),
    costume=Object.entries(master.characterCostumes).find(([,row])=>row.characterKey===master.characters[favorite.characterId].key);
  home.costumeId=Number(costume[0]); // Authored portrait prerequisite in the temporary fixture ONLY, not a live save repair.
  return value;
};

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-abyss-finish-'));
  let database,app,port,sequence=0,now=season.slot3+100,caseSeed=fixtureSeed();
  const open=async()=>{app=createServer({database,seed:caseSeed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const delta=(putItems={},operations=[])=>({badges:null,scripts:{},dataTokens:{},operations,
    checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(JSON.stringify(rows))]))},
    deltas:Object.keys(putItems).length?[{signature:0,trigger:'UpdateSerialPvpState',putItems,deleteItems:{}}]:[]});
  const push=(items,operations)=>send('user_data/push',delta(items,operations));
  const user=()=>structuredClone(app.store.read('UserInfo').data[0]);
  const ack=operation=>[{id:operation.id,verifier:'fixture-verifier'}];
  const rejected=async(action,value,status=503)=>{const before=snapshot(),reply=await send(action,value);
    assert.equal(reply.status,status,reply.body.toString());if(status===503)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Cancelled finish must retain profiles, queue, capture and request identity');};
  const prepare=async(grade=gradeId,omitUnchangedInfo=false,skew=0,combatParty=party)=>{
    const before=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
      lobby=parse(await send('serial_pvp/grade/select',{serialPvpId:id,gradeId:grade})),selectedSequence=sequence,
      saved=app.store.serialPvp.state(id),info=user(),entry=app.store.serialPvp.runEntry(id);
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),before,'Selection must not predebit native attempts');
    Object.assign(info.playerStatus,entry.candidates[0].after);
    const status={...saved.after.UserSerialPvpGameStatus,lastRivalListUpdateAt:now+skew};
    parse(await push({UserSerialPvpGameStatus:[status],
      UserSerialPvpUsingLimitData:[saved.after.UserSerialPvpUsingLimitData],UserInfo:[info]}));
    // Exact observed identity also cannot redeliver its attempt-spending callback.
    const observed=snapshot();
    assert.equal((await request(port,selectedSequence,{serialPvpId:id,gradeId:grade},String(selectedSequence),'serial_pvp/grade/select')).status,503);
    assert.equal(snapshot(),observed);
    now+=10; // Separate start timestamps; identical-timestamp native omission remains a deferred branch.
    const body={serialPvpId:id,userId:lobby.rivalList[2].serialPvpPlayerInfo.userId,userParty:combatParty,partyIndex:1},
      first=parse(await send(start,body));
    const items={UserInfo:[{...user(),processingSerialPvpState:1}],
      UserSerialPvpRecord:first.serialPvpRecord.length?first.serialPvpRecord:[initialRecord(id)],UserSerialPvpGameStatus:[{...status,
        updateRivalList:true,lastBattleStartAt:now}]};
    if(omitUnchangedInfo) assert.equal(app.store.read('UserSerialPvpInfo').data[0].resumeRivalUserId,body.userId);
    else items.UserSerialPvpInfo=[{userId:seed.userId,resumeRivalUserId:body.userId}];
    parse(await push(items,ack(first.operation)));
    return first;
  };
  try {
    // Original five rates and the recovered float32 multiplication. Native
    //unit/stat/mission component providers are independently still unproved.
    for(const [grade,row] of Object.entries(master.serialPvp.serialPvpGrade)) {
      for(const score of [0,1,123,0x1000001]) {
        const value=verdict('abyss-00000000-0000-0000-0000-000000000000',false,score);
        value.result.isWin=true;value.result.attack_result.gradeBonusRate=Math.fround(row.slot7);
        value.result.attack_result.roundScore=Math.floor(Math.fround(Math.fround(score)*Math.fround(row.slot7))+0.5);
        assert.deepEqual(serialPvpEndInput(value,master,Number(grade)),value);
        const changed=structuredClone(value);changed.result.attack_result.roundScore++;
        assert.throws(()=>serialPvpEndInput(changed,master,Number(grade)),/native int32\/float32/);
      }
    }
    // Disclosed local record policy, independent expected field values.
    const record=initialRecord(id),sample=verdict('abyss-00000000-0000-0000-0000-000000000000',false,12),
      battle={serial_pvp_id:id,grade_id:gradeId},cycle={scores:[10,12],wins:1,closed:true},
      settled=serialPvpScoreRecord(record,battle,cycle,sample,season.slot3,master);
    assert.equal(settled.score,22);assert.equal(settled.cumulativeScore,12);assert.equal(settled.gradeIdAtHighScore,gradeId);
    assert.equal(settled.winCountAtHighScore,1);assert.equal(settled.highestGradeId,0);assert.deepEqual(record,initialRecord(id));
    assert.deepEqual(serialPvpScoreRecord(record,battle,cycle,sample,season.slot4,master),record);
    assert.deepEqual(serialPvpScoreRecord(record,battle,cycle,sample,season.slot3-1,master),record);
    const interim=serialPvpScoreRecord(settled,battle,{scores:[12],wins:1,closed:false},sample,season.slot3,master);
    assert.equal(interim.score,22);assert.equal(interim.cumulativeScore,24);
    const unlocked=serialPvpScoreRecord(settled,battle,{scores:[1,1,1,1,1],wins:5,closed:true},sample,season.slot3,master);
    assert.equal(unlocked.highestGradeId,81200010001);assert.equal(unlocked.score,22);
    const max=serialPvpScoreRecord({...settled,highestGradeId:81200010004},battle,{scores:[1,1,1,1,1],wins:5,closed:true},sample,season.slot3,master);
    assert.equal(max.highestGradeId,81200010004,'Lower-class clearance cannot relock a higher class');
    for(const [index,isRetire,score,combined] of [[0,false,0,false],[1,false,1234,true],[2,true,0,false]]) {
      database=path.join(directory,`finish-${index}.sqlite`);now=season.slot3+100;await open();
      const untouched=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
      assert.deepEqual(parse(await send(rankingGet,{serialPvpId:id})),{code:0,result:0,serialPvpTotalRanking:[],serialPvpUserRanking:[]});
      assert.deepEqual(parse(await send(usageGet,{serialPvpId:id})),{code:0,result:0,normal:[],assist:[]});
      assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),untouched);
      await rejected(rankingGet,{serialPvpId:id,userId:seed.userId},400);await rejected(usageGet,{serialPvpId:String(id)},400);
      const caseGrade=index===2?81200010004:gradeId;
      await rejected(resultGet,{serialPvpId:id});const first=await prepare(caseGrade),body=verdict(first.battleId,isRetire,score);
      await rejected(end,{...body,result:{isWin:false,isRetire}},400);
      const wrong=structuredClone(body);wrong.result.attack_result.roundScore++;await rejected(end,wrong);
      await rejected(end,{...body,serialPvpId:id+1});
      for(const table of ['operation_queue','serial_pvp_end','serial_pvp_end_request','reply_cache']) {
        const before=snapshot();app.store.db.exec(`CREATE TEMP TRIGGER abyss_finish_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
        assert.ok((await send(end,body)).status>=500);assert.equal(snapshot(),before);app.store.db.exec('DROP TRIGGER abyss_finish_fail');
      }
      const profiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
        firstReply=await send(end,body),firstSequence=sequence,ended=parse(firstReply),operation=ended.operation,
        {operation:unused,operations:unusedList,...base}=ended;
      assert.equal(operation.type,30100);assert.deepEqual(operation.parameters,base);assert.deepEqual(ended.operations,[operation]);
      assert.deepEqual(ended.cycleScores,[score]);assert.equal(ended.existResult,true);assert.equal(ended.currentWinCount,0);
      assert.equal(ended.serialPvpResult.gradeId,caseGrade);assert.equal(ended.serialPvpResult.score,score);
      assert.deepEqual(ended.serialPvpRecord,[{...initialRecord(id),score,cumulativeScore:score,gradeIdAtHighScore:score?caseGrade:0}]);
      assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profiles,'No processing/history/reward/signature precredit');
      assert.deepEqual(parse(await send(end,body)),ended);await rejected(resultGet,{serialPvpId:id});
      await rejected(rankingGet,{serialPvpId:id});await rejected(usageGet,{serialPvpId:id});
      await rejected('serial_pvp/battle/restart',{serialPvpId:id,userId:first.serialPvpPlayerInfo.userId});
      await rejected('user_data/pull',{tables:['UserInfo']});await rejected('user_data/push',delta({},ack(operation)));
      const changed=structuredClone(body);changed.result.isRetire=!isRetire;await rejected(end,changed,400);
      await close();await open();app.store.db.exec('DELETE FROM reply_cache');now=season.slot6;
      assert.deepEqual((await request(port,firstSequence,body,String(firstSequence),end)).body,firstReply.body);
      const items={UserInfo:[{...user(),processingSerialPvpState:0}],...(score?{UserSerialPvpRecord:ended.serialPvpRecord}:{})};
      for(const [table,event] of [['profile','UPDATE'],['serial_pvp_record_handoff','UPDATE'],['serial_pvp_end','UPDATE'],['serial_pvp_battle','UPDATE'],
        ['serial_pvp_active','DELETE'],['serial_pvp_result','INSERT'],['serial_pvp_progress','INSERT'],
        ['serial_pvp_usage','INSERT'],['serial_pvp_usage_checkpoint','UPDATE'],
        ...(score?[['serial_pvp_high_score','INSERT']]:[]),['operation_done','INSERT'],['reply_cache','INSERT']]) {
        const before=snapshot();app.store.db.exec(`CREATE TEMP TRIGGER abyss_finish_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
        assert.ok((await push(items,ack(operation))).status>=500);assert.equal(snapshot(),before);app.store.db.exec('DROP TRIGGER abyss_finish_fail');
      }
      if(!combined) {
        const saved=parse(await push(items));assert.equal(saved.operations.some(row=>row.id===operation.id),false);
        assert.equal(app.store.operations().length,1);assert.equal(app.store.serialPvp.activeBattle().closed,0);
        await rejected(end,body);await rejected('user_data/confirm',undefined);await rejected(resultGet,{serialPvpId:id});
        await close();await open();parse(await push({},ack(operation)));
      } else parse(await push(items,ack(operation)));
      assert.equal(app.store.serialPvp.activeBattle(),null);assert.equal(app.store.operations().length,0);
      assert.equal(user().processingSerialPvpState,0);
      assert.equal(app.store.read('UserSerialPvpInfo').data[0].resumeRivalUserId,first.serialPvpPlayerInfo.userId,'30100 does NOT clear the stored resume UID');
      await rejected(end,body);await rejected(resultGet,{serialPvpId:id});now=season.slot3+200;
      const result=parse(await send(resultGet,{serialPvpId:id})),resultSequence=sequence;
      assert.deepEqual(result.roundScore,[score]);assert.equal(result.currentGradeId,caseGrade);
      assert.equal(result.highScorePcId,party.slots[0].pc.pcId);assert.equal(result.isHighScore,score>0);assert.equal(result.currentRank,0);
      assert.deepEqual(result.aroundRankingData,[]);assert.equal(result.operation,undefined);
      const ranking=parse(await send(rankingGet,{serialPvpId:id})),rankingSequence=sequence,
        self=parse(await send(detailsGet,{serialPvpId:id,userId:seed.userId})),usage=parse(await send(usageGet,{serialPvpId:id}));
      assert.deepEqual(ranking.serialPvpTotalRanking,ranking.serialPvpUserRanking);assert.equal(ranking.serialPvpTotalRanking.length,1);
      assert.deepEqual(ranking.serialPvpTotalRanking[0],{userId:seed.userId,name:user().name,pcId:party.slots[0].pc.pcId,
        gradeId:caseGrade,rank:1,score,party});
      assert.deepEqual(self.serialPvpParty,party);assert.deepEqual(self.serialPvpRecord,ended.serialPvpRecord);
      assert.deepEqual(usage.normal,[{rank:1,pcId:party.slots[0].pc.pcId}]);assert.deepEqual(usage.assist,[]);
      assert.equal(usage.operation,undefined);assert.equal(app.store.read('UserSerialPvpRecord').data[0].rank,0,'Local board does not grant publisher rank');
      const totals=JSON.stringify(app.store.db.prepare('SELECT * FROM serial_pvp_usage ORDER BY serial_pvp_id,kind,pc_id').all());
      parse(await push({},ack(operation)));
      assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM serial_pvp_usage ORDER BY serial_pvp_id,kind,pc_id').all()),totals,'Repeated ACK cannot count participation twice');
      // One-time upgrade from the real old completion captures; bootstrap
      //and view/reply persistence roll back together, without profile grants.
      app.store.db.prepare('DELETE FROM serial_pvp_usage WHERE serial_pvp_id=?').run(id);
      app.store.db.prepare('DELETE FROM serial_pvp_usage_checkpoint WHERE serial_pvp_id=?').run(id);
      for(const table of ['serial_pvp_usage','serial_pvp_usage_checkpoint','serial_pvp_view_request','reply_cache']) {
        const before=snapshot();app.store.db.exec(`CREATE TEMP TRIGGER abyss_usage_bootstrap_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
        assert.ok((await send(usageGet,{serialPvpId:id})).status>=500);assert.equal(snapshot(),before);
        app.store.db.exec('DROP TRIGGER abyss_usage_bootstrap_fail');
      }
      assert.deepEqual(parse(await send(usageGet,{serialPvpId:id})),usage);
      assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM serial_pvp_usage ORDER BY serial_pvp_id,kind,pc_id').all()),totals);
      const checkpoint=app.store.db.prepare('SELECT * FROM serial_pvp_usage_checkpoint WHERE serial_pvp_id=?').get(id);
      app.store.db.prepare('UPDATE serial_pvp_usage SET count=count+1 WHERE serial_pvp_id=?').run(id);await rejected(usageGet,{serialPvpId:id});
      app.store.db.prepare('UPDATE serial_pvp_usage SET count=count-1 WHERE serial_pvp_id=?').run(id);
      assert.equal(app.store.db.prepare('SELECT round_count FROM serial_pvp_usage_checkpoint WHERE serial_pvp_id=?').get(id).round_count,1);
      assert.ok(checkpoint.counts_hash);
      await close();await open();app.store.db.exec('DELETE FROM reply_cache');
      assert.deepEqual((await request(port,rankingSequence,{serialPvpId:id},String(rankingSequence),rankingGet)).body,Buffer.from(JSON.stringify(ranking)));
      assert.deepEqual(parse(await send(detailsGet,{serialPvpId:id,userId:seed.userId})),self);
      assert.deepEqual(parse(await send(resultGet,{serialPvpId:id})),result);
      assert.deepEqual((await request(port,resultSequence,{serialPvpId:id},String(resultSequence),resultGet)).body,Buffer.from(JSON.stringify(result)));
      assert.equal((await send('user_data/pull',{tables:['UserInfo','UserSerialPvpInfo','UserSerialPvpRecord']})).status,200);
      const summary=parse(await send('serial_pvp/summary/get',{serialPvpId:id}));
      assert.equal(summary.existResult,true);assert.equal(summary.selectedGradeId,0);assert.deepEqual(summary.rivalList,[]);
      assert.deepEqual(summary.serialPvpRanking,ranking.serialPvpTotalRanking,
        'Summary uses the same native ranking parser and real best party, including zero-score participation');
      const matchingNow=now;now=season.slot4;
      const nativeProfiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
      for(const table of ['serial_pvp_lobby_request','reply_cache']) {
        const before=snapshot();app.store.db.exec(`CREATE TEMP TRIGGER abyss_summary_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
        assert.ok((await send('serial_pvp/summary/get',{serialPvpId:id})).status>=500);assert.equal(snapshot(),before);
        app.store.db.exec('DROP TRIGGER abyss_summary_fail');
      }
      assert.deepEqual(parse(await send('serial_pvp/summary/get',{serialPvpId:id})),summary);
      const summarySequence=sequence;
      assert.deepEqual(parse(await send('serial_pvp/summary/get',{serialPvpId:id,userId:seed.userId})),summary);
      assert.deepEqual(parse(await send(rankingGet,{serialPvpId:id})).serialPvpTotalRanking,summary.serialPvpRanking);
      assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),nativeProfiles,
        'Post-event reads cannot set aggregate/reward/rank flags, mint Presents or change inventory');
      await rejected('serial_pvp/grade/select',{serialPvpId:id,gradeId});
      await close();await open();app.store.db.exec('DELETE FROM reply_cache');
      assert.deepEqual((await request(port,summarySequence,{serialPvpId:id},String(summarySequence),'serial_pvp/summary/get')).body,
        Buffer.from(JSON.stringify(summary)),'Cold summary replay keeps the actual saved board');
      now=season.slot6-1;assert.deepEqual(parse(await send('serial_pvp/summary/get',{serialPvpId:id})),summary);
      now=season.slot6;await rejected('serial_pvp/summary/get',{serialPvpId:id});
      const expired=snapshot();
      assert.equal((await request(port,summarySequence,{serialPvpId:id},String(summarySequence),'serial_pvp/summary/get')).status,503);
      assert.equal(snapshot(),expired);now=matchingNow;
      await rejected(start,{serialPvpId:id,userId:first.serialPvpPlayerInfo.userId,userParty:party,partyIndex:1});
      await rejected('user_data/push',delta({UserSerialPvpRecord:[{...initialRecord(id),score:1}]}));
      await rejected('user_data/push',delta({UserInfo:[{...user(),processingSerialPvpState:1}]}));
      const status=app.store.read('UserSerialPvpGameStatus').data[0];
      await rejected('user_data/push',delta({UserSerialPvpGameStatus:[{...status,updateRivalList:false}]}));
      // Repeated fresh-run losses, all five original grades and the retained
      //native UID. Descending grades offset the new CPU generation, producing
      //the SAME opponent and a legitimate omitted no-op UID dirty row.
      const nextGrades=index===2?[81200010003,81200010002,81200010001,gradeId]:
        index===1?[81200010001,81200010002,81200010003,81200010004]:[81200010001];
      let latest=first,latestScore=score;
      for(const [step,grade] of nextGrades.entries()) {
        now+=20;
        if(!step) for(const [table,event] of [['serial_pvp_run_archive','INSERT'],['serial_pvp_lobby','UPDATE'],
          ['serial_pvp_run_entry','UPDATE'],['serial_pvp_lobby_request','INSERT'],['reply_cache','INSERT']]) {
          const before=snapshot();app.store.db.exec(`CREATE TEMP TRIGGER abyss_new_run_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
          assert.ok((await send('serial_pvp/grade/select',{serialPvpId:id,gradeId:grade})).status>=500);
          assert.equal(snapshot(),before);app.store.db.exec('DROP TRIGGER abyss_new_run_fail');
        }
        const attempts=user().playerStatus.serialPvpSP,previousUid=app.store.read('UserSerialPvpInfo').data[0].resumeRivalUserId;
        latest=await prepare(grade,index===2,3);
        assert.equal(user().playerStatus.serialPvpSP,attempts-1,'Exactly one attempt per new run, none per start');
        assert.equal(app.store.serialPvp.endReceipt(first.battleId).done,true,'Archived old run survives newer grade/entry');
        if(index===2) assert.equal(latest.serialPvpPlayerInfo.userId,previousUid);
        await rejected(end,body);await rejected(resultGet,{serialPvpId:id});
        latestScore=100+step;
        const finished=parse(await send(end,verdict(latest.battleId,step%2===0,latestScore))),
          items={UserInfo:[{...user(),processingSerialPvpState:0}],UserSerialPvpRecord:finished.serialPvpRecord};
        const before=snapshot();
        const grew=finished.serialPvpRecord[0].score>app.store.read('UserSerialPvpRecord').data[0].score;
        for(const [table,event] of [['serial_pvp_result','UPDATE'],...(grew?[['serial_pvp_high_score',
          app.store.db.prepare('SELECT 1 FROM serial_pvp_high_score WHERE user_id=? AND serial_pvp_id=?').get(seed.userId,id)?'UPDATE':'INSERT']]:[])]) {
          app.store.db.exec(`CREATE TEMP TRIGGER abyss_result_replace_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
          assert.ok((await push(items,ack(finished.operation))).status>=500);assert.equal(snapshot(),before);
          app.store.db.exec('DROP TRIGGER abyss_result_replace_fail');
        }
        parse(await push(items,ack(finished.operation)));
        assert.equal(app.store.serialPvp.finishedResult(id).battle_id,latest.battleId);
        assert.equal(app.store.serialPvp.endReceipt(first.battleId).done,true);
        const displayed=parse(await send(resultGet,{serialPvpId:id}));
        assert.deepEqual(displayed.roundScore,[latestScore]);assert.equal(displayed.currentGradeId,grade);
        assert.equal(app.store.read('UserSerialPvpRecord').data[0].score,Math.max(score,latestScore));
        assert.equal(displayed.isHighScore,latestScore>Math.max(score,step?100+step-1:0));
        const local=parse(await send(rankingGet,{serialPvpId:id}));assert.equal(local.serialPvpTotalRanking[0].score,Math.max(score,latestScore));
        const staleRanking=snapshot();
        assert.equal((await request(port,rankingSequence,{serialPvpId:id},String(rankingSequence),rankingGet)).status,503);
        assert.equal(snapshot(),staleRanking);
        const cached=snapshot();
        assert.equal((await request(port,resultSequence,{serialPvpId:id},String(resultSequence),resultGet)).status,503);
        assert.equal(snapshot(),cached,'Old result identity cannot substitute a newer result');
        await close();await open();app.store.db.exec('DELETE FROM reply_cache');
        assert.deepEqual(parse(await send(resultGet,{serialPvpId:id})),displayed);
      }
      if(nextGrades.length===4) {
        assert.equal(user().playerStatus.serialPvpSP,0);
        await rejected('serial_pvp/grade/select',{serialPvpId:id,gradeId});
      }
      assert.ok(app.store.db.prepare('SELECT COUNT(*) AS n FROM serial_pvp_run_archive WHERE serial_pvp_id=?').get(id).n>=nextGrades.length);
      const archive=app.store.db.prepare('SELECT * FROM serial_pvp_run_archive WHERE serial_pvp_id=? ORDER BY generation LIMIT 1').get(id);
      app.store.db.prepare('UPDATE serial_pvp_run_archive SET entry_json=? WHERE serial_pvp_id=? AND generation=?').run('broken',id,archive.generation);
      assert.throws(()=>app.store.serialPvp.endReceipt(first.battleId),/Archived Abyss run proof/);
      assert.deepEqual(parse(await send(resultGet,{serialPvpId:id})).roundScore,[latestScore],'Current result is indexed, not a lifetime archive scan');
      app.store.db.prepare('UPDATE serial_pvp_run_archive SET entry_json=? WHERE serial_pvp_id=? AND generation=?').run(archive.entry_json,id,archive.generation);
      app.store.db.prepare('UPDATE serial_pvp_end SET catalog_hash=?').run('broken');await rejected(resultGet,{serialPvpId:id});
      await close();
    }
    // Source-only synthetic ownership/level/stat prerequisites. Original IDs,
    //not an actual player save or proof of naturally unlocked parties.
    const pcIds=Object.keys(master.pcProfiles).map(Number).filter(id=>String(id).startsWith('1011')).slice(0,4),
      assistIds=Object.keys(master.pcProfiles).map(Number).filter(id=>String(id).startsWith('1012')).slice(0,4),
      memoriaIds=Object.keys(master.memoriaLevels).map(Number).slice(0,4);
    assert.equal(pcIds.length,4);assert.equal(assistIds.length,4);assert.equal(memoriaIds.length,4);
    caseSeed=fixtureSeed();
    caseSeed.data.UserPC=[...pcIds,...assistIds].map(pcId=>({...structuredClone(seed.data.UserPC[0]),pcId}));
    const teams=pcIds.map((pcId,i)=>({...structuredClone(party),slots:party.slots.map((slot,n)=>({...slot,
      pc:unit(n?0:pcId),assistingPc:unit(n?0:assistIds[i])})),
      memoriaSlots:[{slotNumber:1,isHidden:false,otherMemoria:{memoriaId:memoriaIds[i],level:1}}]}));
    const selectFixtureParty=team=>{
      const rows=structuredClone(app.store.read('UserParty').data),active=rows.find(row=>row.id===savedParty.id);
      for(const row of active.slots) {
        const slot=team.slots.find(slot=>slot.slotNumber===row.slotNumber);
        row.pcId=slot.pc.pcId;row.assistingPcId=slot.assistingPc.pcId;
      }
      for(const row of active.memoriaSlots) row.memoriaId=team.memoriaSlots.find(slot=>slot.slotNumber===row.slotNumber)?.otherMemoria.memoriaId ?? 0;
      const encoded=JSON.stringify(rows);
      app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(encoded,md5(encoded),'UserParty');
    };
    let usage=serialPvpNextUsage(initialUsage(id),teams[0],master);
    assert.throws(()=>serialPvpPartyReady(usage,teams[0]),/cooldown/);
    for(const team of teams.slice(1)) usage=serialPvpNextUsage(usage,team,master);
    assert.equal(usage.usedPcList.find(row=>row.pcId===pcIds[0]).turnCount,0);
    assert.equal(usage.usedMemoriaList.find(row=>row.memoriaId===memoriaIds[0]).turnCount,0);
    serialPvpPartyReady(usage,teams[0]); // Zero stays "Played", it is NOT deleted.
    const memoriaOnly={...structuredClone(teams[3]),memoriaSlots:teams[2].memoriaSlots};
    assert.throws(()=>serialPvpPartyReady(usage,memoriaOnly),/cooldown/);
    for(const rounds of [2,3,4,5,6]) {
      //6 denotes all five wins;2..5 lose after1..4 wins.
      const allWins=rounds===6,limit=allWins?5:rounds;
      database=path.join(directory,`streak-${rounds}.sqlite`);now=season.slot3+100;await open();
      selectFixtureParty(teams[0]);let first=await prepare(81200010004,false,0,teams[0]),scores=[],lastSummary,
        sameSecondBattleId=null,sameSecondStamp=0;
      const stock=user().playerStatus.serialPvpSP;
      for(let round=0;round<limit;round++) {
        const team=teams[round%4],isWin=allWins || round<limit-1,body=verdict(first.battleId,false,100+round);
        body.result.isWin=isWin;body.result.attack_result.gradeBonusRate=isWin?Math.fround(master.serialPvp.serialPvpGrade[81200010004].slot7):1;
        body.result.attack_result.roundScore=Math.floor(Math.fround(Math.fround(100+round)*body.result.attack_result.gradeBonusRate)+0.5);
        scores.push(body.result.attack_result.roundScore);
        const profiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),finished=parse(await send(end,body));
        if(first.battleId===sameSecondBattleId) {
          const captured=app.store.serialPvp.endReceipt(first.battleId);
          assert.ok(captured.parent.observed.includes('statusTime'),'A valid finish proves the same-second direct timestamp setter ran');
          assert.equal(captured.parent.last_battle_start_at,sameSecondStamp,'No-op timestamp retains the exact prior native second');
        }
        assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profiles,'Win issue must not precredit native usage/history');
        assert.deepEqual(finished.cycleScores,scores);assert.equal(finished.currentWinCount,round+Number(isWin));
        assert.equal(finished.existResult,!isWin || round===4);assert.equal(finished.selectedGradeId,finished.existResult?0:81200010004);
        await rejected('user_data/push',delta({},ack(finished.operation)));
        const finishItems={UserInfo:[{...user(),processingSerialPvpState:0}],UserSerialPvpRecord:finished.serialPvpRecord};
        assert.equal(finished.serialPvpRecord[0].cumulativeScore,scores.reduce((a,b)=>a+b,0));
        assert.equal(finished.serialPvpRecord[0].score,finished.existResult?scores.reduce((a,b)=>a+b,0):0);
        assert.equal(finished.serialPvpRecord[0].highestGradeId,allWins && round===4?81200010004:0);
        if(isWin && round<4) {
          const before=snapshot();
          app.store.db.exec("CREATE TEMP TRIGGER abyss_usage_issue_fail BEFORE INSERT ON serial_pvp_usage_handoff BEGIN SELECT RAISE(ABORT,'injected'); END");
          assert.ok((await push(finishItems,ack(finished.operation))).status>=500);
          assert.equal(snapshot(),before);app.store.db.exec('DROP TRIGGER abyss_usage_issue_fail');
        }
        if(round%3===0) {
          const reply=parse(await push({UserSerialPvpRecord:finished.serialPvpRecord}));
          assert.equal(reply.operations.some(row=>row.id===finished.operation.id),false);
          await rejected('user_data/push',delta({},ack(finished.operation)));await rejected(end,body);
          await close();await open();parse(await push({UserInfo:finishItems.UserInfo},ack(finished.operation)));
        } else if(round%3===1) {
          const reply=parse(await push({UserInfo:finishItems.UserInfo}));
          assert.equal(reply.operations.some(row=>row.id===finished.operation.id),false);
          await rejected('user_data/push',delta({},ack(finished.operation)));
          await close();await open();parse(await push({UserSerialPvpRecord:finished.serialPvpRecord},ack(finished.operation)));
        } else parse(await push(finishItems,ack(finished.operation)));
        assert.equal(app.store.serialPvp.latestFinish(id).battle_id,first.battleId);
        assert.equal(user().playerStatus.serialPvpSP,stock,'No SP cost per winning round');
        const counts=app.store.db.prepare('SELECT kind,pc_id,count FROM serial_pvp_usage WHERE serial_pvp_id=?').all(id);
        for(const [kind,ids] of [[0,pcIds],[1,assistIds]]) for(const [i,pcId] of ids.entries()) {
          const expected=Array.from({length:round+1},(_,n)=>n%4).filter(n=>n===i).length,
            actual=counts.find(row=>row.kind===kind && row.pc_id===pcId)?.count ?? 0;
          assert.equal(actual,expected,'All ACKed local rounds count, including zero-score/loss/retirement; neither cooldown nor CPU roster is usage');
        }
        const usage=parse(await send(usageGet,{serialPvpId:id}));
        for(const [kind,key] of [[0,'normal'],[1,'assist']]) assert.deepEqual(usage[key],counts.filter(row=>row.kind===kind)
          .sort((a,b)=>b.count-a.count || a.pc_id-b.pc_id).map((row,i)=>({rank:i+1,pcId:row.pc_id})));
        await close();await open();app.store.db.exec('DELETE FROM reply_cache');
        if(finished.existResult) {
          const displayed=parse(await send(resultGet,{serialPvpId:id}));
          assert.deepEqual(displayed.roundScore,scores);assert.equal(displayed.winCount,allWins?5:round);
          const summary=parse(await send('serial_pvp/summary/get',{serialPvpId:id}));
          assert.equal(summary.selectedGradeId,0);assert.equal(summary.existResult,true);
          await rejected(start,{serialPvpId:id,userId:first.serialPvpPlayerInfo.userId,userParty:team,partyIndex:1});
          break;
        }
        await rejected(resultGet,{serialPvpId:id});await rejected('serial_pvp/grade/select',{serialPvpId:id,gradeId});
        const pending=app.store.serialPvp.latestFinish(id),target=serialPvpNextUsage(pending.before.rows.UserSerialPvpUsingLimitData,team,master),
          nextTeam=teams[(round+1)%4],nextBody={serialPvpId:id,userId:first.serialPvpPlayerInfo.userId,userParty:nextTeam,partyIndex:1};
        await rejected('user_data/push',delta({UserSerialPvpUsingLimitData:[target]})); // Cannot save an unissued summary effect.
        await rejected(start,nextBody);
        const summary=parse(await send('serial_pvp/summary/get',{serialPvpId:id})),summarySequence=sequence;
        assert.deepEqual(summary.serialPvpUsingLimitData,target);assert.equal(summary.currentWinCount,round+1);
        assert.equal(summary.currentScore,scores.reduce((a,b)=>a+b,0));assert.equal(summary.existResult,false);
        assert.deepEqual(app.store.read('UserSerialPvpUsingLimitData').data,[pending.before.rows.UserSerialPvpUsingLimitData]);
        await rejected('user_data/pull',{tables:['UserSerialPvpUsingLimitData']});
        const before=snapshot();
        app.store.db.exec("CREATE TEMP TRIGGER abyss_usage_save_fail BEFORE UPDATE ON serial_pvp_usage_handoff BEGIN SELECT RAISE(ABORT,'injected'); END");
        assert.ok((await push({UserSerialPvpUsingLimitData:[target]})).status>=500);assert.equal(snapshot(),before);
        app.store.db.exec('DROP TRIGGER abyss_usage_save_fail');
        now=season.slot6;parse(await push({UserSerialPvpUsingLimitData:[target]}));now=season.slot3+200+round*20;
        await rejected(start,{...nextBody,userParty:team}); // Positive cooldown blocks even direct API requests.
        if(lastSummary) {
          const frozen=snapshot();
          assert.equal((await request(port,lastSummary.sequence,{serialPvpId:id},String(lastSummary.sequence),'serial_pvp/summary/get')).status,503);
          assert.equal(snapshot(),frozen);
        }
        lastSummary={sequence:summarySequence};
        if(round===1) {
          const status=app.store.read('UserSerialPvpGameStatus').data[0];
          parse(await push({UserSerialPvpGameStatus:[{...status,updatedMatchingCount:status.updatedMatchingCount+1,executeRivalListUpdate:true}]}));
          parse(await send('serial_pvp/rival_list/update',{serialPvpId:id,gradeId:81200010004}));
          parse(await push({UserSerialPvpGameStatus:[app.store.serialPvp.state(id).after.UserSerialPvpGameStatus]}));
          assert.equal(app.store.serialPvp.endReceipt(pending.battle_id).done,true,'Opponent refresh preserves prior winning captures');
          if(allWins) {
            parse(await push({UserSerialPvpGameStatus:[{...app.store.read('UserSerialPvpGameStatus').data[0],updatedMatchingCount:0}]}));
            assert.equal(app.store.db.prepare('SELECT reset_pending FROM serial_pvp_matching_checkpoint WHERE serial_pvp_id=?').get(id).reset_pending,1);
            await rejected('serial_pvp/rival_list/update',{serialPvpId:id,gradeId:81200010004});
          }
        }
        selectFixtureParty(nextTeam);const lobby=app.store.serialPvp.state(id),sameSecond=round===0;
        if(sameSecond) now=app.store.read('UserSerialPvpGameStatus').data[0].lastBattleStartAt;
        else now+=10;
        first=parse(await send(start,{...nextBody,userId:lobby.rivals[round%5].serialPvpPlayerInfo.userId}));
        const items={UserInfo:[{...user(),processingSerialPvpState:1}],
          UserSerialPvpInfo:[{userId:seed.userId,resumeRivalUserId:first.serialPvpPlayerInfo.userId}]};
        if(!sameSecond) {
          items.UserSerialPvpGameStatus=[{...app.store.read('UserSerialPvpGameStatus').data[0],updateRivalList:true,
            lastBattleStartAt:now,updatedMatchingCount:0}];
        }
        parse(await push(items,ack(first.operation)));
        if(sameSecond) {
          const active=app.store.serialPvp.activeBattle();
          assert.equal(active.last_battle_start_at,0,'ACK alone cannot invent the later direct timestamp callback');
          assert.equal(active.before.rows.UserSerialPvpGameStatus.lastBattleStartAt,now);
          assert.ok(!active.observed.includes('statusTime'));
          sameSecondBattleId=first.battleId;sameSecondStamp=now;
          if(rounds%2===0) {
            const resumed=parse(await send('serial_pvp/battle/restart',{serialPvpId:id,userId:first.serialPvpPlayerInfo.userId}));
            assert.equal(resumed.battleId,first.battleId,'Exact restart rebuilds the frozen same-second battle');
            const recovered=app.store.serialPvp.activeBattle();
            assert.ok(recovered.observed.includes('statusTime'));
            assert.equal(recovered.last_battle_start_at,now);
          }
        }
      }
      const best=app.store.db.prepare('SELECT battle_id FROM serial_pvp_high_score WHERE user_id=? AND serial_pvp_id=?').get(seed.userId,id);
      selectFixtureParty(teams[0]);now+=20;const lower=await prepare(gradeId,false,0,teams[0]);
      assert.equal(user().playerStatus.serialPvpSP,stock-1,'Only a closed run may select/debit another attempt');
      assert.deepEqual(app.store.read('UserSerialPvpUsingLimitData').data,[initialUsage(id)],'New native selection resets usage');
      const finished=parse(await send(end,verdict(lower.battleId,false,1)));
      parse(await push({UserInfo:[{...user(),processingSerialPvpState:0}],UserSerialPvpRecord:finished.serialPvpRecord},ack(finished.operation)));
      const displayed=parse(await send(resultGet,{serialPvpId:id}));
      assert.equal(displayed.highScorePcId,teams[(limit-1)%4].slots[0].pc.pcId);assert.equal(displayed.isHighScore,false);
      const ranking=parse(await send(rankingGet,{serialPvpId:id})),self=parse(await send(detailsGet,{serialPvpId:id,userId:seed.userId}));
      assert.deepEqual(ranking.serialPvpTotalRanking[0].party,teams[(limit-1)%4]);assert.deepEqual(self.serialPvpParty,teams[(limit-1)%4]);
      assert.deepEqual(app.store.db.prepare('SELECT battle_id FROM serial_pvp_high_score WHERE user_id=? AND serial_pvp_id=?').get(seed.userId,id),best);
      app.store.db.prepare('DELETE FROM serial_pvp_high_score WHERE user_id=? AND serial_pvp_id=?').run(seed.userId,id);
      await rejected(resultGet,{serialPvpId:id});await rejected(rankingGet,{serialPvpId:id});
      await rejected('serial_pvp/summary/get',{serialPvpId:id});
      await rejected(detailsGet,{serialPvpId:id,userId:seed.userId}); // Missing best-party proof cannot fabricate the latest leader.
      app.store.db.prepare('INSERT INTO serial_pvp_high_score(user_id,serial_pvp_id,battle_id) VALUES(?,?,?)').run(seed.userId,id,best.battle_id);
      await close();await open();app.store.db.exec('DELETE FROM reply_cache');assert.deepEqual(parse(await send(resultGet,{serialPvpId:id})),displayed);
      await close();
    }
    console.log('Abyss defeat/retirement and fresh-run source fixtures complete; native acceptance remains pending');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
module.exports={fixtureSeed,party,verdict}; // Reuse isolated prerequisites, never import main's runner.
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
