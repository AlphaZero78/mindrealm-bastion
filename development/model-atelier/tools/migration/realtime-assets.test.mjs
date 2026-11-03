import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { towers, enemies, events, messengers } = await import(pathToFileURL(join(root, 'game/web/core/content.js')).href);
const { MODEL_PORTRAITS } = await import(pathToFileURL(join(root, 'game/web/view/model-portraits.js')).href);
const { NEXUS_ART } = await import(pathToFileURL(join(root, 'game/web/view/nexus-art.js')).href);
const { EntityMotion } = await import(pathToFileURL(join(root, 'game/web/view/entity-motion.js')).href);
const clips = ['idle', 'move', 'attack', 'windup', 'release', 'ability', 'shutdown'];
const bytes = path => readFile(join(root, path.startsWith('development/') || path.startsWith('game/') ? path : 'game/' + path));

test('all 49 realtime assemblies and 109 variants resolve to embedded GLBs with seven clips', async () => {
  const models = JSON.parse(await bytes('assets/game/models/models.json'));
  assert.equal(models.format, 2);
  assert.equal(models.sources, undefined);
  assert.deepEqual(Object.keys(models.entities).sort(), [...Object.keys(towers), ...Object.keys(enemies)].sort());
  let variants = 0;
  for (const [entityId, entity] of Object.entries(models.entities)) {
    assert.deepEqual(Object.keys(entity.bounds).sort(), ['x', 'y', 'z'], `${entityId}: bounds axes`);
    assert.ok(Object.values(entity.bounds).every(value => Number.isFinite(value) && value > 0), `${entityId}: valid bounds`);
    const gameplay = towers[entityId] || enemies[entityId];
    assert.equal(entity.role, gameplay.kind === undefined ? gameplay.role : gameplay.kind, `${entityId}: role`);
    for (const [variant, entry] of Object.entries(entity.variants)) {
      variants++;
      assert.ok(!Array.isArray(entry), `${entityId}/${variant}: no legacy parts array`);
      assert.equal(entry.source, `models/${entityId}/${variant}.glb`);
      assert.deepEqual(Object.keys(entry.clips || {}).sort(), [...clips].sort());
      const data = await bytes(`assets/game/${entry.source}`);
      assert.equal(data.readUInt32LE(0), 0x46546c67);
      assert.equal(data.readUInt32LE(4), 2);
      assert.equal(data.readUInt32LE(8), data.length);
      const doc = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)).trim());
      assert.ok(!doc.buffers.some(buffer => buffer.uri), `${entityId}/${variant}: external buffer`);
      assert.ok(!doc.images?.length, `${entityId}/${variant}: unexpected external image payload`);
      assert.ok(doc.nodes.some(node => node.mesh !== undefined), `${entityId}/${variant}: mesh nodes`);
      assert.deepEqual(doc.animations.map(animation => animation.name).sort(), [...clips].sort(), `${entityId}/${variant}: GLB clips`);
      for (const mesh of doc.meshes) for (const primitive of mesh.primitives) {
        assert.ok(primitive.attributes.POSITION !== undefined && primitive.attributes.NORMAL !== undefined && primitive.attributes.TEXCOORD_0 !== undefined,
          `${entityId}/${variant}: position/normal/UV primitive`);
      }
    }
  }
  assert.equal(variants, 109);
});

test('all 36 events and 12 messengers have distinct scenes; portraits and local PMREM inputs preserve their contracts', async () => {
  assert.deepEqual(Object.keys(NEXUS_ART).sort(), Object.keys(messengers).sort());
  const hashes = new Set(), scenes = [...Object.keys(events).map(id => `assets/game/events/${id}.png`), ...Object.values(NEXUS_ART).map(art => art.path.slice(1))];
  for (const path of scenes) {
    const data = await bytes(path);
    assert.equal(data.toString('ascii', 1, 4), 'PNG');
    const width = data.readUInt32BE(16), height = data.readUInt32BE(20);
    assert.ok(width >= 1280, path); assert.ok(height >= 720, path);
    assert.ok(Math.abs(width / height - 16 / 9) < 0.015, path);
    hashes.add(createHash('sha256').update(data).digest('hex'));
  }
  assert.equal(hashes.size, 48);
  assert.equal(Object.keys(MODEL_PORTRAITS).length, 49);
  for (const [id, art] of Object.entries(MODEL_PORTRAITS)) {
    const data = await bytes(art.path.slice(1));
    assert.equal(data.readUInt32BE(16), 256, id);
    assert.equal(data.readUInt32BE(20), 256 * art.rows, id);
    assert.equal(data[25], 6, id);
    assert.ok(art.bounds.x >= 0 && art.bounds.y >= 0 && art.bounds.width > 0 && art.bounds.height > 0 && art.bounds.x + art.bounds.width <= 256 && art.bounds.y + art.bounds.height <= 256);
  }
  const rendererSource = await readFile(join(root, 'game/web/view/whole-entity-renderer.js'), 'utf8');
  assert.match(rendererSource, /RoomEnvironment/, 'runtime PMREM must use the local RoomEnvironment');
  assert.match(rendererSource, /PMREMGenerator/, 'PMREM is generated at runtime');
  assert.match(rendererSource, /\.fromScene\(/, 'PMREM is generated from a scene, not a serialized HDR');
  assert.ok(!rendererSource.includes('studio_small_09_pmrem'));
  const { RoomEnvironment } = await import(pathToFileURL(join(root, 'game/assets/third_party/three/addons/environments/RoomEnvironment.js')).href);
  const room = new RoomEnvironment();
  let meshes = 0;
  room.traverse(node => { if (node.isMesh) meshes++; });
  assert.ok(room.isScene && meshes >= 7, 'actual local RoomEnvironment scene');
  room.dispose();
});

test('CG provenance covers the live assets with exact sizes, hashes and recorded generation inputs', async () => {
  for (const [kind, catalog] of [['event', events], ['nexus', messengers]]) {
    const record = JSON.parse(await bytes(`development/assets/${kind}_art/prompts.json`));
    assert.deepEqual(record.assets.map(art => art[kind === 'event' ? 'eventId' : 'messengerId']).sort(), Object.keys(catalog).sort());
    for (const art of record.assets) {
      const data = await bytes(art.path);
      assert.equal(createHash('sha256').update(data).digest('hex'), art.sha256, art.path);
      assert.equal(data.readUInt32BE(16), art.width); assert.equal(data.readUInt32BE(20), art.height); assert.equal(data.length, art.bytes);
      assert.ok(['built-in imagegen', 'Cursor GenerateImage'].includes(art.generationMode));
      const selected = art.steps.filter(step => step.selected); assert.equal(selected.length, 1);
      assert.equal(selected[0].prompt, art.finalPrompt); assert.equal(selected[0].outputFilename, art.finalGenerationFilename);
      if (art.nativeSize) assert.deepEqual(art.nativeSize, [art.width, art.height]);
      if (art.generationMode === 'Cursor GenerateImage') {
        assert.equal(art.promptScope, 'source-brief'); assert.ok(art.promptRecordNote); assert.match(art.sourceSha256, /^[a-f0-9]{64}$/); assert.deepEqual(selected[0].referenceImages, []);
      }
      assert.ok(art.briefZh && art.acceptanceZh);
      for (const step of art.steps) {
        assert.ok(step.prompt); assert.ok(step.outputFilename);
        if (step.operation === 'edit') assert.ok(step.inputFilenames?.length);
      }
    }
  }
});

test('visual interpolation advances joint phases between physics steps and retains future death cues', () => {
  const enemy = { id: 'e1', type: 'static_drifter', x: 5, z: 8, h: 0, hp: 40, maxHp: 40, motion: { dx: 0.15, dz: 0, distance: 2.1 } };
  const state = { units: [], battle: { time: 2, enemies: [enemy] } };
  const motion = new EntityMotion();
  motion.update(state, [], 1000, 0.2); const a = motion.sample(enemy, 'enemy');
  motion.update(state, [], 1016, 0.6); const b = motion.sample(enemy, 'enemy');
  assert.ok(b.clock > a.clock); assert.ok(b.progress > a.progress);
  const before = JSON.stringify(state);
  motion.update(state, [], 1100, 0.6); assert.deepEqual(motion.sample(enemy, 'enemy'), b); assert.equal(JSON.stringify(state), before);
  motion.update(state, [{ action: 'death', sourceKind: 'enemy', sourceId: 'e1', time: 2, entity: { ...enemy, hp: 0 } }], 1116, 0.8);
  assert.equal(motion.deaths.length, 1); state.battle.time = 2.7; motion.update(state, [], 1800, 1); assert.equal(motion.deaths.length, 0);
});
