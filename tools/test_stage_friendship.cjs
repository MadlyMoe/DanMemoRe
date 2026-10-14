'use strict';

// Deferred synthetic save/order checks, NOT native CP earning, level-reward,
// signature, stat, UI or playable-combat acceptance. No real player database.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request, stageXpFixture } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-stage-cp-'));
  let app, database, port, sequence = 0, rejection;
  const open = async () => {
    app = createServer({ database,seed,master,wallNowSeconds:()=>1790866800,log:line=>{
      const entry=JSON.parse(line);if(entry.event==='rejected') rejection=entry.reason;
    } });
    await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const send = (action,body) => {rejection=undefined;return request(port,++sequence,body,String(sequence),action);};
  const parse = reply => { assert.equal(reply.status,200,rejection ?? reply.body.toString()); return JSON.parse(reply.body); };
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({ name }) => [name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const put = (name,rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const push = (putItems = {},operations = [],deleteItems = {}) => {
    putItems = stageXpFixture(app.store,putItems,operations);
    return send('user_data/push', {
    badges:null,scripts:{},dataTokens:{},checksums:{ before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name => [name,md5(putItems[name] ?? [])])) },
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length ? [{ signature:0,trigger:'AdventureComplete',putItems,deleteItems }] : [],
    operations:operations.map(row => ({ id:row.id,verifier:row.token })),
    });
  };
  const rejected = async (pending,status,before = snapshot(),structured = true) => {
    const reply = await pending;
    assert.equal(reply.status,status,rejection ?? reply.body.toString());
    if (status === 503) structured ? assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE) : assert.equal(reply.body.length,0);
    assert.equal(snapshot(),before,'Rejected handoff must retain profiles, queue, receipts, sequence and reply cache');
  };
  const stageId = 1010000101101, characterId = 101000001;
  const character = () => app.store.read('UserCharacter').data.find(row => row.characterId === characterId);
  const users = () => app.store.read('UserInfo').data;
  const level = points => master.characters[characterId].levels.findLast(([,threshold]) => threshold <= points)[0];
  const body = hero => ({ adventureStageId:stageId,token:'stage-cp',adventureStageTaskIds:[],adventureGainedItems:[],
    friendshipStates:[{ characterId,friendship:5,friendshipLv:level(5),userHeroType:hero }],
    adventureRecord:{ continueCount:0,deathCount:0,turnCount:3 },isEnemyAnnihilated:true,secretMissionCompleted:false });
  const complete = value => send('adventure/stage/complete',value);
  const clear = operation => {
    const before = operation.parameters.UserAdventureStage[0];
    return { ...before,state:4,cumulativeClearCount:before.cumulativeClearCount+1,
      firstCompleteDateTime:before.firstCompleteDateTime || 1790866800,lastCompleteDateTime:1790866800 };
  };
  const inventory = operation => {
    const result = {};
    for (const target of app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(operation.id)) {
      const prior = app.store.read(target.table_name).data.find(row => row[target.id_field] === target.item_id),
        stock=target.stock_state ? JSON.parse(target.stock_state) : null;
      (result[target.table_name] ??= []).push({ ...prior,userId:seed.userId,[target.id_field]:target.item_id,
        amount:stock?.amount ?? 0,cumulativeAmount:target.cumulative_amount,signature:operation.signature });
    }
    return result;
  };
  try {
    for (const hero of [0,1,2]) for (const cpFirst of [true,false]) for (const owner of [seed.userId,0]) {
      database = path.join(directory,`hero-${hero}-${cpFirst}-owner-${owner}.sqlite`); await open();
      put('UserCharacter',app.store.read('UserCharacter').data.map(row=>row.characterId===characterId ? { ...row,userId:owner } : row));
      put('UserInfo',users().map(row => ({ ...row,heroType:hero })));
      const field = ['friendship','friendshipAis','friendshipLef'][hero], value = body(hero), original = character();
      const pullBody = { tables:['UserCharacter','UserInfo','UserAdventureStage'] };
      assert.equal((await send('user_data/pull',pullBody)).status,200); const pullIdentity = sequence;
      for (const state of [{ ...value.friendshipStates[0],userHeroType:(hero+1)%3 },
        { ...value.friendshipStates[0],friendshipLv:level(5)+1 }, { ...value.friendshipStates[0],friendship:2000000001 },
        { ...value.friendshipStates[0],characterId:1 }, { ...value.friendshipStates[0],friendship:-1 }]) {
        const before = snapshot(); await rejected(complete({ ...value,friendshipStates:[state] }),400,before);
      }
      const badDuplicate = { ...value.friendshipStates[0],friendship:6 };
      await rejected(complete({ ...value,friendshipStates:[...value.friendshipStates,badDuplicate] }),400);
      // Identical repeated absolute targets retain the native wire multiplicity.
      value.friendshipStates.push(Object.fromEntries(Object.entries(value.friendshipStates[0]).reverse()));
      for (const table of ['stage_delivery','stage_completion','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_issue BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'CP issue rollback'); END`);
        const before = snapshot(); await rejected(complete(value),503,before,false); app.store.db.exec('DROP TRIGGER fail_issue');
      }
      const operation = parse(await complete(value)).operation, identity = sequence;
      assert.deepEqual(operation.parameters.friendshipStates,[{ characterId,friendship:5 },{ characterId,friendship:5 }]);
      assert.deepEqual(character(),original,'Issuing a result must not pre-credit native CP or signatures');
      const captured = app.store.db.prepare('SELECT friendship_before FROM stage_delivery WHERE operation_id=?').get(operation.id).friendship_before;
      assert.equal(JSON.parse(captured).length,1); assert.equal(JSON.parse(captured)[0].before,original[field]);
      for (const replacement of [null,'{}','not-json',JSON.stringify([{ ...JSON.parse(captured)[0],levelsHash:'wrong' }])]) {
        app.store.db.prepare('UPDATE stage_delivery SET friendship_before=? WHERE operation_id=?').run(replacement,operation.id);
        const before = snapshot(); await rejected(complete(value),503,before);
        assert.deepEqual(app.store.operations(),[operation]);
        app.store.db.prepare('UPDATE stage_delivery SET friendship_before=? WHERE operation_id=?').run(captured,operation.id);
      }
      const oldUsers = users(); put('UserInfo',oldUsers.map(row => ({ ...row,heroType:(hero+1)%3 })));
      await rejected(complete(value),503);
      await rejected(request(port,identity,value,String(identity),'adventure/stage/complete'),503);
      put('UserInfo',oldUsers);
      await rejected(push({ UserInfo:oldUsers.map(row => ({ ...row,heroType:(hero+1)%3 })) }),400);
      await rejected(send('character/friendship/complete',{ friendshipStates:[value.friendshipStates[0]] }),503);
      await rejected(complete({ ...value,adventureStageId:1010000101102,token:'overlapping-stage' }),503);
      const saved = { ...original,[field]:5 }, other = { ...original,[['friendship','friendshipAis','friendshipLef'][(hero+1)%3]]:5 };
      const clearItems = { ...inventory(operation),UserAdventureStage:[clear(operation)] },
        next=JSON.parse(app.store.db.prepare('SELECT next_unlock FROM stage_delivery WHERE operation_id=?').get(operation.id).next_unlock);
      if(next?.stageId && [null,0].includes(next.beforeState) && next.lowerStates.every(([,state])=>state===4))
        clearItems.UserAdventureStage.push({...app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===next.stageId),
          userId:seed.userId,adventureStageId:next.stageId,state:1});
      for (const userId of [owner===0 ? seed.userId : 0,2,'0',null])
        await rejected(push({ ...clearItems,UserCharacter:[{ ...saved,userId }] },[operation]),400);
      await rejected(push({ ...clearItems,UserCharacter:[other] },[operation]),400);
      await rejected(push(clearItems,[operation]),400);
      app.store.db.exec("CREATE TRIGGER fail_observe BEFORE UPDATE ON stage_delivery BEGIN SELECT RAISE(ABORT,'CP observation rollback'); END");
      await rejected(push(cpFirst ? { UserCharacter:[saved] } : clearItems),503,snapshot(),false); app.store.db.exec('DROP TRIGGER fail_observe');
      const first = parse(await push(cpFirst ? { UserCharacter:[saved] } : clearItems));
      assert(!first.operations.some(row => row.id === operation.id)); assert.deepEqual(app.store.operations(),[operation]);
      await close(); await open();
      if(cpFirst) {
        const before=snapshot();assert.deepEqual(app.store.stageColdRecovery(operation),operation);
        assert.equal(snapshot(),before,'Same-level absolute CP recovery is pure');
        const cold=await send('user_data/confirm'),coldIdentity=sequence;
        assert.deepEqual(parse(cold).operations,[operation]);parse(await send('user/login'));
        assert.equal((await send('user_data/pull',pullBody)).status,200);
        await close();await open();
        assert.deepEqual((await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm')).body,cold.body);
        assert.deepEqual(character(),saved,'Replay does not add CP again or change the actual character owner');
        await rejected(push({},[operation]),400);
      }
      if(!cpFirst) for (const [action,requestBody] of [['user_data/confirm',undefined],['user/login',undefined],['user_data/pull',pullBody]])
        await rejected(send(action,requestBody),503);
      await rejected(complete(value),503);
      await rejected(request(port,identity,value,String(identity),'adventure/stage/complete'),503);
      if (cpFirst) {
        await rejected(push({ UserCharacter:[original] }),400);
        await rejected(push({},[],{ UserCharacter:[{ characterId }] }),400);
        parse(await push({ UserInfo:users().map(row => ({ ...row,heroType:(hero+1)%3 })) }));
        await rejected(send('user_data/confirm'),503);
      } else await rejected(push({},[operation]),400);
      parse(await push(cpFirst ? clearItems : { UserCharacter:[saved] }));
      assert(JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id).observed)
        .includes(`cp:${characterId}:${hero}`));
      for (const [table,event] of [['stage_friendship_floor','INSERT'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'CP ACK rollback'); END`);
        await rejected(push({},[operation]),503,snapshot(),false); app.store.db.exec('DROP TRIGGER fail_ack');
      }
      parse(await push({},[operation])); await close(); await open();
      assert.equal(character().userId,owner,'The acknowledged native row retains its actual owner');
      assert.equal(app.store.db.prepare('SELECT friendship FROM stage_friendship_floor WHERE character_id=? AND user_hero_type=?')
        .get(characterId,hero).friendship,5);
      await rejected(push({ UserCharacter:[original] }),400);
      await rejected(push({},[],{ UserCharacter:[{ characterId }] }),400);
      await rejected(request(port,pullIdentity,pullBody,String(pullIdentity),'user_data/pull'),503);
      parse(await push({ UserCharacter:[{ ...saved,[field]:6 }] }));
      put('UserInfo',users().map(row => ({ ...row,heroType:hero })));
      await rejected(complete({ ...value,token:'regressed-cp' }),400);
      const repeatBody = { ...value,token:'no-new-cp',friendshipStates:[{ ...value.friendshipStates[0],friendship:6,friendshipLv:level(6) }] };
      const repeat = parse(await complete(repeatBody)).operation;
      assert.deepEqual(parse(await push({ UserCharacter:[character()] })).operations,[], 'Unchanged CP cannot clear the pending native receipt');
      assert.deepEqual(app.store.operations(),[repeat]);
      parse(await push({ UserAdventureStage:[clear(repeat)] },[repeat]));
      const capBody = { ...value,token:'cp-cap',friendshipStates:[{ ...value.friendshipStates[0],friendship:2000000000,friendshipLv:level(2000000000) }] };
      const capped = parse(await complete(capBody)).operation;
      parse(await push({ UserCharacter:[{ ...character(),[field]:2000000000 }],UserAdventureStage:[clear(capped)] },[capped]));
      assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok'); await close();
    }
    console.log('Stage CP three-track saves, split delivery, ACK/floors, overlap, cap, replay/restart and rollback checks OK; native acceptance pending');
  } finally { await close(); fs.rmSync(directory,{ recursive:true,force:true }); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
