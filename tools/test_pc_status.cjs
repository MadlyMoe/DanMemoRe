'use strict';

// DEFERRED, NOT RUN. Original metadata + synthetic modifier vectors are not
// native full-status/signature/UI proof. No modified actual save is used.
const assert = require('node:assert/strict');
const { pcBaseStatus,pcStatusFromComponents,pcFriendshipStats,pcBoardBonuses,
  pcAbilityBonuses,pcPassiveBonuses,pcHeroSublimateStats,pcDispatchStatus } = require('./danmemore_server.cjs');
const master = require('../data/danmemore-master.json');
const seed = require('../data/danmemore-seed.json');
const kinds = [1,2,4,8,16,32,64,128];
const vector = value => Object.fromEntries(kinds.map(kind=>[kind,value]));
const pc = seed.data.UserPC.find(row=>row.pcId===1011001001);
const before = JSON.stringify({ pc,base:master.pcBaseStats[pc.pcId],growth:master.pcLevelGrowth[11] });

assert.deepEqual(pcBaseStatus(pc,master), { jobRank:1,level:1,
  stats:{ 1:100,2:10,4:9,8:11,16:9,32:11,64:16,128:9 } });
// Level10 has four +4 steps, then five +6 steps; it is not just +6.
const rankOne = pcBaseStatus({ ...pc,totalExp:master.pcLevels[11].find(([level])=>level===20)[1] },master);
assert.deepEqual(rankOne,{ jobRank:1,level:10,
  stats:{ 1:146,2:10,4:9,8:11,16:9,32:11,64:25,128:9 } });
assert.deepEqual(pcBaseStatus({ ...pc,currentJobIndex:2,totalExp:41230 },master),{ jobRank:2,level:20,
  stats:{ 1:236,2:10,4:9,8:11,16:9,32:11,64:40,128:9 } });
assert.deepEqual(pcBaseStatus({ ...pc,limitbreakCount:1,totalExp:13650 },master),{ jobRank:1,level:14,
  stats:{ 1:178,2:10,4:9,8:11,16:9,32:11,64:29,128:9 } });
for (const change of [{ currentJobIndex:0 },{ currentJobIndex:7 },{ totalExp:-1 },{ totalExp:0.5 },
  { limitbreakCount:6 },{ pcId:1 }]) assert.equal(pcBaseStatus({ ...pc,...change },master),null);

const base = master.pcBaseStats[pc.pcId], group = master.pcLevelGrowth[11];
for (const corrupt of [
  { ...master,pcBaseStats:{} },{ ...master,pcLevelGrowth:{} },
  { ...master,pcBaseStats:{ ...master.pcBaseStats,[pc.pcId]:{ ...base,1:undefined } } },
  { ...master,pcBaseStats:{ ...master.pcBaseStats,[pc.pcId]:{ ...base,256:0 } } },
  { ...master,pcLevelGrowth:{ ...master.pcLevelGrowth,11:[[2,...group[0].slice(1)],...group.slice(1)] } },
  { ...master,pcLevelGrowth:{ ...master.pcLevelGrowth,11:[[1,0],...group.slice(1)] } },
]) assert.equal(pcBaseStatus(pc,corrupt),null,'Missing/malformed original providers are not invented');

const zero = vector(0);
assert.deepEqual(pcStatusFromComponents(base,zero,zero),{ stats:base,total:166 });
const percent = { ...zero,1:1250,2:-1250 },flat = { ...zero,1:3,2:-2,128:9000 };
assert.deepEqual(pcStatusFromComponents(base,percent,flat),{
  stats:{ 1:115,2:7,4:9,8:11,16:9,32:11,64:16,128:9009 },total:178 });
// No special kind1/8 minimum or scaling: dispatch's boolean is false.
assert.deepEqual(pcStatusFromComponents(zero,zero,{ ...zero,1:-3,8:-2 }),{
  stats:{ ...zero,1:-3,8:-2 },total:-5 });
// ARM64 MUL W wraps BEFORE division: INT_MAX*2 == -2, then SDIV gives0.
assert.equal(pcStatusFromComponents({ ...zero,1:0x7fffffff },{ ...zero,1:2 },zero).stats[1],0x7fffffff);
assert.equal(pcStatusFromComponents({ ...zero,1:0x7fffffff },zero,{ ...zero,1:1 }).stats[1],-0x80000000);
assert.equal(pcStatusFromComponents({ ...zero,1:0x7fffffff,64:1 },zero,zero).total,-0x80000000);
for (const bad of [null,{}, { ...zero,1:0.25 },{ ...zero,1:0x80000000 },{ ...zero,1:-0x80000001 },
  { ...zero,256:0 },{ ...zero,128:undefined }]) {
  for (const at of [0,1,2]) {
    const inputs=[base,zero,zero]; inputs[at]=bad;
    assert.throws(()=>pcStatusFromComponents(...inputs),error=>error.status===503 && error.offlineUnavailable);
  }
}
// The base summation also uses native int32 ADD, including the level1 row.
const synthetic = { ...master,pcBaseStats:{ ...master.pcBaseStats,[pc.pcId]:{ ...zero,1:0x7fffffff } },
  pcLevelGrowth:{ ...master.pcLevelGrowth,11:[[1,1,2,3,4,5,6,7,8],...group.slice(1)] } };
assert.deepEqual(pcBaseStatus(pc,synthetic).stats,{ 1:-0x80000000,2:2,4:3,8:4,16:5,32:6,64:7,128:8 });
assert.equal(JSON.stringify({ pc,base:master.pcBaseStats[pc.pcId],growth:master.pcLevelGrowth[11] }),before);

// Native CP stat rewards use earned levels on ALL three tracks, not just
// the hero selected in the UI. These are synthetic earned-point fixtures.
const cp = { userId:seed.userId,characterId:101000001,friendship:378,friendshipAis:378,friendshipLef:378 };
assert.deepEqual(pcFriendshipStats(pc,cp,master),{ 1:104,2:5,4:5,8:25,16:0,32:22,64:0,128:0 });
assert.deepEqual(pcFriendshipStats(pc,{ ...cp,userId:0 },master),pcFriendshipStats(pc,cp,master),
  'Native character-ID lookup reads all earned tracks without replacing a lazy zero owner');
assert.deepEqual(pcFriendshipStats(pc,{ ...cp,friendship:15,friendshipAis:0,friendshipLef:0 },master),zero);
assert.deepEqual(pcFriendshipStats(pc,{ ...cp,friendship:16,friendshipAis:0,friendshipLef:0 },master),{ ...zero,2:5 });
assert.deepEqual(pcFriendshipStats(pc,{ ...cp,friendship:0,friendshipAis:378,friendshipLef:0 },master),{ ...zero,1:52,8:13,32:9 });
for (const change of [{ userId:2 },{ userId:'0' },{ userId:'1' },{ userId:null },{ userId:undefined },
  { characterId:101000002 },{ friendship:-1 },
  { friendshipAis:undefined },{ friendshipLef:0.5 }]) assert.equal(pcFriendshipStats(pc,{ ...cp,...change },master),null);
assert.equal(pcFriendshipStats({ ...pc,ownerType:2 },cp,master),null);
for (const data of [{ levels:[],rewards:[] },{ levels:[[1,0],[3,16]],rewards:[] },
  { ...master.characters[cp.characterId],rewards:[[1,1,8,-1,0,0]] }]) {
  assert.equal(pcFriendshipStats(pc,cp,{ ...master,characters:{ ...master.characters,[cp.characterId]:data } }),null);
}
const cpBase = Object.fromEntries(kinds.map(kind=>[kind,base[kind]+pcFriendshipStats(pc,cp,master)[kind]]));
assert.equal(pcStatusFromComponents(cpBase,{ ...zero,1:1000 },zero).stats[1],224,
  'CP adds to base BEFORE percentage calculation, not to the final flat map');

const panels = new Map();
for (const panel of Object.values(master.pcAbilityPanels)) {
  const rows=panels.get(panel.groupId) ?? []; rows.push(panel); panels.set(panel.groupId,rows);
}
const jobs = master.pcProfiles[pc.pcId].jobIds;
const set = { userId:seed.userId,pcId:pc.pcId,pcJobs:[{ pcJobId:jobs[0],abilityPanelState:0x2000007,abilityPanels:[] }] };
// The recovered native vector includes128; only dispatch TOTAL excludes it.
const sevenZero = zero;
assert.deepEqual(pcBoardBonuses(pc,null,master,panels),{ base:sevenZero,percent:sevenZero },'Native lazy missing set');
assert.deepEqual(pcBoardBonuses(pc,{ ...set,pcJobs:[] },master,panels),{ base:sevenZero,percent:sevenZero });
assert.deepEqual(pcBoardBonuses(pc,set,master,panels),{ base:{ ...sevenZero,2:6 },percent:sevenZero },
  'Three opened panels with the same ability ID all contribute; do not deduplicate');
const ordered = { ...set,pcJobs:[{ pcJobId:jobs[1],abilityPanelState:0,abilityPanels:[] },...set.pcJobs] };
assert.deepEqual(pcBoardBonuses(pc,ordered,master,panels),pcBoardBonuses(pc,set,master,panels));
for (const broken of [{ ...set,userId:2 },{ ...set,pcId:1 },{ ...set,pcJobs:[...set.pcJobs,...set.pcJobs] },
  { ...set,pcJobs:[{ ...set.pcJobs[0],pcJobId:1 }] },{ ...set,pcJobs:[{ ...set.pcJobs[0],abilityPanelState:0x100000000 }] },
  { ...set,pcJobs:[{ ...set.pcJobs[0],abilityPanels:[{}] }] }]) assert.equal(pcBoardBonuses(pc,broken,master,panels),null);
assert.equal(pcBoardBonuses({ ...pc,jobs:[{}] },set,master,panels),null,'Unknown legacy data is not cleared or made zero');
assert.equal(pcBoardBonuses(pc,set,master,new Map()),null,'Missing original groups are not zero boards');
for (const broken of [null,{},[null],[{ ...panels.get(master.pcJobPanelGroups[jobs[0]])[0],index:0 }]])
  assert.equal(pcBoardBonuses(pc,set,master,new Map([...panels].map(([id,rows])=>
    [id,id===master.pcJobPanelGroups[jobs[0]]?broken:rows]))),null,'Malformed original panel providers cancel');
assert.equal(pcBoardBonuses(pc,null,{ ...master,pcAbilities:{} },panels),null,
  'Even closed native boards require every original ability, not invented zero modifiers');

// Synthetic single-panel replacements isolate original mode/mask/condition
// semantics. These are not obtainable panels or native extra-pass proof.
const one = { ...set,pcJobs:[{ ...set.pcJobs[0],abilityPanelState:1 }] };
const first = panels.get(master.pcJobPanelGroups[jobs[0]]).find(row=>row.index===1);
const changedPanel = abilityId => new Map([...panels].map(([id,rows])=>[id,rows.map(row=>
  row===first?{ ...row,abilityId }:row)]));
assert.deepEqual(pcBoardBonuses(pc,one,master,changedPanel(2250100105)),{
  base:sevenZero,percent:{ ...sevenZero,2:200,4:200,8:200,16:200,32:200 } });
assert.deepEqual(pcBoardBonuses(pc,one,master,changedPanel(2250100188)),{ base:sevenZero,percent:sevenZero },
  'Unconditioned first board pass supplies no weapon, so weapon condition1 does not apply');
const lbId = master.pcLimitBreakJobs[pc.pcId],lbPanel = panels.get(master.pcJobPanelGroups[lbId]).find(row=>row.index===1);
const lbSet = { ...set,pcJobs:[{ pcJobId:lbId,abilityPanelState:1,abilityPanels:[] }] };
assert.deepEqual(pcBoardBonuses(pc,lbSet,master,panels),{ base:sevenZero,percent:sevenZero },'No extra board pass at limitbreak0');
const lbAbility=master.pcAbilities[lbPanel.abilityId],lbExpected={ ...sevenZero };
for (const kind of Object.keys(lbExpected).map(Number)) if (lbAbility.mask & kind) lbExpected[kind]=lbAbility.amount;
assert.ok(lbAbility.condition===0 && [1,16].includes(lbAbility.mode));
assert.deepEqual(pcBoardBonuses({ ...pc,limitbreakCount:1 },lbSet,master,panels),{
  base:lbAbility.mode===1?lbExpected:sevenZero,percent:lbAbility.mode===16?lbExpected:sevenZero });
const emptyCP={ ...cp,friendship:0,friendshipAis:0,friendshipLef:0 };
assert.deepEqual(pcPassiveBonuses(pc,null,master,panels,null),{ base:zero,percent:zero });
assert.deepEqual(pcPassiveBonuses({ ...pc,currentJobIndex:2 },null,master,panels,null),{
  base:zero,percent:{ ...zero,8:300 } });
assert.deepEqual(pcPassiveBonuses({ ...pc,currentJobIndex:5 },null,master,panels,null),{
  base:zero,percent:{ ...zero,2:500,4:200,8:500,16:500,32:200 } });
const rankFour={ ...master,pcJobRanks:{ ...master.pcJobRanks,[jobs[0]]:4 } };
assert.deepEqual(pcPassiveBonuses(pc,null,rankFour,panels,null),{
  base:zero,percent:{ ...zero,2:300,8:300,16:300 } },'Original job rank, NOT currentJobIndex1');
assert.equal(pcPassiveBonuses(pc,null,master,panels,undefined),null,'Missing weapon input is not absence');
assert.equal(pcPassiveBonuses(pc,null,{ ...master,pcProfiles:{ ...master.pcProfiles,
  [pc.pcId]:{ ...master.pcProfiles[pc.pcId],rankAbilities:[] } } },panels,null),null);
for (const weapon of [null,{ type:1,kind:1 },{ type:1,kind:4 },{ type:2,kind:2 }])
  assert.deepEqual(pcAbilityBonuses([2250100188],master,weapon),{ base:zero,percent:zero });
assert.deepEqual(pcAbilityBonuses([2250100188],master,{ type:1,kind:2 }),{
  base:zero,percent:{ ...zero,4:2500 } });
assert.deepEqual(pcAbilityBonuses([2250000202,2250000202],master,null),{
  base:{ ...zero,2:4 },percent:zero },'Repeated passive effects also stack');
const kind128={ ...master,pcAbilities:{ ...master.pcAbilities,2250000202:{ ...master.pcAbilities[2250000202],mask:128 } } };
assert.deepEqual(pcAbilityBonuses([2250000202],kind128,null),{ base:{ ...zero,128:2 },percent:zero });

// Synthetic substitution inputs isolate closed-placeholder indexing. Native
// source order is retained; selecting a later opened panel consumes its own
// replacement, never the first replacement for the first OPENED panel.
const extraPC={ ...pc,pcId:1011001034,limitbreakCount:1 },extraProfile=master.pcProfiles[extraPC.pcId],
  extraJob=master.pcLimitBreakJobs[extraPC.pcId],extraPanels=panels.get(master.pcJobPanelGroups[extraJob]),
  markers=extraPanels.filter(panel=>master.pcAbilities[panel.abilityId].type===51);
assert.equal(markers.length,3);
const extraMaster={ ...master,pcProfiles:{ ...master.pcProfiles,[extraPC.pcId]:{ ...extraProfile,
  rankAbilities:Array.from({ length:5 },(_,i)=>[i+1,0]),extraAbilities:[2250000202,2250100188] } } },
  extraSet={ userId:seed.userId,pcId:extraPC.pcId,pcJobs:[{ pcJobId:extraJob,
    abilityPanelState:1 << (markers[1].index-1),abilityPanels:[] }] };
assert.deepEqual(pcPassiveBonuses(extraPC,extraSet,extraMaster,panels,{ type:1,kind:2 }),{
  base:zero,percent:{ ...zero,4:2500 } });
assert.deepEqual(pcPassiveBonuses({ ...extraPC,limitbreakCount:0 },extraSet,extraMaster,panels,{ type:1,kind:2 }),{
  base:zero,percent:zero });

assert.deepEqual(pcHeroSublimateStats(pc,master),zero);
const heroPC={ ...pc,pcId:1011001005,heroSublimateLevel:6,isUnlockedHeroSublimate:true };
assert.deepEqual(pcHeroSublimateStats({ ...heroPC,heroSublimateLevel:0 },master),zero);
assert.deepEqual(pcHeroSublimateStats({ ...heroPC,heroSublimateLevel:1 },master),{
  ...zero,1:125,64:7,2:36,4:5,8:9,16:21,32:8 });
assert.deepEqual(pcHeroSublimateStats(heroPC,master),{
  ...zero,1:1175,64:70,2:350,4:50,8:83,16:180,32:75 },'EVERY ascension step, not the last step');
assert.deepEqual(pcHeroSublimateStats({ ...heroPC,isUnlockedHeroSublimate:false },master),zero,
  'Native unlock gate: arithmetic fixture, not natural locked-level earning');
assert.equal(pcStatusFromComponents({ ...zero,1:100 },{ ...zero,1:1000 },{ ...zero,1:125 }).stats[1],235,
  'Ascension is FLAT after percentage, unlike CP');
for (const bad of [{ heroSublimateLevel:7 },{ heroSublimateLevel:-1 },{ isUnlockedHeroSublimate:undefined }])
  assert.equal(pcHeroSublimateStats({ ...heroPC,...bad },master),null);
assert.equal(pcHeroSublimateStats(heroPC,{ ...master,pcHeroSublimateSteps:{} }),null);
assert.equal(pcHeroSublimateStats(heroPC,{ ...master,pcHeroSublimateGroups:{} }),null);
assert.deepEqual(pcDispatchStatus(pc,null,emptyCP,master,panels,null),{
  jobRank:1,level:1,stats:base,total:166 });
assert.equal(pcDispatchStatus(pc,null,cp,master,panels,null).total,327);
assert.deepEqual(pcDispatchStatus(pc,null,{ ...cp,userId:0 },master,panels,null),
  pcDispatchStatus(pc,null,cp,master,panels,null));
assert.equal(pcDispatchStatus({ ...pc,currentJobIndex:2 },null,cp,master,panels,null).total,328);
assert.equal(pcDispatchStatus(pc,null,emptyCP,{ ...master,pcHeroSublimateSteps:{} },panels,null),null);
console.log('Owned dispatch stat chain: original data and synthetic source checks; native totals/signatures/UI not verified');
