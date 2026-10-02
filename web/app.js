import * as Run from './core/state.js';
import * as Rules from './core/rules.js';
import {makeEncounter,startBattle,stepBattle} from './core/battle.js';
import * as Catalog from './core/content.js';
import * as Saves from './core/save.js';
import {normalizeDifficulty,difficultyProfile} from './core/difficulty.js';
import {Battlefield} from './view/battlefield.js';
import {AudioDirector} from './view/audio.js';
import {ScreenTransitions} from './view/transitions.js';
import {DialogTransitions} from './view/dialog-transitions.js';
import {normalizeResolution} from './view/display-settings.js';
import * as Screens from './screens.js';
import {icon,escapeHTML as e,labels,n,sprite,historyLabel} from './ui.js';

const app=document.querySelector('#app'),canvas=document.querySelector('#battlefield'),modalRoot=document.querySelector('#modal-root'),toastNode=document.querySelector('#toast');
const qa=new URLSearchParams(location.search).get('qa')==='1';
class MemoryStorage {data=new Map();getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
let volatileStorage=false;
let storage;
try{storage=qa?new MemoryStorage():localStorage;const key='mindrealm.web.storage-check';storage.setItem(key,'1');storage.removeItem(key);}catch{storage=new MemoryStorage();volatileStorage=true;}
const store=Saves.createSaveStore(storage,qa?'mindrealm.qa.v2':'mindrealm.web.v2');
let settings=store.loadSettings(),profile=store.loadProfile(),state=null,screen='menu',backScreen='menu';
let dialogCallbacks=new Map(),dialogFocus=null,pendingDialogFocus=null,toastTimer,lastTime=0,accumulator=0,lastHud=0;
const navigation=[];
const ctx={selectedUid:null,deployUid:null,warehouseTab:'stored',toolTab:'units',terrainTool:null,terrainCommands:[],terrainBatch:null,deployRotation:0,footerCollapsed:false,brush:'single',direction:0,hover:null,preview:null,speed:1,paused:false,threatOpen:true,tutorial:settings.tutorial,codexTab:'towers'};
const audio=new AudioDirector({onError:message=>toast(message,true)});
const field=new Battlefield(canvas,{onCell:cell=>cellClick(cell),onHover:cell=>hoverCell(cell),onCancel:()=>cancelSelection(),onError:message=>toast(message,true)});
let renderedScene=null;
const transitions=new ScreenTransitions({app,canvas,modalRoot,onActiveChange:()=>updateInteraction()});
const dialogs=new DialogTransitions({root:modalRoot,reducedMotion:()=>settings.reducedMotion,onActiveChange:()=>updateInteraction()});
audio.setVolumes({master:settings.master,music:settings.music,sfx:settings.effects,ui:settings.ui});
const demo=Run.newRun('CLEAR-SIGNAL');Run.enterNode(demo,Run.availableNodes(demo)[0].id);
// A static attract scene uses an isolated run; it never advances or writes a save.
for(const unit of demo.units){const preferred=Catalog.towers[unit.type].role==='ranged'?[[15,18],[24,18],[14,28]]:[[19,17],[21,18],[18,21],[22,28]];for(const [x,z]of preferred)if(Rules.deploy(demo,unit.uid,x,z).ok)break;}
field.setState(demo);

function toast(message,error=false){clearTimeout(toastTimer);toastNode.textContent=message;toastNode.className=`visible${error?' error':''}`;toastTimer=setTimeout(()=>toastNode.className='',error?6500:3500);}
function save(){if(!state)return true;const result=store.save(state);if(!result.ok)toast(result.reason,true);return result.ok;}
function persistSettings(){const result=store.saveSettings(settings);if(!result.ok)toast(result.reason,true);return result.ok;}
function settle(){if(state&&['won','lost'].includes(state.phase)){profile=Saves.settleProfile(profile,state);const result=store.saveProfile(profile);if(!result.ok)toast(result.reason,true);}}
function sync(message){settle();save();render();if(message)toast(message);}
function complete(result,message,sound='confirm'){if(!result?.ok){toast(result?.reason||'操作未完成',true);audio.play('error');return false;}if(sound)audio.play(sound);ctx.preview=null;sync(message||result.reason);return true;}
function visibleBattle(){return screen==='run'&&state&&['prep','battle'].includes(state.phase);}
function interactionLocked(){return transitions.active||dialogs.active;}
function updateInteraction(){const locked=interactionLocked();app.inert=locked;modalRoot.inert=transitions.active;field.setInteractive(!!visibleBattle()&&!modalRoot.children.length&&!locked);if(!locked&&pendingDialogFocus){const target=pendingDialogFocus;pendingDialogFocus=null;if(target.isConnected)target.focus?.({preventScroll:true});}}
function sceneIdentity(){
 if(screen!=='run')return screen==='codex'?`${screen}:${ctx.codexTab}`:screen;
 const reward=state?.rewardQueue?.[0];
 return JSON.stringify([screen,state?.seed,state?.phase,state?.act,state?.currentNode?.id,state?.stats.completedNodes,state?.phase==='reward'?[state.rewardQueue.length,reward?.kind,reward?.options]:null]);
}
function deploymentUnit(){const u=state?.units.find(u=>u.uid===ctx.deployUid);return u?{...u,rotation:ctx.deployRotation}:null;}
function displayState(){return ctx.terrainBatch?.trial||state;}
function activeSelection(){return {unit:deploymentUnit(),selectedUid:ctx.selectedUid,terrainTool:ctx.terrainTool,brush:ctx.brush,direction:ctx.direction,preview:ctx.preview,previewOrigin:modalRoot.children.length?ctx.hover:null,reducedMotion:settings.reducedMotion};}
function render(){
 ctx.tutorial=settings.tutorial;
 if(screen==='run'&&!state)screen='menu';
 const nextScene=sceneIdentity(),changing=renderedScene!==null&&nextScene!==renderedScene;
 dialogs.finish();
 const ticket=changing?transitions.capture({reducedMotion:settings.reducedMotion}):null;
 if(!changing)transitions.finish('refresh');
 renderedScene=nextScene;
 if(screen==='menu')app.innerHTML=Screens.menu(store.has(),{...profile,maxPressure:profile.unlockedPressure});
 else if(screen==='codex')app.innerHTML=Screens.codexScreen(profile,ctx.codexTab);
 else if(screen==='settings')app.innerHTML=Screens.settingsScreen({...settings,sfx:settings.effects,scale:settings.uiScale});
 else if(screen==='help')app.innerHTML=Screens.helpScreen();
 else if(screen==='credits')app.innerHTML=Screens.creditsScreen();
 else if(screen==='run'){
  if(state.phase==='map')app.innerHTML=Screens.mapScreen(state,ctx.mapHover);
  else if(['prep','battle'].includes(state.phase))app.innerHTML=Screens.battleScreen(state,ctx);
  else if(state.phase==='reward')app.innerHTML=Screens.rewardScreen(state);
  else if(state.phase==='node')app.innerHTML=Screens.nodeScreen(state);
  else app.innerHTML=Screens.summaryScreen(state,profile);
 }
 const tutorial=app.querySelector('.tutorial');if(tutorial)app.querySelector('.battle-sidebar')?.append(tutorial);
 const battle=visibleBattle();
 document.body.dataset.screen=battle?'battle':screen;
 field.setState(battle?displayState():demo);
 field.setEncounter?.(battle?(state.phase==='battle'?state.battle:makeEncounter(state,state.currentNode)):null);
 field.setSelection(battle?activeSelection():{});
 updateInteraction();
 audio.setScene(screen==='run'?state.phase:screen);audio.update({danger:state?.battle?.danger||0,boss:state?.currentNode?.type==='boss',paused:state?.phase==='battle'&&(ctx.paused||screen!=='run')});
 applyScale();
 if(state?.phase==='map'&&screen==='run'){bindRouteMap();const sc=document.querySelector('#map-scroll'),node=Run.availableNodes(state)[0];if(sc)sc.scrollTop=Math.max(0,sc.scrollHeight-160-(node?.floor||0)*100-sc.clientHeight*.6);}
 updateHud();updatePlacementStatus();
 field.render(performance.now());
 transitions.commit(ticket);
}
function applyScale(){
 const requested=settings.uiScale||1,scale=Math.max(.75,Math.min(requested,innerWidth/850,innerHeight/520));
 document.documentElement.style.setProperty('--user-scale',scale);
 app.style.zoom=scale;app.style.width=`calc(100vw / ${scale})`;app.style.height=`calc(100dvh / ${scale})`;
 modalRoot.style.zoom=scale;
 // Commit the viewport before accepting pointer input; a deferred resize could
 // reinterpret a drag against the preceding menu or window dimensions.
 if(visibleBattle()){const area=document.querySelector('#battle-viewport').getBoundingClientRect();modalRoot.style.setProperty('--preview-width',`${area.left/scale-12}px`);const sidebar=document.querySelector('.battle-sidebar').getBoundingClientRect();document.documentElement.style.setProperty('--battle-toast-top',`${sidebar.top+8}px`);document.documentElement.style.setProperty('--battle-toast-width',`${sidebar.width-16}px`);Object.assign(canvas.style,{left:`${area.left}px`,top:`${area.top}px`,width:`${area.width}px`,height:`${area.height}px`,right:'auto',bottom:'auto'});}else Object.assign(canvas.style,{left:'0',top:'0',width:'100%',height:'100%',right:'auto',bottom:'auto'});
 field.setResolution(settings.resolution);field.resize();updateResolutionInfo();
}
function updateResolutionInfo(){const output=document.querySelector('#resolution-status');if(output)output.textContent=`当前画面 ${canvas.width} × ${canvas.height} · 界面文字保持清晰`;}
function closeDialog(){pendingDialogFocus=dialogFocus;dialogFocus=null;if(transitions.active){dialogs.finish();modalRoot.replaceChildren();}else dialogs.close();dialogCallbacks.clear();field.setSelection(visibleBattle()?activeSelection():{});updateInteraction();}
function modal(title,body,buttons=[{text:'关闭'}],wide=false){
 pendingDialogFocus=null;dialogFocus=document.activeElement;dialogCallbacks.clear();
 const footer=buttons.map((b,i)=>{const id=`dialog-${i}`;if(b.run)dialogCallbacks.set(id,b.run);return `<button class="btn ${b.primary?'primary':''} ${b.danger?'danger':''}" data-modal="${id}" ${b.disabled?'disabled':''}>${b.text}</button>`;}).join('');
 modalRoot.innerHTML=`<div class="modal-backdrop ${visibleBattle()&&ctx.preview?'field-preview-modal':''}"><section class="modal panel ${wide?'wide-modal':''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-head"><h2 id="dialog-title">${title}</h2><button class="icon-btn" data-modal="close" aria-label="取消并关闭">${icon('close')}</button></div><div class="modal-body">${body}</div><div class="modal-footer">${footer}</div></section></div>`;
 const pressureInput=modalRoot.querySelector('#pressure-input');if(pressureInput){const detail=document.createElement('div');detail.className='difficulty-preview-info';detail.tabIndex=0;detail.setAttribute('aria-label','难度效果说明，可滚动查看');detail.setAttribute('aria-live','polite');pressureInput.parentElement.after(detail);const update=()=>{detail.innerHTML=Screens.difficultyDetails(Number(pressureInput.value));};pressureInput.addEventListener('change',update);for(const preview of modalRoot.querySelectorAll('[data-pressure-preview]')){const show=()=>{detail.innerHTML=Screens.difficultyDetails(Number(preview.dataset.pressurePreview),true);};preview.addEventListener('pointerenter',show);preview.addEventListener('focus',show);preview.addEventListener('pointerleave',()=>{if(document.activeElement!==preview)update();});preview.addEventListener('blur',update);}update();}
 field.setSelection(visibleBattle()?activeSelection():{});field.setInteractive?.(false);dialogs.open();const dialog=modalRoot.querySelector('.modal');requestAnimationFrame(()=>{if(!dialog?.isConnected)return;dialog.scrollTop=0;dialog.querySelector('input, select')?.focus({preventScroll:true});if(!dialog.contains(document.activeElement))dialog.querySelector('[data-modal="close"]')?.focus({preventScroll:true});});
}
function confirm(title,body,run,text='确认'){modal(title,body,[{text:'取消'},{text,primary:true,run}]);}
function clearInput(){ctx.terrainCommands=[];ctx.terrainBatch=null;ctx.deployRotation=0;ctx.deployUid=null;ctx.terrainTool=null;ctx.hover=null;ctx.preview=null;ctx.selectedUid=null;field.setSelection({});updatePlacementStatus();}
function cancelSelection(){if(modalRoot.children.length){closeDialog();return;}const hadDraft=!!ctx.terrainBatch;clearTimeout(toastTimer);toastNode.className='';clearInput();if(visibleBattle()){if(hadDraft)render();else document.querySelector('#inspector').innerHTML='';}audio.play('cancel');}
function startNew(){
 modal('开始新的远征',`<p>控制压力通过敌人强度和机制提升挑战；敌群数量、奖励、开局资源和服务费用不随等级改变。通关当前压力后解锁下一级。</p><p class="muted">相同种子、内容池与难度规则会产生相同的战场、路线和奖励。</p>${store.has()?'<div class="danger-line">确认后将替换当前浏览器中的单局进度。图鉴、碎片与已解锁内容会保留。</div>':''}<label class="field">远征种子<input id="seed-input" maxlength="64" value="${new Date().toISOString().slice(0,10)}" autocomplete="off"></label><label class="field">控制压力<select id="pressure-input">${Screens.pressureOptions(profile.unlockedPressure)}</select></label>${Screens.pressurePreviewLevels(profile.unlockedPressure)}<small>开局：100 精神稳定 · 99 专注 · 20 带宽<br>仓库：3 近战 · 3 远程 · 1 支援</small>`,[{text:'取消'},{text:'建立清醒信号',primary:true,run:()=>{const seed=document.querySelector('#seed-input').value.trim()||'CLEAR-SIGNAL',pressure=normalizeDifficulty(Number(document.querySelector('#pressure-input').value));if(pressure>normalizeDifficulty(profile.unlockedPressure)){toast('请先通关已开放的压力等级。',true);return false;}state=Run.newRun(seed,pressure,profile);clearInput();ctx.paused=false;ctx.speed=1;ctx.mapHover=null;screen='run';save();render();}}]);
}
function selectUnit(uid,move=false){const u=state?.units.find(x=>x.uid===uid);if(!u)return;if(ctx.terrainBatch){toast('先确认或取消地形草稿，再选择构造。',true);return;}ctx.selectedUid=uid;ctx.deployRotation=u.rotation||0;ctx.terrainTool=null;ctx.toolTab='units';ctx.deployUid=state.phase==='prep'&&u.hp>0&&(u.x===null||move)?uid:null;ctx.preview=null;if(visibleBattle()){document.querySelector('#inspector').innerHTML=Screens.inspector(state,ctx);field.setSelection(activeSelection());for(const card of app.querySelectorAll('.unit-card'))card.classList.toggle('selected',card.dataset.uid===uid);}updatePlacementStatus();audio.play('select');}
// Keep explanations outside the playfield; selection never changes its geometry.
function updatePlacementStatus(){
 const status=document.querySelector('#placement-status');if(!status||!visibleBattle())return;
 document.querySelector('.battle-screen').dataset.placing=String(!!(ctx.deployUid||ctx.terrainTool));
 const unit=state.units.find(u=>u.uid===(ctx.deployUid||ctx.selectedUid)),p=ctx.preview;
 let detail=state.phase==='battle'?'战斗中防线已锁定 · 点击构造查看射程与状态':'选择构造或拖到战场 · 滚轮缩放 · 右键 / Esc 取消';
 if(ctx.deployUid&&unit){const stats=Rules.unitStats(state,deploymentUnit()||unit);detail=p?`${Catalog.towers[unit.type].name} · ${p.reason} · 带宽 ${p.used??Rules.bandwidthState(state).used}/${p.cap??Rules.bandwidthState(state).cap}`:`${Catalog.towers[unit.type].name} · ${stats.footprint.join('×')} 占地 · 需要 ${stats.bandwidth} 带宽 · ${Catalog.towers[unit.type].role==='ranged'?'放在等高高台':Catalog.towers[unit.type].role==='melee'?'放在等高地面':'放在等高空地'}`;}
 else if(ctx.terrainTool)detail=`${ctx.terrainBatch?`草稿 ${ctx.terrainCommands.length} 笔 / ${ctx.terrainBatch.cost} 专注 · `:''}${p?p.reason:'点击连续改造 · 拖动移动视角'} · 确认全部后支付`;
 else if(unit)detail=`${Catalog.towers[unit.type].name} · 已显示实际覆盖范围 · 详细属性与操作在左栏`;
 if(ctx.deployUid&&unit&&Catalog.towers[unit.type].footprint[0]!==Catalog.towers[unit.type].footprint[1])detail+=` · R 转向 ${ctx.deployRotation*90}°`;
 if(unit&&Catalog.towers[unit.type].role==='support')detail+=' · 青色轮廓：范围内可维修 / 受增益构造'+(['bandwidth_plus','resistance_plus'].includes(Catalog.towers[unit.type].ability)?' · 带宽 / 抗性对全局生效':'');

 const showRange=!!unit&&(unit.x!==null||ctx.hover);
 const html=`<div class="placement-status ${p&&!p.ok?'invalid':''}">${icon(p?(p.ok?'check':'close'):unit?'range':'info')}<span>${e(detail)}</span>${showRange?'<span class="range-legend"><i></i>实线：可作用区域 · 虚线：视线遮挡</span>':''}</div>`;
 if(status.innerHTML!==html)status.innerHTML=html;
}
const dragImage=document.createElement('canvas');dragImage.width=dragImage.height=1;dragImage.setAttribute('aria-hidden','true');Object.assign(dragImage.style,{position:'fixed',left:'-10px',top:'0',pointerEvents:'none'});document.body.append(dragImage);
function hoverCell(cell){if(modalRoot.children.length&&!cell)return;ctx.hover=cell;if(!visibleBattle())return;let p=null;if(cell&&state.phase==='prep'){
 if(ctx.deployUid){const unit=deploymentUnit();if(unit)p=Rules.placement(state,unit,cell.x,cell.z);}
 else if(ctx.terrainTool)p=Rules.previewTerrain(displayState(),{...cell,tool:ctx.terrainTool,brush:ctx.brush,direction:ctx.direction});
 }ctx.preview=p;updatePlacementStatus();field.selection={...activeSelection()};}
function cellClick(cell){if(!visibleBattle()||modalRoot.children.length||interactionLocked()||!cell)return;if(state.phase==='prep'&&ctx.deployUid){const uid=ctx.deployUid,unit=deploymentUnit(),p=Rules.placement(state,unit,cell.x,cell.z);if(!p.ok){audio.play('error');return;}const deploy=()=>{if(complete(Rules.deploy(state,uid,cell.x,cell.z,unit.rotation),undefined,'deploy')){ctx.deployUid=null;ctx.preview=null;render();}};if(p.cost>0)confirm('确认维护与部署',`<p>${Catalog.towers[unit.type].name} → 坐标 ${cell.x}, ${cell.z}</p><div class="cost-line">消耗 ${p.cost} 专注 · 剩余 ${n(state.focus-p.cost)}<br>部署后带宽 ${p.used} / ${p.cap}</div><small>取消不扣费，构造保留当前位置。</small>`,deploy,'支付并部署');else deploy();return;}
 if(state.phase==='prep'&&ctx.terrainTool){const command={...cell,tool:ctx.terrainTool,brush:ctx.brush,direction:ctx.direction};setTerrainDraft([...ctx.terrainCommands,command]);return;}
 const u=state.units.find(u=>u.x!==null&&Rules.footprint(state,u).some(c=>c.x===cell.x&&c.z===cell.z));if(u)selectUnit(u.uid);else cancelSelection();
}
function setTerrainDraft(commands){
 const batch=commands.length?Rules.previewTerrainBatch(state,commands):null;
 if(batch&&!batch.ok){toast(batch.reason,true);audio.play('error');return false;}
 ctx.terrainCommands=commands;ctx.terrainBatch=batch;ctx.preview=null;render();return true;
}
function bindRouteMap(){
 const sc=app.querySelector('#map-scroll'),tip=app.querySelector('#route-tooltip');if(!sc||!tip)return;
 let drag=null,suppress=false;
 const hide=()=>{tip.hidden=true;};
 const show=node=>{if(!node||drag)return;tip.innerHTML=Screens.mapDetail(state,node.dataset.id);tip.hidden=false;const rect=node.getBoundingClientRect(),scale=app.getBoundingClientRect().width/app.offsetWidth,box=tip.getBoundingClientRect(),left=Math.min(innerWidth-box.width-14,Math.max(14,rect.right+14)),top=Math.max(12,Math.min(innerHeight-box.height-12,rect.top-box.height/2+rect.height/2));tip.style.left=`${left/scale}px`;tip.style.top=`${top/scale}px`;};
 sc.addEventListener('pointerover',event=>show(event.target.closest('.map-node')));
 sc.addEventListener('pointerout',event=>{if(event.target.closest('.map-node')!==event.relatedTarget?.closest?.('.map-node'))hide();});
 sc.addEventListener('focusin',event=>show(event.target.closest('.map-node')));sc.addEventListener('focusout',hide);sc.addEventListener('scroll',hide);
 sc.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={x:event.clientX,y:event.clientY,left:sc.scrollLeft,top:sc.scrollTop,pointer:event.pointerId,moved:false};suppress=false;});
 sc.addEventListener('pointermove',event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(drag.moved||Math.hypot(dx,dy)>5){drag.moved=true;hide();sc.setPointerCapture(event.pointerId);sc.scrollLeft=drag.left-dx;sc.scrollTop=drag.top-dy;sc.classList.add('dragging');}});
 sc.addEventListener('pointerup',event=>{if(!drag)return;suppress=drag.moved;drag=null;sc.classList.remove('dragging');if(sc.hasPointerCapture(event.pointerId))sc.releasePointerCapture(event.pointerId);});
 sc.addEventListener('pointercancel',()=>{drag=null;suppress=true;sc.classList.remove('dragging');});
 sc.addEventListener('click',event=>{if(suppress){event.preventDefault();event.stopPropagation();suppress=false;}},true);
}
function unitDialog(uid){const u=state.units.find(u=>u.uid===uid);if(!u)return;const t=Catalog.towers[u.type],s=Rules.unitStats(state,u);modal(`${t.name} · T${u.tier}${u.branch||''}`,`${sprite(u.type,'towers','big',u)}<p>${t.description}</p><div class="stats-grid"><div>耐久 ${n(u.hp)} / ${n(s.maxHp)}</div><div>攻击 ${n(s.attack)}</div><div>射程 ${n(s.range)}</div><div>带宽 ${s.bandwidth}</div></div><p>${u.branch?t.branches[u.branch].description:'尚未选择成长分支'}</p>`);}
function upgradeDialog(uid,{free=false,fusion=false}={}){const u=state.units.find(u=>u.uid===uid);if(!u)return;const t=Catalog.towers[u.type];if(u.tier>=3){toast('该构造已达到最高阶。',true);return;}const materials=fusion?state.units.filter(x=>x.uid!==uid&&x.type===u.type&&x.tier===u.tier&&(u.tier===1||x.branch===u.branch)).slice(0,2):[];if(fusion&&materials.length<2){toast('融合需要另外两个同类型、同阶、同分支构造。',true);return;}
 const branches=u.tier===1?['A','B']:[u.branch],cost=free||fusion?0:Rules.upgradeCost(state,u);
 const body=`<p>${fusion?'以当前构造为核心，消耗另外两个匹配构造。':'比较升级后的属性和效果，选择这座构造的发展方向。'}</p>${fusion?`<div class="danger-line">材料：${materials.map(x=>`${t.name} T${x.tier}${x.branch||''} · ${n(x.hp)} 耐久`).join('<br>')}<br>继承材料总耐久比例，核心保留原位置。</div>`:`<div class="cost-line">${free?'本次升阶免费':`消耗 ${cost} 专注 · 当前 ${n(state.focus)}`}</div>`}<div class="choice-grid">${branches.map(branch=>{const s=Rules.unitStats(state,{...u,tier:u.tier+1,branch});return `<article class="choice-card"><span class="tag">T${u.tier+1} · ${branch}</span>${sprite(u.type,'towers','big',{...u,tier:u.tier+1,branch})}<h3>${t.branches[branch].name}</h3>${Screens.upgradeComparison(state,u,branch)}<button class="btn primary wide" data-dialog-upgrade="${branch}" ${cost>state.focus?'disabled':''}>确认 ${branch} 分支</button></article>`;}).join('')}</div>`;
 modal(fusion?'确认三件融合':'选择升级分支',body,[{text:'取消'}],true);
 for(const b of modalRoot.querySelectorAll('[data-dialog-upgrade]'))b.addEventListener('click',()=>{const branch=b.dataset.dialogUpgrade,result=fusion?Rules.fuse(state,uid,branch):state.phase==='node'?Run.nodeAction(state,'upgrade',{uid,branch}):Rules.upgrade(state,uid,branch,{free});if(complete(result,undefined,'upgrade'))closeDialog();});
}
function repairDialog(uid,free=false){const u=state.units.find(u=>u.uid===uid);if(!u)return;const s=Rules.unitStats(state,u),cost=free?0:Rules.repairCost(state,u);confirm('确认维修',`<p>${s.name}：耐久 ${n(u.hp)} → ${n(s.maxHp)}</p><div class="cost-line">${free?'本次维修免费':`消耗 ${cost} 专注 · 剩余 ${n(state.focus-cost)}`}</div><p>维修后将回到仓库，需要重新选择部署位置。</p>`,()=>complete(state.phase==='node'?Run.nodeAction(state,'repair',{uid}):Rules.repair(state,uid)),free?'免费维修并离开':'支付并维修');}
function campPick(action){const units=state.units.filter(u=>action==='repair'?u.hp<Rules.unitStats(state,u).maxHp:u.tier<3);if(!units.length){toast(action==='repair'?'没有需要维修的构造，可以选择其他服务。':'所有构造均已达到 T3，可以选择其他服务。',true);return;}modal(action==='repair'?'选择免费维修的构造':'选择免费升阶的构造',`<div class="service-units">${units.map(u=>`<button class="option-button" data-camp-uid="${u.uid}">${sprite(u.type,'towers','small',u)}<span><strong>${Catalog.towers[u.type].name} T${u.tier}</strong><small>耐久 ${n(u.hp)} / ${n(Rules.unitStats(state,u).maxHp)}</small></span></button>`).join('')}</div>`,[{text:'取消'}],true);for(const b of modalRoot.querySelectorAll('[data-camp-uid]'))b.addEventListener('click',()=>action==='repair'?repairDialog(b.dataset.campUid,true):upgradeDialog(b.dataset.campUid,{free:true}));}
function openBuild(){if(!state){toast('开始远征后可以查看当前构筑。');return;}const sorted=Object.entries(state.stats.damageByUnit).sort((a,b)=>b[1]-a[1]);modal('当前心智构筑',`<h3>核心输出</h3>${sorted.slice(0,6).map(([uid,damage])=>`<div class="damage-row"><span>${e(state.unitOrigins?.[uid]?.name||Catalog.towers[state.units.find(u=>u.uid===uid)?.type]?.name||uid)}</span><span>${n(damage)} 伤害</span></div>`).join('')||'<p>战斗开始后记录每个构造的贡献。</p>'}<hr><h3>收藏品 · ${state.relics.length}</h3>${state.relics.map(id=>`<p style="margin-top:12px"><strong class="gold">${Catalog.relics[id].name}</strong><br>${Catalog.relics[id].description}</p>`).join('')||'<p>尚未获得收藏品</p>'}<hr><h3>天赋 · ${state.talents.length}</h3>${state.talents.map(id=>`<p style="margin-top:12px"><strong class="mint">${Catalog.talents[id].name}</strong><br>${Catalog.talents[id].description}</p>`).join('')||'<p>到达偶数精神深度时获得天赋选择</p>'}<hr><small>${state.depth>=12?'已达到最大精神深度':'经验 '+state.xp+' / '+(200+(state.depth-1)*125)} · 基础抗性 ${state.resistance}</small>`,[{text:'返回'}]);}
function openLog(){if(!state){toast('远征开始后才会产生战斗记录。');return;}const logs=state.stats.pressureLog||[];modal('战斗与精神压力记录',`<div class="row spread"><span class="coral">突破伤害 ${n(state.stats.breachDamage)}</span><span class="gold">死亡压力 ${n(state.stats.pressure)}</span></div><hr><div class="scroll-panel">${logs.slice(-150).reverse().map(log=>`<div class="log-line">${e(log.name||log.source||log.enemy||'异常信号')}<br>原始 ${n(log.raw??log.original)} · 距离 ${n(log.distance)} · 传入 ${n((log.modified??log.raw)-(log.distanceReduction??0))}<br>抗性吸收 ${n(Math.min(log.resistance,(log.modified??log.raw)-(log.distanceReduction??0)))} → 最终伤害 ${n(log.damage??log.final)}</div>`).join('')||'<p>尚未记录死亡压力。</p>'}</div><hr><div class="scroll-panel">${state.stats.history.slice(-60).reverse().map(h=>`<div class="log-line">${e(historyLabel(h))}</div>`).join('')}</div>`,[{text:'返回'}],true);}
function catalogInfo(kind,id,encounterState=null){const c=Catalog[kind]?.[id];if(!c)return;if(kind==='enemies'){modal(c.name,Screens.enemyDetails(encounterState,c),[{text:'了解'}],true);return;}modal(c.name,`${kind==='towers'||kind==='enemies'?sprite(id,kind,'big'):icon(kind==='relics'?'treasure':'depth')}<p>${e(c.description||c.theme||'')}</p>${kind==='towers'?`<div class="stats-grid"><div>耐久 ${c.hp}</div><div>攻击 ${c.attack}</div><div>射程 ${c.range}</div><div>带宽 ${c.bandwidth}</div></div><p>A · ${c.branches.A.name}：${c.branches.A.description}</p><p>B · ${c.branches.B.name}：${c.branches.B.description}</p>`:kind==='enemies'?`<div class="stats-grid"><div>基础生命 ${c.hp}</div><div>攻击 ${c.attack}</div><div>护甲 ${c.armor}</div><div>原始压力 ${c.pressure}</div></div><p>${c.air?'飞行 · 不受地面通路限制':'地面 · 寻路与破障'}<br>突破伤害 ${c.core_damage} · ${c.kind==='boss'?'到达火种后持续攻击':c.kind==='elite'?'精英到达火种后持续攻击':'突破后离场'}</p>`:''}`);}
function openEncounter(){const encounter=state.battle||makeEncounter(state,state.currentNode);modal('本场敌群情报',`${Screens.difficultyDetails(state)}<p>${encounter.total} 个计划敌人 · 增援总预算 ${encounter.reinforcementBudget}</p><div class="scroll-panel">${encounter.groups.map(g=>`<div class="log-line"><strong class="gold">敌群 ${g.index+1} · ${n(g.at)} 秒起</strong><br>${g.count} 个敌人 · ${g.entries.map(id=>Rules.entriesOf(state).find(x=>x.id===id)?.name||id).join(' / ')}<br>${g.types.map(id=>Catalog.enemies[id]?.name||id).join(' · ')}</div>`).join('')}<hr>${encounter.queue.map(q=>`<div class="log-line">${n(q.at)} 秒 · ${Catalog.enemies[q.type].name} · ${Rules.entriesOf(state).find(x=>x.id===q.entry)?.name}</div>`).join('')}</div>`,[{text:'了解'}]);}

async function dispatch(action,target){
 if(interactionLocked())return;
 const d=target?.dataset||{};
 if(action==='new'){startNew();return;}
 if(action==='continue'){const loaded=store.load();if(!loaded.ok){toast(loaded.reason,true);return;}state=loaded.state;screen='run';navigation.length=0;clearInput();ctx.footerCollapsed=false;ctx.paused=false;settle();render();if(loaded.recovered)toast(loaded.reason,true);else if(difficultyProfile(state).legacy)toast('这次远征沿用旧难度规则；新建远征将采用新的敌人强度与机制。');return;}
 if(action==='menu'){if(screen==='run'&&state?.phase==='battle'){confirm('返回主菜单',`<p>本场战斗的部署已保存。下次继续将回到开战前，重新开始这一场战斗。</p>`,()=>{save();ctx.paused=true;screen='menu';clearInput();render();},'保存并返回');}else{save();screen='menu';clearInput();render();}return;}
 if(['settings','help','credits','codex'].includes(action)){if(screen!==action)navigation.push(screen);backScreen=screen;screen=action;render();return;}
 if(action==='back'){screen=navigation.pop()||'menu';render();return;}
 if(action==='refresh'){render();return;}
 if(action==='boss-intel'){modal('控制信号情报',Screens.bossIntel(state));return;}
 if(action==='build'){openBuild();return;}
 if(action==='log'){openLog();return;}
 if(action==='codex-tab'){ctx.codexTab=d.tab;render();return;}
 if(action==='catalog-info'){catalogInfo(d.kind,d.id);return;}
 if(action==='enemy-info'){catalogInfo('enemies',d.id,d.bossPreview?{...state,floor:Catalog.acts[state.act].floors-1}:state);return;}
 if(action==='unit-info'){unitDialog(d.uid);return;}
 if(action==='map-node'||action==='enter'){clearInput();const result=Run.enterNode(state,d.id);if(result.ok){ctx.mapHover=null;ctx.footerCollapsed=false;ctx.warehouseTab='stored';ctx.toolTab='units';ctx.threatOpen=true;field.setState(state);field.focus();}complete(result);return;}
 if(action==='select-unit'){selectUnit(d.uid);return;}
 if(action==='clear-selection'){cancelSelection();return;}
 if(action==='move'){selectUnit(d.uid,true);return;}
 if(action==='withdraw'){const u=state.units.find(u=>u.uid===d.uid),cost=Rules.moveCost(state,u);confirm('确认撤回构造',`<p>${Catalog.towers[u.type].name} 将返回仓库。</p><div class="cost-line">消耗 ${cost} 专注 · 剩余 ${n(state.focus-cost)}</div>`,()=>complete(Rules.withdraw(state,d.uid)),'支付并撤回');return;}
 if(action==='repair'){repairDialog(d.uid);return;}
 if(action==='upgrade'||action==='fuse'){upgradeDialog(d.uid,{fusion:action==='fuse'});return;}
 if(action==='tab-units'){if(ctx.terrainBatch){toast('先确认或取消地形草稿。',true);return;}ctx.toolTab='units';ctx.terrainTool=null;ctx.preview=null;render();return;}
 if(action==='tab-terrain'){ctx.deployUid=null;ctx.preview=null;ctx.toolTab='terrain';ctx.terrainTool='raise';render();return;}
 if(action==='warehouse-tab'){ctx.warehouseTab=d.tab;render();return;}
 if(action==='terrain-tool'){ctx.terrainTool=d.tool;ctx.deployUid=null;ctx.preview=null;render();return;}
 if(action==='undo'){if(ctx.terrainCommands.length)setTerrainDraft(ctx.terrainCommands.slice(0,-1));else complete(Rules.undoTerrain(state),'已撤销上次地形操作并退还专注。');return;}
 if(action==='terrain-cancel'){setTerrainDraft([]);toast('草稿已取消，地形和专注保持原样。');return;}
 if(action==='terrain-commit'){const batch=Rules.previewTerrainBatch(state,ctx.terrainCommands);if(!batch.ok){toast(batch.reason,true);return;}const commands=ctx.terrainCommands.map(c=>({...c}));confirm('确认整批地形改造',`<p>${commands.length} 笔 · ${batch.count} 格次，合并修改 ${batch.cells.length} 格。</p><div class="cost-line">合计 ${batch.cost} 专注 · 确认后剩余 ${n(state.focus-batch.cost)}<br>本场累计 ${batch.trial.terrainEdits} 格次 · 下一格 ${Rules.terrainCost(batch.trial,1)} 专注</div><p>草稿中的地形与路径将一次生效。返回后可继续编辑。</p>`,()=>{const result=Rules.applyTerrainBatch(state,commands);if(result.ok){ctx.terrainCommands=[];ctx.terrainBatch=null;ctx.preview=null;}complete(result,'整批地形已确认。','terrain');},'支付并确认全部');return;}
 if(action==='toggle-footer'){ctx.footerCollapsed=!ctx.footerCollapsed;render();return;}
 if(action==='camera'){if(d.dir==='focus')field.focus();else if(d.dir==='left'||d.dir==='right')field.rotate?.((d.dir==='left'?-1:1)*Math.PI/4);else field.zoom?.(d.dir);return;}
 if(action==='encounter'){openEncounter();return;}
 if(action==='start'){if(ctx.terrainBatch){toast('先确认或取消地形草稿，再开始战斗。',true);return;}const live=state.units.filter(u=>u.x!==null&&u.hp>0),bw=Rules.bandwidthState(state);confirm('锁定防线并开始战斗',`<p>${live.length} 个构造已部署，带宽 ${bw.used} / ${bw.cap}。</p>${live.length?'':'<div class="danger-line">当前没有部署任何构造，敌人将直接威胁火种。</div>'}<p>战斗中可暂停和调整速度。部署、维修、成长与地形将在本场战斗中锁定。</p>`,()=>{clearInput();if(!save())return;const result=startBattle(state);if(result.ok){ctx.paused=false;ctx.footerCollapsed=true;ctx.toolTab='units';save();render();audio.play('heavy');}else toast(result.reason,true);},'开始战斗');return;}
 if(action==='pause'){ctx.paused=!ctx.paused;render();return;}
 if(action==='speed'){ctx.speed=Number(d.speed);render();return;}
 if(action==='skip-tutorial'){settings.tutorial=false;persistSettings();render();return;}
 if(action==='reward'){clearInput();complete(Run.chooseReward(state,d.id));return;}
 if(action==='camp-heal'){confirm('在营地休息','<p>恢复精神后会离开营地，本节点其他服务不再可用。</p>',()=>complete(Run.nodeAction(state,'heal')),'休息并离开');return;}
 if(action==='camp-repair'||action==='camp-upgrade'){campPick(action==='camp-repair'?'repair':'upgrade');return;}
 if(action==='node-leave'){complete(Run.nodeAction(state,'leave'));return;}
 if(action==='buy-unit'||action==='buy-relic'){const item=state.currentNode.stock[action==='buy-unit'?'units':'relics'].find(x=>x.key===d.id),c=action==='buy-unit'?Catalog.towers[item.id]:Catalog.relics[item.id],cost=Run.servicePrice(state,action==='buy-unit'?80:120);confirm('确认购买',`<p>${c.name}：${c.description}</p><div class="cost-line">消耗 ${cost} 专注 · 剩余 ${n(state.focus-cost)}</div>`,()=>complete(Run.nodeAction(state,action,{id:d.id})),'支付并购买');return;}
 if(action==='treasure'){confirm('选择这件收藏品',`<p>${Catalog.relics[d.id].name}</p><p>${Catalog.relics[d.id].description}</p><small>带走后离开宝库。</small>`,()=>complete(Run.nodeAction(state,'treasure',{id:d.id})),'带走并离开');return;}
 if(action==='empty-treasure'){complete(Run.nodeAction(state,'treasure'));return;}
 if(action==='event-choice'){const preview=Run.eventPreview(state,Number(d.index));confirm('确认事件选择',`<p>${e(preview.label)}</p><div class="cost-line">${preview.details.map(e).join('<br>')}</div>`,()=>complete(Run.nodeAction(state,'event',{index:Number(d.index)})),'接受结果');return;}
 if(action==='fullscreen'){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('浏览器未允许全屏，可使用 F11。',true);}return;}
 if(action==='unlock-content'){const draft=Run.cloneState(profile),result=Saves.unlockContent(draft,d.id);if(result.ok){const saved=store.saveProfile(draft);if(saved.ok){profile=draft;render();toast(result.reason);}else toast(saved.reason,true);}else toast(result.reason,true);return;}
}
app.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(interactionLocked()||!button||button.disabled||button.tagName==='SELECT'||button.tagName==='INPUT')return;audio.unlock();if(!['select-unit','move','clear-selection','enter','reward','undo','node-leave','empty-treasure'].includes(button.dataset.action))audio.play('click');Promise.resolve(dispatch(button.dataset.action,button)).catch(reportError);});
app.addEventListener('change',event=>{const t=event.target,d=t.dataset;try{
 if(d.action==='priority')complete(Rules.setPriority(state,d.uid,t.value));
 else if(d.action==='brush'){ctx.brush=t.value;ctx.preview=null;field.setSelection(activeSelection());}
 else if(d.action==='direction'){ctx.direction=Number(t.value);ctx.preview=null;field.setSelection(activeSelection());}
 else if(d.action==='tutorial-setting'){settings.tutorial=t.checked;persistSettings();}
 else if(d.action==='motion-setting'){settings.reducedMotion=t.checked;persistSettings();if(settings.reducedMotion){transitions.finish('reduced-motion');dialogs.finish();}field.setSelection(activeSelection());}
 else if(d.action==='resolution-setting'){const draft={...settings,resolution:normalizeResolution(t.value)},result=store.saveSettings(draft);if(result.ok){settings=draft;applyScale();field.render(performance.now());}else{t.value=settings.resolution;toast(result.reason,true);}}
 else if(d.action==='ui-scale'){settings.uiScale=Number(t.value);persistSettings();applyScale();}
 }catch(error){reportError(error);}});
app.addEventListener('input',event=>{const t=event.target,d=t.dataset;if(d.action==='volume'){const key=d.key==='sfx'?'effects':d.key;settings[key]=Number(t.value)/100;document.querySelector(`#value-${d.key}`).textContent=t.value;audio.setVolumes({master:settings.master,music:settings.music,sfx:settings.effects,ui:settings.ui});persistSettings();}});

app.addEventListener('dragstart',event=>{const card=event.target.closest('.unit-card');if(interactionLocked()||!card||state?.phase!=='prep'){event.preventDefault();return;}selectUnit(card.dataset.uid,true);event.dataTransfer.setData('text/plain',card.dataset.uid);event.dataTransfer.effectAllowed='move';event.dataTransfer.setDragImage(dragImage,0,0);});
// Native HTML dragging can suspend requestAnimationFrame in Chromium. Draw the
// current preview from dragover as well, so its footprint and range track input.
canvas.addEventListener('dragover',event=>{if(interactionLocked()||!ctx.deployUid)return;event.preventDefault();field.pointer=field.pointerPosition(event);field.updateHover();field.render(performance.now());});
canvas.addEventListener('drop',event=>{event.preventDefault();field.pointer=field.pointerPosition(event);field.updateHover();if(ctx.hover)cellClick(ctx.hover);});
app.addEventListener('dragend',()=>{if(ctx.deployUid&&!modalRoot.children.length){ctx.deployUid=null;ctx.preview=null;ctx.hover=null;field.setSelection(activeSelection());updatePlacementStatus();}});
modalRoot.addEventListener('click',event=>{const action=event.target.closest('[data-action]');if(action&&!interactionLocked()){Promise.resolve(dispatch(action.dataset.action,action)).catch(reportError);return;}const t=event.target.closest('[data-modal]');if(transitions.active||!t)return;const callback=dialogCallbacks.get(t.dataset.modal);if(callback){const result=callback();if(result!==false)closeDialog();}else closeDialog();});
document.addEventListener('keydown',event=>{
 const editing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
 if(event.key==='Escape'){transitions.finish('escape');dialogs.finish();if(modalRoot.children.length)closeDialog();else if(visibleBattle())cancelSelection();else if(screen!=='menu'){screen=navigation.pop()||'menu';render();}return;}
 if(interactionLocked())return;
 if(modalRoot.children.length){if(event.key==='Tab'){const focusable=[...modalRoot.querySelectorAll('button:not(:disabled),input,select,a,[tabindex="0"]')],first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}return;}
 if(editing)return;if(visibleBattle()&&state.phase==='prep'&&event.key.toLowerCase()==='r'&&(ctx.deployUid||ctx.selectedUid)){event.preventDefault();const selected=state.units.find(u=>u.uid===(ctx.deployUid||ctx.selectedUid));if(ctx.terrainBatch){toast('先确认或取消地形草稿。',true);return;}if(!selected||selected.hp<=0||Catalog.towers[selected.type].footprint[0]===Catalog.towers[selected.type].footprint[1])return;if(!ctx.deployUid)selectUnit(selected.uid,true);const u=deploymentUnit(),fp=Catalog.towers[u.type].footprint;if(fp[0]!==fp[1]){ctx.deployRotation=(ctx.deployRotation+1)%4;ctx.preview=null;field.setSelection(activeSelection());if(ctx.hover)hoverCell(ctx.hover);field.render(performance.now());}return;}if(visibleBattle()&&state.phase==='battle'&&event.code==='Space'){event.preventDefault();ctx.paused=!ctx.paused;render();}else if(visibleBattle()&&state.phase==='battle'&&['1','2','3'].includes(event.key)){ctx.speed=Number(event.key);render();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state?.phase==='battle'){ctx.paused=true;save();if(visibleBattle())render();}});
window.addEventListener('beforeunload',()=>save());
window.addEventListener('pagehide',()=>{transitions.finish('pagehide');dialogs.finish();});
window.addEventListener('resize',()=>applyScale());
function updateHud(){if(!visibleBattle())return;const el=id=>document.getElementById(id),bw=Rules.bandwidthState(state);if(el('hud-spirit'))el('hud-spirit').innerHTML=`${n(state.spirit)} <small>/ ${n(state.maxSpirit)}</small>`;if(el('hud-spirit-bar'))el('hud-spirit-bar').style.width=`${100*state.spirit/state.maxSpirit}%`;if(el('hud-focus'))el('hud-focus').textContent=n(state.focus);if(el('hud-bandwidth'))el('hud-bandwidth').innerHTML=`${bw.used} <small>/ ${bw.cap}</small>`;if(el('hud-depth'))el('hud-depth').innerHTML=`${state.depth}<small> / 12</small>`;
 const b=state.battle;if(state.phase==='battle'&&b){if(el('hud-time'))el('hud-time').textContent=`${n(b.time)} 秒`;if(el('hud-enemies'))el('hud-enemies').textContent=`${b.enemies.filter(x=>!x.dead).length} 活动 / ${b.total-b.spawned} 待到达`;if(el('hud-wave'))el('hud-wave').textContent=`敌群 ${b.groupIndex+1} / ${b.groups.length} · ${b.nextGroupIn>0?`下一群 ${n(b.nextGroupIn)} 秒`:'当前编队持续入侵'}`;}
 const overload=el('overload');if(overload)overload.innerHTML=bw.disabled.length?`<div class="overload-banner">⚠ ${e(bw.sources.join(' / '))} · 需恢复 ${bw.shortfall} 带宽<br>已禁用：${bw.disabled.map(uid=>Catalog.towers[state.units.find(u=>u.uid===uid).type].name).join('、')}</div>`:'';
 const u=state.units.find(u=>u.uid===ctx.selectedUid);if(u&&el('selected-hp'))el('selected-hp').textContent=`${n(u.hp)} / ${n(Rules.unitStats(state,u).maxHp)}`;
}
function frame(time){const dt=Math.min(.1,(time-lastTime)/1000||0);lastTime=time;let events=[];
 try{if(screen==='run'&&state?.phase==='battle'&&!ctx.paused&&!modalRoot.children.length&&!interactionLocked()){accumulator+=dt*ctx.speed;let steps=0;while(accumulator>=.05&&steps++<12){accumulator-=.05;const result=stepBattle(state,.05);events.push(...(result.events||[]));if(result.finished){Run.finishBattle(state,{won:result.finished==='won'});clearInput();settle();save();render();audio.play(state.phase==='lost'?'defeat':'victory');break;}}}else accumulator=0;
 field.render(time,events);for(const event of events)audio.play(event.type);audio.update({danger:state?.battle?.danger||0,boss:state?.currentNode?.type==='boss',paused:state?.phase==='battle'&&(ctx.paused||screen!=='run'||!!modalRoot.children.length||interactionLocked())});if(time-lastHud>200){lastHud=time;updateHud();}
 }catch(error){ctx.paused=true;reportError(error);}requestAnimationFrame(frame);}
let lastError='';function reportError(error){const message=error?.stack||String(error);if(lastError===message)return;lastError=message;console.error(error);toast(`游戏运行遇到问题：${error?.message||error}。当前安全存档仍保留。`,true);}
window.addEventListener('error',event=>reportError(event.error||event.message));
if(qa){window.__mindrealm={getState:()=>state,getContext:()=>({...ctx}),getProfile:()=>profile,getSettings:()=>settings,field,audio,store,transitions,dialogs,loadState:value=>{state=Run.cloneState(value);screen='run';clearInput();render();},newRun:seed=>{state=Run.newRun(seed,0);screen='run';clearInput();save();render();},advance:seconds=>{if(state?.phase!=='battle')return;for(let t=0;t<seconds;t+=.05){const result=stepBattle(state,.05);if(result.finished){Run.finishBattle(state,{won:result.finished==='won'});clearInput();settle();save();render();return result.finished;}}updateHud();return state.phase;},render,snapshot:()=>({screen,state:state?Run.cloneState(state):null,context:{...ctx},errors:field.errors,audioErrors:audio.errors})};}
render();requestAnimationFrame(frame);const migration=store.migrationNotice?.();if(migration)toast(migration);if(volatileStorage)toast('浏览器拒绝本地存储，本次仅临时运行。请允许此站点存储后再开始正式远征。',true);
