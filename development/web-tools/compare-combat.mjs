import assert from 'node:assert/strict';
import {resolve,join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import {stepBattle as after} from '../../game/web/core/battle.js';

const argument=name=>process.argv[process.argv.indexOf(name)+1];
if(!process.argv.includes('--baseline'))throw Error('Pass an external preserved checkout with --baseline');
const baseline=resolve(argument('--baseline')),root=resolve(import.meta.dirname,'../..');
if(baseline===root||baseline.startsWith(root+sep))throw Error('Baseline must be outside the current checkout');
const moduleAt=relative=>import(pathToFileURL(join(baseline,relative)));
const [{fixture,place,battle},{enemies},{stepBattle:before}]=await Promise.all([
  moduleAt('development/web-tests/helpers/battle-fixture.mjs'),
  moduleAt('game/web/core/content.js'),moduleAt('game/web/core/battle.js')
]);
// All scenarios use fresh in-memory fixtures, never player saves. Interleave
// timed batches after checking every state and event in all three priorities.

function scenario(priority) {
  const state=fixture();
  state.bandwidth=500;state.spirit=state.maxSpirit=100000;
  for(let i=0;i<35;i++) {
    const type=['pulse_array','phase_blade','frequency_choir','memory_mechanic','bandwidth_relay'][i%5];
    place(state,type,4+(i%7)*4,4+Math.floor(i/7)*4,{tier:3,branch:i%2?'A':'B',h:i%5===0?1:0}).priority=priority;
  }
  battle(state,Array.from({length:100},(_,i)=>Object.keys(enemies)[i%28]));
  for(let i=0;i<state.battle.enemies.length;i++)Object.assign(state.battle.enemies[i],{x:5+(i%10)*3,z:5+Math.floor(i/10)*3,hp:100000,abilityClock:i%5});
  return state;
}
const scenarios=['near','far','hp'].map(scenario);
for(const original of scenarios) {
  const old=structuredClone(original),current=structuredClone(original);
  for(let step=0;step<100;step++) {
    assert.deepEqual(after(current,.05),before(old,.05));
    assert.deepEqual(current,old,`step ${step}`);
  }
}
const samples={before:[],after:[]};
for(let round=0;round<7;round++) {
  const variants=round%2?[['after',after],['before',before]]:[['before',before],['after',after]];
  for(const [name,step] of variants) {
    const states=scenarios.map(s=>structuredClone(s));
    const start=performance.now();
    for(const state of states)for(let i=0;i<100;i++)step(state,.05);
    samples[name].push((performance.now()-start)/300);
  }
}
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const result={equivalentSteps:300,enemies:100,towers:35,medianMsPerStep:{before:median(samples.before),after:median(samples.after)},samples};
if(process.argv.includes('--output')){
  const output=resolve(argument('--output'));
  if(output===root||output.startsWith(root+sep))throw Error('Output belongs outside the checkout');
  await writeFile(output,JSON.stringify(result,null,2));
}
console.log(JSON.stringify(result));
