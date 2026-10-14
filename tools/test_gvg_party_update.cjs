'use strict';

// DEFERRED / NOT RUN: execute only after all packet implementation is finished.
// Synthetic public-party stats exercise the recovered wire/persistence contract,
// not native construction, save ordering, UI behavior or emulator stability.
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
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-gvg-party-')),database=path.join(directory,'profile.sqlite'),
    [,event]=Object.entries(master.guildVsGuild).sort((a,b)=>(a[1].entryStartAt||a[1].preparationStartAt)-
      (b[1].entryStartAt||b[1].preparationStartAt))[0];
  let now=(event.entryStartAt||event.preparationStartAt)+1,sequence=0,app,port;
  const send=(action,value,id=++sequence)=>request(port,id,value,String(id),action),
    parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);},
    put=(name,data)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
      .run(JSON.stringify(data),md5(data),name),
    snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
      .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()])),
    rejected=async(action,value,status=503,id=++sequence)=>{const before=snapshot(),reply=await send(action,value,id);
      assert.equal(reply.status,status,reply.body.toString());if(status===503)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
      assert.equal(snapshot(),before,'Rejected Guild War party requests must preserve all state');return reply;};
  try{
    app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
    const action='gvg/party/update';
    for(const bad of [null,{},[],party,{party,extra:true},{party:{...party,partyType:7}},{party:{...party,userId:1}},
      {party:{...party,slots:party.slots.slice(1)}},{party:{...party,partyStrength:-1}}])
      await rejected(action,bad,400);
    await rejected(action,{party});
    const currency=[{userId:seed.userId,currencyId:master.currencies['currency.valis'],amount:200000,
      cumulativeAmount:200000,reservedAmount:0,signature:0}];put('UserCurrency',currency);
    const created=parse(await send('familia/create',{name:'GvGParty',description:'Deferred party fixture',godId:20000001,
      style:21000001,subStyle:0,activeTime:22000001,subActiveTime:0,requireApproval:false})),charge=created.operations[0],
      paid=[{...currency[0],amount:100000}];
    parse(await send('user_data/push',{badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserCurrency:md5(paid)}},
      deltas:[{signature:0,trigger:'Familia',deleteItems:{},putItems:{UserCurrency:paid}}],
      operations:[{id:charge.id,verifier:charge.token}]}));
    put('UserPC',app.store.read('UserPC').data.map(row=>({...row,joiningState:1})));
    const nativeBefore=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
    app.store.db.exec("CREATE TEMP TRIGGER fail_gvg_party_request BEFORE INSERT ON gvg_party_request BEGIN SELECT RAISE(ABORT,'injected'); END");
    assert.ok((await send(action,{party})).status>=500);app.store.db.exec('DROP TRIGGER fail_gvg_party_request');
    assert.deepEqual(app.store.db.prepare('SELECT * FROM gvg_party_setting').all(),[]);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM gvg_party_request').all(),[]);
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),nativeBefore);
    const first=++sequence,response=parse(await send(action,{party},first));
    assert.deepEqual(response,{code:0,result:0,party});
    assert.equal(app.store.db.prepare('SELECT count(*) count FROM gvg_party_setting').get().count,1);
    assert.equal(app.store.db.prepare('SELECT count(*) count FROM gvg_party_request').get().count,1);
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),nativeBefore,
      'Party update must wait for the client GvgPartyUpdate save');
    assert.deepEqual(parse(await send(action,{party},first)),response,'Exact transport replay returns the bound party');
    await rejected(action,{party:{...party,partyStrength:1}},400,first);
    now+=1;const replacement={...party,partyStrength:1};
    assert.deepEqual(parse(await send(action,{party:replacement})),{code:0,result:0,party:replacement});
    await rejected(action,{party},503,first);
    now=event.eventEndAt+1;await rejected(action,{party:replacement});
    now=event.eventEndAt;parse(await send('familia/break',null));
    assert.deepEqual(app.store.db.prepare('SELECT * FROM gvg_party_setting').all(),[]);
  } finally {if(app)await app.close();fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
