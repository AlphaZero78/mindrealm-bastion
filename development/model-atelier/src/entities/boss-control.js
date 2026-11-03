import * as THREE from '../../vendor/three/build/three.module.js';
import {
  palette, group, box, panel, cylinder, sphere, crystal, torus, arc, cable, rod,
  lathe, hull, bearing, fasteners, mirrored,
} from '../geometry.js';
import { createRigClip, TAU, ease, pulse } from '../animations.js';
import { defineEntity } from './contract.js';
import { addMechanicalLink, withMechanicalLinks } from './mechanical-links.js';

const PHASES = ['phase1', 'phase2', 'phase3'];
const SIDES = [-1, 1];
const sideId = side => side < 0 ? 'L' : 'R';
const modelRoot = node => { while (node.parent) node = node.parent; return node; };

function phaseOf(variant) {
  const index = PHASES.indexOf(variant);
  if (index < 0) throw new Error(`Unknown boss phase: ${variant}`);
  return index + 1;
}

function makeRoot(id, variant, phase) {
  const root = new THREE.Group();
  root.name = `${id}__${variant}`;
  root.userData.phase = phase;
  return root;
}

function makeJoint(parent, joints, key, position = [0, 0, 0], rotation = [0, 0, 0]) {
  if (joints[key]) throw new Error(`Duplicate joint: ${key}`);
  const node = group(parent, key, position, rotation);
  joints[key] = node;
  return node;
}

function slotRow(parent, name, count, start, step, size, material) {
  for (let i = 0; i < count; i++) {
    box(parent, `${name}_${i}`, size, [start[0] + step[0] * i, start[1] + step[1] * i, start[2] + step[2] * i], material);
  }
}

function buildBandwidthLeg(body, joints, materials, side, front) {
  const tag = `${front < 0 ? 'F' : 'B'}${sideId(side)}`;
  const hip = makeJoint(body, joints, `hip${tag}`, [side * 0.4, -0.16, front * 0.38]);
  bearing(hip, `bw_hip_${tag}`, 0.115, 0.15, [0, 0, 0], materials, 'x');
  rod(hip, `bw_upper_${tag}`, [0, 0, 0], [side * 0.18, -0.25, front * 0.04], 0.064, materials.hull);
  const upperArmor = box(hip, `bw_upper_armor_${tag}`, [0.13, 0.24, 0.16], [side * 0.09, -0.125, front * 0.02], materials.armor);
  upperArmor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-side * 0.18, 0.25, -front * 0.04).normalize());
  const knee = makeJoint(hip, joints, `knee${tag}`, [side * 0.18, -0.25, front * 0.04]);
  bearing(knee, `bw_knee_${tag}`, 0.1, 0.14, [0, 0, 0], materials, 'x');
  rod(knee, `bw_lower_${tag}`, [0, 0, 0], [side * 0.14, -0.29, -front * 0.02], 0.047, materials.edge);
  rod(knee, `bw_lower_piston_${tag}`, [-side * 0.045, -0.01, 0.045], [side * 0.09, -0.27, 0.045], 0.022, materials.gold);
  const foot = makeJoint(knee, joints, `foot${tag}`, [side * 0.14, -0.29, -front * 0.02]);
  box(foot, `bw_foot_${tag}`, [0.32, 0.09, 0.42], [0, -0.045, -0.055], materials.dark);
  panel(foot, `bw_toe_${tag}`, [[-0.16, -0.24], [0.16, -0.24], [0.12, 0.08], [-0.12, 0.08]], 0.055, [0, 0.005, -0.02], materials.hull);
  box(foot, `bw_toe_signal_${tag}`, [0.18, 0.025, 0.025], [0, 0.035, -0.245], materials.accent);
  for (const offset of [-0.1, 0.1]) {
    rod(foot, `bw_grip_${tag}_${offset}`, [offset, -0.015, -0.2], [offset, -0.04, -0.29], 0.018, materials.edge);
  }
}

function buildBandwidthCrown(mast, materials, phase) {
  cylinder(mast, 'bw_mast_seat', 0.17, 0.21, 0.1, [0, 0, 0], materials.dark);
  cylinder(mast, 'bw_mast_column', 0.055, 0.075, 0.3, [0, 0.18, 0], materials.edge);
  for (let i = 0; i < phase + 1; i++) {
    const y = 0.08 + i * 0.055;
    torus(mast, `bw_mast_inductor_${i}`, 0.1 + i * 0.012, 0.014, [0, y, 0], i % 2 ? materials.accent : materials.gold, [Math.PI / 2, 0, 0]);
  }
  const count = phase * 2;
  for (let i = 0; i < count; i++) {
    const angle = count === 1 ? 0 : -0.95 + 1.9 * i / (count - 1);
    const tip = [Math.sin(angle) * (0.2 + phase * 0.035), 0.38 + 0.035 * Math.cos(i * 2.1), Math.cos(angle) * 0.13];
    rod(mast, `bw_crown_tine_${i}`, [0, 0.27, 0], tip, 0.022, materials.edge);
    crystal(mast, `bw_crown_tip_${i}`, 0.047, tip, materials.energy, [0.65, 1.35, 0.65]);
  }
  if (phase >= 2) {
    torus(mast, 'bw_crown_allocation_ring', 0.29, 0.018, [0, 0.31, 0], materials.accent, [Math.PI / 2, 0, 0], Math.PI * 1.65);
  }
  if (phase === 3) {
    arc(mast, 'bw_crown_outer_yoke', 0.35, 0.025, 0.12, Math.PI - 0.12, [0, 0.24, 0.04], materials.hull, [0, 0, 0]);
    for (const side of SIDES) {
      rod(mast, `bw_crown_stay_${side}`, [side * 0.34, 0.25, 0.04], [side * 0.18, 0.03, 0.08], 0.018, materials.gold);
    }
  }
}

function buildBandwidthChannel(body, joints, materials, side, pair, phase) {
  const key = `channel${sideId(side)}${pair}`;
  const positions = [[side * 0.43, 0.07, 0.02], [side * 0.39, 0.17, 0.34], [side * 0.4, 0.01, -0.29]];
  const node = makeJoint(body, joints, key, positions[pair], [0, side * (0.12 + phase * 0.12 + pair * 0.05), side * (0.04 + pair * 0.05)]);
  const reach = 0.48 + pair * 0.055;
  const shape = mirrored([[0, -0.16], [reach * 0.78, -0.14], [reach, -0.01], [reach * 0.82, 0.19], [0.06, 0.17]], side);
  panel(node, `bw_${key}_panel`, shape, 0.065, [0, 0, 0], materials.hull, [0, 0, 0]);
  rod(node, `bw_${key}_spar`, [0, -0.17, 0], [side * reach * 0.86, -0.08, 0], 0.027, materials.edge);
  rod(node, `bw_${key}_upper_spar`, [side * 0.04, 0.16, 0], [side * reach * 0.8, 0.18, 0], 0.018, materials.gold);
  for (let i = 0; i < 4 + pair; i++) {
    const x = side * (0.12 + i * 0.065);
    box(node, `bw_${key}_slot_${i}`, [0.025, 0.18 - i * 0.012, 0.022], [x, 0.015, -0.045], i === 3 ? materials.energy : materials.accent);
  }
  fasteners(node, `bw_${key}_bolts`, [[side * 0.07, -0.1, -0.047], [side * 0.07, 0.11, -0.047], [side * reach * 0.72, 0.1, -0.047]], materials.edge);
  cable(node, `bw_${key}_cable`, [[0, -0.08, 0.045], [side * 0.13, -0.22, 0.08], [side * reach * 0.62, -0.14, 0.055]], 0.015, materials.dark);
  addMechanicalLink(modelRoot(body), joints, `bandwidth${key}`, {
    from: { node: body, point: [side * 0.21, positions[pair][1], positions[pair][2] + 0.12] },
    to: { node, point: [0, 0, 0.025] }, radius: 0.016, sleeveRadius: 0.035, sleeveLength: 0.08, materials,
  });
  return node;
}

function buildBandwidth(variant) {
  const phase = phaseOf(variant);
  const root = makeRoot('bandwidth_requisitioner', variant, phase);
  const materials = palette('enemy');
  const joints = {};
  const body = makeJoint(root, joints, 'body', [0, 0.79, 0]);
  hull(body, 'bw_main_hull', [
    { z: -0.69, w: 0.46, h: 0.26, y: -0.025 },
    { z: -0.48, w: 0.8, h: 0.43 },
    { z: 0.28, w: 0.91, h: 0.47, y: 0.015 },
    { z: 0.62, w: 0.62, h: 0.3, y: 0.015 },
  ], materials.hull);
  hull(body, 'bw_upper_carapace', [
    { z: -0.37, w: 0.58, h: 0.13, y: 0.25 },
    { z: 0.24, w: 0.72, h: 0.17, y: 0.27 },
    { z: 0.49, w: 0.42, h: 0.12, y: 0.22 },
  ], materials.armor);
  box(body, 'bw_front_recess', [0.48, 0.19, 0.05], [0, -0.015, -0.67], materials.dark);
  slotRow(body, 'bw_front_meter', 5, [-0.16, 0.02, -0.704], [0.08, 0, 0], [0.045, 0.075, 0.018], materials.accent);
  for (const side of SIDES) {
    panel(body, `bw_side_skirt_${side}`, mirrored([[-0.42, -0.15], [0.35, -0.17], [0.46, 0.08], [-0.29, 0.16]], side), 0.055, [side * 0.45, -0.03, 0.04], materials.armor, [0, side * Math.PI / 2, 0]);
    cable(body, `bw_side_bus_${side}`, [[side * 0.38, 0.16, -0.42], [side * 0.5, 0.2, -0.12], [side * 0.49, 0.17, 0.36]], 0.023, materials.gold);
  }
  for (const side of SIDES) for (const front of [-1, 1]) {
    buildBandwidthLeg(body, joints, materials, side, front);
  }
  const core = makeJoint(body, joints, 'core', [0, 0.025, -0.28]);
  sphere(core, 'bw_core_shell', 0.19, [0, 0, 0], materials.dark, [1, 0.82, 1]);
  crystal(core, 'bw_core_prism', 0.16, [0, 0, -0.06], materials.core, [0.8, 1.15, 0.8]);
  torus(core, 'bw_core_cage_a', 0.21, 0.018, [0, 0, 0], materials.edge, [Math.PI / 2, 0, 0]);
  torus(core, 'bw_core_cage_b', 0.21, 0.018, [0, 0, 0], materials.gold, [0, Math.PI / 2, 0]);
  const spindle = makeJoint(core, joints, 'spindle', [0, 0, -0.13]);
  torus(spindle, 'bw_spindle_outer', 0.18, 0.026, [0, 0, 0], materials.accent);
  torus(spindle, 'bw_spindle_inner', 0.115, 0.016, [0, 0, -0.015], materials.energy);
  for (const side of SIDES) {
    const gate = makeJoint(body, joints, `gate${sideId(side)}`, [side * 0.35, 0, -0.57], [0, -side * (0.08 + phase * 0.1), 0]);
    box(gate, `bw_gate_${side}_plate`, [0.29, 0.35, 0.065], [-side * 0.135, 0, -0.09], materials.armor);
    panel(gate, `bw_gate_${side}_face`, mirrored([[-0.13, -0.16], [0.12, -0.12], [0.14, 0.13], [-0.09, 0.17]], side), 0.035, [-side * 0.135, 0, -0.13], materials.hull, [0, 0, 0]);
    for (let i = 0; i < 3; i++) {
      box(gate, `bw_gate_${side}_rib_${i}`, [0.22, 0.025, 0.025], [-side * 0.135, -0.09 + i * 0.09, -0.16], i === 1 ? materials.accent : materials.edge);
    }
    cylinder(gate, `bw_gate_${side}_hinge`, 0.045, 0.045, 0.39, [0, 0, 0], materials.gold);
    for (const y of [-0.13, 0.13]) box(gate, `bw_gate_${side}_hinge_strap_${y}`, [0.075, 0.065, 0.14], [-side * 0.025, y, -0.045], materials.hull);
  }
  const collector = makeJoint(body, joints, 'collector', [0, 0.005, -0.64]);
  bearing(collector, 'bw_collector_gimbal', 0.22, 0.12, [0, 0, -0.03], materials, 'z');
  cylinder(collector, 'bw_collector_barrel', 0.09, 0.13, 0.48, [0, 0, -0.27], materials.dark, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    torus(collector, `bw_collector_coil_${i}`, 0.12 + i * 0.008, 0.014, [0, 0, -0.12 - i * 0.09], i % 2 ? materials.gold : materials.accent);
  }
  for (const side of SIDES) {
    rod(collector, `bw_collector_rail_${side}`, [side * 0.15, 0, -0.05], [side * 0.25, 0, -0.5], 0.031, materials.edge);
    const clamp = makeJoint(collector, joints, `clamp${sideId(side)}`, [side * 0.14, 0, -0.33], [0, side * 0.08, 0]);
    panel(clamp, `bw_clamp_${side}`, mirrored([[0, -0.08], [0.14, -0.05], [0.19, 0.05], [0.03, 0.09]], side), 0.28, [0, 0, -0.13], materials.hull, [Math.PI / 2, 0, 0]);
    rod(clamp, `bw_clamp_tine_${side}`, [0, 0, -0.04], [side * 0.1, 0, -0.37], 0.025, materials.gold);
    crystal(clamp, `bw_clamp_tip_${side}`, 0.055, [side * 0.1, 0, -0.39], materials.energy, [0.7, 0.7, 1.6]);
  }
  const requisitionPulse = makeJoint(collector, joints, 'requisitionPulse', [0, 0, -0.58]);
  torus(requisitionPulse, 'bw_requisition_wave', 0.25, 0.014, [0, 0, 0], materials.field);
  requisitionPulse.scale.setScalar(0.02);
  const mast = makeJoint(body, joints, 'mast', [0, 0.31, 0.19]);
  buildBandwidthCrown(mast, materials, phase);
  addMechanicalLink(root, joints, 'bandwidthCollector', {
    from: { node: body, point: [0, 0.005, -0.28] }, to: { node: collector, point: [0, 0, -0.08] },
    radius: 0.035, sleeveRadius: 0.075, sleeveLength: 0.17, materials,
  });
  addMechanicalLink(root, joints, 'bandwidthMast', {
    from: { node: body, point: [0, 0.08, 0.19] }, to: { node: mast, point: [0, 0.20, 0] },
    radius: 0.022, sleeveRadius: 0.047, sleeveLength: 0.10, materials,
  });
  for (let pair = 0; pair < phase; pair++) {
    for (const side of SIDES) buildBandwidthChannel(body, joints, materials, side, pair, phase);
  }
  if (phase === 3) {
    for (const side of SIDES) {
      const levy = makeJoint(body, joints, `levy${sideId(side)}`, [side * 0.36, -0.13, -0.42], [0, side * 0.15, 0]);
      cylinder(levy, `bw_levy_barrel_${side}`, 0.065, 0.09, 0.34, [0, 0, -0.15], materials.dark, [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 3; i++) torus(levy, `bw_levy_coil_${side}_${i}`, 0.09, 0.012, [0, 0, -0.04 - i * 0.1], materials.accent);
      rod(levy, `bw_levy_brace_${side}`, [0, -0.07, 0.03], [side * 0.13, -0.16, 0.1], 0.025, materials.edge);
    }
  }
  return { root, joints };
}

function bandwidthClips(root, joints) {
  const phase = root.userData.phase;
  const clip = (name, duration, pose) => createRigClip(root, joints, name, duration, withMechanicalLinks(root, joints, pose));
  const eachChannel = callback => {
    for (let pair = 0; pair < phase; pair++) for (const side of SIDES) callback(`channel${sideId(side)}${pair}`, side, pair);
  };
  const eachLeg = callback => {
    for (const side of SIDES) for (const front of [-1, 1]) {
      const tag = `${front < 0 ? 'F' : 'B'}${sideId(side)}`;
      callback(tag, side, front);
    }
  };
  return [
    clip('idle', 2.8, (t, time, { set }) => {
      const breath = Math.sin(TAU * t);
      set('body', { p: [0, 0.022 * breath, 0], r: [0.012 * breath, 0, 0.015 * Math.sin(TAU * t + 0.7)] });
      set('spindle', { r: [0, 0, TAU * t] });
      set('core', { r: [0, 0.16 * breath, 0] });
      set('collector', { r: [0.025 * breath, 0.035 * Math.sin(TAU * t + 1), 0] });
      set('mast', { r: [0, 0.08 * breath, 0] });
      eachChannel((key, side, pair) => set(key, { r: [0, side * 0.045 * Math.sin(TAU * t + pair * 0.7), 0] }));
      for (const side of SIDES) set(`gate${sideId(side)}`, { r: [0, -side * 0.035 * breath, 0] });
    }),
    clip('move', 1.6, (t, time, { set }) => {
      const stride = TAU * t;
      set('body', { p: [0, 0.035 * Math.cos(stride * 2), -0.045 * Math.sin(stride)], r: [0.035 * Math.sin(stride), 0, 0.035 * Math.cos(stride)] });
      set('collector', { r: [0.04 * Math.sin(stride + 0.4), 0, 0] });
      set('mast', { r: [0.025 * Math.cos(stride), 0.06 * Math.sin(stride), 0] });
      eachLeg((tag, side, front) => {
        const offset = (side === front ? 0 : Math.PI) + (front > 0 ? 0.35 : 0);
        const step = Math.sin(stride + offset);
        set(`hip${tag}`, { r: [0.3 * step, 0, side * 0.035 * Math.cos(stride + offset)] });
        set(`knee${tag}`, { r: [-0.22 - 0.22 * Math.max(0, -step), 0, 0] });
        set(`foot${tag}`, { r: [-0.3 * step + 0.22 + 0.22 * Math.max(0, -step), 0, 0] });
      });
      eachChannel((key, side, pair) => set(key, { r: [0, side * 0.06 * Math.sin(stride + pair), side * 0.025 * Math.cos(stride)] }));
    }),
    clip('attack', 1.45, (t, time, { set }) => {
      const thrust = pulse(t, 0.12, 0.36, 0.7);
      const recover = ease(t, 0.7, 1);
      set('body', { p: [0, -0.035 * thrust, 0.09 * thrust * (1 - recover)], r: [-0.08 * thrust, 0, 0] });
      set('collector', { p: [0, 0, -0.34 * thrust], r: [0.06 * thrust, 0, 0] });
      set('spindle', { r: [0, 0, TAU * 1.5 * ease(t, 0, 0.65)] });
      for (const side of SIDES) {
        set(`clamp${sideId(side)}`, { r: [0, side * 0.42 * thrust, 0] });
        set(`gate${sideId(side)}`, { r: [0, -side * 0.25 * thrust, 0] });
      }
      set('mast', { r: [0.12 * thrust, -0.18 * thrust, 0] });
    }),
    clip('windup', 1.1, (t, time, { set }) => {
      const charge = ease(t, 0, 0.88);
      set('body', { p: [0, -0.055 * charge, 0.06 * charge], r: [-0.07 * charge, 0, 0] });
      set('core', { p: [0, 0.09 * charge, 0], r: [0, TAU * 0.25 * charge, 0] });
      set('collector', { p: [0, 0, 0.12 * charge], r: [-0.12 * charge, 0, 0] });
      set('spindle', { r: [0, 0, TAU * 2 * charge], s: [1 + 0.2 * charge, 1 + 0.2 * charge, 1 + 0.2 * charge] });
      set('mast', { p: [0, 0.08 * charge, 0], r: [0, 0.35 * charge, 0] });
      for (const side of SIDES) {
        set(`gate${sideId(side)}`, { r: [0, -side * 0.75 * charge, 0] });
        set(`clamp${sideId(side)}`, { r: [0, side * 0.65 * charge, 0] });
      }
      eachChannel((key, side, pair) => set(key, { r: [0, side * (0.52 + pair * 0.08) * charge, side * 0.18 * charge] }));
      if (phase === 3) for (const side of SIDES) set(`levy${sideId(side)}`, { r: [0.18 * charge, side * 0.4 * charge, 0] });
    }),
    clip('release', 1.25, (t, time, { set, raw }) => {
      const shot = pulse(t, 0, 0.16, 0.62);
      const settle = ease(t, 0.55, 1);
      set('body', { p: [0, 0.045 * shot, 0.14 * shot * (1 - settle)], r: [0.1 * shot, 0, 0] });
      set('collector', { p: [0, 0, -0.4 * shot], r: [-0.08 * shot, 0, 0] });
      set('core', { p: [0, -0.06 * shot, 0] });
      set('spindle', { r: [0, 0, TAU * 2 * t] });
      for (const side of SIDES) {
        set(`clamp${sideId(side)}`, { r: [0, -side * 0.35 * shot, 0] });
        set(`gate${sideId(side)}`, { r: [0, -side * 0.3 * (1 - settle), 0] });
      }
      eachChannel((key, side, pair) => set(key, { r: [0, side * 0.3 * shot, -side * 0.14 * shot] }));
      raw('requisitionPulse', { p: [0, 0, -0.58 - 0.5 * ease(t, 0, 0.8)], s: [0.02 + 7 * ease(t, 0, 0.8), 0.02 + 7 * ease(t, 0, 0.8), 0.02 + 7 * ease(t, 0, 0.8)] });
    }),
    clip('ability', 4.2, (t, time, { set, raw }) => {
      const warning = ease(t, 0, 0.27);
      const active = pulse(t, 0.24, 0.42, 0.82);
      const recover = ease(t, 0.78, 1);
      const deploy = warning * (1 - recover);
      set('body', { p: [0, -0.065 * deploy + 0.035 * active, 0.08 * active], r: [-0.06 * deploy, 0.04 * Math.sin(TAU * t), 0] });
      set('core', { p: [0, 0.12 * deploy, 0], r: [0, TAU * t, 0] });
      set('collector', { p: [0, 0, -0.25 * active], r: [-0.1 * deploy, 0, 0] });
      set('spindle', { r: [0, 0, TAU * 3 * t], s: [1 + 0.3 * active, 1 + 0.3 * active, 1 + 0.3 * active] });
      set('mast', { p: [0, 0.1 * deploy, 0], r: [0, TAU * 0.5 * t, 0] });
      for (const side of SIDES) {
        set(`gate${sideId(side)}`, { r: [0, -side * 0.85 * deploy, 0] });
        set(`clamp${sideId(side)}`, { r: [0, side * (0.65 * deploy - 0.8 * active), 0] });
      }
      eachChannel((key, side, pair) => {
        const sequence = pulse(t, 0.3 + pair * 0.08, 0.4 + pair * 0.08, 0.64 + pair * 0.06);
        set(key, { p: [side * 0.09 * sequence, 0.025 * sequence, 0], r: [0, side * (0.65 * deploy + 0.22 * sequence), side * 0.2 * deploy] });
      });
      if (phase === 3) for (const side of SIDES) set(`levy${sideId(side)}`, { p: [side * 0.08 * active, 0, -0.12 * active], r: [0.2 * deploy, side * 0.45 * deploy, 0] });
      raw('requisitionPulse', { p: [0, 0, -0.58 - 0.75 * ease(t, 0.3, 0.85)], s: [0.02 + 9 * active, 0.02 + 9 * active, 0.02 + 9 * active] });
    }),
    clip('shutdown', 3.1, (t, time, { set }) => {
      const fail = ease(t, 0.05, 0.72);
      const drop = ease(t, 0.28, 0.85);
      set('body', { p: [0, -0.35 * drop, 0.13 * drop], r: [0.24 * drop, 0.08 * fail, 0.12 * Math.sin(Math.PI * fail)] });
      set('core', { p: [0, -0.17 * fail, 0.1 * fail], r: [0.4 * fail, -0.65 * fail, 0] });
      set('spindle', { r: [0.4 * fail, 0, 1.2 * fail] });
      set('collector', { p: [0, -0.11 * fail, 0.16 * fail], r: [0.38 * fail, 0, 0] });
      set('mast', { p: [0, -0.2 * fail, 0], r: [0.65 * fail, 0, 0.3 * fail] });
      for (const side of SIDES) {
        set(`gate${sideId(side)}`, { r: [0, -side * 1.05 * fail, side * 0.35 * drop] });
        set(`clamp${sideId(side)}`, { r: [0.25 * drop, side * 0.8 * fail, 0] });
      }
      eachChannel((key, side, pair) => set(key, { p: [0, -0.09 * drop, 0], r: [0.2 * drop, -side * 0.75 * fail, side * (0.65 + pair * 0.1) * drop] }));
      eachLeg((tag, side, front) => {
        set(`hip${tag}`, { r: [front * 0.18 * drop, 0, side * 0.24 * drop] });
        set(`knee${tag}`, { r: [-0.48 * drop, 0, 0] });
        set(`foot${tag}`, { r: [-front * 0.2 * drop, 0, 0] });
      });
    }),
  ];
}

function buildChorusWing(body, joints, materials, side, tier, phase) {
  const key = `wing${sideId(side)}${tier}`;
  const anchors = [[side * 0.32, 0.07, 0.01], [side * 0.28, -0.11, 0.15], [side * 0.24, 0.23, 0.12]];
  const wing = makeJoint(body, joints, key, anchors[tier], [0, side * (0.04 + tier * 0.1), side * (0.09 + phase * 0.055 + tier * 0.08)]);
  const reach = [0.91, 0.78, 0.68][tier];
  const shape = mirrored([[0, -0.15], [reach * 0.62, -0.27], [reach, -0.015], [reach * 0.8, 0.2], [0.15, 0.23], [0, 0.11]], side);
  panel(wing, `co_${key}_surface`, shape, 0.06, [0, 0, 0], materials.hull);
  const inset = mirrored([[0.1, -0.1], [reach * 0.57, -0.19], [reach * 0.82, -0.01], [reach * 0.67, 0.11], [0.16, 0.15]], side);
  panel(wing, `co_${key}_inset`, inset, 0.025, [0, 0.045, 0], materials.armor);
  rod(wing, `co_${key}_leading_spar`, [0, 0.055, -0.14], [side * reach * 0.63, 0.055, -0.25], 0.025, materials.edge);
  rod(wing, `co_${key}_tip_spar`, [side * reach * 0.63, 0.055, -0.25], [side * reach * 0.95, 0.055, -0.01], 0.02, materials.gold);
  cable(wing, `co_${key}_signal_edge`, [[side * 0.1, 0.065, -0.12], [side * reach * 0.54, 0.065, -0.2], [side * reach * 0.88, 0.065, -0.01]], 0.012, materials.accent);
  for (let i = 0; i < 3 + tier; i++) {
    const x = side * (0.2 + i * 0.13);
    rod(wing, `co_${key}_voice_tube_${i}`, [x, 0.065, -0.02], [x + side * 0.035, 0.065, 0.15], 0.018 + i * 0.002, i === 0 ? materials.accent : materials.edge);
    cylinder(wing, `co_${key}_voice_port_${i}`, 0.026, 0.026, 0.035, [x + side * 0.035, 0.065, 0.17], materials.energy, [Math.PI / 2, 0, 0], 12);
  }
  bearing(wing, `co_${key}_root`, 0.095, 0.14, [0, 0, 0], materials, 'z');
  return wing;
}

function buildChorusShield(body, joints, materials, index, count, phase) {
  const angle = -Math.PI * 0.72 + Math.PI * 1.44 * index / (count - 1);
  const mount = group(body, `co_shield_mount_${index}`, [Math.sin(angle) * 0.35, -0.015, Math.cos(angle) * 0.35], [0, angle, 0]);
  const petal = makeJoint(mount, joints, `shield${index}`, [0, 0.18, 0], [-0.04 - phase * 0.055, 0, 0]);
  bearing(petal, `co_shield_bearing_${index}`, 0.065, 0.13, [0, 0, 0], materials, 'x');
  const plate = group(petal, `co_shield_plate_carrier_${index}`, [0, -0.18, 0]);
  panel(plate, `co_shield_${index}_plate`, [[-0.12, -0.23], [0.12, -0.23], [0.17, 0.08], [0, 0.3], [-0.17, 0.08]], 0.045, [0, 0, 0], materials.armor, [0, 0, 0]);
  panel(plate, `co_shield_${index}_inset`, [[-0.075, -0.15], [0.075, -0.15], [0.1, 0.07], [0, 0.21], [-0.1, 0.07]], 0.02, [0, 0, 0.035], materials.dark, [0, 0, 0]);
  rod(plate, `co_shield_${index}_spine`, [0, -0.21, 0.045], [0, 0.25, 0.045], 0.018, materials.gold);
  for (const y of [-0.1, 0.02, 0.14]) {
    box(plate, `co_shield_${index}_signal_${y}`, [0.16 - Math.abs(y) * 0.25, 0.018, 0.018], [0, y, 0.055], materials.accent);
  }
  addMechanicalLink(modelRoot(body), joints, `chorusShield${index}`, {
    from: { node: mount, point: [0, 0.18, -0.25] }, to: { node: petal, point: [0, 0, 0] },
    radius: 0.015, sleeveRadius: 0.032, sleeveLength: 0.075, materials,
  });
  return petal;
}

function buildChorusCrown(crown, materials, phase) {
  lathe(crown, 'co_crown_seat', [[0.1, -0.035], [0.23, -0.035], [0.26, 0.015], [0.21, 0.065], [0.08, 0.065]], [0, 0, 0], materials.dark);
  torus(crown, 'co_crown_resonator', 0.22, 0.018, [0, 0.055, 0], materials.accent, [Math.PI / 2, 0, 0]);
  const count = 2 + phase * 2;
  for (let i = 0; i < count; i++) {
    const angle = TAU * i / count;
    const inner = [Math.sin(angle) * 0.13, 0.05, Math.cos(angle) * 0.13];
    const outer = [Math.sin(angle) * (0.26 + phase * 0.025), 0.28 + 0.055 * (i % 2), Math.cos(angle) * (0.26 + phase * 0.025)];
    rod(crown, `co_crown_rib_${i}`, inner, outer, 0.019, materials.edge);
    crystal(crown, `co_crown_voice_${i}`, 0.042, outer, i % 2 ? materials.gold : materials.energy, [0.7, 1.4, 0.7]);
  }
  if (phase >= 2) {
    arc(crown, 'co_crown_bridge', 0.34, 0.02, -Math.PI * 0.82, Math.PI * 0.82, [0, 0.18, 0], materials.gold, [0, 0, 0]);
  }
  if (phase === 3) {
    torus(crown, 'co_crown_outer_halo', 0.36, 0.015, [0, 0.2, 0], materials.accent, [Math.PI / 2, 0, 0], Math.PI * 1.75);
    for (const side of SIDES) {
      panel(crown, `co_crown_fin_${side}`, mirrored([[0, 0], [0.13, 0.05], [0.18, 0.27], [0.03, 0.21]], side), 0.035, [side * 0.18, 0.1, 0.03], materials.hull, [0, 0, 0]);
    }
  }
}

function buildChorus(variant) {
  const phase = phaseOf(variant);
  const root = makeRoot('chorus_overseer', variant, phase);
  const materials = palette('enemy');
  const joints = {};
  const body = makeJoint(root, joints, 'body', [0, 1.3, 0]);
  hull(body, 'co_main_hull', [
    { z: -0.55, w: 0.25, h: 0.27, y: -0.015 },
    { z: -0.34, w: 0.57, h: 0.5 },
    { z: 0.19, w: 0.67, h: 0.58, y: 0.015 },
    { z: 0.52, w: 0.34, h: 0.33, y: -0.02 },
  ], materials.hull);
  hull(body, 'co_dorsal_armor', [
    { z: -0.29, w: 0.34, h: 0.16, y: 0.31 },
    { z: 0.16, w: 0.49, h: 0.19, y: 0.34 },
    { z: 0.4, w: 0.24, h: 0.12, y: 0.24 },
  ], materials.armor);
  panel(body, 'co_front_keel', [[-0.19, -0.21], [0.19, -0.21], [0.13, 0.18], [0, 0.28], [-0.13, 0.18]], 0.055, [0, 0, -0.48], materials.dark, [0, 0, 0]);
  slotRow(body, 'co_front_voice_meter', 3, [-0.09, 0.025, -0.52], [0.09, 0, 0], [0.035, 0.19, 0.018], materials.accent);
  const core = makeJoint(body, joints, 'core', [0, 0.015, -0.15]);
  sphere(core, 'co_core_shell', 0.18, [0, 0, 0], materials.dark, [1, 1.12, 0.9]);
  crystal(core, 'co_core_voice', 0.15, [0, 0, -0.07], materials.core, [0.85, 1.25, 0.85]);
  torus(core, 'co_core_gimbal_a', 0.22, 0.016, [0, 0, 0], materials.gold, [0.45, 0, 0]);
  torus(core, 'co_core_gimbal_b', 0.22, 0.016, [0, 0, 0], materials.edge, [0, Math.PI / 2, 0]);
  const conductor = makeJoint(core, joints, 'conductor', [0, 0, -0.13]);
  torus(conductor, 'co_conductor_outer', 0.17, 0.022, [0, 0, 0], materials.accent);
  for (let i = 0; i < 3; i++) {
    const angle = TAU * i / 3;
    rod(conductor, `co_conductor_spoke_${i}`, [0, 0, 0], [Math.cos(angle) * 0.15, Math.sin(angle) * 0.15, 0], 0.013, materials.energy);
  }
  for (let tier = 0; tier < phase; tier++) for (const side of SIDES) buildChorusWing(body, joints, materials, side, tier, phase);
  const shieldCount = phase + 2;
  for (let i = 0; i < shieldCount; i++) buildChorusShield(body, joints, materials, i, shieldCount, phase);
  const crown = makeJoint(body, joints, 'crown', [0, 0.36, 0.08]);
  buildChorusCrown(crown, materials, phase);
  const tail = makeJoint(body, joints, 'tail', [0, -0.1, 0.39]);
  for (const side of [-1, 0, 1]) {
    panel(tail, `co_tail_fin_${side}`, [[-0.07, 0], [0.07, 0], [0.11, 0.38], [0, 0.48], [-0.11, 0.38]], 0.045, [side * 0.17, -0.08, 0.06], side === 0 ? materials.armor : materials.hull, [Math.PI / 2, 0, side * 0.24]);
    rod(tail, `co_tail_stay_${side}`, [side * 0.12, 0, 0], [side * 0.22, -0.03, 0.43], 0.019, materials.edge);
  }
  const hover = makeJoint(body, joints, 'hover', [0, -0.34, 0.03]);
  lathe(hover, 'co_hover_bell', [[0.11, 0.1], [0.28, 0.04], [0.32, -0.04], [0.25, -0.12], [0.12, -0.15]], [0, 0, 0], materials.dark);
  torus(hover, 'co_hover_ring_outer', 0.3, 0.024, [0, -0.055, 0], materials.accent, [Math.PI / 2, 0, 0]);
  torus(hover, 'co_hover_ring_inner', 0.18, 0.018, [0, -0.12, 0], materials.energy, [Math.PI / 2, 0, 0]);
  for (const side of SIDES) {
    const lift = makeJoint(body, joints, `lift${sideId(side)}`, [side * 0.27, -0.25, 0.12]);
    cylinder(lift, `co_lift_pod_${side}`, 0.09, 0.13, 0.24, [0, -0.05, 0], materials.hull);
    torus(lift, `co_lift_ring_${side}`, 0.12, 0.016, [0, -0.18, 0], materials.accent, [Math.PI / 2, 0, 0]);
    cable(lift, `co_lift_feed_${side}`, [[0, 0.08, 0], [side * 0.09, 0.13, 0.06], [side * 0.12, 0.1, 0.18]], 0.017, materials.gold);
    const relay = makeJoint(body, joints, `relay${sideId(side)}`, [side * 0.25, 0.015, -0.17]);
    rod(relay, `co_relay_boom_${side}`, [0, 0, 0], [side * 0.49, 0, 0], 0.024, materials.edge);
    torus(relay, `co_relay_terminal_${side}`, 0.105, 0.018, [side * 0.52, 0, 0], materials.accent, [0, Math.PI / 2, 0]);
    crystal(relay, `co_relay_node_${side}`, 0.055, [side * 0.52, 0, 0], materials.energy, [1, 1, 1]);
    addMechanicalLink(root, joints, `chorusRelay${sideId(side)}`, {
      from: { node: body, point: [side * 0.08, 0.015, -0.17] }, to: { node: relay, point: [side * 0.16, 0, 0] },
      radius: 0.018, sleeveRadius: 0.039, sleeveLength: 0.09, materials,
    });
  }
  const lance = makeJoint(body, joints, 'lance', [0, -0.035, -0.47]);
  cylinder(lance, 'co_lance_body', 0.055, 0.085, 0.37, [0, 0, -0.16], materials.dark, [Math.PI / 2, 0, 0]);
  for (const side of SIDES) {
    rod(lance, `co_lance_fork_${side}`, [side * 0.055, 0, -0.12], [side * 0.13, 0, -0.43], 0.022, materials.gold);
    crystal(lance, `co_lance_tip_${side}`, 0.042, [side * 0.13, 0, -0.45], materials.energy, [0.7, 0.7, 1.5]);
  }
  addMechanicalLink(root, joints, 'chorusLance', {
    from: { node: body, point: [0, -0.035, -0.17] }, to: { node: lance, point: [0, 0, -0.08] },
    radius: 0.018, sleeveRadius: 0.04, sleeveLength: 0.09, materials,
  });
  const shieldPulse = makeJoint(body, joints, 'shieldPulse', [0, -0.03, 0]);
  torus(shieldPulse, 'co_shared_shield_wave', 0.55, 0.015, [0, 0, 0], materials.field, [Math.PI / 2, 0, 0]);
  torus(shieldPulse, 'co_shared_shield_meridian', 0.55, 0.01, [0, 0, 0], materials.field, [0, 0, 0]);
  shieldPulse.scale.setScalar(0.02);
  if (phase >= 2) {
    for (const side of SIDES) {
      const jammer = makeJoint(body, joints, `jammer${sideId(side)}`, [side * 0.22, -0.22, 0.1], [0, 0, side * 0.18]);
      panel(jammer, `co_jammer_${side}_panel`, mirrored([[0, -0.14], [0.31, -0.11], [0.38, 0.08], [0.06, 0.14]], side), 0.045, [0, 0, 0], materials.dark, [0, 0, 0]);
      for (let i = 0; i < 3 + phase; i++) {
        box(jammer, `co_jammer_${side}_slot_${i}`, [0.025, 0.13, 0.02], [side * (0.09 + i * 0.052), 0, -0.035], materials.accent);
      }
    }
  }
  if (phase === 3) {
    const keel = makeJoint(body, joints, 'jammerKeel', [0, -0.29, -0.12]);
    panel(keel, 'co_jammer_keel_blade', [[-0.11, -0.25], [0.11, -0.25], [0.16, 0.12], [0, 0.24], [-0.16, 0.12]], 0.06, [0, -0.08, 0], materials.hull, [0, 0, 0]);
    rod(keel, 'co_jammer_keel_probe', [0, -0.22, 0], [0, -0.48, -0.08], 0.025, materials.accent);
  }
  return { root, joints };
}

function chorusClips(root, joints) {
  const phase = root.userData.phase;
  const clip = (name, duration, pose) => createRigClip(root, joints, name, duration, withMechanicalLinks(root, joints, pose));
  const eachWing = callback => {
    for (let tier = 0; tier < phase; tier++) for (const side of SIDES) callback(`wing${sideId(side)}${tier}`, side, tier);
  };
  const eachShield = callback => {
    for (let i = 0; i < phase + 2; i++) callback(`shield${i}`, i);
  };
  return [
    clip('idle', 3.2, (t, time, { set }) => {
      const wave = Math.sin(TAU * t);
      set('body', { p: [0, 0.035 * wave, 0], r: [0.018 * wave, 0.025 * Math.sin(TAU * t + 0.5), 0.025 * Math.cos(TAU * t)] });
      set('core', { r: [0, 0.18 * wave, 0] });
      set('conductor', { r: [0, 0, TAU * t] });
      set('hover', { r: [0, TAU * t, 0] });
      set('crown', { r: [0, 0.09 * wave, 0] });
      set('tail', { r: [0.04 * wave, 0.06 * Math.cos(TAU * t), 0] });
      eachWing((key, side, tier) => set(key, { r: [0, side * 0.035 * Math.sin(TAU * t + tier), side * 0.075 * Math.sin(TAU * t + tier * 0.65)] }));
      eachShield((key, index) => set(key, { r: [0.045 * Math.sin(TAU * t + index * 0.55), 0, 0] }));
      for (const side of SIDES) set(`lift${sideId(side)}`, { r: [0, side * 0.12 * wave, side * 0.035 * wave] });
    }),
    clip('move', 2, (t, time, { set }) => {
      const glide = TAU * t;
      set('body', { p: [0, 0.055 * Math.sin(glide * 2), -0.1 * Math.sin(glide)], r: [-0.08 - 0.035 * Math.cos(glide), 0.04 * Math.sin(glide), 0.08 * Math.sin(glide)] });
      set('hover', { r: [0, TAU * 2 * t, 0], s: [1 + 0.08 * Math.sin(glide), 1, 1 + 0.08 * Math.sin(glide)] });
      set('tail', { r: [0.12 * Math.sin(glide + 0.5), 0.1 * Math.sin(glide), 0] });
      set('crown', { r: [0.06 * Math.cos(glide), 0.16 * Math.sin(glide), 0] });
      eachWing((key, side, tier) => set(key, { r: [0.05 * Math.cos(glide + tier), side * 0.12 * Math.sin(glide), side * (0.18 * Math.sin(glide + tier * 0.55) - 0.05 * tier)] }));
      eachShield((key, index) => set(key, { r: [-0.09 + 0.05 * Math.sin(glide + index), 0, 0] }));
      for (const side of SIDES) {
        set(`lift${sideId(side)}`, { r: [0.12 * Math.sin(glide + side), 0, side * 0.08 * Math.cos(glide)] });
        set(`relay${sideId(side)}`, { r: [0, side * 0.08 * Math.sin(glide), 0] });
      }
    }),
    clip('attack', 1.5, (t, time, { set }) => {
      const strike = pulse(t, 0.1, 0.35, 0.72);
      set('body', { p: [0, -0.025 * strike, 0.11 * strike], r: [-0.13 * strike, 0, 0] });
      set('lance', { p: [0, 0, -0.43 * strike], r: [0.06 * strike, 0, 0] });
      set('conductor', { r: [0, 0, TAU * 1.5 * ease(t, 0, 0.65)] });
      set('core', { p: [0, 0, 0.08 * strike] });
      set('crown', { r: [0.14 * strike, -0.3 * strike, 0] });
      set('tail', { r: [-0.18 * strike, 0, 0] });
      eachWing((key, side, tier) => set(key, { r: [0, side * 0.36 * strike, side * (-0.18 + tier * 0.06) * strike] }));
      eachShield((key, index) => set(key, { r: [-0.2 * strike * (1 + index * 0.03), 0, 0] }));
    }),
    clip('windup', 1.1, (t, time, { set }) => {
      const charge = ease(t, 0, 0.9);
      set('body', { p: [0, 0.11 * charge, 0.06 * charge], r: [0.09 * charge, 0, 0] });
      set('core', { p: [0, 0.1 * charge, 0], r: [0, 0.4 * charge, 0] });
      set('conductor', { r: [0, 0, TAU * 2 * charge], s: [1 + 0.2 * charge, 1 + 0.2 * charge, 1 + 0.2 * charge] });
      set('crown', { p: [0, 0.07 * charge, 0], r: [0, 0.5 * charge, 0] });
      set('hover', { r: [0, TAU * charge, 0] });
      eachWing((key, side, tier) => set(key, { r: [0, -side * 0.15 * charge, side * (0.5 + tier * 0.12) * charge] }));
      eachShield((key, index) => set(key, { p: [0, 0.025 * charge, 0.08 * charge], r: [-0.62 * charge, 0, 0.08 * Math.sin(index) * charge] }));
      for (const side of SIDES) {
        set(`relay${sideId(side)}`, { p: [side * 0.16 * charge, 0, 0], r: [0, side * 0.12 * charge, 0] });
        if (phase >= 2) set(`jammer${sideId(side)}`, { r: [0.2 * charge, side * 0.35 * charge, side * 0.45 * charge] });
      }
      if (phase === 3) set('jammerKeel', { r: [-0.45 * charge, 0, 0] });
    }),
    clip('release', 1.35, (t, time, { set, raw }) => {
      const release = pulse(t, 0, 0.18, 0.68);
      const recover = ease(t, 0.62, 1);
      set('body', { p: [0, -0.09 * release, 0.16 * release * (1 - recover)], r: [-0.12 * release, 0, 0] });
      set('core', { p: [0, -0.06 * release, 0] });
      set('conductor', { r: [0, 0, TAU * 2 * t] });
      set('crown', { r: [0, TAU * 0.5 * t, 0] });
      set('hover', { r: [0, -TAU * t, 0] });
      eachWing((key, side, tier) => set(key, { r: [0, side * 0.16 * release, -side * (0.42 + tier * 0.08) * release] }));
      eachShield((key, index) => set(key, { p: [0, 0, 0.12 * release], r: [0.3 * release, 0, 0.08 * Math.sin(index) * release] }));
      for (const side of SIDES) set(`relay${sideId(side)}`, { p: [side * 0.34 * release, 0, -0.08 * release], r: [0, side * 0.3 * release, 0] });
      raw('shieldPulse', { p: [0, -0.03, 0], s: [0.02 + 3.6 * ease(t, 0, 0.82), 0.02 + 3.6 * ease(t, 0, 0.82), 0.02 + 3.6 * ease(t, 0, 0.82)] });
    }),
    clip('ability', 4.4, (t, time, { set, raw }) => {
      const warning = ease(t, 0, 0.25);
      const share = pulse(t, 0.23, 0.43, 0.83);
      const recover = ease(t, 0.8, 1);
      const deploy = warning * (1 - recover);
      set('body', { p: [0, 0.12 * deploy - 0.04 * share, 0.06 * share], r: [0.07 * deploy, 0.05 * Math.sin(TAU * t), 0] });
      set('core', { p: [0, 0.11 * deploy, 0], r: [0, TAU * t, 0] });
      set('conductor', { r: [0, 0, TAU * 3 * t] });
      set('crown', { p: [0, 0.08 * deploy, 0], r: [0, TAU * t, 0] });
      set('hover', { r: [0, TAU * 2 * t, 0] });
      set('tail', { r: [-0.16 * deploy, 0.1 * Math.sin(TAU * t), 0] });
      eachWing((key, side, tier) => {
        const voice = pulse(t, 0.29 + tier * 0.07, 0.41 + tier * 0.07, 0.66 + tier * 0.05);
        set(key, { p: [side * 0.08 * voice, 0, 0], r: [0, -side * 0.2 * deploy, side * (0.55 * deploy - 0.65 * voice)] });
      });
      eachShield((key, index) => {
        const voice = pulse(t, 0.3 + index * 0.025, 0.45 + index * 0.02, 0.75);
        set(key, { p: [0, 0.03 * voice, 0.13 * deploy + 0.1 * voice], r: [-0.72 * deploy + 0.45 * voice, 0, 0.1 * Math.sin(index * 2.2) * share] });
      });
      for (const side of SIDES) {
        set(`relay${sideId(side)}`, { p: [side * (0.2 * deploy + 0.28 * share), 0, -0.08 * share], r: [0, side * 0.35 * share, 0] });
        set(`lift${sideId(side)}`, { r: [0.18 * share, 0, side * 0.12 * deploy] });
        if (phase >= 2) set(`jammer${sideId(side)}`, { p: [side * 0.08 * share, 0, 0], r: [0.25 * deploy, side * 0.5 * share, side * 0.5 * deploy] });
      }
      if (phase === 3) set('jammerKeel', { p: [0, -0.08 * share, 0], r: [-0.5 * deploy, 0, 0] });
      raw('shieldPulse', { p: [0, -0.03, 0], s: [0.02 + 4.2 * share, 0.02 + 4.2 * share, 0.02 + 4.2 * share] });
    }),
    clip('shutdown', 3.4, (t, time, { set }) => {
      const fail = ease(t, 0.04, 0.75);
      const fall = ease(t, 0.22, 0.9);
      set('body', { p: [0, -0.62 * fall, 0.18 * fall], r: [0.38 * fall, 0.18 * fail, -0.2 * fail] });
      set('core', { p: [0, -0.18 * fail, 0.09 * fail], r: [0.5 * fail, -0.8 * fail, 0.3 * fail] });
      set('conductor', { r: [0.8 * fail, 0, -1.1 * fail] });
      set('crown', { p: [0, -0.2 * fail, 0], r: [0.7 * fail, 0, 0.45 * fail] });
      set('hover', { p: [0, 0.08 * fail, 0], r: [0.35 * fail, 0.7 * fail, 0] });
      set('tail', { r: [0.6 * fall, 0.25 * fail, 0] });
      set('lance', { p: [0, -0.08 * fail, 0.18 * fail], r: [0.5 * fail, 0, 0] });
      eachWing((key, side, tier) => set(key, { p: [0, -0.06 * tier * fall, 0], r: [0.12 * fall, side * 0.7 * fail, side * (0.95 + tier * 0.12) * fall] }));
      eachShield((key, index) => set(key, { p: [0, -0.12 * fall, 0], r: [-1.05 * fail, 0, (index % 2 ? 0.35 : -0.35) * fall] }));
      for (const side of SIDES) {
        set(`relay${sideId(side)}`, { p: [-side * 0.12 * fail, -0.08 * fall, 0], r: [0, -side * 0.5 * fail, side * 0.35 * fall] });
        set(`lift${sideId(side)}`, { r: [0.4 * fall, 0, side * 0.4 * fail] });
        if (phase >= 2) set(`jammer${sideId(side)}`, { r: [0.6 * fall, -side * 0.4 * fail, side * 1.05 * fail] });
      }
      if (phase === 3) set('jammerKeel', { r: [0.9 * fall, 0, 0.3 * fail] });
    }),
  ];
}

function buildZeroTrack(root, joints, materials, side) {
  const tag = sideId(side);
  const track = makeJoint(root, joints, `track${tag}`, [side * 0.54, 0, 0]);
  box(track, `zf_track_frame_${tag}`, [0.25, 0.22, 0.94], [0, 0.22, 0], materials.dark);
  for (let i = 0; i < 7; i++) {
    const z = -0.42 + i * 0.14;
    box(track, `zf_track_top_${tag}_${i}`, [0.37, 0.055, 0.115], [0, 0.405, z], materials.hull);
    box(track, `zf_track_bottom_${tag}_${i}`, [0.37, 0.055, 0.115], [0, 0.0275, z], materials.hull);
    box(track, `zf_track_top_cleat_${tag}_${i}`, [0.4, 0.025, 0.035], [0, 0.445, z], materials.edge);
  }
  for (const front of [-1, 1]) {
    const endTag = `${front < 0 ? 'F' : 'B'}${tag}`;
    box(track, `zf_track_end_${endTag}`, [0.36, 0.28, 0.065], [0, 0.215, front * 0.535], materials.armor, [front * 0.08, 0, 0]);
    for (const vertical of [-1, 1]) {
      box(track, `zf_track_corner_${endTag}_${vertical}`, [0.37, 0.07, 0.14], [0, vertical < 0 ? 0.075 : 0.36, front * 0.49], materials.hull, [front * vertical * 0.55, 0, 0]);
    }
    const drive = makeJoint(track, joints, `drive${endTag}`, [0, 0.22, front * 0.43]);
    bearing(drive, `zf_drive_${endTag}`, 0.17, 0.32, [0, 0, 0], materials, 'x');
    torus(drive, `zf_drive_ring_${endTag}`, 0.12, 0.018, [side * 0.18, 0, 0], materials.accent, [0, Math.PI / 2, 0]);
    for (let i = 0; i < 6; i++) {
      const angle = TAU * i / 6;
      rod(drive, `zf_drive_spoke_${endTag}_${i}`, [side * 0.17, 0, 0], [side * 0.17, Math.sin(angle) * 0.12, Math.cos(angle) * 0.12], 0.014, materials.gold);
    }
  }
  for (const z of [-0.2, 0, 0.2]) {
    bearing(track, `zf_roadwheel_${tag}_${z}`, 0.135, 0.29, [0, 0.2, z], materials, 'x');
  }
  cable(track, `zf_track_bus_${tag}`, [[0, 0.31, -0.38], [side * 0.12, 0.34, 0], [0, 0.31, 0.38]], 0.02, materials.gold);
  return track;
}

function zeroModuleConfigs(phase) {
  const configs = [
    { side: -1, position: [-0.43, 0.025, -0.035], yaw: -0.08 },
    { side: 1, position: [0.43, 0.025, -0.035], yaw: 0.08 },
  ];
  if (phase === 2) configs.push({ side: 1, position: [0, 0.235, 0.36], yaw: Math.PI });
  if (phase === 3) {
    configs.push(
      { side: -1, position: [-0.27, 0.215, 0.36], yaw: Math.PI - 0.35 },
      { side: 1, position: [0.27, 0.215, 0.36], yaw: Math.PI + 0.35 },
    );
  }
  return configs.map((config, index) => ({ ...config, key: `module${index}`, muzzle: `muzzle${index}` }));
}

function buildZeroModule(body, joints, materials, config, phase) {
  const module = makeJoint(body, joints, config.key, config.position, [0, config.yaw + config.side * phase * 0.055, 0]);
  bearing(module, `zf_${config.key}_bearing`, 0.1, 0.16, [0, 0, 0], materials, 'z');
  rod(module, `zf_${config.key}_arm`, [0, 0, 0], [config.side * 0.29, 0.04, 0], 0.052, materials.hull);
  rod(module, `zf_${config.key}_piston`, [0, -0.065, 0.025], [config.side * 0.24, -0.025, 0.025], 0.022, materials.gold);
  const muzzle = makeJoint(module, joints, config.muzzle, [config.side * 0.29, 0.04, 0]);
  box(muzzle, `zf_${config.key}_receiver`, [0.24, 0.22, 0.28], [0, 0, -0.04], materials.armor);
  cylinder(muzzle, `zf_${config.key}_barrel`, 0.065, 0.095, 0.34, [0, 0, -0.25], materials.dark, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 2 + phase; i++) {
    torus(muzzle, `zf_${config.key}_coil_${i}`, 0.092, 0.013, [0, 0, -0.13 - i * 0.07], i === 0 ? materials.energy : materials.accent);
  }
  panel(muzzle, `zf_${config.key}_sight`, [[-0.07, 0], [0.07, 0], [0.045, 0.16], [-0.045, 0.16]], 0.035, [0, 0.12, -0.05], materials.hull, [0, 0, 0]);
  crystal(muzzle, `zf_${config.key}_emitter`, 0.055, [0, 0, -0.45], materials.core, [1, 1, 1.35]);
  bearing(muzzle, `zf_${config.key}_elevation_pin`, 0.07, 0.24, [0, 0, 0.02], materials, 'x');
  addMechanicalLink(modelRoot(body), joints, `zero${config.key}Support`, {
    from: { node: module, point: [config.side * 0.20, 0.04, 0.18] }, to: { node: muzzle, point: [0, 0, 0.08] },
    radius: 0.012, sleeveRadius: 0.027, sleeveLength: 0.045, materials,
  });
  return module;
}

function zeroAnchorConfigs(phase) {
  const configs = [
    { position: [-0.46, 0.47, -0.43], side: -1, front: -1 },
    { position: [0.46, 0.47, -0.43], side: 1, front: -1 },
  ];
  if (phase === 3) configs.push(
    { position: [-0.43, 0.45, 0.39], side: -1, front: 1 },
    { position: [0.43, 0.45, 0.39], side: 1, front: 1 },
  );
  return configs.map((config, index) => ({ ...config, key: `anchor${index}` }));
}

function buildZeroAnchor(root, joints, materials, config) {
  const anchor = makeJoint(root, joints, config.key, config.position, [config.front * 0.12, 0, -config.side * 0.12]);
  bearing(anchor, `zf_${config.key}_pivot`, 0.075, 0.13, [0, 0, 0], materials, 'x');
  rod(anchor, `zf_${config.key}_cylinder`, [0, 0, 0], [config.side * 0.06, -0.24, config.front * 0.06], 0.047, materials.hull);
  rod(anchor, `zf_${config.key}_ram`, [config.side * 0.06, -0.18, config.front * 0.06], [config.side * 0.1, -0.34, config.front * 0.1], 0.025, materials.edge);
  cylinder(anchor, `zf_${config.key}_spike`, 0.075, 0.012, 0.18, [config.side * 0.1, -0.32, config.front * 0.1], materials.gold);
  box(anchor, `zf_${config.key}_shoe`, [0.22, 0.055, 0.24], [config.side * 0.08, -0.24, config.front * 0.09], materials.dark);
}

function buildZeroCrown(crown, materials, phase) {
  lathe(crown, 'zf_crown_seat', [[0.12, -0.04], [0.3, -0.04], [0.33, 0.025], [0.27, 0.075], [0.12, 0.075]], [0, 0, 0], materials.dark);
  const count = 2 + phase * 2;
  for (let i = 0; i < count; i++) {
    const angle = TAU * i / count;
    const base = [Math.sin(angle) * 0.2, 0.035, Math.cos(angle) * 0.2];
    const tip = [Math.sin(angle) * (0.31 + phase * 0.02), 0.32 + (i % 2) * 0.06, Math.cos(angle) * (0.31 + phase * 0.02)];
    rod(crown, `zf_crown_rib_${i}`, base, tip, 0.025, materials.edge);
    panel(crown, `zf_crown_blade_${i}`, [[-0.055, 0], [0.055, 0], [0.075, 0.18], [0, 0.25], [-0.075, 0.18]], 0.025, [tip[0], tip[1] - 0.08, tip[2]], i % 2 ? materials.hull : materials.armor, [0, angle, 0]);
    crystal(crown, `zf_crown_node_${i}`, 0.038, tip, materials.accent, [0.8, 1.3, 0.8]);
  }
  torus(crown, 'zf_crown_inner_ring', 0.22, 0.018, [0, 0.11, 0], materials.gold, [Math.PI / 2, 0, 0]);
  if (phase >= 2) {
    torus(crown, 'zf_crown_outer_ring', 0.36, 0.02, [0, 0.24, 0], materials.accent, [Math.PI / 2, 0, 0], Math.PI * 1.8);
  }
  if (phase === 3) {
    arc(crown, 'zf_crown_siege_arch', 0.43, 0.028, 0, Math.PI, [0, 0.12, 0.03], materials.hull);
    for (const side of SIDES) rod(crown, `zf_crown_arch_stay_${side}`, [side * 0.42, 0.12, 0.03], [side * 0.25, -0.02, 0.03], 0.025, materials.gold);
  }
}

function buildZero(variant) {
  const phase = phaseOf(variant);
  const root = makeRoot('zero_frequency_mind', variant, phase);
  const materials = palette('enemy');
  const joints = {};
  for (const side of SIDES) buildZeroTrack(root, joints, materials, side);
  const body = makeJoint(root, joints, 'body', [0, 0.73, 0]);
  for (const side of SIDES) for (const z of [-0.25, 0.25]) {
    addMechanicalLink(root, joints, `zeroSuspension${sideId(side)}${z < 0 ? 'F' : 'B'}`, {
      from: { node: joints[`track${sideId(side)}`], point: [0, 0.31, z] },
      to: { node: body, point: [side * 0.36, -0.25, z] },
      radius: 0.018, sleeveRadius: 0.04, sleeveLength: 0.07, materials,
    });
  }
  hull(body, 'zf_main_hull', [
    { z: -0.65, w: 0.57, h: 0.35, y: -0.02 },
    { z: -0.42, w: 0.94, h: 0.53 },
    { z: 0.34, w: 0.98, h: 0.55, y: 0.015 },
    { z: 0.64, w: 0.66, h: 0.36, y: -0.025 },
  ], materials.hull);
  hull(body, 'zf_upper_armor', [
    { z: -0.37, w: 0.68, h: 0.16, y: 0.31 },
    { z: 0.29, w: 0.78, h: 0.2, y: 0.34 },
    { z: 0.52, w: 0.47, h: 0.14, y: 0.24 },
  ], materials.armor);
  box(body, 'zf_front_shadow', [0.57, 0.24, 0.055], [0, -0.025, -0.625], materials.dark);
  for (const side of SIDES) {
    panel(body, `zf_side_armor_${side}`, mirrored([[-0.48, -0.19], [0.43, -0.17], [0.5, 0.13], [-0.36, 0.21]], side), 0.075, [side * 0.49, 0, 0.02], materials.armor, [0, side * Math.PI / 2, 0]);
    cable(body, `zf_pressure_line_${side}`, [[side * 0.36, 0.27, -0.39], [side * 0.51, 0.3, -0.12], [side * 0.51, 0.25, 0.37]], 0.026, materials.gold);
    for (let i = 0; i < 4; i++) {
      box(body, `zf_side_vent_${side}_${i}`, [0.025, 0.12, 0.055], [side * 0.535, 0.04, -0.22 + i * 0.14], materials.dark, [0, 0, side * 0.15]);
    }
  }
  const core = makeJoint(body, joints, 'core', [0, 0.11, -0.23]);
  sphere(core, 'zf_core_shell', 0.205, [0, 0, 0], materials.dark, [1.1, 0.9, 1]);
  crystal(core, 'zf_core_mind', 0.175, [0, 0, -0.055], materials.core, [1, 1.15, 0.9]);
  torus(core, 'zf_core_equator', 0.235, 0.02, [0, 0, 0], materials.gold, [Math.PI / 2, 0, 0]);
  torus(core, 'zf_core_meridian', 0.235, 0.018, [0, 0, 0], materials.edge, [0, Math.PI / 2, 0]);
  for (const side of SIDES) {
    const gate = makeJoint(body, joints, `gate${sideId(side)}`, [side * 0.39, 0, -0.56], [0, -side * (0.05 + phase * 0.085), 0]);
    panel(gate, `zf_gate_${side}_plate`, mirrored([[-0.19, -0.21], [0.16, -0.18], [0.2, 0.16], [-0.13, 0.23]], side), 0.09, [-side * 0.17, 0, -0.09], materials.armor, [0, 0, 0]);
    box(gate, `zf_gate_${side}_spine`, [0.055, 0.4, 0.05], [-side * 0.18, 0, -0.15], materials.hull, [0, 0, side * 0.12]);
    for (let i = 0; i < 3; i++) box(gate, `zf_gate_${side}_lock_${i}`, [0.21, 0.035, 0.035], [-side * 0.16, -0.11 + i * 0.11, -0.16], i === 1 ? materials.accent : materials.edge);
    cylinder(gate, `zf_gate_${side}_hinge`, 0.055, 0.055, 0.46, [0, 0, 0], materials.gold);
    for (const y of [-0.16, 0.16]) box(gate, `zf_gate_${side}_hinge_strap_${y}`, [0.09, 0.07, 0.14], [-side * 0.025, y, -0.045], materials.hull);
  }
  const siege = makeJoint(body, joints, 'siege', [0, 0.13, -0.18]);
  lathe(siege, 'zf_siege_turret', [[0.18, -0.09], [0.34, -0.09], [0.36, 0], [0.29, 0.1], [0.16, 0.1]], [0, -0.12, 0.06], materials.dark);
  bearing(siege, 'zf_siege_trunnion', 0.19, 0.65, [0, 0, 0], materials, 'x');
  const ram = makeJoint(siege, joints, 'ram', [0, 0, -0.27]);
  hull(ram, 'zf_ram_casing', [
    { z: -0.5, w: 0.36, h: 0.22 },
    { z: -0.3, w: 0.46, h: 0.31 },
    { z: 0.1, w: 0.4, h: 0.28 },
  ], materials.hull);
  cylinder(ram, 'zf_ram_column', 0.09, 0.12, 0.65, [0, 0, -0.25], materials.dark, [Math.PI / 2, 0, 0]);
  for (const side of SIDES) {
    rod(ram, `zf_ram_rail_${side}`, [side * 0.21, 0, 0.09], [side * 0.25, 0, -0.61], 0.04, materials.edge);
    rod(ram, `zf_ram_hydraulic_${side}`, [side * 0.15, -0.1, 0.04], [side * 0.19, -0.1, -0.5], 0.025, materials.gold);
  }
  for (let i = 0; i < 4; i++) torus(ram, `zf_ram_coil_${i}`, 0.15 + i * 0.008, 0.018, [0, 0, -0.11 - i * 0.105], i === 3 ? materials.energy : materials.accent);
  box(ram, 'zf_ram_impact_head', [0.72, 0.3, 0.2], [0, 0, -0.59], materials.armor);
  panel(ram, 'zf_ram_impact_face', [[-0.34, -0.13], [0.34, -0.13], [0.29, 0.13], [-0.29, 0.13]], 0.055, [0, 0, -0.71], materials.dark, [0, 0, 0]);
  for (const x of [-0.24, 0, 0.24]) {
    crystal(ram, `zf_ram_face_spike_${x}`, 0.075, [x, 0, -0.76], materials.gold, [0.85, 0.85, 1.65], [Math.PI / 2, 0, 0]);
  }
  addMechanicalLink(root, joints, 'zeroSiegeRam', {
    from: { node: siege, point: [0, 0, 0.16] }, to: { node: ram, point: [0, 0, -0.04] },
    radius: 0.033, sleeveRadius: 0.075, sleeveLength: 0.12, materials,
  });
  const crown = makeJoint(body, joints, 'crown', [0, 0.37, 0.13]);
  buildZeroCrown(crown, materials, phase);
  const modules = zeroModuleConfigs(phase);
  for (const config of modules) buildZeroModule(body, joints, materials, config, phase);
  const anchors = zeroAnchorConfigs(phase);
  for (const config of anchors) buildZeroAnchor(root, joints, materials, config);
  const siegePulse = makeJoint(root, joints, 'siegePulse', [0, 0.055, -0.55]);
  torus(siegePulse, 'zf_siege_ground_wave', 0.55, 0.018, [0, 0, 0], materials.field, [Math.PI / 2, 0, 0]);
  arc(siegePulse, 'zf_siege_broken_wave', 0.42, 0.013, 0.2, Math.PI * 1.65, [0, 0.005, 0], materials.field, [Math.PI / 2, 0, 0]);
  siegePulse.scale.setScalar(0.02);
  return { root, joints };
}

function zeroClips(root, joints) {
  const phase = root.userData.phase;
  const clip = (name, duration, pose) => createRigClip(root, joints, name, duration, withMechanicalLinks(root, joints, pose));
  const modules = zeroModuleConfigs(phase);
  const anchors = zeroAnchorConfigs(phase);
  const eachDrive = callback => {
    for (const side of SIDES) for (const front of [-1, 1]) callback(`drive${front < 0 ? 'F' : 'B'}${sideId(side)}`, side, front);
  };
  return [
    clip('idle', 3, (t, time, { set }) => {
      const idle = Math.sin(TAU * t);
      set('body', { p: [0, 0.018 * idle, 0], r: [0.012 * idle, 0.015 * Math.sin(TAU * t + 0.5), 0.012 * Math.cos(TAU * t)] });
      set('core', { r: [0, 0.16 * idle, 0] });
      set('crown', { r: [0, 0.08 * idle, 0] });
      set('siege', { r: [0.035 * idle, 0.04 * Math.cos(TAU * t), 0] });
      set('ram', { p: [0, 0, 0.018 * idle] });
      for (const config of modules) {
        set(config.key, { r: [0, config.side * 0.04 * idle, 0] });
        set(config.muzzle, { r: [0.035 * Math.sin(TAU * t + config.side), 0, 0] });
      }
      for (const side of SIDES) set(`gate${sideId(side)}`, { r: [0, -side * 0.025 * idle, 0] });
    }),
    clip('move', 2.2, (t, time, { set }) => {
      const roll = TAU * t;
      set('body', { p: [0, 0.025 * Math.cos(roll * 2), -0.035 * Math.sin(roll)], r: [0.025 * Math.sin(roll), 0, 0.025 * Math.cos(roll)] });
      set('siege', { r: [0.035 * Math.sin(roll + 0.5), -0.035 * Math.sin(roll), 0] });
      set('ram', { p: [0, 0, 0.035 * Math.sin(roll)] });
      set('crown', { r: [0.025 * Math.cos(roll), 0.07 * Math.sin(roll), 0] });
      eachDrive(key => set(key, { r: [TAU * 2 * t, 0, 0] }));
      for (const side of SIDES) set(`track${sideId(side)}`, { p: [0, 0.012 * Math.sin(roll + side), 0.018 * Math.sin(roll)] });
      for (const config of modules) {
        set(config.key, { r: [0, config.side * 0.06 * Math.sin(roll), 0] });
        set(config.muzzle, { r: [0.04 * Math.cos(roll + config.side), 0, 0] });
      }
    }),
    clip('attack', 1.6, (t, time, { set }) => {
      const slam = pulse(t, 0.12, 0.34, 0.7);
      set('body', { p: [0, -0.045 * slam, 0.12 * slam], r: [0.09 * slam, 0, 0] });
      set('siege', { r: [-0.13 * slam, 0, 0] });
      set('ram', { p: [0, 0, -0.48 * slam], r: [0.04 * slam, 0, 0] });
      set('core', { p: [0, 0, 0.07 * slam] });
      set('crown', { r: [0.12 * slam, -0.22 * slam, 0] });
      for (const side of SIDES) set(`gate${sideId(side)}`, { r: [0, -side * 0.32 * slam, 0] });
      for (const config of modules) set(config.muzzle, { r: [-0.14 * slam, 0, 0] });
      eachDrive(key => set(key, { r: [-0.35 * slam, 0, 0] }));
    }),
    clip('windup', 1.1, (t, time, { set, raw }) => {
      const charge = ease(t, 0, 0.9);
      set('body', { p: [0, -0.075 * charge, 0.07 * charge], r: [-0.065 * charge, 0, 0] });
      set('core', { p: [0, 0.1 * charge, 0], r: [0, 0.5 * charge, 0] });
      set('crown', { p: [0, 0.08 * charge, 0], r: [0, 0.4 * charge, 0] });
      set('siege', { r: [0.16 * charge, 0, 0] });
      set('ram', { p: [0, 0, 0.18 * charge] });
      for (const side of SIDES) set(`gate${sideId(side)}`, { r: [0, -side * 0.82 * charge, 0] });
      for (const config of modules) {
        set(config.key, { r: [0, config.side * 0.58 * charge, 0] });
        set(config.muzzle, { p: [0, 0.04 * charge, 0.08 * charge], r: [0.22 * charge, 0, 0] });
      }
      for (const config of anchors) set(config.key, { p: [0, -0.085 * charge, 0], r: [-config.front * 0.18 * charge, 0, config.side * 0.12 * charge] });
      raw('siegePulse', { p: [0, 0.055, -0.55], s: [0.02 + 0.85 * charge, 0.02 + 0.85 * charge, 0.02 + 0.85 * charge] });
    }),
    clip('release', 1.45, (t, time, { set, raw }) => {
      const impact = pulse(t, 0, 0.14, 0.66);
      const settle = ease(t, 0.6, 1);
      set('body', { p: [0, -0.06 * impact, 0.18 * impact * (1 - settle)], r: [0.13 * impact, 0, 0] });
      set('siege', { r: [-0.18 * impact, 0, 0] });
      set('ram', { p: [0, 0, -0.56 * impact] });
      set('core', { p: [0, -0.055 * impact, 0] });
      set('crown', { r: [0.18 * impact, 0.35 * impact, 0] });
      for (const side of SIDES) set(`gate${sideId(side)}`, { r: [0, -side * 0.4 * (1 - settle), 0] });
      for (const config of modules) {
        set(config.key, { r: [0, -config.side * 0.18 * impact, 0] });
        set(config.muzzle, { p: [0, 0, -0.17 * impact], r: [-0.18 * impact, 0, 0] });
      }
      for (const config of anchors) set(config.key, { p: [0, -0.085 * (1 - settle), 0], r: [-config.front * 0.16 * impact, 0, 0] });
      raw('siegePulse', { p: [0, 0.055, -0.55 - 0.55 * ease(t, 0, 0.82)], s: [0.02 + 5.4 * ease(t, 0, 0.82), 0.02 + 5.4 * ease(t, 0, 0.82), 0.02 + 5.4 * ease(t, 0, 0.82)] });
    }),
    clip('ability', 4.6, (t, time, { set, raw }) => {
      const warning = ease(t, 0, 0.24);
      const barrage = pulse(t, 0.23, 0.5, 0.84);
      const recover = ease(t, 0.8, 1);
      const deploy = warning * (1 - recover);
      const ramShot = pulse(t, 0.24, 0.33, 0.5);
      set('body', { p: [0, -0.085 * deploy, 0.12 * barrage], r: [0.07 * barrage, 0.025 * Math.sin(TAU * 3 * t) * barrage, 0] });
      set('core', { p: [0, 0.12 * deploy, 0], r: [0, TAU * t, 0] });
      set('crown', { p: [0, 0.1 * deploy, 0], r: [0, TAU * 0.75 * t, 0] });
      set('siege', { r: [0.18 * deploy - 0.35 * ramShot, 0, 0] });
      set('ram', { p: [0, 0, 0.16 * deploy - 0.65 * ramShot] });
      for (const side of SIDES) set(`gate${sideId(side)}`, { r: [0, -side * 0.9 * deploy, 0] });
      for (let index = 0; index < modules.length; index++) {
        const config = modules[index];
        const start = 0.32 + index * 0.075;
        const shot = pulse(t, start, start + 0.09, start + 0.25);
        set(config.key, { r: [0, config.side * (0.65 * deploy - 0.22 * shot), 0] });
        set(config.muzzle, { p: [0, 0.05 * deploy, 0.08 * deploy - 0.22 * shot], r: [0.24 * deploy - 0.45 * shot, 0, 0] });
      }
      for (const config of anchors) set(config.key, { p: [0, -0.085 * deploy, 0], r: [-config.front * 0.2 * deploy, 0, config.side * 0.12 * deploy] });
      eachDrive(key => set(key, { r: [-0.3 * barrage, 0, 0] }));
      raw('siegePulse', { p: [0, 0.055, -0.55 - 0.7 * ease(t, 0.27, 0.85)], s: [0.02 + 6.2 * barrage, 0.02 + 6.2 * barrage, 0.02 + 6.2 * barrage] });
    }),
    clip('shutdown', 3.5, (t, time, { set }) => {
      const fail = ease(t, 0.04, 0.76);
      const drop = ease(t, 0.25, 0.9);
      set('body', { p: [0, -0.25 * drop, 0.12 * drop], r: [0.21 * drop, -0.12 * fail, 0.14 * fail] });
      set('core', { p: [0, -0.2 * fail, 0.12 * fail], r: [0.55 * fail, -0.9 * fail, 0.3 * fail] });
      set('crown', { p: [0, -0.19 * fail, 0], r: [0.72 * fail, 0, -0.4 * fail] });
      set('siege', { r: [0.4 * drop, 0.18 * fail, 0] });
      set('ram', { p: [0, -0.12 * drop, 0.22 * fail], r: [0.28 * drop, 0, 0] });
      for (const side of SIDES) {
        set(`gate${sideId(side)}`, { r: [0, -side * 1.12 * fail, side * 0.38 * drop] });
        set(`track${sideId(side)}`, { p: [0, -0.025 * drop, 0], r: [0, 0, side * 0.06 * drop] });
      }
      for (const config of modules) {
        set(config.key, { p: [0, -0.08 * drop, 0], r: [0.2 * drop, -config.side * 0.75 * fail, config.side * 0.3 * drop] });
        set(config.muzzle, { p: [0, -0.06 * drop, 0.15 * fail], r: [0.65 * drop, 0, 0] });
      }
      for (const config of anchors) set(config.key, { p: [0, -0.07 * drop, 0], r: [config.front * 0.35 * drop, 0, -config.side * 0.4 * fail] });
      eachDrive((key, side, front) => set(key, { r: [front * 0.35 * fail, 0, 0] }));
    }),
  ];
}

export const entities = [
  defineEntity({
    id: 'bandwidth_requisitioner',
    name: '带宽征用阵列',
    kind: 'monster',
    role: 'boss',
    locomotion: 'articulated-ground-array',
    variants: PHASES,
    concept: '一座把信道当作税基行走的征用机构。四足液压底盘托举护门核心，前置双钳征收器与多层计量面板把不可见的带宽占用变成可见的机械动作。',
    mechanism: '预警时护门开启、信道面板外翻、双钳张开；释放时征收器前冲并锁定。三个阶段分别展开二、四、六块信道面板和逐级分叉的分配冠架，对应征用 6/8/10 带宽；第三阶段增加双征用副舱。卸载时面板折落、核心脱锁、四肢失力。',
    build: buildBandwidth,
    clips: bandwidthClips,
  }),
  defineEntity({
    id: 'chorus_overseer',
    name: '飞行合唱监管者',
    kind: 'monster',
    role: 'boss',
    locomotion: 'flight-hover',
    variants: PHASES,
    concept: '围绕悬浮调律核心组织的飞行合唱机构。每块翼面都是一组有声调的共鸣管，护盾瓣和冠架把不同翼面的振动强制并入同一拍。',
    mechanism: '差动翼面与磁悬浮环维持飞行；预警时翼面上抬、护盾瓣外展、侧向中继伸出，释放时翼面下击并展开共享护盾。阶段依次具有 2/4/6 块合唱翼面、3/4/5 块护盾瓣；第二阶段增加带宽干扰腹板，第三阶段增加上翼与干扰龙骨。卸载时翼面折垂、护盾瓣脱落展开、机体失压下沉。',
    build: buildChorus,
    clips: chorusClips,
  }),
  defineEntity({
    id: 'zero_frequency_mind',
    name: '零频攻城主脑',
    kind: 'monster',
    role: 'boss',
    locomotion: 'ground-tracked-siege',
    variants: PHASES,
    concept: '一台把静默写成攻城指令的移动主脑。重型履带承载笼架核心，中央冲压槌与周边零频投射器共用液压锚定系统，以实体冲击拆解构造与地形屏障。',
    mechanism: '履带推进，中央冲压槌执行直接攻击。攻城预警时液压锚足下钻、护门打开、投射臂转向并抬升；释放时冲压槌和多门投射器依次后座，地面冲击环扩散。三个阶段具有 3/4/5 个实体冲击投射机构（含中央槌），对应阶段目标数；冠架逐级扩展，第三阶段增加后锚足。卸载时炮架低垂、模块折回收缩、笼架核心脱出。',
    build: buildZero,
    clips: zeroClips,
  }),
];
