'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
// DEFERRED / NOT RUN: execute only after all packet implementation is finished.
// Original archive checks are not native gameplay acceptance.
const { gameplayData, nativeMasterConfig, decodeFile, decodeBlock, decodeTable, encodeBlock, rows, field } = require('./decode_master_data.cjs');
const master = require('../data/danmemore-master.json');
const lottoPrizes = require('../data/danmemore-lotto-prizes.json');
const root = path.resolve(__dirname, '..');

assert.equal(master.clientVersion, '15.1.0');
// WRITTEN ONLY: regenerate the export after implementation coverage, before running this consolidated check.
assert.equal(master.items['union_medal_item.1'],410000001);
assert.deepEqual(master.itemProfiles[410000001],{table:'UserUnionRaidMedal',idField:'medalId'});
assert.equal(master.sources.unionRaidMedal.rows,1);
assert.equal(master.sources.unionRaidMedal.sha256,'b456f52c4891c51a11f56e1e91f6af04e201cf79ce68cd55901b7ea176663f9b');
assert.deepEqual(master.unionRaidEvents,{413000001:{key:'union_raid_information.1',adventureId:672800001,name:'Grand Familia Battle S1',
  type:28,window6:1661439600,window7:1661925599,window8:1661439600,window9:1663811999}});
assert.deepEqual(master.unionRaidAttemptRules,{413000001:{bossDailySP:3,normalInitialSP:5,normalMaximumSP:10,normalSeconds:3600}});
assert.deepEqual(master.unionRaidTickets,{
  411000001:{family:'boss',table:'UserUnionRaidBossSpTicketItem',key:'union_raid_boss_sp_ticket_item.1'},
  412000001:{family:'normal',table:'UserUnionRaidNormalSpTicketItem',key:'union_raid_normal_sp_ticket_item.1'},
});
assert.deepEqual(master.unionRaidDefeatRewards,[{id:418000001,key:''}]);
assert.equal(master.sources.unionRaidDefeatReward.rows,1);
assert.equal(master.sources.unionRaidDefeatReward.sha256,
  '7b77330efb6be5f2d6de103d7a2b6572fa2ca3a5267290f0558cfad376c3305d');
assert.deepEqual(master.unionRaidDefeatCountRewardGroupByInformation,{413000001:418000001});
assert.deepEqual(master.unionRaidDefeatCountRewardGroups,[{id:418000001}]);
assert.equal(master.sources.unionRaidDefeatCountRewardGroup.rows,1);
assert.equal(master.sources.unionRaidDefeatCountRewardGroup.sha256,
  '88ed7762f255bbb6fdbc788d89de280ac5059111b842b058fce122d4d0bcbf9e');
assert.equal(master.sources.unionRaidDefeatCountReward.rows,44);
assert.equal(master.sources.unionRaidDefeatCountReward.sha256,
  '5b2acb1aa110954dfa7d796cb3023351b278f8907bf65e18932628879655e627');
assert.equal(master.unionRaidDefeatCountRewards.length,44);
assert.deepEqual(master.unionRaidDefeatCountRewards[0],
  {id:417000001,groupId:418000001,defeatCount:1,itemId:205000002,amount:50000});
assert.deepEqual(master.unionRaidDefeatCountRewards.at(-1),
  {id:417000044,groupId:418000001,defeatCount:21,itemId:215000005,amount:1});
assert.deepEqual(master.unionRaidLogGroups,[{id:432000001}]);
assert.equal(master.unionRaidLogs.length,28);
assert.deepEqual(master.unionRaidLogs[0],{id:433000001,type:1,score:500000,
  message:'Total Score\nOver {0}!',key:'',groupId:432000001});
assert.deepEqual(master.unionRaidLogs[7],{id:433000008,type:2,score:150000,
  message:'{1}\nTotal Score\nOver {0}!',key:'',groupId:432000001});
assert.deepEqual(master.unionRaidLogs.at(-1),{id:433000028,type:4,score:3000000,
  message:'{1}\nTotal Score\nOver {0}!',key:'',groupId:432000001});
assert.equal(master.sources.unionRaidLogGroup.rows,1);
assert.equal(master.sources.unionRaidLogGroup.sha256,'cd7624ad2042def5654e3b0b17b0e6a959152f8a21ef1842e01b06ffde7a0adf');
assert.equal(master.sources.unionRaidLog.rows,28);
assert.equal(master.sources.unionRaidLog.sha256,'09268903584c84eb8bfd46788a3806f59d1d22674f12039430c841c355c74491');
assert.equal(master.sources.unionRaidBossSpTicketItem.rows,1);
assert.equal(master.sources.unionRaidBossSpTicketItem.sha256,'29d708a0ce7527c47a1e15f1e3b77b18d4d4e290ce671b52b52da21be21d7595');
assert.equal(master.sources.unionRaidNormalSpTicketItem.rows,1);
assert.equal(master.sources.unionRaidNormalSpTicketItem.sha256,'7818a9a4d76838c4a8645ac6705c51ef150b431724a8c7a3655a514e91aed819');
assert.equal(master.items['union_raid_boss_sp_ticket_item.1'],411000001);
assert.equal(master.items['union_raid_normal_sp_ticket_item.1'],412000001);
assert.deepEqual(master.itemProfiles[411000001],{table:'UserUnionRaidBossSpTicketItem',idField:'ticketId'});
assert.deepEqual(master.itemProfiles[412000001],{table:'UserUnionRaidNormalSpTicketItem',idField:'ticketId'});
assert.equal(master.sources.unionRaidInformation.rows,1);
assert.equal(master.sources.unionRaidInformation.sha256,'bc45f1506ab31ac84bbcefcd75d7664c228d5dd8add1f2c76795a629fcde4c5f');
// WRITTEN ONLY: the generated file is refreshed only for the consolidated pass.
assert.equal(master.sources.adventureRaid.sha256,'62edc7604e0f27634cf62a9076a92e484567c0749beae3d1b82ba232315f45e8');
assert.equal(master.sources.adventureRaidGroup.sha256,'782a7bb9004e384ae7e4d0723cf1a2a1c6cf3460394834364daaed052a7342cb');
assert.equal(master.sources.adventureRaidPart.sha256,'295bf7d000c74543e716b0b29b7ba8d888e8c0c53b71089c813a08d29f91e1f0');
assert.equal(master.sources.adventureRaidPartStage.sha256,'84c2e61d0286825f15a358069a3b3b7282707c60c85389c72b73fe2644c18776');
assert.equal(Object.keys(master.adventureRaids).length,1);
assert.equal(Object.keys(master.adventureRaidGroups).length,5);
assert.equal(Object.keys(master.adventureRaidParts).length,7);
assert.equal(Object.keys(master.adventureRaidPartStages).length,45);
assert.deepEqual(master.adventureRaidParts[695000003],{groupId:694000002,order:2,hp:10000,slot4:1,slot5:5,slot6:43200,
  appearLwf:'',completeLwf:'behemoth/lwf_behemoth_body_part_destroyed/lwf_behemoth_body_part_destroyed.lwf'});
assert.deepEqual(master.adventureRaidPartStages[696000045],
  {partId:695000007,stageId:1170000101311,slot3:4,slot4:1,slot5:999999});
assert.equal(new Set(Object.values(master.adventureRaidPartStages).map(row=>`${row.partId}:${row.stageId}`)).size,45);
// WRITTEN ONLY / NOT RUN: original battle-drop catalogs, including the one
// authored negative rate, are retained before stage-result validation exists.
assert.equal(master.sources.dropItem.rows,29017);
assert.equal(master.sources.enemyParty.rows,35762);
assert.equal(master.sources.adventureEncounter.rows,36760);
assert.equal(Object.keys(master.battleDropPools).length,29017);
for(const slots of Object.values(master.battleDropPools)) {
  assert.equal(slots.length,3);
  assert(slots.reduce((sum,slot)=>sum+slot[2],0)<=10000);
}
assert.deepEqual(master.battleDropPools[285001001],[
  [master.items['status_board_item.power_small'],1,600],
  [master.items['status_board_item.armor_small'],1,600],
  [master.items['status_board_item.skill_small'],1,120]]);
assert.equal(master.battleDropPools[285024070][0][2],-630);
assert.deepEqual(master.battleDropPools[285011033],[
  [master.items['event_point.scenario_syougatu_first_4'],4,5000],
  [0,2,4185],[0,6,815]]);
assert.deepEqual(master.battleEnemyParties[331100100],[
  [331100101,285001001,285001001,0,0,0],
  [331100102,285001004,285001004,0,0,0]]);
assert.deepEqual(master.battleEncounters[1010000101101][0],[681000001,331100100]);
//WRITTEN ONLY / NOT RUN:27d52dc/27d57b0 native inventory keys, not gameplay acceptance.
for(const id of [30000001,30000002,30000003])
  assert.deepEqual(master.itemProfiles[id],{table:'UserEquipmentEnhanceItem',idField:'enhanceItemId'});
for(const id of [31000001,31000002,31000003,31000004,31000005])
  assert.deepEqual(master.itemProfiles[id],{table:'UserEquipmentEvolveItem',idField:'evolveItemId'});
assert.equal(master.sources.titleBadge.rows,802);
assert.equal(master.sources.titleBadge.path,'1/master/divide_enc/titleBadge.enc');
assert.equal(Object.keys(master.titleBadges).length,802);
assert.deepEqual(master.titleBadges[69600000001],{slot16:1,slot17:0,slot18:0,slot19:0});
assert.deepEqual(master.titleBadges[69610000001],{slot16:2,slot17:69000000001,slot18:1,slot19:1});
assert.deepEqual(master.titleBadges[69610000004],{slot16:2,slot17:69000000001,slot18:4,slot19:50});
assert(Object.keys(master.titleBadges).map(Number).every(id=>Number.isSafeInteger(id) && id>0x7fffffff));
assert.equal(master.sources.keyItem.rows,122);
assert.equal(master.sources.keyItem.sha256,'c161ee0c813f84bd63a2cf64616b482c667762642c8c10f130b02fcc8f06756a');
assert.equal(Object.keys(master.keyItems).length,122);
assert.equal(Object.values(master.keyItems).filter(row=>row.isExploit).length,82);
assert.deepEqual(master.keyItems[241000001],{isExploit:false});
assert.deepEqual(master.keyItems[241000010],{isExploit:true});
for(const [id,row] of Object.entries(master.keyItems)) {
  assert.equal(typeof row.isExploit,'boolean');
  assert.deepEqual(master.itemProfiles[id],{table:'UserKeyItem',idField:'keyItemId'});
}
assert.equal(Object.keys(master.characters).length, 164);
assert.equal(Object.keys(master.adventureProgression).length,543);
assert.equal(Object.keys(master.adventureKeys).length,543);
assert.equal(new Set(Object.values(master.adventureKeys)).size,543);
for (let part=1;part<=5;part++) assert.equal(master.adventureKeys[670100000+part],`adventure.main.part${part}`);
assert.deepEqual(master.adventureProgression[670200101],{type:2,label:'comm_character.bel1',episodeType:0});
assert.deepEqual(master.adventureProgression[670300101],{type:3,label:'comm_character.bel1',episodeType:0});
assert.deepEqual(master.adventureProgression[671600001],{type:16,label:'',episodeType:3});
assert.equal(master.sources.adventure.sha256,'19c1c2155371270fd4c7d3b23490509f76e93b9387146feed3acfa1003486da5');
assert.equal(master.sources.communicationCharacter.sha256,'32aafd6979a29160608942b3c88fad474d5d74bb6571a4223625de349f282d3c');
assert.deepEqual(master.characters[101000001].levels.find(([level]) => level === 2), [2,16]);
assert.deepEqual(master.characters[101000001].rewards.find(([id]) => id === 181001104), [181001104,15,1,1,294000019,0]);
assert.deepEqual(master.characters[101000001].rewards.find(([id]) => id === 182001041), [182001041,41,5,10,0,1]);
assert.equal(Object.keys(master.cpItems).length, 57);
assert.equal(master.cpItems[215000001], 100);
assert.equal(master.cpItems[215000007], 5);
assert.deepEqual(master.dpItems, { 219000001: 100 });
assert.equal(master.items['dp_item.1'], 219000001);
assert.equal(master.dpLevels.length, 30);
assert.deepEqual(master.dpLevels[1], { id: 761000002, level: 2, points: 50,
  rewardType: 1, rewardKey: 'currency.gem', amount: 2 });
assert.equal(master.dpLevels.at(-1).points, 5000);
assert.equal(master.dpLevels.reduce((sum, row) => sum + row.amount, 0), 58);
assert.deepEqual(master.shootingPcIds, [67300000001,67300000002,67300000003,67300000004]);
assert.deepEqual(master.shootingGames, {
  67000000001: { startAt: 1585666800, competitionEndAt: 1586411999, endAt: 1586411999 },
  67000000002: { startAt: 1617202800, competitionEndAt: 1617893999, endAt: 2145970799 },
});
assert.equal(master.sources.shootingGameDailyRankingReward.rows,10);
assert.equal(master.sources.shootingGameDailyRankingReward.sha256,'d653f687b8d4f57470494bf83b0a4d97702fc4f827b903eb1815ae222cf1c34f');
assert.deepEqual(master.shootingRewardMessage,{id:40610001,key:'shooting_daily_ranking_score_reward_txt',text:'AIS WARS Rank {} Reward'});
for(const [index,id] of Object.keys(master.shootingDailyRewards).entries()) {
  const later=index>=5,tier=index%5;
  assert.equal(Number(id),67400000001+index);
  assert.deepEqual(master.shootingDailyRewards[id],{infoId:67000000002,
    startAt:later?1617894000:1617202800,endAt:later?2145970799:1617893999,
    minRank:[1,2,3,4,51][tier],maxRank:[1,2,3,50,0][tier],
    itemId:later?[295000002,295000003,295000001,295000001,295000001][tier]:205000001,
    amount:later?[5,5,5,3,1][tier]:[100,50,30,20,10][tier]});
}
assert.deepEqual(master.characters[101000002].favoriteItems, [[215000001,2], [215000008,2]]);
assert.ok(master.characters[101000078].favoriteItems.some(([id, factor]) => id === 215000010 && factor === 100));
assert.equal(master.consumes[81041001].amount, 10);
assert.equal(master.consumes[81071001].recovery,1);
for(const [id,ticket] of Object.entries(master.serialPvp.serialPvpSpTicketItem)) {
  assert.deepEqual(master.itemProfiles[id],{table:'UserSerialPvpSpTicketItem',idField:'ticketId'});
  assert.equal(master.items[ticket.slot1],Number(id));assert.equal(ticket.slot10,1);
}
assert.equal(master.currencies['currency.gem'], 205000001);
assert.equal(master.sources.elementEventInformation.rows, 208);
assert.equal(master.sources.elementEventStage.rows, 417);
assert.equal(master.sources.elementEventStageDifficulty.rows, 1382);
assert.equal(master.sources.elementEventDefeatTurnBonus.rows, 16);
assert.equal(master.sources.elementEventActionCountBonus.rows, 0);
// Original extraction is not native gameplay proof.
assert.equal(Object.keys(master.sources).length, 168);
assert.equal(master.sources.guildRaidDefeatReward.rows,19);
assert.equal(Object.keys(master.guildRaidDefeatRewards).length,19);
assert.deepEqual(master.guildRaidDefeatRewards[58500000001],{items:[
  {itemId:294000003,amount:5},{itemId:294000006,amount:5}]});
assert.deepEqual(master.guildRaidDefeatRewards[58500000003],{items:[
  {itemId:32000001,amount:20},{itemId:294000015,amount:5}]});
//WRITTEN ONLY / NOT RUN: original slot13 links, not defeat eligibility or claims.
assert.equal(Object.keys(master.guildRaidStageDefeatRewards).length,957);
assert.equal(new Set(Object.values(master.guildRaidStageDefeatRewards)).size,19);
assert.equal(master.guildRaidStageDefeatRewards[58300000001],58500000001);
assert.equal(master.guildRaidStageDefeatRewards[58300000003],58500000003);
//WRITTEN ONLY / NOT RUN: original slots4/5/6, not native attempt/save acceptance.
assert.equal(Object.keys(master.guildRaidAttemptRules).length,43);
//WRITTEN ONLY / NOT RUN: separately extracted ordinary-SP recovery catalogs.
assert.equal(Object.keys(master.guildRaidStaminaMultipliers).length,43);
for(const [eventId,multiplier] of Object.entries(master.guildRaidStaminaMultipliers)) {
  assert.ok(master.guildRaidEvents[eventId]);assert.equal(multiplier,2);
  assert.equal(Object.hasOwn(master.guildRaidEvents[eventId],'multiplier'),false);
}
assert.equal(Object.keys(master.stageRaidStamina).length,21524);
assert.equal(Object.values(master.stageRaidStamina).filter(row=>row.enabled).length,20583);
assert.deepEqual(master.stageRaidStamina[1010000101101],{stamina:1,enabled:true});
assert.deepEqual(master.stageRaidStamina[1010000101103],{stamina:0,enabled:true});
for(const [stageId,row] of Object.entries(master.stageRaidStamina)) {
  assert.ok(master.stages[stageId]);assert.ok(Number.isSafeInteger(row.stamina) && row.stamina>=0);
  assert.equal(typeof row.enabled,'boolean');
  assert.equal(Object.hasOwn(master.stages[stageId],'stamina'),false);
}
for(const [eventId,rules] of Object.entries(master.guildRaidAttemptRules)) {
  assert.ok(master.guildRaidEvents[eventId]);
  assert.deepEqual(rules,{dailySP:2,normalSPRecoveryLimit:2,normalSPCost:100});
  assert.equal(Object.hasOwn(master.guildRaidEvents[eventId],'dailySP'),false,
    'New attempt rules must not change previously captured event-catalog hashes');
}
for(const [stageId,rewardId] of Object.entries(master.guildRaidStageDefeatRewards)) {
  assert.ok(master.guildRaidStages[stageId]);assert.ok(master.guildRaidDefeatRewards[rewardId]);
  assert.equal(Object.hasOwn(master.guildRaidStages[stageId],'defeatRewardId'),false,
    'New reward links must not change previously captured stage-catalog hashes');
}
assert.equal(Object.keys(master.gveEvents).length,23);
assert.deepEqual(Object.entries(master.gveEvents).filter(([,row])=>row.type===19)
  .sort((a,b)=>Number(a[0])-Number(b[0])).map(([,row])=>[row.weekday,row.slot7,row.slot8,row.slot9]),
  [1,2,3,4,5,6,7].map(weekday=>[weekday,5,23,5]));
// WRITTEN ONLY / NOT RUN: GvEUtils open and display read separate adventure windows.
assert.ok(Object.values(master.gveEvents).every(row=>
  [row.window6,row.window7,row.window8,row.window9].every(Number.isSafeInteger) &&
  row.window6>0 && row.window8>0 && (!row.window7 || row.window7>row.window6) &&
  (!row.window9 || row.window9>row.window8)));
assert.ok(Object.values(master.gveEvents).filter(row=>row.type===19).every(row=>
  row.window6===1523498400 && row.window7===0 && row.window8===row.window6 && row.window9===0));
assert.ok(Object.values(master.gveEvents).filter(row=>row.type===20).every(row=>row.weekday===0));
assert.equal(Object.keys(master.gveStages).length,179);
assert.equal(master.gveTurnBonuses.length,21);
assert.equal(master.gveActionBonuses.length,150);
assert.equal(Object.values(master.gveStages).filter(row=>master.gveEvents[row.gveId].type===20).length,144);
assert.equal(Object.values(master.gveStages).filter(row=>row.slot9===0).length,90);
assert.equal(Object.values(master.gveStages).filter(row=>row.slot9===100001).length,89);
const gveActionCurve=master.gveActionBonuses.filter(row=>row.selector===100001);
assert.equal(gveActionCurve.length,150);assert.equal(new Set(gveActionCurve.map(row=>row.actionThreshold)).size,75);
for(const threshold of new Set(gveActionCurve.map(row=>row.actionThreshold)))
  assert.equal(new Set(gveActionCurve.filter(row=>row.actionThreshold===threshold).map(row=>row.value)).size,1);
for(const row of Object.values(master.gveStages)) {
  assert.equal(master.stages[row.adventureStageId].adventureType,master.gveEvents[row.gveId].type);
  assert.ok(Number.isFinite(row.slot5) && Number.isFinite(row.slot8));
}
assert.equal(master.sources.pcGuest.sha256,'b78b69bbe560772ba0e2e59709a1d46431b1d8b99aaf9a4c89a224ded54ecf9f');
assert.equal(master.sources.pcGuestLevelStep.sha256,'bc538dee0ef2028ad15a1982dc289973738b67e069afa68e82009384f15aaa26');
assert.ok(Array.isArray(master.pcGuests));assert.ok(Array.isArray(master.pcGuestLevelSteps));
assert.equal(master.sources.pcGuest.rows,master.pcGuests.length);
assert.equal(master.sources.pcGuestLevelStep.rows,master.pcGuestLevelSteps.length);
assert.equal(new Set(master.pcGuests.map(row=>row.id)).size,master.pcGuests.length);
assert.ok(master.pcGuests.every(row=>Number.isInteger(row.id) && row.id>0 && master.pcProfiles[row.pcId] &&
  Number.isSafeInteger(row.startAt) && Number.isSafeInteger(row.endAt)));
assert.ok(master.pcGuestLevelSteps.every(row=>Number.isInteger(row.guestId) && row.guestId>0 &&
  Number.isInteger(row.level) && row.level>=0 && Number.isInteger(row.totalExp) && row.totalExp>=0 && Number.isInteger(row.marker)));
assert.equal(master.pvpInformationIds.length,176);
assert.equal(master.pvpGradeIds.length,3420);
assert.equal(new Set(master.pvpInformationIds).size,176);
assert.equal(new Set(master.pvpGradeIds).size,3420);
assert.equal(master.pvpInformationIds[0],10000000001);
assert.equal(master.pvpGradeIds[0],13000010000);
assert.equal(master.sources.pvpInformation.sha256,'6858af02c06d0c392989d202300fe50757acb73fbc831a87e4d2177ac038d9a9');
assert.equal(master.sources.pvpGrade.sha256,'1ef1ebfeab12a2ba7a0a1cebbcbbc4f351ff7b90e6dca96f171c010ea3ad57e7');
assert.deepEqual(Object.keys(master.pvp.information).map(Number),master.pvpInformationIds);
assert.deepEqual(Object.keys(master.pvp.grades).map(Number),master.pvpGradeIds);
assert.deepEqual(master.pvp.information[10000000001],{slot1:1504144800,startAt:1504144800,endAt:1505440799});
assert.deepEqual(master.pvp.information[10000000030],{slot1:1914372000,startAt:1914372000,endAt:1914372000},
  'An original disabled zero-length window must not be extended or repaired');
assert.deepEqual(master.pvp.grades[13000010000],{groupId:10000000001,key:'pvp_grade_010000',
  name:'Little Rookie III',minRank:0,maxRank:0,scoreBorder:1000,art:'rank_blk_1_3',order:0});
assert.deepEqual([13001380000,13001380001,13001380002,13001380018,13001380019,13001380020]
  .map(id=>[master.pvp.grades[id].scoreBorder,master.pvp.grades[id].minRank,master.pvp.grades[id].maxRank]),
  [[1000,0,0],[1060,0,0],[1120,0,0],[3600,0,0],[3600,2,50],[3600,1,1]]);
assert.equal(Object.values(master.pvp.grades).filter(row=>row.minRank||row.maxRank).length,352);
assert.equal(new Set(Object.values(master.pvp.grades).map(row=>row.groupId)).size,176);
for(const row of Object.values(master.pvp.grades)) assert.ok(master.pvp.information[row.groupId]);
for(const id of master.pvpInformationIds) assert.ok(Object.values(master.pvp.grades).some(row=>row.groupId===id));
assert.equal(master.sources.achievement.sha256,'7e2d49c44ba84ce9f95e5d2976c8d81ed7850ddbf1a22dfc421a5f4b7e7b8314');
assert.equal(Object.keys(master.warGameAchievements).length,1733);
assert.deepEqual(master.warGameAchievements[6030033995],{pvpId:10000000138,gradeId:13001380001,requiredParam:1,resetType:0});
assert.deepEqual(master.achievements[6030033995],{category:3,startAt:1660183200,expireAt:1660748399,
  rewardType:3,rewardKey:'currency.gem',rewardAmount:10});
for(const [id,row] of Object.entries(master.warGameAchievements)) {
  assert.equal(master.pvp.grades[row.gradeId].groupId,row.pvpId);
  assert.equal(row.requiredParam,1);assert.equal(row.resetType,0);
  assert.equal(master.achievements[id].category,3);
  assert.ok(master.achievements[id].startAt>0 && master.achievements[id].expireAt>=master.achievements[id].startAt);
}
assert.deepEqual([...new Set(Object.keys(master.warGameAchievements).map(id=>master.achievements[id].rewardType))].sort((a,b)=>a-b),
  [1,3,4,6,9,11,13,24,25,27,28]);
assert.equal(master.sources.pvpRankingGradeReward.sha256,'b7a1f9bd0d737fb51de11f0131b3deb43154bb4a66dc2528d09d25fed9064130');
assert.equal(Object.keys(master.warGameSeasonRewards).length,3420);
assert.deepEqual(master.warGameSeasonRewards[13001380000],{pvpId:10000000138,rewards:[{itemId:205000001,amount:25}]});
assert.deepEqual(master.warGameSeasonRewards[13001380018],{pvpId:10000000138,
  rewards:[{itemId:205000001,amount:750},{itemId:99000001,amount:8}]});
for(const [gradeId,row] of Object.entries(master.warGameSeasonRewards)) {
  assert.equal(master.pvp.grades[gradeId].groupId,row.pvpId);
  assert.ok(row.rewards.length>0 && row.rewards.length<=2);
  for(const item of row.rewards) assert.ok(master.itemProfiles[item.itemId] && Number.isInteger(item.amount) && item.amount>0);
}
assert.equal(Object.keys(master.stageKeys).length,21524);
assert.equal(master.stageKeys[1010000102110],'adventure_stage.stage_014');
assert.equal(Object.values(master.stageKeys).filter(key=>!key).length,13894);
assert.equal(master.featureUnlocks.length,22);
assert.equal(master.sources.featureLock.rows,22);
assert.equal(master.sources.featureLock.sha256,'3dd7567133ab72e9622ec6a8ac8649dd45f4c400fce7e492a3836befb31c9c22');
assert.ok(master.featureUnlocks.some(row=>row.stageKey==='adventure_stage.stage_138' &&
  row.flagKey==='system_flag.feature.story_ais_quest'));
for (const row of master.featureUnlocks) {
  assert.equal(Object.values(master.stageKeys).filter(key=>key===row.stageKey).length,1);
  assert.equal(Object.values(master.systemFlags).filter(flag=>flag.key===row.flagKey).length,1);
}
assert.equal(master.sources.systemFlag.rows,64);
assert.equal(master.sources.systemFlag.sha256,'a9d9ec10a45a97bbaaf0869bbbded370e48f837ee50533fd9205873323583cee');
assert.deepEqual(master.systemFlags[91218027],{key:'system_flag.feature.serial_pvp',
  defaultValue:0,minimum:0,maximum:2,readonly:false});
assert.equal(Object.values(master.systemFlags).filter(row=>row.readonly).length,3);
assert.equal(master.systemFlags[91960005].readonly,true);
assert.deepEqual(master.serialPvp.serialPvpEntryCondition[81800000001],{slot1:1010000105111,slot2:1800,
  slot3:'[c=red]Earn over 1800 Score in War Game Training[/c]'});
for(const [name,count] of Object.entries({serialPvpInformation:50,serialPvpGrade:5,serialPvpRule:1,
  serialPvpEntryCondition:1,serialPvpMatchingCondition:10,serialPvpRankBadge:4,serialPvpRankingRewardGroup:8,
  serialPvpRankingRewardItem:16,serialPvpSpTicketItem:50,serialPvpScoreCalculation:1,serialPvpScoreBonus:50,
  serialPvpScoreBonusFamilia:34,serialPvpScoreTurnBonus:15,serialPvpScoreFinalTurnBonus:4,serialPvpScoreMission:42})) {
  assert.equal(master.sources[name].rows,count);assert.equal(Object.keys(master.serialPvp[name]).length,count);
}
assert.equal(master.sources.serialPvpInformation.sha256,'2590a39dd8a0a4679a9bda0ca09efa228ad65230615d764789d25885b70f67ca');
assert.equal(master.sources.serialPvpGrade.sha256,'a6931ebfb74520a9627af45c0068a95b3eda54ee33230bcac001acc0c2e2b423');
assert.equal(master.sources.message.sha256,'a5814e507ed34a86886336f396d99a14e3bc47173891a492ce39d9dfe72760a5');
assert.ok(master.serialPvpMessages[40650029].text.includes('win all 5 battles'));
assert.ok(master.serialPvpMessages[40650069].text.includes('5 wins in a row, or after losing once'));
assert.ok(master.serialPvpMessages[40650036].text.includes('5'));
assert.ok(master.serialPvpMessages[40650071].text.includes('3'));
assert.ok(master.serialPvpMessages[40650178].text.includes('not be reflected'));
assert.equal(master.serialPvpMessages[40650080].text,'Ready in {}');
assert.equal(master.serialPvpMessages[40650081].text,'Played');
assert.deepEqual(Object.values(master.serialPvp.serialPvpGrade).map(row=>row.slot4),
  ['Braver','Battle Princess','King','Jester','Hero']);
assert.deepEqual(Object.values(master.serialPvp.serialPvpGrade).map(row=>row.slot7),
  [1,1.600000023841858,2.5,3.799999952316284,5.800000190734863]);
assert.equal(master.serialPvp.serialPvpScoreCalculation[81600000001].slot1,10);
assert.equal(master.serialPvp.serialPvpScoreCalculation[81600000001].slot4,0.009999999776482582);
assert.equal(Object.values(master.serialPvp.serialPvpInformation).filter(row=>row.slot3===row.slot4).length,22,
  'Original disabled matching windows must not become fabricated open seasons');
assert.equal(Object.values(master.serialPvp.serialPvpInformation).filter(row=>row.slot5===row.slot6).length,14);
for(const [id,row] of Object.entries(master.serialPvp.serialPvpInformation)) {
  assert.ok(row.slot3<=row.slot4 && row.slot5<=row.slot6);
  assert.ok(master.serialPvp.serialPvpRule[row.slot9]);
  assert.ok(master.serialPvp.serialPvpScoreCalculation[row.slot12]);
  assert.ok(master.serialPvp.serialPvpScoreBonus[row.slot13]);
  assert.ok(master.serialPvp.serialPvpSpTicketItem[row.slot18]);
  assert.ok(!row.slot16 || master.serialPvp.serialPvpInformation[row.slot16]);
  assert.match(row.slot1,/^serial_pvp_infomation_/,'Retain original table-key spelling');
  assert.ok(Number(id)>81000000000);
}
for (const [name,count] of Object.entries({ underPvpInformation:54,underPvpGrade:21,underPvpRule:1,
  underPvpTutorialDummyPartyGroup:50,underPvpMatchingCondition:252,underPvpRankingGradeReward:0,
  underPvpGroupRankingReward:9,underPvpRankBadge:4,underPvpStaminaTicket:54,underPvpRevengeTicket:50,
  dummyUnderPvpUserProfile:200,dummyUnderPvpPc:1034,dummyUnderPvpPartySlot:810,dummyUnderPvpParty:312 })) {
  assert.equal(master.sources[name].rows,count);
  assert.equal(Object.keys(master.underPvp[name]).length,count);
}
assert.equal(master.sources.underPvpInformation.sha256,'06bfca160a799cba4288838afbd548553bead6f91ece6956f649a9c6f4ebb475');
assert.equal(master.sources.dummyUnderPvpPc.sha256,'076bf5bfaca0e44e0ab043a9a21ceff9889bd81060d3fd1c804dc28348f581ba');
assert.equal(master.sources.dummyUnderPvpParty.sha256,'daef8f6a6b6b5704d1631c5a9e56b931eea08767ad225879a0515cecc8ab9f7c');
assert.equal(Object.values(master.underPvp.underPvpTutorialDummyPartyGroup).filter(row=>
  row.slot2!==master.underPvp.dummyUnderPvpParty[row.slot4].slot2).length,37,
'Original tutorial matching grades are not forced to equal their opponents grades');
assert.deepEqual(Object.keys(master.underPvp.underPvpRule[69100000001]),Array.from({ length:8 },(_,i)=>`slot${i+1}`));
assert.equal(master.sources.scratch.rows, 7);
assert.equal(master.sources.scratchStep.rows, 27);
assert.equal(master.sources.scratchContent.rows, 160);
assert.equal(Object.keys(master.scratches).length, 7);
assert.equal(Object.values(master.scratches).flatMap(row => row.steps).length, 27);
assert.equal(Object.values(master.scratches).flatMap(row => row.steps.flatMap(step => step.contents)).length, 160);
for (const scratch of Object.values(master.scratches)) {
  assert.ok(scratch.steps.every((step,i) => step.index === i+1));
  assert.ok(scratch.steps.every(step => step.contents.length && step.contents.every(prize =>
    master.items[prize.rewardKey] === prize.itemId && prize.amount > 0 && [0,1].includes(prize.special))));
}
for (const links of Object.values(master.lotteryScratches))
  assert.ok(links.every(link => master.scratches[link.scratchId]));
assert.equal(master.sources.adScratch.rows, 1);
assert.deepEqual(master.advertisementIrisReward,{itemId:205000001,amount:10,messageId:40320028,
  messageKey:'home_shop_modal_shop_purchase_all_list_27',messageText:'Watch videos to earn 10 Iris.'});
assert.equal(master.sources.adScratchStep.rows, 1);
assert.equal(master.sources.adScratchContent.rows, 6);
assert.equal(master.sources.adScratch.sha256, 'c58ac240c26da2a35dc0ae47e36c27c47ddaabe84ce870a42a47b4fe9d30bac0');
assert.equal(master.sources.adScratchStep.sha256, '6007a352c49db599920d89bd496365a08c2c73a01b9268048ea474c0e7cab986');
assert.equal(master.sources.adScratchContent.sha256, '85582da13a9647109a0080310aa54571eb823a1bddbeccedf4a48a53a3fc114b');
assert.deepEqual(Object.keys(master.adScratches), ['614000001']);
assert.equal(master.adScratches[614000001].startAt, 1603638000);
assert.equal(master.adScratches[614000001].endAt, 0);
assert.equal(master.adScratches[614000001].slot3, 1); // meaning not recovered
assert.deepEqual(master.adScratches[614000001].steps.map(row => [row.id,row.index]), [[615000001,1]]);
assert.deepEqual(master.adScratches[614000001].steps[0].contents.map(row =>
  [row.id,row.rewardType,row.rewardKey,row.itemId,row.amount,row.special]), [
  [616000001,4,'stamina_ticket.jagamarukun',295000001,1,0],
  [616000002,2,'status_board_item.special',294000019,1,0],
  [616000003,11,'cp_item.food1',215000001,1,0],
  [616000004,11,'cp_item.book1',215000003,1,0],
  [616000005,11,'cp_item.flower1',215000005,1,0],
  [616000006,16,'currency.gem',205000001,10,1],
]);
assert.equal(master.sources.characterCostume.rows, 394);
assert.equal(master.sources.communicationVoice.rows, 3354);
assert.equal(Object.keys(master.characterCostumes).length, 394);
assert.equal(Object.keys(master.communicationVoices).length, 3354);
assert.deepEqual(master.characterCostumes[1021002030], { characterKey: 'character.ais',
  name: 'Order Made Anniversary Dress', description: "Ais's Anniversary Dress",initialUnlock:false,priority:0 });
assert.deepEqual([1021001000,1021001002,1021001005].map(id=>
  [id,master.characterCostumes[id].initialUnlock,master.characterCostumes[id].priority]),
[[1021001000,true,1],[1021001002,true,0],[1021001005,false,0]]);
assert.deepEqual(Object.entries(master.communicationVoices).filter(([,row]) => row.costumeId === 1021002030)
  .map(([id]) => Number(id)), [140003391,140003392,140003393,140003394,140003395,140003396]);
assert.equal(Object.values(master.communicationVoices).filter(row => row.costumeId).length, 42);
for (const voice of Object.values(master.communicationVoices)) {
  assert.ok(Object.values(master.communicationCharacters).some(row => row.key === voice.communicationCharacterKey));
  assert.ok([0,1,2].includes(voice.kind) && [0,1,2].includes(voice.userHeroType));
  assert.ok(Number.isSafeInteger(voice.friendshipLevel) && voice.friendshipLevel>=0);
  if (voice.costumeId) assert.ok(master.characterCostumes[voice.costumeId]);
}
assert.deepEqual(master.communicationVoices[140000001],{communicationCharacterKey:'comm_character.bel1',name:'Daily Talk 1',
  friendshipLevel:1,voiceKey:'voice.co_talk_bel_01',kind:0,userHeroType:0,costumeId:0});
assert.equal(master.sources.equipment.rows, 332);
assert.equal(master.sources.giftParameterizedEquipment.rows, 67);
assert.equal(Object.keys(master.equipments).length, 332);
assert.equal(Object.keys(master.equipmentGiftPresets).length, 67);
assert.equal(master.sources.equipmentAbility.rows,1720);
assert.equal(master.sources.equipmentEvolveAbilityContent.rows,36);
assert.equal(master.sources.equipmentAbility.sha256,'0174d16a2bb342d0e22d76e8a29659ac76a7506b0897eee671abf55ea3f66473');
assert.equal(master.sources.equipmentEvolveAbilityContent.sha256,'55ea3447ece126744e7e2efba7e36d0844c5078c27096f7df2ae53f3af949251');
assert.equal(master.sources.equipmentEvolve.rows,1664);
assert.equal(master.sources.equipmentEvolve.sha256,'0e2b19c9e6d7d3a1d9343300979394639f7c9c321f5652291924f9bf8ef5225d');
assert.equal(master.equipmentEvolutions.length,1664);
assert.deepEqual(master.equipmentEvolutions.find(row=>row.id===32000000023),
  {id:32000000023,equipmentId:24000006201,rarity:5,abilityGroupId:33000000001});
assert.ok(master.equipmentEvolutions.every(row=>master.equipments[row.equipmentId] &&
  (!row.abilityGroupId || master.equipmentEvolveAbilities.some(a=>a.groupId===row.abilityGroupId))));
assert.equal(master.sources.equipmentAbilityValuePcRarity.rows,68);
assert.equal(master.sources.equipmentAbilityValuePcRarity.sha256,'b4a6566ec83ef0298dfdfdc1125baaa63c9436ea42ae21dbf3411ae3bf084025');
assert.equal(master.equipmentAbilityPcRaritySteps.length,68);
assert.deepEqual(master.equipmentAbilityPcRaritySteps[2],{id:37000000003,groupId:1,jobRank:3,
  limitbreakCount:0,level:30,heroSublimateLevel:0,mode:1,mask:2,amount:3});
assert.deepEqual(Object.entries(master.equipmentAbilities).filter(([,row])=>row.type===1024).map(([id,row])=>[Number(id),row.kind,row.amount]),[
  [21000034001,1,500],[21000034002,1,1500],[21000035001,2,500],[21000035002,2,1500],
  [21000099001,1,12345],[21000099002,2,23456],[21000099003,4,34567],[21000099004,8,45],
]);
assert.ok(master.equipmentEvolveAbilities.every(row=>master.equipmentAbilities[row.abilityId]?.type!==1024));
assert.equal(master.playerLevels.length,999);
assert.equal(Object.keys(master.stageExperience).length,Object.keys(master.stages).length);
assert.equal(master.stageExperience[1010000101101],96);
assert.equal(master.stageExperience[1010000101103],0);
assert.ok(Object.values(master.stageExperience).every(value=>Number.isSafeInteger(value) && value>=0 && value<=0x7fffffff));
// WRITTEN ONLY / NOT RUN: these special-party modes have no authored player-XP grant.
for(const [id,stage] of Object.entries(master.stages))
  if([12,15,19,20,22,26,27,28].includes(stage.adventureType)) assert.equal(master.stageExperience[id],0);
assert.equal(Object.keys(master.stageProgression).length,Object.keys(master.stages).length);
assert.deepEqual(master.stageProgression[1010000101102],{episodeId:7010000101,index:2,level:1,unlockCondition:0});
assert.deepEqual(master.stageProgression[1010000101204],{episodeId:7010000101,index:4,level:2,unlockCondition:1});
assert.equal(new Set(Object.values(master.stageProgression).map(row=>`${row.episodeId}:${row.level}:${row.index}`)).size,
  Object.keys(master.stageProgression).length,'Native successor keys must be unambiguous');
assert.equal(Object.keys(master.episodeProgression).length,1230);
assert.equal(master.sources.adventureEpisode.sha256,'42cca66b410dc6fa1b2061982b772965ab7d08cfbceb6baa337564fbe349a486');
assert.deepEqual(master.episodeProgression[7010000101],{adventureId:670100001,index:1});
assert.deepEqual(master.episodeProgression[7010000104],{adventureId:670100001,index:4});
const storyEpisodeIds = [...new Set(Object.keys(master.stageProgression).filter(id=>master.stages[id].adventureType===1)
  .map(id=>master.stageProgression[id].episodeId))];
assert.equal(storyEpisodeIds.length,141);
assert.equal(new Set(storyEpisodeIds.map(id=>{
  const row = master.episodeProgression[id];assert.ok(row);return `${row.adventureId}:${row.index}`;
})).size,storyEpisodeIds.length,'Only main-story episode keys have a recovered unique-index contract');
assert.ok(new Set(Object.values(master.episodeProgression).map(row=>`${row.adventureId}:${row.index}`)).size<1230,
  'Special-mode repeated episode indices must not be mistaken for a global unique graph');
assert.equal(Object.keys(master.stageUnlocks).length,21524);
assert.deepEqual(master.stageUnlocks[1160000101202],{value:0,targetId:1160000101102});
assert.deepEqual(master.stageUnlocks[1160000301101],{value:0,targetId:1160000201125});
assert.deepEqual(master.stageUnlocks[1170000101211],{value:0,targetId:1170000101110});
for(const [mode,count] of [[16,2052],[17,33]]) {
  const ids=Object.keys(master.stageProgression).filter(id=>master.stages[id].adventureType===mode);
  assert.equal(ids.length,count);
  for(const id of ids) {
    assert.ok([0,9].includes(master.stageProgression[id].unlockCondition));
    if(master.stageProgression[id].unlockCondition===9)
      assert.equal(master.stages[master.stageUnlocks[id].targetId]?.adventureType,mode);
    assert.equal(master.episodeProgression[master.stageProgression[id].episodeId].index,1,
      'These modes have no next/previous episode by index; cross-episode slot38 is a separate native refresh provider');
  }
}
assert.deepEqual(master.playerLevels.at(-1),[999,41775382011]);
assert.deepEqual(master.equipments[24000001001], { key: 'equipment_001001', name: 'Long Sword',
  kind:1,rarity: 1, durability: 0, performance: 4, abilityId1: 0, abilityId2: 0, abilityId3: 0, abilityId4: 0, abilityId5: 0, type: 1 });
assert.deepEqual(master.equipmentGiftPresets[775000001], { key: 'gift_param_equip.test_1', equipmentId: 24000001217,
  evolveCount: 2, abilityId1: 21000000001, abilityId2: 21000000002, abilityId3: 21000000003, abilityId4: 21000000004, abilityId5: 21000000005 });
for (const preset of Object.values(master.equipmentGiftPresets)) {
  assert.ok(master.equipments[preset.equipmentId]);
  assert.ok(Number.isSafeInteger(preset.evolveCount) && preset.evolveCount >= 0 && preset.evolveCount <= 8);
}
assert.equal(master.sources.takarakujiInfo.rows, 11);
assert.equal(master.sources.takarakujiItem.rows, 11);
assert.equal(Object.keys(master.takarakujiInfos).length, 11);
assert.equal(Object.keys(master.takarakujiItems).length, 11);
assert.deepEqual(master.takarakujiInfos[56000000001], { name: 'Lotto Orario',
  startAt: 1526522400, endAt: 1529301599, itemId: 218000001 });
assert.deepEqual(master.takarakujiInfos[56000000011], { name: 'Lotto Orario',
  startAt: 1686794400, endAt: 1690901999, itemId: 218000011 });
for (let index = 1; index <= 11; index++) {
  const id = 218000000 + index, key = `takarakuji_item.takarakuji${index}`;
  assert.equal(master.takarakujiItemIds[key], id);
  assert.equal(master.takarakujiInfos[56000000000 + index].itemId, id);
  assert.equal(master.takarakujiItems[id].key, key);
  assert.equal(master.takarakujiItems[id].name, 'Lotto Orario: Lottery Tickets');
  assert.equal(master.takarakujiItems[id].description, 'A ticket to draw Lotto Orario.');
  assert.equal(master.items[key], undefined, 'Raffle entitlements must not become an invented ordinary inventory');
  assert.equal(master.itemProfiles[id], undefined);
}
const raffleMissions = Object.values(master.achievements).filter(row => row.rewardType === 18);
assert.equal(raffleMissions.length, 23);
assert.deepEqual([...new Set(raffleMissions.map(row => row.rewardAmount))].sort((a,b) => a-b), [1,3,4,5,6,7]);
assert.ok(raffleMissions.every(row => master.takarakujiItemIds[row.rewardKey] && row.rewardAmount > 0));
assert.equal(master.sources.communicationCharacter.rows, 26);
assert.equal(Object.keys(master.communicationCharacters).length, 26);
assert.deepEqual(master.communicationCharacters[100000005], { key: 'comm_character.hes1', characterId: 101000027 });
for (const row of Object.values(master.communicationCharacters)) assert.ok(master.characters[row.characterId]);
assert.equal(master.sources.pvbInformation.rows, 152);
assert.equal(master.sources.pvbStage.rows, 942);
assert.equal(master.sources.pvbSurvivalBonusTable.rows, 8);
assert.equal(master.sources.pvbGrade.rows, 1976);
assert.equal(master.sources.pvbGroupRankingReward.rows,1064);
assert.equal(master.sources.pvbTotalRankingReward.rows,1820);
assert.equal(master.sources.pvbGroupRankingReward.sha256,'bf7f49499265f219409aa096676365f073533ca40a49597b8da870717b46dc51');
assert.equal(master.sources.pvbTotalRankingReward.sha256,'04bbd19a77ea896e37b416525dc9d1d29702408a8d8075f43704f6089f23f810');
for(const [kind,count] of [['group',1064],['total',1820]]) {
  assert.equal(Object.keys(master.pvbRankingRewards[kind]).length,152);
  const rows=Object.values(master.pvbRankingRewards[kind]).flat();assert.equal(rows.length,count);
  for(const row of rows) {
    assert.ok(row.minRank>=1 && (!row.maxRank || row.maxRank>=row.minRank));
    assert.ok(row.rewards.length>0 && row.rewards.length<=5);
    for(const item of row.rewards) assert.ok(master.itemProfiles[item.itemId] && Number.isInteger(item.amount) && item.amount>0);
  }
}
assert.deepEqual(master.pvbRankingRewards.group[55000000001][0],{minRank:1,maxRank:1,
  rewards:[{itemId:294000019,amount:5},{itemId:289990016,amount:75},{itemId:215000001,amount:50},
    {itemId:215000003,amount:50},{itemId:215000005,amount:50}]});
assert.equal(Object.keys(master.pvbGrades).length, 1976);
assert.deepEqual(master.pvbGrades[55200000001], { key: 'pvb_grade_1.1', pvbId: 55000000001,
  slot3: 1, slot4: 1, art: 'rank_01.png' });
for (const id of Object.keys(master.pvbEvents)) assert.equal(Object.values(master.pvbGrades)
  .filter(row => row.pvbId === Number(id) && row.slot3 <= 1 && (!row.slot4 || row.slot4 >= 1)).length, 1);
assert.equal(Object.keys(master.pvbEvents).length, 152);
assert.equal(Object.keys(master.pvbStages).length, 942);
assert.equal(Object.values(master.pvbAchievementRules).filter(row=>row.conditionType===1201).length,1377);
assert.equal(Object.values(master.pvbAchievementRules).filter(row=>row.conditionType===1202).length,2214);
assert.equal(Object.values(master.pvbAchievementRules).filter(row=>row.conditionType===1203).length,4);
assert.deepEqual(master.pvbAchievementRules[6030020854],{category:3,conditionType:1201,requiredParam:1,
  selector:'pvb_information_65',scoreThreshold:50000,startAt:1602122400,expireAt:1602687599,resetType:0});
assert.deepEqual(master.pvbAchievementRules[6030020869],{category:3,conditionType:1202,requiredParam:2500000,
  selector:'pvb_information_65',scoreThreshold:0,startAt:1602122400,expireAt:1602687599,resetType:0});
assert.deepEqual(master.pvbAchievementRules[6050000131],{category:5,conditionType:1203,requiredParam:1,
  selector:'',scoreThreshold:3000000,startAt:0,expireAt:0,resetType:0});
assert.deepEqual(master.pvbEvents[55000000001], { key: 'pvb_information_1', adventureId: 671500001,
  slot3: 100, name: 'Record Buster S1', art5: 'Ottal_red', art6: 'Ottal_red',
  window6: 1523498400, window7: 1524110399, window8: 1523498400, window9: 1524794399 });
assert.deepEqual(master.pvbStages[55100000001], { pvbId: 55000000001, adventureStageId: 1150000101101,
  difficulty: 1, slot4: 1, slot5: 1000, slot6: 1 });
assert.deepEqual(master.pvbSurvivalBonuses.map(row => [row.selector,row.value,row.slot3,row.slot4]),
  [[1,0,1,4], [1,1000,5,5], [1,3000,6,8], [1,4000,9,9], [1,6000,10,12], [1,7000,13,13], [1,9000,14,14], [1,10000,15,15]]);
assert.equal(new Set(Object.values(master.pvbStages).map(row => row.adventureStageId)).size, 942);
for (const row of Object.values(master.pvbStages)) {
  assert.ok(master.pvbEvents[row.pvbId]); assert.equal(master.stages[row.adventureStageId].adventureType, 15);
  assert.equal(master.stages[row.adventureStageId].rewardType, 0);
  assert.equal(master.stages[row.adventureStageId].rewardAmount, 0);
  assert.equal(row.slot6, 1); assert.ok([1000,5000,15000,30000,50000,75000,90000].includes(row.slot5));
}
assert.equal(master.elementEventInfoIds.length, 208);
assert.equal(new Set(master.elementEventInfoIds).size, 208);
assert.equal(Object.keys(master.elementEventDifficulties).length, 1382);
assert.deepEqual(master.elementEventDifficulties[66300000001], { infoId: 66000000001, adventureStageId: 1260000101101 });
for (const row of Object.values(master.elementEventDifficulties)) {
  assert.ok(master.elementEventInfoIds.includes(row.infoId));
  assert.ok([26,27].includes(master.stages[row.adventureStageId].adventureType));
}
assert.equal(new Set(Object.values(master.elementEventDifficulties).map(row => row.adventureStageId)).size, 1382);
assert.equal(Object.keys(master.elementEventStages).length, 417);
assert.equal(Object.keys(master.elementEventScoring).length, 1382);
assert.deepEqual(master.elementEventStages[66100000001], { infoId: 66000000001, index: 1, name: 'Wind Zone',
  rewardGroupId: 1, startAt: 1583978400, endAt: 1584197999, key: 'element_event_stage_1' });
assert.equal(master.sources.elementEventScoreRankingReward.rows,128);
assert.equal(master.sources.elementEventScoreRankingReward.sha256,'c86578de6b5d0533934984ebdaec8fc52319f53f1f156ec36ddb0f9e0a63739a');
assert.equal(master.sources.lockAbilityItem.rows,1);
assert.equal(master.sources.lockAbilityItem.sha256,'254401bcd6d50ab25476041697b6f67288f363b7c12bf027528d80d48066de95');
assert.deepEqual(master.itemProfiles[220000001],{table:'UserLockAbilityItem',idField:'lockAbilityId'});
assert.equal(master.items['lock_ability_item.1'],220000001);
assert.deepEqual(Object.keys(master.elementRankingRewards).map(Number),[1,2,3,4,5,6]);
assert.deepEqual(Object.values(master.elementRankingRewards).map(rows=>rows.length),[24,20,21,21,21,21]);
assert.deepEqual(master.elementRankingRewards[1][0],{minRank:1,maxRank:1,rewards:[
  {itemId:205000002,amount:1500000},{itemId:30000003,amount:100},{itemId:289991002,amount:50},
  {itemId:289991001,amount:50},{itemId:220000001,amount:1}]});
for(const stage of Object.values(master.elementEventStages)) assert(master.elementRankingRewards[stage.rewardGroupId]?.length);
for(const rows of Object.values(master.elementRankingRewards)) {
  let next=1;
  for(const [index,row] of rows.entries()) {
    assert.equal(row.minRank,next);assert(Number.isInteger(row.maxRank)&&row.maxRank>=0);
    assert(row.maxRank>=row.minRank || row.maxRank===0 && index===rows.length-1);
    assert(row.rewards.length>0 && row.rewards.length<=5);
    for(const item of row.rewards) assert(master.itemProfiles[item.itemId] && Number.isInteger(item.amount) && item.amount>0 && item.amount<=0x7fffffff);
    next=row.maxRank+1;
  }
  assert.equal(rows.at(-1).maxRank,0);
}
assert.deepEqual(master.elementEventScoring[66300000001], { stageId: 66100000001, adventureStageId: 1260000101101,
  difficulty: 1, slot4: 0, slot5: Math.fround(0.329), slot6: 0, slot7: 1, slot8: 1, slot9: 0, slot10: 240000, slot11: 6 });
assert.deepEqual(master.elementEventActionBonuses, []);
assert.deepEqual(master.elementEventTurnBonuses.map(row => [row.selector,row.value,row.turnThreshold]),
  [...Array.from({ length: 15 }, (_, i) => [1,40000-i*2000,i+1]), [1,10000,20]]);
for (const [id, row] of Object.entries(master.elementEventScoring)) {
  assert.equal(row.adventureStageId, master.elementEventDifficulties[id].adventureStageId);
  assert.equal(master.elementEventStages[row.stageId].infoId, master.elementEventDifficulties[id].infoId);
  assert.ok([row.slot5,row.slot8,row.slot11].every(n => Number.isFinite(n) && n >= 0));
  assert.ok(row.difficulty >= 1 && row.difficulty <= 4);
}
assert.equal(Object.values(master.elementEventScoring).filter(row => master.stages[row.adventureStageId].adventureType === 26).length, 1362);
assert.equal(Object.values(master.elementEventScoring).filter(row => master.stages[row.adventureStageId].adventureType === 27).length, 20);
assert.equal(master.currencies['currency.valis'], 205000002);
assert.deepEqual(master.pcProfiles[1011001001], { characterId:101000001,levelUpType: 11,heroSublimateGroup:0,initialCostumeId:0,
  jobIds: [106000101,106000102,106000103,106000104,106000105,106000106],extraAbilities:[],
  rankAbilities:[[1,2250100101],[2,2250100102],[3,2250100103],[4,2250100104],[5,2250100105]] });
assert.equal(Object.values(master.pcProfiles).filter(row=>row.initialCostumeId).length,346);
for(const row of Object.values(master.pcProfiles)) {
  assert.ok(Number.isSafeInteger(row.initialCostumeId) && row.initialCostumeId>=0);
  if(row.initialCostumeId) assert.ok(master.characterCostumes[row.initialCostumeId]);
}
assert.deepEqual(master.pcProfiles[1011001001].jobIds.map(id => master.pcJobRanks[id]), [1,2,3,4,5,6]);
assert.equal(Object.keys(master.pcInitialStates).length,1368);
assert.deepEqual(master.pcInitialStates[1011001001],{level:1,jobRank:1});
assert.deepEqual(master.pcInitialStates[1011003001],{level:1,jobRank:2});
assert.deepEqual(Object.values(master.pcInitialStates).reduce((counts,row)=>
  (counts[row.jobRank]=(counts[row.jobRank]??0)+1,counts),{}),{1:338,2:31,3:67,4:932});
for(const [id,row] of Object.entries(master.pcInitialStates)) {
  assert.equal(row.level,1);
  assert.equal(master.pcJobRanks[master.pcProfiles[id].jobIds[0]],row.jobRank,'Original starting rank maps to first job, not Bell rank');
}
assert.deepEqual(master.pcProfiles[1011001001].jobIds.map(id => master.pcJobPanelGroups[id]), [250,251,252,253,254,255]);
assert.equal(master.pcLimitBreakJobs[1011001001], 106000107);
assert.equal(Object.keys(master.pcLimitBreakJobs).length, 1368);
assert.equal(Object.keys(master.pcHeroSublimateGroups).length, 421);
assert.equal(master.pcHeroSublimateGroups[1011001001], undefined);
assert.equal(master.pcHeroSublimateGroups[1011001005], 1);
assert.equal(master.pcHeroSublimateGroups[1011001012], 2);
assert.equal(master.sources.heroSublimateLevelStep.rows,133);
assert.equal(master.sources.heroSublimateLevelStep.sha256,'cdc4607881443e3cc25b6c1fbc2c6953f7b86b2ce0b2120985eb5f3d45999c27');
assert.equal(Object.keys(master.pcHeroSublimateSteps).length,19);
assert.deepEqual(master.pcHeroSublimateSteps[1].slice(0,2),[[0,0,0,0,0,0,0,0],[1,125,7,36,5,9,21,8]]);
for (const steps of Object.values(master.pcHeroSublimateSteps))
  assert.ok(steps.length===7 && steps.every((row,i)=>row[0]===i && row.length===8 && row.every(Number.isSafeInteger)));
for (const [id, group] of Object.entries(master.pcHeroSublimateGroups)) {
  assert.ok(master.pcProfiles[id]);
  assert.ok(Number.isSafeInteger(group) && group >= 1 && group <= 18);
}
assert.equal(master.pcJobPanelGroups[106000107], 256);
for (const [id, job] of Object.entries(master.pcLimitBreakJobs)) {
  assert.ok(master.pcProfiles[id] && master.pcJobRanks[job] && Number.isSafeInteger(master.pcJobPanelGroups[job]));
  assert.ok(!master.pcProfiles[id].jobIds.includes(job));
}
assert.equal(master.sources.pcAbilityPanel.rows, 12915);
assert.equal(master.sources.pcAbility.rows, 3655);
assert.equal(Object.keys(master.pcAbilities).length,3655);
assert.equal(master.sources.pcAbility.sha256,'54c9a297add8e614844624e7980d4403893b3238a01694eb27c2d461a17ebd42');
assert.deepEqual(master.pcAbilities[2250000202],{ type:50,mode:1,amount:2,mask:2,condition:0,weaponMask:0 });
assert.deepEqual(master.pcAbilities[2250100105],{ type:50,mode:16,amount:200,mask:62,condition:0,weaponMask:0 });
assert.deepEqual(master.pcAbilities[2250100188],{ type:50,mode:16,amount:2500,mask:4,condition:1,weaponMask:2 });
for (const [id,ability] of Object.entries(master.pcAbilities)) {
  assert.equal(ability.type,master.pcAbilityTypes[id]);
  assert.ok(['mode','amount','mask','condition','weaponMask'].every(key=>Number.isSafeInteger(ability[key])));
}
assert.equal(Object.keys(master.pcAbilityPanels).length, 12915);
assert.equal(Object.keys(master.pcJobPanelGroups).length, 555);
assert.equal(master.pcAbilityTypes[2201001000], 1);
assert.deepEqual(master.pcAbilityPanels[107000001], { groupId: 0, index: 1, abilityId: 2250000202, irisCost: 2 });
for (const panel of Object.values(master.pcAbilityPanels)) {
  assert.ok(Number.isSafeInteger(panel.index) && panel.index >= 1 && panel.index <= 25);
  assert.ok(master.pcAbilityTypes[panel.abilityId]);
  assert.ok(Number.isSafeInteger(panel.irisCost) && panel.irisCost > 0 && panel.irisCost <= 300);
}
assert.deepEqual(master.pcJobMaxLevels, { 1:10, 2:20, 3:30, 4:40, 5:50, 6:60 });
assert.deepEqual(master.pcLevels[11].slice(0,3), [[1,0],[2,70],[3,175]]);
assert.deepEqual(master.pcBaseStats[1011001001],{ 1:100,2:10,4:9,8:11,16:9,32:11,64:16,128:9 });
assert.deepEqual(master.pcLevelGrowth[11].slice(0,3),[
  [1,0,0,0,0,0,0,0,0],[2,4,0,0,0,0,0,1,0],[3,4,0,0,0,0,0,1,0] ]);
assert.equal(Object.keys(master.pcBaseStats).length,1368);
assert.equal(Object.keys(master.pcLevelGrowth).length,40);
assert.equal(Object.values(master.pcLevelGrowth).reduce((n,steps)=>n+steps.length,0),4000);
assert.equal(master.sources.pcLevelStep.sha256,'07bb7befd8461d549770c3d751a37fae31b72be5f5acaefbba1cbfeaae469264');
for (const [group,steps] of Object.entries(master.pcLevelGrowth)) {
  assert.deepEqual(steps.map(row=>row[0]),master.pcLevels[group].map(row=>row[0]));
  assert.ok(steps.every((row,i)=>row.length===9 && row[0]===i+1 && row.every(Number.isSafeInteger)));
}
assert.deepEqual(master.playerLevels.slice(0,4), [[1,0],[2,100],[3,350],[4,1050]]);
assert.equal(master.playerLevels.length, 999);
assert.equal(Object.keys(master.playerMaxSP).length, 999);
assert.deepEqual(Object.values(master.playerMaxSP).slice(0,4), [20,21,22,23]);
for (const [level] of master.playerLevels) assert.ok(Number.isSafeInteger(master.playerMaxSP[level]) && master.playerMaxSP[level] > 0);
assert.deepEqual(master.familiaGodIds, Array.from({ length: 19 }, (_, i) => 20000001 + i));
assert.equal(master.sources.message.rows, 5312);
assert.equal(master.familiaFirstReward.itemId, master.items['gacha_ticket.character_4']);
assert.equal(master.familiaFirstReward.itemId, 296000003);
assert.equal(master.familiaFirstReward.amount, 1);
assert.equal(master.familiaFirstReward.messageId, 40550237);
assert.equal(master.familiaFirstReward.quantityPolicy, 'one ticket per local player');
assert.ok(master.familiaFirstReward.messageText.includes('4★ Guaranteed Ticket'));
assert.deepEqual(master.familiaStyleIds, Array.from({ length: 5 }, (_, i) => 21000001 + i));
assert.deepEqual(master.familiaTimeIds, Array.from({ length: 12 }, (_, i) => 22000001 + i));
assert.equal(Object.keys(master.familiaActivityTimes).length,12);
assert.deepEqual(master.familiaActivityTimes[22000009],{index:8,startHour:22,endHour:0});
assert.deepEqual(master.familiaActivityTimes[22000012],{index:11,startHour:4,endHour:6});
for(const id of master.familiaTimeIds) {
  const row=master.familiaActivityTimes[id];assert.ok(row);
  assert.ok([row.startHour,row.endHour].every(hour=>Number.isSafeInteger(hour) && hour>=0 && hour<24));
}
assert.equal(master.sources.familiaValisDonation.rows, 3);
assert.deepEqual(master.familiaValisDonations, {
  24000001: { valis: 100, dailyLimit: 5 },
  24000002: { valis: 1000, dailyLimit: 5 },
  24000003: { valis: 10000, dailyLimit: 5 },
});
assert.deepEqual(master.familiaDailyAchievements, Array.from({ length: 9 }, (_, i) => ({
  id: 8000000045 + i, recordType: i < 5 ? 301 : 401, startAt: 1596074400, expireAt: 0,
})));
assert.equal(master.sources.familiaAchievement.rows, 269);
assert.deepEqual(master.familiaMissionAchievements.reduce((counts, row) => {
  counts[row.recordType] = (counts[row.recordType] ?? 0) + 1;
  return counts;
}, {}), { 101: 1, 201: 259, 301: 5, 401: 4 });
assert.deepEqual(master.familiaMissionAchievements.filter(row => row.recordType === 101)
  .map(row => [row.name, row.requiredParam]), [['Test Mission', 10]]);
assert.ok(master.familiaMissionAchievements.filter(row => row.recordType === 201)
  .every(row => row.name.includes('Familia Members') && row.name.includes('Total earned score:')));
assert.equal(Object.keys(master.familiaShops).length, 41);
assert.equal(master.sources.familiaStamp.rows, 42);
assert.equal(Object.keys(master.familiaStamps).length, 42);
assert.equal(Object.values(master.familiaStamps).filter(row => row.isDefault).length, 30);
assert.deepEqual(master.familiaStamps[23000001], { art: 'stamp01.png', order: 12, isDefault: true });
assert.deepEqual(master.familiaStamps[23000023], { art: 'stamp31.png', order: 42, isDefault: false });
assert.deepEqual(Object.entries(master.familiaStamps).filter(([,row]) => !row.isDefault).map(([id]) => Number(id)),
  Object.values(master.familiaShops).filter(row => row.type === 1).map(row => row.rewardId));
assert.equal(master.sources.familiaSkillGroup.rows, 1);
assert.equal(master.sources.familiaSkill.rows, 315);
assert.deepEqual(master.familiaSkillGroups, {
  57300000001: { name: 'Elemental Dmg. (Up)', startAt: 1540951200 },
});
for (const type of [1,2,3,4,5,6,7]) {
  const skills = Object.values(master.familiaSkills).filter(row => row.type === type);
  assert.deepEqual(skills.map(row => row.level), Array.from({ length: 45 }, (_, i) => i + 1));
  assert.deepEqual(skills.map(row => row.cost), [
    ...Array(10).fill(3), ...Array(10).fill(5), ...Array(10).fill(7),
    ...Array(5).fill(9), ...Array(5).fill(12), ...Array(5).fill(16),
  ]);
  assert.deepEqual(skills.map(row => row.startAt), [
    ...Array(20).fill(0), ...Array(10).fill(1563415200), ...Array(10).fill(1596074400), ...Array(5).fill(1640224800),
  ]);
  assert.deepEqual(skills.map(row => row.pcSkillId), Array.from({ length: 45 }, (_, i) => 108000000 + type * 1000 + i + 1));
}
assert.equal(master.sources.familiaBgImage.rows, 15);
assert.equal(master.sources.familiaBGM.rows, 14);
assert.deepEqual(Object.entries(master.familiaShops).filter(([,row]) => row.isDefault).map(([id]) => Number(id)),
  [63000000013, 63000000023]);
assert.deepEqual(Object.fromEntries([1,2,3].map(type =>
  [type, Object.values(master.familiaShops).filter(row => row.type === type).length])), { 1: 12, 2: 15, 3: 14 });
assert.deepEqual(master.familiaShops[63000000001], {
  type: 1, rewardId: 23000023, price: 5000000, startAt: 1558576800, endAt: 0, isDefault: false,
});
for (const pc of Object.values(master.pcProfiles)) {
  assert.ok(Number.isSafeInteger(pc.characterId) && pc.characterId>=0 && (!pc.characterId || master.characters[pc.characterId]));
  assert.ok(pc.jobIds.length && pc.jobIds.every(id => master.pcJobRanks[id]));
  assert.ok(master.pcLevels[pc.levelUpType]?.length);
  assert.ok(master.pcLevelGrowth[pc.levelUpType]?.length);
  assert.ok(master.pcHeroSublimateSteps[pc.heroSublimateGroup]);
  assert.equal(pc.rankAbilities.length,5);
  assert.ok(pc.rankAbilities.every(([rank,id])=>rank>=1 && rank<=6 && (!id || master.pcAbilities[id])));
  assert.ok(pc.extraAbilities.length<=3 && pc.extraAbilities.every(id=>master.pcAbilities[id]));
}
assert.equal(Object.values(master.pcProfiles).filter(pc=>pc.extraAbilities.length).length,21);
assert.equal(Object.keys(master.pcProfiles).length,1368);
assert.equal(Object.values(master.pcProfiles).filter(pc=>pc.characterId>0).length,1341);
assert.equal(Object.values(master.pcProfiles).filter(pc=>pc.characterId===0).length,27,'Blank original NPC/debug keys stay unmapped');
assert.equal(master.sources.pc.sha256,'f273ac4093f78a5ad118201c81a329fc444812d9ba2a13db06a9b08d3a8289d2');
assert.equal(Object.keys(master.achievements).length, 42429);
assert.deepEqual(master.achievementTimeBonuses,[6010000001,6010000002]);
// WRITTEN ONLY / NOT RUN: this Union-linked class now has local solo delivery;
// natural peer-derived mission qualification remains in the co-op-last phase.
assert.deepEqual(Object.entries(master.achievements).filter(([,row])=>row.rewardType===35)
  .map(([id])=>Number(id)).sort((a,b)=>a-b),
  Array.from({length:14},(_,index)=>6090000001+index));
assert.ok(Object.values(master.achievements).filter(row=>row.rewardType===35)
  .every(row=>row.rewardKey==='union_medal_item.1' && row.category===9));
assert.equal(master.items['exp_item.large'], 292000003);
assert.equal(master.items.memoria_exp_item_general, 1208000001);
for (let index = 1; index <= 4; index++)
  assert.equal(master.items[`memoria_exp_item_individual.${1201000000 + index}`], 1208100000 + index);
assert.equal(Object.keys(master.memorias).length, 34);
assert.equal(Object.keys(master.memoriaLevels).length, 34);
for (let index = 1; index <= 34; index++) {
  const id = 1201000000 + index;
  assert.equal(master.memorias[`memoria.${id}`], id);
  assert.deepEqual(master.memoriaLevels[id], [0,2000,4000,6000,8000,10000]);
}
const memoriaRewards = Object.values(master.achievements).filter(row => row.rewardType === 30);
assert.equal(memoriaRewards.length, 30);
assert.ok(memoriaRewards.every(row => master.memorias[row.rewardKey] && row.rewardAmount === 1));
const memoriaExpRewards = Object.values(master.achievements).filter(row => row.rewardType === 31);
assert.equal(memoriaExpRewards.length, 10);
assert.ok(memoriaExpRewards.every(row => row.rewardKey === 'memoria_exp_item_general' && row.rewardAmount === 10));
assert.equal(Object.keys(master.loginExplorers).length, 3);
assert.deepEqual(master.loginExplorers[780000001], { key: 'login_bonus_explorer.1', title: 'Treasure Hunt S1',
  limit: 14, startAt: 1658404800, endAt: 1664539199, weights: [500,2500,4000,3000],
  rewards: [100,80,60,40].map((amount, rank) => ({ id: 781000001 + rank, rank, rewardKey: 'currency.gem', amount })) });
assert.equal(master.loginExplorers[780000003].limit, 10);
assert.equal(Object.keys(master.characterPresents).length, 1);
assert.equal(master.characterPresents[52000000001].startAt, 1548295200);
assert.equal(master.characterPresents[52000000001].endAt, 1550815199);
assert.equal(master.characterPresents[52000000001].characters.length, 20);
assert.deepEqual(master.characterPresents[52000000001].items, [{ id:52100000001, itemId:290000181, point:5 }]);
assert.deepEqual(master.itemProfiles[290000181], { table:'UserEventItem', idField:'eventItemId' });
assert.equal(master.items['event_point.valentine_campaign_2019'],290000181);
assert.equal(master.sources.characterPresentItemInfo.rows,1);
assert.equal(master.sources.characterPresentItemInfo.path,'1/master/divide_enc/characterPresentItemInfo.enc');
assert.equal(master.sources.characterPresentItemInfo.sha256,'22645cdaa9cfcca5c3b5b2e531129850f634bbe6dfdb841f8c0d6b3f17c99608');
const earlierSources = Object.fromEntries(Object.entries(master.sources).filter(([name]) => name !== 'characterPresentItemInfo'));
assert.equal(crypto.createHash('sha256').update(JSON.stringify(earlierSources)).digest('hex'),
  'edc93cce3032d5770cf599acc2f0f3c7015a66096fee36f29b954b7fefbb5d03','Preserve all prior160 original sources');
assert.deepEqual(master.characterPresents[52000000001].characters[0], {
  id: 52200000001, characterId: 101000002, requiredPoint: 100, rewardItemId: 295000007,
});
assert.deepEqual(master.characterPresents[52000000001].characters.at(-1), {
  id: 52200000020, characterId: 101000007, requiredPoint: 100, rewardItemId: 295000026,
});
assert.deepEqual(Object.keys(master.votes).map(Number), Array.from({ length: 8 }, (_, i) => 50000000001 + i));
assert.deepEqual(Object.values(master.votes).map(row => row.candidates.length), [20,12,11,15,26,22,69,68]);
assert.equal(Object.values(master.votes).flatMap(row => row.candidates).length, 243);
assert.equal(master.votes[50000000001].startAt, master.votes[50000000001].endAt, 'Preserve the original empty voting windows');
assert.equal(master.votes[50000000002].startAt, master.votes[50000000002].endAt);
assert.equal(master.votes[50000000007].startAt, 1626314400);
assert.equal(master.votes[50000000007].endAt, 1626879599);
assert.equal(master.votes[50000000007].defaultItemAmount, 5);
assert.equal(master.votes[50000000007].voteItemId, 216000007);
assert.deepEqual(master.votes[50000000007].candidates[0], { id: 51000000107, characterId: 101000001, order: 1 });
assert.deepEqual(master.votes[50000000003].candidates[0], { id: 51000000033, characterId: 1012027014, order: 1 });
assert.equal(master.items['vote_item.216000007'], 216000007);
assert.equal(master.items['vote_item.valentine1'], 216000001);
for (const vote of Object.values(master.votes)) {
  assert.ok(Object.values(master.items).includes(vote.voteItemId));
  assert.ok(vote.candidates.every(row => master.characters[row.characterId] || master.pcProfiles[row.characterId]));
  assert.equal(new Set(vote.candidates.map(row => row.id)).size, vote.candidates.length);
}
for (const row of master.characterPresents[52000000001].characters) {
  assert.equal(row.requiredPoint, 100);
  assert.ok(master.characters[row.characterId]);
  assert.ok(Object.values(master.items).includes(row.rewardItemId));
}
for (const bonus of Object.values(master.loginExplorers)) {
  assert.deepEqual(bonus.rewards.map(row => row.rank), [0,1,2,3]);
  assert.ok(bonus.rewards.every(row => master.items[row.rewardKey] && row.amount > 0));
  assert.equal(bonus.weights.reduce((sum, n) => sum + n, 0), 10000);
}
assert.equal(Object.keys(master.eventBoxes).length, 100);
assert.equal(Object.values(master.eventBoxes).reduce((n, box) => n + box.steps.length, 0), 1585);
assert.equal(Object.values(master.eventBoxes).flatMap(box => box.steps).reduce((n, step) => n + step.contents.length, 0), 40678);
// WRITTEN ONLY / NOT RUN: the final catalog has no shared-cost sibling
// branch for event_box/draw; a duplicate is catalog drift, not gameplay.
assert.equal(new Set(Object.values(master.eventBoxes).map(box => box.costKey)).size, 100);
const eventBoxProfiles = Object.values(master.eventBoxes).flatMap(box => box.steps).flatMap(step => step.contents)
  .map(content => master.itemProfiles[master.items[content.rewardKey]]);
assert.ok(eventBoxProfiles.every(Boolean), 'Every final event-box prize has an implemented item profile');
assert.deepEqual([...new Set(eventBoxProfiles.map(profile => profile.table))].sort(), [
  'UserCpItem','UserCurrency','UserEquipmentMaterial','UserExpItem','UserGachaTicket',
  'UserKeyItem','UserStaminaTicket','UserStatusBoardItem','UserVoteItem',
]);
assert.equal(master.items['event_point.scenario_halloween_first_4'], 290000028);
assert.equal(master.eventBoxes[193000001].cost, 10);
assert.equal(master.eventBoxes[193000001].steps[0].id, 194000001);
assert.equal(master.eventBoxes[193000001].steps.at(-1).repeatable, 1);
assert.deepEqual(master.eventBoxes[193000001].steps[0].contents[0], { id: 195000001,
  rewardType: 6, rewardKey: 'gacha_ticket.character_3', amount: 1, limited: 1, limit: 1, requiredForReset: 1, weight: 100 });
for (const box of Object.values(master.eventBoxes)) {
  assert.ok(master.items[box.costKey]);
  assert.ok(box.steps.every((step, i) => step.index === i + 1 && step.contents.length > 0));
  assert.ok(box.steps.every(step => step.contents.every(row => row.weight > 0 && (!row.limited || row.limit > 0))));
}
assert.deepEqual(master.achievements[6020000001], { category: 2, startAt: 0, expireAt: 0,
  rewardType: 3, rewardKey: 'currency.gem', rewardAmount: 10 });
assert.equal(master.achievements[6010000005].rewardKey, 'stamina_ticket.jagamarukun');
assert.equal(master.achievements[6010000005].rewardAmount, 3);
assert.deepEqual(master.stages[1010000101103], { type: 51, rewardType: 3, rewardKey: 'currency.gem', rewardAmount: 5, adventureType: 1 });
assert.equal(master.stages[1090006801129].type, 12);
assert.equal(master.stages[1090006801129].adventureType, 9, 'Boss kind is not the completion-dispatch mode');
assert.equal(master.stages[1120000901101].adventureType, 12);
assert.equal(master.sources.adventureStageScore.rows, 36);
assert.equal(master.sources.adventureStageScoreBase.rows, 1);
assert.deepEqual(master.pveScoreBase, { id: 686000001, selector: 1, s: 420, a: 340, b: 240, c: 0 });
assert.equal(Object.keys(master.pveScores).length, 36);
assert.deepEqual(master.pveScores[1120000901101], { id: 689000001, baseId: 686000001, multiplier: 16,
  rewards: { c: { rewardType: 1, rewardKey: 'currency.gem', rewardAmount: 1, threshold: 0 },
    b: { rewardType: 1, rewardKey: 'currency.gem', rewardAmount: 1, threshold: 3840 },
    a: { rewardType: 1, rewardKey: 'currency.gem', rewardAmount: 1, threshold: 5440 },
    s: { rewardType: 1, rewardKey: 'currency.gem', rewardAmount: 1, threshold: 6720 } } });
assert.deepEqual(master.pveScores[1120000904103].rewards.s,
  { rewardType: 0, rewardKey: 'status_board_item.special', rewardAmount: 1, threshold: 52500 });
assert.equal(Object.values(master.pveScores).filter(row => row.rewards.s.rewardAmount === 2).length, 8);
for (const [id, row] of Object.entries(master.pveScores)) {
  assert.equal(master.stages[id].adventureType, 12);
  assert.ok(row.multiplier > 0);
  for (const [rank, reward] of Object.entries(row.rewards)) {
    assert.equal(reward.threshold, Math.trunc(Math.fround(Math.fround(master.pveScoreBase[rank]) * row.multiplier)));
    assert.ok(reward.rewardAmount > 0);
    assert.ok(reward.rewardType === 1 && reward.rewardKey === 'currency.gem' || reward.rewardType === 0 && master.items[reward.rewardKey]);
  }
}
assert.deepEqual([...new Set(Object.values(master.stages).map(row => row.adventureType))].sort((a,b) => a-b),
  Array.from({ length: 28 }, (_, i) => i + 1));
assert.equal(master.pcs['character.0_lil_s2_1'], 1011003001);
assert.equal(Object.keys(master.expeditionStages).length, 227);
assert.equal(master.sources.expeditionStageRequirement.rows,368);
assert.equal(master.sources.expeditionStageRequirement.sha256,'d64087b2ced00c3f642103938b6accc0e071471a5f77f06e7b436d5ea194bd52');
assert.equal(Object.keys(master.expeditionStageRequirements).length,227);
assert.equal(Object.values(master.expeditionStageRequirements).flat().length,288);
assert.equal(Object.values(master.expeditionStageRequirements).filter(rows=>rows.length).length,144);
assert.deepEqual(master.expeditionStageRequirements[707000001],[]);
assert.deepEqual(master.expeditionStageRequirements[707000026],
  [{ id:708000001,changeState:0,type:2,value:10 }]);
assert.deepEqual(master.expeditionStageRequirements[707000027],
  [{ id:708000002,changeState:2,type:1,value:707000026 },{ id:708000003,changeState:0,type:2,value:10 }]);
assert.ok(master.expeditionStageRequirements[707000070].some(row=>row.changeState===2 && row.type===1 && row.value===707000070));
assert.deepEqual(master.expeditionStages[707000001], {
  startAt: 1569549600, endAt: 4725223200, duration: 7200,
  successRewardGroupId: 711000002, greatRewardGroupId: 711000003, failureRewardGroupId: 711000001,
  requiredStatus: 4000, requiredLevel: 160, conditionGroupId: 709000001, initialState: 0,
  stageTextId: 717000001, additionalRewardGroupId: 711000117,
});
assert.equal(Object.keys(master.expeditionConditions).length, 85);
assert.equal(Object.values(master.expeditionConditions).flat().length, 334);
assert.deepEqual(master.expeditionConditions[709000001][0], {
  id: 710000001, type: 1, characterId: 101000003, unknown4: 0,
  requiredStatus: 500, requiredLevel: 20, weight: 5000, unknown8: 1,
});
assert.equal(Object.keys(master.expeditionRewardGroups).length, 311);
assert.equal(Object.values(master.expeditionRewardGroups).flatMap(row => row.rewards).length, 697);
assert.deepEqual(master.expeditionRewardGroups[711000002].counts,
  [{ id: 712000002, weight: 10000, count: 80 }]);
assert.equal(master.expeditionRewardGroups[711000002].experience, 300);
assert.equal(master.expeditionRewardGroups[711000002].friendship, 5);
assert.deepEqual(master.expeditionRewardGroups[711000002].rewards[0],
  { id: 713000007, weight: 1667, type: 2, rewardId: 294000001, amount: 1 });
// Preserve authored weights, including totals below AND above 10000.
// The absent original server sampler must not be inferred from one group.
assert.equal(master.expeditionRewardGroups[711000101].rewards.reduce((n, row) => n + row.weight, 0), 5000);
assert.equal(master.expeditionRewardGroups[711000129].rewards.reduce((n, row) => n + row.weight, 0), 20000);
const itemIds = new Set(Object.values(master.items));
const cpRewardIds = Object.values(master.characters).flatMap(row => row.rewards.map(reward => reward[0]));
assert.equal(new Set(cpRewardIds).size, cpRewardIds.length, 'CP ledger IDs are unique across characters and heroes');
assert.ok(cpRewardIds.every(id => !itemIds.has(id)), 'CP reward records are not ordinary inventory item IDs');
for (const stage of Object.values(master.expeditionStages)) {
  for (const key of ['successRewardGroupId','greatRewardGroupId','failureRewardGroupId','additionalRewardGroupId'])
    assert.ok(master.expeditionRewardGroups[stage[key]], `Missing ${key} ${stage[key]}`);
  assert.ok(master.expeditionConditions[stage.conditionGroupId]);
  assert.ok(stage.requiredStatus > 0 && stage.requiredLevel > 0 && stage.duration > 0);
}
for (const condition of Object.values(master.expeditionConditions).flat()) {
  assert.ok([1,3].includes(condition.type));
  assert.ok(condition.requiredLevel > 0 && condition.requiredStatus > 0 && condition.weight > 0);
  assert.ok(condition.type === 3 || master.characters[condition.characterId]);
}
for (const group of Object.values(master.expeditionRewardGroups)) {
  assert.ok(group.experience >= 0 && group.friendship >= 0);
  for (const [rows, valueKey] of [[group.counts, 'count'], [group.rewards, 'amount']]) {
    assert.ok(rows.length > 0);
    assert.ok(rows.every(row => Number.isSafeInteger(row.weight) && row.weight > 0 &&
      row.weight <= 10000 &&
      Number.isSafeInteger(row[valueKey]) && row[valueKey] > 0));
  }
  assert.ok(group.rewards.every(row => itemIds.has(row.rewardId)));
}
assert.equal(Object.keys(master.shopProducts).length, 7528);
assert.deepEqual(master.shopProducts[207000002], { priceType: 0, priceItemId: 0, price: 10,
  limitType: 0, limit: 0, rewardType: 0, rewardId: 298000001, amount: 1,
  startAt: 0, endAt: 0, shopId: 204000001, duration: 0 });
assert.equal(master.shopProducts[207000003].price, 100);
assert.equal(master.shopProducts[207000003].amount, 11);
assert.equal(master.shopProducts[207000001].priceType, 1);
assert.equal(master.shopProducts[207000008].priceType, 2);
assert.deepEqual(master.itemProfiles[294000002], { table: 'UserStatusBoardItem', idField: 'statusBoardItemId' });
assert.deepEqual(master.itemProfiles[297000005], { table: 'UserPCTicket', idField: 'pcTicketId' });
assert.deepEqual(master.itemProfiles[331000001], { table: 'UserSubscriptionTicket', idField: 'subscriptionTicketId' });
assert.equal(master.sources.subscriptionTicket.sha256, '9f8a6c182f73bb51d9a29b7c5a3b5dc68b4cf484c894279bfb68b8220c4946be');
assert.deepEqual(master.subscriptionTickets[331000001], { key:'subscription_ticket.1',name:'Prism Bond Shard',
  description:'Three of these can be exchanged for a Prism Bond (Ad.) or Prism Bond (As.).',duration:15552000,exchangeCount:3 });
assert.equal(Object.keys(master.subscriptionTickets).length,1);
for (const [name, count, sha256] of [
  ['subscription',2,'45e0a9c947fe45e8b9b4122e0e5f88d46cc5ef58e44e559d8fc082870d64e1fb'],
  ['subscriptionItem',8,'5cdb1bb86071546c1dd3cdd52ff413fc4559643fb712dac380391864887ac965'],
  ['subscriptionExtendItem',4,'3c3ad4f411883e1450fcdca6234845f9e4e8929ce83242f20874de18d1babdca'],
  ['subscriptionDisplay',3,'4d68f668d51a93d552da031ef1cc3e3f3be923311f100f94cd01229856db2cdc'],
  ['skipTicket',2,'3d9d38cd2abb163e2dc31766dd5aa87b818007c389b5e84efb46e97ab61bb25b'],
]) {
  assert.equal(master.sources[name].rows,count);
  assert.equal(master.sources[name].sha256,sha256);
}
assert.deepEqual(Object.keys(master.subscriptions),['1301000001','1301000002']);
for (const [id, productId, name, ticket] of [
  [1301000001,'com.us.danmemo.subscription.tier1',"Syr's Daily Lunch Box Set",296000015],
  [1301000002,'com.us.danmemo.subscription.tier2','Hostess of Fertility Full Course',296000149],
]) {
  const plan=master.subscriptions[id];
  assert.equal(plan.productId,productId); assert.equal(plan.name,name);
  assert.equal(plan.startAt,1630461600); assert.equal(plan.endAt,2145970799);
  assert.equal(plan.missionShopId,204000209); assert.equal(plan.exchangeShopId,204000210);
  assert.deepEqual(plan.bonusItems.map(row=>[row.type,row.itemId,row.amount,row.slot5]),
    [[2,288000002,5,1],[0,205000005,100,1],[2,288000001,5,0],[0,205000005,100,0]]);
  assert.deepEqual(plan.extendBonusItems.map(row=>[row.type,row.itemId,row.amount]),[[1,ticket,1],[3,331000001,1]]);
  assert.ok([...plan.bonusItems,...plan.extendBonusItems].every(row=>typeof row.name==='string'&&row.name.length));
}
assert.equal(master.skipTickets[288000001].key,'skip_ticket.default');
assert.equal(master.skipTickets[288000002].name,'Skip Ticket Assist Ticket');
assert.equal(master.itemProfiles[288000001],undefined,'Skip ticket metadata does not invent ordinary-item amount semantics');
assert.deepEqual(Object.values(master.subscriptionDisplays).map(row=>[row.type,row.key]),[[1,'tier1'],[2,'tier2'],[3,'both']]);
for (const [productId,rewardId] of [[207004490,291000002],[207004491,291000003]]) {
  assert.deepEqual(master.itemProfiles[rewardId], { table:'UserGeneralLimitBreakItem',idField:'limitBreakItemId' });
  assert.deepEqual(master.shopProducts[productId], { priceType:2,priceItemId:331000001,price:3,limitType:0,limit:0,
    rewardType:0,rewardId,amount:1,startAt:1630461600,endAt:0,shopId:204000210,duration:0 });
}
const shopItemExchanges = Object.values(master.shopProducts).filter(row => row.priceType === 2 && row.rewardType === 0);
assert.equal(shopItemExchanges.length, 6509);
assert.deepEqual(Object.fromEntries([0,1,2,3].map(type => [type, shopItemExchanges.filter(row => row.limitType === type).length])),
  { 0: 6205, 1: 252, 2: 0, 3: 52 });
assert.ok(shopItemExchanges.every(row => !row.duration && master.itemProfiles[row.priceItemId] && master.itemProfiles[row.rewardId]));
assert.equal(Object.keys(master.shopPacks).length, 353);
assert.equal(Object.values(master.shopPacks).flatMap(row => row.contents).length, 2577);
assert.deepEqual(master.shopPacks[208000001], { key: 'treasure_beginner', contents: [
  { type: 0, rewardId: 296000008, amount: 1 }, { type: 0, rewardId: 297000005, amount: 1 },
] });
assert.ok(Object.values(master.shopProducts).filter(row => row.rewardType === 2).every(row => master.shopPacks[row.rewardId]));
const lottoItemIds = new Set(Object.keys(master.takarakujiItems).map(Number));
assert.ok(Object.values(master.shopProducts).every(row => !lottoItemIds.has(row.rewardId) && !lottoItemIds.has(row.priceItemId)));
assert.ok(Object.values(master.shopPacks).flatMap(row => row.contents).every(row => !lottoItemIds.has(row.rewardId)));
assert.equal(Object.keys(master.lotteries).length, 2236);
assert.equal(Object.keys(master.lotteryWeights).length, 90);
assert.equal(master.lotteryWeights[174000001], 2);
assert.equal(master.lotteryWeights[174000013], 100);
assert.deepEqual(master.lotteryPools[172000248][174000009], [1011500001,1011038002,1011502001,1011505001]);
assert.deepEqual(master.lotteries[171000132], { startAt: 1524794400, endAt: 0, groupId: 172000248,
  ticketId: 296000020, special: false, buttons: [
    { pickCount: 0, consumeType: 1, consumeAmount: 0, limit: 0, daily: false, fixedGroupId: 0, fixedCount: 0, stepUpGroupId: 0 },
    { pickCount: 1, consumeType: 2, consumeAmount: 1, limit: 0, daily: false, fixedGroupId: 0, fixedCount: 0, stepUpGroupId: 0 },
    { pickCount: 0, consumeType: 0, consumeAmount: 0, limit: 0, daily: false, fixedGroupId: 0, fixedCount: 0, stepUpGroupId: 0 },
  ] });
assert.equal(master.lotteryTickets[296000020], 2592000);
assert.equal(master.bonds[1011001001], master.items['limit_break_item.0_bel_s1_1']);
assert.equal(master.lotteries[171000002].buttons[0].consumeType, 3);
assert.equal(master.lotteries[171000002].buttons[0].daily, true);
assert.equal(master.lotteries[171000002].buttons[1].consumeAmount, 40);
assert.equal(master.lotteries[171000002].buttons[2].fixedGroupId, 172000002);
assert.equal(master.lotteries[171000002].buttons[2].fixedCount, 2);
assert.equal(master.lotteries[171000037].buttons[1].fixedCount, 1);
assert.equal(master.lotteries[171000037].buttons[1].limit, 1);
assert.equal(master.lotteries[171000121].special, false, 'New badge is not a special draw rule');
assert.equal(master.lotteries[171000121].buttons[2].stepUpGroupId, 450000006);
assert.equal(master.lotteries[171000022].special, true, 'Legacy milestone guarantees stay classified');
assert.equal(Object.keys(master.lotteryStepUps).length, 303);
assert.equal(Object.values(master.lotteryStepUps).reduce((n, rows) => n + rows.length, 0), 2984);
assert.equal(master.lotteryStepUps[450000303].length, 11, 'Identical archived schedule copies are deduplicated');
assert.deepEqual(master.lotteryStepUps[450000006].slice(0, 5).map(row =>
  [row.stepIndex,row.consumeAmount,row.pickCount,row.fixedGroupId]), [
  [1,200,11,172000221], [2,250,11,172000221], [3,300,11,172000221],
  [4,350,11,172000221], [5,400,11,172000222],
]);
assert.equal(master.lotteryStepUps[450000006].at(-1).lastStepFlag, 1);
assert.equal(Object.values(master.lotterySteps).flat().length, 1321);
assert.deepEqual(master.lotterySteps[171000675].map(row => row.count), [1,4,7,10]);
assert.equal(Object.values(master.lotteryScratches).flat().length, 22);
assert.equal(master.lotteryScratches[171000092][0].scratchId, 611000001);
assert.deepEqual(master.lotteries[171001834].selectionGroupIds, [452000067,452000068,452000069]);
assert.equal(master.selectLineupWeights[452000067], 174000001);
assert.ok(master.selectLineupPools[452000067].includes(1011015006));
for (const stage of Object.values(master.stages)) {
  assert.ok(!stage.rewardType || (stage.rewardType === 3 && stage.rewardKey === 'currency.gem') ||
    (stage.rewardType === 50 && stage.rewardAmount >= 1 && stage.rewardAmount <= 2 && master.pcs[stage.rewardKey]) || master.items[stage.rewardKey]);
}
for (const task of Object.values(master.stageTasks)) {
  assert.ok(master.stages[task.stageId]);
  assert.ok((task.rewardType === 0 && task.rewardAmount === 0) ||
    (task.rewardType === 1 && task.rewardKey === 'currency.gem' && task.rewardAmount === 1));
}
assert.deepEqual(master.stageTasks[682000001], { stageId: 1010000101101, rewardType: 1, rewardKey: 'currency.gem', rewardAmount: 1 });
for (const row of Object.values(master.characters)) {
  assert.equal(row.levels.length, 50);
  assert.equal(row.levels[0][1], 0);
  assert.equal(new Set(row.levels.map(([level]) => level)).size, 50);
  assert.equal(row.levels.every(([level, points], i) => level === i + 1 && points >= (row.levels[i-1]?.[1] ?? 0)), true);
  assert.equal(new Set(row.rewards.map(([id]) => id)).size, row.rewards.length);
  assert.ok(row.favoriteItems.length > 0 && row.favoriteItems.length <= 5);
  assert.ok(row.favoriteItems.every(([id, factor]) => master.cpItems[id] > 0 && [2,40,100].includes(factor)));
}
assert.throws(() => rows(Buffer.alloc(4)), /Invalid master vtable/);
assert.throws(() => rows(Buffer.from('ffffffff', 'hex')), /bounds/);
assert.throws(() => field(Buffer.alloc(8), 0, -1), /field index/);
assert.throws(() => decodeBlock(Buffer.alloc(8), Buffer.alloc(16)), /length validation/);
assert.throws(() => decodeFile(Buffer.alloc(0), Buffer.alloc(32), Buffer.alloc(16)), /file length/);
// Minimal one-row original FlatBuffer shape; synthetic key, never native keys.
const byteKey=Buffer.alloc(16,7),byteTable=Buffer.alloc(52);
byteTable.writeUInt32LE(12,0);
for(const at of [4,28]) {byteTable.writeUInt16LE(6,at);byteTable.writeUInt16LE(12,at+2);byteTable.writeUInt16LE(4,at+4);}
byteTable.writeInt32LE(8,12);byteTable.writeUInt32LE(4,16);byteTable.writeUInt32LE(1,20);
byteTable.writeUInt32LE(12,24);byteTable.writeInt32LE(8,36);
for(const value of [0,1,2,128,255]) {
  encodeBlock(Buffer.from([value]),byteKey,8).copy(byteTable,40);
  assert.deepEqual(decodeTable(byteTable,[['kind','byte']],byteKey),[{kind:value}]);
  if(value<=1) assert.deepEqual(decodeTable(byteTable,[['flag','bool']],byteKey),[{flag:Boolean(value)}]);
  else assert.throws(()=>decodeTable(byteTable,[['flag','bool']],byteKey),/byte\/boolean/);
}
byteTable.writeUInt16LE(0,32);
assert.deepEqual(decodeTable(byteTable,[['kind','byte']],byteKey),[{kind:0}]);

const contents = path.join(root, 'contents');
if (fs.existsSync(contents)) {
  for (const source of Object.values(master.sources)) {
    const wire = fs.readFileSync(path.join(contents, source.path));
    assert.equal(crypto.createHash('sha256').update(wire).digest('hex'), source.sha256);
  }
  const binary = path.join(root,'.work','arm64-original','lib','arm64-v8a','libapp.so');
  if (fs.existsSync(binary)) {
    const config = nativeMasterConfig(binary), key = Buffer.from(config.numericKey);
    const source = name => fs.readFileSync(path.join(contents, '1','master','divide_enc',`${name}.enc`));
    assert.deepEqual(decodeTable(decodeFile(source('unionRaidMedal'),config.key,config.iv),
      [['id','int'],['key','string'],['name','string']],key),
      [{id:410000001,key:'union_medal_item.1',name:'Alliance Medal'}]);
    assert.equal(crypto.createHash('sha256').update(source('gift')).digest('hex'),
      'fcc1856e41447b9ba79bc8c88d7e396f095f6519f095cfc565724eebf35c95c0');
    assert.equal(crypto.createHash('sha256').update(source('giftContent')).digest('hex'),
      '02d2160c462309da1451470f7095d566beb6ce73f4482b4137ab5ae68c3e0ce6');
    const lottoMessages = decodeTable(decodeFile(source('message'),config.key,config.iv),
      [['id','int'],['key','string'],null,['text','string']],key).filter(row=>row.key.startsWith('takarakuji_'));
    assert.equal(lottoMessages.find(row=>row.key==='takarakuji_lottery_date')?.text,'7/17(Mon)');
    assert.equal(lottoMessages.find(row=>row.key==='takarakuji_distribution_period')?.text,
      '06/14(Wed) 18:00 〜 07/16(Sun) 06:59 (PST)');
    const gifts = decodeTable(decodeFile(source('gift'),config.key,config.iv),
      [['id','int'],['key','string'],['kind','int'],['contentKey','string'],['name','string'],['description','string']],key);
    const contentsRows = decodeTable(decodeFile(source('giftContent'),config.key,config.iv),
      [['id','int'],['key','string'],['itemId','int'],['amount','int']],key);
    assert.equal(gifts.length,33); assert.equal(contentsRows.length,82);
    const actual = {};
    for (const row of contentsRows) {
      const match = /^gift_contents\.takarakuji_(1|2|3|4|11)_([1-8])$/.exec(row.key);
      if (!match) continue;
      const [,season,rank] = match;
      (actual[season] ??= [])[Number(rank)-1] ??= [];
      actual[season][Number(rank)-1].push([row.itemId,row.amount]);
      assert.ok(Object.values(master.items).includes(row.itemId));
    }
    assert.deepEqual(actual,lottoPrizes);
    for(const row of gifts.filter(row=>/^gift\.takarakuji_/.test(row.key)))
      assert.ok(contentsRows.some(content=>content.key===row.contentKey));
    assert.deepEqual(gameplayData(contents,config),master);
  }
}
console.log('Original gameplay data, archive provenance, decoder bounds, and reward tracks: OK');
