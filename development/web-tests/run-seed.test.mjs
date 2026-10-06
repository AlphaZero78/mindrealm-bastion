import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunSeed,RUN_SEED_LENGTH} from '../../game/web/run-seed.js';
import * as Run from '../../game/web/core/state.js';
import {createSaveStore} from '../../game/web/core/save.js';

// Save bookkeeping adds a unique run ID and clears transient battle snapshots.
const replayable=({runId,battle,preBattle,...state})=>state;

test('fresh default seeds are sixteen mixed alphanumeric characters and vary within one moment',()=>{
 const seeds=Array.from({length:1000},()=>createRunSeed());
 assert.equal(RUN_SEED_LENGTH,16);
 for(const seed of seeds){assert.match(seed,/^[A-Za-z0-9]{16}$/);assert.match(seed,/[A-Za-z]/);assert.match(seed,/[0-9]/);}
 assert.equal(new Set(seeds).size,seeds.length);
});

test('seed generation rejects biased byte values and retries a single-class candidate',()=>{
 let calls=0;
 const seed=createRunSeed(values=>{
  calls++;
  if(calls===1)values.fill(255); // Rejected bytes must not become repeated characters.
  else if(calls===2)values.fill(0); // All letters must be retried.
  else if(calls===3)values.fill(52); // All digits must be retried.
  else values.set(Array.from({length:values.length},(_,i)=>i%2?52:0));
 });
 assert.equal(calls,4);assert.equal(seed,'A0A0A0A0A0A0A0A0');
});

test('generated and manually supplied seeds reproduce routes, terrain and pending gifts across saves',()=>{
 const data=new Map(),store=createSaveStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},'random-seed.test');
 for(const seed of [createRunSeed(),'2026-10-05','CLEAR-SIGNAL','自定种子-A19']){
  const first=Run.newRun(seed),second=Run.newRun(seed);
  assert.deepEqual(first,second);
  assert.equal(store.save(first).ok,true);assert.deepEqual(replayable(store.load().state),replayable(first));
  Run.chooseNexus(first,first.nexus[0].options[0]);Run.chooseNexus(second,second.nexus[0].options[0]);
  Run.enterNode(first,first.nextNodes[0]);Run.enterNode(second,second.nextNodes[0]);
  Run.finishBattle(first,{won:true});Run.finishBattle(second,{won:true});
  assert.deepEqual(replayable(first),replayable(second));assert.equal(store.save(first).ok,true);assert.deepEqual(replayable(store.load().state),replayable(first));
 }
});
