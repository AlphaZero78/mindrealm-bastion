import * as THREE from '../vendor/three/build/three.module.js';
import { palette, group, mesh, box, panel, cylinder, sphere, crystal, torus, arc, cable, rod, lathe, hull, bearing, fasteners, radial, mirrored, mergeStaticMeshes, annulusGeometry } from './geometry.js';
import { ENTITY_BY_ID } from './catalog.js';
import { entityDefinitions } from './entities/index.js';

const TAU = Math.PI * 2;

function memoryRunner() {
  const root = new THREE.Group();
  const m = palette('enemy');
  const body = group(root, 'Chassis', [0, 1.26, 0]);
  hull(body, 'Swept carrier hull', [
    { z: -0.70, w: 0.56, h: 0.34, y: 0.01 },
    { z: -0.48, w: 0.94, h: 0.58, y: 0.04 },
    { z: 0.20, w: 1.02, h: 0.64, y: 0.08 },
    { z: 0.59, w: 0.62, h: 0.45, y: 0.13 },
  ], m.hull);
  box(body, 'Lower load frame', [0.92, 0.12, 1.08], [0, -0.26, 0.03], m.dark, [0, 0, 0], 0.04);
  box(body, 'Front sensor recess', [0.52, 0.15, 0.08], [0, 0.04, -0.676], m.dark);
  box(body, 'Single frequency slit', [0.37, 0.036, 0.025], [0, 0.06, -0.725], m.energy, [0, 0, 0], 0.007);
  for (const side of [-1, 1]) {
    cable(body, `Cassette restraint ${side}`, [[side * 0.42, -0.12, -0.46], [side * 0.52, 0.22, -0.28], [side * 0.48, 0.38, 0.34]], 0.032, m.edge);
    for (const z of [-0.27, -0.03, 0.21]) {
      box(body, `Memory index ${side}_${z}`, [0.025, 0.15, 0.085], [side * 0.509, 0.04, z], m.accent, [0, 0, 0], 0.006);
    }
  }
  const cassette = group(body, 'Memory_cassette', [0, 0.35, 0.025], [-0.12, 0, 0]);
  const core = group(cassette, 'Memory_core', [0, 0.03, -0.025]);
  crystal(core, 'Encoded memory prism', 0.34, [0, 0, 0], m.glass, [0.77, 0.88, 1.16]);
  crystal(core, 'Inner signal fracture', 0.18, [0, 0.015, -0.03], m.core, [0.48, 1.25, 1.1], [0.18, 0.22, 0.16]);
  for (const side of [-1, 1]) {
    box(cassette, `Cassette shell ${side}`, [0.19, 0.40, 0.76], [side * 0.32, 0.015, 0.02], m.armor, [0, 0, side * -0.13], 0.055);
    box(cassette, `Shell inlay ${side}`, [0.035, 0.19, 0.44], [side * 0.422, 0.02, -0.02], m.dark, [0, 0, side * -0.13], 0.008);
    fasteners(cassette, `Cassette lock ${side}`, [[side * 0.43, 0.1, -0.22], [side * 0.43, 0.1, 0.22]], m.gold, 'x', 0.028);
  }
  const lid = group(cassette, 'Cassette_lid', [0, 0.27, 0.36]);
  for (const side of [-1, 1]) bearing(cassette, `Archive lid hinge ${side}`, 0.065, 0.1, [side * 0.31, 0.27, 0.36], m);
  rod(lid, 'Archive lid hinge pin', [-0.36, 0, 0], [0.36, 0, 0], 0.027, m.edge, 24);
  panel(lid, 'Hinged archive lid', [[-0.35, -0.70], [0.35, -0.70], [0.41, -0.54], [0.36, 0], [-0.36, 0], [-0.41, -0.54]], 0.065, [0, 0, 0], m.hull);
  box(lid, 'Lid spine', [0.14, 0.07, 0.52], [0, 0.02, -0.30], m.edge, [0, 0, 0], 0.015);
  const counterweight = group(body, 'Pendulum_counterweight', [0, 0.02, 0.54]);
  for (const side of [-1, 1]) rod(counterweight, `Pendulum arm ${side}`, [side * 0.12, 0, 0], [side * 0.12, -0.36, 0.40], 0.035, m.edge);
  hull(counterweight, 'Off-balance factory weight', [
    { z: 0.20, w: 0.29, h: 0.20, y: -0.35 }, { z: 0.44, w: 0.44, h: 0.30, y: -0.37 }, { z: 0.61, w: 0.26, h: 0.20, y: -0.36 },
  ], m.dark);
  box(counterweight, 'Weight lock', [0.45, 0.09, 0.11], [0, -0.36, 0.46], m.gold);
  bearing(counterweight, 'Pendulum axle', 0.13, 0.44, [0, 0, 0], m);
  const punch = group(body, 'Imprint_piston', [0, -0.055, -0.61]);
  const punchGuide = group(body, 'Imprint_fixed_guide', [0, -0.055, -0.61]);
  mesh(punchGuide, 'Imprint guide', annulusGeometry(0.15, 0.073, 0.34, 32), m.dark, [0, 0, -0.08], [Math.PI / 2, 0, 0]);
  mesh(punchGuide, 'Imprint guide mouth', annulusGeometry(0.17, 0.073, 0.06, 32), m.gold, [0, 0, -0.24], [Math.PI / 2, 0, 0]);
  cylinder(punch, 'Imprint ram', 0.065, 0.065, 1.0, [0, 0, -0.025], m.edge, [Math.PI / 2, 0, 0]);
  crystal(punch, 'Imprint die', 0.16, [0, 0, -0.54], m.accent, [1.1, 0.70, 0.58], [0, 0, Math.PI / 4]);
  torus(punch, 'Imprint contact halo', 0.12, 0.018, [0, 0, -0.57], m.energy);
  const vents = [];
  for (const side of [-1, 1]) {
    const vent = group(body, `Pressure_lock_${side < 0 ? 'L' : 'R'}`, [side * 0.49, 0.19, 0.23]);
    panel(vent, 'Pressure lock leaf', mirrored([[0, -0.25], [0.12, -0.23], [0.17, 0.20], [0, 0.29]], side), 0.055, [0, 0, 0], m.armor, [Math.PI / 2, 0, Math.PI / 2]);
    vents.push(vent);
  }
  const legs = {};
  for (const [index, side] of [-1, 1].entries()) {
    const id = side < 0 ? 'L' : 'R';
    const hip = group(body, `Hip_${id}`, [side * 0.43, -0.10, 0.07]);
    bearing(hip, `Hip bearing ${id}`, 0.145, 0.25, [0, 0, 0], m);
    box(hip, `Femur spine ${id}`, [0.17, 0.50, 0.21], [0, -0.29, 0], m.dark, [0, 0, 0], 0.04);
    box(hip, `Femur fairing ${id}`, [0.25, 0.34, 0.28], [side * 0.025, -0.23, -0.015], m.armor, [0.08, 0, side * 0.06], 0.055);
    rod(hip, `Femur actuator ${id}`, [side * -0.11, -0.05, 0.07], [side * -0.11, -0.52, 0.07], 0.025, m.gold);
    const knee = group(hip, `Knee_${id}`, [0, -0.62, 0]);
    bearing(knee, `Knee bearing ${id}`, 0.13, 0.27, [0, 0, 0], m);
    for (const strut of [-1, 1]) rod(knee, `Tibia rail ${id}_${strut}`, [strut * 0.072, -0.03, 0], [strut * 0.055, -0.54, 0.045], 0.028, m.edge);
    panel(knee, `Tibia shield ${id}`, [[-0.09, -0.42], [0.09, -0.42], [0.13, -0.04], [0.08, 0.06], [-0.08, 0.06], [-0.13, -0.04]], 0.12, [0, -0.20, -0.085], m.hull, [0, 0, 0]);
    const ankle = group(knee, `Ankle_${id}`, [0, -0.58, 0]);
    bearing(ankle, `Ankle bearing ${id}`, 0.085, 0.22, [0, 0, 0], m);
    hull(ankle, `Pendulum foot ${id}`, [
      { z: -0.40, w: 0.20, h: 0.075, y: -0.045 }, { z: -0.20, w: 0.35, h: 0.13, y: -0.035 }, { z: 0.20, w: 0.29, h: 0.11, y: -0.04 },
    ], m.dark);
    for (const toe of [-1, 1]) box(ankle, `Ground contact ${id}_${toe}`, [0.10, 0.045, 0.16], [toe * 0.07, -0.073, -0.26], m.edge, [0, 0, 0], 0.012);
    legs[id] = { hip, knee, ankle, side, offset: index * 0.5 };
  }
  return { root, joints: { body, cassette, core, lid, counterweight, punch, ventL: vents[0], ventR: vents[1], hipL: legs.L.hip, kneeL: legs.L.knee, ankleL: legs.L.ankle, hipR: legs.R.hip, kneeR: legs.R.knee, ankleR: legs.R.ankle } };
}

function repairSkiff() {
  const root = new THREE.Group();
  const m = palette('enemy');
  const flight = group(root, 'Flight_frame', [0, 1.40, 0]);
  hull(flight, 'Open memory keel', [
    { z: -0.93, w: 0.12, h: 0.15, y: -0.05 }, { z: -0.57, w: 0.50, h: 0.29, y: -0.03 },
    { z: 0.36, w: 0.62, h: 0.34, y: 0 }, { z: 0.80, w: 0.24, h: 0.20, y: 0.015 },
  ], m.hull);
  for (const z of [-0.48, 0.37]) torus(flight, `Keel restraint ${z}`, 0.31, 0.035, [0, 0.01, z], m.edge);
  box(flight, 'Forward seam sensor', [0.24, 0.055, 0.045], [0, 0.025, -0.80], m.energy, [0, 0, 0], 0.012);
  const heart = group(flight, 'Fractured_heart', [0, 0.39, -0.015]);
  const heartL = group(heart, 'Heart_left', [-0.105, 0, 0]);
  const heartR = group(heart, 'Heart_right', [0.105, 0, 0]);
  crystal(heartL, 'Left memory shard', 0.30, [0, 0, 0], m.glass, [0.55, 1.30, 0.78], [0, 0, -0.12]);
  crystal(heartR, 'Right memory shard', 0.30, [0, 0, 0], m.glass, [0.55, 1.30, 0.78], [0, 0, 0.12]);
  crystal(heart, 'Suture light', 0.105, [0, -0.015, 0], m.core, [0.65, 2.25, 0.85]);
  const halo = group(flight, 'Suture_halo', [0, 0.39, 0.04]);
  arc(halo, 'Open halo outer', 0.52, 0.023, -Math.PI * 0.25, Math.PI * 1.25, [0, 0, 0], m.gold);
  arc(halo, 'Open halo inner', 0.45, 0.012, Math.PI * 0.25, Math.PI * 1.75, [0, 0, 0.015], m.energy);
  const wings = {}, tips = {};
  const outline = [[0.05, -0.54], [0.44, -0.69], [0.95, -0.33], [1.45, 0.43], [1.37, 0.68], [1.08, 0.41], [0.56, 0.03], [0.13, 0.25]];
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    const wing = group(flight, `Crescent_wing_${id}`, [side * 0.17, 0.015, 0]);
    bearing(flight, `Crescent root socket ${id}`, 0.085, 0.24, [side * 0.17, 0.015, 0], m, 'z');
    panel(wing, `Crescent shell ${id}`, mirrored(outline, side), 0.08, [0, 0, 0], m.armor);
    panel(wing, `Crescent inset ${id}`, mirrored([[0.29, -0.39], [0.49, -0.46], [0.90, -0.16], [1.23, 0.40], [1.05, 0.23], [0.57, -0.06]], side), 0.023, [0, 0.063, 0], m.hull, [Math.PI / 2, 0, 0], 0.006);
    cable(wing, `Crescent leading spar ${id}`, [[0, 0.035, -0.52], [side * 0.46, 0.10, -0.62], [side * 0.97, 0.16, -0.26], [side * 1.43, 0.25, 0.47]], 0.025, m.edge);
    cable(wing, `Crescent signal vein ${id}`, [[side * 0.28, 0.077, -0.28], [side * 0.63, 0.092, -0.12], [side * 1.08, 0.14, 0.36]], 0.014, m.accent);
    const tip = group(wing, `Wingtip_trim_${id}`, [side * 1.21, 0.16, 0.39]);
    panel(tip, `Crescent tip ${id}`, mirrored([[0, -0.18], [0.24, 0.18], [0.15, 0.34], [-0.08, 0.03]], side), 0.052, [0, 0, 0], m.hull);
    wings[id] = wing;
    tips[id] = tip;
  }
  const magnets = [];
  for (let i = 0; i < 3; i++) {
    const angle = i * TAU / 3;
    const magnet = group(flight, `Magnetic_anchor_${i}`, radial(angle, 0.53, -0.24), [0, angle, 0]);
    torus(magnet, `Magnetic lift ring ${i}`, 0.19, 0.035, [0, 0, 0], m.edge, [Math.PI / 2, 0, 0]);
    torus(magnet, `Magnetic field ring ${i}`, 0.135, 0.016, [0, -0.035, 0], m.energy, [Math.PI / 2, 0, 0]);
    crystal(magnet, `Magnetic suspended pin ${i}`, 0.09, [0, -0.07, 0], m.dark, [0.75, 1.65, 0.75]);
    magnets.push(magnet);
  }
  const distributor = group(flight, 'Repair_distributor', [0, -0.28, -0.02]);
  torus(distributor, 'Suture distribution ring', 0.42, 0.034, [0, 0, 0], m.gold, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) {
    const angle = i * TAU / 6;
    crystal(distributor, `Distribution aperture ${i}`, 0.058, radial(angle, 0.42, 0), m.energy, [1, 0.55, 1]);
  }
  const stitches = {};
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    const stitch = group(flight, `Suture_arm_${id}`, [side * 0.39, -0.04, -0.36]);
    sphere(stitch, `Shoulder gimbal ${id}`, 0.105, [0, 0, 0], m.dark);
    rod(stitch, `Suture upper link ${id}`, [0, 0, 0], [-side * 0.07, -0.23, -0.13], 0.040, m.edge);
    sphere(stitch, `Suture elbow ${id}`, 0.075, [-side * 0.07, -0.23, -0.13], m.gold);
    rod(stitch, `Suture fore link ${id}`, [-side * 0.07, -0.23, -0.13], [-side * 0.21, -0.30, -0.39], 0.027, m.hull);
    cylinder(stitch, `Suture needle ${id}`, 0.012, 0.040, 0.32, [-side * 0.21, -0.30, -0.50], m.energy, [Math.PI / 2, 0, 0], 20);
    stitches[id] = stitch;
  }
  const pulse = group(flight, 'Repair_wave', [0, -0.28, 0], [0, 0, 0]);
  pulse.scale.setScalar(0.001);
  torus(pulse, 'Repair wave inner', 0.48, 0.016, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0]);
  torus(pulse, 'Repair wave outer', 0.62, 0.022, [0, 0, 0], m.field, [Math.PI / 2, 0, 0]);
  const tail = group(flight, 'Memory_tail', [0, 0.04, 0.67]);
  for (const side of [-1, 1]) panel(tail, `Memory streamer ${side}`, mirrored([[0, -0.08], [0.28, 0.16], [0.36, 0.43], [0.09, 0.28]], side), 0.035, [0, 0, 0], m.accent);
  return { root, joints: { flight, heart, heartL, heartR, halo, wingL: wings.L, wingR: wings.R, tipL: tips.L, tipR: tips.R, distributor, stitchL: stitches.L, stitchR: stitches.R, pulse, tail, magnet0: magnets[0], magnet1: magnets[1], magnet2: magnets[2] } };
}

function nullWing() {
  const root = new THREE.Group();
  const m = palette('enemy');
  const flight = group(root, 'Flight_frame', [0, 1.48, 0]);
  hull(flight, 'Patrol prism fuselage', [
    { z: -0.99, w: 0.055, h: 0.10, y: -0.04 }, { z: -0.55, w: 0.43, h: 0.32, y: -0.015 },
    { z: 0.33, w: 0.60, h: 0.44, y: 0.02 }, { z: 0.80, w: 0.19, h: 0.20, y: 0.025 },
  ], m.hull);
  hull(flight, 'Prism dorsal armor', [
    { z: -0.54, w: 0.17, h: 0.17, y: 0.22 }, { z: 0.18, w: 0.33, h: 0.30, y: 0.28 }, { z: 0.58, w: 0.13, h: 0.16, y: 0.17 },
  ], m.armor);
  box(flight, 'Null receptor recess', [0.32, 0.11, 0.08], [0, -0.005, -0.647], m.dark);
  box(flight, 'Null receptor slit', [0.22, 0.028, 0.022], [0, 0.015, -0.697], m.energy, [0, 0, 0], 0.005);
  const prism = group(flight, 'Cancellation_prism', [0, 0.46, 0.055]);
  crystal(prism, 'Floating cancellation prism', 0.32, [0, 0, 0], m.glass, [0.65, 1.42, 0.74], [0.08, 0, 0]);
  crystal(prism, 'Inner opposing signal', 0.15, [0, 0, 0], m.core, [0.43, 1.68, 0.62]);
  const forks = {}, tines = {};
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    const fork = group(flight, `Tuning_fork_${id}`, [side * 0.31, -0.025, 0.10]);
    bearing(fork, `Fork gimbal ${id}`, 0.105, 0.19, [0, 0, 0], m, 'y');
    rod(fork, `Tuning stem ${id}`, [0, 0, 0], [side * 0.49, 0, 0.03], 0.060, m.hull);
    box(fork, `Tuning spine ${id}`, [0.45, 0.095, 0.16], [side * 0.29, 0.025, 0.025], m.armor, [0, 0, 0], 0.025);
    const pair = [];
    for (const sign of [-1, 1]) {
      const tine = group(fork, `Fork_tine_${id}_${sign < 0 ? 'lower' : 'upper'}`, [side * 0.46, 0, 0.03]);
      rod(tine, `Tine conductor ${id}_${sign}`, [0, 0, 0], [side * 0.66, sign * 0.28, 0], 0.027, m.edge);
      box(tine, `Tine blade ${id}_${sign}`, [0.48, 0.095, 0.16], [side * 0.39, sign * 0.17, 0], m.hull, [0, 0, side * sign * 0.40], 0.028);
      box(tine, `Tine phase line ${id}_${sign}`, [0.34, 0.024, 0.045], [side * 0.41, sign * 0.19, -0.095], m.energy, [0, 0, side * sign * 0.40], 0.005);
      crystal(tine, `Tine end ${id}_${sign}`, 0.10, [side * 0.68, sign * 0.30, 0], m.accent, [1.45, 0.62, 0.80]);
      pair.push(tine);
    }
    forks[id] = fork;
    tines[id] = pair;
  }
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = group(flight, `Silence_arc_${i}`, [0, -0.025, 0], [0, i * TAU / 3, 0]);
    arc(ring, `Broken phase arc ${i}`, 0.88, 0.042, -0.65, 0.65, [0, 0, 0], m.gold, [Math.PI / 2, 0, 0]);
    arc(ring, `Arc signal trace ${i}`, 0.88, 0.013, -0.56, 0.56, [0, 0.039, 0], m.energy, [Math.PI / 2, 0, 0]);
    for (const side of [-1, 1]) {
      const a = side * 0.65;
      crystal(ring, `Arc terminal ${i}_${side}`, 0.092, [Math.cos(a) * 0.88, 0, Math.sin(a) * 0.88], m.armor, [0.8, 1.3, 0.8]);
    }
    rings.push(ring);
  }
  const field = group(flight, 'Null_wave', [0, -0.12, 0]);
  field.scale.setScalar(0.001);
  torus(field, 'Phase cancellation wave', 1.03, 0.022, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0]);
  torus(field, 'Phase cancellation membrane', 1.11, 0.07, [0, 0, 0], m.field, [Math.PI / 2, 0, 0]);
  const probe = group(flight, 'Invasion_probe', [0, -0.09, -0.62]);
  const probeGuide = group(flight, 'Invasion_fixed_guide', [0, -0.09, -0.62]);
  mesh(probeGuide, 'Invasion guide', annulusGeometry(0.075, 0.039, 0.36, 24), m.dark, [0, 0, -0.1], [Math.PI / 2, 0, 0]);
  mesh(probeGuide, 'Invasion guide gland', annulusGeometry(0.087, 0.039, 0.05, 24), m.gold, [0, 0, -0.26], [Math.PI / 2, 0, 0]);
  cylinder(probe, 'Invasion needle', 0.023, 0.033, 0.98, [0, 0, -0.01], m.edge, [Math.PI / 2, 0, 0], 24);
  crystal(probe, 'Invasion tip', 0.085, [0, 0, -0.53], m.energy, [0.55, 0.55, 1.35]);
  const keel = group(flight, 'Ventral_keel', [0, -0.20, 0.25]);
  panel(keel, 'Ventral stabilizer', [[-0.04, -0.28], [0.04, -0.28], [0.12, 0.26], [0, 0.37], [-0.12, 0.26]], 0.075, [0, 0, 0], m.armor, [0, 0, 0]);
  return { root, joints: { flight, prism, forkL: forks.L, forkR: forks.R, tineLU: tines.L[1], tineLL: tines.L[0], tineRU: tines.R[1], tineRL: tines.R[0], ring0: rings[0], ring1: rings[1], ring2: rings[2], field, probe, keel } };
}

function tripod(root, m, prefix, radius = 0.78) {
  for (let i = 0; i < 3; i++) {
    const angle = i * TAU / 3;
    panel(root, `${prefix}_foot_${i}`, [[-0.14, -0.31], [0.14, -0.31], [0.22, 0.08], [0.14, 0.33], [-0.14, 0.33], [-0.22, 0.08]], 0.11, radial(angle, radius, 0.085), m.hull, [Math.PI / 2, angle, 0], 0.027);
    rod(root, `${prefix}_strut_${i}`, radial(angle, radius * 0.89, 0.14), radial(angle, 0.28, 0.53), 0.065, m.edge);
    rod(root, `${prefix}_piston_${i}`, radial(angle, radius * 0.66, 0.24), radial(angle, 0.31, 0.45), 0.030, m.gold);
    crystal(root, `${prefix}_contact_${i}`, 0.08, radial(angle, radius, 0.055), m.accent, [1, 0.38, 1]);
  }
  cylinder(root, `${prefix}_base`, 0.51, 0.58, 0.19, [0, 0.20, 0], m.hull, [0, 0, 0], 64);
  torus(root, `${prefix}_base_inlay`, 0.50, 0.025, [0, 0.29, 0], m.energy, [Math.PI / 2, 0, 0]);
}

function focusRail() {
  const root = new THREE.Group();
  const m = palette('friendly');
  tripod(root, m, 'Focus', 0.82);
  const baseRing = group(root, 'Azimuth_ring', [0, 0.33, 0]);
  cylinder(baseRing, 'Azimuth bearing', 0.36, 0.41, 0.16, [0, 0.06, 0], m.dark);
  torus(baseRing, 'Azimuth encoder', 0.38, 0.025, [0, 0.12, 0], m.gold, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 12; i++) box(baseRing, `Encoder tick ${i}`, [0.025, 0.04, 0.065], radial(i * TAU / 12, 0.38, 0.14), m.edge, [0, i * TAU / 12, 0], 0.004);
  const yaw = group(root, 'Yaw_cradle', [0, 0.51, 0]);
  cylinder(yaw, 'Cradle hub', 0.30, 0.35, 0.18, [0, 0, 0], m.armor);
  for (const side of [-1, 1]) {
    rod(yaw, `Gimbal support ${side}`, [side * 0.43, 0.02, 0], [side * 0.35, 0.63, 0], 0.075, m.hull);
    box(yaw, `Gimbal support shield ${side}`, [0.13, 0.39, 0.32], [side * 0.405, 0.32, 0], m.armor, [0, 0, side * 0.13], 0.04);
    bearing(yaw, `Elevation axle ${side}`, 0.15, 0.16, [side * 0.39, 0.64, 0], m);
  }
  const pitch = group(yaw, 'Pitch_gimbal', [0, 0.64, 0]);
  for (const side of [-1, 1]) {
    rod(yaw, `Gimbal foot bridge ${side}`, [side * 0.24, 0.02, 0], [side * 0.43, 0.07, 0], 0.085, m.hull, 24);
    rod(pitch, `Elevation spindle ${side}`, [side * 0.2, 0, 0], [side * 0.5, 0, 0], 0.055, m.edge, 24);
    box(pitch, `Accelerator recoil slide ${side}`, [0.09, 0.12, 0.72], [side * 0.245, -0.08, 0.16], m.gold, [0, 0, 0], 0.025);
  }
  const outer = group(pitch, 'Outer_gyroscope');
  torus(outer, 'Outer calibration ring', 0.59, 0.040, [0, 0, 0], m.edge);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    box(outer, `Gyroscope clamp ${i}`, [0.13, 0.13, 0.13], [Math.cos(angle) * 0.59, Math.sin(angle) * 0.59, 0], m.hull, [0, 0, angle], 0.025);
  }
  const inner = group(pitch, 'Inner_gyroscope', [0, 0, 0], [0, 0.24, 0]);
  torus(inner, 'Inner calibration ring', 0.47, 0.023, [0, 0, 0], m.gold);
  arc(inner, 'Inner signal arc', 0.47, 0.012, 0.18, Math.PI - 0.18, [0, 0, 0.018], m.energy);
  const gun = group(pitch, 'Accelerator_assembly');
  hull(gun, 'Accelerator breech', [
    { z: -0.42, w: 0.39, h: 0.27 }, { z: 0.18, w: 0.46, h: 0.34 }, { z: 0.56, w: 0.30, h: 0.26 },
  ], m.hull);
  for (const side of [-1, 1]) {
    box(gun, `Accelerator rail ${side}`, [0.086, 0.13, 1.46], [side * 0.16, -0.005, -0.82], m.dark, [0, 0, 0], 0.022);
    box(gun, `Rail machined lip ${side}`, [0.047, 0.045, 1.38], [side * 0.22, 0.065, -0.82], m.edge, [0, 0, 0], 0.009);
    box(gun, `Rail induction line ${side}`, [0.024, 0.032, 1.21], [side * 0.105, -0.006, -0.85], m.energy, [0, 0, 0], 0.005);
  }
  const coils = group(gun, 'Induction_coils');
  for (const [index, z] of [-0.36, -0.64, -0.92, -1.20].entries()) {
    torus(coils, `Induction coil ${index}`, 0.235, 0.022, [0, 0, z], index % 2 ? m.accent : m.gold);
  }
  const focus = group(gun, 'Focus_prism', [0, 0, -0.86]);
  crystal(focus, 'Suspended focusing crystal', 0.18, [0, 0, 0], m.core, [0.65, 0.65, 1.80]);
  torus(focus, 'Prism containment band', 0.14, 0.012, [0, 0, 0], m.energy, [0, Math.PI / 2, 0]);
  cylinder(gun, 'Rear capacitor', 0.20, 0.23, 0.36, [0, 0, 0.54], m.dark, [Math.PI / 2, 0, 0]);
  torus(gun, 'Rear capacitor seal', 0.20, 0.025, [0, 0, 0.69], m.energy);
  box(gun, 'Sight bracket', [0.10, 0.17, 0.38], [0, 0.245, -0.23], m.armor, [0, 0, 0], 0.025);
  crystal(gun, 'Sight crystal', 0.095, [0, 0.27, -0.43], m.energy, [0.70, 0.70, 1.20]);
  const beam = group(gun, 'Focused_beam', [0, 0, -1.54]);
  beam.scale.setScalar(0.001);
  cylinder(beam, 'Coherent shot', 0.026, 0.040, 1.5, [0, 0, -0.75], m.energy, [Math.PI / 2, 0, 0], 20);
  cylinder(beam, 'Coherent shot envelope', 0.065, 0.09, 1.5, [0, 0, -0.75], m.field, [Math.PI / 2, 0, 0], 20);
  const charge = group(gun, 'Muzzle_charge', [0, 0, -1.54]);
  charge.scale.setScalar(0.001);
  crystal(charge, 'Charge point', 0.105, [0, 0, 0], m.core);
  torus(charge, 'Charge ring', 0.15, 0.013, [0, 0, 0], m.energy);
  return { root, joints: { baseRing, yaw, pitch, outer, inner, gun, coils, focus, beam, charge } };
}

function arcMortar() {
  const root = new THREE.Group();
  const m = palette('friendly');
  tripod(root, m, 'Resonance', 0.80);
  for (let i = 0; i < 3; i++) {
    const angle = i * TAU / 3 + Math.PI / 3;
    cylinder(root, `Echo capacitor ${i}`, 0.10, 0.13, 0.30, radial(angle, 0.51, 0.40), m.gold);
    torus(root, `Echo capacitor band ${i}`, 0.103, 0.014, radial(angle, 0.51, 0.49), m.energy, [Math.PI / 2, 0, 0]);
  }
  const yaw = group(root, 'Yaw_cradle', [0, 0.48, 0]);
  cylinder(yaw, 'Resonance pedestal', 0.35, 0.42, 0.24, [0, 0, 0], m.armor);
  torus(yaw, 'Pedestal encoder', 0.35, 0.025, [0, 0.12, 0], m.energy, [Math.PI / 2, 0, 0]);
  for (const side of [-1, 1]) {
    rod(yaw, `Bowl trunnion support ${side}`, [side * 0.25, 0.08, 0], [side * 0.52, 0.40, 0], 0.065, m.hull);
    bearing(yaw, `Bowl trunnion ${side}`, 0.14, 0.15, [side * 0.51, 0.39, 0], m);
  }
  const cradle = group(yaw, 'Resonance_cradle', [0, 0.39, 0], [-0.18, 0, 0]);
  const bowlFrame = group(cradle, 'Resonance_bowl_mount', [0, -0.13, 0]);
  for (const side of [-1, 1]) {
    cylinder(cradle, `Bowl trunnion socket ${side}`, 0.12, 0.12, 0.08, [side * 0.375, 0, 0], m.dark, [0, 0, Math.PI / 2]);
    rod(cradle, `Bowl trunnion shaft ${side}`, [side * 0.32, 0, 0], [side * 0.55, 0, 0], 0.055, m.edge, 24);
  }
  lathe(bowlFrame, 'Open resonance bowl', [[0.12, 0], [0.25, 0.03], [0.46, 0.20], [0.57, 0.45], [0.54, 0.51], [0.48, 0.44], [0.36, 0.23], [0.16, 0.14], [0.12, 0]], [0, 0, 0], m.hull);
  lathe(bowlFrame, 'Bowl inner conductor', [[0.15, 0.08], [0.29, 0.18], [0.46, 0.40], [0.48, 0.43]], [0, 0, 0], m.accent);
  const rim = group(bowlFrame, 'Bowl_rim', [0, 0.48, 0]);
  torus(rim, 'Resonance lip', 0.535, 0.032, [0, 0, 0], m.edge, [Math.PI / 2, 0, 0]);
  const throwRing = group(bowlFrame, 'Throw_ring', [0, 0.30, 0]);
  torus(throwRing, 'Delivery ring', 0.425, 0.030, [0, 0, 0], m.gold, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) crystal(throwRing, `Delivery contact ${i}`, 0.065, radial(i * Math.PI / 2, 0.425, 0), m.energy, [1, 0.65, 1]);
  const orb = group(bowlFrame, 'Echo_charge', [0, 0.44, 0]);
  crystal(orb, 'Suspended echo charge', 0.22, [0, 0, 0], m.core, [0.90, 1.18, 0.90]);
  torus(orb, 'Echo charge equator', 0.28, 0.016, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0]);
  arc(orb, 'Echo charge meridian', 0.27, 0.012, -1.2, 1.2, [0, 0, 0], m.gold, [0, Math.PI / 2, 0]);
  const petals = [];
  for (let i = 0; i < 3; i++) {
    const angle = i * TAU / 3;
    const petal = group(bowlFrame, `Resonance_petal_${i}`, radial(angle, 0.48, 0.33), [0, angle, 0]);
    panel(petal, `Harmonic leaf ${i}`, [[0, -0.13], [0.10, -0.015], [0.09, 0.23], [0, 0.36], [-0.09, 0.23], [-0.10, -0.015]], 0.055, [0, 0.12, 0], m.gold, [0, 0, 0]);
    panel(petal, `Harmonic leaf inset ${i}`, [[0, -0.05], [0.045, 0.07], [0.035, 0.21], [0, 0.26], [-0.035, 0.21], [-0.045, 0.07]], 0.015, [0, 0.13, 0.041], m.energy, [0, 0, 0], 0.003);
    petals.push(petal);
  }
  const projectile = group(root, 'Echo_projectile', [0, 1.2, 0]);
  projectile.scale.setScalar(0.001);
  crystal(projectile, 'Echo projectile core', 0.16, [0, 0, 0], m.core);
  torus(projectile, 'Echo projectile ring', 0.23, 0.018, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0]);
  const pulse = group(root, 'Reverberation_wave', [0, 0.10, 0]);
  pulse.scale.setScalar(0.001);
  torus(pulse, 'Reverberation front', 0.76, 0.022, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0]);
  torus(pulse, 'Reverberation envelope', 0.84, 0.07, [0, 0, 0], m.field, [Math.PI / 2, 0, 0]);
  return { root, joints: { yaw, cradle, bowlFrame, rim, throwRing, orb, petal0: petals[0], petal1: petals[1], petal2: petals[2], projectile, pulse } };
}

function resistanceBeacon() {
  const root = new THREE.Group();
  const m = palette('friendly', true);
  for (let i = 0; i < 3; i++) {
    const angle = i * TAU / 3;
    panel(root, `Circuit root ${i}`, [[-0.12, -0.40], [0.12, -0.40], [0.20, 0.06], [0.11, 0.39], [-0.11, 0.39], [-0.20, 0.06]], 0.095, radial(angle, 0.61, 0.07), m.hull, [Math.PI / 2, angle, 0], 0.025);
    cable(root, `Luminous neural trace ${i}`, [radial(angle, 0.88, 0.105), radial(angle, 0.62, 0.14), radial(angle + 0.12, 0.37, 0.22), radial(angle + 0.12, 0.25, 0.40)], 0.015, m.energy);
    crystal(root, `Root anchor ${i}`, 0.11, radial(angle, 0.87, 0.08), m.armor, [1.1, 0.42, 1.1]);
  }
  cylinder(root, 'Beacon foundation', 0.43, 0.52, 0.16, [0, 0.16, 0], m.dark, [0, 0, 0], 64);
  torus(root, 'Foundation light seal', 0.43, 0.022, [0, 0.24, 0], m.energy, [Math.PI / 2, 0, 0]);
  lathe(root, 'Tapered wakeful spire', [[0.34, 0.22], [0.31, 0.34], [0.19, 0.46], [0.145, 0.87], [0.23, 0.98], [0.20, 1.07], [0.11, 1.10]], [0, 0, 0], m.hull);
  const helix = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, a = t * TAU * 1.6;
    helix.push([Math.sin(a) * (0.22 - t * 0.055), 0.34 + t * 0.60, Math.cos(a) * (0.22 - t * 0.055)]);
  }
  cable(root, 'Wakeful helix', helix, 0.013, m.gold);
  for (let i = 0; i < 3; i++) {
    const angle = i * TAU / 3;
    cable(root, `Lantern suspension ${i}`, [radial(angle, 0.19, 0.82), radial(angle, 0.43, 1.16), radial(angle, 0.37, 1.62), radial(angle, 0.15, 1.94)], 0.030, m.edge);
    crystal(root, `Suspension joint ${i}`, 0.09, radial(angle, 0.42, 1.18), m.gold, [0.8, 1.2, 0.8]);
  }
  const petalSystem = group(root, 'Shield_petal_system');
  const petals = [];
  for (let i = 0; i < 3; i++) {
    const angle = i * TAU / 3;
    const petal = group(petalSystem, `Shield_petal_${i}`, radial(angle, 0.36, 1.03), [0, angle, 0]);
    panel(petal, `Shield leaf ${i}`, [[0, -0.09], [0.19, 0.15], [0.22, 0.45], [0, 0.79], [-0.22, 0.45], [-0.19, 0.15]], 0.07, [0, 0, 0], m.armor, [0, 0, 0], 0.025);
    panel(petal, `Shield membrane ${i}`, [[0, 0.045], [0.135, 0.21], [0.145, 0.43], [0, 0.65], [-0.145, 0.43], [-0.135, 0.21]], 0.017, [0, 0, 0.052], m.glass, [0, 0, 0], 0.004);
    rod(petal, `Shield leaf spine ${i}`, [0, -0.07, 0.073], [0, 0.70, 0.073], 0.017, m.edge);
    crystal(petal, `Shield leaf signal ${i}`, 0.07, [0, 0.33, 0.077], m.core, [0.58, 1.8, 0.40]);
    petals.push(petal);
  }
  const core = group(root, 'Wakeful_core', [0, 1.46, 0]);
  crystal(core, 'Wakeful flame', 0.35, [0, 0, 0], m.core, [0.70, 1.45, 0.70]);
  crystal(core, 'Flame interior', 0.18, [0, -0.04, 0], m.energy, [0.65, 1.65, 0.65], [0.12, 0, 0.12]);
  const spark = group(core, 'Flame_spark', [0.055, 0.45, 0]);
  crystal(spark, 'Free ember', 0.13, [0, 0, 0], m.energy, [0.62, 1.45, 0.62], [0, 0, -0.20]);
  const halo = group(root, 'Wakeful_halo', [0, 1.45, 0]);
  torus(halo, 'Lower halo', 0.46, 0.021, [0, 0, 0], m.gold, [Math.PI / 2, 0, 0]);
  arc(halo, 'Open wakeful arc', 0.54, 0.014, -0.25, Math.PI * 1.45, [0, 0.05, 0], m.energy, [Math.PI / 2, 0, 0]);
  const crown = group(root, 'Wakeful_crown', [0, 2.02, 0]);
  torus(crown, 'Crown ring', 0.16, 0.018, [0, 0, 0], m.gold, [Math.PI / 2, 0, 0]);
  crystal(crown, 'Crown ember', 0.07, [0, 0.055, 0], m.energy, [0.8, 1.3, 0.8]);
  const pulse = group(root, 'Clarity_wave', [0, 0.30, 0]);
  pulse.scale.setScalar(0.001);
  torus(pulse, 'Clarity wave', 0.85, 0.021, [0, 0, 0], m.energy, [Math.PI / 2, 0, 0]);
  torus(pulse, 'Clarity envelope', 0.92, 0.075, [0, 0, 0], m.field, [Math.PI / 2, 0, 0]);
  const field = group(root, 'Boundary_field', [0, 0.35, 0]);
  field.scale.setScalar(0.001);
  mesh(field, 'Self boundary hemisphere', new THREE.SphereGeometry(1.24, 48, 20, 0, TAU, 0, Math.PI / 2), m.field);
  return { root, joints: { petalSystem, petal0: petals[0], petal1: petals[1], petal2: petals[2], core, spark, halo, crown, pulse, field } };
}

const builders = { memory_runner: memoryRunner, repair_skiff: repairSkiff, null_wing: nullWing, focus_rail: focusRail, arc_mortar: arcMortar, resistance_beacon: resistanceBeacon };

export function buildCoreModel(id) {
  const { root, joints } = builders[id]();
  root.name = id;
  root.userData = {
    ...root.userData,
    title: ENTITY_BY_ID[id].name,
    design: ENTITY_BY_ID[id].design,
    origin: 'Original procedural geometry created for this independent preview. No stock model parts.',
  };
  mergeStaticMeshes(root);
  root.updateMatrixWorld(true);
  return { root, joints };
}

export function buildModel(id, variant = 'base') {
  const definition = entityDefinitions[id];
  if (!definition) return buildCoreModel(id);
  const selected = definition.variants.includes(variant) ? variant : definition.variants[0];
  const { root, joints } = definition.build(selected);
  root.name = `${id}__${selected}`;
  root.userData = {
    ...root.userData,
    title: definition.name,
    design: definition.concept,
    mechanism: definition.mechanism,
    origin: 'Original procedural geometry and articulated animation. No stock model parts.',
  };
  mergeStaticMeshes(root);
  root.updateMatrixWorld(true);
  return { root, joints, definition };
}
