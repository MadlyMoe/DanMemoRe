'use strict';

// WRITTEN ONLY / NOT RUN: new source recovery cases remain deferred until every packet branch is implemented.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const md5 = value => crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-familia-donation-'));
  let database = path.join(directory, 'profile.sqlite');
  let app, port, sequence = 0, now = 1571400000;
  const open = async () => {
    app = createServer({ database, seed, master, wallNowSeconds: () => now, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => {
    if (app?.server.listening) await new Promise(resolve => app.server.close(resolve));
    app?.store.close(); app = null;
  };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows), md5(rows), name);
  const send = (value, action = 'familia/donate/item') => request(port, ++sequence, value, String(sequence), action);
  const parse = response => { assert.equal(response.status, 200, response.body.toString()); return JSON.parse(response.body); };
  const save = (putItems, operations = []) => ({ badges: null, scripts: {}, dataTokens: {},
    checksums: { before: {}, after: Object.fromEntries(Object.entries(putItems).map(([name, rows]) => [name, md5(rows)])) },
    deltas: [{ signature: 0, trigger: 'FamiliaItemDonation', deleteItems: {}, putItems }],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })) });
  const item = { userId: seed.userId, familiaDonationItemId: 32000001, amount: 50, bookEntryState: 1,
    cumulativeAmount: 50, donationCount: 0, lastDonatedAt: 0, reservedAmount: 0, signature: 0 };
  try {
    assert.deepEqual(master.familiaDonationItems['32000001'], { contribution: 5, dailyLimit: 40 });
    assert.deepEqual(master.familiaLevels.slice(0, 2), [
      { level: 1, points: 0, rewardSkillPoint: 0 }, { level: 2, points: 900, rewardSkillPoint: 6 },
    ]);
    await open();
    const profile = app.store.read('UserProfile').data[0];
    put('UserProfile', [{ ...profile, familiaId: 1, familiaName: 'Solo' }]);
    put('UserFamiliaDonationItem', [item]);
    app.store.db.prepare(`INSERT INTO local_familia(id,owner_id,settings,joined_at,contribution_point,valis,skill_point,
      creation_operation_id,creation_valis_before,creation_cumulative_before) VALUES(1,?,?,?,?,?,?,?,?,?)`)
      .run(seed.userId, JSON.stringify({ name: 'Solo', description: 'Offline', godId: 20000001, style: 21000001,
        subStyle: 0, activeTime: 22000001, subActiveTime: 22000002, requireApproval: false }), now, 850, 0, 0, 999, 0, 0);
    app.store.db.exec("CREATE TRIGGER fail_familia_donation BEFORE INSERT ON familia_item_donation BEGIN SELECT RAISE(ABORT, 'rollback'); END");
    assert.notEqual((await send({ familiaId: 1, itemId: 32000001, amount: 10 })).status, 200);
    assert.equal(app.store.db.prepare('SELECT contribution_point FROM local_familia WHERE id=1').get().contribution_point, 850);
    assert.deepEqual(app.store.operations(), []);
    app.store.db.exec('DROP TRIGGER fail_familia_donation');

    const value = { familiaId: 1, itemId: 32000001, amount: 10 };
    const response = parse(await send(value)), operation = response.operations[0];
    assert.deepEqual(response.operation, { ...operation, parameters: { ...operation.parameters,
      result: 0, familiaContributionPoint: 900, memberContributionPoint: 900, gained_contribution_point: 50 } });
    assert.deepEqual({ ...response, operation: undefined, operations: undefined }, { code: 0, result: 0, familiaContributionPoint: 900,
      memberContributionPoint: 900, gained_contribution_point: 50, operation: undefined, operations: undefined });
    assert.equal(operation.type, 22200);
    assert.deepEqual(operation.parameters, { consumedItem: { itemId: 32000001, amount: 10 } });
    assert.deepEqual(parse(await send(value)), response, 'Fresh retry must not donate twice');
    assert.equal((await send(save({}, [operation]), 'user_data/push')).status, 400, 'Bare ACK must not erase the item charge');
    const saved = { ...item, amount: 40, donationCount: 10, lastDonatedAt: now };
    parse(await send(save({ UserFamiliaDonationItem: [saved] }, [operation]), 'user_data/push'));
    assert.deepEqual(app.store.operations(), []);
    let status = parse(await send({ is_login: true }, 'familia/mystatus'));
    assert.equal(status.familia.contributionPoint, 900); assert.equal(status.familia.skillPoint, 6);
    assert.equal(status.members[0].contributionPoint, 900);
    const completed = app.store.read('UserFamiliaDonationItem').data;
    for (const stale of [[item], [{ ...saved, donationCount: 0 }], [], [{ ...saved, lastDonatedAt: now - 86400 }]]) {
      assert.equal((await send(save({ UserFamiliaDonationItem: stale }), 'user_data/push')).status, 400,
        'A stale completed save must not refund items or reset the same-day donation limit');
      assert.deepEqual(app.store.read('UserFamiliaDonationItem').data, completed);
    }
    assert.equal((await send({ familiaId: 1, itemId: 32000001, amount: 31 })).status, 400,
      'Original per-item daily cap must survive acknowledgment');
    await close(); await open();
    status = parse(await send({}, 'familia/mystatus'));
    assert.equal(status.familia.contributionPoint, 900); assert.equal(status.familia.skillPoint, 6);
    assert.equal(app.store.read('UserFamiliaDonationItem').data[0].amount, 40);
    const rows = [saved, ...[32000002, 32000003].map(familiaDonationItemId => ({ ...item, familiaDonationItemId }))];
    put('UserFamiliaDonationItem', rows);
    for (const sql of [
      "CREATE TRIGGER fail_item BEFORE INSERT ON familia_item_donation BEGIN SELECT RAISE(ABORT, 'receipt rollback'); END",
      "CREATE TRIGGER fail_item BEFORE INSERT ON reply_cache WHEN NEW.action='familia/donate/item' BEGIN SELECT RAISE(ABORT, 'reply rollback'); END",
    ]) {
      const before = app.store.db.prepare('SELECT * FROM local_familia').get();
      const receipts = app.store.db.prepare('SELECT * FROM familia_item_donation').all();
      app.store.db.exec(sql);
      assert.equal((await send({ familiaId: 1, itemId: 32000002, amount: 1 })).status, 503);
      assert.deepEqual(app.store.db.prepare('SELECT * FROM local_familia').get(), before);
      assert.deepEqual(app.store.db.prepare('SELECT * FROM familia_item_donation').all(), receipts);
      assert.deepEqual(app.store.operations(), []); assert.deepEqual(app.store.read('UserFamiliaDonationItem').data, rows);
      app.store.db.exec('DROP TRIGGER fail_item');
    }
    let points = 900;
    for (const itemId of [32000002, 32000003]) {
      const donated = parse(await send({ familiaId: 1, itemId, amount: 1 })), queued = donated.operations[0];
      points += master.familiaDonationItems[itemId].contribution;
      assert.equal(donated.familiaContributionPoint, points); assert.equal(donated.memberContributionPoint, points);
      assert.equal((await send({ familiaId: 1, itemId, amount: 2 })).status, 400, 'Conflicting pending donation must not spend');
      const original = rows.find(row => row.familiaDonationItemId === itemId);
      const paidItem = { ...original, amount: 49, donationCount: 1, lastDonatedAt: now };
      for (const bad of [{ ...paidItem, amount: 50 }, { ...paidItem, donationCount: 41 },
        { ...paidItem, cumulativeAmount: 49 }, { ...paidItem, lastDonatedAt: now - 86400 }]) {
        const invalid = rows.map(row => row.familiaDonationItemId === itemId ? bad : row);
        assert.equal((await send(save({ UserFamiliaDonationItem: invalid }, [queued]), 'user_data/push')).status, 400);
      }
      const index = rows.indexOf(original); rows[index] = paidItem;
      parse(await send(save({ UserFamiliaDonationItem: rows }), 'user_data/push'));
      await close(); await open();
      parse(await send(save({}, [queued]), 'user_data/push'));
      assert.deepEqual(app.store.operations(), []);
      assert.equal(parse(await send({}, 'familia/mystatus')).familia.skillPoint, 6, 'Level crossing cannot reward points again');
    }
    // Real subsequent acquisition preserves expenditure evidence and must not
    // be mistaken for a stale refund of the original ten-stone charge.
    rows[0] = { ...rows[0], amount: 45, cumulativeAmount: 55 };
    parse(await send(save({ UserFamiliaDonationItem: rows }), 'user_data/push'));
    now += 86400;
    const reset = rows.map(row => ({ ...row, donationCount: 0 }));
    parse(await send(save({ UserFamiliaDonationItem: reset }), 'user_data/push'));
    const next = parse(await send({ familiaId: 1, itemId: 32000001, amount: 1 })).operations[0];
    reset[0] = { ...reset[0], amount: 44, donationCount: 1, lastDonatedAt: now };
    parse(await send(save({ UserFamiliaDonationItem: reset }), 'user_data/push'));
    await close(); await open();
    parse(await send(save({}, [next]), 'user_data/push'));
    assert.equal(parse(await send({}, 'familia/mystatus')).familia.contributionPoint, points + 5);
    assert.deepEqual(app.store.read('UserFamiliaDonationItem').data, reset);
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    // WRITTEN ONLY / NOT RUN: indexed history selection, not native earning/capped-gain proof or a benchmark.
    await close();database=path.join(directory,'indexed-history.sqlite');now=1571400000;await open();
    put('UserProfile',[{...app.store.read('UserProfile').data[0],familiaId:1,familiaName:'Solo'}]);
    let historyItems=[32000001,32000002,32000003].map(familiaDonationItemId=>({...item,familiaDonationItemId,amount:100,cumulativeAmount:100}));
    put('UserFamiliaDonationItem',historyItems);
    app.store.db.prepare(`INSERT INTO local_familia(id,owner_id,settings,joined_at,contribution_point,valis,skill_point,
      creation_operation_id,creation_valis_before,creation_cumulative_before) VALUES(1,?,?,?,?,?,?,?,?,?)`)
      .run(seed.userId,JSON.stringify({name:'Solo',description:'Offline',godId:20000001,style:21000001,
        subStyle:0,activeTime:22000001,subActiveTime:22000002,requireApproval:false}),now,850,0,0,999,0,0);
    const historyDay=Math.floor((now+32400)/86400),historyReceipts=[];
    for(const itemId of [32000001,32000002,32000003]) {
      const queued=parse(await send({familiaId:1,itemId,amount:10})).operations[0];
      historyItems=historyItems.map(row=>row.familiaDonationItemId===itemId?{...row,amount:90,donationCount:10,lastDonatedAt:now}:row);
      parse(await send(save({UserFamiliaDonationItem:historyItems},[queued]),'user_data/push'));
      historyReceipts.push(app.store.db.prepare('SELECT * FROM familia_item_donation WHERE operation_id=?').get(queued.id));
    }
    let historicalId=1000000;
    const insertHistory=(receipt,changes,acked=true)=>{
      const row={...receipt,capture_version:0,before_state:null,observed:null,charge_seen:0,saved_day:null,saved_count:null,
        ...changes,operation_id:++historicalId},keys=Object.keys(row);
      app.store.db.prepare(`INSERT INTO familia_item_donation(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...Object.values(row));
      if(acked) app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(row.operation_id);
      return row;
    };
    // Synthetic legacy rows deliberately put the independent extrema in different receipts.
    for(const receipt of historyReceipts) {
      for(let age=1;age<=64;age++) insertHistory(receipt,{amount:1,amount_before:100,cumulative_before:100,
        count_after:1,donation_day:historyDay-age});
      insertHistory(receipt,{amount:20,amount_before:90,cumulative_before:100,count_after:20,donation_day:historyDay-1});
      insertHistory(receipt,{amount:1,amount_before:240,cumulative_before:250,count_after:1,donation_day:historyDay-2});
      insertHistory(receipt,{amount:1,amount_before:100,cumulative_before:100,count_after:25,donation_day:historyDay});
      insertHistory(receipt,{amount:40,amount_before:100,cumulative_before:500,count_after:40,donation_day:historyDay},false);
    }
    const unknown=insertHistory(historyReceipts[0],{item_id:32000004},false);
    historyItems=historyItems.map(row=>({...row,amount:220,cumulativeAmount:250,donationCount:25,lastDonatedAt:now}));
    for(const receipt of historyReceipts) {
      const expected=app.store.db.prepare(`SELECT MIN(amount_before-cumulative_before-amount) ceiling,MAX(cumulative_before) cumulative
        FROM familia_item_donation JOIN operation_done ON operation_done.id=familia_item_donation.operation_id WHERE item_id=?`).get(receipt.item_id);
      assert.deepEqual({...expected},{ceiling:-30,cumulative:250});
      assert.equal(app.store.db.prepare(`SELECT MAX(CASE WHEN capture_version=2 THEN amount ELSE COALESCE(saved_count,count_after) END) count
        FROM familia_item_donation JOIN operation_done ON operation_done.id=familia_item_donation.operation_id
        WHERE item_id=? AND COALESCE(saved_day,donation_day)=?`).get(receipt.item_id,historyDay).count,25);
    }
    parse(await send(save({UserFamiliaDonationItem:historyItems}),'user_data/push'));
    const historySnapshot=()=>({profiles:app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),queue:app.store.operations(),
      receipts:app.store.db.prepare('SELECT * FROM familia_item_donation ORDER BY operation_id').all(),
      done:app.store.db.prepare('SELECT * FROM operation_done ORDER BY id').all(),bank:app.store.db.prepare('SELECT * FROM local_familia').get(),
      replies:app.store.db.prepare('SELECT * FROM reply_cache ORDER BY rowid').all(),sequence:String(app.store.lastSequence())});
    for(const itemId of [32000001,32000002,32000003]) {
      for(const change of [{amount:221},{amount:219,cumulativeAmount:249},{donationCount:24},{lastDonatedAt:now-86400},{userId:2}]) {
        const retained=historySnapshot(),changed=historyItems.map(row=>row.familiaDonationItemId===itemId?{...row,...change}:row);
        assert.equal((await send(save({UserFamiliaDonationItem:changed}),'user_data/push')).status,400);
        assert.deepEqual(historySnapshot(),retained,'Each independent ACKed spending/cumulative/daily proof must survive the indexed seek');
      }
      const retained=historySnapshot();
      assert.equal((await send(save({UserFamiliaDonationItem:historyItems.filter(row=>row.familiaDonationItemId!==itemId)}),'user_data/push')).status,400);
      assert.deepEqual(historySnapshot(),retained);
    }
    app.store.db.prepare('INSERT INTO operation_done(id) VALUES(?)').run(unknown.operation_id);
    const unknownSnapshot=historySnapshot();
    assert.equal((await send(save({UserFamiliaDonationItem:historyItems}),'user_data/push')).status,503);
    assert.deepEqual(historySnapshot(),unknownSnapshot,'Fixed original-item seeks cannot silently ignore an unknown completed receipt');
    app.store.db.prepare('DELETE FROM operation_done WHERE id=?').run(unknown.operation_id);
    const historical=historySnapshot();await close();await open();assert.deepEqual(historySnapshot(),historical);
    parse(await send(save({UserFamiliaDonationItem:historyItems}),'user_data/push'));
    now+=86400;historyItems=historyItems.map(row=>({...row,donationCount:0}));
    parse(await send(save({UserFamiliaDonationItem:historyItems}),'user_data/push'));
    for(const itemId of [32000001,32000002,32000003]) {
      const retained=historySnapshot(),changed=historyItems.map(row=>row.familiaDonationItemId===itemId?{...row,amount:221}:row);
      assert.equal((await send(save({UserFamiliaDonationItem:changed}),'user_data/push')).status,400);assert.deepEqual(historySnapshot(),retained,
        'The daily reset cannot erase lifetime cost proof; unacknowledged stronger receipts earn no floor');
    }
    // WRITTEN ONLY / NOT RUN: native2572068/2570f30 debit, count and AppTime fields can reach separate saves.
    for(const itemId of [32000001,32000002,32000003]) for(const mode of ['cost-first','count-first','date-first','combined',
      'callback-midnight','after-midnight','frozen-clock','natural-reset-first','legacy-cost-first','legacy-counter-only',
      'getter-midnight','getter-midnight-count-first','getter-midnight-date-first','getter-midnight-after-reset',
      'getter-midnight-noop-count','getter-midnight-reset-before-count','getter-midnight-erased-cost-later',
      'getter-midnight-erased-time-later','getter-midnight-erased-combined','getter-outside-midnight',
      'getter-paused-count-first','getter-paused-date-first','getter-paused-count-time-first','getter-paused-count-then-reset',
      'getter-paused-combined','getter-paused-erased-first','getter-paused-erased-cost-later','getter-paused-erased-time-later',
      'paid-complete','paid-exhausted','paid-cost-exhausted','paid-cost-progress',
      'paid-count-progress','paid-count-exhausted','unpaid-count-progress',
      'unpaid-count-exhausted','count-first-old-day',
      'count-first-near-midnight','paid-count-old-day','unpaid-count-old-day-exhausted',
      'count-first-zero-date','paid-count-zero-date','unpaid-count-zero-date-exhausted',
      'paid-date-progress','paid-date-exhausted','unpaid-date-progress',
      'unpaid-date-exhausted','date-first-old-day','date-first-near-midnight',
      'date-first-zero-date','paid-date-zero-date','unpaid-date-zero-date-exhausted',
      'date-first-old-day-zero-count',
      'unpaid-complete','unpaid-exhausted','unpaid-progress']) {
      await close();database=path.join(directory,`recovery-${itemId}-${mode}.sqlite`);now=1571400000;
      const getterMidnight=mode.startsWith('getter-midnight'),getterPaused=mode.startsWith('getter-paused'),
        erasedCount=mode==='getter-midnight-reset-before-count' || mode.startsWith('getter-midnight-erased-') || mode.startsWith('getter-paused-erased-');
      if(['callback-midnight','count-first-near-midnight','date-first-near-midnight'].includes(mode) || getterMidnight)
        now=(Math.floor((now+32400)/86400)+1)*86400-32400-1;
      if(mode==='getter-outside-midnight' || getterPaused) now=Math.floor((now+32400)/86400)*86400-32400+43200;
      await open();
      put('UserProfile',[{...app.store.read('UserProfile').data[0],familiaName:'Solo'}]);
      const funds=['paid-exhausted','paid-cost-exhausted','paid-count-exhausted','paid-date-exhausted',
          'unpaid-count-exhausted','unpaid-count-old-day-exhausted','unpaid-count-zero-date-exhausted',
          'unpaid-date-exhausted','unpaid-date-zero-date-exhausted','unpaid-exhausted'].includes(mode)?10:50,
        funded={...item,familiaDonationItemId:itemId,amount:funds,cumulativeAmount:funds,signature:7,
        donationCount:mode.startsWith('legacy-') || mode.includes('zero-date') || mode==='date-first-old-day-zero-count'?0:
          mode==='getter-midnight-noop-count'?10:2,
        lastDonatedAt:mode.startsWith('legacy-') || mode.includes('zero-date')?0:mode==='frozen-clock'?now:
          ['natural-reset-first','count-first-old-day','paid-count-old-day','unpaid-count-old-day-exhausted',
            'date-first-old-day','date-first-old-day-zero-count'].includes(mode)?now-86400:now-1};
      put('UserFamiliaDonationItem',[funded]);
      app.store.db.prepare(`INSERT INTO local_familia(id,owner_id,settings,joined_at,contribution_point,valis,skill_point,
        creation_operation_id,creation_valis_before,creation_cumulative_before) VALUES(1,?,?,?,?,?,?,?,?,?)`)
        .run(seed.userId,JSON.stringify({name:'Solo',description:'Offline',godId:20000001,style:21000001,
          subStyle:0,activeTime:22000001,subActiveTime:22000002,requireApproval:false}),now,850,0,0,999,0,0);
      const snapshot=()=>({profiles:app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),queue:app.store.operations(),
        receipts:app.store.db.prepare('SELECT * FROM familia_item_donation ORDER BY operation_id').all(),
        bank:app.store.db.prepare('SELECT * FROM local_familia').get(),done:app.store.db.prepare('SELECT * FROM operation_done ORDER BY id').all(),
        replies:app.store.db.prepare('SELECT * FROM reply_cache ORDER BY rowid').all(),sequence:String(app.store.lastSequence())}),
        day=at=>Math.floor((at+32400)/86400),value={familiaId:1,itemId,amount:10},before=snapshot(),issuedAt=now;
      const issued=parse(await send(value)),issueSequence=sequence,operation=issued.operations[0],receipt=snapshot().receipts[0];
      assert.deepEqual(snapshot().profiles,before.profiles,'Issuing22200 cannot debit or change native counters/signatures');
      assert.deepEqual(operation.parameters,{consumedItem:{itemId,amount:10}});
      assert.deepEqual(issued.operation.parameters,{...operation.parameters,result:0,familiaContributionPoint:850+10*master.familiaDonationItems[itemId].contribution,
        memberContributionPoint:850+10*master.familiaDonationItems[itemId].contribution,gained_contribution_point:10*master.familiaDonationItems[itemId].contribution});
      assert.deepEqual(JSON.parse(receipt.before_state),{donationCount:funded.donationCount,lastDonatedAt:funded.lastDonatedAt,issuedAt});
      assert.deepEqual(JSON.parse(receipt.observed),{count:null,at:null});assert.equal(receipt.charge_seen,0);
      assert.equal(receipt.capture_version,1);
      assert.equal(receipt.saved_day,null);assert.equal(receipt.saved_count,null);
      assert.deepEqual(parse(await request(port,issueSequence,value,String(issueSequence),'familia/donate/item')),issued);
      const untouchedResponse=await send(undefined,'user_data/confirm'),untouchedSequence=sequence;
      assert.deepEqual(parse(untouchedResponse).operations.find(row=>row.id===operation.id),operation);
      assert.deepEqual(parse(await send(save({}),'user_data/push')).operations.find(row=>row.id===operation.id),operation);
      if(mode==='callback-midnight') now+=2;
      const callbackAt=now;
      if(getterMidnight) now+=2;
      if(getterPaused) now+=2*86400+3600;
      const targetCount=getterMidnight || getterPaused || mode==='getter-outside-midnight'?10:
        (funded.lastDonatedAt && day(funded.lastDonatedAt)===day(callbackAt)?funded.donationCount:0)+10,
        native={...funded,amount:funded.amount-10,signature:operation.signature,donationCount:erasedCount?0:targetCount,lastDonatedAt:callbackAt};
      if(mode==='getter-outside-midnight') {
        const retained=snapshot();assert.equal((await send(save({UserFamiliaDonationItem:[native]},[operation]),'user_data/push')).status,400);
        assert.deepEqual(snapshot(),retained,'A second time read cannot imply a daily reset far from midnight');continue;
      }
      if(mode.startsWith('legacy-')) app.store.db.prepare('UPDATE familia_item_donation SET capture_version=0,before_state=NULL,observed=NULL').run();
      if(mode==='legacy-counter-only') {
        const legacy=snapshot();assert.equal((await send(save({UserFamiliaDonationItem:[{...native,amount:50}]}),'user_data/push')).status,503);
        assert.deepEqual(snapshot(),legacy,'Missing legacy before-counter evidence cannot be guessed from counter-only effects');
      }
      if(!['combined','getter-midnight-erased-combined','getter-paused-combined'].includes(mode)) {
        let first={...funded,amount:funded.amount-10,signature:operation.signature};
        if(['count-first','count-first-old-day','count-first-zero-date','count-first-near-midnight','unpaid-count-progress',
            'unpaid-count-exhausted','unpaid-count-old-day-exhausted','unpaid-count-zero-date-exhausted',
            'callback-midnight','getter-midnight-count-first',
            'getter-paused-count-first'].includes(mode)) first={...funded,donationCount:targetCount};
        if(['paid-count-progress','paid-count-exhausted','paid-count-old-day','paid-count-zero-date'].includes(mode))
          first={...native,lastDonatedAt:funded.lastDonatedAt};
        if(['date-first','date-first-old-day','date-first-near-midnight','date-first-zero-date',
            'date-first-old-day-zero-count',
            'getter-midnight-date-first','getter-midnight-noop-count','getter-paused-date-first'].includes(mode))
          first={...funded,lastDonatedAt:callbackAt};
        if(mode==='after-midnight') first={...funded,donationCount:targetCount,lastDonatedAt:callbackAt};
        if(mode==='getter-midnight-after-reset') first=native;
        if(mode==='getter-midnight-reset-before-count') first=native;
        if(mode==='getter-midnight-erased-cost-later') first={...native,amount:50,signature:funded.signature};
        if(mode==='getter-midnight-erased-time-later') first={...native,lastDonatedAt:funded.lastDonatedAt};
        if(['getter-paused-count-time-first','getter-paused-count-then-reset'].includes(mode)) first={...funded,donationCount:targetCount,lastDonatedAt:callbackAt};
        if(mode==='getter-paused-erased-first') first=native;
        if(mode==='getter-paused-erased-cost-later') first={...native,amount:50,signature:funded.signature};
        if(mode==='getter-paused-erased-time-later') first={...native,lastDonatedAt:funded.lastDonatedAt};
        if(mode==='frozen-clock') first=native;
        if(['paid-complete','paid-exhausted'].includes(mode)) first=native;
        if(mode.startsWith('unpaid-')) first={...native,amount:funded.amount,signature:funded.signature};
        if(['unpaid-count-progress','unpaid-count-exhausted','unpaid-count-old-day-exhausted',
            'unpaid-count-zero-date-exhausted'].includes(mode))
          first={...funded,donationCount:targetCount};
        if(['paid-date-progress','paid-date-exhausted'].includes(mode)) first={...native,donationCount:funded.donationCount};
        if(['unpaid-date-progress','unpaid-date-exhausted'].includes(mode)) first={...funded,lastDonatedAt:callbackAt};
        if(mode==='paid-date-zero-date') first={...native,donationCount:funded.donationCount};
        if(mode==='unpaid-date-zero-date-exhausted') first={...funded,lastDonatedAt:callbackAt};
        if(mode==='natural-reset-first') first={...funded,donationCount:0};
        const partialValue=save({UserFamiliaDonationItem:[first]});
        for(const [table,event] of [['profile','UPDATE'],['familia_item_donation','UPDATE'],['reply_cache','INSERT']]) {
          if(mode==='natural-reset-first' && table==='familia_item_donation') continue;
          const pending=snapshot();app.store.db.exec(`CREATE TRIGGER donation_partial_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'partial rollback'); END`);
          assert.equal((await send(partialValue,'user_data/push')).status,503);assert.deepEqual(snapshot(),pending);
          app.store.db.exec('DROP TRIGGER donation_partial_fail');
        }
        const partial=parse(await send(partialValue,'user_data/push'));
        let saved=snapshot().receipts[0];
        assert.ok(app.store.operations().some(row=>row.id===operation.id));assert.equal(saved.saved_day,null);assert.equal(saved.saved_count,null);
        assert.equal(app.store.db.prepare('SELECT 1 FROM operation_done WHERE id=?').get(operation.id),undefined);
        if(mode==='natural-reset-first') {
          assert.deepEqual(partial.operations,[]);assert.deepEqual(JSON.parse(saved.observed),{count:null,at:null});assert.equal(saved.charge_seen,0);
          const untouched=snapshot();await close();await open();assert.deepEqual(snapshot(),untouched);
          assert.deepEqual(parse(await send(value)),issued,'An original daily reset alone is not donation callback proof');
        } else {
          assert.deepEqual(partial.operations,[],'Suppress delivery only; do not acknowledge or erase the original queue');assert.equal(partial.operation,undefined);
          const pending=snapshot();await close();await open();assert.deepEqual(snapshot(),pending);
          const paidCostOnly=['cost-first','paid-cost-exhausted','paid-cost-progress'].includes(mode),
            countOnly=['count-first','paid-count-progress','paid-count-exhausted',
              'unpaid-count-progress','unpaid-count-exhausted'].includes(mode),
            resetCountOnly=['count-first-old-day','paid-count-old-day','unpaid-count-old-day-exhausted',
              'count-first-zero-date','paid-count-zero-date','unpaid-count-zero-date-exhausted'].includes(mode),
            dateOnly=['date-first','paid-date-progress','paid-date-exhausted',
              'unpaid-date-progress','unpaid-date-exhausted','date-first-zero-date',
              'paid-date-zero-date','unpaid-date-zero-date-exhausted','date-first-old-day-zero-count'].includes(mode),
            recoverable=['cost-first','paid-cost-exhausted','paid-cost-progress','frozen-clock',
              'count-first','paid-count-progress','paid-count-exhausted','unpaid-count-progress','unpaid-count-exhausted',
              'count-first-old-day','paid-count-old-day','unpaid-count-old-day-exhausted',
              'count-first-zero-date','paid-count-zero-date','unpaid-count-zero-date-exhausted',
              'date-first','paid-date-progress','paid-date-exhausted','unpaid-date-progress','unpaid-date-exhausted',
              'date-first-zero-date','paid-date-zero-date','unpaid-date-zero-date-exhausted',
              'date-first-old-day-zero-count',
              'getter-midnight-after-reset','getter-midnight-reset-before-count',
              'getter-paused-erased-first','paid-complete','paid-exhausted','after-midnight',
              'getter-paused-count-time-first','getter-paused-count-then-reset','unpaid-complete','unpaid-exhausted','unpaid-progress'].includes(mode),
            recovered={...operation,parameters:{...operation.parameters,consumedItem:resetCountOnly?
              (saved.charge_seen?{itemId,amount:0,offlineDonationCounterQuantity:10}:{itemId,amount:10}):dateOnly?
              (saved.charge_seen?{itemId,amount:0,offlineDonationCounterQuantity:10,offlineDonationDateApplied:1}:
                {itemId,amount:10,offlineDonationDateApplied:1}):countOnly?
              (saved.charge_seen?{itemId,amount:0,offlineDonationCounterQuantity:10,offlineDonationCountApplied:1}:
                {itemId,amount:10,offlineDonationCountApplied:1}):paidCostOnly?
              {itemId,amount:0,offlineDonationCounterQuantity:10}:saved.charge_seen?{itemId,amount:0}:
              {itemId,amount:10,offlineDonationCounterApplied:1}}},
            nativeState=value=>({profiles:value.profiles.filter(row=>['UserFamiliaDonationItem','UserProfile'].includes(row.name)),
              queue:value.queue,receipts:value.receipts,bank:value.bank,done:value.done});
          if(recoverable) {
            const retained=snapshot();assert.equal(app.store.familiaItemDelivery(app.store.operations()[0],'user_data/confirm'),true);
            assert.deepEqual(snapshot(),retained,'Complete-callback derivation never changes item stock/counters/time/signature, receipt or Familia points');
            assert.deepEqual(parse(await request(port,untouchedSequence,undefined,String(untouchedSequence),'user_data/confirm')).operations,[recovered]);
            assert.deepEqual(snapshot(),retained,'Cached original22200 derives only its proven remaining debit/callback without altering the queued quantity');
            assert.equal(app.store.operations()[0].parameters.consumedItem.amount,10);
            if(['paid-exhausted','paid-cost-exhausted','paid-count-exhausted','paid-date-exhausted'].includes(mode))
              assert.equal(app.store.read('UserFamiliaDonationItem').data[0].amount,0);
          }
          for(const [action,body] of [['familia/donate/item',value],['user/login',undefined],['user_data/confirm',undefined],
            ['user_data/pull',{tables:['UserFamiliaDonationItem']}]]) {
            const retained=snapshot(),response=await send(body,action);
            if(recoverable && action!=='familia/donate/item') {
              assert.equal(response.status,200,response.body.toString());
              if(action==='user_data/confirm') assert.deepEqual(parse(response).operations,[recovered]);
              if(action==='user_data/pull') assert.equal(response.headers['content-type'],'application/x-msgpack');
              assert.deepEqual(nativeState(snapshot()),nativeState(retained),'Login/pull validation and zero-quantity confirm never prewrite effects or ACK');
            } else {assert.equal(response.status,503);assert.deepEqual(snapshot(),retained);}
          }
          const afterCold=snapshot();
          assert.equal((await request(port,issueSequence,value,String(issueSequence),'familia/donate/item')).status,503);assert.deepEqual(snapshot(),afterCold);
          if(!recoverable || !saved.charge_seen || paidCostOnly || countOnly || resetCountOnly || dateOnly) {
            assert.equal((await send(save({},[operation]),'user_data/push')).status,400);assert.deepEqual(snapshot(),afterCold);
          }
          if(recoverable) {
            const cold=await send(undefined,'user_data/confirm'),identity=sequence;
            for(const change of [...(paidCostOnly?[{consumedItem:{itemId,amount:0}},
              ...[0,9,11,'10',true].map(value=>({consumedItem:{itemId,amount:0,offlineDonationCounterQuantity:value}}))]:[]),
              ...(countOnly?[
                {consumedItem:{itemId,amount:0}},
                ...[0,2,'1',true].map(value=>({consumedItem:{itemId,amount:saved.charge_seen?0:10,
                  ...(saved.charge_seen?{offlineDonationCounterQuantity:10}:{}),offlineDonationCountApplied:value}})),
                ...(saved.charge_seen?[
                  {consumedItem:{itemId,amount:0,offlineDonationCountApplied:1}},
                  {consumedItem:{itemId,amount:0,offlineDonationCounterQuantity:9,offlineDonationCountApplied:1}}]:[
                  {consumedItem:{itemId,amount:10,offlineDonationCounterQuantity:10,offlineDonationCountApplied:1}}])]:[]),
              ...(dateOnly?[
                {consumedItem:{itemId,amount:saved.charge_seen?0:10}},
                ...[0,2,'1',true].map(value=>({consumedItem:{itemId,amount:saved.charge_seen?0:10,
                  ...(saved.charge_seen?{offlineDonationCounterQuantity:10}:{}),offlineDonationDateApplied:value}})),
                ...(saved.charge_seen?[
                  {consumedItem:{itemId,amount:0,offlineDonationDateApplied:1}},
                  {consumedItem:{itemId,amount:0,offlineDonationCounterQuantity:9,offlineDonationDateApplied:1}}]:[
                  {consumedItem:{itemId,amount:10,offlineDonationCounterQuantity:10,offlineDonationDateApplied:1}}])]:[]),
              ...(resetCountOnly?[
                {consumedItem:{itemId,amount:saved.charge_seen?0:10,offlineDonationCountApplied:1}},
                {consumedItem:{itemId,amount:saved.charge_seen?0:10,offlineDonationDateApplied:1}},
                ...(saved.charge_seen?[{consumedItem:{itemId,amount:0,offlineDonationCounterQuantity:9}}]:[
                  {consumedItem:{itemId,amount:10,offlineDonationCounterQuantity:10}}])]:[]),
              ...(!saved.charge_seen?[{consumedItem:{itemId,amount:0}},
              ...[0,2,'1',true].map(value=>({consumedItem:{itemId,amount:10,offlineDonationCounterApplied:value}}))]:[]),
              {consumedItem:{itemId,amount:1}},{consumedItem:{itemId,amount:-1}},
              {consumedItem:{itemId,amount:'0'}},{consumedItem:{itemId:itemId+1,amount:0}},{unexpectedField:true}]) {
              const bad=JSON.parse(cold.body);bad.operations[0].parameters={...bad.operations[0].parameters,...change};
              app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(Buffer.from(JSON.stringify(bad)).toString('base64'),`${identity}/${identity}`);
              const retained=snapshot();assert.equal((await request(port,identity,undefined,String(identity),'user_data/confirm')).status,503);assert.deepEqual(snapshot(),retained);
            }
            app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(untouchedResponse.body.toString('base64'),`${identity}/${identity}`);
            assert.deepEqual(parse(await request(port,identity,undefined,String(identity),'user_data/confirm')).operations,[recovered]);
            const withPopup=JSON.parse(cold.body),popupWire={...issued.operation,
              parameters:{...issued.operation.parameters,consumedItem:recovered.parameters.consumedItem}};
            withPopup.operation=issued.operation;
            app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(Buffer.from(JSON.stringify(withPopup)).toString('base64'),`${identity}/${identity}`);
            const singular=snapshot();assert.deepEqual(parse(await request(port,identity,undefined,String(identity),'user_data/confirm')).operation,popupWire);
            assert.deepEqual(snapshot(),singular,'A captured singular popup keeps its actual contribution fields while replaying no item/counter effects');
            withPopup.operation=popupWire;
            app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(Buffer.from(JSON.stringify(withPopup)).toString('base64'),`${identity}/${identity}`);
            assert.deepEqual(parse(await request(port,identity,undefined,String(identity),'user_data/confirm')).operation,popupWire);
            withPopup.operation.parameters.gained_contribution_point++;
            app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(Buffer.from(JSON.stringify(withPopup)).toString('base64'),`${identity}/${identity}`);
            const badPopup=snapshot();assert.equal((await request(port,identity,undefined,String(identity),'user_data/confirm')).status,503);assert.deepEqual(snapshot(),badPopup);
            app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(cold.body.toString('base64'),`${identity}/${identity}`);
            for(const change of [{observed:JSON.stringify(paidCostOnly?{count:10,at:null}:{count:null,at:null}),
              capture_version:1,charge_seen:saved.charge_seen},
              {observed:saved.observed,capture_version:saved.capture_version,charge_seen:saved.charge_seen?0:1}]) {
              app.store.db.prepare('UPDATE familia_item_donation SET observed=?,capture_version=?,charge_seen=? WHERE operation_id=?')
                .run(change.observed,change.capture_version,change.charge_seen,operation.id);
              const uncheckpointed=snapshot();assert.equal((await send(undefined,'user_data/confirm')).status,503);assert.deepEqual(snapshot(),uncheckpointed,
                'Cold delivery cannot infer lost private counter/time checkpoints or an unretained charge from a complete-looking item row');
              app.store.db.prepare('UPDATE familia_item_donation SET observed=?,capture_version=?,charge_seen=? WHERE operation_id=?')
                .run(saved.observed,saved.capture_version,saved.charge_seen,operation.id);
            }
            const queued=app.store.db.prepare('SELECT parameters FROM operation_queue WHERE id=?').get(operation.id);
            for(const consumedItem of [{itemId,amount:0},{itemId,amount:10,offlineDonationCounterApplied:1},
              {itemId,amount:10,offlineDonationCounterQuantity:10},
              {itemId,amount:10,offlineDonationCountApplied:1},
              {itemId,amount:10,offlineDonationDateApplied:1}]) {
              app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify({consumedItem}),operation.id);
              const poisoned=snapshot();assert.equal((await send(undefined,'user_data/confirm')).status,503);assert.deepEqual(snapshot(),poisoned);
            }
            app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(queued.parameters,operation.id);
            if(!saved.charge_seen) {
              const items=app.store.read('UserFamiliaDonationItem').data;
              for(const change of [{amount:funded.amount-1},{amount:funded.amount-10},{cumulativeAmount:funded.cumulativeAmount+1}]) {
                put('UserFamiliaDonationItem',[{...first,...change}]);const ambiguous=snapshot();
                assert.equal((await send(undefined,'user_data/confirm')).status,503);assert.deepEqual(snapshot(),ambiguous,
                  'A changed wallet cannot borrow exact-unpaid callback suppression or guess an unretained saved debit');
                put('UserFamiliaDonationItem',items);
              }
            }
            if(paidCostOnly || (countOnly || resetCountOnly || dateOnly) && saved.charge_seen) {
              const items=app.store.read('UserFamiliaDonationItem').data;
              for(const change of [...(first.amount>0?[{amount:first.amount-1}]:[]),
                {amount:first.amount+1},{cumulativeAmount:funded.cumulativeAmount+1}]) {
                put('UserFamiliaDonationItem',[{...first,...change}]);const ambiguous=snapshot();
                assert.equal((await send(undefined,'user_data/confirm')).status,503);assert.deepEqual(snapshot(),ambiguous,
                  'A different item wallet cannot prove the exact original debit without a second charge');
                put('UserFamiliaDonationItem',items);
              }
            }
            if(paidCostOnly || countOnly || resetCountOnly || dateOnly) {
              const originalNow=now;
              for(const shifted of [issuedAt-6,originalNow+86400]) {
                now=shifted;const outside=snapshot();
                assert.equal((await send(undefined,'user_data/confirm')).status,503);assert.deepEqual(snapshot(),outside,
                  'Cost-first callback replay cannot borrow another issue day or an earlier clock');
              }
              now=originalNow;
            }
            const profiles=app.store.read('UserProfile').data;
            assert.equal(Object.hasOwn(profiles[0],'familiaId'),false);
            for(const change of [{familiaName:'Remote'},{familiaId:2}]) {
              put('UserProfile',[{...profiles[0],...change}]);const foreign=snapshot();
              assert.equal((await send(undefined,'user_data/confirm')).status,503);assert.deepEqual(snapshot(),foreign);put('UserProfile',profiles);
            }
            await close();await open();const retained=snapshot();
            assert.deepEqual((await request(port,identity,undefined,String(identity),'user_data/confirm')).body,cold.body);assert.deepEqual(snapshot(),retained);
            if(['unpaid-progress','paid-cost-progress','paid-count-progress','paid-count-old-day',
                'paid-count-zero-date','paid-date-progress','paid-date-zero-date'].includes(mode)) {
              const completed=mode==='unpaid-progress'?{...first,amount:funded.amount-10,signature:operation.signature}:native,
                beforeEffect=snapshot();
              const accepted=parse(await send(save({UserFamiliaDonationItem:[completed]}),'user_data/push'));
              assert.deepEqual(accepted.operations,[]);assert.deepEqual(snapshot().bank,beforeEffect.bank);
              assert.equal(snapshot().receipts[0].charge_seen,1);assert.equal(snapshot().receipts[0].saved_day,null);
              const advanced=snapshot();assert.equal((await request(port,identity,undefined,String(identity),'user_data/confirm')).status,503);
              assert.deepEqual(snapshot(),advanced,'An old split-effect envelope is stale after its remaining native save');
              const zero={...operation,parameters:{consumedItem:{itemId,amount:0}}};
              assert.deepEqual(parse(await request(port,untouchedSequence,undefined,String(untouchedSequence),'user_data/confirm')).operations,[zero]);
              assert.deepEqual(parse(await send(undefined,'user_data/confirm')).operations,[zero]);
              saved=snapshot().receipts[0];
            }
            if(mode==='unpaid-count-progress') {
              const dated={...first,lastDonatedAt:callbackAt},beforeDate=snapshot();
              assert.deepEqual(parse(await send(save({UserFamiliaDonationItem:[dated]}),'user_data/push')).operations,[]);
              assert.deepEqual(snapshot().bank,beforeDate.bank);assert.equal(snapshot().receipts[0].charge_seen,0);
              const dateSaved=snapshot();assert.equal((await request(port,identity,undefined,String(identity),'user_data/confirm')).status,503);
              assert.deepEqual(snapshot(),dateSaved,'Count-only marker cannot repeat after the original date is saved');
              const unpaid={...operation,parameters:{consumedItem:{itemId,amount:10,offlineDonationCounterApplied:1}}};
              assert.deepEqual(parse(await request(port,untouchedSequence,undefined,String(untouchedSequence),'user_data/confirm')).operations,[unpaid]);
              assert.deepEqual(parse(await send(undefined,'user_data/confirm')).operations,[unpaid]);const unpaidSequence=sequence;
              assert.deepEqual(parse(await send(save({UserFamiliaDonationItem:[native]}),'user_data/push')).operations,[]);
              assert.equal(snapshot().receipts[0].charge_seen,1);assert.equal(snapshot().receipts[0].saved_day,null);
              const debitSaved=snapshot();assert.equal((await request(port,unpaidSequence,undefined,String(unpaidSequence),'user_data/confirm')).status,503);
              assert.deepEqual(snapshot(),debitSaved,'Unpaid complete marker cannot repeat after the actual original debit saves');
              const zero={...operation,parameters:{consumedItem:{itemId,amount:0}}};
              assert.deepEqual(parse(await request(port,untouchedSequence,undefined,String(untouchedSequence),'user_data/confirm')).operations,[zero]);
              assert.deepEqual(parse(await send(undefined,'user_data/confirm')).operations,[zero]);
              saved=snapshot().receipts[0];
            }
            if(mode==='unpaid-date-progress') {
              const counted={...first,donationCount:targetCount},beforeCount=snapshot();
              assert.deepEqual(parse(await send(save({UserFamiliaDonationItem:[counted]}),'user_data/push')).operations,[]);
              assert.deepEqual(snapshot().bank,beforeCount.bank);assert.equal(snapshot().receipts[0].charge_seen,0);
              const countSaved=snapshot();assert.equal((await request(port,identity,undefined,String(identity),'user_data/confirm')).status,503);
              assert.deepEqual(snapshot(),countSaved,'Date-only marker cannot repeat after original count is saved');
              const unpaid={...operation,parameters:{consumedItem:{itemId,amount:10,offlineDonationCounterApplied:1}}};
              assert.deepEqual(parse(await request(port,untouchedSequence,undefined,String(untouchedSequence),'user_data/confirm')).operations,[unpaid]);
              assert.deepEqual(parse(await send(undefined,'user_data/confirm')).operations,[unpaid]);const unpaidSequence=sequence;
              assert.deepEqual(parse(await send(save({UserFamiliaDonationItem:[native]}),'user_data/push')).operations,[]);
              assert.equal(snapshot().receipts[0].charge_seen,1);assert.equal(snapshot().receipts[0].saved_day,null);
              const debitSaved=snapshot();assert.equal((await request(port,unpaidSequence,undefined,String(unpaidSequence),'user_data/confirm')).status,503);
              assert.deepEqual(snapshot(),debitSaved,'Unpaid complete marker cannot repeat after original debit saves');
              const zero={...operation,parameters:{consumedItem:{itemId,amount:0}}};
              assert.deepEqual(parse(await request(port,untouchedSequence,undefined,String(untouchedSequence),'user_data/confirm')).operations,[zero]);
              assert.deepEqual(parse(await send(undefined,'user_data/confirm')).operations,[zero]);
              saved=snapshot().receipts[0];
            }
          }
          for(const changed of [[],[{...first,userId:0}],[first,first],[{...first,cumulativeAmount:funded.cumulativeAmount-1}],
            [{...first,reservedAmount:-1}],[{...first,signature:0x100000000}]]) {
            const retained=snapshot();assert.equal((await send(save({UserFamiliaDonationItem:changed}),'user_data/push')).status,400);assert.deepEqual(snapshot(),retained);
          }
          if(saved.charge_seen) {
            const retained=snapshot();assert.equal((await send(save({UserFamiliaDonationItem:[{...first,amount:funded.amount}]}),'user_data/push')).status,400);assert.deepEqual(snapshot(),retained);
          }
          if(saved.before_state!==null) {
            const observed=JSON.parse(saved.observed);
            if(observed.count!==null) {
              const retained=snapshot();assert.equal((await send(save({UserFamiliaDonationItem:[{...first,donationCount:funded.donationCount}]}),'user_data/push')).status,400);assert.deepEqual(snapshot(),retained);
            }
            if(observed.at!==null && funded.lastDonatedAt!==observed.at) {
              const retained=snapshot();assert.equal((await send(save({UserFamiliaDonationItem:[{...first,lastDonatedAt:funded.lastDonatedAt}]}),'user_data/push')).status,400);assert.deepEqual(snapshot(),retained);
            }
            for(const changes of [{before_state:null,observed:'{"count":null,"at":null}',saved_day:null},
              {before_state:null,observed:null,saved_day:null},
              {before_state:saved.before_state,observed:'{"count":"yes","at":null}',saved_day:null},
              {before_state:saved.before_state,observed:JSON.stringify({count:null,at:issuedAt-86400}),saved_day:null},
              {before_state:saved.before_state,observed:saved.observed,saved_day:day(issuedAt)}]) {
              app.store.db.prepare('UPDATE familia_item_donation SET before_state=?,observed=?,saved_day=?').run(changes.before_state,changes.observed,changes.saved_day);
              const corrupt=snapshot();assert.equal((await send(save({}),'user_data/push')).status,503);assert.deepEqual(snapshot(),corrupt);
              app.store.db.prepare('UPDATE familia_item_donation SET before_state=?,observed=?,saved_day=NULL').run(saved.before_state,saved.observed);
            }
            if(saved.capture_version===2) {
              assert.deepEqual(observed,{count:null,at:callbackAt,erasedAt:now});
              for(const counter of [funded.donationCount,10,12]) {
                const retained=snapshot();assert.equal((await send(save({UserFamiliaDonationItem:[{...first,donationCount:counter}]}),'user_data/push')).status,400);
                assert.deepEqual(snapshot(),retained,'An actually erased counter cannot be restored to either invented pre-reset target');
              }
              for(const malformed of [{count:null,at:callbackAt},{...observed,count:10},{...observed,erasedAt:callbackAt},
                {...observed,erasedAt:String(now)}]) {
                app.store.db.prepare('UPDATE familia_item_donation SET observed=?').run(JSON.stringify(malformed));
                const corrupt=snapshot();assert.equal((await send(save({}),'user_data/push')).status,503);assert.deepEqual(snapshot(),corrupt);
                app.store.db.prepare('UPDATE familia_item_donation SET observed=?').run(saved.observed);
              }
              for(const version of [0,1]) {
                app.store.db.prepare('UPDATE familia_item_donation SET capture_version=?').run(version);
                const corrupt=snapshot();assert.equal((await send(save({}),'user_data/push')).status,503);assert.deepEqual(snapshot(),corrupt);
                app.store.db.prepare('UPDATE familia_item_donation SET capture_version=2').run();
              }
            }
            if(saved.capture_version===3) {
              assert.deepEqual(observed,{count:10,at:callbackAt,reconciledAt:now});
              for(const malformed of [{count:10,at:callbackAt},{...observed,count:null},{...observed,count:12},
                {...observed,reconciledAt:callbackAt},{...observed,reconciledAt:String(now)}]) {
                app.store.db.prepare('UPDATE familia_item_donation SET observed=?').run(JSON.stringify(malformed));
                const corrupt=snapshot();assert.equal((await send(save({}),'user_data/push')).status,503);assert.deepEqual(snapshot(),corrupt);
                app.store.db.prepare('UPDATE familia_item_donation SET observed=?').run(saved.observed);
              }
              for(const version of [0,1,2]) {
                app.store.db.prepare('UPDATE familia_item_donation SET capture_version=?').run(version);
                const corrupt=snapshot();assert.equal((await send(save({}),'user_data/push')).status,503);assert.deepEqual(snapshot(),corrupt);
                app.store.db.prepare('UPDATE familia_item_donation SET capture_version=3').run();
              }
            }
          }
        }
      }
      if(mode==='after-midnight') {now=(day(now)+1)*86400-32400;native.donationCount=0;}
      if(mode==='getter-midnight-after-reset') native.donationCount=0;
      if(mode==='getter-paused-count-then-reset') native.donationCount=0;
      const ackOnly=['paid-complete','paid-exhausted','paid-cost-progress','paid-count-progress','unpaid-count-progress',
          'paid-count-old-day','paid-count-zero-date','paid-date-progress','unpaid-date-progress',
          'paid-date-zero-date',
          'unpaid-progress'].includes(mode),savedItem=app.store.read('UserFamiliaDonationItem'),
        finalValue=save(ackOnly?{}:{UserFamiliaDonationItem:[native]},[operation]);
      for(const [table,event] of [['profile','UPDATE'],['familia_item_donation','UPDATE'],['operation_done','INSERT'],['reply_cache','INSERT']]) {
        if(ackOnly && table==='profile') continue;
        const pending=snapshot();app.store.db.exec(`CREATE TRIGGER donation_ack_fail BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'ACK rollback'); END`);
        assert.equal((await send(finalValue,'user_data/push')).status,503);assert.deepEqual(snapshot(),pending);app.store.db.exec('DROP TRIGGER donation_ack_fail');
      }
      const acknowledged=await send(finalValue,'user_data/push'),ackSequence=sequence;parse(acknowledged);
      if(ackOnly) assert.deepEqual(app.store.read('UserFamiliaDonationItem'),savedItem,'Real ACK-only completion preserves the already saved item row/token/signature/count/time');
      assert.deepEqual(app.store.operations(),[]);assert.deepEqual(app.store.read('UserFamiliaDonationItem').data,[native]);
      const complete=snapshot(),done=complete.receipts[0];assert.equal(complete.receipts.length,1);
      assert.equal(done.saved_day,day(callbackAt));assert.equal(done.saved_count,erasedCount?0:targetCount);
      if(erasedCount) {
        assert.equal(done.capture_version,2);assert.equal(done.charge_seen,1);
        assert.deepEqual(JSON.parse(done.observed),{count:null,at:callbackAt,erasedAt:now});
      }
      if(getterPaused && !erasedCount) {
        assert.equal(done.capture_version,3);assert.equal(done.charge_seen,1);
        assert.deepEqual(JSON.parse(done.observed),{count:10,at:callbackAt,reconciledAt:now});
      }
      assert.equal(complete.bank.contribution_point,850+10*master.familiaDonationItems[itemId].contribution);assert.equal(complete.bank.skill_point,6);
      await close();await open();assert.deepEqual(snapshot(),complete);
      assert.deepEqual((await request(port,ackSequence,finalValue,String(ackSequence),'user_data/push')).body,acknowledged.body);
      assert.equal((await request(port,issueSequence,value,String(issueSequence),'familia/donate/item')).status,503);assert.deepEqual(snapshot(),complete);
      assert.equal((await send(save({UserFamiliaDonationItem:[{...native,amount:funded.amount}]}),'user_data/push')).status,400);assert.deepEqual(snapshot(),complete);
      if(day(now)===day(callbackAt)) {
        assert.equal((await send(save({UserFamiliaDonationItem:[{...native,donationCount:targetCount-1}]}),'user_data/push')).status,400);assert.deepEqual(snapshot(),complete,
          'The completed daily floor belongs to the actual callback day, not necessarily its issue day');
      }
      if(done.before_state!==null) {
        for(const changes of [{before_state:done.before_state,observed:done.observed,saved_day:null,saved_count:done.saved_count},
          {before_state:null,observed:null,saved_day:done.saved_day,saved_count:done.saved_count},
          ...(erasedCount?[{before_state:done.before_state,observed:done.observed,saved_day:done.saved_day,saved_count:10}]:[]),
          ...(done.capture_version===3?[{before_state:done.before_state,observed:done.observed,saved_day:done.saved_day,saved_count:0}]:[])]) {
          app.store.db.prepare('UPDATE familia_item_donation SET before_state=?,observed=?,saved_day=?,saved_count=?')
            .run(changes.before_state,changes.observed,changes.saved_day,changes.saved_count);
          const missing=snapshot();assert.equal((await send(save({UserFamiliaDonationItem:[native]}),'user_data/push')).status,503);assert.deepEqual(snapshot(),missing);
          app.store.db.prepare('UPDATE familia_item_donation SET before_state=?,observed=?,saved_day=?,saved_count=?')
            .run(done.before_state,done.observed,done.saved_day,done.saved_count);
        }
        if(done.capture_version>=2) {
          app.store.db.prepare('UPDATE familia_item_donation SET charge_seen=0').run();
          const corrupt=snapshot();assert.equal((await send(save({UserFamiliaDonationItem:[native]}),'user_data/push')).status,503);assert.deepEqual(snapshot(),corrupt);
          app.store.db.prepare('UPDATE familia_item_donation SET charge_seen=1').run();
          for(const version of [0,1,...(done.capture_version===3?[2]:[])]) {
            app.store.db.prepare('UPDATE familia_item_donation SET capture_version=?').run(version);
            const missing=snapshot();assert.equal((await send(save({UserFamiliaDonationItem:[native]}),'user_data/push')).status,503);assert.deepEqual(snapshot(),missing);
            app.store.db.prepare('UPDATE familia_item_donation SET capture_version=?').run(done.capture_version);
          }
          const laterClock=now;now=callbackAt;
          // Synthetic floor lookup only, not native backwards-clock acceptance.
          const retained=snapshot();assert.equal((await send(save({UserFamiliaDonationItem:[{...native,donationCount:9}]}),'user_data/push')).status,400);
          assert.deepEqual(snapshot(),retained,'Unknown erased targets use guaranteed quantity; actually observed delayed counts retain their actual daily floor');
          now=laterClock;
        }
      }
    }
    console.log('Familia Faith Stones: original costs/caps, level reward once, saved-cost/count/full-callback recovery, rollback, stale saves, split ACK, midnight and restart: OK');
  } finally {
    await close();
    assert.equal(fs.realpathSync(path.dirname(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('danmemore-familia-donation-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
