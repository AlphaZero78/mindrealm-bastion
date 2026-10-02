import assert from 'node:assert/strict';
import {resolve,join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import * as Rules from '../../web/core/rules.js';
import * as Content from '../../web/core/content.js';
import {runReference} from '../web-tests/helpers/reference-strategy.mjs';

const argument=name=>process.argv[process.argv.indexOf(name)+1];
if(!process.argv.includes('--baseline'))throw Error('Pass an external preserved checkout with --baseline');
const baseline=resolve(argument('--baseline')),root=resolve(import.meta.dirname,'../..');
if(baseline===root||baseline.startsWith(root+sep))throw Error('Baseline must be outside the current checkout');
const moduleAt=relative=>import(pathToFileURL(join(baseline,relative)));
const [Old,OldRun,OldContent,OldStrategy]=await Promise.all([moduleAt('web/core/rules.js'),moduleAt('web/core/state.js'),moduleAt('web/core/content.js'),moduleAt('development/web-tests/helpers/reference-strategy.mjs')]);
const random=Content.seededRandom('optimization-equivalence'),state=OldRun.newRun('optical-differential');let attacks=0,effects=0;
for(const type of Object.keys(Content.towers))for(const [tier,branch]of [[1,null],[2,'A'],[2,'B'],[3,'A'],[3,'B']])for(let rotation=0;rotation<4;rotation++){
 const unit={uid:'u1',type,tier,branch,rotation,x:5+Math.floor(random()*25),z:5+Math.floor(random()*25),hp:20,priority:'hp'};state.units=[unit];
 state.relics=Object.keys(Content.relics).filter(()=>random()<.2);state.talents=Object.keys(Content.talents).filter(()=>random()<.2);state.spirit=[20,34,35,40,100][rotation];state.modifiers={range:.12,height_bonus:.03,armor_pierce:.1};
 assert.deepEqual(Content.effects(state),OldContent.effects(state));effects++;
 for(let i=0;i<40;i++){const target={x:random()*40,z:random()*40,h:i%5,air:!!(i%2),hp:15,maxHp:100,armor:i%12};assert.deepEqual(Rules.solveAttack(state,unit,target),Old.solveAttack(state,unit,target));attacks++;}
}
const normalize=value=>JSON.parse(JSON.stringify(value,(key,value)=>key==='runId'?undefined:value));
const runs=[];
for(const pressure of [0,5,10])for(const seed of ['reference-0','reference-2']){
 const before=OldStrategy.runReference(seed,{pressure}),after=runReference(seed,{pressure});
 assert.deepEqual(normalize(after),normalize(before));runs.push({seed,pressure,result:after.state.phase,nodes:after.state.stats.completedNodes,battles:after.battles.length});
}
const result={status:'CORE_EQUIVALENCE_OK',attacks,effects,runs};
if(process.argv.includes('--output')){const output=resolve(argument('--output'));if(output===root||output.startsWith(root+sep))throw Error('Output belongs outside the checkout');await writeFile(output,JSON.stringify(result,null,2));}
console.log(JSON.stringify(result));
