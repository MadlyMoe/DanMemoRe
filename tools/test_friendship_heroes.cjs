'use strict';

// DEFERRED synthetic save-order checks, not native earning/signatures/UI proof.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer,OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request,friendshipVoiceFixture,friendshipRefillFixture } = require('./test_danmemore_server.cjs');
const { itemDeltas } = require('./test_friendship_rewards.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-cp-heroes-'));
  let app,database,port,sequence=0;
  const open = async () => {
    app = createServer({ database,seed,master,wallNowSeconds:()=>1790866800,log:()=>{} });
    await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve)); port=app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app=null; } };
  const send = (action,body) => request(port,++sequence,body,String(sequence),action);
  const parse = reply => { assert.equal(reply.status,200,reply.body.toString()); return JSON.parse(reply.body); };
  const put = (name,rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({ name })=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected = async (pending,status,before=snapshot()) => {
    const reply=await pending; assert.equal(reply.status,status,reply.body.toString()); assert.equal(snapshot(),before);
    if (status===503) assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const push = (putItems={},operations=[],deleteItems={}) => send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{ before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name] ?? [])])) },
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length ? [{ signature:0,trigger:'FriendshipComplete',putItems,deleteItems }] : [],
    operations:operations.map(row=>({ id:row.id,verifier:row.token })),
  });
  try {
    for (const hero of [0,1,2]) for (const owner of [seed.userId,0]) {
      database=path.join(directory,`hero-${hero}-owner-${owner}.sqlite`); await open();
      put('UserCharacter',app.store.read('UserCharacter').data.map(row=>row.characterId===101000002 ? { ...row,userId:owner } : row));
      const characters=app.store.read('UserCharacter').data, original=characters.find(row=>row.characterId===101000002);
      const users=app.store.read('UserInfo').data.map(row=>({ ...row,heroType:hero })); put('UserInfo',users);
      const field=['friendship','friendshipAis','friendshipLef'][hero],
        state={ characterId:101000002,friendship:90304,friendshipLv:41,userHeroType:hero },body={ friendshipStates:[state] };
      const claim=value=>send('character/friendship/complete',value);
      const pullBody={ tables:['UserCharacter','UserInfo'] };
      assert.equal((await send('user_data/pull',pullBody)).status,200); const pullIdentity=sequence;
      await rejected(claim({ friendshipStates:[{ ...state,userHeroType:(hero+1)%3 }] }),400);
      await rejected(claim({ friendshipStates:[{ ...state,friendship:2000000001,
        friendshipLv:master.characters[state.characterId].levels.at(-1)[0] }] }),400);
      for (const replacement of [characters.filter(row=>row!==original),[...characters,{ ...original }],
        characters.map(row=>row===original?{ ...row,userId:2 }:row)]) {
        put('UserCharacter',replacement); await rejected(claim(body),400); put('UserCharacter',characters);
      }
      const operation=parse(await claim(body)).operations[0],identity=sequence;
      assert.deepEqual(app.store.read('UserCharacter').data,characters,'No point or signature pre-credit');
      const changedUsers=users.map(row=>({ ...row,heroType:(hero+1)%3 }));
      await rejected(push({ UserInfo:changedUsers }),400);
      put('UserInfo',changedUsers);
      await rejected(claim(body),503);
      await rejected(request(port,identity,body,String(identity),'character/friendship/complete'),503);
      for (const action of ['user/login','user_data/confirm']) await rejected(send(action),503);
      put('UserInfo',users);
      const inventory={...itemDeltas(app.store,operation),...friendshipVoiceFixture(app.store,[operation]),
        ...friendshipRefillFixture(app.store,[operation])},saved={ ...original,[field]:state.friendship },
        wrong={ ...original,[['friendship','friendshipAis','friendshipLef'][(hero+1)%3]]:state.friendship };
      for (const userId of [owner===0 ? seed.userId : 0,2,'0',null])
        await rejected(push({ ...inventory,UserCharacter:[{ ...saved,userId }] },[operation]),400);
      await rejected(push({ ...inventory,UserCharacter:[wrong] },[operation]),400);
      await rejected(push({ ...inventory,UserCharacter:[{ ...saved,[field]:2000000001 }] },[operation]),400);
      parse(await push({ UserCharacter:[saved] }));
      const switched=parse(await push({ UserInfo:changedUsers }));
      assert(!switched.operations.some(row=>row.id===operation.id)); assert.deepEqual(app.store.operations(),[operation]);
      await close(); await open();
      await rejected(claim(body),503);
      await rejected(send('user_data/pull',pullBody),503);
      await rejected(push({},[operation]),400); // CP alone cannot prove inventory.
      parse(await push(inventory));
      for (const [table,event] of [['stage_friendship_floor','INSERT'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'hero ACK rollback'); END`);
        await rejected(push({},[operation]),503); app.store.db.exec('DROP TRIGGER fail_ack');
      }
      parse(await push({},[operation])); await close(); await open();
      assert.equal(app.store.read('UserCharacter').data.find(row=>row.characterId===state.characterId).userId,owner);
      assert.equal(app.store.db.prepare('SELECT friendship FROM stage_friendship_floor WHERE character_id=? AND user_hero_type=?')
        .get(state.characterId,hero).friendship,state.friendship);
      await rejected(push({ UserCharacter:[original] }),400);
      await rejected(push({},[],{ UserCharacter:[{ characterId:state.characterId }] }),400);
      await rejected(push({ UserCharacter:[{ ...saved,userId:owner===0 ? seed.userId : 0 }] }),400);
      await rejected(request(port,pullIdentity,pullBody,String(pullIdentity),'user_data/pull'),503);
      parse(await push({ UserCharacter:[{ ...saved,[field]:state.friendship+1 }] }));
      assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok'); await close();
    }
    console.log('Friendship current-hero/cap/ownership, delayed ACK, native replay cancellation, indexed earned floors and rollback checks OK; native acceptance pending');
  } finally { await close(); fs.rmSync(directory,{ recursive:true,force:true }); }
}
if (require.main===module) main().catch(error=>{ console.error(error); process.exitCode=1; });
