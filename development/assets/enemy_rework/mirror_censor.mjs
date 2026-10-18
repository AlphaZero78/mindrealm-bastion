import { part, joint, sp, td, handed } from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up. A tall split mirror vault rides on four real axles.
// The square concave scanners retain the complete licensed bowl and pedestal.
const rig = [
  joint('chassis', [0, .08, .38]),
  joint('vault', [0, .08, .72], 'chassis'),
  joint('cache', [0, .21, 1.48], 'vault'),
  joint('platen', [0, -.18, .86], 'vault'),
  joint('stamp', [0, -.59, .65], 'vault'),
  joint('visor', [0, -.29, 2.46], 'vault'),
  joint('crown', [0, .26, 2.30], 'vault'),
  joint('telemetry', [0, .75, 1.05], 'vault'),
];

for (const side of [-1, 1]) {
  const tag = side < 0 ? 'L' : 'R';
  rig.push(
    joint('wheel' + tag + 'F', [side * 1.04, -.76, .38], 'chassis'),
    joint('wheel' + tag + 'R', [side * 1.04, .88, .38], 'chassis'),
    joint('mirror' + tag, [side * .99, -.50, 1.63], 'vault'),
    joint('slice' + tag, [side * .51, -.72, 1.24], 'mirror' + tag),
    joint('vent' + tag, [side * .81, .67, 1.49], 'vault'),
    joint('shield' + tag, [side * .77, .31, 1.80], 'vault'),
    joint('crownMirror' + tag, [side * .56, .27, 2.72], 'crown'),
  );
}

function swing(piece, pivot, degrees) {
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const [x, y] = [piece.position[0] - pivot[0], piece.position[1] - pivot[1]];
  piece.position[0] = pivot[0] + x * c - y * s;
  piece.position[1] = pivot[1] + x * s + y * c;
  piece.rotation[2] += degrees;
  return piece;
}

function variant(stage) {
  const parts = [
    part('single folded audit carriage and armoured load deck',sp('corridor_wall'),[1.94, 2.17, .36],[0, .08, .48],'vault',[0, 0, 0],'armor'),
    part('full span front differential cradle with integral feet',sp('corridor_wall'),[1.98, .25, .24],[0, -.76, .34],'chassis',[0, 0, 0],'metal'),
    part('full span rear differential cradle with integral feet',sp('corridor_wall'),[1.98, .25, .24],[0, .88, .34],'chassis',[0, 0, 0],'metal'),
    part('ribbed rear wheel transmission and traction converter',sp('machine_generatorLarge'),[.98, .43, .32],[0, .75, .39],'chassis',[0, 0, 0],'native'),
    part('complete bevelled hexagonal front audit portal and base',sp('gate_complex'),[1.83, .46, 1.87],[0, -.16, .69],'vault',[0, 0, 0],'metal'),
    part('complete rear portal tying the scanner vault to the keel',sp('gate_simple'),[1.43, .34, 1.54],[0, .43, .75],'vault',[0, 0, 0],'metal'),
    part('single open ribbed copy cache behind the mirror slit',sp('rocket_sidesA'),[.70, .64, 1.21],[0, .21, .93],'cache',[0, 0, 0],'ivory'),
    part('complete tapering audit cache cap and crown saddle',sp('rocket_topB'),[.72, .66, .25],[0, .21, 2.10],'crown',[0, 0, 0],'gold'),
    part('bevelled single twin imprint transfer platen',sp('corridor_wall'),[1.13, 1.15, .16],[0, -.18, .86],'platen',[0, 0, 0],'gold'),
    part('fixed captured transfer bed and guide frame',sp('corridor_wall'),[1.23, 1.29, .17],[0, -.12, .70],'vault',[0, 0, 0],'metal'),
    part('protected low audit stamp hydraulic sleeve',sp('machine_barrelLarge'),[.30, .30, .62],[0, -.18, .65],'vault',[90, 0, 0],'native'),
    part('captured near contact stamp shaft inside the sleeve',sp('rocket_fuelA'),[.14, .14, .58],[0, -.59, .65],'stamp',[90, 0, 0],'metal'),
    part('continuous stepped cancellation stamp contact plate',sp('corridor_wall'),[.86, .14, .32],[0, -1.07, .49],'stamp',[0, 0, 0],'armor'),
    part('protected central acquisition and review status visor',sp('desk_computerScreen'),[.33, .18, .20],[0, -.29, 2.38],'visor',[0, 0, 0],'glow'),
    part('low shield echo reference enclosure and real antennas',sp('machine_wireless'),[.48, .35, .25],[0, .75, .93],'telemetry',[0, 0, 0],'native'),
    part('rear ribbed copy power cabinet with integral mounting base',sp('machine_generator'),[.81, .36, .60],[0, .68, 1.14],'vault',[0, 0, 0],'native'),
    part('captured twin imprint selector inside the copy cache',sp('rocket_baseB'),[.48, .45, .18],[0, .21, 1.13],'cache',[0, 0, 0],'metal'),
  ];

  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R', hinge = [side * .99, -.50, 1.63];
    const angle = side * [0, 46, 76][stage];
    const leaf = piece => swing(piece, hinge, angle);
    parts.push(
      handed(part('continuous enclosed axle and tall vault load rail ' + tag,sp('corridor_wall'),[.25, 2.13, .27],[side * .83, .08, .30],'chassis',[0, 0, 0],'metal'),side),
      handed(part('enclosed mirror hinge upright bolted to the portal base ' + tag,sp('corridor_wall'),[.25, .39, 1.11],[side * .92, -.31, .65],'vault',[0, 0, 0],'metal'),side),
      handed(part('fixed continuous vertical mirror hinge bearing ' + tag,sp('rocket_fuelB'),[.22, .22, .10],[side * .99, -.50, 1.58],'vault',[0, 0, 0],'gold',true),side),
      leaf(handed(part('complete square concave audit mirror and integral pedestal ' + tag,sp('satelliteDish_detailed'),[.87, .32, 1.48],[side * .51, -.50, 1.01],'mirror' + tag,[0, 0, 0],'ivory'),side)),
      leaf(handed(part('continuous curved outer mirror leaf back skin ' + tag,sp('corridor_wallCorner'),[.12, .29, 1.17],[side * .90, -.45, 1.19],'mirror' + tag,[0, 0, side * 180],'armor'),side)),
      leaf(handed(part('captured mirror pedestal load saddle and latch ' + tag,sp('corridor_wall'),[.42, .25, .12],[side * .51, -.50, .98],'mirror' + tag,[0, 0, 0],'metal'),side)),
      leaf(handed(part('ribbed vertical review slice carriage ' + tag,sp('machine_generator'),[.27, .17, .25],[side * .51, -.72, 1.24],'slice' + tag,[0, 0, 0],'gold'),side)),
      leaf(handed(part('fixed mirror slice guide with enclosed side rails ' + tag,sp('corridor_wall'),[.18, .12, .83],[side * .51, -.64, 1.18],'mirror' + tag,[0, 0, 0],'metal'),side)),
      leaf(handed(part('inset review slice optical face ' + tag,sp('desk_computerScreen'),[.20, .07, .17],[side * .51, -.82, 1.29],'slice' + tag,[0, 0, 0],'glow'),side)),
      leaf(handed(part('captured duplicate imprint outlet electrode ' + tag,sp('rocket_topB'),[.23, .18, .15],[side * .51, -.72, 1.10],'mirror' + tag,[90, 0, 0],'gold'),side)),
      handed(part('hinged enclosed rear copy heat exchanger ' + tag,sp('machine_generator'),[.22, .30, .48],[side * .81, .67, 1.255],'vent' + tag,[0, 0, 0],'metal'),side),
      handed(part('enclosed power cabinet to mirror load and coolant tie ' + tag,sp('corridor_wall'),[.18, .22, .62],[side * .78, .15, 1.02],'vault',[90, 0, 0],'gold'),side),
    );

    for (const [suffix, y] of [['F', -.76], ['R', .88]]) {
      // Both radial profiles use +90 Y. Bottom-centre source origin shifts
      // half the axle depth so the X axle passes through the tyre centre.
      parts.push(
        part('bevelled rounded round traction tyre ' + tag + suffix,'refined/drive-wheel',[.76, .76, .20],[side * 1.04 - .10, y, .38],'wheel' + tag + suffix,[0, 90, 0],'native'),
      );
    }

    if (stage >= 1) {
      parts.push(
        handed(part('enclosed shield projector carrier ' + tag,sp('corridor_wall'),[.28, .38, .62],[side * .77, .31, 1.22],'vault',[0, 0, 0],'metal'),side),
        handed(part('unfolded complete concave self shield projector ' + tag,sp('satelliteDish_large'),[.57, .37, .59],[side * .77, .31, 1.64],'shield' + tag,[0, side * (stage === 1 ? 22 : 35), 0],'native'),side),
        handed(part('exposed self shield converter and isolated mounting feet ' + tag,sp('machine_generatorLarge'),[.31, .30, .35],[side * .72, .43, 1.29],'shield' + tag,[0, 0, 0],'gold'),side),
      );
    }

    if (stage === 2) {
      parts.push(
        handed(part('raised enclosed auxiliary review mirror mast ' + tag,sp('corridor_wall'),[.31, .36, .73],[side * .56, .27, 2.15],'crown',[0, 0, 0],'metal'),side),
        handed(part('complete raised auxiliary concave review mirror ' + tag,sp('satelliteDish_detailed'),[.68, .29, .68],[side * .56, .27, 2.66],'crownMirror' + tag,[0, 0, side * 16],'ivory'),side),
        handed(part('auxiliary mirror mast captive continuous pivot collar ' + tag,sp('rocket_fuelB'),[.22, .21, .12],[side * .56, .27, 2.61],'crownMirror' + tag,[0, 0, 0],'gold'),side),
        handed(part('fully unfolded enclosed copy cache cooling spine ' + tag,sp('machine_generator'),[.24, .34, .70],[side * .83, .67, 1.69],'vent' + tag,[0, side * 21, 0],'metal'),side),
      );
    }
  }

  return parts;
}

export default {
  id: 'mirror_censor', kind: 'enemies', role: 'boss', locomotion: 'crawler',
  rig, variants: { phase1: variant(0), phase2: variant(1), phase3: variant(2) },
  design: {
  polish: "折边底盘承担门户载荷，底盘侧叠片已收掉。镜门有整面托座、连续导轨和完整竖向铰柱，镜冠桅架与护盾支座分层连接。",
  assemblySymmetry: "镜门凹面、外侧弧形背板、扫描滑座、后冷却机匣和高位镜冠均采用真实 X 镜像。镜门及弧片的左右朝向使用相同右侧基准反射。 静态结构左右对称。双扫描头的工作顺序与死亡时的分别卸载保留。",
    name: '镜像审查官',
    silhouette: "四轮高门架审查机由双凹面镜门、中央复制缓存和低位印章组成。",
    loadPath: "折边底盘承担门户载荷，底盘侧叠片已收掉。镜门有整面托座、连续导轨和完整竖向铰柱，镜冠桅架与护盾支座分层连接。",
    joints: 'Four X wheel axles, isolated vault load mount, two vertical mirror leaf hinges, captive vertical slice carriages carried by those leaves, Y transfer platen and low captured stamp, central copy cache, top cache cap, rear louvres, shield carrier bearings and two crown mirror pivots.',
    locomotion: 'Measured circular tyre contact profile supplies wheelRollAngle and wheelSupportHeight correction to the axle chassis. Vault springs absorb actual contact transitions. Wheel travel continues independently while a real moving copy warning or release animates the upper mechanisms.',
    attack: 'The cancellation stamp retracts .11, accelerates to a -.29 model-unit forward contact stroke, briefly holds contact and returns into its protected sleeve. The transfer bed and mirror-bearing load mount absorb recoil. The same contact assembly attacks near melee blockers, terrain barriers and the core; combat damage remains in battle.js.',
    ability: 'copy selects a non-reinforcement normal enemy within 6 cells and falls back to shield_echo. One warning aligns the opposed mirror leaves, drives both captive slice carriages up the scanned field and seats the twin imprint selector. At release both slice heads return through their fields while the single wide platen makes two short indexed output strokes, matching the two-copy maximum. The common reinforcement budget remains authoritative in battle.js.',
    phase1: 'At phase 0 the full-height square mirror leaves guard a narrow central slit, covering the cache inside one tall hexagonal portal. Forty-five complete structural parts keep the carriage visibly distinct from the small horizontal replication_node and the low six-wheel noise_hive.',
    phase2: 'Below 70% HP both full mirror leaves permanently open 46 degrees at their real vertical outer hinges. Six added pieces expose two braced concave shield projectors and converters. shieldFraction controls the protective hold; copy has no timed abilityActive field of its own. Gameplay refills self shield to 2.5% recovery base on each copy.',
    phase3: 'Below 35% HP the leaves permanently open 76 degrees. Eight added pieces raise a second pair of complete concave review mirrors on braced masts above the portal, with extended heat spines. The shorter real copy cycle drives the enlarged vertical scanning and indexed outfeed machinery; structural changes come from deployment and added devices.',
    damage: 'Hit energy deflects the isolated vault, captured stamp and slice bearings. During the actual death interval the leaf latches release, both slice carriages brake downward, the copy cache settles, crown and shield bearings fold and rear cooling louvres open. Wheel axles retain their last supported contact phase. Root has no clock-driven sway.',
    sourceGeometry: "底盘、护梁与整面接触板采用登记的 corridor_wall；捕获导筒使用 rocket_sidesA 或 rocket_fuelA/B；工作机匣、门架、凹面装置继续使用登记的 Kenney CC0 源。主轮为 refined/drive-wheel，接触带使用 64 段轮廓。",
    surfaces: "各阶段分别为 45、51、59 件。镜门凹面、外侧弧形背板、扫描滑座、后冷却机匣和高位镜冠均采用真实 X 镜像。镜门及弧片的左右朝向使用相同右侧基准反射。",
    sourceLicense: 'Kenney Space Kit 2.0 and Tower Defense Kit 2.1 CC0. Registered runtime GLBs are reused. Original files and License.txt stay in development/assets/model_sources/kenney/space-kit and tower-defense-kit.',
  },
};
