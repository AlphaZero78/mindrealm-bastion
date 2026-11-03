import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CLIP_NAMES, GAME_ROOT, T, enemies, manifest, wholeAsset, modelInstance, expectedVariants,
  validateTrackBindings, validateGeometry, snapshot, assertSnapshot, lowestVertex,
} from './whole-entity-test-helpers.mjs';

const { wheelRollAngle, wheelSupportHeight } = await import(pathToFileURL(path.join(GAME_ROOT, 'web/view/enemy-rig.js')).href);
const { MechanicalConnections } = await import(pathToFileURL(path.join(GAME_ROOT, 'web/view/mechanical-connections.js')).href);
const enemyIds = Object.keys(enemies).sort();

function enemyAssets() {
  return enemyIds.flatMap(id => expectedVariants(id).map(variant => ({ id, variant })));
}

test('all 37 enemy assemblies and boss phases resolve to format 2 GLBs with seven articulated clips', async () => {
  assert.equal(enemyIds.length, 37);
  assert.deepEqual(Object.entries(manifest.entities).filter(([, definition]) => definition.kind === 'enemies').map(([id]) => id).sort(), enemyIds);
  let variants = 0;
  for (const { id, variant } of enemyAssets()) {
    variants++;
    const definition = manifest.entities[id];
    assert.equal(definition.role, enemies[id].kind, `${id}: gameplay role`);
    assert.deepEqual(Object.keys(definition.variants), expectedVariants(id), `${id}: variants`);
    const asset = await wholeAsset(id, variant);
    assert.ok(asset.meshCount > 0, `${id}/${variant}: meshes`);
    assert.equal(asset.animations.length, CLIP_NAMES.length, `${id}/${variant}: clips`);
    validateTrackBindings(asset, asset.scene, `${id}/${variant}`);
  }
  assert.equal(variants, 49);
});

test('enemy GLB vertices, normals, UVs, indices and triangle winding stay valid in every boss phase', async () => {
  for (const { id, variant } of enemyAssets()) {
    const asset = await wholeAsset(id, variant);
    validateGeometry(asset.scene, `${id}/${variant}`);
    snapshot(asset.scene);
  }
});

test('enemy clips use absolute action sampling and remain deterministic while simulation time is paused', async () => {
  const samples = [
    { pose: { action: 'idle', clock: 731 }, channel: 'idle' },
    { pose: { action: 'move', travel: 0.43, clock: 731 }, channel: 'move' },
    { pose: { action: 'attack', progress: 0.43, clock: 731 }, channel: 'attack' },
    { pose: { action: 'cast', stage: 'windup', progress: 0.82, clock: 731 }, channel: 'windup' },
    { pose: { action: 'cast', stage: 'release', progress: 0.27, clock: 731 }, channel: 'release' },
    { pose: { action: 'ability', progress: 0.61, clock: 731 }, channel: 'ability' },
    { pose: { action: 'death', progress: 0.24, clock: 731 }, channel: 'shutdown' },
  ];
  for (const { id, variant } of enemyAssets()) {
    const asset = await wholeAsset(id, variant);
    const { model, animation } = modelInstance(asset);
    const rest = snapshot(model.root);
    for (const { pose, channel } of samples) {
      const input = Object.freeze({ progress: 0, ...pose });
      const before = JSON.stringify(input);
      const result = animation.sample(input);
      assert.equal(JSON.stringify(input), before, `${id}/${variant}: mutated input`);
      assert.equal(result.requestedClip, channel, `${id}/${variant}/${channel}`);
      assert.equal(result.clip, channel, `${id}/${variant}/${channel}: real clip`);
      const duration = asset.clips.get(channel).duration;
      let expected = input.progress * duration;
      if (channel === 'idle') expected = ((input.clock / 1000) % duration + duration) % duration;
      if (channel === 'move') expected = ((input.travel / 1.5) % 1 + 1) % 1 * duration;
      if (channel === 'shutdown') expected = duration;
      assert.ok(Math.abs(result.time - expected) < 1e-9, `${id}/${variant}/${channel}: absolute time`);
      const sampled = snapshot(model.root);
      assert.notDeepEqual(sampled, rest, `${id}/${variant}/${channel}: clip does not articulate the model`);
      animation.sample(input);
      assertSnapshot(snapshot(model.root), sampled, `${id}/${variant}/${channel}: paused sample`, 0);
      animation.mixer.update(0);
      assertSnapshot(snapshot(model.root), sampled, `${id}/${variant}/${channel}: zero-delta pause`, 0);
    }
    animation.dispose();
    model.dispose();
  }
});

test('refined wheel rotation cancels travel at its actual contact radius', () => {
  for (const radius of [0.26, 0.27, 0.30, 0.32, 0.36]) for (const travel of [0.03, 0.17, 0.63, 1.2, 4]) {
    const angle = wheelRollAngle(travel, radius), step = 1e-6;
    const derivative = (wheelRollAngle(travel + step, radius) - wheelRollAngle(travel - step, radius)) / (2 * step);
    assert.ok(Math.abs(wheelSupportHeight(angle, radius) * derivative - 1) < 1e-6, `r=${radius} s=${travel}`);
  }
});

test('independent GLB clones seek attack absolutely without changing a sibling clone', async () => {
  for (const { id, variant } of enemyAssets()) {
    const asset = await wholeAsset(id, variant);
    const a = modelInstance(asset), b = modelInstance(asset);
    assert.notEqual(a.model.root, b.model.root, `${id}/${variant}: root clone`);
    const names = [];
    a.model.root.traverse(node => { if (node.name) names.push(node.name); });
    for (const name of names) assert.notEqual(a.model.root.getObjectByName(name), b.model.root.getObjectByName(name), `${id}/${variant}/${name}: shared node`);
    for (const entry of a.model.materials) assert.ok(b.model.materials.every(other => other.material !== entry.material), `${id}/${variant}: shared cloned material`);
    a.animation.sample({ action: 'attack', progress: 0.82, clock: 820 });
    a.animation.sample({ action: 'attack', progress: 0.26, clock: 900 });
    b.animation.sample({ action: 'attack', progress: 0.26, clock: 900 });
    assertSnapshot(snapshot(a.model.root), snapshot(b.model.root), `${id}/${variant}: absolute seek`);
    const sibling = snapshot(b.model.root);
    a.animation.sample({ action: 'move', travel: 0.63, clock: 1000 });
    assertSnapshot(snapshot(b.model.root), sibling, `${id}/${variant}: sibling independence`, 0);
    a.animation.dispose(); b.animation.dispose(); a.model.dispose(); b.model.dispose();
  }
});

test('reduced motion and death resolve the actual shutdown terminal pose at any clock', async () => {
  for (const { id, variant } of enemyAssets()) {
    const asset = await wholeAsset(id, variant);
    const reduced = modelInstance(asset);
    const rest = snapshot(reduced.model.root);
    const result = reduced.animation.sample({ action: 'death', progress: 0.1, reducedMotion: true, clock: 1710 });
    const shutdown = asset.clips.get('shutdown');
    assert.equal(result.time, shutdown.duration, `${id}/${variant}: terminal time`);
    assert.equal(result.hold, true, `${id}/${variant}: terminal hold`);
    const terminal = snapshot(reduced.model.root);
    assert.notDeepEqual(terminal, rest, `${id}/${variant}: shutdown equals rest`);
    const direct = modelInstance(asset);
    const action = direct.animation.mixer.clipAction(shutdown);
    action.reset();
    action.setLoop(T.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    action.time = shutdown.duration;
    direct.animation.mixer.update(0);
    // The exported keyframes use float32 values. Apply the same endpoint
    // constraints that keep the terminal pose connected in the live renderer.
    const directConnections = new MechanicalConnections(direct.model.root);
    directConnections.apply();
    assertSnapshot(terminal, snapshot(direct.model.root), `${id}/${variant}: direct shutdown`);
    directConnections.dispose();
    for (const clock of [1480, 2010, 2600]) {
      reduced.animation.sample({ action: 'death', progress: 0.1, reducedMotion: true, clock });
      assertSnapshot(snapshot(reduced.model.root), terminal, `${id}/${variant}: arrested terminal clock`, 0);
    }
    reduced.animation.dispose(); reduced.model.dispose();
    direct.animation.dispose(); direct.model.dispose();
  }
});

test('ground-enemy locomotion never moves measured GLB vertices below their authored contact baseline', async () => {
  const epsilon = 1e-4;
  const samples = [
    { action: 'move', moving: true, travel: 0.03, clock: 170 },
    { action: 'move', moving: true, travel: 0.63, clock: 900 },
    { action: 'cast', stage: 'windup', progress: 0.82, moving: true, travel: 0.31, clock: 902 },
    { action: 'cast', stage: 'release', progress: 0.27, moving: true, travel: 0.43, clock: 1213 },
  ];
  const failures = [];
  for (const { id, variant } of enemyAssets()) {
    if (enemies[id].air) continue;
    const asset = await wholeAsset(id, variant);
    const baseline = lowestVertex(asset.scene);
    const { model, animation } = modelInstance(asset);
    for (const pose of samples) {
      animation.sample(pose);
      const measured = lowestVertex(model.root);
      if (measured < baseline - epsilon) failures.push(`${id}/${variant}/${pose.action}/${pose.stage || 'move'}: lowest ${measured}, baseline ${baseline}, delta ${baseline - measured}`);
    }
    animation.dispose();
    model.dispose();
  }
  assert.deepEqual(failures, []);
});
