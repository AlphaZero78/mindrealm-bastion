import { registerHooks } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from '../vendor/three/build/three.module.js';
import { ENTITIES } from '../src/catalog.js';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') {
      return { url: new URL('../vendor/three/build/three.module.js', import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { optimizeModelExport } = await import('./optimize-model-export.mjs');

if (!globalThis.FileReader) {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then(buffer => {
        this.result = buffer;
        this.onloadend?.({ target: this });
      });
    }
  };
}

const [{ GLTFExporter }, { GLTFLoader }, { buildModel }, { createClips }] = await Promise.all([
  import('../vendor/three/examples/jsm/exporters/GLTFExporter.js'),
  import('../vendor/three/examples/jsm/loaders/GLTFLoader.js'),
  import('../src/models.js'),
  import('../src/animations.js'),
]);

const output = new URL('../models/', import.meta.url);
await mkdir(output, { recursive: true });
const manifest = [];
const loader = new GLTFLoader();
const vectorSize = { position: 3, quaternion: 4, scale: 3 };
const round = value => Number(value.toFixed(4));

function snapshot(scene) {
  const states = [];
  scene.traverse(node => states.push({ node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() }));
  return states;
}

function changedNodes(states) {
  const changed = [];
  for (const state of states) {
    const p = state.node.position.distanceTo(state.position);
    const q = 1 - Math.abs(state.node.quaternion.dot(state.quaternion));
    const s = state.node.scale.distanceTo(state.scale);
    if (p + q + s > 0.00003) changed.push(state.node.name);
  }
  return changed;
}

for (const entity of ENTITIES) {
  const { root, joints } = buildModel(entity.id);
  const clips = createClips(entity.id, root, joints);
  optimizeModelExport(root, clips);
  const bounds = new THREE.Box3().setFromObject(root);
  const scene = new THREE.Scene();
  scene.name = `${entity.id}_atelier`;
  scene.add(root);
  scene.animations = clips;
  const exporter = new GLTFExporter();
  const data = await exporter.parseAsync(scene, {
    binary: true, trs: true, onlyVisible: false, animations: clips,
  });
  if (!(data instanceof ArrayBuffer) || data.byteLength < 1000) throw new Error(`${entity.id}: invalid GLB export`);
  const file = new URL(`${entity.id}.glb`, output);
  await writeFile(file, Buffer.from(data));
  const gltf = await loader.parseAsync(data.slice(0), fileURLToPath(file));
  if (gltf.animations.length !== 4) throw new Error(`${entity.id}: expected four embedded animations`);

  let meshes = 0, triangles = 0, vertices = 0;
  const names = new Set();
  gltf.scene.traverse(node => {
    if (node.name) names.add(node.name);
    if (!node.isMesh) return;
    meshes++;
    const geometry = node.geometry;
    if (!geometry.getAttribute('position') || !geometry.getAttribute('normal')) throw new Error(`${entity.id}: missing position or normal`);
    vertices += geometry.getAttribute('position').count;
    triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
    for (const value of geometry.getAttribute('position').array) {
      if (!Number.isFinite(value)) throw new Error(`${entity.id}: non-finite geometry`);
    }
  });
  if (meshes < 15 || triangles < 1800) throw new Error(`${entity.id}: incomplete model assembly`);

  const checkedClips = [];
  for (const clip of gltf.animations) {
    if (clip.duration <= 0 || clip.tracks.length < 9) throw new Error(`${entity.id}/${clip.name}: incomplete animation`);
    for (const track of clip.tracks) {
      const separator = track.name.lastIndexOf('.');
      const target = track.name.slice(0, separator), property = track.name.slice(separator + 1);
      if (!names.has(target)) throw new Error(`${entity.id}/${clip.name}: missing joint ${target}`);
      if (track.getValueSize() !== vectorSize[property]) throw new Error(`${entity.id}/${clip.name}: invalid ${property} track`);
      if (track.times.some((time, index) => !Number.isFinite(time) || (index && time <= track.times[index - 1]))) {
        throw new Error(`${entity.id}/${clip.name}: invalid track time`);
      }
      if ([...track.values].some(value => !Number.isFinite(value))) throw new Error(`${entity.id}/${clip.name}: non-finite keyframe`);
    }
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const action = mixer.clipAction(clip);
    action.play();
    mixer.update(0);
    const before = snapshot(gltf.scene);
    mixer.update(clip.duration * 0.413);
    const moved = changedNodes(before);
    if (moved.length < 2) throw new Error(`${entity.id}/${clip.name}: no articulated motion`);
    action.stop();
    mixer.uncacheRoot(gltf.scene);
    checkedClips.push({
      id: clip.name, duration: round(clip.duration), tracks: clip.tracks.length,
      articulatedNodes: moved.length, once: clip.name === 'shutdown',
    });
  }
  const item = {
    id: entity.id, name: entity.name, kind: entity.kind, file: `${entity.id}.glb`,
    bytes: data.byteLength, meshes, triangles, vertices, joints: Object.keys(joints).length,
    bounds: { min: bounds.min.toArray().map(round), max: bounds.max.toArray().map(round) },
    animations: checkedClips,
    origin: 'Original procedural geometry and joint animation. No stock model parts.',
  };
  manifest.push(item);
  console.log(`${entity.id}: ${triangles.toLocaleString()} triangles, ${meshes} meshes, ${checkedClips.length} clips, ${(data.byteLength / 1024).toFixed(0)} KiB`);
}

await writeFile(new URL('manifest.json', output), JSON.stringify({
  title: '心域防线 · 原创构造观测台', engine: `Three.js r${THREE.REVISION}`, models: manifest,
}, null, 2) + '\n');
console.log(`Built ${manifest.length} original models with ${manifest.reduce((sum, item) => sum + item.animations.length, 0)} validated animation clips.`);
