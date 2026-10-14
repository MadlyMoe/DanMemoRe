'use strict';

//Original prize rows; explicit solo-offline timing, not publisher aggregation.
const crypto=require('node:crypto'),equal=require('node:util').isDeepStrictEqual;
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const long=n=>Number.isSafeInteger(n) && n>=0,int=n=>long(n) && n<=0x7fffffff;
const keys=(row,list)=>row && !Array.isArray(row) && Object.keys(row).sort().join(',')===[...list].sort().join(',');
const need=(ok,message)=>{if(!ok) throw Object.assign(new Error(message),{status:503,offlineUnavailable:true});};
const input=(ok,message)=>{if(!ok) throw Object.assign(new Error(message),{status:400});};

function elementRankPrize(master,id,rank) {
  const stage=master?.elementEventStages?.[id],tiers=master?.elementRankingRewards?.[stage?.rewardGroupId];
  need(stage && long(stage.startAt) && long(stage.endAt+1) && stage.endAt>stage.startAt && int(rank) && rank>0 &&
    Array.isArray(tiers) && tiers.length,'Original Seventh Zone rank prizes/window are unavailable');
  need(tiers.every((tier,i)=>keys(tier,['minRank','maxRank','rewards']) && int(tier.minRank) && tier.minRank>0 && int(tier.maxRank) &&
    (!tier.maxRank || tier.maxRank>=tier.minRank) && tier.minRank===(i?tiers[i-1].maxRank+1:1) &&
    (tier.maxRank===0)===(i===tiers.length-1) && Array.isArray(tier.rewards) && tier.rewards.length>0 && tier.rewards.length<=5 &&
    tier.rewards.every(item=>keys(item,['itemId','amount']) && int(item.itemId) && item.itemId>0 && int(item.amount) &&
      item.amount>0 && master.itemProfiles?.[item.itemId])),'Original Seventh Zone prize ranges/items require recovery');
  const matches=tiers.filter(tier=>rank>=tier.minRank && (!tier.maxRank || rank<=tier.maxRank));
  need(matches.length===1,'Original Seventh Zone prize range is missing or ambiguous');return matches[0];
}

function openElementRewards({db,read,now,master,userId,createGifts,sameGift,validateRecords,validPlayer,score}) {
  if(!db.prepare('PRAGMA table_info(element_best_capture)').all().some(row=>row.name==='reward_receipt_hash'))
    db.exec('ALTER TABLE element_best_capture ADD COLUMN reward_receipt_hash TEXT');
  db.exec(`CREATE TABLE IF NOT EXISTS element_ranking_reward(stage_id INTEGER PRIMARY KEY,difficulty_id INTEGER NOT NULL,
    operation_id INTEGER NOT NULL UNIQUE,issued_at INTEGER NOT NULL,catalog_hash TEXT NOT NULL,proof_json TEXT NOT NULL,gifts_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS element_ranking_gift(gift_id INTEGER PRIMARY KEY,stage_id INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS element_ranking_gift_stage ON element_ranking_gift(stage_id);`);
  const groups=new Map(),byDifficulty=new Map(),byAdventure=new Map();
  for(const [id,row] of Object.entries(master?.elementEventScoring ?? {})) {
    const original={...row,id:Number(id)};byDifficulty.set(original.id,original);byAdventure.set(row.adventureStageId,original);
    (groups.get(row.stageId) ?? groups.set(row.stageId,[]).get(row.stageId)).push(original);
  }
  const receiptHash=saved=>hash([saved.stage_id,saved.difficulty_id,saved.operation_id,saved.issued_at,saved.catalog_hash,saved.proof_json,saved.gifts_json]);
  const published=()=>{
    const ids=new Set(db.prepare('SELECT stage_id FROM element_ranking_reward UNION SELECT stage_id FROM element_ranking_gift').all().map(row=>row.stage_id));
    for(const row of db.prepare('SELECT difficulty_id FROM element_best_capture WHERE reward_receipt_hash IS NOT NULL').all()) {
      const original=byDifficulty.get(row.difficulty_id);need(original,'Seventh Zone publication marker lost its original difficulty');ids.add(original.stageId);
    }
    return [...ids].map(stage_id=>({stage_id}));
  };
  const stageRows=(values=read('UserAdventureStage').data)=>{
    need(Array.isArray(values) && values.every(row=>row && long(row.adventureStageId)),'Saved Seventh Zone stage identities are unavailable');
    const result=new Map();for(const row of values)
      (result.get(row.adventureStageId) ?? result.set(row.adventureStageId,[]).get(row.adventureStageId)).push(row);
    return result;
  };
  const winner=(id,values)=>groups.get(id).filter(row=>(values.get(row.id) ?? 0)>0)
    .sort((a,b)=>values.get(b.id)-values.get(a.id) || b.difficulty-a.difficulty || a.id-b.id)[0] ?? null;
  const best=(id,values)=>{
    const difficulties=groups.get(id);need(difficulties?.length,'Original Seventh Zone difficulty group is unavailable');
    for(const row of difficulties) {
      const floor=db.prepare('SELECT score,has_record FROM element_record WHERE difficulty_id=?').get(row.id);
      need(!floor || (values.get(row.id) ?? 0)>=floor.score && (!floor.has_record || values.has(row.id)),
        'Saved Seventh Zone score is older than its settled result');
    }
    return winner(id,values);
  };
  const prize=id=>{
    const stage=master?.elementEventStages?.[id],tier=elementRankPrize(master,id,1);
    //ponytail: existing solo rank1 at inclusive stage-end+1, not publisher tally
    //timing/global ranks. Add peers only with an actual ranking producer.
    return {stage,items:tier.rewards,title:`[Offline Seventh Zone reward] ${id} / ${stage.name} / local rank1`,
      catalog:hash([stage,tier,'solo-stage-end-v1'])};
  };
  const proof=(difficultyId,stages=stageRows())=>{
    const original=byDifficulty.get(difficultyId),pointer=db.prepare('SELECT operation_id FROM element_best_capture WHERE difficulty_id=?').get(difficultyId),
      clear=pointer?db.prepare('SELECT * FROM element_completion WHERE operation_id=?').get(pointer.operation_id):null,
      delivery=pointer?db.prepare('SELECT operation_json,record_before FROM stage_delivery WHERE operation_id=?').get(pointer.operation_id):null,
      capture=pointer?db.prepare('SELECT player_json FROM element_player_capture WHERE operation_id=?').get(pointer.operation_id):null,
      floor=db.prepare('SELECT * FROM element_record WHERE difficulty_id=?').get(difficultyId);
    need(original && clear?.difficulty_id===difficultyId && clear.stage_id===original.adventureStageId &&
      master.elementEventDifficulties?.[difficultyId]?.adventureStageId===clear.stage_id && clear.scoring_policy==='offline-element-v1' &&
      long(clear.before_score) && long(clear.final_score) && clear.final_score>clear.before_score && clear.target_score===clear.final_score &&
      [0,1].includes(clear.had_record) && delivery && capture && floor && floor.stage_id===clear.stage_id && floor.has_record===1 &&
      long(floor.score) && floor.score>=clear.final_score && int(floor.clear_count) && floor.clear_count>=clear.clear_count &&
      db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(pointer.operation_id) &&
      db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(floor.last_operation_id) &&
      !db.prepare('SELECT 1 FROM operation_queue WHERE id=?').get(pointer.operation_id),
    'Seventh Zone prize requires its acknowledged local best, not imported scores');
    let operation,recordBefore,stats,result,player;
    try {operation=JSON.parse(delivery.operation_json);recordBefore=JSON.parse(delivery.record_before);
      stats=JSON.parse(clear.battle_stats);result=JSON.parse(clear.score_json);player=JSON.parse(capture.player_json);}
    catch {need(false,'Seventh Zone acknowledged prize history is unreadable');}
    const before=operation?.parameters?.UserAdventureStage?.[0];
    need(keys(operation,['id','type','parameters','token','signature']) && operation.id===pointer.operation_id && operation.type===25000 &&
      typeof operation.token==='string' && /^[a-f0-9]{32}$/.test(operation.token) && int(operation.signature) && operation.signature>0 &&
      Array.isArray(operation.parameters?.UserAdventureStage) && operation.parameters.UserAdventureStage.length===1 &&
      before?.userId===userId && before.adventureStageId===clear.stage_id &&
      int(before.cumulativeClearCount) && typeof before.token==='string' && int(operation.parameters.skipCount) &&
      clear.clear_count===before.cumulativeClearCount+Math.max(1,operation.parameters.skipCount) &&
      db.prepare('SELECT operation_id FROM stage_completion WHERE stage_id=? AND token=?').get(clear.stage_id,before.token)?.operation_id===pointer.operation_id &&
      operation.parameters.adventureStageId===clear.stage_id && equal(operation.parameters.score,result) && validPlayer(player),
    'Seventh Zone prize lost its exact local operation/clear/team binding');
    let previous,calculated;
    try {previous=recordBefore===null?null:validateRecords([recordBefore]);
      calculated=score({adventureStageId:clear.stage_id,userElementEventScore:stats},original,master);}
    catch {need(false,'Seventh Zone prize baseline/scoring catalog requires recovery');}
    need(recordBefore===null ? clear.had_record===0 && clear.before_score===0 :
      clear.had_record===1 && previous.has(difficultyId) && previous.get(difficultyId)===clear.before_score,
    'Seventh Zone prize lost its original score ownership');
    need(equal(result,calculated) && calculated.finalScore===clear.final_score,'Seventh Zone prize differs from its acknowledged offline score');
    const owned=stages.get(clear.stage_id) ?? [],items=operation.parameters.gainedItems,
      targets=db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=? ORDER BY item_id').all(pointer.operation_id);
    need(owned.length===1 && owned[0].userId===userId && owned[0].state===4 && int(owned[0].cumulativeClearCount) &&
      owned[0].cumulativeClearCount>=floor.clear_count && owned[0].firstCompleteDateTime===floor.first_completed_at &&
      Array.isArray(items) && new Set(items.map(row=>row?.itemId)).size===items.length && targets.length===items.length &&
      targets.every(target=>items.some(item=>item?.itemId===target.item_id && int(item.amount) && item.amount>0 &&
        int(target.cumulative_amount) && target.cumulative_amount>=item.amount && target.cumulative_amount<=999999999) &&
        master.itemProfiles?.[target.item_id]?.table===target.table_name && master.itemProfiles[target.item_id].idField===target.id_field),
    'Seventh Zone prize lost its saved native clear/acquisition receipts');
    return {id:pointer.operation_id,difficultyId,score:clear.final_score,player,captureHash:hash([clear,delivery,player,targets])};
  };
  const receipt=(id,stages)=>{
    const saved=db.prepare('SELECT * FROM element_ranking_reward WHERE stage_id=?').get(id),
      pointers=db.prepare('SELECT gift_id FROM element_ranking_gift WHERE stage_id=? ORDER BY gift_id').all(id);
    const markers=(groups.get(id) ?? []).map(row=>({id:row.id,...db.prepare('SELECT reward_receipt_hash FROM element_best_capture WHERE difficulty_id=?').get(row.id)}))
      .filter(row=>row.reward_receipt_hash!=null);
    if(!saved) {need(!pointers.length && !markers.length,'Seventh Zone Presents lost their production capture');return null;}
    need(markers.length===1 && markers[0].id===saved.difficulty_id && markers[0].reward_receipt_hash===receiptHash(saved),
      'Seventh Zone prize lost its independent once-only publication marker');
    const original=prize(id),earned=proof(saved.difficulty_id,stages);let captured,gifts;
    try {captured=JSON.parse(saved.proof_json);gifts=JSON.parse(saved.gifts_json);} catch {need(false,'Seventh Zone prize capture is unreadable');}
    const baseline=captured?.records;
    need(keys(captured,['earned','records']) && equal(captured.earned,earned) && saved.operation_id===earned.id &&
      byDifficulty.get(saved.difficulty_id)?.stageId===id && saved.catalog_hash===original.catalog && long(saved.issued_at) &&
      saved.issued_at>original.stage.endAt && Array.isArray(baseline) && baseline.length>0 &&
      new Set(baseline.map(row=>row?.[0])).size===baseline.length && baseline.every(row=>Array.isArray(row) && row.length===2 &&
        byDifficulty.get(row[0])?.stageId===id && long(row[1])) && winner(id,new Map(baseline))?.id===saved.difficulty_id &&
      new Map(baseline).get(saved.difficulty_id)===earned.score && Array.isArray(gifts) && gifts.length===original.items.length &&
      pointers.length===gifts.length && gifts.every((gift,i)=>gift && long(gift.id) && gift.id>0 && pointers[i].gift_id===gift.id && sameGift(gift,
        {userId,id:gift.id,...original.items[i],title:original.title,message:'',senderType:1,senderId:0,giftAcquiredType:8,
          itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,pcHeroSublimateCount:0,state:0,
          startAt:original.stage.endAt+1,expireAt:0,createdAt:saved.issued_at,dynamodbExpireAt:0})),
    'Seventh Zone Presents differ from their earned original local rank prize');
    return {...saved,earned,records:baseline,gifts};
  };
  const records=(values,status=503,stages)=>{
    const current=validateRecords(values),saved=published();
    if(!saved.length) return;stages ??= stageRows();
    for(const {stage_id:id} of saved) {
      const captured=new Map(receipt(id,stages).records);
      (status===400?input:need)(groups.get(id).every(row=>captured.has(row.id)?current.get(row.id)===captured.get(row.id):
        !current.has(row.id) || current.get(row.id)===0),'Published Seventh Zone scores cannot rewind or take an unissued high');
    }
  };
  const guardGifts=(values=read('UserGift').data,status=503,working=new Map())=>{
    const check=status===400?input:need,prior=read('UserGift').data;
    need(Array.isArray(prior) && prior.every(gift=>gift && long(gift.id) && gift.id>0) && new Set(prior.map(row=>row.id)).size===prior.length,
      'Seventh Zone Present baseline is unavailable');
    check(Array.isArray(values) && values.every(gift=>gift && long(gift.id) && gift.id>0) && new Set(values.map(row=>row.id)).size===values.length,
      'Duplicate/missing Seventh Zone Present identity');
    const saved=published(),stages=saved.length?stageRows(working.get('UserAdventureStage')):null;
    if(saved.length) records(working.get('UserElementEventRecord') ?? read('UserElementEventRecord').data,status,stages);
    const owned=new Set(),actual=new Map(values.map(row=>[row.id,row])),old=new Map(prior.map(row=>[row.id,row]));
    for(const {stage_id:id} of saved) for(const gift of receipt(id,stages).gifts) {
      owned.add(gift.id);const current=actual.get(gift.id),claim=db.prepare('SELECT operation_id FROM gift_claim WHERE gift_id=?').get(gift.id);
      if(!claim) check(sameGift(current,gift),'Unclaimed Seventh Zone Present cannot be removed or replaced');
      else {
        const queued=db.prepare('SELECT type,parameters FROM operation_queue WHERE id=?').get(claim.operation_id),
          done=Boolean(db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(claim.operation_id));let items;
        try {items=queued?JSON.parse(queued.parameters)?.UserGift:null;} catch {need(false,'Seventh Zone Present queue is unreadable');}
        need(Boolean(queued)!==done && (!queued || queued.type===2000 && Array.isArray(items) && items.some(row=>sameGift(row,gift))),
          'Seventh Zone Present lost its actual2000 claim/ACK');
        check(!current || [0,1].includes(current.state) && (!done || current.state===1) && sameGift({...current,state:0},gift),
          'Claimed Seventh Zone Present cannot be changed or restored');
        check(current?.state!==0 || old.get(gift.id)?.state===0,'Observed Seventh Zone Present cannot become unclaimed');
      }
    }
    for(const gift of values) if(typeof gift.title==='string' && gift.title.startsWith('[Offline Seventh Zone reward] '))
      need(owned.has(gift.id),'Seventh Zone Present lost its production proof; retain for recovery');
  };
  const settle=(commit=true)=>{
    guardGifts();const at=now();need(long(at),'Seventh Zone ranking clock is invalid');
    const candidates=new Set(db.prepare('SELECT difficulty_id FROM element_best_capture').all().map(row=>byDifficulty.get(row.difficulty_id)?.stageId));
    const pending=new Set(db.prepare('SELECT parameters FROM operation_queue WHERE type=25000').all().map(row=>{
      let parameters;try {parameters=JSON.parse(row.parameters);} catch {need(false,'Seventh Zone pending result is unreadable');}
      const original=byAdventure.get(parameters?.adventureStageId);need(original,'Seventh Zone pending result lost its original group');return original.stageId;
    }));
    const values=validateRecords(read('UserElementEventRecord').data),stages=candidates.size?stageRows():null;
    let due=false;
    //ponytail: at most417 original stage groups /1382 PK best pointers, not lifetime
    //battle history. Batch publication only if the bounded catalog grows measurably.
    for(const id of candidates) {
      need(groups.has(id),'Seventh Zone best pointer lost its original group');if(receipt(id,stages)) continue;
      const original=prize(id);if(at<=original.stage.endAt || pending.has(id)) continue;
      const winner=best(id,values);need(winner,'Seventh Zone best lost its saved native score');const earned=proof(winner.id,stages);
      need(earned.score===values.get(winner.id),'Seventh Zone prize requires its actual acknowledged highest score');
      const baseline=groups.get(id).filter(row=>values.has(row.id)).map(row=>[row.id,values.get(row.id)]);
      due=true;if(!commit) continue;
      const gifts=createGifts(original.items,original.title,8,at,original.stage.endAt+1);
      db.prepare('INSERT INTO element_ranking_reward(stage_id,difficulty_id,operation_id,issued_at,catalog_hash,proof_json,gifts_json) VALUES(?,?,?,?,?,?,?)')
        .run(id,winner.id,earned.id,at,original.catalog,JSON.stringify({earned,records:baseline}),JSON.stringify(gifts));
      for(const gift of gifts) db.prepare('INSERT INTO element_ranking_gift(gift_id,stage_id) VALUES(?,?)').run(gift.id,id);
      need(db.prepare('UPDATE element_best_capture SET reward_receipt_hash=? WHERE difficulty_id=? AND operation_id=? AND reward_receipt_hash IS NULL')
        .run(receiptHash(db.prepare('SELECT * FROM element_ranking_reward WHERE stage_id=?').get(id)),winner.id,earned.id).changes===1,
      'Seventh Zone publication lost its acknowledged best marker');
      guardGifts();
    }
    return due;
  };
  return {best,prize,proof,receipt,records,guardGifts,settle};
}

module.exports={openElementRewards,elementRankPrize};
