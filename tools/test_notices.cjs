'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const gachaArt = require('../data/danmemore-gacha-art.json');
const { gachaDetails, scratchDetails, packDetails, eventBoxDetails, poolRates } = require('./gacha_details.cjs');

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-notice-test-'));
  const app = createServer({ database: path.join(root, 'profile.sqlite'), seed, master, gachaArt, log: () => {} });
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const port = app.server.address().port;
    const snapshot = () => Object.fromEntries(['profile','runtime','hard_currency','operation_queue','operation_done','reply_cache']
      .map(table => [table, app.store.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
    await request(port, 0, undefined, '50', 'user/login');
    const promotionReply = await request(port, 1, undefined, '51', 'notice/promotion/show');
    const promotion = JSON.parse(promotionReply.body);
    assert.equal(promotion.code, 0); assert.match(promotion.html, /DanMemoRe Offline/);
    assert.equal((await request(port, 1, undefined, '51', 'notice/promotion/show')).body,promotionReply.body,
      'Unchanged promotion handoff retains its exact cached response');
    const animeReply = await request(port, 2, undefined, '52', 'notice/anime/get');
    const anime = JSON.parse(animeReply.body);
    assert.equal(anime.code, 0); assert.equal(anime.url, 'http://127.0.0.1:28766/offline/notice');
    assert.equal((await request(port, 2, undefined, '52', 'notice/anime/get')).body,animeReply.body,
      'Unchanged anime handoff retains its exact cached response');
    const promotionCache=app.store.db.prepare('SELECT body FROM reply_cache WHERE key=?').get('51/1'),
      damagedPromotion={code:0,html:'<p>obsolete publisher promotion</p>'};
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?')
      .run(Buffer.from(JSON.stringify(damagedPromotion)).toString('base64'),'51/1');
    const damaged=snapshot();
    assert.equal((await request(port,1,undefined,'51','notice/promotion/show')).status,503,
      'Altered cached promotion HTML cannot replace the bundled offline notice');
    assert.deepEqual(snapshot(),damaged,'Rejected cached promotion retains save and cache evidence');
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(promotionCache.body,'51/1');
    const animeHash=app.store.db.prepare('SELECT body_hash FROM reply_cache WHERE key=?').get('52/2'),beforeSpoof=snapshot();
    assert.equal((await request(port,2,{},'52','notice/anime/get',
      {'X-ARGO-REQUEST-BODY-HASH':animeHash.body_hash})).status,400,
    'A matching hash header cannot bypass the empty native request contract');
    assert.deepEqual(snapshot(),beforeSpoof,'Rejected notice request leaves saves and replies unchanged');
    assert.equal((await request(port, 3, {}, '53', 'notice/anime/get')).status, 400);
    const detailsReply = await request(port, 3, { lotteryId: 171000699 }, '54', 'notice/show');
    const details = JSON.parse(detailsReply.body);
    assert.equal(details.code, 0); assert.match(details.html, /Gacha Details/); assert.match(details.html, /Bel/);
    assert.match(details.html, /Ais/); assert.match(details.html, /1011001018/);
    assert.match(details.html, /Regalia Freese/); assert.match(details.html, /Complete pools/);
    assert.match(details.html, /Milestone guarantees/); assert.match(details.html, /Per-slot odds/);
    assert.match(details.html, /1%/);
    const stableDetails = await request(port, 3, { lotteryId: 171000699 }, '54', 'notice/show');
    assert.equal(stableDetails.status, 200); assert.equal(stableDetails.body, detailsReply.body,
      'Unchanged gacha details retain their exact cached response');
    assert.equal((await request(port, 4, { lotteryId: 0 }, '55', 'notice/show')).status, 400);
    assert.equal((await request(port, 4, { lotteryId: 999 }, '56', 'notice/show')).status, 400);
    const originalLotteryRows = app.store.read('UserLottery').data;
    const progressed=[...originalLotteryRows.filter(row=>row.lotteryId!==171000699),{userId:seed.userId,
      lotteryId:171000699,isNew:false,buttons:[{buttonType:2,count:1,lastPickedAt:0,loopCount:0,currentStepIndex:1}]}];
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify(progressed),'UserLottery');
    const staleDetails=snapshot();
    assert.equal((await request(port,3,{lotteryId:171000699},'54','notice/show')).status,503,
      'Cached gacha details cannot hide saved draw progress');
    assert.deepEqual(snapshot(),staleDetails,'Stale details recovery retains saved progress');
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify(originalLotteryRows),'UserLottery');
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([
      { userId: seed.userId + 1, lotteryId: 171000699, buttons: [] }]), 'UserLottery');
    assert.equal((await request(port, 4, { lotteryId: 171000699 }, 'foreign-notice', 'notice/show')).status, 400,
      'Gacha Details must not render a foreign saved lottery row');
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([
      { userId: seed.userId, lotteryId: 171000699, buttons: [
        { buttonType: 1, count: -1, lastPickedAt: 0, loopCount: 0, currentStepIndex: 1 }] }]), 'UserLottery');
    assert.equal((await request(port, 4, { lotteryId: 171000699 }, 'malformed-notice', 'notice/show')).status, 400,
      'Gacha Details must not render malformed saved purchase progress');
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify([
      { userId: seed.userId, lotteryId: 171000699, isNew: 'yes', buttons: [] }]), 'UserLottery');
    assert.equal((await request(port, 4, { lotteryId: 171000699 }, 'malformed-badge-notice', 'notice/show')).status, 400,
      'Gacha Details must not render a malformed saved New badge');
    app.store.db.prepare('UPDATE profile SET data=? WHERE name=?').run(JSON.stringify(originalLotteryRows), 'UserLottery');
    const scratchReply = await request(port, 5, { scratchId: 611000001 }, '57', 'notice/show');
    const scratch = JSON.parse(scratchReply.body);
    assert.equal(scratch.code, 0); assert.match(scratch.html, /Scratch Details/);
    assert.match(scratch.html, /gacha_ticket\.character_spa1/);
    assert.match(scratch.html, /Round 5/);
    assert.equal((await request(port, 5, { scratchId: 611000001 }, '57', 'notice/show')).body, scratchReply.body,
      'Unchanged scratch details retain their exact cached response');
    const adScratch = JSON.parse((await request(port, 6, { scratchId: 614000001 }, '58', 'notice/show')).body);
    assert.equal(adScratch.code, 0); assert.match(adScratch.html, /stamina_ticket\.jagamarukun/);
    assert.equal((await request(port, 7, { scratchId: 42 }, '59', 'notice/show')).status, 400);
    for (const [id, source] of [...Object.entries(master.scratches), ...Object.entries(master.adScratches)]) {
      const page = scratchDetails(Number(id), source);
      assert.ok(page?.includes('Scratch Details') && !page.includes('undefined'), `Archived scratch ${id}`);
    }
    const escapedScratch = scratchDetails(611000001, { ...master.scratches[611000001], name: '<script>bad</script>' });
    assert.ok(!escapedScratch.includes('<script>bad</script>') && escapedScratch.includes('&lt;script&gt;'));
    const packReply = await request(port, 8, { packId: 208000001 }, '60', 'notice/show');
    const pack = JSON.parse(packReply.body);
    assert.equal(pack.code, 0); assert.match(pack.html, /Archived pack contents/);
    assert.match(pack.html, /296000008/); assert.match(pack.html, /gacha_ticket\.start_dash/);
    assert.match(pack.html, /Shop product #207000001: 400 paid Iris/);
    assert.match(pack.html, /1 per lifetime/);
    assert.match(pack.html, /Available for 259200 seconds after the saved account creation time/);
    assert.equal((await request(port, 8, { packId: 208000001 }, '60', 'notice/show')).body, packReply.body,
      'Unchanged pack details retain their exact cached response');
    const datedPack = packDetails(208000002, master.shopPacks[208000002], master);
    assert.match(datedPack, /Shop product #207000142: 400 paid Iris/);
    assert.match(datedPack, /Catalog dates: 2017-09-29/);
    assert.equal(packDetails(208000001, master.shopPacks[208000001], { ...master, shopProducts: {} }), null);
    assert.match(packDetails(208000185, master.shopPacks[208000185], master), /Happy Golden Knife/);
    assert.match(packDetails(208000150, master.shopPacks[208000150], master), /Order Made Anniversary Dress/);
    const boxReply = await request(port, 9, { eventBoxId: 193000001 }, '61', 'notice/show');
    const box = JSON.parse(boxReply.body);
    assert.equal(box.code, 0); assert.match(box.html, /Archived event box/);
    assert.match(box.html, /Box 16/); assert.match(box.html, /Raw weight/);
    assert.equal((await request(port, 9, { eventBoxId: 193000001 }, '61', 'notice/show')).body, boxReply.body,
      'Unchanged event-box details retain their exact cached response');
    for (const [id, source] of Object.entries(master.shopPacks))
      assert.ok(packDetails(Number(id), source, master)?.includes('Archived pack contents'), `Archived pack ${id}`);
    for (const [id, source] of Object.entries(master.eventBoxes))
      assert.ok(eventBoxDetails(Number(id), source)?.includes('Archived event box'), `Archived event box ${id}`);
    for (const selector of [{ packId: 42 }, { eventBoxId: 42 }])
      assert.equal((await request(port, 10, selector, JSON.stringify(selector), 'notice/show')).status, 400);
    const readPage = (pathname, method = 'GET') => new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: pathname, method }, response => {
        const chunks = []; response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve({ status: response.statusCode, type: response.headers['content-type'],
          headers: response.headers, body: Buffer.concat(chunks).toString() }));
      });
      req.on('error', reject); req.end();
    });
    const page = await readPage('/offline/notice');
    assert.equal(page.status, 200); assert.equal(page.type, 'text/html; charset=utf-8'); assert.equal(page.body, promotion.html);
    // The real tutorial_completed WebView URL previously fell through to404.
    // This local page is not a fabricated publisher news feed or game operation.
    const beforeNotice = snapshot();
    const noticePath = '/api/asset/notice/index?q=1000000001&referer=tutorial_completed';
    for (const pathname of [noticePath, '/api/asset/notice/index?referer=%3Cscript%3Ebad%3C%2Fscript%3E']) {
      const notice = await readPage(pathname);
      assert.equal(notice.status, 200); assert.equal(notice.type, page.type); assert.equal(notice.body, page.body);
      assert.equal(notice.headers['cache-control'], 'no-store');
      assert.match(notice.body, /original online news feed is unavailable/);
      assert.ok(!notice.body.includes('<script>') && !notice.body.includes('tutorial_completed'));
    }
    const head = await readPage(noticePath, 'HEAD');
    assert.equal(head.status, 200); assert.equal(head.body, ''); assert.equal(head.type, page.type);
    assert.equal(Number(head.headers['content-length']), Buffer.byteLength(page.body));
    assert.equal((await readPage('/api/asset/notice/index/unknown')).status, 404, 'Do not mask unknown asset handoffs');
    assert.notEqual((await readPage(noticePath, 'POST')).status, 200, 'News reads cannot accept game writes');
    assert.deepEqual(snapshot(), beforeNotice, 'News GET/HEAD cannot change saves, wallets, queues, sequence or reply cache');
    const banner = gachaArt.banners.find(row => row.lotteryId === 171000699), lottery = master.lotteries[banner.lotteryId];
    const odds = poolRates(master, lottery.groupId, lottery);
    assert.equal(odds.rates.get(1011001018), 1); assert.equal(odds.rates.get(1011002024), 1);
    assert.ok(Math.abs([...odds.rates.values()].reduce((a, b) => a + b, 0) - 100) < 1e-10);
    const html = gachaDetails({ banner, master, catalog: gachaArt, savedButtons: [{ buttonType: 3, count: 0 }], now: 1571400000 });
    assert.match(html, /1 guaranteed slot\(s\).*Pool 172001217/);
    assert.match(html, /Full step-up schedule|Milestone guarantees/);
    const baseMiss = (1 - 0.02) ** 10;
    const guaranteed = poolRates(master, 172001217, lottery), fixedHit = (guaranteed.rates.get(1011001018) + guaranteed.rates.get(1011002024)) / 100;
    const multiChance = (100 * (1 - baseMiss * (1 - fixedHit))).toFixed(6).replace(/\.?0+$/, '');
    assert.ok(html.includes(`${multiChance}% chance of at least one featured unit`));
    const midnight = 1571410800;
    const daily = gachaDetails({ banner, master, catalog: gachaArt, savedButtons: [{ buttonType: 1, count: 1, lastPickedAt: midnight - 1 }], now: midnight });
    assert.match(daily, /1 \/ 1 purchases remaining/);
    // WRITTEN ONLY / NOT RUN: local daily receipts override a later-reset profile on an event-clock rewind.
    const recordedDaily=gachaDetails({banner,master,catalog:gachaArt,
      savedButtons:[{buttonType:1,count:0,lastPickedAt:0}],dailyClaimedButtons:[1],now:midnight});
    assert.match(recordedDaily,/0 \/ 1 purchases remaining/);
    assert.match(recordedDaily,/Already drawn on this selected JST day/);
    const scratchBanner = gachaArt.banners.find(row => row.lotteryId === 171000092);
    const scratchHtml = gachaDetails({ banner: scratchBanner, master, catalog: gachaArt, now: 1571400000 });
    assert.match(scratchHtml, /Button 1: scratch #611000001 \(first draw only\)/);
    assert.match(scratchHtml, /Button 3: scratch #611000001 \(recurring on eligible draws\)/);
    const importedBanner = gachaArt.banners.find(row => row.lotteryId === 171000122);
    const imported = gachaDetails({ banner: importedBanner, master, catalog: gachaArt,
      savedButtons: [{ buttonType: 3, count: 6, loopCount: 2, currentStepIndex: 2, lastPickedAt: 0 }], now: 1523793600 });
    assert.match(imported, /Button 3 · Draw 11<\/h3><b>250 Iris/);
    assert.match(imported, /6 completed purchase\(s\) · next step 2/);
    const invalidStep = gachaDetails({ banner: importedBanner, master, catalog: gachaArt,
      savedButtons: [{ buttonType: 3, count: 6, loopCount: 2, currentStepIndex: 0, lastPickedAt: 0 }], now: 1523793600 });
    assert.match(invalidStep, /Saved step-up progress is invalid/);
    for (const row of gachaArt.banners) {
      const pageHtml = gachaDetails({ banner: row, master, catalog: gachaArt, now: 1571400000 });
      assert.ok(pageHtml.includes('Complete pools') && !pageHtml.includes('NaN') && !pageHtml.includes('undefined'), String(row.lotteryId));
      if (row.source === 'original-pool-preview') assert.ok(pageHtml.includes('not claimed rate-up units'));
      const original = master.lotteries[row.lotteryId];
      if (original.selectionGroupIds?.length) assert.ok(pageHtml.includes('Selectable lineups') && pageHtml.includes('Your chosen unit'));
      if (original.buttons.some(button => button.stepUpGroupId)) assert.ok(pageHtml.includes('Full step-up schedule'));
    }
    const incomplete = { ...master, lotteryWeights: { ...master.lotteryWeights, 174000001: 0 } };
    assert.equal(poolRates(incomplete, lottery.groupId, lottery), null);
    const selectors = Object.values(master.lotteries).filter(row => row.selectionGroupIds?.length);
    assert.equal(selectors.length, 49);
    for (const selector of selectors) {
      for (const groupId of new Set([selector.groupId, ...selector.buttons.map(row => row.fixedGroupId)].filter(Boolean))) {
        const rates = poolRates(master, groupId, selector);
        assert.ok(rates, `Selector pool ${groupId} includes its original 3% chosen-unit contribution`);
        assert.equal([...rates.rates.values()].reduce((n, p) => n + p, 0).toFixed(6), '100.000000');
        for (const choice of ['choice-1','choice-2','choice-3']) assert.equal(rates.rates.get(choice), 1);
        assert.equal(poolRates(incomplete, groupId, selector), null, 'Missing selector weights are never normalized');
      }
    }
    const escaped = gachaDetails({ banner: { ...banner, title: '<script>bad</script>' }, master, catalog: gachaArt, now: 1571400000 });
    assert.ok(!escaped.includes('<script>bad</script>') && escaped.includes('&lt;script&gt;'));
    const orgion = master.lotteries[171002164];
    for (const groupId of [172003107, 172003108]) {
      const pool = poolRates(master, groupId, orgion);
      assert.deepEqual(pool.derivedWeightIds, [174000091]);
      assert.equal(pool.buckets.find(row => row.id === 174000091).weight, 2);
      assert.equal([...pool.rates.values()].reduce((sum, rate) => sum + rate, 0).toFixed(6), '100.000000');
      assert.equal(master.lotteryWeights[174000091], undefined, 'Reconstruction must not rewrite the original catalog');
      assert.equal(poolRates({ ...master, lotteryWeights: { ...master.lotteryWeights, 174000001: undefined } }, groupId, orgion), null,
        'A second missing original weight must not be silently filled');
    }
    const orgionPage = gachaDetails({ banner: gachaArt.banners.find(row => row.lotteryId === 171002164), master, catalog: gachaArt, now: 1693450800 });
    assert.match(orgionPage, /Weight 174000091 is absent.*2% rate is reconstructed/);
    assert.match(orgionPage, /Weight-bucket breakdown \(one reconstructed\)/);
    // WRITTEN ONLY: source duplicate rows are extra slots, not malformed pools.
    for (const [lotteryId, groupId, weightId, repeatedPcId] of [
      [171000047,172000078,174000008,1012036001],
      [171000276,172000527,174000003,1011001002]]) {
      const original=master.lotteries[lotteryId],entries=master.lotteryPools[groupId][weightId],
        multiplicity=entries.filter(id=>id===repeatedPcId).length,pool=poolRates(master,groupId,original),
        expected=Object.entries(master.lotteryPools[groupId]).reduce((rate,[id,pcs])=>
          rate+(master.lotteryWeights[id]??0)*pcs.filter(pcId=>pcId===repeatedPcId).length/pcs.length,0);
      assert.equal(multiplicity,2);assert.ok(pool);
      assert.ok(Math.abs(pool.rates.get(repeatedPcId)-expected)<1e-10);
      assert.equal([...pool.rates.values()].reduce((sum,rate)=>sum+rate,0).toFixed(6),'100.000000');
      const archived=gachaDetails({banner:gachaArt.banners.find(row=>row.lotteryId===lotteryId),
        master,catalog:gachaArt,now:original.startAt+3600});
      assert.ok(archived.includes(`Pool ${groupId}`) &&
        archived.includes('Repeated original unit entries each count as one pool slot') &&
        !archived.includes(`<article id="pool-${groupId}" class="pool"><h3>Pool ${groupId}</h3><p class="warning">`));
    }
    console.log('Notices and detailed gacha pages: tutorial-completed GET/HEAD/read-only handoff, all 2236 catalogs, exact bucket odds, guarantee probabilities, selected lineups, daily progress, and escaping OK; native render pending');
  } finally {
    await app.close();
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('danmemore-notice-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
