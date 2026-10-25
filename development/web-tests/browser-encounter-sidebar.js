async page=>{
 const url=new URL(page.url());if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port==='4173'||url.searchParams.get('qa')!=='1')throw Error('Use isolated QA storage');
 const checks=[],layouts=[],errors=[],onError=e=>errors.push(e.message);page.on('pageerror',onError);
 const check=(ok,name)=>{if(!ok)throw Error(name);checks.push(name);};
 const idle=()=>page.waitForFunction(()=>{const q=window.__mindrealm;return q&&!q.transitions.active&&!q.dialogs.active&&q.dialogs.animations.size===0;});
 const click=async selector=>{await idle();await page.locator(selector).first().click();await idle();};
 try{
  await page.reload();await idle();
  const expected=await page.evaluate(async()=>{
   const q=window.__mindrealm,R=await import('/web/core/state.js'),B=await import('/web/core/battle.js'),C=await import('/web/core/content.js');let state,plan;
   for(let i=0;i<30;i++){
    const s=R.newRun('entrance-sidebar-'+i);if(s.maps[2].boss!=='zero_frequency_mind')continue;
    s.nexus.forEach(room=>room.skipped=true);s.act=2;s.phase='map';const node=s.maps[2].nodes.find(n=>n.type==='boss');s.nextNodes=[node.id];R.enterNode(s,node.id);const encounter=B.makeEncounter(s);
    if(encounter.queue.some(row=>C.enemies[row.type].air)){state=s;plan=encounter;break;}
   }
   if(!state)throw Error('No representative entrance fixture');q.getSettings().reducedMotion=true;q.getSettings().tutorial=false;q.loadState(state);q.field.frameBoard();
   const counts={};for(const row of plan.queue){counts[row.entry]??={};counts[row.entry][row.type]=(counts[row.entry][row.type]||0)+1;}
   return{counts,total:plan.queue.length,air:plan.queue.find(row=>C.enemies[row.type].air).type};
  });await idle();
  if(!await page.locator('.enemy-intel').evaluate(el=>el.open))await click('.enemy-intel>summary');
  const actual=await page.locator('.entry-intel').evaluateAll(sections=>Object.fromEntries(sections.map(section=>[section.dataset.entry,Object.fromEntries([...section.querySelectorAll('.entry-enemy')].map(button=>[button.dataset.id,Number(button.dataset.enemyCount)]))])));
  check(JSON.stringify(actual)===JSON.stringify(expected.counts),'each entrance shows its own exact scheduled roster and quantities');
  const decoded=await page.locator('.entry-enemy svg image').evaluateAll(async images=>{const paths=[...new Set(images.map(image=>image.getAttribute('href')))];await Promise.all(paths.map(path=>{const image=new Image();image.src=path;return image.decode();}));return paths.length;});
  check(decoded>3,'different enemy model portraits load successfully');
  check(await page.locator('.enemy-trait.air').count()>0&&await page.locator('.enemy-trait.ground').count()>0&&await page.locator('.enemy-trait.siege').count()>0,'flying ground and siege labels appear together without hiding movement type');
  check(!/金色点线|群连续到达|群间不开放部署/.test(await page.locator('.battle-caption').innerText()),'redundant route and continuous-wave instructions are removed');
  for(const [width,height,scale]of [[1440,900,1],[960,540,1],[960,700,1.5]]){
   await page.setViewportSize({width,height});await page.evaluate(scale=>{const q=window.__mindrealm;q.getSettings().uiScale=scale;q.render();},scale);await idle();
   const layout=await page.evaluate(()=>{
    const panel=document.querySelector('.enemy-intel'),p=panel.getBoundingClientRect(),cue=panel.querySelector('.threat-toggle-cue').getBoundingClientRect();
    const clipped=[...panel.querySelectorAll('.entry-enemy,.entry-intel-heading,.entry-enemy-copy')].filter(el=>{const r=el.getBoundingClientRect();return r.x<p.x-.5||r.right>p.right+.5||el.scrollWidth>el.clientWidth+1;}).map(el=>el.className);
    return{width:innerWidth,height:innerHeight,panelWidth:p.width,cueWidth:cue.width,cueHeight:cue.height,after:getComputedStyle(panel.querySelector('summary'),':after').content,clipped,overflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   check(!layout.clipped.length&&!layout.overflow&&layout.cueWidth>45&&layout.cueHeight>25&&layout.after==='none',`${width}/${scale}: portraits labels and the explicit collapse control fit`);layouts.push(layout);
   await page.locator('.battle-sidebar').evaluate(el=>el.scrollTop=0);
   await page.screenshot({path:`sidebar-${width}-${height}.jpg`,type:'jpeg',quality:80});
  }
  await page.locator('.enemy-intel>summary').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.__mindrealm.getContext().threatOpen===false);
  check(await page.locator('.threat-closed-label').isVisible()&&!await page.locator('.entry-enemy').first().isVisible(),'keyboard collapse shows an explicit expand label');
  await click('[data-action="tab-units"]');check(!await page.locator('.enemy-intel').evaluate(el=>el.open),'other UI operations preserve the collapsed intelligence');
  await click('.enemy-intel>summary');await page.waitForFunction(()=>window.__mindrealm.getContext().threatOpen===true);
  check(await page.locator('.threat-open-label').isVisible(),'expanding restores the portrait list and collapse label');
  for(const type of [expected.air,'zero_frequency_mind']){
   await click(`.entry-enemy[data-id="${type}"]`);
   const name=await page.evaluate(async type=>(await import('/web/core/content.js')).enemies[type].name,type);
   check(await page.locator('#dialog-title').textContent()===name,`${type}: portrait opens the complete enemy details`);
   await click('[data-modal="close"]');
  }
  await click('.enemy-intel>summary');await page.waitForFunction(()=>!window.__mindrealm.getContext().threatOpen);
  await click('[data-action="start"]');await click('.modal-footer .primary');await click('[data-action="pause"]');
  check(await page.evaluate(()=>window.__mindrealm.getState().phase==='battle')&&!await page.locator('.enemy-intel').evaluate(el=>el.open),'battle and pause preserve the collapsed panel');
  await page.evaluate(()=>window.__mindrealm.advance(3));
  const count=await page.evaluate(()=>{const b=window.__mindrealm.getState().battle;return`${b.enemies.filter(e=>!e.dead).length} 活动 / ${b.total-b.spawned} 待到达`;});
  check(await page.locator('#hud-enemies').textContent()===count,'live active and pending counts stay accurate while collapsed');
  await page.evaluate(()=>{const q=window.__mindrealm;q.getState().battle.bossKilled=true;q.advance(.05);});
  check(await page.locator('#hud-wave').isVisible()&&(await page.locator('#hud-wave').textContent()).includes('首领已击败 · 清理余敌'),'the meaningful boss-clearance warning stays visible outside the collapsed panel');
  check(!errors.length,'entrance intelligence has no page errors');return{status:'ENTRANCE_ENEMY_SIDEBAR_OK',checks,layouts,portraitTypes:decoded,totalPlanned:expected.total,errors};
 }finally{page.off('pageerror',onError);}
}
