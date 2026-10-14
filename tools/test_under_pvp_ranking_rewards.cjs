'use strict';

// WRITTEN ONLY / NOT RUN. Disposable synthetic saves, not native earning/order proof.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const {underPvpRankingPrize}=require('./under_pvp_ranking.cjs');
const master=require('../data/danmemore-master.json'),seed=require('../data/danmemore-seed.json');
const id=69000000001,season=master.underPvp.underPvpInformation[id],medalId=master.shopProducts[season.slot17].priceItemId;
const titleBadge={userId:seed.userId,titleBadgeId:69610000001},secondPlaceTitle={userId:seed.userId,titleBadgeId:69610000002},
  otherSeasonTitle={userId:seed.userId,titleBadgeId:Number(Object.entries(master.titleBadges).find(([,row])=>
    row.slot16===2 && row.slot17!==id && row.slot18===1 && row.slot19===1)[0])};
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
const unit=pcId=>({pcId,level:pcId?1:0,currentJobIndex:pcId?1:0,limitbreakCount:0,usableSkillAmount:0,
  strength:0,intelligence:0,agility:0,vitality:0,luck:0,hp:pcId?100:0,mp:pcId?16:0,physicalAttackPower:0,
  magicAttackPower:0,defensePower:0,weaponId:0,armorId:0,weaponAbilityIds:[],armorAbilityIds:[],heroSublimateLevel:0,
  isUnlockedHeroSublimate:false,attackPattern:0,currentDP:0,unlockedAdditionalAbilityAmount:0,hasAllStatusBoardOpened:false});
const selected=seed.data.UserParty.find(row=>row.id===seed.data.UserInfo[0].activeUnderPvpPartyId),
  party={userId:seed.userId,partyType:7,index:0,attackPattern:selected.attackPattern,partyStrength:0,
    slots:selected.slots.map(row=>({slotNumber:row.slotNumber,pc:unit(row.pcId),assistingPc:unit(row.assistingPcId),
      commandFlow:row.commandFlow,isHidden:false})),memoriaSlots:[]};

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-under-ranking-'));
  let app,port,database,sequence=0,now=season.slot8+100;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const put=(name,rows)=>{const data=JSON.stringify(rows);app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(data,md5(data),name);};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const delta=(putItems={},operations=[],trigger='UpdateUnderPvpState')=>({badges:null,scripts:{},dataTokens:{},
    operations:operations.map(row=>({id:row.id,verifier:row.token})),checksums:{before:{},after:Object.fromEntries(
      Object.entries(putItems).map(([name,rows])=>[name,md5(JSON.stringify(rows))]))},
    deltas:Object.keys(putItems).length?[{signature:0,trigger,putItems,deleteItems:{}}]:[]});
  const push=(putItems={},operations=[],trigger)=>send('user_data/push',delta(putItems,operations,trigger));
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const reject=async(action,value,status=503)=>{const before=snapshot(),reply=await send(action,value);
    assert.equal(reply.status,status,reply.body.toString());if(status===503)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Failure retains profiles/tokens, participation, gifts, flags, queue, sequence and reply');};
  const user=()=>app.store.read('UserInfo').data[0];
  const count=()=>app.store.db.prepare('SELECT COUNT(*) n FROM under_pvp_ranking_reward').get().n;
  const fresh=async name=>{await close();database=path.join(directory,`${name}.sqlite`);now=season.slot8+100;await open();
    put('UserPC',app.store.read('UserPC').data.map(row=>({...row,joiningState:1})));
    put('UserInfo',[{...user(),playerStatus:{...user().playerStatus,underPvpSP:3,underPvpSPUpdatedAt:now}}]);};
  const battle=async(imported=false,receiveReward=true)=>{
    let view=parse(await send('under_pvp/summary/get',{underPvpId:id}));
    view.underPvpRecord={...view.underPvpRecord,isReceiveReward:receiveReward};
    if(imported) view.underPvpRecord={...view.underPvpRecord,winCount:7,score:30};
    parse(await push({UserUnderPvPRecord:[view.underPvpRecord]}));
    if(imported) view=parse(await send('under_pvp/summary/get',{underPvpId:id}));
    const rival=view.rivalList[2],startAt=now,started=parse(await send('under_pvp/battle/start',{
      underPvpId:id,userId:rival.underPvpPlayerInfo.userId,rating:2,userParty:party,isRevenge:false,revengeStartAt:0}));
    const medal=app.store.read('UserEventItem').data.find(row=>row.eventItemId===medalId),oldStatus=app.store.read('UserUnderPvPGameStatus').data.find(row=>row.underPvpId===id);
    parse(await push({UserInfo:[{...user(),processingUnderPvpState:1,playerStatus:{...user().playerStatus,underPvpSP:user().playerStatus.underPvpSP-1}}],
      UserUnderPvPInfo:[{...app.store.read('UserUnderPvPInfo').data[0],resumeRating:2,resumeRivalUserId:rival.underPvpPlayerInfo.userId}],
      UserEventItem:[{...medal,userId:seed.userId,eventItemId:medalId,amount:(medal?.amount ?? 0)+100,
        cumulativeAmount:(medal?.cumulativeAmount ?? 0)+100,signature:123,readState:3}],
      UserUnderPvPGameStatus:[{...(oldStatus ?? {userId:0,underPvpId:id,updatedMatchingCount:0,updateRivalList:true,
        lastRivalListUpdateAt:0,executeRivalListUpdate:false}),lastBattleStartAt:startAt}]}));
    const ended=parse(await send('under_pvp/battle/end',{underPvpId:id,battleId:started.battleId,result:{isWin:true,isRetire:false},
      isRevenge:false,revengeStartAt:0,lastBattleStartAt:startAt}));
    return ended.underPvpRecord;
  };
  try {
    for(const seasonId of Object.keys(master.underPvp.underPvpInformation).map(Number))
      assert.deepEqual(underPvpRankingPrize(seasonId,master).items,[{itemId:205000001,amount:250},{itemId:296000014,amount:2}]);
    const bad=structuredClone(master),first=Object.keys(bad.underPvp.underPvpGroupRankingReward)[0];
    bad.underPvp.underPvpGroupRankingReward[first].slot3=0;assert.throws(()=>underPvpRankingPrize(id,bad));
    bad.underPvp.underPvpGroupRankingReward[first]=structuredClone(master.underPvp.underPvpGroupRankingReward[first]);
    bad.underPvp.underPvpGroupRankingReward[first].slot5=0;assert.throws(()=>underPvpRankingPrize(id,bad));
    bad.underPvp.underPvpGroupRankingReward[first]=structuredClone(master.underPvp.underPvpGroupRankingReward[first]);
    bad.underPvp.underPvpGroupRankingReward.extra=structuredClone(bad.underPvp.underPvpGroupRankingReward[first]);
    assert.throws(()=>underPvpRankingPrize(id,bad),'Overlapping original first-place rows cannot mint a guessed prize');

    await fresh('publication');const earned=await battle();
    await reject('user_data/push',delta({UserTitleBadge:[titleBadge]},[],'UpdateTitleBadge'));
    now=season.slot9;await send('user_data/confirm',null);assert.equal(count(),0,'Issued but not fully saved result cannot earn');
    parse(await push({UserUnderPvPRecord:[earned]}));await close();await open();
    await send('user_data/confirm',null);assert.equal(count(),0,'Record-only end cannot earn before processing/rematch proofs');
    parse(await push({UserInfo:[{...user(),processingUnderPvpState:0}]}));
    assert.equal(app.store.underPvpRanking.participation(id).attempt_count,1);
    assert.equal(app.store.underPvpActiveBattle(),null);
    now=season.slot9-1;const pullValue={tables:['UserGift','UserUnderPvPRecord']},oldPull=await send('user_data/pull',pullValue),pullId=sequence;
    assert.equal(oldPull.status,200);const oldSummary=parse(await send('under_pvp/summary/get',{underPvpId:id})),summaryId=sequence;
    assert.deepEqual(oldSummary.underPvpRanking,[],'No fabricated standing without earned final aggregation');
    assert.equal(count(),0);const oldGifts=app.store.read('UserGift').data,iris=app.store.hardCurrency();now=season.slot9;
    for(const [table,event] of [['under_pvp_ranking_reward','INSERT'],['under_pvp_ranking_gift','INSERT'],['profile','UPDATE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_under_rank BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'under rank rollback'); END`);
      await reject('user_data/confirm',null);app.store.db.exec('DROP TRIGGER fail_under_rank');
    }
    const finalSummary=parse(await send('under_pvp/summary/get',{underPvpId:id})),published=finalSummary.underPvpRecord,
      receipt=app.store.underPvpRanking.rewardReceipt(id),gifts=receipt.gifts;
    assert.equal(count(),1);assert.deepEqual(published,{...earned,rank:1,isAggregate:true});
    assert.deepEqual(gifts.map(({itemId,amount})=>({itemId,amount})),underPvpRankingPrize(id,master).items);
    assert.ok(gifts.every(gift=>gift.startAt===season.slot9 && gift.expireAt===0 && gift.giftAcquiredType===8));
    assert.deepEqual(app.store.read('UserGift').data,[...oldGifts,...gifts]);assert.equal(app.store.hardCurrency(),iris,'Publication is not a claim');
    const rankingRow={userId:seed.userId,name:user().name,pcId:party.slots.find(row=>row.slotNumber===1).pc.pcId,
      gradeId:earned.gradeId,rank:1,score:earned.score};
    assert.deepEqual(finalSummary.underPvpRanking,[rankingRow]);
    assert.deepEqual(Object.keys(finalSummary.underPvpRanking[0]).sort(),['gradeId','name','pcId','rank','score','userId']);
    assert.equal(finalSummary.underPvpRanking.length,1,'CPU rivals are not invented population standings');
    await reject('user_data/push',delta({UserTitleBadge:[titleBadge]},[],'UpdateTitleBadge'));
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM under_pvp_title_badge').get().n,0,
      'Original2501050 requires clock STRICTLY after matching end, not equal');
    const titlePull={tables:['UserTitleBadge']},beforeTitlePull=await send('user_data/pull',titlePull),titlePullId=sequence;
    assert.equal(beforeTitlePull.status,200);now=season.slot9+1;
    for(const unsupported of [secondPlaceTitle,otherSeasonTitle])
      await reject('user_data/push',delta({UserTitleBadge:[unsupported]},[],'UpdateTitleBadge'));
    const combinedTitle={UserTitleBadge:[titleBadge],UserInfo:[{...user(),titleBadgeId:titleBadge.titleBadgeId}]};
    for(const [table,event] of [['under_pvp_title_badge','INSERT'],['profile','UPDATE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_under_title BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'under title rollback'); END`);
      await reject('user_data/push',delta(combinedTitle,[],'UpdateTitleBadge'));app.store.db.exec('DROP TRIGGER fail_under_title');
    }
    parse(await push(combinedTitle,[],'UpdateTitleBadge'));
    assert.deepEqual(app.store.read('UserTitleBadge').data,[titleBadge]);
    const titleReceipt=app.store.underPvpRanking.titleReceipt(titleBadge.titleBadgeId);
    assert.equal(titleReceipt.battle_id,receipt.battle_id);assert.equal(titleReceipt.awarded_at,now);
    assert.equal(app.store.hardCurrency(),iris,'Title observation does not claim Presents or grant currency');
    assert.equal(app.store.operations().length,0,'Titles are actual two-field native saves, not fabricated award operations');
    const titleStale=snapshot();assert.equal((await request(port,titlePullId,titlePull,String(titlePullId),'user_data/pull')).status,503);
    assert.equal(snapshot(),titleStale);await close();await open();
    parse(await push({UserTitleBadge:[titleBadge]},[],'UpdateTitleBadge'));
    assert.deepEqual(app.store.underPvpRanking.titleReceipt(titleBadge.titleBadgeId),titleReceipt,'Repeated native put retains original award time/receipt');
    for(const [field,badValue] of [['user_id',seed.userId+1],['under_pvp_id',id+1],['battle_id','missing'],
      ['awarded_at',season.slot9],['catalog_hash','missing']]) {
      app.store.db.prepare(`UPDATE under_pvp_title_badge SET ${field}=? WHERE title_badge_id=?`).run(badValue,titleBadge.titleBadgeId);
      await reject('user_data/pull',titlePull);
      app.store.db.prepare(`UPDATE under_pvp_title_badge SET ${field}=? WHERE title_badge_id=?`).run(titleReceipt[field],titleBadge.titleBadgeId);
    }
    const nativeTitles=app.store.read('UserTitleBadge').data;put('UserTitleBadge',[]);
    await reject('user_data/pull',titlePull);put('UserTitleBadge',nativeTitles);
    const stale=snapshot();assert.equal((await request(port,pullId,pullValue,String(pullId),'user_data/pull')).status,503);
    assert.equal((await request(port,summaryId,{underPvpId:id},String(summaryId),'under_pvp/summary/get')).status,503);
    assert.equal(snapshot(),stale);await close();await open();app.store.db.exec('DELETE FROM reply_cache');
    parse(await send('user_data/confirm',null));assert.equal(count(),1);
    await reject('user_data/push',delta({UserUnderPvPRecord:[earned]}),400);
    await reject('user_data/push',delta({UserGift:[...oldGifts,{...gifts[0],amount:gifts[0].amount+1},gifts[1]]}),400);
    await reject('user_data/push',delta({UserGift:oldGifts}),400);
    for(const [table,field,badValue] of [['under_pvp_ranking_reward','catalog_hash','missing'],['under_pvp_ranking_reward','record_json','{}'],
      ['under_pvp_ranking_reward','gifts_json','[]'],['under_pvp_record_state','attempt_count',2],['under_pvp_record_state','first_battle_id','missing']]) {
      const before=app.store.db.prepare(`SELECT * FROM ${table} WHERE under_pvp_id=?`).get(id);
      app.store.db.prepare(`UPDATE ${table} SET ${field}=? WHERE under_pvp_id=?`).run(badValue,id);
      await reject('user_data/confirm',null);app.store.db.prepare(`UPDATE ${table} SET ${field}=? WHERE under_pvp_id=?`).run(before[field],id);
    }
    const receive={userId:seed.userId,giftIds:gifts.map(row=>row.id)},received=parse(await send('gift/receive',receive)),operation=received.operations[0];
    assert.equal(operation.type,2000);assert.equal(app.store.hardCurrency(),iris+250);assert.deepEqual(operation.parameters.UserGift,gifts);
    await reject('user_data/push',delta({},[operation],'GiftReceive'),400);
    parse(await push({UserGift:[...oldGifts,...gifts.map(row=>({...row,state:1}))]},[],'GiftReceive'));
    await close();await open();await reject('user_data/push',delta({},[operation],'GiftReceive'),400);
    const items=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=?').all(operation.id);assert.equal(items.length,1);
    const target=items[0],prior=app.store.read(target.table_name).data.find(row=>row[target.id_field]===target.item_id);
    parse(await push({[target.table_name]:[{...prior,userId:seed.userId,[target.id_field]:target.item_id,
      cumulativeAmount:target.cumulative_amount,dateList:[...(prior?.dateList ?? []),{aquiredAt:now},{aquiredAt:now}]}]},[],'GiftReceive'));
    parse(await push({},[operation],'GiftReceive'));assert.equal(app.store.operations().length,0);
    await close();await open();await reject('gift/receive',receive);assert.equal(app.store.hardCurrency(),iris+250);
    await reject('user_data/push',delta({UserGift:[...oldGifts,...gifts]},[],'GiftReceive'),400);
    now=season.slot8+200;parse(await send('user_data/confirm',null));assert.equal(count(),1);
    const beforeRename=parse(await send('under_pvp/summary/get',{underPvpId:id})),renameSummaryId=sequence;
    assert.deepEqual(beforeRename.underPvpRanking,[rankingRow]);
    parse(await push({UserTitleBadge:[titleBadge],UserInfo:[{...user(),titleBadgeId:0,subTitleBadgeId:titleBadge.titleBadgeId}]},[],'UpdateTitleBadge'));
    assert.deepEqual(app.store.underPvpRanking.titleReceipt(titleBadge.titleBadgeId),titleReceipt,
      'Clock rewind and title selection cannot revoke or redate the original earned badge');
    parse(await push({UserInfo:[{...user(),name:'Synthetic renamed local player'}]}));
    assert.equal((await request(port,renameSummaryId,{underPvpId:id},String(renameSummaryId),'under_pvp/summary/get')).status,503,
      'Cached ranking cannot restore an older player name');
    assert.deepEqual(parse(await send('under_pvp/summary/get',{underPvpId:id})).underPvpRanking,
      [{...rankingRow,name:'Synthetic renamed local player'}]);
    await reject('under_pvp/rival_list/update',{underPvpId:id,isSelectedRivalIdReset:true});
    await reject('under_pvp/battle/start',{underPvpId:id,userId:oldSummary.rivalList[2].underPvpPlayerInfo.userId,
      rating:2,userParty:party,isRevenge:false,revengeStartAt:0});
    assert.equal(app.store.hardCurrency(),iris+250);

    await fresh('legacy-counts');const legacy=await battle();parse(await push({UserUnderPvPRecord:[legacy],UserInfo:[{...user(),processingUnderPvpState:0}]}));
    app.store.db.prepare('UPDATE under_pvp_record_state SET attempt_count=NULL,first_battle_id=NULL WHERE under_pvp_id=?').run(id);
    now=season.slot9;parse(await send('user_data/confirm',null));assert.equal(count(),0);assert.equal(app.store.read('UserUnderPvPRecord').data[0].rank,0);
    await fresh('imported-participation');const imported=await battle(true);
    parse(await push({UserUnderPvPRecord:[imported],UserInfo:[{...user(),processingUnderPvpState:0}]}));
    assert.equal(app.store.underPvpRanking.participation(id),null);now=season.slot9;
    parse(await send('user_data/confirm',null));assert.equal(count(),0,'Imported publisher counters are not local reward earning proof');
    await fresh('preserve-received-flag');const unreceived=await battle(false,false);
    parse(await push({UserUnderPvPRecord:[unreceived],UserInfo:[{...user(),processingUnderPvpState:0}]}));
    now=season.slot9;parse(await send('user_data/confirm',null));assert.equal(count(),1);
    assert.equal(app.store.read('UserUnderPvPRecord').data[0].isReceiveReward,false,
      'Summary21dab6c has no received-flag setter; publication preserves the actual saved value');
    console.log('Deferred local Under ranking/Presents/type2-title checks finished; publisher population/legacy reconciliation/native acceptance remain separate');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}

if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
