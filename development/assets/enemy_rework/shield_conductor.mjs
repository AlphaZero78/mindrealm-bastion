import { part, joint, sp, handed } from '../../web-tools/enemy-model-authoring.mjs';

// Coordinates: X right, Y rear, Z up. The vault and distribution arms sit on
// a walking switchgear keel. The four feet have full .44/.42 load chains.
const rig = [
  joint('chassis', [0, 0, .95]),
  joint('vault', [0, .06, 1.02], 'chassis'),
  joint('sensor', [0, -.38, 1.42], 'vault'),
  joint('ram', [0, -.60, 1.11], 'vault'),
  joint('distributor', [0, .15, 1.55], 'vault'),
];
const legs = [
  { id: 'LF', side: -1, y: -.40 },
  { id: 'RR', side: 1, y: .40 },
  { id: 'RF', side: 1, y: -.40 },
  { id: 'LR', side: -1, y: .40 },
];
for (const { id, side, y } of legs) {
  const x = side * .56;
  rig.push(
    joint('hip' + id, [x, y, .95], 'chassis'),
    joint('knee' + id, [x, y, .51], 'hip' + id),
    joint('ankle' + id, [x, y, .09], 'knee' + id),
  );
}
for (const side of [-1, 1]) {
  const id = side < 0 ? 'L' : 'R', x = side * .61;
  rig.push(
    joint('shoulder' + id, [x, .10, 1.51], 'vault'),
    joint('reflector' + id, [x, .10, 1.16], 'shoulder' + id),
  );
}

const base = [
  part('single broad switchgear load shell', sp('corridor_wall'), [1.26, 1.18, .28], [0, 0, .83], 'chassis', [0, 0, 0], 'armor'),
  part('open arched distribution vault', sp('hangar_roundB'), [1.05, .86, .67], [0, .10, 1.03], 'vault', [0, 0, 0], 'armor'),
  part('ribbed power converter inside the vault', sp('machine_generatorLarge'), [.47, .44, .39], [0, .09, 1.10], 'vault', [0, 0, 0], 'metal'),
  part('exposed forward command telemetry', sp('machine_wireless'), [.34, .27, .25], [0, -.38, 1.32], 'sensor', [0, 0, 0], 'glow'),
  part('captured forward contact ram sleeve', sp('machine_barrelLarge'), [.30, .30, .32], [0, -.43, 1.11], 'vault', [90, 0, 0], 'metal'),
  part('faceted contact ram nose', sp('rocket_topB'), [.24, .24, .35], [0, -.60, 1.11], 'ram', [90, 0, 0], 'blade'),
  part('rear retained shield charge reservoir', sp('rocket_fuelB'), [.27, .34, .42], [0, .44, 1.16], 'vault', [0, 0, 0], 'gold'),
  part('single distribution bus housing', sp('corridor_wall'), [.98, .27, .21], [0, .10, 1.36], 'vault', [0, 0, 0], 'metal'),
  part('extended pressure spindle guide', sp('machine_barrelLarge'), [.25, .25, .46], [0, .15, 1.23], 'vault', [0, 0, 0], 'metal'),
  part('rounded captive shield pressure cartridge', sp('rocket_fuelB'), [.14, .14, .45], [0, .15, 1.39], 'distributor', [0, 0, 0], 'glow'),
];

for (const { id, side, y } of legs) {
  const x = side * .56;
  base.push(...[
    // These meshes are square cast clevis housings, not rolling wheels.
    // Their axis centre coincides with the load pivot after static rotation.
    part('square transverse hip clevis ' + id, sp('pipe_ringHigh'), [.23, .23, .10], [x - side * .05, y, .95], 'hip' + id, [0, side * 90, 0], 'metal'),
    part('sealed upper load servo ' + id, sp('machine_barrel'), [.23, .24, .44], [x, y, .51], 'hip' + id, [0, 0, 0], 'metal'),
    part('square knee drive casting ' + id, sp('pipe_ring'), [.22, .22, .08], [x - side * .04, y, .51], 'knee' + id, [0, side * 90, 0], 'gold'),
    part('rounded lower load servo shell ' + id, sp('rocket_fuelB'), [.25, .25, .42], [x, y, .09], 'knee' + id, [0, 0, 0], 'armor'),
    part('single broad front and rear contact sole ' + id, sp('corridor_wall'), [.33, .44, .09], [x, y - .025, 0], 'ankle' + id, [0, 0, 0], 'armor'),
  ].map(piece => handed(piece, side)));
}

for (const side of [-1, 1]) {
  const id = side < 0 ? 'L' : 'R', x = side * .61;
  base.push(...[
    part('bus seated enclosed shoulder socket ' + id, sp('rocket_fuelB'), [.29, .30, .22], [side * .50, .10, 1.39], 'vault', [0, 0, 0], 'metal'),
    part('transverse reflector shoulder clevis ' + id, sp('pipe_ringHigh'), [.21, .21, .08], [x - side * .04, .10, 1.51], 'shoulder' + id, [0, side * 90, 0], 'gold'),
    part('sealed reflector lifting arm ' + id, sp('machine_barrel'), [.21, .22, .35], [x, .10, 1.16], 'shoulder' + id, [0, 0, 0], 'metal'),
    part('faceted lower reflector trunnion ' + id, sp('rocket_baseB'), [.21, .21, .12], [x - side * .06, .10, 1.16], 'reflector' + id, [0, side * 90, 0], 'metal'),
    part('large concave shield distribution reflector ' + id, sp('satelliteDish_large'), [.62, .40, .62], [x, .03, 1.06], 'reflector' + id, [0, 0, side * 24], 'glow'),
  ].map(piece => handed(piece, side)));
}

export default {
  id: 'shield_conductor', kind: 'enemies', role: 'normal', locomotion: 'walker',
  rig, variants: { base },
  design: {
    name: '护盾指挥体',
    silhouette: 'A broad crowned walking switchgear: one continuous bevelled keel, an open arched vault, a visible central pressure spindle and paired concave reflector heads on lifting frames. The forward contact nose remains below the exposed command receiver.',
    geometryEvidence: 'corridor_wall provides the clean load shell, bus and soles; hangar_roundB provides the open vault. machine_barrel and rocket_fuelB retain their machinery cases. The mirrored satelliteDish_large preserves its inclined bowl, feed and pedestal. pipe_ring/High remain compact cast joints; machine_wireless remains a small receiver with its thin antenna.',
    loadPath: 'Four zero-height soles directly seat the .42 lower servos, knee castings, .44 upper servos and hip clevises beneath the load shell. One transverse bus seats both enclosed shoulder sockets; each .35 lifting arm and trunnion carries one complete reflector pedestal.',
    articulation: 'Four independent hip/knee/ankle chains, a vault load bearing, two shoulder/reflector chains, one captured forward contact ram and one axial pressure spindle. The reflector counter-rotates its arm inclination and changes yaw for circumferential distribution.',
    locomotion: 'A travel-driven four-beat gait keeps three supporting feet. The 75% linear stance cancels actual root advance; swing returns with a polynomial lift. Two-link inverse kinematics follows the exact .44/.42 pivots and levels every sole. Moving remains independent of casting.',
    attack: 'The forward contact ram draws into its fixed sleeve, performs one .14-unit work stroke, carries a short contact load, rebounds and returns. The vault transfers the load above the continuously supporting feet.',
    ability: 'Actual group_shield rule: 1.1 s warning, six-cell radius and max(current shield, 12% maximum HP). During warning the two lifting frames open sideways and aim their bowls outward while the spindle draws; release compresses the spindle once, then reseats the bowls. Shield fill only biases the spindle gauge; all combat rules remain in core/battle.js.',
    damage: 'A hit deflects the vault load bearing and unloads the reflector hinges; the spindle rebounds inside its sleeve. Over the actual 650 ms death window, all four knee drives buckle, the contact ram retracts and the open vault leans forward while soles remain on the ground.',
    surfaces: '40 structural and working parts reuse licensed Kenney CC0 GLBs. Single sole and load shells, enclosed shoulder sockets, sealed lifting arms and one bus housing keep the connections legible. The spindle guide retains a visible pressure cartridge; the vault and both bowls remain open.',
    review: 'Inspect front three-quarter for contact nose and clear sensor, rear three-quarter for reservoir/bus connection, low side for sole contact, and overhead for shoulder sockets and arm clearance. Compare warning end with release start, cast while moving, the loaded contact frame and the settled death pose.',
    sourceLicense: 'Kenney Space Kit CC0; originals and License.txt remain in development/assets/model_sources/kenney/space-kit. Only registered runtime meshes are referenced.',
    symmetry: 'Four legs and both shoulder/reflector assemblies use true reflection, including the native inclined dish and pedestal. Single keel, bus and sole shells replace compressed spacecraft details; duplicate ankle frames are removed. The central receiver, pressure spindle and rear reservoir retain the fore-to-aft working layout.',
  },
};
