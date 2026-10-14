'use strict';

// DEFERRED / NOT RUN. Synthetic native-shaped deltas do not prove achievement end
// events, signatures, natural entry, CPU vector mapping or emulator combat.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const { createServer,OFFLINE_UNAVAILABLE_CODE }=require('./danmemore_server.cjs');
const { request }=require('./test_danmemore_server.cjs');
const { underPvpRecord,underPvpSettlement,underPvpGameStatusDefault,underPvpSelectedRivalReset,
  underPvpRefreshIntent }=require('./under_pvp.cjs');
const master=require('../data/danmemore-master.json'),seed=require('../data/danmemore-seed.json');
const id=69000000001,season=master.underPvp.underPvpInformation[id],medalId=master.shopProducts[season.slot17].priceItemId;
const md5=value=>crypto.createHash('md5').update(value).digest('hex');
const start='under_pvp/battle/start',restart='under_pvp/battle/restart',end='under_pvp/battle/end';
const unit=pcId=>({ pcId,level:pcId?1:0,currentJobIndex:pcId?1:0,limitbreakCount:0,usableSkillAmount:0,
  strength:0,intelligence:0,agility:0,vitality:0,luck:0,hp:pcId?100:0,mp:pcId?16:0,
  physicalAttackPower:0,magicAttackPower:0,defensePower:0,weaponId:0,armorId:0,weaponAbilityIds:[],armorAbilityIds:[],
  heroSublimateLevel:0,isUnlockedHeroSublimate:false,attackPattern:0,currentDP:0,unlockedAdditionalAbilityAmount:0,hasAllStatusBoardOpened:false });
const savedParty=seed.data.UserParty.find(row=>row.id===seed.data.UserInfo[0].activeUnderPvpPartyId);
const party={ userId:seed.userId,partyType:7,index:0,attackPattern:savedParty.attackPattern,partyStrength:0,
  slots:savedParty.slots.map(row=>({ slotNumber:row.slotNumber,pc:unit(row.pcId),assistingPc:unit(row.assistingPcId),
    commandFlow:row.commandFlow,isHidden:false })),memoriaSlots:[] };

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-under-battle-')),database=path.join(directory,'save.sqlite');
  let app,port,sequence=0,now=season.slot8+100,rejection;
  const open=async()=>{ app=createServer({ database,seed,master,wallNowSeconds:()=>now,log:line=>{
    const entry=JSON.parse(line);if(entry.event==='rejected') rejection=entry.reason;
  } });
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port; };
  const close=async()=>{ if(app){ await app.close();app=null; } };
  const send=(action,value)=>{rejection=undefined;return request(port,++sequence,value,String(sequence),action);};
  const parse=reply=>{ assert.equal(reply.status,200,rejection ?? reply.body.toString());return JSON.parse(reply.body); };
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected=async(action,value,status=503)=>{ const before=snapshot(),reply=await send(action,value);
    assert.equal(reply.status,status,reply.body.toString());if(status===503)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Rejected battle/save preserves profiles, captures, sequence and replies'); };
  const delta=putItems=>({ badges:null,scripts:{},dataTokens:{},operations:[],checksums:{ before:{},
    after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(JSON.stringify(rows))])) },
    deltas:[{ signature:0,trigger:'UpdateUnderPvpState',putItems,deleteItems:{} }] });
  const push=async putItems=>parse(await send('user_data/push',delta(putItems)));
  const user=()=>app.store.read('UserInfo').data[0];
  const sp=(amount,at)=>[{ ...user(),playerStatus:{ ...user().playerStatus,underPvpSP:amount,underPvpSPUpdatedAt:at } }];
  const fresh=underPvpRecord([],id,master,seed.userId);
  try {
    // Explicit local scoring; not an assertion that15/20/30 are publisher mappings.
    for(const rating of [0,1,2]) for(const result of [{isWin:true,isRetire:false},{isWin:false,isRetire:false},{isWin:false,isRetire:true}]) {
      const settled=underPvpSettlement(fresh,rating,result,master);
      assert.equal(settled.result.scoreDifference,result.isWin?[15,20,30][rating]:0);
      assert.equal(settled.record.winCount,Number(result.isWin));assert.equal(settled.record.loseCount,Number(!result.isWin));
    }
    assert.throws(()=>underPvpSettlement(fresh,0,{isWin:true,isRetire:true},master));
    await open();
    // Synthetic joined starter-assist prerequisite, not natural acquisition.
    await push({UserPC:app.store.read('UserPC').data.map(row=>({...row,joiningState:1}))});
    await push({ UserInfo:sp(3,now) });
    // Isolated legacy pass prerequisite, not an original producer/grant.
    const passes=[{userId:seed.userId,underPvpStaminaTicketId:330000001,amount:2,bookEntryState:0,
      signature:0xffffffff,targetUnderPvpInfoId:id}];
    app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserUnderPvpStaminaTicket'")
      .run(JSON.stringify(passes),md5(JSON.stringify(passes)));
    const view=parse(await send('under_pvp/summary/get',{ underPvpId:id }));
    await push({ UserUnderPvPRecord:[view.underPvpRecord] });
    const cpu=view.rivalList[2],body={ underPvpId:id,userId:cpu.underPvpPlayerInfo.userId,rating:2,
      userParty:party,isRevenge:false,revengeStartAt:0 };
    await rejected(start,{...body,isRevenge:true});await rejected(start,{...body,userId:seed.userId});
    await rejected(start,{...body,userParty:{...party,index:-1}},400);
    const selectedAt=now;
    for(const time of [season.slot8-1,season.slot9,season.slot9+1]) {
      now=time;await rejected(start,body);
      await rejected('under_pvp/rival_list/update',{underPvpId:id,isSelectedRivalIdReset:true});
    }
    now=selectedAt;
    const profileBefore=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
    const first=await send(start,body),firstId=sequence,battle=parse(first);
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profileBefore,'Start does not pre-credit native state');
    assert.deepEqual(battle.underPvpParty,cpu.underPvpParty);assert.match(battle.battleId,/^under-/);
    assert.ok(battle.randomSeed>0);assert.equal(app.store.operations().length,0);
    assert.equal(parse(await send(start,body)).battleId,battle.battleId,'New request identity still resumes the same untouched callback');
    const restartBody={underPvpId:id,userId:body.userId,rating:2,isRevenge:false,revengeStartAt:0,lastBattleStartAt:now};
    await rejected(restart,restartBody);await rejected('under_pvp/rival_list/update',{underPvpId:id,isSelectedRivalIdReset:true});
    const status={ userId:0,underPvpId:id,updatedMatchingCount:0,updateRivalList:true,lastRivalListUpdateAt:0,
      executeRivalListUpdate:false,lastBattleStartAt:now };
    await push({UserUnderPvPGameStatus:[status]});
    await rejected(start,body);await rejected(restart,restartBody);
    const cost={UserInfo:sp(2,now).map(row=>({...row,processingUnderPvpState:1})),UserUnderPvPInfo:[{...app.store.read('UserUnderPvPInfo').data[0],resumeRating:2,resumeRivalUserId:body.userId}],
      UserEventItem:[{userId:seed.userId,eventItemId:medalId,amount:100,cumulativeAmount:100,signature:123,readState:3}]};
    const beforeRollback=snapshot();
    app.store.db.exec("CREATE TRIGGER fail_under_cost BEFORE UPDATE ON under_pvp_battle BEGIN SELECT RAISE(ABORT,'under cost rollback'); END");
    const costFailure=await send('user_data/push',delta(cost));assert.equal(costFailure.status,503);assert.equal(snapshot(),beforeRollback);
    app.store.db.exec('DROP TRIGGER fail_under_cost');await push(cost);
    const receipt=app.store.underPvpActiveBattle();assert.deepEqual(receipt.observed,['info','medal','processing','sp','status']);
    await rejected('user_data/push',delta({UserUnderPvpStaminaTicket:[{...passes[0],amount:1}],UserInfo:sp(3,now)}));
    await rejected('user_data/push',delta({UserInfo:[{...user(),processingUnderPvpState:0}]}));
    await rejected('user_data/push',delta({UserInfo:sp(1,now)}));
    await rejected('user_data/push',delta({UserEventItem:[{...cost.UserEventItem[0],amount:99,cumulativeAmount:99}]}));
    await close();await open();app.store.db.exec('DELETE FROM reply_cache');
    const oldStart=await request(port,firstId,body,String(firstId),start);assert.equal(oldStart.status,503,'Already observed start cannot repeat costs');
    const resumed=parse(await send(restart,restartBody)),resumeId=sequence;
    assert.equal(resumed.battleId,battle.battleId);assert.equal(resumed.randomSeed,battle.randomSeed);
    assert.deepEqual(resumed.underPvpParty,battle.underPvpParty);assert.equal(user().playerStatus.underPvpSP,2);
    assert.equal(app.store.read('UserEventItem').data.find(row=>row.eventItemId===medalId).amount,100);
    assert.deepEqual(parse(await request(port,resumeId,restartBody,String(resumeId),restart)),resumed);
    const endBody={underPvpId:id,battleId:battle.battleId,result:{isWin:true,isRetire:false},
      isRevenge:false,revengeStartAt:0,lastBattleStartAt:now};
    await rejected(end,{...endBody,lastBattleStartAt:now+1});
    const completed=parse(await send(end,endBody)),endId=sequence;
    assert.equal(completed.underPvpResult.scoreDifference,30);assert.equal(completed.underPvpRecord.winCount,1);
    assert.equal(app.store.underPvpActiveBattle().end_saved,0,'Issuing a result is not native save proof');
    assert.deepEqual(parse(await request(port,endId,endBody,String(endId),end)),completed);
    await rejected(end,{...endBody,result:{isWin:false,isRetire:false}});
    await rejected(restart,restartBody);
    const settled={UserUnderPvPRecord:[completed.underPvpRecord],UserInfo:[{...user(),processingUnderPvpState:0}]};
    const prior=snapshot();
    app.store.db.exec("CREATE TRIGGER fail_under_result BEFORE INSERT ON under_pvp_record_state BEGIN SELECT RAISE(ABORT,'under result rollback'); END");
    const failed=await send('user_data/push',delta(settled));assert.equal(failed.status,503);assert.equal(snapshot(),prior);
    app.store.db.exec('DROP TRIGGER fail_under_result');await push(settled);
    assert.equal(app.store.underPvpActiveBattle(),null);assert.equal(app.store.underPvpRecordFloor(id).after.score,30);
    assert.equal(app.store.read('UserUnderPvPInfo').data[0].resumeRivalUserId,body.userId,'Completed native matches retain the last opponent ID');
    const rankings=parse(await send('under_pvp/character/ranking/get',{underPvpId:id}));
    assert.deepEqual(rankings.normal,[{rank:1,pcId:party.slots[0].pc.pcId}]);
    assert.deepEqual(rankings.assist,[{rank:1,pcId:party.slots[0].assistingPc.pcId}]);
    await rejected('user_data/push',delta({UserUnderPvPRecord:[fresh]}));
    await rejected(end,endBody);await rejected(restart,restartBody);
    await close();await open();app.store.db.exec('DELETE FROM reply_cache');
    assert.equal((await request(port,endId,endBody,String(endId),end)).status,503,'Completed callbacks never repeat native end events');
    const next=parse(await send('under_pvp/summary/get',{underPvpId:id}));assert.equal(next.underPvpRecord.score,30);
    const secondBody={...body,userId:next.rivalList[0].underPvpPlayerInfo.userId,rating:0};
    const nextBattle=parse(await send(start,secondBody));assert.notEqual(nextBattle.battleId,battle.battleId);
    // A lost active pointer is a failure, not permission to create another battle.
    app.store.db.exec('DELETE FROM under_pvp_active');await rejected(start,secondBody);
    app.store.db.prepare('INSERT INTO under_pvp_active(user_id,battle_id) VALUES(?,?)').run(seed.userId,nextBattle.battleId);
    const retireBody={underPvpId:id,battleId:nextBattle.battleId,result:{isWin:false,isRetire:true}};
    await rejected(end,retireBody);
    await push({UserUnderPvPGameStatus:[status]});
    assert.equal(app.store.read('UserUnderPvPInfo').data[0].resumeRivalUserId,body.userId,'First checkpoint can retain the previous match opponent');
    await push({UserInfo:sp(1,now).map(row=>({...row,processingUnderPvpState:1})),
      UserUnderPvPInfo:[{...cost.UserUnderPvPInfo[0],resumeRating:0,resumeRivalUserId:secondBody.userId}],
      UserEventItem:[{...cost.UserEventItem[0],amount:200,cumulativeAmount:200}]});
    const retired=parse(await send(end,retireBody));assert.equal(retired.underPvpResult.scoreDifference,0);
    assert.equal(retired.underPvpRecord.score,30);assert.equal(retired.underPvpRecord.loseCount,1);
    await push({UserUnderPvPRecord:[retired.underPvpRecord]});
    assert.ok(app.store.underPvpActiveBattle(),'Record-only end checkpoint does not clear the active battle');
    await push({UserInfo:[{...user(),processingUnderPvpState:0}]});
    assert.equal(app.store.underPvpActiveBattle(),null);
    assert.ok(app.store.db.prepare('SELECT count FROM under_pvp_usage WHERE under_pvp_id=?').all(id).every(row=>row.count===2));
    await rejected('user_data/push',delta({UserEventItem:[cost.UserEventItem[0]]}));
    const pointer=app.store.db.prepare('SELECT * FROM under_pvp_record_state WHERE under_pvp_id=?').get(id);
    app.store.db.prepare('DELETE FROM under_pvp_record_state WHERE under_pvp_id=?').run(id);
    await rejected('under_pvp/summary/get',{underPvpId:id});
    app.store.db.prepare('INSERT INTO under_pvp_record_state(under_pvp_id,battle_id,record_json) VALUES(?,?,?)')
      .run(id,pointer.battle_id,pointer.record_json);
    let again=parse(await send('under_pvp/summary/get',{underPvpId:id}));
    for(let i=0;i<5 && again.rivalList[0].underPvpPlayerInfo.userId!==secondBody.userId;i++) {
      parse(await send('under_pvp/rival_list/update',{underPvpId:id,isSelectedRivalIdReset:underPvpSelectedRivalReset(
        app.store.read('UserUnderPvPGameStatus').data.find(row=>row.underPvpId===id),now)}));
      await push({UserUnderPvPGameStatus:[{...app.store.read('UserUnderPvPGameStatus').data.find(row=>row.underPvpId===id),
        updateRivalList:false,executeRivalListUpdate:false,lastRivalListUpdateAt:now}]});
      again=parse(await send('under_pvp/summary/get',{underPvpId:id}));
    }
    assert.equal(again.rivalList[0].underPvpPlayerInfo.userId,secondBody.userId,'Original CPU cycle reoffers the same opponent');
    const repeated=parse(await send(start,secondBody));
    const oldTokens=app.store.read('UserUnderPvPInfo').token;
    // Native setters omit unchanged opponent/rating/stamp. Neither omission
    // is a reason to strand the next match or force fabricated profile writes.
    await push({UserInfo:sp(0,now).map(row=>({...row,processingUnderPvpState:1})),
      UserEventItem:[{...cost.UserEventItem[0],amount:300,cumulativeAmount:300}]});
    assert.equal(app.store.read('UserUnderPvPInfo').token,oldTokens);
    assert.equal(app.store.underPvpActiveBattle().last_battle_start_at,now);
    const sameRetired=parse(await send(end,{...retireBody,battleId:repeated.battleId}));
    assert.equal(sameRetired.underPvpRecord.loseCount,2);
    // Flag-only end checkpoint is not record save proof either.
    await push({UserInfo:[{...user(),processingUnderPvpState:0}]});
    assert.ok(app.store.underPvpActiveBattle());
    await push({UserUnderPvPRecord:[sameRetired.underPvpRecord]});
    assert.equal(app.store.underPvpActiveBattle(),null);
    assert.ok(app.store.db.prepare('SELECT count FROM under_pvp_usage WHERE under_pvp_id=?').all(id).every(row=>row.count===3));
    await rejected('user_data/push',delta({UserInfo:[{...user(),processingUnderPvpState:1}]}));
    await close();await open();
    assert.equal(app.store.read('UserUnderPvPInfo').data[0].resumeRivalUserId,secondBody.userId);
    assert.equal(parse(await send('under_pvp/summary/get',{underPvpId:id})).underPvpRecord.loseCount,2);
    await push({UserUnderPvpStaminaTicket:[{...passes[0],amount:1}]});
    assert.ok(app.store.underPvpPendingPass());
    await rejected(start,secondBody);
    await push({UserInfo:sp(1,now)});
    assert.equal(app.store.underPvpPendingPass(),null);
    // A captured cost and first status checkpoint can arrive after the event
    // clock leaves this season in either direction. Bind the issued start,
    // not the clock at the later save. Ordinary unissued recovery stays strict.
    for (const [issued,moved] of [[season.slot8+86400+100,season.slot9+86400],
      [season.slot8+2*86400+100,season.slot8-86400],[season.slot9-1,season.slot9]]) {
      now=issued;
      await push({UserInfo:sp(3,now)});
      const current=parse(await send('under_pvp/summary/get',{underPvpId:id})),opponent=current.rivalList[1];
      const lateBody={...body,userId:opponent.underPvpPlayerInfo.userId,rating:1};
      const late=parse(await send(start,lateBody)),issuedAt=now,
        medal=app.store.read('UserEventItem').data.find(row=>row.eventItemId===medalId);
      now=moved;
      await rejected('user_data/push',delta({UserInfo:sp(1,issuedAt).map(row=>({...row,processingUnderPvpState:1}))}));
      await rejected('user_data/push',delta({UserUnderPvPGameStatus:[{...status,lastBattleStartAt:issuedAt+121}]}));
      await push({UserInfo:sp(2,issuedAt).map(row=>({...row,processingUnderPvpState:1})),
        UserUnderPvPInfo:[{...app.store.read('UserUnderPvPInfo').data[0],resumeRating:1,resumeRivalUserId:lateBody.userId}],
        UserUnderPvPGameStatus:[{...status,lastBattleStartAt:issuedAt}],
        UserEventItem:[{...medal,amount:medal.amount+100,cumulativeAmount:medal.cumulativeAmount+100}]});
      assert.deepEqual(app.store.underPvpActiveBattle().observed,['info','medal','processing','sp','status']);
      const lateRestart={underPvpId:id,userId:lateBody.userId,rating:1,isRevenge:false,revengeStartAt:0,lastBattleStartAt:issuedAt};
      assert.equal(parse(await send(restart,lateRestart)).battleId,late.battleId);
      const lateResult=parse(await send(end,{underPvpId:id,battleId:late.battleId,result:{isWin:false,isRetire:true}}));
      await push({UserUnderPvPRecord:[lateResult.underPvpRecord],UserInfo:[{...user(),processingUnderPvpState:0}]});
      assert.equal(app.store.underPvpActiveBattle(),null);
      await rejected('user_data/push',delta({UserInfo:sp(3,issuedAt)}));
    }
    assert.ok(app.store.db.prepare('SELECT count FROM under_pvp_usage WHERE under_pvp_id=?').all(id).every(row=>row.count===6));
    const displayProfiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
      displayProgress=app.store.db.prepare('SELECT * FROM under_pvp_record_state WHERE under_pvp_id=?').get(id),
      displayWallet=app.store.hardCurrency();
    let displayRecord,displayUsage;
    for(const time of [season.slot9,season.slot9+1,season.slot11-1]) {
      now=time;const displayed=parse(await send('under_pvp/summary/get',{underPvpId:id}));
      displayRecord=displayed.underPvpRecord;displayUsage=parse(await send('under_pvp/character/ranking/get',{underPvpId:id}));
      assert.deepEqual(displayRecord,JSON.parse(displayProgress.record_json));
      assert.equal(displayRecord.isAggregate,false);assert.equal(displayRecord.rank,0,'Reading final scores is not ranked aggregation');
      assert.deepEqual(displayUsage.normal,[{rank:1,pcId:party.slots[0].pc.pcId}]);
      assert.deepEqual(displayUsage.assist,[{rank:1,pcId:party.slots[0].assistingPc.pcId}]);
      const opponent=displayed.rivalList[1];
      await rejected(start,{...body,userId:opponent.underPvpPlayerInfo.userId,rating:1});
      await rejected('under_pvp/rival_list/update',{underPvpId:id,isSelectedRivalIdReset:true});
      assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),displayProfiles);
      assert.deepEqual(app.store.db.prepare('SELECT * FROM under_pvp_record_state WHERE under_pvp_id=?').get(id),displayProgress);
      assert.equal(app.store.hardCurrency(),displayWallet);assert.equal(app.store.underPvpActiveBattle(),null);
    }
    await close();await open();
    assert.deepEqual(parse(await send('under_pvp/summary/get',{underPvpId:id})).underPvpRecord,displayRecord);
    assert.deepEqual(parse(await send('under_pvp/character/ranking/get',{underPvpId:id})),displayUsage);
    now=season.slot11;
    await rejected('under_pvp/summary/get',{underPvpId:id});
    await rejected('under_pvp/character/ranking/get',{underPvpId:id});
    assert.deepEqual(app.store.db.prepare('SELECT * FROM under_pvp_record_state WHERE under_pvp_id=?').get(id),displayProgress,
      'Display expiry cancels reads but retains earned progress and immutable battle history');
    console.log('Under Telskyura source/wire/save checks passed; native acceptance still required');
  } finally { await close();fs.rmSync(directory,{recursive:true,force:true}); }
}
// DEFERRED / NOT RUN: callback-owned reset and independently issued battle
// stamp may share one native row, or save in either order. No native proof.
async function refreshHandoff() {
  for (const mode of ['combined','stamp-first','reset-first','manual-only','delayed-combined','delayed-stamp-first',
    'delayed-counter-first','delayed-intent-first','delayed-intent-stamp','delayed-counter-first-history',
    'delayed-intent-first-history','delayed-after-settlement','delayed-intent-after-settlement','automatic-after-settlement',
    'delayed-counter-first-nearby','delayed-intent-first-nearby','delayed-cost-first-nearby','delayed-frozen-nearby',
    'delayed-restart-sealed-nearby','delayed-result-sealed-nearby']) {
    const delayed=mode.startsWith('delayed-'),nearby=mode.endsWith('-nearby'),
      frozen=mode==='delayed-frozen-nearby' || mode.includes('-sealed-');
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-refresh-battle-')),database=path.join(directory,'save.sqlite');
    let app,port,sequence=0,now=season.slot8+100;
    const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
      await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
    const close=async()=>{if(app){await app.close();app=null;}};
    const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
    const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
    const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name").all()
      .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
    const delta=putItems=>({badges:null,scripts:{},dataTokens:{},operations:[],checksums:{before:{},
      after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(JSON.stringify(rows))]))},
      deltas:[{signature:0,trigger:'UpdateUnderPvpState',putItems,deleteItems:{}}]});
    const push=async rows=>parse(await send('user_data/push',delta(rows)));
    const rejected=async rows=>{const before=snapshot(),reply=await send('user_data/push',delta(rows));
      assert.equal(reply.status,503,reply.body.toString());assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
      assert.equal(snapshot(),before,'Invalid handoff rolls back native data, both private observations and replies');};
    const table='UserUnderPvPGameStatus',status=()=>app.store.read(table).data.find(row=>row.underPvpId===id) ?? underPvpGameStatusDefault(id),
      user=()=>app.store.read('UserInfo').data[0];
    try {
      await open();await push({UserPC:app.store.read('UserPC').data.map(row=>({...row,joiningState:1})),
        UserInfo:[{...user(),playerStatus:{...user().playerStatus,underPvpSP:3,underPvpSPUpdatedAt:now}}]});
      const initial=parse(await send('under_pvp/summary/get',{underPvpId:id}));
      await push({UserUnderPvPRecord:[initial.underPvpRecord]});
      if(mode.endsWith('-history') || nearby) {
        parse(await send('under_pvp/rival_list/update',{underPvpId:id,isSelectedRivalIdReset:true}));
        await push({[table]:[{...status(),updateRivalList:false,lastRivalListUpdateAt:now}]});
        const priorView=parse(await send('under_pvp/summary/get',{underPvpId:id})),
          priorBody={underPvpId:id,userId:priorView.rivalList[0].underPvpPlayerInfo.userId,rating:0,
            userParty:party,isRevenge:false,revengeStartAt:0};
        now++;const prior=parse(await send(start,priorBody)),priorInfo=app.store.read('UserUnderPvPInfo').data[0];
        await push({[table]:[{...status(),lastBattleStartAt:now}],
          UserInfo:[{...user(),processingUnderPvpState:1,playerStatus:{...user().playerStatus,underPvpSP:2}}],
          UserUnderPvPInfo:[{...priorInfo,resumeRivalUserId:priorBody.userId,resumeRating:0}],
          UserEventItem:[{userId:seed.userId,eventItemId:medalId,amount:100,cumulativeAmount:100,signature:123,readState:3}]});
        const settled=parse(await send(end,{underPvpId:id,battleId:prior.battleId,result:{isWin:false,isRetire:true}}));
        await push({UserUnderPvPRecord:[settled.underPvpRecord],UserInfo:[{...user(),processingUnderPvpState:0}]});
        assert.equal(app.store.underPvpActiveBattle(),null);
        assert.equal(app.store.underPvpRecordFloor(id).last_battle_start_at,now,'Previous timestamp comes from a real settled capture, not injected history');
        if(!nearby) now+=10;
      }
      for(let count=1;count<=(delayed?2:3);count++) {
        await push({[table]:[{...status(),updatedMatchingCount:count,executeRivalListUpdate:true}]});
        parse(await send('under_pvp/rival_list/update',{underPvpId:id,isSelectedRivalIdReset:underPvpSelectedRivalReset(status(),now)}));
        await push({[table]:[{...status(),updateRivalList:false,executeRivalListUpdate:false,lastRivalListUpdateAt:now}]});
      }
      if(mode!=='manual-only') {
        parse(await send('under_pvp/rival_list/update',{underPvpId:id,isSelectedRivalIdReset:false}));
        assert.equal(app.store.underPvpRefreshReceipt(id).observed,0,'Held no-change target is not a native observation');
      }
      const selected=parse(await send('under_pvp/summary/get',{underPvpId:id})).rivalList[0],old=status();
      await rejected({[table]:[{...old,updatedMatchingCount:delayed?3:0,lastBattleStartAt:now+1}]});
      now++;
      const body={underPvpId:id,userId:selected.underPvpPlayerInfo.userId,rating:0,userParty:party,isRevenge:false,revengeStartAt:0},
        profiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),battle=parse(await send(start,body)),
        capture=app.store.underPvpActiveBattle(),refresh=app.store.underPvpRefreshReceipt(id),
        combined={...old,updatedMatchingCount:delayed || mode==='manual-only'?3:0,lastBattleStartAt:frozen?old.lastBattleStartAt:now};
      assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profiles,'Capture never prewrites native reset or battle time');
      assert.deepEqual(capture.gameStatusBefore,old);assert.equal(capture.refresh_request_key,mode==='manual-only'?null:refresh.request_key);
      assert.equal(battle.gameStatusBefore,undefined);assert.equal(battle.refresh_request_key,undefined,'Private evidence is not publisher wire');
      await rejected({[table]:[{...combined,lastBattleStartAt:now+121}]});
      if(delayed) {
        assert.deepEqual(refresh.intent,underPvpRefreshIntent(old,id,master));
        assert.equal(refresh.manual,0);assert.equal(refresh.observed,0);
        await rejected({[table]:[{...combined,updatedMatchingCount:4}]});
        await rejected({[table]:[{...combined,lastRivalListUpdateAt:now+121}]});
        for(const bad of [null,'null',JSON.stringify({...refresh.intent,updatedMatchingCount:2})]) {
          app.store.db.prepare('UPDATE under_pvp_refresh SET possible_intent=? WHERE under_pvp_id=?').run(bad,id);
          await rejected({[table]:[combined]});
          app.store.db.prepare('UPDATE under_pvp_refresh SET possible_intent=? WHERE under_pvp_id=?').run(refresh.possible_intent,id);
        }
      }
      if(mode!=='manual-only') {
        for (const fields of [{refresh_request_key:null},{refresh_request_key:'wrong/refresh'},
          {game_status_before:JSON.stringify({...old,updatedMatchingCount:old.updatedMatchingCount-1})},
          {game_status_before:null,refresh_request_key:null}]) {
          for(const [field,value] of Object.entries(fields)) app.store.db.prepare(`UPDATE under_pvp_battle SET ${field}=? WHERE battle_id=?`).run(value,battle.battleId);
          await rejected({[table]:[combined]});
          for(const field of Object.keys(fields)) app.store.db.prepare(`UPDATE under_pvp_battle SET ${field}=? WHERE battle_id=?`).run(capture[field],battle.battleId);
        }
      } else await rejected({[table]:[{...combined,updatedMatchingCount:0}]});
      const info=app.store.read('UserUnderPvPInfo').data[0],remainingSp=user().playerStatus.underPvpSP-1,
        beforeMedal=app.store.read('UserEventItem').data.find(row=>row.eventItemId===medalId),
        earnedMedals=(beforeMedal?.cumulativeAmount ?? 0)+100,heldMedals=(beforeMedal?.amount ?? 0)+100,cost={
        [table]:[combined],UserInfo:[{...user(),processingUnderPvpState:1,playerStatus:{...user().playerStatus,underPvpSP:remainingSp}}],
        UserUnderPvPInfo:[{...info,resumeRivalUserId:body.userId,resumeRating:0}],
        UserEventItem:[{userId:seed.userId,eventItemId:medalId,amount:heldMedals,cumulativeAmount:earnedMedals,signature:123,readState:3}]};
      if(mode.endsWith('after-settlement')) {
        // DEFERRED: first earn the owned stamp/result, without observing the
        // held refresh; then recover its late callback after expiry/reopen.
        await push({...cost,[table]:[{...old,lastBattleStartAt:now}]});
        assert.equal(app.store.underPvpRefreshReceipt(id).observed,0);
        const result=parse(await send(end,{underPvpId:id,battleId:battle.battleId,result:{isWin:false,isRetire:true}}));
        await push({UserUnderPvPRecord:[result.underPvpRecord],UserInfo:[{...user(),processingUnderPvpState:0}]});
        assert.equal(app.store.underPvpActiveBattle(),null);
        const completedRow=app.store.db.prepare('SELECT * FROM under_pvp_battle WHERE battle_id=?').get(battle.battleId),
          pointer=app.store.db.prepare('SELECT * FROM under_pvp_record_state WHERE under_pvp_id=?').get(id),
          resources=JSON.stringify(['UserInfo','UserUnderPvPInfo','UserUnderPvPRecord','UserEventItem'].map(name=>app.store.read(name))),
          usage=app.store.db.prepare('SELECT * FROM under_pvp_usage WHERE under_pvp_id=? ORDER BY kind,pc_id').all(id);
        now=season.slot11;await close();await open();
        const late={...combined,lastRivalListUpdateAt:mode==='delayed-after-settlement'?now:combined.lastRivalListUpdateAt};
        await rejected({[table]:[{...combined,lastBattleStartAt:old.lastBattleStartAt}]});
        await rejected({[table]:[{...combined,lastBattleStartAt:combined.lastBattleStartAt+121}]});
        for(const fields of [{refresh_request_key:null},{refresh_request_key:'wrong/refresh'},
          {game_status_before:JSON.stringify({...old,updatedMatchingCount:old.updatedMatchingCount-1})},
          {game_status_before:null,refresh_request_key:null}]) {
          for(const [field,value] of Object.entries(fields)) app.store.db.prepare(`UPDATE under_pvp_battle SET ${field}=? WHERE battle_id=?`).run(value,battle.battleId);
          await rejected({[table]:[combined]});
          for(const field of Object.keys(fields)) app.store.db.prepare(`UPDATE under_pvp_battle SET ${field}=? WHERE battle_id=?`).run(completedRow[field],battle.battleId);
        }
        app.store.db.prepare('UPDATE under_pvp_rivals SET generation=generation+1 WHERE under_pvp_id=?').run(id);
        await rejected({[table]:[late]});
        app.store.db.prepare('UPDATE under_pvp_rivals SET generation=? WHERE under_pvp_id=?').run(refresh.generation,id);
        app.store.db.prepare('DELETE FROM under_pvp_record_state WHERE under_pvp_id=?').run(id);
        await rejected({[table]:[combined]});
        app.store.db.prepare('INSERT INTO under_pvp_record_state(under_pvp_id,battle_id,record_json) VALUES(?,?,?)')
          .run(id,pointer.battle_id,pointer.record_json);
        const recordProfile=app.store.db.prepare("SELECT * FROM profile WHERE name='UserUnderPvPRecord'").get();
        app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserUnderPvPRecord'").run('[]',md5('[]'));
        await rejected({[table]:[combined]});
        app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserUnderPvPRecord'").run(recordProfile.data,recordProfile.token);
        if(mode==='delayed-intent-after-settlement') {
          await push({[table]:[{...refresh.intent,lastBattleStartAt:combined.lastBattleStartAt}]});
          assert.equal(status().executeRivalListUpdate,true);assert.equal(app.store.underPvpRefreshReceipt(id).observed,0);
          assert.equal(app.store.underPvpRefreshReceipt(id).manual,0);
          await close();await open();
        }
        app.store.db.exec("CREATE TRIGGER fail_completed_refresh BEFORE UPDATE ON under_pvp_refresh BEGIN SELECT RAISE(ABORT,'completed refresh rollback'); END");
        await rejected({[table]:[late]});app.store.db.exec('DROP TRIGGER fail_completed_refresh');
        await push({[table]:[late]});
        const resolved=app.store.underPvpRefreshReceipt(id);
        assert.equal(resolved.observed,1);assert.equal(resolved.manual,Number(delayed));
        assert.equal(resolved.saved.updatedMatchingCount,delayed?3:0);assert.equal(resolved.saved.lastBattleStartAt,old.lastBattleStartAt);
        assert.deepEqual(resolved.requestBefore,old);assert.equal(status().lastBattleStartAt,combined.lastBattleStartAt);
        assert.equal(JSON.stringify(['UserInfo','UserUnderPvPInfo','UserUnderPvPRecord','UserEventItem'].map(name=>app.store.read(name))),resources);
        assert.deepEqual(app.store.db.prepare('SELECT * FROM under_pvp_battle WHERE battle_id=?').get(battle.battleId),completedRow);
        assert.deepEqual(app.store.db.prepare('SELECT * FROM under_pvp_record_state WHERE under_pvp_id=?').get(id),pointer);
        assert.deepEqual(app.store.db.prepare('SELECT * FROM under_pvp_usage WHERE under_pvp_id=? ORDER BY kind,pc_id').all(id),usage);
        await close();await open();await push({[table]:[late]});
        assert.equal(app.store.underPvpActiveBattle(),null);assert.equal(user().playerStatus.underPvpSP,remainingSp);
        assert.equal(app.store.read('UserEventItem').data.find(row=>row.eventItemId===medalId).cumulativeAmount,earnedMedals);
        assert.equal(app.store.operations().length,0);
        continue;
      }
      if(mode==='delayed-cost-first-nearby') {
        await push({...cost,[table]:[{...old,lastBattleStartAt:old.lastBattleStartAt}]});
        assert.equal(app.store.underPvpActiveBattle().last_battle_start_at,old.lastBattleStartAt,
          'Processing/cost proof may carry the unchanged value, but no consumer has sealed it');
        assert.equal(app.store.underPvpRefreshReceipt(id).observed,0);
        await close();await open();
        app.store.db.prepare('UPDATE under_pvp_battle SET game_status_before=NULL,refresh_request_key=NULL WHERE battle_id=?').run(battle.battleId);
        await rejected({[table]:[{...status(),lastBattleStartAt:combined.lastBattleStartAt}]});
        app.store.db.prepare('UPDATE under_pvp_battle SET game_status_before=?,refresh_request_key=? WHERE battle_id=?')
          .run(capture.game_status_before,capture.refresh_request_key,battle.battleId);
      } else if(mode==='stamp-first') {
        await push({[table]:[{...old,lastBattleStartAt:now}]});
        assert.equal(status().updatedMatchingCount,3);assert.equal(app.store.underPvpActiveBattle().last_battle_start_at,now);
        await close();await open();await push({[table]:[combined]});
      } else if(mode==='reset-first') {
        await push({[table]:[{...old,updatedMatchingCount:0}]});
        assert.equal(app.store.underPvpActiveBattle().last_battle_start_at,0,'Refresh reset is not battle timestamp proof');
        await close();await open();await push({[table]:[combined]});
      } else if(mode==='delayed-stamp-first') {
        await push({...cost,[table]:[{...old,lastBattleStartAt:now}]});
        assert.equal(status().updatedMatchingCount,2);assert.equal(app.store.underPvpActiveBattle().last_battle_start_at,now);
        assert.equal(app.store.underPvpRefreshReceipt(id).observed,0,'A pure stamp does not observe an unchanged refresh target');
        assert.equal(app.store.underPvpRefreshReceipt(id).manual,0);
        await close();await open();
      } else if(mode.startsWith('delayed-counter-first')) {
        await push({[table]:[{...combined,lastBattleStartAt:old.lastBattleStartAt}]});
        assert.equal(app.store.underPvpActiveBattle().last_battle_start_at,0);
        assert.equal(app.store.underPvpRefreshReceipt(id).manual,1);assert.equal(app.store.underPvpRefreshReceipt(id).observed,1);
        assert.deepEqual(app.store.underPvpRefreshReceipt(id).requestBefore,old);
        await close();await open();
      } else if(mode.startsWith('delayed-intent-first') || mode==='delayed-intent-stamp') {
        const intent=mode==='delayed-intent-stamp'?{...refresh.intent,lastBattleStartAt:now}:refresh.intent;
        await push({[table]:[intent]});
        assert.equal(status().updatedMatchingCount,3);assert.equal(status().executeRivalListUpdate,true);
        assert.equal(app.store.underPvpRefreshReceipt(id).manual,0);assert.equal(app.store.underPvpRefreshReceipt(id).observed,0);
        assert.deepEqual(app.store.underPvpRefreshReceipt(id).saved,old,'Held target stays unresolved after intent alone');
        assert.equal(app.store.underPvpActiveBattle().last_battle_start_at,mode==='delayed-intent-stamp'?now:0);
        await close();await open();
      }
      if(mode==='combined' || delayed) {
        app.store.db.exec("CREATE TRIGGER fail_handoff BEFORE UPDATE ON under_pvp_battle BEGIN SELECT RAISE(ABORT,'handoff rollback'); END");
        await rejected(cost);app.store.db.exec('DROP TRIGGER fail_handoff');
      }
      await push(cost);assert.equal(status().lastBattleStartAt,combined.lastBattleStartAt);assert.equal(status().updatedMatchingCount,delayed || mode==='manual-only'?3:0);
      assert.equal(app.store.underPvpRefreshReceipt(id).saved.lastBattleStartAt,old.lastBattleStartAt,
        'Private refresh target owns only callback changes; native battle stamp stays independently captured');
      if(delayed) {
        const resolved=app.store.underPvpRefreshReceipt(id);
        assert.equal(resolved.manual,1);assert.equal(resolved.observed,1);assert.equal(resolved.saved.updatedMatchingCount,3);
        assert.deepEqual(resolved.requestBefore,old);assert.deepEqual(resolved.before,refresh.intent);
        await rejected({[table]:[{...combined,updatedMatchingCount:0}]});
        await rejected({[table]:[{...combined,updatedMatchingCount:4,executeRivalListUpdate:true}]});
        if(!frozen) {
          await rejected({[table]:[{...combined,lastBattleStartAt:old.lastBattleStartAt}]});
          await rejected({[table]:[{...combined,lastBattleStartAt:combined.lastBattleStartAt+1}]});
        }
      }
      assert.deepEqual(app.store.underPvpActiveBattle().observed,['info','medal','processing','sp','status']);
      if(mode==='delayed-restart-sealed-nearby') {
        parse(await send(restart,{underPvpId:id,userId:body.userId,rating:0,isRevenge:false,revengeStartAt:0,
          lastBattleStartAt:combined.lastBattleStartAt}));
        await rejected({[table]:[{...combined,lastBattleStartAt:now}]});
      } else if(mode==='delayed-result-sealed-nearby') {
        parse(await send(end,{underPvpId:id,battleId:battle.battleId,result:{isWin:false,isRetire:true}}));
        await rejected({[table]:[{...combined,lastBattleStartAt:now}]});
      }
      await close();await open();
      if(mode!=='delayed-result-sealed-nearby') {
        const resumed=parse(await send(restart,{underPvpId:id,userId:body.userId,rating:0,isRevenge:false,revengeStartAt:0,
          lastBattleStartAt:combined.lastBattleStartAt}));
        assert.equal(resumed.battleId,battle.battleId);
      }
      assert.equal(user().playerStatus.underPvpSP,remainingSp);
      if(frozen) await rejected({[table]:[{...combined,lastBattleStartAt:now}]});
      const result=parse(await send(end,{underPvpId:id,battleId:battle.battleId,result:{isWin:false,isRetire:true}}));
      await push({UserUnderPvPRecord:[result.underPvpRecord],UserInfo:[{...user(),processingUnderPvpState:0}]});
      assert.equal(app.store.underPvpActiveBattle(),null);
      assert.equal(app.store.underPvpRecordFloor(id).after.loseCount,battle.underPvpRecord.loseCount+1);
      assert.equal(app.store.read('UserEventItem').data.find(row=>row.eventItemId===medalId).cumulativeAmount,earnedMedals);
      assert.equal(app.store.operations().length,0);
    } finally {await close();}
  }
}
if(require.main===module) main().then(refreshHandoff).catch(error=>{ console.error(error);process.exitCode=1; });
