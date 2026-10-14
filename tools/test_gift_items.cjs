'use strict';

// Synthetic inventory/save probes; no native grant, gift provenance,
// expired-ticket policy or subscription-service activation proof is implied.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
const special = new Set(['currency.gem','currency.stamina','currency.casino_medal'].map(key => master.currencies[key]));
const types = new Map();
const stockCapTables=new Set(['UserStatusBoardItem','UserCpItem','UserExpItem','UserEquipmentMaterial','UserVoteItem','UserStaminaTicket','UserKeyItem',
  'UserEquipmentEnhanceItem','UserEquipmentEvolveItem','UserLockAbilityItem','UserHeroSublimateItem','UserHeroSublimateUnlockItem','UserAdventureTicket','UserMemoriaExpItem','UserAlarmVoiceItem','UserLimitBreakItem','UserGeneralLimitBreakItem']);
for (const [id, profile] of Object.entries(master.itemProfiles))
  // Dedicated ticket/Alliance Medal fixtures cover guarded season/cap/stock/SP handoffs;
  //this generic probe's arbitrary spend without an attempt save is invalid there.
  if (!['UserSerialPvpSpTicketItem','UserUnionRaidMedal','UserUnionRaidBossSpTicketItem','UserUnionRaidNormalSpTicketItem']
    .includes(profile.table) && !special.has(Number(id)) && !types.has(profile.table))
    types.set(profile.table, Number(id));

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-gift-items-')), realNow = Date.now;
  let database, app, port, sequence = 0, now = 1686794400, lastLog='';
  Date.now = () => now * 1000;
  const open = async () => {
    app = createServer({ database, seed, master, log: line => { lastLog=line; } });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const fresh = async name => { await close(); database = path.join(directory, `${name}.sqlite`); await open(); };
  const send = (action, value) => request(port, ++sequence, value, String(sequence), action);
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows), md5(rows), name);
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name, app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all()]));
  const pushBody = (putItems = {}, operations = [], deleteItems = {}) => ({
    badges: null, scripts: {}, dataTokens: {}, checksums: { before: {}, after: Object.fromEntries(
      [...new Set([...Object.keys(putItems), ...Object.keys(deleteItems)])].map(name => [name, md5(putItems[name] ?? [])])) },
    deltas: Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature: 0, trigger: 'GiftReceive', putItems, deleteItems }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })),
  });
  const push = (...args) => send('user_data/push',pushBody(...args));
  const gift = (id, itemId, amount) => ({ userId: seed.userId, id, itemId, amount, title: 'Synthetic saved present', message: '',
    senderType: 1, senderId: 0, giftAcquiredType: 2, itemLevel: 0, equipmentId: 0, equipmentEvolveCount: 0,
    pcLimitBreakCount: 0, pcHeroSublimateCount: 0, state: 0, startAt: now, expireAt: now + 100, createdAt: now, dynamodbExpireAt: 0 });
  const receive = gifts => send('gift/receive', { userId: seed.userId, giftIds: gifts.map(row => row.id) });
  const itemRow = (id, cumulative, amount = 0) => {
    const { table, idField } = master.itemProfiles[id];
    return { userId: seed.userId, [idField]: id, cumulativeAmount: cumulative, bookEntryState: 3,
      signature: table==='UserLockAbilityItem'?0xffffffff:0,
      ...(['UserGachaTicket','UserPCTicket','UserSubscriptionTicket'].includes(table) ? { dateList: Array.from({ length: amount }, () =>
        ({ aquiredAt: now,...(table === 'UserSubscriptionTicket' ? { expireAt:now+master.subscriptionTickets[id].duration } : {}) })) } : { amount }),
      ...(['UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial','UserCurrency','UserLockAbilityItem','UserKeyItem','UserVoteItem','UserStaminaTicket',
        'UserEquipmentEnhanceItem','UserEquipmentEvolveItem','UserHeroSublimateItem','UserHeroSublimateUnlockItem','UserMemoriaExpItem','UserAlarmVoiceItem'].includes(table) ? { reservedAmount: 0 } : {}),
      ...(table==='UserKeyItem'?{exploit:false}:{}),
      ...(table==='UserAdventureTicket'?{lastResetAt:0}:{}),...(table==='UserMemoriaExpItem'?{lastAquiredAt:0}:{}) };
  };
  const unavailable = response => {
    assert.equal(response.status, 503); assert.equal(JSON.parse(response.body).code, OFFLINE_UNAVAILABLE_CODE);
    assert.equal(response.headers['x-argo-server-response-code'], String(OFFLINE_UNAVAILABLE_CODE));
  };
  try {
    assert.equal(types.size, 24);
    assert.equal(types.get('UserLockAbilityItem'),220000001);
    for (const [name, id] of types) {
      console.log(`Present item fixture: ${name}`);
      now = 1686794400; await fresh(name);
      const gifts = [gift(1, id, 2), gift(2, id, 3)], baseline = itemRow(id, 11, 7);
      put('UserGift', gifts); put(name, [baseline]);
      //WRITTEN ONLY / NOT RUN: native row validation also applies without a pending reward.
      if(['UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial','UserAlarmVoiceItem'].includes(name)) {
        const missing=structuredClone(baseline);delete missing.reservedAmount;
        for(const rows of [[missing],[{...baseline,voiceId:id}],[{...baseline,signature:0x100000000}],
          [{...baseline,bookEntryState:256}],[{...baseline,[master.itemProfiles[id].idField]:0}],[baseline,baseline]]) {
          const before=snapshot();assert.equal((await push({[name]:rows})).status,400);assert.equal(snapshot(),before);
        }
      }
      if(['UserLimitBreakItem','UserGeneralLimitBreakItem'].includes(name)) {
        const missing=structuredClone(baseline);delete missing.signature;
        for(const rows of [[missing],[{...baseline,reservedAmount:0}],[{...baseline,signature:0x100000000}],
          [{...baseline,bookEntryState:256}],[{...baseline,limitBreakItemId:0}],[baseline,baseline]]) {
          const before=snapshot();assert.equal((await push({[name]:rows})).status,400);assert.equal(snapshot(),before);
        }
      }
      for (const changes of [{ userId: 2 }, { cumulativeAmount: -1 }, { cumulativeAmount: '11' },
        ...(['UserGachaTicket','UserPCTicket'].includes(name) || stockCapTables.has(name) || name==='UserCurrency' && id===master.currencies['currency.valis']
          ?[]:[{ cumulativeAmount:999999999 }]),
        ...(['UserGachaTicket','UserPCTicket','UserSubscriptionTicket'].includes(name) ? [{ dateList: null }] : [{ amount: -1 }]),
        ...(name === 'UserSubscriptionTicket' ? [{ amount:7 },{ dateList:[{ aquiredAt:now }] }] : []),
        ...(name === 'UserLockAbilityItem' ? [{ lockAbilityItemId:id },{ reservedAmount:-1 },{ reservedAmount:'0' },
          { reservedAmount:1000000000 },{ bookEntryState:-1 },{ bookEntryState:256 },
          { signature:-1 },{ signature:0x100000000 },{ signature:'0' },{ dateList:[] },{lastResetAt:0}] : []),
        ...(['UserEquipmentEnhanceItem','UserEquipmentEvolveItem'].includes(name)?[
          {[name==='UserEquipmentEnhanceItem'?'equipmentEnhanceItemId':'equipmentEvolveItemId']:id},
          {reservedAmount:-1},{reservedAmount:'0'},{reservedAmount:1000000000},
          {bookEntryState:-1},{bookEntryState:256},{signature:-1},{signature:0x100000000},{lastResetAt:0},{dateList:[]}]:[]),
        ...(['UserHeroSublimateItem','UserHeroSublimateUnlockItem'].includes(name)?[
          {[name==='UserHeroSublimateItem'?'heroSublimateUnlockItemId':'heroSublimateItemId']:id},{reservedAmount:-1},{reservedAmount:'0'},
          {reservedAmount:1000000000},{bookEntryState:-1},{bookEntryState:256},{signature:-1},
          {signature:0x100000000},{signature:'0'},{lastResetAt:0},{dateList:[]}]:[]),
        ...(name==='UserAdventureTicket'?[{lastResetAt:-1},{lastResetAt:'0'},{reservedAmount:0},{dateList:[]},
          {bookEntryState:-1},{bookEntryState:256},{signature:-1},{signature:0x100000000},{signature:'0'}]:[]),
        ...(name==='UserAlarmVoiceItem'?[{voiceId:id},{reservedAmount:-1},{reservedAmount:'0'},{reservedAmount:1000000000},
          {bookEntryState:-1},{bookEntryState:256},{signature:-1},{signature:0x100000000},{signature:'0'},
          {lastResetAt:0},{lastAquiredAt:0},{dateList:[]}]:[]),
        ...(['UserLimitBreakItem','UserGeneralLimitBreakItem'].includes(name)?[{bookEntryState:undefined},{bookEntryState:-1},{bookEntryState:256},
          {signature:undefined},{signature:-1},{signature:0x100000000},{signature:'0'},{reservedAmount:0},
          {lastResetAt:0},{lastAquiredAt:0},{dateList:[]},{generalLimitBreakItemId:id}]:[]),
        ...(name==='UserKeyItem'?[{exploit:'true'},{reservedAmount:-1},{bookEntryState:128},{signature:0x100000000},{lastResetAt:0}]:[])]) {
        put(name, [{ ...baseline, ...changes }]); const before = snapshot();
        const invalid=await receive(gifts);
        if(['UserPCTicket','UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial','UserGeneralLimitBreakItem'].includes(name) ||
          name==='UserKeyItem' && changes.cumulativeAmount!==999999999) unavailable(invalid);
        else assert.equal(invalid.status, 400,`${name} ${JSON.stringify(changes)} ${lastLog}`);
        assert.equal(snapshot(), before);
      }
      put(name, [baseline, baseline]); const duplicate = snapshot();
      const duplicated=await receive(gifts);
      if(['UserPCTicket','UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial','UserGeneralLimitBreakItem','UserKeyItem'].includes(name)) unavailable(duplicated); // Shared native identity read guards.
      else assert.equal(duplicated.status,400,`${name} duplicate ${lastLog}`);
      assert.equal(snapshot(), duplicate); put(name, [baseline]);
      if(['UserLockAbilityItem','UserEquipmentEnhanceItem','UserEquipmentEvolveItem','UserHeroSublimateItem','UserHeroSublimateUnlockItem','UserAlarmVoiceItem'].includes(name)) {
        const missing=structuredClone(baseline);delete missing.reservedAmount;put(name,[missing]);
        const before=snapshot();assert.equal((await receive(gifts)).status,400);assert.equal(snapshot(),before);put(name,[baseline]);
      }
      if(name==='UserAdventureTicket') {
        const missing=structuredClone(baseline);delete missing.lastResetAt;put(name,[missing]);
        const before=snapshot();assert.equal((await receive(gifts)).status,400);assert.equal(snapshot(),before);put(name,[baseline]);
      }
      for (const table of ['operation_queue','gift_item_claim','gift_claim','gift_receive_request','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_present BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'present rollback'); END`);
        const before = snapshot(); assert.equal((await receive(gifts)).status, 503); assert.equal(snapshot(), before);
        app.store.db.exec('DROP TRIGGER fail_present');
      }
      const response = await receive(gifts), identity = sequence, result = parse(response), operation = result.operations[0];
      assert.equal(operation.type, 2000); assert.deepEqual(result.receivedItems, [{ itemId: id, amount: 5 }]);
      assert.deepEqual(app.store.read(name).data, [baseline], 'No pre-published native inventory');
      const target = app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=?').get(operation.id);
      assert.equal(target.amount, 5); assert.equal(target.cumulative_amount, 16); assert.equal(target.table_name, name);
      const received = gifts.map(row => ({ ...row, state: 1 }));
      parse(await push({ UserGift: received }));
      const flags = snapshot(); assert.equal((await push({}, [operation])).status, 400); assert.equal(snapshot(), flags);
      await close(); await open(); now += 1000;
      unavailable(await receive(gifts));
      unavailable(await request(port, identity, { userId: seed.userId, giftIds: [1,2] }, String(identity), 'gift/receive'));
      assert.deepEqual(app.store.operations(), [operation], 'Split flags suppress redelivery, not the actual queued grant');
      const acquired = {...itemRow(id, 16, 12),...(['UserPCTicket','UserGachaTicket'].includes(name)?{
        signature:operation.signature,dateList:[...baseline.dateList,...Array.from({length:5},()=>({aquiredAt:now}))]}:{})};
      for (const changes of [{ userId: 2 }, { cumulativeAmount: 15 }, { cumulativeAmount: '16' },
        ...(['UserGachaTicket','UserPCTicket','UserSubscriptionTicket'].includes(name) ? [{ dateList: [{ aquiredAt: '1' }] }] : [{ amount: -1 }]),
        ...(name==='UserLockAbilityItem' ? [{ lockAbilityItemId:id },{ reservedAmount:-1 },{ bookEntryState:-1 },
          { bookEntryState:256 },{ signature:-1 },{ signature:0x100000000 }] : []),
        ...(['UserHeroSublimateItem','UserHeroSublimateUnlockItem'].includes(name)?[
          {[name==='UserHeroSublimateItem'?'heroSublimateUnlockItemId':'heroSublimateItemId']:id},{reservedAmount:-1},{bookEntryState:-1},
          {bookEntryState:256},{signature:-1},{signature:0x100000000},{lastResetAt:0},{dateList:[]}]:[]),
        ...(name==='UserAdventureTicket'?[{lastResetAt:-1},{lastResetAt:'0'},{reservedAmount:0},{dateList:[]},
          {bookEntryState:-1},{bookEntryState:256},{signature:-1},{signature:0x100000000}]:[]),
        ...(name==='UserKeyItem'?[{exploit:'true'},{reservedAmount:-1},{bookEntryState:128},{signature:0x100000000},{lastResetAt:0}]:[])]) {
        const before = snapshot(), rejected = await push({ [name]: [{ ...acquired, ...changes }] }, [operation]);
        // The shared membership-stock guard cancels malformed dated inventory before gift ACK validation.
        if (name === 'UserSubscriptionTicket' && (changes.userId === 2 ||
            typeof changes.cumulativeAmount === 'string' || changes.dateList)) unavailable(rejected);
        else assert.equal(rejected.status, 400, `${name} ${JSON.stringify(changes)} ${lastLog}`);
        assert.equal(snapshot(), before);
      }
      parse(await push({ [name]: [acquired] })); await close(); await open();
      app.store.db.exec("CREATE TRIGGER fail_present_ack BEFORE INSERT ON operation_done BEGIN SELECT RAISE(ABORT,'present ack rollback'); END");
      const beforeAck = snapshot(); assert.equal((await push({}, [operation])).status, 503); assert.equal(snapshot(), beforeAck);
      app.store.db.exec('DROP TRIGGER fail_present_ack'); parse(await push({}, [operation]));
      parse(await push({ [name]: [{...itemRow(id, 16),...(['UserPCTicket','UserGachaTicket'].includes(name)?{signature:operation.signature}:{})}] })); // Spending is not a lifetime acquisition rewind.
      for (const [puts, deletes] of [[{ [name]: [itemRow(id, 15)] }, {}], [{}, { [name]: [{ [master.itemProfiles[id].idField]: id }] }]]) {
        const before = snapshot(); assert.equal((await push(puts, [], deletes)).status, 400); assert.equal(snapshot(), before);
      }
      app.store.beginSession(); await close(); await open(); put('UserGift', gifts.map(row => ({ ...row, expireAt: 0 })));
      const once = snapshot(); unavailable(await receive(gifts)); assert.equal(snapshot(), once);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM gift_item_claim').get().n, 1);
      now = 1686794400; await fresh(`${name}-absent`); put('UserGift', gifts); put(name, []);
      const firstAcquisition = parse(await receive(gifts)).operations[0];
      assert.deepEqual(app.store.read(name).data, [], 'An absent item stays absent until native gain creates it');
      assert.equal(app.store.db.prepare('SELECT cumulative_amount FROM gift_item_claim').get().cumulative_amount, 5);
      parse(await push({ UserGift: gifts.map(row => ({ ...row, state: 1 })),
        [name]: [{...itemRow(id, 5, 5),...(['UserPCTicket','UserGachaTicket'].includes(name)?{signature:firstAcquisition.signature}:{})}] }, [firstAcquisition]));
    }

    // WRITTEN ONLY / NOT RUN: item-first cold recovery from an absent row.
    // Every authentic generic Present family retains flags and the real ACK;
    // only a fully saved additive item is removed from operation2000.
    let absentCold=0,ordinaryCold=0,partialOrdinary=0,corruptedOrdinary=false;
    for(const [name,id] of types) {
      now=1686794400;await fresh(`absent-cold-${name}`);
      const gifts=[gift(1,id,2),gift(2,id,3)],received=gifts.map(row=>({...row,state:1}));
      put('UserGift',gifts);put(name,[]);
      const response=await receive(gifts),identity=sequence,operation=parse(response).operation,
        target=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=?').get(operation.id),
        dated=['UserPCTicket','UserGachaTicket'].includes(name),
        acquired={...itemRow(id,5,5),...(dated?{signature:operation.signature}:{})};
      assert.equal(target.cumulative_amount,5);assert.equal(target.amount,5);assert.equal(target.cap_version,dated?1:0);
      parse(await push({[name]:[acquired]}));await close();await open();
      if(!dated && !corruptedOrdinary) {
        const before=snapshot();app.store.db.prepare('UPDATE gift_item_claim SET cap_version=1 WHERE operation_id=?').run(operation.id);
        unavailable(await send('user_data/confirm'));app.store.db.prepare('UPDATE gift_item_claim SET cap_version=0 WHERE operation_id=?').run(operation.id);
        assert.equal(snapshot(),before);corruptedOrdinary=true;
      }
      const queueBefore=app.store.operations(),savedBefore=app.store.read(name),coldResponse=await send('user_data/confirm'),
        coldIdentity=sequence,cold=parse(coldResponse).operations.find(row=>row.id===operation.id);
      assert.deepEqual(cold.parameters.receivedItems,[]);assert.deepEqual(cold.parameters.UserGift,gifts);
      assert.deepEqual(app.store.operations(),queueBefore);assert.deepEqual(app.store.read(name),savedBefore);
      unavailable(await request(port,identity,{userId:seed.userId,giftIds:[1,2]},String(identity),'gift/receive'));
      const early=snapshot();assert.equal((await push({},[cold])).status,400);assert.equal(snapshot(),early);
      parse(await push({UserGift:received}));parse(await push({},[cold]));await close();await open();
      assert.equal(app.store.operations().length,0);assert.deepEqual(app.store.read(name),savedBefore);
      unavailable(await request(port,coldIdentity,undefined,String(coldIdentity),'user_data/confirm'));
      for(const [puts,deletes] of [[{[name]:[{...acquired,cumulativeAmount:4,...(dated?{dateList:acquired.dateList.slice(0,4)}:{amount:4})}]},{}],
        [{},{[name]:[{[master.itemProfiles[id].idField]:id}]}]]) {
        const before=snapshot();assert.equal((await push(puts,[],deletes)).status,400);assert.equal(snapshot(),before);
      }
      absentCold++;
      if(target.cap_version===0) {
        ordinaryCold++;
        now=1686794400;await fresh(`absent-partial-${name}`);put('UserGift',gifts);put(name,[]);
        const partialOperation=parse(await receive(gifts)).operation,
          partial={...itemRow(id,2,2),...(['UserPCTicket','UserGachaTicket'].includes(name)?{signature:partialOperation.signature}:{})};
        assert.equal(app.store.db.prepare('SELECT cap_version FROM gift_item_claim WHERE operation_id=?').get(partialOperation.id).cap_version,0);
        put(name,[partial]);await close();await open();const before=snapshot();
        unavailable(await send('user_data/confirm'));assert.equal(snapshot(),before);assert.deepEqual(app.store.operations(),[partialOperation]);
        partialOrdinary++;
      }
    }
    assert.equal(absentCold,24);assert.equal(ordinaryCold,22);assert.equal(partialOrdinary,22);assert.equal(corruptedOrdinary,true);

    //WRITTEN ONLY / NOT RUN:248d47c forwards the actual2000 signature; capped lifetime alone cannot prove a dated grant.
    for(const key of ['gacha_ticket.normal','gacha_ticket.character_3']) for(const cumulative of [999999994,999999998,999999999])
      for(const order of ['flags-first','append-first','signature-first','pruned-first','expired-before-save','empty-before','together']) {
      now=1686794400;const id=master.items[key],duration=master.lotteryTickets[id];
      assert.ok(id && duration>0 && master.itemProfiles[id].table==='UserGachaTicket');
      await fresh(`capped-${id}-${cumulative}-${order}`);
      const gifts=[gift(1,id,2),gift(2,id,3)],received=gifts.map(row=>({...row,state:1})),
        baseline={...itemRow(id,cumulative),bookEntryState:order==='flags-first'?-128:127,
          signature:order==='signature-first'?0xffffffff:0x7fffffff,dateList:order==='empty-before'?[]:
            [{aquiredAt:now-duration-1},{aquiredAt:now-duration-1}]};
      put('UserGift',gifts);put('UserGachaTicket',[baseline]);
      const overflow=[gift(3,id,0x7fffffff)];put('UserGift',overflow);
      const tooWide=snapshot();assert.equal((await receive(overflow)).status,400);assert.equal(snapshot(),tooWide,
        'Original signed lifetime addition must not wrap before the dated grant clamp');put('UserGift',gifts);
      for(const table of ['operation_queue','gift_item_claim','gift_claim','gift_receive_request','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER cap_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'cap issue rollback'); END`);
        const before=snapshot();assert.equal((await receive(gifts)).status,503);assert.equal(snapshot(),before);
        app.store.db.exec('DROP TRIGGER cap_issue_fail');
      }
      const roll=crypto.randomInt;let response;
      try {crypto.randomInt=()=>baseline.signature===0xffffffff?1:baseline.signature;response=await receive(gifts);}
      finally {crypto.randomInt=roll;}
      const result=parse(response),operation=result.operations[0],receiveSequence=sequence,
        target=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=?').get(operation.id),capture=JSON.parse(target.gacha_state);
      assert.deepEqual(result.operation,operation);assert.deepEqual(result.receivedItems,[{itemId:id,amount:5}]);
      assert.equal(operation.signature,1);assert.equal(target.cap_version,1);assert.equal(target.cumulative_amount,999999999);
      assert.deepEqual(capture,{policy:'offline-gift-gacha-cap-v1',beforeCumulative:cumulative,beforeDates:baseline.dateList,
        beforeSignature:baseline.signature,signature:operation.signature,dateAdditions:0,observed:false,effect:false});
      assert.deepEqual(app.store.read('UserGachaTicket').data,[baseline],'No native ticket/date/signature precredit');
      assert.deepEqual(parse(await receive(gifts)).operation,operation);
      const unchanged=snapshot();assert.equal((await push({},[operation])).status,400);assert.equal(snapshot(),unchanged);
      for(const [cap_version,gacha_state] of [[0,null],[0,target.gacha_state],[1,null],[1,'{'],
        [1,JSON.stringify({...capture,dateAdditions:6})],[1,JSON.stringify({...capture,signature:baseline.signature})],
        [1,JSON.stringify({...capture,beforeSignature:0x100000000})],[1,JSON.stringify({...capture,beforeDates:[{aquiredAt:now,expireAt:now+1}]})],
        [1,JSON.stringify({...capture,observed:true})]]) {
        app.store.db.prepare('UPDATE gift_item_claim SET cap_version=?,gacha_state=? WHERE operation_id=?').run(cap_version,gacha_state,operation.id);
        const corrupt=snapshot();unavailable(await receive(gifts));unavailable(await push({},[operation]));assert.equal(snapshot(),corrupt);
        app.store.db.prepare('UPDATE gift_item_claim SET cap_version=?,gacha_state=? WHERE operation_id=?').run(1,target.gacha_state,operation.id);
      }
      const freshDates=Array.from({length:5},()=>({aquiredAt:now})),
        acquired={...baseline,cumulativeAmount:999999999,signature:operation.signature,dateList:freshDates};
      for(const changes of [{userId:2},{signature:'1'},{signature:0x100000000},{bookEntryState:128},{amount:5},
        {dateList:[{aquiredAt:'1'}]},{dateList:[...freshDates,{aquiredAt:now}]}]) {
        const before=snapshot();assert.equal((await push({UserGachaTicket:[{...acquired,...changes}]})).status,400);
        assert.equal(snapshot(),before);
      }
      if(order==='pruned-first') {
        const pruned=parse(await push({UserGachaTicket:[{...baseline,dateList:[]}]}));
        assert.deepEqual(pruned.operations,[operation],'Only original expiry pruning leaves the unobserved grant deliverable');
        assert.equal(JSON.parse(app.store.db.prepare('SELECT gacha_state FROM gift_item_claim').get().gacha_state).effect,false);
      }
      if(order==='flags-first') parse(await push({UserGift:received}));
      const partial=order==='append-first'?{...baseline,dateList:freshDates}:
        order==='signature-first' || order==='expired-before-save'?{...acquired,dateList:[]} : acquired;
      if(!['flags-first','together'].includes(order)) {
        for(const [table,column] of [['profile','data'],['gift_item_claim','gacha_state']]) {
          app.store.db.exec(`CREATE TRIGGER cap_save_fail BEFORE UPDATE OF ${column} ON ${table} BEGIN SELECT RAISE(ABORT,'cap save rollback'); END`);
          const before=snapshot();assert.equal((await push({UserGachaTicket:[partial]})).status,503);assert.equal(snapshot(),before);
          app.store.db.exec('DROP TRIGGER cap_save_fail');
        }
        app.store.db.exec("CREATE TRIGGER cap_reply_fail BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'cap reply rollback'); END");
        const before=snapshot();assert.equal((await push({UserGachaTicket:[partial]})).status,503);assert.equal(snapshot(),before);
        app.store.db.exec('DROP TRIGGER cap_reply_fail');
        const saved=parse(await push({UserGachaTicket:[partial]}));assert.deepEqual(saved.operations,[]);
        let recorded=JSON.parse(app.store.db.prepare('SELECT gacha_state FROM gift_item_claim').get().gacha_state);
        assert.equal(recorded.effect,true);assert.equal(recorded.observed,order!=='append-first');
        assert.equal(recorded.dateAdditions,partial.dateList.length);
        if(recorded.dateAdditions) {
          const state=app.store.db.prepare('SELECT gacha_state FROM gift_item_claim').get().gacha_state;
          app.store.db.prepare('UPDATE gift_item_claim SET gacha_state=?').run(JSON.stringify({...recorded,dateAdditions:0}));
          const refunded=snapshot();unavailable(await receive(gifts));assert.equal(snapshot(),refunded,
            'Current saved new dates cannot outlive their retained allowance proof');
          app.store.db.prepare('UPDATE gift_item_claim SET gacha_state=?').run(state);
        }
        await close();await open();const held=snapshot();unavailable(await receive(gifts));
        unavailable(await request(port,receiveSequence,{userId:seed.userId,giftIds:[1,2]},String(receiveSequence),'gift/receive'));
        assert.equal(snapshot(),held);assert.deepEqual(app.store.operations(),[operation]);
        const missingFlags=snapshot();assert.equal((await push({},[operation])).status,400);assert.equal(snapshot(),missingFlags);
        if(order==='append-first') {
          parse(await push({UserGachaTicket:[{...partial,dateList:[]}]}));
          const pruned=snapshot();assert.equal((await push({UserGachaTicket:[partial]})).status,400);assert.equal(snapshot(),pruned,
            'Pruning does not refund a used dated allowance');
          const noSignature=snapshot();assert.equal((await push({UserGift:received},[operation])).status,400);assert.equal(snapshot(),noSignature);
        }
        if(recorded.observed) {
          const extra=snapshot();assert.equal((await push({UserGachaTicket:[{...partial,dateList:[...partial.dateList,{aquiredAt:now+1}]}]})).status,400);
          assert.equal(snapshot(),extra,'Actual signature closes even an unused date allowance');
        }
      }
      const finalTicket=['append-first','signature-first','expired-before-save'].includes(order)?{...acquired,dateList:[]} : acquired,
        finalSave={UserGift:received,UserGachaTicket:[finalTicket]};
      for(const table of ['operation_done','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER cap_ack_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'cap ACK rollback'); END`);
        const before=snapshot();assert.equal((await push(finalSave,[operation])).status,503);assert.equal(snapshot(),before);
        app.store.db.exec('DROP TRIGGER cap_ack_fail');
      }
      const ack=parse(await push(finalSave,[operation])),ackSequence=sequence;assert.deepEqual(ack.operations,[{id:operation.id}]);
      assert.deepEqual(ack.dones,ack.operations);
      assert.deepEqual(app.store.operations(),[]);await close();await open();
      assert.equal(JSON.parse(app.store.db.prepare('SELECT gacha_state FROM gift_item_claim').get().gacha_state).observed,true);
      unavailable(await receive(gifts));
      const spent={...finalTicket,dateList:[]};parse(await push({UserGachaTicket:[spent]}));
      for(const ticket of [{...spent,dateList:[{aquiredAt:now}]},{...spent,cumulativeAmount:999999998}]) {
        const before=snapshot();assert.equal((await push({UserGachaTicket:[ticket]})).status,400);assert.equal(snapshot(),before);
      }
      const held=snapshot();assert.throws(()=>app.store.issueDraw([1011002001],{userGachaTicket:{...spent,dateList:[{aquiredAt:now}]}},1000),/cannot be restored/);
      assert.equal(snapshot(),held,'Shared lottery issuer cannot restore completed Present ticket stock');
      const next=[gift(3,id,1)];put('UserGift',next);
      const nextOperation=parse(await receive(next)).operation;
      const blocked=snapshot();assert.throws(()=>app.store.issueDraw([1011002001],{userGachaTicket:spent},1000),/Capped Present tickets/);
      assert.equal(snapshot(),blocked);
      parse(await push({UserGift:[{...next[0],state:1}],UserGachaTicket:[{...spent,signature:nextOperation.signature,dateList:[{aquiredAt:now}]}]},[nextOperation]));
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM gift_item_claim').get().n,2);
      assert.ok(ackSequence>receiveSequence);
    }

    //WRITTEN ONLY / NOT RUN: an actual original ticket purchase owns its full-row replacement until its unit ACK.
    for(const key of ['gacha_ticket.normal','gacha_ticket.character_3']) {
      const id=master.items[key],[lotteryId,lottery]=Object.entries(master.lotteries).find(([,row])=>row.ticketId===id &&
        !row.selectionGroupIds?.length && row.buttons.some(button=>button.consumeType===2 && button.consumeAmount===1 &&
          button.pickCount===1 && !button.stepUpGroupId));
      now=lottery.startAt;await fresh(`capped-consumer-first-${id}`);
      const gifts=[gift(1,id,1)],baseline={...itemRow(id,999999999),dateList:[{aquiredAt:now},{aquiredAt:now}]};
      put('UserGift',gifts);put('UserGachaTicket',[baseline]);
      const buttonIndex=lottery.buttons.findIndex(button=>button.consumeType===2 && button.consumeAmount===1 &&
        button.pickCount===1 && !button.stepUpGroupId),button=lottery.buttons[buttonIndex],paid=app.store.paidCurrency(),free=app.store.hardCurrency();
      const result=parse(await send('lottery/ticket/draw',{lotteryId:Number(lotteryId),buttonIndex:buttonIndex+1,drawCount:1,
        consumeAmount:button.consumeAmount,pickCount:button.pickCount,progressCount:0,currentStepIndex:0,isScratch:false,
        clientChargeHardCurrency:paid,clientFreeHardCurrency:free,clientTotalHardCurrency:paid+free}));
      assert.equal(result.userGachaTicket.dateList.length,1);
      const before=snapshot();assert.equal((await receive(gifts)).status,400);assert.equal(snapshot(),before);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM gift_item_claim').get().n,0);
      await close();await open();const reopened=snapshot();assert.equal((await receive(gifts)).status,400);assert.equal(snapshot(),reopened);
      assert.deepEqual(app.store.operations(),result.operations);
    }

    //WRITTEN ONLY / NOT RUN: four scheduled-reset IDs retain native timestamps, not ordinary capped stock semantics.
    for(const id of [298000004,298000007,298000008,298000009]) {
      now=1686794400;await fresh(`replenishing-adventure-ticket-${id}`);
      const name='UserAdventureTicket',gifts=[gift(1,id,1)],baseline={...itemRow(id,999999999,1),lastResetAt:now,bookEntryState:255,signature:0xffffffff};
      put(name,[baseline]);put('UserGift',gifts);
      const capped=snapshot();assert.equal((await receive(gifts)).status,400);assert.equal(snapshot(),capped,
        'Scheduled140000 stock replacement is not silently treated as ordinary capped reward gain');
      const ordinary={...baseline,cumulativeAmount:11};put(name,[ordinary]);
      const operation=parse(await receive(gifts)).operation,acquired={...ordinary,amount:2,cumulativeAmount:12,signature:operation.signature};
      assert.deepEqual(app.store.read(name).data,[ordinary],'No reset, timestamp, signature or inventory precredit');
      for(const changes of [{lastResetAt:undefined},{lastResetAt:-1},{lastResetAt:'0'},{reservedAmount:0},{dateList:[]},
        {bookEntryState:-1},{bookEntryState:256},{signature:0x100000000}]) {
        const before=snapshot();assert.equal((await push({UserGift:[{...gifts[0],state:1}],[name]:[{...acquired,...changes}]},[operation])).status,400);
        assert.equal(snapshot(),before);
      }
      parse(await push({UserGift:[{...gifts[0],state:1}],[name]:[acquired]},[operation]));
      await close();await open();assert.equal(app.store.read(name).data[0].lastResetAt,now);assert.deepEqual(app.store.operations(),[]);
    }

    //WRITTEN ONLY / NOT RUN: seventeen classes; all nine general bonds/five Memoria EXP/five non-replenishing Adventure Ticket IDs.
    for(const name of stockCapTables) for(const id of name==='UserAdventureTicket'?[298000001,298000002,298000003,298000005,298000006]:
      ['UserEquipmentEnhanceItem','UserEquipmentEvolveItem','UserMemoriaExpItem','UserGeneralLimitBreakItem'].includes(name)?
      Object.entries(master.itemProfiles).filter(([,profile])=>profile.table===name).map(([id])=>Number(id)):
      [name==='UserKeyItem'?master.items['key_item.nome_ticket']:types.get(name)]) for(const scenario of [
      {order:'stock-first',cumulative:999999998,amount:0},
      {order:'flags-first',cumulative:999999994,amount:7},
      {order:'signature-first',cumulative:999999999,amount:999999999},
      {order:'together',cumulative:999999999,amount:999999998},
      {order:'spent-first',cumulative:999999999,amount:7},
      {order:'cumulative-first',cumulative:999999998,amount:7},
      {order:'spent-before-signature',cumulative:999999999,amount:0},
    ]) {
      now=1686794400;const {order,cumulative,amount}=scenario;
      assert.equal(master.itemProfiles[id].table,name);await fresh(`stock-cap-${id}-${order}`);
      const baseline={...itemRow(id,cumulative,amount),...(name==='UserMemoriaExpItem'?{lastAquiredAt:now-315360001}:{}),
        bookEntryState:['UserExpItem','UserCpItem','UserStatusBoardItem','UserEquipmentMaterial','UserEquipmentEnhanceItem','UserEquipmentEvolveItem','UserLockAbilityItem','UserHeroSublimateItem','UserHeroSublimateUnlockItem','UserAdventureTicket','UserMemoriaExpItem','UserAlarmVoiceItem','UserLimitBreakItem','UserGeneralLimitBreakItem'].includes(name)?255:1,
        signature:order==='signature-first'?0xffffffff:0x7fffffff},gifts=[gift(1,id,2),gift(2,id,3)],received=gifts.map(row=>({...row,state:1}));
      put(name,[baseline]);put('UserGift',gifts);
      const overflow=[gift(3,id,0x7fffffff)];put('UserGift',overflow);
      const tooWide=snapshot();assert.equal((await receive(overflow)).status,400);assert.equal(snapshot(),tooWide,
        'Original signed stock/lifetime additions must not wrap before clamping');put('UserGift',gifts);
      const roll=crypto.randomInt;let response;
      try {crypto.randomInt=()=>baseline.signature===0xffffffff?1:baseline.signature;response=await receive(gifts);}
      finally {crypto.randomInt=roll;}
      const result=parse(response),operation=result.operation,receiveSequence=sequence,
        target=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=?').get(operation.id),capture=JSON.parse(target.stock_state),
        acquired={...baseline,amount:Math.min(999999999,amount+5),cumulativeAmount:999999999,signature:operation.signature};
      assert.deepEqual(result.operations,[operation]);assert.deepEqual(result.receivedItems,[{itemId:id,amount:5}]);
      assert.equal(operation.signature,1);assert.equal(target.amount,5);assert.equal(target.cumulative_amount,999999999);
      assert.equal(target.gacha_state,null);assert.equal(target.cap_version,1);assert.deepEqual(capture,
        {policy:'offline-gift-stock-cap-v1',beforeCumulative:cumulative,beforeAmount:amount,amount:acquired.amount,
          beforeSignature:baseline.signature,signature:operation.signature,amountAdded:0,observed:false,effect:false});
      assert.deepEqual(app.store.read(name).data,[baseline],'No native stock/signature/counter precredit');
      assert.deepEqual(parse(await receive(gifts)).operation,operation);
      const noReward=snapshot();assert.equal((await push({},[operation])).status,400);assert.equal(snapshot(),noReward);
      for(const changes of [{cap_version:0,stock_state:null},{cap_version:0},{stock_state:null},{stock_state:'{'},
        {gacha_state:JSON.stringify(capture)},...[
          {beforeAmount:-1},{beforeSignature:0x100000000},{signature:baseline.signature},{amountAdded:6},
          {amount:acquired.amount-1},{observed:true},{beforeCumulative:'999999999'},
        ].map(change=>({stock_state:JSON.stringify({...capture,...change})}))]) {
        app.store.db.prepare(`UPDATE gift_item_claim SET ${Object.keys(changes).map(field=>`${field}=?`).join(',')} WHERE operation_id=?`)
          .run(...Object.values(changes),operation.id);
        const invalid=snapshot();unavailable(await receive(gifts));unavailable(await push({},[operation]));assert.equal(snapshot(),invalid);
        app.store.db.prepare('UPDATE gift_item_claim SET cap_version=1,gacha_state=NULL,stock_state=? WHERE operation_id=?')
          .run(target.stock_state,operation.id);
      }
      for(const change of [{userId:2},{amount:-1},{amount:1000000000},{signature:'1'},{signature:0x100000000},
        {cumulativeAmount:cumulative-1},...(name==='UserKeyItem'?[{exploit:'false'}]:[]),
        ...(['UserEquipmentEnhanceItem','UserEquipmentEvolveItem'].includes(name)?[
          {reservedAmount:-1},{bookEntryState:-1},{bookEntryState:256},{lastResetAt:0},
          {[name==='UserEquipmentEnhanceItem'?'equipmentEnhanceItemId':'equipmentEvolveItemId']:id}]:[]),
        ...(name==='UserLockAbilityItem'?[{reservedAmount:-1},{bookEntryState:-1},{bookEntryState:256},
          {lastResetAt:0},{dateList:[]},{lockAbilityItemId:id}]:[]),
        ...(['UserHeroSublimateItem','UserHeroSublimateUnlockItem'].includes(name)?[{reservedAmount:-1},{bookEntryState:-1},{bookEntryState:256},
          {lastResetAt:0},{dateList:[]},{[name==='UserHeroSublimateItem'?'heroSublimateUnlockItemId':'heroSublimateItemId']:id}]:[]),
        ...(name==='UserAdventureTicket'?[{lastResetAt:-1},{lastResetAt:'0'},{reservedAmount:0},{dateList:[]},
          {bookEntryState:-1},{bookEntryState:256},{heroSublimateItemId:id}]:[]),
        ...(name==='UserAlarmVoiceItem'?[{reservedAmount:undefined},{reservedAmount:-1},{bookEntryState:-1},{bookEntryState:256},
          {lastResetAt:0},{lastAquiredAt:0},{dateList:[]},{voiceId:id}]:[]),
        ...(['UserLimitBreakItem','UserGeneralLimitBreakItem'].includes(name)?[{bookEntryState:undefined},{bookEntryState:-1},{bookEntryState:256},
          {signature:undefined},{reservedAmount:0},{lastResetAt:0},{lastAquiredAt:0},{dateList:[]},{generalLimitBreakItemId:id}]:[]),
        ...(name==='UserMemoriaExpItem'?[{lastAquiredAt:undefined},{lastAquiredAt:-1},{lastAquiredAt:'0'},
          {lastAquiredAt:now},{reservedAmount:undefined},{reservedAmount:-1},{bookEntryState:-1},{bookEntryState:256},
          {lastResetAt:0},{lastAcquiredAt:0},{dateList:[]},{memoriaId:id}]:[])]) {
        const before=snapshot();assert.equal((await push({[name]:[{...acquired,...change}]})).status,400);assert.equal(snapshot(),before);
      }
      if(order==='flags-first') parse(await push({UserGift:received}));
      let finalTicket=acquired;
      if(order!=='together' && order!=='flags-first') {
        const partial=order==='stock-first' || order==='spent-before-signature'?{...baseline,amount:acquired.amount}:
          order==='cumulative-first'?{...baseline,cumulativeAmount:999999999}:
          order==='spent-first'?{...acquired,amount:0}:acquired;
        for(const [table,event] of [['profile','UPDATE OF data'],['gift_item_claim','UPDATE OF stock_state'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER stock_cap_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'stock cap rollback'); END`);
          const before=snapshot();assert.equal((await push({[name]:[partial]})).status,503);assert.equal(snapshot(),before);
          app.store.db.exec('DROP TRIGGER stock_cap_fail');
        }
        assert.deepEqual(parse(await push({[name]:[partial]})).operations,[]);
        const recorded=JSON.parse(app.store.db.prepare('SELECT stock_state FROM gift_item_claim').get().stock_state);
        assert.equal(recorded.effect,true);assert.equal(recorded.observed,['signature-first','spent-first'].includes(order));
        assert.equal(recorded.amountAdded,Math.max(0,partial.amount-amount));
        await close();await open();const held=snapshot();unavailable(await receive(gifts));
        unavailable(await request(port,receiveSequence,{userId:seed.userId,giftIds:[1,2]},String(receiveSequence),'gift/receive'));
        assert.equal(snapshot(),held);assert.deepEqual(app.store.operations(),[operation]);
        // WRITTEN ONLY: a completed capped item is omitted from cold delivery, without ACK or stock restoration.
        if(recorded.observed) {
          const cold=parse(await send('user_data/confirm'));
          assert.deepEqual(cold.operations.find(row=>row.id===operation.id)?.parameters.receivedItems,[]);
          assert.deepEqual(app.store.operations(),[operation]);
        } else unavailable(await send('user_data/confirm'));
        const flagsMissing=snapshot();assert.equal((await push({},[operation])).status,400);assert.equal(snapshot(),flagsMissing);
        if(order==='stock-first' || order==='cumulative-first') {
          const signatureMissing=snapshot();assert.equal((await push({UserGift:received},[operation])).status,400);
          assert.equal(snapshot(),signatureMissing);
        }
        if(order==='spent-before-signature') {
          parse(await push({[name]:[{...partial,amount:0}]}));const spent=snapshot();
          assert.equal((await push({[name]:[partial]})).status,400);assert.equal(snapshot(),spent,'Spending cannot refund the capped stock allowance');
          finalTicket={...acquired,amount:0};
        }
        if(order==='spent-first') finalTicket=partial;
        if(recorded.observed) {
          parse(await push({[name]:[{...partial,amount:0}]}));const spent=snapshot();
          assert.equal((await push({[name]:[{...partial,amount:1}]})).status,400);assert.equal(snapshot(),spent,
            'Actual signature closes unused allowance, even before received flags/ACK');finalTicket={...acquired,amount:0};
        }
      }
      for(const table of ['operation_done','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER stock_cap_ack_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'stock ACK rollback'); END`);
        const before=snapshot();assert.equal((await push({UserGift:received,[name]:[finalTicket]},[operation])).status,503);
        assert.equal(snapshot(),before);app.store.db.exec('DROP TRIGGER stock_cap_ack_fail');
      }
      parse(await push({UserGift:received,[name]:[finalTicket]},[operation]));assert.deepEqual(app.store.operations(),[]);
      await close();await open();const state=JSON.parse(app.store.db.prepare('SELECT stock_state FROM gift_item_claim').get().stock_state);
      assert.equal(state.observed,true);assert.equal(state.effect,true);unavailable(await receive(gifts));
      parse(await push({[name]:[{...finalTicket,amount:0}]}));
      for(const signature of [finalTicket.signature,finalTicket.signature===1?2:1]) {
        const spent=snapshot();assert.equal((await push({[name]:[{...finalTicket,amount:1,signature}]})).status,400);
        assert.equal(snapshot(),spent,'A completed capped Present cannot restore spent stock through its old counter or another signature');
      }
      for(const [puts,deletes] of [[{[name]:[{...finalTicket,amount:0,cumulativeAmount:999999998}]},{}],
        [{},{[name]:[{[master.itemProfiles[id].idField]:id}]}]]) {
        const before=snapshot();assert.equal((await push(puts,[],deletes)).status,400);assert.equal(snapshot(),before);
      }
      const next=[gift(3,id,1)];put('UserGift',next);const nextOperation=parse(await receive(next)).operation;
      parse(await push({UserGift:[{...next[0],state:1}],[name]:[{...finalTicket,amount:1,signature:nextOperation.signature}]},[nextOperation]));
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM gift_item_claim').get().n,2);
    }

    // WRITTEN ONLY: a mixed captured Present retains its unsaved dated ticket but not its saved capped stock.
    {
      now=1686794400;await fresh('mixed-capped-stock-and-dated-ticket-cold');
      const stockId=types.get('UserExpItem'),ticketId=types.get('UserGachaTicket'),
        stock=itemRow(stockId,999999998,0),ticket=itemRow(ticketId,5,0),
        gifts=[gift(1,stockId,1),gift(2,ticketId,1)];
      put('UserExpItem',[stock]);put('UserGachaTicket',[ticket]);put('UserGift',gifts);
      const operation=parse(await receive(gifts)).operation,
        stockSaved={...stock,amount:1,cumulativeAmount:999999999,signature:operation.signature};
      parse(await push({UserExpItem:[stockSaved]}));
      await close();await open();
      const cold=parse(await send('user_data/confirm'));
      assert.deepEqual(cold.operations.find(row=>row.id===operation.id)?.parameters.receivedItems,[{itemId:ticketId,amount:1}]);
      assert.deepEqual(app.store.operations(),[operation]);
      const ticketSaved={...ticket,dateList:[{aquiredAt:now}],cumulativeAmount:6,signature:operation.signature};
      parse(await push({UserGift:gifts.map(row=>({...row,state:1})),UserGachaTicket:[ticketSaved]},[operation]));
      assert.deepEqual(app.store.operations(),[]);
    }

    // WRITTEN ONLY: original item and stamina callback entries recover independently in either native save order.
    for(const order of ['stock-first','stamina-first']) {
      now=1686794400;await fresh(`mixed-capped-stock-stamina-${order}`);
      const stockId=types.get('UserExpItem'),spId=master.currencies['currency.stamina'],stock=itemRow(stockId,999999998,0),
        info=structuredClone(seed.data.UserInfo),gifts=[gift(1,stockId,1),gift(2,spId,13)];
      info[0].playerStatus.baseSP=7;
      put('UserInfo',info);put('UserExpItem',[stock]);put('UserGift',gifts);
      const operation=parse(await receive(gifts)).operation,
        stockSaved={...stock,amount:1,cumulativeAmount:999999999,signature:operation.signature},spSaved=structuredClone(info);
      spSaved[0].playerStatus.baseSP=20;
      const first=order==='stock-first'?{UserExpItem:[stockSaved]}:{UserInfo:spSaved},
        second=order==='stock-first'?{UserInfo:spSaved}:{UserExpItem:[stockSaved]},
        remaining=order==='stock-first'?[{itemId:spId,amount:13}]:[{itemId:stockId,amount:1}];
      parse(await push(first));await close();await open();
      const cold=parse(await send('user_data/confirm'));
      assert.deepEqual(cold.operations.find(row=>row.id===operation.id)?.parameters.receivedItems,remaining);
      assert.deepEqual(app.store.operations(),[operation]);
      if(order==='stamina-first') {
        parse(await push({UserExpItem:[{...stock,amount:1}]}));
        const partial=snapshot();unavailable(await send('user_data/confirm'));assert.equal(snapshot(),partial,
          'Partially saved mixed stock cannot be projected as a completed Present item');
      }
      parse(await push(second));
      put('UserInfo',[{...spSaved[0],userId:2}]);
      const foreign=snapshot();unavailable(await send('user_data/confirm'));assert.equal(snapshot(),foreign);
      put('UserInfo',spSaved);
      assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id)?.parameters.receivedItems,[]);
      parse(await push({UserGift:gifts.map(row=>({...row,state:1}))},[operation]));
      assert.deepEqual(app.store.operations(),[]);
    }

    //WRITTEN ONLY / NOT RUN: clamped stock, not full wire quantity, bounds each numeric reward's positive additions.
    for(const name of stockCapTables) for(const full of [false,true]) for(const order of ['stock-first','signature-first']) {
      now=1686794400;const id=name==='UserAdventureTicket'?298000001:name==='UserKeyItem'?master.items['key_item.nome_ticket']:types.get(name);
      await fresh(`numeric-clamped-allowance-${id}-${full}-${order}`);
      const baseline={...itemRow(id,999999999,full?999999999:999999998),
          ...(name==='UserMemoriaExpItem'?{lastAquiredAt:now-315360001}:{}),signature:0x7fffffff},
        gifts=[gift(1,id,2),gift(2,id,3)],received=gifts.map(row=>({...row,state:1})),delta=full?0:1,
        reject=async (wire,status=400) => {const held=snapshot();assert.equal((await send('user_data/push',wire)).status,status);assert.equal(snapshot(),held);};
      put(name,[baseline]);put('UserGift',gifts);
      const result=parse(await receive(gifts)),operation=result.operation,target=app.store.db.prepare('SELECT * FROM gift_item_claim').get(),
        captured=JSON.parse(target.stock_state),acquired={...baseline,amount:999999999,signature:operation.signature},
        prefix=order==='stock-first'?{...baseline,amount:999999999}:{...baseline,signature:operation.signature},
        body=pushBody({[name]:[prefix]}),effect=!full || order==='signature-first';
      assert.equal(target.amount,5);assert.equal(captured.amount-captured.beforeAmount,delta);
      assert.deepEqual(result.receivedItems,[{itemId:id,amount:5}]);
      assert.notEqual(operation.signature,baseline.signature);assert.deepEqual(app.store.read(name).data,[baseline]);
      for(const [table,event] of [['profile','UPDATE'],...(effect?[['gift_item_claim','UPDATE OF stock_state']]:[]),['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER numeric_clamp_prefix_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'clamped numeric prefix rollback'); END`);
        await reject(body,503);app.store.db.exec('DROP TRIGGER numeric_clamp_prefix_fail');
      }
      const response=await send('user_data/push',body),identity=sequence;parse(response);
      const observed=app.store.db.prepare('SELECT * FROM gift_item_claim').get(),stock=JSON.parse(observed.stock_state);
      assert.equal(stock.amountAdded,order==='stock-first'?delta:0);assert.equal(stock.observed,order==='signature-first');assert.equal(stock.effect,effect);
      await close();await open();const held=snapshot();
      assert.deepEqual((await request(port,identity,body,String(identity),'user_data/push')).body,response.body);assert.equal(snapshot(),held);
      app.store.db.prepare('UPDATE gift_item_claim SET stock_state=?').run(JSON.stringify({...stock,amountAdded:delta+1,effect:true}));
      const corrupt=snapshot();unavailable(await receive(gifts));assert.equal(snapshot(),corrupt);
      app.store.db.prepare('UPDATE gift_item_claim SET stock_state=?').run(observed.stock_state);
      await reject(pushBody({},[operation]));
      const spent={...prefix,amount:0};parse(await push({[name]:[spent]}));
      await reject(pushBody({[name]:[{...spent,amount:1}]}));
      const final=pushBody({UserGift:received,[name]:[{...acquired,amount:0}]},[operation]);
      for(const [table,event] of [['profile','UPDATE'],['gift_item_claim','UPDATE OF stock_state'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        if(table==='gift_item_claim' && stock.observed) continue;
        app.store.db.exec(`CREATE TRIGGER numeric_clamp_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'clamped numeric ACK rollback'); END`);
        await reject(final,503);app.store.db.exec('DROP TRIGGER numeric_clamp_ack_fail');
      }
      const acknowledged=await send('user_data/push',final),ackIdentity=sequence;parse(acknowledged);assert.deepEqual(app.store.operations(),[]);
      const done=JSON.parse(app.store.db.prepare('SELECT stock_state FROM gift_item_claim').get().stock_state);
      assert.equal(done.observed,true);assert.equal(done.amountAdded,order==='stock-first'?delta:0);
      await close();await open();const settled=snapshot();
      assert.deepEqual((await request(port,ackIdentity,final,String(ackIdentity),'user_data/push')).body,acknowledged.body);assert.equal(snapshot(),settled);
      for(const wire of [pushBody({[name]:[{...acquired,amount:1}]}),pushBody({[name]:[{...acquired,amount:0,cumulativeAmount:999999998}]}),
        pushBody({},[],{[name]:[{...acquired,amount:0}]})]) await reject(wire);
    }

    //WRITTEN ONLY / NOT RUN: native289c548 keeps the entire UInt32 signature;289c464 is book, not signature.
    for(const spec of [{before:0xff,roll:0xff,issued:0x100,book:4},
      {before:0xffffffff,roll:0x1ff,issued:0x1ff,book:0xff},
      {before:0x80000001,roll:0x7fffffff,issued:0x7fffffff,book:0}])
      for(const order of ['gain-first','flags-first']) {
        now=1686794400;const id=types.get('UserLockAbilityItem');await fresh(`lock-full-signature-${spec.before}-${order}`);
        const baseline={...itemRow(id,999999999,7),signature:spec.before,bookEntryState:spec.book},
          gifts=[gift(1,id,2),gift(2,id,1)],received=gifts.map(row=>({...row,state:1}));
        put('UserGift',gifts);put('UserLockAbilityItem',[baseline]);
        for(const table of ['operation_queue','gift_item_claim','gift_claim','gift_receive_request','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER lock_signature_issue_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'lock issue rollback'); END`);
          const before=snapshot();assert.equal((await receive(gifts)).status,503);assert.equal(snapshot(),before);
          app.store.db.exec('DROP TRIGGER lock_signature_issue_fail');
        }
        const randomInt=crypto.randomInt;let response;
        try {crypto.randomInt=()=>spec.roll;response=await receive(gifts);} finally {crypto.randomInt=randomInt;}
        const result=parse(response),op=result.operation,identity=sequence,
          target=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=?').get(op.id),
          capture=JSON.parse(target.stock_state),acquired={...baseline,amount:10,signature:op.signature};
        assert.equal(op.signature,spec.issued);assert.equal(capture.beforeSignature,spec.before);
        assert.equal(capture.signature,spec.issued);assert.equal(target.id_field,'lockAbilityId');assert.equal(target.cap_version,1);
        assert.deepEqual(app.store.read('UserLockAbilityItem').data,[baseline],'Issuance must not invent native lock stock/signature');
        const truncated={...acquired,signature:op.signature&0xff},unchanged=snapshot();
        assert.equal((await push({UserGift:received,UserLockAbilityItem:[truncated]},[op])).status,400);
        assert.equal(snapshot(),unchanged,'A low-byte match is not actual native32-bit signature proof');
        app.store.db.prepare('UPDATE gift_item_claim SET stock_state=? WHERE operation_id=?')
          .run(JSON.stringify({...capture,signature:op.signature&0xff}),op.id);
        const corrupt=snapshot();unavailable(await receive(gifts));unavailable(await push({},[op]));assert.equal(snapshot(),corrupt);
        app.store.db.prepare('UPDATE gift_item_claim SET stock_state=? WHERE operation_id=?').run(target.stock_state,op.id);
        parse(await push(order==='gain-first'?{UserLockAbilityItem:[acquired]}:{UserGift:received}));
        await close();await open();assert.deepEqual(app.store.operations(),[op]);
        unavailable(await receive(gifts));unavailable(await request(port,identity,{userId:seed.userId,giftIds:[1,2]},String(identity),'gift/receive'));
        for(const [table,event] of [['profile','UPDATE'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER lock_signature_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'lock ACK rollback'); END`);
          const before=snapshot();assert.equal((await push({UserGift:received,UserLockAbilityItem:[acquired]},[op])).status,503);
          assert.equal(snapshot(),before);app.store.db.exec('DROP TRIGGER lock_signature_ack_fail');
        }
        const ackWire=pushBody({UserGift:received,UserLockAbilityItem:[acquired]},[op]),ack=await send('user_data/push',ackWire),ackIdentity=sequence;
        parse(ack);await close();await open();assert.deepEqual(app.store.operations(),[]);
        const retained=snapshot();assert.deepEqual((await request(port,ackIdentity,ackWire,String(ackIdentity),'user_data/push')).body,ack.body);
        assert.equal(snapshot(),retained);parse(await push({UserLockAbilityItem:[{...acquired,amount:0}]}));
        const spent=snapshot();assert.equal((await push({UserLockAbilityItem:[{...acquired,amount:1}]})).status,400);assert.equal(snapshot(),spent);
      }

    //WRITTEN ONLY / NOT RUN: one real2000 nonce must avoid both full-width captured signatures, without truncation.
    for(const order of ['lock-first','cp-first','together']) {
      now=1686794400;await fresh(`lock-mixed-${order}`);
      const lockId=types.get('UserLockAbilityItem'),cpId=types.get('UserCpItem'),
        lock={...itemRow(lockId,999999998,7),signature:0xff,bookEntryState:255},
        cp={...itemRow(cpId,999999997,11),signature:0x100},
        gifts=[gift(1,lockId,2),gift(2,cpId,3)],received=gifts.map(row=>({...row,state:1}));
      put('UserGift',gifts);put('UserLockAbilityItem',[lock]);put('UserCpItem',[cp]);
      const randomInt=crypto.randomInt;let response;
      try {crypto.randomInt=()=>0xff;response=await receive(gifts);} finally {crypto.randomInt=randomInt;}
      const result=parse(response),op=result.operation,identity=sequence,
        lockAfter={...lock,amount:9,cumulativeAmount:999999999,signature:op.signature},
        cpAfter={...cp,amount:14,cumulativeAmount:999999999,signature:op.signature};
      assert.equal(op.signature,0x101);assert.deepEqual(result.receivedItems,[{itemId:lockId,amount:2},{itemId:cpId,amount:3}]);
      const targets=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=? ORDER BY item_id').all(op.id);
      assert.equal(targets.length,2);assert.ok(targets.every(row=>JSON.parse(row.stock_state).signature===0x101));
      for(const missing of [{UserGift:received,UserLockAbilityItem:[lockAfter]},{UserGift:received,UserCpItem:[cpAfter]}]) {
        const before=snapshot();assert.equal((await push(missing,[op])).status,400);assert.equal(snapshot(),before);
      }
      const partial=order==='lock-first'?{UserLockAbilityItem:[lockAfter]}:order==='cp-first'?{UserCpItem:[cpAfter]}:
        {UserLockAbilityItem:[lockAfter],UserCpItem:[cpAfter]};
      parse(await push(partial));await close();await open();assert.deepEqual(app.store.operations(),[op]);
      unavailable(await receive(gifts));unavailable(await request(port,identity,{userId:seed.userId,giftIds:[1,2]},String(identity),'gift/receive'));
      const ackWire=pushBody({UserGift:received,UserLockAbilityItem:[lockAfter],UserCpItem:[cpAfter]},[op]),
        ack=await send('user_data/push',ackWire),ackIdentity=sequence;parse(ack);await close();await open();
      assert.deepEqual(app.store.operations(),[]);const retained=snapshot();
      assert.deepEqual((await request(port,ackIdentity,ackWire,String(ackIdentity),'user_data/push')).body,ack.body);assert.equal(snapshot(),retained);
    }

    //WRITTEN ONLY / NOT RUN: without a prior Familia charge, capped Valis grants must not manufacture a spending-credit source.
    for(const [cumulative,amount] of [[999999994,7],[999999998,7],[999999999,1999999999],[999999999,2000000000]]) {
      now=1686794400;await fresh(`valis-cap-no-charge-${cumulative}-${amount}`);
      const id=master.currencies['currency.valis'],baseline={...itemRow(id,cumulative,amount),signature:0x7fffffff},
        gifts=[gift(1,id,2),gift(2,id,3)];put('UserCurrency',[baseline]);put('UserGift',gifts);
      const result=parse(await receive(gifts)),operation=result.operation,target=app.store.db.prepare('SELECT * FROM gift_item_claim').get(),
        capture=JSON.parse(target.stock_state),acquired={...baseline,amount:Math.min(2000000000,amount+5),cumulativeAmount:999999999,signature:operation.signature};
      assert.equal(capture.policy,'offline-gift-stock-cap-v2');assert.equal(capture.valisFloorHash,null);assert.equal(target.valis_state,null);
      assert.deepEqual(result.receivedItems,[{itemId:id,amount:5}]);assert.deepEqual(app.store.read('UserCurrency').data,[baseline]);
      parse(await push({UserCurrency:[acquired]}));
      await close();await open();
      // WRITTEN ONLY: actual capped Valis save suppresses only the cold callback, not the gift flag or ACK.
      const cold=parse(await send('user_data/confirm'));
      assert.deepEqual(cold.operations.find(row=>row.id===operation.id)?.parameters.receivedItems,[]);
      assert.deepEqual(app.store.operations(),[operation]);
      parse(await push({UserGift:gifts.map(row=>({...row,state:1}))},[operation]));
      assert.equal(app.store.familiaValisSpendingFloor().ceiling,null);assert.equal(app.store.db.prepare('SELECT valis_seen FROM gift_item_claim').get().valis_seen,0);
      await close();await open();assert.equal(app.store.familiaValisSpendingFloor().ceiling,null);unavailable(await receive(gifts));
      parse(await push({UserCurrency:[{...acquired,amount:0}]}));const spent=snapshot();
      assert.equal((await push({UserCurrency:[{...acquired,amount:1}]})).status,400);assert.equal(snapshot(),spent,
        'Valis stock still needs a new captured reward even when no Familia spending floor exists');
    }

    // One item acquisition cannot settle both a gift and a genuine original mission.
    const [missionId, original] = Object.entries(master.achievements).find(([, row]) =>
      master.itemProfiles[master.items[row.rewardKey]]?.table === 'UserStaminaTicket' && !row.expireAt);
    const itemId = master.items[original.rewardKey], name = master.itemProfiles[itemId].table;
    for (const giftFirst of [true, false]) {
      now = Math.max(1686794400, original.startAt); await fresh(`order-${giftFirst}`);
      const gifts = [gift(1, itemId, 2)], mission = { userId: seed.userId, achievementId: Number(missionId), completedAt: now,
        lastResetAt: 0, progressParam: 1, readState: 1, signature: 0, state: 3 };
      put('UserGift', gifts); put('UserAchievement', [mission]); put(name, [itemRow(itemId, 11, 7)]);
      const claimMission = async () => parse(await send('achievement/complete', {
        achievementIds: [{ achievementId: mission.achievementId, completedAt: mission.completedAt }] })).operations[0];
      const claimGift = async () => parse(await receive(gifts)).operations[0];
      const first = await (giftFirst ? claimGift() : claimMission()), second = await (giftFirst ? claimMission() : claimGift());
      const firstAmount = giftFirst ? 2 : original.rewardAmount, total = 2 + original.rewardAmount;
      parse(await push({ UserGift: gifts.map(row => ({ ...row, state: 1 })), UserAchievement: [{ ...mission, state: 4 }],
        [name]: [itemRow(itemId, 11 + firstAmount, 7 + firstAmount)] }, [first]));
      const shared = snapshot(); assert.equal((await push({}, [second])).status, 400); assert.equal(snapshot(), shared);
      await close(); await open(); parse(await push({ [name]: [itemRow(itemId, 11 + total, 7 + total)] }, [second]));
      assert.deepEqual(app.store.operations(), []);
    }

    now = 1686794400; await fresh('missing-receipt');
    const id = types.get('UserAdventureTicket'), gifts = [gift(1, id, 1), gift(2, id, 1)];
    put('UserGift', gifts); put('UserAdventureTicket', [itemRow(id, 11, 7)]);
    const first = await receive([gifts[0]]), identity = sequence, operation = parse(first).operations[0];
    const target = app.store.db.prepare('SELECT * FROM gift_item_claim').get();
    app.store.db.prepare('DELETE FROM gift_item_claim WHERE operation_id=?').run(operation.id); await close(); await open();
    const missing = snapshot(); unavailable(await receive([gifts[0]])); unavailable(await receive([gifts[1]]));
    unavailable(await request(port, identity, { userId: seed.userId, giftIds: [1] }, String(identity), 'gift/receive'));
    unavailable(await push({ UserGift: [{ ...gifts[0], state: 1 }] }, [operation]));
    assert.equal(snapshot(), missing); assert.equal(app.store.operations().length, 1);
    app.store.db.prepare('INSERT INTO gift_item_claim(operation_id,item_id,amount,table_name,id_field,cumulative_amount) VALUES(?,?,?,?,?,?)').run(target.operation_id, target.item_id, target.amount,
      target.table_name, target.id_field, target.cumulative_amount);
    app.store.db.prepare('UPDATE gift_item_claim SET amount=amount+1 WHERE operation_id=?').run(operation.id);
    const badQuantity = snapshot(); unavailable(await receive([gifts[0]])); unavailable(await receive([gifts[1]]));
    unavailable(await request(port, identity, { userId: seed.userId, giftIds: [1] }, String(identity), 'gift/receive'));
    assert.equal(snapshot(), badQuantity, 'Changed issued quantities cannot be hidden by cached callbacks or new reservations');
    app.store.db.prepare('UPDATE gift_item_claim SET amount=? WHERE operation_id=?').run(target.amount, operation.id);
    const second = parse(await receive([gifts[1]])).operations[0];
    assert.equal(app.store.db.prepare('SELECT cumulative_amount FROM gift_item_claim WHERE operation_id=?').get(second.id).cumulative_amount, 13);
    parse(await push({ UserGift: gifts.map(row => ({ ...row, state: 1 })), UserAdventureTicket: [itemRow(id, 12, 8)] }, [operation]));
    const one = snapshot(); assert.equal((await push({}, [second])).status, 400); assert.equal(snapshot(), one);
    parse(await push({ UserAdventureTicket: [itemRow(id, 13, 9)] }, [second]));
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    console.log('Present inventory fixtures include24 absent item-first cold recoveries,22 partial ordinary refusals,35 non-replenishing Adventure Ticket cap and4 scheduled-ID ordinary/refusal cases,16 full-width ability-lock,7 Hero Ascension and7 Hero unlock cases WRITTEN ONLY; native reward/save acceptance still pending');
  } finally { await close(); Date.now = realNow; fs.rmSync(directory, { recursive: true, force: true }); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
