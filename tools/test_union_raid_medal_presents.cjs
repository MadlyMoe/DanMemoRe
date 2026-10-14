'use strict';
// DEFERRED / NOT RUN. Synthetic saved Presents/native rows; no raid earning, UI or signing acceptance is implied.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs'),{request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-union-medal-presents-')),
    table='UserUnionRaidMedal',medalId=410000001,
    initialized={userId:seed.userId,medalId,amount:0,reservedAmount:0,bookEntryState:1,signature:0,cumulativeAmount:0},
    owned={...initialized,amount:100,reservedAmount:7,cumulativeAmount:120,signature:0xffffffff};
  let app,database,port,sequence=0,now=1790834274;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;},
    close=async()=>{if(app)await app.close();app=null;},
    fresh=async name=>{await close();database=path.join(directory,`${name}.sqlite`);await open();},
    send=(route,body,id=++sequence)=>request(port,id,body,String(id),route),
    parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);},
    put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name),
    snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
      .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()])),
    reject=async(route,body,status=503,id=++sequence,semantic=true)=>{const before=snapshot(),reply=await send(route,body,id);
      assert.equal(reply.status,status,reply.body.toString());assert.equal(snapshot(),before);
      if(status===503 && semantic) assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);},
    pushBody=(putItems={},operations=[],deleteItems={})=>({badges:null,scripts:{},dataTokens:{},checksums:{before:{},
      after:Object.fromEntries([...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name]??[])]))},
      deltas:Object.keys(putItems).length || Object.keys(deleteItems).length ?
        [{signature:0,trigger:'GiftReceive',putItems,deleteItems}] : [],
      operations:operations.map(operation=>({id:operation.id,verifier:operation.token}))}),
    push=(...args)=>send('user_data/push',pushBody(...args)),
    gift=(id,itemId,amount)=>({userId:seed.userId,id,itemId,amount,title:'Deferred Alliance Medal Present',message:'',
      senderType:1,senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,
      pcLimitBreakCount:0,pcHeroSublimateCount:0,state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0}),
    receiveBody=gifts=>({userId:seed.userId,giftIds:gifts.map(row=>row.id)}),
    received=gifts=>gifts.map(row=>({...row,state:1})),
    target=operation=>JSON.parse(app.store.db.prepare('SELECT after_json FROM union_raid_medal_present WHERE operation_id=?').get(operation.id).after_json),
    cold=async(operation,items)=>{const before=app.store.read(table),flags=app.store.read('UserGift'),reply=parse(await send('user_data/confirm'));
      assert.deepEqual(reply.operations.find(row=>row.id===operation.id)?.parameters.receivedItems,items);
      assert.deepEqual(app.store.operations(),[operation]);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_medal_present').get().n,1);
      assert.equal(app.store.read(table).token,md5(app.store.read(table).data));
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_done WHERE id=?').get(operation.id).n,0);
      // Confirm may update its own sequence/reply cache, never the native inventory or command.
      assert.deepEqual(app.store.read(table),before);assert.deepEqual(app.store.read('UserGift'),flags);return reply;};
  try {
    for(const [name,before] of [['absent',null],['owned',owned],['lazy-owner',{...owned,userId:0,bookEntryState:-128}],
      ['cross-cap',{...owned,amount:999999998,cumulativeAmount:999999998,bookEntryState:127}],
      ['full-cap',{...owned,amount:999999999,cumulativeAmount:999999999}]]) {
      now=1790834274;await fresh(name);
      const gifts=[gift(1,medalId,2),gift(2,medalId,3)],body=receiveBody(gifts),baseline=before??initialized;
      put(table,before?[before]:[]);put('UserGift',gifts);
      for(const tableName of ['operation_queue','gift_item_claim','gift_claim','union_raid_medal_present',
        'union_raid_medal_present_checkpoint','reply_cache']) {
        app.store.db.exec(`CREATE TEMP TRIGGER fail_medal_issue BEFORE INSERT ON ${tableName}
          BEGIN SELECT RAISE(ABORT,'deferred medal issue rollback'); END`);
        await reject('gift/receive',body,503,++sequence,false);app.store.db.exec('DROP TRIGGER fail_medal_issue');
      }
      const reply=await send('gift/receive',body),identity=sequence,result=parse(reply),operation=result.operations[0],after=target(operation);
      assert.equal(operation.type,2000);assert.deepEqual(result.operation,operation);
      assert.deepEqual(result.receivedItems,[{itemId:medalId,amount:5}]);assert.deepEqual(result.issueUnionRaidMedal,[]);
      assert.deepEqual(after,{...baseline,amount:Math.min(999999999,baseline.amount+5),signature:operation.signature,
        cumulativeAmount:Math.min(999999999,baseline.cumulativeAmount+5)});
      assert.notEqual(operation.signature,baseline.signature);
      assert.deepEqual(app.store.read(table).data,before?[before]:[],'No inventory precredit, including native lazy initialization');
      assert.equal(app.store.db.prepare('SELECT effect_saved FROM union_raid_medal_present').get().effect_saved,0);
      assert.deepEqual((await send('gift/receive',body,identity)).body,reply.body);
      assert.deepEqual(parse(await send('gift/receive',body)).operations,[operation]);
      await reject('gift/receive',{...body,giftIds:[1]},503);
      await reject('gift/receive',{...body,giftIds:[2,1],extra:true},400,identity);
      await reject('user_data/push',pushBody({},[operation]),400);
      for(const changes of [{signature:baseline.signature},{amount:after.amount-1},{cumulativeAmount:after.cumulativeAmount-1},
        {reservedAmount:baseline.reservedAmount+1},{bookEntryState:baseline.bookEntryState===3?1:3},
        {userId:baseline.userId===0?seed.userId:0},{medalId:1}])
        await reject('user_data/push',pushBody({[table]:[{...after,...changes}]}),400);
      if(!before) {
        parse(await push({[table]:[initialized]}));assert.deepEqual(app.store.read(table).data,[initialized]);
        assert.equal(app.store.db.prepare('SELECT effect_saved FROM union_raid_medal_present').get().effect_saved,0);
      }
      for(const [tableName,event] of [['profile','UPDATE'],['union_raid_medal_present','UPDATE'],['gift_item_claim','UPDATE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TEMP TRIGGER fail_medal_save BEFORE ${event} ON ${tableName}
          BEGIN SELECT RAISE(ABORT,'deferred medal save rollback'); END`);
        await reject('user_data/push',pushBody({[table]:[after]}),503,++sequence,false);app.store.db.exec('DROP TRIGGER fail_medal_save');
      }
      if(name==='owned') {
        parse(await push({UserGift:received(gifts)}));await close();await open();now+=200;
        await reject('gift/receive',body);await cold(operation,[{itemId:medalId,amount:5}]);
      }
      parse(await push({[table]:[after]}));
      assert.equal(app.store.db.prepare('SELECT effect_saved FROM union_raid_medal_present').get().effect_saved,1);
      const stock=JSON.parse(app.store.db.prepare('SELECT stock_state FROM gift_item_claim').get().stock_state);
      assert.equal(stock.observed,true);assert.equal(stock.effect,true);assert.equal(stock.amountAdded,after.amount-baseline.amount);
      await reject('gift/receive',body);await reject('gift/receive',body,503,identity);
      await close();await open();await cold(operation,[]);
      const capture=app.store.db.prepare('SELECT * FROM union_raid_medal_present').get(),floor=app.store.db.prepare('SELECT * FROM union_raid_medal_present_checkpoint').get();
      for(const wire of ['not JSON',JSON.stringify({...operation,token:'corrupt'}),JSON.stringify({...operation,parameters:{...operation.parameters,receivedItems:[]}})]) {
        app.store.db.prepare('UPDATE union_raid_medal_present SET operation_json=?').run(wire);
        await reject('user_data/confirm');app.store.db.prepare('UPDATE union_raid_medal_present SET operation_json=?').run(capture.operation_json);
      }
      app.store.db.prepare('UPDATE union_raid_medal_present SET after_json=?').run(JSON.stringify({...after,amount:after.amount-1}));
      await reject('user_data/confirm');app.store.db.prepare('UPDATE union_raid_medal_present SET after_json=?').run(capture.after_json);
      app.store.db.exec('DELETE FROM union_raid_medal_present_checkpoint');await reject('user_data/confirm');
      app.store.db.prepare('INSERT INTO union_raid_medal_present_checkpoint VALUES(?,?)').run(floor.medal_id,floor.operation_id);
      if(name!=='owned') await reject('user_data/push',pushBody({},[operation]),400);
      parse(await push({UserGift:received(gifts)}));
      app.store.db.exec(`CREATE TEMP TRIGGER fail_medal_ack BEFORE INSERT ON operation_done
        BEGIN SELECT RAISE(ABORT,'deferred medal ACK rollback'); END`);
      await reject('user_data/push',pushBody({},[operation]),503,++sequence,false);app.store.db.exec('DROP TRIGGER fail_medal_ack');
      parse(await push({},[operation]));assert.deepEqual(app.store.operations(),[]);
      await reject('user_data/push',pushBody({[table]:[baseline]}),400);
      await reject('user_data/push',pushBody({},[],{[table]:[{medalId}]}),400);
      app.store.db.exec('DELETE FROM reply_cache');app.store.beginSession();await close();await open();
      await reject('gift/receive',body);await reject('gift/receive',body,503,identity);
      assert.deepEqual(app.store.read(table).data,[after]);
      const held=snapshot(),bad=structuredClone(master);
      bad.sources.unionRaidMedal={sha256:'0'.repeat(64),rows:1};
      assert.throws(()=>createServer({database,seed,master:bad,log:()=>{}}),/Alliance Medal item catalog/);
      assert.equal(snapshot(),held);
    }

    // Signed native addition overflow is refused before any queue, claim, save or reply mutation.
    await fresh('overflow');put(table,[owned]);const overflow=[gift(1,medalId,0x7fffffff)];put('UserGift',overflow);
    await reject('gift/receive',receiveBody(overflow));

    // A saved reward is not spendable before its Present flags/ACK; spending keeps lifetime/signature/book/reserved unchanged.
    await fresh('earning-and-skill-lineage');now=1790834274;put(table,[]);
    const currency=[{userId:seed.userId,currencyId:master.currencies['currency.valis'],amount:200000,cumulativeAmount:200000,reservedAmount:0,signature:0}];
    put('UserCurrency',currency);
    const created=parse(await send('familia/create',{name:'Medal lineage',description:'Deferred reward to investment fixture',
      godId:20000001,style:21000001,subStyle:0,activeTime:22000001,subActiveTime:0,requireApproval:false})),charge=created.operations[0];
    parse(await push({UserCurrency:[{...currency[0],amount:100000}]},[charge]));
    const statusBody={unionRaidInfoId:413000001,debug:false},logBody={unionRaidInfoId:413000001},
      entryBody={...statusBody,unionRaidStageIndex:0,unionRaidStageId:415000001,defeatCount:0},
      emptyStatus=parse(await send('union_raid/status/get',statusBody)),emptyStatusId=sequence;
    assert.equal(emptyStatus.medalAmount,0);
    const growth={unionRaidInfoId:413000001,unionRaidSkillGroupId:423000001,medalId,medalAmount:100};
    let gifts=[gift(1,medalId,1000)];put('UserGift',gifts);
    const first=parse(await send('gift/receive',receiveBody(gifts))).operation,firstAfter=target(first);
    await reject('union_raid/status/get',statusBody);
    await reject('union_raid/skill/growth',growth);parse(await push({[table]:[firstAfter]}));
    await reject('union_raid/status/get',statusBody);
    await reject('union_raid/skill/growth',growth);parse(await push({UserGift:received(gifts)},[first]));
    assert.deepEqual(parse(await send('union_raid/status/get',statusBody)),{...emptyStatus,medalAmount:1000});
    await reject('union_raid/status/get',statusBody,503,emptyStatusId);
    now+=10;const invested=parse(await send('union_raid/skill/growth',growth)),investedId=sequence;
    assert.equal(invested.userMedalAmount,900);
    await reject('union_raid/status/get',statusBody);
    const debit={...firstAfter,amount:900},parent=app.store.db.prepare('SELECT id FROM union_raid_skill_growth').get().id;
    gifts=[...received(gifts),gift(2,medalId,500)];put('UserGift',gifts);
    await reject('gift/receive',receiveBody([gifts[1]]));parse(await push({[table]:[debit]}));
    assert.deepEqual(parse(await send('union_raid/skill/growth',growth,investedId)),
      {code:0,userMedalAmount:900,unionRaidSkill:{medalAmount:100}});
    const second=parse(await send('gift/receive',receiveBody([gifts[1]]))).operation,secondAfter=target(second),
      receipt=app.store.db.prepare('SELECT * FROM union_raid_medal_present WHERE operation_id=?').get(second.id);
    await reject('union_raid/skill/growth',growth,503,investedId);
    assert.equal(receipt.growth_before_id,parent);assert.deepEqual(JSON.parse(receipt.before_json),debit);
    assert.equal(secondAfter.amount,1400);assert.equal(secondAfter.cumulativeAmount,1500);
    assert.equal(secondAfter.bookEntryState,1);assert.equal(secondAfter.reservedAmount,0);
    app.store.db.prepare('UPDATE union_raid_medal_present SET before_json=? WHERE operation_id=?').run(JSON.stringify({...debit,amount:901}),second.id);
    await reject('user_data/confirm');app.store.db.prepare('UPDATE union_raid_medal_present SET before_json=? WHERE operation_id=?').run(receipt.before_json,second.id);
    parse(await push({[table]:[secondAfter]}));
    await reject('union_raid/skill/growth',growth,503,investedId); // Saved but unacknowledged Present remains unsafe.
    parse(await push({UserGift:received(gifts)},[second]));await close();await open();
    assert.deepEqual(parse(await send('union_raid/skill/growth',growth,investedId)),
      {code:0,userMedalAmount:1400,unionRaidSkill:{medalAmount:100}});
    now--;await reject('union_raid/skill/growth',{...growth,unionRaidSkillGroupId:423000002});now++;
    const next=parse(await send('union_raid/skill/growth',{...growth,unionRaidSkillGroupId:423000002}));assert.equal(next.userMedalAmount,1300);
    await reject('union_raid/skill/growth',growth,503,investedId);
    parse(await push({[table]:[{...secondAfter,amount:1300}]}));
    assert.deepEqual(parse(await send('union_raid/skill/growth',growth,investedId)),
      {code:0,userMedalAmount:1300,unionRaidSkill:{medalAmount:100}});
    const settledProfiles=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all();
    assert.deepEqual(parse(await send('union_raid/status/get',statusBody)),{...emptyStatus,medalAmount:1300});
    assert.deepEqual(parse(await send('union_raid/status/log',logBody)),{code:0,logs:[]});
    assert.deepEqual(parse(await send('union_raid/status/preinitiation',entryBody)),{code:0,stageInfo:emptyStatus.stageInfo[0]});
    assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),settledProfiles,
      'Lobby/entry must project, not prewrite or zero, the captured medal balance');
    assert.deepEqual(parse(await send('union_raid/skill/get',{unionRaidInfoId:413000001})).unionRaidSkills,
      [{unionRaidSkillId:424000001,medalAmount:100},{unionRaidSkillId:424000051,medalAmount:100}]);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_medal_present').get().n,2);
    const stageId=1280000101101,stage={...seed.data.UserAdventureStage[0],adventureStageId:stageId,state:1,token:'',tasks:[],
      cumulativeClearCount:0,dailyClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0},
      battle={...seed.data.UserAdventureState[0],stageId},medals=app.store.read(table);
    put('UserAdventureStage',[stage]);put('UserAdventureState',[battle]);
    const practice=parse(await send('union_raid/stage/complete',{
      adventureRecord:{normalAttackCount:1,skillCount:2,specialSkillCount:0,linkageSkillCount:0,deathCount:0,continueCount:0,turnCount:3},
      adventureStageId:stageId,token:'medal-lineage-practice',adventureStageTaskIds:[],adventureGainedItems:[],friendshipStates:[],
      isEnemyAnnihilated:true,secretMissionCompleted:false,unionRaidStageId:415000001,unionRaidStageIndex:0,loopCount:1,
      bosses:Array.from({length:5},(_,enemyIndex)=>({enemyIndex,damage:100+enemyIndex})),isTraining:true,debug:false}));
    assert.equal(practice.operation.type,5000);assert.deepEqual(practice.stageInfo,emptyStatus.stageInfo[0]);
    assert.deepEqual(app.store.read(table),medals,'Practice must preserve independently earned and spent medal stock');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM union_raid_medal_present').get().n,2);

    // Native2000 independently recovers medal and stamina entries; neither already-saved grant is repeated.
    for(const order of ['medal-first','stamina-first']) {
      await fresh(order);const spId=master.currencies['currency.stamina'],info=structuredClone(seed.data.UserInfo);
      info[0].playerStatus.baseSP=7;put('UserInfo',info);put(table,[owned]);
      const gifts=[gift(1,medalId,5),gift(2,spId,13)];put('UserGift',gifts);
      const operation=parse(await send('gift/receive',receiveBody(gifts))).operation,after=target(operation),spSaved=structuredClone(info);
      spSaved[0].playerStatus.baseSP=20;
      parse(await push(order==='medal-first'?{[table]:[after]}:{UserInfo:spSaved}));await close();await open();
      await cold(operation,order==='medal-first'?[{itemId:spId,amount:13}]:[{itemId:medalId,amount:5}]);
      parse(await push(order==='medal-first'?{UserInfo:spSaved}:{[table]:[after]}));await cold(operation,[]);
      parse(await push({UserGift:received(gifts)},[operation]));assert.deepEqual(app.store.operations(),[]);
    }
  } finally {await close();assert.ok(path.basename(directory).startsWith('danmemore-union-medal-presents-'));
    fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
