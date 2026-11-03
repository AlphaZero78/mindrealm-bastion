import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeEntityRigidMeshes, validateEntityBindings, createEntityLodGeometry } from './entity-geometry.js';
import { TRACKING_DRONE_ID, TRACKING_DRONE_DEFINITION } from './tracking-drone.js';

export const ENTITY_MANIFEST_URL = '/assets/game/models/models.json';

const LEGACY_CLIPS = ['idle', 'attack', 'ability', 'shutdown'];
const WHOLE_CLIPS = ['idle', 'move', 'attack', 'windup', 'release', 'ability', 'shutdown'];
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const RESERVED_NAMES = new Set(['__proto__', 'prototype', 'constructor']);
const validName = value => typeof value === 'string' && SAFE_NAME.test(value) && !RESERVED_NAMES.has(value);
const validSource = (id, variant, source) => source === `models/${id}/${variant}.glb`;

function fetchResponse(response, url) {
  if (!response?.ok) throw new Error(`模型索引 ${response?.status ?? ' unavailable'}：${url}`);
  return response.json();
}

export function normalizeEntityManifest(manifest) {
  if (!manifest || manifest.format !== 2) throw new Error('模型索引格式不受支持，需要 format:2');
  if (!manifest.entities || typeof manifest.entities !== 'object' || Array.isArray(manifest.entities)) {
    throw new Error('模型索引缺少 entities');
  }
  const entities = {};
  for (const [id, definition] of Object.entries(manifest.entities)) {
    if (!validName(id)) throw new Error(`无效实体 ID：${id}`);
    if (!definition || typeof definition !== 'object' || !definition.variants || typeof definition.variants !== 'object') {
      throw new Error(`模型 ${id} 缺少 variants`);
    }
    const variants = Object.entries(definition.variants);
    if (!variants.length) throw new Error(`模型 ${id} 没有变体`);
    const normalizedVariants = {};
    for (const [variant, entry] of variants) {
      if (!validName(variant)) throw new Error(`无效变体名：${id}/${variant}`);
      if (!entry || !validSource(id, variant, entry.source)) {
        throw new Error(`模型路径必须为 models/${id}/${variant}.glb`);
      }
      normalizedVariants[variant] = { ...entry };
    }
    entities[id] = { ...definition, variants: normalizedVariants };
  }
  if (!entities[TRACKING_DRONE_ID]) {
    entities[TRACKING_DRONE_ID] = {
      ...TRACKING_DRONE_DEFINITION,
      variants: Object.fromEntries(Object.entries(TRACKING_DRONE_DEFINITION.variants).map(([name, entry]) => [name, { ...entry }])),
    };
  }
  return { ...manifest, entities };
}

export async function loadEntityManifest(url = ENTITY_MANIFEST_URL, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('当前环境没有 fetch，无法读取模型索引');
  const response = await fetchImpl(url);
  return normalizeEntityManifest(await fetchResponse(response, url));
}

export function resolveEntityModelURL(source, manifestUrl = ENTITY_MANIFEST_URL) {
  const value = typeof source === 'string' ? source : source?.source;
  if (typeof value !== 'string' || !/^models\/[A-Za-z0-9][A-Za-z0-9_-]*\/[A-Za-z0-9][A-Za-z0-9_-]*\.glb$/.test(value)) {
    throw new Error(`不安全的模型路径：${value}`);
  }
  const relative = value.slice('models/'.length);
  if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(manifestUrl)) return new URL(relative, manifestUrl).href;
  const base = manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1);
  return `${base}${relative}`;
}

export function measureEntityBounds(scene) {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  if (box.isEmpty() || ![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)) {
    throw new Error('GLB 没有有效的模型边界');
  }
  return {
    box,
    min: box.min.toArray(),
    max: box.max.toArray(),
    size: box.getSize(new THREE.Vector3()).toArray(),
    center: box.getCenter(new THREE.Vector3()).toArray(),
  };
}

export function validateEntityAnimations(animations, label = 'GLB') {
  const names = new Set(animations.map(clip => clip.name));
  for (const clip of animations) {
    if (!clip.name || !Number.isFinite(clip.duration) || clip.duration <= 0 || !clip.tracks.length) {
      throw new Error(`${label} 包含无效动画 ${clip.name || '(unnamed)'}`);
    }
  }
  const legacy = LEGACY_CLIPS.every(name => names.has(name));
  const whole = WHOLE_CLIPS.every(name => names.has(name));
  if (!legacy && !whole) throw new Error(`${label} 需要七段完整动画或旧四段 ${LEGACY_CLIPS.join('/')}`);
  return whole ? 'whole-7' : 'legacy-4';
}

export async function loadEntityModel(definition, {
  loader = new GLTFLoader(), manifestUrl = ENTITY_MANIFEST_URL, label = definition?.source || 'GLB',
} = {}) {
  const source = typeof definition === 'string' ? definition : definition?.source;
  const url = resolveEntityModelURL(source, manifestUrl);
  const gltf = await loader.loadAsync(url);
  if (!gltf.scene?.isObject3D) throw new Error(`${label} 缺少场景根节点`);
  const optimizationStart = performance.now();
  const mergeStats = mergeEntityRigidMeshes(gltf.scene, gltf.animations);
  let meshCount = 0;
  let hasSkinnedMesh = false;
  const skinnedGeometries = new Set();
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const skeletons = new Set();
  gltf.scene.traverse(node => {
    if (!node.isMesh) return;
    meshCount++;
    geometries.add(node.geometry);
    if (node.isSkinnedMesh) {
      hasSkinnedMesh = true;
      skinnedGeometries.add(node.geometry);
      skeletons.add(node.skeleton);
    }
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  const lodGeometries = new Map();
  const lodStats = { sourceTriangles: 0, lodTriangles: 0, geometries: 0 };
  for (const geometry of [...geometries]) {
    if (skinnedGeometries.has(geometry)) {
      lodGeometries.set(geometry, geometry);
      continue;
    }
    const lod = createEntityLodGeometry(geometry);
    lodGeometries.set(geometry, lod.geometry);
    lodStats.sourceTriangles += lod.sourceTriangles;
    lodStats.lodTriangles += lod.lodTriangles;
    lodStats.geometries++;
    geometries.add(lod.geometry);
  }
  const optimizationMs = performance.now() - optimizationStart;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const skeleton of skeletons) skeleton.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    skeletons.clear();
    geometries.clear();
    materials.clear();
    textures.clear();
  };
  try {
    if (!meshCount) throw new Error(`${label} 没有可渲染网格`);
    validateEntityBindings(gltf.scene, gltf.animations, label);
    const animationSet = validateEntityAnimations(gltf.animations, label);
    const bounds = measureEntityBounds(gltf.scene);
    return {
      source,
      url,
      scene: gltf.scene,
      animations: gltf.animations,
      clips: new Map(gltf.animations.map(clip => [clip.name, clip])),
      animationSet,
      bounds,
      meshCount,
      mergeStats,
      lodGeometries,
      lodStats,
      optimizationMs,
      hasSkinnedMesh,
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

export function instantiateEntityModel(asset) {
  if (!asset?.scene || !asset?.animations) throw new TypeError('instantiateEntityModel 需要 loadEntityModel 的结果');
  const root = clone(asset.scene);
  const sources = new Map();
  const linkSources = (source, cloned) => {
    if (source.isMesh) {
      if (!source.geometry.boundingSphere) source.geometry.computeBoundingSphere();
      const sourceMaterials = Array.isArray(source.material) ? source.material : [source.material];
      const emissive = sourceMaterials.some(material => material.emissiveIntensity > 0 && material.emissive && (material.emissive.r + material.emissive.g + material.emissive.b) > 0);
      const lodGeometry = asset.lodGeometries?.get(source.geometry) || source.geometry;
      if (!lodGeometry.boundingSphere) lodGeometry.computeBoundingSphere();
      sources.set(cloned, {
        geometry: source.geometry,
        materials: sourceMaterials,
        radius: source.geometry.boundingSphere.radius,
        far: { geometry: lodGeometry, materials: sourceMaterials, radius: lodGeometry.boundingSphere.radius, emissive },
        farRadius: lodGeometry.boundingSphere.radius,
        emissive,
        skinned: source.isSkinnedMesh,
      });
    }
    for (let index = 0; index < source.children.length; index++) linkSources(source.children[index], cloned.children[index]);
  };
  linkSources(asset.scene, root);
  const materials = [];
  const ownedMaterials = new Set();
  const clonedMaterials = new Map();
  const skeletons = new Set();
  const cloneMaterial = source => {
    if (clonedMaterials.has(source)) return clonedMaterials.get(source);
    const material = source.clone();
    clonedMaterials.set(source, material);
    ownedMaterials.add(material);
    materials.push({
      material,
      color: material.color?.clone() || null,
      emissive: material.emissive?.clone() || null,
      emissiveIntensity: material.emissiveIntensity ?? 1,
      opacity: material.opacity,
      transparent: material.transparent,
      depthWrite: material.depthWrite,
    });
    return material;
  };
  let meshCount = 0;
  root.traverse(node => {
    if (!node.isMesh) return;
    meshCount++;
    if (node.isSkinnedMesh) skeletons.add(node.skeleton);
    node.material = Array.isArray(node.material) ? node.material.map(cloneMaterial) : cloneMaterial(node.material);
    node.castShadow = true;
    node.receiveShadow = true;
  });
  let disposed = false;
  return {
    root,
    sources,
    materials,
    meshCount,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const skeleton of skeletons) skeleton.dispose();
      for (const material of ownedMaterials) material.dispose();
      sources.clear();
      skeletons.clear();
      clonedMaterials.clear();
      ownedMaterials.clear();
      materials.length = 0;
    },
  };
}
