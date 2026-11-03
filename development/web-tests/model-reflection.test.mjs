import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  GAME_ROOT, T, manifest, towers, wholeAsset, modelInstance, expectedVariants, validateGeometry, snapshot,
} from './whole-entity-test-helpers.mjs';

const { reflectGeometryX } = await import(pathToFileURL(path.join(GAME_ROOT, 'web/view/model-reflection.js')).href);

function faceDot(geometry, a, b, c) {
  const position = geometry.attributes.position, normal = geometry.attributes.normal;
  return new T.Vector3().fromBufferAttribute(position, b).sub(new T.Vector3().fromBufferAttribute(position, a))
    .cross(new T.Vector3().fromBufferAttribute(position, c).sub(new T.Vector3().fromBufferAttribute(position, a)))
    .dot(new T.Vector3().fromBufferAttribute(normal, a).add(new T.Vector3().fromBufferAttribute(normal, b)).add(new T.Vector3().fromBufferAttribute(normal, c)));
}

test('original GLB reflection preserves curved normals, UVs and outward winding without Kenney sources', async () => {
  const asset = await wholeAsset('static_drifter', 'base');
  const sources = [];
  asset.scene.traverse(node => { if (node.isMesh) sources.push(node.geometry); });
  assert.ok(sources.length >= 15);
  for (const source of sources) for (const original of [source, source.index ? source.toNonIndexed() : source.clone()]) {
    const before = original.attributes.position.array.slice();
    const reflected = reflectGeometryX(original);
    const restored = reflectGeometryX(reflected);
    assert.deepEqual(original.attributes.position.array, before, 'Source stays unchanged');
    assert.deepEqual(reflected.attributes.uv.array, original.attributes.uv.array, 'UVs follow their vertices');
    assert.deepEqual(restored.attributes.position.array, original.attributes.position.array, 'Double reflection');
    for (let i = 0; i < before.length; i++) assert.equal(reflected.attributes.position.array[i], i % 3 === 0 ? -before[i] : before[i]);
    const indices = original.index?.array || Array.from({ length: original.attributes.position.count }, (_, i) => i);
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i], b = indices[i + 1], c = indices[i + 2];
      assert.equal(reflected.index.array[i], a);
      assert.equal(reflected.index.array[i + 1], c);
      assert.equal(reflected.index.array[i + 2], b);
      assert.ok(Math.abs(faceDot(original, a, b, c) - faceDot(reflected, a, c, b)) < 1e-7, 'Reflected faces keep outward normals');
    }
  }
});

test('reflected original geometry remains exact under nonuniform scale and tilted node matrices', async () => {
  const asset = await wholeAsset('arc_mortar', 'T3A');
  const a = modelInstance(asset), b = modelInstance(asset);
  let meshA;
  a.model.root.traverse(node => { if (!meshA && node.isMesh && node.name) meshA = node; });
  assert.ok(meshA);
  const meshB = b.model.root.getObjectByName(meshA.name);
  assert.ok(meshB?.isMesh);
  const original = meshA.geometry;
  const reflected = reflectGeometryX(original);
  meshA.geometry = reflected;
  const rootA = new T.Group(), rootB = new T.Group();
  rootA.add(meshA); rootB.add(meshB);
  const matrix = new T.Matrix4().compose(
    new T.Vector3(0.23, 0.79, 0.66),
    new T.Quaternion().setFromEuler(new T.Euler(0.3, -0.41, 0.19)),
    new T.Vector3(0.61, 1.24, 0.83),
  );
  const mirror = new T.Matrix4().makeScale(-1, 1, 1);
  const counterpart = mirror.clone().multiply(matrix).multiply(mirror);
  meshA.matrixAutoUpdate = false; meshB.matrixAutoUpdate = false;
  meshA.matrix.copy(matrix); meshB.matrix.copy(counterpart);
  rootA.updateMatrixWorld(true); rootB.updateMatrixWorld(true);
  const position = original.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const actual = new T.Vector3().fromBufferAttribute(reflected.getAttribute('position'), i).applyMatrix4(meshA.matrixWorld).applyMatrix4(mirror);
    const expected = new T.Vector3().fromBufferAttribute(position, i).applyMatrix4(meshB.matrixWorld);
    assert.ok(actual.distanceTo(expected) < 1e-9, `mirrored world vertex ${i}`);
  }
  validateGeometry(rootA, 'reflected transformed GLB');
  validateGeometry(rootB, 'counterpart transformed GLB');
  a.animation.dispose(); b.animation.dispose(); a.model.dispose(); b.model.dispose();
});

test('every tower variant has finite original GLB geometry, normals, UVs and consistent winding', async () => {
  const ids = Object.keys(towers).sort();
  assert.equal(ids.length, 12);
  let variants = 0;
  for (const id of ids) {
    const definition = manifest.entities[id];
    assert.equal(definition.kind, 'towers', id);
    assert.equal(definition.role, towers[id].role, id);
    assert.deepEqual(Object.keys(definition.variants), expectedVariants(id), id);
    for (const variant of expectedVariants(id)) {
      variants++;
      assert.ok(!Array.isArray(definition.variants[variant]), `${id}/${variant}: whole GLB entry, not a parts array`);
      const asset = await wholeAsset(id, variant);
      validateGeometry(asset.scene, `${id}/${variant}`);
      snapshot(asset.scene);
    }
  }
  assert.equal(variants, 60);
});
