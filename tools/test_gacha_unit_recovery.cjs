'use strict';

// WRITTEN ONLY / NOT RUN: synthetic native-shaped initialization, not natural gameplay/UI proof.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer,encodeMsgpack,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request,drawAcknowledgement}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json');
const master=require('../data/danmemore-master.json');
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-gacha-unit-recovery-')),now=1483196460;
  let app,port,sequence=100,database;
  const open=async()=>{
    app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const close=async()=>{if(app){await app.close();app=null;}};
  const fresh=async name=>{await close();database=path.join(directory,`${name}.sqlite`);await open();};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const body=(putItems={},operations=[])=>({badges:null,scripts:{},dataTokens:{},
    checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(rows)]))},
    deltas:Object.keys(putItems).length?[{signature:0,trigger:'LotteryDraw',putItems,deleteItems:{}}]:[],
    operations:operations.map(operation=>({id:operation.id,verifier:operation.token}))});
  const push=(putItems={},operations=[])=>send('user_data/push',body(putItems,operations));
  const native=operation=>drawAcknowledgement({operation,parameters:operation.parameters},{},
    app.store.read('UserCharacter').data,app.store.read('UserCharacterCostume').data,
    app.store.read('UserCommunicationVoice').data,app.store.read('UserAdventureStage').data).deltas[0]?.putItems??{};
  const reject=async(pending,structured=true)=>{
    const before=snapshot(),reply=await pending;assert.equal(reply.status,503,reply.body.toString());
    if(structured) assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    else assert.equal(reply.body.length,0,'Injected SQLite failure is distinct from semantic recovery');
    assert.equal(snapshot(),before);
  };
  const invalid=async pending=>{const before=snapshot(),reply=await pending;assert.equal(reply.status,400);assert.equal(snapshot(),before);};
  const projection=operation=>{
    const before=snapshot(),queue=app.store.operations(),derived=app.store.lotteryRecovery(operation);
    assert.equal(snapshot(),before);assert.deepEqual(app.store.operations(),queue);
    assert.equal(derived.id,operation.id);assert.equal(derived.type,operation.type);
    assert.equal(derived.token,operation.token);assert.equal(derived.signature,operation.signature);
    assert.deepEqual(derived.parameters.lotteryPCs,operation.parameters.lotteryPCs);
    assert.deepEqual(app.store.lotteryRecovery(operation,derived),derived);
    return derived;
  };
  try {
    // A complete single-unit constructor can be omitted before its real ACK, including tutorial draws.
    for(const type of [1000,1001]) for(const pcId of [1011002001,1011001005]) {
      await fresh(`complete-${type}-${pcId}`);
      const {operation}=app.store.issueDraw([pcId],{},type),puts=native(operation),wallet=app.store.hardCurrency();
      assert.deepEqual(projection(operation),operation);
      // WRITTEN ONLY: packet identity before upload; actual local-receipt suppression still needs native acceptance.
      const liveConfirmation=await send('user_data/confirm'),liveIdentity=sequence;
      assert.deepEqual(parse(liveConfirmation).operations,[operation]);
      const beforeLiveRetry=snapshot();
      assert.deepEqual((await request(port,liveIdentity,undefined,String(liveIdentity),'user_data/confirm')).body,liveConfirmation.body);
      assert.equal(snapshot(),beforeLiveRetry);assert.deepEqual(app.store.operations(),[operation]);
      assert.equal(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id),undefined);
      assert.throws(()=>app.store.lotteryRecovery(operation,{...operation,parameters:{...operation.parameters,UserPC:[]}}),/unfinished unit/);
      parse(await push(puts));
      const progressed=app.store.read('UserPC').data.map(row=>row.pcId===pcId?{...row,totalExp:row.totalExp+1}:row);
      put('UserPC',progressed);
      put('UserPC',progressed.map(row=>row.pcId===pcId?{...row,userId:9}:row));
      await reject(send('user/login'));
      put('UserPC',progressed);
      const original=app.store.operations(),derived=projection(operation),profiles=snapshot();
      assert.deepEqual(derived.parameters.UserPC,[]);assert.equal(snapshot(),profiles);
      parse(await send('user/login'));
      assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id),derived);
      assert.deepEqual(app.store.operations(),original);assert.equal(app.store.hardCurrency(),wallet);
      assert.deepEqual(app.store.read('UserPC').data,progressed,'Recovered initialization cannot reset later saved unit progress');
      if(type===1001) {
        await invalid(push({},[operation]));
        // Original gacha_end flag remains client-owned; no server completion is inferred from the unit.
        parse(await push({UserTutorial:[{userId:seed.userId,tutorialId:780030005,isEnd:true}]}));
        assert.deepEqual(projection(operation),derived);
      }
      for(const [table,event] of [['operation_done','INSERT'],['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_pc_recovery BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'unit recovery ACK rollback'); END`);
        await reject(push({},[operation]),false);app.store.db.exec('DROP TRIGGER fail_pc_recovery');
      }
      const ack=body({},[operation]),response=await send('user_data/push',ack),identity=sequence;
      const acknowledged=parse(response);assert.deepEqual(acknowledged.operations,[{id:operation.id}]);
      assert.deepEqual(acknowledged.dones,acknowledged.operations);assert.deepEqual(app.store.operations(),[]);
      await close();await open();const retained=snapshot();
      assert.deepEqual((await request(port,identity,ack,String(identity),'user_data/push')).body,response.body);
      assert.equal(snapshot(),retained);
      assert.throws(()=>app.store.lotteryRecovery(operation),error=>error.status===503 && error.offlineUnavailable);
    }

    // One completed variant and one untouched variant can share the same state1-to2 character.
    await fresh('mixed-shared-character');
    const pcIds=[1011002001,1011002003],characterId=master.pcProfiles[pcIds[0]].characterId;
    assert.equal(master.pcProfiles[pcIds[1]].characterId,characterId);
    put('UserCharacter',seed.data.UserCharacter.map(row=>row.characterId===characterId?{...row,characterState:1}:row));
    const {operation}=app.store.issueDraw(pcIds),firstOnly={...operation,
      parameters:{...operation.parameters,UserPC:operation.parameters.UserPC.filter(row=>row.pcId===pcIds[0])}};
    parse(await push(native(firstOnly)));
    const derived=projection(operation);
    assert.deepEqual(derived.parameters.UserPC,operation.parameters.UserPC.filter(row=>row.pcId===pcIds[1]));
    assert(!app.store.read('UserPC').data.some(row=>row.pcId===pcIds[1]));
    for(const UserPC of [[],[...operation.parameters.UserPC].reverse(),[...derived.parameters.UserPC,...derived.parameters.UserPC],
      derived.parameters.UserPC.map(row=>({...row,totalExp:1}))])
      assert.throws(()=>app.store.lotteryRecovery(operation,{...derived,parameters:{...derived.parameters,UserPC}}),/unfinished unit|initializer/);
    await close();await open();parse(await send('user/login'));
    assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id),derived);
    await invalid(push({},[operation]));
    parse(await push(native(derived),[operation]));assert.deepEqual(app.store.operations(),[]);
    assert(pcIds.every(pcId=>app.store.read('UserPC').data.some(row=>row.pcId===pcId)));

    //Original conditional outfit/story unlocks can precede the absent unit, separately or coalesced with its character.
    for(const type of [1000,1001]) for(let mask=1;mask<8;mask++) {
      await fresh(`constructor-prefix-${type}-${mask}`);
      const characterId=master.pcProfiles[1011001005].characterId;
      put('UserCharacter',seed.data.UserCharacter.map(row=>row.characterId===characterId?{...row,characterState:1}:row));
      const {operation}=app.store.issueDraw([1011001005],{},type),puts=native(operation),
        names=['UserCharacter','UserCharacterCostume','UserAdventureStage'],
        prefix=Object.fromEntries(names.filter((name,index)=>mask&(1<<index)).map(name=>[name,puts[name]]));
      assert(names.every(name=>puts[name]?.length),'Original outfit/story fixture must exercise every named prefix');
      const wallet=app.store.hardCurrency(),queue=app.store.operations(),capture=app.store.db.prepare('SELECT * FROM lottery_draw_claim WHERE operation_id=?').get(operation.id);
      parse(await push(prefix));
      if(mask===7) {
        put('UserCharacterCostume',app.store.read('UserCharacterCostume').data.map(row=>
          row.costumeId===master.pcProfiles[1011001005].initialCostumeId?{...row,costumeState:3}:row));
        put('UserAdventureStage',app.store.read('UserAdventureStage').data.map(row=>
          puts.UserAdventureStage.some(stage=>stage.adventureStageId===row.adventureStageId)?{...row,state:3}:row));
      }
      const savedPrefix=Object.fromEntries(Object.keys(prefix).map(name=>[name,app.store.read(name)]));
      assert(!app.store.read('UserPC').data.some(row=>row.pcId===1011001005));
      assert(!app.store.read('UserPCJobSet').data.some(row=>row.pcId===1011001005));
      assert.deepEqual(projection(operation),operation,'No native initializer or result may be dropped for a pre-unit prefix');
      assert.throws(()=>app.store.lotteryRecovery(operation,{...operation,parameters:{...operation.parameters,UserPC:[]}}),/unfinished unit/);
      await close();await open();parse(await send('user/login'));
      assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id),operation);
      assert.deepEqual(app.store.operations(),queue);assert.equal(app.store.hardCurrency(),wallet);
      assert.deepEqual(app.store.db.prepare('SELECT * FROM lottery_draw_claim WHERE operation_id=?').get(operation.id),capture);
      for(const name of Object.keys(prefix)) assert.deepEqual(app.store.read(name),savedPrefix[name]);
      await invalid(push({},[operation]));
      for(const [table,event] of [['profile','UPDATE OF data'],['gift_pc_floor','INSERT'],['operation_done','INSERT'],
        ['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_constructor_prefix BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'constructor prefix rollback'); END`);
        await reject(push({...native(operation),...(type===1001?{UserTutorial:[{userId:seed.userId,tutorialId:780030005,isEnd:true}]}:{})},[operation]),false);
        app.store.db.exec('DROP TRIGGER fail_constructor_prefix');
      }
      const finish=native(operation);
      parse(await push({...finish,...(type===1001?{UserTutorial:[{userId:seed.userId,tutorialId:780030005,isEnd:true}]}:{})},[operation]));
      assert.deepEqual(app.store.operations(),[]);
      for(const name of Object.keys(prefix)) assert.deepEqual(app.store.read(name),savedPrefix[name]);
      assert.equal(app.store.hardCurrency(),wallet);
    }

    //Owned board sets are reused while the PC is absent, including a saved initialized normal board and other prefixes.
    for(const type of [1000,1001]) for(const initialized of [false,true]) for(let mask=0;mask<8;mask++) {
      await fresh(`board-prefix-${type}-${initialized}-${mask}`);
      const pcId=1011001005,characterId=master.pcProfiles[pcId].characterId;
      put('UserCharacter',seed.data.UserCharacter.map(row=>row.characterId===characterId?{...row,characterState:1}:row));
      const {operation}=app.store.issueDraw([pcId],{},type),puts=native(operation),
        board={userId:seed.userId,pcId,pcJobs:initialized?[{pcJobId:master.pcProfiles[pcId].jobIds[0],
          abilityPanelState:0x2000000,signature:0,abilityPanels:[]}]:[]},
        names=['UserCharacter','UserCharacterCostume','UserAdventureStage'],
        prefix={UserPCJobSet:[board],...Object.fromEntries(names.filter((name,index)=>mask&(1<<index)).map(name=>[name,puts[name]]))};
      parse(await push(prefix));
      const savedBoards=app.store.read('UserPCJobSet'),queue=app.store.operations(),wallet=app.store.hardCurrency(),
        receipt=app.store.db.prepare('SELECT * FROM lottery_draw_claim WHERE operation_id=?').get(operation.id);
      assert(!app.store.read('UserPC').data.some(row=>row.pcId===pcId));
      assert.deepEqual(projection(operation),operation,'Saved boards cannot substitute for the missing unit initializer');
      await close();await open();parse(await send('user/login'));
      assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id),operation);
      assert.deepEqual(app.store.read('UserPCJobSet'),savedBoards);assert.deepEqual(app.store.operations(),queue);
      assert.equal(app.store.hardCurrency(),wallet);
      assert.deepEqual(app.store.db.prepare('SELECT * FROM lottery_draw_claim WHERE operation_id=?').get(operation.id),receipt);
      assert.throws(()=>app.store.lotteryRecovery(operation,{...operation,parameters:{...operation.parameters,UserPC:[]}}),/unfinished unit/);
      await invalid(push({},[operation]));
      const finish={...native(operation),UserPCJobSet:savedBoards.data,
        ...(type===1001?{UserTutorial:[{userId:seed.userId,tutorialId:780030005,isEnd:true}]}:{})};
      for(const [table,event] of [['profile','UPDATE OF data'],['gift_pc_floor','INSERT'],['operation_done','INSERT'],
        ['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_board_prefix BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'board prefix rollback'); END`);
        await reject(push(finish,[operation]),false);app.store.db.exec('DROP TRIGGER fail_board_prefix');
      }
      parse(await push(finish,[operation]));assert.deepEqual(app.store.operations(),[]);
      assert.deepEqual(app.store.read('UserPCJobSet'),savedBoards,'Recovered constructor cannot replace its saved board bits or signature');
      assert.equal(app.store.hardCurrency(),wallet);
    }

    //Existing complete constructors still need their original UserPC entry until the character refresh saves.
    for(const type of [1000,1001]) for(const pcId of [1011002001,1011001005]) for(const absent of [false,true]) {
      await fresh(`character-last-${type}-${pcId}-${absent}`);
      const characterId=master.pcProfiles[pcId].characterId,beforeCharacters=seed.data.UserCharacter;
      put('UserCharacter',absent?beforeCharacters.filter(row=>row.characterId!==characterId):
        beforeCharacters.map(row=>row.characterId===characterId?{...row,characterState:1}:row));
      const {operation}=app.store.issueDraw([pcId],{},type),puts=native(operation),{UserCharacter,...constructor}=puts;
      assert(UserCharacter?.some(row=>row.characterId===characterId));parse(await push(constructor));
      const savedUnits=app.store.read('UserPC'),savedBoards=app.store.read('UserPCJobSet'),savedCharacter=app.store.read('UserCharacter'),
        queue=app.store.operations(),wallet=app.store.hardCurrency(),
        receipt=app.store.db.prepare('SELECT * FROM lottery_draw_claim WHERE operation_id=?').get(operation.id);
      assert.deepEqual(projection(operation),operation,'The existing unit entry is still required for its unfinished character refresh');
      assert.throws(()=>app.store.lotteryRecovery(operation,{...operation,parameters:{...operation.parameters,UserPC:[]}}),/unfinished unit/);
      await close();await open();parse(await send('user/login'));
      assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id),operation);
      assert.deepEqual(app.store.read('UserPC'),savedUnits);assert.deepEqual(app.store.read('UserPCJobSet'),savedBoards);
      assert.deepEqual(app.store.read('UserCharacter'),savedCharacter);assert.deepEqual(app.store.operations(),queue);
      assert.equal(app.store.hardCurrency(),wallet);
      assert.deepEqual(app.store.db.prepare('SELECT * FROM lottery_draw_claim WHERE operation_id=?').get(operation.id),receipt);
      await invalid(push({},[operation]));
      for(const [table,event] of [['profile','UPDATE OF data'],['gift_pc_floor','INSERT'],['operation_done','INSERT'],
        ['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_character_last BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'character-last rollback'); END`);
        await reject(push({UserCharacter,...(type===1001?{UserTutorial:[{userId:seed.userId,tutorialId:780030005,isEnd:true}]}:{})},[operation]),false);
        app.store.db.exec('DROP TRIGGER fail_character_last');
      }
      parse(await push({UserCharacter}));assert.deepEqual(projection(operation).parameters.UserPC,[]);
      if(type===1001) {
        await invalid(push({},[operation]));
        parse(await push({UserTutorial:[{userId:seed.userId,tutorialId:780030005,isEnd:true}]}));
      }
      parse(await push({},[operation]));assert.deepEqual(app.store.operations(),[]);
      assert.deepEqual(app.store.read('UserPC'),savedUnits);assert.deepEqual(app.store.read('UserPCJobSet'),savedBoards);
      assert.equal(app.store.hardCurrency(),wallet);
    }

    //An existing owned unit with no saved board set needs the original lazy getter, not a second unit initializer.
    for(const type of [1000,1001]) for(const pcId of [1011002001,1011001005]) for(const characterPending of [false,true]) {
      await fresh(`existing-unit-board-${type}-${pcId}-${characterPending}`);
      const characterId=master.pcProfiles[pcId].characterId;
      put('UserCharacter',seed.data.UserCharacter.map(row=>row.characterId===characterId?{...row,characterState:1}:row));
      const {operation}=app.store.issueDraw([pcId],{},type),puts=native(operation),
        {UserPCJobSet,UserCharacter,...constructor}=puts;
      assert(UserPCJobSet?.some(row=>row.pcId===pcId) && UserCharacter?.some(row=>row.characterId===characterId));
      parse(await push({...constructor,...(!characterPending?{UserCharacter}:{})}));
      const progressed=app.store.read('UserPC').data.map(row=>row.pcId===pcId?{...row,totalExp:row.totalExp+17}:row);
      parse(await push({UserPC:progressed}));
      const savedUnits=app.store.read('UserPC'),savedCharacters=app.store.read('UserCharacter'),savedBoards=app.store.read('UserPCJobSet'),
        queue=app.store.operations(),wallet=app.store.hardCurrency(),
        receipt=app.store.db.prepare('SELECT * FROM lottery_draw_claim WHERE operation_id=?').get(operation.id),
        derived=projection(operation);
      assert(!savedBoards.data.some(row=>row.pcId===pcId));
      assert.deepEqual(derived.parameters.UserPC,operation.parameters.UserPC.map(row=>({...row,offlinePcBoardRecovery:1})));
      assert(native(derived).UserPC.every(row=>!Object.hasOwn(row,'offlinePcBoardRecovery')),'Synthetic serializer must omit delivery-only metadata, not persist it');
      assert.deepEqual(derived.parameters.UserLimitBreakItem,operation.parameters.UserLimitBreakItem);
      assert.deepEqual(app.store.operations(),queue);assert.equal(app.store.hardCurrency(),wallet);
      assert.deepEqual(app.store.db.prepare('SELECT * FROM lottery_draw_claim WHERE operation_id=?').get(operation.id),receipt);
      for(const marker of [0,2,true,false,'1',null,1.25,0x100000001])
        assert.throws(()=>app.store.lotteryRecovery(operation,{...derived,parameters:{...derived.parameters,
          UserPC:derived.parameters.UserPC.map(row=>({...row,offlinePcBoardRecovery:marker}))}}),/marker/);
      for(const UserPC of [[],[...derived.parameters.UserPC,...derived.parameters.UserPC],
        derived.parameters.UserPC.map(row=>({...row,pcId:1011003001})),
        derived.parameters.UserPC.map(row=>({...row,totalExp:1}))])
        assert.throws(()=>app.store.lotteryRecovery(operation,{...derived,parameters:{...derived.parameters,UserPC}}),/marker|unfinished unit|initializer/);
      await invalid(push({UserPC:progressed.map(row=>({...row,offlinePcBoardRecovery:1}))}));
      await invalid(push({UserPCJobSet:[{userId:seed.userId,pcId,pcJobs:[],offlinePcBoardRecovery:1}]}));
      await invalid(push({UserPC:puts.UserPC}));
      await invalid(push({},[operation]));
      await close();await open();parse(await send('user/login'));
      assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id),derived);
      const pull={tables:['UserPC','UserPCJobSet','UserCharacter']},pulled=await send('user_data/pull',pull);
      assert.equal(pulled.status,200);assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull(pull)));
      assert.deepEqual(app.store.read('UserPC'),savedUnits);assert.deepEqual(app.store.read('UserPCJobSet'),savedBoards);
      assert.deepEqual(app.store.read('UserCharacter'),savedCharacters);assert.deepEqual(app.store.operations(),queue);
      assert.equal(app.store.hardCurrency(),wallet);
      assert.deepEqual(app.store.db.prepare('SELECT * FROM lottery_draw_claim WHERE operation_id=?').get(operation.id),receipt);
      const board={userId:seed.userId,pcId,pcJobs:[{pcJobId:master.pcProfiles[pcId].jobIds[0],
        abilityPanelState:0x2000000,signature:0,abilityPanels:[]}]};
      for(const [table,event] of [['profile','UPDATE OF data'],['gift_pc_floor','INSERT'],['operation_done','INSERT'],
        ['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_existing_board BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'existing unit board rollback'); END`);
        await reject(push({UserPCJobSet:[board],...(characterPending?{UserCharacter}:{}),
          ...(type===1001?{UserTutorial:[{userId:seed.userId,tutorialId:780030005,isEnd:true}]}:{})},[operation]),false);
        app.store.db.exec('DROP TRIGGER fail_existing_board');
      }
      parse(await push({UserPCJobSet:[board]}));
      const afterBoard=projection(operation);
      assert.deepEqual(afterBoard.parameters.UserPC,characterPending?operation.parameters.UserPC:[]);
      assert.deepEqual(app.store.lotteryRecovery(operation,derived),afterBoard,'A cached derived marker must bind to its immutable original after the real board save');
      assert.deepEqual(app.store.read('UserPC'),savedUnits);
      if(characterPending) {
        await invalid(push({},[operation]));parse(await push({UserCharacter}));
        assert.deepEqual(projection(operation).parameters.UserPC,[]);
      }
      if(type===1001) {
        await invalid(push({},[operation]));
        parse(await push({UserTutorial:[{userId:seed.userId,tutorialId:780030005,isEnd:true}]}));
      }
      const final=projection(operation);
      assert.deepEqual(app.store.lotteryRecovery(operation,derived),final);
      parse(await push({},[operation]));assert.deepEqual(app.store.operations(),[]);
      assert.deepEqual(app.store.read('UserPC'),savedUnits);
      assert.deepEqual(app.store.read('UserPCJobSet').data.find(row=>row.pcId===pcId),board);
      assert.equal(app.store.hardCurrency(),wallet);
    }

    //Existing units can finish original conditional outfit/story unlocks without recreating their saved unit or boards.
    for(const type of [1000,1001]) for(const boardsReady of [false,true]) for(const characterPending of [false,true]) for(let mask=0;mask<3;mask++) {
      await fresh(`existing-unit-unlocks-${type}-${boardsReady}-${characterPending}-${mask}`);
      const pcId=1011001005,profile=master.pcProfiles[pcId],characterId=profile.characterId;
      put('UserCharacter',seed.data.UserCharacter.map(row=>row.characterId===characterId?{...row,characterState:1}:row));
      const {operation}=app.store.issueDraw([pcId],{},type),puts=native(operation),names=['UserCharacterCostume','UserAdventureStage'],
        board={userId:seed.userId,pcId,pcJobs:[{pcJobId:profile.jobIds[0],abilityPanelState:0x2000000,signature:0,abilityPanels:[]}]},
        prefix={UserPC:puts.UserPC,...(boardsReady?{UserPCJobSet:[board]}:{}),...(!characterPending?{UserCharacter:puts.UserCharacter}:{}),
          ...Object.fromEntries(names.filter((name,index)=>mask&(1<<index)).map(name=>[name,puts[name]]))};
      assert(names.every(name=>puts[name]?.length));parse(await push(prefix));
      if(mask===1) put('UserCharacterCostume',app.store.read('UserCharacterCostume').data.map(row=>
        row.costumeId===profile.initialCostumeId?{...row,costumeState:3}:row));
      if(mask===2) put('UserAdventureStage',app.store.read('UserAdventureStage').data.map(row=>
        puts.UserAdventureStage.some(stage=>stage.adventureStageId===row.adventureStageId)?{...row,state:3}:row));
      const progressed=app.store.read('UserPC').data.map(row=>row.pcId===pcId?{...row,totalExp:row.totalExp+31}:row);
      parse(await push({UserPC:progressed}));
      const saved=Object.fromEntries(['UserPC','UserPCJobSet','UserCharacter',...names].map(name=>[name,app.store.read(name)])),
        queue=app.store.operations(),wallet=app.store.hardCurrency(),
        receipt=app.store.db.prepare('SELECT * FROM lottery_draw_claim WHERE operation_id=?').get(operation.id),derived=projection(operation);
      assert.deepEqual(derived.parameters.UserPC,operation.parameters.UserPC.map(row=>({...row,
        ...(!boardsReady?{offlinePcBoardRecovery:1}:{}),offlinePcConstructorRecovery:1})));
      assert(native(derived).UserPC.every(row=>!Object.hasOwn(row,'offlinePcConstructorRecovery') && !Object.hasOwn(row,'offlinePcBoardRecovery')));
      for(const marker of [0,2,true,false,'1',null,1.25,0x100000001])
        assert.throws(()=>app.store.lotteryRecovery(operation,{...derived,parameters:{...derived.parameters,
          UserPC:derived.parameters.UserPC.map(row=>({...row,offlinePcConstructorRecovery:marker}))}}),/marker/);
      for(const UserPC of [[],[...derived.parameters.UserPC,...derived.parameters.UserPC],
        derived.parameters.UserPC.map(row=>({...row,pcId:1011003001})),derived.parameters.UserPC.map(row=>({...row,totalExp:1}))])
        assert.throws(()=>app.store.lotteryRecovery(operation,{...derived,parameters:{...derived.parameters,UserPC}}),/marker|unfinished unit|initializer/);
      await invalid(push({UserPC:progressed.map(row=>({...row,offlinePcConstructorRecovery:1}))}));
      await invalid(push({UserPCJobSet:[{...board,offlinePcConstructorRecovery:1}]}));
      await invalid(push({UserPC:puts.UserPC}));await invalid(push({},[operation]));
      await close();await open();parse(await send('user/login'));
      assert.deepEqual(parse(await send('user_data/confirm')).operations.find(row=>row.id===operation.id),derived);
      const pull={tables:Object.keys(saved)},pulled=await send('user_data/pull',pull);
      assert.equal(pulled.status,200);assert.deepEqual(pulled.body,encodeMsgpack(app.store.pull(pull)));
      for(const name of Object.keys(saved)) assert.deepEqual(app.store.read(name),saved[name]);
      assert.deepEqual(app.store.operations(),queue);assert.equal(app.store.hardCurrency(),wallet);
      assert.deepEqual(app.store.db.prepare('SELECT * FROM lottery_draw_claim WHERE operation_id=?').get(operation.id),receipt);
      const unlocks=Object.fromEntries(names.filter((name,index)=>!(mask&(1<<index))).map(name=>[name,puts[name]]));
      for(const [table,event] of [['profile','UPDATE OF data'],['gift_pc_floor','INSERT'],['operation_done','INSERT'],
        ['operation_queue','DELETE'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER fail_existing_unlock BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'existing unit unlock rollback'); END`);
        await reject(push({...unlocks,...(!boardsReady?{UserPCJobSet:[board]}:{}),...(characterPending?{UserCharacter:puts.UserCharacter}:{}),
          ...(type===1001?{UserTutorial:[{userId:seed.userId,tutorialId:780030005,isEnd:true}]}:{})},[operation]),false);
        app.store.db.exec('DROP TRIGGER fail_existing_unlock');
      }
      parse(await push(unlocks));
      await invalid(push({UserAdventureStage:puts.UserAdventureStage.map(row=>({...row,state:0}))}));
      const afterUnlock=projection(operation);
      assert(afterUnlock.parameters.UserPC.every(row=>!Object.hasOwn(row,'offlinePcConstructorRecovery')));
      assert.deepEqual(app.store.lotteryRecovery(operation,derived),afterUnlock,'Cached unlock markers must rebind after actual conditional setter saves');
      if(!boardsReady) {
        assert.equal(afterUnlock.parameters.UserPC[0].offlinePcBoardRecovery,1);
        await invalid(push({},[operation]));parse(await push({UserPCJobSet:[board]}));
      }
      if(characterPending) {await invalid(push({},[operation]));parse(await push({UserCharacter:puts.UserCharacter}));}
      assert.deepEqual(projection(operation).parameters.UserPC,[]);
      if(type===1001) {
        await invalid(push({},[operation]));parse(await push({UserTutorial:[{userId:seed.userId,tutorialId:780030005,isEnd:true}]}));
      }
      assert.deepEqual(app.store.lotteryRecovery(operation,derived),projection(operation));
      parse(await push({},[operation]));assert.deepEqual(app.store.operations(),[]);
      assert.deepEqual(app.store.read('UserPC'),saved.UserPC);
      assert.deepEqual(app.store.read('UserPCJobSet').data.find(row=>row.pcId===pcId),board);
      for(const [index,name] of names.entries()) if(mask&(1<<index)) assert.deepEqual(app.store.read(name),saved[name]);
      assert.equal(app.store.hardCurrency(),wallet);
    }

    //Completed outfit/story floors are not reset into fresh unlock recovery when their actual saved rows disappear.
    await fresh('lost-completed-unit-unlocks');
    {
      const pcId=1011001005,{operation}=app.store.issueDraw([pcId]),puts=native(operation);
      parse(await push(puts));assert(app.store.db.prepare('SELECT 1 FROM gift_pc_floor WHERE pc_id=?').get(pcId));
      for(const [name,field,id] of [['UserCharacterCostume','costumeId',master.pcProfiles[pcId].initialCostumeId],
        ['UserAdventureStage','adventureStageId',puts.UserAdventureStage[0].adventureStageId]]) {
        const saved=app.store.read(name);put(name,saved.data.filter(row=>row[field]!==id));
        const retained=snapshot();assert.throws(()=>app.store.lotteryRecovery(operation),error=>error.status===503);assert.equal(snapshot(),retained);
        await reject(send('user/login'));await reject(send('user_data/confirm'));put(name,saved.data);
      }
      parse(await push({},[operation]));
    }

    //Markers cannot create recovery for an untouched unit or replace a previously completed board set.
    await fresh('unearned-board-marker');
    {
      const {operation}=app.store.issueDraw([1011002001]);
      for(const key of ['offlinePcBoardRecovery','offlinePcConstructorRecovery'])
        assert.throws(()=>app.store.lotteryRecovery(operation,{...operation,parameters:{...operation.parameters,
          UserPC:operation.parameters.UserPC.map(row=>({...row,[key]:1}))}}),/marker/);
      parse(await push(native(operation)));
      assert(app.store.db.prepare('SELECT 1 FROM gift_pc_floor WHERE pc_id=?').get(1011002001));
      const savedBoards=app.store.read('UserPCJobSet');put('UserPCJobSet',savedBoards.data.filter(row=>row.pcId!==1011002001));
      const retained=snapshot();assert.throws(()=>app.store.lotteryRecovery(operation),/Partially initialized/);assert.equal(snapshot(),retained);
      await reject(send('user/login'));await reject(send('user_data/confirm'));
      put('UserPCJobSet',savedBoards.data);parse(await push({},[operation]));
    }

    //Missing original captures are not promoted into complete initializers even when the unit has saved.
    {
      await fresh('missing-capture');const {operation}=app.store.issueDraw([1011001005]),puts=native(operation);
      parse(await push(puts));assert.deepEqual(projection(operation).parameters.UserPC,[]);
      const capture=app.store.db.prepare('SELECT * FROM lottery_draw_claim WHERE operation_id=?').get(operation.id);
      app.store.db.prepare('DELETE FROM lottery_draw_claim WHERE operation_id=?').run(operation.id);
      await reject(send('user/login'));
      app.store.db.prepare(`INSERT INTO lottery_draw_claim(operation_id,type,parameters,pc_targets,operation_json,iris_history_id)
        VALUES(?,?,?,?,?,?)`).run(capture.operation_id,capture.type,capture.parameters,capture.pc_targets,
          capture.operation_json,capture.iris_history_id);
      parse(await push({},[operation]));
    }
    console.log('Synthetic per-unit lottery recovery: complete/untouched/shared-character/guarded partial and real ACK cases OK; NOT native acceptance');
  } finally {
    await close();const resolved=fs.realpathSync(directory);
    assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));
    assert(path.basename(resolved).startsWith('danmemore-gacha-unit-recovery-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
