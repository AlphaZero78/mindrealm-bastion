// Runs only in an isolated QA page. All progress uses normal commands or UI
// buttons; no focus, health, rewards or encounter queue is granted to a run.
import * as Run from '../../../game/web/core/state.js';
import * as Rules from '../../../game/web/core/rules.js';
import {events} from '../../../game/web/core/content.js';
import {inventoryStatus,discardUnits} from '../../../game/web/core/inventory.js';
import {upgradeRequirement} from '../../../game/web/core/difficulty.js';
import {chooseReferenceReward,chooseReferenceNexus,prepareReference,referenceItems} from './reference-strategy.mjs';

const values={pulse_array:100,focus_rail:85,memory_mechanic:62,bandwidth_relay:110,phase_blade:50,frequency_choir:55,drone_loom:75,arc_mortar:70,resistance_beacon:25,anchor_bulwark:40,boundary_riveter:25,resonance_guard:25};
const branch=u=>u.branch||(['pulse_array','focus_rail','phase_blade','bandwidth_relay','memory_mechanic','frequency_choir','resistance_beacon'].includes(u.type)?'A':'B');
const grow=u=>(values[u.type]||0)*(Rules.onField(u)?1.5:1)/(u.tier||1);
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
function qa(){if(!['127.0.0.1','localhost'].includes(location.hostname)||location.port==='4173'||new URLSearchParams(location.search).get('qa')!=='1')throw Error('Use an isolated loopback QA page');return window.__mindrealm;}
async function idle(){const q=qa(),end=performance.now()+5000;for(let i=0;i<4;i++)await Promise.resolve();while(q.transitions.active||q.dialogs.active||q.dialogs.animations.size){await frame();if(performance.now()>end)throw Error('UI transition timed out');}}
async function click(selector){await idle();const el=document.querySelector(selector);if(!el||el.disabled)throw Error(`Unavailable UI action: ${selector}`);el.scrollIntoView({block:'nearest'});el.click();await idle();}
const action=name=>`[data-action="${name}"]`;
const approve=()=>click('.modal-footer .primary');
function clearOverflow(state){const bag=inventoryStatus(state);if(!bag.overflow)return;const keep=u=>(values[u.type]||0)*u.tier**2*(Rules.onField(u)?1.5:1)*(u.hp>0?1:.6);const result=discardUnits(state,[...bag.all].sort((a,b)=>keep(a)-keep(b)).slice(0,bag.overflow).map(u=>u.uid));if(!result.ok)throw Error(result.reason);}
function decision(s){
 const node=s.currentNode;
 if(node.type==='camp'){
  if(s.spirit<s.maxSpirit*.65)return {action:'camp-heal'};
  const u=s.units.filter(u=>upgradeRequirement(s,u).ok&&u.hp>0).sort((a,b)=>grow(b)-grow(a))[0];if(u)return {action:'camp-upgrade',uid:u.uid,branch:branch(u)};
  const hurt=s.units.filter(u=>u.hp<Rules.unitStats(s,u).maxHp).sort((a,b)=>Rules.repairCost(s,b)-Rules.repairCost(s,a))[0];return hurt?{action:'camp-repair',uid:hurt.uid}:{action:'camp-heal'};
 }
 if(node.type==='workshop'){const u=s.units.find(u=>u.everDeployed&&u.hp<Rules.unitStats(s,u).hp*.65&&s.focus>Rules.repairCost(s,u)+20);return u?{action:'repair',uid:u.uid}:{action:'node-leave'};}
 if(node.type==='shop'){const u=node.stock.units.find(u=>!u.sold&&u.id==='bandwidth_relay');if(u&&!s.units.some(t=>t.type==='bandwidth_relay')&&s.focus>=Run.shopPrice(s,'units',u))return {action:'buy-unit',id:u.key};const relic=node.stock.relics.find(x=>!x.sold);return s.focus>220&&relic?{action:'buy-relic',id:relic.key}:{action:'node-leave'};}
 if(node.type==='treasure')return node.options.length?{action:'treasure',id:node.options[0]}:{action:'empty-treasure'};
 if(node.type==='event'){
  if(node.eventData.outcome)return {action:'event-continue'};
  const value=p=>!p?.canChoose?-Infinity:(p.effects.focus||0)+(p.effects.spirit||0)*(s.spirit<s.maxSpirit*.7?4:1)+(p.effects.bandwidth||0)*25+(p.effects.relic?80:0)+(p.effects.free_upgrades||0)*80+(p.effects.resistance||0)*5;
  return {action:'event-choice',index:events[node.eventData.id].choices.map((_,index)=>({index,value:value(Run.eventPreview(s,index))})).sort((a,b)=>b.value-a.value)[0].index};
 }
 throw Error(`Unknown node ${node.type}`);
}

export async function runChunk({start=false,seed='reference-0',seconds=18}={}){
 const q=qa();if(start){q.getSettings().reducedMotion=true;q.getSettings().tutorial=false;q.getSettings().uiScale=1;q.newRun(seed);window.__revisionFiveAudit={seed,nodes:[],battles:[],saves:0};await idle();}
 const audit=window.__revisionFiveAudit;if(!audit)throw Error('Start the QA run first');const until=performance.now()+seconds*1000;
 while(performance.now()<until){
  let s=q.getState();if(['won','lost'].includes(s.phase))break;
  if(s.phase==='nexus'){await click(`${action('nexus-gift')}[data-id="${chooseReferenceNexus(s)}"]`);await approve();}
  else if(s.phase==='interlude'){clearOverflow(s);q.render();await click(action('act-continue'));}
  else if(s.phase==='map'){
   clearOverflow(s);referenceItems(s);q.render();
   const value=n=>({camp:s.spirit<s.maxSpirit*.6?120:75,treasure:100,event:85,unknown:65,shop:s.focus>240?65:15,workshop:15,battle:45,elite:s.act===0?25:40,boss:50}[n.type]||0),node=[...Run.availableNodes(s)].sort((a,b)=>value(b)-value(a))[0];
   if(!node)throw Error('No reachable route node');await click(`${action('map-node')}[data-id="${node.id}"]`);audit.nodes.push({act:s.act,floor:s.floor,type:s.currentNode.type,focus:s.focus,spirit:s.spirit});
  }else if(s.phase==='prep'){
   prepareReference(s);q.render();const bw=Rules.bandwidthState(s);if(bw.disabled.length)throw Error('Reference deployment exceeded bandwidth');
   audit.pending={act:s.act,floor:s.floor,type:s.currentNode.type,focus:s.focus,spirit:s.spirit,bandwidth:[bw.used,bw.cap],tiers:s.units.filter(Rules.onField).map(u=>u.tier)};
   await click(action('start'));await approve();if(q.getState().phase==='battle')await click(action('pause'));
  }else if(s.phase==='battle'){
   for(let i=0;i<720&&q.getState().phase==='battle'&&performance.now()<until;i++){referenceItems(q.getState());q.advance(.5);if(i%30===0)await frame();}
   s=q.getState();if(s.phase!=='battle'){const b=s.battle;audit.battles.push({...audit.pending,afterFocus:s.focus,afterSpirit:s.spirit,seconds:b.time,result:b.result,depth:s.depth,t3:s.units.filter(u=>u.tier===3).length});audit.pending=null;}
   else if(s.battle.time>360)throw Error(`Battle exceeds 360s: ${s.currentNode.id}`);
  }else if(s.phase==='reward'){
   const id=chooseReferenceReward(s);if(id==='skip'){await click(action('item-skip'));await approve();}else await click(`${action('reward')}[data-id="${id}"]`);
  }else if(s.phase==='node'){
   const d=decision(s),camp=['camp-upgrade','camp-repair'].includes(d.action),attrs=camp?'':['uid','id','index'].filter(k=>d[k]!==undefined).map(k=>`[data-${k}="${d[k]}"]`).join('');
   await click(action(d.action)+attrs);if(camp)await click(`[data-camp-uid="${d.uid}"]`);
   if(d.action==='camp-upgrade')await click(`[data-dialog-upgrade="${d.branch}"]`);
   else if(d.action==='event-choice')await click(action(d.action)+attrs);
   else if(!['node-leave','empty-treasure','event-continue'].includes(d.action))await approve();
  }else throw Error(`Unexpected phase ${s.phase}`);
  if(q.getState().phase!=='battle'){const saved=q.store.load();if(!saved.ok)throw Error('Safe checkpoint was not saved');audit.saves++;}
 }
 const s=q.getState(),result={phase:s.phase,act:s.act+1,floor:s.floor+1,completed:s.stats.completedNodes,spirit:s.spirit,focus:s.focus,depth:s.depth,bosses:s.stats.bosses.length,renderErrors:q.field.errors,audioErrors:q.audio.errors};
 if(s.phase==='won'&&(result.completed!==48||result.bosses!==3))throw Error('Incomplete winning route');
 return result;
}
