'use strict';

// DEFERRED / NOT RUN. Synthetic saves are NOT native rematch/UI proof.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,OFFLINE_UNAVAILABLE_CODE}=require('./danmemore_server.cjs');
const {request}=require('./test_danmemore_server.cjs');
const {underPvpRecord,underPvpRematchDefault,underPvpRematchResult,underPvpRematchReset,underPvpRematchSpend,
  underPvpSelectedRivalReset}=require('./under_pvp.cjs');
const master=require('../data/danmemore-master.json'),seed=require('../data/danmemore-seed.json'),id=69000000005,
  season=master.underPvp.underPvpInformation[id],ticketId=season.slot22,table='UserUnderPvpRevengeStatus',
  medalId=master.shopProducts[season.slot17].priceItemId;
const md5=value=>crypto.createHash('md5').update(JSON.stringify(value)).digest('hex');
const nativeTicket={userId:seed.userId,underPvpRevengeTicketId:ticketId,amount:3,reservedAmount:0,
  bookEntryState:1,signature:0xffffffff,cumulativeAmount:0};
const initial={...underPvpRematchDefault(id,master,seed.userId),initialSetting:true};
const unit=pcId=>({pcId,level:pcId?1:0,currentJobIndex:pcId?1:0,limitbreakCount:0,usableSkillAmount:0,
  strength:0,intelligence:0,agility:0,vitality:0,luck:0,hp:pcId?100:0,mp:pcId?16:0,
  physicalAttackPower:0,magicAttackPower:0,defensePower:0,weaponId:0,armorId:0,weaponAbilityIds:[],armorAbilityIds:[],
  heroSublimateLevel:0,isUnlockedHeroSublimate:false,attackPattern:0,currentDP:0,unlockedAdditionalAbilityAmount:0,hasAllStatusBoardOpened:false});
const savedParty=seed.data.UserParty.find(row=>row.id===seed.data.UserInfo[0].activeUnderPvpPartyId),party={userId:seed.userId,
  partyType:7,index:0,attackPattern:savedParty.attackPattern,partyStrength:0,memoriaSlots:[],
  slots:savedParty.slots.map(row=>({slotNumber:row.slotNumber,pc:unit(row.pcId),assistingPc:unit(row.assistingPcId),
    commandFlow:row.commandFlow,isHidden:false}))};

async function main() {
  for (const [key,event] of Object.entries(master.underPvp.underPvpInformation)) {
    const seasonId=Number(key),base=underPvpRecord([],seasonId,master,seed.userId),cap=master.underPvp.underPvpGrade[event.slot23],
      at=event.slot8+100,before={...underPvpRematchDefault(seasonId,master,seed.userId),initialSetting:Boolean(event.slot22),
        revengeUserId:321,revengeStartAt:123};
    for (const score of [...new Set([0,...(cap?[Math.max(0,cap.slot5-1),cap.slot5]:[])])])
      for (const stock of event.slot22?[0,3,999999999]:[0]) for (const isWin of [false,true]) for (const wasRevenge of [false,true]) {
        const target=underPvpRematchResult({...before,isRevenge:wasRevenge},{...base,score},stock,isWin,900,at,master,seed.userId),
          eligible=!wasRevenge && (!cap || score<cap.slot5) && stock>0 && !isWin;
        assert.equal(target.isRevenge,eligible);assert.equal(target.revengeUserId,eligible?900:0);
        assert.equal(target.revengeStartAt,eligible?at:123,'Disabled rematch retains old time, not0');
        assert.equal(target.initialSetting,before.initialSetting);
      }
    const eligible={...before,isRevenge:true,revengeUserId:900};
    if (event.slot22) for (const amount of [1,3,999999999]) {
      const ticket={...nativeTicket,underPvpRevengeTicketId:event.slot22,amount,cumulativeAmount:0,reservedAmount:7};
      assert.deepEqual(underPvpRematchSpend(ticket,seasonId,master,seed.userId),{amount:amount-1,cumulativeAmount:0,reservedAmount:7});
      assert.equal(ticket.amount,amount,'Pure cost target does not pre-debit its baseline');
      assert.throws(()=>underPvpRematchSpend({...ticket,amount:0},seasonId,master,seed.userId));
      assert.throws(()=>underPvpRematchSpend({...ticket,userId:900},seasonId,master,seed.userId));
    }
    assert.equal(underPvpRematchReset(eligible,event.slot8,master,seed.userId),null);
    assert.equal(underPvpRematchReset(eligible,event.slot9-1,master,seed.userId),null);
    for (const time of [event.slot8-1,event.slot9,event.slot9+100]) {
      const reset=underPvpRematchReset(eligible,time,master,seed.userId);
      assert.equal(reset.isRevenge,false);assert.equal(reset.revengeUserId,0);assert.equal(reset.revengeStartAt,123);
      assert.equal(reset.initialSetting,before.initialSetting);
    }
  }
  for (const args of [[-1,false,9,99],[1,1,9,99],[1,false,0,99],[1,false,9,-1]])
    assert.throws(()=>underPvpRematchResult(initial,underPvpRecord([],id,master,seed.userId),...args,master,seed.userId));
  for (const end of [season.slot8,season.slot8-1]) {
    const badMaster={...master,underPvp:{...master.underPvp,underPvpInformation:{...master.underPvp.underPvpInformation,
      [id]:{...season,slot9:end}}}};
    assert.throws(()=>underPvpRematchReset(initial,season.slot8,badMaster,seed.userId),
      'Invalid matching interval cannot justify clearing rematch eligibility');
  }

  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-rematch-result-'));
  let app,port,database,sequence=0,now=season.slot8+100;
  const open=async()=>{app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;};
  const close=async()=>{if(app){await app.close();app=null;}};
  const send=(action,value)=>request(port,++sequence,value,String(sequence),action);
  const parse=reply=>{assert.equal(reply.status,200,reply.body.toString());return JSON.parse(reply.body);};
  const delta=(putItems,deleteItems={})=>({badges:null,scripts:{},dataTokens:{},operations:[],checksums:{before:{},
    after:Object.fromEntries([...new Set([...Object.keys(putItems),...Object.keys(deleteItems)])].map(name=>[name,md5(putItems[name] ?? [])]))},
    deltas:[{signature:0,trigger:'UpdatePvpState',putItems,deleteItems}]});
  const push=async rows=>parse(await send('user_data/push',delta(rows)));
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='event_clock' ORDER BY name").all()
    .map(({name})=>[name,app.store.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
  const rejected=async(action,value,offline=true)=>{const before=snapshot(),reply=await send(action,value);
    assert.equal(reply.status,503,reply.body.toString());if(offline)assert.equal(JSON.parse(reply.body).code,OFFLINE_UNAVAILABLE_CODE);
    assert.equal(snapshot(),before,'Rejected result/reset preserves all SQLite tables');};
  const user=()=>app.store.read('UserInfo').data[0];
  const fresh=async name=>{await close();database=path.join(directory,`${name}.sqlite`);now=season.slot8+100;await open();
    await push({UserInfo:[{...user(),playerStatus:{...user().playerStatus,underPvpSP:3,underPvpSPUpdatedAt:now}}],
      UserUnderPvpRevengeTicket:[nativeTicket],[table]:[initial]});};
  const start=async()=>{
    const view=parse(await send('under_pvp/summary/get',{underPvpId:id}));await push({UserUnderPvPRecord:[view.underPvpRecord]});
    const rival=view.rivalList[0],body={underPvpId:id,userId:rival.underPvpPlayerInfo.userId,rating:0,userParty:party,
      isRevenge:false,revengeStartAt:app.store.read(table).data.find(row=>row.underPvpId===id).revengeStartAt},
      battle=parse(await send('under_pvp/battle/start',body)),before=user(),info=app.store.read('UserUnderPvPInfo').data[0],
      medal=app.store.read('UserEventItem').data.find(row=>row.eventItemId===medalId);
    await push({UserInfo:[{...before,processingUnderPvpState:1,playerStatus:{...before.playerStatus,underPvpSP:before.playerStatus.underPvpSP-1}}],
      UserUnderPvPInfo:[{...info,resumeRivalUserId:body.userId,resumeRating:0}],
      UserUnderPvPGameStatus:[{userId:0,underPvpId:id,updatedMatchingCount:0,updateRivalList:false,executeRivalListUpdate:false,
        lastRivalListUpdateAt:0,lastBattleStartAt:now}],
      UserEventItem:[{userId:seed.userId,eventItemId:medalId,amount:(medal?.amount ?? 0)+100,
        cumulativeAmount:(medal?.cumulativeAmount ?? 0)+100,signature:123,readState:3}]});
    return {body,battle};
  };
  const finish=async(battle,result)=>parse(await send('under_pvp/battle/end',{underPvpId:id,battleId:battle.battleId,result}));
  const settled=result=>({UserUnderPvPRecord:[result.underPvpRecord],UserInfo:[{...user(),processingUnderPvpState:0}]});
  try {
    await fresh('split');const run=await start(),profiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all());
    const result=await finish(run.battle,{isWin:false,isRetire:false}),target=app.store.underPvpActiveBattle().rematchAfter;
    assert.equal(target.isRevenge,true);assert.equal(target.revengeUserId,run.body.userId);assert.equal(target.revengeStartAt,now);
    assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profiles,'Result does not precredit native flags');
    await rejected('user_data/pull',{tables:[table]});await rejected('user_data/pull',{tables:['UserInfo','UserUnderPvPRecord']});
    for (const patch of [{revengeUserId:seed.userId},{revengeStartAt:now-6},{revengeStartAt:now+121},{isRevenge:false},
      {initialSetting:false},{revengeUserId:0}]) await rejected('user_data/push',delta({[table]:[{...target,...patch}]}));
    await push(settled(result));assert.ok(app.store.underPvpActiveBattle(),'Record/processing without changed rematch flags is incomplete');
    await close();await open();now=master.underPvp.underPvpInformation[id+1].slot8+100;
    await push({[table]:[{...target,revengeStartAt:target.revengeStartAt+1}]});
    assert.equal(app.store.underPvpActiveBattle(),null,'Late captured status completes after restart/clock change');
    const floor=app.store.underPvpRecordFloor(id);assert.equal(floor.rematchAfter.revengeStartAt,target.revengeStartAt+1);
    assert.ok(floor.observed.includes('rematch'));assert.equal(app.store.read('UserUnderPvpRevengeTicket').data[0].amount,3);
    await rejected('user_data/push',delta({[table]:[target]}));
    now=season.slot8+100;await rejected('user_data/push',delta({[table]:[{...floor.rematchAfter,isRevenge:false,revengeUserId:0}]}));
    await rejected('user_data/push',delta({}, {[table]:[{underPvpId:id}]}));
    const reset={...floor.rematchAfter,isRevenge:false,revengeUserId:0};now=season.slot9;
    app.store.db.exec("CREATE TRIGGER fail_reset BEFORE INSERT ON under_pvp_rematch_reset BEGIN SELECT RAISE(ABORT,'reset rollback'); END");
    await rejected('user_data/push',delta({[table]:[reset]}),false);app.store.db.exec('DROP TRIGGER fail_reset');
    await push({[table]:[reset]});assert.equal(app.store.db.prepare('SELECT reset_at FROM under_pvp_rematch_reset WHERE under_pvp_id=?').get(id).reset_at,now);
    await close();await open();now=season.slot8+100;
    assert.equal(app.store.underPvpRematchState().statuses.get(id).isRevenge,false,'Clock rewind does not restore a cleared rematch');
    await rejected('user_data/push',delta({[table]:[floor.rematchAfter]}));
    app.store.db.prepare('UPDATE under_pvp_rematch_reset SET reset_at=? WHERE under_pvp_id=?').run(now,id);
    await rejected('user_data/pull',{tables:[table]});
    app.store.db.prepare('UPDATE under_pvp_rematch_reset SET reset_at=? WHERE under_pvp_id=?').run(season.slot9,id);
    now+=86400;const beforeNext=user();
    await push({UserInfo:[{...beforeNext,playerStatus:{...beforeNext.playerStatus,underPvpSP:3,underPvpSPUpdatedAt:now}}]});
    const second=await start(),win=await finish(second.battle,{isWin:true,isRetire:false}),unchanged=app.store.underPvpActiveBattle();
    assert.equal(unchanged.rematchAfter.isRevenge,false);assert.equal(unchanged.rematchAfter.revengeUserId,0);
    assert.equal(unchanged.rematchAfter.revengeStartAt,reset.revengeStartAt,'Win does not clear retained time');
    assert.ok(unchanged.observed.includes('rematch'),'Unchanged native fields need no dirty status row');
    await push(settled(win));assert.equal(app.store.underPvpActiveBattle(),null);
    assert.equal(app.store.underPvpRematchState().statuses.get(id).revengeStartAt,reset.revengeStartAt,
      'Old reset remains retained but does not replace the newer result floor');
    const third=await start(),retire=await finish(third.battle,{isWin:false,isRetire:true}),retireTarget=app.store.underPvpActiveBattle().rematchAfter;
    assert.equal(retireTarget.isRevenge,true,'Native eligibility checks isWin, not isRetire');
    await push({[table]:[retireTarget]});assert.ok(app.store.underPvpActiveBattle(),'Flag first is not saved record/processing proof');
    await push(settled(retire));assert.equal(app.store.underPvpActiveBattle(),null);
    await rejected('under_pvp/battle/start',{...third.body,isRevenge:true,revengeStartAt:retireTarget.revengeStartAt+1});
    const latest=app.store.underPvpRecordFloor(id);
    for (const [field,value] of [['rematch_before','0'],['rematch_after','{}'],['rematch_stock',0],['result_at',now+999],['rematch_after',null]]) {
      const old=app.store.db.prepare(`SELECT ${field} value FROM under_pvp_battle WHERE battle_id=?`).get(latest.battle_id).value;
      app.store.db.prepare(`UPDATE under_pvp_battle SET ${field}=? WHERE battle_id=?`).run(value,latest.battle_id);
      await rejected('user_data/pull',{tables:[table]});
      app.store.db.prepare(`UPDATE under_pvp_battle SET ${field}=? WHERE battle_id=?`).run(old,latest.battle_id);
    }
    const pointer=app.store.db.prepare('SELECT * FROM under_pvp_record_state WHERE under_pvp_id=?').get(id);
    app.store.db.prepare('DELETE FROM under_pvp_record_state WHERE under_pvp_id=?').run(id);
    await rejected('user_data/pull',{tables:[table]});
    app.store.db.prepare('INSERT INTO under_pvp_record_state(under_pvp_id,battle_id,record_json) VALUES(?,?,?)')
      .run(id,pointer.battle_id,pointer.record_json);

    await fresh('issue-rollback');const issue=await start(),endValue={underPvpId:id,battleId:issue.battle.battleId,result:{isWin:false,isRetire:false}};
    app.store.db.exec("CREATE TRIGGER fail_issue BEFORE UPDATE ON under_pvp_battle WHEN NEW.result_request IS NOT NULL BEGIN SELECT RAISE(ABORT,'issue rollback'); END");
    await rejected('under_pvp/battle/end',endValue,false);app.store.db.exec('DROP TRIGGER fail_issue');
    assert.equal(app.store.underPvpActiveBattle().verdict,null);
    const issued=parse(await send('under_pvp/battle/end',endValue)),nativeTarget=app.store.underPvpActiveBattle().rematchAfter;
    app.store.db.exec("CREATE TRIGGER fail_observation BEFORE UPDATE ON under_pvp_battle BEGIN SELECT RAISE(ABORT,'observation rollback'); END");
    await rejected('user_data/push',delta({[table]:[nativeTarget]}),false);app.store.db.exec('DROP TRIGGER fail_observation');
    await push({[table]:[nativeTarget]});assert.ok(app.store.underPvpActiveBattle().observed.includes('rematch'));
    app.store.db.exec("CREATE TRIGGER fail_floor BEFORE INSERT ON under_pvp_record_state BEGIN SELECT RAISE(ABORT,'floor rollback'); END");
    await rejected('user_data/push',delta(settled(issued)),false);app.store.db.exec('DROP TRIGGER fail_floor');
    await push(settled(issued));assert.equal(app.store.underPvpActiveBattle(),null);

    await fresh('rematch-battles');
    for (const [index,verdict] of [{isWin:true,isRetire:false},{isWin:false,isRetire:false},{isWin:false,isRetire:true}].entries()) {
      const parent=await start(),lost=await finish(parent.battle,{isWin:false,isRetire:false}),eligible=app.store.underPvpActiveBattle().rematchAfter;
      await push({...settled(lost),[table]:[eligible]});const parentId=app.store.underPvpRecordFloor(id).battle_id;
      // Refresh may rotate every offered CPU: rematch still uses its actual
      // loss parent, not the new list or a reconstructed contemporary team.
      parse(await send('under_pvp/rival_list/update',{underPvpId:id,isSelectedRivalIdReset:underPvpSelectedRivalReset(
        app.store.read('UserUnderPvPGameStatus').data.find(row=>row.underPvpId===id),now)}));
      await push({UserUnderPvPGameStatus:[{...app.store.read('UserUnderPvPGameStatus').data.find(row=>row.underPvpId===id),
        updateRivalList:false,executeRivalListUpdate:false,lastRivalListUpdateAt:now}]});
      const body={...parent.body,isRevenge:true,revengeStartAt:eligible.revengeStartAt};
      for (const patch of [{userId:seed.userId},{rating:1},{revengeStartAt:eligible.revengeStartAt+1}])
        await rejected('under_pvp/battle/start',{...body,...patch});
      now=season.slot9;await rejected('under_pvp/battle/start',body);now=season.slot8+100;
      app.store.db.exec("CREATE TRIGGER fail_rematch_issue BEFORE INSERT ON under_pvp_battle WHEN NEW.is_revenge=1 BEGIN SELECT RAISE(ABORT,'rematch issue rollback'); END");
      await rejected('under_pvp/battle/start',body,false);app.store.db.exec('DROP TRIGGER fail_rematch_issue');
      const profiles=JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),
        battle=parse(await send('under_pvp/battle/start',body)),capture=app.store.underPvpActiveBattle(),
        previousSp={...user().playerStatus},medal=app.store.read('UserEventItem').data.find(row=>row.eventItemId===medalId),
        ticket=app.store.read('UserUnderPvpRevengeTicket').data.find(row=>row.underPvpRevengeTicketId===ticketId),
        cost={...ticket,amount:ticket.amount-1,signature:234};
      assert.equal(capture.rematch_parent_id,parentId);assert.equal(capture.is_revenge,1);assert.equal(battle.isRevenge,true);
      assert.deepEqual(battle.underPvpParty,parent.battle.underPvpParty);assert.equal(ticket.amount,3-index);
      assert.equal(JSON.stringify(app.store.db.prepare('SELECT * FROM profile ORDER BY name').all()),profiles,'Rematch issue never pre-debits profiles');
      assert.equal(capture.medalAfter.amount,medal.amount);assert.equal(capture.medalAfter.cumulativeAmount,medal.cumulativeAmount);
      app.store.db.prepare('UPDATE under_pvp_battle SET rematch_ticket_before=? WHERE battle_id=?')
        .run(JSON.stringify({...ticket,amount:ticket.amount+1}),battle.battleId);
      assert.throws(()=>app.store.underPvpRematchState(),/baseline/,'A corrupt pending baseline cannot silently change the cost');
      app.store.db.prepare('UPDATE under_pvp_battle SET rematch_ticket_before=? WHERE battle_id=?')
        .run(JSON.stringify(ticket),battle.battleId);
      await rejected('user_data/pull',{tables:['UserUnderPvpRevengeTicket']});
      const restart={...body,lastBattleStartAt:now};delete restart.userParty;
      await rejected('under_pvp/battle/restart',restart);
      for (const patch of [{amount:ticket.amount-2},{amount:ticket.amount+1},{cumulativeAmount:1},{reservedAmount:1}])
        await rejected('user_data/push',delta({UserUnderPvpRevengeTicket:[{...cost,...patch}]}));
      if (user().playerStatus.underPvpSP>0) await rejected('user_data/push',delta({UserInfo:[{...user(),
        playerStatus:{...user().playerStatus,underPvpSP:user().playerStatus.underPvpSP-1}}]}));
      await rejected('user_data/push',delta({UserEventItem:[{...medal,amount:medal.amount+100,cumulativeAmount:medal.cumulativeAmount+100}]}));
      app.store.db.exec("CREATE TRIGGER fail_rematch_cost BEFORE UPDATE ON under_pvp_battle BEGIN SELECT RAISE(ABORT,'rematch cost rollback'); END");
      await rejected('user_data/push',delta({UserUnderPvpRevengeTicket:[cost]}),false);app.store.db.exec('DROP TRIGGER fail_rematch_cost');
      if (index===0) {await close();await open();now=master.underPvp.underPvpInformation[id+1].slot8+100;}
      const processing={UserInfo:[{...user(),processingUnderPvpState:1}]};
      // Unchanged resume opponent/rating and a frozen start timestamp do not
      // need redundant rows; processing proof binds their real saved values.
      if (index%2===0) {
        await push({UserUnderPvpRevengeTicket:[cost]});await rejected('under_pvp/battle/restart',restart);await push(processing);
      } else {
        await push(processing);await rejected('under_pvp/battle/restart',restart);await push({UserUnderPvpRevengeTicket:[cost]});
      }
      assert.deepEqual(app.store.underPvpActiveBattle().observed,['info','processing','status','ticket']);
      assert.deepEqual(user().playerStatus,previousSp,'Rematch does not consume or recover Under SP');
      assert.deepEqual(app.store.read('UserEventItem').data.find(row=>row.eventItemId===medalId),medal,'Rematch has no100-medal award');
      await rejected('user_data/push',delta({UserUnderPvpRevengeTicket:[ticket]}));
      await close();await open();app.store.db.exec('DELETE FROM reply_cache');
      const resumed=parse(await send('under_pvp/battle/restart',restart));assert.equal(resumed.randomSeed,battle.randomSeed);
      assert.equal(resumed.battleId,battle.battleId);assert.equal(app.store.read('UserUnderPvpRevengeTicket').data[0].amount,2-index);
      await rejected('under_pvp/battle/restart',{...restart,isRevenge:false});
      if (index===1) {
        // Synthetic original-ID present, NOT an assertion of natural medal
        // earning. An unrelated genuine queued grant can settle mid-rematch.
        const gift={userId:seed.userId,id:9876,itemId:medalId,amount:7,title:'Synthetic original-ID medal present',message:'',
          senderType:1,senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,
          pcLimitBreakCount:0,pcHeroSublimateCount:0,state:0,startAt:now,expireAt:now+100,createdAt:now,dynamodbExpireAt:0};
        app.store.db.prepare("UPDATE profile SET data=?,token=? WHERE name='UserGift'").run(JSON.stringify([gift]),md5([gift]));
        const grant=parse(await send('gift/receive',{userId:seed.userId,giftIds:[gift.id]})),operation=grant.operations[0];
        assert.equal(operation.type,2000);
        await push({UserGift:[{...gift,state:1}],UserEventItem:[{...medal,amount:medal.amount+7,cumulativeAmount:medal.cumulativeAmount+7}]});
        parse(await send('user_data/push',{...delta({}),operations:[{id:operation.id,verifier:operation.token}]}));
        await push({UserInfo:[user()]}); // Completed external acquisition is not a stale start baseline.
        assert.equal(app.store.read('UserEventItem').data.find(row=>row.eventItemId===medalId).amount,medal.amount+7);
      }
      const endBody={underPvpId:id,battleId:battle.battleId,result:verdict,isRevenge:true,
        revengeStartAt:eligible.revengeStartAt,lastBattleStartAt:restart.lastBattleStartAt};
      const result=parse(await send('under_pvp/battle/end',endBody)),target=app.store.underPvpActiveBattle().rematchAfter;
      assert.equal(target.isRevenge,false);assert.equal(target.revengeUserId,0);assert.equal(target.revengeStartAt,eligible.revengeStartAt);
      assert.equal(app.store.underPvpActiveBattle().rematch_stock,2-index);
      if (index%2===0) {
        await push(settled(result));assert.ok(app.store.underPvpActiveBattle());await push({[table]:[target]});
      } else {await push({[table]:[target]});assert.ok(app.store.underPvpActiveBattle());await push(settled(result));}
      assert.equal(app.store.underPvpActiveBattle(),null);assert.equal(app.store.underPvpRecordFloor(id).is_revenge,1);
      assert.equal(app.store.underPvpRematchState().stock.get(id).target.amount,2-index);
      await rejected('user_data/push',delta({UserUnderPvpRevengeTicket:[ticket]}));
      await rejected('user_data/push',delta({}, {UserUnderPvpRevengeTicket:[{underPvpRevengeTicketId:ticketId}]}));
      await rejected('under_pvp/battle/start',body);now=season.slot8+100;
    }
    assert.equal(user().playerStatus.underPvpSP,0,'Third rematch is playable with no remaining normal SP');
    assert.equal(app.store.read('UserUnderPvpRevengeTicket').data[0].amount,0);
    const latestRematch=app.store.underPvpRecordFloor(id);
    for (const [field,value] of [['rematch_parent_id',latestRematch.battle_id],['rematch_parent_id',null],['ticket_saved',0],
      ['rematch_ticket_before','{}'],['rematch_start_status','{}'],['is_revenge',0],['rematch_stock',1]]) {
      const old=app.store.db.prepare(`SELECT ${field} value FROM under_pvp_battle WHERE battle_id=?`).get(latestRematch.battle_id).value;
      app.store.db.prepare(`UPDATE under_pvp_battle SET ${field}=? WHERE battle_id=?`).run(value,latestRematch.battle_id);
      await rejected('user_data/pull',{tables:['UserUnderPvpRevengeTicket',table]});
      app.store.db.prepare(`UPDATE under_pvp_battle SET ${field}=? WHERE battle_id=?`).run(old,latestRematch.battle_id);
    }
    await fresh('grant-after-debit');const loss=await start(),lossResult=await finish(loss.battle,{isWin:false,isRetire:false}),
      lossStatus=app.store.underPvpActiveBattle().rematchAfter;
    await push({...settled(lossResult),[table]:[lossStatus]});
    const rematchBody={...loss.body,isRevenge:true,revengeStartAt:lossStatus.revengeStartAt},
      rematch=parse(await send('under_pvp/battle/start',rematchBody)),beforeTicket=app.store.read('UserUnderPvpRevengeTicket').data[0];
    const earned={userId:seed.userId,id:800,itemId:ticketId,amount:4,title:'Synthetic rematch grant',message:'',senderType:1,
      senderId:0,giftAcquiredType:2,itemLevel:0,equipmentId:0,equipmentEvolveCount:0,pcLimitBreakCount:0,
      pcHeroSublimateCount:0,state:0,startAt:0,expireAt:0,createdAt:now,dynamodbExpireAt:0};
    const gifts=[earned];app.store.db.prepare('UPDATE profile SET data=?,token=? WHERE name=?').run(JSON.stringify(gifts),md5(gifts),'UserGift');
    await rejected('gift/receive',{userId:seed.userId,giftIds:[earned.id]});
    await push({UserUnderPvpRevengeTicket:[{...beforeTicket,amount:2,signature:567}],UserInfo:[{...user(),processingUnderPvpState:1}]});
    const spent=app.store.db.prepare('SELECT * FROM under_pvp_rematch_stock_state WHERE ticket_id=?').get(ticketId);
    assert.equal(spent.kind,0);assert.equal(spent.battle_id,rematch.battleId);
    const rematchResult=await finish(rematch,{isWin:true,isRetire:false}),cleared=app.store.underPvpActiveBattle().rematchAfter;
    await push({...settled(rematchResult),[table]:[cleared]});
    await close();await open();now=season.slot8+50;
    const grant=parse(await send('gift/receive',{userId:seed.userId,giftIds:[earned.id]})).operations[0],
      afterTicket={...beforeTicket,amount:6,cumulativeAmount:4,signature:678},received={...earned,state:1};
    for (const target of ['under_pvp_rematch_stock_state','under_pvp_rematch_reward_claim']) {
      app.store.db.exec(`CREATE TRIGGER fail_stock_transition BEFORE UPDATE ON ${target} BEGIN SELECT RAISE(ABORT,'stock transition rollback'); END`);
      const data=delta({UserUnderPvpRevengeTicket:[afterTicket],UserGift:[received]});data.operations=[{id:grant.id,verifier:grant.token}];
      await rejected('user_data/push',data,false);app.store.db.exec('DROP TRIGGER fail_stock_transition');
    }
    const data=delta({UserUnderPvpRevengeTicket:[afterTicket],UserGift:[received]});data.operations=[{id:grant.id,verifier:grant.token}];
    parse(await send('user_data/push',data));
    const granted=app.store.db.prepare('SELECT * FROM under_pvp_rematch_stock_state WHERE ticket_id=?').get(ticketId);
    assert.equal(granted.kind,1);assert.equal(granted.battle_id,rematch.battleId);assert.equal(granted.operation_id,grant.id);
    await close();await open();app.store.db.exec('DELETE FROM reply_cache');
    assert.equal(app.store.underPvpRematchState().stock.get(id).target.amount,6,'Later earning supersedes the captured debit at a rewound clock');
    await rejected('user_data/push',delta({UserUnderPvpRevengeTicket:[{...afterTicket,amount:2,cumulativeAmount:0}]}));
    // A second real API loss/rematch consumes the newly earned stock while
    // retaining the latest grant ID, never rewriting the original initializer.
    const secondLoss=await start(),secondResult=await finish(secondLoss.battle,{isWin:false,isRetire:false}),
      secondStatus=app.store.underPvpActiveBattle().rematchAfter;
    await push({...settled(secondResult),[table]:[secondStatus]});
    const nextRematch=parse(await send('under_pvp/battle/start',{...secondLoss.body,isRevenge:true,revengeStartAt:secondStatus.revengeStartAt}));
    await push({UserUnderPvpRevengeTicket:[{...afterTicket,amount:5}],UserInfo:[{...user(),processingUnderPvpState:1}]});
    const cost=app.store.db.prepare('SELECT * FROM under_pvp_rematch_stock_state WHERE ticket_id=?').get(ticketId);
    assert.equal(cost.kind,0);assert.equal(cost.battle_id,nextRematch.battleId);assert.equal(cost.operation_id,grant.id);
    assert.equal(app.store.underPvpRematchState().stock.get(id).target.cumulativeAmount,4,'Spending preserves real acquisition totals');
    console.log('Rematch result/reset/battle save checks passed; native acceptance and cold legacy recovery still required');
  } finally {await close();fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
