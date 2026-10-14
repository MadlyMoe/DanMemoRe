'use strict';

// DEFERRED / NOT RUN. Synthetic party stats/save signatures are prerequisites,
// NOT native eligibility, combat vectors, constructor, ACK ordering or UI proof.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const {initialRecord,serialPvpSpStatus}=require('./serial_pvp.cjs');
const master=require('../data/danmemore-master.json'),seed=require('./test_serial_pvp_lobby.cjs').unlockedSeed();
const id=81000000001,season=master.serialPvp.serialPvpInformation[id],gradeId=81200010000;
const start='serial_pvp/battle/start',restart='serial_pvp/battle/restart',select='serial_pvp/grade/select';
const md5=value=>crypto.createHash('md5').update(value).digest('hex');
const unit=pcId=>({pcId,level:pcId?1:0,currentJobIndex:pcId?1:0,limitbreakCount:0,usableSkillAmount:0,
  strength:0,intelligence:0,agility:0,vitality:0,luck:0,hp:pcId?100:0,mp:pcId?16:0,
  physicalAttackPower:0,magicAttackPower:0,defensePower:0,weaponId:0,armorId:0,weaponAbilityIds:[],armorAbilityIds:[],
  heroSublimateLevel:0,isUnlockedHeroSublimate:false,attackPattern:0,currentDP:0,unlockedAdditionalAbilityAmount:0,hasAllStatusBoardOpened:false});
const savedParty=seed.data.UserParty.find(row=>row.id===seed.data.UserInfo[0].activeSerialPvpPartyId);
const party={userId:seed.userId,partyType:9,index:0,attackPattern:savedParty.attackPattern,partyStrength:0,
  slots:savedParty.slots.map(row=>({slotNumber:row.slotNumber,pc:unit(row.pcId),assistingPc:unit(row.assistingPcId),
    commandFlow:row.commandFlow,isHidden:false})),memoriaSlots:[]};

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-abyss-battle-'));
  let database=path.join(directory,'save.sqlite'),app,port,sequence=0,now=season.slot3+100;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const delta=(putItems={},operations=[])=>({badges:null,scripts:{},dataTokens:{},operations,
    checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(JSON.stringify(rows))]))},
    deltas:Object.keys(putItems).length?[{signature:0,trigger:'UpdateSerialPvpState',putItems,deleteItems:{}}]:[]});
  const push=(items,operations)=>send('user_data/push',delta(items,operations));
  const rejected=async(action,value,status=503)=>{const before=snapshot(),reply=await send(action,value);
    assert.equal(reply.status,status,reply.body.toString());if(status===503)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Cancelled requests must retain profiles, queue, identities and observations');};
  const user=()=>structuredClone(app.store.read('UserInfo').data[0]);
  const acknowledge=operation=>[{id:operation.id,verifier:'fixture-verifier'}];
  const prepare=async()=>{
    const lobby=parse(await send(select,{serialPvpId:id,gradeId})),saved=app.store.serialPvp.state(id),info=user();
    Object.assign(info.playerStatus,{serialPvpSP:4,serialPvpSPUpdatedAt:now});
    parse(await push({UserSerialPvpGameStatus:[saved.after.UserSerialPvpGameStatus],
      UserSerialPvpUsingLimitData:[saved.after.UserSerialPvpUsingLimitData],UserInfo:[info]}));
    return {serialPvpId:id,userId:lobby.rivalList[2].serialPvpPlayerInfo.userId,userParty:party,partyIndex:1};
  };
  try {
    await open();await rejected(start,{serialPvpId:id,userId:1,userParty:party,partyIndex:1});
    const body=await prepare(),resume={serialPvpId:id,userId:body.userId};
    const matchingNow=now;now=season.slot4;
    const postMatchProfiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
    assert.equal(parse(await send('serial_pvp/summary/get',{serialPvpId:id})).selectedGradeId,gradeId);
    await rejected(start,body);await rejected(select,{serialPvpId:id,gradeId});
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),postMatchProfiles);
    now=matchingNow; // Readable summary must NEVER reopen a real saved, unplayed run.
    await rejected(start,{...body,partyIndex:0},400);await rejected(start,{...body,userParty:{...party,partyType:7}},400);
    await rejected(start,{...body,userId:seed.userId});await rejected(restart,resume);
    for(const table of ['operation_queue','serial_pvp_battle','serial_pvp_active','serial_pvp_battle_request','reply_cache']) {
      const before=snapshot();app.store.db.exec(`CREATE TEMP TRIGGER abyss_battle_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
      assert.ok((await send(start,body)).status>=500);assert.equal(snapshot(),before);
      app.store.db.exec('DROP TRIGGER abyss_battle_fail');
    }
    const profiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),sp=serialPvpSpStatus(user().playerStatus);
    const first=await send(start,body),firstSequence=sequence,result=parse(first),operation=result.operation;
    assert.match(result.battleId,/^abyss-/);assert.equal(operation.type,30200);assert.equal(result.operations.length,1);
    const {operation:unused,operations:unusedList,...base}=result;
    assert.deepEqual(operation.parameters,base,'Shared hot transport must forward the actual direct callback fields');
    assert.deepEqual(result.serialPvpParty,app.store.serialPvp.state(id).rivals[2].serialPvpParty);
    assert.ok(Array.isArray(result.serialPvpRecord));assert.equal(result.selectedGradeId,gradeId);
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profiles,'No native precredit or second SP spend');
    assert.deepEqual(parse(await send(start,body)),result,'Untouched fresh-identity retries retain battle, seed, CPU and30200');
    await rejected('serial_pvp/summary/get',{serialPvpId:id});await rejected(select,{serialPvpId:id,gradeId});
    await rejected('currency/hard/consume',{consumeId:81071001});await rejected('user_data/pull',{tables:['UserParty']});
    await rejected('user_data/push',delta({},acknowledge(operation)));
    await close();await open();app.store.db.exec('DELETE FROM reply_cache');
    assert.deepEqual((await request(port,firstSequence,body,String(firstSequence),start)).body,first.body);
    const processing={...user(),processingSerialPvpState:1};
    // Observe just one operation effect; cold/hot redelivery must not restart it.
    const savedFirst=parse(await push({UserInfo:[processing]}));assert.equal(savedFirst.operations.some(row=>row.id===operation.id),false);
    assert.equal(app.store.operations().length,1,'Suppressing a callback is NOT acknowledging or dropping its queue');
    await rejected(start,body);await rejected(restart,resume);await rejected('user_data/confirm',undefined);
    const stale=await request(port,firstSequence,body,String(firstSequence),start);assert.equal(stale.status,503);
    await rejected('user_data/push',delta({UserInfo:[{...user(),processingSerialPvpState:0}]}));
    await rejected('user_data/push',delta({UserSerialPvpInfo:[{userId:seed.userId,resumeRivalUserId:body.userId+1}]}));
    const status=structuredClone(app.store.read('UserSerialPvpGameStatus').data[0]);status.updateRivalList=true;
    const opEffects={UserSerialPvpInfo:[{resumeRivalUserId:body.userId,userId:seed.userId}],UserSerialPvpGameStatus:[status]};
    for(const table of ['profile','serial_pvp_battle','reply_cache']) {
      const before=snapshot(),event=table==='reply_cache'?'INSERT':'UPDATE';
      app.store.db.exec(`CREATE TEMP TRIGGER abyss_battle_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
      assert.ok((await push(opEffects)).status>=500);assert.equal(snapshot(),before);app.store.db.exec('DROP TRIGGER abyss_battle_fail');
    }
    parse(await push(opEffects));await close();await open();
    // ACK is valid BEFORE the direct callback timestamp, because30200 itself never stamps it.
    for(const table of ['operation_done','reply_cache']) {
      const before=snapshot();app.store.db.exec(`CREATE TEMP TRIGGER abyss_battle_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
      assert.ok((await push({},acknowledge(operation))).status>=500);assert.equal(snapshot(),before);app.store.db.exec('DROP TRIGGER abyss_battle_fail');
    }
    parse(await push({},acknowledge(operation)));assert.equal(app.store.operations().length,0);
    await rejected(restart,resume);await rejected('user_data/pull',{tables:['UserInfo']});
    const stamped={...status,lastBattleStartAt:now+2};now=season.slot6;
    parse(await push({UserSerialPvpGameStatus:[stamped],UserSerialPvpRecord:[initialRecord(id)]}));
    assert.equal(app.store.serialPvp.activeBattle().last_battle_start_at,stamped.lastBattleStartAt,'Exact issued native saves survive a changed event date');
    await rejected(restart,resume);now=season.slot4+1;
    assert.ok(now<season.slot6,'Original matching closes before display/resume');
    const resumed=parse(await send(restart,resume)),resumeSequence=sequence;
    assert.deepEqual(resumed,base);assert.equal(resumed.operation,undefined);
    assert.deepEqual(serialPvpSpStatus(user().playerStatus),sp,'Resume neither spends SP nor changes its timer');
    assert.deepEqual((await request(port,resumeSequence,resume,String(resumeSequence),restart)).body,Buffer.from(JSON.stringify(base)));
    await close();await open();app.store.db.exec('DELETE FROM reply_cache');
    assert.deepEqual(parse(await send(restart,resume)),base);
    assert.equal((await send('user_data/pull',{tables:['UserInfo','UserSerialPvpInfo','UserSerialPvpGameStatus']})).status,200);
    await rejected(restart,{...resume,userId:resume.userId+1});
    await rejected('user_data/push',delta({UserInfo:[{...user(),processingSerialPvpState:2}]}));
    await rejected('user_data/push',delta({UserSerialPvpGameStatus:[{...stamped,lastBattleStartAt:stamped.lastBattleStartAt+1}]}));
    await rejected('user_data/push',delta({UserSerialPvpInfo:[{userId:seed.userId,resumeRivalUserId:0}]}));
    await rejected('user_data/push',delta({UserInfo:[{...user(),activeSerialPvpPartyId:331}]}));
    await rejected('serial_pvp/battle/end',{serialPvpId:id,battleId:result.battleId,result:{isWin:true,isRetire:false}},400);
    for(const sql of ['UPDATE serial_pvp_battle SET catalog_hash=\'broken\'','DELETE FROM serial_pvp_active']) {
      const masterHash=app.store.db.prepare('SELECT catalog_hash FROM serial_pvp_battle').get().catalog_hash;
      // Keep each injected corruption and its recovery confined to this temporary database.
      app.store.db.exec(sql);await rejected(restart,resume);
      if(sql.startsWith('UPDATE'))app.store.db.prepare('UPDATE serial_pvp_battle SET catalog_hash=?').run(masterHash);
      else app.store.db.prepare('INSERT INTO serial_pvp_active(user_id,battle_id) VALUES(?,?)').run(seed.userId,result.battleId);
    }
    // Separate isolated profile: timestamp first, then combined operation saves/ACK.
    // An already-true flag is a no-op setter, not a mandatory duplicate dirty row.
    await close();database=path.join(directory,'status-first.sqlite');now=season.slot3+100;await open();
    const nextBody=await prepare(),beforeFlag=app.store.read('UserSerialPvpGameStatus').data[0];
    parse(await push({UserSerialPvpGameStatus:[{...beforeFlag,updateRivalList:true}]}));
    const next=parse(await send(start,nextBody)),nextResume={serialPvpId:id,userId:nextBody.userId};
    parse(await push({UserSerialPvpGameStatus:[{...beforeFlag,updateRivalList:true,lastBattleStartAt:now}]}));
    await rejected(restart,nextResume);
    parse(await push({UserInfo:[{...user(),processingSerialPvpState:1}],
      UserSerialPvpInfo:[{userId:seed.userId,resumeRivalUserId:nextBody.userId}]},acknowledge(next.operation)));
    assert.deepEqual(app.store.serialPvp.activeBattle().observed,['info','processing','statusFlag','statusTime']);
    assert.equal(parse(await send(restart,nextResume)).battleId,next.battleId);
    const legacy=app.store.issueOperation(30200,{serialPvpId:id,serialPvpPlayerInfo:{userId:nextBody.userId}});
    await rejected('user_data/confirm',undefined);await rejected('user_data/push',delta({},acknowledge(legacy)));
    app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(legacy.id);
    // The self-details producer needs the same captured ordinary type9
    //battle vector plus generic profile, not invented fresh UserPvPParty stats.
    const homes=structuredClone(app.store.read('UserCommunicationCharacter').data),
      profile=app.store.read('UserProfile').data[0],home=homes.find(row=>row.characterId===profile.favoriteCommunicationCharacterId),
      favorite=master.communicationCharacters[profile.favoriteCommunicationCharacterId],
      costume=Object.entries(master.characterCostumes).find(([,row])=>row.characterKey===master.characters[favorite.characterId].key);
    home.costumeId=Number(costume[0]);
    const homesText=JSON.stringify(homes);app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
      .run(homesText,md5(homesText),'UserCommunicationCharacter');
    const profileBefore=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
      ownView=parse(await send('serial_pvp/player_info/get',{serialPvpId:id,userId:seed.userId}));
    assert.deepEqual(ownView.serialPvpParty,party);assert.equal(ownView.playerInfo.userId,seed.userId);
    assert.equal(ownView.playerInfo.favoriteCharacterCostumeId,home.costumeId);
    assert.equal(ownView.familiaName,profile.familiaName);assert.deepEqual(ownView.substitutedSpineIds,[]);
    assert.equal(ownView.operation,undefined);
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profileBefore);
    console.log('Abyss source start/resume fixtures complete; native acceptance still pending');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
