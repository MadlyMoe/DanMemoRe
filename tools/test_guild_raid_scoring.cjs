'use strict';
// DEFERRED / NOT RUN: execute only after all packets are implemented.
// Pure offline-policy probes, not publisher scoring or native gameplay proof.
const assert=require('node:assert/strict');
const {guildRaidScoredSettlement,USER_ID}=require('./danmemore_server.cjs');
const master=require('../data/danmemore-master.json');
for(const [eventId,event] of Object.entries(master.guildRaidEvents)) {
  const raidId=Number(eventId),ordered=Object.entries(master.guildRaidStages)
    .filter(([,stage])=>stage.guildRaidInformationId===raidId).sort((a,b)=>a[1].slot2-b[1].slot2 || a[1].slot3-b[1].slot3),
    statusFor=([id,stage])=>({code:0,available:true,guildRaidStageId:Number(id),loopCount:stage.slot2,
      bosses:stage.bossHp.flatMap((hp,enemyIndex)=>hp ? [{enemyIndex,hp}] : []),rank:0,ranking:[],defeatCount:0,
      defeatRewardExists:false,displayDefeatStageId:0,displayDefeatLoopCount:0,lastBattleInfo:{logType:0}}),
    requestFor=(status,damage)=>({guildRaidStageId:status.guildRaidStageId,loopCount:status.loopCount,isTraining:false,
      bosses:Array.from({length:5},(_,enemyIndex)=>({enemyIndex,damage:status.bosses.some(boss=>boss.enemyIndex===enemyIndex) ? damage : 0}))}),
    initial=statusFor(ordered[0]),sum=initial.bosses.reduce((total,boss)=>total+boss.hp,0),at=event.window6;
  const noDamage=guildRaidScoredSettlement(requestFor(initial,0),initial,null,master,at,'Offline');
  assert.equal(noDamage.parameters.score,0);assert.equal(noDamage.parameters.defeatNow,false);assert.equal(noDamage.parameters.rank,0);
  assert.deepEqual(noDamage.parameters.bosses,initial.bosses);assert.equal(noDamage.targetRecord.userId,USER_ID);
  assert.equal(noDamage.targetRecord.guildRaidId,raidId);assert.equal(noDamage.targetRecord.scoreInt64,0);
  assert.equal(noDamage.statusAfter.rank,0);assert.deepEqual(noDamage.statusAfter.ranking,[]);
  const old={userId:0,guildRaidId:raidId,score:123,scoreInt64:0x100000000,spRecoveryCount:1,lastSpRecoveryAt:at-1},
    kill=guildRaidScoredSettlement(requestFor(initial,0x7fffffff),initial,old,master,at,'Offline');
  assert.equal(kill.parameters.score,sum);assert.equal(kill.parameters.totalDamage,initial.bosses.length*0x7fffffff);
  assert.equal(kill.parameters.rank,1);
  assert.equal(kill.parameters.guildRaidStageId,initial.guildRaidStageId);assert.equal(kill.parameters.loopCount,initial.loopCount);
  assert.equal(kill.parameters.defeatNow,true);assert.equal(kill.statusAfter.defeatCount,1);
  assert.equal(kill.statusAfter.rank,1);assert.deepEqual(kill.statusAfter.ranking,[]);
  assert.equal(kill.statusAfter.displayDefeatStageId,initial.guildRaidStageId);assert.equal(kill.statusAfter.displayDefeatLoopCount,1);
  assert.equal(kill.statusAfter.guildRaidStageId,Number(ordered[1][0]));
  assert.deepEqual(kill.targetRecord,{...old,scoreInt64:old.scoreInt64+sum}); //No guessed legacy-score conversion.
  for(const row of ordered) {
    const status=statusFor(row),result=guildRaidScoredSettlement(requestFor(status,0x7fffffff),status,null,master,at,'Offline'),
      index=ordered.indexOf(row),next=row[1].slot4 ? ordered.find(([id])=>Number(id)===row[1].slot4) : ordered[index+1];
    assert.equal(result.parameters.guildRaidStageId,Number(row[0]));assert.equal(result.parameters.rank,1);
    assert.equal(result.statusAfter.guildRaidStageId,Number(next[0]));
    assert.equal(result.statusAfter.rank,1);assert.deepEqual(result.statusAfter.ranking,[]);
    assert.equal(result.statusAfter.loopCount,status.loopCount+(row[1].slot4 || next[1].slot2!==row[1].slot2 ? 1 : 0));
    assert.deepEqual(result.statusAfter.bosses,next[1].bossHp.flatMap((hp,enemyIndex)=>hp ? [{enemyIndex,hp}] : []));
  }
  for(const body of [{...requestFor(initial,1),loopCount:initial.loopCount+1},
    {...requestFor(initial,1),bosses:[{enemyIndex:0,damage:1}]},
    {...requestFor(initial,1),bosses:requestFor(initial,1).bosses.map(boss=>({...boss,damage:-1}))},
    {...requestFor(initial,1),isTraining:true}])
    assert.throws(()=>guildRaidScoredSettlement(body,initial,null,master,at,'Offline'));
  assert.throws(()=>guildRaidScoredSettlement(requestFor(initial,1),{...initial,rank:1},null,master,at,'Offline'));
  assert.throws(()=>guildRaidScoredSettlement(requestFor(initial,1),{...initial,rank:2},old,master,at,'Offline'));
  assert.throws(()=>guildRaidScoredSettlement(requestFor(initial,1),initial,{...old,scoreInt64:Number.MAX_SAFE_INTEGER},master,at,'Offline'));
  assert.throws(()=>guildRaidScoredSettlement(requestFor(initial,1),initial,old,master,-1,'Offline'));
}
console.log('Deferred offline raid scoring, authored stage order, repeated rotation, retained widths and records: OK');
