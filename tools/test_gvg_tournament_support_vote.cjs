'use strict';
// DEFERRED / NOT RUN: execute only after all packet implementation is finished.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer}=require('./danmemore_server.cjs'),{request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');

async function main(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-gvg-support-')),database=path.join(directory,'profile.sqlite'),
    [gvgId,event]=Object.entries(master.guildVsGuild).find(([,row])=>row.type===1),familiaId=900000001;
  let now=event.entryStartAt||event.preparationStartAt,sequence=0,app,port;
  const send=(value,id=++sequence)=>request(port,id,value,String(id),'gvg/tournament/support/vote'),
    get=(value,id=++sequence)=>request(port,id,value,String(id),'gvg/tournament/get'),
    parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);};
  try{
    app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
    const value={gvgId:Number(gvgId),familiaId};
    for(const bad of [null,{},[],{gvgId:0},{gvgId:1.5},{gvgId:String(gvgId)},{gvgId:Number(gvgId),extra:1}])
      assert.equal((await get(bad)).status,400);
    const initialView={code:0,result:0,info:{term:now>=event.battleStartAt?2:now>=event.preparationStartAt?1:0},
      user:{supporterTicketCount:1,voteTicketCount:5,supportPairId:null,supportFamiliaId:null,canBattle:false,
        canSupport:true,canSpectate:false,canVote:true},familias:[],ranking:[]},initialResponse=await get({gvgId:Number(gvgId)}),
      initialRequest=sequence;
    assert.deepEqual(parse(initialResponse),initialView);
    for(const bad of [null,{},[],{...value,extra:1},{...value,gvgId:0},{...value,familiaId:0},
      {...value,gvgId:1.5},{...value,familiaId:String(familiaId)}]) assert.equal((await send(bad)).status,400);
    const profiles=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),requestId=++sequence,
      expected={code:0,result:0,user:{supporterTicketCount:0,supportPairId:0,supportFamiliaId:familiaId}};
    assert.deepEqual(parse(await send(value,requestId)),expected);
    assert.deepEqual(parse(await send(value,requestId)),expected,'Exact retry must reuse the durable selection');
    assert.equal((await send({...value,familiaId:familiaId+1},requestId)).status,400,'Wire identity cannot change');
    assert.equal((await send(value)).status,400,'A fresh request cannot spend the same tournament ticket again');
    assert.equal((await get({gvgId:Number(gvgId)},initialRequest)).status,503,'Cached pre-vote view cannot hide the selection');
    assert.deepEqual(parse(await get({gvgId:Number(gvgId)})),{...initialView,user:{...initialView.user,
      supporterTicketCount:0,supportPairId:0,supportFamiliaId:familiaId,canSupport:false}});
    assert.deepEqual(app.store.db.prepare('SELECT user_id,gvg_id,familia_id,support_pair_id,supporter_ticket_count FROM gvg_tournament_support').all(),
      [{user_id:seed.userId,gvg_id:Number(gvgId),familia_id:familiaId,support_pair_id:0,supporter_ticket_count:0}]);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),profiles);
    now+=86400;
    assert(now<=event.battleEndAt,'Fixture must retain a second tournament support day');
    const nextDayView={...initialView,info:{term:now>=event.battleStartAt?2:now>=event.preparationStartAt?1:0}};
    assert.deepEqual(parse(await get({gvgId:Number(gvgId)})),nextDayView,'A client-day change must restore one support ticket');
    const secondValue={...value,familiaId:familiaId+1},secondId=++sequence,
      secondExpected={code:0,result:0,user:{supporterTicketCount:0,supportPairId:0,supportFamiliaId:secondValue.familiaId}};
    assert.deepEqual(parse(await send(secondValue,secondId)),secondExpected);
    assert.equal((await send(secondValue)).status,400,'A second choice on the same client day must refuse');
    assert.deepEqual(parse(await send(value,requestId)),expected,'An old exact retry must retain its original response');
    assert.equal(parse(await get({gvgId:Number(gvgId)})).user.supportFamiliaId,secondValue.familiaId,
      'Old replay must not replace the current-day selection');
    assert.deepEqual(app.store.db.prepare(`SELECT day,familia_id FROM gvg_tournament_support_request
      ORDER BY day`).all(),[
      {day:Math.floor(((event.entryStartAt||event.preparationStartAt)+32400)/86400),familia_id:familiaId},
      {day:Math.floor((now+32400)/86400),familia_id:secondValue.familiaId},
    ]);
    await app.close();app=null;
    app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
    assert.deepEqual(parse(await send(value,requestId)),expected,'Restart must retain the exact support choice');
    assert.deepEqual(parse(await send(secondValue,secondId)),secondExpected,'Restart must retain the second-day choice');
    assert.deepEqual(parse(await get({gvgId:Number(gvgId)})),{...nextDayView,user:{...nextDayView.user,
      supporterTicketCount:0,supportPairId:0,supportFamiliaId:secondValue.familiaId,canSupport:false}},
    'Restart must project the current-day support choice');
  } finally {if(app)await app.close();fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
