import * as THREE from '../../vendor/three/build/three.module.js';
import { defineEntity } from './contract.js';
import {
  palette, group, mesh, box, panel, cylinder, sphere, torus, arc, cable, rod,
  lathe, hull, bearing, fasteners, mirrored,
} from '../geometry.js';
import { createRigClip as sourceRigClip, TAU, ease, pulse } from '../animations.js';
import { addMechanicalLink, withMechanicalLinks } from './mechanical-links.js';

const wave = (time, offset = 0) => Math.sin(TAU * (time + offset));
const hold = (time, start = 0.12, peak = 0.3, end = 0.82) => ease(time, start, peak) * (1 - ease(time, end, 1));

function createRigClip(root, joints, name, duration, pose) {
  const constrained = (p, t, api) => pose(p, t, {
    ...api,
    set(key, value = {}) {
      const state = { ...value };
      // Feet and shoulder bearings rotate about their physical attachment.
      if (/^foot[LR]$/.test(key) || (root.name.startsWith('scrap_bulwark') && /^arm[LR]$/.test(key))) delete state.p;
      // The bell hangs from its crown; its hammer and iris pivot at fixed pins.
      if (root.name.startsWith('noise_bell') && (key === 'bell' || key === 'clapper' || /^iris\d$/.test(key))) delete state.p;
      if (root.name.startsWith('noise_bell') && key === 'clapper' && state.r) {
        const swing = Math.hypot(state.r[0], state.r[2]);
        if (swing > 0.42) state.r = [state.r[0] * 0.42 / swing, state.r[1], state.r[2] * 0.42 / swing];
      }
      api.set(key, state);
    },
  });
  return sourceRigClip(root, joints, name, duration, withMechanicalLinks(root, joints, constrained));
}

function createRoot(name) {
  const root = new THREE.Group();
  root.name = name;
  return root;
}

function signalMaterials() {
  const materials = palette('enemy');
  materials.accent.name = 'Dark coral signal enamel';
  materials.accent.color.setHex(0x713844);
  materials.accent.emissive.setHex(0x4b1825);
  materials.accent.emissiveIntensity = 0.52;
  materials.energy.color.setHex(0xa55360);
  materials.energy.emissive.setHex(0x6d2435);
  materials.energy.emissiveIntensity = 1.05;
  materials.core.color.setHex(0xc17a80);
  materials.core.emissive.setHex(0x7d3040);
  materials.core.emissiveIntensity = 0.85;
  materials.field.color.setHex(0x8d4353);
  materials.field.emissive.setHex(0x5d1d2d);
  materials.field.opacity = 0.18;
  return materials;
}

function buildScrapBulwark(variant = 'base') {
  const root = createRoot(`scrap_bulwark_${variant}`);
  const m = signalMaterials();
  const body = group(root, 'bulwark_body', [0, 0.92, 0.12]);
  hull(body, 'bulwark_continuous_shell', [
    { z: -0.58, w: 0.78, h: 0.4, y: -0.03, chamfer: 0.1 },
    { z: -0.43, w: 1.12, h: 0.62, y: 0.01, chamfer: 0.14 },
    { z: -0.1, w: 1.25, h: 0.72, y: 0.03, chamfer: 0.16 },
    { z: 0.35, w: 1.16, h: 0.68, y: 0.02, chamfer: 0.15 },
    { z: 0.62, w: 0.84, h: 0.48, y: -0.03, chamfer: 0.12 },
    { z: 0.7, w: 0.56, h: 0.3, y: -0.06, chamfer: 0.08 },
  ], m.hull);
  hull(body, 'bulwark_load_keel', [
    { z: -0.48, w: 0.42, h: 0.2, y: -0.34 },
    { z: -0.2, w: 0.64, h: 0.28, y: -0.36 },
    { z: 0.42, w: 0.58, h: 0.26, y: -0.34 },
    { z: 0.64, w: 0.32, h: 0.18, y: -0.3 },
  ], m.dark);
  box(body, 'bulwark_top_spine', [0.28, 0.18, 1.02], [0, 0.4, 0.04], m.armor, [0.04, 0, 0], 0.055);
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    panel(body, `bulwark_flank_${id}`, mirrored([
      [-0.42, -0.22], [0.3, -0.25], [0.45, -0.02], [0.28, 0.28], [-0.28, 0.24], [-0.48, 0.04],
    ], side), 0.09, [side * 0.61, 0.01, 0.03], m.armor, [0, side * Math.PI / 2, 0], 0.028);
    rod(body, `bulwark_longeron_${id}`, [side * 0.48, -0.29, -0.38], [side * 0.48, -0.29, 0.53], 0.055, m.edge);
    cable(body, `bulwark_pressure_line_${id}`, [
      [side * 0.42, 0.26, 0.48], [side * 0.57, 0.35, 0.25], [side * 0.59, 0.31, -0.25],
    ], 0.025, m.accent);
  }

  const shield = group(root, 'bulwark_shield', [0, 1.0, -0.73]);
  const shieldOutline = [
    [-0.66, 0.58], [0.66, 0.58], [0.84, 0.36], [0.77, -0.38],
    [0.43, -0.66], [-0.43, -0.66], [-0.77, -0.38], [-0.84, 0.36],
  ];
  panel(shield, 'bulwark_shield_continuous_plate', shieldOutline, 0.2, [0, 0, 0], m.armor, [0, 0, 0], 0.055);
  panel(shield, 'bulwark_shield_inset', shieldOutline.map(([x, y]) => [x * 0.84, y * 0.82]), 0.055,
    [0, 0, -0.125], m.hull, [0, 0, 0], 0.025);
  box(shield, 'bulwark_shield_spine', [0.18, 1.03, 0.16], [0, 0.01, -0.18], m.edge, [0, 0, 0], 0.04);
  box(shield, 'bulwark_coral_receptor', [0.075, 0.55, 0.035], [0, 0.12, -0.275], m.accent, [0, 0, 0], 0.012);
  fasteners(shield, 'bulwark_shield_bolts', [
    [-0.58, 0.35, -0.15], [0.58, 0.35, -0.15], [-0.5, -0.34, -0.15], [0.5, -0.34, -0.15],
  ], m.edge, 'z', 0.035);
  const ram = group(shield, 'bulwark_ram', [0, -0.48, -0.12]);
  hull(ram, 'bulwark_ram_shell', [
    { z: 0.44, w: 0.28, h: 0.12, chamfer: 0.035 },
    { z: 0.1, w: 0.68, h: 0.18, chamfer: 0.045 },
    { z: -0.12, w: 0.52, h: 0.2, chamfer: 0.05 },
    { z: -0.38, w: 0.2, h: 0.13, chamfer: 0.035 },
  ], m.dark);
  const cowls = {};
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    const cowl = group(shield, `bulwark_cowl_${id}`, [side * 0.69, 0.03, -0.04]);
    panel(cowl, `bulwark_cowl_plate_${id}`, mirrored([
      [0, -0.43], [0.24, -0.32], [0.31, 0.25], [0.08, 0.48], [0, 0.4],
    ], side), 0.13, [0, 0, 0], m.hull, [0, 0, 0], 0.035);
    rod(cowl, `bulwark_cowl_edge_${id}`, [side * 0.05, -0.35, -0.09], [side * 0.12, 0.35, -0.09], 0.025, m.accent);
    cowls[id] = cowl;
  }

  const joints = { body, shield, ram, cowlL: cowls.L, cowlR: cowls.R };
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    const arm = group(root, `bulwark_shield_arm_${id}`, [side * 0.55, 1.04, -0.25]);
    bearing(arm, `bulwark_arm_bearing_${id}`, 0.14, 0.18, [0, 0, 0], m, 'x');
    box(arm, `bulwark_arm_gland_${id}`, [0.20, 0.18, 0.16], [0, 0, -0.025], m.hull, [0, 0, 0], 0.045);
    joints[`arm${id}`] = arm;

    const hip = group(root, `bulwark_hip_${id}`, [side * 0.43, 0.8, 0.22]);
    bearing(hip, `bulwark_hip_bearing_${id}`, 0.18, 0.24, [0, 0, 0], m, 'x');
    rod(hip, `bulwark_femur_${id}`, [0, -0.03, 0], [0, -0.32, 0.01], 0.105, m.dark);
    panel(hip, `bulwark_thigh_armor_${id}`, mirrored([
      [-0.14, -0.27], [0.13, -0.3], [0.18, 0.02], [0.09, 0.14], [-0.11, 0.1],
    ], side), 0.16, [side * 0.07, -0.11, -0.02], m.armor, [0, 0, 0], 0.035);
    rod(hip, `bulwark_thigh_ram_${id}`, [side * 0.13, -0.02, 0.02], [side * 0.13, -0.29, -0.02], 0.032, m.edge);
    const knee = group(hip, `bulwark_knee_${id}`, [0, -0.34, 0]);
    bearing(knee, `bulwark_knee_bearing_${id}`, 0.145, 0.25, [0, 0, 0], m, 'x');
    rod(knee, `bulwark_tibia_${id}`, [0, -0.02, 0], [0, -0.3, -0.02], 0.085, m.hull);
    box(knee, `bulwark_shin_guard_${id}`, [0.25, 0.28, 0.15], [0, -0.17, -0.09], m.armor, [-0.12, 0, 0], 0.045);
    rod(knee, `bulwark_ankle_piston_${id}`, [side * 0.1, -0.04, 0.06], [side * 0.1, -0.29, 0.03], 0.026, m.edge);
    const foot = group(knee, `bulwark_foot_${id}`, [0, -0.32, 0]);
    hull(foot, `bulwark_foot_shell_${id}`, [
      { z: -0.5, w: 0.28, h: 0.08, y: -0.03, chamfer: 0.025 },
      { z: -0.36, w: 0.48, h: 0.14, y: -0.07, chamfer: 0.04 },
      { z: 0.12, w: 0.44, h: 0.14, y: -0.07, chamfer: 0.04 },
      { z: 0.25, w: 0.3, h: 0.1, y: -0.05, chamfer: 0.03 },
    ], m.dark);
    box(foot, `bulwark_toe_cap_${id}`, [0.36, 0.08, 0.22], [0, -0.015, -0.34], m.armor, [0.04, 0, 0], 0.025);
    joints[`hip${id}`] = hip;
    joints[`knee${id}`] = knee;
    joints[`foot${id}`] = foot;

    const vent = group(body, `bulwark_vent_${id}`, [side * 0.38, 0.39, 0.43]);
    cylinder(vent, `bulwark_vent_stack_${id}`, 0.085, 0.11, 0.28, [0, 0.06, 0], m.dark, [0, 0, 0], 24);
    const flap = group(vent, `bulwark_vent_flap_${id}`, [0, 0.21, 0]);
    box(flap, `bulwark_vent_lid_${id}`, [0.19, 0.055, 0.22], [0, 0, 0], m.accent, [0, 0, 0], 0.018);
    joints[`vent${id}`] = flap;
  }
  root.updateMatrixWorld(true);
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    body.attach(joints[`hip${id}`]);
    body.attach(joints[`arm${id}`]);
    addMechanicalLink(root, joints, `bulwarkShield${id}`, { from: { node: joints[`arm${id}`], point: [0, 0, -0.02] }, to: { node: shield, point: [side * 0.64, 0.02, 0.07] }, radius: 0.045, sleeveRadius: 0.075, sleeveLength: 0.08, overlap: 0.07, materials: m });
    sphere(shield, `bulwark_cowl_socket_${id}`, 0.072, [side * 0.69, 0.03, -0.04], m.edge);
  }
  return { root, joints };
}

function scrapBulwarkClips(root, j) {
  return [
    createRigClip(root, j, 'idle', 3.2, (t, time, { set }) => {
      const breath = wave(t);
      set('body', { p: [0, 0.018 * breath, 0], r: [0.008 * breath, 0, 0.008 * wave(t, 0.25)] });
      set('shield', { p: [0, -0.012 * breath, 0.012 * breath], r: [0.018 * breath, 0, 0] });
      set('armL', { r: [0.025 * breath, 0, 0] });
      set('armR', { r: [0.025 * breath, 0, 0] });
      set('hipL', { r: [0.015 * breath, 0, 0] });
      set('hipR', { r: [-0.015 * breath, 0, 0] });
      set('ventL', { r: [0.12 + 0.08 * breath, 0, 0] });
      set('ventR', { r: [0.12 + 0.08 * breath, 0, 0] });
    }),
    createRigClip(root, j, 'move', 1.8, (t, time, { set }) => {
      const stride = wave(t);
      const heave = Math.abs(wave(t));
      set('body', { p: [0, 0.035 * heave, -0.025 * heave], r: [-0.055, 0.015 * stride, 0.025 * stride] });
      set('shield', { p: [0, -0.025 * heave, -0.09 - 0.035 * heave], r: [-0.04 - 0.025 * heave, 0, -0.018 * stride] });
      set('ram', { p: [0, 0, -0.04 * heave] });
      for (const [id, side] of [['L', -1], ['R', 1]]) {
        const step = wave(t, id === 'L' ? 0 : 0.5);
        const lift = Math.max(0, step);
        set(`hip${id}`, { r: [0.29 * step, 0, side * 0.025] });
        set(`knee${id}`, { r: [-0.12 - 0.31 * lift, 0, 0] });
        set(`foot${id}`, { p: [0, 0.07 * lift, 0], r: [0.16 * lift - 0.1 * step, 0, 0] });
        set(`arm${id}`, { p: [0, 0, -0.06 * heave], r: [-0.06 - 0.035 * heave, 0, side * 0.025] });
        set(`vent${id}`, { r: [0.18 + 0.12 * heave, 0, 0] });
      }
    }),
    createRigClip(root, j, 'attack', 1.35, (t, time, { set }) => {
      const bash = pulse(t, 0.12, 0.46, 0.82);
      const load = ease(t, 0, 0.25) * (1 - ease(t, 0.25, 0.42));
      set('body', { p: [0, -0.07 * bash, -0.19 * bash + 0.07 * load], r: [-0.16 * bash + 0.08 * load, 0, 0] });
      set('shield', { p: [0, -0.05 * bash, -0.48 * bash + 0.15 * load], r: [-0.11 * bash + 0.09 * load, 0, 0] });
      set('ram', { p: [0, 0, -0.18 * bash] });
      set('armL', { p: [0, 0, -0.24 * bash + 0.07 * load], r: [-0.16 * bash, 0, -0.04 * bash] });
      set('armR', { p: [0, 0, -0.24 * bash + 0.07 * load], r: [-0.16 * bash, 0, 0.04 * bash] });
      set('hipL', { r: [0.24 * bash, 0, 0] });
      set('hipR', { r: [-0.2 * bash, 0, 0] });
      set('kneeL', { r: [-0.28 * bash, 0, 0] });
      set('kneeR', { r: [-0.22 * bash, 0, 0] });
    }),
    createRigClip(root, j, 'windup', 1.5, (t, time, { set }) => {
      const charge = hold(t, 0.02, 0.68, 0.88);
      set('body', { p: [0, -0.09 * charge, 0.1 * charge], r: [0.11 * charge, 0, 0] });
      set('shield', { p: [0, 0.05 * charge, 0.22 * charge], r: [0.16 * charge, 0, 0] });
      set('ram', { p: [0, 0.04 * charge, 0.09 * charge] });
      set('armL', { r: [0.3 * charge, 0, -0.1 * charge] });
      set('armR', { r: [0.3 * charge, 0, 0.1 * charge] });
      set('hipL', { r: [-0.17 * charge, 0, 0] });
      set('hipR', { r: [-0.17 * charge, 0, 0] });
      set('kneeL', { r: [-0.3 * charge, 0, 0] });
      set('kneeR', { r: [-0.3 * charge, 0, 0] });
      set('ventL', { r: [0.85 * charge, 0, -0.18 * charge] });
      set('ventR', { r: [0.85 * charge, 0, 0.18 * charge] });
    }),
    createRigClip(root, j, 'release', 1.05, (t, time, { set }) => {
      const hit = pulse(t, 0.04, 0.28, 0.76);
      set('body', { p: [0, -0.1 * hit, -0.25 * hit], r: [-0.2 * hit, 0, 0] });
      set('shield', { p: [0, -0.08 * hit, -0.58 * hit], r: [-0.16 * hit, 0, 0] });
      set('ram', { p: [0, 0, -0.26 * hit] });
      set('armL', { p: [0, 0, -0.27 * hit], r: [-0.22 * hit, 0, 0] });
      set('armR', { p: [0, 0, -0.27 * hit], r: [-0.22 * hit, 0, 0] });
      set('cowlL', { r: [0, -0.24 * hit, -0.08 * hit] });
      set('cowlR', { r: [0, 0.24 * hit, 0.08 * hit] });
      set('footL', { r: [0.15 * hit, 0, 0] });
      set('footR', { r: [0.15 * hit, 0, 0] });
      set('ventL', { r: [1.05 * hit, 0, 0] });
      set('ventR', { r: [1.05 * hit, 0, 0] });
    }),
    createRigClip(root, j, 'ability', 1.9, (t, time, { set }) => {
      const brace = hold(t, 0.04, 0.32, 0.8);
      set('body', { p: [0, -0.12 * brace, 0.06 * brace], r: [0.06 * brace, 0, 0] });
      set('shield', { p: [0, -0.09 * brace, -0.13 * brace], s: [1 + 0.08 * brace, 1 + 0.04 * brace, 1] });
      set('cowlL', { r: [0, -0.72 * brace, -0.12 * brace] });
      set('cowlR', { r: [0, 0.72 * brace, 0.12 * brace] });
      set('armL', { r: [-0.22 * brace, 0, -0.18 * brace] });
      set('armR', { r: [-0.22 * brace, 0, 0.18 * brace] });
      set('hipL', { r: [-0.18 * brace, 0, -0.14 * brace] });
      set('hipR', { r: [-0.18 * brace, 0, 0.14 * brace] });
      set('kneeL', { r: [-0.36 * brace, 0, 0] });
      set('kneeR', { r: [-0.36 * brace, 0, 0] });
      set('footL', { r: [0.12 * brace, 0, -0.1 * brace] });
      set('footR', { r: [0.12 * brace, 0, 0.1 * brace] });
    }),
    createRigClip(root, j, 'shutdown', 2.7, (t, time, { set }) => {
      const fail = ease(t, 0.04, 0.7);
      const twitch = Math.sin(Math.min(1, t * 2.4) * Math.PI * 5) * (1 - fail);
      set('body', { p: [0, -0.34 * fail, 0.18 * fail], r: [0.3 * fail, 0.08 * fail, -0.12 * fail] });
      set('shield', { p: [0.08 * fail, -0.54 * fail, 0.2 * fail], r: [-0.62 * fail, 0.14 * fail, 0.16 * fail] });
      set('ram', { p: [0, 0, 0.16 * fail] });
      set('cowlL', { r: [0.3 * fail, -0.5 * fail, 0.2 * fail] });
      set('cowlR', { r: [-0.18 * fail, 0.24 * fail, -0.35 * fail] });
      set('armL', { p: [0, -0.16 * fail, 0.12 * fail], r: [0.58 * fail, 0, -0.25 * fail] });
      set('armR', { p: [0, -0.2 * fail, 0.16 * fail], r: [0.68 * fail, 0, 0.18 * fail] });
      set('hipL', { r: [-0.46 * fail, 0, -0.2 * fail] });
      set('hipR', { r: [0.34 * fail, 0, 0.24 * fail] });
      set('kneeL', { r: [-0.82 * fail, 0, 0] });
      set('kneeR', { r: [-0.58 * fail, 0, 0] });
      set('footL', { r: [0.45 * fail, 0.18 * fail, 0] });
      set('footR', { r: [0.2 * fail, -0.24 * fail, 0] });
      set('ventL', { r: [1.35 * fail + 0.2 * twitch, 0, -0.4 * fail] });
      set('ventR', { r: [1.05 * fail - 0.16 * twitch, 0, 0.5 * fail] });
    }),
  ];
}

function buildEchoGlider(variant = 'base') {
  const root = createRoot(`echo_glider_${variant}`);
  const m = signalMaterials();
  const body = group(root, 'glider_body', [0, 1.3, 0]);
  hull(body, 'glider_continuous_fuselage', [
    { z: -1.08, w: 0.06, h: 0.08, y: -0.03, chamfer: 0.018 },
    { z: -0.88, w: 0.3, h: 0.25, y: -0.02, chamfer: 0.07 },
    { z: -0.48, w: 0.53, h: 0.43, y: 0.01, chamfer: 0.11 },
    { z: 0.02, w: 0.58, h: 0.47, y: 0.02, chamfer: 0.12 },
    { z: 0.46, w: 0.4, h: 0.36, y: 0.01, chamfer: 0.09 },
    { z: 0.82, w: 0.22, h: 0.25, y: -0.02, chamfer: 0.06 },
    { z: 0.98, w: 0.1, h: 0.14, y: -0.03, chamfer: 0.035 },
  ], m.hull);
  hull(body, 'glider_canopy_shell', [
    { z: -0.63, w: 0.18, h: 0.08, y: 0.23, chamfer: 0.025 },
    { z: -0.38, w: 0.34, h: 0.22, y: 0.28, chamfer: 0.055 },
    { z: 0.08, w: 0.3, h: 0.24, y: 0.29, chamfer: 0.06 },
    { z: 0.33, w: 0.14, h: 0.11, y: 0.23, chamfer: 0.035 },
  ], m.glass);
  cable(body, 'glider_dorsal_conduit', [[0, 0.27, -0.65], [0, 0.43, -0.28], [0, 0.4, 0.22], [0, 0.18, 0.72]], 0.022, m.accent);
  box(body, 'glider_ventral_keel', [0.16, 0.22, 0.9], [0, -0.26, 0.05], m.dark, [0.03, 0, 0], 0.045);

  const joints = { body };
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    const wing = group(body, `glider_wing_${id}`, [side * 0.24, 0.015, -0.08]);
    const wingPoints = [
      [0, -0.3], [0.4, -0.4], [1.12, 0.06], [1.28, 0.38], [0.54, 0.32], [0, 0.17],
    ];
    panel(wing, `glider_wing_shell_${id}`, mirrored(wingPoints, side), 0.09, [0, 0, 0], m.armor, [Math.PI / 2, 0, 0], 0.026);
    panel(wing, `glider_wing_inset_${id}`, mirrored([
      [0.14, -0.19], [0.42, -0.25], [1.04, 0.11], [1.09, 0.26], [0.52, 0.2], [0.14, 0.09],
    ], side), 0.035, [0, 0.055, 0], m.hull, [Math.PI / 2, 0, 0], 0.012);
    cable(wing, `glider_leading_spar_${id}`, [[0, 0.025, -0.28], [side * 0.4, 0.035, -0.37], [side * 1.1, 0.015, 0.07]], 0.034, m.edge);
    rod(wing, `glider_load_spar_${id}`, [side * 0.06, -0.035, 0.05], [side * 1.08, -0.035, 0.29], 0.035, m.dark);
    cable(wing, `glider_wing_signal_${id}`, [[side * 0.3, 0.075, -0.12], [side * 0.65, 0.07, 0.02], [side * 1.05, 0.05, 0.22]], 0.018, m.accent);
    const flap = group(wing, `glider_flap_${id}`, [side * 0.53, -0.015, 0.25]);
    panel(flap, `glider_flap_shell_${id}`, mirrored([
      [0, 0], [0.52, 0], [0.45, 0.2], [0.03, 0.13],
    ], side), 0.065, [0, 0, 0], m.hull, [Math.PI / 2, 0, 0], 0.018);
    rod(flap, `glider_flap_hinge_${id}`, [0, 0, 0], [side * 0.47, 0, 0], 0.025, m.edge);
    const tip = group(wing, `glider_wingtip_${id}`, [side * 1.14, 0.01, 0.24]);
    panel(tip, `glider_wingtip_fin_${id}`, [[-0.16, 0], [0.15, 0.02], [0.06, 0.34], [-0.09, 0.26]], 0.055,
      [0, 0, 0], m.accent, [0, Math.PI / 2, 0], 0.016);
    joints[`wing${id}`] = wing;
    joints[`flap${id}`] = flap;
    joints[`tip${id}`] = tip;

    const rudder = group(body, `glider_rudder_${id}`, [side * 0.17, 0.18, 0.66]);
    panel(rudder, `glider_rudder_shell_${id}`, [[-0.2, -0.02], [0.18, 0], [0.11, 0.43], [-0.08, 0.51]], 0.07,
      [0, 0, 0], m.armor, [0, Math.PI / 2, 0], 0.022);
    rod(rudder, `glider_rudder_actuator_${id}`, [0, 0.02, 0], [0, 0.34, 0.02], 0.022, m.accent);
    cylinder(rudder, `glider_rudder_root_${id}`, 0.038, 0.052, 0.19, [0, -0.035, 0], m.dark, [0, 0, 0], 20);
    joints[`rudder${id}`] = rudder;

    const engine = group(body, `glider_engine_${id}`, [side * 0.29, -0.09, 0.54]);
    hull(engine, `glider_nacelle_${id}`, [
      { z: -0.36, w: 0.18, h: 0.18, chamfer: 0.05 },
      { z: -0.2, w: 0.31, h: 0.3, chamfer: 0.075 },
      { z: 0.18, w: 0.3, h: 0.29, chamfer: 0.07 },
      { z: 0.36, w: 0.22, h: 0.22, chamfer: 0.055 },
    ], m.dark);
    torus(engine, `glider_nozzle_ring_${id}`, 0.13, 0.027, [0, 0, 0.36], m.edge);
    cylinder(engine, `glider_turbine_hub_${id}`, 0.07, 0.07, 0.1, [0, 0, 0.35], m.accent, [Math.PI / 2, 0, 0], 24);
    for (let blade = 0; blade < 5; blade++) {
      const angle = blade * TAU / 5;
      box(engine, `glider_turbine_vane_${id}_${blade}`, [0.025, 0.1, 0.025],
        [Math.sin(angle) * 0.075, Math.cos(angle) * 0.075, 0.415], m.armor, [0, 0, -angle], 0.006);
    }
    const exhaust = group(engine, `glider_exhaust_${id}`, [0, 0, 0.43]);
    hull(exhaust, `glider_exhaust_plume_${id}`, [
      { z: 0, w: 0.17, h: 0.17, chamfer: 0.04 },
      { z: 0.18, w: 0.13, h: 0.13, chamfer: 0.035 },
      { z: 0.46, w: 0.025, h: 0.025, chamfer: 0.006 },
    ], m.energy);
    joints[`engine${id}`] = engine;
    joints[`exhaust${id}`] = exhaust;
  }

  const emitter = group(body, 'glider_emitter', [0, -0.015, -0.94]);
  torus(emitter, 'glider_emitter_rim', 0.18, 0.035, [0, 0, 0], m.edge);
  torus(emitter, 'glider_emitter_coral', 0.12, 0.018, [0, 0, -0.035], m.accent);
  sphere(emitter, 'glider_emitter_core', 0.09, [0, 0, -0.02], m.core, [1, 1, 0.55]);
  const pulseRing = group(body, 'glider_pulse_ring', [0, -0.015, -1.12]);
  torus(pulseRing, 'glider_pulse_outer', 0.34, 0.012, [0, 0, 0], m.field);
  torus(pulseRing, 'glider_pulse_inner', 0.23, 0.014, [0, 0, -0.035], m.accent);
  joints.emitter = emitter;
  joints.pulseRing = pulseRing;
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    addMechanicalLink(root, joints, `gliderWing${id}`, { from: { node: body, point: [side * 0.10, 0.015, -0.08] }, to: { node: joints[`wing${id}`], point: [side * 0.16, 0, 0] }, radius: 0.025, sleeveRadius: 0.055, sleeveLength: 0.10, materials: m });
  }
  addMechanicalLink(root, joints, 'gliderEmitter', { from: { node: body, point: [0, -0.015, -0.72] }, to: { node: emitter, point: [0, 0, 0.02] }, radius: 0.022, sleeveRadius: 0.045, sleeveLength: 0.07, materials: m });
  return { root, joints };
}

function echoGliderClips(root, j) {
  return [
    createRigClip(root, j, 'idle', 3.0, (t, time, { set }) => {
      const float = wave(t);
      set('body', { p: [0, 0.055 * float, 0.025 * wave(t, 0.25)], r: [0.018 * wave(t, 0.25), 0, 0.025 * float] });
      for (const [id, side] of [['L', -1], ['R', 1]]) {
        set(`wing${id}`, { r: [0.015 * float, 0, side * 0.045 * float] });
        set(`flap${id}`, { r: [0.06 + 0.055 * wave(t, side < 0 ? 0 : 0.25), 0, 0] });
        set(`rudder${id}`, { r: [0, side * 0.08 * wave(t, 0.25), 0] });
        set(`exhaust${id}`, { s: [1, 1, 0.8 + 0.18 * float] });
      }
      set('emitter', { r: [0, 0, 0.12 * float] });
      set('pulseRing', { s: [0.92 + 0.08 * float, 0.92 + 0.08 * float, 1] });
    }),
    createRigClip(root, j, 'move', 1.25, (t, time, { set }) => {
      const boost = 0.5 - 0.5 * Math.cos(TAU * t);
      const steer = wave(t);
      set('body', { p: [0, 0.035 * wave(t * 2), -0.2 * boost], r: [-0.09 * boost, 0.045 * steer, 0.09 * steer] });
      for (const [id, side] of [['L', -1], ['R', 1]]) {
        set(`wing${id}`, { r: [-0.04 * boost, side * 0.035 * steer, side * (0.08 * boost + 0.06 * steer)] });
        set(`flap${id}`, { r: [0.32 * boost - side * 0.13 * steer, 0, 0] });
        set(`rudder${id}`, { r: [0, side * 0.2 * steer, side * 0.08 * boost] });
        set(`engine${id}`, { r: [-0.13 * boost, side * 0.05 * steer, 0] });
        set(`exhaust${id}`, { s: [1 + 0.16 * boost, 1 + 0.16 * boost, 0.85 + 1.35 * boost] });
        set(`tip${id}`, { r: [0, 0, side * 0.12 * steer] });
      }
      set('pulseRing', { p: [0, 0, 0.08 * boost], s: [1 - 0.18 * boost, 1 - 0.18 * boost, 1] });
    }),
    createRigClip(root, j, 'attack', 1.15, (t, time, { set }) => {
      const shot = pulse(t, 0.12, 0.45, 0.82);
      set('body', { p: [0, -0.08 * shot, -0.32 * shot], r: [-0.18 * shot, 0, 0] });
      set('wingL', { r: [0.12 * shot, -0.12 * shot, -0.16 * shot] });
      set('wingR', { r: [0.12 * shot, 0.12 * shot, 0.16 * shot] });
      set('flapL', { r: [-0.35 * shot, 0, 0] });
      set('flapR', { r: [-0.35 * shot, 0, 0] });
      set('rudderL', { r: [0, -0.3 * shot, 0] });
      set('rudderR', { r: [0, 0.3 * shot, 0] });
      set('emitter', { p: [0, 0, -0.12 * shot], r: [0, 0, 1.2 * shot] });
      set('pulseRing', { p: [0, 0, -0.5 * shot], s: [1 + 2.2 * shot, 1 + 2.2 * shot, 1] });
      set('exhaustL', { s: [1, 1, 1 + 1.1 * shot] });
      set('exhaustR', { s: [1, 1, 1 + 1.1 * shot] });
    }),
    createRigClip(root, j, 'windup', 1.55, (t, time, { set }) => {
      const charge = hold(t, 0.02, 0.7, 0.9);
      set('body', { p: [0, 0.12 * charge, 0.18 * charge], r: [0.16 * charge, 0, 0] });
      set('wingL', { r: [-0.18 * charge, 0.22 * charge, -0.22 * charge] });
      set('wingR', { r: [-0.18 * charge, -0.22 * charge, 0.22 * charge] });
      set('flapL', { r: [0.75 * charge, 0, -0.12 * charge] });
      set('flapR', { r: [0.75 * charge, 0, 0.12 * charge] });
      set('rudderL', { r: [0, -0.5 * charge, 0] });
      set('rudderR', { r: [0, 0.5 * charge, 0] });
      set('emitter', { p: [0, 0, 0.1 * charge], s: [1 - 0.25 * charge, 1 - 0.25 * charge, 1 + 0.35 * charge] });
      set('pulseRing', { p: [0, 0, 0.18 * charge], s: [1 - 0.65 * charge, 1 - 0.65 * charge, 1] });
      set('exhaustL', { s: [1 + 0.2 * charge, 1 + 0.2 * charge, 1 + 1.4 * charge] });
      set('exhaustR', { s: [1 + 0.2 * charge, 1 + 0.2 * charge, 1 + 1.4 * charge] });
    }),
    createRigClip(root, j, 'release', 1.0, (t, time, { set }) => {
      const release = pulse(t, 0.02, 0.25, 0.8);
      const ring = ease(t, 0.12, 0.65) * (1 - ease(t, 0.78, 1));
      set('body', { p: [0, -0.1 * release, -0.42 * release], r: [-0.22 * release, 0, 0] });
      set('wingL', { r: [0.16 * release, -0.2 * release, 0.15 * release] });
      set('wingR', { r: [0.16 * release, 0.2 * release, -0.15 * release] });
      set('flapL', { r: [-0.55 * release, 0, 0] });
      set('flapR', { r: [-0.55 * release, 0, 0] });
      set('rudderL', { r: [0, 0.35 * release, 0] });
      set('rudderR', { r: [0, -0.35 * release, 0] });
      set('emitter', { p: [0, 0, -0.18 * release], s: [1 + 0.4 * release, 1 + 0.4 * release, 1] });
      set('pulseRing', { p: [0, 0, -0.85 * ring], s: [0.45 + 3.4 * ring, 0.45 + 3.4 * ring, 1] });
      set('exhaustL', { s: [1, 1, 1 + 1.8 * release] });
      set('exhaustR', { s: [1, 1, 1 + 1.8 * release] });
    }),
    createRigClip(root, j, 'ability', 2.2, (t, time, { set }) => {
      const haste = hold(t, 0.03, 0.25, 0.82);
      const resonance = wave(t * 3);
      set('body', { p: [0, 0.06 * resonance * haste, -0.18 * haste], r: [-0.08 * haste, 0, 0.035 * resonance * haste] });
      for (const [id, side] of [['L', -1], ['R', 1]]) {
        set(`wing${id}`, { p: [side * 0.12 * haste, 0, 0], r: [0, side * -0.18 * haste, side * 0.15 * haste] });
        set(`flap${id}`, { r: [(0.35 + 0.2 * resonance) * haste, 0, side * 0.16 * haste] });
        set(`rudder${id}`, { r: [0, side * 0.58 * haste, side * 0.2 * haste] });
        set(`tip${id}`, { r: [0, side * 0.35 * haste, side * 0.24 * haste] });
        set(`engine${id}`, { r: [-0.16 * haste, 0, 0] });
        set(`exhaust${id}`, { s: [1 + 0.25 * haste, 1 + 0.25 * haste, 1 + (1.4 + 0.35 * resonance) * haste] });
      }
      set('emitter', { r: [0, 0, 2.4 * haste] });
      set('pulseRing', { p: [0, 0, -0.3 * haste], s: [1 + (0.8 + 0.2 * resonance) * haste, 1 + (0.8 + 0.2 * resonance) * haste, 1] });
    }),
    createRigClip(root, j, 'shutdown', 2.6, (t, time, { set }) => {
      const fail = ease(t, 0.03, 0.76);
      const sputter = Math.sin(Math.min(1, t * 2) * Math.PI * 7) * (1 - fail);
      set('body', { p: [0.12 * fail, -0.74 * fail, 0.28 * fail], r: [0.38 * fail, -0.16 * fail, -0.34 * fail] });
      set('wingL', { r: [0.4 * fail, 0.32 * fail, -0.72 * fail] });
      set('wingR', { r: [-0.18 * fail, -0.12 * fail, 0.3 * fail] });
      set('flapL', { r: [1.0 * fail, 0.2 * fail, -0.18 * fail] });
      set('flapR', { r: [0.65 * fail, -0.12 * fail, 0.1 * fail] });
      set('rudderL', { r: [0.3 * fail, -0.72 * fail, 0.2 * fail] });
      set('rudderR', { r: [-0.22 * fail, 0.4 * fail, -0.25 * fail] });
      set('tipL', { r: [0, 0, -0.6 * fail] });
      set('tipR', { r: [0, 0, 0.28 * fail] });
      set('engineL', { p: [0, -0.09 * fail, 0], r: [0.52 * fail, -0.18 * fail, 0] });
      set('engineR', { p: [0, -0.05 * fail, 0], r: [0.3 * fail, 0.24 * fail, 0] });
      set('exhaustL', { s: [1 - 0.75 * fail, 1 - 0.75 * fail, Math.max(0.04, 1 - fail + 0.35 * sputter)] });
      set('exhaustR', { s: [1 - 0.82 * fail, 1 - 0.82 * fail, Math.max(0.04, 0.9 - fail - 0.25 * sputter)] });
      set('emitter', { p: [0, -0.08 * fail, 0.08 * fail], r: [0.45 * fail, 0, 0.3 * fail] });
      set('pulseRing', { s: [Math.max(0.03, 1 - 1.1 * fail), Math.max(0.03, 1 - 1.1 * fail), 1] });
    }),
  ];
}

function buildNoiseBell(variant = 'base') {
  const root = createRoot(`noise_bell_${variant}`);
  const m = signalMaterials();
  const body = group(root, 'bell_body', [0, 0.64, 0.1]);
  hull(body, 'bell_continuous_chassis', [
    { z: -0.62, w: 0.64, h: 0.3, y: -0.03, chamfer: 0.08 },
    { z: -0.45, w: 1.08, h: 0.48, y: 0, chamfer: 0.12 },
    { z: -0.05, w: 1.3, h: 0.56, y: 0.02, chamfer: 0.14 },
    { z: 0.38, w: 1.16, h: 0.5, y: 0, chamfer: 0.12 },
    { z: 0.65, w: 0.72, h: 0.32, y: -0.04, chamfer: 0.085 },
  ], m.hull);
  hull(body, 'bell_underframe', [
    { z: -0.48, w: 0.54, h: 0.18, y: -0.28 },
    { z: -0.1, w: 0.82, h: 0.24, y: -0.31 },
    { z: 0.46, w: 0.62, h: 0.2, y: -0.28 },
  ], m.dark);
  panel(body, 'bell_front_coral_grille', [[-0.37, -0.12], [0.37, -0.12], [0.29, 0.15], [-0.29, 0.15]], 0.045,
    [0, 0.02, -0.54], m.accent, [0, 0, 0], 0.015);
  for (let slit = -2; slit <= 2; slit++) {
    box(body, `bell_grille_rib_${slit + 2}`, [0.045, 0.29, 0.065], [slit * 0.13, 0.02, -0.585], m.edge, [0, 0, 0], 0.012);
  }

  const joints = { body };
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    const hip = group(root, `bell_hip_${id}`, [side * 0.47, 0.69, 0.2]);
    bearing(hip, `bell_hip_bearing_${id}`, 0.16, 0.22, [0, 0, 0], m, 'x');
    rod(hip, `bell_upper_strut_${id}`, [0, 0, 0], [side * 0.05, -0.27, 0], 0.085, m.dark);
    rod(hip, `bell_upper_ram_${id}`, [-side * 0.1, -0.02, 0.04], [side * 0.1, -0.27, -0.03], 0.03, m.edge);
    const knee = group(hip, `bell_knee_${id}`, [side * 0.05, -0.28, 0]);
    bearing(knee, `bell_knee_bearing_${id}`, 0.125, 0.24, [0, 0, 0], m, 'x');
    panel(knee, `bell_shin_shell_${id}`, mirrored([
      [-0.13, -0.25], [0.13, -0.25], [0.17, 0.06], [0.08, 0.14], [-0.1, 0.1],
    ], side), 0.18, [0, -0.08, -0.015], m.armor, [0, 0, 0], 0.035);
    rod(knee, `bell_lower_piston_${id}`, [side * 0.12, -0.02, 0.05], [side * 0.12, -0.28, 0.02], 0.025, m.edge);
    const foot = group(knee, `bell_foot_${id}`, [0, -0.34, -0.02]);
    hull(foot, `bell_foot_shell_${id}`, [
      { z: -0.4, w: 0.34, h: 0.09, y: -0.025, chamfer: 0.025 },
      { z: -0.28, w: 0.5, h: 0.14, y: -0.07, chamfer: 0.04 },
      { z: 0.2, w: 0.46, h: 0.14, y: -0.07, chamfer: 0.04 },
      { z: 0.3, w: 0.3, h: 0.1, y: -0.05, chamfer: 0.03 },
    ], m.dark);
    box(foot, `bell_toe_${id}`, [0.38, 0.08, 0.2], [0, -0.02, -0.29], m.armor, [0, 0, 0], 0.025);
    joints[`hip${id}`] = hip;
    joints[`knee${id}`] = knee;
    joints[`foot${id}`] = foot;

    const pylon = group(body, `bell_pylon_${id}`, [side * 0.46, 0.23, 0.12]);
    rod(pylon, `bell_pylon_spine_${id}`, [0, 0, 0], [side * 0.05, 0.72, 0.02], 0.065, m.edge);
    box(pylon, `bell_pylon_socket_${id}`, [0.22, 0.25, 0.26], [0, 0.08, 0], m.armor, [0, 0, 0], 0.055);
    cable(pylon, `bell_pylon_line_${id}`, [[0, 0.08, -0.1], [side * 0.12, 0.38, -0.09], [side * 0.05, 0.69, -0.04]], 0.025, m.accent);
    joints[`pylon${id}`] = pylon;

    const anchor = group(root, `bell_anchor_${id}`, [side * 0.63, 0.5, -0.34]);
    bearing(anchor, `bell_anchor_hinge_${id}`, 0.11, 0.16, [0, 0, 0], m, 'x');
    rod(anchor, `bell_anchor_strut_${id}`, [0, 0, 0], [side * 0.16, -0.36, -0.12], 0.05, m.hull);
    panel(anchor, `bell_anchor_shoe_${id}`, mirrored([
      [-0.14, -0.12], [0.18, -0.12], [0.24, 0.08], [0, 0.16], [-0.18, 0.06],
    ], side), 0.24, [side * 0.16, -0.37, -0.12], m.dark, [Math.PI / 2, 0, 0], 0.03);
    joints[`anchor${id}`] = anchor;

    const valve = group(body, `bell_valve_${id}`, [side * 0.58, 0.13, 0.3]);
    cylinder(valve, `bell_valve_seat_${id}`, 0.1, 0.12, 0.19, [0, 0, 0], m.dark, [0, 0, Math.PI / 2], 24);
    torus(valve, `bell_valve_rim_${id}`, 0.1, 0.022, [side * 0.11, 0, 0], m.accent, [0, Math.PI / 2, 0]);
    const flap = group(valve, `bell_valve_flap_${id}`, [side * 0.12, 0, 0]);
    box(flap, `bell_valve_lid_${id}`, [0.045, 0.17, 0.17], [0, 0, 0], m.armor, [0, 0, 0], 0.018);
    joints[`valve${id}`] = flap;
  }

  arc(root, 'bell_load_arch', 0.57, 0.055, 0, Math.PI, [0, 1.28, 0.22], m.edge);
  cable(root, 'bell_arch_coral_conduit', [[-0.52, 1.3, 0.16], [-0.4, 1.68, 0.16], [0, 1.86, 0.16], [0.4, 1.68, 0.16], [0.52, 1.3, 0.16]], 0.022, m.accent);
  const yoke = group(root, 'bell_yoke', [0, 1.75, 0.12]);
  box(yoke, 'bell_yoke_crossbeam', [0.48, 0.13, 0.22], [0, 0, 0], m.armor, [0, 0, 0], 0.04);
  bearing(yoke, 'bell_yoke_bearing', 0.12, 0.28, [0, -0.07, 0], m, 'z');

  const bell = group(root, 'bell_resonator', [0, 1.28, 0.1]);
  lathe(bell, 'bell_continuous_thick_shell', [
    [0.59, -0.4], [0.64, -0.36], [0.65, -0.3], [0.6, -0.25],
    [0.51, -0.02], [0.4, 0.25], [0.27, 0.44], [0.17, 0.5],
    [0.11, 0.46], [0.15, 0.39], [0.24, 0.35], [0.34, 0.16],
    [0.43, -0.08], [0.5, -0.29], [0.54, -0.34], [0.59, -0.4],
  ], [0, 0, 0], m.armor, [0, 0, 0], 64);
  torus(bell, 'bell_machined_lip', 0.615, 0.035, [0, -0.345, 0], m.edge, [Math.PI / 2, 0, 0]);
  torus(bell, 'bell_coral_lip', 0.565, 0.018, [0, -0.37, 0], m.accent, [Math.PI / 2, 0, 0]);
  torus(bell, 'bell_crown_band', 0.25, 0.025, [0, 0.42, 0], m.gold, [Math.PI / 2, 0, 0]);
  for (let rib = 0; rib < 8; rib++) {
    const angle = rib * TAU / 8;
    const point = (radius, y) => [Math.sin(angle) * radius, y, Math.cos(angle) * radius];
    cable(bell, `bell_shell_rib_${rib}`, [point(0.18, 0.48), point(0.3, 0.35), point(0.43, 0.1), point(0.56, -0.28)], 0.016, m.gold);
  }
  const clapper = group(root, 'bell_clapper', [0, 1.70, 0.1]);
  rod(clapper, 'bell_clapper_stem', [0, 0, 0], [0, -0.68, 0], 0.035, m.edge);
  sphere(clapper, 'bell_clapper_weight', 0.145, [0, -0.71, 0], m.accent, [1, 1.15, 1]);
  torus(clapper, 'bell_clapper_collar', 0.09, 0.02, [0, -0.56, 0], m.gold, [Math.PI / 2, 0, 0]);
  joints.yoke = yoke;
  joints.bell = bell;
  joints.clapper = clapper;

  for (let petal = 0; petal < 4; petal++) {
    const angle = petal * TAU / 4;
    const iris = group(root, `bell_iris_${petal}`, [-Math.sin(angle) * 0.22, 0.91, 0.1 - Math.cos(angle) * 0.22], [0, angle, 0]);
    panel(iris, `bell_iris_plate_${petal}`, [[-0.15, -0.2], [0.15, -0.2], [0.25, 0.17], [-0.25, 0.17]], 0.065,
      [0, 0, -0.21], m.hull, [Math.PI / 2, 0, 0], 0.02);
    rod(iris, `bell_iris_hinge_${petal}`, [-0.18, 0, 0], [0.18, 0, 0], 0.025, m.accent);
    joints[`iris${petal}`] = iris;
  }

  const field = group(root, 'bell_pressure_field', [0, 0.065, 0]);
  const waves = [];
  [0.58, 0.92, 1.28].forEach((radius, index) => {
    const ring = group(field, `bell_wave_${index}`, [0, index * 0.012, 0]);
    torus(ring, `bell_wave_ring_${index}`, radius, 0.014 - index * 0.002, [0, 0, 0], m.field, [Math.PI / 2, 0, 0]);
    for (let tick = 0; tick < 8; tick++) {
      const angle = tick * TAU / 8;
      box(ring, `bell_wave_tick_${index}_${tick}`, [0.035, 0.018, 0.12],
        [Math.sin(angle) * radius, 0, Math.cos(angle) * radius], m.accent, [0, angle, 0], 0.005);
    }
    waves.push(ring);
    joints[`wave${index}`] = ring;
  });
  joints.field = field;
  // Move the bell's origin to its crown without altering its rest silhouette.
  const crownOffset = new THREE.Vector3(0, 0.47, 0.02);
  bell.position.add(crownOffset);
  for (const child of bell.children) child.position.sub(crownOffset);
  root.updateMatrixWorld(true);
  for (const name of ['hipL', 'hipR', 'anchorL', 'anchorR', 'yoke']) body.attach(joints[name]);
  body.attach(root.getObjectByName('bell_load_arch'));
  body.attach(root.getObjectByName('bell_arch_coral_conduit'));
  yoke.attach(bell);
  bell.attach(clapper);
  sphere(bell, 'bell_clapper_socket', 0.07, clapper.position.toArray(), m.dark);
  for (let petal = 0; petal < 4; petal++) {
    bell.attach(joints[`iris${petal}`]);
    sphere(bell, `bell_iris_socket_${petal}`, 0.045, joints[`iris${petal}`].position.toArray(), m.edge);
  }
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    addMechanicalLink(root, joints, `bellAnchor${id}`, { from: { node: body, point: [side * 0.4, -0.03, -0.25] }, to: { node: joints[`anchor${id}`], point: [0, 0, 0] }, radius: 0.025, sleeveRadius: 0.05, sleeveLength: 0.09, materials: m });
    addMechanicalLink(root, joints, `bellYoke${id}`, { from: { node: body, point: [side * 0.4, 1.04, 0.12] }, to: { node: yoke, point: [side * 0.22, 0, 0.08] }, radius: 0.018, sleeveRadius: 0.035, sleeveLength: 0.07, overlap: 0.03, materials: m });
    addMechanicalLink(root, joints, `bellPylon${id}`, { from: { node: joints[`pylon${id}`], point: [side * 0.05, 0.72, 0.02] }, to: { node: body, point: [side * 0.44, 1.04, 0.12] }, radius: 0.008, sleeveRadius: 0.019, sleeveLength: 0.015, overlap: 0.01, materials: m });
  }
  return { root, joints };
}

function noiseBellClips(root, j) {
  return [
    createRigClip(root, j, 'idle', 3.6, (t, time, { set }) => {
      const sway = wave(t);
      set('body', { p: [0, 0.014 * sway, 0], r: [0, 0, 0.008 * sway] });
      set('bell', { r: [0.015 * wave(t, 0.25), 0, 0.035 * sway] });
      set('clapper', { r: [0.025 * wave(t, 0.3), 0, -0.09 * sway] });
      set('yoke', { r: [0, 0.012 * sway, 0] });
      set('pylonL', { r: [0, 0, -0.012 * sway] });
      set('pylonR', { r: [0, 0, 0.012 * sway] });
      set('iris0', { r: [0.04 * sway, 0, 0] });
      set('iris2', { r: [-0.04 * sway, 0, 0] });
      set('wave0', { s: [1 + 0.035 * sway, 1, 1 + 0.035 * sway] });
      set('wave1', { s: [1 - 0.025 * sway, 1, 1 - 0.025 * sway] });
    }),
    createRigClip(root, j, 'move', 2.0, (t, time, { set }) => {
      const stride = wave(t);
      set('body', { p: [0, 0.028 * Math.abs(stride), -0.025 * Math.abs(stride)], r: [-0.035, 0.018 * stride, 0.025 * stride] });
      set('bell', { p: [0, 0.02 * Math.abs(stride), 0], r: [0.04 * stride, 0, -0.065 * stride] });
      set('clapper', { r: [0.12 * stride, 0, 0.2 * stride] });
      set('yoke', { r: [0, 0.025 * stride, 0] });
      for (const [id, side] of [['L', -1], ['R', 1]]) {
        const step = wave(t, id === 'L' ? 0 : 0.5);
        const lift = Math.max(0, step);
        set(`hip${id}`, { r: [0.22 * step, 0, side * 0.025] });
        set(`knee${id}`, { r: [-0.1 - 0.28 * lift, 0, 0] });
        set(`foot${id}`, { p: [0, 0.065 * lift, 0], r: [0.14 * lift - 0.08 * step, 0, 0] });
        set(`anchor${id}`, { p: [0, 0.13 * Math.abs(step), 0.06 * Math.abs(step)], r: [side * 0.08 * step, 0, side * 0.18 * step] });
        set(`pylon${id}`, { r: [0, 0, side * 0.025 * stride] });
      }
      set('wave0', { s: [0.9, 1, 0.9] });
      set('wave1', { s: [0.82, 1, 0.82] });
    }),
    createRigClip(root, j, 'attack', 1.45, (t, time, { set }) => {
      const toll = pulse(t, 0.1, 0.44, 0.8);
      set('body', { p: [0, -0.06 * toll, -0.14 * toll], r: [-0.12 * toll, 0, 0] });
      set('bell', { p: [0, -0.1 * toll, -0.08 * toll], r: [-0.3 * toll, 0, 0.08 * toll] });
      set('clapper', { p: [0, -0.18 * toll, -0.08 * toll], r: [-0.65 * toll, 0, 0.4 * toll] });
      set('yoke', { r: [-0.12 * toll, 0, 0] });
      set('iris0', { r: [-0.55 * toll, 0, 0] });
      set('iris1', { r: [-0.55 * toll, 0, 0] });
      set('iris2', { r: [-0.55 * toll, 0, 0] });
      set('iris3', { r: [-0.55 * toll, 0, 0] });
      set('wave0', { p: [0, 0, -0.28 * toll], s: [1 + 0.65 * toll, 1, 1 + 0.65 * toll] });
      set('wave1', { p: [0, 0, -0.18 * toll], s: [1 + 0.35 * toll, 1, 1 + 0.35 * toll] });
      set('anchorL', { r: [0.18 * toll, 0, -0.12 * toll] });
      set('anchorR', { r: [0.18 * toll, 0, 0.12 * toll] });
    }),
    createRigClip(root, j, 'windup', 1.9, (t, time, { set }) => {
      const charge = hold(t, 0.02, 0.72, 0.92);
      set('body', { p: [0, -0.09 * charge, 0.05 * charge], r: [0.07 * charge, 0, 0] });
      set('bell', { p: [0, 0.3 * charge, 0], r: [0.08 * charge, 0, 0] });
      set('clapper', { p: [0, 0.2 * charge, 0], r: [0.15 * charge, 0, 0] });
      set('yoke', { p: [0, 0.12 * charge, 0], s: [1 + 0.06 * charge, 1, 1] });
      set('pylonL', { r: [0, 0, -0.12 * charge] });
      set('pylonR', { r: [0, 0, 0.12 * charge] });
      for (let petal = 0; petal < 4; petal++) set(`iris${petal}`, { p: [0, -0.08 * charge, 0], r: [-0.85 * charge, 0, 0] });
      set('anchorL', { p: [-0.12 * charge, -0.08 * charge, -0.08 * charge], r: [0.22 * charge, 0, -0.28 * charge] });
      set('anchorR', { p: [0.12 * charge, -0.08 * charge, -0.08 * charge], r: [0.22 * charge, 0, 0.28 * charge] });
      set('hipL', { r: [-0.14 * charge, 0, -0.1 * charge] });
      set('hipR', { r: [-0.14 * charge, 0, 0.1 * charge] });
      set('kneeL', { r: [-0.28 * charge, 0, 0] });
      set('kneeR', { r: [-0.28 * charge, 0, 0] });
      set('wave0', { s: [1 - 0.55 * charge, 1, 1 - 0.55 * charge] });
      set('wave1', { s: [1 - 0.65 * charge, 1, 1 - 0.65 * charge] });
      set('wave2', { s: [1 - 0.72 * charge, 1, 1 - 0.72 * charge] });
      set('valveL', { r: [0, 0, -0.8 * charge] });
      set('valveR', { r: [0, 0, 0.8 * charge] });
    }),
    createRigClip(root, j, 'release', 1.5, (t, time, { set }) => {
      const lift = 1 - ease(t, 0, 0.2);
      const strike = pulse(t, 0.12, 0.28, 0.68);
      const expand = ease(t, 0.18, 0.72) * (1 - ease(t, 0.82, 1));
      set('body', { p: [0, -0.1 * strike, -0.06 * strike], r: [-0.1 * strike, 0, 0] });
      set('bell', { p: [0, 0.28 * lift - 0.2 * strike, 0], r: [0.12 * strike, 0, 0] });
      set('clapper', { p: [0, 0.18 * lift - 0.34 * strike, 0], r: [0.9 * strike, 0, -0.28 * strike] });
      set('yoke', { p: [0, -0.08 * strike, 0], r: [0.06 * strike, 0, 0] });
      for (let petal = 0; petal < 4; petal++) set(`iris${petal}`, { p: [0, -0.1 * expand, 0], r: [-1.05 * expand, 0, 0] });
      set('anchorL', { p: [-0.15 * strike, -0.1 * strike, -0.1 * strike], r: [0.28 * strike, 0, -0.34 * strike] });
      set('anchorR', { p: [0.15 * strike, -0.1 * strike, -0.1 * strike], r: [0.28 * strike, 0, 0.34 * strike] });
      for (let index = 0; index < 3; index++) {
        const ring = ease(t, 0.18 + index * 0.07, 0.68 + index * 0.05) * (1 - ease(t, 0.84, 1));
        set(`wave${index}`, { p: [0, 0.05 * ring, 0], s: [0.35 + (1.25 + index * 0.18) * ring, 1, 0.35 + (1.25 + index * 0.18) * ring] });
      }
      set('valveL', { r: [0, 0, -1.1 * strike] });
      set('valveR', { r: [0, 0, 1.1 * strike] });
    }),
    createRigClip(root, j, 'ability', 3.4, (t, time, { set }) => {
      const aura = hold(t, 0.02, 0.18, 0.88);
      const toll = wave(t * 2);
      set('body', { p: [0, -0.075 * aura, 0], r: [0.025 * toll * aura, 0, 0] });
      set('bell', { p: [0, (0.16 + 0.035 * toll) * aura, 0], r: [0.06 * toll * aura, 0, 0] });
      set('clapper', { p: [0, -0.08 * aura, 0], r: [0.42 * toll * aura, 0, 0.28 * toll * aura] });
      set('yoke', { p: [0, 0.07 * aura, 0] });
      set('pylonL', { r: [0, 0, -0.1 * aura] });
      set('pylonR', { r: [0, 0, 0.1 * aura] });
      for (let petal = 0; petal < 4; petal++) set(`iris${petal}`, { p: [0, -0.09 * aura, 0], r: [(-0.9 - 0.12 * toll) * aura, 0, 0] });
      set('anchorL', { p: [-0.13 * aura, -0.09 * aura, -0.08 * aura], r: [0.25 * aura, 0, -0.3 * aura] });
      set('anchorR', { p: [0.13 * aura, -0.09 * aura, -0.08 * aura], r: [0.25 * aura, 0, 0.3 * aura] });
      for (let index = 0; index < 3; index++) {
        const phase = (t * 2 + index / 3) % 1;
        const spread = 0.45 + phase * 1.05;
        set(`wave${index}`, { p: [0, 0.025 * aura * phase, 0], s: [1 + (spread - 1) * aura, 1, 1 + (spread - 1) * aura] });
      }
      set('valveL', { r: [0, 0, -0.65 * aura] });
      set('valveR', { r: [0, 0, 0.65 * aura] });
    }),
    createRigClip(root, j, 'shutdown', 2.9, (t, time, { set }) => {
      const fail = ease(t, 0.03, 0.74);
      const rattle = Math.sin(Math.min(1, t * 2.2) * Math.PI * 6) * (1 - fail);
      set('body', { p: [0, -0.29 * fail, 0.15 * fail], r: [0.23 * fail, 0.06 * fail, 0.13 * fail] });
      set('bell', { p: [0.09 * fail, -0.42 * fail, 0.06 * fail], r: [0.42 * fail, 0.18 * fail, -0.38 * fail] });
      set('clapper', { p: [0, -0.3 * fail, 0], r: [0.65 * fail + 0.15 * rattle, 0, 0.85 * fail] });
      set('yoke', { p: [0, -0.18 * fail, 0], r: [0.12 * fail, 0, 0.16 * fail] });
      set('pylonL', { r: [0.18 * fail, 0, -0.32 * fail] });
      set('pylonR', { r: [-0.12 * fail, 0, 0.2 * fail] });
      set('hipL', { r: [-0.4 * fail, 0, -0.24 * fail] });
      set('hipR', { r: [0.3 * fail, 0, 0.18 * fail] });
      set('kneeL', { r: [-0.74 * fail, 0, 0] });
      set('kneeR', { r: [-0.52 * fail, 0, 0] });
      set('footL', { r: [0.36 * fail, 0.2 * fail, 0] });
      set('footR', { r: [0.22 * fail, -0.15 * fail, 0] });
      set('anchorL', { p: [0, 0.2 * fail, 0.12 * fail], r: [-0.5 * fail, 0, -0.45 * fail] });
      set('anchorR', { p: [0, 0.12 * fail, 0.08 * fail], r: [0.34 * fail, 0, 0.38 * fail] });
      set('iris0', { r: [0.75 * fail, 0, 0.3 * fail] });
      set('iris1', { r: [0.4 * fail, 0.2 * fail, 0] });
      set('iris2', { r: [0.9 * fail, 0, -0.25 * fail] });
      set('iris3', { r: [0.25 * fail, -0.2 * fail, 0] });
      set('valveL', { r: [0.4 * fail, -1.2 * fail, -0.5 * fail] });
      set('valveR', { r: [-0.3 * fail, 1.0 * fail, 0.65 * fail] });
      for (let index = 0; index < 3; index++) {
        const scale = Math.max(0.025, 1 - fail * (1.15 + index * 0.1) + 0.05 * rattle);
        set(`wave${index}`, { p: [0, -0.04 * fail, 0], s: [scale, 1, scale] });
      }
    }),
  ];
}

export const entities = [
  defineEntity({
    id: 'scrap_bulwark',
    name: '废响重盾',
    kind: 'monster',
    role: 'armored frontline',
    locomotion: 'ground',
    variants: ['base'],
    concept: '低矮连续倒角装甲包覆承力龙骨，双层重盾、侧展护板和伸缩推杆组成慢速破阵前排。',
    mechanism: '重盾推进与盾击由双腿负重、推杆伸缩和下部撞角协同；防御时侧护板展开，失压时液压支撑失效并坍塌。',
    build: buildScrapBulwark,
    clips: scrapBulwarkClips,
  }),
  defineEntity({
    id: 'echo_glider',
    name: '回声滑翔翼',
    kind: 'monster',
    role: 'flight haste support',
    locomotion: 'air',
    variants: ['base'],
    concept: '约 1.3 高度巡航的连续壳体滑翔机，镜像后掠翼、独立襟翼、双方向舵与双涵道推进器构成清晰轮廓。',
    mechanism: '加速依靠舵面差动、机翼展开和喷管尾流伸长共同表达；回声发射器承担攻击与护航增幅，失压后舵面垂落并失去升力。',
    build: buildEchoGlider,
    clips: echoGliderClips,
  }),
  defineEntity({
    id: 'noise_bell',
    name: '噪声丧钟',
    kind: 'monster',
    role: 'elite pressure aura',
    locomotion: 'ground',
    variants: ['base'],
    concept: '承载拱架悬置厚壁连续钟壳，双支柱、锚足、四片压力瓣和贴地同心波环组成精英支援单位。',
    mechanism: '压力场前摇抬钟、收钟锤、展开压力瓣并下锚；释放以钟锤击钟和三圈依次扩散的冲击波表达，失压时钟架、悬挂和腿部支撑分别失效。',
    build: buildNoiseBell,
    clips: noiseBellClips,
  }),
];
