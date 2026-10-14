'use strict';

// SOURCE-ONLY offline CPU matching, daily-SP projection and local settlement.
// No publisher rank simulation or profile pre-credit; native acceptance pending.
const long = n => Number.isSafeInteger(n) && n >= 0;
const int = n => long(n) && n <= 0x7fffffff;
const unavailable = message => { throw Object.assign(new Error(message), { status:503,offlineUnavailable:true }); };
const need = (ok,message) => { if (!ok) unavailable(message); };

function underPvpSeasonAt(at,master) {
  need(long(at) && master?.underPvp?.underPvpInformation,'Original Under Telskyura calendar unavailable');
  //175ed24/2545c18 use original slots10/11 with2a3a5dc's exclusive end,
  // NOT the shorter slots8/9 matching window. Retain authored calendar gaps.
  const rows=Object.entries(master.underPvp.underPvpInformation);
  need(rows.every(([id,row])=>long(Number(id)) && Number(id)>0 && row && long(row.slot10) && long(row.slot11)),
    'Original Under Telskyura calendar requires reconciliation');
  const active=rows.filter(([,row])=>(!row.slot10 || at>=row.slot10) && (!row.slot11 || at<row.slot11));
  need(active.length<=1,'Ambiguous original Under Telskyura period');
  return active.length ? { id:Number(active[0][0]),...active[0][1] } : null;
}

function underPvpStamina(status,at,master) {
  need(status && int(status.underPvpSP) && status.underPvpSP<=999999999 &&
    long(status.underPvpSPUpdatedAt) && long(at),'Saved Under Telskyura stamina requires reconciliation');
  const before={ underPvpSP:status.underPvpSP,underPvpSPUpdatedAt:status.underPvpSPUpdatedAt };
  const day=epoch=>Math.floor((epoch+32400)/86400);
  if (day(at)===day(before.underPvpSPUpdatedAt)) return before;
  const active=underPvpSeasonAt(at,master),previous=underPvpSeasonAt(before.underPvpSPUpdatedAt,master);
  const allowance=active ? master.underPvp.underPvpRule?.[active.slot3]?.slot1 : 0;
  need(int(allowance) && allowance<=999999999,'Original Under Telskyura daily allowance unavailable');
  //25459f0 tops up once, not once per missed day. Ticket stock above the
  // allowance survives within a season; only a known different season resets.
  return { underPvpSP:active && previous && active.id!==previous.id ? allowance : Math.max(before.underPvpSP,allowance),
    underPvpSPUpdatedAt:at };
}

function underPvpPassRows(rows,master,userId) {
  need(Array.isArray(rows),'Saved Under Telskyura passes unavailable');
  const result=new Map(),keys=['userId','underPvpStaminaTicketId','amount','bookEntryState','signature','targetUnderPvpInfoId'].sort().join(',');
  for (const row of rows) {
    const ticket=master?.underPvp?.underPvpStaminaTicket?.[row?.underPvpStaminaTicketId];
    //27538d8/278e1f0 serialize SIX fields, no cumulativeAmount/dateList.
    // The signature is uint32; target season comes from original slot7.
    need(row && Object.keys(row).sort().join(',')===keys && row.userId===userId && ticket &&
      int(row.underPvpStaminaTicketId) && !result.has(row.underPvpStaminaTicketId) &&
      int(row.amount) && row.amount<=999999999 && [0,1,2,3].includes(row.bookEntryState) &&
      long(row.signature) && row.signature<=0xffffffff && row.targetUnderPvpInfoId===ticket.slot7 &&
      master.underPvp.underPvpInformation[ticket.slot7] && int(ticket.slot8) && ticket.slot8>0,
    'Saved Under Telskyura pass identity/stock requires reconciliation');
    result.set(row.underPvpStaminaTicketId,row);
  }
  return result;
}

function underPvpPassCandidates(status,amount,at,master) {
  need(int(amount) && amount>0,'Invalid Under Telskyura pass recovery');
  const raw=underPvpStamina(status,status?.underPvpSPUpdatedAt,master),daily=underPvpStamina(raw,at,master);
  //2541c14 checks capacity BEFORE spending a pass;2545f40 changes only SP,
  // not its daily timestamp. Daily recovery may already be dirty locally.
  const rows=[raw,daily].filter((row,index,all)=>all.findIndex(value=>JSON.stringify(value)===JSON.stringify(row))===index &&
    row.underPvpSP+amount<=999999999).map(before=>({ before,after:{ ...before,underPvpSP:before.underPvpSP+amount } }));
  need(rows.length,'Under Telskyura attempts have no capacity for this pass');
  return rows;
}

function underPvpPassChanges(beforeRows,afterRows,at,master,userId) {
  const before=underPvpPassRows(beforeRows,master,userId),after=underPvpPassRows(afterRows,master,userId),claims=[];
  for (const [id,row] of before) need(after.has(id),'Under Telskyura pass rows cannot be deleted without recovered expiry proof');
  for (const [id,row] of after) {
    const previous=before.get(id),baseline=previous?.amount ?? 0;
    need(row.amount<=baseline,'Under Telskyura pass acquisition requires its original producer receipt');
    if (row.amount===baseline) continue;
    const ticket=master.underPvp.underPvpStaminaTicket[id],season=underPvpSeasonAt(at,master);
    need(season?.id===ticket.slot7,'This Under Telskyura pass belongs to another original season');
    claims.push({ ticket_id:id,before_amount:baseline,remaining:row.amount,amount:baseline-row.amount,
      under_pvp_id:ticket.slot7,recovery:(baseline-row.amount)*ticket.slot8 });
  }
  need(claims.every(row=>int(row.recovery) && row.recovery>0) && int(claims.reduce((sum,row)=>sum+row.recovery,0)),
    'Under Telskyura pass recovery overflow');
  return claims;
}

function underPvpRematchSeasons(master) {
  const source=master?.underPvp,result=new Map();
  need(source?.underPvpInformation && source.underPvpRevengeTicket,'Original rematch catalog unavailable');
  for (const [key,season] of Object.entries(source.underPvpInformation)) {
    const id=Number(key),ticketId=season.slot22;
    need(long(id) && id>0 && int(ticketId) && int(season.slot21) && season.slot21<=999999999 &&
      (!ticketId ? season.slot21===0 : source.underPvpRevengeTicket[ticketId] && season.slot21>0 && !result.has(ticketId)),
    'Original rematch season/ticket binding requires reconciliation');
    if (ticketId) result.set(ticketId,{ id,ticketId,allowance:season.slot21 });
  }
  need(Object.keys(source.underPvpRevengeTicket).every(id=>result.has(Number(id))),
    'Original rematch ticket has no unique season');
  return result;
}

function underPvpRematchTickets(rows,master,userId) {
  need(Array.isArray(rows),'Saved rematch tickets unavailable');
  const seasons=underPvpRematchSeasons(master),result=new Map(),keys=['userId','underPvpRevengeTicketId',
    'amount','bookEntryState','cumulativeAmount','reservedAmount','signature'].sort().join(',');
  for (const row of rows) {
    //2754f98/278f5cc: SEVEN fields. Unlike passes, cumulative/reserved are real.
    //1be26c4 sets the allowance WITHOUT a cumulative gain: amount3/cumulative0
    // is legitimate. Root book getter234e16c returns1; its setter is a no-op.
    need(row && Object.keys(row).sort().join(',')===keys && row.userId===userId &&
      int(row.underPvpRevengeTicketId) && seasons.has(row.underPvpRevengeTicketId) && !result.has(row.underPvpRevengeTicketId) &&
      ['amount','cumulativeAmount','reservedAmount'].every(key=>int(row[key]) && row[key]<=999999999) &&
      [0,1,2,3].includes(row.bookEntryState) && long(row.signature) && row.signature<=0xffffffff,
    'Saved rematch ticket identity/stock requires reconciliation');
    result.set(row.underPvpRevengeTicketId,row);
  }
  return result;
}

function underPvpRematchStatuses(rows,master,userId) {
  need(Array.isArray(rows),'Saved rematch statuses unavailable');
  const result=new Map(),keys=['userId','underPvpId','isRevenge','revengeUserId','initialSetting','revengeStartAt'].sort().join(',');
  for (const row of rows) {
    //280fd8c parser/27138b0 merge key underPvpId, not revengeUserId.
    //24e7938's lazy domain constructor supplies the current owned user ID.
    need(row && Object.keys(row).sort().join(',')===keys && row.userId===userId && long(row.underPvpId) && row.underPvpId>0 &&
      master?.underPvp?.underPvpInformation?.[row.underPvpId] && !result.has(row.underPvpId) &&
      typeof row.isRevenge==='boolean' && typeof row.initialSetting==='boolean' &&
      long(row.revengeUserId) && long(row.revengeStartAt),'Saved rematch status identity requires reconciliation');
    result.set(row.underPvpId,row);
  }
  return result;
}

const underPvpRematchStock=row=>({ amount:row?.amount ?? 0,cumulativeAmount:row?.cumulativeAmount ?? 0,
  reservedAmount:row?.reservedAmount ?? 0 });

function underPvpRematchTarget(seasonId,beforeTicket,beforeStatus,at,master,userId) {
  const binding=[...underPvpRematchSeasons(master).values()].find(row=>row.id===seasonId);
  need(binding && underPvpSeasonAt(at,master)?.id===seasonId,'Rematch initialization requires its original active season');
  if (beforeTicket) need(underPvpRematchTickets([beforeTicket],master,userId).has(binding.ticketId),
    'Rematch initialization ticket baseline belongs to another season');
  if (beforeStatus) need(underPvpRematchStatuses([beforeStatus],master,userId).has(seasonId) && !beforeStatus.initialSetting,
    'Rematch initialization cannot repeat an already initialized season');
  //1be26c4: root amount SETTER+0x48(slot21), then24e7c60(true).
  //NOT common gain+0x50, no network operation or cumulative increase.
  return { ...binding,stock:{ ...underPvpRematchStock(beforeTicket),amount:binding.allowance } };
}

const underPvpRematchIdentity=row=>JSON.stringify(['userId','underPvpId','isRevenge','revengeUserId','initialSetting','revengeStartAt']
  .map(key=>row[key]));

function underPvpRematchDefault(seasonId,master,userId) {
  const row={userId,underPvpId:seasonId,isRevenge:false,revengeUserId:0,initialSetting:false,revengeStartAt:0};
  underPvpRematchStatuses([row],master,userId);
  return row;
}

function underPvpRematchResult(before,record,stock,isWin,opponentId,at,master,userId) {
  underPvpRematchStatuses([before],master,userId);
  const season=master.underPvp.underPvpInformation[before.underPvpId],cap=master.underPvp.underPvpGrade?.[season.slot23];
  need(int(stock) && stock<=999999999 && (!season.slot22 ? stock===0 : master.underPvp.underPvpRevengeTicket?.[season.slot22]) &&
    typeof isWin==='boolean' && long(opponentId) && opponentId>0 && long(at) &&
    long(season.slot23) && (!season.slot23 || cap && int(cap.slot5)), 'Original rematch result/score ceiling unavailable');
  underPvpRecord([record],before.underPvpId,master,userId);
  need(record.underPvpId===before.underPvpId,'Rematch result belongs to another season');
  //21fbe48 passes underPvpResult.isWin and the captured opponent to24e82a0.
  //24e7b8c sets USER ID;24e7d34 sets TIME (not the other way around).
  //Every disabled branch clears user ID but RETAINS the old timestamp.
  //Retirement uses isWin=false; the client does not test isRetire here.
  const eligible=!before.isRevenge && (!cap || record.score<cap.slot5) && stock>0 && !isWin;
  return {...before,isRevenge:eligible,revengeUserId:eligible?opponentId:0,revengeStartAt:eligible?at:before.revengeStartAt};
}

function underPvpRematchReset(before,at,master,userId) {
  underPvpRematchStatuses([before],master,userId);
  const season=master.underPvp.underPvpInformation[before.underPvpId];
  need(long(at) && long(season.slot8) && long(season.slot9) && season.slot9>season.slot8,
    'Original rematch matching period unavailable');
  //24eb880/2a3a5dc: original matching window has an exclusive end.
  //UI1be26c4 then24e8534 clears flag/UID only; time/initialSetting survive.
  return at<season.slot8 || at>=season.slot9 ? {...before,isRevenge:false,revengeUserId:0} : null;
}

function underPvpRematchSpend(ticket,seasonId,master,userId) {
  const season=master?.underPvp?.underPvpInformation?.[seasonId];
  need(season && underPvpRematchTickets([ticket],master,userId).has(season.slot22) && ticket.amount>0,
    'Rematch battle requires its original season ticket and positive saved stock');
  //21db744: isRevenge branch uses amount SETTER+0x48(max(amount-1,0)).
  //No SP cost, medal credit, cumulative gain or reserved-stock mutation.
  //Reject empty stock instead of turning the native clamp into free battles.
  return {...underPvpRematchStock(ticket),amount:ticket.amount-1};
}

function underPvpRematchGain(before,ticketId,amount,master,userId) {
  need(underPvpRematchSeasons(master).has(ticketId) && int(amount) && amount>0,
    'Rematch present requires an original ticket and positive native quantity');
  if (before) need(underPvpRematchTickets([before],master,userId).has(ticketId),'Rematch present baseline belongs to another ticket');
  const stock=underPvpRematchStock(before);
  // Root42acc38 +0x50 ->24d8844, +0xb0 ->24d8d94: additive gain
  // caps amount/cumulative separately, preserves reserved, book setter is no-op.
  // Both native additions use int32 before the cap: never send an overflow.
  need(stock.amount+amount<=0x7fffffff && stock.cumulativeAmount+amount<=0x7fffffff,
    'Rematch present exceeds the recovered native addition range');
  return {...stock,amount:Math.min(999999999,stock.amount+amount),
    cumulativeAmount:Math.min(999999999,stock.cumulativeAmount+amount)};
}

function underPvpRecord(rows,seasonId,master,userId) {
  const source=master?.underPvp,season=source?.underPvpInformation?.[seasonId];
  need(season && source.underPvpGrade && Array.isArray(rows),'Original Under Telskyura season or saved records unavailable');
  const seen=new Set();
  for (const row of rows) {
    need(row && row.userId===userId && long(row.underPvpId) && row.underPvpId>0 &&
      source.underPvpInformation[row.underPvpId] && !seen.has(row.underPvpId) &&
      ['gradeId','highestGradeId','lastRivalListUpdateAt'].every(key=>long(row[key])) &&
      ['rank','score','winCount','loseCount','consecutiveWinCount','updatedMatchingCount'].every(key=>int(row[key])) &&
      ['isReceiveReward','isAggregate','updateRivalList','executeRivalListUpdate'].every(key=>typeof row[key]==='boolean') &&
      Array.isArray(row.lastAdversaryIds) && row.lastAdversaryIds.every(long) &&
      typeof row.lastBattleId==='string' && row.lastBattleId.length<=256 &&
      source.underPvpGrade[row.gradeId] && source.underPvpGrade[row.highestGradeId] &&
      source.underPvpGrade[row.gradeId].slot1===source.underPvpInformation[row.underPvpId].slot5 &&
      source.underPvpGrade[row.highestGradeId].slot1===source.underPvpInformation[row.underPvpId].slot5,
    'Saved Under Telskyura record requires reconciliation');
    seen.add(row.underPvpId);
  }
  const existing=rows.find(row=>row.underPvpId===seasonId);
  if (existing) return { ...existing,lastAdversaryIds:[...existing.lastAdversaryIds] };
  const grades=Object.entries(source.underPvpGrade).filter(([,row])=>row.slot1===season.slot5 && row.slot5===0);
  need(grades.length===1,'Original initial Under Telskyura grade unavailable');
  // Native288e5c8 initializes receiveReward=true, aggregate=false and zero
  // counters. Grade selection is an explicit local initial-score policy.
  const gradeId=Number(grades[0][0]);
  return { userId,underPvpId:seasonId,gradeId,rank:0,score:0,winCount:0,loseCount:0,
    consecutiveWinCount:0,updatedMatchingCount:0,lastAdversaryIds:[],lastBattleId:'',
    isReceiveReward:true,isAggregate:false,highestGradeId:gradeId,updateRivalList:false,
    lastRivalListUpdateAt:0,executeRivalListUpdate:false };
}

// Only fields actually merged by21dab6c. An old summary must not overwrite
// newer native progress, while an unrelated UI/list-refresh flag is not a win.
function underPvpRecordIdentity(record) {
  return JSON.stringify(['userId','underPvpId','gradeId','rank','score','winCount','loseCount',
    'consecutiveWinCount','highestGradeId','isAggregate'].map(key=>record[key]));
}

const underPvpStatusFields=['userId','underPvpId','updatedMatchingCount','updateRivalList',
  'lastRivalListUpdateAt','executeRivalListUpdate','lastBattleStartAt'];
const underPvpStatusEqual=(a,b)=>Boolean(a && b && underPvpStatusFields.every(key=>a[key]===b[key]));

function underPvpGameStatusDefault(id) {
  //2891dac initializes updateRivalList=true, not the record's false default.
  return {userId:0,underPvpId:id,updatedMatchingCount:0,updateRivalList:true,
    lastRivalListUpdateAt:0,executeRivalListUpdate:false,lastBattleStartAt:0};
}

function underPvpRefreshLimit(id,master) {
  const season=master?.underPvp?.underPvpInformation?.[id],rule=master?.underPvp?.underPvpRule?.[season?.slot3];
  //24e94cc binds information.slot3;1be8164/1bd936c read rule offset0xe (slot5).
  need(rule && int(rule.slot5) && rule.slot5>0,'Original Under Telskyura refresh quota unavailable');
  return rule.slot5;
}

function underPvpRefreshIntent(status,id,master) {
  const before=status ?? underPvpGameStatusDefault(id);
  need(before.underPvpId===id && int(before.updatedMatchingCount) && typeof before.executeRivalListUpdate==='boolean',
    'Under Telskyura manual intent baseline requires reconciliation');
  return !before.executeRivalListUpdate && before.updatedMatchingCount<underPvpRefreshLimit(id,master)
    ? {...before,updatedMatchingCount:before.updatedMatchingCount+1,executeRivalListUpdate:true} : null;
}

function underPvpSelectedRivalReset(status,at) {
  need(long(at) && long(at+32400) && (!status || long(status.lastRivalListUpdateAt) &&
    long(status.lastRivalListUpdateAt+32400)),'Under Telskyura refresh date requires reconciliation');
  //24e9570 sends true only for absent status or a different2a3a450 JST date.
  return !status || Math.floor((at+32400)/86400)!==Math.floor((status.lastRivalListUpdateAt+32400)/86400);
}

function underPvpRefreshDayMatches(status,at,reset) {
  // Offline arrival tolerance, not publisher validation: at most5s in transit.
  return typeof reset==='boolean' && [at,Math.max(0,at-5)]
    .some(time=>reset===underPvpSelectedRivalReset(status,time));
}

function underPvpRefreshTarget(row,before,manual,issuedAt,observedAt=issuedAt) {
  //24ec330 clears list flags/stamps AppTime. GUI resetRivalList/onStopRevenge
  // additionally clear the counter; their caller identity is absent on wire.
  return row && row.userId===before.userId && row.underPvpId===before.underPvpId &&
    row.lastBattleStartAt===before.lastBattleStartAt && row.updateRivalList===false &&
    row.executeRivalListUpdate===false && (row.updatedMatchingCount===before.updatedMatchingCount ||
      !manual && row.updatedMatchingCount===0) &&
    [issuedAt,observedAt].some(at=>row.lastRivalListUpdateAt>=Math.max(0,at-5) && row.lastRivalListUpdateAt<=at+120);
}

function underPvpGameStatuses(rows,master,userId) {
  need(Array.isArray(rows) && master?.underPvp?.underPvpInformation,'Saved Under Telskyura statuses unavailable');
  const result=new Map();
  for (const row of rows) {
    //24ec330/2891dac's lazy native game-status constructor leaves userId0.
    // Accept only that class's0/local ownership, never a foreign account.
    //27db02c/280e92c consume exactly seven fields; no private receipt fields.
    need(row && Object.keys(row).sort().join(',')===[...underPvpStatusFields].sort().join(',') &&
      [0,userId].includes(row.userId) && long(row.underPvpId) && row.underPvpId>0 &&
      master.underPvp.underPvpInformation[row.underPvpId] && !result.has(row.underPvpId) &&
      int(row.updatedMatchingCount) && long(row.lastRivalListUpdateAt) && long(row.lastBattleStartAt) &&
      typeof row.updateRivalList==='boolean' && typeof row.executeRivalListUpdate==='boolean',
    'Saved Under Telskyura status requires reconciliation');
    result.set(row.underPvpId,row);
  }
  return result;
}

function underPvpCpuParty(partyId,master) {
  const source=master?.underPvp,party=source?.dummyUnderPvpParty?.[partyId];
  need(party && long(partyId) && partyId>0 && source.underPvpGrade?.[party.slot2] &&
    source.dummyUnderPvpPartySlot && source.dummyUnderPvpPc,
    'Original Under Telskyura CPU party unavailable');
  const unit=id=>{
    if (!id) return null;
    const row=source.dummyUnderPvpPc[id],profile=master.pcProfiles?.[row?.slot1];
    need(row && profile && Array.isArray(profile.jobIds) && Array.from({ length:15 },(_,i)=>row[`slot${i+1}`]).every(int) &&
      row.slot2>0 && row.slot3>0 && row.slot3<=profile.jobIds.length && row.slot4<=5 &&
      Array.from({ length:12 },(_,i)=>row[`slot${i+16}`]).every(n=>n===0),
    'Original CPU unit has unsupported or missing fields');
    // Explicit local projection of the authored dummy vector into287cf20's
    // JSON PC fields. Numeric ordering is retained; not publisher wire proof.
    // No board/gear/ascension values are invented for absent source slots.
    const keys=['pcId','level','currentJobIndex','limitbreakCount','usableSkillAmount','strength',
      'intelligence','agility','vitality','luck','hp','mp','physicalAttackPower','magicAttackPower','defensePower'];
    return { ...Object.fromEntries(keys.map((key,i)=>[key,row[`slot${i+1}`]])),weaponId:0,armorId:0,
      weaponAbilityIds:[],armorAbilityIds:[],heroSublimateLevel:0,isUnlockedHeroSublimate:false };
  };
  const slots=[5,6,7,8,9,10].map((key,index)=>{
    const slot=source.dummyUnderPvpPartySlot[party[`slot${key}`]];
    need(slot && source.dummyUnderPvpPc[slot.slot1],'Original CPU party slot unavailable');
    //287cb78 consumes pc/assistingPc/isHidden; slot numbers are one-based.
    return { slotNumber:index+1,pc:unit(slot.slot1),assistingPc:unit(slot.slot2),isHidden:false };
  });
  // Native27d7628 accepts these fields; type7 is assigned again by24ea2a8.
  // Attack pattern2 is the existing offline UserPvPParty default, NOT a
  // recovered per-CPU preference. Under Telskyura source has no memoria rows.
  return { userId:partyId,partyType:7,index:0,attackPattern:2,slots,memoriaSlots:[] };
}

function underPvpCpuRivals(record,generation,master) {
  const source=master?.underPvp,season=source?.underPvpInformation?.[record.underPvpId];
  need(season && int(generation) && source.dummyUnderPvpUserProfile && source.underPvpTutorialDummyPartyGroup &&
    source.dummyUnderPvpParty,'Invalid offline CPU matching generation or original tables');
  const profiles=Object.entries(source.dummyUnderPvpUserProfile).sort((a,b)=>Number(a[0])-Number(b[0]));
  need(profiles.length && profiles.every(([,row])=>typeof row.slot1==='string' && row.slot1.length>0),
    'Original CPU names unavailable');
  const grade=source.underPvpGrade?.[record.gradeId];
  need(grade?.slot1===season.slot5 && int(grade.slot7),'Original offline matching grade unavailable');
  const groups=Object.values(source.underPvpTutorialDummyPartyGroup).filter(row=>
    row.slot1===season.slot5 && row.slot2===record.gradeId);
  let fallback=Object.entries(source.dummyUnderPvpParty).filter(([,row])=>
    row.slot1===season.slot5 && row.slot2===record.gradeId).map(([id])=>Number(id)).sort((a,b)=>a-b);
  if (!fallback.length && !groups.length) {
    // Own offline policy: the archive has no teams above grade3. Reuse the
    // highest authored lower grade, keeping its actual grade/stats/score.
    // Never scale a fixture or claim this is recovered live-player matching.
    const authored=Object.entries(source.dummyUnderPvpParty).filter(([,row])=>row.slot1===season.slot5 &&
      source.underPvpGrade[row.slot2]?.slot1===season.slot5 && int(source.underPvpGrade[row.slot2].slot7) &&
      source.underPvpGrade[row.slot2].slot7<=grade.slot7);
    const highest=Math.max(-1,...authored.map(([,row])=>source.underPvpGrade[row.slot2].slot7));
    fallback=authored.filter(([,row])=>source.underPvpGrade[row.slot2].slot7===highest)
      .map(([id])=>Number(id)).sort((a,b)=>a-b);
  }
  const selected=new Set();
  return [0,1,2].map(rating=>{
    const authored=groups.filter(row=>row.slot3===rating).map(row=>row.slot4).sort((a,b)=>a-b);
    const preferred=[...new Set(authored)].filter(id=>!selected.has(id));
    const candidates=preferred.length ? preferred : fallback.filter(id=>!selected.has(id));
    need(candidates.length,'No original CPU party for this grade/rating');
    // Own offline policy: one cyclic authored opponent per rating. Tutorial
    // group grade and opponent grade may differ in the ORIGINAL archive.
    const id=candidates[(generation+rating)%candidates.length],party=source.dummyUnderPvpParty[id];
    selected.add(id);
    const level=master.playerLevels?.find(([rank])=>rank===party?.slot3),cpu=underPvpCpuParty(id,master);
    need(party && int(party.slot4) && level && long(level[1]),'Original CPU profile level/score unavailable');
    const name=profiles[(generation*3+rating)%profiles.length][1].slot1;
    return { rating,underPvpPlayerInfo:{ userId:id,score:party.slot4,name:`${name} [Offline CPU]`,
      leaderPcId:cpu.slots[0].pc.pcId,gradeId:party.slot2,rank:0,preRank:0,titleBadgeId:0,
      subTitleBadgeId:0,isDummy:true,totalExp:level[1] },underPvpParty:cpu };
  });
}

function underPvpCpuDetails(rival,master) {
  const info=rival?.underPvpPlayerInfo,party=rival?.underPvpParty;
  need(info?.isDummy===true && info.userId===party?.userId && typeof info.name==='string' &&
    info.name.endsWith('[Offline CPU]') && long(info.totalExp) && Array.isArray(party.slots),
  'Offline CPU profile requires its captured rival');
  const characterId=master.pcProfiles?.[info.leaderPcId]?.characterId;
  // Own NPC presentation policy, not recovered publisher player accounts.
  // If this character has no communication portrait, use the original Bell
  // portrait and say so. Never supply an invalid portrait ID to the client.
  const favorite=Object.entries(master.communicationCharacters ?? {}).find(([,row])=>row.characterId===characterId) ??
    Object.entries(master.communicationCharacters ?? {}).find(([,row])=>row.key==='comm_character.bel1');
  const costume=Object.entries(master.characterCostumes ?? {}).filter(([,row])=>
    row.characterKey===master.characters?.[favorite?.[1].characterId]?.key).sort((a,b)=>Number(a[0])-Number(b[0]))[0];
  need(favorite && costume,'Original CPU profile portrait/costume unavailable');
  const totalStatusPoint=party.slots.flatMap(row=>[row.pc,row.assistingPc]).filter(Boolean)
    .reduce((sum,pc)=>sum+['strength','intelligence','agility','vitality','luck'].reduce((n,key)=>n+pc[key],0),0);
  need(int(totalStatusPoint),'Original CPU status total is invalid');
  //2771584 reads the four-field UserPvPParty, NOT the seven-field UserParty
  // used by the start request.24ef9d0 iterates the underPvpRecord ARRAY.
  return { playerInfo:{ userId:info.userId,name:info.name,
    description:'Offline CPU from the original archive. Original grade and stats retained; higher tiers reuse archived lower-grade teams.'+
      (favorite[1].characterId===characterId ? '' : ' Bell portrait placeholder.'),
    favoriteCharacterId:Number(favorite[0]),favoriteCharacterFriendship:0,favoriteCharacterCostumeId:Number(costume[0]),
    totalExp:info.totalExp,lastLoginedAt:0,heroType:0,totalStatusPoint,dispFlag:true,exploitIds:[],
    titleBadgeId:0,subTitleBadgeId:0,familiaName:'' },
    pvpParty:{ userId:info.userId,slots:party.slots,attackPattern:party.attackPattern,memoriaSlots:party.memoriaSlots },
    underPvpRecord:[],substitutedSpineIds:[] };
}

function underPvpSettlement(before,rating,result,master) {
  const season=master?.underPvp?.underPvpInformation?.[before?.underPvpId],rule=master?.underPvp?.underPvpRule?.[season?.slot3];
  need(rule && [0,1,2].includes(rating) && typeof result?.isWin==='boolean' && typeof result.isRetire==='boolean' &&
    !(result.isWin && result.isRetire),'Invalid offline Under Telskyura settlement');
  // ponytail: offline-under-pvp-v1, not recovered publisher scoring. The
  // original rule's15/20/30 values are assigned to easy/normal/hard wins;
  // losses/retirements grant no score, and no publisher rank/prize is invented.
  const gain=result.isWin ? [rule.slot4,rule.slot3,rule.slot2][rating] : 0;
  need(int(gain) && int(before.score+gain) && int(before.winCount+(result.isWin?1:0)) &&
    int(before.loseCount+(result.isWin?0:1)) && int(before.consecutiveWinCount+(result.isWin?1:0)),
    'Offline Under Telskyura progression overflow');
  const score=before.score+gain,grades=Object.entries(master.underPvp.underPvpGrade)
    .filter(([,row])=>row.slot1===season.slot5 && int(row.slot5) && row.slot5<=score).sort((a,b)=>b[1].slot5-a[1].slot5);
  need(grades.length && (!grades[1] || grades[0][1].slot5!==grades[1][1].slot5),'Original Under Telskyura score grade unavailable');
  const gradeId=Number(grades[0][0]),highest=master.underPvp.underPvpGrade[before.highestGradeId];
  need(highest,'Original Under Telskyura highest grade unavailable');
  const record={ ...before,gradeId,score,winCount:before.winCount+(result.isWin?1:0),loseCount:before.loseCount+(result.isWin?0:1),
    consecutiveWinCount:result.isWin ? before.consecutiveWinCount+1 : 0,
    highestGradeId:grades[0][1].slot5>highest.slot5 ? gradeId : before.highestGradeId };
  return { record,result:{ underPvpId:before.underPvpId,isWin:result.isWin,gradeId,score,scoreDifference:gain } };
}

module.exports={ underPvpRecord,underPvpRecordIdentity,underPvpGameStatuses,underPvpGameStatusDefault,underPvpStatusEqual,
  underPvpRefreshLimit,underPvpRefreshIntent,underPvpSelectedRivalReset,underPvpRefreshDayMatches,underPvpRefreshTarget,
  underPvpCpuParty,underPvpCpuRivals,underPvpCpuDetails,underPvpSettlement,
  underPvpSeasonAt,underPvpStamina,underPvpPassRows,underPvpPassCandidates,underPvpPassChanges,
  underPvpRematchSeasons,underPvpRematchTickets,underPvpRematchStatuses,underPvpRematchStock,underPvpRematchTarget,
  underPvpRematchIdentity,underPvpRematchDefault,underPvpRematchResult,underPvpRematchReset,underPvpRematchSpend,underPvpRematchGain };
