import {items} from './item-content.js';
import {towers} from './content.js';

export {items};
export const DEFAULT_CAPACITY=12, MAX_CAPACITY=20, DEFAULT_ITEM_CAPACITY=3, MAX_ITEM_CAPACITY=4;
const fail=reason=>({ok:false,reason});
export function ensureInventory(state) {
  state.inventory ||= {capacity:DEFAULT_CAPACITY,itemCapacity:DEFAULT_ITEM_CAPACITY,items:[],nextId:0,pity:0};
  return state.inventory;
}
export function inventoryStatus(state) {
  const bag=state.inventory||{capacity:DEFAULT_CAPACITY,itemCapacity:DEFAULT_ITEM_CAPACITY,items:[]};
  const stored=state.units.filter(u=>!Number.isFinite(u.x));
  return {...bag,stored,used:stored.length,overflow:Math.max(0,stored.length-bag.capacity)};
}
export function discardUnits(state,uids) {
  if(!['map','node','prep','nexus'].includes(state.phase))return fail('请在路线、节点或战前整理构造。');
  const unique=[...new Set(uids||[])],units=unique.map(id=>state.units.find(u=>u.uid===id));
  if(!unique.length||units.some(u=>!u||Number.isFinite(u.x)))return fail('只能删除背包中的构造，请先选择。');
  state.units=state.units.filter(u=>!unique.includes(u.uid));
  state.stats.history.push({act:state.act,floor:state.floor,text:`整理背包：删除 ${units.map(u=>`${towers[u.type].name} T${u.tier}`).join('、')}`});
  return {ok:true,reason:`已删除 ${unique.length} 个仓库构造`};
}
export function addItem(state,type,replaceUid=null) {
  if(!items[type])return fail('未知道具。');
  const bag=ensureInventory(state),index=replaceUid===null?-1:bag.items.findIndex(item=>item.uid===replaceUid);
  if(replaceUid!==null&&index<0)return fail('被替换道具已不存在。');
  if(index<0&&bag.items.length>=bag.itemCapacity)return fail('道具槽已满，请选择替换一个道具或放弃。');
  const entry={uid:`p${++bag.nextId}`,type};
  if(index>=0)bag.items.splice(index,1,entry);else bag.items.push(entry);
  return {ok:true,item:entry};
}
export function discardItem(state,uid) {
  if(!['map','prep','node','reward','battle','nexus'].includes(state.phase))return fail('本局已经结束。');
  const bag=ensureInventory(state),index=bag.items.findIndex(item=>item.uid===uid);
  if(index<0)return fail('未找到道具。');
  bag.items.splice(index,1);return {ok:true,reason:'道具已丢弃'};
}
