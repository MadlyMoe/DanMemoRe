'use strict';

// WRITTEN ONLY / NOT RUN: defer execution until all packets/branches are implemented.
const assert=require('node:assert/strict');
const {guildRaidActivityParameters,guildRaidNativeEvent,guildRaidActiveHours,guildRaidStageCharge,guildRaidNormalSPState}=require('./danmemore_server.cjs');
const master=require('../data/danmemore-master.json');
const at=1790866800;

assert.deepEqual(guildRaidActivityParameters(master,null,at),{activeTimeAvailable:false});
assert.ok(master.familiaTimeIds.length>0);
for(const activeTime of master.familiaTimeIds) {
  for(const subActiveTime of new Set([0,...master.familiaTimeIds])) {
    const settings={activeTime,subActiveTime},before=structuredClone(settings);
    assert.deepEqual(guildRaidActivityParameters(master,settings,at),
      {activeTimeAvailable:true,activeTime,subActiveTime,completedAt:at});
    assert.deepEqual(settings,before,'Packet projection must not change Familia settings');
  }
}
const settings={activeTime:master.familiaTimeIds[0],subActiveTime:0};
for(const bad of [undefined,{},[],{...settings,activeTime:'1'},
  {...settings,activeTime:2147483648},{...settings,subActiveTime:-1},
  {...settings,subActiveTime:1.5},{...settings,subActiveTime:2147483648}])
  assert.throws(()=>guildRaidActivityParameters(master,bad,at),/original Familia times/);
for(const badAt of [undefined,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])
  assert.throws(()=>guildRaidActivityParameters(master,settings,badAt),/completion clock/);
for(const changed of [{}, {...master,familiaTimeIds:[]}, {...master,familiaTimeIds:null}])
  assert.throws(()=>guildRaidActivityParameters(changed,settings,at),/original Familia times/);
assert.equal(guildRaidActivityParameters(master,settings,Number.MAX_SAFE_INTEGER).completedAt,Number.MAX_SAFE_INTEGER);

//Original EU region5 uses +9h. Each authored interval is start-inclusive/end-exclusive.
const day=Math.floor(at/86400)*86400-32400;
for(const [id,row] of Object.entries(master.familiaActivityTimes)) {
  const other=Object.entries(master.familiaActivityTimes).find(([,candidate])=>
    candidate.startHour!==row.endHour && candidate.startHour!==row.startHour && candidate.endHour!==row.endHour),
    parameters=second=>guildRaidActivityParameters(master,{activeTime:Number(id),subActiveTime:Number(other[0])},day+second);
  assert.equal(guildRaidActiveHours(master,parameters(row.startHour*3600)),true);
  //The second time can overlap the first boundary, so use the native next-slot path separately.
  const fallback=guildRaidActivityParameters(master,{activeTime:Number(id),subActiveTime:0},day+row.endHour*3600);
  assert.equal(guildRaidActiveHours(master,fallback),true,'Secondary0 means next index, wrapping to authored0');
}
assert.equal(guildRaidActiveHours(master,{activeTimeAvailable:false}),false);
assert.equal(guildRaidActiveHours(master,guildRaidActivityParameters(master,{activeTime:22000009,subActiveTime:22000007},day+23*3600)),true);
assert.equal(guildRaidActiveHours(master,guildRaidActivityParameters(master,{activeTime:22000009,subActiveTime:22000007},day)),false);
assert.equal(guildRaidActiveHours(master,guildRaidActivityParameters(master,{activeTime:22000012,subActiveTime:0},day+6*3600)),true);

const [eventId,event]=Object.entries(master.guildRaidEvents)[0],raidId=Number(eventId),clock=event.window6+1,
  baseline={graidSP:2,consumedNormalSP:99,recoveredGraidSP:0,graidSPLastResetAt:clock},
  native={UserAdventureStage:[{adventureStageId:1010000101101}],skipCount:0,activeTimeAvailable:false};
assert.equal(guildRaidNativeEvent(master,event.window6),raidId);
assert.notEqual(guildRaidNativeEvent(master,event.window7),raidId);
assert.equal(guildRaidNativeEvent(master,event.window7,true),raidId,'Attempt rules remain after earning ends');
assert.notEqual(guildRaidNativeEvent(master,event.window9,true),raidId);
for(const [id,row] of Object.entries(master.guildRaidEvents)) {
  assert.notEqual(guildRaidNativeEvent(master,row.window7),Number(id));
  assert.notEqual(guildRaidNativeEvent(master,row.window9,true),Number(id));
}
assert.equal(guildRaidStageCharge(master,native,clock).charge,1,'Native stage stamina is1, NOT its96XP');
assert.equal(guildRaidStageCharge(master,{...native,skipCount:10},clock).charge,10);
const hour=Math.floor((clock+32400)%86400/3600),activeId=Number(Object.entries(master.familiaActivityTimes)
  .find(([,row])=>hour>=row.startHour && hour<(row.endHour<row.startHour ? row.endHour+24 : row.endHour))[0]),
  boosted={...native,...guildRaidActivityParameters(master,{activeTime:activeId,subActiveTime:0},clock)};
assert.equal(guildRaidStageCharge(master,boosted,clock).charge,2);
assert.equal(guildRaidStageCharge(master,{...native,UserAdventureStage:[{adventureStageId:1010000101103}]},clock).charge,0);
assert.equal(guildRaidStageCharge(master,native,event.window7).raidId,0);
const disabledId=Number(Object.entries(master.stageRaidStamina).find(([,row])=>!row.enabled)[0]);
assert.equal(guildRaidStageCharge(master,{...native,UserAdventureStage:[{adventureStageId:disabledId}]},clock).raidId,0);

const recovered=guildRaidNormalSPState(master,raidId,baseline,1,clock);
assert.deepEqual(recovered,{...baseline,graidSP:3,consumedNormalSP:0,recoveredGraidSP:1});
assert.deepEqual(baseline,{graidSP:2,consumedNormalSP:99,recoveredGraidSP:0,graidSPLastResetAt:clock});
const capped=guildRaidNormalSPState(master,raidId,baseline,301,clock);
assert.deepEqual(capped,{...baseline,graidSP:4,consumedNormalSP:200,recoveredGraidSP:2});
assert.deepEqual(guildRaidNormalSPState(master,raidId,capped,100,clock),{...capped,consumedNormalSP:300});
assert.equal(guildRaidNormalSPState(master,raidId,{...baseline,graidSP:10000},1,clock).graidSP,10001,'No invented stock cap');
assert.equal(guildRaidNormalSPState(master,raidId,{...baseline,graidSP:-5},1,clock).graidSP,0,'Native recovery clamps the signed sum');
assert.equal(guildRaidNormalSPState(master,raidId,{...baseline,consumedNormalSP:100},0,clock).recoveredGraidSP,1);
assert.deepEqual(guildRaidNormalSPState(master,raidId,recovered,0,clock),recovered);
const midnight=(Math.floor((clock+32400)/86400)+1)*86400-32400;
assert.deepEqual(guildRaidNormalSPState(master,raidId,capped,100,midnight),
  {graidSP:3,consumedNormalSP:0,recoveredGraidSP:1,graidSPLastResetAt:midnight});
assert.deepEqual(guildRaidNormalSPState(master,0,capped,0,midnight),
  {graidSP:0,consumedNormalSP:0,recoveredGraidSP:0,graidSPLastResetAt:midnight});
for(const charge of [-1,1.5,2147483648]) assert.throws(()=>guildRaidNormalSPState(master,raidId,baseline,charge,clock));
assert.throws(()=>guildRaidNormalSPState(master,raidId,{...baseline,graidSP:2147483647},1,clock),/overflow/);
assert.throws(()=>guildRaidNormalSPState(master,raidId,{...baseline,consumedNormalSP:2147483647},1,clock),/overflow/);
assert.throws(()=>guildRaidStageCharge(master,{...boosted,skipCount:2147483647},clock),/int32/);

// Integration/save/replay and native normal-SP arithmetic cases are queued in
// docs/packet-test-plan.md; this does not establish their acceptance.
