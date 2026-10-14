'use strict';
// DEFERRED / NOT RUN: execute only after all packets are implemented.
// Disposable private-history fixtures, not native popup/signature/save evidence.
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {USER_ID,guildRaidSeenState,guildRaidSeenCheckpoint,guildRaidScoredSettlement}=require('./danmemore_server.cjs');
const master=require('../data/danmemore-master.json');
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE guild_raid_completion(operation_id INTEGER PRIMARY KEY,raid_id INTEGER,creation_operation_id INTEGER);
  CREATE TABLE guild_raid_scored_completion(operation_id INTEGER PRIMARY KEY,settlement_json TEXT);
  CREATE TABLE operation_done(id INTEGER PRIMARY KEY);
  CREATE INDEX guild_raid_completion_seen ON guild_raid_completion(raid_id,operation_id);`);
try {
  const [eventId,event]=Object.entries(master.guildRaidEvents)[0],raidId=Number(eventId),
    [stageId,stage]=Object.entries(master.guildRaidStages).find(([,row])=>row.guildRaidInformationId===raidId && row.slot2===1 && row.slot3===1),
    initial={code:0,available:true,guildRaidStageId:Number(stageId),loopCount:1,
      bosses:stage.bossHp.flatMap((hp,enemyIndex)=>hp ? [{enemyIndex,hp}] : []),rank:0,ranking:[],defeatCount:0,
      defeatRewardExists:false,displayDefeatStageId:0,displayDefeatLoopCount:0,lastBattleInfo:{logType:0}},
    state=count=>[{userId:USER_ID,guildRaidId:raidId,readDefeatCount:count}],
    settle=(status,record)=>guildRaidScoredSettlement({guildRaidStageId:status.guildRaidStageId,loopCount:status.loopCount,isTraining:false,
      bosses:Array.from({length:5},(_,enemyIndex)=>({enemyIndex,damage:status.bosses.some(boss=>boss.enemyIndex===enemyIndex) ? 0x7fffffff : 0}))},
      status,record,master,event.window6,'Deferred'),first=settle(initial,null),second=settle(first.statusAfter,first.targetRecord),
    insert=(id,creationId,settlement,done=true)=>{
      db.prepare('INSERT INTO guild_raid_completion VALUES(?,?,?)').run(id,raidId,creationId);
      db.prepare('INSERT INTO guild_raid_scored_completion VALUES(?,?)')
        .run(id,JSON.stringify({policy:'offline-guild-raid-v1',statusAfter:settlement.statusAfter}));
      if(done) db.prepare('INSERT INTO operation_done VALUES(?)').run(id);
    };
  assert.deepEqual(guildRaidSeenState(state(1),master),state(1)[0]); //Codec alone is not earning proof.
  assert.deepEqual(guildRaidSeenCheckpoint(state(0),master,db),state(0)[0]);
  assert.throws(()=>guildRaidSeenCheckpoint(state(1),master,db),/acknowledged original-event defeats/);
  insert(1,100,first,false);
  assert.throws(()=>guildRaidSeenCheckpoint(state(1),master,db),/acknowledged original-event defeats/);
  db.prepare('INSERT INTO operation_done VALUES(?)').run(1);
  assert.deepEqual(guildRaidSeenCheckpoint(state(1),master,db),state(1)[0]);
  assert.throws(()=>guildRaidSeenCheckpoint(state(2),master,db,400),/acknowledged original-event defeats/);
  insert(2,100,second);insert(3,200,first);
  //A player-wide marker survives a newer Familia's smaller current counter.
  assert.deepEqual(guildRaidSeenCheckpoint(state(2),master,db),state(2)[0]);
  assert.deepEqual(guildRaidSeenCheckpoint(state(1),master,db),state(1)[0]);
  assert.deepEqual(guildRaidSeenCheckpoint(state(0),master,db),state(0)[0]);
  for(const [otherId] of Object.entries(master.guildRaidEvents)) {
    const reset=[{userId:USER_ID,guildRaidId:Number(otherId),readDefeatCount:0}];
    assert.deepEqual(guildRaidSeenCheckpoint(reset,master,db),reset[0]);
    if(Number(otherId)!==raidId) assert.throws(()=>guildRaidSeenCheckpoint([{...reset[0],readDefeatCount:1}],master,db));
  }
  for(const rows of [[],null,[state(0)[0],state(0)[0]],[{...state(0)[0],userId:0}],[{...state(0)[0],extra:0}],
    [{...state(0)[0],guildRaidId:1}],[{...state(0)[0],guildRaidId:0,readDefeatCount:1}],
    ...[-1,0x80000000,1.5,'1',NaN].map(readDefeatCount=>[{...state(0)[0],readDefeatCount}])])
    assert.throws(()=>guildRaidSeenState(rows,master));
  db.prepare('UPDATE guild_raid_scored_completion SET settlement_json=? WHERE operation_id=3').run('{');
  assert.throws(()=>guildRaidSeenCheckpoint(state(1),master,db),/source requires reconciliation/);
  console.log('Original raid seen-marker codec, acknowledged bounds, event changes and retained history: OK');
} finally {db.close();}
