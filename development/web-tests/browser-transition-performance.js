// Run after the representative 35-tower / 100-enemy performance setup.
async page=>{
 const rows=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const settle=()=>page.waitForFunction(()=>!__mindrealm.transitions.active&&!__mindrealm.dialogs.active);
 await settle();if(!await page.evaluate(()=>__mindrealm.getContext().paused))await page.keyboard.press('Space');
 for(const resolution of ['auto','960x540']){
  await page.locator('[data-action="settings"]').click();await settle();
  await page.locator('#resolution-setting').selectOption(resolution);
  await page.locator('[data-action="back"]').click();await settle();
  const result=await page.evaluate(async()=>{
   const q=__mindrealm,frames=[],commits=[],durations=[];
   for(let i=0;i<8;i++){
    let previous=performance.now(),ended=false;
    const ticking=new Promise(resolve=>{function tick(t){if(ended){resolve();return;}frames.push(t-previous);previous=t;requestAnimationFrame(tick);}requestAnimationFrame(tick);});
    const begin=performance.now();document.querySelector(`[data-action="${i%2?'back':'settings'}"]`).click();commits.push(performance.now()-begin);
    await new Promise(resolve=>{function tick(){if(!q.transitions.active)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);});
    durations.push(performance.now()-begin);ended=true;await ticking;
   }
   const summarize=v=>{const s=[...v].sort((a,b)=>a-b);return {mean:v.reduce((a,b)=>a+b,0)/v.length,p95:s[Math.floor(s.length*.95)],max:s.at(-1)};};
   return {frames:summarize(frames.filter(v=>v>0)),commit:summarize(commits),duration:summarize(durations),canvas:[q.field.canvas.width,q.field.canvas.height],units:q.getState().units.length,enemies:q.getState().battle.enemies.length,overlays:document.querySelectorAll('[data-screen-transition],.dialog-exit-layer').length,animations:document.getAnimations().length,locked:document.querySelector('#app').inert,errors:q.snapshot().errors};
  });
  if(result.overlays||result.animations||result.locked||result.errors.length)throw Error('Transition resource leak: '+JSON.stringify(result));
  rows.push({resolution,...result});
 }
 if(errors.length)throw Error(errors.join(';'));
 return {status:'MINDREALM_TRANSITION_PRESSURE_OK',rows,errors};
}
