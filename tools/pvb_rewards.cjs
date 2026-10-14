'use strict';

//SOURCE ONLY; original prizes, disclosed solo ranking/timing, native tests deferred.
const crypto=require('node:crypto'),equal=require('node:util').isDeepStrictEqual;
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const long=n=>Number.isSafeInteger(n) && n>=0,int=n=>long(n) && n<=0x7fffffff;
const keys=(row,list)=>row && !Array.isArray(row) && Object.keys(row).sort().join(',')===[...list].sort().join(',');
const need=(ok,message)=>{if(!ok) throw Object.assign(new Error(message),{status:503,offlineUnavailable:true});};
const input=(ok,message)=>{if(!ok) throw Object.assign(new Error(message),{status:400});};
const flags=['isAggregate','isReceiveTotalReward','isReceiveGroupReward'];
const published=before=>({...before,...Object.fromEntries(flags.map(key=>[key,true]))});

function pvbRankPrize(master,id,kind,rank) {
  const rows=master?.pvbRankingRewards?.[kind]?.[id];
  need(['group','total'].includes(kind) && master?.pvbEvents?.[id] && int(rank) && rank>0 && Array.isArray(rows) && rows.length,
    'Original Record Buster rank prizes are unavailable');
  need(rows.every(row=>keys(row,['minRank','maxRank','rewards']) && int(row.minRank) && row.minRank>0 &&
    int(row.maxRank) && (!row.maxRank || row.maxRank>=row.minRank) && Array.isArray(row.rewards) &&
    row.rewards.length>0 && row.rewards.length<=5 && row.rewards.every(item=>keys(item,['itemId','amount']) &&
      int(item.itemId) && item.itemId>0 && int(item.amount) && item.amount>0 && master.itemProfiles?.[item.itemId])),
  'Original Record Buster prize ranges/items require recovery');
  const matches=rows.filter(row=>rank>=row.minRank && (!row.maxRank || rank<=row.maxRank));
  need(matches.length===1,'Original Record Buster prize range is missing or ambiguous');return matches[0];
}

function pvbRankPlayer(master,record,player,userId) {
  //ponytail: solo rank1 only; add neighbours with a real peer producer.
  const original=master.pvbStages?.[record.pvbStageId];
  const grades=Object.entries(master.pvbGrades ?? {}).filter(([,row])=>row.pvbId===record.pvbId &&
    row.slot3<=1 && (!row.slot4 || row.slot4>=1));
  need(player?.userId===userId && typeof player.name==='string' && int(player.pcId) && player.pcId>0 &&
    master.pcProfiles?.[player.pcId] && original?.pvbId===record.pvbId && grades.length===1 &&
    long(Number(grades[0][0])) && Number(grades[0][0])>0 && int(original.difficulty) && original.difficulty>0 &&
    long(record.scoreInt64) && record.scoreInt64>0,'Invalid captured PvB ranking player or grade');
  //19000 reads these six fields; ranking views additionally require userId.
  return {name:player.name,pcId:player.pcId,gradeId:Number(grades[0][0]),rank:1,
    score:record.scoreInt64,difficulty:original.difficulty};
}

function openPvbRewards({db,read,now,master,userId,createGifts,sameGift,validateRecords,initialRecord,score}) {
  db.exec(`CREATE TABLE IF NOT EXISTS pvb_ranking_reward(pvb_id INTEGER PRIMARY KEY,operation_id INTEGER NOT NULL UNIQUE,
    issued_at INTEGER NOT NULL,catalog_hash TEXT NOT NULL,before_json TEXT NOT NULL,gifts_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pvb_ranking_gift(gift_id INTEGER PRIMARY KEY,pvb_id INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS pvb_ranking_gift_season ON pvb_ranking_gift(pvb_id);`);
  const bestPlayer=record=>{
    const capture=db.prepare(`SELECT pvb_player_capture.player_json,pvb_clear.final_score,pvb_clear.pvb_stage_id
      FROM pvb_best_capture JOIN pvb_clear ON pvb_clear.operation_id=pvb_best_capture.operation_id
      JOIN pvb_player_capture ON pvb_player_capture.operation_id=pvb_clear.operation_id
      JOIN operation_done ON operation_done.id=pvb_clear.operation_id
      WHERE pvb_best_capture.pvb_id=? AND pvb_clear.is_recorded=1 AND pvb_player_capture.is_new_high=1`).get(record.pvbId);
    if(!capture || capture.final_score!==record.scoreInt64 || capture.pvb_stage_id!==record.pvbStageId) return null;
    try {return JSON.parse(capture.player_json);} catch {need(false,'Historical PvB player capture is unreadable');}
  };
  const prize=id=>{
    const window=master?.pvbEvents?.[id],group=pvbRankPrize(master,id,'group',1),total=pvbRankPrize(master,id,'total',1);
    need(window && long(window.window6) && long(window.window7) && long(window.window9) &&
      window.window6<=window.window7 && window.window7<window.window9 && long(window.window7+1),
    'Original Record Buster ranking window requires recovery');
    //ponytail: existing single-account/group rank1 at recording-end+1, NOT
    //publisher groups/global standings/tally timing. Add peers with a real producer.
    return {window,items:[...group.rewards,...total.rewards],title:`[Offline Record Buster reward] ${id} / local group+total rank1`,
      catalog:hash([window,group,total,'solo-recording-end-v1'])};
  };
  const stageRows=()=>{
    const rows=read('UserAdventureStage').data,result=new Map();
    need(Array.isArray(rows) && rows.every(row=>row && long(row.adventureStageId)),'Saved Record Buster stage identities are unavailable');
    for(const row of rows) (result.get(row.adventureStageId) ?? result.set(row.adventureStageId,[]).get(row.adventureStageId)).push(row);
    return result;
  };
  const proof=(id,stages=stageRows())=>{
    const best=db.prepare('SELECT operation_id FROM pvb_best_capture WHERE pvb_id=?').get(id),
      clear=best?db.prepare('SELECT * FROM pvb_clear WHERE operation_id=?').get(best.operation_id):null,
      delivery=best?db.prepare('SELECT operation_json,record_before FROM stage_delivery WHERE operation_id=?').get(best.operation_id):null,
      capture=best?db.prepare('SELECT player_json,is_new_high FROM pvb_player_capture WHERE operation_id=?').get(best.operation_id):null,
      floor=db.prepare('SELECT * FROM pvb_record WHERE pvb_id=?').get(id);
    need(clear?.pvb_id===id && clear.scoring_policy==='offline-pvb-v1' && clear.is_recorded===1 && capture?.is_new_high===1 &&
      delivery && floor && db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(best.operation_id) &&
      !db.prepare('SELECT 1 FROM operation_queue WHERE id=?').get(best.operation_id),
    'Record Buster ranking prize requires its acknowledged local best, not imported scores/flags');
    let operation,before,target,result,stats,stage,player,saved;
    try {operation=JSON.parse(delivery.operation_json);before=JSON.parse(delivery.record_before) ?? initialRecord(id);
      target=JSON.parse(clear.target_record_json);result=JSON.parse(clear.result_json);stats=JSON.parse(clear.battle_stats);
      stage=JSON.parse(clear.stage_before_json);player=JSON.parse(capture.player_json);saved=JSON.parse(floor.record_json);
      validateRecords([before]);validateRecords([target]);validateRecords([saved]);}
    catch {need(false,'Record Buster acknowledged prize history is unreadable');}
    const original=master.pvbStages?.[clear.pvb_stage_id],stageFloor=db.prepare('SELECT * FROM pvb_stage_record WHERE stage_id=?').get(clear.stage_id);
    need(original?.pvbId===id && original.adventureStageId===clear.stage_id && target.pvbId===id && before.pvbId===id &&
      int(stage?.cumulativeClearCount) && stage.userId===userId && stage.adventureStageId===clear.stage_id && typeof stage.token==='string' &&
      stageFloor && int(stageFloor.clear_count) && stageFloor.clear_count>=stage.cumulativeClearCount+1 &&
      db.prepare('SELECT operation_id FROM stage_completion WHERE stage_id=? AND token=?').get(clear.stage_id,stage.token)?.operation_id===best.operation_id &&
      keys(operation,['id','type','parameters','token','signature']) && operation.id===best.operation_id && operation.type===19000 &&
      typeof operation.token==='string' && /^[a-f0-9]{32}$/.test(operation.token) && int(operation.signature) && operation.signature>0 &&
      keys(operation.parameters,['pvbResult','userPvbRecord']) && equal(operation.parameters,{pvbResult:result,userPvbRecord:target}) &&
      player?.userId===userId && typeof player.name==='string' && int(player.pcId) && master.pcProfiles?.[player.pcId] &&
      flags.every(key=>target[key]===false) && target.scoreInt64>before.scoreInt64 && target.scoreInt64===clear.final_score,
    'Record Buster prize lost its exact local battle/clear/record binding');
    let calculated;
    try {calculated=score({userPvBScore:stats},original,master);} catch {need(false,'Record Buster prize scoring catalog requires recovery');}
    //Keep old immutable empty-list captures readable; new entries must be the
    //same genuine captured best, never today's selected party or invented peers.
    const around=result?.aroundPlayerInfo;
    need(Array.isArray(around) && (!around.length || equal(around,[pvbRankPlayer(master,target,player,userId)])) &&
      equal(result,{...calculated,previousRank:before.totalRank,currentRank:1,adventureStageId:clear.stage_id,
      isRecorded:true,aroundPlayerInfo:around}) && equal(target,{...before,scoreInt64:calculated.finalScore,
      score:Math.min(calculated.finalScore,0x7fffffff),pvbStageId:clear.pvb_stage_id,groupId:before.groupId || 1,totalRank:1,groupRank:1}) &&
      (equal(saved,target) || equal(saved,published(target))) &&
      db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(floor.last_operation_id),
    'Record Buster prize differs from its acknowledged offline score/floor');
    const owned=stages.get(clear.stage_id) ?? [];
    need(owned.length===1 && owned[0].userId===userId && owned[0].state===4 && int(owned[0].cumulativeClearCount) &&
      owned[0].cumulativeClearCount>=stageFloor.clear_count && owned[0].firstCompleteDateTime===stageFloor.first_completed_at,
    'Record Buster ranking prize lost its saved native clear');
    return {id:best.operation_id,before:target};
  };
  const receipt=(id,stages)=>{
    const saved=db.prepare('SELECT * FROM pvb_ranking_reward WHERE pvb_id=?').get(id),
      pointers=db.prepare('SELECT gift_id FROM pvb_ranking_gift WHERE pvb_id=? ORDER BY gift_id').all(id);
    if(!saved) {need(!pointers.length,'Record Buster Presents lost their production capture');return null;}
    const earned=proof(id,stages),original=prize(id);let before,gifts;
    try {before=JSON.parse(saved.before_json);gifts=JSON.parse(saved.gifts_json);} catch {need(false,'Record Buster prize capture is unreadable');}
    need(saved.operation_id===earned.id && equal(before,earned.before) && saved.catalog_hash===original.catalog &&
      long(saved.issued_at) && saved.issued_at>original.window.window7 && Array.isArray(gifts) && gifts.length===original.items.length &&
      pointers.length===gifts.length && gifts.every((gift,i)=>gift && long(gift.id) && gift.id>0 && pointers[i].gift_id===gift.id && sameGift(gift,
        {userId,id:gift.id,...original.items[i],title:original.title,message:'',senderType:1,senderId:0,giftAcquiredType:8,
          itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,pcHeroSublimateCount:0,state:0,
          startAt:original.window.window7+1,expireAt:0,createdAt:saved.issued_at,dynamodbExpireAt:0})),
    'Record Buster Presents differ from their original local group/total prizes');
    return {...saved,before,gifts,target:published(before)};
  };
  const records=(values,status=503)=>{
    const saved=db.prepare('SELECT pvb_id FROM pvb_ranking_reward UNION SELECT pvb_id FROM pvb_ranking_gift').all(),stages=saved.length?stageRows():null;
    for(const {pvb_id:id} of saved) {
      const target=receipt(id,stages).target;
      (status===400?input:need)(values.filter(row=>row.pvbId===id).length===1 && equal(values.find(row=>row.pvbId===id),target),
        'Published Record Buster ranking record cannot rewind or take an unissued score/flag');
    }
  };
  const guardGifts=(values=read('UserGift').data,status=503)=>{
    const check=status===400?input:need,prior=read('UserGift').data;
    need(Array.isArray(prior) && prior.every(gift=>gift && long(gift.id) && gift.id>0) && new Set(prior.map(row=>row.id)).size===prior.length,
      'Record Buster Present baseline is unavailable');
    check(Array.isArray(values) && values.every(gift=>gift && long(gift.id) && gift.id>0) && new Set(values.map(row=>row.id)).size===values.length,
      'Duplicate/missing Record Buster Present identity');
    const owned=new Set(),actual=new Map(values.map(row=>[row.id,row])),old=new Map(prior.map(row=>[row.id,row]));
    const saved=db.prepare('SELECT pvb_id FROM pvb_ranking_reward UNION SELECT pvb_id FROM pvb_ranking_gift').all(),stages=saved.length?stageRows():null;
    for(const {pvb_id:id} of saved)
      for(const gift of receipt(id,stages).gifts) {
        owned.add(gift.id);const current=actual.get(gift.id),claim=db.prepare('SELECT operation_id FROM gift_claim WHERE gift_id=?').get(gift.id);
        if(!claim) check(sameGift(current,gift),'Unclaimed Record Buster Present cannot be removed or replaced');
        else {
          const queued=db.prepare('SELECT type,parameters FROM operation_queue WHERE id=?').get(claim.operation_id),
            done=Boolean(db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(claim.operation_id));let items;
          try {items=queued?JSON.parse(queued.parameters)?.UserGift:null;} catch {need(false,'Record Buster Present queue is unreadable');}
          need(Boolean(queued)!==done && (!queued || queued.type===2000 && Array.isArray(items) && items.some(row=>sameGift(row,gift))),
            'Record Buster Present lost its actual2000 claim/ACK');
          check(!current || [0,1].includes(current.state) && (!done || current.state===1) && sameGift({...current,state:0},gift),
            'Claimed Record Buster Present cannot be changed or restored');
          check(current?.state!==0 || old.get(gift.id)?.state===0,'Observed Record Buster Present cannot become unclaimed');
        }
      }
    for(const gift of values) if(typeof gift.title==='string' && gift.title.startsWith('[Offline Record Buster reward] '))
      need(owned.has(gift.id),'Record Buster Present lost its production proof; retain for recovery');
  };
  const settle=(commit=true)=>{
    guardGifts();if(db.prepare('SELECT 1 FROM operation_queue WHERE type=19000 LIMIT 1').get()) return;
    const at=now();need(long(at),'Record Buster ranking clock is invalid');
    const saved=db.prepare('SELECT pvb_id FROM pvb_best_capture ORDER BY pvb_id').all(),stages=saved.length?stageRows():null;
    let pending=false;
    //ponytail: at most152 original seasons; PK captures, no lifetime battle scan.
    //Batch the entire settlement only if a larger catalog makes this measurable.
    for(const {pvb_id:id} of saved) {
      if(receipt(id,stages)) continue;const original=prize(id);if(at<=original.window.window7) continue;
      const earned=proof(id,stages),values=read('UserPvBRecord').data,current=values.find(row=>row.pvbId===id);
      need(equal(current,earned.before),'Record Buster prize requires its actual acknowledged local best record');
      pending=true;if(!commit) continue;
      const gifts=createGifts(original.items,original.title,8,at,original.window.window7+1);
      db.prepare('INSERT INTO pvb_ranking_reward(pvb_id,operation_id,issued_at,catalog_hash,before_json,gifts_json) VALUES(?,?,?,?,?,?)')
        .run(id,earned.id,at,original.catalog,JSON.stringify(current),JSON.stringify(gifts));
      for(const gift of gifts) db.prepare('INSERT INTO pvb_ranking_gift(gift_id,pvb_id) VALUES(?,?)').run(gift.id,id);
      const data=JSON.stringify(values.map(row=>row.pvbId===id?published(current):row));
      need(db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(data,
        crypto.createHash('md5').update(data).digest('hex'),'UserPvBRecord').changes===1,'Record Buster publication lost its profile');
      read('UserPvBRecord');guardGifts();
    }
    return pending;
  };
  return {prize,proof,receipt,records,guardGifts,settle,bestPlayer};
}

module.exports={openPvbRewards,pvbRankPrize,pvbRankPlayer};
