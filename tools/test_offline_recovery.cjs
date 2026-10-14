'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createServer, encodeMsgpack, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const audit = require('../data/danmemore-protocol-audit.json');

// Logical gameplay/receipt equality, not physical WAL bytes or clock passage.
function snapshot(db) {
  return JSON.stringify(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name, db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all()]));
}
function issueDungeonTicket(store,dungeonId=1) {
  const operation=store.issueOperation(3000,{}),body=JSON.stringify({id:dungeonId}),
    cost=master.consumes[81021001].amount;
  store.db.prepare('INSERT INTO dungeon_ticket_issue(operation_id,dungeon_id,iris_cost,amount) VALUES(?,?,?,1)')
    .run(operation.id,dungeonId,cost);
  store.db.prepare('INSERT INTO dungeon_ticket_request(request_key,body_hash,operation_id) VALUES(?,?,?)')
    .run(`fixture:${operation.id}`,crypto.createHash('md5').update(body).digest('hex'),operation.id);
  return operation;
}
function unavailable(response, action, before, db) {
  assert.equal(response.status, 503);
  assert.equal(response.headers['x-argo-server-response-code'], String(OFFLINE_UNAVAILABLE_CODE));
  assert.equal(response.headers['content-type'], 'application/json');
  const result = JSON.parse(response.body);
  assert.equal(result.code, OFFLINE_UNAVAILABLE_CODE);
  assert.equal(result.action, action); assert.equal(result.offlineUnavailable, true);
  assert.equal(typeof result.message, 'string'); assert.deepEqual(result.trace, []);
  assert.equal(result.operation, undefined); assert.equal(result.operations, undefined);
  assert.equal(result.result, undefined); assert.equal(result.data, undefined);
  assert.equal(snapshot(db), before, `Unsupported ${action} must not alter gameplay or queued awards`);
}

// DEFERRED / NOT RUN. Synthetic ordinary saves, not native crafting or UI proof.
async function saveSyncReplay(directory) {
  const database = path.join(directory, 'save-sync.sqlite'), now = 1600000000;
  let app, port, sequence = 0;
  const open = async () => {
    app = createServer({ database, seed, master, wallNowSeconds: () => now, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const capture = async (action, value) => {
    const seq = ++sequence, id = String(100 + seq);
    const response = await request(port, seq, value, id, action);
    assert.equal(response.status, 200, response.body.toString());
    if(action==='user_data/push') {
      const saved=JSON.parse(response.body),acknowledgements=value.operations.map(row=>({id:row.id}));
      assert.deepEqual(saved.operations,acknowledgements,'Native push replies carry committed ACK IDs, never pending rewards');
      assert.deepEqual(saved.dones,acknowledgements);assert.equal(saved.operation,undefined);
    }
    return { action, value, seq, id, response };
  };
  const replay = packet => request(port, packet.seq, packet.value, packet.id, packet.action);
  const unchanged = async packet => {
    const before = snapshot(app.store.db), result = await replay(packet);
    assert.equal(result.status, 200, result.body.toString());
    assert.deepEqual(result.body, packet.response.body); assert.equal(snapshot(app.store.db), before);
  };
  const stale = async packet => {
    const before = snapshot(app.store.db);
    unavailable(await replay(packet), packet.action, before, app.store.db);
  };
  const save = (putItems = {}, operations = []) => capture('user_data/push', {
    badges: null, scripts: {}, dataTokens: {}, checksums: { before: {}, after: Object.fromEntries(
      Object.entries(putItems).map(([name, rows]) => [name, crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex')])) },
    deltas: Object.keys(putItems).length ? [{ signature: 0, trigger: 'EquipmentChange', putItems, deleteItems: {} }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })),
  });
  try {
    await open(); await capture('user/login');
    const original = await capture('user_data/pull', { tables: ['UserEquipment'] });
    const oldConfirm = await capture('user_data/confirm');
    await unchanged(original); await unchanged(oldConfirm);
    const id = Number(Object.keys(master.equipments).find(id => master.equipments[id].type === 1));
    const { type, ...spec } = app.store.equipmentSpec(id), occupied = app.store.read('UserEquipment').data;
    const slotIndex = Array.from({ length: 500 }, (_, i) => i + 1).find(slot => !occupied.some(row => row.slotIndex === slot));
    let piece = { userId: seed.userId, ...spec, slotIndex, createAt: now, exp: 0,
      durability: master.equipments[id].durability, reservedDurability: master.equipments[id].durability,
      isProtected: false, isUnbreakable: false,
      ...Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`lockedAbility${i + 1}`, false])) };
    const firstSave = await save({ UserEquipment: [piece] });
    await unchanged(firstSave); await stale(original); await stale(oldConfirm);
    const newerPull = await capture('user_data/pull', original.value);
    assert.deepEqual(newerPull.response.body, encodeMsgpack(app.store.pull(original.value)));
    piece = { ...piece, isProtected: true };
    const nextSave = await save({ UserEquipment: [piece] });
    await unchanged(nextSave); await stale(firstSave); await stale(newerPull);
    // Unrelated table changes must not invalidate an unchanged binary projection.
    const currency = await capture('user_data/pull', { tables: ['UserCurrency'] });
    piece = { ...piece, exp: 1 }; await save({ UserEquipment: [piece] });
    await unchanged(currency);
    const byteSnapshot = await capture('user_data/pull', original.value), beforeBytes = app.store.read('UserEquipment');
    // Disposable corruption fixture: changed raw bytes with the SAME saved token.
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify(beforeBytes.data.map(row =>
      row.slotIndex === slotIndex ? { ...row, isProtected: false } : row)), 'UserEquipment');
    assert.equal(app.store.read('UserEquipment').token, beforeBytes.token); await stale(byteSnapshot);
    const actual = await capture('user_data/pull', original.value);
    assert.deepEqual(actual.response.body, encodeMsgpack(app.store.pull(original.value)));
    // Queue-only changes: all table tokens stay identical; stale replies still cancel.
    const noQueue = await capture('user_data/confirm'), tokens = app.store.allTokens();
    const ticket = issueDungeonTicket(app.store);
    assert.deepEqual(app.store.allTokens(), tokens); await stale(noQueue);
    // WRITTEN ONLY / NOT RUN: malformed private queue data must retain every pending award.
    const ticketParameters=app.store.db.prepare('SELECT parameters FROM operation_queue WHERE id=?').get(ticket.id).parameters;
    for(const invalid of ['{','null','[]']) {
      app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(invalid,ticket.id);
      for(const action of ['user_data/confirm','user/login']) {
        const before=snapshot(app.store.db),seq=++sequence;
        unavailable(await request(port,seq,undefined,String(100+seq),action),action,before,app.store.db);
      }
    }
    app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(ticketParameters,ticket.id);
    const queued = await capture('user_data/confirm');
    assert.deepEqual(JSON.parse(queued.response.body).operations, app.store.operations());
    await unchanged(queued);
    const secondTicket = issueDungeonTicket(app.store,2);
    const saveWithQueue = await save({}, [ticket]), thirdTicket = issueDungeonTicket(app.store,3);
    await unchanged(saveWithQueue); // Queue-only changes do not alter this request's actual receipt ACKs.
    assert.deepEqual(app.store.operations(),[secondTicket,thirdTicket]);
    // WRITTEN ONLY / NOT RUN: legacy pending-reward lists cannot remove local pending receipts.
    const ackCache=app.store.db.prepare("SELECT key,body FROM reply_cache WHERE action='user_data/push' ORDER BY rowid DESC LIMIT 1").get(),
      ackBody=JSON.parse(Buffer.from(ackCache.body,'base64'));
    for(const dones of [[],[{id:secondTicket.id}],[{id:ticket.id},{id:ticket.id}],[{id:ticket.id,type:3000}],
        [{id:-1}],[{id:String(ticket.id)}],null]) {
      const changed={...ackBody,dones,operations:dones};
      app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?')
        .run(Buffer.from(JSON.stringify(changed)).toString('base64'),ackCache.key);
      await stale(saveWithQueue);
    }
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(ackCache.body,ackCache.key);
    app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(ticket.id);
    await stale(saveWithQueue);
    app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(ticket.id);
    const legacy={...ackBody,operations:[secondTicket,thirdTicket]};
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?')
      .run(Buffer.from(JSON.stringify(legacy)).toString('base64'),ackCache.key);
    const beforeLegacy=snapshot(app.store.db),normalized=await replay(saveWithQueue);
    assert.equal(normalized.status,200,normalized.body.toString());
    assert.deepEqual(JSON.parse(normalized.body).operations,[{id:ticket.id}]);
    assert.deepEqual(JSON.parse(normalized.body).dones,[{id:ticket.id}]);
    assert.equal(snapshot(app.store.db),beforeLegacy,'Legacy normalization changes only the response, not saved cache/queue/receipts');
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(ackCache.body,ackCache.key);
    const acknowledged = await save({}, [secondTicket, thirdTicket]);
    assert.equal(app.store.operations().length, 0); await stale(queued);
    await unchanged(saveWithQueue);
    const settled = await capture('user_data/confirm'); await unchanged(settled);
    // Corrupt cached token maps are retained, not accepted as an empty success.
    const cache = app.store.db.prepare("SELECT key,body FROM reply_cache WHERE action='user_data/push' ORDER BY rowid DESC LIMIT 1").get();
    const broken = JSON.parse(Buffer.from(cache.body, 'base64')); broken.dataTokens = 1;
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(Buffer.from(JSON.stringify(broken)).toString('base64'), cache.key);
    await stale(acknowledged);
    await app.close(); app = null; await open();
    await stale(original); await unchanged(settled);await unchanged(saveWithQueue);
    assert.equal(app.store.operations().length, 0);
    assert.deepEqual((await capture('user_data/pull', original.value)).response.body, encodeMsgpack(app.store.pull(original.value)));
  } finally { if (app) await app.close(); }
}
// DEFERRED / NOT RUN. Offline-issued token lifecycle, not native grant attribution.
async function itemTokenSaves(directory) {
  const database=path.join(directory,'item-tokens.sqlite'),realRandomInt=crypto.randomInt;
  let app,port,sequence=0;
  const open=async()=>{
    app=createServer({database,seed,master,wallNowSeconds:()=>1600000000,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
  };
  const send=(value,action='user_data/push')=>request(port,++sequence,value,String(sequence),action);
  const parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);};
  const save=(removed=[],added=[])=>({badges:null,scripts:{},dataTokens:{},checksums:{before:{},
    after:{UserItemToken:'11111111111111111111111111111111'}},operations:[],deltas:[{signature:0,trigger:'Blocking',
      putItems:added.length ? {UserItemToken:added} : {},deleteItems:removed.length ? {UserItemToken:removed} : {}}]});
  const cancel=async value=>{
    const before=snapshot(app.store.db);
    unavailable(await send(value),'user_data/push',before,app.store.db);
  };
  const candidate=()=>{
    const active=new Set(app.store.read('UserItemToken').data.map(row=>row.signature));
    let signature=1;
    while(active.has(signature) || app.store.db.prepare('SELECT 1 FROM item_token_used WHERE signature=?').get(signature)) signature++;
    return signature;
  };
  try {
    await open();
    const issuedPool=app.store.read('UserItemToken').data,
      fullPool=issuedPool.map(row=>({...row,consumer:0,value:0,context:'',verifier:''}));
    const echoBody=save([],fullPool),echoResponse=await send(echoBody),echoSequence=sequence;
    parse(echoResponse);
    assert.deepEqual(app.store.read('UserItemToken').data,fullPool,'Native unused full rows must survive saves unchanged');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) amount FROM item_token_used').get().amount,0);
    let before=snapshot(app.store.db);
    const echoReplay=await request(port,echoSequence,echoBody,String(echoSequence),'user_data/push');
    assert.equal(echoReplay.status,200);assert.deepEqual(echoReplay.body,echoResponse.body);
    assert.equal(snapshot(app.store.db),before);
    for(const changed of [{consumer:150000},{value:216000001},{context:'consumed'},{verifier:'consumed'},
      {consumer:'0'},{value:null},{context:null},{verifier:null},{opaqueExtension:true}]) {
      before=snapshot(app.store.db);
      assert.equal((await send(save([],[{...fullPool[0],...changed}]))).status,400);
      assert.equal(snapshot(app.store.db),before,'Unused echoes cannot change consumption metadata');
    }
    const initial=app.store.read('UserItemToken').data;
    //The verifier remains an opaque fixture, not proof of a native grant/hash.
    const consumed={...initial[0],consumer:150000,value:216000001,context:'',verifier:'fixture-verifier',
      opaqueExtension:{retained:true}},body=save([consumed]);
    for(const table of ['item_token_used','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER token_save_failure BEFORE INSERT ON ${table}
        BEGIN SELECT RAISE(ABORT,'item token failure'); END`);
      const before=snapshot(app.store.db),failed=await send(body);
      assert.equal(failed.status,503);assert.equal(failed.body.length,0);
      assert.equal(snapshot(app.store.db),before,'Pool, consumed-token capture, sequence and reply must roll back together');
      app.store.db.exec('DROP TRIGGER token_save_failure');
    }
    const fresh=candidate();let calls=0;
    crypto.randomInt=()=>calls++ ? fresh : consumed.signature;
    const response=await send(body),responseSequence=sequence,result=parse(response);
    crypto.randomInt=realRandomInt;
    assert.equal(calls,2,'A token consumed in this same save cannot be reissued');
    assert.deepEqual(result.data.UserItemToken,[{userId:seed.userId,signature:fresh}]);
    assert.equal(app.store.read('UserItemToken').data.length,initial.length);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM item_token_used WHERE signature=?').get(consumed.signature),
      {signature:consumed.signature,user_id:seed.userId,native_delete:JSON.stringify(consumed)});
    const beforeReplay=snapshot(app.store.db);
    const replay=await request(port,responseSequence,body,String(responseSequence),'user_data/push');
    assert.equal(replay.status,200);assert.deepEqual(replay.body,response.body);
    assert.equal(snapshot(app.store.db),beforeReplay,'An unchanged retry cannot retire or replace a token twice');
    await cancel(save([{signature:consumed.signature}]));
    await cancel(save([],[{userId:seed.userId,signature:candidate()}]));
    const issued=app.store.read('UserItemToken').data[0];
    before=snapshot(app.store.db);
    assert.equal((await send(save([issued,issued]))).status,400);assert.equal(snapshot(app.store.db),before);
    const repeated=save([issued]);repeated.deltas.push(structuredClone(repeated.deltas[0]));
    await cancel(repeated);
    before=snapshot(app.store.db);
    assert.equal((await send(save([{...issued,userId:seed.userId+1}]))).status,400);
    assert.equal((await send(save([],[{...issued,opaqueExtension:true}]))).status,400);
    assert.equal(snapshot(app.store.db),before);
    const nextFresh=candidate();calls=0;
    crypto.randomInt=()=>calls++ ? nextFresh : consumed.signature;
    parse(await send(save([{signature:issued.signature}])));
    crypto.randomInt=realRandomInt;
    assert.equal(calls,2,'Persistent consumed-token identities cannot be reissued in later saves');
    assert.equal(app.store.read('UserItemToken').data.length,initial.length);
    await app.close();app=null;await open();
    assert.equal(app.store.read('UserItemToken').data.filter(row=>Object.hasOwn(row,'consumer')).length,initial.length-2,
      'Full native unused rows and short replacement rows must both survive restart');
    const raw=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserItemToken'").get();
    const current=JSON.parse(raw.data);
    parse(await send(undefined,'user_data/confirm'));const confirmSequence=sequence;
    assert.equal((await send({tables:['UserItemToken']},'user_data/pull')).status,200);const pullSequence=sequence;
    for(const rows of [[...current,consumed],current.concat(current[0]),
      current.map((row,i)=>i ? row : {...row,userId:seed.userId+1}),current.map((row,i)=>i ? row : {...row,signature:'1'}),
      current.map((row,i)=>i ? row : {...row,consumer:150000}),{}]) {
      app.store.db.prepare("UPDATE profile SET data=? WHERE name='UserItemToken'").run(JSON.stringify(rows));
      assert.throws(()=>app.store.read('UserItemToken'),error=>error.status===503);
      for(const [action,value] of [['user/login',undefined],['user_data/confirm',undefined],['user_data/pull',{tables:['UserItemToken']}]]) {
        before=snapshot(app.store.db);unavailable(await send(value,action),action,before,app.store.db);
      }
      before=snapshot(app.store.db);
      unavailable(await request(port,confirmSequence,undefined,String(confirmSequence),'user_data/confirm'),'user_data/confirm',before,app.store.db);
      unavailable(await request(port,pullSequence,{tables:['UserItemToken']},String(pullSequence),'user_data/pull'),'user_data/pull',before,app.store.db);
      app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserItemToken'").run(raw.data,raw.token);
    }
    await app.close();app=null;await open();
    assert.deepEqual(app.store.read('UserItemToken').data,current);
    await cancel(save([{signature:consumed.signature}]));
    assert.equal(app.store.db.prepare('SELECT COUNT(*) amount FROM item_token_used').get().amount,2);
  } finally {crypto.randomInt=realRandomInt;if(app) await app.close();}
}

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-recovery-'));
  let app;
  try {
    app = createServer({ database: path.join(directory, 'save.sqlite'), seed, master,
      wallNowSeconds: () => 1600000000, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const port = app.server.address().port;
    await request(port, 0, undefined, '10', 'user/login');
    // Synthetic receipt-backed ticket operation exercises preservation, not native acceptance.
    const retainedTicket=issueDungeonTicket(app.store);
    const before = snapshot(app.store.db);
    const actions = Object.entries(audit.routes).filter(([, route]) => route.status === 'unsupported').map(([action]) => action);
    for (const action of actions) for(const value of [undefined,{}])
      unavailable(await request(port, 1, value, '11', action), action, before, app.store.db);
    // Legacy native request uses one positive signed-int32 gate identity.
    for(const value of [undefined,{},null,{id:0},{id:-1},{id:0x80000000},{id:'1'},{id:1,quantity:1}]) {
      const response=await request(port,1,value,'11','dungeon/ticket/issue');
      assert.equal(response.status,400);assert.equal(snapshot(app.store.db),before);
    }
    unavailable(await request(port, 1, null, '11', 'familia/leave'), 'familia/leave', before, app.store.db);
    unavailable(await request(port, 1, {}, '11', 'future/unimplemented'), 'future/unimplemented', before, app.store.db);
    // An unsupported BRANCH of an implemented packet gets the same cancellation.
    unavailable(await request(port, 1, { consumeId: 81031001 }, '11', 'currency/hard/consume'),
      'currency/hard/consume', before, app.store.db);
    for (const body of [{ consumeId: 81031001, detailId: 1 },
      { consumeId: 81011001, detailId: 1, payload: { pcId: 1011001001 } }])
      unavailable(await request(port, 1, body, '11', 'currency/hard/consume'),
        'currency/hard/consume', before, app.store.db);
    const malformed = await request(port, 1, { consumeId: -1 }, '12', 'currency/hard/consume');
    assert.equal(malformed.status, 400); assert.equal(malformed.headers['x-argo-server-response-code'], undefined);
    assert.equal(snapshot(app.store.db), before);
    const badShape = await request(port, 1, [], '12', 'future/unimplemented');
    assert.equal(badShape.status, 400); assert.equal(badShape.headers['x-argo-server-response-code'], undefined);
    // A bad client version remains rejected, not disguised as unavailable.
    const bad = await new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/api/game_client/future/unimplemented',
        headers: { Host: '127.0.0.1:28766', 'X-ARGO-CLIENT-VERSION': 'wrong', 'Content-Length': 0 } }, response => {
        response.resume(); response.on('end', () => resolve(response));
      }); req.on('error', reject); req.end();
    });
    assert.equal(bad.statusCode, 400); assert.equal(bad.headers['x-argo-server-response-code'], undefined);
    // A normal request following cancellation must still work without session reset.
    const confirm = await request(port, 2, undefined, '13', 'user_data/confirm');
    assert.equal(confirm.status, 200); assert.equal(confirm.headers['x-argo-server-response-code'], '0');
    assert.equal(app.store.operations().length, 1);
    const unreceipted=app.store.issueOperation(3000,{}),beforeUnreceipted=snapshot(app.store.db);
    unavailable(await request(port,3,undefined,'140','user_data/confirm'),
      'user_data/confirm',beforeUnreceipted,app.store.db);
    app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(unreceipted.id);
    const beforeException = snapshot(app.store.db);
    app.store.db.exec("CREATE TRIGGER recovery_test_failure BEFORE INSERT ON reply_cache WHEN NEW.action='user_data/confirm' BEGIN SELECT RAISE(ABORT,'unexpected database failure'); END");
    const exception = await request(port, 3, undefined, '14', 'user_data/confirm');
    assert.equal(exception.status, 503); assert.equal(exception.body.length, 0);
    assert.equal(exception.headers['x-argo-server-response-code'], undefined,
      'Unexpected database exceptions must not be mislabeled as an unavailable feature');
    assert.equal(snapshot(app.store.db), beforeException, 'Unexpected failures must also roll back');
    app.store.db.exec('DROP TRIGGER recovery_test_failure');
    assert.equal((await request(port, 4, undefined, '15', 'user_data/confirm')).status, 200);
    const legacyTicket=app.store.issueOperation(3000,{}),legacyBody=Buffer.from(JSON.stringify(
      {code:0,operation:legacyTicket,operations:[legacyTicket]}));
    app.store.saveReply('991/991','dungeon/ticket/issue',
      crypto.createHash('md5').update('{"id":9}').digest('hex'),'application/json',legacyBody);
    await app.close(); app = null;
    app = createServer({ database: path.join(directory, 'save.sqlite'), seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    assert.deepEqual(app.store.operations().map(row=>row.id),[retainedTicket.id]);
    assert.equal(app.store.db.prepare('SELECT operation_id FROM legacy_dungeon_ticket_backup WHERE operation_id=?')
      .get(legacyTicket.id).operation_id,legacyTicket.id);
    assert.equal(app.store.db.prepare('SELECT 1 FROM reply_cache WHERE key=?').get('991/991'),undefined);
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    await app.close(); app = null;
    await saveSyncReplay(directory);
    await itemTokenSaves(directory);
    console.log(`Offline cancellation: ${actions.length} unsupported packets, partial branch, validation, unchanged save/queue and restart OK`);
  } finally {
    if (app) await app.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
