'use strict';

// DEFERRED synthetic wire/save checks, NOT native earning, publisher ranks,
// War Game combat/season transitions, signatures or emulator acceptance.
// Includes native absent-record lobby semantics, original season/grade joins,
// shared save/read validation and stale native record-pull protection.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json');
const master=require('../data/danmemore-master.json');
const action='pvp/friend/ranking/get',id=master.pvpInformationIds[0],other=master.pvpInformationIds[1];
const gradeId=master.pvpGradeIds[0],md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
const blank={code:0,friendRanking:[],hasNextPage:false};
const status={userId:seed.userId,friendId:seed.userId,followCount:0,followerCount:0,
  followerListLastViewedAt:0,noticeBadgeDisplay:false};
const seasonGrade=pvpId=>Number(Object.entries(master.pvp.grades).find(([,row])=>row.groupId===pvpId)[0]);
const record=pvpId=>({userId:seed.userId,pvpId,gradeId:seasonGrade(pvpId),rank:777,score:2000,winCount:1,loseCount:0,
  consecutiveWinCount:1,consecutiveLoseCount:0,lastAdversaryIds:[],lastBattleId:'synthetic-only',
  isReceiveReward:false,isAggregate:false,highestGradeId:seasonGrade(pvpId)});

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-pvp-friend-'));
  let app,port,sequence=0,now=1600000000;
  const open=async (catalog=master)=>{
    app=createServer({database:path.join(directory,'save.sqlite'),seed,master:catalog,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async ()=>{if(app) {await app.close();app=null;}};
  const send=(value,route=action)=>request(port,++sequence,
    value===undefined && route===action ? {pvpId:id} : value,String(sequence),route);
  const parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejects=async (value,expected=503,route=action)=>{
    const before=snapshot(),response=await send(value,route);
    assert.equal(response.status,expected,response.body.toString());
    if(expected===503) assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Rejected views retain saves/queue/wallet/sequence/cache');
  };
  const push=putItems=>send({badges:null,scripts:{},dataTokens:{},operations:[],
    checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(name==='UserPvPRecord' ?
      app.store.read(name).data.filter(row=>!rows.some(changed=>changed.pvpId===row.pvpId)).concat(rows) : rows)]))},
    deltas:[{signature:0,trigger:'PvPResult',putItems,deleteItems:{}}]},'user_data/push');
  try {
    await open();
    const profiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
    for(const pvpId of master.pvpInformationIds) {
      assert.deepEqual(parse(await send({pvpId})),blank);
      assert.deepEqual(parse(await send({pvpId},'pvp/summary/get')),{code:0,pvpRanking:[],pvpRecord:[]});
      assert.deepEqual(parse(await send({pvpId},'pvp/character/ranking/get')),{code:0,normal:[],assist:[]});
    }
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profiles,
      'Reading all176 original seasons must not create native records/friend flags or award anything');
    for(const page of [0,1,0x7fffffff]) assert.deepEqual(parse(await send({pvpId:id,page})),blank);
    for(const value of [null,{}, {pvpId:0},{pvpId:'1'},{pvpId:1},{pvpId:id,page:-99},
      {pvpId:id,page:-1},{pvpId:id,page:0x80000000},{pvpId:id,page:0.5},{pvpId:id,extra:true}])
      await rejects(value,400);
    assert.deepEqual(parse(await send({pvpId:id},'pvp/summary/get')),{code:0,pvpRanking:[],pvpRecord:[]});
    await rejects({targetUserId:seed.userId},503,'pvp/player_info/get');
    for(const route of ['pvp/summary/get','pvp/character/ranking/get'])
      for(const value of [null,{}, {pvpId:0},{pvpId:'1'},{pvpId:1},{pvpId:id,page:0}]) await rejects(value,400,route);
    for(const value of [null,{}, {userId:seed.userId},{targetUserId:0},{targetUserId:'1'},
      {targetUserId:seed.userId,pvpId:1},{targetUserId:seed.userId,page:0}])
      await rejects(value,400,'pvp/player_info/get');
    await rejects({targetUserId:42},503,'pvp/player_info/get');
    const emptySummary=await send({pvpId:id},'pvp/summary/get'),emptySummarySequence=sequence;
    assert.deepEqual(parse(emptySummary),{code:0,pvpRanking:[],pvpRecord:[]});
    await close();await open();
    assert.deepEqual((await request(port,emptySummarySequence,{pvpId:id},String(emptySummarySequence),'pvp/summary/get')).body,
      emptySummary.body,'Absent-season summary cache survives cold restart without a profile write');
    const first=record(id),second=record(other);
    parse(await push({UserPvPRecord:[first,second],UserFriendStatus:[status]}));
    const afterInitialized=snapshot();
    assert.equal((await request(port,emptySummarySequence,{pvpId:id},String(emptySummarySequence),'pvp/summary/get')).status,503);
    assert.equal(snapshot(),afterInitialized,'Cached absence cannot erase a newly initialized native record');
    assert.deepEqual(app.store.read('UserPvPRecord').data,[first,second]);
    const pullValue={tables:['UserPvPRecord'],consistentRead:true},pullRoute='user_data/pull',
      recordPull=await send(pullValue,pullRoute),recordPullSequence=sequence;
    assert.equal(recordPull.status,200);
    await close();await open();
    assert.deepEqual((await request(port,recordPullSequence,pullValue,String(recordPullSequence),pullRoute)).body,recordPull.body,
      'Unchanged native record pull can replay after cold restart');
    const savedInfo=app.store.read('UserInfo').data;
    for(const changed of [{userId:42},{pvpId:1},{gradeId:seasonGrade(other)},{highestGradeId:1},
      {gradeId:0},{rank:-1},{score:0x80000000},{winCount:'1'},{lastAdversaryIds:[-1]},
      {lastBattleId:42},{isReceiveReward:0},{isAggregate:0},{extra:true}]) {
      const before=snapshot(),response=await push({UserPvPRecord:[{...first,...changed}],
        UserInfo:savedInfo.map(row=>({...row,name:'Must not persist'}))});
      assert.equal(response.status,400,response.body.toString());
      assert.equal(snapshot(),before,'Malformed War Game save must not commit records, unrelated profiles, tokens, queue, wallet or reply');
    }
    parse(await push({UserPvPRecord:[{...first,score:2100}]}));
    assert.deepEqual(app.store.read('UserPvPRecord').data.find(row=>row.pvpId===other),second,'Another season is not overwritten');
    const newerRecord=snapshot();
    assert.equal((await request(port,recordPullSequence,pullValue,String(recordPullSequence),pullRoute)).status,503);
    assert.equal(snapshot(),newerRecord,'Cached native record pull cannot erase newer saved progress');
    await rejects({badges:null,scripts:{},dataTokens:{},operations:[],checksums:{before:{},after:{}},
      deltas:[{signature:0,trigger:'PvPResult',putItems:{UserPvPRecord:[first,{...first,gradeId:master.pvpGradeIds[1]}]},deleteItems:{}}]},
      400,'user_data/push');
    const expected={code:0,friendRanking:[{userId:seed.userId,name:'Player',pcId:1011001001,gradeId,rank:1,score:2100}],hasNextPage:false};
    const beforeProfiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
      beforeQueue=app.store.operations(),beforeWallet=[app.store.hardCurrency(),app.store.paidCurrency()];
    const body={pvpId:id,page:0},reply=await send(body),replaySequence=sequence;
    assert.deepEqual(parse(reply),expected);assert.deepEqual(parse(await send({pvpId:id})),expected);
    assert.deepEqual(parse(await send({pvpId:id,page:1})),blank);
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),beforeProfiles);
    assert.deepEqual(app.store.operations(),beforeQueue);assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],beforeWallet);
    assert.deepEqual((await request(port,replaySequence,body,String(replaySequence),action)).body,reply.body);
    const beforeConflict=snapshot();
    assert.equal((await request(port,replaySequence,{...body,page:1},String(replaySequence),action,
      {'X-ARGO-REQUEST-BODY-HASH':md5(body)})).status,400,'Header cannot disguise different actual wire bytes');
    assert.equal(snapshot(),beforeConflict);
    const retained=app.store.read('UserPvPRecord');
    put('UserPvPRecord',retained.data.map(row=>row.pvpId===id?{...row,score:2200}:row));
    const beforeStale=snapshot();
    assert.equal((await request(port,replaySequence,body,String(replaySequence),action)).status,503);
    assert.equal(snapshot(),beforeStale,'Stale cached ranking cannot overwrite current progress');
    assert.equal(parse(await send()).friendRanking[0].score,2200);
    now+=86400*90;assert.equal(parse(await send()).friendRanking[0].score,2200,'Clock change does not remint or mix saved seasons');
    const current=app.store.read('UserPvPRecord');
    await close();await open();assert.equal(parse(await send()).friendRanking[0].score,2200);
    assert.deepEqual(app.store.read('UserPvPRecord'),current,'Cold restart retains native telemetry/token');
    // Synthetic preowned vectors only: no native stat generation/earning proof.
    const party={...structuredClone(seed.data.UserPvBHighScoreParty[0]),attackPattern:2};
    party.slots=party.slots.map(slot=>({...slot,isHidden:false}));
    put('UserPvPParty',[party]);
    put('UserParty',app.store.read('UserParty').data.map(row=>row.id!==300 ? row : {...row,
      slots:row.slots.map(slot=>({...slot,pcId:party.slots.find(x=>x.slotNumber===slot.slotNumber).pc.pcId,
        assistingPcId:party.slots.find(x=>x.slotNumber===slot.slotNumber).assistingPc.pcId})),
      memoriaSlots:party.memoriaSlots.map(slot=>({slotNumber:slot.slotNumber,memoriaId:slot.otherMemoria.memoriaId}))}));
    const viewProfiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
    const summary=parse(await send({pvpId:id},'pvp/summary/get'));
    assert.deepEqual(summary,{code:0,pvpRanking:[{...expected.friendRanking[0],score:2200}],
      pvpRecord:[current.data.find(row=>row.pvpId===id)]});
    const details=parse(await send({pvpId:id,targetUserId:seed.userId},'pvp/player_info/get'));
    assert.deepEqual(Object.keys(details).sort(),['code','playerInfo','pvpParty','pvpRecord','substitutedSpineIds'].sort());
    assert.deepEqual(details.pvpParty,party);assert.deepEqual(details.pvpRecord,summary.pvpRecord);
    assert.equal(details.playerInfo.userId,seed.userId);assert.deepEqual(details.substitutedSpineIds,[]);
    assert.equal(details.userAdventureLevelInfo,undefined,'Optional adventure history is not manufactured');
    assert.deepEqual(parse(await send({targetUserId:seed.userId},'pvp/player_info/get')).pvpRecord,current.data);
    const absentId=master.pvpInformationIds[2];
    assert.deepEqual(parse(await send({pvpId:absentId,targetUserId:seed.userId},'pvp/player_info/get')).pvpRecord,[],
      'Scoped details for an unplayed original season must not mint a record');
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),viewProfiles);
    await rejects({pvpId:id},503,'pvp/character/ranking/get');
    await rejects({pvpId:id,targetUserId:42},503,'pvp/player_info/get');
    const infos=app.store.read('UserInfo').data;
    for(const changed of [{processingPvP:true},{processingPvPState:1}]) {
      put('UserInfo',infos.map(row=>({...row,...changed})));await rejects({pvpId:id},503,'pvp/summary/get');
    }
    for(const rows of [null,{},[],[null],infos.concat(infos)]) {
      put('UserInfo',rows);await rejects({pvpId:id},503,'pvp/summary/get');
      await rejects({targetUserId:seed.userId},503,'pvp/player_info/get');
    }
    put('UserInfo',infos.map(row=>({...row,activePvPPartyId:401})));
    await rejects({targetUserId:seed.userId},503,'pvp/player_info/get');put('UserInfo',infos);
    for(const changed of [{attackPattern:0},{slots:party.slots.map((slot,i)=>i===0 ? {...slot,pc:{...slot.pc,pcId:0}} : slot)},
      {slots:[party.slots[0],party.slots[0],...party.slots.slice(2)]}]) {
      put('UserPvPParty',[{...party,...changed}]);await rejects({targetUserId:seed.userId},503,'pvp/player_info/get');
    }
    put('UserPvPParty',[party]);
    for(const [route,value] of [['pvp/summary/get',{pvpId:id}],
      ['pvp/player_info/get',{pvpId:id,targetUserId:seed.userId}],['pvp/character/ranking/get',{pvpId:master.pvpInformationIds[2]}]]) {
      const reply=await send(value,route),seq=sequence;parse(reply);
      assert.deepEqual((await request(port,seq,value,String(seq),route)).body,reply.body);
      const before=snapshot();
      assert.equal((await request(port,seq,{...value,pvpId:other},String(seq),route,
        {'X-ARGO-REQUEST-BODY-HASH':md5(value)})).status,400);assert.equal(snapshot(),before);
      await close();await open();
      assert.deepEqual((await request(port,seq,value,String(seq),route)).body,reply.body);
      if(route!=='pvp/character/ranking/get') {
        const originalInfos=app.store.read('UserInfo').data;
        put('UserInfo',originalInfos.map(row=>({...row,name:'Changed after view'})));
        const changed=snapshot();assert.equal((await request(port,seq,value,String(seq),route)).status,503);
        assert.equal(snapshot(),changed);put('UserInfo',originalInfos);
      }
    }
    put('UserPvPRecord',[]);
    const empty=await send(body),emptySequence=sequence;
    assert.deepEqual(parse(empty),blank);
    await close();await open();
    assert.deepEqual((await request(port,emptySequence,body,String(emptySequence),action)).body,empty.body,'Cache survives restart');
    put('UserPvPRecord',[{...first,gradeId:0,highestGradeId:0,score:0,winCount:0,consecutiveWinCount:0}]);
    assert.deepEqual(parse(await send()),blank,'Uninitialized saved zero-grade row is not fabricated into a ranked player');
    const unplayed=app.store.read('UserPvPRecord');
    assert.deepEqual(parse(await send({pvpId:id},'pvp/summary/get')),{code:0,pvpRanking:[],pvpRecord:unplayed.data});
    assert.deepEqual(app.store.read('UserPvPRecord'),unplayed,'Zero-grade save remains byte/token-identical');
    for(const rows of [null,[null],[first,first],[{...first,userId:42}],[{...first,pvpId:1}],
      [{...first,gradeId:1}],[{...first,gradeId:seasonGrade(other)}],[{...first,gradeId:0}],
      [{...first,rank:-1}],[{...first,score:0x80000000}],
      [{...first,winCount:'1'}],[{...first,lastAdversaryIds:[-1]}],[{...first,lastBattleId:42}],
      [{...first,isReceiveReward:0}],[{...first,highestGradeId:1}]]) {
      put('UserPvPRecord',rows);await rejects({pvpId:id});
      assert.throws(()=>app.store.read('UserPvPRecord'),error=>error.status===503,
        'All shared record consumers reject retained malformed legacy rows');
      await rejects(pullValue,503,pullRoute);
      const malformed=snapshot();
      assert.equal((await request(port,recordPullSequence,pullValue,String(recordPullSequence),pullRoute)).status,503);
      assert.equal(snapshot(),malformed,'Old binary reply cannot conceal malformed current records');
      await rejects({badges:null,scripts:{},dataTokens:{},operations:[],checksums:{before:{},after:{}},
        deltas:[{signature:0,trigger:'PvPResult',putItems:{UserPvPRecord:[first]},deleteItems:{}}]},503,'user_data/push');
      await rejects({pvpId:id},503,'pvp/summary/get');
      await rejects({targetUserId:seed.userId},503,'pvp/player_info/get');
      await rejects({pvpId:id},503,'pvp/character/ranking/get');
    }
    put('UserPvPRecord',[]);
    const cached=await send(body),cachedSequence=sequence;parse(cached);
    const listReplies=[];
    for(const route of ['friend/following/list','friend/follower/list','friend/support/list']) {
      const value=route.endsWith('support/list')?undefined:{page:0};
      parse(await send(value,route));listReplies.push([route,value,sequence]);
    }
    for(const rows of [null,[null],[status,status],[{...status,followCount:1}],[{...status,followerCount:1}],
      [{...status,friendId:42}],[{...status,userId:42}],[{...status,followCount:'0'}],
      [{...status,followerListLastViewedAt:-1}],[{...status,noticeBadgeDisplay:0}]]) {
      put('UserFriendStatus',rows);await rejects(body);
      await rejects({page:0},503,'friend/following/list');
      await rejects({pvbId:Number(Object.keys(master.pvbEvents)[0])},503,'pvb/friend/ranking/get');
      const before=snapshot();
      assert.equal((await request(port,cachedSequence,body,String(cachedSequence),action)).status,503);
      for(const [route,value,seq] of listReplies)
        assert.equal((await request(port,seq,value,String(seq),route)).status,503);
      assert.equal(snapshot(),before);
    }
    put('UserFriendStatus',[status]);
    app.store.db.exec("CREATE TEMP TRIGGER fail_pvp_view_reply BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'synthetic pvp view rollback'); END");
    for(const [route,value] of [[action,body],['pvp/summary/get',{pvpId:id}],
      ['pvp/player_info/get',{targetUserId:seed.userId}],['pvp/character/ranking/get',{pvpId:id}]]) {
      if(route==='pvp/summary/get') put('UserPvPRecord',[first]);
      if(route==='pvp/character/ranking/get') put('UserPvPRecord',[]);
      await rejects(value,500,route);
    }
    await rejects(pullValue,500,pullRoute);
    const rollback=snapshot(),save=await push({UserPvPRecord:[first,second]});
    assert.equal(save.status,500,save.body.toString());
    assert.equal(snapshot(),rollback,'Reply failure rolls back valid multi-season profile/token/sequence save');
    app.store.db.exec('DROP TRIGGER fail_pvp_view_reply');
    await close();await open({...master,pvpInformationIds:[]});await rejects(body);
    console.log('War Game view source-only checks OK; native acceptance remains pending');
  } finally {
    await close();
    assert.equal(path.dirname(fs.realpathSync(directory)),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-pvp-friend-'));
    fs.rmSync(directory,{recursive:true,force:true});
  }
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
