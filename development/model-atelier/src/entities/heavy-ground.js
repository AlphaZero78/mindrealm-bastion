import * as THREE from '../../vendor/three/build/three.module.js';
import { defineEntity } from './contract.js';
import {
  palette, group, box, panel, cylinder, sphere, crystal, torus, arc, cable, rod,
  lathe, hull, bearing, fasteners,
} from '../geometry.js';
import { TAU, ease, pulse, smooth, createRigClip } from '../animations.js';
import { addMechanicalLink, withMechanicalLinks } from './mechanical-links.js';

const CLIP_ORDER = ['idle', 'move', 'attack', 'windup', 'release', 'ability', 'shutdown'];
const SIDES = [-1, 1];

function heavyMaterials() {
  const m = palette('enemy');
  m.hull.name = 'Graphite structural metal';
  m.armor.name = 'Dark violet armor laminate';
  m.edge.name = 'Burnished titanium edges';
  m.gold.name = 'Purple nickel actuator alloy';
  m.hull.color.setHex(0x302e38);
  m.armor.color.setHex(0x4b3c53);
  m.edge.color.setHex(0x8b7d90);
  m.gold.color.setHex(0x725a72);
  m.dark.color.setHex(0x17161e);
  m.accent.color.setHex(0xe47a70);
  m.accent.emissive.setHex(0xd95358);
  return m;
}

function makeRoot(id) {
  const root = new THREE.Group();
  root.name = id;
  return root;
}

function makeClips(root, joints, definitions) {
  return CLIP_ORDER.map(name => createRigClip(root, joints, name, definitions[name][0], withMechanicalLinks(root, joints, definitions[name][1]), definitions[name][2]));
}

function gait(api, joints, name, phase, stride = 0.28, bend = 0.42, lift = 0.05) {
  const travel = Math.cos(phase);
  const swing = smooth(Math.max(0, Math.sin(phase)));
  api.set(`${name}Hip`, { r: [travel * stride, 0, 0] });
  api.set(`${name}Knee`, { r: [-bend * swing, 0, 0] });
  api.set(`${name}Ankle`, {
    r: [-travel * stride * 0.72 + bend * swing * 0.58, 0, 0],
  });
  api.set(`${name}Ram`, { s: [1, 1 - swing * 0.16, 1] });
}

function walkerLeg(parent, m, name, side, position, options = {}) {
  const upper = options.upper ?? 0.4;
  const lower = options.lower ?? 0.5;
  const splay = options.splay ?? 0.16;
  const radius = options.radius ?? 0.09;
  const footW = options.footW ?? 0.42;
  const footH = options.footH ?? 0.22;
  const footL = options.footL ?? 0.58;
  const femurTilt = side * Math.atan2(splay, upper - 0.025);
  const femurLength = Math.hypot(splay, upper - 0.025);
  const hip = group(parent, `${name}Hip`, position);
  bearing(hip, `${name}_coxa`, radius * 1.65, radius * 2.5, [0, 0, 0], m, 'x');
  rod(hip, `${name}_load_femur`, [0, -0.025, 0], [side * splay, -upper, 0], radius, m.hull);
  rod(hip, `${name}_parallel_tie`, [side * radius, -0.06, radius], [side * (splay + radius), -upper + 0.035, radius], radius * 0.42, m.edge);
  cylinder(hip, `${name}_femur_sleeve`, radius * 1.2, radius * 1.05, femurLength * 0.42,
    [side * splay * 0.36, -0.025 + (0.025 - upper) * 0.36, 0], m.dark, [0, 0, femurTilt], 20);
  box(hip, `${name}_thigh_laminate`, [radius * 2.8, upper * 0.52, radius * 1.7],
    [side * splay * 0.5, -(upper + 0.025) * 0.5, -radius * 0.85], m.armor, [0, 0, femurTilt]);
  panel(hip, `${name}_thigh_face`, [[-radius, -upper * 0.19], [radius, -upper * 0.16],
    [radius * 0.86, upper * 0.2], [-radius * 0.72, upper * 0.23]], radius * 0.45,
  [side * splay * 0.5, -(upper + 0.025) * 0.5, -radius * 1.82], m.gold, [0, 0, femurTilt]);
  const knee = group(hip, `${name}Knee`, [side * splay, -upper, 0]);
  bearing(knee, `${name}_knee_bearing`, radius * 1.5, radius * 2.65, [0, 0, 0], m, 'x');
  cylinder(knee, `${name}_tibia_cylinder`, radius * 0.94, radius * 1.1, lower * 0.48,
    [0, -lower * 0.25, 0], m.dark, [0, 0, 0], 24);
  cylinder(knee, `${name}_tibia_collar`, radius * 1.22, radius * 1.22, lower * 0.1,
    [0, -lower * 0.47, 0], m.gold, [0, 0, 0], 24);
  rod(knee, `${name}_tibia_spine`, [-side * radius * 0.75, -0.055, 0.02],
    [-side * radius * 0.75, -lower + 0.035, 0.02], radius * 0.5, m.hull);
  box(knee, `${name}_shin_armor`, [radius * 2.45, lower * 0.37, radius * 1.45],
    [0, -lower * 0.36, -radius * 1.03], m.armor, [-0.06, 0, 0]);
  box(knee, `${name}_shin_ridge`, [radius * 0.45, lower * 0.31, radius * 0.4],
    [0, -lower * 0.36, -radius * 1.85], m.edge, [-0.06, 0, 0]);
  const ram = group(knee, `${name}Ram`, [side * radius * 1.05, -lower * 0.41, radius * 0.9]);
  cylinder(ram, `${name}_polished_piston`, radius * 0.38, radius * 0.38, lower * 0.4,
    [0, -lower * 0.18, 0], m.edge, [0, 0, 0], 16);
  cylinder(ram, `${name}_piston_eye`, radius * 0.62, radius * 0.62, radius * 0.6,
    [0, -lower * 0.39, 0], m.accent, [0, 0, Math.PI / 2], 16);
  const ankle = group(knee, `${name}Ankle`, [0, -lower, 0]);
  bearing(ankle, `${name}_ankle_bearing`, radius * 1.12, radius * 2.2, [0, 0, 0], m, 'x');
  hull(ankle, `${name}_foot_casting`, [
    { z: footL * 0.4, w: footW * 0.76, h: footH * 0.68, y: footH * 0.12 },
    { z: 0, w: footW, h: footH, y: 0 },
    { z: -footL * 0.52, w: footW * 1.06, h: footH * 0.72, y: -footH * 0.08 },
  ], m.hull);
  box(ankle, `${name}_metatarsal_plate`, [footW * 0.72, footH * 0.22, footL * 0.55],
    [0, footH * 0.44, -footL * 0.06], m.armor, [0.04, 0, 0]);
  box(ankle, `${name}_toe_signal`, [footW * 0.52, footH * 0.12, 0.035],
    [0, 0, -footL * 0.54], m.accent);
  fasteners(ankle, `${name}_foot_bolts`, [
    [-footW * 0.23, footH * 0.59, -footL * 0.18], [footW * 0.23, footH * 0.59, -footL * 0.18],
    [-footW * 0.23, footH * 0.53, footL * 0.15], [footW * 0.23, footH * 0.53, footL * 0.15],
  ], m.edge, 'y', radius * 0.2);
  return { hip, knee, ankle, ram };
}

function buildArmoredWorm() {
  const root = makeRoot('armored_worm');
  const m = heavyMaterials();
  const joints = {};
  const body = group(root, 'worm_body');
  joints.body = body;
  for (let i = 0; i < 6; i++) {
    const z = -1.2 + i * 0.48;
    const width = 0.82 - Math.abs(i - 2.2) * 0.035;
    const segment = group(body, `worm_segment_${i}`, [0, 0.54, z]);
    joints[`segment${i}`] = segment;
    bearing(segment, `worm_segment_${i}_spinal_bearing`, width * 0.39, 0.15, [0, 0, 0.18], m, 'z');
    hull(segment, `worm_segment_${i}_load_shell`, [
      { z: -0.28, w: width * 0.72, h: 0.34, y: -0.02 },
      { z: -0.15, w: width, h: 0.48, y: 0 },
      { z: 0.18, w: width * 0.96, h: 0.45, y: 0 },
      { z: 0.29, w: width * 0.7, h: 0.31, y: -0.025 },
    ], m.hull);
    panel(segment, `worm_segment_${i}_dorsal_scute`, [
      [-width * 0.36, -0.26], [width * 0.36, -0.26], [width * 0.46, 0.1],
      [width * 0.28, 0.3], [-width * 0.28, 0.3], [-width * 0.46, 0.1],
    ], 0.09, [0, 0.275, 0], m.armor);
    box(segment, `worm_segment_${i}_spine`, [0.15, 0.13, 0.43], [0, 0.325, 0.025], m.gold, [0.03, 0, 0]);
    box(segment, `worm_segment_${i}_signal`, [0.055, 0.035, 0.25], [0, 0.403, -0.025], m.accent);
    fasteners(segment, `worm_segment_${i}_scute_bolts`, [
      [-width * 0.26, 0.34, -0.13], [width * 0.26, 0.34, -0.13],
      [-width * 0.26, 0.34, 0.13], [width * 0.26, 0.34, 0.13],
    ], m.edge, 'y', 0.025);
    for (const side of SIDES) {
      const tag = side < 0 ? 'L' : 'R';
      const plate = group(segment, `worm_plate_${tag}${i}`, [side * width * 0.42, 0.17, 0], [0, 0, side * 0.12]);
      joints[`plate${tag}${i}`] = plate;
      box(plate, `worm_plate_${tag}${i}_outer`, [0.14, 0.35, 0.49],
        [side * 0.075, -0.13, 0], m.armor, [0, 0, -side * 0.09]);
      panel(plate, `worm_plate_${tag}${i}_overlap`, [[-0.22, -0.13], [0.2, -0.1], [0.24, 0.11], [-0.18, 0.15]],
        0.045, [side * 0.155, -0.13, 0], m.gold, [0, side * Math.PI / 2, side * 0.06]);
      box(plate, `worm_plate_${tag}${i}_seam`, [0.026, 0.21, 0.29],
        [side * 0.153, -0.12, -0.035], m.accent);
      const legName = `worm_${tag}${i}_`;
      const leg = walkerLeg(segment, m, legName, side, [side * width * 0.36, 0, 0.02], {
        upper: 0.18, lower: 0.28, splay: 0.15, radius: 0.045,
        footW: 0.24, footH: 0.16, footL: 0.34,
      });
      joints[`${legName}Hip`] = leg.hip;
      joints[`${legName}Knee`] = leg.knee;
      joints[`${legName}Ankle`] = leg.ankle;
      joints[`${legName}Ram`] = leg.ram;
    }
  }
  const head = group(joints.segment0, 'worm_head', [0, 0.015, -0.32]);
  joints.head = head;
  bearing(head, 'worm_head_rotator', 0.34, 0.19, [0, 0, 0.03], m, 'z');
  hull(head, 'worm_head_armored_prow', [
    { z: 0.08, w: 0.74, h: 0.43 },
    { z: -0.25, w: 0.66, h: 0.38, y: -0.025 },
    { z: -0.51, w: 0.4, h: 0.27, y: -0.07 },
  ], m.armor);
  panel(head, 'worm_head_brow', [[-0.29, -0.16], [0.29, -0.16], [0.2, -0.47], [-0.2, -0.47]],
    0.09, [0, 0.225, -0.1], m.gold);
  cylinder(head, 'worm_maw_recess', 0.19, 0.23, 0.18, [0, -0.075, -0.48], m.dark, [Math.PI / 2, 0, 0], 32);
  torus(head, 'worm_maw_signal_ring', 0.185, 0.025, [0, -0.075, -0.58], m.accent);
  addMechanicalLink(root, joints, 'wormNeck', {
    from: { node: joints.segment0, point: [0, 0, 0.14] },
    to: { node: head, point: [0, -0.015, 0.05] },
    radius: 0.085, sleeveRadius: 0.14, sleeveLength: 0.16, overlap: 0.1, materials: m,
  });
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    const jaw = group(head, `worm_jaw_${tag}`, [side * 0.23, -0.09, -0.35], [0, side * 0.15, 0]);
    joints[`jaw${tag}`] = jaw;
    bearing(jaw, `worm_jaw_${tag}_pivot`, 0.095, 0.13, [0, 0, 0], m, 'y');
    hull(jaw, `worm_jaw_${tag}_forging`, [
      { z: 0.04, w: 0.15, h: 0.2, x: 0 },
      { z: -0.24, w: 0.13, h: 0.16, x: -side * 0.035, y: -0.015 },
      { z: -0.48, w: 0.055, h: 0.1, x: -side * 0.12, y: -0.035 },
    ], m.hull);
    panel(jaw, `worm_jaw_${tag}_shear`, [[-0.045, -0.055], [0.045, -0.055], [0.025, 0.16], [-0.025, 0.2]],
      0.055, [-side * 0.09, -0.04, -0.37], m.edge, [0, side * 0.28, 0]);
    crystal(jaw, `worm_jaw_${tag}_sensor`, 0.045, [side * 0.04, 0.07, -0.16], m.energy, [0.7, 0.55, 1.2]);
  }
  const tail = group(joints.segment5, 'worm_tail', [0, -0.015, 0.28]);
  joints.tail = tail;
  bearing(tail, 'worm_tail_coupler', 0.25, 0.16, [0, 0, 0], m, 'z');
  hull(tail, 'worm_tail_anchor', [
    { z: -0.04, w: 0.54, h: 0.36 },
    { z: 0.34, w: 0.36, h: 0.28, y: -0.025 },
    { z: 0.72, w: 0.13, h: 0.18, y: -0.09 },
  ], m.armor);
  panel(tail, 'worm_tail_fluke', [[-0.36, 0.08], [0, -0.19], [0.36, 0.08], [0.15, 0.26], [-0.15, 0.26]],
    0.075, [0, -0.06, 0.61], m.gold, [0.25, 0, 0]);
  box(tail, 'worm_tail_signal', [0.045, 0.04, 0.37], [0, 0.16, 0.3], m.accent);
  return { root, joints };
}

function wormClips(root, joints) {
  const legPhase = (api, phase, stride, bend, lift) => {
    for (let i = 0; i < 6; i++) for (const [sideIndex, tag] of ['L', 'R'].entries()) {
      gait(api, joints, `worm_${tag}${i}_`, phase - i * 0.58 + sideIndex * Math.PI, stride, bend, lift);
    }
  };
  return makeClips(root, joints, {
    idle: [3.2, (u, t, api) => {
      const wave = t * 1.65;
      api.set('body', { p: [0, Math.sin(wave) * 0.012, 0], r: [0, 0, Math.sin(wave * 0.7) * 0.012] });
      for (let i = 0; i < 6; i++) {
        api.set(`segment${i}`, { p: [0, Math.sin(wave - i * 0.52) * 0.018, 0], r: [Math.sin(wave - i * 0.52) * 0.035, Math.sin(wave * 0.6 - i * 0.4) * 0.025, 0] });
        for (const side of SIDES) {
          const tag = side < 0 ? 'L' : 'R';
          api.set(`plate${tag}${i}`, { r: [0, 0, side * Math.sin(wave - i * 0.4) * 0.035] });
          gait(api, joints, `worm_${tag}${i}_`, wave - i * 0.45 + (side > 0 ? Math.PI : 0), 0.025, 0.045, 0.008);
        }
      }
      api.set('head', { r: [Math.sin(wave * 0.8) * 0.055, Math.sin(wave * 0.55) * 0.06, 0] });
      api.set('jawL', { r: [0, -0.08 - Math.sin(wave) * 0.04, 0] });
      api.set('jawR', { r: [0, 0.08 + Math.sin(wave) * 0.04, 0] });
      api.set('tail', { r: [Math.sin(wave - 2.4) * 0.08, Math.sin(wave * 0.65) * 0.13, 0] });
    }],
    move: [1.5, (u, t, api) => {
      const phase = TAU * u;
      api.set('body', { p: [0, Math.cos(phase * 2) * 0.018, Math.sin(phase) * 0.025], r: [0, 0, Math.sin(phase) * 0.018] });
      for (let i = 0; i < 6; i++) {
        api.set(`segment${i}`, { p: [0, Math.sin(phase - i * 0.58) * 0.025, 0], r: [Math.sin(phase - i * 0.58) * 0.055, Math.sin(phase - i * 0.45) * 0.055, 0] });
        for (const side of SIDES) {
          const tag = side < 0 ? 'L' : 'R';
          api.set(`plate${tag}${i}`, { r: [0, 0, side * Math.sin(phase - i * 0.5) * 0.025] });
        }
      }
      legPhase(api, phase, 0.24, 0.5, 0.045);
      api.set('head', { r: [0.06 + Math.sin(phase) * 0.04, Math.sin(phase * 0.5) * 0.045, 0] });
      api.set('tail', { r: [-Math.sin(phase - 2.8) * 0.08, -Math.sin(phase - 2.5) * 0.15, 0] });
    }],
    attack: [1.15, (u, t, api) => {
      const strike = pulse(u, 0, 0.43, 0.86);
      const rear = pulse(u, 0, 0.2, 0.46);
      api.set('body', { p: [0, 0.035 * rear, -0.1 * strike], r: [-0.025 * strike, 0, 0] });
      for (let i = 0; i < 6; i++) {
        const lag = Math.max(0, strike - i * 0.07);
        api.set(`segment${i}`, { p: [0, rear * 0.025 - strike * 0.012, -lag * 0.025], r: [rear * 0.06 - lag * 0.07, Math.sin(i * 0.7) * strike * 0.035, 0] });
        for (const side of SIDES) {
          const tag = side < 0 ? 'L' : 'R';
          gait(api, joints, `worm_${tag}${i}_`, i * 0.8 + (side > 0 ? Math.PI : 0), 0.06 * strike, 0.28 * strike, 0.01);
        }
      }
      api.set('head', { p: [0, 0.07 * rear - 0.06 * strike, -0.3 * strike + 0.1 * rear], r: [0.38 * rear - 0.48 * strike, 0, 0] });
      api.set('jawL', { r: [0, -0.65 * rear + 0.5 * strike, -0.12 * strike] });
      api.set('jawR', { r: [0, 0.65 * rear - 0.5 * strike, 0.12 * strike] });
      api.set('tail', { r: [0.22 * strike, -0.12 * rear, 0] });
    }],
    windup: [1.7, (u, t, api) => {
      const charge = pulse(u, 0, 0.78, 1);
      api.set('body', { p: [0, 0.07 * charge, 0.12 * charge], r: [0.035 * charge, 0, 0] });
      for (let i = 0; i < 6; i++) {
        api.set(`segment${i}`, { p: [0, charge * (0.055 - i * 0.008), charge * 0.018 * i], r: [charge * (0.13 - i * 0.018), -charge * 0.035 * i, 0] });
        for (const side of SIDES) {
          const tag = side < 0 ? 'L' : 'R';
          api.set(`plate${tag}${i}`, { r: [0, 0, side * charge * 0.16] });
          gait(api, joints, `worm_${tag}${i}_`, i * 0.7 + (side > 0 ? Math.PI : 0), 0.04 * charge, 0.38 * charge, 0.015 * charge);
        }
      }
      api.set('head', { p: [0, 0.12 * charge, 0.16 * charge], r: [0.58 * charge, 0, 0] });
      api.set('jawL', { r: [0, -0.8 * charge, 0] });
      api.set('jawR', { r: [0, 0.8 * charge, 0] });
      api.set('tail', { p: [0, -0.08 * charge, -0.08 * charge], r: [-0.36 * charge, 0.25 * charge, 0] });
    }],
    release: [0.9, (u, t, api) => {
      const hit = pulse(u, 0, 0.2, 0.72);
      api.set('body', { p: [0, -0.045 * hit, -0.18 * hit], r: [-0.055 * hit, 0, 0] });
      for (let i = 0; i < 6; i++) {
        const lag = Math.max(0, hit - i * 0.065);
        api.set(`segment${i}`, { p: [0, -0.035 * lag, -0.045 * lag], r: [-0.11 * lag, 0.025 * lag * Math.sin(i), 0] });
        for (const side of SIDES) {
          const tag = side < 0 ? 'L' : 'R';
          gait(api, joints, `worm_${tag}${i}_`, i * 0.7 + (side > 0 ? Math.PI : 0), 0.05 * hit, 0.4 * hit, 0.01);
        }
      }
      api.set('head', { p: [0, -0.02 * hit, -0.38 * hit], r: [-0.24 * hit, 0, 0] });
      api.set('jawL', { r: [0, 0.32 * hit, -0.18 * hit] });
      api.set('jawR', { r: [0, -0.32 * hit, 0.18 * hit] });
      api.set('tail', { r: [0.42 * hit, -0.2 * hit, 0] });
    }],
    ability: [2.25, (u, t, api) => {
      const lock = pulse(u, 0, 0.52, 1);
      api.set('body', { p: [0, -0.065 * lock, 0], r: [0.025 * lock, 0, 0] });
      for (let i = 0; i < 6; i++) {
        api.set(`segment${i}`, { p: [0, -0.012 * lock, -0.018 * lock], r: [0.025 * lock, 0, 0] });
        for (const side of SIDES) {
          const tag = side < 0 ? 'L' : 'R';
          api.set(`plate${tag}${i}`, { r: [0, 0, -side * 0.19 * lock] });
          const name = `worm_${tag}${i}_`;
          api.set(`${name}Hip`, { r: [0.08 * lock * (i % 2 ? -1 : 1), 0, side * 0.13 * lock] });
          api.set(`${name}Knee`, { r: [-0.42 * lock, 0, 0] });
          api.set(`${name}Ankle`, { r: [0.3 * lock, 0, -side * 0.13 * lock] });
          api.set(`${name}Ram`, { s: [1, 1 - 0.22 * lock, 1] });
        }
      }
      api.set('head', { r: [0.22 * lock, 0, 0] });
      api.set('jawL', { r: [0, -0.22 * lock, 0] });
      api.set('jawR', { r: [0, 0.22 * lock, 0] });
      api.set('tail', { r: [-0.4 * lock, 0, 0] });
    }],
    shutdown: [2.8, (u, t, api) => {
      const fall = ease(u, 0.04, 0.76);
      api.set('body', { p: [0, -0.17 * fall, 0.09 * fall], r: [-0.06 * fall, 0, 0.055 * fall] });
      for (let i = 0; i < 6; i++) {
        const drop = ease(u, 0.04 + i * 0.025, 0.72 + i * 0.025);
        api.set(`segment${i}`, { p: [0, -0.025 * drop, 0.016 * i * drop], r: [-0.11 * drop, (i - 2.5) * 0.045 * drop, (i % 2 ? -1 : 1) * 0.045 * drop] });
        for (const side of SIDES) {
          const tag = side < 0 ? 'L' : 'R';
          api.set(`plate${tag}${i}`, { r: [0, 0, side * 0.48 * drop] });
          const name = `worm_${tag}${i}_`;
          api.set(`${name}Hip`, { r: [(i % 2 ? -0.4 : 0.4) * drop, 0, side * 0.28 * drop] });
          api.set(`${name}Knee`, { r: [-0.95 * drop, 0, 0] });
          api.set(`${name}Ankle`, { p: [0, 0.06 * drop, 0], r: [0.62 * drop, 0, -side * 0.2 * drop] });
          api.set(`${name}Ram`, { s: [1, 1 - 0.48 * drop, 1] });
        }
      }
      api.set('head', { p: [0, -0.1 * fall, 0.09 * fall], r: [-0.72 * fall, 0.18 * fall, 0] });
      api.set('jawL', { r: [0.25 * fall, -0.52 * fall, 0] });
      api.set('jawR', { r: [0.25 * fall, 0.52 * fall, 0] });
      api.set('tail', { r: [-0.55 * fall, 0.4 * fall, 0.18 * fall] });
    }],
  });
}

function buildOrderedSentinel() {
  const root = makeRoot('ordered_sentinel');
  const m = heavyMaterials();
  const joints = {};
  const body = group(root, 'sentinel_body');
  joints.body = body;
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    const name = `sentinel_${tag}_`;
    const leg = walkerLeg(body, m, name, side, [side * 0.47, 1.31, 0.12], {
      upper: 0.55, lower: 0.62, splay: 0.14, radius: 0.12,
      footW: 0.53, footH: 0.28, footL: 0.76,
    });
    joints[`${name}Hip`] = leg.hip;
    joints[`${name}Knee`] = leg.knee;
    joints[`${name}Ankle`] = leg.ankle;
    joints[`${name}Ram`] = leg.ram;
  }
  hull(body, 'sentinel_pelvic_cage', [
    { z: 0.38, w: 0.88, h: 0.38, y: 1.38 },
    { z: 0.05, w: 1.04, h: 0.46, y: 1.4 },
    { z: -0.35, w: 0.84, h: 0.36, y: 1.4 },
  ], m.hull);
  bearing(body, 'sentinel_waist_slew', 0.43, 0.22, [0, 1.55, 0.06], m, 'y');
  for (const side of SIDES) {
    rod(body, `sentinel_hip_crossmember_${side}`, [0, 1.42, 0.13], [side * 0.52, 1.32, 0.13], 0.105, m.gold);
    box(body, `sentinel_hip_skirt_${side}`, [0.28, 0.42, 0.54], [side * 0.54, 1.36, 0.02], m.armor, [0, 0, side * 0.16]);
  }
  const torso = group(body, 'sentinel_torso', [0, 1.48, 0.05]);
  joints.torso = torso;
  hull(torso, 'sentinel_torso_cage', [
    { z: 0.38, w: 0.92, h: 0.68, y: 0.39 },
    { z: 0.12, w: 1.3, h: 0.82, y: 0.47 },
    { z: -0.31, w: 1.18, h: 0.75, y: 0.45 },
    { z: -0.47, w: 0.84, h: 0.56, y: 0.4 },
  ], m.hull);
  box(torso, 'sentinel_sternum', [0.19, 0.72, 0.18], [0, 0.48, -0.46], m.gold, [0.08, 0, 0]);
  cylinder(torso, 'sentinel_core_seat', 0.19, 0.23, 0.17, [0, 0.47, -0.52], m.dark, [Math.PI / 2, 0, 0], 32);
  torus(torso, 'sentinel_core_ring', 0.18, 0.028, [0, 0.47, -0.62], m.accent);
  crystal(torso, 'sentinel_core', 0.115, [0, 0.47, -0.625], m.energy, [1, 1.2, 0.5]);
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    const shutter = group(torso, `sentinel_shutter_${tag}`, [side * 0.1, 0.51, -0.47], [0, side * 0.06, 0]);
    joints[`shutter${tag}`] = shutter;
    panel(shutter, `sentinel_shutter_${tag}_plate`, [[0, -0.3], [side * 0.43, -0.24], [side * 0.49, 0.19], [side * 0.12, 0.32]],
      0.1, [0, 0, -0.06], m.armor, [0, 0, -side * 0.05]);
    box(shutter, `sentinel_shutter_${tag}_rib`, [0.08, 0.48, 0.08], [side * 0.29, 0, -0.135], m.edge, [0, 0, side * 0.12]);
    box(shutter, `sentinel_shutter_${tag}_signal`, [0.035, 0.27, 0.035], [side * 0.31, 0.01, -0.184], m.accent, [0, 0, side * 0.12]);
    rod(torso, `sentinel_shoulder_tie_${tag}`, [side * 0.34, 0.66, 0.02], [side * 0.8, 0.63, 0.02], 0.13, m.hull);
    const arm = group(torso, `sentinel_arm_${tag}`, [side * 0.8, 0.61, 0]);
    joints[`arm${tag}`] = arm;
    // The shoulder shell rides on its humeral bearing, preserving the cutout
    // above the rising upper arm throughout its full striking arc.
    const pauldron = group(arm, `sentinel_pauldron_${tag}`, [-side * 0.11, 0.11, 0.02], [0, 0, -side * 0.09]);
    box(pauldron, `sentinel_pauldron_${tag}_lower`, [0.54, 0.25, 0.67], [side * 0.06, -0.05, 0], m.hull);
    panel(pauldron, `sentinel_pauldron_${tag}_cap`, [[-0.3, -0.33], [0.3, -0.33], [0.35, 0.17], [0.17, 0.37], [-0.23, 0.3]],
      0.12, [side * 0.06, 0.15, -0.02], m.armor);
    fasteners(pauldron, `sentinel_pauldron_${tag}_bolts`, [[side * 0.06 - 0.15, 0.24, -0.18], [side * 0.06 + 0.15, 0.24, -0.18],
      [side * 0.06 - 0.15, 0.24, 0.18], [side * 0.06 + 0.15, 0.24, 0.18]], m.edge, 'y', 0.035);
    bearing(arm, `sentinel_arm_${tag}_shoulder`, 0.21, 0.31, [0, 0, 0], m, 'x');
    rod(arm, `sentinel_arm_${tag}_humerus`, [0, -0.05, 0], [side * 0.08, -0.43, 0], 0.12, m.hull);
    cylinder(arm, `sentinel_arm_${tag}_biceps_ram`, 0.075, 0.09, 0.32, [side * 0.14, -0.25, 0.06], m.gold, [0, 0, -side * 0.15], 20);
    box(arm, `sentinel_arm_${tag}_upper_plate`, [0.32, 0.35, 0.28], [side * 0.06, -0.25, -0.1], m.armor, [0, 0, -side * 0.12]);
    const elbow = group(arm, `sentinel_elbow_${tag}`, [side * 0.08, -0.43, 0]);
    joints[`elbow${tag}`] = elbow;
    bearing(elbow, `sentinel_elbow_${tag}_bearing`, 0.17, 0.29, [0, 0, 0], m, 'x');
    cylinder(elbow, `sentinel_elbow_${tag}_hydraulic`, 0.105, 0.125, 0.33, [0, -0.18, 0], m.dark, [0, 0, 0], 24);
    box(elbow, `sentinel_elbow_${tag}_forearm_armor`, [0.37, 0.38, 0.35], [0, -0.24, -0.075], m.armor, [-0.08, 0, 0]);
    box(elbow, `sentinel_elbow_${tag}_forearm_ridge`, [0.09, 0.3, 0.11], [0, -0.25, -0.29], m.gold, [-0.08, 0, 0]);
    const ram = group(elbow, `sentinel_ram_${tag}`, [0, -0.43, -0.02]);
    joints[`ram${tag}`] = ram;
    bearing(ram, `sentinel_ram_${tag}_wrist`, 0.14, 0.25, [0, 0, 0], m, 'x');
    hull(ram, `sentinel_ram_${tag}_fist`, [
      { z: 0.18, w: 0.39, h: 0.31, y: -0.08 },
      { z: -0.12, w: 0.47, h: 0.37, y: -0.1 },
      { z: -0.35, w: 0.38, h: 0.27, y: -0.1 },
    ], m.hull);
    for (let k = -1; k <= 1; k++) {
      box(ram, `sentinel_ram_${tag}_knuckle_${k + 1}`, [0.1, 0.13, 0.14], [k * 0.13, -0.12, -0.36], m.edge);
    }
    box(ram, `sentinel_ram_${tag}_impact_signal`, [0.25, 0.045, 0.04], [0, -0.11, -0.445], m.accent);
    addMechanicalLink(root, joints, `sentinelWrist${tag}`, {
      from: { node: elbow, point: [side * 0.1, -0.12, 0.09] },
      to: { node: ram, point: [side * 0.1, 0, 0.09] },
      radius: 0.036, sleeveRadius: 0.067, sleeveLength: 0.14, materials: m,
    });
  }
  const head = group(torso, 'sentinel_head', [0, 0.99, -0.04]);
  joints.head = head;
  bearing(head, 'sentinel_head_neck', 0.19, 0.18, [0, -0.09, 0], m, 'y');
  hull(head, 'sentinel_sensor_hood', [
    { z: 0.22, w: 0.43, h: 0.29, y: 0.04 },
    { z: -0.08, w: 0.52, h: 0.34, y: 0.05 },
    { z: -0.3, w: 0.36, h: 0.22, y: 0.015 },
  ], m.armor);
  box(head, 'sentinel_sensor_recess', [0.36, 0.095, 0.045], [0, 0.04, -0.315], m.dark);
  for (const x of [-0.11, 0, 0.11]) crystal(head, `sentinel_sensor_${x}`, 0.035, [x, 0.04, -0.345], m.energy, [1, 0.7, 0.45]);
  panel(head, 'sentinel_sensor_peak', [[-0.27, -0.17], [0.27, -0.17], [0.15, -0.34], [-0.15, -0.34]],
    0.07, [0, 0.245, -0.035], m.gold);
  return { root, joints };
}

function sentinelClips(root, joints) {
  const legs = (api, phase, stride, bend, lift) => {
    gait(api, joints, 'sentinel_L_', phase, stride, bend, lift);
    gait(api, joints, 'sentinel_R_', phase + Math.PI, stride, bend, lift);
  };
  return makeClips(root, joints, {
    idle: [3.4, (u, t, api) => {
      const wave = Math.sin(t * 1.55);
      api.set('body', { p: [0, wave * 0.012, 0], r: [0, 0, wave * 0.01] });
      api.set('torso', { r: [wave * 0.018, wave * 0.025, -wave * 0.012] });
      api.set('head', { r: [-wave * 0.025, Math.sin(t * 0.72) * 0.12, 0] });
      legs(api, t * 1.2, 0.018, 0.055, 0.006);
      for (const side of SIDES) {
        const tag = side < 0 ? 'L' : 'R';
        api.set(`arm${tag}`, { r: [0.04 + wave * 0.025 * side, 0, side * 0.035] });
        api.set(`elbow${tag}`, { r: [-0.12 + wave * 0.02, 0, 0] });
        api.set(`ram${tag}`, { p: [0, 0, wave * 0.012], r: [wave * 0.025, 0, 0] });
        api.set(`shutter${tag}`, { r: [0, side * wave * 0.025, 0] });
      }
    }],
    move: [1.65, (u, t, api) => {
      const phase = TAU * u;
      api.set('body', { p: [0, Math.cos(phase * 2) * 0.028, Math.sin(phase) * 0.025], r: [0.025, 0, Math.sin(phase) * 0.035] });
      api.set('torso', { r: [-Math.cos(phase * 2) * 0.025, -Math.sin(phase) * 0.075, -Math.sin(phase) * 0.045] });
      api.set('head', { r: [0.025, Math.sin(phase) * 0.045, 0] });
      legs(api, phase, 0.34, 0.65, 0.09);
      for (const side of SIDES) {
        const tag = side < 0 ? 'L' : 'R';
        const armPhase = phase + (side > 0 ? 0 : Math.PI);
        api.set(`arm${tag}`, { r: [Math.cos(armPhase) * 0.22, 0, side * 0.045] });
        api.set(`elbow${tag}`, { r: [-0.18 - Math.max(0, Math.sin(armPhase)) * 0.18, 0, 0] });
        api.set(`ram${tag}`, { r: [-Math.cos(armPhase) * 0.08, 0, 0] });
        api.set(`shutter${tag}`, { r: [0, side * Math.sin(phase * 2) * 0.018, 0] });
      }
    }],
    attack: [1.2, (u, t, api) => {
      const left = pulse(u, 0, 0.27, 0.52);
      const right = pulse(u, 0.38, 0.68, 0.94);
      api.set('body', { p: [0, -0.035 * (left + right), -0.055 * (left + right)], r: [0.04 * (left + right), 0, 0] });
      api.set('torso', { r: [-0.08 * (left + right), 0.28 * left - 0.32 * right, 0.04 * (left - right)] });
      api.set('head', { r: [0.09 * (left + right), -0.12 * left + 0.14 * right, 0] });
      legs(api, 0.4, 0.11 * (left + right), 0.24 * (left + right), 0.015);
      api.set('armL', { r: [1.18 * left, 0, -0.14 * left] });
      api.set('elbowL', { r: [-0.72 * left, 0, 0] });
      api.set('ramL', { p: [0, 0, -0.27 * left], r: [0.24 * left, 0, 0] });
      api.set('armR', { r: [1.35 * right, 0, 0.14 * right] });
      api.set('elbowR', { r: [-0.82 * right, 0, 0] });
      api.set('ramR', { p: [0, 0, -0.34 * right], r: [0.28 * right, 0, 0] });
      api.set('shutterL', { r: [0, -0.16 * (left + right), 0] });
      api.set('shutterR', { r: [0, 0.16 * (left + right), 0] });
    }, { fps: 60 }],
    windup: [1.65, (u, t, api) => {
      const charge = pulse(u, 0, 0.8, 1);
      api.set('body', { p: [0, -0.12 * charge, 0.09 * charge], r: [-0.045 * charge, 0, 0] });
      api.set('torso', { r: [0.15 * charge, 0.48 * charge, -0.08 * charge] });
      api.set('head', { r: [0.12 * charge, -0.35 * charge, 0] });
      for (const side of SIDES) {
        const tag = side < 0 ? 'L' : 'R';
        const name = `sentinel_${tag}_`;
        api.set(`${name}Hip`, { r: [side * 0.14 * charge, 0, side * 0.1 * charge] });
        api.set(`${name}Knee`, { r: [-0.5 * charge, 0, 0] });
        api.set(`${name}Ankle`, { r: [0.35 * charge, 0, -side * 0.1 * charge] });
        api.set(`${name}Ram`, { s: [1, 1 - 0.25 * charge, 1] });
        api.set(`shutter${tag}`, { r: [0, side * 0.4 * charge, 0] });
      }
      api.set('armR', { r: [-0.78 * charge, -0.18 * charge, 0.28 * charge] });
      api.set('elbowR', { r: [-1.02 * charge, 0, 0] });
      api.set('ramR', { p: [0, 0.04 * charge, 0.25 * charge], r: [-0.25 * charge, 0, 0] });
      api.set('armL', { r: [0.45 * charge, 0, -0.25 * charge] });
      api.set('elbowL', { r: [-0.65 * charge, 0, 0] });
      api.set('ramL', { r: [0.2 * charge, 0, 0] });
    }, { fps: 60 }],
    release: [0.95, (u, t, api) => {
      const hit = pulse(u, 0, 0.19, 0.68);
      api.set('body', { p: [0, -0.09 * hit, -0.16 * hit], r: [0.09 * hit, 0, -0.025 * hit] });
      api.set('torso', { r: [-0.18 * hit, -0.52 * hit, 0.12 * hit] });
      api.set('head', { r: [-0.08 * hit, 0.32 * hit, 0] });
      legs(api, 1.1, 0.16 * hit, 0.5 * hit, 0.02);
      api.set('armR', { r: [1.58 * hit, 0.16 * hit, -0.12 * hit] });
      api.set('elbowR', { r: [-0.25 * hit, 0, 0] });
      api.set('ramR', { p: [0, -0.03 * hit, -0.55 * hit], r: [0.42 * hit, 0, 0] });
      api.set('armL', { r: [-0.35 * hit, 0, -0.3 * hit] });
      api.set('elbowL', { r: [-0.72 * hit, 0, 0] });
      api.set('ramL', { p: [0, 0, 0.08 * hit], r: [-0.18 * hit, 0, 0] });
      api.set('shutterL', { r: [0, -0.28 * hit, 0] });
      api.set('shutterR', { r: [0, 0.28 * hit, 0] });
    }, { fps: 60 }],
    ability: [2.1, (u, t, api) => {
      const lock = pulse(u, 0, 0.52, 1);
      api.set('body', { p: [0, -0.1 * lock, 0.04 * lock], r: [0.055 * lock, 0, 0] });
      api.set('torso', { r: [0.08 * lock, 0, 0] });
      api.set('head', { r: [0.12 * lock, 0, 0] });
      for (const side of SIDES) {
        const tag = side < 0 ? 'L' : 'R';
        const name = `sentinel_${tag}_`;
        api.set(`${name}Hip`, { r: [-0.12 * lock, 0, side * 0.18 * lock] });
        api.set(`${name}Knee`, { r: [-0.55 * lock, 0, 0] });
        api.set(`${name}Ankle`, { r: [0.45 * lock, 0, -side * 0.18 * lock] });
        api.set(`${name}Ram`, { s: [1, 1 - 0.3 * lock, 1] });
        api.set(`shutter${tag}`, { r: [0, -side * 0.12 * lock, -side * 0.08 * lock] });
        api.set(`arm${tag}`, { r: [0.32 * lock, 0, side * 0.3 * lock] });
        api.set(`elbow${tag}`, { r: [-0.85 * lock, 0, 0] });
        api.set(`ram${tag}`, { p: [0, 0, 0.08 * lock], r: [-0.25 * lock, 0, 0] });
      }
    }],
    shutdown: [3, (u, t, api) => {
      const fall = ease(u, 0.04, 0.8);
      api.set('body', { p: [0, -0.48 * fall, 0.16 * fall], r: [-0.18 * fall, 0, 0.09 * fall] });
      api.set('torso', { r: [0.58 * fall, 0.24 * fall, -0.13 * fall] });
      api.set('head', { p: [0, -0.08 * fall, 0.04 * fall], r: [0.7 * fall, -0.32 * fall, 0.16 * fall] });
      for (const side of SIDES) {
        const tag = side < 0 ? 'L' : 'R';
        const name = `sentinel_${tag}_`;
        api.set(`${name}Hip`, { r: [(side < 0 ? 0.55 : -0.28) * fall, 0, side * 0.32 * fall] });
        api.set(`${name}Knee`, { r: [-1.18 * fall, 0, 0] });
        api.set(`${name}Ankle`, { p: [0, 0.09 * fall, 0], r: [0.75 * fall, 0, -side * 0.22 * fall] });
        api.set(`${name}Ram`, { s: [1, 1 - 0.58 * fall, 1] });
        api.set(`shutter${tag}`, { r: [0.2 * fall, side * 0.65 * fall, side * 0.2 * fall] });
        api.set(`arm${tag}`, { r: [-0.38 * fall, 0, side * 0.5 * fall] });
        api.set(`elbow${tag}`, { r: [-0.75 * fall, 0, side * 0.12 * fall] });
        api.set(`ram${tag}`, { p: [0, -0.05 * fall, 0.08 * fall], r: [-0.55 * fall, 0, side * 0.2 * fall] });
      }
    }],
  });
}

function buildTerrainDismantler() {
  const root = makeRoot('terrain_dismantler');
  const m = heavyMaterials();
  const joints = {};
  const body = group(root, 'dismantler_body');
  joints.body = body;
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    for (let i = 0; i < 2; i++) {
      const name = `dismantler_${tag}${i}_`;
      const leg = walkerLeg(body, m, name, side, [side * 0.54, 0.92, i ? 0.53 : -0.43], {
        upper: 0.32, lower: 0.48, splay: 0.22, radius: 0.085,
        footW: 0.4, footH: 0.24, footL: 0.59,
      });
      joints[`${name}Hip`] = leg.hip;
      joints[`${name}Knee`] = leg.knee;
      joints[`${name}Ankle`] = leg.ankle;
      joints[`${name}Ram`] = leg.ram;
      rod(body, `dismantler_${tag}${i}_ chassis_outrigger`, [side * 0.35, 1.01, i ? 0.5 : -0.4],
        [side * 0.56, 0.93, i ? 0.53 : -0.43], 0.11, m.hull);
    }
  }
  hull(body, 'dismantler_belly_frame', [
    { z: 0.91, w: 0.94, h: 0.38, y: 1.02 },
    { z: 0.42, w: 1.24, h: 0.47, y: 1.05 },
    { z: -0.48, w: 1.28, h: 0.5, y: 1.06 },
    { z: -0.91, w: 0.88, h: 0.39, y: 1.04 },
  ], m.hull);
  box(body, 'dismantler_belly_skid', [0.72, 0.18, 1.48], [0, 0.79, 0.04], m.dark);
  for (const side of SIDES) {
    box(body, `dismantler_side_skirt_${side}`, [0.16, 0.4, 1.47], [side * 0.65, 1.08, 0.02], m.armor, [0, 0, side * 0.08]);
    box(body, `dismantler_side_signal_${side}`, [0.035, 0.055, 0.84], [side * 0.744, 1.13, -0.08], m.accent);
  }
  const torso = group(body, 'dismantler_torso', [0, 0.96, 0.1]);
  joints.torso = torso;
  bearing(torso, 'dismantler_deck_slew', 0.52, 0.18, [0, 0.1, 0], m, 'y');
  hull(torso, 'dismantler_upper_cage', [
    { z: 0.72, w: 0.94, h: 0.46, y: 0.32 },
    { z: 0.21, w: 1.14, h: 0.59, y: 0.36 },
    { z: -0.52, w: 1.0, h: 0.55, y: 0.34 },
    { z: -0.72, w: 0.69, h: 0.42, y: 0.31 },
  ], m.armor);
  panel(torso, 'dismantler_deck_laminate', [[-0.48, -0.55], [0.48, -0.55], [0.55, 0.43], [0.35, 0.71], [-0.35, 0.71], [-0.55, 0.43]],
    0.11, [0, 0.675, 0.02], m.gold);
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    const vent = group(torso, `dismantler_vent_${tag}`, [side * 0.48, 0.47, 0.3], [0, 0, side * 0.08]);
    joints[`vent${tag}`] = vent;
    box(vent, `dismantler_vent_${tag}_back`, [0.13, 0.34, 0.48], [side * 0.06, 0, 0], m.dark);
    for (let k = 0; k < 3; k++) {
      box(vent, `dismantler_vent_${tag}_louver_${k}`, [0.17, 0.075, 0.42],
        [side * 0.13, -0.11 + k * 0.11, 0], m.armor, [0, 0, -side * 0.16]);
    }
    box(vent, `dismantler_vent_${tag}_hot_seam`, [0.035, 0.25, 0.31], [side * 0.145, 0, -0.02], m.accent);
  }
  const engine = group(torso, 'dismantler_engine_block', [0, 0.47, 0.52]);
  for (const side of SIDES) {
    cylinder(engine, `dismantler_engine_cylinder_${side}`, 0.14, 0.17, 0.52, [side * 0.25, 0, 0], m.dark, [Math.PI / 2, 0, 0], 28);
    torus(engine, `dismantler_engine_band_${side}`, 0.15, 0.025, [side * 0.25, 0, -0.27], m.gold);
    rod(engine, `dismantler_engine_pushrod_${side}`, [side * 0.25, 0.1, 0.1], [side * 0.25, 0.24, -0.32], 0.035, m.edge);
  }
  cable(torso, 'dismantler_arm_hydraulic_feed', [[-0.28, 0.4, -0.3], [-0.42, 0.55, -0.53], [-0.33, 0.5, -0.79], [-0.24, 0.4, -0.84]], 0.035, m.dark);
  cable(torso, 'dismantler_arm_signal_feed', [[0.28, 0.42, -0.3], [0.42, 0.56, -0.54], [0.33, 0.5, -0.79], [0.24, 0.4, -0.84]], 0.022, m.accent);
  const boom = group(torso, 'dismantler_boom', [0, 0.39, -0.79]);
  joints.boom = boom;
  bearing(boom, 'dismantler_boom_main_pivot', 0.23, 0.74, [0, 0, 0], m, 'x');
  for (const side of SIDES) {
    rod(boom, `dismantler_boom_boxrail_${side}`, [side * 0.23, 0, 0], [side * 0.23, -0.12, -0.73], 0.105, m.hull, 20);
    rod(boom, `dismantler_boom_inner_tie_${side}`, [side * 0.23, 0.09, -0.08], [side * 0.23, 0.015, -0.62], 0.04, m.edge);
    cylinder(boom, `dismantler_boom_ram_sleeve_${side}`, 0.07, 0.085, 0.43,
      [side * 0.34, 0.09, -0.26], m.gold, [Math.PI / 2 - 0.12, 0, 0], 20);
    rod(boom, `dismantler_boom_ram_rod_${side}`, [side * 0.34, 0.12, -0.43], [side * 0.34, 0.04, -0.74], 0.035, m.edge);
  }
  panel(boom, 'dismantler_boom_top_armor', [[-0.28, -0.06], [0.28, -0.06], [0.25, -0.64], [0.13, -0.78], [-0.13, -0.78], [-0.25, -0.64]],
    0.1, [0, 0.135, -0.02], m.armor, [Math.PI / 2 + 0.14, 0, 0]);
  box(boom, 'dismantler_boom_signal_spine', [0.06, 0.055, 0.55], [0, 0.18, -0.36], m.accent, [0.14, 0, 0]);
  const stick = group(boom, 'dismantler_stick', [0, -0.12, -0.73]);
  joints.stick = stick;
  bearing(stick, 'dismantler_stick_elbow', 0.2, 0.65, [0, 0, 0], m, 'x');
  for (const side of SIDES) {
    rod(stick, `dismantler_stick_rail_${side}`, [side * 0.19, 0, 0], [side * 0.15, -0.3, -0.63], 0.09, m.hull, 20);
    panel(stick, `dismantler_stick_cheek_${side}`, [[-0.13, -0.08], [0.13, -0.08], [0.1, -0.57], [-0.04, -0.7], [-0.15, -0.5]],
      0.08, [side * 0.22, -0.1, -0.08], m.armor, [0, side * Math.PI / 2, 0]);
    rod(stick, `dismantler_stick_piston_${side}`, [side * 0.29, 0.11, -0.04], [side * 0.24, -0.17, -0.54], 0.045, m.edge);
  }
  box(stick, 'dismantler_stick_crosshead', [0.54, 0.16, 0.22], [0, -0.29, -0.58], m.gold, [0.2, 0, 0]);
  const breaker = group(stick, 'dismantler_breaker', [0, -0.3, -0.63]);
  joints.breaker = breaker;
  bearing(breaker, 'dismantler_breaker_wrist', 0.19, 0.58, [0, 0, 0], m, 'x');
  hull(breaker, 'dismantler_breaker_gearcase', [
    { z: 0.15, w: 0.59, h: 0.43 },
    { z: -0.11, w: 0.73, h: 0.55 },
    { z: -0.34, w: 0.54, h: 0.4 },
  ], m.hull);
  box(breaker, 'dismantler_breaker_top_laminate', [0.48, 0.13, 0.43], [0, 0.31, -0.08], m.armor, [0.06, 0, 0]);
  const cutter = group(breaker, 'dismantler_cutter', [0, 0, -0.32]);
  joints.cutter = cutter;
  cylinder(cutter, 'dismantler_cutter_axle', 0.13, 0.13, 0.36, [0, 0, 0], m.edge, [Math.PI / 2, 0, 0], 24);
  cylinder(cutter, 'dismantler_cutter_hub', 0.26, 0.31, 0.19, [0, 0, -0.05], m.dark, [Math.PI / 2, 0, 0], 40);
  torus(cutter, 'dismantler_cutter_outer_race', 0.34, 0.055, [0, 0, -0.16], m.gold);
  torus(cutter, 'dismantler_cutter_signal_race', 0.245, 0.022, [0, 0, -0.225], m.accent);
  crystal(cutter, 'dismantler_cutter_core', 0.16, [0, 0, -0.23], m.energy, [1, 1, 0.45]);
  for (let k = 0; k < 10; k++) {
    const a = k * TAU / 10;
    panel(cutter, `dismantler_cutter_tooth_${k}`, [[-0.065, 0.27], [0.065, 0.27], [0.105, 0.43], [0, 0.54], [-0.105, 0.43]],
      0.12, [0, 0, -0.13], k % 2 ? m.edge : m.armor, [0, 0, a]);
  }
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    const jaw = group(breaker, `dismantler_jaw_${tag}`, [side * 0.34, -0.04, -0.08], [0, 0, side * 0.08]);
    joints[`jaw${tag}`] = jaw;
    bearing(jaw, `dismantler_jaw_${tag}_pivot`, 0.12, 0.18, [0, 0, 0], m, 'z');
    hull(jaw, `dismantler_jaw_${tag}_forging`, [
      { z: 0.07, w: 0.18, h: 0.32 },
      { z: -0.28, w: 0.16, h: 0.25, x: -side * 0.04, y: -0.06 },
      { z: -0.58, w: 0.09, h: 0.16, x: -side * 0.13, y: -0.1 },
    ], m.armor);
    rod(jaw, `dismantler_jaw_${tag}_actuator`, [side * 0.08, 0.09, 0.02], [side * 0.08, 0.02, -0.38], 0.045, m.edge);
    for (let k = 0; k < 3; k++) {
      box(jaw, `dismantler_jaw_${tag}_tooth_${k}`, [0.12, 0.1, 0.09],
        [-side * (0.07 + k * 0.018), -0.14, -0.25 - k * 0.13], m.edge, [0, side * 0.25, side * 0.15]);
    }
  }
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    const brace = group(body, `dismantler_brace_${tag}`, [side * 0.66, 0.8, 0.51], [0, 0, -side * 0.08]);
    joints[`brace${tag}`] = brace;
    bearing(brace, `dismantler_brace_${tag}_hinge`, 0.13, 0.24, [0, 0, 0], m, 'x');
    rod(brace, `dismantler_brace_${tag}_spar`, [0, 0, 0], [side * 0.25, -0.57, 0.1], 0.075, m.hull);
    cylinder(brace, `dismantler_brace_${tag}_ram`, 0.055, 0.07, 0.38, [side * 0.14, -0.3, 0.12], m.gold, [0, 0, -side * 0.36], 20);
    box(brace, `dismantler_brace_${tag}_shoe`, [0.34, 0.2, 0.43], [side * 0.25, -0.67, 0.1], m.armor);
    box(brace, `dismantler_brace_${tag}_cleat`, [0.25, 0.12, 0.12], [side * 0.25, -0.77, -0.04], m.edge);
  }
  const anchor = group(body, 'dismantler_anchor', [0, 0.88, 0.88]);
  joints.anchor = anchor;
  bearing(anchor, 'dismantler_anchor_gimbal', 0.18, 0.42, [0, 0, 0], m, 'x');
  cylinder(anchor, 'dismantler_anchor_hydraulic', 0.1, 0.13, 0.4, [0, -0.22, 0.08], m.dark, [0.15, 0, 0], 24);
  rod(anchor, 'dismantler_anchor_rod', [0, -0.3, 0.11], [0, -0.49, 0.15], 0.052, m.edge);
  hull(anchor, 'dismantler_anchor_shoe', [
    { z: 0.25, w: 0.46, h: 0.18, y: -0.48 },
    { z: -0.08, w: 0.59, h: 0.2, y: -0.5 },
    { z: -0.32, w: 0.27, h: 0.15, y: -0.52 },
  ], m.armor);
  box(anchor, 'dismantler_anchor_signal', [0.24, 0.04, 0.05], [0, -0.49, -0.34], m.accent);
  return { root, joints };
}

function dismantlerClips(root, joints) {
  const names = ['dismantler_L0_', 'dismantler_R0_', 'dismantler_L1_', 'dismantler_R1_'];
  const walk = (api, phase, stride, bend, lift) => names.forEach((name, i) => gait(api, joints, name, phase + [0, Math.PI, Math.PI, 0][i], stride, bend, lift));
  return makeClips(root, joints, {
    idle: [3.3, (u, t, api) => {
      const wave = Math.sin(t * 1.45);
      api.set('body', { p: [0, wave * 0.012, 0], r: [0, 0, wave * 0.009] });
      api.set('torso', { r: [wave * 0.012, wave * 0.02, 0] });
      api.set('boom', { r: [0.025 * wave, 0.015 * wave, 0] });
      api.set('stick', { r: [-0.035 * wave, 0, 0] });
      api.set('breaker', { r: [0.04 * wave, 0, 0] });
      api.set('cutter', { r: [0, 0, 0.08 * Math.sin(t * 0.8)] });
      api.set('jawL', { r: [0, 0, -0.04 - 0.035 * wave] });
      api.set('jawR', { r: [0, 0, 0.04 + 0.035 * wave] });
      walk(api, t * 1.1, 0.015, 0.045, 0.005);
      for (const side of SIDES) {
        const tag = side < 0 ? 'L' : 'R';
        api.set(`vent${tag}`, { r: [0, 0, side * (0.04 + wave * 0.025)] });
        api.set(`brace${tag}`, { r: [0.02 * wave, 0, 0] });
      }
      api.set('anchor', { r: [0.025 * wave, 0, 0] });
    }],
    move: [1.8, (u, t, api) => {
      const phase = TAU * u;
      api.set('body', { p: [0, Math.cos(phase * 2) * 0.02, 0], r: [0.02, Math.sin(phase) * 0.015, Math.sin(phase) * 0.025] });
      api.set('torso', { r: [-0.02, -Math.sin(phase) * 0.025, -Math.sin(phase) * 0.02] });
      walk(api, phase, 0.25, 0.53, 0.065);
      api.set('boom', { r: [0.08 + Math.sin(phase) * 0.035, 0, 0] });
      api.set('stick', { r: [-0.1 - Math.sin(phase) * 0.045, 0, 0] });
      api.set('breaker', { r: [0.06 + Math.cos(phase) * 0.035, 0, 0] });
      api.set('cutter', { r: [0, 0, Math.sin(phase) * 0.15] });
      api.set('jawL', { r: [0, 0, -0.1] });
      api.set('jawR', { r: [0, 0, 0.1] });
      for (const side of SIDES) {
        const tag = side < 0 ? 'L' : 'R';
        api.set(`vent${tag}`, { r: [0, 0, side * (0.06 + Math.sin(phase * 2) * 0.02)] });
        api.set(`brace${tag}`, { r: [-0.14, 0, side * 0.12] });
      }
      api.set('anchor', { p: [0, 0.12, 0], r: [-0.35, 0, 0] });
    }],
    attack: [1.55, (u, t, api) => {
      const rear = pulse(u, 0, 0.25, 0.48);
      const chop = pulse(u, 0.28, 0.55, 0.9);
      api.set('body', { p: [0, -0.04 * chop, -0.07 * chop + 0.025 * rear], r: [0.04 * chop, 0, 0] });
      api.set('torso', { r: [-0.06 * chop + 0.04 * rear, 0.06 * rear, 0] });
      api.set('boom', { r: [0.42 * rear - 0.58 * chop, 0, 0] });
      api.set('stick', { r: [-0.46 * rear + 0.78 * chop, 0, 0] });
      api.set('breaker', { r: [0.22 * rear - 0.42 * chop, 0, 0.08 * chop] });
      api.set('cutter', { r: [0, 0, TAU * 2 * u] });
      api.set('jawL', { r: [0, 0, -0.52 * rear + 0.44 * chop] });
      api.set('jawR', { r: [0, 0, 0.52 * rear - 0.44 * chop] });
      walk(api, 0.6, 0.08 * chop, 0.32 * chop, 0.015);
      api.set('braceL', { r: [0.18 * chop, 0, -0.12 * chop] });
      api.set('braceR', { r: [0.18 * chop, 0, 0.12 * chop] });
      api.set('anchor', { p: [0, -0.26 * chop, 0], r: [0.12 * chop, 0, 0] });
      api.set('ventL', { r: [0, 0, -0.35 * chop] });
      api.set('ventR', { r: [0, 0, 0.35 * chop] });
    }],
    windup: [2, (u, t, api) => {
      const charge = pulse(u, 0, 0.82, 1);
      api.set('body', { p: [0, -0.08 * charge, 0.08 * charge], r: [-0.035 * charge, 0, 0] });
      api.set('torso', { r: [0.09 * charge, 0, 0] });
      api.set('boom', { r: [0.55 * charge, 0, 0] });
      api.set('stick', { r: [-0.68 * charge, 0, 0] });
      api.set('breaker', { r: [0.35 * charge, 0, 0] });
      api.set('cutter', { r: [0, 0, TAU * charge] });
      api.set('jawL', { r: [0, 0, -0.72 * charge] });
      api.set('jawR', { r: [0, 0, 0.72 * charge] });
      names.forEach((name, i) => {
        const side = name.includes('_L') ? -1 : 1;
        api.set(`${name}Hip`, { r: [(i < 2 ? -0.12 : 0.12) * charge, 0, side * 0.13 * charge] });
        api.set(`${name}Knee`, { r: [-0.42 * charge, 0, 0] });
        api.set(`${name}Ankle`, { r: [0.32 * charge, 0, -side * 0.13 * charge] });
        api.set(`${name}Ram`, { s: [1, 1 - 0.24 * charge, 1] });
      });
      api.set('braceL', { p: [0, -0.08 * charge, 0], r: [0.28 * charge, 0, -0.16 * charge] });
      api.set('braceR', { p: [0, -0.08 * charge, 0], r: [0.28 * charge, 0, 0.16 * charge] });
      api.set('anchor', { p: [0, -0.3 * charge, 0], r: [0.18 * charge, 0, 0] });
      api.set('ventL', { r: [0, 0, -0.65 * charge] });
      api.set('ventR', { r: [0, 0, 0.65 * charge] });
    }],
    release: [1, (u, t, api) => {
      const hit = pulse(u, 0, 0.18, 0.68);
      api.set('body', { p: [0, -0.1 * hit, -0.15 * hit], r: [0.095 * hit, 0, 0] });
      api.set('torso', { r: [-0.12 * hit, 0, 0] });
      api.set('boom', { r: [-0.78 * hit, 0, 0] });
      api.set('stick', { r: [1.0 * hit, 0, 0] });
      api.set('breaker', { r: [-0.55 * hit, 0, -0.12 * hit] });
      api.set('cutter', { r: [0, 0, TAU * 3 * u] });
      api.set('jawL', { r: [0.12 * hit, 0, 0.35 * hit] });
      api.set('jawR', { r: [0.12 * hit, 0, -0.35 * hit] });
      walk(api, 0.9, 0.12 * hit, 0.48 * hit, 0.02);
      api.set('braceL', { p: [0, -0.1 * hit, 0], r: [0.34 * hit, 0, -0.2 * hit] });
      api.set('braceR', { p: [0, -0.1 * hit, 0], r: [0.34 * hit, 0, 0.2 * hit] });
      api.set('anchor', { p: [0, -0.3 * hit, 0], r: [0.25 * hit, 0, 0] });
      api.set('ventL', { r: [0, 0, -0.75 * hit] });
      api.set('ventR', { r: [0, 0, 0.75 * hit] });
    }],
    ability: [2.6, (u, t, api) => {
      const drive = pulse(u, 0, 0.45, 1);
      api.set('body', { p: [0, -0.075 * drive, -0.04 * drive], r: [0.05 * drive, 0, 0] });
      api.set('torso', { r: [-0.04 * drive, Math.sin(t * 3) * 0.025 * drive, 0] });
      api.set('boom', { r: [-0.32 * drive + Math.sin(t * 4) * 0.04 * drive, 0, 0] });
      api.set('stick', { r: [0.5 * drive, 0, 0] });
      api.set('breaker', { r: [-0.18 * drive, 0, Math.sin(t * 5) * 0.05 * drive] });
      api.set('cutter', { r: [0, 0, TAU * 4 * u] });
      api.set('jawL', { r: [0, 0, (-0.25 + Math.sin(t * 5) * 0.18) * drive] });
      api.set('jawR', { r: [0, 0, (0.25 - Math.sin(t * 5) * 0.18) * drive] });
      names.forEach((name, i) => {
        const side = name.includes('_L') ? -1 : 1;
        api.set(`${name}Hip`, { r: [(i < 2 ? -0.1 : 0.1) * drive, 0, side * 0.15 * drive] });
        api.set(`${name}Knee`, { r: [-0.4 * drive, 0, 0] });
        api.set(`${name}Ankle`, { r: [0.3 * drive, 0, -side * 0.15 * drive] });
        api.set(`${name}Ram`, { s: [1, 1 - 0.25 * drive, 1] });
      });
      api.set('braceL', { p: [0, -0.08 * drive, 0], r: [0.3 * drive, 0, -0.16 * drive] });
      api.set('braceR', { p: [0, -0.08 * drive, 0], r: [0.3 * drive, 0, 0.16 * drive] });
      api.set('anchor', { p: [0, -0.3 * drive, 0], r: [0.2 * drive, 0, 0] });
      api.set('ventL', { r: [0, 0, -0.85 * drive] });
      api.set('ventR', { r: [0, 0, 0.85 * drive] });
    }],
    shutdown: [3.1, (u, t, api) => {
      const fall = ease(u, 0.04, 0.8);
      api.set('body', { p: [0, -0.3 * fall, 0.1 * fall], r: [-0.11 * fall, 0.06 * fall, 0.08 * fall] });
      api.set('torso', { r: [0.3 * fall, -0.15 * fall, -0.06 * fall] });
      api.set('boom', { r: [-0.58 * fall, 0.12 * fall, 0] });
      api.set('stick', { r: [0.85 * fall, 0, 0.1 * fall] });
      api.set('breaker', { r: [0.62 * fall, 0, -0.2 * fall] });
      api.set('cutter', { r: [0.25 * fall, 0, 0.45 * fall] });
      api.set('jawL', { r: [0.35 * fall, 0, -0.58 * fall] });
      api.set('jawR', { r: [0.35 * fall, 0, 0.58 * fall] });
      names.forEach((name, i) => {
        const side = name.includes('_L') ? -1 : 1;
        api.set(`${name}Hip`, { r: [(i % 2 ? -0.4 : 0.4) * fall, 0, side * 0.32 * fall] });
        api.set(`${name}Knee`, { r: [-1.05 * fall, 0, 0] });
        api.set(`${name}Ankle`, { p: [0, 0.07 * fall, 0], r: [0.7 * fall, 0, -side * 0.24 * fall] });
        api.set(`${name}Ram`, { s: [1, 1 - 0.5 * fall, 1] });
      });
      api.set('braceL', { r: [-0.5 * fall, 0, -0.5 * fall] });
      api.set('braceR', { r: [-0.5 * fall, 0, 0.5 * fall] });
      api.set('anchor', { p: [0, -0.18 * fall, 0], r: [0.55 * fall, 0, 0] });
      api.set('ventL', { r: [0.4 * fall, 0, -0.3 * fall] });
      api.set('ventR', { r: [0.4 * fall, 0, 0.3 * fall] });
    }],
  });
}

function buildEntropyEngine() {
  const root = makeRoot('entropy_engine');
  const m = heavyMaterials();
  const joints = {};
  const body = group(root, 'entropy_body');
  joints.body = body;
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    for (let i = 0; i < 3; i++) {
      const name = `entropy_${tag}${i}_`;
      const z = -0.58 + i * 0.58;
      const leg = walkerLeg(body, m, name, side, [side * 0.62, 1.12, z], {
        upper: 0.38, lower: 0.58, splay: 0.24, radius: 0.1,
        footW: 0.46, footH: 0.32, footL: 0.68,
      });
      joints[`${name}Hip`] = leg.hip;
      joints[`${name}Knee`] = leg.knee;
      joints[`${name}Ankle`] = leg.ankle;
      joints[`${name}Ram`] = leg.ram;
      rod(body, `entropy_${tag}${i}_load_path`, [side * 0.36, 1.23, z * 0.85], [side * 0.64, 1.13, z], 0.12, m.hull);
      box(body, `entropy_${tag}${i}_hip_guard`, [0.27, 0.3, 0.42], [side * 0.69, 1.28, z], m.armor, [0, 0, side * 0.12]);
    }
  }
  hull(body, 'entropy_lower_hull', [
    { z: 0.98, w: 1.0, h: 0.45, y: 1.22 },
    { z: 0.44, w: 1.43, h: 0.57, y: 1.24 },
    { z: -0.46, w: 1.48, h: 0.6, y: 1.24 },
    { z: -0.96, w: 1.02, h: 0.43, y: 1.2 },
  ], m.hull);
  box(body, 'entropy_keel', [0.54, 0.24, 1.78], [0, 0.94, 0], m.dark);
  for (const side of SIDES) {
    panel(body, `entropy_skirt_${side}`, [[-0.72, -0.2], [0.66, -0.18], [0.82, 0.12], [0.53, 0.28], [-0.61, 0.24]],
      0.12, [side * 0.72, 1.27, 0], m.armor, [0, side * Math.PI / 2, side * 0.05]);
    box(body, `entropy_skirt_signal_${side}`, [0.035, 0.055, 1.06], [side * 0.795, 1.3, -0.04], m.accent);
  }
  const torso = group(body, 'entropy_torso', [0, 1.15, 0.05]);
  joints.torso = torso;
  bearing(torso, 'entropy_deck_bearing', 0.63, 0.22, [0, 0.12, 0], m, 'y');
  hull(torso, 'entropy_reactor_citadel', [
    { z: 0.69, w: 0.98, h: 0.56, y: 0.38 },
    { z: 0.25, w: 1.27, h: 0.69, y: 0.4 },
    { z: -0.42, w: 1.15, h: 0.62, y: 0.37 },
    { z: -0.65, w: 0.78, h: 0.45, y: 0.33 },
  ], m.armor);
  panel(torso, 'entropy_citadel_crown', [[-0.48, -0.52], [0.48, -0.52], [0.58, 0.28], [0.33, 0.66], [-0.33, 0.66], [-0.58, 0.28]],
    0.12, [0, 0.77, 0.02], m.gold);
  box(torso, 'entropy_reactor_aft_saddle', [0.54, 0.16, 0.62], [0, 0.5, 0.64], m.dark);
  const reactor = group(torso, 'entropy_reactor', [0, 0.58, 0.74]);
  joints.reactor = reactor;
  lathe(reactor, 'entropy_reactor_socket', [[0.19, -0.12], [0.35, -0.1], [0.42, 0], [0.38, 0.1], [0.24, 0.15]], [0, 0, 0], m.dark, [0, 0, 0], 48);
  sphere(reactor, 'entropy_reactor_core', 0.205, [0, 0.28, 0], m.energy, [1, 1.15, 1]);
  torus(reactor, 'entropy_reactor_equator', 0.29, 0.035, [0, 0.28, 0], m.accent, [Math.PI / 2, 0, 0]);
  for (let k = 0; k < 4; k++) {
    arc(reactor, `entropy_reactor_cage_${k}`, 0.4, 0.035, 0, Math.PI, [0, 0.08, 0], m.gold, [0, k * Math.PI / 4, 0]);
  }
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    const vent = group(torso, `entropy_vent_${tag}`, [side * 0.56, 0.51, -0.18], [0, 0, side * 0.1]);
    joints[`vent${tag}`] = vent;
    box(vent, `entropy_vent_${tag}_well`, [0.19, 0.41, 0.51], [side * 0.05, 0, 0], m.dark);
    for (let k = 0; k < 4; k++) {
      box(vent, `entropy_vent_${tag}_fin_${k}`, [0.24, 0.055, 0.45], [side * 0.15, -0.15 + k * 0.1, 0], m.armor, [0, 0, -side * 0.2]);
    }
    box(vent, `entropy_vent_${tag}_thermal_line`, [0.035, 0.32, 0.34], [side * 0.185, 0, -0.015], m.accent);
    cable(torso, `entropy_reactor_conduit_${tag}`, [[side * 0.23, 0.63, 0.74], [side * 0.44, 0.73, 0.52], [side * 0.48, 0.68, -0.29], [side * 0.34, 0.7, -0.49]], 0.035, m.gold);
  }
  const turret = group(torso, 'entropy_turret', [0, 0.72, -0.48]);
  joints.turret = turret;
  cylinder(turret, 'entropy_turret_ring', 0.54, 0.61, 0.2, [0, 0, 0], m.dark, [0, 0, 0], 48);
  torus(turret, 'entropy_turret_signal_ring', 0.55, 0.025, [0, 0.11, 0], m.accent, [Math.PI / 2, 0, 0]);
  hull(turret, 'entropy_turret_cradle', [
    { z: 0.4, w: 0.79, h: 0.39, y: 0.19 },
    { z: 0.02, w: 1.01, h: 0.46, y: 0.22 },
    { z: -0.38, w: 0.72, h: 0.37, y: 0.2 },
  ], m.hull);
  for (const side of SIDES) {
    rod(turret, `entropy_elevation_tie_${side}`, [side * 0.39, 0.15, 0.13], [side * 0.47, 0.42, -0.21], 0.09, m.gold);
    bearing(turret, `entropy_elevation_trunnion_${side}`, 0.18, 0.18, [side * 0.46, 0.38, -0.22], m, 'x');
  }
  const gun = group(turret, 'entropy_gun', [0, 0.37, -0.22], [0.06, 0, 0]);
  joints.gun = gun;
  const breech = group(gun, 'entropy_breech', [0, 0, 0.2]);
  joints.breech = breech;
  hull(breech, 'entropy_breech_block', [
    { z: 0.35, w: 0.65, h: 0.49 },
    { z: 0.02, w: 0.86, h: 0.59 },
    { z: -0.29, w: 0.68, h: 0.48 },
  ], m.armor);
  box(breech, 'entropy_breech_top rib', [0.17, 0.15, 0.58], [0, 0.35, 0.03], m.gold, [0.03, 0, 0]);
  for (const side of SIDES) {
    cylinder(breech, `entropy_breech_accumulator_${side}`, 0.12, 0.15, 0.51, [side * 0.44, -0.06, 0.02], m.dark, [Math.PI / 2, 0, 0], 28);
    torus(breech, `entropy_breech_band_${side}`, 0.135, 0.025, [side * 0.44, -0.06, -0.25], m.accent);
  }
  const barrel = group(gun, 'entropy_barrel', [0, 0, -0.13]);
  joints.barrel = barrel;
  for (const side of SIDES) {
    box(barrel, `entropy_barrel_rail_${side}`, [0.16, 0.2, 1.46], [side * 0.22, 0, -0.69], m.hull, [0, 0, side * 0.025]);
    box(barrel, `entropy_barrel_laminate_${side}`, [0.11, 0.12, 1.19], [side * 0.27, 0.15, -0.66], m.armor, [0, 0, side * 0.025]);
    rod(barrel, `entropy_barrel_tensioner_${side}`, [side * 0.31, -0.12, -0.05], [side * 0.31, -0.12, -1.34], 0.035, m.edge);
  }
  cylinder(barrel, 'entropy_barrel_liner', 0.105, 0.13, 1.44, [0, 0, -0.72], m.dark, [Math.PI / 2, 0, 0], 32);
  cylinder(barrel, 'entropy_barrel_signal_core', 0.055, 0.055, 1.35, [0, 0, -0.77], m.energy, [Math.PI / 2, 0, 0], 24);
  for (let k = 0; k < 4; k++) {
    const z = -0.2 - k * 0.36;
    torus(barrel, `entropy_barrel_brace_${k}`, 0.29, 0.035, [0, 0, z], k % 2 ? m.gold : m.armor);
    box(barrel, `entropy_barrel_bridge_${k}`, [0.68, 0.09, 0.1], [0, 0.24, z], m.gold);
  }
  const muzzle = group(barrel, 'entropy_muzzle', [0, 0, -1.47]);
  joints.muzzle = muzzle;
  cylinder(muzzle, 'entropy_muzzle_socket', 0.3, 0.25, 0.27, [0, 0, 0], m.dark, [Math.PI / 2, 0, 0], 40);
  torus(muzzle, 'entropy_muzzle_outer_race', 0.31, 0.045, [0, 0, -0.15], m.edge);
  torus(muzzle, 'entropy_muzzle_signal_race', 0.22, 0.024, [0, 0, -0.19], m.accent);
  crystal(muzzle, 'entropy_muzzle_focus', 0.13, [0, 0, -0.18], m.energy, [1, 1, 0.6]);
  for (let k = 0; k < 8; k++) {
    panel(muzzle, `entropy_muzzle_prong_${k}`, [[-0.045, 0.21], [0.045, 0.21], [0.075, 0.39], [0, 0.47], [-0.075, 0.39]],
      0.22, [0, 0, -0.04], k % 2 ? m.armor : m.gold, [0, 0, k * TAU / 8]);
  }
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    const bank = group(gun, `entropy_charge_bank_${tag}`, [side * 0.53, -0.05, -0.03]);
    cylinder(bank, `entropy_charge_bank_${tag}_housing`, 0.15, 0.17, 0.72, [0, 0, -0.12], m.dark, [Math.PI / 2, 0, 0], 32);
    for (const z of [-0.45, 0.2]) torus(bank, `entropy_charge_bank_${tag}_band_${z}`, 0.17, 0.03, [0, 0, z], m.gold);
    rod(bank, `entropy_charge_bank_${tag}_tie`, [-side * 0.09, -0.12, 0.19], [-side * 0.09, -0.12, -0.47], 0.035, m.edge);
    const charge = group(bank, `entropy_charge_${tag}`, [0, 0, -0.12]);
    joints[`charge${tag}`] = charge;
    cylinder(charge, `entropy_charge_${tag}_core`, 0.082, 0.082, 0.58, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0], 24);
    for (const z of [-0.22, 0, 0.22]) torus(charge, `entropy_charge_${tag}_coil_${z}`, 0.105, 0.018, [0, 0, z], m.accent);
  }
  const anchor = group(body, 'entropy_anchor', [0, 1.0, 0.96]);
  joints.anchor = anchor;
  bearing(anchor, 'entropy_anchor_hinge', 0.19, 0.55, [0, 0, 0], m, 'x');
  for (const side of SIDES) {
    rod(anchor, `entropy_anchor_fork_${side}`, [side * 0.2, 0, 0], [side * 0.26, -0.4, 0.16], 0.075, m.hull);
    rod(anchor, `entropy_anchor_piston_${side}`, [side * 0.12, -0.05, -0.06], [side * 0.26, -0.43, 0.12], 0.04, m.edge);
  }
  box(anchor, 'entropy_anchor_crosshead', [0.68, 0.16, 0.25], [0, -0.4, 0.15], m.gold);
  hull(anchor, 'entropy_anchor_shoe', [
    { z: 0.37, w: 0.59, h: 0.18, y: -0.51 },
    { z: 0.02, w: 0.79, h: 0.2, y: -0.53 },
    { z: -0.31, w: 0.43, h: 0.17, y: -0.54 },
  ], m.armor);
  for (const x of [-0.25, 0, 0.25]) box(anchor, `entropy_anchor_cleat_${x}`, [0.12, 0.14, 0.27], [x, -0.66, 0.03], m.edge, [0.15, 0, 0]);
  box(anchor, 'entropy_anchor_signal', [0.36, 0.045, 0.04], [0, -0.52, -0.33], m.accent);
  return { root, joints };
}

function entropyClips(root, joints) {
  const names = ['entropy_L0_', 'entropy_R0_', 'entropy_L1_', 'entropy_R1_', 'entropy_L2_', 'entropy_R2_'];
  const offsets = [0, Math.PI, Math.PI, 0, 0, Math.PI];
  const walk = (api, phase, stride, bend, lift) => names.forEach((name, i) => gait(api, joints, name, phase + offsets[i], stride, bend, lift));
  const brace = (api, amount) => names.forEach((name, i) => {
    const side = name.includes('_L') ? -1 : 1;
    api.set(`${name}Hip`, { r: [(i < 2 ? -0.12 : i > 3 ? 0.12 : 0) * amount, 0, side * 0.16 * amount] });
    api.set(`${name}Knee`, { r: [-0.46 * amount, 0, 0] });
    api.set(`${name}Ankle`, { r: [0.35 * amount, 0, -side * 0.16 * amount] });
    api.set(`${name}Ram`, { s: [1, 1 - 0.28 * amount, 1] });
  });
  return makeClips(root, joints, {
    idle: [3.6, (u, t, api) => {
      const wave = Math.sin(t * 1.35);
      api.set('body', { p: [0, wave * 0.012, 0], r: [0, 0, wave * 0.008] });
      api.set('torso', { r: [wave * 0.012, 0, -wave * 0.008] });
      api.set('reactor', { r: [0, t * 0.16, 0], s: [1 + wave * 0.025, 1 + wave * 0.04, 1 + wave * 0.025] });
      api.set('turret', { r: [0, Math.sin(t * 0.55) * 0.055, 0] });
      api.set('gun', { r: [wave * 0.018, 0, 0] });
      api.set('breech', { r: [0, wave * 0.012, 0] });
      api.set('barrel', { p: [0, 0, wave * 0.012] });
      api.set('muzzle', { r: [0, 0, Math.sin(t * 0.8) * 0.055] });
      walk(api, t * 1.05, 0.012, 0.04, 0.004);
      for (const side of SIDES) {
        const tag = side < 0 ? 'L' : 'R';
        api.set(`charge${tag}`, { s: [1 + wave * 0.06 * side, 1 + wave * 0.06 * side, 1 + wave * 0.09] });
        api.set(`vent${tag}`, { r: [0, 0, side * (0.035 + wave * 0.025)] });
      }
      api.set('anchor', { r: [wave * 0.018, 0, 0] });
    }],
    move: [2.05, (u, t, api) => {
      const phase = TAU * u;
      api.set('body', { p: [0, Math.cos(phase * 2) * 0.022, 0], r: [0.018, Math.sin(phase) * 0.012, Math.sin(phase) * 0.022] });
      api.set('torso', { r: [-0.015, -Math.sin(phase) * 0.02, -Math.sin(phase) * 0.018] });
      api.set('reactor', { r: [0, phase * 0.25, 0], s: [1, 1 + Math.sin(phase * 2) * 0.025, 1] });
      walk(api, phase, 0.22, 0.48, 0.065);
      api.set('turret', { r: [0, -Math.sin(phase) * 0.025, 0] });
      api.set('gun', { r: [0.04 + Math.cos(phase * 2) * 0.018, 0, 0] });
      api.set('breech', { r: [Math.sin(phase) * 0.015, 0, 0] });
      api.set('barrel', { p: [0, 0, Math.sin(phase) * 0.02] });
      api.set('muzzle', { r: [0, 0, Math.sin(phase) * 0.08] });
      for (const side of SIDES) {
        const tag = side < 0 ? 'L' : 'R';
        api.set(`charge${tag}`, { s: [1, 1, 1 + Math.sin(phase + side) * 0.04] });
        api.set(`vent${tag}`, { r: [0, 0, side * (0.08 + Math.sin(phase * 2) * 0.025)] });
      }
      api.set('anchor', { p: [0, 0.14, 0], r: [-0.48, 0, 0] });
    }],
    attack: [1.4, (u, t, api) => {
      const shot = pulse(u, 0, 0.3, 0.72);
      const recover = pulse(u, 0.4, 0.72, 1);
      api.set('body', { p: [0, -0.05 * shot, 0.1 * shot], r: [-0.04 * shot, 0, 0] });
      api.set('torso', { r: [-0.055 * shot, 0.025 * shot, 0] });
      api.set('reactor', { r: [0, 0.3 * shot, 0], s: [1 + 0.14 * shot, 1 + 0.2 * shot, 1 + 0.14 * shot] });
      api.set('turret', { r: [0, -0.04 * shot, 0] });
      api.set('gun', { r: [-0.11 * shot + 0.04 * recover, 0, 0] });
      api.set('breech', { p: [0, 0, 0.08 * shot], r: [-0.06 * shot, 0, 0] });
      api.set('barrel', { p: [0, 0, 0.38 * shot - 0.08 * recover] });
      api.set('muzzle', { r: [0, 0, 0.45 * shot], s: [1 + 0.18 * shot, 1 + 0.18 * shot, 1 + 0.1 * shot] });
      walk(api, 0.7, 0.06 * shot, 0.34 * shot, 0.01);
      api.set('chargeL', { p: [0, 0, 0.14 * shot], s: [1 + 0.2 * shot, 1 + 0.2 * shot, 1 - 0.32 * shot] });
      api.set('chargeR', { p: [0, 0, 0.14 * shot], s: [1 + 0.2 * shot, 1 + 0.2 * shot, 1 - 0.32 * shot] });
      api.set('ventL', { r: [0, 0, -0.62 * shot] });
      api.set('ventR', { r: [0, 0, 0.62 * shot] });
      api.set('anchor', { p: [0, -0.22 * shot, 0], r: [0.2 * shot, 0, 0] });
    }],
    windup: [2.4, (u, t, api) => {
      const charge = pulse(u, 0, 0.86, 1);
      const flicker = Math.sin(t * 13) * 0.04 * charge;
      api.set('body', { p: [0, -0.09 * charge, 0.07 * charge], r: [0.035 * charge, 0, 0] });
      api.set('torso', { r: [0.06 * charge, 0, 0] });
      api.set('reactor', { r: [0, charge * TAU, 0], s: [1 + 0.24 * charge + flicker, 1 + 0.32 * charge, 1 + 0.24 * charge + flicker] });
      api.set('turret', { r: [0, 0, 0] });
      api.set('gun', { r: [0.27 * charge, 0, 0] });
      api.set('breech', { p: [0, 0.035 * charge, -0.04 * charge], r: [0.08 * charge, 0, 0] });
      api.set('barrel', { p: [0, 0, 0.16 * charge] });
      api.set('muzzle', { r: [0, 0, charge * TAU * 1.5], s: [1 + 0.12 * charge, 1 + 0.12 * charge, 1] });
      brace(api, charge);
      api.set('chargeL', { p: [0, 0, -0.18 * charge], s: [1 + 0.32 * charge + flicker, 1 + 0.32 * charge + flicker, 1 + 0.55 * charge] });
      api.set('chargeR', { p: [0, 0, -0.18 * charge], s: [1 + 0.32 * charge - flicker, 1 + 0.32 * charge - flicker, 1 + 0.55 * charge] });
      api.set('ventL', { r: [0, 0, -0.85 * charge] });
      api.set('ventR', { r: [0, 0, 0.85 * charge] });
      api.set('anchor', { p: [0, -0.29 * charge, 0], r: [0.28 * charge, 0, 0] });
    }],
    release: [1.05, (u, t, api) => {
      const hit = pulse(u, 0, 0.16, 0.66);
      api.set('body', { p: [0, -0.11 * hit, 0.2 * hit], r: [-0.085 * hit, 0, 0.02 * hit] });
      api.set('torso', { r: [-0.1 * hit, 0.035 * hit, 0] });
      api.set('reactor', { r: [0, -0.5 * hit, 0], s: [1 - 0.14 * hit, 1 - 0.2 * hit, 1 - 0.14 * hit] });
      api.set('turret', { r: [0, -0.05 * hit, 0] });
      api.set('gun', { r: [-0.16 * hit, 0, 0] });
      api.set('breech', { p: [0, -0.03 * hit, 0.15 * hit], r: [-0.12 * hit, 0, 0] });
      api.set('barrel', { p: [0, 0, 0.62 * hit] });
      api.set('muzzle', { r: [0, 0, -0.8 * hit], s: [1 + 0.42 * hit, 1 + 0.42 * hit, 1 + 0.16 * hit] });
      brace(api, hit);
      api.set('chargeL', { p: [0, 0, 0.25 * hit], s: [1 + 0.15 * hit, 1 + 0.15 * hit, 1 - 0.62 * hit] });
      api.set('chargeR', { p: [0, 0, 0.25 * hit], s: [1 + 0.15 * hit, 1 + 0.15 * hit, 1 - 0.62 * hit] });
      api.set('ventL', { r: [0, 0, -1.0 * hit] });
      api.set('ventR', { r: [0, 0, 1.0 * hit] });
      api.set('anchor', { p: [0, -0.29 * hit, 0], r: [0.34 * hit, 0, 0] });
    }],
    ability: [2.8, (u, t, api) => {
      const siege = pulse(u, 0, 0.45, 1);
      const cycle = Math.sin(t * 5) * siege;
      api.set('body', { p: [0, -0.085 * siege, 0.04 * siege], r: [0.04 * siege, 0, 0] });
      api.set('torso', { r: [0.035 * siege, cycle * 0.025, 0] });
      api.set('reactor', { r: [0, TAU * 2 * u, 0], s: [1 + 0.18 * siege + cycle * 0.04, 1 + 0.28 * siege, 1 + 0.18 * siege + cycle * 0.04] });
      api.set('turret', { r: [0, cycle * 0.09, 0] });
      api.set('gun', { r: [(0.19 + cycle * 0.035) * siege, 0, 0] });
      api.set('breech', { r: [cycle * 0.035, 0, 0] });
      api.set('barrel', { p: [0, 0, (-0.06 + cycle * 0.035) * siege] });
      api.set('muzzle', { r: [0, 0, TAU * 2 * u], s: [1 + 0.16 * siege, 1 + 0.16 * siege, 1] });
      brace(api, siege);
      api.set('chargeL', { p: [0, 0, -0.14 * siege], s: [1 + 0.22 * siege + cycle * 0.08, 1 + 0.22 * siege + cycle * 0.08, 1 + 0.4 * siege] });
      api.set('chargeR', { p: [0, 0, -0.14 * siege], s: [1 + 0.22 * siege - cycle * 0.08, 1 + 0.22 * siege - cycle * 0.08, 1 + 0.4 * siege] });
      api.set('ventL', { r: [0, 0, -0.9 * siege] });
      api.set('ventR', { r: [0, 0, 0.9 * siege] });
      api.set('anchor', { p: [0, -0.29 * siege, 0], r: [0.3 * siege, 0, 0] });
    }],
    shutdown: [3.2, (u, t, api) => {
      const fall = ease(u, 0.04, 0.82);
      api.set('body', { p: [0, -0.39 * fall, 0.15 * fall], r: [-0.13 * fall, 0.05 * fall, 0.085 * fall] });
      api.set('torso', { r: [0.34 * fall, -0.18 * fall, -0.08 * fall] });
      api.set('reactor', { p: [0, -0.1 * fall, 0], r: [0.35 * fall, 0.4 * fall, 0], s: [1 - 0.55 * fall, 1 - 0.65 * fall, 1 - 0.55 * fall] });
      api.set('turret', { r: [0, 0.42 * fall, 0.08 * fall] });
      api.set('gun', { r: [-0.72 * fall, 0, 0.1 * fall] });
      api.set('breech', { p: [0, -0.08 * fall, 0.12 * fall], r: [0.32 * fall, 0, 0] });
      api.set('barrel', { p: [0, -0.04 * fall, 0.38 * fall], r: [0.12 * fall, 0, 0] });
      api.set('muzzle', { r: [0.18 * fall, 0, 0.55 * fall], s: [1 - 0.25 * fall, 1 - 0.25 * fall, 1 - 0.25 * fall] });
      names.forEach((name, i) => {
        const side = name.includes('_L') ? -1 : 1;
        api.set(`${name}Hip`, { r: [(i % 2 ? -0.42 : 0.42) * fall, 0, side * 0.35 * fall] });
        api.set(`${name}Knee`, { r: [-1.12 * fall, 0, 0] });
        api.set(`${name}Ankle`, { p: [0, 0.08 * fall, 0], r: [0.76 * fall, 0, -side * 0.26 * fall] });
        api.set(`${name}Ram`, { s: [1, 1 - 0.56 * fall, 1] });
      });
      api.set('chargeL', { p: [0, -0.08 * fall, 0.12 * fall], r: [0.35 * fall, 0, 0], s: [1 - 0.7 * fall, 1 - 0.7 * fall, 1 - 0.7 * fall] });
      api.set('chargeR', { p: [0, -0.08 * fall, 0.12 * fall], r: [0.35 * fall, 0, 0], s: [1 - 0.7 * fall, 1 - 0.7 * fall, 1 - 0.7 * fall] });
      api.set('ventL', { r: [0.45 * fall, 0, -0.35 * fall] });
      api.set('ventR', { r: [0.45 * fall, 0, 0.35 * fall] });
      api.set('anchor', { p: [0, -0.16 * fall, 0], r: [0.7 * fall, 0, 0.15 * fall] });
    }],
  });
}

function buildShieldConductor() {
  const root = makeRoot('shield_conductor');
  const m = heavyMaterials();
  const joints = {};
  const body = group(root, 'shield_body');
  joints.body = body;
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    for (let i = 0; i < 2; i++) {
      const name = `shield_${tag}${i}_`;
      const z = i ? 0.43 : -0.43;
      const leg = walkerLeg(body, m, name, side, [side * 0.47, 0.82, z], {
        upper: 0.28, lower: 0.43, splay: 0.19, radius: 0.07,
        footW: 0.34, footH: 0.22, footL: 0.51,
      });
      joints[`${name}Hip`] = leg.hip;
      joints[`${name}Knee`] = leg.knee;
      joints[`${name}Ankle`] = leg.ankle;
      joints[`${name}Ram`] = leg.ram;
      rod(body, `shield_${tag}${i}_chassis_tie`, [side * 0.25, 0.93, z * 0.8], [side * 0.48, 0.83, z], 0.085, m.hull);
    }
  }
  hull(body, 'shield_lower_frame', [
    { z: 0.73, w: 0.72, h: 0.33, y: 0.94 },
    { z: 0.28, w: 1.08, h: 0.42, y: 0.96 },
    { z: -0.36, w: 1.1, h: 0.43, y: 0.96 },
    { z: -0.71, w: 0.72, h: 0.32, y: 0.94 },
  ], m.hull);
  box(body, 'shield_belly_keel', [0.48, 0.17, 1.23], [0, 0.72, 0], m.dark);
  for (const side of SIDES) {
    panel(body, `shield_side_laminate_${side}`, [[-0.51, -0.14], [0.45, -0.15], [0.58, 0.09], [0.3, 0.21], [-0.43, 0.18]],
      0.09, [side * 0.54, 0.99, 0], m.armor, [0, side * Math.PI / 2, side * 0.05]);
    box(body, `shield_side_signal_${side}`, [0.03, 0.045, 0.65], [side * 0.6, 1.01, -0.03], m.accent);
  }
  const generator = group(body, 'shield_generator', [0, 0.93, 0.06]);
  joints.generator = generator;
  bearing(generator, 'shield_generator_slew', 0.45, 0.17, [0, 0.08, 0], m, 'y');
  lathe(generator, 'shield_generator_armored_socket', [[0.25, 0.08], [0.5, 0.11], [0.55, 0.23], [0.48, 0.36], [0.32, 0.43]],
    [0, 0, 0], m.armor, [0, 0, 0], 56);
  torus(generator, 'shield_generator_lower_race', 0.48, 0.04, [0, 0.26, 0], m.gold, [Math.PI / 2, 0, 0]);
  for (let k = 0; k < 6; k++) {
    const a = k * TAU / 6;
    const x = Math.sin(a), z = Math.cos(a);
    rod(generator, `shield_generator_spoke_${k}`, [x * 0.22, 0.25, z * 0.22], [x * 0.48, 0.35, z * 0.48], 0.045, m.hull);
    cylinder(generator, `shield_generator_bolt_${k}`, 0.035, 0.035, 0.04, [x * 0.43, 0.39, z * 0.43], m.edge, [0, 0, 0], 6);
  }
  const core = group(generator, 'shield_core', [0, 0.29, 0]);
  joints.core = core;
  cylinder(core, 'shield_core_containment', 0.18, 0.23, 0.52, [0, 0.13, 0], m.dark, [0, 0, 0], 32);
  crystal(core, 'shield_core_crystal', 0.22, [0, 0.21, 0], m.energy, [0.78, 1.5, 0.78]);
  for (const y of [-0.06, 0.16, 0.38]) torus(core, `shield_core_coil_${y}`, 0.24, 0.025, [0, y, 0], m.accent, [Math.PI / 2, 0, 0]);
  for (const side of SIDES) {
    const tag = side < 0 ? 'L' : 'R';
    const capacitor = group(generator, `shield_capacitor_${tag}`, [side * 0.48, 0.31, 0.04], [0, 0, -side * 0.09]);
    joints[`capacitor${tag}`] = capacitor;
    cylinder(capacitor, `shield_capacitor_${tag}_case`, 0.13, 0.16, 0.47, [0, 0, 0], m.dark, [0, 0, 0], 28);
    cylinder(capacitor, `shield_capacitor_${tag}_cell`, 0.072, 0.072, 0.39, [0, 0, 0], m.energy, [0, 0, 0], 20);
    for (const y of [-0.22, 0.22]) torus(capacitor, `shield_capacitor_${tag}_band_${y}`, 0.14, 0.025, [0, y, 0], m.gold, [Math.PI / 2, 0, 0]);
    rod(capacitor, `shield_capacitor_${tag}_feed`, [-side * 0.09, 0.17, 0], [-side * 0.27, 0.27, 0], 0.032, m.accent);
  }
  const crown = group(generator, 'shield_crown', [0, 0.62, 0]);
  joints.crown = crown;
  bearing(crown, 'shield_crown_gimbal', 0.31, 0.17, [0, 0, 0], m, 'y');
  addMechanicalLink(root, joints, 'shieldCrownStem', {
    from: { node: generator, point: [0, 0, 0] },
    to: { node: crown, point: [0, 0, 0] },
    radius: 0.07, sleeveRadius: 0.12, sleeveLength: 0.16, overlap: 0.09, materials: m,
  });
  cylinder(crown, 'shield_crown_hub', 0.27, 0.34, 0.22, [0, 0.12, 0], m.hull, [0, 0, 0], 40);
  crystal(crown, 'shield_crown_focus', 0.17, [0, 0.3, 0], m.core, [0.85, 1.25, 0.85]);
  const ring = group(crown, 'shield_ring', [0, 0.1, 0]);
  joints.ring = ring;
  torus(ring, 'shield_ring_inner', 0.37, 0.035, [0, 0, 0], m.gold, [Math.PI / 2, 0, 0]);
  torus(ring, 'shield_ring_signal', 0.45, 0.018, [0, 0.025, 0], m.accent, [Math.PI / 2, 0, 0]);
  for (let k = 0; k < 6; k++) {
    const a = k * TAU / 6;
    const x = Math.sin(a), z = Math.cos(a);
    rod(ring, `shield_ring_spoke_${k}`, [x * 0.27, 0, z * 0.27], [x * 0.45, 0, z * 0.45], 0.025, m.edge);
    const azimuth = group(crown, `shield_azimuth_${k}`, [x * 0.36, 0.1, z * 0.36], [0, a, 0]);
    const petal = group(azimuth, `shield_petal_${k}`, [0, 0, 0], [-0.78, 0, 0]);
    joints[`petal${k}`] = petal;
    bearing(petal, `shield_petal_${k}_hinge`, 0.075, 0.23, [0, 0, 0], m, 'x');
    rod(petal, `shield_petal_${k}_spar`, [0, 0, 0], [0, 0.07, 0.65], 0.035, m.hull);
    panel(petal, `shield_petal_${k}_armor`, [[-0.075, 0.02], [0.075, 0.02], [0.19, 0.42], [0.11, 0.68], [-0.11, 0.68], [-0.19, 0.42]],
      0.075, [0, 0.075, 0], m.armor);
    panel(petal, `shield_petal_${k}_emitter`, [[-0.045, 0.13], [0.045, 0.13], [0.12, 0.43], [0.07, 0.59], [-0.07, 0.59], [-0.12, 0.43]],
      0.025, [0, 0.122, 0], m.glass);
    for (const side of SIDES) {
      rod(petal, `shield_petal_${k}_edge_${side}`, [side * 0.07, 0.09, 0.11], [side * 0.15, 0.09, 0.44], 0.018, m.edge);
    }
    box(petal, `shield_petal_${k}_signal`, [0.035, 0.035, 0.34], [0, 0.135, 0.35], m.accent);
    crystal(petal, `shield_petal_${k}_tip`, 0.07, [0, 0.11, 0.67], m.energy, [0.85, 0.6, 1.25]);
  }
  const field = group(crown, 'shield_field', [0, 0.08, 0]);
  joints.field = field;
  sphere(field, 'shield_field_volume', 0.74, [0, 0, 0], m.field, [1.15, 0.5, 1.15]);
  torus(field, 'shield_field_equator', 0.84, 0.012, [0, 0, 0], m.glass, [Math.PI / 2, 0, 0]);
  torus(field, 'shield_field_meridian', 0.73, 0.01, [0, 0, 0], m.glass, [0, 0, 0]);
  const emitter = group(body, 'shield_emitter', [0, 1.02, -0.65]);
  joints.emitter = emitter;
  bearing(emitter, 'shield_emitter_pitch', 0.15, 0.52, [0, 0, 0], m, 'x');
  hull(emitter, 'shield_emitter_cradle', [
    { z: 0.16, w: 0.48, h: 0.3 },
    { z: -0.12, w: 0.57, h: 0.36 },
    { z: -0.3, w: 0.39, h: 0.26 },
  ], m.armor);
  const emitterSlide = group(emitter, 'shield_emitter_slide', [0, 0, -0.22]);
  joints.emitterSlide = emitterSlide;
  for (const side of SIDES) {
    rod(emitterSlide, `shield_emitter_rail_${side}`, [side * 0.15, 0, 0.08], [side * 0.15, 0, -0.47], 0.045, m.hull);
    rod(emitterSlide, `shield_emitter_prong_${side}`, [side * 0.15, 0.04, -0.31], [side * 0.15, 0.04, -0.57], 0.025, m.edge);
    crystal(emitterSlide, `shield_emitter_tip_${side}`, 0.055, [side * 0.15, 0.04, -0.57], m.energy, [0.8, 0.8, 1.3]);
  }
  cylinder(emitterSlide, 'shield_emitter_core', 0.08, 0.1, 0.42, [0, 0, -0.23], m.dark, [Math.PI / 2, 0, 0], 24);
  torus(emitterSlide, 'shield_emitter_focus_ring', 0.17, 0.026, [0, 0, -0.45], m.accent);
  crystal(emitterSlide, 'shield_emitter_focus', 0.09, [0, 0, -0.46], m.energy, [1, 1, 0.55]);
  return { root, joints };
}

function shieldClips(root, joints) {
  const names = ['shield_L0_', 'shield_R0_', 'shield_L1_', 'shield_R1_'];
  const offsets = [0, Math.PI, Math.PI, 0];
  const walk = (api, phase, stride, bend, lift) => names.forEach((name, i) => gait(api, joints, name, phase + offsets[i], stride, bend, lift));
  const brace = (api, amount) => names.forEach((name, i) => {
    const side = name.includes('_L') ? -1 : 1;
    api.set(`${name}Hip`, { r: [(i < 2 ? -0.09 : 0.09) * amount, 0, side * 0.13 * amount] });
    api.set(`${name}Knee`, { r: [-0.36 * amount, 0, 0] });
    api.set(`${name}Ankle`, { r: [0.27 * amount, 0, -side * 0.13 * amount] });
    api.set(`${name}Ram`, { s: [1, 1 - 0.22 * amount, 1] });
  });
  return makeClips(root, joints, {
    idle: [3.5, (u, t, api) => {
      const wave = Math.sin(t * 1.45);
      api.set('body', { p: [0, wave * 0.01, 0], r: [0, 0, wave * 0.008] });
      api.set('generator', { r: [0, wave * 0.025, 0] });
      api.set('core', { r: [0, t * 0.35, 0], s: [1 + wave * 0.035, 1 + wave * 0.055, 1 + wave * 0.035] });
      api.set('crown', { p: [0, wave * 0.018, 0], r: [wave * 0.015, -wave * 0.025, 0] });
      api.set('ring', { r: [0, t * 0.22, 0] });
      for (let k = 0; k < 6; k++) api.set(`petal${k}`, { r: [wave * 0.035 + Math.sin(t * 1.1 + k) * 0.015, 0, 0] });
      api.set('field', { r: [0, -t * 0.12, 0], s: [1 + wave * 0.05, 1 + wave * 0.08, 1 + wave * 0.05] });
      walk(api, t * 1.05, 0.012, 0.04, 0.004);
      api.set('capacitorL', { p: [0, wave * 0.012, 0], s: [1, 1 + wave * 0.035, 1] });
      api.set('capacitorR', { p: [0, -wave * 0.012, 0], s: [1, 1 - wave * 0.035, 1] });
      api.set('emitter', { r: [wave * 0.018, wave * 0.02, 0] });
      api.set('emitterSlide', { p: [0, 0, wave * 0.01] });
    }],
    move: [1.7, (u, t, api) => {
      const phase = TAU * u;
      api.set('body', { p: [0, Math.cos(phase * 2) * 0.018, 0], r: [0.02, Math.sin(phase) * 0.012, Math.sin(phase) * 0.025] });
      api.set('generator', { r: [-0.015, -Math.sin(phase) * 0.025, -Math.sin(phase) * 0.018] });
      api.set('core', { r: [0, phase * 0.5, 0], s: [1, 1 + Math.sin(phase * 2) * 0.035, 1] });
      api.set('crown', { p: [0, Math.cos(phase * 2) * 0.015, 0], r: [0.025, -Math.sin(phase) * 0.035, -Math.sin(phase) * 0.025] });
      api.set('ring', { r: [0, -phase * 0.4, 0] });
      for (let k = 0; k < 6; k++) api.set(`petal${k}`, { r: [-0.09 + Math.sin(phase + k * 0.5) * 0.025, 0, 0] });
      api.set('field', { r: [0, phase * 0.2, 0], s: [0.82, 0.85 + Math.sin(phase * 2) * 0.04, 0.82] });
      walk(api, phase, 0.25, 0.52, 0.065);
      api.set('capacitorL', { r: [Math.sin(phase) * 0.025, 0, 0] });
      api.set('capacitorR', { r: [-Math.sin(phase) * 0.025, 0, 0] });
      api.set('emitter', { r: [0.04 - Math.cos(phase * 2) * 0.02, 0, 0] });
      api.set('emitterSlide', { p: [0, 0, Math.sin(phase) * 0.015] });
    }],
    attack: [1.15, (u, t, api) => {
      const shot = pulse(u, 0, 0.32, 0.76);
      api.set('body', { p: [0, -0.025 * shot, 0.05 * shot], r: [-0.025 * shot, 0, 0] });
      api.set('generator', { r: [-0.04 * shot, 0.05 * shot, 0] });
      api.set('core', { r: [0, 0.6 * shot, 0], s: [1 + 0.16 * shot, 1 + 0.24 * shot, 1 + 0.16 * shot] });
      api.set('crown', { p: [0, 0.05 * shot, 0.04 * shot], r: [-0.06 * shot, 0, 0] });
      api.set('ring', { r: [0, 0.5 * shot, 0], s: [1 + 0.12 * shot, 1 + 0.12 * shot, 1 + 0.12 * shot] });
      for (let k = 0; k < 6; k++) api.set(`petal${k}`, { r: [0.12 * shot, 0, 0] });
      api.set('field', { s: [1 + 0.25 * shot, 1 + 0.18 * shot, 1 + 0.25 * shot] });
      walk(api, 0.5, 0.05 * shot, 0.25 * shot, 0.01);
      api.set('capacitorL', { s: [1 + 0.12 * shot, 1 - 0.2 * shot, 1 + 0.12 * shot] });
      api.set('capacitorR', { s: [1 + 0.12 * shot, 1 - 0.2 * shot, 1 + 0.12 * shot] });
      api.set('emitter', { r: [-0.13 * shot, 0, 0] });
      api.set('emitterSlide', { p: [0, 0, 0.27 * shot], s: [1 + 0.12 * shot, 1 + 0.12 * shot, 1 - 0.12 * shot] });
    }],
    windup: [1.9, (u, t, api) => {
      const charge = pulse(u, 0, 0.82, 1);
      const shimmer = Math.sin(t * 10) * 0.035 * charge;
      api.set('body', { p: [0, -0.055 * charge, 0.02 * charge], r: [0.025 * charge, 0, 0] });
      api.set('generator', { r: [0.035 * charge, charge * 0.3, 0] });
      api.set('core', { r: [0, charge * TAU, 0], s: [1 + 0.24 * charge + shimmer, 1 + 0.35 * charge, 1 + 0.24 * charge + shimmer] });
      api.set('crown', { p: [0, 0.14 * charge, 0], r: [-0.04 * charge, 0, 0] });
      api.set('ring', { r: [0, charge * TAU, 0], s: [1 + 0.22 * charge, 1 + 0.22 * charge, 1 + 0.22 * charge] });
      for (let k = 0; k < 6; k++) api.set(`petal${k}`, { r: [(0.48 + Math.sin(t * 4 + k) * 0.025) * charge, 0, 0] });
      api.set('field', { r: [0, -charge * 0.8, 0], s: [1 + 0.34 * charge + shimmer, 1 + 0.28 * charge, 1 + 0.34 * charge + shimmer] });
      brace(api, charge);
      api.set('capacitorL', { p: [0, 0.09 * charge, 0], s: [1 + 0.15 * charge, 1 + 0.28 * charge, 1 + 0.15 * charge] });
      api.set('capacitorR', { p: [0, 0.09 * charge, 0], s: [1 + 0.15 * charge, 1 + 0.28 * charge, 1 + 0.15 * charge] });
      api.set('emitter', { r: [0.18 * charge, 0, 0] });
      api.set('emitterSlide', { p: [0, 0, -0.09 * charge] });
    }],
    release: [0.95, (u, t, api) => {
      const hit = pulse(u, 0, 0.18, 0.7);
      api.set('body', { p: [0, -0.06 * hit, 0.08 * hit], r: [-0.04 * hit, 0, 0] });
      api.set('generator', { r: [-0.08 * hit, -0.12 * hit, 0] });
      api.set('core', { r: [0, -0.7 * hit, 0], s: [1 - 0.12 * hit, 1 - 0.22 * hit, 1 - 0.12 * hit] });
      api.set('crown', { p: [0, 0.18 * hit, 0], r: [0.08 * hit, 0, 0] });
      api.set('ring', { r: [0, -0.7 * hit, 0], s: [1 + 0.62 * hit, 1 + 0.62 * hit, 1 + 0.62 * hit] });
      for (let k = 0; k < 6; k++) api.set(`petal${k}`, { r: [0.88 * hit, 0, (k % 2 ? -1 : 1) * 0.035 * hit] });
      api.set('field', { r: [0, 0.35 * hit, 0], s: [1 + 0.82 * hit, 1 + 0.58 * hit, 1 + 0.82 * hit] });
      brace(api, hit);
      api.set('capacitorL', { p: [0, -0.05 * hit, 0], s: [1 + 0.15 * hit, 1 - 0.45 * hit, 1 + 0.15 * hit] });
      api.set('capacitorR', { p: [0, -0.05 * hit, 0], s: [1 + 0.15 * hit, 1 - 0.45 * hit, 1 + 0.15 * hit] });
      api.set('emitter', { r: [-0.16 * hit, 0, 0] });
      api.set('emitterSlide', { p: [0, 0, 0.32 * hit], s: [1 + 0.2 * hit, 1 + 0.2 * hit, 1 - 0.18 * hit] });
    }],
    ability: [2.7, (u, t, api) => {
      const deploy = pulse(u, 0, 0.4, 1);
      const wave = Math.sin(t * 4) * deploy;
      api.set('body', { p: [0, -0.05 * deploy, 0], r: [0.025 * deploy, 0, 0] });
      api.set('generator', { r: [0, deploy * 0.45, 0] });
      api.set('core', { r: [0, TAU * 2 * u, 0], s: [1 + 0.22 * deploy + wave * 0.035, 1 + 0.32 * deploy, 1 + 0.22 * deploy + wave * 0.035] });
      api.set('crown', { p: [0, 0.2 * deploy, 0], r: [-wave * 0.025, 0, 0] });
      api.set('ring', { r: [0, TAU * u, 0], s: [1 + 0.48 * deploy, 1 + 0.48 * deploy, 1 + 0.48 * deploy] });
      for (let k = 0; k < 6; k++) api.set(`petal${k}`, { r: [(0.82 + Math.sin(t * 3 + k * TAU / 6) * 0.04) * deploy, 0, 0] });
      api.set('field', { r: [0, -TAU * 0.5 * u, 0], s: [1 + 0.72 * deploy + wave * 0.05, 1 + 0.55 * deploy + wave * 0.04, 1 + 0.72 * deploy + wave * 0.05] });
      brace(api, deploy);
      api.set('capacitorL', { p: [0, 0.1 * deploy, 0], s: [1 + 0.18 * deploy, 1 + 0.3 * deploy + wave * 0.06, 1 + 0.18 * deploy] });
      api.set('capacitorR', { p: [0, 0.1 * deploy, 0], s: [1 + 0.18 * deploy, 1 + 0.3 * deploy - wave * 0.06, 1 + 0.18 * deploy] });
      api.set('emitter', { r: [0.12 * deploy, 0, 0] });
      api.set('emitterSlide', { p: [0, 0, -0.08 * deploy] });
    }],
    shutdown: [3, (u, t, api) => {
      const fall = ease(u, 0.04, 0.8);
      api.set('body', { p: [0, -0.28 * fall, 0.1 * fall], r: [-0.12 * fall, 0, 0.075 * fall] });
      api.set('generator', { r: [0.32 * fall, -0.22 * fall, -0.08 * fall] });
      api.set('core', { p: [0, -0.12 * fall, 0], r: [0.4 * fall, 0.5 * fall, 0], s: [1 - 0.62 * fall, 1 - 0.72 * fall, 1 - 0.62 * fall] });
      api.set('crown', { p: [0, -0.34 * fall, 0.08 * fall], r: [0.48 * fall, 0.18 * fall, 0.12 * fall] });
      api.set('ring', { r: [1.05 * fall, 0.3 * fall, 0.25 * fall], s: [1 - 0.42 * fall, 1 - 0.42 * fall, 1 - 0.42 * fall] });
      for (let k = 0; k < 6; k++) api.set(`petal${k}`, { r: [-0.58 * fall, (k - 2.5) * 0.025 * fall, (k % 2 ? -1 : 1) * 0.18 * fall] });
      api.set('field', { r: [0.5 * fall, 0, 0], s: [1 - 0.9 * fall, 1 - 0.92 * fall, 1 - 0.9 * fall] });
      names.forEach((name, i) => {
        const side = name.includes('_L') ? -1 : 1;
        api.set(`${name}Hip`, { r: [(i % 2 ? -0.38 : 0.38) * fall, 0, side * 0.3 * fall] });
        api.set(`${name}Knee`, { r: [-1.0 * fall, 0, 0] });
        api.set(`${name}Ankle`, { p: [0, 0.065 * fall, 0], r: [0.68 * fall, 0, -side * 0.22 * fall] });
        api.set(`${name}Ram`, { s: [1, 1 - 0.5 * fall, 1] });
      });
      api.set('capacitorL', { p: [0, -0.12 * fall, 0], r: [0.45 * fall, 0, -0.25 * fall], s: [1 - 0.4 * fall, 1 - 0.6 * fall, 1 - 0.4 * fall] });
      api.set('capacitorR', { p: [0, -0.12 * fall, 0], r: [0.45 * fall, 0, 0.25 * fall], s: [1 - 0.4 * fall, 1 - 0.6 * fall, 1 - 0.4 * fall] });
      api.set('emitter', { r: [-0.65 * fall, 0.15 * fall, 0] });
      api.set('emitterSlide', { p: [0, -0.08 * fall, 0.12 * fall], r: [0.25 * fall, 0, 0] });
    }],
  });
}

export const entities = [
  defineEntity({
    id: 'armored_worm',
    name: '装甲蠕行体',
    kind: 'monster',
    role: '重装前排 / 穿甲突破',
    locomotion: '六节多足蠕行',
    variants: ['base'],
    concept: '连续石墨脊椎承载交叠暗紫甲片，侧甲与独立步足随体节依次响应，头部为液压剪钳而非生物口器。',
    mechanism: '缓慢支撑推进并以头钳实施穿甲攻击；防御时体节下沉、侧甲互锁，失压后各节与步足依次塌落。',
    build(variant) { return buildArmoredWorm(variant); },
    clips: wormClips,
  }),
  defineEntity({
    id: 'ordered_sentinel',
    name: '秩序重卫',
    kind: 'monster',
    role: '重装前排 / 关节冲压',
    locomotion: '双足液压步行',
    variants: ['base'],
    concept: '宽距承力步足支撑层叠胸甲与肩甲，外露活塞连接肘部冲压锤，珊瑚信号仅标示核心和冲击面。',
    mechanism: '交替使用肩、肘和冲压滑块进行穿甲打击；蓄力时转腰屈膝，释放时上身与冲压臂协同前送。',
    build(variant) { return buildOrderedSentinel(variant); },
    clips: sentinelClips,
  }),
  defineEntity({
    id: 'terrain_dismantler',
    name: '地形拆解者',
    kind: 'monster',
    role: '精英攻城 / 地形破拆',
    locomotion: '四足重载爬行',
    variants: ['base'],
    concept: '低矮四足底盘背负双段拆解吊臂，切削齿轮回转于液压钳之间，侧撑和后锚构成完整受力链。',
    mechanism: '吊臂抬升蓄能后下压，钳口与切削轮共同破拆障碍；后锚展开以承受反作用力，停机时执行器失压下垂。',
    build(variant) { return buildTerrainDismantler(variant); },
    clips: dismantlerClips,
  }),
  defineEntity({
    id: 'entropy_engine',
    name: '熵蚀攻城机',
    kind: 'monster',
    role: '精英攻城 / 蓄能齐射',
    locomotion: '六足交替支撑',
    variants: ['base'],
    concept: '六条重载步足托举笼式反应堆与双轨攻城炮，侧置蓄能芯、泄压百叶和后锚围绕炮架布置。',
    mechanism: '蓄能芯与反应堆分阶段充能，炮闩和双轨炮管产生独立后坐；攻城状态下锚定底盘并展开散热机构。',
    build(variant) { return buildEntropyEngine(variant); },
    clips: entropyClips,
  }),
  defineEntity({
    id: 'shield_conductor',
    name: '护盾指挥体',
    kind: 'monster',
    role: '地面支援 / 群体护盾',
    locomotion: '四足稳定步行',
    variants: ['base'],
    concept: '四足平台承托垂直约束核心和六瓣发射冠架，金属支撑梁、独立铰链与透明场域清楚区分实体机构和护盾效果。',
    mechanism: '发射瓣与机械环展开后投射群体护盾，侧电容同步充放能；失压时场域收缩、发射瓣竖折且冠架下落。',
    build(variant) { return buildShieldConductor(variant); },
    clips: shieldClips,
  }),
];
