async page=>{
 const url=new URL(page.url());if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port==='4173'||url.searchParams.get('qa')!=='1')throw Error('Requires isolated QA port and storage');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.reload();await page.waitForFunction(()=>window.__mindrealm);
 await page.evaluate(()=>{const q=window.__mindrealm;q.getSettings().reducedMotion=true;q.getSettings().tutorial=false;q.newRun('existing-manual-save');});
 const idle=()=>page.waitForFunction(()=>{const q=window.__mindrealm;return !q.transitions.active&&!q.dialogs.active;});
 const click=async selector=>{await idle();await page.locator(selector).click();await idle();};
 const valid=seed=>/^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{16}$/.test(seed);
 const readSeed=()=>page.locator('#seed-input').inputValue();
 const open=async()=>{if(await page.locator('[data-action="menu"]').count())await click('[data-action="menu"]');await click('[data-action="new"]');};
 const current=()=>page.evaluate(()=>JSON.stringify(window.__mindrealm.getState()));
 const fingerprint=()=>page.evaluate(()=>{const {runId,battle,preBattle,...state}=window.__mindrealm.getState();return JSON.stringify(state);});
 const original=await current(),defaults=[];
 await open();defaults.push(await readSeed());
 if(!(await page.locator('.difficulty-preview-info').innerText()).includes('标准难度'))throw Error('Standard difficulty explanation is empty');
 await page.locator('.modal-body details summary').click();
 const preview=page.locator('[data-pressure-preview="10"]');await preview.scrollIntoViewIfNeeded();const previewBefore=await preview.boundingBox();await preview.hover();
 await page.waitForFunction(()=>document.querySelector('.difficulty-preview-info').textContent.includes('控制压力 10'));
 const previewAfter=await preview.boundingBox();if(Math.abs(previewBefore.y-previewAfter.y)>1)throw Error('Difficulty preview moves its hover target');
 if(await page.locator('#pressure-input').inputValue()!=='0')throw Error('Locked difficulty preview changes selected pressure');
 await page.locator('#seed-input').hover();await page.locator('.modal-body details summary').click();
 for(let i=0;i<2;i++){await click('[data-random-seed]');defaults.push(await readSeed());}
 if(defaults.some(s=>!valid(s))||new Set(defaults).size!==defaults.length)throw Error('Default seeds are not mixed, random 16-character strings');
 if(await current()!==original)throw Error('Generating a seed modified the current run');
 await click('.modal-footer button:first-child');if(await current()!==original)throw Error('Cancelling new run modified progress');
 await click('[data-action="continue"]');if((await page.evaluate(()=>window.__mindrealm.getState().seed))!=='existing-manual-save')throw Error('Cancellation replaced the saved run');
 await open();const reopened=await readSeed();if(!valid(reopened)||defaults.includes(reopened))throw Error('Reopening reused a date or seed');
 for(const viewport of [{width:1440,height:900},{width:960,height:540}]){
  await page.setViewportSize(viewport);await page.screenshot({path:`narrative-seed-dialog-${viewport.width}.png`});
  const fit=await page.locator('.seed-entry').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&[...el.children].every(x=>x.scrollWidth<=x.clientWidth+1);});
  if(!fit)throw Error('Seed input clips at '+viewport.width);
 }
 await click('.modal-footer .primary');if((await page.evaluate(()=>window.__mindrealm.getState().seed))!==reopened)throw Error('Confirmation changed the displayed seed');
 await click('[data-action="menu"]');await click('[data-action="continue"]');if((await page.evaluate(()=>window.__mindrealm.getState().seed))!==reopened)throw Error('Continue regenerated a seed');
 await open();await page.locator('#seed-input').fill('   ');await click('.modal-footer .primary');
 const blank=await page.evaluate(()=>window.__mindrealm.getState().seed);if(!valid(blank)||blank===reopened)throw Error('Blank input did not create a fresh seed');
 const manual='  自定种子-A19  ';await open();await page.locator('#seed-input').fill(manual);await click('.modal-footer .primary');
 if((await page.evaluate(()=>window.__mindrealm.getState().seed))!==manual.trim())throw Error('Manual seed changed');
 const first=await fingerprint();await open();await page.locator('#seed-input').fill(manual.trim());await click('.modal-footer .primary');
 if(await fingerprint()!==first)throw Error('Same manual seed changed the world or pending gifts');
 if(errors.length)throw Error(JSON.stringify(errors));
 return{status:'RANDOM_SEED_BROWSER_OK',defaultSeeds:defaults,reopened,blank,manual:manual.trim(),cancelPreserved:true,continuePreserved:true,replayed:true,errors};
}
