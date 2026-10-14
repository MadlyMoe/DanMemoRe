'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer}=require('./danmemore_server.cjs');
const {request,stageXpFixture}=require('./test_danmemore_server.cjs');
const {nativeMasterConfig,decodeFile,decodeTable}=require('./decode_master_data.cjs');
const master=require('../data/danmemore-master.json'),seed=require('../data/danmemore-seed.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  //Original archive fields, never a guessed reward quantity or live-save write.
  const binary=path.resolve(__dirname,'../.work/arm64-original/lib/arm64-v8a/libapp.so');
  if(fs.existsSync(binary)) {
    const config=nativeMasterConfig(binary),wire=fs.readFileSync(path.resolve(__dirname,'../contents/1/master/divide_enc/adventureStage.enc'));
    const original=decodeTable(decodeFile(wire,config.key,config.iv),[['id','long'],...Array(20).fill(null),
      ['rewardType','int'],['rewardKey','string'],['rewardAmount','int']],config.numericKey);
    assert.deepEqual(master.stageSRewards,Object.fromEntries(original.map(({id,...row})=>[id,row])));
  }
  assert.equal(Object.keys(master.stageSRewards).length,21524);
  assert.deepEqual(master.stageSRewards[1010000101101],{rewardType:3,rewardKey:'currency.gem',rewardAmount:1});
  assert.deepEqual(master.stageSRewards[1090120210102],{rewardType:3,rewardKey:'currency.gem',rewardAmount:5});
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-stage-s-reward-'));
  let app,port,sequence=0,rejection;
  const open=async(fixture=seed,name='profile')=>{
    app=createServer({database:path.join(directory,`${name}.sqlite`),seed:fixture,master,log:line=>{
      const entry=JSON.parse(line);if(entry.event==='rejected') rejection=entry.reason;
    }});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async()=>{if(app?.server.listening) await new Promise(resolve=>app.server.close(resolve));app?.store.close();app=null;};
  const send=(body,action='adventure/stage/complete')=>{rejection=null;return request(port,++sequence,body,'0',action);};
  const parse=r=>{assert.equal(r.status,200,rejection ?? r.body.toString());return JSON.parse(r.body);};
  const snapshot=()=>Object.fromEntries(['profile','hard_currency','stage_reward','stage_completion','stage_delivery',
    'stage_state_floor','stage_unlock_floor','stage_xp_claim','stage_xp_floor','pve_item_claim',
    'operation_queue','operation_done','runtime','reply_cache'].map(t=>[t,app.store.db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()]));
  //Synthetic native-shaped saves in disposable profiles; NOT client acceptance.
  const acknowledgement=operation=>{
    const before=operation.parameters.UserAdventureStage[0],at=1790866800+sequence;
    const stage={...before,state:4,cumulativeClearCount:before.cumulativeClearCount+1,dailyClearCount:before.dailyClearCount+1,
      firstCompleteDateTime:before.firstCompleteDateTime || at,lastCompleteDateTime:at,
      tasks:before.tasks.map(row=>operation.parameters.adventureStageTaskIds.includes(row.adventureStageTaskId)
        ? {...row,state:2} : row)};
    const items={UserAdventureStage:[stage]};
    for(const target of app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(operation.id)) {
      const old=app.store.read(target.table_name).data.find(row=>row[target.id_field]===target.item_id);
      (items[target.table_name] ??= []).push({...old,userId:seed.userId,[target.id_field]:target.item_id,
        ...(target.table_name==='UserKeyItem' && !old?{reservedAmount:0,bookEntryState:1,signature:0,exploit:false}:{}),
        ...(target.table_name==='UserAdventureTicket' && !old?{lastResetAt:0,bookEntryState:1,signature:0}:{}),
        ...(target.table_name==='UserMemoriaExpItem' && !old?{lastAquiredAt:0,reservedAmount:0,bookEntryState:1,signature:0}:{}),
        ...(target.table_name==='UserAlarmVoiceItem' && !old?{reservedAmount:0,bookEntryState:1,signature:0}:{}),
        ...(target.table_name==='UserLimitBreakItem' && !old?{bookEntryState:1,signature:0}:{}),
        cumulativeAmount:target.cumulative_amount,...(target.table_name==='UserGachaTicket'?{dateList:[]}:{amount:0})});
    }
    const putItems=stageXpFixture(app.store,items,[operation]);
    return {badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([n,r])=>[n,md5(r)]))},
      deltas:[{signature:0,trigger:'AdventureComplete',putItems,deleteItems:{}}],operations:[{id:operation.id,verifier:operation.token}]};
  };
  const result={adventureStageId:1010000101101,token:'two-stars',adventureStageTaskIds:[682000001,682000002],
    adventureGainedItems:[],friendshipStates:[],adventureRecord:{continueCount:0,deathCount:0,turnCount:3},
    isEnemyAnnihilated:true,secretMissionCompleted:false};
  try {
    await open();
    const first= parse(await send(result)).operation;
    assert.equal(app.store.hardCurrency(),2,'Two objectives are not an S clear');
    assert.equal(app.store.db.prepare("SELECT COUNT(*) n FROM stage_reward WHERE key LIKE 's-stage:%'").get().n,0);
    parse(await send(acknowledgement(first),'user_data/push'));
    const third={...result,token:'third-star',adventureStageTaskIds:[682000003]};
    for(const table of ['stage_reward','hard_currency','operation_queue']) {
      const event=table==='hard_currency' ? 'UPDATE' : 'INSERT';
      app.store.db.exec(`CREATE TRIGGER fail_s_reward BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'S reward rollback'); END`);
      const before=snapshot();assert.equal((await send(third)).status,503);assert.deepEqual(snapshot(),before);
      app.store.db.exec('DROP TRIGGER fail_s_reward');
    }
    let before=snapshot();assert.equal((await send({...third,adventureStageTaskIds:[682000003,682000004]})).status,400);
    assert.deepEqual(snapshot(),before,'Foreign objective must not mint any reward');
    const response=await send(third),responseSequence=sequence,operation=parse(response).operation;
    assert.equal(app.store.hardCurrency(),4,'Third objective plus original S-clear1, including earlier received objectives');
    assert.equal(app.store.db.prepare('SELECT amount FROM stage_reward WHERE key=?').get('s-stage:1010000101101').amount,1);
    await close();await open();
    const replay=await request(port,responseSequence,third,'0','adventure/stage/complete');
    assert.equal(replay.status,200);assert.deepEqual(replay.body,response.body);
    app.store.db.exec('DELETE FROM reply_cache');
    assert.deepEqual(parse(await send(third)).operation,operation);
    assert.equal(app.store.hardCurrency(),4,'Permanent retry cannot remint a bonus after cache eviction');
    const saved=acknowledgement(operation);
    before=snapshot();assert.equal((await send({...saved,deltas:[]},'user_data/push')).status,400);assert.deepEqual(snapshot(),before);
    parse(await send({...saved,operations:[]},'user_data/push'));
    await close();await open();parse(await send(saved,'user_data/push'));
    assert.deepEqual(app.store.operations(),[]);assert.equal(app.store.hardCurrency(),4);
    assert.equal((await send(third)).status,503,'Settled result is not delivered again');
    const repeat=parse(await send({...result,token:'repeat',adventureStageTaskIds:[682000001,682000002,682000003]})).operation;
    assert.equal(app.store.hardCurrency(),4);parse(await send(acknowledgement(repeat),'user_data/push'));
    await close();
    for(const [stageId,amount,name,received] of [[1010000101101,1,'legacy',true],[1090120210102,5,'five',false]]) {
      const fixture=structuredClone(seed),sample=fixture.data.UserAdventureStage.find(r=>r.adventureStageId===1010000101101);
      const ids=Object.entries(master.stageTasks).filter(([,t])=>t.stageId===stageId).map(([id])=>Number(id));
      assert.equal(ids.length,3);
      fixture.data.UserAdventureStage=[{...sample,adventureStageId:stageId,state:received?4:1,
        cumulativeClearCount:received?1:0,firstCompleteDateTime:received?1790866800:0,lastCompleteDateTime:received?1790866800:0,
        tasks:ids.map(adventureStageTaskId=>({adventureStageTaskId,state:received?2:0}))}];
      await open(fixture,name);
      parse(await send({...result,adventureStageId:stageId,adventureStageTaskIds:ids,token:name}));
      assert.equal(app.store.hardCurrency(),received?0:3+amount);
      assert.equal(app.store.db.prepare("SELECT COUNT(*) n FROM stage_reward WHERE key LIKE 's-stage:%'").get().n,received?0:1);
      await close();
    }
    console.log('Original S-clear recipes: accumulated objectives,1/5 Iris, legacy suppression, once-only receipt, atomic issuance, retry/restart/cache eviction and split save/ACK OK; native UI still required');
  } finally {
    await close();
    assert.equal(path.dirname(fs.realpathSync(directory)),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-stage-s-reward-'));
    fs.rmSync(directory,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
