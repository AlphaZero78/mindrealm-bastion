import * as THREE from '../../vendor/three/build/three.module.js';
import { defineEntity } from './contract.js';
import {
  palette, group, box, panel, cylinder, sphere, crystal, torus, arc, cable, rod,
  lathe, bearing, fasteners, radial, mirrored, mesh, annulusGeometry,
} from '../geometry.js';
import { TAU, ease, pulse, createRigClip } from '../animations.js';

const VARIANTS = ['T1', 'T2A', 'T2B', 'T3A', 'T3B'];
const SIDES = [-1, 1];

function modelRoot(id, variant) {
  const root = new THREE.Group();
  root.name = `${id}_${variant}`;
  root.userData.entity = id;
  root.userData.variant = variant;
  return root;
}

function foundation(root, n, m, style) {
  const base = group(root, n('foundation'));
  if (style === 'mechanic') {
    box(base, n('ground_slab'), [1.72, 0.14, 1.58], [0, 0.07, 0], m.dark, [0, 0, 0], 0.06);
    box(base, n('beveled_deck'), [1.52, 0.18, 1.38], [0, 0.21, 0], m.hull, [0, 0, 0], 0.07);
    box(base, n('service_deck'), [1.28, 0.08, 1.18], [0, 0.34, 0], m.armor, [0, 0, 0], 0.035);
    for (const side of SIDES) {
      box(base, n(`deck_rail_${side}`), [0.055, 0.055, 1.02], [side * 0.57, 0.405, 0], m.edge);
      cable(base, n(`deck_bus_${side}`), [[side * 0.48, 0.39, 0.42], [side * 0.48, 0.41, 0], [side * 0.48, 0.39, -0.48]], 0.022, m.energy);
    }
  } else {
    const radius = style === 'choir' ? 0.91 : 0.86;
    cylinder(base, n('ground_plate'), radius * 0.91, radius, 0.14, [0, 0.07, 0], m.dark, [0, 0, 0], 12);
    cylinder(base, n('chamfered_plinth'), radius * 0.82, radius * 0.9, 0.16, [0, 0.2, 0], m.hull, [0, 0, 0], 12);
    cylinder(base, n('upper_deck'), radius * 0.72, radius * 0.8, 0.12, [0, 0.33, 0], m.armor, [0, 0, 0], 12);
    torus(base, n('deck_energy_bus'), radius * 0.75, 0.026, [0, 0.37, 0], m.energy, [Math.PI / 2, 0, 0]);
    torus(base, n('deck_machined_rim'), radius * 0.87, 0.022, [0, 0.245, 0], m.edge, [Math.PI / 2, 0, 0]);
    const ribs = style === 'choir' ? 6 : 4;
    for (let i = 0; i < ribs; i++) {
      const a = i * TAU / ribs;
      const p = radial(a, radius * 0.54, 0.4);
      box(base, n(`radial_rib_${i}`), [0.12, 0.07, 0.35], p, m.hull, [0, a, 0]);
    }
  }

  const joints = {};
  const count = style === 'choir' ? 6 : 4;
  const distance = style === 'mechanic' ? 0.86 : 0.82;
  for (let i = 0; i < count; i++) {
    const a = (i + 0.5) * TAU / count;
    const anchor = group(base, n(`anchor_${i}`), radial(a, distance, 0), [0, a, 0]);
    box(anchor, n(`anchor_shoe_${i}`), [0.31, 0.12, 0.42], [0, 0.06, 0], m.hull, [0, 0, 0], 0.035);
    box(anchor, n(`anchor_cap_${i}`), [0.22, 0.07, 0.28], [0, 0.145, -0.025], m.armor);
    cylinder(anchor, n(`anchor_lock_${i}`), 0.065, 0.075, 0.09, [0, 0.2, -0.04], m.edge, [0, 0, 0], 12);
    torus(anchor, n(`anchor_seal_${i}`), 0.07, 0.014, [0, 0.248, -0.04], m.accent, [Math.PI / 2, 0, 0]);
    fasteners(anchor, n(`anchor_bolts_${i}`), [[-0.1, 0.13, 0.12], [0.1, 0.13, 0.12]], m.edge, 'y', 0.025);
    joints[`anchor${i}`] = anchor;
  }

  cylinder(base, n('core_socket'), 0.28, 0.37, 0.24, [0, 0.43, 0], m.dark, [0, 0, 0], 24);
  torus(base, n('core_socket_ring'), 0.29, 0.035, [0, 0.54, 0], m.gold, [Math.PI / 2, 0, 0]);
  const core = group(root, n('core'), [0, 0.56, 0]);
  crystal(core, n('core_prism'), 0.18, [0, 0.08, 0], m.core, [0.82, 1.35, 0.82], [0, Math.PI / 4, 0]);
  sphere(core, n('core_envelope'), 0.24, [0, 0.08, 0], m.glass, [1, 1.15, 1]);
  torus(core, n('core_equator'), 0.22, 0.018, [0, 0.08, 0], m.energy, [Math.PI / 2, 0, 0]);
  joints.core = core;
  return joints;
}

function latticeMast(parent, n, m, height = 1.05, width = 0.34) {
  const half = width / 2;
  for (const x of SIDES) {
    for (const z of SIDES) {
      rod(parent, n(`mast_post_${x}_${z}`), [x * half, 0, z * half * 0.75], [x * half * 0.68, height, z * half * 0.5], 0.035, m.hull);
    }
  }
  const bays = 4;
  for (let i = 0; i < bays; i++) {
    const y0 = i * height / bays;
    const y1 = (i + 1) * height / bays;
    const w0 = half * (1 - i * 0.075);
    const w1 = half * (1 - (i + 1) * 0.075);
    rod(parent, n(`mast_cross_${i}`), [-w0, y0, -half * 0.6], [w0, y0, -half * 0.6], 0.024, m.edge);
    for (const side of SIDES) {
      rod(parent, n(`mast_brace_${i}_${side}`), [side * w0, y0, -half * 0.6], [side * w1, y1, -half * 0.5], 0.018, m.gold);
      rod(parent, n(`mast_diag_${i}_${side}`), [side * w0, y0, -half * 0.6], [-side * w1, y1, -half * 0.5], 0.015, m.hull);
    }
  }
}

function resonantPipe(parent, name, m, radius, height, position) {
  cylinder(parent, `${name}_body`, radius, radius * 1.08, height, [position[0], position[1] + height / 2, position[2]], m.gold, [0, 0, 0], 24);
  cylinder(parent, `${name}_mouth`, radius * 0.79, radius * 0.79, 0.018, [position[0], position[1] + height + 0.006, position[2]], m.dark, [0, 0, 0], 24);
  torus(parent, `${name}_lip`, radius, 0.014, [position[0], position[1] + height, position[2]], m.edge, [Math.PI / 2, 0, 0]);
  torus(parent, `${name}_foot_band`, radius * 1.06, 0.015, [position[0], position[1] + 0.12, position[2]], m.accent, [Math.PI / 2, 0, 0]);
}

function buildBandwidthRelay(variant) {
  const id = 'bandwidth_relay';
  const root = modelRoot(id, variant);
  const n = part => `${id}_${variant}_${part}`;
  const m = palette('ally');
  const joints = foundation(root, n, m, 'relay');
  const tier = Number(variant[1]);
  const branch = variant.endsWith('A') ? 'A' : variant.endsWith('B') ? 'B' : 'T';

  const mast = group(root, n('mast_assembly'), [0, 0.4, 0.13]);
  latticeMast(mast, n, m, branch === 'B' ? 0.88 : 1.03, branch === 'B' ? 0.43 : 0.34);
  box(mast, n('signal_computer'), [0.48, 0.28, 0.42], [0, 0.2, 0], m.hull, [0, 0, 0], 0.045);
  box(mast, n('computer_face'), [0.34, 0.15, 0.025], [0, 0.22, -0.225], m.dark);
  for (let i = 0; i < 4; i++) {
    box(mast, n(`computer_meter_${i}`), [0.045, 0.07 + i * 0.012, 0.018], [-0.12 + i * 0.08, 0.22, -0.245], i === 3 ? m.core : m.accent);
  }
  cable(mast, n('mast_feed'), [[-0.13, 0.02, 0.1], [-0.25, 0.35, 0.13], [-0.15, 0.78, 0.08], [0, 1.04, 0]], 0.026, m.energy);

  if (tier >= 2) {
    for (const side of SIDES) {
      const outrigger = group(root, n(`bus_outrigger_${side}`), [side * 0.59, 0.43, 0.12]);
      box(outrigger, n(`rectifier_${side}`), [0.24, 0.34, 0.38], [0, 0.16, 0], branch === 'B' ? m.armor : m.hull, [0, 0, 0], 0.04);
      cylinder(outrigger, n(`rectifier_core_${side}`), 0.065, 0.065, 0.38, [0, 0.28, 0], m.energy, [0, 0, 0], 20);
      cable(outrigger, n(`rectifier_feed_${side}`), [[0, 0.03, 0], [-side * 0.2, 0.03, -0.25], [-side * 0.42, 0.05, -0.25]], 0.024, m.gold);
      fasteners(outrigger, n(`rectifier_bolts_${side}`), [[-0.075, 0.18, -0.205], [0.075, 0.18, -0.205]], m.edge, 'z');
    }
  }

  const azimuth = group(root, n('azimuth'), [0, branch === 'B' ? 1.27 : 1.43, 0.13]);
  bearing(azimuth, n('azimuth_bearing'), 0.28, 0.14, [0, 0, 0], m, 'y');
  const elevation = group(azimuth, n('elevation'), [0, 0.16, 0]);
  for (const side of SIDES) {
    rod(azimuth, n(`elevation_yoke_${side}`), [side * 0.24, 0.01, 0], [side * 0.29, 0.16, 0], 0.065, m.hull);
    bearing(azimuth, n(`elevation_socket_${side}`), 0.1, 0.1, [side * 0.29, 0.16, 0], m, 'x');
  }
  bearing(elevation, n('elevation_bearing'), 0.19, 0.58, [0, 0, 0], m, 'x');
  box(elevation, n('receiver_spine'), [0.15, 0.74, 0.18], [0, 0.39, 0.06], m.hull);
  for (const side of SIDES) {
    rod(elevation, n(`spine_brace_${side}`), [side * 0.25, 0, 0], [side * 0.12, 0.58, 0.05], 0.026, m.edge);
  }

  const receiver = group(elevation, n('receiver'), [0, 0.42, 0]);
  torus(receiver, n('receiver_frame'), 0.36, 0.045, [0, 0.25, 0], m.gold);
  torus(receiver, n('receiver_energy_ring'), 0.275, 0.019, [0, 0.25, -0.012], m.energy);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    rod(receiver, n(`receiver_spoke_${i}`), [0, 0.25, 0], [Math.cos(a) * 0.32, 0.25 + Math.sin(a) * 0.32, 0], 0.018, m.hull);
  }
  crystal(receiver, n('receiver_focus'), 0.11, [0, 0.25, -0.03], m.core, [1, 1, 0.65]);

  const spin = group(receiver, n('phase_rotor'), [0, 0.25, 0.025]);
  arc(spin, n('phase_arc_a'), 0.315, 0.018, 0.12, 2.25, [0, 0, 0], m.accent);
  arc(spin, n('phase_arc_b'), 0.315, 0.018, Math.PI + 0.12, Math.PI + 2.25, [0, 0, 0], m.accent);
  for (const side of SIDES) sphere(spin, n(`phase_node_${side}`), 0.045, [side * 0.31, 0, 0], m.core);

  const wave = group(receiver, n('link_wave'), [0, 0.25, -0.07]);
  torus(wave, n('link_wave_outer'), 0.41, 0.012, [0, 0, 0], m.field);
  torus(wave, n('link_wave_inner'), 0.22, 0.009, [0, 0, -0.025], m.energy);

  const carriage = group(elevation, n('dock_carriage'), [0, 0.04, -0.22]);
  box(carriage, n('dock_block'), [0.3, 0.18, 0.28], [0, 0, 0], m.dark);
  cylinder(carriage, n('dock_telescopic'), 0.055, 0.055, 0.36, [0, 0, -0.25], m.edge, [Math.PI / 2, 0, 0], 20);
  torus(carriage, n('dock_contact'), 0.11, 0.022, [0, 0, -0.44], m.energy);
  for (const side of SIDES) {
    rod(carriage, n(`dock_rail_${side}`), [side * 0.11, -0.08, 0.5], [side * 0.11, -0.08, -0.39], 0.016, m.gold);
    mesh(elevation, n(`dock_fixed_guide_${side}`), annulusGeometry(0.04, 0.02, 0.26, 24), m.hull, [side * 0.11, -0.04, -0.14], [Math.PI / 2, 0, 0]);
  }

  const gateL = group(receiver, n('gate_L'), [-0.34, 0.24, 0.03], [0, 0, 0.1]);
  const gateR = group(receiver, n('gate_R'), [0.34, 0.24, 0.03], [0, 0, -0.1]);
  const gates = [gateL, gateR];
  gates.forEach((gate, index) => {
    const side = SIDES[index];
    bearing(gate, n(`gate_hinge_${side}`), 0.09, 0.16, [0, 0, 0], m, 'z');
    if (branch === 'A') {
      panel(gate, n(`wide_panel_${side}`), mirrored([[0, -0.2], [0.29, -0.12], [0.48, 0.54], [0.13, 0.73]], side), 0.075, [0, 0, 0], m.hull, [0, 0, 0], 0.025);
      panel(gate, n(`wide_inlay_${side}`), mirrored([[0.07, -0.06], [0.23, -0.02], [0.36, 0.48], [0.17, 0.56]], side), 0.022, [0, 0, -0.052], m.glass, [0, 0, 0], 0.01);
      for (let i = 0; i < 3; i++) {
        rod(gate, n(`wide_slat_${side}_${i}`), [side * 0.07, 0.05 + i * 0.17, -0.075], [side * (0.28 + i * 0.035), 0.1 + i * 0.17, -0.075], 0.017, i === 2 ? m.energy : m.edge);
      }
    } else if (branch === 'B') {
      panel(gate, n(`filter_shield_${side}`), mirrored([[0, -0.19], [0.22, -0.14], [0.29, 0.44], [0.08, 0.57]], side), 0.13, [0, 0, 0], m.armor, [0, 0, 0], 0.035);
      box(gate, n(`filter_shield_slot_${side}`), [0.12, 0.28, 0.035], [side * 0.15, 0.17, -0.08], m.dark, [0, 0, side * -0.12]);
      for (let i = 0; i < 3; i++) box(gate, n(`filter_rib_${side}_${i}`), [0.18, 0.025, 0.04], [side * 0.15, 0.05 + i * 0.11, -0.105], m.gold);
    } else {
      box(gate, n(`basic_paddle_${side}`), [0.2, 0.56, 0.085], [side * 0.08, 0.17, 0], m.hull, [0, 0, side * -0.12]);
      box(gate, n(`basic_paddle_inlay_${side}`), [0.07, 0.4, 0.025], [side * 0.09, 0.18, -0.055], m.accent, [0, 0, side * -0.12]);
      rod(gate, n(`basic_paddle_edge_${side}`), [side * 0.18, -0.08, 0], [side * 0.18, 0.42, 0], 0.018, m.edge);
    }
  });

  const crown = group(receiver, n('crown'), [0, 0.76, 0.04]);
  if (branch === 'A') {
    const fins = tier === 3 ? 5 : 3;
    for (let i = 0; i < fins; i++) {
      const x = (i - (fins - 1) / 2) * 0.17;
      const h = 0.5 - Math.abs(i - (fins - 1) / 2) * 0.055;
      panel(crown, n(`crown_fin_${i}`), [[-0.055, 0], [0.055, 0], [0.035, h], [0, h + 0.11], [-0.035, h]], 0.065, [x, 0, 0], m.hull, [0, 0, 0], 0.015);
      rod(crown, n(`crown_trace_${i}`), [x, 0.05, -0.05], [x, h - 0.02, -0.05], 0.014, m.energy);
      sphere(crown, n(`crown_tip_${i}`), 0.037, [x, h + 0.1, 0], m.core);
    }
    torus(crown, n('crown_halo'), tier === 3 ? 0.5 : 0.38, 0.025, [0, 0.18, 0.07], m.gold);
    if (tier === 3) {
      const auxSpin = group(crown, n('crown_phase_cage'), [0, 0.18, 0.07]);
      torus(auxSpin, n('crown_cage_ring'), 0.43, 0.015, [0, 0, 0], m.energy, [0, Math.PI / 2, 0]);
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3;
        crystal(auxSpin, n(`crown_cage_node_${i}`), 0.065, radial(a, 0.43, 0), m.core);
      }
      joints.auxSpin = auxSpin;
    }
  } else if (branch === 'B') {
    const filter = group(crown, n('filter_cage'));
    const rings = tier === 3 ? 5 : 3;
    for (let i = 0; i < rings; i++) {
      torus(filter, n(`filter_toroid_${i}`), 0.27 + (i % 2) * 0.035, 0.032, [0, i * 0.105, 0], i % 2 ? m.energy : m.gold, [Math.PI / 2, 0, 0]);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i + 0.5) * TAU / 4;
      rod(filter, n(`filter_cage_post_${i}`), radial(a, 0.3, -0.04), radial(a, 0.3, rings * 0.105), 0.022, m.hull);
    }
    crystal(filter, n('filter_prism'), 0.14, [0, 0.18, 0], m.core, [1, 1.8, 1]);
    joints.filter = filter;
  } else {
    rod(crown, n('crown_stem'), [0, -0.08, 0], [0, 0.36, 0], 0.035, m.edge);
    for (const side of SIDES) {
      rod(crown, n(`crown_tine_${side}`), [0, 0.18, 0], [side * 0.16, 0.5, 0], 0.025, m.gold);
      sphere(crown, n(`crown_bead_${side}`), 0.052, [side * 0.16, 0.5, 0], m.energy);
    }
    torus(crown, n('crown_loop'), 0.19, 0.022, [0, 0.26, 0], m.accent);
  }

  if (branch === 'B' && tier === 3) {
    for (let i = 0; i < 4; i++) {
      const a = (i + 0.5) * TAU / 4;
      const pod = group(root, n(`jam_sink_${i}`), radial(a, 0.68, 0.54), [0, a, 0]);
      box(pod, n(`jam_sink_foot_${i}`), [0.25, 0.16, 0.32], [0, 0, 0], m.armor);
      for (let j = 0; j < 3; j++) torus(pod, n(`jam_sink_coil_${i}_${j}`), 0.105, 0.022, [0, 0.14 + j * 0.1, 0], j === 1 ? m.energy : m.gold, [Math.PI / 2, 0, 0]);
      rod(pod, n(`jam_sink_tie_${i}`), [0, 0.05, 0], [0, 0.56, -0.43], 0.027, m.hull);
      crystal(pod, n(`jam_sink_core_${i}`), 0.075, [0, 0.26, 0], m.core, [1, 1.6, 1]);
    }
  }

  if (tier === 3) {
    for (const side of SIDES) {
      cable(root, n(`t3_bus_${side}`), [[side * 0.66, 0.43, 0.3], [side * 0.73, 0.52, 0.05], [side * 0.52, 0.85, 0.08], [side * 0.25, 1.18, 0.12]], 0.03, branch === 'A' ? m.energy : m.gold);
      panel(root, n(`t3_base_fin_${side}`), mirrored([[0, 0], [0.26, 0.03], [0.2, 0.44], [0.04, 0.57]], side), 0.09, [side * 0.46, 0.38, 0.35], branch === 'B' ? m.armor : m.hull, [0, 0, 0], 0.02);
    }
  }

  Object.assign(joints, { azimuth, elevation, receiver, spin, wave, carriage, gateL, gateR, crown });
  return { root, joints };
}

function bandwidthClips(root, joints) {
  const clips = [
    createRigClip(root, joints, 'idle', 3.2, (u, t, { set }) => {
      const s = Math.sin(TAU * u);
      set('azimuth', { r: [0, 0.13 * s, 0] });
      set('elevation', { r: [0.035 * Math.sin(TAU * u * 2), 0, 0] });
      set('spin', { r: [0, 0, TAU * u] });
      set('crown', { r: [0, 0.09 * s, 0.025 * s] });
      set('auxSpin', { r: [0, TAU * u, 0] });
      set('filter', { r: [0, 0.16 * s, 0] });
      set('core', { s: [1 + 0.045 * s, 1 + 0.07 * s, 1 + 0.045 * s] });
      set('wave', { s: [1 + 0.08 * s, 1 + 0.08 * s, 1] });
    }),
    createRigClip(root, joints, 'move', 1.6, (u, t, { set }) => {
      Object.keys(joints).filter(key => key.startsWith('anchor')).forEach((key, index) => {
        const k = pulse((u + index * 0.13) % 1, 0, 0.35, 0.8);
        set(key, { p: [0, 0.035 * k, 0] });
      });
      const k = Math.sin(Math.PI * u);
      set('azimuth', { r: [0, 0.22 * k, 0] });
      set('elevation', { r: [-0.1 * k, 0, 0] });
      set('carriage', { p: [0, 0, -0.08 * k] });
      set('core', { s: [1 + 0.08 * k, 1 + 0.08 * k, 1 + 0.08 * k] });
    }),
    createRigClip(root, joints, 'attack', 1.4, (u, t, { set }) => {
      const k = Math.sin(Math.PI * u);
      const tune = Math.sin(TAU * u * 3) * k;
      set('azimuth', { r: [0, 0.18 * k, 0] });
      set('elevation', { r: [-0.13 * k + 0.025 * tune, 0, 0] });
      set('carriage', { p: [0, 0, -0.14 * k] });
      set('gateL', { r: [0, 0, 0.13 * k] });
      set('gateR', { r: [0, 0, -0.13 * k] });
      set('spin', { r: [0, 0, 0.65 * k] });
      set('wave', { s: [1 + 0.12 * k, 1 + 0.12 * k, 1] });
    }),
    createRigClip(root, joints, 'windup', 1.25, (u, t, { set }) => {
      const k = ease(u, 0, 0.88);
      set('azimuth', { r: [0, -0.24 * k, 0] });
      set('elevation', { r: [0.16 * k, 0, 0] });
      set('gateL', { r: [0, -0.34 * k, 0.24 * k] });
      set('gateR', { r: [0, 0.34 * k, -0.24 * k] });
      set('carriage', { p: [0, 0, -0.24 * k] });
      set('receiver', { p: [0, 0.09 * k, 0] });
      set('crown', { r: [0, 0.35 * k, 0] });
      set('core', { s: [1 + 0.16 * k, 1 + 0.25 * k, 1 + 0.16 * k] });
    }),
    createRigClip(root, joints, 'release', 1.35, (u, t, { set }) => {
      const connect = pulse(u, 0, 0.24, 0.9);
      const transmit = ease(u, 0.15, 0.82);
      set('elevation', { r: [-0.18 * connect, 0, 0] });
      set('carriage', { p: [0, 0, -0.31 * connect] });
      set('gateL', { r: [0, 0.28 * connect, -0.12 * connect] });
      set('gateR', { r: [0, -0.28 * connect, 0.12 * connect] });
      set('spin', { r: [0, 0, TAU * transmit] });
      set('wave', { p: [0, 0, -0.22 * transmit], s: [0.55 + 1.25 * transmit, 0.55 + 1.25 * transmit, 1] });
      set('core', { s: [1 + 0.22 * connect, 1 + 0.22 * connect, 1 + 0.22 * connect] });
    }),
    createRigClip(root, joints, 'ability', 2.8, (u, t, { set }) => {
      const k = Math.sin(Math.PI * u);
      const s = Math.sin(TAU * u * 2);
      set('azimuth', { r: [0, 0.5 * Math.sin(Math.PI * u), 0] });
      set('elevation', { r: [0.08 * s * k, 0, 0] });
      set('spin', { r: [0, 0, TAU * u * 2] });
      set('auxSpin', { r: [0, -TAU * u * 2, 0] });
      set('filter', { r: [0, TAU * u, 0] });
      set('crown', { r: [0, -0.35 * k, 0.08 * s * k] });
      set('gateL', { r: [0, -0.3 * k, 0.2 * k] });
      set('gateR', { r: [0, 0.3 * k, -0.2 * k] });
      set('wave', { s: [0.8 + 0.8 * k, 0.8 + 0.8 * k, 1] });
      set('core', { s: [1 + 0.2 * k, 1 + 0.32 * k, 1 + 0.2 * k] });
    }),
    createRigClip(root, joints, 'shutdown', 2.1, (u, t, { set }) => {
      const k = ease(u, 0, 0.78);
      set('azimuth', { r: [0, -0.5 * k, 0] });
      set('elevation', { r: [0.72 * k, 0, 0] });
      set('receiver', { p: [0, -0.12 * k, 0] });
      set('gateL', { r: [0, 0.55 * k, -0.48 * k] });
      set('gateR', { r: [0, -0.55 * k, 0.48 * k] });
      set('carriage', { p: [0, -0.05 * k, 0.18 * k] });
      set('crown', { r: [0.55 * k, 0, 0] });
      set('wave', { s: [1 - 0.8 * k, 1 - 0.8 * k, 1] });
      set('core', { p: [0, -0.14 * k, 0], s: [1 - 0.55 * k, 1 - 0.65 * k, 1 - 0.55 * k] });
    }),
  ];
  return clips;
}

function repairArm(parent, n, m, side, label, branch, tier) {
  const shoulder = group(parent, n(`arm_${label}`), [side * 0.64, 1.12, -0.03]);
  bearing(shoulder, n(`arm_${label}_shoulder`), 0.16, 0.25, [0, 0, 0], m, 'x');
  box(shoulder, n(`arm_${label}_upper`), [0.18, 0.19, 0.54], [0, 0, -0.29], m.hull, [0, 0, 0], 0.04);
  box(shoulder, n(`arm_${label}_upper_inlay`), [0.1, 0.025, 0.34], [0, 0.108, -0.29], m.accent);
  for (const x of SIDES) {
    rod(shoulder, n(`arm_${label}_upper_edge_${x}`), [x * 0.105, -0.07, -0.05], [x * 0.105, -0.07, -0.52], 0.018, m.edge);
  }
  cable(shoulder, n(`arm_${label}_cable`), [[0, 0.13, 0.04], [side * 0.12, 0.19, -0.2], [side * 0.1, 0.13, -0.5], [0, 0.04, -0.57]], 0.022, m.energy);
  if (branch === 'A') {
    for (const x of SIDES) {
      rod(shoulder, n(`arm_${label}_servo_${x}`), [x * 0.13, 0.05, -0.08], [x * 0.13, 0.05, -0.43], 0.028, m.gold);
      rod(shoulder, n(`arm_${label}_servo_rod_${x}`), [x * 0.13, 0.05, -0.28], [x * 0.13, 0.05, -0.55], 0.014, m.core);
    }
  }

  const elbow = group(shoulder, n(`elbow_${label}`), [0, 0, -0.57], [-0.42, 0, 0]);
  bearing(elbow, n(`arm_${label}_elbow_bearing`), 0.135, 0.25, [0, 0, 0], m, 'x');
  box(elbow, n(`arm_${label}_forearm`), [0.16, 0.16, 0.44], [0, 0, -0.24], branch === 'B' ? m.armor : m.hull, [0, 0, 0], 0.035);
  rod(elbow, n(`arm_${label}_forearm_piston`), [-side * 0.11, 0.04, -0.03], [-side * 0.11, 0.04, -0.44], 0.022, m.gold);
  if (branch === 'B') {
    panel(elbow, n(`arm_${label}_forearm_shield`), [[-0.13, -0.05], [0.13, -0.05], [0.16, 0.3], [0, 0.4], [-0.16, 0.3]], 0.055, [0, 0.1, -0.22], m.armor, [Math.PI / 2, 0, 0], 0.018);
    box(elbow, n(`arm_${label}_armor_bus`), [0.05, 0.04, 0.3], [side * 0.1, 0.07, -0.25], m.energy);
  }

  const wrist = group(elbow, n(`wrist_${label}`), [0, 0, -0.48]);
  bearing(wrist, n(`arm_${label}_wrist_bearing`), 0.105, 0.2, [0, 0, 0], m, 'x');
  cylinder(wrist, n(`arm_${label}_tool_body`), 0.09, 0.115, 0.22, [0, 0, -0.13], m.dark, [Math.PI / 2, 0, 0], 20);
  torus(wrist, n(`arm_${label}_tool_collar`), 0.095, 0.02, [0, 0, -0.22], m.gold);
  cylinder(wrist, n(`arm_${label}_welder_nozzle`), 0.035, 0.065, 0.16, [0, 0, -0.28], m.edge, [Math.PI / 2, 0, 0], 16);
  const weld = group(wrist, n(`weld_${label}`), [0, 0, -0.375]);
  sphere(weld, n(`arm_${label}_weld_focus`), 0.052, [0, 0, 0], m.core, [1, 1, 1.35]);
  torus(weld, n(`arm_${label}_weld_halo`), 0.085, 0.01, [0, 0, 0], m.energy);
  const nozzleCage = group(wrist, n(`nozzle_cage_${label}`), [0, 0, -0.375]);
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3;
    rod(nozzleCage, n(`arm_${label}_weld_prong_${i}`), [Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0.07], [Math.cos(a) * 0.045, Math.sin(a) * 0.045, -0.025], 0.009, m.gold, 10);
  }
  if (branch === 'B') {
    for (const x of SIDES) {
      box(wrist, n(`arm_${label}_clamp_finger_${x}`), [0.055, 0.12, 0.24], [x * 0.13, -0.025, -0.19], m.armor, [0, x * 0.18, 0]);
      box(wrist, n(`arm_${label}_clamp_pad_${x}`), [0.07, 0.08, 0.06], [x * 0.13, -0.025, -0.32], m.gold);
    }
  }
  if (tier === 3) {
    torus(shoulder, n(`arm_${label}_servo_gyro`), 0.19, 0.018, [0, 0, 0], m.energy, [0, Math.PI / 2, 0]);
    crystal(elbow, n(`arm_${label}_memory_diagnostics`), 0.065, [0, 0.13, -0.22], m.core);
  }
  return { shoulder, elbow, wrist, weld };
}

function plateRack(parent, n, m, side, tier) {
  const rack = group(parent, n(`plate_rack_${side}`), [side * 0.73, 0.42, 0.28], [0, -side * 0.16, 0]);
  box(rack, n(`plate_rack_base_${side}`), [0.35, 0.12, 0.54], [0, 0.06, 0], m.dark);
  for (let i = 0; i < (tier === 3 ? 5 : 3); i++) {
    const plate = group(rack, n(`memory_plate_${side}_${i}`), [0, 0.3 + i * 0.025, -0.16 + i * 0.085], [-0.12, 0, 0]);
    panel(plate, n(`armor_patch_${side}_${i}`), [[-0.16, -0.22], [0.16, -0.22], [0.19, 0.14], [0.1, 0.24], [-0.1, 0.24], [-0.19, 0.14]], 0.045, [0, 0, 0], m.armor, [0, 0, 0], 0.018);
    box(plate, n(`armor_patch_trace_${side}_${i}`), [0.035, 0.28, 0.02], [0, 0, -0.035], m.accent);
    fasteners(plate, n(`armor_patch_bolts_${side}_${i}`), [[-0.1, -0.14, -0.038], [0.1, -0.14, -0.038], [0, 0.15, -0.038]], m.edge, 'z', 0.018);
  }
  return rack;
}

function buildMemoryMechanic(variant) {
  const id = 'memory_mechanic';
  const root = modelRoot(id, variant);
  const n = part => `${id}_${variant}_${part}`;
  const m = palette('ally');
  const joints = foundation(root, n, m, 'mechanic');
  const tier = Number(variant[1]);
  const branch = variant.endsWith('A') ? 'A' : variant.endsWith('B') ? 'B' : 'T';

  const bank = group(root, n('memory_bank'), [0, 0.48, 0.4]);
  box(bank, n('bank_back'), [1.08, 0.65, 0.16], [0, 0.32, 0.15], m.hull, [0, 0, 0], 0.045);
  box(bank, n('bank_lower_bus'), [1.18, 0.12, 0.4], [0, 0.04, 0], m.dark);
  for (const side of SIDES) {
    box(bank, n(`bank_side_${side}`), [0.12, 0.72, 0.38], [side * 0.52, 0.34, 0], m.armor);
    cable(bank, n(`bank_cable_${side}`), [[side * 0.46, 0.02, -0.12], [side * 0.58, -0.05, -0.2], [side * 0.6, -0.08, -0.55]], 0.025, m.energy);
  }
  const cells = group(bank, n('memory_cells'), [0, 0.1, -0.05]);
  const cellCount = tier === 3 ? 5 : tier === 2 ? 4 : 3;
  for (let i = 0; i < cellCount; i++) {
    const x = (i - (cellCount - 1) / 2) * (tier === 3 ? 0.19 : 0.25);
    cylinder(cells, n(`cell_${i}_glass`), 0.085, 0.085, 0.47, [x, 0.28, 0], m.glass, [0, 0, 0], 20);
    crystal(cells, n(`cell_${i}_memory`), 0.075, [x, 0.28, 0], i % 2 ? m.energy : m.core, [0.75, 2.25, 0.75], [0, i * 0.4, 0]);
    cylinder(cells, n(`cell_${i}_base`), 0.105, 0.115, 0.09, [x, 0.045, 0], m.dark, [0, 0, 0], 20);
    cylinder(cells, n(`cell_${i}_cap`), 0.115, 0.1, 0.09, [x, 0.52, 0], m.edge, [0, 0, 0], 20);
    torus(cells, n(`cell_${i}_seal`), 0.088, 0.013, [x, 0.43, 0], m.gold, [Math.PI / 2, 0, 0]);
  }

  const railY = branch === 'A' ? 1.82 : branch === 'B' ? 1.62 : 1.48;
  const gantry = group(root, n('service_gantry'));
  for (const side of SIDES) {
    box(gantry, n(`gantry_post_${side}`), [0.13, railY - 0.38, 0.17], [side * 0.57, (railY + 0.38) / 2, -0.12], m.hull);
    box(gantry, n(`gantry_post_trim_${side}`), [0.035, railY - 0.58, 0.025], [side * 0.57, (railY + 0.48) / 2, -0.22], m.gold);
    rod(gantry, n(`gantry_brace_${side}`), [side * 0.57, 0.47, -0.12], [side * 0.39, 0.87, -0.12], 0.025, m.edge);
  }
  box(gantry, n('gantry_crossbeam'), [1.3, 0.16, 0.28], [0, railY, -0.12], m.hull);
  box(gantry, n('gantry_slide_rail'), [1.05, 0.055, 0.07], [0, railY - 0.11, -0.28], m.edge);
  for (let i = 0; i < 5; i++) box(gantry, n(`gantry_scale_${i}`), [0.025, 0.055, 0.018], [-0.4 + i * 0.2, railY + 0.015, -0.27], m.accent);

  const carriage = group(root, n('carriage'), [0, railY - 0.15, -0.22]);
  box(carriage, n('carriage_block'), [0.34, 0.2, 0.3], [0, 0, 0], m.dark, [0, 0, 0], 0.035);
  for (const side of SIDES) cylinder(carriage, n(`carriage_wheel_${side}`), 0.075, 0.075, 0.07, [side * 0.18, 0.07, 0], m.gold, [0, 0, Math.PI / 2], 20);
  const aux = group(carriage, n('aux'), [0, -0.12, 0]);
  const auxGuide = group(carriage, n('aux_fixed_guide'), [0, -0.12, 0]);
  mesh(auxGuide, n('aux_outer_ram'), annulusGeometry(0.085, 0.052, 0.32, 24), m.hull, [0, -0.15, 0]);
  cylinder(aux, n('aux_inner_ram'), 0.045, 0.045, 0.72, [0, -0.2, 0], m.edge, [0, 0, 0], 24);
  torus(auxGuide, n('aux_ram_seal'), 0.085, 0.017, [0, -0.3, 0], m.energy, [Math.PI / 2, 0, 0]);
  const scanner = group(aux, n('scanner'), [0, -0.53, -0.02]);
  torus(scanner, n('scanner_ring'), 0.18, 0.025, [0, 0, 0], m.gold);
  arc(scanner, n('scanner_live_arc'), 0.14, 0.015, 0, Math.PI * 1.45, [0, 0, -0.015], m.energy);
  crystal(scanner, n('scanner_focus'), 0.07, [0, 0, -0.025], m.core, [1, 1, 0.6]);
  for (const side of SIDES) box(scanner, n(`scanner_jaw_${side}`), [0.055, 0.13, 0.09], [side * 0.19, 0, 0], m.armor);

  const shuttle = group(root, n('shuttle'), [0, 0.43, -0.55]);
  box(shuttle, n('work_cradle'), [0.72, 0.15, 0.54], [0, 0.075, 0], m.dark, [0, 0, 0], 0.04);
  box(shuttle, n('work_cradle_trim'), [0.62, 0.035, 0.46], [0, 0.165, 0], m.edge);
  const workpiece = group(shuttle, n('workpiece'), [0, 0.22, 0]);
  panel(workpiece, n('ally_plate'), [[-0.24, -0.16], [0.24, -0.16], [0.28, 0.09], [0.15, 0.2], [-0.15, 0.2], [-0.28, 0.09]], 0.09, [0, 0, 0], m.armor, [Math.PI / 2, 0, 0], 0.025);
  cable(workpiece, n('ally_plate_circuit'), [[-0.17, 0.06, -0.1], [-0.05, 0.06, 0], [0.12, 0.06, 0.03], [0.18, 0.06, 0.12]], 0.014, m.energy);
  crystal(workpiece, n('ally_memory_socket'), 0.07, [0, 0.09, 0], m.core, [1, 0.45, 1]);
  for (const side of SIDES) {
    const clamp = group(shuttle, n(`clamp_${side}`), [side * 0.34, 0.18, 0]);
    bearing(clamp, n(`cradle_hinge_${side}`), 0.075, 0.14, [0, 0, 0], m, 'z');
    box(clamp, n(`cradle_jaw_${side}`), [0.09, 0.24, 0.22], [-side * 0.04, 0.11, 0], m.hull, [0, 0, side * 0.18]);
    box(clamp, n(`cradle_pad_${side}`), [0.08, 0.08, 0.18], [-side * 0.1, 0.22, 0], m.gold);
    joints[side < 0 ? 'clampL' : 'clampR'] = clamp;
  }

  const press = group(root, n('press'), [0, 1.36, -0.47]);
  const pressGuide = group(gantry, n('press_fixed_guide'), [0, 1.36, -0.47]);
  mesh(pressGuide, n('press_guide_sleeve'), annulusGeometry(branch === 'B' ? 0.18 : 0.12, branch === 'B' ? 0.13 : 0.08, 0.5, 32), m.dark, [0, 0.05, 0]);
  rod(gantry, n('press_gantry_bridge'), [0, railY - 0.04, -0.13], [0, 1.56, -0.47], 0.065, m.gold);
  cylinder(press, n('press_ram'), branch === 'B' ? 0.1 : 0.055, branch === 'B' ? 0.12 : 0.07, 0.7, [0, 0.025, 0], m.hull, [0, 0, 0], 24);
  box(press, n('press_pad'), [branch === 'B' ? 0.28 : 0.2, 0.09, branch === 'B' ? 0.22 : 0.18], [0, -0.36, 0], branch === 'B' ? m.armor : m.gold);
  box(press, n('press_contact'), [branch === 'B' ? 0.22 : 0.12, 0.025, branch === 'B' ? 0.17 : 0.12], [0, -0.42, 0], m.energy);

  const left = repairArm(root, n, m, -1, 'L', branch, tier);
  const right = repairArm(root, n, m, 1, 'R', branch, tier);

  if (branch === 'A') {
    for (const side of SIDES) {
      const pod = group(root, n(`emergency_pod_${side}`), [side * 0.72, 0.72, 0.24]);
      cylinder(pod, n(`emergency_canister_${side}`), 0.115, 0.14, 0.56, [0, 0.18, 0], m.glass, [0, 0, 0], 24);
      crystal(pod, n(`emergency_memory_${side}`), 0.105, [0, 0.18, 0], m.core, [0.8, 2.1, 0.8]);
      for (const y of [-0.08, 0.43]) torus(pod, n(`emergency_band_${side}_${y}`), 0.13, 0.025, [0, y, 0], m.gold, [Math.PI / 2, 0, 0]);
      cable(pod, n(`emergency_feed_${side}`), [[0, -0.09, 0], [-side * 0.12, -0.18, -0.15], [-side * 0.25, -0.19, -0.46]], 0.027, m.energy);
    }
    box(gantry, n('emergency_upper_rail'), [1.48, 0.09, 0.18], [0, railY + 0.18, -0.1], m.armor);
    if (tier === 3) {
      for (const side of SIDES) {
        const micro = group(carriage, n(`aux_${side}`), [side * 0.31, -0.02, 0], [0.15, 0, side * 0.25]);
        bearing(micro, n(`micro_shoulder_${side}`), 0.1, 0.16, [0, 0, 0], m, 'x');
        box(micro, n(`micro_upper_${side}`), [0.1, 0.12, 0.38], [0, 0, -0.21], m.armor);
        const microTip = group(micro, n(`micro_tip_${side}`), [0, 0, -0.43], [-0.5, 0, 0]);
        bearing(microTip, n(`micro_wrist_${side}`), 0.075, 0.13, [0, 0, 0], m, 'x');
        rod(microTip, n(`micro_probe_${side}`), [0, 0, 0], [0, 0, -0.32], 0.035, m.edge);
        sphere(microTip, n(`micro_weld_${side}`), 0.052, [0, 0, -0.34], m.core);
        torus(microTip, n(`micro_weld_ring_${side}`), 0.075, 0.012, [0, 0, -0.32], m.energy);
        joints[side < 0 ? 'auxL' : 'auxR'] = micro;
        joints[side < 0 ? 'microTipL' : 'microTipR'] = microTip;
      }
      const crown = group(bank, n('triage_crown'), [0, 0.92, 0.05]);
      torus(crown, n('triage_crown_ring'), 0.51, 0.035, [0, 0, 0], m.gold, [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 5; i++) {
        const a = (i + 0.5) * TAU / 5;
        crystal(crown, n(`triage_node_${i}`), 0.075, radial(a, 0.5, 0), i % 2 ? m.core : m.energy, [1, 1.5, 1]);
      }
      joints.triageCrown = crown;
    }
  }

  if (branch === 'B') {
    for (const side of SIDES) plateRack(root, n, m, side, tier);
    for (const side of SIDES) {
      const roller = group(root, n(`roller_${side}`), [side * 0.34, 0.85, -0.42]);
      cylinder(roller, n(`applicator_drum_${side}`), 0.13, 0.13, 0.28, [0, 0, 0], m.gold, [0, 0, Math.PI / 2], 24);
      for (const x of SIDES) torus(roller, n(`applicator_rim_${side}_${x}`), 0.13, 0.02, [x * 0.15, 0, 0], m.edge, [0, Math.PI / 2, 0]);
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8;
        box(roller, n(`applicator_tooth_${side}_${i}`), [0.22, 0.035, 0.045], [0, Math.cos(a) * 0.14, Math.sin(a) * 0.14], m.armor, [a, 0, 0]);
      }
      joints[side < 0 ? 'rollerL' : 'rollerR'] = roller;
    }
    if (tier === 3) {
      for (const side of SIDES) {
        const petal = group(root, n(`armor_petal_${side}`), [side * 0.68, 0.85, 0.05], [0, 0, -side * 0.12]);
        bearing(petal, n(`armor_petal_hinge_${side}`), 0.13, 0.22, [0, 0, 0], m, 'x');
        panel(petal, n(`armor_petal_shell_${side}`), mirrored([[0, -0.12], [0.27, -0.02], [0.34, 0.58], [0.13, 0.79], [0, 0.64]], side), 0.11, [0, 0, 0], m.armor, [0, 0, 0], 0.03);
        panel(petal, n(`armor_petal_inlay_${side}`), mirrored([[0.07, 0.06], [0.2, 0.1], [0.24, 0.5], [0.14, 0.61]], side), 0.025, [0, 0, -0.075], m.accent, [0, 0, 0], 0.01);
        cable(petal, n(`armor_petal_feed_${side}`), [[0, 0, 0.08], [side * 0.18, 0.2, 0.09], [side * 0.18, 0.52, 0.09]], 0.025, m.energy);
        joints[side < 0 ? 'petalL' : 'petalR'] = petal;
      }
      box(gantry, n('overwrite_bridge'), [1.54, 0.22, 0.38], [0, railY + 0.17, -0.12], m.armor);
      for (let i = 0; i < 4; i++) box(gantry, n(`overwrite_bridge_rib_${i}`), [0.07, 0.28, 0.43], [-0.45 + i * 0.3, railY + 0.17, -0.12], m.hull);
    }
  }

  if (tier >= 2) {
    for (const side of SIDES) {
      cable(root, n(`service_bus_${side}`), [[side * 0.42, 0.42, 0.4], [side * 0.58, 0.45, 0.1], [side * 0.58, 0.46, -0.4], [side * 0.31, 0.5, -0.58]], 0.028, m.energy);
      box(root, n(`service_skirt_${side}`), [0.13, 0.36, 0.68], [side * 0.7, 0.52, -0.12], branch === 'B' ? m.armor : m.hull, [0, 0, 0], 0.035);
    }
  }

  Object.assign(joints, {
    cells, carriage, aux, scanner, shuttle, workpiece, press,
    armL: left.shoulder, elbowL: left.elbow, wristL: left.wrist, weldL: left.weld,
    armR: right.shoulder, elbowR: right.elbow, wristR: right.wrist, weldR: right.weld,
  });
  poseRepairArms(joints, (key, value) => joints[key].rotation.fromArray(value.r));
  return { root, joints };
}

function poseRepairArms(joints, raw, work = 0, scan = 0, lift = 0, workpieceLift = 0) {
  const amount = Math.max(0, Math.min(1, work));
  for (const [label, side] of [['L', -1], ['R', 1]]) {
    const origin = joints[`arm${label}`].position;
    const x = side * (0.54 + (0.2 - 0.54) * amount);
    const y = 0.85 + (0.73 - 0.85) * amount + lift + workpieceLift;
    const z = -0.82 + 0.135 * amount + scan * 0.02;
    const dx = x - origin.x, dz = z - origin.z, dy = y + 0.375 - origin.y;
    const reach = Math.hypot(dx, dz), distance = Math.hypot(reach, dy);
    const upper = 0.57, forearm = 0.48;
    const elbow = -Math.acos(Math.max(-1, Math.min(1, (distance * distance - upper * upper - forearm * forearm) / (2 * upper * forearm))));
    const shoulder = Math.atan2(dy, reach) - Math.atan2(forearm * Math.sin(elbow), upper + forearm * Math.cos(elbow));
    const yaw = Math.atan2(-dx, -dz);
    const orientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), shoulder));
    raw(`arm${label}`, { r: new THREE.Euler().setFromQuaternion(orientation).toArray().slice(0, 3) });
    raw(`elbow${label}`, { r: [elbow, 0, 0] });
    raw(`wrist${label}`, { r: [-Math.PI / 2 - shoulder - elbow, 0, 0] });
  }
}

function memoryClips(root, joints) {
  const branch = root.userData.variant.endsWith('A') ? 'A' : root.userData.variant.endsWith('B') ? 'B' : 'T';
  const arms = (raw, work = 0, scan = 0, lift = 0, workpieceLift = 0) => poseRepairArms(joints, raw, work, scan, lift, workpieceLift);
  return [
    createRigClip(root, joints, 'idle', 3.4, (u, t, { set, raw }) => {
      const s = Math.sin(TAU * u);
      arms(raw, 0, s, 0.012 * s);
      set('scanner', { r: [0, 0.18 * s, 0.1 * s] });
      set('cells', { p: [0, 0.018 * s, 0] });
      set('core', { s: [1 + 0.04 * s, 1 + 0.06 * s, 1 + 0.04 * s] });
      set('weldL', { s: [0.8 + 0.12 * s, 0.8 + 0.12 * s, 0.8 + 0.12 * s] });
      set('weldR', { s: [0.8 - 0.12 * s, 0.8 - 0.12 * s, 0.8 - 0.12 * s] });
      set('triageCrown', { r: [0, 0.16 * s, 0] });
    }),
    createRigClip(root, joints, 'move', 1.7, (u, t, { set, raw }) => {
      Object.keys(joints).filter(key => key.startsWith('anchor')).forEach((key, index) => {
        const k = pulse((u + index * 0.17) % 1, 0, 0.35, 0.82);
        set(key, { p: [0, 0.03 * k, 0] });
      });
      const k = Math.sin(Math.PI * u);
      arms(raw, 0, 0, 0.08 * k);
      set('carriage', { p: [0.22 * Math.sin(TAU * u) * k, 0, 0] });
      set('shuttle', { p: [0, 0, -0.09 * k] });
      set('scanner', { r: [0, 0, 0.5 * k] });
    }),
    createRigClip(root, joints, 'attack', 1.55, (u, t, { set, raw }) => {
      const k = Math.sin(Math.PI * u);
      const stroke = Math.sin(TAU * u * 2) * k;
      arms(raw, k, stroke);
      set('carriage', { p: [0.16 * stroke, 0, 0] });
      set('aux', { p: [0, -0.12 * k, 0] });
      set('scanner', { r: [0, 0.25 * stroke, 0.4 * k] });
      set('weldL', { s: [0.5 + 0.9 * k, 0.5 + 0.9 * k, 0.5 + 0.9 * k] });
      set('weldR', { s: [0.5 + 0.9 * k, 0.5 + 0.9 * k, 0.5 + 0.9 * k] });
      set('press', { p: [0, branch === 'B' ? -0.18 * k : -0.05 * k, 0] });
      set('rollerL', { r: [0.7 * k, 0, 0] });
      set('rollerR', { r: [-0.7 * k, 0, 0] });
    }),
    createRigClip(root, joints, 'windup', 1.35, (u, t, { set, raw }) => {
      const k = ease(u, 0, 0.88);
      arms(raw, 0, 0, 0.12 * k);
      set('clampL', { r: [0, 0, -0.55 * k] });
      set('clampR', { r: [0, 0, 0.55 * k] });
      set('carriage', { p: [0, 0.08 * k, 0.08 * k] });
      set('aux', { p: [0, 0.18 * k, 0] });
      set('scanner', { r: [0.25 * k, 0, -0.6 * k] });
      set('cells', { p: [0, 0.09 * k, 0] });
      set('workpiece', { r: [0.16 * k, 0, 0] });
      set('petalL', { r: [0, -0.35 * k, 0.2 * k] });
      set('petalR', { r: [0, 0.35 * k, -0.2 * k] });
    }),
    createRigClip(root, joints, 'release', 1.65, (u, t, { set, raw }) => {
      const reach = pulse(u, 0, 0.34, 0.94);
      const weld = pulse(u, 0.2, 0.5, 0.82);
      arms(raw, reach, 0, 0, branch === 'B' ? 0 : 0.05 * weld);
      set('clampL', { r: [0, 0, 0.38 * reach] });
      set('clampR', { r: [0, 0, -0.38 * reach] });
      set('aux', { p: [0, -0.24 * reach, 0] });
      set('scanner', { r: [0, 0, 0.8 * reach] });
      set('weldL', { s: [0.35 + 1.45 * weld, 0.35 + 1.45 * weld, 0.35 + 1.45 * weld] });
      set('weldR', { s: [0.35 + 1.45 * weld, 0.35 + 1.45 * weld, 0.35 + 1.45 * weld] });
      set('cells', { p: [0, 0.14 * weld, 0], s: [1, 1 + 0.12 * weld, 1] });
      set('press', { p: [0, branch === 'B' ? -0.2175 * reach : -0.08 * reach, 0] });
      set('rollerL', { r: [TAU * reach, 0, 0] });
      set('rollerR', { r: [-TAU * reach, 0, 0] });
      set('workpiece', { p: [0, branch === 'B' ? 0 : 0.05 * weld, 0] });
    }),
    createRigClip(root, joints, 'ability', 3.1, (u, t, { set, raw }) => {
      const k = Math.sin(Math.PI * u);
      const work = Math.sin(TAU * u * 3) * k;
      arms(raw, k, work);
      set('carriage', { p: [0.34 * Math.sin(TAU * u) * k, -0.06 * k, 0] });
      set('aux', { p: [0, -0.27 * k, 0] });
      set('scanner', { r: [0, 0.5 * work, TAU * u] });
      set('cells', { p: [0, 0.19 * k, 0], s: [1 + 0.06 * k, 1 + 0.16 * k, 1 + 0.06 * k] });
      set('core', { s: [1 + 0.2 * k, 1 + 0.3 * k, 1 + 0.2 * k] });
      set('weldL', { s: [0.5 + 1.2 * k, 0.5 + 1.2 * k, 0.5 + 1.2 * k] });
      set('weldR', { s: [0.5 + 1.2 * k, 0.5 + 1.2 * k, 0.5 + 1.2 * k] });
      set('triageCrown', { r: [0, TAU * u, 0] });
      set('auxL', { r: [-0.35 * k, 0.25 * work, 0.25 * k] });
      set('auxR', { r: [-0.35 * k, -0.25 * work, -0.25 * k] });
      set('microTipL', { r: [-0.5 * k + 0.15 * work, 0, 0] });
      set('microTipR', { r: [-0.5 * k - 0.15 * work, 0, 0] });
      set('press', { p: [0, branch === 'B' ? -0.2175 * k : -0.12 * k, 0] });
      set('rollerL', { r: [TAU * u * 2, 0, 0] });
      set('rollerR', { r: [-TAU * u * 2, 0, 0] });
      set('petalL', { r: [0, -0.4 * k, 0.28 * k] });
      set('petalR', { r: [0, 0.4 * k, -0.28 * k] });
      set('clampL', { r: [0, 0, 0.35 * k] });
      set('clampR', { r: [0, 0, -0.35 * k] });
    }),
    createRigClip(root, joints, 'shutdown', 2.25, (u, t, { set, raw }) => {
      const k = ease(u, 0, 0.8);
      arms(raw, 0, 0, -0.1 * k);
      set('carriage', { p: [-0.31 * k, -0.18 * k, 0.12 * k] });
      set('aux', { p: [0, 0.26 * k, 0] });
      set('scanner', { r: [0.85 * k, 0, 0] });
      set('shuttle', { p: [0, 0, 0.13 * k] });
      set('clampL', { r: [0, 0, -0.5 * k] });
      set('clampR', { r: [0, 0, 0.5 * k] });
      set('press', { p: [0, 0.28 * k, 0] });
      set('cells', { p: [0, -0.2 * k, 0], s: [1, 1 - 0.25 * k, 1] });
      set('weldL', { s: [1 - 0.75 * k, 1 - 0.75 * k, 1 - 0.75 * k] });
      set('weldR', { s: [1 - 0.75 * k, 1 - 0.75 * k, 1 - 0.75 * k] });
      set('petalL', { r: [0, 0.45 * k, -0.55 * k] });
      set('petalR', { r: [0, -0.45 * k, 0.55 * k] });
      set('core', { p: [0, -0.12 * k, 0], s: [1 - 0.5 * k, 1 - 0.6 * k, 1 - 0.5 * k] });
    }),
  ];
}

function tuningVoice(parent, name, m, height, width, branch) {
  cylinder(parent, `${name}_foot`, width * 0.65, width * 0.82, 0.14, [0, 0.07, 0], m.dark, [0, 0, 0], 24);
  torus(parent, `${name}_foot_ring`, width * 0.65, 0.022, [0, 0.14, 0], m.energy, [Math.PI / 2, 0, 0]);
  if (branch === 'B') {
    resonantPipe(parent, `${name}_bass_tube`, m, width * 0.28, height * 0.7, [0, 0.13, 0]);
    lathe(parent, `${name}_bell`, [[0.08, 0], [0.09, 0.08], [0.13, 0.17], [0.23, 0.27], [0.25, 0.31], [0.21, 0.32], [0.18, 0.27], [0.1, 0.17], [0.06, 0.06]], [0, height * 0.65, 0], m.gold);
    torus(parent, `${name}_bell_lip`, 0.235, 0.025, [0, height * 0.65 + 0.3, 0], m.edge, [Math.PI / 2, 0, 0]);
    for (const side of SIDES) {
      box(parent, `${name}_weighted_reed_${side}`, [0.075, height * 0.63, 0.09], [side * width * 0.55, height * 0.46, 0], m.hull);
      box(parent, `${name}_reed_weight_${side}`, [0.13, 0.16, 0.15], [side * width * 0.55, height * 0.79, 0], m.armor);
      box(parent, `${name}_reed_trace_${side}`, [0.025, height * 0.4, 0.018], [side * width * 0.55, height * 0.43, -0.055], m.energy);
    }
    cylinder(parent, `${name}_pendulum_rod`, 0.018, 0.018, height * 0.48, [0, height * 0.48, -0.13], m.edge, [0, 0, 0], 12);
    sphere(parent, `${name}_pendulum_weight`, 0.09, [0, height * 0.25, -0.13], m.gold, [1, 1.2, 1]);
  } else {
    box(parent, `${name}_stem`, [width * 0.35, height * 0.42, 0.13], [0, height * 0.25, 0], m.hull);
    box(parent, `${name}_shoulder`, [width * 1.35, 0.12, 0.16], [0, height * 0.43, 0], m.gold);
    for (const side of SIDES) {
      box(parent, `${name}_tine_${side}`, [0.075, height * 0.54, 0.11], [side * width * 0.55, height * 0.72, 0], m.gold);
      box(parent, `${name}_tine_face_${side}`, [0.025, height * 0.43, 0.02], [side * width * 0.55, height * 0.72, -0.065], m.energy);
      crystal(parent, `${name}_tine_tip_${side}`, 0.055, [side * width * 0.55, height + 0.02, 0], m.core, [0.8, 1.25, 0.8]);
    }
    arc(parent, `${name}_tuning_arch`, width * 0.56, 0.025, Math.PI, TAU, [0, height * 0.43, 0], m.edge, [0, 0, Math.PI]);
  }
}

function horn(parent, name, m, position, rotation, size = 1) {
  const bell = group(parent, `${name}_assembly`, position, rotation);
  lathe(bell, `${name}_shell`, [[0.065 * size, 0], [0.07 * size, 0.13 * size], [0.11 * size, 0.25 * size], [0.21 * size, 0.39 * size], [0.29 * size, 0.47 * size], [0.3 * size, 0.51 * size], [0.26 * size, 0.52 * size], [0.18 * size, 0.4 * size], [0.08 * size, 0.24 * size], [0.045 * size, 0.05 * size]], [0, 0, 0], m.gold);
  torus(bell, `${name}_rim`, 0.28 * size, 0.025 * size, [0, 0.5 * size, 0], m.edge, [Math.PI / 2, 0, 0]);
  torus(bell, `${name}_live_band`, 0.15 * size, 0.014 * size, [0, 0.32 * size, 0], m.energy, [Math.PI / 2, 0, 0]);
  rod(bell, `${name}_support`, [0, -0.13 * size, 0], [0, 0.12 * size, 0], 0.035 * size, m.hull);
  return bell;
}

function buildFrequencyChoir(variant) {
  const id = 'frequency_choir';
  const root = modelRoot(id, variant);
  const n = part => `${id}_${variant}_${part}`;
  const m = palette('ally');
  const joints = foundation(root, n, m, 'choir');
  const tier = Number(variant[1]);
  const branch = variant.endsWith('A') ? 'A' : variant.endsWith('B') ? 'B' : 'T';

  const organ = group(root, n('organ'), [0, 0.4, 0.08]);
  lathe(organ, n('central_resonance_chamber'), [[0.26, 0], [0.32, 0.08], [0.3, 0.22], [0.22, 0.42], [0.24, 0.56], [0.31, 0.65], [0.29, 0.72], [0.2, 0.72], [0.17, 0.58], [0.15, 0.25], [0.2, 0.05]], [0, 0, 0], m.hull);
  torus(organ, n('chamber_lower_band'), 0.31, 0.026, [0, 0.14, 0], m.gold, [Math.PI / 2, 0, 0]);
  torus(organ, n('chamber_upper_band'), 0.28, 0.026, [0, 0.64, 0], m.energy, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    rod(organ, n(`chamber_rib_${i}`), radial(a, 0.29, 0.12), radial(a, 0.22, 0.55), 0.019, m.edge);
  }

  const voiceL = group(root, n('voice_L'), [-0.48, 0.45, -0.02]);
  const voiceR = group(root, n('voice_R'), [0.48, 0.45, -0.02]);
  const voiceC = group(root, n('voice_C'), [0, 0.54, 0.28]);
  const sideHeight = branch === 'A' ? 1.22 : branch === 'B' ? 0.98 : 1.02;
  tuningVoice(voiceL, n('left_voice'), m, sideHeight, branch === 'B' ? 0.31 : 0.27, branch);
  tuningVoice(voiceR, n('right_voice'), m, sideHeight, branch === 'B' ? 0.31 : 0.27, branch);
  tuningVoice(voiceC, n('center_voice'), m, branch === 'A' ? 1.34 : 1.08, 0.25, branch);

  const centerHeight = branch === 'A' ? 1.34 : 1.08;
  const damperL = group(voiceL, n('damper_L'), [0, sideHeight + 0.13, 0]);
  const damperR = group(voiceR, n('damper_R'), [0, sideHeight + 0.13, 0]);
  const damperC = group(voiceC, n('damper_C'), [0, centerHeight + 0.13, 0]);
  [[damperL, 'L'], [damperR, 'R'], [damperC, 'C']].forEach(([damper, label]) => {
    const voice = damper.parent, height = label === 'C' ? centerHeight : sideHeight;
    box(damper, n(`damper_bridge_${label}`), [0.42, 0.075, 0.17], [0, 0, 0], m.hull);
    for (const side of SIDES) {
      rod(voice, n(`damper_stanchion_${label}_${side}`), [side * 0.23, 0.12, 0.12], [side * 0.23, height + 0.32, 0.12], 0.027, m.hull, 24);
      rod(voice, n(`damper_yoke_${label}_${side}`), [side * 0.23, height + 0.32, 0.12], [side * 0.15, height + 0.25, 0], 0.035, m.gold, 24);
      mesh(voice, n(`damper_guide_${label}_${side}`), annulusGeometry(0.052, 0.03, 0.22, 24), m.dark, [side * 0.15, height + 0.25, 0]);
      cylinder(damper, n(`damper_piston_${label}_${side}`), 0.025, 0.025, 0.65, [side * 0.15, 0.13, 0], m.edge, [0, 0, 0], 24);
      box(damper, n(`damper_pad_${label}_${side}`), [0.1, 0.075, 0.14], [side * 0.15, -0.07, 0], m.dark);
    }
    crystal(damper, n(`damper_indicator_${label}`), 0.047, [0, 0.075, -0.09], m.energy);
  });

  const halo = group(root, n('halo'), [0, 1.16, 0.08]);
  torus(halo, n('harmonic_halo_frame'), 0.57, 0.035, [0, 0, 0], m.gold);
  arc(halo, n('harmonic_halo_live_arc'), 0.51, 0.018, 0.15, Math.PI * 1.65, [0, 0, -0.025], m.energy);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    crystal(halo, n(`harmonic_node_${i}`), 0.055, [Math.cos(a) * 0.57, Math.sin(a) * 0.57, 0], i % 2 ? m.core : m.accent);
  }
  const counterHalo = group(root, n('counter_halo'), [0, 0.82, 0.05]);
  torus(counterHalo, n('counter_halo_ring'), 0.68, 0.025, [0, 0, 0], m.edge, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const a = (i + 0.5) * TAU / 4;
    const p = radial(a, 0.68, 0);
    box(counterHalo, n(`counterweight_${i}`), [0.12, 0.14, 0.18], p, branch === 'B' ? m.armor : m.hull, [0, a, 0]);
    sphere(counterHalo, n(`counterweight_node_${i}`), 0.038, [p[0], 0.09, p[2]], m.energy);
  }

  rod(root, n('conductor_stand'), [0, 0.4, -0.5], [0, 1.18, -0.5], 0.045, m.hull);
  const conductor = group(root, n('conductor'), [0, 1.18, -0.5]);
  bearing(conductor, n('conductor_bearing'), 0.12, 0.3, [0, 0, 0], m, 'x');
  const mallet = group(conductor, n('mallet'), [0, 0, 0], [0.2, 0, 0]);
  rod(mallet, n('mallet_arm'), [0, 0, 0], [0, 0.31, 0.04], 0.025, m.edge);
  sphere(mallet, n('mallet_head'), 0.09, [0, 0.34, 0.05], m.gold, [1.25, 0.85, 0.85]);
  crystal(mallet, n('mallet_contact'), 0.045, [0, 0.38, 0.05], m.core);

  const aura = group(root, n('aura'), [0, 0.11, 0]);
  torus(aura, n('ally_aura_outer'), 0.96, 0.015, [0, 0, 0], m.field, [Math.PI / 2, 0, 0]);
  torus(aura, n('ally_aura_inner'), 0.79, 0.012, [0, 0.015, 0], m.energy, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4;
    arc(aura, n(`ally_aura_arc_${i}`), 0.88, 0.014, a + 0.12, a + 0.85, [0, 0.025, 0], m.accent, [Math.PI / 2, 0, 0]);
  }

  const crownY = branch === 'A' ? (tier === 3 ? 2.15 : 1.83) : branch === 'B' ? 1.75 : 1.7;
  const crown = group(root, n('crown'), [0, crownY, 0.12]);
  if (branch === 'A') {
    torus(crown, n('inspiration_crown'), tier === 3 ? 0.55 : 0.43, 0.035, [0, 0, 0], m.gold);
    torus(crown, n('inspiration_live_ring'), tier === 3 ? 0.47 : 0.36, 0.018, [0, 0, -0.035], m.energy);
    const chimes = tier === 3 ? 7 : 5;
    for (let i = 0; i < chimes; i++) {
      const x = (i - (chimes - 1) / 2) * 0.12;
      const length = 0.24 + (1 - Math.abs(i - (chimes - 1) / 2) / chimes) * 0.25;
      rod(crown, n(`crown_chime_hanger_${i}`), [x, 0.12, 0], [x, -0.03, 0], 0.012, m.edge, 10);
      cylinder(crown, n(`crown_chime_${i}`), 0.035, 0.035, length, [x, -0.04 - length / 2, 0], m.gold, [0, 0, 0], 16);
      sphere(crown, n(`crown_chime_node_${i}`), 0.035, [x, -0.06 - length, 0], m.core);
    }
    if (tier === 3) {
      const auxSpin = group(crown, n('crown_gyroscope'));
      torus(auxSpin, n('crown_gyro_ring'), 0.49, 0.018, [0, 0, 0], m.accent, [0, Math.PI / 2, 0]);
      torus(auxSpin, n('crown_gyro_equator'), 0.4, 0.015, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 3; i++) crystal(auxSpin, n(`crown_gyro_node_${i}`), 0.06, radial(i * TAU / 3, 0.4, 0), m.core);
      joints.auxSpin = auxSpin;
    }
  } else if (branch === 'B') {
    lathe(crown, n('slow_crown_bell'), [[0.08, -0.28], [0.11, -0.12], [0.18, 0.04], [0.35, 0.17], [0.4, 0.23], [0.36, 0.27], [0.29, 0.18], [0.13, 0.02], [0.06, -0.2]], [0, 0, 0], m.gold);
    torus(crown, n('slow_crown_lip'), 0.38, 0.035, [0, 0.23, 0], m.edge, [Math.PI / 2, 0, 0]);
    cylinder(crown, n('slow_crown_damper'), 0.055, 0.055, 0.44, [0, -0.02, 0], m.hull, [0, 0, 0], 20);
    sphere(crown, n('slow_crown_weight'), 0.13, [0, -0.26, 0], m.armor);
    if (tier === 3) {
      torus(crown, n('slow_crown_outer_cage'), 0.52, 0.035, [0, 0.03, 0], m.hull, [0, Math.PI / 2, 0]);
      for (const side of SIDES) box(crown, n(`slow_crown_counterweight_${side}`), [0.16, 0.3, 0.2], [side * 0.51, 0.03, 0], m.armor);
    }
  } else {
    torus(crown, n('basic_crown_ring'), 0.29, 0.028, [0, 0, 0], m.gold);
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3;
      crystal(crown, n(`basic_crown_node_${i}`), 0.075, [Math.cos(a) * 0.29, Math.sin(a) * 0.29, 0], m.energy);
    }
    rod(crown, n('basic_crown_stem'), [0, -0.4, 0], [0, -0.1, 0], 0.035, m.hull);
  }

  if (branch === 'A') {
    const pipeFan = group(root, n('inspiration_pipe_fan'), [0, 0.43, 0.47]);
    const count = tier === 3 ? 7 : 5;
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * 0.15;
      const h = 0.73 + (1 - Math.abs(i - (count - 1) / 2) / count) * 0.55;
      resonantPipe(pipeFan, n(`fan_pipe_${i}`), m, 0.055, h, [x, 0, Math.abs(x) * 0.16]);
      rod(pipeFan, n(`fan_pipe_brace_${i}`), [x, 0.1, 0], [x * 0.65, 0.48, -0.08], 0.015, m.hull);
    }
    box(pipeFan, n('fan_wind_chest'), [1.12, 0.18, 0.28], [0, 0.1, 0.04], m.hull);
    for (const side of SIDES) cable(pipeFan, n(`fan_air_bus_${side}`), [[0, 0.12, -0.05], [side * 0.32, 0.14, -0.1], [side * 0.52, 0.12, 0]], 0.025, m.energy);
    if (tier === 3) {
      for (const side of SIDES) {
        const sail = group(root, n(`harmonic_sail_${side}`), [side * 0.69, 0.8, 0.24], [0, 0, -side * 0.17]);
        panel(sail, n(`harmonic_sail_frame_${side}`), mirrored([[0, 0], [0.2, 0.08], [0.27, 0.77], [0.1, 1.03], [0, 0.88]], side), 0.075, [0, 0, 0], m.hull, [0, 0, 0], 0.022);
        for (let i = 0; i < 4; i++) rod(sail, n(`harmonic_sail_string_${side}_${i}`), [side * 0.05, 0.12, -0.055], [side * (0.07 + i * 0.035), 0.83 - i * 0.07, -0.055], 0.012, i === 0 ? m.energy : m.gold, 10);
      }
    }
  }

  if (branch === 'B') {
    const directions = [-0.95, 0.95, 2.35, -2.35];
    directions.forEach((a, index) => {
      const pod = group(root, n(`slow_horn_mount_${index}`), radial(a, 0.53, 0.82), [0, a + Math.PI, 0]);
      horn(pod, n(`slow_horn_${index}`), m, [0, 0, 0], [-Math.PI / 2, 0, 0], tier === 3 ? 1.1 : 0.9);
      rod(pod, n(`slow_horn_strut_${index}`), [0, -0.38, 0.05], [0, -0.04, 0], 0.032, m.hull);
    });
    if (tier === 3) {
      const shell = group(root, n('echo_shell'), [0, 0.48, 0.05]);
      arc(shell, n('echo_shell_lower'), 0.78, 0.055, -0.2, Math.PI + 0.2, [0, 0.16, 0], m.armor, [Math.PI / 2, 0, 0]);
      arc(shell, n('echo_shell_upper'), 0.73, 0.045, -0.2, Math.PI + 0.2, [0, 0.78, 0], m.hull, [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 7; i++) {
        const a = i * Math.PI / 6;
        rod(shell, n(`echo_shell_rib_${i}`), radial(a, 0.78, 0.16), radial(a, 0.73, 0.78), 0.025, m.gold);
        sphere(shell, n(`echo_shell_node_${i}`), 0.045, radial(a, 0.74, 0.8), m.energy);
      }
    }
  }

  if (tier >= 2) {
    for (let i = 0; i < 6; i++) {
      const a = (i + 0.5) * TAU / 6;
      const p = radial(a, 0.7, 0.42);
      cylinder(root, n(`base_resonator_${i}`), 0.045, 0.065, 0.27 + (i % 2) * 0.09, [p[0], p[1] + 0.14, p[2]], m.gold, [0, 0, 0], 16);
      torus(root, n(`base_resonator_lip_${i}`), 0.048, 0.012, [p[0], p[1] + 0.29 + (i % 2) * 0.09, p[2]], m.energy, [Math.PI / 2, 0, 0]);
    }
  }

  Object.assign(joints, {
    voiceL, voiceR, voiceC, damperL, damperR, damperC,
    halo, counterHalo, conductor, mallet, aura, crown,
  });
  return { root, joints };
}

function frequencyClips(root, joints) {
  const slow = root.userData.variant.endsWith('B');
  const clip = (name, duration, pose) => createRigClip(root, joints, name, duration, (u, t, api) => pose(u, t, {
    ...api,
    set(key, value) {
      if (name !== 'shutdown' && /^damper[LRC]$/.test(key) && value.p) value = { ...value, p: [value.p[0], Math.max(-0.025, value.p[1]), value.p[2]] };
      api.set(key, value);
    },
  }));
  return [
    clip('idle', slow ? 4.2 : 3.4, (u, t, { set }) => {
      const s = Math.sin(TAU * u);
      set('voiceL', { r: [0.018 * s, 0, 0.028 * s] });
      set('voiceR', { r: [-0.018 * s, 0, -0.028 * s] });
      set('voiceC', { r: [0.025 * s, 0.02 * s, 0] });
      set('halo', { r: [0, 0.08 * s, 0.07 * s] });
      set('counterHalo', { r: [0, slow ? 0.35 * s : TAU * u, 0] });
      set('conductor', { r: [0, 0.1 * s, 0] });
      set('mallet', { r: [0.08 * s, 0, 0.06 * s] });
      set('crown', { r: [0, 0.06 * s, 0.035 * s] });
      set('auxSpin', { r: [0, TAU * u, 0] });
      set('aura', { s: [1 + 0.07 * s, 1, 1 + 0.07 * s] });
      set('core', { s: [1 + 0.04 * s, 1 + 0.08 * s, 1 + 0.04 * s] });
    }),
    clip('move', 1.8, (u, t, { set }) => {
      Object.keys(joints).filter(key => key.startsWith('anchor')).forEach((key, index) => {
        const k = pulse((u + index * 0.11) % 1, 0, 0.32, 0.8);
        set(key, { p: [0, 0.03 * k, 0] });
      });
      const k = Math.sin(Math.PI * u);
      set('voiceL', { r: [0, 0, -0.12 * k] });
      set('voiceR', { r: [0, 0, 0.12 * k] });
      set('voiceC', { r: [0.12 * k, 0, 0] });
      set('damperL', { p: [0, -0.08 * k, 0] });
      set('damperR', { p: [0, -0.08 * k, 0] });
      set('mallet', { r: [-0.45 * k, 0, 0] });
      set('counterHalo', { r: [0, 0.4 * k, 0] });
    }),
    clip('attack', 1.55, (u, t, { set }) => {
      const tap = pulse(u, 0, 0.3, 0.72);
      const strike = pulse(u, 0.18, 0.36, 0.72);
      const ring = Math.sin(TAU * u * (slow ? 4 : 7)) * tap;
      set('mallet', { r: [-0.45 * tap + 0.9 * strike, 0, 0] });
      set('conductor', { r: [0, 0.22 * tap, 0] });
      set('voiceL', { r: [0.018 * ring, 0, 0.035 * ring] });
      set('voiceR', { r: [-0.018 * ring, 0, -0.035 * ring] });
      set('voiceC', { r: [0.025 * ring, 0, 0] });
      set('damperL', { p: [0, -0.09 * tap, 0] });
      set('damperR', { p: [0, -0.09 * tap, 0] });
      set('halo', { r: [0, 0.18 * tap, 0.1 * ring] });
      set('aura', { s: [1 + 0.12 * tap, 1, 1 + 0.12 * tap] });
    }),
    clip('windup', 1.5, (u, t, { set }) => {
      const k = ease(u, 0, 0.88);
      set('voiceL', { r: [0, -0.12 * k, 0.24 * k] });
      set('voiceR', { r: [0, 0.12 * k, -0.24 * k] });
      set('voiceC', { r: [-0.16 * k, 0, 0] });
      set('damperL', { p: [0, 0.24 * k, 0] });
      set('damperR', { p: [0, 0.24 * k, 0] });
      set('damperC', { p: [0, 0.24 * k, 0] });
      set('mallet', { r: [-0.85 * k, 0, -0.18 * k] });
      set('conductor', { r: [0, -0.25 * k, 0] });
      set('crown', { p: [0, 0.13 * k, 0], r: [0, 0.3 * k, 0] });
      set('counterHalo', { r: [0, 0.65 * k, 0] });
      set('core', { s: [1 + 0.15 * k, 1 + 0.24 * k, 1 + 0.15 * k] });
      set('aura', { s: [1 - 0.18 * k, 1, 1 - 0.18 * k] });
    }),
    clip('release', 1.8, (u, t, { set }) => {
      const strike = pulse(u, 0, 0.18, 0.52);
      const sustain = pulse(u, 0.1, 0.36, 1);
      const spread = ease(u, 0.12, 0.88);
      const vibration = Math.sin(TAU * u * (slow ? 6 : 11)) * sustain;
      set('mallet', { r: [1.05 * strike - 0.2 * sustain, 0, 0] });
      set('conductor', { r: [0, 0.3 * strike, 0] });
      set('damperL', { p: [0, -0.15 * strike + 0.08 * sustain, 0] });
      set('damperR', { p: [0, -0.15 * strike + 0.08 * sustain, 0] });
      set('damperC', { p: [0, -0.15 * strike + 0.08 * sustain, 0] });
      set('voiceL', { r: [0.025 * vibration, 0, 0.12 * sustain + 0.035 * vibration] });
      set('voiceR', { r: [-0.025 * vibration, 0, -0.12 * sustain - 0.035 * vibration] });
      set('voiceC', { r: [0.04 * vibration, 0, 0] });
      set('halo', { r: [0, 0.4 * sustain, 0.12 * vibration] });
      set('counterHalo', { r: [0, TAU * spread, 0] });
      set('crown', { r: [0, -0.4 * sustain, 0.08 * vibration] });
      set('aura', { s: [0.7 + 1.05 * spread, 1, 0.7 + 1.05 * spread] });
      set('core', { s: [1 + 0.25 * sustain, 1 + 0.35 * sustain, 1 + 0.25 * sustain] });
    }),
    clip('ability', slow ? 4.4 : 3.6, (u, t, { set }) => {
      const k = Math.sin(Math.PI * u);
      const beat = Math.sin(TAU * u * (slow ? 2 : 4));
      const answer = Math.sin(TAU * u * (slow ? 3 : 6));
      set('voiceL', { r: [0.04 * answer * k, 0, (0.2 + 0.06 * beat) * k] });
      set('voiceR', { r: [-0.04 * answer * k, 0, (-0.2 - 0.06 * beat) * k] });
      set('voiceC', { r: [0.08 * beat * k, 0.15 * k, 0] });
      set('damperL', { p: [0, (0.12 + 0.1 * beat) * k, 0] });
      set('damperR', { p: [0, (0.12 - 0.1 * beat) * k, 0] });
      set('damperC', { p: [0, 0.18 * k, 0] });
      set('mallet', { r: [0.55 * beat * k, 0, 0.2 * k] });
      set('conductor', { r: [0, 0.45 * Math.sin(TAU * u) * k, 0] });
      set('halo', { r: [0.15 * beat * k, TAU * u, 0.15 * answer * k] });
      set('counterHalo', { r: [0, -TAU * u * 2, 0] });
      set('crown', { p: [0, 0.15 * k, 0], r: [0, -TAU * u, 0.08 * beat * k] });
      set('auxSpin', { r: [TAU * u, TAU * u * 2, 0] });
      set('aura', { s: [0.9 + 0.75 * k + 0.08 * beat, 1, 0.9 + 0.75 * k + 0.08 * beat] });
      set('core', { s: [1 + 0.22 * k, 1 + 0.36 * k, 1 + 0.22 * k] });
    }),
    clip('shutdown', 2.35, (u, t, { set }) => {
      const k = ease(u, 0, 0.82);
      set('voiceL', { r: [0.2 * k, 0, -0.38 * k] });
      set('voiceR', { r: [0.2 * k, 0, 0.38 * k] });
      set('voiceC', { r: [0.52 * k, 0, 0] });
      set('damperL', { p: [0, -0.3 * k, 0] });
      set('damperR', { p: [0, -0.3 * k, 0] });
      set('damperC', { p: [0, -0.3 * k, 0] });
      set('mallet', { r: [-1.05 * k, 0, 0.3 * k] });
      set('conductor', { r: [0.55 * k, 0, 0] });
      set('halo', { r: [1.05 * k, 0, 0.2 * k] });
      set('counterHalo', { r: [0.35 * k, -0.4 * k, 0] });
      set('crown', { p: [0, -0.18 * k, 0], r: [0.62 * k, 0, 0] });
      set('aura', { s: [1 - 0.82 * k, 1, 1 - 0.82 * k] });
      set('core', { p: [0, -0.13 * k, 0], s: [1 - 0.55 * k, 1 - 0.65 * k, 1 - 0.55 * k] });
    }),
  ];
}

export const entities = [
  defineEntity({
    id: 'bandwidth_relay',
    name: '带宽中继',
    kind: 'building',
    role: 'support',
    locomotion: 'anchored',
    variants: VARIANTS,
    concept: '以桁架信号塔、可展开的接收瓣和青绿馈电总线维持战场信道；A 为宽域多鳍阵列，B 为装甲滤波与抗扰线圈。',
    mechanism: '方位/俯仰万向节完成校准，接入滑枕与接收门展开建立带宽链路；宽域冠鳍或滤波笼执行网络握手，停机时天线折拢并缩回接插件。',
    build: buildBandwidthRelay,
    clips: bandwidthClips,
  }),
  defineEntity({
    id: 'memory_mechanic',
    name: '记忆维修师',
    kind: 'building',
    role: 'support',
    locomotion: 'anchored',
    variants: VARIANTS,
    concept: '落地维修工位搭载双关节机械臂、真实焊头、记忆电池与扫描压装机构；A 强化紧急多臂抢修，B 强化装甲板覆写。',
    mechanism: '维修臂抬升、寻位并伸展至工作 cradle，焊头与扫描环完成修复；A 使用滑轨辅助臂分诊，B 以夹具、压头和覆写辊安装装甲记忆板，停机时双臂折叠。',
    build: buildMemoryMechanic,
    clips: memoryClips,
  }),
  defineEntity({
    id: 'frequency_choir',
    name: '频率合唱器',
    kind: 'building',
    role: 'support',
    locomotion: 'anchored',
    variants: VARIANTS,
    concept: '由音叉、共鸣管、敲击指挥器与和谐环组成的友军增益建筑；A 为高音管簇和激励音帆，B 为低音钟、号角与回声壳。',
    mechanism: '阻尼器升起后指挥摆锤敲击，音叉和共鸣管振动并展开友军谐振环；A 以管簇合唱强化节奏，B 以重锤低鸣形成迟滞场，停机时阻尼垫落下并收拢发声体。',
    build: buildFrequencyChoir,
    clips: frequencyClips,
  }),
];
