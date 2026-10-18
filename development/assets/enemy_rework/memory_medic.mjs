import { part, joint, sp, handed } from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up. Four real two-link legs carry a continuous medical
// keel. The cabinet, pump and two tools remain attached to their own bearings.
const rig = [
  joint('chassis', [0, 0, .92]),
  joint('cabinet', [0, .08, 1.10], 'chassis'),
  joint('sensor', [0, -.43, 1.40], 'cabinet'),
  joint('pump', [0, .08, 1.56], 'cabinet'),
];

const legs = [
  { id: 'LF', side: -1, y: -.41 },
  { id: 'RF', side: 1, y: -.41 },
  { id: 'LR', side: -1, y: .41 },
  { id: 'RR', side: 1, y: .41 },
];
for (const { id, side, y } of legs) {
  const x = side * .58;
  rig.push(
    joint('hip' + id, [x, y, .92], 'chassis'),
    joint('knee' + id, [x, y, .53], 'hip' + id),
    joint('ankle' + id, [x, y, .15], 'knee' + id),
  );
}
for (const side of [-1, 1]) {
  const id = side < 0 ? 'L' : 'R', x = side * .63;
  rig.push(
    joint('shoulder' + id, [x, -.26, 1.43], 'cabinet'),
    joint('elbow' + id, [x, -.26, 1.11], 'shoulder' + id),
    joint('wrist' + id, [x, -.26, .79], 'elbow' + id),
  );
}

const base = [
  part('single enclosed medical load shell', sp('corridor_wall'), [1.24, 1.18, .24], [0, 0, .84], 'chassis', [0, 0, 0], 'armor'),
  part('ribbed sealed treatment cabinet', sp('machine_generatorLarge'), [.96, .96, .49], [0, .09, 1.06], 'cabinet', [0, 0, 0], 'ivory'),
  part('front clinical telemetry visor', sp('desk_computerScreen'), [.37, .16, .23], [0, -.43, 1.32], 'sensor', [8, 0, 0], 'glow'),
  part('extended central pressure pump guide sleeve', sp('machine_barrelLarge'), [.23, .23, .38], [0, .08, 1.32], 'cabinet', [0, 0, 0], 'metal'),
  part('rounded captive axial pump cartridge', sp('rocket_fuelB'), [.14, .14, .33], [0, .08, 1.45], 'pump', [0, 0, 0], 'gold'),
  handed(part('left inset repair compound cartridge', sp('rocket_fuelB'), [.25, .41, .28], [-.25, .28, 1.39], 'cabinet', [0, 0, 0], 'glow'), -1),
  part('right inset reserve compound cartridge', sp('rocket_fuelB'), [.25, .41, .28], [.25, .28, 1.39], 'cabinet', [0, 0, 0], 'gold'),
];

for (const { id, side, y } of legs) {
  const x = side * .58;
  base.push(...[
    // Cast bearing sleeves align with the transverse load axis. Their
    // bottom-centre origin shifts half the axle depth onto the joint pivot.
    part('transverse load bearing ' + id, sp('pipe_ringHigh'), [.24, .24, .10], [x - side * .05, y, .92], 'hip' + id, [0, side * 90, 0], 'metal'),
    part('sealed upper load servo ' + id, sp('machine_barrel'), [.22, .24, .39], [x, y, .53], 'hip' + id, [0, 0, 0], 'metal'),
    part('exposed knee drive bearing ' + id, sp('pipe_ring'), [.22, .22, .08], [x - side * .04, y, .53], 'knee' + id, [0, side * 90, 0], 'gold'),
    part('rounded lower servo casing ' + id, sp('rocket_fuelB'), [.25, .26, .38], [x, y, .15], 'knee' + id, [0, 0, 0], 'ivory'),
    part('single wide forefoot and rear contact sole ' + id, sp('corridor_wall'), [.32, .44, .14], [x, y - .035, .01], 'ankle' + id, [0, 0, 0], 'armor'),
  ].map(piece => handed(piece, side)));
}

for (const side of [-1, 1]) {
  const id = side < 0 ? 'L' : 'R', x = side * .63;
  base.push(...[
    part('treatment shoulder trunnion ' + id, sp('pipe_ringHigh'), [.25, .25, .12], [x - side * .06, -.26, 1.43], 'shoulder' + id, [0, side * 90, 0], 'metal'),
    part('sealed instrument upper arm ' + id, sp('machine_barrel'), [.19, .20, .32], [x, -.26, 1.11], 'shoulder' + id, [0, 0, 0], 'ivory'),
    part('instrument elbow cross axle ' + id, sp('pipe_ring'), [.21, .21, .08], [x - side * .04, -.26, 1.11], 'elbow' + id, [0, side * 90, 0], 'gold'),
    part('sealed forearm infusion driver ' + id, sp('machine_barrelLarge'), [.19, .20, .32], [x, -.26, .79], 'elbow' + id, [0, 0, 0], 'ivory'),
    part('sealed applicator wrist coupling ' + id, sp('pipe_ringHigh'), [.17, .17, .08], [x - side * .04, -.26, .79], 'elbow' + id, [0, side * 90, 0], 'metal', true),
    part('concave treatment pulse applicator ' + id, sp('satelliteDish_detailed'), [.29, .28, .23], [x, -.32, .755], 'wrist' + id, [0, 0, 0], 'glow'),
  ].map(piece => handed(piece, side)));
}

export default {
  id: 'memory_medic', kind: 'enemies', role: 'normal', locomotion: 'walker',
  rig, variants: { base },
  design: {
    name: '记忆医师',
    silhouette: 'Four-foot clinical repair chassis: one clean load shell, a pale ribbed cabinet, exposed paired compound cartridges, a central axial pump and two forward unfolding concave applicators.',
    loadPath: 'Four broad soles directly seat the .38 rounded lower servo cases, knee axles, .39 sealed upper servos and transverse hip bearings beneath the load shell. Cabinet sidewalls seat both shoulder trunnions.',
    joints: 'Four independent hip/knee/ankle chains; cabinet load pivot; two shoulder/elbow/wrist instrument chains; captive axial pump and clinical visor. The tool arms have pitch, lateral inclination and outward yaw.',
    locomotion: 'Travel-driven four-beat gait has 75% stance per foot, normally three supporting soles, a lifted return, two-link IK and sole levelling. Relative stance Y advances at exactly one model unit per root travel unit.',
    attack: 'Right instrument folds into preparation, straightens through a forward contact stroke, seats its concave tool on the blocker, recoils through the elbow, and returns. The left tool supports the clinical cabinet.',
    ability: 'Actual heal ability: 1.1 s warning, 6-cell radius, 9% maximum HP including self. First settle the support frame; unfold both instrument chains, draw the axial plunger, compress it at release, then reseat tools and pump. All healing rules remain in core/battle.js.',
    damage: 'Cabinet load bearing deflects, instrument elbows relieve pressure and the captive plunger rebounds inside its guide. Death closes the tools and drops the cabinet as knee drives buckle over the actual 650 ms window; soles retain contact.',
    surfaces: 'Kenney CC0 processed machinery shells, ribbed cabinet, complete bevelled keel, sealed load servos, rounded lower casings and enclosed instrument arms. The pump guide covers more of its captive cartridge while the concave working tools and joint clearances stay visible.',
    detailPolicy: '39 parts retain the complete support and instrument chains. Only the two wrist seals are distance details. Duplicate cartridge collars, ankle frames, turret rings and the concealed rear regulator are removed.',
    symmetry: 'Paired legs, treatment arms, wrist applicators and cartridges use true source reflection. Cartridge positions match; glow and gold distinguish active and reserve compound. The right arm contact stroke remains the intended operating asymmetry.',
    sourceLicense: 'Kenney Space Kit CC0; original meshes and license remain in development/assets/model_sources/kenney/space-kit and registered runtime GLBs are reused.',
  },
};
