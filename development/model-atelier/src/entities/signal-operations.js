import * as THREE from '../../vendor/three/build/three.module.js';
import { defineEntity } from './contract.js';
import {
  palette, group, box, panel, cylinder, sphere, crystal, torus, arc, cable, rod,
  lathe, hull, bearing, fasteners, radial, mirrored, mergeStaticMeshes, mesh, annulusGeometry,
} from '../geometry.js';
import { TAU, ease, pulse, createRigClip } from '../animations.js';
import { addMechanicalLink, withMechanicalLinks } from './mechanical-links.js';

const CLIP_ORDER = ['idle', 'move', 'attack', 'windup', 'release', 'ability', 'shutdown'];
const CLIP_DURATIONS = { idle: 3.2, move: 0.9, attack: 1.25, windup: 1.5, release: 1.15, ability: 2.6, shutdown: 1.8 };

function createRig(id) {
  const root = new THREE.Group();
  root.name = `${id}_root`;
  return { id, root, joints: {} };
}

function addJoint(rig, parent, key, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const node = group(parent, `${rig.id}_${key}`, position, rotation);
  rig.joints[key] = node;
  return node;
}

function finishRig(rig) {
  mergeStaticMeshes(rig.root);
  return { root: rig.root, joints: rig.joints };
}

function animationSet(root, joints, poses, durations = {}) {
  return CLIP_ORDER.map(name => createRigClip(root, joints, name, durations[name] || CLIP_DURATIONS[name], withMechanicalLinks(root, joints, poses[name])));
}

function walkerLeg(rig, parent, key, x, z, materials, size = 1) {
  const side = Math.sign(x) || 1;
  const direction = Math.sign(z) || 1;
  const s = size;
  const hip = addJoint(rig, parent, `hip${key}`, [x, -0.12 * s, z]);
  bearing(hip, `${rig.id}_${key}_hip`, 0.12 * s, 0.15 * s, [0, 0, 0], materials, 'x');
  const kneePosition = [side * 0.08 * s, -0.26 * s, direction * 0.045 * s];
  rod(hip, `${rig.id}_${key}_upper_spar`, [0, 0, 0], kneePosition, 0.055 * s, materials.dark);
  box(hip, `${rig.id}_${key}_upper_armor`, [0.14 * s, 0.25 * s, 0.17 * s], [side * 0.035 * s, -0.125 * s, 0], materials.armor, [direction * 0.1, 0, -side * 0.24], 0.025 * s);
  const knee = addJoint(rig, hip, `knee${key}`, kneePosition);
  bearing(knee, `${rig.id}_${key}_knee`, 0.095 * s, 0.14 * s, [0, 0, 0], materials, 'x');
  const anklePosition = [side * 0.03 * s, -0.29 * s, -direction * 0.04 * s];
  rod(knee, `${rig.id}_${key}_lower_spar`, [0, 0, 0], anklePosition, 0.045 * s, materials.edge);
  box(knee, `${rig.id}_${key}_shin_guard`, [0.12 * s, 0.24 * s, 0.13 * s], [side * 0.015 * s, -0.14 * s, 0], materials.hull, [-direction * 0.08, 0, -side * 0.08], 0.02 * s);
  cable(knee, `${rig.id}_${key}_tendon`, [[-side * 0.055 * s, 0.02 * s, 0.04 * s], [-side * 0.075 * s, -0.14 * s, 0.07 * s], anklePosition], 0.014 * s, materials.accent);
  const foot = addJoint(rig, knee, `foot${key}`, anklePosition);
  bearing(foot, `${rig.id}_${key}_ankle`, 0.065 * s, 0.13 * s, [0, 0, 0], materials, 'x');
  box(foot, `${rig.id}_${key}_foot`, [0.22 * s, 0.12 * s, 0.3 * s], [0, -0.09 * s, -0.055 * s], materials.dark, [0, 0, 0], 0.025 * s);
  box(foot, `${rig.id}_${key}_toe`, [0.19 * s, 0.075 * s, 0.16 * s], [0, -0.072 * s, -0.19 * s], materials.armor, [0.06, 0, 0], 0.018 * s);
  fasteners(foot, `${rig.id}_${key}_toe_bolts`, [[-0.06 * s, -0.027 * s, -0.2 * s], [0.06 * s, -0.027 * s, -0.2 * s]], materials.edge, 'y', 0.014 * s);
}

function walkPose(api, keys, t, stride = 0.4, lift = 0.075) {
  keys.forEach((key, index) => {
    const phase = t * TAU + (index % 2 ? Math.PI : 0) + (index > 1 ? Math.PI : 0);
    const swing = Math.sin(phase);
    const raised = Math.max(0, swing);
    api.set(`hip${key}`, { r: [swing * stride, 0, 0] });
    api.set(`knee${key}`, { r: [-0.12 - raised * 0.48, 0, 0] });
    api.set(`foot${key}`, { r: [-swing * 0.22, 0, 0] });
  });
}

function foldPose(api, keys, amount, bodyDrop = 0.12) {
  keys.forEach((key, index) => {
    const direction = index % 2 ? -1 : 1;
    api.set(`hip${key}`, { r: [direction * 0.28 * amount, 0, 0] });
    api.set(`knee${key}`, { r: [0.72 * amount, 0, 0] });
    api.set(`foot${key}`, { p: [0, bodyDrop * amount, 0], r: [-direction * 0.25 * amount, 0, 0] });
  });
}

function pressureVessel(parent, name, position, radius, height, materials) {
  const vessel = group(parent, name, position);
  const r = radius, h = height;
  lathe(vessel, `${name}_bottle`, [
    [0, -h / 2], [r * 0.65, -h / 2], [r * 0.94, -h * 0.38], [r, -h * 0.2],
    [r, h * 0.2], [r * 0.94, h * 0.38], [r * 0.65, h / 2], [0, h / 2],
  ], [0, 0, 0], materials.hull, [0, 0, 0], 40);
  for (const y of [-h * 0.29, h * 0.29]) {
    torus(vessel, `${name}_band_${y}`, r * 1.015, r * 0.09, [0, y, 0], materials.edge, [Math.PI / 2, 0, 0]);
  }
  cylinder(vessel, `${name}_gauge`, r * 0.34, r * 0.34, h * 0.48, [0, 0, -r * 0.92], materials.glass, [0, 0, 0], 20);
  box(vessel, `${name}_bracket`, [r * 1.3, h * 0.54, r * 0.34], [0, 0, r * 0.83], materials.dark, [0, 0, 0], r * 0.1);
  return vessel;
}

function resonatorPipe(parent, name, x, z, height, radius, materials) {
  const r = radius, h = height;
  lathe(parent, `${name}_wall`, [[r * 0.68, 0], [r, 0], [r, h], [r * 0.68, h], [r * 0.68, 0]], [x, 0, z], materials.gold, [0, 0, 0], 32);
  torus(parent, `${name}_lip`, r * 0.86, r * 0.15, [x, h, z], materials.edge, [Math.PI / 2, 0, 0]);
  torus(parent, `${name}_foot`, r * 1.12, r * 0.14, [x, 0.035, z], materials.dark, [Math.PI / 2, 0, 0]);
  box(parent, `${name}_brace`, [r * 0.45, h * 0.55, r * 1.9], [x, h * 0.32, z + r * 0.7], materials.dark, [0, 0, 0], r * 0.12);
}

function wingPlate(parent, name, side, materials, size = 1) {
  const outline = mirrored([[0, -0.05], [0.32, -0.2], [0.76, -0.16], [0.96, 0.08], [0.58, 0.3], [0.08, 0.22]].map(([x, y]) => [x * size, y * size]), side);
  panel(parent, `${name}_main`, outline, 0.065 * size, [0, 0, 0], materials.hull, [Math.PI / 2, 0, 0], 0.018 * size);
  const inset = mirrored([[0.12, 0.01], [0.36, -0.1], [0.69, -0.07], [0.76, 0.05], [0.51, 0.18], [0.16, 0.14]].map(([x, y]) => [x * size, y * size]), side);
  panel(parent, `${name}_inset`, inset, 0.025 * size, [0, 0.043 * size, 0], materials.armor, [Math.PI / 2, 0, 0], 0.009 * size);
  rod(parent, `${name}_leading_spar`, [side * 0.06 * size, 0.055 * size, -0.03 * size], [side * 0.75 * size, 0.055 * size, -0.1 * size], 0.025 * size, materials.edge);
  rod(parent, `${name}_signal_spar`, [side * 0.17 * size, 0.065 * size, 0.11 * size], [side * 0.61 * size, 0.065 * size, 0.14 * size], 0.014 * size, materials.accent);
  fasteners(parent, `${name}_rivets`, [[side * 0.17 * size, 0.07 * size, 0.02 * size], [side * 0.4 * size, 0.07 * size, 0], [side * 0.62 * size, 0.07 * size, 0.04 * size]], materials.edge, 'y', 0.012 * size);
}

function buildPressureCantor() {
  const rig = createRig('pressure_cantor');
  const m = palette('enemy');
  const body = addJoint(rig, rig.root, 'body', [0, 0.82, 0]);
  hull(body, 'pressure_cantor_chamfered_resonance_hull', [
    { z: -0.52, w: 0.38, h: 0.28, y: 0.02 }, { z: -0.34, w: 0.72, h: 0.5 },
    { z: 0.28, w: 0.78, h: 0.56, y: 0.02 }, { z: 0.54, w: 0.46, h: 0.36, y: 0.04 },
  ], m.hull);
  box(body, 'pressure_cantor_belly', [0.48, 0.16, 0.68], [0, -0.25, 0.03], m.dark, [0, 0, 0], 0.04);
  for (const side of [-1, 1]) {
    box(body, `pressure_cantor_flank_${side}`, [0.12, 0.34, 0.62], [side * 0.37, 0.015, 0.04], m.armor, [0, 0, side * 0.08], 0.035);
    rod(body, `pressure_cantor_flank_rail_${side}`, [side * 0.39, 0.19, -0.3], [side * 0.39, 0.19, 0.34], 0.025, m.edge);
  }
  for (const [key, x, z] of [['FL', -0.29, -0.31], ['FR', 0.29, -0.31], ['BL', -0.3, 0.32], ['BR', 0.3, 0.32]]) {
    walkerLeg(rig, body, key, x, z, m);
  }
  const diaphragm = addJoint(rig, body, 'diaphragm', [0, -0.015, -0.46]);
  cylinder(diaphragm, 'pressure_cantor_diaphragm_seat', 0.245, 0.245, 0.15, [0, 0, 0], m.dark, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    torus(diaphragm, `pressure_cantor_bellows_${i}`, 0.19 - i * 0.018, 0.018, [0, 0, -0.08 - i * 0.035], i % 2 ? m.accent : m.gold);
  }
  sphere(diaphragm, 'pressure_cantor_pressure_membrane', 0.13, [0, 0, -0.13], m.glass, [1, 1, 0.35]);
  const voice = addJoint(rig, body, 'voice', [0, -0.01, -0.62]);
  cylinder(voice, 'pressure_cantor_voice_bell', 0.12, 0.2, 0.22, [0, 0, -0.04], m.hull, [Math.PI / 2, 0, 0]);
  torus(voice, 'pressure_cantor_voice_rim', 0.13, 0.026, [0, 0, -0.16], m.edge);
  crystal(voice, 'pressure_cantor_voice_core', 0.085, [0, 0, -0.17], m.core, [1, 1, 0.5]);
  const pressureRing = addJoint(rig, body, 'pressureRing', [0, 0, -0.79]);
  torus(pressureRing, 'pressure_cantor_pressure_wave_outer', 0.27, 0.012, [0, 0, 0], m.glass);
  torus(pressureRing, 'pressure_cantor_pressure_wave_inner', 0.2, 0.009, [0, 0, -0.025], m.accent);
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'L' : 'R';
    const fork = addJoint(rig, body, `fork${key}`, [side * 0.2, 0.12, -0.39]);
    bearing(fork, `pressure_cantor_fork_bearing_${key}`, 0.07, 0.1, [0, 0, 0], m, 'z');
    rod(fork, `pressure_cantor_fork_stem_${key}`, [0, 0, 0], [side * 0.04, 0.23, -0.04], 0.032, m.gold);
    for (const prong of [-1, 1]) {
      rod(fork, `pressure_cantor_tine_${key}_${prong}`, [side * 0.04 + prong * 0.05, 0.2, -0.04], [side * 0.04 + prong * 0.05, 0.43, -0.1], 0.022, m.edge);
      crystal(fork, `pressure_cantor_tine_tip_${key}_${prong}`, 0.035, [side * 0.04 + prong * 0.05, 0.43, -0.1], m.energy, [0.65, 1.2, 0.65]);
    }
  }
  const organ = addJoint(rig, body, 'organ', [0, 0.22, 0.23]);
  box(organ, 'pressure_cantor_organ_manifold', [0.7, 0.13, 0.32], [0, 0, 0.03], m.dark, [0, 0, 0], 0.035);
  const heights = [0.46, 0.62, 0.76, 0.62, 0.46];
  heights.forEach((height, index) => {
    const x = (index - 2) * 0.135;
    resonatorPipe(organ, `pressure_cantor_pipe_${index}`, x, 0.02, height, 0.052, m);
    const piston = addJoint(rig, organ, `piston${index}`, [x, 0.12, 0.02]);
    cylinder(piston, `pressure_cantor_piston_head_${index}`, 0.032, 0.032, 0.075, [0, 0, 0], m.accent, [0, 0, 0], 20);
    rod(piston, `pressure_cantor_piston_rod_${index}`, [0, -0.1, 0], [0, 0.02, 0], 0.012, m.edge);
  });
  for (const side of [-1, 1]) {
    rod(body, `pressure_cantor_organ_support_${side}`, [side * 0.28, 0.12, 0.25], [side * 0.28, 0.48, 0.28], 0.035, m.edge);
  }
  addMechanicalLink(rig.root, rig.joints, 'cantorVoiceGuide', {
    from: { node: body, point: [0, -0.01, -0.24] }, to: { node: voice, point: [0, 0, -0.025] },
    radius: 0.032, sleeveRadius: 0.067, sleeveLength: 0.13, materials: m,
  });
  return finishRig(rig);
}

function buildSignalSummoner() {
  const rig = createRig('signal_summoner');
  const m = palette('enemy');
  const body = addJoint(rig, rig.root, 'body', [0, 0.82, 0]);
  hull(body, 'signal_summoner_chamfered_carrier', [
    { z: -0.52, w: 0.44, h: 0.3 }, { z: -0.3, w: 0.8, h: 0.46 },
    { z: 0.35, w: 0.84, h: 0.52 }, { z: 0.58, w: 0.55, h: 0.37 },
  ], m.hull);
  box(body, 'signal_summoner_underframe', [0.58, 0.15, 0.82], [0, -0.24, 0.02], m.dark, [0, 0, 0], 0.035);
  for (const side of [-1, 1]) {
    box(body, `signal_summoner_side_armor_${side}`, [0.12, 0.29, 0.68], [side * 0.4, 0.03, 0.03], m.armor, [0, 0, side * 0.1], 0.03);
    cable(body, `signal_summoner_umbilical_${side}`, [[side * 0.29, 0.16, 0.3], [side * 0.5, 0.28, 0.12], [side * 0.34, 0.45, -0.02]], 0.025, m.accent);
  }
  for (const [key, x, z] of [['FL', -0.31, -0.31], ['FR', 0.31, -0.31], ['BL', -0.32, 0.34], ['BR', 0.32, 0.34]]) {
    walkerLeg(rig, body, key, x, z, m);
  }
  const pod = addJoint(rig, body, 'pod', [0, 0.25, 0.12]);
  cylinder(pod, 'signal_summoner_pod_socket', 0.36, 0.4, 0.14, [0, 0, 0], m.dark, [0, 0, 0], 48);
  torus(pod, 'signal_summoner_pod_lock', 0.33, 0.035, [0, 0.08, 0], m.edge, [Math.PI / 2, 0, 0]);
  cylinder(pod, 'signal_summoner_summoning_chamber', 0.275, 0.275, 0.6, [0, 0.37, 0], m.glass, [0, 0, 0], 48);
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4 + Math.PI / 4;
    const [x, , z] = radial(a, 0.29, 0);
    rod(pod, `signal_summoner_chamber_cage_${i}`, [x, 0.08, z], [x, 0.68, z], 0.025, m.gold);
  }
  const elevator = addJoint(rig, pod, 'elevator', [0, 0.11, 0]);
  cylinder(elevator, 'signal_summoner_elevator_plate', 0.23, 0.25, 0.075, [0, 0, 0], m.armor, [0, 0, 0], 40);
  torus(elevator, 'signal_summoner_elevator_coil', 0.18, 0.018, [0, 0.05, 0], m.accent, [Math.PI / 2, 0, 0]);
  const seed = addJoint(rig, elevator, 'seed', [0, 0.19, 0]);
  crystal(seed, 'signal_summoner_folded_signal', 0.14, [0, 0, 0], m.core, [0.8, 1.35, 0.8]);
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3;
    rod(seed, `signal_summoner_seed_cage_${i}`, [Math.sin(a) * 0.13, -0.13, Math.cos(a) * 0.13], [Math.sin(a) * 0.09, 0.15, Math.cos(a) * 0.09], 0.012, m.edge);
  }
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'L' : 'R';
    const door = addJoint(rig, pod, `door${key}`, [side * 0.27, 0.38, -0.205]);
    box(door, `signal_summoner_door_${key}`, [0.27, 0.57, 0.075], [-side * 0.135, 0, 0], m.armor, [0, 0, 0], 0.028);
    box(door, `signal_summoner_door_inset_${key}`, [0.16, 0.38, 0.035], [-side * 0.135, 0, -0.052], m.dark, [0, 0, 0], 0.015);
    rod(door, `signal_summoner_door_signal_${key}`, [-side * 0.2, -0.17, -0.075], [-side * 0.2, 0.17, -0.075], 0.012, m.accent);
    bearing(door, `signal_summoner_door_hinge_${key}`, 0.055, 0.45, [0, 0, 0], m, 'y');
  }
  const crown = addJoint(rig, pod, 'crown', [0, 0.71, 0]);
  mesh(crown, 'signal_summoner_open_crown', annulusGeometry(0.36, 0.285, 0.11, 40), m.hull);
  torus(crown, 'signal_summoner_crown_array', 0.34, 0.022, [0, 0.07, 0], m.accent, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3;
    rod(crown, `signal_summoner_crown_aerial_${i}`, [Math.sin(a) * 0.32, 0.04, Math.cos(a) * 0.32], [Math.sin(a) * 0.4, 0.28, Math.cos(a) * 0.4], 0.018, m.edge);
    crystal(crown, `signal_summoner_aerial_tip_${i}`, 0.035, [Math.sin(a) * 0.4, 0.28, Math.cos(a) * 0.4], m.energy);
  }
  const projector = addJoint(rig, body, 'projector', [0, -0.015, -0.5]);
  bearing(projector, 'signal_summoner_projector_gimbal', 0.19, 0.17, [0, 0, 0], m, 'x');
  cylinder(projector, 'signal_summoner_projector_throat', 0.13, 0.18, 0.22, [0, 0, -0.12], m.dark, [Math.PI / 2, 0, 0]);
  torus(projector, 'signal_summoner_projector_rim', 0.15, 0.024, [0, 0, -0.25], m.accent);
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3;
    const prong = addJoint(rig, projector, `prong${i}`, [Math.cos(a) * 0.14, Math.sin(a) * 0.14, -0.2], [0, 0, a]);
    rod(prong, `signal_summoner_prong_${i}`, [0, 0, 0], [0.07, 0, -0.23], 0.023, m.gold);
    crystal(prong, `signal_summoner_prong_tip_${i}`, 0.04, [0.07, 0, -0.23], m.energy, [0.7, 0.7, 1.4]);
  }
  const summonRing = addJoint(rig, body, 'summonRing', [0, -0.12, -0.91]);
  torus(summonRing, 'signal_summoner_arrival_ring', 0.28, 0.014, [0, 0, 0], m.glass);
  torus(summonRing, 'signal_summoner_arrival_trace', 0.22, 0.008, [0, 0, -0.02], m.accent);
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'L' : 'R';
    const cradle = addJoint(rig, body, `cradle${key}`, [side * 0.4, 0.02, -0.23]);
    bearing(cradle, `signal_summoner_cradle_bearing_${key}`, 0.085, 0.12, [0, 0, 0], m, 'z');
    rod(cradle, `signal_summoner_cradle_arm_${key}`, [0, 0, 0], [side * 0.1, -0.18, -0.22], 0.035, m.edge);
    box(cradle, `signal_summoner_cradle_paddle_${key}`, [0.13, 0.09, 0.24], [side * 0.1, -0.18, -0.26], m.armor, [0.2, 0, 0], 0.022);
  }
  addMechanicalLink(rig.root, rig.joints, 'summonerProjectorGuide', {
    from: { node: body, point: [0, -0.015, -0.22] }, to: { node: projector, point: [0, 0, -0.05] },
    radius: 0.022, sleeveRadius: 0.045, sleeveLength: 0.12, materials: m,
  });
  return finishRig(rig);
}

function buildResistanceCorruptor() {
  const rig = createRig('resistance_corruptor');
  const m = palette('enemy');
  const body = addJoint(rig, rig.root, 'body', [0, 1.3, 0]);
  hull(body, 'resistance_corruptor_flight_hull', [
    { z: -0.53, w: 0.25, h: 0.22, y: -0.02 }, { z: -0.3, w: 0.58, h: 0.4 },
    { z: 0.27, w: 0.64, h: 0.45, y: 0.02 }, { z: 0.55, w: 0.26, h: 0.25, y: 0.03 },
  ], m.hull);
  box(body, 'resistance_corruptor_dorsal_armor', [0.36, 0.13, 0.66], [0, 0.24, 0.04], m.armor, [0, 0, 0], 0.035);
  box(body, 'resistance_corruptor_ventral_keel', [0.17, 0.25, 0.56], [0, -0.25, 0.05], m.dark, [0.08, 0, 0], 0.025);
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'L' : 'R';
    const wing = addJoint(rig, body, `wing${key}`, [side * 0.27, 0.1, 0.02]);
    bearing(wing, `resistance_corruptor_wing_root_${key}`, 0.1, 0.16, [0, 0, 0], m, 'z');
    wingPlate(wing, `resistance_corruptor_wing_${key}`, side, m, 0.88);
    const tip = addJoint(rig, wing, `wingTip${key}`, [side * 0.65, 0, 0.075]);
    const tipOutline = mirrored([[0, -0.09], [0.26, -0.04], [0.42, 0.11], [0.19, 0.23], [0, 0.15]], side);
    panel(tip, `resistance_corruptor_wing_tip_${key}`, tipOutline, 0.045, [0, 0, 0], m.armor, [Math.PI / 2, 0, 0], 0.012);
    rod(tip, `resistance_corruptor_tip_signal_${key}`, [0, 0.04, 0.09], [side * 0.29, 0.04, 0.09], 0.012, m.accent);
    const tank = addJoint(rig, body, `tank${key}`, [side * 0.35, -0.16, 0.23]);
    pressureVessel(tank, `resistance_corruptor_fission_tank_${key}`, [0, 0, 0], 0.14, 0.48, m);
    rod(body, `resistance_corruptor_tank_outrigger_${key}`, [side * 0.22, 0.02, 0.16], [side * 0.35, -0.08, 0.23], 0.035, m.edge);
    const valve = addJoint(rig, tank, `valve${key}`, [0, 0.29, 0]);
    cylinder(valve, `resistance_corruptor_valve_stem_${key}`, 0.035, 0.045, 0.11, [0, 0, 0], m.gold, [0, 0, 0], 20);
    torus(valve, `resistance_corruptor_valve_wheel_${key}`, 0.075, 0.014, [0, 0.07, 0], m.accent, [Math.PI / 2, 0, 0]);
    cable(body, `resistance_corruptor_corrosion_feed_${key}`, [[side * 0.35, -0.24, 0.2], [side * 0.43, -0.3, -0.18], [side * 0.16, -0.11, -0.42]], 0.025, m.accent);
  }
  const tail = addJoint(rig, body, 'tail', [0, 0.03, 0.46]);
  for (const side of [-1, 1]) {
    const points = mirrored([[0, 0], [0.34, 0.06], [0.48, 0.28], [0.1, 0.2]], side);
    panel(tail, `resistance_corruptor_tailplane_${side}`, points, 0.04, [0, 0, 0], m.armor, [Math.PI / 2, 0, 0], 0.012);
  }
  rod(tail, 'resistance_corruptor_tail_stinger', [0, 0, 0.05], [0, -0.04, 0.48], 0.035, m.edge);
  crystal(tail, 'resistance_corruptor_stinger_tip', 0.07, [0, -0.04, 0.48], m.accent, [0.65, 0.65, 1.5]);
  const chamber = addJoint(rig, body, 'chamber', [0, -0.035, -0.43]);
  sphere(chamber, 'resistance_corruptor_cleavage_chamber', 0.2, [0, 0, 0], m.glass, [1, 0.85, 1.1]);
  torus(chamber, 'resistance_corruptor_chamber_band', 0.19, 0.026, [0, 0, 0], m.gold, [0, 0, 0]);
  const core = addJoint(rig, chamber, 'corrosionCore', [0, 0, 0]);
  crystal(core, 'resistance_corruptor_corrosive_culture', 0.115, [0, 0, 0], m.core, [1, 0.8, 1.15]);
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'Lower' : 'Upper';
    const jaw = addJoint(rig, chamber, `jaw${key}`, [0, side * 0.11, -0.045]);
    box(jaw, `resistance_corruptor_jaw_${key}`, [0.32, 0.095, 0.34], [0, side * 0.015, -0.09], m.armor, [side * 0.09, 0, 0], 0.025);
    for (const x of [-0.11, 0.11]) {
      rod(jaw, `resistance_corruptor_jaw_tooth_${key}_${x}`, [x, 0, -0.2], [x, -side * 0.07, -0.28], 0.018, m.edge);
    }
  }
  const nozzle = addJoint(rig, chamber, 'nozzle', [0, 0, -0.19]);
  cylinder(nozzle, 'resistance_corruptor_metering_nozzle', 0.055, 0.095, 0.24, [0, 0, -0.08], m.dark, [Math.PI / 2, 0, 0], 28);
  torus(nozzle, 'resistance_corruptor_nozzle_lip', 0.06, 0.015, [0, 0, -0.21], m.accent);
  const spray = addJoint(rig, nozzle, 'spray', [0, 0, -0.25]);
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5;
    crystal(spray, `resistance_corruptor_corrosion_drop_${i}`, 0.032 + i * 0.003, [Math.cos(a) * 0.07, Math.sin(a) * 0.055, -i * 0.09], m.energy, [0.7, 0.7, 1.8]);
  }
  addMechanicalLink(rig.root, rig.joints, 'corruptorNozzleGuide', {
    from: { node: chamber, point: [0, 0, 0.12] }, to: { node: nozzle, point: [0, 0, -0.035] },
    radius: 0.018, sleeveRadius: 0.04, sleeveLength: 0.10, materials: m,
  });
  return finishRig(rig);
}

function buildDetonationShell() {
  const rig = createRig('detonation_shell');
  const m = palette('enemy');
  const body = addJoint(rig, rig.root, 'body', [0, 0.615, 0]);
  hull(body, 'detonation_shell_inner_chassis', [
    { z: -0.38, w: 0.36, h: 0.3 }, { z: -0.2, w: 0.66, h: 0.44 },
    { z: 0.23, w: 0.68, h: 0.46 }, { z: 0.39, w: 0.38, h: 0.3 },
  ], m.dark);
  const core = addJoint(rig, body, 'core', [0, 0.035, 0]);
  sphere(core, 'detonation_shell_pressure_core', 0.265, [0, 0, 0], m.glass, [1, 0.92, 1]);
  crystal(core, 'detonation_shell_critical_mass', 0.17, [0, 0, 0], m.core, [1, 0.9, 1]);
  for (let i = 0; i < 3; i++) {
    torus(core, `detonation_shell_core_cage_${i}`, 0.27, 0.018, [0, 0, 0], m.gold, [i === 0 ? Math.PI / 2 : 0, i === 2 ? Math.PI / 2 : 0, 0]);
  }
  for (const [key, x, z] of [['FL', -0.225, -0.23], ['FR', 0.225, -0.23], ['BL', -0.23, 0.24], ['BR', 0.23, 0.24]]) {
    walkerLeg(rig, body, key, x, z, m, 0.75);
  }
  for (let i = 0; i < 6; i++) {
    const angle = i * TAU / 6;
    const shell = addJoint(rig, body, `shell${i}`, radial(angle, 0.05, 0.055), [0, angle, 0]);
    const shellPlate = group(shell, `detonation_shell_plate_carrier_${i}`, [0, 0, 0.14]);
    hull(shellPlate, `detonation_shell_overlapping_petal_${i}`, [
      { z: -0.17, w: 0.24, h: 0.12, y: 0.015, chamfer: 0.035 },
      { z: 0.08, w: 0.36, h: 0.19, y: 0.025, chamfer: 0.05 },
      { z: 0.37, w: 0.22, h: 0.13, y: 0, chamfer: 0.035 },
    ], i % 2 ? m.hull : m.armor);
    box(shellPlate, `detonation_shell_petal_ridge_${i}`, [0.09, 0.065, 0.36], [0, 0.125, 0.08], m.dark, [0.04, 0, 0], 0.016);
    rod(shellPlate, `detonation_shell_petal_seam_${i}`, [0, 0.165, -0.08], [0, 0.145, 0.26], 0.012, m.accent);
    fasteners(shellPlate, `detonation_shell_petal_bolts_${i}`, [[-0.09, 0.13, 0.02], [0.09, 0.13, 0.02]], m.edge, 'y', 0.016);
    bearing(shell, `detonation_shell_hinge_${i}`, 0.06, 0.24, [0, 0, 0], m, 'x');
    const bolt = addJoint(rig, shellPlate, `bolt${i}`, [0, 0, 0.33]);
    cylinder(bolt, `detonation_shell_ejection_bolt_${i}`, 0.035, 0.05, 0.18, [0, 0, 0.06], m.edge, [Math.PI / 2, 0, 0], 20);
    crystal(bolt, `detonation_shell_bolt_tip_${i}`, 0.055, [0, 0, 0.17], m.accent, [0.75, 0.75, 1.4]);
  }
  const fuse = addJoint(rig, body, 'fuse', [0, 0.27, 0.03]);
  cylinder(fuse, 'detonation_shell_fuse_socket', 0.15, 0.19, 0.12, [0, 0, 0], m.hull, [0, 0, 0], 32);
  torus(fuse, 'detonation_shell_fuse_lock', 0.14, 0.022, [0, 0.07, 0], m.edge, [Math.PI / 2, 0, 0]);
  const fusePin = addJoint(rig, fuse, 'fusePin', [0, 0.11, 0]);
  cylinder(fusePin, 'detonation_shell_pressure_plunger', 0.055, 0.07, 0.65, [0, -0.12, 0], m.gold, [0, 0, 0], 24);
  box(fusePin, 'detonation_shell_plunger_handle', [0.26, 0.07, 0.11], [0, 0.22, 0], m.armor, [0, 0, 0], 0.022);
  crystal(fusePin, 'detonation_shell_plunger_indicator', 0.045, [0, 0.27, 0], m.energy, [1, 0.7, 1]);
  const ram = addJoint(rig, body, 'ram', [0, -0.035, -0.39]);
  cylinder(ram, 'detonation_shell_impact_ram', 0.1, 0.16, 0.22, [0, 0, -0.08], m.hull, [Math.PI / 2, 0, 0], 32);
  torus(ram, 'detonation_shell_ram_rim', 0.105, 0.022, [0, 0, -0.21], m.accent);
  addMechanicalLink(rig.root, rig.joints, 'detonationRamGuide', {
    from: { node: body, point: [0, -0.035, -0.08] }, to: { node: ram, point: [0, 0, -0.03] },
    radius: 0.021, sleeveRadius: 0.044, sleeveLength: 0.09, materials: m,
  });
  const rupture = addJoint(rig, body, 'rupture', [0, 0.03, 0]);
  torus(rupture, 'detonation_shell_rupture_equator', 0.43, 0.012, [0, 0, 0], m.glass, [Math.PI / 2, 0, 0]);
  torus(rupture, 'detonation_shell_rupture_meridian', 0.38, 0.01, [0, 0, 0], m.glass, [0, Math.PI / 2, 0]);
  return finishRig(rig);
}

function buildProliferationProtocol() {
  const rig = createRig('proliferation_protocol');
  const m = palette('enemy');
  const body = addJoint(rig, rig.root, 'body', [0, 0.984, 0]);
  hull(body, 'proliferation_protocol_elite_hull', [
    { z: -0.61, w: 0.54, h: 0.38 }, { z: -0.38, w: 0.98, h: 0.62 },
    { z: 0.39, w: 1.02, h: 0.68, y: 0.03 }, { z: 0.66, w: 0.64, h: 0.45, y: 0.04 },
  ], m.hull);
  box(body, 'proliferation_protocol_reinforced_belly', [0.72, 0.2, 0.98], [0, -0.32, 0.03], m.dark, [0, 0, 0], 0.045);
  box(body, 'proliferation_protocol_dorsal_cuirass', [0.74, 0.16, 0.83], [0, 0.36, 0.08], m.armor, [0, 0, 0], 0.045);
  for (const side of [-1, 1]) {
    box(body, `proliferation_protocol_flank_armor_${side}`, [0.16, 0.42, 0.92], [side * 0.49, 0.015, 0.02], m.armor, [0, 0, side * 0.09], 0.04);
    rod(body, `proliferation_protocol_flank_rail_${side}`, [side * 0.53, 0.24, -0.4], [side * 0.53, 0.24, 0.45], 0.032, m.edge);
  }
  const legKeys = [];
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'L' : 'R';
    [-0.4, 0.02, 0.43].forEach((z, index) => {
      const key = `${label}${index}`;
      legKeys.push(key);
      walkerLeg(rig, body, key, side * 0.43, z, m, 1.2);
    });
  }
  const cell = addJoint(rig, body, 'cell', [0, 0.39, 0.12]);
  cylinder(cell, 'proliferation_protocol_cell_socket', 0.44, 0.49, 0.16, [0, 0, 0], m.dark, [0, 0, 0], 48);
  // Front and rear glazing leave the two lateral birth passages physically open.
  for (const [index, angle] of [[0, -Math.PI / 4], [1, Math.PI * 3 / 4]]) {
    mesh(cell, `proliferation_protocol_fission_glazing_${index}`,
      new THREE.CylinderGeometry(0.42, 0.42, 0.62, 24, 1, true, angle, Math.PI / 2), m.glass, [0, 0.36, 0]);
  }
  for (const y of [0.08, 0.64]) {
    torus(cell, `proliferation_protocol_chamber_band_${y}`, 0.42, 0.035, [0, y, 0], m.gold, [Math.PI / 2, 0, 0]);
  }
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4 + Math.PI / 4;
    const x = Math.sin(a) * 0.42, z = Math.cos(a) * 0.42;
    rod(cell, `proliferation_protocol_cell_cage_${i}`, [x, 0.04, z], [x, 0.68, z], 0.028, m.edge);
  }
  const divider = addJoint(rig, cell, 'divider', [0, 0.35, 0]);
  box(divider, 'proliferation_protocol_divider_blade', [0.035, 0.49, 0.47], [0, 0, 0], m.armor, [0, 0, 0], 0.012);
  rod(divider, 'proliferation_protocol_divider_signal', [0, -0.2, -0.245], [0, 0.2, -0.245], 0.012, m.accent);
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'A' : 'B';
    const daughter = addJoint(rig, cell, `daughter${key}`, [side * 0.185, 0.35, 0]);
    crystal(daughter, `proliferation_protocol_daughter_core_${key}`, 0.13, [0, 0, 0], m.core, [0.85, 1.25, 0.85]);
    torus(daughter, `proliferation_protocol_daughter_ring_${key}`, 0.14, 0.015, [0, 0, 0], m.accent, [Math.PI / 2, 0, 0]);
    for (const z of [-0.09, 0.09]) {
      rod(daughter, `proliferation_protocol_daughter_spine_${key}_${z}`, [0, -0.15, z], [0, 0.15, z], 0.012, m.edge);
    }
  }
  const crown = addJoint(rig, cell, 'crown', [0, 0.71, 0]);
  mesh(crown, 'proliferation_protocol_open_crown', annulusGeometry(0.46, 0.34, 0.12, 40), m.hull);
  torus(crown, 'proliferation_protocol_crown_bus', 0.44, 0.028, [0, 0.07, 0], m.accent, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    const vane = group(crown, `proliferation_protocol_crown_vane_${i}`, [Math.sin(a) * 0.43, 0.1, Math.cos(a) * 0.43], [0, a, 0]);
    panel(vane, `proliferation_protocol_crown_blade_${i}`, [[-0.07, 0], [0.07, 0], [0.12, 0.28], [0, 0.36], [-0.09, 0.24]], 0.045, [0, 0, 0], m.armor, [0, 0, 0], 0.012);
    crystal(vane, `proliferation_protocol_crown_node_${i}`, 0.035, [0, 0.31, 0], m.energy);
  }
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'L' : 'R';
    const vat = addJoint(rig, body, `vat${key}`, [side * 0.52, 0.23, 0.24]);
    pressureVessel(vat, `proliferation_protocol_nursery_vat_${key}`, [0, 0, 0], 0.18, 0.55, m);
    sphere(vat, `proliferation_protocol_vat_culture_${key}`, 0.12, [0, 0, -0.04], m.glass, [0.8, 1.45, 0.8]);
    crystal(vat, `proliferation_protocol_vat_embryo_${key}`, 0.075, [0, 0, -0.13], m.energy, [0.8, 1.35, 0.8]);
    const podGate = addJoint(rig, vat, `podGate${key}`, [side * 0.17, 0.3, 0]);
    bearing(podGate, `proliferation_protocol_vat_lid_hinge_${key}`, 0.045, 0.31, [0, 0, 0], m, 'z');
    box(podGate, `proliferation_protocol_vat_lid_${key}`, [0.3, 0.08, 0.31], [-side * 0.17, 0, 0], m.armor, [0, 0, 0], 0.025);
    rod(podGate, `proliferation_protocol_lid_handle_${key}`, [-side * 0.17 - 0.09, 0.07, 0], [-side * 0.17 + 0.09, 0.07, 0], 0.018, m.accent);
    cable(body, `proliferation_protocol_nursery_feed_${key}`, [[side * 0.24, 0.42, 0.18], [side * 0.55, 0.5, 0.02], [side * 0.52, 0.3, 0.24]], 0.024, m.accent);
    const cradle = addJoint(rig, body, `cradle${key}`, [side * 0.47, -0.04, -0.23]);
    bearing(cradle, `proliferation_protocol_birth_arm_${key}`, 0.11, 0.17, [0, 0, 0], m, 'z');
    rod(cradle, `proliferation_protocol_birth_spar_${key}`, [0, 0, 0], [side * 0.14, -0.2, -0.26], 0.045, m.edge);
    box(cradle, `proliferation_protocol_birth_scoop_${key}`, [0.2, 0.11, 0.3], [side * 0.14, -0.2, -0.31], m.armor, [0.25, 0, 0], 0.025);
    const gate = addJoint(rig, body, `gate${key}`, [side * 0.43, -0.02, -0.52]);
    bearing(gate, `proliferation_protocol_birth_door_hinge_${key}`, 0.06, 0.36, [0, 0, 0], m, 'y');
    box(gate, `proliferation_protocol_birth_door_${key}`, [0.42, 0.36, 0.1], [-side * 0.215, 0, 0], m.armor, [0, 0, 0], 0.035);
    box(gate, `proliferation_protocol_birth_door_inset_${key}`, [0.25, 0.2, 0.035], [-side * 0.215, 0, -0.065], m.dark, [0, 0, 0], 0.018);
    const ejector = addJoint(rig, body, `ejector${key}`, [side * 0.23, -0.08, -0.56]);
    cylinder(ejector, `proliferation_protocol_ejection_tube_${key}`, 0.07, 0.1, 0.24, [0, 0, -0.09], m.dark, [Math.PI / 2, 0, 0], 28);
    torus(ejector, `proliferation_protocol_ejection_rim_${key}`, 0.073, 0.017, [0, 0, -0.22], m.accent);
    crystal(ejector, `proliferation_protocol_ejected_signal_${key}`, 0.065, [0, 0, -0.25], m.core, [0.85, 0.85, 1.35]);
    addMechanicalLink(rig.root, rig.joints, `proliferationEjector${key}`, {
      from: { node: body, point: [side * 0.23, -0.08, -0.25] }, to: { node: ejector, point: [0, 0, -0.035] },
      radius: 0.02, sleeveRadius: 0.045, sleeveLength: 0.10, materials: m,
    });
  }
  return finishRig(rig);
}

function buildSpiritTaxer() {
  const rig = createRig('spirit_taxer');
  const m = palette('enemy');
  const body = addJoint(rig, rig.root, 'body', [0, 1.3, 0]);
  hull(body, 'spirit_taxer_armored_flight_frame', [
    { z: -0.57, w: 0.32, h: 0.3 }, { z: -0.34, w: 0.72, h: 0.54 },
    { z: 0.29, w: 0.82, h: 0.62, y: 0.02 }, { z: 0.57, w: 0.43, h: 0.38 },
  ], m.hull);
  box(body, 'spirit_taxer_dorsal_cuirass', [0.5, 0.16, 0.73], [0, 0.32, 0.03], m.armor, [0, 0, 0], 0.04);
  box(body, 'spirit_taxer_keel', [0.25, 0.3, 0.68], [0, -0.33, 0.02], m.dark, [0.06, 0, 0], 0.035);
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'L' : 'R';
    box(body, `spirit_taxer_cheek_armor_${key}`, [0.14, 0.36, 0.54], [side * 0.37, 0.02, -0.08], m.armor, [0, 0, side * 0.12], 0.032);
    const wing = addJoint(rig, body, `wing${key}`, [side * 0.35, 0.1, 0.08]);
    bearing(wing, `spirit_taxer_wing_bearing_${key}`, 0.13, 0.2, [0, 0, 0], m, 'z');
    wingPlate(wing, `spirit_taxer_flight_wing_${key}`, side, m, 1.02);
    const tip = addJoint(rig, wing, `wingTip${key}`, [side * 0.76, 0, 0.1]);
    const points = mirrored([[0, -0.11], [0.28, -0.03], [0.45, 0.18], [0.23, 0.34], [0, 0.21]], side);
    panel(tip, `spirit_taxer_articulated_wingtip_${key}`, points, 0.055, [0, 0, 0], m.hull, [Math.PI / 2, 0, 0], 0.015);
    rod(tip, `spirit_taxer_wingtip_bus_${key}`, [side * 0.04, 0.05, 0.11], [side * 0.31, 0.05, 0.14], 0.015, m.accent);
    const collector = addJoint(rig, body, `collector${key}`, [side * 0.31, -0.08, -0.31]);
    bearing(collector, `spirit_taxer_collector_shoulder_${key}`, 0.1, 0.15, [0, 0, 0], m, 'z');
    rod(collector, `spirit_taxer_collection_arm_${key}`, [0, 0, 0], [side * 0.11, -0.12, -0.28], 0.045, m.edge);
    box(collector, `spirit_taxer_collection_arm_armor_${key}`, [0.15, 0.14, 0.28], [side * 0.07, -0.07, -0.14], m.armor, [0.25, 0, -side * 0.15], 0.025);
    const claw = addJoint(rig, collector, `claw${key}`, [side * 0.11, -0.12, -0.31]);
    bearing(claw, `spirit_taxer_claw_wrist_${key}`, 0.085, 0.13, [0, 0, 0], m, 'x');
    box(claw, `spirit_taxer_claw_palm_${key}`, [0.22, 0.14, 0.2], [0, 0, -0.1], m.dark, [0, 0, 0], 0.025);
    for (const fingerSide of [-1, 1]) {
      const fingerKey = `finger${key}${fingerSide < 0 ? 'A' : 'B'}`;
      const finger = addJoint(rig, claw, fingerKey, [fingerSide * 0.09, 0, -0.16]);
      box(finger, `spirit_taxer_${fingerKey}_proximal`, [0.065, 0.13, 0.25], [0, 0, -0.09], m.gold, [0, -fingerSide * 0.12, 0], 0.018);
      rod(finger, `spirit_taxer_${fingerKey}_hook`, [0, 0, -0.19], [-fingerSide * 0.07, 0, -0.3], 0.025, m.edge);
      crystal(finger, `spirit_taxer_${fingerKey}_tip`, 0.04, [-fingerSide * 0.07, 0, -0.3], m.accent, [0.7, 0.7, 1.4]);
    }
    addMechanicalLink(rig.root, rig.joints, `taxerCollector${key}`, {
      from: { node: body, point: [side * 0.27, -0.08, 0.04] }, to: { node: collector, point: [0, 0, 0.025] },
      radius: 0.022, sleeveRadius: 0.047, sleeveLength: 0.10, materials: m,
    });
  }
  const tail = addJoint(rig, body, 'tail', [0, 0.03, 0.47]);
  panel(tail, 'spirit_taxer_vertical_rudder', [[-0.09, 0], [0.09, 0], [0.06, 0.48], [-0.04, 0.58]], 0.08, [0, 0, 0.12], m.armor, [0, Math.PI / 2, 0], 0.02);
  rod(tail, 'spirit_taxer_rudder_spine', [0, 0, 0], [0, 0.02, 0.55], 0.032, m.edge);
  const ledger = addJoint(rig, body, 'ledger', [0, -0.32, 0.04]);
  for (const side of [-1, 1]) bearing(body, `spirit_taxer_ledger_journal_${side}`, 0.10, 0.08, [side * 0.31, -0.32, 0.04], m, 'x');
  cylinder(ledger, 'spirit_taxer_assessment_drum', 0.19, 0.19, 0.52, [0, 0, 0], m.dark, [0, 0, Math.PI / 2], 40);
  for (const x of [-0.29, -0.18, 0, 0.18, 0.29]) {
    torus(ledger, `spirit_taxer_ledger_band_${x}`, 0.195, 0.018, [x, 0, 0], Math.abs(x) > 0.2 ? m.edge : m.gold, [0, Math.PI / 2, 0]);
  }
  for (let i = 0; i < 10; i++) {
    const a = i * TAU / 10;
    box(ledger, `spirit_taxer_ledger_tooth_${i}`, [0.39, 0.035, 0.07], [0, Math.sin(a) * 0.19, Math.cos(a) * 0.19], m.armor, [a, 0, 0], 0.008);
  }
  const scale = addJoint(rig, body, 'scale', [0, 0.36, 0.08]);
  rod(scale, 'spirit_taxer_balance_column', [0, 0, 0], [0, 0.39, 0], 0.045, m.gold);
  crystal(scale, 'spirit_taxer_balance_fulcrum', 0.1, [0, 0.39, 0], m.accent, [1, 0.8, 0.8]);
  const scaleBeam = addJoint(rig, scale, 'scaleBeam', [0, 0.4, 0]);
  rod(scaleBeam, 'spirit_taxer_balance_beam', [-0.48, 0, 0], [0.48, 0, 0], 0.035, m.edge);
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'L' : 'R';
    const pan = addJoint(rig, scaleBeam, `pan${key}`, [side * 0.43, 0, 0]);
    bearing(pan, `spirit_taxer_pan_gimbal_${key}`, 0.055, 0.1, [0, 0, 0], m, 'z');
    for (const z of [-0.09, 0.09]) {
      rod(pan, `spirit_taxer_pan_chain_${key}_${z}`, [0, 0, z * 0.25], [0, -0.27, z], 0.012, m.gold);
    }
    lathe(pan, `spirit_taxer_weighing_pan_${key}`, [[0, -0.04], [0.13, -0.04], [0.19, 0.015], [0.2, 0.04], [0.17, 0.04], [0.12, -0.015], [0, -0.015]], [0, -0.29, 0], m.armor, [0, 0, 0], 40);
    crystal(pan, `spirit_taxer_assessed_spirit_${key}`, 0.055, [0, -0.22, 0], m.energy, [1, 0.7, 1]);
  }
  const iris = addJoint(rig, body, 'iris', [0, 0.015, -0.5]);
  cylinder(iris, 'spirit_taxer_levy_throat', 0.22, 0.26, 0.16, [0, 0, 0], m.dark, [Math.PI / 2, 0, 0], 40);
  torus(iris, 'spirit_taxer_levy_rim', 0.23, 0.03, [0, 0, -0.1], m.gold);
  torus(iris, 'spirit_taxer_levy_signal', 0.17, 0.014, [0, 0, -0.125], m.accent);
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4;
    const shutter = addJoint(rig, iris, `shutter${i}`, [Math.sin(a) * 0.12, Math.cos(a) * 0.12, -0.12], [0, 0, -a]);
    panel(shutter, `spirit_taxer_iris_shutter_${i}`, [[-0.065, -0.04], [0.065, -0.04], [0.09, 0.12], [0, 0.18], [-0.07, 0.1]], 0.035, [0, -0.055, 0], m.armor, [0, 0, 0], 0.009);
  }
  const tokenStream = addJoint(rig, iris, 'tokenStream', [0, 0, -0.2]);
  for (let i = 0; i < 5; i++) {
    const token = addJoint(rig, tokenStream, `token${i}`, [(i % 2 ? 1 : -1) * 0.035, (i - 2) * 0.045, -i * 0.1]);
    crystal(token, `spirit_taxer_levied_token_${i}`, 0.037, [0, 0, 0], i % 2 ? m.core : m.energy, [1, 1, 0.45], [0, 0, i * 0.5]);
  }
  return finishRig(rig);
}

function pressureCantorClips(root, joints) {
  const legs = ['FL', 'FR', 'BL', 'BR'];
  return animationSet(root, joints, {
    idle(t, time, api) {
      const breath = Math.sin(t * TAU * 2);
      api.set('body', { p: [0, breath * 0.012, 0], r: [breath * 0.012, 0, 0] });
      api.set('diaphragm', { s: [1 + breath * 0.025, 1 + breath * 0.025, 1 - breath * 0.04] });
      api.set('voice', { r: [breath * 0.025, 0, 0] });
      api.set('organ', { r: [breath * 0.018, 0, 0] });
      for (let i = 0; i < 5; i++) api.set(`piston${i}`, { p: [0, Math.sin(t * TAU * 2 + i * 0.7) * 0.025, 0] });
      api.set('forkL', { r: [0, 0, breath * 0.025] });
      api.set('forkR', { r: [0, 0, -breath * 0.025] });
      api.set('pressureRing', { s: [1 + breath * 0.035, 1 + breath * 0.035, 1] });
    },
    move(t, time, api) {
      walkPose(api, legs, t, 0.42, 0.075);
      api.set('body', { p: [0, Math.abs(Math.sin(t * TAU)) * 0.035, 0], r: [0.025, 0, Math.sin(t * TAU) * 0.025] });
      api.set('organ', { r: [-0.04 + Math.sin(t * TAU * 2) * 0.025, 0, 0] });
      api.set('diaphragm', { s: [1.03, 1.03, 0.96] });
      for (let i = 0; i < 5; i++) api.set(`piston${i}`, { p: [0, Math.sin(t * TAU * 2 + i) * 0.018, 0] });
    },
    attack(t, time, api) {
      const charge = ease(t, 0, 0.36) * (1 - ease(t, 0.65, 1));
      const blast = pulse(t, 0.28, 0.46, 0.82);
      api.set('diaphragm', { p: [0, 0, charge * 0.08 - blast * 0.09], s: [1 + charge * 0.18, 1 + charge * 0.18, 1 - charge * 0.25 + blast * 0.4] });
      api.set('voice', { p: [0, 0, charge * 0.09 - blast * 0.17], r: [-blast * 0.12, 0, 0] });
      api.set('forkL', { r: [-blast * 0.32, 0, -charge * 0.32 + blast * 0.48] });
      api.set('forkR', { r: [-blast * 0.32, 0, charge * 0.32 - blast * 0.48] });
      api.set('pressureRing', { p: [0, 0, -blast * 0.28], s: [1 + blast * 0.8, 1 + blast * 0.8, 1] });
      for (let i = 0; i < 5; i++) api.set(`piston${i}`, { p: [0, charge * (0.04 + i * 0.008) - blast * 0.09, 0] });
    },
    windup(t, time, api) {
      const charge = ease(t, 0, 1);
      api.set('body', { p: [0, charge * 0.035, charge * 0.035], r: [-charge * 0.07, 0, 0] });
      api.set('organ', { r: [-charge * 0.16, 0, 0] });
      api.set('diaphragm', { p: [0, 0, charge * 0.09], s: [1 + charge * 0.28, 1 + charge * 0.28, 1 - charge * 0.32] });
      api.set('voice', { p: [0, 0, charge * 0.13] });
      api.set('forkL', { r: [charge * 0.15, 0, -charge * 0.52] });
      api.set('forkR', { r: [charge * 0.15, 0, charge * 0.52] });
      api.set('pressureRing', { p: [0, 0, charge * 0.13], s: [1 - charge * 0.35, 1 - charge * 0.35, 1] });
      for (let i = 0; i < 5; i++) api.set(`piston${i}`, { p: [0, charge * (0.07 + Math.sin(i * 1.3) * 0.045), 0] });
    },
    release(t, time, api) {
      const snap = ease(t, 0, 0.18) * (1 - ease(t, 0.68, 1));
      const wave = ease(t, 0.08, 0.78) * (1 - ease(t, 0.82, 1));
      api.set('body', { p: [0, -snap * 0.025, snap * 0.06], r: [snap * 0.07, 0, 0] });
      api.set('organ', { r: [snap * 0.2, 0, 0] });
      api.set('diaphragm', { p: [0, 0, -snap * 0.13], s: [1 - snap * 0.18, 1 - snap * 0.18, 1 + snap * 0.65] });
      api.set('voice', { p: [0, 0, -snap * 0.2 + wave * 0.06], r: [-snap * 0.2, 0, 0] });
      api.set('forkL', { r: [-snap * 0.55, 0, snap * 0.62] });
      api.set('forkR', { r: [-snap * 0.55, 0, -snap * 0.62] });
      api.set('pressureRing', { p: [0, 0, -wave * 0.55], s: [0.75 + wave * 2.2, 0.75 + wave * 2.2, 1] });
      for (let i = 0; i < 5; i++) api.set(`piston${i}`, { p: [0, -snap * (0.11 + i * 0.008), 0] });
    },
    ability(t, time, api) {
      const charge = ease(t, 0, 0.48) * (1 - ease(t, 0.82, 1));
      const blast = pulse(t, 0.45, 0.59, 0.9);
      const wave = ease(t, 0.5, 0.9) * (1 - ease(t, 0.92, 1));
      api.set('body', { p: [0, charge * 0.04 - blast * 0.03, charge * 0.04 + blast * 0.05], r: [-charge * 0.08 + blast * 0.12, 0, 0] });
      api.set('organ', { r: [-charge * 0.18 + blast * 0.34, 0, 0] });
      api.set('diaphragm', { p: [0, 0, charge * 0.09 - blast * 0.16], s: [1 + charge * 0.28 - blast * 0.35, 1 + charge * 0.28 - blast * 0.35, 1 - charge * 0.3 + blast * 0.9] });
      api.set('voice', { p: [0, 0, charge * 0.13 - blast * 0.24], r: [-blast * 0.22, 0, 0] });
      api.set('forkL', { r: [-blast * 0.58, 0, -charge * 0.52 + blast * 0.98] });
      api.set('forkR', { r: [-blast * 0.58, 0, charge * 0.52 - blast * 0.98] });
      api.set('pressureRing', { p: [0, 0, charge * 0.12 - wave * 0.68], s: [1 - charge * 0.3 + wave * 2.4, 1 - charge * 0.3 + wave * 2.4, 1] });
      for (let i = 0; i < 5; i++) api.set(`piston${i}`, { p: [0, charge * (0.08 + i * 0.008) - blast * (0.16 + i * 0.008), 0] });
    },
    shutdown(t, time, api) {
      const k = ease(t, 0, 1);
      foldPose(api, legs, k, 0.14);
      api.set('body', { p: [0, -0.14 * k, 0.04 * k], r: [0.16 * k, 0, 0] });
      api.set('organ', { r: [0.62 * k, 0, 0] });
      api.set('diaphragm', { p: [0, 0, 0.11 * k], s: [1 - 0.22 * k, 1 - 0.22 * k, 1 - 0.3 * k] });
      api.set('voice', { p: [0, -0.06 * k, 0.15 * k], r: [0.5 * k, 0, 0] });
      api.set('forkL', { r: [0.82 * k, 0, -0.22 * k] });
      api.set('forkR', { r: [0.82 * k, 0, 0.22 * k] });
      api.set('pressureRing', { p: [0, 0, 0.18 * k], s: [1 - 0.8 * k, 1 - 0.8 * k, 1] });
      for (let i = 0; i < 5; i++) api.set(`piston${i}`, { p: [0, -(0.08 + i * 0.012) * k, 0], r: [0.18 * k, 0, 0] });
    },
  });
}

function signalSummonerClips(root, joints) {
  const legs = ['FL', 'FR', 'BL', 'BR'];
  const doorPose = (api, open) => {
    api.set('doorL', { r: [0, open * 1.28, 0] });
    api.set('doorR', { r: [0, -open * 1.28, 0] });
  };
  const prongPose = (api, open, thrust = 0) => {
    for (let i = 0; i < 3; i++) api.set(`prong${i}`, { p: [0, 0, -thrust], r: [0, 0, open * (i % 2 ? -0.28 : 0.28)] });
  };
  return animationSet(root, joints, {
    idle(t, time, api) {
      const wave = Math.sin(t * TAU);
      api.set('body', { p: [0, wave * 0.012, 0] });
      api.set('pod', { r: [wave * 0.012, 0, wave * 0.015] });
      api.set('elevator', { p: [0, 0.018 * Math.sin(t * TAU * 2), 0] });
      api.set('seed', { r: [0, t * TAU, 0], s: [1 + wave * 0.04, 1 - wave * 0.035, 1 + wave * 0.04] });
      api.set('crown', { r: [0, Math.sin(t * TAU) * 0.14, 0] });
      api.set('projector', { r: [wave * 0.035, 0, 0] });
      prongPose(api, 0.08 + wave * 0.04);
    },
    move(t, time, api) {
      walkPose(api, legs, t, 0.35, 0.065);
      api.set('body', { p: [0, Math.abs(Math.sin(t * TAU)) * 0.028, 0], r: [0.025, 0, Math.sin(t * TAU) * 0.02] });
      api.set('pod', { r: [-0.035, Math.sin(t * TAU) * 0.025, 0] });
      api.set('crown', { r: [0, -Math.sin(t * TAU) * 0.08, 0] });
      api.set('cradleL', { r: [Math.sin(t * TAU) * 0.12, 0, 0] });
      api.set('cradleR', { r: [-Math.sin(t * TAU) * 0.12, 0, 0] });
    },
    attack(t, time, api) {
      const aim = ease(t, 0, 0.35) * (1 - ease(t, 0.7, 1));
      const cast = pulse(t, 0.27, 0.48, 0.82);
      api.set('projector', { p: [0, 0, aim * 0.08 - cast * 0.16], r: [-aim * 0.18 + cast * 0.24, 0, 0] });
      prongPose(api, aim * 0.65 - cast * 0.4, cast * 0.11);
      api.set('summonRing', { p: [0, 0, -cast * 0.25], s: [0.7 + cast * 0.85, 0.7 + cast * 0.85, 1] });
      api.set('cradleL', { r: [-aim * 0.35 + cast * 0.45, 0, -aim * 0.18] });
      api.set('cradleR', { r: [-aim * 0.35 + cast * 0.45, 0, aim * 0.18] });
      api.set('seed', { r: [0, cast * 1.2, 0] });
    },
    windup(t, time, api) {
      const charge = ease(t, 0, 1);
      doorPose(api, charge);
      api.set('pod', { r: [-charge * 0.09, 0, 0] });
      api.set('elevator', { p: [0, charge * 0.2, 0] });
      api.set('seed', { p: [0, charge * 0.08, 0], r: [0, charge * TAU, 0], s: [1 + charge * 0.25, 1 + charge * 0.35, 1 + charge * 0.25] });
      api.set('crown', { r: [0, charge * 1.4, 0] });
      api.set('projector', { r: [-charge * 0.25, 0, 0] });
      prongPose(api, charge * 0.75, charge * 0.06);
      api.set('summonRing', { p: [0, 0, charge * 0.2], s: [1 - charge * 0.45, 1 - charge * 0.45, 1] });
      api.set('cradleL', { r: [-charge * 0.55, 0, -charge * 0.25] });
      api.set('cradleR', { r: [-charge * 0.55, 0, charge * 0.25] });
    },
    release(t, time, api) {
      const open = 1 - ease(t, 0.68, 1);
      const eject = ease(t, 0, 0.28) * (1 - ease(t, 0.7, 1));
      const arrival = ease(t, 0.12, 0.8) * (1 - ease(t, 0.84, 1));
      doorPose(api, open);
      api.set('elevator', { p: [0, 0.2 * open + eject * 0.18, 0] });
      // The signal rises through the clear crown bore before translating forward.
      api.set('seed', { p: [0, eject * 0.7, -ease(eject, 0.95, 1) * 0.35], r: [0, eject * TAU, 0], s: [1 + eject * 0.4, 1 + eject * 0.55, 1 + eject * 0.4] });
      api.set('crown', { r: [0, open * 1.4 + eject * 0.8, 0] });
      api.set('projector', { p: [0, 0, -eject * 0.16], r: [eject * 0.28, 0, 0] });
      prongPose(api, open * 0.6, eject * 0.18);
      api.set('summonRing', { p: [0, -arrival * 0.08, -arrival * 0.5], s: [0.55 + arrival * 2.1, 0.55 + arrival * 2.1, 1] });
      api.set('cradleL', { r: [eject * 0.62, 0, -open * 0.25] });
      api.set('cradleR', { r: [eject * 0.62, 0, open * 0.25] });
    },
    ability(t, time, api) {
      const charge = ease(t, 0, 0.43);
      const open = charge * (1 - ease(t, 0.8, 1));
      const eject = pulse(t, 0.4, 0.58, 0.88);
      const arrival = ease(t, 0.5, 0.88) * (1 - ease(t, 0.9, 1));
      doorPose(api, open);
      api.set('pod', { r: [-charge * 0.09 + eject * 0.15, 0, 0] });
      api.set('elevator', { p: [0, open * 0.2 + eject * 0.2, 0] });
      api.set('seed', { p: [0, open * 0.08 + eject * 0.7, -ease(eject, 0.95, 1) * 0.35], r: [0, charge * TAU + eject * TAU, 0], s: [1 + open * 0.25 + eject * 0.25, 1 + open * 0.35 + eject * 0.35, 1 + open * 0.25 + eject * 0.25] });
      api.set('crown', { r: [0, charge * 1.5 + eject * 1.2, 0] });
      api.set('projector', { p: [0, 0, -eject * 0.18], r: [-open * 0.25 + eject * 0.48, 0, 0] });
      prongPose(api, open * 0.75, eject * 0.2);
      api.set('summonRing', { p: [0, -arrival * 0.08, open * 0.18 - arrival * 0.65], s: [1 - open * 0.4 + arrival * 2.25, 1 - open * 0.4 + arrival * 2.25, 1] });
      api.set('cradleL', { r: [-open * 0.55 + eject * 1.05, 0, -open * 0.25] });
      api.set('cradleR', { r: [-open * 0.55 + eject * 1.05, 0, open * 0.25] });
    },
    shutdown(t, time, api) {
      const k = ease(t, 0, 1);
      foldPose(api, legs, k, 0.15);
      api.set('body', { p: [0, -0.15 * k, 0.04 * k], r: [0.13 * k, 0, 0] });
      api.set('pod', { r: [0.34 * k, 0, 0] });
      doorPose(api, -0.12 * k);
      api.set('elevator', { p: [0, -0.085 * k, 0] });
      api.set('seed', { p: [0, -0.1 * k, 0], r: [0.4 * k, 0, 0], s: [1 - 0.65 * k, 1 - 0.65 * k, 1 - 0.65 * k] });
      api.set('crown', { p: [0, -0.09 * k, 0], r: [0.62 * k, 0, 0.12 * k] });
      api.set('projector', { p: [0, -0.06 * k, 0.13 * k], r: [0.65 * k, 0, 0] });
      prongPose(api, -0.2 * k, -0.09 * k);
      api.set('summonRing', { p: [0, 0, 0.25 * k], s: [1 - 0.88 * k, 1 - 0.88 * k, 1] });
      api.set('cradleL', { r: [0.8 * k, 0, 0.2 * k] });
      api.set('cradleR', { r: [0.8 * k, 0, -0.2 * k] });
    },
  });
}

function resistanceCorruptorClips(root, joints) {
  const wingPose = (api, flap, sweep = 0, tipFlex = 0) => {
    for (const [key, side] of [['L', -1], ['R', 1]]) {
      api.set(`wing${key}`, { r: [0, -side * sweep, side * flap] });
      api.set(`wingTip${key}`, { r: [0, side * sweep * 0.5, side * tipFlex] });
    }
  };
  const jawPose = (api, open) => {
    api.set('jawUpper', { r: [open * 0.58, 0, 0] });
    api.set('jawLower', { r: [-open * 0.58, 0, 0] });
  };
  return animationSet(root, joints, {
    idle(t, time, api) {
      const hover = Math.sin(t * TAU * 2);
      api.set('body', { p: [0, hover * 0.035, 0], r: [hover * 0.018, 0, Math.sin(t * TAU) * 0.025] });
      wingPose(api, Math.sin(t * TAU * 4) * 0.12, 0, Math.sin(t * TAU * 4 + 0.5) * 0.09);
      api.set('tankL', { r: [hover * 0.025, 0, -0.025] });
      api.set('tankR', { r: [-hover * 0.025, 0, 0.025] });
      api.set('valveL', { r: [0, Math.sin(t * TAU) * 0.12, 0] });
      api.set('valveR', { r: [0, -Math.sin(t * TAU) * 0.12, 0] });
      api.set('tail', { r: [Math.sin(t * TAU * 2) * 0.05, Math.sin(t * TAU) * 0.08, 0] });
      api.set('corrosionCore', { r: [0, t * TAU, 0], s: [1 + hover * 0.05, 1 - hover * 0.04, 1 + hover * 0.05] });
    },
    move(t, time, api) {
      const flap = Math.sin(t * TAU * 2);
      api.set('body', { p: [0, Math.abs(flap) * 0.055, -0.035], r: [0.09 + flap * 0.025, 0, Math.sin(t * TAU) * 0.04] });
      wingPose(api, flap * 0.42, 0.12, -flap * 0.28 + 0.08);
      api.set('tankL', { r: [-0.08 + flap * 0.05, 0, -0.06] });
      api.set('tankR', { r: [-0.08 - flap * 0.05, 0, 0.06] });
      api.set('tail', { r: [-0.12, Math.sin(t * TAU) * 0.12, 0] });
      api.set('nozzle', { p: [0, 0, 0.035], r: [-0.08, 0, 0] });
    },
    attack(t, time, api) {
      const aim = ease(t, 0, 0.35) * (1 - ease(t, 0.72, 1));
      const spit = pulse(t, 0.3, 0.47, 0.78);
      wingPose(api, -aim * 0.18 + spit * 0.24, aim * 0.2, aim * 0.2);
      jawPose(api, aim * 0.5 + spit * 0.45);
      api.set('corrosionCore', { s: [1 + aim * 0.25 - spit * 0.2, 1 + aim * 0.25 - spit * 0.2, 1 + aim * 0.25 + spit * 0.25] });
      api.set('nozzle', { p: [0, 0, aim * 0.06 - spit * 0.22], r: [aim * 0.12 - spit * 0.2, 0, 0] });
      api.set('spray', { p: [0, 0, -spit * 0.38], s: [0.4 + spit * 0.85, 0.4 + spit * 0.85, 0.5 + spit * 1.4] });
      api.set('tankL', { r: [spit * 0.16, 0, -aim * 0.12] });
      api.set('tankR', { r: [spit * 0.16, 0, aim * 0.12] });
    },
    windup(t, time, api) {
      const charge = ease(t, 0, 1);
      api.set('body', { p: [0, charge * 0.08, charge * 0.07], r: [-charge * 0.13, 0, 0] });
      wingPose(api, -charge * 0.32, charge * 0.38, charge * 0.38);
      jawPose(api, charge * 0.82);
      api.set('chamber', { p: [0, 0, charge * 0.07], s: [1 + charge * 0.12, 1 + charge * 0.12, 1 - charge * 0.08] });
      api.set('corrosionCore', { r: [charge * 0.4, charge * TAU, 0], s: [1 + charge * 0.55, 1 + charge * 0.4, 1 + charge * 0.55] });
      api.set('nozzle', { p: [0, 0, charge * 0.13] });
      api.set('spray', { p: [0, 0, charge * 0.16], s: [1 - charge * 0.75, 1 - charge * 0.75, 1 - charge * 0.75] });
      for (const [key, side] of [['L', -1], ['R', 1]]) {
        api.set(`tank${key}`, { p: [0, charge * 0.06, 0], r: [-charge * 0.25, 0, side * charge * 0.18] });
        api.set(`valve${key}`, { p: [0, charge * 0.05, 0], r: [0, side * charge * 2.4, 0] });
      }
      api.set('tail', { r: [charge * 0.24, 0, 0] });
    },
    release(t, time, api) {
      const blast = ease(t, 0, 0.2) * (1 - ease(t, 0.72, 1));
      const stream = ease(t, 0.08, 0.72) * (1 - ease(t, 0.8, 1));
      api.set('body', { p: [0, -blast * 0.04, blast * 0.11], r: [blast * 0.16, 0, 0] });
      wingPose(api, blast * 0.36, (1 - blast) * 0.28, -blast * 0.32);
      jawPose(api, 0.8 + blast * 0.2 - ease(t, 0.7, 1) * 0.8);
      api.set('chamber', { p: [0, 0, -blast * 0.08], s: [1 - blast * 0.15, 1 - blast * 0.15, 1 + blast * 0.28] });
      api.set('corrosionCore', { r: [blast * 0.8, blast * 2.2, 0], s: [1.45 - blast * 0.6, 1.35 - blast * 0.5, 1.45 - blast * 0.4] });
      api.set('nozzle', { p: [0, 0, -blast * 0.25], r: [-blast * 0.18, 0, 0] });
      api.set('spray', { p: [0, 0, -stream * 0.65], r: [0, 0, stream * 0.8], s: [0.3 + stream * 1.25, 0.3 + stream * 1.25, 0.4 + stream * 2] });
      for (const [key, side] of [['L', -1], ['R', 1]]) {
        api.set(`tank${key}`, { r: [blast * 0.34, 0, side * blast * 0.2] });
        api.set(`valve${key}`, { p: [0, -blast * 0.08, 0], r: [0, side * (2.4 + blast * 2.2), 0] });
      }
    },
    ability(t, time, api) {
      const charge = ease(t, 0, 0.47) * (1 - ease(t, 0.84, 1));
      const blast = pulse(t, 0.44, 0.57, 0.86);
      const stream = ease(t, 0.5, 0.88) * (1 - ease(t, 0.9, 1));
      api.set('body', { p: [0, charge * 0.08 - blast * 0.07, charge * 0.07 + blast * 0.12], r: [-charge * 0.13 + blast * 0.29, 0, 0] });
      wingPose(api, -charge * 0.32 + blast * 0.65, charge * 0.38, charge * 0.38 - blast * 0.7);
      jawPose(api, charge * 0.82 + blast * 0.18);
      api.set('chamber', { p: [0, 0, charge * 0.07 - blast * 0.14], s: [1 + charge * 0.12 - blast * 0.3, 1 + charge * 0.12 - blast * 0.3, 1 - charge * 0.08 + blast * 0.42] });
      api.set('corrosionCore', { r: [blast * 0.8, charge * TAU + blast * 2.2, 0], s: [1 + charge * 0.55 - blast * 0.65, 1 + charge * 0.4 - blast * 0.5, 1 + charge * 0.55 - blast * 0.3] });
      api.set('nozzle', { p: [0, 0, charge * 0.13 - blast * 0.39], r: [-blast * 0.2, 0, 0] });
      api.set('spray', { p: [0, 0, charge * 0.15 - stream * 0.78], r: [0, 0, stream], s: [0.25 + stream * 1.35, 0.25 + stream * 1.35, 0.3 + stream * 2.3] });
      for (const [key, side] of [['L', -1], ['R', 1]]) {
        api.set(`tank${key}`, { p: [0, charge * 0.06 - blast * 0.08, 0], r: [-charge * 0.25 + blast * 0.58, 0, side * (charge * 0.18 + blast * 0.2)] });
        api.set(`valve${key}`, { p: [0, charge * 0.05 - blast * 0.12, 0], r: [0, side * (charge * 2.4 + blast * 3), 0] });
      }
      api.set('tail', { r: [charge * 0.24 - blast * 0.32, 0, 0] });
    },
    shutdown(t, time, api) {
      const k = ease(t, 0, 1);
      api.set('body', { p: [0, -0.13 * k, 0.06 * k], r: [0.22 * k, 0, -0.08 * k] });
      wingPose(api, -0.92 * k, 0.55 * k, -0.65 * k);
      jawPose(api, -0.12 * k);
      api.set('chamber', { p: [0, -0.04 * k, 0.08 * k], s: [1 - 0.18 * k, 1 - 0.18 * k, 1 - 0.18 * k] });
      api.set('corrosionCore', { s: [1 - 0.82 * k, 1 - 0.82 * k, 1 - 0.82 * k] });
      api.set('nozzle', { p: [0, 0, 0.17 * k], r: [0.5 * k, 0, 0] });
      api.set('spray', { p: [0, 0, 0.2 * k], s: [1 - 0.96 * k, 1 - 0.96 * k, 1 - 0.96 * k] });
      for (const [key, side] of [['L', -1], ['R', 1]]) {
        api.set(`tank${key}`, { p: [0, -0.1 * k, 0], r: [0.5 * k, 0, side * 0.24 * k] });
        api.set(`valve${key}`, { p: [0, -0.09 * k, 0], r: [0.65 * k, side * 1.2 * k, 0] });
      }
      api.set('tail', { r: [0.72 * k, 0, 0] });
    },
  }, { move: 0.72, idle: 2.8 });
}

function detonationShellClips(root, joints) {
  const legs = ['FL', 'FR', 'BL', 'BR'];
  const shellPose = (api, amounts, boltTravel = 0) => {
    for (let i = 0; i < 6; i++) {
      const open = Array.isArray(amounts) ? amounts[i] : amounts;
      api.set(`shell${i}`, { r: [-open * (0.82 + (i % 2) * 0.12), 0, 0] });
      api.set(`bolt${i}`, { p: [0, 0, open * 0.025 + boltTravel * (0.85 + i * 0.045)], r: [boltTravel * 0.5, 0, 0] });
    }
  };
  return animationSet(root, joints, {
    idle(t, time, api) {
      const beat = Math.sin(t * TAU * 3);
      api.set('body', { p: [0, beat * 0.009, 0] });
      api.set('core', { r: [0, t * TAU * 0.25, 0], s: [1 + beat * 0.035, 1 + beat * 0.035, 1 + beat * 0.035] });
      api.set('fusePin', { p: [0, beat * 0.018, 0] });
      api.set('ram', { r: [beat * 0.02, 0, 0] });
      for (let i = 0; i < 6; i++) api.set(`shell${i}`, { r: [Math.sin(t * TAU * 2 + i * 0.65) * 0.012, 0, 0] });
      api.set('rupture', { s: [1 + beat * 0.025, 1 + beat * 0.025, 1 + beat * 0.025] });
    },
    move(t, time, api) {
      walkPose(api, legs, t, 0.52, 0.07);
      api.set('body', { p: [0, Math.abs(Math.sin(t * TAU)) * 0.045, 0], r: [0.055, 0, Math.sin(t * TAU) * 0.035] });
      api.set('core', { r: [0.08, t * TAU, 0] });
      api.set('fuse', { r: [-0.06 + Math.sin(t * TAU * 2) * 0.04, 0, 0] });
      api.set('fusePin', { p: [0, Math.sin(t * TAU * 2) * 0.025, 0] });
      for (let i = 0; i < 6; i++) api.set(`shell${i}`, { r: [Math.sin(t * TAU + i) * 0.035, 0, 0] });
    },
    attack(t, time, api) {
      const brace = ease(t, 0, 0.32) * (1 - ease(t, 0.72, 1));
      const hit = pulse(t, 0.28, 0.45, 0.75);
      api.set('body', { p: [0, -brace * 0.025, brace * 0.05], r: [-brace * 0.08 + hit * 0.16, 0, 0] });
      api.set('ram', { p: [0, 0, brace * 0.1 - hit * 0.27], r: [-hit * 0.18, 0, 0] });
      api.set('fusePin', { p: [0, brace * 0.1 - hit * 0.17, 0], r: [hit * 0.25, 0, 0] });
      api.set('core', { s: [1 + brace * 0.2 - hit * 0.12, 1 + brace * 0.2 - hit * 0.12, 1 + brace * 0.2 + hit * 0.25] });
      shellPose(api, brace * 0.18 + hit * 0.16, hit * 0.04);
      api.set('rupture', { p: [0, 0, -hit * 0.2], s: [0.75 + hit * 0.75, 0.75 + hit * 0.75, 0.75 + hit * 0.75] });
    },
    windup(t, time, api) {
      const charge = ease(t, 0, 1);
      const opens = Array.from({ length: 6 }, (_, i) => ease(t, i * 0.035, 0.78 + i * 0.035));
      api.set('body', { p: [0, -charge * 0.045, charge * 0.03], r: [-charge * 0.09, 0, 0] });
      api.set('core', { r: [charge * 0.5, charge * TAU, 0], s: [1 + charge * 0.48, 1 + charge * 0.48, 1 + charge * 0.48] });
      api.set('fuse', { r: [-charge * 0.16, 0, 0] });
      api.set('fusePin', { p: [0, -charge * 0.16, 0], s: [1, 1 - charge * 0.28, 1] });
      api.set('ram', { p: [0, 0, charge * 0.13] });
      shellPose(api, opens, charge * 0.025);
      api.set('rupture', { s: [1 - charge * 0.45, 1 - charge * 0.45, 1 - charge * 0.45] });
    },
    release(t, time, api) {
      const open = 1 - ease(t, 0.7, 1);
      const blast = pulse(t, 0, 0.17, 0.7);
      const shock = ease(t, 0.03, 0.7) * (1 - ease(t, 0.74, 1));
      api.set('body', { p: [0, blast * 0.08, blast * 0.06], r: [blast * 0.18, 0, 0] });
      api.set('core', { r: [blast * 1.2, open * TAU + blast * 2, 0], s: [1 + open * 0.42 - blast * 0.5, 1 + open * 0.42 - blast * 0.5, 1 + open * 0.42 - blast * 0.35] });
      api.set('fuse', { r: [blast * 0.32, 0, 0] });
      api.set('fusePin', { p: [0, -open * 0.15 + blast * 0.32, 0], r: [blast * 0.35, 0, 0], s: [1, 1 + blast * 0.35, 1] });
      api.set('ram', { p: [0, 0, open * 0.12 - blast * 0.17] });
      shellPose(api, open * 0.85 + blast * 0.55, blast * 0.46);
      api.set('rupture', { p: [0, shock * 0.06, 0], s: [0.55 + shock * 2.75, 0.55 + shock * 2.75, 0.55 + shock * 2.75] });
    },
    ability(t, time, api) {
      const charge = ease(t, 0, 0.46) * (1 - ease(t, 0.83, 1));
      const blast = pulse(t, 0.43, 0.56, 0.84);
      const shock = ease(t, 0.48, 0.86) * (1 - ease(t, 0.88, 1));
      api.set('body', { p: [0, -charge * 0.045 + blast * 0.12, charge * 0.03 + blast * 0.06], r: [-charge * 0.09 + blast * 0.3, 0, 0] });
      api.set('core', { r: [blast * 1.2, charge * TAU + blast * 2, 0], s: [1 + charge * 0.48 - blast * 0.55, 1 + charge * 0.48 - blast * 0.55, 1 + charge * 0.48 - blast * 0.35] });
      api.set('fuse', { r: [-charge * 0.16 + blast * 0.48, 0, 0] });
      api.set('fusePin', { p: [0, -charge * 0.16 + blast * 0.48, 0], r: [blast * 0.4, 0, 0], s: [1, 1 - charge * 0.25 + blast * 0.65, 1] });
      api.set('ram', { p: [0, 0, charge * 0.13 - blast * 0.25] });
      shellPose(api, charge * 0.88 + blast * 0.52, blast * 0.52);
      api.set('rupture', { s: [1 - charge * 0.45 + shock * 2.85, 1 - charge * 0.45 + shock * 2.85, 1 - charge * 0.45 + shock * 2.85] });
    },
    shutdown(t, time, api) {
      const k = ease(t, 0, 1);
      foldPose(api, legs, k, 0.13);
      api.set('body', { p: [0, -0.13 * k, 0.04 * k], r: [0.22 * k, 0, 0.08 * k] });
      api.set('core', { p: [0, -0.08 * k, 0], s: [1 - 0.78 * k, 1 - 0.78 * k, 1 - 0.78 * k] });
      api.set('fuse', { r: [0.55 * k, 0, 0] });
      api.set('fusePin', { p: [0, -0.19 * k, 0], r: [0.4 * k, 0, 0], s: [1, 1 - 0.45 * k, 1] });
      api.set('ram', { p: [0, -0.04 * k, 0.16 * k], r: [0.55 * k, 0, 0] });
      for (let i = 0; i < 6; i++) {
        api.set(`shell${i}`, { r: [0.34 * k, 0, (i % 2 ? -1 : 1) * 0.08 * k] });
        api.set(`bolt${i}`, { p: [0, -0.035 * k, -0.13 * k], r: [0.65 * k, 0, 0] });
      }
      api.set('rupture', { s: [1 - 0.93 * k, 1 - 0.93 * k, 1 - 0.93 * k] });
    },
  }, { move: 0.68, windup: 1.25, release: 1.05 });
}

function proliferationProtocolClips(root, joints) {
  const legs = ['L0', 'R0', 'L1', 'R1', 'L2', 'R2'];
  const gatePose = (api, open) => {
    for (const [key, side] of [['L', -1], ['R', 1]]) {
      api.set(`gate${key}`, { r: [0, -side * open * 1.18, 0] });
      api.set(`podGate${key}`, { r: [0, 0, -side * open * 1.05] });
      api.set(`vat${key}`, { r: [0, 0, side * open * 0.09] });
    }
  };
  const daughterPose = (api, split, lift = 0) => {
    api.set('daughterA', { p: [-split * 0.19, 0, -lift * 0.15], r: [0, -split * 1.2, split * 0.08] });
    api.set('daughterB', { p: [split * 0.19, 0, -lift * 0.15], r: [0, split * 1.2, -split * 0.08] });
  };
  return animationSet(root, joints, {
    idle(t, time, api) {
      const beat = Math.sin(t * TAU * 2);
      api.set('body', { p: [0, beat * 0.012, 0] });
      api.set('cell', { r: [beat * 0.012, 0, 0] });
      daughterPose(api, 0.06 + beat * 0.025, Math.sin(t * TAU) * 0.012);
      api.set('divider', { p: [0, beat * 0.015, 0] });
      api.set('crown', { r: [0, Math.sin(t * TAU) * 0.18, 0] });
      api.set('vatL', { r: [0, 0, beat * 0.015] });
      api.set('vatR', { r: [0, 0, -beat * 0.015] });
      api.set('cradleL', { r: [beat * 0.035, 0, 0] });
      api.set('cradleR', { r: [-beat * 0.035, 0, 0] });
    },
    move(t, time, api) {
      walkPose(api, legs, t, 0.32, 0.085);
      api.set('body', { p: [0, Math.abs(Math.sin(t * TAU)) * 0.035, 0], r: [0.025, 0, Math.sin(t * TAU) * 0.018] });
      api.set('cell', { r: [-0.025, Math.sin(t * TAU) * 0.025, 0] });
      api.set('crown', { r: [0.04, -Math.sin(t * TAU) * 0.1, 0] });
      daughterPose(api, 0.08, Math.sin(t * TAU * 2) * 0.02);
      api.set('cradleL', { r: [Math.sin(t * TAU) * 0.1, 0, 0] });
      api.set('cradleR', { r: [-Math.sin(t * TAU) * 0.1, 0, 0] });
    },
    attack(t, time, api) {
      const brace = ease(t, 0, 0.34) * (1 - ease(t, 0.72, 1));
      const hit = pulse(t, 0.28, 0.47, 0.8);
      gatePose(api, brace * 0.28 + hit * 0.32);
      api.set('cradleL', { p: [0, 0, -hit * 0.16], r: [-brace * 0.5 + hit * 0.9, 0, -brace * 0.18] });
      api.set('cradleR', { p: [0, 0, -hit * 0.16], r: [-brace * 0.5 + hit * 0.9, 0, brace * 0.18] });
      api.set('ejectorL', { p: [0, 0, -hit * 0.15], r: [-hit * 0.12, 0, 0] });
      api.set('ejectorR', { p: [0, 0, -hit * 0.15], r: [-hit * 0.12, 0, 0] });
      api.set('divider', { p: [0, hit * 0.12, 0] });
      daughterPose(api, brace * 0.3, hit * 0.05);
      api.set('crown', { r: [-hit * 0.12, hit * 0.8, 0] });
    },
    windup(t, time, api) {
      const charge = ease(t, 0, 1);
      api.set('body', { p: [0, charge * 0.045, charge * 0.035], r: [-charge * 0.055, 0, 0] });
      api.set('cell', { p: [0, charge * 0.04, 0], s: [1 + charge * 0.08, 1 + charge * 0.1, 1 + charge * 0.08] });
      daughterPose(api, charge, charge * 0.04);
      api.set('divider', { p: [0, charge * 0.38, 0], r: [0, 0, charge * 0.12] });
      api.set('crown', { p: [0, charge * 0.08, 0], r: [-charge * 0.1, charge * TAU, 0] });
      gatePose(api, charge);
      api.set('cradleL', { r: [-charge * 0.58, 0, -charge * 0.28] });
      api.set('cradleR', { r: [-charge * 0.58, 0, charge * 0.28] });
      api.set('ejectorL', { p: [0, 0, charge * 0.12], s: [1 - charge * 0.15, 1 - charge * 0.15, 1 - charge * 0.15] });
      api.set('ejectorR', { p: [0, 0, charge * 0.12], s: [1 - charge * 0.15, 1 - charge * 0.15, 1 - charge * 0.15] });
    },
    release(t, time, api) {
      const open = 1 - ease(t, 0.72, 1);
      const birth = ease(t, 0, 0.25) * (1 - ease(t, 0.72, 1));
      gatePose(api, open);
      daughterPose(api, open + birth * 0.45, open * 0.04 + birth * 0.18);
      api.set('divider', { p: [0, open * 0.38 + birth * 0.16, 0], r: [birth * 0.3, 0, open * 0.12] });
      api.set('cell', { p: [0, open * 0.04 - birth * 0.05, 0], s: [1 + open * 0.08 - birth * 0.12, 1 + open * 0.1 + birth * 0.15, 1 + open * 0.08 - birth * 0.12] });
      api.set('crown', { r: [birth * 0.2, open * TAU + birth * 1.8, 0] });
      api.set('cradleL', { p: [0, birth * 0.06, -birth * 0.16], r: [-open * 0.58 + birth * 1.05, 0, -open * 0.28] });
      api.set('cradleR', { p: [0, birth * 0.06, -birth * 0.16], r: [-open * 0.58 + birth * 1.05, 0, open * 0.28] });
      api.set('ejectorL', { p: [-birth * 0.08, birth * 0.05, -birth * 0.36], r: [-birth * 0.18, -birth * 0.18, 0], s: [1 + birth * 0.3, 1 + birth * 0.3, 1 + birth * 0.65] });
      api.set('ejectorR', { p: [birth * 0.08, birth * 0.05, -birth * 0.36], r: [-birth * 0.18, birth * 0.18, 0], s: [1 + birth * 0.3, 1 + birth * 0.3, 1 + birth * 0.65] });
    },
    ability(t, time, api) {
      const charge = ease(t, 0, 0.44);
      const open = charge * (1 - ease(t, 0.82, 1));
      const birth = pulse(t, 0.41, 0.58, 0.88);
      api.set('body', { p: [0, charge * 0.045 - birth * 0.04, charge * 0.035 + birth * 0.04], r: [-charge * 0.055 + birth * 0.1, 0, 0] });
      api.set('cell', { p: [0, open * 0.04 - birth * 0.06, 0], s: [1 + open * 0.08 - birth * 0.12, 1 + open * 0.1 + birth * 0.18, 1 + open * 0.08 - birth * 0.12] });
      daughterPose(api, open + birth * 0.45, open * 0.04 + birth * 0.2);
      api.set('divider', { p: [0, open * 0.38 + birth * 0.18, 0], r: [birth * 0.32, 0, open * 0.12] });
      api.set('crown', { p: [0, open * 0.08, 0], r: [-open * 0.1 + birth * 0.32, charge * TAU + birth * 2, 0] });
      gatePose(api, open);
      api.set('cradleL', { p: [0, birth * 0.07, -birth * 0.18], r: [-open * 0.58 + birth * 1.15, 0, -open * 0.28] });
      api.set('cradleR', { p: [0, birth * 0.07, -birth * 0.18], r: [-open * 0.58 + birth * 1.15, 0, open * 0.28] });
      api.set('ejectorL', { p: [-birth * 0.1, birth * 0.06, open * 0.12 - birth * 0.48], r: [-birth * 0.2, -birth * 0.22, 0], s: [1 + birth * 0.35, 1 + birth * 0.35, 1 + birth * 0.75] });
      api.set('ejectorR', { p: [birth * 0.1, birth * 0.06, open * 0.12 - birth * 0.48], r: [-birth * 0.2, birth * 0.22, 0], s: [1 + birth * 0.35, 1 + birth * 0.35, 1 + birth * 0.75] });
    },
    shutdown(t, time, api) {
      const k = ease(t, 0, 1);
      foldPose(api, legs, k, 0.18);
      api.set('body', { p: [0, -0.18 * k, 0.05 * k], r: [0.14 * k, 0, 0] });
      api.set('cell', { p: [0, -0.08 * k, 0], r: [0.38 * k, 0, 0], s: [1 - 0.14 * k, 1 - 0.18 * k, 1 - 0.14 * k] });
      daughterPose(api, -0.16 * k, -0.16 * k);
      api.set('daughterA', { p: [0.03 * k, -0.16 * k, 0], r: [0.5 * k, 0, 0], s: [1 - 0.72 * k, 1 - 0.72 * k, 1 - 0.72 * k] });
      api.set('daughterB', { p: [-0.03 * k, -0.16 * k, 0], r: [0.5 * k, 0, 0], s: [1 - 0.72 * k, 1 - 0.72 * k, 1 - 0.72 * k] });
      api.set('divider', { p: [0, -0.29 * k, 0], r: [0.65 * k, 0, 0] });
      api.set('crown', { p: [0, -0.13 * k, 0], r: [0.68 * k, 0, 0.14 * k] });
      gatePose(api, -0.15 * k);
      api.set('cradleL', { r: [0.88 * k, 0, 0.28 * k] });
      api.set('cradleR', { r: [0.88 * k, 0, -0.28 * k] });
      api.set('ejectorL', { p: [0, -0.08 * k, 0.18 * k], r: [0.6 * k, 0, 0], s: [1 - 0.55 * k, 1 - 0.55 * k, 1 - 0.55 * k] });
      api.set('ejectorR', { p: [0, -0.08 * k, 0.18 * k], r: [0.6 * k, 0, 0], s: [1 - 0.55 * k, 1 - 0.55 * k, 1 - 0.55 * k] });
    },
  }, { idle: 3.6, move: 1.05, windup: 1.8, ability: 3.1 });
}

function spiritTaxerClips(root, joints) {
  const wingPose = (api, flap, sweep = 0, tip = 0) => {
    for (const [key, side] of [['L', -1], ['R', 1]]) {
      api.set(`wing${key}`, { r: [0, -side * sweep, side * flap] });
      api.set(`wingTip${key}`, { r: [0, side * sweep * 0.45, side * tip] });
    }
  };
  const clawPose = (api, open, extension = 0) => {
    for (const [key, side] of [['L', -1], ['R', 1]]) {
      api.set(`collector${key}`, { p: [0, 0, -extension], r: [-open * 0.18, side * open * 0.12, side * open * 0.08] });
      api.set(`claw${key}`, { r: [open * 0.18, -side * open * 0.15, 0] });
      api.set(`finger${key}A`, { r: [0, open * 0.62, 0] });
      api.set(`finger${key}B`, { r: [0, -open * 0.62, 0] });
    }
  };
  const irisPose = (api, open) => {
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4;
      api.set(`shutter${i}`, { p: [Math.sin(a) * open * 0.07, Math.cos(a) * open * 0.07, 0], r: [0, 0, open * 0.72] });
    }
  };
  const balancePose = (api, tilt, panMotion = 0) => {
    api.set('scaleBeam', { r: [0, 0, tilt] });
    api.set('panL', { r: [0, 0, -tilt + panMotion * 0.8] });
    api.set('panR', { r: [0, 0, -tilt - panMotion * 0.8] });
  };
  return animationSet(root, joints, {
    idle(t, time, api) {
      const hover = Math.sin(t * TAU * 2);
      api.set('body', { p: [0, hover * 0.035, 0], r: [hover * 0.015, 0, Math.sin(t * TAU) * 0.025] });
      wingPose(api, Math.sin(t * TAU * 4) * 0.1, 0.03, Math.sin(t * TAU * 4 + 0.6) * 0.08);
      api.set('ledger', { r: [Math.sin(t * TAU) * 0.12, 0, 0] });
      balancePose(api, Math.sin(t * TAU) * 0.075, Math.sin(t * TAU * 2) * 0.012);
      clawPose(api, 0.08 + hover * 0.035);
      irisPose(api, 0.04 + hover * 0.02);
      api.set('tokenStream', { r: [0, 0, Math.sin(t * TAU) * 0.08] });
      for (let i = 0; i < 5; i++) api.set(`token${i}`, { p: [0, Math.sin(t * TAU * 2 + i) * 0.012, 0], r: [0, 0, t * TAU + i] });
      api.set('tail', { r: [hover * 0.04, Math.sin(t * TAU) * 0.06, 0] });
    },
    move(t, time, api) {
      const flap = Math.sin(t * TAU * 2);
      api.set('body', { p: [0, Math.abs(flap) * 0.05, -0.035], r: [0.075 + flap * 0.02, 0, Math.sin(t * TAU) * 0.035] });
      wingPose(api, flap * 0.36, 0.16, -flap * 0.24 + 0.08);
      api.set('ledger', { r: [t * TAU, 0, 0] });
      balancePose(api, Math.sin(t * TAU) * 0.12, Math.abs(flap) * 0.018);
      clawPose(api, 0.18, 0.04);
      api.set('collectorL', { p: [0, 0, -0.04], r: [flap * 0.08, 0, 0] });
      api.set('collectorR', { p: [0, 0, -0.04], r: [-flap * 0.08, 0, 0] });
      api.set('tail', { r: [-0.1, Math.sin(t * TAU) * 0.1, 0] });
    },
    attack(t, time, api) {
      const aim = ease(t, 0, 0.34) * (1 - ease(t, 0.72, 1));
      const seize = pulse(t, 0.28, 0.48, 0.8);
      wingPose(api, -aim * 0.15 + seize * 0.22, aim * 0.22, aim * 0.18);
      clawPose(api, aim * 0.75 - seize * 0.72, aim * 0.08 + seize * 0.18);
      irisPose(api, aim * 0.55 + seize * 0.25);
      api.set('iris', { p: [0, 0, -seize * 0.09], r: [-seize * 0.12, 0, 0] });
      api.set('ledger', { r: [seize * 1.3, 0, 0] });
      balancePose(api, aim * 0.22 - seize * 0.36, seize * 0.045);
      for (let i = 0; i < 5; i++) api.set(`token${i}`, { p: [0, 0, seize * (0.08 + i * 0.025)], s: [1 + seize * 0.25, 1 + seize * 0.25, 1 + seize * 0.25] });
    },
    windup(t, time, api) {
      const charge = ease(t, 0, 1);
      api.set('body', { p: [0, charge * 0.075, charge * 0.055], r: [-charge * 0.1, 0, 0] });
      wingPose(api, -charge * 0.3, charge * 0.34, charge * 0.32);
      clawPose(api, charge * 0.95, charge * 0.16);
      irisPose(api, charge);
      api.set('iris', { p: [0, 0, charge * 0.09], s: [1 + charge * 0.15, 1 + charge * 0.15, 1] });
      api.set('ledger', { r: [-charge * 0.8, 0, 0] });
      balancePose(api, charge * 0.34, charge * 0.065);
      api.set('scale', { r: [-charge * 0.08, 0, 0] });
      api.set('tokenStream', { p: [0, 0, -charge * 0.18], s: [1 + charge * 0.35, 1 + charge * 0.35, 1 + charge * 0.35] });
      for (let i = 0; i < 5; i++) api.set(`token${i}`, { p: [0, 0, -charge * i * 0.035], r: [0, 0, charge * (i + 1)] });
      api.set('tail', { r: [charge * 0.18, 0, 0] });
    },
    release(t, time, api) {
      const open = 1 - ease(t, 0.7, 1);
      const seize = ease(t, 0, 0.22) * (1 - ease(t, 0.72, 1));
      const draw = ease(t, 0.15, 0.72) * (1 - ease(t, 0.82, 1));
      wingPose(api, open * -0.25 + seize * 0.48, open * 0.28, open * 0.28 - seize * 0.45);
      clawPose(api, open * 0.9 - seize * 0.85, open * 0.15 - draw * 0.1);
      irisPose(api, open * 0.85 - seize * 0.35);
      api.set('iris', { p: [0, 0, open * 0.09 + draw * 0.08], r: [draw * 0.16, 0, 0], s: [1 + open * 0.15 - seize * 0.12, 1 + open * 0.15 - seize * 0.12, 1] });
      api.set('ledger', { r: [-open * 0.8 + seize * 2.8, 0, 0] });
      balancePose(api, open * 0.34 - seize * 0.55, open * 0.065 - seize * 0.09);
      api.set('tokenStream', { p: [0, 0, -open * 0.18 + draw * 0.48], s: [1 + draw * 0.25, 1 + draw * 0.25, 1 + draw * 0.25] });
      for (let i = 0; i < 5; i++) api.set(`token${i}`, { p: [Math.sin(i * 2.2) * draw * 0.035, 0, draw * (0.16 + i * 0.055)], r: [draw * 0.8, 0, draw * 2 + i], s: [1 - draw * 0.35, 1 - draw * 0.35, 1 - draw * 0.35] });
    },
    ability(t, time, api) {
      const charge = ease(t, 0, 0.45);
      const open = charge * (1 - ease(t, 0.82, 1));
      const seize = pulse(t, 0.42, 0.56, 0.84);
      const draw = ease(t, 0.53, 0.88) * (1 - ease(t, 0.9, 1));
      api.set('body', { p: [0, charge * 0.075 - seize * 0.055, charge * 0.055 + seize * 0.09], r: [-charge * 0.1 + seize * 0.2, 0, 0] });
      wingPose(api, -charge * 0.3 + seize * 0.72, charge * 0.34, charge * 0.32 - seize * 0.65);
      clawPose(api, open * 0.95 - seize * 0.9, open * 0.16 + seize * 0.12 - draw * 0.2);
      irisPose(api, open - seize * 0.45);
      api.set('iris', { p: [0, 0, open * 0.09 - seize * 0.12 + draw * 0.12], r: [draw * 0.18, 0, 0], s: [1 + open * 0.15 - seize * 0.12, 1 + open * 0.15 - seize * 0.12, 1] });
      api.set('ledger', { r: [-open * 0.8 + seize * 3.4 + draw * 1.2, 0, 0] });
      balancePose(api, open * 0.34 - seize * 0.62 + draw * 0.2, open * 0.065 - seize * 0.1);
      api.set('scale', { r: [-open * 0.08 + seize * 0.12, 0, 0] });
      api.set('tokenStream', { p: [0, 0, -open * 0.18 + draw * 0.58], s: [1 + open * 0.35 - draw * 0.2, 1 + open * 0.35 - draw * 0.2, 1 + open * 0.35 - draw * 0.2] });
      for (let i = 0; i < 5; i++) api.set(`token${i}`, { p: [Math.sin(i * 2.2) * draw * 0.04, 0, -open * i * 0.035 + draw * (0.2 + i * 0.06)], r: [draw, 0, open * (i + 1) + draw * 2.4], s: [1 - draw * 0.45, 1 - draw * 0.45, 1 - draw * 0.45] });
      api.set('tail', { r: [charge * 0.18 - seize * 0.28, 0, 0] });
    },
    shutdown(t, time, api) {
      const k = ease(t, 0, 1);
      api.set('body', { p: [0, -0.14 * k, 0.07 * k], r: [0.24 * k, 0, 0.09 * k] });
      wingPose(api, -0.95 * k, 0.58 * k, -0.72 * k);
      clawPose(api, 0.28 * k, -0.12 * k);
      api.set('collectorL', { p: [0, -0.09 * k, 0.12 * k], r: [-0.62 * k, 0, -0.16 * k] });
      api.set('collectorR', { p: [0, -0.09 * k, 0.12 * k], r: [-0.62 * k, 0, 0.16 * k] });
      api.set('clawL', { r: [0.5 * k, 0, 0] });
      api.set('clawR', { r: [0.5 * k, 0, 0] });
      irisPose(api, -0.18 * k);
      api.set('iris', { p: [0, -0.05 * k, 0.13 * k], r: [0.55 * k, 0, 0], s: [1 - 0.24 * k, 1 - 0.24 * k, 1] });
      api.set('ledger', { p: [0, -0.08 * k, 0], r: [1.1 * k, 0, 0.22 * k] });
      api.set('scale', { p: [0, -0.09 * k, 0], r: [0.48 * k, 0, 0] });
      balancePose(api, 0, -0.12 * k);
      api.set('tokenStream', { p: [0, 0, 0.24 * k], s: [1 - 0.94 * k, 1 - 0.94 * k, 1 - 0.94 * k] });
      for (let i = 0; i < 5; i++) api.set(`token${i}`, { p: [0, -0.05 * k, 0.08 * k], s: [1 - 0.9 * k, 1 - 0.9 * k, 1 - 0.9 * k] });
      api.set('tail', { r: [0.72 * k, 0, 0] });
    },
  }, { idle: 3.4, move: 0.82, windup: 1.7, ability: 2.9, shutdown: 2 });
}

export const entities = [
  defineEntity({
    id: 'pressure_cantor', name: '压力咏唱者', kind: 'monster', role: 'pressure support', locomotion: 'ground', variants: ['base'],
    concept: '以五管谐振风琴和压力膜为敌群咏唱增幅的甲壳行走机构。',
    mechanism: '音叉张合与管内活塞前摇，压力膜和共鸣环释放；停机时风琴折倒、活塞卸载。',
    build: buildPressureCantor, clips: pressureCantorClips,
  }),
  defineEntity({
    id: 'signal_summoner', name: '信号召集体', kind: 'monster', role: 'summoner', locomotion: 'ground', variants: ['base'],
    concept: '背负密封召唤舱和折叠信号种子的四足传输载体。',
    mechanism: '舱门展开、升降台抬种和投射爪展开前摇，种子弹射与抵达环完成召唤；回收时降台闭舱。',
    build: buildSignalSummoner, clips: signalSummonerClips,
  }),
  defineEntity({
    id: 'resistance_corruptor', name: '抗性腐蚀体', kind: 'monster', role: 'corrosion support', locomotion: 'air', variants: ['base'],
    concept: '以铰接飞行翼悬停、由双裂变压力罐供养前置裂解腐蚀腔的飞行体。',
    mechanism: '罐阀增压与上下腔颚张开前摇，伸缩喷嘴释放腐蚀液；卸载时收翼、泄压并缩回喷嘴。',
    build: buildResistanceCorruptor, clips: resistanceCorruptorClips,
  }),
  defineEntity({
    id: 'detonation_shell', name: '爆裂外壳', kind: 'monster', role: 'volatile assault', locomotion: 'ground', variants: ['base'],
    concept: '六瓣铰接装甲包住高压核心，以撞击柱塞和弹射壳钉进行自毁冲锋。',
    mechanism: '柱塞压缩、壳瓣逐张和核心增压前摇，壳钉外射与破裂环释放；停机时拔能、缩钉并闭壳。',
    build: buildDetonationShell, clips: detonationShellClips,
  }),
  defineEntity({
    id: 'proliferation_protocol', name: '增殖协议体', kind: 'monster', role: 'elite summoner', locomotion: 'ground', variants: ['base'],
    concept: '六足精英增殖平台，背载双核心裂解腔、分隔刃和两侧育成压力罐。',
    mechanism: '分隔刃抽离、双核心分离与育成罐开盖前摇，双侧弹射管释放增殖信号；停机时核心归并熄灭。',
    build: buildProliferationProtocol, clips: proliferationProtocolClips,
  }),
  defineEntity({
    id: 'spirit_taxer', name: '精神税吏', kind: 'monster', role: 'elite spirit requisition', locomotion: 'air', variants: ['base'],
    concept: '配备评估账鼓、悬挂天平和双征收爪的重装飞行征税机构。',
    mechanism: '天平倾斜、虹膜张开与征收爪前伸前摇，爪合拢回收精神代币并记账；卸载时折翼、松爪、封锁虹膜。',
    build: buildSpiritTaxer, clips: spiritTaxerClips,
  }),
];
