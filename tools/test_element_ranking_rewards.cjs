'use strict';

//DEFERRED synthetic local earning/save/prize checks. Not native acceptance,
//publisher aggregation/timing, natural progression or original combat proof.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {elementRankPrize}=require('./element_rewards.cjs');
const {request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
const originals=Object.entries(master.elementEventScoring).map(([id,row])=>({...row,id:Number(id)}));
const stageRow=adventureStageId=>({userId:seed.userId,adventureStageId,signature:0,state:1,cumulativeClearCount:0,dailyClearCount:0,
  currentScore:0,highScore:0,firstCompleteDateTime:0,lastCompleteDateTime:0,firstTryDateTime:0,lastTryDateTime:0,
  ticketClosedAt:0,ticketOpenedAt:0,usedTicketId:0,token:'',tasks:[]});
const body=(row,token,damage=1000)=>({adventureStageId:row.adventureStageId,token,
  userElementEventScore:{totalDamage:damage,maxDamage:damage,actionCount:0,defeat:false,turnCount:0,pcTotalDamage:0},
  adventureStageTaskIds:[],adventureGainedItems:[],friendshipStates:[],adventureRecord:{continueCount:0},
  isEnemyAnnihilated:false,secretMissionCompleted:false});

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-element-prizes-'));
  let app,port,database,sequence=0,now=0,rejection;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:line=>{
    const entry=JSON.parse(line);if(entry.event==='rejected')rejection=entry.reason;
  }});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const fresh=async label=>{await close();database=path.join(directory,label+'.sqlite');await open();
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(originals.map(row=>stageRow(row.adventureStageId))),
      md5(originals.map(row=>stageRow(row.adventureStageId))),'UserAdventureStage');};
  const send=(action,value)=>{rejection=undefined;return request(port,++sequence,value,String(sequence),action);};
  const parse=reply=>{assert.equal(reply.status,200,rejection ?? reply.body.toString());return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const unavailable=reply=>{assert.equal(reply.status,503);assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);};
  const failed=reply=>{assert.equal(reply.status,503);assert.notEqual(reply.headers['x-argo-server-response-code'],String(OFFLINE_UNAVAILABLE_CODE));};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const push=(putItems={},operations=[])=>send('user_data/push',{badges:null,scripts:{},dataTokens:{},
    checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
    deltas:Object.keys(putItems).length?[{signature:0,trigger:'ElementComplete',putItems,deleteItems:{}}]:[],
    operations:operations.map(op=>({id:op.id,verifier:op.token}))});
  const item=(target,amount)=>{
    const old=app.store.read(target.table_name).data.find(row=>row[target.id_field]===target.item_id);
    return {...old,userId:seed.userId,[target.id_field]:target.item_id,cumulativeAmount:target.cumulative_amount,bookEntryState:3,signature:0,
      ...(target.table_name==='UserGachaTicket'?{dateList:[...(old?.dateList ?? []),...Array.from({length:amount},()=>({aquiredAt:now}))]}:
        {amount:(old?.amount ?? 0)+amount}),...(['UserCurrency','UserLockAbilityItem','UserHeroSublimateItem','UserHeroSublimateUnlockItem','UserAlarmVoiceItem'].includes(target.table_name)?{reservedAmount:0}:{}),
      ...(target.table_name==='UserAdventureTicket' && !old?{lastResetAt:0}:{}),
      ...(target.table_name==='UserMemoriaExpItem' && !old?{lastAquiredAt:0,reservedAmount:0,bookEntryState:1}:{})};
  };
  const clearSave=op=>{
    const before=op.parameters.UserAdventureStage[0],capture=app.store.db.prepare('SELECT * FROM element_completion WHERE operation_id=?').get(op.id),
      records=app.store.read('UserElementEventRecord').data.filter(row=>row.elementEventStageDifficultyId!==capture.difficulty_id);
    if(capture.had_record || capture.target_score>0)records.push({userId:seed.userId,elementEventStageDifficultyId:capture.difficulty_id,score:capture.target_score});
    const saved={UserElementEventRecord:records,UserAdventureStage:[{...before,state:4,cumulativeClearCount:capture.clear_count,
      firstCompleteDateTime:before.firstCompleteDateTime || now,lastCompleteDateTime:now}]};
    for(const target of app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(op.id))
      (saved[target.table_name] ??= []).push(item(target,op.parameters.gainedItems.find(row=>row.itemId===target.item_id).amount));
    return saved;
  };
  const complete=(row,token,damage)=>send('element_event/stage/complete',body(row,token,damage));
  const confirm=()=>send('user_data/confirm',undefined);
  const produced=()=>app.store.db.prepare('SELECT * FROM element_ranking_reward').all();
  try {
    for(const id of Object.keys(master.elementEventStages).map(Number)) {
      const tiers=master.elementRankingRewards[master.elementEventStages[id].rewardGroupId];
      for(const tier of tiers)for(const rank of [tier.minRank,tier.maxRank || 0x7fffffff])assert.deepEqual(elementRankPrize(master,id,rank),tier);
    }
    const representatives=Object.keys(master.elementRankingRewards).map(group=>originals.find(row=>
      master.elementEventStages[row.stageId].rewardGroupId===Number(group)));
    for(const row of representatives) {
      const event=master.elementEventStages[row.stageId],prize=elementRankPrize(master,row.stageId,1);
      now=event.startAt;await fresh('group-'+event.rewardGroupId);
      const emptyPullSequence=++sequence,emptyPullBody={tables:['UserGift']};
      const emptyPull=await request(port,emptyPullSequence,emptyPullBody,String(emptyPullSequence),'user_data/pull');assert.equal(emptyPull.status,200);
      const emptyConfirmSequence=++sequence,emptyConfirm=await request(port,emptyConfirmSequence,undefined,String(emptyConfirmSequence),'user_data/confirm');
      assert.equal(emptyConfirm.status,200);
      const emptySummarySequence=++sequence,summaryBody={elementEventInfoId:event.infoId},
        emptySummary=await request(port,emptySummarySequence,summaryBody,String(emptySummarySequence),'element_event/summary/get');assert.equal(emptySummary.status,200);
      const op=parse(await complete(row,'earned')).operation;assert.equal(op.type,25000);assert(op.parameters.score.finalScore>0);
      now=event.endAt;parse(await confirm());assert.equal(produced().length,0,'No prize before inclusive authored stage end');
      now=event.endAt+1;parse(await confirm());assert.equal(produced().length,0,'A queued unsaved result has earned no prize');
      parse(await push(clearSave(op)));await close();await open();
      const split=snapshot();unavailable(await confirm());assert.equal(snapshot(),split);assert.equal(produced().length,0);
      parse(await push({},[op]));const inventoryBefore=app.store.read('UserLockAbilityItem').data,walletBefore=app.store.hardCurrency();
      const beforeSummaryProbe=snapshot();
      unavailable(await request(port,emptySummarySequence,summaryBody,String(emptySummarySequence),'element_event/summary/get'));
      assert.deepEqual(snapshot(),beforeSummaryProbe,'Cached summary prize probe is read-only');assert.equal(produced().length,0);
      for(const [table,operation,condition] of [['element_ranking_reward','INSERT',''],['element_ranking_gift','INSERT',''],
        ['element_best_capture','UPDATE',' WHEN NEW.reward_receipt_hash IS NOT NULL'],
        ['profile','UPDATE'," WHEN NEW.name='UserGift'"],['reply_cache','INSERT'," WHEN NEW.action='user_data/confirm'"]]) {
        app.store.db.exec(`CREATE TRIGGER fail_element_prize BEFORE ${operation} ON ${table}${condition} BEGIN SELECT RAISE(ABORT,'prize rollback'); END`);
        const before=snapshot();failed(await confirm());assert.equal(snapshot(),before);
        app.store.db.exec('DROP TRIGGER fail_element_prize');
      }
      parse(await confirm());assert.equal(produced().length,1);
      const receipt=produced()[0],gifts=app.store.read('UserGift').data.filter(gift=>gift.title.startsWith('[Offline Seventh Zone reward] '));
      assert.deepEqual(gifts.map(({itemId,amount})=>({itemId,amount})),prize.rewards);
      assert.equal(receipt.stage_id,row.stageId);assert.equal(receipt.operation_id,op.id);assert.equal(receipt.difficulty_id,row.id);
      assert(gifts.every(gift=>gift.state===0 && gift.startAt===event.endAt+1 && gift.expireAt===0 && gift.giftAcquiredType===8));
      assert.deepEqual(app.store.read('UserLockAbilityItem').data,inventoryBefore);assert.equal(app.store.hardCurrency(),walletBefore,'Production precredits neither native inventory nor Iris');
      for(const [action,value,id] of [['user_data/pull',emptyPullBody,emptyPullSequence],['user_data/confirm',undefined,emptyConfirmSequence],
        ['element_event/summary/get',summaryBody,emptySummarySequence]]) {
        const before=snapshot();unavailable(await request(port,id,value,String(id),action));assert.equal(snapshot(),before,'Stale cached native data cannot erase prize/score publication');
      }
      await close();await open();app.store.beginSession();parse(await confirm());assert.equal(produced().length,1);
      const profile=app.store.read('UserElementEventRecord').data;
      for(const score of [0,op.parameters.score.finalScore+1]) {
        const before=snapshot();assert.equal((await push({UserElementEventRecord:profile.map(record=>({...record,score}))})).status,400);
        assert.equal(snapshot(),before);
      }
      now=event.startAt;const rewind=snapshot();unavailable(await complete(row,'rewarded-high',0x7fffffff));assert.equal(snapshot(),rewind);
      const practice=parse(await complete(row,'rewarded-practice',1)).operation;parse(await push(clearSave(practice),[practice]));
      assert.equal(produced().length,1);now=event.endAt+100;
      for(const changes of [{amount:gifts[0].amount+1},{state:1},{userId:seed.userId+1}]) {
        const before=snapshot();assert.equal((await push({UserGift:[{...gifts[0],...changes}]})).status,400);assert.equal(snapshot(),before);
      }
      const production=app.store.db.prepare('SELECT * FROM element_ranking_reward').get();
      app.store.db.prepare('UPDATE element_ranking_reward SET proof_json=?').run('null');const corrupt=snapshot();
      unavailable(await confirm());assert.equal(snapshot(),corrupt);
      app.store.db.prepare('UPDATE element_ranking_reward SET proof_json=?').run(production.proof_json);
      const captured=app.store.db.prepare('SELECT operation_json FROM stage_delivery WHERE operation_id=?').get(op.id).operation_json;
      app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run('null',op.id);
      const missing=snapshot();unavailable(await confirm());assert.equal(snapshot(),missing);
      app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run(captured,op.id);
      const index=app.store.db.prepare('SELECT * FROM element_ranking_gift ORDER BY gift_id LIMIT 1').get();
      app.store.db.prepare('DELETE FROM element_ranking_gift WHERE gift_id=?').run(index.gift_id);const orphan=snapshot();
      unavailable(await confirm());assert.equal(snapshot(),orphan);
      app.store.db.prepare('INSERT INTO element_ranking_gift(gift_id,stage_id) VALUES(?,?)').run(index.gift_id,index.stage_id);
      const marker=app.store.db.prepare('SELECT reward_receipt_hash FROM element_best_capture WHERE difficulty_id=?').get(row.id).reward_receipt_hash;
      app.store.db.prepare('UPDATE element_best_capture SET reward_receipt_hash=NULL WHERE difficulty_id=?').run(row.id);
      const lostMarker=snapshot();unavailable(await confirm());assert.equal(snapshot(),lostMarker);
      app.store.db.prepare('UPDATE element_best_capture SET reward_receipt_hash=? WHERE difficulty_id=?').run(marker,row.id);
      const claim=parse(await send('gift/receive',{userId:seed.userId,giftIds:gifts.map(gift=>gift.id)})).operations[0];assert.equal(claim.type,2000);
      assert.equal(app.store.hardCurrency(),walletBefore+prize.rewards.filter(item=>item.itemId===master.currencies['currency.gem']).reduce((n,item)=>n+item.amount,0));
      parse(await push({UserGift:gifts.map(gift=>({...gift,state:1}))}));const flags=snapshot();
      assert.equal((await push({},[claim])).status,400);assert.equal(snapshot(),flags,'Received flags alone do not prove inventory delivery');
      await close();await open();const partial=snapshot();unavailable(await send('gift/receive',{userId:seed.userId,giftIds:gifts.map(gift=>gift.id)}));
      assert.equal(snapshot(),partial);
      const acquired={};for(const target of app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=?').all(claim.id))
        (acquired[target.table_name] ??= []).push(item(target,claim.parameters.receivedItems.find(item=>item.itemId===target.item_id).amount));
      parse(await push(acquired));
      app.store.db.exec("CREATE TRIGGER fail_element_claim BEFORE INSERT ON operation_done BEGIN SELECT RAISE(ABORT,'claim ack rollback'); END");
      const ack=snapshot();failed(await push({},[claim]));assert.equal(snapshot(),ack);
      app.store.db.exec('DROP TRIGGER fail_element_claim');parse(await push({},[claim]));
      for(const gift of gifts)assert.equal(app.store.db.prepare('SELECT operation_id FROM gift_claim WHERE gift_id=?').get(gift.id).operation_id,claim.id);
      await close();await open();app.store.beginSession();parse(await confirm());assert.equal(produced().length,1);
      const once=snapshot();unavailable(await send('gift/receive',{userId:seed.userId,giftIds:gifts.map(gift=>gift.id)}));assert.equal(snapshot(),once);
      //Even claimed/removed native Presents cannot turn missing local prize
      //indexes into a new award: the separate best-pointer marker survives.
      put('UserGift',[]);const lostIndexes=app.store.db.prepare('SELECT * FROM element_ranking_gift').all();
      app.store.db.prepare('DELETE FROM element_ranking_gift WHERE stage_id=?').run(row.stageId);
      app.store.db.prepare('DELETE FROM element_ranking_reward WHERE stage_id=?').run(row.stageId);
      const missingBoth=snapshot();unavailable(await confirm());assert.equal(snapshot(),missingBoth);
      app.store.db.prepare('INSERT INTO element_ranking_reward(stage_id,difficulty_id,operation_id,issued_at,catalog_hash,proof_json,gifts_json) VALUES(?,?,?,?,?,?,?)')
        .run(production.stage_id,production.difficulty_id,production.operation_id,production.issued_at,production.catalog_hash,production.proof_json,production.gifts_json);
      for(const index of lostIndexes)app.store.db.prepare('INSERT INTO element_ranking_gift(gift_id,stage_id) VALUES(?,?)').run(index.gift_id,index.stage_id);
      parse(await confirm());assert.equal(produced().length,1,'Restored original capture does not redeliver its already-claimed prize');
      assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    }
    const first=representatives[0],event=master.elementEventStages[first.stageId];
    now=event.startAt;await fresh('unearned');put('UserElementEventRecord',[{userId:seed.userId,elementEventStageDifficultyId:first.id,score:999999999999}]);
    now=event.endAt+1;parse(await confirm());assert.equal(produced().length,0,'Imported score alone does not mint a prize');
    now=event.startAt;const low=parse(await complete(first,'imported-lower',1)).operation;parse(await push(clearSave(low),[low]));
    now=event.endAt+1;parse(await confirm());assert.equal(produced().length,0,'Acknowledged lower repeats cannot backfill an imported best');
    const second=originals.find(row=>row.stageId!==first.stageId && master.elementEventStages[row.stageId].infoId===event.infoId);
    now=event.startAt;await fresh('independent-stage-groups');
    const earned=parse(await complete(first,'independent-earned')).operation;parse(await push(clearSave(earned),[earned]));
    const pending=parse(await complete(second,'independent-pending')).operation;now=event.endAt+1;
    parse(await send('element_event/summary/get',{elementEventInfoId:event.infoId}));assert.equal(produced().length,1);
    assert.equal(produced()[0].stage_id,first.stageId,'A pending different661-stage does not block this acknowledged group');
    parse(await push(clearSave(pending),[pending]));parse(await send('element_event/summary/get',{elementEventInfoId:event.infoId}));
    assert.equal(produced().length,2,'Same reward selector still awards two separate earned661-stage groups');
    now=event.startAt;await fresh('zero');const zero=parse(await complete(first,'zero',0)).operation;parse(await push(clearSave(zero),[zero]));
    now=event.endAt+1;parse(await confirm());assert.equal(produced().length,0,'A zero clear does not earn a rank-one prize');
    now=event.startAt;await fresh('no-team');put('UserParty',[]);
    const noTeam=parse(await complete(first,'no-team')).operation;parse(await push(clearSave(noTeam),[noTeam]));
    now=event.endAt+1;parse(await confirm());assert.equal(produced().length,0,'Missing immutable team proof is not replaced by a fabricated ranking');
    console.log('Seventh Zone original128 tiers/417 selectors/six earned prize groups, native25000 proof, durable2000 claims/restart/rollback/clock/caches/corruption checks OK; synthetic only, no native acceptance');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
