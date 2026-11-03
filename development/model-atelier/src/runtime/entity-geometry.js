import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function attributeSignature(geometry) {
  const attributes = Object.entries(geometry.attributes).sort(([a], [b]) => a.localeCompare(b));
  if (attributes.some(([, attribute]) => attribute.isInterleavedBufferAttribute)) return null;
  return attributes.map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized}:${attribute.array.constructor.name}`).join('|');
}

function animationTargets(animations) {
  const targets = new Set();
  for (const clip of animations) for (const track of clip.tracks) {
    const separator = track.name.lastIndexOf('.');
    if (separator > 0) targets.add(track.name.slice(0, separator));
  }
  return targets;
}

export function validateEntityBindings(scene, animations, label = 'GLB') {
  const names = new Set();
  scene.traverse(node => { if (node.name) names.add(node.name); });
  for (const clip of animations) for (const track of clip.tracks) {
    const separator = track.name.lastIndexOf('.');
    if (separator <= 0) continue;
    const target = track.name.slice(0, separator);
    if (target.startsWith('.')) continue;
    if (!names.has(target)) throw new Error(`${label}/${clip.name}: 动画目标丢失 ${target}`);
  }
}

export function mergeEntityRigidMeshes(scene, animations = []) {
  scene.updateMatrixWorld(true);
  const animated = animationTargets(animations);
  const originalGeometries = new Set();
  const candidates = [];
  const groups = new Map();
  let before = 0;
  scene.traverse(node => {
    if (!node.isMesh) return;
    before++;
    originalGeometries.add(node.geometry);
    if (!node.isSkinnedMesh && !node.morphTargetInfluences?.length && !Array.isArray(node.material) && !animated.has(node.name) && node.parent && node.children.length === 0) candidates.push(node);
  });
  for (const node of candidates) {
    const signature = attributeSignature(node.geometry);
    if (!signature) continue;
    const key = `${node.parent.uuid}:${node.material.uuid}:${signature}:${node.visible}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node);
  }

  let mergedGroups = 0;
  let skippedGroups = 0;
  for (const nodes of groups.values()) {
    if (nodes.length < 2) continue;
    const geometries = nodes.map(node => {
      node.updateMatrix();
      const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
      return geometry.applyMatrix4(node.matrix);
    });
    const geometry = mergeGeometries(geometries, false);
    for (const clone of geometries) clone.dispose();
    if (!geometry) {
      skippedGroups++;
      continue;
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const first = nodes[0];
    const parent = first.parent;
    const mesh = new THREE.Mesh(geometry, first.material);
    mesh.name = `${parent.name || 'Joint'}_${first.material.name || 'Surface'}_merged`;
    mesh.userData = { ...first.userData };
    mesh.visible = first.visible;
    mesh.castShadow = nodes.some(node => node.castShadow);
    mesh.receiveShadow = nodes.some(node => node.receiveShadow);
    parent.add(mesh);
    for (const node of nodes) parent.remove(node);
    mergedGroups++;
  }

  const retainedGeometries = new Set();
  let after = 0;
  scene.traverse(node => {
    if (!node.isMesh) return;
    after++;
    retainedGeometries.add(node.geometry);
  });
  for (const geometry of originalGeometries) if (!retainedGeometries.has(geometry)) geometry.dispose();
  scene.updateMatrixWorld(true);
  return { before, after, mergedGroups, skippedGroups };
}

export function entityTriangleCount(geometry) {
  return Math.floor((geometry.index?.count ?? geometry.getAttribute('position').count) / 3);
}

export function createEntityLodGeometry(source, { cellRatio = 0.07, minTriangles = 72 } = {}) {
  const sourceTriangles = entityTriangleCount(source);
  const clone = () => {
    const geometry = source.clone();
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    return { geometry, sourceTriangles, lodTriangles: sourceTriangles, ratio: 1 };
  };
  if (sourceTriangles < minTriangles) return clone();
  if (!source.boundingSphere) source.computeBoundingSphere();
  const center = source.boundingSphere.center;
  const cellSize = Math.max(source.boundingSphere.radius * cellRatio, 0.000001);
  const sourcePosition = source.getAttribute('position');
  const sourceNormal = source.getAttribute('normal');
  const sourceUV = source.getAttribute('uv');
  const sourceColor = source.getAttribute('color');
  const sourceIndex = source.index?.array;
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const groups = [];
  const sourceGroups = source.groups.length ? source.groups : [{ start: 0, count: sourceTriangles * 3, materialIndex: 0 }];

  for (const group of sourceGroups) {
    const clusters = new Map();
    const vertexOffset = positions.length / 3;
    const groupStart = indices.length;
    for (let cursor = group.start; cursor < group.start + group.count; cursor += 3) {
      const triangle = [];
      for (let corner = 0; corner < 3; corner++) {
        const vertex = sourceIndex ? sourceIndex[cursor + corner] : cursor + corner;
        const x = sourcePosition.getX(vertex), y = sourcePosition.getY(vertex), z = sourcePosition.getZ(vertex);
        const key = `${Math.floor((x - center.x) / cellSize)},${Math.floor((y - center.y) / cellSize)},${Math.floor((z - center.z) / cellSize)}`;
        let cluster = clusters.get(key);
        if (!cluster) {
          cluster = { id: vertexOffset + clusters.size, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, r: 0, g: 0, b: 0, a: 0, count: 0 };
          clusters.set(key, cluster);
        }
        cluster.x += x;
        cluster.y += y;
        cluster.z += z;
        if (sourceNormal) {
          cluster.nx += sourceNormal.getX(vertex);
          cluster.ny += sourceNormal.getY(vertex);
          cluster.nz += sourceNormal.getZ(vertex);
        }
        if (sourceUV) {
          cluster.u += sourceUV.getX(vertex);
          cluster.v += sourceUV.getY(vertex);
        }
        if (sourceColor) {
          cluster.r += sourceColor.getX(vertex);
          cluster.g += sourceColor.getY(vertex);
          cluster.b += sourceColor.getZ(vertex);
          if (sourceColor.itemSize === 4) cluster.a += sourceColor.getW(vertex);
        }
        cluster.count++;
        triangle.push(cluster.id);
      }
      if (triangle[0] !== triangle[1] && triangle[0] !== triangle[2] && triangle[1] !== triangle[2]) indices.push(...triangle);
    }
    for (const cluster of clusters.values()) {
      const count = Math.max(1, cluster.count);
      positions.push(cluster.x / count, cluster.y / count, cluster.z / count);
      let nx = cluster.nx, ny = cluster.ny, nz = cluster.nz;
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length;
      ny /= length;
      nz /= length;
      normals.push(nx, ny, nz);
      uvs.push(cluster.u / count, cluster.v / count);
      if (sourceColor) colors.push(cluster.r / count, cluster.g / count, cluster.b / count, ...(sourceColor.itemSize === 4 ? [cluster.a / count] : []));
    }
    if (indices.length > groupStart) groups.push({ start: groupStart, count: indices.length - groupStart, materialIndex: group.materialIndex });
  }

  const lodTriangles = Math.floor(indices.length / 3);
  if (!lodTriangles || lodTriangles >= sourceTriangles) return clone();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (sourceColor) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, sourceColor.itemSize));
  geometry.setIndex(indices);
  geometry.groups = groups;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, sourceTriangles, lodTriangles, ratio: lodTriangles / sourceTriangles };
}

export function createInstancedGeometry(source, capacity = 256) {
  const geometry = new THREE.BufferGeometry();
  geometry.name = source.name;
  geometry.setIndex(source.index);
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
  geometry.groups = source.groups.map(group => ({ ...group }));
  geometry.drawRange = { ...source.drawRange };
  geometry.boundingBox = source.boundingBox?.clone() || null;
  geometry.boundingSphere = source.boundingSphere?.clone() || null;
  geometry.morphAttributes = source.morphAttributes;
  geometry.morphTargetsRelative = source.morphTargetsRelative;
  const opacity = new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(1), 1);
  opacity.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('instanceOpacity', opacity);
  return geometry;
}
