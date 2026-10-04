import { acts, towers, enemies, relics, talents, events, effects, contentPool, seededRandom, shuffle, messengers } from './content.js';
import * as Rules from './rules.js';
import { CURRENT_DIFFICULTY_REVISION, normalizeDifficulty, difficultyProfile, xpRequirement, upgradeRequirement, levelBandwidth } from './difficulty.js';
import {items,ensureInventory,inventoryStatus,addItem,discardUnits,MAX_CAPACITY,MAX_ITEM_CAPACITY} from './inventory.js';
import {generateTerrain} from './world.js';
import {eventChoice} from './event-balance.js';

export const cloneState = state => JSON.parse(JSON.stringify(state));
const ok = extra => ({ ok: true, ...extra });
const fail = reason => ({ ok: false, reason });
const pick = (items, random) => items[Math.floor(random() * items.length)];
const heal = (state, amount) => { state.spirit = Math.min(state.maxSpirit, state.spirit + amount); };
const record = (state, text) => state.stats.history.push({ act: state.act, floor: state.floor, text });

export {generateTerrain} from './world.js';

const nodeInfo = {
  battle: ['战斗', '连续三群敌人', '单位三选一、专注与精神恢复'], elite: ['精英', '连续四群敌人，包含精英', '更多专注、单位与必得收藏品'],
  camp: ['营地', '只能选择一项服务', '恢复精神、维修或免费升阶'], workshop: ['工坊', '服务消耗专注', '可反复维修与升级'], shop: ['商店', '商品消耗专注，库存固定', '构造、收藏品、道具、扩容与回收服务'],
  treasure: ['宝库', '无战斗', '免费选择一件收藏品'], event: ['未知信号', '已揭示为事件，确认前显示实际得失', '明确得失的交换与成长选择'], unknown: ['未知信号', '75% 事件 / 25% 战斗；结果随种子固定', '事件交换与成长，或战斗奖励'], boss: ['首领', '连续五群，第四群首领', '切断本幕控制信号']
};

export function generateMap(seed, actIndex, pool = contentPool()) {
  const act = acts[actIndex], random = seededRandom(`${seed}:map:${actIndex}`), nodes = [], layers = [];
  const boss = pick(act.bosses, seededRandom(`${seed}:boss:${actIndex}`));
  for (let floor = 0; floor < act.floors; floor++) {
    const count = floor === 0 ? 4 : floor >= act.floors - 2 ? 1 : 2 + Math.floor(random() * 3);
    const lanes = count === 1 ? [2] : shuffle([0, 1, 2, 3, 4], random).slice(0, count).sort((a, b) => a - b);
    const layer = lanes.map(lane => ({ id: `a${actIndex}f${floor}l${lane}`, floor, lane, type: 'battle', next: [], completed: false }));
    nodes.push(...layer); layers.push(layer);
  }
  for (let floor = 0; floor < layers.length - 1; floor++) {
    const current = layers[floor], next = layers[floor + 1];
    const connect = (a, b) => { if (!a.next.includes(b.id)) a.next.push(b.id); };
    for (const a of current) connect(a, [...next].sort((b, c) => Math.abs(b.lane - a.lane) - Math.abs(c.lane - a.lane))[0]);
    for (const b of next) connect([...current].sort((a, c) => Math.abs(a.lane - b.lane) - Math.abs(c.lane - b.lane))[0], b);
    for (const a of current) if (random() < .55) { const candidates = next.filter(b => Math.abs(b.lane - a.lane) <= 2); if (candidates.length) connect(a, pick(candidates, random)); }
  }
  const services = ['camp', 'workshop', 'shop'];
  for (let floor = 0; floor < layers.length; floor++) {
    const layer = layers[floor];
    for (const node of layer) {
      const rng = seededRandom(`${seed}:node:${node.id}`);
      if (floor === 0) node.type = 'battle';
      else if (floor === act.floors - 1) { node.type = 'boss'; node.boss = boss; }
      else if (floor === act.floors - 2) node.type = 'camp';
      else {
        const predecessors = nodes.filter(n => n.next.includes(node.id));
        const excluded = predecessors.map(n => n.type === 'unknown' ? n.revealType : n.type).filter(t => services.includes(t));
        // Reserve the layer before the mandatory camp for non-camp choices.
        if (floor === act.floors - 3) excluded.push('camp');
        const pool = ['battle', 'battle', 'battle', 'unknown', 'unknown', 'shop', 'camp', 'workshop', ...(floor >= 4 ? ['elite'] : [])].filter(t => !excluded.includes(t));
        node.type = pick(pool, rng);
      }
      node.revealType = pick(['event', 'event', 'event', 'battle'], rng);
      if (node.type === 'unknown' && node.revealType === 'shop' && nodes.some(previous => previous.next.includes(node.id) && (previous.type === 'shop' || previous.type === 'unknown' && previous.revealType === 'shop'))) node.revealType = 'event';
      node.event = pick(Object.values(events).filter(e => e.act === actIndex + 1 && pool.events.includes(e.id)), rng).id;
    }
    if (floor > 0 && floor < act.floors - 2 && layer.every(n => n.type === layer[0].type)) layer[layer.length - 1].type = layer[0].type === 'battle' ? 'unknown' : 'battle';
  }
  layers[Math.floor(act.floors / 2)][0].type = 'treasure';
  // A forced treasure must still leave another meaningful option on its layer.
  const middle = layers[Math.floor(act.floors / 2)];
  if (middle.every(n => n.type === 'treasure')) middle[1].type = 'battle';
  for (const node of nodes) { const info = nodeInfo[node.type]; node.name = info[0]; node.risk = info[1]; node.reward = info[2]; node.map_icon_id = node.type; }
  return { id: act.id, name: act.name, floors: act.floors, boss, nodes };
}

export function newRun(seed, pressure = 0, profile = {}) {
  const pool = contentPool(profile);
  const state = { version: 2, seed: String(seed), phase: 'nexus', act: 0, floor: -1, currentNode: null, pressureLevel: normalizeDifficulty(pressure), difficultyRevision: CURRENT_DIFFICULTY_REVISION, contentPool: pool,
    terrain: generateTerrain(seed), maps: acts.map((_, i) => generateMap(seed, i, pool)), units: [], spirit: 100, maxSpirit: 100, focus: 99, bandwidth: 20, resistance: 0, depth: 1, xp: 0,
    relics: [], talents: [], modifiers: {}, rewardQueue: [], rewardCounter: 0, unitCounter: 0, pendingUnitRewards: 0, pendingTalents: 0, bossReveal: 0, visited: [], nextNodes: [],
    discoveries: { towers: [], enemies: [], relics: [], talents: [], archives: [] }, unitOrigins: {}, stats: { kills: 0, breaches: 0, pressure: 0, breachDamage: 0, eventDamage: 0, destroyed: 0, elites: 0, overloadSeconds: 0, damageByUnit: {}, history: [], pressureLog: [], completedNodes: 0, bosses: [] } };
  for (const id of ['anchor_bulwark', 'phase_blade', 'resonance_guard', 'pulse_array', 'pulse_array', 'focus_rail', 'memory_mechanic']) addUnit(state, id);
  state.nextNodes = state.maps[0].nodes.filter(n => n.floor === 0).map(n => n.id);
  ensureInventory(state);
  ensureNexus(state);
  return state;
}

export function ensureNexus(state,{legacy=false}={}) {
  if(state.nexus)return state.nexus;
  state.nexus=acts.map((_,act)=>{const rng=seededRandom(`${state.seed}:nexus:${act}`),m=pick(Object.values(messengers).filter(m=>m.act===act),rng);return {act,messenger:m.id,options:shuffle(m.gifts.map(g=>g.id),rng).slice(0,3),choice:null,skipped:legacy&&act<=state.act};});
  return state.nexus;
}
export function chooseNexus(state,id) {
  const room=state.nexus?.[state.act];
  if(state.phase!=='nexus'||!room||room.choice||room.skipped||!room.options.includes(id)||state.relics.includes(id))return fail('请选择当前精神使者提供的一件收藏品。');
  const before=state.units.map(u=>[u,Rules.unitStats(state,u).maxHp]),gift=relics[id],grant=gift.grant||{};
  state.relics.push(id);discover(state,'relics',id);
  if(grant.maxSpirit){state.maxSpirit=Math.max(20,state.maxSpirit+grant.maxSpirit);state.spirit=Math.min(state.maxSpirit,state.spirit+Math.max(0,grant.maxSpirit));}
  state.focus+=grant.focus||0;heal(state,grant.heal||0);
  if(grant.capacity){const bag=ensureInventory(state);bag.capacity=Math.min(MAX_CAPACITY,bag.capacity+grant.capacity);}
  if(grant.spiritCost)state.spirit=Math.max(1,state.spirit-grant.spiritCost);
  for(const [u,maxHp] of before)u.hp=Math.min(Rules.unitStats(state,u).maxHp,Rules.unitStats(state,u).maxHp*u.hp/maxHp);
  room.choice=id;state.phase='map';record(state,`心神枢纽 · ${messengers[room.messenger].name}：选择${gift.name}`);
  return ok({reason:`获得${gift.name}，本幕路线已开放`});
}

export function addUnit(state, id, tier = 1, branch = null) {
  if (!towers[id]) return null;
  const unit = { uid: `u${++state.unitCounter}`, type: id, tier, branch, hp: towers[id].hp, x: null, z: null, everDeployed: false, order: 0, priority: towers[id].ability === 'high_hp_priority' ? 'hp' : 'near' };
  state.units.push(unit); unit.hp = Rules.unitStats(state, unit).maxHp;
  state.unitOrigins ||= {}; state.unitOrigins[unit.uid] = { type:id, name:towers[id].name };
  discover(state, 'towers', id); return unit;
}
function discover(state, kind, id) { const list = state.discoveries[kind]; if (!list.includes(id)) list.push(id); }
export function availableNodes(state) { return state.phase === 'map' ? state.maps[state.act].nodes.filter(n => state.nextNodes.includes(n.id) && !n.completed) : []; }

function candidates(state, kind, suffix) {
  const rng = seededRandom(`${state.seed}:reward:${state.currentNode?.id || 'start'}:${suffix}`);
  if (kind === 'unit') {
    const counts = Object.values(towers).map(t => ({ id: t.id, value: rng() + Math.min(2, state.units.filter(u => u.type === t.id && u.tier < 3).length) * .12 }));
    return counts.sort((a, b) => b.value - a.value).slice(0, 3).map(t => t.id);
  }
  const catalog = kind === 'relic' ? relics : talents, owned = kind === 'relic' ? state.relics : state.talents;
  return shuffle((state.contentPool?.[kind === 'relic' ? 'relics' : 'talents'] || Object.keys(catalog)).filter(id => !owned.includes(id)), rng);
}
function pushReward(state, kind, suffix = '') {
  const reserves = candidates(state, kind, `${state.rewardCounter++}:${suffix}`), options = reserves.slice(0, 3);
  if (options.length) state.rewardQueue.push({ kind, options, reserves, title: kind === 'unit' ? '接纳新的心智构造' : kind === 'relic' ? '选择收藏品' : '选择天赋' });
}
function queueGrowth(state) {
  while (state.pendingUnitRewards > 0) { pushReward(state, 'unit', 'depth'); state.pendingUnitRewards--; }
  while (state.pendingTalents > 0) { pushReward(state, 'talent', 'depth'); state.pendingTalents--; }
  const ranks = { unit: 0, relic: 1, talent: 2, upgrade: 3, item:4 };
  state.rewardQueue.sort((a, b) => ranks[a.kind] - ranks[b.kind]);
}

export function enterNode(state, id) {
  const node = availableNodes(state).find(n => n.id === id);
  if (!node) return fail('只能选择当前高亮连接的下一节点。');
  const bag=inventoryStatus(state);if(bag.overflow)return fail(`背包 ${bag.used}/${bag.capacity}，请先移除至少 ${bag.overflow} 个构造。`);
  state.currentNode = node; state.floor = node.floor; state.bossReveal = Math.max(state.bossReveal, node.floor >= state.maps[state.act].floors - 2 ? 3 : node.floor >= Math.floor(state.maps[state.act].floors / 2) ? 2 : 1);
  if (node.type === 'unknown') { node.originalType = 'unknown'; node.type = node.revealType; node.map_icon_id = 'unknown'; [node.name, node.risk, node.reward] = nodeInfo[node.type]; record(state, `未知信号揭示为${node.type==='event'?'事件':node.name}`); }
  const rng = seededRandom(`${state.seed}:service:${node.id}`);
  if (node.type === 'shop' && !node.stock) node.stock = { units: shuffle(state.contentPool.towers, rng).slice(0, 3).map((id, i) => ({ id, key: `unit${i}`, sold: false })), relics: shuffle(state.contentPool.relics.filter(id => !state.relics.includes(id)), rng).slice(0, 3).map((id, i) => ({ id, key: `relic${i}`, sold: false })) };
  if(node.type==='shop')ensureShopStock(state);
  if (node.type === 'treasure' && !node.options) node.options = candidates(state, 'relic', `treasure:${node.id}`).slice(0, 3);
  if (node.type === 'event' && !node.eventData) {
    node.eventData = { id: node.event, unit: pick(state.contentPool.towers, rng), relic: pick(state.contentPool.relics.filter(id => !state.relics.includes(id)), rng) || null, targets: shuffle(state.units.map(u => u.uid), rng), branch: rng() < .5 ? 'A' : 'B' };
  }
  state.phase = ['battle', 'elite', 'boss'].includes(node.type) ? 'prep' : 'node';
  if(state.phase==='prep'){state.terrainEdits=0;state.terrainUndo=[];}
  state.battle = null; state.preBattle = null; return ok({ node });
}

function completeNode(state) {
  const node = state.currentNode;
  if (node && !node.completed) { node.completed = true; const canonical = state.maps[state.act].nodes.find(n => n.id === node.id); if (canonical) Object.assign(canonical, node); state.visited.push(node.id); state.stats.completedNodes++; record(state, `完成${node.name || node.type}`); }
  state.nextNodes = node ? [...node.next] : state.nextNodes;
  state.phase = state.rewardQueue.length ? 'reward' : 'map';
  if (!state.rewardQueue.length && state.nextAct !== undefined) state.phase='interlude';
}
function enterNextAct(state) {
  state.act = state.nextAct; delete state.nextAct; state.floor = -1; state.currentNode = null; state.bossReveal = 1; state.nextNodes = state.maps[state.act].nodes.filter(n => n.floor === 0).map(n => n.id); state.phase = 'map';
  record(state, `进入${acts[state.act].name}`);
  const room=ensureNexus(state)[state.act];if(!room.choice&&!room.skipped)state.phase='nexus';
}

export function continueAct(state){
  if(state.phase!=='interlude'||!Number.isInteger(state.nextAct)||state.nextAct!==state.act+1||state.nextAct>2||state.rewardQueue.length)return fail('请先完成本幕战斗与奖励。');
  const bag=inventoryStatus(state);if(bag.overflow)return fail(`背包已超出 ${bag.overflow} 格，请先整理构造。`);
  enterNextAct(state);state.battle=null;state.preBattle=null;return ok({reason:`已进入${acts[state.act].name}`});
}

export function addXP(state, amount) {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  state.xp += amount; let levels = 0;
  while (state.depth < 12 && state.xp >= xpRequirement(state)) {
    state.xp -= xpRequirement(state); state.depth++; levels++; state.maxSpirit += 5; heal(state, difficultyProfile(state).revision>=3?6:10); state.bandwidth += levelBandwidth(state) + effects(state).level_bandwidth; state.resistance++;
    state.pendingUnitRewards++; if (state.depth % 2 === 0) state.pendingTalents++;
    record(state, `精神深度达到${state.depth}`);
  }
  return levels;
}

export function finishBattle(state, result = {}) {
  if (!['battle', 'prep'].includes(state.phase)) return fail('当前没有待结算的战斗。');
  const lost = result.won === false || result.victory === false || state.spirit <= 0;
  if(!lost&&state.phase==='battle'&&(state.battle?.result!=='won'||state.battle.spawned<state.battle.queue.length||state.battle.enemies.some(e=>!e.dead)))return fail('请先清理全部计划敌人与增援。');
  if (lost) { state.spirit = Math.max(0, state.spirit); state.phase = 'lost'; state.preBattle = null; record(state, '醒觉火种熄灭'); state.summary = getSummary(state); return ok({ terminal: true }); }
  addXP(state, result.xp || 0);
  const type = state.currentNode.type, modifier = effects(state);
  heal(state,modifier.nexus_post_heal||0);
  if(modifier.nexus_post_repair)for(const u of state.units)if(u.hp>0)u.hp=Math.min(Rules.unitStats(state,u).maxHp,u.hp+Rules.unitStats(state,u).maxHp*modifier.nexus_post_repair);
  if (type === 'boss') {
    const id = state.currentNode.boss || state.maps[state.act].boss;
    if (!state.stats.bosses.includes(id)) state.stats.bosses.push(id);
    discover(state, 'enemies', id); discover(state, 'archives', id);
    heal(state, state.maxSpirit * (state.act === 2 ? .35 : .20));
    if (state.act === 2) { completeNode(state); state.phase = 'won'; state.rewardQueue = []; state.preBattle = null; record(state, '最终控制信号已切断'); state.summary = getSummary(state); return ok({ terminal: true }); }
    state.focus += 100 + state.act * 25; pushReward(state, 'relic', 'act-boss'); state.nextAct = state.act + 1;
  } else {
    heal(state, type === 'elite' ? 12 : 8); state.focus += type === 'elite' ? acts[state.act].elite_focus : acts[state.act].normal_focus;
    pushReward(state, 'unit', 'battle');
    if (type === 'elite' || seededRandom(`${state.seed}:relic-roll:${state.currentNode.id}`)() < .2) pushReward(state, 'relic', 'battle');
  }
  const bag=ensureInventory(state),drop=seededRandom(`${state.seed}:item-drop:${state.currentNode.id}`);
  if(drop()<.35+bag.pity*.1){queueItem(state,pick(Object.keys(items),drop));bag.pity=0;}else bag.pity++;
  queueGrowth(state);
  if (modifier.melee_post_repair) for (const u of state.units) if (towers[u.type].role === 'melee' && u.hp > 0) u.hp = Math.min(Rules.unitStats(state, u).maxHp, u.hp + Rules.unitStats(state, u).maxHp * modifier.melee_post_repair);
  if (modifier.post_repair) { const u = [...state.units].filter(u => u.hp > 0).sort((a, b) => (Rules.unitStats(state, b).maxHp - b.hp) - (Rules.unitStats(state, a).maxHp - a.hp))[0]; if (u) u.hp = Math.min(Rules.unitStats(state, u).maxHp, u.hp + Rules.unitStats(state, u).maxHp * modifier.post_repair); }
  if (modifier.unused_bandwidth_focus) { const b = Rules.bandwidthState({ ...state, battle:null }); state.focus += Math.floor(Math.max(0, b.cap - b.used) / 5) * modifier.unused_bandwidth_focus; }
  state.preBattle = null; completeNode(state); return ok({ terminal: false });
}

export function chooseReward(state, id, payload={}) {
  if (state.phase !== 'reward' || !state.rewardQueue.length) return fail('当前没有待领取的奖励。');
  const reward = state.rewardQueue[0];
  if (!reward.options.includes(id)&&!(reward.kind==='item'&&id==='skip')) return fail('只能选择显示的奖励。');
  if(reward.kind==='item'&&id!=='skip'){const result=addItem(state,id,payload.replaceUid??null);if(!result.ok)return result;}
  if (reward.kind === 'unit') addUnit(state, id, reward.tier || 1, reward.tier === 2 ? reward.branch || 'A' : null);
  if (reward.kind === 'relic' || reward.kind === 'talent') { const list = reward.kind === 'relic' ? state.relics : state.talents; if (list.includes(id)) return fail('已经拥有该奖励。'); list.push(id); discover(state, reward.kind === 'relic' ? 'relics' : 'talents', id); }
  if (reward.kind === 'upgrade') { const [uid, branch] = id.split(':'); const r = Rules.upgrade(state, uid, branch, {free:true}); if (!r.ok) return r; }
  record(state, id==='skip'?'放弃道具':`选择${towers[id]?.name || relics[id]?.name || talents[id]?.name || items[id]?.name || id}`); state.rewardQueue.shift();
  // Refill later offers from their saved order, keeping three unowned options
  // whenever the pool has enough. No interface action advances a random stream.
  for (const offer of state.rewardQueue) if (offer.kind === 'talent' || offer.kind === 'relic') offer.options = (offer.reserves || offer.options).filter(choice => !(offer.kind === 'talent' ? state.talents : state.relics).includes(choice)).slice(0, 3);
  state.rewardQueue = state.rewardQueue.filter(offer => offer.options.length);
  if (!state.rewardQueue.length) state.phase=state.nextAct!==undefined?'interlude':'map';
  return ok();
}

export function servicePrice(state, base) { return Math.ceil(base * difficultyProfile(state).serviceMultiplier); }
export function queueItem(state,id){state.rewardQueue.push({kind:'item',options:[id],title:'发现应急道具'});}
export function ensureShopStock(state){
  const node=state.currentNode;if(node?.type!=='shop'||!node.stock)return;
  const stock=node.stock,rng=seededRandom(`${state.seed}:shop-variety:${node.id}`);
  if(!stock.items)stock.items=shuffle(Object.keys(items),rng).slice(0,3).map((id,i)=>({id,key:`item${i}`,sold:false,price:Math.ceil(items[id].price*(i===0?.75:1))}));
  stock.services||={capacity:false,pouch:false,heal:false};
  if(difficultyProfile(state).revision>=3&&!stock.priced){
    stock.units.forEach((offer,i)=>{offer.tier=i===2&&state.depth>=2?2:1;offer.branch=offer.tier===2?(rng()<.5?'A':'B'):null;offer.price=Math.round((offer.tier===2?135:80)*(i===0?.75:1));});
    stock.relics.forEach((offer,i)=>{offer.price=i===1?95:120;});stock.priced=true;
  }
}
export function shopPrice(state,kind,offer){return servicePrice(state,offer.price??(kind==='units'?80:kind==='items'?items[offer.id].price:120));}
export function eventPreview(state, index, payload={}) {
  const node = state.currentNode, event = events[node?.eventData?.id], choice = eventChoice(state,event,index);
  if (!choice) return null;
  const details = [], fx = choice.effects, data = node.eventData;
  const bag=inventoryStatus(state),recycled=fx.recycle?(payload.uid?bag.stored.find(u=>u.uid===payload.uid):bag.stored.find(u=>data.targets.includes(u.uid))):null;
  const consumed=fx.consume_item?(payload.itemUid?bag.items.find(item=>item.uid===payload.itemUid):bag.items[0]):null;
  if(fx.recycle)details.push(recycled?`永久拆解 ${towers[recycled.type].name} T${recycled.tier}${recycled.branch||''} · ${recycled.uid}`:'需要一座库存构造');
  if(fx.consume_item)details.push(consumed?`交出 ${items[consumed.type].name}`:'需要一瓶未使用的道具');
  if(fx.item)details.push(`获得 ${items[fx.item].name}；槽位已满时可替换或放弃`);
  if(fx.capacity)details.push(`背包容量 ${bag.capacity} → ${Math.min(MAX_CAPACITY,bag.capacity+fx.capacity)}`);
  if(fx.item_capacity)details.push(`道具槽 ${bag.itemCapacity} → ${Math.min(MAX_ITEM_CAPACITY,bag.itemCapacity+fx.item_capacity)}`);
  if(fx.max_spirit)details.push(`最大精神 +${fx.max_spirit}，当前精神恢复 ${fx.max_spirit}`);
  const spiritAfterGrowth=Math.min(state.maxSpirit+(fx.max_spirit||0),state.spirit+Math.max(0,fx.max_spirit||0));
  if (fx.spirit) details.push(`精神 ${fx.spirit>0?'+':''}${Math.round(fx.spirit)}${spiritAfterGrowth+fx.spirit<=0?'（将导致本局失败）':''}`);
  for (const [key, name] of [['focus', '专注'], ['bandwidth', '永久带宽'], ['resistance', '永久抗性'], ['xp', '经验']]) if (fx[key]) details.push(`${name} ${fx[key] > 0 ? '+' : ''}${fx[key]}`);
  if (fx.unit || fx.unit_t2) details.push(`获得${towers[data.unit].name}${fx.unit_t2 ? (upgradeRequirement(state,{tier:1}).ok?' T2（随后选择分支）':' T1；升阶将在深度2开放，本次升阶折算40专注') : ' T1'}`);
  if (fx.relic) details.push(data.relic ? `获得${relics[data.relic].name}` : '收藏品已集齐：获得120专注');
  if (fx.tower_hp || fx.tower_damage) { const u = state.units.find(u => u.uid === data.targets[0]); if (u) details.push(`${towers[u.type].name}：${fx.tower_hp ? `最大耐久加成 +${Math.round(fx.tower_hp * 100)}%` : `损失 ${Math.min(u.hp, Math.ceil(Rules.unitStats(state, u).maxHp * fx.tower_damage))} 耐久${u.hp <= Math.ceil(Rules.unitStats(state, u).maxHp * fx.tower_damage) ? '（构造将损坏）' : ''}`}`); }
  if (fx.free_upgrade || fx.free_upgrades) {
    const requested = fx.free_upgrades || 1, targets = data.targets.map(id => state.units.find(u => u.uid === id)).filter(u => u && upgradeRequirement(state,u).ok).slice(0, requested);
    details.push(targets.length ? `免费升阶：${targets.map(u => `${towers[u.type].name} T${u.tier}→T${u.tier + 1}`).join('、')}；领取时确认分支` : '没有可升阶单位');
    if (targets.length < requested) details.push(`未使用的${requested - targets.length}次升阶兑换${(requested - targets.length) * 40}专注`);
  }
  if (fx.duplicate_t1) { const u = state.units.find(u => u.tier === 1); details.push(u ? `复制${towers[u.type].name} T1` : '没有T1可复制：获得40专注'); }
  if (fx.repair_all) { const amount = state.units.reduce((sum, u) => sum + Math.min(Rules.unitStats(state, u).maxHp - u.hp, Rules.unitStats(state, u).maxHp * fx.repair_all), 0); details.push(`所有单位恢复最大耐久的${Math.round(fx.repair_all * 100)}%（合计${Math.round(amount)}耐久），已部署的受修单位回仓库`); }
  if (fx.free_repairs) { const targets = [...state.units].filter(u => u.hp < Rules.unitStats(state, u).maxHp).sort((a, b) => (Rules.unitStats(state, b).maxHp - b.hp) - (Rules.unitStats(state, a).maxHp - a.hp)).slice(0, fx.free_repairs); details.push(targets.length ? `免费修满：${targets.map(u => towers[u.type].name).join('、')}；已部署者回仓库` : '所有单位耐久已满，本项不会产生维修收益'); }
  if (fx.repair_discount) details.push(`永久维修折扣 +${fx.repair_discount * 100}%`);
  if (fx.tower_damage_bonus) details.push(`全部单位永久攻击 +${fx.tower_damage_bonus * 100}%`);
  if (fx.pressure_mult) details.push(`敌人死亡压力永久 +${fx.pressure_mult * 100}%`);
  if (fx.boss_reveal) details.push(`公开本幕首领：${enemies[state.maps[state.act].boss].name}`);
  return { ...choice, details, recycleUid:recycled?.uid,itemUid:consumed?.uid,canChoose: !data.outcome && (fx.focus || 0) + state.focus >= 0 && (fx.bandwidth || 0) + state.bandwidth >= 1&&(!fx.recycle||!!recycled)&&(!fx.consume_item||!!consumed)&&(!fx.capacity||bag.capacity<MAX_CAPACITY)&&(!fx.item_capacity||bag.itemCapacity<MAX_ITEM_CAPACITY) };
}

function queueFreeUpgrades(state, count, ids) {
  const eligible = ids.filter(id => upgradeRequirement(state,state.units.find(u=>u.uid===id)).ok).slice(0, count);
  state.focus += (count - eligible.length) * 40;
  for (const uid of eligible) {
    const u = state.units.find(u => u.uid === uid);
    state.rewardQueue.push({ kind: 'upgrade', title: `${towers[u.type].name}：免费升阶`, uid, options: (u.tier === 1 ? ['A', 'B'] : [u.branch]).map(branch => `${uid}:${branch}`) });
  }
}

export function nodeAction(state, action, payload = {}) {
  if (state.phase !== 'node') return fail('当前不在节点服务中。');
  const node = state.currentNode;
  if (action === 'cancel') return ok({ cancelled: true });
  if (action === 'leave') { if (!['workshop', 'shop'].includes(node.type)) return fail('请先选择一项服务。'); completeNode(state); return ok(); }
  if (node.type === 'camp') {
    if (action === 'heal') { const rate = difficultyProfile(state).campHeal; heal(state, state.maxSpirit * rate); record(state, `营地恢复${Math.round(rate * 100)}%最大精神`); }
    else if (action === 'repair') { const result = Rules.repair(state, payload.uid, {free:true}); if (!result.ok) return result; }
    else if (action === 'upgrade') { const result = Rules.upgrade(state, payload.uid, payload.branch, {free:true}); if (!result.ok) return result; }
    else return fail('营地只能选择恢复精神、维修或升阶中的一项。');
    completeNode(state); return ok();
  }
  if (node.type === 'workshop') {
    if (action === 'repair') return Rules.repair(state, payload.uid);
    if (action === 'upgrade') return Rules.upgrade(state, payload.uid, payload.branch);
    return fail('工坊提供维修和升阶，可随时离开。');
  }
  if (node.type === 'shop') {
    ensureShopStock(state);const bag=ensureInventory(state);
    if(action==='sell-unit'){
      const unit=inventoryStatus(state).stored.find(u=>u.uid===payload.uid);if(!unit)return fail('只能出售仓库构造。');
      const value=unit.tier*20,result=discardUnits(state,[unit.uid]);if(!result.ok)return result;state.focus+=value;record(state,`出售${towers[unit.type].name}，获得${value}专注`);return ok();
    }
    if(action==='shop-service'){
      const kind=payload.id,base={capacity:65,pouch:90,heal:40}[kind];if(!base||node.stock.services[kind])return fail('该项服务已使用。');
      if(kind==='capacity'&&bag.capacity>=MAX_CAPACITY||kind==='pouch'&&bag.itemCapacity>=MAX_ITEM_CAPACITY||kind==='heal'&&state.spirit>=state.maxSpirit)return fail('当前已达到该服务的上限。');
      const price=servicePrice(state,base);if(state.focus<price)return fail(`需要${price}专注。`);
      state.focus-=price;node.stock.services[kind]=true;
      if(kind==='capacity')bag.capacity=Math.min(MAX_CAPACITY,bag.capacity+2);else if(kind==='pouch')bag.itemCapacity++;else heal(state,20);
      record(state,`购买${{capacity:'背包扩容',pouch:'道具槽扩容',heal:'精神恢复'}[kind]}，花费${price}专注`);return ok();
    }
    const kind = action === 'buy-unit' ? 'units' : action === 'buy-relic' ? 'relics' : action==='buy-item'?'items':null;
    if (!kind) return fail('请选择货架上的物品。');
    const item = node.stock[kind].find(item => item.key === payload.id || item.id === payload.id);
    if (!item || item.sold) return fail('这件物品已售出或不在货架上。');
    if (kind === 'relics' && state.relics.includes(item.id)) return fail('已经拥有该收藏品。');
    const price = shopPrice(state,kind,item);
    if (state.focus < price) return fail(`专注不足，需要${price}。`);
    if(kind==='items'){const result=addItem(state,item.id,payload.replaceUid??null);if(!result.ok)return result;}
    state.focus -= price; item.sold = true;
    if (kind === 'units') addUnit(state, item.id,item.tier||1,item.branch||null); else if(kind==='relics'){ state.relics.push(item.id); discover(state, 'relics', item.id); }
    record(state, `购买${towers[item.id]?.name || relics[item.id]?.name || items[item.id]?.name}，花费${price}专注`); return ok();
  }
  if (node.type === 'treasure' && action === 'treasure') {
    if (!node.options.length) { state.focus += 120; completeNode(state); return ok(); }
    if (!node.options.includes(payload.id) || state.relics.includes(payload.id)) return fail('请选择宝库展示的一件未持有收藏品。');
    state.relics.push(payload.id); discover(state, 'relics', payload.id); record(state, `宝库选择${relics[payload.id].name}`); completeNode(state); return ok();
  }
  if (node.type === 'event' && action === 'event') {
    if (!Number.isInteger(payload.index)) return fail('请选择有效的事件行动。');
    if (node.eventData.outcome) return fail('这次事件已经作出选择，请阅读后续并继续。');
    const preview = eventPreview(state, payload.index,payload);
    if (!preview || !preview.canChoose) return fail('不能支付这项选择的费用。');
    const fx = preview.effects, data = node.eventData;
    const bag=ensureInventory(state);
    if(fx.recycle)discardUnits(state,[preview.recycleUid]);
    if(fx.consume_item)bag.items.splice(bag.items.findIndex(item=>item.uid===preview.itemUid),1);
    if(fx.capacity)bag.capacity=Math.min(MAX_CAPACITY,bag.capacity+fx.capacity);
    if(fx.item_capacity)bag.itemCapacity=Math.min(MAX_ITEM_CAPACITY,bag.itemCapacity+fx.item_capacity);
    if(fx.max_spirit){state.maxSpirit+=fx.max_spirit;heal(state,fx.max_spirit);}
    if(fx.item)queueItem(state,fx.item);
    for (const key of ['focus', 'bandwidth', 'resistance']) state[key] += fx[key] || 0;
    if (fx.spirit) { const previous = state.spirit; state.spirit = Math.max(0, Math.min(state.maxSpirit, state.spirit + fx.spirit)); state.stats.eventDamage = (state.stats.eventDamage || 0) + Math.max(0, previous - state.spirit); }
    if (fx.xp) addXP(state, fx.xp);
    for (const key of ['repair_discount', 'tower_damage_bonus', 'pressure_mult']) if (fx[key]) state.modifiers[key] = (state.modifiers[key] || 0) + fx[key];
    const target = state.units.find(u => u.uid === data.targets[0]);
    if (target && fx.tower_hp) { const old = Rules.unitStats(state, target).maxHp; target.hpBonus = (target.hpBonus || 0) + fx.tower_hp; target.hp += Rules.unitStats(state, target).maxHp - old; }
    if (target && fx.tower_damage) target.hp = Math.max(0, target.hp - Math.ceil(Rules.unitStats(state, target).maxHp * fx.tower_damage));
    if (fx.unit) addUnit(state, data.unit);
    if (fx.unit_t2) { const unit = addUnit(state, data.unit); queueFreeUpgrades(state, 1, [unit.uid]); }
    if (fx.duplicate_t1) { const u = state.units.find(u => u.tier === 1); if (u) addUnit(state, u.type); else state.focus += 40; }
    if (fx.relic) { if (data.relic && !state.relics.includes(data.relic)) { state.relics.push(data.relic); discover(state, 'relics', data.relic); } else state.focus += 120; }
    if (fx.repair_all) for (const u of state.units) { const max = Rules.unitStats(state, u).maxHp; if (u.hp < max) { u.hp = Math.min(max, u.hp + max * fx.repair_all); u.x = null; u.z = null; } }
    if (fx.free_repairs) { const targets = [...state.units].sort((a, b) => (Rules.unitStats(state, b).maxHp - b.hp) - (Rules.unitStats(state, a).maxHp - a.hp)).slice(0, fx.free_repairs); for (const u of targets) if (u.hp < Rules.unitStats(state, u).maxHp) Rules.repair(state, u.uid, {free:true}); }
    if (fx.free_upgrade || fx.free_upgrades) queueFreeUpgrades(state, fx.free_upgrades || 1, data.targets);
    if (fx.boss_reveal) state.bossReveal = 3;
    data.outcome = {index:payload.index,label:preview.label,details:[...preview.details]};
    // JSON snapshots duplicate currentNode; keep the map's copy authoritative too.
    const mapNode=state.maps[state.act].nodes.find(entry=>entry.id===node.id);if(mapNode)mapNode.eventData=data;
    record(state, `${events[data.id].title}：${preview.label}`); queueGrowth(state);
    // Keep the applied result on this node until the player reads the outcome.
    // Saving this phase prevents both rerolls and double collection on reload.
    if (state.spirit <= 0) { completeNode(state); state.phase = 'lost'; state.summary = getSummary(state); }
    return ok();
  }
  if (node.type === 'event' && action === 'event-continue') {
    if (!node.eventData.outcome) return fail('请先作出事件选择。');
    completeNode(state); return ok();
  }
  return fail('当前节点不提供这项操作。');
}

export function getSummary(state) {
  const stats = state.stats, won = state.phase === 'won', reasons = [];
  if (stats.breachDamage > stats.pressure) reasons.push('突破伤害是主要精神损失'); else if (stats.pressure > 0) reasons.push('死亡压力是主要精神损失');
  if (stats.destroyed > 0) reasons.push(`${stats.destroyed}次构造被摧毁`);
  if (stats.overloadSeconds > 5) reasons.push(`带宽过载累计${Math.round(stats.overloadSeconds)}秒`);
  if (!won && state.currentNode?.type === 'event' && state.spirit <= 0) reasons.unshift('事件交换耗尽精神稳定');
  if (!state.units.some(u => u.hp > 0 && u.x !== null && towers[u.type].targets === 'all')) reasons.push('防线缺少存活对空火力');
  const fragments = stats.completedNodes * 2 + stats.elites * 5 + (won ? 50 : 0) + stats.bosses.length * 10;
  return { won, act: state.act + 1, floor: state.floor + 1, completedNodes: stats.completedNodes, kills: stats.kills, breaches: stats.breaches, pressure: stats.pressure, breachDamage: stats.breachDamage, eventDamage:stats.eventDamage || 0, elites: stats.elites, bosses: [...stats.bosses], bossStatus:state.maps.map((map, index) => ({ act:index+1, id:map.boss, name:enemies[map.boss].name, defeated:stats.bosses.includes(map.boss) })), fragments, reasons,
    damageSources:Object.entries(stats.damageByUnit).map(([uid, damage]) => ({ uid, damage, name:state.unitOrigins?.[uid]?.name || towers[state.units.find(u => u.uid === uid)?.type]?.name || '已融合构造' })).sort((a, b) => b.damage - a.damage),
    survivors: state.units.filter(u => u.hp > 0).map(u => ({ uid: u.uid, name: towers[u.type].name, tier: u.tier, branch: u.branch, hp: u.hp })), build: { relics: [...state.relics], talents: [...state.talents], damage: { ...stats.damageByUnit } }, route: [...state.visited], history: cloneState(stats.history), pressureLog: cloneState(stats.pressureLog), pressureLevel: state.pressureLevel };
}
