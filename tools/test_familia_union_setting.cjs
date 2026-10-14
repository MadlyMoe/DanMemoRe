'use strict';
// DEFERRED: run only after the packet implementation phase is finished.
// These are isolated wire/storage checks, NOT recovered enum or native UI proof.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer}=require('./danmemore_server.cjs'),{request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
const empty={unionStatus:0,unionCondition:0,unionResult:0,unionWithFamiliaName:'',unionRegisteredAt:0,unionTimeDuring:0};
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-familia-union-')),database=path.join(directory,'profile.sqlite');
  let app,port,sequence=0;
  const open=async()=>{
    app=createServer({database,seed,master,eventDate:'2019-10-20',wallNowSeconds:()=>2000000000,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async()=>{if(app)await app.close();app=null;};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);};
  const preferences=(status,condition)=>({familiaId:1,status,condition});
  const set=value=>send('familia/union/setting',value);
  const rows=table=>app.store.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
  const native=()=>rows('profile');
  const view=body=>Object.fromEntries(Object.keys(empty).map(key=>[key,body.familia[key]]));
  const status=()=>send('familia/mystatus',{});
  const put=(name,data)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(data),md5(data),name);
  const create=async name=>{
    const result=parse(await send('familia/create',{name,description:'Deferred union preferences fixture',godId:20000001,
      style:21000001,subStyle:0,activeTime:22000001,subActiveTime:0,requireApproval:false}));
    const currency=app.store.read('UserCurrency').data.map(row=>({...row,amount:row.amount-100000})),charge=result.operations[0];
    assert.equal((await set(preferences(1,0))).status,503,'Creation must save/ACK before changing preferences');
    parse(await send('user_data/push',{badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserCurrency:md5(currency)}},
      deltas:[{signature:0,trigger:'Familia',deleteItems:{},putItems:{UserCurrency:currency}}],
      operations:[{id:charge.id,verifier:charge.token}]}));
    return charge.id;
  };
  const replay=(seq,value,action='familia/union/setting')=>request(port,seq,value,String(seq),action);
  try {
    await open();
    assert.equal((await set(preferences(1,0))).status,503,'No invented membership');
    for(const bad of [null,{},[],{status:1,condition:0},preferences(0.5,0),preferences(-1,0),preferences(1,-1),
      preferences('1',0),preferences(1,true),preferences(0x80000000,0),preferences(1,0x80000000),
      {...preferences(1,0),extra:1}]) assert.equal((await set(bad)).status,400);
    put('UserCurrency',[{userId:seed.userId,currencyId:master.currencies['currency.valis'],amount:500000,
      cumulativeAmount:500000,reservedAmount:0,signature:0}]);
    const generation=await create('UnionOne');
    assert.deepEqual(view(parse(await status())),empty);
    const before=native(),wallet=app.store.hardCurrency(),pending=app.store.operations(),first=preferences(1,0),response=await set(first),firstSeq=sequence;
    assert.deepEqual(parse(response),{code:0,result:0});
    assert.deepEqual(view(parse(await status())),{...empty,unionStatus:1});
    assert.deepEqual((await replay(firstSeq,first)).body,response.body);
    assert.deepEqual(native(),before,'Preference edit cannot write native profiles');
    assert.deepEqual(app.store.operations(),pending);assert.deepEqual(app.store.hardCurrency(),wallet);
    assert.equal(rows('familia_union_setting')[0].creation_operation_id,generation);
    const staleView=await status(),staleSeq=sequence;parse(staleView);
    const second=preferences(1,1),changed=await set(second),secondSeq=sequence;parse(changed);
    assert.equal((await replay(firstSeq,first)).status,503,'Old edit cannot rewind a later preference');
    assert.equal((await replay(staleSeq,{},'familia/mystatus')).status,503,'Cached native importer cannot restore old preferences');
    assert.deepEqual(view(parse(await status())),{...empty,unionStatus:1,unionCondition:1});
    assert.equal((await replay(secondSeq,preferences(1,2))).status,400,'Wire identity cannot change its payload');
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`${secondSeq}/${secondSeq}`);
    assert.deepEqual(parse(await replay(secondSeq,second)),{code:0,result:0},'Permanent receipt survives cache eviction');
    const snapshot={preferences:rows('familia_union_setting'),requests:rows('familia_union_request'),native:native(),
      meta:rows('meta'),runtime:rows('runtime')};
    app.store.db.exec("CREATE TRIGGER fail_union_reply BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'deferred rollback'); END");
    assert.equal((await set(preferences(0,0))).status,503);
    assert.deepEqual(rows('familia_union_setting'),snapshot.preferences);assert.deepEqual(rows('familia_union_request'),snapshot.requests);
    assert.deepEqual(native(),snapshot.native);assert.deepEqual(rows('meta'),snapshot.meta);assert.deepEqual(rows('runtime'),snapshot.runtime);
    app.store.db.exec('DROP TRIGGER fail_union_reply');
    await close();await open();
    assert.deepEqual(view(parse(await status())),{...empty,unionStatus:1,unionCondition:1});
    assert.deepEqual(parse(await replay(secondSeq,second)),{code:0,result:0});
    const oldPreferences=rows('familia_union_setting');
    parse(await send('familia/break',null));
    assert.equal((await replay(secondSeq,second)).status,503,'Disbanded ownership cannot authorize an old request');
    const nextGeneration=await create('UnionTwo');assert.notEqual(nextGeneration,generation);
    assert.deepEqual(view(parse(await status())),empty,'Recreated group does not inherit an old group choice');
    assert.equal((await replay(secondSeq,second)).status,503,'Familia ID1 is not a generation identity');
    assert.deepEqual(rows('familia_union_setting'),oldPreferences,'Old generation history remains recoverable');
    parse(await set(preferences(1,0)));
    assert.equal(rows('familia_union_setting').length,2);assert.deepEqual(app.store.operations(),[]);
    // Boundary/opaque persistence only: these are NOT claimed legal publisher enums.
    parse(await set(preferences(0x7fffffff,0x7fffffff)));
    assert.deepEqual(view(parse(await status())),{...empty,unionStatus:0x7fffffff,unionCondition:0x7fffffff});
    parse(await set(preferences(0,0)));
    const retained=rows('familia_union_setting'),profile=app.store.read('UserProfile').data;
    put('UserProfile',profile.map(row=>({...row,familiaId:99,familiaName:'Foreign'})));
    assert.equal((await set(preferences(1,0))).status,503);assert.deepEqual(rows('familia_union_setting'),retained);
    console.log('Local union preference wire/storage/replay/generation/rollback checks: OK; enum/matching/native acceptance still pending');
  } finally {
    await close();assert.equal(path.dirname(fs.realpathSync(directory)),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-familia-union-'));fs.rmSync(directory,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
