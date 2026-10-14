'use strict';

// DEFERRED / NOT RUN. Legacy-stock fixtures are NOT original earning/UI proof.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const { createServer,OFFLINE_UNAVAILABLE_CODE }=require('./danmemore_server.cjs');
const { request }=require('./test_danmemore_server.cjs');
const { underPvpPassRows,underPvpPassCandidates,underPvpPassChanges }=require('./under_pvp.cjs');
const master=require('../data/danmemore-master.json'),seed=require('../data/danmemore-seed.json');
const table='UserUnderPvpStaminaTicket',ticketId=330000001,id=69000000001,season=master.underPvp.underPvpInformation[id];
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
const sp=(amount,at)=>({ underPvpSP:amount,underPvpSPUpdatedAt:at });
const ticket=(itemId,amount)=>({ userId:seed.userId,underPvpStaminaTicketId:itemId,amount,bookEntryState:0,
  signature:0xffffffff,targetUnderPvpInfoId:master.underPvp.underPvpStaminaTicket[itemId].slot7 });

async function main() {
  for (const [key,row] of Object.entries(master.underPvp.underPvpStaminaTicket)) {
    const itemId=Number(key),at=master.underPvp.underPvpInformation[row.slot7].slot10+100,
      before=ticket(itemId,99),after=ticket(itemId,0);
    assert.equal(underPvpPassRows([before],master,seed.userId).get(itemId).signature,0xffffffff);
    assert.equal(underPvpPassChanges([before],[after],at,master,seed.userId)[0].recovery,99*row.slot8);
    assert.equal(underPvpPassCandidates(sp(3,at),99*row.slot8,at,master)[0].after.underPvpSP,3+99*row.slot8);
    assert.throws(()=>underPvpPassChanges([before],[{...after,amount:100}],at,master,seed.userId),/acquisition/);
    assert.throws(()=>underPvpPassRows([{...before,targetUnderPvpInfoId:0}],master,seed.userId),/reconciliation/);
  }
  assert.throws(()=>underPvpPassCandidates(sp(999999999,season.slot10+100),1,season.slot10+100,master),/capacity/);
  assert.equal(underPvpPassCandidates(sp(999999998,season.slot10+100),1,season.slot10+100,master)[0].after.underPvpSP,999999999);
  for (const changes of [{userId:2},{amount:-1},{amount:1.5},{signature:-1},{signature:0x100000000},
    {bookEntryState:4},{cumulativeAmount:9},{dateList:[]}])
    assert.throws(()=>underPvpPassRows([{...ticket(ticketId,2),...changes}],master,seed.userId),/reconciliation/);
  assert.throws(()=>underPvpPassRows([ticket(ticketId,2),ticket(ticketId,2)],master,seed.userId),/reconciliation/);
  assert.deepEqual(underPvpPassChanges([],[ticket(ticketId,0)],season.slot10+100,master,seed.userId),[],'Native zero-stock lazy row');

  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-under-pass-'));
  let app,port,database,sequence=0,now=season.slot10+100;
  const open=async()=>{ app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port; };
  const close=async()=>{ if(app){await app.close();app=null;} };
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const fresh=async(name,amount=5,state=sp(3,now))=>{ await close();database=path.join(directory,`${name}.sqlite`);await open();
    put(table,[ticket(ticketId,amount)]);const user=app.store.read('UserInfo').data;Object.assign(user[0].playerStatus,state);put('UserInfo',user); };
  const user=state=>{const rows=app.store.read('UserInfo').data;Object.assign(rows[0].playerStatus,state);return rows;};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const delta=(putItems={},deleteItems={})=>({badges:null,scripts:{},dataTokens:{},operations:[],checksums:{before:{},
    after:Object.fromEntries([...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name] ?? [])]))},
    deltas:[{signature:0,trigger:'UnderPvpStaminaTicketConsume',putItems,deleteItems}]});
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return reply;};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected=async(action,value,status=503,offline=true)=>{const before=snapshot(),reply=await send(action,value);
    assert.equal(reply.status,status,reply.body.toString());if(offline)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Rejected pass/save preserves every SQLite table');};
  const saves=()=>app.store.db.prepare('SELECT * FROM under_pvp_pass_use ORDER BY id').all();
  try {
    await fresh('combined');
    const pullValue={tables:[table,'UserInfo']},pulled=parse(await send('user_data/pull',pullValue));
    assert.equal(pulled.headers['content-type'],'application/x-msgpack');
    await rejected('user_data/push',delta({UserInfo:user(sp(4,now))}));
    await rejected('user_data/push',delta({[table]:[ticket(ticketId,6)],UserInfo:user(sp(4,now))}));
    await rejected('user_data/push',delta({[table]:[ticket(ticketId,4)],UserInfo:user(sp(5,now))}));
    const first=delta({[table]:[ticket(ticketId,3)],UserInfo:user(sp(5,now))});
    parse(await send('user_data/push',first));const firstId=sequence;
    assert.equal(saves().length,1);assert.equal(saves()[0].sp_saved,1);assert.equal(app.store.underPvpPendingPass(),null);
    assert.equal(app.store.read('UserInfo').data[0].playerStatus.underPvpSP,5);assert.equal(app.store.operations().length,0);
    const saved=snapshot();parse(await request(port,firstId,first,String(firstId),'user_data/push'));assert.equal(snapshot(),saved);
    await close();await open();app.store.db.exec('DELETE FROM reply_cache');
    parse(await send('user_data/push',first));assert.equal(saves().length,1,'New identity after eviction does not duplicate a saved debit/recovery');
    await rejected('user_data/push',delta({[table]:[ticket(ticketId,4)]}));
    await rejected('user_data/push',delta({}, {[table]:[{underPvpStaminaTicketId:ticketId}]}));
    const latest=app.store.read(table).data;latest[0].signature=7;latest[0].bookEntryState=3;
    parse(await send('user_data/push',delta({[table]:latest})));assert.equal(saves().length,1,'Metadata changes do not consume a pass');
    // Reuse a prior pull identity to prove stale binary resource reads cancel
    // instead of handing a spent pass or old SP back to native code.
    await fresh('stale-pull');parse(await send('user_data/pull',pullValue));const staleId=sequence;
    parse(await send('user_data/push',delta({[table]:[ticket(ticketId,4)],UserInfo:user(sp(4,now))})));
    assert.equal((await request(port,staleId,pullValue,String(staleId),'user_data/pull')).status,503);

    await fresh('split');parse(await send('user_data/push',delta({[table]:[ticket(ticketId,4)]})));
    const pending=saves()[0];assert.equal(pending.sp_saved,0);assert.equal(app.store.read('UserInfo').data[0].playerStatus.underPvpSP,3);
    assert.equal(app.store.underPvpPendingPass().id,pending.id,'Debit-only save is not attempt pre-credit');
    await rejected('user_data/push',delta({[table]:[ticket(ticketId,3)]}));
    await rejected('user_data/pull',pullValue);
    await close();await open();now=master.underPvp.underPvpInformation[69000000002].slot10+100;
    await rejected('user_data/push',delta({UserInfo:user(sp(3,now))}));
    const issuedAt=pending.saved_at;
    parse(await send('user_data/push',delta({UserInfo:user(sp(4,issuedAt))})));
    assert.equal(app.store.underPvpPendingPass(),null);assert.equal(saves()[0].sp_saved,1);
    await rejected('user_data/push',delta({[table]:[ticket(ticketId,3)],UserInfo:user(sp(5,issuedAt))}));
    now=issuedAt;parse(await send('user_data/push',delta({[table]:[ticket(ticketId,3)],UserInfo:user(sp(5,issuedAt))})));
    assert.equal(saves().length,2,'Next genuine use has a separate capture even at a frozen event time');

    now=season.slot10+100;await fresh('dirty-daily',2,sp(0,0));
    parse(await send('user_data/push',delta({[table]:[ticket(ticketId,1)],UserInfo:user(sp(4,now))})));
    assert.equal(app.store.read('UserInfo').data[0].playerStatus.underPvpSP,4,'Daily top-up plus pass can save together');
    assert.equal(saves()[0].sp_saved,1);
    await fresh('cap',2,sp(999999999,now));
    await rejected('user_data/push',delta({[table]:[ticket(ticketId,1)]}));
    await fresh('lazy',0);parse(await send('user_data/push',delta({[table]:[ticket(330000002,0)]})));
    assert.equal(saves().length,0,'Zero-stock row for a future season grants no attempt');
    await rejected('user_data/push',delta({[table]:[ticket(330000002,1)]}));

    for (const tableName of ['profile','under_pvp_pass_use','under_pvp_pass_claim','under_pvp_pass_stock_state','reply_cache']) {
      await fresh(`rollback-${tableName}`);
      const timing=tableName==='profile' ? "BEFORE UPDATE ON profile WHEN NEW.name='UserInfo'" : `BEFORE INSERT ON ${tableName}`;
      app.store.db.exec(`CREATE TRIGGER fail_pass ${timing} BEGIN SELECT RAISE(ABORT,'pass rollback'); END`);
      await rejected('user_data/push',delta({[table]:[ticket(ticketId,4)],UserInfo:user(sp(4,now))}),503,false);
      app.store.db.exec('DROP TRIGGER fail_pass');
      parse(await send('user_data/push',delta({[table]:[ticket(ticketId,4)],UserInfo:user(sp(4,now))})));
      assert.equal(saves().length,1);
    }
    await fresh('split-rollback');parse(await send('user_data/push',delta({[table]:[ticket(ticketId,4)]})));
    app.store.db.exec("CREATE TRIGGER fail_pass_observation BEFORE UPDATE ON under_pvp_pass_use BEGIN SELECT RAISE(ABORT,'pass observation rollback'); END");
    await rejected('user_data/push',delta({UserInfo:user(sp(4,now))}),503,false);
    app.store.db.exec('DROP TRIGGER fail_pass_observation');parse(await send('user_data/push',delta({UserInfo:user(sp(4,now))})));
    assert.equal(saves()[0].sp_saved,1);
    const row=saves()[0];app.store.db.prepare('UPDATE under_pvp_pass_use SET candidates=? WHERE id=?').run('[]',row.id);
    await rejected('user_data/push',delta({[table]:[ticket(ticketId,3)],UserInfo:user(sp(5,now))}));
    app.store.db.prepare('UPDATE under_pvp_pass_use SET candidates=? WHERE id=?').run(row.candidates,row.id);
    parse(await send('user_data/push',delta({[table]:[ticket(ticketId,3)],UserInfo:user(sp(5,now))})));
    console.log('Under Telskyura pass source/save checks passed; native earning/acceptance still required');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
