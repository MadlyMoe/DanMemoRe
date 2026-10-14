'use strict';

// SOURCE ONLY / UNTESTED. One participant in a local league, not publisher ranking.
const crypto=require('node:crypto');
const {underPvpRecord,underPvpRecordIdentity}=require('./under_pvp.cjs');
const long=n=>Number.isSafeInteger(n) && n>=0,int=n=>long(n) && n<=0x7fffffff;
const need=(ok,message)=>{if(!ok) throw Object.assign(new Error(message),{status:503,offlineUnavailable:true});};
const input=(ok,message)=>{if(!ok) throw Object.assign(new Error(message),{status:400});};
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const prefix='[Offline Under Telskyura reward] ';

function underPvpRankingPrize(id,master) {
  const season=master?.underPvp?.underPvpInformation?.[id],catalog=master?.underPvp?.underPvpGroupRankingReward;
  need(season && long(season.slot7) && season.slot7>0 && long(season.slot8) && long(season.slot9) &&
    season.slot8<season.slot9 && catalog && typeof catalog==='object' && !Array.isArray(catalog),
    'Original Under Telskyura season/ranking prize group is unavailable');
  //1bf9b08 reads information.slot7, group.slot1, inclusive ranks.slot2/3,
  //and five item/amount pairs.slot4..13. Rank1 does not use the max0 sentinel.
  const matches=Object.entries(catalog).filter(([,row])=>row?.slot1===season.slot7 && row.slot2<=1 && row.slot3>=1);
  need(matches.length===1,'Original first-place Under Telskyura prize is missing or ambiguous');
  const [rewardId,row]=matches[0],items=[];
  need(long(Number(rewardId)) && Number(rewardId)>0 && int(row.slot2) && row.slot2>0 && int(row.slot3) && row.slot3>=row.slot2,
    'Original Under Telskyura prize rank interval is unavailable');
  for(let slot=4;slot<=12;slot+=2) {
    const itemId=row[`slot${slot}`],amount=row[`slot${slot+1}`];
    need(int(itemId) && int(amount) && Boolean(itemId)===Boolean(amount) && (!itemId || master.itemProfiles?.[itemId]),
      'Original Under Telskyura ranking prize item/amount is unavailable');
    if(itemId) items.push({itemId,amount});
  }
  need(items.length && new Set(items.map(item=>item.itemId)).size===items.length,
    'Original Under Telskyura ranking prize items are empty or ambiguous');
  return {items,endAt:season.slot9,title:`${prefix}${id} / Local rank 1`,
    catalog:hash([season,Number(rewardId),row,'offline-single-participant-final-rank1-v1'])};
}

function openUnderPvpRanking({db,read,master,userId,now,floor,capture,active,processing,createGifts,sameGift}) {
  db.exec(`CREATE TABLE IF NOT EXISTS under_pvp_ranking_reward(under_pvp_id INTEGER PRIMARY KEY,
    battle_id TEXT NOT NULL UNIQUE,issued_at INTEGER NOT NULL,catalog_hash TEXT NOT NULL,
    record_json TEXT NOT NULL,gifts_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS under_pvp_ranking_gift(gift_id INTEGER PRIMARY KEY,under_pvp_id INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS under_pvp_ranking_gift_season ON under_pvp_ranking_gift(under_pvp_id);
    CREATE TABLE IF NOT EXISTS under_pvp_title_badge(title_badge_id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,
      under_pvp_id INTEGER NOT NULL,battle_id TEXT NOT NULL,awarded_at INTEGER NOT NULL,catalog_hash TEXT NOT NULL);`);
  const untouched=row=>row && row.rank===0 && row.score===0 && row.winCount===0 && row.loseCount===0 &&
    row.consecutiveWinCount===0 && row.isAggregate===false;
  const participation=id=>{
    const saved=db.prepare('SELECT * FROM under_pvp_record_state WHERE under_pvp_id=?').get(id),last=floor(id);
    if(!saved) return null;
    //shortcut: legacy floors have no retained local attempt count; do not
    //reconstruct publisher participation or scan lifetime battles for a prize.
    if(saved.attempt_count===null && saved.first_battle_id===null) return null;
    need(int(saved.attempt_count) && saved.attempt_count>0 && typeof saved.first_battle_id==='string',
      'Under Telskyura local participation checkpoint is incomplete');
    const first=capture(saved.first_battle_id);
    need(first.end_saved===1 && first.under_pvp_id===id && last?.end_saved===1 &&
      first.capture_order<=last.capture_order && untouched(first.before) && first.after.winCount+first.after.loseCount===1 &&
      last.after.winCount+last.after.loseCount===saved.attempt_count &&
      last.before.winCount+last.before.loseCount===saved.attempt_count-1 &&
      (saved.attempt_count===1)===(first.battle_id===last.battle_id),
      'Under Telskyura local participation lost its original first/latest fully saved battle');
    return {...saved,first,last};
  };
  const completionPlan=battle=>{
    need(battle?.after && battle.end_saved===0,'Under Telskyura participation requires an unfinished issued result');
    const saved=participation(battle.under_pvp_id),previous=floor(battle.under_pvp_id);
    if(!saved) {
      if(previous || !untouched(battle.before)) return {attemptCount:null,firstBattleId:null};
      need(battle.after.winCount+battle.after.loseCount===1,'First local Under Telskyura result has inconsistent counters');
      return {attemptCount:1,firstBattleId:battle.battle_id};
    }
    need(!rewardReceipt(battle.under_pvp_id) &&
      underPvpRecordIdentity(battle.before)===underPvpRecordIdentity(saved.last.after) &&
      int(saved.attempt_count+1) && battle.after.winCount+battle.after.loseCount===saved.attempt_count+1,
      'Under Telskyura participation cannot continue a published, imported or rewound season');
    return {attemptCount:saved.attempt_count+1,firstBattleId:saved.first_battle_id};
  };
  const rewardReceipt=id=>{
    const saved=db.prepare('SELECT * FROM under_pvp_ranking_reward WHERE under_pvp_id=?').get(id),
      pointers=db.prepare('SELECT gift_id FROM under_pvp_ranking_gift WHERE under_pvp_id=? ORDER BY gift_id').all(id);
    if(!saved) {need(!pointers.length,'Under Telskyura Presents lost their production receipt');return null;}
    const earned=participation(id),original=underPvpRankingPrize(id,master);
    let before,gifts;
    try {before=JSON.parse(saved.record_json);gifts=JSON.parse(saved.gifts_json);} catch {need(false,'Under Telskyura ranking receipt is unreadable');}
    underPvpRecord([before],id,master,userId);
    need(before.underPvpId===id && earned?.battle_id===saved.battle_id && before.rank===0 && before.isAggregate===false &&
      underPvpRecordIdentity(before)===underPvpRecordIdentity(earned.last.after) &&
      long(saved.issued_at) && saved.issued_at>=original.endAt && saved.catalog_hash===original.catalog &&
      typeof sameGift==='function' && Array.isArray(gifts) && gifts.length===original.items.length && pointers.length===gifts.length &&
      gifts.every((gift,i)=>gift && long(gift.id) && gift.id>0 && pointers[i].gift_id===gift.id && sameGift(gift,
        {userId,id:gift.id,...original.items[i],title:original.title,message:'',senderType:1,senderId:0,giftAcquiredType:8,
          itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,pcHeroSublimateCount:0,state:0,
          startAt:original.endAt,expireAt:0,createdAt:saved.issued_at,dynamodbExpireAt:0})),
      'Under Telskyura ranking prize differs from its fully saved local participation/original items');
    //21dab6c merges rank/aggregation, not receiveReward; preserve that native
    //flag (288e5c8 defaults true) rather than require an unissued flag setter.
    return {...saved,before,gifts,target:{...before,rank:1,isAggregate:true}};
  };
  const seasons=()=>{
    const ids=db.prepare(`SELECT under_pvp_id FROM under_pvp_ranking_reward
      UNION SELECT under_pvp_id FROM under_pvp_ranking_gift`).all(),original=master?.underPvp?.underPvpInformation;
    need(ids.length<=Object.keys(original ?? {}).length && ids.every(row=>original?.[row.under_pvp_id]),
      'Under Telskyura ranking receipts exceed the original season catalog');
    return ids;
  };
  const records=(rows,status=503)=>{
    const check=status===400?input:need;
    for(const {under_pvp_id:id} of seasons()) {
      underPvpRecord(rows,id,master,userId);
      const reward=rewardReceipt(id),row=rows.find(row=>row.underPvpId===id);
      check(row && underPvpRecordIdentity(row)===underPvpRecordIdentity(reward.target) &&
        row.isReceiveReward===reward.target.isReceiveReward,
        'Published local Under Telskyura rank/reward flags cannot be removed, forged or rewound');
    }
  };
  const target=(id,completed=floor(id))=>rewardReceipt(id)?.target ?? completed?.after ?? null;
  const ranking=id=>{
    const reward=rewardReceipt(id);if(!reward) return [];
    const earned=participation(id),users=read('UserInfo').data,pcId=earned.last.own.slots.find(row=>row.slotNumber===1)?.pc.pcId;
    need(Array.isArray(users) && users.length===1 && users[0]?.userId===userId && typeof users[0].name==='string' &&
      int(pcId) && pcId>0 && master.pcProfiles?.[pcId],
      'Local Under Telskyura ranking lost its player name or captured original leader');
    //24eb4f8 ->25f277c consumes exactly these six fields. CPU rivals are
    //opponents, not fabricated entries in the single-participant local league.
    return [{userId,name:users[0].name,pcId,gradeId:reward.target.gradeId,rank:reward.target.rank,score:reward.target.score}];
  };
  const titleCondition=id=>{
    const badge=master.titleBadges?.[id],season=master.underPvp?.underPvpInformation?.[badge?.slot17];
    need(long(id) && id>0 && badge?.slot16===2 && long(badge.slot17) && badge.slot17>0 && season &&
      long(season.slot9) && season.slot9>0 && int(badge.slot18) && badge.slot18>0 &&
      int(badge.slot19) && badge.slot18<=badge.slot19,
      'Original Under Telskyura title season/rank condition is unavailable');
    return {badge,season,catalog:hash([badge,season,'offline-under-pvp-earned-title-v1'])};
  };
  const titleReceipt=id=>{
    const saved=db.prepare('SELECT * FROM under_pvp_title_badge WHERE title_badge_id=?').get(id);
    if(!saved) return null;
    const original=titleCondition(id),reward=rewardReceipt(original.badge.slot17);
    need(saved.user_id===userId && saved.under_pvp_id===original.badge.slot17 &&
      typeof saved.battle_id==='string' && saved.battle_id===reward?.battle_id &&
      long(saved.awarded_at) && saved.awarded_at>original.season.slot9 && saved.catalog_hash===original.catalog &&
      reward.target.isAggregate===true && original.badge.slot18<=reward.target.rank && reward.target.rank<=original.badge.slot19,
      'Under Telskyura title lost its original condition/clock/earned published season');
    return saved;
  };
  const guardSavedTitles=(rows,status=503)=>{
    const check=status===400?input:need,limit=Object.values(master.titleBadges ?? {}).filter(row=>row.slot16===2).length+1,
      saved=db.prepare('SELECT title_badge_id FROM under_pvp_title_badge LIMIT ?').all(limit);
    need(saved.length<limit,'Under Telskyura earned titles exceed their original catalog');
    check(Array.isArray(rows),'Saved Under Telskyura titles are unavailable');
    //Legacy owned badges have no inferred award date or retrofitted receipt.
    for(const {title_badge_id:id} of saved) {
      titleReceipt(id);
      const matches=rows.filter(row=>row?.titleBadgeId===id);
      check(matches.length===1 && matches[0].userId===userId && Object.keys(matches[0]).sort().join(',')==='titleBadgeId,userId',
        'Earned native Under Telskyura title cannot be removed or replaced');
    }
  };
  const guardTitleBadges=(ids,working)=>{
    if(!ids.length) return [];
    const at=now(),values=working?.get('UserUnderPvPRecord') ?? read('UserUnderPvPRecord').data,earned=new Map();
    need(long(at),'Under Telskyura title-award clock is invalid');records(values,400);
    return ids.map(id=>{
      const original=titleCondition(id),seasonId=original.badge.slot17;
      if(!earned.has(seasonId)) earned.set(seasonId,rewardReceipt(seasonId));
      const reward=earned.get(seasonId),row=values.find(row=>row.underPvpId===seasonId);
      underPvpRecord(values,seasonId,master,userId);
      //2501050/type2: own information.slot9 STRICTLY before AppTime,
      //inclusive title.slot18/19 rank bounds and native isAggregate.
      need(original.season.slot9<at && reward && row && row.isAggregate===true &&
        underPvpRecordIdentity(row)===underPvpRecordIdentity(reward.target) &&
        original.badge.slot18<=row.rank && row.rank<=original.badge.slot19,
        'New Under Telskyura title requires its ended season and actual earned published rank');
      return {titleBadgeId:id,userId,underPvpId:seasonId,battleId:reward.battle_id,awardedAt:at,catalogHash:original.catalog};
    });
  };
  const recordTitleBadges=plans=>{
    for(const row of plans) need(db.prepare(`INSERT INTO under_pvp_title_badge
      (title_badge_id,user_id,under_pvp_id,battle_id,awarded_at,catalog_hash) VALUES(?,?,?,?,?,?)`)
      .run(row.titleBadgeId,row.userId,row.underPvpId,row.battleId,row.awardedAt,row.catalogHash).changes===1,
      'Under Telskyura native title observation disappeared during save');
    if(plans.length) guardSavedTitles(read('UserTitleBadge').data);
  };
  const guardGifts=(values=read('UserGift').data,status=503)=>{
    const check=status===400?input:need,prior=read('UserGift').data;
    need(Array.isArray(prior) && prior.every(gift=>gift && long(gift.id) && gift.id>0) &&
      new Set(prior.map(gift=>gift.id)).size===prior.length,'Under Telskyura Present baseline is unavailable');
    check(Array.isArray(values) && values.every(gift=>gift && long(gift.id) && gift.id>0) &&
      new Set(values.map(gift=>gift.id)).size===values.length,'Duplicate/missing Under Telskyura Present identity');
    const owned=new Set(),actual=new Map(values.map(gift=>[gift.id,gift])),before=new Map(prior.map(gift=>[gift.id,gift]));
    for(const {under_pvp_id:id} of seasons()) for(const gift of rewardReceipt(id).gifts) {
      owned.add(gift.id);
      const current=actual.get(gift.id),claim=db.prepare('SELECT operation_id FROM gift_claim WHERE gift_id=?').get(gift.id);
      if(!claim) check(sameGift(current,gift),'Unclaimed Under Telskyura Present cannot be removed or replaced');
      else {
        const queued=db.prepare('SELECT type,parameters FROM operation_queue WHERE id=?').get(claim.operation_id),
          done=Boolean(db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(claim.operation_id));
        let claimed;
        try {claimed=queued?JSON.parse(queued.parameters)?.UserGift:null;} catch {need(false,'Under Telskyura Present claim queue is unreadable');}
        need(Boolean(queued)!==done && (!queued || queued.type===2000 && Array.isArray(claimed) &&
          claimed.some(row=>sameGift(row,gift))),'Under Telskyura Present lost its actual2000 claim/ACK');
        check(!current || [0,1].includes(current.state) && (!done || current.state===1) && sameGift({...current,state:0},gift),
          'Claimed Under Telskyura Present cannot be replaced or restored');
        check(current?.state!==0 || before.get(gift.id)?.state===0,'Observed Under Telskyura Present cannot become unclaimed');
      }
    }
    for(const gift of values) if(typeof gift.title==='string' && gift.title.startsWith(prefix))
      need(owned.has(gift.id),'Under Telskyura Present has lost its production receipt; retain for recovery');
  };
  const settle=()=>{
    guardGifts();records(read('UserUnderPvPRecord').data);
    if(active() || processing()) return;
    const at=now(),original=master?.underPvp?.underPvpInformation,
      ids=db.prepare('SELECT under_pvp_id FROM under_pvp_record_state ORDER BY under_pvp_id').all();
    need(long(at) && ids.length<=Object.keys(original ?? {}).length && ids.every(row=>original?.[row.under_pvp_id]),
      'Under Telskyura ranking clock/season checkpoints are unavailable');
    //shortcut: single local participant, at matching end, permanent Presents;
    //no publisher population rank, grade bonus or unrecovered max0 interval.
    for(const {under_pvp_id:id} of ids) {
      if(rewardReceipt(id)) continue;
      const season=original[id];
      need(long(season.slot8) && long(season.slot9),'Original Under Telskyura matching end is unavailable');
      if(!season.slot9 || season.slot8>=season.slot9 || at<season.slot9) continue;
      const earned=participation(id);if(!earned) continue;
      const values=read('UserUnderPvPRecord').data,before=values.find(row=>row.underPvpId===id);
      underPvpRecord(values,id,master,userId);
      need(before && before.rank===0 && before.isAggregate===false &&
        underPvpRecordIdentity(before)===underPvpRecordIdentity(earned.last.after),
        'Under Telskyura ranking prize requires its actual fully saved local season');
      const prize=underPvpRankingPrize(id,master),gifts=createGifts(prize.items,prize.title,8,at,prize.endAt);
      db.prepare(`INSERT INTO under_pvp_ranking_reward(under_pvp_id,battle_id,issued_at,catalog_hash,record_json,gifts_json)
        VALUES(?,?,?,?,?,?)`).run(id,earned.battle_id,at,prize.catalog,JSON.stringify(before),JSON.stringify(gifts));
      for(const gift of gifts) db.prepare('INSERT INTO under_pvp_ranking_gift(gift_id,under_pvp_id) VALUES(?,?)').run(gift.id,id);
      const published=rewardReceipt(id).target,data=JSON.stringify(values.map(row=>row.underPvpId===id?published:row));
      need(db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(data,
        crypto.createHash('md5').update(data).digest('hex'),'UserUnderPvPRecord').changes===1,
        'Under Telskyura publication lost its native record profile');
      records(read('UserUnderPvPRecord').data);guardGifts();
    }
  };
  return {participation,completionPlan,rewardReceipt,records,target,ranking,titleReceipt,guardSavedTitles,
    guardTitleBadges,recordTitleBadges,guardGifts,settle};
}

module.exports={openUnderPvpRanking,underPvpRankingPrize};
