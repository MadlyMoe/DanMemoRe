'use strict';

// DEFERRED / NOT RUN. Explicit synthetic flag saves, NOT evidence that the
// original11000/21000 callbacks produce flags, dates, owners or signatures.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request,friendshipUnlockFixture}=require('./test_danmemore_server.cjs');
const {itemDeltas}=require('./test_friendship_rewards.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const now=1790866800,md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-cp-received-'));
  let app,port,database,sequence=0;
  const open=async()=>{
    app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async()=>{if(app){await app.close();app=null;}};
  const fresh=async name=>{await close();database=path.join(directory,`${name}.sqlite`);await open();};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const send=(action,body)=>request(port,++sequence,body,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const reject=async(pending,status,before=snapshot())=>{
    const reply=await pending;assert.equal(reply.status,status,reply.body.toString());assert.equal(snapshot(),before);
    if(status===503) assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const push=(putItems={},operations=[],deleteItems={})=>send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name] ?? [])]))},
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length ? [{signature:0,trigger:'FriendshipComplete',putItems,deleteItems}] : [],
    operations:operations.map(row=>({id:row.id,verifier:row.token}))});
  const setup=hero=>{
    put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,heroType:hero})));
    const character={...seed.data.UserCharacter[0],characterId:101000001,friendship:0,friendshipAis:0,friendshipLef:0};
    put('UserCharacter',[character]);
    put('UserAdventureStage',app.store.read('UserAdventureStage').data.map(row=>
      [2,3].includes(master.stages[row.adventureStageId]?.adventureType)?{...row,state:0}:row));
    const [rewardId,level]=master.characters[character.characterId].rewards.find(row=>row[5]===hero && [0,1,15,6].includes(row[2]));
    return {character,rewardId,state:{characterId:character.characterId,userHeroType:hero,friendshipLv:level,
      friendship:master.characters[character.characterId].levels.find(row=>row[0]===level)[1]}};
  };
  try {
    for(const hero of [0,1,2]) for(const flagsFirst of [false,true]) {
      await fresh(`hero-${hero}-flags-first-${flagsFirst}`);
      const {character,rewardId,state}=setup(hero),flag={userId:flagsFirst?0:seed.userId,rewardId,
        receivedAt:flagsFirst?0:now,isReceived:true},body={friendshipStates:[state]};
      const pullBody={tables:['UserCharacterFriendshipReward']};
      assert.equal((await send('user_data/pull',pullBody)).status,200);const oldPull=sequence;
      await reject(push({UserCharacterFriendshipReward:[flag]}),503); // Cannot suppress an unissued reward.
      const operation=parse(await send('character/friendship/complete',body)).operations[0];
      assert(!Object.hasOwn(operation.parameters,'rewardIds'),'Private binding must not leak into native wire parameters');
      assert.equal(app.store.db.prepare('SELECT operation_id FROM friendship_reward WHERE reward_id=?').get(rewardId).operation_id,operation.id);
      assert.deepEqual(app.store.read('UserCharacterFriendshipReward').data,[],'No flag/date/owner pre-credit');
      for(const bad of [{...flag,isReceived:1},{...flag,isReceived:'true'},{...flag,userId:2},{...flag,receivedAt:-1},
        {...flag,receivedAt:1.5},{...flag,rewardId:0},{...flag,characterId:1},{...flag,rewardId:String(rewardId)}])
        await reject(push({UserCharacterFriendshipReward:[bad]}),400);
      await reject(push({UserCharacterFriendshipReward:[flag,{...flag}]}),400);
      const producer=app.store.db.prepare('SELECT operation_id FROM friendship_reward WHERE reward_id=?').get(rewardId).operation_id;
      app.store.db.prepare('UPDATE friendship_reward SET operation_id=NULL WHERE reward_id=?').run(rewardId);
      await reject(push({UserCharacterFriendshipReward:[flag]}),503);
      app.store.db.prepare('UPDATE friendship_reward SET operation_id=? WHERE reward_id=?').run(producer,rewardId);
      for(const [table,event] of [['friendship_reward','UPDATE'],['profile','UPDATE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_flags BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'received flags rollback'); END`);
        await reject(push({UserCharacterFriendshipReward:[flag]}),503);app.store.db.exec('DROP TRIGGER fail_flags');
      }
      const other=friendshipUnlockFixture(app.store,{...itemDeltas(app.store,operation),UserCharacter:[{...character,
        [['friendship','friendshipAis','friendshipLef'][hero]]:state.friendship}]},[operation]);
      if(flagsFirst) {
        const reply=parse(await push({UserCharacterFriendshipReward:[flag]}));
        assert(reply.operations.some(row=>row.id===operation.id),'Flags alone are NOT inventory/CP delivery proof');
        await reject(push({},[operation]),400);await close();await open();
        assert.equal(app.store.db.prepare('SELECT received_owner FROM friendship_reward WHERE reward_id=?').get(rewardId).received_owner,0);
        parse(await push(other,[operation]));
      } else {
        parse(await push(other,[operation])); // No fabricated flag-save requirement on native ACK.
        await close();await open();parse(await push({UserCharacterFriendshipReward:[flag]}));
      }
      for(const bad of [{...flag,isReceived:false},{...flag,receivedAt:flag.receivedAt+1},
        {...flag,userId:flag.userId?0:seed.userId}]) await reject(push({UserCharacterFriendshipReward:[bad]}),400);
      await reject(push({},[],{UserCharacterFriendshipReward:[{rewardId}]}),400);
      await reject(request(port,oldPull,pullBody,String(oldPull),'user_data/pull'),503);
      await close();await open();assert.deepEqual(app.store.read('UserCharacterFriendshipReward').data,[flag]);
      put('UserCharacterFriendshipReward',[]);
      assert.throws(()=>app.store.read('UserCharacterFriendshipReward'),/Observed CP reward receipt/);
      put('UserCharacterFriendshipReward',[flag]);
      const repeat=parse(await send('character/friendship/complete',body));
      assert.equal(repeat.issueAmount,0);assert.deepEqual(repeat.gainedItems,[],'No repeat CP rewards');
      assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    }
    await fresh('corrupt-import');const {rewardId}=setup(0);
    const corrupt=[{userId:2,rewardId,receivedAt:now,isReceived:'true'}];put('UserCharacterFriendshipReward',corrupt);
    await close();await open();
    assert(!app.store.db.prepare('SELECT 1 FROM friendship_reward WHERE reward_id=?').get(rewardId),'Invalid import must not become a claim');
    assert.equal(app.store.db.prepare('SELECT data FROM profile WHERE name=?').get('UserCharacterFriendshipReward').data,JSON.stringify(corrupt));
    assert.throws(()=>app.store.read('UserCharacterFriendshipReward'),/reconciliation/);
    console.log('Synthetic CP received-ID/typed fields/producer binding/optional save/received-only replay/checkpoint/restart/cache/rollback checks OK; native production pending');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
