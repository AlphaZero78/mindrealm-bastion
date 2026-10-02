async page=>{
 await page.goto('http://127.0.0.1:4191/?qa=1');await page.waitForFunction(()=>window.__mindrealm);await page.setViewportSize({width:1366,height:768});
 const checks=[],check=(ok,name)=>{if(!ok)throw Error(name);checks.push(name);};
 const idle=()=>page.waitForFunction(()=>!window.__mindrealm.transitions.active&&!window.__mindrealm.dialogs.active);
 await page.evaluate(async()=>{const Run=await import('/web/core/state.js');const s=Run.newRun('bulk-ui');Run.enterNode(s,Run.availableNodes(s)[0].id);s.units=[];for(const c of s.terrain.cells){c.h=0;c.ramp=-1;}s.terrain.revision++;window.__mindrealm.loadState(s);});await idle();
 await page.locator('[data-action="tab-terrain"]').click();await page.locator('[data-action="brush"]').selectOption('square');
 const stroke=async(x,z)=>{const p=await page.evaluate(({x,z})=>{const f=window.__mindrealm.field,r=f.canvas.getBoundingClientRect(),p=f.project(x+.5,z+.5,f.heightAt(x,z));return{x:r.x+p.x,y:r.y+p.y};},{x,z});await page.mouse.click(p.x,p.y);};
 for(const [x,z]of [[14,12],[18,12],[14,16]])await stroke(x,z);
 check(await page.evaluate(()=>{const q=window.__mindrealm;return q.getContext().terrainCommands.length===3&&q.getContext().terrainBatch.cost===61&&q.getState().focus===99;}),'27 cell changes cross the 20-cell price tier in an unpaid draft');
 await page.locator('[data-action="undo"]').click();check(await page.evaluate(()=>window.__mindrealm.getContext().terrainBatch.cost===36),'undoing a draft brush recalculates the tier');await stroke(14,16);
 await page.locator('[data-action="terrain-commit"]').click();await page.waitForFunction(()=>!window.__mindrealm.dialogs.animations.size);
 check(/61 专注/.test(await page.locator('.modal').textContent()),'confirmation exposes exact escalating price');await page.screenshot({path:'mindrealm-experience-qa/batch-price-confirm.png'});
 await page.getByRole('button',{name:'支付并确认全部',exact:true}).click();await idle();
 check(await page.evaluate(()=>window.__mindrealm.getState().focus===38&&window.__mindrealm.getState().terrainEdits===27),'one confirmation charges all changes and retains cumulative count');
 await stroke(18,16);const old=await page.evaluate(()=>window.__mindrealm.getContext().terrainBatch.cost);await stroke(10,16);
 check(await page.evaluate(old=>{const q=window.__mindrealm;return q.getContext().terrainCommands.length===1&&q.getContext().terrainBatch.cost===old&&q.getState().focus===38;},old),'insufficient resources preserve the already staged draft and real resources');
 await page.locator('[data-action="terrain-cancel"]').click();await page.locator('[data-action="undo"]').click();
 check(await page.evaluate(()=>window.__mindrealm.getState().focus===99&&window.__mindrealm.getState().terrainEdits===0),'undo confirmed batch restores resources and tier counter');
 return {status:'BATCH_BROWSER_OK',checks};
}
