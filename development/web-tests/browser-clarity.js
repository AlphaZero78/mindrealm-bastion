async page=>{
 page.setDefaultTimeout(10000);await page.mouse.up();
 const checks=[],errors=[],badRequests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)badRequests.push(`${r.status()} ${r.url()}`);});
 const check=(value,message)=>{if(!value)throw Error(message);checks.push(message);};
 const click=action=>page.locator(`[data-action="${action}"]`).first().click();
 const point=cell=>page.evaluate(c=>{const q=window.__mindrealm,s=q.getState(),r=q.field.canvas.getBoundingClientRect(),p=q.field.project(c.x+.5,c.z+.5,s.terrain.cells[c.z*41+c.x].h);return{x:r.x+p.x,y:r.y+p.y};},cell);
 for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:960,height:540}]){
  await page.setViewportSize(viewport);
  await page.goto('http://127.0.0.1:4175/?qa=1');await page.waitForFunction(()=>window.__mindrealm);
  await page.evaluate(async()=>{await document.fonts.ready;const q=window.__mindrealm,R=await import('/web/core/state.js');q.newRun('clarity-regression');R.enterNode(q.getState(),R.availableNodes(q.getState())[0].id);q.render();window.soundCalls=[];const play=q.audio.play.bind(q.audio);q.audio.play=type=>{window.soundCalls.push(type);return play(type);};});
  const fit=await page.evaluate(()=>{const f=window.__mindrealm.field,r=f.canvas.getBoundingClientRect(),v=document.querySelector('#battle-viewport').getBoundingClientRect(),sidebar=document.querySelector('.battle-sidebar').getBoundingClientRect(),status=document.querySelector('#placement-status').getBoundingClientRect();return{ok:r.width>450&&r.height>170&&Math.abs(r.left-v.left)<1&&Math.abs(r.top-v.top)<1&&sidebar.right<=r.left+1&&status.top>=r.bottom-1&&f.canvas.width>=r.width-1&&f.canvas.height>=r.height-1,css:[r.width,r.height],buffer:[f.canvas.width,f.canvas.height]};});
  check(fit.ok,`${viewport.width}: canvas native resolution and nonoverlapping panels ${JSON.stringify(fit)}`);
  const card=page.locator('[data-action="select-unit"][data-uid="u4"]');await card.scrollIntoViewIfNeeded();await card.click();
  check(await page.evaluate(()=>window.soundCalls.filter(x=>['click','select'].includes(x)).join(',')==='select'),`${viewport.width}: selecting a unit plays one short cue`);
  const core=await point({x:20,z:24});await page.mouse.move(core.x,core.y);await page.mouse.click(core.x,core.y);
  check(await page.evaluate(()=>{const q=window.__mindrealm;return q.getState().focus===99&&q.getState().units[3].x===null&&!q.getContext().preview.ok;}),`${viewport.width}: protected core rejects deployment without cost`);
  await page.keyboard.press('Escape');
  check(await page.evaluate(()=>window.__mindrealm.getContext().deployUid===null&&!document.querySelector('#placement-status').textContent.includes('保护区')),`${viewport.width}: cancel clears the invalid preview`);
  const target=await page.evaluate(async()=>{const R=await import('/web/core/rules.js'),q=window.__mindrealm,s=q.getState(),u=s.units[3],cells=[];for(let z=7;z<35;z++)for(let x=7;x<35;x++)if(R.placement(s,u,x,z).ok)cells.push({x,z,d:Math.hypot(x-20,z-18)});cells.sort((a,b)=>a.d-b.d);return cells[0];});
  check(!!target,`${viewport.width}: random terrain offers legal ranged placement`);
  await card.scrollIntoViewIfNeeded();const bounds=await card.boundingBox();await page.evaluate(()=>window.soundCalls.length=0);
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2,bounds.y-12,{steps:3});
  const destination=await point(target);await page.mouse.move(destination.x,destination.y,{steps:15});
  await page.waitForTimeout(250);
  const drag=await page.evaluate(()=>{const q=window.__mindrealm;return {hover:q.getContext().hover,range:q.field.range.length,placing:document.querySelector('.battle-screen').dataset.placing};});
  check(drag.hover?.x===target.x&&drag.hover?.z===target.z&&drag.range>0&&drag.placing==='true',`${viewport.width}: real drag shows the correct footprint and combat range ${JSON.stringify({target,destination,drag})}`);
  await page.screenshot({path:`clarity-drag-${viewport.width}.png`});await page.mouse.up();
  check(await page.evaluate(c=>{const s=window.__mindrealm.getState(),u=s.units[3];return u.x===c.x&&u.z===c.z&&s.focus===99;},target),`${viewport.width}: drag drop uses its previewed cell and is initially free`);
  check(await page.evaluate(()=>window.soundCalls.join(',')==='select,deploy'),`${viewport.width}: drop has no stacked click/confirm/deploy sounds`);
  await page.screenshot({path:`clarity-deployed-${viewport.width}.png`});
  await click('move');
  const other=await page.evaluate(async()=>{const R=await import('/web/core/rules.js'),s=window.__mindrealm.getState(),u=s.units[3];for(let r=1;r<10;r++)for(let z=u.z-r;z<=u.z+r;z++)for(let x=u.x-r;x<=u.x+r;x++)if((x!==u.x||z!==u.z)&&R.placement(s,u,x,z).ok)return{x,z};});
  const moved=await point(other);await page.mouse.move(moved.x,moved.y);await page.mouse.click(moved.x,moved.y);
  check(await page.evaluate(()=>{const q=window.__mindrealm,m=document.querySelector('.modal').getBoundingClientRect(),c=q.field.canvas.getBoundingClientRect();return !q.field.interactive&&q.field.selection.previewOrigin&&q.field.range.length>0&&m.right<=c.left+1;}),`${viewport.width}: paid confirmation preserves the range and stays outside the battlefield`);
  await page.screenshot({path:`clarity-confirm-${viewport.width}.png`});await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  check(await page.evaluate(c=>{const s=window.__mindrealm.getState(),u=s.units[3];return u.x===c.x&&u.z===c.z&&s.focus===99;},target),`${viewport.width}: canceling relocation preserves the old position and focus`);
  await click('settings');await page.locator('[data-action="ui-scale"]').selectOption('1.5');await click('back');
  check(await page.evaluate(()=>{const c=window.__mindrealm.field.canvas.getBoundingClientRect(),s=document.querySelector('.battle-sidebar').getBoundingClientRect(),b=document.querySelector('[data-action="start"]').getBoundingClientRect();return c.left>=s.right-1&&c.height>150&&b.bottom<=innerHeight+1&&b.right<=innerWidth+1;}),`${viewport.width}: 150% UI request preserves the viewport and start control`);
  await page.screenshot({path:`clarity-scale-${viewport.width}.png`});
 }
 check(errors.length===0,`No script errors: ${errors.join(';')}`);check(badRequests.length===0,`No missing resources: ${badRequests.join(';')}`);
 return{status:'MINDREALM_CLARITY_BROWSER_OK',checks,errors,badRequests};
}
