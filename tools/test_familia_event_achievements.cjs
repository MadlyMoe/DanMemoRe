'use strict';

// DEFERRED: do not run until the packet implementation phase is finished.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer}=require('./danmemore_server.cjs'),{request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),original=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-familia-event-missions-')),
    database=path.join(directory,'profile.sqlite'),master=structuredClone(original);
  let app,port,sequence=0;
  const open=async date=>{
    app=createServer({database,seed,master,eventDate:date,wallNowSeconds:()=>2000000000,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async()=>{if(app)await app.close();app=null;};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=row=>{assert.equal(row.status,200,row.body.toString());return JSON.parse(row.body);};
  const get=value=>send('familia/achievement/get',value ?? {targetEventId:0});
  const eventId=master.gveInformationIds[0],views=[
    ['guild_event/status/log',{gveId:eventId,count:20},{code:0,logs:[]}],
    ['guild_event/score/user/daily/get',{gveId:eventId},{code:0,score:0}],
    ['gve/summary/get',{gveId:eventId},{code:0,summary:{familiaScore:0,userRank:0},ranking:[]}],
  ];
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const profiles=()=>app.store.db.prepare('SELECT * FROM profile ORDER BY name').all();
  try {
    assert.equal(master.familiaMissionAchievements.length,269);assert.equal(master.gveInformationIds.length,23);
    assert.deepEqual(master.familiaDailyAchievements.map(row=>row.id),
      master.familiaMissionAchievements.filter(row=>row.eventId===0).map(row=>row.id));
    await open('2019-10-18T12:00:00Z');
    assert.equal((await get()).status,503,'No invented membership');
    for(const [action,value] of views) assert.equal((await send(action,value)).status,503,'No invented event membership');
    for(const [action,value] of views) {
      for(const bad of [null,{},[],true,{...value,gveId:0},{...value,gveId:'1'},{...value,extra:1}])
        assert.equal((await send(action,bad)).status,400);
      assert.equal((await send(action,{...value,gveId:1})).status,400);
    }
    for(const count of [-1,0.5,'20',0x80000000])
      assert.equal((await send('guild_event/status/log',{gveId:eventId,count})).status,400);
    for(const bad of [null,{},[],true,{targetEventId:-1},{targetEventId:'0'},{targetEventId:0,extra:1}])
      assert.equal((await send('familia/achievement/get',bad)).status,400);
    const currency={userId:seed.userId,currencyId:master.currencies['currency.valis'],amount:200000,
      cumulativeAmount:250000,reservedAmount:0,signature:0};
    put('UserCurrency',[currency]);
    const created=parse(await send('familia/create',{name:'Solo group',description:'Deferred local fixture',
      godId:20000001,style:21000001,subStyle:0,activeTime:22000001,subActiveTime:0,requireApproval:false}));
    assert.equal((await get()).status,503,'Creation charge must actually save/ACK');
    for(const [action,value] of views) assert.equal((await send(action,value)).status,503,'Event membership must save/ACK');
    const paid=[{...currency,amount:100000}],charge=created.operations[0];
    parse(await send('user_data/push',{badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserCurrency:md5(paid)}},
      deltas:[{signature:0,trigger:'Familia',deleteItems:{},putItems:{UserCurrency:paid}}],operations:[{id:charge.id,verifier:charge.token}]}));
    assert.deepEqual(parse(await get()),{code:0,achievements:{obtained:[],not_obtained:[]}},'Original daily start retained');
    const untouched=profiles(),savedViews=[];
    for(const [action,value,expected] of views) {
      const response=await send(action,value);assert.deepEqual(parse(response),expected);
      savedViews.push({action,value,response,sequence});
      assert.deepEqual((await request(port,sequence,value,String(sequence),action)).body,response.body);
    }
    for(const count of [0,1,0x7fffffff])
      assert.deepEqual(parse(await send('guild_event/status/log',{gveId:eventId,count})),{code:0,logs:[]});
    assert.deepEqual(profiles(),untouched,'Event reads cannot debit stamina, grant rewards or issue native records');
    assert.deepEqual(app.store.operations(),[]);
    await close();await open('2020-08-01T12:00:00Z');
    const before=profiles(),zeroReply=await get(),zeroSequence=sequence,zero=parse(zeroReply);
    assert.deepEqual(zero.achievements.obtained,[]);assert.equal(zero.achievements.not_obtained.length,9);
    assert.ok(zero.achievements.not_obtained.every(row=>row.currentParam===0 && row.updatedAt===0));
    assert.deepEqual(profiles(),before,'Mission list cannot prewrite profiles or rewards');
    parse(await send('familia/mystatus',{is_login:true}));
    const visited=app.store.db.prepare('SELECT logined_at FROM familia_home_login ORDER BY logined_at DESC LIMIT 1').get();
    const afterVisit=parse(await get());
    for(const row of afterVisit.achievements.not_obtained) {
      const mission=master.familiaMissionAchievements.find(mission=>mission.id===row.achievementId);
      assert.deepEqual(row,{achievementId:mission.id,currentParam:mission.recordType===301?1:0,
        updatedAt:mission.recordType===301?visited.logined_at:0});
      assert.ok(row.currentParam<mission.requiredParam,'No fictitious additional members');
    }
    assert.equal((await request(port,zeroSequence,{targetEventId:0},String(zeroSequence),'familia/achievement/get')).status,503,
      'Old zero view cannot hide a real saved occurrence');
    parse(await send('achievement/familia/add',{recordType:401}));
    const bothReply=await get(),bothSequence=sequence,both=parse(bothReply);
    assert.ok(both.achievements.not_obtained.every(row=>row.currentParam===1));
    assert.deepEqual((await request(port,bothSequence,{targetEventId:0},String(bothSequence),'familia/achievement/get')).body,bothReply.body);
    assert.deepEqual(app.store.operations(),[]);assert.deepEqual(app.store.read('UserCurrency').data,paid);
    const snapshot=profiles(),previousMeta=app.store.db.prepare('SELECT * FROM meta ORDER BY key').all();
    app.store.db.exec("CREATE TRIGGER fail_event_mission_reply BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'deferred rollback'); END");
    assert.equal((await get()).status,503);assert.deepEqual(profiles(),snapshot);
    for(const [action,value] of views) assert.equal((await send(action,value)).status,503);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM meta ORDER BY key').all(),previousMeta);
    app.store.db.exec('DROP TRIGGER fail_event_mission_reply');
    const changed=master.familiaMissionAchievements.find(row=>row.recordType===301 && row.eventId===0),goal=changed.requiredParam;
    changed.requiredParam=1;assert.equal((await get()).status,503,'No fake completed reward from unsupported metadata');changed.requiredParam=goal;
    await close();await open('2020-08-02T12:00:00Z');
    assert.deepEqual(parse(await get()),zero,'Original Japanese day change resets projection, not history');
    assert.equal((await request(port,bothSequence,{targetEventId:0},String(bothSequence),'familia/achievement/get')).status,503);
    const event=master.familiaMissionAchievements.find(row=>row.eventId && row.recordType===201);
    await close();await open(new Date(event.startAt*1000).toISOString());
    const eventView=parse(await get({targetEventId:event.eventId}));
    assert.ok(eventView.achievements.not_obtained.length>0);
    assert.ok(eventView.achievements.not_obtained.every(row=>row.currentParam===0 && row.updatedAt===0));
    assert.deepEqual(eventView.achievements.obtained,[]);
    assert.equal((await get({targetEventId:1})).status,400);
    for(const name of ['UserGvERecord','UserGvEHighScoreParty']) {
      const saved=app.store.read(name).data;put(name,[{}]);
      assert.equal((await get({targetEventId:event.eventId})).status,503,'Unknown event history is preserved, not zeroed');
      for(const [action,value] of views) assert.equal((await send(action,value)).status,503,'No fake empty/zero view of earned history');
      for(const replay of savedViews)
        assert.equal((await request(port,replay.sequence,replay.value,String(replay.sequence),replay.action)).status,503,
          'Cached baseline must not conceal new or unknown battle history');
      assert.deepEqual(app.store.read(name).data,[{}]);put(name,saved);
    }
    for(const type of [19,20]) {
      const stage=Object.entries(master.stages).find(([,row])=>row.adventureType===type);
      if(!stage) continue; // No invented stage fixture for a missing original mode.
      const id=Number(stage[0]),token=`deferred-unknown-gve-${type}`;
      app.store.db.prepare('INSERT INTO stage_completion(stage_id,token,body_hash,operation_id) VALUES(?,?,?,?)')
        .run(id,token,'unknown-legacy-result',99999999);
      for(const [action,value] of views) assert.equal((await send(action,value)).status,503,'Indexed legacy stage history cannot become zero');
      assert.equal((await get({targetEventId:event.eventId})).status,503);
      assert.ok(app.store.db.prepare('SELECT 1 FROM stage_completion WHERE stage_id=? AND token=?').get(id,token));
      app.store.db.prepare('DELETE FROM stage_completion WHERE stage_id=? AND token=?').run(id,token);
    }
    const identities=master.gveInformationIds;master.gveInformationIds=[identities[0],...identities.slice(1).map(()=>identities[0])];
    for(const [action,value] of views) assert.equal((await send(action,value)).status,503,'Corrupt original identities retained');
    master.gveInformationIds=identities;
    const catalog=master.familiaMissionAchievements;master.familiaMissionAchievements=[];
    assert.equal((await get()).status,503);master.familiaMissionAchievements=catalog;
    console.log('Familia event mission rows, original catalog, real solo daily occurrences, replay/day boundaries and retained unknown history: OK');
  } finally {
    await close();assert.equal(path.dirname(fs.realpathSync(directory)),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-familia-event-missions-'));fs.rmSync(directory,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
