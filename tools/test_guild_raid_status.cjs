'use strict';
// DEFERRED / NOT RUN: only execute after all packet implementation is finished.
// Synthetic status/entry/save/player fixtures are not native raid battle/save/render acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE,guildRaidAttemptState,guildRaidNativeEvent}=require('./danmemore_server.cjs'),{request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),original=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-guild-raid-status-')),database=path.join(directory,'profile.sqlite'),
    master=structuredClone(original),events=Object.entries(master.guildRaidEvents).sort((a,b)=>a[1].window6-b[1].window6),
    [firstId,firstEvent]=events[0],value={guildRaidInformationId:Number(firstId)},action='guild_raid/status/get',
    first=Object.entries(master.guildRaidStages).find(([,row])=>row.guildRaidInformationId===Number(firstId) &&
      row.slot2===1 && row.slot3===1 && row.slot4===0);
  let app,port,sequence=0,now=firstEvent.window6-1;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app)await app.close();app=null;};
  const send=(route,body)=>request(port,++sequence,body,String(sequence),route),get=(body=value)=>send(action,body);
  const parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);};
  const put=(name,data)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(data),md5(data),name);
  const native=()=>app.store.db.prepare('SELECT * FROM profile ORDER BY name').all();
  const expected=id=>{
    const initial=Object.entries(master.guildRaidStages).filter(([,row])=>row.guildRaidInformationId===id &&
      row.slot2===1 && row.slot3===1 && row.slot4===0);
    assert.equal(initial.length,1);
    return {code:0,available:true,guildRaidStageId:Number(initial[0][0]),loopCount:1,
      bosses:initial[0][1].bossHp.flatMap((hp,enemyIndex)=>hp ? [{enemyIndex,hp}] : []),rank:0,ranking:[],
      defeatCount:0,defeatRewardExists:false,displayDefeatStageId:0,displayDefeatLoopCount:0,lastBattleInfo:{logType:0}};
  };
  const reject=async(body=value,status=503,cached=null,route=action)=>{
    const profiles=native(),queue=app.store.operations(),wallet=app.store.hardCurrency(),
      response=cached ? await request(port,cached.sequence,body,String(cached.sequence),route) : await send(route,body);
    assert.equal(response.status,status,response.body.toString());
    if(status===503)assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.deepEqual(native(),profiles);assert.deepEqual(app.store.operations(),queue);assert.deepEqual(app.store.hardCurrency(),wallet);
  };
  try {
    assert.equal(events.length,43);assert.equal(Object.keys(master.guildRaidStages).length,957);
    //WRITTEN ONLY / NOT RUN: original daily/event reset replaces stock and
    //clears both counters; it is not PvB's max(5,stock) or a scored debit.
    const raidId=Number(firstId),attemptAt=firstEvent.window6,
      attemptBaseline={graidSP:7,consumedNormalSP:150,recoveredGraidSP:1,graidSPLastResetAt:attemptAt},
      resetAt=at=>({graidSP:master.guildRaidAttemptRules[raidId].dailySP,consumedNormalSP:0,
        recoveredGraidSP:0,graidSPLastResetAt:at});
    assert.deepEqual(guildRaidAttemptState(master,raidId,attemptBaseline,attemptAt+1),attemptBaseline);
    assert.deepEqual(guildRaidAttemptState(master,raidId,{...attemptBaseline,graidSPLastResetAt:attemptAt-1},attemptAt),resetAt(attemptAt));
    assert.deepEqual(guildRaidAttemptState(master,raidId,attemptBaseline,attemptAt+86400),resetAt(attemptAt+86400));
    assert.deepEqual(guildRaidAttemptState(master,raidId,attemptBaseline,attemptAt-1),attemptBaseline);
    const midnight=(Math.floor((attemptAt+32400)/86400)+1)*86400-32400;
    assert.deepEqual(guildRaidAttemptState(master,raidId,{...attemptBaseline,graidSPLastResetAt:midnight-1},midnight),resetAt(midnight));
    const signedAttempt={graidSP:-2147483648,consumedNormalSP:-2147483648,recoveredGraidSP:2147483647,
      graidSPLastResetAt:Number.MAX_SAFE_INTEGER};
    assert.deepEqual(guildRaidAttemptState(master,raidId,signedAttempt,attemptAt),signedAttempt);
    for(const bad of [{...attemptBaseline,graidSP:2147483648},{...attemptBaseline,graidSPLastResetAt:1.5}])
      assert.throws(()=>guildRaidAttemptState(master,raidId,bad,attemptAt),error=>error.status===503);
    assert.throws(()=>guildRaidAttemptState(master,raidId,attemptBaseline,-1),error=>error.status===503);
    await open();await reject();
    for(const bad of [null,{},[],true,{guildRaidInformationId:0},{guildRaidInformationId:1.5},
      {guildRaidInformationId:'58200000001'},{...value,extra:1},{guildRaidInformationId:1}])await reject(bad,400);
    const currency=[{userId:seed.userId,currencyId:master.currencies['currency.valis'],amount:200000,
      cumulativeAmount:200000,reservedAmount:0,signature:0}];put('UserCurrency',currency);
    const created=parse(await send('familia/create',{name:'Raid lobby',description:'Deferred original raid fixture',godId:20000001,
      style:21000001,subStyle:0,activeTime:22000001,subActiveTime:0,requireApproval:false})),charge=created.operations[0];
    await reject();
    const paid=[{...currency[0],amount:100000}];
    parse(await send('user_data/push',{badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserCurrency:md5(paid)}},
      deltas:[{signature:0,trigger:'Familia',deleteItems:{},putItems:{UserCurrency:paid}}],operations:[{id:charge.id,verifier:charge.token}]}));
    await reject(); // Before the actual first event begins, despite saved membership.
    now=firstEvent.window6;
    const before=native(),response=await get(),cached={sequence,response},state=app.store.read('UserGuildRaidState').data,
      record=app.store.read('UserGuildRaidRecord').data,stages=app.store.read('UserAdventureStage').data,
      battle=app.store.read('UserAdventureState').data;
    assert.deepEqual(parse(response),expected(Number(firstId)));assert.deepEqual(native(),before);
    assert.deepEqual((await request(port,sequence,value,String(sequence),action)).body,response.body);
    const logAction='guild_raid/status/log',rankAction='guild_raid/ranking/member/get',
      familiaRankActions=['guild_raid/ranking/familia/top/get','guild_raid/ranking/familia/around/get'],
      logResponse=await send(logAction,value),logCached={sequence};
    assert.deepEqual(parse(logResponse),{code:0,logs:[]});assert.deepEqual(native(),before);
    assert.deepEqual((await request(port,logCached.sequence,value,String(logCached.sequence),logAction)).body,logResponse.body);
    const emptyRankingReplays=[],emptyMemberRanking=await send(rankAction,value);
    emptyRankingReplays.push({route:rankAction,sequence,body:emptyMemberRanking.body});
    assert.deepEqual(parse(emptyMemberRanking),{code:0,ranking:[]});assert.deepEqual(native(),before);
    for(const route of familiaRankActions) {
      const emptyFamiliaRanking=await send(route,value);
      emptyRankingReplays.push({route,sequence,body:emptyFamiliaRanking.body});
      assert.deepEqual(parse(emptyFamiliaRanking),{code:0,ranking:[]});
    }
    for(const bad of [null,{},[],{...value,count:10},{...value,gveId:Number(firstId)},{guildRaidInformationId:1}])
      {await reject(bad,400,null,logAction);await reject(bad,400,null,rankAction);
        for(const route of familiaRankActions)await reject(bad,400,null,route);}
    now=firstEvent.window7+1;
    await reject(value,503,null,rankAction);
    for(const route of familiaRankActions)await reject(value,503,null,route);
    now=firstEvent.window6;
    assert.deepEqual(app.store.operations(),[]);assert.deepEqual(app.store.read('UserCurrency').data,paid);
    const entryAction='guild_raid/status/preinitiation',users=app.store.read('UserInfo').data,
      parties=app.store.read('UserParty').data,units=app.store.read('UserPC').data,
      memorias=app.store.read('UserMemoria').data,party=parties[0],selected=[{...users[0],activeGuildRaidPartyId:party.id}];
    await reject(value,503,null,entryAction); //Never choose a default party for native active ID0.
    put('UserInfo',selected);
    for(const bad of [null,{},[],{...value,isTraining:true},{...value,loopCount:1},{...value,guildRaidStageId:Number(first[0])}])
      await reject(bad,400,null,entryAction);
    const entryNative=native(),entryWallet=app.store.hardCurrency(),entryResponse=await send(entryAction,value),
      entryCached={sequence,response:entryResponse};
    assert.deepEqual(parse(entryResponse),expected(Number(firstId)));
    assert.deepEqual(native(),entryNative);assert.deepEqual(app.store.operations(),[]);assert.equal(app.store.hardCurrency(),entryWallet);
    const entry=app.store.db.prepare('SELECT * FROM guild_raid_entry').get(),capture=JSON.parse(entry.capture_json);
    assert.equal(entry.raid_id,Number(firstId));assert.equal(entry.created_at,now);
    assert.deepEqual(capture.status,expected(Number(firstId)));assert.equal(capture.selection.partyId,party.id);
    assert.deepEqual(capture.attempts,{baseline:Object.fromEntries(['graidSP','consumedNormalSP','recoveredGraidSP','graidSPLastResetAt']
      .map(key=>[key,selected[0].playerStatus[key]])),rulesHash:md5(master.guildRaidAttemptRules[firstId])});
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM guild_raid_entry_request').get().n,1);
    assert.deepEqual((await request(port,entryCached.sequence,value,String(entryCached.sequence),entryAction,
      {'X-ARGO-REQUEST-BODY-HASH':'caller-controlled'})).body,entryResponse.body);
    await reject({...value,extra:1},400,entryCached,entryAction);
    await reject(value,400,entryCached,action); //The durable entry identity cannot change routes.
    const alternate={...structuredClone(party),id:Math.max(...parties.map(row=>row.id))+1};
    put('UserParty',[...parties,alternate]);put('UserInfo',[{...selected[0],activeGuildRaidPartyId:alternate.id}]);
    await reject(value,503,entryCached,entryAction);
    assert.deepEqual(parse(await send(entryAction,value)),expected(Number(firstId))); //Fresh untouched re-selection is allowed.
    const alternateCached={sequence};
    put('UserInfo',selected);await reject(value,503,alternateCached,entryAction);
    assert.deepEqual(parse(await send(entryAction,value)),expected(Number(firstId)));
    const currentEntryCached={sequence};
    const savedRules=master.guildRaidAttemptRules[firstId];delete master.guildRaidAttemptRules[firstId];
    await reject(value,503,null,entryAction);await reject(value,503,currentEntryCached,entryAction);
    master.guildRaidAttemptRules[firstId]=savedRules;
    master.guildRaidAttemptRules[firstId]={...savedRules,dailySP:savedRules.dailySP+1};
    await reject(value,503,currentEntryCached,entryAction);master.guildRaidAttemptRules[firstId]=savedRules;
    for(const changed of [[{...party,userId:1}],[],[party,party]]) {
      put('UserParty',changed);await reject(value,503,null,entryAction);await reject(value,503,currentEntryCached,entryAction);
    }
    put('UserParty',parties);
    const leaderId=party.slots.find(row=>row.slotNumber===1).pcId;
    put('UserPC',units.map(row=>row.pcId===leaderId ? {...row,joiningState:0} : row));
    await reject(value,503,null,entryAction);put('UserPC',units);
    //The original native Memoria initializer retains owner0. This is a
    //synthetic owned-selection fixture, not a card/signature/earning producer.
    const memoriaId=Number(Object.keys(master.memoriaLevels)[0]),card={userId:0,memoriaId,totalExp:0},
      withCard={...structuredClone(party),memoriaSlots:party.memoriaSlots.map(slot=>slot.slotNumber===1 ? {...slot,memoriaId} : slot)};
    put('UserParty',[withCard]);await reject(value,503,null,entryAction);
    put('UserMemoria',[card]);assert.deepEqual(parse(await send(entryAction,value)),expected(Number(firstId)));
    put('UserMemoria',[{...card,userId:1}]);await reject(value,503,null,entryAction);
    put('UserMemoria',memorias);put('UserParty',parties);assert.deepEqual(parse(await send(entryAction,value)),expected(Number(firstId)));
    //Same-second identical captures still represent different actual entry requests.
    const priorEntry=app.store.db.prepare('SELECT * FROM guild_raid_entry').get(),priorEntryCached={sequence};
    assert.deepEqual(parse(await send(entryAction,value)),expected(Number(firstId)));
    const freshEntry=app.store.db.prepare('SELECT * FROM guild_raid_entry').get();
    assert.equal(freshEntry.capture_hash,priorEntry.capture_hash);assert.equal(freshEntry.created_at,priorEntry.created_at);
    assert.notEqual(freshEntry.request_key,priorEntry.request_key);await reject(value,503,priorEntryCached,entryAction);
    const stableEntryCached={sequence},entryRows=()=>({entries:app.store.db.prepare('SELECT * FROM guild_raid_entry ORDER BY creation_operation_id,raid_id').all(),
      requests:app.store.db.prepare('SELECT * FROM guild_raid_entry_request ORDER BY request_key').all()});
    const durable=entryRows();
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`${stableEntryCached.sequence}/${stableEntryCached.sequence}`);
    assert.deepEqual(parse(await request(port,stableEntryCached.sequence,value,String(stableEntryCached.sequence),entryAction)),expected(Number(firstId)));
    assert.deepEqual(entryRows(),durable);
    //Old three-field captures remain readable; never backfill an invented SP baseline.
    const legacyCapture=JSON.parse(durable.entries[0].capture_json);delete legacyCapture.attempts;
    const legacyJson=JSON.stringify(legacyCapture),legacyHash=md5(legacyCapture);
    app.store.db.prepare('UPDATE guild_raid_entry SET capture_json=?,capture_hash=? WHERE creation_operation_id=? AND raid_id=?')
      .run(legacyJson,legacyHash,entry.creation_operation_id,entry.raid_id);
    app.store.db.prepare('UPDATE guild_raid_entry_request SET capture_hash=? WHERE capture_hash=?')
      .run(legacyHash,durable.entries[0].capture_hash);
    assert.deepEqual(parse(await request(port,stableEntryCached.sequence,value,String(stableEntryCached.sequence),entryAction)),expected(Number(firstId)));
    assert.equal(app.store.db.prepare('SELECT capture_json FROM guild_raid_entry WHERE creation_operation_id=? AND raid_id=?')
      .get(entry.creation_operation_id,entry.raid_id).capture_json,legacyJson);
    app.store.db.prepare('UPDATE guild_raid_entry SET capture_json=?,capture_hash=? WHERE creation_operation_id=? AND raid_id=?')
      .run(durable.entries[0].capture_json,durable.entries[0].capture_hash,entry.creation_operation_id,entry.raid_id);
    app.store.db.prepare('UPDATE guild_raid_entry_request SET capture_hash=? WHERE capture_hash=?')
      .run(durable.entries[0].capture_hash,legacyHash);
    app.store.db.prepare('UPDATE guild_raid_entry SET capture_hash=? WHERE creation_operation_id=? AND raid_id=?')
      .run('unknown-capture',entry.creation_operation_id,entry.raid_id);
    await reject(value,503,null,entryAction);
    app.store.db.prepare('UPDATE guild_raid_entry SET capture_hash=? WHERE creation_operation_id=? AND raid_id=?')
      .run(durable.entries[0].capture_hash,entry.creation_operation_id,entry.raid_id);
    const originalGeneration=app.store.db.prepare('SELECT creation_operation_id FROM local_familia').get().creation_operation_id;
    app.store.db.prepare('UPDATE local_familia SET creation_operation_id=? WHERE id=1').run(originalGeneration+999999);
    app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(originalGeneration+999999);
    await reject(value,503,stableEntryCached,entryAction); //Old transport never binds to a recreated Familia.
    app.store.db.prepare('UPDATE local_familia SET creation_operation_id=? WHERE id=1').run(originalGeneration);
    app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(originalGeneration+999999);
    put('UserParty',[...parties,alternate]);put('UserInfo',[{...selected[0],activeGuildRaidPartyId:alternate.id}]);
    const rollbackEntries=entryRows(),rollbackMeta=app.store.db.prepare('SELECT * FROM meta ORDER BY key').all();
    app.store.db.exec("CREATE TRIGGER fail_raid_entry_reply BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'deferred entry rollback'); END");
    await reject(value,503,null,entryAction);assert.deepEqual(entryRows(),rollbackEntries);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM meta ORDER BY key').all(),rollbackMeta);
    app.store.db.exec('DROP TRIGGER fail_raid_entry_reply');put('UserParty',parties);put('UserInfo',selected);
    //WRITTEN ONLY / NOT RUN: original SP field widths, not refill/deduction rules.
    const saveRaidSp=rows=>send('user_data/push',{badges:null,scripts:{},dataTokens:{},
      checksums:{before:{},after:{UserInfo:md5(rows)}},
      deltas:[{signature:0,trigger:'GuildRaid',deleteItems:{},putItems:{UserInfo:rows}}],operations:[]}),
      spRows=[{...selected[0],playerStatus:{...selected[0].playerStatus,graidSP:-2147483648,
        consumedNormalSP:2147483647,recoveredGraidSP:2147483647,graidSPLastResetAt:Number.MAX_SAFE_INTEGER}}];
    parse(await saveRaidSp(spRows));assert.deepEqual(app.store.read('UserInfo').data,spRows);
    assert.equal(app.store.read('UserInfo').token,md5(spRows));
    const spProfiles=native(),spWallet=app.store.hardCurrency(),spQueue=app.store.operations();
    for(const fields of [{graidSP:2147483648},{consumedNormalSP:-2147483649},{recoveredGraidSP:'1'},
      {graidSPLastResetAt:1.5},{graidSPLastResetAt:Number.MAX_SAFE_INTEGER+1},{graidSP:undefined}]) {
      assert.equal((await saveRaidSp([{...spRows[0],playerStatus:{...spRows[0].playerStatus,...fields}}])).status,400);
      assert.deepEqual(native(),spProfiles);assert.deepEqual(entryRows(),durable);
    }
    const spMeta=app.store.db.prepare('SELECT * FROM meta ORDER BY key').all();
    app.store.db.exec("CREATE TRIGGER fail_raid_sp_reply BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'deferred SP rollback'); END");
    assert.equal((await saveRaidSp(selected)).status,503);assert.deepEqual(native(),spProfiles);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM meta ORDER BY key').all(),spMeta);
    app.store.db.exec('DROP TRIGGER fail_raid_sp_reply');
    await close();await open();assert.deepEqual(app.store.read('UserInfo').data,spRows);
    const spClock=now;now=firstEvent.window7+1;
    assert.deepEqual(app.store.read('UserInfo').data,spRows);now=spClock;
    put('UserInfo',[{...spRows[0],playerStatus:{...spRows[0].playerStatus,graidSP:'corrupt'}}]);
    assert.throws(()=>app.store.read('UserInfo'),/player-status fields/);
    assert.equal(app.store.db.prepare('SELECT data FROM profile WHERE name=?').get('UserInfo').data,
      JSON.stringify([{...spRows[0],playerStatus:{...spRows[0].playerStatus,graidSP:'corrupt'}}]));
    put('UserInfo',spRows);parse(await saveRaidSp(selected));
    assert.equal(app.store.hardCurrency(),spWallet);assert.deepEqual(app.store.operations(),spQueue);
    assert.deepEqual(entryRows(),durable);
    //SYNTHETIC codec vectors: enemy IDs/encounters below are width probes,
    //NOT authored enemy joins, native battle observations or score/reward proof.
    const enemy={encounterNumber:1,enemyPartyId:1,enemyId:9000000001,enemyIndex:0,domesticHp:1584000,damage:157},
      score={guildRaidStageId:Number(first[0]),enemyDamage:[enemy]},
      savedBattle=[{...battle[0],stageId:first[1].adventureStageId,userGuildRaidScore:score}],
      saveBody=rows=>({badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserAdventureState:md5(rows)}},
        deltas:[{signature:0,trigger:'Adventure',deleteItems:{},putItems:{UserAdventureState:rows}}],operations:[]}),
      saveAdventure=rows=>send('user_data/push',saveBody(rows));
    const damageWallet=app.store.hardCurrency(),damageQueue=app.store.operations();
    parse(await saveAdventure(savedBattle));assert.deepEqual(app.store.read('UserAdventureState').data,savedBattle);
    assert.equal(app.store.read('UserAdventureState').token,md5(savedBattle));
    await reject(value,503,stableEntryCached,entryAction); //Saved raid combat cannot become a fresh entry.
    const beforeDamage=native();
    for(const changed of [null,{}, {...score,guildRaidStageId:0},{...score,guildRaidStageId:1},
      {...score,extra:1},{...score,enemyDamage:[{enemyIndex:0,hp:100}]},
      {...score,enemyDamage:[{...enemy,damage:2147483648}]},
      {...score,enemyDamage:[{...enemy,domesticHp:1.5}]},
      {...score,enemyDamage:[{...enemy,enemyPartyId:'1'}]},
      {...score,enemyDamage:[{...enemy,enemyId:Number.MAX_SAFE_INTEGER+1}]}]) {
      const response=await saveAdventure([{...savedBattle[0],userGuildRaidScore:changed}]);
      assert.equal(response.status,400,response.body.toString());assert.deepEqual(native(),beforeDamage);
    }
    const erasedAdventure=saveBody([]);erasedAdventure.deltas[0].putItems={};
    erasedAdventure.deltas[0].deleteItems={UserAdventureState:savedBattle};
    assert.equal((await send('user_data/push',erasedAdventure)).status,400);assert.deepEqual(native(),beforeDamage);
    assert.equal((await saveAdventure([{...savedBattle[0],userId:1}])).status,400);assert.deepEqual(native(),beforeDamage);
    const retained=[{...savedBattle[0],stageId:0,userGuildRaidScore:{...score,enemyDamage:[
      {...enemy,damage:-2147483648,domesticHp:2147483647,enemyId:Number.MAX_SAFE_INTEGER},enemy]}}];
    parse(await saveAdventure(retained));assert.deepEqual(app.store.read('UserAdventureState').data,retained);
    //Signed fields/order/repeated raw observations are retained by the codec;
    //deduplication/overkill and scoring have not been recovered or implemented.
    const damageMeta=app.store.db.prepare('SELECT * FROM meta ORDER BY key').all(),damageProfiles=native();
    app.store.db.exec("CREATE TRIGGER fail_raid_damage_reply BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'deferred damage rollback'); END");
    const failedSave=await saveAdventure(savedBattle);assert.equal(failedSave.status,503);
    assert.deepEqual(native(),damageProfiles);assert.deepEqual(app.store.db.prepare('SELECT * FROM meta ORDER BY key').all(),damageMeta);
    assert.deepEqual(entryRows(),durable);app.store.db.exec('DROP TRIGGER fail_raid_damage_reply');
    await close();await open();assert.deepEqual(app.store.read('UserAdventureState').data,retained);
    const retainedClock=now;now=firstEvent.window7+1;
    assert.deepEqual(app.store.read('UserAdventureState').data,retained);now=retainedClock;
    const raidStage=master.guildRaidStages[first[0]];delete master.guildRaidStages[first[0]];
    assert.throws(()=>app.store.read('UserAdventureState'),/original stage\/event identity/);
    assert.deepEqual(native(),damageProfiles);master.guildRaidStages[first[0]]=raidStage;
    put('UserAdventureState',[{...retained[0],userGuildRaidScore:{...score,enemyDamage:[{enemyIndex:0,hp:100}]}}]);
    assert.throws(()=>app.store.read('UserAdventureState'),/damage fields/);await reject();
    put('UserAdventureState',battle);assert.equal(app.store.hardCurrency(),damageWallet);
    assert.deepEqual(app.store.operations(),damageQueue);assert.deepEqual(entryRows(),durable);
    //WRITTEN ONLY: native six-field record codec, NOT scoring/recovery proof.
    const recordA={userId:seed.userId,guildRaidId:Number(firstId),score:7,spRecoveryCount:1,lastSpRecoveryAt:now,scoreInt64:7},
      recordB={...recordA,guildRaidId:Number(events[1][0]),score:0,spRecoveryCount:0,lastSpRecoveryAt:0,scoreInt64:0},
      recordBody=(rows,after,remove=false)=>({badges:null,scripts:{},dataTokens:{},
        checksums:{before:{},after:{UserGuildRaidRecord:md5(after)}},
        deltas:[{signature:0,trigger:'GuildRaid',deleteItems:remove?{UserGuildRaidRecord:rows}:{},
          putItems:remove?{}:{UserGuildRaidRecord:rows}}],operations:[]});
    parse(await send('user_data/push',recordBody([recordA,recordB],[recordA,recordB])));
    const updatedA={...recordA,score:-2147483648,spRecoveryCount:2147483647,
      lastSpRecoveryAt:Number.MAX_SAFE_INTEGER,scoreInt64:Number.MAX_SAFE_INTEGER};
    parse(await send('user_data/push',recordBody([updatedA],[recordB,updatedA])));
    assert.deepEqual(app.store.read('UserGuildRaidRecord').data,[recordB,updatedA]);
    assert.equal(app.store.read('UserGuildRaidRecord').token,md5([recordB,updatedA]));
    const recordProfiles=native(),recordMeta=()=>app.store.db.prepare('SELECT * FROM meta ORDER BY key').all();
    for(const bad of [[updatedA,updatedA],[{...updatedA,userId:1}],[{...updatedA,userId:0}],
      [{...updatedA,guildRaidId:1}],[{...updatedA,score:2147483648}],[{...updatedA,spRecoveryCount:'1'}],
      [{...updatedA,lastSpRecoveryAt:1.5}],[{...updatedA,scoreInt64:Number.MAX_SAFE_INTEGER+1}],
      [{...updatedA,totalDamage:7}],[{userId:seed.userId,guildRaidId:Number(firstId)}]]) {
      assert.equal((await send('user_data/push',recordBody(bad,bad))).status,400);assert.deepEqual(native(),recordProfiles);
    }
    const priorRecordMeta=recordMeta();
    app.store.db.exec("CREATE TRIGGER fail_raid_record_reply BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'deferred record rollback'); END");
    assert.equal((await send('user_data/push',recordBody([recordA],[recordB,recordA]))).status,503);
    assert.deepEqual(native(),recordProfiles);assert.deepEqual(recordMeta(),priorRecordMeta);
    app.store.db.exec('DROP TRIGGER fail_raid_record_reply');
    await close();await open();assert.deepEqual(app.store.read('UserGuildRaidRecord').data,[recordB,updatedA]);
    const recordClock=now;now=firstEvent.window7+1;
    assert.deepEqual(app.store.read('UserGuildRaidRecord').data,[recordB,updatedA]);now=recordClock;
    const originalRaidEvent=master.guildRaidEvents[firstId];delete master.guildRaidEvents[firstId];
    assert.throws(()=>app.store.read('UserGuildRaidRecord'),/original event identity/);assert.deepEqual(native(),recordProfiles);
    master.guildRaidEvents[firstId]=originalRaidEvent;
    put('UserGuildRaidRecord',[updatedA,updatedA]);assert.throws(()=>app.store.read('UserGuildRaidRecord'),/record fields/);
    put('UserGuildRaidRecord',[recordB,updatedA]);
    parse(await send('user_data/push',recordBody([recordB],[updatedA],true)));
    assert.deepEqual(app.store.read('UserGuildRaidRecord').data,[updatedA]);
    assert.equal(app.store.hardCurrency(),damageWallet);assert.deepEqual(app.store.operations(),damageQueue);
    assert.deepEqual(entryRows(),durable);put('UserGuildRaidRecord',record);
    //WRITTEN ONLY / NOT RUN: saved zero initialization and unrelated-event
    //records must not be erased or mistaken for selected-event earnings.
    const initialRecord={...recordB,guildRaidId:Number(firstId)},otherEarnedRecord={...recordA,guildRaidId:recordB.guildRaidId};
    for(const userId of [0,seed.userId]) {
      const rows=[otherEarnedRecord,{...initialRecord,userId}];put('UserGuildRaidRecord',rows);
      const untouched=native(),queue=app.store.operations(),wallet=app.store.hardCurrency();
      assert.deepEqual(parse(await get()),expected(Number(firstId)));
      assert.deepEqual(parse(await send(logAction,value)),{code:0,logs:[]});
      assert.deepEqual(parse(await send(entryAction,value)),expected(Number(firstId)));
      assert.deepEqual(native(),untouched);assert.deepEqual(app.store.operations(),queue);assert.equal(app.store.hardCurrency(),wallet);
      assert.deepEqual(entryRows(),durable);
      await close();await open();assert.deepEqual(app.store.read('UserGuildRaidRecord').data,rows);
      assert.deepEqual(parse(await get()),expected(Number(firstId)));
    }
    for(const fields of [{score:1},{score:-1},{scoreInt64:1},{spRecoveryCount:1},{lastSpRecoveryAt:1}]) {
      put('UserGuildRaidRecord',[otherEarnedRecord,{...initialRecord,...fields}]);
      await reject();await reject(value,503,null,logAction);await reject(value,503,stableEntryCached,entryAction);
    }
    put('UserGuildRaidRecord',record);
    //Synthetic public-party WIDTH fixture, NOT a native snapshot/stat capture.
    const detailAction='guild_raid/player_info/get',detailValue={userId:seed.userId},otherParties=app.store.read('UserOtherParty').data,
      emptyPc=Object.fromEntries(['pcId','level','currentJobIndex','limitbreakCount','usableSkillAmount','strength','intelligence',
        'agility','vitality','luck','hp','mp','physicalAttackPower','magicAttackPower','defensePower','weaponId','armorId',
        'heroSublimateLevel','attackPattern','currentDP','unlockedAdditionalAbilityAmount'].map(key=>[key,0]));
    Object.assign(emptyPc,{weaponAbilityIds:[],armorAbilityIds:[],isUnlockedHeroSublimate:false,hasAllStatusBoardOpened:false});
    const publicParty={userId:seed.userId,partyType:4,index:0,attackPattern:party.attackPattern,partyStrength:0,memoriaSlots:[],
      slots:Array.from({length:6},(_,index)=>({slotNumber:index+1,isHidden:false,commandFlow:'',
        pc:{...structuredClone(emptyPc),...(index===0?{pcId:leaderId,level:1}: {})},assistingPc:structuredClone(emptyPc)}))};
    await reject(detailValue,503,null,detailAction);
    for(const bad of [null,{},[],{userId:0},{userId:'1000000001'},{...detailValue,extra:1}])
      await reject(bad,400,null,detailAction);
    put('UserOtherParty',[publicParty]);const publicProfiles=native(),publicResponse=await send(detailAction,detailValue),publicCached={sequence};
    const publicResult=parse(publicResponse);assert.deepEqual(Object.keys(publicResult),['code','playerInfo','party']);
    assert.deepEqual(publicResult.party,publicParty);assert.equal(publicResult.playerInfo.userId,seed.userId);
    assert.deepEqual(native(),publicProfiles);assert.deepEqual(app.store.operations(),damageQueue);
    assert.deepEqual((await request(port,publicCached.sequence,detailValue,String(publicCached.sequence),detailAction)).body,publicResponse.body);
    for(const changed of [[],[publicParty,publicParty],[{...publicParty,partyType:7}],[{...publicParty,userId:1}],
      [{...publicParty,slots:publicParty.slots.slice(1)}],[{...publicParty,partyStrength:'0'}]]) {
      put('UserOtherParty',changed);await reject(detailValue,503,null,detailAction);await reject(detailValue,503,publicCached,detailAction);
    }
    put('UserOtherParty',[publicParty]);await reject({userId:1},503,null,detailAction);
    put('UserInfo',[{...selected[0],name:'Changed public raid name'}]);await reject(detailValue,503,publicCached,detailAction);
    assert.equal(parse(await send(detailAction,detailValue)).playerInfo.name,'Changed public raid name');put('UserInfo',selected);
    await close();await open();assert.deepEqual(parse(await send(detailAction,detailValue)),publicResult);
    const publicClock=now;now=firstEvent.window7+1;assert.deepEqual(parse(await send(detailAction,detailValue)),publicResult);now=publicClock;
    //DEFERRED / NOT RUN: both original Union Raid callers import actual mode8,
    //not this mode4 Familia raid snapshot or a reconstructed selected team.
    const unionAction='union_raid/player_info/get',unionParty={...publicParty,partyType:8};
    await reject(detailValue,503,null,unionAction);
    put('UserOtherParty',[publicParty,unionParty]);
    const unionBefore=native(),unionResponse=await send(unionAction,detailValue),unionCached={sequence},
      unionResult=parse(unionResponse);
    assert.deepEqual(unionResult,{code:0,playerInfo:publicResult.playerInfo,party:unionParty});
    assert.deepEqual(native(),unionBefore);
    assert.deepEqual((await request(port,unionCached.sequence,detailValue,String(unionCached.sequence),unionAction)).body,unionResponse.body);
    for(const bad of [null,{},[],{userId:0},{...detailValue,extra:1}])await reject(bad,400,null,unionAction);
    await reject({userId:1},503,null,unionAction);
    put('UserOtherParty',[publicParty,{...unionParty,partyStrength:'0'}]);
    await reject(detailValue,503,null,unionAction);await reject(detailValue,503,unionCached,unionAction);
    put('UserOtherParty',[publicParty,unionParty,unionParty]);await reject(detailValue,503,null,unionAction);
    put('UserOtherParty',[publicParty,unionParty]);
    put('UserInfo',[{...selected[0],name:'Changed Union Raid name'}]);
    await reject(detailValue,503,unionCached,unionAction);put('UserInfo',selected);
    await close();await open();assert.deepEqual(parse(await send(unionAction,detailValue)),unionResult);
    put('UserOtherParty',[publicParty]);
    const publicMeta=recordMeta(),publicBeforeFailure=native();
    app.store.db.exec("CREATE TRIGGER fail_raid_detail_reply BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'deferred detail rollback'); END");
    await reject(detailValue,503,null,detailAction);assert.deepEqual(recordMeta(),publicMeta);assert.deepEqual(native(),publicBeforeFailure);
    app.store.db.exec('DROP TRIGGER fail_raid_detail_reply');put('UserOtherParty',otherParties);
    for(const changed of [[{...state[0],readDefeatCount:1}],[{...state[0],guildRaidId:1}],[{...state[0],userId:1}],[],[state[0],state[0]]]) {
      put('UserGuildRaidState',changed);await reject();await reject(value,503,cached);
      await reject(value,503,logCached,logAction);await reject(value,503,null,logAction);
      await reject(value,503,stableEntryCached,entryAction);put('UserGuildRaidState',state);
    }
    put('UserGuildRaidRecord',[{userId:seed.userId,guildRaidId:Number(firstId)}]);await reject();await reject(value,503,cached);
    await reject(value,503,stableEntryCached,entryAction);
    put('UserGuildRaidRecord',record);
    const clear={userId:seed.userId,adventureStageId:first[1].adventureStageId,state:4,cumulativeClearCount:1,
      firstCompleteDateTime:now,lastCompleteDateTime:now};
    put('UserAdventureStage',[...stages.filter(row=>row.adventureStageId!==clear.adventureStageId),clear]);await reject();
    await reject(value,503,cached);put('UserAdventureStage',stages);
    put('UserAdventureState',[{...battle[0],stageId:clear.adventureStageId}]);await reject();
    await reject(value,503,stableEntryCached,entryAction);put('UserAdventureState',battle);
    app.store.db.prepare('INSERT INTO stage_completion(stage_id,token,body_hash,operation_id) VALUES(?,?,?,?)')
      .run(clear.adventureStageId,'unproven-raid',md5({}),99999999);
    await reject();await reject(value,503,cached);
    app.store.db.prepare('DELETE FROM stage_completion WHERE stage_id=? AND token=?').run(clear.adventureStageId,'unproven-raid');
    for(const [type,parameters] of [[23200,{}],[5000,{UserAdventureStage:[clear]}],
      [5000,{UserGuildRaidState:state}],[5000,{UserGuildRaidRecord:[]}]]) {
      const pending=app.store.issueOperation(type,parameters);await reject();await reject(value,503,cached);
      await reject(value,503,stableEntryCached,entryAction);
      app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(pending.id);
    }
    const hp=first[1].bossHp;first[1].bossHp=[-1,0,0,0,0];await reject();first[1].bossHp=hp;
    first[1].bossHp=hp.map(n=>n ? n+1 : 0);await reject(value,503,cached);
    await reject(value,503,stableEntryCached,entryAction);first[1].bossHp=hp;
    const all=master.guildRaidStages;master.guildRaidStages={};await reject();master.guildRaidStages=all;
    const profiles=native(),meta=app.store.db.prepare('SELECT * FROM meta ORDER BY key').all();
    app.store.db.exec("CREATE TRIGGER fail_raid_status_reply BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'deferred rollback'); END");
    await reject();assert.deepEqual(native(),profiles);assert.deepEqual(app.store.db.prepare('SELECT * FROM meta ORDER BY key').all(),meta);
    await reject(value,503,null,logAction);assert.deepEqual(app.store.db.prepare('SELECT * FROM meta ORDER BY key').all(),meta);
    app.store.db.exec('DROP TRIGGER fail_raid_status_reply');
    await close();await open();assert.deepEqual((await request(port,cached.sequence,value,String(cached.sequence),action)).body,cached.response.body);
    assert.deepEqual(parse(await request(port,stableEntryCached.sequence,value,String(stableEntryCached.sequence),entryAction)),expected(Number(firstId)));
    assert.deepEqual(entryRows(),durable);
    //Every original season uses its own unchanged first stage and HP, not a
    //single reused enemy fixture or an event-clock reset of native progress.
    for(const [id,event] of events) {
      now=event.window6;
      assert.deepEqual(parse(await get({guildRaidInformationId:Number(id)})),expected(Number(id)));
      assert.deepEqual(parse(await send(logAction,{guildRaidInformationId:Number(id)})),{code:0,logs:[]});
      assert.deepEqual(native(),profiles);assert.deepEqual(app.store.operations(),[]);
    }
    now=events.at(-1)[1].window7+1;await reject({guildRaidInformationId:Number(events.at(-1)[0])});await reject(value,503,cached);
    await reject(value,503,stableEntryCached,entryAction);assert.deepEqual(entryRows(),durable);
    assert.deepEqual(app.store.read('UserCurrency').data,paid);
    //DEFERRED source-only training fixture. Direct setup is a width/order
    //probe, NOT a naturally unlocked/entered/signed native raid battle.
    now=firstEvent.window6;put('UserInfo',selected);put('UserParty',parties);
    const trainingStage={...structuredClone(stages.find(row=>row.adventureStageId===first[1].adventureStageId) ?? stages[0]),
      userId:seed.userId,adventureStageId:first[1].adventureStageId,state:1,cumulativeClearCount:0,dailyClearCount:0,
      firstCompleteDateTime:0,lastCompleteDateTime:0,currentScore:0,highScore:0,tasks:[]},
      trainingStages=[...stages.filter(row=>row.adventureStageId!==trainingStage.adventureStageId),trainingStage],
      trainingBattle=[{...battle[0],stageId:trainingStage.adventureStageId,
        userGuildRaidScore:{guildRaidStageId:Number(first[0]),enemyDamage:[]}}],
      trainingRecords=[otherEarnedRecord,{...initialRecord,userId:0}],
      trainingState=[{...state[0],guildRaidId:otherEarnedRecord.guildRaidId}],
      trainingAction='guild_raid/stage/complete',trainingValue={adventureStageId:trainingStage.adventureStageId,token:'deferred-training-one',
        adventureStageTaskIds:[],adventureGainedItems:[],friendshipStates:[],isEnemyAnnihilated:false,secretMissionCompleted:false,
        adventureRecord:{normalAttackCount:0,skillCount:0,specialSkillCount:0,linkageSkillCount:0,deathCount:0,continueCount:0,turnCount:1},
        guildRaidStageId:Number(first[0]),loopCount:1,isTraining:true,
        bosses:first[1].bossHp.map((hp,enemyIndex)=>({enemyIndex,damage:hp ? 0x7fffffff : 0}))};
    put('UserAdventureStage',trainingStages);put('UserAdventureState',battle);
    put('UserGuildRaidRecord',trainingRecords);put('UserGuildRaidState',trainingState);
    assert.deepEqual(parse(await send(entryAction,value)),expected(Number(firstId)));
    put('UserAdventureState',trainingBattle);
    //A practice request cannot consume attempts or manufacture a recovery.
    for(const fields of [{graidSP:selected[0].playerStatus.graidSP+1},{consumedNormalSP:1},{recoveredGraidSP:1}]) {
      put('UserInfo',[{...selected[0],playerStatus:{...selected[0].playerStatus,...fields}}]);
      await reject(trainingValue,503,null,trainingAction);
    }
    put('UserInfo',selected);
    for(const bad of [{...trainingValue,bosses:trainingValue.bosses.slice(1)},
      {...trainingValue,bosses:trainingValue.bosses.map(row=>({...row,hp:1}))},
      {...trainingValue,bosses:trainingValue.bosses.map((row,i)=>i===0 ? {...row,damage:2147483648} : row)},
      {...trainingValue,bosses:trainingValue.bosses.map((row,i)=>i===0 ? {...row,enemyIndex:1} : row)}])
      await reject(bad,400,null,trainingAction);
    //WRITTEN ONLY / NOT RUN:21854bc's mixed array and native widths, not
    //owned battle stats, scoring, attempt deductions or reward acceptance.
    const logInts=['pcId','pcLv','assiId','assiLv','wpPerf','amPerf','str','int','agi','vit','luck',
        'hp','mp','physical','magic','defense','actCnt','spCnt','lsCnt'],
      logLongs=['wpId','wpAbi1','wpAbi2','wpAbi3','wpAbi4','wpAbi5',
        'amId','amAbi1','amAbi2','amAbi3','amAbi4','amAbi5','pcDamage','enemyDamage'],
      logPc={...Object.fromEntries([...logInts,...logLongs].map(key=>[key,0])),pcId:leaderId,pcLv:1},
      scoredValue={...trainingValue,isTraining:false,battleLog:[logPc,['gauge',0]]};
    await reject(scoredValue,503,null,trainingAction); //No actual captured nontraining SP debit; never silently charge here.
    await reject({...scoredValue,battleLog:[{...logPc,str:-2147483648,actCnt:2147483647,
      wpId:Number.MAX_SAFE_INTEGER,wpAbi1:Number.MAX_SAFE_INTEGER,pcDamage:Number.MAX_SAFE_INTEGER,
      enemyDamage:-Number.MAX_SAFE_INTEGER},['gauge',Number.MAX_SAFE_INTEGER]]},503,null,trainingAction);
    for(const bad of [{...trainingValue,isTraining:false},{...trainingValue,battleLog:scoredValue.battleLog},
      {...scoredValue,battleLog:{pcs:[logPc],gauge:0}}, {...scoredValue,battleLog:[]},
      {...scoredValue,battleLog:[logPc]}, {...scoredValue,battleLog:[['gauge',0],logPc]},
      {...scoredValue,battleLog:[logPc,['gauge',0,1]]}, {...scoredValue,battleLog:[logPc,['gauge','0']]},
      {...scoredValue,battleLog:[logPc,['gauge',Number.MAX_SAFE_INTEGER+1]]},
      ...[{pcLv:2147483648},{str:-2147483649},{wpId:'1'},{amAbi5:Number.MAX_SAFE_INTEGER+1},
        {wpPerf:1.5},{pcDamage:undefined},{hp:undefined},{damage:0}].map(fields=>
          ({...scoredValue,battleLog:[{...logPc,...fields},['gauge',0]]}))])
      await reject(bad,400,null,trainingAction);
    const trainingProfiles=native(),trainingWallet=app.store.hardCurrency(),trainingResponse=await send(trainingAction,trainingValue),
      trainingCached={sequence},trainingResult=parse(trainingResponse),trainingOperation=trainingResult.operation;
    assert.equal(trainingOperation.type,23200);assert.deepEqual(trainingOperation.parameters.bosses,expected(Number(firstId)).bosses);
    assert.equal(trainingOperation.parameters.totalDamage,trainingValue.bosses.reduce((sum,row)=>sum+row.damage,0));
    assert.equal(trainingOperation.parameters.score,0);assert.equal(trainingOperation.parameters.isRecorded,false);
    assert.equal(trainingOperation.parameters.isTraining,true);assert.equal(trainingOperation.parameters.defeatNow,false);
    await reject(value,503,null,logAction); //An active/pending battle must not look like an empty settled history.
    assert.deepEqual(native(),trainingProfiles);assert.equal(app.store.hardCurrency(),trainingWallet);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM guild_raid_completion').get().n,1);
    assert.deepEqual((await request(port,trainingCached.sequence,trainingValue,String(trainingCached.sequence),trainingAction,
      {'X-ARGO-REQUEST-BODY-HASH':'caller-controlled'})).body,trainingResponse.body);
    await reject({...trainingValue,loopCount:2},400,trainingCached,trainingAction);
    const trainingAck={badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{}},deltas:[],
      operations:[{id:trainingOperation.id,verifier:trainingOperation.token}]};
    assert.equal((await send('user_data/push',trainingAck)).status,400); //No clear/state0 proof.
    const beforeBadAttempts=native(),badAttempts=[{...selected[0],playerStatus:{...selected[0].playerStatus,recoveredGraidSP:1}}];
    assert.equal((await saveRaidSp(badAttempts)).status,400);assert.deepEqual(native(),beforeBadAttempts);
    const trainingCleared={...trainingStage,state:4,cumulativeClearCount:1,dailyClearCount:1,
      firstCompleteDateTime:now,lastCompleteDateTime:now},
      clearedStages=trainingStages.map(row=>row.adventureStageId===trainingStage.adventureStageId ? trainingCleared : row);
    parse(await send('user_data/push',{...trainingAck,operations:[],checksums:{before:{},after:{UserAdventureStage:md5(clearedStages)}},
      deltas:[{signature:0,trigger:'Adventure',deleteItems:{},putItems:{UserAdventureStage:[trainingCleared]}}]}));
    //The actual native getter may have reset without saving before entry;
    //accept its saved timestamp/counters, not a guessed issue-time prewrite.
    const resetUsers=[{...selected[0],playerStatus:{...selected[0].playerStatus,
      ...guildRaidAttemptState(master,Number(firstId),selected[0].playerStatus,now)}}];
    const beforeResetProfiles=native();
    app.store.db.exec("CREATE TRIGGER fail_raid_attempt_checkpoint BEFORE INSERT ON guild_raid_attempt_checkpoint BEGIN SELECT RAISE(ABORT,'deferred attempt checkpoint rollback'); END");
    assert.equal((await saveRaidSp(resetUsers)).status,503);assert.deepEqual(native(),beforeResetProfiles);
    assert.equal(app.store.db.prepare('SELECT * FROM guild_raid_attempt_checkpoint').get(),undefined);
    app.store.db.exec('DROP TRIGGER fail_raid_attempt_checkpoint');
    parse(await saveRaidSp(resetUsers));
    const attemptFields=['graidSP','consumedNormalSP','recoveredGraidSP','graidSPLastResetAt'],
      attempts=rows=>Object.fromEntries(attemptFields.map(key=>[key,rows[0].playerStatus[key]])),
      attemptCheckpoint=()=>app.store.db.prepare('SELECT * FROM guild_raid_attempt_checkpoint WHERE user_id=?').get(seed.userId);
    assert.deepEqual(JSON.parse(attemptCheckpoint().status_json),attempts(resetUsers));
    await reject(trainingValue,503,trainingCached,trainingAction); //Never repeat the additive clear after a split save.
    await close();await open();
    const trainingFinished=[{...trainingBattle[0],stageId:0}];parse(await saveAdventure(trainingFinished));
    parse(await send('user_data/push',trainingAck));assert.deepEqual(app.store.operations(),[]);
    assert.deepEqual(app.store.read('UserGuildRaidRecord').data,trainingRecords);assert.deepEqual(app.store.read('UserGuildRaidState').data,trainingState);
    assert.deepEqual(app.store.read('UserAdventureState').data,trainingFinished);
    assert.deepEqual(app.store.read('UserInfo').data,resetUsers);
    assert.deepEqual(parse(await get()),expected(Number(firstId))); //Proven training is not scored/unknown history.
    assert.deepEqual(parse(await send(logAction,value)),{code:0,logs:[]}); //No invented scored/training log.
    assert.deepEqual(parse(await send(entryAction,value)),expected(Number(firstId))); //No reset of the native clear.
    assert.equal(app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===trainingStage.adventureStageId).cumulativeClearCount,1);
    await reject(trainingValue,503,trainingCached,trainingAction);assert.equal(app.store.hardCurrency(),trainingWallet);
    //DEFERRED / NOT RUN: scored damage/import/save/ACK and real private history.
    //These are synthetic protocol probes, not native earning or visual acceptance.
    const detailAction='familia/get',detailValue={familiaId:1},detailBeforeScore=await send(detailAction,detailValue),
      detailBeforeScoreSequence=sequence;
    assert.equal(parse(detailBeforeScore).familia.latestGuildRaidRank,0);
    let raidLobby=parse(await get()),scoredUsers=app.store.read('UserInfo').data,latestRankingReplays=[],
      emptyRankingsInvalidated=false,detailRankInvalidated=false;
    const earned=[];
    const scoredRun=async(damage,token,resetDuringBattle=false)=>{
      const statusBefore=await get(),statusBeforeReplay={sequence,body:statusBefore.body};
      assert.deepEqual(parse(statusBefore),raidLobby);
      const beforeRecords=app.store.read('UserGuildRaidRecord').data,beforeStages=app.store.read('UserAdventureStage').data,
        authored=master.guildRaidStages[raidLobby.guildRaidStageId],stage=beforeStages.find(row=>row.adventureStageId===authored.adventureStageId);
      assert.deepEqual(parse(await send(entryAction,value)),raidLobby);
      const active=[{...app.store.read('UserAdventureState').data[0],stageId:stage.adventureStageId,
        userGuildRaidScore:{guildRaidStageId:raidLobby.guildRaidStageId,enemyDamage:[]}}];
      parse(await saveAdventure(active));
      const unspentUsers=structuredClone(scoredUsers),unspentCheckpoint=attemptCheckpoint();
      scoredUsers=[{...scoredUsers[0],playerStatus:{...scoredUsers[0].playerStatus,graidSP:scoredUsers[0].playerStatus.graidSP-1}}];
      const activeEntry=app.store.db.prepare('SELECT * FROM guild_raid_entry').get(),
        debitReceipt=()=>app.store.db.prepare('SELECT * FROM guild_raid_attempt_debit WHERE entry_request_key=?').get(activeEntry.request_key);
      for(const [table,event] of [['guild_raid_attempt_checkpoint','UPDATE'],['guild_raid_attempt_debit','INSERT'],['profile','UPDATE'],['reply_cache','INSERT']]) {
        const beforeDebitProfiles=native(),beforeDebitMeta=app.store.db.prepare('SELECT * FROM meta ORDER BY key').all(),beforeDebitEntries=entryRows(),
          beforeDebits=app.store.db.prepare('SELECT * FROM guild_raid_attempt_debit ORDER BY entry_request_key').all();
        app.store.db.exec(`CREATE TRIGGER fail_raid_attempt_debit BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'deferred attempt debit rollback'); END`);
        assert.equal((await saveRaidSp(scoredUsers)).status,503);assert.deepEqual(native(),beforeDebitProfiles);
        assert.deepEqual(attemptCheckpoint(),unspentCheckpoint);assert.deepEqual(entryRows(),beforeDebitEntries);
        assert.deepEqual(app.store.db.prepare('SELECT * FROM guild_raid_attempt_debit ORDER BY entry_request_key').all(),beforeDebits);
        assert.deepEqual(app.store.db.prepare('SELECT * FROM meta ORDER BY key').all(),beforeDebitMeta);
        app.store.db.exec('DROP TRIGGER fail_raid_attempt_debit');
      }
      parse(await saveRaidSp(scoredUsers));
      assert.deepEqual(JSON.parse(attemptCheckpoint().status_json),attempts(scoredUsers));
      const spentReceipt=debitReceipt();
      assert.equal(spentReceipt.entry_hash,activeEntry.capture_hash);assert.equal(spentReceipt.entry_json,activeEntry.capture_json);
      assert.deepEqual(JSON.parse(spentReceipt.observed_json),{at:now,status:attempts(scoredUsers)});
      const spentProfiles=native(),spentCheckpoint=attemptCheckpoint();
      for(const rows of [unspentUsers,scoredUsers.map(row=>({...row,playerStatus:{...row.playerStatus,graidSP:row.playerStatus.graidSP-1}})),
        scoredUsers.map(row=>({...row,playerStatus:{...row.playerStatus,consumedNormalSP:row.playerStatus.consumedNormalSP+1}}))]) {
        assert.equal((await saveRaidSp(rows)).status,400);assert.deepEqual(native(),spentProfiles);
        assert.deepEqual(attemptCheckpoint(),spentCheckpoint);
      }
      if(resetDuringBattle) {
        now=(Math.floor((now+32400)/86400)+1)*86400-32400;
        const reset=guildRaidAttemptState(master,guildRaidNativeEvent(master,now,true),scoredUsers[0].playerStatus,now);
        scoredUsers=scoredUsers.map(row=>({...row,playerStatus:{...row.playerStatus,...reset}}));
        parse(await saveRaidSp(scoredUsers));assert.deepEqual(JSON.parse(attemptCheckpoint().status_json),attempts(scoredUsers));
        assert.deepEqual(debitReceipt(),spentReceipt,'A later reset must retain the actual once-only debit');
        const wrongMode={...trainingValue,adventureStageId:stage.adventureStageId,guildRaidStageId:raidLobby.guildRaidStageId,
          loopCount:raidLobby.loopCount,token:'charged-entry-cannot-be-training'};
        await reject(wrongMode,503,null,trainingAction);
        await close();await open();assert.deepEqual(debitReceipt(),spentReceipt);
      }
      const body={...scoredValue,adventureStageId:stage.adventureStageId,guildRaidStageId:raidLobby.guildRaidStageId,
        loopCount:raidLobby.loopCount,token,bosses:authored.bossHp.map((hp,enemyIndex)=>({enemyIndex,damage:hp ? damage(enemyIndex) : 0}))},
        profiles=native(),response=await send(trainingAction,body),identity=sequence,result=parse(response),operation=result.operation,
        target=result.data.UserGuildRaidRecord,recordToken=result.dataTokens.UserGuildRaidRecord;
      assert.deepEqual(native(),profiles);assert.equal(operation.type,23200);assert.equal(operation.parameters.isTraining,false);
      assert.equal(operation.parameters.rank,1);
      assert.equal(operation.parameters.isRecorded,true);assert.equal(operation.parameters.guildRaidStageId,raidLobby.guildRaidStageId);
      assert.equal(recordToken,md5(target));assert.deepEqual((await request(port,identity,body,String(identity),trainingAction)).body,response.body);
      assert.equal(app.store.db.prepare('SELECT entry_request_key FROM guild_raid_completion WHERE operation_id=?').get(operation.id).entry_request_key,
        activeEntry.request_key);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM guild_raid_scored_completion').get().n,earned.length+1);
      const importOnly={badges:null,scripts:{},dataTokens:{UserGuildRaidRecord:recordToken},
        checksums:{before:{},after:{UserInfo:md5(scoredUsers)}},
        deltas:[{signature:0,trigger:'RaidImport',deleteItems:{},putItems:{UserInfo:scoredUsers}}],operations:[]};
      const imported=parse(await send('user_data/push',importOnly));
      assert.ok(imported.operations.some(row=>row.id===operation.id)); //Record import alone is not an additive clear.
      assert.deepEqual(app.store.read('UserGuildRaidRecord').data,beforeRecords);
      assert.equal(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id).observed,
        JSON.stringify(['raidRecord']));
      const settled={...stage,state:4,cumulativeClearCount:stage.cumulativeClearCount+1,
        firstCompleteDateTime:stage.firstCompleteDateTime || now,lastCompleteDateTime:now},
        stagesAfter=beforeStages.map(row=>row.adventureStageId===stage.adventureStageId ? settled : row),finished=[{...active[0],stageId:0}];
      const noImport={...trainingAck,checksums:{before:{},after:{UserAdventureStage:md5(stagesAfter),UserAdventureState:md5(finished)}},
        deltas:[{signature:0,trigger:'AdventureComplete',deleteItems:{},putItems:{UserAdventureStage:[settled],UserAdventureState:finished}}],
        operations:[{id:operation.id,verifier:operation.token}]};
      //The prior durable token observation permits a later ACK without another import/delta.
      await close();await open();parse(await send('user_data/push',noImport));
      assert.deepEqual(app.store.operations(),[]);assert.deepEqual(app.store.read('UserGuildRaidRecord').data,target);
      assert.deepEqual(JSON.parse(attemptCheckpoint().status_json),attempts(scoredUsers));
      assert.equal((await saveRaidSp(unspentUsers)).status,400,'ACK cannot remove the spent-attempt checkpoint');
      assert.equal(app.store.read('UserGuildRaidRecord').token,recordToken);assert.equal(app.store.hardCurrency(),trainingWallet);
      await reject(body,503,{sequence:identity},trainingAction);
      earned.push({operation,target});
      assert.equal((await request(port,statusBeforeReplay.sequence,value,String(statusBeforeReplay.sequence),action)).status,503,
        'A cached raid status cannot retain the prior local rank or score state');
      if(!detailRankInvalidated) {
        assert.equal((await request(port,detailBeforeScoreSequence,detailValue,String(detailBeforeScoreSequence),detailAction)).status,503,
          'Cached Familia details cannot retain rank0 after the first acknowledged raid score');
        detailRankInvalidated=true;
      }
      assert.equal(parse(await send(detailAction,detailValue)).familia.latestGuildRaidRank,1,
        'Familia details project the acknowledged current-generation raid rank');
      raidLobby=parse(await get());
      assert.equal(raidLobby.rank,1,'Acknowledged local Familia score projects rank 1 in status');
      assert.deepEqual(raidLobby.ranking,[],'Unknown peer summary remains empty');
      const log=parse(await send(logAction,value));assert.equal(log.logs.length,earned.length);
      assert.equal(log.logs[0].params.p1,operation.parameters.score);assert.equal(log.logs[0].params.p2,body.guildRaidStageId);
      assert.equal(log.logs[0].playerName,scoredUsers[0].name);assert.equal(log.logs[0].leaderPc.pcId,leaderId);
      const memberRanking={code:0,ranking:[{rank:1,
        score:target.find(row=>row.guildRaidId===Number(firstId)).scoreInt64,
        member:{userId:seed.userId,name:log.logs[0].playerName,leaderPc:log.logs[0].leaderPc}}]};
      for(const stale of latestRankingReplays)
        assert.equal((await request(port,stale.sequence,value,String(stale.sequence),stale.route)).status,503,
          'A cached raid ranking cannot preserve an earlier score');
      if(!emptyRankingsInvalidated) {
        for(const stale of emptyRankingReplays)
          assert.equal((await request(port,stale.sequence,value,String(stale.sequence),stale.route)).status,503,
            'A cached empty raid ranking cannot hide an acknowledged score');
        emptyRankingsInvalidated=true;
      }
      const memberRankingResponse=await send(rankAction,value);
      latestRankingReplays=[{route:rankAction,sequence,body:memberRankingResponse.body}];
      assert.deepEqual(parse(memberRankingResponse),memberRanking);
      const savedFamilia=app.store.db.prepare('SELECT id,settings FROM local_familia WHERE id=1').get(),
        savedSettings=JSON.parse(savedFamilia.settings),familiaRanking={code:0,ranking:[{
        rank:1,score:target.find(row=>row.guildRaidId===Number(firstId)).scoreInt64,
        familia:{id:savedFamilia.id,name:savedSettings.name,godId:savedSettings.godId}}]};
      for(const route of familiaRankActions) {
        const familiaRankingResponse=await send(route,value);
        latestRankingReplays.push({route,sequence,body:familiaRankingResponse.body});
        assert.deepEqual(parse(familiaRankingResponse),familiaRanking);
      }
      for(const replay of latestRankingReplays)
        assert.deepEqual((await request(port,replay.sequence,value,String(replay.sequence),replay.route)).body,replay.body);
      const activeTime=now;now=firstEvent.window7+1;
      assert.deepEqual(parse(await send(rankAction,value)),memberRanking);
      for(const route of familiaRankActions)assert.deepEqual(parse(await send(route,value)),familiaRanking);
      await reject(value,503,null,action);await reject(value,503,null,logAction);
      now=activeTime;
      assert.deepEqual(target.find(row=>row.guildRaidId===otherEarnedRecord.guildRaidId),otherEarnedRecord);
      return operation;
    };
    const damaged=await scoredRun(()=>1,'deferred-scored-damage',true);
    assert.equal(damaged.parameters.defeatNow,false);assert.equal(raidLobby.guildRaidStageId,Number(first[0]));
    assert.deepEqual(raidLobby.bosses,expected(Number(firstId)).bosses.map(boss=>({...boss,hp:boss.hp-1})));
    const defeated=await scoredRun(()=>0x7fffffff,'deferred-scored-defeat');
    assert.equal(defeated.parameters.defeatNow,true);assert.equal(defeated.parameters.guildRaidStageId,Number(first[0]));
    assert.notEqual(raidLobby.guildRaidStageId,Number(first[0]));assert.equal(raidLobby.defeatCount,1);
    assert.equal(raidLobby.defeatRewardExists,true);assert.equal(raidLobby.displayDefeatStageId,Number(first[0]));
    const scoredRecords=app.store.read('UserGuildRaidRecord').data,rewound=scoredRecords.map(row=>row.guildRaidId===Number(firstId) ?
      {...row,scoreInt64:row.scoreInt64-1} : row);
    assert.equal((await send('user_data/push',{...trainingAck,operations:[],checksums:{before:{},after:{UserGuildRaidRecord:md5(rewound)}},
      deltas:[{signature:0,trigger:'RaidRecord',deleteItems:{},putItems:{UserGuildRaidRecord:rewound}}]})).status,400);
    assert.deepEqual(app.store.read('UserGuildRaidRecord').data,scoredRecords);
    const savedLobby=raidLobby,latestScored=app.store.db.prepare(`SELECT scored.operation_id,scored.settlement_json,
      delivery.operation_json FROM guild_raid_scored_completion scored JOIN stage_delivery delivery
      ON delivery.operation_id=scored.operation_id ORDER BY scored.operation_id DESC LIMIT 1`).get(),
      currentSettlement=JSON.parse(latestScored.settlement_json),currentOperation=JSON.parse(latestScored.operation_json),
      legacySettlement=JSON.stringify({...currentSettlement,statusAfter:{...currentSettlement.statusAfter,rank:0}}),
      legacyOperation=JSON.stringify({...currentOperation,parameters:{...currentOperation.parameters,rank:0}});
    app.store.db.prepare('UPDATE guild_raid_scored_completion SET settlement_json=? WHERE operation_id=?')
      .run(legacySettlement,latestScored.operation_id);
    app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?')
      .run(legacyOperation,latestScored.operation_id);
    assert.deepEqual(parse(await get()),savedLobby,'Legacy immutable rank0 receipt projects current rank1');
    assert.equal(parse(await send(detailAction,detailValue)).familia.latestGuildRaidRank,1,
      'Legacy immutable rank0 receipt also projects rank1 in Familia details');
    assert.equal(app.store.db.prepare('SELECT settlement_json FROM guild_raid_scored_completion WHERE operation_id=?')
      .get(latestScored.operation_id).settlement_json,legacySettlement,'Legacy receipt is not rewritten');
    assert.equal(app.store.db.prepare('SELECT operation_json FROM stage_delivery WHERE operation_id=?')
      .get(latestScored.operation_id).operation_json,legacyOperation,'Legacy completion reply is not rewritten');
    app.store.db.prepare('UPDATE guild_raid_scored_completion SET settlement_json=? WHERE operation_id=?')
      .run(JSON.stringify({...currentSettlement,statusAfter:{...currentSettlement.statusAfter,rank:2}}),latestScored.operation_id);
    await reject();
    await reject(detailValue,503,null,detailAction);
    app.store.db.prepare('UPDATE guild_raid_scored_completion SET settlement_json=? WHERE operation_id=?')
      .run(latestScored.settlement_json,latestScored.operation_id);
    app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?')
      .run(latestScored.operation_json,latestScored.operation_id);
    const latestDelivery=app.store.db.prepare('SELECT * FROM stage_delivery WHERE operation_id=?').get(latestScored.operation_id),
      deliveryKeys=Object.keys(latestDelivery);
    app.store.db.prepare('DELETE FROM stage_delivery WHERE operation_id=?').run(latestScored.operation_id);
    await reject();
    await reject(detailValue,503,null,detailAction);
    app.store.db.prepare(`INSERT INTO stage_delivery(${deliveryKeys.join(',')}) VALUES(${deliveryKeys.map(()=>'?').join(',')})`)
      .run(...deliveryKeys.map(key=>latestDelivery[key]));
    put('UserGuildRaidRecord',rewound);
    await reject(detailValue,503,null,detailAction);
    put('UserGuildRaidRecord',scoredRecords);
    await close();await open();assert.deepEqual(parse(await get()),savedLobby);
    assert.equal(parse(await send(detailAction,detailValue)).familia.latestGuildRaidRank,1,
      'Acknowledged Familia raid rank survives a cold server restart');
    for(const replay of latestRankingReplays)
      assert.deepEqual((await request(port,replay.sequence,value,String(replay.sequence),replay.route)).body,replay.body,
        'Current raid ranking survives restart');
    //DEFERRED / NOT RUN:23210 grants original items on the client; never precredit the profiles.
    const rewardAction='guild_raid/reward/defeat',rewardProfiles=native(),rewardRecords=app.store.read('UserGuildRaidRecord').data,
      rewardState=app.store.read('UserGuildRaidState').data,rewardResponse=await send(rewardAction,value),rewardIdentity=sequence,
      rewardResult=parse(rewardResponse),rewardOperation=rewardResult.operation,
      targets=app.store.db.prepare('SELECT * FROM guild_raid_reward_item_claim WHERE operation_id=? ORDER BY item_id').all(rewardOperation.id);
    assert.equal(rewardOperation.type,23210);assert.deepEqual(native(),rewardProfiles);assert.equal(app.store.hardCurrency(),trainingWallet);
    assert.deepEqual(rewardResult.guildRaidDefeatReward,[{defeatRewardId:master.guildRaidStageDefeatRewards[first[0]],guildRaidStageId:Number(first[0])}]);
    assert.deepEqual(app.store.db.prepare('SELECT defeat_operation_id FROM guild_raid_defeat_claim').all(),[{defeat_operation_id:defeated.id}]);
    assert.deepEqual((await request(port,rewardIdentity,value,String(rewardIdentity),rewardAction)).body,rewardResponse.body);
    assert.equal(parse(await send(rewardAction,value)).operation.id,rewardOperation.id);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM guild_raid_reward_claim').get().n,1);
    const rewardPush=(putItems={},ack=false)=>send('user_data/push',{badges:null,scripts:{},dataTokens:{},
      checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
      deltas:Object.keys(putItems).length ? [{signature:0,trigger:'GuildRaidDefeatReward',deleteItems:{},putItems}] : [],
      operations:ack ? [{id:rewardOperation.id,verifier:rewardOperation.token}] : []});
    assert.equal((await rewardPush({},true)).status,400);assert.deepEqual(native(),rewardProfiles);
    assert.ok(targets.length>=2);
    const applyReward=target=>{
      const rows=app.store.read(target.table_name).data,existing=rows.find(row=>row[target.id_field]===target.item_id),
        item={...(existing ?? {userId:selected[0].userId,[target.id_field]:target.item_id,amount:0,
          cumulativeAmount:0,bookEntryState:1,reservedAmount:0,signature:0}),
          amount:(existing?.amount ?? 0)+target.amount,cumulativeAmount:target.cumulative_amount};
      return existing ? rows.map(row=>row[target.id_field]===target.item_id ? item : row) : rows.concat(item);
    };
    parse(await rewardPush({[targets[0].table_name]:applyReward(targets[0])}));
    assert.equal(app.store.db.prepare('SELECT observed FROM guild_raid_reward_claim WHERE operation_id=?').get(rewardOperation.id).observed,
      JSON.stringify([targets[0].item_id]));
    assert.equal((await rewardPush({},true)).status,400);
    await reject(value,503,{sequence:rewardIdentity},rewardAction);
    await close();await open();
    //A split native save finishes the same claim, not a second award after restart.
    const remaining={};
    for(const target of targets.slice(1)) {
      const rows=remaining[target.table_name] ?? app.store.read(target.table_name).data,
        existing=rows.find(row=>row[target.id_field]===target.item_id),
        item={...(existing ?? {userId:selected[0].userId,[target.id_field]:target.item_id,amount:0,
          cumulativeAmount:0,bookEntryState:1,reservedAmount:0,signature:0}),
          amount:(existing?.amount ?? 0)+target.amount,cumulativeAmount:target.cumulative_amount};
      remaining[target.table_name]=existing ? rows.map(row=>row[target.id_field]===target.item_id ? item : row) : rows.concat(item);
    }
    parse(await rewardPush(remaining,true));assert.deepEqual(app.store.operations(),[]);
    assert.deepEqual(app.store.read('UserGuildRaidRecord').data,rewardRecords);
    assert.deepEqual(app.store.read('UserGuildRaidState').data,rewardState);assert.equal(app.store.hardCurrency(),trainingWallet);
    const claimedLobby=parse(await get());assert.deepEqual(claimedLobby,{...savedLobby,defeatRewardExists:false});
    await reject(value,503,{sequence:rewardIdentity},rewardAction);await reject(value,503,null,rewardAction);
    const firstTarget=targets[0],savedItems=app.store.read(firstTarget.table_name).data,
      rewind=savedItems.map(row=>row[firstTarget.id_field]===firstTarget.item_id ? {...row,cumulativeAmount:firstTarget.cumulative_amount-1} : row);
    assert.equal((await rewardPush({[firstTarget.table_name]:rewind})).status,400);
    assert.deepEqual(app.store.read(firstTarget.table_name).data,savedItems);
    await close();await open();assert.deepEqual(parse(await get()),claimedLobby);
    //DEFERRED / NOT RUN: popup-seen state is not a reward claim or an earned-record reset.
    const saveSeen=rows=>send('user_data/push',{badges:null,scripts:{},dataTokens:{},
      checksums:{before:{},after:{UserGuildRaidState:md5(rows)}},
      deltas:[{signature:0,trigger:'GuildRaidResetCount',deleteItems:{},putItems:{UserGuildRaidState:rows}}],operations:[]}),
      seen=[{...rewardState[0],guildRaidId:Number(firstId),readDefeatCount:1}];
    parse(await saveSeen(seen));assert.deepEqual(app.store.read('UserGuildRaidState').data,seen);
    assert.deepEqual(parse(await get()),claimedLobby);assert.deepEqual(app.store.read('UserGuildRaidRecord').data,rewardRecords);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM guild_raid_reward_claim').get().n,1);
    await reject(value,503,null,rewardAction);assert.equal(app.store.hardCurrency(),trainingWallet);
    assert.equal((await saveSeen([{...seen[0],readDefeatCount:2}])).status,400);
    assert.deepEqual(app.store.read('UserGuildRaidState').data,seen);
    //Seen state must survive a new selected entry/battle; no zero-only gate.
    assert.deepEqual(parse(await send(entryAction,value)),claimedLobby);
    await close();await open();assert.deepEqual(app.store.read('UserGuildRaidState').data,seen);
    assert.deepEqual(parse(await get()),claimedLobby);
    const changedEvent=[{...seen[0],guildRaidId:Number(events[1][0]),readDefeatCount:0}];
    parse(await saveSeen(changedEvent));assert.deepEqual(parse(await get()),claimedLobby);
    parse(await saveSeen(seen));assert.deepEqual(parse(await get()),claimedLobby);
    const seenAuthored=master.guildRaidStages[claimedLobby.guildRaidStageId],seenStages=app.store.read('UserAdventureStage').data,
      seenStage=seenStages.find(row=>row.adventureStageId===seenAuthored.adventureStageId),
      seenBattle=[{...app.store.read('UserAdventureState').data[0],stageId:seenStage.adventureStageId,
        userGuildRaidScore:{guildRaidStageId:claimedLobby.guildRaidStageId,enemyDamage:[]}}];
    assert.deepEqual(parse(await send(entryAction,value)),claimedLobby);parse(await saveAdventure(seenBattle));
    const seenTraining={...trainingValue,adventureStageId:seenStage.adventureStageId,guildRaidStageId:claimedLobby.guildRaidStageId,
      loopCount:claimedLobby.loopCount,token:'deferred-seen-training',bosses:seenAuthored.bossHp.map((hp,enemyIndex)=>({enemyIndex,damage:0}))},
      seenOperation=parse(await send(trainingAction,seenTraining)).operation;
    assert.equal(seenOperation.type,23200);assert.equal(seenOperation.parameters.isTraining,true);
    assert.deepEqual(app.store.read('UserGuildRaidState').data,seen);
    const seenClear={...seenStage,state:4,cumulativeClearCount:seenStage.cumulativeClearCount+1,
      firstCompleteDateTime:seenStage.firstCompleteDateTime || now,lastCompleteDateTime:now},
      seenAfter=seenStages.map(row=>row.adventureStageId===seenStage.adventureStageId ? seenClear : row),
      seenFinished=[{...seenBattle[0],stageId:0}],seenAck={...trainingAck,
        checksums:{before:{},after:{UserAdventureStage:md5(seenAfter),UserAdventureState:md5(seenFinished)}},
        deltas:[{signature:0,trigger:'AdventureComplete',deleteItems:{},putItems:{UserAdventureStage:[seenClear],UserAdventureState:seenFinished}}],
        operations:[{id:seenOperation.id,verifier:seenOperation.token}]};
    await close();await open();parse(await send('user_data/push',seenAck));
    assert.deepEqual(parse(await get()),claimedLobby);assert.deepEqual(app.store.read('UserGuildRaidState').data,seen);
    assert.deepEqual(app.store.read('UserGuildRaidRecord').data,rewardRecords);assert.equal(app.store.hardCurrency(),trainingWallet);
    assert.equal(parse(await send(logAction,value)).logs.length,earned.length);
    console.log('Original Familia raid status/entry, selected party/generation, retained history/cache/rollback/restart: OK');
  } finally {
    await close();assert.equal(path.dirname(fs.realpathSync(directory)),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-guild-raid-status-'));fs.rmSync(directory,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
