'use strict';

//DEFERRED / NOT RUN. Synthetic native vectors/save flags are NOT combat,
//natural bootstrap, original publisher matching or MuMu/signature acceptance.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer,pvpStamina,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {warGameEntry,warGameFinish,warGameGrade}=require('./war_game.cjs');
const {request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const legacyCatalog=hash({...master.pvp,grades:Object.fromEntries(Object.entries(master.pvp.grades)
  .map(([id,{groupId,key,name,art,order}])=>[id,{groupId,key,name,art,order}]))});
const start='pvp/battle/start',restart='pvp/battle/restart',end='pvp/battle/end';
const id=Number(Object.keys(master.pvp.information).find(id=>master.pvp.information[id].startAt<=1660950000 &&
  1660950000<master.pvp.information[id].endAt)),window=master.pvp.information[id];
const missionId=6030033995,mission=master.warGameAchievements[missionId],reward=master.achievements[missionId];

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-war-game-'));
  let app,port,sequence=0,now=1660950000,file=0;
  const open=async()=>{
    app=createServer({database:path.join(directory,`${file}.sqlite`),seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async()=>{if(app){await app.close();app=null;}};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const reject=async(action,value,status=503,unavailable=true)=>{
    const before=snapshot(),reply=await send(action,value);assert.equal(reply.status,status,reply.body.toString());
    assert.equal(snapshot(),before);if(status===503 && unavailable) assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const push=(putItems,ack=[])=>send('user_data/push',{badges:null,scripts:{},dataTokens:{},operations:ack.map(row=>({id:row.id,verifier:'native-fixture'})),
    checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
    deltas:[{signature:0,trigger:'UpdatePvpState',putItems,deleteItems:{}}]});
  const missionRow=(achievementId,completedAt)=>({userId:seed.userId,achievementId,completedAt,lastResetAt:0,
    progressParam:master.warGameAchievements[achievementId].requiredParam,readState:1,signature:0,state:3});
  const claimBody=rows=>({achievementIds:rows.map(({achievementId,completedAt})=>({achievementId,completedAt}))});
  const setup=()=>{
    //Reuse the existing synthetic native-vector fixture, not a new stat builder.
    const own={...structuredClone(seed.data.UserPvBHighScoreParty[0]),attackPattern:2};
    own.slots=own.slots.map(slot=>({...slot,isHidden:false}));put('UserPvPParty',[own]);
    put('UserParty',app.store.read('UserParty').data.map(row=>row.id!==300?row:{...row,
      slots:row.slots.map(slot=>({...slot,pcId:own.slots.find(x=>x.slotNumber===slot.slotNumber).pc.pcId,
        assistingPcId:own.slots.find(x=>x.slotNumber===slot.slotNumber).assistingPc.pcId})),
      memoriaSlots:own.memoriaSlots.map(slot=>({slotNumber:slot.slotNumber,memoriaId:slot.otherMemoria.memoriaId}))}));
    return own;
  };
  try {
    //Original borders for all176 seasons, not manufactured equal-size grades.
    for(const season of master.pvpInformationIds) {
      const grades=Object.entries(master.pvp.grades).filter(([,row])=>row.groupId===season && !row.minRank && !row.maxRank)
        .sort(([,a],[,b])=>a.order-b.order);
      assert.equal(warGameGrade(season,0,master),Number(grades[0][0]));
      for(const [index,[id,row]] of grades.entries()) {
        assert.equal(warGameGrade(season,row.scoreBorder,master),Number(id));
        if(index) assert.equal(warGameGrade(season,row.scoreBorder-1,master),Number(grades[index-1][0]));
      }
      assert.equal(warGameGrade(season,0x7fffffff,master),Number(grades.at(-1)[0]),'No fake rank1/highest ranked tier');
      const ranked=Object.entries(master.pvp.grades).filter(([,row])=>row.groupId===season && row.minRank>0);
      for(const [gradeId,row] of ranked) {
        for(const rank of new Set([row.minRank,row.maxRank])) {
          assert.equal(warGameGrade(season,row.scoreBorder,master,rank),Number(gradeId));
          assert.equal(warGameGrade(season,row.scoreBorder-1,master,rank),
            warGameGrade(season,row.scoreBorder-1,master),'Rank alone cannot skip the original score border');
        }
        for(const rank of new Set([0,row.minRank-1,row.maxRank+1]))
          assert.notEqual(warGameGrade(season,row.scoreBorder,master,rank),Number(gradeId));
      }
    }
    assert.throws(()=>warGameGrade(1,1000,master),/borders/);
    const missingBorder=structuredClone(master);delete missingBorder.pvp.grades[13001380001].scoreBorder;
    assert.throws(()=>warGameGrade(id,1060,missingBorder),/borders/);
    const ambiguous=structuredClone(master);ambiguous.pvp.grades[13001380001].scoreBorder=1000;
    assert.throws(()=>warGameGrade(id,1060,ambiguous),/ambiguous/);
    const overlapping=structuredClone(master);overlapping.pvp.grades[13001380019].minRank=1;
    assert.throws(()=>warGameGrade(id,3600,overlapping,1),/ambiguous/);
    for(const rank of [-1,0.5,0x80000000]) assert.throws(()=>warGameGrade(id,3600,master,rank),/borders/);
    assert.deepEqual(warGameEntry({pvpSP:10,pvpSPUpdatedAt:now-7200},now,pvpStamina).candidates,
      [{before:{pvpSP:10,pvpSPUpdatedAt:now-7200},after:{pvpSP:9,pvpSPUpdatedAt:now}}]);
    assert.deepEqual(warGameEntry({pvpSP:3,pvpSPUpdatedAt:now+7},now,pvpStamina).candidates,
      [{before:{pvpSP:3,pvpSPUpdatedAt:now+7},after:{pvpSP:2,pvpSPUpdatedAt:now+7}}]);
    assert.deepEqual(warGameEntry({pvpSP:0,pvpSPUpdatedAt:now-3602},now,pvpStamina).candidates,
      [{before:{pvpSP:1,pvpSPUpdatedAt:now-1802},after:{pvpSP:0,pvpSPUpdatedAt:now-1802}},
        {before:{pvpSP:2,pvpSPUpdatedAt:now-2},after:{pvpSP:1,pvpSPUpdatedAt:now-2}}],
      'Bounded request arrival can straddle one native1800-second getter boundary');
    assert.deepEqual(warGameEntry({pvpSP:0,pvpSPUpdatedAt:now-1798},now,pvpStamina).candidates,
      [{before:{pvpSP:1,pvpSPUpdatedAt:now+2},after:{pvpSP:0,pvpSPUpdatedAt:now+2}}],
      'The existing +120-second local clock window can supply the native entry attempt');
    assert.throws(()=>warGameEntry({pvpSP:0,pvpSPUpdatedAt:now},now,pvpStamina),/attempt/);
    await open();
    await reject(start,{pvpId:id});const own=setup(),baseline=app.store.read('UserInfo').data;
    const priorMissions=app.store.read('UserAchievement').data;
    put('UserAchievement',[missionRow(missionId,reward.expireAt)]);
    await reject('achievement/complete',claimBody(app.store.read('UserAchievement').data));
    put('UserAchievement',priorMissions);
    for(const body of [null,{}, {pvpId:1},{pvpId:id,userId:seed.userId}]) await reject(start,body,400);
    for(const stamp of [window.startAt-1,window.endAt]) {now=stamp;await reject(start,{pvpId:id});}now=1660950000;
    for(const [field,value] of [['processingPvPState',1],['processingPvP',true],['processingSerialPvpState',1],['activePvPPartyId',0]]) {
      put('UserInfo',baseline.map(row=>({...row,[field]:value})));await reject(start,{pvpId:id});put('UserInfo',baseline);
    }
    for(const [table,label] of [['war_game_battle','battle'],['war_game_request','identity'],['reply_cache','reply']]) {
      app.store.db.exec(`CREATE TRIGGER fail_war_${label} BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'war entry rollback'); END`);
      await reject(start,{pvpId:id},503,false);app.store.db.exec(`DROP TRIGGER fail_war_${label}`);
    }
    const profiles=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),wallet=[app.store.hardCurrency(),app.store.paidCurrency()],
      reply=await send(start,{pvpId:id}),seq=sequence,result=parse(reply);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),profiles,'No native SP/processing/record precredit');
    assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);assert.deepEqual(app.store.operations(),[]);
    assert.match(result.battleId,/^offline-wargame-/);assert.ok(Number.isSafeInteger(result.randomSeed));
    assert.match(result.pvpPlayerInfo.name,/Offline CPU/);assert.notEqual(result.pvpPlayerInfo.userId,seed.userId);
    assert.deepEqual(result.pvpParty,{...own,userId:result.pvpPlayerInfo.userId});
    assert.equal(result.pvpRecord[0].score,1000);assert.equal(master.pvp.grades[result.pvpRecord[0].gradeId].order,0);
    assert.equal(result.pvpRecord[0].highestGradeId,0);assert.equal(result.pvpRecord[0].isReceiveReward,false);
    assert.equal(result.pvpPlayerInfo.friendRelationShip,0);
    assert.deepEqual((await request(port,seq,{pvpId:id},String(seq),start)).body,reply.body);
    await reject(start,{pvpId:id});await reject(restart,{pvpId:id});
    await reject('user_data/pull',{tables:['UserInfo']});await reject('pvp/summary/get',{pvpId:id});
    const beforeConflict=snapshot();
    assert.equal((await request(port,seq,{pvpId:id,extra:true},String(seq),start,
      {'X-ARGO-REQUEST-BODY-HASH':md5({pvpId:id})})).status,400);assert.equal(snapshot(),beforeConflict);
    app.store.beginSession();await close();await open();
    assert.deepEqual((await request(port,seq,{pvpId:id},String(seq),start)).body,reply.body,'Durable unsaved start survives cache eviction/restart');
    //WRITTEN ONLY:2544958's timer setter precedes its one-SP subtraction.
    now+=1;const timerOnly=structuredClone(baseline);timerOnly[0].playerStatus.pvpSPUpdatedAt=now;
    for(const [table,event,label] of [['profile','UPDATE','profile'],['war_game_battle','UPDATE','proof'],['reply_cache','INSERT','reply']]) {
      app.store.db.exec(`CREATE TRIGGER fail_timer_${label} BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'war timer rollback'); END`);
      const before=snapshot();assert.equal((await push({UserInfo:timerOnly})).status,503);assert.equal(snapshot(),before);
      app.store.db.exec(`DROP TRIGGER fail_timer_${label}`);
    }
    parse(await push({UserInfo:timerOnly}));parse(await push({UserInfo:timerOnly}));
    const pendingTimer=app.store.warGame.active();assert.equal(pendingTimer.savedSp,null);assert.ok(!pendingTimer.observed.includes('sp'));
    assert.deepEqual(pendingTimer.currentSp,{pvpSP:10,pvpSPUpdatedAt:now});
    assert.deepEqual(pendingTimer.before.sp,{pvpSP:baseline[0].playerStatus.pvpSP,pvpSPUpdatedAt:baseline[0].playerStatus.pvpSPUpdatedAt});
    assert.equal(app.store.read('UserInfo').token,md5(timerOnly));
    assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);assert.deepEqual(app.store.operations(),[]);
    await reject(restart,{pvpId:id});await reject(end,{pvpId:id,battleId:result.battleId,
      result:{isWin:true,isRetire:false,survivedPCs:1,spendTurns:1,maxDamage:1}});
    for(const [stock,stamp] of [[10,baseline[0].playerStatus.pvpSPUpdatedAt],[10,now+1],[9,now+1],[11,now]]) {
      const rows=structuredClone(timerOnly);Object.assign(rows[0].playerStatus,{pvpSP:stock,pvpSPUpdatedAt:stamp});
      const before=snapshot();assert.equal((await push({UserInfo:rows})).status,400);assert.equal(snapshot(),before);
    }
    app.store.beginSession();await close();await open();
    assert.deepEqual(app.store.warGame.active().currentSp,pendingTimer.currentSp);
    assert.equal(app.store.warGame.active().savedSp,null);
    assert.deepEqual((await request(port,seq,{pvpId:id},String(seq),start)).body,reply.body,'Pending timer keeps the same unobserved start, not a new debit');
    const after=structuredClone(baseline);after[0].playerStatus.pvpSP=9;after[0].playerStatus.pvpSPUpdatedAt=now;
    after[0].processingPvPState=1;
    for(const patch of [{processingPvPState:2},{processingPvP:true},{activePvPPartyId:401}]) {
      const rows=after.map(row=>({...row,...patch}));const before=snapshot();assert.equal((await push({UserInfo:rows})).status,400);assert.equal(snapshot(),before);
    }
    for(const [stock,stamp] of [[8,now],[9,now-6],[9,now+121]]) {
      const rows=structuredClone(after);rows[0].playerStatus.pvpSP=stock;rows[0].playerStatus.pvpSPUpdatedAt=stamp;
      const before=snapshot();assert.equal((await push({UserInfo:rows})).status,400);assert.equal(snapshot(),before);
    }
    for(const [table,event,label] of [['profile','UPDATE','profile'],['war_game_battle','UPDATE','proof'],['reply_cache','INSERT','save_reply']]) {
      app.store.db.exec(`CREATE TRIGGER fail_war_${label} BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'war save rollback'); END`);
      const before=snapshot();assert.equal((await push({UserInfo:after,UserPvPRecord:result.pvpRecord})).status,503);assert.equal(snapshot(),before);
      app.store.db.exec(`DROP TRIGGER fail_war_${label}`);
    }
    //Actual2783df4 native field order differs from our bootstrap insertion order.
    //Semantic save checks must not mistake JSON key order for different values.
    const nativeRecordOrder=['userId','pvpId','gradeId','rank','score','winCount','loseCount',
      'consecutiveWinCount','consecutiveLoseCount','lastAdversaryIds','lastBattleId','isReceiveReward','isAggregate','highestGradeId'];
    const nativeRecords=result.pvpRecord.map(row=>Object.fromEntries(nativeRecordOrder.map(key=>[key,row[key]])));
    parse(await push({UserPvPRecord:nativeRecords}));await reject(restart,{pvpId:id});
    const partial=snapshot();assert.equal((await request(port,seq,{pvpId:id},String(seq),start)).status,503);assert.equal(snapshot(),partial);
    parse(await push({UserInfo:after}));await close();await open();
    const resume=parse(await send(restart,{pvpId:id})),resumeSeq=sequence;
    assert.deepEqual(resume,{...result,result:0});assert.equal(app.store.read('UserInfo').data[0].playerStatus.pvpSP,9);
    now=window.endAt+86400;await close();await open();
    assert.deepEqual(parse(await send(restart,{pvpId:id})),resume,'Captured battle resumes after original matching expires without another debit');
    assert.deepEqual(parse(await request(port,resumeSeq,{pvpId:id},String(resumeSeq),restart)),resume);
    //WRITTEN ONLY:25444d0 stock-first recovery after the already-proved entry debit.
    const beforePassive=structuredClone(app.store.read('UserInfo').data),passiveStock=structuredClone(beforePassive);
    passiveStock[0].playerStatus.pvpSP=10;
    for(const [table,event,label] of [['profile','UPDATE','profile'],['war_game_battle','UPDATE','proof'],['reply_cache','INSERT','reply']]) {
      app.store.db.exec(`CREATE TRIGGER fail_passive_stock_${label} BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'war passive stock rollback'); END`);
      const before=snapshot();assert.equal((await push({UserInfo:passiveStock})).status,503);assert.equal(snapshot(),before);
      app.store.db.exec(`DROP TRIGGER fail_passive_stock_${label}`);
    }
    parse(await push({UserInfo:passiveStock}));parse(await push({UserInfo:passiveStock}));
    const passiveCapture=app.store.warGame.active(),savedPassiveNow=now;
    assert.deepEqual(passiveCapture.recoveryBefore,{pvpSP:9,pvpSPUpdatedAt:beforePassive[0].playerStatus.pvpSPUpdatedAt});
    assert.deepEqual(passiveCapture.savedSp,passiveCapture.recoveryBefore);assert.equal(passiveCapture.recoveredAt,now);
    assert.deepEqual(passiveCapture.currentSp,{pvpSP:10,pvpSPUpdatedAt:passiveCapture.recoveryBefore.pvpSPUpdatedAt});
    assert.deepEqual(passiveCapture.observed,['processing','record','sp']);
    assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);assert.deepEqual(app.store.operations(),[]);
    const storedPassive=app.store.db.prepare('SELECT sp_current_json FROM war_game_battle WHERE battle_id=?').get(result.battleId).sp_current_json;
    assert.deepEqual(JSON.parse(storedPassive),{sp:passiveCapture.currentSp,recoveryBefore:passiveCapture.recoveryBefore,recoveredAt:now});
    for(const bad of [passiveCapture.currentSp,{sp:passiveCapture.currentSp,recoveryBefore:null,recoveredAt:now},
      {sp:passiveCapture.currentSp,recoveryBefore:passiveCapture.recoveryBefore,recoveredAt:beforePassive[0].playerStatus.pvpSPUpdatedAt},
      {sp:{...passiveCapture.currentSp,pvpSP:11},recoveryBefore:passiveCapture.recoveryBefore,recoveredAt:now},
      {sp:passiveCapture.currentSp,recoveryBefore:{...passiveCapture.recoveryBefore,pvpSP:8},recoveredAt:now},
      {sp:passiveCapture.currentSp,recoveryBefore:passiveCapture.recoveryBefore,recoveredAt:-1}]) {
      app.store.db.prepare('UPDATE war_game_battle SET sp_current_json=? WHERE battle_id=?').run(JSON.stringify(bad),result.battleId);
      await reject(restart,{pvpId:id});
      app.store.db.prepare('UPDATE war_game_battle SET sp_current_json=? WHERE battle_id=?').run(storedPassive,result.battleId);
    }
    const passive=structuredClone(beforePassive);
    Object.assign(passive[0].playerStatus,pvpStamina(beforePassive[0].playerStatus,now));
    for(const [stock,stamp] of [[9,passiveCapture.currentSp.pvpSPUpdatedAt],[11,passiveCapture.currentSp.pvpSPUpdatedAt],
      [10,passive[0].playerStatus.pvpSPUpdatedAt+1]]) {
      const wrong=structuredClone(passiveStock);Object.assign(wrong[0].playerStatus,{pvpSP:stock,pvpSPUpdatedAt:stamp});
      const before=snapshot();assert.equal((await push({UserInfo:wrong})).status,400);assert.equal(snapshot(),before);
    }
    app.store.beginSession();await close();now=passiveCapture.savedSp.pvpSPUpdatedAt-1;await open();
    parse(await push({UserInfo:passiveStock}));assert.equal(app.store.warGame.active().recoveredAt,savedPassiveNow);
    assert.deepEqual(parse(await send(restart,{pvpId:id})),resume,'Retained recovery does not spend another entry after clock rewind');
    for(const [table,event,label] of [['profile','UPDATE','profile'],['war_game_battle','UPDATE','proof'],['reply_cache','INSERT','reply']]) {
      app.store.db.exec(`CREATE TRIGGER fail_passive_timer_${label} BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'war passive timer rollback'); END`);
      const before=snapshot();assert.equal((await push({UserInfo:passive})).status,503);assert.equal(snapshot(),before);
      app.store.db.exec(`DROP TRIGGER fail_passive_timer_${label}`);
    }
    parse(await push({UserInfo:passive}));now=savedPassiveNow;
    assert.equal(app.store.warGame.active().recoveryBefore,null);assert.equal(app.store.warGame.active().recoveredAt,null);
    assert.deepEqual(JSON.parse(app.store.db.prepare('SELECT sp_current_json FROM war_game_battle WHERE battle_id=?').get(result.battleId).sp_current_json),
      {pvpSP:10,pvpSPUpdatedAt:passive[0].playerStatus.pvpSPUpdatedAt},'Completed recovery returns to the legacy full-pair representation');
    const rewindPassive=snapshot();assert.equal((await push({UserInfo:passiveStock})).status,400);assert.equal(snapshot(),rewindPassive);
    assert.equal(app.store.warGame.active().savedSp.pvpSP,9,'Original one-SP debit remains pinned after passive recovery');
    assert.equal(app.store.warGame.active().currentSp.pvpSP,10);
    assert.deepEqual(parse(await send(restart,{pvpId:id})),resume);
    await close();
    assert.throws(()=>createServer({database:path.join(directory,`${file}.sqlite`),seed,master,eventDate:'2021-01-01',
      wallNowSeconds:()=>now,log:()=>{}}),/active War Game battle/,'A new event clock cannot strand an active captured season');
    await open();assert.equal(app.store.eventClock.summary().selectedEpoch,null);
    await reject(start,{pvpId:id});await reject('currency/hard/consume',{consumeId:81051001});
    const old=snapshot();assert.equal((await push({UserInfo:baseline})).status,400);assert.equal(snapshot(),old);
    //Unrelated native counters are not frozen by the battle's party snapshot.
    const pcs=structuredClone(app.store.read('UserPC').data);pcs[0].battlePlayCount+=1;parse(await push({UserPC:pcs}));
    assert.equal(app.store.warGame.active().battle_id,result.battleId);
    for(const [field,bad] of [['catalog_hash','missing'],['pvp_id',1],['before_json','{}'],['before_json','null'],
      ['own_json','null'],['response_json','{}'],['response_json','null'],['sp_saved_json','{}'],['sp_current_json','{}']]) {
      const row=app.store.db.prepare('SELECT * FROM war_game_battle WHERE battle_id=?').get(result.battleId);
      app.store.db.prepare(`UPDATE war_game_battle SET ${field}=? WHERE battle_id=?`).run(bad,result.battleId);
      await reject(restart,{pvpId:id});app.store.db.prepare(`UPDATE war_game_battle SET ${field}=? WHERE battle_id=?`).run(row[field],result.battleId);
    }
    //Synthetic closed marker only: bypasses the end handler, NOT settlement proof.
    app.store.db.prepare('UPDATE war_game_battle SET closed=1 WHERE battle_id=?').run(result.battleId);
    const closed=snapshot();assert.equal((await request(port,resumeSeq,{pvpId:id},String(resumeSeq),restart)).status,503);assert.equal(snapshot(),closed);
    //WRITTEN ONLY: natural recovery to the cap may save before the cap timer reset.
    //Also retain extra SP and admit a raw-empty stock only through its exact recovered pair.
    for(const [stock,elapsed,effective,offset,coalesced] of [[9,1807,10,7,false],[9,1807,10,7,true],
      [12,7207,12,7207,false],[0,3607,2,7,false],[0,3607,2,7,true]]) {
      await close();file+=1;now=reward.startAt+3600;await open();setup();
      const raw=structuredClone(seed.data.UserInfo);Object.assign(raw[0].playerStatus,{pvpSP:stock,pvpSPUpdatedAt:now-elapsed});put('UserInfo',raw);
      const entryReply=await send(start,{pvpId:id}),entrySeq=sequence,entry=parse(entryReply),refreshed=structuredClone(raw);
      Object.assign(refreshed[0].playerStatus,{pvpSP:effective,pvpSPUpdatedAt:now-offset});
      if(stock<10) {
        const stockOnly=structuredClone(raw);stockOnly[0].playerStatus.pvpSP=effective;
        for(const [table,event,label] of [['profile','UPDATE','profile'],['war_game_battle','UPDATE','proof'],['reply_cache','INSERT','reply']]) {
          app.store.db.exec(`CREATE TRIGGER fail_recovery_stock_${label} BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'war recovery stock rollback'); END`);
          const before=snapshot();assert.equal((await push({UserInfo:stockOnly})).status,503);assert.equal(snapshot(),before);
          app.store.db.exec(`DROP TRIGGER fail_recovery_stock_${label}`);
        }
        parse(await push({UserInfo:stockOnly}));parse(await push({UserInfo:stockOnly}));
        const staged=app.store.warGame.active();assert.equal(staged.savedSp,null);assert.ok(!staged.observed.includes('sp'));
        assert.deepEqual(staged.currentSp,{pvpSP:effective,pvpSPUpdatedAt:now-elapsed});
        assert.deepEqual(staged.before.sp,{pvpSP:stock,pvpSPUpdatedAt:now-elapsed});
        for(const [amount,stamp] of [[stock,now-elapsed],[effective-1,now-elapsed],[effective+1,now-elapsed],[effective,now+121]]) {
          const wrong=structuredClone(stockOnly);Object.assign(wrong[0].playerStatus,{pvpSP:amount,pvpSPUpdatedAt:stamp});
          const before=snapshot();assert.equal((await push({UserInfo:wrong})).status,400);assert.equal(snapshot(),before);
        }
        await reject(restart,{pvpId:id});await reject(end,{pvpId:id,battleId:entry.battleId,
          result:{isWin:true,isRetire:false,survivedPCs:1,spendTurns:1,maxDamage:1}});
        app.store.beginSession();await close();await open();
        assert.deepEqual(app.store.warGame.active().currentSp,staged.currentSp);assert.equal(app.store.warGame.active().savedSp,null);
        assert.deepEqual((await request(port,entrySeq,{pvpId:id},String(entrySeq),start)).body,entryReply.body);
        const capture=app.store.db.prepare('SELECT sp_current_json FROM war_game_battle WHERE battle_id=?').get(entry.battleId);
        app.store.db.prepare('UPDATE war_game_battle SET sp_current_json=? WHERE battle_id=?')
          .run(JSON.stringify({pvpSP:effective+1,pvpSPUpdatedAt:now-elapsed}),entry.battleId);
        await reject(restart,{pvpId:id});
        app.store.db.prepare('UPDATE war_game_battle SET sp_current_json=? WHERE battle_id=?').run(capture.sp_current_json,entry.battleId);
      }
      if(!coalesced) parse(await push({UserInfo:refreshed}));
      assert.equal(app.store.warGame.active().savedSp,null);
      assert.ok(!app.store.warGame.active().observed.includes('sp'));
      assert.deepEqual(app.store.warGame.active().before.sp,{pvpSP:stock,pvpSPUpdatedAt:now-elapsed});
      const consumeBefore=structuredClone(refreshed);
      if(effective>=10) {consumeBefore[0].playerStatus.pvpSPUpdatedAt=now;if(!coalesced) parse(await push({UserInfo:consumeBefore}));}
      assert.deepEqual(app.store.warGame.active().currentSp,{pvpSP:effective,
        pvpSPUpdatedAt:coalesced?now-elapsed:consumeBefore[0].playerStatus.pvpSPUpdatedAt});
      const wrong=structuredClone(consumeBefore);
      if(coalesced && effective>=10) wrong[0].playerStatus.pvpSP+=1;else wrong[0].playerStatus.pvpSPUpdatedAt+=1;
      const before=snapshot();assert.equal((await push({UserInfo:wrong})).status,400);assert.equal(snapshot(),before);
      if(effective>=10) {
        const missedReset=structuredClone(refreshed);missedReset[0].playerStatus.pvpSP-=1;
        const prior=snapshot();assert.equal((await push({UserInfo:missedReset})).status,400);assert.equal(snapshot(),prior);
      }
      await close();await open();await reject(restart,{pvpId:id});
      const consumed=structuredClone(consumeBefore);consumed[0].playerStatus.pvpSP-=1;consumed[0].processingPvPState=1;
      parse(await push({UserInfo:consumed,UserPvPRecord:entry.pvpRecord}));
      assert.equal(app.store.warGame.active().savedSp.pvpSP,effective-1);
      assert.equal(parse(await send(restart,{pvpId:id})).battleId,entry.battleId);
      if(effective<10 && !coalesced) {
        const originalDebit=app.store.warGame.active().savedSp;
        for(const cycle of [0,1]) {
          const recoveryBase=structuredClone(app.store.read('UserInfo').data),stockStage=structuredClone(recoveryBase);
          stockStage[0].playerStatus.pvpSP+=1;
          const early=snapshot();assert.equal((await push({UserInfo:stockStage})).status,400);assert.equal(snapshot(),early,'No SP is available before its interval');
          now+=1800;const recoverNow=now;
          parse(await push({UserInfo:stockStage}));
          const checkpoint=app.store.warGame.active();assert.deepEqual(checkpoint.savedSp,originalDebit);
          assert.deepEqual(checkpoint.recoveryBefore,{pvpSP:recoveryBase[0].playerStatus.pvpSP,pvpSPUpdatedAt:recoveryBase[0].playerStatus.pvpSPUpdatedAt});
          const secondStock=structuredClone(stockStage);secondStock[0].playerStatus.pvpSP+=1;
          const repeated=snapshot();assert.equal((await push({UserInfo:secondStock})).status,400);assert.equal(snapshot(),repeated,'Finish the prior timer before another recovery');
          const unrelated=structuredClone(app.store.read('UserPC').data);unrelated[0].battlePlayCount+=1;
          parse(await push({UserPC:unrelated}));assert.deepEqual(app.store.warGame.active().recoveryBefore,checkpoint.recoveryBefore);
          assert.equal(app.store.warGame.active().recoveredAt,recoverNow);
          const timerStage=structuredClone(recoveryBase);
          Object.assign(timerStage[0].playerStatus,pvpStamina(recoveryBase[0].playerStatus,now));
          if(!cycle) {app.store.beginSession();await close();now=checkpoint.recoveryBefore.pvpSPUpdatedAt-1;await open();}
          parse(await push({UserInfo:timerStage}));now=recoverNow;
          assert.equal(app.store.warGame.active().recoveryBefore,null);assert.equal(app.store.warGame.active().recoveredAt,null);
          assert.deepEqual(app.store.warGame.active().savedSp,originalDebit);
          assert.equal(parse(await send(restart,{pvpId:id})).battleId,entry.battleId);
        }
      }
    }
    //The earned-mission fixture must play inside the original completion
    //window; do not forge an earlier timestamp after earning a later grade.
    await close();file+=1;now=reward.startAt+3600;await open();setup();
    const low=structuredClone(seed.data.UserInfo);low[0].playerStatus.pvpSP=1;low[0].playerStatus.pvpSPUpdatedAt=now-3607;put('UserInfo',low);
    const regenReply=await send(start,{pvpId:id}),regenSeq=sequence,regen=parse(regenReply),refreshed=structuredClone(low);
    Object.assign(refreshed[0].playerStatus,{pvpSP:3,pvpSPUpdatedAt:now-7});
    const timerFirst=structuredClone(low);timerFirst[0].playerStatus.pvpSPUpdatedAt=now-7;
    const beforeTimerFirst=snapshot();assert.equal((await push({UserInfo:timerFirst})).status,400);assert.equal(snapshot(),beforeTimerFirst);
    const recoveryStock=structuredClone(low);recoveryStock[0].playerStatus.pvpSP=3;
    parse(await push({UserInfo:recoveryStock}));
    assert.equal(app.store.warGame.active().savedSp,null);assert.ok(!app.store.warGame.active().observed.includes('sp'));
    assert.deepEqual(app.store.warGame.active().currentSp,{pvpSP:3,pvpSPUpdatedAt:now-3607});
    for(const [stock,stamp] of [[1,now-3607],[0,now-3607],[2,now-3607],[3,now-6],[4,now-3607]]) {
      const rows=structuredClone(recoveryStock);Object.assign(rows[0].playerStatus,{pvpSP:stock,pvpSPUpdatedAt:stamp});
      const before=snapshot();assert.equal((await push({UserInfo:rows})).status,400);assert.equal(snapshot(),before);
    }
    await close();await open();assert.deepEqual(app.store.warGame.active().currentSp,{pvpSP:3,pvpSPUpdatedAt:now-3607});
    parse(await push({UserInfo:refreshed}));
    assert.equal(app.store.warGame.active().savedSp,null);assert.ok(!app.store.warGame.active().observed.includes('sp'));
    assert.deepEqual(app.store.warGame.active().currentSp,{pvpSP:3,pvpSPUpdatedAt:now-7});
    assert.deepEqual(app.store.warGame.active().before.sp,{pvpSP:1,pvpSPUpdatedAt:now-3607});
    for(const [stock,stamp] of [[1,now-3607],[0,now-3607],[3,now-3607],[2,now-6],[3,now-6],[4,now-7]]) {
      const rows=structuredClone(refreshed);Object.assign(rows[0].playerStatus,{pvpSP:stock,pvpSPUpdatedAt:stamp});
      const before=snapshot();assert.equal((await push({UserInfo:rows})).status,400);assert.equal(snapshot(),before);
    }
    await reject(restart,{pvpId:id});await reject(end,{pvpId:id,battleId:regen.battleId,
      result:{isWin:true,isRetire:false,survivedPCs:1,spendTurns:1,maxDamage:1}});
    app.store.beginSession();await close();await open();
    assert.deepEqual((await request(port,regenSeq,{pvpId:id},String(regenSeq),start)).body,regenReply.body);
    const saved=structuredClone(refreshed);
    saved[0].playerStatus.pvpSP=2;saved[0].playerStatus.pvpSPUpdatedAt=now-7;saved[0].processingPvPState=1;
    parse(await push({UserInfo:saved,UserPvPRecord:regen.pvpRecord}));assert.equal(parse(await send(restart,{pvpId:id})).battleId,regen.battleId);
    //Synthetic v1 capture migration fixture. Old in-flight/closed entries must
    //retain fixed-grade v1 awards; later fresh entries use new original borders.
    app.store.db.prepare('UPDATE war_game_battle SET catalog_hash=? WHERE battle_id=?').run(legacyCatalog,regen.battleId);
    await close();await open();assert.equal(parse(await send(restart,{pvpId:id})).battleId,regen.battleId);
    const verdict={pvpId:id,battleId:regen.battleId,result:{isWin:true,isRetire:false,survivedPCs:1,spendTurns:3,maxDamage:1234}},
      battle=app.store.warGame.active(),expected=warGameFinish(battle,verdict,master);
    assert.equal(expected.pvpRecord[0].score,1016);assert.equal(expected.pvpRecord[0].winCount,1);
    assert.equal(expected.pvpRecord[0].consecutiveWinCount,1);assert.equal(expected.pvpRecord[0].consecutiveLoseCount,0);
    assert.equal(expected.pvpResult.scoreDifference,16);assert.equal(expected.pvpResult.gradeId,regen.pvpRecord[0].gradeId);
    const crossing={...battle,target:{...battle.target,score:1050}},promotion=warGameFinish(crossing,verdict,master);
    assert.equal(promotion.pvpRecord[0].gradeId,13001380001);assert.equal(promotion.pvpRecord[0].highestGradeId,13001380001);
    assert.equal(warGameFinish(crossing,verdict,master,false).pvpRecord[0].gradeId,13001380000,'Captured v1 policy does not change');
    const demotion=warGameFinish({...battle,target:{...promotion.pvpRecord[0],score:1060}},
      {...verdict,result:{...verdict.result,isWin:false,isRetire:true}},master);
    assert.equal(demotion.pvpRecord[0].gradeId,13001380000);assert.equal(demotion.pvpRecord[0].highestGradeId,13001380001);
    assert.equal(warGameFinish({...battle,target:{...promotion.pvpRecord[0],score:1060,highestGradeId:0}},
      {...verdict,result:{...verdict.result,isWin:false,isRetire:true}},master).pvpRecord[0].highestGradeId,13001380001,
      'The known pre-battle current grade cannot disappear from highest-grade history');
    const small={...battle,target:{...battle.target,score:3}},retire={...verdict,result:{...verdict.result,isWin:false,isRetire:true}};
    assert.equal(warGameFinish(small,retire,master).pvpResult.score,0);
    assert.equal(warGameFinish(small,retire,master).pvpResult.scoreDifference,-3,'Offline floor reports the actual difference');
    assert.throws(()=>warGameFinish({...battle,target:{...battle.target,score:0x7fffffff}},verdict,master),/int32/);
    const hero=warGameFinish({...battle,target:{...battle.target,score:3584}},verdict,master,true,1);
    assert.equal(hero.pvpRecord[0].gradeId,13001380020);assert.equal(hero.pvpRecord[0].rank,1);
    const heroLoss=warGameFinish({...battle,target:hero.pvpRecord[0]},retire,master,true,1);
    assert.equal(heroLoss.pvpRecord[0].gradeId,13001380017);assert.equal(heroLoss.pvpRecord[0].rank,1);
    assert.equal(heroLoss.pvpRecord[0].highestGradeId,13001380020);
    assert.equal(warGameFinish({...battle,target:{...battle.target,score:3584}},verdict,master).pvpRecord[0].gradeId,
      13001380018,'Captured v2 policy remains ordinary-only');
    assert.throws(()=>warGameFinish(battle,verdict,master,false,1),/local rank/);
    for(const result of [null,{...verdict.result,isRetire:true},{...verdict.result,survivedPCs:0},
      {...verdict.result,survivedPCs:7},{...verdict.result,maxDamage:-1},{...verdict.result,spendTurns:1.5}])
      await reject(end,{...verdict,result},400);
    for(const [table,label] of [['operation_queue','queue'],['war_game_end','finish'],['war_game_request','request'],['reply_cache','reply']]) {
      app.store.db.exec(`CREATE TRIGGER fail_end_${label} BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'war finish rollback'); END`);
      await reject(end,verdict,503,false);app.store.db.exec(`DROP TRIGGER fail_end_${label}`);
    }
    const priorProfiles=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),endReply=await send(end,verdict),endSeq=sequence,
      ended=parse(endReply),operation=ended.operation;
    assert.equal(operation.type,14000);assert.deepEqual(operation.parameters,expected);assert.deepEqual(ended.operations,[operation]);
    assert.equal(app.store.warGame.finish(regen.battleId).catalog_hash,hash([legacyCatalog,'offline-mirror-elo32-v1']));
    assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),priorProfiles,'14000 is not native record/processing/SP precredit');
    assert.deepEqual((await request(port,endSeq,verdict,String(endSeq),end)).body,endReply.body);
    //Resolve the captured transport key rather than guessing session formatting.
    const identities=app.store.db.prepare('SELECT * FROM war_game_request WHERE action=?').all(end),cachedIdentity=identities[0];
    app.store.db.prepare('DELETE FROM war_game_request WHERE request_key=?').run(cachedIdentity.request_key);
    const missing=snapshot();assert.equal((await request(port,endSeq,verdict,String(endSeq),end)).status,503);assert.equal(snapshot(),missing);
    app.store.db.prepare('INSERT INTO war_game_request(request_key,action,body_hash,battle_id,response_json) VALUES(?,?,?,?,?)')
      .run(cachedIdentity.request_key,cachedIdentity.action,cachedIdentity.body_hash,cachedIdentity.battle_id,cachedIdentity.response_json);
    assert.equal(parse(await send(end,verdict)).operation.id,operation.id,'A fresh transport cannot create a second award');
    await reject(end,{...verdict,result:{...verdict.result,isWin:false}},400);
    await reject(restart,{pvpId:id});await reject(start,{pvpId:id});await reject('user_data/confirm',undefined);
    const beforeAck=snapshot();assert.equal((await push({},[operation])).status,400);assert.equal(snapshot(),beforeAck,'ACK alone cannot close an unsaved result');
    for(const [field,bad] of [['catalog_hash','missing'],['verdict_json','null'],['response_json','{}'],['operation_json','null']]) {
      const row=app.store.db.prepare('SELECT * FROM war_game_end WHERE battle_id=?').get(verdict.battleId);
      app.store.db.prepare(`UPDATE war_game_end SET ${field}=? WHERE battle_id=?`).run(bad,verdict.battleId);
      await reject(end,verdict);app.store.db.prepare(`UPDATE war_game_end SET ${field}=? WHERE battle_id=?`).run(row[field],verdict.battleId);
    }
    //WRITTEN ONLY: pending14000 may overlap an independent below-cap recovery.
    now+=1800;const finishRecoveryBefore=structuredClone(app.store.read('UserInfo').data),finishRecoveryStock=structuredClone(finishRecoveryBefore);
    finishRecoveryStock[0].playerStatus.pvpSP=3;
    const finishWallet=[app.store.hardCurrency(),app.store.paidCurrency()];
    for(const [table,event,label] of [['profile','UPDATE','profile'],['war_game_battle','UPDATE','checkpoint'],['war_game_end','UPDATE','proof'],
      ['reply_cache','INSERT','reply']]) {
      app.store.db.exec(`CREATE TRIGGER fail_finish_recovery_${label} BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'war finish recovery rollback'); END`);
      const before=snapshot();assert.equal((await push({UserInfo:finishRecoveryStock})).status,503);assert.equal(snapshot(),before);
      app.store.db.exec(`DROP TRIGGER fail_finish_recovery_${label}`);
    }
    parse(await push({UserInfo:finishRecoveryStock}));parse(await push({UserInfo:finishRecoveryStock}));
    const finishRecoveryCapture=app.store.warGame.active();
    assert.equal(finishRecoveryCapture.savedSp.pvpSP,2);assert.equal(finishRecoveryCapture.currentSp.pvpSP,3);
    assert.deepEqual(finishRecoveryCapture.recoveryBefore,finishRecoveryCapture.savedSp);
    assert.equal(finishRecoveryCapture.recoveredAt,now);assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],finishWallet);
    assert.equal(app.store.warGame.finish(verdict.battleId).record_saved,0);assert.equal(app.store.warGame.finish(verdict.battleId).processing_saved,0);
    assert.equal(app.store.operations()[0].id,operation.id);
    for(const [stock,stamp] of [[2,finishRecoveryCapture.currentSp.pvpSPUpdatedAt],[4,finishRecoveryCapture.currentSp.pvpSPUpdatedAt],
      [3,finishRecoveryCapture.currentSp.pvpSPUpdatedAt+1]]) {
      const wrong=structuredClone(finishRecoveryStock);Object.assign(wrong[0].playerStatus,{pvpSP:stock,pvpSPUpdatedAt:stamp});
      const before=snapshot();assert.equal((await push({UserInfo:wrong})).status,400);assert.equal(snapshot(),before);
    }
    await close();await open();assert.equal(app.store.warGame.active().recoveredAt,finishRecoveryCapture.recoveredAt);
    const finishInfo=structuredClone(finishRecoveryStock);finishInfo[0].processingPvPState=0;
    for(const [table,event,label] of [['profile','UPDATE','profile'],['war_game_end','UPDATE','proof'],['war_game_battle','UPDATE','close'],
      ['war_game_usage','INSERT','usage'],['war_game_record','INSERT','record'],['operation_done','INSERT','ack'],['reply_cache','INSERT','reply']]) {
      app.store.db.exec(`CREATE TRIGGER fail_finish_${label} BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'war close rollback'); END`);
      const before=snapshot();assert.equal((await push({UserInfo:finishInfo,UserPvPRecord:expected.pvpRecord},[operation])).status,503);assert.equal(snapshot(),before);
      app.store.db.exec(`DROP TRIGGER fail_finish_${label}`);
    }
    parse(await push({UserPvPRecord:expected.pvpRecord}));
    assert.ok(app.store.warGame.active());assert.equal(app.store.warGame.finish(verdict.battleId).record_saved,1);
    assert.equal(app.store.warGame.finish(verdict.battleId).processing_saved,0);
    const split=await push({});assert.deepEqual(parse(split).operations,[],'Observed end callback is suppressed while its queue is retained');
    assert.equal(app.store.operations()[0].id,operation.id);
    const partialEnd=snapshot();assert.equal((await request(port,endSeq,verdict,String(endSeq),end)).status,503);assert.equal(snapshot(),partialEnd);
    await close();await open();await reject(end,verdict);
    const incomplete=snapshot();assert.equal((await push({},[operation])).status,400);assert.equal(snapshot(),incomplete);
    parse(await push({UserInfo:finishInfo},[operation]));
    assert.equal(app.store.warGame.active(),null);assert.deepEqual(app.store.operations(),[]);
    assert.equal(app.store.warGame.finish(verdict.battleId).done,true);assert.deepEqual(app.store.read('UserPvPRecord').data,expected.pvpRecord);
    const count=app.store.db.prepare('SELECT attempt_count FROM war_game_record WHERE pvp_id=?').get(id).attempt_count;assert.equal(count,1);
    const counts=app.store.db.prepare('SELECT * FROM war_game_usage ORDER BY kind,pc_id').all();assert.ok(counts.length);
    const finishPassiveFull=structuredClone(finishInfo);
    Object.assign(finishPassiveFull[0].playerStatus,pvpStamina(finishRecoveryBefore[0].playerStatus,now));
    parse(await push({UserInfo:finishPassiveFull}));
    assert.equal(app.store.read('UserInfo').data[0].playerStatus.pvpSPUpdatedAt,finishRecoveryCapture.currentSp.pvpSPUpdatedAt+1800);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM war_game_usage ORDER BY kind,pc_id').all(),counts);
    const closedRecovery=app.store.warGame.finish(verdict.battleId).parent;
    assert.deepEqual(closedRecovery.recoveryBefore,finishRecoveryCapture.recoveryBefore);
    assert.equal(closedRecovery.savedSp.pvpSP,2,'Late timer save cannot rewrite the acknowledged battle debit');
    parse(await push({},[operation]));assert.deepEqual(app.store.db.prepare('SELECT * FROM war_game_usage ORDER BY kind,pc_id').all(),counts,'Repeated ACK counts no additional participation');
    const usage=parse(await send('pvp/character/ranking/get',{pvpId:id}));assert.ok(usage.normal.length);
    assert.deepEqual(usage.normal,app.store.warGame.usage(id).normal);parse(await send('pvp/summary/get',{pvpId:id}));
    const rewind=snapshot();assert.equal((await push({UserPvPRecord:regen.pvpRecord})).status,400);assert.equal(snapshot(),rewind);
    await reject(end,verdict);await reject(restart,{pvpId:id});
    await close();await open();
    const fresh=parse(await send(start,{pvpId:id}));assert.notEqual(fresh.battleId,regen.battleId);assert.deepEqual(fresh.pvpRecord,expected.pvpRecord);
    const freshInfo=structuredClone(app.store.read('UserInfo').data);freshInfo[0].processingPvPState=1;freshInfo[0].playerStatus.pvpSP-=1;
    parse(await push({UserInfo:freshInfo}));
    const loss={pvpId:id,battleId:fresh.battleId,result:{isWin:false,isRetire:true,survivedPCs:1,spendTurns:0,maxDamage:0}},
      lossReply=parse(await send(end,loss));
    assert.equal(lossReply.pvpResult.score,1000);assert.equal(lossReply.pvpResult.scoreDifference,-16);
    assert.equal(lossReply.pvpRecord[0].winCount,1);assert.equal(lossReply.pvpRecord[0].loseCount,1);assert.equal(lossReply.pvpRecord[0].consecutiveWinCount,0);
    freshInfo[0].processingPvPState=0;parse(await push({UserInfo:freshInfo,UserPvPRecord:lossReply.pvpRecord},[lossReply.operation]));
    assert.equal(app.store.db.prepare('SELECT attempt_count FROM war_game_record WHERE pvp_id=?').get(id).attempt_count,2);
    for(const row of app.store.db.prepare('SELECT * FROM war_game_usage').all()) assert.equal(row.count,2);
    //Info-first split order, then a separate record save and ACK; no new attempt on finish.
    const third=parse(await send(start,{pvpId:id})),thirdInfo=structuredClone(app.store.read('UserInfo').data);
    Object.assign(thirdInfo[0],{processingPvPState:1});thirdInfo[0].playerStatus.pvpSP-=1;
    parse(await push({UserInfo:thirdInfo}));
    const thirdVerdict={...verdict,battleId:third.battleId},thirdEnd=parse(await send(end,thirdVerdict));
    thirdInfo[0].processingPvPState=0;parse(await push({UserInfo:thirdInfo}));
    assert.equal(app.store.warGame.finish(third.battleId).processing_saved,1);assert.equal(app.store.warGame.finish(third.battleId).record_saved,0);
    parse(await push({UserPvPRecord:thirdEnd.pvpRecord}));parse(await push({},[thirdEnd.operation]));
    assert.equal(app.store.db.prepare('SELECT attempt_count FROM war_game_record WHERE pvp_id=?').get(id).attempt_count,3);
    for(const row of app.store.db.prepare('SELECT * FROM war_game_usage').all()) assert.equal(row.count,3);
    //Earn a real source-handler threshold crossing, then demote without
    //rewinding highestGradeId. No manual native score/profile precredit.
    let completedMission;
    for(const isWin of [true,true,true,false]) {
      now+=1800;
      const next=parse(await send(start,{pvpId:id})),nextInfo=structuredClone(app.store.read('UserInfo').data);
      Object.assign(nextInfo[0].playerStatus,pvpStamina(nextInfo[0].playerStatus,now));nextInfo[0].playerStatus.pvpSP-=1;
      nextInfo[0].processingPvPState=1;parse(await push({UserInfo:nextInfo}));
      const finish=parse(await send(end,{...verdict,battleId:next.battleId,result:{...verdict.result,isWin,isRetire:!isWin}}));
      if(!completedMission && finish.pvpRecord[0].highestGradeId===mission.gradeId) {
        //Synthetic native state3/goal vector, not natural observer/signature
        //proof. An issued but unACKed14000 must not unlock its mission.
        completedMission=missionRow(missionId,now);put('UserAchievement',[completedMission]);
        await reject('achievement/complete',claimBody([completedMission]),400);
      }
      nextInfo[0].processingPvPState=0;parse(await push({UserInfo:nextInfo,UserPvPRecord:finish.pvpRecord},[finish.operation]));
      assert.equal(app.store.warGame.finish(next.battleId).catalog_hash,hash([hash(master.pvp),'offline-mirror-elo32-grades-v2']));
    }
    await close();await open();
    const earned=app.store.read('UserPvPRecord').data[0];assert.equal(earned.score,1048);
    assert.equal(earned.gradeId,13001380000);assert.equal(earned.highestGradeId,13001380001);
    assert.equal(app.store.db.prepare('SELECT attempt_count FROM war_game_record WHERE pvp_id=?').get(id).attempt_count,7);
    parse(await send('pvp/summary/get',{pvpId:id}));parse(await send('pvp/character/ranking/get',{pvpId:id}));
    assert.ok(completedMission && completedMission.completedAt<=reward.expireAt);
    const conditions=master.warGameAchievements;
    for(const bad of [null,[],{...conditions,[missionId]:{...mission,resetType:1}},
      {...conditions,[missionId]:{...mission,requiredParam:0}}]) {
      master.warGameAchievements=bad;
      try {await reject('achievement/complete',claimBody([completedMission]));}
      finally {master.warGameAchievements=conditions;}
    }
    for(const bad of [{...completedMission,progressParam:0},{...completedMission,progressParam:2},
      {...completedMission,userId:2},missionRow(6030033996,now),missionRow(missionId,reward.expireAt+1)]) {
      put('UserAchievement',[bad]);await reject('achievement/complete',claimBody([bad]),400);
    }
    const foreignId=Number(Object.keys(master.warGameAchievements).find(key=>master.warGameAchievements[key].pvpId!==id)),
      foreign=missionRow(foreignId,master.achievements[foreignId].startAt);
    put('UserAchievement',[foreign]);await reject('achievement/complete',claimBody([foreign]));
    put('UserAchievement',[completedMission]);
    const claim=claimBody([completedMission]),irisBefore=app.store.hardCurrency(),nativeBefore=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all();
    for(const table of ['operation_queue','achievement_pc_delivery','achievement_claim','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_grade_claim BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'grade claim rollback'); END`);
      await reject('achievement/complete',claim,503,false);assert.equal(app.store.hardCurrency(),irisBefore);
      app.store.db.exec('DROP TRIGGER fail_grade_claim');
    }
    const claimReply=await send('achievement/complete',claim),claimSeq=sequence,claimed=parse(claimReply),claimOp=claimed.operations[0];
    assert.equal(claimOp.type,6000);assert.equal(claimed.issueAmount,reward.rewardAmount);
    assert.deepEqual(claimed.UserAchievement,[completedMission]);assert.deepEqual(claimed.receivedItems,[]);
    assert.equal(app.store.hardCurrency(),irisBefore+reward.rewardAmount);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),nativeBefore,'6000 does not prewrite native flags or grades');
    assert.deepEqual(parse(await send('achievement/complete',claim)).operations,[claimOp]);
    const floor=app.store.db.prepare('SELECT * FROM war_game_record WHERE pvp_id=?').get(id);
    app.store.db.prepare('DELETE FROM war_game_record WHERE pvp_id=?').run(id);
    await reject('achievement/complete',claim);
    const unavailable=snapshot(),cached=await request(port,claimSeq,claim,String(claimSeq),'achievement/complete');
    assert.equal(cached.status,503);assert.equal(snapshot(),unavailable,'Cached6000 cannot bypass missing acknowledged grade history');
    assert.equal((await push({UserAchievement:[{...completedMission,state:4}]},[claimOp])).status,503);
    assert.equal(snapshot(),unavailable,'Save/ACK cannot bypass missing grade history');
    app.store.db.prepare('INSERT INTO war_game_record(pvp_id,battle_id,record_json,attempt_count,counts_hash) VALUES(?,?,?,?,?)')
      .run(floor.pvp_id,floor.battle_id,floor.record_json,floor.attempt_count,floor.counts_hash);
    const noFlags=snapshot();assert.equal((await push({},[claimOp])).status,400);assert.equal(snapshot(),noFlags);
    parse(await push({UserAchievement:[{...completedMission,state:4}]}));await close();await open();
    await reject('achievement/complete',claim);assert.equal(app.store.hardCurrency(),irisBefore+reward.rewardAmount);
    parse(await push({},[claimOp]));await close();await open();assert.deepEqual(app.store.operations(),[]);
    app.store.db.exec('DELETE FROM reply_cache');await reject('achievement/complete',claim,400);
    now+=1;const repeated={...completedMission,completedAt:now};parse(await push({UserAchievement:[repeated]}));
    await reject('achievement/complete',claimBody([repeated]),400);
    assert.equal(app.store.hardCurrency(),irisBefore+reward.rewardAmount,'Non-resetting mission ID earns once, even with a changed completion date');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM achievement_claim WHERE achievement_id=?').get(missionId).n,1);
    for(const [table,field,bad] of [['war_game_record','record_json','[]'],['war_game_record','counts_hash','missing'],['war_game_usage','count',99]]) {
      const row=app.store.db.prepare(`SELECT * FROM ${table} LIMIT 1`).get();
      app.store.db.prepare(`UPDATE ${table} SET ${field}=?`).run(bad);
      await reject('pvp/character/ranking/get',{pvpId:id});
      if(table==='war_game_record') app.store.db.prepare(`UPDATE ${table} SET ${field}=?`).run(row[field]);
      else for(const old of counts) app.store.db.prepare('UPDATE war_game_usage SET count=7 WHERE pvp_id=? AND kind=? AND pc_id=?')
        .run(old.pvp_id,old.kind,old.pc_id);
    }
    //Baseline ordinary-grade season Presents, not global ranking, bonus-pass
    //eligibility, original producer timing or native JSON/MessagePack acceptance.
    assert.deepEqual(app.store.warGame.prize(earned.gradeId).row.rewards,[{itemId:205000001,amount:25}]);
    assert.throws(()=>app.store.warGame.prize(13001380019),/earned rank/);
    assert.throws(()=>app.store.warGame.prize(13001380020),/earned rank/);
    assert.deepEqual(app.store.warGame.prize(13001380019,2).row,master.warGameSeasonRewards[13001380019]);
    assert.deepEqual(app.store.warGame.prize(13001380020,1).row,master.warGameSeasonRewards[13001380020]);
    assert.throws(()=>app.store.warGame.prize(13001380019,1),/earned rank/);
    assert.throws(()=>app.store.warGame.prize(13001380020,2),/earned rank/);
    now=window.endAt-1;
    const nativePull={tables:['UserGift','UserPvPRecord']},priorPull=await send('user_data/pull',nativePull),pullSeq=sequence;
    assert.equal(priorPull.status,200);assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM war_game_reward').get().n,0);
    parse(await send('user_data/confirm',undefined));const confirmSeq=sequence;
    const priorPresents=app.store.read('UserGift').data,irisAtEnd=app.store.hardCurrency();now=window.endAt;
    for(const [table,event] of [['war_game_reward','INSERT'],['war_game_gift','INSERT'],['profile','UPDATE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_season_reward BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'season reward rollback'); END`);
      await reject('user_data/confirm',undefined,503,false);assert.equal(app.store.hardCurrency(),irisAtEnd);
      app.store.db.exec('DROP TRIGGER fail_season_reward');
    }
    parse(await send('user_data/confirm',undefined));
    const seasonReward=app.store.warGame.rewardReceipt(id),published=app.store.read('UserPvPRecord').data[0];
    assert.deepEqual(seasonReward.before,earned);assert.deepEqual(published,{...earned,isAggregate:true,isReceiveReward:true});
    assert.equal(published.rank,earned.rank,'No fake rank1 or ranked-tier promotion');
    assert.equal(published.gradeId,earned.gradeId,'Final current grade, not the higher historical mission grade');
    assert.equal(seasonReward.gifts.length,1);assert.equal(seasonReward.gifts[0].amount,25);
    assert.equal(seasonReward.gifts[0].startAt,window.endAt);assert.equal(seasonReward.gifts[0].expireAt,0);
    assert.equal(app.store.hardCurrency(),irisAtEnd,'Producing a Present is not spending/claiming its Iris');
    assert.deepEqual(app.store.read('UserGift').data,[...priorPresents,...seasonReward.gifts]);
    parse(await send('pvp/summary/get',{pvpId:id}));await close();await open();parse(await send('user_data/confirm',undefined));
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM war_game_reward').get().n,1);
    const stale=snapshot();assert.equal((await request(port,pullSeq,nativePull,String(pullSeq),'user_data/pull')).status,503);
    assert.equal(snapshot(),stale,'Cached binary pull cannot erase produced Presents/publication flags');
    assert.equal((await request(port,confirmSeq,undefined,String(confirmSeq),'user_data/confirm')).status,503);
    assert.equal(snapshot(),stale,'Cached confirmation cannot hide changed gift/record tokens');
    const oldFlags=snapshot();assert.equal((await push({UserPvPRecord:[earned]})).status,400);assert.equal(snapshot(),oldFlags);
    for(const item of [{...seasonReward.gifts[0],amount:26},{...seasonReward.gifts[0],userId:2}]) {
      const before=snapshot();assert.equal((await push({UserGift:[item]})).status,400);assert.equal(snapshot(),before);
    }
    for(const [field,bad] of [['catalog_hash','missing'],['record_json','{}'],['gifts_json','[]'],['gifts_json','[null]']]) {
      const original=app.store.db.prepare('SELECT * FROM war_game_reward WHERE pvp_id=?').get(id);
      app.store.db.prepare(`UPDATE war_game_reward SET ${field}=? WHERE pvp_id=?`).run(bad,id);
      await reject('user_data/confirm',undefined);
      app.store.db.prepare(`UPDATE war_game_reward SET ${field}=? WHERE pvp_id=?`).run(original[field],id);
    }
    now=reward.startAt+3600;await reject(start,{pvpId:id});now=window.endAt+1;
    const receive={giftIds:seasonReward.gifts.map(gift=>gift.id),userId:seed.userId},received=parse(await send('gift/receive',receive)),giftOp=received.operations[0];
    assert.equal(giftOp.type,2000);assert.deepEqual(giftOp.parameters.UserGift,seasonReward.gifts);
    assert.equal(app.store.hardCurrency(),irisAtEnd+25);
    const missingFlag=snapshot();assert.equal((await push({},[giftOp])).status,400);assert.equal(snapshot(),missingFlag);
    parse(await push({UserGift:seasonReward.gifts.map(gift=>({...gift,state:1}))}));await close();await open();
    await reject('gift/receive',receive);assert.equal(app.store.hardCurrency(),irisAtEnd+25);
    parse(await push({},[giftOp]));await close();await open();parse(await send('user_data/confirm',undefined));
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM war_game_reward').get().n,1);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM gift_claim WHERE gift_id=?').get(seasonReward.gifts[0].id).n,1);
    const restored=snapshot();assert.equal((await push({UserGift:seasonReward.gifts})).status,400);assert.equal(snapshot(),restored);
    assert.equal(app.store.hardCurrency(),irisAtEnd+25,'Restart/clock/replayed publication cannot mint another grade prize');
    //WRITTEN ONLY: a new zero-origin local season earns rank1 through actual
    //source-handler wins, not a manually injected score/rank/native record.
    await close();file+=1;sequence=0;now=1660950000;await open();setup();
    const rankedCatalog=hash([hash(master.pvp),'offline-single-participant-war-game-v3']),
      rankedFinishCatalog=hash([rankedCatalog,'offline-mirror-elo32-local-rank-grades-v3']),
      heroGrade=master.pvp.grades[13001380020],rankedWallet=[app.store.hardCurrency(),app.store.paidCurrency()];
    let heroBattle,heroEnd;
    for(let index=0;index<Math.ceil((heroGrade.scoreBorder-1000)/16);index++) {
      now+=1800;
      const next=parse(await send(start,{pvpId:id})),nextInfo=structuredClone(app.store.read('UserInfo').data),
        beforeNative=app.store.read('UserPvPRecord').data;
      assert.equal(app.store.warGame.active().catalog_hash,rankedCatalog);
      Object.assign(nextInfo[0].playerStatus,pvpStamina(nextInfo[0].playerStatus,now));
      if(nextInfo[0].playerStatus.pvpSP>=10) nextInfo[0].playerStatus.pvpSPUpdatedAt=now;
      nextInfo[0].playerStatus.pvpSP-=1;nextInfo[0].processingPvPState=1;
      parse(await push({UserInfo:nextInfo,UserPvPRecord:next.pvpRecord}));
      const body={...verdict,battleId:next.battleId};
      if(index===0) for(const [table,event] of [['operation_queue','INSERT'],['war_game_end','INSERT'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_ranked_issue BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'local rank issue rollback'); END`);
        await reject(end,body,503,false);app.store.db.exec('DROP TRIGGER fail_ranked_issue');
      }
      const finished=parse(await send(end,body));
      assert.equal(app.store.warGame.finish(next.battleId).catalog_hash,rankedFinishCatalog);
      assert.equal(finished.pvpRecord[0].rank,1);
      assert.equal(finished.pvpRecord[0].gradeId,warGameGrade(id,finished.pvpRecord[0].score,master,1));
      assert.deepEqual(app.store.read('UserPvPRecord').data,next.pvpRecord,'An issued14000 does not prewrite its local rank');
      if(index===0) {
        assert.ok(!beforeNative.length || beforeNative[0].rank===0);
        const before=snapshot();assert.equal((await push({UserPvPRecord:finished.pvpRecord.map(row=>({...row,rank:0}))})).status,400);
        assert.equal(snapshot(),before);
        await close();await open();assert.equal(app.store.warGame.finish(next.battleId).target.rank,1);
      }
      nextInfo[0].processingPvPState=0;
      if(finished.pvpRecord[0].gradeId===13001380020) {
        heroBattle=next;heroEnd=finished;
        const rankedMission=Object.entries(master.warGameAchievements).find(([,row])=>row.pvpId===id && row.gradeId===13001380020);
        if(rankedMission) {
          const queuedMission=missionRow(Number(rankedMission[0]),now),prior=app.store.read('UserAchievement').data;
          put('UserAchievement',[queuedMission]);await reject('achievement/complete',claimBody([queuedMission]),400);
          put('UserAchievement',prior);
        }
      }
      parse(await push({UserInfo:nextInfo,UserPvPRecord:finished.pvpRecord},[finished.operation]));
      assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],rankedWallet);
    }
    assert.ok(heroBattle && heroEnd);assert.equal(heroEnd.pvpRecord[0].highestGradeId,13001380020);
    const finalNative=app.store.read('UserPvPRecord').data,rankedMission=Object.entries(master.warGameAchievements)
      .find(([,row])=>row.pvpId===id && row.gradeId===13001380020);
    if(rankedMission) app.store.warGame.claimAchievement(missionRow(Number(rankedMission[0]),now));
    await close();await open();assert.deepEqual(app.store.read('UserPvPRecord').data,finalNative);
    now=window.endAt-1;parse(await send('user_data/confirm',undefined));
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM war_game_reward').get().n,0);
    now=window.endAt;
    for(const [table,event] of [['war_game_reward','INSERT'],['war_game_gift','INSERT'],['profile','UPDATE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_ranked_reward BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'local ranked reward rollback'); END`);
      await reject('user_data/confirm',undefined,503,false);app.store.db.exec('DROP TRIGGER fail_ranked_reward');
    }
    parse(await send('user_data/confirm',undefined));
    const rankedReward=app.store.warGame.rewardReceipt(id);
    assert.equal(rankedReward.battle_id,heroBattle.battleId);assert.deepEqual(rankedReward.before,heroEnd.pvpRecord[0]);
    assert.deepEqual(rankedReward.gifts.map(({itemId,amount})=>({itemId,amount})),master.warGameSeasonRewards[13001380020].rewards);
    assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],rankedWallet,'Ranked rewards are Presents, not inventory precredit');
    const rankedSummary=parse(await send('pvp/summary/get',{pvpId:id}));
    assert.equal(rankedSummary.pvpRanking[0].rank,1);assert.equal(rankedSummary.pvpRanking[0].gradeId,13001380020);
    await close();await open();parse(await send('user_data/confirm',undefined));
    assert.deepEqual(app.store.warGame.rewardReceipt(id).gifts,rankedReward.gifts);
    now=window.startAt;await reject(start,{pvpId:id});
    assert.deepEqual(app.store.warGame.rewardReceipt(id).gifts,rankedReward.gifts);
    now=window.endAt+1;
    const heroItemId=99000001,heroItemProfile=master.itemProfiles[heroItemId],heroItems=app.store.read(heroItemProfile.table).data,
      priorHeroItem=heroItems.find(row=>row[heroItemProfile.idField]===heroItemId),
      rankedReceive={userId:seed.userId,giftIds:rankedReward.gifts.map(gift=>gift.id)},
      rankedClaim=parse(await send('gift/receive',rankedReceive)),rankedGiftOp=rankedClaim.operations[0];
    assert.equal(rankedGiftOp.type,2000);assert.deepEqual(rankedGiftOp.parameters.UserGift,rankedReward.gifts);
    assert.equal(app.store.hardCurrency(),rankedWallet[0]+1000);
    assert.deepEqual(app.store.read(heroItemProfile.table).data,heroItems,'Hero item remains native-owned until its actual save');
    const beforeMissingItems=snapshot();assert.equal((await push({},[rankedGiftOp])).status,400);
    assert.equal(snapshot(),beforeMissingItems);
    parse(await push({UserGift:rankedReward.gifts.map(gift=>({...gift,state:1}))}));
    await close();await open();
    const flagsWithoutItems=snapshot();assert.equal((await push({},[rankedGiftOp])).status,400);
    assert.equal(snapshot(),flagsWithoutItems);
    const acquiredHeroItem={...(priorHeroItem ?? {userId:seed.userId,[heroItemProfile.idField]:heroItemId,signature:0}),
      amount:(priorHeroItem?.amount ?? 0)+15,cumulativeAmount:(priorHeroItem?.cumulativeAmount ?? 0)+15,bookEntryState:3};
    parse(await push({[heroItemProfile.table]:[acquiredHeroItem]}));await close();await open();
    app.store.db.exec("CREATE TRIGGER fail_ranked_gift_ack BEFORE INSERT ON operation_done BEGIN SELECT RAISE(ABORT,'ranked gift ack rollback'); END");
    const beforeGiftAck=snapshot();assert.equal((await push({},[rankedGiftOp])).status,503);assert.equal(snapshot(),beforeGiftAck);
    app.store.db.exec('DROP TRIGGER fail_ranked_gift_ack');parse(await push({},[rankedGiftOp]));
    await close();await open();await reject('gift/receive',rankedReceive);
    assert.equal(app.store.hardCurrency(),rankedWallet[0]+1000);
    assert.deepEqual(app.store.read(heroItemProfile.table).data.find(row=>row[heroItemProfile.idField]===heroItemId),acquiredHeroItem);
    assert.equal(app.store.warGame.rewardReceipt(id).catalog_hash,rankedReward.catalog_hash);
    //Imported noninitial progress is retained, not assigned ranked provenance.
    await close();file+=1;sequence=0;now=1660950000;await open();setup();
    const imported={...heroEnd.pvpRecord[0],rank:0,score:3600,gradeId:13001380018,highestGradeId:0,
      winCount:0,loseCount:0,consecutiveWinCount:0};
    put('UserPvPRecord',[imported]);const importedStart=parse(await send(start,{pvpId:id}));
    assert.equal(app.store.warGame.active().catalog_hash,hash(master.pvp));assert.deepEqual(importedStart.pvpRecord,[imported]);
    console.log('War Game deferred source cases passed; publisher peers/premium bonus/native acceptance still required');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}

if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
