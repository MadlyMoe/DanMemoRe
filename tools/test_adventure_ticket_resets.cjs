'use strict';

//WRITTEN ONLY / NOT RUN: synthetic owned rows/tokens/clock/save order, not native reset or stage consumption acceptance.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');
const md5=rows=>crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
const epoch=date=>Date.parse(date)/1000,ids=[298000004,298000007,298000008,298000009];

async function main() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-adventure-resets-'));
  let app,database,port,sequence=0,now=epoch('2023-06-14T12:00:00+09:00');
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const fresh=async label=>{await close();database=path.join(directory,label+'.sqlite');await open();};
  const put=(name,rows)=>app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(rows),md5(rows),name);
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name")
    .all().map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const send=body=>request(port,++sequence,body,String(sequence),'user_data/push');
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const save=(rows=[],tokens=[])=>({badges:null,scripts:{},dataTokens:{},checksums:{before:{},after:{
    ...(rows.length?{UserAdventureTicket:md5(rows)}:{}),...(tokens.length?{UserItemToken:md5([])}:{})}},
    deltas:[{signature:0,trigger:'AdventureTicketReset',putItems:rows.length?{UserAdventureTicket:rows.map(row=>({...row}))}:{},
      deleteItems:tokens.length?{UserItemToken:tokens}:{}}],operations:[]});
  const reject=async(body,status=400,structured=true)=>{const before=snapshot(),reply=await send(body);assert.equal(reply.status,status,reply.body.toString());
    if(status===503 && structured)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);assert.equal(snapshot(),before);};
  const baseline=(id,amount=7,cumulative=11)=>({userId:seed.userId,adventureTicketId:id,amount,cumulativeAmount:cumulative,
    lastResetAt:epoch('2023-06-05T00:00:00+09:00'),bookEntryState:255,signature:0xffffffff});
  const token=id=>({...app.store.read('UserItemToken').data[0],consumer:140000,value:id,context:'',verifier:'synthetic-native-metadata'});
  try {
    //20 combined reset vectors: every authored scheduled ID and original replacement/spending behavior.
    for(const id of ids)for(const kind of ['scheduled','missed-day','spent-before-save','full-stock','same-stock']) {
      now=epoch(kind==='missed-day'?'2023-06-15T12:00:00+09:00':'2023-06-14T12:00:00+09:00');
      await fresh(`${id}-${kind}`);
      const before=baseline(id,kind==='full-stock'?999999999:kind==='same-stock'?1:7,kind==='full-stock'?999999999:11);
      put('UserAdventureTicket',[before]);const consumed=token(id),after={...before,amount:kind==='spent-before-save'?0:1,
        signature:consumed.signature,lastResetAt:now},body=save([after],[consumed]),initial=snapshot();
      for(const [table,event] of [['profile','UPDATE'],['item_token_used','INSERT'],['adventure_ticket_reset','INSERT'],['reply_cache','INSERT']]) {
        app.store.db.exec(`CREATE TRIGGER reset_rollback BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'reset rollback'); END`);
        await reject(body,503,false);app.store.db.exec('DROP TRIGGER reset_rollback');
      }
      assert.equal(snapshot(),initial,'Planning must not precredit a reset or consume/refill tokens');
      const reply=await send(body),identity=sequence,result=parse(reply);
      assert.deepEqual(app.store.read('UserAdventureTicket').data,[after]);assert.deepEqual(app.store.operations(),[]);
      assert.equal(result.data.UserItemToken.length,1,'One actual offline-issued token replacement');
      assert.equal(app.store.db.prepare('SELECT native_delete FROM item_token_used WHERE signature=?').get(consumed.signature).native_delete,
        JSON.stringify(consumed));
      await close();await open();const retained=snapshot();
      assert.deepEqual((await request(port,identity,body,String(identity),'user_data/push')).body,reply.body);
      assert.equal(snapshot(),retained,'Exact retry must not reset stock or consume/refill again');
      await reject(save([], [consumed]),503);
      const spent={...after,amount:0};parse(await send(save([spent])));
      await reject(save([{...after,amount:1}]));await reject(save([{...spent,lastResetAt:before.lastResetAt}]));
      const advanced={...spent,amount:2,cumulativeAmount:spent.cumulativeAmount+2};
      if(advanced.cumulativeAmount<=999999999) {
        parse(await send(save([advanced])));parse(await send(save([{...advanced,amount:0}])));
        await reject(save([advanced]));
      }
    }
    //8 clock-boundary vectors: +9-hour midnight, not machine timezone or current-day-only eligibility.
    for(const id of ids)for(const side of ['before','exact']) {
      const weekly=id===298000007?'2023-06-07':id===298000009?'2023-06-06':'2023-06-08',
        scheduled=epoch(`${weekly}T00:00:00+09:00`);
      now=scheduled-(side==='before'?1:0);await fresh(`boundary-${id}-${side}`);
      const before={...baseline(id),lastResetAt:scheduled-86400},consumed=token(id),after={...before,amount:1,signature:consumed.signature,lastResetAt:now};
      put('UserAdventureTicket',[before]);
      if(side==='before')await reject(save([after],[consumed]));
      else parse(await send(save([after],[consumed])));
    }
    //24 split vectors: no token preconsumption or stock precredit; actual halves survive a cold reopen and clock rewind.
    for(const id of ids)for(const order of ['token-first','inventory-first'])for(const kind of ['stock','spent','clock-rewind']) {
      now=epoch('2023-06-14T12:00:00+09:00');await fresh(`split-${id}-${order}-${kind}`);
      const before=baseline(id);put('UserAdventureTicket',[before]);const consumed=token(id),after={...before,
        amount:kind==='spent'?0:1,lastResetAt:now,signature:consumed.signature},initialTokens=app.store.read('UserItemToken').data,
        first=order==='token-first'?save([],[consumed]):save([after]);
      for(const table of ['profile','adventure_ticket_reset','reply_cache']) {
        const event=table==='profile'?'UPDATE':'INSERT';
        app.store.db.exec(`CREATE TRIGGER reset_rollback BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'split reset rollback'); END`);
        await reject(first,503,false);app.store.db.exec('DROP TRIGGER reset_rollback');
      }
      const firstReply=await send(first),firstIdentity=sequence;parse(firstReply);
      assert.deepEqual(app.store.read('UserAdventureTicket').data,order==='token-first'?[before]:[after]);
      if(order==='inventory-first')assert.deepEqual(app.store.read('UserItemToken').data,initialTokens);
      const readCapture=()=>{const row=app.store.db.prepare('SELECT * FROM adventure_ticket_reset WHERE item_id=?').get(id);
        assert.equal(md5(JSON.parse(row.state_json)),row.state_hash);return JSON.parse(row.state_json);};
      assert.equal(readCapture().tokenSeen,order==='token-first');assert.equal(readCapture().after===null,order==='token-first');
      assert.throws(()=>app.store.itemAcquisitionReservation(id,before.cumulativeAmount),error=>error.status===503,
        'An unfinished absolute reset must exclude a new additive producer for the same ticket');
      let firstCacheStale=false;
      if(order==='inventory-first') {
        for(const change of [{consumer:150000},{value:ids.find(value=>value!==id)},{context:'wrong'},{verifier:1}])
          await reject(save([],[{...consumed,...change}]));
        if(after.amount) {
          parse(await send(save([{...after,amount:0}])));await reject(save([after]));after.amount=0;firstCacheStale=true;
        }
      } else await reject(save([],[consumed]),503);
      await reject(save([{...after,lastResetAt:after.lastResetAt+1}]));
      await close();if(kind==='clock-rewind')now=epoch('2023-06-01T12:00:00+09:00');await open();
      const retained=snapshot();
      const firstRetry=await request(port,firstIdentity,first,String(firstIdentity),'user_data/push');
      if(firstCacheStale) {assert.equal(firstRetry.status,503);assert.equal(JSON.parse(firstRetry.body).code,OFFLINE_UNAVAILABLE_CODE);}
      else assert.deepEqual(firstRetry.body,firstReply.body);
      assert.equal(snapshot(),retained,'First-half exact retry cannot create another checkpoint, grant or refill');
      const second=order==='token-first'?save([after]):save([],[consumed]);
      for(const table of ['profile','adventure_ticket_reset','reply_cache',...(order==='inventory-first'?['item_token_used']:[])]) {
        const event=table==='profile'||table==='adventure_ticket_reset'?'UPDATE':'INSERT';
        app.store.db.exec(`CREATE TRIGGER reset_rollback BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'split completion rollback'); END`);
        await reject(second,503,false);app.store.db.exec('DROP TRIGGER reset_rollback');
      }
      const secondReply=await send(second),secondIdentity=sequence;parse(secondReply);
      assert.equal(readCapture().tokenSeen,true);assert.ok(readCapture().after);
      assert.deepEqual(app.store.read('UserAdventureTicket').data,[after]);
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM item_token_used WHERE signature=?').get(consumed.signature).n,1);
      assert.equal(app.store.read('UserItemToken').data.length,initialTokens.length,'Only actual consumed tokens are refilled once');
      assert.equal(app.store.itemAcquisitionReservation(id,before.cumulativeAmount).pendingItem,false);
      await close();await open();const completed=snapshot();
      assert.deepEqual((await request(port,secondIdentity,second,String(secondIdentity),'user_data/push')).body,secondReply.body);
      assert.equal(snapshot(),completed);await reject(save([],[consumed]),503);
      parse(await send(save([{...after,amount:0}])));await reject(save([{...after,amount:1}]));
      await reject(save([{...after,amount:0,lastResetAt:before.lastResetAt}]));
      now=epoch('2023-06-20T12:00:00+09:00');const next=token(id),nextRow={...after,amount:1,lastResetAt:now,signature:next.signature};
      parse(await send(save([nextRow],[next])));
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM adventure_ticket_reset').get().n,1,
        'Retain one latest checkpoint per original ticket, not lifetime reset scans');
      assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM item_token_used WHERE signature IN (?,?)').get(consumed.signature,next.signature).n,2);
    }
    //12 first-use vectors: exact recovered native constructor, never a server inventory prewrite.
    for(const id of ids)for(const order of ['combined','token-first','inventory-first']) {
      now=epoch('2023-06-14T12:00:00+09:00');await fresh(`constructor-${id}-${order}`);put('UserAdventureTicket',[]);
      const created={userId:seed.userId,adventureTicketId:id,amount:0,bookEntryState:1,signature:0,lastResetAt:0,cumulativeAmount:0},
        consumed=token(id),after={...created,amount:1,signature:consumed.signature,lastResetAt:now},
        first=order==='combined'?save([after],[consumed]):order==='token-first'?save([],[consumed]):save([after]);
      for(const changes of [{cumulativeAmount:1},{bookEntryState:0},{amount:2},{signature:0}])
        await reject(save([{...after,...changes}],[consumed]));
      parse(await send(first));
      const capture=()=>JSON.parse(app.store.db.prepare('SELECT state_json FROM adventure_ticket_reset WHERE item_id=?').get(id).state_json);
      assert.equal(capture().beforePresent,false);assert.deepEqual(capture().before,created);
      assert.deepEqual(app.store.read('UserAdventureTicket').data,order==='token-first'?[]:[after]);
      if(order==='token-first') {
        assert.equal(capture().after,null);parse(await send(save([created])));
        assert.deepEqual(app.store.read('UserAdventureTicket').data,[created],'Only the actual client constructor row can populate inventory');
      }
      await close();await open();
      if(order!=='combined')parse(await send(order==='token-first'?save([after]):save([],[consumed])));
      assert.equal(capture().tokenSeen,true);assert.deepEqual(capture().after,after);
      assert.deepEqual(app.store.read('UserAdventureTicket').data,[after]);
      const checkpoint=app.store.db.prepare('SELECT state_json FROM adventure_ticket_reset WHERE item_id=?').get(id).state_json;
      put('UserAdventureTicket',[]);
      assert.throws(()=>app.store.read('UserAdventureTicket'),error=>error.status===503,
        'A saved first-use reset row cannot subsequently disappear');
      assert.equal(app.store.db.prepare('SELECT state_json FROM adventure_ticket_reset WHERE item_id=?').get(id).state_json,checkpoint);
      put('UserAdventureTicket',[after]);
    }
    //Original checkpoint/token/issued-pool corruption refuses without rewriting profile or private history.
    for(const order of ['token-first','inventory-first']) {
      now=epoch('2023-06-14T12:00:00+09:00');await fresh(`corrupt-${order}`);
      const id=ids[0],before=baseline(id);put('UserAdventureTicket',[before]);const consumed=token(id),after={...before,amount:1,
        lastResetAt:now,signature:consumed.signature};parse(await send(order==='token-first'?save([],[consumed]):save([after])));
      const original=app.store.db.prepare('SELECT * FROM adventure_ticket_reset WHERE item_id=?').get(id),
        body=order==='token-first'?save([after]):save([],[consumed]),restore=()=>app.store.db.prepare(
          'UPDATE adventure_ticket_reset SET state_json=?,state_hash=? WHERE item_id=?').run(original.state_json,original.state_hash,id);
      for(const change of [{policy:'wrong'},{capturedAt:-1},{tokenSeen:false,after:null},
        {before:{...before,reservedAmount:0}},{after:{...after,cumulativeAmount:before.cumulativeAmount+1}}]) {
        const state={...JSON.parse(original.state_json),...change},wire=JSON.stringify(state);
        app.store.db.prepare('UPDATE adventure_ticket_reset SET state_json=?,state_hash=? WHERE item_id=?').run(wire,md5(state),id);
        await reject(body,503);restore();
      }
      app.store.db.prepare('UPDATE adventure_ticket_reset SET state_hash=? WHERE item_id=?').run('0'.repeat(32),id);
      await reject(body,503);restore();
      if(order==='token-first') {
        const originalDelete=app.store.db.prepare('SELECT native_delete FROM item_token_used WHERE signature=?').get(consumed.signature).native_delete;
        app.store.db.prepare('UPDATE item_token_used SET native_delete=NULL WHERE signature=?').run(consumed.signature);await reject(body,503);
        app.store.db.prepare('UPDATE item_token_used SET native_delete=? WHERE signature=?').run(originalDelete,consumed.signature);
      } else {
        const pool=app.store.read('UserItemToken').data;put('UserItemToken',pool.filter(row=>row.signature!==consumed.signature));
        await reject(save([after]),503);put('UserItemToken',pool);
      }
      parse(await send(body));
    }
    await fresh('invalid-and-deferred');now=epoch('2023-06-14T12:00:00+09:00');
    const id=298000004,before={...baseline(id),bookEntryState:1};put('UserAdventureTicket',[before]);
    const consumed=token(id),after={...before,amount:1,lastResetAt:now,signature:consumed.signature};
    for(const changes of [{amount:2},{cumulativeAmount:12},{bookEntryState:0},{lastResetAt:now+1},
      {lastResetAt:undefined},{reservedAmount:0},{dateList:[]},{userId:2},{signature:0x100000000}])
      await reject(save([{...after,...changes}],[consumed]));
    for(const changes of [{consumer:150000},{value:298000001},{context:'wrong'},{verifier:1},{userId:2}])
      await reject(save([after],[{...consumed,...changes}]));
    const second=app.store.read('UserItemToken').data[1];
    await reject(save([after],[consumed,{...consumed,signature:second.signature}]));
    await reject(save([{...after,signature:before.signature}],[consumed]));
    put('UserAdventureTicket',[]);await reject(save([after],[consumed]));
    put('UserAdventureTicket',[before]);
    //A real queued ordinary Present may share the final row only when its complete lifetime target precedes the reset setter.
    const gift={userId:seed.userId,id:1,itemId:id,amount:1,title:'Synthetic reset overlap',message:'',senderType:1,senderId:0,
      giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,pcHeroSublimateCount:0,
      state:0,startAt:now,expireAt:0,createdAt:now,dynamodbExpireAt:0};
    put('UserGift',[gift]);
    parse(await request(port,++sequence,{userId:seed.userId,giftIds:[1]},String(sequence),'gift/receive'));
    await reject(save([after],[consumed]),503);
    const coalesced={...after,bookEntryState:3,cumulativeAmount:before.cumulativeAmount+1};parse(await send(save([coalesced],[consumed])));
    const overlap=JSON.parse(app.store.db.prepare('SELECT state_json FROM adventure_ticket_reset WHERE item_id=?').get(id).state_json);
    assert.equal(overlap.policy,'offline-adventure-reset-v2');assert.equal(overlap.rewardCumulative,coalesced.cumulativeAmount);
    assert.deepEqual(overlap.after,coalesced);assert.deepEqual(app.store.read('UserAdventureTicket').data,[coalesced]);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM item_token_used WHERE signature=?').get(consumed.signature).n,1);
    assert.equal(app.store.operations().filter(row=>row.type===2000).length,1,'A coalesced reset never fabricates the Present ACK');
    await fresh('reward-reset-token-first');now=epoch('2023-06-14T12:00:00+09:00');
    const tokenFirstId=298000004,tokenFirstBefore={...baseline(tokenFirstId),bookEntryState:1};
    put('UserAdventureTicket',[tokenFirstBefore]);
    const tokenFirstGift={...gift,id:2,itemId:tokenFirstId},tokenFirstReset=token(tokenFirstId),
      tokenFirstAfter={...tokenFirstBefore,amount:1,bookEntryState:3,cumulativeAmount:tokenFirstBefore.cumulativeAmount+1,
        signature:tokenFirstReset.signature,lastResetAt:now};
    put('UserGift',[tokenFirstGift]);parse(await request(port,++sequence,{userId:seed.userId,giftIds:[2]},String(sequence),'gift/receive'));
    parse(await send(save([],[tokenFirstReset])));
    let tokenFirstCapture=JSON.parse(app.store.db.prepare('SELECT state_json FROM adventure_ticket_reset WHERE item_id=?')
      .get(tokenFirstId).state_json);
    assert.equal(tokenFirstCapture.policy,'offline-adventure-reset-v1');assert.equal(tokenFirstCapture.tokenSeen,true);
    assert.equal(tokenFirstCapture.after,null);assert.deepEqual(app.store.read('UserAdventureTicket').data,[tokenFirstBefore]);
    parse(await send(save([tokenFirstAfter])));
    tokenFirstCapture=JSON.parse(app.store.db.prepare('SELECT state_json FROM adventure_ticket_reset WHERE item_id=?')
      .get(tokenFirstId).state_json);
    assert.equal(tokenFirstCapture.policy,'offline-adventure-reset-v2');
    assert.equal(tokenFirstCapture.rewardCumulative,tokenFirstAfter.cumulativeAmount);
    assert.deepEqual(tokenFirstCapture.after,tokenFirstAfter);assert.equal(app.store.operations().filter(row=>row.type===2000).length,1);
    for(const splitKind of ['unspent','spent-before-save']) {
      await fresh(`reward-reset-token-first-split-${splitKind}`);now=epoch('2023-06-14T12:00:00+09:00');
      const splitId=298000004,splitBefore={...baseline(splitId),bookEntryState:1};put('UserAdventureTicket',[splitBefore]);
      const splitGift={...gift,id:3,itemId:splitId},splitReset=token(splitId);
      put('UserGift',[splitGift]);parse(await request(port,++sequence,{userId:seed.userId,giftIds:[3]},String(sequence),'gift/receive'));
      const splitOperation=app.store.operations().find(row=>row.type===2000),splitReward={...splitBefore,
        amount:splitKind==='unspent'?splitBefore.amount+1:0,bookEntryState:3,cumulativeAmount:splitBefore.cumulativeAmount+1,
        signature:splitOperation.signature},splitAfter={...splitReward,amount:1,signature:splitReset.signature,lastResetAt:now};
      parse(await send(save([],[splitReset])));await reject(save([{...splitReward,signature:splitReset.signature}]),503);
      parse(await send(save([splitReward])));
      let splitCapture=JSON.parse(app.store.db.prepare('SELECT state_json FROM adventure_ticket_reset WHERE item_id=?')
        .get(splitId).state_json);
      assert.equal(splitCapture.policy,'offline-adventure-reset-reward-v1');
      assert.equal(splitCapture.rewardOperationId,splitOperation.id);assert.equal(splitCapture.rewardSignature,splitOperation.signature);
      assert.deepEqual(splitCapture.reward,splitReward);assert.equal(splitCapture.after,null);
      parse(await send(save([splitAfter])));
      splitCapture=JSON.parse(app.store.db.prepare('SELECT state_json FROM adventure_ticket_reset WHERE item_id=?')
        .get(splitId).state_json);
      assert.equal(splitCapture.policy,'offline-adventure-reset-v2');assert.equal(splitCapture.rewardCumulative,splitAfter.cumulativeAmount);
      assert.deepEqual(splitCapture.after,splitAfter);assert.equal(app.store.operations().filter(row=>row.type===2000).length,1);
    }
    console.log('Adventure Ticket resets:28 combined/calendar,24 split and12 native-constructor vectors plus exact combined/token-first/three-save unspent-or-spent reward-reset and corruption cases WRITTEN ONLY; no native acceptance');
  } finally {
    await close();const resolved=path.resolve(directory);
    assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('danmemore-adventure-resets-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
