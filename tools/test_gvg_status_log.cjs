'use strict';
// DEFERRED / NOT RUN: execute only after all packet implementation is finished.
// Synthetic HTTP/save coverage is not native Guild War UI or multiplayer acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-gvg-log-')),database=path.join(directory,'profile.sqlite'),
    eventEntry=Object.entries(master.guildVsGuild).sort((a,b)=>(a[1].entryStartAt||a[1].preparationStartAt)-
      (b[1].entryStartAt||b[1].preparationStartAt))[0],value={gvgId:Number(eventEntry[0])},action='gvg/status/log',
    playerHistoryAction='gvg/player_history/get',playerHistoryValue={targetUserId:seed.userId,battleId:'local-empty-history'},
    characterRankingAction='gvg/ranking/character/get',rankingAction='gvg/ranking/member/get',
    leagueRankingAction='gvg/league/ranking/member/get',
    rankingActions=[rankingAction,leagueRankingAction,'gvg/league/ranking/familia/top/get',
      'gvg/league/ranking/familia/around/get','gvg/ranking/familia/top/get',
      'gvg/ranking/familia/around/get'],tournamentEntry=Object.entries(master.guildVsGuild).find(([,event])=>event.type===1),
    tournamentAction='gvg/tournament/status/log',tournamentValue={gvgId:Number(tournamentEntry[0]),pairId:0};
  let now=eventEntry[1].entryStartAt||eventEntry[1].preparationStartAt,sequence=0,app,port;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app)await app.close();app=null;};
  const send=(route=action,body=value,at=++sequence)=>request(port,at,body,String(at),route);
  const parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);};
  const put=(name,data)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(data),md5(data),name);
  try {
    await open();
    for(const route of [action,characterRankingAction,...rankingActions])
      for(const bad of [null,{},[],{gvgId:0},{gvgId:1.5},{gvgId:String(value.gvgId)},{...value,extra:true}])
        assert.equal((await send(route,bad)).status,400);
    for(const bad of [null,{},[],{targetUserId:seed.userId},{battleId:'x'},
      {targetUserId:0,battleId:'x'},{targetUserId:1.5,battleId:'x'},
      {targetUserId:String(seed.userId),battleId:'x'},{targetUserId:seed.userId,battleId:''},
      {targetUserId:seed.userId,battleId:1},{...playerHistoryValue,extra:true}])
      assert.equal((await send(playerHistoryAction,bad)).status,400);
    for(const bad of [null,{},[],{gvgId:tournamentValue.gvgId},{...tournamentValue,pairId:-1},
      {...tournamentValue,pairId:1.5},{...tournamentValue,extra:true}])
      assert.equal((await send(tournamentAction,bad)).status,400);
    let unavailable=await send();
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    for(const route of rankingActions) {
      unavailable=await send(route);
      assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    }
    unavailable=await send(characterRankingAction);
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    unavailable=await send(playerHistoryAction,playerHistoryValue);
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);

    const currency=[{userId:seed.userId,currencyId:master.currencies['currency.valis'],amount:200000,
      cumulativeAmount:200000,reservedAmount:0,signature:0}];
    put('UserCurrency',currency);
    const created=parse(await send('familia/create',{name:'GvGLog',description:'Deferred local history fixture',godId:20000001,
      style:21000001,subStyle:0,activeTime:22000001,subActiveTime:0,requireApproval:false})),charge=created.operations[0],
      paid=[{...currency[0],amount:100000}];
    parse(await send('user_data/push',{badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserCurrency:md5(paid)}},
      deltas:[{signature:0,trigger:'Familia',deleteItems:{},putItems:{UserCurrency:paid}}],operations:[{id:charge.id,verifier:charge.token}]}));

    const profiles=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),response=await send(),cached=sequence,
      playerHistoryResponse=await send(playerHistoryAction,playerHistoryValue),playerHistoryCached=sequence,
      characterRankingResponse=await send(characterRankingAction),characterRankingCached=sequence,rankingResponses=[];
    for(const route of rankingActions) {
      const rankingResponse=await send(route);
      rankingResponses.push({route,response:rankingResponse,cached:sequence});
    }
    assert.deepEqual(parse(response),{code:0,result:0,gvgHistories:[]});
    assert.deepEqual(parse(playerHistoryResponse),{code:0,gvgHistories:[]});
    assert.deepEqual(parse(characterRankingResponse),{code:0});
    for(const ranking of rankingResponses)assert.deepEqual(parse(ranking.response),{code:0,ranking:[]});
    assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),profiles);
    assert.deepEqual((await send(action,value,cached)).body,response.body);
    assert.deepEqual((await send(playerHistoryAction,playerHistoryValue,playerHistoryCached)).body,playerHistoryResponse.body);
    assert.deepEqual((await send(characterRankingAction,value,characterRankingCached)).body,characterRankingResponse.body);
    for(const ranking of rankingResponses)
      assert.deepEqual((await send(ranking.route,value,ranking.cached)).body,ranking.response.body);

    now=tournamentEntry[1].preparationStartAt;
    const tournamentResponse=await send(tournamentAction,tournamentValue),tournamentCached=sequence;
    assert.deepEqual(parse(tournamentResponse),{code:0,result:0,gvgHistories:[]});
    assert.deepEqual((await send(tournamentAction,tournamentValue,tournamentCached)).body,tournamentResponse.body);

    const users=app.store.read('UserInfo').data;
    put('UserInfo',[{...users[0],processingGvGState:1}]);
    unavailable=await send(tournamentAction,tournamentValue,tournamentCached);
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    now=eventEntry[1].entryStartAt||eventEntry[1].preparationStartAt;
    unavailable=await send(action,value,cached);
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    unavailable=await send(playerHistoryAction,playerHistoryValue,playerHistoryCached);
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    unavailable=await send(characterRankingAction,value,characterRankingCached);
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    for(const ranking of rankingResponses) {
      unavailable=await send(ranking.route,value,ranking.cached);
      assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    }
    put('UserInfo',users);
    now=tournamentEntry[1].preparationStartAt;
    assert.deepEqual((await send(tournamentAction,tournamentValue,tournamentCached)).body,tournamentResponse.body);
    now=eventEntry[1].entryStartAt||eventEntry[1].preparationStartAt;
    assert.deepEqual((await send(action,value,cached)).body,response.body);
    assert.deepEqual((await send(playerHistoryAction,playerHistoryValue,playerHistoryCached)).body,playerHistoryResponse.body);
    assert.deepEqual((await send(characterRankingAction,value,characterRankingCached)).body,characterRankingResponse.body);
    for(const ranking of rankingResponses)
      assert.deepEqual((await send(ranking.route,value,ranking.cached)).body,ranking.response.body);

    now=tournamentEntry[1].eventEndAt+1;
    unavailable=await send(tournamentAction,tournamentValue,tournamentCached);
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    now=eventEntry[1].eventEndAt+1;
    unavailable=await send(action,value,cached);
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    unavailable=await send(playerHistoryAction,playerHistoryValue,playerHistoryCached);
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    unavailable=await send(characterRankingAction,value,characterRankingCached);
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    for(const ranking of rankingResponses) {
      unavailable=await send(ranking.route,value,ranking.cached);
      assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    }
    now=eventEntry[1].entryStartAt||eventEntry[1].preparationStartAt;
    await close();await open();
    assert.deepEqual(parse(await send()),{code:0,result:0,gvgHistories:[]});
    assert.deepEqual(parse(await send(playerHistoryAction,playerHistoryValue)),{code:0,gvgHistories:[]});
    assert.deepEqual(parse(await send(characterRankingAction)),{code:0});
    for(const route of rankingActions)assert.deepEqual(parse(await send(route)),{code:0,ranking:[]});
    now=tournamentEntry[1].preparationStartAt;
    assert.deepEqual(parse(await send(tournamentAction,tournamentValue)),{code:0,result:0,gvgHistories:[]});
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
