import { part, joint, sp, td, handed } from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up. The press, hood and field arms share a closed load
// deck; their bearings stay at the same physical mounts in all three phases.
const rig = [
  joint('chassis', [0, .10, .38]),
  joint('body', [0, .10, .76], 'chassis'),
  joint('platen', [0, .08, 1.66], 'body'),
  joint('hood', [0, .55, 1.60], 'body'),
  joint('ram', [0, -.66, .74], 'body'),
  joint('jawL', [-.31, -1.08, .74], 'ram'),
  joint('jawR', [.31, -1.08, .74], 'ram'),
  joint('telemetry', [0, .77, .98], 'body'),
];
for (const side of [-1, 1]) {
  const tag = side < 0 ? 'L' : 'R';
  rig.push(
    joint('wheel' + tag + 'F', [side * .97, -.82, .38], 'chassis'),
    joint('wheel' + tag + 'R', [side * .97, .88, .38], 'chassis'),
    joint('field' + tag, [side * .68, .13, 1.06], 'body'),
    joint('cool' + tag, [side * .61, .48, 1.58], 'body'),
    joint('rearField' + tag, [side * .43, .79, 1.32], 'body'),
  );
}

// Bake permanent stage deployments about their actual fixed hinge. Every
// moving component of a deployed arm uses that one bearing, avoiding a second
// untransformed child pivot inside a baked phase assembly.
function hinge(piece, pivot, axis, degrees) {
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const d = piece.position.map((v, i) => v - pivot[i]);
  const q = axis === 0 ? [d[0], d[1] * c - d[2] * s, d[1] * s + d[2] * c]
    : [d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c];
  piece.position = q.map((v, i) => v + pivot[i]);
  // Pre-multiply the authored source orientation by the world hinge. Merely
  // adding Euler Y would rotate an outward-facing Z90 dish on another axis.
  const [rx, ry, rz] = piece.rotation.map(v => v * Math.PI / 180);
  const [cx, cy, cz, sx, sy, sz] = [Math.cos(rx), Math.cos(ry), Math.cos(rz), Math.sin(rx), Math.sin(ry), Math.sin(rz)];
  const columns = [[cy * cz, cy * sz, -sy], [sx * sy * cz - cx * sz, sx * sy * sz + cx * cz, sx * cy], [cx * sy * cz + sx * sz, cx * sy * sz - sx * cz, cx * cy]].map(v => axis === 0 ? [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c] : [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]);
  piece.rotation = [Math.atan2(columns[1][2], columns[2][2]), Math.asin(Math.max(-1, Math.min(1, -columns[0][2]))), Math.atan2(columns[0][1], columns[0][0])].map(v => v * 180 / Math.PI);
  return piece;
}

function variant(stage) {
  const pieces = [
    part('single folded mobile forge load deck',sp('corridor_wall'),[1.78, 2.20, .40],[0, .10, .46],'body',[0, 0, 0],'armor'),
    part('front full span drive axle cradle',sp('corridor_wall'),[1.82, .26, .24],[0, -.82, .29],'chassis',[0, 0, 0],'metal'),
    part('rear full span drive axle cradle',sp('corridor_wall'),[1.82, .26, .24],[0, .88, .29],'chassis',[0, 0, 0],'metal'),
    part('ribbed fixed induction die and load seat',sp('machine_generatorLarge'),[.78, .67, .35],[0, .08, .87],'body',[0, 0, 0],'native'),
    part('complete hexagonal pressure forging gantry',sp('gate_complex'),[1.64, .61, 1.57],[0, .08, .76],'body',[0, 0, 0],'ivory'),
    part('upper captured hydraulic screw guide',sp('machine_barrelLarge'),[.34, .34, .37],[0, .08, 1.95],'body',[0, 0, 0],'metal'),
    part('axial captured forging screw and plunger',sp('rocket_fuelA'),[.19, .19, .50],[0, .08, 1.55],'platen',[0, 0, 0],'gold'),
    part('continuous induction compression platen',sp('machine_barrelLarge'),[.52, .47, .17],[0, .08, 1.48],'platen',[0, 0, 0],'metal'),
    hinge(part('rear hinged continuous forge thermal hood',sp('hangar_roundA'),[1.08, .79, .64],[0, .17, 1.60],'hood',[0, 0, 0],'armor'), [0, .55, 1.60], 0, [0, -43, -76][stage]),
    part('low enclosed repair telemetry console with integral aerials',sp('machine_wireless'),[.41, .37, .25],[0, .77, .91],'telemetry',[0, 0, 0],'native'),
    part('recessed front compression and ally acquisition visor',sp('desk_computerScreen'),[.34, .14, .20],[0, -.72, .92],'body',[0, 0, 0],'glow'),
    part('protected horizontal blocker ram guide',sp('machine_barrel'),[.34, .34, .63],[0, -.46, .74],'body',[90, 0, 0],'metal'),
    part('captured horizontal blocker ram rod',sp('rocket_fuelA'),[.19, .19, .58],[0, -.66, .74],'ram',[90, 0, 0],'gold'),
    part('ribbed blocker clamp crosshead',sp('machine_generatorLarge'),[.72, .23, .29],[0, -1.12, .61],'ram',[0, 0, 0],'ivory'),
    handed(part('left complete hooked clamp jaw',sp('corridor_wallCorner'),[.235, .26, .43],[-.31, -1.08, .74],'jawL',[90, 0, 0],'metal'),-1),
    handed(part('right complete hooked clamp jaw',sp('corridor_wallCorner'),[.235, .26, .43],[.31, -1.08, .74],'jawR',[90, 0, 0],'metal'),1),
  ];
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R', x = side * .68;
    const fieldPivot = [x, .13, 1.06], fieldAngle = side * [0, 35, 55][stage];
    pieces.push(
      handed(part('enclosed longitudinal wheel and press load rail ' + tag,sp('corridor_wall'),[.25, 2.15, .25],[side * .76, .10, .25],'chassis',[0, 0, 0],'metal'),side),
      handed(part('enclosed repair field bearing load upright ' + tag,sp('corridor_wall'),[.28, .36, .34],[x, .13, .75],'body',[0, 0, 0],'metal'),side),
      handed(part('continuous fixed repair field fold trunnion ' + tag,sp('rocket_fuelB'),[.28, .28, .105],[x - side * .0525, .13, 1.06],'body',[0, side * 90, 0],'gold'),side),
      hinge(handed(part('enclosed repair field arm load case ' + tag,sp('corridor_wall'),[.21, .27, .63],[x, .13, 1.06],'field' + tag,[0, 0, 0],'metal'),side), fieldPivot, 1, fieldAngle),
      hinge(handed(part('captured repair field induction sleeve ' + tag,sp('rocket_sidesA'),[.255, .29, .33],[x, .13, 1.24],'field' + tag,[0, 0, 0],'ivory'),side), fieldPivot, 1, fieldAngle),
      hinge(handed(part('induction sleeve continuous upper collar ' + tag,sp('rocket_sidesA'),[.28, .31, .14],[x, .13, 1.53],'field' + tag,[0, 0, 0],'gold'),side), fieldPivot, 1, fieldAngle),
      hinge(handed(part('complete outboard facing concave repair field projector ' + tag,sp('satelliteDish_detailed'),[.49, .46, .40],[x, .13, 1.67],'field' + tag,[0, 0, side * 90],'native'),side), fieldPivot, 1, fieldAngle),
      handed(part('sealed rear cooling bearing saddle ' + tag,sp('rocket_fuelB'),[.23, .26, .10],[side * .61, .53, 1.58],'body',[90, 0, 0],'metal'),side),
      hinge(handed(part('unfolding rear enclosed induction heat cassette ' + tag,sp('machine_generator'),[.29, .36, .56],[side * .61, .48, 1.58],'cool' + tag,[0, 0, 0],'metal'),side), [side * .61, .48, 1.58], 1, side * [0, 16, 38][stage]),
    );
    for (const [end, y] of [['F', -.82], ['R', .88]]) {
      pieces.push(
        // Same +90 Y on both sides. Normalized bottom-centre becomes the axle
        // face; subtract half of the .20 depth from the actual pivot X.
        part('bevelled rounded traction tyre ' + tag + end,'refined/drive-wheel',[.76, .76, .20],[side * .97 - .10, y, .38],'wheel' + tag + end,[0, 90, 0],'native'),
      );
    }
    if (stage >= 1) {
      pieces.push(
        handed(part('exposed second stage repair compound accumulator ' + tag,sp('rocket_fuelB'),[.24, .30, .51],[side * .29, .44, 1.54],'body',[0, 0, 0],'glow'),side),
        handed(part('captured accumulator lower restraint ' + tag,sp('rocket_fuelB'),[.30, .33, .115],[side * .29, .44, 1.49],'body',[0, 0, 0],'metal'),side),
      );
    }
    if (stage >= 2) {
      const pivot = [side * .43, .79, 1.32];
      pieces.push(
        handed(part('rear auxiliary field arm fixed fold bearing ' + tag,sp('rocket_fuelB'),[.28, .24, .10],[side * (.43 - .05), .79, 1.32],'body',[0, side * 90, 0],'gold'),side),
        hinge(handed(part('deployed rear enclosed auxiliary field load arm ' + tag,sp('corridor_wall'),[.22, .25, .55],[side * .43, .79, 1.32],'rearField' + tag,[0, 0, 0],'metal'),side), pivot, 0, -51),
        hinge(handed(part('exposed rear auxiliary induction coil ' + tag,sp('rocket_fuelB'),[.23, .28, .30],[side * .43, .79, 1.58],'rearField' + tag,[0, 0, 0],'glow'),side), pivot, 0, -51),
        hinge(handed(part('deployed rear facing auxiliary repair field projector ' + tag,sp('satelliteDish'),[.43, .37, .36],[side * .43, .79, 1.84],'rearField' + tag,[0, 0, 180],'native'),side), pivot, 0, -51),
      );
    }
  }
  return pieces;
}

export default {
  id: 'memory_reforger', kind: 'enemies', role: 'boss', locomotion: 'crawler', rig,
  variants: { phase1: variant(0), phase2: variant(1), phase3: variant(2) },
  design: {
  polish: "单层折边底盘托住锻炉，原先藏在底盘中的成对传动小匣已收掉。修复臂使用连续承力壳，双钳采用有厚度的弧形接触面。侧臂、冷却匣和后辅助臂使用与转轴一致的完整轴承。",
  assemblySymmetry: "双钳、侧投射臂、冷却匣和第三阶段后投射臂全部使用真实 X 镜像。折臂源朝向与世界铰轴通过原矩阵组合，左右轴承原点与正负轴向对应。 静态结构左右对称。死亡时的异步落稳保持原动作。",
    name: '记忆重铸机',
    silhouette: "四轮移动锻炉以六边门架、中央压头和前双钳形成轮廓。",
    loadPath: "单层折边底盘托住锻炉，原先藏在底盘中的成对传动小匣已收掉。修复臂使用连续承力壳，双钳采用有厚度的弧形接触面。侧臂、冷却匣和后辅助臂使用与转轴一致的完整轴承。",
    joints: 'Four X wheel axles, sprung press deck, one Z captive compression platen, rear X hood hinge, one Y contact carriage and two Z contact jaw bearings. Two side Y field fold axes, two Y cooling cassettes, two final-stage X auxiliary field arms and protected rear telemetry bearings.',
    phase1: 'The tapering thermal hood closes over the upper press. Both radial repair projector pylons remain vertical and their induction sleeves sit inside the side gantry mounts. The front clamp, hexagonal working throat and compression die remain readable.',
    phase2: 'Below 70% HP the thermal hood opens 43 degrees about the actual rear mount. Both complete side projector assemblies unfold 35 degrees outward; rear heat cassettes open 16 degrees. Two exposed compound accumulators and their lower restraints occupy the opened forge shoulders.',
    phase3: 'Below 35% HP the hood parks at 76 degrees, the side repair field pylons spread 55 degrees and heat cassettes fan 38 degrees. Two additional rear field arms, coils and real concave projectors unfold 51 degrees toward the rear, physically increasing the active repair apparatus.',
    locomotion: 'All four real registered circular tyres use wheelRollAngle(travel,.38) and the measured wheelSupportHeight correction. Both side meshes have +90 Y source rotation and positions X=pivotX-depth/2. Travel remains authoritative while a heal warning and release continue movement; the load deck expresses spring compression independently of wheel contact.',
    attack: 'The horizontal carriage retracts inside its guide, accelerates the supported crosshead and complete hooked jaws into the blocker, closes the jaws on contact, takes reaction in the forge deck, then relieves and returns. Terrain and core contact use the same actual short-range clamp.',
    ability: 'During the actual 1.1 s heal warning the field arms focus, the hood relieves pressure, the captive platen draws upward and the heat extraction fingers open. The 420 ms release drives the platen onto the fixed induction die, expels one radial repair pulse through the projectors, then returns the captive screw and arm hinges. Healing stays an instantaneous simulation fact; no artificial lingering heal state is created.',
    gameplay: 'Ground repair boss, base HP 5200, speed .4, attack 58, armor 18, core damage 10. Every ability heals enemies including self at distance <6, for 7%/8.5%/10% recovery-base HP in phases 0/1/2. Boss recovery caps and difficulty interval multipliers remain in difficulty.js; base intervals are 6.5/5.7/4.9 s. Contact targets melee units at 2.15 cells, with a 1.4 s boss contact cooldown; the boss remains at the core and attacks every 2.7 s.',
    damage: 'Hits take up deck spring travel, unload the captive platen and deflect supported projector bearings. Death releases the plunger, stalls all wheel drives at their last measured contact pose, relaxes the clamp jaws and lowers the sprung deck while the captured hood and asymmetric field arms settle onto their physical hinges.',
    sourceGeometry: "底盘、护梁与整面接触板采用登记的 corridor_wall；捕获导筒使用 rocket_sidesA 或 rocket_fuelA/B；工作机匣、门架、凹面装置继续使用登记的 Kenney CC0 源。主轮为 refined/drive-wheel，接触带使用 64 段轮廓。",
    surfaces: "各阶段分别为 38、42、50 件。双钳、侧投射臂、冷却匣和第三阶段后投射臂全部使用真实 X 镜像。折臂源朝向与世界铰轴通过原矩阵组合，左右轴承原点与正负轴向对应。",
    sourceLicense: 'Registered Kenney Space Kit and Tower Defense Kit CC0 GLBs. Original sources and License.txt remain under development/assets/model_sources/kenney/space-kit and tower-defense-kit.',
  },
};
