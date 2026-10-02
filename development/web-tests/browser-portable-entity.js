// Run against a dedicated portable /health page with Playwright CLI. Uses only
// portable public modules, real UI commands and the isolated ?qa=1 memory store.
async page=>{
  const origin=page.url().match(/^https?:\/\/[^/]+/)?.[0];if(!origin?.endsWith(':4201'))throw Error('Portable acceptance requires its dedicated 4201 server');
  const errors=[],external=[],failed=[],requests=[],checks=[];page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
  await page.unroute('**/*');await page.route('**/*',route=>{const url=route.request().url();requests.push(url);if(!url.startsWith(origin+'/')){external.push(url);return route.abort();}return route.continue();});
  const check=(name,ok,detail)=>{checks.push({name,passed:!!ok,detail});if(!ok)throw Error(`${name}: ${JSON.stringify(detail)}`);};
  const stable=()=>page.waitForFunction(()=>window.__mindrealm&&!window.__mindrealm.transitions.active&&!window.__mindrealm.dialogs.active);
  const click=action=>page.locator(`[data-action="${action}"]`).first().click();
  await page.setViewportSize({width:1920,height:1080});await page.goto(`${origin}/?qa=1`,{waitUntil:'domcontentloaded'});await stable();
  const atlas=await page.evaluate(async()=>{const q=window.__mindrealm,A=(await import('/web/view/entity-art.js')).ENTITY_ART;await Promise.all([...q.field.images.values()].map(image=>image.decode()));return Object.entries(A).map(([id,a])=>{const image=q.field.images.get(id);return{id,source:image.src,width:image.naturalWidth,height:image.naturalHeight,expectedWidth:a.cell*a.directions,expectedHeight:a.cell*a.rows};});});
  check('40 animated atlases decode from the portable package',atlas.length===40&&atlas.every(a=>a.width===a.expectedWidth&&a.height===a.expectedHeight&&a.source.includes('/animations/')),atlas.length);
  await click('new');await page.locator('#seed-input').fill('reference-0');await page.locator('.modal-footer .primary').click();await stable();
  check('real new game uses normal initial resources',await page.evaluate(()=>{const s=window.__mindrealm.getState();return s.spirit===100&&s.focus===99&&s.bandwidth===20&&s.units.length===7&&s.difficultyRevision===2;}));
  await page.locator('.map-node.available').first().click();await stable();
  const beforeCancel=await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState()));await page.locator('[data-action="select-unit"][data-uid="u1"]').click();
  const protectedCell=await page.evaluate(()=>{const q=window.__mindrealm,r=q.field.canvas.getBoundingClientRect(),p=q.field.p(20.5,24.5,0);return{x:r.left+p.x,y:r.top+p.y};});await page.mouse.click(protectedCell.x,protectedCell.y);await page.keyboard.press('Escape');
  check('illegal protected placement and cancellation do not change the run',beforeCancel===await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState())));
  // This real opening keeps two alternatives in storage: its five-unit mix
  // costs 19/20 bandwidth. Owning seven units never guarantees room for seven.
  const order=['u4','u6','u1','u3','u7'];
  for(const uid of order){
    await page.locator(`[data-action="select-unit"][data-uid="${uid}"]`).click();
    const candidates=await page.evaluate(async uid=>{
      const q=window.__mindrealm,R=await import('/web/core/rules.js'),s=q.getState(),u=s.units.find(u=>u.uid===uid),stats=R.unitStats(s,u),rect=q.field.canvas.getBoundingClientRect(),path=R.pathToCore(s,20,0),targets=path.filter(p=>p.z>=8&&p.z<24).map(p=>({...p,h:R.cellAt(s,p.x,p.z).h,air:false,armor:0,hp:100,maxHp:100})),result=[];
      for(let z=7;z<=29;z++)for(let x=5;x<=35;x++)if(R.placement(s,u,x,z).ok){
        const h=R.cellAt(s,x,z).h,p=q.field.p(x+.5,z+.5,h);if(p.x<35||p.y<35||p.x>rect.width-35||p.y>rect.height-35)continue;
        const probe={...u,x,z},center=R.unitCenter(probe);let score=0;
        if(stats.role==='support'){for(const ally of s.units.filter(u=>u.x!==null)){const d=Math.hypot(center.x-R.unitCenter(ally).x,center.z-R.unitCenter(ally).z);if(d<=stats.range)score+=20-d;}}
        else for(const target of targets){if(R.solveAttack(s,probe,target).ok)score+=stats.role==='ranged'?3:8;}
        score-=Math.hypot(center.x-20,center.z-18)*.25;result.push({x,z,h,cx:rect.left+p.x,cy:rect.top+p.y,score});
      }return result.sort((a,b)=>b.score-a.score).slice(0,40);
    },uid);
    let target=null;for(const c of candidates){await page.mouse.move(c.cx,c.cy);const hover=await page.evaluate(()=>window.__mindrealm.getContext().hover);if(hover?.x===c.x&&hover?.z===c.z){target=c;break;}}
    check(`in-view legal cell for ${uid}`,!!target,target);await page.mouse.click(target.cx,target.cy);
    check(`real canvas deployment for ${uid}`,await page.evaluate(({uid,target})=>{const u=window.__mindrealm.getState().units.find(u=>u.uid===uid);return u.x===target.x&&u.z===target.z;},{uid,target}));
  }
  const prep=await page.evaluate(()=>{const s=window.__mindrealm.getState();return{layout:s.units.map(u=>({uid:u.uid,type:u.type,x:u.x,z:u.z,hp:u.hp,tier:u.tier,branch:u.branch,order:u.order})),focus:s.focus,spirit:s.spirit,terrain:JSON.stringify(s.terrain),node:s.currentNode.id};});
  check('five opening units deploy within the normal budget without spending focus',prep.layout.length===7&&prep.layout.filter(u=>u.x!==null).length===5&&prep.focus===99,prep.layout);
  await page.locator('[data-action="warehouse-tab"][data-tab="all"]').click();await page.locator('[data-action="select-unit"][data-uid="u4"]').click();
  const selected=await page.evaluate(()=>{const q=window.__mindrealm,u=q.getState().units.find(u=>u.uid==='u4'),g=q.field.entityGeometry(u),p=q.field.p(g.x,g.z,g.h),size=q.field.modelSize(u,g);return{uid:q.getContext().selectedUid,size,frame:q.field.entityFrames.find(f=>f.key==='unit:u4'),geometry:g};});
  check('selected model uses final enlarged geometry',selected.uid==='u4'&&selected.size>30&&selected.frame?.variant==='T1',selected);
  await page.screenshot({path:'portable-selection-corners.png'});
  await click('start');await page.getByRole('button',{name:'取消',exact:true}).click();await stable();check('cancel battle confirmation keeps preparation',await page.evaluate(()=>window.__mindrealm.getState().phase==='prep'));
  await click('start');await page.locator('.modal-footer .primary').click();await stable();
  await page.locator('[data-action="warehouse-tab"][data-tab="all"]').click();await page.locator('[data-action="select-unit"][data-uid="u4"]').click();
  await page.locator('[data-action="speed"][data-speed="3"]').click();
  await page.waitForFunction(()=>window.__mindrealm.field.entityFrames.some(f=>f.key.startsWith('unit:')&&f.action==='attack'),{},{timeout:30000});
  await click('pause');await stable();
  const paused=await page.evaluate(()=>{const q=window.__mindrealm,s=q.getState();return{time:s.battle.time,positions:s.battle.enemies.map(e=>[e.id,e.x,e.z,e.h]),motion:q.field.entityMotion.snapshot(),frames:q.field.entityFrames,damage:Object.values(s.stats.damageByUnit).reduce((a,b)=>a+b,0)};});
  check('portable real battle attacks and renders models',paused.damage>0&&paused.frames.some(f=>f.key.startsWith('enemy:')), {damage:paused.damage,enemies:paused.positions.length,actions:[...new Set(paused.frames.map(f=>f.action))]});
  await page.waitForTimeout(400);
  check('pause freezes simulation and animation clock',await page.evaluate(before=>{const q=window.__mindrealm,b=q.getState().battle;return b.time===before.time&&JSON.stringify(b.enemies.map(e=>[e.id,e.x,e.z,e.h]))===JSON.stringify(before.positions)&&q.field.entityMotion.snapshot().clock===before.motion.clock;},paused));
  const aim=await page.evaluate(()=>{const q=window.__mindrealm,units=q.getState().units.filter(u=>u.x!==null),rect=q.field.canvas.getBoundingClientRect();const x=units.reduce((s,u)=>s+u.x,0)/units.length,z=units.reduce((s,u)=>s+u.z,0)/units.length,p=q.field.p(x,z,0);return{x:rect.left+p.x,y:rect.top+p.y};});
  await page.mouse.move(aim.x,aim.y);await page.mouse.wheel(0,-250);await page.mouse.move(1900,70);await page.waitForTimeout(150);
  await page.screenshot({path:'D:/game_build_release/entity-models-preview.png'});
  check('enemy elevation uses authoritative runtime height',await page.evaluate(()=>{const q=window.__mindrealm;return q.getState().battle.enemies.every(e=>Math.abs(q.field.entityGeometry(e,true).h-e.h-(e.air?1.3:0))<1e-8);}));
  await click('menu');await page.locator('.modal-footer .primary').click();await stable();await click('continue');await stable();
  const continued=await page.evaluate(()=>{const q=window.__mindrealm,s=q.getState();return{phase:s.phase,battle:s.battle,layout:s.units.map(u=>({uid:u.uid,type:u.type,x:u.x,z:u.z,hp:u.hp,tier:u.tier,branch:u.branch,order:u.order})),focus:s.focus,spirit:s.spirit,terrain:JSON.stringify(s.terrain),node:s.currentNode.id,errors:q.snapshot().errors,audioErrors:q.snapshot().audioErrors,keys:q.field.keys.size,transition:q.transitions.active,dialog:q.dialogs.active,overlays:document.querySelectorAll('.scene-transition-layer,.dialog-transition-layer').length};});
  check('menu continue restores identical pre-battle layout, durability, resources and terrain',continued.phase==='prep'&&!continued.battle&&JSON.stringify(continued.layout)===JSON.stringify(prep.layout)&&continued.focus===prep.focus&&continued.spirit===prep.spirit&&continued.terrain===prep.terrain&&continued.node===prep.node);
  check('no input, animation or error residue',!continued.transition&&!continued.dialog&&continued.keys===0&&continued.overlays===0&&!continued.errors.length&&!continued.audioErrors.length,continued.errors);
  check('real flow needed no external or legacy requests',external.length===0&&failed.length===0&&errors.length===0&&requests.every(url=>!/[.](glb|gd|tscn|import|uid)(?:[?#]|$)/i.test(url)),{external,failed,errors,requests:requests.length});
  return{status:'PORTABLE_ENTITY_ACCEPTANCE_OK',checks,atlasCount:atlas.length,initialLayout:prep.layout,battleTime:paused.time,actualDamage:paused.damage,requests:requests.length,external,failed,errors,screenshot:'D:/game_build_release/entity-models-preview.png',note:'Performance samples preceded two coordinate-only fixes: selection brackets and enemy runtime elevation. No extra render loop or draw calls were added; this portable smoke validates the corrected code.'};
}
