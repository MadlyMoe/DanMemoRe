'use strict';
// DEFERRED / NOT RUN: execute only after all packets are implemented.
// Original-item joins only; this is not native grant, callback or save proof.
const assert=require('node:assert/strict');
const {guildRaidDefeatRewardItems}=require('./danmemore_server.cjs');
const original=require('../data/danmemore-master.json');
const covered=new Set();
for(const [stageId,rewardId] of Object.entries(original.guildRaidStageDefeatRewards)) {
  const reward={guildRaidStageId:Number(stageId),defeatRewardId:rewardId},
    authored=original.guildRaidDefeatRewards[rewardId].items,amounts=new Map();
  for(const item of authored) amounts.set(item.itemId,(amounts.get(item.itemId) ?? 0)+item.amount);
  assert.deepEqual(guildRaidDefeatRewardItems([reward],original),[...amounts].map(([itemId,amount])=>({itemId,amount})));
  assert.deepEqual(guildRaidDefeatRewardItems([reward,reward],original),
    [...amounts].map(([itemId,amount])=>({itemId,amount:amount*2})));
  covered.add(rewardId);
}
assert.equal(Object.keys(original.guildRaidStageDefeatRewards).length,957);
assert.equal(covered.size,19);
assert.deepEqual([...covered].sort(),Object.keys(original.guildRaidDefeatRewards).map(Number).sort());
const reward={guildRaidStageId:58300000001,defeatRewardId:58500000001};
assert.deepEqual(guildRaidDefeatRewardItems([reward],original),[{itemId:294000003,amount:5},{itemId:294000006,amount:5}]);
for(const invalid of [null,[],[{}],[{...reward,extra:true}],[{...reward,guildRaidStageId:1}],
  [{...reward,defeatRewardId:58500000002}],[{...reward,defeatRewardId:NaN}]])
  assert.throws(()=>guildRaidDefeatRewardItems(invalid,original));
const master=structuredClone(original);
master.guildRaidDefeatRewards[reward.defeatRewardId].items=[{itemId:294000003,amount:0x7fffffff}];
assert.throws(()=>guildRaidDefeatRewardItems([reward,reward],master),/overflowing/);
master.guildRaidDefeatRewards[reward.defeatRewardId].items=[{itemId:294000003,amount:0}];
assert.throws(()=>guildRaidDefeatRewardItems([reward],master));
master.guildRaidDefeatRewards[reward.defeatRewardId].items=[{itemId:1,amount:5}];
assert.throws(()=>guildRaidDefeatRewardItems([reward],master));
delete master.guildRaidDefeatRewards[reward.defeatRewardId];
assert.throws(()=>guildRaidDefeatRewardItems([reward],master),/Missing original/);
console.log('Original Familia raid defeat reward joins, all definitions, repeated rotations and quantities: OK');
