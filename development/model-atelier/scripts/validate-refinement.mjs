import { registerHooks } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { url: new URL('../vendor/three/build/three.module.js', import.meta.url).href, shortCircuit: true };
    if (specifier.startsWith('three/addons/')) return { url: new URL(`../vendor/three/examples/jsm/${specifier.slice('three/addons/'.length)}`, import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const THREE = await import('../vendor/three/build/three.module.js');
const { annulusGeometry, turnedCylinderGeometry, mergeStaticMeshes, hull, box } = await import('../src/geometry.js');
const { initializeEntityDefinitions, entityDefinitions } = await import('../src/entities/index.js');
const { createGameClips } = await import('../src/animations.js');
await initializeEntityDefinitions();
const idsArgument = process.argv.indexOf('--ids');
const selectedIds = idsArgument < 0 ? null : new Set((process.argv[idsArgument + 1] || '').split(',').filter(Boolean));
if (selectedIds && (!selectedIds.size || [...selectedIds].some(id => !entityDefinitions[id]))) throw new Error('Choose existing entity IDs after --ids');
const definitions = Object.values(entityDefinitions).filter(definition => !selectedIds || selectedIds.has(definition.id));

function bounds(geometry) {
  geometry.computeBoundingBox();
  return geometry.boundingBox;
}

const ring = bounds(annulusGeometry(0.3, 0.16, 0.2, 40));
assert.ok(Math.abs(ring.max.y - 0.1) < 1e-8 && Math.abs(ring.min.y + 0.1) < 1e-8, 'Bearing depth changed');
const ringPositions = ring && annulusGeometry(0.3, 0.16, 0.2, 40).getAttribute('position');
for (let i = 0; i < ringPositions.count; i++) {
  const radius = Math.hypot(ringPositions.getX(i), ringPositions.getZ(i));
  assert.ok(radius >= 0.16 - 1e-7 && radius <= 0.3 + 1e-7, 'Bearing must have a real inner clearance');
}
const cylinder = bounds(turnedCylinderGeometry(0.2, 0.24, 0.5, 40));
assert.ok(Math.abs(cylinder.min.y + 0.25) < 1e-8 && Math.abs(cylinder.max.y - 0.25) < 1e-8, 'Cylinder end positions changed');
assert.ok(cylinder.max.x <= 0.240001 && cylinder.min.x >= -0.240001, 'Cylinder bevel must not inflate its envelope');

function inspectGeometry(root, label, { minMeshes = 15, minTriangles = 1800 } = {}) {
  let triangles = 0, meshes = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const edgeA = new THREE.Vector3(), edgeB = new THREE.Vector3(), face = new THREE.Vector3(), average = new THREE.Vector3();
  root.traverse(node => {
    if (!node.isMesh) return;
    meshes++;
    const geometry = node.geometry;
    const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
    assert.ok(position && normal && geometry.getAttribute('uv'), `${label}/${node.name}: incomplete geometry`);
    for (const attribute of [position, normal]) for (const value of attribute.array) assert.ok(Number.isFinite(value), `${label}/${node.name}: non-finite geometry`);
    const index = geometry.index?.array;
    const count = index?.length ?? position.count;
    triangles += count / 3;
    for (let i = 0; i < count; i += 3) {
      const ia = index ? index[i] : i, ib = index ? index[i + 1] : i + 1, ic = index ? index[i + 2] : i + 2;
      a.fromBufferAttribute(position, ia); b.fromBufferAttribute(position, ib); c.fromBufferAttribute(position, ic);
      face.crossVectors(edgeA.subVectors(b, a), edgeB.subVectors(c, a));
      if (face.lengthSq() < 1e-15) continue;
      average.set(normal.getX(ia) + normal.getX(ib) + normal.getX(ic), normal.getY(ia) + normal.getY(ib) + normal.getY(ic), normal.getZ(ia) + normal.getZ(ib) + normal.getZ(ic));
      assert.ok(average.lengthSq() > 0.001, `${label}/${node.name}: missing surface normal`);
      assert.ok(face.normalize().dot(average.normalize()) > -0.0001, `${label}/${node.name}: reversed face winding`);
    }
  });
  assert.ok(meshes >= minMeshes && triangles >= minTriangles && triangles <= 180000, `${label}: geometry budget ${meshes}/${triangles}`);
  return { meshes, triangles };
}

// Regression for the unfinished end-cap edit: shells must retain their stated
// envelope, outward faces and the same shape for either section direction.
const probeMaterial = new THREE.MeshStandardMaterial();
const probeSections = [{ z: -1, w: 1.2, h: 0.9 }, { z: 0, w: 1.6, h: 1.1 }, { z: 1, w: 0.8, h: 0.6 }];
const forward = hull(new THREE.Group(), 'forward', probeSections, probeMaterial);
const reverse = hull(new THREE.Group(), 'reverse', [...probeSections].reverse(), probeMaterial);
assert.deepEqual(forward.geometry.getAttribute('position').array, reverse.geometry.getAttribute('position').array, 'Section direction must not change the shell');
const shellBounds = bounds(forward.geometry);
assert.ok(Math.abs(shellBounds.min.z + 1) < 1e-7 && Math.abs(shellBounds.max.z - 1) < 1e-7, 'End caps retain their requested depth');
assert.ok(Math.abs(shellBounds.max.x - 0.8) < 1e-7 && Math.abs(shellBounds.max.y - 0.55) < 1e-7, 'Rounded shells retain their stated width and height');
inspectGeometry(forward, 'rounded shell regression', { minMeshes: 1, minTriangles: 1 });
const rounded = box(new THREE.Group(), 'rounded', [2, 1, 0.5], [0, 0, 0], probeMaterial, [0, 0, 0], 0.05);
const normal = rounded.geometry.getAttribute('normal');
const edgeDirections = new Set();
for (let i = 0; i < normal.count; i++) {
  if (Math.abs(normal.getZ(i)) < 1e-6 && normal.getX(i) > 0 && normal.getY(i) > 0) edgeDirections.add(normal.getX(i).toFixed(4));
}
assert.ok(edgeDirections.size >= 3, 'Structural edges have a sampled round bevel rather than a single flat chamfer');
forward.geometry.dispose(); reverse.geometry.dispose(); rounded.geometry.dispose(); probeMaterial.dispose();

function relativeBounds(node, ancestor) {
  rootReference.updateMatrixWorld(true);
  const transform = ancestor.matrixWorld.clone().invert().multiply(node.matrixWorld);
  return bounds(node.geometry).clone().applyMatrix4(transform);
}

let rootReference = null;
const expected = ['idle', 'move', 'attack', 'windup', 'release', 'ability', 'shutdown'];
const records = [], connections = [];
for (const definition of definitions) {
  for (const variant of definition.variants) {
    const label = `${definition.id}/${variant}`;
    const { root, joints } = definition.build(variant);
    rootReference = root;
    root.name = `${definition.id}__${variant}`;
    root.updateMatrixWorld(true);
    const clips = createGameClips(definition.id, root, joints, definition);
    assert.deepEqual(clips.map(clip => clip.name), expected, `${label}: clip contract`);
    const measured = { bulwarkL: Infinity, bulwarkR: Infinity, riveterL: Infinity, riveterR: Infinity };
    for (const clip of clips) {
      const mixer = new THREE.AnimationMixer(root);
      mixer.clipAction(clip).play();
      for (let frame = 0; frame <= 32; frame++) {
        mixer.setTime(clip.duration * frame / 32);
        root.updateMatrixWorld(true);
        root.traverse(node => {
          for (const value of node.matrixWorld.elements) assert.ok(Number.isFinite(value), `${label}/${clip.name}: invalid transform`);
        });
        if (clip.name === 'shutdown') continue;
        if (definition.id === 'anchor_bulwark') {
          for (const [id, key] of [['L', 'bulwarkL'], ['R', 'bulwarkR']]) {
            const rod = joints[`fist${id}`].getObjectByName(`bulwark_ram_rod_${id}`);
            const sleeve = joints[`arm${id}`].getObjectByName(`bulwark_ram_cylinder_${id}`);
            assert.ok(rod && sleeve, `${label}: missing telescoping parts`);
            const insertion = relativeBounds(rod, joints[`arm${id}`]).max.z - relativeBounds(sleeve, joints[`arm${id}`]).min.z;
            measured[key] = Math.min(measured[key], insertion);
          }
        }
        if (definition.id === 'boundary_riveter') {
          for (const [id, key] of [['L', 'riveterL'], ['R', 'riveterR']]) {
            const stem = joints[`hammer${id}`].getObjectByName(`riveter_hammer_stem_${id}`);
            const guide = joints.press.getObjectByName(`riveter_hammer_guide_${id}`);
            assert.ok(stem && guide, `${label}: missing hammer guide`);
            const insertion = relativeBounds(stem, joints.press).max.y - relativeBounds(guide, joints.press).min.y;
            measured[key] = Math.min(measured[key], insertion);
          }
        }
      }
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
    }
    for (const [key, minimum] of Object.entries(measured)) {
      if (!Number.isFinite(minimum)) continue;
      assert.ok(minimum >= 0.01, `${label}/${key}: insufficient operational sleeve engagement ${minimum}`);
      connections.push({ id: definition.id, variant, joint: key, minimumEngagement: minimum, clips: 6, framesPerClip: 33 });
    }
    // Inspect moving parts by their authored names before static draw batching
    // combines them. Then check the actual merged geometry sent to the exporter.
    mergeStaticMeshes(root);
    const geometry = inspectGeometry(root, label);
    records.push({ id: definition.id, variant, group: definition.group, ...geometry, joints: Object.keys(joints).length, clips: clips.length });
    console.log(`${label}: ${geometry.triangles} triangles, ${clips.length} clips, refined geometry checked`);
  }
}
const { buildModel } = await import('../src/models.js');
for (const variant of (!selectedIds || selectedIds.has('arc_mortar') ? entityDefinitions.arc_mortar.variants : [])) {
  const { root, joints, definition } = buildModel('arc_mortar', variant);
  rootReference = root;
  const shafts = joints.cradle.getObjectByName('Resonance_cradle_Machined_edges');
  assert.ok(shafts, `arc_mortar/${variant}: missing trunnion shafts`);
  const shaftBounds = relativeBounds(shafts, joints.cradle);
  const shaftCenter = shaftBounds.getCenter(new THREE.Vector3());
  const clips = createGameClips('arc_mortar', root, joints, definition);
  const measured = { left: Infinity, right: Infinity };
  for (const clip of clips) {
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(clip).play();
    for (let frame = 0; frame <= 32; frame++) {
      mixer.setTime(clip.duration * frame / 32);
      root.updateMatrixWorld(true);
      for (const [side, key] of [[-1, 'left'], [1, 'right']]) {
        const point = joints.yaw.localToWorld(new THREE.Vector3(side * 0.51, 0.39, 0));
        joints.cradle.worldToLocal(point);
        const alignment = Math.hypot(point.y - shaftCenter.y, point.z - shaftCenter.z);
        assert.ok(alignment < 0.002, `arc_mortar/${variant}/${clip.name}: eccentric trunnion ${alignment}`);
        measured[key] = Math.min(measured[key], Math.min(point.x - shaftBounds.min.x, shaftBounds.max.x - point.x));
      }
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
  }
  for (const [side, engagement] of Object.entries(measured)) {
    assert.ok(engagement >= 0.01, `arc_mortar/${variant}/${side}: short trunnion engagement ${engagement}`);
    connections.push({ id: 'arc_mortar', variant, joint: `${side} trunnion`, minimumEngagement: engagement, clips: 7, framesPerClip: 33 });
  }
}
assert.equal(records.length, definitions.reduce((sum, definition) => sum + definition.variants.length, 0), 'Every selected appearance must be checked');
const expectedConnections = ['anchor_bulwark', 'boundary_riveter', 'arc_mortar']
  .filter(id => !selectedIds || selectedIds.has(id)).reduce((sum, id) => sum + entityDefinitions[id].variants.length * 2, 0);
assert.equal(connections.length, expectedConnections, 'Both measured connections in each selected variant must be checked');
await mkdir(new URL('../qa/refinement/', import.meta.url), { recursive: true });
await writeFile(new URL('../qa/refinement/geometry.json', import.meta.url), JSON.stringify({
  scope: 'Source geometry normals, finite articulated transforms, and explicit operational sleeve engagement. This is not a claim of arbitrary collision detection.',
  selection: selectedIds ? [...selectedIds] : 'all',
  appearances: records.length,
  clips: records.reduce((sum, record) => sum + record.clips, 0),
  records,
  connections,
}, null, 2) + '\n');
console.log(`Refinement validation passed for ${records.length} appearances and ${connections.length} measured telescoping connections.`);
