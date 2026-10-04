import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTerrain, generateMap, newRun } from '../../web/core/state.js';
import { towers } from '../../web/core/content.js';
import { DIRECTIONS, placement, deploy, pathToCore, solveAttack } from '../../web/core/rules.js';
import { createSaveStore } from '../../web/core/save.js';

const cell = (terrain, x, z) => terrain.cells[z * terrain.size + x];
const protectedAt = (terrain, x, z) => Math.abs(x - terrain.core.x) <= 2 && Math.abs(z - terrain.core.z) <= 2 ||
  terrain.entries.some(entry => Math.abs(x - entry.x) <= 1 && Math.abs(z - entry.z) <= 1);

function zeroGround(terrain) {
  const origin = terrain.core.z * terrain.size + terrain.core.x;
  const seen = new Set([origin]), queue = [origin];
  for (let read = 0; read < queue.length; read++) {
    const i = queue[read], x = i % terrain.size, z = Math.floor(i / terrain.size);
    for (const direction of DIRECTIONS) {
      const nx = x + direction.x, nz = z + direction.z;
      if (nx < 0 || nz < 0 || nx >= terrain.size || nz >= terrain.size) continue;
      const next = nz * terrain.size + nx;
      if (!seen.has(next) && terrain.cells[next].h === 0) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
}

test('1000 natural terrains preserve protected cells, one-level slopes and three connected zero-height approaches', () => {
  for (let seed = 0; seed < 1000; seed++) {
    const terrain = generateTerrain(`terrain-${seed}`), seen = zeroGround(terrain);
    assert.equal(terrain.size, 41);
    assert.equal(terrain.cells.length, 1681);
    assert.deepEqual(terrain.core, { x: 20, z: 38, size: 5 });
    assert.equal(terrain.entries.length, 3);
    assert.equal(terrain.revision, 0);
    let protectedCount = 0;
    for (let z = 0; z < terrain.size; z++) for (let x = 0; x < terrain.size; x++) {
      const here = cell(terrain, x, z);
      assert.ok(Number.isInteger(here.h) && here.h >= 0 && here.h <= 4, `height ${seed}/${x}/${z}`);
      assert.equal(here.protected, protectedAt(terrain, x, z));
      assert.equal(here.ramp, -1, 'Initial terrain does not silently install player-built ramps');
      if (here.protected) { protectedCount++; assert.equal(here.h, 0); }
      if (x < 40) assert.ok(Math.abs(here.h - cell(terrain, x + 1, z).h) <= 1, `east slope ${seed}/${x}/${z}`);
      if (z < 40) assert.ok(Math.abs(here.h - cell(terrain, x, z + 1).h) <= 1, `south slope ${seed}/${x}/${z}`);
    }
    assert.equal(protectedCount, 43);
    for (const entry of terrain.entries) assert.ok(seen.has(entry.z * terrain.size + entry.x), `zero-ground route ${seed}/${entry.id}`);
    assert.ok(terrain.cells.filter(c => c.h > 0).length >= 200, `meaningful highlands ${seed}`);
    assert.ok(terrain.cells.some(c => c.h >= 3), `layered highlands ${seed}`);
  }
});

test('terrain seeds reproduce independently and create distinct irregular silhouettes and winding valleys', () => {
  const silhouettes = new Set(); let varyingCross = 0;
  for (let seed = 0; seed < 100; seed++) {
    const terrain = generateTerrain(`landscape-${seed}`);
    assert.deepEqual(terrain, generateTerrain(`landscape-${seed}`));
    silhouettes.add(terrain.cells.map(c => c.h > 0 ? '1' : '0').join(''));
    // The old generator forced five-cell-wide straight zero-height cross roads.
    if (terrain.cells.some((c, i) => c.h > 0 && (Math.abs(i % 41 - 20) <= 2 || Math.abs(Math.floor(i / 41) - 24) <= 2))) varyingCross++;
    const rowWidths = Array.from({ length: 41 }, (_, z) => terrain.cells.slice(z * 41, z * 41 + 41).filter(c => c.h > 0).length);
    assert.ok(new Set(rowWidths).size >= 10, `not a repeated rectangular silhouette ${seed}`);
  }
  assert.equal(silhouettes.size, 100);
  assert.equal(varyingCross, 100);
  const map = generateMap('independent-terrain', 0);
  for (const seed of ['', '偏频者', '🌿', '0', 'a'.repeat(64)]) {
    const terrain = generateTerrain(seed), untouched = structuredClone(terrain);
    generateTerrain('another-seed'); generateMap(seed, 2);
    assert.deepEqual(generateTerrain(seed), untouched);
    terrain.cells[0].h = 4;
    assert.deepEqual(generateTerrain(seed), untouched, 'Returned terrain must not be a shared mutable template');
  }
  assert.deepEqual(generateMap('independent-terrain', 0), map, 'Terrain generation must not advance map randomness');
});

test('broad natural terraces allow all three opening ranged units to deploy without terrain spending', () => {
  for (let seed = 0; seed < 200; seed++) {
    const state = newRun(`terrain-${seed}`); state.phase = 'prep';
    const initialTerrain = structuredClone(state.terrain), focus = state.focus;
    const ranged = state.units.filter(u => towers[u.type].role === 'ranged')
      .sort((a, b) => towers[b.type].footprint[0] - towers[a.type].footprint[0]);
    for (const unit of ranged) {
      const candidates = [];
      for (let z = 23; z < 39; z++) for (let x = 3; x < 38; x++) {
        if (Math.hypot(x - 20, z - 38) > 13 || !placement(state, unit, x, z).ok) continue;
        const coversFire = solveAttack(state, { ...unit, x, z }, { x: 20, z: 38, h: 0, air: false }).ok;
        candidates.push({ x, z, score: Math.hypot(x - 20, z - 38) + (coversFire ? 0 : 50) });
      }
      candidates.sort((a, b) => a.score - b.score);
      assert.ok(candidates.length, `No opening terrace ${seed}/${unit.type}`);
      assert.equal(deploy(state, unit.uid, candidates[0].x, candidates[0].z).ok, true);
    }
    assert.equal(ranged.filter(u => u.x !== null).length, 3);
    assert.equal(state.focus, focus, 'Opening placement should not need terraform or relocation fees');
    assert.deepEqual(state.terrain, initialTerrain);
  }
});

test('combat pathfinding follows connected lowlands without requiring an initial breach', () => {
  for (let seed = 0; seed < 50; seed++) {
    const state = newRun(`natural-path-${seed}`);
    for (const entry of state.terrain.entries) {
      const route = pathToCore(state, entry.x, entry.z);
      assert.ok(route.length > 1 && route.length < 130, `finite route ${seed}/${entry.id}`);
      for (const position of route) assert.equal(cell(state.terrain, position.x, position.z).h, 0, `no forced cliff ${seed}/${entry.id}`);
    }
  }
});

test('existing saved square terrain and player edits are loaded verbatim rather than regenerated', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
  const store = createSaveStore(storage, 'terrain-tests-only');
  const state = newRun('legacy-terrain');
  for (const current of state.terrain.cells) { current.h = 0; current.ramp = -1; }
  for (const [px, pz] of [[14, 18], [24, 18], [14, 28], [24, 28]])
    for (let z = pz; z < pz + 3; z++) for (let x = px; x < px + 3; x++) cell(state.terrain, x, z).h = 1;
  cell(state.terrain, 13, 18).ramp = 1;
  state.terrain.revision = 17;
  const original = structuredClone(state.terrain);
  assert.notDeepEqual(original.cells, generateTerrain(state.seed).cells);
  assert.equal(store.save(state).ok, true);
  const loaded = store.load();
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state.terrain, original);
  assert.equal(store.save(loaded.state).ok, true);
  assert.deepEqual(store.load().state.terrain, original);
});
