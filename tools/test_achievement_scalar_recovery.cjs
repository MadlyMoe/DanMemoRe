'use strict';

// WRITTEN ONLY / SOURCE ONLY / PARTIAL / UNTESTED. Synthetic completion flags,
// funding, cap crossing and save order do not prove native earning or play.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE,encodeMsgpack}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json');
const master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-mission-scalar-'));
  const now=1692284400,groups=[[6010000001],[6010000001,6010000002],[6020000001],
    [6010000001,6020000001],[6010000001,6010000002,6020000001]];
  let app,port,database,sequence=0;
  const open=async()=>{
    app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async()=>{if(app){await app.close();app=null;}};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const reject=async(promise,status=503,raw=false)=>{
    const before=snapshot(),reply=await promise;
    assert.equal(reply.status,status,reply.body.toString());assert.equal(snapshot(),before);
    if(status===503) {if(raw) assert.equal(reply.body.length,0);else assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);}
  };
  const push=(putItems={},operations=[])=>send('user_data/push',{badges:null,scripts:{},dataTokens:{},
    checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
    deltas:Object.keys(putItems).length?[{signature:0,trigger:'DailyMissionReceived',putItems,deleteItems:{}}]:[],
    operations:operations.map(row=>({id:row.id,verifier:row.token}))});
  try {
    //112 contexts: two baselines, five original scalar groups, every flag subset,
    // and pending/saved/spent SP (Iris-only has no native SP component).
    for(const stock of [7,0x7fffffff-7]) for(const ids of groups) {
      const originalSP=ids.map(id=>master.achievements[id]).filter(row=>row.rewardType===10).reduce((sum,row)=>sum+row.rewardAmount,0),
        originalIris=ids.map(id=>master.achievements[id]).filter(row=>row.rewardType===3).reduce((sum,row)=>sum+row.rewardAmount,0);
      for(let mask=0;mask<(1<<ids.length);mask++) for(const spState of originalSP?['pending','saved','spent']:['none']) {
        database=path.join(directory,`${stock}-${ids.join('-')}-${mask}-${spState}.sqlite`);await open();
        const info=structuredClone(seed.data.UserInfo);info[0].playerStatus.baseSP=stock;put('UserInfo',info);
        app.store.changeHardCurrency(100);
        const rows=ids.map(achievementId=>({userId:seed.userId,achievementId,completedAt:now-1,lastResetAt:now-3600,
          progressParam:10,readState:1,signature:0,state:3})),body={achievementIds:rows.map(({achievementId,completedAt})=>({achievementId,completedAt}))};
        put('UserAchievement',rows);
        const issued=await send('achievement/complete',body),identity=sequence,operation=parse(issued).operation,
          stamina=app.store.staminaReward(operation);
        assert.equal(operation.parameters.issueStamina,originalSP);assert.equal(operation.parameters.issueAmount,originalIris);
        assert.equal(app.store.hardCurrency(),100+originalIris);assert.deepEqual(app.store.read('UserInfo').data,info);
        assert.equal(Boolean(stamina),Boolean(originalSP));
        if(stamina) {assert.equal(stamina.amount,originalSP);assert.equal(stamina.sp_minimum,Math.min(0x7fffffff,stock+originalSP));}
        const flags=rows.map((row,index)=>({...row,state:mask&(1<<index)?4:3}));
        if(mask) parse(await push({UserAchievement:flags}));
        if(stamina && spState!=='pending') {
          const native=structuredClone(info);native[0].playerStatus.baseSP=stamina.sp_minimum;parse(await push({UserInfo:native}));
          if(spState==='spent') {native[0].playerStatus.baseSP=9;parse(await push({UserInfo:native}));}
        }
        if(mask || stamina && spState!=='pending') {
          await reject(send('achievement/complete',body));await reject(request(port,identity,body,String(identity),'achievement/complete'));
        }
        if(mask!==((1<<ids.length)-1) || stamina && spState==='pending') await reject(push({},[operation]),400);
        let refill;
        if(stock===7) refill=parse(await send('currency/hard/consume',{consumeId:81041001})).operation;
        const queue=app.store.operations(),wallet=[app.store.hardCurrency(),app.store.paidCurrency()],
          source=app.store.achievementPcReceipt(operation).receipt,spSource=app.store.staminaReward(operation),
          profiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
          expected={...operation,parameters:{...operation.parameters,
            UserAchievement:rows.filter((row,index)=>!(mask&(1<<index))),
            issueStamina:stamina && spState!=='pending'?0:originalSP}};
        if(refill) assert.equal(app.store.fixedConsumeReceipt(refill).sp_before,
          stamina && spState==='pending'?stamina.sp_minimum:app.store.read('UserInfo').data[0].playerStatus.baseSP);
        await close();await open();
        const cold=await send('user_data/confirm'),coldIdentity=sequence;
        assert.deepEqual(parse(cold).operations,refill?[expected,refill]:[expected]);assert.deepEqual(app.store.operations(),queue);
        assert.deepEqual(app.store.achievementPcReceipt(operation).receipt,source);assert.deepEqual(app.store.staminaReward(operation),spSource);
        assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profiles);
        assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
        parse(await send('user/login'));
        const pulled=await send('user_data/pull',{tables:['UserAchievement','UserInfo']});assert.equal(pulled.status,200);
        assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull({tables:['UserAchievement','UserInfo']})));
        await close();await open();
        assert.deepEqual((await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm')).body,cold.body);
        assert.throws(()=>app.store.achievementColdRecovery({...operation,token:'changed'}),/capture|identity/);
        assert.throws(()=>app.store.achievementColdRecovery({...operation,parameters:{...operation.parameters,issueAmount:originalIris+1}}),/capture|identity/);
        app.store.db.prepare('UPDATE achievement_pc_delivery SET operation_json=? WHERE operation_id=?').run('{}',operation.id);
        await reject(send('user_data/confirm'));await reject(send('user/login'));
        app.store.db.prepare('UPDATE achievement_pc_delivery SET operation_json=? WHERE operation_id=?').run(source.operation_json,operation.id);
        if(stamina && spState==='pending') {
          const changed=structuredClone(info);changed[0].playerStatus.baseSP=stock+1;put('UserInfo',changed);
          await reject(send('user_data/confirm'));await reject(send('user/login'));put('UserInfo',info);
        }
        if(stamina && spState!=='pending') {
          app.store.db.prepare('UPDATE stamina_reward_claim SET effect_saved=0 WHERE operation_id=?').run(operation.id);
          await reject(send('user_data/confirm'));app.store.db.prepare('UPDATE stamina_reward_claim SET effect_saved=1 WHERE operation_id=?').run(operation.id);
        }
        assert.deepEqual((await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm')).body,cold.body);
        const completion={UserAchievement:rows.map(row=>({...row,state:4}))};
        if(stamina && spState==='pending') {
          const native=structuredClone(app.store.read('UserInfo').data);native[0].playerStatus.baseSP=stamina.sp_minimum;completion.UserInfo=native;
        }
        const saved=parse(await push(completion));assert.ok(!saved.operations.some(row=>row.id===operation.id || row.id===refill?.id));
        if(spState==='spent') assert.equal(app.store.read('UserInfo').data[0].playerStatus.baseSP,9,'Recovery cannot renew spent SP');
        for(const [table,event] of [['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER fail_scalar_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'scalar ACK rollback'); END`);
          await reject(push({},[expected]),503,true);app.store.db.exec('DROP TRIGGER fail_scalar_ack');
        }
        parse(await push({},[expected]));
        if(refill) {
          assert.deepEqual(parse(await send('user_data/confirm')).operations,[refill]);
          const native=structuredClone(app.store.read('UserInfo').data);native[0].playerStatus.baseSP=app.store.fixedConsumeReceipt(refill).sp_minimum;
          parse(await push({UserInfo:native},[refill]));
        }
        await close();await open();assert.deepEqual(app.store.operations(),[]);assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
        await reject(request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm'));
        await reject(send('achievement/complete',body));await reject(request(port,identity,body,String(identity),'achievement/complete'));
        const before=snapshot();assert.equal((await push({UserAchievement:rows})).status,400);assert.equal(snapshot(),before);await close();
      }
    }
    //384 numeric +384 capped dated +384 NEW first/owned dated WRITTEN ONLY contexts share this fixture.
    // Each suite has every flag/item subset, three SP states, two baselines/192 refills.
    for(const [suite,ids] of [['numeric',[6020015790,6020010401]],['dated',[6020000100,6020010401]],
      ['dated-ordinary',[6020000100,6020010401]]]) {
    const dated=suite.startsWith('dated'),ordinary=suite==='dated-ordinary';
    const rewards=ids.map(id=>({id,original:master.achievements[id],
      itemId:master.items[master.achievements[id].rewardKey],profile:master.itemProfiles[master.items[master.achievements[id].rewardKey]]})),
      mixedIds=[...rewards.map(row=>row.id),6010000001,6020000001],
      tables=['UserAchievement',...rewards.map(row=>row.profile.table),'UserInfo'];
    assert.deepEqual(rewards.map(row=>[row.profile.table,row.original.rewardAmount]),
      [[dated?'UserGachaTicket':'UserCpItem',dated?1:3],['UserHeroSublimateItem',2]]);
    for(const stock of [7,0x7fffffff-7]) for(let flags=0;flags<16;flags++) for(let items=0;items<4;items++)
      for(const spState of ['pending','saved','spent']) {
        database=path.join(directory,`${suite}-${stock}-${flags}-${items}-${spState}.sqlite`);await open();
        const firstTicket=ordinary && stock===7;
        const info=structuredClone(seed.data.UserInfo);info[0].playerStatus.baseSP=stock;put('UserInfo',info);
        app.store.changeHardCurrency(100);
        const rows=mixedIds.map(achievementId=>({userId:seed.userId,achievementId,completedAt:now-1,lastResetAt:now-3600,
          progressParam:10,readState:1,signature:0,state:3})),
          body={achievementIds:rows.map(({achievementId,completedAt})=>({achievementId,completedAt}))},
          beforeItems=rewards.map(({itemId,profile},index)=>({userId:seed.userId,[profile.idField]:itemId,
            ...(profile.table==='UserGachaTicket'?{dateList:firstTicket?[]:[{aquiredAt:now-master.lotteryTickets[itemId]-1},
              {aquiredAt:now-1},{aquiredAt:now-1}],bookEntryState:firstTicket?1:-128}:{amount:7+index*4,bookEntryState:3,reservedAmount:0}),
            cumulativeAmount:ordinary && profile.table==='UserGachaTicket'?(firstTicket?0:100):stock===7?999999998:999999999,
            signature:profile.table==='UserGachaTicket' && firstTicket?0:index?0xffffffff:0x7fffffff}));
        put('UserAchievement',rows);rewards.forEach((row,index)=>put(row.profile.table,
          row.profile.table==='UserGachaTicket' && firstTicket?[]:[beforeItems[index]]));
        const issued=await send('achievement/complete',body),identity=sequence,operation=parse(issued).operation,
          stamina=app.store.staminaReward(operation),source=app.store.achievementPcReceipt(operation).receipt,
          originals=app.store.db.prepare('SELECT * FROM achievement_item_claim WHERE operation_id=? ORDER BY item_id').all(operation.id),
          acquired=rewards.map((row,index)=>({...beforeItems[index],
            ...(row.profile.table==='UserGachaTicket'?{bookEntryState:firstTicket?3:beforeItems[index].bookEntryState,
              dateList:[...beforeItems[index].dateList.filter(date=>date.aquiredAt+master.lotteryTickets[row.itemId]>now),
              ...Array.from({length:row.original.rewardAmount},()=>({aquiredAt:now}))]}:{amount:beforeItems[index].amount+row.original.rewardAmount}),
            cumulativeAmount:originals.find(target=>target.item_id===row.itemId).cumulative_amount,signature:operation.signature}));
        assert.equal(operation.parameters.issueAmount,10);assert.equal(operation.parameters.issueStamina,50);
        assert.equal(app.store.hardCurrency(),110);assert.ok(originals.every(row=>row.cap_version===1 &&
          (row.stock_state===null)!==(row.gacha_state===null)));
        if(ordinary) {
          const target=originals.find(row=>row.item_id===rewards[0].itemId);
          assert.equal(JSON.parse(target.gacha_state).policy,firstTicket?'offline-achievement-gacha-ticket-first-v1':'offline-achievement-gacha-ticket-v1');
          assert.deepEqual(app.store.read('UserGachaTicket').data,firstTicket?[]:[beforeItems[0]],'Private first capture does not write native inventory');
        }
        assert.deepEqual(operation.parameters.receivedItems,rewards.map(row=>({itemId:row.itemId,amount:row.original.rewardAmount})));
        if(flags) parse(await push({UserAchievement:rows.map((row,index)=>({...row,state:flags&(1<<index)?4:3}))}));
        for(let index=0;index<rewards.length;index++) if(items&(1<<index)) {
          const table=rewards[index].profile.table;
          parse(await push({[table]:[acquired[index]]}));
          // Empty dated vectors are synthetic expiry/consumption saves, not a successful pending lottery pull.
          if(spState==='spent') parse(await push({[table]:[{...acquired[index],...(table==='UserGachaTicket'?{dateList:[]}:{amount:0})}]}));
        }
        if(dated && !firstTicket && !(items&1) && spState==='spent')
          parse(await push({UserGachaTicket:[{...beforeItems[0],dateList:beforeItems[0].dateList.filter(date=>date.aquiredAt+master.lotteryTickets[rewards[0].itemId]>now)}]}));
        if(spState!=='pending') {
          const native=structuredClone(info);native[0].playerStatus.baseSP=stamina.sp_minimum;parse(await push({UserInfo:native}));
          if(spState==='spent') {native[0].playerStatus.baseSP=9;parse(await push({UserInfo:native}));}
        }
        if(flags || items || spState!=='pending') {
          await reject(send('achievement/complete',body));await reject(request(port,identity,body,String(identity),'achievement/complete'));
        }
        if(flags!==15 || items!==3 || spState==='pending') await reject(push({},[operation]),400);
        if(stock===7 && flags===0 && items===0 && spState==='pending') {
          const original=originals.find(row=>row.item_id===rewards[0].itemId),table=rewards[0].profile.table,
            column=table==='UserGachaTicket'?'gacha_state':'stock_state';
          for(const change of [table==='UserGachaTicket'?{dateList:[...beforeItems[0].dateList,{aquiredAt:now}],
            ...(firstTicket?{bookEntryState:3,cumulativeAmount:original.cumulative_amount}:{})}:
            {amount:beforeItems[0].amount+1},{cumulativeAmount:original.cumulative_amount},{signature:operation.signature}]) {
            parse(await push({[table]:[{...beforeItems[0],...change}]}));
            await reject(send('user_data/confirm'));await reject(send('user/login'));
            await reject(send('user_data/pull',{tables:[table]}));
            put(table,firstTicket?[]:[beforeItems[0]]);
            app.store.db.prepare(`UPDATE achievement_item_claim SET ${column}=? WHERE operation_id=? AND item_id=?`)
              .run(original[column],operation.id,rewards[0].itemId);
          }
        }
        let refill;
        if(stock===7) refill=parse(await send('currency/hard/consume',{consumeId:81041001})).operation;
        const expected={...operation,parameters:{...operation.parameters,
          UserAchievement:rows.filter((row,index)=>!(flags&(1<<index))),
          receivedItems:operation.parameters.receivedItems.filter((row,index)=>!(items&(1<<index))),
          issueStamina:spState==='pending'?50:0}},queue=app.store.operations(),
          captures=app.store.db.prepare('SELECT * FROM achievement_item_claim WHERE operation_id=? ORDER BY item_id').all(operation.id),
          pcCapture=app.store.achievementPcReceipt(operation).receipt,
          nativeProfiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
          wallet=[app.store.hardCurrency(),app.store.paidCurrency()];
        await close();await open();
        const cold=await send('user_data/confirm'),coldIdentity=sequence;
        assert.deepEqual(parse(cold).operations,refill?[expected,refill]:[expected]);assert.deepEqual(app.store.operations(),queue);
        assert.deepEqual(app.store.achievementPcReceipt(operation).receipt,pcCapture);
        assert.equal(pcCapture.operation_json,source.operation_json,'Native observations must not rewrite the original handoff');
        assert.deepEqual(app.store.db.prepare('SELECT * FROM achievement_item_claim WHERE operation_id=? ORDER BY item_id').all(operation.id),captures);
        assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),nativeProfiles);
        assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
        parse(await send('user/login'));
        const pulled=await send('user_data/pull',{tables});
        assert.equal(pulled.status,200);assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull({tables})));
        await close();await open();
        assert.deepEqual((await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm')).body,cold.body);
        assert.throws(()=>app.store.achievementColdRecovery({...operation,parameters:{...operation.parameters,
          receivedItems:operation.parameters.receivedItems.map((row,index)=>index?row:{...row,amount:row.amount+1})}}),/capture|identity|handoff/);
        for(const original of captures) for(const changed of ['{',null]) {
          const column=original.stock_state===null?'gacha_state':'stock_state';
          app.store.db.prepare(`UPDATE achievement_item_claim SET ${column}=? WHERE operation_id=? AND item_id=?`)
            .run(changed,operation.id,original.item_id);
          await reject(send('user_data/confirm'));await reject(send('user/login'));
          app.store.db.prepare(`UPDATE achievement_item_claim SET ${column}=? WHERE operation_id=? AND item_id=?`)
            .run(original[column],operation.id,original.item_id);
        }
        const completion={UserAchievement:rows.map(row=>({...row,state:4}))};
        rewards.forEach((row,index)=>{if(!(items&(1<<index))) completion[row.profile.table]=[acquired[index]];});
        if(spState==='pending') {const native=structuredClone(app.store.read('UserInfo').data);native[0].playerStatus.baseSP=stamina.sp_minimum;completion.UserInfo=native;}
        const saved=parse(await push(completion));assert.ok(!saved.operations.some(row=>row.id===operation.id || row.id===refill?.id));
        if(flags!==15 || items!==3 || spState==='pending')
          await reject(request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm'));
        if(spState==='spent') {
          assert.equal(app.store.read('UserInfo').data[0].playerStatus.baseSP,9);
          rewards.forEach((row,index)=>{if(items&(1<<index)) {
            const saved=app.store.read(row.profile.table).data[0];
            if(row.profile.table==='UserGachaTicket') assert.deepEqual(saved.dateList,[],'Recovery must not recreate removed dates');
            else assert.equal(saved.amount,0,'Recovery must not renew spent items');
          }});
        }
        for(const [table,event] of [['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER fail_numeric_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'numeric ACK rollback'); END`);
          await reject(push({},[expected]),503,true);app.store.db.exec('DROP TRIGGER fail_numeric_ack');
        }
        parse(await push({},[expected]));
        if(refill) {
          assert.deepEqual(parse(await send('user_data/confirm')).operations,[refill]);
          const native=structuredClone(app.store.read('UserInfo').data);native[0].playerStatus.baseSP=app.store.fixedConsumeReceipt(refill).sp_minimum;
          parse(await push({UserInfo:native},[refill]));
        }
        await close();await open();assert.deepEqual(app.store.operations(),[]);assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
        await reject(request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm'));
        await reject(send('achievement/complete',body));await reject(request(port,identity,body,String(identity),'achievement/complete'));
        const before=snapshot();assert.equal((await push({UserAchievement:rows})).status,400);assert.equal(snapshot(),before);await close();
      }
    }
    console.log('1264 scalar/numeric/dated written contexts with632 following refills; native earning/UI/signature/application acceptance remains pending');
  } finally {
    await close();const resolved=fs.realpathSync(directory);
    assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('danmemore-mission-scalar-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
