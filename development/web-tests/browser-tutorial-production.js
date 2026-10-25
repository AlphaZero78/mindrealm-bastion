async sourcePage=>{
 const context=await sourcePage.context().browser().newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const snapshot=()=>page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort(([a],[b])=>a.localeCompare(b))));
 const idle=()=>page.waitForFunction(()=>document.querySelector('#app')&&!document.querySelector('#app').inert&&!document.querySelector('#modal-root').inert);
 try{
  await page.goto('http://127.0.0.1:4206/');await page.locator('[data-action="tutorial"]').waitFor();
  if(await page.evaluate(()=>window.__mindrealm!==undefined))throw Error('Production must not expose QA instrumentation');
  await page.evaluate(async()=>{
   const R=await import('/web/core/state.js'),S=await import('/web/core/save.js'),store=S.createSaveStore(localStorage);
   if(!store.save(R.newRun('production-tutorial-preserve')).ok)throw Error('Fixture save failed');
   const profile=store.loadProfile();profile.fragments=53;store.saveProfile(profile);store.saveSettings({...store.loadSettings(),reducedMotion:false});
   localStorage.setItem('unrelated-fixture-key','keep');
  });
  await page.reload();await page.locator('[data-action="tutorial"]').waitFor();await idle();const before=await snapshot();
  await page.locator('[data-action="tutorial"]').click();await page.locator('[data-tutorial-step="intro"]').waitFor();await idle();
  await page.locator('[data-tutorial-action="next"]').click();await page.locator('[data-tutorial-step="deploy-melee"]').waitFor();await idle();
  await page.locator('[data-action="settings"]').click();await idle();await page.locator('[data-action="motion-setting"]').check();
  await page.locator('[data-action="back"]').click();await idle();await page.locator('[data-tutorial-action="exit"]').click();await idle();
  if(before!==await snapshot())throw Error('Tutorial changed production storage');
  if(!await page.locator('[data-action="continue"]').isEnabled())throw Error('Continue was lost');
  await page.locator('[data-action="continue"]').click();await page.locator('.nexus-room').waitFor();
  const restored=await page.evaluate(async()=>{const S=await import('/web/core/save.js'),store=S.createSaveStore(localStorage);return{seed:store.load().state.seed,fragments:store.loadProfile().fragments,reducedMotion:store.loadSettings().reducedMotion,unrelated:localStorage.getItem('unrelated-fixture-key')};});
  if(restored.seed!=='production-tutorial-preserve'||restored.fragments!==53||restored.reducedMotion!==false||restored.unrelated!=='keep'||errors.length)throw Error(JSON.stringify({restored,errors}));
  return{status:'PRODUCTION_TUTORIAL_STORAGE_OK',storageUnchanged:true,restored,errors};
 }finally{await context.close();}
}
