'use strict';
// DEFERRED / NOT RUN. Synthetic getter observations and revised imports, not native cold-reload acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,encodeMsgpack,unionRaidAttemptState,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs'),
  {request}=require('./test_danmemore_server.cjs'),seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-union-import-clock-')),
    baseline={unionRaidBossSP:1,unionRaidBossSPUpdatedAt:1661443199,unionRaidNormalSP:1,unionRaidNormalSPUpdatedAt:1661443199};
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
    body=(putItems,trigger='UnionRaidGetter')=>({badges:null,scripts:{},dataTokens:{},checksums:{before:{},
      after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
      deltas:[{signature:0,trigger,putItems,deleteItems:{}}],operations:[]}),
    reject=async(route,value,semantic=true,id)=>{const held=snapshot(),reply=await send(route,value,id);
      assert.equal(reply.status,503,reply.body.toString());assert.equal(snapshot(),held);
      if(semantic)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);};
  try {
    database=path.join(directory,'normal-revisions.sqlite');await open();
    const users=structuredClone(app.store.read('UserInfo').data),battle=app.store.read('UserAdventureState').data,
      ticket={userId:seed.userId,ticketId:412000001,amount:8,reservedAmount:1,bookEntryState:1,signature:0xffffffff,
        cumulativeAmount:11,lastResetAt:1661439600},table='UserUnionRaidNormalSpTicketItem';
    Object.assign(users[0].playerStatus,baseline);put('UserInfo',users);put('UserAdventureState',[{...battle[0],stageId:0}]);put(table,[ticket]);
    parse(await send('user_data/push',body({[table]:[{...ticket,amount:7}]},'ItemUsed')));
    const confirmationId=++sequence;parse(await send('user_data/confirm',undefined,confirmationId));
    const first=app.store.unionRaidTicketReloadProjection(),useId=app.store.unionRaidTicketPendingUse().row.id,
      firstHash=app.store.unionRaidTicketPendingUse().row.import_hash,queue=app.store.operations();
    assert.equal(first.data[0].playerStatus.unionRaidNormalSP,2);assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_import_history').get().n,0);
    let previous=first,previousHash=firstHash;
    for(let step=1;step<=2;step++) {
      now+=3600;const getter=structuredClone(app.store.read('UserInfo').data);
      Object.assign(getter[0].playerStatus,unionRaidAttemptState(master,getter[0].playerStatus,now,'normal'));
      parse(await send('user_data/push',body({UserInfo:getter})));
      assert.equal(app.store.unionRaidTicketPendingUse().row.sp_saved,0,'A saved uncredited getter is not the ticket effect');
      const actual=profiles(),oldCapture=app.store.db.prepare('SELECT * FROM union_raid_ticket_import WHERE use_id=?').get(useId);
      assert.throws(()=>app.store.unionRaidTicketReloadProjection(),/newer or unmatched/);
      await reject('user_data/confirm',undefined,true,confirmationId);
      for(const [name,event] of [['union_raid_ticket_import_history','INSERT'],['union_raid_ticket_import','UPDATE'],
        ['union_raid_ticket_use','UPDATE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TEMP TRIGGER fail_union_import_revision BEFORE ${event} ON ${name}
          BEGIN SELECT RAISE(ABORT,'deferred import revision rollback'); END`);
        await reject('user_data/confirm',undefined,false);app.store.db.exec('DROP TRIGGER fail_union_import_revision');
      }
      const confirmed=parse(await send('user_data/confirm')),
        revised=app.store.unionRaidTicketReloadProjection(),pending=app.store.unionRaidTicketPendingUse(),
        history=app.store.db.prepare('SELECT * FROM union_raid_ticket_import_history WHERE use_id=? ORDER BY id DESC LIMIT 1').get(useId);
      assert.notEqual(pending.row.import_hash,previousHash);assert.equal(pending.row.import_parent_hash,previousHash);
      assert.equal(history.capture_hash,previousHash);assert.equal(history.replacement_hash,pending.row.import_hash);
      assert.deepEqual(JSON.parse(history.capture_json),oldCapture);
      assert.equal(history.native_before_json,app.store.db.prepare('SELECT status_json FROM union_raid_ticket_attempt_checkpoint').get().status_json);
      assert.deepEqual(profiles(),actual);assert.equal(pending.row.stock_saved,1);assert.equal(pending.row.sp_saved,0);assert.deepEqual(app.store.operations(),queue);
      assert.equal(revised.data[0].playerStatus.unionRaidNormalSP,getter[0].playerStatus.unionRaidNormalSP+1,
        'The original one-ticket credit is projected once, never re-added to a prior projection');
      assert.equal(revised.data[0].playerStatus.unionRaidNormalSPUpdatedAt,getter[0].playerStatus.unionRaidNormalSPUpdatedAt);
      assert.equal(revised.data[0].playerStatus.unionRaidBossSP,getter[0].playerStatus.unionRaidBossSP);
      assert.equal(confirmed.dataTokens.UserInfo,revised.token);
      const value={tables:['UserInfo']},pull=await send('user_data/pull',value);
      assert.equal(pull.status,200,pull.body.toString());assert.deepEqual(pull.body,encodeMsgpack(app.store.pull(value)));
      await reject('user_data/push',body({UserInfo:previous.data},'ItemUsed'));
      parse(await send('user_data/confirm'));assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_import_history').get().n,step);
      await close();await open();assert.deepEqual(app.store.unionRaidTicketReloadProjection(),revised);
      if(step===2) {
        app.store.db.prepare('UPDATE union_raid_ticket_use SET import_parent_hash=NULL WHERE id=?').run(useId);
        await reject('user_data/confirm');app.store.db.prepare('UPDATE union_raid_ticket_use SET import_parent_hash=? WHERE id=?').run(previousHash,useId);
        app.store.db.prepare('DELETE FROM union_raid_ticket_import_history WHERE id=?').run(history.id);
        await reject('user_data/confirm');app.store.db.prepare(`INSERT INTO union_raid_ticket_import_history
          (id,use_id,capture_hash,capture_json,replaced_at,replacement_hash,native_before_json,native_saved_at) VALUES(?,?,?,?,?,?,?,?)`)
          .run(history.id,history.use_id,history.capture_hash,history.capture_json,history.replaced_at,history.replacement_hash,
            history.native_before_json,history.native_saved_at);
        app.store.db.prepare('UPDATE union_raid_ticket_import_history SET native_before_json=? WHERE id=?').run('{}',history.id);
        await reject('user_data/confirm');app.store.db.prepare('UPDATE union_raid_ticket_import_history SET native_before_json=? WHERE id=?')
          .run(history.native_before_json,history.id);
      }
      previous=revised;previousHash=pending.row.import_hash;
    }
    parse(await send('user_data/push',body({UserInfo:previous.data},'ItemUsed')));
    assert.equal(app.store.unionRaidTicketPendingUse(),null);assert.equal(app.store.unionRaidTicketReloadProjection(),null);
    assert.equal(app.store.read(table).data[0].amount,7);assert.deepEqual(app.store.read('UserInfo').data,previous.data);
    parse(await send('user_data/push',body({UserInfo:previous.data},'ItemUsed')));
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_use').get().n,1);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_import_history').get().n,2);
    await close();await open();assert.deepEqual(app.store.read('UserInfo').data,previous.data);
    // An erased boss credit can be projected after a day reset; it remains unobserved until a witnessed upload.
    await close();now=1661443200;database=path.join(directory,'boss-ambiguous-revision.sqlite');await open();
    const boss=structuredClone(app.store.read('UserInfo').data),idle=app.store.read('UserAdventureState').data;
    Object.assign(boss[0].playerStatus,{...baseline,unionRaidBossSP:0});put('UserInfo',boss);put('UserAdventureState',[{...idle[0],stageId:0}]);
    put('UserUnionRaidBossSpTicketItem',[{...ticket,ticketId:411000001}]);
    parse(await send('user_data/push',body({UserUnionRaidBossSpTicketItem:[{...ticket,ticketId:411000001,amount:7}]},'ItemUsed')));
    parse(await send('user_data/confirm'));const bossHash=app.store.unionRaidTicketPendingUse().row.import_hash;
    now=(Math.floor((now+32400)/86400)+1)*86400-32400;const reset=structuredClone(boss);
    Object.assign(reset[0].playerStatus,unionRaidAttemptState(master,boss[0].playerStatus,now,'boss'));
    parse(await send('user_data/push',body({UserInfo:reset})));parse(await send('user_data/confirm'));
    assert.notEqual(app.store.unionRaidTicketPendingUse().row.import_hash,bossHash);assert.equal(app.store.unionRaidTicketPendingUse().row.sp_saved,0);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_import_history').get().n,1);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_import_delivery').get().n,0);
  } finally {await close();assert.ok(path.basename(directory).startsWith('danmemore-union-import-clock-'));
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));
    fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
