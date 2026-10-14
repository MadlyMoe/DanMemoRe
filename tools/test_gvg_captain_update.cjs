'use strict';
// DEFERRED / NOT RUN: execute only after all packet implementation is finished.
// The current local Familia model has fewer than the four distinct members the
// final client requires, so this probe covers the exact wire and safe refusal.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer}=require('./danmemore_server.cjs'),{request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
async function main(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-gvg-captain-')),database=path.join(directory,'profile.sqlite'),
    [gvgId,event]=Object.entries(master.guildVsGuild).sort((a,b)=>a[1].preparationStartAt-b[1].preparationStartAt)[0];
  let now=event.preparationStartAt,sequence=0,app,port;
  const send=(action,value,id=++sequence)=>request(port,id,value,String(id),action),
    parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);},
    put=(name,data)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
      .run(JSON.stringify(data),md5(data),name);
  try{
    app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
    const currency=[{userId:seed.userId,currencyId:master.currencies['currency.valis'],amount:200000,
      cumulativeAmount:200000,reservedAmount:0,signature:0}];put('UserCurrency',currency);
    const created=parse(await send('familia/create',{name:'GvGCaptain',description:'Deferred officer fixture',godId:20000001,
      style:21000001,subStyle:0,activeTime:22000001,subActiveTime:0,requireApproval:false})),charge=created.operations[0],
      paid=[{...currency[0],amount:100000}];
    parse(await send('user_data/push',{badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserCurrency:md5(paid)}},
      deltas:[{signature:0,trigger:'Familia',deleteItems:{},putItems:{UserCurrency:paid}}],
      operations:[{id:charge.id,verifier:charge.token}]}));
    const action='gvg/status/captain/update',base={gvgId:Number(gvgId),captainUserId:seed.userId,
      subCaptainUserId_1:seed.userId+1,subCaptainUserId_2:seed.userId+2,subCaptainUserId_3:seed.userId+3};
    for(const bad of [null,{},[],{...base,extra:1},{...base,gvgId:0},{...base,captainUserId:0},
      {...base,subCaptainUserId_1:1.5},{...base,subCaptainUserId_2:String(seed.userId+2)},
      {...base,subCaptainUserId_3:seed.userId}]) assert.equal((await send(action,bad)).status,400);
    const before=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all();
    assert.equal((await send(action,base)).status,503,'Unknown officers cannot become fabricated Familia members');
    assert.deepEqual(app.store.db.prepare('SELECT * FROM gvg_captain_setting').all(),[]);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM gvg_captain_request').all(),[]);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),before);
    const status=parse(await send('gvg/status/get',{gvgId:Number(gvgId)}));
    assert.equal(status.familia.captainUserId,-1);assert.deepEqual(status.familia.subCaptainUserIds,[]);
  } finally {if(app)await app.close();fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
