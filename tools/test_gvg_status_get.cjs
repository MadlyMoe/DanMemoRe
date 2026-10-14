'use strict';
// DEFERRED / NOT RUN: execute only after all packet implementation is finished.
// Synthetic HTTP/save coverage is not native Guild War UI or multiplayer acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-gvg-status-')),database=path.join(directory,'profile.sqlite'),
    eventEntry=Object.entries(master.guildVsGuild).sort((a,b)=>(a[1].entryStartAt||a[1].preparationStartAt)-
      (b[1].entryStartAt||b[1].preparationStartAt))[0],value={gvgId:Number(eventEntry[0])},action='gvg/status/get';
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
    for(const bad of [null,{},[],{gvgId:0},{gvgId:1.5},{gvgId:String(value.gvgId)},{...value,extra:true}])
      assert.equal((await send(action,bad)).status,400);
    const infoEntry=Object.entries(master.guildVsGuild).find(([,event])=>event.entryStartAt>0 &&
      event.entryStartAt<event.preparationStartAt && event.preparationStartAt<event.battleStartAt &&
      event.battleStartAt<=event.battleEndAt && event.battleEndAt<event.eventEndAt);
    assert.ok(infoEntry);
    const infoAction='gvg/info/get',infoValue={gvgId:Number(infoEntry[0])},infoEvent=infoEntry[1];
    for(const bad of [null,{},[],{gvgId:0},{gvgId:1.5},{gvgId:String(infoValue.gvgId)},{...infoValue,extra:true}])
      assert.equal((await send(infoAction,bad)).status,400);
    now=infoEvent.entryStartAt;
    const entryInfo=await send(infoAction,infoValue),entryInfoSequence=sequence;
    assert.deepEqual(parse(entryInfo),{code:0,result:0,term:0,nextTermTime:infoEvent.preparationStartAt});
    assert.deepEqual((await send(infoAction,infoValue,entryInfoSequence)).body,entryInfo.body);
    now=infoEvent.preparationStartAt;
    assert.equal((await send(infoAction,infoValue,entryInfoSequence)).status,503);
    const preparationInfo=await send(infoAction,infoValue),preparationInfoSequence=sequence;
    assert.deepEqual(parse(preparationInfo),{code:0,result:0,term:1,nextTermTime:infoEvent.battleStartAt});
    now=infoEvent.battleStartAt;
    assert.equal((await send(infoAction,infoValue,preparationInfoSequence)).status,503);
    const battleInfo=await send(infoAction,infoValue),battleInfoSequence=sequence;
    assert.deepEqual(parse(battleInfo),{code:0,result:0,term:2,nextTermTime:infoEvent.battleEndAt+1});
    now=infoEvent.battleEndAt;
    assert.deepEqual((await send(infoAction,infoValue,battleInfoSequence)).body,battleInfo.body);
    now=infoEvent.battleEndAt+1;
    assert.equal((await send(infoAction,infoValue,battleInfoSequence)).status,503);
    const endedInfo=await send(infoAction,infoValue),endedInfoSequence=sequence;
    assert.deepEqual(parse(endedInfo),{code:0,result:0,term:3,nextTermTime:infoEvent.eventEndAt+1});
    now=infoEvent.eventEndAt+1;
    assert.equal((await send(infoAction,infoValue,endedInfoSequence)).status,503);
    now=eventEntry[1].entryStartAt||eventEntry[1].preparationStartAt;
    let unavailable=await send();
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);

    const currency=[{userId:seed.userId,currencyId:master.currencies['currency.valis'],amount:200000,
      cumulativeAmount:200000,reservedAmount:0,signature:0}];
    put('UserCurrency',currency);
    const created=parse(await send('familia/create',{name:'GvGStatus',description:'Deferred local Guild War status fixture',godId:20000001,
      style:21000001,subStyle:0,activeTime:22000001,subActiveTime:0,requireApproval:false})),charge=created.operations[0],
      paid=[{...currency[0],amount:100000}];
    parse(await send('user_data/push',{badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserCurrency:md5(paid)}},
      deltas:[{signature:0,trigger:'Familia',deleteItems:{},putItems:{UserCurrency:paid}}],operations:[{id:charge.id,verifier:charge.token}]}));

    const profiles=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),response=await send(),cached=sequence,
      expected={code:0,result:0,user:{dailyPoint:0,totalPoint:0},familia:{id:1,dailyPoint:0,totalPoint:0,
        dailyBattleCount:0,remainingDailyBattleCount:0,captainUserId:-1,masterUserId:seed.userId,subCaptainUserIds:[]},
        enemyFamilia:null,familiaMembers:[{userId:seed.userId,state:0,offensePoint:0,defensePoint:0,
          roleDefensePoint:0,battleCount:0,defenseCount:0,remainingBattleCount:0}],enemyFamiliaMembers:[]};
    assert.deepEqual(parse(response),expected);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),profiles);
    assert.deepEqual((await send(action,value,cached)).body,response.body);

    const tournamentEntry=Object.entries(master.guildVsGuild).find(([,event])=>event.type===1);
    assert.ok(tournamentEntry);
    const tournamentValue={gvgId:Number(tournamentEntry[0]),pairId:0},tournamentAction='gvg/tournament/status/get';
    now=tournamentEntry[1].preparationStartAt;
    for(const bad of [null,{},[],{gvgId:tournamentValue.gvgId},{...tournamentValue,pairId:-1},{...tournamentValue,extra:true}])
      assert.equal((await send(tournamentAction,bad)).status,400);
    const tournamentResponse=await send(tournamentAction,tournamentValue),tournamentCached=sequence;
    assert.deepEqual(parse(tournamentResponse),{...expected,info:{term:1,nextTermTime:tournamentEntry[1].battleStartAt}});
    assert.deepEqual((await send(tournamentAction,tournamentValue,tournamentCached)).body,tournamentResponse.body);

    const users=app.store.read('UserInfo').data;
    put('UserInfo',[{...users[0],processingGvGState:1}]);
    unavailable=await send(tournamentAction,tournamentValue,tournamentCached);
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    put('UserInfo',users);
    assert.deepEqual((await send(tournamentAction,tournamentValue,tournamentCached)).body,tournamentResponse.body);
    now=eventEntry[1].entryStartAt||eventEntry[1].preparationStartAt;
    assert.deepEqual((await send(action,value,cached)).body,response.body);

    now=tournamentEntry[1].eventEndAt+1;
    unavailable=await send(tournamentAction,tournamentValue,tournamentCached);
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    now=eventEntry[1].eventEndAt+1;
    unavailable=await send(action,value,cached);
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    now=eventEntry[1].entryStartAt||eventEntry[1].preparationStartAt;
    await close();await open();
    assert.deepEqual(parse(await send()),expected);
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
