'use strict';
// DEFERRED: run only after packet implementation is finished. Imported
// synthetic history is not proof of natural earning, score arithmetic or UI.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs'),{request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-gve-player-')),database=path.join(directory,'profile.sqlite');
  let app,port,sequence=0;
  const open=async()=>{
    app=createServer({database,seed,master,eventDate:'2019-10-20',wallNowSeconds:()=>2000000000,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
    app.store.read('UserGvERecord');app.store.read('UserGvEHighScoreParty');
  };
  const close=async()=>{if(app)await app.close();app=null;};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);};
  const put=(name,data)=>{app.store.read(name);app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(data),md5(data),name);};
  const native=()=>app.store.db.prepare('SELECT * FROM profile ORDER BY name').all();
  const gveId=master.gveInformationIds[0],value={gveId,targetUserId:seed.userId},action='gve/player_info/get',
    characterAction='gve/ranking/character/get',characterValue={gveId};
  const view=(body=value)=>send(action,body),replay=seq=>request(port,seq,value,String(seq),action);
  const characterView=()=>send(characterAction,characterValue);
  const reject=async(body=value,status=503,route=action)=>{
    const before=native(),queue=app.store.operations(),wallet=app.store.hardCurrency(),response=await send(route,body);
    assert.equal(response.status,status,response.body.toString());
    if(status===503) assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.deepEqual(native(),before);assert.deepEqual(app.store.operations(),queue);assert.deepEqual(app.store.hardCurrency(),wallet);
  };
  const rejectCharacters=(body=characterValue,status=503)=>reject(body,status,characterAction);
  const record={userId:seed.userId,gveId,score:1234,eventHighScore:1234,dailyHighScore:1234,lastResetScoreAt:0,
    gveHighScoreStageId:Number(Object.keys(master.gveStages).find(id=>master.gveStages[id].gveId===gveId)),
    isReceiveFamiliaRankingReward:false,scoreInt64:1234,lastReceivedDailyRewardAt:0};
  const party={...structuredClone(seed.data.UserPvBHighScoreParty[0]),gveId,familiaPc:{skillIds:[]}};
  const ranks=snapshot=>({code:0,ranking:Object.fromEntries([['normal','pc'],['assist','assistingPc']].map(([kind,key])=>
    [kind,[...new Set(snapshot.slots.map(slot=>slot[key]?.pcId).filter(Boolean))].sort((a,b)=>a-b).map(pcId=>({rank:1,pcId}))]))});
  try {
    await open();await reject();await rejectCharacters();
    for(const bad of [null,{},[],{gveId:0},{gveId:1.5},{gveId:'1'},value,{gveId,extra:true}])
      await rejectCharacters(bad,400);
    for(const bad of [null,{},[],{gveId}, {...value,targetUserId:0},{...value,gveId:0},{...value,gveId:1.5},
      {...value,targetUserId:'1'},{...value,extra:true}]) await reject(bad,400);
    await reject({...value,targetUserId:seed.userId+1});
    put('UserCurrency',[{userId:seed.userId,currencyId:master.currencies['currency.valis'],amount:500000,
      cumulativeAmount:500000,reservedAmount:0,signature:0}]);
    const created=parse(await send('familia/create',{name:'GveHistory',description:'Deferred historical detail fixture',godId:20000001,
      style:21000001,subStyle:0,activeTime:22000001,subActiveTime:0,requireApproval:false})),charge=created.operations[0];
    await reject();
    const currency=app.store.read('UserCurrency').data.map(row=>({...row,amount:row.amount-100000}));
    parse(await send('user_data/push',{badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserCurrency:md5(currency)}},
      deltas:[{signature:0,trigger:'Familia',deleteItems:{},putItems:{UserCurrency:currency}}],operations:[{id:charge.id,verifier:charge.token}]}));
    await reject();assert.deepEqual(parse(await characterView()),{code:0,ranking:{normal:[],assist:[]}});
    put('UserGvERecord',[record]);await reject();await rejectCharacters();put('UserGvEHighScoreParty',[party]);
    // A deliberately incomplete isolated pending fixture must remain queued,
    // not be converted into a fake acknowledged result by this read packet.
    const pending=app.store.issueOperation(23100,{});await reject();await rejectCharacters();
    app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(pending.id);
    const before=native(),wallet=app.store.hardCurrency(),response=await view(),identity=sequence,body=parse(response);
    assert.deepEqual(Object.keys(body).sort(),['code','gveParty','playerInfo']);assert.deepEqual(body.gveParty,party);
    assert.equal(body.playerInfo.userId,seed.userId);assert.equal(body.gveRecord,undefined);
    const characterResponse=await characterView(),characterSequence=sequence;
    assert.deepEqual(parse(characterResponse),ranks(party),'Only actual historical identities are ranked; no usage counts/percentage root');
    assert.deepEqual((await request(port,characterSequence,characterValue,String(characterSequence),characterAction)).body,characterResponse.body);
    assert.deepEqual(native(),before);assert.deepEqual(app.store.hardCurrency(),wallet);assert.deepEqual(app.store.operations(),[]);
    assert.deepEqual((await replay(identity)).body,response.body);
    const active=app.store.read('UserParty').data;
    put('UserParty',active.map(row=>({...row,slots:row.slots?.map(slot=>({...slot,pcId:0}))})));
    assert.deepEqual(parse(await view()).gveParty,party,'Today\'s team cannot replace the historical snapshot');
    assert.deepEqual(parse(await characterView()),ranks(party));put('UserParty',active);
    const nullable=structuredClone(party);nullable.slots[0].assistingPc=null;
    put('UserGvEHighScoreParty',[nullable]);assert.deepEqual(parse(await view()).gveParty,nullable);
    assert.deepEqual(parse(await characterView()),ranks(nullable));
    if(JSON.stringify(ranks(nullable))!==JSON.stringify(ranks(party)))
      assert.equal((await request(port,characterSequence,characterValue,String(characterSequence),characterAction)).status,503);
    assert.equal((await replay(identity)).status,503,'Cached native importer cannot restore an old party');
    const skilled=structuredClone(party);skilled.familiaPc.skillIds=[Object.values(master.familiaSkills)[0].pcSkillId];
    put('UserGvEHighScoreParty',[skilled]);assert.deepEqual(parse(await view()).gveParty,skilled);
    assert.deepEqual(parse(await characterView()),ranks(skilled),'Familia skills are not fabricated assist PC usage');
    for(const damage of [
      p=>{p.userId=seed.userId+1;},p=>{p.familiaPc=null;},p=>{p.familiaPc.skillIds=[0x7fffffff];},
      p=>{p.slots[0].pc.pcId=0x7fffffff;},p=>{p.slots[0].pc.hp=0.5;},
      p=>{p.slots[1].slotNumber=p.slots[0].slotNumber;},p=>{p.memoriaSlots[0].otherMemoria.memoriaId=0x7fffffff;}
    ]) {const broken=structuredClone(party);damage(broken);put('UserGvEHighScoreParty',[broken]);await reject();await rejectCharacters();}
    put('UserGvEHighScoreParty',[party,party]);await reject();await rejectCharacters();put('UserGvEHighScoreParty',[party]);
    for(const damage of [r=>{r.userId=seed.userId+1;},r=>{r.score=0x80000000;},r=>{r.scoreInt64=Number.MAX_SAFE_INTEGER+1;},
      r=>{delete r.dailyHighScore;},r=>{r.isReceiveFamiliaRankingReward=0;},r=>{r.gveHighScoreStageId=0;},
      r=>{r.gveHighScoreStageId=Number(Object.keys(master.gveStages).find(id=>master.gveStages[id].gveId!==gveId));},
      r=>{r.scoreInt64=r.eventHighScore=r.dailyHighScore=0;}
    ]) {const broken={...record};damage(broken);put('UserGvERecord',[broken]);await reject();await rejectCharacters();}
    put('UserGvERecord',[record,record]);await reject();await rejectCharacters();put('UserGvERecord',[record]);
    // Corrupt isolated private-floor fixtures are rejection probes, not proof
    // of an earned score or result-to-party save/ACK correspondence.
    const generation=app.store.db.prepare('SELECT creation_operation_id FROM local_familia WHERE id=1').get().creation_operation_id;
    app.store.db.prepare('INSERT INTO gve_record(gve_id,familia_operation_id,record_json,last_operation_id) VALUES(?,?,?,?)')
      .run(gveId,generation+1,JSON.stringify(record),charge.id);
    await reject();await rejectCharacters();
    app.store.db.prepare('UPDATE gve_record SET familia_operation_id=?,last_operation_id=? WHERE gve_id=?')
      .run(generation,Number.MAX_SAFE_INTEGER,gveId);
    await reject();await rejectCharacters();
    app.store.db.prepare('UPDATE gve_record SET last_operation_id=?,record_json=? WHERE gve_id=?')
      .run(charge.id,JSON.stringify({...record,scoreInt64:1235}),gveId);
    await reject();await rejectCharacters();app.store.db.prepare('DELETE FROM gve_record WHERE gve_id=?').run(gveId);
    const current=parse(await view()),currentSeq=sequence;
    const infos=app.store.read('UserInfo').data;put('UserInfo',infos.map(row=>({...row,name:'Changed history owner'})));
    assert.equal((await replay(currentSeq)).status,503);const renamed=parse(await view());
    assert.equal(renamed.playerInfo.name,'Changed history owner');assert.deepEqual(renamed.gveParty,current.gveParty);
    assert.deepEqual((await request(port,characterSequence,characterValue,String(characterSequence),characterAction)).body,
      characterResponse.body,'Live public-name changes do not rewrite historical character usage');
    const profiles=native(),meta=app.store.db.prepare('SELECT * FROM meta ORDER BY rowid').all();
    app.store.db.exec("CREATE TRIGGER fail_gve_view_reply BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'deferred rollback'); END");
    assert.equal((await view()).status,503);assert.deepEqual(native(),profiles);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM meta ORDER BY rowid').all(),meta);app.store.db.exec('DROP TRIGGER fail_gve_view_reply');
    await close();await open();assert.deepEqual(parse(await view()),renamed);assert.deepEqual(parse(await characterView()),ranks(party));
    parse(await send('familia/break',null));await reject();await rejectCharacters();
    assert.deepEqual(app.store.read('UserGvERecord').data,[record]);assert.deepEqual(app.store.read('UserGvEHighScoreParty').data,[party]);
    console.log('Deferred GVE player-info wire/history/cache checks passed; NOT native earning/UI acceptance');
  } finally {
    await close();const resolved=fs.realpathSync(directory),temp=fs.realpathSync(os.tmpdir());
    if(path.dirname(resolved)!==temp || !path.basename(resolved).startsWith('danmemore-gve-player-')) throw new Error('Unsafe fixture cleanup path');
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
