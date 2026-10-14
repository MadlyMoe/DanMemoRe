'use strict';
// DEFERRED / NOT RUN. Synthetic saves/counter observations; no native paid result or gameplay acceptance is implied.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,unionRaidNormalEntryDebit}=require('./danmemore_server.cjs'),{request}=require('./test_danmemore_server.cjs'),
  seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-union-debit-')),stageId=1280000101101;
  let app,database,port,sequence=0,now=1661443200;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;},
    close=async()=>{if(app)await app.close();app=null;},
    send=(route,body)=>request(port,++sequence,body,String(sequence),route),
    parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);},
    put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name),
    snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
      .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()])),
    body=putItems=>({badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
      Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
      deltas:[{signature:0,trigger:'Adventure',putItems,deleteItems:{}}],operations:[]}),
    push=putItems=>send('user_data/push',body(putItems));
  try {
    for(const order of ['together','stock-first','battle-first','training-no-cost']) {
      await close();database=path.join(directory,`${order}.sqlite`);await open();
      const currency=[{userId:seed.userId,currencyId:master.currencies['currency.valis'],amount:200000,
        cumulativeAmount:200000,reservedAmount:0,signature:0}];put('UserCurrency',currency);
      const created=parse(await send('familia/create',{name:'Union debit',description:'Deferred native normal attempt observation',
        godId:20000001,style:21000001,subStyle:0,activeTime:22000001,subActiveTime:0,requireApproval:false})),charge=created.operations[0],paid=[{...currency[0],amount:100000}];
      parse(await send('user_data/push',{...body({UserCurrency:paid}),operations:[{id:charge.id,verifier:charge.token}]}));
      const users=structuredClone(app.store.read('UserInfo').data),originalBattle=app.store.read('UserAdventureState').data,
        stage={...seed.data.UserAdventureStage[0],adventureStageId:stageId,state:1,token:'',tasks:[],
          cumulativeClearCount:0,dailyClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0};
      Object.assign(users[0].playerStatus,{unionRaidBossSP:1,unionRaidBossSPUpdatedAt:now-1,
        unionRaidNormalSP:4,unionRaidNormalSPUpdatedAt:now-1});put('UserInfo',users);put('UserAdventureStage',[stage]);
      parse(await send('union_raid/status/preinitiation',{unionRaidInfoId:413000001,unionRaidStageIndex:0,
        unionRaidStageId:415000001,defeatCount:0,debug:false}));
      const entry=app.store.db.prepare('SELECT * FROM union_raid_entry').get(),
        after=unionRaidNormalEntryDebit(master,users[0].playerStatus,now),savedUsers=structuredClone(users),
        battle=[{...originalBattle[0],stageId}],wallet=app.store.hardCurrency(),queue=app.store.operations();
      Object.assign(savedUsers[0].playerStatus,after);
      if(order==='training-no-cost') {
        parse(await push({UserAdventureState:battle}));
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_attempt_debit').get().n,0);
        assert.deepEqual(app.store.read('UserInfo').data,users);continue;
      }
      if(order==='stock-first') parse(await push({UserInfo:savedUsers}));
      if(order==='battle-first') parse(await push({UserAdventureState:battle}));
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_attempt_debit').get().n,0);
      const delta=order==='stock-first'?{UserAdventureState:battle}:order==='battle-first'?{UserInfo:savedUsers}:
        {UserInfo:savedUsers,UserAdventureState:battle};
      for(const [table,event] of [['profile','UPDATE'],['union_raid_attempt_debit','INSERT'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TEMP TRIGGER fail_union_debit BEFORE ${event} ON ${table}
          BEGIN SELECT RAISE(ABORT,'deferred native attempt rollback'); END`);
        const held=snapshot(),rejected=await push(delta);assert.equal(rejected.status,503,rejected.body.toString());
        assert.equal(snapshot(),held);app.store.db.exec('DROP TRIGGER fail_union_debit');
      }
      parse(await push(delta));
      const receipt=app.store.db.prepare('SELECT * FROM union_raid_attempt_debit').get(),observed=app.store.unionRaidAttemptDebitReceipt(receipt);
      const floor=app.store.db.prepare('SELECT * FROM union_raid_attempt_checkpoint').get();
      assert.equal(floor.entry_request_key,receipt.entry_request_key);assert.deepEqual(JSON.parse(floor.status_json),after);
      assert.equal(receipt.entry_request_key,entry.request_key);assert.equal(receipt.entry_json,entry.capture_json);
      assert.deepEqual(observed.status,after);assert.deepEqual(observed.battle,battle[0]);
      assert.deepEqual(app.store.read('UserInfo').data,savedUsers);assert.equal(app.store.read('UserInfo').token,md5(savedUsers));
      assert.equal(app.store.hardCurrency(),wallet);assert.deepEqual(app.store.operations(),queue);
      parse(await push({UserInfo:savedUsers,UserAdventureState:battle}));
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_attempt_debit').get().n,1,'Native repeated puts do not charge or record again');
      await close();await open();assert.deepEqual(app.store.unionRaidAttemptDebitReceipt(receipt).status,after);
      const bad={...receipt,status_json:JSON.stringify({...after,unionRaidNormalSP:99})};
      assert.throws(()=>app.store.unionRaidAttemptDebitReceipt(bad),/original entry/);
      assert.throws(()=>app.store.unionRaidAttemptDebitReceipt({...receipt,battle_json:'bad JSON'}),/native observations/);
      assert.throws(()=>app.store.unionRaidAttemptDebitReceipt({...receipt,entry_hash:'0'.repeat(32)}),/inconsistent origin/);
      assert.deepEqual(app.store.read('UserInfo').data,savedUsers);assert.deepEqual(app.store.operations(),queue);
      const restored=snapshot(),undo=await push({UserInfo:users});assert.equal(undo.status,503,undo.body.toString());assert.equal(snapshot(),restored);
      app.store.db.exec('DELETE FROM union_raid_attempt_checkpoint');
      assert.throws(()=>app.store.read('UserInfo'),/latest observed debit checkpoint/);
      app.store.db.prepare('INSERT INTO union_raid_attempt_checkpoint VALUES(?,?,?,?,?)')
        .run(floor.user_id,floor.debit_rowid,floor.entry_request_key,floor.status_json,floor.saved_at);
      const held=snapshot();app.store.db.prepare('UPDATE union_raid_attempt_checkpoint SET status_json=?').run('{"corrupt":true}');
      assert.throws(()=>app.store.read('UserInfo'),/attempt fields/);
      app.store.db.prepare('UPDATE union_raid_attempt_checkpoint SET status_json=?').run(floor.status_json);assert.equal(snapshot(),held);
      now+=3600;const refreshed=structuredClone(savedUsers);
      refreshed[0].playerStatus.unionRaidNormalSP=after.unionRaidNormalSP+1;
      refreshed[0].playerStatus.unionRaidNormalSPUpdatedAt=after.unionRaidNormalSPUpdatedAt+3600;
      app.store.db.exec(`CREATE TEMP TRIGGER fail_union_floor BEFORE UPDATE ON union_raid_attempt_checkpoint
        BEGIN SELECT RAISE(ABORT,'deferred getter checkpoint rollback'); END`);
      const beforeGetter=snapshot();assert.equal((await push({UserInfo:refreshed})).status,503);assert.equal(snapshot(),beforeGetter);
      app.store.db.exec('DROP TRIGGER fail_union_floor');parse(await push({UserInfo:refreshed}));
      assert.deepEqual(app.store.read('UserInfo').data,refreshed);
      const delayed=snapshot(),rewind=await push({UserInfo:savedUsers});assert.equal(rewind.status,503);assert.equal(snapshot(),delayed);
      await close();await open();assert.deepEqual(app.store.read('UserInfo').data,refreshed);
      // WRITTEN ONLY: an idle fixture isolates original ticket use after a bound debit; this is not a battle-result producer.
      put('UserAdventureState',[{...battle[0],stageId:0}]);
      const ticketTable='UserUnionRaidNormalSpTicketItem',ticket={userId:seed.userId,ticketId:412000001,amount:3,
        cumulativeAmount:3,reservedAmount:0,bookEntryState:1,signature:17,lastResetAt:1661439600},
        recovered=structuredClone(refreshed);put(ticketTable,[ticket]);
      recovered[0].playerStatus.unionRaidNormalSP++;
      parse(await send('user_data/push',{...body({UserInfo:recovered,[ticketTable]:[{...ticket,amount:2}]}),
        deltas:[{signature:0,trigger:'ItemUsed',putItems:{UserInfo:recovered,[ticketTable]:[{...ticket,amount:2}]},deleteItems:{}}]}));
      const debitFloor=app.store.db.prepare('SELECT * FROM union_raid_attempt_checkpoint').get(),
        ticketFloor=app.store.db.prepare('SELECT * FROM union_raid_ticket_attempt_checkpoint').get();
      assert.equal(debitFloor.debit_rowid,floor.debit_rowid);assert.equal(debitFloor.entry_request_key,receipt.entry_request_key);
      assert.equal(debitFloor.status_json,ticketFloor.status_json);assert.deepEqual(app.store.read('UserInfo').data,recovered);
      await close();await open();assert.deepEqual(app.store.read('UserInfo').data,recovered);now-=3600;
    }
  } finally {await close();assert.ok(path.basename(directory).startsWith('danmemore-union-debit-'));
    fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
