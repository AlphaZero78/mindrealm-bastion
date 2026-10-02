async page=>{
 page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1366,height:768});await page.goto('http://127.0.0.1:4175/?qa=1');await page.waitForFunction(()=>window.__mindrealm);
 await page.evaluate(async()=>{const q=window.__mindrealm,Run=await import('/web/core/state.js'),R=await import('/web/core/rules.js');q.newRun('final-presentation');const s=q.getState();Run.enterNode(s,Run.availableNodes(s)[0].id);s.bandwidth=100;s.focus=1000;for(const u of s.units){R.upgrade(s,u.uid,'A',{free:true});R.upgrade(s,u.uid,'A',{free:true});let done=false;for(let z=14;z<30&&!done;z++)for(let x=14;x<28&&!done;x++)if(R.placement(s,u,x,z).ok){R.deploy(s,u.uid,x,z);done=true;}}s.depth=12;q.render();});
 await page.waitForTimeout(200);await page.screenshot({path:'final-upgraded-defense.png'});
 const title=await page.locator('.resource.depth').getAttribute('title');if(!title.includes('最大精神深度'))throw Error('Maximum depth tooltip is stale');
 await page.locator('[data-action="settings"]').click();await page.evaluate(()=>{window.__mindrealm.store.saveSettings=()=>({ok:false,reason:'验证用存储拒绝'});});await page.locator('[data-action="ui-scale"]').selectOption('1.25');if(!await page.locator('#toast').innerText().then(t=>t.includes('验证用存储拒绝')))throw Error('Settings failure was silent');
 await page.goto('http://127.0.0.1:4175/?qa=1');await page.waitForFunction(()=>window.__mindrealm);await page.evaluate(()=>{window.__mindrealm.getProfile().unlockedPressure=10;window.__mindrealm.render();});
 await page.locator('[data-action="new"]').click();await page.locator('#pressure-input').selectOption('10');
 const pressure=await page.locator('.modal-body .cost-line').innerText();if(!pressure.includes('营地精神恢复')||!pressure.includes('综合强化'))throw Error('Cumulative pressure effects missing');
 await page.screenshot({path:'final-pressure-preview.png'});await page.keyboard.press('Escape');
 if(errors.length)throw Error(errors.join(';'));return{status:'MINDREALM_FINAL_UI_OK',maxDepth:true,settingsFailure:true,cumulativePressure:true,errors};
}
