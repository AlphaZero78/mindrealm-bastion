import { towers, effects } from './content.js';
import { difficultyProfile, upgradeRequirement } from './difficulty.js';

// This module is the single authority for previews, orders, and combat geometry.
export const DIRECTIONS = [{x:0,z:-1},{x:1,z:0},{x:0,z:1},{x:-1,z:0}];
export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
// Each synchronous simulation step or render pass owns a short-lived context.
// Standalone previews and commands remain uncached,
// so a UI mutation can never leave behind stale placement or damage results.
const frames=new WeakMap();
export function beginRulesFrame(state){frames.set(state,{key:null,mods:null,stats:new Map()});}
export function endRulesFrame(state){frames.delete(state);}
export function invalidateRulesFrame(state){const frame=frames.get(state);if(frame){frame.key=null;frame.stats.clear();}}
export function ruleEffects(state){
  const frame=frames.get(state);if(!frame)return effects(state);
  const ratio=state.spirit/Math.max(1,state.maxSpirit),key=`${ratio<.35}:${ratio<.25}:${Math.floor((state.battle?.spiritLost||0)/10)}:${state.terrain.revision||0}:${state.battle?.itemRevision||0}:${(state.battle?.disabled||[]).join(',')}`;
  if(frame.key!==key){frame.key=key;frame.mods=effects(state);frame.stats.clear();}
  return frame.mods;
}
export const coreOf = state => state.terrain.core || {x:20,z:24,size:5};
export const entriesOf = state => state.terrain.entries || [
  {id:'north',name:'北入口',x:20,z:0}, {id:'west',name:'西入口',x:0,z:24},
  {id:'east',name:'东入口',x:40,z:24}, {id:'south',name:'南入口',x:20,z:40}
];
export function cellAt(state,x,z) {
  const n=state.terrain.size; x=Math.floor(x); z=Math.floor(z);
  return x>=0&&z>=0&&x<n&&z<n ? state.terrain.cells[z*n+x] : null;
}
export const onField = u => Number.isFinite(u.x)&&Number.isFinite(u.z);
export function unitFootprint(unit) {
  const base=towers[unit.type]?.footprint||[2,2];
  return (unit.rotation||0)%2?[base[1],base[0]]:[...base];
}
export function footprint(state,unit,x=unit.x,z=unit.z) {
  const [w,d]=unitFootprint(unit), cells=[];
  for(let dz=0;dz<d;dz++) for(let dx=0;dx<w;dx++) cells.push({x:x+dx,z:z+dz});
  return cells;
}
export function unitCenter(unit) {
  const [w,d]=unitFootprint(unit);
  return {x:unit.x+(w-1)/2,z:unit.z+(d-1)/2};
}
export function unitStats(state,unit) {
  const base=towers[unit.type]; if(!base) throw new Error(`未知构造 ${unit.type}`);
  const mods=ruleEffects(state),frame=frames.get(state),cached=frame?.stats.get(unit);
  if(cached?.health===unit.hp)return cached.value;
  const tier=clamp(unit.tier||1,1,3), b=base.branches?.[unit.branch];
  const growth=tier===1?1:tier===2?1.5:2.35;
  const result={...base, footprint:unitFootprint(unit), effect:tier>1&&b?b.effect:null};
  const roleBonus=mods[`${base.role}_attack`]||0;
  result.hp=Math.round(base.hp*growth*(tier>1&&b?b.hp_mult||1:1)*(1+(mods.hp||0)+(mods[`${base.role}_hp`]||0)+(unit.hpBonus||0)+(tier===1?mods.nexus_t1_hp||0:tier===3?mods.nexus_t3_hp||0:0)));
  result.maxHp=result.hp;
  result.attack=base.attack*growth*(tier>1&&b?b.attack_mult||1:1)*(1+(mods.attack||0)+roleBonus);
  result.attack*=1+(mods.lost_spirit_damage||0)*Math.floor((state.battle?.spiritLost||0)/10);
  result.attack*=1+(tier===1?mods.nexus_t1_attack||0:mods.nexus_evolved_attack||0)+(tier===3?mods.nexus_t3_attack||0:0);
  if((mods.low_spirit_attack||0)&&state.spirit/state.maxSpirit<0.4) result.attack*=1+mods.low_spirit_attack;
  result.armor=base.armor+(tier-1)*2+(mods.armor||0)+(mods[`${base.role}_armor`]||0);
  if(unit.hp<result.hp*.35)result.armor+=mods.low_hp_armor||0;
  if(mods.priority_armor&&onField(unit)&&state.units.filter(u=>onField(u)&&u.hp>0).sort((a,b)=>(a.order||0)-(b.order||0)).slice(0,3).some(u=>u.uid===unit.uid))result.armor+=mods.priority_armor;
  if(result.effect==='guard') result.armor+=5*tier;
  result.range=base.range*(1+(mods.range||0)+(mods[`${base.role}_range`]||0));
  if(base.attack_kind==='direct')result.range*=1+(mods.direct_range||0);
  result.rate=base.rate/Math.max(0.2,1+(mods.haste||0)+(mods[`${base.role}_haste`]||0));
  if(base.role==='ranged')result.rate*=1+(mods.nexus_ranged_delay||0);
  if(onField(unit)&&(cellAt(state,unit.x,unit.z)?.h||0)>=3)result.rate*=1-(mods.height_rate||0);
  const supportGrowth=base.ability==='haste_aura'&&difficultyProfile(state).revision>=4?(tier===3?2:1):1+(tier-1)*.3;
  result.support_value=(base.support_value||0)*supportGrowth*(1+(mods.support_power||0));
  result.bandwidth=Math.max(1,base.bandwidth-(tier===1?mods.t1_bandwidth||0:0)-(base.ability==='bandwidth_plus'?mods.relay_cost||0:0));
  if(result.effect==='bandwidth_plus_more') result.support_value+=tier*2;
  if(result.effect==='resistance_plus_more') result.support_value+=tier;
  if(frame)frame.stats.set(unit,{health:unit.hp,value:result});return result;
}
export function bandwidthState(state) {
  const mods=ruleEffects(state), live=state.units.filter(u=>onField(u)&&u.hp>0);
  const rawJam=Math.max(0,(state.battle?.jam||0)-(mods.jam_resist||0)-(mods.overload_buffer||0));
  const baseFor=units=>Math.max(0,(state.bandwidth||0)+(mods.bandwidth||0)-Math.max(0,rawJam-(units.some(u=>unitStats(state,u).effect==='jam_resist')?3:0)));
  const sources=[];
  if(mods.bandwidth) sources.push(`构筑 +${mods.bandwidth}`);
  const disabled=[], active=[...live].sort((a,b)=>(a.order||0)-(b.order||0));
  const capFor=units=>baseFor(units)+relaySupply(state,units).reduce((sum,source)=>sum+source.amount,0);
  const allUsed=active.reduce((s,u)=>s+unitStats(state,u).bandwidth,0);
  let used=allUsed,cap=capFor(active);
  const startingCap=cap;
  while(used>cap&&active.length) {
    const u=active.pop(); disabled.push(u.uid); used-=unitStats(state,u).bandwidth; cap=capFor(active);
  }
  const base=baseFor(active),jam=Math.max(0,(state.bandwidth||0)+(mods.bandwidth||0)-base);
  if(jam)sources.push(`敌方干扰 −${jam}`);
  if(cap>base) sources.push(`中继 +${cap-base}`);
  return {used:allUsed,activeUsed:used,cap,disabled,shortfall:Math.max(0,allUsed-startingCap),sources};
}
export function relaySupply(state,units=state.units.filter(u=>onField(u)&&u.hp>0)){
  const sources=units.filter(u=>unitStats(state,u).ability==='bandwidth_plus').map(u=>({uid:u.uid,rated:Math.round(unitStats(state,u).support_value),order:u.order||0}));
  if(difficultyProfile(state).revision>=3)sources.sort((a,b)=>b.rated-a.rated||a.order-b.order);
  return sources.map((source,index)=>({...source,amount:difficultyProfile(state).revision>=3?Math.floor(source.rated*([1,.6,.4][index]||0)):source.rated}));
}
export function supportInRange(state,source,target) {
  const a=unitCenter(source),b=unitCenter(target);
  return Math.hypot(a.x-b.x,a.z-b.z)<=unitStats(state,source).range;
}
export function unitAuras(state,unit){
  const s=unitStats(state,unit),m=ruleEffects(state),auras=[];
  if(s.ability==='ally_shield'||s.effect==='guard')auras.push({id:'guard',label:'友军减伤',target:'ally',radius:s.effect==='wide_shield'?6:3,reduction:.18});
  if(['pressure_sink','pressure_filter'].includes(s.effect))auras.push({id:'pressure',label:'死亡压力过滤',target:'enemy',radius:s.range,reduction:.3});
  if(s.ability==='haste_aura'){const haste=s.support_value+(s.effect==='strong_haste'?.12:0);auras.push({id:'haste',label:'友军攻速 / 攻击',target:'ally',radius:s.range,haste,damage:haste*.5});}
  if(s.ability==='repair')auras.push({id:'repair',label:'维修覆盖',target:'ally',radius:s.range,amount:s.attack*(1+(m.support_efficiency||0)),interval:s.rate});
  if(s.effect==='slow_aura')auras.push({id:'slow',label:'敌人减速',target:'enemy',radius:s.range,slow:.4});
  if(s.role==='support'&&(m.support_armor||m.support_rate))auras.push({id:'network',label:'支援网络',target:'ally',radius:s.range,armor:m.support_armor||0,rate:m.support_rate||0});
  if(s.ability==='bandwidth_plus')auras.push({id:'bandwidth',label:'全局带宽',target:'global',radius:null,value:Math.round(s.support_value)});
  if(s.ability==='resistance_plus')auras.push({id:'resistance',label:'全局抗性',target:'global',radius:null,value:s.support_value});
  return auras;
}
export function auraCovers(state,source,target,aura){return source.uid!==target.uid&&onField(source)&&onField(target)&&Math.hypot(unitCenter(source).x-unitCenter(target).x,unitCenter(source).z-unitCenter(target).z)<=aura.radius;}
export function auraCoverage(state,source,aura,{preview=false}={}){
  const disabled=bandwidthState(state).disabled,active=source.hp>0&&onField(source)&&(preview||!disabled.includes(source.uid));
  const targets=active&&aura.target==='ally'?state.units.filter(u=>u.hp>0&&auraCovers(state,source,u,aura)):[];
  return {active,global:aura.target==='global',range:aura.radius,targets,affected:targets.filter(u=>aura.id==='repair'||!disabled.includes(u.uid))};
}
export function supportCoverage(state,source,{preview=false}={}) {
  const stats=unitStats(state,source),disabled=bandwidthState(state).disabled;
  const active=source.hp>0&&onField(source)&&(preview||!disabled.includes(source.uid));
  const global=['bandwidth_plus','resistance_plus'].includes(stats.ability);
  const targets=active?state.units.filter(u=>onField(u)&&u.hp>0&&u.uid!==source.uid&&supportInRange(state,source,u)):[];
  const m=ruleEffects(state),localBuff=stats.ability==='haste_aura'||!!(m.support_armor||m.support_rate);
  const affected=targets.filter(u=>stats.ability==='repair'||localBuff&&!disabled.includes(u.uid));
  return {active,global,range:stats.range,targets,affected};
}
const failure = reason => ({ok:false,reason});
const canManage = s => ['prep','node'].includes(s.phase);
const getUnit = (s,id) => typeof id==='object'?id:s.units.find(u=>u.uid===id);
export function moveCost(state,uid) {
  const u=getUnit(state,uid); return u?Math.max(0,Math.ceil(unitStats(state,u).upkeep*0.15*(1-clamp(effects(state).move_discount||0,0,1)))):0;
}
export function repairCost(state,uid) {
  const u=getUnit(state,uid); if(!u)return 0; const s=unitStats(state,u);
  return Math.max(0,Math.ceil((1-clamp(u.hp/s.hp,0,1))*s.upkeep*(1-clamp(effects(state).repair_discount||0,-1,1))*difficultyProfile(state).serviceMultiplier));
}
export function upgradeCost(state,uid) {
  const u=getUnit(state,uid),modern=difficultyProfile(state).revision>=3; return u?Math.ceil((u.tier===1?(modern?65:42):(modern?140:80))*(unitStats(state,u).upkeep/45)*(1-clamp(effects(state).upgrade_discount||0,0,0.9))*(1+(effects(state).nexus_upgrade_tax||0))*difficultyProfile(state).serviceMultiplier):0;
}
export function placement(state,unit,x,z) {
  const cells=footprint(state,unit,x,z), bw=bandwidthState(state);
  const result={ok:false,reason:'',cells,cost:unit.everDeployed?moveCost(state,unit):0,used:bw.used,cap:bw.cap};
  const fail=reason=>({...result,reason});
  if(state.phase!=='prep') return fail('只能在战前部署');
  if(!Number.isInteger(x)||!Number.isInteger(z)||cells.some(c=>!cellAt(state,c.x,c.z)))return fail('完整占地超出战场');
  if(unit.hp<=0)return fail('构造已损坏，请先维修');
  if(cells.some(c=>cellAt(state,c.x,c.z).protected))return fail('火种或入口是保护区域');
  const h=cellAt(state,x,z).h;
  if(cells.some(c=>cellAt(state,c.x,c.z).h!==h))return fail('所有占地格必须等高');
  if(cells.some(c=>cellAt(state,c.x,c.z).ramp>=0))return fail('斜坡上不能部署构造');
  const stats=unitStats(state,unit);
  if(stats.role==='ranged'&&h<1)return fail('远程构造需要高度 1–4 的高台');
  if(stats.role==='melee'&&h!==0)return fail('近战构造需要高度 0 的地面');
  const occupied=new Set(state.units.filter(u=>u.uid!==unit.uid&&u.hp>0&&onField(u)).flatMap(u=>footprint(state,u).map(c=>`${c.x},${c.z}`)));
  if(cells.some(c=>occupied.has(`${c.x},${c.z}`)))return fail('格位被其他构造占用');
  const trial={...state,units:state.units.map(u=>u.uid===unit.uid?{...u,x,z,order:Math.max(0,...state.units.map(t=>t.order||0))+1}:u)};
  const projected=bandwidthState(trial); result.used=projected.used; result.cap=projected.cap;
  if(projected.disabled.length)return fail(`带宽不足：部署后 ${projected.used}/${projected.cap}`);
  if(state.focus<result.cost)return fail(`搬迁需要 ${result.cost} 专注`);
  return {...result,ok:true,reason:result.cost?`可部署 · 维护 ${result.cost} 专注`:'可部署 · 首次免费'};
}
export function deploy(state,uid,x,z,rotation) {
  const u=getUnit(state,uid); if(!u)return failure('未找到构造');
  if(rotation!==undefined&&(!Number.isInteger(rotation)||rotation<0||rotation>3))return failure('无效的旋转方向');
  const trial=rotation===undefined?u:{...u,rotation};
  const p=placement(state,trial,x,z); if(!p.ok)return p;
  state.focus-=p.cost; u.x=x;u.z=z;if(rotation!==undefined)u.rotation=rotation;u.everDeployed=true;u.order=Math.max(0,...state.units.map(t=>t.order||0))+1;
  return {ok:true,reason:'构造已部署',cost:p.cost};
}
export function withdraw(state,uid) {
  const u=getUnit(state,uid); if(!u||!onField(u))return failure('请选择已部署构造');
  if(state.phase!=='prep')return failure('只能在战前撤回');
  const cost=moveCost(state,u); if(state.focus<cost)return failure(`需要 ${cost} 专注`);
  state.focus-=cost;u.x=null;u.z=null;return {ok:true,reason:'已送回仓库',cost};
}
export function repair(state,uid,{free=false}={}) {
  const u=getUnit(state,uid); if(!u)return failure('未找到构造');
  if(!canManage(state))return failure('战斗中不能维修');
  const s=unitStats(state,u); if(u.hp>=s.hp)return failure('耐久已满');
  const cost=free?0:repairCost(state,u); if(state.focus<cost)return failure(`需要 ${cost} 专注`);
  state.focus-=cost;u.hp=s.hp;u.x=null;u.z=null;return {ok:true,reason:'维修完成，构造回到仓库',cost};
}
export function upgrade(state,uid,branch,{free=false}={}) {
  const u=getUnit(state,uid); if(!u)return failure('未找到构造');
  if(!canManage(state)&&!(free&&state.phase==='reward'&&state.rewardQueue?.[0]?.kind==='upgrade'))return failure('当前阶段不能升级');
  if(u.tier>=3)return failure('已达到 T3');
  const requirement=upgradeRequirement(state,u);if(!requirement.ok)return failure(requirement.reason);
  if(u.tier===1&&!['A','B'].includes(branch))return failure('请选择 A 或 B 分支');
  if(u.tier===2&&branch&&branch!==u.branch)return failure('T3 必须沿原分支成长');
  const cost=free?0:upgradeCost(state,u); if(state.focus<cost)return failure(`需要 ${cost} 专注`);
  const ratio=u.hp/unitStats(state,u).hp;
  state.focus-=cost;u.tier++;u.branch=u.branch||branch;u.hp=unitStats(state,u).hp*ratio;
  return {ok:true,reason:`已升级至 T${u.tier} · ${u.branch}`,cost};
}
export function fuse(state,uid,branch) {
  const u=getUnit(state,uid); if(!u)return failure('未找到核心构造');
  if(!canManage(state))return failure('战斗中不能融合');
  if(u.tier>=3)return failure('T3 不能继续融合');
  const requirement=upgradeRequirement(state,u);if(!requirement.ok)return failure(requirement.reason);
  if(u.tier===1&&!['A','B'].includes(branch))return failure('请选择融合分支');
  if(u.tier===2&&branch&&branch!==u.branch)return failure('T2 材料必须同分支');
  const material=state.units.filter(t=>t.uid!==u.uid&&t.type===u.type&&t.tier===u.tier&&(u.tier===1||t.branch===u.branch)).slice(0,2);
  if(material.length<2)return failure('需要另外两个同类型、同阶、同分支构造');
  const all=[u,...material],ratio=all.reduce((s,t)=>s+t.hp,0)/all.reduce((s,t)=>s+unitStats(state,t).hp,0);
  state.units=state.units.filter(t=>!material.includes(t));u.tier++;u.branch=u.branch||branch;u.hp=unitStats(state,u).hp*ratio;
  return {ok:true,reason:`融合完成，继承 ${Math.round(ratio*100)}% 耐久`,consumed:material.map(t=>t.uid)};
}
export function setPriority(state,uid,priority) {
  const u=getUnit(state,uid);if(!u)return failure('未找到构造');
  if(state.phase!=='prep')return failure('只能在战前设置优先级');
  if(!['near','far','hp'].includes(priority))return failure('未知优先级');
  u.priority=priority;return {ok:true,reason:'攻击优先级已更新'};
}

export function edgeInfo(state,a,b) {
  const ca=cellAt(state,a.x,a.z),cb=cellAt(state,b.x,b.z);
  if(!ca||!cb||Math.abs(a.x-b.x)+Math.abs(a.z-b.z)!==1)return {passable:false,cost:Infinity};
  const delta=cb.h-ca.h;if(delta===0)return {passable:true,cost:1+ca.h*0.03};
  const low=delta>0?a:b, high=delta>0?b:a, lc=delta>0?ca:cb;
  const dir=DIRECTIONS.findIndex(d=>low.x+d.x===high.x&&low.z+d.z===high.z);
  const passable=Math.abs(delta)===1&&lc.ramp===dir;
  return {passable,cost:passable?1.2:1+80*Math.abs(delta),barrier:passable?null:{...high,h:Math.max(ca.h,cb.h)}};
}
// A reverse Dijkstra field is shared by every enemy until terrain changes.
const navigation=new WeakMap();
function routeField(state) {
  const terrain=state.terrain,rev=terrain.revision||0, cached=navigation.get(terrain);
  if(cached?.rev===rev)return cached;
  const n=terrain.size,N=n*n,dist=new Float64Array(N).fill(Infinity),next=new Int32Array(N).fill(-1),heap=[];
  const push=(i,d)=>{let k=heap.length;heap.push([i,d]);while(k){const p=(k-1)>>1;if(heap[p][1]<=d)break;heap[k]=heap[p];k=p;}heap[k]=[i,d];};
  const pop=()=>{const top=heap[0],tail=heap.pop();if(heap.length){let k=0;while(k*2+1<heap.length){let c=k*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=tail[1])break;heap[k]=heap[c];k=c;}heap[k]=tail;}return top;};
  const core=coreOf(state),r=Math.floor(core.size/2);
  for(let z=core.z-r;z<=core.z+r;z++)for(let x=core.x-r;x<=core.x+r;x++){const i=z*n+x;dist[i]=0;push(i,0);}
  while(heap.length){const [i,d]=pop();if(d!==dist[i])continue;const a={x:i%n,z:Math.floor(i/n)};
    for(const v of DIRECTIONS){const b={x:a.x+v.x,z:a.z+v.z};if(!cellAt(state,b.x,b.z))continue;const j=b.z*n+b.x,nd=d+edgeInfo(state,a,b).cost;
      if(nd<dist[j]){dist[j]=nd;next[j]=i;push(j,nd);}}
  }
  const value={rev,dist,next};navigation.set(terrain,value);return value;
}
export function pathToCore(state,x,z) {
  const n=state.terrain.size; x=clamp(Math.round(x),0,n-1);z=clamp(Math.round(z),0,n-1);
  const f=routeField(state),path=[];let i=z*n+x;
  for(let k=0;k<n*n;k++){const a={x:i%n,z:Math.floor(i/n)},j=f.next[i];
    const info=j<0?null:edgeInfo(state,a,{x:j%n,z:Math.floor(j/n)});
    path.push({...a,distance:f.dist[i],barrier:info?.barrier||null});if(j<0)break;i=j;
  }return path;
}
export function distanceToCore(state,target) {
  if(target.air)return Math.hypot(target.x-coreOf(state).x,target.z-coreOf(state).z);
  const n=state.terrain.size,x=clamp(Math.round(target.x),0,n-1),z=clamp(Math.round(target.z),0,n-1);
  return routeField(state).dist[z*n+x];
}
export function previewTerrain(state,command) {
  const {x,z,tool,brush='single',direction=0,x2=x,z2=z}=command;
  const result={ok:false,reason:'',cost:0,cells:[],selectionCells:[],barriers:[],paths:[]};
  const fail=reason=>({...result,reason});
  if(state.phase!=='prep')return fail('只能在战前改造地形');
  if(!['raise','lower','flatten','ramp'].includes(tool))return fail('未知地形工具');
  if(!Number.isInteger(x)||!Number.isInteger(z))return fail('请选择完整地形格');
  if(!['single','square','line','box'].includes(brush))return fail('未知地形笔刷');
  if(brush==='box'&&(!Number.isInteger(x2)||!Number.isInteger(z2)))return fail('框选终点必须是完整地形格');
  if(brush==='box'&&[x,x2,z,z2].some(v=>v<0||v>=state.terrain.size))return fail('框选超出战场');
  if(!Number.isInteger(direction))return fail('斜坡方向无效');
  const dir=((direction%4)+4)%4,offsets=brush==='box'?Array.from({length:Math.abs(z2-z)+1},(_,dz)=>Array.from({length:Math.abs(x2-x)+1},(_,dx)=>({x:Math.min(x,x2)+dx,z:Math.min(z,z2)+dz}))).flat():brush==='square'?[-1,0,1].flatMap(dz=>[-1,0,1].map(dx=>({x:x+dx,z:z+dz}))):brush==='line'?[-2,-1,0,1,2].map(k=>({x:x+DIRECTIONS[dir].x*k,z:z+DIRECTIONS[dir].z*k})):[{x,z}];
  result.selectionCells=offsets;
  const occupied=new Set(state.units.filter(u=>onField(u)&&u.hp>0).flatMap(u=>footprint(state,u).map(c=>`${c.x},${c.z}`)));
  for(const p of offsets){const cell=cellAt(state,p.x,p.z);if(!cell)return fail('笔刷超出战场');
    if(cell.protected)return fail('笔刷覆盖了火种或入口保护区');if(occupied.has(`${p.x},${p.z}`))return fail('笔刷覆盖了已部署构造');
    const after={...cell};
    if(tool==='raise')after.h=clamp(cell.h+1,0,4);
    if(tool==='lower')after.h=clamp(cell.h-1,0,4);
    if(tool==='flatten')after.h=0;
    if(tool==='ramp'){const dir=((direction%4)+4)%4,d=DIRECTIONS[dir],other=cellAt(state,p.x+d.x,p.z+d.z);
      if(!other||other.h!==cell.h+1)return fail('斜坡箭头必须指向高一级的相邻格');after.ramp=cell.ramp===dir?-1:dir;
    } else if(after.h!==cell.h) after.ramp=-1;
    if(after.h!==cell.h||after.ramp!==cell.ramp)result.cells.push({...p,before:{...cell},after,h:after.h,ramp:after.ramp});
  }
  if(!result.cells.length)return fail('没有可改变的格子（高度范围 0–4）');
  result.cost=terrainCost(state,result.cells.length);
  const terrain={...state.terrain,cells:state.terrain.cells.slice(),revision:0};for(const c of result.cells)terrain.cells[c.z*terrain.size+c.x]=c.after;
  const trial={...state,terrain};
  for(const c of result.cells)for(const d of DIRECTIONS){const b={x:c.x+d.x,z:c.z+d.z};const e=edgeInfo(trial,c,b);if(e.barrier)result.barriers.push({from:{x:c.x,z:c.z},to:b,...e.barrier});}
  result.paths=entriesOf(trial).map(e=>({entry:e.id,path:pathToCore(trial,e.x,e.z)}));
  if(state.focus<result.cost)return fail(`需要 ${result.cost} 专注`);
  return {...result,ok:true,reason:`${result.cells.length} 格 · ${result.cost} 专注${result.barriers.length?' · 将形成可破坏峭壁':''}`};
}
export function applyTerrain(state,command) {
  const p=previewTerrain(state,command);if(!p.ok)return p;
  for(const c of p.cells)state.terrain.cells[c.z*state.terrain.size+c.x]={...c.after};
  state.focus-=p.cost;state.terrain.revision=(state.terrain.revision||0)+1;
  (state.terrainUndo ||= []).push({cells:p.cells,cost:p.cost,editsBefore:state.terrainEdits||0});
  state.terrainEdits=(state.terrainEdits||0)+p.cells.length;return p;
}
// Cumulative per preparation phase, so splitting a batch cannot reset its price.
export function terrainCost(state,count) {
  let cost=0;for(let i=0;i<count;i++)cost+=2+Math.floor(((state.terrainEdits||0)+i)/20);
  return Math.ceil(cost*(1-clamp(effects(state).terrain_discount||0,0,1)));
}
export function previewTerrainBatch(state,commands) {
  if(!Array.isArray(commands)||!commands.length)return failure('先在战场上添加地形修改');
  const trial={...state,terrain:{...state.terrain,cells:state.terrain.cells.map(c=>({...c}))},terrainUndo:[]};
  let cost=0,count=0,last;const changed=new Map();
  for(const command of commands){last=applyTerrain(trial,command);if(!last.ok)return {...last,cost:cost+last.cost};cost+=last.cost;count+=last.cells.length;
    for(const c of last.cells){const key=c.z*trial.terrain.size+c.x;changed.set(key,{...c,before:changed.get(key)?.before||c.before});}}
  return {ok:true,cost,count,cells:[...changed.values()],paths:last.paths,barriers:last.barriers,trial,reason:`${commands.length} 笔 / ${count} 格次 · ${cost} 专注`};
}
export function applyTerrainBatch(state,commands) {
  const p=previewTerrainBatch(state,commands);if(!p.ok)return p;
  (state.terrainUndo ||= []).push({cells:p.cells,cost:p.cost,editsBefore:state.terrainEdits||0});
  state.terrain=p.trial.terrain;state.focus=p.trial.focus;state.terrainEdits=p.trial.terrainEdits;
  return {...p,trial:undefined};
}
export function undoTerrain(state) {
  if(state.phase!=='prep')return failure('只能在战前撤销');
  const last=state.terrainUndo?.at(-1);if(!last)return failure('没有可撤销的地形操作');
  const occupied=new Set(state.units.filter(u=>onField(u)&&u.hp>0).flatMap(u=>footprint(state,u).map(c=>`${c.x},${c.z}`)));
  if(last.cells.some(c=>occupied.has(`${c.x},${c.z}`)))return failure('改造格已有构造，请先撤回再撤销');
  for(const c of last.cells)state.terrain.cells[c.z*state.terrain.size+c.x]={...c.before};
  state.terrainUndo.pop();state.focus+=last.cost;state.terrainEdits=last.editsBefore??Math.max(0,(state.terrainEdits||0)-last.cells.length);state.terrain.revision=(state.terrain.revision||0)+1;
  return {ok:true,reason:`已撤销，退回 ${last.cost} 专注`,cost:-last.cost};
}
export function solveAttack(state,unit,target) {
  const s=unitStats(state,unit),origin=unitCenter(unit),targetH=target.h??cellAt(state,target.x,target.z)?.h??0;
  const originH=cellAt(state,unit.x,unit.z)?.h||0,difference=clamp(originH-targetH,-4,4),mods=ruleEffects(state);
  const high=Math.max(0,difference),range=s.range*(s.role==='ranged'?1+(0.08+(mods.height_bonus||0))*high:1);
  const dist=Math.hypot(target.x-origin.x,target.z-origin.z);
  let damage=s.attack*(difference>=0?1+(s.role==='ranged'?high*(0.1+(mods.height_bonus||0)):0):1+0.12*difference);
  if(s.role==='ranged'&&originH>=2)damage*=1+(mods.highground_damage||0);
  if(s.role==='ranged'&&unit.priority==='hp')damage*=1+(mods.high_hp_damage||0);
  if(target.air)damage*=1+(mods.anti_air_damage||0);
  if(target.kind==='boss')damage*=1+(mods.nexus_boss_damage||0);
  if(target.kind==='elite')damage*=1+(mods.nexus_elite_damage||0);
  damage*=1+(s.attack_kind==='direct'?mods.nexus_direct||0:['indirect','drone'].includes(s.attack_kind)?mods.nexus_indirect||0:0);
  if(target.air&&s.effect==='anti_air')damage*=1.8;
  if(s.effect==='execute'&&target.hp/target.maxHp<0.3)damage*=1.65;
  const penetration=(s.effect==='pierce'?0.6:0)+(mods.armor_pierce||0);
  damage=Math.max(s.attack*0.05,damage-Math.max(0,(target.armor||0)-(s.role==='ranged'?mods.ranged_pierce||0:0))*(1-clamp(penetration,0,0.9)));
  let blocked=false;
  if(s.attack_kind==='direct'&&dist>0){const startH=originH+1.05,endH=targetH+(target.air?2.4:0.7),steps=Math.ceil(dist*3),w=s.footprint[0],d=s.footprint[1],gridAligned=Number.isInteger(unit.x)&&Number.isInteger(unit.z),own=gridAligned?null:new Set(footprint(state,unit).map(c=>`${c.x},${c.z}`)),tx=Math.round(target.x),tz=Math.round(target.z);
    for(let i=1;i<steps;i++){const t=i/steps,x=Math.round(origin.x+(target.x-origin.x)*t),z=Math.round(origin.z+(target.z-origin.z)*t);
      if((gridAligned?x>=unit.x&&x<unit.x+w&&z>=unit.z&&z<unit.z+d:own.has(`${x},${z}`))||x===tx&&z===tz)continue;
      const cell=cellAt(state,x,z);if(cell&&cell.h>startH+(endH-startH)*t+0.03){blocked=true;break;}}
  }
  const matches=s.targets==='all'||s.targets==='ground'&&!target.air||s.targets==='air'&&target.air;
  return {ok:!!(matches&&dist<=range&&!blocked),range,damage,blocked,distance:dist,heightDifference:difference};
}
export function incomingDamage(state,unit,enemy,amount) {
  const s=unitStats(state,unit),height=cellAt(state,unit.x,unit.z)?.h||0,enemyH=cellAt(state,enemy.x,enemy.z)?.h||0;
  const pierce=clamp(enemy.pierce||0,0,1),protection=Math.min(4,Math.max(0,height-enemyH))*0.12*(1-pierce*0.5);
  const reduction=s.role==='melee'?ruleEffects(state).melee_reduction||0:0;
  return Math.max(1,(amount*(1-protection)-Math.max(0,s.armor+(unit.temporaryArmor||0))*(1-pierce))*(1-reduction));
}
