import * as THREE from '../../vendor/three/build/three.module.js';
import { defineEntity } from './contract.js';
import {
  palette, group, box, panel, cylinder, sphere, crystal, torus, arc, cable, rod,
  lathe, hull, bearing, fasteners, mesh, annulusGeometry,
} from '../geometry.js';
import { TAU, ease, pulse, createRigClip as baseRigClip } from '../animations.js';
import { addMechanicalLink, withMechanicalLinks } from './mechanical-links.js';

const createRigClip = (root, joints, name, duration, pose) => baseRigClip(root, joints, name, duration, withMechanicalLinks(root, joints, pose));

const VARIANTS = ['T1', 'T2A', 'T2B', 'T3A', 'T3B'];
const SIDES = [-1, 1];
const DOCKED_WING_FOLD = 1.04;

function variantInfo(root, variant) {
  const tier = Number(variant[1]);
  const branch = variant.slice(2);
  root.userData.variant = variant;
  root.userData.tier = tier;
  root.userData.branch = branch;
  return { tier, branch, a: branch === 'A', b: branch === 'B' };
}

function anchorBase(root, m, prefix, width, depth, heavy = false) {
  const base = group(root, `${prefix}_foundation`);
  for (const side of SIDES) {
    for (const end of SIDES) {
      const tag = `${prefix}_anchor_${side < 0 ? 'l' : 'r'}_${end < 0 ? 'f' : 'b'}`;
      const x = side * width * 0.39;
      const z = end * depth * 0.36;
      box(base, `${tag}_pad`, [0.48, 0.12, 0.48], [x, 0.06, z], m.dark, [0, side * end * 0.08, 0], 0.04);
      box(base, `${tag}_shoe`, [0.38, 0.11, 0.4], [x, 0.155, z], m.armor, [0, side * end * 0.08, 0], 0.025);
      cylinder(base, `${tag}_lock`, 0.09, 0.11, 0.09, [x, 0.25, z], m.gold, [0, 0, 0], 8);
      rod(base, `${tag}_brace`, [x, 0.2, z], [side * width * 0.28, 0.43, end * depth * 0.25], 0.045, m.edge);
    }
  }
  box(base, `${prefix}_lower_chassis`, [width * 0.86, 0.22, depth * 0.8], [0, 0.19, 0], m.hull, [0, 0, 0], 0.07);
  panel(base, `${prefix}_chamfered_deck`, [
    [-width * 0.43, -depth * 0.36], [-width * 0.32, -depth * 0.46],
    [width * 0.32, -depth * 0.46], [width * 0.43, -depth * 0.36],
    [width * 0.43, depth * 0.36], [width * 0.32, depth * 0.46],
    [-width * 0.32, depth * 0.46], [-width * 0.43, depth * 0.36],
  ], 0.13, [0, 0.34, 0], m.armor);
  cylinder(base, `${prefix}_slew_seat`, 0.7, 0.77, 0.16, [0, 0.45, 0], m.dark, [0, 0, 0], 12);
  cylinder(base, `${prefix}_slew_ring`, 0.66, 0.66, 0.07, [0, 0.555, 0], m.edge, [0, 0, 0], 48);
  torus(base, `${prefix}_power_bus`, 0.57, 0.028, [0, 0.598, 0], m.energy, [Math.PI / 2, 0, 0]);
  for (let i = -2; i <= 2; i++) {
    box(base, `${prefix}_front_vent_${i + 2}`, [0.13, 0.11, 0.055], [i * 0.18, 0.22, -depth * 0.405], m.dark, [0, 0, 0], 0.012);
  }
  for (const side of SIDES) {
    box(base, `${prefix}_deck_conduit_${side}`, [0.055, 0.035, depth * 0.56], [side * width * 0.31, 0.425, 0], m.energy, [0, 0, 0], 0.009);
    cable(base, `${prefix}_power_cable_${side}`, [
      [side * width * 0.31, 0.37, depth * 0.27], [side * width * 0.24, 0.48, depth * 0.18],
      [side * 0.48, 0.59, 0.18], [side * 0.4, 0.63, 0],
    ], 0.027, m.gold);
  }
  fasteners(base, `${prefix}_deck_bolts`, [
    [-width * 0.3, 0.42, -depth * 0.3], [width * 0.3, 0.42, -depth * 0.3],
    [-width * 0.3, 0.42, depth * 0.3], [width * 0.3, 0.42, depth * 0.3],
  ], m.edge, 'y', 0.035);
  if (heavy) {
    for (const side of SIDES) {
      panel(base, `${prefix}_outrigger_${side}`, [[0, -0.34], [side * 0.42, -0.24], [side * 0.5, 0.24], [0, 0.34]], 0.11,
        [side * width * 0.43, 0.18, 0], m.hull);
      box(base, `${prefix}_outrigger_light_${side}`, [0.28, 0.045, 0.07], [side * width * 0.51, 0.26, -0.13], m.energy);
    }
  }
  return base;
}

function guardLeaf(parent, m, prefix, side, large = false) {
  const height = large ? 1.24 : 0.94;
  bearing(parent, `${prefix}_hinge`, 0.16, 0.2, [0, 0, 0], m, 'x');
  rod(parent, `${prefix}_upper_arm`, [0, 0.05, 0], [side * 0.18, height * 0.3, -0.1], 0.055, m.gold);
  rod(parent, `${prefix}_lower_arm`, [0, -0.05, 0], [side * 0.18, -height * 0.25, -0.1], 0.055, m.edge);
  const outline = [
    [-0.24, -height * 0.38], [0.17, -height * 0.34], [0.29, -height * 0.03],
    [0.18, height * 0.4], [-0.06, height * 0.52], [-0.3, height * 0.25], [-0.34, -height * 0.08],
  ];
  panel(parent, `${prefix}_armor`, outline, 0.13, [side * 0.2, 0.04, -0.14], m.armor, [0, 0, 0], 0.028);
  panel(parent, `${prefix}_inlay`, outline.map(([x, y]) => [x * 0.72, y * 0.76]), 0.035,
    [side * 0.2, 0.04, -0.225], m.accent, [0, 0, 0], 0.012);
  panel(parent, `${prefix}_field`, outline.map(([x, y]) => [x * 0.9, y * 0.9]), 0.012,
    [side * 0.2, 0.04, -0.25], m.field, [0, 0, 0], 0.004);
  box(parent, `${prefix}_spine`, [0.055, height * 0.72, 0.07], [side * 0.2, 0.04, -0.265], m.energy, [0, 0, side * -0.08], 0.012);
  for (const y of [-0.25, 0.25]) {
    cylinder(parent, `${prefix}_pin_${y}`, 0.045, 0.045, 0.06, [side * 0.2, y * height, -0.275], m.edge, [Math.PI / 2, 0, 0], 8);
  }
}

function buildGuard(variant) {
  const root = new THREE.Group();
  root.name = `resonance_guard_${variant}`;
  const { tier, branch, a, b } = variantInfo(root, variant);
  const m = palette('ally');
  const joints = {};
  anchorBase(root, m, 'guard', tier === 3 ? 2.55 : 2.3, 2.08, tier === 3);

  const body = group(root, 'guard_body', [0, 0.55, 0]);
  joints.body = body;
  hull(body, 'guard_lower_housing', [
    { z: 0.48, y: 0.16, w: 1.12, h: 0.48, chamfer: 0.12 },
    { z: -0.38, y: 0.18, w: 1.0, h: 0.52, chamfer: 0.1 },
    { z: -0.58, y: 0.12, w: 0.78, h: 0.36, chamfer: 0.08 },
  ], m.hull);
  box(body, 'guard_front_brow', [0.88, 0.16, 0.22], [0, 0.48, -0.38], m.armor, [0.12, 0, 0], 0.035);
  for (const side of SIDES) {
    box(body, `guard_core_cheek_${side}`, [0.18, 0.52, 0.62], [side * 0.53, 0.37, 0.05], m.armor, [0, 0, side * -0.14], 0.035);
    cable(body, `guard_core_feed_${side}`, [[side * 0.48, 0.13, 0.34], [side * 0.61, 0.42, 0.3], [side * 0.45, 0.72, 0.16]], 0.035, m.energy);
  }

  const resonator = group(body, 'guard_resonator', [0, 0.91, 0.08]);
  joints.resonator = resonator;
  lathe(resonator, 'guard_resonator_vessel', [[0.16, -0.35], [0.29, -0.25], [0.3, 0.18], [0.2, 0.36]], [0, 0, 0], m.dark);
  crystal(resonator, 'guard_resonator_heart', 0.28, [0, 0.02, 0], m.core, [0.72, 1.28, 0.72], [0, Math.PI / 4, 0]);
  torus(resonator, 'guard_resonator_equator', 0.39, 0.045, [0, 0, 0], m.gold, [Math.PI / 2, 0, 0]);
  torus(resonator, 'guard_resonator_meridian', 0.41, 0.033, [0, 0, 0], m.energy, [0, Math.PI / 2, 0]);
  torus(resonator, 'guard_resonator_trim', 0.34, 0.025, [0, 0.19, 0], m.edge, [Math.PI / 2, 0, 0]);
  for (const side of SIDES) {
    box(resonator, `guard_resonator_key_${side}`, [0.1, 0.22, 0.16], [side * 0.37, 0, 0], m.armor, [0, 0, side * 0.2]);
  }

  const ram = group(body, 'guard_ram', [0, 0.22, -0.43]);
  joints.ram = ram;
  const ramGuide = group(body, 'guard_fixed_ram_guide', [0, 0.22, -0.43]);
  hull(ramGuide, 'guard_ram_sleeve', [
    { z: 0.16, w: 0.52, h: 0.38, chamfer: 0.08 },
    { z: -0.5, w: 0.4, h: 0.3, chamfer: 0.06 },
  ], m.dark);
  for (const side of SIDES) {
    mesh(ramGuide, `guard_ram_cylinder_${side}`, annulusGeometry(0.075, 0.043, 0.62, 24), m.gold, [side * 0.28, 0, -0.11], [Math.PI / 2, 0, 0]);
    cylinder(ram, `guard_ram_piston_${side}`, 0.037, 0.037, 1.21, [side * 0.28, 0, -0.235], m.edge, [Math.PI / 2, 0, 0], 24);
  }
  box(ram, 'guard_ram_energy_rail', [0.09, 0.07, 0.62], [0, 0.2, -0.3], m.energy);
  const striker = group(ram, 'guard_striker', [0, 0, -0.72]);
  joints.striker = striker;
  cylinder(striker, 'guard_striker_head', 0.31, 0.35, 0.22, [0, 0, 0], m.armor, [Math.PI / 2, 0, 0], 8);
  cylinder(striker, 'guard_striker_face', 0.25, 0.25, 0.055, [0, 0, -0.14], m.dark, [Math.PI / 2, 0, 0], 8);
  crystal(striker, 'guard_striker_focus', 0.18, [0, 0, -0.19], m.energy, [1, 1, 0.48], [Math.PI / 4, 0, 0]);
  for (const side of SIDES) {
    box(striker, `guard_striker_lug_${side}`, [0.15, 0.17, 0.28], [side * 0.31, 0, 0.04], m.gold, [0, 0, side * 0.15]);
  }

  for (const side of SIDES) {
    const id = side < 0 ? 'L' : 'R';
    const shield = group(body, `guard_shield_${id}`, [side * 0.67, 0.69, 0.02], [0, side * 0.16, side * -0.08]);
    joints[`shield${id}`] = shield;
    guardLeaf(shield, m, `guard_shield_${id}`, side);
    const aux = group(body, `guard_aux_${id}`, [side * 0.95, 0.82, 0.2], [0, side * 0.24, 0]);
    joints[`aux${id}`] = aux;
    if (a) {
      guardLeaf(aux, m, `guard_outer_leaf_${id}`, side, tier === 3);
      if (tier === 3) {
        rod(aux, `guard_outer_crown_link_${id}`, [0, 0.4, 0.04], [-side * 0.3, 0.86, 0.02], 0.04, m.gold);
        crystal(aux, `guard_outer_prism_${id}`, 0.13, [side * 0.18, 0.7, -0.14], m.core, [0.7, 1.5, 0.7]);
      }
    }
    if (b) {
      cylinder(aux, `guard_pressure_tank_${id}`, 0.23, 0.27, tier === 3 ? 0.98 : 0.76, [0, 0.12, 0], m.hull, [0, 0, 0], 16);
      sphere(aux, `guard_pressure_cap_${id}`, 0.23, [0, tier === 3 ? 0.61 : 0.5, 0], m.armor, [1, 0.45, 1]);
      for (const y of [-0.18, 0.14, 0.4]) {
        torus(aux, `guard_pressure_band_${id}_${y}`, 0.255, 0.032, [0, y, 0], m.gold, [Math.PI / 2, 0, 0]);
      }
      torus(aux, `guard_pressure_intake_${id}`, 0.18, 0.05, [0, 0.14, -0.27], m.dark);
      torus(aux, `guard_pressure_intake_glow_${id}`, 0.12, 0.025, [0, 0.14, -0.32], m.energy);
      cable(aux, `guard_pressure_return_${id}`, [[0, -0.28, 0.08], [-side * 0.2, -0.4, 0.28], [-side * 0.48, -0.23, 0.16]], 0.055, m.accent);
      if (tier === 3) {
        cylinder(aux, `guard_pressure_upper_tank_${id}`, 0.14, 0.17, 0.48, [-side * 0.12, 0.79, 0.08], m.dark, [0, 0, side * -0.15], 12);
        cable(aux, `guard_pressure_upper_feed_${id}`, [[-side * 0.12, 0.58, 0.08], [side * 0.16, 0.75, 0.05], [side * 0.12, 0.96, -0.04]], 0.03, m.energy);
        panel(striker, `guard_sink_fang_${id}`, [[-0.08, -0.14], [0.08, -0.14], [0.13, 0.26], [0, 0.43], [-0.13, 0.26]], 0.36,
          [side * 0.32, 0, -0.25], m.gold, [0, 0, side * -0.16]);
      }
    }
  }

  const crown = group(body, 'guard_crown', [0, 1.24, 0.18]);
  joints.crown = crown;
  if (a) {
    arc(crown, 'guard_wide_halo', tier === 3 ? 0.91 : 0.72, 0.055, 0.04 * Math.PI, 0.96 * Math.PI, [0, 0, 0], m.gold);
    arc(crown, 'guard_wide_halo_energy', tier === 3 ? 0.79 : 0.61, 0.024, 0.08 * Math.PI, 0.92 * Math.PI, [0, 0, -0.045], m.energy);
    if (tier === 3) {
      arc(crown, 'guard_wide_outer_halo', 1.04, 0.035, 0.17 * Math.PI, 0.83 * Math.PI, [0, -0.04, 0.08], m.armor);
      for (const x of [-0.54, 0, 0.54]) {
        crystal(crown, `guard_wide_crown_node_${x}`, 0.12, [x, 0.66 - Math.abs(x) * 0.25, 0], m.core, [0.75, 1.35, 0.75]);
      }
    }
  }
  if (b) {
    box(crown, 'guard_sink_manifold', [0.74, 0.22, 0.4], [0, 0, 0], m.dark, [0, 0, 0], 0.05);
    for (const x of [-0.24, 0, 0.24]) {
      cylinder(crown, `guard_sink_stack_${x}`, 0.085, 0.12, tier === 3 ? 0.64 : 0.42, [x, 0.29, 0.05], m.hull, [0, 0, 0], 12);
      torus(crown, `guard_sink_stack_ring_${x}`, 0.1, 0.022, [x, tier === 3 ? 0.57 : 0.46, 0.05], m.energy, [Math.PI / 2, 0, 0]);
    }
    if (tier === 3) {
      cable(crown, 'guard_sink_equalizer', [[-0.55, 0.1, 0], [-0.34, 0.48, 0.1], [0, 0.63, 0.1], [0.34, 0.48, 0.1], [0.55, 0.1, 0]], 0.05, m.gold);
    }
  }
  if (tier > 1) {
    for (const side of SIDES) {
      box(body, `guard_tier_skirt_${side}`, [0.22, 0.32, 0.76], [side * 0.69, 0.08, 0.06], m.hull, [0, 0, side * -0.12]);
      box(body, `guard_tier_skirt_light_${side}`, [0.04, 0.16, 0.46], [side * 0.81, 0.12, -0.02], m.energy);
    }
  }
  return { root, joints };
}

function guardClips(root, joints) {
  return [
    createRigClip(root, joints, 'idle', 4, (u, t, { set }) => {
      const breath = Math.sin(TAU * u);
      set('body', { p: [0, 0.018 * breath, 0] });
      set('resonator', { r: [0.08 * breath, TAU * u, 0], s: [1 + 0.035 * breath, 1 + 0.035 * breath, 1 + 0.035 * breath] });
      set('ram', { p: [0, 0, 0.018 * breath] });
      for (const [id, side] of [['L', -1], ['R', 1]]) {
        set(`shield${id}`, { r: [0, side * 0.055 * breath, side * 0.018 * breath] });
        set(`aux${id}`, { r: [0, side * 0.04 * breath, 0] });
      }
      set('crown', { r: [0, 0.06 * Math.sin(TAU * u * 0.5), 0] });
    }),
    createRigClip(root, joints, 'move', 1.6, (u, t, { set }) => {
      const check = Math.sin(TAU * u);
      set('body', { r: [0, 0.09 * check, 0] });
      set('resonator', { r: [0.12 * check, -TAU * u, 0] });
      set('ram', { p: [0, 0, 0.065 * check] });
      set('striker', { r: [0, 0, 0.14 * check] });
      set('shieldL', { r: [0, -0.08 * check, 0.05 * check] });
      set('shieldR', { r: [0, 0.08 * check, 0.05 * check] });
      set('crown', { r: [0, -0.12 * check, 0] });
    }),
    createRigClip(root, joints, 'attack', 1, (u, t, { set }) => {
      const hit = pulse(u, 0.04, 0.28, 0.57);
      const rebound = pulse(u, 0.55, 0.72, 0.96);
      set('body', { r: [0.055 * hit, -0.045 * hit, 0] });
      set('ram', { p: [0, 0, -0.43 * hit - 0.13 * rebound] });
      set('striker', { r: [0, 0, 0.2 * hit - 0.12 * rebound], s: [1 + 0.12 * hit, 1 + 0.12 * hit, 1] });
      set('resonator', { r: [0, 0.7 * hit, 0] });
      set('shieldL', { r: [0, -0.17 * hit, -0.08 * hit] });
      set('shieldR', { r: [0, 0.17 * hit, 0.08 * hit] });
    }),
    createRigClip(root, joints, 'windup', 0.9, (u, t, { set }) => {
      const charge = ease(u, 0, 0.82);
      set('body', { p: [0, -0.055 * charge, 0.045 * charge], r: [-0.07 * charge, 0, 0] });
      set('ram', { p: [0, 0, 0.24 * charge] });
      set('striker', { r: [0, 0, -0.35 * charge], s: [1 - 0.12 * charge, 1 - 0.12 * charge, 1] });
      set('resonator', { r: [0, TAU * 2 * u, 0], s: [1 + 0.13 * charge, 1 + 0.13 * charge, 1 + 0.13 * charge] });
      set('shieldL', { r: [0, -0.28 * charge, 0] });
      set('shieldR', { r: [0, 0.28 * charge, 0] });
      set('crown', { r: [0, -TAU * u, 0] });
    }),
    createRigClip(root, joints, 'release', 0.75, (u, t, { set }) => {
      const strike = ease(u, 0, 0.22);
      const recover = ease(u, 0.56, 1);
      const extension = 0.22 * (1 - strike) - 0.56 * strike * (1 - recover);
      const flash = pulse(u, 0.12, 0.24, 0.45);
      set('body', { r: [0.1 * flash, 0, 0] });
      set('ram', { p: [0, 0, extension] });
      set('striker', { r: [0, 0, 0.4 * flash], s: [1 + 0.25 * flash, 1 + 0.25 * flash, 1] });
      set('resonator', { r: [0, -TAU * u, 0], s: [1 + 0.22 * flash, 1 + 0.22 * flash, 1 + 0.22 * flash] });
      set('shieldL', { r: [0, 0.32 * flash, -0.12 * flash] });
      set('shieldR', { r: [0, -0.32 * flash, 0.12 * flash] });
      set('crown', { r: [0, TAU * u, 0] });
    }),
    createRigClip(root, joints, 'ability', 2.6, (u, t, { set }) => {
      const deploy = pulse(u, 0, 0.24, 0.88);
      const ring = Math.sin(TAU * u * 2) * deploy;
      set('body', { p: [0, 0.1 * deploy, 0] });
      set('resonator', { r: [TAU * u, TAU * 2 * u, 0], s: [1 + 0.2 * deploy, 1 + 0.2 * deploy, 1 + 0.2 * deploy] });
      set('ram', { p: [0, 0, 0.12 * deploy] });
      for (const [id, side] of [['L', -1], ['R', 1]]) {
        set(`shield${id}`, { r: [0, side * 0.68 * deploy, side * -0.2 * deploy], s: [1 + 0.08 * deploy, 1 + 0.14 * deploy, 1] });
        set(`aux${id}`, { r: [0, side * 0.88 * deploy, side * 0.12 * ring] });
      }
      set('crown', { r: [0, TAU * u, 0.08 * ring], s: [1 + 0.18 * deploy, 1 + 0.18 * deploy, 1 + 0.18 * deploy] });
    }),
    createRigClip(root, joints, 'shutdown', 2.2, (u, t, { set }) => {
      const down = ease(u, 0, 0.82);
      set('body', { p: [0, -0.2 * down, 0.08 * down], r: [-0.1 * down, 0, 0] });
      set('resonator', { r: [0.5 * down, 0.7 * down, 0], s: [1 - 0.48 * down, 1 - 0.48 * down, 1 - 0.48 * down] });
      set('ram', { p: [0, 0, 0.28 * down] });
      set('striker', { r: [0, 0, -0.3 * down] });
      set('shieldL', { r: [0.16 * down, -0.54 * down, -0.18 * down] });
      set('shieldR', { r: [0.16 * down, 0.54 * down, 0.18 * down] });
      set('auxL', { r: [0, -0.45 * down, 0] });
      set('auxR', { r: [0, 0.45 * down, 0] });
      set('crown', { r: [0.48 * down, 0, 0], s: [1 - 0.25 * down, 1 - 0.25 * down, 1 - 0.25 * down] });
    }),
  ];
}

function pulseNeedle(parent, m, prefix, length, reinforced = false) {
  const needle = group(parent, prefix);
  hull(needle, `${prefix}_breech`, [
    { z: 0.28, w: reinforced ? 0.27 : 0.23, h: reinforced ? 0.25 : 0.21, chamfer: 0.045 },
    { z: -0.3, w: reinforced ? 0.21 : 0.17, h: 0.17, chamfer: 0.035 },
  ], m.hull);
  box(needle, `${prefix}_top_cover`, [reinforced ? 0.25 : 0.2, 0.075, 0.38], [0, 0.13, -0.02], m.armor, [0.04, 0, 0], 0.018);
  cylinder(needle, `${prefix}_barrel`, reinforced ? 0.052 : 0.041, reinforced ? 0.052 : 0.041, length,
    [0, 0, -0.3 - length / 2], m.edge, [Math.PI / 2, 0, 0], 20);
  cylinder(needle, `${prefix}_inner_barrel`, 0.024, 0.024, length + 0.08,
    [0, 0, -0.32 - length / 2], m.dark, [Math.PI / 2, 0, 0], 16);
  for (const side of SIDES) {
    rod(needle, `${prefix}_guide_${side}`, [side * 0.085, -0.065, -0.2], [side * 0.085, -0.065, -0.26 - length], 0.018, m.gold, 12);
  }
  const coils = Math.max(2, Math.round(length * 2.4));
  for (let i = 0; i < coils; i++) {
    const z = -0.44 - i * (length - 0.25) / Math.max(1, coils - 1);
    torus(needle, `${prefix}_coil_${i}`, reinforced ? 0.083 : 0.07, 0.018, [0, 0, z], i % 2 ? m.energy : m.gold);
  }
  const muzzle = -0.32 - length;
  box(needle, `${prefix}_muzzle_brake`, [reinforced ? 0.22 : 0.17, 0.15, 0.18], [0, 0, muzzle + 0.035], m.dark, [0, 0, 0], 0.025);
  torus(needle, `${prefix}_muzzle_ring`, reinforced ? 0.095 : 0.078, 0.022, [0, 0, muzzle - 0.06], m.energy);
  crystal(needle, `${prefix}_muzzle_focus`, 0.075, [0, 0, muzzle - 0.1], m.core, [0.72, 0.72, 1.35], [0, 0, Math.PI / 4]);
  box(needle, `${prefix}_charge_meter`, [0.055, 0.055, 0.24], [0, 0.15, -0.15], m.energy);
  return needle;
}

function buildPulse(variant) {
  const root = new THREE.Group();
  root.name = `pulse_array_${variant}`;
  const { tier, a, b } = variantInfo(root, variant);
  const m = palette('ally');
  const joints = {};
  anchorBase(root, m, 'pulse', tier === 3 ? 2.35 : 2.08, 1.94, tier === 3);

  const turret = group(root, 'pulse_turret', [0, 0.57, 0]);
  joints.turret = turret;
  cylinder(turret, 'pulse_pedestal', 0.47, 0.59, 0.28, [0, 0.06, 0], m.hull, [0, 0, 0], 12);
  torus(turret, 'pulse_pedestal_bus', 0.5, 0.035, [0, 0.21, 0], m.energy, [Math.PI / 2, 0, 0]);
  for (const side of SIDES) {
    rod(turret, `pulse_pedestal_strut_${side}`, [side * 0.42, 0.12, 0.22], [side * 0.58, 0.48, 0.06], 0.065, m.gold);
    box(turret, `pulse_pedestal_access_${side}`, [0.19, 0.25, 0.38], [side * 0.45, 0.29, 0.08], m.armor, [0, 0, side * -0.12]);
  }

  const carriage = group(turret, 'pulse_carriage', [0, 0.52, 0]);
  joints.carriage = carriage;
  box(carriage, 'pulse_cradle_crossbeam', [1.22, 0.18, 0.42], [0, -0.17, 0.06], m.dark, [0, 0, 0], 0.045);
  for (const side of SIDES) {
    bearing(turret, `pulse_trunnion_${side}`, 0.22, 0.18, [side * 0.58, 0.52, 0], m, 'x');
    rod(carriage, `pulse_elevation_spindle_${side}`, [side * 0.39, 0, 0], [side * 0.67, 0, 0], 0.065, m.edge, 24);
    panel(carriage, `pulse_cradle_cheek_${side}`, [[-0.18, -0.22], [0.18, -0.22], [0.25, 0.17], [0.06, 0.4], [-0.17, 0.28]], 0.12,
      [side * 0.59, 0.02, 0.06], m.armor, [0, Math.PI / 2, 0], 0.025);
    cable(carriage, `pulse_cradle_feed_${side}`, [[side * 0.5, -0.1, 0.34], [side * 0.69, 0.04, 0.22], [side * 0.57, 0.25, -0.12]], 0.03, m.energy);
  }

  let positions;
  if (tier === 1) positions = [[-0.33, 0.03], [0, 0.03], [0.33, 0.03]];
  else if (a && tier === 2) positions = [[-0.46, 0.02], [-0.23, 0.14], [0, 0.02], [0.23, 0.14], [0.46, 0.02]];
  else if (a) positions = [[-0.48, -0.08], [-0.24, 0.08], [0, -0.08], [0.24, 0.08], [0.48, -0.08], [-0.35, 0.34], [0.35, 0.34]];
  else if (tier === 2) positions = [[-0.27, -0.1], [-0.27, 0.27], [0.27, -0.1], [0.27, 0.27]];
  else positions = [[-0.29, -0.18], [-0.29, 0.12], [-0.29, 0.42], [0.29, -0.18], [0.29, 0.12], [0.29, 0.42]];
  const length = b ? (tier === 3 ? 1.34 : 1.2) : (tier === 3 ? 1.08 : 0.98);
  for (let i = 0; i < 7; i++) {
    const key = `needle${i}`;
    if (i < positions.length) {
      const needle = pulseNeedle(carriage, m, `pulse_needle_${i}`, length, b);
      needle.position.set(positions[i][0], positions[i][1], i % 2 && a ? -0.07 : 0);
      joints[key] = needle;
    } else {
      joints[key] = group(carriage, `pulse_needle_${i}`);
    }
  }

  const capacitor = group(carriage, 'pulse_capacitor', [0, -0.02, 0.49]);
  joints.capacitor = capacitor;
  cylinder(capacitor, 'pulse_capacitor_drum', 0.31, 0.31, 0.46, [0, 0, 0], m.dark, [Math.PI / 2, 0, 0], 24);
  cylinder(capacitor, 'pulse_capacitor_core', 0.19, 0.19, 0.53, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0], 20);
  for (const z of [-0.25, -0.09, 0.09, 0.25]) {
    torus(capacitor, `pulse_capacitor_winding_${z}`, 0.33, 0.028, [0, 0, z], m.gold);
  }
  box(capacitor, 'pulse_capacitor_index', [0.09, 0.16, 0.58], [0, 0.29, 0], m.armor);

  for (const side of SIDES) {
    const id = side < 0 ? 'L' : 'R';
    const coolant = group(carriage, `pulse_coolant_${id}`, [side * 0.73, -0.18, 0.13]);
    joints[`coolant${id}`] = coolant;
    box(coolant, `pulse_coolant_case_${id}`, [0.19, 0.42, 0.48], [0, 0, 0], m.hull, [0, 0, side * -0.08]);
    for (let i = 0; i < 4; i++) {
      box(coolant, `pulse_coolant_fin_${id}_${i}`, [0.29, 0.035, 0.42], [0, -0.15 + i * 0.1, 0], m.edge);
    }
    box(coolant, `pulse_coolant_light_${id}`, [0.04, 0.29, 0.31], [side * 0.12, 0, -0.02], m.energy);

    const chain = group(carriage, `pulse_chain_${id}`, [side * 0.62, 0.26, 0.04]);
    joints[`chain${id}`] = chain;
    if (a) {
      arc(chain, `pulse_chain_arc_${id}`, tier === 3 ? 0.4 : 0.32, 0.035, -0.48 * Math.PI, 0.48 * Math.PI,
        [0, 0, 0], m.gold, [0, side * Math.PI / 2, side * Math.PI / 2]);
      rod(chain, `pulse_chain_bus_${id}`, [0, -0.25, 0.16], [0, 0.32, -0.26], 0.035, m.energy);
      crystal(chain, `pulse_chain_node_${id}`, 0.13, [0, 0.29, -0.26], m.core, [0.8, 1.3, 0.8]);
      if (tier === 3) {
        cylinder(chain, `pulse_chain_reserve_${id}`, 0.12, 0.15, 0.48, [side * 0.13, 0.13, 0.24], m.hull, [0, 0, side * -0.16], 12);
        torus(chain, `pulse_chain_reserve_ring_${id}`, 0.14, 0.024, [side * 0.13, 0.29, 0.24], m.energy, [Math.PI / 2, 0, 0]);
      }
    }
  }

  const sensorY = b ? 0.58 : a && tier === 3 ? 0.68 : 0.42;
  const sensor = group(carriage, 'pulse_sensor', [0, sensorY, 0.22]);
  joints.sensor = sensor;
  if (b) {
    box(sensor, 'pulse_aa_mast', [0.15, 0.5, 0.18], [0, -0.17, 0.08], m.hull, [0.12, 0, 0]);
    lathe(sensor, 'pulse_aa_dish', [[0.025, 0], [0.15, 0.015], [0.28, 0.075], [0.34, 0.15]], [0, 0.16, 0], m.armor, [Math.PI / 2, 0, 0], 48);
    torus(sensor, 'pulse_aa_dish_rim', 0.34, 0.025, [0, 0.16, 0.15], m.energy);
    rod(sensor, 'pulse_aa_receiver_arm', [0, 0.16, 0.08], [0, 0.16, -0.3], 0.025, m.gold);
    crystal(sensor, 'pulse_aa_receiver', 0.1, [0, 0.16, -0.34], m.core, [0.7, 0.7, 1.4]);
    for (const side of SIDES) {
      rod(sensor, `pulse_aa_antenna_${side}`, [side * 0.17, 0.06, 0.1], [side * 0.34, 0.52, 0.12], 0.022, m.edge);
      sphere(sensor, `pulse_aa_antenna_tip_${side}`, 0.045, [side * 0.34, 0.52, 0.12], m.energy);
    }
  } else {
    cylinder(carriage, 'pulse_timing_sensor_stem', 0.045, 0.055, sensorY - 0.32, [0, (sensorY + 0.32) / 2, 0.22], m.gold, [0, 0, 0], 24);
    box(sensor, 'pulse_chain_timing_bar', [a ? 0.8 : 0.48, 0.11, 0.18], [0, 0, 0], m.dark);
    for (const side of SIDES) {
      rod(sensor, `pulse_timing_fork_${side}`, [side * 0.16, 0, 0], [side * 0.25, 0.28, -0.08], 0.025, m.gold);
      crystal(sensor, `pulse_timing_eye_${side}`, 0.075, [side * 0.25, 0.3, -0.08], m.energy);
    }
  }
  const sensor2 = group(carriage, 'pulse_sensor_secondary', [b ? 0.55 : -0.5, 0.4, 0.28]);
  joints.sensor2 = sensor2;
  if (b && tier === 3) {
    lathe(sensor2, 'pulse_aa_secondary_dish', [[0.02, 0], [0.12, 0.025], [0.23, 0.12]], [0, 0.14, 0], m.hull, [Math.PI / 2, 0, 0], 40);
    torus(sensor2, 'pulse_aa_secondary_rim', 0.23, 0.024, [0, 0.14, 0.12], m.energy);
    rod(sensor2, 'pulse_aa_secondary_feed', [0, -0.15, 0], [0, 0.32, -0.18], 0.028, m.gold);
    crystal(sensor2, 'pulse_aa_secondary_eye', 0.085, [0, 0.32, -0.2], m.core);
  }
  if (tier === 3) {
    for (const side of SIDES) {
      box(turret, `pulse_t3_power_pack_${side}`, [0.31, 0.46, 0.5], [side * 0.58, 0.24, 0.47], m.hull, [0, 0, side * -0.1]);
      cable(turret, `pulse_t3_power_loop_${side}`, [[side * 0.58, 0.42, 0.45], [side * 0.78, 0.62, 0.36], [side * 0.62, 0.75, 0.12]], 0.04, m.energy);
    }
  }
  return { root, joints };
}

function pulseClips(root, joints) {
  const needles = Array.from({ length: 7 }, (_, i) => `needle${i}`);
  return [
    createRigClip(root, joints, 'idle', 3.6, (u, t, { set }) => {
      const scan = Math.sin(TAU * u);
      set('turret', { r: [0, 0.12 * scan, 0] });
      set('carriage', { r: [0.025 * Math.sin(TAU * u * 2), 0, 0] });
      set('capacitor', { r: [0, 0, TAU * u] });
      needles.forEach((key, i) => set(key, { p: [0, 0, 0.012 * Math.sin(TAU * u * 2 + i * 0.7)] }));
      set('sensor', { r: [0, 0.25 * scan, 0] });
      set('sensor2', { r: [0, -0.3 * scan, 0] });
      set('coolantL', { r: [0, 0, 0.025 * scan] });
      set('coolantR', { r: [0, 0, -0.025 * scan] });
    }),
    createRigClip(root, joints, 'move', 1.8, (u, t, { set }) => {
      const scan = Math.sin(TAU * u);
      set('turret', { r: [0, 0.48 * scan, 0] });
      set('carriage', { r: [0.13 * Math.sin(TAU * u * 2), 0, 0] });
      set('capacitor', { r: [0, 0, -TAU * 2 * u] });
      needles.forEach((key, i) => set(key, { p: [0, 0, 0.05 * Math.sin(TAU * u + i * 0.45)] }));
      set('sensor', { r: [0, -TAU * u, 0] });
      set('sensor2', { r: [0, TAU * u, 0] });
    }),
    createRigClip(root, joints, 'attack', 0.84, (u, t, { set }) => {
      needles.forEach((key, i) => {
        const cycle = (u * 4 + i * 0.19) % 1;
        const kick = pulse(cycle, 0, 0.13, 0.43);
        set(key, { p: [0, 0, 0.115 * kick], r: [0.018 * kick, 0, 0] });
      });
      set('carriage', { r: [0.022 * Math.sin(TAU * u * 4), 0, 0] });
      set('capacitor', { r: [0, 0, -TAU * 4 * u] });
      set('chainL', { r: [0, 0, TAU * u] });
      set('chainR', { r: [0, 0, -TAU * u] });
      set('sensor', { r: [0, 0.08 * Math.sin(TAU * u * 2), 0] });
    }),
    createRigClip(root, joints, 'windup', 0.75, (u, t, { set }) => {
      const charge = ease(u, 0, 0.85);
      set('carriage', { r: [0.13 * charge, 0, 0] });
      set('capacitor', { r: [0, 0, TAU * 2 * u], s: [1 + 0.18 * charge, 1 + 0.18 * charge, 1] });
      needles.forEach((key, i) => set(key, { p: [0, 0, 0.045 * charge], r: [0, 0, (i - 3) * 0.006 * charge] }));
      set('chainL', { r: [0, 0, -0.5 * charge] });
      set('chainR', { r: [0, 0, 0.5 * charge] });
      set('sensor', { r: [0, TAU * u, 0] });
      set('coolantL', { p: [-0.04 * charge, 0, 0] });
      set('coolantR', { p: [0.04 * charge, 0, 0] });
    }),
    createRigClip(root, joints, 'release', 0.65, (u, t, { set }) => {
      const shot = pulse(u, 0, 0.14, 0.48);
      const recover = ease(u, 0.5, 1);
      needles.forEach((key, i) => set(key, { p: [0, 0, (0.045 + 0.18 * shot + i * 0.004 * shot) * (1 - recover)] }));
      set('carriage', { r: [0.13 * (1 - recover) - 0.055 * shot, 0, 0] });
      set('capacitor', { r: [0, 0, -TAU * 2 * u], s: [1 + 0.25 * shot, 1 + 0.25 * shot, 1] });
      set('chainL', { r: [0, 0, TAU * u] });
      set('chainR', { r: [0, 0, -TAU * u] });
      set('sensor2', { r: [0, TAU * u, 0] });
    }),
    createRigClip(root, joints, 'ability', 2.4, (u, t, { set }) => {
      const boost = pulse(u, 0, 0.18, 0.9);
      const antiAir = root.userData.branch === 'B';
      set('turret', { r: [0, 0.12 * Math.sin(TAU * u * 2) * boost, 0] });
      set('carriage', { r: [(antiAir ? 0.32 : 0.08) * boost, 0, 0] });
      set('capacitor', { r: [0, 0, TAU * 8 * u], s: [1 + 0.22 * boost, 1 + 0.22 * boost, 1] });
      needles.forEach((key, i) => {
        const cycle = (u * 8 + i * 0.13) % 1;
        const kick = pulse(cycle, 0, 0.12, 0.5) * boost;
        set(key, { p: [0, 0, 0.04 * boost + 0.13 * kick] });
      });
      set('chainL', { r: [TAU * 2 * u, 0, TAU * 2 * u], s: [1 + 0.18 * boost, 1 + 0.18 * boost, 1 + 0.18 * boost] });
      set('chainR', { r: [-TAU * 2 * u, 0, -TAU * 2 * u], s: [1 + 0.18 * boost, 1 + 0.18 * boost, 1 + 0.18 * boost] });
      set('sensor', { r: [0, TAU * 3 * u, 0] });
      set('sensor2', { r: [0, -TAU * 3 * u, 0] });
      set('coolantL', { p: [-0.09 * boost, 0, 0] });
      set('coolantR', { p: [0.09 * boost, 0, 0] });
    }),
    createRigClip(root, joints, 'shutdown', 2.1, (u, t, { set }) => {
      const down = ease(u, 0, 0.82);
      set('turret', { r: [0, 0.48 * down, 0] });
      set('carriage', { r: [-0.46 * down, 0, 0], p: [0, -0.09 * down, 0] });
      needles.forEach((key, i) => set(key, { p: [0, 0, 0.3 * down], s: [1, 1 - 0.15 * down, 1 - 0.2 * down] }));
      set('capacitor', { r: [0.4 * down, 0, 0.8 * down], s: [1 - 0.35 * down, 1 - 0.35 * down, 1 - 0.35 * down] });
      set('chainL', { r: [0, 0, -0.7 * down] });
      set('chainR', { r: [0, 0, 0.7 * down] });
      set('sensor', { r: [0.55 * down, 0.4 * down, 0] });
      set('sensor2', { r: [0.45 * down, -0.4 * down, 0] });
      set('coolantL', { p: [-0.08 * down, -0.08 * down, 0] });
      set('coolantR', { p: [0.08 * down, -0.08 * down, 0] });
    }),
  ];
}

function loomDrone(parent, m, prefix, active = true, heavy = false) {
  const drone = group(parent, prefix);
  const wingL = group(drone, `${prefix}_wing_l`);
  const wingR = group(drone, `${prefix}_wing_r`);
  if (!active) return { root: drone, wingL, wingR };
  hull(drone, `${prefix}_fuselage`, [
    { z: 0.27, w: heavy ? 0.25 : 0.2, h: 0.14, chamfer: 0.035 },
    { z: -0.12, w: heavy ? 0.31 : 0.25, h: heavy ? 0.2 : 0.16, chamfer: 0.04 },
    { z: -0.42, w: 0.09, h: 0.09, chamfer: 0.02 },
  ], m.hull);
  box(drone, `${prefix}_dorsal_armor`, [heavy ? 0.24 : 0.18, 0.075, 0.32], [0, 0.11, -0.02], m.armor, [0.06, 0, 0], 0.02);
  crystal(drone, `${prefix}_nose_eye`, 0.085, [0, 0, -0.4], m.core, [0.8, 0.8, 1.25]);
  cylinder(drone, `${prefix}_thruster`, 0.09, 0.12, 0.16, [0, 0, 0.31], m.dark, [Math.PI / 2, 0, 0], 16);
  torus(drone, `${prefix}_thruster_ring`, 0.09, 0.02, [0, 0, 0.405], m.energy);
  for (const [wing, side] of [[wingL, -1], [wingR, 1]]) {
    const id = side < 0 ? 'l' : 'r';
    const points = [[0, -0.24], [side * (heavy ? 0.48 : 0.42), 0.02], [side * 0.36, 0.27], [side * 0.07, 0.16]];
    panel(wing, `${prefix}_wing_panel_${id}`, points, 0.055, [0, 0, 0], m.armor);
    rod(wing, `${prefix}_wing_spar_${id}`, [side * 0.05, 0.025, -0.15], [side * 0.36, 0.025, 0.12], 0.022, m.gold);
    torus(wing, `${prefix}_rotor_${id}`, heavy ? 0.14 : 0.115, 0.025, [side * 0.31, 0.035, 0.1], m.dark, [Math.PI / 2, 0, 0]);
    torus(wing, `${prefix}_rotor_glow_${id}`, heavy ? 0.1 : 0.08, 0.014, [side * 0.31, 0.055, 0.1], m.energy, [Math.PI / 2, 0, 0]);
    box(wing, `${prefix}_wing_light_${id}`, [0.2, 0.025, 0.035], [side * 0.22, 0.05, 0.02], m.energy, [0, side * 0.45, 0], 0.006);
    wing.position.set(side * 0.1, 0.02, 0);
    for (const part of wing.children) { part.position.x -= side * 0.1; part.position.y -= 0.02; }
    wing.rotation.z = side * DOCKED_WING_FOLD;
    bearing(drone, `${prefix}_wing_hinge_${id}`, 0.045, 0.3, [side * 0.1, 0.02, 0], m, 'z');
  }
  rod(drone, `${prefix}_antenna`, [0, 0.11, 0.15], [0, 0.31, 0.23], 0.015, m.edge, 10);
  sphere(drone, `${prefix}_antenna_tip`, 0.035, [0, 0.31, 0.23], m.energy);
  if (heavy) {
    cylinder(drone, `${prefix}_marker_pod`, 0.1, 0.13, 0.22, [0, -0.14, -0.06], m.dark, [0, 0, 0], 16);
    lathe(drone, `${prefix}_marker_dish`, [[0.02, 0], [0.1, 0.025], [0.16, 0.08]], [0, -0.23, -0.06], m.gold, [0, 0, Math.PI], 32);
    torus(drone, `${prefix}_marker_rim`, 0.16, 0.018, [0, -0.3, -0.06], m.energy, [Math.PI / 2, 0, 0]);
  }
  return { root: drone, wingL, wingR };
}

function buildLoomBay(body, m, side, tier, branch, joints) {
  const id = side < 0 ? 'L' : 'R';
  const lower = id.toLowerCase();
  const heavy = branch === 'B';
  const roofY = heavy ? 1.05 : 0.89;
  const bay = group(body, `loom_bay_${lower}_frame`, [side * 0.56, 0.27, -0.38]);
  box(bay, `loom_bay_${lower}_floor`, [0.84, 0.09, 0.96], [0, -0.13, -0.2], m.dark, [0, 0, 0], 0.025);
  box(bay, `loom_bay_${lower}_rear`, [0.84, roofY - 0.17, 0.18], [0, (roofY + 0.17) / 2 - 0.27, 0.29], m.hull, [0, 0, 0], 0.04);
  for (const edge of SIDES) {
    box(bay, `loom_bay_${lower}_wall_${edge}`, [0.09, roofY - 0.18, 0.88], [edge * 0.4, (roofY + 0.02) / 2 - 0.27, -0.18], heavy ? m.armor : m.hull, [0, 0, 0], 0.022);
    box(bay, `loom_bay_${lower}_wall_light_${edge}`, [0.025, 0.055, 0.58], [edge * 0.453, 0.15, -0.22], m.energy);
    mesh(bay, `loom_bay_${lower}_guide_bush_${edge}`, annulusGeometry(0.05, 0.03, 0.24, 24), m.gold, [edge * 0.18, -0.04, -0.2], [Math.PI / 2, 0, 0]);
  }
  box(bay, `loom_bay_${lower}_launch_lip`, [0.72, 0.12, 0.18], [0, -0.07, -0.72], m.gold, [0.08, 0, 0], 0.025);
  fasteners(bay, `loom_bay_${lower}_fasteners`, [[-0.25, 0.19, 0.2], [0.25, 0.19, 0.2], [-0.25, -0.07, -0.65], [0.25, -0.07, -0.65]], m.edge, 'z', 0.026);

  const rail = group(body, `loom_rail_${id}`, [side * 0.56, 0.27, -0.38]);
  joints[`rail${id}`] = rail;
  for (const edge of SIDES) {
    rod(rail, `loom_rail_${lower}_guide_${edge}`, [edge * 0.18, -0.04, 0.26], [edge * 0.18, -0.04, -0.79], 0.025, m.edge);
    cylinder(rail, `loom_rail_${lower}_ram_${edge}`, 0.035, 0.035, 0.54, [edge * 0.23, 0.02, 0.03], m.gold, [Math.PI / 2, 0, 0], 16);
  }
  box(rail, `loom_rail_${lower}_shuttle`, [0.45, 0.11, 0.43], [0, 0, -0.17], m.armor, [0, 0, 0], 0.025);
  box(rail, `loom_rail_${lower}_shuttle_bus`, [0.25, 0.035, 0.31], [0, 0.07, -0.17], m.energy);

  const hatch = group(body, `loom_hatch_${id}`, [side * 0.56, roofY, -0.13]);
  joints[`hatch${id}`] = hatch;
  box(hatch, `loom_hatch_${lower}_door`, [0.9, heavy ? 0.12 : 0.075, 0.79], [0, 0, -0.39], heavy ? m.armor : m.hull, [0, 0, 0], 0.035);
  for (const edge of SIDES) bearing(body, `loom_hatch_${lower}_hinge_${edge}`, 0.07, 0.12, [side * 0.56 + edge * 0.3, roofY, -0.13], m, 'x');
  rod(hatch, `loom_hatch_${lower}_hinge_pin`, [-0.39, 0, 0], [0.39, 0, 0], 0.03, m.edge, 24);
  for (const z of [-0.18, -0.4, -0.62]) {
    box(hatch, `loom_hatch_${lower}_rib_${z}`, [0.69, 0.055, 0.055], [0, 0.065, z], m.gold, [0, 0, 0], 0.012);
  }
  box(hatch, `loom_hatch_${lower}_status`, [0.31, 0.035, 0.055], [0, 0.09, -0.66], m.energy);
  if (heavy) {
    for (const edge of SIDES) {
      panel(hatch, `loom_hatch_${lower}_armor_${edge}`, [[-0.1, -0.28], [0.1, -0.28], [0.15, 0.24], [-0.15, 0.24]], 0.055,
        [edge * 0.18, 0.09, -0.39], m.hull);
      addMechanicalLink(body.parent, joints, `loomHatch${id}${edge < 0 ? 'Inner' : 'Outer'}`, {
        from: { node: body, point: [side * 0.56 + edge * 0.46, 0.32, -0.25] },
        to: { node: hatch, point: [edge * 0.46, 0, -0.39] },
        radius: 0.026, sleeveRadius: 0.052, sleeveLength: 0.43, materials: m,
      });
    }
  } else if (tier > 1) {
    for (const x of [-0.18, 0, 0.18]) {
      box(hatch, `loom_hatch_${lower}_slot_${x}`, [0.08, 0.025, 0.35], [x, 0.065, -0.36], m.dark);
    }
  }
  const drone = loomDrone(rail, m, `loom_drone_${lower}`, true, heavy);
  drone.root.position.set(0, heavy ? 0.29 : 0.18, -0.18);
  joints[`drone${id}`] = drone.root;
  joints[`drone${id}WingL`] = drone.wingL;
  joints[`drone${id}WingR`] = drone.wingR;
}

function buildAuxRail(body, m, prefix, position, active, joints, railKey, hatchKey, droneKey) {
  const rail = group(body, `${prefix}_rail`, position);
  joints[railKey] = rail;
  const hatch = group(body, `${prefix}_hatch`, [position[0], position[1] + 0.55, position[2] + 0.24]);
  joints[hatchKey] = hatch;
  if (active) {
    const mount = group(body, `${prefix}_fixed_mount`, position);
    for (const side of SIDES) {
      rod(mount, `${prefix}_guide_${side}`, [side * 0.17, 0, 0.42], [side * 0.17, 0, -0.82], 0.022, m.edge);
      rod(body, `${prefix}_support_${side}`, [position[0] + side * 0.17, 1.31, 0.39], [position[0] + side * 0.17, position[1], position[2] + 0.2], 0.035, m.gold);
      rod(mount, `${prefix}_rear_hinge_post_${side}`, [side * 0.2, 0, 0.24], [side * 0.2, 0.55, 0.24], 0.035, m.hull);
      bearing(mount, `${prefix}_hinge_${side}`, 0.055, 0.09, [side * 0.2, 0.55, 0.24], m, 'x');
      panel(hatch, `${prefix}_door_${side}`, [[-0.13, -0.34], [0.13, -0.34], [0.16, 0.29], [-0.16, 0.29]], 0.05,
        [side * 0.15, 0, -0.31], m.armor, [Math.PI / 2, 0, 0]);
    }
    box(rail, `${prefix}_carriage`, [0.43, 0.1, 0.4], [0, 0, -0.14], m.hull);
    box(rail, `${prefix}_carriage_glow`, [0.26, 0.035, 0.28], [0, 0.065, -0.14], m.energy);
    box(hatch, `${prefix}_door_spine`, [0.055, 0.055, 0.65], [0, 0.04, -0.31], m.gold);
  }
  const drone = loomDrone(rail, m, `${prefix}_drone`, active, false);
  drone.root.position.set(0, 0.16, -0.17);
  joints[droneKey] = drone.root;
  joints[`${droneKey}WingL`] = drone.wingL;
  joints[`${droneKey}WingR`] = drone.wingR;
}

function buildLoom(variant) {
  const root = new THREE.Group();
  root.name = `drone_loom_${variant}`;
  const { tier, a, b } = variantInfo(root, variant);
  const m = palette('ally');
  const joints = {};
  anchorBase(root, m, 'loom', tier === 3 ? 2.75 : 2.55, 2.12, tier === 3);

  const body = group(root, 'loom_body', [0, 0.55, 0.08]);
  joints.body = body;
  hull(body, 'loom_fabrication_housing', [
    { z: 0.66, y: 0.37, w: 1.42, h: 0.75, chamfer: 0.14 },
    { z: 0.03, y: 0.39, w: 1.56, h: 0.82, chamfer: 0.15 },
    { z: -0.18, y: 0.3, w: 1.34, h: 0.58, chamfer: 0.1 },
  ], m.hull);
  box(body, 'loom_fabrication_brow', [1.48, 0.16, 0.4], [0, 0.79, 0.04], m.armor, [0.06, 0, 0], 0.04);
  for (const side of SIDES) {
    box(body, `loom_gantry_post_${side}`, [0.16, 1.3, 0.22], [side * 0.83, 0.68, 0.39], m.dark, [0, 0, side * -0.055], 0.035);
    rod(body, `loom_gantry_brace_${side}`, [side * 0.79, 0.22, 0.44], [side * 0.58, 1.15, 0.4], 0.045, m.gold);
    cable(body, `loom_gantry_thread_${side}`, [[side * 0.72, 0.21, 0.52], [side * 0.93, 0.75, 0.48], [side * 0.58, 1.25, 0.41], [0, 1.25, 0.4]], 0.025, m.energy);
  }
  box(body, 'loom_gantry_beam', [1.82, 0.17, 0.28], [0, 1.31, 0.39], m.armor, [0, 0, 0], 0.04);

  const loom = group(body, 'loom_weaver', [0, 0.91, 0.39]);
  joints.loom = loom;
  cylinder(loom, 'loom_weaver_bobbin', 0.21, 0.21, 0.48, [0, 0, 0], m.dark, [Math.PI / 2, 0, 0], 24);
  crystal(loom, 'loom_weaver_core', 0.24, [0, 0, -0.03], m.core, [0.85, 0.85, 1.25], [0, 0, Math.PI / 4]);
  torus(loom, 'loom_weaver_outer', 0.43, 0.045, [0, 0, 0], m.gold);
  torus(loom, 'loom_weaver_inner', 0.34, 0.025, [0, 0, -0.08], m.energy);
  for (let i = 0; i < 6; i++) {
    const angle = i * TAU / 6;
    rod(loom, `loom_weaver_spoke_${i}`, [Math.cos(angle) * 0.2, Math.sin(angle) * 0.2, 0], [Math.cos(angle) * 0.4, Math.sin(angle) * 0.4, 0], 0.025, i % 2 ? m.edge : m.accent);
  }
  box(loom, 'loom_weaver_index', [0.09, 0.19, 0.15], [0, 0.42, 0], m.armor);

  for (const side of SIDES) {
    const id = side < 0 ? 'L' : 'R';
    const spool = group(body, `loom_spool_${id}`, [side * 0.58, 0.93, 0.4]);
    joints[`spool${id}`] = spool;
    cylinder(spool, `loom_spool_${id}_core`, 0.13, 0.13, 0.34, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0], 20);
    for (const z of [-0.19, 0.19]) {
      cylinder(spool, `loom_spool_${id}_flange_${z}`, 0.24, 0.24, 0.055, [0, 0, z], m.gold, [Math.PI / 2, 0, 0], 16);
    }
    torus(spool, `loom_spool_${id}_winding`, 0.17, 0.045, [0, 0, 0], m.accent);
    buildLoomBay(body, m, side, tier, root.userData.branch, joints);
  }

  buildAuxRail(body, m, 'loom_aux_a', [a && tier === 3 ? -0.32 : 0, 1.58, -0.28], a, joints, 'auxRail', 'auxHatch', 'auxDrone');
  buildAuxRail(body, m, 'loom_aux_b', [0.32, 1.58, -0.28], a && tier === 3, joints, 'aux2Rail', 'aux2Hatch', 'aux2Drone');

  const sensor = group(body, 'loom_sensor', [0, 1.45, 0.44]);
  joints.sensor = sensor;
  if (b) {
    box(sensor, 'loom_marker_mast', [0.18, 0.4, 0.2], [0, -0.1, 0], m.dark);
    lathe(sensor, 'loom_marker_dish', [[0.025, 0], [0.2, 0.035], [0.39, 0.16]], [0, 0.22, 0], m.armor, [Math.PI / 2, 0, 0], 48);
    torus(sensor, 'loom_marker_dish_rim', 0.39, 0.032, [0, 0.22, 0.16], m.energy);
    rod(sensor, 'loom_marker_feed_arm', [0, 0.22, 0.1], [0, 0.22, -0.36], 0.032, m.gold);
    crystal(sensor, 'loom_marker_feed', 0.12, [0, 0.22, -0.4], m.core, [0.75, 0.75, 1.3]);
    for (const side of SIDES) {
      rod(sensor, `loom_marker_dipole_${side}`, [side * 0.2, 0.1, 0.06], [side * 0.49, 0.39, 0.08], 0.022, m.edge);
      sphere(sensor, `loom_marker_dipole_tip_${side}`, 0.05, [side * 0.49, 0.39, 0.08], m.energy);
    }
  } else {
    box(sensor, 'loom_swarm_tracker', [a ? 0.92 : 0.54, 0.12, 0.2], [0, 0, 0], m.dark);
    for (const x of a ? [-0.34, 0, 0.34] : [-0.16, 0.16]) {
      crystal(sensor, `loom_swarm_eye_${x}`, 0.085, [x, 0.05, -0.12], m.energy, [0.85, 0.85, 1.3]);
    }
  }
  const sensor2 = group(body, 'loom_sensor_secondary', [0.65, 1.29, 0.4]);
  joints.sensor2 = sensor2;
  if (b && tier === 3) {
    rod(sensor2, 'loom_marker_secondary_stem', [0, -0.24, 0], [0, 0.24, 0], 0.04, m.gold);
    lathe(sensor2, 'loom_marker_secondary_dish', [[0.02, 0], [0.14, 0.025], [0.27, 0.12]], [0, 0.26, 0], m.hull, [Math.PI / 2, 0, 0], 40);
    torus(sensor2, 'loom_marker_secondary_rim', 0.27, 0.025, [0, 0.26, 0.12], m.energy);
    crystal(sensor2, 'loom_marker_secondary_eye', 0.1, [0, 0.26, -0.2], m.core);
  }
  if (a) {
    rod(body, 'loom_swarm_overhead_truss_l', [-0.85, 1.32, 0.38], [-0.55, 1.65, -0.08], 0.045, m.gold);
    rod(body, 'loom_swarm_overhead_truss_r', [0.85, 1.32, 0.38], [0.55, 1.65, -0.08], 0.045, m.gold);
    box(body, 'loom_swarm_overhead_beam', [1.25, 0.12, 0.18], [0, 1.65, -0.08], m.armor);
    if (tier === 3) {
      for (const side of SIDES) {
        cylinder(body, `loom_swarm_reserve_spool_${side}`, 0.16, 0.16, 0.38, [side * 0.92, 0.87, 0.35], m.accent, [Math.PI / 2, 0, 0], 20);
        torus(body, `loom_swarm_reserve_flange_${side}`, 0.22, 0.035, [side * 0.92, 0.87, 0.56], m.gold);
      }
    }
  }
  if (b) {
    for (const side of SIDES) {
      box(body, `loom_marker_armor_${side}`, [0.24, 0.74, 0.6], [side * 0.83, 0.49, 0.25], m.armor, [0, 0, side * -0.1]);
      box(body, `loom_marker_armor_inlay_${side}`, [0.04, 0.43, 0.36], [side * 0.96, 0.51, 0.2], m.energy);
      if (tier === 3) {
        box(body, `loom_marker_reload_cassette_${side}`, [0.34, 0.75, 0.48], [side * 0.66, 0.76, 0.75], m.dark, [0.08, 0, side * -0.08]);
        for (let i = 0; i < 3; i++) {
          cylinder(body, `loom_marker_reload_cell_${side}_${i}`, 0.075, 0.09, 0.36, [side * 0.66, 0.55 + i * 0.21, 1.0], m.gold, [Math.PI / 2, 0, 0], 12);
        }
      }
    }
  }
  return { root, joints };
}

function loomClips(root, joints) {
  const droneKeys = ['droneL', 'droneR', 'auxDrone', 'aux2Drone'];
  const setWing = (set, key, opening) => {
    const angle = DOCKED_WING_FOLD * Math.max(0, Math.min(1, opening));
    set(`${key}WingL`, { r: [0, 0, angle] });
    set(`${key}WingR`, { r: [0, 0, -angle] });
  };
  const setWings = (set, amount) => {
    for (const key of droneKeys) setWing(set, key, amount);
  };
  const clip = (name, duration, pose) => createRigClip(root, joints, name, duration, (u, t, api) => pose(u, t, {
    ...api,
    set(key, value) {
      if (root.userData.branch === 'A' && /^hatch[LR]$/.test(key) && value.r) value = { ...value, r: [value.r[0] * 0.62, value.r[1], value.r[2]] };
      api.set(key, value);
    },
  }));
  return [
    clip('idle', 4.4, (u, t, { set }) => {
      const wave = Math.sin(TAU * u);
      set('body', { p: [0, 0.012 * wave, 0] });
      set('loom', { r: [0, 0, TAU * u] });
      set('spoolL', { r: [0, 0, -TAU * u] });
      set('spoolR', { r: [0, 0, TAU * u] });
      droneKeys.forEach((key, i) => set(key, { p: [0, 0.018 * Math.sin(TAU * u * 2 + i), 0], r: [0.015 * wave, 0, 0.02 * wave] }));
      setWings(set, 0);
      set('sensor', { r: [0, 0.22 * wave, 0] });
      set('sensor2', { r: [0, -0.28 * wave, 0] });
      set('hatchL', { r: [0.018 * wave, 0, 0] });
      set('hatchR', { r: [-0.018 * wave, 0, 0] });
    }),
    clip('move', 1.9, (u, t, { set }) => {
      const index = Math.sin(TAU * u);
      const open = pulse(u, 0, 0.35, 0.85);
      set('loom', { r: [0, 0, -TAU * 2 * u] });
      set('spoolL', { r: [0, 0, TAU * 2 * u] });
      set('spoolR', { r: [0, 0, -TAU * 2 * u] });
      set('railL', { p: [0, 0, 0.1 * index] });
      set('railR', { p: [0, 0, -0.1 * index] });
      set('auxRail', { p: [0, 0, 0.08 * index] });
      set('aux2Rail', { p: [0, 0, -0.08 * index] });
      for (const key of ['hatchL', 'hatchR', 'auxHatch', 'aux2Hatch']) set(key, { r: [0.22 * open, 0, 0] });
      setWings(set, 0);
      set('sensor', { r: [0, TAU * u, 0] });
    }),
    clip('attack', 1.05, (u, t, { set }) => {
      const open = ease(u, 0, 0.16) * (1 - ease(u, 0.74, 1));
      const flight = ease(u, 0.27, 0.74);
      const vanish = ease(u, 0.73, 0.94);
      const visible = Math.max(0.001, 1 - vanish);
      set('loom', { r: [0, 0, TAU * 2 * u] });
      set('spoolL', { r: [0, 0, -TAU * 3 * u] });
      set('spoolR', { r: [0, 0, TAU * 3 * u] });
      set('hatchL', { r: [1.18 * open, 0, 0] });
      set('hatchR', { r: [0.5 * open, 0, 0] });
      set('railL', { p: [0, 0, -0.2 * pulse(u, 0.2, 0.34, 0.62)] });
      set('railR', { p: [0, 0, -0.09 * pulse(u, 0.48, 0.6, 0.84)] });
      set('droneL', { p: [0, 0.68 * flight, -1.75 * flight], r: [-0.18 * flight, 0.08 * flight, -0.12 * flight], s: [visible, visible, visible] });
      set('droneR', { p: [0, 0.06 * Math.sin(TAU * u), -0.08 * open] });
      setWings(set, 0);
      setWing(set, 'droneL', ease(flight, 0.42, 0.72));
      set('sensor', { r: [0, 0.45 * flight, 0] });
      set('sensor2', { r: [0, -0.55 * flight, 0] });
    }),
    clip('windup', 1.15, (u, t, { set }) => {
      const charge = ease(u, 0, 0.86);
      set('body', { p: [0, 0.045 * charge, 0] });
      set('loom', { r: [0, 0, TAU * 2 * u], s: [1 + 0.18 * charge, 1 + 0.18 * charge, 1] });
      set('spoolL', { r: [0, 0, -TAU * 3 * u] });
      set('spoolR', { r: [0, 0, TAU * 3 * u] });
      for (const key of ['hatchL', 'hatchR', 'auxHatch', 'aux2Hatch']) set(key, { r: [1.15 * charge, 0, 0] });
      for (const key of ['railL', 'railR', 'auxRail', 'aux2Rail']) set(key, { p: [0, 0, 0.1 * charge] });
      droneKeys.forEach(key => set(key, { p: [0, 0.05 * charge, 0.06 * charge], r: [-0.08 * charge, 0, 0] }));
      setWings(set, 0);
      set('sensor', { r: [0, TAU * u, 0] });
      set('sensor2', { r: [0, -TAU * u, 0] });
    }),
    clip('release', 1.5, (u, t, { set }) => {
      const close = ease(u, 0.7, 1);
      const open = 1 - close;
      const flight = ease(u, 0.08, 0.7);
      const visible = Math.max(0.001, 1 - ease(u, 0.72, 0.94));
      set('body', { p: [0, 0.045 * open, 0] });
      set('loom', { r: [0, 0, TAU * 3 * u], s: [1 + 0.18 * open, 1 + 0.18 * open, 1] });
      set('spoolL', { r: [0, 0, -TAU * 4 * u] });
      set('spoolR', { r: [0, 0, TAU * 4 * u] });
      for (const key of ['hatchL', 'hatchR', 'auxHatch', 'aux2Hatch']) set(key, { r: [1.15 * open, 0, 0] });
      for (const key of ['railL', 'railR', 'auxRail', 'aux2Rail']) set(key, { p: [0, 0, 0.1 * open - 0.25 * pulse(u, 0.04, 0.18, 0.45)] });
      droneKeys.forEach((key, i) => {
        const stagger = ease(u, 0.06 + i * 0.035, 0.72 + i * 0.025);
        set(key, { p: [(i - 1.5) * 0.12 * stagger, 0.9 * stagger, -2.25 * stagger], r: [-0.22 * stagger, (i - 1.5) * 0.08 * stagger, (i - 1.5) * 0.09 * stagger], s: [visible, visible, visible] });
        setWing(set, key, ease(stagger, 0.42, 0.72));
      });
      set('sensor', { r: [0, TAU * 2 * u, 0] });
      set('sensor2', { r: [0, -TAU * 2 * u, 0] });
    }),
    clip('ability', 2.8, (u, t, { set }) => {
      const deploy = pulse(u, 0, 0.18, 0.93);
      const visible = Math.max(0.001, 1 - ease(u, 0.78, 0.96));
      set('body', { p: [0, 0.08 * deploy, 0] });
      set('loom', { r: [TAU * u, 0, TAU * 6 * u], s: [1 + 0.25 * deploy, 1 + 0.25 * deploy, 1 + 0.25 * deploy] });
      set('spoolL', { r: [0, 0, -TAU * 6 * u] });
      set('spoolR', { r: [0, 0, TAU * 6 * u] });
      for (const key of ['hatchL', 'hatchR', 'auxHatch', 'aux2Hatch']) set(key, { r: [1.28 * deploy, 0, 0] });
      for (const key of ['railL', 'railR', 'auxRail', 'aux2Rail']) set(key, { p: [0, 0, -0.28 * deploy] });
      droneKeys.forEach((key, i) => {
        const flight = ease(u, 0.18 + i * 0.07, 0.76 + i * 0.025);
        set(key, { p: [(i - 1.5) * 0.38 * flight, (0.65 + i * 0.12) * flight, -2.5 * flight], r: [-0.16 * flight, (i - 1.5) * 0.16 * flight, (i - 1.5) * 0.12 * flight], s: [visible, visible, visible] });
        setWing(set, key, ease(flight, 0.42, 0.72));
      });
      set('sensor', { r: [0, TAU * 3 * u, 0] });
      set('sensor2', { r: [0, -TAU * 4 * u, 0] });
    }),
    clip('shutdown', 2.5, (u, t, { set }) => {
      const down = ease(u, 0, 0.84);
      const hatchSettle = 0.24 * pulse(u, 0, 0.24, 0.75);
      set('body', { p: [0, -0.17 * down, 0.05 * down], r: [-0.08 * down, 0, 0] });
      set('loom', { r: [0.45 * down, 0, 0.8 * down], s: [1 - 0.38 * down, 1 - 0.38 * down, 1 - 0.38 * down] });
      set('spoolL', { r: [0.35 * down, 0, 0.4 * down] });
      set('spoolR', { r: [0.35 * down, 0, -0.4 * down] });
      for (const key of ['hatchL', 'hatchR', 'auxHatch', 'aux2Hatch']) set(key, { r: [hatchSettle, 0, 0] });
      for (const key of ['railL', 'railR', 'auxRail', 'aux2Rail']) set(key, { p: [0, -0.06 * down, 0.28 * down] });
      droneKeys.forEach(key => set(key, { p: [0, -0.08 * down, 0.08 * down], r: [0.12 * down, 0, 0], s: [1 - 0.15 * down, 1 - 0.15 * down, 1 - 0.15 * down] }));
      setWings(set, 0);
      set('sensor', { r: [0.65 * down, 0.35 * down, 0] });
      set('sensor2', { r: [0.5 * down, -0.4 * down, 0] });
    }),
  ];
}

export const entities = [
  defineEntity({
    id: 'resonance_guard',
    name: '共振守卫',
    kind: 'building',
    role: 'melee',
    locomotion: 'anchored',
    variants: VARIANTS,
    concept: '以谐振冲锤接敌的锚定守卫；青绿核心驱动可展开护翼，为附近友军分担伤害。A 分支扩展宽域护翼与谐振冠，B 分支以压力罐、导流堆和分叉冲头削弱敌群压力。',
    mechanism: '近战冲锤与友军减伤；T2A/T3A 扩大共振护持，T2B/T3B 强化压力导流。护翼展开对应增益，冲锤滑套对应近战，全部机构可收拢停机。',
    build: buildGuard,
    clips: guardClips,
  }),
  defineEntity({
    id: 'pulse_array',
    name: '脉冲针列',
    kind: 'building',
    role: 'ranged',
    locomotion: 'anchored',
    variants: VARIANTS,
    concept: '多根独立复进针管组成的快速直射阵列，以短行程后坐形成密集连发。A 分支采用交错针列和链式感应母线，B 分支采用纵向重针与防空碟形追踪器。',
    mechanism: '对地/对空快速直射；A 分支以链式母线表现二次跳击，B 分支以高俯仰针列与双碟表现对空强化。每根针管独立后坐，电容与散热机构参与充能和停机。',
    build: buildPulse,
    clips: pulseClips,
  }),
  defineEntity({
    id: 'drone_loom',
    name: '无人机织机',
    kind: 'building',
    role: 'ranged',
    locomotion: 'anchored',
    variants: VARIANTS,
    concept: '将青绿能量编织为追踪无人机的固定工厂，编织转子、独立舱盖和发射滑轨协同工作。A 分支增设上层蜂群发射轨，B 分支使用重甲舱、标记碟与无人机下挂标记器。',
    mechanism: '派出越过地形并追踪地空目标的无人机；T2A/T3A 具第三、第四独立发射机构，T2B/T3B 以重型无人机和双标记传感器表现承伤增幅标记。发射、装填翼面和停机折叠分别可动。',
    build: buildLoom,
    clips: loomClips,
  }),
];
