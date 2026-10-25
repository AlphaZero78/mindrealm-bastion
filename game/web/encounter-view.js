import {enemies} from './core/content.js';
import {entriesOf} from './core/rules.js';
import {escapeHTML as e,icon,n,sprite} from './ui.js';

const abilityHints={
 none:'沿通路推进，攻击拦路构造',sprint:'预警后短时冲刺',shield:'自带护盾，周期补盾',
 haste:'提高附近敌人的移速',split:'死亡时分裂出援兵',air:'越过地形与地面阻挡',
 tower_hunter:'远程攻击各类构造',siege:'攻击构造，快速拆除屏障',heal:'恢复附近敌人的生命',
 jam:'降低带宽，效果可叠加',teleport:'沿通路向前迁跃',copy:'复制附近的普通敌人',
 pressure_aura:'提高附近敌人的死亡压力',armored:'重甲推进，攻击附带穿甲',
 group_shield:'为附近敌人补充护盾',summon:'召来援兵',
 corrode_resistance:'降低精神抗性，可叠加',explode:'死亡时对附近构造造成爆炸'
};
const specificHints={spirit_taxer:'腐蚀抗性，直接造成精神伤害',chorus_overseer:'群体护盾，后续阶段干扰带宽',zero_frequency_mind:'范围冲击构造，快速拆障'};
const entryId=value=>typeof value==='string'?value:value?.id;
const entryNames={north:'北入口',west:'西入口',east:'东入口',south:'南入口'};

/** Qualitative labels consume the same movement and ability facts as combat. */
export function enemyBrief(spec){
 return {movement:spec.air?'air':'ground',movementLabel:spec.air?'飞行':'陆地',siege:spec.ability==='siege',
  rank:spec.kind==='boss'?'首领':spec.kind==='elite'?'精英':null,
  feature:specificHints[spec.id]||abilityHints[spec.ability]||spec.description.split('。')[0]};
}

export function encounterEntries(state,plan){
 const definitions=new Map(entriesOf(state).map(entry=>[entry.id,entry])),entryList=Array.isArray(plan.entries)?plan.entries:Object.values(plan.entries||{});
 for(const entry of entryList)if(typeof entry==='object')definitions.set(entry.id,entry);
 const queue=plan.queue||[],ids=[...new Set([...entryList.map(entryId),...queue.map(item=>entryId(item.entry))])].filter(Boolean);
 return ids.map(id=>{
  const scheduled=queue.filter(item=>entryId(item.entry)===id),types=new Map();
  for(const item of scheduled)types.set(item.type,(types.get(item.type)||0)+1);
  return{id,name:definitions.get(id)?.name||entryNames[id]||id,total:scheduled.length,
   firstAt:scheduled.length?Math.min(...scheduled.map(item=>item.at)):null,
   enemies:[...types].map(([type,count])=>({type,count,...enemyBrief(enemies[type])}))};
 });
}

export function encounterSidebar(state,plan,open=true){
 const combat=state.phase==='battle',entries=encounterEntries(state,plan);
 const cards=entries.map(entry=>`<section class="entry-intel" data-entry="${e(entry.id)}"><header class="entry-intel-heading"><h3>${e(entry.name)}</h3><span>计划 ${entry.total}${entry.firstAt===null?'':` · ${n(entry.firstAt)} 秒起`}</span></header><div class="entry-enemies">${entry.enemies.map(item=>{
  const spec=enemies[item.type];
  return `<button class="entry-enemy" data-action="enemy-info" data-id="${e(item.type)}" data-enemy-count="${item.count}" title="查看${e(spec.name)}详情" aria-label="${e(spec.name)}，${item.movementLabel}${item.siege?'、攻城':''}${item.rank?'、'+item.rank:''}，${e(item.feature)}，计划 ${item.count} 个，查看详情">${sprite(item.type,'enemies','threat-portrait')}<span class="entry-enemy-copy"><span class="entry-enemy-heading"><strong>${e(spec.name)}</strong><b>×${item.count}</b></span><span class="enemy-traits"><span class="enemy-trait ${item.movement}">${item.movementLabel}</span>${item.siege?'<span class="enemy-trait siege">攻城</span>':''}${item.rank?`<span class="enemy-trait rank">${item.rank}</span>`:''}</span><span class="enemy-feature">${e(item.feature)}</span></span></button>`;
 }).join('')||'<span class="entry-empty">本场暂无计划敌人</span>'}</div></section>`).join('');
 return `<details class="threat-panel enemy-intel" ${open?'open':''}><summary title="展开或收起敌方情报"><span class="intel-summary-label"><strong>入口威胁</strong><small id="hud-enemies" ${combat?'':'hidden'}>${combat?`${plan.enemies?.filter(enemy=>!enemy.dead).length||0} 活动 / ${Math.max(0,plan.total-plan.spawned)} 待到达`:''}</small></span><span class="threat-toggle-cue"><span class="threat-open-label">收起</span><span class="threat-closed-label">展开</span>${icon('arrow')}</span></summary><div class="entrance-list">${cards||'<p class="entry-empty">本场暂无计划敌人</p>'}</div><button class="btn ghost wide encounter-details" data-action="encounter">完整到达队列 ${icon('arrow')}</button></details><p id="hud-wave" class="encounter-alert" ${combat&&plan.bossKilled?'':'hidden'}>${combat&&plan.bossKilled?'首领已击败 · 清理余敌':''}</p>`;
}
