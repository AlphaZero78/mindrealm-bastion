import { registerHooks } from 'node:module';
import assert from 'node:assert/strict';
import http from 'node:http';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { url: new URL('../vendor/three/build/three.module.js', import.meta.url).href, shortCircuit: true };
    if (specifier.startsWith('three/addons/')) {
      return { url: new URL(`../vendor/three/examples/jsm/${specifier.slice('three/addons/'.length)}`, import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PACK = path.join(ROOT, 'release', 'mindrealm-entity-pack');
const args = process.argv.slice(2);
const exists = async file => access(file).then(() => true, () => false);
const runtime = await import('../src/runtime/index.js');
const { GLTFLoader } = await import('../vendor/three/examples/jsm/loaders/GLTFLoader.js');
const THREE = await import('../vendor/three/build/three.module.js');
const { buildTrackingDroneGLB } = await import('../src/runtime/authoring/tracking-drone-model.js');
const {
  loadEntityManifest,
  normalizeEntityManifest,
  resolveEntityModelURL,
  loadEntityModel,
  instantiateEntityModel,
  createEntityMixer,
  mergeEntityRigidMeshes,
  validateEntityBindings,
  createInstancedGeometry,
  createEntityLodGeometry,
  entityTriangleCount,
  EntityBatchPool,
  measureEntityBounds,
} = runtime;

async function createFixture() {
  const atelier = JSON.parse(await readFile(path.join(ROOT, 'models', 'manifest.json'), 'utf8'));
  const entities = {};
  for (const item of atelier.models) {
    const variant = item.kind === 'monster' ? 'base' : 'T1';
    entities[item.id] = {
      kind: item.kind === 'monster' ? 'enemies' : 'towers',
      role: 'normal',
      forward: '-z',
      variants: { [variant]: { source: `models/${item.id}/${variant}.glb` } },
    };
  }
  return { format: 2, sample: true, entities };
}

class BufferLoader extends GLTFLoader {
  constructor(resolve) {
    super();
    this.resolve = resolve;
  }

  async loadAsync(url) {
    const data = await this.resolve(url);
    const buffer = data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    return this.parseAsync(buffer.slice(0), '');
  }
}

function matrices(root) {
  root.updateMatrixWorld(true);
  const values = [];
  root.traverse(node => values.push(...node.matrix.elements));
  return values;
}

function firstMaterial(root) {
  let result = null;
  root.traverse(node => {
    if (!result && node.isMesh) result = Array.isArray(node.material) ? node.material[0] : node.material;
  });
  return result;
}

async function validateNode() {
  const fixture = await createFixture();
  const manifest = await loadEntityManifest('/assets/game/models/models.json', {
    fetchImpl: async () => new Response(JSON.stringify(fixture), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  });
  assert.equal(manifest.format, 2);
  assert.equal(Object.keys(manifest.entities).length, 7);
  assert.equal(manifest.entities.tracking_drone.variants.base.source, 'models/tracking_drone/base.glb');
  assert.equal(resolveEntityModelURL('models/memory_runner/base.glb'), '/assets/game/models/memory_runner/base.glb');
  assert.throws(() => normalizeEntityManifest({ format: 1, entities: {} }), /format:2/);
  assert.throws(() => normalizeEntityManifest({ format: 2, entities: { bad: { variants: { T1: { source: '../secret.glb' } } } } }), /模型路径/);
  assert.throws(() => resolveEntityModelURL('https://example.com/model.glb'), /不安全/);
  await assert.rejects(() => loadEntityManifest('/missing.json', { fetchImpl: async () => new Response('', { status: 404 }) }), /404/);

  const droneData = await buildTrackingDroneGLB();
  const requests = [];
  const loader = new BufferLoader(async url => {
    requests.push(url);
    const match = /^\/assets\/game\/models\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\.glb$/.exec(url);
    assert.ok(match, `unexpected model URL ${url}`);
    if (match[1] === 'tracking_drone') return droneData.slice(0);
    assert.ok(fixture.entities[match[1]], `unknown sample entity ${match[1]}`);
    return readFile(path.join(ROOT, 'models', `${match[1]}.glb`));
  });
  const assets = new Map();
  for (const [id, definition] of Object.entries(manifest.entities)) {
    for (const [variant, entry] of Object.entries(definition.variants)) {
      const asset = await loadEntityModel(entry, { loader, label: `${id}/${variant}` });
      assets.set(id, asset);
      assert.ok(asset.meshCount > 0);
      assert.equal(asset.meshCount, asset.mergeStats.after);
      assert.ok(asset.mergeStats.before >= asset.mergeStats.after);
      assert.equal(asset.animationSet, id === 'tracking_drone' ? 'whole-7' : 'legacy-4');
    }
  }
  assert.ok([...assets.values()].some(asset => asset.mergeStats.after < asset.mergeStats.before));
  assert.equal(assets.size, 7);
  assert.equal(requests.length, 7);
  let invalidResourceDisposed = false;
  const invalidLoader = new BufferLoader(async () => readFile(path.join(ROOT, 'models', 'memory_runner.glb')));
  const loadInvalid = invalidLoader.loadAsync.bind(invalidLoader);
  invalidLoader.loadAsync = async url => {
    const gltf = await loadInvalid(url);
    gltf.animations = [];
    gltf.scene.traverse(node => {
      if (node.isMesh) node.geometry.addEventListener('dispose', () => { invalidResourceDisposed = true; });
    });
    return gltf;
  };
  await assert.rejects(() => loadEntityModel({ source: 'models/memory_runner/base.glb' }, { loader: invalidLoader }), /七段/);
  assert.equal(invalidResourceDisposed, true, 'invalid GLB resources must be disposed');

  const memory = assets.get('memory_runner');
  const first = instantiateEntityModel(memory);
  const second = instantiateEntityModel(memory);
  assert.notEqual(first.root, second.root);
  assert.equal(first.sources.size, first.meshCount);
  assert.notEqual(firstMaterial(first.root), firstMaterial(second.root));
  firstMaterial(first.root).color.setRGB(0.01, 0.02, 0.03);
  assert.notEqual(firstMaterial(second.root).color.r, 0.01);

  const outer = new THREE.Group();
  outer.position.set(4, 7, 9);
  outer.add(first.root);
  const controller = createEntityMixer(first.root, memory.animations);
  let updates = 0;
  const update = controller.mixer.update.bind(controller.mixer);
  controller.mixer.update = delta => { assert.equal(delta, 0); updates++; return update(delta); };
  const idle = { key: 'unit:test', action: 'idle', clock: 1000, progress: 0, facing: 0 };
  let sample = controller.sample(idle);
  assert.equal(sample.clip, 'idle');
  const paused = matrices(first.root);
  const pausedUpdates = updates;
  controller.sample(idle);
  assert.deepEqual(matrices(first.root), paused);
  assert.equal(updates, pausedUpdates, 'identical paused pose must not update the mixer');
  controller.sample({ ...idle, clock: 1125 });
  assert.notDeepEqual(matrices(first.root), paused);

  sample = controller.sample({ ...idle, action: 'move', travel: 0.375 });
  assert.equal(sample.clip, 'idle');
  assert.ok(Math.abs(sample.time - 0.3) < 1e-5, JSON.stringify(sample));
  sample = controller.sample({ ...idle, action: 'attack', progress: 0.4 });
  assert.equal(sample.clip, 'attack');
  assert.ok(Math.abs(sample.time - 0.56) < 1e-5);
  sample = controller.sample({ ...idle, action: 'cast', stage: 'windup', progress: 1 });
  assert.equal(sample.clip, 'ability');
  assert.equal(sample.time, memory.clips.get('ability').duration);
  assert.equal(sample.hold, true);
  sample = controller.sample({ ...idle, action: 'cast', stage: 'release', progress: 0.25 });
  assert.equal(sample.clip, 'ability');
  assert.ok(Math.abs(sample.time - 0.45) < 1e-5);
  for (const action of ['disabled', 'wreck', 'death']) {
    sample = controller.sample({ ...idle, action, progress: 0 });
    assert.equal(sample.clip, 'shutdown');
    assert.equal(sample.time, memory.clips.get('shutdown').duration);
    assert.equal(sample.hold, true);
  }
  assert.deepEqual(outer.position.toArray(), [4, 7, 9]);

  controller.sample({ ...idle, clock: 5000 });
  sample = controller.sample({ ...idle, clock: 900 });
  assert.equal(sample.rewind, true);
  const rewound = matrices(first.root);
  const fresh = createEntityMixer(second.root, memory.animations);
  fresh.sample({ ...idle, clock: 900 });
  assert.deepEqual(matrices(second.root), rewound, 'clock rollback must match a fresh absolute sample');
  fresh.dispose();
  controller.dispose();
  first.dispose();
  second.dispose();

  const drone = assets.get('tracking_drone');
  const droneInstance = instantiateEntityModel(drone);
  const droneMixer = createEntityMixer(droneInstance.root, drone.animations, { stride: 0.8 });
  sample = droneMixer.sample({ action: 'move', clock: 1000, travel: 0.2, progress: 0 });
  assert.equal(sample.clip, 'move');
  assert.ok(Math.abs(sample.time - 0.225) < 1e-5);
  assert.equal(droneMixer.sample({ action: 'move', clock: 1000, travel: 0.2 }, { reducedMotion: true }).time, 0);
  assert.equal(droneMixer.sample({ action: 'cast', stage: 'windup', progress: 1, clock: 1000 }).clip, 'windup');
  const held = matrices(droneInstance.root);
  droneMixer.sample({ action: 'cast', stage: 'windup', progress: 1, clock: 1000 });
  assert.deepEqual(matrices(droneInstance.root), held);
  assert.equal(droneMixer.sample({ action: 'cast', stage: 'release', progress: 0.5, clock: 1400 }).clip, 'release');
  droneMixer.dispose();
  droneInstance.dispose();

  const rigidScene = new THREE.Scene();
  const rigidJoint = new THREE.Group();
  rigidJoint.name = 'Rigid_joint';
  rigidScene.add(rigidJoint);
  const rigidMaterial = new THREE.MeshStandardMaterial();
  for (let index = 0; index < 2; index++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), rigidMaterial);
    mesh.position.x = index + 1;
    rigidJoint.add(mesh);
  }
  const rigidBounds = measureEntityBounds(rigidScene);
  const rigidClips = [new THREE.AnimationClip('idle', 1, [new THREE.VectorKeyframeTrack('Rigid_joint.position', [0, 1], [0, 0, 0, 1, 0, 0])])];
  const mergeStats = mergeEntityRigidMeshes(rigidScene, rigidClips);
  assert.equal(mergeStats.before, 2);
  assert.equal(mergeStats.after, 1);
  validateEntityBindings(rigidScene, rigidClips);
  const mergedBounds = measureEntityBounds(rigidScene);
  for (const key of ['min', 'max']) for (let index = 0; index < 3; index++) {
    assert.ok(Math.abs(rigidBounds[key][index] - mergedBounds[key][index]) < 1e-6);
  }
  let mergedMesh = null;
  rigidScene.traverse(node => { if (node.isMesh) mergedMesh = node; });
  const instancedGeometry = createInstancedGeometry(mergedMesh.geometry, 2);
  assert.equal(instancedGeometry.getAttribute('position'), mergedMesh.geometry.getAttribute('position'));
  const batchScene = new THREE.Scene();
  const pool = new EntityBatchPool(batchScene, { capacity: 2 });
  const batchSource = { geometry: mergedMesh.geometry, materials: [rigidMaterial] };
  pool.begin();
  pool.add(batchSource, new THREE.Matrix4().makeTranslation(1, 2, 3), { alpha: 1, brightness: 1, transparent: false, owner: 'a' });
  pool.add(batchSource, new THREE.Matrix4().makeTranslation(4, 5, 6), { alpha: 0.6, brightness: 1.6, transparent: false, owner: 'b' });
  pool.add(batchSource, new THREE.Matrix4().makeTranslation(7, 8, 9), { alpha: 0.2, brightness: 0.8, transparent: false, owner: 'c' });
  assert.equal(pool.flush(), 3);
  assert.equal(pool.batches.size, 1);
  const batch = pool.batches.values().next().value;
  const color = new THREE.Vector4(), matrix = new THREE.Matrix4();
  assert.equal(batch.mesh.isBatchedMesh, true);
  assert.equal(batch.capacity, 4);
  assert.equal(batch.count, 3);
  assert.ok(Math.abs(batch.mesh.getColorAt(1, color).w - 0.6) < 1e-6);
  assert.ok(Math.abs(color.x - 1.6) < 1e-6);
  batch.mesh.getMatrixAt(0, matrix);
  assert.deepEqual(matrix.toArray(), new THREE.Matrix4().makeTranslation(1, 2, 3).toArray());
  assert.deepEqual(Array.from(batch.mesh.geometry.getAttribute('position').array.slice(0, 24)), Array.from(mergedMesh.geometry.getAttribute('position').array.slice(0, 24)));
  pool.begin();
  assert.equal(pool.flush(), 0);
  assert.equal(batch.mesh.getVisibleAt(0), false);
  const otherGeometry = mergedMesh.geometry.clone();
  const otherMaterial = rigidMaterial.clone();
  pool.add({ geometry: otherGeometry, materials: [otherMaterial] }, new THREE.Matrix4().makeTranslation(10, 11, 12), { alpha: 0.4, brightness: 1.2, transparent: false, owner: 'c' });
  assert.equal(pool.batches.size, 1, 'identical material parameters must share a material batch');
  assert.equal(batch.geometries.size, 2);
  assert.equal(batch.mesh.getVisibleAt(1), false, 'recycling a deleted slot must not revive a hidden part');
  const recycled = batch.slots.get('c:');
  assert.equal(batch.mesh.getGeometryIdAt(recycled.id), batch.geometries.get(otherGeometry.uuid).id);
  batch.mesh.getColorAt(recycled.id, color);
  assert.ok(Math.abs(color.w - 0.4) < 1e-6 && Math.abs(color.x - 1.2) < 1e-6);
  pool.add(batchSource, new THREE.Matrix4().makeTranslation(1, 2, 3), { alpha: 1, brightness: 1, transparent: false, owner: 'a' });
  pool.remove('a');
  assert.equal(pool.flush(), 1);
  assert.equal(pool.owners.has('a:'), false);
  assert.equal(batch.slots.size, 2, 'the hidden, still-live b instance retains its slot');
  assert.equal([...batch.slots.values()].filter(slot => batch.mesh.getVisibleAt(slot.id)).length, 1);
  pool.add(batchSource, new THREE.Matrix4().makeTranslation(1, 2, 3), { alpha: 1, brightness: 1, transparent: false, owner: 'a' });
  assert.equal(batch.slots.size, 3);
  pool.remove('b');
  pool.add(batchSource, new THREE.Matrix4().makeTranslation(20, 21, 22), { alpha: 1, brightness: 1, transparent: false, owner: 'd' });
  pool.add(batchSource, new THREE.Matrix4().makeTranslation(30, 31, 32), { alpha: 1, brightness: 1, transparent: false, owner: 'e' });
  pool.add(batchSource, new THREE.Matrix4().makeTranslation(40, 41, 42), { alpha: 1, brightness: 1, transparent: false, owner: 'f' });
  assert.equal(batch.capacity, 8, 'adding after deletion must grow without losing slot identity');
  for (const [owner, position] of [['a', [1, 2, 3]], ['c', [10, 11, 12]], ['d', [20, 21, 22]], ['e', [30, 31, 32]], ['f', [40, 41, 42]]]) {
    const slot = pool.owners.get(`${owner}:`).slot;
    batch.mesh.getMatrixAt(slot.id, matrix);
    assert.deepEqual(matrix.elements.slice(12, 15), position, `${owner} matrix must survive a sparse-slot rebuild`);
  }
  batch.mesh.getColorAt(pool.owners.get('c:').slot.id, color);
  assert.ok(Math.abs(color.x - 1.2) < 1e-6 && Math.abs(color.w - 0.4) < 1e-6);
  const extraScene = new THREE.Scene();
  extraScene.add(new THREE.Mesh(otherGeometry, otherMaterial));
  pool.prepare(new Map([['extra', { scene: extraScene, lodGeometries: new Map() }]]));
  pool.begin();
  pool.add(batchSource, new THREE.Matrix4().makeTranslation(1, 2, 3), { alpha: 1, brightness: 1, transparent: false, owner: 'a' });
  pool.add(batchSource, new THREE.Matrix4().makeTranslation(10, 11, 12), { alpha: 0.4, brightness: 1.2, transparent: false, owner: 'c' });
  assert.equal(pool.flush(), 2);
  pool.dispose();
  otherGeometry.dispose();
  otherMaterial.dispose();
  assert.equal(pool.batches.size, 0);
  const preparedPool = new EntityBatchPool(batchScene);
  preparedPool.prepare(new Map([['rigid', { scene: rigidScene, lodGeometries: new Map() }]]));
  assert.equal(preparedPool.batches.size, 4, 'near/far and opaque/transparent capacities must be reserved');
  preparedPool.begin();
  preparedPool.add(batchSource, new THREE.Matrix4(), { alpha: 1, brightness: 1, transparent: false, owner: 'prepared' });
  const preparedBatch = [...preparedPool.batches.values()].find(item => item.count);
  assert.equal(preparedBatch.geometries.size, 1);
  assert.ok(preparedBatch.vertexCapacity >= mergedMesh.geometry.getAttribute('position').count);
  const preparedMesh = preparedBatch.mesh;
  const preparedCapacity = preparedBatch.vertexCapacity;
  preparedPool.prepare(new Map([['rigid', { scene: rigidScene, lodGeometries: new Map() }]]));
  assert.equal(preparedBatch.mesh, preparedMesh, 'repeated preparation must not rebuild live batches');
  assert.equal(preparedBatch.vertexCapacity, preparedCapacity);
  assert.equal(preparedBatch.mesh.getVisibleAt(preparedBatch.slots.get('prepared:').id), true);
  preparedPool.begin();
  preparedPool.add(batchSource, new THREE.Matrix4().makeTranslation(2, 3, 4), { alpha: 1, brightness: 1, transparent: false, owner: 'prepared' });
  assert.equal(preparedBatch.mesh.getMatrixAt(preparedBatch.slots.get('prepared:').id, matrix).elements[12], 2);
  preparedPool.dispose();
  mergedMesh.geometry.dispose();
  rigidMaterial.dispose();

  const skinRoot = new THREE.Group();
  const bone = new THREE.Bone();
  bone.name = 'Validation_bone';
  const skinGeometry = new THREE.BufferGeometry();
  skinGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  skinGeometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4));
  skinGeometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const skinMaterial = new THREE.MeshBasicMaterial();
  const skinned = new THREE.SkinnedMesh(skinGeometry, skinMaterial);
  const sourceSkeleton = new THREE.Skeleton([bone]);
  skinned.add(bone);
  skinRoot.add(skinned);
  skinRoot.updateMatrixWorld(true);
  skinned.bind(sourceSkeleton);
  const skinMerge = mergeEntityRigidMeshes(skinRoot, []);
  assert.equal(skinMerge.before, 1);
  assert.equal(skinMerge.after, 1);
  const skinInstance = instantiateEntityModel({ scene: skinRoot, animations: [] });
  let clonedSkin = null;
  skinInstance.root.traverse(node => { if (node.isSkinnedMesh) clonedSkin = node; });
  assert.equal(skinInstance.sources.size, 1);
  assert.equal(skinInstance.sources.get(clonedSkin).skinned, true);
  assert.notEqual(clonedSkin.skeleton, sourceSkeleton);
  assert.notEqual(clonedSkin.skeleton.bones[0], bone);
  clonedSkin.skeleton.computeBoneTexture();
  let boneTextureDisposed = false;
  clonedSkin.skeleton.boneTexture.addEventListener('dispose', () => { boneTextureDisposed = true; });
  skinInstance.dispose();
  assert.equal(boneTextureDisposed, true);
  sourceSkeleton.dispose();
  skinGeometry.dispose();
  skinMaterial.dispose();
  for (const asset of assets.values()) asset.dispose();

  console.log('PASS manifest format/security and seven real GLB loads (six legacy-4, one whole-7).');
  console.log('PASS independent SkeletonUtils clones/materials, absolute pose sampling, pause, rewind, final poses and disposal.');
  console.log('PASS rigid merge, material batching, real joint matrices/RGBA, slot reuse, prepared capacity and skin preservation.');
}

async function filesUnder(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(file));
    else output.push(file);
  }
  return output;
}

async function validateRelease() {
  const manifestFile = path.join(PACK, 'game', 'assets', 'game', 'models', 'models.json');
  assert.ok(await exists(manifestFile), 'release pack missing; run node scripts/package-release.mjs first');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  normalizeEntityManifest(manifest);
  for (const definition of Object.values(manifest.entities)) {
    for (const entry of Object.values(definition.variants)) {
      const file = path.join(PACK, 'game', 'assets', 'game', 'models', entry.source.slice('models/'.length));
      assert.ok((await stat(file)).size > 1000, file);
    }
  }
  assert.ok((await stat(path.join(PACK, 'game', 'assets', 'game', 'models', 'tracking_drone', 'base.glb'))).size > 1000);
  const files = await filesUnder(path.join(PACK, 'game'));
  const battlefieldHostImports = new Set(['../core/content.js', '../core/rules.js', '../core/difficulty.js', './display-settings.js', './entity-motion.js']);
  for (const file of files.filter(file => file.endsWith('.js'))) {
    const source = await readFile(file, 'utf8');
    assert.ok(!/(?:from\s*|import\s*\(\s*)['"]three(?:\/addons\/)?/.test(source), `bare import remains in ${file}`);
    for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*)(['"])(\.[^'"]+)\1/g)) {
      if (file === path.join(PACK, 'game', 'web', 'view', 'battlefield.js') && battlefieldHostImports.has(match[2])) continue;
      const resolved = path.resolve(path.dirname(file), match[2]);
      assert.ok(await exists(resolved), `${file}: missing ${match[2]}`);
    }
  }
  const packed = await import(pathToFileURL(path.join(PACK, 'game', 'web', 'view', 'whole-entity-runtime.js')).href);
  assert.equal(typeof packed.default, 'function');
  assert.equal(typeof packed.loadEntityManifest, 'function');
  assert.equal(typeof packed.loadEntityModel, 'function');
  assert.equal(typeof packed.createEntityMixer, 'function');
  const entry = await import(pathToFileURL(path.join(PACK, 'game', 'web', 'view', 'entity-renderer.js')).href);
  assert.equal(entry.EntityRenderer, entry.default);
  if (args.includes('--all-models')) {
    const bundle = await import(pathToFileURL(path.join(PACK, 'game', 'assets', 'third_party', 'three', 'three.bundle.js')).href);
    const gltfLoader = new bundle.GLTFLoader();
    const loader = {
      async loadAsync(url) {
        const data = await readFile(path.join(PACK, 'game', url.replace(/^\/+/, '')));
        return gltfLoader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
      },
    };
    const loadModel = args.includes('--source-models') ? runtime.loadEntityModel : packed.loadEntityModel;
    let variants = 0;
    let legacy = 0;
    let whole = 0;
    let mergedBefore = 0;
    let mergedAfter = 0;
    for (const [id, definition] of Object.entries(normalizeEntityManifest(manifest).entities)) {
      for (const [variant, model] of Object.entries(definition.variants)) {
        const asset = await loadModel(model, { loader, label: `${id}/${variant}` });
        assert.ok(asset.meshCount > 0);
        if (asset.animationSet === 'whole-7') whole++;
        else legacy++;
        variants++;
        mergedBefore += asset.mergeStats?.before || 0;
        mergedAfter += asset.mergeStats?.after || 0;
        asset.dispose();
      }
    }
    console.log(`PASS parsed every packed GLB: ${variants} variants (${whole} whole-7, ${legacy} legacy-4), including tracking_drone.${args.includes('--source-models') ? ` Source rigid merge ${mergedBefore} -> ${mergedAfter} meshes.` : ''}`);
  }
  console.log(`PASS offline release imports/resources (${Object.keys(manifest.entities).length} manifest entities${manifest.sample ? ', SAMPLE ONLY' : ''}).`);
}

function smokePage() {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>WholeEntityRenderer sample smoke</title>
<style>body{margin:0;background:#0b151a;color:#d8eee8;font:14px monospace}main{padding:18px}canvas{display:block;width:900px;height:600px;max-width:100%;background:linear-gradient(#14272d,#0a1216);border:1px solid #426a67}pre{white-space:pre-wrap;color:#9edcc9}.error{color:#ff9b8f}</style></head>
<body><main><h1>WholeEntityRenderer · six-model sample + tracking_drone</h1><p>本页只验证运行时样例，不代表完整游戏阵容已替换。</p><canvas id="view" width="900" height="600"></canvas><pre id="result">loading…</pre></main>
<script type="module">
import WholeEntityRenderer from '/web/view/whole-entity-runtime.js';
import * as THREE from '/assets/third_party/three/three.bundle.js';
const output=document.querySelector('#result');
const canvas=document.querySelector('#view');
const renderer=new WholeEntityRenderer({canvas,onError:message=>{output.textContent=message;output.className='error';}});
window.runtimeRenderer=renderer;
window.smokeError=null;
const poses={
 memory_runner:{action:'attack',progress:.55,clock:1200,hit:.35},
 repair_skiff:{action:'move',progress:.25,clock:1200,travel:.4},
 null_wing:{action:'cast',stage:'windup',progress:.8,clock:1200},
 focus_rail:{action:'cast',stage:'release',progress:.4,clock:1200},
 arc_mortar:{action:'idle',progress:0,clock:1200},
 resistance_beacon:{action:'ability',progress:.55,clock:1200}
};
function variant(type){return Object.keys(renderer.catalog.entities[type].variants)[0];}
function draw(){
 const camera={x:3,z:1.6,yaw:Math.PI/4,width:900,height:600,scale:61,focusY:.65};
 renderer.begin(camera,null,900,600);
 const types=Object.keys(poses);
 for(let i=0;i<types.length;i++){
  const type=types[i],pose=poses[type],enemy=renderer.catalog.entities[type].kind==='enemies';
  renderer.add(type,{...pose,key:'demo:'+type,variant:variant(type),facing:i*.35,spawn:0},{x:i%3*3,z:Math.floor(i/3)*3.2,h:enemy&&type!=='memory_runner'?1.1:0,fp:[1,1]});
 }
 renderer.addDrone({id:'demo',facing:-.5,motion:{dx:0,dz:0}},{x:3,z:1.5,h:1.05},1200);
 renderer.flush();
}
function allMatrices(){
 const result={};
 for(const [key,instance] of renderer.instances){const values=[];instance.root.traverse(node=>values.push(...node.matrixWorld.elements));result[key]=values;}
 return result;
}
function equalMatrices(a,b){return JSON.stringify(a)===JSON.stringify(b);}
window.smokeChecks=()=>{
 const checks={};
 checks.ready=renderer.ready&&renderer.sources.size===renderer.modelAssets.size&&renderer.sources.size>=7;
 draw();checks.entities=renderer.frames.length===7;
 const frozen=allMatrices();draw();checks.pauseMatrices=equalMatrices(frozen,allMatrices());
 renderer.begin({x:0,z:0,yaw:0,width:300,height:200,scale:40},null,300,200);
 const base={clock:1000,progress:0,variant:'base',facing:0};
 renderer.add('memory_runner',{...base,key:'A',action:'idle'},{x:0,z:0,h:0,fp:[1,1]});
 renderer.add('memory_runner',{...base,key:'B',action:'preview'},{x:2,z:0,h:0,fp:[1,1]}, {opacity:.6});
 renderer.add('memory_runner',{...base,key:'C',action:'death'},{x:4,z:0,h:0,fp:[1,1]}, {opacity:.4});
 renderer.add('memory_runner',{...base,key:'D',action:'idle',spawn:.5,hit:.8},{x:6,z:0,h:0,fp:[1,1]});
 const a=renderer.instances.get('memory_runner:A'),b=renderer.instances.get('memory_runner:B'),c=renderer.instances.get('memory_runner:C'),d=renderer.instances.get('memory_runner:D');
 checks.independentMaterials=a.model.materials[0].material!==b.model.materials[0].material;
 checks.ghost=b.model.materials.every(entry=>entry.material.transparent&&!entry.material.depthWrite);
 checks.death=c.model.materials.every(entry=>entry.material.transparent&&!entry.material.depthWrite);
 checks.spawn=d.root.scale.x<a.root.scale.x&&d.model.materials.every(entry=>entry.material.opacity<entry.opacity);
 checks.hit=d.model.materials.some(entry=>entry.color&&['r','g','b'].some(channel=>entry.material.color[channel]>entry.color[channel]+1e-6));
 checks.materialBatches=[...renderer.batches.values()].filter(batch=>batch.count).every(batch=>batch.mesh.isBatchedMesh);
 const batchColor=new THREE.Vector4();
 checks.instanceRGBA=[a,b,c,d].every(entity=>{let count=0;for(const [owner,{batch,slot}]of renderer.batchPool.owners){if(!owner.startsWith(entity.root.uuid+':'))continue;batch.mesh.getColorAt(slot.id,batchColor);if(!batch.mesh.getVisibleAt(slot.id)||Math.abs(batchColor.x-entity.style.brightness)>1e-6||Math.abs(batchColor.w-entity.style.alpha)>1e-6)return false;if(batch.material.transparent!==entity.style.transparent)return false;count++;}return count>0;});
 renderer.flush();
 renderer.renderStudy('repair_skiff','base',{action:'cast',stage:'windup',progress:1,clock:1500});
 const study=renderer.instances.get('repair_skiff:study:repair_skiff');
 const expectedWindup=study.asset.animationSet==='whole-7'?'windup':'ability';
 checks.windupMapping=study.animation.current.name===expectedWindup&&study.animation.current.action.time===study.asset.clips.get(expectedWindup).duration;
 renderer.renderStudy('tracking_drone','base',{action:'move',travel:.2,clock:1500});
 checks.droneMove=renderer.instances.get('tracking_drone:study:tracking_drone').animation.current.name==='move';
 renderer.begin({x:0,z:0,yaw:0,width:300,height:200,scale:40},null,300,200);
 renderer.add('memory_runner',{...base,key:'swap',action:'idle'},{x:0,z:0,h:0,fp:[1,1]});
 const oldRoot=renderer.instances.get('memory_runner:swap').model.root;
 renderer.catalog.entities.memory_runner.variants.test_swap={source:'models/memory_runner/test_swap.glb'};
 renderer.modelAssets.set('memory_runner/test_swap',renderer.modelAssets.get('repair_skiff/base'));
 renderer.add('memory_runner',{...base,key:'swap',variant:'test_swap',action:'idle'},{x:0,z:0,h:0,fp:[1,1]});
 checks.variantSwap=renderer.instances.get('memory_runner:swap').model.root!==oldRoot;
 checks.slotRelease=![...renderer.batchPool.owners.keys()].some(key=>key.startsWith(oldRoot.uuid+':'));
 delete renderer.catalog.entities.memory_runner.variants.test_swap;renderer.modelAssets.delete('memory_runner/test_swap');
 renderer.flush();
 checks.icon=renderer.renderIcon('focus_rail','T1',128)===canvas;
 draw();
 checks.drawCalls=renderer.snapshot().drawCalls>0;
 checks.pass=Object.values(checks).every(Boolean);
 return checks;
};
window.smokeDestroy=()=>{renderer.destroy();return {disposed:renderer.disposed,sources:renderer.sources.size,instances:renderer.instances.size,ready:renderer.ready};};
try{const ok=await renderer.readyPromise;if(!ok)throw new Error(renderer.errors.join('; '));if(!await renderer.preload())throw new Error('Explicit full preload failed');draw();if(new URLSearchParams(location.search).has('visual')){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('canvas PNG export failed');const response=await fetch('/__runtime_smoke_snapshot',{method:'POST',body:blob});if(!response.ok)throw new Error('canvas PNG upload failed');window.smokeReady=true;output.textContent='visual-capture-ready: six displayed GLB + independent seven-clip tracking_drone';}else{const checks=window.smokeChecks();const cleanup=window.smokeDestroy();checks.cleanup=cleanup.disposed&&cleanup.sources===0&&cleanup.instances===0&&!cleanup.ready;checks.pass=checks.pass&&checks.cleanup;window.smokeResult={checks,cleanup};window.smokeReady=true;output.textContent=JSON.stringify(window.smokeResult,null,2);}}catch(error){window.smokeError=String(error.stack||error);output.textContent=window.smokeError;output.className='error';}
</script></body></html>`;
}

async function serve() {
  const mime = { '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.glb': 'model/gltf-binary' };
  let smokePNG = null;
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname === '/__runtime_smoke_snapshot' && request.method === 'POST') {
        const chunks = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > 20 * 1024 * 1024) throw new Error('Snapshot too large');
          chunks.push(chunk);
        }
        smokePNG = Buffer.concat(chunks);
        response.writeHead(204);
        response.end();
        return;
      }
      if (pathname === '/__runtime_smoke.png' && smokePNG) {
        response.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': smokePNG.length });
        response.end(smokePNG);
        return;
      }
      if (pathname === '/' || pathname === '/__runtime_smoke') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        response.end(smokePage());
        return;
      }
      const root = path.join(PACK, 'game');
      const file = path.resolve(root, `.${decodeURIComponent(pathname)}`);
      if (!file.startsWith(`${root}${path.sep}`)) throw new Error('Forbidden');
      const info = await stat(file);
      if (!info.isFile()) throw new Error('Not a file');
      response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : await readFile(file));
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });
  const portArgument = args.indexOf('--port');
  const port = Number(portArgument >= 0 ? args[portArgument + 1] : 4190);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  console.log(`Browser smoke: http://127.0.0.1:${port}/__runtime_smoke (sample only, Ctrl+C to stop)`);
}

await validateNode();
await validateRelease();
if (args.includes('--serve')) await serve();
