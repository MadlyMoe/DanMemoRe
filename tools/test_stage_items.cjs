'use strict';

// Deferred disposable-save checks. Loot telemetry below is synthetic, not
// evidence of original drop rates, native signatures or playable combat.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request, stageXpFixture } = require('./test_danmemore_server.cjs');
const seed = structuredClone(require('../data/danmemore-seed.json'));
seed.data.UserEquipmentMaterial=[...(seed.data.UserEquipmentMaterial ?? []),{
  userId:seed.userId,equipmentMaterialId:289990102,amount:2,reservedAmount:0,
  bookEntryState:1,signature:0,cumulativeAmount:2}];
seed.data.UserEventItem=[...(seed.data.UserEventItem ?? []),{
  userId:seed.userId,eventItemId:290000479,amount:1,reservedAmount:0,
  bookEntryState:1,signature:0,cumulativeAmount:1}];
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-stage-items-'));
  let app, database, port, sequence = 0, rejection;
  const open = async () => {
    app = createServer({ database, seed, master, wallNowSeconds: () => 1790866800, log: line => {
      const entry=JSON.parse(line);if(entry.event==='rejected') rejection=entry.reason;
    } });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const send = (action, body) => {rejection=undefined;return request(port, ++sequence, body, String(sequence), action);};
  const parse = reply => { assert.equal(reply.status, 200, rejection ?? reply.body.toString()); return JSON.parse(reply.body); };
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({ name }) => [name, app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const push = (putItems = {}, operations = [], deleteItems = {}) => {
    putItems = stageXpFixture(app.store,putItems,operations);
    return send('user_data/push', {
    badges: null, scripts: {}, dataTokens: {}, checksums: { before: {}, after: Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name => [name,md5(putItems[name] ?? [])])) },
    deltas: Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature: 0, trigger: 'AdventureComplete', putItems, deleteItems }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })),
    });
  };
  const unavailable = (reply,structured=true) => {
    assert.equal(reply.status, 503, rejection ?? reply.body.toString());
    structured ? assert.equal(JSON.parse(reply.body).code, OFFLINE_UNAVAILABLE_CODE) : assert.equal(reply.body.length,0);
  };
  const stageId = 1010000101101, valis = master.currencies['currency.valis'], falna = master.items['status_board_item.special'];
  const ticket = Number(Object.keys(master.itemProfiles).find(id => master.itemProfiles[id].table === 'UserGachaTicket'));
  const body = { adventureStageId: stageId, token: 'ordinary-loot', adventureStageTaskIds: [682000001,682000002],
    adventureGainedItems: [{ itemId: valis, amount: 10 }, { itemId: valis, amount: 20 },
      { itemId: falna, amount: 1 }, { itemId: ticket, amount: 1 }], friendshipStates: [],
    adventureRecord: { continueCount: 0, deathCount: 0, turnCount: 3 }, isEnemyAnnihilated: true, secretMissionCompleted: false };
  const complete = value => send('adventure/stage/complete', value);
  const clear = operation => {
    const before = operation.parameters.UserAdventureStage[0];
    return { ...before, state: 4, cumulativeClearCount: before.cumulativeClearCount + 1,
      firstCompleteDateTime: before.firstCompleteDateTime || 1790866800, lastCompleteDateTime: 1790866800,
      tasks: before.tasks.map(row => body.adventureStageTaskIds.includes(row.adventureStageTaskId) ? { ...row,state:1 } : row) };
  };
  const acquired = operation => {
    const result = {};
    for (const row of app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(operation.id)) {
      const previous = app.store.read(row.table_name).data.find(item => item[row.id_field] === row.item_id);
      (result[row.table_name] ??= []).push({ ...previous, userId: seed.userId, [row.id_field]: row.item_id,
        ...(row.table_name==='UserKeyItem' && !previous?{reservedAmount:0,bookEntryState:1,signature:0,exploit:false}:{}),
        ...(['UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial','UserEquipmentEnhanceItem','UserEquipmentEvolveItem','UserHeroSublimateItem','UserHeroSublimateUnlockItem','UserAlarmVoiceItem'].includes(row.table_name) && !previous?
          {reservedAmount:0,bookEntryState:1,signature:0}:{}),
        ...(row.table_name==='UserAdventureTicket' && !previous?{lastResetAt:0,bookEntryState:1,signature:0}:{}),
        ...(row.table_name==='UserMemoriaExpItem' && !previous?{lastAquiredAt:0,reservedAmount:0,bookEntryState:1,signature:0}:{}),
        ...(row.table_name==='UserLimitBreakItem' && !previous?{bookEntryState:1,signature:0}:{}),
        cumulativeAmount: row.cumulative_amount, ...(row.table_name === 'UserGachaTicket' ?
          {dateList:[],signature:operation.signature,bookEntryState:!previous || previous.bookEntryState===1?3:previous.bookEntryState} : { amount: 0 }) });
    }
    return result;
  };
  try {
    for (const order of ['items','clear']) {
      database = path.join(directory, `${order}.sqlite`); await open();
      const pullBody = { tables: ['UserAdventureStage','UserCurrency'] };
      assert.equal((await send('user_data/pull', pullBody)).status, 200); const pullIdentity = sequence;
      for (const itemId of [1,master.currencies['currency.gem'],master.currencies['currency.stamina'],master.currencies['currency.casino_medal']]) {
        const before = snapshot(); unavailable(await complete({ ...body,token:'unsupported-loot',adventureGainedItems:[{ itemId,amount:1 }] }));
        assert.equal(snapshot(), before, 'Unknown native providers cannot leave an unfulfillable queued reward');
      }
      // WRITTEN ONLY / NOT RUN: both item fields are native signed int32.
      for (const item of [{itemId:valis,amount:0x80000000},{itemId:0x80000000,amount:1}]) {
        const before=snapshot(); assert.equal((await complete({...body,adventureGainedItems:[item]})).status,400);
        assert.equal(snapshot(),before,'Out-of-range native loot cannot issue a stage operation');
      }
      // WRITTEN ONLY / NOT RUN: battle-record counters are native signed int32.
      {
        const before=snapshot(); assert.equal((await complete({...body,adventureRecord:{...body.adventureRecord,turnCount:0x80000000}})).status,400);
        assert.equal(snapshot(),before,'Out-of-range native battle record cannot issue a stage operation');
      }
      for (const table of ['stage_delivery','pve_item_claim','stage_completion','stage_reward','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_stage_issue BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'stage issue rollback'); END`);
        const before = snapshot(); unavailable(await complete(body),false); assert.equal(snapshot(), before);
        app.store.db.exec('DROP TRIGGER fail_stage_issue');
      }
      const reply = await complete(body), identity = sequence, operation = parse(reply).operation;
      assert.equal(operation.type, 5000);
      assert.equal(operation.parameters.gainedItems.find(row => row.itemId === valis).amount,
        master.stages[stageId].rewardAmount + 30, 'Archived first-clear Valis and telemetry merge once');
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM pve_item_claim WHERE operation_id=?').get(operation.id).n, 3);
      assert.deepEqual(parse(await complete(body)).operation, operation, 'Only unobserved exact retries can deliver');
      const capture = app.store.db.prepare('SELECT * FROM stage_delivery WHERE operation_id=?').get(operation.id);
      for (const [column,value] of [['operation_json','{}'],['pc_before','{}'],['record_before','not-json'],['observed','["unknown"]']]) {
        app.store.db.prepare(`UPDATE stage_delivery SET ${column}=? WHERE operation_id=?`).run(value,operation.id);
        const before = snapshot(); unavailable(await complete(body)); assert.equal(snapshot(), before);
        assert.deepEqual(app.store.operations(), [operation], 'Corrupt proof does not erase a queued award');
        app.store.db.prepare(`UPDATE stage_delivery SET ${column}=? WHERE operation_id=?`).run(capture[column],operation.id);
      }
      const target = app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=? AND item_id=?').get(operation.id,valis);
      app.store.db.prepare('DELETE FROM pve_item_claim WHERE operation_id=? AND item_id=?').run(operation.id,valis);
      const missing = snapshot(); unavailable(await complete(body)); assert.equal(snapshot(), missing);
      app.store.db.prepare('INSERT INTO pve_item_claim(operation_id,item_id,table_name,id_field,cumulative_amount) VALUES(?,?,?,?,?)')
        .run(target.operation_id,target.item_id,target.table_name,target.id_field,target.cumulative_amount);
      const saved = clear(operation), inventory = acquired(operation), stages=[saved],
        unlock=JSON.parse(capture.next_unlock);
      if(unlock?.stageId && [null,0].includes(unlock.beforeState) && unlock.lowerStates.every(([,state])=>state===4))
        stages.push({...app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===unlock.stageId),
          userId:seed.userId,adventureStageId:unlock.stageId,state:1});
      let before = snapshot();
      assert.equal((await push({ UserAdventureStage: stages }, [operation])).status, 400, 'Clear flags cannot discard loot');
      assert.equal(snapshot(), before);
      for (const changes of [{ userId: seed.userId + 1 }, { cumulativeAmount: inventory.UserCurrency[0].cumulativeAmount - 1 },
        { cumulativeAmount: '1' }, { amount: -1 }]) {
        assert.equal((await push({ ...inventory, UserAdventureStage: stages,
          UserCurrency: [{ ...inventory.UserCurrency[0],...changes }] }, [operation])).status, 400);
        assert.equal(snapshot(), before);
      }
      app.store.db.exec("CREATE TRIGGER fail_stage_observe BEFORE UPDATE ON stage_delivery BEGIN SELECT RAISE(ABORT,'observation rollback'); END");
      unavailable(await push(order === 'items' ? inventory : { UserAdventureStage: stages }),false); assert.equal(snapshot(), before);
      app.store.db.exec('DROP TRIGGER fail_stage_observe');
      const partial = parse(await push(order === 'items' ? inventory : { UserAdventureStage: stages }));
      assert(!partial.operations.some(row => row.id === operation.id), 'Do not redeliver additive effects on a split-save reply');
      assert.deepEqual(app.store.operations(), [operation], 'Omission is not a fake ACK');
      await close(); await open(); before = snapshot();
      unavailable(await complete(body));
      unavailable(await request(port, identity, body, String(identity), 'adventure/stage/complete'));
      unavailable(await send('user_data/confirm')); unavailable(await send('user/login'));
      unavailable(await send('user_data/pull', pullBody)); assert.equal(snapshot(), before);
      assert.equal((await push(order === 'items' ? { UserCurrency: [{ ...inventory.UserCurrency[0],cumulativeAmount:0 }] }
        : { UserAdventureStage: operation.parameters.UserAdventureStage })).status, 400);
      assert.equal(snapshot(), before, 'Observed effects cannot be restored to pre-award values');
      parse(await push(order === 'items' ? { UserAdventureStage: stages } : inventory));
      for (const [table,event] of [['stage_state_floor','INSERT'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_stage_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'stage ACK rollback'); END`);
        before = snapshot(); unavailable(await push({}, [operation]),false); assert.equal(snapshot(), before);
        app.store.db.exec('DROP TRIGGER fail_stage_ack');
      }
      parse(await push({}, [operation])); await close(); await open(); before = snapshot();
      assert.equal(app.store.operations().length, 0);
      unavailable(await request(port, identity, body, String(identity), 'adventure/stage/complete'));
      unavailable(await complete(body));
      unavailable(await request(port, pullIdentity, pullBody, String(pullIdentity), 'user_data/pull'));
      assert.equal(snapshot(), before);
      for (const [putItems,deleteItems] of [
        [{ UserAdventureStage: operation.parameters.UserAdventureStage },{}],
        [{ UserAdventureStage: [{ ...saved,tasks:operation.parameters.UserAdventureStage[0].tasks }] },{}],
        [{},{ UserAdventureStage:[{ adventureStageId:stageId }] }],
        [{ UserCurrency:[{ ...inventory.UserCurrency[0],cumulativeAmount:0 }] },{}],
        [{},{ UserGachaTicket:[{ gachaTicketId:ticket }] }],
      ]) { assert.equal((await push(putItems, [], deleteItems)).status, 400); assert.equal(snapshot(), before); }
      parse(await push(inventory)); // Spending all stock is valid when acquisition proof survives.
      const next = parse(await complete({ ...body,token:'ordinary-repeat' })).operation;
      assert.equal(next.parameters.gainedItems.find(row => row.itemId === valis).amount, 30, 'Never reissue first-clear Valis');
      parse(await push({ ...acquired(next),UserAdventureStage:[clear(next)] }, [next]));
      // WRITTEN ONLY / NOT RUN: the original gain(0) still signs an owned material row.
      const zeroItem=289990102,zeroBody={...body,token:'original-zero-item',adventureStageTaskIds:[],
        adventureGainedItems:[{itemId:zeroItem,amount:0}]};
      assert(master.battleDropPools[285013720].some(([id,amount,rate])=>id===zeroItem && amount===0 && rate>0));
      for(const itemId of [1,master.currencies['currency.gem']]) {
        const unchanged=snapshot(); unavailable(await complete({...zeroBody,adventureGainedItems:[{itemId,amount:0}]}));
        assert.equal(snapshot(),unchanged,'Unknown, special or unproved zero-result items cannot issue a stage operation');
      }
      app.store.db.exec(`CREATE TRIGGER fail_zero_claim BEFORE INSERT ON stage_zero_item_claim
        BEGIN SELECT RAISE(ABORT,'zero claim rollback'); END`);
      const beforeZero=snapshot();unavailable(await complete(zeroBody),false);
      assert.equal(snapshot(),beforeZero,'Zero callback capture must roll back its whole stage issue');
      app.store.db.exec('DROP TRIGGER fail_zero_claim');
      const zero=parse(await complete(zeroBody)).operation;
      assert.deepEqual(zero.parameters.gainedItems,[{itemId:zeroItem,amount:0}]);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM pve_item_claim WHERE operation_id=?').get(zero.id).n,0);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_zero_item_claim WHERE operation_id=?').get(zero.id).n,1);
      assert.throws(()=>app.store.itemAcquisitionReservation(zeroItem,2),/Finish the signed zero-item callback/,
        'A later material gain cannot overtake the unsigned pending setter');
      assert.equal((await push({UserAdventureStage:[clear(zero)]},[zero])).status,400,
        'The stage cannot ACK before its zero-quantity signed setter saves');
      const material=app.store.read('UserEquipmentMaterial').data.map(row=>row.equipmentMaterialId===zeroItem?
        {...row,bookEntryState:3,signature:zero.signature}:row);
      parse(await push({UserEquipmentMaterial:material}));
      assert.equal(material.find(row=>row.equipmentMaterialId===zeroItem).amount,2,
        'Zero gain must not mint material stock');
      assert.deepEqual(app.store.stageColdRecovery(zero).parameters.gainedItems,[],
        'A cold callback must not reapply the saved zero setter');
      const zeroClaim=app.store.db.prepare('SELECT before_json FROM stage_zero_item_claim WHERE operation_id=?')
        .get(zero.id).before_json;
      app.store.db.prepare('UPDATE stage_zero_item_claim SET before_json=? WHERE operation_id=?')
        .run('{}',zero.id);
      assert.throws(()=>app.store.stageColdRecovery(zero),/Zero-quantity stage item differs/,
        'A changed original stock capture cannot waive the signed callback');
      app.store.db.prepare('UPDATE stage_zero_item_claim SET before_json=? WHERE operation_id=?')
        .run(zeroClaim,zero.id);
      parse(await push({UserAdventureStage:[clear(zero)]},[zero]));
      assert.equal(app.store.operations().length,0,'Zero-result stage must settle without an invented item grant');
      assert.doesNotThrow(()=>app.store.itemAcquisitionReservation(zeroItem,2),
        'The signed callback must release later material acquisitions after ACK');
      const eventItem=290000479,eventBody={...zeroBody,token:'original-zero-event-item',
        adventureGainedItems:[{itemId:eventItem,amount:0}]};
      assert(master.battleDropPools[285024776].some(([id,amount,rate])=>id===eventItem && amount===0 && rate>0));
      const eventZero=parse(await complete(eventBody)).operation;
      assert.deepEqual(eventZero.parameters.gainedItems,[{itemId:eventItem,amount:0}]);
      assert.throws(()=>app.store.itemAcquisitionReservation(eventItem,1),/Finish the signed zero-item callback/);
      assert.equal((await push({UserAdventureStage:[clear(eventZero)]},[eventZero])).status,400,
        'The event-item stage cannot ACK before its signed setter saves');
      const eventRows=app.store.read('UserEventItem').data.map(row=>row.eventItemId===eventItem?
        {...row,signature:eventZero.signature}:row);
      parse(await push({UserEventItem:eventRows}));
      assert.equal(eventRows.find(row=>row.eventItemId===eventItem).amount,1,
        'Zero gain must not mint event-item stock');
      assert.equal(eventRows.find(row=>row.eventItemId===eventItem).bookEntryState,1,
        'The native event-item book setter is a no-op');
      assert.deepEqual(app.store.stageColdRecovery(eventZero).parameters.gainedItems,[],
        'A saved event-item zero setter must not run twice on cold delivery');
      parse(await push({UserAdventureStage:[clear(eventZero)]},[eventZero]));
      assert.doesNotThrow(()=>app.store.itemAcquisitionReservation(eventItem,1));
      assert.equal(app.store.hardCurrency(), 2, 'Objective Iris stays once-only');
      assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
      await close();
    }
    // WRITTEN ONLY / NOT RUN: gain(0) constructs each missing native row before signing it.
    seed.data.UserEventItem=[];
    seed.data.UserEquipmentMaterial=seed.data.UserEquipmentMaterial.filter(row=>row.equipmentMaterialId!==289990102);
    database=path.join(directory,'event-item-first.sqlite');await open();
    const eventItem=290000479,freshBody={...body,token:'original-zero-event-item-first',
      adventureGainedItems:[{itemId:eventItem,amount:0}]};
    const first=parse(await complete(freshBody)).operation;
    assert.equal(app.store.db.prepare('SELECT before_json FROM stage_zero_item_claim WHERE operation_id=? AND item_id=?')
      .get(first.id,eventItem).before_json,'null');
    const created={userId:seed.userId,eventItemId:eventItem,amount:0,reservedAmount:0,
      bookEntryState:1,signature:first.signature,cumulativeAmount:0};
    assert.equal((await push({UserAdventureStage:[clear(first)]},[first])).status,400,
      'A missing event-item row must not be acknowledged before native construction');
    parse(await push({UserEventItem:[created]}));
    assert.deepEqual(app.store.stageColdRecovery(first).parameters.gainedItems.filter(row=>row.itemId===eventItem),[],
      'Cold replay omits only the fully constructed signed zero item');
    const firstCapture=app.store.db.prepare('SELECT next_unlock FROM stage_delivery WHERE operation_id=?').get(first.id),
      firstUnlock=JSON.parse(firstCapture.next_unlock),firstStages=[clear(first)];
    if(firstUnlock?.stageId && [null,0].includes(firstUnlock.beforeState) &&
        firstUnlock.lowerStates.every(([,state])=>state===4))
      firstStages.push({...app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===firstUnlock.stageId),
        userId:seed.userId,adventureStageId:firstUnlock.stageId,state:1});
    parse(await push({...acquired(first),UserAdventureStage:firstStages},[first]));
    assert.equal(app.store.operations().length,0,'The constructed zero event item settles with the full original stage');
    const materialItem=289990102,materialBody={...freshBody,token:'original-zero-material-first',
      adventureStageTaskIds:[],adventureGainedItems:[{itemId:materialItem,amount:0}]};
    const firstMaterial=parse(await complete(materialBody)).operation;
    assert.equal(app.store.db.prepare('SELECT before_json FROM stage_zero_item_claim WHERE operation_id=? AND item_id=?')
      .get(firstMaterial.id,materialItem).before_json,'null');
    const createdMaterial={userId:seed.userId,equipmentMaterialId:materialItem,amount:0,reservedAmount:0,
      bookEntryState:3,signature:firstMaterial.signature,cumulativeAmount:0};
    assert.equal((await push({UserAdventureStage:[clear(firstMaterial)]},[firstMaterial])).status,400,
      'A missing material row must not be acknowledged before native construction');
    parse(await push({UserEquipmentMaterial:[createdMaterial]}));
    assert.deepEqual(app.store.stageColdRecovery(firstMaterial).parameters.gainedItems,[],
      'Cold replay omits the fully constructed signed zero material');
    parse(await push({UserAdventureStage:[clear(firstMaterial)]},[firstMaterial]));
    assert.equal(app.store.operations().length,0,'The constructed zero material settles without stock or lifetime gain');
    await close();
    console.log('Ordinary stage inventory, split-save delivery, retained ACK proof, indexed floors, replay/restart and rollback checks OK; native acceptance pending');
  } finally { await close(); fs.rmSync(directory, { recursive:true,force:true }); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
