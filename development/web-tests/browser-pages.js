async sourcePage => {
 const destination=new URL(sourcePage.url());
 if(!['127.0.0.1','localhost','alphazero78.github.io'].includes(destination.hostname)||destination.port==='4173')throw Error('Use an isolated preview or the published site');
 // A fresh context has no player cookies, settings or saves, even on the live domain.
 const context=await sourcePage.context().browser().newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
 const errors=[],requests=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)requests.push(`${r.status()} ${r.url()}`);});
 const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
 const idle=()=>page.waitForFunction(()=>document.querySelector('#app')&&!document.querySelector('#app').inert&&!document.querySelector('#modal-root').inert&&!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.getTiming().iterations!==Infinity));
 const click=async name=>{await page.locator(`[data-action="${name}"]`).first().click();await idle();};
 const state=()=>page.evaluate(async base=>(await import(base+'web/core/save.js')).createSaveStore(localStorage).load().value,destination.pathname);
 try{
  await page.goto(destination.href);await page.locator('[data-action="new"]').waitFor();await idle();
  check(await page.evaluate(()=>window.__mindrealm===undefined),'production exposes no QA interface');
  const base=destination.pathname.endsWith('/')?destination.pathname:destination.pathname+'/';destination.pathname=base;
  const manifest=base==='/'?null:await page.evaluate(async base=>(await fetch(base+'site-manifest.json')).json(),base);
  if(manifest)check(manifest.version==='0.1.4'&&manifest.basePath===base,'published version and subpath agree');
  await page.screenshot({path:'v014-production-menu.png'});
  await click('new');const seed1=await page.locator('#seed-input').inputValue();await page.locator('[data-random-seed]').click();const seed2=await page.locator('#seed-input').inputValue();
  check([seed1,seed2].every(x=>/^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{16}$/.test(x))&&seed1!==seed2,'mixed random seeds differ');
  await page.keyboard.press('Escape');await idle();check((await state())===null,'new-run cancellation leaves no run');
  await click('new');await page.locator('#seed-input').fill('release-v014');await page.locator('.modal-footer .primary').click();await idle();
  check((await state()).phase==='nexus','new game enters nexus');await page.screenshot({path:'v014-production-nexus.png'});
  await click('nexus-gift');await page.keyboard.press('Escape');await idle();check((await state()).phase==='nexus','gift cancellation preserves nexus');
  await click('nexus-gift');await page.locator('.modal-footer .primary').click();await idle();await page.locator('.map-node.available').first().click();await idle();
  check((await state()).phase==='prep','route enters preparation');await page.screenshot({path:'v014-production-prep.png'});
  await click('menu');await click('continue');check((await state()).seed==='release-v014','continue restores the isolated safe save');
  await click('start');await page.locator('.modal-footer .primary').click();await idle();await page.locator('[data-action="pause"]').waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('canvas')].some(c=>c.width>0&&c.height>0));await click('pause');await page.screenshot({path:'v014-production-battle.png'});
  await click('menu');await page.locator('.modal-footer .primary').click();await idle();await click('continue');check((await state()).phase==='prep','battle exit restores preparation');
  const illustrations=await page.evaluate(async base=>{const {events}=await import(base+'web/core/content.js'),{NEXUS_ART}=await import(base+'web/view/nexus-art.js');const paths=[...Object.keys(events).map(id=>base+'assets/game/events/'+id+'.png'),...Object.values(NEXUS_ART).map(a=>a.path)];for(let i=0;i<paths.length;i+=4)await Promise.all(paths.slice(i,i+4).map(path=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>img.naturalWidth>=1600?resolve():reject(Error(path));img.onerror=()=>reject(Error(path));img.src=path;})));return paths.length;},base);
  check(illustrations===48,'48 narrative illustrations decode');check(errors.length===0&&requests.length===0,JSON.stringify({errors,requests}));
  return {status:'PRODUCTION_BROWSER_OK',version:manifest?.version||'0.1.4',commit:manifest?.commit,checks,errors,requests};
 }finally{await context.close();}
}
