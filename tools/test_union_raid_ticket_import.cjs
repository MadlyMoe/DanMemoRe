'use strict';
// DEFERRED / NOT RUN. Synthetic delivery/import uploads; the written ARM64 adapter is not native acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,encodeMsgpack,unionRaidTicketRecovery,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs'),
  {request}=require('./test_danmemore_server.cjs'),seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-union-ticket-import-')),
    baseline={unionRaidBossSP:1,unionRaidBossSPUpdatedAt:1661443199,unionRaidNormalSP:4,unionRaidNormalSPUpdatedAt:1661443199};
  let app,database,port,sequence=0,now=1661443200;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;},
    close=async()=>{if(app)await app.close();app=null;},
    send=(route,value,id=++sequence)=>request(port,id,value,String(id),route),
    parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);},
    put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name),
    snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
      .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()])),
    body=(putItems,trigger='ItemUsed')=>({badges:null,scripts:{},dataTokens:{},checksums:{before:{},
      after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
      deltas:[{signature:0,trigger,putItems,deleteItems:{}}],operations:[]}),
    reject=async(route,value,semantic=true,id,status=503)=>{const held=snapshot(),reply=await send(route,value,id);
      assert.equal(reply.status,status,reply.body.toString());assert.equal(snapshot(),held);
      if(semantic)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);};
  try {
    for(const [ticketId,table] of [[411000001,'UserUnionRaidBossSpTicketItem'],[412000001,'UserUnionRaidNormalSpTicketItem']])
      for(const order of ['stock-first','attempts-first']) {
        await close();now=1661443200;database=path.join(directory,`${ticketId}-${order}.sqlite`);await open();
        const users=structuredClone(app.store.read('UserInfo').data),battle=app.store.read('UserAdventureState').data,
          ticket={userId:seed.userId,ticketId,amount:8,reservedAmount:1,bookEntryState:3,signature:0xffffffff,
            cumulativeAmount:11,lastResetAt:1661439600},after={...ticket,amount:6},credited=structuredClone(users);
        Object.assign(users[0].playerStatus,baseline);Object.assign(credited[0].playerStatus,
          unionRaidTicketRecovery(master,baseline,ticketId,2,now).candidates[0]);
        put('UserInfo',users);put('UserAdventureState',[{...battle[0],stageId:0}]);put(table,[ticket]);
        parse(await send('user_data/push',body(order==='stock-first'?{[table]:[after]}:{UserInfo:credited})));
        const pending=app.store.unionRaidTicketPendingUse(),initialProfiles=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),
          queue=app.store.operations(),done=app.store.db.prepare('SELECT * FROM operation_done ORDER BY id').all();
        const unrelatedTable=table==='UserUnionRaidBossSpTicketItem'?'UserUnionRaidNormalSpTicketItem':'UserUnionRaidBossSpTicketItem',
          unrelatedReply=await send('user_data/pull',{tables:[unrelatedTable]});
        assert.equal(unrelatedReply.status,200,unrelatedReply.body.toString());
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_import').get().n,0);
        assert.equal(app.store.unionRaidTicketPendingUse().row.import_hash,null,'Unrelated pulls cannot issue a recovery capture');
        now+=3617; // A projection may have a later getter clock than the original ItemUsed capture.
        for(const [name,event] of [['union_raid_ticket_import','INSERT'],['union_raid_ticket_use','UPDATE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TEMP TRIGGER fail_union_import BEFORE ${event} ON ${name}
            BEGIN SELECT RAISE(ABORT,'deferred import capture rollback'); END`);
          await reject('user_data/confirm',undefined,false);app.store.db.exec('DROP TRIGGER fail_union_import');
        }
        const confirmationId=++sequence,confirmed=parse(await send('user_data/confirm',undefined,confirmationId)),
          imported=app.store.unionRaidTicketReloadProjection();
        assert.equal(imported.table,order==='stock-first'?'UserInfo':table);
        assert.equal(confirmed.dataTokens[imported.table],imported.token);assert.match(imported.token,/^[0-9a-f]{32}$/);
        assert.notEqual(imported.token,md5(imported.data),'An opaque recovery version is separate from a data checksum');
        assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),initialProfiles);
        assert.equal(app.store.unionRaidTicketPendingUse().row.stock_saved,pending.row.stock_saved);
        assert.equal(app.store.unionRaidTicketPendingUse().row.sp_saved,pending.row.sp_saved);
        assert.deepEqual(app.store.operations(),queue);assert.deepEqual(app.store.db.prepare('SELECT * FROM operation_done ORDER BY id').all(),done);
        assert.deepEqual(parse(await send('user_data/confirm',undefined,confirmationId)),confirmed);
        const held=snapshot(),readonly=app.store.pull({tables:[imported.table]}),
          other=app.store.pull({tables:[table==='UserUnionRaidBossSpTicketItem'?'UserUnionRaidNormalSpTicketItem':'UserUnionRaidBossSpTicketItem']});
        assert.equal(snapshot(),held,'Read-only projection must not create a receipt, grant or observation');
        assert.equal(readonly.dataTokens[imported.table],imported.token);
        const marked=imported.data.map(row=>({...row,offlineUnionTicketUse:1}));
        assert.deepEqual(readonly.data[imported.table],imported.table==='UserInfo'?marked[0]:marked);
        assert.ok(imported.data.every(row=>!Object.hasOwn(row,'offlineUnionTicketUse')),
          'The native target and token cannot include the delivery-only marker');
        await reject('user_data/push',body({[imported.table]:marked}),false,undefined,400);
        assert.equal(Object.keys(other.data).length,1,'Only requested tables may be returned');
        const pullId=++sequence,pullValue={tables:['UserInfo',table]},pulled=await send('user_data/pull',pullValue,pullId);
        assert.equal(pulled.status,200,pulled.body.toString());assert.equal(pulled.headers['content-type'],'application/x-msgpack');
        assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull(pullValue)));
        await close();await open();assert.deepEqual(app.store.unionRaidTicketReloadProjection(),imported);
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_import').get().n,1);
        assert.deepEqual((await send('user_data/pull',pullValue,pullId)).body,pulled.body);
        if(order==='stock-first') {
          const changed=structuredClone(app.store.read('UserInfo').data);changed[0].name='Deferred imported name';
          const optionsId=++sequence,optionsBody=body({UserInfo:changed},'OptionsChanged'),
            optionsReply=parse(await send('user_data/push',optionsBody,optionsId));
          assert.deepEqual(parse(await send('user_data/push',optionsBody,optionsId)),optionsReply,
            'A saved push reply validates actual saved tokens, not cold projected tokens');
          const refreshed=app.store.unionRaidTicketReloadProjection();assert.equal(refreshed.data[0].name,changed[0].name);
          assert.notEqual(refreshed.token,imported.token);assert.equal(refreshed.data[0].playerStatus.baseSP,changed[0].playerStatus.baseSP);
          const unrelated=ticketId===411000001?['unionRaidNormalSP','unionRaidNormalSPUpdatedAt']:['unionRaidBossSP','unionRaidBossSPUpdatedAt'];
          for(const field of unrelated)assert.equal(refreshed.data[0].playerStatus[field],changed[0].playerStatus[field]);
          await reject('user_data/confirm',undefined,true,confirmationId);await reject('user_data/pull',pullValue,true,pullId);
        }
        const capture=app.store.db.prepare('SELECT * FROM union_raid_ticket_import').get(),
          pointer=app.store.db.prepare('SELECT import_hash FROM union_raid_ticket_use WHERE id=?').get(pending.row.id).import_hash;
        const capturedNow=now;now=capture.captured_at-1;await reject('user_data/confirm');
        now=1663811999;await reject('user_data/confirm');now=capturedNow;
        app.store.db.prepare('UPDATE union_raid_ticket_use SET import_hash=? WHERE id=?').run('0'.repeat(32),pending.row.id);
        await reject('user_data/confirm');app.store.db.prepare('UPDATE union_raid_ticket_use SET import_hash=? WHERE id=?').run(pointer,pending.row.id);
        app.store.db.prepare('DELETE FROM union_raid_ticket_import WHERE use_id=?').run(pending.row.id);
        await reject('user_data/confirm');app.store.db.prepare(`INSERT INTO union_raid_ticket_import
          (use_id,table_name,captured_at,status_json,source_hash) VALUES(?,?,?,?,?)`)
          .run(capture.use_id,capture.table_name,capture.captured_at,capture.status_json,capture.source_hash);
        app.store.db.prepare('UPDATE union_raid_ticket_import SET status_json=? WHERE use_id=?').run('{}',pending.row.id);
        await reject('user_data/confirm');app.store.db.prepare('UPDATE union_raid_ticket_import SET status_json=? WHERE use_id=?')
          .run(capture.status_json,pending.row.id);
        const missing=app.store.unionRaidTicketReloadProjection(),flush=body({[missing.table]:missing.data},'Blocking');
        now+=3613; // A delayed upload of an imported snapshot is not a new current-time getter.
        for(const [name,event] of [['profile','UPDATE'],['union_raid_ticket_use','UPDATE'],
          ['union_raid_ticket_stock','UPDATE'],['union_raid_ticket_attempt_checkpoint','UPDATE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TEMP TRIGGER fail_union_import_save BEFORE ${event} ON ${name}
            BEGIN SELECT RAISE(ABORT,'deferred imported upload rollback'); END`);
          await reject('user_data/push',flush,false);app.store.db.exec('DROP TRIGGER fail_union_import_save');
        }
        parse(await send('user_data/push',flush));assert.equal(app.store.unionRaidTicketPendingUse(),null);
        assert.equal(app.store.unionRaidTicketReloadProjection(),null);assert.deepEqual(app.store.read(table).data,[after]);
        if(missing.table==='UserInfo')assert.deepEqual(app.store.read('UserInfo').data,missing.data);
        const settled=app.store.db.prepare('SELECT * FROM union_raid_ticket_use').get();assert.equal(settled.id,pending.row.id);
        assert.equal(settled.stock_saved,1);assert.equal(settled.sp_saved,1);assert.equal(settled.import_hash,pointer);
        assert.deepEqual(app.store.operations(),queue);assert.deepEqual(app.store.db.prepare('SELECT * FROM operation_done ORDER BY id').all(),done);
        parse(await send('user_data/push',flush));assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_use').get().n,1);
        await close();await open();assert.equal(app.store.unionRaidTicketPendingUse(),null);
        const actual=app.store.pull(pullValue);assert.deepEqual(actual.data[table],[after]);
        await reject('user_data/push',body({[table]:[ticket]}));
      }
    // A day reset can erase a sub-daily credit; only an actual delivered-version upload may settle that alias.
    await close();now=1661443200;database=path.join(directory,'ambiguous-day-reset.sqlite');await open();
    const users=structuredClone(app.store.read('UserInfo').data),battle=app.store.read('UserAdventureState').data,
      ticket={userId:seed.userId,ticketId:411000001,amount:8,reservedAmount:0,bookEntryState:1,signature:0,
        cumulativeAmount:8,lastResetAt:1661439600};
    Object.assign(users[0].playerStatus,baseline);put('UserInfo',users);put('UserAdventureState',[{...battle[0],stageId:0}]);
    put('UserUnionRaidBossSpTicketItem',[ticket]);
    parse(await send('user_data/push',body({UserUnionRaidBossSpTicketItem:[{...ticket,amount:7}]})));
    now=(Math.floor((now+32400)/86400)+1)*86400-32400;
    parse(await send('user_data/confirm'));assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_import').get().n,1);
    assert.equal(app.store.unionRaidTicketPendingUse().row.sp_saved,0);assert.deepEqual(app.store.read('UserInfo').data,users);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_import_delivery').get().n,0);
  } finally {await close();assert.ok(path.basename(directory).startsWith('danmemore-union-ticket-import-'));
    fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
