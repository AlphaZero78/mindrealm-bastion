import test from 'node:test';
import assert from 'node:assert/strict';
import { newRun, generateMap, generateTerrain, availableNodes, enterNode, nodeAction, finishBattle, chooseReward, addXP, cloneState, eventPreview, getSummary, servicePrice } from '../../web/core/state.js';
import { towers, enemies, relics, talents, events, effects, contentUnlocks, contentPool, hashSeed, pressureLevels } from '../../web/core/content.js';
import { unitStats, repairCost, upgradeCost } from '../../web/core/rules.js';
import { createSaveStore, settleProfile, unlockArchive, unlockContent } from '../../web/core/save.js';
import { CURRENT_DIFFICULTY_REVISION, difficultyProfile } from '../../web/core/difficulty.js';
import { makeEncounter, startBattle } from '../../web/core/battle.js';

class MemoryStorage { data = new Map(); getItem(k) { return this.data.get(k) ?? null; } setItem(k, v) { this.data.set(k, String(v)); } removeItem(k) { this.data.delete(k); } }

test('malformed stat modifiers, unit metadata and terrain refunds cannot overwrite a valid save',()=>{
 const storage=new MemoryStorage(),store=createSaveStore(storage,'audit-save'),valid=newRun('save-boundary');assert.equal(store.save(valid).ok,true);
 const original=[...storage.data];
 const corruptions=[s=>{s.modifiers.range='invalid';},s=>{s.modifiers=[];},s=>{s.units[0].hpBonus='invalid';},s=>{s.units[0].everDeployed='false';},s=>{s.units[0].order=-1;},s=>{s.terrainUndo=[{cost:'100',cells:[]}];},s=>{s.terrainUndo=[{cost:2,cells:[{x:42,z:0,before:{h:0,ramp:-1,protected:false},after:{h:1,ramp:-1,protected:false}}]}];}];
 for(const corrupt of corruptions){const invalid=cloneState(valid);corrupt(invalid);assert.equal(store.save(invalid).ok,false);assert.deepEqual([...storage.data],original);assert.equal(store.load().ok,true);}
 const old=cloneState(valid);delete old.modifiers;for(const u of old.units){delete u.order;delete u.everDeployed;}assert.equal(store.save(old).ok,true,'legacy optional metadata stays readable');assert.equal(store.load().ok,true);
});
const service = (type, seed = 'service', act = 0) => { const s = newRun(seed); s.act = act; const node = s.maps[act].nodes.find(n => n.type === type) || s.maps[act].nodes.find(n => n.floor === 1); node.type = type; s.nextNodes = [node.id]; assert.equal(enterNode(s, node.id).ok, true); return s; };
const drain = s => { let count = 0; while (s.phase === 'reward') { assert.ok(count++ < 60, '奖励队列必须有限'); assert.equal(chooseReward(s, s.rewardQueue[0].options[0]).ok, true); } };

test('complete catalog has stable IDs and finite effect values', () => {
  assert.deepEqual([Object.keys(towers).length, Object.keys(enemies).length, Object.keys(relics).length, Object.keys(talents).length, Object.keys(events).length], [12, 28, 30, 24, 24]);
  for (const t of Object.values(towers)) { assert.ok(t.footprint[0] >= 2 && t.footprint[1] >= 2); assert.deepEqual(Object.keys(t.branches), ['A', 'B']); assert.ok(t.range > 0); assert.equal(t.sprite_id, t.id); assert.ok(t.description.length > 20); for (const b of Object.values(t.branches)) assert.ok(b.description.length>8); }
  for (const enemy of Object.values(enemies)) { assert.ok(enemy.description.length > 20); if (enemy.kind === 'boss') { assert.ok(enemy.archive.length > 50); assert.match(enemy.mechanics, /70%\/35%/); } }
  const s = newRun('effects'); s.relics = Object.keys(relics); s.talents = Object.keys(talents); assert.ok(Object.values(effects(s)).every(Number.isFinite));
  for (const e of Object.values(events)) assert.equal(e.choices.length, 2);
});

test('1000 seeds: all three act maps are connected, varied, deterministic and obey fixed floors', () => {
  for (let seed = 0; seed < 1000; seed++) for (let act = 0; act < 3; act++) {
    const map = generateMap(String(seed), act), again = generateMap(String(seed), act);
    assert.deepEqual(map, again);
    const lookup = new Map(map.nodes.map(n => [n.id, n]));
    const seen = new Set(map.nodes.filter(n => n.floor === 0).map(n => n.id));
    const finish = map.nodes.find(n => n.type === 'boss');
    assert.equal(map.floors, [17, 16, 15][act]);
    for (let floor = 0; floor < map.floors; floor++) {
      const layer = map.nodes.filter(n => n.floor === floor);
      if (floor === 0) { assert.equal(layer.length, 4); assert.ok(layer.every(n => n.type === 'battle')); }
      else if (floor >= map.floors - 2) { assert.equal(layer.length, 1); assert.equal(layer[0].type, floor === map.floors - 1 ? 'boss' : 'camp'); }
      else { assert.ok(layer.length >= 2 && layer.length <= 4); assert.ok(new Set(layer.map(n => n.type)).size >= 2); }
      for (const n of layer) {
        assert.ok(seen.has(n.id), `unreachable ${seed}/${n.id}`);
        if (floor < 4) assert.notEqual(n.type, 'elite');
        if (n !== finish) assert.ok(n.next.length > 0);
        for (const id of n.next) { const next = lookup.get(id); assert.equal(next.floor, n.floor + 1); const actual = n.type === 'unknown' ? n.revealType : n.type, nextActual = next.type === 'unknown' ? next.revealType : next.type; if (['camp', 'shop', 'workshop'].includes(actual)) assert.notEqual(nextActual, actual); seen.add(id); }
      }
    }
    assert.equal(seen.size, map.nodes.length);
    assert.ok(map.nodes.some(n => n.type === 'treasure' && n.floor === Math.floor(map.floors / 2)));
  }
});

test('new run uses exact resources, deterministic 41x41 persistent terrain and all units start in storage', () => {
  const a = newRun('opening'), b = newRun('opening');
  assert.deepEqual(a, b); assert.deepEqual([a.spirit, a.maxSpirit, a.focus, a.bandwidth, a.depth], [100, 100, 99, 20, 1]);
  assert.deepEqual(['melee', 'ranged', 'support'].map(role => a.units.filter(u => towers[u.type].role === role).length), [3, 3, 1]);
  assert.ok(a.units.every(u => u.x === null && u.z === null));
  assert.equal(a.terrain.cells.length, 1681); assert.ok(a.terrain.cells.every(c => c.h >= 0 && c.h <= 4));
  assert.ok(a.terrain.entries.every(entry=>a.terrain.cells[entry.z*41+entry.x].h===0));
  assert.equal(a.terrain.cells[a.terrain.core.z*41+a.terrain.core.x].h,0);
  // The seeded curved approaches are exhaustively checked in terrain.test.mjs;
  // a full fixed cross is no longer part of the terrain contract.
  const first = availableNodes(a)[0]; assert.equal(enterNode(a, 'bad-id').ok, false); assert.equal(enterNode(a, first.id).ok, true); assert.equal(a.phase, 'prep'); assert.equal(enterNode(a, first.id).ok, false);
});

test('camp permits exactly one action; failures and cancel do not consume node or resources', () => {
  for (const action of ['heal', 'repair', 'upgrade']) {
    const s = service('camp'); s.spirit = 30; s.units[0].hp = 1; const before = cloneState(s);
    assert.equal(nodeAction(s, 'cancel').ok, true); assert.deepEqual(s, before);
    assert.equal(nodeAction(s, 'repair', { uid: 'missing' }).ok, false); assert.equal(s.phase, 'node');
    const payload = { uid: s.units[0].uid, branch: 'A' }; assert.equal(nodeAction(s, action, payload).ok, true); assert.equal(s.focus, before.focus); assert.equal(s.phase, 'map'); assert.equal(nodeAction(s, 'heal').ok, false);
    if (action === 'heal') assert.equal(s.spirit, 60); if (action === 'repair') assert.equal(s.units[0].hp, unitStats(s, s.units[0]).maxHp); if (action === 'upgrade') assert.equal(s.units[0].tier, 2);
  }
});

test('workshop supports repeated paid services, shortage and branch validation', () => {
  const s = service('workshop'), u = s.units[0]; u.hp = 10; s.focus = 0; const hp = u.hp;
  assert.equal(nodeAction(s, 'repair', { uid: u.uid }).ok, false); assert.equal(u.hp, hp); s.focus = 500;
  const cost = repairCost(s, u); assert.equal(nodeAction(s, 'repair', { uid: u.uid }).ok, true); assert.equal(s.focus, 500 - cost); assert.equal(s.phase, 'node');
  assert.equal(nodeAction(s, 'upgrade', { uid: u.uid, branch: 'C' }).ok, false);
  const upgrade = upgradeCost(s, u); assert.equal(nodeAction(s, 'upgrade', { uid: u.uid, branch: 'B' }).ok, true); assert.equal(s.focus, 500 - cost - upgrade); assert.equal(u.branch, 'B');
  assert.equal(nodeAction(s, 'upgrade', { uid: u.uid, branch: 'A' }).ok, false); assert.equal(nodeAction(s, 'upgrade', { uid: u.uid, branch: 'B' }).ok, true); assert.equal(u.tier, 3);
  assert.equal(nodeAction(s, 'leave').ok, true); assert.equal(s.phase, 'map');
});

test('shops have fixed three plus three shelves and permit multiple purchases without refreshing', () => {
  const s = service('shop'), store = createSaveStore(new MemoryStorage());
  assert.deepEqual([s.currentNode.stock.units.length, s.currentNode.stock.relics.length], [3, 3]);
  s.focus = 0; const item = s.currentNode.stock.units[0]; assert.equal(nodeAction(s, 'buy-unit', { id: item.key }).ok, false); assert.equal(item.sold, false);
  s.focus = 1000; assert.equal(nodeAction(s, 'buy-unit', { id: item.key }).ok, true); assert.equal(nodeAction(s, 'buy-unit', { id: item.key }).ok, false); assert.equal(s.units.length, 8);
  const relic = s.currentNode.stock.relics[0]; assert.equal(nodeAction(s, 'buy-relic', { id: relic.key }).ok, true); assert.equal(s.focus, 800); assert.equal(s.phase, 'node');
  assert.equal(store.save(s).ok, true); const restored = store.load().state; assert.deepEqual(restored.currentNode.stock, s.currentNode.stock); assert.equal(nodeAction(restored, 'buy-unit', { id: item.key }).ok, false);
  assert.equal(nodeAction(restored, 'leave').ok, true);
});

test('all 24 events and both choices produce their advertised effects and deterministic targets', () => {
  for (const event of Object.values(events)) for (let index = 0; index < 2; index++) {
    const s = newRun(`event-${event.id}`); s.act = event.act - 1;
    const n = s.maps[s.act].nodes.find(n => n.floor === 1); n.type = 'event'; n.event = event.id; s.nextNodes = [n.id]; enterNode(s, n.id);
    s.focus = 500; s.spirit = 80; for (const u of s.units) u.hp *= .5;
    const before = cloneState(s), preview = eventPreview(s, index); assert.equal(preview.canChoose, true); assert.ok(preview.details.length);
    assert.equal(nodeAction(s, 'event', { index: 9 }).ok, false); assert.deepEqual(s, before);
    const twin = cloneState(s); assert.equal(nodeAction(s, 'event', { index }).ok, true); assert.equal(nodeAction(twin, 'event', { index }).ok, true); assert.deepEqual(s, twin);
    assert.equal(s.focus, before.focus + (preview.effects.focus || 0));
    if (preview.effects.tower_hp) assert.ok(s.units.some((u, i) => unitStats(s, u).maxHp > unitStats(before, before.units[i]).maxHp));
    drain(s); assert.ok(['map', 'lost'].includes(s.phase));
  }
});

test('treasure grants one unowned relic; unknown reveal persists through save', () => {
  const s = service('treasure'); assert.equal(nodeAction(s, 'treasure', { id: 'invalid' }).ok, false); const chosen = s.currentNode.options[0]; assert.equal(nodeAction(s, 'treasure', { id: chosen }).ok, true); assert.ok(s.relics.includes(chosen)); assert.equal(nodeAction(s, 'treasure', { id: chosen }).ok, false);
  const unknown = service('unknown'), storage = createSaveStore(new MemoryStorage()); assert.equal(storage.save(unknown).ok, true); assert.deepEqual(storage.load().state.currentNode, unknown.currentNode);
});

test('depth milestones, ordered rewards, safe resume and all three act bosses', () => {
  const s = service('elite'); s.xp = 200 + 325; finishBattle(s, { won: true }); assert.equal(s.depth, 3); assert.equal(s.maxSpirit, 110); assert.equal(s.bandwidth, 22); assert.equal(s.resistance, 2);
  assert.deepEqual(s.rewardQueue.map(r => r.kind), ['unit', 'unit', 'unit', 'relic', 'talent']);
  const storage = createSaveStore(new MemoryStorage()); storage.save(s); const copy = storage.load().state; assert.deepEqual(copy.rewardQueue, s.rewardQueue); assert.equal(chooseReward(copy, 'wrong').ok, false); drain(s); drain(copy); assert.deepEqual(s.talents, copy.talents);
  for (let act = 0; act < 3; act++) { const b = service('boss', `boss${act}`, act); b.spirit = 10; finishBattle(b, { won: true }); assert.equal(b.spirit, act === 2 ? 45 : 30); if (act === 2) { assert.equal(b.phase, 'won'); assert.equal(b.rewardQueue.length, 0); } else { assert.equal(b.phase, 'reward'); drain(b); assert.equal(b.act, act + 1); assert.equal(b.phase, 'map'); assert.equal(availableNodes(b).length, 4); } }
  const lost = service('battle'); lost.spirit = 0; finishBattle(lost, { won: false }); assert.equal(lost.phase, 'lost'); assert.equal(getSummary(lost).won, false);
});

test('save restores the entire pre-battle snapshot and verifies envelope, schema and backup', () => {
  const memory = new MemoryStorage(), store = createSaveStore(memory, 'test.only'), s = service('battle');
  assert.equal(store.save(s).ok, true); const before = cloneState(s); s.preBattle = cloneState(s); s.phase = 'battle'; s.spirit = 1; s.focus += 99; s.terrain.cells[0].h = 4; s.units[0].hp = 1;
  assert.equal(store.save(s).ok, true); const restored = store.load().state; assert.equal(restored.phase, 'prep'); assert.deepEqual(restored.terrain, before.terrain); assert.deepEqual(restored.units, before.units); assert.equal(restored.spirit, before.spirit); assert.equal(restored.focus, before.focus);
  memory.setItem('test.only.run', '{bad'); assert.equal(store.load().recovered, true); assert.equal(store.load().state.seed, before.seed);
  const invalid = cloneState(before); invalid.terrain.cells[0].h = 99; assert.equal(store.save(invalid).ok, false); assert.equal(store.load().ok, true);
  memory.setItem('unrelated-player-save', 'preserved'); assert.equal(store.clear().ok, true); assert.equal(store.has(), false); assert.equal(memory.getItem('unrelated-player-save'), 'preserved');
});

test('meta progression settles once and unlocks pressure and archives without modifying opening stats', () => {
  const store = createSaveStore(new MemoryStorage()), s = service('boss', 'meta', 2); store.save(s); finishBattle(s, { won: true }); let p = settleProfile(store.loadProfile(), s);
  assert.equal(p.wins, 1); assert.equal(p.unlockedPressure, 1); assert.ok(p.fragments > 0); assert.deepEqual(settleProfile(p, s), p); assert.equal(store.saveProfile(p).ok, true); assert.deepEqual(store.loadProfile(), p);
  const locked = Object.values(enemies).find(e => e.kind === 'boss' && !p.unlockedArchives.includes(e.id)); assert.equal(unlockArchive(p, locked.id).ok, true); assert.equal(unlockArchive(p, locked.id).ok, false);
  const next = newRun('fresh', p.unlockedPressure); assert.deepEqual([next.spirit, next.focus, next.bandwidth], [100, 99, 20]);
  assert.equal(store.saveSettings({ music: .1, uiScale: 1.5 }).ok, true); assert.equal(store.loadSettings().music, .1); assert.equal(store.saveSettings({ music: 2 }).ok, false);
});

test('route choice cannot jump, return, double claim or alter any independent seed stream', () => {
  const a = newRun('seed-stream'), b = newRun('seed-stream'), before = cloneState(a);
  for (let i = 0; i < 20; i++) { availableNodes(a); generateMap('unrelated', 2); generateTerrain(i); effects(a); }
  assert.deepEqual(a, before);
  const unreachable = a.maps[0].nodes.find(n => n.floor === 4);
  assert.equal(enterNode(a, unreachable.id).ok, false); assert.deepEqual(a, before);
  const first = availableNodes(a)[0]; enterNode(a, first.id); enterNode(b, first.id);
  finishBattle(a, { won:true }); finishBattle(b, { won:true }); assert.deepEqual(a.rewardQueue, b.rewardQueue);
  const queue = cloneState(a); assert.equal(chooseReward(a, 'missing').ok, false); assert.deepEqual(a, queue);
  drain(a); assert.equal(enterNode(a, first.id).ok, false); assert.equal(a.stats.completedNodes, 1);
  assert.deepEqual(availableNodes(a).map(n => n.id), first.next);
});

test('deferred depth rewards always retain three unowned alternatives when the pool allows it', () => {
  for (let seed = 0; seed < 30; seed++) {
    const s = service('elite', `many-rewards-${seed}`); addXP(s, 100000); assert.equal(s.depth, 12); finishBattle(s, { won:true });
    assert.equal(s.rewardQueue.filter(r => r.kind === 'unit').length, 12);
    assert.equal(s.rewardQueue.filter(r => r.kind === 'talent').length, 6);
    const store = createSaveStore(new MemoryStorage(), `isolated.${seed}`);
    while (s.rewardQueue.length) {
      const reward = s.rewardQueue[0]; assert.equal(reward.options.length, 3); assert.equal(new Set(reward.options).size, 3);
      if (reward.kind === 'talent') assert.ok(reward.options.every(id => !s.talents.includes(id)));
      assert.equal(store.save(s).ok, true); const copy = store.load().state; assert.deepEqual(copy.rewardQueue, s.rewardQueue);
      const choice = reward.options[0]; assert.equal(chooseReward(s, choice).ok, true); assert.equal(chooseReward(copy, choice).ok, true); assert.deepEqual(copy.rewardQueue, s.rewardQueue);
    }
    assert.equal(s.talents.length, 6); const stats = [s.depth, s.maxSpirit, s.bandwidth, s.resistance]; addXP(s, 10000); assert.deepEqual([s.depth, s.maxSpirit, s.bandwidth, s.resistance], stats);
  }
});

test('all node cancellations and unavailable operations leave complete state unchanged', () => {
  for (const type of ['camp', 'workshop', 'shop', 'treasure', 'event']) {
    const s = service(type, `cancel-${type}`), before = cloneState(s);
    assert.equal(nodeAction(s, 'cancel').ok, true); assert.deepEqual(s, before);
    assert.equal(nodeAction(s, 'unknown-operation').ok, false); assert.deepEqual(s, before);
    if (!['workshop', 'shop'].includes(type)) { assert.equal(nodeAction(s, 'leave').ok, false); assert.deepEqual(s, before); }
  }
  for (const phase of ['map', 'prep', 'battle', 'reward', 'won', 'lost']) {
    const s = newRun(`phase-${phase}`); s.phase = phase; const before = cloneState(s);
    assert.equal(nodeAction(s, 'heal').ok, false); assert.deepEqual(s, before);
  }
});

test('event affordability, lethal cost, no upgrade target and repair routing match the preview', () => {
  const make = id => { const e = events[id], s = service('event', id, e.act - 1); s.currentNode.event = id; s.currentNode.eventData.id = id; return s; };
  for (const event of Object.values(events)) for (let index = 0; index < 2; index++) {
    const s = make(event.id), fx = event.choices[index].effects;
    if (fx.focus < 0 || fx.bandwidth < 0) {
      s.focus = 0; s.bandwidth = 1; const before = cloneState(s); assert.equal(eventPreview(s, index).canChoose, false);
      assert.equal(nodeAction(s, 'event', { index }).ok, false); assert.deepEqual(s, before);
    }
  }
  const lethal = make('noise_market'); lethal.spirit = 1;
  const lethalChoice = events.noise_market.choices.findIndex(c => c.effects.spirit < 0);
  assert.ok(eventPreview(lethal, lethalChoice).details.some(t => t.includes('将导致本局失败'))); nodeAction(lethal, 'event', { index:lethalChoice }); assert.equal(lethal.phase, 'lost'); assert.equal(lethal.spirit, 0);
  assert.equal(lethal.summary.eventDamage, 1); assert.equal(lethal.summary.reasons[0], '事件交换耗尽精神稳定');
  const maxed = make('last_workshop'); for (const unit of maxed.units) { unit.tier = 3; unit.branch = 'A'; unit.hp = unitStats(maxed, unit).maxHp; }
  const beforeFocus = maxed.focus; assert.ok(eventPreview(maxed, 1).details.some(t => t.includes('兑换80专注')));
  nodeAction(maxed, 'event', { index:1 }); assert.equal(maxed.focus, beforeFocus + 80); assert.equal(maxed.phase, 'map');
  const repair = make('resonance_storm'); repair.units[0].x = 20; repair.units[0].z = 8; repair.units[0].hp = 0;
  nodeAction(repair, 'event', { index:0 }); assert.equal(repair.units[0].x, null); assert.equal(repair.units[0].hp, unitStats(repair, repair.units[0]).maxHp);
});

test('camp full health/maximum tier and fully collected treasure have defined outcomes', () => {
  const camp = service('camp'), before = cloneState(camp);
  assert.equal(nodeAction(camp, 'repair', { uid:camp.units[0].uid }).ok, false); assert.deepEqual(camp, before);
  camp.units[0].tier = 3; camp.units[0].branch = 'A'; camp.units[0].hp = unitStats(camp, camp.units[0]).maxHp;
  assert.equal(nodeAction(camp, 'upgrade', { uid:camp.units[0].uid, branch:'A' }).ok, false); assert.equal(camp.phase, 'node');
  assert.equal(nodeAction(camp, 'heal').ok, true); assert.equal(camp.spirit, camp.maxSpirit);
  const treasure = newRun('full-collection'); treasure.relics = [...treasure.contentPool.relics]; const n = treasure.maps[0].nodes.find(n => n.type === 'treasure'); treasure.nextNodes = [n.id]; enterNode(treasure, n.id);
  assert.deepEqual(treasure.currentNode.options, []); const focus = treasure.focus;
  assert.equal(nodeAction(treasure, 'treasure').ok, true); assert.equal(treasure.focus, focus + 120); assert.equal(treasure.phase, 'map');
});

test('shops retain sold shelves at exhaustion and unknown nodes keep their revealed icon and data', () => {
  const s = service('shop', 'all-stock'); s.focus = 1000; const shelves = cloneState(s.currentNode.stock);
  for (const item of shelves.units) assert.equal(nodeAction(s, 'buy-unit', { id:item.key }).ok, true);
  for (const item of shelves.relics) assert.equal(nodeAction(s, 'buy-relic', { id:item.key }).ok, true);
  assert.equal(s.focus, 400); assert.ok([...s.currentNode.stock.units, ...s.currentNode.stock.relics].every(item => item.sold));
  const before = cloneState(s); assert.equal(nodeAction(s, 'buy-unit', { id:shelves.units[0].key }).ok, false); assert.deepEqual(s, before);
  for (const type of ['event', 'battle', 'shop', 'treasure']) {
    const u = newRun(`unknown-${type}`), n = u.maps[0].nodes.find(n => n.floor === 1); n.type = 'unknown'; n.revealType = type; u.nextNodes = [n.id]; enterNode(u, n.id);
    assert.equal(u.currentNode.originalType, 'unknown'); assert.equal(u.currentNode.type, type); assert.equal(u.currentNode.map_icon_id, type);
    const store = createSaveStore(new MemoryStorage()); assert.equal(store.save(u).ok, true); assert.deepEqual(store.load().state.currentNode, u.currentNode);
  }
});

test('new pressure tiers leave opening resources, camp recovery and all service prices unchanged', () => {
  assert.equal(pressureLevels.length, 11);
  const baseline=service('workshop');baseline.units[0].hp=unitStats(baseline,baseline.units[0]).maxHp/2;
  const repair=repairCost(baseline,baseline.units[0]),upgrade=upgradeCost(baseline,baseline.units[0]);
  for (let level = 0; level <= 10; level++) {
    const s = service('camp'); s.pressureLevel = level; s.spirit = 1;
    assert.equal(nodeAction(s, 'heal').ok, true); assert.equal(s.spirit, 31);
    assert.equal(servicePrice(s, 80), 80); assert.equal(servicePrice(s, 120), 120);
    baseline.pressureLevel=level;assert.equal(repairCost(baseline,baseline.units[0]),repair);assert.equal(upgradeCost(baseline,baseline.units[0]),upgrade);
    const fresh = newRun('pressure-open', level); assert.deepEqual([fresh.spirit, fresh.focus, fresh.bandwidth, fresh.depth], [100, 99, 20, 1]);
    assert.equal(fresh.difficultyRevision,CURRENT_DIFFICULTY_REVISION);
  }
  assert.equal(newRun('nan', NaN).pressureLevel, 0); assert.equal(newRun('infinite', Infinity).pressureLevel, 0);
});

test('legacy runs retain their original economy for both missing and explicit revision one',()=>{
  for(const revision of [undefined,1])for(let level=0;level<=10;level++){
    const s=service('camp');if(revision===undefined)delete s.difficultyRevision;else s.difficultyRevision=revision;s.pressureLevel=level;s.spirit=1;
    assert.equal(difficultyProfile(s).legacy,true);assert.equal(nodeAction(s,'heal').ok,true);assert.equal(s.spirit,level>=5?21:31);
    assert.equal(servicePrice(s,80),level>=7?92:80);assert.equal(servicePrice(s,120),level>=7?138:120);
    s.units[0].hp=unitStats(s,s.units[0]).maxHp/2;const ordinary={...s,pressureLevel:0};
    if(level<7){assert.equal(repairCost(s,s.units[0]),repairCost(ordinary,s.units[0]));assert.equal(upgradeCost(s,s.units[0]),upgradeCost(ordinary,s.units[0]));}
    else{assert.ok(repairCost(s,s.units[0])>repairCost(ordinary,s.units[0]));assert.ok(upgradeCost(s,s.units[0])>upgradeCost(ordinary,s.units[0]));}
  }
});

test('new and old difficulty revisions continue exact saved offers, shelves and encounters at zero and ten',()=>{
  for(const revision of [undefined,1,CURRENT_DIFFICULTY_REVISION])for(const level of [0,10])for(const kind of ['battle','elite','shop','event']){
    const s=service(kind,`revision-${kind}`);s.pressureLevel=level;if(revision===undefined)delete s.difficultyRevision;else s.difficultyRevision=revision;
    if(kind==='elite')finishBattle(s,{won:true});
    const memory=new MemoryStorage(),store=createSaveStore(memory,'difficulty-compat');assert.equal(store.save(s).ok,true);
    const bytes=memory.getItem('difficulty-compat.run'),loaded=store.load();assert.equal(loaded.ok,true);assert.equal(memory.getItem('difficulty-compat.run'),bytes);
    assert.equal(loaded.state.difficultyRevision,revision);assert.equal(difficultyProfile(loaded.state).legacy,revision!==CURRENT_DIFFICULTY_REVISION);
    for(const key of ['runId','terrain','maps','contentPool','rewardQueue','rewardCounter','currentNode','units','focus','spirit'])assert.deepEqual(loaded.state[key],s[key]);
    if(kind==='battle'){
      const encounter=makeEncounter(s);assert.deepEqual(makeEncounter(loaded.state),encounter);
      assert.equal(startBattle(s).ok,true);assert.equal(store.save(s).ok,true);const resumed=store.load().state;assert.equal(resumed.phase,'prep');
      assert.equal(resumed.difficultyRevision,revision);assert.deepEqual(makeEncounter(resumed),encounter);assert.equal(resumed.runId,loaded.state.runId);
    }
  }
});

test('unknown future difficulty revisions are rejected without overwriting runs or resetting the profile',()=>{
  const memory=new MemoryStorage(),store=createSaveStore(memory,'difficulty-future'),s=newRun('future',10),profile=store.loadProfile();
  profile.unlockedPressure=10;profile.fragments=123;profile.settledRuns=['already-paid'];assert.equal(store.saveProfile(profile).ok,true);assert.equal(store.save(s).ok,true);
  const raw=memory.getItem('difficulty-future.run');
  for(const revision of [null,0,3,'2',-1]){assert.equal(store.save({...s,difficultyRevision:revision}).ok,false);assert.equal(memory.getItem('difficulty-future.run'),raw);}
  const future=JSON.parse(raw),payload=JSON.parse(future.payload);payload.difficultyRevision=3;future.payload=JSON.stringify(payload);future.checksum=hashSeed(future.payload).toString(16);
  const futureRaw=JSON.stringify(future);memory.setItem('difficulty-future.run',futureRaw);assert.equal(store.load().ok,false);assert.equal(store.has(),false);
  assert.equal(memory.getItem('difficulty-future.run'),futureRaw);assert.deepEqual(store.loadProfile(),profile);
  memory.setItem('difficulty-future.run.backup',raw);assert.equal(store.load().recovered,true);assert.equal(store.load().state.difficultyRevision,CURRENT_DIFFICULTY_REVISION);
});

test('new difficulty affects neither deterministic offers and routes nor victory payouts',()=>{
  const low=service('elite','difficulty-rewards'),high=service('elite','difficulty-rewards');high.pressureLevel=10;
  assert.deepEqual(makeEncounter(low),makeEncounter(high));assert.deepEqual(low.maps,high.maps);assert.deepEqual(low.terrain,high.terrain);
  finishBattle(low,{won:true});finishBattle(high,{won:true});
  for(const key of ['rewardQueue','rewardCounter','focus','spirit','pendingUnitRewards','pendingTalents'])assert.deepEqual(low[key],high[key]);
  assert.equal(getSummary(low).fragments,getSummary(high).fragments);
});

test('meta content purchases affect only future pools and failed or repeated purchases are inert', () => {
  const store = createSaveStore(new MemoryStorage()), p = store.loadProfile(), initial = newRun('meta-pool', 0, p);
  assert.deepEqual([initial.contentPool.relics.length, initial.contentPool.events.length], [24, 18]);
  const before = cloneState(p); assert.equal(unlockContent(p, contentUnlocks[0].id).ok, false); assert.deepEqual(p, before);
  p.fragments = 180;
  for (const pack of contentUnlocks) {
    assert.equal(unlockContent(p, pack.id).ok, true); const purchased = cloneState(p); assert.equal(unlockContent(p, pack.id).ok, false); assert.deepEqual(p, purchased);
  }
  assert.equal(p.fragments, 0); assert.equal(unlockContent(p, 'unknown').ok, false);
  const next = newRun('meta-pool', 0, p); assert.deepEqual([next.contentPool.relics.length, next.contentPool.events.length], [30, 24]);
  assert.deepEqual(next.units, initial.units); assert.deepEqual(next.terrain, initial.terrain); assert.equal(initial.contentPool.relics.length, 24);
  assert.equal(store.saveProfile(p).ok, true); assert.deepEqual(store.loadProfile(), p); assert.deepEqual(contentPool(p), next.contentPool);
  const seenRelics = new Set(), seenEvents = new Set();
  for (let seed = 0; seed < 120; seed++) { const run = newRun(seed, 0, p); for (const map of run.maps) for (const n of map.nodes) seenEvents.add(n.event); const node = run.maps[0].nodes.find(n => n.type === 'treasure'); run.nextNodes = [node.id]; enterNode(run, node.id); for (const id of node.options) seenRelics.add(id); }
  assert.equal(seenRelics.size, 30); assert.equal(seenEvents.size, 24);
});

test('save write interruptions retain a complete safe state at every storage boundary', () => {
  class InterruptStorage extends MemoryStorage { calls = 0; failAt = Infinity; setItem(k, v) { if (++this.calls === this.failAt) throw Error('simulated quota/interruption'); super.setItem(k, v); } }
  for (let failAt = 1; failAt <= 3; failAt++) {
    const memory = new InterruptStorage(), store = createSaveStore(memory, `fault.${failAt}`), s = newRun(`fault-${failAt}`);
    assert.equal(store.save(s).ok, true); const before = store.load().state; s.focus += 30; memory.calls = 0; memory.failAt = failAt;
    assert.equal(store.save(s).ok, false); assert.equal(store.load().ok, true); assert.deepEqual(store.load().state, before);
  }
  const memory = new MemoryStorage(), store = createSaveStore(memory, 'pending-only'), s = newRun('pending-only'); store.save(s);
  memory.setItem('pending-only.run.pending', memory.getItem('pending-only.run')); memory.removeItem('pending-only.run');
  assert.equal(store.load().recovered, true); assert.equal(store.load().state.seed, s.seed);
  const blocked = { getItem:() => null, setItem:() => { throw Error('storage disabled'); }, removeItem:() => {} }, blockedStore = createSaveStore(blocked, 'blocked'); const untouched = newRun('blocked'), before = cloneState(untouched);
  assert.equal(blockedStore.save(untouched).ok, false); assert.deepEqual(untouched, before);
});

test('checksums and nested schemas reject corrupt routes, units, rewards, profiles and nonfinite numbers', () => {
  const memory = new MemoryStorage(), store = createSaveStore(memory, 'schema'), original = service('elite', 'schema'); finishBattle(original, { won:true }); assert.equal(store.save(original).ok, true);
  const mutations = [
    s => { s.maps[0].nodes[0].next = [s.maps[0].nodes[0].id]; },
    s => { s.units[0].x = 40; s.units[0].z = 40; },
    s => { s.units[0].uid = s.units[1].uid; },
    s => { s.units[0].tier = 2; s.units[0].branch = 'C'; },
    s => { s.rewardQueue[0].options = ['nonexistent']; },
    s => { s.rewardQueue[0].reserves = ['nonexistent']; },
    s => { s.stats.pressure = NaN; },
    s => { s.modifiers.attack = Infinity; },
    s => { s.nextNodes = ['invalid']; },
    s => { s.contentPool.events = []; },
    s => { s.discoveries.towers = ['invalid']; },
    s => { s.version = 1; }
  ];
  for (const mutate of mutations) { const bad = cloneState(original); mutate(bad); assert.equal(store.save(bad).ok, false); assert.deepEqual(store.load().state, { ...cloneState(original), battle:null, preBattle:null }); }
  const raw = JSON.parse(memory.getItem('schema.run')); raw.payload = raw.payload.replace('"focus":', '"focuX":'); memory.setItem('schema.run', JSON.stringify(raw)); assert.equal(store.load().ok, false);
  raw.checksum = hashSeed(raw.payload).toString(16); memory.setItem('schema.run', JSON.stringify(raw)); assert.equal(store.load().ok, false, 'valid checksum cannot make invalid schema valid');
  assert.equal(store.saveProfile({ ...store.loadProfile(), fragments:-1 }).ok, false);
  assert.equal(store.saveSettings({ quality:'ultra-unknown' }).ok, false); assert.equal(store.saveSettings({ reducedMotion:1 }).ok, false);
});

test('v2 development notice is shown once and never deletes older or unrelated player data', () => {
  const memory = new MemoryStorage(); memory.setItem('mindrealm.web.v1.run', 'old-run-preserved'); memory.setItem('mindrealm.web.v1.profile', 'old-profile-preserved'); memory.setItem('foreign-player.save', 'preserved');
  const store = createSaveStore(memory); assert.ok(store.migrationNotice().includes('保留')); assert.equal(store.migrationNotice(), null); assert.equal(createSaveStore(memory).migrationNotice(), null);
  assert.equal(store.has(), false); assert.equal(store.save(newRun('new-schema')).ok, true); assert.equal(store.clear().ok, true);
  assert.equal(memory.getItem('mindrealm.web.v1.run'), 'old-run-preserved'); assert.equal(memory.getItem('mindrealm.web.v1.profile'), 'old-profile-preserved'); assert.equal(memory.getItem('foreign-player.save'), 'preserved');
});

test('failed runs earn node and elite fragments once; successive victories unlock all ten pressures', () => {
  const store = createSaveStore(new MemoryStorage()), failed = service('battle', 'failed-meta'); failed.runId = 'failed-meta'; failed.stats.completedNodes = 4; failed.stats.elites = 2; failed.spirit = 0; finishBattle(failed, { won:false });
  let profile = settleProfile(store.loadProfile(), failed); assert.equal(profile.fragments, 18); assert.equal(profile.wins, 0); assert.equal(profile.unlockedPressure, 0); assert.deepEqual(settleProfile(profile, failed), profile);
  for (let pressure = 0; pressure <= 10; pressure++) { const s = service('boss', `victory-${pressure}`, 2); s.runId = `pressure-${pressure}`; s.pressureLevel = pressure; finishBattle(s, { won:true }); profile = settleProfile(profile, s); assert.equal(profile.unlockedPressure, Math.min(10, pressure + 1)); }
  assert.equal(profile.wins, 11); assert.equal(profile.runs, 12); assert.equal(store.saveProfile(profile).ok, true);
});

test('post-battle effects target the largest actual loss and ignore expired enemy interference', () => {
  const s = service('battle', 'post-effects'); s.relics = ['maintenance_loop', 'signal_dividend'];
  const large = s.units[0], small = s.units.find(u => u.type === 'focus_rail');
  large.hp = unitStats(s, large).maxHp - 90; small.hp = unitStats(s, small).maxHp - 60;
  const hp = large.hp, smallHp = small.hp, focus = s.focus; s.battle = { jam:99 };
  finishBattle(s, { won:true }); assert.equal(large.hp, hp + unitStats(s, large).maxHp * .08); assert.equal(small.hp, smallHp); assert.equal(s.focus, focus + 35 + 16);
  const removed = s.units.pop(); s.stats.damageByUnit[removed.uid] = 1234;
  assert.equal(getSummary(s).damageSources[0].name, towers[removed.type].name); assert.equal(getSummary(s).bossStatus.length, 3);
});
