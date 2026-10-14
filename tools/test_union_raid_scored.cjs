'use strict';
// DEFERRED / NOT RUN: execute only after every packet is implemented.
// Source-contract coverage is not native operation/save/UI acceptance.
const assert=require('node:assert/strict');
const {API_ACTIONS,USER_ID,unionRaidInitialProgress,unionRaidEarnedDefeatCount,unionRaidDefeatCountItems,unionRaidRewardAcquisition,unionRaidScoredSettlement,
  unionRaidDisplayDefeatRows,unionRaidTotalScoreLogs,unionRaidMemberRankingResult}=require('./danmemore_server.cjs');
const ints=['pcId','pcLv','assiId','assiLv','wpPerf','amPerf','str','int','agi','vit','luck',
  'hp','mp','physical','magic','defense','actCnt','spCnt','lsCnt'];
const longs=['wpId','wpAbi1','wpAbi2','wpAbi3','wpAbi4','wpAbi5','amId','amAbi1','amAbi2','amAbi3','amAbi4','amAbi5','pcDamage','enemyDamage'];
const pc=Object.fromEntries([...ints,...longs].map(key=>[key,0]));
const completion=(bosses,loopCount=1)=>({adventureRecord:{normalAttackCount:1,skillCount:0,specialSkillCount:0,
  linkageSkillCount:0,deathCount:0,continueCount:0,turnCount:1},adventureStageId:1280000101101,
  token:'deferred-scored-union',adventureStageTaskIds:[],adventureGainedItems:[],friendshipStates:[],
  isEnemyAnnihilated:true,secretMissionCompleted:false,unionRaidStageId:415000001,unionRaidStageIndex:0,
  loopCount,bosses,isTraining:false,debug:false,battleLog:[pc,['gauge',0]]});

assert.ok(API_ACTIONS.has('union_raid/battle/log'));
assert.ok(API_ACTIONS.has('union_raid/ranking/member/get'));
assert.ok(API_ACTIONS.has('union_raid/reward/defeat'));
const progress=unionRaidInitialProgress(),nondefeat=unionRaidScoredSettlement(completion(
  Array.from({length:5},(_,enemyIndex)=>({enemyIndex,damage:enemyIndex===0?100:0}))),progress,1661439601,'Bell');
assert.equal(nondefeat.parameters.score,100);
assert.equal(nondefeat.parameters.totalDamage,100);
assert.equal(nondefeat.parameters.stageInfo.bosses[0].hp,5687);
assert.deepEqual(nondefeat.parameters.lastBattleInfo.params,{p1:100,p2:415000001});
assert.equal(nondefeat.statusAfter.stageInfo.familiaScore,100);
assert.deepEqual(nondefeat.parameters.gainedItems,{items:[]});
assert.deepEqual(nondefeat.parameters.gainedServerItems,{items:[]});

const defeat=unionRaidScoredSettlement(completion(
  Array.from({length:5},(_,enemyIndex)=>({enemyIndex,damage:6000}))),progress,1661439602,'Bell');
assert.equal(defeat.parameters.score,28935);
assert.equal(defeat.parameters.defeatNow,true);
assert.equal(defeat.statusAfter.stageInfo.loopCount,2);
assert.equal(defeat.statusAfter.stageInfo.defeatCount,1);
assert.ok(defeat.statusAfter.stageInfo.bosses.every(row=>row.hp===5787));
assert.equal(defeat.statusAfter.defeatRewardExists,true);
assert.deepEqual(defeat.parameters.gainedItems,{items:[]});
assert.deepEqual(defeat.parameters.gainedServerItems,{items:[
  {itemId:205000002,amount:50000},{itemId:32000001,amount:20},
]});
assert.deepEqual(unionRaidScoredSettlement(completion(
  Array.from({length:5},(_,enemyIndex)=>({enemyIndex,damage:6000}))),progress,1661439602,'Bell',null,false)
  .parameters.gainedServerItems,{items:[]});
assert.equal(unionRaidEarnedDefeatCount(0,defeat.statusAfter,[],1),1);
assert.equal(unionRaidEarnedDefeatCount(0,null,[{capture:{receipt:{creation_operation_id:1},
  statusAfter:defeat.statusAfter}}],1),1);
assert.equal(unionRaidEarnedDefeatCount(3,null,[{capture:{receipt:{creation_operation_id:2},
  statusAfter:defeat.statusAfter}}],1),3);
const defeatCapture={receipt:{union_raid_stage_id:415000001},operation:{parameters:{defeatNow:true}},
  statusBefore:progress,statusAfter:defeat.statusAfter};
assert.deepEqual(unionRaidDisplayDefeatRows(defeat.statusAfter,[defeatCapture],0),
  [{stageId:415000001,loopCount:1}]);
assert.deepEqual(unionRaidDisplayDefeatRows(defeat.statusAfter,[defeatCapture],1),[]);
assert.throws(()=>unionRaidDisplayDefeatRows(defeat.statusAfter,[],0),/discontinuous/);
assert.throws(()=>unionRaidDisplayDefeatRows(defeat.statusAfter,[defeatCapture],2),/discontinuous/);
const secondDefeat=unionRaidScoredSettlement(completion(
  Array.from({length:5},(_,enemyIndex)=>({enemyIndex,damage:6000})),2),defeat.statusAfter,1661439603,'Bell'),
  secondCapture={...defeatCapture,statusBefore:defeat.statusAfter,statusAfter:secondDefeat.statusAfter};
assert.deepEqual(secondDefeat.parameters.gainedServerItems,{items:[
  {itemId:295000001,amount:2},{itemId:32000001,amount:20},
]});
assert.deepEqual(unionRaidDisplayDefeatRows(secondDefeat.statusAfter,[defeatCapture,secondCapture],0),
  [{stageId:415000001,loopCount:1},{stageId:415000001,loopCount:2}]);
assert.deepEqual(unionRaidDisplayDefeatRows(secondDefeat.statusAfter,[defeatCapture,secondCapture],1),
  [{stageId:415000001,loopCount:2}]);
assert.deepEqual(unionRaidDisplayDefeatRows(secondDefeat.statusAfter,[defeatCapture,secondCapture],2),[]);

const defeatCountRewards=[
  [[205000002,50000],[32000001,20]],[[295000001,2],[32000001,20]],
  [[98000001,1],[215000001,2]],[[205000002,50000],[32000001,20]],
  [[295000001,3],[32000001,20]],[[98000001,1],[215000003,2]],
  [[205000002,100000],[32000001,20]],[[295000001,3],[32000002,10]],
  [[99000001,2],[215000005,2]],[[205000002,100000],[32000002,20]],
  [[295000001,3],[32000002,20]],[[99000001,2],[215000001,5]],
  [[205000002,100000],[32000002,20]],[[295000001,3],[32000002,20]],
  [[99000001,2],[215000003,5]],[[205000002,200000],[32000003,10]],
  [[295000001,3],[32000003,20]],[[99000001,2],[215000005,5]],
  [[295000001,3],[32000003,20]],[[99000001,2],[32000003,20]],
  [[205000002,200000],[215000001,1],[215000003,1],[215000005,1]],
];
for(const [index,items] of defeatCountRewards.entries()) assert.deepEqual(unionRaidDefeatCountItems(index+1),
  items.map(([itemId,amount])=>({itemId,amount})));
assert.deepEqual(unionRaidDefeatCountItems(22),[]);
assert.throws(()=>unionRaidDefeatCountItems(0),/threshold/);
assert.deepEqual(unionRaidRewardAcquisition({itemId:215000001,amount:2},
  {table:'UserCpItem',idField:'cpItemId'},null,{reserved:10,pendingItem:false}),{
  item_id:215000001,amount:2,table_name:'UserCpItem',id_field:'cpItemId',reserved_before:10,
  cumulative_amount:12,cap:null,
});
const saturated=unionRaidRewardAcquisition({itemId:215000001,amount:5},
  {table:'UserCpItem',idField:'cpItemId'},{amount:999999998,cumulativeAmount:999999998,signature:17},
  {reserved:999999998,pendingItem:false});
assert.deepEqual(saturated,{item_id:215000001,amount:5,table_name:'UserCpItem',id_field:'cpItemId',
  reserved_before:999999998,cumulative_amount:999999999,cap:{policy:'offline-union-raid-stock-cap-v1',
    beforeCumulative:999999998,beforeAmount:999999998,amount:999999999,beforeSignature:17}});
assert.throws(()=>unionRaidRewardAcquisition({itemId:215000001,amount:5},
  {table:'UserCpItem',idField:'cpItemId'},{amount:999999998,cumulativeAmount:999999998,signature:17},
  {reserved:999999998,pendingItem:true}),/isolated/);
const saturatedValis=unionRaidRewardAcquisition({itemId:205000002,amount:50000},
  {table:'UserCurrency',idField:'currencyId'},{amount:1000000000,cumulativeAmount:999999998,signature:17},
  {reserved:999999998,pendingItem:false},{ceiling:null,source_operation_id:null,source_kind:null});
assert.deepEqual(saturatedValis,{item_id:205000002,amount:50000,table_name:'UserCurrency',id_field:'currencyId',
  reserved_before:999999998,cumulative_amount:999999999,cap:{policy:'offline-union-raid-valis-cap-v1',
    beforeCumulative:999999998,beforeAmount:1000000000,amount:1000050000,beforeSignature:17,
    floorCeiling:null,floorSourceOperationId:null,floorSourceKind:null,ceilingBefore:2,credit:49999}});
assert.deepEqual(unionRaidRewardAcquisition({itemId:205000002,amount:50000},
  {table:'UserCurrency',idField:'currencyId'},{amount:1000000000,cumulativeAmount:999999998,signature:17},
  {reserved:999999998,pendingItem:false},{ceiling:500,source_operation_id:42,source_kind:'present'}).cap,
{policy:'offline-union-raid-valis-cap-v1',beforeCumulative:999999998,beforeAmount:1000000000,
  amount:1000050000,beforeSignature:17,floorCeiling:500,floorSourceOperationId:42,floorSourceKind:'present',
  ceilingBefore:500,credit:49999});
assert.throws(()=>unionRaidRewardAcquisition({itemId:205000002,amount:50000},
  {table:'UserCurrency',idField:'currencyId'},{amount:1000000000,cumulativeAmount:999999998,signature:17},
  {reserved:999999998,pendingItem:false}),/spending floor/);
for(const floor of [{ceiling:500,source_operation_id:0,source_kind:'present'},
  {ceiling:500,source_operation_id:42,source_kind:'publisher'},
  {ceiling:null,source_operation_id:42,source_kind:'present'}])
  assert.throws(()=>unionRaidRewardAcquisition({itemId:205000002,amount:50000},
    {table:'UserCurrency',idField:'currencyId'},{amount:1000000000,cumulativeAmount:999999998,signature:17},
    {reserved:999999998,pendingItem:false},floor),/spending floor/);

const scoreCapture=(before,after,createdAt,familiaName='Hestia Familia',godId=21000001)=>({
  receipt:{familia_name:familiaName,god_id:godId,created_at:createdAt},
  statusBefore:{stageInfo:{familiaScore:before}},statusAfter:{stageInfo:{familiaScore:after}}});
const totalScoreLogs=unionRaidTotalScoreLogs([
  scoreCapture(0,600000,1661439610),scoreCapture(600000,1600000,1661439620)]);
assert.deepEqual(totalScoreLogs,[
  {logId:433000003,familiaName:'Hestia Familia',godId:21000001,completedAt:1661439620},
  {logId:433000002,familiaName:'Hestia Familia',godId:21000001,completedAt:1661439620},
  {logId:433000001,familiaName:'Hestia Familia',godId:21000001,completedAt:1661439610},
]);
assert.deepEqual(unionRaidTotalScoreLogs([scoreCapture(0,499999,1661439610)]),[]);
assert.throws(()=>unionRaidTotalScoreLogs([scoreCapture(1,600000,1661439610)]),/discontinuous/);
assert.throws(()=>unionRaidTotalScoreLogs([scoreCapture(0,600000,1661439610,'')]),/immutable Familia snapshot/);

const leaderPc={pcId:101000001,jobRank:6,heroSublimateLevel:0,isUnlockedHeroSublimate:false},
  firstLog={userId:USER_ID,playerName:'Bell',attackedAt:1661439601,leaderPc,params:{p1:40,p2:415000001}},
  latestLog={userId:USER_ID,playerName:'Bell',attackedAt:1661439602,leaderPc,params:{p1:60,p2:415000001}},
  medalMember={userId:USER_ID,name:'Bell',leaderPc},
  rankedProgress={...unionRaidInitialProgress(),stageInfo:{...unionRaidInitialProgress().stageInfo,familiaScore:100}};
assert.deepEqual(unionRaidMemberRankingResult(1,unionRaidInitialProgress(),[]),{code:0,ranking:[]});
assert.deepEqual(unionRaidMemberRankingResult(1,rankedProgress,[latestLog,firstLog]),{code:0,ranking:[{
  rank:1,score:100,member:{userId:USER_ID,name:'Bell',leaderPc}}]});
assert.deepEqual(unionRaidMemberRankingResult(2,null,[latestLog,firstLog]),{code:0,ranking:[]});
assert.deepEqual(unionRaidMemberRankingResult(3,null,[latestLog,firstLog]),{code:0,ranking:[]});
assert.deepEqual(unionRaidMemberRankingResult(3,null,[],76000,medalMember),{code:0,ranking:[{
  rank:1,score:76000,member:medalMember}]});
for(const rankingType of [0,4,1.5])assert.throws(()=>unionRaidMemberRankingResult(rankingType,rankedProgress,[]));
assert.throws(()=>unionRaidMemberRankingResult(1,rankedProgress,[latestLog]));
assert.throws(()=>unionRaidMemberRankingResult(1,rankedProgress,[{...latestLog,userId:USER_ID+1},firstLog]));
assert.throws(()=>unionRaidMemberRankingResult(1,rankedProgress,[{...latestLog,leaderPc:{...leaderPc,jobRank:-1}},firstLog]));
assert.throws(()=>unionRaidMemberRankingResult(3,null,[],-1,medalMember));
assert.throws(()=>unionRaidMemberRankingResult(3,null,[],1,{...medalMember,userId:USER_ID+1}));
