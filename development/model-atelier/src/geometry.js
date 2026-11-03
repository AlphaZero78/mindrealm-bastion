import * as THREE from '../vendor/three/build/three.module.js';
import { mergeGeometries } from '../vendor/three/examples/jsm/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const V = (value = [0, 0, 0]) => new THREE.Vector3(...value);

export function palette(faction = 'enemy', warm = false) {
  const hostile = faction === 'enemy';
  const energy = warm ? 0xffd79b : hostile ? 0xff8a73 : 0x62f4da;
  const emissive = warm ? 0xffae4a : hostile ? 0xf14e4c : 0x1ad5bb;
  const make = (name, color, metalness, roughness, extra = {}) => {
    const material = new THREE.MeshPhysicalMaterial({
      name, color, metalness, roughness, clearcoat: 0.26, clearcoatRoughness: 0.3,
      ...extra,
    });
    return material;
  };
  return {
    hull: make('Hull', hostile ? 0x45434f : 0x48656a, 0.82, 0.3),
    armor: make('Armor', hostile ? 0x77717e : 0xa9c0bd, 0.73, 0.3),
    edge: make('Machined edges', hostile ? 0xb0a9b3 : 0xd4e4dc, 0.9, 0.22),
    dark: make('Recesses', hostile ? 0x191923 : 0x173137, 0.76, 0.37),
    gold: make('Resonator alloy', hostile ? 0x9d7c73 : 0xbba16d, 0.82, 0.26),
    accent: make('Signal enamel', hostile ? 0xc86566 : 0x229f98, 0.52, 0.27, { emissive, emissiveIntensity: 0.24 }),
    energy: make('Energy', energy, 0.22, 0.22, { emissive, emissiveIntensity: 2.15 }),
    core: make('Core', warm ? 0xffe5b2 : hostile ? 0xffc1a5 : 0xc5fff0, 0.18, 0.18, { emissive, emissiveIntensity: 1.65 }),
    glass: make('Signal glass', hostile ? 0xac5f72 : warm ? 0xe8c27e : 0x69c9bf, 0.35, 0.2, {
      emissive, emissiveIntensity: 0.42, transparent: true, opacity: 0.48, depthWrite: false, side: THREE.DoubleSide,
    }),
    field: make('Field', energy, 0.05, 0.35, {
      emissive, emissiveIntensity: 0.75, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide,
    }),
  };
}

export function group(parent, name, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const node = new THREE.Group();
  node.name = name;
  node.position.set(...position);
  node.rotation.set(...rotation);
  parent.add(node);
  return node;
}

export function mesh(parent, name, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const node = new THREE.Mesh(geometry, material);
  node.name = name;
  node.position.set(...position);
  node.rotation.set(...rotation);
  node.scale.set(...scale);
  node.castShadow = !material.transparent;
  node.receiveShadow = true;
  parent.add(node);
  return node;
}

function roundedPath(width, height, radius, segments = 3) {
  const x = -width / 2, y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  const points = [[x + r, y]];
  for (const [cx, cy, start] of [
    [x + width - r, y + r, -Math.PI / 2],
    [x + width - r, y + height - r, 0],
    [x + r, y + height - r, Math.PI / 2],
    [x + r, y + r, Math.PI],
  ]) {
    for (let i = 0; i <= segments; i++) {
      const angle = start + i / segments * Math.PI / 2;
      points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
    }
  }
  return points;
}

function roundedBoxGeometry(size, radius) {
  const [w, h, d] = size;
  const r = Math.min(radius, w * 0.3, h * 0.3, d * 0.3);
  const geometry = new THREE.BoxGeometry(w, h, d, 5, 5, 5);
  if (r <= 0) return geometry;
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const inner = [w / 2 - r, h / 2 - r, d / 2 - r];
  const normal = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    // Concentrate the grid on the bevel instead of stretching one bevel face
    // across a large flat panel. Adjacent faces share the same spherical edge.
    const point = [positions.getX(i), positions.getY(i), positions.getZ(i)].map((value, axis) => {
      const half = size[axis] / 2;
      const grid = Math.round((value / half + 1) * 2.5);
      return [-half, -half + r * 0.5, -half + r, half - r, half - r * 0.5, half][grid];
    });
    normal.set(...point.map((value, axis) => value - Math.max(-inner[axis], Math.min(inner[axis], value)))).normalize();
    positions.setXYZ(i, ...point.map((value, axis) => Math.max(-inner[axis], Math.min(inner[axis], value)) + normal.getComponent(axis) * r));
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  geometry.name = 'Rounded structural box';
  return geometry;
}

export function turnedCylinderGeometry(top, bottom, height, segments = 40, bevel = null) {
  const radius = Math.max(top, bottom);
  const radialSegments = Math.min(segments, radius < 0.14 ? 20 : radius < 0.30 ? 32 : segments);
  const half = height / 2;
  const edge = bevel ?? Math.min(half * 0.3, Math.min(top, bottom) * 0.2, 0.04);
  const b = Math.max(0.0001, Math.min(edge, half * 0.42, Math.min(top, bottom) * 0.42));
  const profile = [[0, -half], [Math.max(0, bottom - b), -half]];
  if (bottom > b) {
    for (let i = 1; i <= 3; i++) {
      const angle = -Math.PI / 2 + i / 3 * Math.PI / 2;
      profile.push([bottom - b + Math.cos(angle) * b, -half + b + Math.sin(angle) * b]);
    }
  }
  profile.push([top, half - b]);
  if (top > b) {
    for (let i = 1; i <= 3; i++) {
      const angle = i / 3 * Math.PI / 2;
      profile.push([top - b + Math.cos(angle) * b, half - b + Math.sin(angle) * b]);
    }
  }
  profile.push([0, half]);
  const geometry = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), radialSegments);
  geometry.normalizeNormals();
  geometry.name = 'Turned cylinder with softened rims';
  return geometry;
}

export function annulusGeometry(outerRadius, innerRadius, depth, segments = 40) {
  const half = depth / 2;
  const radialSegments = Math.min(segments, outerRadius < 0.14 ? 20 : outerRadius < 0.32 ? 28 : segments);
  const b = Math.min(half * 0.36, (outerRadius - innerRadius) * 0.25, outerRadius * 0.16);
  const profile = roundedPath(outerRadius - innerRadius, depth, b, 3)
    .map(([x, y]) => new THREE.Vector2(x + (outerRadius + innerRadius) / 2, y));
  const geometry = new THREE.LatheGeometry(profile, radialSegments);
  geometry.normalizeNormals();
  geometry.name = 'Open annular bearing with rounded lands';
  return geometry;
}

export function box(parent, name, size, position, material, rotation = [0, 0, 0], bevel = 0.025) {
  return mesh(parent, name, roundedBoxGeometry(size, Math.min(bevel, Math.min(...size) * 0.23)), material, position, rotation);
}

export function panel(parent, name, points, depth, position, material, rotation = [Math.PI / 2, 0, 0], bevel = 0.018, cornerRadius = 0) {
  const shape = new THREE.Shape();
  if (cornerRadius > 0) {
    for (let i = 0; i < points.length; i++) {
      const previous = points[(i + points.length - 1) % points.length];
      const point = points[i], next = points[(i + 1) % points.length];
      const incoming = new THREE.Vector2(previous[0] - point[0], previous[1] - point[1]);
      const outgoing = new THREE.Vector2(next[0] - point[0], next[1] - point[1]);
      const trim = Math.min(cornerRadius, incoming.length() * 0.28, outgoing.length() * 0.28);
      const before = new THREE.Vector2(...point).addScaledVector(incoming.normalize(), trim);
      const after = new THREE.Vector2(...point).addScaledVector(outgoing.normalize(), trim);
      if (i === 0) shape.moveTo(before.x, before.y);
      else shape.lineTo(before.x, before.y);
      shape.quadraticCurveTo(point[0], point[1], after.x, after.y);
    }
  } else points.forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const b = Math.min(bevel, depth * 0.22);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - b * 2), bevelEnabled: b > 0,
    bevelSize: b, bevelThickness: b, bevelSegments: 3, steps: 1, curveSegments: 4,
  });
  geometry.translate(0, 0, -(depth - b * 2) / 2);
  return mesh(parent, name, geometry, material, position, rotation);
}

export function cylinder(parent, name, top, bottom, height, position, material, rotation = [0, 0, 0], segments = 40, bevel = null) {
  return mesh(parent, name, turnedCylinderGeometry(top, bottom, height, segments, bevel), material, position, rotation);
}

export function sphere(parent, name, radius, position, material, scale = [1, 1, 1]) {
  return mesh(parent, name, new THREE.SphereGeometry(radius, 24, 16), material, position, [0, 0, 0], scale);
}

export function crystal(parent, name, radius, position, material, scale = [1, 1, 1], rotation = [0, 0, 0]) {
  return mesh(parent, name, new THREE.OctahedronGeometry(radius, 0), material, position, rotation, scale);
}

export function torus(parent, name, radius, thickness, position, material, rotation = [0, 0, 0], arc = TAU) {
  return mesh(parent, name, new THREE.TorusGeometry(radius, thickness, 10, 64, arc), material, position, rotation);
}

export function arc(parent, name, radius, thickness, start, end, position, material, rotation = [0, 0, 0]) {
  const points = [];
  for (let i = 0; i <= 40; i++) {
    const a = start + (end - start) * i / 40;
    points.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return mesh(parent, name, new THREE.TubeGeometry(curve, 48, thickness, 8, false), material, position, rotation);
}

export function cable(parent, name, points, thickness, material) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => V(point)));
  return mesh(parent, name, new THREE.TubeGeometry(curve, 28, thickness, 8, false), material);
}

export function rod(parent, name, from, to, radius, material, segments = 16) {
  const start = V(from), end = V(to), direction = end.clone().sub(start);
  const node = cylinder(parent, name, radius, radius, direction.length(), start.clone().add(end).multiplyScalar(0.5).toArray(), material, [0, 0, 0], segments);
  node.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return node;
}

export function link(parent, name, from, to, radius, materials, segments = 24) {
  const start = V(from), end = V(to);
  const direction = end.clone().sub(start).normalize();
  const node = rod(parent, name, from, to, radius, materials.hull || materials.edge, segments);
  for (const [tag, point] of [['root', start], ['tip', end]]) {
    const seat = cylinder(parent, `${name}_${tag}_collar`, radius * 1.30, radius * 1.30, radius * 0.65, point.toArray(), materials.dark || materials.hull, [0, 0, 0], segments);
    seat.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  }
  return node;
}

export function lathe(parent, name, profile, position, material, rotation = [0, 0, 0], segments = 64) {
  const geometry = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
  geometry.normalizeNormals();
  return mesh(parent, name, geometry, material, position, rotation);
}

function hullRing(section) {
  const { w, h } = section;
  const c = Math.min(section.chamfer ?? Math.min(w, h) * 0.22, w * 0.45, h * 0.45);
  return roundedPath(w, h, c, 3).slice(0, -1).reverse();
}

function smoothHullSections(input) {
  const source = input.map(section => ({ ...section, x: section.x ?? 0, y: section.y ?? 0 }));
  if (source.length < 2) throw new Error('A hull needs at least two cross sections');
  if (source[0].z > source.at(-1).z) source.reverse();
  for (let i = 0; i < source.length; i++) {
    const section = source[i];
    if (![section.x, section.y, section.z, section.w, section.h].every(Number.isFinite)
      || section.w <= 0 || section.h <= 0 || (i && section.z <= source[i - 1].z)) {
      throw new Error('Hull cross sections must have positive sizes and strictly ordered depth');
    }
  }
  const end = (section, neighbor) => {
    const span = neighbor.z - section.z;
    const inset = Math.min(Math.min(section.w, section.h) * 0.13, Math.abs(span) * 0.24);
    const ratio = inset / Math.abs(span);
    const cap = { ...section, w: section.w - inset * 2, h: section.h - inset * 2 };
    const shoulder = { ...section, z: section.z + span * ratio,
      x: section.x + (neighbor.x - section.x) * ratio,
      y: section.y + (neighbor.y - section.y) * ratio };
    return [cap, shoulder];
  };
  const front = end(source[0], source[1]), back = end(source.at(-1), source.at(-2));
  // End caps stay at the requested depths; full-size shoulders sit inside them.
  // Keeping this order prevents a folded strip at either end of the shell.
  const sections = [front[0], front[1], ...source.slice(1, -1), back[1], back[0]];
  const keys = ['x', 'y', 'w', 'h'];
  const slopes = sections.map((section, index) => Object.fromEntries(keys.map(key => {
    const left = index > 0 ? (section[key] - sections[index - 1][key]) / (section.z - sections[index - 1].z) : null;
    const right = index < sections.length - 1 ? (sections[index + 1][key] - section[key]) / (sections[index + 1].z - section.z) : null;
    if (left === null) return [key, right];
    if (right === null) return [key, left];
    const slope = left * right <= 0 ? 0 : (left + right) * 0.5;
    return [key, Math.sign(slope) * Math.min(Math.abs(slope), Math.abs(left) * 2, Math.abs(right) * 2)];
  })));
  const result = [];
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i], b = sections[i + 1], span = b.z - a.z;
    for (let step = 0; step < 3; step++) {
      const t = step / 3;
      const section = { z: a.z + span * t, chamfer: (a.chamfer ?? Math.min(a.w, a.h) * 0.22) * (1 - t) + (b.chamfer ?? Math.min(b.w, b.h) * 0.22) * t };
      for (const key of keys) {
        section[key] = (2 * t ** 3 - 3 * t ** 2 + 1) * a[key]
          + (t ** 3 - 2 * t ** 2 + t) * span * slopes[i][key]
          + (-2 * t ** 3 + 3 * t ** 2) * b[key]
          + (t ** 3 - t ** 2) * span * slopes[i + 1][key];
      }
      result.push(section);
    }
  }
  result.push(sections.at(-1));
  return result;
}

export function hull(parent, name, sections, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const positions = [], uvs = [], indices = [];
  const shaped = smoothHullSections(sections);
  const ringSize = 16;
  for (const section of shaped) {
    const { z, y, x } = section;
    hullRing(section).forEach(([px, py], i) => {
      positions.push(px + x, py + y, z);
      uvs.push(i / ringSize, (z - shaped[0].z) / Math.max(0.001, shaped.at(-1).z - shaped[0].z));
    });
  }
  for (let s = 0; s < shaped.length - 1; s++) {
    for (let i = 0; i < ringSize; i++) {
      const a = s * ringSize + i, b = s * ringSize + (i + 1) % ringSize;
      indices.push(a, a + ringSize, b + ringSize, a, b + ringSize, b);
    }
  }
  for (const end of [0, shaped.length - 1]) {
    const section = shaped[end], offset = positions.length / 3;
    hullRing(section).forEach(([px, py], i) => {
      positions.push(px + section.x, py + section.y, section.z);
      uvs.push(i / ringSize, end);
    });
    for (let i = 1; i < ringSize - 1; i++) {
      if (end === 0) indices.push(offset, offset + i, offset + i + 1);
      else indices.push(offset, offset + i + 1, offset + i);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.name = 'Smooth chamfered load hull';
  return mesh(parent, name, geometry, material, position, rotation);
}

export function bearing(parent, name, radius, width, position, materials, axis = 'x') {
  const rotation = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  cylinder(parent, `${name}_seat`, radius, radius, width, position, materials.dark, rotation);
  mesh(parent, `${name}_ring`, annulusGeometry(radius * 0.83, radius * 0.48, width + 0.025, 40), materials.edge, position, rotation);
  cylinder(parent, `${name}_hub`, radius * 0.45, radius * 0.45, width + 0.045, position, materials.accent, rotation, 32);
}

export function fasteners(parent, name, positions, material, axis = 'z', radius = 0.024) {
  const rotation = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'y' ? [0, 0, 0] : [Math.PI / 2, 0, 0];
  for (const [index, position] of positions.entries()) {
    cylinder(parent, `${name}_${index + 1}`, radius, radius, 0.025, position, material, rotation, 6);
  }
}

export function radial(angle, radius, y) {
  return [Math.sin(angle) * radius, y, Math.cos(angle) * radius];
}

export function mirrored(points, side) {
  return side === 1 ? points : points.map(([x, y]) => [-x, y]).reverse();
}

export function mergeStaticMeshes(root) {
  const parents = [];
  root.traverse(node => { if (node.children.length) parents.push(node); });
  for (const parent of parents) {
    const buckets = new Map();
    for (const child of [...parent.children]) {
      if (!child.isMesh || Array.isArray(child.material)) continue;
      const key = child.material.uuid;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(child);
    }
    for (const children of buckets.values()) {
      if (children.length < 2) continue;
      const geometries = children.map(child => {
        child.updateMatrix();
        let geometry = child.geometry.clone();
        if (geometry.index) geometry = geometry.toNonIndexed();
        geometry.applyMatrix4(child.matrix);
        geometry.clearGroups();
        if (!geometry.getAttribute('uv')) {
          geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
        }
        for (const attribute of Object.keys(geometry.attributes)) {
          if (!['position', 'normal', 'uv'].includes(attribute)) geometry.deleteAttribute(attribute);
        }
        if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
        geometry.normalizeNormals();
        return geometry;
      });
      const combined = mergeGeometries(geometries, false);
      geometries.forEach(geometry => geometry.dispose());
      if (!combined) continue;
      const merged = new THREE.Mesh(combined, children[0].material);
      merged.name = `${parent.name}_${children[0].material.name.replaceAll(' ', '_')}`;
      merged.castShadow = !children[0].material.transparent;
      merged.receiveShadow = true;
      children.forEach(child => parent.remove(child));
      parent.add(merged);
    }
  }
  return root;
}
