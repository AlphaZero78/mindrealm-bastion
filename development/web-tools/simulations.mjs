import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {runReference} from '../web-tests/helpers/reference-strategy.mjs';

// No persistent game storage is imported. All scenarios start with fresh memory.
if(!isMainThread){
  try{
    const started=performance.now(),{state,battles}=runReference(workerData.seed,workerData.options);
    parentPort.postMessage({seed:workerData.seed,kind:workerData.kind,strategy:workerData.options.strategy||'reference',pressure:workerData.options.pressure||0,result:state.phase,act:state.act+1,floor:state.floor+1,completedNodes:state.stats.completedNodes,battles:battles.length,bosses:state.stats.bosses,nexus:state.nexus.map(r=>({messenger:r.messenger,choice:r.choice})),spirit:state.spirit,seconds:(performance.now()-started)/1000});
  }catch(error){parentPort.postMessage({seed:workerData.seed,kind:workerData.kind,error:error.stack});}
}else{
  const quick=process.argv.includes('--quick'),refs=quick?2:20,scenarios=quick?5:100;
  const hash=async path=>createHash('sha256').update(await readFile(new URL(path,import.meta.url))).digest('hex');
  const files=['../../game/web/core/content.js','../../game/web/core/state.js','../../game/web/core/rules.js','../../game/web/core/battle.js','../../game/web/core/difficulty.js','../../game/web/core/extra-events.js','../../game/web/core/inventory.js','../../game/web/core/item-content.js','../../game/web/core/nexus-content.js','../../game/web/core/world.js','../../game/web/core/event-balance.js','../../game/web/core/event-stories.js','../../game/web/core/enemy-expansion.js','../../game/web/core/tower-text.js','../../game/web/core/unit-details.js','../web-tests/helpers/reference-strategy.mjs'];
  const hashes=Object.fromEntries(await Promise.all(files.map(async p=>[p,await hash(p)])));
  const jobs=[...Array.from({length:refs},(_,i)=>({seed:`reference-${i}`,kind:'reference',options:{}})),...Array.from({length:scenarios},(_,i)=>({seed:`terminal-${i}`,kind:'terminal',options:{pressure:i%11,strategy:i%5===0?'empty':i%5===1?'opening':'reference'}}))];
  const started=performance.now(),results=[];let cursor=0;
  const work=async()=>{while(cursor<jobs.length){const job=jobs[cursor++];const result=await new Promise((resolve,reject)=>{const worker=new Worker(new URL(import.meta.url),{workerData:job});let received=false;worker.once('message',message=>{received=true;resolve(message);});worker.once('error',reject);worker.once('exit',code=>{if(!received)reject(new Error(`Worker exited without result (${code})`));});});results.push(result);console.log(JSON.stringify({progress:`${results.length}/${jobs.length}`,...result}));}};
  // Two workers leave CPU capacity for browser rendering and interactive QA.
  await Promise.all([work(),work()]);
  const failures=results.filter(r=>r.error||!['won','lost'].includes(r.result)||r.result==='won'&&(r.completedNodes!==48||r.bosses.length!==3));
  if(!results.some(r=>r.kind==='reference'&&r.result==='won'))failures.push({error:'No standard reference run completed the full campaign'});
  const changed=files.filter(p=>hashes[p]===undefined);for(const p of files)if(await hash(p)!==hashes[p])changed.push(p);
  const summary={ok:failures.length===0&&changed.length===0,referenceWins:results.filter(r=>r.kind==='reference'&&r.result==='won').length,referenceTotal:refs,terminalWins:results.filter(r=>r.kind==='terminal'&&r.result==='won').length,terminalLosses:results.filter(r=>r.kind==='terminal'&&r.result==='lost').length,terminalTotal:scenarios,emptyLosses:results.filter(r=>r.strategy==='empty'&&r.result==='lost').length,bossesSeen:[...new Set(results.flatMap(r=>r.bosses||[]))],seconds:(performance.now()-started)/1000,hashes,changed,failures,results};
  const output=process.argv.indexOf('--output');if(output>=0)await writeFile(process.argv[output+1],JSON.stringify(summary,null,2));
  console.log(`WEB_SIMULATIONS ${JSON.stringify({...summary,results:undefined})}`);if(!summary.ok)process.exitCode=1;
}
