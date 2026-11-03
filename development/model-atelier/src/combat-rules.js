import * as THREE from '../vendor/three/build/three.module.js';

export const RULES = Object.freeze({
  height: 2,
  damageMultiplier: 1.2,
  rangeMultiplier: 1.16,
  splashRadius: 2.3,
  splashRatio: 0.65,
  slowDuration: 1.2,
  slowMultiplier: 0.6,
  hitDuration: 0.17,
  deathDuration: 0.65,
  resistance: 3,
});

export const TOWERS = Object.freeze({
  focus_rail: { id: 'focus_rail', name: '聚焦轨炮', attack: 78, interval: 1.75, release: 0.54, range: 11.52, muzzle: 'Muzzle_charge', kind: 'direct' },
  arc_mortar: { id: 'arc_mortar', name: '弧光迫击炮', attack: 54, interval: 2.2, release: 0.32, range: 10.24, muzzle: 'Echo_charge', kind: 'indirect' },
  resistance_beacon: { id: 'resistance_beacon', name: '抗性信标', attack: 0, interval: 3.2, muzzle: 'Wakeful_core', kind: 'support' },
});

export const ENCOUNTERS = Object.freeze([
  { key: 'runner', model: 'memory_runner', name: '记忆赶工者', hp: 172, armor: 4, speed: 1.2, pressure: 8, coreDamage: 8, air: false, lane: -0.65, z: 7.6 },
  { key: 'skiff', model: 'repair_skiff', name: '修复穿梭艇', hp: 152, armor: 3, speed: 0.95, pressure: 8, coreDamage: 7, air: true, lane: -1.6, z: 8.65 },
  { key: 'wing', model: 'null_wing', name: '缄默巡翼', hp: 218, armor: 7, speed: 1.07, pressure: 14, coreDamage: 10, air: true, lane: 1.15, z: 9.45 },
  { key: 'training', model: 'memory_runner', name: '地面训练靶', hp: 120, armor: 2, speed: 1.2, pressure: 4, coreDamage: 4, air: false, lane: 0.95, z: 7.95, training: true },
]);

export function attackDamage(tower, target) {
  return Math.max(tower.attack * 0.05, tower.attack * RULES.damageMultiplier - target.armor);
}

export function railTarget(actors, selectedKey = null) {
  const alive = actors.filter(actor => actor.alive);
  const selected = alive.find(actor => actor.key === selectedKey);
  if (selected) return selected;
  return alive.sort((a, b) => b.hp - a.hp)[0] || null;
}

export function mortarTarget(actors) {
  return actors.filter(actor => actor.alive && !actor.air).sort((a, b) => a.node.position.z - b.node.position.z)[0] || null;
}

export function splashTargets(actors, primary, impactPoint) {
  return actors.filter(actor => actor.alive && actor !== primary && !actor.air && Math.hypot(actor.node.position.x - impactPoint.x, actor.node.position.z - impactPoint.z) <= RULES.splashRadius);
}

export function turnAngle(current, target, maxStep) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + Math.sign(delta) * Math.min(Math.abs(delta), Math.max(0, maxStep));
}

export function mortarPath(start, end) {
  const distance = Math.hypot(end.x - start.x, end.z - start.z);
  const apex = Math.max(start.y, end.y) + Math.max(2.4, distance * 0.32);
  const control = start.clone().add(end).multiplyScalar(0.5);
  control.y = apex * 2 - (start.y + end.y) / 2;
  const duration = Math.min(1.85, Math.max(1.2, distance / 6));
  return { curve: new THREE.QuadraticBezierCurve3(start.clone(), control, end.clone()), duration, apex };
}

export function pressureAtDeath(actor, core, beaconEnabled) {
  const distance = Math.hypot(actor.node.position.x - core.x, actor.node.position.z - core.z);
  const arrival = actor.pressure / (1 + (distance / 6) ** 2);
  const resisted = Math.min(beaconEnabled ? RULES.resistance : 0, arrival);
  return { distance, arrival, resisted, actual: Math.max(0, arrival - resisted) };
}

export function distanceXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}.${String(Math.floor(seconds * 10) % 10)}`;
}
