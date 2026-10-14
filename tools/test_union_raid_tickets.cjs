'use strict';
// DEFERRED / NOT RUN. Synthetic owned tickets and native combined ItemUsed saves, not emulator acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,unionRaidTicketRows,unionRaidTicketRecovery,unionRaidAttemptState,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs'),
  {request}=require('./test_danmemore_server.cjs'),seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-union-tickets-')),
    fields=['unionRaidBossSP','unionRaidBossSPUpdatedAt','unionRaidNormalSP','unionRaidNormalSPUpdatedAt'],
    baseline={unionRaidBossSP:1,unionRaidBossSPUpdatedAt:1661443199,unionRaidNormalSP:4,unionRaidNormalSPUpdatedAt:1661443199};
  let app,database,port,sequence=0,now=1661443200;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;},
    close=async()=>{if(app)await app.close();app=null;},
    send=(route,body)=>request(port,++sequence,body,String(sequence),route),
    parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);},
    put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name),
    snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
      .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()])),
    body=(putItems,trigger='ItemUsed')=>({badges:null,scripts:{},dataTokens:{},checksums:{before:{},
      after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
      deltas:[{signature:0,trigger,putItems,deleteItems:{}}],operations:[]}),
    push=(rows,trigger)=>send('user_data/push',body(rows,trigger)),
    reject=async(rows,trigger='ItemUsed')=>{const held=snapshot(),response=await push(rows,trigger);
      assert.equal(response.status,503,response.body.toString());assert.equal(JSON.parse(response.body).code,OFFLINE_UNAVAILABLE_CODE);
      assert.equal(snapshot(),held);},
    attempts=rows=>Object.fromEntries(fields.map(key=>[key,rows[0].playerStatus[key]]));
  try {
    for(const [id,table,stock] of [[411000001,'UserUnionRaidBossSpTicketItem','unionRaidBossSP'],
      [412000001,'UserUnionRaidNormalSpTicketItem','unionRaidNormalSP']]) {
      assert.deepEqual(unionRaidTicketRecovery(master,baseline,id,2,now).candidates,[{...baseline,[stock]:baseline[stock]+2}]);
      assert.equal(unionRaidTicketRecovery(master,{...baseline,[stock]:98},id,1,now).candidates[0][stock],99);
      assert.throws(()=>unionRaidTicketRecovery(master,{...baseline,[stock]:99},id,1,now),/capacity/);
      for(const quantity of [0,-1,100,0.5]) assert.throws(()=>unionRaidTicketRecovery(master,baseline,id,quantity,now),/selected quantity/);
      assert.throws(()=>unionRaidTicketRecovery(master,baseline,id,1,1661439599),/active event/);
      assert.throws(()=>unionRaidTicketRecovery(master,baseline,id,1,1663811999),/active event/);
      await close();database=path.join(directory,`${id}.sqlite`);await open();
      const users=structuredClone(app.store.read('UserInfo').data),battle=structuredClone(app.store.read('UserAdventureState').data),
        before={userId:seed.userId,ticketId:id,amount:8,cumulativeAmount:11,reservedAmount:0,
          bookEntryState:1,signature:0xffffffff,lastResetAt:1661439600};
      Object.assign(users[0].playerStatus,baseline);battle[0].stageId=0;
      put('UserInfo',users);put('UserAdventureState',battle);put(table,[before]);
      const after={...before,amount:6},savedUsers=structuredClone(users);
      Object.assign(savedUsers[0].playerStatus,unionRaidTicketRecovery(master,baseline,id,2,now).candidates[0]);
      const delta={UserInfo:savedUsers,[table]:[after]},queue=app.store.operations(),wallet=app.store.hardCurrency();
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_use').get().n,0);
      // Split observations have their own deferred fixture; a new use still needs its original reason.
      await reject({UserInfo:savedUsers,[table]:[after]},'UnknownTicketUse');
      const wrong=structuredClone(savedUsers);wrong[0].playerStatus[stock]++;
      await reject({UserInfo:wrong,[table]:[after]});await reject({UserInfo:savedUsers,[table]:[{...after,signature:1}]});
      await reject({UserInfo:savedUsers,[table]:[{...after,lastResetAt:now}]});
      for(const [name,event] of [['profile','UPDATE'],['union_raid_ticket_use','INSERT'],['union_raid_ticket_stock','INSERT'],
        ['union_raid_ticket_attempt_checkpoint','INSERT'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TEMP TRIGGER fail_union_ticket BEFORE ${event} ON ${name}
          BEGIN SELECT RAISE(ABORT,'deferred original ticket recovery rollback'); END`);
        await reject(delta);app.store.db.exec('DROP TRIGGER fail_union_ticket');
      }
      parse(await push(delta));
      const use=app.store.db.prepare('SELECT * FROM union_raid_ticket_use').get(),receipt=app.store.unionRaidTicketUseReceipt(use),
        floor=app.store.db.prepare('SELECT * FROM union_raid_ticket_stock').get(),
        spFloor=app.store.db.prepare('SELECT * FROM union_raid_ticket_attempt_checkpoint').get();
      assert.equal(use.quantity,2);assert.equal(floor.use_id,use.id);assert.equal(spFloor.use_id,use.id);
      assert.deepEqual(receipt.before,before);assert.deepEqual(receipt.after,after);assert.deepEqual(receipt.status,attempts(savedUsers));
      assert.deepEqual(JSON.parse(floor.stock_json),after);assert.deepEqual(app.store.read(table).data,[after]);
      assert.deepEqual(app.store.read('UserInfo').data,savedUsers);assert.equal(app.store.read('UserInfo').token,md5(savedUsers));
      assert.equal(app.store.hardCurrency(),wallet);assert.deepEqual(app.store.operations(),queue);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_attempt_debit').get().n,0,'Ticket use is not a battle entry');
      parse(await push(delta));assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_use').get().n,1);
      await close();await open();assert.deepEqual(app.store.read(table).data,[after]);assert.deepEqual(app.store.read('UserInfo').data,savedUsers);
      await reject({[table]:[before]});await reject({UserInfo:users});
      assert.throws(()=>app.store.unionRaidTicketUseReceipt({...use,quantity:3}),/stock deduction/);
      assert.throws(()=>app.store.unionRaidTicketUseReceipt({...use,catalog_hash:'0'.repeat(32)}),/original catalog/);
      assert.throws(()=>app.store.unionRaidTicketUseReceipt({...use,baseline_json:'bad JSON'}),/native observations/);
      assert.throws(()=>unionRaidTicketRows([{...after,userId:seed.userId+1}],table),/identity/);
      assert.throws(()=>unionRaidTicketRows([after,after],table),/identity/);
      app.store.db.prepare('DELETE FROM union_raid_ticket_stock WHERE ticket_id=?').run(id);
      assert.throws(()=>app.store.read('UserInfo'),/permanent use checkpoint/);
      app.store.db.prepare('INSERT INTO union_raid_ticket_stock VALUES(?,?,?)').run(id,use.id,floor.stock_json);
      app.store.db.prepare('UPDATE union_raid_ticket_attempt_checkpoint SET use_id=0');
      assert.throws(()=>app.store.read('UserInfo'),/saved attempt checkpoint/);
      app.store.db.prepare('UPDATE union_raid_ticket_attempt_checkpoint SET use_id=?').run(use.id);
      now+=3600;const refreshed=structuredClone(savedUsers);
      Object.assign(refreshed[0].playerStatus,unionRaidAttemptState(master,savedUsers[0].playerStatus,now,'normal'));
      parse(await push({UserInfo:refreshed}));assert.deepEqual(app.store.read('UserInfo').data,refreshed);
      assert.deepEqual(JSON.parse(app.store.db.prepare('SELECT * FROM union_raid_ticket_attempt_checkpoint').get().status_json),attempts(refreshed));
      await reject({UserInfo:savedUsers});
      const nextUsers=structuredClone(refreshed),nextTicket={...after,amount:5};
      Object.assign(nextUsers[0].playerStatus,unionRaidTicketRecovery(master,refreshed[0].playerStatus,id,1,now).candidates[0]);
      parse(await push({UserInfo:nextUsers,[table]:[nextTicket]}));
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_use').get().n,2);
      await reject({[table]:[after]});await reject({UserInfo:refreshed});
      await close();await open();assert.deepEqual(app.store.read('UserInfo').data,nextUsers);assert.deepEqual(app.store.read(table).data,[nextTicket]);
      now-=3600;
    }
  } finally {await close();assert.ok(path.basename(directory).startsWith('danmemore-union-tickets-'));
    fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
