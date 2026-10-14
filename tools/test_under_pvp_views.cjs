'use strict';

// DEFERRED / NOT RUN. Synthetic source/wire/SQLite checks are not MuMu
// acceptance, natural unlock proof, a native CPU vector capture or combat.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const { createServer,OFFLINE_UNAVAILABLE_CODE }=require('./danmemore_server.cjs');
const { request }=require('./test_danmemore_server.cjs');
const { underPvpRecord,underPvpCpuParty,underPvpCpuRivals,underPvpGameStatuses,underPvpCpuDetails,
  underPvpSelectedRivalReset }=require('./under_pvp.cjs');
const master=require('../data/danmemore-master.json'),seed=require('../data/danmemore-seed.json');
const md5=text=>crypto.createHash('md5').update(text).digest('hex');
const summary='under_pvp/summary/get',refresh='under_pvp/rival_list/update';
const details='under_pvp/player_info/get',usage='under_pvp/character/ranking/get';
const id=69000000001,season=master.underPvp.underPvpInformation[id];
const status=underPvpId=>({ userId:0,underPvpId,updatedMatchingCount:0,updateRivalList:true,
  lastRivalListUpdateAt:0,executeRivalListUpdate:false,lastBattleStartAt:0 });

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-under-pvp-views-'));
  const database=path.join(directory,'save.sqlite');let app,port,sequence=0,now=season.slot8;
  const open=async()=>{ app=createServer({ database,seed,master,wallNowSeconds:()=>now,log:()=>{} });
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port; };
  const close=async()=>{ if(app){ await app.close();app=null; } };
  const send=(action,body)=>request(port,++sequence,body,String(sequence),action);
  const parse=reply=>{ assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body); };
  const view=(body={ underPvpId:id })=>send(summary,body);
  const update=reset=>send(refresh,{ underPvpId:id,isSelectedRivalIdReset:reset });
  const dateReset=()=>underPvpSelectedRivalReset(app.store.read('UserUnderPvPGameStatus').data.find(row=>row.underPvpId===id),now);
  const put=(name,rows)=>{ const data=JSON.stringify(rows);app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(data,md5(data),name); };
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const unchanged=async(action,body,expected=503)=>{ const before=snapshot(),reply=await send(action,body);
    assert.equal(reply.status,expected,reply.body.toString());if(expected===503)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Unavailable/conflicting requests preserve the complete database'); };
  const push=putItems=>send('user_data/push',{ badges:null,scripts:{},dataTokens:{},operations:[],
    checksums:{ before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(JSON.stringify(rows))])) },
    deltas:[{ signature:0,trigger:'UpdateUnderPvpState',putItems,deleteItems:{} }] });
  try {
    const fresh=underPvpRecord([],id,master,seed.userId);
    assert.equal(fresh.gradeId,69200010000);assert.equal(fresh.score,0);assert.equal(fresh.isReceiveReward,true);
    for (const gradeId of [69200010000,69200010001,69200010002,69200010003]) for (const generation of [0,1,23])
      for (const rival of underPvpCpuRivals({ ...fresh,gradeId,highestGradeId:gradeId },generation,master)) {
        const profile=underPvpCpuDetails(rival,master),favorite=master.communicationCharacters[profile.playerInfo.favoriteCharacterId];
        assert.equal(profile.playerInfo.userId,rival.underPvpPlayerInfo.userId);
        assert.equal(profile.playerInfo.name,rival.underPvpPlayerInfo.name);
        assert.ok(favorite);assert.equal(master.characterCostumes[profile.playerInfo.favoriteCharacterCostumeId].characterKey,
          master.characters[favorite.characterId].key);
        assert.deepEqual(Object.keys(profile.pvpParty).sort(),['attackPattern','memoriaSlots','slots','userId']);
        assert.deepEqual(profile.pvpParty.slots,rival.underPvpParty.slots);
        assert.deepEqual(profile.underPvpRecord,[]);assert.deepEqual(profile.substitutedSpineIds,[]);
        assert.equal(profile.userAdventureLevelInfo,undefined);
        assert.equal(profile.playerInfo.totalStatusPoint,rival.underPvpParty.slots.flatMap(slot=>[slot.pc,slot.assistingPc])
          .filter(Boolean).reduce((sum,pc)=>sum+['strength','intelligence','agility','vitality','luck'].reduce((n,key)=>n+pc[key],0),0));
      }
    for (const characterId of [101000015,101000008]) {
      const pcId=Number(Object.keys(master.pcProfiles).find(key=>master.pcProfiles[key].characterId===characterId)),
        rival=structuredClone(underPvpCpuRivals(fresh,0,master)[0]);
      rival.underPvpPlayerInfo.leaderPcId=pcId;
      const profile=underPvpCpuDetails(rival,master);
      assert.equal(profile.playerInfo.favoriteCharacterId,100000001);
      assert.match(profile.playerInfo.description,/Bell portrait placeholder/);
    }
    for(const partyId of Object.keys(master.underPvp.dummyUnderPvpParty).map(Number)) {
      const party=underPvpCpuParty(partyId,master);assert.equal(party.userId,partyId);assert.equal(party.partyType,7);
      assert.equal(party.slots.length,6);assert.deepEqual(party.memoriaSlots,[]);
      assert.ok(party.slots.every(slot=>slot.pc && slot.pc.hp>0 && slot.pc.weaponAbilityIds.length===0));
    }
    for(const gradeId of Object.keys(master.underPvp.underPvpGrade).map(Number)) for(const generation of [0,1,23]) {
      const rivals=underPvpCpuRivals({ ...fresh,gradeId,highestGradeId:gradeId },generation,master);
      assert.deepEqual(rivals.map(row=>row.rating),[0,1,2]);
      assert.equal(new Set(rivals.map(row=>row.underPvpPlayerInfo.userId)).size,3);
      assert.ok(rivals.every(row=>row.underPvpPlayerInfo.isDummy && row.underPvpPlayerInfo.name.endsWith('[Offline CPU]')));
      for (const rival of rivals) {
        const original=master.underPvp.dummyUnderPvpParty[rival.underPvpPlayerInfo.userId];
        assert.deepEqual(rival.underPvpParty,underPvpCpuParty(rival.underPvpPlayerInfo.userId,master));
        assert.equal(rival.underPvpPlayerInfo.gradeId,original.slot2);
        assert.equal(rival.underPvpPlayerInfo.score,original.slot4);
        if (master.underPvp.underPvpGrade[gradeId].slot7>3) {
          assert.equal(original.slot2,69200010003,'Higher tiers reuse the highest authored grade without scaling or relabelling it');
          assert.match(underPvpCpuDetails(rival,master).playerInfo.description,/higher tiers reuse archived lower-grade teams/);
        }
      }
    }
    const emptyCpu=structuredClone(master);emptyCpu.underPvp.dummyUnderPvpParty={};
    emptyCpu.underPvp.underPvpTutorialDummyPartyGroup={};
    assert.throws(()=>underPvpCpuRivals(fresh,0,emptyCpu),/No original CPU party/);
    assert.equal(underPvpGameStatuses([status(id)],master,seed.userId).size,1);
    assert.throws(()=>underPvpGameStatuses([status(id),status(id)],master,seed.userId),/reconciliation/);
    assert.throws(()=>underPvpGameStatuses([{ ...status(id),userId:seed.userId+1 }],master,seed.userId),/reconciliation/);
    await open();const profiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
    assert.deepEqual(parse(await send(usage,{ underPvpId:id })),{ code:0,normal:[],assist:[] });
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM under_pvp_rivals').get().n,0,
      'An empty-history read is not matching or a phantom CPU snapshot');
    await unchanged(details,{ userId:seed.userId });
    await unchanged(details,{ userId:69910201002 });
    for(const [seasonId,row] of Object.entries(master.underPvp.underPvpInformation)) {
      now=row.slot8;const response=parse(await view({ underPvpId:Number(seasonId) }));
      assert.equal(response.underPvpRecord.underPvpId,Number(seasonId));assert.equal(response.result,0);
      assert.equal(response.rivalList.length,3);assert.deepEqual(response.underPvpRanking,[]);
    }
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profiles,
      'Views/CPU initialization do not pre-credit any native profile');
    now=season.slot8+100;
    const first=await view(),identity=sequence,initial=parse(first);
    const cpuId=initial.rivalList[0].underPvpPlayerInfo.userId,profileReply=await send(details,{ userId:cpuId }),profileIdentity=sequence;
    assert.deepEqual(parse(profileReply),{ code:0,...underPvpCpuDetails(initial.rivalList[0],master) });
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profiles);
    await unchanged(details,{ userId:seed.userId+1 });
    for (const body of [null,{ targetUserId:cpuId },{ userId:'1' },{ userId:0 },{ userId:cpuId,underPvpId:id }])
      await unchanged(details,body,400);
    for (const body of [null,{ underPvpId:id,userId:seed.userId },{ underPvpId:String(id) }]) await unchanged(usage,body,400);
    parse(await request(port,identity,{ underPvpId:id },String(identity),summary));
    await close();await open();assert.deepEqual(parse(await view()).rivalList,initial.rivalList);
    app.store.db.exec('DELETE FROM reply_cache');
    assert.deepEqual((await request(port,profileIdentity,{ userId:cpuId },String(profileIdentity),details)).body,profileReply.body);
    const profileBefore=snapshot(),profileSpoof=await request(port,profileIdentity,{ userId:initial.rivalList[1].underPvpPlayerInfo.userId },
      String(profileIdentity),details,{ 'X-ARGO-REQUEST-BODY-HASH':profileReply.headers['x-argo-request-body-hash'] });
    assert.equal(profileSpoof.status,400);assert.equal(snapshot(),profileBefore);
    parse(await update(true));const generation=app.store.db.prepare('SELECT generation FROM under_pvp_rivals WHERE under_pvp_id=?').get(id).generation;
    const after=parse(await view());assert.notDeepEqual(after.rivalList,initial.rivalList);
    const changedProfiles=snapshot(),oldProfile=await request(port,profileIdentity,{ userId:cpuId },String(profileIdentity),details);
    assert.equal(oldProfile.status,503);assert.equal(JSON.parse(oldProfile.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),changedProfiles,'New matching cannot revive an old CPU profile');
    parse(await push({UserUnderPvPGameStatus:[{...status(id),updateRivalList:false,lastRivalListUpdateAt:now}]}));
    const refreshReply=await update(false),refreshIdentity=sequence;parse(refreshReply);
    assert.deepEqual((await request(port,refreshIdentity,{ underPvpId:id,isSelectedRivalIdReset:false },String(refreshIdentity),refresh)).body,refreshReply.body);
    assert.equal(app.store.db.prepare('SELECT generation FROM under_pvp_rivals WHERE under_pvp_id=?').get(id).generation,generation+1);
    app.store.db.exec('DELETE FROM reply_cache');const before=snapshot();
    const obsolete=await request(port,identity,{ underPvpId:id },String(identity),summary);
    assert.equal(obsolete.status,503);assert.equal(JSON.parse(obsolete.body).code,OFFLINE_UNAVAILABLE_CODE);assert.equal(snapshot(),before);
    const spoof=await request(port,refreshIdentity,{ underPvpId:id,isSelectedRivalIdReset:true },String(refreshIdentity),refresh,
      { 'X-ARGO-REQUEST-BODY-HASH':refreshReply.headers['x-argo-request-body-hash'] });
    assert.equal(spoof.status,400);assert.equal(snapshot(),before);
    const record=initial.underPvpRecord,other={ ...record,underPvpId:69000000002 };
    parse(await push({ UserUnderPvPRecord:[record] }));parse(await push({ UserUnderPvPRecord:[other] }));
    assert.equal(app.store.read('UserUnderPvPRecord').data.length,2,'Shared grade never merges different seasons');
    assert.deepEqual(parse(await send(usage,{ underPvpId:id })),{ code:0,normal:[],assist:[] });
    const usageIdentity=sequence,usageBefore=snapshot();
    put('UserUnderPvPRecord',[{ ...record,loseCount:1 },other]);
    await unchanged(usage,{ underPvpId:id });
    const playedSnapshot=snapshot(),playedRetry=await request(port,usageIdentity,{ underPvpId:id },String(usageIdentity),usage);
    assert.equal(playedRetry.status,503);assert.equal(snapshot(),playedSnapshot);
    put('UserUnderPvPRecord',[record,other]);assert.equal(snapshot(),usageBefore);
    // Synthetic native-shaped local snapshot only. NOT engine stat proof.
    const nativeProfiles=Object.fromEntries(['UserProfile','UserPvPParty','UserParty'].map(name=>[name,app.store.read(name).data]));
    const pcId=seed.data.UserPC[0].pcId;
    const unit=id=>({ pcId:id,level:id?1:0,currentJobIndex:id?1:0,limitbreakCount:0,usableSkillAmount:0,
      strength:0,intelligence:0,agility:0,vitality:0,luck:0,hp:id?100:0,mp:id?16:0,physicalAttackPower:0,magicAttackPower:0,
      defensePower:0,weaponId:0,armorId:0,weaponAbilityIds:[],armorAbilityIds:[],heroSublimateLevel:0,isUnlockedHeroSublimate:false });
    const localParty={ userId:seed.userId,attackPattern:2,slots:Array.from({ length:6 },(_,index)=>({ slotNumber:index+1,
      pc:unit(index?0:pcId),assistingPc:unit(0),isHidden:false,commandFlow:'' })),memoriaSlots:[] };
    put('UserProfile',nativeProfiles.UserProfile.map(row=>({ ...row,favoriteCommunicationCharacterId:100000001 })));
    put('UserPvPParty',[localParty]);put('UserParty',nativeProfiles.UserParty.map(row=>row.id!==320 ? row : { ...row,
      slots:row.slots.map((slot,index)=>({ ...slot,pcId:index?0:pcId,assistingPcId:0 })) }));
    const localReply=await send(details,{ userId:seed.userId }),localIdentity=sequence,local=parse(localReply);
    assert.deepEqual(local.pvpParty,localParty);assert.deepEqual(local.underPvpRecord,[record,other]);
    assert.equal(local.playerInfo.favoriteCharacterId,100000001);assert.equal(local.playerInfo.favoriteCharacterCostumeId,1021001000);
    assert.equal(local.pvbParty,undefined);assert.equal(local.underPvpParty,undefined);assert.equal(local.userAdventureLevelInfo,undefined);
    assert.equal(app.store.db.prepare('SELECT under_pvp_id FROM under_pvp_view_request WHERE request_key=?')
      .get(`${localIdentity}/${localIdentity}`).under_pvp_id,0,'Local profile receipt cannot imply a CPU snapshot');
    const originalInfo=app.store.read('UserInfo').data;
    put('UserInfo',[{ ...originalInfo[0],name:'Changed local name' }]);
    const changedName=snapshot(),oldLocal=await request(port,localIdentity,{ userId:seed.userId },String(localIdentity),details);
    assert.equal(oldLocal.status,503);assert.equal(snapshot(),changedName);
    assert.equal(parse(await send(details,{ userId:seed.userId })).playerInfo.name,'Changed local name');
    put('UserInfo',originalInfo);
    put('UserPvPParty',[{ ...localParty,slots:localParty.slots.slice(1) }]);await unchanged(details,{ userId:seed.userId });
    for(const [name,rows] of Object.entries(nativeProfiles)) put(name,rows);
    const savedStatus=app.store.read('UserUnderPvPGameStatus').data.find(row=>row.underPvpId===id) ?? status(id);
    parse(await push({ UserUnderPvPGameStatus:[savedStatus] }));parse(await push({ UserUnderPvPGameStatus:[status(other.underPvpId)] }));
    assert.equal(app.store.read('UserUnderPvPGameStatus').data.length,2,'Lazy owner0 is retained, keyed by season');
    const saved=snapshot(),invalid=await push({ UserUnderPvPRecord:[record,record] });assert.equal(invalid.status,400);assert.equal(snapshot(),saved);
    for(const body of [{ underPvpId:'1' },{ underPvpId:id,extra:0 },{ underPvpId:id,userId:0 }]) await unchanged(summary,body,400);
    await unchanged(summary,{ underPvpId:id,userId:seed.userId+1 });
    for(const reset of [0,'true',null]) await unchanged(refresh,{ underPvpId:id,isSelectedRivalIdReset:reset },400);
    const info=app.store.read('UserUnderPvPInfo').data;put('UserUnderPvPInfo',[{ ...info[0],resumeRivalUserId:69910201002 }]);
    await unchanged(summary,{ underPvpId:id });await unchanged(refresh,{ underPvpId:id,isSelectedRivalIdReset:true });
    await unchanged(details,{ userId:cpuId });await unchanged(usage,{ underPvpId:id });put('UserUnderPvPInfo',info);
    const statuses=app.store.read('UserUnderPvPGameStatus').data;put('UserUnderPvPGameStatus',statuses.map(row=>row.underPvpId===id ? { ...row,lastBattleStartAt:now } : row));
    await unchanged(summary,{ underPvpId:id });await unchanged(details,{ userId:cpuId });await unchanged(usage,{ underPvpId:id });
    put('UserUnderPvPGameStatus',statuses);
    for(const time of [season.slot10-1,season.slot11]) {
      now=time;await unchanged(summary,{ underPvpId:id });await unchanged(details,{ userId:cpuId });await unchanged(usage,{ underPvpId:id });
    }
    const displayProfiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
      displayWallet=app.store.hardCurrency(),displayQueue=app.store.operations();
    for(const time of [season.slot9,season.slot9+1,season.slot11-1]) {
      now=time;const displayed=parse(await view()),displaySequence=sequence;
      assert.deepEqual(displayed.underPvpRecord,record);assert.deepEqual(displayed.underPvpRanking,[]);
      assert.deepEqual(parse(await send(usage,{underPvpId:id})),{code:0,normal:[],assist:[]});
      const displayCpu=displayed.rivalList[0];
      assert.deepEqual(parse(await send(details,{userId:displayCpu.underPvpPlayerInfo.userId})),
        {code:0,...underPvpCpuDetails(displayCpu,master)});
      assert.deepEqual(parse(await request(port,displaySequence,{underPvpId:id},String(displaySequence),summary)),displayed);
      await unchanged(refresh,{underPvpId:id,isSelectedRivalIdReset:true});
      await unchanged(summary,{underPvpId:69000000002});
    }
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),displayProfiles,
      'Display-phase reads cannot reset scores/SP/flags, publish a rank or grant a prize');
    assert.equal(app.store.hardCurrency(),displayWallet);assert.deepEqual(app.store.operations(),displayQueue);
    now=season.slot9-1;parse(await view());
    const current=app.store.db.prepare('SELECT * FROM under_pvp_rivals WHERE under_pvp_id=?').get(id);
    app.store.db.prepare('UPDATE under_pvp_rivals SET rivals_json=? WHERE under_pvp_id=?').run('[]',id);
    await unchanged(summary,{ underPvpId:id });await unchanged(details,{ userId:cpuId });await unchanged(usage,{ underPvpId:id });
    app.store.db.prepare('UPDATE under_pvp_rivals SET rivals_json=? WHERE under_pvp_id=?').run(current.rivals_json,id);
    app.store.db.exec("CREATE TRIGGER fail_under_view BEFORE INSERT ON under_pvp_view_request BEGIN SELECT RAISE(ABORT,'rival receipt rollback'); END");
    const rollback=snapshot();assert.equal((await update(dateReset())).status,503);assert.equal(snapshot(),rollback);
    await unchanged(details,{ userId:JSON.parse(current.rivals_json)[0].underPvpPlayerInfo.userId });
    await unchanged(usage,{ underPvpId:id });
    app.store.db.exec('DROP TRIGGER fail_under_view');
    for(const table of ['under_pvp_rivals','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_under_${table} BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'rival snapshot/reply rollback'); END`);
      const rollback=snapshot();assert.equal((await update(dateReset())).status,503);assert.equal(snapshot(),rollback);
      if (table==='reply_cache') {
        await unchanged(details,{ userId:JSON.parse(current.rivals_json)[0].underPvpPlayerInfo.userId });
        await unchanged(usage,{ underPvpId:id });
      }
      app.store.db.exec(`DROP TRIGGER fail_under_${table}`);
    }
    const currentCpuId=JSON.parse(current.rivals_json)[0].underPvpPlayerInfo.userId;
    const receiptReply=await send(details,{ userId:currentCpuId }),receiptId=sequence;parse(receiptReply);
    const receipt=app.store.db.prepare('SELECT * FROM under_pvp_view_request WHERE request_key=?').get(`${receiptId}/${receiptId}`);
    for (const [field,corrupt] of [['response','{}'],['record_identity','[]']]) {
      app.store.db.prepare(`UPDATE under_pvp_view_request SET ${field}=? WHERE request_key=?`).run(corrupt,receipt.request_key);
      const before=snapshot(),reply=await request(port,receiptId,{ userId:currentCpuId },String(receiptId),details);
      assert.equal(reply.status,503);assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);assert.equal(snapshot(),before);
      app.store.db.prepare(`UPDATE under_pvp_view_request SET ${field}=? WHERE request_key=?`).run(receipt[field],receipt.request_key);
    }
    app.store.db.prepare('DELETE FROM under_pvp_view_request WHERE request_key=?').run(receipt.request_key);
    const missingReceipt=snapshot(),legacy=await request(port,receiptId,{ userId:currentCpuId },String(receiptId),details);
    assert.equal(legacy.status,503);assert.equal(snapshot(),missingReceipt,'Cached details require their retained permanent identity');
    app.store.db.prepare('DELETE FROM under_pvp_rivals WHERE under_pvp_id=?').run(id);
    await unchanged(summary,{ underPvpId:id });await unchanged(details,{ userId:currentCpuId });await unchanged(usage,{ underPvpId:id });
    await unchanged('under_pvp/battle/start',{ underPvpId:id },400);await unchanged('under_pvp/battle/end',{ underPvpId:id },400);
    assert.equal(app.store.operations().length,0);assert.equal(JSON.stringify(app.store.read('UserUnderPvPInfo').data),JSON.stringify(info));
  } finally { await close(); }
  console.log('Offline Under Telskyura view source checks completed; NOT native combat/acceptance proof. Fixtures retained at '+directory);
}
if(require.main===module) main().catch(error=>{ console.error(error);process.exitCode=1; });
module.exports={ main };
