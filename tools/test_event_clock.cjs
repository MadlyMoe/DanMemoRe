'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createServer } = require('./danmemore_server.cjs');
const { request, drawAcknowledgement } = require('./test_danmemore_server.cjs');
const seed = require('../data/danmemore-seed.json');
const master = require('../data/danmemore-master.json');

async function main() {
  const root = fs.mkdtempSync(path.join(process.cwd(), '.work', 'event-clock-test-'));
  const database = path.join(root, 'profile.sqlite');
  const selected = '2019-10-18T12:00:00Z', selectedEpoch = Math.floor(Date.parse(selected) / 1000);
  let wall = 2000000000, app; const logs = [];
  const create = date => createServer({ database, seed, master, eventDate: date,
    wallNowSeconds: () => wall, log: line => logs.push(line) });
  try {
    app = create(selected);
    assert.deepEqual(app.store.eventClock.summary(), { mode: 'historical', selectedEpoch, currentEpoch: selectedEpoch });
    const ticketDuration = master.lotteryTickets[296000020];
    // WRITTEN ONLY / NOT RUN: wall tickets retain their age; virtual tickets
    // from an earlier clock choice must not be refreshed on a clock rewind.
    assert.equal(app.store.eventClock.translate(wall - 86400,ticketDuration),selectedEpoch - 86400);
    assert.equal(app.store.eventClock.translate(wall - ticketDuration - 1,ticketDuration),wall - ticketDuration - 1);
    assert.equal(app.store.eventClock.translate(wall + ticketDuration + 1,ticketDuration),wall + ticketDuration + 1);
    const info = app.store.read('UserInfo').data[0].playerStatus;
    for (const key of ['baseSPUpdatedAt','pvpSPUpdatedAt','unionRaidBossSPUpdatedAt','unionRaidNormalSPUpdatedAt'])
      assert.equal(info[key], selectedEpoch, `${key} must start on the selected timeline`);
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const port = app.server.address().port;
    const guildWar = await request(port, 0, { gvgId: 65000000003 }, '69', 'gvg/info/get');
    assert.equal(guildWar.status, 200, logs.at(-1));
    assert.deepEqual(JSON.parse(guildWar.body), { code: 0, result: 0, term: 0, nextTermTime: 1572228000 });
    const draw = { lotteryId: 171000713, buttonIndex: 2, consumeAmount: 0, pickCount: 11,
      progressCount: 0, currentStepIndex: 0, isScratch: false, clientChargeHardCurrency: 0,
      clientFreeHardCurrency: 0, clientTotalHardCurrency: 0 };
    assert.equal((await request(port, 1, { ...draw, lotteryId: 171000714 }, '70', 'lottery/draw')).status, 400);
    const active = await request(port, 1, draw, '71', 'lottery/draw');
    assert.equal(active.status, 200, logs.at(-1));
    assert.equal(active.headers['x-argo-server-timestamp'], String(selectedEpoch));
    const activeResult = JSON.parse(active.body);
    assert.equal(activeResult.lotteryPCs.length, 11);
    wall += 10;
    const confirm = await request(port, 2, undefined, '72', 'user_data/confirm');
    assert.equal(confirm.headers['x-argo-server-timestamp'], String(selectedEpoch + 10));
    await app.close(); app = null;
    wall += 3600;
    app = create(selected);
    assert.equal(app.store.gameNowSeconds(), selectedEpoch + 3610, 'Event clock must advance through downtime');
    wall -= 7200;
    assert.equal(app.store.gameNowSeconds(), selectedEpoch + 3610, 'A backwards wall clock must not rewind gameplay');
    app.store.saveReply('clock-cache','notice/show','clock-hash','application/json',Buffer.from('{"code":0}'));
    app.store.close(); app = null;
    assert.throws(() => create('2019-10-25T12:00:00Z'), /pending operations/);
    wall += 7200;
    app = create(selected);
    assert.ok(app.store.reply('clock-cache'),'A rejected clock change must retain the current-date reply cache');
    app.store.push(drawAcknowledgement(activeResult)); app.store.close(); app = null;
    const changed = '2019-10-25T12:00:00Z', changedEpoch = Math.floor(Date.parse(changed) / 1000);
    const failedChange=new DatabaseSync(database);
    failedChange.exec(`CREATE TRIGGER clock_cache_abort BEFORE DELETE ON reply_cache
      BEGIN SELECT RAISE(ABORT,'clock cache deletion failure'); END`);
    failedChange.close();
    assert.throws(()=>create(changed),/clock cache deletion failure/,
      'A cache-deletion failure must reject the complete event-clock change');
    const afterFailure=new DatabaseSync(database);
    assert.equal(afterFailure.prepare('SELECT selected_epoch FROM event_clock WHERE id=1').get().selected_epoch,selectedEpoch,
      'A failed cache invalidation must roll back the selected event date');
    assert.ok(afterFailure.prepare('SELECT 1 FROM reply_cache WHERE key=?').get('clock-cache'),
      'A failed event-clock transaction must retain its old-date reply');
    afterFailure.exec('DROP TRIGGER clock_cache_abort');
    afterFailure.close();
    app = create(changed);
    assert.equal(app.store.reply('clock-cache'),undefined,
      'A committed clock change must discard cached calendar-dependent packet replies');
    assert.deepEqual(app.store.eventClock.summary(), { mode: 'historical', selectedEpoch: changedEpoch, currentEpoch: changedEpoch });
    app.store.close(); app = null;
    app = create(selected);
    assert.equal(app.store.eventClock.translate(changedEpoch + 1800,ticketDuration),changedEpoch + 1800);

    // WRITTEN ONLY / NOT RUN: a selected historical day must project its own
    // paid-daily button row without erasing a different day's immutable state.
    app.store.close(); app = null;
    const dailyDatabase=path.join(root,'daily.sqlite'),firstDay='2017-07-15T12:00:00Z',
      secondDay='2017-07-16T12:00:00Z',firstEpoch=Math.floor(Date.parse(firstDay)/1000),
      secondEpoch=Math.floor(Date.parse(secondDay)/1000),dailyWall=2100000000;
    let dailySequence=100;
    const createDaily=date=>createServer({database:dailyDatabase,seed,master,eventDate:date,
      wallNowSeconds:()=>dailyWall,log:line=>logs.push(line)});
    const startDaily=async date=>{
      app=createDaily(date);
      await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    };
    const dailyButton=()=>app.store.read('UserLottery').data.find(row=>row.lotteryId===171000013)
      ?.buttons.find(button=>button.buttonType===1);
    const requestDaily=async()=>{
      const paid=app.store.paidCurrency(),free=app.store.hardCurrency(),id=dailySequence++;
      const response=await request(app.server.address().port,id,{lotteryId:171000013,buttonIndex:1,
        consumeAmount:10,pickCount:1,progressCount:0,currentStepIndex:0,isScratch:false,
        clientChargeHardCurrency:paid,clientFreeHardCurrency:free,clientTotalHardCurrency:paid+free},String(id),'lottery/draw');
      assert.equal(response.status,200,response.body.toString());
      return JSON.parse(response.body);
    };
    const drawDaily=async()=>{
      const result=await requestDaily();
      app.store.push(drawAcknowledgement(result));
      return result;
    };
    await startDaily(firstDay);
    app.store.changePaidCurrency(20);
    const firstDaily=await drawDaily(),firstProgress={...dailyButton()};
    assert.equal(firstProgress.count,1);
    assert.equal(firstProgress.lastPickedAt,firstEpoch);
    await app.close(); app=null;

    await startDaily(secondDay);
    assert.deepEqual(dailyButton(),{buttonType:1,count:0,lastPickedAt:0,loopCount:0,currentStepIndex:1},
      'A different selected day starts from its own native zero progress');
    const secondDaily=await drawDaily(),secondProgress={...dailyButton()};
    assert.equal(secondProgress.count,1);
    assert.equal(secondProgress.lastPickedAt,secondEpoch);
    await app.close(); app=null;

    await startDaily(firstDay);
    assert.deepEqual(dailyButton(),firstProgress,'Rewinding the event clock restores only the first day snapshot');
    assert.deepEqual(app.store.db.prepare(`SELECT day,source_operation_id FROM lottery_daily_progress
      WHERE lottery_id=171000013 AND button_type=1 ORDER BY day`).all(),[
      {day:Math.floor((firstEpoch+32400)/86400),source_operation_id:firstDaily.operation.id},
      {day:Math.floor((secondEpoch+32400)/86400),source_operation_id:secondDaily.operation.id}],
    'Both selected days retain independent operation-bound progress');
    const profileBefore=app.store.db.prepare("SELECT data,token FROM profile WHERE name='UserLottery'").get(),
      snapshot=app.store.db.prepare(`SELECT day,progress_json FROM lottery_daily_progress
        WHERE lottery_id=171000013 AND button_type=1 ORDER BY day LIMIT 1`).get();
    app.store.db.prepare(`UPDATE lottery_daily_progress SET progress_json='{}'
      WHERE lottery_id=171000013 AND button_type=1 AND day=?`).run(snapshot.day);
    app.store.saveReply('daily-clock-cache','notice/show','daily-clock-hash','application/json',Buffer.from('{"code":0}'));
    await app.close();app=null;
    assert.throws(()=>createDaily(secondDay),/Daily lottery progress conflicts|day snapshot is not canonical/,
      'A corrupt archived day refuses the clock change instead of repairing or erasing history');
    const inspect=new DatabaseSync(dailyDatabase);
    assert.deepEqual(inspect.prepare("SELECT data,token FROM profile WHERE name='UserLottery'").get(),profileBefore,
      'A failed projection leaves the selected profile bytes and token unchanged');
    assert.equal(inspect.prepare('SELECT selected_epoch FROM event_clock WHERE id=1').get().selected_epoch,firstEpoch,
      'A failed selected-day projection must also roll back the event clock');
    assert.ok(inspect.prepare('SELECT 1 FROM reply_cache WHERE key=?').get('daily-clock-cache'),
      'A failed selected-day projection must retain the prior calendar reply cache');
    inspect.prepare(`UPDATE lottery_daily_progress SET progress_json=?
      WHERE lottery_id=171000013 AND button_type=1 AND day=?`).run(snapshot.progress_json,snapshot.day);
    inspect.close();

    // WRITTEN ONLY / NOT RUN: local-clock midnight cannot hide a live result
    // before the native client has saved and acknowledged its original day row.
    const pendingDatabase=path.join(root,'pending-daily.sqlite');
    let localWall=Math.floor(Date.parse('2017-07-15T14:59:00Z')/1000);
    const createLocal=()=>createServer({database:pendingDatabase,seed,master,wallNowSeconds:()=>localWall,
      log:line=>logs.push(line)});
    app=createLocal();
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    app.store.changePaidCurrency(20);
    const pendingDaily=await requestDaily(),pendingProgress={...dailyButton()};
    await app.close();app=null;
    localWall+=120;
    app=createLocal();
    assert.deepEqual(dailyButton(),pendingProgress,
      'A pending prior-day draw overrides the new selected day until its native ACK');
    app.store.push(drawAcknowledgement(pendingDaily));
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    const nextDayDaily=await drawDaily();
    assert.equal(nextDayDaily.UserLottery[0].buttons[0].count,1,
      'After ACK, the next JST day receives its own zero-based daily draw');
    await app.close();app=null;
    console.log('Event clock anchors client headers, never rewinds accidentally, changes safely while idle, and gates gacha by date: OK');
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(root, { recursive: true, force: true });
  }
}

process.exitCode = 1;
main().then(() => { process.exitCode = 0; }).catch(error => { console.error(error); });
