'use strict';
// DEFERRED / NOT RUN. Synthetic flat Presents/native saves; no raid earning, expiry or emulator acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,unionRaidTicketRecovery,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs'),
  {request}=require('./test_danmemore_server.cjs'),seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-union-ticket-presents-'));
  let app,database,port,sequence=0,now=1661443200;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;},
    close=async()=>{if(app)await app.close();app=null;},
    fresh=async name=>{await close();database=path.join(directory,`${name}.sqlite`);await open();},
    send=(route,body,id=++sequence)=>request(port,id,body,String(id),route),
    parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);},
    put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name),
    snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
      .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()])),
    reject=async(route,body,status=503,semantic=true)=>{const held=snapshot(),reply=await send(route,body);
      assert.equal(reply.status,status,reply.body.toString());assert.equal(snapshot(),held);
      if(status===503 && semantic) assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);},
    pushBody=(putItems={},operations=[],trigger='GiftReceive')=>({badges:null,scripts:{},dataTokens:{},checksums:{before:{},
      after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
      deltas:Object.keys(putItems).length?[{signature:0,trigger,putItems,deleteItems:{}}]:[],
      operations:operations.map(operation=>({id:operation.id,verifier:operation.token}))}),
    push=(...args)=>send('user_data/push',pushBody(...args)),
    initial=ticketId=>({userId:seed.userId,ticketId,amount:0,reservedAmount:0,bookEntryState:1,signature:0,cumulativeAmount:0,lastResetAt:0}),
    gift=(id,itemId,amount)=>({userId:seed.userId,id,itemId,amount,title:'Deferred original raid-ticket Present',message:'',
      senderType:1,senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,
      pcHeroSublimateCount:0,state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0}),
    receive=gifts=>send('gift/receive',{userId:seed.userId,giftIds:gifts.map(row=>row.id)}),
    flags=gifts=>gifts.map(row=>({...row,state:1})),
    target=id=>app.store.unionRaidTicketPresentCheckpoint(id).after,
    cold=async(operation,remaining)=>{const reply=parse(await send('user_data/confirm'));
      assert.deepEqual(reply.operations.find(row=>row.id===operation.id)?.parameters.receivedItems,remaining);
      assert.deepEqual(app.store.operations(),[operation]);assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_done').get().n,0);};
  try {
    for(const [id,table] of [[411000001,'UserUnionRaidBossSpTicketItem'],[412000001,'UserUnionRaidNormalSpTicketItem']]) {
      const initialized=initial(id),owned={...initialized,amount:100,reservedAmount:7,cumulativeAmount:120,signature:0xffffffff,lastResetAt:1661439600};
      for(const [name,before] of [['absent',null],['owned',owned],['lazy',{...owned,userId:0,bookEntryState:3}],
        ['cross-cap',{...owned,amount:999999998,cumulativeAmount:999999998}],
        ['full-cap',{...owned,amount:999999999,cumulativeAmount:999999999}]]) {
        await fresh(`${id}-${name}`);const gifts=[gift(1,id,2),gift(2,id,3)],baseline=before ?? initialized;
        put(table,before?[before]:[]);put('UserGift',gifts);
        for(const name of ['operation_queue','gift_claim','gift_item_claim','union_raid_ticket_present',
          'union_raid_ticket_present_checkpoint','reply_cache']) {
          app.store.db.exec(`CREATE TEMP TRIGGER fail_union_ticket_award BEFORE INSERT ON ${name}
            BEGIN SELECT RAISE(ABORT,'deferred ticket award issue rollback'); END`);
          await reject('gift/receive',{userId:seed.userId,giftIds:[1,2]},503,false);app.store.db.exec('DROP TRIGGER fail_union_ticket_award');
        }
        const firstReply=await receive(gifts),identity=sequence,result=parse(firstReply),operation=result.operation,after=target(id);
        assert.equal(operation.type,2000);assert.deepEqual(result.receivedItems,[{itemId:id,amount:5}]);
        assert.deepEqual(after,{...baseline,amount:Math.min(999999999,baseline.amount+5),signature:operation.signature,
          cumulativeAmount:Math.min(999999999,baseline.cumulativeAmount+5)});
        assert.notEqual(after.signature,baseline.signature);assert.deepEqual(app.store.read(table).data,before?[before]:[]);
        assert.deepEqual((await send('gift/receive',{userId:seed.userId,giftIds:[1,2]},identity)).body,firstReply.body);
        await reject('user_data/push',pushBody({},[operation]),400);
        if(!before) {parse(await push({[table]:[initialized]}));assert.equal(app.store.unionRaidTicketPresentCheckpoint(id).effect_saved,0);}
        for(const patch of [{amount:after.amount-1},{signature:baseline.signature},{cumulativeAmount:after.cumulativeAmount-1},
          {bookEntryState:after.bookEntryState===3?1:3},{reservedAmount:after.reservedAmount+1},{lastResetAt:now+1}])
          await reject('user_data/push',pushBody({[table]:[{...after,...patch}]}),400);
        if(name==='owned') {parse(await push({UserGift:flags(gifts)}));await close();await open();await cold(operation,[{itemId:id,amount:5}]);}
        for(const [name,event] of [['profile','UPDATE'],['union_raid_ticket_present','UPDATE'],['union_raid_ticket_stock','INSERT'],
          ['gift_item_claim','UPDATE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TEMP TRIGGER fail_union_ticket_award_save BEFORE ${event} ON ${name}
            BEGIN SELECT RAISE(ABORT,'deferred ticket acquisition save rollback'); END`);
          await reject('user_data/push',pushBody({[table]:[after]}),503,false);app.store.db.exec('DROP TRIGGER fail_union_ticket_award_save');
        }
        parse(await push({[table]:[after]}));assert.equal(app.store.unionRaidTicketPresentCheckpoint(id).effect_saved,1);
        const floor=app.store.db.prepare('SELECT * FROM union_raid_ticket_stock WHERE ticket_id=?').get(id);
        assert.equal(floor.use_id,0);assert.deepEqual(JSON.parse(floor.stock_json),after);
        await close();await open();await cold(operation,[]);
        const receipt=app.store.db.prepare('SELECT * FROM union_raid_ticket_present').get(),
          pointer=app.store.db.prepare('SELECT * FROM union_raid_ticket_present_checkpoint').get();
        for(const wire of ['bad JSON','null','{}',JSON.stringify({...operation,token:'bad'}),
          JSON.stringify({...operation,parameters:{...operation.parameters,receivedItems:{}}})]) {
          app.store.db.prepare('UPDATE union_raid_ticket_present SET operation_json=?').run(wire);
          await reject('user_data/confirm');app.store.db.prepare('UPDATE union_raid_ticket_present SET operation_json=?').run(receipt.operation_json);
        }
        app.store.db.exec('DELETE FROM union_raid_ticket_present_checkpoint');await reject('user_data/confirm');
        app.store.db.prepare('INSERT INTO union_raid_ticket_present_checkpoint VALUES(?,?)').run(pointer.ticket_id,pointer.operation_id);
        await reject('user_data/push',pushBody({[table]:[baseline]}),400);
        parse(await push({UserGift:flags(gifts)}));
        app.store.db.exec(`CREATE TEMP TRIGGER fail_union_ticket_award_ack BEFORE INSERT ON operation_done
          BEGIN SELECT RAISE(ABORT,'deferred ticket ACK rollback'); END`);
        await reject('user_data/push',pushBody({},[operation]),503,false);app.store.db.exec('DROP TRIGGER fail_union_ticket_award_ack');
        parse(await push({},[operation]));assert.deepEqual(app.store.operations(),[]);
        app.store.db.exec('DELETE FROM reply_cache');await close();await open();assert.deepEqual(app.store.read(table).data,[after]);
        await reject('gift/receive',{userId:seed.userId,giftIds:[1,2]});
      }
      await fresh(`${id}-overflow`);put(table,[owned]);put('UserGift',[gift(1,id,0x7fffffff)]);
      await reject('gift/receive',{userId:seed.userId,giftIds:[1]});
    }
    // Both families share one command, but their native saves/recovery omissions remain independent.
    await fresh('mixed-families-and-use-lineage');const high='UserUnionRaidBossSpTicketItem',low='UserUnionRaidNormalSpTicketItem';
    let gifts=[gift(1,411000001,5),gift(2,412000001,5)];put('UserGift',gifts);
    const operation=parse(await receive(gifts)).operation,highAfter=target(411000001),lowAfter=target(412000001);
    parse(await push({[high]:[highAfter]}));await close();await open();await cold(operation,[{itemId:412000001,amount:5}]);
    parse(await push({[low]:[lowAfter],UserGift:flags(gifts)},[operation]));
    const users=structuredClone(app.store.read('UserInfo').data),battle=app.store.read('UserAdventureState').data;
    put('UserAdventureState',[{...battle[0],stageId:0}]);
    Object.assign(users[0].playerStatus,unionRaidTicketRecovery(master,users[0].playerStatus,411000001,1,now).candidates[0]);
    const spent={...highAfter,amount:4};parse(await push({UserInfo:users,[high]:[spent]},[],'ItemUsed'));
    const use=app.store.db.prepare('SELECT * FROM union_raid_ticket_use').get();
    gifts=[...flags(gifts),gift(3,411000001,3)];put('UserGift',gifts);
    const second=parse(await receive([gifts[2]])).operation,acquired=target(411000001),capture=app.store.unionRaidTicketPresentCheckpoint(411000001);
    assert.equal(capture.use_before_id,use.id);assert.equal(capture.present_before_id,operation.id);
    assert.deepEqual(capture.before,spent);assert.equal(acquired.amount,7);assert.equal(acquired.cumulativeAmount,8);
    app.store.db.prepare('UPDATE union_raid_ticket_present SET operation_json=? WHERE operation_id=? AND ticket_id=?')
      .run(JSON.stringify(operation),second.id,411000001);
    await reject('user_data/confirm');
    app.store.db.prepare('UPDATE union_raid_ticket_present SET operation_json=? WHERE operation_id=? AND ticket_id=?')
      .run(capture.operation_json,second.id,411000001);
    parse(await push({[high]:[acquired],UserGift:flags(gifts)},[second]));
    const recovered=structuredClone(users);Object.assign(recovered[0].playerStatus,
      unionRaidTicketRecovery(master,users[0].playerStatus,411000001,1,now).candidates[0]);
    parse(await push({UserInfo:recovered,[high]:[{...acquired,amount:6}]},[],'ItemUsed'));
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_ticket_use').get().n,2);
    await close();await open();assert.equal(app.store.read(high).data[0].amount,6);assert.deepEqual(app.store.read(low).data,[lowAfter]);
    await reject('user_data/push',pushBody({[high]:[acquired]}));await reject('user_data/push',pushBody({UserInfo:users}));
    for(const order of ['ticket-first','stamina-first']) {
      await fresh(order);const spId=master.currencies['currency.stamina'],info=structuredClone(seed.data.UserInfo);
      info[0].playerStatus.baseSP=7;put('UserInfo',info);put(high,[]);
      const gifts=[gift(1,411000001,5),gift(2,spId,13)];put('UserGift',gifts);
      const operation=parse(await receive(gifts)).operation,after=target(411000001),spSaved=structuredClone(info);
      spSaved[0].playerStatus.baseSP=20;
      parse(await push(order==='ticket-first'?{[high]:[after]}:{UserInfo:spSaved}));await close();await open();
      await cold(operation,order==='ticket-first'?[{itemId:spId,amount:13}]:[{itemId:411000001,amount:5}]);
      parse(await push(order==='ticket-first'?{UserInfo:spSaved}:{[high]:[after]}));await cold(operation,[]);
      parse(await push({UserGift:flags(gifts)},[operation]));assert.deepEqual(app.store.operations(),[]);
    }
  } finally {await close();assert.ok(path.basename(directory).startsWith('danmemore-union-ticket-presents-'));
    fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
