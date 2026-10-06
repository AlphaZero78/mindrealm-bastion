import { acts, towers, enemies, relics, talents, events, eventFor, contentUnlocks, hashSeed, messengers } from './content.js';
import {eventClues} from './event-redesign.js';
import { normalizeResolution } from '../view/display-settings.js';
import { CURRENT_DIFFICULTY_REVISION } from './difficulty.js';
import {unitFootprint} from './rules.js';
import {items,ensureInventory,MAX_CAPACITY,MAX_ITEM_CAPACITY} from './inventory.js';
import {ensureShopStock,ensureNexus} from './state.js';

const clone = value => JSON.parse(JSON.stringify(value));
const defaults = () => ({ version: 2, fragments: 0, unlockedPressure: 0, runs: 0, wins: 0, settledRuns: [], discoveries: { towers: [], enemies: [], relics: [], talents: [], archives: [] }, unlockedArchives: [], unlockedContent: [] });
const defaultSettings = () => ({ master: .7, music: .35, effects: .65, ui: .55, uiScale: 1, tutorial: true, reducedMotion: false, quality: 'medium', resolution: 'auto' });
const completeSettings = settings => ({ ...defaultSettings(), ...settings, resolution: normalizeResolution(settings?.resolution) });
const finite = n => typeof n === 'number' && Number.isFinite(n);
const distinct = values => Array.isArray(values) && new Set(values).size === values.length;
const idsIn = (values, catalog) => distinct(values) && values.every(id => typeof id === 'string' && Object.hasOwn(catalog, id));
const nonnegative = n => finite(n) && n >= 0;
const numericTree = value => typeof value === 'number' ? finite(value) : value === null || typeof value !== 'object' ? true : Object.values(value).every(numericTree);
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const validCell = c => record(c) && Number.isInteger(c.h) && c.h >= 0 && c.h <= 4 && Number.isInteger(c.ramp) && c.ramp >= -1 && c.ramp <= 3 && typeof c.protected === 'boolean';
const validDiscoveries = d => d && idsIn(d.towers, towers) && idsIn(d.enemies, enemies) && idsIn(d.relics, relics) && idsIn(d.talents, talents) && idsIn(d.archives, Object.fromEntries(Object.values(enemies).filter(e => e.kind === 'boss').map(e => [e.id, e])));
function validRun(state) {
  if (!state || state.version !== 2 || !numericTree(state) || typeof state.seed !== 'string' || !['map', 'prep', 'reward', 'node', 'nexus', 'interlude', 'won', 'lost'].includes(state.phase)) return false;
  // Earlier v2 runs have no revision: keep their original balance and payload.
  // Unknown revisions cannot be interpreted safely by this build.
  if (state.difficultyRevision !== undefined && (!Number.isInteger(state.difficultyRevision)||state.difficultyRevision<1||state.difficultyRevision>CURRENT_DIFFICULTY_REVISION)) return false;
  if(state.inventory){const bag=state.inventory;if(!Number.isInteger(bag.capacity)||bag.capacity<12||bag.capacity>MAX_CAPACITY||!Number.isInteger(bag.itemCapacity)||bag.itemCapacity<3||bag.itemCapacity>MAX_ITEM_CAPACITY||!Number.isInteger(bag.nextId)||bag.nextId<0||!Number.isInteger(bag.pity)||bag.pity<0||!Array.isArray(bag.items)||bag.items.length>bag.itemCapacity||!distinct(bag.items.map(item=>item.uid))||!bag.items.every(item=>items[item.type]&&/^p[1-9]\d*$/.test(item.uid)&&Number(item.uid.slice(1))<=bag.nextId))return false;}
  if (!Number.isInteger(state.act) || state.act < 0 || state.act > 2 || !Array.isArray(state.maps) || state.maps.length !== 3 || !Array.isArray(state.units)) return false;
  if (!state.terrain || state.terrain.size !== 41 || state.terrain.cells?.length !== 1681 || !Number.isInteger(state.terrain.revision) || state.terrain.revision < 0) return false;
  const southern=state.terrain.generation===2,entryIds=southern?['north','west','east']:['north','west','east','south'];
  if(state.terrain.generation!==undefined&&![1,2].includes(state.terrain.generation))return false;
  if (!state.terrain.core || state.terrain.core.x !== 20 || state.terrain.core.z !== (southern?38:24) || state.terrain.core.size !== 5 || state.terrain.entries?.length !== entryIds.length) return false;
  if (!entryIds.every(id => state.terrain.entries.some(e => e.id === id && Number.isInteger(e.x) && Number.isInteger(e.z) && e.x >= 0 && e.z >= 0 && e.x < 41 && e.z < 41))) return false;
  if (!state.terrain.cells.every(validCell)) return false;
  if (state.modifiers != null && (!record(state.modifiers) || !Object.values(state.modifiers).every(finite))) return false;
  if (state.terrainUndo !== undefined && (!Array.isArray(state.terrainUndo) || !state.terrainUndo.every(item => record(item) && nonnegative(item.cost) && (item.editsBefore === undefined || Number.isSafeInteger(item.editsBefore) && item.editsBefore >= 0) && Array.isArray(item.cells) && item.cells.length > 0 && item.cells.every(c => record(c) && Number.isInteger(c.x) && Number.isInteger(c.z) && c.x >= 0 && c.z >= 0 && c.x < 41 && c.z < 41 && validCell(c.before) && validCell(c.after))))) return false;
  if (!['spirit', 'maxSpirit', 'focus', 'bandwidth', 'resistance', 'depth', 'xp'].every(key => finite(state[key]))) return false;
  if (state.spirit < 0 || state.maxSpirit <= 0 || state.spirit > state.maxSpirit || state.focus < 0 || state.bandwidth < 0 || state.depth < 1 || state.depth > 12 || !Number.isInteger(state.depth) || state.xp < 0) return false;
  if (!Number.isInteger(state.pressureLevel) || state.pressureLevel < 0 || state.pressureLevel > 10 || !Number.isInteger(state.floor) || state.floor < -1 || state.floor >= acts[state.act].floors) return false;
  if (!state.contentPool || !idsIn(state.contentPool.towers, towers) || state.contentPool.towers.length !== 12 || !idsIn(state.contentPool.relics, relics) || !idsIn(state.contentPool.talents, talents) || !idsIn(state.contentPool.events, events)) return false;
  if (![1, 2, 3].every(act => state.contentPool.events.some(id => events[id].act === act))) return false;
  if (!['unitCounter', 'rewardCounter', 'pendingUnitRewards', 'pendingTalents'].every(k => Number.isInteger(state[k]) && state[k] >= 0) || !validDiscoveries(state.discoveries)) return false;
  const uids = new Set();
  if (state.units.some(u => !record(u) || u.hpBonus !== undefined && !finite(u.hpBonus) || u.order !== undefined && (!Number.isSafeInteger(u.order) || u.order < 0) || u.everDeployed !== undefined && typeof u.everDeployed !== 'boolean')) return false;
  if(state.terrainEdits!==undefined&&(!Number.isSafeInteger(state.terrainEdits)||state.terrainEdits<0))return false;
  for (const u of state.units) { if (!towers[u.type] || typeof u.uid !== 'string' || !/^u[1-9]\d*$/.test(u.uid) || +u.uid.slice(1) > state.unitCounter || uids.has(u.uid) || !finite(u.hp) || u.hp < 0 || ![1, 2, 3].includes(u.tier) || !(u.tier === 1 ? u.branch === null : ['A', 'B'].includes(u.branch)) || !['near', 'far', 'hp'].includes(u.priority)) return false; uids.add(u.uid); if (![u.x, u.z].every(v => v === null || Number.isInteger(v) && v >= 0 && v < 41)) return false; if ((u.x === null) !== (u.z === null)) return false; if(u.rotation!==undefined&&(!Number.isInteger(u.rotation)||u.rotation<0||u.rotation>3))return false; if (u.x !== null && (u.x + unitFootprint(u)[0] > 41 || u.z + unitFootprint(u)[1] > 41)) return false; }
  for (let i = 0; i < 3; i++) {
    const map = state.maps[i]; if (!Array.isArray(map.nodes) || !acts[i].bosses.includes(map.boss) || map.floors !== acts[i].floors) return false;
    const ids = new Set(map.nodes.map(n => n.id));
    if (ids.size !== map.nodes.length || !map.nodes.every(n => typeof n.id === 'string' && Number.isInteger(n.floor) && n.floor >= 0 && n.floor < [17, 16, 15][i] && Number.isInteger(n.lane) && n.lane >= 0 && n.lane <= 4 && ['battle', 'elite', 'camp', 'workshop', 'shop', 'treasure', 'event', 'unknown', 'boss'].includes(n.type) && distinct(n.next) && n.next.every(id => ids.has(id) && map.nodes.find(next => next.id === id).floor === n.floor + 1))) return false;
  }
  if (!idsIn(state.relics, relics) || !idsIn(state.talents, talents) || !state.stats || !Array.isArray(state.rewardQueue) || !distinct(state.nextNodes)) return false;
  if(state.nexus!==undefined&&(!Array.isArray(state.nexus)||state.nexus.length!==3||!state.nexus.every((room,act)=>record(room)&&room.act===act&&messengers[room.messenger]?.act===act&&distinct(room.options)&&room.options.length===3&&room.options.every(id=>messengers[room.messenger].gifts.some(g=>g.id===id))&&typeof room.skipped==='boolean'&&(room.choice===null||room.options.includes(room.choice)&&state.relics.includes(room.choice)&&!room.skipped&&act<=state.act))))return false;
  if(state.phase==='nexus'&&(!state.nexus||state.nexus[state.act].choice||state.nexus[state.act].skipped||state.floor!==-1||state.currentNode||state.rewardQueue.length))return false;
  if(state.nextAct!==undefined&&(!Number.isInteger(state.nextAct)||state.nextAct!==state.act+1||state.nextAct>2))return false;
  if(state.phase==='interlude'&&(state.nextAct===undefined||state.currentNode?.type!=='boss'||!state.currentNode.completed||state.rewardQueue.length||state.nextNodes.length))return false;
  if (!state.nextNodes.every(id => state.maps[state.act].nodes.some(n => n.id === id)) || !distinct(state.visited) || !state.visited.every(id => state.maps.some(map => map.nodes.some(n => n.id === id)))) return false;
  if (!['kills', 'breaches', 'pressure', 'breachDamage', 'destroyed', 'elites', 'overloadSeconds', 'completedNodes'].every(k => nonnegative(state.stats[k])) || !idsIn(state.stats.bosses, enemies) || !Array.isArray(state.stats.history) || !Array.isArray(state.stats.pressureLog) || !state.stats.damageByUnit) return false;
  if (state.currentNode && (!state.maps[state.act].nodes.some(n => n.id === state.currentNode.id && n.floor === state.currentNode.floor && n.type === state.currentNode.type) || state.floor !== state.currentNode.floor)) return false;
  if (['prep', 'node', 'reward'].includes(state.phase) && !state.currentNode || state.phase === 'reward' && !state.rewardQueue.length) return false;
  const node = state.currentNode;
  if (node?.type === 'shop' && (!node.stock || !['units', 'relics'].every(kind => Array.isArray(node.stock[kind]) && node.stock[kind].length <= (kind==='units'&&(state.difficultyRevision||1)>=5?6:3) && distinct(node.stock[kind].map(item => item.key)) && node.stock[kind].every(item => (kind === 'units' ? towers[item.id] : relics[item.id]) && typeof item.key === 'string' && typeof item.sold === 'boolean')))) return false;
  if(node?.stock?.items&&(!Array.isArray(node.stock.items)||node.stock.items.length>3||!distinct(node.stock.items.map(item=>item.key))||!node.stock.items.every(item=>items[item.id]&&typeof item.key==='string'&&typeof item.sold==='boolean'&&nonnegative(item.price))))return false;
  if(node?.stock?.services&&(!record(node.stock.services)||!['capacity','pouch','heal'].every(key=>typeof node.stock.services[key]==='boolean')))return false;
  if(node?.stock&&['units','relics'].some(kind=>node.stock[kind].some(item=>item.price!==undefined&&!nonnegative(item.price)||item.tier!==undefined&&![1,2].includes(item.tier)||item.tier===2&&!['A','B'].includes(item.branch))))return false;
  if (node?.type === 'treasure' && !idsIn(node.options, relics)) return false;
  if(state.eventClues!==undefined&&!idsIn(state.eventClues,eventClues))return false;
  if ((node?.type === 'event'||node?.eventEncounter||node?.eventData!==undefined) && (!record(node.eventData) || !eventFor(state,node.eventData.id) || !towers[node.eventData.unit] || node.eventData.relic !== null && !relics[node.eventData.relic] || !distinct(node.eventData.targets))) return false;
  if(node?.eventData?.rolls!==undefined&&(!Array.isArray(node.eventData.rolls)||node.eventData.rolls.length!==eventFor(state,node.eventData.id).choices.length||!node.eventData.rolls.every(value=>finite(value)&&value>=0&&value<1)))return false;
  if(node?.eventData?.unitsByRole!==undefined&&(!record(node.eventData.unitsByRole)||!['melee','ranged','support'].every(role=>towers[node.eventData.unitsByRole[role]]?.role===role)))return false;
  if ((node?.type === 'event'||node?.eventEncounter) && node.eventData.outcome !== undefined) {
    const outcome=node.eventData.outcome;
    if(!record(outcome)||!Number.isInteger(outcome.index)||!eventFor(state,node.eventData.id).choices[outcome.index]||typeof outcome.label!=='string'||outcome.label.length>240||!Array.isArray(outcome.details)||outcome.details.length>30||!outcome.details.every(text=>typeof text==='string'&&text.length<800))return false;
    if(outcome.title!==undefined&&(typeof outcome.title!=='string'||outcome.title.length>100)||outcome.text!==undefined&&(typeof outcome.text!=='string'||outcome.text.length>2000)||outcome.followup!==undefined&&outcome.followup!=='elite')return false;
  }
  for (const reward of state.rewardQueue) {
    if (!['unit', 'relic', 'talent', 'upgrade','item'].includes(reward.kind) || !distinct(reward.options) || !reward.options.length || reward.options.length > 3) return false;
    const validOption = id => reward.kind === 'item'?items[id]:reward.kind === 'unit' ? towers[id] : reward.kind === 'relic' ? relics[id] : reward.kind === 'talent' ? talents[id] : typeof id === 'string' && /^[^:]+:[AB]$/.test(id) && uids.has(id.split(':')[0]);
    if (!reward.options.every(validOption) || reward.reserves && (!distinct(reward.reserves) || !reward.reserves.every(validOption))) return false;
  }
  return true;
}

function envelope(kind, value) { const payload = JSON.stringify(value); return JSON.stringify({ version: 2, kind, checksum: hashSeed(payload).toString(16), payload }); }
function unwrap(raw, kind, validator) {
  if (!raw) return null;
  try { const env = JSON.parse(raw); if (env.version !== 2 || env.kind !== kind || typeof env.payload !== 'string' || env.checksum !== hashSeed(env.payload).toString(16)) return null; const value = JSON.parse(env.payload); return validator(value) ? value : null; } catch { return null; }
}
function validProfile(p) { return !!p && p.version === 2 && ['fragments', 'runs', 'wins', 'unlockedPressure'].every(k => Number.isInteger(p[k]) && p[k] >= 0) && p.wins <= p.runs && p.unlockedPressure <= 10 && validDiscoveries(p.discoveries) && distinct(p.settledRuns) && p.settledRuns.every(id => typeof id === 'string') && idsIn(p.unlockedArchives, enemies) && distinct(p.unlockedContent) && p.unlockedContent.every(id => contentUnlocks.some(pack => pack.id === id)); }
function validSettings(s) { return !!s && ['master', 'music', 'effects', 'ui'].every(k => finite(s[k]) && s[k] >= 0 && s[k] <= 1) && finite(s.uiScale) && s.uiScale >= .75 && s.uiScale <= 2 && typeof s.tutorial === 'boolean' && typeof s.reducedMotion === 'boolean' && ['low', 'medium', 'high'].includes(s.quality); }
// Missing fields are defaults from earlier releases. An unknown resolution is
// repaired independently, so it cannot discard valid volume or UI preferences.
function validStoredSettings(s) { return !!s && typeof s === 'object' && !Array.isArray(s) && validSettings(completeSettings(s)); }

/** All I/O is confined to the injected storage and a new Web-only namespace. */
export function createSaveStore(storage = globalThis.localStorage, prefix = 'mindrealm.web.v2') {
  if (!storage || !['getItem', 'setItem', 'removeItem'].every(k => typeof storage[k] === 'function')) throw new Error('需要可用的浏览器本地存储。');
  const key = kind => `${prefix}.${kind}`, backup = kind => `${prefix}.${kind}.backup`, pending = kind => `${prefix}.${kind}.pending`;
  // Version 2 starts separately. Older save data is left intact because
  // a previous namespace may also contain a real player's progress.
  if (prefix === 'mindrealm.web.v2') try {
    const oldKeys = ['run', 'profile', 'settings'].flatMap(kind => ['', '.backup', '.pending'].map(suffix => `mindrealm.web.v1.${kind}${suffix}`));
    if (oldKeys.some(k => storage.getItem(k) !== null)) {
      if (!storage.getItem(key('migration-notice'))) storage.setItem(key('migration-notice'), 'pending');
    }
  } catch { /* A blocked storage is reported by normal load/save operations. */ }
  function read(kind, validator) {
    try { const primary = unwrap(storage.getItem(key(kind)), kind, validator); if (primary) return { ok: true, value: primary, recovered: false }; const fallback = unwrap(storage.getItem(backup(kind)), kind, validator); if (fallback) return { ok: true, value: fallback, recovered: true, reason: '主存档损坏，已恢复上一个安全备份。' }; const interrupted = unwrap(storage.getItem(pending(kind)), kind, validator); if (interrupted) return { ok: true, value: interrupted, recovered: true, reason: '上次写入中断，已恢复完整临时存档。' }; return { ok: false, value: null, reason: storage.getItem(key(kind)) ? '存档版本或完整性校验失败。已保留原始数据。' : '没有可继续的单局。' }; }
    catch (error) { return { ok: false, value: null, reason: `无法读取本地存档：${error.message}` }; }
  }
  function write(kind, value, validator) {
    if (!validator(value)) return { ok: false, reason: '数据结构无效，未覆盖现有存档。' };
    try {
      const raw = envelope(kind, value), previous = storage.getItem(key(kind));
      storage.setItem(pending(kind), raw);
      if (unwrap(previous, kind, validator)) storage.setItem(backup(kind), previous);
      storage.setItem(key(kind), raw); storage.removeItem(pending(kind)); return { ok: true };
    } catch (error) { return { ok: false, reason: `保存失败，已保留安全备份：${error.message}` }; }
  }
  return {
    save(state) {
      if (!state || typeof state !== 'object') return { ok: false, reason: '没有可保存的单局。' };
      if (state.phase === 'battle' && !state.preBattle) return { ok: false, reason: '缺少战前快照，拒绝保存半场战斗。' };
      const source = state.phase === 'battle' ? state.preBattle : state;
      if (!validRun(source)) return { ok: false, reason: '数据结构无效，未覆盖现有存档。' };
      const safe = clone(source), runId = state.runId || `${state.seed}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
      safe.runId = runId; safe.battle = null; safe.preBattle = null;
      if (state.phase === 'battle') safe.phase = 'prep';
      const result = write('run', safe, validRun);
      if (result.ok) state.runId = runId;
      return result;
    },
    load() { const result = read('run', validRun);if(result.value){ensureInventory(result.value);ensureShopStock(result.value);ensureNexus(result.value,{legacy:true});} return { ...result, state: result.value }; },
    has() { return read('run', validRun).ok; },
    migrationNotice() { try { if (storage.getItem(key('migration-notice')) !== 'pending') return null; storage.setItem(key('migration-notice'), 'shown'); return '存档格式已更新。原有进度已保留，新远征将使用独立存档。'; } catch { return null; } },
    clear() { try { for (const k of [key('run'), backup('run'), pending('run')]) storage.removeItem(k); return { ok: true }; } catch (error) { return { ok: false, reason: error.message }; } },
    loadProfile() { return read('profile', validProfile).value || defaults(); },
    saveProfile(profile) { return write('profile', profile, validProfile); },
    loadSettings() { return completeSettings(read('settings', validStoredSettings).value); },
    saveSettings(settings) {
      if (!validStoredSettings(settings)) return { ok: false, reason: '设置数据结构无效，未覆盖现有设置。' };
      const previous = read('settings', validStoredSettings).value;
      return write('settings', completeSettings({ ...previous, ...settings }), validStoredSettings);
    }
  };
}

export function settleProfile(profile, state) {
  const result = clone(profile || defaults());
  if (!['won', 'lost'].includes(state.phase)) return result;
  const id = state.runId || `${state.seed}:${state.stats.completedNodes}:${state.stats.kills}`;
  if (result.settledRuns.includes(id)) return result;
  result.settledRuns.push(id); result.runs++;
  result.fragments += state.stats.completedNodes * 2 + state.stats.elites * 5 + (state.phase === 'won' ? 50 : 0) + state.stats.bosses.length * 10;
  if (state.phase === 'won') { result.wins++; result.unlockedPressure = Math.max(result.unlockedPressure, Math.min(10, (state.pressureLevel || 0) + 1)); }
  for (const kind of Object.keys(result.discoveries)) result.discoveries[kind] = [...new Set([...result.discoveries[kind], ...(state.discoveries?.[kind] || [])])];
  result.unlockedArchives = [...new Set([...result.unlockedArchives, ...(state.stats.bosses || [])])];
  return result;
}

export function unlockArchive(profile, id) {
  if (!enemies[id] || enemies[id].kind !== 'boss') return { ok: false, reason: '未知档案。' };
  if (profile.unlockedArchives.includes(id)) return { ok: false, reason: '已经解锁。' };
  if (profile.fragments < 30) return { ok: false, reason: '需要30记忆碎片。' };
  profile.fragments -= 30; profile.unlockedArchives.push(id); return { ok: true };
}

export function unlockContent(profile, id) {
  const pack = contentUnlocks.find(pack => pack.id === id);
  if (!validProfile(profile) || !pack) return { ok: false, reason: '未知构筑档案。' };
  if (profile.unlockedContent.includes(id)) return { ok: false, reason: '该内容已经加入后续单局。' };
  if (profile.fragments < pack.cost) return { ok: false, reason: `需要${pack.cost}记忆碎片。` };
  profile.fragments -= pack.cost; profile.unlockedContent.push(id);
  return { ok: true, reason: `${pack.name}已解锁，从下一局开始进入内容池。` };
}
