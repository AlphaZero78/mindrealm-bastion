import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from '../vendor/three/build/three.module.js';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { url: new URL('../vendor/three/build/three.module.js', import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { mergeStaticMeshes } = await import('../src/geometry.js');
const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/validate-entity-group.mjs src/entities/<group>.js');
const { entities } = await import(pathToFileURL(resolve(file)).href);
if (!Array.isArray(entities) || !entities.length) throw new Error('No entity definitions found');
const expected = ['idle', 'move', 'attack', 'windup', 'release', 'ability', 'shutdown'];
const ids = new Set();
let variantsChecked = 0;
for (const definition of entities) {
  if (ids.has(definition.id)) throw new Error(`Duplicate entity ${definition.id}`);
  ids.add(definition.id);
  for (const variant of definition.variants) {
    const { root, joints } = definition.build(variant);
    root.name = `${definition.id}__${variant}`;
    mergeStaticMeshes(root);
    root.updateMatrixWorld(true);
    const names = new Set();
    let meshes = 0, triangles = 0;
    root.traverse(node => {
      if (node.name) {
        if (names.has(node.name)) throw new Error(`${definition.id}/${variant}: duplicate node ${node.name}`);
        names.add(node.name);
      }
      if (!node.isMesh) return;
      meshes++;
      const geometry = node.geometry;
      for (const key of ['position', 'normal', 'uv']) if (!geometry.getAttribute(key)) throw new Error(`${definition.id}/${variant}: missing ${key}`);
      for (const value of geometry.getAttribute('position').array) if (!Number.isFinite(value)) throw new Error(`${definition.id}/${variant}: invalid vertex`);
      triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
    });
    if (meshes < 15 || triangles < 1800 || triangles > 180000) throw new Error(`${definition.id}/${variant}: geometry budget ${meshes} meshes ${triangles} triangles`);
    if (Object.keys(joints).length < 3) throw new Error(`${definition.id}/${variant}: insufficient joints`);
    for (const key of Object.keys(joints)) if (!root.getObjectByName(joints[key].name)) throw new Error(`${definition.id}/${variant}: missing joint ${key}`);
    const clips = definition.clips(root, joints);
    if (clips.length !== expected.length || clips.map(clip => clip.name).join(',') !== expected.join(',')) throw new Error(`${definition.id}/${variant}: expected ${expected.join(',')}`);
    for (const clip of clips) {
      if (clip.duration < 0.4 || clip.duration > 8) throw new Error(`${definition.id}/${variant}/${clip.name}: invalid duration`);
      for (const track of clip.tracks) {
        if (!names.has(track.name.slice(0, track.name.lastIndexOf('.')))) throw new Error(`${definition.id}/${variant}/${clip.name}: missing animated node`);
        if ([...track.values].some(value => !Number.isFinite(value))) throw new Error(`${definition.id}/${variant}/${clip.name}: invalid keyframe`);
      }
      const mixer = new THREE.AnimationMixer(root);
      const action = mixer.clipAction(clip);
      action.play();
      mixer.update(0);
      const before = [];
      root.traverse(node => before.push({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
      mixer.update(clip.duration * 0.413);
      const changed = before.filter(({ node, p, q, s }) => node.position.distanceTo(p) + (1 - Math.abs(node.quaternion.dot(q))) + node.scale.distanceTo(s) > 0.00003);
      if (changed.length < 2) throw new Error(`${definition.id}/${variant}/${clip.name}: insufficient articulated motion`);
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
    }
    variantsChecked++;
    console.log(`${definition.id}/${variant}: ${triangles.toLocaleString()} triangles, ${meshes} meshes, ${Object.keys(joints).length} joints, ${clips.length} clips`);
  }
}
console.log(`Validated ${ids.size} entities, ${variantsChecked} variants from ${file}`);
