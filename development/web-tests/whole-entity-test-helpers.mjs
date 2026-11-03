import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const PROJECT_ROOT = process.cwd();
export const GAME_ROOT = path.join(PROJECT_ROOT, 'game');
export const CLIP_NAMES = ['idle', 'move', 'attack', 'windup', 'release', 'ability', 'shutdown'];
export const manifest = JSON.parse(await readFile(path.join(GAME_ROOT, 'assets/game/models/models.json'), 'utf8'));
export const { enemies, towers } = await import(pathToFileURL(path.join(GAME_ROOT, 'web/core/content.js')).href);
export const T = await import(pathToFileURL(path.join(GAME_ROOT, 'assets/third_party/three/three.bundle.js')).href);
const { GLTFLoader } = await import(pathToFileURL(path.join(GAME_ROOT, 'assets/third_party/three/addons/loaders/GLTFLoader.js')).href);
const assetsApi = await import(pathToFileURL(path.join(GAME_ROOT, 'web/view/entity-assets.js')).href);
const animationApi = await import(pathToFileURL(path.join(GAME_ROOT, 'web/view/entity-animation.js')).href);
export const { instantiateEntityModel } = assetsApi;
export const { createEntityMixer } = animationApi;

const loader = new GLTFLoader();
const cache = new Map();
const arrayBuffer = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

export function expectedVariants(id) {
  if (towers[id]) return ['T1', 'T2A', 'T2B', 'T3A', 'T3B'];
  return enemies[id]?.kind === 'boss' ? ['phase1', 'phase2', 'phase3'] : ['base'];
}

export function wholeAsset(id, variant) {
  const key = `${id}/${variant}`;
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      const entry = manifest.entities[id]?.variants?.[variant];
      assert.ok(entry, `${key}: manifest entry`);
      const label = key;
      const asset = await assetsApi.loadEntityModel(entry, {
        label,
        manifestUrl: '/assets/game/models/models.json',
        loader: {
          async loadAsync(url) {
            assert.equal(url, `/assets/game/models/${id}/${variant}.glb`, label);
            const bytes = await readFile(path.join(GAME_ROOT, url.slice(1)));
            return loader.parseAsync(arrayBuffer(bytes), '');
          },
        },
      });
      assert.equal(asset.animationSet, 'whole-7', label);
      assert.deepEqual([...asset.clips.keys()].sort(), [...CLIP_NAMES].sort(), label);
      assert.deepEqual(Object.keys(entry.clips || {}).sort(), [...CLIP_NAMES].sort(), label);
      for (const name of CLIP_NAMES) assert.equal(entry.clips[name], name, `${label}/${name}`);
      return asset;
    })());
  }
  return cache.get(key);
}

export function modelInstance(asset) {
  const model = instantiateEntityModel(asset);
  const animation = createEntityMixer(model.root, asset.animations);
  return { model, animation };
}

export function namedNodes(root) {
  const nodes = [];
  root.traverse(node => { if (node.name) nodes.push(node); });
  return nodes;
}

export function snapshot(root) {
  root.updateMatrixWorld(true);
  const result = {};
  root.traverse(node => {
    if (!node.name) return;
    result[node.name] = [
      ...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray(), ...node.matrixWorld.elements,
    ];
    for (const value of result[node.name]) assert.ok(Number.isFinite(value), `${node.name}: nonfinite transform`);
  });
  return result;
}

export function assertSnapshot(actual, expected, label, tolerance = 1e-9) {
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), label);
  for (const [name, values] of Object.entries(expected)) {
    assert.equal(actual[name].length, values.length, `${label}/${name}`);
    for (let i = 0; i < values.length; i++) {
      assert.ok(Math.abs(actual[name][i] - values[i]) <= tolerance,
        `${label}/${name}[${i}]: ${actual[name][i]} != ${values[i]}`);
    }
  }
}

export function validateTrackBindings(asset, root, label) {
  const names = new Set();
  root.traverse(node => {
    if (!node.name) return;
    assert.ok(!names.has(node.name), `${label}: duplicate node ${node.name}`);
    names.add(node.name);
  });
  for (const clip of asset.animations) {
    assert.ok(CLIP_NAMES.includes(clip.name), `${label}: unexpected clip ${clip.name}`);
    assert.ok(Number.isFinite(clip.duration) && clip.duration > 0, `${label}/${clip.name}: duration`);
    assert.ok(clip.tracks.length >= 3, `${label}/${clip.name}: insufficient tracks`);
    let changingTracks = 0;
    for (const track of clip.tracks) {
      const split = track.name.lastIndexOf('.');
      const nodeName = split < 0 ? track.name : track.name.slice(0, split);
      assert.ok(root.getObjectByName(nodeName), `${label}/${clip.name}: missing node ${nodeName}`);
      assert.ok(track.times.length > 1 && track.times.every(Number.isFinite), `${label}/${track.name}: times`);
      assert.ok(track.values.length > 0 && track.values.every(Number.isFinite), `${label}/${track.name}: values`);
      let changing = false;
      const stride = track.getValueSize();
      for (let frame = 1; frame < track.times.length && !changing; frame++) {
        for (let component = 0; component < stride; component++) {
          if (Math.abs(track.values[frame * stride + component] - track.values[component]) > 1e-7) {
            changing = true;
            break;
          }
        }
      }
      if (changing) changingTracks++;
    }
    assert.ok(changingTracks >= 2, `${label}/${clip.name}: fewer than two articulated tracks`);
  }
}

export function validateGeometry(root, label) {
  let meshes = 0;
  let triangles = 0;
  root.traverse(node => {
    if (!node.isMesh) return;
    meshes++;
    const geometry = node.geometry;
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    assert.ok(position?.count >= 3, `${label}/${node.name}: positions`);
    assert.ok(normal && normal.count === position.count && normal.itemSize === 3, `${label}/${node.name}: normals`);
    assert.ok(uv && uv.count === position.count && uv.itemSize === 2, `${label}/${node.name}: UVs`);
    for (const attribute of [position, normal, uv]) {
      for (const value of attribute.array) assert.ok(Number.isFinite(value), `${label}/${node.name}: nonfinite vertex data`);
    }
    for (let i = 0; i < normal.count; i++) {
      const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
      assert.ok(Math.abs(length - 1) < 1e-3, `${label}/${node.name}: non-unit normal ${length}`);
    }
    const indices = geometry.index?.array || Array.from({ length: position.count }, (_, i) => i);
    assert.equal(indices.length % 3, 0, `${label}/${node.name}: incomplete triangle`);
    for (const index of indices) assert.ok(Number.isInteger(index) && index >= 0 && index < position.count, `${label}/${node.name}: index`);
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
    const ab = new T.Vector3(), ac = new T.Vector3(), face = new T.Vector3(), averaged = new T.Vector3();
    for (let i = 0; i < indices.length; i += 3) {
      const ia = indices[i], ib = indices[i + 1], ic = indices[i + 2];
      a.fromBufferAttribute(position, ia);
      b.fromBufferAttribute(position, ib);
      c.fromBufferAttribute(position, ic);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      face.crossVectors(ab, ac);
      if (face.lengthSq() < 1e-16) continue;
      face.normalize();
      averaged.set(normal.getX(ia) + normal.getX(ib) + normal.getX(ic),
        normal.getY(ia) + normal.getY(ib) + normal.getY(ic),
        normal.getZ(ia) + normal.getZ(ib) + normal.getZ(ic));
      assert.ok(averaged.lengthSq() > 1e-16, `${label}/${node.name}: missing face normal`);
      averaged.normalize();
      assert.ok(face.dot(averaged) >= -1e-6, `${label}/${node.name}: reversed triangle winding at ${i / 3}`);
      triangles++;
    }
  });
  assert.ok(meshes > 0 && triangles > 0, `${label}: no renderable triangles`);
  return { meshes, triangles };
}

export function lowestVertex(root) {
  root.updateMatrixWorld(true);
  let lowest = Infinity;
  const point = new T.Vector3();
  root.traverse(node => {
    if (!node.isMesh) return;
    const position = node.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
      lowest = Math.min(lowest, point.y);
    }
  });
  assert.ok(Number.isFinite(lowest), 'lowest vertex');
  return lowest;
}
