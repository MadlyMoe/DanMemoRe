'use strict';

// Disposable protocol/save checks, not native reward/signature/UI,
// original gift availability or crash-free gameplay acceptance. Stamina-only
// cold recovery below is SOURCE ONLY / PARTIAL / UNTESTED; do not run yet.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE, encodeMsgpack } = require('./danmemore_server.cjs');
const { request,rewardCharacterFixture,rewardCostumeFixture,rewardUnitStoryFixture } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-gift-delivery-'));
  let app, database, port, sequence = 0;
  const now = 1686794400, costumeId = 1021002030;
  const pcId = Object.values(master.pcs).find(id => !master.pcHeroSublimateGroups[id] && !seed.data.UserPC.some(row => row.pcId === id));
  const weapon = Number(Object.keys(master.equipments).find(id => master.equipments[id].type === 1));
  const open = async () => {
    app = createServer({ database, seed, master, wallNowSeconds: () => now, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const send = (action, value) => request(port, ++sequence, value, String(sequence), action);
  const parse = reply => { assert.equal(reply.status, 200, reply.body.toString()); return JSON.parse(reply.body); };
  const settled = response => {
    const { operation:_hot,operations:_queued,...root } = response;
    return { ...root,operations:[] };
  };
  const pull = async value => {
    const reply=await send('user_data/pull',value);
    assert.equal(reply.status,200,reply.body.toString());
    assert.equal(reply.headers['content-type'],'application/x-msgpack');
    assert.deepEqual(reply.body,encodeMsgpack(app.store.pull(value)));
  };
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({ name }) => [name, app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const reject = async (reply, status = 503, raw = false) => {
    const before = snapshot(), response = await reply;
    assert.equal(response.status, status, response.body.toString()); assert.equal(snapshot(), before);
    if(raw) assert.equal(response.body.length,0,'Injected SQLite failure is not semantic cancellation');
    else if (status === 503) assert.equal(JSON.parse(response.body).code, OFFLINE_UNAVAILABLE_CODE);
  };
  const push = (putItems = {}, operations = [], deleteItems = {}) => send('user_data/push', {
    badges: null, scripts: {}, dataTokens: {}, checksums: { before: {}, after: Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name => [name,md5(putItems[name] ?? [])])) },
    deltas: Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature: 0, trigger: 'GiftReceive', putItems, deleteItems }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })),
  });
  const gift = (id, itemId, extra = {}) => ({ userId: seed.userId,id,itemId,amount:1,title:'Synthetic original-class Present',message:'',
    senderType:1,senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,
    pcHeroSublimateCount:0,state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0,...extra });
  const equipment = () => {
    const { type, ...spec } = app.store.equipmentSpec(weapon), original = master.equipments[weapon];
    return { userId:seed.userId,...spec,slotIndex:1,createAt:now,exp:0,durability:original.durability,
      reservedDurability:original.durability,isProtected:false,isUnbreakable:false,
      ...Object.fromEntries(Array.from({ length:5 },(_,i)=>[`lockedAbility${i+1}`,false])) };
  };
  const effects = (kind, operation) => {
    if (kind === 'ordinary') {
      const target = app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=?').get(operation.id);
      return { UserCurrency:[{ userId:seed.userId,currencyId:target.item_id,amount:1,reservedAmount:0,
        cumulativeAmount:target.cumulative_amount,bookEntryState:3,signature:operation.signature }] };
    }
    if (kind === 'stamina') {
      const target = app.store.db.prepare('SELECT * FROM stamina_reward_claim WHERE operation_id=?').get(operation.id),
        rows = structuredClone(app.store.read('UserInfo').data);
      rows[0].playerStatus.baseSP = target.sp_minimum; return { UserInfo:rows };
    }
    if (kind === 'casino') {
      const target = app.store.db.prepare('SELECT * FROM casino_reward_claim WHERE operation_id=?').get(operation.id);
      return { UserCasinoState:[{ ...seed.data.UserCasinoState[0],medalAmount:1,
        cumulativeMedalAmount:target.cumulative_amount,signature:operation.signature }] };
    }
    if (kind === 'equipment') return { UserEquipment:[equipment()] };
    if (kind === 'voice') return { UserCommunicationVoice:app.store.costumeRewards(operation).flatMap(row => row.voices
      .map(voice => ({ userId:0,voiceId:voice.voiceId,voiceState:voice.state }))) };
    if (kind === 'unit' || kind === 'boards') {
      const minimum = JSON.parse(app.store.db.prepare('SELECT targets FROM gift_pc_claim WHERE operation_id=?').get(operation.id).targets),
        { pcJobs,character,wardrobe,unitStory,...progress } = minimum;
      return kind === 'unit' ? { UserPC:[{ ...seed.data.UserPC[0],...progress,userId:seed.userId,pcId,joiningState:1 }] } :
        { UserPCJobSet:[{ userId:seed.userId,pcId,pcJobs,signature:operation.signature }] };
    }
    return { UserCharacterCostume:[{ userId:0,costumeId,costumeState:2 }] };
  };
  try {
    for (const kind of ['ordinary','stamina','casino','equipment','costume','voice','unit','boards']) for (const order of ['flags','effect']) {
      database = path.join(directory, `${kind}-${order}.sqlite`); await open();
      for (const name of ['UserGift','UserEquipment','UserCharacterCostume','UserCommunicationVoice']) put(name,[]);
      if(kind==='unit' || kind==='boards') put('UserCharacter',[]);
      const itemId = kind === 'equipment' ? 0 : ['costume','voice'].includes(kind) ? costumeId : ['unit','boards'].includes(kind) ? pcId : master.currencies[
        kind === 'ordinary' ? 'currency.valis' : kind === 'stamina' ? 'currency.stamina' : 'currency.casino_medal'];
      const gifts = [gift(1,itemId,kind === 'equipment' ? { equipmentId:weapon } : {}),
        gift(2,master.currencies['currency.gem'],{ amount:17 })], body = { userId:seed.userId,giftIds:[2,1] };
      put('UserGift',gifts);
      const pulled = { tables:['UserGift','UserCurrency','UserInfo','UserCasinoState','UserEquipment','UserCharacterCostume','UserCommunicationVoice','UserPC','UserPCJobSet','UserCharacter','UserAdventureStage'] };
      await pull(pulled); const pullIdentity = sequence;
      const reply = await send('gift/receive',body), identity = sequence, received=parse(reply),operation=received.operations[0];
      assert.deepEqual(received.operation,operation,'Every combined2000 reward class uses the same signed hot delivery');
      assert.equal(app.store.hardCurrency(),17);
      // Keep this all-class refusal matrix as a pre-capture mixed-Iris queue.
      app.store.db.prepare('UPDATE gift_claim SET iris_capture_version=0 WHERE operation_id=?').run(operation.id);
      app.store.db.prepare('DELETE FROM gift_item_claim WHERE operation_id=? AND item_id=?')
        .run(operation.id,master.currencies['currency.gem']);
      assert.deepEqual(parse(await send('gift/receive',body)).operations,[operation]);
      const flags = { UserGift:gifts.map(row=>({...row,state:1})) }, native = effects(kind,operation);
      await reject(push(flags,[operation]),400);
      for (const [table,event] of [['profile','UPDATE'],['reply_cache','INSERT'],
        ...(['costume','voice'].includes(kind) && order === 'effect' ? [['costume_reward_claim','UPDATE']] : []),
        ...(['unit','boards'].includes(kind) && order === 'effect' ? [['gift_pc_claim','UPDATE']] : [])]) {
        app.store.db.exec(`CREATE TRIGGER fail_partial BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'partial save rollback'); END`);
        await reject(push(order === 'flags' ? flags : native),503,true); app.store.db.exec('DROP TRIGGER fail_partial');
      }
      const partial = parse(await push(order === 'flags' ? flags : native));
      assert(!partial.operations.some(row=>row.id===operation.id)); assert.deepEqual(app.store.operations(),[operation]);
      assert.equal(partial.operation,undefined,'Observed2000 must not reappear through its singular alias');
      await close(); await open();
      await reject(send('gift/receive',body));
      await reject(request(port,identity,body,String(identity),'gift/receive'));
      await reject(send('user/login')); await reject(send('user_data/confirm')); await reject(send('user_data/pull',pulled));
      if (order === 'flags') {
        await reject(push({ UserGift:gifts }),400);
        await reject(push({ UserGift:[{ ...gifts[0],state:1,amount:2 }] }),400);
      } else if (kind === 'ordinary') await reject(push({ UserCurrency:[{ ...native.UserCurrency[0],cumulativeAmount:0 }] }));
      else if (kind === 'casino') await reject(push({ UserCasinoState:[{ ...native.UserCasinoState[0],cumulativeMedalAmount:0 }] }),400);
      else if (kind === 'costume') await reject(push({},[],{ UserCharacterCostume:[{ costumeId }] }),400);
      else if (kind === 'voice') {
        const saved = native.UserCommunicationVoice[0];
        await reject(push({ UserCommunicationVoice:[{ ...saved,voiceState:1 }] }),400);
        await reject(push({},[],{ UserCommunicationVoice:[{ voiceId:saved.voiceId }] }),400);
      }
      else if (kind === 'unit') await reject(push({},[],{ UserPC:[{ pcId }] }),400);
      else if (kind === 'boards') await reject(push({},[],{ UserPCJobSet:[{ pcId }] }),400);
      else if (kind === 'stamina') {
        const spent = structuredClone(native.UserInfo); spent[0].playerStatus.baseSP = 0;
        parse(await push({ UserInfo:spent })); await reject(send('gift/receive',body));
      } else {
        parse(await push({},[],{ UserEquipment:[{ slotIndex:1 }] })); await reject(send('gift/receive',body));
      }
      parse(await push(order === 'flags' ? native : flags));
      if (kind === 'costume') {
        await reject(push({},[operation]),400);
        parse(await push({ UserCommunicationVoice:app.store.costumeRewards(operation).flatMap(row=>row.voices
          .map(voice=>({ userId:0,voiceId:voice.voiceId,voiceState:voice.state }))) }));
      }
      if (kind === 'voice') {
        await reject(push({},[operation]),400);
        parse(await push({ UserCharacterCostume:[{ userId:0,costumeId,costumeState:2 }] }));
      }
      if (kind === 'unit' || kind === 'boards') {
        await reject(push({},[operation]),400);
        const record = app.store.db.prepare('SELECT * FROM gift_pc_claim WHERE operation_id=?').get(operation.id);
        assert.deepEqual(JSON.parse(record.observed),[kind]);
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM gift_pc_floor').get().n,0,'No completed minimum before ACK');
        parse(await push(effects(kind === 'unit' ? 'boards' : 'unit',operation)));
        await reject(push({},[operation]),400);
        parse(await push({ UserCharacter:rewardCharacterFixture(app.store.read('UserCharacter').data,[pcId]),
          ...rewardCostumeFixture(app.store.read('UserCharacterCostume').data,[pcId],app.store.read('UserCommunicationVoice').data),
          ...rewardUnitStoryFixture(app.store.read('UserAdventureStage').data,[pcId]) }));
      }
      for (const [table,event] of [['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'ACK rollback'); END`);
        await reject(push({},[operation]),503,true); app.store.db.exec('DROP TRIGGER fail_ack');
      }
      parse(await push({},[operation])); await close(); await open();
      assert.deepEqual(app.store.operations(),[]); assert.equal(app.store.hardCurrency(),17);
      await reject(send('gift/receive',body));
      assert.deepEqual(parse(await request(port,identity,body,String(identity),'gift/receive')),settled(received),
        'The original acknowledged request returns its popup contract without operation2000');
      await reject(request(port,pullIdentity,pulled,String(pullIdentity),'user_data/pull'));
      await reject(push({ UserGift:gifts }),400);
      parse(await push({},[],{ UserGift:gifts.map(({id})=>({id})) }));
      await pull(pulled);
      assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok'); await close();
    }
    // WRITTEN ONLY:72 pure-stamina cold contexts. Funding, gifts, native rows,
    // cap crossing and save/spend order are synthetic, not actual earning/play.
    for(const stock of [7,0x7fffffff-7]) for(const count of [1,2])
      for(const flagState of count===1?['0','1','2']:['00','01','02','10','11','12','20','21','22'])
        for(const spState of ['pending','saved','spent']) {
        database=path.join(directory,`stamina-cold-${stock}-${count}-${flagState}-${spState}.sqlite`);await open();
        const info=structuredClone(seed.data.UserInfo);info[0].playerStatus.baseSP=stock;put('UserInfo',info);
        app.store.changeHardCurrency(100);
        const gifts=Array.from({length:count},(_,index)=>gift(index+1,master.currencies['currency.stamina'],
          {amount:count===1?13:index===0?5:8})),body={userId:seed.userId,giftIds:gifts.map(row=>row.id)};
        put('UserGift',gifts);
        const issued=await send('gift/receive',body),identity=sequence,response=parse(issued),operation=response.operation,
          receipt=app.store.staminaReward(operation),native=effects('stamina',operation);
        assert.equal(receipt.amount,13);assert.equal(receipt.sp_before,stock);
        assert.equal(receipt.sp_minimum,Math.min(0x7fffffff,stock+13));assert.equal(receipt.effect_saved,0);
        const states=[...flagState],needsFlags=states.includes('0'),changedFlags=states.some(state=>state!=='0');
        if(changedFlags) parse(await push({UserGift:gifts.filter((row,index)=>states[index]!=='2')
          .map(row=>({...row,state:states[gifts.indexOf(row)]==='1'?1:0}))},[],
          {UserGift:gifts.filter((row,index)=>states[index]==='2').map(({id})=>({id}))}));
        if(spState!=='pending') parse(await push(native));
        if(spState==='spent') {
          const rows=structuredClone(native.UserInfo);rows[0].playerStatus.baseSP=9;parse(await push({UserInfo:rows}));
        }
        if(changedFlags || spState!=='pending') {
          await reject(send('gift/receive',body));await reject(request(port,identity,body,String(identity),'gift/receive'));
        }
        if(needsFlags || spState==='pending') await reject(push({},[operation]),400);
        let refill;
        if(stock===7) refill=parse(await send('currency/hard/consume',{consumeId:81041001})).operation;
        const queue=app.store.operations(),wallet=[app.store.hardCurrency(),app.store.paidCurrency()],
          stored=app.store.staminaReward(operation),profile=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
          expected={...operation,parameters:{...operation.parameters,receivedItems:spState==='pending'?operation.parameters.receivedItems:[]}};
        if(refill) {
          const purchased=app.store.fixedConsumeReceipt(refill);
          assert.equal(purchased.sp_before,spState==='pending'?receipt.sp_minimum:app.store.read('UserInfo').data[0].playerStatus.baseSP);
          assert.equal(purchased.sp_minimum,Math.min(0x7fffffff,purchased.sp_before+master.playerMaxSP[info[0].playerStatus.level]));
        }
        await close();await open();
        const cold=await send('user_data/confirm'),coldIdentity=sequence;
        assert.deepEqual(parse(cold).operations,refill?[expected,refill]:[expected]);
        assert.deepEqual(app.store.operations(),queue);assert.deepEqual(app.store.staminaReward(operation),stored);
        assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profile);
        assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
        parse(await send('user/login'));await pull({tables:['UserGift','UserInfo']});
        await close();await open();
        assert.deepEqual((await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm')).body,cold.body);
        for(const changed of [{...operation,token:'changed-token'},
          {...operation,parameters:{...operation.parameters,receivedItems:[{...operation.parameters.receivedItems[0],amount:14}]}}])
          assert.throws(()=>app.store.giftStaminaRecovery(changed),/unbound Present/);
        app.store.db.prepare('DELETE FROM stamina_reward_claim WHERE operation_id=?').run(operation.id);
        await reject(send('user_data/confirm'));await reject(send('user/login'));await reject(send('user_data/pull',{tables:['UserGift','UserInfo']}));
        app.store.db.prepare('INSERT INTO stamina_reward_claim(operation_id,amount,sp_before,sp_minimum,effect_saved) VALUES(?,?,?,?,?)')
          .run(stored.operation_id,stored.amount,stored.sp_before,stored.sp_minimum,stored.effect_saved);
        if(spState==='pending') {
          const changed=structuredClone(info);changed[0].playerStatus.baseSP=stock+1;put('UserInfo',changed);
          await reject(send('user_data/confirm'));await reject(send('user/login'));await reject(send('user_data/pull',{tables:['UserGift','UserInfo']}));
          put('UserInfo',info);
        }
        assert.deepEqual((await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm')).body,cold.body);
        const missing={...(needsFlags?{UserGift:app.store.read('UserGift').data.map(row=>({...row,state:1}))}:{}),
          ...(spState==='pending'?native:{})};
        const noReplay=parse(await push(missing));assert.ok(!noReplay.operations.some(row=>row.id===operation.id || row.id===refill?.id));
        assert.deepEqual(app.store.operations(),queue);
        if(spState==='spent') assert.equal(app.store.read('UserInfo').data[0].playerStatus.baseSP,9,'Cold recovery never renews an observed/spent grant');
        for(const [table,event] of [['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER fail_cold_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'cold ACK rollback'); END`);
          await reject(push({},[expected]),503,true);app.store.db.exec('DROP TRIGGER fail_cold_ack');
        }
        parse(await push({},[expected]));
        if(refill) {
          assert.deepEqual(parse(await send('user_data/confirm')).operations,[refill]);
          const rows=structuredClone(app.store.read('UserInfo').data);
          rows[0].playerStatus.baseSP=app.store.fixedConsumeReceipt(refill).sp_minimum;
          parse(await push({UserInfo:rows},[refill]));
        }
        await close();await open();assert.deepEqual(app.store.operations(),[]);
        assert.deepEqual([app.store.hardCurrency(),app.store.paidCurrency()],wallet);
        await reject(request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm'));
        await reject(send('gift/receive',body));
        assert.deepEqual(parse(await request(port,identity,body,String(identity),'gift/receive')),settled(response),
          'The original acknowledged stamina-Present request remains an idempotent status replay');
        await reject(push({UserGift:gifts}),400);await close();
      }
    console.log('Present shared delivery/checkpoint/retained ACK/cache/restart/rollback checks OK; native acceptance pending');
  } finally {
    await close(); const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('danmemore-gift-delivery-')); fs.rmSync(resolved,{ recursive:true,force:true });
  }
}
if (require.main === module) main().catch(error=>{ console.error(error); process.exitCode=1; });
