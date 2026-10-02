// Run after browser-perf-clarity-setup.js. Returns metrics; the CLI caller
// chooses a report path outside the repository and records concurrent load.
async page => {
  await page.evaluate(()=>{if(!location.search.includes('qa=1')||!window.__clarityPerf)throw Error('Run the isolated QA setup first');});
  if(await page.evaluate(()=>window.__mindrealm.getContext().paused))await page.keyboard.press('Space');
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,750)));
  const graphics=await page.evaluate(async()=>{const perf=window.__clarityPerf;perf.begin();const intervals=[];let previous=0;await new Promise(resolve=>{function tick(time){if(previous)intervals.push(time-previous);previous=time;if(intervals.length>=1000)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);});const result=perf.finish(),slowest=[...intervals].sort((a,b)=>b-a).slice(0,Math.ceil(intervals.length*.01));return {...result,low1Fps:1000/(slowest.reduce((a,b)=>a+b,0)/slowest.length),p99EquivalentFps:result.low1Fps,low1Definition:'reciprocal mean of the slowest 1% of RAF intervals'};});
  await page.keyboard.press('Space');
  const logic=await page.evaluate(()=>window.__clarityPerf.logic());
  return {scenario:'35 towers, 100 enemies including six bosses, four entrances, held E and terrain invalidation 4 Hz; fixed hp and enemy speed for stable rendering load',parallelLoad:'Not inferred by the browser; record concurrent workloads with the results',graphics,logic,consoleErrors:await page.evaluate(()=>window.__mindrealm.snapshot().errors)};
}
