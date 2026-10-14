'use strict';
// DEFERRED / NOT RUN. Synthetic opaque-version echoes and canonical uploads, not native runtime acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,encodeMsgpack,unionRaidAttemptState,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs'),
  {request}=require('./test_danmemore_server.cjs'),seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-union-import-witness-')),
    baseline={unionRaidBossSP:0,unionRaidBossSPUpdatedAt:1661443199,unionRaidNormalSP:1,unionRaidNormalSPUpdatedAt:1661443199};
  let app,database,port,sequence=0,now=1661443200;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;},
    close=async()=>{if(app)await app.close();app=null;},
    send=(route,value,id=++sequence)=>request(port,id,value,String(id),route),
    parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);},
    put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name),
    snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
      .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()])),
    profiles=()=>app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),
    body=(putItems,token,trigger='ItemUsed')=>({badges:null,scripts:{},dataTokens:token?{UserInfo:token}:{},
      checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
      deltas:Object.keys(putItems).length?[{signature:0,trigger,putItems,deleteItems:{}}]:[],operations:[]}),
    reject=async(route,value,semantic=true,id,status=503)=>{const held=snapshot(),reply=await send(route,value,id);
      assert.equal(reply.status,status,reply.body.toString());assert.equal(snapshot(),held);
      if(semantic)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);};
  try {
    for(const [family,ticketId,table] of [['boss',411000001,'UserUnionRaidBossSpTicketItem'],
      ['normal',412000001,'UserUnionRaidNormalSpTicketItem']]) {
      await close();now=1661443200;database=path.join(directory,`${family}.sqlite`);await open();
      const users=structuredClone(app.store.read('UserInfo').data),battle=app.store.read('UserAdventureState').data,
        ticket={userId:seed.userId,ticketId,amount:8,reservedAmount:1,bookEntryState:1,signature:0xffffffff,
          cumulativeAmount:11,lastResetAt:1661439600};
      Object.assign(users[0].playerStatus,baseline);put('UserInfo',users);put('UserAdventureState',[{...battle[0],stageId:0}]);put(table,[ticket]);
      parse(await send('user_data/push',body({[table]:[{...ticket,amount:7}]})));
      now=family==='boss'?(Math.floor((now+32400)/86400)+1)*86400-32400:now+9*3600;
      const getter=structuredClone(users);Object.assign(getter[0].playerStatus,unionRaidAttemptState(master,baseline,now,family));
      parse(await send('user_data/push',body({UserInfo:getter},null,'UnionRaidGetter')));
      const actual=profiles(),queue=app.store.operations(),pending=app.store.unionRaidTicketPendingUse();
      assert.equal(pending.row.sp_saved,0,'A getter-equivalent upload alone cannot observe the original ticket effect');
      const confirmed=parse(await send('user_data/confirm')),projection=app.store.unionRaidTicketReloadProjection();
      assert.deepEqual(projection.data,getter);assert.notEqual(projection.token,app.store.read('UserInfo').token,
        'A distinct opaque version requests a pull even when the canonical row is unchanged');
      assert.equal(confirmed.dataTokens.UserInfo,projection.token);assert.deepEqual(profiles(),actual);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_import_delivery').get().n,0);
      parse(await send('user_data/push',body({UserInfo:getter},projection.token)));
      assert.equal(app.store.unionRaidTicketPendingUse().row.sp_saved,0,'Confirmation version with no actual pull is not a delivery witness');
      assert.equal(app.store.pull({tables:['UserInfo']}).dataTokens.UserInfo,projection.token);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_import_delivery').get().n,0,'Read-only pulls cannot mint proof');
      for(const [name,event] of [['union_raid_ticket_import_delivery','INSERT'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TEMP TRIGGER fail_union_delivery BEFORE ${event} ON ${name}
          BEGIN SELECT RAISE(ABORT,'deferred delivery rollback'); END`);
        await reject('user_data/pull',{tables:['UserInfo']},false);app.store.db.exec('DROP TRIGGER fail_union_delivery');
      }
      const pullId=++sequence,pullValue={tables:['UserInfo']},pulled=await send('user_data/pull',pullValue,pullId);
      assert.equal(pulled.status,200,pulled.body.toString());assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull(pullValue)));
      const delivery=app.store.db.prepare('SELECT * FROM union_raid_ticket_import_delivery').get();
      assert.equal(delivery.token,projection.token);assert.deepEqual(JSON.parse(delivery.status_json),
        Object.fromEntries(Object.keys(baseline).map(field=>[field,getter[0].playerStatus[field]])));
      assert.deepEqual(profiles(),actual);assert.equal(app.store.unionRaidTicketPendingUse().row.sp_delivery_token,null);
      const held=snapshot();assert.deepEqual((await send('user_data/pull',pullValue,pullId)).body,pulled.body);assert.equal(snapshot(),held);
      await close();await open();assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_import_delivery').get().n,1);
      parse(await send('user_data/push',body({UserInfo:getter},'0'.repeat(32))));assert.equal(app.store.unionRaidTicketPendingUse().row.sp_saved,0);
      parse(await send('user_data/push',body({UserInfo:getter},projection.token,'Blocking')));
      assert.equal(app.store.unionRaidTicketPendingUse().row.sp_saved,0,'Only the marked import adapter ItemUsed save witnesses an alias');
      await reject('user_data/push',body({},projection.token),false,undefined,400);
      const wrong=structuredClone(getter),stock=family==='boss'?'unionRaidBossSP':'unionRaidNormalSP';wrong[0].playerStatus[stock]++;
      await reject('user_data/push',body({UserInfo:wrong},projection.token));
      app.store.db.prepare('UPDATE union_raid_ticket_import_delivery SET data_hash=? WHERE use_id=?').run('0'.repeat(32),pending.row.id);
      await reject('user_data/push',body({UserInfo:getter},projection.token));
      app.store.db.prepare('UPDATE union_raid_ticket_import_delivery SET data_hash=? WHERE use_id=?').run(delivery.data_hash,pending.row.id);
      for(const [name,event] of [['profile','UPDATE'],['union_raid_ticket_use','UPDATE'],['union_raid_ticket_stock','UPDATE'],
        ['union_raid_ticket_attempt_checkpoint','UPDATE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TEMP TRIGGER fail_union_witness_save BEFORE ${event} ON ${name}
          BEGIN SELECT RAISE(ABORT,'deferred witness save rollback'); END`);
        await reject('user_data/push',body({UserInfo:getter},projection.token),false);app.store.db.exec('DROP TRIGGER fail_union_witness_save');
      }
      parse(await send('user_data/push',body({UserInfo:getter},projection.token)));
      assert.equal(app.store.unionRaidTicketPendingUse(),null);assert.equal(app.store.unionRaidTicketReloadProjection(),null);
      const settled=app.store.db.prepare('SELECT * FROM union_raid_ticket_use').get();
      assert.equal(settled.id,pending.row.id);assert.equal(settled.sp_saved,1);assert.equal(settled.sp_delivery_token,projection.token);
      assert.deepEqual(app.store.read('UserInfo').data,getter);assert.equal(app.store.read(table).data[0].amount,7);
      assert.deepEqual(app.store.operations(),queue);assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_done').get().n,0);
      parse(await send('user_data/push',body({UserInfo:getter},projection.token)));assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_use').get().n,1);
      await close();await open();assert.deepEqual(app.store.read('UserInfo').data,getter);
      app.store.db.prepare('DELETE FROM union_raid_ticket_import_delivery WHERE use_id=? AND token=?').run(pending.row.id,projection.token);
      await reject('user_data/confirm');app.store.db.prepare(`INSERT INTO union_raid_ticket_import_delivery
        (use_id,token,import_hash,data_hash,status_json,delivered_at) VALUES(?,?,?,?,?,?)`)
        .run(delivery.use_id,delivery.token,delivery.import_hash,delivery.data_hash,delivery.status_json,delivery.delivered_at);
      await reject('user_data/push',body({[table]:[ticket]}));
    }
  } finally {await close();assert.ok(path.basename(directory).startsWith('danmemore-union-import-witness-'));
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
