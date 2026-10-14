'use strict';
// DEFERRED / NOT RUN: execute only after all packet implementation is finished.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer}=require('./danmemore_server.cjs'),{request}=require('./test_danmemore_server.cjs');
const seed=require('../data/danmemore-seed.json'),master=require('../data/danmemore-master.json');

async function main(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'danmemore-gvg-vote-')),database=path.join(directory,'profile.sqlite'),
    [gvgId,event]=Object.entries(master.guildVsGuild).find(([,row])=>row.type===1),firstFamilia=900000001,secondFamilia=900000002;
  let now=event.preparationStartAt,sequence=0,app,port;
  const vote=(value,id=++sequence)=>request(port,id,value,String(id),'gvg/tournament/vote'),
    get=(id=++sequence)=>request(port,id,{gvgId:Number(gvgId)},String(id),'gvg/tournament/get'),
    parse=response=>{assert.equal(response.status,200,response.body.toString());return JSON.parse(response.body);},
    snapshot=()=>JSON.stringify({
      days:app.store.db.prepare('SELECT * FROM gvg_tournament_vote_day ORDER BY day').all(),
      votes:app.store.db.prepare('SELECT * FROM gvg_tournament_vote ORDER BY familia_id').all(),
      requests:app.store.db.prepare('SELECT * FROM gvg_tournament_vote_request ORDER BY request_key').all(),
      profiles:app.store.db.prepare('SELECT * FROM profile ORDER BY name').all(),
    });
  try{
    app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
    const body={gvgId:Number(gvgId),familiaId:firstFamilia,voteCount:2},initialSequence=++sequence;
    assert.deepEqual(parse(await get(initialSequence)).user.voteTicketCount,5);
    const before=snapshot();
    for(const bad of [null,{},[],{...body,extra:1},{...body,gvgId:0},{...body,familiaId:0},{...body,voteCount:0},
      {...body,gvgId:String(gvgId)},{...body,familiaId:1.5},{...body,voteCount:'2'}]) {
      assert.equal((await vote(bad)).status,400);assert.equal(snapshot(),before);
    }
    for(const table of ['gvg_tournament_vote_day','gvg_tournament_vote','gvg_tournament_vote_request','reply_cache']) {
      app.store.db.exec(`CREATE TRIGGER fail_gvg_vote BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'vote rollback'); END`);
      assert.equal((await vote(body)).status,503);assert.equal(snapshot(),before);
      app.store.db.exec('DROP TRIGGER fail_gvg_vote');
    }
    const firstId=++sequence,first={code:0,user:{voteTicketCount:3},
      familias:[{familiaId:firstFamilia,userVoteCount:2}]};
    assert.deepEqual(parse(await vote(body,firstId)),first);
    assert.deepEqual(parse(await vote(body,firstId)),first,'Exact wire retry must not spend twice');
    assert.equal((await vote({...body,voteCount:1},firstId)).status,400,'The same request identity cannot change');
    assert.equal((await get(initialSequence)).status,503,'Cached pre-vote view cannot restore five tickets');
    const secondId=++sequence,second={code:0,user:{voteTicketCount:0},
      familias:[{familiaId:firstFamilia,userVoteCount:5}]};
    assert.deepEqual(parse(await vote({...body,voteCount:3},secondId)),second);
    assert.equal((await vote({...body,familiaId:secondFamilia,voteCount:1})).status,400,'Daily tickets cannot overdraw');
    assert.equal(parse(await get()).user.voteTicketCount,0);
    now+=86400;
    assert(now<=event.battleEndAt,'Fixture must retain a second tournament voting day');
    const nextView=parse(await get());assert.equal(nextView.user.voteTicketCount,5);assert.equal(nextView.user.canVote,true);
    const nextId=++sequence,next={code:0,user:{voteTicketCount:0},
      familias:[{familiaId:secondFamilia,userVoteCount:5}]};
    assert.deepEqual(parse(await vote({...body,familiaId:secondFamilia,voteCount:5},nextId)),next);
    assert.deepEqual(app.store.db.prepare('SELECT familia_id,user_vote_count FROM gvg_tournament_vote ORDER BY familia_id').all(),
      [{familia_id:firstFamilia,user_vote_count:5},{familia_id:secondFamilia,user_vote_count:5}]);
    const persisted=snapshot();await app.close();app=null;
    app=createServer({database,seed,master,wallNowSeconds:()=>now,log:()=>{}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));port=app.server.address().port;
    assert.equal(snapshot(),persisted,'Restart must preserve vote totals, daily use and profiles');
    assert.deepEqual(parse(await vote(body,firstId)),first,'Old exact retry returns its original response without another spend');
    assert.deepEqual(parse(await vote({...body,familiaId:secondFamilia,voteCount:5},nextId)),next);
    assert.equal(parse(await get()).user.voteTicketCount,0);
    now=event.battleEndAt+1;
    const ended=parse(await get());assert.equal(ended.user.canVote,false);assert.equal(ended.user.voteTicketCount,5);
    assert.equal((await vote({...body,familiaId:secondFamilia,voteCount:1})).status,400);
  } finally {if(app)await app.close();fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
