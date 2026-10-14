'use strict';

// Source-only Abyss lobby, attempts, record views and five-round combat.
// Five-round local streaks use authored rules and actual native save/ACK
//handoffs. Cooldown duration is disclosed offline policy, not server recovery.
// Local score records use native field/save semantics. Publisher matching,
//aggregation algorithms and native acceptance remain unfinished; earned
//solo-offline Presents publish their own original record status fields.
const crypto=require('node:crypto');
const { underPvpCpuParty,underPvpCpuDetails }=require('./under_pvp.cjs');
const long=n=>Number.isSafeInteger(n) && n>=0;
const int=n=>long(n) && n<=0x7fffffff;
const need=(ok,message)=>{ if(!ok) throw Object.assign(new Error(message),{status:503,offlineUnavailable:true}); };
const keys=(row,list)=>row && !Array.isArray(row) && Object.keys(row).sort().join(',')===[...list].sort().join(',');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const recordFields=['userId','serialPvpId','rank','score','highestGradeId','cumulativeScore','lastAdversaryIds',
  'isReceiveReward','isAggregate','winCountAtHighScore','gradeIdAtHighScore','matchingScore'];
const statusFields=['userId','serialPvpId','updatedMatchingCount','updateRivalList','lastRivalListUpdateAt',
  'executeRivalListUpdate','lastBattleStartAt'];
const usageFields=['userId','serialPvpId','usedPcList','usedMemoriaList'];
const giftFields=['userId','id','itemId','amount','title','message','senderType','senderId','giftAcquiredType',
  'itemLevel','equipmentId','equipmentEvolveCount','pcLimitBreakCount','pcHeroSublimateCount','state',
  'startAt','expireAt','createdAt','dynamodbExpireAt'];
const tables=['UserSerialPvpRecord','UserSerialPvpGameStatus','UserSerialPvpUsingLimitData'];
const project=(row,fields)=>row ? Object.fromEntries(fields.map(key=>[key,row[key]])) : null;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sameGift=(a,b)=>keys(a,giftFields) && keys(b,giftFields) && equal(project(a,giftFields),project(b,giftFields));

function serialPvpUnlockConfig(master) {
  const flags=Object.entries(master?.systemFlags ?? {}).filter(([,row])=>row.key==='system_flag.feature.serial_pvp'),
    condition=Object.values(master?.serialPvp?.serialPvpEntryCondition ?? {})[0];
  need(flags.length===1 && long(Number(flags[0][0])) && condition && long(condition.slot1) && condition.slot1>0 &&
    int(condition.slot2) && condition.slot2>0,'Original Abyss entry condition/system flag unavailable');
  const [key,flag]=flags[0];
  need(flag.defaultValue===0 && flag.minimum===0 && flag.maximum===2 && flag.readonly===false,
    'Original Abyss system-flag defaults/range require reconciliation');
  return {id:Number(key),condition,catalog:hash([key,flag,condition])};
}
function serialPvpUnlockFlag(flags,master,userId) {
  const config=serialPvpUnlockConfig(master);
  need(Array.isArray(flags),'Native Abyss system flags unavailable');
  const matches=flags.filter(row=>Number(row?.systemFlagId)===config.id),row=matches[0] ?? null;
  need(matches.length<=1 && (!row || keys(row,['userId','systemFlagId','flagValue','lastUpdatedAt']) &&
    [0,userId].includes(row.userId) && row.systemFlagId===config.id && int(row.flagValue) && row.flagValue<=2 && long(row.lastUpdatedAt)),
  'Native Abyss unlock flag identity/value requires reconciliation');
  return {...config,row,value:row?.flagValue ?? 0};
}
function serialPvpEligibility(flags,stages,records,master,userId) {
  const flag=serialPvpUnlockFlag(flags,master,userId);
  //2106d60 returns immediately for ANY nonzero flag; later seasons do not
  //require the training score again. No profile prewrite from this check.
  if(flag.value) return {...flag,eligible:true};
  need(Array.isArray(stages) && Array.isArray(records),'Native Abyss stage/War Game prerequisites unavailable');
  const matches=stages.filter(row=>Number(row?.adventureStageId)===flag.condition.slot1),stage=matches[0];
  need(matches.length<=1 && (!stage || stage.userId===userId &&
    stage.adventureStageId===flag.condition.slot1 && int(stage.state) && stage.state<=4),
  'Abyss entry stage identity/state requires reconciliation');
  const ids=new Set();
  //2791d44's pvpRecord vector at+eb0;2783df4 serializes protected+b8
  //as score (int32), not rank/highestGradeId/cumulative score.
  for(const row of records) {
    need(keys(row,['userId','pvpId','gradeId','rank','score','winCount','loseCount','consecutiveWinCount',
      'consecutiveLoseCount','lastAdversaryIds','lastBattleId','isAggregate','isReceiveReward','highestGradeId']) &&
      row.userId===userId && long(row.pvpId) && row.pvpId>0 && !ids.has(row.pvpId) &&
      ['gradeId','highestGradeId'].every(key=>long(row[key])) &&
      ['rank','score','winCount','loseCount','consecutiveWinCount','consecutiveLoseCount'].every(key=>int(row[key])) &&
      typeof row.lastBattleId==='string' && typeof row.isAggregate==='boolean' && typeof row.isReceiveReward==='boolean' &&
      Array.isArray(row.lastAdversaryIds) && row.lastAdversaryIds.every(id=>long(id) && id>0),
    'Abyss War Game score identity/fields require reconciliation');
    ids.add(row.pvpId);
  }
  return {...flag,eligible:stage?.state===4 && records.some(row=>row.score>=flag.condition.slot2)};
}

function serialPvpRows(name,rows,master,userId) {
  need(Array.isArray(rows) && master?.serialPvp?.serialPvpInformation,'Original Abyss data or saves unavailable');
  const result=new Map(),fields=name===tables[0]?recordFields:name===tables[1]?statusFields:usageFields;
  for(const row of rows) {
    // These lazy native classes leave owner0; only0/the actual account is accepted.
    need(keys(row,fields) && [0,userId].includes(row.userId) && long(row.serialPvpId) && row.serialPvpId>0 &&
      master.serialPvp.serialPvpInformation[row.serialPvpId] && !result.has(row.serialPvpId),
    'Abyss save identity requires reconciliation');
    if(name===tables[0]) {
      need(['rank','winCountAtHighScore'].every(key=>int(row[key])) &&
        ['score','highestGradeId','cumulativeScore','gradeIdAtHighScore'].every(key=>long(row[key])) &&
        Number.isSafeInteger(row.matchingScore) && typeof row.isReceiveReward==='boolean' && typeof row.isAggregate==='boolean' &&
        Array.isArray(row.lastAdversaryIds) && row.lastAdversaryIds.every(id=>long(id) && id>0) &&
        ['highestGradeId','gradeIdAtHighScore'].every(key=>!row[key] || master.serialPvp.serialPvpGrade?.[row[key]]),
      'Abyss record fields require reconciliation');
    } else if(name===tables[1]) {
      need(int(row.updatedMatchingCount) && long(row.lastRivalListUpdateAt) && long(row.lastBattleStartAt) &&
        typeof row.updateRivalList==='boolean' && typeof row.executeRivalListUpdate==='boolean',
      'Abyss game-status fields require reconciliation');
    } else {
      for(const [list,id] of [['usedPcList','pcId'],['usedMemoriaList','memoriaId']])
        need(Array.isArray(row[list]) && row[list].every(value=>keys(value,[id,'turnCount']) &&
          int(value[id]) && value[id]>0 && int(value.turnCount)) && new Set(row[list].map(value=>value[id])).size===row[list].length,
        'Abyss used-unit fields require reconciliation');
    }
    const normalized=project(row,fields);
    if(name===tables[2]) for(const [list,id] of [['usedPcList','pcId'],['usedMemoriaList','memoriaId']])
      normalized[list]=row[list].map(value=>({[id]:value[id],turnCount:value.turnCount}));
    result.set(row.serialPvpId,normalized);
  }
  return result;
}

const initialRecord=(id,userId=0)=>({userId,serialPvpId:id,rank:0,score:0,highestGradeId:0,cumulativeScore:0,
  lastAdversaryIds:[],isReceiveReward:false,isAggregate:false,winCountAtHighScore:0,gradeIdAtHighScore:0,matchingScore:0});
// Explicit solo-offline settlement: received means committed to Presents,
//not collection of every gift. Never call this for an unearned/open run.
const rankingRecord=record=>({...record,rank:1,isAggregate:true,isReceiveReward:true});
const initialStatus=id=>({userId:0,serialPvpId:id,updatedMatchingCount:0,updateRivalList:true,
  lastRivalListUpdateAt:0,executeRivalListUpdate:false,lastBattleStartAt:0});
const initialUsage=id=>({userId:0,serialPvpId:id,usedPcList:[],usedMemoriaList:[]});

function serialPvpRankingPrize(id,rank,master) {
  const source=master?.serialPvp,season=source?.serialPvpInformation?.[id];
  need(season && int(rank) && rank>0,'Original Abyss ranking prize identity unavailable');
  //1bb5050 reads information vtable0x20 = slot14;1bb56a0 joins group.slot1
  //and rewardItem.slot1. Negative rank sentinels are NOT guessed grade awards.
  const groups=Object.entries(source.serialPvpRankingRewardGroup ?? {}).filter(([,row])=>
    row.slot1===season.slot14 && int(row.slot2) && row.slot2>0 && int(row.slot3) &&
    row.slot2<=rank && rank<=row.slot3);
  need(groups.length===1,'Original Abyss bounded ranking reward tier unavailable or ambiguous');
  const groupId=Number(groups[0][0]),rewards=Object.entries(source.serialPvpRankingRewardItem ?? {})
    .filter(([,row])=>row.slot1===groupId).map(([key,row])=>({rewardId:Number(key),itemId:row.slot2,amount:row.slot3}))
    .sort((a,b)=>a.rewardId-b.rewardId);
  need(long(groupId) && groupId>0 && rewards.length && rewards.every(row=>long(row.rewardId) && row.rewardId>0 &&
    int(row.itemId) && row.itemId>0 && Object.values(master.items ?? {}).includes(row.itemId) &&
    master.itemProfiles?.[row.itemId] && int(row.amount) && row.amount>0),'Original Abyss ranking reward item/quantity unavailable');
  return {groupId,rewards,catalog:hash([id,season.slot14,rank,groups[0],rewards,
    rewards.map(row=>master.itemProfiles[row.itemId]),'solo-offline-ranking-present-v1'])};
}

const emptyCycle=()=>({previousBattleId:null,scores:[],wins:0});
function serialPvpCycle(prior,verdict,master) {
  need(master.serialPvpMessages?.[40650029]?.text.includes('win all 5 battles') &&
    master.serialPvpMessages?.[40650069]?.text.includes('5 wins in a row, or after losing once'),
    'Original Abyss run-length/class-lock evidence unavailable');
  need(keys(prior,['previousBattleId','scores','wins']) && int(prior.wins) && prior.wins<5 &&
    Array.isArray(prior.scores) && prior.scores.length===prior.wins && prior.scores.every(int) &&
    (prior.wins?typeof prior.previousBattleId==='string':prior.previousBattleId===null),
    'Abyss prior winning rounds require reconciliation');
  const scores=[...prior.scores,verdict.result.attack_result.roundScore],wins=prior.wins+Number(verdict.result.isWin);
  return {scores,wins,closed:!verdict.result.isWin || wins===5};
}
const partyUsage=own=>({usedPcList:[...new Set(own.slots.flatMap(slot=>[slot.pc.pcId,slot.assistingPc.pcId]).filter(Boolean))],
  usedMemoriaList:[...new Set(own.memoriaSlots.map(slot=>slot.otherMemoria.memoriaId).filter(Boolean))]});
function serialPvpNextUsage(before,own,master) {
  const season=master.serialPvp.serialPvpInformation[before.serialPvpId],rule=master.serialPvp.serialPvpRule[season.slot9];
  // ponytail: authored slot5=3 is an INFERRED offline cooldown policy until
  //its original server mapping is recovered. Positive blocks; zero remains
  //"Played" for the native first-participation bonus (233d9cc/193eb04).
  need(int(rule.slot5) && rule.slot5>0,'Offline Abyss cooldown policy unavailable');
  const result=structuredClone(before),played=partyUsage(own);
  for(const [list,id] of [['usedPcList','pcId'],['usedMemoriaList','memoriaId']]) {
    for(const row of result[list]) row.turnCount=Math.max(0,row.turnCount-1);
    for(const value of played[list]) {
      const row=result[list].find(row=>row[id]===value);
      if(row) row.turnCount=rule.slot5;
      else result[list].push({[id]:value,turnCount:rule.slot5});
    }
  }
  return result;
}
function serialPvpPartyReady(usage,own) {
  const played=partyUsage(own);
  for(const [list,id] of [['usedPcList','pcId'],['usedMemoriaList','memoriaId']])
    need(!usage[list].some(row=>row.turnCount>0 && played[list].includes(row[id])),
      'Abyss party contains a unit or Memoria still on cooldown');
}

function serialPvpScoreRecord(before,battle,cycle,verdict,at,master) {
  const record=structuredClone(before ?? initialRecord(battle.serial_pvp_id)),
    season=master.serialPvp.serialPvpInformation[battle.serial_pvp_id],
    grades=Object.entries(master.serialPvp.serialPvpGrade).filter(([,row])=>row.slot1===season.slot10)
      .sort((a,b)=>a[1].slot2-b[1].slot2),grade=master.serialPvp.serialPvpGrade[battle.grade_id];
  need(grades.length && grade?.slot1===season.slot10 && long(at),'Original Abyss score season/grade unavailable');
  // Original40650178: an out-of-period finish does not reflect its score.
  // Capture this decision at issuance, not at a later save/ACK clock.
  if(at<season.slot3 || at>=season.slot4) return record;
  // ponytail: local client-authoritative score settlement. Components are
  //native telemetry, not an independently recovered publisher combat engine.
  record.cumulativeScore+=verdict.result.attack_result.roundScore;
  need(long(record.cumulativeScore),'Abyss cumulative score exceeds exact native-save precision');
  const total=cycle.scores.reduce((sum,score)=>sum+score,0);
  need(long(total),'Abyss completed score exceeds exact native-save precision');
  if(cycle.closed && total>record.score) {
    record.score=total;record.winCountAtHighScore=cycle.wins;record.gradeIdAtHighScore=battle.grade_id;
  }
  if(cycle.wins===5) {
    //2337c14 reads highestGradeId at0xe8;1bbf93c compares the
    //requested class against that MAX SELECTABLE grade.40650036 unlocks
    //the next class after five wins, not merely the class just cleared.
    const next=grades[Math.min(grades.length-1,grades.findIndex(([id])=>Number(id)===battle.grade_id)+1)],
      unlocked=master.serialPvp.serialPvpGrade[record.highestGradeId];
    need(!unlocked || unlocked.slot1===season.slot10,'Saved Abyss unlocked class belongs to another season group');
    if(!unlocked || next[1].slot2>unlocked.slot2) record.highestGradeId=Number(next[0]);
  }
  return record; // No publisher rank/matching/aggregate/reward flag invention.
}

const scoreFields=['battleMainScore','battleSubScore','characterBonus','technicalPlayBonus','technicalPartyBonus'];
function serialPvpEndInput(value,master,gradeId) {
  const verdict=value?.result,score=verdict?.attack_result;
  if(!keys(value,['serialPvpId','battleId','result']) || !long(value.serialPvpId) || !value.serialPvpId ||
    typeof value.battleId!=='string' || !/^abyss-[0-9a-f-]{36}$/.test(value.battleId) ||
    !keys(verdict,['isWin','isRetire','attack_result']) || typeof verdict.isWin!=='boolean' ||
    typeof verdict.isRetire!=='boolean' || verdict.isWin && verdict.isRetire ||
    !keys(score,[...scoreFields,'gradeBonusRate','roundScore']) || !scoreFields.every(key=>int(score[key])) ||
    !int(score.roundScore) || typeof score.gradeBonusRate!=='number' || !Number.isFinite(score.gradeBonusRate))
    throw Object.assign(new Error('Invalid native Abyss finish request'),{status:400});
  const grade=master?.serialPvp?.serialPvpGrade?.[gradeId];
  need(grade && Number.isFinite(grade.slot7) && grade.slot7>0,'Original Abyss score grade unavailable');
  // ARM64 1f0fec8:1f0ffe4: five int32 additions, SCVTF S8, FMUL S0,
  // FCVTAS W1 (nearest, ties away from zero). The decompiler incorrectly
  // stops at the FIRST obfuscated integer setter; use actual instructions.
  //1f105ec returns 1 on loss, original float32 grade.slot7 on a win.
  const rate=verdict.isWin?Math.fround(grade.slot7):1;
  let sum=0;
  for(const key of scoreFields) sum=(sum+score[key])|0;
  const product=Math.fround(Math.fround(sum)*rate),rounded=Math.floor(product+0.5);
  need(score.gradeBonusRate===rate && (verdict.isWin || score.characterBonus===0) &&
    sum>=0 && int(rounded) && score.roundScore===rounded,
    'Abyss client score differs from its native int32/float32 calculation');
  return structuredClone(value);
}

function serialPvpSeasonAt(at,master) {
  need(long(at) && master?.serialPvp?.serialPvpInformation,'Original Abyss SP calendar unavailable');
  //175dba4 uses information slots5/6 (DISPLAY), not matching slots3/4.
  const seasons=Object.entries(master.serialPvp.serialPvpInformation);
  need(seasons.every(([id,row])=>long(Number(id)) && Number(id)>0 && long(row.slot5) && long(row.slot6) && row.slot5<=row.slot6),
    'Original Abyss SP period requires reconciliation');
  const active=seasons.filter(([,row])=>row.slot5<row.slot6 && at>=row.slot5 && at<row.slot6);
  need(active.length<=1,'Ambiguous original Abyss SP period');
  return active.length?{id:Number(active[0][0]),...active[0][1]}:null;
}

function serialPvpSpConfig(at,master) {
  const season=serialPvpSeasonAt(at,master);
  if(!season) return null;
  const rule=master.serialPvp.serialPvpRule?.[season.slot9],consume=master.consumes?.[81071001];
  //2546cbc: rule offsets8/10/12 -> slots2/3/4. Recovery is
  //gamelibConsume offset18 -> slot7, NOT the rule's battle count.
  need(rule && [rule.slot1,rule.slot2,rule.slot3,rule.slot4].every(n=>int(n) && n>0) &&
    rule.slot1<=rule.slot3 && rule.slot2<=rule.slot3 && long(season.slot3) &&
    consume?.key==='CONSUME_RESUME_SERIAL_PVP_SP' && int(consume.recovery) && consume.recovery>0,
    'Original Abyss SP capacity/recovery unavailable');
  return {id:season.id,initial:rule.slot1,startsAt:season.slot3,naturalCap:rule.slot2,cap:rule.slot3,interval:rule.slot4,gain:consume.recovery,
    catalog:hash([season,rule,consume])};
}

const serialPvpSpStatus=status=>{
  need(status && int(status.serialPvpSP) && long(status.serialPvpSPUpdatedAt),'Saved Abyss SP requires reconciliation');
  return {serialPvpSP:status.serialPvpSP,serialPvpSPUpdatedAt:status.serialPvpSPUpdatedAt};
};

function serialPvpStamina(status,at,master,config=serialPvpSpConfig(at,master)) {
  const before=serialPvpSpStatus(status);
  need(long(at),'Invalid Abyss SP clock');
  if(!config) return before;
  const elapsed=Math.max(0,at-before.serialPvpSPUpdatedAt),ticks=Math.floor(elapsed/config.interval);
  //2546ec8 narrows ticks/addition to int32. Preserve unknown overflow rather
  //than pretending JS arithmetic reproduces a wrapped native quantity.
  need(int(ticks) && before.serialPvpSP+ticks<=0x7fffffff,'Abyss SP native timer overflow requires reconciliation');
  if(!ticks) return before;
  //The native getter really applies min(naturalCap, stock+ticks) EVEN above
  //the natural cap. Its timestamp advances by whole intervals, retaining
  //the remainder; neither a daily top-up nor a timestamp reset to now.
  return {serialPvpSP:Math.min(config.naturalCap,before.serialPvpSP+ticks),
    serialPvpSPUpdatedAt:at-elapsed+ticks*config.interval};
}

function serialPvpRefill(before,at,master) {
  const baseline=serialPvpSpStatus(before),config=serialPvpSpConfig(at,master);
  need(config,'Abyss Iris refill unavailable outside the original display period');
  const candidates=spRecoveryCandidates(baseline,at,master,config,config.gain);
  need(candidates.length,'Abyss attempts are already at the native refill cap');
  return {baseline,config,candidates};
}

function spRecoveryCandidates(baseline,at,master,config,gain) {
  const initialized=serialPvpInitialize(baseline,at,master,config);
  return [baseline,serialPvpStamina(baseline,at,master),
    ...(initialized?[initialized,serialPvpStamina(initialized,at,master,config)]:[])].filter((row,i,all)=>
    all.findIndex(other=>equal(other,row))===i && row.serialPvpSP<config.cap).map(row=>({before:row,
      after:{...row,serialPvpSP:Math.min(config.cap,row.serialPvpSP+gain)}}));
}

const ticketTable='UserSerialPvpSpTicketItem';
const ticketStock=row=>({amount:row?.amount ?? 0,cumulativeAmount:row?.cumulativeAmount ?? 0,
  reservedAmount:row?.reservedAmount ?? 0,lastResetAt:row?.lastResetAt ?? 0});
function serialPvpTicketRows(rows,master,userId) {
  need(Array.isArray(rows),'Saved Abyss recovery tickets unavailable');
  const result=new Map();
  for(const row of rows) {
    //27918dc: eight fields, unlike six-field Under passes.2573e48 sets
    //the actual owner. Consumption does not reset the timer/cumulative/reserved.
    need(keys(row,['userId','ticketId','amount','reservedAmount','bookEntryState','signature','cumulativeAmount','lastResetAt']) &&
      row.userId===userId && int(row.ticketId) && master?.serialPvp?.serialPvpSpTicketItem?.[row.ticketId] &&
      !result.has(row.ticketId) && ['amount','reservedAmount','cumulativeAmount'].every(key=>int(row[key]) && row[key]<=999999999) &&
      row.amount<=row.cumulativeAmount && [0,1,2,3].includes(row.bookEntryState) && long(row.lastResetAt) &&
      long(row.signature) && row.signature<=0xffffffff,'Abyss recovery-ticket identity/stock requires reconciliation');
    result.set(row.ticketId,row);
  }
  return result;
}
function serialPvpTicketRecovery(status,ticketId,amount,at,master) {
  const baseline=serialPvpSpStatus(status),config=serialPvpSpConfig(at,master),
    ticket=master?.serialPvp?.serialPvpSpTicketItem?.[ticketId];
  need(config && master.serialPvp.serialPvpInformation[config.id].slot18===ticketId &&
    int(amount) && amount>0 && int(ticket?.slot10) && ticket.slot10>0 && int(amount*ticket.slot10),
  'Abyss ticket requires its original active season and recovery quantity');
  const gain=amount*ticket.slot10,candidates=spRecoveryCandidates(baseline,at,master,config,gain)
    //2541eb8 checks full capacity BEFORE consuming each ticket, then
    //common gain+0x50(-1,0) and25472e0. No partial/clamped paid recovery.
    .filter(row=>row.after.serialPvpSP-row.before.serialPvpSP===gain);
  need(candidates.length,'Abyss attempts have insufficient capacity for these recovery tickets');
  return {baseline,config,candidates,catalog:hash([config.catalog,ticket,'native-ticket-stock-v1'])};
}

function serialPvpInitialize(status,at,master,config=serialPvpSpConfig(at,master)) {
  const before=serialPvpSpStatus(status);
  //1b851cc compares the raw timestamp254227c with MATCHING start, then
  //2542274 writes rule.slot1 and that exact start. Not a daily allowance.
  return config && before.serialPvpSPUpdatedAt<config.startsAt ?
    {serialPvpSP:config.initial,serialPvpSPUpdatedAt:config.startsAt}:null;
}

function serialPvpRunEntry(status,at,master) {
  const baseline=serialPvpSpStatus(status),config=serialPvpSpConfig(at,master);
  need(config,'Abyss run entry unavailable outside the original display period');
  const initialized=serialPvpInitialize(baseline,at,master,config),effective=initialized ?? baseline;
  const candidates=[effective,serialPvpStamina(effective,at,master,config)].filter((row,i,all)=>
    all.findIndex(other=>equal(other,row))===i && row.serialPvpSP>=1).map(before=>({before,
      after:{serialPvpSP:before.serialPvpSP-1,
        serialPvpSPUpdatedAt:before.serialPvpSP>=config.naturalCap?at:before.serialPvpSPUpdatedAt}}));
  need(candidates.length,'An Abyss run requires one available attempt');
  return {baseline,config,candidates};
}

function serialPvpCpuRivals(id,gradeId,generation,master) {
  const season=master?.serialPvp?.serialPvpInformation?.[id],grade=master?.serialPvp?.serialPvpGrade?.[gradeId];
  need(season && grade && grade.slot1===season.slot10 && int(generation),'Original Abyss grade unavailable');
  const parties=Object.entries(master?.underPvp?.dummyUnderPvpParty ?? {}).sort((a,b)=>Number(a[0])-Number(b[0]));
  const profiles=Object.values(master?.underPvp?.dummyUnderPvpUserProfile ?? {});
  need(parties.length>=5 && profiles.length,'Archived offline CPU teams unavailable');
  // ponytail: reuse authored teams, NOT guessed live matching or scaled stats.
  // Five opponents is an explicit local lobby policy; no Abyss dummy-team
  // table has been recovered. Grade is the local challenge selection, not
  // a claim that these Under Telskyura teams were original Abyss opponents.
  return Array.from({length:5},(_,i)=>{
    const [key,row]=parties[(generation*5+grade.slot2*5+i)%parties.length],userId=Number(key),
      party={...underPvpCpuParty(userId,master),partyType:9},level=master.playerLevels?.find(([rank])=>rank===row.slot3);
    need(level && long(level[1]) && typeof profiles[(generation*5+i)%profiles.length].slot1==='string',
      'Original offline CPU profile unavailable');
    return {serialPvpPlayerInfo:{userId,name:`${profiles[(generation*5+i)%profiles.length].slot1} [Offline CPU]`,
      totalExp:level[1],gradeId,rank:0,score:0,preRank:0,titleBadgeId:0,subTitleBadgeId:0,
      leaderPcId:party.slots[0].pc.pcId,isDummy:true},serialPvpParty:party};
  });
}

function openSerialPvp({db,read,master,userId,now,issueOperation,validateParty,selectedParty,playerProfile,itemReservation,createGifts,claimObserved}) {
  const battleActions=new Set(['serial_pvp/battle/start','serial_pvp/battle/restart']);
  const viewAction='serial_pvp/player_info/get';
  const endAction='serial_pvp/battle/end',resultAction='serial_pvp/result/get';
  const rankingAction='serial_pvp/ranking/get',usageAction='serial_pvp/character/ranking/get';
  const viewActions=new Set([viewAction,resultAction,rankingAction,usageAction]);
  const actions=new Set(['serial_pvp/summary/get','serial_pvp/grade/select','serial_pvp/rival_list/update',viewAction,
    endAction,resultAction,rankingAction,usageAction,...battleActions]);
  const flagTable='UserSystemFlag';
  const sensitive=new Set([...tables,'UserSerialPvpInfo','UserInfo','UserParty','UserPC','UserGift',ticketTable,flagTable]);
  const catalog=master?.serialPvp ? hash([master.serialPvp,master.underPvp,master.pcProfiles,master.playerLevels]) : null;
  const viewCatalog=catalog ? hash([catalog,master.communicationCharacters,master.characterCostumes,master.characters]) : null;
  const endCatalog=catalog?hash([catalog,'first-defeat-retirement-v1']):null;
  const streakCatalog=catalog?hash([catalog,'five-round-offline-cooldown-v1',master.serialPvpMessages]):null;
  const scoreCatalog=streakCatalog?hash([streakCatalog,'native-score-record-v1']):null;
  const usageCatalog=catalog?hash([catalog,'acknowledged-local-participation-v1']):null;
  const rankingCatalog=viewCatalog?hash([viewCatalog,usageCatalog,'solo-offline-ranking-v1']):null;
  db.exec(`CREATE TABLE IF NOT EXISTS serial_pvp_lobby(serial_pvp_id INTEGER PRIMARY KEY,generation INTEGER NOT NULL,
    grade_id INTEGER NOT NULL,catalog_hash TEXT NOT NULL,issued_at INTEGER NOT NULL,before_json TEXT NOT NULL,
    after_json TEXT NOT NULL,rivals_json TEXT NOT NULL,pending_status INTEGER NOT NULL CHECK(pending_status IN(0,1)),
    pending_usage INTEGER NOT NULL CHECK(pending_usage IN(0,1)));
    CREATE TABLE IF NOT EXISTS serial_pvp_lobby_request(request_key TEXT PRIMARY KEY,action TEXT NOT NULL,
    body_hash TEXT NOT NULL,serial_pvp_id INTEGER NOT NULL,generation INTEGER NOT NULL,response TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS serial_pvp_lobby_pending ON serial_pvp_lobby(pending_status,pending_usage);
    CREATE INDEX IF NOT EXISTS serial_pvp_lobby_request_season ON serial_pvp_lobby_request(serial_pvp_id);
    CREATE TABLE IF NOT EXISTS serial_pvp_sp_refill(operation_id INTEGER PRIMARY KEY,serial_pvp_id INTEGER NOT NULL,
      catalog_hash TEXT NOT NULL,issued_at INTEGER NOT NULL,baseline_json TEXT NOT NULL,candidates_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS serial_pvp_ticket_use(id INTEGER PRIMARY KEY,serial_pvp_id INTEGER NOT NULL,ticket_id INTEGER NOT NULL,
      catalog_hash TEXT NOT NULL,issued_at INTEGER NOT NULL,baseline_json TEXT NOT NULL,candidates_json TEXT NOT NULL,
      before_json TEXT NOT NULL,after_json TEXT NOT NULL,amount INTEGER NOT NULL,
      stock_saved INTEGER NOT NULL DEFAULT 1 CHECK(stock_saved IN(0,1)),sp_saved INTEGER NOT NULL CHECK(sp_saved IN(0,1)));
    CREATE INDEX IF NOT EXISTS serial_pvp_ticket_latest ON serial_pvp_ticket_use(ticket_id,id DESC);
    CREATE TABLE IF NOT EXISTS serial_pvp_ticket_stock(ticket_id INTEGER PRIMARY KEY,use_id INTEGER NOT NULL,stock_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS serial_pvp_run_entry(serial_pvp_id INTEGER PRIMARY KEY,generation INTEGER NOT NULL,
      grade_id INTEGER NOT NULL,request_key TEXT NOT NULL,
      catalog_hash TEXT NOT NULL,issued_at INTEGER NOT NULL,baseline_json TEXT NOT NULL,candidates_json TEXT NOT NULL,
      observed INTEGER NOT NULL CHECK(observed IN(0,1)),observed_json TEXT);
    CREATE INDEX IF NOT EXISTS serial_pvp_run_entry_pending ON serial_pvp_run_entry(observed,serial_pvp_id);
    CREATE INDEX IF NOT EXISTS serial_pvp_lobby_request_generation ON serial_pvp_lobby_request(serial_pvp_id,generation);
    CREATE INDEX IF NOT EXISTS serial_pvp_sp_pending_queue ON operation_queue(type,id);
    CREATE TABLE IF NOT EXISTS serial_pvp_battle(battle_id TEXT PRIMARY KEY,operation_id INTEGER NOT NULL UNIQUE,
      serial_pvp_id INTEGER NOT NULL,lobby_generation INTEGER NOT NULL,entry_generation INTEGER NOT NULL,grade_id INTEGER NOT NULL,
      rival_id INTEGER NOT NULL,party_index INTEGER NOT NULL,owned_party_id INTEGER NOT NULL,issued_at INTEGER NOT NULL,
      catalog_hash TEXT NOT NULL,own_party_json TEXT NOT NULL,before_json TEXT NOT NULL,response_json TEXT NOT NULL,
      operation_json TEXT NOT NULL,observed_json TEXT NOT NULL,last_battle_start_at INTEGER NOT NULL DEFAULT 0,
      closed INTEGER NOT NULL DEFAULT 0 CHECK(closed IN(0,1)));
    CREATE INDEX IF NOT EXISTS serial_pvp_battle_open ON serial_pvp_battle(closed,battle_id);
    CREATE TABLE IF NOT EXISTS serial_pvp_active(user_id INTEGER PRIMARY KEY,battle_id TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS serial_pvp_battle_request(request_key TEXT PRIMARY KEY,action TEXT NOT NULL,
      body_hash TEXT NOT NULL,battle_id TEXT NOT NULL,response TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS serial_pvp_view_request(request_key TEXT PRIMARY KEY,action TEXT NOT NULL,
      body_hash TEXT NOT NULL,serial_pvp_id INTEGER NOT NULL,owner_id INTEGER NOT NULL,generation INTEGER NOT NULL,
      catalog_hash TEXT NOT NULL,response TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS serial_pvp_end(battle_id TEXT PRIMARY KEY,operation_id INTEGER NOT NULL UNIQUE,
      serial_pvp_id INTEGER NOT NULL,catalog_hash TEXT NOT NULL,issued_at INTEGER NOT NULL,
      verdict_json TEXT NOT NULL,before_json TEXT NOT NULL,response_json TEXT NOT NULL,operation_json TEXT NOT NULL,
      processing_saved INTEGER NOT NULL DEFAULT 0 CHECK(processing_saved IN(0,1)));
    CREATE INDEX IF NOT EXISTS serial_pvp_end_season ON serial_pvp_end(serial_pvp_id,operation_id);
    CREATE TABLE IF NOT EXISTS serial_pvp_end_request(request_key TEXT PRIMARY KEY,action TEXT NOT NULL,
      body_hash TEXT NOT NULL,battle_id TEXT NOT NULL,response TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS serial_pvp_result(user_id INTEGER NOT NULL,serial_pvp_id INTEGER NOT NULL,
      battle_id TEXT NOT NULL UNIQUE,PRIMARY KEY(user_id,serial_pvp_id));
    CREATE TABLE IF NOT EXISTS serial_pvp_progress(user_id INTEGER NOT NULL,serial_pvp_id INTEGER NOT NULL,
      battle_id TEXT NOT NULL UNIQUE,PRIMARY KEY(user_id,serial_pvp_id));
    CREATE TABLE IF NOT EXISTS serial_pvp_record_handoff(battle_id TEXT PRIMARY KEY,catalog_hash TEXT NOT NULL,
      observed INTEGER NOT NULL CHECK(observed IN(0,1)));
    CREATE TABLE IF NOT EXISTS serial_pvp_high_score(user_id INTEGER NOT NULL,serial_pvp_id INTEGER NOT NULL,
      battle_id TEXT NOT NULL UNIQUE,PRIMARY KEY(user_id,serial_pvp_id));
    CREATE TABLE IF NOT EXISTS serial_pvp_matching_checkpoint(serial_pvp_id INTEGER PRIMARY KEY,generation INTEGER NOT NULL,
      count INTEGER NOT NULL,reset_pending INTEGER NOT NULL CHECK(reset_pending IN(0,1)));
    CREATE TABLE IF NOT EXISTS serial_pvp_usage(serial_pvp_id INTEGER NOT NULL,kind INTEGER NOT NULL CHECK(kind IN(0,1)),
      pc_id INTEGER NOT NULL,count INTEGER NOT NULL CHECK(count>0),PRIMARY KEY(serial_pvp_id,kind,pc_id));
    CREATE TABLE IF NOT EXISTS serial_pvp_usage_checkpoint(serial_pvp_id INTEGER PRIMARY KEY,catalog_hash TEXT NOT NULL,
      battle_id TEXT,operation_id INTEGER NOT NULL,round_count INTEGER NOT NULL,counts_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS serial_pvp_usage_handoff(battle_id TEXT PRIMARY KEY,catalog_hash TEXT NOT NULL,
      issued INTEGER NOT NULL DEFAULT 0 CHECK(issued IN(0,1)),observed INTEGER NOT NULL DEFAULT 0 CHECK(observed IN(0,1)));
    CREATE INDEX IF NOT EXISTS serial_pvp_usage_pending ON serial_pvp_usage_handoff(battle_id) WHERE issued=1 AND observed=0;
    CREATE TABLE IF NOT EXISTS serial_pvp_unlock(user_id INTEGER PRIMARY KEY,system_flag_id INTEGER NOT NULL,
      flag_owner_id INTEGER NOT NULL,catalog_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS serial_pvp_ranking_reward(user_id INTEGER NOT NULL,serial_pvp_id INTEGER NOT NULL,
      battle_id TEXT NOT NULL,best_battle_id TEXT NOT NULL,record_json TEXT NOT NULL,issued_at INTEGER NOT NULL,
      catalog_hash TEXT NOT NULL,PRIMARY KEY(user_id,serial_pvp_id));
    CREATE TABLE IF NOT EXISTS serial_pvp_ranking_gift(gift_id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,
      serial_pvp_id INTEGER NOT NULL,reward_id INTEGER NOT NULL,gift_json TEXT NOT NULL,claim_operation_id INTEGER,
      UNIQUE(user_id,serial_pvp_id,reward_id));
    CREATE INDEX IF NOT EXISTS serial_pvp_ranking_gift_season ON serial_pvp_ranking_gift(user_id,serial_pvp_id);
    CREATE TABLE IF NOT EXISTS serial_pvp_run_archive(serial_pvp_id INTEGER NOT NULL,generation INTEGER NOT NULL,
      catalog_hash TEXT NOT NULL,lobby_json TEXT NOT NULL,entry_json TEXT NOT NULL,
      PRIMARY KEY(serial_pvp_id,generation));`);
  if(!db.prepare('PRAGMA table_info(serial_pvp_ranking_gift)').all().some(row=>row.name==='claim_operation_id'))
    db.exec('ALTER TABLE serial_pvp_ranking_gift ADD COLUMN claim_operation_id INTEGER');
  if(!db.prepare('PRAGMA table_info(serial_pvp_ticket_use)').all().some(row=>row.name==='stock_saved'))
    db.exec('ALTER TABLE serial_pvp_ticket_use ADD COLUMN stock_saved INTEGER NOT NULL DEFAULT 1 CHECK(stock_saved IN(0,1))');
  db.exec(`CREATE INDEX IF NOT EXISTS serial_pvp_ranking_gift_claim ON serial_pvp_ranking_gift(claim_operation_id)
    WHERE claim_operation_id IS NOT NULL;
    DROP INDEX IF EXISTS serial_pvp_ticket_pending;
    CREATE INDEX serial_pvp_ticket_pending ON serial_pvp_ticket_use(id) WHERE stock_saved=0 OR sp_saved=0`);
  const unlockSnapshot=()=>{
    const flag=serialPvpUnlockFlag(read(flagTable).data,master,userId),
      saved=db.prepare('SELECT * FROM serial_pvp_unlock WHERE user_id=?').get(userId);
    need(!saved || saved.system_flag_id===flag.id && saved.catalog_hash===flag.catalog &&
      saved.flag_owner_id===flag.row?.userId && flag.value>0,
    'Saved Abyss unlock lost its native flag/owner/original catalog; progress retained');
    return flag;
  };
  const eligibility=()=>{
    const flag=unlockSnapshot();
    if(flag.value) return {...flag,eligible:true}; // Native early return; no large stage/training reads after unlock.
    const state=serialPvpEligibility(flag.row?[flag.row]:[],read('UserAdventureStage').data,read('UserPvPRecord').data,master,userId);
    need(state.eligible,'Abyss requires its original cleared stage and War Game score before entry');
    return state;
  };
  const recordUnlock=flag=>{
    if(flag?.value) db.prepare(`INSERT INTO serial_pvp_unlock(user_id,system_flag_id,flag_owner_id,catalog_hash)
      VALUES(?,?,?,?) ON CONFLICT(user_id) DO NOTHING`).run(userId,flag.id,flag.row.userId,flag.catalog);
  };
  const playerSp=working=>{
    const rows=working?.get('UserInfo') ?? read('UserInfo').data;
    need(rows.length===1 && rows[0].userId===userId,'Abyss SP requires one owned native player save');
    return serialPvpSpStatus(rows[0].playerStatus);
  };
  const ticketReceipt=row=>{
    let baseline,candidates,before,after;
    try {baseline=JSON.parse(row.baseline_json);candidates=JSON.parse(row.candidates_json);
      before=JSON.parse(row.before_json);after=JSON.parse(row.after_json);} catch {need(false,'Abyss ticket capture is unreadable');}
    const target=serialPvpTicketRecovery(baseline,row.ticket_id,row.amount,row.issued_at,master);
    need(long(row.id) && row.id>0 && [0,1].includes(row.stock_saved) && [0,1].includes(row.sp_saved) &&
      Boolean(row.stock_saved || row.sp_saved) &&
      keys(baseline,['serialPvpSP','serialPvpSPUpdatedAt']) &&
      row.serial_pvp_id===target.config.id && row.catalog_hash===target.catalog && equal(candidates,target.candidates) &&
      keys(before,['amount','cumulativeAmount','reservedAmount','lastResetAt']) &&
      ['amount','cumulativeAmount','reservedAmount'].every(key=>int(before[key]) && before[key]<=999999999) &&
      long(before.lastResetAt) && before.amount<=before.cumulativeAmount && before.amount>=row.amount &&
      equal(after,{...before,amount:before.amount-row.amount}),
    'Abyss ticket recovery has lost its original debit/catalog/stock proof');
    return {...row,...target,stockAfter:after};
  };
  const ticketStockState=()=>{
    const rows=serialPvpTicketRows(read(ticketTable).data,master,userId),floors=new Map();
    for(const floor of db.prepare('SELECT * FROM serial_pvp_ticket_stock').all()) {
      let stock;try {stock=JSON.parse(floor.stock_json);} catch {need(false,'Abyss ticket stock checkpoint is unreadable');}
      need(rows.has(floor.ticket_id) && long(floor.use_id) && equal(stock,ticketStock(rows.get(floor.ticket_id))),
        'Saved Abyss ticket stock cannot be removed, restored or rewound');
      floors.set(floor.ticket_id,floor);
    }
    //50 original ticket IDs, indexed newest-use seeks, never a lifetime SUM.
    const ids=Object.keys(master?.serialPvp?.serialPvpSpTicketItem ?? {}).map(Number);
    need(ids.length || !db.prepare('SELECT 1 FROM serial_pvp_ticket_use LIMIT 1').get(),
      'Original Abyss ticket catalog is missing; consumption history retained');
    for(const id of ids) {
      const latest=db.prepare('SELECT * FROM serial_pvp_ticket_use WHERE ticket_id=? ORDER BY id DESC LIMIT 1').get(id);
      need(!latest || floors.get(id)?.use_id===latest.id,'Abyss ticket consumption has lost its stock checkpoint');
      need(!floors.has(id) || floors.get(id).use_id===(latest?.id ?? 0),'Abyss ticket stock has an unknown consumption checkpoint');
      if(latest) {
        const receipt=ticketReceipt(latest),current=ticketStock(rows.get(id)),after=receipt.stockAfter;
        need(receipt.stock_saved ? current.cumulativeAmount>=after.cumulativeAmount &&
          current.amount-after.amount===current.cumulativeAmount-after.cumulativeAmount &&
          current.reservedAmount===after.reservedAmount && current.lastResetAt===after.lastResetAt : equal(current,receipt.before),
          'Saved Abyss stock has lost its latest ticket debit/acquisition conservation');
      }
    }
    return {rows,floors};
  };
  const pendingTicket=()=>{
    const pending=db.prepare('SELECT * FROM serial_pvp_ticket_use WHERE stock_saved=0 OR sp_saved=0 LIMIT 2').all();
    need(pending.length<=1,'Multiple pending Abyss ticket recoveries require reconciliation');
    if(!pending.length) return null;
    const receipt=ticketReceipt(pending[0]),stock=ticketStockState();
    const expected=receipt.stock_saved?receipt.stockAfter:receipt.before;
    need(stock.floors.get(receipt.ticket_id)?.use_id===receipt.id && equal(expected,ticketStock(stock.rows.get(receipt.ticket_id))),
      'Pending Abyss ticket recovery has an intervening stock change');
    return receipt;
  };
  const ticketAcquisition=(itemId,baseline)=>{
    need(!pendingTicket(),'Abyss ticket recovery must save before another item award');
    need((ticketStockState().rows.get(itemId)?.cumulativeAmount ?? 0)===baseline,
      'Abyss item-award baseline differs from its saved ticket stock');
  };
  const refillReceipt=operation=>{
    const row=db.prepare('SELECT * FROM serial_pvp_sp_refill WHERE operation_id=?').get(operation.id),
      common=db.prepare('SELECT * FROM hard_currency_consume WHERE operation_id=?').get(operation.id);
    need(operation.type===10600 && keys(operation.parameters,[]) && row && long(row.issued_at),
      'Abyss refill has no captured native resource contract; legacy purchase retained');
    let baseline,candidates;
    try {baseline=JSON.parse(row.baseline_json);candidates=JSON.parse(row.candidates_json);} catch {need(false,'Abyss refill capture is unreadable');}
    need(keys(baseline,['serialPvpSP','serialPvpSPUpdatedAt']),'Abyss refill baseline is incomplete');
    const expected=serialPvpRefill(baseline,row.issued_at,master),minimum=Math.min(...expected.candidates.map(value=>value.after.serialPvpSP)),
      before=Math.min(...expected.candidates.map(value=>value.before.serialPvpSP));
    need(row.serial_pvp_id===expected.config.id && row.catalog_hash===expected.config.catalog && equal(candidates,expected.candidates) &&
      common?.sp_field==='serialPvpSP' && common.sp_before===before && common.sp_minimum===minimum &&
      common.consume_id===81071001 && common.type===10600 && common.iris_cost===master.consumes[81071001].amount &&
      [0,1].includes(common.effect_saved),'Abyss refill catalog/cost/target requires reconciliation');
    return {...row,...expected,common};
  };
  const pendingRefill=()=>{
    const queued=db.prepare('SELECT * FROM operation_queue WHERE type=10600').all();
    need(queued.length<=1,'Multiple queued Abyss refills require reconciliation');
    if(!queued.length) return null;
    let parameters;
    try {parameters=JSON.parse(queued[0].parameters);} catch {need(false,'Abyss refill queue is unreadable');}
    return refillReceipt({...queued[0],parameters});
  };
  const refillTarget=()=>{
    eligibility();
    need(!activeBattle(),'Finish the captured Abyss battle before buying another attempt');
    need(!pendingRefill(),'Previous Abyss refill must save and acknowledge before another purchase');
    need(!pendingEntries().length,'Abyss run entry must save before buying another attempt');
    need(!pendingTicket(),'Abyss ticket recovery must save before buying another attempt');
    const at=now(),target=serialPvpRefill(playerSp(),at,master);
    return {...target,at,before:Math.min(...target.candidates.map(row=>row.before.serialPvpSP)),
      minimum:Math.min(...target.candidates.map(row=>row.after.serialPvpSP))};
  };
  const recordRefill=(operation,target)=>{
    recordUnlock(unlockSnapshot());
    db.prepare(`INSERT INTO serial_pvp_sp_refill(operation_id,serial_pvp_id,catalog_hash,
      issued_at,baseline_json,candidates_json) VALUES(?,?,?,?,?,?)`).run(operation.id,target.config.id,target.config.catalog,target.at,
        JSON.stringify(target.baseline),JSON.stringify(target.candidates));
  };
  const refillObserved=(operation,working)=>{
    if(!working.has('UserInfo')) return false;
    const receipt=refillReceipt(operation),after=playerSp(working);
    const before=playerSp();
    return (equal(before,receipt.baseline) || receipt.candidates.some(row=>equal(before,row.before))) &&
      receipt.candidates.some(row=>equal(after,row.after));
  };
  const refillDelivery=(operation,action)=>{
    const receipt=refillReceipt(operation);
    if(receipt.common.effect_saved) {
      need(action==='user_data/push','Saved Abyss refill must acknowledge before additive callback redelivery');
      return false;
    }
    const config=serialPvpSpConfig(now(),master),current=playerSp();
    need(config?.id===receipt.serial_pvp_id && config.catalog===receipt.catalog_hash &&
      (equal(current,receipt.baseline) || receipt.candidates.some(row=>equal(current,row.before))),
    'Pending Abyss refill cannot redeliver across another season or changed native resource baseline');
    return true;
  };
  const rows=(name,working)=>serialPvpRows(name,working?.get(name) ?? read(name).data,master,userId);
  const capture=(id,working)=>Object.fromEntries(tables.map(name=>[name,rows(name,working).get(id) ?? null]));
  const pendingEntries=()=>db.prepare('SELECT serial_pvp_id FROM serial_pvp_run_entry WHERE observed=0').all();
  const entryMatches=(entry,after)=>entry.candidates.some(row=>after.serialPvpSP===row.after.serialPvpSP &&
    (row.before.serialPvpSP>=entry.config.naturalCap ? after.serialPvpSPUpdatedAt>=entry.issued_at-5 &&
      after.serialPvpSPUpdatedAt<=entry.issued_at+120 : after.serialPvpSPUpdatedAt===row.after.serialPvpSPUpdatedAt));
  const entryReceipt=(saved,lobby)=>{
    need(keys(saved,['serial_pvp_id','generation','grade_id','request_key','catalog_hash','issued_at','baseline_json',
      'candidates_json','observed','observed_json']) && long(saved.serial_pvp_id) && saved.serial_pvp_id>0 &&
      typeof saved.request_key==='string' && saved.request_key.length>0,
      'Abyss run-entry capture has incomplete identity/fields');
    const id=saved.serial_pvp_id,request=db.prepare('SELECT * FROM serial_pvp_lobby_request WHERE request_key=?').get(saved.request_key);
    need(lobby && lobby.serial_pvp_id===id && lobby.catalog_hash===catalog && int(saved.generation) && lobby.generation>=saved.generation &&
      lobby.grade_id===saved.grade_id && saved.grade_id>0 &&
      (lobby.generation!==saved.generation || lobby.issued_at===saved.issued_at) && request?.action==='serial_pvp/grade/select' &&
      request.serial_pvp_id===id && request.generation===saved.generation &&
      [0,1].includes(saved.observed) && long(saved.issued_at),'Abyss run-entry capture has lost its selected lobby');
    let baseline,candidates,observed;
    try {baseline=JSON.parse(saved.baseline_json);candidates=JSON.parse(saved.candidates_json);
      observed=saved.observed_json===null?null:JSON.parse(saved.observed_json);}
    catch {need(false,'Abyss run-entry capture is unreadable');}
    need(keys(baseline,['serialPvpSP','serialPvpSPUpdatedAt']),'Abyss run-entry baseline is incomplete');
    need(request.response===JSON.stringify(response('serial_pvp/grade/select',
      {...saved,rivals:serialPvpCpuRivals(id,saved.grade_id,saved.generation,master)},null)),
    'Abyss run-entry selected-grade response requires reconciliation');
    const expected=serialPvpRunEntry(baseline,saved.issued_at,master),entry={...saved,...expected};
    need(expected.config.id===id && saved.catalog_hash===expected.config.catalog && equal(candidates,expected.candidates) &&
      (saved.observed ? keys(observed,['serialPvpSP','serialPvpSPUpdatedAt']) && equal(observed,serialPvpSpStatus(observed)) &&
        entryMatches(entry,observed):observed===null),'Abyss run-entry target/observation requires reconciliation');
    return {...entry,observedSp:observed};
  };
  const runEntry=id=>{
    const saved=db.prepare('SELECT * FROM serial_pvp_run_entry WHERE serial_pvp_id=?').get(id);
    return saved?entryReceipt(saved,db.prepare('SELECT * FROM serial_pvp_lobby WHERE serial_pvp_id=?').get(id)):null;
  };
  const lobbyReceipt=saved=>{
    const id=saved.serial_pvp_id;
    need(long(id) && id>0 && saved.catalog_hash===catalog && int(saved.generation) && long(saved.issued_at) &&
      [0,1].includes(saved.pending_status) && [0,1].includes(saved.pending_usage),
      'Abyss lobby catalog/capture requires reconciliation');
    let before,after,rivals;
    try {before=JSON.parse(saved.before_json);after=JSON.parse(saved.after_json);rivals=JSON.parse(saved.rivals_json);}
    catch {need(false,'Abyss lobby capture is unreadable');}
    need(keys(before,tables) && keys(after,tables),'Abyss lobby checkpoint is incomplete');
    for(const value of [before,after]) for(const name of tables)
      if(value[name]) need(value[name].serialPvpId===id &&
        equal(value[name],serialPvpRows(name,[value[name]],master,userId).get(id)),
      'Abyss checkpoint belongs to another season or has noncanonical fields');
    need(equal(before[tables[0]],after[tables[0]]) && equal(rivals,saved.grade_id?
      serialPvpCpuRivals(id,saved.grade_id,saved.generation,master):[]),'Abyss lobby capture is inconsistent');
    if(!saved.grade_id) need(equal(before,after) && !saved.pending_status && !saved.pending_usage,
      'Unselected Abyss lobby cannot contain a reset checkpoint');
    else {
      const expected={...(before[tables[1]] ?? initialStatus(id)),updateRivalList:false,executeRivalListUpdate:false};
      need(after[tables[1]] && statusFields.filter(key=>key!=='lastRivalListUpdateAt').every(key=>after[tables[1]][key]===expected[key]) &&
        after[tables[1]].lastRivalListUpdateAt>=saved.issued_at-5 && after[tables[1]].lastRivalListUpdateAt<=saved.issued_at+120 &&
        (equal(after[tables[2]],before[tables[2]]) || equal(after[tables[2]],initialUsage(id))),
      'Abyss lobby reset target is inconsistent');
    }
    return {...saved,before,after,rivals};
  };
  const state=id=>{
    const saved=db.prepare('SELECT * FROM serial_pvp_lobby WHERE serial_pvp_id=?').get(id);
    if(saved) return lobbyReceipt(saved);
    need(!db.prepare('SELECT 1 FROM serial_pvp_lobby_request WHERE serial_pvp_id=? LIMIT 1').get(id),
      'Abyss lobby history has lost its capture');
    return null;
  };
  const matchingLimit=id=>{
    const season=master.serialPvp.serialPvpInformation[id],limit=master.serialPvp.serialPvpRule[season.slot9].slot6;
    need(int(limit) && limit>0,'Original Abyss opponent-refresh quota unavailable');return limit;
  };
  const matchingCheckpoint=saved=>{
    const row=db.prepare('SELECT * FROM serial_pvp_matching_checkpoint WHERE serial_pvp_id=?').get(saved.serial_pvp_id),
      baseline=saved.after[tables[1]]?.updatedMatchingCount ?? 0;
    need(int(baseline) && baseline<=matchingLimit(saved.serial_pvp_id) && (!row || int(row.generation) &&
      row.generation<=saved.generation),'Abyss refresh generation/quota requires reconciliation');
    if(!row || row.generation!==saved.generation) return {count:baseline,resetPending:0};
    need(int(row.count) && row.count<=matchingLimit(saved.serial_pvp_id) && [0,1].includes(row.reset_pending) &&
      (!row.reset_pending || row.count===0),'Abyss refresh counter has lost its saved intent');
    return {count:row.count,resetPending:row.reset_pending};
  };
  const writeMatching=(id,generation,value)=>db.prepare(`INSERT INTO serial_pvp_matching_checkpoint(serial_pvp_id,generation,count,reset_pending)
    VALUES(?,?,?,?) ON CONFLICT(serial_pvp_id) DO UPDATE SET generation=excluded.generation,count=excluded.count,reset_pending=excluded.reset_pending`)
    .run(id,generation,value.count,value.resetPending);
  const runProof=parent=>{
    const archive=db.prepare('SELECT * FROM serial_pvp_run_archive WHERE serial_pvp_id=? AND generation=?')
      .get(parent.serial_pvp_id,parent.lobby_generation);
    let rawLobby,rawEntry;
    if(archive) {
      need(archive.catalog_hash===catalog,'Archived Abyss run has changed original catalog');
      try {rawLobby=JSON.parse(archive.lobby_json);rawEntry=JSON.parse(archive.entry_json);}
      catch {need(false,'Archived Abyss run proof is unreadable');}
      need(rawLobby && rawEntry && rawLobby.serial_pvp_id===archive.serial_pvp_id && rawLobby.generation===archive.generation,
        'Archived Abyss run identity is inconsistent');
      // CPU teams are deterministic original-catalog projections. Avoid
      //copying all five large vectors into every run's history row.
      if(!Object.hasOwn(rawLobby,'rivals_json')) rawLobby.rivals_json=JSON.stringify(serialPvpCpuRivals(
        rawLobby.serial_pvp_id,rawLobby.grade_id,rawLobby.generation,master));
    } else {
      rawLobby=db.prepare('SELECT * FROM serial_pvp_lobby WHERE serial_pvp_id=?').get(parent.serial_pvp_id);
      rawEntry=db.prepare('SELECT * FROM serial_pvp_run_entry WHERE serial_pvp_id=?').get(parent.serial_pvp_id);
    }
    need(rawLobby && rawEntry,'Abyss battle has lost its selected-run proof');
    const lobby=lobbyReceipt(rawLobby),entry=entryReceipt(rawEntry,lobby);
    need(!lobby.pending_status && !lobby.pending_usage && lobby.generation===parent.lobby_generation &&
      lobby.grade_id===parent.grade_id && entry.observed===1 && entry.generation===parent.entry_generation &&
      entry.grade_id===parent.grade_id,'Abyss battle has lost its saved original lobby/run attempt');
    return {lobby,entry,rawLobby,rawEntry};
  };
  const archiveRun=parent=>{
    const proof=runProof(parent);
    const lobby={...proof.rawLobby};delete lobby.rivals_json;
    // Freeze only an already-validated, saved run before replacing its
    //mutable lobby/entry. No native flags, attempts or signatures are changed.
    db.prepare(`INSERT OR IGNORE INTO serial_pvp_run_archive(serial_pvp_id,generation,catalog_hash,lobby_json,entry_json)
      VALUES(?,?,?,?,?)`).run(parent.serial_pvp_id,parent.lobby_generation,catalog,
        JSON.stringify(lobby),JSON.stringify(proof.rawEntry));
    runProof(parent);
  };
  const pending=()=>db.prepare('SELECT serial_pvp_id FROM serial_pvp_lobby WHERE pending_status=1 OR pending_usage=1').all();
  const access=(action,value,allowPending=false,matching=action!=='serial_pvp/summary/get')=>{
    need(!activeBattle(),'Captured Abyss combat must finish before a lobby callback can clear its processing state');
    need(!pendingTicket(),'Abyss ticket recovery must save before another lobby callback');
    const fields=action.endsWith('/summary/get')?['serialPvpId',...(Object.hasOwn(value ?? {},'userId')?['userId']:[])]:['serialPvpId','gradeId'];
    if(!keys(value,fields) || !long(value.serialPvpId) || value.serialPvpId===0 ||
        Object.hasOwn(value,'userId') && (!long(value.userId) || !value.userId) ||
        action!=='serial_pvp/summary/get' && (!long(value.gradeId) || !value.gradeId))
      throw Object.assign(new Error('Invalid Abyss lobby request'),{status:400});
    need(!value.userId || value.userId===userId,'Remote Abyss summaries are unavailable offline');
    eligibility();
    const season=master?.serialPvp?.serialPvpInformation?.[value.serialPvpId],at=now();
    // Summary is a display-period read, not permission to start combat.
    // Equal matching start/end is disabled original data, NEVER an open future.
    need(season && long(season.slot3) && long(season.slot4) && season.slot3<season.slot4 &&
      (matching ? at>=season.slot3 && at<season.slot4:serialPvpSeasonAt(at,master)?.id===value.serialPvpId),
    matching?'Abyss matching unavailable at this event date':'Abyss summary unavailable outside the original display period');
    if(matching) need(!db.prepare('SELECT 1 FROM serial_pvp_ranking_reward WHERE user_id=? AND serial_pvp_id=?').get(userId,value.serialPvpId),
      'Rewarded Abyss season cannot reopen matching after an event-clock rewind');
    if(value.gradeId) need(master.serialPvp.serialPvpGrade?.[value.gradeId]?.slot1===season.slot10,
      'Abyss grade belongs to another original group');
    idleContext(value.serialPvpId);
    const finished=latestFinish(value.serialPvpId);
    if(finished) {
      const saved=state(value.serialPvpId),current=endCurrent(finished),entry=runEntry(value.serialPvpId);
      const nextRun=entry?.generation>finished.parent.entry_generation;
      need(action!=='serial_pvp/rival_list/update' || nextRun || !finished.cycle.closed,
        'Select a fresh Abyss run before replacing completed opponents');
      if(entry && !entry.observed) need(equal(playerSp(),entry.baseline) || entry.candidates.some(row=>equal(playerSp(),row.before)),
        'Pending Abyss run entry has an intervening resource change');
      if(!allowPending && action!=='serial_pvp/summary/get') {
        need(!pending().length && !pendingEntries().length,'Previous Abyss lobby/run-entry checkpoint must save first');
        if(action==='serial_pvp/grade/select') need(!pendingRefill(),'Abyss refill must settle before starting a new run');
      }
      return {id:value.serialPvpId,at,current,saved};
    }
    const current=capture(value.serialPvpId),saved=state(value.serialPvpId);
    // Retain unknown legacy progress without a completed battle receipt,
    // never reinterpret high score as current score or reset it on entry.
    need(!current[tables[0]] || equal(current[tables[0]],initialRecord(value.serialPvpId,current[tables[0]].userId)),
      'Abyss progress has no recovered battle receipt; history retained');
    need(!current[tables[1]] || current[tables[1]].lastBattleStartAt===0 &&
      current[tables[1]].updatedMatchingCount===(saved?matchingCheckpoint(saved).count:0),
      'Abyss battle/matching counters require recovery');
    need(!current[tables[2]] || !current[tables[2]].usedPcList.length && !current[tables[2]].usedMemoriaList.length,
      'Abyss used-unit history cannot be reset by a lobby request');
    if(saved) validateCheckpoint(saved,current);
    const entry=runEntry(value.serialPvpId);
    if(entry && !entry.observed) need(equal(playerSp(),entry.baseline) || entry.candidates.some(row=>equal(playerSp(),row.before)),
      'Pending Abyss run entry has an intervening resource change');
    if(!allowPending && action!=='serial_pvp/summary/get') {
      need(!pending().length && !pendingEntries().length,'Previous Abyss lobby/run-entry checkpoint must save before replacing opponents');
      need(!saved?.grade_id || entry,'Legacy Abyss selection has no captured attempt contract; selected run retained');
      if(action==='serial_pvp/grade/select') need(!pendingRefill(),'Abyss refill must settle before starting a new run');
    }
    return {id:value.serialPvpId,at,current,saved};
  };
  function validateCheckpoint(saved,current,battle=null,round=null,matching=null) {
    for(const [name,key] of [[tables[1],'pending_status'],[tables[2],'pending_usage']]) {
      if(saved[key]) need(equal(current[name],saved.before[name]) || equal(current[name],saved.after[name]),
        'Pending Abyss native checkpoint does not match its captured baseline/target');
      else if(saved.after[name]) {
        const prior=saved.after[name],actual=current[name];
        // UI booleans may become dirty before requesting a new list. Counter
        //changes require an observed native increment/reset; timestamp is pinned.
        need(actual && (name===tables[1] ? actual.userId===prior.userId &&
          actual.lastRivalListUpdateAt===prior.lastRivalListUpdateAt &&
          actual.lastBattleStartAt===(battle?.serial_pvp_id===saved.serial_pvp_id && battle.observed.includes('statusTime') ?
            battle.last_battle_start_at:round?.parent.last_battle_start_at ?? prior.lastBattleStartAt) &&
          actual.updatedMatchingCount===(matching?.count ?? matchingCheckpoint(saved).count) :
          equal(actual,battle?.before?.rows[tables[2]] ?? round?.usage ?? prior)),
        'Saved Abyss checkpoint cannot be deleted, rewound or replaced');
      }
    }
  }
  const response=(action,saved,current)=>{
    if(action==='serial_pvp/summary/get') {
      const finished=saved?latestFinish(saved.serial_pvp_id):null;
      const sameRun=finished && runEntry(saved.serial_pvp_id)?.generation===finished.parent.entry_generation;
      const completed=sameRun && finished.cycle.closed;
      const continuing=sameRun && !finished.cycle.closed;
      return {code:0,result:0,serialPvpRecord:current[tables[0]]?[current[tables[0]]]:[],
      ...(current[tables[2]]?{serialPvpUsingLimitData:continuing?finished.usage:current[tables[2]]}:{}),
      currentScore:continuing?finished.cycle.scores.reduce((sum,score)=>sum+score,0):0,
      selectedGradeId:completed?0:saved?.grade_id ?? 0,currentWinCount:continuing?finished.cycle.wins:0,existResult:Boolean(completed),
      rivalList:completed?[]:saved?.rivals ?? [],serialPvpRanking:localRanking(saved.serial_pvp_id,current[tables[0]])};
    }
    return {code:0,result:0,gradeId:saved.grade_id,rivalList:saved.rivals,
      ...(action==='serial_pvp/grade/select'?{serialPvpUsingLimitData:{serialPvpId:saved.serial_pvp_id,usedPcList:[],usedMemoriaList:[]}}:{})};
  };
  const startProofs=['info','processing','statusFlag','statusTime'];
  const requiredStartProofs=before=>before?.matching && before.rows?.[tables[1]]?.updatedMatchingCount>0 ?
    [...startProofs,'matchingReset']:startProofs;
  const battleInput=(action,value)=>{
    const start=action==='serial_pvp/battle/start';
    if(!keys(value,start?['serialPvpId','userId','userParty','partyIndex']:['serialPvpId','userId']) ||
      !long(value.serialPvpId) || !value.serialPvpId || !long(value.userId) || !value.userId ||
      start && (!int(value.partyIndex) || !value.partyIndex))
      throw Object.assign(new Error('Invalid native Abyss battle request'),{status:400});
    if(start) validateParty(value.userParty);
    need(value.userId!==userId,'Abyss opponent must be a captured offline CPU');
    return value;
  };
  const battleResponse=(id,grade,rival,record,battleId,seed)=>({code:0,result:0,battleId,serialPvpId:id,
    preRank:rival.serialPvpPlayerInfo.preRank,randomSeed:seed,serialPvpPlayerInfo:rival.serialPvpPlayerInfo,
    serialPvpParty:rival.serialPvpParty,substitutedSpineIds:[],serialPvpRecord:record?[record]:[],selectedGradeId:grade});
  const battleReceipt=battleId=>{
    const saved=db.prepare('SELECT * FROM serial_pvp_battle WHERE battle_id=?').get(battleId);
    need(saved && saved.closed===0 && saved.catalog_hash===catalog && long(saved.issued_at) &&
      long(saved.rival_id) && saved.rival_id>0 && int(saved.party_index) && saved.party_index>0 &&
      long(saved.owned_party_id) && saved.owned_party_id>0,'Abyss battle capture/catalog requires reconciliation');
    const {lobby}=runProof(saved);
    let before,own,result,operation,observed;
    try {before=JSON.parse(saved.before_json);own=JSON.parse(saved.own_party_json);result=JSON.parse(saved.response_json);
      operation=JSON.parse(saved.operation_json);observed=JSON.parse(saved.observed_json);}
    catch {need(false,'Abyss battle capture is unreadable');}
    need(keys(before,['rows','info','processing','sp',...(Object.hasOwn(before ?? {},'cycle')?['cycle']:[]),
      ...(Object.hasOwn(before ?? {},'matching')?['matching']:[])]) &&
      keys(before.rows,tables) && before.processing===0 &&
      keys(before.info,['userId','resumeRivalUserId']) && before.info.userId===userId && long(before.info.resumeRivalUserId) &&
      keys(before.sp,['serialPvpSP','serialPvpSPUpdatedAt']) && equal(before.sp,serialPvpSpStatus(before.sp)),
    'Abyss battle native baseline is incomplete');
    for(const name of tables) if(before.rows[name]) need(equal(before.rows[name],
      serialPvpRows(name,[before.rows[name]],master,userId).get(saved.serial_pvp_id)),
    'Abyss battle baseline belongs to another season');
    need(long(before.rows[tables[1]]?.lastBattleStartAt) &&
      before.rows[tables[2]],'Abyss round native baseline requires reconciliation');
    const previous=priorRound(before,saved);
    need(equal(before.rows[tables[0]],previous?previous.record:lobby.after[tables[0]]) ||
      !previous && !lobby.after[tables[0]] && equal(before.rows[tables[0]],initialRecord(saved.serial_pvp_id,before.rows[tables[0]]?.userId)),
      'Abyss round has lost its saved score-record baseline');
    if(!previous) need(!before.rows[tables[2]].usedPcList.length && !before.rows[tables[2]].usedMemoriaList.length,
      'Fresh Abyss run has unissued used-unit history');
    if(before.matching) need(keys(before.matching,['count','resetPending']) && int(before.matching.count) &&
      before.matching.count<=matchingLimit(saved.serial_pvp_id) && [0,1].includes(before.matching.resetPending) &&
      before.matching.count===before.rows[tables[1]].updatedMatchingCount && (!before.matching.resetPending || before.matching.count===0),
      'Captured Abyss refresh/reset intent is inconsistent');
    validateCheckpoint(lobby,before.rows,null,previous,before.matching ?? {count:lobby.after[tables[1]].updatedMatchingCount});
    try {validateParty(own);} catch {need(false,'Captured owned Abyss combat party is invalid');}
    serialPvpPartyReady(before.rows[tables[2]],own);
    const rival=lobby.rivals.find(row=>row.serialPvpPlayerInfo.userId===saved.rival_id);
    need(rival && typeof result?.battleId==='string' && result.battleId===battleId && /^abyss-[0-9a-f-]{36}$/.test(battleId) &&
      int(result.randomSeed) && result.randomSeed>0 && equal(result,battleResponse(saved.serial_pvp_id,saved.grade_id,rival,
        before.rows[tables[0]],battleId,result.randomSeed)),'Abyss battle response differs from its frozen original CPU');
    need(keys(operation,['id','type','parameters','token','signature']) && operation.id===saved.operation_id &&
      long(operation.id) && operation.id>0 && operation.type===30200 && equal(operation.parameters,result) &&
      /^[0-9a-f]{32}$/.test(operation.token) && int(operation.signature) && operation.signature>0,
    'Abyss30200 capture has lost its exact native callback/queue envelope');
    const queued=db.prepare('SELECT * FROM operation_queue WHERE id=?').get(operation.id),
      done=Boolean(db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id));
    need(Boolean(queued)!==done && (!queued || queued.type===operation.type && queued.token===operation.token &&
      queued.signature===operation.signature && queued.parameters===JSON.stringify(operation.parameters)),
    'Abyss30200 queue/acknowledgement has lost its capture');
    need(Array.isArray(observed) && observed.every(key=>requiredStartProofs(before).includes(key)) &&
      equal(observed,[...new Set(observed)].sort()) && long(saved.last_battle_start_at) &&
      (observed.includes('statusTime') ? saved.last_battle_start_at>0 && saved.last_battle_start_at>=saved.issued_at-5 &&
        saved.last_battle_start_at<=saved.issued_at+120:saved.last_battle_start_at===0) &&
      (!done || requiredStartProofs(before).filter(key=>key!=='statusTime').every(key=>observed.includes(key))),
    'Abyss30200 save/acknowledgement proof requires reconciliation');
    return {...saved,before,own,result,operation,observed,done};
  };
  const activeBattle=()=>{
    const active=db.prepare('SELECT battle_id FROM serial_pvp_active WHERE user_id=?').get(userId),
      open=db.prepare('SELECT battle_id FROM serial_pvp_battle WHERE closed=0 LIMIT 2').all();
    if(!active) {need(!open.length,'Unfinished Abyss battle has lost its active pointer');return null;}
    need(open.length===1 && open[0].battle_id===active.battle_id,'Abyss active battle pointer is inconsistent');
    return battleReceipt(active.battle_id);
  };
  const ownedBattleInfo=working=>{
    const player=working?.get('UserInfo') ?? read('UserInfo').data,
      info=working?.get('UserSerialPvpInfo') ?? read('UserSerialPvpInfo').data;
    need(player.length===1 && player[0].userId===userId && info.length===1 &&
      keys(info[0],['userId','resumeRivalUserId']) && info[0].userId===userId,
    'Abyss battle requires one owned processing/resume save');
    return {player:player[0],info:project(info[0],['userId','resumeRivalUserId'])};
  };
  const endResponse=(battle,before,verdict,settle=false,at=0)=>{
    const cycle=before.cycle?serialPvpCycle(before.cycle,verdict,master):
      {scores:[verdict.result.attack_result.roundScore],wins:0,closed:true};
    const record=settle?serialPvpScoreRecord(before.rows[tables[0]],battle,cycle,verdict,at,master):before.rows[tables[0]];
    return {code:0,result:0,serialPvpId:battle.serial_pvp_id,
    serialPvpRecord:record?[record]:[],
    selectedGradeId:cycle.closed?0:battle.grade_id,currentWinCount:cycle.wins,
    cycleScores:cycle.scores,existResult:cycle.closed,
    serialPvpResult:{serialPvpId:battle.serial_pvp_id,score:verdict.result.attack_result.roundScore,
      gradeId:battle.grade_id,isWin:verdict.result.isWin}};
  };
  const priorRound=(before,parent,depth=0)=>{
    const prior=before.cycle ?? emptyCycle();
    // At most four predecessors in an active five-round run. No lifetime
    //scan or recursive traversal into a previous run's result.
    need(depth<5 && keys(prior,['previousBattleId','scores','wins']) && int(prior.wins) && prior.wins<5 &&
      Array.isArray(prior.scores) && prior.scores.length===prior.wins && prior.scores.every(int),
      'Abyss round chain requires reconciliation');
    if(!prior.wins) {need(prior.previousBattleId===null,'Fresh Abyss round has an unexpected predecessor');return null;}
    const previous=endReceipt(prior.previousBattleId,depth+1);
    need(previous?.done && !previous.cycle.closed && previous.parent.entry_generation===parent.entry_generation &&
      previous.parent.grade_id===parent.grade_id && previous.serial_pvp_id===parent.serial_pvp_id &&
      previous.cycle.wins===prior.wins && equal(previous.cycle.scores,prior.scores) &&
      previous.operation_id<parent.operation_id && equal(before.info,previous.before.info) &&
      equal(before.rows[tables[0]],previous.record) && equal(before.rows[tables[2]],previous.usage),
      'Abyss later round has lost its saved winning predecessor');
    const handoff=usageHandoff(previous);
    need(handoff?.observed===1,'Abyss later round waits for its native used-unit summary save');
    return previous;
  };
  const endReceipt=(battleId,depth=0)=>{
    const saved=db.prepare('SELECT * FROM serial_pvp_end WHERE battle_id=?').get(battleId);
    if(!saved) return null;
    const parent=db.prepare('SELECT * FROM serial_pvp_battle WHERE battle_id=?').get(battleId);
    need(depth<5 && [endCatalog,streakCatalog,scoreCatalog].includes(saved.catalog_hash) && long(saved.issued_at) && [0,1].includes(saved.processing_saved) &&
      parent?.catalog_hash===catalog && parent.serial_pvp_id===saved.serial_pvp_id &&
      parent.last_battle_start_at>0 && db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(parent.operation_id) &&
      !db.prepare('SELECT 1 FROM operation_queue WHERE id=?').get(parent.operation_id),
    'Abyss finish has lost its complete30200/native-start capture');
    const {lobby}=runProof(parent);
    let verdict,before,result,operation,startBefore,own,proofs,startResult,startOperation;
    try {verdict=JSON.parse(saved.verdict_json);before=JSON.parse(saved.before_json);result=JSON.parse(saved.response_json);
      operation=JSON.parse(saved.operation_json);startBefore=JSON.parse(parent.before_json);own=JSON.parse(parent.own_party_json);
      proofs=JSON.parse(parent.observed_json);startResult=JSON.parse(parent.response_json);
      startOperation=JSON.parse(parent.operation_json);}
    catch {need(false,'Abyss finish capture is unreadable');}
    try {serialPvpEndInput(verdict,master,parent.grade_id);} catch {need(false,'Abyss captured finish has an invalid native score/verdict');}
    const settle=saved.catalog_hash===scoreCatalog,streak=settle || saved.catalog_hash===streakCatalog;
    need(verdict.battleId===battleId && verdict.serialPvpId===saved.serial_pvp_id && (streak || !verdict.result.isWin) &&
      equal(proofs,[...requiredStartProofs(startBefore)].sort()) && keys(before,['rows','info','processing',...(streak?['cycle']:[])]) && keys(before.rows,tables) &&
      keys(startBefore,['rows','info','processing','sp',...(Object.hasOwn(startBefore ?? {},'cycle')?['cycle']:[]),
        ...(Object.hasOwn(startBefore ?? {},'matching')?['matching']:[])]) && keys(startBefore.rows,tables) &&
      (!streak || equal(before.cycle,startBefore.cycle ?? emptyCycle())) &&
      startBefore.processing===0 && keys(startBefore.info,['userId','resumeRivalUserId']) &&
      startBefore.info.userId===userId && long(startBefore.info.resumeRivalUserId) &&
      keys(startBefore.sp,['serialPvpSP','serialPvpSPUpdatedAt']) && equal(startBefore.sp,serialPvpSpStatus(startBefore.sp)) &&
      int(parent.lobby_generation) && parent.lobby_generation>=0 && long(parent.grade_id) && parent.grade_id>0 &&
      long(parent.rival_id) && parent.rival_id>0 && long(parent.owned_party_id) && parent.owned_party_id>0 &&
      int(parent.party_index) && parent.party_index>0 && long(parent.issued_at) &&
      parent.last_battle_start_at>=parent.issued_at-5 && parent.last_battle_start_at<=parent.issued_at+120 &&
      before.processing===1 && equal(before.info,{userId,resumeRivalUserId:parent.rival_id}),
    'Abyss finish identity/baseline is inconsistent');
    for(const name of tables) if(startBefore.rows[name]) need(equal(startBefore.rows[name],
      serialPvpRows(name,[startBefore.rows[name]],master,userId).get(saved.serial_pvp_id)),
    'Abyss finished start has a noncanonical native season baseline');
    const previous=priorRound(startBefore,parent,depth);
    need(equal(startBefore.rows[tables[0]],previous?previous.record:lobby.after[tables[0]]) ||
      !previous && !lobby.after[tables[0]] && equal(startBefore.rows[tables[0]],initialRecord(saved.serial_pvp_id,startBefore.rows[tables[0]]?.userId)),
      'Finished Abyss round has lost its saved score-record baseline');
    if(startBefore.matching) need(keys(startBefore.matching,['count','resetPending']) && int(startBefore.matching.count) &&
      startBefore.matching.count<=matchingLimit(saved.serial_pvp_id) && [0,1].includes(startBefore.matching.resetPending) &&
      startBefore.matching.count===startBefore.rows[tables[1]].updatedMatchingCount &&
      (!startBefore.matching.resetPending || startBefore.matching.count===0),'Finished Abyss refresh/reset intent is inconsistent');
    validateCheckpoint(lobby,startBefore.rows,null,previous,startBefore.matching ?? {count:lobby.after[tables[1]].updatedMatchingCount});
    const rival=serialPvpCpuRivals(parent.serial_pvp_id,parent.grade_id,parent.lobby_generation,master)
      .find(row=>row.serialPvpPlayerInfo.userId===parent.rival_id);
    need(rival && int(startResult.randomSeed) && startResult.randomSeed>0 && equal(startResult,
      battleResponse(parent.serial_pvp_id,parent.grade_id,rival,startBefore.rows[tables[0]],battleId,startResult.randomSeed)) &&
      keys(startOperation,['id','type','parameters','token','signature']) && startOperation.id===parent.operation_id &&
      startOperation.type===30200 && equal(startOperation.parameters,startResult) &&
      /^[0-9a-f]{32}$/.test(startOperation.token) && int(startOperation.signature) && startOperation.signature>0,
    'Abyss finished start/CPU/grade/seed capture is inconsistent');
    for(const name of tables) if(before.rows[name]) need(equal(before.rows[name],
      serialPvpRows(name,[before.rows[name]],master,userId).get(saved.serial_pvp_id)),
    'Abyss finish has a noncanonical native season baseline');
    need(equal(before.rows[tables[0]],startBefore.rows[tables[0]] ??
      (before.rows[tables[0]]?initialRecord(saved.serial_pvp_id,before.rows[tables[0]].userId):null)) &&
      equal(before.rows[tables[2]],startBefore.rows[tables[2]]) && equal(before.rows[tables[1]],
        {...startBefore.rows[tables[1]],...(startBefore.matching?{updatedMatchingCount:0}:{}),
          updateRivalList:true,lastBattleStartAt:parent.last_battle_start_at}) &&
      equal(result,endResponse(parent,before,verdict,settle,saved.issued_at)),
    'Abyss finish changed unimplemented history, turns, rewards or callback fields');
    try {validateParty(own);} catch {need(false,'Abyss finished party capture requires reconciliation');}
    need(keys(operation,['id','type','parameters','token','signature']) && operation.id===saved.operation_id &&
      long(operation.id) && operation.id>0 && operation.type===30100 && equal(operation.parameters,result) &&
      /^[0-9a-f]{32}$/.test(operation.token) && int(operation.signature) && operation.signature>0,
    'Abyss30100 callback/queue envelope is inconsistent');
    const queued=db.prepare('SELECT * FROM operation_queue WHERE id=?').get(operation.id),
      done=Boolean(db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id));
    need(Boolean(queued)!==done && (!queued || queued.type===30100 && queued.token===operation.token &&
      queued.signature===operation.signature && queued.parameters===JSON.stringify(result)) &&
      (done?parent.closed===1 && saved.processing_saved===1:parent.closed===0),
    'Abyss30100 queue/save/acknowledgement capture requires reconciliation');
    const cycle=streak?serialPvpCycle(before.cycle,verdict,master):
      {scores:[verdict.result.attack_result.roundScore],wins:0,closed:true};
    const usage=cycle.closed?before.rows[tables[2]]:serialPvpNextUsage(before.rows[tables[2]],own,master);
    const record=result.serialPvpRecord[0] ?? null,checkpoint=db.prepare('SELECT * FROM serial_pvp_record_handoff WHERE battle_id=?').get(battleId),
      unchanged=equal(record,before.rows[tables[0]]);
    need(settle ? checkpoint?.catalog_hash===scoreCatalog && [0,1].includes(checkpoint.observed) &&
      (!unchanged || checkpoint.observed===1) && (!done || checkpoint.observed===1):!checkpoint,
      'Abyss score record has lost its native save/ACK proof');
    return {...saved,before,verdict,result,operation,parent,own,done,cycle,usage,record,
      record_saved:settle?checkpoint.observed:1};
  };
  const usageHandoff=finish=>{
    const row=db.prepare('SELECT * FROM serial_pvp_usage_handoff WHERE battle_id=?').get(finish.battle_id);
    if(row) need(!finish.cycle.closed && [streakCatalog,scoreCatalog].includes(finish.catalog_hash) && row.catalog_hash===finish.catalog_hash &&
      [0,1].includes(row.issued) && [0,1].includes(row.observed) && (!row.observed || row.issued),
      'Abyss usage summary handoff requires reconciliation');
    return row;
  };
  const finishedResult=id=>{
    const pointer=db.prepare('SELECT battle_id FROM serial_pvp_result WHERE user_id=? AND serial_pvp_id=?').get(userId,id);
    if(!pointer) return null;
    const finish=endReceipt(pointer.battle_id);
    need(finish?.done && finish.cycle.closed && finish.serial_pvp_id===id,'Abyss result pointer has lost its completed native finish');
    return finish;
  };
  const latestFinish=id=>{
    const pointer=db.prepare('SELECT battle_id FROM serial_pvp_progress WHERE user_id=? AND serial_pvp_id=?').get(userId,id);
    if(!pointer) {
      const legacy=finishedResult(id); // Only the original pre-streak defeats lacked this pointer.
      need(!legacy || legacy.catalog_hash===endCatalog,'Saved Abyss round has lost its progress pointer; history retained');
      return legacy;
    }
    const finish=endReceipt(pointer.battle_id);
    need(finish?.done && finish.serial_pvp_id===id,'Abyss progress pointer has lost its saved native round');
    return finish;
  };
  const lastFinishedRound=()=>{
    // Both operation IDs have existing UNIQUE indexes. The newest START,
    //not the newest successful END, prevents skipping a lost/pending capture.
    const last=db.prepare('SELECT battle_id FROM serial_pvp_battle ORDER BY operation_id DESC LIMIT 1').get();
    if(!last) return null;
    const finish=endReceipt(last.battle_id);
    need(finish?.done && latestFinish(finish.serial_pvp_id)?.battle_id===finish.battle_id,
      'Latest Abyss combat must retain its saved finish and progress pointer');
    return finish;
  };
  const bestFinish=(id,record,completed=finishedResult(id))=>{
    const pointer=db.prepare('SELECT battle_id FROM serial_pvp_high_score WHERE user_id=? AND serial_pvp_id=?').get(userId,id),
      best=pointer?endReceipt(pointer.battle_id):null;
    need(!record?.score || pointer,'Abyss saved best score has lost its captured party pointer');
    if(pointer) need(best?.done && best.cycle.closed && best.serial_pvp_id===id &&
      best.record.score>(best.before.rows[tables[0]]?.score ?? 0) &&
      ['score','winCountAtHighScore','gradeIdAtHighScore'].every(key=>best.record[key]===record?.[key]),
      'Abyss best-run party has lost its saved score-record proof');
    return best ?? completed;
  };
  const rankingGiftTitle=id=>`[Offline Abyss ranking] ${master.serialPvp.serialPvpInformation[id].slot2}`;
  const rankingRecordProof=id=>{
    const finish=finishedResult(id),latest=latestFinish(id),record=latest?.record ?? latest?.before.rows[tables[0]],
      actual=capture(id)[tables[0]],best=bestFinish(id,record,finish),
      earned=db.prepare('SELECT * FROM serial_pvp_ranking_reward WHERE user_id=? AND serial_pvp_id=?').get(userId,id);
    let checkpoint=null;
    if(earned) {
      try {checkpoint=JSON.parse(earned.record_json);} catch {need(false,'Abyss ranking reward record is unreadable');}
      need((keys(checkpoint,['record','progressBattleId']) || keys(checkpoint,['record','progressBattleId','published']) &&
        typeof checkpoint.published==='boolean') && equal(checkpoint.record,record) &&
        checkpoint.progressBattleId===latest?.battle_id,'Abyss settlement lost its immutable score/publication checkpoint');
      checkpoint={...checkpoint,published:checkpoint.published ?? false}; // Proven old outboxes upgrade once, without new prizes.
    }
    need(finish && latest?.done && best && int(record?.score) &&
      equal(actual,checkpoint?.published?rankingRecord(record):record),
      'Abyss reward ranking lost its actual closed participation/latest saved score proof');
    // Historical seasons do not own the CURRENT global resume UID/processing.
    //Validate their immutable30100 record proof, not another season's active UI.
    return {finish,latest,record,best,checkpoint};
  };
  const rankingRewardReceipt=id=>{
    const saved=db.prepare('SELECT * FROM serial_pvp_ranking_reward WHERE user_id=? AND serial_pvp_id=?').get(userId,id),
      gifts=db.prepare('SELECT * FROM serial_pvp_ranking_gift WHERE user_id=? AND serial_pvp_id=? ORDER BY reward_id').all(userId,id);
    if(!saved) {need(!gifts.length,'Abyss ranking Presents lost their earned-season receipt');return null;}
    const prize=serialPvpRankingPrize(id,1,master),season=master.serialPvp.serialPvpInformation[id],
      {finish,latest,record:current,best,checkpoint}=rankingRecordProof(id);
    const record=checkpoint.record;
    need(saved.catalog_hash===hash([scoreCatalog,prize.catalog]) && long(saved.issued_at) && saved.issued_at>=season.slot4 &&
      finish?.battle_id===saved.battle_id && best?.battle_id===saved.best_battle_id && equal(record,current) &&
      latest.battle_id===checkpoint.progressBattleId &&
      equal(record,serialPvpRows(tables[0],[record],master,userId).get(id)) && gifts.length===prize.rewards.length,
    'Abyss ranking reward lost its original saved run/score/catalog/Presents');
    for(const row of gifts) {
      let gift;try {gift=JSON.parse(row.gift_json);} catch {need(false,'Abyss ranking Present capture is unreadable');}
      const reward=prize.rewards.find(value=>value.rewardId===row.reward_id);
      need(reward && long(row.gift_id) && row.gift_id>0 && gift && gift.id===row.gift_id && gift.userId===userId &&
        gift.itemId===reward.itemId && gift.amount===reward.amount && gift.title===rankingGiftTitle(id) && gift.message==='' &&
        gift.senderType===1 && gift.senderId===0 && gift.giftAcquiredType===8 && gift.state===0 &&
        gift.startAt===season.slot4 && gift.createdAt===saved.issued_at &&
        ['itemLevel','equipmentId','equipmentEvolveCount','pcLimitBreakCount','pcHeroSublimateCount','expireAt','dynamodbExpireAt']
          .every(key=>gift[key]===0) && keys(gift,giftFields),'Abyss ranking Present differs from its original prize/capture');
      row.gift=gift;
    }
    return {...saved,gifts,checkpoint};
  };
  const guardTitleBadges=(ids,working)=>{
    if(!ids.length) return;
    const at=now(),records=rows(tables[0],working),earned=new Map();
    need(long(at),'Abyss title-award clock is invalid');
    for(const id of ids) {
      const badge=master.titleBadges?.[id],season=master.serialPvp.serialPvpInformation[badge?.slot17];
      //2501050: type9 joins its own season, strict matching-end cutoff,
      //inclusive int32 rank bounds and native record+0x170 isAggregate.
      need(badge?.slot16===9 && long(badge.slot17) && badge.slot17>0 && season && long(season.slot4) &&
        int(badge.slot18) && badge.slot18>0 && int(badge.slot19) && badge.slot18<=badge.slot19,
        'Original Abyss title condition requires reconciliation');
      if(!earned.has(badge.slot17)) earned.set(badge.slot17,rankingRewardReceipt(badge.slot17));
      const receipt=earned.get(badge.slot17),record=records.get(badge.slot17);
      need(season.slot4<at && receipt?.checkpoint.published && equal(record,rankingRecord(receipt.checkpoint.record)) &&
        record.isAggregate && badge.slot18<=record.rank && record.rank<=badge.slot19,
        'New Abyss title requires its ended season and actual earned published rank');
    }
  };
  const guardGifts=(values=read('UserGift').data,working=null)=>{
    need(Array.isArray(values) && values.every(row=>row && long(row.id) && row.id>0),'Saved ranking Present identities are unavailable');
    const prior=read('UserGift').data;
    need(Array.isArray(prior) && prior.every(row=>row && long(row.id) && row.id>0),'Prior saved ranking Present identities are unavailable');
    const actual=new Map(values.map(row=>[row.id,row])),before=new Map(prior.map(row=>[row.id,row]));
    need(actual.size===values.length,'Duplicate saved Present identity');
    const seasons=db.prepare(`SELECT serial_pvp_id FROM serial_pvp_ranking_reward WHERE user_id=?
      UNION SELECT serial_pvp_id FROM serial_pvp_ranking_gift WHERE user_id=?`).all(userId,userId),owned=new Set();
    for(const {serial_pvp_id:id} of seasons) for(const {gift,claim_operation_id:claimId} of rankingRewardReceipt(id).gifts) {
      owned.add(gift.id);
      const current=actual.get(gift.id),claim=db.prepare('SELECT operation_id FROM gift_claim WHERE gift_id=?').get(gift.id);
      if(!claim) need(claimId===null && sameGift(current,gift),'Unclaimed Abyss ranking Present cannot be removed or replaced');
      else {
        need(long(claimId) && claimId>0 && claim.operation_id===claimId,
          'Abyss ranking Present lost its captured claim operation');
        const queued=db.prepare('SELECT id,type,parameters FROM operation_queue WHERE id=?').get(claim.operation_id),
          done=Boolean(db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(claim.operation_id));
        need(Boolean(queued)!==done,'Abyss ranking Present claim lost its existing2000 queue/ACK');
        if(queued) {
          let parameters;try {parameters=JSON.parse(queued.parameters);} catch {need(false,'Ranking Present claim is unreadable');}
          need(queued.type===2000 && Array.isArray(parameters?.UserGift) && parameters.UserGift.some(row=>sameGift(row,gift)),
            'Abyss ranking Present claim lost its exact original gift');
          need(typeof claimObserved==='function','Ranking Present acquisition guard unavailable');
          claimObserved({...queued,parameters},working); // Existing native inventory is its durable saved-effect checkpoint.
        }
        need(!current || [0,1].includes(current.state) && (!done || current.state===1) &&
          sameGift({...current,state:0},gift),'Claimed Abyss ranking Present cannot be restored or changed');
        need(current?.state!==0 || before.get(gift.id)?.state===0,
          'Observed or removed ranking Present cannot return to unclaimed while its ACK is pending');
      }
    }
    for(const gift of values) if(gift.giftAcquiredType===8 && typeof gift.title==='string' && gift.title.startsWith('[Offline Abyss ranking] '))
      need(owned.has(gift.id),'Offline Abyss ranking Present has lost its production receipt; retained for recovery');
  };
  const recordGiftClaim=operation=>{
    need(operation.type===2000 && Array.isArray(operation.parameters?.UserGift),'Invalid ranking Present claim');
    for(const gift of operation.parameters.UserGift) {
      const row=db.prepare('SELECT * FROM serial_pvp_ranking_gift WHERE gift_id=?').get(gift.id);
      if(!row) continue;
      need(row.user_id===userId && row.claim_operation_id===null && sameGift(JSON.parse(row.gift_json),gift) &&
        db.prepare('SELECT operation_id FROM gift_claim WHERE gift_id=?').get(gift.id)?.operation_id===operation.id,
        'Ranking Present claim must bind its actual earned gift and2000 operation');
      need(db.prepare('UPDATE serial_pvp_ranking_gift SET claim_operation_id=? WHERE gift_id=? AND claim_operation_id IS NULL')
        .run(operation.id,gift.id).changes===1,'Ranking Present claim changed during issuance');
    }
    guardGifts();
  };
  const giftDelivery=(operation,action)=>{
    need(Array.isArray(operation.parameters?.UserGift) && operation.parameters.UserGift.every(gift=>gift && long(gift.id) && gift.id>0),
      'Present delivery has invalid gift identities');
    const claims=db.prepare('SELECT gift_id FROM serial_pvp_ranking_gift WHERE claim_operation_id=?').all(operation.id);
    if(!claims.length) {
      need(!(operation.parameters?.UserGift ?? []).some(gift=>db.prepare('SELECT 1 FROM serial_pvp_ranking_gift WHERE gift_id=?').get(gift.id) ||
        gift.giftAcquiredType===8 && typeof gift.title==='string' && gift.title.startsWith('[Offline Abyss ranking] ')),
        'Ranking Present delivery lost its private claim binding');
      return null;
    }
    guardGifts();
    const queued=db.prepare('SELECT * FROM operation_queue WHERE id=?').get(operation.id);
    need(queued?.type===2000 && operation.type===2000 && queued.parameters===JSON.stringify(operation.parameters) &&
      queued.token===operation.token && queued.signature===operation.signature &&
      claims.every(row=>operation.parameters.UserGift.some(gift=>gift.id===row.gift_id)),
      'Settled or changed ranking Present callback cannot be delivered again');
    const gifts=read('UserGift').data,observed=claims.some(row=>!gifts.some(gift=>gift.id===row.gift_id && gift.state===0));
    need(typeof claimObserved==='function','Ranking Present inventory observation unavailable');
    if(observed || claimObserved(operation)) {
      need(action==='user_data/push','Partially saved ranking Present requires acknowledgement before redelivery');
      return false; // Queue retained; never reapply an additive native item after either saved effect.
    }
    return true;
  };
  const settleRankingRewards=()=>{
    guardGifts();
    const at=now();need(long(at),'Abyss reward clock is invalid');
    // ponytail: at most the50 archived seasons, indexed completed-run pointers;
    //no lifetime battle scan. Solo rank1 reuses the existing truthful board policy.
    for(const {serial_pvp_id:id} of db.prepare('SELECT serial_pvp_id FROM serial_pvp_result WHERE user_id=?').all(userId)) {
      const season=master.serialPvp.serialPvpInformation[id];
      need(season && long(season.slot3) && long(season.slot4),'Original Abyss reward calendar unavailable');
      const existing=rankingRewardReceipt(id);
      if(existing) {publishRankingRecord(id,existing);continue;}
      if(season.slot3>=season.slot4 || at<season.slot4) continue;
      if(db.prepare(`SELECT 1 FROM serial_pvp_battle WHERE serial_pvp_id=? AND closed=0 LIMIT 1`).get(id) ||
        pending().some(row=>row.serial_pvp_id===id) || pendingEntries().some(row=>row.serial_pvp_id===id)) continue;
      const {finish,latest,record,best}=rankingRecordProof(id),prize=serialPvpRankingPrize(id,1,master);
      need(finish && best && typeof createGifts==='function','Saved Abyss ranking reward provider unavailable');
      const gifts=createGifts(prize.rewards,rankingGiftTitle(id),8,at,season.slot4);
      db.prepare(`INSERT INTO serial_pvp_ranking_reward(user_id,serial_pvp_id,battle_id,best_battle_id,record_json,issued_at,catalog_hash)
        VALUES(?,?,?,?,?,?,?)`).run(userId,id,finish.battle_id,best.battle_id,
          JSON.stringify({record,progressBattleId:latest.battle_id,published:false}),at,hash([scoreCatalog,prize.catalog]));
      for(const [i,gift] of gifts.entries()) db.prepare(`INSERT INTO serial_pvp_ranking_gift(gift_id,user_id,serial_pvp_id,reward_id,gift_json)
        VALUES(?,?,?,?,?)`).run(gift.id,userId,id,prize.rewards[i].rewardId,JSON.stringify(gift));
      publishRankingRecord(id,rankingRewardReceipt(id)); //Same Gift/profile/status/receipt/reply transaction.
    }
  };
  const publishRankingRecord=(id,receipt)=>{
    if(receipt.checkpoint.published) return;
    need(!db.prepare('SELECT 1 FROM serial_pvp_battle WHERE serial_pvp_id=? AND closed=0 LIMIT 1').get(id) &&
      !pending().some(row=>row.serial_pvp_id===id) && !pendingEntries().some(row=>row.serial_pvp_id===id),
      'Abyss record publication waits for its actual combat/selection saves');
    const values=read(tables[0]).data,target=rankingRecord(receipt.checkpoint.record),
      data=JSON.stringify(values.map(row=>row.serialPvpId===id?target:row));
    need(db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
      .run(data,crypto.createHash('md5').update(data).digest('hex'),tables[0]).changes===1,
      'Abyss ranking publication lost its native record profile');
    need(db.prepare(`UPDATE serial_pvp_ranking_reward SET record_json=? WHERE user_id=? AND serial_pvp_id=? AND record_json=?`)
      .run(JSON.stringify({...receipt.checkpoint,published:true}),userId,id,receipt.record_json).changes===1,
      'Abyss ranking publication lost its original earned receipt');
    rankingRewardReceipt(id); // Strict native flags plus both original gift captures; no inferred collection proof.
  };
  const usageRows=id=>db.prepare('SELECT kind,pc_id,count FROM serial_pvp_usage WHERE serial_pvp_id=? ORDER BY kind,pc_id').all(id);
  const playedUnits=party=>{
    need(party.userId===userId,'Abyss local usage cannot include an offline CPU party');
    return ['pc','assistingPc'].flatMap((key,kind)=>[...new Set(party.slots.map(row=>row[key].pcId).filter(Boolean))]
      .map(pcId=>({kind,pc_id:pcId})));
  };
  const writeUsageCheckpoint=(id,value)=>db.prepare(`INSERT INTO serial_pvp_usage_checkpoint(serial_pvp_id,catalog_hash,battle_id,
    operation_id,round_count,counts_hash) VALUES(?,?,?,?,?,?) ON CONFLICT(serial_pvp_id) DO UPDATE SET catalog_hash=excluded.catalog_hash,
    battle_id=excluded.battle_id,operation_id=excluded.operation_id,round_count=excluded.round_count,counts_hash=excluded.counts_hash`)
    .run(id,usageCatalog,value.battle_id,value.operation_id,value.round_count,
      hash([value.battle_id,value.operation_id,value.round_count,value.rows]));
  const usageIndex=(id,persist=false)=>{
    const checkpoint=db.prepare('SELECT * FROM serial_pvp_usage_checkpoint WHERE serial_pvp_id=?').get(id),
      latest=latestFinish(id),stored=usageRows(id);
    if(checkpoint) {
      need(checkpoint.catalog_hash===usageCatalog && long(checkpoint.round_count) && long(checkpoint.operation_id) &&
        checkpoint.operation_id===(latest?.operation_id ?? 0) && checkpoint.battle_id===(latest?.battle_id ?? null) &&
        Boolean(checkpoint.round_count)===Boolean(latest) && checkpoint.counts_hash===
          hash([checkpoint.battle_id,checkpoint.operation_id,checkpoint.round_count,stored]) &&
        stored.every(row=>[0,1].includes(row.kind) && int(row.pc_id) && row.pc_id>0 && master.pcProfiles?.[row.pc_id] &&
          long(row.count) && row.count>0 && row.count<=checkpoint.round_count),
        'Abyss usage index differs from its acknowledged battle history');
      if(latest) need(playedUnits(latest.own).every(unit=>stored.some(row=>row.kind===unit.kind && row.pc_id===unit.pc_id)),
        'Abyss latest acknowledged party has lost its usage entries');
      return {...checkpoint,rows:stored};
    }
    need(!stored.length,'Abyss usage totals have lost their history checkpoint');
    // ponytail: one-time original-capture index build. Subsequent ACKs touch
    //only the played units; views read the bounded aggregate, not lifetime runs.
    const captures=db.prepare(`SELECT e.battle_id FROM serial_pvp_end e JOIN serial_pvp_battle b ON b.battle_id=e.battle_id
      JOIN operation_done d ON d.id=e.operation_id WHERE e.serial_pvp_id=? AND b.closed=1 ORDER BY e.operation_id`).all(id),counts=new Map();
    need((captures.at(-1)?.battle_id ?? null)===(latest?.battle_id ?? null),'Abyss usage history has lost its latest round pointer');
    for(const capture of captures) {
      const finish=endReceipt(capture.battle_id);
      need(finish?.done && finish.serial_pvp_id===id,'Abyss usage history contains an unacknowledged round');
      for(const unit of playedUnits(finish.own)) {
        const key=`${unit.kind}/${unit.pc_id}`,prior=counts.get(key);
        counts.set(key,{...unit,count:(prior?.count ?? 0)+1});
      }
    }
    const rows=[...counts.values()].sort((a,b)=>a.kind-b.kind || a.pc_id-b.pc_id),value={battle_id:latest?.battle_id ?? null,
      operation_id:latest?.operation_id ?? 0,round_count:captures.length,rows};
    if(persist) {
      for(const row of rows) db.prepare('INSERT INTO serial_pvp_usage(serial_pvp_id,kind,pc_id,count) VALUES(?,?,?,?)')
        .run(id,row.kind,row.pc_id,row.count);
      writeUsageCheckpoint(id,value);
    }
    return value;
  };
  const recordUsage=finish=>{
    const prior=usageIndex(finish.serial_pvp_id,true);
    need(long(prior.round_count+1),'Abyss local participation count exceeds exact persistence precision');
    for(const unit of playedUnits(finish.own)) db.prepare(`INSERT INTO serial_pvp_usage(serial_pvp_id,kind,pc_id,count) VALUES(?,?,?,1)
      ON CONFLICT(serial_pvp_id,kind,pc_id) DO UPDATE SET count=serial_pvp_usage.count+1`)
      .run(finish.serial_pvp_id,unit.kind,unit.pc_id);
    writeUsageCheckpoint(finish.serial_pvp_id,{battle_id:finish.battle_id,operation_id:finish.operation_id,
      round_count:prior.round_count+1,rows:usageRows(finish.serial_pvp_id)});
  };
  const endCurrent=(finish,working,lobbyOverride=null,matching=null,activeOverride=null)=>{
    const current=capture(finish.serial_pvp_id,working),owned=ownedBattleInfo(working);
    const lobby=finish.done?(lobbyOverride ?? state(finish.serial_pvp_id)):null;
    const nextRun=lobby && runEntry(finish.serial_pvp_id)?.generation>finish.parent.entry_generation;
    const continuing=finish.done && !finish.cycle.closed && !nextRun;
    const handoff=continuing?usageHandoff(finish):null;
    const usage=continuing && (handoff?.observed || handoff?.issued && working?.has(tables[2]) &&
      equal(current[tables[2]],finish.usage))?finish.usage:finish.before.rows[tables[2]];
    const baseRecord=finish.record_saved || working?.has(tables[0]) && equal(current[tables[0]],finish.record) ?
      finish.record:finish.before.rows[tables[0]],earned=finish.done?rankingRewardReceipt(finish.serial_pvp_id):null,
      record=earned?.checkpoint.published?rankingRecord(baseRecord):baseRecord,baseline={...finish.before.rows,[tables[0]]:record};
    const active=finish.done?(activeOverride ?? activeBattle()):null,
      latest=finish.done && !active?lastFinishedRound():finish,global=active ?? latest,
      historical=finish.done && global && global.battle_id!==finish.battle_id && global.serial_pvp_id!==finish.serial_pvp_id;
    need((nextRun || continuing ? equal(current[tables[0]],record) &&
      (nextRun?equal(current[tables[2]],lobby.after[tables[2]]) || lobby.pending_usage &&
        equal(current[tables[2]],lobby.before[tables[2]]):equal(current[tables[2]],usage)):
      equal(current,baseline)) && (historical || equal(owned.info,finish.before.info) &&
      owned.player.processingSerialPvpState===(finish.processing_saved?0:1)),
    'Saved Abyss finish differs from its issued processing/history checkpoint');
    if(historical) {
      need(latestFinish(finish.serial_pvp_id)?.battle_id===finish.battle_id,
        'Historical Abyss season must retain its latest acknowledged native round');
      // Native30100 clears processing, NOT the global resume-opponent ID.
      //Validate old season rows against their own finish, and the global ID
      //against the current season's captured start/end callback. No reset.
      if(active) {
        need(activeBattle()?.battle_id===active.battle_id,'Historical Abyss save lost its current combat owner');
        if(active.finish) endCurrent(active.finish,working);
        else battleCurrent(active,working);
      } else endCurrent(latest,working);
    }
    if(nextRun) {
      need(runEntry(finish.serial_pvp_id)?.generation>finish.parent.entry_generation,
        'Abyss replacement lobby has no fresh captured run attempt');
      validateCheckpoint(lobby,current,null,null,matching);
    } else if(continuing) {
      validateCheckpoint(lobby,current,null,{...finish,usage},matching);
    }
    if(!finish.done) {
      const reader=name=>working?.has(name)?{data:working.get(name)}:read(name);
      need(selectedParty(finish.own,reader).activeSerialPvpPartyId===finish.parent.owned_party_id,
        'Owned Abyss party changed before finish acknowledgement');
    }
    return current;
  };
  const idleContext=id=>{
    need(!activeBattle(),'Abyss season handoff waits for the captured combat finish');
    const owned=ownedBattleInfo(),finish=lastFinishedRound();
    need(owned.player.processingSerialPvpState===0 && long(owned.info.resumeRivalUserId) &&
      (finish?equal(owned.info,finish.before.info):owned.info.resumeRivalUserId===0),
      'Idle Abyss resume state has no latest saved native finish; progress retained');
    need(!pending().some(row=>row.serial_pvp_id!==id) && !pendingEntries().some(row=>row.serial_pvp_id!==id),
      'Previous Abyss season selection must save before switching seasons');
    if(finish) {
      endCurrent(finish);
      if(finish.serial_pvp_id!==id) {
        const previous=master.serialPvp.serialPvpInformation[finish.serial_pvp_id],next=master.serialPvp.serialPvpInformation[id];
        need(finish.cycle.closed || now()>=previous.slot4 && next?.slot3>=previous.slot4,
          'Unfinished Abyss run can only hand off after its original matching period expires');
        need(!db.prepare('SELECT 1 FROM serial_pvp_usage_handoff WHERE issued=1 AND observed=0 LIMIT 1').get(),
          'Abyss used-unit summary must save before switching seasons');
      }
    }
    return owned;
  };
  const endDelivery=finish=>{
    endCurrent(finish);
    need(!finish.processing_saved && (finish.record_saved===0 || equal(finish.record,finish.before.rows[tables[0]])) &&
      !finish.done,'Observed Abyss finish cannot replay its end event; result retained');
    // No new NOW timestamp, attempt debit or rematch occurs in30100. Deliver
    //the exact pending capture even if the event clock changed after issue.
    return {...finish.result,operation:finish.operation,operations:[finish.operation]};
  };
  const completeNoopStartTime=battle=>{
    const required=requiredStartProofs(battle.before);
    if(required.every(key=>battle.observed.includes(key))) return battle;
    need(battle.done && !battle.observed.includes('statusTime') &&
      required.filter(key=>key!=='statusTime').every(key=>battle.observed.includes(key)),
    'Abyss continuation waits for its complete30200 native-start proof');
    const prior=battle.before.rows[tables[1]];
    need(prior.lastBattleStartAt>0 && prior.lastBattleStartAt>=battle.issued_at-5 &&
      prior.lastBattleStartAt<=battle.issued_at+120,
    'Abyss unchanged start timestamp is outside its issued native callback window');
    battleCurrent(battle);
    // The direct callback always invokes this setter; a same-second value has no dirty row, and an exact continuation proves it ran.
    const observed=[...battle.observed,'statusTime'].sort();
    need(db.prepare(`UPDATE serial_pvp_battle SET observed_json=?,last_battle_start_at=?
      WHERE battle_id=? AND operation_id=? AND closed=0 AND last_battle_start_at=0`)
      .run(JSON.stringify(observed),prior.lastBattleStartAt,battle.battle_id,battle.operation_id).changes===1,
    'Abyss unchanged start timestamp capture disappeared before continuation');
    return battleReceipt(battle.battle_id);
  };
  const endRequest=(value,key,bodyHash,create=false)=>{
    const captured=typeof value?.battleId==='string'?endReceipt(value.battleId):null;
    let battle=activeBattle();
    serialPvpEndInput(value,master,captured?.parent.grade_id ?? battle?.grade_id);
    const receipt=db.prepare('SELECT * FROM serial_pvp_end_request WHERE request_key=?').get(key);
    if(receipt && (receipt.action!==endAction || receipt.body_hash!==bodyHash || receipt.battle_id!==value.battleId))
      throw Object.assign(new Error('Conflicting Abyss finish request identity'),{status:400});
    need(battle?.battle_id===value.battleId && battle.serial_pvp_id===value.serialPvpId,
      'Abyss finish requires its active captured season/battle');
    let finish=captured;
    if(finish) {
      if(!equal(finish.verdict,value)) throw Object.assign(new Error('Abyss finish verdict changed after issue'),{status:400});
    } else {
      need(!receipt,'Abyss finish request has lost its settlement capture');
      if(!create) return null;
      battleCurrent(battle);
      if(!requiredStartProofs(battle.before).every(key=>battle.observed.includes(key))) battle=completeNoopStartTime(battle);
      need(battle.done && requiredStartProofs(battle.before).every(key=>battle.observed.includes(key)),
        'Abyss finish waits for30200 saves/ACK and its direct start timestamp');
      const current=battleCurrent(battle),owned=ownedBattleInfo(),
        before={rows:current,info:owned.info,processing:owned.player.processingSerialPvpState,
          cycle:battle.before.cycle ?? emptyCycle()},
        at=now(),result=endResponse(battle,before,value,true,at),operation=issueOperation(30100,result);
      db.prepare(`INSERT INTO serial_pvp_end(battle_id,operation_id,serial_pvp_id,catalog_hash,issued_at,
        verdict_json,before_json,response_json,operation_json) VALUES(?,?,?,?,?,?,?,?,?)`).run(battle.battle_id,
          operation.id,battle.serial_pvp_id,scoreCatalog,at,JSON.stringify(value),JSON.stringify(before),
          JSON.stringify(result),JSON.stringify(operation));
      db.prepare('INSERT INTO serial_pvp_record_handoff(battle_id,catalog_hash,observed) VALUES(?,?,?)')
        .run(battle.battle_id,scoreCatalog,Number(equal(result.serialPvpRecord[0] ?? null,current[tables[0]])));
      finish=endReceipt(battle.battle_id);
    }
    const result=endDelivery(finish);
    if(receipt) {
      need(receipt.response===JSON.stringify(result),'Abyss finish reply differs from its permanent receipt');
      return Buffer.from(receipt.response);
    }
    if(create) db.prepare(`INSERT INTO serial_pvp_end_request(request_key,action,body_hash,battle_id,response)
      VALUES(?,?,?,?,?)`).run(key,endAction,bodyHash,battle.battle_id,JSON.stringify(result));
    return create?result:null;
  };
  const battleCurrent=(battle,working)=>{
    const finish=endReceipt(battle.battle_id);
    if(finish) return endCurrent(finish,working);
    const current=capture(battle.serial_pvp_id,working),owned=ownedBattleInfo(working),
      status=current[tables[1]],prior=battle.before.rows[tables[1]],observed=new Set(battle.observed);
    need(owned.player.processingSerialPvpState===(observed.has('processing')?1:0) &&
      equal(owned.info,{...battle.before.info,resumeRivalUserId:observed.has('info')?battle.rival_id:battle.before.info.resumeRivalUserId}) &&
      equal(current[tables[0]],battle.before.rows[tables[0]] ??
        (current[tables[0]]?initialRecord(battle.serial_pvp_id,current[tables[0]].userId):null)) &&
      equal(current[tables[2]],battle.before.rows[tables[2]]) &&
      status && statusFields.every(key=>status[key]===(key==='lastBattleStartAt' && observed.has('statusTime') ?
        battle.last_battle_start_at:key==='updatedMatchingCount' && observed.has('matchingReset') ? 0:
        key==='updateRivalList' && observed.has('statusFlag') ? true:prior[key])),
    'Saved Abyss combat state differs from its captured native checkpoint');
    const reader=name=>working?.has(name)?{data:working.get(name)}:read(name);
    need(selectedParty(battle.own,reader).activeSerialPvpPartyId===battle.owned_party_id,
      'Abyss selected owned party changed during the captured battle');
    return current;
  };
  const resumeBattle=(battle,value)=>{
    need(!endReceipt(battle.battle_id),'Abyss finish already issued; do not resume/reseed completed combat');
    need(battle.serial_pvp_id===value.serialPvpId && battle.rival_id===value.userId,
      'Abyss resume does not match the captured season/opponent');
    if(!requiredStartProofs(battle.before).every(key=>battle.observed.includes(key))) battle=completeNoopStartTime(battle);
    battleCurrent(battle);
    need(battle.done && requiredStartProofs(battle.before).every(key=>battle.observed.includes(key)),
      'Abyss resume waits for30200 saves, acknowledgement and the separate start timestamp');
    need(serialPvpSeasonAt(now(),master)?.id===battle.serial_pvp_id,
      'Abyss resume unavailable outside the original display period');
    return battle.result;
  };
  const startDelivery=(battle,value)=>{
    need(!battle.observed.length && !battle.done && battle.serial_pvp_id===value.serialPvpId &&
      battle.rival_id===value.userId && battle.party_index===value.partyIndex && equal(battle.own,value.userParty),
    'Observed Abyss start cannot replay; use the captured native resume path');
    battleCurrent(battle);
    const season=master.serialPvp.serialPvpInformation[battle.serial_pvp_id],at=now();
    need(season.slot3<season.slot4 && at>=season.slot3 && at<season.slot4,
      'Pending Abyss start cannot redeliver outside its original matching period');
    need(at>=battle.issued_at-5 && at<=battle.issued_at+120,
      'Untouched Abyss callback has outlived its captured start-clock window; capture retained for recovery');
    return {...battle.result,operation:battle.operation,operations:[battle.operation]};
  };
  const replayBattle=(action,value,key,bodyHash)=>{
    battleInput(action,value);
    need(!db.prepare('SELECT 1 FROM serial_pvp_lobby_request WHERE request_key=?').get(key),'Abyss request identity belongs to a lobby route');
    const receipt=db.prepare('SELECT * FROM serial_pvp_battle_request WHERE request_key=?').get(key);
    if(!receipt) return null;
    if(receipt.action!==action || receipt.body_hash!==bodyHash)
      throw Object.assign(new Error('Conflicting Abyss battle request identity'),{status:400});
    const battle=activeBattle();
    need(battle?.battle_id===receipt.battle_id,'Obsolete Abyss battle reply has lost its active capture');
    const result=action.endsWith('/start')?startDelivery(battle,value):resumeBattle(battle,value);
    need(receipt.response===JSON.stringify(result),'Abyss battle reply differs from its permanent receipt');
    return Buffer.from(receipt.response);
  };
  const issueBattle=(action,value,key,bodyHash)=>{
    battleInput(action,value);
    let battle=activeBattle();
    if(action==='serial_pvp/battle/start' && !battle) {
      const {id,at,current,saved}=access('serial_pvp/summary/get',{serialPvpId:value.serialPvpId},false,true),
        entry=runEntry(id),owned=ownedBattleInfo();
      need(saved?.grade_id && !pending().length && !pendingEntries().length && !pendingRefill() && entry?.observed===1,
        'Abyss battle requires a saved grade/run attempt and settled lobby resources');
      const finished=latestFinish(id),sameRun=finished && entry.generation===finished.parent.entry_generation;
      need(!sameRun || !finished.cycle.closed,
        'Completed Abyss attempt cannot start another battle without a fresh saved grade selection');
      if(sameRun) need(usageHandoff(finished)?.observed===1,
        'Abyss winning round must save its used-unit summary before the next battle');
      const rival=saved.rivals.find(row=>row.serialPvpPlayerInfo.userId===value.userId);
      need(rival,'Abyss opponent is not in the captured selected-grade lobby');
      serialPvpPartyReady(current[tables[2]],value.userParty);
      const partyId=selectedParty(value.userParty).activeSerialPvpPartyId,battleId=`abyss-${crypto.randomUUID()}`,
        result=battleResponse(id,saved.grade_id,rival,current[tables[0]],battleId,crypto.randomInt(1,0x80000000)),
        operation=issueOperation(30200,result),before={rows:current,info:owned.info,processing:owned.player.processingSerialPvpState,
          sp:playerSp(),cycle:sameRun?{previousBattleId:finished.battle_id,scores:finished.cycle.scores,wins:finished.cycle.wins}:emptyCycle(),
          matching:matchingCheckpoint(saved)};
      need(current[tables[1]].updatedMatchingCount===before.matching.count && !current[tables[1]].executeRivalListUpdate,
        'Abyss opponent-refresh intent must settle before battle start');
      db.prepare(`INSERT INTO serial_pvp_battle(battle_id,operation_id,serial_pvp_id,lobby_generation,entry_generation,grade_id,
        rival_id,party_index,owned_party_id,issued_at,catalog_hash,own_party_json,before_json,response_json,operation_json,observed_json)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(battleId,operation.id,id,saved.generation,entry.generation,saved.grade_id,
          value.userId,value.partyIndex,partyId,at,catalog,JSON.stringify(value.userParty),JSON.stringify(before),
          JSON.stringify(result),JSON.stringify(operation),'[]');
      db.prepare('INSERT INTO serial_pvp_active(user_id,battle_id) VALUES(?,?)').run(userId,battleId);
      if(before.matching.resetPending) writeMatching(id,saved.generation,{count:0,resetPending:0});
      battle=activeBattle();
    }
    need(battle,'No captured Abyss battle exists to resume');
    const result=action.endsWith('/start')?startDelivery(battle,value):resumeBattle(battle,value);
    db.prepare('INSERT INTO serial_pvp_battle_request(request_key,action,body_hash,battle_id,response) VALUES(?,?,?,?,?)')
      .run(key,action,bodyHash,battle.battle_id,JSON.stringify(result));
    return result;
  };
  const operationDelivery=(operation,action)=>{
    if(operation.type===30100) {
      const saved=db.prepare('SELECT battle_id FROM serial_pvp_end WHERE operation_id=?').get(operation.id),
        finish=saved?endReceipt(saved.battle_id):null;
      need(finish && equal(finish.operation,operation) && activeBattle()?.battle_id===finish.battle_id,
        'Queued Abyss30100 has no exact active finish capture; queue retained');
      endCurrent(finish);
      if(finish.processing_saved || finish.record_saved && !equal(finish.record,finish.before.rows[tables[0]]) || finish.done) {
        need(action==='user_data/push','Saved Abyss30100 must acknowledge before end-event redelivery');return false;
      }
      endDelivery(finish);return true;
    }
    const battle=activeBattle();
    need(battle?.operation_id===operation.id && equal(battle.operation,operation),
      'Queued Abyss30200 has no exact captured native battle; queue retained');
    battleCurrent(battle);
    if(battle.observed.length || battle.done) {
      need(action==='user_data/push','Observed Abyss30200 must settle before callback redelivery');return false;
    }
    startDelivery(battle,{serialPvpId:battle.serial_pvp_id,userId:battle.rival_id,partyIndex:battle.party_index,userParty:battle.own});
    return true;
  };
  const battleSavePlan=(working,acknowledged)=>{
    const battle=activeBattle();
    for(const id of acknowledged) if(db.prepare('SELECT 1 FROM operation_queue WHERE id=? AND type=30100').get(id) ||
      db.prepare('SELECT 1 FROM serial_pvp_end WHERE operation_id=?').get(id)) {
      const saved=db.prepare('SELECT battle_id FROM serial_pvp_end WHERE operation_id=?').get(id),
        finish=saved?endReceipt(saved.battle_id):null;
      need(finish && (finish.done || battle?.battle_id===finish.battle_id),
        'Abyss30100 acknowledgement has lost its captured finish');
    }
    for(const id of acknowledged) if(db.prepare('SELECT 1 FROM operation_queue WHERE id=? AND type=30200').get(id) ||
      db.prepare('SELECT 1 FROM serial_pvp_battle WHERE operation_id=?').get(id)) {
      const closed=db.prepare('SELECT battle_id FROM serial_pvp_battle WHERE operation_id=? AND closed=1').get(id);
      need(battle?.operation_id===id || closed && endReceipt(closed.battle_id)?.done,
        'Abyss30200 acknowledgement has lost its captured battle');
    }
    if(!battle) return null;
    const finish=endReceipt(battle.battle_id);
    if(finish) {
      endCurrent(finish);
      const candidate={...finish,processing_saved:Number(Boolean(finish.processing_saved ||
        working.has('UserInfo') && ownedBattleInfo(working).player.processingSerialPvpState===0)),
        record_saved:Number(Boolean(finish.record_saved || working.has(tables[0]) &&
          equal(rows(tables[0],working).get(finish.serial_pvp_id) ?? null,finish.record)))};
      endCurrent(candidate,working);
      const acknowledge=acknowledged.includes(finish.operation_id);
      if(acknowledge) need(candidate.processing_saved===1 && candidate.record_saved===1,
        'Abyss30100 must save its score record and processing0 before acknowledgement');
      return {...battle,finish:{...candidate,acknowledge}};
    }
    battleCurrent(battle);
    const observed=new Set(battle.observed),owned=ownedBattleInfo(working),status=rows(tables[1],working).get(battle.serial_pvp_id),
      prior=battle.before.rows[tables[1]];
    let stamp=battle.last_battle_start_at;
    if(working.has('UserInfo') && owned.player.processingSerialPvpState===1) observed.add('processing');
    if(owned.info.resumeRivalUserId===battle.rival_id && (working.has('UserSerialPvpInfo') ||
      battle.before.info.resumeRivalUserId===battle.rival_id && observed.has('processing')))
      observed.add('info'); // Same CPU in a fresh run can make the UID setter a no-op.
    if(status?.updateRivalList===true && (working.has(tables[1]) || observed.has('processing') || observed.has('info')))
      observed.add('statusFlag'); // A native no-op setter need not emit an unchanged dirty row.
    if(working.has(tables[1]) && status?.lastBattleStartAt!==prior.lastBattleStartAt) {
      need(long(status?.lastBattleStartAt) && status.lastBattleStartAt>0 &&
        status.lastBattleStartAt>=battle.issued_at-5 && status.lastBattleStartAt<=battle.issued_at+120 &&
        (!observed.has('statusTime') || stamp===status.lastBattleStartAt),'Abyss start timestamp is not its issued native callback');
      observed.add('statusTime');stamp=status.lastBattleStartAt;
    }
    if(battle.before.matching && prior.updatedMatchingCount>0 && working.has(tables[1]) && status?.updatedMatchingCount===0)
      observed.add('matchingReset'); // Native1bc4628, alongside the combat transition's dirty save.
    const candidate={...battle,observed:[...observed].sort(),last_battle_start_at:stamp};
    battleCurrent(candidate,working);
    if(acknowledged.includes(battle.operation_id)) need(requiredStartProofs(battle.before).filter(key=>key!=='statusTime').every(key=>observed.has(key)),
      'Abyss30200 must save processing, resume opponent and rival-update flag before acknowledgement');
    return candidate;
  };
  const viewSnapshot=id=>{
    need(serialPvpSeasonAt(now(),master)?.id===id,'Abyss views unavailable outside the original display period');
    need(!pending().length && !pendingEntries().length,'Abyss selection must save before opening views');
    const battle=activeBattle(),saved=state(id),latest=latestFinish(id);
    let current;
    if(battle) {
      need(!endReceipt(battle.battle_id),'Pending Abyss finish must settle before opening views');
      need(battle.serial_pvp_id===id && battle.done && requiredStartProofs(battle.before).every(key=>battle.observed.includes(key)),
        'Pending Abyss start must save and acknowledge before opening views');
      current=battleCurrent(battle);
    } else if(latest) current=endCurrent(latest);
    else {
      current=capture(id);
      idleContext(id);
      const record=current[tables[0]],status=current[tables[1]],usage=current[tables[2]];
      need((!record || equal(record,initialRecord(id,record.userId))) && (!usage || !usage.usedPcList.length && !usage.usedMemoriaList.length) &&
        (!status || status.lastBattleStartAt===0 && status.updatedMatchingCount===(saved?matchingCheckpoint(saved).count:0)),
        'Abyss legacy view history needs its original acknowledged captures; native progress retained');
      if(saved) validateCheckpoint(saved,current);
    }
    return {battle,saved,latest,current};
  };
  const playerView=value=>{
    // Both native producers send exactly these two int64 identities.
    //2344e04 merges a record ARRAY for self, or caches it under the requested
    //remote owner. The OTHER producer's1bc790c also needs a generic playerInfo
    //and ordinary serialPvpParty. A record-only reply would miss that path.
    if(!keys(value,['serialPvpId','userId']) || !long(value.serialPvpId) || !value.serialPvpId ||
      !long(value.userId) || !value.userId)
      throw Object.assign(new Error('Invalid native Abyss player-details request'),{status:400});
    const {battle,saved,latest,current}=viewSnapshot(value.serialPvpId);
    let record,profile,party;
    if(value.userId===userId) {
      record=current[tables[0]];
      const captured=bestFinish(value.serialPvpId,record) ?? battle ?? latest;
      need(captured,'Saved Abyss self details need their captured native combat vector; no guessed party stats');
      party=captured.own;
      try {profile=playerProfile();} catch {need(false,'Saved Abyss player profile requires reconciliation');}
      const favorite=master.communicationCharacters?.[profile.favoriteCharacterId],
        costume=master.characterCostumes?.[profile.favoriteCharacterCostumeId];
      need(profile.userId===userId && costume && costume.characterKey===master.characters?.[favorite?.characterId]?.key,
        'Saved Abyss portrait/costume is unavailable in the original archive');
    }
    else {
      const rival=saved?.rivals.find(row=>row.serialPvpPlayerInfo.userId===value.userId);
      need(saved?.grade_id && rival,
        'Abyss player details require an opponent in the captured offline lobby');
      // Explicit offline CPU policy: these authored Under teams have never
      //played an Abyss run. Native defaults are zero history, NOT a copied
      //player score or a fabricated publisher rank/high-score team.
      record=initialRecord(value.serialPvpId,value.userId);
      const details=underPvpCpuDetails({underPvpPlayerInfo:rival.serialPvpPlayerInfo,underPvpParty:rival.serialPvpParty},master);
      profile={...details.playerInfo,description:'Offline Abyss CPU using an original Under Telskyura team; selected Abyss grade is a local challenge label, not historical matching.'+
        (details.playerInfo.description.includes('Bell portrait placeholder.')?' Bell portrait placeholder.':'')};
      party=rival.serialPvpParty;
    }
    return {generation:value.userId===userId?latest?.operation_id ?? battle?.operation_id ?? -1:saved?.generation ?? -1,
      result:{code:0,result:0,playerInfo:profile,familiaName:profile.familiaName,
        serialPvpParty:party,substitutedSpineIds:[],serialPvpRecord:record?[record]:[]}};
  };
  const resultView=value=>{
    if(!keys(value,['serialPvpId']) || !long(value.serialPvpId) || !value.serialPvpId)
      throw Object.assign(new Error('Invalid native Abyss results request'),{status:400});
    need(serialPvpSeasonAt(now(),master)?.id===value.serialPvpId,
      'Abyss results unavailable outside the original display period');
    need(!activeBattle() && !pending().length && !pendingEntries().length,
      'Abyss finish/selection must settle before opening its total result');
    const finish=finishedResult(value.serialPvpId);
    need(finish,'No saved local Abyss result is available');endCurrent(finish);
    const best=bestFinish(value.serialPvpId,finish.record,finish),leader=best.own.slots[0].pc.pcId,
      earned=rankingRewardReceipt(value.serialPvpId);
    need(int(leader) && leader>0 && master.pcProfiles?.[leader],'Abyss result leader is unavailable in the original archive');
    // Local completed-run display. Published rank is the actual solo-offline
    //outbox settlement; no invented previous rank or around-ranking peers.
    return {generation:finish.operation_id,result:{code:0,result:0,
      roundScore:finish.result.cycleScores,currentGradeId:finish.parent.grade_id,highScorePcId:leader,
      winCount:finish.cycle.wins,previousRank:0,currentRank:earned?.checkpoint.published?1:0,
      isHighScore:Boolean(best.battle_id===finish.battle_id && finish.record?.score>(finish.before.rows[tables[0]]?.score ?? 0)),
      aroundRankingData:[]}};
  };
  const localRanking=(id,record)=>{
    const best=bestFinish(id,record);
    if(!best) return [];
    const info=ownedBattleInfo().player,pc=best.own.slots[0].pc,score=record?.score ?? 0;
    need(typeof info.name==='string' && info.userId===userId && int(score) && int(pc.pcId) && pc.pcId>0 &&
      master.pcProfiles?.[pc.pcId],'Abyss ranking player/score cannot be represented by its native int32 row');
    // ponytail: truthful solo-offline board, not restored publisher ranks.
    // BOTH233aafc summary and234054c ranking callbacks use2104004. Missing
    //party.slots drops the WHOLE entry; preserve the real captured best team.
    return [{userId,name:info.name,pcId:pc.pcId,gradeId:best.parent.grade_id,rank:1,score,party:best.own}];
  };
  const rankingView=(action,value,persist=false)=>{
    if(!keys(value,['serialPvpId']) || !long(value.serialPvpId) || !value.serialPvpId)
      throw Object.assign(new Error('Invalid native Abyss ranking request'),{status:400});
    const {latest,current}=viewSnapshot(value.serialPvpId);
    if(action===usageAction) {
      const index=usageIndex(value.serialPvpId,persist),ranked=kind=>index.rows.filter(row=>row.kind===kind)
        .sort((a,b)=>b.count-a.count || a.pc_id-b.pc_id).map((row,i)=>({rank:i+1,pcId:row.pc_id}));
      //2141c44 consumes int32 rank/pcId under normal/assist. Count actual
      //ACKed local participation, including losses/retirement, not CPU offers
      //or cooldown turns masquerading as publisher-wide popularity.
      return {generation:index.operation_id,result:{code:0,result:0,normal:ranked(0),assist:ranked(1)}};
    }
    const ranking=localRanking(value.serialPvpId,current[tables[0]]);
    return {generation:latest?.operation_id ?? 0,result:{code:0,result:0,
      serialPvpTotalRanking:ranking,serialPvpUserRanking:ranking}};
  };
  const viewFor=(action,value,persist=false)=>action===resultAction?resultView(value):
    action===viewAction?playerView(value):rankingView(action,value,persist);
  const viewCatalogFor=action=>[rankingAction,usageAction].includes(action)?rankingCatalog:viewCatalog;
  const replayView=(action,value,key,bodyHash)=>{
    need(!db.prepare('SELECT 1 FROM serial_pvp_lobby_request WHERE request_key=?').get(key) &&
      !db.prepare('SELECT 1 FROM serial_pvp_battle_request WHERE request_key=?').get(key),
    'Abyss request identity belongs to another route');
    const receipt=db.prepare('SELECT * FROM serial_pvp_view_request WHERE request_key=?').get(key);
    const owner=action===viewAction?value?.userId:userId;
    if(receipt && (receipt.action!==action || receipt.body_hash!==bodyHash ||
      receipt.serial_pvp_id!==value?.serialPvpId || receipt.owner_id!==owner))
      throw Object.assign(new Error('Conflicting Abyss player-details identity'),{status:400});
    const view=viewFor(action,value);
    if(!receipt) return null;
    need(receipt.catalog_hash===viewCatalogFor(action) && receipt.generation===view.generation &&
      receipt.response===JSON.stringify(view.result),
    'Obsolete Abyss player details cannot replace newer records or opponents; reopen details');
    return Buffer.from(receipt.response);
  };
  const replay=(action,value,key,bodyHash)=>{
    if(action!==endAction) need(!db.prepare('SELECT 1 FROM serial_pvp_end_request WHERE request_key=?').get(key),
      'Abyss request identity belongs to a finish route');
    if(viewActions.has(action)) return replayView(action,value,key,bodyHash);
    need(!db.prepare('SELECT 1 FROM serial_pvp_view_request WHERE request_key=?').get(key),
      'Abyss request identity belongs to a player-details view');
    if(action===endAction) {
      need(!db.prepare('SELECT 1 FROM serial_pvp_lobby_request WHERE request_key=?').get(key) &&
        !db.prepare('SELECT 1 FROM serial_pvp_battle_request WHERE request_key=?').get(key),
      'Abyss finish request identity belongs to another route');
      return endRequest(value,key,bodyHash);
    }
    if(battleActions.has(action)) return replayBattle(action,value,key,bodyHash);
    need(!db.prepare('SELECT 1 FROM serial_pvp_battle_request WHERE request_key=?').get(key),'Abyss request identity belongs to a battle route');
    const {id,current,saved}=access(action,value,true),receipt=db.prepare('SELECT * FROM serial_pvp_lobby_request WHERE request_key=?').get(key);
    if(!receipt) return null;
    if(receipt.action!==action || receipt.body_hash!==bodyHash || receipt.serial_pvp_id!==id)
      throw Object.assign(new Error('Conflicting Abyss request identity'),{status:400});
    need(saved && receipt.generation===saved.generation,'Obsolete Abyss reply cannot restore old opponents or reset usage');
    if(action==='serial_pvp/grade/select') need(runEntry(id) && !runEntry(id).observed,
      'A saved Abyss run-entry callback cannot spend its attempt again; reopen the summary');
    const expected=response(action,saved,current);
    need(receipt.response===JSON.stringify(expected),'Obsolete/inconsistent Abyss lobby reply; reopen the screen');
    return Buffer.from(receipt.response);
  };
  const issue=(action,value,key,bodyHash)=>{
    if(action==='serial_pvp/summary/get') settleRankingRewards(); // Fresh outer packet only; replay remains read-only.
    if(action===endAction) return endRequest(value,key,bodyHash,true);
    if(viewActions.has(action)) {
      const view=viewFor(action,value,true);
      db.prepare(`INSERT INTO serial_pvp_view_request(request_key,action,body_hash,serial_pvp_id,owner_id,generation,catalog_hash,response)
        VALUES(?,?,?,?,?,?,?,?)`).run(key,action,bodyHash,value.serialPvpId,action===viewAction?value.userId:userId,
          view.generation,viewCatalogFor(action),JSON.stringify(view.result));
      return view.result;
    }
    if(battleActions.has(action)) return issueBattle(action,value,key,bodyHash);
    let {id,at,current,saved}=access(action,value);
    recordUnlock(unlockSnapshot()); // Imported nonzero native flag, never virtual eligibility/precredit.
    const latest=latestFinish(id),entryBefore=runEntry(id);
    if(action==='serial_pvp/grade/select') need(!saved?.grade_id || latest?.cycle.closed &&
      latest.parent.entry_generation===entryBefore?.generation,
      'The selected Abyss class is locked until one loss or five wins');
    if(action==='serial_pvp/rival_list/update') {
      need(saved?.grade_id===value.gradeId,'Select the Abyss grade before refreshing its opponents');
      const intent=matchingCheckpoint(saved),status=current[tables[1]];
      need(!intent.resetPending && status?.executeRivalListUpdate && status.updatedMatchingCount===intent.count &&
        intent.count===(saved.after[tables[1]]?.updatedMatchingCount ?? 0)+1 && intent.count<=matchingLimit(id),
        'Abyss refresh requires its saved native increment within the original three-refresh quota');
    }
    if(!saved || action!=='serial_pvp/summary/get') {
      if(action==='serial_pvp/grade/select') {
        const finished=latest;
        if(finished) archiveRun(finished.parent);
      } else if(action==='serial_pvp/rival_list/update' && latest &&
          latest.parent.lobby_generation===saved.generation) {
        archiveRun(latest.parent);
      }
      const generation=saved?saved.generation+1:0,gradeId=value.gradeId ?? 0;
      need(int(generation),'Abyss lobby generation exhausted');
      const after=structuredClone(current),isMutation=action!=='serial_pvp/summary/get',
        entry=action==='serial_pvp/grade/select'?serialPvpRunEntry(playerSp(),at,master):null;
      if(isMutation) {
        after[tables[1]]={...(current[tables[1]] ?? initialStatus(id)),updateRivalList:false,
          executeRivalListUpdate:false,lastRivalListUpdateAt:at};
        if(action==='serial_pvp/grade/select') after[tables[2]]=initialUsage(id);
      }
      const rivals=gradeId?serialPvpCpuRivals(id,gradeId,generation,master):[];
      db.prepare(`INSERT INTO serial_pvp_lobby(serial_pvp_id,generation,grade_id,catalog_hash,issued_at,before_json,after_json,
        rivals_json,pending_status,pending_usage) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(serial_pvp_id) DO UPDATE SET
        generation=excluded.generation,grade_id=excluded.grade_id,catalog_hash=excluded.catalog_hash,issued_at=excluded.issued_at,
        before_json=excluded.before_json,after_json=excluded.after_json,rivals_json=excluded.rivals_json,
        pending_status=excluded.pending_status,pending_usage=excluded.pending_usage`).run(id,generation,gradeId,catalog,at,
          JSON.stringify(current),JSON.stringify(after),JSON.stringify(rivals),Number(!equal(current[tables[1]],after[tables[1]])),
          Number(!equal(current[tables[2]],after[tables[2]])));
      if(entry) db.prepare(`INSERT INTO serial_pvp_run_entry(serial_pvp_id,generation,grade_id,request_key,catalog_hash,issued_at,baseline_json,
        candidates_json,observed,observed_json) VALUES(?,?,?,?,?,?,?,?,0,NULL) ON CONFLICT(serial_pvp_id) DO UPDATE SET
        generation=excluded.generation,catalog_hash=excluded.catalog_hash,issued_at=excluded.issued_at,
        grade_id=excluded.grade_id,request_key=excluded.request_key,
        baseline_json=excluded.baseline_json,candidates_json=excluded.candidates_json,observed=0,observed_json=NULL`)
        .run(id,generation,gradeId,key,entry.config.catalog,at,JSON.stringify(entry.baseline),JSON.stringify(entry.candidates));
      saved=state(id);
      writeMatching(id,saved.generation,{count:after[tables[1]]?.updatedMatchingCount ?? 0,resetPending:0});
    }
    if(action==='serial_pvp/summary/get' && latest && !latest.cycle.closed &&
        entryBefore?.generation===latest.parent.entry_generation) {
      need(db.prepare('UPDATE serial_pvp_usage_handoff SET issued=1 WHERE battle_id=? AND catalog_hash=?')
        .run(latest.battle_id,latest.catalog_hash).changes===1,'Winning Abyss round has lost its usage handoff');
    }
    const result=response(action,saved,current);
    db.prepare('INSERT INTO serial_pvp_lobby_request(request_key,action,body_hash,serial_pvp_id,generation,response) VALUES(?,?,?,?,?,?)')
      .run(key,action,bodyHash,id,saved.generation,JSON.stringify(result));
    return result;
  };
  const savePlan=(working,acknowledged=[],triggers=[])=>{
    guardGifts(working.get('UserGift') ?? read('UserGift').data,working);
    let unlock=null;
    if(working.has(flagTable)) {
      const before=unlockSnapshot(),after=serialPvpUnlockFlag(working.get(flagTable),master,userId);
      need(!before.row || after.row && after.row.userId===before.row.userId &&
        after.row.lastUpdatedAt===before.row.lastUpdatedAt && (!before.value || after.value>0),
      'Saved Abyss unlock cannot be deleted, relocked or have its identity/timestamp guessed');
      if(!before.row && after.row) need(after.row.userId===0 && after.row.lastUpdatedAt===0,
        'New lazy Abyss unlock flag must retain its native zero owner/timestamp');
      // Native entry writes2, but the serialized value may already be1:
      // getter/setter accept either nonzero state. Require the same real
      // prerequisites, not an assumed intermediate dirty-save boundary.
      if(!before.value && after.value) need(serialPvpEligibility(read(flagTable).data,
        working.get('UserAdventureStage') ?? read('UserAdventureStage').data,
        working.get('UserPvPRecord') ?? read('UserPvPRecord').data,master,userId).eligible,
      'New Abyss unlock requires the original stage4/War Game score');
      unlock=after.value?after:null;
    }
    const battle=battleSavePlan(working,acknowledged);
    const changes=[],entries=[],usageChanges=[],matchingChanges=[],matchingCandidates=new Map(),touched=new Set(),pendingEntryIds=pendingEntries();
    need(pendingEntryIds.length<=1,'Multiple pending Abyss run entries require reconciliation');
    const entry=pendingEntryIds.length?runEntry(pendingEntryIds[0].serial_pvp_id):null;
    let ticket=pendingTicket(),newTicket=null,ticketObserved=false,ticketStockObserved=false;
    const ticketChanges=[];
    if(working.has(ticketTable)) {
      const {rows:before,floors}=ticketStockState(),after=serialPvpTicketRows(working.get(ticketTable),master,userId);
      for(const id of before.keys()) need(after.has(id),'Abyss ticket rows cannot be deleted without recovered expiry proof');
      for(const [id,row] of after) {
        const prior=ticketStock(before.get(id)),stock=ticketStock(row),gain=stock.cumulativeAmount-prior.cumulativeAmount;
        need(gain>=0 && stock.reservedAmount===prior.reservedAmount && stock.lastResetAt===prior.lastResetAt,
          'Abyss ticket acquisition/reservation/reset history cannot be rewound or guessed');
        if(!equal(stock,prior)) {
          if(gain>0) {
            need(!ticket,'Abyss ticket attempt recovery must save before another inventory effect');
            const reservation=itemReservation(id,prior.cumulativeAmount);
            need(stock.amount===prior.amount+gain && stock.cumulativeAmount<=reservation.reserved,
              'Abyss ticket acquisition requires its existing issued item reward');
          } else {
            need(stock.amount<prior.amount && stock.amount>=prior.reservedAmount && triggers.includes('SerialPvpSpRecovry'),
              'Abyss ticket consumption requires its original owned recovery save');
            if(ticket) {
              need(!ticket.stock_saved && ticket.ticket_id===id && equal(prior,ticket.before) && equal(stock,ticket.stockAfter),
                'Abyss delayed ticket debit differs from its captured SP recovery');
              ticketStockObserved=true;
            } else {
              eligibility();
              unlock ??= unlockSnapshot();
              need(!newTicket && !entry && !pendingRefill() && !activeBattle() && !pending().length &&
                !itemReservation(id,prior.cumulativeAmount).pendingItem,
              'Abyss ticket consumption conflicts with another resource/battle/reward handoff');
              const amount=prior.amount-stock.amount,at=now(),target=serialPvpTicketRecovery(playerSp(),id,amount,at,master);
              newTicket={...target,ticket_id:id,amount,issued_at:at,before:prior,after:stock,stock_saved:1};
            }
          }
        }
        if(!equal(stock,prior) || !floors.has(id)) ticketChanges.push({id,stock,useId:floors.get(id)?.use_id ?? 0});
      }
      ticket=newTicket ?? ticket;
    }
    for(const name of tables) if(working.has(name)) {
      const before=rows(name),after=rows(name,working);
      for(const id of before.keys()) need(after.has(id),'Abyss native rows cannot be deleted without recovered expiry proof');
      for(const [id,row] of after) {
        touched.add(id);
        const prior=before.get(id),saved=state(id);
        if(name===tables[0]) need(equal(row,prior ?? initialRecord(id,row.userId)) ||
          battle?.finish?.serial_pvp_id===id && equal(row,battle.finish.record),
          'Unissued Abyss score/reward/matching history cannot be saved');
        else if(name===tables[2]) {
          const latest=latestFinish(id),sameRun=latest && runEntry(id)?.generation===latest.parent.entry_generation,
            handoff=sameRun && !latest.cycle.closed?usageHandoff(latest):null;
          const target=saved?.pending_usage && equal(row,saved.after[tables[2]]) ||
            handoff?.issued && equal(row,latest.usage);
          need(equal(row,prior ?? initialUsage(id)) || target,'Unissued Abyss used-unit changes cannot be saved');
          if(handoff && !handoff.observed && target && equal(row,latest.usage)) usageChanges.push(latest.battle_id);
        }
        else if(!saved?.pending_status) {
          const baseline=prior ?? initialStatus(id);
          let count=baseline.updatedMatchingCount;
          if(saved && !battle && row.updatedMatchingCount!==count) {
            const intent=matchingCheckpoint(saved),finish=latestFinish(id),entry=runEntry(id),
              open=entry?.observed && (!finish || entry.generation>finish.parent.entry_generation || !finish.cycle.closed);
            need(!saved.pending_usage && open && count===intent.count && !intent.resetPending,
              'Abyss refresh/reset requires a settled selected run');
            const increment=row.updatedMatchingCount===count+1 && count===(saved.after[tables[1]]?.updatedMatchingCount ?? 0) &&
              row.updatedMatchingCount<=matchingLimit(id) && row.executeRivalListUpdate===true,
              reset=row.updatedMatchingCount===0 && count>0 && !baseline.executeRivalListUpdate && !row.executeRivalListUpdate;
            need(increment || reset,'Abyss counter change is neither native refresh intent nor battle-transition reset');
            const candidate={count:row.updatedMatchingCount,resetPending:Number(reset)};
            matchingCandidates.set(id,candidate);matchingChanges.push({id,generation:saved.generation,...candidate});count=candidate.count;
          }
          if(battle?.serial_pvp_id===id && battle.observed.includes('matchingReset')) count=0;
          need(['userId','serialPvpId','updatedMatchingCount','lastRivalListUpdateAt','lastBattleStartAt'].every(key=>row[key]===
            (key==='lastBattleStartAt' && battle?.serial_pvp_id===id && battle.observed.includes('statusTime') ?
              battle.last_battle_start_at:key==='updatedMatchingCount'?count:baseline[key])),
            'Unissued Abyss timestamp/counter change cannot be saved');
        }
      }
    }
    for(const id of touched) {
        const saved=state(id);
        if(!saved) continue;
        const current=capture(id,working),target=structuredClone(saved.after);
        let statusSaved=0,usageSaved=0;
        if(saved.pending_status && working.has(tables[1])) {
          const actual=current[tables[1]],expected=target[tables[1]];
          if(actual && statusFields.filter(key=>key!=='lastRivalListUpdateAt').every(key=>actual[key]===expected[key]) &&
              actual.lastRivalListUpdateAt>=saved.issued_at-5 && actual.lastRivalListUpdateAt<=saved.issued_at+120) {
            target[tables[1]]=actual;statusSaved=1;
          } else need(equal(actual,saved.before[tables[1]]),'Abyss refresh save is not its issued native checkpoint');
        }
        if(saved.pending_usage && working.has(tables[2])) {
          need(equal(current[tables[2]],saved.before[tables[2]]) || equal(current[tables[2]],target[tables[2]]),
            'Abyss usage reset is not its issued native checkpoint');
          usageSaved=Number(equal(current[tables[2]],target[tables[2]]));
        }
        const candidate={...saved,after:target,pending_status:saved.pending_status && !statusSaved,
          pending_usage:saved.pending_usage && !usageSaved};
        const finished=battle?.serial_pvp_id!==id?latestFinish(id):null;
        if(finished) endCurrent(finished,working,candidate,matchingCandidates.get(id),battle);
        validateCheckpoint(candidate,current,battle?.serial_pvp_id===id?battle:(finished?{serial_pvp_id:id,observed:['statusTime'],
          last_battle_start_at:finished.parent.last_battle_start_at}:null),finished &&
          runEntry(id)?.generation===finished.parent.entry_generation && !finished.cycle.closed ?
            {...finished,usage:current[tables[2]]}:null,
          matchingCandidates.get(id) ?? (battle?.serial_pvp_id===id && battle.observed.includes('matchingReset')?{count:0}:null));
        if(statusSaved || usageSaved) changes.push({id,generation:saved.generation,after:target,
          pendingStatus:Number(candidate.pending_status),pendingUsage:Number(candidate.pending_usage)});
    }
    if(!battle && working.has('UserSerialPvpInfo')) need(equal(working.get('UserSerialPvpInfo'),read('UserSerialPvpInfo').data),
      'Unissued Abyss resume opponent cannot be saved');
    if(!battle && working.has('UserInfo')) need(working.get('UserInfo').length===1 &&
      working.get('UserInfo')[0].processingSerialPvpState===read('UserInfo').data[0]?.processingSerialPvpState,
    'Unissued Abyss processing transition cannot be saved');
    if(working.has('UserInfo')) {
      const before=playerSp(),after=playerSp(working),refill=pendingRefill();
      need(Number(Boolean(entry))+Number(Boolean(refill))+Number(Boolean(ticket))<=1,
        'Pending Abyss run/refill/ticket resource sources conflict');
      if(!equal(before,after)) {
        if(!ticket && triggers.includes('SerialPvpSpRecovry') && !entry && !refill && !activeBattle() && !pending().length) {
          const at=now(),config=serialPvpSpConfig(at,master),id=config && master.serialPvp.serialPvpInformation[config.id].slot18,
            item=master?.serialPvp?.serialPvpSpTicketItem?.[id],state=ticketStockState(),row=state.rows.get(id),
            prior=ticketStock(row),matches=[];
          if(row && int(item?.slot10) && item.slot10>0) for(let amount=1;
              amount<=Math.min(prior.amount-prior.reservedAmount,Math.floor(config.cap/item.slot10));amount++) {
            const gain=amount*item.slot10,candidates=spRecoveryCandidates(before,at,master,config,gain)
              .filter(candidate=>candidate.after.serialPvpSP-candidate.before.serialPvpSP===gain);
            if(candidates.some(candidate=>equal(after,candidate.after))) matches.push(amount);
          }
          need(matches.length===1,'Attempts-first Abyss save has no unique owned recovery-ticket debit');
          eligibility();unlock ??= unlockSnapshot();
          const amount=matches[0],target=serialPvpTicketRecovery(before,id,amount,at,master),stock={...prior,amount:prior.amount-amount};
          newTicket={...target,ticket_id:id,amount,issued_at:at,before:prior,after:stock,stock_saved:0};ticket=newTicket;
          const change=ticketChanges.find(value=>value.id===id);
          if(change) change.stock=prior;
          else ticketChanges.push({id,stock:prior,useId:state.floors.get(id)?.use_id ?? 0});
        }
        const captured=refill && !refill.common.effect_saved &&
          (equal(before,refill.baseline) || refill.candidates.some(row=>equal(before,row.before))) &&
          refill.candidates.some(row=>equal(after,row.after));
        const ticketEffect=ticket && (equal(before,ticket.baseline) || ticket.candidates.some(row=>equal(before,row.before))) &&
          ticket.candidates.some(row=>equal(after,row.after));
        const at=now(),config=serialPvpSpConfig(at,master);
        const initialized=serialPvpInitialize(before,at,master,config);
        const seasonReset=initialized && (equal(after,initialized) || after.serialPvpSPUpdatedAt<=at+5 &&
          at-after.serialPvpSPUpdatedAt<config.interval && equal(after,serialPvpStamina(initialized,after.serialPvpSPUpdatedAt,master,config)));
        const spent=entry && (equal(before,entry.baseline) || entry.candidates.some(row=>equal(before,row.before))) && entryMatches(entry,after);
        const natural=config && after.serialPvpSPUpdatedAt<=at+5 && at-after.serialPvpSPUpdatedAt<config.interval &&
          //An aligned timer stamp can precede the season's opening hour.
          //Use the configuration active at observation, not at that stamp.
          equal(after,serialPvpStamina(before,after.serialPvpSPUpdatedAt,master,config));
        //Refills have an exact captured stock+timestamp, not a minimum whose
        //already-higher baseline could acknowledge an unapplied operation.
        need(captured || ticketEffect || natural || seasonReset || spent,
          'Abyss SP save is neither its issued refill/run/ticket nor native season/interval recovery; stock retained');
        if(refill && !refill.common.effect_saved && !captured) need(refill.candidates.some(row=>equal(after,row.before)),
          'A pending Abyss refill cannot overwrite intervening resource recovery');
        if(entry) {
          need(spent || entry.candidates.some(row=>equal(after,row.before)),
            'A pending Abyss run cannot overwrite intervening resource recovery');
          if(spent) entries.push({id:entry.serial_pvp_id,generation:entry.generation,after});
        }
        if(ticket) {
          need(triggers.includes('SerialPvpSpRecovry'),'Abyss SP recovery requires its original native save trigger');
          need(ticketEffect || ticket.candidates.some(row=>equal(after,row.before)),
            'Pending Abyss ticket recovery cannot overwrite intervening native resources');
          ticketObserved=Boolean(ticketEffect);
        }
      }
    }
    return {lobbies:[...new Map(changes.map(value=>[value.id,value])).values()],entries,usageChanges,matchingChanges,battle,unlock,
      ticketChanges,newTicket,ticketObserved,ticketStockObserved,ticketState:ticket &&
        {id:ticket.id,stock_saved:ticket.stock_saved,sp_saved:ticket.sp_saved}};
  };
  const commit=plan=>{
    recordUnlock(plan.unlock);
    let useId=plan.ticketState?.id;
    if(plan.newTicket) {
      const row=plan.newTicket;
      useId=Number(db.prepare(`INSERT INTO serial_pvp_ticket_use(serial_pvp_id,ticket_id,catalog_hash,issued_at,
        baseline_json,candidates_json,before_json,after_json,amount,stock_saved,sp_saved) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
        .run(row.config.id,row.ticket_id,row.catalog,row.issued_at,JSON.stringify(row.baseline),JSON.stringify(row.candidates),
          JSON.stringify(row.before),JSON.stringify(row.after),row.amount,row.stock_saved,Number(plan.ticketObserved)).lastInsertRowid);
    } else if(plan.ticketObserved || plan.ticketStockObserved) {
      const before=plan.ticketState,stockSaved=Number(before.stock_saved || plan.ticketStockObserved),
        spSaved=Number(before.sp_saved || plan.ticketObserved);
      need(db.prepare(`UPDATE serial_pvp_ticket_use SET stock_saved=?,sp_saved=?
        WHERE id=? AND stock_saved=? AND sp_saved=?`).run(stockSaved,spSaved,useId,before.stock_saved,before.sp_saved).changes===1,
      'Abyss ticket recovery observation disappeared during save');
    }
    for(const row of plan.ticketChanges) db.prepare(`INSERT INTO serial_pvp_ticket_stock(ticket_id,use_id,stock_json) VALUES(?,?,?)
      ON CONFLICT(ticket_id) DO UPDATE SET use_id=excluded.use_id,stock_json=excluded.stock_json`)
      .run(row.id,plan.newTicket?.ticket_id===row.id?useId:row.useId,JSON.stringify(row.stock));
    for(const row of plan.matchingChanges) writeMatching(row.id,row.generation,row);
    for(const battleId of plan.usageChanges) need(db.prepare(`UPDATE serial_pvp_usage_handoff SET observed=1
      WHERE battle_id=? AND issued=1 AND observed=0`).run(battleId).changes===1,
      'Abyss native usage observation disappeared during save');
    for(const row of plan.lobbies) need(db.prepare(`UPDATE serial_pvp_lobby SET after_json=?,pending_status=?,pending_usage=?
      WHERE serial_pvp_id=? AND generation=?`).run(JSON.stringify(row.after),row.pendingStatus,row.pendingUsage,row.id,row.generation).changes===1,
    'Abyss checkpoint disappeared during native save');
    for(const row of plan.entries) need(db.prepare(`UPDATE serial_pvp_run_entry SET observed=1,observed_json=?
      WHERE serial_pvp_id=? AND generation=? AND observed=0`).run(JSON.stringify(row.after),row.id,row.generation).changes===1,
    'Abyss run-entry observation disappeared during native save');
    if(plan.battle) {
      const row=plan.battle;
      if(row.finish) {
        const finish=row.finish;
        if(finish.catalog_hash===scoreCatalog) need(db.prepare('UPDATE serial_pvp_record_handoff SET observed=? WHERE battle_id=? AND catalog_hash=?')
          .run(finish.record_saved,finish.battle_id,scoreCatalog).changes===1,'Abyss score-record observation disappeared during save');
        need(db.prepare(`UPDATE serial_pvp_end SET processing_saved=? WHERE battle_id=? AND operation_id=?`)
          .run(finish.processing_saved,finish.battle_id,finish.operation_id).changes===1,
        'Abyss finish observation disappeared during native save');
        if(finish.acknowledge) {
          recordUsage(finish); // Same transaction as actual native save/close/ACK; never count a queued or replayed round.
          need(db.prepare('UPDATE serial_pvp_battle SET closed=1 WHERE battle_id=? AND closed=0')
            .run(finish.battle_id).changes===1,'Abyss finish lost its active battle during acknowledgement');
          need(db.prepare('DELETE FROM serial_pvp_active WHERE user_id=? AND battle_id=?').run(userId,finish.battle_id).changes===1,
            'Abyss finish lost its active pointer during acknowledgement');
          db.prepare(`INSERT INTO serial_pvp_progress(user_id,serial_pvp_id,battle_id) VALUES(?,?,?)
            ON CONFLICT(user_id,serial_pvp_id) DO UPDATE SET battle_id=excluded.battle_id`)
            .run(userId,finish.serial_pvp_id,finish.battle_id);
          if(finish.cycle.closed) db.prepare(`INSERT INTO serial_pvp_result(user_id,serial_pvp_id,battle_id) VALUES(?,?,?)
            ON CONFLICT(user_id,serial_pvp_id) DO UPDATE SET battle_id=excluded.battle_id`)
            .run(userId,finish.serial_pvp_id,finish.battle_id);
          else db.prepare('INSERT INTO serial_pvp_usage_handoff(battle_id,catalog_hash) VALUES(?,?)')
            .run(finish.battle_id,finish.catalog_hash);
          if(finish.record && finish.record.score>(finish.before.rows[tables[0]]?.score ?? 0))
            db.prepare(`INSERT INTO serial_pvp_high_score(user_id,serial_pvp_id,battle_id) VALUES(?,?,?)
              ON CONFLICT(user_id,serial_pvp_id) DO UPDATE SET battle_id=excluded.battle_id`)
              .run(userId,finish.serial_pvp_id,finish.battle_id);
        }
        return;
      }
      if(!equal(row.observed,JSON.parse(row.observed_json)) || row.last_battle_start_at!==
        db.prepare('SELECT last_battle_start_at FROM serial_pvp_battle WHERE battle_id=?').get(row.battle_id)?.last_battle_start_at)
        need(db.prepare(`UPDATE serial_pvp_battle SET observed_json=?,last_battle_start_at=?
          WHERE battle_id=? AND operation_id=? AND closed=0`).run(JSON.stringify(row.observed),row.last_battle_start_at,
            row.battle_id,row.operation_id).changes===1,'Abyss start observation disappeared during native save');
      if(row.observed.includes('matchingReset')) writeMatching(row.serial_pvp_id,row.lobby_generation,{count:0,resetPending:0});
    }
  };
  const guardPull=value=>{
    if(value.tables.includes('UserGift') || value.tables.includes(tables[0])) guardGifts();
    if(value.tables.includes(flagTable)) unlockSnapshot();
    if(value.tables.some(name=>sensitive.has(name))) need(!pendingTicket(),'Pending Abyss ticket recovery must save before replacing native state');
    if(value.tables.includes(ticketTable)) ticketStockState();
    if(value.tables.some(name=>sensitive.has(name))) need(!pending().length,'Pending Abyss lobby checkpoint must save before replacing native state');
    if(value.tables.includes('UserInfo')) need(!pendingRefill(),'Pending Abyss refill must settle before replacing native resources');
    if(value.tables.some(name=>sensitive.has(name))) need(!pendingEntries().length,'Pending Abyss run entry must save before replacing native state');
    if(value.tables.some(name=>sensitive.has(name))) {
      const unfinishedUsage=db.prepare('SELECT 1 FROM serial_pvp_usage_handoff WHERE issued=1 AND observed=0 LIMIT 1').get();
      need(!unfinishedUsage,'Pending Abyss used-unit summary must save before replacing native state');
      const battle=activeBattle();
      if(battle) {
        need(!endReceipt(battle.battle_id),'Pending Abyss finish must save and acknowledge before replacing native state');
        battleCurrent(battle);
        need(battle.done && requiredStartProofs(battle.before).every(key=>battle.observed.includes(key)),
          'Pending Abyss start must save and acknowledge before replacing native state');
      }
    }
  };
  return {actions,sensitive,access,replay,issue,savePlan,commit,guardPull,state,
    settleRankingRewards,guardGifts,rankingRewardReceipt,guardTitleBadges,recordGiftClaim,giftDelivery,
    refillReceipt,refillTarget,recordRefill,refillObserved,refillDelivery,runEntry,
    activeBattle,battleReceipt,operationDelivery,endReceipt,finishedResult,latestFinish,pendingTicket,ticketAcquisition};
}

module.exports={openSerialPvp,sameGift,serialPvpRows,serialPvpCpuRivals,initialRecord,initialStatus,initialUsage,
  serialPvpRankingPrize,
  serialPvpUnlockConfig,serialPvpUnlockFlag,serialPvpEligibility,
  serialPvpSeasonAt,serialPvpSpConfig,serialPvpSpStatus,serialPvpStamina,serialPvpRefill,serialPvpInitialize,serialPvpRunEntry,
  serialPvpTicketRows,serialPvpTicketRecovery,
  serialPvpEndInput,serialPvpCycle,serialPvpNextUsage,serialPvpPartyReady,serialPvpScoreRecord};
