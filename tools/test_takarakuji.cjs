'use strict';

// Deferred synthetic save/ordering probes. No publisher draw, original odds,
// natural mission unlocks or native ticket/result UI acceptance is implied.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, OFFLINE_UNAVAILABLE_CODE } = require('./danmemore_server.cjs');
const { request } = require('./test_danmemore_server.cjs');
const { takarakujiDetails } = require('./gacha_details.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');
const lottoPrizes = require('../data/danmemore-lotto-prizes.json');
const md5 = rows => crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
const missions = Object.entries(master.achievements).filter(([, row]) => row.rewardType === 18);
const eventFor = reward => Number(Object.keys(master.takarakujiInfos).find(id =>
  master.takarakujiInfos[id].itemId === master.takarakujiItemIds[reward.rewardKey]));

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'danmemore-takarakuji-'));
  const realNow = Date.now;
  let database, app, port, sequence = 0, now = 1;
  Date.now = () => now * 1000;
  const open = async () => {
    app = createServer({ database, seed, master, log: () => {} });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); port = app.server.address().port;
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const fresh = async name => { await close(); database = path.join(directory, `${name}.sqlite`); await open(); };
  const send = (action, body) => request(port, ++sequence, body, String(sequence), action);
  const parse = reply => { assert.equal(reply.status, 200, reply.body.toString()); return JSON.parse(reply.body); };
  const put = (name, rows) => app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?')
    .run(JSON.stringify(rows), md5(rows), name);
  const snapshot = () => JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({ name }) => [name, app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all()]));
  const push = (putItems = {}, operations = [], deleteItems = {}) => send('user_data/push', {
    badges: null, scripts: {}, dataTokens: {}, checksums: { before: {}, after: Object.fromEntries(
      [...new Set([...Object.keys(putItems), ...Object.keys(deleteItems)])].map(name => [name, md5(putItems[name] ?? [])])) },
    deltas: Object.keys(putItems).length || Object.keys(deleteItems).length
      ? [{ signature: 0, trigger: putItems.UserGift || deleteItems.UserGift ? 'GiftReceive' : 'TakarakujiStateUpdate', putItems, deleteItems }] : [],
    operations: operations.map(row => ({ id: row.id, verifier: row.token })),
  });
  const rowFor = id => ({ userId: seed.userId, achievementId: Number(id), completedAt: now,
    lastResetAt: 0, progressParam: 1, readState: 1, signature: 0, state: 3 });
  const claim = rows => send('achievement/complete', { achievementIds: rows.map(({ achievementId, completedAt }) => ({ achievementId, completedAt })) });
  const gift = (id,itemId,amount) => ({ userId:seed.userId,id,itemId,amount,title:'Synthetic saved Lotto present',message:'',
    senderType:1,senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,
    pcLimitBreakCount:0,pcHeroSublimateCount:0,state:0,startAt:now,expireAt:now + 100,createdAt:now,dynamodbExpireAt:0 });
  const receive = gifts => send('gift/receive',{ userId:seed.userId,giftIds:gifts.map(row => row.id) });
  const view = id => send('takarakuji/get', { takarakujiInfoId: id });
  const details = id => send('notice/show', { lottoOrarioId: id });
  const displayed = (reply, id, count, state = 'pending') => {
    const response = parse(reply);
    assert.deepEqual(Object.keys(response).sort(), ['code','html']);
    assert.equal(response.code, 0);
    assert.ok(response.html.includes(`data-lotto-event="${id}"`));
    assert.ok(response.html.includes(`data-ticket-count="${count}"`));
    assert.ok(response.html.includes(`data-lotto-result="${state}"`));
    assert.match(response.html,state==='published' ? /Offline result published/ : /Results pending|Offline result ready/);
    assert.doesNotMatch(response.html, /<script|<img|https?:\/\/|NaN|undefined/);
    return response.html;
  };
  const expectedTickets = (id, amount) => Array.from({ length: amount }, (_, index) => ({ userId: seed.userId,
    takarakujiInfoId: id, number: index + 1, prize: 99999999 }));
  const drawAt = id => ({56000000002:1545292800,56000000011:1689580800}[id] ??
    Math.max(master.takarakujiInfos[id].startAt+1,master.takarakujiInfos[id].endAt-14*86400));
  const resultTickets = (id,amount) => {
    const rankCount=id===56000000001?8:6,range=10**(rankCount-1);
    return Array.from({length:amount},(_,index)=>{
      const number=index+1,roll=crypto.createHash('sha256').update(`offline-geometric-v1:${id}:${number}`)
        .digest().readUInt32BE(0)%range;
      let prize=rankCount;for(let rank=1;rank<rankCount;rank++) if(roll<10**(rank-1)){prize=rank;break;}
      return {userId:seed.userId,takarakujiInfoId:id,number,prize};
    });
  };
  const payoutItems=(id,tickets)=>{
    const ranks=lottoPrizes[String(id-56000000000)],totals=new Map();
    if(!ranks) return [];
    for(const ticket of tickets) for(const [itemId,amount] of ranks[ticket.prize-1])
      totals.set(itemId,(totals.get(itemId)??0)+amount);
    const items=[];
    for(const [itemId,total] of [...totals].sort((a,b)=>a[0]-b[0]))
      for(let remaining=total;remaining>0;remaining-=Math.min(remaining,999999999))
        items.push({itemId,amount:Math.min(remaining,999999999)});
    return items;
  };
  const unavailable = async response => {
    assert.equal(response.status, 503);
    assert.equal(response.headers['x-argo-server-response-code'], String(OFFLINE_UNAVAILABLE_CODE));
    const body = JSON.parse(response.body); assert.equal(body.code, OFFLINE_UNAVAILABLE_CODE);
    assert.equal(body.offlineUnavailable, true); assert.equal(body.operations, undefined);
  };
  try {
    // All11 authored events; pending means no published draw, not no-win0.
    for (const [eventId, event] of Object.entries(master.takarakujiInfos)) {
      const id = Number(eventId); now = event.startAt; await fresh(`event-${id}`);
      const balance = app.store.hardCurrency();
      const notice = await details(id), noticeIdentity = sequence, html = displayed(notice, id, 0);
      const season = id - 56000000000, ranks = {1:8,2:6,3:6,4:6,11:6}[season] ?? 0;
      assert.equal((html.match(/data-prize-rank=/g) ?? []).length,ranks);
      if (!ranks) assert.match(html,/No prize-content rows for this season/);
      if (season === 1) assert.match(html,/pc_ticket\.select_adventurer_4 × 5/);
      if (season === 11) {
        assert.match(html,/Season 11 has content rows but no matching gift heading rows/);
        assert.match(html,/drawing on 17 July 2023 \(labeled PST\)/);
        assert.match(html,/no draw hour or result-publication time/);
      } else assert.doesNotMatch(html,/drawing on 17 July 2023/);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM takarakuji_pending_event').get().n, 0,
        'A details read cannot authorize a later result effect');
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM takarakuji_ticket_claim').get().n, 0);
      const originalMissions = missions.filter(([, reward]) => eventFor(reward) === id);
      for (const [missionId, mission] of originalMissions)
        assert.ok(html.includes(`data-mission-id="${missionId}"><td>${missionId}</td><td>${mission.rewardAmount}</td>`));
      if (!originalMissions.length) assert.match(html, /No ticket mission rows/);
      assert.equal((html.match(/data-mission-id=/g) ?? []).length, originalMissions.length);
      assert.deepEqual((await request(port, noticeIdentity, { lottoOrarioId: id }, String(noticeIdentity), 'notice/show')).body, notice.body);
      const response = await view(id), identity = sequence, result = parse(response);
      assert.deepEqual(result, { code: 0, UserTakarakujiInfo: { userId: seed.userId, takarakujiInfoId: id, playResultEffect: false },
        player: { prize: 99999999 }, tickets: [] });
      assert.equal(app.store.hardCurrency(), balance); assert.deepEqual(app.store.operations(), []);
      assert.deepEqual(app.store.read('UserTakarakujiInfo').data, []);
      for (const body of [null, {}, { takarakujiInfoId: String(id) }, { takarakujiInfoId: -1 },
        { takarakujiInfoId: id, extra: 1 }, { takarakujiInfoId: 1 }]) {
        const before = snapshot(); assert.equal((await send('takarakuji/get', body)).status, 400); assert.equal(snapshot(), before);
      }
      for (const body of [null, {}, { lottoOrarioId: String(id) }, { lottoOrarioId: -1 },
        { lottoOrarioId: id, extra: 1 }, { lottoOrarioId: 1 }]) {
        const before = snapshot(); assert.equal((await send('notice/show', body)).status, 400); assert.equal(snapshot(), before);
      }
      for (const time of [event.startAt - 1, event.endAt, event.endAt + 1]) {
        now = time; const before = snapshot(); await unavailable(await view(id)); assert.equal(snapshot(), before);
        await unavailable(await request(port, identity, { takarakujiInfoId: id }, String(identity), 'takarakuji/get'));
        await unavailable(await details(id));
        await unavailable(await request(port, noticeIdentity, { lottoOrarioId: id }, String(noticeIdentity), 'notice/show'));
        assert.equal(snapshot(), before, 'Cached reads cannot reopen an expired or not-yet-active event');
      }
      now = event.endAt - 1; assert.deepEqual(parse(await view(id)).tickets, []);
      displayed(await details(id), id, 0, 'published');
    }

    now = master.takarakujiInfos[56000000011].startAt;
    await fresh('view-identity');
    const durableView=await view(56000000011),durableIdentity=sequence,durableResult=parse(durableView);
    const durableRequest=app.store.db.prepare('SELECT * FROM takarakuji_request WHERE request_key=?')
      .get(`${durableIdentity}/${durableIdentity}`);
    assert.equal(durableRequest.info_id,56000000011);
    assert.match(durableRequest.body_hash,/^[0-9a-f]{32}$/);
    assert.equal(durableRequest.response,JSON.stringify(durableResult));
    app.store.beginSession();await close();await open();
    assert.deepEqual((await request(port,durableIdentity,{takarakujiInfoId:56000000011},String(durableIdentity),'takarakuji/get')).body,
      durableView.body,'Exact Lotto view keeps its original response after cache eviction and restart');
    const crossRoute=snapshot();
    assert.equal((await request(port,durableIdentity,{lottoOrarioId:56000000011},String(durableIdentity),'notice/show')).status,400);
    assert.equal(snapshot(),crossRoute,'A Lotto request identity cannot be reused by another route');
    const legacyView=await view(56000000011),legacyViewIdentity=sequence;
    app.store.db.prepare('DELETE FROM takarakuji_request WHERE request_key=?').run(`${legacyViewIdentity}/${legacyViewIdentity}`);
    const legacyViewState=snapshot();
    await unavailable(await request(port,legacyViewIdentity,{takarakujiInfoId:56000000011},String(legacyViewIdentity),'takarakuji/get'));
    assert.equal(snapshot(),legacyViewState,'A legacy cache cannot impersonate a durable Lotto request receipt');
    const corruptView=await view(56000000011),corruptViewIdentity=sequence;
    app.store.db.prepare('UPDATE takarakuji_request SET response=? WHERE request_key=?')
      .run('{}',`${corruptViewIdentity}/${corruptViewIdentity}`);
    const corruptViewState=snapshot();
    await unavailable(await request(port,corruptViewIdentity,{takarakujiInfoId:56000000011},String(corruptViewIdentity),'takarakuji/get'));
    assert.equal(snapshot(),corruptViewState,'A corrupt permanent Lotto snapshot is retained for reconciliation');
    const markerView=await view(56000000011),markerViewIdentity=sequence;
    app.store.db.prepare('DELETE FROM takarakuji_pending_event WHERE info_id=?').run(56000000011);
    const missingMarker=snapshot();
    await unavailable(await request(port,markerViewIdentity,{takarakujiInfoId:56000000011},String(markerViewIdentity),'takarakuji/get'));
    assert.equal(snapshot(),missingMarker,'A permanent Lotto response cannot outlive its pending-event receipt');

    await fresh('legacy-notice');
    const legacyNotice = await details(56000000011), legacyIdentity = sequence;
    displayed(legacyNotice, 56000000011, 0);
    app.store.db.prepare('UPDATE reply_cache SET body=? WHERE key=?').run(
      Buffer.from(JSON.stringify({ code: 0, html: '<h1>DanMemoRe Offline</h1>' })).toString('base64'), `${legacyIdentity}/${legacyIdentity}`);
    const oldPlaceholder = snapshot();
    await unavailable(await request(port, legacyIdentity, { lottoOrarioId: 56000000011 }, String(legacyIdentity), 'notice/show'));
    assert.equal(snapshot(), oldPlaceholder, 'Legacy placeholder reads cannot bypass current ticket details');
    displayed(await details(56000000011), 56000000011, 0);
    app.store.db.exec("CREATE TRIGGER fail_notice_reply BEFORE INSERT ON reply_cache BEGIN SELECT RAISE(ABORT,'notice rollback'); END");
    const noticeRollback = snapshot(), failedNotice = await details(56000000011);
    assert.equal(failedNotice.status, 503); assert.equal(failedNotice.body.length, 0); assert.equal(snapshot(), noticeRollback);
    app.store.db.exec('DROP TRIGGER fail_notice_reply');
    displayed(await details(56000000011), 56000000011, 0);
    const event = master.takarakujiInfos[56000000011], lottoItem = master.takarakujiItems[event.itemId];
    const escaped = takarakujiDetails({ id: 56000000011, event: { ...event, name: '<script>name</script>' },
      item: { ...lottoItem, name: '<img src=x>', description: '"<&\'' }, missions, ticketCount: 4096, now,
      items: master.items });
    assert.doesNotMatch(escaped, /<script|<img|NaN|undefined/); assert.match(escaped, /&lt;script&gt;/);
    assert.match(escaped, /&lt;img src=x&gt;/); assert.match(escaped, /&quot;&lt;&amp;&#39;/);
    assert.ok(escaped.includes('data-ticket-count="4096"')); assert.match(escaped, /Saved numbers: 1–4096/);
    delete master.takarakujiItems[event.itemId];
    try {
      const incomplete = snapshot(); await unavailable(await details(56000000011)); await unavailable(await view(56000000011));
      assert.equal(snapshot(), incomplete, 'Incomplete original metadata cannot fall back to a generic successful notice');
    } finally { master.takarakujiItems[event.itemId] = lottoItem; }
    for (const table of ['takarakuji_pending_event', 'takarakuji_request', 'reply_cache']) {
      await fresh(`view-rollback-${table}`);
      app.store.db.exec(`CREATE TRIGGER fail_pending_view BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'view rollback'); END`);
      const before = snapshot(), failure = await view(56000000011);
      assert.equal(failure.status, 503); assert.equal(failure.body.length, 0); assert.equal(snapshot(), before);
      app.store.db.exec('DROP TRIGGER fail_pending_view');
      assert.deepEqual(parse(await view(56000000011)).tickets, []);
    }

    assert.equal(missions.length, 23);
    for (const [missionId, original] of missions) {
      now = original.startAt; await fresh(`mission-${missionId}`);
      const id = eventFor(original), itemId = master.takarakujiItemIds[original.rewardKey], row = rowFor(missionId);
      put('UserAchievement', [row]);
      const balance = app.store.hardCurrency(), nativeTables = JSON.stringify([
        app.store.read('UserTakarakujiInfo'), app.store.read('UserTakarakujiresultState')]);
      const response = await claim([row]), identity = sequence, result = parse(response), operation = result.operations[0];
      assert.equal(operation.type, 6000);
      assert.deepEqual(result.receivedItems, [{ itemId, amount: original.rewardAmount }]);
      assert.equal(master.itemProfiles[itemId], undefined);
      assert.equal(app.store.hardCurrency(), balance);
      assert.equal(JSON.stringify([app.store.read('UserTakarakujiInfo'), app.store.read('UserTakarakujiresultState')]), nativeTables,
        'No invented native ticket balance, signature or result flag');
      const receipt = app.store.db.prepare('SELECT * FROM takarakuji_ticket_claim WHERE operation_id=?').get(operation.id);
      assert.deepEqual({ ...receipt }, { operation_id: operation.id, item_id: itemId, info_id: id,
        first_number: 1, amount: original.rewardAmount, operation_json:null });
      const tickets = expectedTickets(id, original.rewardAmount);
      assert.deepEqual(parse(await view(id)).tickets, tickets, 'Issued server-owned numbers are visible while received flag is pending');
      displayed(await details(id), id, original.rewardAmount);
      const beforeAck = snapshot(); assert.equal((await push({}, [operation])).status, 400); assert.equal(snapshot(), beforeAck);
      parse(await push({ UserAchievement: [{ ...row, state: 4 }] })); await close(); await open();
      const interrupted = snapshot();
      await unavailable(await claim([row]));
      await unavailable(await request(port, identity, { achievementIds: [{ achievementId: row.achievementId, completedAt: row.completedAt }] },
        String(identity), 'achievement/complete'));
      assert.equal(snapshot(),interrupted); assert.deepEqual(app.store.operations(),[operation], 'Received flag alone cannot discard or redeliver the actual ticket queue');
      assert.deepEqual(parse(await view(id)).tickets, tickets);
      displayed(await details(id), id, original.rewardAmount);
      parse(await push({}, [operation]));
      assert.deepEqual(app.store.operations(), []);
      const corrected = parse(await push({ UserAchievement: [row] }));
      assert.equal(corrected.data.UserAchievement[0].state, 4);
      assert.equal(corrected.dataTokens.UserAchievement, md5([{ ...row, state: 4 }]));
      app.store.beginSession(); await close(); await open();
      const settled = snapshot(); assert.equal((await claim([row])).status, 400); assert.equal(snapshot(), settled);
      assert.deepEqual(parse(await view(id)).tickets, tickets);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM takarakuji_ticket_claim').get().n, 1);
      now = master.takarakujiInfos[id].endAt;
      const expired = snapshot(); await unavailable(await view(id)); assert.equal(snapshot(), expired);
      now = original.startAt; await close(); await open();
      assert.deepEqual(parse(await view(id)).tickets, tickets, 'Clock rewind cannot remint or erase issued numbers');
    }

    // Two genuine original missions share an event; one has multiple tickets.
    const chosen = missions.filter(([, reward]) => reward.rewardKey === 'takarakuji_item.takarakuji11');
    const [first, second] = chosen;
    {
      const resultId=eventFor(first[1]),event=master.takarakujiInfos[resultId];
      now=first[1].startAt;await fresh('published-result');
      const row=rowFor(first[0]);put('UserAchievement',[row]);
      const award=parse(await claim([row])).operations[0];
      parse(await push({UserAchievement:[{...row,state:4}]},[award]));
      const amount=first[1].rewardAmount,pending=await view(resultId),pendingIdentity=sequence;
      assert.deepEqual(parse(pending).tickets,expectedTickets(resultId,amount));
      now=drawAt(resultId)-1;assert.deepEqual(parse(await view(resultId)).tickets,expectedTickets(resultId,amount));
      now=drawAt(resultId);
      app.store.db.exec("CREATE TRIGGER fail_lotto_result BEFORE INSERT ON takarakuji_result BEGIN SELECT RAISE(ABORT,'result rollback'); END");
      const before=snapshot(),failed=await view(resultId);assert.equal(failed.status,503);assert.equal(failed.body.length,0);
      assert.equal(snapshot(),before);app.store.db.exec('DROP TRIGGER fail_lotto_result');
      for(const table of ['takarakuji_reward','takarakuji_reward_gift']) {
        app.store.db.exec(`CREATE TRIGGER fail_lotto_reward BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'reward rollback'); END`);
        const unchanged=snapshot(),failedReward=await view(resultId);assert.equal(failedReward.status,503);assert.equal(failedReward.body.length,0);
        assert.equal(snapshot(),unchanged);app.store.db.exec('DROP TRIGGER fail_lotto_reward');
      }
      const expected=resultTickets(resultId,amount),publishedView=await view(resultId),publishedIdentity=sequence,
        published=parse(publishedView),best=expected.length?Math.min(...expected.map(ticket=>ticket.prize)):99999999;
      assert.deepEqual(published.tickets,expected);assert.equal(published.player.prize,best);
      assert.deepEqual(app.store.db.prepare('SELECT info_id,draw_at,rank_count,policy,player_prize FROM takarakuji_result').get(),
        {info_id:resultId,draw_at:drawAt(resultId),rank_count:6,policy:'offline-geometric-v1',player_prize:best});
      const expectedPayout=payoutItems(resultId,expected),payoutGifts=app.store.read('UserGift').data;
      assert.deepEqual(payoutGifts.map(({itemId,amount})=>({itemId,amount})),expectedPayout);
      assert.ok(payoutGifts.every(gift=>gift.giftAcquiredType===8 && gift.title==='[Offline Lotto Orario] Season 11 prize' &&
        gift.startAt===drawAt(resultId) && gift.expireAt===0));
      assert.deepEqual(app.store.db.prepare('SELECT info_id,policy,gift_count FROM takarakuji_reward').get(),
        {info_id:resultId,policy:'archived-gift-content-v1',gift_count:expectedPayout.length});
      displayed(await details(resultId),resultId,amount,'published');
      assert.deepEqual((await request(port,publishedIdentity,{takarakujiInfoId:resultId},String(publishedIdentity),'takarakuji/get')).body,
        publishedView.body);
      assert.deepEqual(parse(await request(port,pendingIdentity,{takarakujiInfoId:resultId},String(pendingIdentity),'takarakuji/get')).tickets,
        expectedTickets(resultId,amount),'A pre-publication transport replay remains pending');
      const late=[gift(9001,event.itemId,1)];put('UserGift',[...payoutGifts,...late]);const closed=snapshot();
      await unavailable(await receive(late));assert.equal(snapshot(),closed,'Published ticket set cannot grow');put('UserGift',payoutGifts);
      await close();now=event.startAt;await open();
      assert.deepEqual(parse(await view(resultId)).tickets,expected,'Clock rewind cannot unpublish or reroll a result');
      const played={userId:seed.userId,takarakujiInfoId:resultId,playResultEffect:true};
      parse(await push({UserTakarakujiInfo:[played]}));assert.equal(parse(await view(resultId)).UserTakarakujiInfo.playResultEffect,true);
      const replayed=app.store.read('UserGift').data;assert.deepEqual(replayed,payoutGifts,'Result replay cannot duplicate its ranking Presents');
      const payoutIndex=app.store.db.prepare('SELECT * FROM takarakuji_reward_gift ORDER BY gift_id LIMIT 1').get(),
        payoutGiftJson=payoutIndex.gift_json;
      app.store.db.prepare('UPDATE takarakuji_reward_gift SET gift_json=? WHERE gift_id=?')
        .run(JSON.stringify({...JSON.parse(payoutGiftJson),amount:payoutIndex.amount+1}),payoutIndex.gift_id);
      const damagedPayout=snapshot();await unavailable(await view(resultId));await unavailable(await receive(payoutGifts));
      assert.equal(snapshot(),damagedPayout,'A damaged payout receipt must retain every Present and claim state');
      app.store.db.prepare('UPDATE takarakuji_reward_gift SET gift_json=? WHERE gift_id=?').run(payoutGiftJson,payoutIndex.gift_id);
      const payoutClaim=parse(await receive(payoutGifts)).operations[0];
      assert.deepEqual(app.store.db.prepare('SELECT DISTINCT claim_operation_id FROM takarakuji_reward_gift').all(),
        [{claim_operation_id:payoutClaim.id}],'Every selected Lotto Present binds the actual claim operation');
      assert.deepEqual(parse(await view(resultId)).tickets,expected,'A pending Present claim cannot reroll the published result');
      const saved=app.store.db.prepare('SELECT tickets_json FROM takarakuji_result WHERE info_id=?').get(resultId).tickets_json;
      app.store.db.prepare('UPDATE takarakuji_result SET tickets_json=? WHERE info_id=?').run('[]',resultId);
      const corrupt=snapshot();await unavailable(await view(resultId));await unavailable(await details(resultId));assert.equal(snapshot(),corrupt);
      app.store.db.prepare('UPDATE takarakuji_result SET tickets_json=? WHERE info_id=?').run(saved,resultId);
    }
    now = Math.max(first[1].startAt, second[1].startAt); await fresh('overlap');
    const id = eventFor(first[1]), rows = [rowFor(first[0]), rowFor(second[0])];
    put('UserAchievement', rows);
    const one = parse(await claim([rows[0]])).operations[0];
    const firstView=await view(id),firstViewIdentity=sequence;
    assert.deepEqual(parse(firstView).tickets,expectedTickets(id,first[1].rewardAmount));
    const firstNotice = await details(id), firstNoticeIdentity = sequence;
    displayed(firstNotice, id, first[1].rewardAmount);
    const two = parse(await claim([rows[1]])).operations[0];
    const total = first[1].rewardAmount + second[1].rewardAmount;
    assert.equal(app.store.db.prepare('SELECT first_number FROM takarakuji_ticket_claim WHERE operation_id=?').get(two.id).first_number,
      first[1].rewardAmount + 1);
    assert.deepEqual(parse(await view(id)).tickets, expectedTickets(id, total));
    app.store.beginSession();await close();await open();
    assert.deepEqual(parse(await request(port,firstViewIdentity,{takarakujiInfoId:id},String(firstViewIdentity),'takarakuji/get')).tickets,
      expectedTickets(id,first[1].rewardAmount),'An old Lotto request keeps its original ticket prefix after later awards');
    displayed(await details(id), id, total);
    assert.deepEqual((await request(port, firstNoticeIdentity, { lottoOrarioId: id }, String(firstNoticeIdentity), 'notice/show')).body,
      firstNotice.body, 'An exact page replay keeps its original snapshot instead of reissuing anything');
    const conflict = snapshot(); assert.equal((await claim(rows)).status, 400); assert.equal(snapshot(), conflict);
    parse(await push({ UserAchievement: [{ ...rows[0], state: 4 }] }, [one])); await close(); await open();
    assert.deepEqual(parse(await view(id)).tickets, expectedTickets(id, total));
    assert.deepEqual(parse(await claim([rows[1]])).operations, [two]);
    parse(await push({ UserAchievement: [{ ...rows[1], state: 4 }] }, [two]));
    now = master.takarakujiInfos[56000000010].startAt;
    assert.deepEqual(parse(await view(56000000010)).tickets, [], 'Other event numbers stay isolated');
    displayed(await details(56000000010), 56000000010, 0);
    now = second[1].startAt;
    assert.deepEqual(parse(await view(id)).tickets, expectedTickets(id, total));

    // Mixed original Iris / ordinary inventory / raffle batch stays atomic.
    const [irisId, iris] = Object.entries(master.achievements).find(([, reward]) =>
      reward.rewardType === 3 && reward.rewardKey === 'currency.gem' && !reward.expireAt && reward.startAt <= now);
    const [itemMissionId, itemReward] = Object.entries(master.achievements).find(([, reward]) =>
      master.itemProfiles[master.items[reward.rewardKey]]?.table === 'UserStaminaTicket' &&
      !reward.expireAt && reward.startAt <= now);
    await fresh('mixed');
    const mixedRows = [rowFor(first[0]), rowFor(second[0]), rowFor(irisId), rowFor(itemMissionId)];
    const itemId = master.items[itemReward.rewardKey], profile = master.itemProfiles[itemId];
    const item = { userId: seed.userId, [profile.idField]: itemId, amount: 0, cumulativeAmount: 0, bookEntryState: 3, signature: 0 };
    put('UserAchievement', mixedRows); put(profile.table, [item]);
    for (const table of ['operation_queue','achievement_claim','achievement_item_claim','takarakuji_ticket_claim','takarakuji_pending_event','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_lotto BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'lotto rollback'); END`);
      const before = snapshot(), failed = await claim(mixedRows);
      assert.equal(failed.status, 503); assert.equal(failed.body.length, 0); assert.equal(snapshot(), before);
      app.store.db.exec('DROP TRIGGER fail_lotto');
    }
    const balance = app.store.hardCurrency(), mixedResponse = await claim(mixedRows), mixedIdentity = sequence;
    const mixed = parse(mixedResponse), operation = mixed.operations[0];
    assert.equal(app.store.hardCurrency(), balance + iris.rewardAmount);
    assert.deepEqual(mixed.receivedItems, [{ itemId, amount: itemReward.rewardAmount },
      { itemId: master.takarakujiInfos[id].itemId, amount: total }]);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM takarakuji_ticket_claim').get().n, 1);
    const originalParameters = app.store.db.prepare('SELECT parameters FROM operation_queue WHERE id=?').get(operation.id).parameters;
    for (const receivedItems of [{ itemId: master.takarakujiInfos[id].itemId, amount: total }, [null]]) {
      app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?')
        .run(JSON.stringify({ ...operation.parameters, receivedItems }), operation.id);
      const damaged = snapshot();
      await unavailable(await view(id)); await unavailable(await details(id));
      assert.equal(snapshot(), damaged, 'Malformed pending Lotto rewards retain their operation and ticket receipts');
    }
    app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(originalParameters, operation.id);
    const beforeFlags = snapshot();
    assert.equal((await push({ UserAchievement: mixedRows.map(row => ({ ...row, state: 4 })) }, [operation])).status, 400);
    assert.equal(snapshot(), beforeFlags, 'Received flags cannot discard the mixed ordinary item');
    parse(await push({ UserAchievement: mixedRows.map(row => ({ ...row, state: 4 })),
      [profile.table]: [{ ...item, amount: itemReward.rewardAmount, cumulativeAmount: itemReward.rewardAmount }] }));
    app.store.db.exec("CREATE TRIGGER fail_lotto_ack BEFORE INSERT ON operation_done BEGIN SELECT RAISE(ABORT,'lotto ack rollback'); END");
    const beforeDone = snapshot(); assert.equal((await push({}, [operation])).status, 503); assert.equal(snapshot(), beforeDone);
    app.store.db.exec('DROP TRIGGER fail_lotto_ack');

    // Known missing numbers must recover, including cached/new-identity retries.
    const receipt = app.store.db.prepare('SELECT * FROM takarakuji_ticket_claim').get();
    app.store.db.prepare('DELETE FROM takarakuji_ticket_claim WHERE operation_id=?').run(operation.id);
    await close(); await open();
    const legacy = snapshot();
    await unavailable(await view(id)); await unavailable(await claim(mixedRows)); await unavailable(await push({}, [operation]));
    await unavailable(await details(id));
    await unavailable(await request(port, mixedIdentity, { achievementIds: mixedRows.map(({ achievementId, completedAt }) =>
      ({ achievementId, completedAt })) }, String(mixedIdentity), 'achievement/complete'));
    assert.equal(snapshot(), legacy); assert.equal(app.store.operations().length, 1);
    app.store.db.prepare(`INSERT INTO takarakuji_ticket_claim(operation_id,item_id,info_id,first_number,amount)
      VALUES(?,?,?,?,?)`).run(receipt.operation_id,
      receipt.item_id, receipt.info_id, receipt.first_number, receipt.amount);
    parse(await push({}, [operation]));
    const known = expectedTickets(id, total);
    const cachedView = await view(id), readIdentity = sequence;
    assert.deepEqual(parse(cachedView).tickets, known);
    const cachedNotice = await details(id), detailsIdentity = sequence;
    displayed(cachedNotice, id, total);
    app.store.db.prepare('UPDATE takarakuji_ticket_claim SET amount=amount+1 WHERE operation_id=?').run(operation.id);
    const badTerms = snapshot(); await unavailable(await view(id));
    await unavailable(await request(port, readIdentity, { takarakujiInfoId: id }, String(readIdentity), 'takarakuji/get'));
    await unavailable(await details(id));
    await unavailable(await request(port, detailsIdentity, { lottoOrarioId: id }, String(detailsIdentity), 'notice/show'));
    assert.equal(snapshot(), badTerms, 'Cached views must not conceal a now-invalid ticket receipt');
    app.store.db.prepare('UPDATE takarakuji_ticket_claim SET amount=? WHERE operation_id=?').run(receipt.amount, operation.id);
    app.store.db.prepare('UPDATE takarakuji_ticket_claim SET first_number=2 WHERE operation_id=?').run(operation.id);
    const gap = snapshot(); await unavailable(await view(id)); assert.equal(snapshot(), gap);
    await unavailable(await details(id)); assert.equal(snapshot(), gap);
    app.store.db.prepare('UPDATE takarakuji_ticket_claim SET first_number=1 WHERE operation_id=?').run(operation.id);

    // The client creates visual state1. A known pending view may finish a
    // no-result animation1->2->3; no state is a reward or draw authorization.
    const state = { userId: seed.userId, takarakujiInfoId: id, state: 1 };
    parse(await push({ UserTakarakujiresultState: [state] }));
    for (const row of [{ ...state, state: 4 }, { ...state, state: '1' }, { ...state, userId: 2 },
      { ...state, takarakujiInfoId: 1 },{...state,signature:0},{userId:seed.userId,takarakujiInfoId:id}]) {
      const before = snapshot(); assert.equal((await push({ UserTakarakujiresultState: [row] })).status, 400);
      assert.equal(snapshot(), before);
    }
    const info = { userId: seed.userId, takarakujiInfoId: id, playResultEffect: false };
    parse(await push({ UserTakarakujiInfo: [info] }));
    for(const row of [{...info,signature:0},{...info,playResultEffect:0},{...info,userId:0},
      {userId:seed.userId,takarakujiInfoId:id}]) {
      const unchanged=snapshot();assert.equal((await push({UserTakarakujiInfo:[row]})).status,400);assert.equal(snapshot(),unchanged);
    }
    parse(await push({ UserTakarakujiInfo: [{ ...info, takarakujiInfoId: 0 }],
      UserTakarakujiresultState: [{ ...state, takarakujiInfoId: 0 }] }));
    assert.deepEqual(parse(await view(id)).tickets, known, 'Native zero-reference defaults are not an authored ticket event');
    const noDraw = snapshot(); assert.equal((await push({ UserTakarakujiInfo: [{ ...info, playResultEffect: true }] })).status, 400);
    assert.equal(snapshot(), noDraw);
    parse(await push({}, [], { UserTakarakujiresultState: [{ takarakujiInfoId: id }], UserTakarakujiInfo: [{ takarakujiInfoId: id }] }));
    assert.deepEqual(parse(await view(id)).tickets, known, 'Default-row cleanup cannot delete server entitlements');
    const beforeEffect = app.store.hardCurrency();
    //Durable native visual checkpoints: DEFERRED / NOT RUN. They are neither
    //winning results nor permission to award any unrecovered raffle prize.
    assert.equal(app.store.db.prepare('SELECT count(*) n FROM takarakuji_effect_floor').get().n,0);
    for(const table of ['takarakuji_effect_floor','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_lotto_effect BEFORE INSERT ON ${table}
        BEGIN SELECT RAISE(ABORT,'lotto effect rollback'); END`);
      const unchanged=snapshot();assert.equal((await push({UserTakarakujiresultState:[{...state,state:2}]})).status,503);
      assert.equal(snapshot(),unchanged);app.store.db.exec('DROP TRIGGER fail_lotto_effect');
    }
    parse(await push({ UserTakarakujiresultState: [{ ...state, state: 2 }] }));
    assert.deepEqual(app.store.db.prepare('SELECT * FROM takarakuji_effect_floor').all(),[{info_id:id,state:2}]);
    app.store.db.exec(`CREATE TRIGGER fail_lotto_effect_update BEFORE UPDATE ON takarakuji_effect_floor
      BEGIN SELECT RAISE(ABORT,'lotto update rollback'); END`);
    const beforeUpdate=snapshot();assert.equal((await push({UserTakarakujiresultState:[{...state,state:3}]})).status,503);
    assert.equal(snapshot(),beforeUpdate);app.store.db.exec('DROP TRIGGER fail_lotto_effect_update');
    //The final table alone cannot conceal an earlier actually observed3.
    const split={badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{UserTakarakujiresultState:md5([{...state,state:2}])}},
      operations:[],deltas:[3,2].map(value=>({signature:0,trigger:'TakarakujiStateUpdate',deleteItems:{},
        putItems:{UserTakarakujiresultState:[{...state,state:value}]}}))};
    const beforeSplit=snapshot();assert.equal((await send('user_data/push',split)).status,400);assert.equal(snapshot(),beforeSplit);
    parse(await push({ UserTakarakujiresultState: [{ ...state, state: 3 }] })); await close(); await open();
    assert.deepEqual(app.store.db.prepare('SELECT * FROM takarakuji_effect_floor').all(),[{info_id:id,state:3}]);
    assert.deepEqual(parse(await view(id)).tickets, known, 'Completed no-result effect does not turn pending into a published prize');
    assert.equal(app.store.hardCurrency(), beforeEffect); assert.deepEqual(app.store.operations(), []);
    const savedEffects=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserTakarakujiresultState'").get();
    const effectPull=await send('user_data/pull',{tables:['UserTakarakujiresultState']}),effectPullSequence=sequence;
    assert.equal(effectPull.status,200);
    for(const rows of [[],[state],[{...state,state:4}],[{...state,state:3,userId:0}],
      [{...state,state:3},{...state,state:3}],[{...state,state:3,takarakujiInfoId:1}],[{...state,state:3,signature:0}],{},null]) {
      app.store.db.prepare("UPDATE profile SET data=? WHERE name='UserTakarakujiresultState'").run(JSON.stringify(rows));
      assert.throws(()=>app.store.read('UserTakarakujiresultState'),error=>error.status===503);
      const damaged=snapshot();
      for(const action of ['user/login','user_data/confirm','user_data/pull'])
        await unavailable(await send(action,action==='user_data/pull'?{tables:['UserTakarakujiresultState']}:action==='user/login'?{}:undefined));
      await unavailable(await request(port,effectPullSequence,{tables:['UserTakarakujiresultState']},String(effectPullSequence),'user_data/pull'));
      await unavailable(await view(id));await unavailable(await details(id));assert.equal(snapshot(),damaged);
      app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserTakarakujiresultState'")
        .run(savedEffects.data,savedEffects.token);
    }
    app.store.db.prepare('UPDATE takarakuji_effect_floor SET info_id=1 WHERE info_id=?').run(id);
    const damagedFloor=snapshot();await unavailable(await send('user_data/confirm'));assert.equal(snapshot(),damagedFloor);
    app.store.db.prepare('UPDATE takarakuji_effect_floor SET info_id=? WHERE info_id=1').run(id);
    await close();now=master.takarakujiInfos[id].endAt;await open();
    assert.equal(app.store.read('UserTakarakujiresultState').data.find(row=>row.takarakujiInfoId===id).state,3);
    assert.equal(app.store.db.prepare('SELECT state FROM takarakuji_effect_floor WHERE info_id=?').get(id).state,3);
    await close();now=master.takarakujiInfos[id].startAt;await open();
    const completedEffect = snapshot();
    assert.equal((await push({ UserTakarakujiresultState: [state] })).status, 400); assert.equal(snapshot(), completedEffect);
    put('UserTakarakujiresultState', []); put('UserTakarakujiInfo', []);
    for (const [name, row] of [['UserTakarakujiInfo', { ...info, playResultEffect: true }],
      ['UserTakarakujiresultState', { ...state, state: 3 }]]) {
      app.store.db.prepare('DELETE FROM takarakuji_pending_event WHERE info_id=?').run(id);
      put(name, [row]); const historical = snapshot(); await unavailable(await view(id)); assert.equal(snapshot(), historical);
      await unavailable(await details(id)); assert.equal(snapshot(), historical);
      assert.equal((await push({}, [], { [name]: [{ takarakujiInfoId: id }] })).status, 400);
      assert.equal(snapshot(), historical); put(name, []);
    }

    // All eleven original item classes use2000, not invented inventory rows.
    // These saved-gift fixtures are NOT an original publisher gift catalog.
    for (const [eventId,event] of Object.entries(master.takarakujiInfos)) {
      const eventNumber=Number(eventId); now=event.startAt; await fresh(`presents-${eventId}`);
      const gifts=[gift(1,event.itemId,2),gift(2,event.itemId,3)],balance=app.store.hardCurrency(),
        profileBefore=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
      put('UserGift',gifts);
      const savedBefore=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
        response=await receive(gifts),identity=sequence,result=parse(response),award=result.operations[0];
      assert.equal(award.type,2000);assert.deepEqual(result.receivedItems,[{ itemId:event.itemId,amount:5 }]);
      assert.equal(result.issueCasinoMedal,0);assert.equal(master.itemProfiles[event.itemId],undefined);
      assert.equal(app.store.hardCurrency(),balance);
      assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),savedBefore);
      assert.notEqual(savedBefore,profileBefore,'Only this synthetic test seeds the actual flat gifts');
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM gift_item_claim').get().n,0);
      const range=app.store.db.prepare('SELECT * FROM takarakuji_ticket_claim').get();
      assert.equal(range.operation_json,JSON.stringify(award));assert.equal(range.amount,5);assert.equal(range.first_number,1);
      const exact=snapshot();assert.deepEqual((await request(port,identity,{ userId:seed.userId,giftIds:[1,2] },String(identity),'gift/receive')).body,response.body);
      assert.equal(snapshot(),exact);assert.deepEqual(parse(await receive([...gifts].reverse())).operations,[award]);
      assert.deepEqual(parse(await view(eventNumber)).tickets,expectedTickets(eventNumber,5));
      displayed(await details(eventNumber),eventNumber,5);
      const beforeFlags=snapshot();assert.equal((await push({},[award])).status,400);assert.equal(snapshot(),beforeFlags);
      parse(await push({ UserGift:gifts.map(row => ({ ...row,state:1 })) }));
      await close();await open();now+=101;
      const interrupted=snapshot();await unavailable(await receive(gifts));
      await unavailable(await request(port,identity,{ userId:seed.userId,giftIds:[1,2] },String(identity),'gift/receive'));
      assert.equal(snapshot(),interrupted);assert.deepEqual(app.store.operations(),[award]);
      assert.deepEqual(parse(await view(eventNumber)).tickets,expectedTickets(eventNumber,5));
      parse(await push({},[award]));parse(await push({},[],{ UserGift:[{ id:1 },{ id:2 }] }));
      assert.deepEqual(app.store.read('UserGift').data,[]);
      app.store.beginSession();await close();await open();
      const oldClaim=snapshot();await unavailable(await receive(gifts));assert.equal(snapshot(),oldClaim);
      assert.deepEqual(parse(await view(eventNumber)).tickets,expectedTickets(eventNumber,5));
      const next=[gift(3,event.itemId,1)];put('UserGift',next);
      const nextAward=parse(await receive(next)).operations[0];
      assert.equal(app.store.db.prepare('SELECT first_number FROM takarakuji_ticket_claim WHERE operation_id=?').get(nextAward.id).first_number,6);
      parse(await push({ UserGift:next.map(row => ({ ...row,state:1 })) },[nextAward]));
      now=event.endAt;const expired=snapshot();await unavailable(await view(eventNumber));assert.equal(snapshot(),expired);
      now=event.startAt;await close();await open();
      assert.deepEqual(parse(await view(eventNumber)).tickets,expectedTickets(eventNumber,6));
    }

    now=first[1].startAt;await fresh('gift-mission-order');
    const ticketItem=master.takarakujiInfos[id].itemId,firstGift=[gift(1,ticketItem,2)];
    put('UserGift',firstGift);put('UserAchievement',[rowFor(first[0])]);
    const presentFirst=parse(await receive(firstGift)).operations[0],missionSecond=parse(await claim([rowFor(first[0])])).operations[0];
    assert.equal(app.store.db.prepare('SELECT first_number FROM takarakuji_ticket_claim WHERE operation_id=?').get(missionSecond.id).first_number,3);
    parse(await push({ UserGift:firstGift.map(row => ({ ...row,state:1 })),UserAchievement:[{ ...rowFor(first[0]),state:4 }] },[missionSecond,presentFirst]));
    const extraGift=[gift(2,ticketItem,3)];put('UserGift',extraGift);
    const afterMission=parse(await receive(extraGift)).operations[0];
    assert.equal(app.store.db.prepare('SELECT first_number FROM takarakuji_ticket_claim WHERE operation_id=?').get(afterMission.id).first_number,
      first[1].rewardAmount + 3);
    parse(await push({ UserGift:extraGift.map(row => ({ ...row,state:1 })) },[afterMission]));
    assert.deepEqual(parse(await view(id)).tickets,expectedTickets(id,first[1].rewardAmount + 5));

    // Multiple events and real ordinary acquisition proof stay one transaction.
    await fresh('mixed-presents');
    const otherId=56000000010,otherItem=master.takarakujiInfos[otherId].itemId,
      gifts=[gift(1,ticketItem,2),gift(2,ticketItem,3),gift(3,otherItem,1),
        gift(4,master.currencies['currency.gem'],7),gift(5,itemId,2)];
    put('UserGift',gifts);put(profile.table,[item]);
    for (const table of ['operation_queue','gift_claim','gift_item_claim','takarakuji_ticket_claim','takarakuji_pending_event','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_lotto_present BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'present rollback'); END`);
      const before=snapshot(),failed=await receive(gifts);assert.equal(failed.status,503);assert.equal(failed.body.length,0);assert.equal(snapshot(),before);
      app.store.db.exec('DROP TRIGGER fail_lotto_present');
    }
    const wallet=app.store.hardCurrency(),presentReply=await receive(gifts),presentIdentity=sequence,
      presentAward=parse(presentReply).operations[0],presentRanges=app.store.db.prepare('SELECT * FROM takarakuji_ticket_claim ORDER BY info_id').all();
    assert.equal(app.store.hardCurrency(),wallet + 7);assert.equal(presentRanges.length,2);
    assert.deepEqual(app.store.read(profile.table).data,[item]);
    const flagOnly=snapshot();assert.equal((await push({ UserGift:gifts.map(row => ({ ...row,state:1 })) },[presentAward])).status,400);
    assert.equal(snapshot(),flagOnly,'Raffle receipts cannot acknowledge the mixed ordinary inventory');
    parse(await push({ UserGift:gifts.map(row => ({ ...row,state:1 })),
      [profile.table]:[{ ...item,amount:2,cumulativeAmount:2 }] }));
    for (const changes of ['amount=amount+1','first_number=2',"operation_json='{}'",'operation_json=NULL']) {
      app.store.db.prepare(`UPDATE takarakuji_ticket_claim SET ${changes} WHERE item_id=?`).run(ticketItem);
      const changed=snapshot();await unavailable(await view(id));await unavailable(await push({},[presentAward]));
      await unavailable(await request(port,presentIdentity,{ userId:seed.userId,giftIds:gifts.map(row => row.id) },String(presentIdentity),'gift/receive'));
      assert.equal(snapshot(),changed);assert.deepEqual(app.store.operations(),[presentAward]);
      const originalRange=presentRanges.find(row => row.item_id===ticketItem);
      app.store.db.prepare('UPDATE takarakuji_ticket_claim SET amount=?,first_number=?,operation_json=? WHERE item_id=?')
        .run(originalRange.amount,originalRange.first_number,originalRange.operation_json,ticketItem);
    }
    const changedOperation=structuredClone(presentAward);changedOperation.parameters.UserGift[0].amount++;
    app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(changedOperation.parameters),presentAward.id);
    const sourceChanged=snapshot();await unavailable(await view(id));await unavailable(await push({},[presentAward]));assert.equal(snapshot(),sourceChanged);
    app.store.db.prepare('UPDATE operation_queue SET parameters=? WHERE id=?').run(JSON.stringify(presentAward.parameters),presentAward.id);
    app.store.db.exec("CREATE TRIGGER fail_lotto_present_ack BEFORE INSERT ON operation_done BEGIN SELECT RAISE(ABORT,'present ack rollback'); END");
    const ackRollback=snapshot();assert.equal((await push({},[presentAward])).status,503);assert.equal(snapshot(),ackRollback);
    app.store.db.exec('DROP TRIGGER fail_lotto_present_ack');parse(await push({},[presentAward]));
    await close();await open();assert.deepEqual(parse(await view(id)).tickets,expectedTickets(id,5));
    for (const change of [{ amount:99 },{ state:0 },{ userId:2 }]) {
      put('UserGift',gifts.map((row,index) => ({ ...row,state:1,...(index===0 ? change : {}) })));
      const changed=snapshot();await unavailable(await view(id));assert.equal(snapshot(),changed);
    }
    put('UserGift',gifts.map(row => ({ ...row,state:1 })));
    const missingRange=presentRanges.find(row => row.item_id===ticketItem);
    app.store.db.prepare('DELETE FROM takarakuji_ticket_claim WHERE operation_id=? AND item_id=?').run(presentAward.id,ticketItem);
    const lost=snapshot();await unavailable(await view(id));assert.equal(snapshot(),lost);
    app.store.db.prepare(`INSERT INTO takarakuji_ticket_claim(operation_id,item_id,info_id,first_number,amount,operation_json)
      VALUES(?,?,?,?,?,?)`).run(missingRange.operation_id,missingRange.item_id,missingRange.info_id,missingRange.first_number,
        missingRange.amount,missingRange.operation_json);
    now=master.takarakujiInfos[otherId].startAt;assert.deepEqual(parse(await view(otherId)).tickets,expectedTickets(otherId,1));
    now=first[1].startAt;

    await fresh('legacy-raffle-schema');put('UserAchievement',[rowFor(first[0])]);
    const legacyAward=parse(await claim([rowFor(first[0])])).operations[0];
    app.store.db.exec('ALTER TABLE takarakuji_ticket_claim DROP COLUMN operation_json');
    await close();await open();assert.equal(app.store.db.prepare('SELECT operation_json FROM takarakuji_ticket_claim').get().operation_json,null);
    assert.deepEqual(parse(await view(id)).tickets,expectedTickets(id,first[1].rewardAmount));
    parse(await push({ UserAchievement:[{ ...rowFor(first[0]),state:4 }] },[legacyAward]));

    await fresh('present-cap');const full=[gift(1,ticketItem,4096)];put('UserGift',full);
    const fullAward=parse(await receive(full)).operations[0];
    assert.deepEqual(parse(await view(id)).tickets,expectedTickets(id,4096));
    parse(await push({ UserGift:full.map(row => ({ ...row,state:1 })) },[fullAward]));
    const beyond=[gift(2,ticketItem,1)];put('UserGift',beyond);const cap=snapshot();
    await unavailable(await receive(beyond));assert.equal(snapshot(),cap);
    await fresh('bad-present');
    for (const change of [{ itemLevel:1 },{ equipmentId:1 },{ pcLimitBreakCount:1 },{ pcHeroSublimateCount:1 }]) {
      const bad=[{ ...gift(1,ticketItem,1),...change }];put('UserGift',bad);const before=snapshot();
      await unavailable(await receive(bad));assert.equal(snapshot(),before);
    }
    put('UserGift',[{ ...gift(1,ticketItem,1),state:1 }]);const unknownPresent=snapshot();
    await unavailable(await view(id));assert.equal(snapshot(),unknownPresent);

    // A legacy received flag is not an original numbered-ticket archive.
    await fresh('unknown-history'); put('UserAchievement', [{ ...rowFor(first[0]), state: 4 }]);
    const missing = snapshot(); await unavailable(await view(id)); assert.equal(snapshot(), missing);
    await unavailable(await details(id)); assert.equal(snapshot(), missing);
    put('UserAchievement', [{ ...rowFor(first[0]), state: 4 }, rowFor(second[0])]);
    const preserve = snapshot(); await unavailable(await claim([rowFor(second[0])])); assert.equal(snapshot(), preserve);
    assert.deepEqual(app.store.operations(), []);
    assert.equal(app.store.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    console.log('Lotto Orario pending view / details / original23 missions / eleven present ticket classes / shared numbers / retry / mixed save / rollback probes: OK (no native, gift provenance or prize-draw proof)');
  } finally {
    await close(); Date.now = realNow;
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
