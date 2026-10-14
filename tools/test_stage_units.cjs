'use strict';

// Disposable synthetic saves. NOT native initialization, stats,
// signatures, character eligibility, earning, rendering or playable acceptance.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, encodeMsgpack, pcInitialStatInput, stageGuestIsPermanent, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request,stageXpFixture,rewardCharacterFixture,rewardCostumeFixture,rewardUnitStoryFixture,friendshipUnlockFixture } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = value => crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-stage-unit-'));
  // Optional filename substring isolates a failing case without changing it.
  let selectedCount = 0;
  const selected = name => {
    if(process.argv[2] && !name.includes(process.argv[2])) return false;
    selectedCount++; return true;
  };
  let app, database, port, sequence = 0, fixtureMaster = master, wall = 1790866800, eventDate = null, lastLog = '';
  const open = async () => {
    app = createServer({ database, seed, master:fixtureMaster, eventDate, wallNowSeconds:()=>wall,
      log:line=>{if(JSON.parse(line).event==='rejected')lastLog=line;} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const send = (action,body) => request(port, ++sequence, body, String(sequence), action);
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name").all()
    .map(({ name }) => [name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const pushValue = (putItems = {}, operation, deleteItems = {}) => {
    putItems = stageXpFixture(app.store,putItems,operation ? [operation] : []);
    return {
    badges:null,scripts:{},dataTokens:{},checksums:{ before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name => [name,md5(putItems[name] ?? [])])) },
    deltas:Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ putItems,deleteItems,signature:0,trigger:'AdventureComplete' }] : [],
    operations:operation ? [{ id:operation.id,verifier:operation.token }] : [],
    };
  };
  const push = (putItems = {}, operation, deleteItems = {}) => send('user_data/push',pushValue(putItems,operation,deleteItems));
  // Negative ACK probes must not synthesize missing PC/CP/XP saves.
  const emptyAck = operation => send('user_data/push',{...pushValue(),operations:[{id:operation.id,verifier:operation.token}]});
  const rejected = async (pending,status,before = snapshot(),structured = true) => {
    const reply = await pending; assert.equal(reply.status,status,`${reply.body}\n${lastLog}`);
    if (status === 503 && structured) assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Rejection must retain profiles, receipts, queue, floors, sequence and exact replies');
  };
  const id = 1010000108101, pcId = master.pcs[master.stages[id].rewardKey];
  const baseValue = { adventureStageId:id,token:'stage-character',adventureStageTaskIds:[],adventureGainedItems:[],
    friendshipStates:[],secretMissionCompleted:false,adventureRecord:{ continueCount:0,deathCount:0,turnCount:3 },isEnemyAnnihilated:true };
  const complete = body => send('adventure/stage/complete',body);
  try {
    assert.equal(master.stages[id].rewardType,50); assert.equal(pcId,1011003001);
    // SYNTHETIC catalog: original field/algorithm shape only, NOT recovered
    // membership, group IDs, thresholds, windows, source hashes or eligibility.
    const guestCatalog={ pcGuests:[{ id:1,pcId,startAt:1,endAt:2 }],pcGuestLevelSteps:[
      { guestId:1,level:1,totalExp:0,marker:0 },{ guestId:1,level:10,totalExp:25,marker:0 },
      { guestId:1,level:5,totalExp:10,marker:15 }],sources:{ ...master.sources,pcGuest:{ rows:1 },pcGuestLevelStep:{ rows:3 } } };
    const catalog={ ...master,...guestCatalog };
    for(const [exp,expected] of [[0,false],[9,false],[10,true],[25,true],[0x80000001,true]])
      assert.equal(stageGuestIsPermanent(catalog,pcId,exp),expected);
    assert.equal(stageGuestIsPermanent(catalog,1011001001,0),true,'Original catalog absence is an ordinary PC, not a guessed guest');
    assert.throws(()=>stageGuestIsPermanent({ ...catalog,pcGuests:undefined },pcId,10),/catalog/);
    assert.throws(()=>stageGuestIsPermanent({ ...catalog,pcGuests:[{ ...catalog.pcGuests[0],pcId:String(pcId) }] },pcId,10),/identities/);
    for(const exp of [-1,'10',Number.MAX_SAFE_INTEGER+1])
      assert.throws(()=>stageGuestIsPermanent(catalog,pcId,exp),/identity or saved EXP/);
    for(const selected of [1,String(pcId)]) assert.throws(()=>stageGuestIsPermanent(catalog,selected,10),/identity or saved EXP/);
    assert.throws(()=>stageGuestIsPermanent({ ...catalog,pcGuestLevelSteps:catalog.pcGuestLevelSteps.map(row=>({ ...row,level:1 })) },pcId,10),/ambiguous/);
    assert.equal(stageGuestIsPermanent({ ...catalog,pcGuestLevelSteps:catalog.pcGuestLevelSteps.map(row=>({ ...row,marker:0 })) },pcId,25),false,
      'Missing marker uses original INT_MAX sentinel, not the maximum authored level');
    assert.equal(stageGuestIsPermanent({ ...catalog,pcGuestLevelSteps:catalog.pcGuestLevelSteps.map(row=>
      row.level===10 ? { ...row,totalExp:5 } : row) },pcId,5),true,'Native choice is descending level, not sorted EXP thresholds');
    for (const order of ['unit','boards','clear','character','absent-character','character-owned','character-tracks','combined',
      'preowned','preowned-clear','preowned-bond','repeat','permanent-guest']) {
      const permanentGuest=order==='permanent-guest',preowned = order.startsWith('preowned') || permanentGuest,
        repeat = order === 'repeat', bondId = master.bonds[pcId];
      // Quantity2 is a synthetic loop probe, NOT an authored stage quantity.
      fixtureMaster = { ...master,bonds:{ ...master.bonds },stages:repeat ? { ...master.stages,
        [id]:{ ...master.stages[id],rewardAmount:2 } } : master.stages };
      const value = { ...baseValue,adventureGainedItems:order === 'preowned-bond' ? [{ itemId:bondId,amount:2 }] : [] };
      database = path.join(directory,`${order}.sqlite`); if(!selected(path.basename(database))) continue;
      console.log('Stage character fixture:',path.basename(database)); await open();
      const characterId = master.pcProfiles[pcId].characterId;
      if (order === 'absent-character') parse(await push({},null,{ UserCharacter:[{ characterId }] }));
      if (order === 'character-owned') parse(await push({ UserCharacter:rewardCharacterFixture(app.store.read('UserCharacter').data,[pcId]) }));
      if (order === 'character-tracks') parse(await push({ UserCharacter:[{
        ...app.store.read('UserCharacter').data.find(row => row.characterId === characterId),friendship:5,friendshipAis:7,friendshipLef:9 }] }));
      const characterBefore = app.store.read('UserCharacter').data.find(row => row.characterId === characterId),
        acquiredCharacter = rewardCharacterFixture(app.store.read('UserCharacter').data,[pcId])[0];
      // Original parsed field names, synthetic guest progress/eligibility.
      // An unrelated guest record must not block any fresh/split stage-PC save.
      const unrelatedGuest = { userId:0,pcId:1011001001,totalExp:0 }, relatedGuest = { userId:seed.userId,pcId,totalExp:0 };
      parse(await push({ UserGuestEvent:[unrelatedGuest] }));
      if (order === 'unit') {
        for (const rows of [[{ userId:0,guestEventId:unrelatedGuest.pcId,totalExp:0 }],
          [{ ...unrelatedGuest,pcId:'1011001001' }],[{ ...unrelatedGuest,pcId:0 }],[{ ...unrelatedGuest,pcId:0x80000000 }],
          [{ ...unrelatedGuest,pcId:1 }],[{ ...unrelatedGuest,userId:2 }],[{ ...unrelatedGuest,userId:'0' }],
          [{ ...unrelatedGuest,totalExp:-1 }],[{ ...unrelatedGuest,totalExp:'0' }],
          [{ ...unrelatedGuest,totalExp:Number.MAX_SAFE_INTEGER+1 }],[{ pcId:unrelatedGuest.pcId }],
          [unrelatedGuest,{ ...unrelatedGuest,totalExp:1 }]]) await rejected(push({ UserGuestEvent:rows }),400);
        await rejected(push({},null,{ UserGuestEvent:[{ guestEventId:unrelatedGuest.pcId }] }),400);
        parse(await push({ UserGuestEvent:[{ ...unrelatedGuest,totalExp:1 }] }));
        assert.deepEqual(app.store.read('UserGuestEvent').data,[{ ...unrelatedGuest,totalExp:1 }],'PC-key update replaces, never duplicates');
        parse(await push({ UserGuestEvent:[{ ...unrelatedGuest,userId:seed.userId,totalExp:0x80000001 }] }));
        assert.equal(app.store.read('UserGuestEvent').data[0].totalExp,0x80000001,'Native totalExp is long, not int32');
        parse(await push({},null,{ UserGuestEvent:[{ pcId:unrelatedGuest.pcId }] }));
        assert.deepEqual(app.store.read('UserGuestEvent').data,[],'Native pcId-only delete selector');
        parse(await push({ UserGuestEvent:[unrelatedGuest] }));
      }
      const stage = { ...app.store.read('UserAdventureStage').data[0],adventureStageId:id,state:1,
        cumulativeClearCount:0,dailyClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0,tasks:[] };
      // Synthetic prerequisite and initialization; only reward identity and job
      // catalog IDs are original archive data, not these stats/progress values.
      parse(await push({ UserAdventureStage:[stage] }));
      const initialized = { ...app.store.read('UserPC').data[0],pcId,joiningState:1,currentJobIndex:1,
        totalExp:0,limitbreakCount:0,heroSublimateLevel:0,isUnlockedHeroSublimate:false };
      const boards = { userId:seed.userId,pcId,pcJobs:[],signature:0 };
      const priorBond = { userId:seed.userId,limitBreakItemId:bondId,amount:4,cumulativeAmount:11,
        bookEntryState:3,signature:0 };
      if (preowned) {
        initialized.totalExp = 100; initialized.limitbreakCount = 2;
        initialized.currentJobIndex = master.pcProfiles[pcId].jobIds.length;
        boards.pcJobs = [{ pcJobId:master.pcProfiles[pcId].jobIds[0],abilityPanelState:0x82000001,abilityPanels:[],signature:0 }];
        parse(await push({ UserPC:[initialized],UserPCJobSet:[boards],UserLimitBreakItem:[priorBond] }));
      }
      const pullBody = { tables:['UserPCJobSet'] };
      assert.equal((await send('user_data/pull',pullBody)).status,200); const pullIdentity = sequence;
      const bondPullBody = { tables:['UserLimitBreakItem'] };
      assert.equal((await send('user_data/pull',bondPullBody)).status,200); const bondPullIdentity = sequence;
      const guestPullBody = { tables:['UserGuestEvent'] };
      assert.equal((await send('user_data/pull',guestPullBody)).status,200); const guestPullIdentity = sequence;
      const characterPullBody = { tables:['UserCharacter'] };
      assert.equal((await send('user_data/pull',characterPullBody)).status,200); const characterPullIdentity = sequence;
      if (order === 'unit') for (const table of ['stage_delivery','stage_completion','stage_reward','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_unit_issue BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'unit issue rollback'); END`);
        await rejected(complete(value),503,undefined,false); app.store.db.exec('DROP TRIGGER fail_unit_issue');
      }
      if (preowned) {
        const guest = app.store.read('UserGuestEvent'), putGuest = rows => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
          .run(JSON.stringify(rows),md5(rows),'UserGuestEvent');
        // Duplicate saved identities are invalid even when this ordinary PC
        // has no original guest component; unrelated valid rows stay harmless.
        putGuest([unrelatedGuest,relatedGuest,{ ...relatedGuest,totalExp:1 }]);
        try { await rejected(complete(value),503); } finally {
          app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(guest.data),guest.token,'UserGuestEvent');
        }
        delete fixtureMaster.bonds[pcId];
        try { await rejected(complete(value),503); } finally { fixtureMaster.bonds[pcId] = bondId; }
        // The reservation guard alone is under test; this synthetic absolute
        // operation is not a valid native lottery capture or delivered draw.
        const absolute = app.store.issueOperation(1000,{ UserLimitBreakItem:[priorBond] }), before = snapshot();
        assert.throws(()=>app.store.issueStageCompletion(value,fixtureMaster),/awaiting its saved acknowledgement/);
        assert.equal(snapshot(),before);
        app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(absolute.id);
        app.store.db.exec("CREATE TRIGGER fail_bond_issue BEFORE INSERT ON pve_item_claim BEGIN SELECT RAISE(ABORT,'bond issue rollback'); END");
        await rejected(complete(value),503,undefined,false); app.store.db.exec('DROP TRIGGER fail_bond_issue');
      }
      if(permanentGuest) {
        Object.assign(fixtureMaster,guestCatalog); relatedGuest.totalExp=10;
        parse(await push({ UserGuestEvent:[relatedGuest] }));
      }
      const operation = parse(await complete(value)).operation, identity = sequence;
      // Only original guest membership adds a captured guest-EXP obligation.
      if(permanentGuest) await rejected(push({ UserGuestEvent:[{ ...relatedGuest,totalExp:0 }] }),400);
      else parse(await push({ UserGuestEvent:[{ ...relatedGuest,totalExp:0 }] }));
      if (order === 'unit') {
        parse(await push({ UserGuestEvent:[{ ...unrelatedGuest,userId:seed.userId,totalExp:3 }] }));
        assert.deepEqual(app.store.operations(),[operation],'An unrelated guest save is not an ACK or stage reward observation');
        assert.deepEqual(JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id).observed),[]);
        const guest = app.store.read('UserGuestEvent');
        for (const damaged of [[{ ...unrelatedGuest,pcId:'1011001001' }],
          [unrelatedGuest,unrelatedGuest],[{ ...unrelatedGuest,totalExp:-1 }],[{ ...unrelatedGuest,pcId:1 }]]) {
          app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(damaged),md5(damaged),'UserGuestEvent');
          try {
            await rejected(complete(value),503); await rejected(send('user_data/pull',guestPullBody),503);
            assert.deepEqual(app.store.operations(),[operation],'Damaged guest identity cannot erase the real stage receipt');
          } finally { app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(guest.data),guest.token,'UserGuestEvent'); }
        }
      }
      assert.deepEqual(operation.parameters.gainedPCs,repeat ? [pcId,pcId] : [pcId]);
      assert.deepEqual(operation.parameters.gainedItems,value.adventureGainedItems,'Native duplicate bond is not also wire loot');
      const claims = app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').all(operation.id);
      const bondAmount = (preowned || repeat ? 1 : 0) + (value.adventureGainedItems[0]?.amount ?? 0);
      const bond = bondAmount ? { ...priorBond,amount:(preowned ? priorBond.amount : 0)+bondAmount,
        cumulativeAmount:(preowned ? priorBond.cumulativeAmount : 0)+bondAmount } : null;
      assert.equal(claims.length,bond ? 1 : 0);
      if (bond) {
        assert.equal(claims[0].item_id,bondId); assert.equal(claims[0].table_name,'UserLimitBreakItem');
        assert.equal(claims[0].id_field,'limitBreakItemId'); assert.equal(claims[0].cumulative_amount,bond.cumulativeAmount);
        assert.throws(()=>app.store.reservedItemAcquisition(bondId,preowned ? priorBond.cumulativeAmount : 0,true),
          /additive item reward must settle/,'Absolute lottery setter cannot overtake pending additive stage bonds');
        app.store.db.prepare('DELETE FROM pve_item_claim WHERE operation_id=?').run(operation.id);
        await rejected(complete(value),503); assert.deepEqual(app.store.operations(),[operation]);
        app.store.db.prepare('INSERT INTO pve_item_claim(operation_id,item_id,table_name,id_field,cumulative_amount) VALUES(?,?,?,?,?)')
          .run(operation.id,bondId,'UserLimitBreakItem','limitBreakItemId',bond.cumulativeAmount);
      }
      const capture = app.store.db.prepare('SELECT * FROM stage_delivery WHERE operation_id=?').get(operation.id);
      const target = JSON.parse(capture.pc_targets)[0].target;
      assert.equal(target.totalExp,initialized.totalExp);
      assert.deepEqual(target.pcJobs,boards.pcJobs.map(({pcJobId,abilityPanelState})=>({pcJobId,abilityPanelState})));
      assert.deepEqual(target.character,preowned ? undefined : { characterId,userId:characterBefore?.userId ?? 0,
        present:Boolean(characterBefore),beforeState:characterBefore?.characterState ?? 1,
        state:acquiredCharacter.characterState,
        friendship:['friendship','friendshipAis','friendshipLef'].map(key => characterBefore?.[key] ?? 0) });
      assert.deepEqual(app.store.read('UserCharacter').data.find(row => row.characterId === characterId),characterBefore,'No character-state pre-credit');
      assert.deepEqual(JSON.parse(capture.pc_targets)[0].bond,bond ? { itemId:bondId,amount:1,cumulativeAmount:bond.cumulativeAmount } : undefined);
      assert.deepEqual(JSON.parse(capture.pc_before),preowned ? [pcId] : []);
      assert.equal(app.store.read('UserPC').data.some(row => row.pcId === pcId),preowned,'No unit pre-credit');
      assert.equal(app.store.read('UserPCJobSet').data.some(row => row.pcId === pcId),preowned,'No job-set pre-credit');
      assert.deepEqual(app.store.read('UserLimitBreakItem').data.find(row=>row.limitBreakItemId===bondId),
        preowned ? priorBond : undefined,'No bond pre-credit');
      const clear = { ...operation.parameters.UserAdventureStage[0],state:4,cumulativeClearCount:1,dailyClearCount:1,
        firstCompleteDateTime:1790866800,lastCompleteDateTime:1790866800 };
      const full = { UserAdventureStage:[clear,...(!preowned ? rewardUnitStoryFixture(app.store.read('UserAdventureStage').data,[pcId]).UserAdventureStage ?? [] : [])],
        UserPC:[initialized],UserPCJobSet:[boards],
        ...(!preowned ? { UserCharacter:[acquiredCharacter],
          ...rewardCostumeFixture(app.store.read('UserCharacterCostume').data,[pcId],app.store.read('UserCommunicationVoice').data) } : {}),
        ...(bond ? { UserLimitBreakItem:[bond] } : {}) };
      if (!preowned) {
        const {UserCharacter,...withoutCharacter} = full;
        if (order !== 'character-owned') await rejected(push(withoutCharacter,operation),400);
        for (const edits of [{ userId:2 },{ userId:String(acquiredCharacter.userId) },{ characterState:256 },{ characterState:'2' },
          { friendship:-1 },{ friendshipAis:'0' },{ friendshipLef:2000000001 },
          { characterState:1 },...(order === 'character-tracks' ? [{ friendship:4 },{ friendshipAis:6 },{ friendshipLef:8 }] : [])])
          await rejected(push({ ...full,UserCharacter:[{ ...acquiredCharacter,...edits }] },operation),400);
        const legacyTarget = structuredClone(target); delete legacyTarget.character;
        app.store.db.prepare('UPDATE stage_delivery SET pc_targets=? WHERE operation_id=?').run(JSON.stringify([{ pcId,target:legacyTarget,
          ...(bond ? { bond:{ itemId:bondId,amount:1,cumulativeAmount:bond.cumulativeAmount } } : {}) }]),operation.id);
        await rejected(complete(value),503); await rejected(push(full,operation),503);
        assert.deepEqual(app.store.operations(),[operation]);
        app.store.db.prepare('UPDATE stage_delivery SET pc_targets=? WHERE operation_id=?').run(capture.pc_targets,operation.id);
      }
      if (bond) {
        await rejected(push({ UserAdventureStage:[clear],UserPC:[initialized],UserPCJobSet:[boards] },operation),400);
        for (const edits of [{ cumulativeAmount:bond.cumulativeAmount-1 },{ amount:-1 },{ userId:2 },{ cumulativeAmount:'12' }])
          await rejected(push({ ...full,UserLimitBreakItem:[{ ...bond,...edits }] },operation),400);
      }
      for (const edits of [{ ...full,UserPC:[{ ...initialized,joiningState:0 }] },
        { ...full,UserPC:[{ ...initialized,userId:2 }] },
        { ...full,UserPC:[{ ...initialized,ownerType:3 }] },
        { ...full,UserPC:[{ ...initialized,totalExp:-1 }] },
        { ...full,UserPC:[{ ...initialized,currentJobIndex:master.pcProfiles[pcId].jobIds.length+1 }] },
        { ...full,UserPC:[{ ...initialized,heroSublimateLevel:1,isUnlockedHeroSublimate:false }] },
        { ...full,UserPCJobSet:[{ ...boards,userId:2 }] },
        { ...full,UserPCJobSet:[{ ...boards,pcJobs:[null] }] },
        { ...full,UserPCJobSet:[{ ...boards,pcJobs:[{ pcJobId:1,abilityPanelState:0 }] }] },
        { ...full,UserPCJobSet:[{ ...boards,pcJobs:[{ pcJobId:master.pcProfiles[pcId].jobIds[0],abilityPanelState:-1 }] }] },
        { ...full,UserPCJobSet:[{ ...boards,pcJobs:[{ pcJobId:master.pcProfiles[pcId].jobIds[0],abilityPanelState:0x100000000 }] }] },
        { ...full,UserPCJobSet:[{ ...boards,pcJobs:Array.from({ length:2 },()=>
          ({ pcJobId:master.pcProfiles[pcId].jobIds[0],abilityPanelState:0 })) }] }])
        await rejected(push(edits,operation),400);
      for (const replacement of [null,'{}','not-json','[]',JSON.stringify([{ pcId,target:{ ...target,currentJobIndex:0 } }]),
        ...(bond ? [JSON.stringify([{ pcId,target }]),JSON.stringify([{ pcId,target,bond:{ itemId:bondId,amount:2,cumulativeAmount:bond.cumulativeAmount } }]),
          JSON.stringify([{ pcId,target,bond:{ itemId:bondId,amount:1,cumulativeAmount:bond.cumulativeAmount-1 } }])] : [])]) {
        app.store.db.prepare('UPDATE stage_delivery SET pc_targets=? WHERE operation_id=?').run(replacement,operation.id);
        await rejected(complete(value),503); assert.deepEqual(app.store.operations(),[operation]);
        app.store.db.prepare('UPDATE stage_delivery SET pc_targets=? WHERE operation_id=?').run(capture.pc_targets,operation.id);
      }
      if (preowned) {
        await rejected(push({ UserPC:[{ ...initialized,totalExp:0 }] }),400);
        await rejected(push({ UserPCJobSet:[{ ...boards,pcJobs:[] }] }),400);
        await rejected(push({},null,{ UserPCJobSet:[{ pcId }] }),400);
        assert.deepEqual(parse(await complete(value)).operation,operation,'An unchanged preowned reward is not a new observation');
        if (order !== 'preowned') {
          const first = order === 'preowned-bond' ? { UserLimitBreakItem:[bond] } : { UserAdventureStage:[clear] };
          app.store.db.exec("CREATE TRIGGER fail_bond_observe BEFORE UPDATE ON stage_delivery BEGIN SELECT RAISE(ABORT,'bond observation rollback'); END");
          await rejected(push(first),503,undefined,false); app.store.db.exec('DROP TRIGGER fail_bond_observe');
          assert(!parse(await push(first)).operations.some(row=>row.id===operation.id));
          assert.deepEqual(app.store.operations(),[operation]);
          const observed = JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id).observed);
          assert(observed.includes(order === 'preowned-bond' ? `item:${bondId}` : 'clear'));
          await close(); await open();
          if(order==='preowned-bond') {
            const retained=snapshot(),derived=app.store.stageColdRecovery(operation);
            assert.equal(snapshot(),retained);assert.deepEqual(derived.parameters.offlineStagePcResumes,[5]);
            assert.deepEqual(derived.parameters.gainedPCs,operation.parameters.gainedPCs);
            assert.deepEqual(derived.parameters.gainedItems,[],'Saved wire loot and duplicate bond share one complete stock checkpoint');
            assert.deepEqual(parse(await complete(value)).operation,derived);
            assert.deepEqual(parse(await request(port,identity,value,String(identity),'adventure/stage/complete')).operation,derived);
            assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id),derived);
            const pulled=await send('user_data/pull',bondPullBody);
            assert.equal(pulled.status,200);assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull(bondPullBody)));
          } else {
            await rejected(complete(value),503); await rejected(request(port,identity,value,String(identity),'adventure/stage/complete'),503);
            await rejected(send('user_data/confirm'),503); await rejected(send('user_data/pull',bondPullBody),503);
          }
          await rejected(emptyAck(operation),400);
          if (order === 'preowned-bond') await rejected(push({ UserLimitBreakItem:[priorBond] }),400);
          else await rejected(push({ UserAdventureStage:[stage] }),400);
        }
      } else if (order !== 'combined') {
        await rejected(push({ UserAdventureStage:[clear] },operation),400);
        const first = ['character','absent-character'].includes(order) ? { UserCharacter:[acquiredCharacter] } : order === 'unit' ? { UserPC:[initialized] } : order === 'boards'
          ? { UserPCJobSet:[boards] } : { UserAdventureStage:[clear] };
        app.store.db.exec("CREATE TRIGGER fail_unit_observe BEFORE UPDATE ON stage_delivery BEGIN SELECT RAISE(ABORT,'unit observation rollback'); END");
        await rejected(push(first),503,undefined,false); app.store.db.exec('DROP TRIGGER fail_unit_observe');
        const partial = parse(await push(first)); assert(!partial.operations.some(row => row.id === operation.id));
        assert.deepEqual(app.store.operations(),[operation]);
        assert.equal(app.store.db.prepare('SELECT 1 FROM gift_pc_floor WHERE pc_id=?').get(pcId),undefined,'Stage floor only after real ACK');
        const observed = JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id).observed);
        assert(observed.includes(['character','absent-character'].includes(order) ? `character:${characterId}` :
          order === 'unit' ? `pc:${pcId}` : order === 'boards' ? `pcset:${pcId}` : 'clear'));
        await close(); await open();
        if(['character','absent-character','boards'].includes(order)) {
          parse(await send('user/login'));
          const before=snapshot();assert.deepEqual(app.store.stageColdRecovery(operation),operation);assert.equal(snapshot(),before);
          assert.deepEqual(parse(await complete(value)).operation,operation);
          assert.deepEqual(parse(await request(port,identity,value,String(identity),'adventure/stage/complete')).operation,operation);
          assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id),operation);
          const pulled=await send('user_data/pull',pullBody);
          assert.equal(pulled.status,200);assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull(pullBody)));
          if(order==='boards') {
            app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?')
              .run(JSON.stringify(observed.filter(key=>key!==`pcset:${pcId}`)),operation.id);
            await rejected(send('user_data/confirm'),503);
            app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(JSON.stringify(observed),operation.id);
          }
        } else {
          await rejected(complete(value),503);
          await rejected(request(port,identity,value,String(identity),'adventure/stage/complete'),503);
          await rejected(send('user_data/confirm'),503); await rejected(send('user_data/pull',pullBody),503);
        }
        await rejected(emptyAck(operation),400);
        if (order === 'unit') await rejected(push({},null,{ UserPC:[{ pcId }] }),400);
        if (order === 'boards') await rejected(push({},null,{ UserPCJobSet:[{ pcId }] }),400);
        if (order === 'clear') await rejected(push({ UserAdventureStage:[stage] }),400);
        if (['character','absent-character'].includes(order)) {
          await rejected(push({ UserCharacter:[{ ...acquiredCharacter,characterState:1 }] }),400);
          await rejected(push({},null,{ UserCharacter:[{ characterId }] }),400);
        }
        parse(await push({ UserPC:[initialized],UserAdventureStage:[clear] }));
        // Owned unit and flags alone cannot prove the missing job set.
        if (order !== 'boards') await rejected(emptyAck(operation),400);
        parse(await push({ UserPCJobSet:[boards] }));
      }
      for (const table of ['gift_pc_floor','operation_done','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_unit_ack BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'unit ACK rollback'); END`);
        await rejected(push(full,operation),503,undefined,false); app.store.db.exec('DROP TRIGGER fail_unit_ack');
      }
      parse(await push(full,operation)); assert.deepEqual(app.store.operations(),[]);
      assert.deepEqual(JSON.parse(app.store.db.prepare('SELECT targets FROM gift_pc_floor WHERE pc_id=?').get(pcId).targets),
        permanentGuest ? {...target,guest:relatedGuest} : target);
      await close(); await open();
      await rejected(push({},null,{ UserPC:[{ pcId }] }),400);
      await rejected(push({},null,{ UserPCJobSet:[{ pcId }] }),400);
      if (!preowned) {
        await rejected(push({ UserCharacter:[{ ...acquiredCharacter,characterState:1 }] }),400);
        await rejected(push({},null,{ UserCharacter:[{ characterId }] }),400);
        if (order === 'character-tracks') for (const edits of [{ friendship:4 },{ friendshipAis:6 },{ friendshipLef:8 }])
          await rejected(push({ UserCharacter:[{ ...acquiredCharacter,...edits }] }),400);
        parse(await push({ UserCharacter:[{ ...acquiredCharacter,characterState:3 }] }));
        if (order !== 'character-owned') await rejected(request(port,characterPullIdentity,characterPullBody,String(characterPullIdentity),'user_data/pull'),503);
      }
      if (bond) {
        await rejected(push({ UserLimitBreakItem:[{ ...bond,cumulativeAmount:bond.cumulativeAmount-1 }] }),400);
        await rejected(push({},null,{ UserLimitBreakItem:[{ limitBreakItemId:bondId }] }),400);
        parse(await push({ UserLimitBreakItem:[{ ...bond,amount:0 }] }));
        await rejected(request(port,bondPullIdentity,bondPullBody,String(bondPullIdentity),'user_data/pull'),503);
      }
      if (preowned) {
        const guest = app.store.read('UserGuestEvent');
        app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify([unrelatedGuest,relatedGuest]),md5([unrelatedGuest,relatedGuest]),'UserGuestEvent');
        try { await rejected(request(port,guestPullIdentity,guestPullBody,String(guestPullIdentity),'user_data/pull'),503); }
        finally { app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(guest.data),guest.token,'UserGuestEvent'); }
        await rejected(push({ UserPC:[{ ...initialized,totalExp:99 }] }),400);
        await rejected(push({ UserPCJobSet:[{ ...boards,pcJobs:[{ ...boards.pcJobs[0],abilityPanelState:0x2000001 }] }] }),400);
        // An identical cached board pull is safe; changing its current bits is
        // what makes that old snapshot unable to replace the durable save.
        assert.equal((await request(port,pullIdentity,pullBody,String(pullIdentity),'user_data/pull')).status,200);
        parse(await push({ UserPCJobSet:[{ ...boards,pcJobs:[{ ...boards.pcJobs[0],abilityPanelState:0x82000003 }] }] }));
      }
      await rejected(request(port,pullIdentity,pullBody,String(pullIdentity),'user_data/pull'),503);
      parse(await push({ UserPC:[{ ...initialized,totalExp:initialized.totalExp+1 }] }));
      if (order === 'preowned') parse(await push({ UserGuestEvent:[relatedGuest] }));
      const next = parse(await complete({ ...value,token:'stage-character-repeat',adventureGainedItems:[] })).operation;
      assert.deepEqual(next.parameters.gainedPCs,[],'Repeat cannot reissue first-clear unit');
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM pve_item_claim WHERE operation_id=?').get(next.id).n,0,
        'Cleared stage cannot remint a first-clear duplicate bond');
      // Empty-unit legacy capture needs no fabricated progress baseline.
      app.store.db.prepare('UPDATE stage_delivery SET pc_targets=NULL WHERE operation_id=?').run(next.id);
      parse(await push({ UserAdventureStage:[{ ...clear,token:'stage-character-repeat',cumulativeClearCount:2,
        dailyClearCount:2,lastCompleteDateTime:1790866810 }] },next));
      assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
      await close();
    }
    // Original authored guests/windows/stages, but synthetic preowned native
    // row shells/prerequisites. NOT guest acquisition or natural earning proof.
    const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
      .run(JSON.stringify(rows),md5(rows),name);
    const checkPermanentGuestFloor=async progress=>{
      const pcId=progress.pcId,floor=()=>app.store.db.prepare('SELECT targets FROM gift_pc_floor WHERE pc_id=?').get(pcId).targets,
        minimum=JSON.parse(floor()),pullBody={tables:['UserGuestEvent']};
      assert.deepEqual(minimum.guest,progress,'Real ACK captures owner/EXP, not a guessed marker minimum');
      for(const damaged of [{...progress,userId:progress.userId===0 ? seed.userId : 0},
        {...progress,totalExp:progress.totalExp-1}]) await rejected(push({UserGuestEvent:[damaged]}),400);
      await rejected(push({},null,{UserGuestEvent:[{pcId}]}),400);
      parse(await send('user_data/confirm'));const confirmIdentity=sequence;
      assert.equal((await send('user_data/pull',pullBody)).status,200);const pullIdentity=sequence;
      const saveBody=pushValue({UserGuestEvent:[{...progress,totalExp:progress.totalExp+1}]});
      parse(await send('user_data/push',saveBody));const saveIdentity=sequence;
      await rejected(push({UserGuestEvent:[progress]}),400);
      const advanced={...progress,totalExp:0x80000001};
      for(const [table,event] of [['profile','UPDATE'],['gift_pc_floor','UPDATE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_guest_progress BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'guest progress rollback'); END`);
        await rejected(push({UserGuestEvent:[advanced]}),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_guest_progress');
      }
      parse(await push({UserGuestEvent:[advanced]}));
      await rejected(push({UserGuestEvent:[progress]}),400);
      assert.deepEqual(JSON.parse(floor()).guest,advanced,'An existing permanent checkpoint retains accepted native EXP without issuing a reward');
      const retained=JSON.parse(floor());
      // Older checkpoint metadata cannot excuse a rewind of actual retained
      // native EXP. No new guest entitlement is inferred from the profile.
      app.store.db.prepare('UPDATE gift_pc_floor SET targets=? WHERE pc_id=?').run(JSON.stringify(minimum),pcId);
      await rejected(push({UserGuestEvent:[progress]}),400);
      parse(await push({UserGuestEvent:[advanced]}));assert.deepEqual(JSON.parse(floor()),retained);
      await close();await open();
      await rejected(push({UserGuestEvent:[{...advanced,totalExp:advanced.totalExp-1}]}),400);
      await rejected(request(port,pullIdentity,pullBody,String(pullIdentity),'user_data/pull'),503);
      await rejected(request(port,saveIdentity,saveBody,String(saveIdentity),'user_data/push'),503);
      await rejected(request(port,confirmIdentity,undefined,String(confirmIdentity),'user_data/confirm'),503);
      assert.equal((await send('user_data/pull',pullBody)).status,200);parse(await send('user_data/confirm'));
      const savedGuests=app.store.read('UserGuestEvent');
      for(const damaged of [[],[{...progress,userId:progress.userId===0 ? seed.userId : 0}],
        [{...progress,totalExp:progress.totalExp-1}]]) {
        put('UserGuestEvent',damaged);
        try {
          await rejected(send('user_data/pull',pullBody),503);await rejected(send('user_data/confirm'),503);
          await rejected(send('user/login'),503);await close();await open();
          await rejected(send('user_data/pull',pullBody),503);await rejected(send('user_data/confirm'),503);
          await rejected(send('user/login'),503);
        } finally {app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
          .run(JSON.stringify(savedGuests.data),savedGuests.token,'UserGuestEvent');}
      }
      for(const guest of [null,{}, {pcId,totalExp:progress.totalExp}, {...progress,pcId:String(pcId)},
        {...progress,userId:2},{...progress,totalExp:String(progress.totalExp)},
        {...progress,totalExp:progress.totalExp-1},{...progress,initial:true}]) {
        app.store.db.prepare('UPDATE gift_pc_floor SET targets=? WHERE pc_id=?').run(JSON.stringify({...minimum,guest}),pcId);
        try {await rejected(send('user_data/pull',pullBody),503);await rejected(send('user_data/confirm'),503);}
        finally {app.store.db.prepare('UPDATE gift_pc_floor SET targets=? WHERE pc_id=?').run(JSON.stringify(retained),pcId);}
      }
      // A legacy unit-only floor has no earned guest baseline. Read/save must
      // not reconstruct one from today's rows, even if they look permanent.
      const {guest,...legacy}=minimum;
      app.store.db.prepare('UPDATE gift_pc_floor SET targets=? WHERE pc_id=?').run(JSON.stringify(legacy),pcId);
      parse(await push({UserGuestEvent:[progress]}));assert.equal((await send('user_data/pull',pullBody)).status,200);
      assert.deepEqual(JSON.parse(floor()),legacy,'No post-save guest-floor backfill');
      app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(savedGuests.data),savedGuests.token,'UserGuestEvent');
      app.store.db.prepare('UPDATE gift_pc_floor SET targets=? WHERE pc_id=?').run(JSON.stringify(retained),pcId);
      // Synthetic Present source for the original PC. This probes shared floor
      // merging only, NOT publisher gift provenance or native reward behavior.
      const now=app.store.gameNowSeconds(),gifts=app.store.read('UserGift').data,
        gift={userId:seed.userId,id:Math.max(0,...gifts.map(row=>row.id))+1,itemId:pcId,amount:1,
          title:'Synthetic guest-floor merge',message:'',senderType:1,senderId:0,giftAcquiredType:2,
          itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,pcHeroSublimateCount:0,
          state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0};
      put('UserGift',gifts.concat(gift));
      const operation=parse(await send('gift/receive',{userId:seed.userId,giftIds:[gift.id]})).operations[0];
      assert.equal(JSON.parse(app.store.db.prepare('SELECT targets FROM gift_pc_claim WHERE operation_id=?').get(operation.id).targets).guest,undefined);
      for(const table of ['gift_pc_floor','reply_cache']) {
        app.store.db.exec(`CREATE TRIGGER fail_guest_merge BEFORE ${table==='gift_pc_floor' ? 'UPDATE' : 'INSERT'} ON ${table} BEGIN SELECT RAISE(ABORT,'guest floor merge rollback'); END`);
        await rejected(push({UserGift:[{...gift,state:1}]},operation),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_guest_merge');
      }
      parse(await push({UserGift:[{...gift,state:1}]},operation));
      assert.deepEqual(JSON.parse(floor()).guest,advanced,'A later producer without guest metadata preserves the latest native baseline');
      await close();await open();await rejected(push({},null,{UserGuestEvent:[{pcId}]}),400);
    };
    for(const [stageId,guestPcId] of [[1090002001108,1012030009],[1090002701102,1011041002]]) {
      const guest=master.pcGuests.find(row=>row.pcId===guestPcId),personalBond=master.bonds[guestPcId],
        permanentExp=master.pcGuestLevelSteps.find(row=>row.guestId===guest.id && row.marker===15).totalExp;
      assert.equal(master.pcs[master.stages[stageId].rewardKey],guestPcId);
      for(const mode of ['before','start','last','end','untouched-expiry','bond-first','clear-first','permanent']) {
        await close();fixtureMaster=master;wall=1790866800;
        const at=mode==='before' ? guest.startAt-1 : mode==='last' ? guest.endAt-1 :
          ['end','permanent'].includes(mode) ? guest.endAt : guest.startAt;
        eventDate=new Date(at*1000).toISOString();database=path.join(directory,`guest-${guestPcId}-${mode}.sqlite`);
        if(!selected(path.basename(database))) continue;
        console.log('Stage character fixture:',path.basename(database));await open();
        const progress={userId:0,pcId:guestPcId,totalExp:mode==='permanent' ? permanentExp : 1},
          owned={...seed.data.UserPC[0],...pcInitialStatInput(guestPcId,master),joiningState:1},
          board={userId:seed.userId,pcId:guestPcId,pcJobs:[],signature:0},
          stock={userId:seed.userId,limitBreakItemId:personalBond,amount:4,cumulativeAmount:11,
            bookEntryState:3,signature:0},
          baseline={...seed.data.UserAdventureStage[0],adventureStageId:stageId,state:1,tasks:[],token:'',
            cumulativeClearCount:0,dailyClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0},
          value={...baseValue,adventureStageId:stageId,token:`guest-${mode}`};
        put('UserPC',app.store.read('UserPC').data.filter(row=>row.pcId!==guestPcId).concat(owned));
        put('UserPCJobSet',app.store.read('UserPCJobSet').data.filter(row=>row.pcId!==guestPcId).concat(board));
        put('UserGuestEvent',[progress]);put('UserLimitBreakItem',[stock]);
        put('UserAdventureStage',app.store.read('UserAdventureStage').data.filter(row=>row.adventureStageId!==stageId).concat(baseline));
        // Positive adventure overrides CP availability, NOT22ec100 stage duplicates.
        put('UserAdventureState',[{...seed.data.UserAdventureState[0],stageId:1100000103101}]);
        if(['before','end'].includes(mode)) {await rejected(complete(value),503);continue;}
        if(mode==='start') {
          const roster=app.store.read('UserPC').data;
          for(const replacement of [roster.filter(row=>row.pcId!==guestPcId),roster.map(row=>row.pcId===guestPcId ? {...row,joiningState:0} : row)]) {
            put('UserPC',replacement);await rejected(complete(value),replacement.length===roster.length ? 400 : 503);
          }
          put('UserPC',roster);put('UserGuestEvent',[]);await rejected(complete(value),503);put('UserGuestEvent',[progress]);
        }
        const before=snapshot(),operation=parse(await complete(value)).operation,identity=sequence,
          receipt=app.store.db.prepare('SELECT * FROM stage_delivery WHERE operation_id=?').get(operation.id),
          captures=JSON.parse(receipt.pc_targets),captured=captures[0].guest,
          bond={...stock,amount:5,cumulativeAmount:12},
          clear={...operation.parameters.UserAdventureStage[0],state:4,cumulativeClearCount:1,dailyClearCount:1,
            firstCompleteDateTime:at,lastCompleteDateTime:at};
        assert.notEqual(snapshot(),before);assert.deepEqual(operation.parameters.gainedPCs,[guestPcId]);
        assert.deepEqual(operation.parameters.gainedItems,[],'One native duplicate bond, never duplicate wire loot');
        assert.deepEqual(captured,{...progress,at,catalogHash:md5([master.pcGuests,master.pcGuestLevelSteps])});
        assert.deepEqual(captures[0].bond,{itemId:personalBond,amount:1,cumulativeAmount:12});
        assert.deepEqual(app.store.read('UserGuestEvent').data,[progress]);
        assert.deepEqual(app.store.read('UserPC').data.find(row=>row.pcId===guestPcId),owned);
        assert.deepEqual(app.store.read('UserLimitBreakItem').data,[stock],'Issuance never precredits bond or guest state');
        await rejected(push({UserAdventureStage:[clear]},operation),400);
        await rejected(push({UserGuestEvent:[{...progress,userId:seed.userId}]}),400);
        await rejected(push({UserGuestEvent:[{...progress,totalExp:progress.totalExp-1}]}),400);
        await rejected(push({},null,{UserGuestEvent:[{pcId:guestPcId}]}),400);
        if(mode==='start') for(const damaged of [null,{...captured,at:guest.endAt},{...captured,at:String(at)},
          {...captured,catalogHash:'lost-original-catalog'},{...captured,pcId:pcId},{...captured,totalExp:-1}]) {
          const altered=structuredClone(captures);if(damaged===null) delete altered[0].guest;else altered[0].guest=damaged;
          app.store.db.prepare('UPDATE stage_delivery SET pc_targets=? WHERE operation_id=?').run(JSON.stringify(altered),operation.id);
          await rejected(complete(value),503);await rejected(push({UserAdventureStage:[clear],UserLimitBreakItem:[bond]},operation),503);
          assert.deepEqual(app.store.operations(),[operation]);
          app.store.db.prepare('UPDATE stage_delivery SET pc_targets=? WHERE operation_id=?').run(receipt.pc_targets,operation.id);
        }
        if(mode==='untouched-expiry') {
          wall+=guest.endAt-at;await rejected(complete(value),503);
          await rejected(request(port,identity,value,String(identity),'adventure/stage/complete'),503);
          await close();await open();await rejected(send('user_data/confirm'),503);
          assert.deepEqual(app.store.operations(),[operation]);continue;
        }
        if(['bond-first','clear-first'].includes(mode)) {
          const first=mode==='bond-first' ? {UserLimitBreakItem:[bond]} : {UserAdventureStage:[clear]};
          app.store.db.exec("CREATE TRIGGER fail_guest_observe BEFORE UPDATE ON stage_delivery BEGIN SELECT RAISE(ABORT,'guest observe rollback'); END");
          await rejected(push(first),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_guest_observe');
          assert(!parse(await push(first)).operations.some(row=>row.id===operation.id));
          wall+=guest.endAt-at;await close();await open();
          await rejected(complete(value),503);await rejected(send('user_data/pull',{tables:['UserGuestEvent']}),503);
          await rejected(emptyAck(operation),400);
          assert.deepEqual(JSON.parse(app.store.db.prepare('SELECT pc_targets FROM stage_delivery WHERE operation_id=?').get(operation.id).pc_targets),captures,
            'Expiry cannot recapture/reclassify an already-observed owed bond');
        }
        for(const table of [...(mode==='permanent' ? ['gift_pc_floor'] : []),'operation_done','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER fail_guest_ack BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'guest ACK rollback'); END`);
          await rejected(push({UserAdventureStage:[clear],UserLimitBreakItem:[bond]},operation),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_guest_ack');
        }
        parse(await push({UserAdventureStage:[clear],UserLimitBreakItem:[bond]},operation));assert.deepEqual(app.store.operations(),[]);
        const floor=app.store.db.prepare('SELECT targets FROM gift_pc_floor WHERE pc_id=?').get(guestPcId);
        assert.equal(Boolean(floor),mode==='permanent','A temporary duplicate bond cannot create permanent guest ownership');
        await close();await open();
        await rejected(push({UserLimitBreakItem:[{...bond,cumulativeAmount:11}]}),400);
        parse(await push({UserLimitBreakItem:[{...bond,amount:0}]}));
        if(mode!=='permanent') {
          parse(await push({UserPC:[{...owned,joiningState:0}]}));
          parse(await push({},null,{UserPC:[{pcId:guestPcId}],UserPCJobSet:[{pcId:guestPcId}],UserGuestEvent:[{pcId:guestPcId}]}));
        } else {
          await rejected(push({UserPC:[{...owned,joiningState:0}]}),400);
          await checkPermanentGuestFloor(progress);
        }
        const repeat=parse(await complete({...value,token:`guest-repeat-${mode}`})).operation;
        assert.deepEqual(repeat.parameters.gainedPCs,[],'Completed original stage cannot remint guest or bond after expiry/removal');
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM pve_item_claim WHERE operation_id=?').get(repeat.id).n,0);
      }
      for(const kind of ['new','retained','permanent']) for(const hero of [-1,0,1,2]) for(const missingCharacter of hero<0 ? [false] : [false,true])
        for(const order of ['unit-first','guest-first','clear-first',
        ...(hero<0 ? ['unit-guest-first',...(kind==='permanent' ? [] : ['untouched-expiry',...(kind==='new'?['guest-first-expiry']:[])])] :
          ['cp-first','unit-guest-cp-first','unit-guest-cp-complete'])]) {
        const at=kind==='permanent' ? guest.endAt : guest.startAt;
        await close();fixtureMaster=master;wall=1790866800;eventDate=new Date(at*1000).toISOString();
        database=path.join(directory,`fresh-guest-${guestPcId}-${kind}-${hero}-${missingCharacter}-${order}.sqlite`);
        if(!selected(path.basename(database))) continue;
        console.log('Stage character fixture:',path.basename(database));await open();
        const characterId=master.pcProfiles[guestPcId].characterId,field=['friendship','friendshipAis','friendshipLef'][Math.max(0,hero)],
          points=hero<0 ? 0 : master.characters[characterId].levels[19][1],
          character={...seed.data.UserCharacter[0],characterId,characterState:1,friendship:0,friendshipAis:0,friendshipLef:0},
          board={userId:seed.userId,pcId:guestPcId,pcJobs:[],signature:0},
          progress={userId:kind==='new' || hero%2===0 ? seed.userId : 0,pcId:guestPcId,
            totalExp:kind==='new' ? 0 : kind==='permanent' ? permanentExp : 1},
          stage={...seed.data.UserAdventureStage[0],adventureStageId:stageId,state:1,tasks:[],token:'',
            cumulativeClearCount:0,dailyClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0},
          value={...baseValue,adventureStageId:stageId,token:`fresh-${kind}-${hero}-${missingCharacter}-${order}`,friendshipStates:hero<0 ? [] :
            [{characterId,userHeroType:hero,friendship:points,friendshipLv:20}]};
        put('UserPC',app.store.read('UserPC').data.filter(row=>row.pcId!==guestPcId));
        put('UserPCJobSet',app.store.read('UserPCJobSet').data.filter(row=>row.pcId!==guestPcId));
        put('UserGuestEvent',kind==='new' ? [] : [progress]);
        put('UserCharacter',app.store.read('UserCharacter').data.filter(row=>row.characterId!==characterId).concat(missingCharacter ? [] : [character]));
        put('UserInfo',app.store.read('UserInfo').data.map(row=>({...row,heroType:Math.max(0,hero)})));
        put('UserAdventureStage',app.store.read('UserAdventureStage').data.filter(row=>row.adventureStageId!==stageId).concat(stage));
        const profiles=JSON.stringify(['UserPC','UserPCJobSet','UserGuestEvent','UserCharacter','UserCharacterCostume','UserCommunicationVoice']
          .map(name=>app.store.read(name)));
        if(hero<0 && order==='unit-first') {
          // Original retained progress is reused, never reset. Ambiguous
          // duplicate records and orphan boards still have no safe initializer.
          put('UserGuestEvent',[progress,{...progress,totalExp:progress.totalExp+1}]);await rejected(complete(value),503);
          put('UserGuestEvent',kind==='new' ? [] : [progress]);
          const priorBoards=app.store.read('UserPCJobSet').data;
          put('UserPCJobSet',[board]);await rejected(complete(value),503);put('UserPCJobSet',priorBoards);
        }
        const operation=parse(await complete(value)).operation,identity=sequence,
          receipt=app.store.db.prepare('SELECT * FROM stage_delivery WHERE operation_id=?').get(operation.id),
          captures=JSON.parse(receipt.pc_targets),refills=JSON.parse(receipt.friendship_unlocks)?.refills,
          input=refills?.inputs.find(row=>row.pc.pcId===guestPcId),
          pc={...seed.data.UserPC[0],...pcInitialStatInput(guestPcId,master),...(input ? {hp:input.hp,mp:input.mp} : {})},
          acquired=rewardCharacterFixture(app.store.read('UserCharacter').data,[guestPcId])[0],
          savedCharacter={...acquired,...(hero>=0 ? {[field]:points} : {})},
          wardrobe=rewardCostumeFixture(app.store.read('UserCharacterCostume').data,[guestPcId],app.store.read('UserCommunicationVoice').data),
          clear={...operation.parameters.UserAdventureStage[0],state:4,cumulativeClearCount:1,dailyClearCount:1,
            firstCompleteDateTime:at,lastCompleteDateTime:at},
          full={UserPC:[pc],UserPCJobSet:[board],UserGuestEvent:[progress],UserCharacter:[savedCharacter],...wardrobe,
            UserAdventureStage:[clear,...(rewardUnitStoryFixture(app.store.read('UserAdventureStage').data,[guestPcId]).UserAdventureStage ?? [])]};
        assert.deepEqual(JSON.parse(receipt.pc_before),[]);assert.equal(captures[0].bond,undefined);
        assert.deepEqual(captures[0].guest,{...progress,at,catalogHash:md5([master.pcGuests,master.pcGuestLevelSteps]),
          ...(kind==='new' ? {initial:true} : {restored:true})});
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM pve_item_claim WHERE operation_id=?').get(operation.id).n,0,
          'Fresh native acquisition is not a personal-bond duplicate');
        assert.equal(JSON.stringify(['UserPC','UserPCJobSet','UserGuestEvent','UserCharacter','UserCharacterCostume','UserCommunicationVoice']
          .map(name=>app.store.read(name))),profiles,'Queue issuance never materializes native guest/unit/character/wardrobe');
        if(hero>=0) {
          assert.deepEqual(input.guest,progress);assert.deepEqual(refills.initialPcIds,[guestPcId]);
          assert.equal(JSON.parse(receipt.friendship_before)[0].initial,missingCharacter ? true : undefined);
          assert.equal(refills.characters[0].initial,missingCharacter ? true : undefined);
          if(missingCharacter) {
            assert.equal(refills.characters[0].userId,0);assert.equal(captures[0].target.character.present,false);
            const shadow=JSON.parse(receipt.friendship_before);delete shadow[0].initial;
            app.store.db.prepare('UPDATE stage_delivery SET friendship_before=? WHERE operation_id=?').run(JSON.stringify(shadow),operation.id);
            await rejected(send('user_data/confirm'),503);
            app.store.db.prepare('UPDATE stage_delivery SET friendship_before=? WHERE operation_id=?').run(receipt.friendship_before,operation.id);
          }
          assert.equal(refills.targets.find(row=>row.pcId===guestPcId).eligible,kind==='permanent' ? undefined : true);
          if(kind!=='new') {
            // Structurally valid CP shadows must still bind the stage's exact
            // retained guest owner/EXP, not an independent initializer guess.
            const shadow=JSON.parse(receipt.friendship_unlocks),target=shadow.refills.inputs.find(row=>row.pc.pcId===guestPcId);
            target.guest={...target.guest,totalExp:0};
            app.store.db.prepare('UPDATE stage_delivery SET friendship_unlocks=? WHERE operation_id=?').run(JSON.stringify(shadow),operation.id);
            await rejected(send('user_data/confirm'),503);
            app.store.db.prepare('UPDATE stage_delivery SET friendship_unlocks=? WHERE operation_id=?').run(receipt.friendship_unlocks,operation.id);
          }
        }
        const {UserGuestEvent,...withoutGuest}=full;
        await rejected(push(withoutGuest,operation,{UserGuestEvent:[{pcId:guestPcId}]}),400);
        for(const damaged of [{...progress,userId:progress.userId===0 ? seed.userId : 0},
          {...progress,totalExp:kind==='new' ? -1 : progress.totalExp-1},{...progress,pcId:String(guestPcId)}])
          await rejected(push({...full,UserGuestEvent:[damaged]},operation),400);
        for(const initial of [undefined,false,'true']) {
          const broken=structuredClone(captures),marker=kind==='new' ? 'initial' : 'restored';
          if(initial===undefined) delete broken[0].guest[marker];else broken[0].guest[marker]=initial;
          app.store.db.prepare('UPDATE stage_delivery SET pc_targets=? WHERE operation_id=?').run(JSON.stringify(broken),operation.id);
          await rejected(complete(value),503);await rejected(push(full,operation),503);
          app.store.db.prepare('UPDATE stage_delivery SET pc_targets=? WHERE operation_id=?').run(receipt.pc_targets,operation.id);
        }
        if(order==='untouched-expiry') {
          wall+=guest.endAt-at;await rejected(complete(value),503);
          await rejected(request(port,identity,value,String(identity),'adventure/stage/complete'),503);
          await close();await open();await rejected(send('user_data/confirm'),503);continue;
        }
        const guestFirst=['guest-first','guest-first-expiry'].includes(order),guestUnitPrefix=order==='unit-guest-first',
          coupledUnitPrefix=['unit-guest-cp-first','unit-guest-cp-complete'].includes(order),
          coupledCpComplete=order==='unit-guest-cp-complete',unitPrefix=guestUnitPrefix || coupledUnitPrefix,
          coupledPrefix={UserPC:[pc],UserGuestEvent:[progress],UserCharacter:[savedCharacter]},
          first=coupledCpComplete ? friendshipUnlockFixture(app.store,coupledPrefix,[operation]) : coupledUnitPrefix ? coupledPrefix :
            guestUnitPrefix ? {UserPC:[pc],UserGuestEvent:[progress]} : guestFirst ? {UserGuestEvent:[progress]} : order==='clear-first' ? {UserAdventureStage:[clear]} :
          order==='cp-first' ? {UserCharacter:[savedCharacter]} : {UserPC:[pc]};
        const unchangedGuest=kind!=='new' && guestFirst;
        if(!unchangedGuest) {
          app.store.db.exec("CREATE TRIGGER fail_fresh_guest_observe BEFORE UPDATE ON stage_delivery BEGIN SELECT RAISE(ABORT,'fresh guest observe rollback'); END");
          await rejected(push(first),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_fresh_guest_observe');
        }
        assert.deepEqual(parse(await push(first)).operations,[],
          'A guest/progression save without an ACK cannot clear the pending native receipt');
        assert.deepEqual(app.store.operations(),[operation]);
        if(guestFirst) {
          const observed=JSON.parse(app.store.db.prepare('SELECT observed FROM stage_delivery WHERE operation_id=?').get(operation.id).observed);
          assert.equal(observed.includes(`guest:${guestPcId}`),kind==='new');
          await rejected(push({},null,{UserGuestEvent:[{pcId:guestPcId}]}),400);
        }
        let guestUnitDerived=null;
        if(unitPrefix) {
          const target=captures[0].target,needsUnlocks=target.wardrobe?.before.some(row=>row.state===1 || row.voices.some(voice=>voice.state===1)) ||
              target.unitStory && !(target.unitStory.beforeState>0),
            expected=[2+2*Number(Boolean(needsUnlocks))],savedReceipt=app.store.db.prepare('SELECT * FROM stage_delivery WHERE operation_id=?').get(operation.id),
            retained=snapshot(),queued=app.store.operations();
          guestUnitDerived=app.store.stageColdRecovery(operation);
          assert.deepEqual(guestUnitDerived.parameters.offlineStagePcResumes,expected);
          if(coupledUnitPrefix) assert.deepEqual(guestUnitDerived.parameters.friendshipStates,coupledCpComplete ?
            operation.parameters.friendshipStates : operation.parameters.friendshipStates.map(row=>({...row,offlineStageCpLevelPending:1})));
          assert.equal(snapshot(),retained);assert.deepEqual(app.store.operations(),queued);
          assert.deepEqual(parse(await complete(value)).operation,guestUnitDerived);
          assert.deepEqual(parse(await request(port,identity,value,String(identity),'adventure/stage/complete')).operation,guestUnitDerived);
          assert(app.store.read('UserPC').data.some(row=>row.pcId===guestPcId));
          assert(!app.store.read('UserPCJobSet').data.some(row=>row.pcId===guestPcId));
          for(const key of [`pc:${guestPcId}`,...(kind==='new'?[`guest:${guestPcId}`]:[])]) {
            app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?')
              .run(JSON.stringify(JSON.parse(savedReceipt.observed).filter(row=>row!==key)),operation.id);
            await rejected(send('user_data/confirm'),503);
            app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(savedReceipt.observed,operation.id);
          }
          if(coupledUnitPrefix) {
            const savedCharacters=app.store.read('UserCharacter').data;
            put('UserCharacter',savedCharacters.filter(row=>row.characterId!==characterId));
            await rejected(send('user_data/confirm'),503);put('UserCharacter',savedCharacters);
          }
          put('UserGuestEvent',[]);await rejected(send('user_data/confirm'),503);put('UserGuestEvent',[progress]);
          app.store.db.prepare('INSERT INTO gift_pc_floor(pc_id,targets) VALUES(?,?)').run(guestPcId,JSON.stringify(target));
          await rejected(send('user_data/confirm'),503);
          app.store.db.prepare('DELETE FROM gift_pc_floor WHERE pc_id=?').run(guestPcId);
        }
        const guestPrefix=kind==='new' && guestFirst;
        if(guestPrefix) {
          const saved=app.store.read('UserGuestEvent'),savedReceipt=app.store.db.prepare('SELECT * FROM stage_delivery WHERE operation_id=?').get(operation.id),
            queued=app.store.operations(),retained=snapshot();
          assert.deepEqual(app.store.stageColdRecovery(operation),operation,'The original absent-PC constructor reuses the saved guest without a new initializer or skip marker');
          assert.equal(snapshot(),retained);assert.deepEqual(app.store.operations(),queued);
          assert(!app.store.read('UserPC').data.some(row=>row.pcId===guestPcId));
          assert(!app.store.read('UserPCJobSet').data.some(row=>row.pcId===guestPcId));
          assert.deepEqual(parse(await complete(value)).operation,operation);
          assert.deepEqual(parse(await request(port,identity,value,String(identity),'adventure/stage/complete')).operation,operation);
          assert.deepEqual(app.store.read('UserGuestEvent'),saved);
          assert.deepEqual(app.store.db.prepare('SELECT * FROM stage_delivery WHERE operation_id=?').get(operation.id),savedReceipt);
          assert.deepEqual(app.store.operations(),queued);
          // A legacy/current row without the committed guest observation is not proof of an interrupted native save.
          app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?')
            .run(JSON.stringify(JSON.parse(savedReceipt.observed).filter(key=>key!==`guest:${guestPcId}`)),operation.id);
          await rejected(send('user_data/confirm'),503);
          app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(savedReceipt.observed,operation.id);
          put('UserGuestEvent',[]);await rejected(send('user_data/confirm'),503);put('UserGuestEvent',saved.data);
          app.store.db.prepare('INSERT INTO gift_pc_floor(pc_id,targets) VALUES(?,?)').run(guestPcId,JSON.stringify(captures[0].target));
          await rejected(send('user_data/confirm'),503);
          app.store.db.prepare('DELETE FROM gift_pc_floor WHERE pc_id=?').run(guestPcId);
          if(hero<0 && order==='guest-first') {
            const older={...progress};parse(await push({UserGuestEvent:[{...progress,totalExp:progress.totalExp+1}]}));
            await rejected(push({UserGuestEvent:[older]}),400);progress.totalExp++;
          }
        }
        await close();await open();
        if(unchangedGuest || guestPrefix || unitPrefix) {
          const expectedOperation=unitPrefix ? guestUnitDerived : operation;
          assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id),expectedOperation);
          if(guestPrefix) {
            assert.deepEqual(app.store.stageColdRecovery(operation),operation);
            assert.deepEqual(app.store.read('UserGuestEvent').data,[progress]);
            const pull={tables:['UserPC','UserPCJobSet','UserGuestEvent','UserCharacter']},pulled=await send('user_data/pull',pull);
            assert.equal(pulled.status,200);assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull(pull)));
          }
          if(unitPrefix) {
            assert.deepEqual(app.store.stageColdRecovery(operation),guestUnitDerived);
            assert.deepEqual(app.store.read('UserGuestEvent').data,[progress]);
            const pull={tables:['UserPC','UserPCJobSet','UserGuestEvent','UserCharacter']},pulled=await send('user_data/pull',pull);
            assert.equal(pulled.status,200);assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull(pull)));
            assert(app.store.read('UserPC').data.some(row=>row.pcId===guestPcId));
            assert(!app.store.read('UserPCJobSet').data.some(row=>row.pcId===guestPcId));
          }
          assert.deepEqual(app.store.operations(),[operation]);
          assert.equal(app.store.read('UserPC').data.some(row=>row.pcId===guestPcId),unitPrefix);
          // Confirm records its exact reply, not a unit, guest grant, ownership or operation ACK.
          assert.deepEqual(JSON.parse(app.store.db.prepare('SELECT pc_targets FROM stage_delivery WHERE operation_id=?').get(operation.id).pc_targets),captures);
        } else await rejected(send('user_data/confirm'),503);
        if(order==='guest-first-expiry') {
          wall+=guest.endAt-at;
          await rejected(complete(value),503);
          await rejected(request(port,identity,value,String(identity),'adventure/stage/complete'),503);
          await rejected(send('user/login'),503);await rejected(send('user_data/confirm'),503);
          await rejected(send('user_data/pull',{tables:['UserPC','UserPCJobSet','UserGuestEvent']}),503);
          assert.deepEqual(app.store.read('UserGuestEvent').data,[progress]);assert.deepEqual(app.store.operations(),[operation]);
          assert(!app.store.read('UserPC').data.some(row=>row.pcId===guestPcId));
          continue; // Expiry retains the original incomplete receipt, not a new permanent unit or reset.
        }
        if(coupledUnitPrefix && !coupledCpComplete) {
          parse(await push(friendshipUnlockFixture(app.store,{},[operation])));
          const closed=app.store.stageColdRecovery(operation);
          assert.deepEqual(closed.parameters.offlineStagePcResumes,guestUnitDerived.parameters.offlineStagePcResumes);
          assert.deepEqual(closed.parameters.friendshipStates,operation.parameters.friendshipStates);
          assert.deepEqual(app.store.stageColdRecovery(operation,guestUnitDerived),closed,
            'A cached combined control may lose only its now-completed CP fanout marker');
          guestUnitDerived=closed;
        }
        await rejected(emptyAck(operation),400);
        // Clear/CP/unit halves do not excuse the missing native guest row.
        if(!guestFirst) await rejected(push(withoutGuest,operation,{UserGuestEvent:[{pcId:guestPcId}]}),400);
        const acknowledgedGuest=kind==='permanent' ? {...progress,totalExp:progress.totalExp+1} : progress,
          acknowledgement=friendshipUnlockFixture(app.store,{...full,UserGuestEvent:[acknowledgedGuest]},hero>=0?[operation]:[]);
        for(const table of [...(kind==='permanent' ? ['gift_pc_floor'] : []),'operation_done','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER fail_fresh_guest_ack BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'fresh guest ACK rollback'); END`);
          await rejected(push(acknowledgement,operation),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_fresh_guest_ack');
        }
        parse(await push(acknowledgement,operation));assert.deepEqual(app.store.operations(),[]);
        assert.equal(Boolean(app.store.db.prepare('SELECT 1 FROM gift_pc_floor WHERE pc_id=?').get(guestPcId)),kind==='permanent');
        await close();await open();assert.deepEqual(app.store.read('UserGuestEvent').data,[acknowledgedGuest]);
        if(kind==='permanent') {
          assert.deepEqual(JSON.parse(app.store.db.prepare('SELECT targets FROM gift_pc_floor WHERE pc_id=?').get(guestPcId).targets).guest,acknowledgedGuest);
          await rejected(push({UserGuestEvent:[progress]}),400);
          await rejected(push({UserGuestEvent:[{...progress,userId:progress.userId===0 ? seed.userId : 0}]}),400);
          await rejected(push({UserGuestEvent:[{...progress,totalExp:progress.totalExp-1}]}),400);
          await rejected(push({},null,{UserGuestEvent:[{pcId:guestPcId}]}),400);
        }
        for(const costume of wardrobe.UserCharacterCostume ?? [])
          await rejected(push({UserCharacterCostume:[{...costume,costumeState:1}]}),400);
        const unjoin=push({UserPC:[{...app.store.read('UserPC').data.find(row=>row.pcId===guestPcId),joiningState:0}]});
        if(kind==='permanent') await rejected(unjoin,400);else parse(await unjoin);
      }
    }
    //Original stage rewards with slot76 outfits and authored unit stories, not a synthetic reward catalog.
    for(const [stageId,rewardPcId] of [[1160000601128,1011020015],[1160000901131,1011001029]])
      for(const absentCharacter of [false,true]) for(let mask=1;mask<8;mask++) {
        await close();fixtureMaster=master;wall=1790866800;eventDate=null;
        database=path.join(directory,`constructor-prefix-${stageId}-${absentCharacter}-${mask}.sqlite`);
        if(!selected(path.basename(database))) continue;await open();
        const profile=master.pcProfiles[rewardPcId],characterId=profile.characterId,
          put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name),
          baseline={...seed.data.UserAdventureStage[0],adventureStageId:stageId,state:1,tasks:[],token:'',
            cumulativeClearCount:0,dailyClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0},
          value={...baseValue,adventureStageId:stageId,token:`constructor-${absentCharacter}-${mask}`};
        assert.equal(master.stages[stageId].rewardType,50);assert.equal(master.pcs[master.stages[stageId].rewardKey],rewardPcId);
        put('UserPC',app.store.read('UserPC').data.filter(row=>row.pcId!==rewardPcId));
        put('UserPCJobSet',app.store.read('UserPCJobSet').data.filter(row=>row.pcId!==rewardPcId));
        put('UserCharacter',app.store.read('UserCharacter').data.filter(row=>row.characterId!==characterId).concat(absentCharacter?[]:
          [{...seed.data.UserCharacter[0],characterId,characterState:1,friendship:0,friendshipAis:0,friendshipLef:0}]));
        put('UserAdventureStage',app.store.read('UserAdventureStage').data.filter(row=>row.adventureStageId!==stageId).concat(baseline));
        const operation=parse(await complete(value)).operation,identity=sequence,
          character=rewardCharacterFixture(app.store.read('UserCharacter').data,[rewardPcId]),
          wardrobe=rewardCostumeFixture(app.store.read('UserCharacterCostume').data,[rewardPcId],app.store.read('UserCommunicationVoice').data),
          story=rewardUnitStoryFixture(app.store.read('UserAdventureStage').data,[rewardPcId]),
          names=['UserCharacter','UserCharacterCostume','UserAdventureStage'],
          puts={UserCharacter:character,...wardrobe,...story},
          prefix=Object.fromEntries(names.filter((name,index)=>mask&(1<<index)).map(name=>[name,puts[name]]));
        assert(names.every(name=>puts[name]?.length));assert(!wardrobe.UserCommunicationVoice?.length);
        app.store.db.exec("CREATE TRIGGER fail_constructor_observe BEFORE UPDATE ON stage_delivery BEGIN SELECT RAISE(ABORT,'constructor prefix rollback'); END");
        await rejected(push(prefix),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_constructor_observe');
        parse(await push(prefix));
        if(mask===7) {
          put('UserCharacter',app.store.read('UserCharacter').data.map(row=>row.characterId===characterId?{...row,characterState:3}:row));
          put('UserCharacterCostume',app.store.read('UserCharacterCostume').data.map(row=>row.costumeId===profile.initialCostumeId?{...row,costumeState:3}:row));
          put('UserAdventureStage',app.store.read('UserAdventureStage').data.map(row=>story.UserAdventureStage.some(stage=>
            stage.adventureStageId===row.adventureStageId)?{...row,state:3}:row));
          await rejected(push({UserCharacter:character}),400);
          await rejected(push({UserCharacterCostume:wardrobe.UserCharacterCostume}),400);
          await rejected(push({UserAdventureStage:story.UserAdventureStage}),400);
        }
        const saved=Object.fromEntries(Object.keys(prefix).map(name=>[name,app.store.read(name)])),
          capture=app.store.db.prepare('SELECT * FROM stage_delivery WHERE operation_id=?').get(operation.id),queued=app.store.operations(),retained=snapshot();
        assert.deepEqual(app.store.stageColdRecovery(operation),operation);assert.equal(snapshot(),retained);
        assert(!app.store.read('UserPC').data.some(row=>row.pcId===rewardPcId));
        assert(!app.store.read('UserPCJobSet').data.some(row=>row.pcId===rewardPcId));await rejected(emptyAck(operation),400);
        assert.deepEqual(parse(await complete(value)).operation,operation);
        assert.deepEqual(parse(await request(port,identity,value,String(identity),'adventure/stage/complete')).operation,operation);
        await close();await open();parse(await send('user/login'));
        assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id),operation);
        const pull={tables:['UserPC','UserPCJobSet',...names]},pulled=await send('user_data/pull',pull);
        assert.equal(pulled.status,200);assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull(pull)));
        assert.deepEqual(app.store.operations(),queued);
        assert.deepEqual(app.store.db.prepare('SELECT * FROM stage_delivery WHERE operation_id=?').get(operation.id),capture);
        for(const name of Object.keys(saved)) assert.deepEqual(app.store.read(name),saved[name]);
        const observations=JSON.parse(capture.observed),prefixKeys=observations.filter(key=>/^(character-row|character|c|unit-story):/.test(key));
        assert(prefixKeys.length);
        app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?')
          .run(JSON.stringify(observations.filter(key=>!prefixKeys.includes(key))),operation.id);
        await rejected(send('user_data/confirm'),503);
        app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(capture.observed,operation.id);
        if(mask&1) await rejected(push({UserCharacter:character.map(row=>({...row,characterState:1}))}),400);
        if(mask&2) await rejected(push({UserCharacterCostume:wardrobe.UserCharacterCostume.map(row=>({...row,costumeState:1}))}),400);
        if(mask&4) await rejected(push({UserAdventureStage:story.UserAdventureStage.map(row=>({...row,state:0}))}),400);
        const at=app.store.gameNowSeconds(),
          unit={...seed.data.UserPC[0],...pcInitialStatInput(rewardPcId,master)},
          boards={userId:seed.userId,pcId:rewardPcId,pcJobs:[],signature:0},
          clear={...operation.parameters.UserAdventureStage[0],state:4,cumulativeClearCount:1,dailyClearCount:1,
            firstCompleteDateTime:at,lastCompleteDateTime:at},
          remaining=Object.fromEntries(names.filter((name,index)=>!(mask&(1<<index))).map(name=>[name,puts[name]])),
          full={...remaining,UserPC:[unit],UserPCJobSet:[boards],UserAdventureStage:[clear,...(remaining.UserAdventureStage??[])]};
        if(mask===7) {
          parse(await push({UserPC:[unit],UserPCJobSet:[boards]}));
          const advanced={...unit,totalExp:unit.totalExp+1},advancedBoards={...boards,pcJobs:[{
            pcJobId:profile.jobIds[0],abilityPanelState:0x2000000,signature:0,abilityPanels:[]}]};
          parse(await push({UserPC:[advanced],UserPCJobSet:[advancedBoards]}));
          await rejected(push({UserPC:[unit]}),400);await rejected(push({UserPCJobSet:[boards]}),400);
          full.UserPC=[advanced];full.UserPCJobSet=[advancedBoards];
        }
        for(const [table,event] of [['profile','UPDATE OF data'],['stage_delivery','UPDATE'],['gift_pc_floor','INSERT'],
          ['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER fail_constructor_finish BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'constructor finish rollback'); END`);
          await rejected(push(full,operation),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_constructor_finish');
        }
        parse(await push(full,operation));assert.deepEqual(app.store.operations(),[]);
        for(const name of Object.keys(saved)) {
          if(name==='UserAdventureStage') {
            for(const row of saved[name].data.filter(row=>story.UserAdventureStage.some(stage=>stage.adventureStageId===row.adventureStageId)))
              assert.deepEqual(app.store.read(name).data.find(stage=>stage.adventureStageId===row.adventureStageId),row);
          }
          else assert.deepEqual(app.store.read(name),saved[name]);
        }
      }
    //WRITTEN ONLY / NOT RUN: original reward identities; quantity2 is solely a synthetic duplicate-loop probe.
    for(const [stageId,rewardPcId] of [[1160000601128,1011020015],[1160000901131,1011001029]])
      for(const characterMode of ['absent','pending','ready']) for(const quantity of [1,2]) for(const boardsReady of [true,false])
      for(const unlockPrefix of [3,0,1,2]) {
        await close();fixtureMaster=quantity===1?master:{...master,stages:{...master.stages,
          [stageId]:{...master.stages[stageId],rewardAmount:quantity}}};wall=1790866800;eventDate=null;
        database=path.join(directory,`saved-constructor-${stageId}-${characterMode}-${quantity}-${boardsReady}-${unlockPrefix}.sqlite`);
        if(!selected(path.basename(database))) continue;await open();
        const profile=master.pcProfiles[rewardPcId],characterId=profile.characterId,
          characterPresent=characterMode!=='absent',characterReady=characterMode==='ready',
          put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name),
          baseline={...seed.data.UserAdventureStage[0],adventureStageId:stageId,state:1,tasks:[],token:'',
            cumulativeClearCount:0,dailyClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0},
          value={...baseValue,adventureStageId:stageId,token:`saved-constructor-${characterMode}-${quantity}-${unlockPrefix}`},
          authoredStories=rewardUnitStoryFixture([],[rewardPcId]).UserAdventureStage??[],
          authoredStoryIds=new Set(authoredStories.map(row=>row.adventureStageId));
        put('UserPC',app.store.read('UserPC').data.filter(row=>row.pcId!==rewardPcId));
        put('UserPCJobSet',app.store.read('UserPCJobSet').data.filter(row=>row.pcId!==rewardPcId));
        put('UserCharacter',app.store.read('UserCharacter').data.filter(row=>row.characterId!==characterId).concat(characterPresent?[
          {...seed.data.UserCharacter[0],characterId,characterState:1,friendship:0,friendshipAis:0,friendshipLef:0}]:[]));
        put('UserCharacterCostume',app.store.read('UserCharacterCostume').data.filter(row=>row.costumeId!==profile.initialCostumeId));
        put('UserAdventureStage',app.store.read('UserAdventureStage').data
          .filter(row=>row.adventureStageId!==stageId&&!authoredStoryIds.has(row.adventureStageId)).concat(baseline));
        const operation=parse(await complete(value)).operation,identity=sequence,
          character=rewardCharacterFixture(app.store.read('UserCharacter').data,[rewardPcId]),
          wardrobe=rewardCostumeFixture(app.store.read('UserCharacterCostume').data,[rewardPcId],app.store.read('UserCommunicationVoice').data),
          story=rewardUnitStoryFixture(app.store.read('UserAdventureStage').data,[rewardPcId]),
          unit={...seed.data.UserPC[0],...pcInitialStatInput(rewardPcId,master)},
          boards={userId:seed.userId,pcId:rewardPcId,pcJobs:[],signature:0},
          savedWardrobe=Object.fromEntries(Object.entries(wardrobe).map(([name,rows])=>[name,rows.map(row=>
            name==='UserCharacterCostume'&&quantity===2?{...row,costumeState:3}:row)])),
          prefix={UserPC:[unit],...(boardsReady?{UserPCJobSet:[boards]}:{}),
            ...((unlockPrefix&1)?savedWardrobe:{}),...((unlockPrefix&2)?story:{}),
            ...(characterReady?{UserCharacter:character}:{})};
        assert(!wardrobe.UserCommunicationVoice?.length,'These original stage fixtures must not require a coupled voice unlock');
        assert(wardrobe.UserCharacterCostume?.length&&story.UserAdventureStage?.length,
          'The saved-unit matrix needs both original slot76 outfit and unit-story targets');
        assert.deepEqual(operation.parameters.gainedPCs,Array(quantity).fill(rewardPcId));
        parse(await push(prefix));await rejected(emptyAck(operation),400);
        const queued=app.store.operations(),receipt=app.store.db.prepare('SELECT * FROM stage_delivery WHERE operation_id=?').get(operation.id),
          retained=snapshot(),derived=app.store.stageColdRecovery(operation),mask=Array(quantity).fill(0);
        assert.equal(JSON.parse(receipt.pc_targets)[0].target.character.present,characterPresent);
        mask[0]=1+Number(!boardsReady)+2*Number(unlockPrefix!==3);
        assert.equal(snapshot(),retained);assert.deepEqual(app.store.operations(),queued);
        assert.deepEqual(derived.parameters.offlineStagePcResumes,mask);
        assert.deepEqual(derived.parameters.gainedPCs,operation.parameters.gainedPCs);
        assert.equal(derived.id,operation.id);assert.equal(derived.token,operation.token);assert.equal(derived.signature,operation.signature);
        assert.deepEqual(parse(await complete(value)).operation,derived);
        assert.deepEqual(parse(await request(port,identity,value,String(identity),'adventure/stage/complete')).operation,derived);
        for(const key of [`pc:${rewardPcId}`,...(boardsReady?[`pcset:${rewardPcId}`]:[])]) {
          app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?')
            .run(JSON.stringify(JSON.parse(receipt.observed).filter(row=>row!==key)),operation.id);
          await rejected(send('user_data/confirm'),503);
          app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(receipt.observed,operation.id);
        }
        if(characterReady && boardsReady && unlockPrefix===3) {
          app.store.db.prepare('INSERT INTO gift_pc_floor(pc_id,targets) VALUES(?,?)')
            .run(rewardPcId,JSON.stringify(JSON.parse(receipt.pc_targets)[0].target));
          await rejected(send('user_data/confirm'),503);
          app.store.db.prepare('DELETE FROM gift_pc_floor WHERE pc_id=?').run(rewardPcId);
        }
        for(const name of [...(characterPresent?['UserCharacter']:[]),...(boardsReady?['UserPCJobSet']:[]),...((unlockPrefix&1)?['UserCharacterCostume']:[]),
          ...((unlockPrefix&2)?['UserAdventureStage']:[])]) {
          const saved=app.store.db.prepare('SELECT data,token FROM profile WHERE name=?').get(name),
            rows=JSON.parse(saved.data).filter(row=>name==='UserCharacter'?row.characterId!==characterId:
              name==='UserPCJobSet'?row.pcId!==rewardPcId:
              name==='UserCharacterCostume'?row.costumeId!==profile.initialCostumeId:
                !story.UserAdventureStage.some(stage=>stage.adventureStageId===row.adventureStageId));
          put(name,rows);await rejected(send('user_data/confirm'),503);
          app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(saved.data,saved.token,name);
        }
        await rejected(push({UserPC:[{...unit,offlineStagePcResumes:mask}]}),400);
        for(const badMask of [[0],[true],['1'],[1,1]]) {
          assert.throws(()=>app.store.stageColdRecovery({...operation,parameters:{...operation.parameters,offlineStagePcResumes:badMask}}),
            error=>error.status===503,'Derived control must never become an original signed queue envelope');
        }
        const beforeEnvelope=snapshot();
        const invalidControls=[0,true,String(mask[0]),-1,5,...[1,2,3,4]
          .filter(control=>((control-1)&(mask[0]-1))!==(mask[0]-1))];
        for(const first of invalidControls) {
          assert.throws(()=>app.store.stageColdRecovery(operation,{...derived,parameters:{...derived.parameters,
            offlineStagePcResumes:[first,...mask.slice(1)]}}),error=>error.status===503);
        }
        for(const change of [{id:operation.id+1},{type:16000},{token:'changed-stage-token'},{signature:operation.signature+1},
          {parameters:{...derived.parameters,gainedPCs:[]}},
          {parameters:{...derived.parameters,offlineStagePcResumes:[...mask,1]}}])
          assert.throws(()=>app.store.stageColdRecovery(operation,{...derived,...change}),error=>error.status===503);
        assert.equal(snapshot(),beforeEnvelope);
        if(!boardsReady) {
          assert(!app.store.read('UserPCJobSet').data.some(row=>row.pcId===rewardPcId),'Projection cannot prewrite missing boards');
          const captures=JSON.parse(receipt.pc_targets),required=structuredClone(captures);
          required[0].target.pcJobs=[{pcJobId:profile.jobIds[0],abilityPanelState:0x2000000}];
          app.store.db.prepare('UPDATE stage_delivery SET pc_targets=? WHERE operation_id=?').run(JSON.stringify(required),operation.id);
          await rejected(send('user_data/confirm'),503);
          app.store.db.prepare('UPDATE stage_delivery SET pc_targets=? WHERE operation_id=?').run(receipt.pc_targets,operation.id);
          app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?')
            .run(JSON.stringify([...JSON.parse(receipt.observed),`pcset:${rewardPcId}`]),operation.id);
          await rejected(send('user_data/confirm'),503);
          app.store.db.prepare('UPDATE stage_delivery SET observed=? WHERE operation_id=?').run(receipt.observed,operation.id);
        }
        await close();await open();parse(await send('user/login'));
        assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id),derived);
        const pull={tables:['UserPC','UserPCJobSet','UserCharacter','UserCharacterCostume','UserAdventureStage']},pulled=await send('user_data/pull',pull);
        assert.equal(pulled.status,200);assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull(pull)));
        let boardsDone=boardsReady,unlocksDone=unlockPrefix===3;
        const currentMask=()=>[1+Number(!boardsDone)+2*Number(!unlocksDone),...mask.slice(1)],
          assertRebound=async()=>{
            const expected=currentMask(),beforeRebind=snapshot(),rebound=app.store.stageColdRecovery(operation,derived);
            assert.equal(snapshot(),beforeRebind);assert.deepEqual(rebound.parameters.offlineStagePcResumes,expected);
            assert.deepEqual(rebound.parameters.gainedPCs,operation.parameters.gainedPCs);assert.deepEqual(app.store.operations(),queued);
            assert.deepEqual(parse(await complete(value)).operation,rebound);
            assert.deepEqual(parse(await request(port,identity,value,String(identity),'adventure/stage/complete')).operation,rebound);
          },
          saveBoards=async()=>{
            if(boardsDone) return;
            await rejected(emptyAck(operation),400);
            for(const [table,event] of [['profile','UPDATE OF data'],['stage_delivery','UPDATE'],['reply_cache','INSERT']]) {
              app.store.db.exec(`CREATE TRIGGER fail_stage_lazy_board BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'lazy board rollback'); END`);
              await rejected(push({UserPCJobSet:[boards]}),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_stage_lazy_board');
            }
            parse(await push({UserPCJobSet:[boards]}));boardsDone=true;await assertRebound();
          },
          saveUnlocks=async()=>{
            if(unlocksDone) return;
            const unlocks={...((unlockPrefix&1)?{}:wardrobe),...((unlockPrefix&2)?{}:story)};
            await rejected(emptyAck(operation),400);
            for(const [table,event] of [['profile','UPDATE OF data'],['stage_delivery','UPDATE'],['reply_cache','INSERT']]) {
              app.store.db.exec(`CREATE TRIGGER fail_stage_lazy_unlock BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'lazy unlock rollback'); END`);
              await rejected(push(unlocks),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_stage_lazy_unlock');
            }
            parse(await push(unlocks));unlocksDone=true;await assertRebound();
          };
        if(quantity===1) { await saveUnlocks();await saveBoards(); }
        else { await saveBoards();await saveUnlocks(); }
        if((unlockPrefix&1)&&quantity===2)
          assert.equal(app.store.read('UserCharacterCostume').data.find(row=>row.costumeId===profile.initialCostumeId).costumeState,3);
        const readyMask=[1,...mask.slice(1)];
        await rejected(emptyAck(operation),400);
        await close();await open();assert.deepEqual(app.store.stageColdRecovery(operation,derived).parameters.offlineStagePcResumes,readyMask);
        const advanced={...unit,totalExp:unit.totalExp+1},advancedBoards={...boards,pcJobs:[{
          pcJobId:profile.jobIds[0],abilityPanelState:0x2000000,abilityPanels:[],signature:0}]};
        parse(await push({UserPC:[advanced],UserPCJobSet:[advancedBoards]}));
        assert.deepEqual(app.store.stageColdRecovery(operation).parameters.offlineStagePcResumes,readyMask);
        assert.deepEqual(app.store.stageColdRecovery(operation,derived).parameters.offlineStagePcResumes,readyMask);
        await rejected(push({UserPC:[unit]}),400);await rejected(push({UserPCJobSet:[boards]}),400);
        const at=app.store.gameNowSeconds(),full={UserAdventureStage:[{...operation.parameters.UserAdventureStage[0],state:4,
          cumulativeClearCount:1,dailyClearCount:1,firstCompleteDateTime:at,lastCompleteDateTime:at}],
          ...(characterReady?{}:{UserCharacter:character})},bond=app.store.db.prepare('SELECT * FROM pve_item_claim WHERE operation_id=?').get(operation.id);
        if(quantity===2) {
          assert.equal(bond.item_id,master.bonds[rewardPcId]);
          const previous=app.store.read('UserLimitBreakItem').data.find(row=>row.limitBreakItemId===bond.item_id);
          full.UserLimitBreakItem=[{...previous,userId:seed.userId,limitBreakItemId:bond.item_id,amount:(previous?.amount??0)+1,
            cumulativeAmount:bond.cumulative_amount,bookEntryState:3,signature:operation.signature}];
          const saved=parse(await push({UserLimitBreakItem:full.UserLimitBreakItem})),bondDerived=app.store.stageColdRecovery(operation,derived);
          assert.deepEqual(saved.operations.find(row=>row.id===operation.id),bondDerived);
          assert.deepEqual(bondDerived.parameters.offlineStagePcResumes,[1,5]);
          assert.deepEqual(bondDerived.parameters.gainedPCs,operation.parameters.gainedPCs);
          await close();await open();
          assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id),bondDerived);
        }
        for(const [table,event] of [['profile','UPDATE OF data'],['stage_delivery','UPDATE'],['gift_pc_floor','INSERT'],
          ['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
          app.store.db.exec(`CREATE TRIGGER fail_saved_constructor BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'saved constructor rollback'); END`);
          await rejected(push(full,operation),503,undefined,false);app.store.db.exec('DROP TRIGGER fail_saved_constructor');
        }
        const ack=parse(await push(full,operation));assert.deepEqual(ack.operations,[{id:operation.id}]);
        assert.deepEqual(app.store.operations(),[]);assert.deepEqual(app.store.read('UserPC').data.find(row=>row.pcId===rewardPcId),advanced);
        assert.deepEqual(app.store.read('UserPCJobSet').data.find(row=>row.pcId===rewardPcId),advancedBoards);
      }
    assert(selectedCount,'No fixture matched the requested filename filter');
    console.log(`Stage characters: ${selectedCount} fixtures (${process.argv[2] ?? 'full matrix'}); original fresh/preowned guests, permanent guest owner/EXP checkpoints, mixed initialization/CP/bond proof, split/expiry/cache/merge/rollback; native acceptance pending`);
  } catch(error) {
    // Report the failed assertion before cleanup, which can itself fail.
    console.error('Stage character failure:',path.basename(database ?? ''),error);throw error;
  } finally {
    await close(); const resolved=fs.realpathSync(directory);
    assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));
    assert(path.basename(resolved).startsWith('danmemore-stage-unit-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
