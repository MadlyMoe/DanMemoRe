'use strict';
// DEFERRED / NOT RUN. Synthetic split saves; listener restart is not full client-reload recovery or native acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,unionRaidTicketRecovery,unionRaidAttemptState,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs'),
  {request}=require('./test_danmemore_server.cjs'),seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-union-ticket-split-')),
    baseline={unionRaidBossSP:1,unionRaidBossSPUpdatedAt:1661443199,unionRaidNormalSP:4,unionRaidNormalSPUpdatedAt:1661443199};
  let app,database,port,sequence=0,now=1661443200;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;},
    close=async()=>{if(app)await app.close();app=null;},
    send=(route,body)=>request(port,++sequence,body,String(sequence),route),
    parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);},
    put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name),
    snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
      .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()])),
    body=putItems=>({badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
      Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
      deltas:[{signature:0,trigger:'ItemUsed',putItems,deleteItems:{}}],operations:[]}),
    push=rows=>send('user_data/push',body(rows)),
    reject=async(route,body,semantic=true)=>{const held=snapshot(),reply=await send(route,body);
      assert.equal(reply.status,503,reply.body.toString());assert.equal(snapshot(),held);
      if(semantic)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);};
  try {
    for(const [id,table,stock] of [[411000001,'UserUnionRaidBossSpTicketItem','unionRaidBossSP'],
      [412000001,'UserUnionRaidNormalSpTicketItem','unionRaidNormalSP']]) for(const order of ['stock-first','attempts-first']) {
      await close();now=1661443200;database=path.join(directory,`${id}-${order}.sqlite`);await open();
      const users=structuredClone(app.store.read('UserInfo').data),battle=app.store.read('UserAdventureState').data,
        ticket={userId:seed.userId,ticketId:id,amount:8,reservedAmount:0,bookEntryState:1,signature:0xffffffff,
          cumulativeAmount:11,lastResetAt:1661439600},after={...ticket,amount:6};
      Object.assign(users[0].playerStatus,baseline);put('UserInfo',users);put('UserAdventureState',[{...battle[0],stageId:0}]);put(table,[ticket]);
      const gifts=[{userId:seed.userId,id:1,itemId:id,amount:1,title:'Deferred split acquisition conflict',message:'',
        senderType:1,senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,
        pcHeroSublimateCount:0,state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0}];put('UserGift',gifts);
      const credited=structuredClone(users),queue=app.store.operations(),wallet=app.store.hardCurrency();
      Object.assign(credited[0].playerStatus,unionRaidTicketRecovery(master,baseline,id,2,now).candidates[0]);
      const first=order==='stock-first'?{[table]:[after]}:{UserInfo:credited},
        second=order==='stock-first'?{UserInfo:credited}:{[table]:[after]};
      for(const [name,event] of [['profile','UPDATE'],['union_raid_ticket_use','INSERT'],['union_raid_ticket_stock','INSERT'],
        ['union_raid_ticket_attempt_checkpoint','INSERT'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TEMP TRIGGER fail_union_split BEFORE ${event} ON ${name}
          BEGIN SELECT RAISE(ABORT,'deferred first-half rollback'); END`);
        await reject('user_data/push',body(first),false);app.store.db.exec('DROP TRIGGER fail_union_split');
      }
      parse(await push(first));const pending=app.store.unionRaidTicketPendingUse();
      assert.equal(pending.row.stock_saved,Number(order==='stock-first'));assert.equal(pending.row.sp_saved,Number(order==='attempts-first'));
      assert.deepEqual(app.store.read(table).data,[order==='stock-first'?after:ticket]);
      assert.deepEqual(app.store.read('UserInfo').data,order==='attempts-first'?credited:users);
      assert.deepEqual(pending.status,order==='attempts-first'?unionRaidTicketRecovery(master,baseline,id,2,now).candidates[0]:null);
      parse(await push(first));assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_use').get().n,1);
      await reject('gift/receive',{userId:seed.userId,giftIds:[1]});
      await close();await open();assert.equal(app.store.unionRaidTicketPendingUse().row.id,pending.row.id);
      if(order==='attempts-first') {
        now+=3600;const advanced=structuredClone(credited);
        Object.assign(advanced[0].playerStatus,unionRaidAttemptState(master,credited[0].playerStatus,now,'normal'));
        parse(await push({UserInfo:advanced}));assert.equal(app.store.unionRaidTicketPendingUse().row.status_json,pending.row.status_json);
        Object.assign(credited[0].playerStatus,advanced[0].playerStatus);
        await close();await open();assert.deepEqual(app.store.read('UserInfo').data,credited);
      }
      const wrong=structuredClone(credited);wrong[0].playerStatus[stock]++;
      await reject('user_data/push',body(order==='stock-first'?{UserInfo:wrong}:{[table]:[{...after,amount:5}]}));
      for(const [name,event] of [['profile','UPDATE'],['union_raid_ticket_use','UPDATE'],['union_raid_ticket_stock','UPDATE'],
        ['union_raid_ticket_attempt_checkpoint','UPDATE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TEMP TRIGGER fail_union_split_complete BEFORE ${event} ON ${name}
          BEGIN SELECT RAISE(ABORT,'deferred matching-half rollback'); END`);
        await reject('user_data/push',body(second),false);app.store.db.exec('DROP TRIGGER fail_union_split_complete');
      }
      parse(await push(second));assert.equal(app.store.unionRaidTicketPendingUse(),null);
      const settled=app.store.db.prepare('SELECT * FROM union_raid_ticket_use').get();assert.equal(settled.id,pending.row.id);
      if(order==='attempts-first') assert.equal(settled.status_json,pending.row.status_json,'Later stock observation must not rewrite earlier SP evidence');
      assert.equal(settled.stock_saved,1);assert.equal(settled.sp_saved,1);assert.deepEqual(app.store.read(table).data,[after]);
      assert.deepEqual(app.store.read('UserInfo').data,credited);assert.deepEqual(app.store.operations(),queue);assert.equal(app.store.hardCurrency(),wallet);
      parse(await push(second));assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_use').get().n,1);
      await close();await open();assert.deepEqual(app.store.read('UserInfo').data,credited);assert.deepEqual(app.store.read(table).data,[after]);
      await reject('user_data/push',body({[table]:[ticket]}));await reject('user_data/push',body({UserInfo:users}));
      assert.throws(()=>app.store.unionRaidTicketUseReceipt({...settled,stock_saved:0,sp_saved:0}),/attempt capture/);
      assert.throws(()=>app.store.unionRaidTicketUseReceipt({...settled,sp_saved:0}),/attempt capture/);
    }
    // A constructor/hourly getter in ItemUsed is not evidence of a ticket restoration.
    await close();database=path.join(directory,'getter-only.sqlite');await open();
    const before=structuredClone(app.store.read('UserInfo').data);Object.assign(before[0].playerStatus,baseline);
    put('UserInfo',before);now+=3600;const getter=structuredClone(before);
    Object.assign(getter[0].playerStatus,unionRaidAttemptState(master,baseline,now,'normal'));
    parse(await push({UserInfo:getter}));assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_use').get().n,0);
  } finally {await close();assert.ok(path.basename(directory).startsWith('danmemore-union-ticket-split-'));
    fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
