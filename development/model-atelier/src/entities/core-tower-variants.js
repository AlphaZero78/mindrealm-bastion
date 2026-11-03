import * as THREE from '../../vendor/three/build/three.module.js';
import { defineEntity } from './contract.js';
import { buildCoreModel } from '../models.js';
import { TAU, clamp, ease, pulse, createClips, createRigClip } from '../animations.js';
import { palette, group, box, panel, cylinder, crystal, torus, arc, cable, rod, lathe, hull, radial } from '../geometry.js';

const VARIANTS = Object.freeze(['T1', 'T2A', 'T2B', 'T3A', 'T3B']);
const RELEASE_SPLIT = { focus_rail: 0.50, arc_mortar: 0.32, resistance_beacon: 0.23 };
const rigs = new WeakMap();
const sideId = side => side < 0 ? 'L' : 'R';

function focusPenetration(root, joints, extra, m, tier) {
  const extension = group(joints.gun, 'Pierce_rail_extension', [0, 0, -1.45]);
  const length = tier === 3 ? 1.12 : 0.84;
  extra.railExtension = extension;
  for (const side of [-1, 1]) {
    box(extension, `Pierce_extension_rail_${sideId(side)}`, [0.075, 0.12, length], [side * 0.19, 0, -length * 0.46], m.dark, [0, 0, 0], 0.014);
    box(extension, `Pierce_extension_lip_${sideId(side)}`, [0.035, 0.045, length * 0.94], [side * 0.245, 0.055, -length * 0.46], m.edge, [0, 0, 0], 0.007);
    rod(extension, `Pierce_breech_bridge_${sideId(side)}`, [side * 0.16, -0.07, 0.10], [side * 0.19, -0.07, -0.34], 0.035, m.gold);
  }
  const phase = group(extension, 'Pierce_phase_collars');
  const count = tier === 3 ? 5 : 3;
  for (let i = 0; i < count; i++) {
    const z = -0.14 - i * 0.19;
    torus(phase, `Pierce_phase_collar_${i}`, 0.255, 0.018, [0, 0, z], i % 2 ? m.energy : m.gold);
    for (const side of [-1, 1]) box(phase, `Pierce_collar_clamp_${i}_${sideId(side)}`, [0.07, 0.11, 0.08], [side * 0.255, 0, z], m.armor, [0, 0, 0], 0.012);
  }
  extra.railPhase = phase;
  const sabot = group(extension, 'Pierce_sabot', [0, 0, -0.24]);
  crystal(sabot, 'Pierce_sabot_dart', 0.13, [0, 0, -0.10], m.core, [0.48, 0.48, 2.65]);
  torus(sabot, 'Pierce_sabot_band', 0.095, 0.013, [0, 0, 0.02], m.energy);
  extra.railSabot = sabot;
  const brace = group(joints.gun, 'Pierce_recoil_reservoir', [0, 0, 0.72]);
  cylinder(brace, 'Pierce_reservoir_body', 0.17, 0.20, 0.36, [0, 0, 0.16], m.dark, [Math.PI / 2, 0, 0]);
  torus(brace, 'Pierce_reservoir_seal', 0.17, 0.022, [0, 0, 0.34], m.energy);
  for (const side of [-1, 1]) rod(brace, `Pierce_reservoir_mount_${sideId(side)}`, [side * 0.19, -0.08, -0.05], [side * 0.19, -0.08, 0.30], 0.027, m.gold);
  extra.railBrace = brace;
  if (tier !== 3) return;
  const stage = group(extension, 'Pierce_second_stage', [0, 0, -0.66]);
  for (const side of [-1, 1]) {
    box(stage, `Pierce_outer_rail_${sideId(side)}`, [0.065, 0.095, 0.78], [side * 0.34, 0, -0.10], m.armor, [0, 0, 0], 0.012);
    rod(stage, `Pierce_outer_diag_a_${sideId(side)}`, [side * 0.19, 0.09, 0.27], [side * 0.34, 0.09, -0.41], 0.022, m.edge);
    rod(stage, `Pierce_outer_diag_b_${sideId(side)}`, [side * 0.19, -0.09, -0.41], [side * 0.34, -0.09, 0.27], 0.022, m.gold);
  }
  box(stage, 'Pierce_upper_bridge', [0.74, 0.065, 0.12], [0, 0.27, 0.22], m.hull, [0, 0, 0], 0.015);
  box(stage, 'Pierce_lower_bridge', [0.74, 0.065, 0.12], [0, -0.27, -0.40], m.hull, [0, 0, 0], 0.015);
  torus(stage, 'Pierce_second_stage_aperture', 0.35, 0.028, [0, 0, -0.49], m.energy);
  extra.railStage = stage;
}

function focusExecution(root, joints, extra, m, tier) {
  const rack = group(joints.gun, 'Verdict_muzzle_yoke', [0, 0, -1.14]);
  box(rack, 'Verdict_yoke_crossbeam', [0.82, 0.12, 0.16], [0, 0.24, 0.02], m.hull, [0, 0, 0], 0.022);
  for (const side of [-1, 1]) {
    const id = sideId(side);
    rod(rack, `Verdict_yoke_mount_${id}`, [side * 0.17, -0.08, 0.27], [side * 0.34, -0.08, -0.06], 0.040, m.edge);
    const jaw = group(rack, `Verdict_jaw_${id}`, [side * 0.34, 0, -0.06]);
    hull(jaw, `Verdict_cleaver_${id}`, [
      { z: -0.72, w: 0.055, h: 0.20 }, { z: -0.30, w: 0.15, h: 0.38 }, { z: 0.12, w: 0.13, h: 0.30 },
    ], m.armor);
    box(jaw, `Verdict_cutting_edge_${id}`, [0.035, 0.09, 0.64], [-side * 0.075, -0.04, -0.29], m.energy, [0, 0, side * 0.04], 0.006);
    cylinder(jaw, `Verdict_jaw_hinge_${id}`, 0.095, 0.095, 0.42, [0, 0, 0.08], m.dark, [0, 0, 0], 24);
    extra[`verdictJaw${id}`] = jaw;
  }
  extra.verdictRack = rack;
  const sight = group(joints.gun, 'Verdict_range_finder', [0, 0.34, -0.43]);
  box(sight, 'Verdict_finder_bridge', [0.40, 0.10, 0.22], [0, 0, 0], m.dark, [0, 0, 0], 0.018);
  for (const side of [-1, 1]) crystal(sight, `Verdict_finder_lens_${sideId(side)}`, 0.09, [side * 0.13, 0.055, -0.08], m.energy, [0.75, 0.75, 1.35]);
  rod(sight, 'Verdict_finder_mount', [0, -0.12, 0.08], [0, -0.02, 0.02], 0.035, m.gold);
  extra.verdictSight = sight;
  const drive = group(joints.gun, 'Verdict_twin_drive', [0, 0, 0.73]);
  for (const side of [-1, 1]) {
    cylinder(drive, `Verdict_drive_drum_${sideId(side)}`, 0.13, 0.15, 0.34, [side * 0.18, 0, 0.15], m.dark, [Math.PI / 2, 0, 0], 32);
    torus(drive, `Verdict_drive_seal_${sideId(side)}`, 0.13, 0.018, [side * 0.18, 0, 0.32], m.energy);
  }
  box(drive, 'Verdict_drive_coupler', [0.50, 0.10, 0.12], [0, -0.12, 0.02], m.gold, [0, 0, 0], 0.015);
  extra.verdictDrive = drive;
  if (tier !== 3) return;
  const gate = group(rack, 'Verdict_guillotine_frame', [0, 0, -0.50]);
  for (const side of [-1, 1]) box(gate, `Verdict_gate_post_${sideId(side)}`, [0.075, 0.78, 0.12], [side * 0.29, 0, 0], m.hull, [0, 0, 0], 0.014);
  for (const side of [-1, 1]) {
    const id = side > 0 ? 'Upper' : 'Lower';
    const blade = group(gate, `Verdict_gate_${id}`, [0, side * 0.29, 0]);
    box(blade, `Verdict_gate_blade_${id}`, [0.50, 0.075, 0.24], [0, 0, 0], m.armor, [0, 0, 0], 0.012);
    crystal(blade, `Verdict_gate_point_${id}`, 0.10, [0, -side * 0.075, -0.05], m.core, [2.1, 0.45, 1.1]);
    extra[`verdictGate${id}`] = blade;
  }
  const crown = group(drive, 'Verdict_overpressure_head', [0, 0.23, 0.12]);
  cylinder(crown, 'Verdict_overpressure_vessel', 0.12, 0.15, 0.38, [0, 0, 0], m.gold, [Math.PI / 2, 0, 0], 32);
  cable(crown, 'Verdict_overpressure_feed', [[0, 0, -0.18], [0, 0.10, -0.28], [0, 0.10, -0.52]], 0.022, m.energy);
  extra.verdictCrown = crown;
}

function mortarSpread(root, joints, extra, m, tier) {
  const manifold = group(joints.bowlFrame, 'Diffusion_manifold', [0, 0.45, 0]);
  torus(manifold, 'Diffusion_distribution_ring', 0.58, 0.026, [0, 0, 0], m.gold, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) {
    const angle = i * TAU / 3;
    rod(manifold, `Diffusion_feed_arm_${i}`, radial(angle, 0.39, -0.02), radial(angle, 0.70, 0.08), 0.030, m.edge);
    lathe(manifold, `Diffusion_nozzle_${i}`, [[0.07, -0.08], [0.13, -0.03], [0.17, 0.10], [0.14, 0.14], [0.08, 0.04]], radial(angle, 0.70, 0.10), m.hull);
    const vane = group(manifold, `Diffusion_vane_${i}`, radial(angle, 0.60, 0.15), [0, angle, 0]);
    panel(vane, `Diffusion_splitter_leaf_${i}`, [[-0.11, -0.08], [0.11, -0.08], [0.16, 0.16], [0, 0.34], [-0.16, 0.16]], 0.045, [0, 0, 0], m.armor, [0, 0, 0], 0.012);
    crystal(vane, `Diffusion_vane_signal_${i}`, 0.065, [0, 0.13, 0.04], m.energy, [0.65, 1.55, 0.55]);
    extra[`spreadVane${i}`] = vane;
  }
  extra.spreadManifold = manifold;
  const shotCount = tier === 3 ? 6 : 3;
  for (let i = 0; i < shotCount; i++) {
    const shot = group(root, `Echo_spread_projectile_${i}`, [0, 1.20, 0]);
    shot.scale.setScalar(0.001);
    crystal(shot, `Echo_spread_core_${i}`, 0.105, [0, 0, 0], m.core, [0.90, 1.20, 0.90]);
    torus(shot, `Echo_spread_ring_${i}`, 0.14, 0.012, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0]);
    extra[`spreadShot${i}`] = shot;
  }
  if (tier !== 3) return;
  const crown = group(joints.bowlFrame, 'Diffusion_cascade_crown', [0, 0.68, 0]);
  torus(crown, 'Diffusion_cascade_ring', 0.39, 0.022, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) {
    const angle = i * TAU / 6;
    rod(crown, `Diffusion_cascade_spoke_${i}`, radial(angle, 0.20, -0.07), radial(angle, 0.45, 0.04), 0.018, i % 2 ? m.gold : m.edge);
    crystal(crown, `Diffusion_cascade_prism_${i}`, 0.06, radial(angle, 0.45, 0.06), m.core, [0.75, 1.30, 0.75]);
  }
  extra.spreadCrown = crown;
}

function mortarCorrosion(root, joints, extra, m, tier) {
  const manifold = group(joints.bowlFrame, 'Caustic_feed_manifold', [0, 0.20, 0]);
  torus(manifold, 'Caustic_feed_loop', 0.60, 0.025, [0, 0, 0], m.gold, [Math.PI / 2, 0, 0]);
  for (const side of [-1, 1]) {
    const id = sideId(side);
    rod(manifold, `Caustic_pump_mount_${id}`, [side * 0.45, 0.02, 0.03], [side * 0.64, 0.04, 0.03], 0.045, m.hull);
    cable(manifold, `Caustic_feed_line_${id}`, [[side * 0.64, 0.06, 0.03], [side * 0.61, 0.23, -0.04], [side * 0.42, 0.27, -0.03], [side * 0.25, 0.24, 0]], 0.024, m.energy);
    const pump = group(manifold, `Caustic_pump_${id}`, [side * 0.64, 0.04, 0.03]);
    cylinder(pump, `Caustic_pump_vessel_${id}`, 0.14, 0.17, 0.42, [0, 0, 0], m.dark, [0, 0, 0], 32);
    torus(pump, `Caustic_pump_lower_seal_${id}`, 0.15, 0.018, [0, -0.19, 0], m.gold, [Math.PI / 2, 0, 0]);
    torus(pump, `Caustic_pump_upper_seal_${id}`, 0.14, 0.018, [0, 0.19, 0], m.energy, [Math.PI / 2, 0, 0]);
    const piston = group(pump, `Caustic_piston_${id}`, [0, 0.23, 0]);
    cylinder(piston, `Caustic_piston_rod_${id}`, 0.035, 0.035, 0.55, [0, -0.06, 0], m.edge, [0, 0, 0], 24);
    crystal(piston, `Caustic_piston_cap_${id}`, 0.095, [0, 0.23, 0], m.core, [1.0, 0.55, 1.0]);
    extra[`causticPump${id}`] = pump;
    extra[`causticPiston${id}`] = piston;
  }
  extra.causticManifold = manifold;
  const mixer = group(joints.bowlFrame, 'Caustic_mixer', [0, 0.44, 0]);
  torus(mixer, 'Caustic_mixer_tilt_ring', 0.34, 0.018, [0, 0, 0], m.gold, [0.55, 0, 0.25]);
  arc(mixer, 'Caustic_mixer_arc', 0.38, 0.014, -1.1, 1.1, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) crystal(mixer, `Caustic_reagent_bead_${i}`, 0.055, radial(i * TAU / 3, 0.34, 0), m.core);
  extra.causticMixer = mixer;
  const shell = group(joints.projectile, 'Caustic_projectile_shell');
  torus(shell, 'Caustic_projectile_meridian', 0.22, 0.016, [0, 0, 0], m.gold, [0, Math.PI / 2, 0]);
  arc(shell, 'Caustic_projectile_trail', 0.27, 0.018, -1.3, 1.3, [0, 0, 0], m.energy, [0.4, 0.2, 0]);
  for (let i = 0; i < 3; i++) crystal(shell, `Caustic_projectile_drop_${i}`, 0.045, radial(i * TAU / 3, 0.25, -0.04), m.core, [0.7, 1.5, 0.7]);
  extra.causticShell = shell;
  if (tier !== 3) return;
  const reflux = group(joints.bowlFrame, 'Caustic_reflux_tower', [0, 0.25, 0.49]);
  for (const side of [-1, 1]) {
    cylinder(reflux, `Caustic_reflux_column_${sideId(side)}`, 0.10, 0.13, 0.54, [side * 0.16, 0.18, 0], m.hull, [0, 0, 0], 32);
    torus(reflux, `Caustic_reflux_band_${sideId(side)}`, 0.105, 0.016, [side * 0.16, 0.37, 0], m.energy, [Math.PI / 2, 0, 0]);
  }
  cable(reflux, 'Caustic_reflux_return', [[-0.16, 0.42, 0], [0, 0.58, 0], [0.16, 0.42, 0]], 0.026, m.gold);
  cable(reflux, 'Caustic_reflux_inlet', [[0, -0.05, 0], [0, -0.08, -0.22], [0, 0.12, -0.39]], 0.028, m.energy);
  extra.causticReflux = reflux;
  const catalyst = group(joints.orb, 'Caustic_catalyst_cage');
  for (let i = 0; i < 3; i++) {
    const angle = i * TAU / 3;
    rod(catalyst, `Caustic_catalyst_rib_${i}`, radial(angle, 0.27, -0.20), radial(angle + 0.35, 0.27, 0.24), 0.018, m.armor);
    crystal(catalyst, `Caustic_catalyst_node_${i}`, 0.055, radial(angle + 0.35, 0.27, 0.24), m.energy);
  }
  extra.causticCatalyst = catalyst;
}

function beaconDeepResistance(root, joints, extra, m, tier) {
  const anchors = group(root, 'Deep_resistance_anchor_system');
  torus(anchors, 'Deep_grounding_ring', 0.69, 0.028, [0, 0.27, 0], m.gold, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) {
    const angle = i * TAU / 3;
    rod(anchors, `Deep_anchor_root_link_${i}`, radial(angle, 0.87, 0.08), radial(angle, 0.68, 0.45), 0.045, m.edge);
    const pylon = group(anchors, `Deep_resistance_pylon_${i}`, radial(angle, 0.68, 0.62), [0, angle, 0]);
    box(pylon, `Deep_pylon_body_${i}`, [0.20, 0.68, 0.18], [0, 0, 0], m.hull, [0, 0, 0], 0.025);
    panel(pylon, `Deep_pylon_face_${i}`, [[-0.075, -0.25], [0.075, -0.25], [0.10, 0.14], [0, 0.30], [-0.10, 0.14]], 0.035, [0, 0, 0.105], m.armor, [0, 0, 0], 0.009);
    crystal(pylon, `Deep_pylon_seed_${i}`, 0.085, [0, 0.12, 0.15], m.core, [0.65, 1.65, 0.55]);
    extra[`deepPylon${i}`] = pylon;
  }
  extra.deepAnchors = anchors;
  const inner = group(root, 'Deep_core_lattice', [0, 1.46, 0]);
  torus(inner, 'Deep_lattice_equator', 0.54, 0.021, [0, 0, 0], m.gold, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) arc(inner, `Deep_lattice_meridian_${i}`, 0.55, 0.019, -1.22, 1.22, [0, 0, 0], i === 1 ? m.energy : m.edge, [0, i * TAU / 3, 0]);
  const heart = group(inner, 'Deep_core_seed', [0, -0.10, 0]);
  crystal(heart, 'Deep_core_inner_flame', 0.19, [0, 0, 0], m.core, [0.62, 1.55, 0.62]);
  torus(heart, 'Deep_core_seed_band', 0.20, 0.013, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0]);
  extra.deepInner = inner;
  extra.deepHeart = heart;
  if (tier !== 3) return;
  const crown = group(root, 'Deep_aegis_crown', [0, 2.00, 0]);
  torus(crown, 'Deep_aegis_crown_ring', 0.39, 0.026, [0, 0, 0], m.gold, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) {
    const angle = i * TAU / 3;
    rod(crown, `Deep_crown_suspension_${i}`, radial(angle, 0.15, -0.06), radial(angle, 0.39, 0), 0.025, m.edge);
    crystal(crown, `Deep_crown_node_${i}`, 0.075, radial(angle, 0.39, 0.04), m.energy, [0.8, 1.3, 0.8]);
    const aegis = group(joints[`petal${i}`], `Deep_aegis_leaf_${i}`, [0, 0.43, 0.09]);
    panel(aegis, `Deep_aegis_outer_flange_${i}`, [[-0.24, -0.20], [0.24, -0.20], [0.30, 0.10], [0, 0.34], [-0.30, 0.10]], 0.045, [0, 0, 0], m.armor, [0, 0, 0], 0.013);
    rod(aegis, `Deep_aegis_leaf_rib_${i}`, [0, -0.22, 0.045], [0, 0.29, 0.045], 0.022, m.gold);
    extra[`deepAegis${i}`] = aegis;
  }
  extra.deepCrown = crown;
}

function beaconPressureFilter(root, joints, extra, m, tier) {
  const plumbing = group(root, 'Pressure_filter_plumbing');
  for (const side of [-1, 1]) {
    const id = sideId(side);
    cable(plumbing, `Pressure_root_intake_${id}`, [[side * 0.25, 0.40, 0], [side * 0.60, 0.69, 0], [side * 0.66, 1.00, 0]], 0.027, m.gold);
    cable(plumbing, `Pressure_core_return_${id}`, [[side * 0.66, 1.43, 0], [side * 0.49, 1.58, 0], [side * 0.25, 1.50, 0]], 0.020, m.energy);
    const pod = group(root, `Pressure_filter_pod_${id}`, [side * 0.66, 1.22, 0]);
    cylinder(pod, `Pressure_filter_canister_${id}`, 0.18, 0.20, 0.46, [0, 0, 0], m.dark, [0, 0, 0], 40);
    torus(pod, `Pressure_filter_lower_band_${id}`, 0.19, 0.022, [0, -0.21, 0], m.gold, [Math.PI / 2, 0, 0]);
    torus(pod, `Pressure_filter_upper_band_${id}`, 0.18, 0.022, [0, 0.21, 0], m.energy, [Math.PI / 2, 0, 0]);
    const rotor = group(pod, `Pressure_filter_rotor_${id}`);
    torus(rotor, `Pressure_rotor_ring_${id}`, 0.205, 0.018, [0, 0, 0], m.edge, [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) rod(rotor, `Pressure_rotor_spoke_${id}_${i}`, [0, 0, 0], radial(i * Math.PI / 2, 0.20, 0), 0.014, m.gold);
    extra[`filterPod${id}`] = pod;
    extra[`filterRotor${id}`] = rotor;
    const comb = group(root, `Pressure_filter_comb_${id}`, [side * 0.44, 1.65, 0], [0, side * 0.25, 0]);
    for (let i = -1; i <= 1; i++) box(comb, `Pressure_comb_blade_${id}_${i + 1}`, [0.045, 0.43, 0.12], [i * 0.09, 0, 0], m.armor, [0, 0, i * 0.08], 0.009);
    crystal(comb, `Pressure_comb_sensor_${id}`, 0.07, [0, 0.25, 0], m.core, [0.75, 1.25, 0.75]);
    extra[`filterComb${id}`] = comb;
  }
  const stack = group(root, 'Pressure_diaphragm_stack', [0, 0.73, 0.27]);
  for (let i = 0; i < 3; i++) torus(stack, `Pressure_diaphragm_${i}`, 0.25 - i * 0.025, 0.020, [0, i * 0.10, 0], i === 1 ? m.energy : m.gold, [Math.PI / 2, 0, 0]);
  cylinder(stack, 'Pressure_diaphragm_piston', 0.07, 0.09, 0.35, [0, 0.10, 0], m.edge, [0, 0, 0], 24);
  extra.filterStack = stack;
  const wave = group(root, 'Pressure_filtered_wave', [0, 0.28, 0]);
  wave.scale.setScalar(0.001);
  torus(wave, 'Pressure_filtered_front', 1.00, 0.026, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0]);
  torus(wave, 'Pressure_filtered_envelope', 1.08, 0.060, [0, 0, 0], m.field, [Math.PI / 2, 0, 0]);
  extra.filterWave = wave;
  if (tier !== 3) return;
  const condenserMount = group(root, 'Pressure_reflux_fixed_mount', [0, 1.35, 0.55]);
  cylinder(condenserMount, 'Pressure_condenser_column', 0.13, 0.17, 0.84, [0, 0.20, 0], m.hull, [0, 0, 0], 40);
  const condenser = group(condenserMount, 'Pressure_reflux_condenser');
  for (let i = 0; i < 4; i++) torus(condenser, `Pressure_condenser_fin_${i}`, 0.19, 0.018, [0, -0.10 + i * 0.17, 0], i % 2 ? m.edge : m.gold, [Math.PI / 2, 0, 0]);
  cable(condenserMount, 'Pressure_condenser_return', [[0, -0.20, 0], [0, -0.32, -0.20], [0, -0.10, -0.43]], 0.026, m.energy);
  extra.filterCondenser = condenser;
  for (const side of [-1, 1]) {
    const id = sideId(side);
    const bypass = group(root, `Pressure_bypass_scoop_${id}`, [side * 0.84, 1.03, 0.12], [0, side * 0.20, 0]);
    panel(bypass, `Pressure_bypass_leaf_${id}`, [[-0.15, -0.26], [0.15, -0.26], [0.24, 0.13], [0, 0.38], [-0.24, 0.13]], 0.06, [0, 0, 0], m.armor, [0, 0, 0], 0.015);
    rod(bypass, `Pressure_bypass_rib_${id}`, [0, -0.24, 0.05], [0, 0.30, 0.05], 0.022, m.edge);
    extra[`filterBypass${id}`] = bypass;
  }
  const crown = group(root, 'Pressure_radiator_crown', [0, 2.16, 0]);
  torus(crown, 'Pressure_radiator_ring', 0.30, 0.022, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) rod(crown, `Pressure_radiator_spoke_${i}`, radial(i * TAU / 6, 0.15, -0.06), radial(i * TAU / 6, 0.34, 0.04), 0.018, m.gold);
  extra.filterCrown = crown;
}

function focusPenetrationPose(action, u, t, api) {
  const wave = Math.sin(u * TAU);
  if (action === 'idle') {
    api.set('railPhase', { r: [0, 0, u * TAU * 0.5] });
    api.set('railSabot', { p: [0, 0, wave * 0.035] });
    api.set('railBrace', { r: [0, 0, wave * 0.035] });
    api.set('railStage', { r: [0, 0, -u * TAU * 0.25] });
    return;
  }
  if (action === 'shutdown') {
    const close = ease(u, 0.04, 0.90);
    api.set('railPhase', { r: [close * 0.20, 0, close * 0.55] });
    api.set('railSabot', { p: [0, 0, close * 0.42], s: [1 - close * 0.35, 1 - close * 0.35, 1 - close * 0.35] });
    api.set('railBrace', { p: [0, 0, close * 0.10] });
    api.set('railStage', { r: [close * 0.16, 0, -close * 0.30] });
    return;
  }
  const ability = action === 'ability';
  const charge = ability ? ease(u, 0, 0.43) * (1 - ease(u, 0.83, 1)) : pulse(u, 0, 0.48, 0.72);
  const fire = ability ? pulse(u, 0.45, 0.55, 0.77) : pulse(u, 0.48, 0.54, 0.70);
  api.set('railExtension', { p: [0, 0, fire * (ability ? 0.12 : 0.075)] });
  api.set('railPhase', { r: [0, 0, charge * (ability ? 2.2 : 1.1) + u * TAU * 0.25] });
  api.set('railSabot', { p: [0, 0, charge * 0.16 - fire * (ability ? 0.62 : 0.43)] });
  api.set('railBrace', { p: [0, 0, fire * 0.14] });
  api.set('railStage', { r: [0, 0, -charge * 1.3], p: [0, 0, fire * 0.09] });
}

function focusExecutionPose(action, u, t, api) {
  const wave = Math.sin(u * TAU);
  if (action === 'idle') {
    for (const side of [-1, 1]) api.set(`verdictJaw${sideId(side)}`, { r: [0, side * (0.055 + wave * 0.025), 0] });
    api.set('verdictSight', { r: [wave * 0.045, 0, 0] });
    api.set('verdictDrive', { r: [0, 0, wave * 0.04] });
    api.set('verdictCrown', { r: [0, wave * 0.08, 0] });
    return;
  }
  if (action === 'shutdown') {
    const close = ease(u, 0.04, 0.90);
    for (const side of [-1, 1]) api.set(`verdictJaw${sideId(side)}`, { r: [close * 0.20, side * close * 0.68, 0] });
    api.set('verdictSight', { r: [close * 0.48, 0, 0] });
    api.set('verdictDrive', { p: [0, -close * 0.06, close * 0.09] });
    api.set('verdictGateUpper', { p: [0, close * 0.12, 0] });
    api.set('verdictGateLower', { p: [0, -close * 0.12, 0] });
    api.set('verdictCrown', { r: [close * 0.35, 0, 0] });
    return;
  }
  const ability = action === 'ability';
  const charge = ability ? ease(u, 0, 0.43) * (1 - ease(u, 0.83, 1)) : pulse(u, 0, 0.48, 0.72);
  const fire = ability ? pulse(u, 0.45, 0.55, 0.77) : pulse(u, 0.48, 0.54, 0.70);
  for (const side of [-1, 1]) api.set(`verdictJaw${sideId(side)}`, { r: [0, side * (charge * 0.40 - fire * 0.34), 0] });
  api.set('verdictSight', { r: [-charge * 0.15 + fire * 0.10, charge * 0.12, 0] });
  api.set('verdictDrive', { p: [0, 0, fire * 0.15] });
  api.set('verdictGateUpper', { p: [0, -fire * 0.22, 0] });
  api.set('verdictGateLower', { p: [0, fire * 0.22, 0] });
  api.set('verdictCrown', { p: [0, charge * 0.08, 0], r: [0, u * TAU, 0] });
}

function mortarSpreadPose(action, u, t, api, tier) {
  const count = tier === 3 ? 6 : 3;
  const wave = Math.sin(u * TAU);
  if (action === 'idle') {
    api.set('spreadManifold', { r: [0, u * TAU * 0.25, 0] });
    api.set('spreadCrown', { r: [0, -u * TAU * 0.40, 0] });
    for (let i = 0; i < 3; i++) api.set(`spreadVane${i}`, { r: [0.08 + wave * 0.045, 0, 0] });
    for (let i = 0; i < count; i++) api.raw(`spreadShot${i}`, { s: [0.001, 0.001, 0.001] });
    return;
  }
  if (action === 'shutdown') {
    const close = ease(u, 0.03, 0.92);
    api.set('spreadManifold', { r: [close * 0.16, close * 0.42, 0] });
    api.set('spreadCrown', { r: [close * 0.40, -close * 0.50, 0], p: [0, -close * 0.12, 0] });
    for (let i = 0; i < 3; i++) api.set(`spreadVane${i}`, { r: [-close * 0.42, 0, 0] });
    for (let i = 0; i < count; i++) api.raw(`spreadShot${i}`, { s: [0.001, 0.001, 0.001] });
    return;
  }
  if (action === 'ability') {
    const open = ease(u, 0, 0.20) * (1 - ease(u, 0.83, 1));
    api.set('spreadManifold', { r: [open * 0.14, u * TAU * 1.5, 0] });
    api.set('spreadCrown', { r: [-open * 0.24, -u * TAU * 2, 0], p: [0, open * 0.12, 0] });
    for (let i = 0; i < 3; i++) api.set(`spreadVane${i}`, { r: [open * 0.72, 0, Math.sin(u * TAU * 3 + i * TAU / 3) * open * 0.10] });
    for (let i = 0; i < count; i++) {
      const angle = i * TAU / count + u * TAU;
      const size = 0.001 + open * 0.78;
      api.raw(`spreadShot${i}`, {
        p: [Math.sin(angle) * 0.68 * open, 1.23 + open * 0.43 + Math.sin(angle * 2) * open * 0.07, Math.cos(angle) * 0.68 * open],
        r: [u * TAU, angle, 0], s: [size, size, size],
      });
    }
    return;
  }
  const lift = pulse(u, 0, 0.32, 0.84), launch = pulse(u, 0.30, 0.43, 0.70);
  api.set('spreadManifold', { r: [launch * 0.16, u * TAU * 0.55, 0] });
  api.set('spreadCrown', { r: [-launch * 0.22, -u * TAU, 0] });
  for (let i = 0; i < 3; i++) api.set(`spreadVane${i}`, { r: [lift * 0.26 + launch * 0.48, 0, 0] });
  for (let i = 0; i < count; i++) {
    const angle = i * TAU / count;
    const delay = (i % 3) * 0.018;
    const q = clamp((u - 0.31 - delay) / 0.49);
    const visible = u > 0.31 + delay && u < 0.80 + delay ? Math.min(1, q * 12, (1 - q) * 12) : 0.001;
    api.raw(`spreadShot${i}`, {
      p: [Math.sin(angle) * q * 0.92, 1.30 + q * (2.0 + (i >= 3 ? 0.25 : 0)) - q * q * 1.30, -0.10 - q * (1.65 + (i >= 3 ? 0.25 : 0)) + Math.cos(angle) * q * 0.38],
      r: [q * TAU, q * TAU * 0.5, angle], s: [visible, visible, visible],
    });
  }
}

function mortarCorrosionPose(action, u, t, api) {
  const wave = Math.sin(u * TAU);
  if (action === 'idle') {
    for (const side of [-1, 1]) api.set(`causticPiston${sideId(side)}`, { p: [0, wave * 0.035 * side, 0] });
    api.set('causticMixer', { r: [wave * 0.06, u * TAU * 0.5, 0] });
    api.set('causticShell', { r: [0, u * TAU, wave * 0.12] });
    api.set('causticReflux', { r: [0, wave * 0.055, 0] });
    api.set('causticCatalyst', { r: [0, -u * TAU * 0.5, 0] });
    return;
  }
  if (action === 'shutdown') {
    const close = ease(u, 0.03, 0.92);
    for (const side of [-1, 1]) {
      api.set(`causticPump${sideId(side)}`, { r: [0, 0, side * close * 0.18] });
      api.set(`causticPiston${sideId(side)}`, { p: [0, -close * 0.17, 0] });
    }
    api.set('causticMixer', { r: [close * 0.48, close * 0.30, 0] });
    api.set('causticShell', { r: [close * 0.40, close * 0.60, 0] });
    api.set('causticReflux', { r: [-close * 0.36, 0, 0] });
    api.set('causticCatalyst', { r: [close * 0.30, 0, 0], s: [1 - close * 0.25, 1 - close * 0.25, 1 - close * 0.25] });
    return;
  }
  const ability = action === 'ability';
  const active = ability ? ease(u, 0, 0.20) * (1 - ease(u, 0.83, 1)) : pulse(u, 0, 0.32, 0.84);
  const launch = ability ? pulse(u, 0.35, 0.55, 0.80) : pulse(u, 0.30, 0.43, 0.70);
  for (const side of [-1, 1]) {
    api.set(`causticPump${sideId(side)}`, { r: [0, 0, side * launch * 0.10] });
    api.set(`causticPiston${sideId(side)}`, { p: [0, -active * 0.13 + launch * 0.18 + (ability ? Math.sin(u * TAU * 3 + side) * active * 0.035 : 0), 0] });
  }
  api.set('causticManifold', { r: [0, active * 0.22, 0] });
  api.set('causticMixer', { r: [active * 0.28, u * TAU * (ability ? 2.5 : 1.5), launch * 0.18] });
  api.set('causticShell', { r: [u * TAU, u * TAU * 2, launch * 0.35], s: [1 + launch * 0.28, 1 + launch * 0.28, 1 + launch * 0.28] });
  api.set('causticReflux', { r: [launch * 0.15, active * 0.20, 0] });
  api.set('causticCatalyst', { r: [active * 0.20, -u * TAU * 2, 0], s: [1 + active * 0.20, 1 + active * 0.20, 1 + active * 0.20] });
}

function beaconDeepPose(action, u, t, api) {
  const breath = Math.sin(u * TAU);
  if (action === 'idle') {
    api.set('deepInner', { r: [0, -u * TAU * 0.35, 0] });
    api.set('deepHeart', { p: [0, breath * 0.045, 0], s: [1 + breath * 0.05, 1 + breath * 0.07, 1 + breath * 0.05] });
    api.set('deepCrown', { r: [0, u * TAU * 0.5, 0] });
    for (let i = 0; i < 3; i++) {
      api.set(`deepPylon${i}`, { p: [0, Math.sin(u * TAU + i * TAU / 3) * 0.022, 0] });
      api.set(`deepAegis${i}`, { r: [0.04 + breath * 0.035, 0, 0] });
    }
    return;
  }
  if (action === 'shutdown') {
    const close = ease(u, 0.02, 0.91);
    api.set('deepInner', { r: [close * 0.45, close * 0.40, 0] });
    api.set('deepHeart', { p: [0, -close * 0.32, 0], s: [1 - close * 0.45, 1 - close * 0.45, 1 - close * 0.45] });
    api.set('deepCrown', { p: [0, -close * 0.15, 0], r: [close * 0.25, 0, 0] });
    for (let i = 0; i < 3; i++) {
      api.set(`deepPylon${i}`, { r: [close * 0.10, 0, (i - 1) * close * 0.08] });
      api.set(`deepAegis${i}`, { r: [-close * 0.30, 0, 0] });
    }
    return;
  }
  const ability = action === 'ability';
  const active = ability ? ease(u, 0.02, 0.36) * (1 - ease(u, 0.78, 1)) : pulse(u, 0, 0.38, 0.86);
  api.set('deepInner', { r: [active * 0.16, -u * TAU * (ability ? 2 : 1), 0], s: [1 + active * 0.12, 1 + active * 0.12, 1 + active * 0.12] });
  api.set('deepHeart', { p: [0, active * 0.20, 0], s: [1 + active * 0.20, 1 + active * 0.28, 1 + active * 0.20] });
  api.set('deepCrown', { p: [0, active * 0.11, 0], r: [0, u * TAU * 1.5, 0] });
  for (let i = 0; i < 3; i++) {
    api.set(`deepPylon${i}`, { p: [0, -active * 0.055, 0], r: [active * 0.075, 0, 0] });
    api.set(`deepAegis${i}`, { r: [active * 0.55, 0, 0] });
  }
}

function beaconFilterPose(action, u, t, api) {
  const breath = Math.sin(u * TAU);
  if (action === 'idle') {
    for (const side of [-1, 1]) {
      const id = sideId(side);
      api.set(`filterRotor${id}`, { r: [0, side * u * TAU, 0] });
      api.set(`filterComb${id}`, { r: [0, 0, side * breath * 0.04] });
      api.set(`filterBypass${id}`, { r: [0, 0, side * breath * 0.045] });
    }
    api.set('filterStack', { p: [0, breath * 0.025, 0] });
    api.set('filterCondenser', { r: [0, -u * TAU * 0.25, 0] });
    api.set('filterCrown', { r: [0, u * TAU * 0.5, 0] });
    api.raw('filterWave', { s: [0.001, 0.001, 0.001] });
    return;
  }
  if (action === 'shutdown') {
    const close = ease(u, 0.02, 0.91);
    for (const side of [-1, 1]) {
      const id = sideId(side);
      api.set(`filterRotor${id}`, { r: [close * 0.55, side * close * 0.60, 0] });
      api.set(`filterComb${id}`, { r: [0, side * close * 0.30, side * close * 0.48] });
      api.set(`filterBypass${id}`, { r: [side * close * 0.20, 0, side * close * 0.52] });
    }
    api.set('filterStack', { p: [0, -close * 0.13, 0] });
    api.set('filterCondenser', { r: [close * 0.34, 0, 0], p: [0, -close * 0.10, 0] });
    api.set('filterCrown', { r: [close * 0.30, close * 0.40, 0] });
    api.raw('filterWave', { s: [0.001, 0.001, 0.001] });
    return;
  }
  const ability = action === 'ability';
  const active = ability ? ease(u, 0.02, 0.36) * (1 - ease(u, 0.78, 1)) : pulse(u, 0, 0.38, 0.86);
  for (const side of [-1, 1]) {
    const id = sideId(side);
    api.set(`filterRotor${id}`, { r: [0, side * u * TAU * (ability ? 4 : 3), 0] });
    api.set(`filterComb${id}`, { r: [active * 0.18, side * active * 0.40, side * active * 0.22] });
    api.set(`filterBypass${id}`, { r: [0, side * active * 0.30, side * active * 0.55] });
  }
  api.set('filterStack', { p: [0, active * 0.10, -active * 0.07], s: [1 + active * 0.12, 1, 1 + active * 0.12] });
  api.set('filterCondenser', { p: [0, active * 0.14, 0], r: [0, -u * TAU * 2, 0] });
  api.set('filterCrown', { p: [0, active * 0.10, 0], r: [0, u * TAU * 2, 0] });
  const q = ability ? (u * 2) % 1 : clamp((u - 0.25) / 0.65);
  const envelope = ability ? active : u < 0.25 ? 0 : 1 - ease(u, 0.80, 1);
  const size = 0.001 + envelope * (0.18 + q * 1.15);
  api.raw('filterWave', { s: [size, size, size] });
}

const EXTRA_POSES = {
  focus_rail: { A: focusPenetrationPose, B: focusExecutionPose },
  arc_mortar: { A: mortarSpreadPose, B: mortarCorrosionPose },
  resistance_beacon: { A: beaconDeepPose, B: beaconFilterPose },
};

function buildVariant(id, variant = 'T1') {
  if (!VARIANTS.includes(variant)) throw new Error(`${id}: unknown variant ${variant}`);
  const { root, joints } = buildCoreModel(id);
  const baseJoints = { ...joints };
  const extraJoints = {};
  const branch = variant.endsWith('A') ? 'A' : 'B';
  const tier = Number(variant[1]);
  if (variant !== 'T1') {
    const materials = palette('friendly', id === 'resistance_beacon');
    if (id === 'focus_rail') (branch === 'A' ? focusPenetration : focusExecution)(root, joints, extraJoints, materials, tier);
    if (id === 'arc_mortar') (branch === 'A' ? mortarSpread : mortarCorrosion)(root, joints, extraJoints, materials, tier);
    if (id === 'resistance_beacon') (branch === 'A' ? beaconDeepResistance : beaconPressureFilter)(root, joints, extraJoints, materials, tier);
    Object.assign(joints, extraJoints);
  }
  root.userData.variant = variant;
  root.updateMatrixWorld(true);
  rigs.set(root, { id, variant, branch, tier, baseJoints, extraJoints });
  return { root, joints };
}

function clipsFor(id, root, joints) {
  const rig = rigs.get(root);
  const baseJoints = rig?.baseJoints || joints;
  const clips = createClips(id, root, baseJoints);
  if (rig && Object.keys(rig.extraJoints).length) {
    const pose = EXTRA_POSES[id][rig.branch];
    for (const clip of clips) {
      const additions = createRigClip(root, rig.extraJoints, clip.name, clip.duration, (u, t, api) => pose(clip.name, u, t, api, rig.tier));
      clip.tracks.push(...additions.tracks);
    }
  }
  const byName = Object.fromEntries(clips.map(clip => [clip.name, clip]));
  const move = byName.idle.clone();
  move.name = 'move';
  const split = Math.round(byName.attack.duration * 30 * RELEASE_SPLIT[id]);
  const end = Math.ceil(byName.attack.duration * 30);
  const windup = THREE.AnimationUtils.subclip(byName.attack, 'windup', 0, split, 30);
  const release = THREE.AnimationUtils.subclip(byName.attack, 'release', split, end, 30);
  return [byName.idle, move, byName.attack, windup, release, byName.ability, byName.shutdown];
}

export const entities = [
  defineEntity({
    id: 'focus_rail', name: '聚焦轨炮', kind: 'building', role: '高地 / 单体穿透 / 处决', locomotion: 'anchored', variants: VARIANTS,
    concept: '偏频者把游移的意志收敛成一条不可歧义的直线。升级机构分别让这道意志贯穿屏障，或在确认目标后闭合处决钳。',
    mechanism: 'T2A 在原有加速轨前端安装串联穿透轨与 sabot 棱镖，T3A 增设外轨和二级相位门；T2B 安装镜像处决钳与双驱动鼓，T3B 增设上下闸刃和过压仓。双轴万向架、棱晶充能及直射后坐保持原有时序。',
    build: variant => buildVariant('focus_rail', variant), clips: (root, joints) => clipsFor('focus_rail', root, joints),
  }),
  defineEntity({
    id: 'arc_mortar', name: '弧光迫击炮', kind: 'building', role: '高地 / 范围扩散 / 腐蚀', locomotion: 'anchored', variants: VARIANTS,
    concept: '共振托槽把回声折叠成能够越过屏障的弧光。分流机构让一次回声成为覆盖战场的齐奏，腐蚀机构则让回声持续侵蚀目标。',
    mechanism: 'T2A 在碗沿安装三路分流环、谐振瓣与子回声弹，T3A 增设六辐级联冠和第二组弹道；T2B 安装双侧泵、腐蚀供液环与回流混合器，T3B 增设双柱回流塔和催化剂笼。原托槽抬升、投送环翻转和主弹抛物线保持不变。',
    build: variant => buildVariant('arc_mortar', variant), clips: (root, joints) => clipsFor('arc_mortar', root, joints),
  }),
  defineEntity({
    id: 'resistance_beacon', name: '抗性信标', kind: 'building', role: '全域 / 深层抗性 / 压力滤波', locomotion: 'anchored', variants: VARIANTS,
    concept: '醒觉火种在噪声中辨认自己的边界。深层锚定让抗性进入防线根基，压力滤波则把侵入信号分离、排出，再送回清醒脉冲。',
    mechanism: 'T2A 增设三座接地抗性柱与核心晶格，T3A 增设法冠和护盾叶外翼；T2B 安装镜像滤波罐、转子、梳栅及压力波环，T3B 增设回流冷凝器、旁通进气叶和散热冠。核心呼吸、护盾瓣张合、支援脉冲与保护场沿用原关节。',
    build: variant => buildVariant('resistance_beacon', variant), clips: (root, joints) => clipsFor('resistance_beacon', root, joints),
  }),
];
