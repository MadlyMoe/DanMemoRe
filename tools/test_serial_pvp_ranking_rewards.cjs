'use strict';

// DEFERRED / NOT RUN. Temporary source/save probes, NOT native combat,
//ranking aggregation, signatures, UI, effect ordering or no-crash acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const {fixtureSeed,party,verdict}=require('./test_serial_pvp_completion.cjs');
const {initialRecord,serialPvpRankingPrize}=require('./serial_pvp.cjs');
const master=require('../data/danmemore-master.json'),seed=fixtureSeed(),id=81000000001,secondId=81000000002,
  season=master.serialPvp.serialPvpInformation[id],secondSeason=master.serialPvp.serialPvpInformation[secondId],gradeId=81200010000;
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
const confirm='user_data/confirm',receive='gift/receive';

async function main() {
  // Original selector is information.slot14, not the similarly valued slot11.
  for(const key of Object.keys(master.serialPvp.serialPvpInformation)) {
    const prize=serialPvpRankingPrize(Number(key),1,master);
    assert.equal(prize.groupId,81400010001);
    assert.deepEqual(prize.rewards,[{rewardId:81500000001,itemId:205000001,amount:200},
      {rewardId:81500000002,itemId:296000014,amount:1}]);
  }
  const prize=serialPvpRankingPrize(id,1,master),changed=structuredClone(master);
  changed.serialPvp.serialPvpInformation[id].slot11=999;
  assert.deepEqual(serialPvpRankingPrize(id,1,changed),prize);
  changed.serialPvp.serialPvpInformation[id].slot14=999;
  assert.throws(()=>serialPvpRankingPrize(id,1,changed),/unavailable/);
  changed.serialPvp.serialPvpInformation[id].slot14=1;
  changed.serialPvp.serialPvpRankingRewardGroup[81400010002].slot2=1;
  assert.throws(()=>serialPvpRankingPrize(id,1,changed),/ambiguous/);
  for(const rank of [0,'1',201,0x80000000]) assert.throws(()=>serialPvpRankingPrize(id,rank,master));

  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-abyss-ranking-presents-'));
  let database,app,port,sequence=0,now=season.slot3+100;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const fresh=async name=>{await close();database=path.join(directory,name+'.sqlite');now=season.slot3+100;await open();};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const user=()=>structuredClone(app.store.read('UserInfo').data[0]);
  const putProfile=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows),md5(rows),name); // Temporary corruption probes ONLY, never a real save repair.
  const profiles=()=>JSON.stringify(app.store.db.prepare("SELECT * FROM profile WHERE name NOT IN('UserGift','UserSerialPvpRecord') ORDER BY name").all());
  const settledRecord=record=>({...record,rank:1,isAggregate:true,isReceiveReward:true});
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const delta=(puts={},ops=[],deletes={})=>({badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:
    Object.fromEntries([...new Set([...Object.keys(puts),...Object.keys(deletes)])].map(name=>[name,md5(puts[name] ?? [])]))},
    deltas:Object.keys(puts).length || Object.keys(deletes).length?[{signature:0,
      trigger:puts.UserTitleBadge?'UpdateTitleBadge':'GiftReceive',putItems:puts,deleteItems:deletes}]:[],
    operations:ops.map(operation=>({id:operation.id,verifier:operation.token}))});
  const push=(puts,ops=[],deletes={})=>send('user_data/push',delta(puts,ops,deletes));
  const rejected=async(action,value,status=503)=>{const before=snapshot(),reply=await send(action,value);
    assert.equal(reply.status,status,reply.body.toString());if(status===503)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Cancellation must retain native profiles, gift/earned/claim receipts and queue');};
  const complete=async(score,ack=true,seasonId=id,win=false)=>{
    const previousInfo=structuredClone(app.store.read('UserSerialPvpInfo').data);
    const lobby=parse(await send('serial_pvp/grade/select',{serialPvpId:seasonId,gradeId})),saved=app.store.serialPvp.state(seasonId),
      info=user(),entry=app.store.serialPvp.runEntry(seasonId),status={...saved.after.UserSerialPvpGameStatus,lastRivalListUpdateAt:now};
    assert.deepEqual(app.store.read('UserSerialPvpInfo').data,previousInfo,'Selection never clears the native previous opponent');
    if(seasonId===secondId) {
      const selectedAt=now;now=season.slot3+200;
      await rejected('serial_pvp/summary/get',{serialPvpId:id});
      now=selectedAt; // A pending new-season selection cannot be abandoned by rewinding the clock.
    }
    Object.assign(info.playerStatus,entry.candidates[0].after);
    parse(await push({UserInfo:[info],UserSerialPvpGameStatus:[status],UserSerialPvpUsingLimitData:[saved.after.UserSerialPvpUsingLimitData]}));
    now+=10;
    const started=parse(await send('serial_pvp/battle/start',{serialPvpId:seasonId,userId:lobby.rivalList[seasonId===id?2:3].serialPvpPlayerInfo.userId,
      userParty:party,partyIndex:1}));
    parse(await push({UserInfo:[{...user(),processingSerialPvpState:1}],
      UserSerialPvpRecord:started.serialPvpRecord.length?started.serialPvpRecord:[initialRecord(seasonId)],
      UserSerialPvpInfo:[{userId:seed.userId,resumeRivalUserId:started.serialPvpPlayerInfo.userId}],
      UserSerialPvpGameStatus:[{...status,updateRivalList:true,lastBattleStartAt:now}]},[started.operation]));
    const finish={...verdict(started.battleId,false,score),serialPvpId:seasonId};finish.result.isWin=win;
    const ended=parse(await send('serial_pvp/battle/end',finish));
    if(ack) parse(await push({UserInfo:[{...user(),processingSerialPvpState:0}],
      ...(score?{UserSerialPvpRecord:ended.serialPvpRecord}:{})},[ended.operation]));
    return ended;
  };
  const earned=()=>app.store.db.prepare('SELECT * FROM serial_pvp_ranking_reward').all();
  const gifts=()=>app.store.read('UserGift').data.filter(row=>row.giftAcquiredType===8);
  try {
    await fresh('no-history');now=season.slot4;parse(await send(confirm));assert.equal(earned().length,0);assert.deepEqual(gifts(),[]);
    await fresh('pending-finish');const pending=await complete(123,false);now=season.slot4;
    parse(await send(confirm));assert.deepEqual(gifts(),[]);assert.equal(earned().length,0);
    now=secondSeason.slot3+100;
    for(const route of ['serial_pvp/summary/get','serial_pvp/ranking/get','serial_pvp/character/ranking/get'])
      await rejected(route,{serialPvpId:secondId});
    parse(await push({UserInfo:[{...user(),processingSerialPvpState:0}],UserSerialPvpRecord:pending.serialPvpRecord},[pending.operation]));
    parse(await send(confirm));assert.equal(gifts().length,2,'Earn only after the actual closed-run native save/ACK');

    await fresh('login-reward');await complete(0);now=season.slot4;
    parse(await send('user/login'));assert.equal(earned().length,1);assert.equal(gifts().length,2);assert.equal(app.store.hardCurrency(),0);

    // Native automatic type9 earning is separate from gift collection. The
    //client creates its two-long row; the server never precredits a badge.
    const title={userId:seed.userId,titleBadgeId:69610001001},titlePut={UserTitleBadge:[title]};
    await fresh('unearned-title');now=season.slot4+1;
    await rejected('user_data/push',delta(titlePut));
    const invented=settledRecord(initialRecord(id));putProfile('UserSerialPvpRecord',[invented]);
    await rejected('user_data/push',delta(titlePut)); // Aggregate flags alone do not earn a title.
    await fresh('earned-title');await complete(123);
    await rejected('user_data/push',delta(titlePut));
    now=season.slot4;parse(await send(confirm));
    assert.deepEqual(app.store.read('UserTitleBadge').data,[],'Rank publication must leave badge creation to the native client');
    await rejected('user_data/push',delta(titlePut)); // Original cutoff is strictly AFTER matching-end.
    now++;
    const titleGifts=structuredClone(gifts()),titleReceipt=earned()[0],publishedTitleRecord=structuredClone(app.store.read('UserSerialPvpRecord').data);
    for(const titleBadgeId of [69610001002,69610001006,69610001007])
      await rejected('user_data/push',delta({UserTitleBadge:[{...title,titleBadgeId}]}));
    for(const record of [{...publishedTitleRecord[0],rank:2},{...publishedTitleRecord[0],isAggregate:false},
      {...publishedTitleRecord[0],isReceiveReward:false}])
      await rejected('user_data/push',delta({...titlePut,UserSerialPvpRecord:[record]}));
    const checkpoint=JSON.parse(titleReceipt.record_json);
    app.store.db.prepare('UPDATE serial_pvp_ranking_reward SET record_json=? WHERE serial_pvp_id=?')
      .run(JSON.stringify({...checkpoint,published:false}),id);
    await rejected('user_data/push',delta(titlePut));
    app.store.db.prepare('UPDATE serial_pvp_ranking_reward SET record_json=? WHERE serial_pvp_id=?').run(titleReceipt.record_json,id);
    app.store.db.prepare('UPDATE serial_pvp_ranking_reward SET catalog_hash=? WHERE serial_pvp_id=?').run('missing-original-prize',id);
    await rejected('user_data/push',delta(titlePut));
    app.store.db.prepare('UPDATE serial_pvp_ranking_reward SET catalog_hash=? WHERE serial_pvp_id=?').run(titleReceipt.catalog_hash,id);
    app.store.db.prepare('DELETE FROM serial_pvp_ranking_reward WHERE serial_pvp_id=?').run(id);
    await rejected('user_data/push',delta(titlePut));
    app.store.db.prepare(`INSERT INTO serial_pvp_ranking_reward(user_id,serial_pvp_id,battle_id,best_battle_id,
      record_json,issued_at,catalog_hash) VALUES(?,?,?,?,?,?,?)`).run(titleReceipt.user_id,titleReceipt.serial_pvp_id,
      titleReceipt.battle_id,titleReceipt.best_battle_id,titleReceipt.record_json,titleReceipt.issued_at,titleReceipt.catalog_hash);
    const combinedTitle={...titlePut,UserInfo:[{...user(),titleBadgeId:title.titleBadgeId,subTitleBadgeId:0}],
      UserSerialPvpRecord:publishedTitleRecord};
    for(const [table,event,condition] of [['profile','UPDATE'," WHEN NEW.name='UserTitleBadge'"],['reply_cache','INSERT','']]) {
      app.store.db.exec(`CREATE TEMP TRIGGER title_save_fail BEFORE ${event} ON ${table}${condition} BEGIN SELECT RAISE(ABORT,'injected'); END`);
      await rejected('user_data/push',delta(combinedTitle));app.store.db.exec('DROP TRIGGER title_save_fail');
    }
    const titleReply=await push(combinedTitle),titleSequence=sequence;
    parse(titleReply);assert.deepEqual(app.store.read('UserTitleBadge').data,[title]);
    assert.equal(app.store.read('UserInfo').data[0].titleBadgeId,title.titleBadgeId);
    assert.deepEqual(gifts(),titleGifts);assert.deepEqual(earned(),[titleReceipt]);
    assert.deepEqual(app.store.read('UserSerialPvpRecord').data,publishedTitleRecord);
    assert.equal(app.store.hardCurrency(),0);assert.deepEqual(app.store.operations(),[]);
    const titleSaved=snapshot(),titleBody=delta(combinedTitle);
    assert.deepEqual((await request(port,titleSequence,titleBody,String(titleSequence),'user_data/push')).body,titleReply.body);
    assert.equal(snapshot(),titleSaved,'An actual-wire retry must not award another title, gift or operation');
    now=season.slot3+200;await close();await open();
    parse(await push(titlePut));parse(await push({UserInfo:[{...user(),titleBadgeId:0,subTitleBadgeId:0}]}));
    assert.deepEqual(app.store.read('UserTitleBadge').data,[title],'Owned titles survive rewind, restart and unequip');
    await rejected('user_data/push',delta({},[],{UserTitleBadge:[{titleBadgeId:title.titleBadgeId}]}),400);
    assert.deepEqual(gifts(),titleGifts);assert.deepEqual(earned(),[titleReceipt]);

    await fresh('two-seasons');await complete(123);now=season.slot4;parse(await send(confirm));
    const previousInfo=structuredClone(app.store.read('UserSerialPvpInfo').data),previousOpponent=previousInfo[0].resumeRivalUserId,
      previousRows=structuredClone(Object.fromEntries(['UserSerialPvpRecord','UserSerialPvpGameStatus','UserSerialPvpUsingLimitData']
        .map(name=>[name,app.store.read(name).data])));
    now=secondSeason.slot3+100;
    for(const replacement of [0,previousOpponent+1]) {
      putProfile('UserSerialPvpInfo',[{...previousInfo[0],resumeRivalUserId:replacement}]);
      for(const route of ['serial_pvp/summary/get','serial_pvp/ranking/get','serial_pvp/character/ranking/get'])
        await rejected(route,{serialPvpId:secondId});
      await rejected('serial_pvp/grade/select',{serialPvpId:secondId,gradeId});
      putProfile('UserSerialPvpInfo',previousInfo);
    }
    const corruptUser=user();corruptUser.processingSerialPvpState=1;putProfile('UserInfo',[corruptUser]);
    await rejected('serial_pvp/summary/get',{serialPvpId:secondId});corruptUser.processingSerialPvpState=0;putProfile('UserInfo',[corruptUser]);
    const missing=app.store.db.prepare('SELECT * FROM serial_pvp_progress WHERE serial_pvp_id=?').get(id);
    app.store.db.prepare('DELETE FROM serial_pvp_progress WHERE serial_pvp_id=?').run(id);
    await rejected('serial_pvp/summary/get',{serialPvpId:secondId});
    app.store.db.prepare('INSERT INTO serial_pvp_progress(user_id,serial_pvp_id,battle_id) VALUES(?,?,?)')
      .run(missing.user_id,missing.serial_pvp_id,missing.battle_id);
    const newSummary=parse(await send('serial_pvp/summary/get',{serialPvpId:secondId}));
    assert.deepEqual(newSummary.serialPvpRecord,[]);assert.equal(newSummary.currentScore,0);
    assert.deepEqual(parse(await send('serial_pvp/ranking/get',{serialPvpId:secondId})).serialPvpTotalRanking,[]);
    assert.deepEqual(parse(await send('serial_pvp/character/ranking/get',{serialPvpId:secondId})),{code:0,result:0,normal:[],assist:[]});
    for(const [name,rows] of Object.entries(previousRows)) assert.deepEqual(app.store.read(name).data,rows);
    assert.deepEqual(app.store.read('UserSerialPvpInfo').data,previousInfo);
    await complete(456,true,secondId);
    assert.notEqual(app.store.read('UserSerialPvpInfo').data[0].resumeRivalUserId,previousOpponent);
    // Native puts are merged into whole season tables. Historical checks must
    //retain each old timestamp/record while the newer global opponent survives.
    const merged=Object.fromEntries(Object.keys(previousRows).map(name=>[name,structuredClone(app.store.read(name).data)]));
    parse(await push({...merged,UserInfo:[user()],UserSerialPvpInfo:app.store.read('UserSerialPvpInfo').data}));
    for(const [name,rows] of Object.entries(previousRows)) assert.deepEqual(merged[name].filter(row=>row.serialPvpId===id),rows);
    await rejected('user_data/push',delta({UserSerialPvpInfo:previousInfo}));
    await rejected('user_data/push',delta({UserSerialPvpRecord:[{...previousRows.UserSerialPvpRecord[0],score:999}]}));
    await rejected('user_data/push',delta({UserSerialPvpGameStatus:[{...previousRows.UserSerialPvpGameStatus[0],lastBattleStartAt:0}]}));
    await close();await open();parse(await push(merged));
    now=secondSeason.slot4;const oldProfiles=profiles();
    assert.equal((await send('user_data/pull',{tables:['UserGift']})).status,200);
    assert.equal(earned().length,2);assert.equal(gifts().length,4);assert.equal(profiles(),oldProfiles);
    await close();await open();parse(await send(confirm));assert.equal(gifts().length,4);

    await fresh('expired-winning-run');await complete(123,true,id,true);
    const winning=parse(await send('serial_pvp/summary/get',{serialPvpId:id}));
    assert.equal(winning.currentWinCount,1);assert.equal(winning.existResult,false);
    now=secondSeason.slot3+100;
    await rejected('serial_pvp/summary/get',{serialPvpId:secondId});
    parse(await push({UserSerialPvpUsingLimitData:[{...app.store.read('UserSerialPvpUsingLimitData').data[0],
      ...winning.serialPvpUsingLimitData}]}));
    const unfinished=structuredClone(app.store.read('UserSerialPvpRecord').data[0]);
    parse(await send('serial_pvp/summary/get',{serialPvpId:secondId}));
    await complete(456,true,secondId);now=secondSeason.slot4;parse(await send(confirm));
    assert.equal(earned().length,1,'Expiration preserves an unfinished run but never invents a closed result or reward');
    assert.equal(earned()[0].serial_pvp_id,secondId);
    assert.deepEqual(app.store.read('UserSerialPvpRecord').data.find(row=>row.serialPvpId===id),unfinished);
    assert.equal(app.store.db.prepare('SELECT 1 FROM serial_pvp_result WHERE serial_pvp_id=?').get(id),undefined);

    await fresh('summary-publication');await complete(0);now=season.slot4;
    const summaryRecord=structuredClone(app.store.read('UserSerialPvpRecord').data[0]),
      summary=parse(await send('serial_pvp/summary/get',{serialPvpId:id}));
    assert.deepEqual(summary.serialPvpRecord,[settledRecord(summaryRecord)]);assert.equal(gifts().length,2);
    assert.equal(parse(await send('serial_pvp/result/get',{serialPvpId:id})).currentRank,1);
    assert.equal(app.store.hardCurrency(),0);assert.deepEqual(app.store.operations(),[]);
    await fresh('record-pull-publication');await complete(123);now=season.slot4;
    assert.equal((await send('user_data/pull',{tables:['UserSerialPvpRecord']})).status,200);
    assert.equal(gifts().length,2);assert.equal(app.store.read('UserSerialPvpRecord').data[0].rank,1);

    await fresh('legacy-status-publication');await complete(123);now=season.slot4;parse(await send(confirm));
    const legacy=earned()[0],legacyCheckpoint=JSON.parse(legacy.record_json),legacyGifts=structuredClone(gifts()),
      legacyGiftToken=app.store.read('UserGift').token;
    app.store.db.prepare('UPDATE serial_pvp_ranking_reward SET record_json=? WHERE serial_pvp_id=?')
      .run(JSON.stringify({record:legacyCheckpoint.record,progressBattleId:legacyCheckpoint.progressBattleId}),id);
    putProfile('UserSerialPvpRecord',[legacyCheckpoint.record]);now=season.slot3+200;
    for(const [table,condition] of [['profile'," WHEN NEW.name='UserSerialPvpRecord'"],['serial_pvp_ranking_reward','']]) {
      app.store.db.exec(`CREATE TEMP TRIGGER status_upgrade_fail BEFORE UPDATE ON ${table}${condition} BEGIN SELECT RAISE(ABORT,'injected'); END`);
      await rejected(confirm);app.store.db.exec('DROP TRIGGER status_upgrade_fail');
    }
    app.store.db.exec("CREATE TEMP TRIGGER status_no_duplicate BEFORE INSERT ON serial_pvp_ranking_reward BEGIN SELECT RAISE(ABORT,'duplicate reward'); END");
    parse(await send(confirm));assert.deepEqual(gifts(),legacyGifts);assert.equal(app.store.read('UserGift').token,legacyGiftToken);
    assert.equal(earned().length,1);assert.equal(earned()[0].issued_at,legacy.issued_at);
    assert.deepEqual(app.store.read('UserSerialPvpRecord').data,[settledRecord(legacyCheckpoint.record)]);
    app.store.db.exec("CREATE TEMP TRIGGER status_no_rewrite BEFORE UPDATE ON profile WHEN NEW.name='UserSerialPvpRecord' BEGIN SELECT RAISE(ABORT,'status rewritten'); END");
    parse(await send(confirm));await close();await open();parse(await send(confirm));
    assert.deepEqual(gifts(),legacyGifts);assert.equal(JSON.parse(earned()[0].record_json).published,true);

    for(const [score,flagsFirst] of [[0,false],[123,true]]) {
      await fresh('reward-'+score);await complete(score);
      const beforeProfiles=profiles(),wallet=app.store.hardCurrency(),oldGiftToken=app.store.read('UserGift').token,
        beforeRecord=structuredClone(app.store.read('UserSerialPvpRecord').data[0]),oldRecordToken=app.store.read('UserSerialPvpRecord').token;
      parse(await send(confirm));assert.deepEqual(gifts(),[]);assert.equal(earned().length,0);
      const oldPull=await send('user_data/pull',{tables:['UserGift']}),oldPullSequence=sequence;
      assert.equal(oldPull.status,200);
      now=season.slot4;
      for(const [table,event,condition] of [['profile','UPDATE'," WHEN NEW.name='UserGift'"],
        ['profile','UPDATE'," WHEN NEW.name='UserSerialPvpRecord'"],['serial_pvp_ranking_reward','UPDATE',''],
        ['serial_pvp_ranking_reward','INSERT',''],['serial_pvp_ranking_gift','INSERT',' WHEN NEW.reward_id=81500000002'],
        ['reply_cache','INSERT','']]) {
        app.store.db.exec(`CREATE TEMP TRIGGER ranking_issue_fail BEFORE ${event} ON ${table}${condition} BEGIN SELECT RAISE(ABORT,'injected'); END`);
        await rejected(confirm);app.store.db.exec('DROP TRIGGER ranking_issue_fail');
      }
      const published=parse(await send(confirm)),originalGifts=structuredClone(gifts()),nativeRecord=app.store.read('UserSerialPvpRecord').data;
      assert.equal(originalGifts.length,2);assert.equal(earned().length,1);assert.equal(profiles(),beforeProfiles);
      assert.equal(app.store.hardCurrency(),wallet);assert.deepEqual(app.store.operations(),[]);
      assert.deepEqual(nativeRecord,[settledRecord(beforeRecord)]);
      assert.equal(JSON.parse(earned()[0].record_json).published,true);
      assert.notEqual(published.dataTokens.UserSerialPvpRecord,oldRecordToken);
      assert.equal(published.dataTokens.UserSerialPvpRecord,md5(nativeRecord));
      for(const changed of [beforeRecord,{...nativeRecord[0],rank:2},{...nativeRecord[0],isAggregate:false},
        {...nativeRecord[0],isReceiveReward:false}])
        await rejected('user_data/push',delta({UserSerialPvpRecord:[changed]}));
      parse(await push({UserSerialPvpRecord:nativeRecord}));
      const publication=earned()[0];
      app.store.db.prepare('UPDATE serial_pvp_ranking_reward SET record_json=? WHERE serial_pvp_id=?')
        .run(JSON.stringify({...JSON.parse(publication.record_json),published:false}),id);
      await rejected(confirm);app.store.db.prepare('UPDATE serial_pvp_ranking_reward SET record_json=? WHERE serial_pvp_id=?')
        .run(publication.record_json,id);
      assert.notEqual(published.dataTokens.UserGift,oldGiftToken);assert.equal(published.dataTokens.UserGift,md5(app.store.read('UserGift').data));
      for(const [index,gift] of originalGifts.entries()) {
        assert.equal(Object.keys(gift).length,19);assert.equal(gift.userId,seed.userId);assert.equal(gift.senderType,1);
        assert.equal(gift.senderId,0);assert.equal(gift.giftAcquiredType,8);assert.equal(gift.state,0);
        assert.match(gift.title,/^\[Offline Abyss ranking\] /);assert.equal(gift.startAt,season.slot4);assert.equal(gift.createdAt,now);
        assert.equal(gift.expireAt,0);assert.equal(gift.dynamodbExpireAt,0);
        assert.equal(gift.itemId,prize.rewards[index].itemId);assert.equal(gift.amount,prize.rewards[index].amount);
      }
      const stale=snapshot();assert.equal((await request(port,oldPullSequence,{tables:['UserGift']},String(oldPullSequence),'user_data/pull')).status,503);
      assert.equal(snapshot(),stale,'Cached binary pull must not restore empty Presents or produce a reward outside its transaction');
      await rejected('user_data/push',delta({},[],{UserGift:[{id:originalGifts[0].id}]}));
      await rejected('user_data/push',delta({UserGift:[{...originalGifts[0],amount:201}]}));
      // Native object serialization may reorder fields; identity is semantic.
      parse(await push({UserGift:originalGifts.map(gift=>Object.fromEntries(Object.entries(gift).sort(([a],[b])=>a.localeCompare(b))))}));
      assert.deepEqual(gifts(),originalGifts);
      now=season.slot3+200;await rejected('serial_pvp/grade/select',{serialPvpId:id,gradeId});
      now=season.slot6+100;await close();await open();app.store.db.exec('DELETE FROM reply_cache');
      parse(await send(confirm));assert.deepEqual(gifts(),originalGifts);assert.equal(earned().length,1);

      const claimBody={userId:seed.userId,giftIds:originalGifts.map(row=>row.id)};
      for(const [table,event] of [['hard_currency','UPDATE'],['operation_queue','INSERT'],['gift_claim','INSERT'],
        ['serial_pvp_ranking_gift','UPDATE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TEMP TRIGGER ranking_claim_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
        await rejected(receive,claimBody);app.store.db.exec('DROP TRIGGER ranking_claim_fail');
      }
      const firstReply=await send(receive,claimBody),claimSequence=sequence,claim=parse(firstReply).operations[0];
      assert.equal(claim.type,2000);assert.deepEqual(claim.parameters.UserGift,originalGifts);
      assert.deepEqual(claim.parameters.receivedItems,prize.rewards.map(({itemId,amount})=>({itemId,amount})));
      assert.equal(app.store.hardCurrency(),wallet+200);assert.equal(profiles(),beforeProfiles,'No native item acquisition precredit');
      assert.ok(app.store.db.prepare('SELECT claim_operation_id FROM serial_pvp_ranking_gift').all().every(row=>row.claim_operation_id===claim.id));
      await rejected('user_data/push',delta({},[claim]),400);
      const received=originalGifts.map(row=>Object.fromEntries(Object.entries({...row,state:1}).reverse())),
        target=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=?').get(claim.id),
        inventory=structuredClone(app.store.read(target.table_name).data),old=inventory.find(row=>row[target.id_field]===target.item_id),
        acquired={userId:seed.userId,[target.id_field]:target.item_id,cumulativeAmount:target.cumulative_amount,bookEntryState:3,
          signature:old?.signature ?? 0,dateList:[...(old?.dateList ?? []),{aquiredAt:now}]};
      const items=inventory.filter(row=>row[target.id_field]!==target.item_id).concat(acquired),
        firstSave=flagsFirst?{UserGift:received}:{[target.table_name]:items},secondSave=flagsFirst?{[target.table_name]:items}:{UserGift:received};
      const saved=parse(await push(firstSave));assert.equal(saved.operations.some(row=>row.id===claim.id),false);
      assert.equal(app.store.operations().length,1,'Observed additive delivery stays queued for its own ACK');
      if(flagsFirst) await rejected('user_data/push',delta({UserGift:originalGifts}));
      else await rejected('user_data/push',delta({},[],{[target.table_name]:[{[target.id_field]:target.item_id}]}));
      await rejected(receive,claimBody);await rejected(confirm);
      const partial=snapshot();assert.equal((await request(port,claimSequence,claimBody,String(claimSequence),receive)).status,503);assert.equal(snapshot(),partial);
      await close();await open();now+=86400;await rejected(confirm);
      for(const [table,event] of [['profile','UPDATE'],['operation_done','INSERT'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TEMP TRIGGER ranking_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
        await rejected('user_data/push',delta(secondSave,[claim]));app.store.db.exec('DROP TRIGGER ranking_ack_fail');
      }
      parse(await push(secondSave,[claim]));assert.deepEqual(app.store.operations(),[]);assert.equal(app.store.hardCurrency(),wallet+200);
      const completed=snapshot();assert.equal((await request(port,claimSequence,claimBody,String(claimSequence),receive)).status,503);assert.equal(snapshot(),completed);
      parse(await push({},[],{UserGift:originalGifts.map(({id})=>({id}))}));assert.deepEqual(gifts(),[]);
      await close();await open();app.store.beginSession();parse(await send(confirm));assert.deepEqual(gifts(),[]);assert.equal(earned().length,1);
      assert.deepEqual(app.store.read('UserSerialPvpRecord').data,nativeRecord,'Gift cleanup/claim/rewind never resets earned native ranking status');
      parse(await push(titlePut));
      assert.deepEqual(app.store.read('UserTitleBadge').data,[title],'Claimed/removed Presents do not prevent an actual earned native title save');
      const afterClaimClock=now;now=season.slot3+200;await close();await open();parse(await push(titlePut));now=afterClaimClock;
      assert.deepEqual(app.store.read('UserTitleBadge').data,[title],'Owned titles do not reopen awards or disappear on a gift-cleanup rewind');
      assert.deepEqual(gifts(),[]);assert.equal(earned().length,1);assert.equal(app.store.hardCurrency(),wallet+200);
      await rejected('user_data/push',delta({UserGift:originalGifts}));
      const binding=app.store.db.prepare('SELECT * FROM serial_pvp_ranking_gift ORDER BY gift_id').get();
      app.store.db.prepare('UPDATE serial_pvp_ranking_gift SET claim_operation_id=NULL WHERE gift_id=?').run(binding.gift_id);
      await rejected(confirm);app.store.db.prepare('UPDATE serial_pvp_ranking_gift SET claim_operation_id=? WHERE gift_id=?').run(binding.claim_operation_id,binding.gift_id);
      app.store.db.prepare('UPDATE gift_claim SET operation_id=? WHERE gift_id=?').run(claim.id+1,binding.gift_id);
      await rejected(confirm);app.store.db.prepare('UPDATE gift_claim SET operation_id=? WHERE gift_id=?').run(claim.id,binding.gift_id);
      app.store.db.prepare('UPDATE serial_pvp_ranking_gift SET gift_json=? WHERE gift_id=?')
        .run(JSON.stringify({...JSON.parse(binding.gift_json),amount:999}),binding.gift_id);
      await rejected(confirm);app.store.db.prepare('UPDATE serial_pvp_ranking_gift SET gift_json=? WHERE gift_id=?').run(binding.gift_json,binding.gift_id);
      app.store.db.prepare('DELETE FROM serial_pvp_ranking_gift WHERE gift_id=?').run(binding.gift_id);await rejected(confirm);
      app.store.db.prepare(`INSERT INTO serial_pvp_ranking_gift(gift_id,user_id,serial_pvp_id,reward_id,gift_json,claim_operation_id)
        VALUES(?,?,?,?,?,?)`).run(binding.gift_id,binding.user_id,binding.serial_pvp_id,binding.reward_id,binding.gift_json,binding.claim_operation_id);
      const allocator=app.store.transaction(()=>app.store.createGifts(prize.rewards,'TEMP shared-ID allocator',2,now));
      assert.ok(allocator.every(row=>row.id>Math.max(...originalGifts.map(gift=>gift.id))),'Consumed ranking Presents retain their ID allocation history');
      assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    }
    console.log('Original Abyss prizes/Presents/claim/save/rewind/replay/rollback source probes complete; native acceptance remains pending');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
