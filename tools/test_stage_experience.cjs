'use strict';

// DEFERRED: synthetic saves/gear, not native EXP, signatures or combat acceptance.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE, guildRaidAttemptState, guildRaidNativeEvent } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-stage-xp-'));
  let app, database, port, sequence = 0, rejection, wall=1790866800;
  const open = async () => {
    app = createServer({ database,seed,master,wallNowSeconds:()=>wall,log:line=>{
      const entry=JSON.parse(line);if(entry.event==='rejected') rejection=entry.reason;
    } });
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const send = (action,body)=>{rejection=undefined;return request(port,++sequence,body,String(sequence),action);};
  const parse = reply=>{ assert.equal(reply.status,200,rejection ?? reply.body.toString()); return JSON.parse(reply.body); };
  const snapshot = ()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const put = (name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const users = ()=>app.store.read('UserInfo').data;
  const user = (exp,sp)=>users().map(row=>({ ...row,playerStatus:{ ...row.playerStatus,totalExp:exp,
    level:master.playerLevels.findLast(([,threshold])=>threshold<=exp)[0],baseSP:sp } }));
  const push = (putItems={},operations=[],deleteItems={})=>send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name] ?? [])]))},
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length ? [{signature:0,trigger:'AdventureComplete',putItems,deleteItems}] : [],
    operations:operations.map(row=>({id:row.id,verifier:row.token})),
  });
  const rejected = async (pending,status,before=snapshot(),structured=true)=>{
    const reply = await pending; assert.equal(reply.status,status,rejection ?? reply.body.toString());
    if (status===503) structured ? assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE) : assert.equal(reply.body.length,0);
    assert.equal(snapshot(),before,'Rejected result must preserve save, queue, receipts, sequence and exact reply');
  };
  const value = { adventureStageId:1010000101101,token:'stage-xp',adventureStageTaskIds:[],adventureGainedItems:[],
    friendshipStates:[],adventureRecord:{continueCount:0,deathCount:0,turnCount:3},
    isEnemyAnnihilated:true,secretMissionCompleted:false };
  const complete = body=>send('adventure/stage/complete',body);
  const clear = operation=>{
    const before = operation.parameters.UserAdventureStage[0];
    return { ...before,state:4,cumulativeClearCount:before.cumulativeClearCount+Math.max(1,operation.parameters.skipCount),
      firstCompleteDateTime:before.firstCompleteDateTime || app.store.gameNowSeconds(),lastCompleteDateTime:app.store.gameNowSeconds() };
  };
  const loot = operation=>{
    const result = {UserAdventureStage:[clear(operation)]};
    const receipt = app.store.db.prepare('SELECT next_unlock FROM stage_delivery WHERE operation_id=?').get(operation.id),
      target = receipt.next_unlock ? JSON.parse(receipt.next_unlock) : null;
    if (target?.stageId && [null,0].includes(target.beforeState) && target.lowerStates.every(([,state])=>state===4))
      result.UserAdventureStage.push({ ...app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===target.stageId),
        userId:seed.userId,adventureStageId:target.stageId,state:1 });
    for (const target of app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(operation.id)) {
      const prior = app.store.read(target.table_name).data.find(row=>row[target.id_field]===target.item_id),
        stock=target.stock_state?JSON.parse(target.stock_state):null;
      (result[target.table_name] ??= []).push({ ...prior,userId:seed.userId,[target.id_field]:target.item_id,
        ...(target.table_name==='UserGachaTicket'?{bookEntryState:prior.bookEntryState===1?3:prior.bookEntryState,
          dateList:prior.dateList.filter(row=>app.store.gameNowSeconds()<row.aquiredAt+master.lotteryTickets[target.item_id])
            .concat(Array.from({length:operation.parameters.gainedItems.find(row=>row.itemId===target.item_id).amount},()=>({aquiredAt:app.store.gameNowSeconds()})))}:
          {amount:stock?.amount ?? 0}),cumulativeAmount:target.cumulative_amount,signature:operation.signature });
    }
    return result;
  };
  const recoverXp=async(operation,expected,originalCold)=>{
    const before=snapshot(),savedUsers=users();
    assert.deepEqual(app.store.stageColdRecovery(operation),expected);assert.equal(snapshot(),before,'XP recovery is pure derivation');
    assert.deepEqual(parse(await request(port,originalCold.identity,undefined,String(originalCold.identity),'user_data/confirm')).operations,[expected]);
    const cold=await send('user_data/confirm'),identity=sequence;
    assert.deepEqual(parse(cold).operations,[expected]);parse(await send('user/login'));
    assert.equal((await send('user_data/pull',{tables:['UserInfo','UserAdventureStage']})).status,200);
    assert.deepEqual(users(),savedUsers,'Recovery does not recredit EXP/level/SP or any player field');
    await close();await open();assert.deepEqual((await request(port,identity,undefined,String(identity),'user_data/confirm')).body,cold.body);
    const bad=JSON.parse(cold.body);bad.operations[0].parameters.offlineStageXpApplied=0;
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(Buffer.from(JSON.stringify(bad)).toString('base64'),`${identity}/${identity}`);
    await rejected(request(port,identity,undefined,String(identity),'user_data/confirm'),503);
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(cold.body.toString('base64'),`${identity}/${identity}`);
    assert.deepEqual(app.store.operations(),[operation],'The original full operation remains queued until actual mixed ACK');
    assert.equal(app.store.db.prepare('SELECT operation_json FROM stage_delivery WHERE operation_id=?').get(operation.id).operation_json,JSON.stringify(operation));
  };
  const gear = { userId:seed.userId,slotIndex:1,equipmentId:24000001001,createAt:1790866700,
    rarity:1,performance:4,exp:0,durability:0,reservedDurability:0,signature:0,isProtected:false,isUnbreakable:false,
    abilityId1:21000034002,abilityId2:0,abilityId3:0,abilityId4:0,abilityId5:0,
    lockedAbility1:false,lockedAbility2:false,lockedAbility3:false,lockedAbility4:false,lockedAbility5:false };
  try {
    assert.equal(Object.keys(master.stageExperience).length,Object.keys(master.stages).length);
    assert.equal(master.stageExperience[value.adventureStageId],96);
    assert.equal(master.stageExperience[1010000101103],0);
    for (const boosted of [false,true]) for (const xpFirst of [false,true]) {
      database = path.join(directory,`${boosted}-${xpFirst}.sqlite`); await open();
      //96 alone does not level a fresh player; starting at96 crosses100.
      put('UserInfo',user(96,20));
      if (boosted) {
        put('UserEquipment',[gear]);
        put('UserPC',app.store.read('UserPC').data.map(row=>({ ...row,equippedWeaponIndex:1 })));
      }
      put('UserParty',app.store.read('UserParty').data.map(row=>row.id===users()[0].activePartyId ?
        { ...row,slots:[...row.slots].reverse() } : row));
      const original = users(), pullBody = {tables:['UserInfo','UserParty','UserEquipment']};
      assert.equal((await send('user_data/pull',pullBody)).status,200); const pullIdentity = sequence;
      for (const table of ['stage_xp_claim','stage_delivery','stage_completion','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_issue BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'XP issue failure'); END`);
        await rejected(complete(value),503,snapshot(),false); app.store.db.exec('DROP TRIGGER fail_issue');
      }
      const operation = parse(await complete(value)).operation, identity = sequence;
      assert.deepEqual(users(),original,'Issuance must not pre-credit native EXP/SP/level/signature');
      assert.equal(operation.parameters.activeTimeAvailable,false,'No Familia means no invented activity bonus');
      assert.equal(Object.hasOwn(operation.parameters,'experience'),false,'No invented EXP response field');
      const capture = app.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?').get(operation.id);
      assert.equal(capture.amount,boosted ? 110 : 96); assert.equal(capture.before_exp,96);
      assert.equal(capture.minimum_exp,96+capture.amount); assert.equal(capture.sp_amount,21);
      assert.equal(capture.sp_before,20); assert.equal(capture.sp_minimum,41);
      const originalCold={response:await send('user_data/confirm'),identity:sequence};
      assert.deepEqual(parse(originalCold.response).operations,[operation]);
      const parties = app.store.read('UserParty').data, active = parties.find(row=>row.id===capture.party_id),
        reordered = { ...active,slots:[...active.slots].reverse() };
      assert.deepEqual(JSON.parse(capture.inputs).map(row=>row.slotNumber),[1,2,3,4,5,6]);
      parse(await push({UserParty:[reordered]}));
      assert.deepEqual(app.store.operations(),[operation]);
      assert.deepEqual(parse(await complete(value)).operation,operation,'Array reordering is not a changed native party');
      const changed = { ...active,slots:active.slots.map(row=>row.slotNumber===1 ? { ...row,pcId:0 } : row) };
      await rejected(push({UserParty:[changed]}),400);
      // Older captures may use the old save-array order. Compare by slot, but
      // keep their exact original private receipt and reservation unchanged.
      const legacyInputs = JSON.stringify(JSON.parse(capture.inputs).reverse());
      app.store.db.prepare('UPDATE stage_xp_claim SET inputs=? WHERE operation_id=?').run(legacyInputs,operation.id);
      parse(await push({UserInfo:users()}));
      assert.deepEqual(parse(await request(port,identity,value,String(identity),'adventure/stage/complete')).operation,operation);
      await close(); await open();
      assert.deepEqual(parse(await complete(value)).operation,operation);
      assert.equal(app.store.db.prepare('SELECT inputs FROM stage_xp_claim WHERE operation_id=?').get(operation.id).inputs,legacyInputs);
      const hiddenGuest = { ...reordered,supporterPartySlot:{ ...reordered.supporterPartySlot,
        pc:{ ...reordered.supporterPartySlot.pc,pcId:active.slots.find(row=>row.pcId)?.pcId } } };
      await rejected(push({UserParty:[hiddenGuest]}),503);
      if (boosted) await rejected(push({UserEquipment:[{ ...gear,abilityId1:0 }]}),400);
      parse(await push({UserParty:[active]}));
      app.store.db.prepare('UPDATE stage_xp_claim SET inputs=? WHERE operation_id=?').run(capture.inputs,operation.id);
      await rejected(push(loot(operation),[operation]),400);
      await rejected(push({ ...loot(operation),UserInfo:user(capture.minimum_exp,20) },[operation]),400,
        snapshot()); // Saved EXP alone is not the original level-up SP award.
      const wrongLevel = user(capture.minimum_exp,41); wrongLevel[0].playerStatus.level=1;
      await rejected(push({UserInfo:wrongLevel}),400);
      for (const replacement of ['{}','not-json']) {
        app.store.db.prepare('UPDATE stage_xp_claim SET inputs=? WHERE operation_id=?').run(replacement,operation.id);
        await rejected(complete(value),503);
        app.store.db.prepare('UPDATE stage_xp_claim SET inputs=? WHERE operation_id=?').run(capture.inputs,operation.id);
      }
      app.store.db.prepare('DELETE FROM stage_xp_claim WHERE operation_id=?').run(operation.id);
      await rejected(complete(value),503);
      const keys = Object.keys(capture);
      app.store.db.prepare(`INSERT INTO stage_xp_claim(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...Object.values(capture));
      const changedParty = users().map(row=>({ ...row,activePartyId:2 }));
      await rejected(push({UserInfo:changedParty}),400);
      await rejected(complete({ ...value,token:'second-pending-xp' }),400);
      const effects = {UserInfo:user(capture.minimum_exp,41)}, first = xpFirst ? effects : loot(operation),
        remaining = xpFirst ? loot(operation) : effects;
      for (const [table,event] of [['profile','UPDATE'],['stage_delivery','UPDATE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_effect BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'XP observation failure'); END`);
        await rejected(push(first),503,snapshot(),false); app.store.db.exec('DROP TRIGGER fail_effect');
      }
      const partial = parse(await push(first)); assert.deepEqual(partial.operations,[]);
      assert.deepEqual(app.store.operations(),[operation]);
      await rejected(complete(value),503);
      await rejected(request(port,identity,value,String(identity),'adventure/stage/complete'),503);
      if(xpFirst) await recoverXp(operation,{...operation,parameters:{...operation.parameters,offlineStageXpApplied:1}},originalCold);
      else {
        await rejected(send('user_data/confirm',undefined),503);
        await rejected(send('user_data/pull',{tables:['UserInfo']}),503);
      }
      await close(); await open();
      if(xpFirst) parse(await send('user/login'));else await rejected(send('user/login',undefined),503);
      await rejected(push({},[operation]),400);
      parse(await push(remaining));
      assert.equal(app.store.db.prepare('SELECT sp_effect_saved FROM stage_xp_claim WHERE operation_id=?').get(operation.id).sp_effect_saved,1);
      // Native level-up SP is spendable; its saved proof survives spending.
      parse(await push({UserInfo:user(capture.minimum_exp,0)}));
      await rejected(push({UserInfo:user(capture.before_exp,0)}),400);
      for (const [table,event] of [['stage_xp_floor','INSERT'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'XP ACK failure'); END`);
        await rejected(push({},[operation]),503,snapshot(),false); app.store.db.exec('DROP TRIGGER fail_ack');
      }
      parse(await push({},[operation])); await close(); await open();
      assert.deepEqual(app.store.operations(),[]);
      assert.equal(app.store.db.prepare('SELECT total_exp FROM stage_xp_floor WHERE user_id=?').get(seed.userId).total_exp,capture.minimum_exp);
      await rejected(push({UserInfo:user(capture.before_exp,0)}),400);
      await rejected(push({},[],{UserInfo:users()}),503);
      await rejected(request(port,pullIdentity,pullBody,String(pullIdentity),'user_data/pull'),503);
      await rejected(complete(value),503);
      parse(await push({},[operation]));
      // A legitimate later level-up is monotonic, not an immutable level lock.
      parse(await push({UserInfo:user(350,0)}));
      await close();
    }
    // Saved guest snapshots are synthetic prerequisites, not a guest roster
    // producer, natural battle eligibility, native signatures or cache proof.
    for(const kind of ['snapshot','local-index','backline','unmatched','assist-only']) {
      database=path.join(directory,`guest-${kind}.sqlite`); await open();
      put('UserInfo',user(96,20));
      const pcs=app.store.read('UserPC').data,first=pcs[0],parties=app.store.read('UserParty').data,
        active=parties.find(row=>row.id===users()[0].activePartyId),
        guestId=Number(Object.keys(master.pcProfiles).find(id=>Number(id)!==first.pcId && master.pcProfiles[id].characterId>0)),
        armor={ ...gear,slotIndex:10001,equipmentId:24000011001,abilityId1:21000034001 },
        template=structuredClone(active.supporterPartySlot);
      put('UserEquipment',[gear,armor]);
      put('UserPC',[{ ...first,equippedWeaponIndex:1 }]);
      const guest={ ...template,slotNumber:kind==='backline'?4:kind==='unmatched'?7:1,
        pcId:kind==='assist-only'?0:guestId,assistingPcId:first.pcId,supporterUserId:2,
        pc:{ ...template.pc,userId:2,pcId:kind==='assist-only'?0:guestId,ownerType:kind==='local-index'?1:3,
          equippedWeaponIndex:kind==='local-index'?1:499,equippedArmorIndex:kind==='local-index'?10001:10499 },
        assistingPc:{ ...template.assistingPc,pcId:first.pcId,equippedWeaponIndex:1,equippedArmorIndex:10001 },
        weapon:kind==='local-index'?template.weapon:{ ...gear,userId:2,slotIndex:0 },
        armor:kind==='local-index'?template.armor:{ ...armor,userId:2,slotIndex:0 } },
        selected={ ...active,supporterPartySlot:guest },originalInfo=users();
      put('UserParty',parties.map(row=>row.id===active.id?selected:row));
      if(kind==='snapshot') {
        for(const change of [g=>{g.pcId=0;},g=>{g.pc.ownerType=256;},g=>{g.slotNumber=-1;},
          g=>{g.weapon.userId=-1;},g=>{g.weapon.slotIndex=-1;},g=>{g.weapon.equipmentId=24000011001;},
          g=>{g.armor.abilityId1=Number.MAX_SAFE_INTEGER;},g=>{delete g.weapon;}]) {
          const bad=structuredClone(selected); change(bad.supporterPartySlot);
          put('UserParty',parties.map(row=>row.id===active.id?bad:row));
          await rejected(complete(value),503);
        }
        put('UserParty',parties.map(row=>row.id===active.id?selected:row));
      }
      const operation=parse(await complete(value)).operation,identity=sequence,
        claim=app.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?').get(operation.id),inputs=JSON.parse(claim.inputs),
        usesGuest=!['unmatched','assist-only'].includes(kind);
      const originalCold={response:await send('user_data/confirm'),identity:sequence};
      assert.deepEqual(parse(originalCold.response).operations,[operation]);
      assert.equal(claim.amount,kind==='backline'?129:usesGuest?115:110);
      assert.equal(inputs.length,6,'A guest substitutes one slot, never a seventh main');
      assert.equal(inputs.filter(row=>row.guest).length,usesGuest?1:0);
      assert.deepEqual(users(),originalInfo,'Guest XP must not pre-credit EXP, level, SP or signatures');
      assert.deepEqual(app.store.read('UserPC').data,[{ ...first,equippedWeaponIndex:1 }],
        'Borrowing must not import a guest as an owned unit');
      assert.deepEqual(app.store.read('UserEquipment').data,[gear,armor],'Borrowed snapshots are not owned inventory');
      if(usesGuest) {
        const input=inputs.find(row=>row.guest);
        assert.equal(input.pcId,guestId);
        assert.equal(input.weapon.slotIndex,kind==='local-index'?1:0);
        assert.equal(input.weapon.userId,kind==='local-index'?undefined:2);
        assert.deepEqual(input.guest,{userId:2,supporterUserId:2,ownerType:kind==='local-index'?1:3});
        if(kind==='snapshot') {
          const fixed=structuredClone(inputs),captured=fixed.find(row=>row.guest);
          captured.weapon={ ...captured.weapon,equipmentId:24000099024,abilities:[0,0,0,0,0] };
          captured.armor=null;
          assert.deepEqual(app.store.expeditionBoosts(fixed,6),{
            boost_xp:Math.fround(Math.fround(5*12345+10000)/10000),boost_valis:1 },
          'All five original fixed abilities survive the decompiler omission; debug gear is not obtainability proof');
        }
        const reordered={ ...selected,slots:[...selected.slots].reverse() };
        parse(await push({UserParty:[reordered]}));
        await rejected(push({UserParty:[{ ...selected,supporterPartySlot:{ ...guest,supporterUserId:3 } }]}),400);
        if(kind==='local-index') await rejected(push({UserEquipment:[{ ...gear,abilityId1:0 }]}),400);
        else for(const change of [{abilityId1:0},{userId:3}]) await rejected(push({UserParty:[{ ...selected,supporterPartySlot:{ ...guest,
          weapon:{ ...guest.weapon,...change } } }]}),400);
        const dispatchInputs=inputs.slice(0,4);
        if(dispatchInputs.some(row=>row.guest)) assert.throws(()=>app.store.expeditionBoosts(dispatchInputs),/slot receipt/,
          'Stage guest support must not relax the four-slot dispatch provider');
      }
      assert.deepEqual(parse(await request(port,identity,value,String(identity),'adventure/stage/complete')).operation,operation);
      await close(); await open();
      assert.deepEqual(parse(await complete(value)).operation,operation);
      assert.equal(app.store.db.prepare('SELECT inputs FROM stage_xp_claim WHERE operation_id=?').get(operation.id).inputs,claim.inputs);
      await rejected(push(loot(operation),[operation]),400);
      parse(await push({UserInfo:user(claim.minimum_exp,claim.sp_minimum)}));
      await rejected(complete(value),503);
      await close(); await open();
      await recoverXp(operation,{...operation,parameters:{...operation.parameters,offlineStageXpApplied:1}},originalCold);
      for(const [table,event] of [['profile','UPDATE'],['stage_xp_floor','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_guest BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'Guest XP ACK rollback'); END`);
        await rejected(push(loot(operation),[operation]),503,snapshot(),false); app.store.db.exec('DROP TRIGGER fail_guest');
      }
      parse(await push(loot(operation),[operation])); await close(); await open();
      assert.deepEqual(app.store.operations(),[]);
      assert.equal(app.store.db.prepare('SELECT total_exp FROM stage_xp_floor WHERE user_id=?').get(seed.userId).total_exp,claim.minimum_exp);
      await rejected(push({UserInfo:user(claim.before_exp,0)}),400);
      await close();
    }
    // WRITTEN ONLY:26 source-recovery contexts across all13 authored positive-XP families, with/without original gear boosts.
    const examples=new Map();
    for(const [id,amount] of Object.entries(master.stageExperience)) if(amount>0 && !examples.has(master.stages[id].adventureType))
      examples.set(master.stages[id].adventureType,Number(id));
    assert.equal(examples.size,13);
    for(const [type,stageId] of examples) for(const boosted of [false,true]) {
      database=path.join(directory,`cold-xp-${type}-${boosted}.sqlite`);await open();put('UserInfo',user(99,20));
      const before={...app.store.read('UserAdventureStage').data[0],adventureStageId:stageId,state:4,cumulativeClearCount:2,
        dailyClearCount:0,firstCompleteDateTime:wall-60,lastCompleteDateTime:wall-60,
        tasks:Object.entries(master.stageTasks).filter(([,task])=>task.stageId===stageId).map(([id])=>({adventureStageTaskId:Number(id),state:2}))};
      put('UserAdventureStage',[before]);
      if(boosted) {put('UserEquipment',[gear]);put('UserPC',app.store.read('UserPC').data.map(row=>({...row,equippedWeaponIndex:1})));}
      const numericId=master.items['status_board_item.special'],datedId=master.items['gacha_ticket.normal'];
      put('UserStatusBoardItem',[...app.store.read('UserStatusBoardItem').data.filter(row=>row.statusBoardItemId!==numericId),
        {userId:seed.userId,statusBoardItemId:numericId,amount:7,reservedAmount:0,cumulativeAmount:999999998,bookEntryState:3,signature:7}]);
      put('UserGachaTicket',[...app.store.read('UserGachaTicket').data.filter(row=>row.gachaTicketId!==datedId),
        {userId:seed.userId,gachaTicketId:datedId,dateList:[],cumulativeAmount:100,bookEntryState:3,signature:7}]);
      const body={...value,adventureStageId:stageId,token:`cold-xp-${type}-${boosted}`,
        adventureGainedItems:[{itemId:numericId,amount:2},{itemId:datedId,amount:2}]},operation=parse(await complete(body)).operation,
        claim=app.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?').get(operation.id),
        originalCold={response:await send('user_data/confirm'),identity:sequence};
      assert.deepEqual(parse(originalCold.response).operations,[operation]);assert(claim.sp_amount>0);
      assert.equal(Object.hasOwn(operation.parameters,'offlineStageXpApplied'),false,'Fresh original callbacks have no offline recovery field');
      parse(await push({UserInfo:user(claim.minimum_exp,20)}));await rejected(send('user_data/confirm'),503);
      assert.equal(app.store.db.prepare('SELECT sp_effect_saved FROM stage_xp_claim WHERE operation_id=?').get(operation.id).sp_effect_saved,0);
      parse(await push({UserInfo:user(claim.minimum_exp,claim.sp_minimum)}));
      const expected={...operation,parameters:{...operation.parameters,offlineStageXpApplied:1}};
      await recoverXp(operation,expected,originalCold);await rejected(push({},[operation]),400);
      parse(await push({UserInfo:user(claim.minimum_exp,0)}));await recoverXp(operation,expected,originalCold);
      const saved=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserInfo'").get(),
        restore=()=>app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserInfo'").run(saved.data,saved.token);
      put('UserInfo',user(claim.minimum_exp+1,0));await rejected(send('user_data/confirm'),503);restore();
      app.store.db.prepare('UPDATE stage_xp_claim SET sp_effect_saved=0 WHERE operation_id=?').run(operation.id);
      await rejected(send('user_data/confirm'),503);
      app.store.db.prepare('UPDATE stage_xp_claim SET sp_effect_saved=1 WHERE operation_id=?').run(operation.id);
      put('UserAdventureStage',[{...before,dailyClearCount:1}]);await rejected(send('user_data/confirm'),503);put('UserAdventureStage',[before]);
      const source={...operation,parameters:{...operation.parameters,offlineStageXpApplied:1}};
      app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(source.parameters),operation.id);
      app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run(JSON.stringify(source),operation.id);
      await rejected(send('user_data/confirm'),503);
      app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(operation.parameters),operation.id);
      app.store.db.prepare('UPDATE stage_delivery SET operation_json=? WHERE operation_id=?').run(JSON.stringify(operation),operation.id);
      const rewards=loot(operation);
      parse(await push({UserStatusBoardItem:rewards.UserStatusBoardItem,UserGachaTicket:rewards.UserGachaTicket}));
      await recoverXp(operation,{...expected,parameters:{...expected.parameters,gainedItems:[]}},originalCold);
      await rejected(push({},[operation]),400);
      // These imported completed-family fixtures prove the replay derivation only; their whole mode graph is NOT fabricated as ACK.
      assert.deepEqual(app.store.operations(),[operation]);await close();
    }
    // Two no-level main-stage contexts, one with a corrupted partial EXP prefix; both still require real mixed ACK.
    for(const partial of [false,true]) {
      database=path.join(directory,`cold-xp-no-level-${partial}.sqlite`);await open();put('UserInfo',user(0,20));
      const operation=parse(await complete({...value,token:`no-level-${partial}`})).operation,
        claim=app.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?').get(operation.id),
        originalCold={response:await send('user_data/confirm'),identity:sequence};
      assert.deepEqual(parse(originalCold.response).operations,[operation]);assert.equal(claim.sp_amount,0);
      if(partial) {
        put('UserInfo',user(48,20));await rejected(send('user_data/confirm'),503);put('UserInfo',user(0,20));
      }
      parse(await push({UserInfo:user(claim.minimum_exp,20)}));
      await recoverXp(operation,{...operation,parameters:{...operation.parameters,offlineStageXpApplied:1}},originalCold);
      await rejected(push({},[operation]),400);parse(await push(loot(operation),[operation]));await close();await open();
      assert.deepEqual(app.store.operations(),[]);assert.equal(users()[0].playerStatus.totalExp,claim.minimum_exp);
      assert.equal(users()[0].playerStatus.baseSP,20);await close();
    }
    // Two closed-stage-XP -> standalone refill prefixes. Synthetic Iris funding, not a store purchase or natural earning proof.
    for(const boosted of [false,true]) {
      database=path.join(directory,`cold-xp-refill-${boosted}.sqlite`);await open();put('UserInfo',user(96,20));
      app.store.changeHardCurrency(100);
      if(boosted) {put('UserEquipment',[gear]);put('UserPC',app.store.read('UserPC').data.map(row=>({...row,equippedWeaponIndex:1})));}
      const operation=parse(await complete({...value,token:`xp-refill-${boosted}`})).operation,
        claim=app.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?').get(operation.id),
        originalCold={response:await send('user_data/confirm'),identity:sequence};
      assert.deepEqual(parse(originalCold.response).operations,[operation]);
      parse(await push({UserInfo:user(claim.minimum_exp,claim.sp_minimum)}));parse(await push({UserInfo:user(claim.minimum_exp,0)}));
      const recovered={...operation,parameters:{...operation.parameters,offlineStageXpApplied:1}};
      await recoverXp(operation,recovered,originalCold);
      const refill=parse(await send('currency/hard/consume',{consumeId:81041001})).operations[0],
        receipt=app.store.db.prepare('SELECT * FROM hard_currency_consume WHERE operation_id=?').get(refill.id),
        capacity=master.playerMaxSP[users()[0].playerStatus.level],balance=app.store.hardCurrency();
      assert.equal(receipt.sp_before,0);assert.equal(receipt.sp_minimum,capacity);
      const cold=await send('user_data/confirm'),identity=sequence;
      assert.deepEqual(parse(cold).operations,[recovered,refill]);parse(await send('user/login'));
      await close();await open();assert.deepEqual((await request(port,identity,undefined,String(identity),'user_data/confirm')).body,cold.body);
      assert.equal(users()[0].playerStatus.totalExp,claim.minimum_exp);assert.equal(users()[0].playerStatus.baseSP,0);
      assert.equal(app.store.hardCurrency(),balance);assert.deepEqual(app.store.operations(),[operation,refill]);
      await rejected(push({},[operation,refill]),400);
      parse(await push({...loot(operation),UserInfo:user(claim.minimum_exp,capacity)},[operation,refill]));
      await close();await open();assert.deepEqual(app.store.operations(),[]);
      assert.equal(users()[0].playerStatus.totalExp,claim.minimum_exp);assert.equal(users()[0].playerStatus.baseSP,capacity);
      assert.equal(app.store.hardCurrency(),balance);await close();
    }
    database = path.join(directory,'zero-and-cap.sqlite'); await open();
    // Reach the zero-EXP story node through both real prerequisite results.
    for (const adventureStageId of [1010000101101,1010000101102]) {
      const prerequisite=parse(await complete({...value,adventureStageId,token:`before-zero-${adventureStageId}`})).operation,
        claim=app.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?').get(prerequisite.id);
      parse(await push({...loot(prerequisite),UserInfo:user(claim.minimum_exp,Math.max(20,claim.sp_minimum))},[prerequisite]));
    }
    const zero = parse(await complete({adventureStageId:1010000101103,token:'zero',
      adventureRecord:{continueCount:0,deathCount:0,turnCount:0}})).operation;
    assert.equal(app.store.db.prepare('SELECT 1 FROM stage_xp_claim WHERE operation_id=?').get(zero.id),undefined);
    parse(await push(loot(zero),[zero]));
    put('UserInfo',user(master.playerLevels.at(-1)[1],0));
    const capped = parse(await complete(value)).operation, cap = app.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?').get(capped.id);
    assert.equal(cap.before_exp,cap.minimum_exp); assert.equal(cap.sp_amount,0);
    assert.deepEqual(app.store.operations(),[capped]);
    parse(await push(loot(capped),[capped]));
    await close();
    database = path.join(directory,'event-experience.sqlite'); await open();
    // Original event-stage EXP, with a synthetic owned prerequisite row.
    const eventId = Number(Object.keys(master.stageExperience).find(id=>master.stageExperience[id]>0 &&
      master.stages[id].adventureType===9 && master.stages[id].rewardType===1 &&
      ['currency.valis','currency.gem'].includes(master.stages[id].rewardKey)));
    assert.ok(eventId);
    const eventStage = { ...app.store.read('UserAdventureStage').data[0],adventureStageId:eventId,
      state:1,cumulativeClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0,tasks:[] };
    parse(await push({UserAdventureStage:[eventStage]}));
    const event = parse(await complete({ ...value,adventureStageId:eventId,token:'event-xp' })).operation,
      eventClaim = app.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?').get(event.id);
    assert.equal(eventClaim.amount,master.stageExperience[eventId],'Ordinary event stages must not be gated to main story');
    parse(await push({ ...loot(event),UserInfo:user(eventClaim.minimum_exp,Math.max(20,eventClaim.sp_minimum)) },[event]));
    await close();
    //WRITTEN ONLY / NOT RUN: synthetic native-shaped recovery, not MuMu/SP/signature acceptance.
    const [raidId,raid]=Object.entries(master.guildRaidEvents)[0];
    wall=raid.window6+1;database=path.join(directory,'raid-stamina.sqlite');await open();
    const attemptBefore={graidSP:2,consumedNormalSP:99,recoveredGraidSP:0,graidSPLastResetAt:wall};
    put('UserInfo',user(96,20).map(row=>({...row,playerStatus:{...row.playerStatus,...attemptBefore}})));
    const originalUsers=users();
    for(const table of ['stage_raid_stamina_claim','stage_delivery','stage_completion','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_raid_sp_issue BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'Raid SP issue rollback'); END`);
      await rejected(complete(value),503,snapshot(),false);app.store.db.exec('DROP TRIGGER fail_raid_sp_issue');
    }
    const raidOperation=parse(await complete(value)).operation,raidIdentity=sequence,
      xp=app.store.db.prepare('SELECT * FROM stage_xp_claim WHERE operation_id=?').get(raidOperation.id),
      receipt=()=>app.store.db.prepare('SELECT * FROM stage_raid_stamina_claim WHERE operation_id=?').get(raidOperation.id),
      capture=JSON.parse(receipt().capture_json);
    assert.deepEqual(users(),originalUsers,'Issuance cannot precredit native attempts, recovery counters, EXP or normal SP');
    assert.equal(receipt().raid_id,Number(raidId));assert.equal(receipt().observed_json,null);
    assert.deepEqual(capture.before,attemptBefore);assert.equal(capture.charge,1);
    assert.equal(capture.raidId,Number(raidId));assert.equal(capture.rulesRaidId,Number(raidId));
    const attemptAfter={...attemptBefore,graidSP:3,consumedNormalSP:0,recoveredGraidSP:1},
      nativeUsers=user(xp.minimum_exp,xp.sp_minimum).map(row=>({...row,playerStatus:{...row.playerStatus,...attemptAfter}}));
    await rejected(push(loot(raidOperation),[raidOperation]),400);
    for(const [table,event] of [['stage_raid_stamina_claim','UPDATE'],['stage_delivery','UPDATE'],['profile','UPDATE'],
      ['guild_raid_attempt_checkpoint','INSERT'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_raid_sp_save BEFORE ${event} ON ${table}
        BEGIN SELECT RAISE(ABORT,'Raid SP observation rollback'); END`);
      await rejected(push({UserInfo:nativeUsers}),503,snapshot(),false);app.store.db.exec('DROP TRIGGER fail_raid_sp_save');
    }
    parse(await push({UserInfo:nativeUsers}));
    const observation=receipt().observed_json;
    assert.deepEqual(JSON.parse(observation),{at:wall,status:attemptAfter});
    const checkpoint=()=>app.store.db.prepare('SELECT * FROM guild_raid_attempt_checkpoint WHERE user_id=?').get(seed.userId);
    assert.deepEqual(JSON.parse(checkpoint().status_json),attemptAfter);
    assert.ok(JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(raidOperation.id).observed).includes('raidSP'));
    await rejected(complete(value),503);
    await close();await open();assert.equal(receipt().observed_json,observation);
    await rejected(request(port,raidIdentity,value,String(raidIdentity),'adventure/stage/complete'),503);
    await rejected(send('user_data/confirm',undefined),503);
    await rejected(push({UserInfo:nativeUsers.map(row=>({...row,playerStatus:{...row.playerStatus,...attemptBefore}}))}),400);
    app.store.db.prepare('UPDATE stage_raid_stamina_claim SET observed_json=? WHERE operation_id=?').run('null',raidOperation.id);
    await rejected(complete(value),503);
    app.store.db.prepare('UPDATE stage_raid_stamina_claim SET observed_json=? WHERE operation_id=?').run(observation,raidOperation.id);
    for(const [table,event] of [['profile','UPDATE'],['stage_delivery','UPDATE'],['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_raid_sp_ack BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'Raid SP ACK rollback'); END`);
      await rejected(push(loot(raidOperation),[raidOperation]),503,snapshot(),false);app.store.db.exec('DROP TRIGGER fail_raid_sp_ack');
    }
    parse(await push(loot(raidOperation),[raidOperation]));await close();await open();
    assert.deepEqual(app.store.operations(),[]);assert.equal(receipt().observed_json,observation);
    assert.deepEqual(Object.fromEntries(Object.keys(attemptAfter).map(key=>[key,users()[0].playerStatus[key]])),attemptAfter);
    await rejected(complete(value),503);
    //WRITTEN ONLY / NOT RUN: the earned checkpoint survives ACK, not just the queue.
    for(const fields of [attemptBefore,{graidSP:attemptAfter.graidSP+1},{graidSP:attemptAfter.graidSP-1},
      {consumedNormalSP:1},{recoveredGraidSP:0},{graidSPLastResetAt:wall+1}])
      await rejected(push({UserInfo:users().map(row=>({...row,playerStatus:{...row.playerStatus,...fields}}))}),400);
    const protectedUsers=users(),savedCheckpoint=checkpoint(),pullBody={tables:['UserInfo']};
    assert.equal((await send('user_data/pull',pullBody)).status,200);const checkpointPullIdentity=sequence;
    put('UserInfo',protectedUsers.map(row=>({...row,playerStatus:{...row.playerStatus,graidSP:2}})));
    assert.throws(()=>users(),/earned checkpoint/);
    await rejected(send('user_data/pull',pullBody),503);
    await rejected(request(port,checkpointPullIdentity,pullBody,String(checkpointPullIdentity),'user_data/pull'),503);
    await rejected(send('user_data/confirm',undefined),503);
    assert.deepEqual(checkpoint(),savedCheckpoint);put('UserInfo',protectedUsers);
    app.store.db.prepare('UPDATE guild_raid_attempt_checkpoint SET status_json=? WHERE user_id=?').run('null',seed.userId);
    await rejected(send('user_data/confirm',undefined),503);
    app.store.db.prepare('UPDATE guild_raid_attempt_checkpoint SET status_json=? WHERE user_id=?').run(savedCheckpoint.status_json,seed.userId);
    wall=(Math.floor((wall+32400)/86400)+1)*86400-32400;
    const resetStatus=guildRaidAttemptState(master,guildRaidNativeEvent(master,wall,true),attemptAfter,wall),
      resetUsers=users().map(row=>({...row,playerStatus:{...row.playerStatus,...resetStatus}}));
    for(const [table,event] of [['guild_raid_attempt_checkpoint','UPDATE'],['profile','UPDATE'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_raid_checkpoint_reset BEFORE ${event} ON ${table}
        BEGIN SELECT RAISE(ABORT,'Raid attempt reset rollback'); END`);
      await rejected(push({UserInfo:resetUsers}),503,snapshot(),false);app.store.db.exec('DROP TRIGGER fail_raid_checkpoint_reset');
    }
    parse(await push({UserInfo:resetUsers}));assert.deepEqual(JSON.parse(checkpoint().status_json),resetStatus);
    assert.equal(checkpoint().saved_at,wall);
    await rejected(push({UserInfo:protectedUsers}),400);
    await close();await open();assert.deepEqual(users(),resetUsers);assert.deepEqual(JSON.parse(checkpoint().status_json),resetStatus);
    await rejected(push({UserInfo:protectedUsers}),400);await close();
    console.log('Stage EXP/SP source checks: original values, guest snapshots/indices/slot substitution, float32 gear, split saves, bounded floors, replay/restart and rollback; native acceptance pending');
  } finally {
    await close();
    assert.equal(path.dirname(fs.realpathSync(directory)),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-stage-xp-'));
    fs.rmSync(directory,{recursive:true,force:true});
  }
}
if (require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
