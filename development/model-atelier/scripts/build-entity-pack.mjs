import { registerHooks } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from '../vendor/three/build/three.module.js';
import { entityDefinitions, initializeEntityDefinitions } from '../src/entities/index.js';
import { loadGameplayContract, gameplayRole } from './gameplay-contract.mjs';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { url: new URL('../vendor/three/build/three.module.js', import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { optimizeModelExport } = await import('./optimize-model-export.mjs');
if (!globalThis.FileReader) {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then(buffer => { this.result = buffer; this.onloadend?.({ target: this }); });
    }
  };
}
const [{ GLTFExporter }, { GLTFLoader }, { buildModel }, { createGameClips }] = await Promise.all([
  import('../vendor/three/examples/jsm/exporters/GLTFExporter.js'),
  import('../vendor/three/examples/jsm/loaders/GLTFLoader.js'),
  import('../src/models.js'),
  import('../src/animations.js'),
]);

await initializeEntityDefinitions();
const definitions = Object.values(entityDefinitions);
if (!definitions.length) throw new Error('No registered entities');
const gameplay = await loadGameplayContract(definitions.map(definition => definition.id));
const output = new URL('../release/mindrealm-entity-pack/game/', import.meta.url);
const modelRoot = new URL('assets/game/models/', output);
await mkdir(modelRoot, { recursive: true });
const expectedClips = ['idle', 'move', 'attack', 'windup', 'release', 'ability', 'shutdown'];
const loader = new GLTFLoader();
const entities = {};
const catalog = [];
const files = [];
let variantCount = 0;
let clipCount = 0;
let triangleCount = 0;
let byteCount = 0;

for (const definition of definitions) {
  const variants = {};
  const records = [];
  for (const variant of definition.variants) {
    const { root, joints } = buildModel(definition.id, variant);
    const clips = createGameClips(definition.id, root, joints, definition);
    if (clips.map(clip => clip.name).join(',') !== expectedClips.join(',')) throw new Error(`${definition.id}/${variant}: invalid clip contract`);
    const optimization = optimizeModelExport(root, clips);
    const scene = new THREE.Scene();
    scene.name = `${definition.id}__${variant}`;
    scene.add(root);
    const data = await new GLTFExporter().parseAsync(scene, { binary: true, trs: true, onlyVisible: false, animations: clips });
    if (!(data instanceof ArrayBuffer) || data.readUInt32LE) throw new Error(`${definition.id}/${variant}: invalid export`);
    const buffer = Buffer.from(data);
    if (buffer.readUInt32LE(0) !== 0x46546c67 || buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length) throw new Error(`${definition.id}/${variant}: invalid GLB`);
    const file = new URL(`${definition.id}/${variant}.glb`, modelRoot);
    await mkdir(new URL(`${definition.id}/`, modelRoot), { recursive: true });
    await writeFile(file, buffer);
    const gltf = await loader.parseAsync(data.slice(0), fileURLToPath(file));
    const nodeNames = new Set();
    let meshes = 0, triangles = 0;
    gltf.scene.traverse(node => {
      if (node.name) nodeNames.add(node.name);
      if (!node.isMesh) return;
      meshes++;
      const geometry = node.geometry;
      for (const key of ['position', 'normal', 'uv']) if (!geometry.getAttribute(key)) throw new Error(`${definition.id}/${variant}: missing ${key}`);
      for (const value of geometry.getAttribute('position').array) if (!Number.isFinite(value)) throw new Error(`${definition.id}/${variant}: invalid geometry`);
      triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
    });
    if (gltf.animations.length !== expectedClips.length) throw new Error(`${definition.id}/${variant}: missing animation`);
    for (const clip of gltf.animations) {
      for (const track of clip.tracks) {
        const name = track.name.slice(0, track.name.lastIndexOf('.'));
        if (!nodeNames.has(name)) throw new Error(`${definition.id}/${variant}/${clip.name}: missing animated node ${name}`);
        if ([...track.values].some(value => !Number.isFinite(value))) throw new Error(`${definition.id}/${variant}/${clip.name}: invalid track`);
      }
      const mixer = new THREE.AnimationMixer(gltf.scene);
      const action = mixer.clipAction(clip);
      action.play();
      mixer.update(0);
      const before = [];
      gltf.scene.traverse(node => before.push({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
      mixer.update(clip.duration * 0.413);
      const changed = before.filter(({ node, p, q, s }) => node.position.distanceTo(p) + (1 - Math.abs(node.quaternion.dot(q))) + node.scale.distanceTo(s) > 0.00003);
      if (changed.length < 2) throw new Error(`${definition.id}/${variant}/${clip.name}: insufficient motion`);
      mixer.stopAllAction();
      mixer.uncacheRoot(gltf.scene);
    }
    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    const size = bounds.getSize(new THREE.Vector3());
    variants[variant] = {
      source: `models/${definition.id}/${variant}.glb`,
      clips: Object.fromEntries(expectedClips.map(name => [name, name])),
    };
    records.push({ variant, bytes: buffer.length, meshes, triangles, joints: Object.keys(joints).length, optimization, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, animations: clips.map(clip => ({ name: clip.name, duration: clip.duration, tracks: clip.tracks.length })) });
    files.push(`/assets/game/models/${definition.id}/${variant}.glb`);
    variantCount++;
    clipCount += gltf.animations.length;
    triangleCount += triangles;
    byteCount += buffer.length;
    console.log(`${definition.id}/${variant}: ${triangles.toLocaleString()} triangles, ${clips.length} clips, ${(buffer.length / 1024).toFixed(0)} KiB`);
  }
  const size = records[0].bounds.max.map((value, index) => value - records[0].bounds.min[index]);
  entities[definition.id] = {
    kind: definition.kind === 'monster' ? 'enemies' : 'towers', role: gameplayRole(definition, gameplay), locomotion: definition.locomotion,
    bounds: { x: size[0], y: size[1], z: size[2] }, variants,
  };
  catalog.push({ ...definition, variants: records });
}

const modelManifest = {
  format: 2,
  source: 'Original procedural geometry and articulated animations. No stock model parts.',
  entities,
};
const packManifest = {
  format: 2,
  counts: { entities: definitions.length, variants: variantCount, clips: clipCount, triangles: triangleCount, bytes: byteCount },
  entities: catalog,
  files,
};
await writeFile(new URL('models.json', modelRoot), JSON.stringify(modelManifest, null, 2) + '\n');
await writeFile(new URL('catalog.json', modelRoot), JSON.stringify(packManifest, null, 2) + '\n');
await writeFile(new URL('build-manifest.json', modelRoot), JSON.stringify({ ...packManifest, entities: catalog.map(({ build, clips, ...definition }) => definition) }, null, 2) + '\n');
console.log(`Built ${definitions.length} entities, ${variantCount} variants, ${clipCount} animation clips, ${(byteCount / 1048576).toFixed(1)} MiB.`);
