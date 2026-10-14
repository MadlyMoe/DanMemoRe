'use strict';

//SOURCE ONLY. Native start/resume/14000 settlement; native tests deferred.
//Explicit offline mirror CPU/initial1000/Elo32 policy, not publisher rules.
const crypto=require('node:crypto');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const equal=require('node:util').isDeepStrictEqual;
const long=n=>Number.isSafeInteger(n) && n>=0;
const int=n=>long(n) && n<=0x7fffffff;
const keys=(row,list)=>row && !Array.isArray(row) && Object.keys(row).sort().join(',')===[...list].sort().join(',');
const need=(ok,message)=>{if(!ok) throw Object.assign(new Error(message),{status:503,offlineUnavailable:true});};
const input=(ok,message)=>{if(!ok) throw Object.assign(new Error(message),{status:400});};
const start='pvp/battle/start',restart='pvp/battle/restart',end='pvp/battle/end';

function warGameGrade(id,score,master,rank=0) {
  need(master?.pvp?.grades && typeof master.pvp.grades==='object' && !Array.isArray(master.pvp.grades),
    'Original War Game grade borders are unavailable');
  const grades=Object.entries(master.pvp.grades).filter(([,row])=>row.groupId===id)
    .map(([id,row])=>({id:Number(id),...row})).sort((a,b)=>a.order-b.order);
  need(int(score) && int(rank) && grades.length && grades[0].order===0 &&
    new Set(grades.map(row=>row.order)).size===grades.length && grades.every(row=>long(row.id) && row.id>0 &&
      ['order','scoreBorder','minRank','maxRank'].every(key=>int(row[key])) && row.minRank<=row.maxRank &&
      Boolean(row.minRank)===Boolean(row.maxRank)), 'Original War Game grade borders/rank ranges are unavailable');
  const ordinary=grades.filter(row=>row.minRank===0 && row.maxRank===0);
  need(ordinary.length && ordinary[0].order===0 && ordinary.every((row,index)=>!index ||
    row.scoreBorder>ordinary[index-1].scoreBorder),'Original War Game ordinary grade borders are ambiguous');
  const ranked=grades.filter(row=>row.minRank>0);
  need(ranked.every((row,i)=>ranked.slice(i+1).every(other=>row.maxRank<other.minRank || other.maxRank<row.minRank)),
    'Original War Game ranked grade ranges are ambiguous');
  //shortcut: original borders with an explicit solo-local rank, not publisher population ranking; peers come last.
  return grades.filter(row=>row.scoreBorder<=score && (!row.minRank || rank>=row.minRank && rank<=row.maxRank))
    .at(-1)?.id ?? ordinary[0].id;
}

function warGameFinish(battle,value,master,progression=true,rank=null) {
  input(keys(value,['pvpId','battleId','result']) && value.pvpId===battle.pvp_id && value.battleId===battle.battle_id &&
    keys(value.result,['isWin','isRetire','survivedPCs','spendTurns','maxDamage']) &&
    typeof value.result.isWin==='boolean' && typeof value.result.isRetire==='boolean' &&
    int(value.result.survivedPCs) && value.result.survivedPCs<=battle.own.slots.filter(row=>row.pc.pcId).length &&
    int(value.result.spendTurns) && long(value.result.maxDamage) &&
    (!value.result.isWin || !value.result.isRetire && value.result.survivedPCs>0),'Invalid captured War Game verdict');
  const before=battle.target,oldGrade=master.pvp.grades[before.gradeId],highest=master.pvp.grades[before.highestGradeId];
  need(oldGrade?.groupId===battle.pvp_id && int(oldGrade.order) && (!before.highestGradeId || highest && int(highest.order)),
    'War Game finish original grade identity unavailable');
  //ponytail: disclosed offline Elo K32 against an equal-score mirror, +/-16,
  //floor0. Only a separately captured local-standing policy supplies rank.
  need(rank===null || progression && int(rank) && rank>0,'War Game finish local rank is invalid');
  const isWin=value.result.isWin,score=Math.max(0,before.score+(isWin?16:-16));
  need(int(score),'Offline War Game score exceeds native int32 precision');
  const gradeId=progression?warGameGrade(battle.pvp_id,score,master,rank ?? 0):before.gradeId,grade=master.pvp.grades[gradeId],
    reachedId=oldGrade.order>grade.order?before.gradeId:gradeId,reached=master.pvp.grades[reachedId],
    record={...before,score,gradeId,rank:rank ?? before.rank,
    winCount:before.winCount+Number(isWin),loseCount:before.loseCount+Number(!isWin),
    consecutiveWinCount:isWin?before.consecutiveWinCount+1:0,
    highestGradeId:!highest || highest.order<reached.order?reachedId:before.highestGradeId};
  need(['score','winCount','loseCount','consecutiveWinCount'].every(key=>int(record[key])),
    'Offline War Game score/counters exceed native int32 precision');
  //213f9b4 updates consecutiveWinCount, NOT consecutiveLoseCount/history.
  //Preserve fields that this real native callback does not write.
  return {code:0,pvpRecord:[record],pvpResult:{pvpId:battle.pvp_id,isWin,score,
    scoreDifference:score-before.score,gradeId:record.gradeId}};
}

function warGameEntry(status,at,project) {
  const baseline={pvpSP:status.pvpSP,pvpSPUpdatedAt:status.pvpSPUpdatedAt},
    projections=[at-5,at,at+120].filter(long).map(time=>project(status,time));
  //2140078 passes1 to25410ec/2544958 BEFORE emitting PvPStartEvent.
  //The request can straddle one getter boundary; reuse the receipt's bounded
  //clock window. Below10 preserves that projection; >=10 resets on consume.
  const candidates=[baseline,...projections].filter((row,i,all)=>row.pvpSP>0 && all.findIndex(other=>equal(other,row))===i)
    .map(before=>({before,after:{pvpSP:before.pvpSP-1,pvpSPUpdatedAt:before.pvpSP>=10?at:before.pvpSPUpdatedAt}}));
  need(candidates.length,'War Game entry requires a native stamina attempt');
  return {baseline,candidates};
}

function openWarGame({db,read,now,master,userId,season,party,validateParty,project,operations,issueOperation,available,createGifts,sameGift}) {
  const catalog=hash(master?.pvp ?? null),legacyCatalog=hash(master?.pvp?{...master.pvp,
    grades:Object.fromEntries(Object.entries(master.pvp.grades).map(([id,{groupId,key,name,art,order}])=>
      [id,{groupId,key,name,art,order}]))}:null),ordinaryFinishCatalog=hash([catalog,'offline-mirror-elo32-grades-v2']),
    rankedCatalog=hash([catalog,'offline-single-participant-war-game-v3']),
    finishCatalog=hash([rankedCatalog,'offline-mirror-elo32-local-rank-grades-v3']),
    legacyFinishCatalog=hash([legacyCatalog,'offline-mirror-elo32-v1']),actions=new Set([start,restart,end]),sensitive=new Set([
    'UserInfo','UserPvPRecord','UserPvPParty','UserParty','UserPC']);
  db.exec(`CREATE TABLE IF NOT EXISTS war_game_battle(battle_id TEXT PRIMARY KEY,pvp_id INTEGER NOT NULL,
    issued_at INTEGER NOT NULL,catalog_hash TEXT NOT NULL,before_json TEXT NOT NULL,own_json TEXT NOT NULL,
    response_json TEXT NOT NULL,observed_json TEXT NOT NULL,sp_saved_json TEXT,sp_current_json TEXT,
    closed INTEGER NOT NULL DEFAULT 0 CHECK(closed IN(0,1)));
    CREATE UNIQUE INDEX IF NOT EXISTS war_game_one_active ON war_game_battle(closed) WHERE closed=0;
    CREATE TABLE IF NOT EXISTS war_game_request(request_key TEXT PRIMARY KEY,action TEXT NOT NULL,
      body_hash TEXT NOT NULL,battle_id TEXT NOT NULL,response_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS war_game_end(battle_id TEXT PRIMARY KEY,operation_id INTEGER NOT NULL UNIQUE,
      issued_at INTEGER NOT NULL,catalog_hash TEXT NOT NULL,verdict_json TEXT NOT NULL,response_json TEXT NOT NULL,
      operation_json TEXT NOT NULL,record_saved INTEGER NOT NULL DEFAULT 0 CHECK(record_saved IN(0,1)),
      processing_saved INTEGER NOT NULL DEFAULT 0 CHECK(processing_saved IN(0,1)));
    CREATE TABLE IF NOT EXISTS war_game_record(pvp_id INTEGER PRIMARY KEY,battle_id TEXT NOT NULL UNIQUE,record_json TEXT NOT NULL,
      attempt_count INTEGER,counts_hash TEXT);
    CREATE TABLE IF NOT EXISTS war_game_usage(pvp_id INTEGER NOT NULL,kind INTEGER NOT NULL,pc_id INTEGER NOT NULL,
      count INTEGER NOT NULL,PRIMARY KEY(pvp_id,kind,pc_id));
    CREATE TABLE IF NOT EXISTS war_game_reward(pvp_id INTEGER PRIMARY KEY,battle_id TEXT NOT NULL UNIQUE,
      issued_at INTEGER NOT NULL,catalog_hash TEXT NOT NULL,record_json TEXT NOT NULL,gifts_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS war_game_gift(gift_id INTEGER PRIMARY KEY,pvp_id INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS war_game_gift_season ON war_game_gift(pvp_id);`);
  if(!db.prepare('PRAGMA table_info(war_game_battle)').all().some(row=>row.name==='sp_current_json'))
    db.exec('ALTER TABLE war_game_battle ADD COLUMN sp_current_json TEXT');
  for(const [column,type] of [['attempt_count','INTEGER'],['counts_hash','TEXT']])
    if(!db.prepare('PRAGMA table_info(war_game_record)').all().some(row=>row.name===column))
      db.exec(`ALTER TABLE war_game_record ADD COLUMN ${column} ${type}`);
  const info=working=>{
    const rows=working?.get('UserInfo') ?? read('UserInfo').data,row=Array.isArray(rows)?rows[0]:null;
    need(Array.isArray(rows) && rows.length===1 && row?.userId===userId && int(row.processingPvPState) && typeof row.processingPvP==='boolean' &&
      long(row.activePvPPartyId) && row.activePvPPartyId>0 && int(row.playerStatus?.totalExp),
      'War Game requires one owned processing/party/EXP profile');
    project(row.playerStatus,now());return row;
  };
  const sp=row=>({pvpSP:row.playerStatus.pvpSP,pvpSPUpdatedAt:row.playerStatus.pvpSPUpdatedAt});
  const record=(id,working)=>(working?.get('UserPvPRecord') ?? read('UserPvPRecord').data).find(row=>row.pvpId===id) ?? null;
  const bootstrap=(id,before)=>{
    if(before?.gradeId) return before;
    const grades=Object.entries(master.pvp.grades).filter(([,row])=>row.groupId===id && row.order===0);
    need(grades.length===1 && (!before || before.score===0 && before.winCount===0 && before.loseCount===0),
      'War Game initial original grade or untouched season is unavailable');
    //ponytail: explicit offline starting score1000 (native absent-lobby display),
    //original order0 grade; replace only if publisher bootstrap evidence exists.
    return {...(before ?? {userId,pvpId:id,rank:0,winCount:0,loseCount:0,consecutiveWinCount:0,
      consecutiveLoseCount:0,lastAdversaryIds:[],lastBattleId:'',isReceiveReward:false,isAggregate:false,highestGradeId:0}),
      gradeId:Number(grades[0][0]),score:1000};
  };
  const response=(id,battleId,randomSeed,own,target,totalExp)=>{
    //Private CPU identity, frozen real native vectors; no synthesized PC stats.
    const cpuId=9000000000000+id;
    need(long(cpuId) && cpuId!==userId && own.slots?.[0]?.pc?.pcId>0,'Offline War Game CPU identity/leader is invalid');
    return {code:0,battleId,randomSeed,pvpPlayerInfo:{userId:cpuId,name:'[Offline CPU] Mirror team',
      totalExp,gradeId:target.gradeId,score:target.score,friendRelationShip:0},
      pvpParty:{...own,userId:cpuId},pvpRecord:[target],substitutedSpineIds:[]};
  };
  const receipt=id=>{
    const saved=db.prepare('SELECT * FROM war_game_battle WHERE battle_id=?').get(id);
    need(saved && [rankedCatalog,catalog,legacyCatalog].includes(saved.catalog_hash) && long(saved.issued_at) && [0,1].includes(saved.closed) &&
      long(saved.pvp_id) && master?.pvp?.information?.[saved.pvp_id],
      'War Game battle/captured original catalog is unavailable');
    let before,own,result,observed,savedSp,currentSp,recoveryBefore=null,recoveredAt=null,stockFirst=false;
    try {before=JSON.parse(saved.before_json);own=JSON.parse(saved.own_json);result=JSON.parse(saved.response_json);
      observed=JSON.parse(saved.observed_json);savedSp=saved.sp_saved_json===null?null:JSON.parse(saved.sp_saved_json);
      currentSp=saved.sp_current_json===null?savedSp:JSON.parse(saved.sp_current_json);
      stockFirst=keys(currentSp,['sp','recoveryBefore','recoveredAt']);
      if(stockFirst) {recoveryBefore=currentSp.recoveryBefore;recoveredAt=currentSp.recoveredAt;currentSp=currentSp.sp;}}
    catch {need(false,'War Game battle capture is unreadable');}
    need(keys(before,['sp','record','processing','oldProcessing','partyId','totalExp']) &&
      keys(result,['code','battleId','randomSeed','pvpPlayerInfo','pvpParty','pvpRecord','substitutedSpineIds']) && result.code===0 &&
      keys(own,['userId','slots','attackPattern','memoriaSlots']) && own.userId===userId && int(before.processing) &&
      before.processing===0 && typeof before.oldProcessing==='boolean' && before.oldProcessing===false &&
      long(before.partyId) && int(before.totalExp) && keys(before.sp,['pvpSP','pvpSPUpdatedAt']) &&
      typeof result.battleId==='string' && result.battleId===saved.battle_id && long(result.randomSeed) && result.randomSeed>0,
      'War Game start has lost its native baseline/identity');
    try {validateParty(own);} catch {need(false,'Captured War Game native party vectors are invalid');}
    season(saved.pvp_id);
    const target=bootstrap(saved.pvp_id,before.record),entry=warGameEntry(before.sp,saved.issued_at,project);
    need(equal(result,response(saved.pvp_id,saved.battle_id,result.randomSeed,own,target,before.totalExp)) &&
      Array.isArray(observed) && equal(observed,[...new Set(observed)].sort()) &&
      observed.every(key=>['processing','record','sp'].includes(key)) && Boolean(savedSp)===observed.includes('sp'),
      'War Game response/save checkpoints differ from the captured start');
    if(savedSp) need(entryMatches(entry,savedSp,saved.issued_at),'War Game saved entry debit/timer is inconsistent');
    need(!stockFirst || Boolean(savedSp) && keys(recoveryBefore,['pvpSP','pvpSPUpdatedAt']) && long(recoveredAt) && long(recoveredAt+5),
      'War Game stock-first recovery has lost its paid entry/complete before-state');
    const passiveBase=recoveryBefore ?? currentSp;
    need(savedSp ? keys(currentSp,['pvpSP','pvpSPUpdatedAt']) && equal(passiveBase,project(savedSp,passiveBase.pvpSPUpdatedAt)) &&
      (!stockFirst || int(currentSp.pvpSP) && currentSp.pvpSP>recoveryBefore.pvpSP && currentSp.pvpSP<=10 &&
        currentSp.pvpSPUpdatedAt===recoveryBefore.pvpSPUpdatedAt && currentSp.pvpSP<=project(recoveryBefore,recoveredAt+5).pvpSP) :
      currentSp===null || entryBeforeMatches(entry,currentSp,saved.issued_at),
      'War Game stamina checkpoint differs from its captured entry');
    return {...saved,before,own,result,target,entry,observed,savedSp,currentSp,recoveryBefore,recoveredAt};
  };
  function entryBeforeMatches(entry,before,at,previous=null) {
    return keys(before,['pvpSP','pvpSPUpdatedAt']) && int(before.pvpSP) && long(before.pvpSPUpdatedAt) &&
      (equal(before,previous ?? entry.baseline) || entry.candidates.some(row=>{
        //25444d0 writes the recovered stock before the whole-interval timestamp.
        const stockOnly={pvpSP:row.before.pvpSP,pvpSPUpdatedAt:entry.baseline.pvpSPUpdatedAt};
        return (!previous || equal(previous,row.before) || equal(previous,stockOnly)) &&
          (equal(before,stockOnly) && (!previous || equal(previous,stockOnly)) || before.pvpSP===row.before.pvpSP &&
            (before.pvpSPUpdatedAt===row.before.pvpSPUpdatedAt || row.before.pvpSP>=10 &&
              before.pvpSPUpdatedAt>=at-5 && before.pvpSPUpdatedAt<=at+120));
      }));
  }
  function entryMatches(entry,after,at,previous=null) {
    return keys(after,['pvpSP','pvpSPUpdatedAt']) && int(after.pvpSP) && long(after.pvpSPUpdatedAt) &&
      entry.candidates.some(row=>after.pvpSP===row.after.pvpSP && (!previous || equal(previous,row.before) ||
        equal(previous,{pvpSP:row.before.pvpSP,pvpSPUpdatedAt:entry.baseline.pvpSPUpdatedAt}) ||
        after.pvpSP===previous.pvpSP-1 && after.pvpSPUpdatedAt===previous.pvpSPUpdatedAt) && (row.before.pvpSP>=10 ?
        after.pvpSPUpdatedAt>=at-5 && after.pvpSPUpdatedAt<=at+120:after.pvpSPUpdatedAt===row.after.pvpSPUpdatedAt));
  }
  function passivePlan(battle,after) {
    const currentSp=battle.currentSp;
    if(equal(after,currentSp)) return {currentSp:after,recoveryBefore:battle.recoveryBefore,recoveredAt:battle.recoveredAt};
    const at=now();
    if(after.pvpSPUpdatedAt>Math.max(at,battle.recoveredAt ?? at)+5) return null;
    //25444d0's unfinished stock setter must complete its own timer, not recover twice.
    if(battle.recoveryBefore) return after.pvpSP===currentSp.pvpSP && equal(after,project(battle.recoveryBefore,after.pvpSPUpdatedAt))
      ?{currentSp:after,recoveryBefore:null,recoveredAt:null}:null;
    if(equal(after,project(currentSp,after.pvpSPUpdatedAt))) return {currentSp:after,recoveryBefore:null,recoveredAt:null};
    return after.pvpSPUpdatedAt===currentSp.pvpSPUpdatedAt && after.pvpSP>currentSp.pvpSP &&
      after.pvpSP<=project(currentSp,at+5).pvpSP?{currentSp:after,recoveryBefore:currentSp,recoveredAt:at}:null;
  }
  const active=()=>{
    const rows=db.prepare('SELECT battle_id FROM war_game_battle WHERE closed=0 LIMIT 2').all();
    need(rows.length<=1,'Multiple active War Game battles require reconciliation');
    return rows.length?receipt(rows[0].battle_id):null;
  };
  const finish=id=>{
    const saved=db.prepare('SELECT * FROM war_game_end WHERE battle_id=?').get(id);if(!saved) return null;
    need([finishCatalog,ordinaryFinishCatalog,legacyFinishCatalog].includes(saved.catalog_hash) && long(saved.issued_at) && saved.issued_at>0 &&
      long(saved.operation_id) && saved.operation_id>0 && [0,1].includes(saved.record_saved) && [0,1].includes(saved.processing_saved),
      'War Game finish capture identity/catalog is unavailable');
    const parent=receipt(id),ranked=parent.catalog_hash===rankedCatalog,progression=parent.catalog_hash!==legacyCatalog;
    need(complete(parent) && saved.catalog_hash===(ranked?finishCatalog:progression?ordinaryFinishCatalog:legacyFinishCatalog),
      'War Game finish lost its complete native entry/original scoring policy');
    let verdict,result,operation;
    try {verdict=JSON.parse(saved.verdict_json);result=JSON.parse(saved.response_json);operation=JSON.parse(saved.operation_json);}
    catch {need(false,'War Game finish capture is unreadable');}
    let expected;
    try {expected=warGameFinish(parent,verdict,master,progression,ranked?1:null);} catch {need(false,'War Game saved finish verdict is inconsistent');}
    need(equal(result,expected) && keys(operation,['id','type','parameters','token','signature']) &&
      operation.id===saved.operation_id && operation.type===14000 && equal(operation.parameters,result) &&
      typeof operation.token==='string' && /^[a-f0-9]{32}$/.test(operation.token) && int(operation.signature) && operation.signature>0,
      'War Game14000 differs from its captured verdict/record');
    const done=Boolean(db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id)),queued=operations().find(row=>row.id===operation.id);
    need(done ? !queued && parent.closed===1 && saved.record_saved===1 && saved.processing_saved===1 :
      parent.closed===0 && equal(queued,operation),'War Game finish queue/closed state differs from its save/ACK proof');
    return {...saved,parent,verdict,result,operation,done,target:result.pvpRecord[0]};
  };
  const records=(rows,status=503)=>{
    const pending=active(),settlement=pending?finish(pending.battle_id):null;
    for(const saved of db.prepare('SELECT * FROM war_game_record').all()) {
      const captured=finish(saved.battle_id),row=rows.find(row=>row.pvpId===saved.pvp_id);
      need(captured?.done && captured.parent.pvp_id===saved.pvp_id && saved.record_json===JSON.stringify(captured.target),
        'War Game record checkpoint lost its acknowledged capture');
      usageCheckpoint(saved);
      const reward=rewardReceipt(saved.pvp_id),baseline=reward?.target ?? captured.target,
        target=settlement?.parent.pvp_id===saved.pvp_id && (status===400 || settlement.record_saved)?settlement.target:baseline;
      if(!equal(row,target) && !(status===400 && equal(row,baseline))) {
        if(status===400) input(false,'Acknowledged War Game score/record cannot rewind or take an unissued award');
        need(false,'War Game record differs from its acknowledged native checkpoint');
      }
    }
  };
  const usageRows=id=>db.prepare('SELECT kind,pc_id,count FROM war_game_usage WHERE pvp_id=? ORDER BY kind,pc_id').all(id);
  const usageCheckpoint=saved=>{
    const rows=usageRows(saved.pvp_id);
    need(int(saved.attempt_count) && saved.attempt_count>0 && rows.length &&
      rows.every(row=>[0,1].includes(row.kind) && int(row.pc_id) && master.pcProfiles?.[row.pc_id] &&
        int(row.count) && row.count>0 && row.count<=saved.attempt_count) &&
      saved.counts_hash===hash([saved.pvp_id,saved.battle_id,saved.attempt_count,rows]),
      'War Game offline participation index differs from its acknowledged checkpoint');
    const last=receipt(saved.battle_id);
    need(['pc','assistingPc'].every((key,kind)=>last.own.slots.filter(row=>row[key].pcId)
      .every(slot=>rows.some(row=>row.kind===kind && row.pc_id===slot[key].pcId))),
      'War Game participation checkpoint lost its latest captured team');
    return rows;
  };
  const usage=id=>{
    season(id);
    const saved=db.prepare('SELECT * FROM war_game_record WHERE pvp_id=?').get(id);if(!saved) return null;
    const current=record(id),rows=usageCheckpoint(saved);
    need(!active() && current.winCount+current.loseCount===saved.attempt_count,
      'War Game usage requires fully acknowledged offline history, not imported publisher participation');
    //2141c44 consumes only rank/pcId. Counts stay private; all acknowledged
    //offline matches count once per distinct normal/assist, including losses.
    return Object.fromEntries(['normal','assist'].map((name,kind)=>[name,rows.filter(row=>row.kind===kind)
      .sort((a,b)=>b.count-a.count || a.pc_id-b.pc_id).map((row,index)=>({rank:index+1,pcId:row.pc_id}))]));
  };
  const claimAchievement=claim=>{
    need(master?.warGameAchievements && typeof master.warGameAchievements==='object' && !Array.isArray(master.warGameAchievements),
      'Original War Game mission condition inventory is unavailable');
    const original=master.warGameAchievements[claim.achievementId];if(!original) return;
    const grade=master.pvp?.grades?.[original.gradeId],mission=master.achievements?.[claim.achievementId];
    need(keys(original,['pvpId','gradeId','requiredParam','resetType']) && grade?.groupId===original.pvpId &&
      int(grade.order) && int(original.requiredParam) && original.requiredParam>0 && original.resetType===0 && mission?.category===3,
      'Original War Game mission grade/goal/non-resetting policy is unavailable');
    input(claim.userId===userId && claim.state===3 && claim.progressParam===original.requiredParam,
      'War Game grade mission must save its native completed goal before claiming');
    //23582a0 returns false for original category3/reset0. Reuse the indexed
    //claim ID prefix: another completion date cannot mint this mission twice.
    const issued=db.prepare('SELECT completed_at FROM achievement_claim WHERE achievement_id=? LIMIT 2').all(claim.achievementId);
    input(issued.length<=1 && issued.every(row=>row.completed_at===claim.completedAt),
      'Non-resetting War Game grade reward was already issued for a different completion');
    const saved=db.prepare('SELECT * FROM war_game_record WHERE pvp_id=?').get(original.pvpId);
    need(saved,'War Game grade mission requires acknowledged local battle history, not imported claim flags');
    record(original.pvpId); //Shared read guard validates the retained native floor/index.
    const earned=finish(saved.battle_id),highest=master.pvp.grades[earned?.target.highestGradeId];
    need(earned?.done && earned.parent.pvp_id===original.pvpId,'War Game grade mission lost its acknowledged finish');
    input(highest?.groupId===grade.groupId && highest.order>=grade.order,
      'War Game grade mission is above the highest acknowledged original grade');
  };
  const prize=(id,rank=0)=>{
    const grade=master.pvp?.grades?.[id],row=master.warGameSeasonRewards?.[id];
    need(grade && int(rank) && int(grade.minRank) && int(grade.maxRank) &&
      (grade.minRank===0 && grade.maxRank===0 || grade.minRank>0 && rank>=grade.minRank && rank<=grade.maxRank) &&
      keys(row,['pvpId','rewards']) && row.pvpId===grade.groupId &&
      Array.isArray(row.rewards) && row.rewards.length>0 && row.rewards.length<=2 &&
      row.rewards.every(item=>
        keys(item,['itemId','amount']) && int(item.itemId) && item.itemId>0 && int(item.amount) && item.amount>0 &&
        master.itemProfiles?.[item.itemId]) && new Set(row.rewards.map(item=>item.itemId)).size===row.rewards.length,
      'Original War Game season prize or earned rank is unavailable');
    return {row,title:`[Offline War Game reward] ${row.pvpId} / ${grade.name}`,
      catalog:grade.minRank?hash([master.pvp.information[row.pvpId],grade,row,'offline-final-local-rank-grade-v2']):
        hash([master.pvp.information[row.pvpId],row,'offline-final-ordinary-grade-v1'])};
  };
  const rewardReceipt=id=>{
    const saved=db.prepare('SELECT * FROM war_game_reward WHERE pvp_id=?').get(id),
      pointers=db.prepare('SELECT gift_id FROM war_game_gift WHERE pvp_id=? ORDER BY gift_id').all(id);
    if(!saved) {need(!pointers.length,'War Game Presents lost their season receipt');return null;}
    const floor=db.prepare('SELECT * FROM war_game_record WHERE pvp_id=?').get(id),closed=finish(saved.battle_id),
      window=master.pvp.information[id];
    let before,gifts;
    try {before=JSON.parse(saved.record_json);gifts=JSON.parse(saved.gifts_json);} catch {need(false,'War Game season reward capture is unreadable');}
    need(closed?.done && floor?.battle_id===saved.battle_id && floor.record_json===JSON.stringify(closed.target) &&
      closed.parent.pvp_id===id && equal(before,closed.target) && before.isAggregate===false && before.isReceiveReward===false &&
      floor.attempt_count===before.winCount+before.loseCount && long(saved.issued_at) && saved.issued_at>=window.endAt,
      'War Game season prize requires its fully acknowledged local participation, not imported flags/scores');
    usageCheckpoint(floor);
    const original=prize(before.gradeId,closed.parent.catalog_hash===rankedCatalog?before.rank:0);
    need(original.row.pvpId===id && saved.catalog_hash===original.catalog && typeof sameGift==='function' &&
      Array.isArray(gifts) && gifts.length===original.row.rewards.length && pointers.length===gifts.length &&
      gifts.every((gift,i)=>gift && long(gift.id) && gift.id>0 && pointers[i].gift_id===gift.id && sameGift(gift,
        {userId,id:gift.id,...original.row.rewards[i],title:original.title,message:'',senderType:1,senderId:0,giftAcquiredType:8,
          itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,pcHeroSublimateCount:0,state:0,
          startAt:window.endAt,expireAt:0,createdAt:saved.issued_at,dynamodbExpireAt:0})),
      'War Game season Presents differ from their original grade prizes/captured identities');
    return {...saved,before,gifts,target:{...before,isAggregate:true,isReceiveReward:true}};
  };
  const guardGifts=(values=read('UserGift').data,status=503)=>{
    const check=status===400?input:need,prior=read('UserGift').data;
    need(Array.isArray(prior) && prior.every(gift=>gift && long(gift.id) && gift.id>0) &&
      new Set(prior.map(gift=>gift.id)).size===prior.length,'Saved War Game Present baseline is unavailable');
    check(Array.isArray(values) && values.every(gift=>gift && long(gift.id) && gift.id>0) &&
      new Set(values.map(gift=>gift.id)).size===values.length,'Duplicate/missing War Game Present identity');
    const owned=new Set(),actual=new Map(values.map(gift=>[gift.id,gift])),before=new Map(prior.map(gift=>[gift.id,gift]));
    const seasons=db.prepare('SELECT pvp_id FROM war_game_reward UNION SELECT pvp_id FROM war_game_gift').all();
    for(const {pvp_id:id} of seasons) for(const gift of rewardReceipt(id).gifts) {
      owned.add(gift.id);
      const current=actual.get(gift.id),claim=db.prepare('SELECT operation_id FROM gift_claim WHERE gift_id=?').get(gift.id);
      if(!claim) check(sameGift(current,gift),'Unclaimed War Game season Present cannot be removed or replaced');
      else {
        const queued=db.prepare('SELECT type,parameters FROM operation_queue WHERE id=?').get(claim.operation_id),
          done=Boolean(db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(claim.operation_id));
        let claimed;
        try {claimed=queued?JSON.parse(queued.parameters)?.UserGift:null;} catch {need(false,'War Game Present claim queue is unreadable');}
        need(Boolean(queued)!==done && (!queued || queued.type===2000 &&
          Array.isArray(claimed) && claimed.some(row=>sameGift(row,gift))),'War Game season Present lost its actual2000 claim/ACK');
        check(!current || [0,1].includes(current.state) && (!done || current.state===1) && sameGift({...current,state:0},gift),
          'Claimed War Game season Present cannot be changed or restored');
        check(current?.state!==0 || before.get(gift.id)?.state===0,'Observed War Game season Present cannot become unclaimed');
      }
    }
    for(const gift of values) if(typeof gift.title==='string' && gift.title.startsWith('[Offline War Game reward] '))
      need(owned.has(gift.id),'War Game season Present has lost its production receipt; retain for recovery');
  };
  const settleRewards=()=>{
    guardGifts();
    if(active()) return; //A late/other-season battle must finish/save/ACK first.
    const at=now();need(long(at),'War Game reward clock is invalid');
    //Only captured zero-origin local standings unlock ranked grades; legacy prizes retain their original policy.
    for(const floor of db.prepare('SELECT * FROM war_game_record ORDER BY pvp_id').all()) {
      if(rewardReceipt(floor.pvp_id)) continue;
      const window=master.pvp.information[floor.pvp_id];
      need(window && long(window.endAt),'Original War Game season end is unavailable');
      if(window.startAt>=window.endAt || at<window.endAt) continue;
      const closed=finish(floor.battle_id),values=read('UserPvPRecord').data,before=values.find(row=>row.pvpId===floor.pvp_id);
      need(closed?.done && equal(before,closed.target) && !before.isAggregate && !before.isReceiveReward &&
        floor.attempt_count===before.winCount+before.loseCount && info().processingPvPState===0,
        'War Game prize cannot reconstruct imported participation or an unfinished native season');
      const original=prize(before.gradeId,closed.parent.catalog_hash===rankedCatalog?before.rank:0);
      need(typeof createGifts==='function','War Game Presents provider is unavailable');
      const gifts=createGifts(original.row.rewards,original.title,8,at,window.endAt);
      db.prepare('INSERT INTO war_game_reward(pvp_id,battle_id,issued_at,catalog_hash,record_json,gifts_json) VALUES(?,?,?,?,?,?)')
        .run(floor.pvp_id,floor.battle_id,at,original.catalog,JSON.stringify(before),JSON.stringify(gifts));
      for(const gift of gifts) db.prepare('INSERT INTO war_game_gift(gift_id,pvp_id) VALUES(?,?)').run(gift.id,floor.pvp_id);
      //These are server-owned publication flags, not a native combat award or
      //inventory precredit.282f8b0/+1c8 is loaded only by full JSON/MessagePack.
      const target=rewardReceipt(floor.pvp_id).target,data=JSON.stringify(values.map(row=>row.pvpId===floor.pvp_id?target:row));
      need(db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(data,
        crypto.createHash('md5').update(data).digest('hex'),'UserPvPRecord').changes===1,'War Game publication lost its native profile');
      record(floor.pvp_id);guardGifts();
    }
  };
  const current=(battle,working)=>{
    const player=info(working),currentSp=sp(player),savedRecord=record(battle.pvp_id,working),settlement=finish(battle.battle_id);
    need(player.activePvPPartyId===battle.before.partyId && player.processingPvP===battle.before.oldProcessing &&
      equal(party(),battle.own),'War Game selected native party or processing baseline changed during combat');
    need(player.processingPvPState===(settlement?.processing_saved?0:battle.observed.includes('processing')?1:battle.before.processing) &&
      equal(currentSp,battle.currentSp ?? battle.before.sp) &&
      equal(savedRecord,settlement?.record_saved?settlement.target:battle.observed.includes('record')?battle.target:battle.before.record),
      'War Game native start state differs from its saved checkpoint');
    return player;
  };
  const complete=battle=>['processing','record','sp'].every(key=>battle.observed.includes(key));
  const localStanding=(id,target)=>{
    const floor=db.prepare('SELECT * FROM war_game_record WHERE pvp_id=?').get(id);
    if(floor) {
      usageCheckpoint(floor);
      return receipt(floor.battle_id).catalog_hash===rankedCatalog &&
        floor.attempt_count===target.winCount+target.loseCount;
    }
    //Do not reinterpret an imported score or upgrade old ordinary-only history without its zero-origin proof.
    return target.score===1000 && master.pvp.grades[target.gradeId]?.order===0 && target.rank===0 &&
      target.winCount===0 && target.loseCount===0 && target.consecutiveWinCount===0 && target.consecutiveLoseCount===0 &&
      target.highestGradeId===0 && target.lastBattleId==='' && target.lastAdversaryIds.length===0 &&
      target.isAggregate===false && target.isReceiveReward===false;
  };
  const checkRequest=(action,value)=>{
    input(actions.has(action) && keys(value,action===end?['pvpId','battleId','result']:['pvpId']) &&
      long(value.pvpId) && value.pvpId>0,'Invalid native War Game battle request');
    season(value.pvpId);
  };
  const endDelivery=settlement=>{
    current(settlement.parent);
    need(!settlement.done && !settlement.processing_saved && !settlement.record_saved,
      'Observed War Game finish must save/acknowledge before end-event redelivery');
    return {...settlement.result,operation:settlement.operation,operations:[settlement.operation]};
  };
  const replay=(action,value,key,bodyHash)=>{
    checkRequest(action,value);
    const saved=db.prepare('SELECT * FROM war_game_request WHERE request_key=?').get(key);
    if(!saved) return null;
    input(saved.action===action && saved.body_hash===bodyHash,'Conflicting War Game request identity');
    const battle=active();
    need(battle && battle.battle_id===saved.battle_id && battle.pvp_id===value.pvpId,'Obsolete War Game reply cannot reopen a closed/different battle');
    if(action===end) {
      const settlement=finish(battle.battle_id);need(settlement && equal(value,settlement.verdict),'War Game finish has changed or lost its verdict');
      need(saved.response_json===JSON.stringify(endDelivery(settlement)),'War Game saved finish reply is inconsistent');
      return Buffer.from(saved.response_json);
    }
    need(!finish(battle.battle_id),'War Game finish is issued; combat start/resume cannot repeat');
    current(battle);
    need(action===restart ? complete(battle):!battle.observed.includes('sp') && !battle.observed.includes('processing') &&
      equal(record(battle.pvp_id),battle.before.record),'Saved War Game start must use resume, not spend another attempt');
    const expected=action===restart?{...battle.result,result:0}:battle.result;
    need(saved.response_json===JSON.stringify(expected),'War Game saved reply is inconsistent');
    return Buffer.from(saved.response_json);
  };
  const issue=(action,value,key,bodyHash)=>{
    checkRequest(action,value);
    let battle=active(),result;
    if(action===end) {
      need(battle && battle.pvp_id===value.pvpId && battle.battle_id===value.battleId && complete(battle),
        'War Game finish requires its fully saved original season/battle entry');
      //Keep v1/v2 in-flight and closed policies; only newly captured local standings supply rank1.
      const ranked=battle.catalog_hash===rankedCatalog,progression=battle.catalog_hash!==legacyCatalog,
        projected=warGameFinish(battle,value,master,progression,ranked?1:null);current(battle);
      let settlement=finish(battle.battle_id);
      if(settlement) input(equal(value,settlement.verdict),'War Game finish verdict changed after issue');
      else {
        const at=now(),operation=issueOperation(14000,projected);
        db.prepare(`INSERT INTO war_game_end(battle_id,operation_id,issued_at,catalog_hash,verdict_json,response_json,operation_json)
          VALUES(?,?,?,?,?,?,?)`).run(battle.battle_id,operation.id,at,ranked?finishCatalog:progression?ordinaryFinishCatalog:legacyFinishCatalog,
            JSON.stringify(value),JSON.stringify(projected),JSON.stringify(operation));
        settlement=finish(battle.battle_id);
      }
      result=endDelivery(settlement);
    } else if(action===restart) {
      need(battle && battle.pvp_id===value.pvpId && complete(battle),'War Game resume requires its saved original start');
      need(!finish(battle.battle_id),'War Game finish is issued; do not restore ended combat');
      current(battle);result={...battle.result,result:0};
    } else {
      need(!battle,'Finish or resume the existing War Game battle before another entry');
      need(!rewardReceipt(value.pvpId),'A rewarded War Game season cannot reopen after a clock rewind');
      const player=info(),at=now(),window=master.pvp.information[value.pvpId];
      need(window && long(window.startAt) && long(window.endAt) && window.startAt<window.endAt &&
        at>=window.startAt && at<window.endAt,'War Game entry unavailable outside its original matching window');
      need(player.processingPvPState===0 && player.processingPvP===false && !operations().some(row=>row.type===10400),
        'Previous War Game processing/refill must settle before another battle');
      need(available() && ['processingUnderPvpState','processingSerialPvpState','processingPvBState',
        'processingGvGState','processingGvEState','processingGuildEventState'].every(key=>player[key]===0),
        'Finish other native competitive battles before entering War Game');
      const own=party(),oldRecord=record(value.pvpId),target=bootstrap(value.pvpId,oldRecord),baseline=sp(player);
      warGameEntry(baseline,at,project);
      const battleId='offline-wargame-'+crypto.randomUUID(),seed=crypto.randomInt(1,0x7fffffff),before={sp:baseline,
        record:oldRecord,processing:player.processingPvPState,oldProcessing:player.processingPvP,
        partyId:player.activePvPPartyId,totalExp:player.playerStatus.totalExp};
      result=response(value.pvpId,battleId,seed,own,target,before.totalExp);
      db.prepare(`INSERT INTO war_game_battle(battle_id,pvp_id,issued_at,catalog_hash,before_json,own_json,response_json,observed_json)
        VALUES(?,?,?,?,?,?,?,?)`).run(battleId,value.pvpId,at,localStanding(value.pvpId,target)?rankedCatalog:catalog,
          JSON.stringify(before),JSON.stringify(own),JSON.stringify(result),
          JSON.stringify(equal(oldRecord,target)?['record']:[]));
      battle=receipt(battleId);
    }
    db.prepare('INSERT INTO war_game_request(request_key,action,body_hash,battle_id,response_json) VALUES(?,?,?,?,?)')
      .run(key,action,bodyHash,battle.battle_id,JSON.stringify(result));
    return result;
  };
  const savePlan=(working,acknowledged=[])=>{
    if(working.has('UserGift') || acknowledged.length) guardGifts(working.get('UserGift') ?? read('UserGift').data,400);
    if(working.has('UserPvPRecord')) records(working.get('UserPvPRecord'),400);
    for(const id of acknowledged) if(db.prepare('SELECT 1 FROM operation_queue WHERE id=? AND type=14000').get(id) ||
      db.prepare('SELECT 1 FROM war_game_end WHERE operation_id=?').get(id)) {
      const row=db.prepare('SELECT battle_id FROM war_game_end WHERE operation_id=?').get(id);
      need(row && finish(row.battle_id),'War Game14000 ACK has no captured native finish; queue retained');
    }
    const battle=active(),settlement=battle?finish(battle.battle_id):null;
    if(!battle || ![...sensitive].some(name=>working.has(name)) && !acknowledged.includes(settlement?.operation_id)) return null;
    current(battle);
    const player=info(working),after=sp(player),savedRecord=record(battle.pvp_id,working),observed=new Set(battle.observed);
    need(player.activePvPPartyId===battle.before.partyId && player.processingPvP===battle.before.oldProcessing,
      'War Game native owner/selected party cannot change during start');
    //Freeze selected IDs/vectors, not unrelated PC counters or party HP/MP.
    //Use the existing shared native snapshot validator against merged rows.
    let candidate;
    try {candidate=party(working);} catch {input(false,'War Game save invalidates its selected owned native party');}
    input(equal(candidate,battle.own),'War Game combat snapshot must remain frozen until finish');
    if(settlement) {
      const recordSaved=Number(Boolean(settlement.record_saved || equal(savedRecord,settlement.target))),
        processingSaved=Number(Boolean(settlement.processing_saved || player.processingPvPState===0)),
        acknowledge=acknowledged.includes(settlement.operation_id);
      input(player.processingPvPState===(processingSaved?0:1) &&
        equal(savedRecord,recordSaved?settlement.target:battle.target),
        'War Game finish cannot rewind processing/record or save an unissued result');
      const passive=passivePlan(battle,after);
      input(passive,
        'War Game finish cannot spend/refill stamina; only native passive recovery is permitted');
      if(acknowledge) input(recordSaved===1 && processingSaved===1,'Save War Game14000 record and processing0 before ACK');
      return {id:battle.battle_id,observed:battle.observed,sp:battle.savedSp,...passive,
        finish:{...settlement,recordSaved,processingSaved,acknowledge}};
    }
    input(player.processingPvPState===1 || !observed.has('processing') && player.processingPvPState===battle.before.processing,
      'War Game processing state cannot rewind or enter an unissued state');
    if(player.processingPvPState===1) observed.add('processing');
    input(equal(savedRecord,battle.target) || !observed.has('record') && equal(savedRecord,battle.before.record),
      'War Game season record differs from its captured start');
    if(equal(savedRecord,battle.target)) observed.add('record');
    let savedSp=battle.savedSp;
    const passive=savedSp?passivePlan(battle,after):null;
    if(savedSp) input(passive,
      'Saved War Game entry permits native passive recovery, not another attempt/debit');
    else if(entryMatches(battle.entry,after,battle.issued_at,battle.currentSp)) {savedSp=after;observed.add('sp');}
    else input(entryBeforeMatches(battle.entry,after,battle.issued_at,battle.currentSp),
      'War Game start save is missing its one-SP debit/native timer');
    //2544958 resets the timer before subtracting; pre-debit saves are not SP proof.
    return {id:battle.battle_id,observed:[...observed].sort(),sp:savedSp,
      currentSp:savedSp || !equal(after,battle.before.sp)?after:null,
      recoveryBefore:passive?.recoveryBefore ?? null,recoveredAt:passive?.recoveredAt ?? null};
  };
  const commit=plan=>{
    if(plan) need(db.prepare('UPDATE war_game_battle SET observed_json=?,sp_saved_json=?,sp_current_json=? WHERE battle_id=? AND closed=0')
      .run(JSON.stringify(plan.observed),plan.sp===null?null:JSON.stringify(plan.sp),
        plan.currentSp===null?null:JSON.stringify(plan.recoveryBefore?
          {sp:plan.currentSp,recoveryBefore:plan.recoveryBefore,recoveredAt:plan.recoveredAt}:plan.currentSp),plan.id).changes===1,
      'War Game start observation disappeared during native save');
    if(plan?.finish) {
      const saved=plan.finish;
      need(db.prepare('UPDATE war_game_end SET record_saved=?,processing_saved=? WHERE battle_id=?')
        .run(saved.recordSaved,saved.processingSaved,plan.id).changes===1,'War Game finish save proof disappeared');
      if(saved.acknowledge) {
        need(db.prepare('UPDATE war_game_battle SET closed=1 WHERE battle_id=? AND closed=0').run(plan.id).changes===1,
          'War Game active battle disappeared before ACK closure');
        const previous=db.prepare('SELECT attempt_count FROM war_game_record WHERE pvp_id=?').get(saved.parent.pvp_id),
          count=(previous?.attempt_count ?? 0)+1;
        need(int(count) && count>0,'War Game attempt index exceeds native int32 precision');
        for(const [kind,key] of ['pc','assistingPc'].entries())
          for(const pcId of new Set(saved.parent.own.slots.map(row=>row[key].pcId).filter(Boolean))) {
            const before=db.prepare('SELECT count FROM war_game_usage WHERE pvp_id=? AND kind=? AND pc_id=?')
              .get(saved.parent.pvp_id,kind,pcId)?.count ?? 0;
            need(int(before) && int(before+1),'War Game offline participation count exceeds native int32 precision');
            db.prepare(`INSERT INTO war_game_usage(pvp_id,kind,pc_id,count) VALUES(?,?,?,1)
              ON CONFLICT(pvp_id,kind,pc_id) DO UPDATE SET count=war_game_usage.count+1`).run(saved.parent.pvp_id,kind,pcId);
          }
        db.prepare(`INSERT INTO war_game_record(pvp_id,battle_id,record_json,attempt_count,counts_hash) VALUES(?,?,?,?,?) ON CONFLICT(pvp_id)
          DO UPDATE SET battle_id=excluded.battle_id,record_json=excluded.record_json,attempt_count=excluded.attempt_count,counts_hash=excluded.counts_hash`)
          .run(saved.parent.pvp_id,plan.id,JSON.stringify(saved.target),count,hash([saved.parent.pvp_id,plan.id,count,usageRows(saved.parent.pvp_id)]));
      }
    }
  };
  const operationDelivery=(operation,action)=>{
    const row=db.prepare('SELECT battle_id FROM war_game_end WHERE operation_id=?').get(operation.id),settlement=row?finish(row.battle_id):null;
    need(settlement && equal(operation,settlement.operation) && active()?.battle_id===row.battle_id,
      'War Game14000 delivery has no exact active finish; queue retained');
    current(settlement.parent);
    if(settlement.record_saved || settlement.processing_saved) {
      need(action==='user_data/push','Saved War Game14000 must acknowledge before end-event redelivery');return false;
    }
    endDelivery(settlement);return true;
  };
  const guardPull=value=>{
    if(!value.tables.some(name=>sensitive.has(name))) return;
    const battle=active();if(!battle) return;current(battle);
    need(complete(battle) && !finish(battle.battle_id),'Pending War Game start/finish must save/acknowledge before replacing native combat profiles');
  };
  const delivery=action=>{
    if(!['user/login','user_data/confirm','user_data/pull'].includes(action)) return;
    const battle=active();if(battle) {current(battle);need(complete(battle) && !finish(battle.battle_id),'War Game start/finish must save/acknowledge before cold profile replacement');}
  };
  return {actions,replay,issue,active,receipt,finish,records,usage,claimAchievement,prize,rewardReceipt,guardGifts,settleRewards,
    savePlan,commit,guardPull,delivery,operationDelivery};
}

module.exports={openWarGame,warGameEntry,warGameFinish,warGameGrade};
