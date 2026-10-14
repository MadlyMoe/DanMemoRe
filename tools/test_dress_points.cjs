'use strict';

// DEFERRED / NOT RUN: synthetic saves and funding are not native eligibility,
// initialization, callback/signature/order or UI/no-crash acceptance.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-outfit-'));
  let database = path.join(directory, 'profile.sqlite'), app, port, sequence = 0;
  const open = async () => {
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => {
    if (app?.server.listening) await new Promise(resolve => app.server.close(resolve));
    app?.store.close(); app = null;
  };
  const claim = value => request(port, ++sequence, value, '66', 'dress_point/complete');
  const unavailable=async pending=>{const response=await pending;assert.equal(response.status,503,response.body.toString());};
  const snapshot = () => ({ profiles: app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),
    iris: app.store.hardCurrency(), operations: app.store.operations(),
    rewards: app.store.db.prepare('SELECT * FROM dress_point_reward ORDER BY pc_id,level_id').all(),
    requests: app.store.db.prepare('SELECT * FROM dress_point_request ORDER BY operation_id').all(),
    irisTransactions:app.store.db.prepare('SELECT * FROM iris_transaction ORDER BY id').all(),
    pointFloors: app.store.db.prepare('SELECT * FROM dress_point_floor ORDER BY pc_id').all(),
    pointProgress: app.store.db.prepare('SELECT * FROM dress_point_progress ORDER BY pc_id').all(),
    done: app.store.db.prepare('SELECT * FROM operation_done ORDER BY id').all() });
  // Synthetic client deltas exercise server persistence, not native UI behavior.
  const save = (putItems = {}, operations = []) => ({ badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: Object.fromEntries(Object.entries(putItems).map(([name, rows]) =>
      [name, crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex')])) },
    deltas: Object.keys(putItems).length ? [{ signature: 0, trigger: 'CostumeRefineLevelUp', deleteItems: {}, putItems }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })) });
  const pc1 = seed.data.UserPC[0], pc2 = { ...pc1, pcId: 1011002001 };
  const state = (pcId, befDpLv, aftDpLv) => ({ pcId,befDpLv,aftDpLv });
  const readPc = id => app.store.read('UserPC').data.find(row => row.pcId === id);
  const item = (amount,cumulativeAmount=Math.max(5,amount)) => ({ userId: seed.userId, dpItemId: 219000001,
    amount,cumulativeAmount,signature:0 });
  try {
    await open();
    app.store.push(save({ UserPC: [pc2] }));
    const empty = snapshot();
    const firstBody = { dpStates: [state(pc1.pcId,1,3),state(pc2.pcId,1,2)] };
    assert.equal((await claim(firstBody)).status, 400, 'No earned participation means no upgrade');
    assert.deepEqual(snapshot(), empty);
    app.store.push(save({ UserPC: [{ ...pc1, battlePlayCount: 100 }, { ...pc2, battlePlayCount: 50 }] }));
    const before = snapshot();
    for (const value of [null, {}, { dpStates: [] }, { dpStates: [null] },
      { dpStates: [state(pc1.pcId,1,1)] }, { dpStates: [state(pc1.pcId,1,31)] },
      { dpStates: [state(pc1.pcId,2,3)] }, { dpStates: [state(pc1.pcId,1,4)] },
      { dpStates: [state(1,1,2)] }, { dpStates: [state(String(pc1.pcId),1,3)] },
      { dpStates: [state(pc1.pcId,1,3),state(pc1.pcId,1,3)] },
      { ...firstBody, extra: 1 }, { ...firstBody, itemId: 219000001 },
      { ...firstBody, itemId: 219000001, itemAmount: 1 }]) {
      assert.equal((await claim(value)).status, 400);
      assert.deepEqual(snapshot(), before, 'Malformed/refused requests cannot mutate points, claims or Iris');
    }
    for (const [event, table] of [['INSERT','dress_point_reward'],['UPDATE','profile'],['INSERT','dress_point_progress'],['UPDATE','hard_currency'],
      ['INSERT','iris_transaction'],['INSERT','operation_queue'],['INSERT','dress_point_request'],['INSERT','dress_point_completion_request']]) {
      app.store.db.exec(`CREATE TRIGGER fail_outfit BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'outfit failure'); END`);
      assert.equal((await claim(firstBody)).status, 503);
      assert.deepEqual(snapshot(), before, 'Every state write belongs to the same transaction');
      app.store.db.exec('DROP TRIGGER fail_outfit');
    }
    const first = await claim(firstBody);
    const firstSequence=sequence;
    assert.equal(first.status, 200);
    const result = JSON.parse(first.body), award = result.operations[0];
    assert.equal(award.type, 29000);
    assert.equal(result.issueAmount, 6);
    assert.equal(result.operations.length, 1);
    assert.deepEqual(award.parameters, { ...firstBody, issueAmount: 6 });
    assert.deepEqual(readPc(pc1.pcId), { ...pc1, currentDP: 100 });
    assert.deepEqual(readPc(pc2.pcId), { ...pc2, currentDP: 50 });
    const awarded = snapshot();
    assert.equal(awarded.rewards.length, 3, 'Identical level IDs are independent for different outfits');
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`66/${firstSequence}`);
    assert.deepEqual(JSON.parse((await request(port,firstSequence,firstBody,'66','dress_point/complete')).body),result,
      'The exact pending request survives reply-cache eviction without another reward');
    assert.deepEqual(JSON.parse((await claim(firstBody)).body), result);
    assert.deepEqual(JSON.parse((await claim({ dpStates: [...firstBody.dpStates].reverse()
      .map(row => Object.fromEntries(Object.entries(row).reverse())) })).body), result);
    assert.equal((await claim({ dpStates: [state(pc1.pcId,3,4)] })).status, 400, 'Overlapping pending upgrades reject');
    assert.deepEqual(snapshot(), awarded);
    await close(); await open();
    assert.deepEqual(snapshot(), awarded, 'The upgrade survives without executing its original UI callback');
    assert.deepEqual(JSON.parse((await claim(firstBody)).body), result);
    assert.throws(() => app.store.push(save({ UserPC: [pc1] }, [award])), /discard its saved points/);
    assert.deepEqual(snapshot(), awarded);
    // A cold client already pulled the updated points. The native operation
    // has no point setter, so it may acknowledge without a new UserPC delta.
    app.store.db.exec("CREATE TRIGGER fail_outfit_floor BEFORE INSERT ON dress_point_floor BEGIN SELECT RAISE(ABORT,'outfit floor failure'); END");
    assert.throws(()=>app.store.push(save({},[award])),/outfit floor failure/);
    assert.deepEqual(snapshot(),awarded,'ACK, done, queue and new point floors must roll back together');
    app.store.db.exec('DROP TRIGGER fail_outfit_floor');
    app.store.push(save({}, [award]));
    app.store.push(save({}, [award]));
    assert.equal(snapshot().requests.length, 1,'Battle-only point producer remains available to its completed floors');
    assert.deepEqual(snapshot().pointFloors.map(row=>[row.pc_id,row.current_dp,row.operation_id]),
      [[pc1.pcId,100,award.id],[pc2.pcId,50,award.id]].sort((a,b)=>a[0]-b[0]));
    const exactFirst=()=>request(port,firstSequence,firstBody,'66','dress_point/complete'),
      settledFirst={code:0,...award.parameters,operations:[]};
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`66/${firstSequence}`);
    assert.deepEqual(JSON.parse((await exactFirst()).body),settledFirst,
      'The exact acknowledged request returns popup data without another operation29000');
    const retainedRequest=app.store.db.prepare('SELECT operation_json,reward_json,iris_history_id FROM dress_point_request WHERE operation_id=?')
      .get(award.id);
    for(const [column,value] of [['operation_json',null],['operation_json','{}'],['reward_json',null],['reward_json','[]']]) {
      app.store.db.prepare(`UPDATE dress_point_request SET ${column}=? WHERE operation_id=?`).run(value,award.id);
      app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`66/${firstSequence}`);await unavailable(exactFirst());
      app.store.db.prepare(`UPDATE dress_point_request SET ${column}=? WHERE operation_id=?`)
        .run(retainedRequest[column],award.id);
    }
    app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(award.id);await unavailable(exactFirst());
    app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(award.id);
    app.store.db.prepare('INSERT INTO operation_queue(id,type,parameters,token,signature) VALUES(?,?,?,?,?)')
      .run(award.id,award.type,JSON.stringify(award.parameters),award.token,award.signature);
    await unavailable(exactFirst());app.store.db.prepare('DELETE FROM operation_queue WHERE id=?').run(award.id);
    const firstFloor=app.store.db.prepare('SELECT * FROM dress_point_floor WHERE operation_id=? ORDER BY pc_id LIMIT 1').get(award.id);
    app.store.db.prepare('DELETE FROM dress_point_floor WHERE pc_id=?').run(firstFloor.pc_id);await unavailable(exactFirst());
    app.store.db.prepare('INSERT INTO dress_point_floor(pc_id,current_dp,operation_id) VALUES(?,?,?)')
      .run(firstFloor.pc_id,firstFloor.current_dp,firstFloor.operation_id);
    const firstReward=JSON.parse(retainedRequest.reward_json)[0];
    app.store.db.prepare('DELETE FROM dress_point_reward WHERE pc_id=? AND level_id=?').run(...firstReward);
    await unavailable(exactFirst());
    app.store.db.prepare('INSERT INTO dress_point_reward(pc_id,level_id) VALUES(?,?)').run(...firstReward);
    const irisHistory=app.store.db.prepare('SELECT * FROM iris_transaction WHERE id=?').get(retainedRequest.iris_history_id);
    app.store.db.prepare('DELETE FROM iris_transaction WHERE id=?').run(retainedRequest.iris_history_id);await unavailable(exactFirst());
    app.store.db.prepare(`INSERT INTO iris_transaction(id,created_at,transaction_type,reason,free_before,paid_before,free_after,paid_after,purchase_key)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(irisHistory.id,irisHistory.created_at,irisHistory.transaction_type,irisHistory.reason,
        irisHistory.free_before,irisHistory.paid_before,irisHistory.free_after,irisHistory.paid_after,irisHistory.purchase_key);
    app.store.db.prepare('UPDATE iris_transaction SET free_before=-1,free_after=? WHERE id=?')
      .run(irisHistory.free_after-irisHistory.free_before-1,irisHistory.id);await unavailable(exactFirst());
    app.store.db.prepare('UPDATE iris_transaction SET free_before=?,free_after=? WHERE id=?')
      .run(irisHistory.free_before,irisHistory.free_after,irisHistory.id);
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`66/${firstSequence}`);
    const permanent=snapshot();assert.deepEqual(JSON.parse((await exactFirst()).body),settledFirst);assert.deepEqual(snapshot(),permanent,
      'Settled outfit replay does not change points, Iris, rewards or operation history');
    await close();await open();app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`66/${firstSequence}`);
    assert.deepEqual(JSON.parse((await exactFirst()).body),settledFirst,'Permanent outfit identity survives restart');
    assert.deepEqual(snapshot(),permanent);
    const done = snapshot();
    assert.equal((await claim(firstBody)).status, 400, 'Old levels cannot collect again after acknowledgement');
    assert.deepEqual(snapshot(), done);

    app.store.push(save({ UserPC: [{ ...readPc(pc1.pcId), battlePlayCount: 49 }], UserDpItem: [item(5)] }));
    const brushBody = { dpStates: [state(pc1.pcId,3,6)], itemId: 219000001, itemAmount: 2 };
    const pullBody={tables:['UserDpItem','UserPC']},oldPullSequence=++sequence;
    assert.equal((await request(port,oldPullSequence,pullBody,'66','user_data/pull')).status,200);
    const itemBefore = snapshot();
    for (const value of [{ ...brushBody, itemId: 1 }, { ...brushBody, itemAmount: 0 },
      { ...brushBody, itemAmount: -1 }, { ...brushBody, itemAmount: '2' },
      { ...brushBody, itemAmount: 6 }, { ...brushBody, itemAmount: 1.5 }]) {
      assert.equal((await claim(value)).status, 400);
      assert.deepEqual(snapshot(), itemBefore);
    }
    const brushResponse = await claim(brushBody);
    const brushSequence=sequence;
    assert.equal(brushResponse.status, 200);
    const brushResult = JSON.parse(brushResponse.body), brush = brushResult.operations[0];
    assert.equal(brushResult.issueAmount, 6);
    assert.equal(readPc(pc1.pcId).currentDP, 300, 'Brushes do not also spend pending battle participation');
    assert.equal(readPc(pc1.pcId).battlePlayCount, 49);
    assert.equal(app.store.read('UserDpItem').data[0].amount, 5, 'The client consumes stock through operation 29000');
    const brushPending = snapshot();
    assert.deepEqual(brushPending.requests.filter(row=>row.operation_id===brush.id).map(row => [row.item_id,row.remaining]), [[219000001,3]]);
    assert.throws(() => app.store.push(save({}, [brush])), /saved item consumption/);
    assert.throws(() => app.store.push(save({ UserDpItem: [item(4)] }, [brush])), /saved item consumption/);
    assert.throws(() => app.store.push(save({ UserDpItem: [item(null)] }, [brush])), /brush|saved item consumption/);
    assert.throws(() => app.store.push(save({ UserDpItem: [{ ...item(3), userId: 1 }] }, [brush])), /brush|saved item consumption/);
    assert.equal((await claim({ dpStates: [state(pc2.pcId,2,4)], itemId: 219000001, itemAmount: 1 })).status, 400,
      'Another unit cannot consume the same reserved brushes');
    assert.deepEqual(snapshot(), brushPending);
    app.store.db.exec("CREATE TRIGGER fail_outfit_ack BEFORE DELETE ON operation_queue BEGIN SELECT RAISE(ABORT,'outfit ack failure'); END");
    assert.throws(() => app.store.push(save({ UserDpItem: [item(3)] }, [brush])), /outfit ack failure/);
    assert.deepEqual(snapshot(), brushPending);
    app.store.db.exec('DROP TRIGGER fail_outfit_ack');
    app.store.db.exec("CREATE TRIGGER fail_outfit_checkpoint BEFORE UPDATE ON dress_point_request BEGIN SELECT RAISE(ABORT,'outfit checkpoint failure'); END");
    assert.throws(()=>app.store.push(save({UserDpItem:[item(3)]})),/outfit checkpoint failure/);
    assert.deepEqual(snapshot(),brushPending,'Standalone push must roll back profile and consumption checkpoint together');
    app.store.db.exec('DROP TRIGGER fail_outfit_checkpoint');
    app.store.push(save({ UserDpItem: [item(3)] }));
    assert.equal(app.store.dressPointReceipt(brush.id,brush).item_effect_saved,1);
    assert.equal(app.store.dressPointDelivery(brush,'user_data/push'),false,'Saved brush effect never redelivers in save replies');
    assert.throws(()=>app.store.dressPointDelivery(brush,'user_data/confirm'),/acknowledgement before redelivery/);
    assert.throws(()=>app.store.push(save({UserDpItem:[item(5)]})),/consumption|brush/);
    const consumed = snapshot();
    await close(); await open();
    assert.deepEqual(snapshot(), consumed);
    assert.equal((await claim(brushBody)).status,503,'A retry must not subtract the same saved brushes twice');
    // Synthetic later gift: stock may exceed the old remaining3, while
    // acquisition-minus-stock still proves the two consumed copies.
    app.store.push(save({UserDpItem:[item(5,7)]}));
    app.store.push(save({}, [brush]));
    const exactBrush=()=>request(port,brushSequence,brushBody,'66','dress_point/complete');
    app.store.db.prepare('DELETE FROM reply_cache WHERE key=?').run(`66/${brushSequence}`);
    assert.deepEqual(JSON.parse((await exactBrush()).body),{code:0,...brush.parameters,operations:[]},
      'The exact acknowledged brush request returns its popup without spending brushes twice');
    assert.equal(app.store.dressPointReceipt(brush.id).item_effect_saved,1,'Completed indexed brush proof is retained');
    assert.equal((await request(port,oldPullSequence,pullBody,'66','user_data/pull')).status,503,
      'Cached native tables cannot restore points or already-spent brushes');
    assert.throws(()=>app.store.push(save({UserDpItem:[item(7,7)]})),/consumption/);
    assert.throws(()=>app.store.push(save({UserDpItem:[item(3,5)]})),/consumption/);
    app.store.db.prepare('UPDATE dress_point_request SET item_effect_saved=0 WHERE operation_id=?').run(brush.id);
    assert.throws(()=>app.store.read('UserDpItem'),/receipt identity/);
    app.store.db.prepare('UPDATE dress_point_request SET item_effect_saved=1 WHERE operation_id=?').run(brush.id);
    const proof=app.store.db.prepare('SELECT consumed_json FROM dress_point_request WHERE operation_id=?').get(brush.id);
    app.store.db.prepare('UPDATE dress_point_request SET consumed_json=NULL WHERE operation_id=?').run(brush.id);
    assert.throws(()=>app.store.read('UserDpItem'),/receipt|baseline/);
    app.store.db.prepare('UPDATE dress_point_request SET consumed_json=? WHERE operation_id=?').run(proof.consumed_json,brush.id);
    const retained=app.store.db.prepare('SELECT data,token FROM profile WHERE name=?').get('UserDpItem');
    // Explicit raw disposable corruption, not a native zero-row cleanup.
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run('[]','bad-fixture','UserDpItem');
    assert.throws(()=>app.store.read('UserDpItem'),/reconciliation/);await close();await open();
    assert.equal((await request(port,++sequence,pullBody,'66','user_data/pull')).status,503);
    assert.equal(app.store.db.prepare('SELECT data FROM profile WHERE name=?').get('UserDpItem').data,'[]','Failed reads preserve damaged save');
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(retained.data,retained.token,'UserDpItem');
    assert.equal(app.store.hardCurrency(), 12);
    assert.equal((await claim(brushBody)).status, 400);
    const next = JSON.parse((await claim({ dpStates: [state(pc1.pcId,6,7)], itemId: 219000001, itemAmount: 1 })).body);
    assert.equal(next.issueAmount, 2);
    app.store.push(save({ UserDpItem: [item(4,7)] }, next.operations));
    assert.equal(readPc(pc1.pcId).battlePlayCount, 49);

    // Acknowledged points, not just the Iris deduplication ledger, survive.
    const settledPc={...readPc(pc1.pcId),battlePlayCount:50},cachedSaveBody=save({UserPC:[settledPc]}),
      cachedSaveSequence=++sequence;
    assert.equal((await request(port,cachedSaveSequence,cachedSaveBody,'66','user_data/push')).status,200);
    assert.deepEqual(readPc(pc1.pcId),settledPc,'The floor does not discard unrelated unit fields or later synthetic participation');
    const cachedConfirmSequence=++sequence,cachedPcPullSequence=++sequence;
    assert.equal((await request(port,cachedConfirmSequence,undefined,'66','user_data/confirm')).status,200);
    assert.equal((await request(port,cachedPcPullSequence,{tables:['UserPC']},'66','user_data/pull')).status,200);
    const settled=snapshot();
    for(const changed of [{...pc1,battlePlayCount:100},{...settledPc,currentDP:399},
      {...settledPc,currentDP:2000000001},{...settledPc,currentDP:'400'},
      {...settledPc,userId:1},{...settledPc,ownerType:3},{...settledPc,joiningState:0}]) {
      assert.throws(()=>app.store.push(save({UserPC:[changed]})),/outfit points/);
      assert.deepEqual(snapshot(),settled);
    }
    const deletion=save();deletion.deltas=[{signature:0,trigger:'CostumeRefineLevelUp',putItems:{},deleteItems:{UserPC:[{pcId:pc1.pcId}]}}];
    deletion.checksums.after.UserPC='0'.repeat(32);
    assert.throws(()=>app.store.push(deletion),/outfit points/);assert.deepEqual(snapshot(),settled);
    await close();await open();assert.deepEqual(snapshot(),settled);
    assert.throws(()=>app.store.push(save({UserPC:[pc1]})),/outfit points/);
    const pcProfile=app.store.db.prepare('SELECT data,token FROM profile WHERE name=?').get('UserPC'),
      pcRows=JSON.parse(pcProfile.data),floor=app.store.db.prepare('SELECT * FROM dress_point_floor WHERE pc_id=?').get(pc1.pcId);
    for(const broken of [pcRows.filter(row=>row.pcId!==pc1.pcId),[...pcRows,settledPc],
      pcRows.map(row=>row.pcId===pc1.pcId?{...row,currentDP:399}:row)]) {
      const raw=JSON.stringify(broken);app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(raw,pcProfile.token,'UserPC');
      assert.throws(()=>app.store.read('UserPC'),/outfit points/);
      assert.equal((await request(port,++sequence,{tables:['UserPC']},'66','user_data/pull')).status,503);
      assert.equal((await request(port,++sequence,undefined,'66','user_data/confirm')).status,503);
      assert.equal((await request(port,cachedSaveSequence,cachedSaveBody,'66','user_data/push')).status,503);
      assert.equal((await request(port,cachedConfirmSequence,undefined,'66','user_data/confirm')).status,503);
      assert.equal((await request(port,cachedPcPullSequence,{tables:['UserPC']},'66','user_data/pull')).status,503);
      assert.equal(app.store.db.prepare('SELECT data FROM profile WHERE name=?').get('UserPC').data,raw,'Failed cold reads do not auto-repair points');
    }
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(pcProfile.data,pcProfile.token,'UserPC');
    app.store.db.prepare('UPDATE dress_point_floor SET current_dp=current_dp-1 WHERE pc_id=?').run(pc1.pcId);
    assert.throws(()=>app.store.read('UserPC'),/point receipt/);
    app.store.db.prepare('UPDATE dress_point_floor SET current_dp=? WHERE pc_id=?').run(floor.current_dp,pc1.pcId);
    const producer=app.store.db.prepare('SELECT parameters FROM dress_point_request WHERE operation_id=?').get(floor.operation_id);
    app.store.db.prepare('UPDATE dress_point_request SET parameters=NULL WHERE operation_id=?').run(floor.operation_id);
    assert.throws(()=>app.store.read('UserPC'),/receipt|baseline/);
    app.store.db.prepare('UPDATE dress_point_request SET parameters=? WHERE operation_id=?').run(producer.parameters,floor.operation_id);
    assert.deepEqual(snapshot(),settled,'Corruption probes are explicitly restored only inside this disposable fixture');
    assert.equal((await claim({dpStates:[state(pc1.pcId,1,3)]})).status,400);
    assert.equal(app.store.hardCurrency(), 14);
    await close();database=path.join(directory,'participation.sqlite');await open();
    const coldPullSequence=++sequence,emptyPcPull={tables:['UserPC']};
    assert.equal((await request(port,coldPullSequence,emptyPcPull,'66','user_data/pull')).status,200);
    // Synthetic native-shaped earning/save:22e6260 adds participation only.
    // No server battle reward is fabricated, and no29000 is needed below Lv2.
    const earnedPc={...pc1,battlePlayCount:3};app.store.push(save({UserPC:[earnedPc]}));
    assert.deepEqual(snapshot().pointProgress,[{pc_id:pc1.pcId,current_dp:0,earned_total:3}]);
    assert.equal(snapshot().operations.length,0);assert.equal(app.store.hardCurrency(),0);
    assert.equal((await request(port,coldPullSequence,emptyPcPull,'66','user_data/pull')).status,503,
      'A pre-participation native pull cannot erase progress before any reward ledger exists');
    const earnedSnapshot=snapshot();
    for(const bad of [{...earnedPc,battlePlayCount:2},{...earnedPc,battlePlayCount:-1},
      {...earnedPc,battlePlayCount:'3'},{...earnedPc,battlePlayCount:2147483648}]) {
      assert.throws(()=>app.store.push(save({UserPC:[bad]})),/participation/);assert.deepEqual(snapshot(),earnedSnapshot);
    }
    app.store.db.exec("CREATE TRIGGER fail_participation BEFORE INSERT ON dress_point_progress BEGIN SELECT RAISE(ABORT,'participation failure'); END");
    assert.throws(()=>app.store.push(save({UserPC:[{...earnedPc,battlePlayCount:4}]})),/participation failure/);
    assert.deepEqual(snapshot(),earnedSnapshot,'Profile and progress checkpoint roll back together');
    app.store.db.exec('DROP TRIGGER fail_participation');
    //15ddd68 transfers all participation into absolute currentDP before its
    // level checks; a below-boundary conversion is a normal native save.
    const convertedPc={...pc1,currentDP:3};app.store.push(save({UserPC:[convertedPc]}));
    assert.deepEqual(snapshot().pointProgress,[{pc_id:pc1.pcId,current_dp:3,earned_total:3}]);
    const convertedSnapshot=snapshot();
    assert.throws(()=>app.store.push(save({UserPC:[earnedPc]})),/participation/);
    assert.throws(()=>app.store.push(save({UserPC:[pc1]})),/participation/);
    assert.deepEqual(snapshot(),convertedSnapshot);await close();await open();assert.deepEqual(snapshot(),convertedSnapshot);
    const participationProfile=app.store.db.prepare('SELECT data,token FROM profile WHERE name=?').get('UserPC');
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([pc1]),'UserPC');
    assert.throws(()=>app.store.read('UserPC'),/participation/);
    assert.equal((await request(port,++sequence,emptyPcPull,'66','user_data/pull')).status,503);
    assert.equal((await request(port,++sequence,undefined,'66','user_data/confirm')).status,503);
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(participationProfile.data,participationProfile.token,'UserPC');
    // Capped conversion may legitimately discard surplus, not awarded points.
    app.store.push(save({UserPC:[{...pc1,currentDP:1999999999,battlePlayCount:2}]}));
    app.store.push(save({UserPC:[{...pc1,currentDP:2000000000}]}));
    assert.deepEqual(snapshot().pointProgress,[{pc_id:pc1.pcId,current_dp:2000000000,earned_total:2000000000}]);
    assert.equal(snapshot().pointFloors.length,0,'Observed local point progress is distinct from a29000 reward ACK');
    assert.equal(app.store.hardCurrency(),0,'Participation/checkpoint/conversion never creates Iris');
    await close();database=path.join(directory,'event-guests.sqlite');await open();
    for(const guest of master.pcGuests) {
      // Synthetic identity probe only: do not infer temporary reset/rejoin or
      // permanently recruited guest behavior from an ordinary-unit floor.
      app.store.push(save({UserPC:[{...pc1,pcId:guest.pcId,battlePlayCount:50}]}));
      const response=await claim({dpStates:[state(guest.pcId,1,2)]});assert.equal(response.status,200);
      app.store.push(save({},JSON.parse(response.body).operations));
      assert.equal(snapshot().pointFloors.length,0,'Original event-guest PCs remain outside the permanent point floor');
      assert.equal(snapshot().pointProgress.length,0,'Do not freeze event-guest reset/rejoin through ordinary participation checkpoints');
    }
    await close(); database = path.join(directory, 'boundaries.sqlite'); await open();
    for (const boundary of master.dpLevels.slice(1)) {
      app.store.push(save({ UserPC: [{ ...pc1, currentDP: boundary.points - 1, battlePlayCount: 1 }] }));
      const response = await claim({ dpStates: [state(pc1.pcId,boundary.level - 1,boundary.level)] });
      assert.equal(response.status, 200);
      const result = JSON.parse(response.body);
      assert.equal(result.issueAmount, 2);
      assert.equal(readPc(pc1.pcId).currentDP, boundary.points);
      app.store.push(save({}, result.operations));
    }
    assert.equal(app.store.hardCurrency(), 58, 'All 29 reward-bearing original levels are covered');
    await close(); database = path.join(directory, 'overflow.sqlite'); await open();
    app.store.push(save({ UserDpItem: [item(999999999,999999999)] }));
    const overflowBefore = snapshot();
    const maxBody = { dpStates: [state(pc1.pcId,1,30)], itemId: 219000001, itemAmount: 999999999 };
    assert.equal((await claim(maxBody)).status, 400);
    assert.deepEqual(snapshot(), overflowBefore);
    const capped = JSON.parse((await claim({ ...maxBody, itemAmount: 20000001 })).body);
    assert.equal(capped.issueAmount, 58);
    assert.equal(readPc(pc1.pcId).currentDP, 2000000000);
    app.store.push(save({ UserDpItem: [item(999999999-20000001,999999999)] }, capped.operations));
    console.log('Outfit refinement: original levels/items, battle vs brush points, durable callback recovery, per-outfit rewards, rollback and restart: OK (not native UI proof)');
  } finally {
    await close();
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
