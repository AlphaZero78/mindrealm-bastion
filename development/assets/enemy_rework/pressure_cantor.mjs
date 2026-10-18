import { part, joint, sp, handed } from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up; front is -Y. Two short load legs carry a tall,
// continuous pressure cabinet. The paired cups share its shoulder bridge.
const rig = [
  joint('chassis', [0, .07, .83]),
  joint('resonator', [0, .09, .98], 'chassis'),
  joint('pump', [0, .10, 1.76], 'resonator'),
  joint('cam', [0, .35, 1.73], 'resonator'),
  joint('sensor', [0, -.27, 1.72], 'resonator'),
  joint('striker', [0, -.51, .88], 'chassis'),
];

for (const side of [-1, 1]) {
  const id = side < 0 ? 'L' : 'R', x = side * .42;
  rig.push(
    joint('hip' + id, [x, .07, .83], 'chassis'),
    joint('knee' + id, [x, .07, .44], 'hip' + id),
    joint('ankle' + id, [x, .07, .08], 'knee' + id),
    joint('horn' + id, [side * .58, -.10, 1.48], 'resonator'),
    joint('shutter' + id, [side * .79, -.06, 1.46], 'horn' + id),
    joint('vent' + id, [side * .52, .32, 1.34], 'resonator'),
  );
}

const base = [
  part('single bevelled pelvic load saddle', sp('corridor_wall'), [.94, .78, .24], [0, .07, .75], 'chassis', [0, 0, 0], 'armor'),
  part('upright ribbed pressure cabinet', sp('machine_generatorLarge'), [.55, .60, .76], [0, .10, .96], 'resonator', [0, 0, 0], 'native'),
  part('rear captive pressure reservoir', sp('machine_barrelLarge'), [.31, .28, .58], [0, .335, 1.02], 'resonator', [0, 0, 0], 'metal'),
  part('upper pressure telemetry visor', sp('desk_computerScreen'), [.29, .15, .22], [0, -.27, 1.64], 'sensor', [0, 0, 0], 'glow'),
  part('single rounded shoulder bridge', sp('corridor_wall'), [1.21, .28, .24], [0, -.08, 1.30], 'resonator', [0, 0, 0], 'metal'),
  part('extended axial pressure follower guide sleeve', sp('machine_barrel'), [.17, .17, .39], [0, .10, 1.55], 'resonator', [0, 0, 0], 'metal'),
  part('captured axial pressure follower', sp('rocket_fuelA'), [.07, .07, .34], [0, .10, 1.67], 'pump', [0, 0, 0], 'gold'),
];

for (const side of [-1, 1]) {
  const id = side < 0 ? 'L' : 'R', x = side * .42;
  base.push(...[
    part('compact transverse hip bearing ' + id, sp('pipe_ringHigh'), [.26, .26, .11], [x - side * .055, .07, .83], 'hip' + id, [0, side * 90, 0], 'metal'),
    part('sealed thigh load servo ' + id, sp('machine_barrel'), [.21, .23, .39], [x, .07, .44], 'hip' + id, [0, 0, 0], 'metal'),
    part('compact knee servo flange ' + id, sp('pipe_ring'), [.22, .22, .09], [x - side * .045, .07, .44], 'knee' + id, [0, side * 90, 0], 'gold'),
    part('rounded sealed lower servo shank ' + id, sp('rocket_fuelB'), [.22, .24, .36], [x, .07, .08], 'knee' + id, [0, 0, 0], 'ivory'),
    part('single elongated heel and forefoot sole ' + id, sp('corridor_wall'), [.32, .58, .12], [x, -.015, 0], 'ankle' + id, [0, 0, 0], 'armor'),
  ].map(piece => handed(piece, side)));
}

for (const side of [-1, 1]) {
  const id = side < 0 ? 'L' : 'R';
  base.push(...[
    part('sealed vertical voice cheek load housing ' + id, sp('machine_barrel'), [.18, .22, .43], [side * .49, -.08, 1.12], 'resonator', [0, 0, 0], 'metal'),
    part('compact transverse voice gimbal flange ' + id, sp('pipe_ring'), [.24, .24, .08], [side * .58 - side * .04, -.10, 1.48], 'horn' + id, [0, side * 90, 0], 'gold'),
    part('deep concave pressure voice cup ' + id, sp('satelliteDish_large'), [.62, .51, .59], [side * .60, -.15, 1.28], 'horn' + id, [0, 0, side * 12], 'native'),
    part('sealed voice rear compression chamber ' + id, sp('machine_barrelLarge'), [.17, .18, .35], [side * .60, .20, 1.31], 'horn' + id, [0, 0, 0], 'metal'),
    part('single curved voice aperture door ' + id, sp('corridor_wallCorner'), [.30, .12, .45], [side * .82, -.08, 1.25], 'shutter' + id, [0, 0, side * 90], 'ivory'),
    part('rounded rear pressure heat shutter ' + id, sp('rocket_fuelB'), [.16, .33, .45], [side * .54, .32, 1.10], 'vent' + id, [0, side * 5, 0], 'metal'),
  ].map(piece => handed(piece, side)));
}

base.push(
  part('lower impact carriage double guide', sp('supports_low'), [.51, .34, .13], [0, -.36, .75], 'chassis', [0, 0, 0], 'metal'),
  part('extended forward impact ram sleeve', sp('machine_barrel'), [.22, .22, .46], [0, -.13, .89], 'chassis', [90, 0, 0], 'gold'),
  part('telescoping forward impact ram shaft', sp('rocket_fuelA'), [.082, .082, .55], [0, -.17, .88], 'striker', [90, 0, 0], 'metal'),
  part('flanged near combat pressure shoe', sp('rocket_baseB'), [.46, .46, .12], [0, -.665, .88], 'striker', [90, 0, 0], 'armor'),
  part('pressure follower captured top cap', sp('rocket_topA'), [.14, .14, .14], [0, .10, 1.94], 'pump', [0, 0, 0], 'glow'),
  part('exposed four ear pressure driver cam', sp('rocket_baseA'), [.22, .22, .08], [0, .39, 1.73], 'cam', [90, 0, 0], 'gold'),
  part('pressure cam eccentric follower pin', sp('rocket_fuelA'), [.042, .042, .06], [0, .37, 1.755], 'cam', [90, 0, 0], 'accent', true),
  part('slotted cam to pressure follower crosshead', sp('supports_low'), [.11, .23, .11], [0, .225, 1.675], 'pump', [0, 0, 0], 'metal'),
);

export default {
  id: 'pressure_cantor', kind: 'enemies', role: 'normal', locomotion: 'walker',
  rig, variants: { base },
  design: {
    name: '压力咏唱者',
    silhouette: 'An upright two-foot ritual pressure machine: broad paired concave voice cups flank one ribbed central cabinet, with a captured top follower, outer aperture doors and a lower forward pressure shoe.',
    loadPath: 'Two long contact soles directly seat the .36 rounded lower servos, compact knee axles, .39 sealed thighs and hip bearings beneath one pelvic shell. A single shoulder bridge and sealed cheek mounts carry both voice cups.',
    joints: 'Independent hip, knee and ankle chains; resonator load seat; left and right voice gimbals with aperture-door children; rear heat vanes; axial follower, rear eccentric driver cam, telemetry visor and linear combat shoe.',
    locomotion: 'Model travel drives an alternating two-link gait. Each foot has 66% stance, a raised return and a level sole. During stance its relative Y advances exactly one unit for each model unit of forward root travel. The upper cabinet shifts its load over the supporting side.',
    attack: 'The captured combat shaft withdraws along the lower guide, then performs a forward pressure-shoe stroke, holds contact, unloads and reseats. Both support legs brace by bending while the soles retain contact.',
    ability: 'Actual pressure_aura: 1.1 s warning, then a 4 s field that raises death pressure by 25% within 6 cells. Voice doors and heat vanes unfold, the top follower loads, one strong compression stroke releases the field, and a real cam/follower cycle maintains the held aperture until its timed return.',
    damage: 'The upper cabinet and independent cup gimbals absorb the hit above the planted sole system. Death vents pressure, lowers the knee drives, closes the voice doors and folds the cups forward over the 650 ms presentation window.',
    sourceGeometry: 'machine_generatorLarge provides the stepped cabinet; machine_barrel and rocket_fuelB provide complete machinery cases. satelliteDish_large retains its concave bowl and pedestal. corridor_wall and mirrored corridor_wallCorner provide clean supports and curved aperture doors. The eccentric driver keeps the existing rocket-base cam.',
    detailPolicy: '37 processed GLB parts retain the complete voice and impact mechanisms. The cam follower pin is the sole distance detail; duplicated thigh inserts, ankle frames, front tube overlay and lower cabinet overlap are removed.',
    finishRevision: 'A single shoulder bridge and sealed cheek mounts carry the cups. Rounded thigh/shank cases and heat shutters soften the outline; longer follower and impact sleeves reduce exposed shafts while retaining their operating strokes.',
    symmetry: 'Legs, inclined voice cups, compression chambers, curved aperture doors and heat shutters use true reflection. Compact bearings replace projecting rocket supports. Clean pelvic and shoulder shells expose the two working cups; the rear cam and its eccentric pin retain their mechanical asymmetry.',
    sourceLicense: 'Registered Kenney Space Kit CC0 runtime GLBs; original meshes and License.txt remain in development/assets/model_sources/kenney/space-kit.',
  },
};
