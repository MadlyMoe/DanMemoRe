'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('./danmemore_server.cjs');
const { get,request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-billing-'));
  const database = path.join(directory, 'profile.sqlite');
  let app, port;
  const open = async () => {
    app = createServer({ database, seed, master, eventDate:'2024-06-20T12:00:00Z',
      wallNowSeconds:()=>2000000000, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const purchase = (body, token) => new Promise((resolve, reject) => {
    const wire = Buffer.from(JSON.stringify(body));
    const req = http.request({ host: '127.0.0.1', port, path: '/billing/v1.0/payment/purchase', method: 'POST', headers: {
      'Content-Type': 'application/json', 'Content-Length': wire.length,
      ...(token ? { 'X-GREE-GAMELIB': encodeURIComponent(`authVersion=1&paymentApiToken=${token}&appVersion=15.1.0`) } : {}),
    } }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject); req.end(wire);
  });
  try {
    await open();
    const listing = JSON.parse((await get(port, '/billing/v1.0/payment/productlist')).body);
    assert.equal(listing.result, 'OK'); assert.equal(listing.entry.products.length, 6);
    assert.deepEqual(listing.entry.products.map(product => product.charge_gem), [10, 50, 110, 300, 640, 1400]);
    assert.deepEqual(listing.entry.products.map(product => product.product_id), [
      'com.us.danmemo.gem10', 'com.us.danmemo.gem50', 'com.us.danmemo.gem110',
      'com.us.danmemo.gem300', 'com.us.danmemo.gem640', 'com.us.danmemo.gem1400',
    ], 'Catalog IDs must match the final client master-data rows');
    assert.deepEqual(listing.entry.products.map(product => product.thumbnail_url),
      ['gem10.png', 'gem50.png', 'gem110.png', 'gem300.png', 'gem640.png', 'gem1400.png']);
    const memberships = JSON.parse((await get(port, '/billing/v1.0/payment/subscription/productlist')).body).entry.products;
    assert.deepEqual(memberships.map(product => product.product_id),
      ['com.us.danmemo.subscription.tier1','com.us.danmemo.subscription.tier2']);
    assert.ok(memberships.every(product => product.price === 0 && product.product_type === 2));
    const product = listing.entry.products[0], body = { product_id: product.product_id,
      country_code: product.country_code, currency_code: product.currency_code, translated_name: product.name,
      formatted_price: product.formatted_price, price: String(product.price) };
    assert.equal((await purchase(body)).status, 400);
    assert.equal((await purchase({ ...body, product_id: 'not-a-product' }, 'A'.repeat(32))).status, 400);
    app.store.db.exec("CREATE TRIGGER reject_billing_purchase BEFORE INSERT ON billing_purchase BEGIN SELECT RAISE(ABORT,'purchase rollback'); END");
    assert.equal((await purchase(body, 'B'.repeat(32))).status, 503);
    assert.equal(app.store.paidCurrency(), 0, 'Wallet credit rolls back with the receipt');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM iris_transaction').get().n,0,'A failed purchase leaves no history entry');
    app.store.db.exec('DROP TRIGGER reject_billing_purchase');
    const history = async (query='') => JSON.parse((await get(port, `/billing/v1.0/payment/history${query}`)).body);
    assert.deepEqual((await history()).entry,{ offset:0,limit:100,has_next:false,transactions:[] });
    const first = await purchase(body, 'C'.repeat(32));
    assert.equal(first.status, 200); assert.equal(JSON.parse(first.body).product_id, product.product_id);
    assert.equal(app.store.paidCurrency(), 10);
    assert.deepEqual(await purchase(body, 'C'.repeat(32)), first, 'A lost response replays the same order');
    assert.equal(app.store.paidCurrency(), 10);
    assert.equal((await purchase({ ...body, price: 0 }, 'C'.repeat(32))).status, 400);
    assert.equal(app.store.paidCurrency(), 10, 'A conflicting retry cannot credit again');
    assert.equal((await purchase(body, 'D'.repeat(32))).status, 200);
    assert.equal(app.store.paidCurrency(), 20);
    for (const [index,item] of listing.entry.products.slice(1).entries()) {
      assert.equal((await purchase({ product_id:item.product_id,country_code:item.country_code,currency_code:item.currency_code,
        translated_name:item.name,formatted_price:item.formatted_price,price:String(item.price) },
      String(index+1).repeat(32))).status,200);
    }
    const receipts = app.store.db.prepare('SELECT * FROM billing_purchase ORDER BY created_at DESC,purchase_id').all();
    const historyReceipts=app.store.db.prepare(`SELECT b.* FROM billing_purchase b JOIN iris_transaction t
      ON t.purchase_key=b.request_key ORDER BY t.created_at DESC,t.id DESC`).all();
    const baseline = JSON.stringify({ profiles:app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),
      operations:app.store.operations(),paid:app.store.paidCurrency(),free:app.store.hardCurrency(),receipts,
      journal:app.store.db.prepare('SELECT * FROM iris_transaction ORDER BY id').all() });
    const fullHistory = await history();
    assert.equal(fullHistory.entry.transactions.length,7);
    assert.equal(fullHistory.entry.has_next,false);
    for (const [index,row] of fullHistory.entry.transactions.entries()) {
      const item = listing.entry.products.find(item => item.product_id === historyReceipts[index].product_id);
      assert.deepEqual(row,{ transaction_type:2,date:'2024-06-20T12:00:00Z',reason:`Offline purchase: ${item.name}`,
        balance_change_charge:item.charge_gem,balance_change_free:0,price:0,formatted_price:'Free (Offline)' });
      const page = (await history(`?offset=${index}&limit=1`)).entry;
      assert.deepEqual(page.transactions,[row]); assert.equal(page.has_next,index<6);
    }
    assert.deepEqual((await history('?offset=7&limit=1')).entry.transactions,[]);
    assert.deepEqual((await history('?limit=0')).entry,{ offset:0,limit:0,has_next:false,transactions:[] });
    for (const query of ['offset=2147483648','offset=-1','offset=','offset=1e2','offset=0&offset=1',
      'limit=1001','limit=-1','limit=1.5','limit=','limit=1&limit=2']) {
      assert.equal((await get(port,`/billing/v1.0/payment/history?${query}`)).status,400);
      assert.equal((await get(port,`/billing/v1.0/payment/subscription/history?${query}`)).status,400);
    }
    assert.equal(JSON.stringify({ profiles:app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),
      operations:app.store.operations(),paid:app.store.paidCurrency(),free:app.store.hardCurrency(),
      receipts:app.store.db.prepare('SELECT * FROM billing_purchase ORDER BY created_at DESC,purchase_id').all(),
      journal:app.store.db.prepare('SELECT * FROM iris_transaction ORDER BY id').all() }),baseline,
    'History pages and rejected queries cannot change the save, balances, queue or purchase receipts');
    const original = receipts.find(row => row.request_key === `${'C'.repeat(32)}:${product.product_id}`);
    for (const [column,damaged] of [['paid_amount',999],['free_amount',1],['created_at',-1],['response','{}'],
      ['body_hash','corrupt'],['purchase_id','unknown'],['product_id','unknown']]) {
      app.store.db.prepare(`UPDATE billing_purchase SET ${column}=? WHERE request_key=?`).run(damaged,original.request_key);
      assert.equal((await get(port,'/billing/v1.0/payment/history')).status,503);
      assert.equal((await purchase(body,'C'.repeat(32))).status,503,'A corrupt receipt cannot be replayed or credit again');
      app.store.db.prepare(`UPDATE billing_purchase SET ${column}=? WHERE request_key=?`).run(original[column],original.request_key);
    }
    assert.equal(app.store.paidCurrency(),2520);
    const journal=app.store.db.prepare('SELECT * FROM iris_transaction ORDER BY id DESC LIMIT 1').get();
    for(const [column,damaged] of [['transaction_type',1],['reason',''],['created_at',-1],['free_after',-1],
      ['paid_before',0],['purchase_key','unknown']]) {
      app.store.db.prepare(`UPDATE iris_transaction SET ${column}=? WHERE id=?`).run(damaged,journal.id);
      assert.equal((await get(port,'/billing/v1.0/payment/history')).status,503,'Corrupt journal rows are retained, not skipped');
      app.store.db.prepare(`UPDATE iris_transaction SET ${column}=? WHERE id=?`).run(journal[column],journal.id);
    }
    const journalPurchase=app.store.db.prepare('SELECT * FROM billing_purchase WHERE history_id=?').get(journal.id);
    app.store.db.prepare('UPDATE billing_purchase SET history_id=? WHERE request_key=?').run(-1,journalPurchase.request_key);
    assert.equal((await get(port,'/billing/v1.0/payment/history')).status,503,'A malformed new-purchase history pointer cannot become legacy success');
    app.store.db.prepare('UPDATE billing_purchase SET history_id=? WHERE request_key=?').run(journal.id,journalPurchase.request_key);
    app.store.db.prepare('DELETE FROM iris_transaction WHERE id=?').run(journal.id);
    assert.equal((await get(port,'/billing/v1.0/payment/history')).status,503,'A missing recorded purchase journal is retained for reconciliation');
    app.store.db.prepare(`INSERT INTO iris_transaction(id,created_at,transaction_type,reason,free_before,paid_before,free_after,paid_after,purchase_key)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(journal.id,journal.created_at,journal.transaction_type,journal.reason,journal.free_before,
        journal.paid_before,journal.free_after,journal.paid_after,journal.purchase_key);
    await close(); await open();
    assert.deepEqual(await purchase(body, 'C'.repeat(32)), first, 'Purchase receipt survives restart');
    assert.deepEqual(await history(),fullHistory,'Indexed immutable purchase history survives restart');
    assert.equal(app.store.paidCurrency(),2520);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) count FROM billing_purchase').get().count,7);
    // Emulate a genuinely older receipt without a journal. No wallet replay or
    // invented pre-upgrade spending/earning history is allowed.
    const oldJournal=app.store.db.prepare('SELECT * FROM iris_transaction ORDER BY id LIMIT 1').get();
    app.store.db.prepare('UPDATE billing_purchase SET history_id=NULL WHERE request_key=?').run(oldJournal.purchase_key);
    app.store.db.prepare('DELETE FROM iris_transaction WHERE id=?').run(oldJournal.id);
    assert.equal((await history()).entry.transactions.length,7,'A known legacy purchase remains visible exactly once');
    assert.equal(app.store.paidCurrency(),2520);
    app.store.db.prepare(`INSERT INTO iris_transaction(id,created_at,transaction_type,reason,free_before,paid_before,free_after,paid_after,purchase_key)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(oldJournal.id,oldJournal.created_at,oldJournal.transaction_type,oldJournal.reason,
        oldJournal.free_before,oldJournal.paid_before,oldJournal.free_after,oldJournal.paid_after,oldJournal.purchase_key);
    app.store.db.prepare('UPDATE billing_purchase SET history_id=? WHERE request_key=?').run(oldJournal.id,oldJournal.purchase_key);
    const snapshot=()=>JSON.stringify({wallet:app.store.db.prepare('SELECT * FROM hard_currency').all(),
      journal:app.store.db.prepare('SELECT * FROM iris_transaction ORDER BY id').all(),
      receipts:app.store.db.prepare('SELECT * FROM billing_purchase ORDER BY request_key').all(),
      profiles:app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),operations:app.store.operations()});
    const noOp=snapshot();
    app.store.changeHardCurrency(0);app.store.changePaidCurrency(0);app.store.spendHardCurrency(0);
    assert.equal(snapshot(),noOp,'Zero changes never create phantom history');
    app.store.db.exec("CREATE TRIGGER reject_iris_history BEFORE INSERT ON iris_transaction BEGIN SELECT RAISE(ABORT,'history rollback'); END");
    assert.throws(()=>app.store.changeHardCurrency(31,'Synthetic reward'));
    assert.equal(snapshot(),noOp,'A standalone wallet change rolls back if its history cannot persist');
    assert.equal((await purchase(body,'E'.repeat(32))).status,503);
    assert.equal(snapshot(),noOp,'Purchase, history and wallet share the same rollback');
    app.store.db.exec('DROP TRIGGER reject_iris_history');
    app.store.changeHardCurrency(31,'Synthetic reward');
    app.store.spendHardCurrency(40,'Synthetic mixed-balance spending');
    app.store.changePaidCurrency(-5,'Synthetic paid-only spending');
    const expected=[{transaction_type:1,date:'2024-06-20T12:00:00Z',reason:'Synthetic paid-only spending',
        balance_change_charge:-5,balance_change_free:0},
      {transaction_type:1,date:'2024-06-20T12:00:00Z',reason:'Synthetic mixed-balance spending',
        balance_change_charge:-9,balance_change_free:-31},
      {transaction_type:3,date:'2024-06-20T12:00:00Z',reason:'Synthetic reward',balance_change_charge:0,balance_change_free:31}];
    assert.deepEqual((await history('?limit=3')).entry.transactions,expected);
    assert.equal((await history()).entry.transactions.length,10,'A mixed debit is ONE entry, not one per wallet bucket');
    assert.equal(app.store.paidCurrency(),2506);assert.equal(app.store.hardCurrency(),0);
    const valid=snapshot();
    for(const change of [()=>app.store.changeHardCurrency(-1),()=>app.store.changePaidCurrency(-2507),
      ()=>app.store.changeHardCurrency(1000000000),()=>app.store.changeHardCurrency(1,''),
      ()=>app.store.changeIrisBalances(1,-1,'Invalid conversion')]) {
      assert.throws(change,error=>error.status===400);assert.equal(snapshot(),valid);
    }
    // An actual existing Present route must journal its known Iris credit once,
    // even while its client-owned claim flag/2000 ACK remain pending.
    const gifts=[{userId:seed.userId,id:99,itemId:master.currencies['currency.gem'],amount:11,title:'Synthetic Iris present',
      message:'',senderType:1,senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,
      pcLimitBreakCount:0,pcHeroSublimateCount:0,state:0,startAt:1718884800,expireAt:1718884800+86400,createdAt:1718884800,dynamodbExpireAt:0}];
    const giftData=JSON.stringify(gifts);
    app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(giftData,crypto.createHash('md5').update(giftData).digest('hex'),'UserGift');
    const giftBody={userId:seed.userId,giftIds:[99]},gift=await request(port,1,giftBody,'1','gift/receive');
    assert.equal(gift.status,200,gift.body.toString());
    assert.equal((await request(port,1,giftBody,'1','gift/receive')).status,200);
    assert.equal(app.store.hardCurrency(),11);
    const earned=(await history('?limit=1')).entry.transactions[0];
    assert.deepEqual(earned,{transaction_type:3,date:'2024-06-20T12:00:00Z',reason:'Offline Present reward',
      balance_change_charge:0,balance_change_free:11});
    const retained=snapshot(),earnedHistory=await history();
    await close();await open();
    assert.deepEqual(await history(),earnedHistory);assert.equal(snapshot(),retained,'Reading/restart do not replay wallet transactions');
    console.log('Offline billing: six products, actual Iris credit/spend journal, paginated native-shaped history, atomic retry/rollback and legacy/corrupt receipt preservation OK; native acceptance pending');
  } finally {
    await close();
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('danmemore-billing-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
