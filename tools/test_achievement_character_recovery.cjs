'use strict';

// DEFERRED / NOT RUN. Synthetic eligibility, units, cards, gear, saves and
// funding are not native earning, constructors, signatures or gameplay proof.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer,OFFLINE_UNAVAILABLE_CODE,encodeMsgpack } = require('./danmemore_server.cjs');
const { request,rewardCharacterFixture,rewardCostumeFixture,rewardUnitStoryFixture,rewardCommunicationFixture } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-mission-character-cold-'));
  let app,database,port,sequence=0,now=1;
  const close=async()=>{if(app){await app.close();app=null;}};
  const open=async()=>{
    app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const fresh=async name=>{await close();database=path.join(directory,`${name}.sqlite`);await open();};
  const send=(action,body)=>request(port,++sequence,body,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rewards=()=>JSON.stringify(['profile','achievement_pc_delivery','achievement_claim','achievement_item_claim',
    'stamina_reward_claim','operation_queue','hard_currency'].map(name=>[name,app.store.db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()]));
  const reject=async(pending,status=503,raw=false)=>{
    const before=snapshot(),reply=await pending;assert.equal(reply.status,status,reply.body.toString());assert.equal(snapshot(),before);
    if(status===503) raw?assert.equal(reply.body.length,0):assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
  };
  const push=(putItems={},operations=[])=>send('user_data/push',{badges:null,scripts:{},dataTokens:{},
    checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
    deltas:Object.keys(putItems).length?[{signature:0,trigger:'Achievement',putItems,deleteItems:{}}]:[],
    operations:operations.map(row=>({id:row.id,verifier:row.token}))});
  const claimRow=id=>({userId:seed.userId,achievementId:Number(id),completedAt:now,
    lastResetAt:0,progressParam:1,readState:1,signature:0,state:3});
  const claimBody=rows=>({achievementIds:rows.map(({achievementId,completedAt})=>({achievementId,completedAt}))});
  const unit=pcId=>({...seed.data.UserPC[0],userId:seed.userId,pcId,joiningState:1,currentJobIndex:1,
    totalExp:0,limitbreakCount:0,heroSublimateLevel:0,isUnlockedHeroSublimate:false});
  const board=pcId=>({userId:seed.userId,pcId,pcJobs:[],signature:0});
  const unitRows=pcId=>({UserPC:[unit(pcId)],UserPCJobSet:[board(pcId)],
    UserCharacter:rewardCharacterFixture(app.store.read('UserCharacter').data,[pcId]),
    ...rewardCostumeFixture(app.store.read('UserCharacterCostume').data,[pcId],app.store.read('UserCommunicationVoice').data),
    ...rewardUnitStoryFixture(app.store.read('UserAdventureStage').data,[pcId])});
  const info=sp=>app.store.read('UserInfo').data.map(row=>({...row,playerStatus:{...row.playerStatus,baseSP:sp}}));
  try {
    const units=Object.entries(master.achievements).filter(([,row])=>row.rewardType===29),
      cards=Object.entries(master.achievements).filter(([,row])=>row.rewardType===30),states=['pending','preowned','saved'];
    assert.equal(units.length,3);assert.equal(cards.length,30);
    //27 mixed contexts: all3 original unit IDs x three unit/card states,
    // rotating independent claim/item/SP states and27 original10-Iris refills.
    for(const [index,[id,original]] of units.entries()) for(const [pcIndex,pcState] of states.entries())
      for(const [cardIndex,cardState] of states.entries()) {
        const [cardId,cardOriginal]=cards[index],pcId=master.pcs[original.rewardKey],memoriaId=master.memorias[cardOriginal.rewardKey];
        now=cardOriginal.startAt;assert.ok(now>=original.startAt);await fresh(`mixed-${id}-${pcState}-${cardState}`);
        const rows=[id,cardId,6010000001,6020000001,6020010401].map(claimRow),body=claimBody(rows),
          flags=[0,3,31][(index+pcIndex+cardIndex)%3],spState=['pending','saved','spent'][cardIndex],
          itemState=['pending','saved','spent'][index],card={userId:pcIndex%2?seed.userId:0,memoriaId,totalExp:0,signature:0},
          hero={userId:seed.userId,heroSublimateItemId:99000001,bookEntryState:3,signature:0x7fffffff,
            cumulativeAmount:999999998,amount:7,reservedAmount:0};
        put('UserAchievement',rows);put('UserInfo',info(7));put('UserHeroSublimateItem',[hero]);
        put('UserMemoria',cardState==='preowned'?[{...card,totalExp:5000}]:[]);
        if(pcState==='preowned') {
          put('UserPC',[...app.store.read('UserPC').data,{...unit(pcId),totalExp:100}]);
          put('UserPCJobSet',[...app.store.read('UserPCJobSet').data,board(pcId)]);
        }
        const walletBefore=app.store.hardCurrency();app.store.changeHardCurrency(100);
        const issued=await send('achievement/complete',body),identity=sequence,operation=parse(issued).operation,
          capture=app.store.achievementPcReceipt(operation),sp=app.store.staminaReward(operation),
          acquiredCard={...card,signature:operation.signature},acquiredHero={...hero,amount:9,cumulativeAmount:999999999,signature:operation.signature};
        assert.deepEqual(operation.parameters.receivedPCs,[pcId]);assert.deepEqual(operation.parameters.receivedMemorias,[{memoriaId,level:1}]);
        assert.deepEqual(operation.parameters.receivedItems,[{itemId:99000001,amount:2}]);
        assert.equal(capture.targets[0].isFirst,pcState!=='preowned');assert.equal(capture.memorias[0].isFirst,cardState!=='preowned');
        assert.equal(app.store.hardCurrency(),walletBefore+110);assert.equal(operation.parameters.issueStamina,50);
        if(pcState==='saved') {
          parse(await push(unitRows(pcId)));
          parse(await push(rewardCommunicationFixture(app.store,[pcId],now)));
        }
        if(cardState==='saved') parse(await push({UserMemoria:[acquiredCard]}));
        if(flags) parse(await push({UserAchievement:rows.map((row,i)=>({...row,state:flags&(1<<i)?4:3}))}));
        if(itemState!=='pending') {
          parse(await push({UserHeroSublimateItem:[acquiredHero]}));
          if(itemState==='spent') parse(await push({UserHeroSublimateItem:[{...acquiredHero,amount:0,signature:(operation.signature+1)>>>0}]}));
        }
        if(spState!=='pending') {parse(await push({UserInfo:info(sp.sp_minimum)}));if(spState==='spent') parse(await push({UserInfo:info(9)}));}
        if(flags!==31 || pcState==='pending' || cardState==='pending' || itemState==='pending' || spState==='pending')
          await reject(push({},[operation]),400);
        if(pcState==='saved'||cardState==='saved'||flags||itemState!=='pending'||spState!=='pending') {
          await reject(send('achievement/complete',body));await reject(request(port,identity,body,String(identity),'achievement/complete'));
        }
        const refill=parse(await send('currency/hard/consume',{consumeId:81041001})).operation,
          expected={...operation,parameters:{...operation.parameters,
            UserAchievement:rows.filter((row,i)=>!(flags&(1<<i))),receivedPCs:pcState==='pending'?[pcId]:[],
            receivedMemorias:cardState==='pending'?[{memoriaId,level:1}]:[],receivedItems:itemState==='pending'?[{itemId:99000001,amount:2}]:[],
            issueStamina:spState==='pending'?50:0}},source=rewards(),wallet=[app.store.hardCurrency(),app.store.paidCurrency()];
        await close();await open();const cold=await send('user_data/confirm'),coldIdentity=sequence;
        assert.deepEqual(parse(cold).operations,[expected,refill]);assert.equal(rewards(),source);
        const queue=app.store.operations(),native=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
        assert.deepEqual(queue,[operation,refill]);parse(await send('user/login'));
        const tables=['UserPC','UserPCJobSet','UserMemoria','UserHeroSublimateItem','UserAchievement','UserInfo'],
          pulled=await send('user_data/pull',{tables});assert.equal(pulled.status,200);assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull({tables})));
        assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),native);
        await close();await open();assert.deepEqual((await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm')).body,cold.body);
        const receipt=app.store.achievementPcReceipt(operation).receipt;
        app.store.db.prepare('UPDATE achievement_pc_delivery SET pc_targets=? WHERE operation_id=?').run('[]',operation.id);
        await reject(send('user_data/confirm'));
        app.store.db.prepare('UPDATE achievement_pc_delivery SET pc_targets=? WHERE operation_id=?').run(receipt.pc_targets,operation.id);
        app.store.db.prepare('UPDATE achievement_pc_delivery SET memoria_targets=? WHERE operation_id=?').run('[]',operation.id);
        await reject(send('user/login'));
        app.store.db.prepare('UPDATE achievement_pc_delivery SET memoria_targets=? WHERE operation_id=?').run(receipt.memoria_targets,operation.id);
        const completion={UserAchievement:rows.map(row=>({...row,state:4}))};
        if(pcState==='pending') Object.assign(completion,unitRows(pcId));
        if(cardState==='pending') completion.UserMemoria=[acquiredCard];
        if(itemState==='pending') completion.UserHeroSublimateItem=[acquiredHero];
        if(spState==='pending') completion.UserInfo=info(sp.sp_minimum);
        parse(await push(completion));
        if(pcState==='pending') parse(await push(rewardCommunicationFixture(app.store,[pcId],now)));
        for(const [table,event] of [['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER fail_character_cold_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'character cold ACK rollback'); END`);
          await reject(push({},[expected]),503,true);app.store.db.exec('DROP TRIGGER fail_character_cold_ack');
        }
        parse(await push({},[expected]));assert.deepEqual(parse(await send('user_data/confirm')).operations,[refill]);
        parse(await push({UserInfo:info(app.store.fixedConsumeReceipt(refill).sp_minimum)},[refill]));
        await close();await open();assert.deepEqual(app.store.operations(),[]);assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
        await reject(request(port,identity,body,String(identity),'achievement/complete'));
      }
    //6 incomplete constructors: each original PC, unit-only and board-only.
    for(const [id,original] of units) for(const part of ['unit','boards']) {
      now=original.startAt;await fresh(`partial-${id}-${part}`);
      const pcId=master.pcs[original.rewardKey],rows=[claimRow(id)],body=claimBody(rows);put('UserAchievement',rows);
      const operation=parse(await send('achievement/complete',body)).operation;
      parse(await push(part==='unit'?{UserPC:[unit(pcId)]}:{UserPCJobSet:[board(pcId)]}));
      await close();await open();for(const action of ['user/login','user_data/confirm']) await reject(send(action));
      await reject(send('user_data/pull',{tables:['UserPC','UserPCJobSet']}));await reject(push({},[operation]),400);
      const completion={...unitRows(pcId),UserAchievement:rows.map(row=>({...row,state:4}))};
      await reject(push(completion,[operation]),400);
      parse(await push({...completion,...rewardCommunicationFixture(app.store,[pcId],now)},[operation]));
      assert.deepEqual(app.store.operations(),[]);
    }
    //30 exact original card missions: flags first, actual card acquisition,
    // later growth/signature, cold projection, source preservation and real ACK.
    for(const [id,original] of cards) {
      now=original.startAt;await fresh(`card-${id}`);
      const rows=[claimRow(id)],body=claimBody(rows),memoriaId=master.memorias[original.rewardKey];put('UserAchievement',rows);put('UserMemoria',[]);
      const operation=parse(await send('achievement/complete',body)).operation;
      parse(await push({UserAchievement:rows.map(row=>({...row,state:4}))}));
      const pending={...operation,parameters:{...operation.parameters,UserAchievement:[]}};
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[pending]);await reject(push({},[pending]),400);
      const card={userId:0,memoriaId,totalExp:0,signature:operation.signature};parse(await push({UserMemoria:[card]}));
      const grown={...card,totalExp:7,signature:(operation.signature+1)>>>0};parse(await push({UserMemoria:[grown]}));
      await close();await open();const expected={...pending,parameters:{...pending.parameters,receivedMemorias:[]}};
      assert.deepEqual(parse(await send('user_data/confirm')).operations,[expected]);assert.deepEqual(app.store.operations(),[operation]);
      assert.deepEqual(app.store.read('UserMemoria').data,[grown]);parse(await push({},[expected]));
      assert.equal(app.store.db.prepare('SELECT minimum_exp FROM achievement_memoria_floor WHERE memoria_id=?').get(memoriaId).minimum_exp,7);
      await reject(push({UserMemoria:[card]}),400);await close();await open();assert.deepEqual(app.store.operations(),[]);
    }
    console.log('SOURCE ONLY mission unit/card cold recovery:57 deferred contexts/27 following refills; native acceptance pending');
  } finally {
    await close();const resolved=fs.realpathSync(directory);
    assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('danmemore-mission-character-cold-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
