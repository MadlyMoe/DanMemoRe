'use strict';

//DEFERRED / NOT RUN. Synthetic source/save probes, not native score validity,
//signatures, popup ordering, global ranking, UI or crash/ANR acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const master=require('../data/danmemore-master.json'),seed=require('../data/danmemore-seed.json');
const infoId=67000000002,pcId=67300000001,md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex'),
  day=at=>Math.floor((at+32400)/86400),nextDay=at=>(day(at)+1)*86400-32400;

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-shooting-rewards-'));
  let app,port,database,sequence=0,now;
  const open=async(data=master)=>{app=createServer({database,seed,master:data,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const fresh=async(name,at=1617894100)=>{await close();database=path.join(directory,`${name}.sqlite`);now=at;await open();};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const push=(putItems={},operations=[],deleteItems={})=>send('user_data/push',{badges:null,scripts:{},dataTokens:{},
    checksums:{before:{},after:Object.fromEntries([...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])]
      .map(name=>[name,md5(putItems[name] ?? [])]))},deltas:Object.keys(putItems).length || Object.keys(deleteItems).length
      ?[{signature:0,trigger:'ShootingGame',putItems,deleteItems}]:[],operations:operations.map(row=>({id:row.id,verifier:row.token}))});
  const reject=async(action,value,status=503)=>{const before=snapshot(),response=await send(action,value);
    assert.equal(response.status,status,response.body.toString());if(status===503)assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Cancellation/rollback retains profiles, score/request/prize/claim receipts and queue');};
  const save=(score,at=now)=>({userId:seed.userId,shootingGameInfoId:infoId,aisCoinAmount:5,dailyPlayAt:at,dailyPlayCount:1,
    destroyBossCount:0,highScore:score,highScoreOfDay:score,highScorePcIdOfDay:score?pcId:0,highScoreSaveAt:score?at:0,
    playableChara:[],totalScore:score,upDownControl:1});
  const complete=score=>send('shooting/stage/complete',{pcId,score});
  const rewards=()=>app.store.db.prepare('SELECT * FROM shooting_daily_reward ORDER BY info_id,day').all();
  const gifts=()=>app.store.read('UserGift').data.filter(row=>row.title.startsWith('[Offline shooting ranking] '));
  const settle=()=>send('user_data/confirm',null);
  const claim=gift=>send('gift/receive',{userId:seed.userId,giftIds:[gift.id]});
  try {
    for(const [label,at,itemId,amount] of [['iris',1617202900,205000001,100],['tickets',1617894100,295000002,5]]) {
      await fresh(label,at);
      const originalProfiles=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),wallet=app.store.hardCurrency(),paid=app.store.paidCurrency();
      const original=await complete(123),identity=sequence;parse(original);
      assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),originalProfiles);
      parse(await settle());assert.deepEqual(rewards(),[],'Completion alone cannot mint a prize');
      const native=save(123);parse(await push({UserShootingGame:[native]}));
      parse(await settle());assert.deepEqual(rewards(),[],'Same-day rankings cannot mint a prize');
      const rankingValue={rankingDateAt:at},cachedRanking=await send('shooting/ranking/get',rankingValue),
        cachedRankingIdentity=sequence;
      assert.equal(parse(cachedRanking).ranking[0].score,123);
      now=nextDay(at);
      const unearned=snapshot();
      const staleRanking=await request(port,cachedRankingIdentity,rankingValue,String(cachedRankingIdentity),'shooting/ranking/get');
      assert.equal(staleRanking.status,503,staleRanking.body.toString());
      assert.equal(snapshot(),unearned,'Cached ranking recovery cannot settle medals or Presents');
      for(const [table,event] of [['shooting_daily_reward','INSERT'],['shooting_best','UPDATE'],['profile','UPDATE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_shooting_prize BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'prize rollback'); END`);
        await reject('user_data/confirm',null);app.store.db.exec('DROP TRIGGER fail_shooting_prize');assert.equal(snapshot(),unearned);
      }
      parse(await settle());assert.equal(rewards().length,1);
      const earned=rewards()[0],gift=gifts()[0];
      assert.deepEqual([gift.itemId,gift.amount,gift.giftAcquiredType],[itemId,amount,8]);
      assert.equal(gift.title,'[Offline shooting ranking] AIS WARS Rank 1 Reward');
      assert.deepEqual(app.store.read('UserShootingGame').data,[native],'Daily reward cannot duplicate gameplay coins/counters');
      assert.deepEqual(app.store.operations(),[],'Production creates a Present, not a pre-applied reward');
      assert.equal(app.store.hardCurrency(),wallet);assert.equal(app.store.paidCurrency(),paid);
      assert.equal(app.store.read('UserShootingGameRankingReward').data[0].goldCount,1);
      assert.equal(app.store.read('UserShootingGameRankingReward').data[0].lastReceivedDailyRewardAt,now);
      const rewardedRanking=await send('shooting/ranking/get',rankingValue),rewardedRankingIdentity=sequence;
      assert.equal(parse(rewardedRanking).ranking[0].goldCount,1);
      assert.deepEqual((await request(port,rewardedRankingIdentity,rankingValue,String(rewardedRankingIdentity),'shooting/ranking/get')).body,
        rewardedRanking.body,'Settled unchanged shooting ranking replay stays byte-identical');
      parse(await settle());assert.deepEqual(rewards(),[earned]);
      await close();await open();app.store.beginSession();
      assert.deepEqual((await request(port,identity,{pcId,score:123},String(identity),'shooting/stage/complete')).body,original.body);
      assert.equal((await request(port,identity,{pcId,score:124},String(identity),'shooting/stage/complete')).status,400);
      assert.equal((await request(port,identity,{pcId,score:123},String(identity),'shooting/ranking/get')).status,400);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM shooting_best').get().n,1,'Evicted/session/restart replay cannot create another day');
      parse(await settle());assert.deepEqual(rewards(),[earned]);
      const medals=app.store.read('UserShootingGameRankingReward').data[0];
      for(const changed of [{goldCount:0},{lastReceivedDailyRewardAt:0},{userId:0},{goldCount:2}]) {
        const before=snapshot();assert.equal((await push({UserShootingGameRankingReward:[{...medals,...changed}]})).status,503);assert.equal(snapshot(),before);
      }
      for(const changed of [{amount:amount+1},{state:1},{title:'changed'}]) {
        const before=snapshot();assert.equal((await push({UserGift:[{...gift,...changed}]})).status,503);assert.equal(snapshot(),before);
      }
      const beforeDelete=snapshot();assert.equal((await push({},[],{UserGift:[{id:gift.id}]})).status,503);assert.equal(snapshot(),beforeDelete);
      const rewardAt=now;now=at;await reject('shooting/stage/complete',{pcId,score:124},400);parse(await settle());assert.deepEqual(rewards(),[earned]);now=rewardAt;
      const firstClaim=parse(await claim(gift)),claimIdentity=sequence,operation=firstClaim.operations[0];assert.equal(operation.type,2000);
      assert.equal(rewards()[0].claim_operation_id,operation.id);
      assert.equal(app.store.hardCurrency(),wallet+(itemId===205000001?amount:0));assert.equal(app.store.paidCurrency(),paid);
      assert.deepEqual(parse(await claim(gift)).operations,[operation],'Unobserved alias retains its one claim');
      const received={...gift,state:1};
      if(itemId===295000002) {
        const profile=master.itemProfiles[itemId],ticket={userId:seed.userId,[profile.idField]:itemId,amount,cumulativeAmount:amount,bookEntryState:3,signature:0};
        const inventoryReply=parse(await push({[profile.table]:[ticket]}));assert.deepEqual(inventoryReply.operations,[]);
        assert.equal(app.store.operations().length,1,'Suppressed split effect remains queued until real ACK');
        await reject('gift/receive',{userId:seed.userId,giftIds:[gift.id]});await reject('user_data/confirm',null);await reject('user/login',null);
        const before=snapshot();assert.equal((await push({[profile.table]:[{...ticket,amount:0,cumulativeAmount:0}]})).status,503);assert.equal(snapshot(),before);
        const missingFlag=snapshot();assert.equal((await push({},[operation])).status,400);assert.equal(snapshot(),missingFlag);
        parse(await push({UserGift:[received]}));
      } else parse(await push({UserGift:[received]}));
      await reject('gift/receive',{userId:seed.userId,giftIds:[gift.id]});await close();await open();
      const oldClaim=await request(port,claimIdentity,{userId:seed.userId,giftIds:[gift.id]},String(claimIdentity),'gift/receive');assert.equal(oldClaim.status,503);
      app.store.db.exec("CREATE TRIGGER fail_shooting_ack BEFORE INSERT ON operation_done BEGIN SELECT RAISE(ABORT,'ack rollback'); END");
      const beforeAck=snapshot();assert.equal((await push({},[operation])).status,503);assert.equal(snapshot(),beforeAck);
      app.store.db.exec('DROP TRIGGER fail_shooting_ack');parse(await push({},[operation]));assert.deepEqual(app.store.operations(),[]);
      const afterAck=snapshot();assert.equal((await push({UserGift:[gift]})).status,503);assert.equal(snapshot(),afterAck);
      parse(await push({},[],{UserGift:[{id:gift.id}]}));parse(await settle());assert.equal(rewards().length,1);
      assert.equal(app.store.hardCurrency(),wallet+(itemId===205000001?amount:0),'Collection credits wallet once');
    }
    for(const score of [0,500]) {
      await fresh(`native-first-${score}`);const native=save(score);
      parse(await push({UserShootingGame:[native]}));now=nextDay(now);parse(await settle());assert.deepEqual(rewards(),[],'Saved score without HTTP completion has no prize');
      now=native.dailyPlayAt;parse(await complete(score));now=nextDay(now);parse(await settle());assert.equal(rewards().length,1);
    }
    await fresh('zero-day-with-stale-best');
    const stale={...save(0),highScore:50,totalScore:50,highScoreOfDay:50,highScoreSaveAt:now-86400,highScorePcIdOfDay:67300000002};
    parse(await push({UserShootingGame:[stale]}));parse(await complete(0));now=nextDay(now);parse(await settle());
    assert.equal(rewards().length,1,'Original getter treats an older saved daily-best tuple as zero without clearing those raw fields');
    await fresh('missing-save');const at=now;parse(await complete(123));
    for(const changes of [{userId:0},{highScoreOfDay:122},{highScorePcIdOfDay:67300000002},{dailyPlayCount:0},{highScoreSaveAt:at-86400}]) {
      now=at;parse(await push({UserShootingGame:[{...save(123),...changes}]}));now=nextDay(at);parse(await settle());assert.deepEqual(rewards(),[]);
    }
    const native=save(123,at);parse(await push({UserShootingGame:[native]}));parse(await settle());assert.equal(rewards().length,1,'Late matching native save can earn its original day once');
    const originalReceipt=rewards()[0];
    app.store.db.prepare("UPDATE shooting_daily_reward SET score_json='null'").run();await reject('user_data/confirm',null);
    app.store.db.prepare('UPDATE shooting_daily_reward SET score_json=?').run(originalReceipt.score_json);
    await close();const altered=structuredClone(master);altered.shootingDailyRewards[67400000006].amount=6;await open(altered);
    await reject('user_data/confirm',null);
    console.log('Shooting original daily rewards: recorded/native score proof, SQLite atomicity, replay, medals, Presents and split save/ACK checks OK');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
