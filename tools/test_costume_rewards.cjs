'use strict';

// Disposable synthetic encrypted requests/saves, NOT full native wardrobe/voice proof.
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
const costumeId = 1021002030;
const voices = id => Object.entries(master.communicationVoices).filter(([,voice]) => voice.costumeId === id)
  .map(([voiceId]) => Number(voiceId));

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-costume-rewards-'));
  let app, port, database, sequence = 0, now = 1686794400;
  const open = async () => {
    app = createServer({ database, seed, master, wallNowSeconds: () => now, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const fresh = async name => { await close(); database = path.join(directory, `${name}.sqlite`); await open(); };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows), md5(rows), name);
  const send = (action, value) => request(port, ++sequence, value, String(sequence), action);
  const receive = gifts => send('gift/receive', { userId: seed.userId, giftIds: gifts.map(row => row.id) });
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const push = (putItems = {}, operations = [], deleteItems = {}) => send('user_data/push', {
    badges: null, scripts: {}, dataTokens: {}, checksums: { before: {}, after: Object.fromEntries(
      [...new Set([...Object.keys(putItems), ...Object.keys(deleteItems)])].map(name => [name, md5(putItems[name] ?? [])])) },
    deltas: Object.keys(putItems).length || Object.keys(deleteItems).length ? [{ signature: 0, trigger: 'GiftReceive', putItems, deleteItems }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })),
  });
  const gift = (id, itemId = costumeId, extra = {}) => ({ userId: seed.userId, id, itemId, amount: 1,
    title: 'Synthetic original costume gift', message: '', senderType: 1, senderId: 0, giftAcquiredType: 2,
    itemLevel: 0, equipmentId: 0, equipmentEvolveCount: 0, pcLimitBreakCount: 0, pcHeroSublimateCount: 0,
    state: 0, startAt: now, expireAt: now + 100, createdAt: now, dynamodbExpireAt: 0, ...extra });
  const costume = (id = costumeId, state = 2, userId = 0) => ({ userId, costumeId: id, costumeState: state });
  const voice = (id, state = 2, userId = 0) => ({ userId, voiceId: id, voiceState: state });
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name, app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all()]));
  const reject = async (response, status, unavailable = false, before = snapshot()) => {
    const result = await response; assert.equal(result.status, status, result.body.toString()); assert.equal(snapshot(), before);
    if (unavailable) assert.equal(JSON.parse(result.body).code, OFFLINE_UNAVAILABLE_CODE);
  };
  try {
    await fresh('all-original-costumes');
    const ids = Object.keys(master.characterCostumes).map(Number), gifts = ids.map((id,i) => gift(i + 1,id));
    assert.equal(ids.length, 394); put('UserGift', gifts);
    const originalCostumes = app.store.read('UserCharacterCostume'), originalVoices = app.store.read('UserCommunicationVoice');
    const originalCharacters = app.store.read('UserCommunicationCharacter'), originalPcs = app.store.read('UserPC');
    const operations = [];
    for (let at = 0; at < gifts.length; at += 100) {
      const result = parse(await receive(gifts.slice(at,at + 100))); operations.push(result.operations[0]);
      assert.deepEqual(result.receivedCostumes, ids.slice(at,at + 100));
      assert.deepEqual(app.store.read('UserCharacterCostume'), originalCostumes);
      assert.deepEqual(app.store.read('UserCommunicationVoice'), originalVoices);
    }
    const flags = { UserGift: gifts.map(row => ({ ...row, state: 1 })) };
    await reject(push(flags,operations),400);
    parse(await push({ ...flags, UserCharacterCostume: ids.map(id => costume(id,2,id % 2 ? 0 : seed.userId)) }));
    await close(); await open(); await reject(push({},operations),400);
    const required = [...new Set(operations.flatMap(op => app.store.costumeRewards(op).flatMap(target => target.voices.map(row => row.voiceId))))];
    parse(await push({ UserCommunicationVoice: required.map(id => voice(id,3)) },operations));
    assert.equal(required.length,42);
    assert.equal(app.store.db.prepare("SELECT COUNT(*) n FROM costume_unlock_floor WHERE table_name='UserCharacterCostume'").get().n,394);
    assert.equal(app.store.db.prepare("SELECT COUNT(*) n FROM costume_unlock_floor WHERE table_name='UserCommunicationVoice'").get().n,42);
    assert.equal(app.store.db.prepare("SELECT COUNT(*) n FROM costume_unlock_floor WHERE table_name='UserCommunicationVoice' AND state=3").get().n,42,
      'ACK must preserve actual coalesced seen voices, not only captured NEW2');
    assert.deepEqual(app.store.read('UserCommunicationCharacter'),originalCharacters);
    assert.deepEqual(app.store.read('UserPC'),originalPcs);
    await reject(push({},[],{ UserCharacterCostume: [{ costumeId }] }),400);
    await reject(push({ UserCharacterCostume: [costume(costumeId,1)] }),400);
    await reject(push({},[],{ UserCommunicationVoice: [{ voiceId: required[0] }] }),400);
    await reject(push({ UserCommunicationVoice: [voice(required[0],1)] }),400);
    await reject(push({ UserCommunicationVoice: [voice(required[0],2)] }),400);
    // Read/new notifications may advance without losing an earned unlock.
    parse(await push({ UserCharacterCostume: [costume(costumeId,3)] }));
    await close(); await open();
    assert.equal(app.store.db.prepare("SELECT state FROM costume_unlock_floor WHERE table_name='UserCharacterCostume' AND id=?").get(costumeId).state,3);
    await reject(push({ UserCharacterCostume: [costume(costumeId,2)] }),400);

    await fresh('preowned-duplicate');
    put('UserCharacterCostume',[costume(costumeId,3,seed.userId)]);
    put('UserCommunicationVoice',[voice(voices(costumeId)[0],1)]);
    const duplicates = [gift(1),gift(2)]; put('UserGift',duplicates);
    const duplicate = parse(await receive(duplicates)).operations[0];
    assert.deepEqual(duplicate.parameters.receivedCostumes,[costumeId]);
    assert.deepEqual(app.store.costumeRewards(duplicate),[{ costumeId,state:3,isNew:false,voices:[] }]);
    parse(await push({ UserGift: duplicates.map(row => ({ ...row,state:1 })) }));
    await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,[duplicate],
      'An already-owned costume can retain its original idempotent cold callback');
    parse(await push({},[duplicate]));
    assert.equal(app.store.read('UserCommunicationVoice').data[0].voiceState,1,'Preowned native helper does not repeat linked voice unlocks');

    // WRITTEN ONLY: native2505fc4 can finish voices while the costume stays
    // locked, but cannot revisit missing voices after its unlock was saved.
    for(const first of ['voice','costume']) {
      await fresh(`pure-costume-cold-${first}`);
      put('UserCharacterCostume',[]);put('UserCommunicationVoice',[]);
      const source=[gift(1)];put('UserGift',source);
      const operation=parse(await receive(source)).operations[0],linked=voices(costumeId);
      assert.ok(linked.length);
      const costumeSave={UserCharacterCostume:[costume()]},voiceSave={UserCommunicationVoice:linked.map(id=>voice(id))};
      parse(await push(first==='voice'?voiceSave:costumeSave));await close();await open();
      if(first==='voice') assert.deepEqual(parse(await send('user_data/confirm')).operations,[operation]);
      else await reject(send('user_data/confirm'),503,true);
      parse(await push(first==='voice'?costumeSave:voiceSave));await close();await open();
      assert.deepEqual(parse(await send('user_data/confirm')).operations,
        [{...operation,parameters:{...operation.parameters,receivedCostumes:[]}}]);
      assert.deepEqual(app.store.operations(),[operation]);
      parse(await push({UserGift:source.map(row=>({...row,state:1}))},[operation]));
      assert.deepEqual(app.store.operations(),[]);
    }

    // WRITTEN ONLY: the native2000 equipment and costume loops can finish independently.
    await fresh('mixed-equipment-costume-cold');
    put('UserEquipment',[]);put('UserCharacterCostume',[]);put('UserCommunicationVoice',[]);
    const weapon=Number(Object.keys(master.equipments).find(id=>master.equipments[id].type===1));
    const mixedSource=[gift(1,0,{equipmentId:weapon}),gift(2)];put('UserGift',mixedSource);
    const mixedOperation=parse(await receive(mixedSource)).operations[0],linkedVoices=voices(costumeId);
    assert.deepEqual(mixedOperation.parameters.receivedEquipments,[{equipmentId:weapon,amount:1}]);
    assert.deepEqual(mixedOperation.parameters.receivedCostumes,[costumeId]);
    const {type,...equipmentSpec}=app.store.equipmentSpec(weapon),definition=master.equipments[equipmentSpec.equipmentId];
    const piece={userId:seed.userId,...equipmentSpec,slotIndex:1,createAt:now,exp:0,
      durability:definition.durability,reservedDurability:definition.durability,isProtected:false,isUnbreakable:false,
      ...Object.fromEntries(Array.from({length:5},(_,at)=>[`lockedAbility${at+1}`,false]))};
    parse(await push({UserEquipment:[piece]}));await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,
      [{...mixedOperation,parameters:{...mixedOperation.parameters,receivedEquipments:[]}}]);
    parse(await push({UserCharacterCostume:[costume()]}));await close();await open();
    await reject(send('user_data/confirm'),503,true);
    parse(await push({UserCommunicationVoice:linkedVoices.map(id=>voice(id))}));await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,
      [{...mixedOperation,parameters:{...mixedOperation.parameters,receivedEquipments:[],receivedCostumes:[]}}]);
    assert.deepEqual(app.store.operations(),[mixedOperation],'Cold projection must not rewrite the signed source queue');
    parse(await push({UserGift:mixedSource.map(row=>({...row,state:1}))},[mixedOperation]));
    assert.deepEqual(app.store.operations(),[]);

    // WRITTEN ONLY: a prior unsaved SP gift must reach the shared ordered
    // Present projector before the mixed costume preflight can judge replay.
    await fresh('mixed-equipment-costume-stamina-prefix');
    put('UserEquipment',[]);put('UserCharacterCostume',[]);put('UserCommunicationVoice',[]);
    const originalInfo=structuredClone(app.store.read('UserInfo').data),baseSP=originalInfo[0].playerStatus.baseSP;
    const spRows=amount=>{const rows=structuredClone(originalInfo);rows[0].playerStatus.baseSP=amount;return rows;};
    const spId=master.currencies['currency.stamina'],earlierSource=[gift(1,spId,{amount:3})],
      tripleSource=[gift(2,0,{equipmentId:weapon}),gift(3),gift(4,spId,{amount:5})];
    put('UserGift',[...earlierSource,...tripleSource]);
    const earlier=parse(await receive(earlierSource)).operations[0],triple=parse(await receive(tripleSource)).operations[0];
    assert.deepEqual(triple.parameters.receivedItems,[{itemId:spId,amount:5}]);
    assert.deepEqual(parse(await send('user_data/confirm')).operations,[earlier,triple]);
    parse(await push({UserEquipment:[piece]}));await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,
      [earlier,{...triple,parameters:{...triple.parameters,receivedEquipments:[]}}]);
    parse(await push({UserGift:[{...earlierSource[0],state:1},...tripleSource],UserInfo:spRows(baseSP+3)},[earlier]));
    await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,
      [{...triple,parameters:{...triple.parameters,receivedEquipments:[]}}]);
    parse(await push({UserInfo:spRows(baseSP+8)}));await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,
      [{...triple,parameters:{...triple.parameters,receivedItems:[],receivedEquipments:[]}}]);
    parse(await push({UserCommunicationVoice:linkedVoices.map(id=>voice(id)),UserCharacterCostume:[costume()]}));
    await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,
      [{...triple,parameters:{...triple.parameters,receivedItems:[],receivedEquipments:[],receivedCostumes:[]}}]);
    parse(await push({UserGift:[{...earlierSource[0],state:1},...tripleSource.map(row=>({...row,state:1}))]},[triple]));
    assert.deepEqual(app.store.operations(),[]);

    // WRITTEN ONLY: captured medals share the mixed Present, but a partial
    // native stock gain cannot be treated as a complete additive replay.
    await fresh('mixed-equipment-costume-casino-cold');
    put('UserEquipment',[]);put('UserCharacterCostume',[]);put('UserCommunicationVoice',[]);
    const medalBefore={...seed.data.UserCasinoState[0],medalAmount:123,cumulativeMedalAmount:1000,signature:0},
      medalId=master.currencies['currency.casino_medal'],medalSource=[gift(1,0,{equipmentId:weapon}),gift(2),gift(3,medalId,{amount:7})];
    put('UserCasinoState',[medalBefore]);put('UserGift',medalSource);
    const medalOperation=parse(await receive(medalSource)).operations[0];
    assert.equal(medalOperation.parameters.issueCasinoMedal,7);
    parse(await push({UserEquipment:[piece]}));await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,
      [{...medalOperation,parameters:{...medalOperation.parameters,receivedEquipments:[]}}]);
    parse(await push({UserCasinoState:[{...medalBefore,medalAmount:126}]}));await close();await open();
    const partialMedal=JSON.parse(app.store.casinoRewardReceipt(medalOperation).before_stock);
    assert.equal(partialMedal.amountAdded,3);assert.equal(partialMedal.effect,true);assert.equal(partialMedal.observed,false);
    await reject(send('user_data/confirm'),503,true);
    parse(await push({UserCasinoState:[{...medalBefore,medalAmount:130,cumulativeMedalAmount:1007,
      signature:medalOperation.signature}]}));await close();await open();
    assert.equal(JSON.parse(app.store.casinoRewardReceipt(medalOperation).before_stock).observed,true);
    assert.deepEqual(parse(await send('user_data/confirm')).operations,
      [{...medalOperation,parameters:{...medalOperation.parameters,receivedEquipments:[],issueCasinoMedal:0}}]);
    parse(await push({UserCommunicationVoice:linkedVoices.map(id=>voice(id)),UserCharacterCostume:[costume()]}));
    await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,
      [{...medalOperation,parameters:{...medalOperation.parameters,receivedEquipments:[],receivedCostumes:[],issueCasinoMedal:0}}]);
    parse(await push({UserGift:medalSource.map(row=>({...row,state:1}))},[medalOperation]));
    assert.deepEqual(app.store.operations(),[]);

    // WRITTEN ONLY: capped native stock is a third independently saved array;
    // an amount-only prefix must not hide its original item callback.
    await fresh('mixed-equipment-costume-capped-item-cold');
    put('UserEquipment',[]);put('UserCharacterCostume',[]);put('UserCommunicationVoice',[]);
    const itemId=Number(Object.keys(master.itemProfiles).find(id=>master.itemProfiles[id].table==='UserExpItem')),
      itemProfile=master.itemProfiles[itemId],itemBefore={userId:seed.userId,[itemProfile.idField]:itemId,
        amount:0,cumulativeAmount:999999998,bookEntryState:255,signature:0,reservedAmount:0},
      itemSource=[gift(1,0,{equipmentId:weapon}),gift(2),gift(3,itemId)];
    put('UserExpItem',[itemBefore]);put('UserGift',itemSource);
    const itemOperation=parse(await receive(itemSource)).operations[0];
    assert.deepEqual(itemOperation.parameters.receivedItems,[{itemId,amount:1}]);
    parse(await push({UserEquipment:[piece]}));await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,
      [{...itemOperation,parameters:{...itemOperation.parameters,receivedEquipments:[]}}]);
    parse(await push({UserExpItem:[{...itemBefore,amount:1}]}));await close();await open();
    await reject(send('user_data/confirm'),503,true);
    parse(await push({UserExpItem:[{...itemBefore,amount:1,cumulativeAmount:999999999,
      signature:itemOperation.signature}]}));await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,
      [{...itemOperation,parameters:{...itemOperation.parameters,receivedItems:[],receivedEquipments:[]}}]);
    parse(await push({UserCommunicationVoice:linkedVoices.map(id=>voice(id)),UserCharacterCostume:[costume()]}));
    await close();await open();
    assert.deepEqual(parse(await send('user_data/confirm')).operations,
      [{...itemOperation,parameters:{...itemOperation.parameters,receivedItems:[],receivedEquipments:[],receivedCostumes:[]}}]);
    parse(await push({UserGift:itemSource.map(row=>({...row,state:1}))},[itemOperation]));
    assert.deepEqual(app.store.operations(),[]);

    for (const firstShop of [false,true]) {
      await fresh(`shared-shop-${firstShop}`); app.store.changePaidCurrency(10000);
      const gifts = [gift(1)]; put('UserGift',gifts); let shop, present;
      for (const kind of firstShop ? ['shop','gift'] : ['gift','shop']) {
        if (kind === 'shop') shop = parse(await send('shop/buy',{ shopProductId:207003535 }));
        else present = parse(await receive(gifts));
      }
      const operations = [shop.operations[0],present.operations[0]], bought = master.shopProducts[207003535];
      const save = { UserGift: gifts.map(row => ({ ...row,state:1 })), UserCharacterCostume:[costume()],
        UserCommunicationVoice: voices(costumeId).map(id => voice(id,2,seed.userId)),
        UserShopProduct:[{ userId:seed.userId,shopProductId:207003535,count:shop.count,lastExchangedAt:shop.lastExchangedAt,readState:1 }],
        UserGachaTicket:[{ userId:seed.userId,gachaTicketId:296000014,bookEntryState:1,cumulativeAmount:2,signature:shop.operations[0].signature,
          dateList:[{ aquiredAt:shop.lastExchangedAt },{ aquiredAt:shop.lastExchangedAt }] }] };
      parse(await push(save,operations)); await close(); await open();
      assert.equal(app.store.operations().length,0); assert.equal(app.store.paidCurrency(),10000 - bought.price);
      assert.equal(app.store.read('UserCharacterCostume').data.filter(row => row.costumeId === costumeId).length,1);
    }

    // Independently saved costume/voice components must suppress the entire
    // real operation, while preserving mixed item/count/flag ACK requirements.
    for (const source of ['gift','shop']) for (const component of ['costume','voice']) {
      await fresh(`${source}-${component}-first`); app.store.changePaidCurrency(10000);
      put('UserCharacterCostume',[]); put('UserCommunicationVoice',[]);
      const gifts = [gift(1),gift(2,master.currencies['currency.gem'],{ amount:17 })];
      if (source === 'gift') put('UserGift',gifts);
      const action = source === 'gift' ? 'gift/receive' : 'shop/buy',
        body = source === 'gift' ? { userId:seed.userId,giftIds:[1,2] } : { shopProductId:207003535 },
        pullBody = { tables:['UserCharacterCostume','UserCommunicationVoice','UserShopProduct'] };
      assert.equal((await send('user_data/pull',pullBody)).status,200); const pullIdentity = sequence;
      const result = parse(await send(action,body)), identity = sequence, operation = result.operations[0],
        receipt = app.store.db.prepare('SELECT * FROM costume_reward_claim WHERE operation_id=?').get(operation.id),
        prior = JSON.parse(receipt.before_states), allVoices = voices(costumeId);
      if(source==='gift') {
        // Preserve the pre-capture mixed-Iris queue as a legacy cold-refusal fixture.
        app.store.db.prepare('UPDATE gift_claim SET iris_capture_version=0 WHERE operation_id=?').run(operation.id);
        app.store.db.prepare('DELETE FROM gift_item_claim WHERE operation_id=? AND item_id=?')
          .run(operation.id,master.currencies['currency.gem']);
      }
      assert.equal(prior[0].state,1); assert(prior[0].voices.every(row => row.state === 1));
      assert.equal(app.store.read('UserCharacterCostume').data.length,0);
      assert.equal(app.store.read('UserCommunicationVoice').data.length,0,'No unlock pre-credit');
      const partial = component === 'costume' ? { UserCharacterCostume:[costume()] } :
        { UserCommunicationVoice:allVoices.map(id => voice(id)) };
      app.store.db.exec("CREATE TRIGGER fail_voice_observe BEFORE UPDATE ON costume_reward_claim BEGIN SELECT RAISE(ABORT,'voice checkpoint rollback'); END");
      await reject(push(partial),503); app.store.db.exec('DROP TRIGGER fail_voice_observe');
      const saved = parse(await push(partial)); assert(!saved.operations.some(row => row.id === operation.id));
      assert.deepEqual(app.store.operations(),[operation]);
      const observed = JSON.parse(app.store.db.prepare('SELECT observed FROM costume_reward_claim WHERE operation_id=?').get(operation.id).observed);
      assert.deepEqual(observed,component === 'costume' ? [`c:${costumeId}`] : allVoices.map(id => `v:${id}`).sort());
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM costume_unlock_floor').get().n,0);
      await close(); await open();
      await reject(send(action,body),503,true);
      await reject(request(port,identity,body,String(identity),action),503,true);
      await reject(send('user/login'),503,true); await reject(send('user_data/confirm'),503,true);
      await reject(send('user_data/pull',pullBody),503,true); await reject(push({},[operation]),400);
      if (component === 'costume') {
        await reject(push({ UserCharacterCostume:[costume(costumeId,1)] }),400);
        await reject(push({},[],{ UserCharacterCostume:[{ costumeId }] }),400);
      } else {
        await reject(push({ UserCommunicationVoice:[voice(allVoices[0],1)] }),400);
        await reject(push({},[],{ UserCommunicationVoice:[{ voiceId:allVoices[0] }] }),400);
      }
      const complete = { UserCharacterCostume:[costume()],UserCommunicationVoice:allVoices.map(id => voice(id,2,seed.userId)) };
      if (source === 'gift') complete.UserGift = gifts.map(row => ({ ...row,state:1 }));
      else {
        complete.UserShopProduct = [{ userId:seed.userId,shopProductId:207003535,count:result.count,
          lastExchangedAt:result.lastExchangedAt,readState:1 }];
        await reject(push(complete,[operation]),400);
        complete.UserGachaTicket = [{ userId:seed.userId,gachaTicketId:296000014,bookEntryState:1,cumulativeAmount:2,signature:operation.signature,
          dateList:[{ aquiredAt:result.lastExchangedAt },{ aquiredAt:result.lastExchangedAt }] }];
      }
      parse(await push(complete)); await close(); await open();
      for (const table of ['costume_unlock_floor','operation_done','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_voice_ack BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'voice ACK rollback'); END`);
        await reject(push({},[operation]),503); app.store.db.exec('DROP TRIGGER fail_voice_ack');
      }
      parse(await push({},[operation])); await close(); await open(); assert.deepEqual(app.store.operations(),[]);
      await reject(request(port,identity,body,String(identity),action),503,true);
      await reject(request(port,pullIdentity,pullBody,String(pullIdentity),'user_data/pull'),503,true);
      assert.equal(app.store.hardCurrency(),source === 'gift' ? 17 : 0);
      assert.equal(app.store.paidCurrency(),source === 'gift' ? 10000 : 10000-master.shopProducts[207003535].price);
    }

    await fresh('already-owned-linked-voices');
    put('UserCharacterCostume',[]);
    const already = voices(costumeId).map(id => voice(id,2)); put('UserCommunicationVoice',already);
    const newCostume = [gift(1)]; put('UserGift',newCostume);
    const ownsVoices = parse(await receive(newCostume)).operations[0];
    assert.deepEqual(parse(await push({ UserCommunicationVoice:already })).operations,[],
      'An unchanged preowned linked voice cannot acknowledge or clear the pending native receipt');
    assert.deepEqual(app.store.operations(),[ownsVoices]);
    assert.deepEqual(parse(await receive(newCostume)).operations,[ownsVoices]);
    await reject(push({ UserCommunicationVoice:[voice(already[0].voiceId,1)] }),400);
    parse(await push({ UserCharacterCostume:[costume()],UserGift:newCostume.map(row => ({ ...row,state:1 })) },[ownsVoices]));

    await fresh('invalid-gifts-saves');
    for (const change of [{ amount:2 },{ itemLevel:1 },{ equipmentId:1 },{ equipmentEvolveCount:1 },
      { pcLimitBreakCount:1 },{ pcHeroSublimateCount:1 },{ itemId:42 }]) {
      const gifts = [gift(1,costumeId,change)]; put('UserGift',gifts); await reject(receive(gifts),503,true);
    }
    const source = [gift(1)]; put('UserGift',source); const issued = parse(await receive(source)).operations[0];
    for (const invalid of [{ userId:9 },{ costumeState:0 },{ costumeState:4 },{ costumeState:'2' },{ costumeId:42 }])
      await reject(push({ UserCharacterCostume:[{ ...costume(),...invalid }] }),400);
    await reject(push({ UserCharacterCostume:[costume(),costume()] }),400);
    await reject(push({},[],{ UserCharacterCostume:[{ userId:0 }] }),400);
    await reject(push({},[],{ UserCharacterCostume:[{ costumeId:String(costumeId) }] }),400);
    for (const invalid of [{ userId:9 },{ voiceState:0 },{ voiceState:4 },{ voiceState:'2' },{ voiceId:42 }])
      await reject(push({ UserCommunicationVoice:[{ ...voice(voices(costumeId)[0]),...invalid }] }),400);
    await reject(push({ UserCommunicationVoice:[voice(voices(costumeId)[0]),voice(voices(costumeId)[0])] }),400);
    await reject(push({},[],{ UserCommunicationVoice:[{ userId:0 }] }),400);
    parse(await push({ UserCharacterCostume:[costume()],UserCommunicationVoice:voices(costumeId).slice(0,-1).map(id => voice(id)),
      UserGift:source.map(row => ({ ...row,state:1 })) })); await reject(push({},[issued]),400);
    parse(await push({ UserCommunicationVoice:[voice(voices(costumeId).at(-1))] },[issued]));

    await fresh('history'); const historyGift = [gift(1)]; put('UserGift',historyGift);
    const first = await receive(historyGift), identity = sequence, pending = parse(first).operations[0];
    const receipt = app.store.db.prepare('SELECT * FROM costume_reward_claim').get();
    app.store.db.prepare('DELETE FROM costume_reward_claim').run(); await close(); await open();
    await reject(receive(historyGift),503,true);
    await reject(request(port,identity,{ userId:seed.userId,giftIds:[1] },String(identity),'gift/receive'),503,true);
    await reject(push({},[pending]),503,true);
    app.store.db.prepare('INSERT INTO costume_reward_claim(operation_id,rewards,targets,before_states,observed) VALUES(?,?,?,?,?)')
      .run(receipt.operation_id,receipt.rewards,receipt.targets,receipt.before_states,receipt.observed);
    for (const [column,replacement] of [['before_states',null],['before_states','[]'],['before_states','not-json'],['observed','["v:unknown"]']]) {
      app.store.db.prepare(`UPDATE costume_reward_claim SET ${column}=?`).run(replacement);
      await reject(receive(historyGift),503,true); await reject(push({},[pending]),503,true);
      assert.deepEqual(app.store.operations(),[pending]);
      app.store.db.prepare(`UPDATE costume_reward_claim SET ${column}=?`).run(receipt[column]);
    }
    app.store.db.prepare('UPDATE costume_reward_claim SET targets=?').run(JSON.stringify([{ costumeId,state:2,isNew:true,voices:[] }]));
    await reject(receive(historyGift),503,true); app.store.db.prepare('UPDATE costume_reward_claim SET targets=?').run(receipt.targets);
    const invalidTargets = JSON.parse(receipt.targets); invalidTargets[0].voices[0].voiceId = String(invalidTargets[0].voices[0].voiceId);
    app.store.db.prepare('UPDATE costume_reward_claim SET targets=?').run(JSON.stringify(invalidTargets));
    await reject(receive(historyGift),503,true); app.store.db.prepare('UPDATE costume_reward_claim SET targets=?').run(receipt.targets);
    now += 1000; assert.deepEqual(parse(await receive(historyGift)).operations,[pending]);
    assert.deepEqual((await request(port,identity,{ userId:seed.userId,giftIds:[1] },String(identity),'gift/receive')).body,first.body);
    now -= 1000;

    await fresh('rollback');
    const mixed = [gift(1),gift(2,master.currencies['currency.gem'],{ amount:17 })]; put('UserGift',mixed);
    for (const [table,event] of [['hard_currency','UPDATE'],['operation_queue','INSERT'],['costume_reward_claim','INSERT'],
      ['gift_claim','INSERT'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_costume BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'costume issue rollback'); END`);
      await reject(receive(mixed),503); app.store.db.exec('DROP TRIGGER fail_costume');
    }
    const operation = parse(await receive(mixed)).operations[0];
    const gemTarget=app.store.db.prepare('SELECT * FROM gift_item_claim WHERE operation_id=? AND item_id=?')
      .get(operation.id,master.currencies['currency.gem']),currencyRows=app.store.read('UserCurrency').data,
      gem=currencyRows.find(row=>row.currencyId===gemTarget.item_id) ?? {userId:seed.userId,currencyId:gemTarget.item_id,
        amount:0,reservedAmount:0,bookEntryState:1,signature:0,cumulativeAmount:0};
    const save = { UserCharacterCostume:[costume()],UserCommunicationVoice:voices(costumeId).map(id => voice(id)),
      UserGift:mixed.map(row => ({ ...row,state:1 })),
      UserCurrency:[...currencyRows.filter(row=>row.currencyId!==gemTarget.item_id),
        {...gem,bookEntryState:3,cumulativeAmount:gemTarget.cumulative_amount}] };
    for (const [table,event] of [['profile','UPDATE'],['costume_unlock_floor','INSERT'],['operation_done','INSERT'],
      ['operation_queue','DELETE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_costume_save BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'costume save rollback'); END`);
      await reject(push(save,[operation]),503); app.store.db.exec('DROP TRIGGER fail_costume_save');
    }
    parse(await push(save,[operation])); assert.equal(app.store.hardCurrency(),17);
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    console.log('Costume394/linked voices42/native owner0/read-state/split/replay/shared shop/ownership/history/rollback probes OK; native acceptance pending');
  } finally {
    await close(); const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('danmemore-costume-rewards-')); fs.rmSync(resolved,{ recursive:true,force:true });
  }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
