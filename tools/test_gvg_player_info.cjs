'use strict';

// DEFERRED / NOT RUN: execute only after all packet implementation is finished.
// Synthetic public-party stats and saves prove only the recovered local
// response/persistence contract, not native UI, battle history or stability.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs'),{request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
const unit=pcId=>({pcId,level:pcId?1:0,currentJobIndex:pcId?1:0,limitbreakCount:0,usableSkillAmount:0,
  strength:0,intelligence:0,agility:0,vitality:0,luck:0,hp:pcId?100:0,mp:pcId?16:0,
  physicalAttackPower:0,magicAttackPower:0,defensePower:0,weaponId:0,armorId:0,weaponAbilityIds:[],armorAbilityIds:[],
  heroSublimateLevel:0,isUnlockedHeroSublimate:false,attackPattern:0,currentDP:0,unlockedAdditionalAbilityAmount:0,
  hasAllStatusBoardOpened:false});
const selected=seed.data.UserParty.find(row=>row.id===seed.data.UserInfo[0].activeGuildEventPartyId);
const party={userId:seed.userId,partyType:5,index:0,attackPattern:selected.attackPattern,partyStrength:0,
  slots:selected.slots.map(row=>({slotNumber:row.slotNumber,pc:unit(row.pcId),assistingPc:unit(row.assistingPcId),
    commandFlow:row.commandFlow,isHidden:false})),memoriaSlots:selected.memoriaSlots.map(row=>({slotNumber:row.slotNumber,
    isHidden:false,otherMemoria:{memoriaId:row.memoriaId,level:row.memoriaId?1:0}}))};

async function main(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-gvg-player-')),database=path.join(directory,'profile.sqlite'),
    [gvgId,event]=Object.entries(master.guildVsGuild).sort((a,b)=>(a[1].entryStartAt||a[1].preparationStartAt)-
      (b[1].entryStartAt||b[1].preparationStartAt))[0];
  let now=(event.entryStartAt||event.preparationStartAt)+1,sequence=0,app,port;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
      await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;},
    close=async()=>{if(app){await app.close();app=null;}},
    send=(action,value,id=++sequence)=>request(port,id,value,String(id),action),
    parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);},
    put=(name,data)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
      .run(JSON.stringify(data),md5(data),name),
    rejected=async(action,value,status=503,id=++sequence)=>{const reply=await send(action,value,id);
      assert.equal(reply.status,status,reply.body.toString());if(status===503)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
      return reply;};
  try{
    await open();const action='gvg/player_info/get',value={gvgId:Number(gvgId),userId:seed.userId,isScout:false,isOwnTeam:false};
    for(const bad of [null,{},[],{...value,extra:1},{...value,gvgId:0},{...value,userId:0},
      {...value,isScout:0},{...value,isOwnTeam:'false'}])await rejected(action,bad,400);
    await rejected(action,value);
    const currency=[{userId:seed.userId,currencyId:master.currencies['currency.valis'],amount:200000,
      cumulativeAmount:200000,reservedAmount:0,signature:0}];put('UserCurrency',currency);
    const created=parse(await send('familia/create',{name:'GvGDetail',description:'Deferred detail fixture',godId:20000001,
      style:21000001,subStyle:0,activeTime:22000001,subActiveTime:0,requireApproval:false})),charge=created.operations[0],
      paid=[{...currency[0],amount:100000}];
    parse(await send('user_data/push',{badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserCurrency:md5(paid)}},
      deltas:[{signature:0,trigger:'Familia',deleteItems:{},putItems:{UserCurrency:paid}}],
      operations:[{id:charge.id,verifier:charge.token}]}));
    put('UserPC',app.store.read('UserPC').data.map(row=>({...row,joiningState:1})));
    await rejected(action,value);
    parse(await send('gvg/party/update',{party}));
    await rejected(action,value);
    parse(await send('user_data/push',{badges:null,scripts:{},dataTokens:{},operations:[],
      checksums:{before:{},after:{UserOtherParty:md5([party])}},
      deltas:[{signature:0,trigger:'GvgPartyUpdate',deleteItems:{},putItems:{UserOtherParty:[party]}}]}));
    const profiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),first=++sequence,
      response=parse(await send(action,value,first));
    assert.equal(response.result,0);assert.deepEqual(response.user.party,party);
    assert.equal(response.user.userId,seed.userId);assert.equal(response.user.totalExp,seed.data.UserInfo[0].playerStatus.totalExp);
    assert.equal(response.user.defensePoint,0);assert.equal(response.user.roleDefensePoint,0);
    assert.equal(response.user.pvpRank,seed.data.UserAdventureLevelInfo[0].pvpHighestRank);
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profiles,
      'Guild War player detail must not mutate native profiles');
    for(const flags of [[true,false],[true,true]]) {
      const result=parse(await send(action,{...value,isScout:flags[0],isOwnTeam:flags[1]}));
      assert.deepEqual(result.user,response.user);
    }
    await rejected(action,{...value,userId:seed.userId+1});
    put('UserOtherParty',[{...party,partyStrength:1}]);await rejected(action,value);put('UserOtherParty',[party]);
    const levels=app.store.read('UserAdventureLevelInfo').data,ranked=levels.map(row=>({...row,pvpHighestRank:1}));
    put('UserAdventureLevelInfo',ranked);await rejected(action,value,503,first);
    assert.equal(parse(await send(action,value)).user.pvpRank,1);
    await close();await open();assert.equal(parse(await send(action,value)).user.pvpRank,1);
    now=event.eventEndAt+1;await rejected(action,value);
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
