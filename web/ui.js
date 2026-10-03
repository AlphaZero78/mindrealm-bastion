import {ENTITY_ART} from './view/entity-art.js';
export const ROUTE_LAYER_GAP=136;
const drawings={
  heart:'<path d="M12 21 3 12C-2 4 7-1 12 6c5-7 14-2 9 6z"/>',
  repair:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  snow:'<path d="M12 2v20M3 7l18 10M3 17 21 7M8 4l4 3 4-3M8 20l4-3 4 3M3 11l5-1-1-5m10 0-1 5 5 1M3 13l5 1-1 5m10 0-1-5 5-1"/>',
  attack:'<path d="m14 2-9 12h6l-1 8 9-12h-6z"/>',
  resistance:'<path d="m12 2 9 4v7c0 4-6 8-9 9-3-1-9-5-9-9V6zM5 12h3l2-4 4 8 2-4h3"/>',
  burst:'<path d="m12 1 3 7 7-3-3 7 4 5-8-1-3 7-3-7-8 1 4-5-3-7 7 3z"/>',
  armor:'<path d="M8 2h8l1 5 4 3-2 12H5L3 10l4-3zM8 10h8m-8 5h8M12 8v11"/>',
  battle:'<path d="m6 4 14 16m-1-16L5 20M4 13l7 7m2-16 7 7M4 4l2 6 4-4zm16 0-2 6-4-4z"/>',
  elite:'<path d="m4 5 5 4 3-6 3 6 5-4-2 12H6zM8 21h8M9 13h6"/>',
  boss:'<path d="m3 5 5 3 4-5 4 5 5-3-2 12-7 5-7-5zM8 12l2 2m6-2-2 2m-4 4h4"/>',
  camp:'<path d="M12 3 2 21h20L12 3zm0 10-5 8m5-8 5 8"/>',
  workshop:'<path d="M14 3a6 6 0 0 0-6 8L2 17l5 5 6-7a6 6 0 0 0 8-7l-4 3-4-4 3-4z"/>',
  shop:'<path d="M3 10h18l-2-7H5zM5 10v11h14V10M9 21v-7h6v7"/>',
  treasure:'<path d="M3 9h18v12H3zm1 0V6l3-3h10l3 3v3M3 14h18m-10-2h2v5h-2z"/>',
  event:'<path d="m12 2 10 10-10 10L2 12zM12 7v7m0 3h.01"/>',
  unknown:'<path d="m12 2 10 10-10 10L2 12zM9 9a3 3 0 1 1 4 3l-1 2m0 3h.01"/>',
  spirit:'<path d="m12 2 8 10-8 10-8-10zM12 7v10"/>',
  focus:'<path d="m14 2-9 12h6l-1 8 9-12h-6z"/>',
  bandwidth:'<path d="M4 8V4h4m8 0h4v4m0 8v4h-4m-8 0H4v-4M8 8h8v8H8z"/>',
  depth:'<path d="m2 7 10-5 10 5-10 5zm0 5 10 5 10-5M2 17l10 5 10-5"/>',
  map:'<path d="m3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3zm6-3v17m6-14v17"/>',
  settings:'<path d="M4 7h16M4 17h16M9 4v6m6 4v6"/>',
  book:'<path d="M12 5C8 2 5 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-6-2-10 1zm0 0v16"/>',
  play:'<path d="m8 4 13 8-13 8z"/>',pause:'<path d="M7 4v16M17 4v16"/>',
  close:'<path d="m5 5 14 14M5 19 19 5"/>',check:'<path d="m4 12 5 5L20 6"/>',
  arrow:'<path d="M3 12h18m-7-7 7 7-7 7"/>',lock:'<path d="M5 10h14v11H5zm3 0V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
  shield:'<path d="m12 2 9 4v6c0 5-6 9-9 10-3-1-9-5-9-10V6z"/>',
  ranged:'<path d="M3 20 17 6m-7-3 11 11M5 5l14 14M6 12a7 7 0 0 1 6-6"/>',
  melee:'<path d="m17 2 5 5-13 13-5-5zm-14 10 9 9M2 22l5-5"/>',
  support:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  undo:'<path d="M3 11h11a6 6 0 0 1 0 12M3 11l6-6M3 11l6 6"/>',
  raise:'<path d="m3 16 9-5 9 5-9 5zM12 12V2m-4 4 4-4 4 4"/>',
  lower:'<path d="m3 16 9-5 9 5-9 5zM12 2v10m-4-4 4 4 4-4"/>',
  ramp:'<path d="M3 21 21 3v18zM8 16h7V9"/>',flatten:'<path d="M3 19h18M3 5h18M6 9v6m-2-2 2 2 2-2m10-4v6m-2-2 2 2 2-2"/>',
  sound:'<path d="M3 9h4l5-5v16l-5-5H3zm13-3a8 8 0 0 1 0 12m2-15a12 12 0 0 1 0 18"/>',
};
export function icon(name,cls=''){return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[name]||drawings.event}</svg>`;}
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const labels={battle:'普通战斗',elite:'精英战斗',boss:'首领战',camp:'营地',workshop:'工坊',shop:'商店',treasure:'宝库',event:'未知信号',unknown:'未知信号',melee:'近战',ranged:'远程',support:'支援'};
export const nodeInfo={battle:['稳定威胁','单位奖励 · 专注'],elite:['强敌与特殊机制','收藏品 · 大量专注'],boss:['本幕控制信号源','切断信号 · 深入下一幕'],camp:['安全区 · 三选一','精神恢复 / 维修 / 升级'],workshop:['安全区 · 按次付费','维修耐久 · 分支升级'],shop:['安全区 · 自由交易','构造 / 收藏品 / 道具 / 服务'],treasure:['安全区 · 免费选择','三选一收藏品'],event:['先看清代价再决定','明确得失的交换与成长'],unknown:['75% 事件 / 25% 战斗','交换与成长 / 战斗奖励']};
export const n=value=>Number(value||0).toLocaleString('zh-CN',{maximumFractionDigits:1});
export function sprite(type,kind='towers',extra='',entity=null){const art=ENTITY_ART[type],variant=kind==='towers'?`T${entity?.tier||1}${(entity?.tier||1)>1?entity?.branch||'A':''}`:`phase${Math.max(0,Math.min(2,entity?.phase||0))+1}`,row=Math.max(0,art?.variants.indexOf(variant)||0),rows=art?.iconRows||1,cell=art?.cell||80,b=art?.iconBounds||{x:0,y:0,width:cell,height:cell};return `<span class="sprite ${extra}" data-art-variant="${escapeHTML(art?.variants[row]||'base')}" aria-hidden="true"><svg viewBox="${b.x} ${b.y} ${b.width} ${b.height}" focusable="false"><image href="/assets/game/sprites/${kind}/${escapeHTML(type)}.png" width="${cell*8}" height="${cell*rows}" y="${-row*cell}"/></svg></span>`;}
/** Route choices and timed combat events share one readable history format. */
export function historyLabel(entry={}){
 const route=Number.isInteger(entry.act)&&Number.isInteger(entry.floor)?`${entry.act+1}-${entry.floor+1} `:'';
 if(entry.type==='breach')return `${route}战斗${Number.isFinite(entry.time)?` ${n(entry.time)} 秒`:''} · ${entry.enemy||'敌人'}突破`;
 return `${route}${entry.text||'战斗记录'}`;
}
