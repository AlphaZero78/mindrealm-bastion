import { part, joint, sp, td, handed } from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up. The two forward breeding throats share one closed
// pressure body; a six-wheel cradle carries its lid, pumps and broadcast arms.
const rig = [
  joint('chassis', [0, .10, .32]),
  joint('body', [0, .10, .72], 'chassis'),
  joint('reactor', [0, .23, 1.37], 'body'),
  joint('roof', [0, .77, 1.76], 'body'),
  joint('ram', [0, -.52, .62], 'body'),
  joint('telemetry', [0, .77, 1.05], 'body'),
];

for (const side of [-1, 1]) {
  const tag = side < 0 ? 'L' : 'R';
  for (const [end, y] of [['F', -.76], ['M', .10], ['R', .88]]) {
    rig.push(joint('wheel' + tag + end, [side * .96, y, .32], 'chassis'));
  }
  rig.push(
    joint('throat' + tag, [side * .44, -.34, 1.22], 'body'),
    joint('plunger' + tag, [side * .44, -.36, 1.22], 'throat' + tag),
    joint('door' + tag, [side * .79, -.95, 1.22], 'throat' + tag),
    joint('pump' + tag, [side * .66, .53, 1.25], 'body'),
    joint('vent' + tag, [side * .72, .61, 1.56], 'body'),
    joint('broadcast' + tag, [side * .69, .43, 1.55], 'body'),
    joint('sensor' + tag, [side * .44, -.90, 1.68], 'body'),
  );
}

// Permanent phase deployment is baked about the same physical hinges used by
// animation. Source meshes retain their complete processed shell geometry.
function hinge(piece, pivot, axis, degrees) {
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const d = piece.position.map((v, i) => v - pivot[i]);
  const rotated = axis === 0 ? [d[0], d[1] * c - d[2] * s, d[1] * s + d[2] * c]
    : [d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c];
  piece.position = rotated.map((v, i) => v + pivot[i]);
  piece.rotation[axis] += degrees;
  return piece;
}

function variant(stage) {
  const lift = [0, .15, .34][stage];
  const parts = [
    part('single folded heavy brood load deck',sp('corridor_wall'),[1.88, 2.08, .38],[0, .10, .44],'body',[0, 0, 0],'armor'),
    part('full span front traction axle cradle',sp('corridor_wall'),[1.86, .22, .20],[0, -.76, .29],'chassis',[0, 0, 0],'metal'),
    part('full span middle traction axle cradle',sp('corridor_wall'),[1.86, .22, .20],[0, .10, .29],'chassis',[0, 0, 0],'metal'),
    part('full span rear traction axle cradle',sp('corridor_wall'),[1.86, .22, .20],[0, .88, .29],'chassis',[0, 0, 0],'metal'),
    part('ribbed rear traction differential and load converter',sp('machine_generatorLarge'),[1.03, .48, .36],[0, .63, .32],'chassis',[0, 0, 0],'native'),
    part('single continuous faceted colony pressure shell',sp('rocket_sidesA'),[1.62, 1.44, 1.00],[0, .13, .77],'body',[0, 0, 0],'ivory'),
    part('captured ribbed brood compression reactor',sp('machine_generator'),[.82, .80, .60],[0, .23, 1.04 + lift],'reactor',[0, 0, 0],'native'),
    hinge(part('complete tapering colony pressure lid',sp('rocket_topA'),[1.64, 1.47, .35],[0, .13, 1.74],'roof',[0, 0, 0],'armor'), [0, .77, 1.76], 0, [0, -38, -68][stage]),
    part('protected lower near combat hydraulic sleeve',sp('machine_barrel'),[.29, .29, .60],[0, -.20, .62],'body',[90, 0, 0],'gold'),
    part('captured axial near combat piston',sp('rocket_fuelA'),[.17, .17, .60],[0, -.52, .62],'ram',[90, 0, 0],'metal'),
    part('continuous shouldered low blocker contact shoe',sp('corridor_wall'),[.77, .30, .20],[0, -1.04, .50],'ram',[0, 0, 0],'armor'),
    part('low protected brood telemetry enclosure and antennas',sp('machine_wireless'),[.42, .36, .23],[0, .77, .96],'telemetry',[0, 0, 0],'native'),
  ];

  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    parts.push(
      handed(part('continuous enclosed traction and pressure load rail ' + tag,sp('corridor_wall'),[.24, 2.03, .23],[side * .77, .10, .26],'chassis',[0, 0, 0],'metal'),side),
      handed(part('continuous ribbed forward breeding throat ' + tag,sp('rocket_sidesA'),[.66, .62, .78],[side * .44, -.14, 1.22],'throat' + tag,[90, 0, 0],'ivory'),side),
      handed(part('continuous open breeding outlet guard collar ' + tag,sp('rocket_sidesA'),[.76, .69, .13],[side * .44, -.86, 1.22],'throat' + tag,[90, 0, 0],'metal'),side),
      handed(part('curved outboard hinged breeding outlet shutter ' + tag,sp('corridor_wallCorner'),[.58, .08, .49],[side * .44, -.95, .975],'door' + tag,[0, 0, side * 180],'ivory'),side),
      handed(part('captured hollow pressure plunger inside the breeding throat ' + tag,sp('rocket_fuelB'),[.52, .48, .30],[side * .44, -.36, 1.22],'plunger' + tag,[90, 0, 0],'metal'),side),
      handed(part('forward induction electrode on the captured plunger ' + tag,sp('rocket_topB'),[.28, .26, .14],[side * .44, -.70, 1.22],'plunger' + tag,[90, 0, 0],'glow'),side),
      handed(part('ribbed brood pressure pump and integral support feet ' + tag,sp('machine_barrelLarge'),[.23, .32, .50],[side * .66, .53, 1.01],'pump' + tag,[0, 0, 0],'native'),side),
      handed(part('pressure throat to pump enclosed load tie ' + tag,sp('corridor_wall'),[.18, .18, .38],[side * .66, .38, 1.18],'body',[90, 0, 0],'gold'),side),
      handed(part('recessed outlet status and blocker acquisition visor ' + tag,sp('desk_computerScreen'),[.20, .10, .13],[side * .44, -.90, 1.615],'sensor' + tag,[0, 0, 0],'glow'),side),
      handed(part('hinged rear enclosed pressure cooling cassette ' + tag,sp('machine_generator'),[.22, .26, .48],[side * .72, .61, 1.32],'vent' + tag,[0, 0, 0],'metal'),side),
      handed(part('rear pressure lid hinge enclosed load upright ' + tag,sp('corridor_wall'),[.19, .22, .63],[side * .59, .58, .87],'body',[0, 0, 0],'metal'),side),
      handed(part('fixed axial pressure lid hinge bearing ' + tag,sp('rocket_fuelB'),[.16, .16, .07],[side * (.28 - .035), .77, 1.76],'body',[0, side * 90, 0],'gold',true),side),
      handed(part('captured broadcast arm saddle and fold bearing ' + tag,sp('rocket_fuelB'),[.29, .23, .14],[side * .69, .43, 1.48],'body',[0, 0, 0],'metal'),side),
      hinge(handed(part('complete concave brood pacing broadcaster ' + tag,sp('satelliteDish_large'),[.62, .52, .64],[side * .83, .43, 1.55],'broadcast' + tag,[0, 0, 0],'native'),side), [side * .69, .43, 1.55], 1, side * [78, 0, -18][stage]),
    );
    for (const [end, y] of [['F', -.76], ['M', .10], ['R', .88]]) {
      // Both sides use +90 Y. The bottom-centre source origin becomes the
      // axle inner face: position X equals pivot X minus half the depth.
      parts.push(
        part('bevelled rounded round traction tyre ' + tag + end,'refined/drive-wheel',[.64, .64, .18],[side * .96 - .09, y, .32],'wheel' + tag + end,[0, 90, 0],'native'),
      );
    }
    if (stage >= 1) {
      parts.push(
        handed(part('enclosed upper brood pacing arm support ' + tag,sp('corridor_wall'),[.20, .23, .31],[side * .69, .43, 1.27],'body',[0, 0, 0],'metal'),side),
        handed(part('deployed continuous broadcast arm load and cooling cuff ' + tag,sp('rocket_sidesA'),[.25, .29, .43],[side * .90, .47, 1.29],'broadcast' + tag,[0, side * 12, 0],'gold'),side),
      );
    }
    if (stage >= 2) {
      parts.push(
        handed(part('exposed auxiliary brood pressure accumulator ' + tag,sp('rocket_fuelB'),[.31, .30, .65],[side * .55, .34, 1.62],'pump' + tag,[0, side * 17, 0],'native'),side),
        handed(part('unfolded auxiliary enclosed pressure heat spine ' + tag,sp('machine_generator'),[.24, .34, .67],[side * .74, .59, 1.59],'vent' + tag,[0, side * 24, 0],'metal'),side),
      );
    }
  }
  return parts;
}

export default {
  id: 'noise_hive', kind: 'enemies', role: 'boss', locomotion: 'crawler', rig,
  variants: { phase1: variant(0), phase2: variant(1), phase3: variant(2) },
  design: {
  polish: "单层折边底盘连接三根轴桥，压力壳直接落在承重面上。底盘侧面重复护片已收掉。双出口保留曲面门与连续护环，低位接触掌改为整面构件，盖铰采用沿 X 轴的完整轴承。",
  assemblySymmetry: "两扇育腔门使用真实 X 镜像，弧形开口和铰侧对应。广播器、泵、冷却机匣、支柱与辅助蓄能器在各阶段都按相同反射关系展开。 静态装配左右对称。双育腔的释放错拍及死亡卸载时序继续使用原动作。",
    name: '噪声母巢',
    silhouette: "六轮育腔车具有连续压力壳、双前向育腔和可向后开启的整盖。",
    loadPath: "单层折边底盘连接三根轴桥，压力壳直接落在承重面上。底盘侧面重复护片已收掉。双出口保留曲面门与连续护环，低位接触掌改为整面构件，盖铰采用沿 X 轴的完整轴承。",
    joints: 'Six independent X traction axles; isolated pressure body; captive vertical reactor; rear X lid hinge; two Y discharge plungers and outer Z shutter hinges; two mounted pressure pumps, concave broadcast arms, rear cooling louvres and protected visors; one lower Y near-combat piston.',
    phase1: 'The pressure lid seats on the drum rim. Both complete broadcast dishes fold 78 degrees into the shoulders. The two breeding outlets, lower contact shoe and six-wheel support remain visible.',
    phase2: 'Below 70% HP the complete lid opens 38 degrees at its rear hinge. The reactor lifts .15 model units, both pacing dishes stand upright, and their exposed slotted cuffs and load posts support the 3 s allied haste interval.',
    phase3: 'Below 35% HP the lid parks at 68 degrees. The reactor lifts .34 units. Both pacing dishes tilt inward, and paired auxiliary pressure accumulators and vent spines physically unfold above the rear body. The same two breeding throats perform the shorter 4.9 s cycle.',
    locomotion: 'wheelRollAngle integrates the measured circular rim against model travel at .32 radius, including while casting. The same rim supplies the axle support height; the pressure body takes only a small independent spring compression. Actual haste affects posture while simulation travel remains the drive authority.',
    attack: 'The captive lower piston retracts the broad contact shoe, accelerates it into one contact stroke, holds the compression slice and returns. The upper pressure body absorbs the reaction; wheel contacts stay planted. Terrain contact and core breach share this real short-range tool.',
    ability: 'Actual summon: a 1.1 s warning aligns the broadcasters, swings the curved outlet shutters outward, draws both pressure plungers into their sleeves and loads the reactor. Release sends two short, slightly staggered discharge strokes through the paired mouths, relieves the pumps and closes the shutters. From phase 2 the deployed broadcasters remain engaged for the actual haste duration, then return to their parked gimbals.',
    gameplay: 'Ground boss, air=false. Each summon attempts two act-specific frontline reinforcements at the parent position; shared encounter budget and 100-active-enemy limit stay in battle.js. From phase 2 each ability grants enemies within 6 cells, including the boss, 20% haste for 3 s. Base cycles are 6.5/5.7/4.9 s, with difficulty multipliers supplied by the rules.',
    damage: 'A hit compresses the sprung pressure body, knocks the captive plungers and eases the broadcast bearings. Over the actual 650 ms death pose, pressure drains, the shutters unlatch, the reactor sinks and the lid and broadcast arms settle asymmetrically onto their captured mounts.',
    sourceGeometry: "底盘、护梁与整面接触板采用登记的 corridor_wall；捕获导筒使用 rocket_sidesA 或 rocket_fuelA/B；工作机匣、门架、凹面装置继续使用登记的 Kenney CC0 源。主轮为 refined/drive-wheel，接触带使用 64 段轮廓。",
    surfaces: "各阶段分别为 46、50、54 件。两扇育腔门使用真实 X 镜像，弧形开口和铰侧对应。广播器、泵、冷却机匣、支柱与辅助蓄能器在各阶段都按相同反射关系展开。",
    sourceLicense: 'Registered Kenney Space Kit and Tower Defense Kit CC0 GLBs. Original meshes and License.txt remain in development/assets/model_sources/kenney/space-kit and tower-defense-kit.',
  },
};
