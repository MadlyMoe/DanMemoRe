'use strict';

// DEFERRED / NOT RUN. Temporary imported stock/presents are not native earning,
//eligible-menu, signature/order, callback/navigation or no-crash acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const {serialPvpTicketRows,serialPvpTicketRecovery}=require('./serial_pvp.cjs');
const master=require('../data/danmemore-master.json'),seed=require('./test_serial_pvp_lobby.cjs').unlockedSeed();
const table='UserSerialPvpSpTicketItem',id=81000000001,season=master.serialPvp.serialPvpInformation[id],ticketId=season.slot18;
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
const sp=(amount,at)=>({serialPvpSP:amount,serialPvpSPUpdatedAt:at});
const ticket=(amount,cumulativeAmount=5,key=ticketId)=>({userId:seed.userId,ticketId:key,amount,cumulativeAmount,
  reservedAmount:0,lastResetAt:0,bookEntryState:3,signature:0});
async function main() {
  assert.equal(serialPvpTicketRows([ticket(5)],master,seed.userId).get(ticketId).amount,5);
  for(const change of [{userId:0},{amount:-1},{amount:6},{ticketId:1},{reservedAmount:-1},{lastResetAt:'0'},
    {signature:0x100000000},{bookEntryState:4},{dateList:[]}])
    assert.throws(()=>serialPvpTicketRows([{...ticket(5),...change}],master,seed.userId),/reconciliation/);
  assert.throws(()=>serialPvpTicketRows([ticket(5),ticket(5)],master,seed.userId),/reconciliation/);
  for(const [key,info] of Object.entries(master.serialPvp.serialPvpInformation)) if(info.slot5<info.slot6) {
    const target=serialPvpTicketRecovery(sp(0,info.slot5),info.slot18,2,info.slot5,master);
    assert.equal(target.config.id,Number(key));assert.deepEqual(target.candidates,[{before:sp(0,info.slot5),after:sp(2,info.slot5)}]);
  }
  assert.throws(()=>serialPvpTicketRecovery(sp(0,season.slot5),280000002,1,season.slot5,master),/season/);
  assert.throws(()=>serialPvpTicketRecovery(sp(998,season.slot5),ticketId,2,season.slot5,master),/capacity/);
  assert.throws(()=>serialPvpTicketRecovery(sp(0,season.slot5),ticketId,1,season.slot6,master),/season/);
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-abyss-tickets-'));
  let database,app,port,sequence=0,now=season.slot5+10;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const user=value=>{const rows=structuredClone(app.store.read('UserInfo').data);Object.assign(rows[0].playerStatus,value);return rows;};
  const fresh=async(name,stock=5,attempts=sp(0,now))=>{await close();database=path.join(directory,name+'.sqlite');await open();
    put(table,[ticket(stock)]);put('UserInfo',user(attempts));app.store.changeHardCurrency(100);};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const delta=(puts={},operations=[],deletes={})=>({badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:
    Object.fromEntries([...new Set([...Object.keys(puts),...Object.keys(deletes)])].map(name=>[name,md5(puts[name] ?? [])]))},
    deltas:Object.keys(puts).length || Object.keys(deletes).length?[{signature:0,trigger:'SerialPvpSpRecovry',putItems:puts,deleteItems:deletes}]:[],
    operations:operations.map(row=>({id:row.id,verifier:row.token}))});
  const push=(puts,ops=[],deletes={})=>send('user_data/push',delta(puts,ops,deletes));
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected=async(action,value,status=503)=>{const before=snapshot(),reply=await send(action,value);
    assert.equal(reply.status,status,reply.body.toString());if(status===503) assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before);};
  const uses=()=>app.store.db.prepare('SELECT * FROM serial_pvp_ticket_use ORDER BY id').all();
  try {
    await fresh('sp-first');
    const wrongTrigger=delta({UserInfo:user(sp(1,now))});wrongTrigger.deltas[0].trigger='StaminaRecovery';
    await rejected('user_data/push',wrongTrigger);
    parse(await push({UserInfo:user(sp(1,now))}));
    assert.equal(uses().length,1);assert.equal(uses()[0].stock_saved,0);assert.equal(uses()[0].sp_saved,1);
    assert.equal(app.store.read(table).data[0].amount,5,'SP-first recovery cannot predebit native ticket stock');
    await rejected('serial_pvp/summary/get',{serialPvpId:id});
    await close();await open();assert.equal(app.store.serialPvp.pendingTicket().stock_saved,0);
    parse(await push({[table]:[ticket(4)]}));
    assert.equal(uses()[0].stock_saved,1);assert.equal(uses()[0].sp_saved,1);
    assert.equal(app.store.serialPvp.pendingTicket(),null);
    await rejected('user_data/push',delta({[table]:[ticket(5)]}));

    await fresh('sp-first-reserved');put(table,[{...ticket(5),reservedAmount:5}]);
    await rejected('user_data/push',delta({UserInfo:user(sp(1,now))}));

    await fresh('split');
    const actual=delta({[table]:[ticket(3)]}),first=await send('user_data/push',actual),identity=sequence;parse(first);
    assert.equal(uses().length,1);assert.equal(uses()[0].amount,2);assert.equal(uses()[0].stock_saved,1);assert.equal(uses()[0].sp_saved,0);
    assert.equal(app.store.read('UserInfo').data[0].playerStatus.serialPvpSP,0,'No native profile precredit');
    await rejected('currency/hard/consume',{consumeId:81071001});
    await rejected('serial_pvp/summary/get',{serialPvpId:id});
    await rejected('user_data/pull',{tables:['UserInfo']});
    await rejected('user_data/push',delta({[table]:[ticket(2)]}));
    await rejected('user_data/push',delta({[table]:[ticket(5)]}));
    await rejected('user_data/push',delta({},[],{[table]:[{ticketId}]}));
    const wrongPendingTrigger=delta({UserInfo:user(sp(2,now))});wrongPendingTrigger.deltas[0].trigger='StaminaRecovery';
    await rejected('user_data/push',wrongPendingTrigger);
    await rejected('user_data/push',delta({UserInfo:user(sp(3,now))}));
    await close();await open();assert.ok(app.store.serialPvp.pendingTicket());
    const late=uses()[0].issued_at;now=season.slot6;
    parse(await push({UserInfo:user(sp(2,late))}));assert.equal(app.store.serialPvp.pendingTicket(),null);
    assert.equal(uses()[0].sp_saved,1);assert.equal(app.store.read(table).data[0].cumulativeAmount,5);
    now=late;const settled=snapshot(),retry=await request(port,identity,actual,String(identity),'user_data/push');
    assert.ok([200,503].includes(retry.status));assert.equal(snapshot(),settled);assert.equal(uses().length,1);
    parse(await push({[table]:[ticket(2)],UserInfo:user(sp(3,late))}));assert.equal(uses().length,2);
    await rejected('user_data/push',delta({[table]:[ticket(3)],UserInfo:user(sp(2,late))}));

    await fresh('timer',5,sp(0,now));now+=28800;
    parse(await push({[table]:[ticket(4)],UserInfo:user(sp(2,now))}));assert.equal(uses()[0].sp_saved,1);
    now=season.slot5+10;await fresh('initialize',5,sp(0,0));
    parse(await push({[table]:[ticket(4)],UserInfo:user(sp(6,season.slot3))}));assert.equal(uses()[0].sp_saved,1);
    await fresh('cap',5,sp(998,now));await rejected('user_data/push',delta({[table]:[ticket(3)]}));
    parse(await push({[table]:[ticket(4)],UserInfo:user(sp(999,now))}));
    await fresh('wrong-season');put(table,[ticket(5),ticket(1,1,280000002)]);
    await rejected('user_data/push',delta({[table]:[ticket(5),ticket(0,1,280000002)]}));
    await fresh('iris');const iris=parse(await send('currency/hard/consume',{consumeId:81071001})).operation;
    await rejected('user_data/push',delta({[table]:[ticket(4)],UserInfo:user(sp(1,now))}));
    parse(await push({UserInfo:user(sp(1,now))},[iris]));

    //Existing issued present acquisition, then spending. No fabricated grant route.
    await fresh('present');const gift={userId:seed.userId,id:1,itemId:ticketId,amount:2,title:'TEMP original-ticket fixture',message:'',
      senderType:1,senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,pcHeroSublimateCount:0,
      state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0};put('UserGift',[gift]);
    await rejected('user_data/push',delta({[table]:[ticket(6,6)]}));
    const grant=parse(await send('gift/receive',{userId:seed.userId,giftIds:[1]})).operations[0];
    assert.equal(grant.type,2000);assert.equal(app.store.read(table).data[0].amount,5);
    parse(await push({[table]:[ticket(7,7)],UserGift:[{...gift,state:1}]},[grant]));
    parse(await push({[table]:[ticket(6,7)],UserInfo:user(sp(1,now))}));
    await rejected('user_data/push',delta({[table]:[ticket(7,7)]}));
    await rejected('user_data/push',delta({[table]:[ticket(6,6)]}));

    for(const name of ['profile','serial_pvp_ticket_use','serial_pvp_ticket_stock','reply_cache']) {
      await fresh('rollback-'+name);const event=name==='profile'?'UPDATE':'INSERT';
      app.store.db.exec(`CREATE TEMP TRIGGER fail_ticket BEFORE ${event} ON ${name} BEGIN SELECT RAISE(ABORT,'injected'); END`);
      await rejected('user_data/push',delta({[table]:[ticket(4)],UserInfo:user(sp(1,now))}));
      app.store.db.exec('DROP TRIGGER fail_ticket');parse(await push({[table]:[ticket(4)],UserInfo:user(sp(1,now))}));
    }
    await fresh('observation');parse(await push({[table]:[ticket(4)]}));
    app.store.db.exec("CREATE TEMP TRIGGER fail_ticket BEFORE UPDATE ON serial_pvp_ticket_use BEGIN SELECT RAISE(ABORT,'injected'); END");
    await rejected('user_data/push',delta({UserInfo:user(sp(1,now))}));app.store.db.exec('DROP TRIGGER fail_ticket');
    app.store.db.prepare('UPDATE serial_pvp_ticket_use SET candidates_json=?').run('[]');
    await rejected('user_data/push',delta({UserInfo:user(sp(1,now))}));
    await fresh('missing-floor');parse(await push({[table]:[ticket(4)],UserInfo:user(sp(1,now))}));
    app.store.db.prepare('DELETE FROM serial_pvp_ticket_stock').run();await rejected('user_data/pull',{tables:[table]});
    await fresh('settled-corruption');parse(await push({[table]:[ticket(4)],UserInfo:user(sp(1,now))}));
    app.store.db.prepare('UPDATE serial_pvp_ticket_use SET amount=2').run();await rejected('user_data/pull',{tables:[table]});
  } finally {await close();}
  console.log('Abyss ticket source fixtures passed; native acceptance remains unproved');
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
