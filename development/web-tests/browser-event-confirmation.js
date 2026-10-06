async page=>{
 const url=new URL(page.url());if(url.searchParams.get('qa')!=='1'||url.port==='4173')throw Error('Use isolated QA storage');
 const checks=[],check=(condition,label)=>{if(!condition)throw Error(label);checks.push(label);};
 const load=async(id='noise_market',mode='normal')=>page.evaluate(async({id,mode})=>{
  const R=await import('/web/core/state.js'),C=await import('/web/core/content.js'),I=await import('/web/core/inventory.js');
  if(id==='item-exchange')id=Object.values(C.legacyEvents).find(e=>e.choices.some(c=>c.effects.consume_item)).id;
  const s=R.newRun('inline-confirm:'+id);s.difficultyRevision=4;R.chooseNexus(s,s.nexus[0].options[0]);s.act=C.legacyEvents[id].act-1;
  const node=s.maps[s.act].nodes.find(n=>n.floor===1);node.type='event';node.event=id;s.nextNodes=[node.id];R.enterNode(s,node.id);
  s.depth=5;s.focus=500;s.spirit=mode==='fatal'?1:80;I.addItem(s,'clarity');I.addItem(s,'clarity');
  if(mode==='empty')s.inventory.items=[];
  const q=window.__mindrealm;q.getSettings().reducedMotion=true;q.getSettings().tutorial=false;q.getSettings().uiScale=1;q.loadState(s);
  return C.legacyEvents[id].choices.findIndex(c=>c.effects.consume_item);
 },{id,mode});
 const snapshot=()=>page.evaluate(()=>JSON.stringify(window.__mindrealm.getState()));
 const choice=index=>page.locator(`[data-action="event-choice"][data-index="${index}"]`);
 const armed=()=>page.locator('.event-choice.is-armed').count();
 const cancel=async index=>choice(index).press('Escape');
 await load();const before=await snapshot(),height=await choice(0).evaluate(el=>el.getBoundingClientRect().height),sizing=await page.evaluate(async()=>(await import('/development/web-tests/helpers/event-ui-layout.mjs')).eventUISizing());
 await choice(0).click();check(await snapshot()===before,'first click preserves all run data');
 check(await page.locator('.modal').count()===0,'event choice opens no modal');
 check(await choice(0).evaluate(el=>el.getBoundingClientRect().height)>height,'first click lengthens its action box');
 check(await page.evaluate(async before=>{const m=await import('/development/web-tests/helpers/event-ui-layout.mjs');return m.eventUISizingStable(before,m.eventUISizing());},sizing),'expanding keeps other UI positions, dimensions and typography stable');
 check(await page.locator('.event-confirmation:not([hidden])').innerText()==='再次点击确认','expanded box shows the second-click hint');
 await choice(1).click();check(await armed()===1&&await choice(1).getAttribute('aria-expanded')==='true'&&await snapshot()===before,'switching actions moves confirmation without applying effects');
 await page.locator('.event-title-ribbon').click();check(await armed()===0&&await snapshot()===before,'clicking outside cancels without changing resources');
 await choice(0).click();await cancel(0);check(await armed()===0&&await snapshot()===before,'Escape collapses confirmation and stays in the event');
 await choice(0).press('Enter');check(await armed()===1&&await snapshot()===before,'keyboard activation first expands');
 await choice(0).press('Enter');check(await page.evaluate(()=>{const s=window.__mindrealm.getState();return s.focus===595&&s.spirit===62&&s.currentNode.eventData.outcome.index===0;}),'second keyboard activation applies exactly one exchange');
 check(await page.locator('[data-action="event-continue"]').isVisible(),'successful confirmation shows the continuation');
 await load('scrap_bridge');const materials=await snapshot();await choice(0).click();
 await page.locator('[data-event-unit="0"]').selectOption('u2');check(await armed()===0&&await snapshot()===materials,'changing the selected construction cancels pending confirmation');
 await choice(0).click();check(await snapshot()===materials,'replacement material still requires its own first click');
 await choice(0).click();check(await page.evaluate(()=>!window.__mindrealm.getState().units.some(u=>u.uid==='u2')),'second click consumes the displayed construction');
 const itemIndex=await load('item-exchange'),itemBefore=await snapshot();await choice(itemIndex).click();
 const secondItem=await page.locator(`[data-event-item="${itemIndex}"] option`).nth(1).getAttribute('value');
 await page.locator(`[data-event-item="${itemIndex}"]`).selectOption(secondItem);check(await armed()===0&&await snapshot()===itemBefore,'changing the selected item cancels pending confirmation');
 await choice(itemIndex).click();await choice(itemIndex).click();check(await page.evaluate(uid=>!window.__mindrealm.getState().inventory.items.some(item=>item.uid===uid),secondItem),'confirmation consumes only the selected item');
 const disabledIndex=await load('item-exchange','empty');check(!await choice(disabledIndex).isEnabled()&&await armed()===0,'missing material remains disabled and collapsed');
 check(await page.locator(`[data-event-card="${disabledIndex}"] .event-choice-hint`).isVisible(),'missing material keeps a visible condition hint');
 await load();await page.evaluate(()=>{window.__mindrealm.getSettings().reducedMotion=false;});
 for(const action of ['expand','switch','collapse']){
  await page.evaluate(async()=>{
   const {eventUISizing,eventUISizingStable}=await import('/development/web-tests/helpers/event-ui-layout.mjs'),baseline=eventUISizing();
   window.__eventUIStable=new Promise(resolve=>{let count=0,stable=true;const frame=()=>{stable&&=eventUISizingStable(baseline,eventUISizing());if(++count<40)requestAnimationFrame(frame);else resolve(stable);};frame();});
  });
  if(action==='collapse')await choice(1).press('Escape');else await choice(action==='expand'?0:1).click();
  check(await page.evaluate(()=>window.__eventUIStable),`${action} keeps all other UI stationary throughout 40 animation frames`);
 }
 await load('noise_market','fatal');await choice(0).click();check(await page.evaluate(()=>window.__mindrealm.getState().phase==='node'),'fatal exchange still waits for the second click');
 await choice(0).click();check(await page.evaluate(()=>window.__mindrealm.getState().phase==='lost'),'second click on a fatal exchange reaches failure summary');
 return {ok:true,checks:checks.length,details:checks};
}
