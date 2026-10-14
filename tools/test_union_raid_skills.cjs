'use strict';
// DEFERRED / NOT RUN. Imported stock and save timing below are synthetic, not native earning or UI evidence.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs'),{request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-union-raid-skills-')),database=path.join(directory,'profile.sqlite'),
    growth='union_raid/skill/growth',get='union_raid/skill/get',ranking='union_raid/ranking/member/get',
    query={unionRaidInfoId:413000001},rankingQuery={...query,rankingType:3},
    value={...query,unionRaidSkillGroupId:423000001,medalId:410000001,medalAmount:10000},
    original={userId:seed.userId,medalId:410000001,amount:100000,reservedAmount:0,
      bookEntryState:1,signature:123456789,cumulativeAmount:120000};
  let app,port,sequence=0,now=1790834274;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app)await app.close();app=null;};
  const send=(route,body,id=++sequence)=>request(port,id,body,String(id),route),
    parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);},
    put=(name,data)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(data),md5(data),name),
    snapshot=()=>['profile','operation_queue','union_raid_skill_progress','union_raid_skill_growth','union_raid_medal_checkpoint','runtime']
      .map(table=>app.store.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()),
    reject=async(route,body,status=503,id=++sequence)=>{const before=snapshot(),response=await send(route,body,id);
      assert.equal(response.status,status,response.body.toString());
      if(status===503)assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
      assert.deepEqual(snapshot(),before);},
    saveBody=rows=>({badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserUnionRaidMedal:md5(rows)}},
      deltas:[{signature:0,trigger:'Item',deleteItems:{},putItems:{UserUnionRaidMedal:rows}}],operations:[]});
  try {
    await open();await reject(growth,value,503);
    const currency=[{userId:seed.userId,currencyId:master.currencies['currency.valis'],amount:200000,
      cumulativeAmount:200000,reservedAmount:0,signature:0}];
    put('UserCurrency',currency);
    const created=parse(await send('familia/create',{name:'Skill fixture',description:'Deferred Union Raid skill contract',
      godId:20000001,style:21000001,subStyle:0,activeTime:22000001,subActiveTime:0,requireApproval:false})),
      charge=created.operations[0],paid=[{...currency[0],amount:100000}];
    parse(await send('user_data/push',{badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserCurrency:md5(paid)}},
      deltas:[{signature:0,trigger:'Familia',deleteItems:{},putItems:{UserCurrency:paid}}],
      operations:[{id:charge.id,verifier:charge.token}]}));
    await reject(growth,value,400); // Empty stock cannot fund a skill.
    const initialized={...original,userId:0,amount:0,reservedAmount:0,cumulativeAmount:0,bookEntryState:0,signature:0xffffffff};
    parse(await send('user_data/push',saveBody([initialized])));
    await reject('user_data/push',saveBody([{...initialized,amount:1,cumulativeAmount:1}]),400);
    for(const bad of [null,{},[],{...value,extra:1},{...value,medalId:1},{...value,unionRaidInfoId:1},
      {...value,unionRaidSkillGroupId:423000010},{...value,medalAmount:0},{...value,medalAmount:-1}])
      await reject(growth,bad,400);
    for(const corrupt of [{...original,userId:99},{...original,amount:1000000000,cumulativeAmount:1000000000},
      {...original,bookEntryState:128},{...original,signature:0x100000000}]) {
      put('UserUnionRaidMedal',[corrupt]);await reject(growth,value);
    }
    put('UserUnionRaidMedal',[original]);
    await reject(growth,{...value,medalAmount:100001},400);
    put('UserUnionRaidMedal',[{...original,reservedAmount:95000}]);await reject(growth,value,400);
    put('UserUnionRaidMedal',[original]);
    const empty=parse(await send(get,query)),emptyId=sequence;
    assert.deepEqual(empty,{code:0,unionRaidSkills:[]});
    assert.deepEqual(parse(await send(ranking,rankingQuery)),{code:0,ranking:[]});
    app.store.db.exec(`CREATE TEMP TRIGGER fail_skill_reply BEFORE INSERT ON reply_cache
      WHEN NEW.action='union_raid/skill/growth' BEGIN SELECT RAISE(ABORT,'deferred skill reply rollback'); END;`);
    await reject(growth,value,500);app.store.db.exec('DROP TRIGGER fail_skill_reply');
    const reply=await send(growth,value),firstId=sequence;
    assert.deepEqual(parse(reply),{code:0,userMedalAmount:90000,unionRaidSkill:{medalAmount:10000}});
    const firstRanking=parse(await send(ranking,rankingQuery)),firstRankingId=sequence;
    assert.equal(firstRanking.ranking.length,1);assert.equal(firstRanking.ranking[0].rank,1);
    assert.equal(firstRanking.ranking[0].score,10000);assert.equal(firstRanking.ranking[0].member.userId,seed.userId);
    assert.deepEqual(app.store.read('UserUnionRaidMedal').data,[original]);
    assert.deepEqual((await send(growth,value,firstId)).body,reply.body);
    await reject(get,query,503,emptyId);await reject(growth,{...value,unionRaidSkillGroupId:423000002});
    await reject(growth,{...value,medalAmount:10001},400,firstId);
    await reject(get,query,400,firstId); // Permanent identity belongs to growth.
    const responseJson=app.store.db.prepare('SELECT response_json FROM union_raid_skill_growth').get().response_json;
    app.store.db.prepare('UPDATE union_raid_skill_growth SET response_json=?').run('{"code":0}');
    await reject(growth,value,503,firstId);
    app.store.db.prepare('UPDATE union_raid_skill_growth SET response_json=?').run(responseJson);
    app.store.db.exec('DELETE FROM reply_cache');await close();await open();
    assert.deepEqual((await send(growth,value,firstId)).body,reply.body);
    const after={...original,amount:90000};
    await reject('user_data/push',saveBody([{...after,cumulativeAmount:110000}]),400);
    app.store.db.exec(`CREATE TEMP TRIGGER fail_skill_save BEFORE UPDATE OF effect_saved ON union_raid_skill_growth
      BEGIN SELECT RAISE(ABORT,'deferred medal checkpoint rollback'); END;`);
    await reject('user_data/push',saveBody([after]),500);app.store.db.exec('DROP TRIGGER fail_skill_save');
    parse(await send('user_data/push',saveBody([after])));
    assert.equal(app.store.db.prepare('SELECT effect_saved FROM union_raid_skill_growth').get().effect_saved,1);
    assert.deepEqual(parse(await send(growth,value,firstId)),{code:0,userMedalAmount:90000,
      unionRaidSkill:{medalAmount:10000}});
    await reject('user_data/push',saveBody([original]),400);
    const second={...value,unionRaidSkillGroupId:423000008,medalAmount:66000};
    assert.deepEqual(parse(await send(growth,second)),{code:0,userMedalAmount:24000,unionRaidSkill:{medalAmount:66000}});
    await reject(growth,value,503,firstId); // A later unsaved native debit makes the current client stock ambiguous.
    await reject(ranking,rankingQuery,503,firstRankingId);
    parse(await send('user_data/push',saveBody([{...original,amount:24000}])));
    assert.deepEqual(parse(await send(growth,value,firstId)),{code:0,userMedalAmount:24000,
      unionRaidSkill:{medalAmount:10000}});
    assert.deepEqual(parse(await send(get,query)),{code:0,unionRaidSkills:[
      {unionRaidSkillId:424000001,medalAmount:10000},{unionRaidSkillId:424000352,medalAmount:66000}]});
    assert.equal(parse(await send(ranking,rankingQuery)).ranking[0].score,76000);
    put('UserUnionRaidMedal',[original]);await reject(get,query);put('UserUnionRaidMedal',[{...original,amount:24000}]);
    app.store.db.prepare('UPDATE union_raid_skill_progress SET medal_amount=1 WHERE union_raid_skill_group_id=423000001').run();
    await reject(get,query);app.store.db.prepare('UPDATE union_raid_skill_progress SET medal_amount=10000 WHERE union_raid_skill_group_id=423000001').run();
    const checkpoint=app.store.db.prepare('SELECT * FROM union_raid_medal_checkpoint').get();
    app.store.db.exec('DELETE FROM union_raid_medal_checkpoint');await reject(get,query);
    app.store.db.prepare('INSERT INTO union_raid_medal_checkpoint VALUES(?,?)').run(checkpoint.medal_id,checkpoint.request_id);
    await close();await open();assert.equal(app.store.read('UserUnionRaidMedal').data[0].amount,24000);
    assert.deepEqual(parse(await send(growth,value,firstId)),{code:0,userMedalAmount:24000,
      unionRaidSkill:{medalAmount:10000}});
    // A synthetic pre-existing near-max group exercises admission without inventing a medal grant.
    const creation=app.store.db.prepare('SELECT creation_operation_id FROM local_familia').get().creation_operation_id;
    app.store.db.prepare(`INSERT INTO union_raid_skill_progress
      (union_raid_info_id,creation_operation_id,union_raid_skill_group_id,medal_amount,upgraded_at) VALUES(?,?,?,?,?)`)
      .run(413000001,creation,423000009,1649999,now);
    assert.equal(parse(await send(ranking,rankingQuery)).ranking[0].score,76000);
    await reject(growth,{...value,unionRaidSkillGroupId:423000009,medalAmount:2},400);
    now++;assert.equal(parse(await send(growth,{...value,unionRaidSkillGroupId:423000009,medalAmount:1})).userMedalAmount,23999);
    await reject(growth,value,503,firstId);
    assert.equal(parse(await send(ranking,rankingQuery)).ranking[0].score,76001);
    parse(await send('user_data/push',saveBody([{...original,amount:23999}])));
    assert.deepEqual(parse(await send(growth,value,firstId)),{code:0,userMedalAmount:23999,
      unionRaidSkill:{medalAmount:10000}});
    now--;await reject(growth,{...value,unionRaidSkillGroupId:423000002,medalAmount:1});now++;
    assert.deepEqual(parse(await send(growth,{...value,medalAmount:1})),{code:0,userMedalAmount:23998,
      unionRaidSkill:{medalAmount:10001}});
    await reject(growth,value,503,firstId);
    parse(await send('user_data/push',saveBody([{...original,amount:23998}])));
    assert.deepEqual(parse(await send(growth,value,firstId)),{code:0,userMedalAmount:23998,
      unionRaidSkill:{medalAmount:10001}});
    const newest=app.store.db.prepare(`SELECT id,progress_before FROM union_raid_skill_growth
      WHERE union_raid_skill_group_id=? ORDER BY id DESC LIMIT 1`).get(value.unionRaidSkillGroupId);
    app.store.db.prepare('UPDATE union_raid_skill_growth SET progress_before=? WHERE id=?').run(999,newest.id);
    await reject(growth,value,503,firstId);
    app.store.db.prepare('UPDATE union_raid_skill_growth SET progress_before=? WHERE id=?').run(newest.progress_before,newest.id);
    assert.equal(parse(await send(ranking,rankingQuery)).ranking[0].score,76002);
  } finally {await close();assert.ok(path.basename(directory).startsWith('danmemore-union-raid-skills-'));
    fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
