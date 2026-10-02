// Playwright CLI run-code --filename development/web-tests/browser-difficulty.js
// Open a source server with MINDREALM_QA=1 first, and run from an external Temp
// artifact directory. Fixtures below only test presentation, never a full run.
async page=>{
  const checks=[],errors=[],failedResources=[],bossDetails=[],screenshots=[];
  page.setDefaultTimeout(8000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)failedResources.push(`${response.status()} ${response.url()}`);});
  const check=(value,message)=>{if(!value)throw Error(message);checks.push(message);};
  const settle=()=>page.waitForFunction(()=>{const q=window.__mindrealm;return q&&!q.transitions.active&&!q.dialogs.active;});
  const act=async locator=>{await settle();await locator.click();await settle();};
  const click=action=>act(page.locator(`[data-action="${action}"]`).first());
  const approve=()=>act(page.locator('.modal-footer .primary'));
  const close=()=>act(page.locator('[data-modal="close"]'));
  const shot=async name=>{await settle();await page.screenshot({path:name,animations:'disabled'});screenshots.push(name);};
  const target=page.url().match(/^http:\/\/(127\.0\.0\.1|localhost):\d+/)?.[0]||'http://127.0.0.1:4177';
  await page.goto(`${target}/?qa=1`);await settle();await page.evaluate(()=>document.fonts.ready);
  await page.setViewportSize({width:1366,height:768});

  await click('new');
  const options=await page.locator('#pressure-input option').evaluateAll(nodes=>nodes.map(n=>({value:+n.value,disabled:n.disabled,text:n.textContent})));
  check(options.length===11&&options.every((x,i)=>x.value===i&&x.disabled===(i>0)),'新档显示 0–10，未解锁等级全部不可选择');
  await act(page.locator('.modal details summary'));
  for(let level=0;level<=10;level++){
    await page.locator(`[data-pressure-preview="${level}"]`).hover();
    check(await page.locator('[data-difficulty-summary]').innerText().then(text=>text.includes(`控制压力 ${level}`)&&text.includes('效果预览'))&&await page.locator('#pressure-input').inputValue()==='0',`悬停压力 ${level} 仅预览，不改变实际选择`);
  }
  await page.locator('[data-pressure-preview="10"]').focus();
  check(await page.locator('#pressure-input').inputValue()==='0','键盘聚焦未解锁难度不会更改实际选择');
  await shot('difficulty-locked-preview.png');
  await page.setViewportSize({width:960,height:540});
  for(const level of [0,5,10]){
    await page.locator(`[data-pressure-preview="${level}"]`).hover();
    check(await page.locator('[data-difficulty-summary]').innerText().then(text=>text.includes(`控制压力 ${level}`))&&await page.locator('#pressure-input').inputValue()==='0',`960×540 悬停压力 ${level} 稳定且不改变选择`);
  }
  const previewBox=await page.locator('.difficulty-preview-info').boundingBox();
  check(previewBox&&previewBox.y>=0&&previewBox.y+previewBox.height<=540,'960×540 悬停时说明区本身仍完整位于视口');
  await shot('difficulty-locked-preview-960.png');
  await act(page.locator('[data-pressure-preview="10"]'));await page.locator('.difficulty-preview-info').hover();await page.mouse.wheel(0,400);
  await page.waitForFunction(()=>{const el=document.querySelector('.difficulty-preview-info');return el.scrollTop>0&&el.scrollTop+el.clientHeight>=el.scrollHeight-1;});
  check(await page.locator('[data-difficulty-summary]').innerText().then(text=>text.includes('控制压力 10'))&&await page.locator('#pressure-input').inputValue()==='0','聚焦预览后独立滚动读完频震说明，实际选择仍为 0');
  await shot('difficulty-preview-960-scrolled.png');await page.setViewportSize({width:1366,height:768});
  await page.locator('#seed-input').fill('difficulty-ui-standard');await approve();
  check(await page.evaluate(()=>{const q=window.__mindrealm,s=q.getState();return s.pressureLevel===0&&s.difficultyRevision===2&&s.spirit===100&&s.focus===99&&s.bandwidth===20&&q.store.load().state.difficultyRevision===2;}),'真实菜单确认建立压力 0 新规则存档，开局资源保持不变');
  await click('menu');
  await page.evaluate(()=>{const q=window.__mindrealm;q.getProfile().unlockedPressure=10;const saved=q.store.saveProfile(q.getProfile());if(!saved.ok)throw Error(saved.reason);q.render();});await settle();
  await click('new');
  check(await page.locator('#pressure-input option').evaluateAll(nodes=>nodes.every(n=>!n.disabled)),'隔离档案解锁 10 后全部等级可选');
  await page.locator('#pressure-input').selectOption('10');await page.locator('#seed-input').fill('difficulty-ui-high');
  check(await page.locator('[data-difficulty-summary]').innerText().then(text=>text.includes('控制压力 10')&&text.includes('频震')&&text.includes('本次累计生效')),'选择压力 10 展示累计强度和额外机制');
  await close();check(await page.evaluate(()=>window.__mindrealm.getState().seed==='difficulty-ui-standard'),'取消新远征保留原单局');
  await click('new');await page.locator('#pressure-input').selectOption('10');await page.locator('#seed-input').fill('difficulty-ui-high');await approve();
  check(await page.evaluate(()=>{const q=window.__mindrealm,s=q.getState();return s.pressureLevel===10&&s.difficultyRevision===2&&s.spirit===100&&s.focus===99&&q.store.load().state.pressureLevel===10;}),'真实菜单确认建立压力 10 新规则存档');
  await page.locator('.map-node.available').first().click();await click('encounter');
  check(await page.locator('.modal-body').innerText().then(text=>text.includes('控制压力 10')&&text.includes('16 个计划敌人')&&text.includes('增援总预算 1')),'压力 10 战前情报显示同数量编队及增援预算');await close();

  // Same in-memory profile; no localStorage or player settings are accessed.
  for(const revision of [1,null]){
    await page.evaluate(async revision=>{
      const R=await import('/web/core/state.js'),s=R.newRun('legacy-difficulty-ui',10),node=s.maps[0].nodes.find(n=>n.type==='camp')||s.maps[0].nodes.find(n=>n.floor===1);
      if(revision===null)delete s.difficultyRevision;else s.difficultyRevision=revision;
      node.type='camp';s.nextNodes=[node.id];const entered=R.enterNode(s,node.id);if(!entered.ok)throw Error(entered.reason);s.spirit=40;s.focus=500;window.__mindrealm.loadState(s);
    },revision);await settle();await click('menu');await click('continue');
    check(await page.locator('[data-action="camp-heal"]').innerText().then(text=>text.includes('20%')),'旧规则继续游戏保留营地 20% 恢复');
    check(await page.evaluate(revision=>{const s=window.__mindrealm.getState();return s.pressureLevel===10&&s.spirit===40&&s.focus===500&&(revision===null?!Object.hasOwn(s,'difficultyRevision'):s.difficultyRevision===1);},revision),'旧局继续不改写修订、资源或难度');
    await page.evaluate(async revision=>{const R=await import('/web/core/state.js'),s=R.newRun('legacy-prep-ui',10);if(revision===null)delete s.difficultyRevision;else s.difficultyRevision=revision;R.enterNode(s,R.availableNodes(s)[0].id);window.__mindrealm.loadState(s);},revision);await settle();await click('encounter');
    check(await page.locator('.modal-body').innerText().then(text=>text.includes('沿用旧规则')&&text.includes('费用提高 15%')),'旧规则战前情报明确说明旧版服务费用');await close();
  }

  await page.waitForFunction(()=>!document.querySelector('#toast').classList.contains('visible'));
  await page.setViewportSize({width:960,height:540});
  for(const type of ['noise_hive','mirror_censor','memory_reforger','bandwidth_requisitioner','chorus_overseer','zero_frequency_mind']){
    const expected=await page.evaluate(async type=>{
      const R=await import('/web/core/state.js'),C=await import('/web/core/content.js'),D=await import('/web/core/difficulty.js'),U=await import('/web/ui.js'),s=R.newRun(`boss-details-${type}`,10),spec=C.enemies[type];s.act=spec.act-1;
      const map=s.maps[s.act],node=map.nodes.find(n=>n.type==='boss');map.boss=type;node.boss=type;s.nextNodes=[node.id];const result=R.enterNode(s,node.id);if(!result.ok)throw Error(result.reason);window.__mindrealm.loadState(s);
      const stats=D.enemyStats(s,spec),phases=[0,1,2].map(phase=>D.enemyAbilityProfile(s,stats,phase));
      return {type,name:spec.name,fields:[`生命上限 ${U.n(stats.hp)}`,`攻击 ${U.n(stats.attack)}`,`护甲 ${U.n(stats.armor)}`,`死亡原始压力 ${U.n(stats.pressure)}`,`突破伤害 ${U.n(stats.core_damage)}`],cycle:phases.map(p=>U.n(p.cycle)).join(' / '),heal:phases.some(p=>p.healAmount)?phases.map(p=>U.n(p.healAmount)).join(' / '):null,shield:phases.some(p=>p.shieldAmount)?phases.map(p=>U.n(p.shieldAmount)).join(' / '):null,jam:phases.some(p=>p.jamDuration)?phases.map(p=>U.n(p.jamDuration)).join(' / '):null,surge:U.n(stats.attack*.55)};
    },type);await settle();
    await act(page.locator(`[data-action="enemy-info"][data-id="${type}"]`));
    const text=await page.locator('.modal-body').innerText();
    check(expected.fields.every(field=>text.includes(field))&&text.includes(`间隔 ${expected.cycle} 秒`)&&(!expected.heal||text.includes(`自身恢复 ${expected.heal}`))&&(!expected.shield||text.includes(`自身护盾补充至 ${expected.shield}`))&&(!expected.jam||text.includes(`持续 ${expected.jam} 秒`))&&text.includes(`造成 ${expected.surge} 伤害`),`${expected.name} 战前情报与权威属性和三个阶段能力一致`);
    check(!/NaN|undefined/.test(text),`${expected.name} 情报无无效数值`);
    const bounds=await page.locator('.modal').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,scrollTop:el.scrollTop,scrollHeight:el.scrollHeight,height:el.clientHeight,width:el.clientWidth,scrollWidth:el.scrollWidth};});
    check(bounds.left>=0&&bounds.right<=960&&bounds.top>=0&&bounds.bottom<=540&&bounds.scrollWidth<=bounds.width+1,`${expected.name} 长弹窗在 960×540 内横向完整`);
    check(bounds.scrollTop===0,`${expected.name} 打开情报先显示标题与生命属性`);
    if(['memory_reforger','chorus_overseer'].includes(type))await shot(`difficulty-${type}-960-top.png`);
    await page.locator('.modal').hover();await page.mouse.wheel(0,1800);await page.waitForFunction(()=>document.querySelector('.modal').scrollTop>0);
    check(await page.locator('.modal-footer button').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),`${expected.name} 长弹窗可以滚动到确认按钮`);
    if(type==='memory_reforger')await shot('difficulty-memory-detail-960-bottom.png');
    await close();bossDetails.push(expected);
    await page.evaluate(()=>{const q=window.__mindrealm,s=q.getState();s.phase='map';s.bossReveal=3;q.render();});await settle();
    await click('boss-intel');await act(page.locator('#modal-root [data-action="enemy-info"][data-boss-preview="true"]'));
    const intel=await page.locator('.modal-body').innerText();check(expected.fields.every(field=>intel.includes(field))&&intel.includes(expected.cycle),`${expected.name} 完整路线情报采用首领层实际强度`);await close();
  }

  // Presentation fixture: three constructs and a real spawned boss. Simulation
  // is stepped through the public battle module while the UI pause is engaged.
  await page.setViewportSize({width:1366,height:768});
  await page.evaluate(async()=>{
    const F=await import('/development/web-tests/helpers/battle-fixture.mjs'),s=F.fixture('surge-visual-fixture');s.pressureLevel=10;s.difficultyRevision=2;s.bandwidth=100;s.spirit=s.maxSpirit=1000;
    const node=s.currentNode;node.type='boss';node.boss='noise_hive';s.maps[0].boss='noise_hive';
    F.place(s,'pulse_array',17,18,{h:1});F.place(s,'anchor_bulwark',22,18);F.place(s,'bandwidth_relay',25,20);
    const [boss]=F.battle(s,['noise_hive']);Object.assign(boss,{x:20,z:16,h:0,speed:0,cooldown:10000,abilityClock:10000,surgeClock:10000});for(const u of s.units)u.cooldown=10000;
    window.__mindrealm.loadState(s);window.__difficultyVisualFixture=structuredClone(s);
  });await settle();
  if(!await page.evaluate(()=>window.__mindrealm.getContext().paused))await click('pause');
  await page.evaluate(async()=>{const q=window.__mindrealm,B=await import('/web/core/battle.js'),s=q.getState();s.battle.enemies[0].surgeClock=.01;B.stepBattle(s,.05);q.field.camera.x=20;q.field.camera.z=18;q.field.zoomLevel=1.65;q.field.updateScale();q.field.dirty=true;q.field.render(performance.now());});
  const telegraph=await page.evaluate(()=>{const q=window.__mindrealm,s=q.getState(),e=s.battle.enemies[0];q.field.render(performance.now());return {time:s.battle.time,deadline:e.surgeWarningUntil,origin:e.surgeOrigin,targets:e.surgeTargets,labels:q.field.worldLabels.map(x=>x.text),health:s.units.map(u=>u.hp)};});
  check(Math.abs(telegraph.deadline-telegraph.time-1.5)<1e-8&&telegraph.targets.length===2&&telegraph.labels.some(x=>x.includes('频震 · 1.5秒'))&&telegraph.labels.filter(x=>x.includes('频震锁定')).length===2,'真实模拟产生完整 1.5 秒频震预警、两名锁定和画布倒计时');
  await shot('difficulty-surge-1.5.png');
  await click('settings');await page.locator('[data-action="motion-setting"]').check();await click('back');
  check(await page.evaluate(()=>{const q=window.__mindrealm;q.field.render(performance.now());return q.getSettings().reducedMotion&&q.field.selection.reducedMotion&&q.field.worldLabels.some(x=>x.text.includes('频震 · 1.5秒'));}),'减少动态模式保留频震关键警告');await shot('difficulty-surge-reduced-motion.png');
  await page.evaluate(async()=>{const q=window.__mindrealm,B=await import('/web/core/battle.js');for(let i=0;i<16;i++)B.stepBattle(q.getState(),.05);q.field.render(performance.now());});
  check(await page.evaluate(before=>{const q=window.__mindrealm;q.field.render(performance.now());return JSON.stringify(q.getState().units.map(u=>u.hp))===JSON.stringify(before)&&q.field.worldLabels.some(x=>x.text.includes('频震 · 0.7秒'));},telegraph.health),'蓄力 0.8 秒后倒计时为 0.7，目标尚未受伤');await shot('difficulty-surge-0.7.png');
  await page.evaluate(async()=>{const q=window.__mindrealm,B=await import('/web/core/battle.js');for(let i=0;i<14;i++)B.stepBattle(q.getState(),.05);q.field.render(performance.now());});
  check(await page.evaluate(before=>{const q=window.__mindrealm,s=q.getState();q.field.render(performance.now());return s.units.filter((u,i)=>u.hp<before[i]).length===2&&!s.battle.enemies[0].surgeWarningUntil&&!q.field.worldLabels.some(x=>x.text.includes('频震'));},telegraph.health),'释放时仅两名锁定受伤，预警环与倒计时清理');await shot('difficulty-surge-released.png');

  await page.evaluate(async()=>{const q=window.__mindrealm,B=await import('/web/core/battle.js');q.loadState(window.__difficultyVisualFixture);q.getState().battle.enemies[0].surgeClock=.01;B.stepBattle(q.getState(),.05);q.field.render(performance.now());});await settle();
  await click('menu');await approve();
  check(await page.evaluate(()=>{const q=window.__mindrealm,c=q.getContext();q.field.render(performance.now());return q.snapshot().screen==='menu'&&q.field.state!==q.getState()&&!q.field.worldLabels.some(x=>x.text.includes('频震'))&&!q.transitions.active&&!q.dialogs.active&&!c.deployUid&&!c.terrainTool&&!c.preview&&q.field.keys.size===0;}),'蓄力中停止并返回菜单，战场和输入全部清理');
  await click('continue');check(await page.evaluate(()=>{const s=window.__mindrealm.getState();return s.phase==='prep'&&!s.battle&&s.difficultyRevision===2;}),'停止后继续恢复战前，频震不残留到新战斗');
  await page.evaluate(()=>window.__mindrealm.loadState(window.__difficultyVisualFixture));await settle();
  if(!await page.evaluate(()=>window.__mindrealm.getContext().paused))await click('pause');
  await page.evaluate(async()=>{const q=window.__mindrealm,B=await import('/web/core/battle.js'),s=q.getState(),e=s.battle.enemies[0];e.surgeClock=.01;B.stepBattle(s,.05);window.__difficultyHealth=s.units.map(u=>u.hp);e.hp=0;e.dead=true;q.field.render(performance.now());});await settle();
  check(await page.evaluate(()=>{const q=window.__mindrealm;q.field.render(performance.now());return !q.field.worldLabels.some(x=>x.text.includes('频震'))&&JSON.stringify(q.getState().units.map(u=>u.hp))===JSON.stringify(window.__difficultyHealth);}),'施法者死亡立即移除频震画面，不伤害锁定目标');await shot('difficulty-surge-caster-dead.png');
  await click('menu');await approve();
  await page.waitForTimeout(250);
  const global=await page.evaluate(()=>{const q=window.__mindrealm;return {transitionActive:q.transitions.active,dialogActive:q.dialogs.active,overlays:document.querySelectorAll('[data-screen-transition]').length,appInert:document.querySelector('#app').inert,modalChildren:document.querySelector('#modal-root').children.length,animations:document.getAnimations().length,duplicateIds:[...document.querySelectorAll('[id]')].map(x=>x.id).filter((x,i,a)=>a.indexOf(x)!==i),renderErrors:q.field.errors,audioErrors:q.audio.errors,screen:q.snapshot().screen};});
  check(!global.transitionActive&&!global.dialogActive&&!global.overlays&&!global.appInert&&!global.modalChildren&&!global.animations&&!global.duplicateIds.length&&!global.renderErrors.length&&!global.audioErrors.length,'最终无动画、输入、重复 ID 或渲染音频错误残留');
  check(!errors.length&&!failedResources.length,'浏览器无脚本错误或资源加载失败');
  return {status:'MINDREALM_BROWSER_DIFFICULTY_OK',checks,bossDetails,telegraph,global,errors,failedResources,screenshots,fixtureScope:'首领属性与频震仅为隔离表现夹具；不作为通关证据'};
}
