'use strict';

// DEFERRED / NOT RUN. Save fixtures are not native earning/availability proof.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const { createServer,OFFLINE_UNAVAILABLE_CODE }=require('./danmemore_server.cjs');
const { request }=require('./test_danmemore_server.cjs');
const { underPvpRematchSeasons,underPvpRematchTickets,underPvpRematchStatuses,underPvpRematchTarget }=require('./under_pvp.cjs');
const master=require('../data/danmemore-master.json'),seed=require('../data/danmemore-seed.json');
const table='UserUnderPvpRevengeTicket',statusTable='UserUnderPvpRevengeStatus',id=69000000005,ticketId=332000001,
  season=master.underPvp.underPvpInformation[id],md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
const ticket=(itemId=ticketId,amount=3,cumulativeAmount=0,reservedAmount=0)=>({ userId:seed.userId,
  underPvpRevengeTicketId:itemId,amount,reservedAmount,bookEntryState:1,signature:0xffffffff,cumulativeAmount });
const status=(seasonId=id,initialSetting=true)=>({ userId:seed.userId,underPvpId:seasonId,isRevenge:false,
  revengeUserId:0,initialSetting,revengeStartAt:0 });

async function main() {
  const bindings=underPvpRematchSeasons(master);
  assert.equal(bindings.size,50);
  for (const binding of bindings.values()) {
    const at=master.underPvp.underPvpInformation[binding.id].slot10+100;
    assert.equal(binding.allowance,3);
    for (const amount of [0,1,3,9,999999999]) {
      const row=ticket(binding.ticketId,amount,22,2),before=status(binding.id,false),
        target=underPvpRematchTarget(binding.id,row,before,at,master,seed.userId);
      assert.deepEqual(target.stock,{amount:3,cumulativeAmount:22,reservedAmount:2},'Absolute setter, not additive/cumulative gain');
      assert.equal(underPvpRematchTickets([row],master,seed.userId).size,1,'Amount need not be below cumulative');
      assert.throws(()=>underPvpRematchTarget(binding.id,row,status(binding.id,true),at,master,seed.userId),/already initialized/);
    }
    assert.deepEqual(underPvpRematchTarget(binding.id,null,null,at,master,seed.userId).stock,
      {amount:3,cumulativeAmount:0,reservedAmount:0});
  }
  for (const patch of [{userId:2},{amount:-1},{amount:1.5},{amount:1000000000},{cumulativeAmount:-1},{reservedAmount:1.5},
    {signature:0x100000000},{bookEntryState:4},{targetUnderPvpInfoId:id},{dateList:[]},{underPvpRevengeTicketId:330000001}])
    assert.throws(()=>underPvpRematchTickets([{...ticket(),...patch}],master,seed.userId),/reconciliation/);
  assert.throws(()=>underPvpRematchTickets([ticket(),ticket()],master,seed.userId),/reconciliation/);
  for (const patch of [{userId:0},{userId:2},{isRevenge:1},{initialSetting:1},{revengeStartAt:-1},{revengeUserId:1.2},{extra:0}])
    assert.throws(()=>underPvpRematchStatuses([{...status(),...patch}],master,seed.userId),/reconciliation/);
  assert.throws(()=>underPvpRematchStatuses([status(),status()],master,seed.userId),/reconciliation/);
  assert.equal(underPvpRematchStatuses([status(id,false),status(id+1,false)],master,seed.userId).size,2,'Shared revengeUserId0 is not the row key');
  assert.throws(()=>underPvpRematchTarget(69000000001,null,null,season.slot10+100,master,seed.userId),/active season/);
  assert.throws(()=>underPvpRematchTarget(id,null,null,season.slot11,master,seed.userId),/active season/);

  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-rematch-init-'));
  let app,port,database,sequence=0,now=season.slot10+100;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const fresh=async(name,tickets=[],statuses=[])=>{await close();now=season.slot10+100;
    database=path.join(directory,`${name}.sqlite`);await open();put(table,tickets);put(statusTable,statuses);};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const delta=(putItems={},deleteItems={})=>({badges:null,scripts:{},dataTokens:{},operations:[],checksums:{before:{},
    after:Object.fromEntries([...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name] ?? [])]))},
    deltas:[{signature:0,trigger:'UnderPvpStateRevengeDefault',putItems,deleteItems}]});
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return reply;};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected=async(action,value,offline=true)=>{const before=snapshot(),reply=await send(action,value);
    assert.equal(reply.status,503,reply.body.toString());if(offline)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Rejected rematch/save preserves every SQLite table');};
  const receipts=()=>app.store.db.prepare('SELECT * FROM under_pvp_rematch_init ORDER BY under_pvp_id').all();
  const pull={tables:[table,statusTable]};
  try {
    await fresh('combined');parse(await send('user_data/pull',pull));const oldPull=sequence;
    const combined=delta({[table]:[ticket()],[statusTable]:[status()]});
    parse(await send('user_data/push',combined));const first=sequence;
    assert.equal(receipts().length,1);assert.equal(app.store.underPvpRematchState().pending.length,0);
    assert.equal(app.store.read(table).data[0].cumulativeAmount,0);assert.equal(app.store.operations().length,0);
    const saved=snapshot();parse(await request(port,first,combined,String(first),'user_data/push'));assert.equal(snapshot(),saved);
    assert.equal((await request(port,oldPull,pull,String(oldPull),'user_data/pull')).status,503,'Stale binary pull cannot restore the once-only flag');
    await close();await open();app.store.db.exec('DELETE FROM reply_cache');
    parse(await send('user_data/push',combined));assert.equal(receipts().length,1,'Fresh identity after restart does not initialize twice');
    now=master.underPvp.underPvpInformation[id+1].slot10+100;
    parse(await send('user_data/push',combined));now=season.slot10+100;
    await rejected('user_data/push',delta({[statusTable]:[status(id,false)]}));
    for (const row of [ticket(ticketId,4),ticket(ticketId,2),ticket(ticketId,3,1),ticket(ticketId,3,0,1)])
      await rejected('user_data/push',delta({[table]:[row]}));
    await rejected('user_data/push',delta({}, {[table]:[{underPvpRevengeTicketId:ticketId}]}));
    await rejected('user_data/push',delta({}, {[statusTable]:[{underPvpId:id}]}));
    parse(await send('user_data/push',delta({[table]:[{...ticket(),bookEntryState:0,signature:7}]})));
    assert.equal(receipts().length,1,'Typed opaque metadata does not issue an allowance');

    for (const order of ['stock','flag']) {
      await fresh(`${order}-first`);
      parse(await send('user_data/push',delta(order==='stock' ? {[table]:[ticket()]} : {[statusTable]:[status()]})));
      assert.equal(app.store.underPvpRematchState().pending.length,1);
      assert.equal(app.store.read(table).data[0]?.amount ?? 0,order==='stock'?3:0,'No native stock precredit on flag-only save');
      await rejected('user_data/pull',pull);
      await rejected('under_pvp/summary/get',{underPvpId:id});
      now=master.underPvp.underPvpInformation[id+1].slot10+100;
      await rejected('user_data/push',delta({[table]:[ticket(ticketId+1)],[statusTable]:[status(id+1)]}));
      await close();await open();
      parse(await send('user_data/push',delta(order==='stock' ? {[statusTable]:[status()]} : {[table]:[ticket()]})));
      assert.equal(app.store.underPvpRematchState().pending.length,0,'Captured target saves after clock/season change and restart');
      parse(await send('user_data/pull',pull));assert.equal(receipts().length,1);
    }
    await fresh('absolute', [ticket(ticketId,9,22,2)],[status(id,false)]);
    parse(await send('user_data/push',delta({[table]:[ticket(ticketId,3,22,2)],[statusTable]:[status()]})));
    assert.equal(app.store.read(table).data[0].amount,3);assert.equal(app.store.read(table).data[0].cumulativeAmount,22);
    assert.equal(app.store.read(table).data[0].reservedAmount,2);
    await fresh('unchanged-amount',[ticket()],[status(id,false)]);
    parse(await send('user_data/push',delta({[statusTable]:[status()]})));
    assert.equal(receipts()[0].ticket_saved,1,'Amount setter need not dirty an already-equal amount');

    await fresh('legacy',[ticket(ticketId,8,2)],[status()]);
    parse(await send('user_data/push',delta({[table]:[ticket(ticketId,8,2)],[statusTable]:[status()]})));
    assert.equal(receipts().length,0,'Old initialized stock is not guessed as a fresh grant');
    await rejected('user_data/push',delta({[table]:[ticket(ticketId,3,2)]}));
    await rejected('user_data/push',delta({[statusTable]:[status(id,false)]}));
    await fresh('lazy');parse(await send('user_data/push',delta({[table]:[ticket(ticketId+1,0)],[statusTable]:[status(id+1,false)]})));
    assert.equal(receipts().length,0,'Future-season lazy zero rows do not grant stock');
    await rejected('user_data/push',delta({[table]:[ticket(ticketId+1)]}));
    await rejected('user_data/push',delta({[statusTable]:[status(69000000001)]}));
    await rejected('user_data/push',delta({[table]:[ticket(ticketId,0,1)]}));
    for (const row of [ticket(ticketId,4),ticket(ticketId,3,1),ticket(ticketId,3,0,1)])
      await rejected('user_data/push',delta({[table]:[row],[statusTable]:[status()]}));

    await fresh('all-seasons');
    for (const binding of bindings.values()) {
      now=master.underPvp.underPvpInformation[binding.id].slot10+100;
      parse(await send('user_data/push',delta({[table]:[ticket(binding.ticketId)],[statusTable]:[status(binding.id)]})));
    }
    assert.equal(receipts().length,50);assert.equal(app.store.read(statusTable).data.length,50);
    assert.equal(app.store.read(table).data.length,50);assert.equal(app.store.underPvpRematchState().pending.length,0);

    for (const name of ['profile','under_pvp_rematch_init','reply_cache']) {
      await fresh(`rollback-${name}`);
      const timing=name==='profile' ? `BEFORE UPDATE ON profile WHEN NEW.name='${statusTable}'` : `BEFORE INSERT ON ${name}`;
      app.store.db.exec(`CREATE TRIGGER fail_rematch ${timing} BEGIN SELECT RAISE(ABORT,'rematch rollback'); END`);
      await rejected('user_data/push',combined,false);app.store.db.exec('DROP TRIGGER fail_rematch');
      parse(await send('user_data/push',combined));assert.equal(receipts().length,1);
    }
    await fresh('split-rollback');parse(await send('user_data/push',delta({[table]:[ticket()]})));
    app.store.db.exec("CREATE TRIGGER fail_rematch_observation BEFORE UPDATE ON under_pvp_rematch_init BEGIN SELECT RAISE(ABORT,'observation rollback'); END");
    await rejected('user_data/push',delta({[statusTable]:[status()]}),false);app.store.db.exec('DROP TRIGGER fail_rematch_observation');
    parse(await send('user_data/push',delta({[statusTable]:[status()]})));
    const row=receipts()[0];app.store.db.prepare('UPDATE under_pvp_rematch_init SET catalog_hash=? WHERE under_pvp_id=?').run('invalid',id);
    await rejected('user_data/pull',pull);
    app.store.db.prepare('UPDATE under_pvp_rematch_init SET catalog_hash=? WHERE under_pvp_id=?').run(row.catalog_hash,id);
    for (const field of ['before_ticket','before_status']) {
      app.store.db.prepare(`UPDATE under_pvp_rematch_init SET ${field}=? WHERE under_pvp_id=?`).run('0',id);
      await rejected('user_data/push',combined);
      app.store.db.prepare(`UPDATE under_pvp_rematch_init SET ${field}=? WHERE under_pvp_id=?`).run(row[field],id);
    }
    parse(await send('user_data/pull',pull));
    console.log('Rematch initialization source/save checks passed; native eligibility, spending and acceptance still required');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
