import * as THREE from '../../vendor/three/build/three.module.js';
import { defineEntity } from './contract.js';
import {
  palette, group, box, panel, cylinder, sphere, crystal, torus, arc, cable, rod,
  hull, bearing, fasteners, mirrored, mesh, annulusGeometry,
} from '../geometry.js';
import { TAU, ease, pulse, smooth, createRigClip } from '../animations.js';
import { addMechanicalLink, withMechanicalLinks } from './mechanical-links.js';

const clipOrder = ['idle', 'move', 'attack', 'windup', 'release', 'ability', 'shutdown'];
const legKeys = (prefix, id) => ({ hip: `${prefix}hip${id}`, knee: `${prefix}knee${id}`, ankle: `${prefix}ankle${id}` });

function makeClips(root, joints, durations, poses) {
  return clipOrder.map(name => createRigClip(root, joints, name, durations[name], withMechanicalLinks(root, joints, poses[name])));
}

function effect(api, key, size, rotation = [0, 0, 0]) {
  const s = Math.max(0.001, size);
  api.raw(key, { r: rotation, s: [s, s, s] });
}

function step(api, keys, phase, amplitude = 0.27, flex = 0.64) {
  const p = ((phase % 1) + 1) % 1;
  let hip, knee;
  if (p < 0.64) {
    const q = p / 0.64;
    hip = amplitude * (1 - q * 2);
    knee = -0.055 * Math.sin(q * Math.PI);
  } else {
    const q = (p - 0.64) / 0.36;
    hip = amplitude * (2 * smooth(q) - 1);
    knee = -flex * Math.sin(q * Math.PI);
  }
  api.raw(keys.hip, { r: [hip, 0, 0] });
  api.raw(keys.knee, { r: [knee, 0, 0] });
  api.raw(keys.ankle, { r: [-hip - knee, 0, 0] });
}

function brace(api, keys, amount, rear = false) {
  const hip = amount * (rear ? -0.18 : 0.18);
  const knee = -amount * 0.28;
  // The coxa stays on its chassis axle; bracing is articulated at hip and knee.
  api.raw(keys.hip, { r: [hip, 0, 0] });
  api.raw(keys.knee, { r: [knee, 0, 0] });
  api.raw(keys.ankle, { r: [-hip - knee, 0, 0] });
}

function buildHunterLeg(body, joints, side) {
  const id = side < 0 ? 'L' : 'R';
  const n = name => `FH_${id}_${name}`;
  const m = body.userData.materials;
  const hip = group(body, n('hip'), [side * 0.43, 0, 0.05]);
  joints[`hip${id}`] = hip;
  bearing(hip, n('hip_bearing'), 0.20, 0.36, [0, 0, 0], m, 'x');
  box(hip, n('upper_spar'), [0.25, 0.52, 0.28], [0, -0.26, 0.02], m.dark, [0, 0, 0], 0.045);
  box(hip, n('thigh_armor'), [0.36, 0.43, 0.38], [0, -0.23, -0.015], m.hull, [0.04, 0, 0], 0.065);
  panel(hip, n('outer_thigh_plate'), [[-0.17, 0.20], [0.13, 0.20], [0.19, 0.08], [0.14, -0.20], [-0.13, -0.20], [-0.20, -0.05]], 0.07,
    [side * 0.19, -0.23, -0.01], m.armor, [0, side * Math.PI / 2, 0], 0.022);
  rod(hip, n('upper_ram'), [side * 0.15, -0.07, 0.14], [side * 0.15, -0.43, 0.11], 0.035, m.edge);
  cylinder(hip, n('upper_ram_sleeve'), 0.052, 0.052, 0.20, [side * 0.15, -0.19, 0.13], m.dark, [0.08, 0, 0], 20);

  const knee = group(hip, n('knee'), [0, -0.52, 0]);
  joints[`knee${id}`] = knee;
  bearing(knee, n('knee_bearing'), 0.16, 0.40, [0, 0, 0], m, 'x');
  box(knee, n('lower_spine'), [0.23, 0.49, 0.26], [0, -0.25, 0.025], m.dark, [0, 0, 0], 0.035);
  box(knee, n('shin_armor'), [0.32, 0.42, 0.35], [0, -0.25, -0.015], m.hull, [-0.035, 0, 0], 0.055);
  box(knee, n('shin_ridge'), [0.17, 0.32, 0.09], [0, -0.24, -0.205], m.armor, [-0.035, 0, 0], 0.025);
  box(knee, n('shin_signal'), [0.055, 0.20, 0.025], [0, -0.23, -0.258], m.accent, [-0.035, 0, 0], 0.009);
  rod(knee, n('lower_ram'), [-side * 0.13, -0.06, 0.12], [-side * 0.13, -0.44, 0.10], 0.028, m.edge);

  const ankle = group(knee, n('ankle'), [0, -0.52, 0]);
  joints[`ankle${id}`] = ankle;
  bearing(ankle, n('ankle_bearing'), 0.12, 0.35, [0, 0, 0.015], m, 'x');
  box(ankle, n('sole'), [0.46, 0.08, 0.82], [0, -0.20, -0.13], m.dark, [0, 0, 0], 0.025);
  box(ankle, n('toe_shell'), [0.43, 0.16, 0.48], [0, -0.09, -0.27], m.hull, [0, 0, 0], 0.045);
  box(ankle, n('heel_shell'), [0.38, 0.16, 0.25], [0, -0.09, 0.205], m.armor, [0, 0, 0], 0.035);
  for (let i = -1; i <= 1; i++) {
    box(ankle, n(`toe_signal_${i + 1}`), [0.055, 0.035, 0.025], [i * 0.12, -0.075, -0.519], m.accent, [0, 0, 0], 0.006);
  }
}

function buildFrequencyHunter(variant) {
  if (variant !== 'base') throw new Error(`frequency_hunter: unknown variant ${variant}`);
  const root = new THREE.Group();
  root.name = 'FH_root';
  const joints = {};
  const m = palette('enemy');
  const body = group(root, 'FH_body', [0, 1.28, 0.08]);
  body.userData.materials = m;
  joints.body = body;

  hull(body, 'FH_torso_pressure_hull', [
    { z: -0.58, y: -0.04, w: 0.82, h: 0.52, chamfer: 0.12 },
    { z: -0.38, y: 0, w: 1.18, h: 0.86, chamfer: 0.16 },
    { z: 0.22, y: 0.01, w: 1.36, h: 0.98, chamfer: 0.18 },
    { z: 0.50, y: 0.03, w: 1.00, h: 0.72, chamfer: 0.15 },
  ], m.hull, [0, 0.48, 0]);
  hull(body, 'FH_abdominal_frame', [
    { z: -0.34, w: 0.68, h: 0.28, chamfer: 0.07 },
    { z: 0.32, w: 0.82, h: 0.34, chamfer: 0.08 },
  ], m.dark, [0, 0.02, 0]);
  rod(body, 'FH_hip_axle', [-0.58, 0, 0.05], [0.58, 0, 0.05], 0.10, m.edge, 24);
  panel(body, 'FH_breastplate', [[-0.48, 0.31], [0.48, 0.31], [0.59, 0.10], [0.38, -0.33], [-0.38, -0.33], [-0.59, 0.10]], 0.13,
    [0, 0.49, -0.60], m.armor, [0, 0, 0], 0.035);
  panel(body, 'FH_chest_recess', [[-0.34, 0.20], [0.34, 0.20], [0.41, 0.06], [0.28, -0.22], [-0.28, -0.22], [-0.41, 0.06]], 0.045,
    [0, 0.50, -0.68], m.dark, [0, 0, 0], 0.015);
  for (let i = 0; i < 3; i++) {
    box(body, `FH_frequency_bar_${i}`, [0.40 - i * 0.07, 0.035, 0.035], [0, 0.59 - i * 0.09, -0.72], i === 1 ? m.energy : m.accent, [0, 0, 0], 0.008);
  }
  fasteners(body, 'FH_breast_bolt', [[-0.43, 0.68, -0.69], [0.43, 0.68, -0.69], [-0.34, 0.28, -0.69], [0.34, 0.28, -0.69]], m.edge, 'z', 0.027);
  box(body, 'FH_collar', [0.82, 0.18, 0.48], [0, 0.99, -0.055], m.dark, [0, 0, 0], 0.055);
  for (const side of [-1, 1]) {
    panel(body, `FH_hip_skirt_${side}`, [[-0.25, 0.16], [0.22, 0.16], [0.28, -0.19], [0.12, -0.32], [-0.20, -0.27]], 0.11,
      [side * 0.54, 0.04, -0.17], m.hull, [0, side * 0.24, side * 0.08], 0.03);
    rod(body, `FH_spine_rail_${side}`, [side * 0.40, 0.24, 0.48], [side * 0.40, 0.83, 0.48], 0.045, m.edge);
  }
  cable(body, 'FH_gun_power_bus', [[0.28, 0.42, 0.48], [0.64, 0.50, 0.48], [0.83, 0.67, 0.29], [0.76, 0.76, 0.06]], 0.037, m.dark);
  cable(body, 'FH_gun_signal_bus', [[0.20, 0.62, 0.49], [0.55, 0.69, 0.46], [0.73, 0.82, 0.20]], 0.018, m.accent);

  buildHunterLeg(body, joints, -1);
  buildHunterLeg(body, joints, 1);

  const counterweight = group(body, 'FH_counterweight', [-0.66, 0.64, 0.16]);
  joints.counterweight = counterweight;
  bearing(counterweight, 'FH_counterweight_trunnion', 0.22, 0.28, [0, 0, 0], m, 'x');
  hull(counterweight, 'FH_counterweight_shell', [
    { z: -0.26, w: 0.43, h: 0.54, chamfer: 0.09 },
    { z: 0.26, w: 0.54, h: 0.66, chamfer: 0.11 },
    { z: 0.47, w: 0.38, h: 0.49, chamfer: 0.08 },
  ], m.hull, [-0.10, -0.05, 0.10]);
  box(counterweight, 'FH_counterweight_face', [0.39, 0.43, 0.09], [-0.11, -0.05, 0.48], m.armor, [0, 0, 0], 0.045);
  for (let i = 0; i < 3; i++) box(counterweight, `FH_heat_slit_${i}`, [0.25, 0.035, 0.025], [-0.11, 0.07 - i * 0.11, 0.535], m.accent, [0, 0, 0], 0.006);

  const gunYaw = group(body, 'FH_gunYaw', [0.66, 0.76, 0.02]);
  joints.gunYaw = gunYaw;
  bearing(gunYaw, 'FH_turret_bearing', 0.28, 0.20, [0, -0.09, 0], m, 'y');
  cylinder(gunYaw, 'FH_yaw_ring', 0.24, 0.24, 0.08, [0, 0.035, 0], m.armor, [0, 0, 0], 40);
  for (const side of [-1, 1]) {
    box(gunYaw, `FH_cradle_cheek_${side}`, [0.11, 0.39, 0.40], [side * 0.25, 0.15, -0.02], m.hull, [0, 0, 0], 0.035);
  }
  const gunPitch = group(gunYaw, 'FH_gunPitch', [0, 0.21, -0.08]);
  joints.gunPitch = gunPitch;
  bearing(gunPitch, 'FH_elevation_bearing', 0.19, 0.62, [0, 0, 0], m, 'x');
  hull(gunPitch, 'FH_breech_shell', [
    { z: -0.46, w: 0.42, h: 0.38, chamfer: 0.08 },
    { z: -0.20, w: 0.56, h: 0.50, chamfer: 0.10 },
    { z: 0.30, w: 0.50, h: 0.46, chamfer: 0.09 },
    { z: 0.43, w: 0.35, h: 0.33, chamfer: 0.07 },
  ], m.hull);
  box(gunPitch, 'FH_breech_top', [0.37, 0.11, 0.54], [0, 0.28, -0.02], m.armor, [0, 0, 0], 0.03);
  rod(gunPitch, 'FH_left_guide', [-0.19, -0.13, -0.44], [-0.19, -0.13, -1.23], 0.035, m.edge);
  rod(gunPitch, 'FH_right_guide', [0.19, -0.13, -0.44], [0.19, -0.13, -1.23], 0.035, m.edge);

  const gunSlide = group(gunPitch, 'FH_gunSlide', [0, 0, -0.20]);
  joints.gunSlide = gunSlide;
  cylinder(gunSlide, 'FH_barrel', 0.095, 0.115, 1.12, [0, 0, -0.61], m.dark, [Math.PI / 2, 0, 0], 32);
  for (const side of [-1, 1]) {
    box(gunSlide, `FH_barrel_jacket_${side}`, [0.09, 0.22, 0.72], [side * 0.14, 0, -0.57], m.hull, [0, 0, 0], 0.025);
    box(gunSlide, `FH_jacket_signal_${side}`, [0.022, 0.065, 0.42], [side * 0.192, 0, -0.57], m.accent, [0, 0, 0], 0.005);
  }
  cylinder(gunSlide, 'FH_muzzle_brake', 0.17, 0.17, 0.31, [0, 0, -1.18], m.armor, [Math.PI / 2, 0, 0], 12);
  cylinder(gunSlide, 'FH_muzzle_recess', 0.115, 0.115, 0.025, [0, 0, -1.345], m.dark, [Math.PI / 2, 0, 0], 32);
  torus(gunSlide, 'FH_muzzle_signal_ring', 0.132, 0.022, [0, 0, -1.36], m.energy);

  const feedTray = group(gunPitch, 'FH_feedTray', [0, -0.27, 0.04]);
  joints.feedTray = feedTray;
  box(feedTray, 'FH_feed_tray_shell', [0.40, 0.13, 0.48], [0, -0.04, 0], m.dark, [0, 0, 0], 0.035);
  for (let i = 0; i < 3; i++) cylinder(feedTray, `FH_feed_cell_${i}`, 0.055, 0.055, 0.31, [-0.12 + i * 0.12, -0.115, 0], m.gold, [Math.PI / 2, 0, 0], 12);
  const breechLock = group(gunPitch, 'FH_breechLock', [0.32, 0.02, -0.06]);
  joints.breechLock = breechLock;
  bearing(breechLock, 'FH_breech_lock_pin', 0.085, 0.10, [0, 0, 0], m, 'x');
  box(breechLock, 'FH_breech_lock_lever', [0.09, 0.34, 0.10], [0, 0.13, 0], m.armor, [0, 0, -0.18], 0.022);

  const rangeDrum = group(gunPitch, 'FH_rangeDrum', [0.34, 0.29, -0.22]);
  joints.rangeDrum = rangeDrum;
  cylinder(rangeDrum, 'FH_range_drum_body', 0.12, 0.12, 0.16, [0, 0, 0], m.dark, [0, 0, Math.PI / 2], 24);
  cylinder(rangeDrum, 'FH_range_drum_dial', 0.095, 0.095, 0.18, [0, 0, 0], m.accent, [0, 0, Math.PI / 2], 24);
  box(gunPitch, 'FH_scope_bridge', [0.20, 0.15, 0.68], [0, 0.37, -0.28], m.dark, [0, 0, 0], 0.035);
  hull(gunPitch, 'FH_scope_housing', [
    { z: -0.70, w: 0.24, h: 0.22, chamfer: 0.055 },
    { z: -0.52, w: 0.32, h: 0.28, chamfer: 0.065 },
    { z: 0.02, w: 0.25, h: 0.24, chamfer: 0.055 },
  ], m.armor, [0, 0.43, 0]);
  cylinder(gunPitch, 'FH_scope_front_glass', 0.098, 0.098, 0.035, [0, 0.43, -0.715], m.glass, [Math.PI / 2, 0, 0], 32);
  torus(gunPitch, 'FH_scope_front_rim', 0.108, 0.018, [0, 0.43, -0.735], m.edge);

  const charge = group(gunSlide, 'FH_charge', [0, 0, -1.16]);
  charge.scale.setScalar(0.001);
  joints.charge = charge;
  sphere(charge, 'FH_charge_core', 0.13, [0, 0, 0], m.core, [1, 1, 1.35]);
  torus(charge, 'FH_charge_cage_a', 0.19, 0.018, [0, 0, 0], m.energy);
  torus(charge, 'FH_charge_cage_b', 0.19, 0.018, [0, 0, 0], m.energy, [0, Math.PI / 2, 0]);
  const muzzleFlash = group(gunSlide, 'FH_muzzleFlash', [0, 0, -1.48]);
  muzzleFlash.scale.setScalar(0.001);
  joints.muzzleFlash = muzzleFlash;
  crystal(muzzleFlash, 'FH_muzzle_flash_crystal', 0.27, [0, 0, -0.08], m.energy, [0.72, 0.72, 1.85]);
  torus(muzzleFlash, 'FH_muzzle_flash_ring', 0.24, 0.025, [0, 0, 0], m.core);

  const sensorYaw = group(body, 'FH_sensorYaw', [0, 1.11, -0.11]);
  joints.sensorYaw = sensorYaw;
  bearing(sensorYaw, 'FH_sensor_yaw_bearing', 0.22, 0.14, [0, -0.08, 0], m, 'y');
  const sensorPitch = group(sensorYaw, 'FH_sensorPitch', [0, 0.05, -0.12]);
  joints.sensorPitch = sensorPitch;
  box(sensorPitch, 'FH_sensor_crossbeam', [0.91, 0.20, 0.34], [0, 0, 0], m.hull, [0, 0, 0], 0.065);
  box(sensorPitch, 'FH_sensor_brow', [0.72, 0.09, 0.41], [0, 0.14, -0.02], m.armor, [0, 0, 0], 0.03);
  box(sensorPitch, 'FH_sensor_recess', [0.66, 0.14, 0.05], [0, 0, -0.195], m.dark, [0, 0, 0], 0.025);
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    const optic = group(sensorPitch, `FH_optic${id}`, [side * 0.22, 0, -0.22]);
    joints[`optic${id}`] = optic;
    cylinder(optic, `FH_optic_barrel_${id}`, 0.105, 0.12, 0.18, [0, 0, 0], m.dark, [Math.PI / 2, 0, 0], 32);
    cylinder(optic, `FH_optic_lens_${id}`, 0.078, 0.078, 0.025, [0, 0, -0.105], m.glass, [Math.PI / 2, 0, 0], 32);
    torus(optic, `FH_optic_rim_${id}`, 0.092, 0.015, [0, 0, -0.122], m.energy);
    const antenna = group(sensorPitch, `FH_antenna${id}`, [side * 0.43, 0.07, 0.08]);
    joints[`antenna${id}`] = antenna;
    bearing(antenna, `FH_antenna_hinge_${id}`, 0.075, 0.12, [0, 0, 0], m, 'x');
    panel(antenna, `FH_receiver_fin_${id}`, [[-0.06, 0], [0.06, 0], [0.11, 0.31], [0.035, 0.53], [-0.045, 0.40]], 0.055,
      [0, 0.03, 0], m.hull, [0, 0, side * -0.12], 0.015);
    rod(antenna, `FH_receiver_trace_${id}`, [0, 0.11, -0.035], [0.02, 0.40, -0.035], 0.014, m.accent, 10);
    crystal(antenna, `FH_receiver_tip_${id}`, 0.055, [0.02, 0.46, 0], m.energy, [0.65, 1.35, 0.65]);
  }
  box(sensorPitch, 'FH_central_notch', [0.055, 0.26, 0.08], [0, 0.02, -0.24], m.accent, [0, 0, 0], 0.012);
  const scanRing = group(sensorPitch, 'FH_scanRing', [0, 0, -0.43]);
  scanRing.scale.setScalar(0.001);
  joints.scanRing = scanRing;
  torus(scanRing, 'FH_scan_ring_outer', 0.34, 0.012, [0, 0, 0], m.energy);
  arc(scanRing, 'FH_scan_ring_arc', 0.27, 0.018, 0, Math.PI * 1.35, [0, 0, -0.02], m.core);
  rod(scanRing, 'FH_scan_crosshair_h', [-0.23, 0, 0], [0.23, 0, 0], 0.009, m.energy, 8);
  rod(scanRing, 'FH_scan_crosshair_v', [0, -0.23, 0], [0, 0.23, 0], 0.009, m.energy, 8);

  for (let i = 0; i < 3; i++) {
    const tuner = group(body, `FH_tuner${i}`, [(i - 1) * 0.34, 0.68, 0.49]);
    joints[`tuner${i}`] = tuner;
    bearing(tuner, `FH_tuner_hinge_${i}`, 0.075, 0.19, [0, 0, 0], m, 'x');
    panel(tuner, `FH_tuner_blade_${i}`, [[-0.10, 0], [0.10, 0], [0.14, 0.30], [0.06, 0.54 - i * 0.05], [-0.06, 0.54 - i * 0.05], [-0.14, 0.30]], 0.065,
      [0, 0.03, 0], m.hull, [0, 0, 0], 0.018);
    box(tuner, `FH_tuner_signal_${i}`, [0.045, 0.29, 0.035], [0, 0.28, -0.052], m.accent, [0, 0, 0], 0.008);
  }
  delete body.userData.materials;
  return { root, joints };
}

function frequencyPoses(joints) {
  const keysL = legKeys('', 'L');
  const keysR = legKeys('', 'R');
  const braced = (api, amount) => {
    brace(api, keysL, amount, false);
    brace(api, keysR, amount, true);
  };
  return {
    idle: (u, t, api) => {
      const wave = Math.sin(u * TAU);
      const breath = Math.sin(u * TAU * 2);
      api.set('body', { p: [0, 0.012 * (1 + breath), 0], r: [-0.012, 0, wave * 0.012] });
      api.set('sensorYaw', { r: [0, wave * 0.17, 0] });
      api.set('sensorPitch', { r: [wave * 0.025, 0, 0] });
      api.set('opticL', { p: [0, 0, -0.015 * (1 + breath)] });
      api.set('opticR', { p: [0, 0, -0.015 * (1 + breath)] });
      api.set('gunYaw', { r: [0, -wave * 0.07, 0] });
      api.set('gunPitch', { r: [-0.025 + breath * 0.018, 0, 0] });
      api.set('rangeDrum', { r: [u * TAU * 0.25, 0, 0] });
      api.set('counterweight', { r: [wave * 0.045, 0, 0] });
      api.set('antennaL', { r: [wave * 0.05, 0, -0.025 * breath] });
      api.set('antennaR', { r: [-wave * 0.05, 0, 0.025 * breath] });
      for (let i = 0; i < 3; i++) api.set(`tuner${i}`, { r: [0.03 * Math.sin(u * TAU + i), 0, 0] });
      effect(api, 'charge', 0.001);
      effect(api, 'muzzleFlash', 0.001);
      effect(api, 'scanRing', 0.001);
    },
    move: (u, t, api) => {
      const phase = u * 2;
      const sway = Math.sin(phase * TAU);
      step(api, keysL, phase, 0.29, 0.70);
      step(api, keysR, phase + 0.5, 0.29, 0.70);
      api.set('body', { p: [0, 0.032 * Math.cos(phase * TAU * 2), 0], r: [-0.035, 0, sway * 0.035] });
      api.set('gunYaw', { r: [0, -sway * 0.025, 0] });
      api.set('gunPitch', { r: [0.025 - 0.025 * Math.cos(phase * TAU * 2), 0, -sway * 0.025] });
      api.set('sensorYaw', { r: [0, sway * 0.045, 0] });
      api.set('sensorPitch', { r: [0.02, 0, -sway * 0.025] });
      api.set('counterweight', { r: [-sway * 0.11, 0, 0] });
      api.set('feedTray', { r: [0.025 * Math.sin(phase * TAU * 2), 0, 0] });
      for (let i = 0; i < 3; i++) api.set(`tuner${i}`, { r: [0.09 * Math.sin(phase * TAU + i * 0.7), 0, 0] });
      effect(api, 'charge', 0.001);
      effect(api, 'muzzleFlash', 0.001);
      effect(api, 'scanRing', 0.001);
    },
    attack: (u, t, api) => {
      const acquire = ease(u, 0, 0.25) * (1 - ease(u, 0.72, 1));
      const charge = pulse(u, 0.12, 0.43, 0.57);
      const shot = pulse(u, 0.43, 0.49, 0.72);
      braced(api, acquire * 0.75);
      api.set('body', { p: [0, -acquire * 0.055, shot * 0.055], r: [-acquire * 0.055 + shot * 0.06, 0, 0] });
      api.set('gunYaw', { r: [0, -0.11 * acquire, 0] });
      api.set('gunPitch', { r: [-0.10 * acquire + shot * 0.09, 0, 0] });
      api.set('gunSlide', { p: [0, 0, shot * 0.24] });
      api.set('feedTray', { r: [charge * 0.24 - shot * 0.18, 0, 0] });
      api.set('breechLock', { r: [0, 0, -charge * 0.65 + shot * 0.82] });
      api.set('rangeDrum', { r: [acquire * 2.2, 0, 0] });
      api.set('sensorYaw', { r: [0, -0.11 * acquire, 0] });
      api.set('sensorPitch', { r: [-0.06 * acquire, 0, 0] });
      api.set('opticL', { p: [0, 0, -acquire * 0.065] });
      api.set('opticR', { p: [0, 0, -acquire * 0.065] });
      api.set('counterweight', { r: [acquire * 0.10 - shot * 0.14, 0, 0] });
      for (let i = 0; i < 3; i++) api.set(`tuner${i}`, { r: [charge * (0.24 + i * 0.06), 0, 0] });
      effect(api, 'charge', charge * 0.95);
      effect(api, 'muzzleFlash', shot * (1 - ease(u, 0.50, 0.61)) * 1.25, [0, 0, u * 2]);
      effect(api, 'scanRing', acquire * 0.68, [0, 0, u * TAU * 0.4]);
    },
    windup: (u, t, api) => {
      const lock = ease(u, 0, 0.58);
      const charge = ease(u, 0.20, 0.94);
      braced(api, lock);
      api.set('body', { p: [0, -lock * 0.075, lock * 0.035], r: [-lock * 0.075, 0, 0] });
      api.set('gunYaw', { r: [0, -lock * 0.15, 0] });
      api.set('gunPitch', { r: [-lock * 0.13, 0, 0] });
      api.set('gunSlide', { p: [0, 0, charge * 0.07] });
      api.set('feedTray', { r: [lock * 0.48, 0, 0] });
      api.set('breechLock', { r: [0, 0, -lock * 0.90] });
      api.set('rangeDrum', { r: [lock * 3.4, 0, 0] });
      api.set('sensorYaw', { r: [0, -lock * 0.15, 0] });
      api.set('sensorPitch', { r: [-lock * 0.075, 0, 0] });
      api.set('opticL', { p: [0, 0, -lock * 0.085] });
      api.set('opticR', { p: [0, 0, -lock * 0.085] });
      api.set('antennaL', { r: [lock * 0.35, 0, -lock * 0.14] });
      api.set('antennaR', { r: [lock * 0.35, 0, lock * 0.14] });
      for (let i = 0; i < 3; i++) api.set(`tuner${i}`, { r: [lock * (0.48 + i * 0.08), 0, 0] });
      effect(api, 'charge', charge * 1.15, [0, charge * TAU, 0]);
      effect(api, 'scanRing', lock * 0.92, [0, 0, -lock * 1.4]);
      effect(api, 'muzzleFlash', 0.001);
    },
    release: (u, t, api) => {
      const shot = pulse(u, 0, 0.16, 0.64);
      const recover = ease(u, 0.18, 1);
      const lock = 1 - recover;
      braced(api, 0.85 * lock + shot * 0.25);
      api.set('body', { p: [0, -lock * 0.06, shot * 0.11], r: [-lock * 0.05 + shot * 0.12, 0, 0] });
      api.set('gunYaw', { r: [0, -lock * 0.15, 0] });
      api.set('gunPitch', { r: [-lock * 0.13 + shot * 0.16, 0, 0] });
      api.set('gunSlide', { p: [0, 0, shot * 0.29] });
      api.set('feedTray', { r: [lock * 0.40 - shot * 0.28, 0, 0] });
      api.set('breechLock', { r: [0, 0, -lock * 0.75 + shot * 1.05] });
      api.set('rangeDrum', { r: [(1 - recover) * 3.4 + shot * 0.8, 0, 0] });
      api.set('sensorYaw', { r: [0, -lock * 0.15, 0] });
      api.set('sensorPitch', { r: [-lock * 0.07 - shot * 0.035, 0, 0] });
      api.set('counterweight', { r: [-shot * 0.18, 0, 0] });
      effect(api, 'muzzleFlash', (1 - ease(u, 0.12, 0.42)) * 1.45, [0, 0, u * 4]);
      effect(api, 'charge', lock * (1 - shot) * 0.8);
      effect(api, 'scanRing', lock * 0.85, [0, 0, -1.4 + recover * 1.4]);
    },
    ability: (u, t, api) => {
      const open = ease(u, 0, 0.20) * (1 - ease(u, 0.82, 1));
      const solve = Math.sin(u * TAU * 3);
      const shot = pulse(u, 0.60, 0.67, 0.82);
      braced(api, open * 0.85);
      api.set('body', { p: [0, -open * 0.065, 0], r: [-open * 0.055, 0, 0] });
      api.set('sensorYaw', { r: [0, Math.sin(u * TAU * 2) * 0.23 * open, 0] });
      api.set('sensorPitch', { r: [-open * 0.11 + solve * 0.018 * open, 0, 0] });
      api.set('opticL', { p: [-open * 0.035, 0, -open * (0.07 + solve * 0.018)] });
      api.set('opticR', { p: [open * 0.035, 0, -open * (0.07 - solve * 0.018)] });
      api.set('antennaL', { r: [open * 0.64, -open * 0.16, -open * 0.24] });
      api.set('antennaR', { r: [open * 0.64, open * 0.16, open * 0.24] });
      api.set('gunYaw', { r: [0, -open * 0.12 + solve * 0.025 * open, 0] });
      api.set('gunPitch', { r: [-open * 0.16 + shot * 0.12, 0, 0] });
      api.set('gunSlide', { p: [0, 0, shot * 0.22] });
      api.set('rangeDrum', { r: [u * TAU * 2, 0, 0] });
      api.set('feedTray', { r: [open * 0.26, 0, 0] });
      api.set('breechLock', { r: [0, 0, -open * 0.45] });
      for (let i = 0; i < 3; i++) api.set(`tuner${i}`, { r: [open * (0.66 + i * 0.09), open * (i - 1) * 0.18, solve * open * 0.04] });
      effect(api, 'scanRing', open * (0.95 + 0.10 * solve), [0, 0, u * TAU * 2]);
      effect(api, 'charge', open * 0.72 + shot * 0.40, [0, u * TAU * 2, 0]);
      effect(api, 'muzzleFlash', shot * (1 - ease(u, 0.68, 0.76)) * 1.30);
    },
    shutdown: (u, t, api) => {
      const fall = ease(u, 0.03, 0.93);
      const vent = ease(u, 0.14, 0.72);
      api.set('body', { p: [0, -fall * 0.55, fall * 0.09], r: [-fall * 0.38, fall * 0.08, fall * 0.12] });
      for (const [keys, side] of [[keysL, -1], [keysR, 1]]) {
        const hip = fall * (1.25 + side * 0.05);
        const knee = -fall * (2.15 - side * 0.06);
        api.raw(keys.hip, { r: [hip, 0, side * fall * 0.10] });
        api.raw(keys.knee, { r: [knee, 0, 0] });
        api.raw(keys.ankle, { r: [fall * 0.86, 0, -side * fall * 0.12] });
      }
      api.set('gunYaw', { r: [0, fall * 0.38, 0] });
      api.set('gunPitch', { r: [-fall * 0.72, 0, fall * 0.09] });
      api.set('gunSlide', { p: [0, -fall * 0.05, fall * 0.19] });
      api.set('feedTray', { r: [vent * 1.02, 0, 0] });
      api.set('breechLock', { r: [0, 0, -vent * 1.35] });
      api.set('rangeDrum', { r: [fall * 1.1, 0, 0] });
      api.set('sensorYaw', { r: [0, -fall * 0.42, 0] });
      api.set('sensorPitch', { r: [-fall * 0.62, 0, fall * 0.18] });
      api.set('opticL', { p: [0, -fall * 0.04, fall * 0.07] });
      api.set('opticR', { p: [0, -fall * 0.04, fall * 0.07] });
      api.set('antennaL', { r: [fall * 1.30, 0, -fall * 0.30] });
      api.set('antennaR', { r: [fall * 1.18, 0, fall * 0.26] });
      api.set('counterweight', { r: [fall * 0.48, 0, -fall * 0.15] });
      for (let i = 0; i < 3; i++) api.set(`tuner${i}`, { r: [fall * (1.22 + i * 0.08), 0, fall * (i - 1) * 0.16] });
      effect(api, 'charge', 0.001);
      effect(api, 'muzzleFlash', 0.001);
      effect(api, 'scanRing', 0.001);
    },
  };
}

function frequencyClips(root, joints) {
  return makeClips(root, joints, { idle: 4, move: 1.3, attack: 2.35, windup: 1.65, release: 0.95, ability: 3.8, shutdown: 2.8 }, frequencyPoses(joints));
}

function buildWardenLeg(body, joints, side, front) {
  const id = `${front ? 'F' : 'R'}${side < 0 ? 'L' : 'R'}`;
  const n = name => `AW_${id}_${name}`;
  const m = body.userData.materials;
  const hip = group(body, n('hip'), [side * 0.70, 0, front ? -0.42 : 0.47]);
  joints[`hip${id}`] = hip;
  bearing(hip, n('hip_bearing'), 0.21, 0.35, [0, 0, 0], m, 'x');
  box(hip, n('upper_frame'), [0.28, 0.43, 0.31], [0, -0.21, 0], m.dark, [0, 0, 0], 0.045);
  box(hip, n('upper_armor'), [0.40, 0.36, 0.42], [0, -0.18, front ? -0.035 : 0.035], m.hull, [front ? -0.05 : 0.05, 0, 0], 0.06);
  panel(hip, n('outer_armor'), [[-0.18, 0.17], [0.16, 0.17], [0.22, 0.04], [0.15, -0.19], [-0.15, -0.19], [-0.22, 0.02]], 0.075,
    [side * 0.21, -0.18, 0], m.armor, [0, side * Math.PI / 2, 0], 0.022);
  rod(hip, n('hip_ram'), [side * 0.16, -0.04, 0.13], [side * 0.16, -0.36, 0.10], 0.034, m.edge);

  const knee = group(hip, n('knee'), [0, -0.42, 0]);
  joints[`knee${id}`] = knee;
  bearing(knee, n('knee_bearing'), 0.17, 0.42, [0, 0, 0], m, 'x');
  box(knee, n('lower_frame'), [0.25, 0.46, 0.28], [0, -0.23, 0.01], m.dark, [0, 0, 0], 0.04);
  box(knee, n('greave'), [0.34, 0.38, 0.36], [0, -0.23, front ? -0.025 : 0.025], m.hull, [0, 0, 0], 0.055);
  box(knee, n('greave_ridge'), [0.12, 0.28, 0.08], [0, -0.22, front ? -0.23 : 0.23], m.armor, [0, 0, 0], 0.022);
  rod(knee, n('lower_ram'), [-side * 0.14, -0.05, -0.10], [-side * 0.14, -0.39, -0.08], 0.029, m.edge);

  const ankle = group(knee, n('ankle'), [0, -0.46, 0]);
  joints[`ankle${id}`] = ankle;
  bearing(ankle, n('ankle_bearing'), 0.125, 0.36, [0, 0, 0], m, 'x');
  box(ankle, n('foot_sole'), [0.45, 0.09, 0.59], [0, -0.255, front ? -0.07 : 0.07], m.dark, [0, 0, 0], 0.025);
  box(ankle, n('foot_shell'), [0.42, 0.21, 0.51], [0, -0.105, front ? -0.07 : 0.07], m.hull, [0, 0, 0], 0.05);
  box(ankle, n('toe_cap'), [0.38, 0.15, 0.20], [0, -0.13, front ? -0.32 : 0.32], m.armor, [0, 0, 0], 0.035);
  box(ankle, n('foot_seal'), [0.19, 0.035, 0.025], [0, -0.10, front ? -0.427 : 0.427], m.accent, [0, 0, 0], 0.006);
}

function buildShieldPetal(wing, joints, side, index) {
  const id = `${side < 0 ? 'L' : 'R'}${index}`;
  const m = wing.userData.materials;
  const petal = group(wing, `AW_petal${id}`, [side * 0.05, (index - 1) * 0.16, index * 0.07], [0, side * 0.15, side * (index - 1) * 0.06]);
  joints[`petal${id}`] = petal;
  const outline = [[-0.18, 0.31], [0.18, 0.31], [0.24, 0.18], [0.21, -0.23], [0.10, -0.32], [-0.16, -0.29], [-0.24, -0.10], [-0.23, 0.19]];
  panel(petal, `AW_petal_shell_${id}`, outline, 0.10, [0, 0, 0], m.armor, [0, 0, 0], 0.025);
  panel(petal, `AW_petal_field_${id}`, outline.map(([x, y]) => [x * 0.77, y * 0.80]), 0.025, [0, 0, -0.065], m.glass, [0, 0, 0], 0.009);
  for (const y of [-0.20, 0.20]) box(petal, `AW_petal_rib_${id}_${y}`, [0.35, 0.055, 0.13], [0, y, 0], m.hull, [0, 0, 0], 0.015);
  box(petal, `AW_petal_spine_${id}`, [0.055, 0.35, 0.055], [0, 0, -0.075], m.accent, [0, 0, 0], 0.012);
  for (const y of [-0.27, 0.27]) cylinder(petal, `AW_petal_emitter_${id}_${y}`, 0.045, 0.045, 0.12, [0, y, -0.08], m.energy, [Math.PI / 2, 0, 0], 16);
  let root = wing; while (root.parent) root = root.parent;
  addMechanicalLink(root, joints, `wardenPetal${id}`, {
    from: { node: wing, point: [0, (index - 1) * 0.16, 0.35 + index * 0.07] },
    to: { node: petal, point: [0, 0, 0.05] },
    radius: 0.018, sleeveRadius: 0.038, sleeveLength: 0.11, materials: m,
  });
}

function buildArchiveWarden(variant) {
  if (variant !== 'base') throw new Error(`archive_warden: unknown variant ${variant}`);
  const root = new THREE.Group();
  root.name = 'AW_root';
  const joints = {};
  const m = palette('enemy');
  const body = group(root, 'AW_body', [0, 1.18, 0.02]);
  body.userData.materials = m;
  joints.body = body;

  hull(body, 'AW_vault_pressure_hull', [
    { z: -0.66, y: -0.03, w: 1.05, h: 0.67, chamfer: 0.15 },
    { z: -0.43, y: 0, w: 1.46, h: 0.94, chamfer: 0.18 },
    { z: 0.37, y: 0, w: 1.55, h: 1.00, chamfer: 0.19 },
    { z: 0.67, y: 0.02, w: 1.25, h: 0.82, chamfer: 0.16 },
  ], m.hull, [0, 0.46, 0]);
  box(body, 'AW_belly_frame', [1.08, 0.27, 1.16], [0, 0.02, 0.03], m.dark, [0, 0, 0], 0.07);
  hull(body, 'AW_upper_carapace', [
    { z: -0.44, w: 1.12, h: 0.19, chamfer: 0.06 },
    { z: 0.28, w: 1.37, h: 0.25, chamfer: 0.07 },
    { z: 0.56, w: 1.08, h: 0.20, chamfer: 0.06 },
  ], m.armor, [0, 0.99, 0]);
  rod(body, 'AW_underbody_axle_front', [-0.79, 0, -0.42], [0.79, 0, -0.42], 0.10, m.edge, 24);
  rod(body, 'AW_underbody_axle_rear', [-0.79, 0, 0.47], [0.79, 0, 0.47], 0.10, m.edge, 24);
  for (const side of [-1, 1]) {
    const sidePoints = [[-0.48, 0.32], [0.36, 0.32], [0.52, 0.12], [0.43, -0.32], [-0.39, -0.32], [-0.54, -0.06]];
    panel(body, `AW_side_armor_${side}`, sidePoints, 0.12, [side * 0.76, 0.48, 0.02], m.armor, [0, side * Math.PI / 2, 0], 0.035);
    box(body, `AW_side_recess_${side}`, [0.60, 0.29, 0.035], [side * 0.835, 0.48, 0.02], m.dark, [0, side * Math.PI / 2, 0], 0.025);
    for (let i = 0; i < 3; i++) box(body, `AW_side_signal_${side}_${i}`, [0.26, 0.032, 0.025], [side * 0.86, 0.56 - i * 0.08, -0.02], m.accent, [0, side * Math.PI / 2, 0], 0.006);
    cable(body, `AW_shield_bus_${side}`, [[side * 0.43, 0.76, 0.47], [side * 0.67, 0.81, 0.29], [side * 0.82, 0.66, -0.12], [side * 0.75, 0.52, -0.29]], 0.032, m.dark);
  }

  for (const side of [-1, 1]) {
    buildWardenLeg(body, joints, side, true);
    buildWardenLeg(body, joints, side, false);
  }

  const sealDoor = group(body, 'AW_sealDoor', [0, 0.47, -0.69]);
  const frameShape = new THREE.Shape();
  [[-0.45, 0.34], [-0.34, 0.45], [0.34, 0.45], [0.45, 0.34], [0.45, -0.34], [0.34, -0.45], [-0.34, -0.45], [-0.45, -0.34]]
    .forEach(([x, y], index) => index ? frameShape.lineTo(x, y) : frameShape.moveTo(x, y));
  frameShape.closePath();
  const frameBore = new THREE.Path(); frameBore.absarc(0, 0, 0.19, 0, TAU, true); frameShape.holes.push(frameBore);
  const frameGeometry = new THREE.ExtrudeGeometry(frameShape, { depth: 0.09, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.025, bevelSegments: 3, curveSegments: 24 });
  frameGeometry.translate(0, 0, -0.045);
  mesh(sealDoor, 'AW_seal_outer_frame', frameGeometry, m.dark);
  const half = [[0, 0.35], [0.27, 0.35], [0.36, 0.24], [0.30, 0.10], [0.17, 0.02], [0.29, -0.10], [0.23, -0.35], [0, -0.35]];
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'Left' : 'Right';
    const seal = group(sealDoor, `AW_seal${id}`, [0, 0, -0.085]);
    joints[`seal${id}`] = seal;
    panel(seal, `AW_seal_half_${id}`, mirrored(half, side), 0.12, [0, 0, 0], m.armor, [0, 0, 0], 0.025);
    box(seal, `AW_seal_half_rib_${id}`, [0.07, 0.52, 0.07], [side * 0.19, 0, -0.075], m.hull, [0, 0, side * -0.08], 0.018);
    fasteners(seal, `AW_seal_fastener_${id}`, [[side * 0.23, 0.25, -0.085], [side * 0.20, -0.25, -0.085]], m.edge, 'z', 0.025);
  }
  const sealWheel = group(sealDoor, 'AW_sealWheel', [0, 0, -0.18]);
  joints.sealWheel = sealWheel;
  torus(sealWheel, 'AW_seal_wheel_outer', 0.255, 0.038, [0, 0, 0], m.hull);
  torus(sealWheel, 'AW_seal_wheel_signal', 0.205, 0.015, [0, 0, -0.035], m.accent);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    rod(sealWheel, `AW_seal_wheel_spoke_${i}`, [Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0], [Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0], 0.022, m.edge, 12);
  }
  const sealCore = group(sealWheel, 'AW_sealCore', [0, 0, -0.025]);
  joints.sealCore = sealCore;
  cylinder(sealCore, 'AW_seal_core_seat', 0.115, 0.115, 0.11, [0, 0, 0], m.dark, [Math.PI / 2, 0, 0], 24);
  crystal(sealCore, 'AW_seal_core_crystal', 0.105, [0, 0, -0.075], m.core, [1, 1, 0.55], [0, 0, Math.PI / 4]);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const bolt = group(sealDoor, `AW_lock${i}`, [Math.cos(a) * 0.36, Math.sin(a) * 0.36, -0.13], [0, 0, a]);
    joints[`lock${i}`] = bolt;
    box(bolt, `AW_lock_bolt_${i}`, [0.17, 0.075, 0.11], [0, 0, 0], m.hull, [0, 0, 0], 0.02);
    box(bolt, `AW_lock_signal_${i}`, [0.065, 0.025, 0.025], [0, 0, -0.068], m.accent, [0, 0, 0], 0.005);
  }
  const sealPiston = group(sealDoor, 'AW_sealPiston', [0, 0, 0.04]);
  joints.sealPiston = sealPiston;
  cylinder(sealPiston, 'AW_seal_piston_ram', 0.075, 0.09, 1.05, [0, 0, 0.26], m.edge, [Math.PI / 2, 0, 0], 24);
  cylinder(sealPiston, 'AW_seal_piston_head', 0.14, 0.14, 0.11, [0, 0, -0.29], m.accent, [Math.PI / 2, 0, 0], 12);
  mesh(sealDoor, 'AW_seal_piston_fixed_guide', annulusGeometry(0.16, 0.102, 0.55, 32), m.dark, [0, 0, 0.19], [Math.PI / 2, 0, 0]);
  // The seal wheel is the moving stamp face and shares the ram carriage.
  sealPiston.add(sealWheel); sealWheel.position.z = -0.22;

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    const wing = group(body, `AW_shield${id}`, [side * 0.74, 0.50, -0.27]);
    wing.userData.materials = m;
    joints[`shield${id}`] = wing;
    bearing(wing, `AW_shield_hinge_${id}`, 0.18, 0.30, [0, 0, 0], m, 'y');
    rod(wing, `AW_shield_arm_${id}`, [0, -0.31, 0.07], [0, 0.31, 0.07], 0.055, m.edge, 20);
    for (let i = 0; i < 3; i++) buildShieldPetal(wing, joints, side, i);
    addMechanicalLink(root, joints, `wardenShield${id}`, {
      from: { node: body, point: [side * 0.60, 0.50, 0.08] }, to: { node: wing, point: [0, 0, 0.08] },
      radius: 0.035, sleeveRadius: 0.07, sleeveLength: 0.15, materials: m,
    });
    delete wing.userData.materials;
  }

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    for (let i = 0; i < 4; i++) {
      box(body, `AW_archive_shelf_${id}_${i}`, [0.65, 0.045, 0.63], [side * 0.34, 0.13 + i * 0.25, 0.48], m.dark, [0, 0, 0], 0.012);
    }
    for (const x of [-0.31, 0.31]) rod(body, `AW_archive_rail_${id}_${x}`, [side * 0.34 + x, 0.11, 0.76], [side * 0.34 + x, 0.91, 0.76], 0.028, m.edge, 12);
    for (let i = 0; i < 3; i++) {
      const drawer = group(body, `AW_drawer${id}${i}`, [side * 0.34, 0.255 + i * 0.25, 0.51]);
      joints[`drawer${id}${i}`] = drawer;
      box(drawer, `AW_cassette_shell_${id}_${i}`, [0.54, 0.19, 0.48], [0, 0, 0], m.hull, [0, 0, 0], 0.035);
      box(drawer, `AW_cassette_face_${id}_${i}`, [0.47, 0.145, 0.065], [0, 0, 0.265], m.armor, [0, 0, 0], 0.025);
      box(drawer, `AW_cassette_label_${id}_${i}`, [0.18, 0.065, 0.025], [-0.09, 0, 0.308], i === 1 ? m.energy : m.accent, [0, 0, 0], 0.008);
      rod(drawer, `AW_cassette_handle_${id}_${i}`, [0.08, -0.035, 0.33], [0.20, -0.035, 0.33], 0.018, m.edge, 12);
      for (const x of [-0.19, 0.19]) cylinder(drawer, `AW_cassette_pin_${id}_${i}_${x}`, 0.022, 0.022, 0.025, [x, 0.045, 0.31], m.edge, [Math.PI / 2, 0, 0], 8);
    }
  }
  const archiveLid = group(body, 'AW_archiveLid', [0, 1.09, 0.615]);
  joints.archiveLid = archiveLid;
  bearing(body, 'AW_archive_lid_hinge', 0.075, 0.95, [0, 1.09, 0.615], m, 'x');
  box(archiveLid, 'AW_archive_lid_shell', [1.03, 0.13, 0.69], [0, 0, -0.345], m.hull, [0, 0, 0], 0.05);
  box(archiveLid, 'AW_archive_lid_inset', [0.69, 0.055, 0.43], [0, 0.085, -0.345], m.dark, [0, 0, 0], 0.022);
  for (const side of [-1, 1]) {
    rod(archiveLid, `AW_archive_lid_handle_${side}`, [side * 0.23, 0.10, -0.465], [side * 0.23, 0.10, -0.225], 0.028, m.edge, 16);
    box(archiveLid, `AW_archive_lid_signal_${side}`, [0.055, 0.035, 0.29], [side * 0.34, 0.085, -0.345], m.accent, [0, 0, 0], 0.008);
  }

  const shieldWave = group(body, 'AW_shieldWave', [0, 0.52, -1.12]);
  shieldWave.scale.setScalar(0.001);
  joints.shieldWave = shieldWave;
  torus(shieldWave, 'AW_shield_wave_field', 1.03, 0.025, [0, 0, 0], m.field);
  arc(shieldWave, 'AW_shield_wave_upper', 1.04, 0.018, 0.12, Math.PI - 0.12, [0, 0, -0.015], m.energy);
  arc(shieldWave, 'AW_shield_wave_left', 0.88, 0.016, Math.PI * 0.62, Math.PI * 1.12, [0, 0, 0], m.accent);
  arc(shieldWave, 'AW_shield_wave_right', 0.88, 0.016, -Math.PI * 0.12, Math.PI * 0.38, [0, 0, 0], m.accent);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    crystal(shieldWave, `AW_shield_wave_node_${i}`, 0.055, [Math.cos(a) * 1.03, Math.sin(a) * 1.03, 0], m.core, [1, 1, 0.55]);
  }
  delete body.userData.materials;
  return { root, joints };
}

function archivePoses(joints) {
  const ids = ['FL', 'FR', 'RL', 'RR'];
  const keys = Object.fromEntries(ids.map(id => [id, legKeys('', id)]));
  const planted = (api, amount) => {
    for (const id of ids) brace(api, keys[id], amount, id[0] === 'R');
  };
  const shields = (api, open, wave = 0) => {
    for (const side of [-1, 1]) {
      const id = side < 0 ? 'L' : 'R';
      api.set(`shield${id}`, { p: [0, 0, -open * 0.18], r: [0, side * open * 0.24, 0] });
      for (let i = 0; i < 3; i++) {
        const tier = i - 1;
        api.set(`petal${id}${i}`, {
          p: [side * open * (i === 1 ? 0.28 : 0.17), tier * open * 0.23, -open * (0.25 + (i === 1 ? 0.10 : 0))],
          r: [tier * open * -0.08, side * open * (0.42 + (i === 1 ? 0.10 : 0)), side * tier * open * 0.13 + wave * side * 0.025],
        });
      }
    }
  };
  const seal = (api, open, wheel, coreScale = 1) => {
    api.set('sealLeft', { p: [-open * 0.30, 0, open * 0.04], r: [0, -open * 0.24, 0] });
    api.set('sealRight', { p: [open * 0.30, 0, open * 0.04], r: [0, open * 0.24, 0] });
    api.set('sealWheel', { r: [0, 0, wheel] });
    api.set('sealCore', { s: [coreScale, coreScale, coreScale] });
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      api.set(`lock${i}`, { p: [Math.cos(a) * open * 0.09, Math.sin(a) * open * 0.09, 0], r: [0, 0, open * 0.35] });
    }
  };
  return {
    idle: (u, t, api) => {
      const wave = Math.sin(u * TAU);
      api.set('body', { p: [0, 0.009 * (1 + Math.sin(u * TAU * 2)), 0], r: [0, 0, wave * 0.008] });
      seal(api, 0, wave * 0.10, 1 + wave * 0.035);
      shields(api, 0, wave);
      api.set('sealPiston', { p: [0, 0, wave * 0.018] });
      api.set('archiveLid', { r: [0.012 * wave, 0, 0] });
      for (const id of ids) brace(api, keys[id], 0.025 * (1 + wave), id[0] === 'R');
      for (const side of ['L', 'R']) for (let i = 0; i < 3; i++) api.set(`drawer${side}${i}`, { p: [0, 0, 0.008 * Math.sin(u * TAU + i)] });
      effect(api, 'shieldWave', 0.001);
    },
    move: (u, t, api) => {
      const phase = u * 2;
      const sway = Math.sin(phase * TAU);
      for (const id of ids) {
        const diagonal = id === 'FL' || id === 'RR' ? 0 : 0.5;
        step(api, keys[id], phase + diagonal, 0.24, 0.58);
      }
      api.set('body', { p: [0, 0.026 * Math.cos(phase * TAU * 2), 0], r: [-0.022, 0, sway * 0.026] });
      api.set('sealWheel', { r: [0, 0, phase * 0.18] });
      api.set('sealCore', { s: [1.03, 1.03, 1.03] });
      api.set('sealPiston', { p: [0, 0, 0.018 * Math.cos(phase * TAU * 2)] });
      for (const side of [-1, 1]) {
        const id = side < 0 ? 'L' : 'R';
        api.set(`shield${id}`, { r: [sway * side * 0.025, 0, sway * side * 0.035] });
        for (let i = 0; i < 3; i++) api.set(`petal${id}${i}`, { r: [0, 0, Math.sin(phase * TAU + i * 0.5) * 0.025] });
      }
      for (const side of ['L', 'R']) for (let i = 0; i < 3; i++) api.set(`drawer${side}${i}`, { p: [0, 0, 0.016 * Math.sin(phase * TAU + i * 0.8)] });
      api.set('archiveLid', { r: [0.025 * Math.sin(phase * TAU * 2), 0, 0] });
      effect(api, 'shieldWave', 0.001);
    },
    attack: (u, t, api) => {
      const open = pulse(u, 0, 0.28, 0.80);
      const stamp = pulse(u, 0.26, 0.42, 0.68);
      const discharge = pulse(u, 0.39, 0.48, 0.74);
      planted(api, open * 0.65);
      api.set('body', { p: [0, -open * 0.04, stamp * 0.055], r: [-open * 0.035 + stamp * 0.045, 0, 0] });
      seal(api, open, open * 1.45 + stamp * 0.35, 1 + discharge * 0.38);
      api.set('sealPiston', { p: [0, 0, -stamp * 0.31] });
      shields(api, open * 0.16, stamp);
      for (const side of ['L', 'R']) for (let i = 0; i < 3; i++) api.set(`drawer${side}${i}`, { p: [0, 0, open * (0.025 + i * 0.012)] });
      api.set('archiveLid', { r: [open * 0.08, 0, 0] });
      effect(api, 'shieldWave', discharge * 0.54, [0, 0, discharge * 0.25]);
    },
    windup: (u, t, api) => {
      const open = ease(u, 0, 0.68);
      const charge = ease(u, 0.22, 0.96);
      planted(api, open * 0.90);
      api.set('body', { p: [0, -open * 0.07, open * 0.025], r: [-open * 0.055, 0, 0] });
      seal(api, open, open * 2.25, 1 + charge * 0.48);
      api.set('sealPiston', { p: [0, 0, open * 0.13] });
      shields(api, open * 0.52);
      for (const side of ['L', 'R']) for (let i = 0; i < 3; i++) api.set(`drawer${side}${i}`, { p: [0, 0, open * (0.06 + i * 0.025)] });
      api.set('archiveLid', { r: [open * 0.23, 0, 0] });
      effect(api, 'shieldWave', charge * 0.40, [0, 0, -charge * 0.30]);
    },
    release: (u, t, api) => {
      const recover = ease(u, 0.22, 1);
      const stamp = pulse(u, 0, 0.18, 0.62);
      const open = 1 - recover;
      planted(api, open * 0.85 + stamp * 0.20);
      api.set('body', { p: [0, -open * 0.065, stamp * 0.10], r: [-open * 0.05 + stamp * 0.07, 0, 0] });
      seal(api, open, 2.25 + stamp * 0.60, 1 + stamp * 0.55);
      api.set('sealPiston', { p: [0, 0, -stamp * 0.38 + recover * 0.02] });
      shields(api, open * 0.52, stamp);
      for (const side of ['L', 'R']) for (let i = 0; i < 3; i++) api.set(`drawer${side}${i}`, { p: [0, 0, open * (0.06 + i * 0.025)] });
      api.set('archiveLid', { r: [open * 0.23 - stamp * 0.12, 0, 0] });
      effect(api, 'shieldWave', (1 - ease(u, 0.15, 0.90)) * (0.48 + stamp * 0.42), [0, 0, stamp * 0.40]);
    },
    ability: (u, t, api) => {
      const open = ease(u, 0, 0.22) * (1 - ease(u, 0.80, 1));
      const pulseWave = (u * 2) % 1;
      planted(api, open);
      api.set('body', { p: [0, -open * 0.09, 0], r: [-open * 0.045, 0, 0] });
      seal(api, open * 0.18, open * TAU * 1.5, 1 + open * (0.24 + Math.sin(u * TAU * 4) * 0.07));
      api.set('sealPiston', { p: [0, 0, -open * 0.08] });
      shields(api, open, Math.sin(u * TAU * 3) * open);
      for (const side of ['L', 'R']) {
        for (let i = 0; i < 3; i++) {
          const cycle = pulse((u + i * 0.11 + (side === 'R' ? 0.08 : 0)) % 1, 0, 0.28, 0.65);
          api.set(`drawer${side}${i}`, { p: [0, 0, open * (0.12 + cycle * 0.19)], r: [cycle * open * 0.035, 0, 0] });
        }
      }
      api.set('archiveLid', { r: [open * 0.42, 0, 0] });
      effect(api, 'shieldWave', open * (0.62 + pulseWave * 0.42) * (1 - ease(pulseWave, 0.82, 1)), [0, 0, open * u * 0.6]);
    },
    shutdown: (u, t, api) => {
      const fall = ease(u, 0.02, 0.94);
      const spill = ease(u, 0.14, 0.83);
      api.set('body', { p: [0, -fall * 0.54, fall * 0.10], r: [-fall * 0.34, fall * 0.06, fall * 0.14] });
      for (const id of ids) {
        const side = id[1] === 'L' ? -1 : 1;
        const front = id[0] === 'F' ? 1 : -1;
        const hip = fall * (1.35 + front * 0.05);
        const knee = -fall * (2.35 - front * 0.05);
        api.raw(keys[id].hip, { r: [hip, 0, side * fall * 0.10] });
        api.raw(keys[id].knee, { r: [knee, 0, 0] });
        api.raw(keys[id].ankle, { r: [fall * 0.82, 0, -side * fall * 0.11] });
      }
      api.set('sealLeft', { p: [-spill * 0.22, -spill * 0.08, spill * 0.05], r: [spill * 0.16, -spill * 0.38, spill * 0.22] });
      api.set('sealRight', { p: [spill * 0.11, -spill * 0.15, spill * 0.09], r: [-spill * 0.12, spill * 0.22, -spill * 0.30] });
      api.set('sealWheel', { r: [spill * 0.35, 0, spill * 1.35] });
      api.set('sealCore', { p: [0, -spill * 0.12, spill * 0.08], s: [1 - spill * 0.65, 1 - spill * 0.65, 1 - spill * 0.65] });
      api.set('sealPiston', { p: [0, -spill * 0.08, spill * 0.18], r: [spill * 0.38, 0, 0] });
      for (let i = 0; i < 4; i++) api.set(`lock${i}`, { p: [0, -spill * (0.03 + i * 0.015), spill * 0.04], r: [0, 0, spill * (i % 2 ? -0.55 : 0.55)] });
      for (const side of [-1, 1]) {
        const id = side < 0 ? 'L' : 'R';
        api.set(`shield${id}`, { p: [0, -fall * 0.13, fall * 0.12], r: [fall * 0.38, side * fall * 0.20, side * fall * 0.46] });
        for (let i = 0; i < 3; i++) api.set(`petal${id}${i}`, { p: [0, -fall * (0.04 + i * 0.025), fall * 0.05], r: [fall * (0.48 + i * 0.12), -side * fall * 0.18, side * fall * (0.28 + i * 0.09)] });
      }
      for (const side of ['L', 'R']) for (let i = 0; i < 3; i++) api.set(`drawer${side}${i}`, { p: [0, -spill * i * 0.035, spill * (0.20 + i * 0.09)], r: [spill * (0.10 + i * 0.06), 0, (side === 'L' ? -1 : 1) * spill * 0.045] });
      api.set('archiveLid', { p: [0, -fall * 0.07, fall * 0.08], r: [fall * 0.83, 0, fall * 0.12] });
      effect(api, 'shieldWave', 0.001);
    },
  };
}

function archiveClips(root, joints) {
  return makeClips(root, joints, { idle: 4.4, move: 1.65, attack: 2.4, windup: 1.8, release: 1.05, ability: 4.2, shutdown: 3 }, archivePoses(joints));
}

export const entities = [
  defineEntity({
    id: 'frequency_hunter',
    name: '截频猎手',
    kind: 'monster',
    role: 'elite',
    locomotion: 'biped',
    variants: ['base'],
    concept: '以双轴截频瞄具锁定构造信号的重装猎杀机体，珊瑚色测距纹路与长程炮架形成明确轮廓。',
    mechanism: '双足步进稳定炮架；瞄具伸缩、接收翼与背部调谐片协同解算，炮闩开闭、滑膛后坐完成精确猎杀，失压后腿部与炮架折叠。',
    build: variant => buildFrequencyHunter(variant),
    clips: (root, joints) => frequencyClips(root, joints),
  }),
  defineEntity({
    id: 'archive_warden',
    name: '档案典狱长',
    kind: 'monster',
    role: 'elite',
    locomotion: 'quadruped',
    variants: ['base'],
    concept: '背负归档匣阵列的四足行走封存库，正面机械封印与分片护盾组成重型典狱机构。',
    mechanism: '对角步态搬运重装库体；封印锁销、对开门与压印活塞执行攻击，六片护盾展开形成阵列、归档匣联动供能，失压时盾架与库体坍折。',
    build: variant => buildArchiveWarden(variant),
    clips: (root, joints) => archiveClips(root, joints),
  }),
];
