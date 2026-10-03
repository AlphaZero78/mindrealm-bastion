import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runReference} from '../web-tests/helpers/reference-strategy.mjs';
import {defensiveHooks} from '../web-tests/helpers/defensive-strategy.mjs';

// Paired runs use identical seeds and decision policies. Revision is the only
// difference in the baseline pair; additions to the content pool are shared.
if(!isMainThread){
 try{const job=workerData,{state,battles}=runReference(job.seed,{...job.options,...(job.policy==='defensive'?{hooks:defensiveHooks}: {})});
  parentPort.postMessage({...job,result:state.phase,completed:state.stats.completedNodes,act:state.act+1,floor:state.floor+1,depth:state.depth,spirit:state.spirit,breaches:state.stats.breaches,damage:state.stats.breachDamage+state.stats.pressure,items:state.stats.itemsUsed||0,elites:state.stats.elites,bosses:state.stats.bosses,first:battles[0],bossBattles:battles.filter(b=>b.type==='boss'),battles});
 }catch(error){parentPort.postMessage({...workerData,error:error.stack});}
}else{
 const count=process.argv.includes('--quick')?4:20;
 const files=['content.js','difficulty.js','rules.js','state.js','battle.js','inventory.js','item-content.js','extra-events.js'].map(f=>new URL(`../../web/core/${f}`,import.meta.url));
 files.push(new URL('../web-tests/helpers/reference-strategy.mjs',import.meta.url),new URL('../web-tests/helpers/defensive-strategy.mjs',import.meta.url));
 const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');const hashes=await Promise.all(files.map(hash));
 const jobs=[];for(let i=0;i<count;i++)for(const revision of [2,3])jobs.push({seed:`balance-${i}`,group:revision===2?'previous':'current',options:{revision}});
 for(let i=0;i<Math.max(4,count/2);i++)for(const strategy of ['empty','opening'])jobs.push({seed:`underbuilt-${i}`,group:strategy,options:{strategy}});
 for(const pressure of [2,5,8,10])for(let i=0;i<3;i++)jobs.push({seed:`pressure-${i}`,group:`pressure-${pressure}`,options:{pressure}});
 for(let i=0;i<4;i++)jobs.push({seed:`defensive-${i}`,group:'defensive',policy:'defensive',options:{strategy:'defensive'}});
 let cursor=0;const results=[];
 const work=async()=>{while(cursor<jobs.length){const job=jobs[cursor++],result=await new Promise((resolve,reject)=>{const worker=new Worker(new URL(import.meta.url),{workerData:job});let received=false;worker.once('message',value=>{received=true;resolve(value);});worker.once('error',reject);worker.once('exit',code=>{if(!received)reject(Error(`No worker result: ${code}`));});});results.push(result);console.log(JSON.stringify({progress:`${results.length}/${jobs.length}`,group:result.group,seed:result.seed,result:result.result,depth:result.depth,damage:Math.round(result.damage||0),error:result.error}));}};
 await Promise.all([work(),work()]);
 const changed=[];for(let i=0;i<files.length;i++)if(await hash(files[i])!==hashes[i])changed.push(files[i].pathname);
 const mean=list=>list.length?list.reduce((a,b)=>a+b,0)/list.length:0;
 const groups=Object.fromEntries([...new Set(results.map(r=>r.group))].map(group=>{const runs=results.filter(r=>r.group===group);return[group,{total:runs.length,wins:runs.filter(r=>r.result==='won').length,losses:runs.filter(r=>r.result==='lost').length,meanDamage:mean(runs.map(r=>r.damage)),meanDepth:mean(runs.map(r=>r.depth)),meanItems:mean(runs.map(r=>r.items)),firstDepth:mean(runs.map(r=>r.first?.depth||1)),bossDepth:[0,1,2].map(act=>mean(runs.flatMap(r=>r.bossBattles?.filter(b=>b.act===act).map(b=>b.depth)||[])))}];}));
 const failures=results.filter(r=>r.error||!['won','lost'].includes(r.result)||r.result==='won'&&(r.completed!==48||r.bosses.length!==3));
 const report={ok:!failures.length&&!changed.length,groups,changed,failures,hashes:Object.fromEntries(files.map((f,i)=>[f.pathname,hashes[i]])),results};
 const output=process.argv.indexOf('--output');if(output>=0)await writeFile(process.argv[output+1],JSON.stringify(report,null,2));
 console.log(`BALANCE_SWEEP ${JSON.stringify({ok:report.ok,groups,changed,failures})}`);if(!report.ok)process.exitCode=1;
}
