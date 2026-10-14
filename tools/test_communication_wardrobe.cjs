'use strict';

// Disposable synthetic native-shaped entry/CP/wardrobe
// saves, NOT original signed initialization, earning, save-order or UI proof.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request,communicationWardrobeFixture}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const now=1790866800,md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-communication-wardrobe-'));
  let app,port,database,sequence=0,rejection;
  const open=async()=>{
    app=createServer({database,seed,master,wallNowSeconds:()=>now,log:line=>{
      const entry=JSON.parse(line);if(entry.event==='rejected') rejection=entry.reason;
    }});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async()=>{if(app){await app.close();app=null;}};
  const fresh=async name=>{await close();database=path.join(directory,`${name}.sqlite`);console.log('Communication wardrobe fixture:',name);await open();};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const send=(action,body)=>{rejection=undefined;return request(port,++sequence,body,String(sequence),action);};
  const parse=reply=>{assert.equal(reply.status,200,`${path.basename(database)}: ${rejection ?? reply.body.toString()}`);return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const push=(putItems={},deleteItems={})=>send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name] ?? [])]))},
    deltas:[{signature:0,trigger:'CommunicationEntry',putItems,deleteItems}],operations:[]});
  const reject=async(pending,status,before=snapshot(),structured=true)=>{
    const reply=await pending;assert.equal(reply.status,status,`${path.basename(database)}: ${rejection ?? reply.body.toString()}`);
    assert.equal(md5(snapshot()),md5(before),'Rejected request must preserve every table row');
    if(status===503) structured ? assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE) : assert.equal(reply.body.length,0);
  };
  const entry=id=>app.store.db.prepare('SELECT * FROM stage_entry WHERE character_id=?').get(id);
  const setup=(id,points=[0,0,0],absent=false)=>{
    const original=master.communicationCharacters[id],base={userId:0,characterId:id,signature:0xffffffff,costumeId:0,
      characterState:1,joinDateTime:0,touchCountBust:0,touchCountOther:0};
    // Retain the listener's fixed Hestia home bootstrap across reopen.
    put('UserCommunicationCharacter',[...app.store.read('UserCommunicationCharacter').data.filter(row=>row.characterId===100000005 && row.characterId!==id),base]);
    put('UserCharacterCostume',app.store.read('UserCharacterCostume').data.filter(row=>row.costumeId===1022027000));put('UserCommunicationVoice',[]);
    put('UserCharacter',absent ? [] : [{...seed.data.UserCharacter[0],userId:0,characterId:original.characterId,
      friendship:points[0],friendshipAis:points[1],friendshipLef:points[2],signature:0xffffffff}]);
    const level=Math.max(...points.map(points=>master.characters[original.characterId].levels.findLast(([,at])=>at<=points)[0])),
      firstStages=Object.entries(master.stageProgression).filter(([,row])=>{
        const episode=master.episodeProgression[row.episodeId],adventure=master.adventureProgression[episode.adventureId];
        return [2,3].includes(adventure.type) && adventure.label===original.key && episode.index===1 && row.level===1 && row.index===1;
      }).map(([id])=>Number(id));
    put('UserAdventureStage',[]);
    const wardrobe=communicationWardrobeFixture(app.store,id),stages=firstStages.filter(id=>level>=master.stageUnlocks[id].value).map(adventureStageId=>({
      ...seed.data.UserAdventureStage[0],adventureStageId,state:1,token:'',tasks:[],cumulativeClearCount:0,dailyClearCount:0,
      firstCompleteDateTime:0,lastCompleteDateTime:0}));
    return {base,wardrobe,stages,parts:{communication:{UserCommunicationCharacter:[{...base,characterState:2,joinDateTime:now,costumeId:wardrobe.costumeId}]},
      flags:{UserAdventureStage:stages},costumes:{UserCharacterCostume:wardrobe.putItems.UserCharacterCostume},
      voices:{UserCommunicationVoice:wardrobe.putItems.UserCommunicationVoice}}};
  };
  const permutations=values=>values.length ? values.flatMap((value,i)=>permutations(values.filter((_,j)=>i!==j)).map(rest=>[value,...rest])) : [[]];
  try {
    // Native Outfits/Voice menus consume NEW2 into seen3. Protect the actual
    // saved state, both at first-entry completion and on a later menu save.
    for(const coalesced of [false,true]) {
      await fresh(`seen-wardrobe-${coalesced}`);const id=100000001,{parts}=setup(id),
        seen={UserCharacterCostume:parts.costumes.UserCharacterCostume.map(row=>({...row,costumeState:3})),
          UserCommunicationVoice:parts.voices.UserCommunicationVoice.map(row=>({...row,voiceState:3}))};
      if(!coalesced) parse(await push({...parts.communication,...parts.flags,...parts.costumes,...parts.voices}));
      const receipt=entry(id);
      if(!coalesced) {
        app.store.db.exec("CREATE TRIGGER fail_seen_floor BEFORE INSERT ON costume_unlock_floor BEGIN SELECT RAISE(ABORT,'seen floor rollback'); END");
        await reject(push(seen),503,snapshot(),false);app.store.db.exec('DROP TRIGGER fail_seen_floor');
      }
      parse(await push(coalesced ? {...parts.communication,...parts.flags,...seen} : seen));
      if(receipt) assert.deepEqual(entry(id),receipt,'Marking menus seen must not replay the completed entry');
      await close();await open();parse(await send('user_data/confirm',undefined));
      for(const [table,idField,stateField] of [['UserCharacterCostume','costumeId','costumeState'],['UserCommunicationVoice','voiceId','voiceState']])
        for(const row of seen[table]) {
          assert.equal(app.store.db.prepare('SELECT state FROM costume_unlock_floor WHERE table_name=? AND id=?').get(table,row[idField]).state,3,
            'Persist the actual seen state, not just the captured NEW unlock');
          // Older builds could leave NEW2 history beside actual seen3 data.
          // Guard the saved native baseline without inventing a migration.
          app.store.db.prepare('UPDATE costume_unlock_floor SET state=2 WHERE table_name=? AND id=?').run(table,row[idField]);
          await reject(push({[table]:[{...row,[stateField]:2}]}),400);
          await reject(push({}, {[table]:[{[idField]:row[idField]}]}),400);
          parse(await push({[table]:[row]}));
          assert.equal(app.store.db.prepare('SELECT state FROM costume_unlock_floor WHERE table_name=? AND id=?').get(table,row[idField]).state,3);
        }
      assert.deepEqual(app.store.operations(),[]);assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    }
    // Cover every communication identity, including original catalogs
    // with no eligible zero-CP voices. Do not invent replacement voice pools.
    for(const id of Object.keys(master.communicationCharacters).map(Number)) {
      await fresh(`catalog-${id}`);const {parts,wardrobe,base}=setup(id),wallet=app.store.hardCurrency();
      parse(await push(parts.communication));
      const capture=JSON.parse(entry(id).capture_json);
      if([100000027,100000028].includes(id)) {
        //246b840 skips original parents without a first normal node.
        // Joining and the initial outfit still need their actual native saves.
        assert.equal(parts.flags.UserAdventureStage.length,0);
        assert.deepEqual(capture.inputs,[]);assert.deepEqual(capture.effects,[]);
      }
      assert.deepEqual(JSON.parse(entry(id).before_json),base,'Preserve original unselected costume0/state1 lazy row');
      assert.equal(capture.wardrobe.costumeId,wardrobe.costumeId);
      assert.deepEqual(capture.wardrobe.targets.map(row=>row.costumeId),wardrobe.putItems.UserCharacterCostume.map(row=>row.costumeId));
      assert.deepEqual(capture.wardrobe.refreshVoices.map(row=>row.voiceId),wardrobe.putItems.UserCommunicationVoice.map(row=>row.voiceId));
      assert(capture.wardrobe.refreshVoices.every(row=>master.communicationVoices[row.voiceId].kind!==1),'Native repository excludes Reaction Voice');
      if(id===100000002) assert.deepEqual(capture.wardrobe.refreshVoices.map(row=>row.voiceId),[140000027,140000443,140000859],
        'Zero-CP Ais entry saves exactly the three native Daily Talk voices');
      assert.equal(entry(id).complete,0);assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM costume_unlock_floor').get().n,0);
      parse(await push({...parts.flags,...parts.costumes,...parts.voices}));await close();await open();
      assert.equal(entry(id).complete,1);assert.deepEqual(app.store.operations(),[]);assert.equal(app.store.hardCurrency(),wallet);
      if([100000027,100000028].includes(id)) {
        assert.deepEqual(app.store.read('UserAdventureStage').data,[]);
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_unlock_floor').get().n,0,'No invented quest unlocks');
      }
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_done').get().n,0,'No fake local operation/ACK');
      parse(await send('user_data/confirm',undefined));
      for(const row of wardrobe.putItems.UserCharacterCostume) {
        assert.equal(app.store.db.prepare("SELECT state FROM costume_unlock_floor WHERE table_name='UserCharacterCostume' AND id=?").get(row.costumeId).state,2);
        await reject(push({}, {UserCharacterCostume:[{costumeId:row.costumeId}]}),400);
      }
    }
    const bell=100000001,bellLevels=master.characters[101000001].levels,last=bellLevels.at(-1)[1];
    for(const order of permutations(['communication','flags','costumes','voices'])) {
      await fresh(`order-${order.join('-')}`);const {parts,wardrobe}=setup(bell);
      assert.equal(wardrobe.costumeId,1021001000,'Priority1 Initial Equip beats priority0 Basic Equip');
      assert.deepEqual(wardrobe.putItems.UserCharacterCostume.map(row=>row.costumeId),[1021001000,1021001002]);
      for(const part of order) {
        parse(await push(parts[part]));await close();await open();
        if(entry(bell) && !entry(bell).complete) await reject(send('user_data/confirm',undefined),503);
      }
      assert.equal(entry(bell).complete,1);parse(await send('user_data/confirm',undefined));
      const firstVoice=wardrobe.putItems.UserCommunicationVoice[0];
      await reject(push({UserCommunicationVoice:[{...firstVoice,voiceState:1}]}),400);
      await reject(push({}, {UserCommunicationVoice:[{voiceId:firstVoice.voiceId}]}),400);
      // A later costume selection may change the default without losing the
      // initial unlocks. Entry must NOT replay or pin the default forever.
      const saved=app.store.read('UserCommunicationCharacter').data[0],receipt=entry(bell);
      parse(await push({UserCommunicationCharacter:[{...saved,costumeId:1021001002}]}));assert.deepEqual(entry(bell),receipt);
    }
    // Native menu init consumes NEW2 into seen3 before a save. Retain the
    // same first-entry graph, exact native join time/owner/default and effects.
    for(const coalesced of [false,true]) for(const communicationFirst of [false,true]) {
      await fresh(`seen-${coalesced}-${communicationFirst}`);const {parts}=setup(bell),wallet=app.store.hardCurrency(),
        joined=parts.communication.UserCommunicationCharacter[0],seen={...joined,characterState:3};
      if(!communicationFirst) parse(await push({...parts.flags,...parts.costumes,...parts.voices}));
      parse(await push({UserCommunicationCharacter:[coalesced ? seen : joined]}));
      const receipt=entry(bell);
      assert(receipt,'A coalesced state3 save must create the actual first-entry receipt');
      assert.equal(receipt.joined_at,joined.joinDateTime);assert.equal(receipt.joined_owner,joined.userId);
      assert.equal(receipt.complete,communicationFirst ? 0 : 1);
      if(!coalesced) parse(await push({UserCommunicationCharacter:[seen]}));
      await close();await open();
      assert.equal(app.store.read('UserCommunicationCharacter').data.find(row=>row.characterId===bell).characterState,3);
      if(communicationFirst) {
        await reject(send('user_data/confirm',undefined),503);
        for(const invalid of [{...seen,characterState:4},{...seen,costumeId:0},
          {...seen,joinDateTime:joined.joinDateTime+1},{...seen,userId:1000000001}])
          await reject(push({UserCommunicationCharacter:[invalid]}),400);
        await reject(push({}, {UserCommunicationCharacter:[{characterId:bell}]}),400);
        const before=snapshot();
        app.store.db.exec("CREATE TRIGGER fail_seen BEFORE INSERT ON costume_unlock_floor BEGIN SELECT RAISE(ABORT,'seen rollback'); END");
        await reject(push({...parts.flags,...parts.costumes,...parts.voices}),503,snapshot(),false);
        app.store.db.exec('DROP TRIGGER fail_seen');assert.equal(md5(snapshot()),md5(before));
        parse(await push({...parts.flags,...parts.costumes,...parts.voices}));
      }
      assert.equal(entry(bell).complete,1);assert.equal(app.store.hardCurrency(),wallet);
      assert.deepEqual(app.store.operations(),[]);assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_done').get().n,0);
      await close();await open();parse(await send('user_data/confirm',undefined));
    }
    for(const points of [[last,0,0],[0,last,0],[0,0,last],[bellLevels[3][1],bellLevels[6][1],bellLevels[9][1]]]) {
      await fresh(`cp-${points.join('-')}`);const {parts,wardrobe}=setup(bell,points);
      parse(await push({...parts.communication,...parts.flags}));
      const captured=JSON.parse(entry(bell).capture_json).wardrobe,
        expected=wardrobe.putItems.UserCommunicationVoice.map(row=>row.voiceId);
      assert.deepEqual(captured.refreshVoices.map(row=>row.voiceId),expected);
      for(const hero of [0,1,2]) {
        const level=bellLevels.findLast(([,threshold])=>threshold<=points[hero])[0];
        assert(captured.refreshVoices.filter(row=>master.communicationVoices[row.voiceId].kind!==2 &&
          master.communicationVoices[row.voiceId].userHeroType===hero).every(row=>master.communicationVoices[row.voiceId].friendshipLevel<=level));
        if(!points[hero]) assert(!captured.refreshVoices.some(row=>master.communicationVoices[row.voiceId].userHeroType===hero &&
          master.communicationVoices[row.voiceId].friendshipLevel>1),'Do not unlock one hero using another hero MAX');
      }
      await reject(push({UserCommunicationCharacter:[{...parts.communication.UserCommunicationCharacter[0],costumeId:1021001002}]}),400);
      parse(await push({...parts.costumes,...parts.voices}));assert.equal(entry(bell).complete,1);
    }
    for(const ownedState of [2,3]) for(const costumeId of [...new Set(Object.values(master.communicationVoices).filter(row=>row.kind===2).map(row=>row.costumeId))]) {
      await fresh(`global-${costumeId}-${ownedState}`);const initialized=setup(bell);
      put('UserCharacterCostume',[{userId:0,costumeId,costumeState:ownedState}]);
      const linked=Object.entries(master.communicationVoices).filter(([,row])=>row.costumeId===costumeId).map(([id])=>Number(id));
      put('UserCommunicationVoice',[{userId:0,voiceId:linked[0],voiceState:3}]);
      const wardrobe=communicationWardrobeFixture(app.store,bell);
      parse(await push({...initialized.parts.communication,...initialized.parts.flags}));
      const targets=JSON.parse(entry(bell).capture_json).wardrobe.refreshVoices;
      assert(linked.every(id=>targets.some(row=>row.voiceId===id)),'Kind2 refresh includes OTHER communication-key costumes');
      assert.equal(targets.find(row=>row.voiceId===linked[0]).state,3);
      await reject(push({UserCommunicationVoice:[{userId:0,voiceId:linked[0],voiceState:2}]}),400);
      parse(await push(wardrobe.putItems));await close();await open();assert.equal(entry(bell).complete,1);
      await reject(push({}, {UserCommunicationVoice:[{voiceId:linked[0]}]}),400);
      assert.equal(app.store.db.prepare("SELECT state FROM costume_unlock_floor WHERE table_name='UserCharacterCostume' AND id=?").get(costumeId).state,ownedState);
      await reject(push({UserCharacterCostume:[{userId:0,costumeId,costumeState:ownedState-1}]}),400);
      await reject(push({}, {UserCharacterCostume:[{costumeId}]}),400);
    }
    await fresh('capture-corruption');const {parts,wardrobe}=setup(bell,[0,0,0],true);
    parse(await push({...parts.communication,...parts.flags}));const receipt=entry(bell),capture=JSON.parse(receipt.capture_json);
    for(const corrupt of [{...capture,wardrobe:undefined},{...capture,wardrobe:{...capture.wardrobe,catalogHash:'wrong'}},
      {...capture,wardrobe:{...capture.wardrobe,costumeId:1021001002}},
      {...capture,wardrobe:{...capture.wardrobe,refreshVoices:[]}},
      {...capture,wardrobe:{...capture.wardrobe,refreshCostumes:[]}}]) {
      app.store.db.prepare('UPDATE stage_entry SET capture_json=? WHERE character_id=?').run(JSON.stringify(corrupt),bell);
      await reject(send('user_data/confirm',undefined),503);await reject(push(wardrobe.putItems),503);
      app.store.db.prepare('UPDATE stage_entry SET capture_json=? WHERE character_id=?').run(receipt.capture_json,bell);
    }
    for(const [table,event] of [['profile','UPDATE'],['stage_entry','UPDATE'],['stage_unlock_floor','INSERT'],['costume_unlock_floor','INSERT'],['reply_cache','INSERT']]) {
      app.store.db.exec(`CREATE TRIGGER fail_entry_wardrobe BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'entry wardrobe rollback'); END`);
      await reject(push(wardrobe.putItems),503,snapshot(),false);app.store.db.exec('DROP TRIGGER fail_entry_wardrobe');
    }
    parse(await push(wardrobe.putItems));await close();await open();
    assert.equal(app.store.read('UserCharacter').data.length,0,'Do NOT initialize absent native CP while granting its level1 voices');
    const floor=app.store.db.prepare("SELECT * FROM costume_unlock_floor WHERE table_name='UserCommunicationVoice' LIMIT 1").get();
    app.store.db.prepare('DELETE FROM costume_unlock_floor WHERE table_name=? AND id=?').run(floor.table_name,floor.id);
    await reject(send('user_data/confirm',undefined),503);
    app.store.db.prepare('INSERT INTO costume_unlock_floor(table_name,id,state) VALUES(?,?,?)').run(floor.table_name,floor.id,floor.state);
    parse(await send('user_data/confirm',undefined));
    const ais=100000002;
    for(const mode of ['saved','partial','bad-graph','missing-daily','lost-saved']) {
      await fresh(`legacy-reactions-${mode}`);const {parts}=setup(ais);
      const actualVoices=parts.voices.UserCommunicationVoice;
      parse(await push({...parts.communication,...parts.flags,...parts.costumes,
        UserCommunicationVoice:mode==='partial' ? actualVoices.slice(1) : actualVoices}));
      const original=entry(ais),legacy=JSON.parse(original.capture_json),daily=new Map(legacy.wardrobe.refreshVoices.map(row=>[row.voiceId,row]));
      legacy.wardrobe.refreshVoices=Object.entries(master.communicationVoices).filter(([,row])=>row.communicationCharacterKey==='comm_character.ais1' &&
        row.kind!==2 && row.friendshipLevel<=1).map(([id])=>daily.get(Number(id)) ?? {voiceId:Number(id),beforeState:1,state:2});
      assert.equal(legacy.wardrobe.refreshVoices.length,21);
      if(mode==='bad-graph') legacy.graphHash='wrong';
      if(mode==='missing-daily') legacy.wardrobe.refreshVoices=legacy.wardrobe.refreshVoices.filter(row=>row.voiceId!==140000027);
      app.store.db.prepare('UPDATE stage_entry SET capture_json=?,complete=0 WHERE character_id=?').run(JSON.stringify(legacy),ais);
      app.store.db.exec('DELETE FROM costume_unlock_floor; DELETE FROM stage_unlock_floor');
      if(mode==='lost-saved') put('UserCommunicationVoice',actualVoices.slice(1));
      const old=entry(ais),profiles=app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),wallet=app.store.hardCurrency(),
        queue=app.store.operations(),done=app.store.db.prepare('SELECT * FROM operation_done').all();
      await close();await open();
      assert.deepEqual(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),profiles,'Recovery must not forge native profile bytes/tokens');
      assert.equal(app.store.hardCurrency(),wallet);assert.deepEqual(app.store.operations(),queue);
      assert.deepEqual(app.store.db.prepare('SELECT * FROM operation_done').all(),done,'No invented operation ACK');
      if(['bad-graph','missing-daily','lost-saved'].includes(mode)) {
        assert.deepEqual(entry(ais),old,'Unverifiable old captures remain blocked and unchanged');
        await reject(send('user_data/confirm',undefined),503);continue;
      }
      const backup=app.store.db.prepare('SELECT receipt_json FROM legacy_entry_voice_backup WHERE character_id=?').get(ais);
      assert.deepEqual(JSON.parse(backup.receipt_json),{...old},'Original receipt is retained for recovery');
      assert.deepEqual(JSON.parse(entry(ais).capture_json).wardrobe.refreshVoices.map(row=>row.voiceId),[140000027,140000443,140000859]);
      assert.equal(entry(ais).complete,Number(mode==='saved'));
      if(mode==='partial') {
        await reject(send('user_data/confirm',undefined),503);
        assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM costume_unlock_floor').get().n,0,'Missing actual Daily Talk still blocks completion');
        parse(await push({UserCommunicationVoice:[actualVoices[0]]}));assert.equal(entry(ais).complete,1);
      }
      parse(await send('user_data/confirm',undefined));
      assert.equal(app.store.db.prepare("SELECT COUNT(*) n FROM costume_unlock_floor WHERE table_name='UserCommunicationVoice'").get().n,3);
      const settled=snapshot();await close();await open();assert.equal(snapshot(),settled,'Recovery is idempotent');
    }
    // DEFERRED repeated-acquisition checks: synthetic saves only. Do not run
    // until implementation is finished; no original native earning/clock proof.
    await fresh('repeat-after-first-entry');
    {
      const {parts}=setup(bell),wallet=app.store.hardCurrency();
      parse(await push({...parts.communication,...parts.flags,...parts.costumes,...parts.voices}));
      const first=entry(bell),floors=app.store.db.prepare('SELECT * FROM stage_unlock_floor ORDER BY stage_id').all(),
        joined=app.store.read('UserCommunicationCharacter').data.find(row=>row.characterId===bell),
        seen={...joined,characterState:3,costumeId:1021001002};
      parse(await push({UserCommunicationCharacter:[seen]}));
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_entry_refresh').get().n,0,'Menu/outfit selection is not a new acquisition');
      const character=app.store.read('UserCharacter').data[0];
      put('UserCharacter',[{...character,friendship:last}]); // Disposable original-threshold input, not native CP earning.
      const wardrobe=communicationWardrobeFixture(app.store,bell),reset={...seen,characterState:2,costumeId:wardrobe.costumeId,
        joinDateTime:now-100},refresh=()=>app.store.db.prepare('SELECT * FROM stage_entry_refresh WHERE character_id=?').get(bell);
      await reject(push({UserCommunicationCharacter:[{...reset,costumeId:1021001002}]}),400);
      parse(await push({UserCommunicationCharacter:[reset]}));
      assert.equal(refresh().complete,0);assert.equal(refresh().state_saved,1);
      assert.deepEqual(JSON.parse(refresh().before_json),seen);assert.deepEqual(entry(bell),first);
      assert.deepEqual(app.store.db.prepare('SELECT * FROM stage_unlock_floor ORDER BY stage_id').all(),floors);
      const capture=JSON.parse(refresh().capture_json);
      assert(capture.wardrobe.refreshVoices.some(row=>row.beforeState===1),'Capture newly eligible own-hero voices');
      assert(capture.wardrobe.refreshVoices.every(row=>master.communicationVoices[row.voiceId].kind!==1));
      await reject(send('user_data/confirm',undefined),503);await close();await open();
      await reject(send('user_data/confirm',undefined),503);
      for(const invalid of [{...reset,joinDateTime:now},{...reset,costumeId:1021001002},{...reset,userId:seed.userId}])
        await reject(push({UserCommunicationCharacter:[invalid]}),400);
      parse(await push({UserCommunicationCharacter:[{...reset,characterState:3}]}));
      assert.equal(refresh().complete,0,'Seen3 cannot waive unsaved voice effects');
      for(const [table,event] of [['profile','UPDATE'],['stage_entry_refresh','UPDATE'],['costume_unlock_floor','INSERT'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_repeat BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'repeat rollback'); END`);
        await reject(push(wardrobe.putItems),503,snapshot(),false);app.store.db.exec('DROP TRIGGER fail_repeat');
      }
      parse(await push(wardrobe.putItems));assert.equal(refresh().complete,1);
      assert.equal(app.store.hardCurrency(),wallet);assert.deepEqual(app.store.operations(),[]);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_done').get().n,0);
      assert.deepEqual(entry(bell),first);assert.deepEqual(app.store.db.prepare('SELECT * FROM stage_unlock_floor ORDER BY stage_id').all(),floors);
      const completed=refresh(),later={...reset,characterState:3,costumeId:1021001002};
      parse(await push({UserCommunicationCharacter:[later]}));assert.deepEqual(refresh(),completed,'Do not pin the default after completion');
      // Coalesced NEW2 -> seen3 at a later event-clock time replaces only the
      // latest repeat row. First-entry capture and old floor sources survive.
      parse(await push({UserCommunicationCharacter:[{...later,costumeId:wardrobe.costumeId,joinDateTime:now+100}]}));
      assert.equal(refresh().complete,1);assert.equal(refresh().joined_at,now+100);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_entry_refresh').get().n,1);
      assert.deepEqual(entry(bell),first);assert.deepEqual(app.store.db.prepare('SELECT * FROM stage_unlock_floor ORDER BY stage_id').all(),floors);
      const settled=refresh(),bad=JSON.parse(settled.capture_json);bad.wardrobe.catalogHash='wrong';
      app.store.db.prepare('UPDATE stage_entry_refresh SET capture_json=? WHERE character_id=?').run(JSON.stringify(bad),bell);
      await reject(send('user_data/confirm',undefined),503);await reject(push({UserCommunicationCharacter:[later]}),503);
      app.store.db.prepare('UPDATE stage_entry_refresh SET capture_json=? WHERE character_id=?').run(settled.capture_json,bell);
      await reject(push({}, {UserCommunicationCharacter:[{characterId:bell}]}),400);
      await close();await open();parse(await send('user_data/confirm',undefined));
    }
    await fresh('repeat-imported-joined-baseline');
    {
      const {base,stages}=setup(bell),wardrobe=communicationWardrobeFixture(app.store,bell),
        before={...base,characterState:3,costumeId:1021001002,joinDateTime:now},reset={...before,characterState:2,costumeId:wardrobe.costumeId};
      put('UserCommunicationCharacter',[...app.store.read('UserCommunicationCharacter').data.filter(row=>row.characterId!==bell),before]);
      // Same-second seen3 -> NEW2 remains observable even with unchanged time.
      for(const [table,event] of [['stage_entry_refresh','INSERT'],['stage_unlock_floor','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_repeat_source BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'repeat source rollback'); END`);
        await reject(push({UserCommunicationCharacter:[reset],UserAdventureStage:stages,...wardrobe.putItems}),503,snapshot(),false);
        app.store.db.exec('DROP TRIGGER fail_repeat_source');
      }
      parse(await push({UserCommunicationCharacter:[reset],UserAdventureStage:stages,...wardrobe.putItems}));
      assert.equal(entry(bell),undefined,'Do not fabricate a historical first-entry receipt for an imported joined row');
      const refresh=app.store.db.prepare('SELECT * FROM stage_entry_refresh WHERE character_id=?').get(bell);
      assert.equal(refresh.complete,1);assert.deepEqual(JSON.parse(refresh.before_json),before);
      const floors=app.store.db.prepare('SELECT * FROM stage_unlock_floor ORDER BY stage_id').all();
      assert(floors.length);assert(floors.every(row=>row.operation_id===0 && row.entry_character_id===null && row.entry_flag_id===null && row.refresh_json));
      const actual=app.store.read('UserCommunicationCharacter').data.find(row=>row.characterId===bell);
      parse(await push({UserCommunicationCharacter:[{...actual,characterState:3,joinDateTime:now+1}]}));
      assert.deepEqual(app.store.db.prepare('SELECT * FROM stage_unlock_floor ORDER BY stage_id').all(),floors,
        'Replacing the latest refresh must not erase the source of an older stage unlock');
      await reject(push({UserAdventureStage:[{...stages[0],state:0}]}),400);
      await reject(push({}, {UserAdventureStage:[{adventureStageId:stages[0].adventureStageId}]}),400);
      const floor=floors[0];app.store.db.prepare('UPDATE stage_unlock_floor SET refresh_json=? WHERE stage_id=?').run('{}',floor.stage_id);
      await reject(send('user_data/confirm',undefined),503);
      app.store.db.prepare('UPDATE stage_unlock_floor SET refresh_json=? WHERE stage_id=?').run(floor.refresh_json,floor.stage_id);
      assert.deepEqual(app.store.operations(),[]);assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_done').get().n,0);
      await close();await open();parse(await send('user_data/confirm',undefined));
    }
    console.log('Synthetic communication wardrobe/voice captures, repeated resets, split saves and floors: OK; native acceptance pending');
  } catch(error) {console.error('Communication wardrobe fixture failure:',path.basename(database??''),error);throw error;}
  finally {await close();fs.rmSync(directory,{recursive:true,force:true,maxRetries:4,retryDelay:100});}
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
