'use strict';
// DEFERRED / NOT RUN: execute only after all packet implementation is finished.
// Synthetic HTTP/save coverage is not native Guild War UI or multiplayer acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-gvg-familia-')),database=path.join(directory,'profile.sqlite'),
    eventEntry=Object.entries(master.guildVsGuild).sort((a,b)=>(a[1].entryStartAt||a[1].preparationStartAt)-
      (b[1].entryStartAt||b[1].preparationStartAt))[0],value={gvgId:Number(eventEntry[0])},action='gvg/familia/get';
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
    let unavailable=await send();
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);

    const currency=[{userId:seed.userId,currencyId:master.currencies['currency.valis'],amount:200000,
      cumulativeAmount:200000,reservedAmount:0,signature:0}];
    put('UserCurrency',currency);
    const created=parse(await send('familia/create',{name:'GvGList',description:'Deferred local Guild War member-list fixture',godId:20000001,
      style:21000001,subStyle:0,activeTime:22000001,subActiveTime:0,requireApproval:false})),charge=created.operations[0],
      paid=[{...currency[0],amount:100000}];
    parse(await send('user_data/push',{badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserCurrency:md5(paid)}},
      deltas:[{signature:0,trigger:'Familia',deleteItems:{},putItems:{UserCurrency:paid}}],operations:[{id:charge.id,verifier:charge.token}]}));

    const info=seed.data.UserInfo[0],profile=seed.data.UserProfile[0],status=seed.data.UserStatus[0],
      party=seed.data.UserParty.find(row=>row.id===1),pc=seed.data.UserPC.find(row=>row.pcId===party.slots.find(row=>row.slotNumber===1).pcId),
      original=master.pcProfiles[pc.pcId],jobRank=master.pcJobRanks[original.jobIds[pc.currentJobIndex-1]],
      rank=master.playerLevels.findLast(([,exp])=>exp<=info.playerStatus.totalExp)[0],maximum=master.pcJobMaxLevels[jobRank]+pc.limitbreakCount*4,
      level=master.pcLevels[original.levelUpType].findLast(([candidate,exp])=>candidate<=maximum && exp<=pc.totalExp)[0],
      expected={code:0,result:0,members:[{userId:seed.userId,name:info.name,rank,description:profile.introduction,
        lastLoginedAt:status.lastLoginedAt,leaderPc:{level,pcId:pc.pcId,jobRank,heroSublimateLevel:pc.heroSublimateLevel,
          isUnlockedHeroSublimate:pc.isUnlockedHeroSublimate},post:3,pvpRank:seed.data.UserAdventureLevelInfo[0].pvpHighestRank}]},
      profiles=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),response=await send(),cached=sequence;
    assert.deepEqual(parse(response),expected);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),profiles);
    assert.deepEqual((await send(action,value,cached)).body,response.body);

    const levels=app.store.read('UserAdventureLevelInfo').data;
    put('UserAdventureLevelInfo',[{...levels[0],pvpHighestRank:levels[0].pvpHighestRank+1}]);
    unavailable=await send(action,value,cached);
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    put('UserAdventureLevelInfo',levels);
    assert.deepEqual((await send(action,value,cached)).body,response.body);

    now=eventEntry[1].eventEndAt+1;
    unavailable=await send(action,value,cached);
    assert.equal(unavailable.status,503);assert.equal(JSON.parse(unavailable.body).code,OFFLINE_UNAVAILABLE_CODE);
    now=eventEntry[1].entryStartAt||eventEntry[1].preparationStartAt;
    await close();await open();
    assert.deepEqual(parse(await send()),expected);
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
