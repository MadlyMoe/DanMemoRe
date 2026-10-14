'use strict';

// DEFERRED / NOT RUN. Original-data and synthetic owned gear/board fixtures
// are not native HP/MP refill save/ACK, signatures or UI acceptance proof.
const assert=require('node:assert/strict');
const {pcBattleStatusFromComponents,pcEquipmentAbilityEffects,pcBattleStatus,pcDispatchStatus,
  pcOwnedEquipment,pcBoardIsComplete,pcOwnedBattleStatus,pcInitialStatInput}=require('./danmemore_server.cjs');
const master=require('../data/danmemore-master.json'),seed=require('../data/danmemore-seed.json');
const vector=value=>Object.fromEntries([1,2,4,8,16,32,64,128].map(kind=>[kind,value])),zero=vector(0);
const before=JSON.stringify({master,seed});
const base={...zero,1:100,8:100,64:16};
assert.deepEqual(pcBattleStatusFromComponents(base,zero,zero,zero,zero),{stats:base});
assert.deepEqual(pcBattleStatusFromComponents(base,{...zero,1:1000},{...zero,1:3},
  {...zero,1:-1000,8:-2000,64:-10000},zero),{stats:{...base,1:101,8:80}},
  'Base percentage then flat, then separate HP/MAG scaling; MP is never scaled');
assert.equal(pcBattleStatusFromComponents(base,zero,zero,{...zero,1:-20000},zero).stats[1],1);
assert.equal(pcBattleStatusFromComponents(base,zero,zero,{...zero,1:0x7fffffff},zero).stats[1],1,
  'Signed factor ADD wraps before clamp, not an unbounded JS addition');
assert.equal(pcBattleStatusFromComponents(base,zero,zero,{...zero,1:-10000},{...zero,1:5000}).stats[1],50);
assert.equal(pcBattleStatusFromComponents(base,zero,zero,{...zero,1:-10000},{...zero,1:0}).stats[1],1,
  'Zero override falls back, not a literal zero factor');
assert.equal(pcBattleStatusFromComponents(base,zero,zero,zero,{...zero,1:-5000}).stats[1],1);
assert.equal(pcBattleStatusFromComponents({...zero,1:0x7fffffff},zero,zero,zero,zero).stats[1],1,
  'Native MUL W wraps even for the default10000 factor');
for (const invalid of [null,{}, {...zero,1:0.1},{...zero,1:0x80000000},{...zero,256:0}])
  for (const index of [3,4]) {
    const args=[base,zero,zero,zero,zero];args[index]=invalid;
    assert.throws(()=>pcBattleStatusFromComponents(...args),error=>error.status===503 && error.offlineUnavailable);
  }
const context={jobRank:3,level:30,limitbreakCount:0,heroSublimateLevel:0,isBoardComplete:true};
assert.deepEqual(pcEquipmentAbilityEffects([21000038001],context,master),[{mode:1,mask:2,amount:3}]);
assert.deepEqual(pcEquipmentAbilityEffects([21000038001],{...context,isBoardComplete:false},master),[]);
assert.deepEqual(pcEquipmentAbilityEffects([21000038001],{...context,jobRank:4,level:1,isBoardComplete:false},master),
  [{mode:1,mask:2,amount:3}],'Later rank skips lower-rank level/board conditions');
assert.deepEqual(pcEquipmentAbilityEffects([21000038001,21000038001],context,master),
  [{mode:1,mask:2,amount:3},{mode:1,mask:2,amount:3}],'Repeated gear entries retain additive multiplicity');
assert.deepEqual(pcEquipmentAbilityEffects([21000038901],context,master),[],
  'Original debug group901 has no matching children; do not invent them');
const child={id:1,groupId:1,jobRank:3,level:30,limitbreakCount:0,heroSublimateLevel:0,mode:1,mask:2,amount:3};
const synthetic={...master,equipmentAbilityPcRaritySteps:[child,
  {...child,id:2,mode:32768,amount:4},{...child,id:3,mask:8,amount:5}]};
assert.deepEqual(pcEquipmentAbilityEffects([21000038001],context,synthetic),
  [{mode:1,mask:2,amount:7},{mode:1,mask:8,amount:5}],'Merge by mask and retain first mode/source order');
const replace={...synthetic,equipmentAbilities:{...master.equipmentAbilities,
  21000038001:{...master.equipmentAbilities[21000038001],kind:1}}};
assert.deepEqual(pcEquipmentAbilityEffects([21000038001],context,replace),[{mode:1,mask:8,amount:5}]);
const ascension={...synthetic,equipmentAbilityPcRaritySteps:[{...child,jobRank:6,level:80,limitbreakCount:5,heroSublimateLevel:1}]};
assert.deepEqual(pcEquipmentAbilityEffects([21000038001],{...context,heroSublimateLevel:1,isBoardComplete:false},ascension),
  [{mode:1,mask:2,amount:3}],'Positive ascension threshold is independent of level/rank/board checks');
assert.deepEqual(pcEquipmentAbilityEffects([21000038001],{...context,limitbreakCount:1,isBoardComplete:false},synthetic),
  [{mode:1,mask:2,amount:7},{mode:1,mask:8,amount:5}],'Higher limitbreak satisfies the board-dependent branch');
for (const bad of [undefined,null,{...context,isBoardComplete:1},{...context,jobRank:7},
  {...context,limitbreakCount:6},{...context,heroSublimateLevel:7},{...context,level:0},{...context,extra:0}])
  assert.equal(pcEquipmentAbilityEffects([],bad,master),null);
for (const ids of [null,[0],['21000038001'],[1]]) assert.equal(pcEquipmentAbilityEffects(ids,context,master),null);
for (const steps of [null,[child,child],[{...child,amount:undefined}],[{...child,extra:0}]])
  assert.equal(pcEquipmentAbilityEffects([21000038001],context,{...master,equipmentAbilityPcRaritySteps:steps}),null);
const pc=seed.data.UserPC.find(row=>row.pcId===1011001001),character={userId:seed.userId,characterId:101000001,
  friendship:0,friendshipAis:0,friendshipLef:0},panels=new Map();
for (const panel of Object.values(master.pcAbilityPanels)) {
  const rows=panels.get(panel.groupId)??[];rows.push(panel);panels.set(panel.groupId,rows);
}
const plain=pcDispatchStatus(pc,null,character,master,panels,null);
assert.deepEqual(pcBattleStatus(pc,null,character,master,panels,null,[],false),
  {jobRank:plain.jobRank,level:plain.level,stats:plain.stats});
assert.equal(pcBattleStatus(pc,null,character,master,panels,null,undefined,false),null);
assert.equal(pcBattleStatus(pc,null,character,master,panels,null,[],undefined),null);
const [hpId,hpAbility]=Object.entries(master.equipmentAbilities).find(([,a])=>a.type===1 && a.kind===1 && a.amount>0);
const modified=pcBattleStatus(pc,null,character,master,panels,null,[Number(hpId),21000039006],false);
assert.equal(modified.stats[1],Math.max(1,Math.trunc(Math.imul((plain.stats[1]+hpAbility.amount)|0,9000)/10000)));
assert.equal(modified.stats[64],plain.stats[64]);
const modes={...master,equipmentAbilities:{...master.equipmentAbilities,
  1:{type:1,kind:1,amount:5},2:{type:16,kind:1,amount:1000},
  3:{type:8192,kind:1,amount:5000},4:{type:8192,kind:1,amount:2500}}};
assert.equal(pcBattleStatus(pc,null,character,modes,panels,null,[1,1,2],false).stats[1],121,
  'Equipment flat-to-base additions precede percentage, not a final-stat sum');
assert.equal(pcBattleStatus(pc,null,character,modes,panels,null,[3,4],false).stats[1],25,
  'Later override replaces earlier override, not additive stacking');
assert.equal(pcBattleStatus(pc,null,character,modes,panels,null,[4,3],false).stats[1],50);
const gear=(equipmentId,slotIndex,extra={})=>({userId:seed.userId,equipmentId,slotIndex,createAt:1,
  exp:0,rarity:0,performance:0,durability:0,reservedDurability:0,isProtected:false,isUnbreakable:false,
  ...Object.fromEntries(Array.from({length:5},(_,i)=>[`abilityId${i+1}`,0])),
  ...Object.fromEntries(Array.from({length:5},(_,i)=>[`lockedAbility${i+1}`,false])),...extra});
const knife=gear(24000006201,1,{rarity:6,abilityId1:21000022115,abilityId5:21000022115}),
  armId=Number(Object.keys(master.equipments).find(id=>master.equipments[id].type===2)),
  armor=gear(armId,10001,{abilityId3:21000022115}),equipped={...pc,equippedWeaponIndex:1,equippedArmorIndex:10001},
  fixed=id=>Array.from({length:5},(_,i)=>master.equipments[id][`abilityId${i+1}`]).filter(Boolean),
  expected=[21000022115,21000022115,...fixed(knife.equipmentId),21000022115,21000022115,
    21000022115,...fixed(armId)];
assert.deepEqual(pcOwnedEquipment(equipped,[armor,knife],master),{weapon:{type:1,kind:32},abilityIds:expected},
  'Weapon before armour, saved before fixed before all eligible evolution groups, including duplicates and broken pieces');
assert.deepEqual(pcOwnedEquipment({...pc,equippedWeaponIndex:1},[gear(knife.equipmentId,1)],master).abilityIds,
  fixed(knife.equipmentId),'Saved rarity0 still uses original base rarity; no future evolution abilities');
const gap={...master,equipmentEvolutions:master.equipmentEvolutions.filter(row=>
  !(row.equipmentId===knife.equipmentId && row.rarity===5))};
assert.deepEqual(pcOwnedEquipment({...pc,equippedWeaponIndex:1},[knife],gap).abilityIds,
  [21000022115,21000022115,...fixed(knife.equipmentId)],'Constructor stops at FIRST missing evolution step');
const maxKnife=gear(knife.equipmentId,1,{rarity:13}),maxEvolution=master.equipmentEvolutions.filter(row=>
  row.equipmentId===knife.equipmentId && row.rarity>4 && row.rarity<=12).flatMap(row=>
  master.equipmentEvolveAbilities.filter(a=>a.groupId===row.abilityGroupId).map(a=>a.abilityId));
assert.deepEqual(pcOwnedEquipment({...pc,equippedWeaponIndex:1},[maxKnife],master).abilityIds,
  [...fixed(knife.equipmentId),...maxEvolution],'Original constructor caps evolution steps at12, not saved rarity');
const ordered={...master,equipmentEvolveAbilities:[...master.equipmentEvolveAbilities,
  {id:999,groupId:33000000001,abilityId:21000000001}]};
assert.deepEqual(pcOwnedEquipment({...pc,equippedWeaponIndex:1},[knife],ordered).abilityIds,
  [21000022115,21000022115,...fixed(knife.equipmentId),21000022115,21000000001,21000022115],
  'Each rarity preserves original evolution-content row order');
for (const rows of [null,[],[knife,knife],[{...knife,userId:0}],[{...knife,abilityId1:1}],
  [{...knife,isProtected:0}],[{...knife,rarity:-1}]])
  assert.equal(pcOwnedEquipment({...pc,equippedWeaponIndex:1},rows,master),null);
for (const change of [{ownerType:3},{userId:0},{equippedWeaponIndex:10001},{equippedArmorIndex:1}])
  assert.equal(pcOwnedEquipment({...equipped,...change},[knife,armor],master),null);
assert.equal(pcOwnedEquipment(pc,[],{...master,equipmentEvolutions:undefined}),null,
  'Missing original catalog is not inferred to mean no equipment bonuses');
assert.equal(pcBoardIsComplete(pc,null,master,panels),false);
const currentJob=master.pcProfiles[pc.pcId].jobIds[pc.currentJobIndex-1],
  fullMask=id=>panels.get(master.pcJobPanelGroups[id]).reduce((mask,p)=>mask|(1<<(p.index-1)),0x2000000),
  job=(id,mask)=>({pcJobId:id,abilityPanelState:mask,abilityPanels:[]}),
  board=pcJobs=>({userId:seed.userId,pcId:pc.pcId,pcJobs});
assert.equal(pcBoardIsComplete(pc,board([job(currentJob,fullMask(currentJob))]),master,panels),true);
assert.equal(pcBoardIsComplete(pc,board([job(currentJob,0x2000000)]),master,panels),false);
const finalJob=master.pcProfiles[pc.pcId].jobIds.at(-1),lbJob=master.pcLimitBreakJobs[pc.pcId],
  finalPc={...pc,currentJobIndex:master.pcProfiles[pc.pcId].jobIds.length,limitbreakCount:2},
  finalJobs=[job(finalJob,fullMask(finalJob))],latestFive=Array.from({length:5},(_,i)=>1<<(i+5)).reduce((a,b)=>a|b,0);
assert.equal(pcBoardIsComplete(finalPc,board(finalJobs),master,panels),false);
assert.equal(pcBoardIsComplete(finalPc,board([...finalJobs,job(lbJob,latestFive)]),master,panels),true,
  'Only current limitbreak indices6..10 matter; older groups and display flag may be closed');
assert.equal(pcBoardIsComplete(finalPc,board([...finalJobs,job(lbJob,0x200001f)]),master,panels),false,
  'Old limitbreak group and display flag cannot satisfy current group');
assert.equal(pcBoardIsComplete({...finalPc,limitbreakCount:0},board(finalJobs),master,panels),true);
assert.equal(pcBoardIsComplete(finalPc,board([...finalJobs,job(lbJob,latestFive),job(lbJob,latestFive)]),master,panels),null);
assert.equal(pcBoardIsComplete({...pc,jobs:[{}]},null,master,panels),null,'Do not replace unrecovered legacy boards with zero');
assert.deepEqual(pcOwnedBattleStatus(pc,null,character,[],master,panels),
  pcBattleStatus(pc,null,character,master,panels,null,[],false));
const ownedGear=pcOwnedEquipment(equipped,[knife,armor],master),ownedBoard=pcBoardIsComplete(equipped,null,master,panels);
assert.deepEqual(pcOwnedBattleStatus(equipped,null,character,[knife,armor],master,panels),
  pcBattleStatus(equipped,null,character,master,panels,ownedGear.weapon,ownedGear.abilityIds,ownedBoard));
assert.equal(pcOwnedBattleStatus(equipped,null,character,[],master,panels),null);
const initial=pcInitialStatInput(1011003001,master);
assert.equal(initial.currentJobIndex,1);assert.equal(master.pcJobRanks[master.pcProfiles[initial.pcId].jobIds[0]],2);
assert.equal(initial.totalExp,0);assert.equal(initial.ownerType,1);assert.deepEqual(initial.jobs,[]);
assert(!Object.hasOwn(initial,'signature')&&!Object.hasOwn(initial,'hp'),'Private stat input is not a fabricated native row');
for(const value of [null,{}, {level:2,jobRank:2},{level:1,jobRank:1},{level:1,jobRank:2,extra:0}])
  assert.equal(pcInitialStatInput(1011003001,{...master,pcInitialStates:{...master.pcInitialStates,1011003001:value}}),null);
assert.equal(pcInitialStatInput(1011003001,{...master,pcInitialStates:undefined}),null);
assert.equal(pcInitialStatInput('1011003001',master),null);
assert.equal(JSON.stringify({master,seed}),before,'Pure status recovery never rewrites native/player/master state');
console.log('Deferred native owned gear, board gate and separate battle stat arithmetic: OK');
