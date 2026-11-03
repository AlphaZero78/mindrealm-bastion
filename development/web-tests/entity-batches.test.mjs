import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../game/assets/third_party/three/three.bundle.js';
import { EntityBatchPool } from '../../game/web/view/entity-batches.js';
import { createEntityLodGeometry } from '../../game/web/view/entity-geometry.js';

test('far geometry removes triangles collapsed onto a shared edge during vertex clustering', () => {
  const source = new T.SphereGeometry(1, 24, 16);
  const result = createEntityLodGeometry(source, { cellRatio: .22, minTriangles: 0 });
  try {
    assert.ok(result.lodTriangles > 0 && result.lodTriangles < result.sourceTriangles);
    const indices = result.geometry.index.array;
    for (let i = 0; i < indices.length; i += 3) assert.equal(new Set(indices.slice(i, i + 3)).size, 3);
    assert.ok(result.geometry.boundingSphere.radius > .8);
  } finally { result.geometry.dispose(); source.dispose(); }
});

test('repeated model submissions keep distinct transforms through growth, LOD, transparency and slot reuse', () => {
  const scene = new T.Scene(), pool = new EntityBatchPool(scene, { capacity: 2 });
  const near = new T.BoxGeometry(1, 1, 1), far = new T.TetrahedronGeometry(1);
  const material = new T.MeshStandardMaterial(), otherMaterial = material.clone(); otherMaterial.roughness = .2;
  const source = { geometry: near, materials: [material] }, sibling = { geometry: near, materials: [material] };
  const farSource = { geometry: far, materials: [material] }, branchSource = { geometry: far, materials: [otherMaterial] };
  const matrix = new T.Matrix4(), color = new T.Vector4();
  const submit = (src, owner, x, transparent = false, shadow = true) => pool.add(src, new T.Matrix4().makeTranslation(x, 2, 3), {
    owner, part: 'arm', alpha: transparent ? .4 : 1, brightness: 1.2, transparent, shadow,
  });
  const inspect = (owner, x, geometry, alpha) => {
    const { batch, slot } = pool.owners.get(`${owner}:arm`);
    batch.mesh.getMatrixAt(slot.id, matrix); batch.mesh.getColorAt(slot.id, color);
    assert.equal(matrix.elements[12], x); assert.ok(Math.abs(color.w - alpha) < 1e-6);
    assert.equal(batch.mesh.getVisibleAt(slot.id), true);
    assert.equal(slot.geometryUuid, geometry.uuid);
    assert.equal(batch.mesh.getGeometryIdAt(slot.id), batch.geometries.get(geometry.uuid).id);
  };
  try {
    for (let frame = 0; frame < 3; frame++) {
      pool.begin(); submit(source, 'a', frame); submit(sibling, 'b', frame + 5); submit(source, 'c', frame + 10);
      assert.equal(pool.flush(), 3); inspect('a', frame, near, 1); inspect('b', frame + 5, near, 1); inspect('c', frame + 10, near, 1);
    }
    pool.begin(); submit(farSource, 'a', 20, true, false); submit(sibling, 'b', 25);
    assert.equal(pool.flush(), 2); inspect('a', 20, far, .4); inspect('b', 25, near, 1);
    const hidden = pool.owners.get('c:arm'); assert.equal(hidden.batch.mesh.getVisibleAt(hidden.slot.id), false);
    pool.remove('b'); pool.begin(); submit(branchSource, 'a', 30, false, true); submit(sibling, 'd', 35);
    assert.equal(pool.flush(), 2); inspect('a', 30, far, 1); inspect('d', 35, near, 1);
    assert.equal(pool.owners.has('b:arm'), false);
    pool.remove('a'); pool.remove('c'); pool.remove('d'); assert.equal(pool.flush(), 0); assert.equal(pool.owners.size, 0);
    pool.dispose(); pool.begin(); submit(sibling, 'a', 40); assert.equal(pool.flush(), 1); inspect('a', 40, near, 1);
  } finally { pool.dispose(); near.dispose(); far.dispose(); material.dispose(); otherMaterial.dispose(); }
});
