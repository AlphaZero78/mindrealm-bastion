import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {runReference} from '../web-tests/helpers/reference-strategy.mjs';
import {defensiveHooks} from '../web-tests/helpers/defensive-strategy.mjs';
import {newRun} from '../../game/web/core/state.js';
import {makeEncounter} from '../../game/web/core/battle.js';
import {onField,bandwidthState} from '../../game/web/core/rules.js';
import {towers} from '../../game/web/core/content.js';

// Fresh newRun instances only. Never import save.js or access player storage.
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const SOURCE_FILES=['game/web/core/content.js','game/web/core/state.js','game/web/core/rules.js','game/web/core/battle.js','game/web/core/difficulty.js','development/web-tests/helpers/reference-strategy.mjs','development/web-tests/helpers/defensive-strategy.mjs'];
const round=value=>Math.round((Number(value)||0)*100)/100;
const sum=(items,key)=>items.reduce((total,item)=>total+(Number(item[key])||0),0);
const count=items=>Object.fromEntries([...new Set(items)].sort().map(item=>[item,items.filter(value=>value===item).length]));
const statKeys=['kills','breaches','pressure','breachDamage','eventDamage','destroyed','overloadSeconds'];
const statsOf=state=>Object.fromEntries(statKeys.map(key=>[key,state.stats[key]||0]));
const delta=(current,previous)=>Object.fromEntries(statKeys.map(key=>[key,current[key]-(previous[key]||0)]));
const damageLeaders=state=>Object.entries(state.stats.damageByUnit).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([uid,damage])=>{const unit=state.units.find(u=>u.uid===uid);return {uid,type:unit?.type,name:state.unitOrigins?.[uid]?.name||towers[unit?.type]?.name,damage:round(damage)};});
const buildOf=state=>({deployed:count(state.units.filter(u=>onField(u)&&u.hp>0).map(u=>`${u.type}:T${u.tier}${u.branch||''}`)),bandwidth:bandwidthState(state),safeBandwidth:bandwidthState({...state,battle:null}),relics:[...state.relics],talents:[...state.talents],damageLeaders:damageLeaders(state)});

function measureRun({seed,level,strategy}){
  const started=performance.now(),battles=[],acts=Array.from({length:3},(_,index)=>({act:index+1,battles:0,spiritLoss:0,kills:0,breaches:0,pressure:0,breachDamage:0,eventDamage:0,destroyed:0,overloadSeconds:0,plannedEnemies:0,spawnedEnemies:0,reinforcements:0,combatSeconds:0}));
  let previous=Object.fromEntries(statKeys.map(key=>[key,0]));
  const {state}=runReference(seed,{pressure:level,strategy,hooks:strategy==='defensive'?defensiveHooks:{},onNode:(current,record)=>{
    const b=current.battle,currentStats=statsOf(current),change=delta(currentStats,previous),act=acts[record.act];previous=currentStats;
    const result={act:record.act+1,floor:record.floor+1,node:current.currentNode?.id,type:record.type,result:record.result,seconds:round(b.time),initialSpirit:round(b.initialSpirit),spiritBeforeReward:round(record.spirit),spiritAfterReward:round(current.spirit),spiritLoss:round(b.spiritLost),...Object.fromEntries(Object.entries(change).map(([key,value])=>[key,round(value)])),plannedEnemies:b.total,spawnedEnemies:b.spawned+b.reinforcements,reinforcements:b.reinforcements,reinforcementBudget:b.reinforcementBudget,maxActive:b.maxActive,enemyComposition:count(b.queue.map(enemy=>enemy.type)),groups:b.groups.length,entries:b.entries.map(entry=>({id:entry.id,count:entry.count})),deployed:record.units,focus:round(record.focus)};
    battles.push(result);act.battles++;act.spiritLoss+=b.spiritLost;for(const key of statKeys)act[key]+=change[key];for(const key of ['plannedEnemies','spawnedEnemies','reinforcements'])act[key]+=result[key];act.combatSeconds+=b.time;
    act.finalSpirit=round(current.spirit);act.maxSpirit=current.maxSpirit;act.depth=current.depth;act.resistance=current.resistance;act.focus=round(current.focus);act.reachedFloor=record.floor+1;act.build=buildOf(current);
  }});
  // A service event can end the run without another battle callback.
  const remainder=delta(statsOf(state),previous),lastAct=acts[state.act];for(const key of statKeys)lastAct[key]+=remainder[key];lastAct.finalSpirit=round(state.spirit);lastAct.maxSpirit=state.maxSpirit;lastAct.depth=state.depth;lastAct.resistance=state.resistance;lastAct.focus=round(state.focus);lastAct.reachedFloor=state.floor+1;lastAct.build=buildOf(state);
  for(const act of acts){act.totalSpiritDamage=round(act.pressure+act.breachDamage+act.eventDamage);for(const key of Object.keys(act))if(typeof act[key]==='number')act[key]=round(act[key]);}
  return {seed,level,strategy,difficultyRevision:state.difficultyRevision??1,result:state.phase,reached:{act:state.act+1,floor:state.floor+1,completedNodes:state.stats.completedNodes},bosses:[...state.stats.bosses],spirit:round(state.spirit),maxSpirit:state.maxSpirit,focus:round(state.focus),depth:state.depth,...Object.fromEntries(Object.entries(statsOf(state)).map(([key,value])=>[key,round(value)])),plannedEnemies:sum(battles,'plannedEnemies'),spawnedEnemies:sum(battles,'spawnedEnemies'),reinforcements:sum(battles,'reinforcements'),battleCount:battles.length,combatSeconds:round(sum(battles,'seconds')),meanBattleSeconds:round(sum(battles,'seconds')/Math.max(1,battles.length)),maxBattleSeconds:Math.max(0,...battles.map(b=>b.seconds)),maxActive:Math.max(0,...battles.map(b=>b.maxActive)),route:[...state.visited],build:buildOf(state),acts,battles,wallSeconds:round((performance.now()-started)/1000)};
}

function encounterInventory(seed,level){
  const state=newRun(seed,level),inventory={};
  for(let act=0;act<state.maps.length;act++)for(const node of state.maps[act].nodes){
    if(!['battle','elite','boss'].includes(node.type))continue;
    const encounter=makeEncounter({...state,act,floor:node.floor,currentNode:node},node);
    inventory[`${act+1}:${node.id}`]={total:encounter.total,groups:encounter.groups.length,reinforcementBudget:encounter.reinforcementBudget,entries:encounter.entries.map(entry=>({id:entry.id,count:entry.count}))};
  }
  return inventory;
}

function parseArguments(args){
  const options={levels:'0-10',seeds:'reference-0,reference-1,reference-2',strategy:'reference',workers:'2'};
  for(let i=0;i<args.length;i++){
    const key=args[i].replace(/^--/,'');if(key==='help')return {help:true};
    if(!['levels','seeds','strategy','workers','output'].includes(key)||!args[i].startsWith('--')||!args[i+1]||args[i+1].startsWith('--'))throw Error(`Invalid argument ${args[i]}; use --help`);
    options[key]=args[++i];
  }
  const levels=options.levels.split(',').flatMap(part=>{const match=/^(\d+)(?:-(\d+))?$/.exec(part.trim());if(!match)throw Error('Levels must be comma-separated integers or ranges, e.g. 0,5,10 or 0-10');const low=Number(match[1]),high=Number(match[2]??match[1]);if(low<0||high>10||low>high)throw Error('Levels must be from 0 to 10');return Array.from({length:high-low+1},(_,i)=>low+i);});
  const seeds=options.seeds.split(',').map(seed=>seed.trim());if(seeds.some(seed=>!seed))throw Error('Seeds cannot be empty');
  if(!['reference','defensive','opening','empty'].includes(options.strategy))throw Error('Strategy must be reference, defensive, opening or empty');
  const workers=Number(options.workers);if(!Number.isInteger(workers)||workers<1||workers>4)throw Error('Workers must be from 1 to 4');
  return {...options,levels:[...new Set(levels)],seeds:[...new Set(seeds)],workers};
}

const inside=(root,target)=>{const relative=path.relative(root,target);return relative===''||(!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative));};
async function outputPath(value){
  if(!value)return null;const target=path.resolve(value),root=await realpath(ROOT);
  if(inside(root,target))throw Error('Reports must be written outside the repository');
  let existing=target;while(true){try{const resolved=await realpath(existing);if(inside(root,resolved))throw Error('Report path resolves inside the repository');break;}catch(error){if(error.code!=='ENOENT')throw error;const parent=path.dirname(existing);if(parent===existing)throw error;existing=parent;}}
  await mkdir(path.dirname(target),{recursive:true});return target;
}
async function sourceHashes(){return Object.fromEntries(await Promise.all(SOURCE_FILES.map(async file=>{try{return [file,createHash('sha256').update(await readFile(path.join(ROOT,file))).digest('hex')];}catch(error){if(file==='game/web/core/difficulty.js'&&error.code==='ENOENT')return [file,null];throw error;}})));}

async function main(){
  const options=parseArguments(process.argv.slice(2));if(options.help){console.log('node development/web-tools/difficulty-sweep.mjs --levels 0,5,10 --seeds reference-0,reference-1,reference-2 --strategy reference --workers 2 --output <file outside repository>\nDefaults: levels 0-10; three reference seeds; strategy reference. Strategies: reference, defensive, opening, empty. All runs are fresh in-memory states. Difficulty may change route decisions and actual reinforcements; count invariants compare the same planned node.');return;}
  const output=await outputPath(options.output),hashes=await sourceHashes(),started=performance.now(),countMismatches=[];let countChecks=0;
  for(const seed of options.seeds){const baseline=encounterInventory(seed,options.levels[0]);for(const level of options.levels.slice(1)){const inventory=encounterInventory(seed,level),keys=new Set([...Object.keys(baseline),...Object.keys(inventory)]);for(const node of keys){countChecks++;if(JSON.stringify(baseline[node])!==JSON.stringify(inventory[node]))countMismatches.push({seed,baselineLevel:options.levels[0],level,node,baseline:baseline[node],actual:inventory[node]});}}}
  const jobs=options.seeds.flatMap(seed=>options.levels.map(level=>({seed,level,strategy:options.strategy}))),results=[];let cursor=0;
  const work=async()=>{while(cursor<jobs.length){const job=jobs[cursor++];const result=await new Promise(resolve=>{const worker=new Worker(new URL(import.meta.url),{workerData:job});let done=false;const settle=value=>{if(!done){done=true;resolve(value);}};worker.once('message',settle);worker.once('error',error=>settle({...job,error:error.stack}));worker.once('exit',code=>{if(!done)settle({...job,error:`Worker exited without result (${code})`});});});results.push(result);console.log(JSON.stringify({progress:`${results.length}/${jobs.length}`,seed:result.seed,level:result.level,result:result.result,reached:result.reached,battles:result.battleCount,spirit:result.spirit,pressure:result.pressure,breachDamage:result.breachDamage,breaches:result.breaches,destroyed:result.destroyed,plannedEnemies:result.plannedEnemies,meanBattleSeconds:result.meanBattleSeconds,wallSeconds:result.wallSeconds,error:result.error}));}};
  await Promise.all(Array.from({length:Math.min(options.workers,jobs.length)},work));results.sort((a,b)=>options.seeds.indexOf(a.seed)-options.seeds.indexOf(b.seed)||a.level-b.level);
  const after=await sourceHashes(),changed=SOURCE_FILES.filter(file=>hashes[file]!==after[file]),failures=results.filter(result=>result.error||!['won','lost'].includes(result.result));
  // Played unknown nodes are also compared whenever the same seed reaches them.
  const matched=new Map();for(const result of results)for(const battle of result.battles||[]){const key=`${result.seed}:${battle.act}:${battle.node}`,value=JSON.stringify({total:battle.plannedEnemies,groups:battle.groups,entries:battle.entries,reinforcementBudget:battle.reinforcementBudget});if(matched.has(key)){countChecks++;if(matched.get(key).value!==value)countMismatches.push({seed:result.seed,level:result.level,node:battle.node,baselineLevel:matched.get(key).level,actual:JSON.parse(value),baseline:JSON.parse(matched.get(key).value)});}else matched.set(key,{level:result.level,value});}
  const byLevel=options.levels.map(level=>{const runs=results.filter(result=>result.level===level&&!result.error),wins=runs.filter(result=>result.result==='won').length;return {level,runs:runs.length,wins,losses:runs.length-wins,winRate:round(wins/Math.max(1,runs.length)),meanCompletedNodes:round(runs.reduce((total,result)=>total+result.reached.completedNodes,0)/Math.max(1,runs.length)),meanSpiritDamage:round(runs.reduce((total,result)=>total+result.pressure+result.breachDamage+result.eventDamage,0)/Math.max(1,runs.length)),meanBreaches:round(sum(runs,'breaches')/Math.max(1,runs.length)),meanDestroyed:round(sum(runs,'destroyed')/Math.max(1,runs.length)),meanBattleSeconds:round(sum(runs,'combatSeconds')/Math.max(1,sum(runs,'battleCount')))};});
  const summary={ok:!failures.length&&!changed.length&&!countMismatches.length,options:{...options,output},metricNotes:{spiritLoss:'Battle damage ledger before healing, including possible lethal overkill; not start-minus-end spirit.',totalSpiritDamage:'Pressure plus breach and event damage; healing is tracked separately by spirit snapshots.',enemyCounts:'plannedEnemies is the scheduled queue; spawnedEnemies adds actual bounded reinforcements. Full-run totals may differ because routes or survival differ.',invariants:'Every known combat node in each seeded map, plus matched played nodes, has the same planned total, group count, entrance allocation and reinforcement budget across selected difficulties.'},seconds:round((performance.now()-started)/1000),hashes,changed,countChecks,countMismatches,failures,byLevel,results};
  if(output)await writeFile(output,JSON.stringify(summary,null,2));console.log(`DIFFICULTY_SWEEP ${JSON.stringify({...summary,results:undefined})}`);if(!summary.ok)process.exitCode=1;
}

if(!isMainThread){try{parentPort.postMessage(measureRun(workerData));}catch(error){parentPort.postMessage({...workerData,error:error.stack});}}
else main().catch(error=>{console.error(`DIFFICULTY_SWEEP_ERROR ${error.message}`);process.exitCode=1;});
