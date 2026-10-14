'use strict';

// Disposable native-shaped saves only; actual earning/signatures/UI are separate.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE} = require('./danmemore_server.cjs');
const {request,friendshipUnlockFixture} = require('./test_danmemore_server.cjs');
const {itemDeltas} = require('./test_friendship_rewards.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-cp-transport-'));
  let app,port,database,sequence=0;
  const open = async () => {
    app=createServer({database,seed,master,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close = async () => {if(app){await app.close();app=null;}};
  const send = (action,body) => request(port,++sequence,body,String(sequence),action);
  const parse = reply => {assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()]));
  const push = (putItems={},operations=[]) => send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
    deltas:Object.keys(putItems).length ? [{signature:0,trigger:'FriendshipUpdate',putItems,deleteItems:{}}] : [],
    operations:operations.map(row=>({id:row.id,verifier:row.token})),
  });
  const unavailable = async pending => {
    const before=snapshot(),reply=await pending;
    assert.equal(reply.status,503,reply.body.toString());assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before);
  };
  try {
    for(const [level,withItem,ordinary,capped=false] of [[2,false,false],[5,false,false],[41,false,false],[42,false,true],[42,false,true,true],[0,true,false]]) {
      database=path.join(directory,`level-${level}-${withItem}-${ordinary}-${capped}.sqlite`);await open();
      // Force an owed refill in this disposable fixture; a points-only save
      // must not accidentally be the complete effect when seed health matches.
      const damaged=app.store.read('UserPC').data.map(row=>({...row,hp:1,mp:1}));
      app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserPC'").run(JSON.stringify(damaged),md5(damaged));
      const itemId=215000001,itemAmount=1,original=master.characters[101000001],
        factor=original.favoriteItems.find(([id])=>id===itemId)?.[1]??1,
        points=withItem ? Math.trunc(Math.fround(Math.fround(factor*Math.fround(master.cpItems[itemId]))*itemAmount)) : original.levels.find(row=>row[0]===level)[1];
      if(withItem) {
        const items=[{userId:seed.userId,cpItemId:itemId,amount:2,cumulativeAmount:2,reservedAmount:0,signature:0,bookEntryState:3}];
        app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserCpItem'").run(JSON.stringify(items),md5(items));
      }
      if(ordinary) {
        const target=original.rewards.find(row=>row[1]===level && [0,1,15].includes(row[2]) && row[5]===0);
        assert.ok(target,'The deferred ordinary-item fixture needs one original CP reward at this level');
        for(const reward of original.rewards.filter(row=>row[1]<=level && row[5]===0 && row[0]!==target[0]))
          app.store.db.prepare('INSERT OR IGNORE INTO friendship_reward(reward_id) VALUES(?)').run(reward[0]);
        if(capped) {
          const profile=master.itemProfiles[target[4]],rows=app.store.read(profile.table).data,
            item={userId:seed.userId,[profile.idField]:target[4],amount:999999980,cumulativeAmount:999999980,
              reservedAmount:0,signature:77,bookEntryState:3},next=rows.filter(row=>row[profile.idField]!==target[4]).concat(item);
          app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(next),md5(next),profile.table);
        }
      }
      const state={characterId:101000001,friendship:points,friendshipLv:original.levels.findLast(([,threshold])=>threshold<=points)[0],userHeroType:0},
        body={friendshipStates:[state],...(withItem ? {itemId,itemAmount} : {})},result=parse(await send('character/friendship/complete',body)),identity=sequence,operation=result.operations[0];
      if(ordinary) {
        // Retained legacy servers could emit more than one native gain call for
        // one item even though the current issuer aggregates them. Preserve the
        // aggregate receipt while exercising exact ordered row-prefix recovery.
        const row=operation.parameters.gainedItems[0],first=Math.floor(row.amount/3);
        assert(first>0 && first<row.amount);
        operation.parameters.gainedItems=[{...row,amount:first},{...row,amount:row.amount-first}];
        result.gainedItems=operation.parameters.gainedItems;result.operation=operation;result.operations=[operation];
        const parameters=JSON.stringify(operation.parameters),source=JSON.stringify(operation);
        app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(parameters,operation.id);
        app.store.db.prepare('UPDATE friendship_reward_claim SET parameters=?,operation_json=? WHERE operation_id=?')
          .run(parameters,source,operation.id);
      }
      const recoverable=app.store.friendshipIrisRewardAmount(operation)===operation.parameters.issueAmount;
      let partialRecovery=null,savedOrdinaryTable=null;
      assert.deepEqual(result.operation,operation,'Hot CP delivery needs the same signed singular11000, not only plural cold operations');
      assert.equal(operation.type,11000);
      const {operation:singular,...legacy}=result;
      app.store.db.prepare("UPDATE reply_cache SET body=? WHERE action='character/friendship/complete'")
        .run(Buffer.from(JSON.stringify(legacy)).toString('base64'));
      const captured=snapshot();
      assert.deepEqual(parse(await request(port,identity,body,String(identity),'character/friendship/complete')),result);
      assert.equal(snapshot(),captured,'Legacy hot-envelope repair never mutates the queue, wallet, captures or native profiles');
      app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`${identity}/${identity}`);
      const durablePending=snapshot();
      assert.deepEqual(parse(await request(port,identity,body,String(identity),'character/friendship/complete')),result,
        'The actual received request identity restores its original pending signed11000 after cache eviction');
      assert.equal(snapshot(),durablePending,'Permanent pending friendship replay does not consume items or grant rewards again');
      assert.equal((await push({},[operation])).status,400,'An envelope is not a saved effect or ACK');
      const character={...app.store.read('UserCharacter').data.find(row=>row.characterId===state.characterId),friendship:state.friendship};
      const split=parse(await push({UserCharacter:[character]}));
      assert(!split.operations.some(row=>row.id===operation.id));assert.equal(split.operation,undefined);
      if(recoverable) {
        const effects=app.store.friendshipEffects(operation),recovery=app.store.friendshipPointRecovery(
          app.store.friendshipRewardReceipt(operation,false),effects);
        assert.ok(recovery?.pending.size,'Saved operation11000 points must retain their original fanout');
        partialRecovery=app.store.friendshipColdRecovery(operation);
        assert.equal(partialRecovery.parameters.issueAmount,operation.parameters.issueAmount,
          'Iris stays the original callback notification and is never credited again during recovery');
        if(operation.parameters.issueAmount>0) {
          const forged={...operation,parameters:{...operation.parameters,issueAmount:operation.parameters.issueAmount+1}};
          assert.throws(()=>app.store.friendshipIrisRewardAmount(forged,app.store.friendshipRewardReceipt(operation,false)),
            error=>error.status===503);
        }
        const marker=partialRecovery.parameters.friendshipStates.findIndex(row=>row.offlineFriendshipCpLevelPending===1);
        assert.notEqual(marker,-1);
        if(withItem) {
          assert.equal(app.store.friendshipConsumedState(app.store.friendshipRewardReceipt(operation,false)),'untouched');
          assert.equal(partialRecovery.parameters.offlineFriendshipItemApplied,undefined);
          parse(await push({UserCpItem:itemDeltas(app.store,operation).UserCpItem}));
          assert.equal(app.store.friendshipConsumedState(app.store.friendshipRewardReceipt(operation,false)),'saved');
          partialRecovery=app.store.friendshipColdRecovery(operation);
          assert.equal(partialRecovery.parameters.offlineFriendshipItemApplied,1,
            'A durable CP-item debit must be skipped without changing its signed source operation');
        } else if(ordinary) {
          assert.deepEqual(partialRecovery.parameters.gainedItems,operation.parameters.gainedItems,
            'An untouched ordinary reward must remain on the recovery wire');
          const [item,...remainingRows]=operation.parameters.gainedItems,profile=master.itemProfiles[item.itemId],delta=itemDeltas(app.store,operation),
            full=delta[profile.table][0],target=app.store.friendshipRewardReceipt(operation,false).items.find(row=>row.item_id===item.itemId),
            stock=target.stock_state && JSON.parse(target.stock_state),remaining=remainingRows.reduce((sum,row)=>sum+row.amount,0),
            prefix=stock?{...full,amount:Math.min(999999999,stock.beforeAmount+item.amount),
              cumulativeAmount:Math.min(999999999,stock.beforeCumulative+item.amount)}:
              {...full,amount:full.amount-remaining,cumulativeAmount:full.cumulativeAmount-remaining};
          savedOrdinaryTable=profile.table;parse(await push({[profile.table]:[prefix]}));
          partialRecovery=app.store.friendshipColdRecovery(operation,partialRecovery);
          assert.deepEqual(partialRecovery.parameters.gainedItems,remainingRows,
            'An exact saved legacy item-row prefix is omitted without replaying its additive gain');
          parse(await push({[profile.table]:delta[profile.table]}));
          partialRecovery=app.store.friendshipColdRecovery(operation,partialRecovery);
          assert.deepEqual(partialRecovery.parameters.gainedItems,[],
            'A completely saved ordinary reward row must be omitted while its real ACK remains pending');
          const forged={...partialRecovery,parameters:{...partialRecovery.parameters,
            gainedItems:[{...item,amount:item.amount+1}]}};
          assert.throws(()=>app.store.friendshipColdRecovery(operation,forged),error=>error.status===503);
        }
        const profiles=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),wallet=app.store.hardCurrency(),
          confirmed=parse(await send('user_data/confirm'));
        assert.deepEqual(confirmed.operations,[partialRecovery]);
        assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),profiles);
        assert.equal(app.store.hardCurrency(),wallet);
        for(const change of [{offlineFriendshipCpLevelPending:2},{characterId:state.characterId+999}]) {
          const forged={...partialRecovery,parameters:{...partialRecovery.parameters,
            friendshipStates:partialRecovery.parameters.friendshipStates.map((row,index)=>index===marker?{...row,...change}:row)}};
          assert.throws(()=>app.store.friendshipColdRecovery(operation,forged),error=>error.status===503);
        }
        const forgedItem={...partialRecovery,parameters:{...partialRecovery.parameters,offlineFriendshipItemApplied:2}};
        assert.throws(()=>app.store.friendshipColdRecovery(operation,forgedItem),error=>error.status===503);
      } else await unavailable(send('user_data/confirm'));
      const remainingItems=itemDeltas(app.store,operation);
      if(withItem && recoverable) delete remainingItems.UserCpItem;
      if(savedOrdinaryTable) delete remainingItems[savedOrdinaryTable];
      const full=friendshipUnlockFixture(app.store,{UserCharacter:[character],...remainingItems},[operation]);
      parse(await push(full));await close();await open();
      if(recoverable) {
        const completedRecovery=app.store.friendshipColdRecovery(operation,partialRecovery);
        assert(!completedRecovery.parameters.friendshipStates.some(row=>row.offlineFriendshipCpLevelPending===1),
          'A cached11000 fanout marker must disappear after the complete fanout is durable');
        assert.equal(completedRecovery.parameters.offlineFriendshipItemApplied,withItem?1:undefined,
          'Only an actually saved CP-item debit remains projected until the real ACK');
        if(ordinary) assert.deepEqual(completedRecovery.parameters.gainedItems,[],
          'A cached11000 recovery cannot re-add a durably saved ordinary reward');
        const profiles=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),wallet=app.store.hardCurrency(),confirmed=parse(await send('user_data/confirm'));
        assert.deepEqual(confirmed.operations,[completedRecovery],'Fully saved nonadditive CP can be registered and genuinely ACKed after an old missing hot handoff');
        assert.deepEqual(parse(await send('character/friendship/complete',body)).operation,completedRecovery);
        assert.deepEqual(app.store.operations(),[operation],'Recovery never manufactures an ACK');
        // Request/reply metadata can grow; native health, points and wallet cannot.
        assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),profiles);assert.equal(app.store.hardCurrency(),wallet);
        const oldCharacters=app.store.read('UserCharacter'),changed=oldCharacters.data.map(row=>row.characterId===state.characterId ? {...row,friendship:state.friendship+1} : row);
        app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserCharacter'").run(JSON.stringify(changed),md5(changed));
        await unavailable(send('user_data/confirm'));
        app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserCharacter'").run(JSON.stringify(oldCharacters.data),oldCharacters.token);
        assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),profiles);
      } else await unavailable(send('user_data/confirm'));
      for(const table of ['stage_friendship_floor','operation_done','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER cp_transport_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'CP ACK rollback'); END`);
        const before=snapshot();assert.equal((await push({},[operation])).status,503);assert.equal(snapshot(),before);
        app.store.db.exec('DROP TRIGGER cp_transport_fail');
      }
      parse(await push({},[operation]));assert.deepEqual(app.store.operations(),[]);
      await close();await open();parse(await send('user_data/confirm'));
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_done WHERE id=?').get(operation.id).n,1);
      const settled={code:0,...operation.parameters,operations:[]},exact=()=>request(port,identity,body,String(identity),
        'character/friendship/complete');
      app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`${identity}/${identity}`);
      assert.deepEqual(parse(await exact()),settled,'Acknowledged friendship replay returns popup data without operation11000');
      const source=app.store.db.prepare('SELECT operation_json FROM friendship_reward_claim WHERE operation_id=?')
        .get(operation.id).operation_json;
      for(const damaged of [null,'{}']) {
        app.store.db.prepare('UPDATE friendship_reward_claim SET operation_json=? WHERE operation_id=?').run(damaged,operation.id);
        app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`${identity}/${identity}`);
        await unavailable(exact());
      }
      app.store.db.prepare('UPDATE friendship_reward_claim SET operation_json=? WHERE operation_id=?').run(source,operation.id);
      app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(operation.id);await unavailable(exact());
      app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(operation.id);
      app.store.db.prepare('INSERT INTO operation_queue(id,type,parameters,token,signature) VALUES(?,?,?,?,?)')
        .run(operation.id,operation.type,JSON.stringify(operation.parameters),operation.token,operation.signature);
      await unavailable(exact());app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(operation.id);
      const pointFloor=app.store.db.prepare(`SELECT * FROM stage_friendship_floor
        WHERE character_id=? AND user_hero_type=?`).get(state.characterId,state.userHeroType);
      if(pointFloor) {
        app.store.db.prepare('DELETE FROM stage_friendship_floor WHERE character_id=? AND user_hero_type=?')
          .run(pointFloor.character_id,pointFloor.user_hero_type);await unavailable(exact());
        app.store.db.prepare('INSERT INTO stage_friendship_floor(character_id,user_hero_type,friendship) VALUES(?,?,?)')
          .run(pointFloor.character_id,pointFloor.user_hero_type,pointFloor.friendship);
      }
      const rewardFlag=app.store.db.prepare(`SELECT * FROM friendship_reward WHERE operation_id=?
        ORDER BY reward_id LIMIT 1`).get(operation.id);
      if(rewardFlag) {
        // Flags are optional independent native saves, but a partially retained
        // observed flag must not be accepted as a sound settled receipt.
        app.store.db.prepare('UPDATE friendship_reward SET received_owner=?,received_at=NULL WHERE reward_id=?')
          .run(rewardFlag.received_owner??seed.userId,rewardFlag.reward_id);
        await unavailable(exact());
        app.store.db.prepare('UPDATE friendship_reward SET received_owner=?,received_at=? WHERE reward_id=?')
          .run(rewardFlag.received_owner,rewardFlag.received_at,rewardFlag.reward_id);
      }
      const itemFloor=app.store.db.prepare(`SELECT floor.* FROM friendship_item_floor floor JOIN friendship_item_claim claim
        ON claim.item_id=floor.item_id WHERE claim.operation_id=? ORDER BY floor.item_id LIMIT 1`).get(operation.id);
      if(itemFloor) {
        app.store.db.prepare('DELETE FROM friendship_item_floor WHERE item_id=?').run(itemFloor.item_id);await unavailable(exact());
        app.store.db.prepare('INSERT INTO friendship_item_floor(item_id,cumulative_amount) VALUES(?,?)')
          .run(itemFloor.item_id,itemFloor.cumulative_amount);
      }
      const expenditure=app.store.db.prepare('SELECT * FROM friendship_item_use WHERE operation_id=?').get(operation.id);
      if(expenditure) {
        app.store.db.prepare('DELETE FROM friendship_item_use WHERE operation_id=?').run(operation.id);await unavailable(exact());
        app.store.db.prepare('INSERT INTO friendship_item_use(operation_id,item_id,remaining) VALUES(?,?,?)')
          .run(expenditure.operation_id,expenditure.item_id,expenditure.remaining);
      }
      app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`${identity}/${identity}`);
      const restoredState=snapshot();
      assert.deepEqual(parse(await exact()),settled);assert.equal(snapshot(),restoredState,
        'Settled friendship receipt validation never changes wallet, inventory, points, flags or operation history');
      assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');await close();
    }
    console.log('CP transport: signed hot/cached handoff, stat/item/debit partial recovery, bound Iris notification, no fake ACK and atomic real ACK OK; native acceptance separate');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
