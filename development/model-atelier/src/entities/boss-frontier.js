import * as THREE from '../../vendor/three/build/three.module.js';
import { defineEntity } from './contract.js';
import {
  palette, group, box, panel, cylinder, sphere, crystal, torus, arc, cable, rod,
  lathe, hull, bearing, fasteners,
} from '../geometry.js';
import { createRigClip, TAU, ease, pulse } from '../animations.js';
import { addMechanicalLink, withMechanicalLinks } from './mechanical-links.js';

const PHASES = ['phase1', 'phase2', 'phase3'];
const SIDES = [-1, 1];
const phaseOf = variant => Math.max(1, PHASES.indexOf(variant) + 1);

function bossMaterials() {
  const m = palette('enemy');
  m.hull.color.setHex(0x30323b);
  m.armor.color.setHex(0x51515d);
  m.edge.color.setHex(0x96909b);
  m.dark.color.setHex(0x14151d);
  m.gold.color.setHex(0x80636a);
  m.mirror = new THREE.MeshPhysicalMaterial({
    name: 'Black silver mirror', color: 0x89919f, metalness: 1, roughness: 0.075,
    clearcoat: 1, clearcoatRoughness: 0.05,
  });
  m.refractory = new THREE.MeshPhysicalMaterial({
    name: 'Refractory iron', color: 0x3c3035, metalness: 0.68, roughness: 0.58,
    clearcoat: 0.12,
  });
  return m;
}

function joint(parent, joints, key, name, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const node = group(parent, name, position, rotation);
  joints[key] = node;
  return node;
}

function frame(parent, name, points, z, material, radius = 0.035) {
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    rod(parent, `${name}_${i}`, [a[0], a[1], z], [b[0], b[1], z], radius, material);
  }
}

function mechanicalLeg(root, joints, m, label, key, side, x, z, hipY, dimensions = {}) {
  const spread = dimensions.spread ?? 0.56;
  const drop = dimensions.drop ?? 0.6;
  const lower = dimensions.lower ?? 0.82;
  const reach = dimensions.reach ?? 0.32;
  const width = dimensions.width ?? 0.76;
  const hip = joint(root, joints, `hip${key}`, `${label}_hip`, [x, hipY, z]);
  bearing(hip, `${label}_hip_bearing`, 0.28, 0.38, [0, 0, 0], m, 'x');
  for (const dz of [-0.13, 0.13]) {
    rod(hip, `${label}_upper_spar_${dz}`, [0, 0, dz], [side * spread, -drop, dz], 0.12, m.hull);
    rod(hip, `${label}_upper_piston_${dz}`, [side * 0.08, -0.08, dz * 1.25], [side * (spread - 0.1), -drop + 0.12, dz * 1.25], 0.045, m.edge);
  }
  box(hip, `${label}_hip_armor`, [0.42, 0.56, 0.54], [side * spread * 0.45, -drop * 0.45, 0], m.armor, [0, 0, side * Math.atan2(spread, drop)], 0.07);
  const knee = joint(hip, joints, `knee${key}`, `${label}_knee`, [side * spread, -drop, 0]);
  bearing(knee, `${label}_knee_bearing`, 0.235, 0.34, [0, 0, 0], m, 'x');
  for (const dz of [-0.12, 0.12]) {
    rod(knee, `${label}_lower_bone_${dz}`, [0, 0, dz], [side * reach, -lower, dz * 0.6], 0.105, m.dark);
    rod(knee, `${label}_lower_ram_${dz}`, [side * 0.08, -0.12, dz], [side * (reach - 0.04), -lower + 0.14, dz * 0.6], 0.05, m.gold);
  }
  cable(knee, `${label}_tendon`, [[side * 0.2, 0.05, 0.2], [side * 0.35, -lower * 0.45, 0.25], [side * reach, -lower + 0.08, 0.12]], 0.035, m.accent);
  const ankle = joint(knee, joints, `ankle${key}`, `${label}_ankle`, [side * reach, -lower, 0]);
  bearing(ankle, `${label}_ankle_bearing`, 0.19, 0.3, [0, 0, 0], m, 'x');
  hull(ankle, `${label}_continuous_foot`, [
    { z: -0.65, y: -0.11, w: width * 0.7, h: 0.3, chamfer: 0.08 },
    { z: -0.48, y: -0.11, w: width, h: 0.42, chamfer: 0.1 },
    { z: 0.28, y: -0.11, w: width * 0.92, h: 0.42, chamfer: 0.1 },
    { z: 0.5, y: -0.11, w: width * 0.58, h: 0.3, chamfer: 0.07 },
  ], m.hull);
  box(ankle, `${label}_toe_armor`, [width * 0.7, 0.16, 0.55], [0, 0.08, -0.28], m.armor, [-0.08, 0, 0], 0.04);
  fasteners(ankle, `${label}_toe_bolts`, [[-width * 0.22, 0.17, -0.34], [width * 0.22, 0.17, -0.34]], m.edge, 'y', 0.035);
}

function walk(joints, set, t, strength = 1) {
  const ids = Object.keys(joints).filter(key => /^hip[LR]\d+$/.test(key)).map(key => key.slice(3));
  for (const id of ids) {
    const side = id[0] === 'L' ? -1 : 1;
    const index = Number(id.slice(1));
    const phase = TAU * (t + ((index + (side === 1 ? 1 : 0)) % 2) * 0.5 + index * 0.08);
    const swing = Math.sin(phase) * strength;
    const lift = Math.max(0, Math.sin(phase)) * strength;
    set(`hip${id}`, { r: [swing * 0.3, 0, side * lift * 0.035] });
    set(`knee${id}`, { r: [-lift * 0.34 + swing * 0.08, 0, 0] });
    set(`ankle${id}`, { r: [lift * 0.18 - swing * 0.12, 0, 0] });
  }
}

function stance(joints, set, t, strength = 1) {
  const ids = Object.keys(joints).filter(key => /^hip[LR]\d+$/.test(key)).map(key => key.slice(3));
  for (const id of ids) {
    const offset = Number(id.slice(1)) * 0.7 + (id[0] === 'R' ? 1.4 : 0);
    const breath = Math.sin(TAU * t + offset) * strength;
    set(`hip${id}`, { r: [breath * 0.018, 0, 0] });
    set(`knee${id}`, { r: [-breath * 0.026, 0, 0] });
    set(`ankle${id}`, { r: [breath * 0.018, 0, 0] });
  }
}

function sevenClips(root, joints, poses) {
  const connected = Object.fromEntries(Object.entries(poses).map(([name, pose]) => [name, withMechanicalLinks(root, joints, pose)]));
  return [
    createRigClip(root, joints, 'idle', 3.2, connected.idle),
    createRigClip(root, joints, 'move', 1.6, connected.move),
    createRigClip(root, joints, 'attack', 1.6, connected.attack),
    createRigClip(root, joints, 'windup', 2.4, connected.windup),
    createRigClip(root, joints, 'release', 2, connected.release),
    createRigClip(root, joints, 'ability', 3.6, connected.ability),
    createRigClip(root, joints, 'shutdown', 3, connected.shutdown),
  ];
}

function broodPod(parent, name, position, m) {
  const pod = group(parent, name, position);
  lathe(pod, `${name}_shell`, [[0, 0], [0.2, 0.02], [0.32, 0.24], [0.3, 0.52], [0.14, 0.76], [0, 0.82]], [0, 0, 0], m.armor, [0, 0, 0], 32);
  sphere(pod, `${name}_signal`, 0.19, [0, 0.39, 0], m.glass, [1, 1.5, 1]);
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4;
    const x = Math.sin(a) * 0.29, z = Math.cos(a) * 0.29;
    rod(pod, `${name}_cage_${i}`, [x * 0.65, 0.05, z * 0.65], [x, 0.55, z], 0.026, m.dark);
  }
  torus(pod, `${name}_band`, 0.305, 0.035, [0, 0.36, 0], m.accent, [Math.PI / 2, 0, 0]);
  return pod;
}

function buildNoise(variant) {
  const phase = phaseOf(variant), m = bossMaterials(), joints = {};
  const root = new THREE.Group();
  root.name = `noise_hive_${variant}`;
  root.userData.phase = phase;
  const body = joint(root, joints, 'body', 'noise_body');
  hull(body, 'noise_continuous_brood_shell', [
    { z: -2.28, y: 2.02, w: 1.2, h: 1.05, chamfer: 0.25 },
    { z: -1.86, y: 2.14, w: 2.7, h: 1.75, chamfer: 0.34 },
    { z: -1.05, y: 2.28, w: 3.55, h: 2.15, chamfer: 0.4 },
    { z: 0.05, y: 2.34, w: 3.9, h: 2.28, chamfer: 0.45 },
    { z: 1.12, y: 2.25, w: 3.45, h: 2.02, chamfer: 0.38 },
    { z: 1.95, y: 2.12, w: 2.5, h: 1.55, chamfer: 0.3 },
    { z: 2.25, y: 2.03, w: 1.35, h: 0.9, chamfer: 0.22 },
  ], m.hull);
  hull(body, 'noise_ventral_keel', [
    { z: -1.85, y: 1.25, w: 1.05, h: 0.5 },
    { z: -0.8, y: 1.1, w: 1.5, h: 0.65 },
    { z: 0.9, y: 1.12, w: 1.6, h: 0.65 },
    { z: 1.75, y: 1.3, w: 0.95, h: 0.45 },
  ], m.dark);
  rod(body, 'noise_load_spine', [0, 1.28, -1.9], [0, 1.28, 1.85], 0.18, m.edge);
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    cable(body, `noise_${tag}_shell_seam`, [[side * 0.65, 2.85, -1.85], [side * 1.65, 3.25, -0.8], [side * 1.78, 3.23, 0.65], [side * 0.9, 2.75, 1.8]], 0.055, m.gold);
    for (let i = 0; i < 3; i++) {
      box(body, `noise_${tag}_flank_armor_${i}`, [0.18, 0.72, 0.92], [side * (1.72 + (i === 1 ? 0.14 : 0)), 2.3, -1.05 + i * 1.05], m.armor, [0, side * 0.08, side * -0.12], 0.06);
      fasteners(body, `noise_${tag}_flank_bolts_${i}`, [[side * 1.84, 2.52, -1.35 + i * 1.05], [side * 1.84, 2.08, -1.35 + i * 1.05]], m.edge, 'x', 0.04);
    }
  }
  [-1.25, 0, 1.25].forEach((z, index) => {
    for (const side of SIDES) {
      const key = `${side < 0 ? 'L' : 'R'}${index}`;
      mechanicalLeg(body, joints, m, `noise_leg_${key}`, key, side, side * 1.47, z, 1.72, { spread: 0.58, drop: 0.58, lower: 0.82, reach: 0.32, width: 0.82 });
    }
  });
  const carousel = joint(body, joints, 'carousel', 'noise_brood_carousel', [0, 3.32, 0.25]);
  cylinder(carousel, 'noise_carousel_saddle', 0.88, 1.08, 0.28, [0, 0, 0], m.dark);
  torus(carousel, 'noise_carousel_outer_rail', 1.12, 0.09, [0, 0.14, 0], m.edge, [Math.PI / 2, 0, 0]);
  torus(carousel, 'noise_carousel_signal_rail', 0.83, 0.045, [0, 0.25, 0], m.accent, [Math.PI / 2, 0, 0]);
  const podCount = 2 + phase * 2;
  for (let i = 0; i < podCount; i++) {
    const a = i * TAU / podCount;
    broodPod(carousel, `noise_brood_pod_${i}`, [Math.sin(a) * 1.02, 0.18, Math.cos(a) * 1.02], m);
  }
  cylinder(body, 'noise_throat_recess', 0.79, 0.79, 0.2, [0, 2.06, -2.25], m.dark, [Math.PI / 2, 0, 0]);
  torus(body, 'noise_throat_outer', 0.8, 0.13, [0, 2.06, -2.39], m.gold);
  torus(body, 'noise_throat_signal', 0.61, 0.045, [0, 2.06, -2.48], m.energy);
  const gatePoints = [[0, -0.57], [0.64, -0.38], [0.64, 0.38], [0, 0.57]];
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    const gate = joint(body, joints, `gate${tag}`, `noise_front_gate_${tag}`, [side * 0.68, 2.06, -2.44], [0, -side * (phase - 1) * 0.12, 0]);
    const points = gatePoints.map(([x, y]) => [x * -side, y]);
    panel(gate, `noise_front_gate_plate_${tag}`, points, 0.14, [0, 0, 0], m.armor, [0, 0, 0], 0.035);
    frame(gate, `noise_front_gate_frame_${tag}`, points, -0.09, m.edge, 0.035);
    rod(gate, `noise_front_gate_vein_${tag}`, [0, -0.42, -0.1], [-side * 0.5, 0.3, -0.1], 0.035, m.accent);
    bearing(gate, `noise_front_gate_hinge_${tag}`, 0.13, 0.52, [0, 0, 0.05], m, 'y');
  }
  const ram = joint(body, joints, 'ram', 'noise_resonance_ram', [0, 2.06, -2.28]);
  cylinder(ram, 'noise_ram_head', 0.32, 0.48, 0.42, [0, 0, -0.83], m.gold, [Math.PI / 2, 0, 0]);
  torus(ram, 'noise_ram_corona', 0.37, 0.05, [0, 0, -1.05], m.accent);
  addMechanicalLink(root, joints, 'noiseRam', {
    from: { node: body, point: [0, 2.06, -1.40] }, to: { node: ram, point: [0, 0, -0.70] },
    radius: 0.10, sleeveRadius: 0.21, sleeveLength: 0.50, materials: m,
  });
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    const nursery = joint(body, joints, `nursery${tag}`, `noise_side_nursery_${tag}`, [side * 1.79, 2.37, 0.7], [0, -side * (phase - 1) * 0.4, 0]);
    bearing(nursery, `noise_nursery_hinge_${tag}`, 0.18, 0.9, [0, 0, 0], m, 'y');
    box(nursery, `noise_nursery_door_${tag}`, [0.18, 1.28, 1.35], [0, 0, -0.58], m.hull, [0, 0, 0], 0.07);
    box(nursery, `noise_nursery_inlay_${tag}`, [0.205, 0.82, 0.85], [side * 0.03, 0, -0.58], m.armor, [0, 0, 0], 0.04);
    cable(nursery, `noise_nursery_umbilical_${tag}`, [[0, 0.45, 0], [side * 0.3, 0.65, -0.45], [side * 0.34, 0.15, -1.05]], 0.05, m.accent);
    if (phase >= 2) {
      for (let i = 0; i < phase - 1; i++) {
        const pod = broodPod(nursery, `noise_outer_cocoon_${tag}_${i}`, [side * 0.38, -0.42, -0.35 - i * 0.65], m);
        pod.rotation.z = side * -0.35;
      }
      rod(nursery, `noise_nursery_outer_rail_${tag}`, [side * 0.36, -0.45, 0], [side * 0.36, -0.45, -1.25], 0.07, m.edge);
    }
  }
  const crown = joint(body, joints, 'crown', 'noise_signal_crown', [0, 3.48, 1.12]);
  cylinder(crown, 'noise_crown_socket', 0.46, 0.64, 0.36, [0, 0, 0], m.dark);
  torus(crown, 'noise_crown_bearing', 0.49, 0.07, [0, 0.2, 0], m.accent, [Math.PI / 2, 0, 0]);
  for (const side of SIDES) {
    rod(crown, `noise_crown_base_antenna_${side}`, [side * 0.22, 0.12, 0], [side * 0.5, 0.95, 0.12], 0.055, m.gold);
    sphere(crown, `noise_crown_base_tip_${side}`, 0.1, [side * 0.5, 0.98, 0.12], m.energy);
    if (phase >= 2) {
      cable(crown, `noise_crown_mid_horn_${side}`, [[side * 0.25, 0.2, 0], [side * 0.85, 0.85, 0.15], [side * 1.02, 1.45, -0.05]], 0.065, m.edge);
      torus(crown, `noise_crown_mid_ring_${side}`, 0.23, 0.045, [side * 0.88, 1.02, 0.1], m.accent, [0, Math.PI / 2, 0]);
    }
    if (phase >= 3) {
      arc(crown, `noise_crown_high_arch_${side}`, 1.12, 0.065, 0.15, Math.PI * 0.82, [side * 0.25, 1.25, 0.15], m.gold, [0, side * 0.35, side * 0.25]);
      rod(crown, `noise_crown_high_spire_${side}`, [side * 0.35, 0.3, 0.1], [side * 0.62, 2.05, 0.2], 0.045, m.accent);
      crystal(crown, `noise_crown_high_crystal_${side}`, 0.18, [side * 0.62, 2.12, 0.2], m.energy, [0.65, 1.5, 0.65]);
    }
  }
  if (phase >= 3) {
    torus(crown, 'noise_crown_summoning_halo', 1.08, 0.07, [0, 1.45, 0.1], m.energy, [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      crystal(crown, `noise_halo_seed_${i}`, 0.12, [Math.sin(a) * 1.08, 1.45, Math.cos(a) * 1.08 + 0.1], m.core, [0.7, 1.4, 0.7]);
    }
  }
  addMechanicalLink(root, joints, 'noiseCrownLift', {
    from: { node: body, point: [0, 2.70, 1.12] }, to: { node: crown, point: [0, 0, 0] },
    radius: 0.055, sleeveRadius: 0.12, sleeveLength: 0.20, materials: m,
  });
  addMechanicalLink(root, joints, 'noiseCarouselLift', {
    from: { node: body, point: [0, 2.72, 0.25] }, to: { node: carousel, point: [0, 0, 0] },
    radius: 0.06, sleeveRadius: 0.14, sleeveLength: 0.23, materials: m,
  });
  return { root, joints };
}

function noiseClips(root, joints) {
  return sevenClips(root, joints, {
    idle(t, time, { set }) {
      const wave = Math.sin(TAU * t);
      set('body', { p: [0, wave * 0.035, 0], r: [wave * 0.012, 0, wave * 0.015] });
      set('carousel', { r: [0, t * 0.35, 0] });
      set('crown', { r: [0, -t * 0.22, wave * 0.025] });
      set('gateL', { r: [0, wave * 0.045, 0] });
      set('gateR', { r: [0, -wave * 0.045, 0] });
      set('ram', { p: [0, 0, wave * 0.04] });
      stance(joints, set, t, 0.8);
    },
    move(t, time, { set }) {
      const stride = Math.sin(TAU * t * 2);
      set('body', { p: [0, Math.abs(stride) * 0.09, 0], r: [stride * 0.025, 0, Math.sin(TAU * t) * 0.045] });
      set('carousel', { r: [0, t * 0.7, 0] });
      set('crown', { r: [stride * 0.04, -t * 0.35, 0] });
      set('nurseryL', { r: [0, stride * 0.035, 0] });
      set('nurseryR', { r: [0, -stride * 0.035, 0] });
      walk(joints, set, t, 1);
    },
    attack(t, time, { set }) {
      const hit = pulse(t, 0.04, 0.3, 0.66), recover = ease(t, 0.58, 1);
      set('body', { p: [0, -hit * 0.12, hit * 0.16], r: [-hit * 0.1, 0, 0] });
      set('ram', { p: [0, 0, -hit * 1.05], r: [0, 0, hit * TAU * 0.35] });
      set('gateL', { r: [0, hit * 0.85 - recover * 0.1, 0] });
      set('gateR', { r: [0, -hit * 0.85 + recover * 0.1, 0] });
      set('carousel', { r: [0, hit * 0.35, 0] });
      for (const id of ['L0', 'R0', 'L1', 'R1', 'L2', 'R2']) {
        set(`knee${id}`, { r: [hit * 0.12, 0, 0] });
        set(`ankle${id}`, { r: [-hit * 0.16, 0, 0] });
      }
    },
    windup(t, time, { set }) {
      const charge = ease(t, 0.02, 0.82), tremor = Math.sin(t * TAU * 6) * charge;
      set('body', { p: [0, charge * 0.12, charge * 0.12], r: [charge * 0.055, 0, tremor * 0.012] });
      set('gateL', { r: [0, charge * 1.12, 0] });
      set('gateR', { r: [0, -charge * 1.12, 0] });
      set('nurseryL', { r: [0, charge * 0.48, 0] });
      set('nurseryR', { r: [0, -charge * 0.48, 0] });
      set('carousel', { p: [0, charge * 0.18, 0], r: [0, charge * TAU * 1.5, 0] });
      set('crown', { p: [0, charge * 0.3, 0], r: [0, -charge * TAU, 0] });
      set('ram', { p: [0, 0, charge * 0.45] });
      stance(joints, set, t, charge * 2);
    },
    release(t, time, { set }) {
      const spawn = pulse(t, 0.02, 0.32, 0.88), index = ease(t, 0.08, 0.9);
      set('body', { p: [0, -spawn * 0.09, spawn * 0.18], r: [-spawn * 0.07, 0, 0] });
      set('gateL', { r: [0, (1 - index) * 0.9 + spawn * 0.25, 0] });
      set('gateR', { r: [0, -(1 - index) * 0.9 - spawn * 0.25, 0] });
      set('nurseryL', { r: [0, spawn * 0.72, spawn * -0.08] });
      set('nurseryR', { r: [0, -spawn * 0.72, spawn * 0.08] });
      set('carousel', { p: [0, spawn * 0.3, 0], r: [0, index * TAU * 2, 0] });
      set('crown', { p: [0, spawn * 0.42, 0], r: [0, -index * TAU * 1.5, 0] });
      set('ram', { p: [0, 0, -spawn * 0.72], r: [0, 0, index * TAU] });
      for (const id of ['L0', 'R0', 'L2', 'R2']) set(`hip${id}`, { r: [-spawn * 0.12, 0, 0] });
    },
    ability(t, time, { set }) {
      const deploy = ease(t, 0.02, 0.38), work = Math.sin(TAU * t * 2) * deploy;
      set('body', { p: [0, deploy * 0.14, 0], r: [deploy * 0.035, 0, 0] });
      set('nurseryL', { r: [0, deploy * 0.9, deploy * -0.12] });
      set('nurseryR', { r: [0, -deploy * 0.9, deploy * 0.12] });
      set('gateL', { r: [0, deploy * 0.75, 0] });
      set('gateR', { r: [0, -deploy * 0.75, 0] });
      set('carousel', { p: [0, deploy * 0.32, 0], r: [0, deploy * TAU * 2 + work * 0.08, 0] });
      set('crown', { p: [0, deploy * 0.65, 0], r: [work * 0.08, deploy * TAU, 0] });
      set('ram', { p: [0, 0, deploy * 0.35 + work * 0.08] });
      stance(joints, set, t, deploy * 1.5);
    },
    shutdown(t, time, { set }) {
      const down = ease(t, 0.05, 0.82), shudder = Math.sin(t * TAU * 5) * (1 - down);
      set('body', { p: [0, -down * 0.3, down * 0.08], r: [down * 0.12, 0, shudder * 0.018] });
      set('gateL', { r: [0, -down * 0.32, down * 0.12] });
      set('gateR', { r: [0, down * 0.32, -down * 0.12] });
      set('nurseryL', { r: [0, -down * 0.9, down * 0.2] });
      set('nurseryR', { r: [0, down * 0.9, -down * 0.2] });
      set('carousel', { p: [0, -down * 0.24, 0], r: [down * 0.18, down * 0.5, 0] });
      set('crown', { p: [0, -down * 0.42, 0], r: [down * 0.38, 0, 0] });
      set('ram', { p: [0, 0, down * 0.55] });
      for (const id of ['L0', 'R0', 'L1', 'R1', 'L2', 'R2']) {
        set(`knee${id}`, { r: [-down * 0.28, 0, 0] });
        set(`ankle${id}`, { r: [down * 0.3, 0, 0] });
      }
    },
  });
}

function buildMirror(variant) {
  const phase = phaseOf(variant), m = bossMaterials(), joints = {};
  const root = new THREE.Group();
  root.name = `mirror_censor_${variant}`;
  root.userData.phase = phase;
  const body = joint(root, joints, 'body', 'mirror_body');
  hull(body, 'mirror_continuous_shell', [
    { z: -1.8, y: 2.08, w: 2.2, h: 1.6, chamfer: 0.3 },
    { z: -1.3, y: 2.22, w: 3.25, h: 2.2, chamfer: 0.4 },
    { z: -0.2, y: 2.3, w: 3.55, h: 2.38, chamfer: 0.42 },
    { z: 1.0, y: 2.22, w: 3.15, h: 2.05, chamfer: 0.35 },
    { z: 1.78, y: 2.02, w: 2.15, h: 1.35, chamfer: 0.28 },
  ], m.hull);
  hull(body, 'mirror_ventral_spine', [
    { z: -1.5, y: 1.2, w: 1.15, h: 0.55 },
    { z: 0, y: 1.04, w: 1.55, h: 0.65 },
    { z: 1.5, y: 1.22, w: 1.0, h: 0.5 },
  ], m.dark);
  rod(body, 'mirror_skeleton_spine', [0, 1.25, -1.5], [0, 1.25, 1.6], 0.16, m.edge);
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    cable(body, `mirror_${tag}_load_cable`, [[side * 0.8, 3.15, -1.3], [side * 1.65, 3.35, 0], [side * 0.85, 2.85, 1.45]], 0.055, m.gold);
    for (let i = 0; i < 3; i++) {
      panel(body, `mirror_${tag}_shell_scale_${i}`, [[-0.4, -0.42], [0.4, -0.3], [0.48, 0.35], [-0.28, 0.48]], 0.12, [side * 1.67, 2.25, -0.95 + i * 0.95], m.armor, [0, side * Math.PI / 2, side * 0.08], 0.035);
    }
  }
  [-0.95, 0.95].forEach((z, index) => {
    for (const side of SIDES) {
      const key = `${side < 0 ? 'L' : 'R'}${index}`;
      mechanicalLeg(body, joints, m, `mirror_leg_${key}`, key, side, side * 1.35, z, 1.75, { spread: 0.52, drop: 0.62, lower: 0.81, reach: 0.28, width: 0.74 });
    }
  });
  sphere(body, 'mirror_censor_core', 0.58, [0, 2.45, -1.72], m.core, [1, 1.35, 0.45]);
  torus(body, 'mirror_core_retainer', 0.74, 0.1, [0, 2.45, -1.9], m.dark);
  const leftPoints = [[0, -0.86], [-1.14, -0.64], [-1.36, 0.18], [-0.72, 1.1], [0, 1.34]];
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    const mirror = joint(body, joints, `mirror${tag}`, `mirror_primary_${tag}`, [0, 2.43, -1.96], [0, side * (phase - 1) * 0.09, 0]);
    const points = leftPoints.map(([x, y]) => [Math.abs(x) * side, y]);
    panel(mirror, `mirror_primary_back_${tag}`, points, 0.2, [0, 0, 0], m.dark, [0, 0, 0], 0.04);
    panel(mirror, `mirror_primary_face_${tag}`, points.map(([x, y]) => [x * 0.88, y * 0.88]), 0.055, [0, 0, -0.13], m.mirror, [0, 0, 0], 0.018);
    frame(mirror, `mirror_primary_frame_${tag}`, points, -0.16, m.edge, 0.052);
    rod(mirror, `mirror_primary_coral_split_${tag}`, [0, -0.72, -0.17], [side * 1.04, 0.22, -0.17], 0.035, m.accent);
    rod(mirror, `mirror_primary_facet_${tag}`, [side * 1.04, 0.22, -0.17], [side * 0.58, 0.9, -0.17], 0.025, m.gold);
    bearing(mirror, `mirror_primary_axis_${tag}`, 0.16, 0.55, [0, 0.75 * side, 0], m, 'y');
  }
  const scanner = joint(body, joints, 'scanner', 'mirror_scanning_bar', [0, 2.43, -2.18]);
  box(scanner, 'mirror_scanner_crossbar', [2.2, 0.065, 0.075], [0, 0, 0], m.energy, [0, 0, 0], 0.018);
  for (const side of SIDES) crystal(scanner, `mirror_scanner_tip_${side}`, 0.11, [side * 1.13, 0, 0], m.core, [1.3, 0.7, 0.7]);
  const wafer = joint(body, joints, 'wafer', 'mirror_copy_wafer', [0, 2.35, -1.52]);
  const waferPoints = [[-0.42, -0.55], [0.42, -0.55], [0.58, -0.3], [0.58, 0.35], [0.3, 0.58], [-0.3, 0.58], [-0.58, 0.35], [-0.58, -0.3]];
  panel(wafer, 'mirror_wafer_substrate', waferPoints, 0.15, [0, 0, 0], m.gold, [0, 0, 0], 0.025);
  panel(wafer, 'mirror_wafer_blank_signal', waferPoints.map(([x, y]) => [x * 0.78, y * 0.78]), 0.04, [0, 0, -0.11], m.glass, [0, 0, 0], 0.012);
  crystal(wafer, 'mirror_wafer_unwritten_core', 0.25, [0, 0, -0.19], m.core, [0.8, 1.5, 0.45]);
  frame(wafer, 'mirror_wafer_edge', waferPoints, -0.1, m.accent, 0.025);
  const ram = joint(body, joints, 'ram', 'mirror_verdict_ram', [0, 1.55, -1.58]);
  box(ram, 'mirror_ram_yoke', [1.25, 0.32, 0.4], [0, 0, -0.15], m.dark, [0, 0, 0], 0.07);
  for (const x of [-0.45, 0, 0.45]) {
    rod(ram, `mirror_ram_prong_${x}`, [x, 0, -0.15], [x, 0, -1.12], 0.085, m.edge);
    crystal(ram, `mirror_ram_tip_${x}`, 0.17, [x, 0, -1.18], m.accent, [0.75, 0.75, 1.7], [Math.PI / 2, 0, 0]);
  }
  for (const side of SIDES) addMechanicalLink(root, joints, `mirrorRam${side < 0 ? 'L' : 'R'}`, {
    from: { node: body, point: [side * 0.42, 1.55, -0.90] }, to: { node: ram, point: [side * 0.42, 0, -0.10] },
    radius: 0.04, sleeveRadius: 0.09, sleeveLength: 0.17, materials: m,
  });
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    const sideMirror = joint(body, joints, `side${tag}`, `mirror_side_shutter_${tag}`, [side * 1.58, 2.45, -0.58], [0, side * (0.12 + (phase - 1) * 0.43), 0]);
    bearing(sideMirror, `mirror_side_axis_${tag}`, 0.19, 1.0, [0, 0, 0], m, 'y');
    box(sideMirror, `mirror_side_back_${tag}`, [0.16, 1.68, 1.4], [0, 0, 0.72], m.dark, [0, 0, 0], 0.06);
    box(sideMirror, `mirror_side_face_${tag}`, [0.025, 1.4, 1.15], [-side * 0.095, 0, 0.72], m.mirror, [0, 0, 0], 0.012);
    rod(sideMirror, `mirror_side_signal_${tag}`, [-side * 0.12, -0.55, 0.25], [-side * 0.12, 0.55, 1.15], 0.035, m.accent);
    if (phase >= 2) {
      const outer = group(sideMirror, `mirror_copy_leaf_${tag}`, [0, 0, 1.48], [0, side * 0.28, 0]);
      box(outer, `mirror_copy_leaf_back_${tag}`, [0.13, 1.28, 0.92], [0, 0, 0.42], m.armor, [0, 0, 0], 0.05);
      box(outer, `mirror_copy_leaf_face_${tag}`, [0.025, 1.05, 0.72], [-side * 0.08, 0, 0.42], m.mirror, [0, 0, 0], 0.012);
      bearing(outer, `mirror_copy_leaf_axis_${tag}`, 0.13, 0.7, [0, 0, 0], m, 'y');
    }
  }
  const drum = joint(body, joints, 'drum', 'mirror_template_drum', [0, 2.25, 1.62]);
  cylinder(drum, 'mirror_drum_axle', 0.55, 0.55, 0.65, [0, 0, 0], m.dark, [Math.PI / 2, 0, 0]);
  torus(drum, 'mirror_drum_rim_front', 0.76, 0.08, [0, 0, -0.36], m.edge);
  torus(drum, 'mirror_drum_rim_back', 0.76, 0.08, [0, 0, 0.36], m.edge);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    box(drum, `mirror_template_cartridge_${i}`, [0.34, 0.22, 0.82], [Math.sin(a) * 0.72, Math.cos(a) * 0.72, 0], i % 2 ? m.armor : m.gold, [0, 0, -a], 0.035);
    crystal(drum, `mirror_template_mark_${i}`, 0.08, [Math.sin(a) * 0.72, Math.cos(a) * 0.72, -0.46], m.accent);
  }
  const crown = joint(body, joints, 'crown', 'mirror_crown_lift', [0, 3.42, 0.42]);
  for (const side of SIDES) {
    rod(crown, `mirror_crown_upright_${side}`, [side * 0.75, 0, 0], [side * 0.75, 0.72 + phase * 0.18, 0], 0.085, m.gold);
    if (phase >= 3) cable(crown, `mirror_crown_high_arch_${side}`, [[side * 0.75, 0.65, 0], [side * 0.72, 1.55, 0], [0, 1.8, 0]], 0.075, m.edge);
  }
  rod(crown, 'mirror_crown_crossbeam', [-0.75, 0.68 + phase * 0.18, 0], [0.75, 0.68 + phase * 0.18, 0], 0.1, m.dark);
  const crownTilt = joint(crown, joints, 'crownTilt', 'mirror_crown_axle', [0, 0.7 + phase * 0.18, 0]);
  cylinder(crownTilt, 'mirror_crown_axle_shaft', 0.11, 0.11, 2.15, [0, 0, 0], m.edge, [0, 0, Math.PI / 2]);
  const vaneCount = 1 + phase * 2;
  for (let i = 0; i < vaneCount; i++) {
    const x = (i - (vaneCount - 1) / 2) * 0.39;
    const vane = group(crownTilt, `mirror_crown_vane_${i}`, [x, 0.36 + Math.abs(x) * 0.15, 0], [0, (i - (vaneCount - 1) / 2) * 0.13, 0]);
    const points = [[-0.22, -0.35], [0.22, -0.35], [0.3, 0.18], [0, 0.48], [-0.3, 0.18]];
    panel(vane, `mirror_crown_vane_back_${i}`, points, 0.1, [0, 0, 0], m.dark, [0, 0, 0], 0.025);
    panel(vane, `mirror_crown_vane_face_${i}`, points.map(([px, py]) => [px * 0.82, py * 0.82]), 0.03, [0, 0, -0.07], m.mirror, [0, 0, 0], 0.01);
    crystal(vane, `mirror_crown_vane_signal_${i}`, 0.075, [0, 0.43, -0.09], m.energy);
  }
  for (const side of SIDES) addMechanicalLink(root, joints, `mirrorCrownLift${side < 0 ? 'L' : 'R'}`, {
    from: { node: body, point: [side * 0.75, 2.80, 0.42] }, to: { node: crown, point: [side * 0.75, 0.18, 0] },
    radius: 0.045, sleeveRadius: 0.10, sleeveLength: 0.19, materials: m,
  });
  return { root, joints };
}

function mirrorClips(root, joints) {
  return sevenClips(root, joints, {
    idle(t, time, { set }) {
      const wave = Math.sin(TAU * t);
      set('body', { p: [0, wave * 0.03, 0], r: [0, wave * 0.015, wave * 0.012] });
      set('mirrorL', { r: [0, -wave * 0.06, 0] });
      set('mirrorR', { r: [0, wave * 0.06, 0] });
      set('sideL', { r: [0, wave * 0.035, 0] });
      set('sideR', { r: [0, -wave * 0.035, 0] });
      set('scanner', { p: [0, Math.sin(TAU * t * 2) * 0.45, 0] });
      set('drum', { r: [0, 0, t * 0.3] });
      set('crownTilt', { r: [wave * 0.08, 0, 0] });
      stance(joints, set, t, 0.65);
    },
    move(t, time, { set }) {
      const stride = Math.sin(TAU * t * 2);
      set('body', { p: [0, Math.abs(stride) * 0.075, 0], r: [stride * 0.025, 0, Math.sin(TAU * t) * 0.035] });
      set('mirrorL', { r: [0, stride * 0.045, 0] });
      set('mirrorR', { r: [0, -stride * 0.045, 0] });
      set('sideL', { r: [0, -stride * 0.06, 0] });
      set('sideR', { r: [0, stride * 0.06, 0] });
      set('scanner', { p: [0, stride * 0.22, 0] });
      set('drum', { r: [0, 0, t * 0.85] });
      set('crownTilt', { r: [-stride * 0.06, 0, 0] });
      walk(joints, set, t, 0.9);
    },
    attack(t, time, { set }) {
      const hit = pulse(t, 0.04, 0.28, 0.64);
      set('body', { p: [0, -hit * 0.1, hit * 0.18], r: [-hit * 0.12, 0, 0] });
      set('ram', { p: [0, -hit * 0.12, -hit * 0.95] });
      set('mirrorL', { r: [0, hit * 0.52, -hit * 0.08] });
      set('mirrorR', { r: [0, -hit * 0.52, hit * 0.08] });
      set('sideL', { r: [0, -hit * 0.32, 0] });
      set('sideR', { r: [0, hit * 0.32, 0] });
      set('scanner', { p: [0, -hit * 0.65, 0] });
      set('crownTilt', { r: [hit * 0.35, 0, 0] });
      for (const id of ['L0', 'R0', 'L1', 'R1']) {
        set(`knee${id}`, { r: [hit * 0.16, 0, 0] });
        set(`ankle${id}`, { r: [-hit * 0.18, 0, 0] });
      }
    },
    windup(t, time, { set }) {
      const charge = ease(t, 0.02, 0.82), scan = Math.sin(t * TAU * 3);
      set('body', { p: [0, charge * 0.14, charge * 0.1], r: [charge * 0.06, 0, 0] });
      set('mirrorL', { r: [0, -charge * 1.08, 0] });
      set('mirrorR', { r: [0, charge * 1.08, 0] });
      set('sideL', { r: [0, -charge * 0.72, 0] });
      set('sideR', { r: [0, charge * 0.72, 0] });
      set('scanner', { p: [0, scan * 0.72 * charge, -charge * 0.08] });
      set('wafer', { p: [0, charge * 0.12, charge * 0.42], r: [0, charge * 0.35, 0] });
      set('drum', { r: [0, 0, charge * TAU] });
      set('crown', { p: [0, charge * 0.25, 0] });
      set('crownTilt', { r: [-charge * 0.45, charge * 0.3, 0] });
      stance(joints, set, t, charge);
    },
    release(t, time, { set }) {
      const copy = pulse(t, 0.02, 0.35, 0.9), index = ease(t, 0.05, 0.92);
      set('body', { p: [0, -copy * 0.07, copy * 0.12], r: [-copy * 0.055, 0, 0] });
      set('mirrorL', { r: [0, -copy * 1.15, 0] });
      set('mirrorR', { r: [0, copy * 1.15, 0] });
      set('sideL', { r: [0, -copy * 0.5, copy * 0.08] });
      set('sideR', { r: [0, copy * 0.5, -copy * 0.08] });
      set('scanner', { p: [0, -0.75 + index * 1.5, -copy * 0.12] });
      set('wafer', { p: [0, copy * 0.18, -copy * 1.5], r: [0, index * TAU, copy * 0.12] });
      set('drum', { r: [0, 0, -index * TAU * 1.5] });
      set('crownTilt', { r: [copy * 0.4, -index * 0.5, 0] });
      set('ram', { p: [0, 0, -copy * 0.25] });
    },
    ability(t, time, { set }) {
      const deploy = ease(t, 0.02, 0.38), work = Math.sin(TAU * t * 2) * deploy;
      set('body', { p: [0, deploy * 0.12, 0], r: [deploy * 0.035, 0, 0] });
      set('mirrorL', { r: [0, -deploy * 0.8, 0] });
      set('mirrorR', { r: [0, deploy * 0.8, 0] });
      set('sideL', { r: [0, -deploy * 0.95, 0] });
      set('sideR', { r: [0, deploy * 0.95, 0] });
      set('crown', { p: [0, deploy * 0.62, 0] });
      set('crownTilt', { r: [work * 0.22, deploy * TAU * 0.5, 0] });
      set('drum', { r: [0, 0, deploy * TAU * 2] });
      set('scanner', { p: [0, work * 0.72, 0] });
      set('wafer', { p: [0, deploy * 0.15, -deploy * 0.55 + work * 0.15], r: [0, work * 0.25, 0] });
      stance(joints, set, t, deploy);
    },
    shutdown(t, time, { set }) {
      const down = ease(t, 0.04, 0.84);
      set('body', { p: [0, -down * 0.27, down * 0.12], r: [down * 0.13, 0, 0] });
      set('mirrorL', { r: [0, down * 0.45, down * 0.16] });
      set('mirrorR', { r: [0, -down * 0.45, -down * 0.16] });
      set('sideL', { r: [0, down * 1.1, down * 0.12] });
      set('sideR', { r: [0, -down * 1.1, -down * 0.12] });
      set('scanner', { p: [0, -down * 0.85, down * 0.15] });
      set('wafer', { p: [0, -down * 0.25, down * 0.75], r: [down * 0.5, 0, 0] });
      set('drum', { r: [down * 0.35, 0, down * 0.5] });
      set('crown', { p: [0, -down * 0.5, 0] });
      set('crownTilt', { r: [down * 0.8, 0, 0] });
      set('ram', { p: [0, 0, down * 0.5] });
      for (const id of ['L0', 'R0', 'L1', 'R1']) {
        set(`knee${id}`, { r: [-down * 0.3, 0, 0] });
        set(`ankle${id}`, { r: [down * 0.32, 0, 0] });
      }
    },
  });
}

function buildReforger(variant) {
  const phase = phaseOf(variant), m = bossMaterials(), joints = {};
  const root = new THREE.Group();
  root.name = `memory_reforger_${variant}`;
  root.userData.phase = phase;
  const body = joint(root, joints, 'body', 'reforger_body');
  hull(body, 'reforger_continuous_foundry_shell', [
    { z: -1.95, y: 2.1, w: 2.3, h: 1.65, chamfer: 0.3 },
    { z: -1.45, y: 2.28, w: 3.55, h: 2.35, chamfer: 0.4 },
    { z: -0.25, y: 2.4, w: 4.0, h: 2.55, chamfer: 0.44 },
    { z: 1.0, y: 2.3, w: 3.7, h: 2.25, chamfer: 0.4 },
    { z: 2.0, y: 2.08, w: 2.6, h: 1.6, chamfer: 0.3 },
    { z: 2.25, y: 2.0, w: 1.65, h: 1.0, chamfer: 0.22 },
  ], m.hull);
  hull(body, 'reforger_underframe', [
    { z: -1.75, y: 1.15, w: 1.6, h: 0.55 },
    { z: -0.4, y: 1.02, w: 2.2, h: 0.65 },
    { z: 1.65, y: 1.15, w: 1.7, h: 0.58 },
  ], m.dark);
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    rod(body, `reforger_${tag}_main_girder`, [side * 0.85, 1.22, -1.75], [side * 0.85, 1.22, 1.85], 0.17, m.edge);
    cable(body, `reforger_${tag}_heat_main`, [[side * 0.8, 3.25, -1.5], [side * 1.85, 3.45, -0.2], [side * 1.45, 3.05, 1.65]], 0.075, m.gold);
    for (let i = 0; i < 4; i++) {
      box(body, `reforger_${tag}_ablative_scale_${i}`, [0.2, 0.64, 0.78], [side * 1.85, 2.35, -1.25 + i * 0.84], i % 2 ? m.refractory : m.armor, [0, side * 0.06, side * -0.09], 0.055);
      cylinder(body, `reforger_${tag}_shell_rivet_${i}`, 0.055, 0.055, 0.05, [side * 1.97, 2.52, -1.25 + i * 0.84], m.edge, [0, 0, Math.PI / 2], 6);
    }
  }
  [-1.25, 1.25].forEach((z, index) => {
    for (const side of SIDES) {
      const key = `${side < 0 ? 'L' : 'R'}${index}`;
      mechanicalLeg(body, joints, m, `reforger_leg_${key}`, key, side, side * 1.55, z, 1.85, { spread: 0.62, drop: 0.72, lower: 0.81, reach: 0.34, width: 0.9 });
    }
  });
  cylinder(body, 'reforger_kiln_dark_throat', 1.02, 1.02, 0.3, [0, 2.18, -2.03], m.dark, [Math.PI / 2, 0, 0]);
  torus(body, 'reforger_kiln_outer_ring', 1.03, 0.17, [0, 2.18, -2.22], m.refractory);
  torus(body, 'reforger_kiln_hot_seal', 0.79, 0.055, [0, 2.18, -2.36], m.energy);
  const rotor = joint(body, joints, 'rotor', 'reforger_crucible_rotor', [0, 2.18, -2.2]);
  lathe(rotor, 'reforger_crucible_vessel', [[0.48, -0.3], [0.73, -0.2], [0.78, 0.08], [0.63, 0.26], [0.48, 0.28]], [0, 0, 0], m.gold, [Math.PI / 2, 0, 0], 48);
  sphere(rotor, 'reforger_crucible_memory_pool', 0.54, [0, 0, -0.09], m.core, [1, 1, 0.28]);
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12;
    box(rotor, `reforger_rotor_tooth_${i}`, [0.16, 0.3, 0.18], [Math.sin(a) * 0.91, Math.cos(a) * 0.91, 0.03], m.edge, [0, 0, -a], 0.025);
  }
  const gatePoints = [[0, -0.78], [0.82, -0.52], [0.82, 0.52], [0, 0.78]];
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    const gate = joint(body, joints, `gate${tag}`, `reforger_kiln_gate_${tag}`, [side * 0.87, 2.18, -2.39], [0, -side * (0.04 + (phase - 1) * 0.32), 0]);
    const points = gatePoints.map(([x, y]) => [x * -side, y]);
    panel(gate, `reforger_gate_plate_${tag}`, points, 0.18, [0, 0, 0], m.refractory, [0, 0, 0], 0.04);
    frame(gate, `reforger_gate_frame_${tag}`, points, -0.12, m.edge, 0.045);
    for (const y of [-0.42, 0, 0.42]) rod(gate, `reforger_gate_rib_${tag}_${y}`, [0, y, -0.13], [-side * 0.65, y * 0.75, -0.13], 0.045, m.gold);
    bearing(gate, `reforger_gate_axis_${tag}`, 0.17, 0.65, [0, 0, 0.06], m, 'y');
  }
  const hammer = joint(body, joints, 'hammer', 'reforger_press_hammer', [0, 3.55, -2.62]);
  for (const side of SIDES) rod(body, `reforger_press_gantry_${side}`, [side * 0.82, 3.22, -1.30], [side * 0.82, 4.20, -2.62], 0.13, m.hull);
  box(body, 'reforger_press_fixed_header', [1.90, 0.24, 0.70], [0, 4.20, -2.62], m.dark, [0, 0, 0], 0.07);
  box(hammer, 'reforger_hammer_crosshead', [1.35, 0.38, 0.85], [0, -1.0, 0], m.refractory, [0, 0, 0], 0.09);
  addMechanicalLink(root, joints, 'reforgerPressRam', {
    from: { node: body, point: [0, 4.10, -2.62] }, to: { node: hammer, point: [0, -0.78, 0] },
    radius: 0.12, sleeveRadius: 0.27, sleeveLength: 0.48, materials: m,
  });
  for (const side of SIDES) {
    addMechanicalLink(root, joints, `reforgerPressGuide${side < 0 ? 'L' : 'R'}`, {
      from: { node: body, point: [side * 0.52, 4.15, -2.62] }, to: { node: hammer, point: [side * 0.52, -1.0, 0] },
      radius: 0.045, sleeveRadius: 0.10, sleeveLength: 0.40, materials: m,
    });
    crystal(hammer, `reforger_hammer_contact_${side}`, 0.15, [side * 0.4, -1.23, 0], m.accent, [1.3, 0.45, 1.4]);
  }
  for (const side of SIDES) {
    rod(body, `reforger_conveyor_rail_${side}`, [side * 0.94, 0.93, -2.95], [side * 0.94, 0.93, -0.65], 0.09, m.edge);
    rod(body, `reforger_conveyor_signal_${side}`, [side * 1.02, 1.04, -2.85], [side * 1.02, 1.04, -0.8], 0.028, m.accent);
  }
  const rollers = [];
  [-2.55, -2.03, -1.51, -0.99].forEach((z, index) => {
    const roller = joint(body, joints, `roller${index}`, `reforger_conveyor_roller_${index}`, [0, 1.03, z]);
    cylinder(roller, `reforger_roller_drum_${index}`, 0.18, 0.18, 1.78, [0, 0, 0], index % 2 ? m.gold : m.dark, [0, 0, Math.PI / 2], 24);
    for (const side of SIDES) cylinder(roller, `reforger_roller_cap_${index}_${side}`, 0.11, 0.11, 0.12, [side * 0.94, 0, 0], m.accent, [0, 0, Math.PI / 2], 16);
    rollers.push(roller);
  });
  const billet = joint(body, joints, 'billet', 'reforger_memory_billet', [0, 1.36, -2.55]);
  hull(billet, 'reforger_billet_continuous_core', [
    { z: -0.48, y: 0, w: 0.68, h: 0.32, chamfer: 0.08 },
    { z: -0.28, y: 0, w: 0.92, h: 0.44, chamfer: 0.1 },
    { z: 0.35, y: 0, w: 0.92, h: 0.44, chamfer: 0.1 },
    { z: 0.52, y: 0, w: 0.62, h: 0.3, chamfer: 0.07 },
  ], m.gold);
  for (let i = 0; i < 4; i++) box(billet, `reforger_billet_memory_layer_${i}`, [0.74, 0.045, 0.12], [0, 0.24, -0.3 + i * 0.2], i % 2 ? m.core : m.accent, [0, 0, 0], 0.012);
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    const forge = joint(body, joints, `forge${tag}`, `reforger_side_forge_${tag}`, [side * 1.86, 2.18, -0.4], [0, side * (phase - 1) * 0.34, 0]);
    bearing(forge, `reforger_side_forge_axis_${tag}`, 0.22, 1.05, [0, 0, 0], m, 'y');
    box(forge, `reforger_side_forge_case_${tag}`, [0.34, 1.45, 1.65], [0, 0, 0.83], m.refractory, [0, 0, 0], 0.09);
    box(forge, `reforger_side_forge_shield_${tag}`, [0.12, 1.1, 1.28], [side * 0.22, 0, 0.83], m.armor, [0, 0, 0], 0.05);
    cable(forge, `reforger_side_forge_pipe_${tag}`, [[0, 0.5, 0], [side * 0.38, 0.8, 0.7], [side * 0.35, 0.25, 1.55]], 0.07, m.gold);
    if (phase >= 2) {
      cylinder(forge, `reforger_auxiliary_crucible_${tag}`, 0.38, 0.48, 0.85, [side * 0.42, -0.15, 0.85], m.dark);
      torus(forge, `reforger_auxiliary_lip_${tag}`, 0.39, 0.07, [side * 0.42, 0.29, 0.85], m.accent, [Math.PI / 2, 0, 0]);
      sphere(forge, `reforger_auxiliary_memory_${tag}`, 0.29, [side * 0.42, 0.31, 0.85], m.glass, [1, 0.35, 1]);
      for (let i = 0; i < phase; i++) box(forge, `reforger_cooling_fin_${tag}_${i}`, [0.65, 0.08, 0.55], [side * 0.4, 0.55 + i * 0.16, 0.85], m.edge, [0, 0, side * -0.18], 0.02);
    }
    const arm = joint(body, joints, `arm${tag}`, `reforger_manipulator_${tag}`, [side * 1.68, 2.9, -0.72]);
    bearing(arm, `reforger_shoulder_bearing_${tag}`, 0.3, 0.4, [0, 0, 0], m, 'z');
    rod(arm, `reforger_upper_arm_${tag}`, [0, 0, 0], [side * 0.5, -0.56, -0.18], 0.14, m.armor);
    rod(arm, `reforger_upper_arm_ram_${tag}`, [side * 0.05, -0.05, -0.32], [side * 0.42, -0.5, -0.32], 0.055, m.edge);
    const elbow = joint(arm, joints, `elbow${tag}`, `reforger_elbow_${tag}`, [side * 0.5, -0.56, -0.18]);
    bearing(elbow, `reforger_elbow_bearing_${tag}`, 0.22, 0.32, [0, 0, 0], m, 'z');
    rod(elbow, `reforger_forearm_${tag}`, [0, 0, 0], [-side * 0.27, -0.58, -0.34], 0.11, m.gold);
    cable(elbow, `reforger_tool_cable_${tag}`, [[0, 0.12, 0.1], [-side * 0.15, -0.3, -0.1], [-side * 0.27, -0.58, -0.34]], 0.035, m.accent);
    cylinder(elbow, `reforger_tool_nozzle_${tag}`, 0.09, 0.18, 0.42, [-side * 0.27, -0.68, -0.4], m.edge, [0.45, 0, 0]);
    crystal(elbow, `reforger_tool_focus_${tag}`, 0.12, [-side * 0.27, -0.9, -0.48], m.energy, [0.7, 1.4, 0.7]);
  }
  const crown = joint(body, joints, 'crown', 'reforger_stack_crown', [0, 3.55, 0.95]);
  cylinder(crown, 'reforger_crown_base', 0.65, 0.85, 0.42, [0, 0, 0], m.dark);
  torus(crown, 'reforger_crown_base_ring', 0.68, 0.09, [0, 0.22, 0], m.gold, [Math.PI / 2, 0, 0]);
  for (const side of SIDES) {
    cylinder(crown, `reforger_main_stack_${side}`, 0.22, 0.32, 1.2, [side * 0.42, 0.72, 0], m.refractory);
    torus(crown, `reforger_main_stack_lip_${side}`, 0.24, 0.055, [side * 0.42, 1.34, 0], m.accent, [Math.PI / 2, 0, 0]);
    cable(crown, `reforger_stack_feed_${side}`, [[side * 0.42, 0.2, 0], [side * 0.85, 0.5, 0.1], [side * 0.72, 1.15, 0.05]], 0.055, m.edge);
    if (phase >= 2) {
      rod(crown, `reforger_overhead_bridge_${side}`, [side * 0.45, 0.65, 0], [side * 1.55, 0.65, -0.2], 0.12, m.dark);
      cylinder(crown, `reforger_bridge_counterweight_${side}`, 0.24, 0.24, 0.6, [side * 1.4, 0.9, -0.18], m.gold);
    }
    if (phase >= 3) {
      cylinder(crown, `reforger_high_recast_tower_${side}`, 0.26, 0.4, 1.65, [side * 0.95, 1.15, 0.35], m.armor);
      torus(crown, `reforger_high_tower_ring_${side}`, 0.32, 0.07, [side * 0.95, 1.75, 0.35], m.energy, [Math.PI / 2, 0, 0]);
      crystal(crown, `reforger_high_tower_memory_${side}`, 0.22, [side * 0.95, 2.12, 0.35], m.core, [0.8, 1.5, 0.8]);
      arc(crown, `reforger_crown_arch_${side}`, 1.1, 0.09, 0, Math.PI * 0.75, [side * 0.15, 1.25, 0.35], m.gold, [0, side * 0.4, 0]);
    }
  }
  if (phase >= 2) {
    const count = phase === 2 ? 3 : 5;
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * 0.43;
      box(body, `reforger_ready_memory_slab_${i}`, [0.32, 0.72, 0.16], [x, 2.1, 2.15], m.gold, [0.12, 0, 0], 0.035);
      crystal(body, `reforger_ready_memory_mark_${i}`, 0.1, [x, 2.15, 2.26], m.accent, [0.8, 1.5, 0.45]);
    }
  }
  addMechanicalLink(root, joints, 'reforgerCrownLift', {
    from: { node: body, point: [0, 2.70, 0.95] }, to: { node: crown, point: [0, 0, 0] },
    radius: 0.065, sleeveRadius: 0.14, sleeveLength: 0.23, materials: m,
  });
  return { root, joints };
}

function reforgerClips(root, joints) {
  const spinRollers = (set, value) => {
    for (let i = 0; i < 4; i++) set(`roller${i}`, { r: [value * (i % 2 ? 1 : -1), 0, 0] });
  };
  return sevenClips(root, joints, {
    idle(t, time, { set }) {
      const wave = Math.sin(TAU * t);
      set('body', { p: [0, wave * 0.025, 0], r: [wave * 0.01, 0, wave * 0.01] });
      set('rotor', { r: [0, 0, t * 0.55] });
      set('hammer', { p: [0, wave * 0.055, 0] });
      set('billet', { p: [0, wave * 0.025, wave * 0.08] });
      set('armL', { r: [wave * 0.04, 0, wave * 0.06] });
      set('armR', { r: [-wave * 0.04, 0, -wave * 0.06] });
      set('elbowL', { r: [0, 0, -wave * 0.08] });
      set('elbowR', { r: [0, 0, wave * 0.08] });
      set('crown', { r: [0, wave * 0.035, 0] });
      spinRollers(set, t * TAU);
      stance(joints, set, t, 0.55);
    },
    move(t, time, { set }) {
      const stride = Math.sin(TAU * t * 2);
      set('body', { p: [0, Math.abs(stride) * 0.075, 0], r: [stride * 0.02, 0, Math.sin(TAU * t) * 0.035] });
      set('rotor', { r: [0, 0, t * 1.2] });
      set('hammer', { p: [0, Math.abs(stride) * 0.1, 0] });
      set('billet', { p: [0, 0, Math.sin(TAU * t) * 0.22] });
      set('forgeL', { r: [0, stride * 0.035, 0] });
      set('forgeR', { r: [0, -stride * 0.035, 0] });
      set('armL', { r: [stride * 0.08, 0, 0] });
      set('armR', { r: [-stride * 0.08, 0, 0] });
      spinRollers(set, t * TAU * 2);
      walk(joints, set, t, 0.86);
    },
    attack(t, time, { set }) {
      const hit = pulse(t, 0.03, 0.32, 0.68), lift = ease(t, 0, 0.18) * (1 - ease(t, 0.65, 1));
      set('body', { p: [0, -hit * 0.14, hit * 0.1], r: [hit * 0.09, 0, 0] });
      set('hammer', { p: [0, lift * 0.35 - hit * 0.95, -hit * 0.28], r: [hit * 0.08, 0, 0] });
      set('rotor', { r: [0, 0, hit * 1.2] });
      set('gateL', { r: [0, hit * 0.45, 0] });
      set('gateR', { r: [0, -hit * 0.45, 0] });
      set('billet', { p: [0, -hit * 0.08, -hit * 0.55] });
      set('armL', { r: [-hit * 0.28, 0, -hit * 0.35] });
      set('armR', { r: [-hit * 0.28, 0, hit * 0.35] });
      spinRollers(set, hit * 1.8);
      for (const id of ['L0', 'R0', 'L1', 'R1']) {
        set(`knee${id}`, { r: [hit * 0.15, 0, 0] });
        set(`ankle${id}`, { r: [-hit * 0.18, 0, 0] });
      }
    },
    windup(t, time, { set }) {
      const charge = ease(t, 0.02, 0.82), tremor = Math.sin(t * TAU * 5) * charge;
      set('body', { p: [0, charge * 0.1, charge * 0.12], r: [-charge * 0.035, 0, tremor * 0.008] });
      set('gateL', { r: [0, charge * 1.05, 0] });
      set('gateR', { r: [0, -charge * 1.05, 0] });
      set('rotor', { p: [0, 0, -charge * 0.12], r: [0, 0, charge * TAU * 2] });
      set('hammer', { p: [0, charge * 0.52, charge * 0.18] });
      set('billet', { p: [0, charge * 0.12, charge * 0.65], r: [0, charge * 0.3, 0] });
      set('armL', { r: [-charge * 0.5, charge * 0.15, -charge * 0.62] });
      set('armR', { r: [-charge * 0.5, -charge * 0.15, charge * 0.62] });
      set('elbowL', { r: [charge * 0.25, 0, charge * 0.85] });
      set('elbowR', { r: [charge * 0.25, 0, -charge * 0.85] });
      set('forgeL', { r: [0, -charge * 0.35, 0] });
      set('forgeR', { r: [0, charge * 0.35, 0] });
      spinRollers(set, -charge * TAU * 1.5);
      stance(joints, set, t, charge);
    },
    release(t, time, { set }) {
      const forge = pulse(t, 0.02, 0.3, 0.68), deliver = ease(t, 0.15, 0.88);
      set('body', { p: [0, -forge * 0.13, 0], r: [forge * 0.1, 0, 0] });
      set('gateL', { r: [0, (1 - deliver) * 0.85, 0] });
      set('gateR', { r: [0, -(1 - deliver) * 0.85, 0] });
      set('rotor', { r: [0, 0, deliver * TAU * 2.5] });
      set('hammer', { p: [0, 0.45 * (1 - deliver) - forge * 1.05, -forge * 0.25] });
      set('billet', { p: [0, forge * 0.15, 0.55 - deliver * 1.55], r: [0, deliver * TAU * 0.5, 0] });
      set('armL', { r: [-forge * 0.45, 0, -forge * 0.8] });
      set('armR', { r: [-forge * 0.45, 0, forge * 0.8] });
      set('elbowL', { r: [0, 0, forge * 1.05] });
      set('elbowR', { r: [0, 0, -forge * 1.05] });
      set('crown', { p: [0, forge * 0.16, 0], r: [0, deliver * 0.4, 0] });
      spinRollers(set, deliver * TAU * 3);
    },
    ability(t, time, { set }) {
      const deploy = ease(t, 0.02, 0.36), cycle = Math.sin(TAU * t * 3) * deploy;
      set('body', { p: [0, deploy * 0.1, 0], r: [-deploy * 0.025, 0, 0] });
      set('forgeL', { r: [0, -deploy * 0.85, -deploy * 0.08] });
      set('forgeR', { r: [0, deploy * 0.85, deploy * 0.08] });
      set('gateL', { r: [0, deploy * 0.85, 0] });
      set('gateR', { r: [0, -deploy * 0.85, 0] });
      set('crown', { p: [0, deploy * 0.55, 0], r: [0, deploy * 0.4, 0] });
      set('rotor', { r: [0, 0, deploy * TAU * 3] });
      set('hammer', { p: [0, deploy * (0.25 - Math.max(0, cycle) * 0.65), 0] });
      set('billet', { p: [0, deploy * 0.1, deploy * Math.sin(TAU * t) * 0.7] });
      set('armL', { r: [-deploy * 0.35, 0, -deploy * (0.55 + cycle * 0.15)] });
      set('armR', { r: [-deploy * 0.35, 0, deploy * (0.55 + cycle * 0.15)] });
      set('elbowL', { r: [0, 0, deploy * (0.75 - cycle * 0.2)] });
      set('elbowR', { r: [0, 0, -deploy * (0.75 - cycle * 0.2)] });
      spinRollers(set, deploy * TAU * 4);
      stance(joints, set, t, deploy);
    },
    shutdown(t, time, { set }) {
      const down = ease(t, 0.04, 0.85), shudder = Math.sin(t * TAU * 4) * (1 - down);
      set('body', { p: [0, -down * 0.34, down * 0.1], r: [down * 0.12, 0, shudder * 0.012] });
      set('gateL', { r: [0, -down * 0.5, down * 0.15] });
      set('gateR', { r: [0, down * 0.5, -down * 0.15] });
      set('rotor', { p: [0, -down * 0.2, down * 0.2], r: [down * 0.35, 0, down * 0.8] });
      set('hammer', { p: [0, -down * 0.65, down * 0.3], r: [down * 0.18, 0, 0] });
      set('billet', { p: [0, -down * 0.18, down * 1.1], r: [down * 0.35, 0, 0] });
      set('forgeL', { r: [0, down * 0.85, down * 0.18] });
      set('forgeR', { r: [0, -down * 0.85, -down * 0.18] });
      set('armL', { r: [down * 0.5, 0, down * 0.45] });
      set('armR', { r: [down * 0.5, 0, -down * 0.45] });
      set('elbowL', { r: [0, 0, -down * 0.9] });
      set('elbowR', { r: [0, 0, down * 0.9] });
      set('crown', { p: [0, -down * 0.45, 0], r: [down * 0.28, 0, 0] });
      spinRollers(set, down * 0.5);
      for (const id of ['L0', 'R0', 'L1', 'R1']) {
        set(`knee${id}`, { r: [-down * 0.3, 0, 0] });
        set(`ankle${id}`, { r: [down * 0.32, 0, 0] });
      }
    },
  });
}

export const entities = [
  defineEntity({
    id: 'noise_hive',
    name: '噪声母巢',
    kind: 'monster',
    role: 'boss',
    locomotion: 'ground',
    variants: PHASES,
    concept: '六足承重母巢，以连续甲壳保护旋转孵化舱；侧孵化门、茧架与信号冠逐阶段展开。',
    mechanism: '可见的舱门预警与旋转孵化索引召集受限增援；共振撞槌负责近战，卸载时茧架回收、冠架降下。',
    build: buildNoise,
    clips: noiseClips,
  }),
  defineEntity({
    id: 'mirror_censor',
    name: '镜像审查官',
    kind: 'monster',
    role: 'boss',
    locomotion: 'ground',
    variants: PHASES,
    concept: '四足黑银审查机，连续承重壳体前安装双轴镜面、扫描梁和空白信号母版，侧镜与冠架逐阶段展开。',
    mechanism: '镜面和扫描梁先行校准，模板鼓索引后推出复制母版；三叉审查撞槌攻击，停机时母版退膛、镜面闭合。',
    build: buildMirror,
    clips: mirrorClips,
  }),
  defineEntity({
    id: 'memory_reforger',
    name: '记忆重铸机',
    kind: 'monster',
    role: 'boss',
    locomotion: 'ground',
    variants: PHASES,
    concept: '四足移动铸造厂，以连续炉壳、双承重梁和滚筒输送床保护记忆坯锭；侧炉、机械臂及重铸塔逐阶段展开。',
    mechanism: '开炉、旋转坩埚并抬锤进行重铸预警；压锤、双机械臂和输送床协同修复友军与自身，卸载时坯锭退床、锻炉收拢。',
    build: buildReforger,
    clips: reforgerClips,
  }),
];
