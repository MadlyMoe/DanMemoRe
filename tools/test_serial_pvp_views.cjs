'use strict';

// DEFERRED / NOT RUN. Temporary SQLite/transport fixtures do not prove either
//native profile/record consumer, portraits, party vectors, saves or navigation.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const {initialRecord}=require('./serial_pvp.cjs');
const master=require('../data/danmemore-master.json'),seed=require('./test_serial_pvp_lobby.cjs').unlockedSeed();
const id=81000000001,season=master.serialPvp.serialPvpInformation[id],details='serial_pvp/player_info/get';
const md5=value=>crypto.createHash('md5').update(value).digest('hex');

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-abyss-views-'));
  let database=path.join(directory,'save.sqlite'),app,port,sequence=0,now=season.slot3+100;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const send=(action,body)=>request(port,++sequence,body,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const cancel=async(action,body,status=503)=>{const before=snapshot(),reply=await send(action,body);
    assert.equal(reply.status,status,reply.body.toString());if(status===503)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Cancellation must preserve all save/queue/capture/identity state');};
  const select=async gradeId=>{
    const result=parse(await send('serial_pvp/grade/select',{serialPvpId:id,gradeId}));
    await cancel(details,{serialPvpId:id,userId:result.rivalList[0].serialPvpPlayerInfo.userId});
    const saved=app.store.serialPvp.state(id),entry=app.store.serialPvp.runEntry(id),info=structuredClone(app.store.read('UserInfo').data[0]);
    Object.assign(info.playerStatus,entry.candidates[0].after);
    const putItems={UserInfo:[info],UserSerialPvpGameStatus:[saved.after.UserSerialPvpGameStatus],
      UserSerialPvpUsingLimitData:[saved.after.UserSerialPvpUsingLimitData]};
    parse(await send('user_data/push',{badges:null,scripts:{},dataTokens:{},operations:[],
      checksums:{before:{},after:Object.fromEntries(Object.entries(putItems).map(([name,rows])=>[name,md5(JSON.stringify(rows))]))},
      deltas:[{signature:0,trigger:'UpdateSerialPvpState',putItems,deleteItems:{}}]}));
    return result;
  };
  try {
    await open();await cancel(details,{serialPvpId:id,userId:seed.userId});
    await cancel(details,{serialPvpId:id,userId:123});
    for(const body of [null,{}, {serialPvpId:id,userId:0},{serialPvpId:id,userId:1,gradeId:81200010000}])
      await cancel(details,body,400);
    let first,firstBody,firstSequence;
    for(const [index,gradeId] of Object.keys(master.serialPvp.serialPvpGrade).map(Number).entries()) {
      if(index) {await close();database=path.join(directory,`grade-${index}.sqlite`);await open();first=null;}
      // Independent synthetic selections, not illegal unplayed reselects or
      //proof that a fresh native account naturally has all classes unlocked.
      const lobby=await select(gradeId),profiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
        queue=JSON.stringify(app.store.operations());
      for(const rival of lobby.rivalList) {
        const body={serialPvpId:id,userId:rival.serialPvpPlayerInfo.userId},reply=await send(details,body),result=parse(reply);
        assert.deepEqual(result.serialPvpRecord,[initialRecord(id,body.userId)]);
        assert.deepEqual(result.serialPvpParty,rival.serialPvpParty);
        assert.equal(result.serialPvpParty.partyType,9);assert.equal(result.serialPvpParty.slots.length,6);
        assert.equal(result.playerInfo.userId,body.userId);assert.equal(result.playerInfo.name,rival.serialPvpPlayerInfo.name);
        assert.equal(result.playerInfo.totalExp,rival.serialPvpPlayerInfo.totalExp);
        assert.match(result.playerInfo.description,/Offline Abyss CPU/);
        const favorite=master.communicationCharacters[result.playerInfo.favoriteCharacterId];
        assert.equal(master.characterCostumes[result.playerInfo.favoriteCharacterCostumeId].characterKey,master.characters[favorite.characterId].key);
        assert.equal(result.familiaName,'');assert.deepEqual(result.substitutedSpineIds,[]);
        assert.equal(result.userAdventureLevelInfo,undefined);assert.equal(result.operation,undefined);assert.equal(result.operations,undefined);
        assert.deepEqual(parse(await send(details,body)),result);
        if(!first){first=reply;firstBody=body;firstSequence=sequence-1;}
      }
      assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profiles);
      assert.equal(JSON.stringify(app.store.operations()),queue,'Views neither issue combat/rewards nor acknowledge pending operations');
    }
    const status=app.store.read('UserSerialPvpGameStatus').data[0],putItems={UserSerialPvpGameStatus:[{
      ...status,updatedMatchingCount:1,executeRivalListUpdate:true}]};
    parse(await send('user_data/push',{badges:null,scripts:{},dataTokens:{},operations:[],
      checksums:{before:{},after:{UserSerialPvpGameStatus:md5(JSON.stringify(putItems.UserSerialPvpGameStatus))}},
      deltas:[{signature:0,trigger:'UpdateSerialPvpState',putItems,deleteItems:{}}]}));
    parse(await send('serial_pvp/rival_list/update',{serialPvpId:id,gradeId:81200010004}));
    const target=app.store.serialPvp.state(id).after.UserSerialPvpGameStatus;
    parse(await send('user_data/push',{badges:null,scripts:{},dataTokens:{},operations:[],
      checksums:{before:{},after:{UserSerialPvpGameStatus:md5(JSON.stringify([target]))}},
      deltas:[{signature:0,trigger:'UpdateSerialPvpState',putItems:{UserSerialPvpGameStatus:[target]},deleteItems:{}}]}));
    const beforeOld=snapshot(),stale=await request(port,firstSequence,firstBody,String(firstSequence),details);
    assert.equal(stale.status,503);assert.equal(snapshot(),beforeOld,'A former lobby generation cannot replay into native caches');
    const current=app.store.serialPvp.state(id),body={serialPvpId:id,userId:current.rivals[0].serialPvpPlayerInfo.userId};
    for(const table of ['serial_pvp_view_request','reply_cache']) {
      const before=snapshot();app.store.db.exec(`CREATE TEMP TRIGGER abyss_view_fail BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END`);
      assert.ok((await send(details,body)).status>=500);assert.equal(snapshot(),before);app.store.db.exec('DROP TRIGGER abyss_view_fail');
    }
    const exact=await send(details,body),exactSequence=sequence;
    await close();await open();app.store.db.exec('DELETE FROM reply_cache');
    assert.deepEqual((await request(port,exactSequence,body,String(exactSequence),details)).body,exact.body);
    const beforeConflict=snapshot(),conflict=await request(port,exactSequence,{...body,userId:current.rivals[1].serialPvpPlayerInfo.userId},
      String(exactSequence),details,{'X-ARGO-REQUEST-BODY-HASH':'same-claimed-hash'});
    assert.equal(conflict.status,400);assert.equal(snapshot(),beforeConflict,'Actual wire bytes bind the permanent identity');
    const other=await request(port,exactSequence,undefined,String(exactSequence),'user_data/confirm');
    assert.equal(other.status,400);assert.equal(snapshot(),beforeConflict);
    now=season.slot4+1;assert.ok(now<season.slot6);parse(await send(details,body));
    now=season.slot6;await cancel(details,body);
    const beforeExpired=snapshot(),expired=await request(port,exactSequence,body,String(exactSequence),details);
    assert.equal(expired.status,503);assert.equal(snapshot(),beforeExpired,'Cached views still obey the original display clock');
    now=season.slot3+100;
    const receipt=app.store.db.prepare('SELECT * FROM serial_pvp_view_request WHERE request_key=?').get(`${exactSequence}/${exactSequence}`);
    app.store.db.prepare('UPDATE serial_pvp_view_request SET catalog_hash=? WHERE request_key=?').run('broken',receipt.request_key);
    const beforeCorrupt=snapshot(),corrupt=await request(port,exactSequence,body,String(exactSequence),details);
    assert.equal(corrupt.status,503);assert.equal(snapshot(),beforeCorrupt);
    console.log('Abyss player-details source fixtures complete; native acceptance remains pending');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
