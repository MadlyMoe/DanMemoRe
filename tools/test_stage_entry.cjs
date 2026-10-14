'use strict';

// Disposable synthetic first entry/CP/flags/signatures.
// Not native lazy defaults, costume grants, earning, attribution or UI proof.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request,communicationWardrobeFixture}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-stage-entry-'));
  let app,database,port,sequence=0,rejection;
  const id=100000001,characterId=101000001,quest=1020010101101,story=1030010101101;
  const open=async()=>{
    app=createServer({database,seed,master,wallNowSeconds:()=>1790866800,log:line=>{
      const entry=JSON.parse(line);if(entry.event==='rejected') rejection=entry.reason;
    }});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async()=>{if(app){await app.close();app=null;}};
  const send=(action,body)=>{rejection=undefined;return request(port,++sequence,body,String(sequence),action);};
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected=async(pending,status,before=snapshot(),structured=true)=>{
    const reply=await pending;assert.equal(reply.status,status,`${path.basename(database)}: ${rejection ?? reply.body.toString()}`);
    assert.equal(md5(snapshot()),md5(before),'Rejected request must preserve every table row');
    if(status===503) structured ? assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE) : assert.equal(reply.body.length,0);
  };
  const push=(putItems={},deleteItems={})=>send('user_data/push',{
    badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:Object.fromEntries(
      [...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name] ?? [])]))},
    deltas:[{signature:0,trigger:'CommunicationCharacterJoin',putItems,deleteItems}],operations:[],
  });
  const communication=()=>app.store.read('UserCommunicationCharacter').data.find(row=>row.characterId===id);
  const joined=()=>({...communication(),userId:seed.userId,characterId:id,characterState:2,joinDateTime:1790866800,
    costumeId:1021001000,signature:0,touchCountBust:0,touchCountOther:0});
  const flags=ids=>ids.map(stageId=>({...app.store.read('UserAdventureStage').data.find(row=>row.adventureStageId===stageId) ??
    app.store.read('UserAdventureStage').data[0],adventureStageId:stageId,state:1,tasks:[],cumulativeClearCount:0,
    dailyClearCount:0,firstCompleteDateTime:0,lastCompleteDateTime:0,token:''}));
  const setup=(points,absent)=>{
    put('UserCommunicationCharacter',app.store.read('UserCommunicationCharacter').data.map(row=>row.characterId===id ?
      {...row,characterState:1,joinDateTime:0} : row));
    put('UserCharacter',app.store.read('UserCharacter').data.map(row=>row.characterId===characterId ?
      {...row,friendship:0,friendshipAis:0,friendshipLef:points} : row));
    put('UserAdventureStage',app.store.read('UserAdventureStage').data.filter(row=>!absent || ![quest,story].includes(row.adventureStageId))
      .map(row=>[quest,story].includes(row.adventureStageId) ? {...row,state:0} : row));
  };
  try {
    for(const points of [0,54])for(const absent of [false,true])for(const characterFirst of [true,false])for(const owner of [seed.userId,0]) {
      database=path.join(directory,`${points}-${absent}-${characterFirst}-owner-${owner}.sqlite`);await open();setup(points,absent);
      put('UserCharacter',app.store.read('UserCharacter').data.map(row=>row.characterId===characterId ? {...row,userId:owner} : row));
      const targets=points ? [quest,story] : [story],opened=flags(targets),current=joined(),wallet=app.store.hardCurrency(),
        pullBody={tables:['UserCommunicationCharacter','UserAdventureStage','UserCharacter']};
      assert.equal((await send('user_data/pull',pullBody)).status,200);const oldPull=sequence;
      const first=characterFirst ? {UserCommunicationCharacter:[current]} : {UserAdventureStage:opened};
      for(const userId of [owner===0 ? seed.userId : 0,2,'0',null])
        await rejected(push({UserCharacter:[{...app.store.read('UserCharacter').data.find(row=>row.characterId===characterId),userId}]}),400);
      for(const [table,event]of [['profile','UPDATE'],['stage_entry','INSERT'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_entry BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'entry observe'); END`);
        await rejected(push(first),503,snapshot(),false);app.store.db.exec('DROP TRIGGER fail_entry');
      }
      const response=parse(await push(first)),receipt=app.store.db.prepare('SELECT * FROM stage_entry WHERE character_id=?').get(id),
        capture=JSON.parse(receipt.capture_json);
      assert.deepEqual(capture.effects,targets.map(stageId=>({stageId,kind:'open'})));
      assert.deepEqual(capture.character.before,[0,0,points]);
      assert.equal(receipt.complete,0);assert.equal(receipt.state_saved,Number(characterFirst));
      assert.deepEqual(response.operations,[]);assert.equal(app.store.hardCurrency(),wallet);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_queue').get().n,0,'No invented first-entry packet');
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_unlock_floor').get().n,0,'Partial entry must not precredit a floor');
      app.store.db.exec("CREATE TRIGGER no_unchanged_entry BEFORE UPDATE ON stage_entry BEGIN SELECT RAISE(ABORT,'unchanged entry'); END");
      parse(await push(first));app.store.db.exec('DROP TRIGGER no_unchanged_entry');
      for(const raw of [null,'bad-json','{}',JSON.stringify({...capture,graphHash:'wrong'}),
        JSON.stringify({...capture,inputs:[]}),JSON.stringify({...capture,character:{...capture.character,levelsHash:'wrong'}}),
        JSON.stringify({...capture,effects:[null]})]) {
        // NULL violates the schema itself; use JSON null for the missing capture check.
        app.store.db.prepare('UPDATE stage_entry SET capture_json=? WHERE character_id=?').run(raw ?? 'null',id);
        await rejected(send('user_data/confirm',undefined),503);
        app.store.db.prepare('UPDATE stage_entry SET capture_json=? WHERE character_id=?').run(receipt.capture_json,id);
      }
      const before=JSON.parse(receipt.before_json);
      for(const raw of ['bad-json','{}',JSON.stringify({...before,signature:-1}),JSON.stringify({...before,costumeId:1021002000})]) {
        app.store.db.prepare('UPDATE stage_entry SET before_json=? WHERE character_id=?').run(raw,id);
        await rejected(send('user_data/confirm',undefined),503);
        app.store.db.prepare('UPDATE stage_entry SET before_json=? WHERE character_id=?').run(receipt.before_json,id);
      }
      await close();await open();
      for(const [action,body]of [['user/login',undefined],['user_data/confirm',undefined],['user_data/pull',pullBody]])
        await rejected(send(action,body),503);
      await rejected(request(port,oldPull,pullBody,String(oldPull),'user_data/pull'),503);
      if(characterFirst) {
        await rejected(push({UserCommunicationCharacter:[{...current,characterState:1}]}),400);
        await rejected(push({UserCommunicationCharacter:[{...current,joinDateTime:current.joinDateTime+1}]}),400);
        await rejected(push({}, {UserCommunicationCharacter:[{characterId:id}]}),400);
      }else {
        await rejected(push({UserAdventureStage:[{...opened[0],state:0}]}),400);
        await rejected(push({}, {UserAdventureStage:[{adventureStageId:targets[0]}]}),400);
      }
      const second={...(characterFirst ? {UserAdventureStage:opened} : {UserCommunicationCharacter:[current]}),
        ...communicationWardrobeFixture(app.store,id).putItems};
      for(const [table,event]of [['stage_entry','UPDATE'],['stage_unlock_floor','INSERT'],['costume_unlock_floor','INSERT'],['reply_cache','INSERT'],
        ...(points ? [['stage_friendship_floor','INSERT']] : [])]) {
        app.store.db.exec(`CREATE TRIGGER fail_finish BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'entry finish'); END`);
        await rejected(push(second),503,snapshot(),false);app.store.db.exec('DROP TRIGGER fail_finish');
      }
      parse(await push(second));await close();await open();
      assert.equal(app.store.read('UserCharacter').data.find(row=>row.characterId===characterId).userId,owner);
      assert.equal(app.store.db.prepare('SELECT complete FROM stage_entry WHERE character_id=?').get(id).complete,1);
      for(const stageId of targets) {
        const floor=app.store.db.prepare('SELECT * FROM stage_unlock_floor WHERE stage_id=?').get(stageId);
        assert.equal(floor.operation_id,0,'Zero marks a LOCAL source, not an acknowledged operation');assert.equal(floor.entry_character_id,id);
      }
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM operation_done').get().n,0);
      const checkpoint=app.store.db.prepare('SELECT * FROM stage_unlock_floor WHERE stage_id=?').get(targets[0]);
      app.store.db.prepare('DELETE FROM stage_unlock_floor WHERE stage_id=?').run(targets[0]);
      await rejected(send('user_data/confirm',undefined),503);
      app.store.db.prepare('INSERT INTO stage_unlock_floor(stage_id,operation_id,entry_character_id) VALUES(?,?,?)')
        .run(checkpoint.stage_id,checkpoint.operation_id,checkpoint.entry_character_id);
      app.store.db.prepare('UPDATE stage_unlock_floor SET entry_character_id=? WHERE stage_id=?').run(100000002,targets[0]);
      await rejected(send('user/login',undefined),503);
      app.store.db.prepare('UPDATE stage_unlock_floor SET entry_character_id=? WHERE stage_id=?').run(id,targets[0]);
      await rejected(push({UserAdventureStage:[{...opened[0],state:0}]}),400);
      await rejected(push({}, {UserAdventureStage:[{adventureStageId:targets[0]}]}),400);
      if(points)await rejected(push({UserCharacter:app.store.read('UserCharacter').data.map(row=>row.characterId===characterId ?
        {...row,friendshipLef:0} : row)}),400);
      await rejected(request(port,oldPull,pullBody,String(oldPull),'user_data/pull'),503);
      assert.equal((await send('user_data/pull',pullBody)).status,200);
      const actual=app.store.db.prepare('SELECT * FROM stage_entry WHERE character_id=?').get(id);
      parse(await push({UserCommunicationCharacter:[{...current,touchCountOther:1}]}));
      assert.deepEqual(app.store.db.prepare('SELECT * FROM stage_entry WHERE character_id=?').get(id),actual,'Unrelated home activity cannot replay entry');
      assert.equal(app.store.hardCurrency(),wallet);await close();
    }
    for(const characterFirst of [true,false])for(const cpOrder of ['absent','before','between','after']) {
      database=path.join(directory,`lazy-${characterFirst}-${cpOrder}.sqlite`);await open();setup(0,true);
      put('UserCharacter',app.store.read('UserCharacter').data.filter(row=>row.characterId!==characterId));
      put('UserCommunicationCharacter',[]);
      const current={...joined(),userId:0,signature:0xffffffff},opened=flags([story]),
        lazy={...seed.data.UserCharacter.find(row=>row.characterId===characterId),userId:0,characterState:1,
          friendship:0,friendshipAis:0,friendshipLef:0,signature:0}; // Explicit synthetic native-default CP row.
      if(cpOrder==='before')parse(await push({UserCharacter:[lazy]}));
      parse(await push(characterFirst ? {UserCommunicationCharacter:[current]} : {UserAdventureStage:opened}));
      const capture=JSON.parse(app.store.db.prepare('SELECT capture_json FROM stage_entry WHERE character_id=?').get(id).capture_json);
      assert.equal(capture.character.present,cpOrder==='before');assert.deepEqual(capture.character.before,[0,0,0]);
      assert.deepEqual(capture.effects,[{stageId:story,kind:'open'}]);
      if(cpOrder!=='before')await rejected(push({UserCharacter:[{...lazy,friendship:54}]}),400);
      await rejected(push({UserCharacter:[{...lazy,userId:2}]}),400);
      if(cpOrder==='between')parse(await push({UserCharacter:[lazy]}));
      parse(await push({...(characterFirst ? {UserAdventureStage:opened} : {UserCommunicationCharacter:[current]}),
        ...communicationWardrobeFixture(app.store,id).putItems}));
      assert.equal(communication().userId,0,'Keep the actual native lazy owner/signature');
      assert.equal(app.store.db.prepare('SELECT joined_owner FROM stage_entry WHERE character_id=?').get(id).joined_owner,0);
      if(cpOrder==='after')parse(await push({UserCharacter:[lazy]}));
      await close();await open();
      const saved=app.store.read('UserCharacter').data.find(row=>row.characterId===characterId);
      if(cpOrder==='absent')assert.equal(saved,undefined,'Do not precreate a CP row');
      else {
        assert.deepEqual(saved,lazy,'Checkpoint the supplied lazy row without changing its owner or signature');
        await rejected(push({UserCharacter:[{...lazy,userId:seed.userId}]}),400);
        parse(await push({UserCharacter:[lazy]}));
      }
      assert.equal(app.store.db.prepare('SELECT complete FROM stage_entry WHERE character_id=?').get(id).complete,1);
      await close();
    }
    database=path.join(directory,'missing-earned-cp.sqlite');await open();setup(54,true);
    put('UserCharacter',app.store.read('UserCharacter').data.filter(row=>row.characterId!==characterId));
    app.store.db.prepare('INSERT INTO stage_friendship_floor(character_id,user_hero_type,friendship) VALUES(?,2,54)').run(characterId);
    await rejected(push({UserCommunicationCharacter:[joined()]}),503);await close();
    database=path.join(directory,'bad-native-owner.sqlite');await open();setup(54,false);
    for(const changes of [{userId:2},{joinDateTime:0},{costumeId:1021002000}])
      await rejected(push({UserCommunicationCharacter:[{...joined(),...changes}]}),400);
    const existing=app.store.read('UserCharacter').data.find(row=>row.characterId===characterId);
    for(const characterId of [0,-1,'101000001',null,undefined])
      await rejected(push({UserCharacter:[{...existing,characterId}]}),400);
    await rejected(push({UserCharacter:[existing,{...existing}]}),400);
    await rejected(push({}, {UserCharacter:[{characterId:'101000001'}]}),400);
    const all=app.store.read('UserCharacter').data;
    for(const userId of [2,'0',null]) {
      put('UserCharacter',all.map(row=>row.characterId===characterId ? {...row,userId} : row));
      await rejected(push({}, {UserCharacter:[{characterId}]}),400);
      put('UserCharacter',all);
    }
    put('UserCharacter',[...all,{...existing}]);
    await rejected(push({}, {UserCharacter:[{characterId}]}),400);put('UserCharacter',all);
    parse(await push({UserCharacter:[{...existing,id:77}]}));
    assert.deepEqual(app.store.read('UserCharacter').data.map(({id,...row})=>row),all,
      'An unrelated id field cannot replace the original native characterId key');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM stage_entry').get().n,0);
    console.log('Local character first-entry graph, split saves and source-bound checkpoints: synthetic checks OK; native acceptance pending');
  }finally{await close();fs.rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
