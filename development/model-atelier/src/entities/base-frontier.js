import * as THREE from '../../vendor/three/build/three.module.js';
import { defineEntity } from './contract.js';
import {
  palette, group, mesh, box, panel, cylinder, sphere, crystal, torus, arc, cable, rod,
  lathe, hull, bearing, fasteners, radial, annulusGeometry,
} from '../geometry.js';
import { createRigClip, TAU, ease, pulse } from '../animations.js';
import { addMechanicalLink, withMechanicalLinks } from './mechanical-links.js';

const CLIP_ORDER = ['idle', 'move', 'attack', 'windup', 'release', 'ability', 'shutdown'];
const DURATIONS = { idle: 3.2, move: 0.96, attack: 1.08, windup: 0.9, release: 0.64, ability: 2.5, shutdown: 2.4 };
const sin = value => Math.sin(value);
const cos = value => Math.cos(value);
const reach = (p, start, peak, end) => pulse(p, start, peak, end);

function clips(root, joints, poses, durations = {}) {
  const timing = { ...DURATIONS, ...durations };
  return CLIP_ORDER.map(name => createRigClip(root, joints, name, timing[name], withMechanicalLinks(root, joints, poses[name])));
}

function entityRoot(id) {
  const root = new THREE.Group();
  root.name = id;
  return root;
}

function installLeg(root, joints, prefix, key, config, materials) {
  const { x, y, z, upper, lower, width = 0.15, depth = 0.28 } = config;
  const side = x < 0 ? -1 : 1;
  const hip = group(root, `${prefix}_${key}_hip`, [x, y, z]);
  bearing(hip, `${prefix}_${key}_coxa`, 0.105, 0.15, [0, 0, 0], materials, 'x');
  box(hip, `${prefix}_${key}_femur`, [width, upper * 0.72, 0.17], [0, -upper * 0.47, 0], materials.hull, [0, 0, side * 0.045], 0.026);
  rod(hip, `${prefix}_${key}_upper_strut`, [side * width * 0.62, -0.035, 0.045], [side * width * 0.62, -upper + 0.025, 0.045], 0.027, materials.edge);
  cable(hip, `${prefix}_${key}_upper_line`, [[-side * 0.065, -0.025, 0.06], [-side * 0.09, -upper * 0.42, 0.1], [-side * 0.06, -upper + 0.015, 0.055]], 0.014, materials.accent);
  const knee = group(hip, `${prefix}_${key}_knee`, [0, -upper, 0]);
  bearing(knee, `${prefix}_${key}_knee_bearing`, 0.086, 0.14, [0, 0, 0], materials, 'x');
  box(knee, `${prefix}_${key}_tibia`, [width * 0.78, lower * 0.72, 0.13], [0, -lower * 0.46, 0.015], materials.armor, [0, 0, -side * 0.035], 0.02);
  rod(knee, `${prefix}_${key}_lower_piston`, [-side * width * 0.54, -0.025, -0.045], [-side * width * 0.54, -lower + 0.018, -0.045], 0.022, materials.gold);
  const ankle = group(knee, `${prefix}_${key}_ankle`, [0, -lower, 0]);
  bearing(ankle, `${prefix}_${key}_ankle_bearing`, 0.064, 0.13, [0, 0, 0], materials, 'x');
  box(ankle, `${prefix}_${key}_foot`, [width * 1.65, 0.09, depth], [0, -0.045, -depth * 0.14], materials.dark, [0, 0, 0], 0.022);
  box(ankle, `${prefix}_${key}_toe`, [width * 1.34, 0.065, depth * 0.38], [0, -0.0575, -depth * 0.55], materials.edge, [0.05, 0, 0], 0.015);
  joints[`${key}Hip`] = hip;
  joints[`${key}Knee`] = knee;
  joints[`${key}Ankle`] = ankle;
}

function legSet(joints, count, phases) {
  return Array.from({ length: count }, (_, index) => ({
    key: `leg${index}`,
    side: joints[`leg${index}Hip`].position.x < 0 ? -1 : 1,
    phase: phases[index],
  }));
}

function poseLeg(set, leg, swing = 0, fold = 0, splay = 0) {
  set(`${leg.key}Hip`, { r: [swing, 0, leg.side * splay] });
  set(`${leg.key}Knee`, { r: [fold, 0, 0] });
  set(`${leg.key}Ankle`, { r: [-swing * 0.42 - fold * 0.55, 0, -leg.side * splay * 0.35] });
}

function collapseLegs(set, legs, amount, spread = 0.34) {
  legs.forEach((leg, index) => poseLeg(set, leg, (index % 2 ? -0.2 : 0.24) * amount, (0.68 + index % 3 * 0.12) * amount, spread * amount));
}

function mountLegs(body, joints, prefix, materials) {
  body.parent.updateMatrixWorld(true);
  for (const [key, hip] of Object.entries(joints)) {
    if (!/^leg\d+Hip$/.test(key)) continue;
    body.attach(hip);
    const p = hip.position;
    rod(body, `${prefix}_${key}_carrier`, [p.x * 0.35, p.y, 0], p.toArray(), 0.048, materials.dark, 20);
    sphere(body, `${prefix}_${key}_socket`, 0.11, p.toArray(), materials.hull, [0.7, 1, 1]);
  }
}

function addZBarrel(parent, name, position, length, radius, materials) {
  mesh(parent, `${name}_jacket`, annulusGeometry(radius * 1.08, radius * 0.64, length, 32), materials.dark, position, [Math.PI / 2, 0, 0]);
  mesh(parent, `${name}_collar`, annulusGeometry(radius * 1.22, radius * 0.64, length * 0.18, 32), materials.edge, [position[0], position[1], position[2] - length * 0.34], [Math.PI / 2, 0, 0]);
  torus(parent, `${name}_seal`, radius * 1.04, radius * 0.12, [position[0], position[1], position[2] - length * 0.51], materials.accent);
}

function buildStaticDrifter() {
  const root = entityRoot('static_drifter');
  const joints = {};
  const m = palette();
  const body = group(root, 'sd_body', [0, 0.67, 0.04]);
  joints.body = body;
  hull(body, 'sd_continuous_hull', [
    { z: -0.56, w: 0.44, h: 0.22, y: -0.035, chamfer: 0.065 },
    { z: -0.3, w: 0.88, h: 0.36, chamfer: 0.09 },
    { z: 0.22, w: 0.96, h: 0.4, y: 0.015, chamfer: 0.1 },
    { z: 0.49, w: 0.66, h: 0.29, y: 0.035, chamfer: 0.075 },
  ], m.hull);
  box(body, 'sd_dorsal_armor', [0.68, 0.12, 0.63], [0, 0.23, 0.02], m.armor, [0, 0, 0], 0.04);
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    panel(body, `sd_side_skirt_${tag}`, [[-0.34, -0.12], [0.31, -0.1], [0.38, 0.06], [-0.24, 0.13]], 0.065, [side * 0.47, -0.04, 0.04], m.dark, [0, side * Math.PI / 2, 0], 0.018);
    cable(body, `sd_side_conduit_${tag}`, [[side * 0.41, 0.12, 0.31], [side * 0.51, 0.15, 0.08], [side * 0.45, 0.04, -0.3]], 0.022, m.accent);
  }
  fasteners(body, 'sd_top_bolt', [[-0.24, 0.302, -0.18], [0.24, 0.302, -0.18], [-0.24, 0.302, 0.22], [0.24, 0.302, 0.22]], m.edge, 'y');
  const collector = group(body, 'sd_collector', [0, 0.34, 0.08]);
  joints.collector = collector;
  cylinder(collector, 'sd_collector_pedestal', 0.17, 0.22, 0.15, [0, 0, 0], m.dark, [0, 0, 0], 32);
  torus(collector, 'sd_collector_outer', 0.29, 0.035, [0, 0.11, 0], m.gold, [Math.PI / 2, 0, 0]);
  torus(collector, 'sd_collector_inner', 0.2, 0.022, [0, 0.15, 0], m.accent, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4;
    rod(collector, `sd_collector_spoke_${i}`, [0, 0.11, 0], radial(a, 0.27, 0.11), 0.018, m.edge);
  }
  crystal(collector, 'sd_static_core', 0.14, [0, 0.19, 0], m.core, [0.8, 1.25, 0.8]);
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    const vent = group(body, `sd_vent_${tag}`, [side * 0.35, 0.2, 0.25]);
    joints[`vent${tag}`] = vent;
    box(vent, `sd_vent_frame_${tag}`, [0.19, 0.09, 0.28], [0, 0, 0], m.dark, [0, 0, side * 0.12], 0.022);
    for (let i = 0; i < 3; i++) box(vent, `sd_vent_louver_${tag}_${i}`, [0.15, 0.025, 0.055], [0, 0.052, -0.075 + i * 0.075], m.edge, [0.22, 0, 0], 0.007);
  }
  addZBarrel(body, 'sd_ram_sleeve', [0, -0.045, -0.49], 0.39, 0.115, m);
  const ram = group(body, 'sd_ram', [0, -0.045, -0.62]);
  joints.ram = ram;
  rod(ram, 'sd_ram_piston', [0, 0, 0.46], [0, 0, -0.22], 0.055, m.gold);
  box(ram, 'sd_ram_head', [0.29, 0.19, 0.18], [0, 0, -0.2], m.armor, [0, 0, 0], 0.035);
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    const claw = group(ram, `sd_chisel_jaw_${tag}`, [side * 0.11, 0, -0.26]);
    joints[`jaw${tag}`] = claw;
    panel(claw, `sd_chisel_bit_${tag}`, [[-0.045, -0.07], [0.065, -0.055], [0.04, 0.29], [-0.025, 0.38]], 0.075, [0, 0, -0.03], m.edge, [Math.PI / 2, 0, 0], 0.014);
    cable(ram, `sd_ram_line_${tag}`, [[side * 0.08, 0.07, 0.12], [side * 0.17, 0.1, -0.04], [side * 0.12, 0.06, -0.24]], 0.012, m.accent);
  }
  const legConfig = [
    [-0.43, 0.62, -0.29], [0.43, 0.62, -0.29], [-0.43, 0.62, 0.31], [0.43, 0.62, 0.31],
  ];
  legConfig.forEach(([x, y, z], index) => installLeg(root, joints, 'sd', `leg${index}`, { x, y, z, upper: 0.27, lower: 0.26, width: 0.16, depth: 0.3 }, m));
  mountLegs(body, joints, 'sd', m);
  return { root, joints };
}

function staticDrifterClips(root, joints) {
  const legs = legSet(joints, 4, [0, Math.PI, Math.PI, 0]);
  return clips(root, joints, {
    idle(p, t, { set }) {
      const b = sin(TAU * p);
      set('body', { p: [0, 0.014 * b, 0], r: [0.012 * b, 0, 0.015 * sin(TAU * p + 1)] });
      set('collector', { r: [0, 0.32 * sin(TAU * p), 0] });
      set('ventL', { r: [0.12 + 0.1 * b, 0, 0] });
      set('ventR', { r: [0.12 - 0.1 * b, 0, 0] });
      legs.forEach(leg => poseLeg(set, leg, 0.012 * sin(TAU * p + leg.phase), 0.025, 0));
    },
    move(p, t, { set }) {
      const a = TAU * p;
      set('body', { p: [0, 0.026 * cos(a * 2), 0], r: [-0.035, 0, 0.022 * sin(a)] });
      set('collector', { r: [0.025 * sin(a), 0.18 * sin(a), 0] });
      legs.forEach(leg => {
        const q = a + leg.phase;
        poseLeg(set, leg, 0.36 * sin(q), 0.06 + 0.3 * Math.max(0, cos(q)), 0.035);
      });
      set('ram', { p: [0, 0, 0.025 * sin(a * 2)] });
    },
    attack(p, t, { set }) {
      const hit = reach(p, 0.12, 0.34, 0.74);
      set('ram', { p: [0, 0, -0.39 * hit] });
      set('body', { p: [0, -0.035 * hit, 0.07 * hit], r: [-0.09 * hit, 0, 0] });
      set('jawL', { r: [0, -0.24 * hit, -0.12 * hit] });
      set('jawR', { r: [0, 0.24 * hit, 0.12 * hit] });
      set('collector', { r: [0, 0.4 * hit, 0] });
      legs.forEach(leg => poseLeg(set, leg, leg.key === 'leg0' || leg.key === 'leg3' ? -0.1 * hit : 0.1 * hit, 0.12 * hit, 0.07 * hit));
    },
    windup(p, t, { set }) {
      const w = ease(p, 0, 1);
      set('ram', { p: [0, 0, 0.18 * w] });
      set('body', { p: [0, -0.075 * w, 0.06 * w], r: [0.09 * w, 0, 0] });
      set('jawL', { r: [0, 0.3 * w, 0] });
      set('jawR', { r: [0, -0.3 * w, 0] });
      set('ventL', { r: [0.52 * w, 0, 0] });
      set('ventR', { r: [0.52 * w, 0, 0] });
      legs.forEach(leg => poseLeg(set, leg, -0.08 * w, 0.25 * w, 0.1 * w));
    },
    release(p, t, { set }) {
      const hit = reach(p, 0, 0.19, 0.82);
      set('ram', { p: [0, 0, 0.15 * (1 - ease(p, 0, 0.19)) - 0.43 * hit] });
      set('body', { p: [0, -0.06 * (1 - p), 0.09 * hit], r: [-0.12 * hit, 0, 0] });
      set('jawL', { r: [0, -0.34 * hit, -0.15 * hit] });
      set('jawR', { r: [0, 0.34 * hit, 0.15 * hit] });
      set('collector', { r: [0, -0.5 * hit, 0] });
      legs.forEach(leg => poseLeg(set, leg, 0.12 * hit, 0.2 * hit, 0.1 * hit));
    },
    ability(p, t, { set }) {
      const cycle = sin(TAU * p * 2);
      set('collector', { r: [0, TAU * p, 0.08 * cycle] });
      set('ventL', { r: [0.4 + 0.18 * cycle, 0, -0.15] });
      set('ventR', { r: [0.4 - 0.18 * cycle, 0, 0.15] });
      set('ram', { p: [0, 0, 0.06 * cycle] });
      set('body', { p: [0, 0.018 * cycle, 0] });
      legs.forEach(leg => poseLeg(set, leg, 0, 0.055, 0.04));
    },
    shutdown(p, t, { set }) {
      const d = ease(p, 0.05, 0.9);
      set('body', { p: [0, -0.34 * d, 0.08 * d], r: [0.2 * d, 0, 0.31 * d] });
      set('collector', { p: [0, -0.08 * d, 0], r: [0.55 * d, 0.4 * d, 0.25 * d], s: [1 - 0.25 * d, 1 - 0.45 * d, 1 - 0.25 * d] });
      set('ram', { p: [0, -0.04 * d, -0.13 * sin(Math.PI * p)], r: [0.35 * d, 0, 0] });
      set('ventL', { r: [0.85 * d, 0, -0.4 * d] });
      set('ventR', { r: [-0.25 * d, 0, 0.4 * d] });
      set('jawL', { r: [0, 0.3 * d, 0.4 * d] });
      set('jawR', { r: [0, -0.3 * d, -0.4 * d] });
      collapseLegs(set, legs, d, 0.42);
    },
  });
}

function buildSpikeRunner() {
  const root = entityRoot('spike_runner');
  const joints = {};
  const m = palette();
  const body = group(root, 'sr_body', [0, 0.96, 0.08]);
  joints.body = body;
  hull(body, 'sr_continuous_hull', [
    { z: -0.58, w: 0.13, h: 0.16, y: -0.04, chamfer: 0.035 },
    { z: -0.25, w: 0.38, h: 0.34, chamfer: 0.07 },
    { z: 0.23, w: 0.43, h: 0.38, y: 0.02, chamfer: 0.08 },
    { z: 0.43, w: 0.25, h: 0.24, y: 0.035, chamfer: 0.06 },
  ], m.hull);
  panel(body, 'sr_dorsal_blade', [[-0.22, -0.05], [0.19, -0.04], [0.1, 0.3], [-0.06, 0.42]], 0.075, [0, 0.21, 0.08], m.armor, [Math.PI / 2, 0, 0], 0.02);
  box(body, 'sr_coral_visor', [0.24, 0.075, 0.055], [0, 0.065, -0.48], m.energy, [0.08, 0, 0], 0.018);
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    cable(body, `sr_lance_feed_${tag}`, [[side * 0.16, 0.09, 0.25], [side * 0.25, 0.12, -0.12], [side * 0.1, 0.04, -0.51]], 0.016, m.accent);
    rod(body, `sr_flank_brace_${tag}`, [side * 0.16, -0.13, -0.31], [side * 0.23, 0.12, 0.25], 0.025, m.edge);
  }
  addZBarrel(body, 'sr_lance_sleeve', [0, -0.035, -0.45], 0.44, 0.09, m);
  const lance = group(body, 'sr_lance', [0, -0.035, -0.62]);
  joints.lance = lance;
  rod(lance, 'sr_lance_piston', [0, 0, 0.53], [0, 0, -0.43], 0.042, m.gold, 20);
  for (const side of [-1, 1]) rod(lance, `sr_lance_rail_${side}`, [side * 0.07, 0, 0.08], [side * 0.07, 0, -0.28], 0.018, m.edge);
  crystal(lance, 'sr_lance_tip', 0.16, [0, 0, -0.49], m.core, [0.55, 0.55, 2.35], [0, 0, Math.PI / 4]);
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    const boost = group(body, `sr_boost_${tag}`, [side * 0.26, -0.025, 0.24]);
    joints[`boost${tag}`] = boost;
    cylinder(boost, `sr_boost_barrel_${tag}`, 0.1, 0.13, 0.38, [0, 0, 0.08], m.dark, [Math.PI / 2, 0, 0], 32);
    torus(boost, `sr_boost_lip_${tag}`, 0.105, 0.025, [0, 0, 0.29], m.edge);
    cylinder(boost, `sr_boost_core_${tag}`, 0.065, 0.09, 0.04, [0, 0, 0.3], m.energy, [Math.PI / 2, 0, 0], 24);
    cable(boost, `sr_boost_line_${tag}`, [[0, 0.09, -0.1], [side * 0.08, 0.14, 0.08], [0, 0.08, 0.26]], 0.014, m.accent);
    const vane = group(boost, `sr_boost_vane_${tag}`, [0, 0.1, 0.25]);
    joints[`vane${tag}`] = vane;
    box(vane, `sr_boost_flap_${tag}`, [0.17, 0.035, 0.24], [0, 0, 0.04], m.armor, [0, 0, 0], 0.012);
  }
  const tail = group(body, 'sr_tail', [0, 0.15, 0.34]);
  joints.tail = tail;
  panel(tail, 'sr_tail_fin', [[-0.18, -0.04], [0.19, -0.02], [0.09, 0.34], [-0.035, 0.44]], 0.065, [0, 0, 0], m.dark, [Math.PI / 2, 0, 0], 0.018);
  rod(tail, 'sr_tail_signal', [0, 0.02, 0.02], [0, 0.03, 0.4], 0.018, m.accent);
  [[-0.21, 0.82, 0.11], [0.21, 0.82, 0.11]].forEach(([x, y, z], index) => installLeg(root, joints, 'sr', `leg${index}`, { x, y, z, upper: 0.39, lower: 0.34, width: 0.12, depth: 0.35 }, m));
  mountLegs(body, joints, 'sr', m);
  return { root, joints };
}

function spikeRunnerClips(root, joints) {
  const legs = legSet(joints, 2, [0, Math.PI]);
  const gait = (set, p, amount, rate = 1) => {
    const a = TAU * p * rate;
    set('body', { p: [0, amount * 0.045 * cos(a * 2), 0], r: [-amount * 0.17, 0, amount * 0.035 * sin(a)] });
    legs.forEach(leg => {
      const q = a + leg.phase;
      poseLeg(set, leg, amount * 0.62 * sin(q), 0.08 + amount * 0.52 * Math.max(0, cos(q)), 0.025);
    });
    set('tail', { r: [amount * 0.12 * sin(a), 0, amount * 0.08 * sin(a)] });
  };
  return clips(root, joints, {
    idle(p, t, { set }) {
      const b = sin(TAU * p);
      set('body', { p: [0, 0.025 * b, 0], r: [-0.04, 0, 0.018 * b] });
      set('lance', { p: [0, 0, 0.018 * b] });
      set('boostL', { r: [0.04 * b, 0, 0] });
      set('boostR', { r: [-0.04 * b, 0, 0] });
      set('tail', { r: [0.06 * b, 0, 0] });
      legs.forEach(leg => poseLeg(set, leg, 0.025 * sin(TAU * p + leg.phase), 0.07, 0));
    },
    move(p, t, { set }) {
      gait(set, p, 0.85, 2);
      set('boostL', { r: [-0.12, 0, 0] });
      set('boostR', { r: [-0.12, 0, 0] });
      set('vaneL', { r: [0.22 + 0.08 * sin(TAU * p * 2), 0, 0] });
      set('vaneR', { r: [0.22 - 0.08 * sin(TAU * p * 2), 0, 0] });
    },
    attack(p, t, { set }) {
      const hit = reach(p, 0.1, 0.29, 0.68);
      set('lance', { p: [0, 0, -0.48 * hit] });
      set('body', { p: [0, -0.055 * hit, 0.09 * hit], r: [-0.2 * hit, 0, 0] });
      set('boostL', { r: [0.25 * hit, 0, -0.08 * hit] });
      set('boostR', { r: [0.25 * hit, 0, 0.08 * hit] });
      set('tail', { r: [-0.35 * hit, 0, 0] });
      poseLeg(set, legs[0], -0.26 * hit, 0.3 * hit, 0.08 * hit);
      poseLeg(set, legs[1], 0.32 * hit, 0.16 * hit, 0.08 * hit);
    },
    windup(p, t, { set }) {
      const w = ease(p, 0, 1);
      set('body', { p: [0, -0.17 * w, 0.1 * w], r: [-0.28 * w, 0, 0] });
      set('lance', { p: [0, 0, 0.18 * w] });
      set('boostL', { r: [-0.38 * w, 0, -0.12 * w] });
      set('boostR', { r: [-0.38 * w, 0, 0.12 * w] });
      set('vaneL', { r: [0.85 * w, 0, 0] });
      set('vaneR', { r: [0.85 * w, 0, 0] });
      set('tail', { r: [-0.42 * w, 0, 0] });
      poseLeg(set, legs[0], -0.3 * w, 0.65 * w, 0.08 * w);
      poseLeg(set, legs[1], 0.28 * w, 0.58 * w, 0.08 * w);
    },
    release(p, t, { set }) {
      const launch = reach(p, 0, 0.23, 0.92);
      gait(set, p, 0.8 * launch, 1);
      set('lance', { p: [0, 0, 0.12 * (1 - ease(p, 0, 0.2)) - 0.2 * launch] });
      set('boostL', { r: [-0.5 * launch, 0, 0] });
      set('boostR', { r: [-0.5 * launch, 0, 0] });
      set('vaneL', { r: [1.05 * launch, 0, 0] });
      set('vaneR', { r: [1.05 * launch, 0, 0] });
    },
    ability(p, t, { set }) {
      gait(set, p, 1.08, 6);
      const open = ease(p, 0, 0.12) * (1 - ease(p, 0.86, 1));
      set('boostL', { r: [-0.55 * open, 0, -0.1 * open] });
      set('boostR', { r: [-0.55 * open, 0, 0.1 * open] });
      set('vaneL', { r: [1.1 * open + 0.1 * sin(TAU * p * 6), 0, 0] });
      set('vaneR', { r: [1.1 * open - 0.1 * sin(TAU * p * 6), 0, 0] });
      set('lance', { p: [0, 0, 0.11 * open] });
    },
    shutdown(p, t, { set }) {
      const d = ease(p, 0.03, 0.92);
      set('body', { p: [0, -0.57 * d, 0.15 * d], r: [0.36 * d, 0.12 * d, -0.48 * d] });
      set('lance', { p: [0, -0.04 * d, 0.16 * d], r: [0.48 * d, 0, 0.18 * d] });
      set('boostL', { r: [0.5 * d, 0, -0.55 * d] });
      set('boostR', { r: [0.28 * d, 0, 0.55 * d] });
      set('vaneL', { r: [-0.65 * d, 0, 0] });
      set('vaneR', { r: [0.45 * d, 0, 0] });
      set('tail', { r: [0.7 * d, 0, 0.3 * d] });
      collapseLegs(set, legs, d, 0.5);
    },
  }, { move: 0.72, ability: 2.5 });
}

function installTrack(root, joints, prefix, side, materials) {
  const tag = side < 0 ? 'L' : 'R';
  const track = group(root, `${prefix}_track_${tag}`, [side * 0.61, 0, 0.08]);
  joints[`track${tag}`] = track;
  box(track, `${prefix}_track_frame_${tag}`, [0.25, 0.39, 1.04], [0, 0.31, 0], materials.dark, [0, 0, 0], 0.075);
  box(track, `${prefix}_track_top_${tag}`, [0.31, 0.1, 0.92], [0, 0.55, 0], materials.armor, [0, 0, 0], 0.035);
  for (let i = 0; i < 7; i++) {
    const z = -0.45 + i * 0.15;
    box(track, `${prefix}_tread_low_${tag}_${i}`, [0.34, 0.08, 0.125], [0, 0.04, z], materials.hull, [0, 0, 0], 0.018);
    box(track, `${prefix}_tread_high_${tag}_${i}`, [0.34, 0.07, 0.125], [0, 0.585, z], materials.hull, [0, 0, 0], 0.018);
  }
  const wheels = [];
  for (let i = 0; i < 3; i++) {
    const wheel = group(track, `${prefix}_wheel_${tag}_${i}`, [0, 0.3, -0.34 + i * 0.34]);
    joints[`wheel${tag}${i}`] = wheel;
    bearing(wheel, `${prefix}_wheel_bearing_${tag}_${i}`, 0.225, 0.28, [0, 0, 0], materials, 'x');
    torus(wheel, `${prefix}_wheel_tire_${tag}_${i}`, 0.19, 0.038, [0, 0, 0], materials.dark, [0, Math.PI / 2, 0]);
    for (let s = 0; s < 4; s++) {
      const a = s * TAU / 4;
      rod(wheel, `${prefix}_wheel_spoke_${tag}_${i}_${s}`, [0, 0, 0], [0, cos(a) * 0.17, sin(a) * 0.17], 0.018, materials.gold);
    }
    wheels.push(wheel);
  }
  for (const z of [-0.52, 0.52]) box(track, `${prefix}_tread_end_${tag}_${z}`, [0.33, 0.38, 0.085], [0, 0.31, z], materials.hull, [0, 0, 0], 0.04);
  cable(track, `${prefix}_track_line_${tag}`, [[side * 0.1, 0.52, -0.42], [side * 0.16, 0.64, 0], [side * 0.1, 0.52, 0.42]], 0.018, materials.accent);
  return wheels;
}

function buildShieldEcho() {
  const root = entityRoot('shield_echo');
  const joints = {};
  const m = palette();
  installTrack(root, joints, 'se', -1, m);
  installTrack(root, joints, 'se', 1, m);
  const body = group(root, 'se_body', [0, 0.67, 0.09]);
  joints.body = body;
  hull(body, 'se_continuous_hull', [
    { z: -0.49, w: 0.72, h: 0.36, y: 0.015, chamfer: 0.09 },
    { z: -0.15, w: 1.0, h: 0.48, chamfer: 0.12 },
    { z: 0.34, w: 0.92, h: 0.44, y: 0.025, chamfer: 0.11 },
    { z: 0.48, w: 0.62, h: 0.3, y: 0.04, chamfer: 0.075 },
  ], m.hull);
  box(body, 'se_upper_cowl', [0.69, 0.16, 0.56], [0, 0.28, 0.06], m.armor, [0, 0, 0], 0.05);
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    rod(body, `se_shield_outrigger_${tag}`, [side * 0.31, 0.02, -0.25], [side * 0.48, 0.22, -0.56], 0.055, m.edge);
    cable(body, `se_power_bus_${tag}`, [[side * 0.39, 0.22, 0.29], [side * 0.51, 0.31, -0.05], [side * 0.36, 0.22, -0.54]], 0.026, m.accent);
    cylinder(body, `se_capacitor_jacket_${tag}`, 0.105, 0.105, 0.35, [side * 0.42, 0.18, 0.15], m.dark, [0, 0, 0], 32);
    const capacitor = group(body, `se_capacitor_${tag}`, [side * 0.42, 0.25, 0.15]);
    joints[`capacitor${tag}`] = capacitor;
    rod(capacitor, `se_capacitor_rod_${tag}`, [0, -0.19, 0], [0, 0.24, 0], 0.046, m.gold);
    cylinder(capacitor, `se_capacitor_head_${tag}`, 0.13, 0.13, 0.085, [0, 0.23, 0], m.energy, [0, 0, 0], 24);
  }
  const shield = group(body, 'se_shield_gimbal', [0, 0.2, -0.59]);
  joints.shield = shield;
  torus(shield, 'se_projector_outer', 0.54, 0.07, [0, 0, 0], m.dark);
  torus(shield, 'se_projector_machined', 0.505, 0.026, [0, 0, -0.035], m.edge);
  torus(shield, 'se_projector_signal', 0.455, 0.018, [0, 0, -0.055], m.energy);
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4;
    const petal = group(shield, `se_shield_petal_${i}`, [cos(a) * 0.41, sin(a) * 0.41, 0.015], [0, 0, a]);
    joints[`petal${i}`] = petal;
    panel(petal, `se_shield_plate_${i}`, [[-0.03, -0.1], [0.27, -0.17], [0.43, -0.06], [0.43, 0.06], [0.27, 0.17], [-0.03, 0.1]], 0.075, [0, 0, 0], m.armor, [0, 0, 0], 0.022);
    rod(petal, `se_petal_rib_${i}`, [0.03, 0, -0.055], [0.35, 0, -0.055], 0.022, m.gold);
    crystal(petal, `se_petal_emitter_${i}`, 0.055, [0.34, 0, -0.065], m.core, [1.2, 0.8, 0.65]);
  }
  const membrane = group(shield, 'se_shield_membrane', [0, 0, -0.075], [0, 0, 0]);
  membrane.scale.set(0.72, 0.72, 1);
  joints.membrane = membrane;
  cylinder(membrane, 'se_field_lens', 0.46, 0.46, 0.022, [0, 0, 0], m.field, [Math.PI / 2, 0, 0], 64);
  torus(membrane, 'se_field_edge', 0.46, 0.012, [0, 0, -0.012], m.glass);
  arc(membrane, 'se_field_latitude', 0.32, 0.009, -Math.PI * 0.8, Math.PI * 0.8, [0, 0, -0.025], m.glass);
  addZBarrel(shield, 'se_ram_sleeve', [0, 0, -0.05], 0.25, 0.1, m);
  const ram = group(shield, 'se_ram', [0, 0, -0.2]);
  joints.ram = ram;
  rod(ram, 'se_ram_core', [0, 0, 0.48], [0, 0, -0.2], 0.052, m.gold);
  cylinder(ram, 'se_ram_face', 0.15, 0.12, 0.11, [0, 0, -0.21], m.armor, [Math.PI / 2, 0, 0], 32);
  fasteners(ram, 'se_ram_bolt', [[-0.07, -0.07, -0.275], [0.07, -0.07, -0.275], [-0.07, 0.07, -0.275], [0.07, 0.07, -0.275]], m.accent, 'z', 0.018);
  root.updateMatrixWorld(true);
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    body.attach(joints[`track${tag}`]);
    for (const z of [-0.24, 0.24]) rod(body, `se_suspension_link_${tag}_${z}`, [side * 0.3, -0.16, z], [side * 0.61, -0.36, z], 0.05, m.dark, 20);
    // The shield moves independently; ball-ended supports follow both ends.
    body.getObjectByName(`se_shield_outrigger_${tag}`).removeFromParent();
    addMechanicalLink(root, joints, `seShield${tag}`, { from: { node: body, point: [side * 0.31, 0.02, -0.25] }, to: { node: shield, point: [side * 0.48, 0.02, 0.03] }, radius: 0.035, sleeveRadius: 0.065, sleeveLength: 0.11, materials: m });
  }
  return { root, joints };
}

function shieldEchoClips(root, joints) {
  const wheelKeys = ['L', 'R'].flatMap(tag => [0, 1, 2].map(i => `wheel${tag}${i}`));
  const tracks = (set, p, speed = 1) => {
    const a = TAU * p * speed;
    wheelKeys.forEach(key => set(key, { r: [-a * 2, 0, 0] }));
    set('trackL', { p: [0, 0.018 * sin(a * 2), 0] });
    set('trackR', { p: [0, -0.018 * sin(a * 2), 0] });
    set('body', { p: [0, 0.018 * cos(a * 2), 0], r: [-0.025, 0, 0.012 * sin(a)] });
  };
  const petals = (set, fold, twist = 0) => {
    for (let i = 0; i < 4; i++) set(`petal${i}`, { r: [0, fold * (i % 2 ? 1 : -1), twist * (i % 2 ? 1 : -1)] });
  };
  return clips(root, joints, {
    idle(p, t, { set }) {
      const b = sin(TAU * p);
      set('body', { p: [0, 0.012 * b, 0] });
      set('shield', { r: [0.025 * b, 0.035 * sin(TAU * p + 1), 0] });
      set('membrane', { s: [1 + 0.045 * b, 1 + 0.045 * b, 1] });
      set('capacitorL', { p: [0, 0.035 * b, 0] });
      set('capacitorR', { p: [0, -0.035 * b, 0] });
      petals(set, 0.06 * b);
    },
    move(p, t, { set }) {
      tracks(set, p, 2);
      set('shield', { r: [0.035 * sin(TAU * p * 2), 0, 0] });
      set('membrane', { s: [0.94, 0.94, 1] });
      petals(set, 0.14, 0.03 * sin(TAU * p));
    },
    attack(p, t, { set }) {
      const hit = reach(p, 0.13, 0.34, 0.74);
      set('ram', { p: [0, 0, -0.36 * hit] });
      set('shield', { p: [0, 0, 0.08 * hit], r: [0.08 * hit, 0, 0] });
      set('body', { p: [0, -0.025 * hit, 0.065 * hit], r: [0.07 * hit, 0, 0] });
      set('membrane', { s: [0.85 - 0.15 * hit, 0.85 - 0.15 * hit, 1] });
      set('capacitorL', { p: [0, -0.11 * hit, 0] });
      set('capacitorR', { p: [0, -0.11 * hit, 0] });
      petals(set, -0.32 * hit);
      wheelKeys.forEach(key => set(key, { r: [0.16 * hit, 0, 0] }));
    },
    windup(p, t, { set }) {
      const w = ease(p, 0, 1);
      set('shield', { p: [0, 0.04 * w, -0.08 * w], r: [-0.12 * w, 0, 0] });
      set('membrane', { s: [0.58 + 0.52 * w, 0.58 + 0.52 * w, 1] });
      set('capacitorL', { p: [0, 0.18 * w, 0] });
      set('capacitorR', { p: [0, 0.18 * w, 0] });
      set('body', { p: [0, -0.055 * w, 0], r: [0.04 * w, 0, 0] });
      petals(set, 0.75 * w, 0.12 * w);
    },
    release(p, t, { set }) {
      const open = ease(p, 0, 0.28);
      const settle = ease(p, 0.55, 1);
      const s = 0.8 + 0.62 * open - 0.32 * settle;
      set('membrane', { s: [s, s, 1] });
      set('shield', { p: [0, 0, -0.15 * open * (1 - settle)], r: [-0.12 * (1 - settle), 0, 0.08 * sin(Math.PI * p)] });
      set('capacitorL', { p: [0, 0.2 * (1 - settle) - 0.13 * open, 0] });
      set('capacitorR', { p: [0, 0.2 * (1 - settle) - 0.13 * open, 0] });
      petals(set, 0.85 * (1 - open) - 0.16 * open);
      set('ram', { p: [0, 0, -0.12 * reach(p, 0.05, 0.25, 0.6)] });
    },
    ability(p, t, { set }) {
      const active = ease(p, 0, 0.12) * (1 - ease(p, 0.88, 1));
      const beat = sin(TAU * p * 3);
      set('membrane', { s: [1.18 + active * 0.28 + 0.055 * beat * active, 1.18 + active * 0.28 + 0.055 * beat * active, 1] });
      set('shield', { r: [0.045 * beat * active, 0.06 * sin(TAU * p) * active, 0.12 * sin(TAU * p) * active] });
      set('capacitorL', { p: [0, active * (0.08 + 0.1 * beat), 0] });
      set('capacitorR', { p: [0, active * (0.08 - 0.1 * beat), 0] });
      petals(set, -0.18 * active + 0.08 * beat * active, 0.06 * beat * active);
      set('body', { p: [0, -0.035 * active, 0] });
    },
    shutdown(p, t, { set }) {
      const d = ease(p, 0.02, 0.94);
      set('membrane', { s: [Math.max(0.025, 1 - d), Math.max(0.025, 1 - d), 1] });
      set('shield', { p: [0, -0.17 * d, 0.18 * d], r: [0.65 * d, 0.2 * d, -0.35 * d] });
      set('body', { p: [0, -0.24 * d, 0.08 * d], r: [0.17 * d, 0, 0.16 * d] });
      set('capacitorL', { p: [0, -0.2 * d, 0], r: [0, 0, -0.4 * d] });
      set('capacitorR', { p: [0, -0.16 * d, 0], r: [0, 0, 0.35 * d] });
      set('ram', { p: [0, -0.08 * d, 0.12 * d], r: [0.45 * d, 0, 0] });
      petals(set, 1.15 * d, 0.35 * d);
      set('trackL', { r: [0, 0, -0.08 * d] });
      set('trackR', { r: [0, 0, 0.08 * d] });
      wheelKeys.forEach((key, i) => set(key, { r: [(i % 2 ? -1 : 1) * 0.7 * sin(Math.PI * p), 0, 0] }));
    },
  }, { move: 1.18, ability: 3.2 });
}

function buildTempoAmplifier() {
  const root = entityRoot('tempo_amplifier');
  const joints = {};
  const m = palette();
  [[-0.39, 0.89, 0.19], [0.39, 0.89, 0.19], [0, 0.89, -0.4]].forEach(([x, y, z], index) => installLeg(root, joints, 'ta', `leg${index}`, { x, y, z, upper: 0.42, lower: 0.38, width: 0.14, depth: 0.31 }, m));
  const body = group(root, 'ta_body', [0, 1.0, 0.05]);
  joints.body = body;
  panel(body, 'ta_metronome_shell', [[-0.35, -0.44], [0.35, -0.44], [0.24, 0.33], [0.1, 0.63], [-0.1, 0.63], [-0.24, 0.33]], 0.43, [0, 0, 0], m.hull, [0, 0, 0], 0.045);
  panel(body, 'ta_front_recess', [[-0.23, -0.32], [0.23, -0.32], [0.14, 0.3], [0, 0.47], [-0.14, 0.3]], 0.035, [0, 0, -0.245], m.dark, [0, 0, 0], 0.018);
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    rod(body, `ta_front_rail_${tag}`, [side * 0.26, -0.35, -0.28], [side * 0.1, 0.47, -0.28], 0.025, m.gold);
    cable(body, `ta_signal_loom_${tag}`, [[side * 0.24, -0.32, 0.24], [side * 0.34, 0.05, 0.18], [side * 0.14, 0.48, 0.13]], 0.019, m.accent);
  }
  box(body, 'ta_escapement_bridge', [0.42, 0.09, 0.12], [0, -0.25, -0.29], m.armor, [0, 0, 0], 0.025);
  const pendulum = group(body, 'ta_pendulum', [0, -0.28, -0.31]);
  joints.pendulum = pendulum;
  bearing(pendulum, 'ta_pendulum_pivot', 0.09, 0.12, [0, 0, 0], m, 'z');
  rod(pendulum, 'ta_pendulum_rod', [0, 0, 0], [0, 0.84, 0], 0.024, m.edge);
  box(pendulum, 'ta_pendulum_weight', [0.2, 0.24, 0.09], [0, 0.59, 0], m.gold, [0, 0, 0], 0.035);
  crystal(pendulum, 'ta_pendulum_signal', 0.075, [0, 0.61, -0.065], m.core, [1, 1.35, 0.5]);
  const escapement = group(body, 'ta_escapement', [0, 0.39, -0.3]);
  joints.escapement = escapement;
  box(escapement, 'ta_escapement_anchor', [0.31, 0.065, 0.09], [0, 0, 0], m.armor, [0, 0, 0], 0.016);
  for (const side of [-1, 1]) box(escapement, `ta_escapement_pallet_${side}`, [0.055, 0.14, 0.08], [side * 0.13, -0.055, 0], m.accent, [0, 0, side * 0.25], 0.012);
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    const flywheel = group(body, `ta_flywheel_${tag}`, [side * 0.39, 0.02, 0.015]);
    joints[`flywheel${tag}`] = flywheel;
    bearing(flywheel, `ta_flywheel_bearing_${tag}`, 0.27, 0.12, [0, 0, 0], m, 'x');
    torus(flywheel, `ta_flywheel_rim_${tag}`, 0.265, 0.035, [0, 0, 0], m.gold, [0, Math.PI / 2, 0]);
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      rod(flywheel, `ta_flywheel_spoke_${tag}_${i}`, [0, 0, 0], [0, cos(a) * 0.24, sin(a) * 0.24], 0.016, i % 2 ? m.edge : m.accent);
    }
    rod(body, `ta_flywheel_bracket_${tag}`, [side * 0.23, -0.19, 0.04], [side * 0.41, -0.02, 0.04], 0.04, m.dark);
  }
  const crown = group(body, 'ta_crown', [0, 0.58, 0]);
  joints.crown = crown;
  box(crown, 'ta_crown_bridge', [0.43, 0.12, 0.3], [0, 0, 0], m.dark, [0, 0, 0], 0.035);
  for (const side of [-1, 1]) {
    mesh(body, `ta_crown_guide_${side}`, annulusGeometry(0.09, 0.077, 0.20, 24), m.dark, [side * 0.11, 0.49, 0.07]);
    rod(crown, `ta_crown_stem_${side}`, [side * 0.11, -0.34, 0.07], [side * 0.11, 0.02, 0.07], 0.031, m.edge);
  }
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    const fork = group(crown, `ta_fork_${tag}`, [side * 0.15, 0.03, 0]);
    joints[`fork${tag}`] = fork;
    box(fork, `ta_tuning_tine_${tag}`, [0.09, 0.48, 0.13], [0, 0.25, 0], m.armor, [0, 0, side * -0.06], 0.025);
    box(fork, `ta_tuning_signal_${tag}`, [0.045, 0.34, 0.02], [0, 0.26, -0.075], m.energy, [0, 0, side * -0.06], 0.008);
  }
  addZBarrel(body, 'ta_striker_sleeve', [0, -0.13, -0.31], 0.25, 0.07, m);
  const striker = group(body, 'ta_striker', [0, -0.13, -0.43]);
  joints.striker = striker;
  rod(striker, 'ta_striker_piston', [0, 0, 0.46], [0, 0, -0.24], 0.035, m.gold);
  box(striker, 'ta_striker_hammer', [0.25, 0.13, 0.13], [0, 0, -0.25], m.armor, [0, 0, 0], 0.028);
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3;
    const emitter = group(body, `ta_emitter_${i}`, radial(a, 0.29, -0.12), [0, a, 0]);
    joints[`emitter${i}`] = emitter;
    rod(emitter, `ta_emitter_mast_${i}`, [0, 0, 0], [0, 0.38, 0.12], 0.025, m.edge);
    torus(emitter, `ta_emitter_loop_${i}`, 0.09, 0.018, [0, 0.39, 0.13], m.accent, [0, 0, 0]);
  }
  for (const [key, y, radius] of [['waveLow', 0.18, 0.58], ['waveHigh', 1.04, 0.65]]) {
    const wave = group(root, `ta_${key}`, [0, y, 0]);
    joints[key] = wave;
    torus(wave, `ta_${key}_conductor`, radius, 0.014, [0, 0, 0], m.glass, [Math.PI / 2, 0, 0]);
    arc(wave, `ta_${key}_signal_arc`, radius, 0.012, -0.45, 0.45, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0]);
  }
  mountLegs(body, joints, 'ta', m);
  return { root, joints };
}

function tempoAmplifierClips(root, joints) {
  const legs = legSet(joints, 3, [0, TAU / 3, TAU * 2 / 3]);
  const mechanism = (set, p, rate, amplitude = 1) => {
    const a = TAU * p * rate;
    set('pendulum', { r: [0, 0, 0.42 * amplitude * sin(a)] });
    set('escapement', { r: [0, 0, -0.18 * amplitude * sin(a)] });
    set('flywheelL', { r: [a * 2, 0, 0] });
    set('flywheelR', { r: [-a * 2, 0, 0] });
    set('forkL', { r: [0, 0, -0.025 * amplitude * sin(a * 2)] });
    set('forkR', { r: [0, 0, 0.025 * amplitude * sin(a * 2)] });
  };
  return clips(root, joints, {
    idle(p, t, { set }) {
      mechanism(set, p, 2, 0.7);
      set('body', { p: [0, 0.012 * sin(TAU * p * 2), 0] });
      set('crown', { p: [0, 0.015 * sin(TAU * p * 2), 0] });
      legs.forEach(leg => poseLeg(set, leg, 0.01 * sin(TAU * p + leg.phase), 0.035, 0.025));
    },
    move(p, t, { set }) {
      const a = TAU * p;
      mechanism(set, p, 2, 0.9);
      set('body', { p: [0, 0.03 * cos(a * 2), 0], r: [-0.045, 0, 0.025 * sin(a)] });
      legs.forEach(leg => {
        const q = a + leg.phase;
        poseLeg(set, leg, 0.31 * sin(q), 0.07 + 0.28 * Math.max(0, cos(q)), 0.06);
      });
      set('waveLow', { r: [0, a, 0], s: [0.86, 1, 0.86] });
      set('waveHigh', { r: [0, -a, 0], s: [0.82, 1, 0.82] });
    },
    attack(p, t, { set }) {
      const hit = reach(p, 0.16, 0.38, 0.72);
      mechanism(set, p, 1, 1.15);
      set('striker', { p: [0, 0, -0.36 * hit] });
      set('body', { p: [0, -0.045 * hit, 0.055 * hit], r: [-0.08 * hit, 0, 0] });
      set('crown', { r: [0.12 * hit, 0, 0] });
      set('pendulum', { r: [0, 0, -0.58 * hit] });
      legs.forEach(leg => poseLeg(set, leg, 0.1 * sin(leg.phase) * hit, 0.16 * hit, 0.1 * hit));
    },
    windup(p, t, { set }) {
      const w = ease(p, 0, 1);
      mechanism(set, p, 5, 0.7 + w * 0.5);
      set('crown', { p: [0, 0.18 * w, 0] });
      set('forkL', { r: [0, 0, -0.34 * w] });
      set('forkR', { r: [0, 0, 0.34 * w] });
      for (let i = 0; i < 3; i++) set(`emitter${i}`, { r: [0.62 * w, 0, 0] });
      set('waveLow', { s: [0.65 + 0.25 * w, 1, 0.65 + 0.25 * w] });
      set('waveHigh', { s: [0.6 + 0.25 * w, 1, 0.6 + 0.25 * w] });
      set('body', { p: [0, -0.075 * w, 0] });
      legs.forEach(leg => poseLeg(set, leg, 0, 0.24 * w, 0.14 * w));
    },
    release(p, t, { set }) {
      const hit = reach(p, 0, 0.25, 0.95);
      mechanism(set, p, 4, 1.2);
      set('crown', { p: [0, 0.16 * (1 - hit), 0] });
      set('forkL', { r: [0, 0, -0.42 * hit] });
      set('forkR', { r: [0, 0, 0.42 * hit] });
      for (let i = 0; i < 3; i++) set(`emitter${i}`, { r: [0.8 * hit, 0, 0] });
      set('waveLow', { r: [0, TAU * p, 0], s: [0.7 + 1.15 * hit, 1, 0.7 + 1.15 * hit] });
      set('waveHigh', { r: [0, -TAU * p, 0], s: [0.65 + 0.9 * hit, 1, 0.65 + 0.9 * hit] });
      set('striker', { p: [0, 0, -0.13 * hit] });
      legs.forEach(leg => poseLeg(set, leg, 0, 0.18 * hit, 0.1 * hit));
    },
    ability(p, t, { set }) {
      const active = ease(p, 0, 0.1) * (1 - ease(p, 0.9, 1));
      mechanism(set, p, 12, 1.15);
      const beat = (sin(TAU * p * 8) + 1) / 2;
      set('crown', { p: [0, 0.12 * active + 0.035 * beat, 0] });
      set('forkL', { r: [0, 0, -active * (0.28 + beat * 0.08)] });
      set('forkR', { r: [0, 0, active * (0.28 + beat * 0.08)] });
      for (let i = 0; i < 3; i++) set(`emitter${i}`, { r: [active * (0.55 + 0.15 * sin(TAU * p * 8 + i * TAU / 3)), 0, 0] });
      set('waveLow', { r: [0, TAU * p * 2, 0], s: [0.85 + active * (0.25 + beat * 0.85), 1, 0.85 + active * (0.25 + beat * 0.85)] });
      set('waveHigh', { r: [0, -TAU * p * 2, 0], s: [0.8 + active * (0.2 + (1 - beat) * 0.7), 1, 0.8 + active * (0.2 + (1 - beat) * 0.7)] });
      set('body', { p: [0, 0.025 * beat * active, 0] });
      legs.forEach(leg => poseLeg(set, leg, 0, 0.09 * active, 0.1 * active));
    },
    shutdown(p, t, { set }) {
      const d = ease(p, 0.02, 0.94);
      const slow = TAU * 2 * (1 - (1 - p) ** 2);
      set('pendulum', { r: [0.3 * d, 0, 0.7 * d + 0.3 * sin(slow) * (1 - d)] });
      set('escapement', { r: [0, 0, -0.65 * d] });
      set('flywheelL', { r: [slow, 0, 0.2 * d] });
      set('flywheelR', { r: [-slow, 0, -0.25 * d] });
      set('body', { p: [0, -0.42 * d, 0.1 * d], r: [0.27 * d, 0, 0.3 * d] });
      set('crown', { p: [0, -0.19 * d, 0], r: [0.4 * d, 0, -0.25 * d] });
      set('forkL', { r: [0, 0, -0.65 * d] });
      set('forkR', { r: [0, 0, 0.28 * d] });
      set('striker', { p: [0, -0.05 * d, 0.1 * d], r: [0.4 * d, 0, 0] });
      for (let i = 0; i < 3; i++) set(`emitter${i}`, { r: [-0.75 * d, 0, (i - 1) * 0.25 * d] });
      set('waveLow', { s: [Math.max(0.04, 1 - d), 1, Math.max(0.04, 1 - d)] });
      set('waveHigh', { p: [0, -0.45 * d, 0], s: [Math.max(0.04, 1 - d), 1, Math.max(0.04, 1 - d)] });
      collapseLegs(set, legs, d, 0.45);
    },
  }, { move: 1.08, ability: 4 });
}

function buildFractureSeed() {
  const root = entityRoot('fracture_seed');
  const joints = {};
  const m = palette();
  for (let i = 0; i < 6; i++) {
    const [x, y, z] = radial(i * TAU / 6, 0.41, 0.46);
    installLeg(root, joints, 'fs', `leg${i}`, { x, y, z, upper: 0.2, lower: 0.17, width: 0.12, depth: 0.25 }, m);
  }
  const body = group(root, 'fs_body', [0, 0.76, 0.03]);
  joints.body = body;
  sphere(body, 'fs_inner_pressure_vessel', 1, [0, 0.02, 0], m.dark, [0.29, 0.5, 0.29]);
  lathe(body, 'fs_inner_spindle', [[0.08, -0.49], [0.19, -0.35], [0.23, 0], [0.18, 0.38], [0.07, 0.53]], [0, 0, 0], m.gold, [0, 0, 0], 48);
  torus(body, 'fs_core_band_low', 0.245, 0.025, [0, -0.23, 0], m.accent, [Math.PI / 2, 0, 0]);
  torus(body, 'fs_core_band_high', 0.23, 0.022, [0, 0.28, 0], m.accent, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    const shell = group(body, `fs_shell_${i}`, radial(a, 0.225, -0.39), [0, a, 0]);
    joints[`shell${i}`] = shell;
    panel(shell, `fs_shell_plate_${i}`, [[-0.07, 0], [-0.15, 0.17], [-0.175, 0.58], [-0.12, 0.96], [0, 1.14], [0.12, 0.96], [0.175, 0.58], [0.15, 0.17], [0.07, 0]], 0.105, [0, 0, 0], i % 2 ? m.hull : m.armor, [0, 0, 0], 0.026);
    cable(shell, `fs_shell_seam_${i}`, [[0, 0.06, 0.065], [0.025, 0.43, 0.075], [0, 0.83, 0.06], [0, 1.08, 0.025]], 0.016, m.energy);
    rod(shell, `fs_shell_rib_${i}`, [-0.1, 0.2, 0.075], [-0.13, 0.66, 0.075], 0.018, m.edge);
    bearing(shell, `fs_shell_hinge_${i}`, 0.065, 0.16, [0, 0.03, 0], m, 'x');
  }
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    const brood = group(body, `fs_brood_${tag}`, [side * 0.13, -0.02, -0.045]);
    joints[`brood${tag}`] = brood;
    hull(brood, `fs_brood_hull_${tag}`, [
      { z: -0.24, w: 0.08, h: 0.09, chamfer: 0.02 },
      { z: -0.04, w: 0.2, h: 0.25, chamfer: 0.045 },
      { z: 0.2, w: 0.16, h: 0.2, chamfer: 0.04 },
    ], m.dark);
    crystal(brood, `fs_brood_core_${tag}`, 0.105, [0, 0.02, -0.04], m.core, [0.75, 1.25, 0.75]);
    rod(brood, `fs_brood_spear_${tag}`, [0, 0, -0.14], [0, 0, -0.38], 0.025, m.edge);
    for (const legSide of [-1, 1]) {
      rod(brood, `fs_brood_folded_leg_${tag}_${legSide}`, [legSide * 0.07, -0.07, 0.04], [legSide * 0.16, -0.19, 0.13], 0.022, m.armor);
      rod(brood, `fs_brood_folded_shin_${tag}_${legSide}`, [legSide * 0.16, -0.19, 0.13], [legSide * 0.13, -0.23, -0.03], 0.018, m.gold);
    }
    cable(body, `fs_brood_umbilical_${tag}`, [[side * 0.08, 0.32, 0.12], [side * 0.25, 0.18, 0.15], [side * 0.18, -0.05, 0.02]], 0.019, m.accent);
  }
  const valve = group(body, 'fs_valve', [0, 0.62, 0]);
  joints.valve = valve;
  cylinder(valve, 'fs_valve_seat', 0.14, 0.18, 0.12, [0, 0, 0], m.dark, [0, 0, 0], 32);
  torus(valve, 'fs_valve_ring', 0.13, 0.025, [0, 0.07, 0], m.edge, [Math.PI / 2, 0, 0]);
  crystal(valve, 'fs_valve_core', 0.1, [0, 0.13, 0], m.energy, [0.75, 1.4, 0.75]);
  for (const side of [-1, 1]) addMechanicalLink(root, joints, `fsValve${side < 0 ? 'L' : 'R'}`, { from: { node: body, point: [side * 0.07, 0.43, 0.08] }, to: { node: valve, point: [side * 0.07, -0.02, 0] }, radius: 0.014, sleeveRadius: 0.03, sleeveLength: 0.04, overlap: 0.025, materials: m });
  addZBarrel(body, 'fs_drill_sleeve', [0, -0.08, -0.3], 0.3, 0.09, m);
  const ram = group(body, 'fs_ram', [0, -0.08, -0.41]);
  joints.ram = ram;
  rod(ram, 'fs_drill_piston', [0, 0, 0.40], [0, 0, -0.19], 0.045, m.gold);
  const drill = group(ram, 'fs_drill', [0, 0, -0.2]);
  joints.drill = drill;
  cylinder(drill, 'fs_drill_cone', 0.015, 0.13, 0.35, [0, 0, -0.1], m.armor, [-Math.PI / 2, 0, 0], 32);
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3;
    rod(drill, `fs_drill_flute_${i}`, [cos(a) * 0.1, sin(a) * 0.1, 0.04], [cos(a + 1.1) * 0.025, sin(a + 1.1) * 0.025, -0.27], 0.018, m.accent);
  }
  mountLegs(body, joints, 'fs', m);
  return { root, joints };
}

function fractureSeedClips(root, joints) {
  const legs = legSet(joints, 6, [0, Math.PI, 0, Math.PI, 0, Math.PI]);
  const shells = (set, open, twist = 0) => {
    for (let i = 0; i < 6; i++) set(`shell${i}`, { r: [open * (i % 2 ? 0.92 : 1.08), 0, twist * (i % 2 ? 1 : -1)] });
  };
  const brood = (set, amount, wriggle = 0) => {
    set('broodL', { p: [-0.38 * amount, 0.04 * amount, -0.16 * amount], r: [wriggle, -0.28 * amount, -0.25 * amount] });
    set('broodR', { p: [0.38 * amount, -0.02 * amount, -0.12 * amount], r: [-wriggle, 0.28 * amount, 0.25 * amount] });
  };
  return clips(root, joints, {
    idle(p, t, { set }) {
      const b = sin(TAU * p);
      set('body', { p: [0, 0.018 * b, 0], r: [0, 0.025 * b, 0.018 * b] });
      shells(set, 0.025 + 0.02 * b, 0.008 * b);
      brood(set, 0.025, 0.035 * b);
      set('valve', { p: [0, 0.025 * b, 0], r: [0, 0.3 * b, 0] });
      set('drill', { r: [0, 0, 0.35 * b] });
      legs.forEach(leg => poseLeg(set, leg, 0.012 * sin(TAU * p + leg.phase), 0.045, 0.04));
    },
    move(p, t, { set }) {
      const a = TAU * p;
      set('body', { p: [0, 0.026 * cos(a * 2), 0], r: [-0.025, 0.04 * sin(a), 0.025 * sin(a)] });
      legs.forEach(leg => {
        const q = a + leg.phase;
        poseLeg(set, leg, 0.32 * sin(q), 0.08 + 0.3 * Math.max(0, cos(q)), 0.08);
      });
      shells(set, 0.04 + 0.025 * sin(a * 2));
      set('drill', { r: [0, 0, a] });
      set('valve', { r: [0, -a * 0.4, 0] });
    },
    attack(p, t, { set }) {
      const hit = reach(p, 0.1, 0.33, 0.74);
      set('ram', { p: [0, 0, -0.34 * hit] });
      set('drill', { r: [0, 0, TAU * p * 5] });
      set('body', { p: [0, -0.04 * hit, 0.06 * hit], r: [-0.1 * hit, 0, 0] });
      shells(set, 0.11 * hit, 0.035 * hit);
      brood(set, 0.04 * hit, 0.1 * hit);
      legs.forEach(leg => poseLeg(set, leg, 0.1 * sin(leg.phase) * hit, 0.18 * hit, 0.12 * hit));
    },
    windup(p, t, { set }) {
      const w = ease(p, 0, 1);
      set('body', { p: [0, -0.09 * w, 0], r: [0.05 * w, 0, 0] });
      shells(set, 0.36 * w, 0.08 * w);
      brood(set, 0.24 * w, 0.06 * sin(TAU * p * 3));
      set('valve', { p: [0, 0.16 * w, 0], r: [0, TAU * p, 0] });
      set('ram', { p: [0, 0, 0.12 * w] });
      legs.forEach(leg => poseLeg(set, leg, 0, 0.3 * w, 0.15 * w));
    },
    release(p, t, { set }) {
      const open = reach(p, 0, 0.24, 0.94);
      shells(set, 0.85 * open, 0.14 * open);
      brood(set, 0.86 * open, 0.12 * sin(TAU * p * 2));
      set('valve', { p: [0, 0.24 * open, 0], r: [0.3 * open, TAU * p * 2, 0] });
      set('body', { p: [0, -0.1 * open, 0.04 * open], r: [0.1 * open, 0, 0] });
      set('drill', { r: [0, 0, TAU * p * 3] });
      legs.forEach(leg => poseLeg(set, leg, 0.12 * open, 0.28 * open, 0.18 * open));
    },
    ability(p, t, { set }) {
      const active = ease(p, 0, 0.16) * (1 - ease(p, 0.84, 1));
      const kick = sin(TAU * p * 4);
      shells(set, active * (0.62 + 0.14 * kick), active * 0.09 * kick);
      brood(set, active * (0.68 + 0.18 * sin(TAU * p * 2)), active * 0.18 * kick);
      set('valve', { p: [0, active * (0.16 + 0.05 * kick), 0], r: [0, TAU * p * 3, 0] });
      set('body', { p: [0, -0.07 * active, 0], r: [0, active * 0.08 * kick, 0] });
      set('ram', { p: [0, 0, 0.08 * active] });
      legs.forEach(leg => poseLeg(set, leg, 0, 0.24 * active, 0.18 * active));
    },
    shutdown(p, t, { set }) {
      const d = ease(p, 0.02, 0.9);
      const eject = ease(p, 0.28, 0.96);
      shells(set, 1.18 * d, 0.25 * d);
      set('broodL', { p: [-0.72 * eject, -0.17 * eject, -0.3 * eject], r: [0.35 * eject, -0.65 * eject, -0.8 * eject] });
      set('broodR', { p: [0.72 * eject, -0.2 * eject, -0.22 * eject], r: [-0.25 * eject, 0.65 * eject, 0.8 * eject] });
      set('body', { p: [0, -0.28 * d, 0.08 * d], r: [0.24 * d, 0.25 * d, -0.18 * d] });
      set('valve', { p: [0, 0.3 * sin(Math.PI * p) - 0.12 * d, 0], r: [0.7 * d, TAU * p * 2, 0.4 * d], s: [1 - 0.35 * d, 1 - 0.55 * d, 1 - 0.35 * d] });
      set('ram', { p: [0, -0.06 * d, 0.14 * d], r: [0.55 * d, 0, 0] });
      set('drill', { r: [0, 0, TAU * 3 * (1 - (1 - p) ** 2)] });
      collapseLegs(set, legs, d, 0.5);
    },
  }, { move: 1.12, ability: 3 });
}

function installDuct(parent, joints, prefix, tag, position, materials) {
  const nacelle = group(parent, `${prefix}_nacelle_${tag}`, position);
  joints[`nacelle${tag}`] = nacelle;
  torus(nacelle, `${prefix}_duct_shell_${tag}`, 0.35, 0.072, [0, 0, 0], materials.hull, [Math.PI / 2, 0, 0]);
  torus(nacelle, `${prefix}_duct_lip_${tag}`, 0.35, 0.025, [0, 0.055, 0], materials.edge, [Math.PI / 2, 0, 0]);
  torus(nacelle, `${prefix}_duct_signal_${tag}`, 0.285, 0.015, [0, -0.045, 0], materials.accent, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4 + Math.PI / 4;
    rod(nacelle, `${prefix}_duct_stent_${tag}_${i}`, [cos(a) * 0.07, 0, sin(a) * 0.07], [cos(a) * 0.31, 0, sin(a) * 0.31], 0.022, materials.dark);
  }
  const rotor = group(nacelle, `${prefix}_rotor_${tag}`, [0, 0, 0]);
  joints[`rotor${tag}`] = rotor;
  cylinder(rotor, `${prefix}_rotor_hub_${tag}`, 0.09, 0.11, 0.13, [0, 0, 0], materials.gold, [0, 0, 0], 32);
  crystal(rotor, `${prefix}_rotor_cap_${tag}`, 0.09, [0, 0.09, 0], materials.core, [1, 0.7, 1]);
  for (let i = 0; i < 5; i++) {
    const blade = group(rotor, `${prefix}_blade_mount_${tag}_${i}`, [0, 0, 0], [0, i * TAU / 5, 0]);
    panel(blade, `${prefix}_rotor_blade_${tag}_${i}`, [[0.055, -0.035], [0.26, -0.085], [0.3, -0.015], [0.11, 0.055]], 0.032, [0, 0, 0], materials.armor, [Math.PI / 2, 0, 0], 0.009);
  }
  cylinder(nacelle, `${prefix}_vector_barrel_${tag}`, 0.1, 0.15, 0.24, [0, -0.18, 0.07], materials.dark, [0, 0, 0], 32);
  torus(nacelle, `${prefix}_vector_rim_${tag}`, 0.12, 0.024, [0, -0.31, 0.07], materials.gold, [Math.PI / 2, 0, 0]);
  const flap = group(nacelle, `${prefix}_vector_flap_${tag}`, [0, -0.29, 0.18]);
  joints[`flap${tag}`] = flap;
  box(flap, `${prefix}_vector_plate_${tag}`, [0.22, 0.035, 0.21], [0, 0, 0.04], materials.armor, [0, 0, 0], 0.012);
  cable(nacelle, `${prefix}_duct_cable_${tag}`, [[-0.23, 0.03, 0.18], [-0.29, 0.11, 0], [-0.18, 0.04, -0.24]], 0.016, materials.accent);
}

function buildFloatingNoise() {
  const root = entityRoot('floating_noise');
  const joints = {};
  const m = palette();
  const body = group(root, 'fn_body', [0, 1.3, 0]);
  joints.body = body;
  hull(body, 'fn_continuous_hull', [
    { z: -0.62, w: 0.18, h: 0.16, y: -0.025, chamfer: 0.04 },
    { z: -0.32, w: 0.46, h: 0.34, y: 0.015, chamfer: 0.075 },
    { z: 0.2, w: 0.5, h: 0.38, y: 0.03, chamfer: 0.09 },
    { z: 0.5, w: 0.28, h: 0.24, y: 0.04, chamfer: 0.06 },
  ], m.hull);
  box(body, 'fn_dorsal_armor', [0.34, 0.12, 0.54], [0, 0.24, 0.02], m.armor, [0, 0, 0], 0.04);
  box(body, 'fn_forward_sensor', [0.24, 0.075, 0.06], [0, 0.06, -0.55], m.energy, [0, 0, 0], 0.02);
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    rod(body, `fn_outrigger_upper_${tag}`, [side * 0.2, 0.11, -0.19], [side * 0.61, 0.06, -0.12], 0.048, m.edge);
    rod(body, `fn_outrigger_lower_${tag}`, [side * 0.18, -0.13, 0.18], [side * 0.61, -0.04, 0.13], 0.042, m.dark);
    cable(body, `fn_rotor_power_${tag}`, [[side * 0.17, 0.2, 0.27], [side * 0.4, 0.19, 0.22], [side * 0.64, 0.06, 0.12]], 0.022, m.accent);
    installDuct(body, joints, 'fn', tag, [side * 0.65, 0, 0.02], m);
    rod(body, `fn_duct_gimbal_shaft_${tag}`, [side * 0.19, 0, 0.02], [side * 0.65, 0, 0.02], 0.038, m.dark, 20);
    sphere(body, `fn_duct_gimbal_socket_${tag}`, 0.075, [side * 0.65, 0, 0.02], m.hull);
  }
  const stabilizer = group(body, 'fn_stabilizer', [0, 0.04, 0.08]);
  joints.stabilizer = stabilizer;
  torus(stabilizer, 'fn_stabilizer_ring', 0.32, 0.025, [0, 0, 0], m.gold, [Math.PI / 2, 0, 0]);
  arc(stabilizer, 'fn_stabilizer_signal', 0.32, 0.015, -0.65, 0.65, [0, 0.02, 0], m.energy, [Math.PI / 2, 0, 0]);
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    const fin = group(body, `fn_tail_fin_${tag}`, [side * 0.17, 0.14, 0.37], [0, 0, side * -0.18]);
    joints[`fin${tag}`] = fin;
    panel(fin, `fn_tail_plane_${tag}`, [[-0.12, -0.04], [0.17, -0.03], [0.12, 0.34], [-0.04, 0.43]], 0.055, [0, 0, 0], m.armor, [Math.PI / 2, 0, 0], 0.015);
    cable(body, `fn_tail_line_${tag}`, [[side * 0.1, 0.21, 0.14], [side * 0.19, 0.27, 0.35], [side * 0.17, 0.14, 0.37]], 0.012, m.accent);
  }
  const sensor = group(body, 'fn_sensor_gimbal', [0, 0.3, -0.22]);
  joints.sensor = sensor;
  bearing(sensor, 'fn_sensor_bearing', 0.09, 0.16, [0, 0, 0], m, 'x');
  rod(sensor, 'fn_sensor_mast', [0, 0, 0], [0, 0.31, 0], 0.024, m.edge);
  torus(sensor, 'fn_sensor_loop', 0.115, 0.019, [0, 0.33, 0], m.accent, [0, 0, 0]);
  addZBarrel(body, 'fn_needle_sleeve', [0, -0.12, -0.37], 0.3, 0.075, m);
  const needle = group(body, 'fn_needle', [0, -0.12, -0.5]);
  joints.needle = needle;
  rod(needle, 'fn_needle_piston', [0, 0, 0.50], [0, 0, -0.28], 0.036, m.gold);
  crystal(needle, 'fn_needle_tip', 0.11, [0, 0, -0.34], m.core, [0.55, 0.55, 2.1]);
  for (const side of [-1, 1]) {
    rod(body, `fn_belly_brace_${side}`, [side * 0.16, -0.13, -0.25], [side * 0.13, -0.31, 0.22], 0.025, m.dark);
    box(body, `fn_belly_skid_${side}`, [0.08, 0.07, 0.5], [side * 0.13, -0.31, 0.02], m.armor, [0, 0, 0], 0.02);
  }
  return { root, joints };
}

function floatingNoiseClips(root, joints) {
  const propulsion = (set, p, turns, tilt, bob = 0) => {
    const a = TAU * p * turns;
    set('rotorL', { r: [0, a, 0] });
    set('rotorR', { r: [0, -a, 0] });
    set('nacelleL', { r: [tilt, 0, -0.035 * sin(a * 0.25)] });
    set('nacelleR', { r: [tilt, 0, 0.035 * sin(a * 0.25)] });
    set('flapL', { r: [0.25 + tilt * 1.2 + 0.1 * sin(a * 0.5), 0, 0] });
    set('flapR', { r: [0.25 + tilt * 1.2 - 0.1 * sin(a * 0.5), 0, 0] });
    set('body', { p: [0, bob, 0], r: [-tilt * 0.34, 0, 0.018 * sin(a * 0.25)] });
    set('stabilizer', { r: [0, -a * 0.25, 0] });
    set('sensor', { r: [0.04 * sin(a * 0.5), 0.15 * sin(a * 0.25), 0] });
  };
  return clips(root, joints, {
    idle(p, t, { set }) {
      propulsion(set, p, 4, 0.025, 0.045 * sin(TAU * p));
      set('finL', { r: [0.06 * sin(TAU * p), 0, 0] });
      set('finR', { r: [-0.06 * sin(TAU * p), 0, 0] });
      set('needle', { p: [0, 0, 0.018 * sin(TAU * p)] });
    },
    move(p, t, { set }) {
      propulsion(set, p, 8, 0.34, 0.025 * sin(TAU * p * 2));
      set('finL', { r: [-0.24, 0.12 * sin(TAU * p), -0.08] });
      set('finR', { r: [-0.24, -0.12 * sin(TAU * p), 0.08] });
      set('stabilizer', { r: [0.12, -TAU * p * 2, 0], s: [1.08, 1, 1.08] });
    },
    attack(p, t, { set }) {
      const hit = reach(p, 0.1, 0.31, 0.72);
      propulsion(set, p, 5, 0.08 + 0.12 * hit, -0.025 * hit);
      set('needle', { p: [0, 0, -0.42 * hit] });
      set('body', { p: [0, -0.025 * hit, 0.08 * hit], r: [0.12 * hit, 0, 0] });
      set('finL', { r: [0.32 * hit, 0, -0.15 * hit] });
      set('finR', { r: [0.32 * hit, 0, 0.15 * hit] });
      set('stabilizer', { r: [0, TAU * p * 2, 0], s: [1 - 0.12 * hit, 1, 1 - 0.12 * hit] });
    },
    windup(p, t, { set }) {
      const w = ease(p, 0, 1);
      propulsion(set, p, 6, -0.18 * w, 0.13 * w);
      set('needle', { p: [0, 0, 0.16 * w] });
      set('flapL', { r: [0.95 * w, 0, -0.15 * w] });
      set('flapR', { r: [0.95 * w, 0, 0.15 * w] });
      set('finL', { r: [-0.45 * w, 0, -0.2 * w] });
      set('finR', { r: [-0.45 * w, 0, 0.2 * w] });
      set('stabilizer', { s: [0.72 + 0.45 * w, 1, 0.72 + 0.45 * w] });
    },
    release(p, t, { set }) {
      const hit = reach(p, 0, 0.22, 0.9);
      propulsion(set, p, 7, 0.48 * hit, 0.1 * (1 - hit));
      set('needle', { p: [0, 0, 0.12 * (1 - ease(p, 0, 0.2)) - 0.36 * hit] });
      set('flapL', { r: [1.05 * hit, 0, 0] });
      set('flapR', { r: [1.05 * hit, 0, 0] });
      set('finL', { r: [-0.4 * hit, 0.2 * hit, 0] });
      set('finR', { r: [-0.4 * hit, -0.2 * hit, 0] });
      set('stabilizer', { r: [0, TAU * p * 3, 0], s: [0.8 + 0.6 * hit, 1, 0.8 + 0.6 * hit] });
    },
    ability(p, t, { set }) {
      const active = ease(p, 0, 0.12) * (1 - ease(p, 0.88, 1));
      propulsion(set, p, 12, 0.5 * active, 0.08 * active + 0.025 * sin(TAU * p * 3));
      set('flapL', { r: [0.3 + 0.85 * active + 0.12 * sin(TAU * p * 4), 0, -0.18 * active] });
      set('flapR', { r: [0.3 + 0.85 * active - 0.12 * sin(TAU * p * 4), 0, 0.18 * active] });
      set('finL', { r: [-0.38 * active, 0.18 * active, -0.2 * active] });
      set('finR', { r: [-0.38 * active, -0.18 * active, 0.2 * active] });
      set('stabilizer', { r: [0.18 * active, -TAU * p * 5, 0], s: [1 + 0.35 * active, 1, 1 + 0.35 * active] });
      set('needle', { p: [0, 0, 0.12 * active] });
    },
    shutdown(p, t, { set }) {
      const d = ease(p, 0.16, 0.96);
      const spin = TAU * 4 * (1 - (1 - p) ** 2);
      set('rotorL', { r: [0, spin, 0] });
      set('rotorR', { r: [0, -spin, 0] });
      set('body', { p: [0, -0.9 * d, 0.12 * d], r: [0.42 * d, 0.22 * d, 0.58 * d] });
      set('nacelleL', { r: [0.4 * d, 0, -0.58 * d] });
      set('nacelleR', { r: [-0.2 * d, 0, 0.48 * d] });
      set('flapL', { r: [-0.75 * d, 0, -0.25 * d] });
      set('flapR', { r: [0.55 * d, 0, 0.25 * d] });
      set('finL', { r: [0.8 * d, 0, -0.4 * d] });
      set('finR', { r: [0.45 * d, 0, 0.55 * d] });
      set('stabilizer', { p: [0, -0.12 * d, 0], r: [0.65 * d, spin * 0.2, 0.4 * d], s: [1 - 0.4 * d, 1, 1 - 0.4 * d] });
      set('sensor', { r: [0.8 * d, 0.4 * d, -0.6 * d] });
      set('needle', { p: [0, -0.08 * d, 0.14 * d], r: [0.65 * d, 0, 0.2 * d] });
    },
  }, { idle: 2.8, move: 0.84, ability: 2.2, shutdown: 2.8 });
}

export const entities = [
  defineEntity({
    id: 'static_drifter', name: '静噪漂移体', kind: 'monster', role: 'normal', locomotion: 'ground', variants: ['base'],
    concept: '宽扁四足抑声采集器，连续倒角甲壳背负交叉集音环，前端是双颚往复凿。',
    mechanism: '对角步足带独立髋、膝、踝机构；液压凿有缩回和前冲行程，排气百叶与集音环联动，停机时关节失压折叠。',
    build: buildStaticDrifter, clips: staticDrifterClips,
  }),
  defineEntity({
    id: 'spike_runner', name: '尖峰奔袭体', kind: 'monster', role: 'normal', locomotion: 'ground', variants: ['base'],
    concept: '双足长肢的窄体突进猎手，前置长导轨尖枪，背部双推进筒和上折喷流叶片形成轻锐轮廓。',
    mechanism: '奔跑步态由双腿交替摆动和屈膝抬足产生；加速前下蹲蓄压、喷流叶片张开，随后步频提升；尖枪沿套筒完成穿刺行程。',
    build: buildSpikeRunner, clips: spikeRunnerClips,
  }),
  defineEntity({
    id: 'shield_echo', name: '护盾回声', kind: 'monster', role: 'normal', locomotion: 'ground', variants: ['base'],
    concept: '双履带重型护盾投射车，正面多层环形框架承载四片独立铰接投射瓣与透明场镜。',
    mechanism: '履带轮真实旋转并提供悬挂起伏；充能时双电容活塞升降、投射瓣翻转、场镜扩缩，中央冲击杆可穿环攻击，失压后投射架下垂折叠。',
    build: buildShieldEcho, clips: shieldEchoClips,
  }),
  defineEntity({
    id: 'tempo_amplifier', name: '节拍增幅器', kind: 'monster', role: 'normal', locomotion: 'ground', variants: ['base'],
    concept: '三足立式机械节拍器，塔形壳内显露摆杆擒纵叉，两侧大飞轮与顶部双音叉构成支持单位轮廓。',
    mechanism: '三足交替行进，摆杆、擒纵叉和双飞轮互相反向运动；光环预警时音叉张合、辐射桅杆展开，释放时双层导环随节拍扩张而非仅改变亮度。',
    build: buildTempoAmplifier, clips: tempoAmplifierClips,
  }),
  defineEntity({
    id: 'fracture_seed', name: '裂解种子', kind: 'monster', role: 'normal', locomotion: 'ground', variants: ['base'],
    concept: '六足承托的分瓣压力荚舱，六片长弧倒角壳包围双胚舱，顶部泄压阀和前钻杆清晰可见。',
    mechanism: '六足交替举步，前钻旋转并沿活塞推进；裂解预警解除壳体锁止，释放时壳瓣外翻、双胚舱沿侧向滑程分离，停机呈现泄压开壳与胚舱抛出。',
    build: buildFractureSeed, clips: fractureSeedClips,
  }),
  defineEntity({
    id: 'floating_noise', name: '悬浮噪点', kind: 'monster', role: 'normal', locomotion: 'air', variants: ['base'],
    concept: '以约 1.3 高度飞行的双涵道旋翼噪讯艇，中央连续梭形舱、外露支撑桁架、矢量喷口和前针列形成空中剪影。',
    mechanism: '双五叶旋翼反向真实旋转，涵道前倾提供移动姿态，喷口叶片和尾舵随推进联动；攻击针沿套筒前冲，失压时旋翼减速、涵道歪垂并下降至接近地面。',
    build: buildFloatingNoise, clips: floatingNoiseClips,
  }),
];
