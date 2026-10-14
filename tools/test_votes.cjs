'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = value => crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-votes-'));
  const database = path.join(directory, 'profile.sqlite'), realNow = Date.now;
  const electionId = 50000000007, event = master.votes[electionId];
  const [candidate, other] = event.candidates;
  let app, port, sequence = 0, now = event.startAt;
  const open = async (original = master, filename = database) => {
    app = createServer({ database: filename, seed, master: original, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => {
    if (app?.server.listening) await new Promise(resolve => app.server.close(resolve));
    app?.store.close(); app = null;
  };
  const send = (value, action = 'election/vote') => request(port, ++sequence, value, String(sequence), action);
  const body = { electionId, voteId: candidate.id, voteCount: 2 };
  const vote = (changes = {}) => send({ ...body, ...changes });
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const info = (count = 7) => ({ userId: seed.userId, voteInfoId: electionId, defaultItemReceive: true, count });
  const ticket = (amount = 10, cumulativeAmount = 20) => ({ userId: seed.userId, voteItemId: event.voteItemId,
    amount, cumulativeAmount, reservedAmount: 0, bookEntryState: 1, signature: 0 });
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows), md5(rows), name);
  const profiles = () => app.store.db.prepare('SELECT * FROM profile ORDER BY name').all();
  const snapshot = () => Object.fromEntries(app.store.db.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name")
    .all().map(({ name }) => {
      assert.match(name, /^[a-z_]+$/);
      return [name, app.store.db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()];
    }));
  // New hot/partial/permanent-replay vectors are DEFERRED / NOT RUN.
  const unavailable = async response => {
    const before = snapshot(), result = await response;
    assert.equal(result.status, 503, result.body.toString());
    assert.equal(result.headers['x-argo-server-response-code'], String(OFFLINE_UNAVAILABLE_CODE));
    assert.equal(JSON.parse(result.body).code, OFFLINE_UNAVAILABLE_CODE);
    assert.deepEqual(snapshot(), before, 'Cancellation must retain votes, native profiles, queue, ACKs and transport receipts');
  };
  // Synthetic native deltas verify the isolated SQLite handoff, not emulator playability.
  const save = (operations, putItems = {}, deleteItems = {}) => ({ badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: Object.fromEntries([...new Set([...Object.keys(putItems), ...Object.keys(deleteItems)])]
      .map(name => [name, md5(putItems[name] ?? [])])) },
    deltas: Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature: 0, trigger: 'VoteInfoUpdate', putItems, deleteItems }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })) });
  const push = (operations, putItems = {}, deleteItems = {}) => send(save(operations, putItems, deleteItems), 'user_data/push');
  try {
    Date.now = () => now * 1000;
    await open();
    put('UserVoteInfo', [info()]);
    put('UserVoteItem', [ticket()]);
    //Seven-field native contract / zero-receipt guards: DEFERRED, NOT RUN.
    //The serialized book byte is not the domain's constant book getter, and
    //the UInt32 signature field is not publisher-verifier authentication.
    assert.equal(app.store.db.prepare('SELECT count(*) n FROM vote_request').get().n,0);
    assert.equal(app.store.db.prepare('SELECT count(*) n FROM vote_default_grant').get().n,0);
    for(const row of [ticket(0,0),{...ticket(),bookEntryState:0xff,signature:0xffffffff}]) {
      parse(await push([],{UserVoteItem:[row]}));
      assert.deepEqual(app.store.read('UserVoteItem').data,[row]);
    }
    parse(await push([],{UserVoteItem:[ticket()]}));
    const nativeTicket=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserVoteItem'").get();
    const missing=Object.keys(ticket()).map(field=>{const row=ticket();delete row[field];return [row];});
    const malformed=[...missing,[null],[{}],[ticket(),ticket()],
      ...[{userId:0},{userId:seed.userId+1},{voteItemId:1},{voteItemId:String(event.voteItemId)},
        {reservedAmount:-1},{reservedAmount:1000000000},{reservedAmount:1.5},{reservedAmount:'0'},
        {bookEntryState:-1},{bookEntryState:0x100},{bookEntryState:1.5},{bookEntryState:'1'},
        {signature:-1},{signature:0x100000000},{signature:0.5},{signature:'0'},
        {cumulativeAmount:9},{extra:0}].map(changes=>[{...ticket(),...changes}])];
    for(const rows of malformed) {
      const unchanged=snapshot();assert.equal((await push([],{UserVoteItem:rows})).status,400);
      assert.deepEqual(snapshot(),unchanged);
      app.store.db.prepare("UPDATE profile SET data=? WHERE name='UserVoteItem'").run(JSON.stringify(rows));
      assert.throws(()=>app.store.read('UserVoteItem'),error=>error.status===503);
      await unavailable(send({},'user/login'));await unavailable(send(undefined,'user_data/confirm'));
      await unavailable(send({tables:['UserVoteItem']},'user_data/pull'));
      app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserVoteItem'")
        .run(nativeTicket.data,nativeTicket.token);
    }
    assert.equal(app.store.db.prepare('SELECT count(*) n FROM vote_default_grant').get().n,0);
    let before = snapshot();
    for (const row of [info(6), { ...info(), defaultItemReceive: false }]) {
      assert.equal((await push([], { UserVoteInfo: [row] })).status, 400);
      assert.deepEqual(snapshot(), before, 'First-open receipt and participation cannot regress even before the first server vote');
    }
    assert.equal((await push([], {}, { UserVoteInfo: [{ voteInfoId: electionId }] })).status, 400);
    assert.deepEqual(snapshot(), before);
    for (const value of [null, {}, [], { ...body, extra: 0 }, { ...body, electionId: String(electionId) },
      { ...body, electionId: 1 }, { ...body, voteId: candidate.characterId }, { ...body, voteId: String(candidate.id) },
      { ...body, voteId: master.votes[50000000008].candidates[0].id }, { ...body, voteCount: 0 },
      { ...body, voteCount: -1 }, { ...body, voteCount: 0.5 }, { ...body, voteCount: '2' },
      { ...body, voteCount: 1000000000 }, { ...body, voteCount: Number.MAX_SAFE_INTEGER + 1 }]) {
      assert.equal((await send(value)).status, 400);
      assert.deepEqual(snapshot(), before);
    }
    for (const at of [event.startAt - 1, event.endAt]) {
      now = at;
      assert.equal((await vote()).status, 400);
      assert.deepEqual(snapshot(), before, 'Original voting window is start-inclusive and end-exclusive');
    }
    now = event.startAt;
    for (const changes of [{ userId: 2 }, { count: -1 }, { count: 7.5 }, { count: '7' },
      { count: 999999998 }, { count: 999999999 }, { count: 1000000000 }]) {
      put('UserVoteInfo', [{ ...info(), ...changes }]); before = snapshot();
      assert.equal((await vote()).status, [999999998,999999999].includes(changes.count) ? 400 : 503);
      assert.deepEqual(snapshot(), before, 'Invalid or saturated participation cannot be queued');
    }
    put('UserVoteInfo', [info()]);
    for (const changes of [{ userId: 2 }, { amount: 1 }, { amount: -1 }, { amount: 10.5 },
      { amount: '10' }, { amount: 1000000000 }, { cumulativeAmount: -1 },
      { cumulativeAmount: 20.5 }, { cumulativeAmount: 1000000000 }]) {
      put('UserVoteItem', [{ ...ticket(), ...changes }]); before = snapshot();
      assert.equal((await vote()).status, 400);
      assert.deepEqual(snapshot(), before);
    }
    put('UserVoteItem', [ticket()]); before = snapshot();
    for (const table of ['operation_queue', 'vote_request', 'vote_transport', 'reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_vote BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'vote failure'); END`);
      assert.equal((await vote()).status, 503);
      assert.deepEqual(snapshot(), before, 'Tally, spend receipt, queue and reply must commit together');
      app.store.db.exec('DROP TRIGGER fail_vote');
    }
    const baselineProfiles = profiles();
    const first = await vote(), firstSequence = sequence, result = parse(first), operation = result.operations[0];
    assert.equal(result.rank, 1);
    assert.equal(result.count, 2, 'Selected-candidate local tally is not the player event-wide count');
    assert.equal(operation.type, 17000);
    assert.deepEqual(operation.parameters, { consumedItem: { itemId: event.voteItemId, amount: 2 }, electionId });
    assert.deepEqual(result.operation, { ...operation, parameters: { ...operation.parameters, rank: 1, count: 2 } },
      'Original hot callback requires rank/count in processed parameters, not merely root display JSON');
    assert.deepEqual(app.store.operations(), [operation], 'Hot callback fields do not alter the signed cold queue');
    assert.deepEqual(profiles(), baselineProfiles, 'Native operation owns ticket spend and participation; no server double-application');
    assert.deepEqual(parse(await vote()), result, 'Identical pending request reuses its operation and candidate tally');
    before = snapshot();
    assert.equal((await vote({ voteId: other.id })).status, 400);
    assert.equal((await vote({ voteCount: 1 })).status, 400);
    assert.deepEqual(snapshot(), before, 'Only one unacknowledged vote is allowed');
    await close(); await open();
    assert.deepEqual((await request(port, firstSequence, body, String(firstSequence), 'election/vote')).body, first.body);
    assert.deepEqual(parse(await vote()), result);
    before = snapshot();
    for (const putItems of [{}, { UserVoteInfo: [info(9)] }, { UserVoteItem: [ticket(8)] },
      { UserVoteInfo: [info(9)], UserVoteItem: [ticket()] },
      { UserVoteInfo: [info(7)], UserVoteItem: [ticket(8)] },
      { UserVoteInfo: [{ ...info(9), userId: 2 }], UserVoteItem: [ticket(8)] }]) {
      assert.equal((await push([operation], putItems)).status, 400);
      assert.deepEqual(snapshot(), before, 'ACK must prove both participation and ticket expenditure');
    }
    assert.equal((await push([operation], { UserVoteInfo: [info(9)] },
      { UserVoteItem: [{ voteItemId: event.voteItemId }] })).status, 400);
    assert.deepEqual(snapshot(), before);
    const originalPull = await send({ tables: ['UserVoteInfo','UserVoteItem'] }, 'user_data/pull'), pullSequence = sequence;
    assert.equal(originalPull.status, 200);
    for (const table of ['vote_request','reply_cache']) {
      const mode = table === 'vote_request' ? 'UPDATE' : 'INSERT';
      app.store.db.exec(`CREATE TRIGGER fail_vote_effect BEFORE ${mode} ON ${table} BEGIN SELECT RAISE(ABORT,'vote effect failure'); END`);
      before = snapshot();
      const failed = await push([], { UserVoteInfo: [info(9)] });
      assert.equal(failed.status, 503); assert.equal(failed.body.length, 0);
      assert.deepEqual(snapshot(), before, 'Native count, effect marker, sequence and exact reply share one transaction');
      app.store.db.exec('DROP TRIGGER fail_vote_effect');
    }
    app.store.db.prepare('UPDATE vote_request SET saved_cumulative=20 WHERE operation_id=?').run(operation.id);
    await unavailable(vote());
    await unavailable(send({tables:['UserVoteItem']},'user_data/pull'));
    app.store.db.prepare('UPDATE vote_request SET saved_cumulative=NULL WHERE operation_id=?').run(operation.id);
    app.store.db.prepare('UPDATE vote_request SET effect_seen=NULL WHERE operation_id=?').run(operation.id);
    await unavailable(vote());
    assert.deepEqual(app.store.operations(), [operation], 'Unknown legacy observations cannot be backfilled or discarded');
    app.store.db.prepare('UPDATE vote_request SET effect_seen=0 WHERE operation_id=?').run(operation.id);
    const partial = parse(await push([], { UserVoteInfo: [info(9)] }));
    assert.deepEqual(partial.operations, []); assert.equal(partial.operation, undefined);
    assert.equal(app.store.db.prepare('SELECT effect_seen FROM vote_request WHERE operation_id=?').get(operation.id).effect_seen, 1);
    assert.deepEqual(app.store.read('UserVoteItem').data, [ticket()]);
    await unavailable(vote());
    await unavailable(request(port, firstSequence, body, String(firstSequence), 'election/vote'));
    await unavailable(send(undefined, 'user_data/confirm'));
    await unavailable(send({ tables: ['UserVoteInfo','UserVoteItem'] }, 'user_data/pull'));
    await unavailable(request(port, pullSequence, { tables: ['UserVoteInfo','UserVoteItem'] }, String(pullSequence), 'user_data/pull'));
    before = snapshot(); assert.equal((await push([operation])).status, 400); assert.deepEqual(snapshot(), before);
    await close(); await open();
    await unavailable(send(undefined, 'user_data/confirm'));
    // Four tickets gained after the vote make remaining stock greater than the
    // original stock. Acquisition-minus-stock still proves two tickets spent.
    const saved = parse(await push([], { UserVoteInfo: [info(9)], UserVoteItem: [ticket(12, 24)] }));
    assert.deepEqual(saved.operations, []); assert.equal(saved.operation, undefined);
    assert.deepEqual(app.store.operations(), [operation]);
    await close(); await open();
    before = snapshot();
    app.store.db.exec("CREATE TRIGGER fail_vote_ack BEFORE DELETE ON operation_queue BEGIN SELECT RAISE(ABORT,'vote ACK failure'); END");
    assert.equal((await push([operation])).status, 503);
    assert.deepEqual(snapshot(), before);
    app.store.db.exec('DROP TRIGGER fail_vote_ack');
    app.store.db.exec(`CREATE TRIGGER fail_vote_acquisition BEFORE UPDATE OF saved_cumulative ON vote_request
      BEGIN SELECT RAISE(ABORT,'vote acquisition failure'); END`);
    before=snapshot();
    assert.equal((await push([operation])).status,503);
    assert.deepEqual(snapshot(),before,'Saved acquisition, queue deletion, done identity, sequence and reply must roll back together');
    app.store.db.exec('DROP TRIGGER fail_vote_acquisition');
    parse(await push([operation]));
    parse(await push([operation]));
    assert.deepEqual(app.store.operations(), []);
    assert.equal(app.store.db.prepare('SELECT saved_cumulative FROM vote_request WHERE operation_id=?')
      .get(operation.id).saved_cumulative,24,'ACK captures actual saved acquisition, including intervening native grants');
    before=snapshot();
    assert.equal((await push([],{UserVoteItem:[ticket(12,23)]})).status,400);
    assert.equal((await push([],{}, {UserVoteItem:[{voteItemId:event.voteItemId}]})).status,400);
    assert.throws(()=>app.store.reservedItemAcquisition(event.voteItemId,23),error=>error.status===400);
    assert.deepEqual(snapshot(),before,'Ordinary native saves and new reward reservations cannot lose acknowledged ticket acquisition');
    // A NULL legacy capture retains its original baseline, not invented
    // post-save grants. These disposable fixtures are DEFERRED / NOT RUN.
    const acknowledgedStock=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserVoteItem'").get();
    app.store.db.prepare('UPDATE vote_request SET saved_cumulative=NULL WHERE operation_id=?').run(operation.id);
    put('UserVoteItem',[ticket(12,20)]);
    assert.deepEqual(app.store.read('UserVoteItem').data,[ticket(12,20)]);
    assert.equal(app.store.db.prepare('SELECT saved_cumulative FROM vote_request WHERE operation_id=?')
      .get(operation.id).saved_cumulative,null,'Cold guards must not backfill legacy ACK observations');
    app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserVoteItem'")
      .run(acknowledgedStock.data,acknowledgedStock.token);
    app.store.db.prepare('UPDATE vote_request SET saved_cumulative=24 WHERE operation_id=?').run(operation.id);
    await unavailable(request(port, firstSequence, body, String(firstSequence), 'election/vote'));
    app.store.db.prepare("DELETE FROM reply_cache WHERE action='election/vote'").run();
    await unavailable(request(port, firstSequence, body, String(firstSequence), 'election/vote'));
    const second = parse(await vote({ voteId: other.id, voteCount: 1 }));
    assert.equal(second.count, 1);
    assert.equal(second.rank, 2, 'Local candidate ranking uses actual accepted votes only');
    parse(await push(second.operations, { UserVoteInfo: [info(10)], UserVoteItem: [ticket(11, 24)] }));
    const third = parse(await vote());
    assert.equal(third.count, 4, 'A new vote after ACK is counted once; transport retry is not a new vote');
    assert.equal(third.rank, 1);
    parse(await push(third.operations, { UserVoteInfo: [info(12)], UserVoteItem: [ticket(9, 24)] }));
    await close(); await open();
    assert.deepEqual(app.store.read('UserVoteInfo').data, [info(12)]);
    assert.deepEqual(app.store.read('UserVoteItem').data, [ticket(9, 24)]);
    const acquisitionSql=`SELECT * FROM vote_request WHERE item_id=?
      ORDER BY COALESCE(saved_cumulative,cumulative_before) DESC,operation_id DESC LIMIT 129`;
    const acquisitionPlan=app.store.db.prepare(`EXPLAIN QUERY PLAN ${acquisitionSql}`).all(event.voteItemId);
    assert.ok(acquisitionPlan.some(row=>/SEARCH.*vote_request_acquisition/.test(row.detail)));
    assert.ok(acquisitionPlan.every(row=>!/TEMP B-TREE/.test(row.detail)));
    assert.equal(app.store.db.prepare(acquisitionSql).all(event.voteItemId)[0].saved_cumulative,24);
    // DEFERRED / NOT RUN: the same latest-row SQL must use the existing index,
    // preserve candidate totals, and reject lost/corrupt completed captures.
    const latestSql='SELECT * FROM vote_request WHERE election_id=? AND vote_id=? ORDER BY operation_id DESC LIMIT 1';
    const plan=app.store.db.prepare(`EXPLAIN QUERY PLAN ${latestSql}`).all(electionId,candidate.id);
    assert.ok(plan.some(row=>/SEARCH.*vote_request_candidate/.test(row.detail)));
    assert.ok(plan.every(row=>!/TEMP B-TREE/.test(row.detail)), 'Latest receipt needs no history sort or aggregate');
    const latest=app.store.db.prepare(latestSql).get(electionId,candidate.id);
    assert.equal(latest.operation_id,third.operations[0].id); assert.equal(latest.response_count,4);
    for (const [field,value] of [['response_count',1],['response_rank',0],['effect_seen',0],
      ['item_id',master.votes[50000000008].voteItemId]]) {
      app.store.db.prepare(`UPDATE vote_request SET ${field}=? WHERE operation_id=?`).run(value,latest.operation_id);
      await unavailable(vote());
      app.store.db.prepare(`UPDATE vote_request SET ${field}=? WHERE operation_id=?`).run(latest[field],latest.operation_id);
    }
    app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(latest.operation_id);
    await unavailable(vote());
    await unavailable(send(undefined,'user_data/confirm'));
    app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(latest.operation_id);
    app.store.db.prepare('UPDATE vote_request SET effect_seen=NULL WHERE operation_id=?').run(latest.operation_id);
    assert.equal(app.store.voteReceipt(third.operations[0],false).response_count,4,
      'Legacy acknowledged totals remain historical counts, not a redelivery permission');
    assert.throws(()=>app.store.voteReceipt(third.operations[0]),/captured receipt/);
    app.store.db.prepare('UPDATE vote_request SET effect_seen=? WHERE operation_id=?').run(latest.effect_seen,latest.operation_id);
    const floorSql=`SELECT * FROM vote_request WHERE election_id=? AND EXISTS
      (SELECT 1 FROM operation_done WHERE id=vote_request.operation_id)
      ORDER BY count_before+vote_count DESC,operation_id DESC LIMIT 1`;
    const floorPlan=app.store.db.prepare(`EXPLAIN QUERY PLAN ${floorSql}`).all(electionId);
    assert.ok(floorPlan.some(row=>/SEARCH.*vote_request_participation/.test(row.detail)));
    assert.ok(floorPlan.every(row=>!/TEMP B-TREE/.test(row.detail)));
    assert.equal(app.store.db.prepare(floorSql).get(electionId).operation_id,third.operations[0].id);
    // A nonmonotonic old capture is a reconciliation case, not permission
    // to replace the previously protected MAX with a lower newest receipt.
    const firstReceipt=app.store.db.prepare('SELECT count_before FROM vote_request WHERE operation_id=?').get(operation.id);
    app.store.db.prepare('UPDATE vote_request SET count_before=100 WHERE operation_id=?').run(operation.id);
    assert.equal(app.store.db.prepare(floorSql).get(electionId).operation_id,operation.id);
    await unavailable(send(undefined,'user_data/confirm'));
    app.store.db.prepare('UPDATE vote_request SET count_before=? WHERE operation_id=?').run(firstReceipt.count_before,operation.id);
    const coldConfirm=parse(await send(undefined,'user_data/confirm')), coldSequence=sequence;
    assert.deepEqual(coldConfirm.operations, []);
    assert.equal((await send({tables:['UserVoteItem']},'user_data/pull')).status,200);
    const stockPullSequence=sequence,rawStock=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserVoteItem'").get();
    for (const rows of [[],[ticket(9,23)],[{...ticket(9,24),userId:seed.userId+1}],
      [{...ticket(9,24),amount:'9'}],[ticket(9,24),ticket(9,24)],ticket(9,24)]) {
      app.store.db.prepare("UPDATE profile SET data=? WHERE name='UserVoteItem'").run(JSON.stringify(rows));
      assert.throws(()=>app.store.read('UserVoteItem'),error=>error.status===503);
      await unavailable(send(undefined,'user/login'));
      await unavailable(send(undefined,'user_data/confirm'));
      await unavailable(request(port,coldSequence,undefined,String(coldSequence),'user_data/confirm'));
      await unavailable(send({tables:['UserVoteItem']},'user_data/pull'));
      await unavailable(request(port,stockPullSequence,{tables:['UserVoteItem']},String(stockPullSequence),'user_data/pull'));
      app.store.db.prepare("UPDATE profile SET data=? WHERE name='UserVoteItem'").run(rawStock.data);
      assert.equal(app.store.read('UserVoteItem').token,rawStock.token);
    }
    const savedFloor=app.store.db.prepare('SELECT saved_cumulative FROM vote_request WHERE operation_id=?').get(latest.operation_id);
    app.store.db.prepare('UPDATE vote_request SET saved_cumulative=cumulative_before-1 WHERE operation_id=?').run(latest.operation_id);
    await unavailable(send(undefined,'user_data/confirm'));
    app.store.db.prepare('UPDATE vote_request SET saved_cumulative=? WHERE operation_id=?').run(savedFloor.saved_cumulative,latest.operation_id);
    const rawVoteInfo=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserVoteInfo'").get();
    for (const rows of [[],[info(11)],[{...info(12),userId:2}],[{...info(12),count:'12'}],
      [info(12),info(12)],info(12)]) {
      // Disposable corruption fixture leaves the old token unchanged. Never
      // normalize a lost acknowledged counter into a fresh/default account.
      app.store.db.prepare("UPDATE profile SET data=? WHERE name='UserVoteInfo'").run(JSON.stringify(rows));
      assert.throws(()=>app.store.read('UserVoteInfo'),error=>error.status===503);
      await unavailable(send(undefined,'user/login'));
      await unavailable(send(undefined,'user_data/confirm'));
      await unavailable(request(port,coldSequence,undefined,String(coldSequence),'user_data/confirm'));
      await unavailable(send({tables:['UserVoteInfo']},'user_data/pull'));
      app.store.db.prepare("UPDATE profile SET data=? WHERE name='UserVoteInfo'").run(rawVoteInfo.data);
      assert.equal(app.store.read('UserVoteInfo').token,rawVoteInfo.token);
    }
    before = snapshot();
    for (const row of [info(7), { ...info(12), defaultItemReceive: false }]) {
      assert.equal((await push([], { UserVoteInfo: [row] })).status, 400);
      assert.deepEqual(snapshot(), before, 'Completed participation and initial-ticket receipt survive stale saves');
    }
    assert.equal((await push([], {}, { UserVoteInfo: [{ voteInfoId: electionId }] })).status, 400);
    assert.deepEqual(snapshot(), before);
    now = event.endAt - 1;
    const pending = parse(await vote({ voteId: other.id, voteCount: 1 }));
    const pendingSequence = sequence;
    assert.equal(pending.count, 2);
    const activeConfirm = parse(await send(undefined, 'user_data/confirm')), confirmSequence = sequence;
    assert.deepEqual(activeConfirm.operations, pending.operations);
    const unrelatedSave = save([], { UserProfile: app.store.read('UserProfile').data });
    const activePush = parse(await send(unrelatedSave, 'user_data/push')), pushSequence = sequence;
    assert.deepEqual(activePush.operations, pending.operations);
    now = event.endAt;
    before = snapshot();
    assert.equal((await vote({ voteId: other.id, voteCount: 1 })).status, 400);
    assert.equal((await vote()).status, 400);
    assert.equal((await request(port, pendingSequence, { ...body, voteId: other.id, voteCount: 1 },
      String(pendingSequence), 'election/vote')).status, 400, 'Cached response cannot replay an operation after native eligibility expires');
    assert.deepEqual(snapshot(), before, 'Expired unacknowledged vote remains durable, not falsely replayable or deleted');
    assert.deepEqual(app.store.operations(), pending.operations);
    assert.deepEqual(parse(await send(undefined, 'user_data/confirm')).operations, []);
    assert.deepEqual(parse(await send(unrelatedSave, 'user_data/push')).operations, []);
    await unavailable(request(port, confirmSequence, undefined, String(confirmSequence), 'user_data/confirm'));
    await unavailable(request(port, pushSequence, unrelatedSave, String(pushSequence), 'user_data/push'));
    assert.deepEqual(app.store.operations(), pending.operations, 'Response filtering must not delete the pending operation');
    assert.deepEqual(app.store.read('UserVoteInfo').data, [info(12)]);
    assert.deepEqual(app.store.read('UserVoteItem').data, [ticket(9, 24)]);
    // Restoring this isolated test clock is not an implemented archive calendar.
    now = event.endAt - 1;
    assert.deepEqual(parse(await vote({ voteId: other.id, voteCount: 1 })), pending);
    parse(await push([], { UserVoteInfo: [info(13)], UserVoteItem: [ticket(8, 24)] }));
    now = event.endAt;
    parse(await push(pending.operations));
    assert.deepEqual(app.store.operations(), [], 'A delayed ACK of already saved application remains valid after expiry');

    // Counter saturation is tested in its own disposable profile, not by
    // manufacturing hundreds of millions of historical candidate votes.
    await close();
    now = event.startAt;
    const cappedDatabase = path.join(directory, 'cap.sqlite');
    await open(master, cappedDatabase);
    put('UserVoteInfo', [info(999999997)]);
    put('UserVoteItem', [ticket(999999999, 999999999)]);
    const capped = parse(await vote());
    assert.equal(capped.count, 2);
    before = snapshot();
    assert.equal((await push(capped.operations, {
      UserVoteInfo: [info(999999999)], UserVoteItem: [ticket(999999999, 999999999)],
    })).status, 400, 'Saturated acquisition plus a later grant cannot falsely prove expenditure');
    assert.deepEqual(snapshot(), before);
    parse(await push(capped.operations, {
      UserVoteInfo: [info(999999999)], UserVoteItem: [ticket(999999997, 999999999)],
    }));
    before = snapshot();
    assert.equal((await vote({ voteCount: 1 })).status, 400);
    assert.deepEqual(snapshot(), before, 'Cannot issue a vote whose participation increment would disappear at the cap');
    await close(); await open(master, cappedDatabase);
    assert.deepEqual(app.store.read('UserVoteInfo').data, [info(999999999)]);
    assert.deepEqual(app.store.read('UserVoteItem').data, [ticket(999999997, 999999999)],
      'A spend does not require an increment of already saturated cumulative acquisition');

    await close(); await open(master, path.join(directory, 'ticket-first.sqlite'));
    put('UserVoteInfo', [info()]); put('UserVoteItem', [ticket()]);
    const ticketFirst = parse(await vote()), ticketFirstSequence = sequence;
    const ticketSave = parse(await push([], { UserVoteItem: [ticket(8)] }));
    assert.deepEqual(ticketSave.operations, []); assert.deepEqual(app.store.operations(), ticketFirst.operations);
    // Later funding restores the original amount but cannot erase saved cost observation.
    parse(await push([], { UserVoteItem: [ticket(10, 22)] }));
    await close(); await open(master, path.join(directory, 'ticket-first.sqlite'));
    await unavailable(request(port, ticketFirstSequence, body, String(ticketFirstSequence), 'election/vote'));
    await unavailable(send(undefined, 'user_data/confirm'));
    before = snapshot(); assert.equal((await push(ticketFirst.operations)).status, 400); assert.deepEqual(snapshot(), before);
    parse(await push(ticketFirst.operations, { UserVoteInfo: [info(9)] }));
    assert.deepEqual(app.store.operations(), []);
    await unavailable(request(port, ticketFirstSequence, body, String(ticketFirstSequence), 'election/vote'));

    // Synthetic overlapping windows exercise the native first-active rule.
    // Only fixture dates differ; archive files and production master are untouched.
    await close();
    const earlierId = 50000000008, earlier = master.votes[earlierId];
    const overlapping = { ...master, votes: {
      [earlierId]: { ...earlier, startAt: event.startAt, endAt: event.endAt },
      [electionId]: event,
    } };
    await open(overlapping, path.join(directory, 'overlap.sqlite'));
    const earlierInfo = { ...info(0), voteInfoId: earlierId };
    const earlierTicket = { ...ticket(), voteItemId: earlier.voteItemId };
    put('UserVoteInfo', [info(0), earlierInfo]);
    put('UserVoteItem', [ticket(), earlierTicket]);
    before = snapshot();
    assert.equal((await vote()).status, 400, 'An individually active event is still ineligible when another event is first');
    assert.deepEqual(snapshot(), before);
    const chosen = parse(await vote({ electionId: earlierId, voteId: earlier.candidates[0].id, voteCount: 1 }));
    assert.equal(chosen.count, 1);
    assert.equal(chosen.operations[0].parameters.electionId, earlierId);
    parse(await push(chosen.operations, {
      UserVoteInfo: [info(0), { ...earlierInfo, count: 1 }],
      UserVoteItem: [ticket(), { ...earlierTicket, amount: 9 }],
    }));
    assert.deepEqual(app.store.operations(), []);

    // First-open flag floor vectors are DEFERRED / NOT RUN. The flag is
    // observed independently; it is NOT evidence that native tickets arrived.
    await close();
    const flagDatabase=path.join(directory,'default-flags.sqlite');
    await open(master,flagDatabase);
    const received=Object.keys(master.votes).map(Number).sort((a,b)=>a-b).map(voteInfoId=>({
      userId:seed.userId,voteInfoId,defaultItemReceive:true,count:0}));
    put('UserVoteInfo',[]);put('UserVoteItem',[]);
    assert.deepEqual(app.store.db.prepare('SELECT * FROM vote_default_flag').all(),[],
      'Opening an old profile must not invent first-open receipts or grants');
    before=snapshot();
    const wrongTrigger=save([],{UserVoteInfo:received});wrongTrigger.deltas[0].trigger='PartyChange';
    assert.equal((await send(wrongTrigger,'user_data/push')).status,400);
    assert.deepEqual(snapshot(),before);
    for(const table of ['vote_default_flag','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_default_flag BEFORE INSERT ON ${table}
        BEGIN SELECT RAISE(ABORT,'default flag failure'); END`);
      before=snapshot();
      const failed=await push([],{UserVoteInfo:received});
      assert.equal(failed.status,503);assert.equal(failed.body.length,0);
      assert.deepEqual(snapshot(),before,'Flag, private observation, sequence and reply must roll back together');
      app.store.db.exec('DROP TRIGGER fail_default_flag');
    }
    parse(await push([],{UserVoteInfo:received}));
    assert.deepEqual(app.store.db.prepare('SELECT * FROM vote_default_flag ORDER BY election_id').all(),
      received.map(row=>({election_id:row.voteInfoId,user_id:seed.userId})));
    assert.deepEqual(app.store.read('UserVoteItem').data,[],'A flag save must never mint first-open tickets');
    assert.deepEqual(app.store.operations(),[],'Native first-open logic has no server reward or fake ACK');
    before=snapshot();
    assert.equal((await push([],{UserVoteInfo:[{...received[0],defaultItemReceive:false}]})).status,400);
    assert.equal((await push([],{}, {UserVoteInfo:[{voteInfoId:received[0].voteInfoId}]})).status,400);
    assert.equal((await push([],{UserVoteInfo:[{...received[0],voteInfoId:1}]})).status,400);
    assert.deepEqual(snapshot(),before);
    const cachedConfirm=await send(undefined,'user_data/confirm'),confirmSequence=sequence;
    parse(cachedConfirm);
    assert.equal((await send({tables:['UserVoteInfo']},'user_data/pull')).status,200);
    const flagPullSequence=sequence,rawFlags=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserVoteInfo'").get();
    for(const rows of [received.slice(1),received.map((row,i)=>i ? row : {...row,defaultItemReceive:false}),
      received.map((row,i)=>i ? row : {...row,userId:seed.userId+1})]) {
      app.store.db.prepare("UPDATE profile SET data=? WHERE name='UserVoteInfo'").run(JSON.stringify(rows));
      assert.throws(()=>app.store.read('UserVoteInfo'),error=>error.status===503);
      await unavailable(send({},'user/login'));
      await unavailable(send(undefined,'user_data/confirm'));
      await unavailable(request(port,confirmSequence,undefined,String(confirmSequence),'user_data/confirm'));
      await unavailable(send({tables:['UserVoteInfo']},'user_data/pull'));
      await unavailable(request(port,flagPullSequence,{tables:['UserVoteInfo']},String(flagPullSequence),'user_data/pull'));
      app.store.db.prepare("UPDATE profile SET data=? WHERE name='UserVoteInfo'").run(rawFlags.data);
      assert.equal(app.store.read('UserVoteInfo').token,rawFlags.token);
    }
    app.store.db.prepare('UPDATE vote_default_flag SET user_id=? WHERE election_id=?')
      .run(seed.userId+1,received[0].voteInfoId);
    await unavailable(send(undefined,'user_data/confirm'));
    app.store.db.prepare('UPDATE vote_default_flag SET user_id=? WHERE election_id=?')
      .run(seed.userId,received[0].voteInfoId);
    app.store.db.prepare('INSERT INTO vote_default_flag(election_id,user_id) VALUES(?,?)').run(1,seed.userId);
    await unavailable(send(undefined,'user_data/confirm'));
    app.store.db.prepare('DELETE FROM vote_default_flag WHERE election_id=1').run();
    await close();now=event.endAt;
    await open(master,flagDatabase);
    parse(await send(undefined,'user_data/confirm'));
    assert.deepEqual(app.store.read('UserVoteInfo').data,received,'Clock expiry and restart cannot clear first-open flags');
    assert.deepEqual(app.store.read('UserVoteItem').data,[]);
    //First-open token/checkpoint vectors are DEFERRED / NOT RUN. Verifiers are
    //opaque fixtures, not a native hash or publisher-entitlement acceptance.
    for(const mode of ['together','token-first','item-first','flag-first','intervening','capped']) {
      await close();now=event.startAt;
      const filename=path.join(directory,`first-open-${mode}.sqlite`);await open(master,filename);
      put('UserVoteInfo',[{...info(0),defaultItemReceive:false}]);put('UserVoteItem',[]);
      if(mode==='capped') put('UserVoteItem',[ticket(0,999999999)]);
      const token=app.store.read('UserItemToken').data[0],native={...token,consumer:150000,
        value:event.voteItemId,context:'',verifier:'fixture-native-first-open'},quantity=event.defaultItemAmount,
        gained={...ticket(quantity,mode==='capped' ? 999999999 : quantity),signature:token.signature};
      const receipt=()=>app.store.db.prepare('SELECT * FROM vote_default_grant WHERE election_id=?').get(electionId),
        tokenSave=save([],{}, {UserItemToken:[native]}),itemSave=save([],{UserVoteItem:[gained]}),
        flagSave=save([],{UserVoteInfo:[info(0)]}),combined=save([],{UserVoteInfo:[info(0)],UserVoteItem:[gained]},
          {UserItemToken:[native]});
      const wallet={paid:app.store.paidCurrency(),free:app.store.hardCurrency()};
      if(mode==='together' || mode==='capped') {
        const secondToken=app.store.read('UserItemToken').data[1];
        await unavailable(push([],{UserVoteInfo:[info(0)],UserVoteItem:[gained]},
          {UserItemToken:[native,{...native,signature:secondToken.signature}]}));
        for(const table of ['vote_default_grant','item_token_used','reply_cache']) {
          app.store.db.exec(`CREATE TRIGGER fail_first_open BEFORE INSERT ON ${table}
            BEGIN SELECT RAISE(ABORT,'first-open failure'); END`);
          before=snapshot();const failed=await send(combined,'user_data/push');
          assert.equal(failed.status,503);assert.equal(failed.body.length,0);assert.deepEqual(snapshot(),before);
          app.store.db.exec('DROP TRIGGER fail_first_open');
        }
        parse(await send(combined,'user_data/push'));
      } else if(mode==='item-first') {
        parse(await send(itemSave,'user_data/push'));assert.equal(receipt(),undefined);
        parse(await send(flagSave,'user_data/push'));assert.equal(receipt(),undefined);
        parse(await send(tokenSave,'user_data/push'));
      } else {
        if(mode==='flag-first') {
          parse(await send(flagSave,'user_data/push'));
          assert.equal(receipt(),undefined);assert.deepEqual(app.store.read('UserVoteItem').data,[]);
        }
        parse(await send(tokenSave,'user_data/push'));
        assert.equal(receipt().saved_cumulative,null,'A consumed token cannot credit tickets without the native checkpoint');
        assert.deepEqual(app.store.read('UserVoteItem').data,[]);
        await close();now=event.endAt;await open(master,filename);
        assert.equal(receipt().saved_cumulative,null,'Restart/clock expiry must not fabricate a pending acquisition');
        if(mode==='intervening') {
          parse(await push([],{UserVoteItem:[ticket(2,2)]}));
          assert.equal(receipt().saved_cumulative,null,'An unrelated signature is not first-open grant evidence');
          gained.amount+=2;gained.cumulativeAmount+=2;itemSave.deltas[0].putItems.UserVoteItem[0]=gained;
        }
        if(mode==='token-first') {
          app.store.db.exec(`CREATE TRIGGER fail_first_open_update BEFORE UPDATE ON vote_default_grant
            BEGIN SELECT RAISE(ABORT,'first-open update failure'); END`);
          before=snapshot();const failed=await send(itemSave,'user_data/push');
          assert.equal(failed.status,503);assert.equal(failed.body.length,0);assert.deepEqual(snapshot(),before);
          app.store.db.exec('DROP TRIGGER fail_first_open_update');
        }
        parse(await send(itemSave,'user_data/push'));parse(await send(flagSave,'user_data/push'));
      }
      assert.deepEqual(receipt(),{election_id:electionId,item_id:event.voteItemId,token_signature:token.signature,
        quantity,cumulative_before:mode==='item-first' ? null : mode==='capped' ? 999999999 : 0,
        saved_cumulative:gained.cumulativeAmount});
      assert.deepEqual({paid:app.store.paidCurrency(),free:app.store.hardCurrency()},wallet,
        'Native first-open saves must not synthesize Iris wallet changes');
      assert.deepEqual(app.store.operations(),[],'First-open tickets must not receive a fabricated award operation or ACK');
      const echo=await send(flagSave,'user_data/push'),echoSequence=sequence;parse(echo);before=snapshot();
      const retry=await request(port,echoSequence,flagSave,String(echoSequence),'user_data/push');
      assert.equal(retry.status,200);assert.deepEqual(retry.body,echo.body);assert.deepEqual(snapshot(),before);
      const next=app.store.read('UserItemToken').data[0];
      await unavailable(push([],{}, {UserItemToken:[{...native,signature:next.signature}]}));
      await unavailable(push([],{}, {UserItemToken:[native]}));
      //254f134 ignores a zero cost signature; spending must retain the actual
      //acquisition nonce.254f414 is a no-op: the constructor's book byte stays1.
      const spent={...gained,amount:0};parse(await push([],{UserVoteItem:[spent]}));
      assert.equal(app.store.read('UserVoteItem').data[0].signature,token.signature);
      assert.equal(app.store.read('UserVoteItem').data[0].bookEntryState,1);
      assert.equal(receipt().saved_cumulative,gained.cumulativeAmount,'Later spending retains the actual first-open acquisition');
      before=snapshot();
      assert.equal((await push([],{UserVoteItem:[{...spent,cumulativeAmount:gained.cumulativeAmount-1}]})).status,400);
      assert.equal((await push([],{}, {UserVoteItem:[{voteItemId:event.voteItemId}]})).status,400);
      assert.deepEqual(snapshot(),before);
      const raw=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserVoteItem'").get();
      assert.equal((await send({tables:['UserVoteItem']},'user_data/pull')).status,200);const grantPullSequence=sequence;
      app.store.db.prepare("UPDATE profile SET data='[]' WHERE name='UserVoteItem'").run();
      assert.throws(()=>app.store.read('UserVoteItem'),error=>error.status===503);
      await unavailable(send(undefined,'user_data/confirm'));await unavailable(send({},'user/login'));
      await unavailable(send({tables:['UserVoteItem']},'user_data/pull'));
      await unavailable(request(port,grantPullSequence,{tables:['UserVoteItem']},String(grantPullSequence),'user_data/pull'));
      app.store.db.prepare("UPDATE profile SET data=? WHERE name='UserVoteItem'").run(raw.data);
      const used=app.store.db.prepare('SELECT native_delete FROM item_token_used WHERE signature=?').get(token.signature);
      for(const changed of [{value:0},{consumer:0},{context:'wrong'},{userId:seed.userId+1},{signature:next.signature}]) {
        app.store.db.prepare('UPDATE item_token_used SET native_delete=? WHERE signature=?')
          .run(JSON.stringify({...native,...changed}),token.signature);
        assert.throws(()=>app.store.read('UserVoteItem'),error=>error.status===503);
        await unavailable(send(undefined,'user_data/confirm'));
        app.store.db.prepare('UPDATE item_token_used SET native_delete=? WHERE signature=?').run(used.native_delete,token.signature);
      }
      app.store.db.prepare('UPDATE vote_default_grant SET quantity=quantity+1 WHERE election_id=?').run(electionId);
      await unavailable(send(undefined,'user_data/confirm'));
      app.store.db.prepare('UPDATE vote_default_grant SET quantity=? WHERE election_id=?').run(quantity,electionId);
      await close();await open(master,filename);
      assert.deepEqual(app.store.read('UserVoteItem').data,[spent]);assert.equal(receipt().saved_cumulative,gained.cumulativeAmount);
      assert.equal(app.store.read('UserVoteItem').token,raw.token);
    }
    console.log('Voting: original windows, local candidate totals, spend/participation ACK, retries, rollback and restart OK; native calendar/playability unverified');
  } finally {
    Date.now = realNow;
    await close();
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('danmemore-votes-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
