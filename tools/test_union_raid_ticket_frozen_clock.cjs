'use strict';
// DEFERRED / NOT RUN. Synthetic authorized high-stock clock imports, not emulator or native lifecycle acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,encodeMsgpack,unionRaidAttemptState,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs'),
  {request}=require('./test_danmemore_server.cjs'),seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-union-frozen-clock-'));
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
      deltas:[{signature:0,trigger,putItems,deleteItems:{}}],operations:[]}),
    reject=async(route,value,semantic=true)=>{const held=snapshot(),reply=await send(route,value);
      assert.equal(reply.status,503,reply.body.toString());assert.equal(snapshot(),held);
      if(semantic)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);};
  try {
    for(const [family,ticketId,table,stock,clock,threshold] of [
      ['boss',411000001,'UserUnionRaidBossSpTicketItem','unionRaidBossSP','unionRaidBossSPUpdatedAt',3],
      ['normal',412000001,'UserUnionRaidNormalSpTicketItem','unionRaidNormalSP','unionRaidNormalSPUpdatedAt',10]])
      for(const earlyCapture of [true,false]) {
        await close();now=1661443200;database=path.join(directory,`${family}-${earlyCapture}.sqlite`);await open();
        const users=structuredClone(app.store.read('UserInfo').data),battle=app.store.read('UserAdventureState').data,
          baseline={unionRaidBossSP:1,unionRaidBossSPUpdatedAt:now-1,unionRaidNormalSP:1,unionRaidNormalSPUpdatedAt:now-1},
          ticket={userId:seed.userId,ticketId,amount:8,reservedAmount:1,bookEntryState:1,signature:0xffffffff,
            cumulativeAmount:11,lastResetAt:1661439600};
        baseline[stock]=threshold-1;Object.assign(users[0].playerStatus,baseline);
        put('UserInfo',users);put('UserAdventureState',[{...battle[0],stageId:0}]);put(table,[ticket]);
        parse(await send('user_data/push',body({[table]:[{...ticket,amount:7}]})));
        let oldHash=null;
        if(earlyCapture) {parse(await send('user_data/confirm'));oldHash=app.store.unionRaidTicketPendingUse().row.import_hash;}
        now=family==='boss'?(Math.floor((now+32400)/86400)+1)*86400-32400:now+3600;
        const getter=structuredClone(users);Object.assign(getter[0].playerStatus,unionRaidAttemptState(master,baseline,now,family));
        parse(await send('user_data/push',body({UserInfo:getter},null,'UnionRaidGetter')));
        assert.equal(app.store.unionRaidTicketPendingUse().row.sp_saved,0);
        const actual=profiles(),confirmed=parse(await send('user_data/confirm')),projection=app.store.unionRaidTicketReloadProjection(),
          pending=app.store.unionRaidTicketPendingUse(),target=projection.data[0].playerStatus,queue=app.store.operations();
        assert.equal(target[stock],threshold);assert.equal(target[clock],baseline[clock]);assert.ok(target[clock]<getter[0].playerStatus[clock]);
        assert.equal(confirmed.dataTokens.UserInfo,projection.token);assert.deepEqual(profiles(),actual);
        if(earlyCapture)assert.equal(pending.row.import_hash,oldHash,'An original frozen high-stock target needs no artificial newer clock');
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_import_history').get().n,0);
        await reject('user_data/push',body({UserInfo:projection.data}));
        await reject('user_data/push',body({UserInfo:projection.data},projection.token));
        const value={tables:['UserInfo']},pulled=await send('user_data/pull',value);
        assert.equal(pulled.status,200,pulled.body.toString());assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull(value)));
        await reject('user_data/push',body({UserInfo:projection.data},'0'.repeat(32)));
        await reject('user_data/push',body({UserInfo:projection.data},projection.token,'Blocking'));
        const otherClock=family==='boss'?'unionRaidNormalSPUpdatedAt':'unionRaidBossSPUpdatedAt',wrong=structuredClone(projection.data);
        wrong[0].playerStatus[otherClock]--;await reject('user_data/push',body({UserInfo:wrong},projection.token));
        const wrongSelected=structuredClone(projection.data);wrongSelected[0].playerStatus[clock]--;
        await reject('user_data/push',body({UserInfo:wrongSelected},projection.token));
        const below=structuredClone(projection.data);below[0].playerStatus[stock]=threshold-1;
        await reject('user_data/push',body({UserInfo:below},projection.token));
        await close();await open();assert.deepEqual(app.store.unionRaidTicketReloadProjection(),projection);
        for(const [name,event] of [['profile','UPDATE'],['union_raid_ticket_use','UPDATE'],['union_raid_ticket_stock','UPDATE'],
          ['union_raid_ticket_attempt_checkpoint','UPDATE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TEMP TRIGGER fail_frozen_clock BEFORE ${event} ON ${name}
            BEGIN SELECT RAISE(ABORT,'deferred frozen-clock rollback'); END`);
          await reject('user_data/push',body({UserInfo:projection.data},projection.token),false);app.store.db.exec('DROP TRIGGER fail_frozen_clock');
        }
        parse(await send('user_data/push',body({UserInfo:projection.data},projection.token)));
        assert.equal(app.store.unionRaidTicketPendingUse(),null);assert.deepEqual(app.store.read('UserInfo').data,projection.data);
        const settled=app.store.db.prepare('SELECT * FROM union_raid_ticket_use').get();assert.equal(settled.id,pending.row.id);
        assert.equal(settled.sp_delivery_token,projection.token);assert.equal(app.store.read(table).data[0].amount,7);assert.deepEqual(app.store.operations(),queue);
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_done').get().n,0);
        parse(await send('user_data/push',body({UserInfo:projection.data},projection.token)));
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_use').get().n,1);
        await close();await open();assert.deepEqual(app.store.read('UserInfo').data,projection.data);
      }
  } finally {await close();assert.ok(path.basename(directory).startsWith('danmemore-union-frozen-clock-'));
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
