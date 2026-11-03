import * as THREE from '../../vendor/three/build/three.module.js';
import { defineEntity } from './contract.js';
import {
  palette, group, mesh, box, panel, cylinder, sphere, crystal, torus, arc, cable, rod,
  hull, bearing, fasteners, annulusGeometry,
} from '../geometry.js';
import { createRigClip, TAU, ease, pulse } from '../animations.js';
import { addMechanicalLink, withMechanicalLinks } from './mechanical-links.js';

const LEG_PHASES = { FL: 0, FR: 0.5, RL: 0.5, RR: 0 };
const WHEEL_LABELS = ['FL', 'FR', 'ML', 'MR', 'RL', 'RR'];

function entityRoot(id) {
  const root = new THREE.Group();
  root.name = id;
  return root;
}

function joint(parent, joints, name, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const node = group(parent, name, position, rotation);
  joints[name] = node;
  return node;
}

function makeClips(root, joints, definitions) {
  return definitions.map(([name, duration, pose]) => createRigClip(root, joints, name, duration, withMechanicalLinks(root, joints, (u, t, api) => pose(u, t, {
    ...api,
    set(key, value = {}) {
      if (key === 'scanner' && value.s && joints.scannerGlow) {
        api.set('scannerGlow', { s: value.s });
        api.set(key, { ...value, s: [1, 1, 1] });
      } else api.set(key, value);
    },
  }))));
}

function mountRunningGear(root, body, joints, materials, prefix) {
  root.updateMatrixWorld(true);
  for (const child of [...root.children]) if (child !== body) body.attach(child);
  for (const [name, hip] of Object.entries(joints)) {
    if (!/^hip[FR][LR]$/.test(name)) continue;
    const p = hip.position;
    rod(body, `${prefix}_${name}_carrier`, [p.x * 0.60, p.y, p.z * 0.72], p.toArray(), 0.06, materials.dark, 20);
  }
}

function walkerLeg(root, joints, materials, label, side, z, hipY = 0.78, width = 0.55) {
  const hip = joint(root, joints, `hip${label}`, [side * width, hipY, z]);
  bearing(hip, `${label}_coxa`, 0.14, 0.20, [0, 0, 0], materials, 'x');
  const kneePosition = [side * 0.15, -0.32, 0];
  rod(hip, `${label}_femur`, [0, -0.025, 0], kneePosition, 0.075, materials.hull, 20);
  rod(hip, `${label}_femur_piston`, [side * 0.07, -0.03, 0.055], [side * 0.19, -0.27, 0.055], 0.027, materials.edge, 12);
  box(hip, `${label}_upper_armor`, [0.18, 0.23, 0.19], [side * 0.075, -0.16, 0], materials.armor, [0, 0, -side * 0.40], 0.035);
  const knee = joint(hip, joints, `knee${label}`, kneePosition);
  bearing(knee, `${label}_knee`, 0.125, 0.19, [0, 0, 0], materials, 'x');
  const ankle = [side * 0.08, -0.39, -0.04];
  rod(knee, `${label}_tibia`, [0, -0.02, 0], ankle, 0.058, materials.hull, 18);
  rod(knee, `${label}_tendon`, [-side * 0.055, -0.035, 0.045], [side * 0.025, -0.35, 0.015], 0.021, materials.edge, 10);
  box(knee, `${label}_shin_guard`, [0.15, 0.25, 0.13], [side * 0.04, -0.20, -0.025], materials.hull, [0.08, 0, -side * 0.18], 0.025);
  box(knee, `${label}_foot`, [0.29, 0.10, 0.34], [side * 0.08, -0.41, -0.08], materials.dark, [0, 0, 0], 0.025);
  box(knee, `${label}_toe`, [0.24, 0.055, 0.11], [side * 0.08, -0.382, -0.245], materials.armor, [0, 0, 0], 0.015);
  box(knee, `${label}_contact_signal`, [0.12, 0.025, 0.025], [side * 0.08, -0.37, -0.306], materials.accent, [0, 0, 0], 0.006);
}

function walkerLegs(root, joints, materials, hipY = 0.78, width = 0.55, front = -0.43, rear = 0.43) {
  for (const [label, side, z] of [['FL', -1, front], ['FR', 1, front], ['RL', -1, rear], ['RR', 1, rear]]) {
    walkerLeg(root, joints, materials, label, side, z, hipY, width);
  }
}

function wheel(root, joints, materials, label, x, z, radius = 0.32, width = 0.22) {
  const side = Math.sign(x);
  rod(root, `${label}_axle`, [x * 0.68, radius + 0.07, z], [x, radius, z], 0.055, materials.edge, 16);
  box(root, `${label}_suspension`, [0.14, 0.25, 0.20], [x * 0.72, radius + 0.13, z], materials.hull, [0, 0, side * 0.20], 0.025);
  const wheel = joint(root, joints, `wheel${label}`, [x, radius, z]);
  cylinder(wheel, `${label}_tire`, radius, radius, width, [0, 0, 0], materials.dark, [0, 0, Math.PI / 2], 36);
  torus(wheel, `${label}_bead`, radius * 0.78, radius * 0.16, [0, 0, 0], materials.hull, [0, Math.PI / 2, 0]);
  cylinder(wheel, `${label}_rim`, radius * 0.59, radius * 0.59, width + 0.035, [0, 0, 0], materials.armor, [0, 0, Math.PI / 2], 28);
  cylinder(wheel, `${label}_hub`, radius * 0.24, radius * 0.24, width + 0.075, [0, 0, 0], materials.accent, [0, 0, Math.PI / 2], 16);
  for (let i = 0; i < 6; i++) {
    const angle = i * TAU / 6;
    rod(wheel, `${label}_spoke_${i}`, [0, 0, 0], [0, Math.sin(angle) * radius * 0.53, Math.cos(angle) * radius * 0.53], 0.022, materials.edge, 8);
  }
  box(wheel, `${label}_index`, [width + 0.085, 0.035, 0.085], [0, radius * 0.48, 0], materials.energy, [0, 0, 0], 0.008);
}

function wheelSet(root, joints, materials, positions, radius = 0.32, width = 0.22) {
  for (const [label, x, z] of positions) wheel(root, joints, materials, label, x, z, radius, width);
}

function walk(api, u, amount = 1) {
  for (const [label, offset] of Object.entries(LEG_PHASES)) {
    const phase = TAU * (u + offset);
    const stride = Math.sin(phase);
    const lift = Math.max(0, Math.cos(phase));
    api.set(`hip${label}`, { r: [stride * 0.38 * amount, 0, 0] });
    api.set(`knee${label}`, { r: [(0.08 + lift * 0.48) * amount, 0, 0] });
  }
}

function braceLegs(api, amount) {
  for (const label of Object.keys(LEG_PHASES)) {
    const side = label.endsWith('L') ? -1 : 1;
    const front = label.startsWith('F') ? 1 : -1;
    api.set(`hip${label}`, { r: [front * 0.14 * amount, 0, side * 0.08 * amount] });
    api.set(`knee${label}`, { r: [0.28 * amount, 0, 0] });
  }
}

function foldLegs(api, amount) {
  for (const label of Object.keys(LEG_PHASES)) {
    const side = label.endsWith('L') ? -1 : 1;
    api.set(`hip${label}`, { r: [-0.32 * amount, 0, side * 0.20 * amount] });
    api.set(`knee${label}`, { r: [0.75 * amount, 0, 0] });
  }
}

function spinWheels(api, angle) {
  for (const label of WHEEL_LABELS) api.set(`wheel${label}`, { r: [angle, 0, 0] });
}

function buildRemoteHunter() {
  const root = entityRoot('remote_hunter');
  const joints = {};
  const m = palette('enemy');
  walkerLegs(root, joints, m, 0.78, 0.55, -0.43, 0.45);
  const body = joint(root, joints, 'body', [0, 0.94, 0.08]);
  mountRunningGear(root, body, joints, m, 'hunter');
  hull(body, 'hunter_chamfered_hull', [
    { z: 0.58, w: 0.65, h: 0.27, y: -0.03 },
    { z: 0.35, w: 0.94, h: 0.40, y: 0 },
    { z: -0.36, w: 0.90, h: 0.38, y: 0 },
    { z: -0.58, w: 0.62, h: 0.25, y: -0.04 },
  ], m.hull);
  box(body, 'hunter_belly', [0.62, 0.16, 0.90], [0, -0.22, 0.02], m.dark, [0, 0, 0], 0.035);
  for (const side of [-1, 1]) {
    panel(body, `hunter_side_armor_${side}`, [[-0.42, -0.13], [0.35, -0.13], [0.47, 0.04], [0.28, 0.17], [-0.36, 0.14]], 0.075, [side * 0.48, 0, 0.02], m.armor, [0, side * Math.PI / 2, 0], 0.018);
    cable(body, `hunter_leg_loom_${side}`, [[side * 0.35, -0.10, 0.32], [side * 0.53, -0.13, 0.18], [side * 0.55, -0.16, -0.30]], 0.025, m.dark);
    fasteners(body, `hunter_side_bolts_${side}`, [[side * 0.525, 0.08, -0.25], [side * 0.525, 0.08, 0.25]], m.edge, 'x');
  }
  box(body, 'hunter_dorsal_powerpack', [0.52, 0.24, 0.40], [0, 0.27, 0.28], m.dark, [0, 0, 0], 0.045);
  for (let i = -2; i <= 2; i++) box(body, `hunter_power_fin_${i}`, [0.055, 0.15, 0.32], [i * 0.095, 0.42, 0.28], m.edge, [0, 0, 0], 0.012);
  const turret = joint(body, joints, 'turret', [0, 0.27, -0.05]);
  cylinder(turret, 'hunter_yaw_race', 0.34, 0.38, 0.15, [0, 0, 0], m.dark, [0, 0, 0], 40);
  torus(turret, 'hunter_yaw_bearing', 0.32, 0.035, [0, 0.085, 0], m.edge, [Math.PI / 2, 0, 0]);
  const gun = joint(turret, joints, 'gun', [0, 0.18, -0.08]);
  bearing(gun, 'hunter_trunnion', 0.20, 0.68, [0, 0, 0], m, 'x');
  box(gun, 'hunter_receiver', [0.46, 0.32, 0.82], [0, 0, -0.40], m.hull, [0, 0, 0], 0.055);
  box(gun, 'hunter_receiver_top', [0.34, 0.10, 0.58], [0, 0.20, -0.40], m.armor, [0, 0, 0], 0.025);
  box(gun, 'hunter_breech_signal', [0.49, 0.075, 0.26], [0, 0.02, -0.20], m.accent, [0, 0, 0], 0.015);
  const barrelSlide = joint(gun, joints, 'barrelSlide', [0, 0.015, -0.73]);
  cylinder(barrelSlide, 'hunter_barrel_jacket', 0.095, 0.115, 0.88, [0, 0, -0.40], m.dark, [Math.PI / 2, 0, 0], 32);
  for (const z of [-0.10, -0.40, -0.70]) torus(barrelSlide, `hunter_barrel_band_${z}`, 0.105, 0.018, [0, 0, z], m.edge);
  cylinder(barrelSlide, 'hunter_muzzle_brake', 0.15, 0.13, 0.25, [0, 0, -0.91], m.armor, [Math.PI / 2, 0, 0], 24);
  cylinder(barrelSlide, 'hunter_muzzle_aperture', 0.075, 0.075, 0.265, [0, 0, -0.93], m.dark, [Math.PI / 2, 0, 0], 24);
  torus(barrelSlide, 'hunter_muzzle_signal', 0.12, 0.015, [0, 0, -1.045], m.energy);
  const bolt = joint(gun, joints, 'bolt', [0.28, 0.025, -0.27]);
  box(bolt, 'hunter_bolt_block', [0.13, 0.15, 0.31], [0, 0, 0], m.edge, [0, 0, 0], 0.025);
  rod(bolt, 'hunter_charging_handle', [0.04, 0.03, 0.04], [0.19, 0.03, 0.04], 0.025, m.dark, 12);
  const sight = joint(gun, joints, 'sight', [0, 0.37, -0.36]);
  for (const side of [-1, 1]) {
    rod(gun, `hunter_scope_mount_${side}`, [side * 0.13, 0.18, -0.22], [side * 0.10, 0.285, -0.22], 0.028, m.edge, 12);
    rod(gun, `hunter_scope_outrigger_${side}`, [side * 0.13, 0.18, -0.58], [side * 0.10, 0.285, -0.58], 0.025, m.hull, 12);
    rod(gun, `hunter_scope_slide_rail_${side}`, [side * 0.10, 0.285, -0.82], [side * 0.10, 0.285, -0.08], 0.021, m.edge, 20);
  }
  box(sight, 'hunter_scope_sliding_saddle', [0.25, 0.06, 0.23], [0, -0.095, -0.10], m.armor, [0, 0, 0], 0.018);
  cylinder(sight, 'hunter_scope_body', 0.115, 0.115, 0.69, [0, 0, -0.10], m.dark, [Math.PI / 2, 0, 0], 32);
  cylinder(sight, 'hunter_scope_shroud', 0.15, 0.13, 0.22, [0, 0, -0.45], m.armor, [Math.PI / 2, 0, 0], 32);
  cylinder(sight, 'hunter_scope_rear', 0.13, 0.10, 0.16, [0, 0, 0.30], m.hull, [Math.PI / 2, 0, 0], 28);
  for (const z of [-0.27, 0.10]) torus(sight, `hunter_scope_band_${z}`, 0.119, 0.018, [0, 0, z], m.edge);
  const scopeIris = joint(sight, joints, 'scopeIris', [0, 0, -0.575]);
  cylinder(scopeIris, 'hunter_scope_lens', 0.112, 0.112, 0.025, [0, 0, 0], m.glass, [Math.PI / 2, 0, 0], 32);
  torus(scopeIris, 'hunter_scope_luminous_ring', 0.117, 0.013, [0, 0, -0.018], m.energy);
  rod(scopeIris, 'hunter_reticle_horizontal', [-0.075, 0, -0.035], [0.075, 0, -0.035], 0.006, m.core, 8);
  rod(scopeIris, 'hunter_reticle_vertical', [0, -0.075, -0.035], [0, 0.075, -0.035], 0.006, m.core, 8);
  const targetVanes = joint(sight, joints, 'targetVanes', [0, 0, -0.60]);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    box(targetVanes, `hunter_target_vane_${i}`, [0.025, 0.09, 0.025], [Math.sin(angle) * 0.18, Math.cos(angle) * 0.18, 0], m.accent, [0, 0, -angle], 0.005);
  }
  cable(body, 'hunter_power_feed', [[0.24, 0.22, 0.31], [0.39, 0.30, 0.02], [0.28, 0.37, -0.26]], 0.032, m.dark);
  return { root, joints };
}

function remoteHunterClips(root, joints) {
  return makeClips(root, joints, [
    ['idle', 2.8, (u, t, { set }) => {
      set('body', { p: [0, Math.sin(TAU * u) * 0.018, 0], r: [0.012 * Math.sin(TAU * u), 0, 0] });
      set('turret', { r: [0, 0.08 * Math.sin(TAU * u), 0] });
      set('gun', { r: [0.025 * Math.sin(TAU * u + 0.7), 0, 0] });
      set('scopeIris', { r: [0, 0, t * 0.25], s: [1 + 0.05 * Math.sin(TAU * u), 1 + 0.05 * Math.sin(TAU * u), 1] });
      set('targetVanes', { r: [0, 0, -t * 0.35] });
    }],
    ['move', 1.15, (u, t, { set }) => {
      walk({ set }, u, 1);
      set('body', { p: [0, 0.025 * Math.cos(TAU * u * 2), 0], r: [0.025 * Math.sin(TAU * u), 0, 0.035 * Math.sin(TAU * u)] });
      set('turret', { r: [0, -0.05 * Math.sin(TAU * u), 0] });
      set('gun', { r: [-0.025 * Math.cos(TAU * u * 2), 0, 0] });
      set('scopeIris', { r: [0, 0, t * 0.4] });
    }],
    ['attack', 1.75, (u, t, { set }) => {
      const aim = ease(u, 0, 0.28) * (1 - ease(u, 0.72, 1));
      const shot = pulse(u, 0.32, 0.40, 0.66);
      const cycle = pulse(u, 0.44, 0.54, 0.80);
      braceLegs({ set }, aim * 0.65);
      set('body', { p: [0, -0.035 * aim, 0.045 * shot], r: [-0.035 * shot, 0, 0] });
      set('turret', { r: [0, -0.20 * aim, 0] });
      set('gun', { r: [0.11 * aim - 0.095 * shot, 0, 0] });
      set('barrelSlide', { p: [0, 0, 0.27 * shot] });
      set('bolt', { p: [0, 0, 0.20 * cycle] });
      set('sight', { p: [0, 0, -0.09 * aim] });
      set('scopeIris', { s: [1 + 0.22 * aim, 1 + 0.22 * aim, 1] });
      set('targetVanes', { r: [0, 0, t * (1 + aim * 3)] });
    }],
    ['windup', 1.45, (u, t, { set }) => {
      const charge = ease(u, 0, 0.82);
      braceLegs({ set }, charge);
      set('body', { p: [0, -0.055 * charge, 0.025 * charge], r: [0.025 * charge, 0, 0] });
      set('turret', { r: [0, -0.24 * charge, 0] });
      set('gun', { r: [0.14 * charge, 0, 0] });
      set('barrelSlide', { p: [0, 0, 0.10 * charge] });
      set('bolt', { p: [0, 0, 0.22 * charge] });
      set('sight', { p: [0, 0, -0.12 * charge] });
      set('scopeIris', { s: [1 + 0.35 * charge, 1 + 0.35 * charge, 1] });
      set('targetVanes', { r: [0, 0, t * 4 * charge], s: [0.65 + 0.35 * charge, 0.65 + 0.35 * charge, 1] });
    }],
    ['release', 1.0, (u, t, { set }) => {
      const shot = pulse(u, 0.06, 0.18, 0.58);
      const settle = ease(u, 0.30, 1);
      const cycle = pulse(u, 0.26, 0.42, 0.78);
      braceLegs({ set }, 1 - settle);
      set('body', { p: [0, -0.05 * (1 - settle), 0.075 * shot], r: [-0.075 * shot, 0, 0] });
      set('turret', { r: [0, -0.24 * (1 - settle), 0] });
      set('gun', { r: [0.14 * (1 - settle) - 0.13 * shot, 0, 0] });
      set('barrelSlide', { p: [0, 0, 0.10 * (1 - settle) + 0.34 * shot] });
      set('bolt', { p: [0, 0, 0.22 * (1 - settle) + 0.18 * cycle] });
      set('sight', { p: [0, 0, -0.12 * (1 - settle)] });
      set('scopeIris', { s: [1.35 - 0.35 * settle, 1.35 - 0.35 * settle, 1] });
      set('targetVanes', { r: [0, 0, t * 5 * (1 - settle)] });
    }],
    ['ability', 3.0, (u, t, { set }) => {
      const mark = pulse(u, 0, 0.48, 1);
      const lock = ease(u, 0.18, 0.42) * (1 - ease(u, 0.72, 0.96));
      braceLegs({ set }, mark);
      set('body', { p: [0, -0.045 * mark, 0], r: [0.025 * mark, 0, 0] });
      set('turret', { r: [0, Math.sin(TAU * u) * 0.32 * mark, 0] });
      set('gun', { r: [0.08 * lock + 0.025 * Math.sin(TAU * u * 2) * mark, 0, 0] });
      set('sight', { p: [0, 0, -0.16 * lock] });
      set('scopeIris', { r: [0, 0, t * 2.5], s: [1 + 0.48 * lock, 1 + 0.48 * lock, 1] });
      set('targetVanes', { r: [0, 0, -t * 7 * mark], s: [0.55 + 0.65 * lock, 0.55 + 0.65 * lock, 1] });
      set('bolt', { p: [0, 0, 0.10 * lock] });
    }],
    ['shutdown', 2.2, (u, t, { set }) => {
      const down = ease(u, 0, 1);
      foldLegs({ set }, down);
      set('body', { p: [0, -0.18 * down, 0.07 * down], r: [-0.10 * down, 0, 0] });
      set('turret', { r: [0, 0.58 * down, 0] });
      set('gun', { r: [-0.48 * down, 0, 0] });
      set('barrelSlide', { p: [0, 0, 0.16 * down] });
      set('bolt', { p: [0, 0, 0.12 * down] });
      set('sight', { p: [0, -0.04 * down, 0.08 * down] });
      set('scopeIris', { s: [1 - 0.70 * down, 1 - 0.70 * down, 1] });
      set('targetVanes', { r: [0, 0, t * (1 - down)], s: [1 - 0.75 * down, 1 - 0.75 * down, 1] });
    }],
  ]);
}

function buildSiegeRam() {
  const root = entityRoot('siege_ram');
  const joints = {};
  const m = palette('enemy');
  const positions = [];
  for (const [row, z] of [['F', -0.61], ['M', 0], ['R', 0.61]]) {
    for (const [suffix, side] of [['L', -1], ['R', 1]]) positions.push([`${row}${suffix}`, side * 0.74, z]);
  }
  wheelSet(root, joints, m, positions, 0.35, 0.25);
  const body = joint(root, joints, 'body', [0, 0.84, 0.10]);
  mountRunningGear(root, body, joints, m, 'ram');
  hull(body, 'ram_chamfered_chassis', [
    { z: 0.82, w: 0.95, h: 0.40, y: -0.03 },
    { z: 0.56, w: 1.28, h: 0.54, y: 0 },
    { z: -0.48, w: 1.25, h: 0.53, y: 0 },
    { z: -0.78, w: 0.96, h: 0.40, y: -0.06 },
  ], m.hull);
  box(body, 'ram_belly', [0.93, 0.18, 1.38], [0, -0.29, 0.02], m.dark, [0, 0, 0], 0.035);
  for (const side of [-1, 1]) {
    panel(body, `ram_side_skirt_${side}`, [[-0.70, -0.16], [0.67, -0.16], [0.76, 0.08], [0.51, 0.22], [-0.56, 0.20]], 0.09, [side * 0.65, -0.04, 0], m.armor, [0, side * Math.PI / 2, 0], 0.025);
    for (const z of [-0.46, 0, 0.46]) {
      bearing(body, `ram_skirt_trunnion_${side}_${z}`, 0.105, 0.12, [side * 0.70, -0.04, z], m, 'x');
    }
    rod(body, `ram_guide_rail_${side}`, [side * 0.29, 0.04, -0.32], [side * 0.29, 0.04, -1.45], 0.055, m.edge, 20);
    box(body, `ram_rail_mount_${side}`, [0.17, 0.32, 0.30], [side * 0.29, 0.03, -0.65], m.dark, [0, 0, 0], 0.03);
  }
  mesh(body, 'ram_hydraulic_reservoir', annulusGeometry(0.22, 0.13, 0.82, 36), m.dark, [0, 0.04, -0.42], [Math.PI / 2, 0, 0]);
  for (const z of [-0.16, -0.52]) torus(body, `ram_reservoir_band_${z}`, 0.225, 0.032, [0, 0.04, z], m.armor);
  box(body, 'ram_engine_deck', [0.88, 0.20, 0.55], [0, 0.34, 0.36], m.dark, [0, 0, 0], 0.045);
  for (let i = -3; i <= 3; i++) box(body, `ram_cooling_louver_${i}`, [0.075, 0.10, 0.43], [i * 0.11, 0.47, 0.36], m.edge, [0, 0, -0.15], 0.015);
  const ram = joint(body, joints, 'ram', [0, 0.04, -0.43]);
  cylinder(ram, 'ram_piston', 0.115, 0.115, 1.20, [0, 0, -0.365], m.edge, [Math.PI / 2, 0, 0], 32);
  for (const side of [-1, 1]) {
    box(ram, `ram_carriage_${side}`, [0.22, 0.30, 0.48], [side * 0.29, 0, -0.42], m.hull, [0, 0, 0], 0.035);
    bearing(ram, `ram_carriage_bearing_${side}`, 0.11, 0.26, [side * 0.29, 0, -0.42], m, 'x');
  }
  hull(ram, 'ram_hammer_head', [
    { z: -0.72, w: 0.68, h: 0.43 },
    { z: -0.90, w: 1.02, h: 0.66 },
    { z: -1.22, w: 1.08, h: 0.70 },
    { z: -1.34, w: 0.91, h: 0.58 },
  ], m.armor);
  box(ram, 'ram_impact_face', [0.96, 0.61, 0.13], [0, 0, -1.35], m.dark, [0, 0, 0], 0.055);
  for (const x of [-0.30, 0, 0.30]) {
    for (const y of [-0.17, 0.17]) {
      cylinder(ram, `ram_impact_stud_${x}_${y}`, 0.075, 0.095, 0.15, [x, y, -1.46], m.edge, [Math.PI / 2, 0, 0], 12);
    }
  }
  for (const side of [-1, 1]) {
    box(ram, `ram_head_signal_${side}`, [0.055, 0.45, 0.40], [side * 0.535, 0, -1.07], m.accent, [0, 0, 0], 0.012);
    panel(ram, `ram_head_reinforcement_${side}`, [[-0.28, -0.20], [0.26, -0.20], [0.32, 0.13], [0, 0.29], [-0.25, 0.16]], 0.06, [side * 0.52, 0, -0.99], m.hull, [0, side * Math.PI / 2, 0], 0.018);
  }
  const ramCore = joint(ram, joints, 'ramCore', [0, 0, -0.76]);
  torus(ramCore, 'ram_charge_ring', 0.25, 0.035, [0, 0, 0], m.energy);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    box(ramCore, `ram_core_clamp_${i}`, [0.10, 0.10, 0.20], [Math.sin(angle) * 0.25, Math.cos(angle) * 0.25, 0], m.hull, [0, 0, -angle], 0.018);
  }
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'L' : 'R';
    const brace = joint(root, joints, `brace${label}`, [side * 0.55, 0.58, -0.55], [0.52, 0, 0]);
    bearing(brace, `ram_brace_pivot_${label}`, 0.13, 0.20, [0, 0, 0], m, 'x');
    rod(brace, `ram_brace_strut_${label}`, [0, -0.02, 0], [side * 0.12, -0.44, -0.10], 0.065, m.hull, 18);
    rod(brace, `ram_brace_piston_${label}`, [-side * 0.06, -0.05, 0.04], [side * 0.05, -0.38, -0.04], 0.025, m.edge, 12);
    box(brace, `ram_brace_foot_${label}`, [0.32, 0.13, 0.36], [side * 0.12, -0.47, -0.12], m.dark, [0, 0, 0], 0.03);
    root.updateMatrixWorld(true);body.attach(brace);
  }
  return { root, joints };
}

function siegeRamClips(root, joints) {
  return makeClips(root, joints, [
    ['idle', 2.4, (u, t, { set }) => {
      const idle = Math.sin(TAU * u);
      set('body', { p: [0, idle * 0.012, 0], r: [idle * 0.008, 0, 0] });
      set('ram', { p: [0, 0, 0.018 * idle] });
      set('ramCore', { r: [0, 0, t * 0.35], s: [1 + idle * 0.035, 1 + idle * 0.035, 1] });
      set('braceL', { r: [0.025 * idle, 0, 0] });
      set('braceR', { r: [-0.025 * idle, 0, 0] });
    }],
    ['move', 1.35, (u, t, { set }) => {
      spinWheels({ set }, -TAU * 2 * u);
      set('body', { p: [0, 0.022 * Math.sin(TAU * u * 2), 0], r: [0.025 * Math.sin(TAU * u), 0, 0.018 * Math.cos(TAU * u)] });
      set('ram', { p: [0, 0, 0.035 * Math.sin(TAU * u)] });
      set('ramCore', { r: [0, 0, t * 0.5] });
      set('braceL', { r: [0.18, 0, 0] });
      set('braceR', { r: [0.18, 0, 0] });
    }],
    ['attack', 1.9, (u, t, { set }) => {
      const wind = ease(u, 0.04, 0.38) * (1 - ease(u, 0.43, 0.62));
      const hit = pulse(u, 0.40, 0.50, 0.74);
      const brace = ease(u, 0, 0.26) * (1 - ease(u, 0.76, 1));
      spinWheels({ set }, 0.10 * wind - 0.16 * hit);
      set('body', { p: [0, -0.05 * brace, 0.08 * hit], r: [-0.055 * hit + 0.025 * wind, 0, 0] });
      set('ram', { p: [0, 0, 0.24 * wind - 0.60 * hit] });
      set('ramCore', { r: [0, 0, t * (1 + 4 * wind)], s: [1 + 0.30 * wind, 1 + 0.30 * wind, 1] });
      set('braceL', { r: [-0.52 * brace, 0, 0] });
      set('braceR', { r: [-0.52 * brace, 0, 0] });
    }],
    ['windup', 1.55, (u, t, { set }) => {
      const charge = ease(u, 0, 0.84);
      spinWheels({ set }, 0.13 * charge);
      set('body', { p: [0, -0.065 * charge, 0.06 * charge], r: [0.04 * charge, 0, 0] });
      set('ram', { p: [0, 0, 0.26 * charge] });
      set('ramCore', { r: [0, 0, t * 5 * charge], s: [1 + 0.40 * charge, 1 + 0.40 * charge, 1] });
      set('braceL', { r: [-0.52 * charge, 0, 0] });
      set('braceR', { r: [-0.52 * charge, 0, 0] });
    }],
    ['release', 1.05, (u, t, { set }) => {
      const strike = ease(u, 0.05, 0.20);
      const recover = ease(u, 0.43, 1);
      const hit = pulse(u, 0.16, 0.23, 0.54);
      const brace = 1 - recover;
      spinWheels({ set }, 0.13 * (1 - strike) - 0.15 * hit);
      set('body', { p: [0, -0.065 * brace, 0.10 * hit], r: [-0.085 * hit + 0.04 * (1 - strike), 0, 0] });
      set('ram', { p: [0, 0, 0.26 - 0.71 * strike + 0.45 * recover] });
      set('ramCore', { r: [0, 0, t * 6 * (1 - recover)], s: [1.40 - 0.40 * strike, 1.40 - 0.40 * strike, 1] });
      set('braceL', { r: [-0.52 * brace, 0, 0] });
      set('braceR', { r: [-0.52 * brace, 0, 0] });
    }],
    ['ability', 2.8, (u, t, { set }) => {
      const charge = ease(u, 0, 0.46) * (1 - ease(u, 0.72, 1));
      const hit = pulse(u, 0.48, 0.57, 0.82);
      const brace = ease(u, 0.02, 0.30) * (1 - ease(u, 0.82, 1));
      spinWheels({ set }, 0.18 * charge - 0.24 * hit);
      set('body', { p: [0, -0.09 * brace, 0.13 * hit], r: [0.055 * charge - 0.11 * hit, 0, 0] });
      set('ram', { p: [0, 0, 0.28 * charge - 0.54 * hit] });
      set('ramCore', { r: [0, 0, t * 7 * charge], s: [1 + 0.62 * charge - 0.25 * hit, 1 + 0.62 * charge - 0.25 * hit, 1] });
      set('braceL', { r: [-0.52 * brace, 0, -0.05 * brace] });
      set('braceR', { r: [-0.52 * brace, 0, 0.05 * brace] });
    }],
    ['shutdown', 2.3, (u, t, { set }) => {
      const down = ease(u, 0, 1);
      spinWheels({ set }, 0.18 * (1 - down));
      set('body', { p: [0, -0.16 * down, 0.10 * down], r: [-0.08 * down, 0, 0] });
      set('ram', { p: [0, -0.05 * down, 0.24 * down] });
      set('ramCore', { r: [0, 0, t * (1 - down)], s: [1 - 0.65 * down, 1 - 0.65 * down, 1] });
      set('braceL', { r: [0.22 * down, 0, 0] });
      set('braceR', { r: [0.22 * down, 0, 0] });
    }],
  ]);
}

function buildMemoryMedic() {
  const root = entityRoot('memory_medic');
  const joints = {};
  const m = palette('enemy');
  wheelSet(root, joints, m, [['FL', -0.63, -0.47], ['FR', 0.63, -0.47], ['RL', -0.63, 0.47], ['RR', 0.63, 0.47]], 0.31, 0.22);
  const body = joint(root, joints, 'body', [0, 0.83, 0.04]);
  mountRunningGear(root, body, joints, m, 'medic');
  hull(body, 'medic_chamfered_hull', [
    { z: 0.66, w: 0.80, h: 0.34, y: -0.03 },
    { z: 0.43, w: 1.08, h: 0.44, y: 0 },
    { z: -0.43, w: 1.06, h: 0.43, y: 0 },
    { z: -0.68, w: 0.75, h: 0.30, y: -0.05 },
  ], m.hull);
  box(body, 'medic_undertray', [0.78, 0.15, 1.12], [0, -0.24, 0], m.dark, [0, 0, 0], 0.03);
  for (const side of [-1, 1]) {
    box(body, `medic_side_case_${side}`, [0.20, 0.34, 0.73], [side * 0.52, 0.02, 0.08], m.armor, [0, 0, 0], 0.04);
    for (let i = 0; i < 3; i++) {
      cylinder(body, `medic_cartridge_${side}_${i}`, 0.065, 0.065, 0.25, [side * 0.64, 0.03, -0.18 + i * 0.23], m.glass, [0, 0, 0], 20);
      cylinder(body, `medic_cartridge_cap_${side}_${i}`, 0.073, 0.073, 0.055, [side * 0.64, 0.18, -0.18 + i * 0.23], m.edge, [0, 0, 0], 16);
    }
    cable(body, `medic_supply_hose_${side}`, [[side * 0.31, 0.37, 0.30], [side * 0.54, 0.45, 0.08], [side * 0.48, 0.31, -0.29]], 0.031, m.dark);
  }
  const tank = group(body, 'medic_tank_cradle', [0, 0.28, 0.27]);
  cylinder(tank, 'medic_tank_base', 0.29, 0.33, 0.14, [0, 0, 0], m.dark, [0, 0, 0], 32);
  cylinder(tank, 'medic_tank_glass', 0.235, 0.235, 0.63, [0, 0.37, 0], m.glass, [0, 0, 0], 36);
  cylinder(tank, 'medic_tank_cap', 0.30, 0.26, 0.15, [0, 0.75, 0], m.armor, [0, 0, 0], 32);
  for (const y of [0.08, 0.67]) torus(tank, `medic_tank_band_${y}`, 0.25, 0.028, [0, y, 0], m.edge, [Math.PI / 2, 0, 0]);
  for (const side of [-1, 1]) rod(tank, `medic_tank_guard_${side}`, [side * 0.27, 0.05, 0], [side * 0.27, 0.72, 0], 0.028, m.hull, 12);
  const tankCore = joint(tank, joints, 'tankCore', [0, 0.36, 0]);
  crystal(tankCore, 'medic_memory_fluid_core', 0.18, [0, 0, 0], m.energy, [0.75, 1.35, 0.75]);
  for (let i = 0; i < 3; i++) torus(tankCore, `medic_fluid_ring_${i}`, 0.16 + i * 0.025, 0.010, [0, -0.18 + i * 0.18, 0], m.core, [Math.PI / 2, 0, 0]);
  box(body, 'medic_front_diagnostic_plate', [0.58, 0.22, 0.10], [0, 0.03, -0.65], m.dark, [0, 0, 0], 0.03);
  for (const x of [-0.18, 0, 0.18]) box(body, `medic_diagnostic_light_${x}`, [0.08, 0.06, 0.025], [x, 0.05, -0.71], m.energy, [0, 0, 0], 0.01);
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'L' : 'R';
    const shoulder = joint(body, joints, `shoulder${label}`, [side * 0.46, 0.31, -0.28]);
    bearing(shoulder, `medic_shoulder_${label}`, 0.16, 0.23, [0, 0, 0], m, 'x');
    const elbowPosition = [side * 0.13, 0.18, -0.35];
    rod(shoulder, `medic_upper_arm_${label}`, [0, 0, 0], elbowPosition, 0.068, m.hull, 20);
    rod(shoulder, `medic_upper_piston_${label}`, [-side * 0.065, 0.035, -0.03], [side * 0.06, 0.20, -0.29], 0.025, m.edge, 12);
    const upperArmor = box(shoulder, `medic_upper_armor_${label}`, [0.20, 0.17, 0.29], [side * 0.065, 0.09, -0.175], m.armor, [0, 0, 0], 0.03);
    upperArmor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...elbowPosition).negate().normalize());
    const elbow = joint(shoulder, joints, `elbow${label}`, elbowPosition);
    bearing(elbow, `medic_elbow_${label}`, 0.135, 0.21, [0, 0, 0], m, 'x');
    const wristPosition = [-side * 0.06, -0.08, -0.35];
    rod(elbow, `medic_forearm_${label}`, [0, 0, 0], wristPosition, 0.057, m.hull, 18);
    rod(elbow, `medic_forearm_piston_${label}`, [side * 0.065, 0.025, -0.02], [side * 0.015, -0.02, -0.30], 0.022, m.edge, 12);
    cable(elbow, `medic_wrist_hose_${label}`, [[0, 0.09, 0], [side * 0.10, 0.06, -0.18], wristPosition], 0.020, m.dark);
    const wrist = joint(elbow, joints, `wrist${label}`, wristPosition);
    bearing(wrist, `medic_wrist_${label}`, 0.105, 0.18, [0, 0, 0], m, 'z');
    box(wrist, `medic_tool_head_${label}`, [0.25, 0.17, 0.24], [0, 0, -0.11], m.hull, [0, 0, 0], 0.035);
    for (const jaw of [-1, 1]) {
      rod(wrist, `medic_tool_prong_${label}_${jaw}`, [jaw * 0.10, -0.015, -0.17], [jaw * 0.15, -0.015, -0.36], 0.025, m.edge, 12);
      box(wrist, `medic_tool_pad_${label}_${jaw}`, [0.07, 0.08, 0.10], [jaw * 0.15, -0.015, -0.36], m.armor, [0, 0, 0], 0.015);
    }
    const emitter = joint(wrist, joints, `emitter${label}`, [0, 0, -0.27]);
    torus(emitter, `medic_repair_ring_${label}`, 0.105, 0.022, [0, 0, 0], m.energy);
    torus(emitter, `medic_repair_guard_${label}`, 0.15, 0.015, [0, 0, 0.025], m.edge);
    crystal(emitter, `medic_repair_focus_${label}`, 0.065, [0, 0, -0.025], m.core, [1, 1, 0.65]);
  }
  return { root, joints };
}

function medicArmPose(set, shoulder, elbow, wrist, spread, glow, t) {
  for (const [label, side] of [['L', -1], ['R', 1]]) {
    set(`shoulder${label}`, { r: [shoulder, 0, side * spread] });
    set(`elbow${label}`, { r: [elbow, 0, -side * spread * 0.35] });
    set(`wrist${label}`, { r: [wrist, 0, -side * spread * 0.5] });
    set(`emitter${label}`, { r: [0, 0, t * (2 + glow * 8)], s: [1 + glow * 0.55, 1 + glow * 0.55, 1 + glow * 0.25] });
  }
}

function memoryMedicClips(root, joints) {
  return makeClips(root, joints, [
    ['idle', 2.6, (u, t, { set }) => {
      const breathe = Math.sin(TAU * u);
      set('body', { p: [0, breathe * 0.015, 0], r: [0, 0, breathe * 0.012] });
      medicArmPose(set, breathe * 0.045, -0.06 + breathe * 0.04, breathe * 0.05, 0.025 * breathe, 0.04 + 0.03 * breathe, t);
      set('tankCore', { r: [0, t * 0.35, 0], s: [1 + breathe * 0.05, 1 + breathe * 0.08, 1 + breathe * 0.05] });
    }],
    ['move', 1.1, (u, t, { set }) => {
      spinWheels({ set }, -TAU * 2 * u);
      set('body', { p: [0, 0.022 * Math.cos(TAU * u * 2), 0], r: [0.025 * Math.sin(TAU * u), 0, 0.025 * Math.cos(TAU * u)] });
      medicArmPose(set, -0.05 * Math.sin(TAU * u), -0.08, 0.06 * Math.sin(TAU * u), 0.035, 0, t);
      set('tankCore', { r: [0, t * 0.5, 0] });
    }],
    ['attack', 1.8, (u, t, { set }) => {
      const reach = pulse(u, 0.05, 0.50, 0.95);
      const repair = pulse(u, 0.35, 0.53, 0.82);
      set('body', { p: [0, -0.025 * reach, -0.025 * reach], r: [0.035 * reach, 0, 0] });
      medicArmPose(set, 0.34 * reach - 0.12 * repair, -0.56 * reach + 0.28 * repair, 0.22 * reach, 0.12 * reach, repair, t);
      set('tankCore', { r: [0, t * (1 + repair * 4), 0], s: [1 + repair * 0.18, 1 - repair * 0.12, 1 + repair * 0.18] });
    }],
    ['windup', 1.4, (u, t, { set }) => {
      const charge = ease(u, 0, 0.85);
      set('body', { p: [0, -0.04 * charge, 0.025 * charge], r: [-0.025 * charge, 0, 0] });
      medicArmPose(set, 0.48 * charge, -0.72 * charge, 0.30 * charge, 0.20 * charge, 0.35 * charge, t);
      set('tankCore', { r: [0, t * 3 * charge, 0], s: [1 + 0.26 * charge, 1 + 0.26 * charge, 1 + 0.26 * charge] });
    }],
    ['release', 1.1, (u, t, { set }) => {
      const extend = ease(u, 0.04, 0.28);
      const recover = ease(u, 0.68, 1);
      const repair = pulse(u, 0.20, 0.36, 0.74);
      set('body', { p: [0, -0.035 * (1 - recover), -0.045 * repair], r: [0.05 * repair, 0, 0] });
      medicArmPose(set, 0.48 * (1 - extend) - 0.18 * repair, -0.72 * (1 - extend) + 0.38 * repair, 0.30 * (1 - extend), 0.20 * (1 - recover), repair, t);
      set('tankCore', { r: [0, t * 5 * (1 - recover), 0], s: [1.26 - 0.26 * recover, 1.26 - 0.35 * repair - 0.26 * recover, 1.26 - 0.26 * recover] });
    }],
    ['ability', 3.0, (u, t, { set }) => {
      const charge = ease(u, 0, 0.34) * (1 - ease(u, 0.80, 1));
      const repair = pulse(u, 0.32, 0.55, 0.86);
      const sweep = Math.sin(TAU * u) * repair;
      set('body', { p: [0, -0.05 * charge, -0.04 * repair], r: [0.04 * repair, 0, 0.025 * sweep] });
      medicArmPose(set, 0.52 * charge - 0.26 * repair, -0.78 * charge + 0.52 * repair, 0.30 * charge + 0.15 * sweep, 0.28 * charge + 0.10 * sweep, 0.30 * charge + repair, t);
      set('tankCore', { r: [0, t * (2 + 7 * repair), 0], s: [1 + 0.35 * charge, 1 + 0.20 * charge - 0.20 * repair, 1 + 0.35 * charge] });
    }],
    ['shutdown', 2.25, (u, t, { set }) => {
      const down = ease(u, 0, 1);
      spinWheels({ set }, 0.08 * (1 - down));
      set('body', { p: [0, -0.15 * down, 0.06 * down], r: [-0.08 * down, 0, 0] });
      medicArmPose(set, -0.82 * down, 1.10 * down, -0.45 * down, -0.16 * down, -0.45 * down, t);
      set('tankCore', { r: [0, t * (1 - down), 0], s: [1 - 0.60 * down, 1 - 0.60 * down, 1 - 0.60 * down] });
    }],
  ]);
}

function buildBandwidthJammer() {
  const root = entityRoot('bandwidth_jammer');
  const joints = {};
  const m = palette('enemy');
  walkerLegs(root, joints, m, 0.78, 0.57, -0.43, 0.43);
  const body = joint(root, joints, 'body', [0, 0.96, 0.05]);
  mountRunningGear(root, body, joints, m, 'jammer');
  hull(body, 'jammer_chamfered_hull', [
    { z: 0.56, w: 0.72, h: 0.28, y: -0.04 },
    { z: 0.35, w: 1.08, h: 0.43, y: 0 },
    { z: -0.38, w: 1.04, h: 0.42, y: 0 },
    { z: -0.58, w: 0.70, h: 0.28, y: -0.05 },
  ], m.hull);
  box(body, 'jammer_underbody', [0.74, 0.16, 0.90], [0, -0.23, 0], m.dark, [0, 0, 0], 0.03);
  for (const side of [-1, 1]) {
    box(body, `jammer_heat_exchanger_${side}`, [0.18, 0.35, 0.70], [side * 0.52, 0.015, 0.05], m.dark, [0, 0, 0], 0.025);
    for (let i = 0; i < 6; i++) box(body, `jammer_heat_fin_${side}_${i}`, [0.26, 0.26, 0.035], [side * 0.58, 0.04, -0.25 + i * 0.11], m.edge, [0, 0, 0], 0.008);
    cable(body, `jammer_array_cable_${side}`, [[side * 0.34, 0.18, 0.31], [side * 0.40, 0.38, 0.18], [0, 0.29, 0.05]], 0.027, m.dark);
  }
  box(body, 'jammer_forward_receiver', [0.58, 0.19, 0.10], [0, 0.02, -0.57], m.dark, [0, 0, 0], 0.025);
  for (const x of [-0.20, -0.07, 0.07, 0.20]) box(body, `jammer_receiver_segment_${x}`, [0.065, 0.07, 0.025], [x, 0.03, -0.635], m.accent, [0, 0, 0], 0.008);
  const arrayYaw = joint(body, joints, 'arrayYaw', [0, 0.29, 0.05]);
  cylinder(arrayYaw, 'jammer_yaw_base', 0.35, 0.40, 0.16, [0, 0, 0], m.dark, [0, 0, 0], 40);
  torus(arrayYaw, 'jammer_yaw_race', 0.34, 0.035, [0, 0.09, 0], m.edge, [Math.PI / 2, 0, 0]);
  const mast = joint(arrayYaw, joints, 'mast', [0, 0.11, 0]);
  rod(mast, 'jammer_main_mast', [0, 0.25, 0], [0, 1.38, 0], 0.065, m.hull, 24);
  box(mast, 'jammer_lower_truss_crosshead', [0.45, 0.10, 0.15], [0, 0.03, 0.08], m.dark, [0, 0, 0], 0.025);
  rod(mast, 'jammer_lower_truss_spine', [0, 0.03, 0.08], [0, 0.30, 0], 0.045, m.hull, 20);
  addMechanicalLink(root, joints, 'jammerMast', { from: { node: arrayYaw, point: [0, 0.02, 0] }, to: { node: mast, point: [0, 0.30, 0] }, radius: 0.046, sleeveRadius: 0.085, sleeveLength: 0.12, overlap: 0.08, materials: m });
  for (const side of [-1, 1]) {
    rod(mast, `jammer_mast_truss_${side}`, [side * 0.20, 0.02, 0.08], [side * 0.06, 1.16, 0.04], 0.032, m.edge, 12);
    rod(mast, `jammer_mast_crossbrace_${side}`, [side * 0.18, 0.12, 0.08], [-side * 0.05, 0.76, 0.04], 0.022, m.hull, 10);
  }
  for (let i = 0; i < 3; i++) {
    const y = 0.32 + i * 0.32;
    torus(mast, `jammer_induction_coil_${i}`, 0.19 + i * 0.025, 0.025, [0, y, 0], i === 1 ? m.energy : m.armor, [Math.PI / 2, 0, 0]);
    cylinder(mast, `jammer_coil_hub_${i}`, 0.10, 0.10, 0.12, [0, y, 0], m.dark, [0, 0, 0], 24);
  }
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'L' : 'R';
    const panelJoint = joint(mast, joints, `panel${label}`, [side * 0.15, 0.74, 0], [0, side * 0.10, 0]);
    bearing(panelJoint, `jammer_panel_hinge_${label}`, 0.105, 0.19, [0, 0, 0], m, 'y');
    for (const y of [-0.43, 0.43]) rod(panelJoint, `jammer_panel_horizontal_${label}_${y}`, [0, y, 0], [side * 0.56, y, 0], 0.028, m.armor, 12);
    rod(panelJoint, `jammer_panel_outer_${label}`, [side * 0.56, -0.43, 0], [side * 0.56, 0.43, 0], 0.032, m.armor, 12);
    for (let i = 0; i < 6; i++) {
      const y = -0.35 + i * 0.14;
      rod(panelJoint, `jammer_dipole_${label}_${i}`, [0.02 * side, y, -0.015], [side * (0.43 + (i % 2) * 0.09), y, -0.015], 0.014, i % 2 ? m.energy : m.edge, 10);
      sphere(panelJoint, `jammer_dipole_tip_${label}_${i}`, 0.026, [side * (0.43 + (i % 2) * 0.09), y, -0.015], m.accent);
    }
    rod(panelJoint, `jammer_panel_diagonal_${label}`, [0, -0.40, 0.04], [side * 0.54, 0.40, 0.04], 0.018, m.hull, 10);
  }
  const crown = joint(mast, joints, 'crown', [0, 1.38, 0]);
  torus(crown, 'jammer_crown_loop', 0.27, 0.030, [0, 0, 0], m.armor, [Math.PI / 2, 0, 0]);
  torus(crown, 'jammer_crown_signal', 0.20, 0.015, [0, 0.04, 0], m.energy, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    const x = Math.sin(angle) * 0.23, z = Math.cos(angle) * 0.23;
    rod(crown, `jammer_crown_spoke_${i}`, [0, 0, 0], [x, 0, z], 0.02, m.edge, 16);
    rod(crown, `jammer_crown_element_${i}`, [x, -0.04, z], [x, 0.28, z], 0.018, m.edge, 10);
    sphere(crown, `jammer_crown_tip_${i}`, 0.040, [x, 0.28, z], m.energy);
  }
  const charge = joint(crown, joints, 'charge', [0, 0.13, 0]);
  crystal(charge, 'jammer_charge_crystal', 0.115, [0, 0, 0], m.core, [0.85, 1.35, 0.85]);
  const waveNear = joint(mast, joints, 'waveNear', [0, 0.88, 0]);
  torus(waveNear, 'jammer_near_wave', 0.46, 0.018, [0, 0, 0], m.field, [Math.PI / 2, 0, 0]);
  torus(waveNear, 'jammer_near_wave_edge', 0.46, 0.006, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0]);
  const waveFar = joint(mast, joints, 'waveFar', [0, 1.10, 0]);
  torus(waveFar, 'jammer_far_wave', 0.67, 0.015, [0, 0, 0], m.field, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    box(waveFar, `jammer_wave_tick_${i}`, [0.06, 0.035, 0.12], [Math.sin(angle) * 0.67, 0, Math.cos(angle) * 0.67], m.accent, [0, angle, 0], 0.008);
  }
  return { root, joints };
}

function jammerPanels(set, openness, pitch = 0) {
  for (const [label, side] of [['L', -1], ['R', 1]]) set(`panel${label}`, { r: [pitch, side * openness, side * pitch * 0.35] });
}

function bandwidthJammerClips(root, joints) {
  return makeClips(root, joints, [
    ['idle', 3.0, (u, t, { set }) => {
      const sway = Math.sin(TAU * u);
      set('body', { p: [0, sway * 0.016, 0], r: [0, 0, sway * 0.012] });
      set('arrayYaw', { r: [0, sway * 0.14, 0] });
      set('mast', { r: [sway * 0.025, 0, 0] });
      jammerPanels(set, 0.08 * sway, 0.02 * sway);
      set('crown', { r: [0, t * 0.35, 0] });
      set('charge', { r: [0, -t * 0.7, 0], s: [1 + 0.08 * sway, 1 + 0.08 * sway, 1 + 0.08 * sway] });
      set('waveNear', { r: [0, t * 0.20, 0], s: [1 + 0.05 * sway, 1, 1 + 0.05 * sway] });
      set('waveFar', { r: [0, -t * 0.15, 0] });
    }],
    ['move', 1.2, (u, t, { set }) => {
      walk({ set }, u, 0.9);
      set('body', { p: [0, 0.025 * Math.cos(TAU * u * 2), 0], r: [0.02 * Math.sin(TAU * u), 0, 0.035 * Math.sin(TAU * u)] });
      set('arrayYaw', { r: [0, -0.08 * Math.sin(TAU * u), 0] });
      set('mast', { r: [-0.035 * Math.cos(TAU * u * 2), 0, 0] });
      jammerPanels(set, -0.20, 0.04 * Math.sin(TAU * u));
      set('crown', { r: [0, t * 0.5, 0] });
      set('waveNear', { r: [0, t * 0.25, 0] });
      set('waveFar', { r: [0, -t * 0.20, 0] });
    }],
    ['attack', 1.8, (u, t, { set }) => {
      const aim = ease(u, 0, 0.32) * (1 - ease(u, 0.72, 1));
      const jam = pulse(u, 0.34, 0.48, 0.78);
      braceLegs({ set }, aim * 0.7);
      set('body', { p: [0, -0.035 * aim, 0.04 * jam], r: [-0.03 * jam, 0, 0] });
      set('arrayYaw', { r: [0, -0.30 * aim, 0] });
      set('mast', { r: [-0.18 * aim + 0.06 * jam, 0, 0] });
      jammerPanels(set, 0.60 * aim, -0.10 * jam);
      set('crown', { r: [0, t * (1 + jam * 5), 0] });
      set('charge', { s: [1 + 0.45 * jam, 1 + 0.45 * jam, 1 + 0.45 * jam] });
      set('waveNear', { r: [0, t * 3, 0], s: [0.75 + 0.85 * jam, 1, 0.75 + 0.85 * jam] });
      set('waveFar', { r: [0, -t * 2, 0], s: [0.65 + 0.75 * jam, 1, 0.65 + 0.75 * jam] });
    }],
    ['windup', 1.6, (u, t, { set }) => {
      const charge = ease(u, 0, 0.85);
      braceLegs({ set }, charge);
      set('body', { p: [0, -0.055 * charge, 0.025 * charge], r: [0.025 * charge, 0, 0] });
      set('arrayYaw', { r: [0, -0.34 * charge, 0] });
      set('mast', { p: [0, 0.10 * charge, 0], r: [-0.20 * charge, 0, 0] });
      jammerPanels(set, 0.82 * charge, -0.08 * charge);
      set('crown', { r: [0, t * 5 * charge, 0] });
      set('charge', { r: [0, -t * 4 * charge, 0], s: [1 + 0.65 * charge, 1 + 0.65 * charge, 1 + 0.65 * charge] });
      set('waveNear', { s: [0.72 + 0.20 * charge, 1, 0.72 + 0.20 * charge] });
      set('waveFar', { s: [0.62 + 0.18 * charge, 1, 0.62 + 0.18 * charge] });
    }],
    ['release', 1.15, (u, t, { set }) => {
      const recover = ease(u, 0.62, 1);
      const burst = pulse(u, 0.04, 0.24, 0.72);
      const echo = pulse(u, 0.22, 0.43, 0.88);
      braceLegs({ set }, 1 - recover);
      set('body', { p: [0, -0.05 * (1 - recover), 0.07 * burst], r: [-0.055 * burst, 0, 0] });
      set('arrayYaw', { r: [0, -0.34 * (1 - recover) + 0.12 * burst, 0] });
      set('mast', { p: [0, 0.10 * (1 - recover), 0], r: [-0.20 * (1 - recover) + 0.10 * burst, 0, 0] });
      jammerPanels(set, 0.82 * (1 - recover) - 0.18 * burst, 0.12 * burst);
      set('crown', { r: [0, t * 7 * (1 - recover), 0] });
      set('charge', { s: [1.65 - 0.65 * recover - 0.35 * burst, 1.65 - 0.65 * recover - 0.35 * burst, 1.65 - 0.65 * recover - 0.35 * burst] });
      set('waveNear', { p: [0, 0.25 * burst, 0], r: [0, t * 5, 0], s: [0.85 + 1.25 * burst, 1, 0.85 + 1.25 * burst] });
      set('waveFar', { p: [0, 0.32 * echo, 0], r: [0, -t * 4, 0], s: [0.75 + 1.10 * echo, 1, 0.75 + 1.10 * echo] });
    }],
    ['ability', 3.2, (u, t, { set }) => {
      const charge = ease(u, 0, 0.28) * (1 - ease(u, 0.82, 1));
      const jam = pulse(u, 0.22, 0.55, 0.90);
      const echo = pulse(u, 0.38, 0.68, 0.97);
      braceLegs({ set }, charge);
      set('body', { p: [0, -0.065 * charge, 0.025 * jam], r: [-0.025 * jam, 0, 0.025 * Math.sin(TAU * u) * jam] });
      set('arrayYaw', { r: [0, Math.sin(TAU * u) * 0.75 * charge, 0] });
      set('mast', { p: [0, 0.14 * charge, 0], r: [-0.16 * charge + 0.06 * Math.sin(TAU * u * 2) * jam, 0, 0] });
      jammerPanels(set, 0.95 * charge + 0.18 * Math.sin(TAU * u * 2) * jam, 0.10 * Math.cos(TAU * u) * jam);
      set('crown', { r: [0, t * (2 + 7 * jam), 0] });
      set('charge', { r: [0, -t * 5, 0], s: [1 + 0.75 * jam, 1 + 0.75 * jam, 1 + 0.75 * jam] });
      set('waveNear', { p: [0, 0.35 * jam, 0], r: [0, t * 5, 0], s: [0.70 + 1.65 * jam, 1, 0.70 + 1.65 * jam] });
      set('waveFar', { p: [0, 0.40 * echo, 0], r: [0, -t * 4, 0], s: [0.60 + 1.45 * echo, 1, 0.60 + 1.45 * echo] });
    }],
    ['shutdown', 2.4, (u, t, { set }) => {
      const down = ease(u, 0, 1);
      foldLegs({ set }, down);
      set('body', { p: [0, -0.18 * down, 0.07 * down], r: [-0.07 * down, 0, 0] });
      set('arrayYaw', { r: [0, 0.65 * down, 0] });
      set('mast', { p: [0, -0.06 * down, 0], r: [0.48 * down, 0, 0] });
      jammerPanels(set, -1.18 * down, 0.30 * down);
      set('crown', { r: [0, t * (1 - down), 0] });
      set('charge', { s: [1 - 0.75 * down, 1 - 0.75 * down, 1 - 0.75 * down] });
      set('waveNear', { s: [1 - 0.85 * down, 1 - 0.85 * down, 1 - 0.85 * down] });
      set('waveFar', { s: [1 - 0.90 * down, 1 - 0.90 * down, 1 - 0.90 * down] });
    }],
  ]);
}

function buildPhaseTeleporter() {
  const root = entityRoot('phase_teleporter');
  const joints = {};
  const m = palette('enemy');
  walkerLegs(root, joints, m, 0.78, 0.52, -0.40, 0.40);
  const body = joint(root, joints, 'body', [0, 0.94, 0.04]);
  mountRunningGear(root, body, joints, m, 'phase');
  hull(body, 'phase_chamfered_hull', [
    { z: 0.47, w: 0.58, h: 0.25, y: -0.04 },
    { z: 0.29, w: 0.88, h: 0.36, y: 0 },
    { z: -0.32, w: 0.86, h: 0.35, y: 0 },
    { z: -0.49, w: 0.56, h: 0.24, y: -0.04 },
  ], m.hull);
  box(body, 'phase_underframe', [0.62, 0.15, 0.76], [0, -0.20, 0], m.dark, [0, 0, 0], 0.03);
  for (const side of [-1, 1]) {
    panel(body, `phase_hip_armor_${side}`, [[-0.32, -0.12], [0.29, -0.12], [0.36, 0.09], [0.12, 0.20], [-0.28, 0.15]], 0.065, [side * 0.45, -0.015, 0], m.armor, [0, side * Math.PI / 2, 0], 0.018);
    cable(body, `phase_gimbal_feed_${side}`, [[side * 0.29, 0.08, 0.24], [side * 0.46, 0.14, 0.32], [side * 0.50, 0.27, 0.33], [side * 0.35, 0.32, 0.24], [side * 0.18, 0.28, 0.12], [0, 0.22, 0.02]], 0.026, m.dark);
  }
  const ringMount = joint(body, joints, 'ringMount', [0, 0.22, 0.02]);
  cylinder(ringMount, 'phase_gimbal_base', 0.29, 0.34, 0.14, [0, 0, 0], m.dark, [0, 0, 0], 36);
  for (const side of [-1, 1]) {
    rod(ringMount, `phase_ring_support_${side}`, [side * 0.19, 0.02, 0], [side * 0.66, 0.40, 0], 0.050, m.hull, 16);
    bearing(ringMount, `phase_gimbal_bearing_${side}`, 0.14, 0.18, [side * 0.70, 0.40, 0], m, 'x');
  }
  const outerRing = joint(ringMount, joints, 'outerRing', [0, 0.40, 0]);
  torus(outerRing, 'phase_outer_gate', 0.68, 0.068, [0, 0, 0], m.hull);
  torus(outerRing, 'phase_outer_guard', 0.76, 0.022, [0, 0, 0.015], m.edge);
  for (let i = 0; i < 4; i++) {
    const start = i * Math.PI / 2 + 0.15;
    arc(outerRing, `phase_outer_signal_arc_${i}`, 0.68, 0.017, start, start + 1.15, [0, 0, -0.072], m.energy);
    const angle = i * Math.PI / 2;
    box(outerRing, `phase_outer_clamp_${i}`, [0.18, 0.16, 0.22], [Math.sin(angle) * 0.68, Math.cos(angle) * 0.68, 0], m.armor, [0, 0, -angle], 0.03);
    cylinder(outerRing, `phase_clamp_pin_${i}`, 0.045, 0.045, 0.25, [Math.sin(angle) * 0.68, Math.cos(angle) * 0.68, 0], m.accent, [Math.PI / 2, 0, 0], 12);
  }
  const innerRing = joint(outerRing, joints, 'innerRing', [0, 0, 0], [0, 0.30, 0]);
  torus(innerRing, 'phase_inner_gate', 0.48, 0.042, [0, 0, 0], m.armor);
  torus(innerRing, 'phase_inner_signal', 0.48, 0.012, [0, 0, -0.047], m.energy);
  for (let i = 0; i < 3; i++) {
    const angle = i * TAU / 3;
    const x = Math.sin(angle) * 0.48, y = Math.cos(angle) * 0.48;
    box(innerRing, `phase_inner_lock_${i}`, [0.13, 0.13, 0.15], [x, y, 0], m.dark, [0, 0, -angle], 0.022);
    rod(innerRing, `phase_core_spoke_${i}`, [x * 0.92, y * 0.92, 0.02], [x * 0.43, y * 0.43, 0.02], 0.022, m.edge, 12);
  }
  const phaseCore = joint(innerRing, joints, 'phaseCore', [0, 0, 0]);
  sphere(phaseCore, 'phase_core_shell', 0.235, [0, 0, 0], m.dark, [1, 1, 0.82]);
  crystal(phaseCore, 'phase_core_crystal', 0.20, [0, 0, -0.025], m.energy, [0.80, 1.18, 0.80], [0, 0, Math.PI / 4]);
  for (let i = 0; i < 3; i++) torus(phaseCore, `phase_core_orbit_${i}`, 0.27 + i * 0.035, 0.010, [0, 0, 0], i === 1 ? m.core : m.accent, [i * 0.65, i * 0.45, 0]);
  const phaseBurst = joint(ringMount, joints, 'phaseBurst', [0, 0.40, -0.10]);
  torus(phaseBurst, 'phase_burst_field', 0.54, 0.026, [0, 0, 0], m.field);
  arc(phaseBurst, 'phase_burst_trace_a', 0.56, 0.009, 0.15, 2.75, [0, 0, -0.01], m.energy);
  arc(phaseBurst, 'phase_burst_trace_b', 0.56, 0.009, 3.30, 5.90, [0, 0, -0.01], m.energy);
  const emitter = joint(body, joints, 'emitter', [0, 0.12, -0.48]);
  bearing(body, 'phase_projector_trunnion', 0.105, 0.32, [0, 0.12, -0.48], m, 'x');
  box(emitter, 'phase_projector_housing', [0.36, 0.24, 0.38], [0, 0, -0.10], m.hull, [0, 0, 0], 0.045);
  cylinder(emitter, 'phase_projector_barrel', 0.085, 0.11, 0.35, [0, 0, -0.34], m.dark, [Math.PI / 2, 0, 0], 28);
  torus(emitter, 'phase_projector_muzzle', 0.105, 0.022, [0, 0, -0.53], m.energy);
  for (const side of [-1, 1]) rod(emitter, `phase_projector_fork_${side}`, [side * 0.13, 0, -0.20], [side * 0.13, 0, -0.50], 0.025, m.edge, 12);
  return { root, joints };
}

function phaseTeleporterClips(root, joints) {
  return makeClips(root, joints, [
    ['idle', 2.9, (u, t, { set }) => {
      const hover = Math.sin(TAU * u);
      set('body', { p: [0, hover * 0.018, 0], r: [0, 0, hover * 0.012] });
      set('ringMount', { r: [0, hover * 0.035, 0] });
      set('outerRing', { r: [0.025 * hover, 0, t * 0.22] });
      set('innerRing', { r: [0.12 * hover, t * 0.30, -t * 0.18] });
      set('phaseCore', { r: [0, -t * 0.50, 0], s: [1 + 0.07 * hover, 1 + 0.07 * hover, 1 + 0.07 * hover] });
      set('phaseBurst', { r: [0, 0, -t * 0.20], s: [0.92 + 0.06 * hover, 0.92 + 0.06 * hover, 1] });
      set('emitter', { r: [0.025 * hover, 0, 0] });
    }],
    ['move', 1.05, (u, t, { set }) => {
      walk({ set }, u, 1.1);
      set('body', { p: [0, 0.026 * Math.cos(TAU * u * 2), 0], r: [0.025 * Math.sin(TAU * u), 0, 0.035 * Math.sin(TAU * u)] });
      set('ringMount', { r: [-0.025 * Math.sin(TAU * u), 0, -0.03 * Math.sin(TAU * u)] });
      set('outerRing', { r: [0, 0, t * 0.45] });
      set('innerRing', { r: [0, t * 0.65, 0] });
      set('phaseCore', { r: [0, -t * 0.7, 0] });
      set('phaseBurst', { r: [0, 0, -t * 0.35] });
      set('emitter', { r: [-0.025 * Math.cos(TAU * u * 2), 0, 0] });
    }],
    ['attack', 1.55, (u, t, { set }) => {
      const aim = ease(u, 0, 0.28) * (1 - ease(u, 0.72, 1));
      const shot = pulse(u, 0.32, 0.43, 0.70);
      braceLegs({ set }, aim * 0.65);
      set('body', { p: [0, -0.035 * aim, 0.045 * shot], r: [-0.04 * shot, 0, 0] });
      set('ringMount', { r: [0.08 * aim, 0, 0] });
      set('outerRing', { r: [0, 0, t * (0.5 + aim * 2)] });
      set('innerRing', { r: [0.25 * aim, -t * (0.5 + aim * 2), 0] });
      set('phaseCore', { s: [1 + 0.35 * aim - 0.20 * shot, 1 + 0.35 * aim - 0.20 * shot, 1 + 0.35 * aim - 0.20 * shot] });
      set('phaseBurst', { r: [0, 0, t * 3], s: [0.85 + 0.60 * shot, 0.85 + 0.60 * shot, 1] });
      set('emitter', { p: [0, 0, 0.14 * shot], r: [0.14 * aim - 0.10 * shot, 0, 0] });
    }],
    ['windup', 1.5, (u, t, { set }) => {
      const charge = ease(u, 0, 0.84);
      braceLegs({ set }, charge);
      set('body', { p: [0, -0.05 * charge, 0.025 * charge], r: [0.03 * charge, 0, 0] });
      set('ringMount', { r: [0.12 * charge, 0, 0] });
      set('outerRing', { r: [0, 0, 1.30 * charge] });
      set('innerRing', { r: [0.45 * charge, -1.05 * charge, 0] });
      set('phaseCore', { r: [0, t * 4 * charge, 0], s: [1 + 0.50 * charge, 1 + 0.50 * charge, 1 + 0.50 * charge] });
      set('phaseBurst', { r: [0, 0, -t * 3 * charge], s: [0.72 + 0.30 * charge, 0.72 + 0.30 * charge, 1] });
      set('emitter', { r: [0.16 * charge, 0, 0] });
    }],
    ['release', 1.2, (u, t, { set }) => {
      const phase = pulse(u, 0.08, 0.36, 0.76);
      const recover = ease(u, 0.65, 1);
      const scale = 1 - 0.78 * phase;
      braceLegs({ set }, 1 - recover);
      set('body', { p: [0, -0.05 * (1 - recover) + 0.06 * phase, 0.04 * phase], r: [-0.055 * phase, 0, 0] });
      set('ringMount', { r: [0.12 * (1 - recover), 0, 0] });
      set('outerRing', { r: [0, 0, 1.30 + TAU * ease(u, 0, 0.78)] });
      set('innerRing', { r: [0.45 * (1 - recover), -1.05 - TAU * ease(u, 0, 0.78), 0] });
      set('phaseCore', { r: [0, t * 6, 0], s: [scale, scale, scale] });
      set('phaseBurst', { r: [0, 0, -t * 6], s: [0.95 + 1.20 * phase, 0.95 + 1.20 * phase, 1] });
      set('emitter', { p: [0, 0, 0.16 * phase], r: [0.16 * (1 - recover) - 0.10 * phase, 0, 0] });
    }],
    ['ability', 3.1, (u, t, { set }) => {
      const charge = ease(u, 0, 0.34) * (1 - ease(u, 0.84, 1));
      const vanished = ease(u, 0.34, 0.48) * (1 - ease(u, 0.58, 0.78));
      const burst = pulse(u, 0.40, 0.58, 0.88);
      const coreScale = (1 + 0.42 * charge) * (1 - 0.92 * vanished);
      braceLegs({ set }, charge);
      set('body', { p: [0, -0.055 * charge + 0.07 * burst, 0], r: [0.035 * charge - 0.05 * burst, 0, 0] });
      set('ringMount', { r: [0.15 * charge, 0.20 * Math.sin(TAU * u) * charge, 0] });
      set('outerRing', { r: [0.22 * charge, 0, TAU * ease(u, 0, 0.80)] });
      set('innerRing', { r: [0.75 * charge, -TAU * ease(u, 0, 0.80), 0] });
      set('phaseCore', { r: [0, t * (2 + 8 * burst), 0], s: [coreScale, coreScale, coreScale] });
      set('phaseBurst', { r: [0, 0, -t * 8 * charge], s: [0.70 + 0.50 * charge + 1.20 * burst, 0.70 + 0.50 * charge + 1.20 * burst, 1] });
      set('emitter', { r: [0.20 * charge - 0.12 * burst, 0, 0] });
    }],
    ['shutdown', 2.35, (u, t, { set }) => {
      const down = ease(u, 0, 1);
      foldLegs({ set }, down);
      set('body', { p: [0, -0.18 * down, 0.06 * down], r: [-0.08 * down, 0, 0] });
      set('ringMount', { r: [0.30 * down, 0, 0] });
      set('outerRing', { r: [0.55 * down, 0, 0.35 * down] });
      set('innerRing', { r: [0, 1.15 * down, -0.30 * down] });
      set('phaseCore', { r: [0, t * (1 - down), 0], s: [1 - 0.72 * down, 1 - 0.72 * down, 1 - 0.72 * down] });
      set('phaseBurst', { s: [1 - 0.88 * down, 1 - 0.88 * down, 1 - 0.88 * down] });
      set('emitter', { p: [0, -0.04 * down, 0.10 * down], r: [-0.42 * down, 0, 0] });
    }],
  ]);
}

function buildReplicationNode() {
  const root = entityRoot('replication_node');
  const joints = {};
  const m = palette('enemy');
  wheelSet(root, joints, m, [['FL', -0.65, -0.49], ['FR', 0.65, -0.49], ['RL', -0.65, 0.49], ['RR', 0.65, 0.49]], 0.33, 0.24);
  const body = joint(root, joints, 'body', [0, 0.84, 0.05]);
  mountRunningGear(root, body, joints, m, 'replicator');
  hull(body, 'replicator_chamfered_hull', [
    { z: 0.72, w: 0.86, h: 0.36, y: -0.04 },
    { z: 0.49, w: 1.16, h: 0.48, y: 0 },
    { z: -0.48, w: 1.14, h: 0.47, y: 0 },
    { z: -0.71, w: 0.80, h: 0.32, y: -0.05 },
  ], m.hull);
  box(body, 'replicator_undertray', [0.83, 0.16, 1.20], [0, -0.26, 0], m.dark, [0, 0, 0], 0.03);
  for (const side of [-1, 1]) {
    box(body, `replicator_feed_case_${side}`, [0.19, 0.34, 0.80], [side * 0.56, 0.02, 0.12], m.armor, [0, 0, 0], 0.035);
    for (let i = 0; i < 3; i++) {
      box(body, `replicator_feed_slot_${side}_${i}`, [0.025, 0.17, 0.15], [side * 0.665, 0.04, -0.15 + i * 0.24], m.dark, [0, 0, 0], 0.008);
      box(body, `replicator_feed_signal_${side}_${i}`, [0.029, 0.035, 0.10], [side * 0.68, 0.10, -0.15 + i * 0.24], m.accent, [0, 0, 0], 0.006);
    }
    cable(body, `replicator_pod_feed_${side}`, [[side * 0.48, 0.12, 0.38], [side * 0.51, 0.36, 0.34], [side * 0.39, 0.48, 0.22]], 0.031, m.dark);
  }
  const head = joint(body, joints, 'head', [0, 0.10, -0.61]);
  box(head, 'replicator_sensor_head', [0.60, 0.27, 0.27], [0, 0, 0], m.dark, [0, 0, 0], 0.05);
  box(head, 'replicator_sensor_brow', [0.52, 0.08, 0.19], [0, 0.17, -0.025], m.armor, [0, 0, 0], 0.025);
  for (const side of [-1, 1]) {
    cylinder(head, `replicator_optic_${side}`, 0.065, 0.065, 0.045, [side * 0.17, 0.025, -0.155], m.energy, [Math.PI / 2, 0, 0], 24);
    rod(head, `replicator_sensor_whisker_${side}`, [side * 0.25, 0.07, 0], [side * 0.38, 0.16, -0.16], 0.018, m.edge, 10);
  }
  const noseEmitter = joint(head, joints, 'noseEmitter', [0, -0.055, -0.18]);
  torus(noseEmitter, 'replicator_nose_ring', 0.070, 0.015, [0, 0, 0], m.accent);
  crystal(noseEmitter, 'replicator_nose_focus', 0.045, [0, 0, -0.02], m.core, [1, 1, 0.65]);
  const pod = joint(body, joints, 'pod', [0, 0.22, 0.18]);
  cylinder(pod, 'replicator_pod_base', 0.49, 0.53, 0.17, [0, 0.06, 0], m.dark, [0, 0, 0], 40);
  mesh(pod, 'replicator_chamber_glass', new THREE.CylinderGeometry(0.38, 0.38, 0.84, 32, 1, true, -Math.PI / 2, Math.PI), m.glass, [0, 0.55, 0]);
  cylinder(pod, 'replicator_pod_crown', 0.46, 0.40, 0.17, [0, 1.04, 0], m.armor, [0, 0, 0], 40);
  for (const y of [0.16, 0.94]) {
    torus(pod, `replicator_chamber_band_${y}`, 0.41, 0.040, [0, y, 0], m.edge, [Math.PI / 2, 0, 0]);
    torus(pod, `replicator_chamber_signal_${y}`, 0.43, 0.012, [0, y + 0.025, 0], m.energy, [Math.PI / 2, 0, 0]);
  }
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + i * Math.PI / 2;
    const x = Math.sin(angle) * 0.42, z = Math.cos(angle) * 0.42;
    rod(pod, `replicator_chamber_column_${i}`, [x, 0.13, z], [x, 0.99, z], 0.032, m.hull, 14);
    cylinder(pod, `replicator_column_pin_${i}`, 0.052, 0.052, 0.10, [x, 0.17, z], m.accent, [0, 0, 0], 12);
  }
  box(pod, 'replicator_chamber_backplane', [0.64, 0.78, 0.10], [0, 0.55, 0.36], m.hull, [0, 0, 0], 0.04);
  for (let i = -2; i <= 2; i++) box(pod, `replicator_backplane_vent_${i}`, [0.075, 0.50, 0.035], [i * 0.11, 0.56, 0.425], m.edge, [0, 0, 0], 0.01);
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'L' : 'R';
    const door = joint(pod, joints, `door${label}`, [side * 0.39, 0.55, 0.27]);
    box(door, `replicator_hatch_${label}`, [0.085, 0.75, 0.48], [0, 0, -0.23], m.armor, [0, 0, 0], 0.035);
    box(door, `replicator_hatch_inset_${label}`, [0.095, 0.50, 0.30], [0, 0, -0.24], m.dark, [0, 0, 0], 0.025);
    box(door, `replicator_hatch_signal_${label}`, [0.103, 0.055, 0.24], [0, 0.19, -0.27], m.accent, [0, 0, 0], 0.012);
    cylinder(door, `replicator_hatch_hinge_${label}`, 0.055, 0.055, 0.82, [0, 0, 0], m.edge, [0, 0, 0], 20);
    for (const y of [-0.27, 0.27]) {
      bearing(door, `replicator_hatch_pin_${label}_${y}`, 0.065, 0.12, [0, y, 0], m, 'y');
      mesh(pod, `replicator_hatch_socket_${label}_${y}`, annulusGeometry(0.09, 0.068, 0.1, 24), m.dark, [side * 0.39, 0.55 + y, 0.27]);
    }
  }
  const copy = joint(pod, joints, 'copy', [0, 0.23, -0.02]);
  hull(copy, 'replicator_embryo_hull', [
    { z: 0.20, w: 0.22, h: 0.13 },
    { z: 0.10, w: 0.34, h: 0.20 },
    { z: -0.18, w: 0.32, h: 0.19 },
    { z: -0.24, w: 0.20, h: 0.12 },
  ], m.armor, [0, 0.14, 0]);
  box(copy, 'replicator_embryo_core', [0.16, 0.09, 0.19], [0, 0.27, 0], m.energy, [0, 0, 0], 0.02);
  for (const side of [-1, 1]) {
    for (const z of [-0.13, 0.13]) {
      cylinder(copy, `replicator_embryo_wheel_${side}_${z}`, 0.075, 0.075, 0.075, [side * 0.20, 0.055, z], m.dark, [0, 0, Math.PI / 2], 18);
      cylinder(copy, `replicator_embryo_hub_${side}_${z}`, 0.035, 0.035, 0.09, [side * 0.20, 0.055, z], m.accent, [0, 0, Math.PI / 2], 12);
    }
  }
  const scanner = joint(pod, joints, 'scanner', [0, 0.43, 0]);
  const scannerGlow = joint(scanner, joints, 'scannerGlow');
  torus(scannerGlow, 'replicator_scan_ring', 0.32, 0.022, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0]);
  torus(scanner, 'replicator_scan_guard', 0.35, 0.015, [0, 0.025, 0], m.dark, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    box(scanner, `replicator_scan_head_${i}`, [0.09, 0.08, 0.10], [Math.sin(angle) * 0.32, 0, Math.cos(angle) * 0.32], m.accent, [0, angle, 0], 0.015);
  }
  const injector = joint(pod, joints, 'injector', [0, 1.10, 0]);
  mesh(pod, 'replicator_injector_housing', annulusGeometry(0.15, 0.052, 0.20, 28), m.dark, [0, 1.10, 0]);
  addMechanicalLink(root, joints, 'replicatorInjector', { from: { node: pod, point: [0, 1.15, 0] }, to: { node: injector, point: [0, -0.35, 0] }, radius: 0.035, sleeveRadius: 0.05, sleeveLength: 0.12, overlap: 0.08, materials: m });
  crystal(injector, 'replicator_injector_focus', 0.075, [0, -0.40, 0], m.energy, [0.75, 1.25, 0.75]);
  return { root, joints };
}

function replicationDoors(set, amount) {
  set('doorL', { r: [0, 1.12 * amount, 0] });
  set('doorR', { r: [0, -1.12 * amount, 0] });
}

function replicationNodeClips(root, joints) {
  return makeClips(root, joints, [
    ['idle', 2.7, (u, t, { set }) => {
      const breathe = Math.sin(TAU * u);
      set('body', { p: [0, breathe * 0.014, 0], r: [0, 0, breathe * 0.010] });
      set('head', { r: [0.025 * breathe, 0.10 * breathe, 0] });
      set('noseEmitter', { r: [0, 0, t * 0.35] });
      set('pod', { r: [0.012 * breathe, 0, 0] });
      set('copy', { r: [0, 0.08 * breathe, 0], s: [1 + 0.035 * breathe, 1 + 0.035 * breathe, 1 + 0.035 * breathe] });
      set('scanner', { p: [0, 0.10 * breathe, 0], r: [0, t * 0.45, 0] });
      set('injector', { p: [0, 0.025 * breathe, 0] });
    }],
    ['move', 1.25, (u, t, { set }) => {
      spinWheels({ set }, -TAU * 2 * u);
      set('body', { p: [0, 0.022 * Math.cos(TAU * u * 2), 0], r: [0.022 * Math.sin(TAU * u), 0, 0.020 * Math.cos(TAU * u)] });
      set('head', { r: [-0.025 * Math.sin(TAU * u), 0, 0] });
      set('noseEmitter', { r: [0, 0, t * 0.5] });
      set('pod', { r: [-0.018 * Math.sin(TAU * u), 0, -0.015 * Math.cos(TAU * u)] });
      set('copy', { r: [0, -0.05 * Math.sin(TAU * u), 0] });
      set('scanner', { r: [0, t * 0.5, 0] });
      set('injector', { p: [0, 0.02 * Math.cos(TAU * u * 2), 0] });
    }],
    ['attack', 1.65, (u, t, { set }) => {
      const aim = ease(u, 0, 0.28) * (1 - ease(u, 0.72, 1));
      const shot = pulse(u, 0.32, 0.45, 0.74);
      set('body', { p: [0, -0.025 * aim, 0.035 * shot], r: [-0.035 * shot, 0, 0] });
      set('head', { p: [0, 0, 0.09 * shot], r: [0.12 * aim - 0.08 * shot, -0.18 * aim, 0] });
      set('noseEmitter', { r: [0, 0, t * (1 + 6 * shot)], s: [1 + 0.65 * shot, 1 + 0.65 * shot, 1] });
      set('pod', { r: [-0.025 * shot, 0, 0] });
      set('scanner', { p: [0, 0.15 * aim, 0], r: [0, t * (1 + aim * 2), 0] });
      set('injector', { p: [0, -0.08 * aim, 0] });
    }],
    ['windup', 1.7, (u, t, { set }) => {
      const charge = ease(u, 0, 0.86);
      const copyScale = 0.25 + 0.55 * charge;
      set('body', { p: [0, -0.045 * charge, 0.02 * charge], r: [0.025 * charge, 0, 0] });
      set('head', { r: [0.12 * charge, -0.22 * charge, 0] });
      set('noseEmitter', { s: [1 + 0.25 * charge, 1 + 0.25 * charge, 1] });
      set('pod', { r: [0.04 * charge, 0, 0] });
      replicationDoors(set, 0.62 * charge);
      set('copy', { p: [0, -0.05 * charge, 0], r: [0, t * charge, 0], s: [copyScale, copyScale, copyScale] });
      set('scanner', { p: [0, 0.40 * charge, 0], r: [0, t * 5 * charge, 0], s: [1 + 0.15 * charge, 1, 1 + 0.15 * charge] });
      set('injector', { p: [0, -0.27 * charge, 0], r: [0, t * 2 * charge, 0] });
    }],
    ['release', 1.25, (u, t, { set }) => {
      const deploy = pulse(u, 0.06, 0.42, 0.82);
      const recover = ease(u, 0.68, 1);
      const copyScale = 0.80 + 0.25 * deploy + 0.20 * recover;
      set('body', { p: [0, -0.04 * (1 - recover), -0.035 * deploy], r: [-0.035 * deploy, 0, 0] });
      set('head', { r: [0.12 * (1 - recover) - 0.08 * deploy, -0.22 * (1 - recover), 0] });
      set('noseEmitter', { r: [0, 0, t * 4 * (1 - recover)], s: [1 + 0.35 * deploy, 1 + 0.35 * deploy, 1] });
      set('pod', { r: [0.04 * (1 - recover) - 0.03 * deploy, 0, 0] });
      replicationDoors(set, 0.62 + 0.50 * deploy - 1.12 * recover);
      set('copy', { p: [0, 0.07 * deploy, -0.20 * deploy], r: [0, t * 3 * (1 - recover), 0], s: [copyScale, copyScale, copyScale] });
      set('scanner', { p: [0, 0.40 * (1 - recover) - 0.22 * deploy, 0], r: [0, t * 7 * (1 - recover), 0] });
      set('injector', { p: [0, -0.27 * (1 - recover) + 0.08 * deploy, 0] });
    }],
    ['ability', 3.4, (u, t, { set }) => {
      const open = ease(u, 0.02, 0.25) * (1 - ease(u, 0.82, 1));
      const grow = ease(u, 0.10, 0.57);
      const deploy = ease(u, 0.60, 0.76) * (1 - ease(u, 0.86, 1));
      const scan = Math.sin(TAU * u * 2) * open;
      const copyScale = 0.20 + 0.85 * grow - 0.05 * ease(u, 0.88, 1);
      set('body', { p: [0, -0.055 * open, -0.035 * deploy], r: [0.025 * open - 0.04 * deploy, 0, 0] });
      set('head', { r: [0.16 * open - 0.10 * deploy, 0.20 * Math.sin(TAU * u) * open, 0] });
      set('noseEmitter', { r: [0, 0, t * 5 * open], s: [1 + 0.45 * deploy, 1 + 0.45 * deploy, 1] });
      set('pod', { r: [0.05 * open - 0.04 * deploy, 0, 0] });
      replicationDoors(set, open);
      set('copy', { p: [0, 0.09 * deploy, -0.52 * deploy], r: [0, t * (1 + 3 * grow), 0], s: [copyScale, copyScale, copyScale] });
      set('scanner', { p: [0, 0.28 * scan + 0.16 * open, 0], r: [0, t * 8 * open, 0], s: [1 + 0.20 * deploy, 1, 1 + 0.20 * deploy] });
      set('injector', { p: [0, -0.30 * grow * (1 - ease(u, 0.58, 0.80)), 0], r: [0, -t * 4 * open, 0] });
    }],
    ['shutdown', 2.45, (u, t, { set }) => {
      const down = ease(u, 0, 1);
      spinWheels({ set }, 0.08 * (1 - down));
      set('body', { p: [0, -0.15 * down, 0.07 * down], r: [-0.07 * down, 0, 0] });
      set('head', { r: [-0.35 * down, 0.30 * down, 0] });
      set('noseEmitter', { s: [1 - 0.70 * down, 1 - 0.70 * down, 1 - 0.70 * down] });
      set('pod', { r: [0.26 * down, 0, 0] });
      replicationDoors(set, 1 - down);
      set('copy', { p: [0, -0.08 * down, 0], s: [1 - 0.72 * down, 1 - 0.72 * down, 1 - 0.72 * down] });
      set('scanner', { p: [0, 0.25 * (1 - down) - 0.22 * down, 0], r: [0, t * (1 - down), 0] });
      set('injector', { p: [0, -0.25 * (1 - down) + 0.06 * down, 0] });
    }],
  ]);
}

export const entities = [
  defineEntity({
    id: 'remote_hunter',
    name: '远距猎杀者',
    kind: 'monster',
    role: 'ranged',
    locomotion: 'quadruped',
    variants: ['base'],
    concept: '低伏四足猎杀平台，以长管精密武器和独立测距瞄具锁定防御塔。',
    mechanism: '瞄具前伸并完成目标标记，撑稳步足后枪管后坐、枪机循环，优先猎杀防御设施。',
    build(variant) { return buildRemoteHunter(variant); },
    clips(root, joints) { return remoteHunterClips(root, joints); },
  }),
  defineEntity({
    id: 'siege_ram',
    name: '攻城冲锤',
    kind: 'monster',
    role: 'siege',
    locomotion: 'six-wheeled',
    variants: ['base'],
    concept: '六轮重型攻城车，双导轨悬挂大型冲锤，撞击前以液压撑脚固定车身。',
    mechanism: '活塞冲锤后拉蓄能、撑脚落地，随后沿导轨猛冲并卸载冲击力，专责破坏防御建筑。',
    build(variant) { return buildSiegeRam(variant); },
    clips(root, joints) { return siegeRamClips(root, joints); },
  }),
  defineEntity({
    id: 'memory_medic',
    name: '记忆医师',
    kind: 'monster',
    role: 'support',
    locomotion: 'four-wheeled',
    variants: ['base'],
    concept: '搭载记忆流体罐与双多关节维修臂的轮式医护单位。',
    mechanism: '双臂展开校准，腕部修复环释放维修脉冲，流体核心随治疗输出卸载，恢复受伤友军。',
    build(variant) { return buildMemoryMedic(variant); },
    clips(root, joints) { return memoryMedicClips(root, joints); },
  }),
  defineEntity({
    id: 'bandwidth_jammer',
    name: '带宽干扰体',
    kind: 'monster',
    role: 'control',
    locomotion: 'quadruped',
    variants: ['base'],
    concept: '四足稳定的移动天线阵，折叠偶极板与感应线圈围绕中央干扰桅杆布置。',
    mechanism: '天线板展开并蓄积干扰信号，双层波环依次扩散，对防御网络施加带宽干扰。',
    build(variant) { return buildBandwidthJammer(variant); },
    clips(root, joints) { return bandwidthJammerClips(root, joints); },
  }),
  defineEntity({
    id: 'phase_teleporter',
    name: '相位迁跃体',
    kind: 'monster',
    role: 'teleport',
    locomotion: 'quadruped',
    variants: ['base'],
    concept: '步足承载的双层陀螺迁跃环，中央相位核心被机械锁爪与轨道环包围。',
    mechanism: '内外迁跃环反向加速，核心收缩进入相位态，波环扩张后核心重组并完成迁跃卸载。',
    build(variant) { return buildPhaseTeleporter(variant); },
    clips(root, joints) { return phaseTeleporterClips(root, joints); },
  }),
  defineEntity({
    id: 'replication_node',
    name: '复制节点',
    kind: 'monster',
    role: 'replication',
    locomotion: 'four-wheeled',
    variants: ['base'],
    concept: '背负透明复制舱的轮式节点，舱内具有扫描环、顶部注入器和双开装甲舱门。',
    mechanism: '扫描环往复读取模板，注入器下降生成复制体，舱门打开后将成品前送并完成复制卸载。',
    build(variant) { return buildReplicationNode(variant); },
    clips(root, joints) { return replicationNodeClips(root, joints); },
  }),
];
