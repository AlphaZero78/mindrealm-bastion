import * as THREE from '../../vendor/three/build/three.module.js';
import { group, mesh, sphere, annulusGeometry, turnedCylinderGeometry } from '../geometry.js';

const connections = new WeakMap();

function alongY(direction) {
  const transverse = Math.hypot(direction.x, direction.z);
  if (transverse < 1e-14) return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), direction.y < 0 ? Math.PI : 0);
  const axis = new THREE.Vector3(direction.z / transverse, 0, -direction.x / transverse);
  return new THREE.Quaternion().setFromAxisAngle(axis, Math.atan2(transverse, direction.y));
}

/** A build-time ball-ended actuator. Its three joints become ordinary GLB tracks. */
export function addMechanicalLink(root, joints, key, {
  from, to, radius = 0.025, sleeveRadius = radius * 1.9,
  sleeveLength, overlap = radius * 2.5, materials,
} = {}) {
  if (!from?.node || !to?.node || !materials) throw Error(`${key}: actuator endpoints and materials are required`);
  if (!(radius > 0 && sleeveRadius > radius * 1.15)) throw Error(`${key}: actuator needs radial clearance`);
  const names = [`${key}Sleeve`, `${key}Rod`, `${key}Shaft`];
  if (names.some(name => joints[name])) throw Error(`${key}: duplicate actuator joint`);
  const pointA = new THREE.Vector3(...(from.point || [0, 0, 0]));
  const pointB = new THREE.Vector3(...(to.point || [0, 0, 0]));
  root.updateMatrixWorld(true);
  const rootInverse = root.matrixWorld.clone().invert();
  const fromMatrix = rootInverse.clone().multiply(from.node.matrixWorld);
  const toMatrix = rootInverse.clone().multiply(to.node.matrixWorld);
  const a = pointA.clone().applyMatrix4(fromMatrix);
  const b = pointB.clone().applyMatrix4(toMatrix);
  const length = a.distanceTo(b), housingLength = sleeveLength ?? length * 0.55;
  if (!(housingLength > overlap && length > housingLength + radius)) throw Error(`${key}: actuator sleeve exceeds its rest span`);

  // Keep anchors attached through interpolation and mixed locomotion/cast poses.
  const sleeve = group(from.node, `${key}_sleeve`);
  const rod = group(to.node, `${key}_rod`);
  const shaft = group(rod, `${key}_shaft`);
  const innerRadius = radius * 1.12;
  mesh(sleeve, `${key}_open_housing`, annulusGeometry(sleeveRadius, innerRadius, housingLength, 24), materials.dark || materials.hull, [0, housingLength / 2, 0]);
  mesh(sleeve, `${key}_gland`, annulusGeometry(sleeveRadius * 1.12, innerRadius, sleeveRadius * 0.7, 24), materials.gold || materials.edge, [0, housingLength - sleeveRadius * 0.2, 0]);
  mesh(shaft, `${key}_piston`, turnedCylinderGeometry(radius, radius, 1, 20, radius * 0.12), materials.edge || materials.armor, [0, 0.5, 0]);
  sphere(sleeve, `${key}_fixed_ball`, sleeveRadius * 1.2, [0, 0, 0], materials.hull || materials.dark);
  sphere(rod, `${key}_moving_ball`, sleeveRadius, [0, 0, 0], materials.armor || materials.edge);
  joints[names[0]] = sleeve;
  joints[names[1]] = rod;
  joints[names[2]] = shaft;
  const entry = { key, from: { node: from.node, point: pointA }, to: { node: to.node, point: pointB }, sleeve, rod, shaft, names, housingLength, overlap, radius };
  if (!connections.has(root)) connections.set(root, []);
  connections.get(root).push(entry);
  const restPose = solve(entry, a, b, fromMatrix, toMatrix);
  for (const [name, value] of restPose) {
    const node = joints[name];
    if (value.p) node.position.fromArray(value.p);
    if (value.r) node.rotation.fromArray(value.r);
    if (value.s) node.scale.fromArray(value.s);
  }
  // Numeric endpoint metadata remains inspectable after GLB export and loading.
  root.userData.mechanicalLinks ||= [];
  root.userData.mechanicalLinks.push({ key, from: { node: from.node.name, point: pointA.toArray() }, to: { node: to.node.name, point: pointB.toArray() }, sleeve: sleeve.name, rod: rod.name, shaft: shaft.name, sleeveLength: housingLength, overlap, radius, endpointParented: true });
  return { sleeve, rod, shaft };
}

function solve(entry, a, b, fromMatrix, toMatrix) {
  const direction = b.clone().sub(a), length = direction.length();
  if (length < entry.housingLength + entry.radius) throw Error(`${entry.key}: actuator span ${length.toFixed(5)} is shorter than its sleeve ${(entry.housingLength + entry.radius).toFixed(5)}`);
  direction.multiplyScalar(1 / length);
  const localPose = (parentMatrix, vector, point) => {
    const localDirection = vector.clone().transformDirection(parentMatrix.clone().invert());
    const q = alongY(localDirection);
    const axisScale = localDirection.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(parentMatrix)).length();
    return { p: point.toArray(), r: new THREE.Euler().setFromQuaternion(q).toArray().slice(0, 3), s: [1, 1 / axisScale, 1] };
  };
  return [
    [entry.names[0], localPose(fromMatrix, direction, entry.from.point)],
    [entry.names[1], localPose(toMatrix, direction.clone().negate(), entry.to.point)],
    [entry.names[2], { p: [0, 0, 0], r: [0, 0, 0], s: [1, length - entry.housingLength + entry.overlap, 1] }],
  ];
}

/** Wrap a createRigClip pose; endpoint constraints are baked into all samples. */
export function withMechanicalLinks(root, joints, pose) {
  const links = connections.get(root);
  if (!links?.length) return pose;
  const entries = new Map(Object.entries(joints).map(([key, node]) => [node, key]));
  const rest = new Map();
  root.traverse(node => rest.set(node, { p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
  return (progress, time, api) => {
    const states = new Map();
    pose(progress, time, {
      set(key, value = {}) { states.set(key, { relative: true, ...value }); api.set(key, value); },
      raw(key, value = {}) { states.set(key, { relative: false, ...value }); api.raw(key, value); },
    });
    const cache = new Map([[root, new THREE.Matrix4()]]);
    const matrix = node => {
      if (cache.has(node)) return cache.get(node);
      const base = rest.get(node);
      if (!base || !node.parent) throw Error('Actuator endpoint must be inside the model root');
      const state = states.get(entries.get(node));
      const p = base.p.clone(), q = base.q.clone(), s = base.s.clone();
      if (state) {
        if (state.relative) {
          if (state.p) p.add(new THREE.Vector3(...state.p));
          if (state.r) q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...state.r)));
          if (state.s) s.multiply(new THREE.Vector3(...state.s));
        } else {
          if (state.p) p.fromArray(state.p);
          if (state.r) q.setFromEuler(new THREE.Euler(...state.r));
          if (state.s) s.fromArray(state.s);
        }
      }
      const result = matrix(node.parent).clone().multiply(new THREE.Matrix4().compose(p, q, s));
      cache.set(node, result);
      return result;
    };
    for (const link of links) {
      const fromMatrix = matrix(link.from.node), toMatrix = matrix(link.to.node);
      const a = link.from.point.clone().applyMatrix4(fromMatrix);
      const b = link.to.point.clone().applyMatrix4(toMatrix);
      for (const [name, value] of solve(link, a, b, fromMatrix, toMatrix)) api.raw(name, value);
    }
  };
}
