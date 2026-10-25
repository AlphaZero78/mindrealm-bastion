import {ENTITY_ART} from './view/entity-art.js';
import {MODEL_PORTRAITS} from './view/model-portraits.js';
export const ROUTE_LAYER_GAP=136;
export {stickerIcon as icon,contentIcon} from './view/sticker-icons.js';
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const labels={battle:'普通战斗',elite:'精英战斗',boss:'首领战',camp:'营地',workshop:'工坊',shop:'商店',treasure:'宝库',event:'未知信号',unknown:'未知信号',melee:'近战',ranged:'远程',support:'支援'};
export const nodeInfo={battle:['稳定威胁','单位奖励 · 专注'],elite:['强敌与特殊机制','收藏品 · 大量专注'],boss:['本幕控制信号源','切断信号 · 深入下一幕'],camp:['安全区 · 三选一','精神恢复 / 维修 / 升级'],workshop:['安全区 · 按次付费','维修耐久 · 分支升级'],shop:['安全区 · 自由交易','构造 / 收藏品 / 道具 / 服务'],treasure:['安全区 · 免费选择','三选一收藏品'],event:['先看清代价再决定','明确得失的交换与成长'],unknown:['75% 事件 / 25% 战斗','交换与成长 / 战斗奖励']};
export const n=value=>Number(value||0).toLocaleString('zh-CN',{maximumFractionDigits:1});
export function sprite(type,kind='towers',extra='',entity=null){
 const art=ENTITY_ART[type],portrait=MODEL_PORTRAITS[type],variant=kind==='towers'?`T${entity?.tier||1}${(entity?.tier||1)>1?entity?.branch||'A':''}`:`phase${Math.max(0,Math.min(2,entity?.phase||0))+1}`,row=Math.max(0,art?.variants.indexOf(variant)||0),b=portrait.bounds,cell=portrait.cell;
 return `<span class="sprite ${extra}" data-art-variant="${escapeHTML(art?.variants[row]||'base')}" aria-hidden="true"><svg viewBox="${b.x} ${b.y} ${b.width} ${b.height}" focusable="false"><image href="${portrait.path}" width="${cell}" height="${cell*portrait.rows}" y="${-row*cell}"/></svg></span>`;
}
/** Route choices and timed combat events share one readable history format. */
export function historyLabel(entry={}){
 const route=Number.isInteger(entry.act)&&Number.isInteger(entry.floor)?`${entry.act+1}-${entry.floor+1} `:'';
 if(entry.type==='breach')return `${route}战斗${Number.isFinite(entry.time)?` ${n(entry.time)} 秒`:''} · ${entry.enemy||'敌人'}突破`;
 return `${route}${entry.text||'战斗记录'}`;
}
