import { part, joint, sp, td, handed } from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up; the horizontal pressure outlet faces -Y.
// One closed machined vault and one pressure spine share a six-wheel load bed.
const rig = [
  joint('chassis', [0, .03, .30]),
  joint('cabinet', [0, .03, .62], 'chassis'),
  joint('manifold', [0, -.69, 1.15], 'cabinet'),
  joint('injector', [0, -.68, 1.29], 'manifold'),
  joint('upperShutter', [0, -1.13, 1.53], 'manifold'),
  joint('lowerShutter', [0, -1.13, 1.04], 'manifold'),
  joint('pressureSpine', [0, .66, 1.73], 'cabinet'),
  joint('pressurePiston', [0, .66, 2.13], 'pressureSpine'),
  joint('sensor', [0, -.63, 1.63], 'cabinet'),
  joint('powerpack', [0, .90, .96], 'cabinet'),
  joint('contactRam', [0, -.73, .65], 'cabinet'),
];

for (const side of [-1, 1]) {
  const id = side < 0 ? 'L' : 'R';
  rig.push(
    joint('vent' + id, [side * .77, .25, 1.33], 'cabinet'),
    joint('valve' + id, [side * .43, -.23, 1.49], 'cabinet'),
  );
  for (const [end, y] of [['F', -.88], ['M', .03], ['R', .94]]) {
    rig.push(joint('wheel' + id + end, [side * .91, y, .30], 'chassis'));
  }
}

const base = [
  part('single folded six wheel distribution load deck',sp('corridor_wall'),[1.58, 2.28, .34],[0, .03, .40],'cabinet',[0, 0, 0],'armor'),
  part('front full span traction axle cradle',sp('corridor_wall'),[1.85, .18, .17],[0, -.88, .27],'chassis',[0, 0, 0],'metal'),
  part('middle full span traction axle cradle',sp('corridor_wall'),[1.85, .18, .17],[0, .03, .27],'chassis',[0, 0, 0],'metal'),
  part('rear full span traction axle cradle',sp('corridor_wall'),[1.85, .18, .17],[0, .94, .27],'chassis',[0, 0, 0],'metal'),
  part('complete octagonal pressure vault with bevelled domed roof',sp('hangar_roundB'),[1.48, 1.44, 1.06],[0, .15, .70],'cabinet',[0, 0, 0],'ivory'),
  part('outlet pedestal enclosed load bed',sp('corridor_wall'),[.94, .68, .16],[0, -.75, .76],'cabinet',[0, 0, 0],'metal'),
  part('complete horizontal faceted pressure pipe with integral pedestal',sp('pipe_ringHigh'),[.80, .82, .57],[0, -.78, .92],'manifold',[0, 0, 180],'armor'),
  part('upper folded edge pressure outlet shutter',sp('corridor_wall'),[.70, .105, .22],[0, -1.13, 1.31],'upperShutter',[0, 0, 0],'ivory'),
  part('lower folded edge pressure outlet shutter',sp('corridor_wall'),[.70, .105, .23],[0, -1.13, 1.04],'lowerShutter',[0, 0, 0],'ivory'),
  part('captured horizontal signal compression liner',sp('rocket_fuelB'),[.28, .28, .40],[0, -.62, 1.29],'injector',[90, 0, 0],'metal'),
  part('one directional signal discharge electrode',sp('rocket_topB'),[.23, .23, .15],[0, -.99, 1.29],'injector',[90, 0, 0],'glow'),
  part('protected routing and pressure status visor',sp('desk_computerScreen'),[.33, .18, .16],[0, -.63, 1.58],'sensor',[0, 0, 0],'glow'),
  part('rear pressure spine broad continuous mounting saddle',sp('corridor_wall'),[.79, .60, .12],[0, .66, 1.65],'cabinet',[0, 0, 0],'metal'),
  part('single ribbed vertical pressure spine fixed sleeve',sp('rocket_sidesA'),[.56, .56, .58],[0, .66, 1.74],'pressureSpine',[0, 0, 0],'armor'),
  part('pressure spine continuous seat and guide collar',sp('rocket_sidesA'),[.60, .60, .14],[0, .66, 1.73],'pressureSpine',[0, 0, 0],'gold'),
  part('captive vertical pressure piston inside the upper sleeve',sp('rocket_fuelB'),[.38, .38, .58],[0, .66, 1.91],'pressurePiston',[0, 0, 0],'metal'),
  part('shallow pressure cap attached to the guided piston',sp('rocket_topB'),[.52, .52, .16],[0, .66, 2.44],'pressurePiston',[0, 0, 0],'ivory'),
  part('ribbed rear converter with complete angled cooling bridge',sp('machine_generatorLarge'),[.99, .48, .53],[0, .94, .74],'powerpack',[0, 0, 180],'native'),
  part('low enclosed protocol transceiver with native short antennas',sp('machine_wireless'),[.50, .34, .22],[0, 1.02, 1.24],'powerpack',[0, 0, 0],'native'),
  part('fixed lower contact ram cylinder and guide sleeve',sp('machine_barrelLarge'),[.24, .24, .59],[0, -.30, .65],'cabinet',[90, 0, 0],'gold'),
  part('guided lower contact piston inside the ram cylinder',sp('rocket_fuelA'),[.14, .14, .66],[0, -.49, .65],'contactRam',[90, 0, 0],'metal'),
  part('single broad contact plate connected to the ram shaft',sp('corridor_wall'),[.68, .13, .26],[0, -1.14, .52],'contactRam',[0, 0, 0],'armor'),
];

for (const side of [-1, 1]) {
  const id = side < 0 ? 'L' : 'R';
  base.push(
    handed(part('continuous enclosed longitudinal load and axle rail ' + id,sp('corridor_wall'),[.22, 2.27, .20],[side * .68, .03, .28],'chassis',[0, 0, 0],'metal'),side),
    handed(part('folded flank skin bridging vault to load keel ' + id,sp('corridor_wallCorner'),[.14, 1.51, .34],[side * .70, .09, .67],'cabinet',[0, 0, side * 180],'armor'),side),
    handed(part('rear spine to vault enclosed load brace ' + id,sp('rocket_sidesA'),[.18, .22, .70],[side * .43, .66, 1.02],'cabinet',[0, -side * 12, 0],'metal'),side),
    handed(part('continuous axial side pressure distribution pipe ' + id,sp('rocket_fuelA'),[.13, .13, 1.09],[side * .43, .52, 1.48],'cabinet',[90, 0, 0],'metal'),side),
    handed(part('captured pressure feed valve and integral line collar ' + id,sp('rocket_baseB'),[.21, .21, .14],[side * .43, -.23, 1.43],'valve' + id,[0, 0, 0],'gold'),side),
    handed(part('hinged enclosed side heat exchanger cassette ' + id,sp('machine_generator'),[.22, .57, .58],[side * .77, .25, 1.04],'vent' + id,[0, 0, 0],'metal'),side),
    handed(part('upper and lower shutter enclosed hinge support ' + id,sp('rocket_sidesA'),[.15, .18, .52],[side * .38, -1.13, 1.025],'manifold',[0, 0, 0],'gold'),side),
  );
  for (const [end, y] of [['F', -.88], ['M', .03], ['R', .94]]) {
    // Actual round L0 rim, radius .30. Both sides use +90 around Y. The
    // bottom-centre source origin moves to the axle's inner X face.
    base.push(
      part('bevelled rounded traction tyre ' + id + end,'refined/drive-wheel',[.60, .60, .17],[side * .91 - .085, y, .30],'wheel' + id + end,[0, 90, 0],'native'),
    );
  }
}

export default {
  id: 'proliferation_protocol', kind: 'enemies', role: 'elite', locomotion: 'crawler',
  rig, variants: { base },
  design: {
  polish: "折边底盘直接承接轴桥与压力壳。前分发口使用上下整面快门，低位接触头采用连续承压板。两侧供压管沿 Y 轴布置，压盖限位饰件已收掉。",
  assemblySymmetry: "侧弧形护板按同一右侧基准反射，左右弧口和端部朝向对应。侧阀、冷却匣、快门铰座和后柱支撑同步使用真实 X 镜像。 左右装配保持对称。前分发口与后压力柱承担不同功能，前后外形按工作方向区分。",
    name: '增殖协议体',
    silhouette: "六轮压力分发车以穹顶壳、后压力柱和前分发口形成轮廓。",
    loadPath: "折边底盘直接承接轴桥与压力壳。前分发口使用上下整面快门，低位接触头采用连续承压板。两侧供压管沿 Y 轴布置，压盖限位饰件已收掉。",
    joints: 'Six independent X wheel axles; sprung vault mount; fixed-seat pressure manifold; upper/lower horizontal X shutter hinges; axial Y injector; rear sleeve load seat and guided vertical pressure piston; paired pressure valves and side heat exchangers; protected visor; converter and independent captive contact ram.',
    locomotion: 'Travel and speed are model coordinates. All six bevelled round tyres use wheelRollAngle(travel,.30) and the measured rim support height. The three axle cradles move together to preserve contact. Only the sprung cabinet compresses during work; casting keeps traction active whenever the battle reports moving.',
    attack: 'A distinct protected lower ram retracts its contact shoe, accelerates through one forward stroke, remains briefly compressed on contact and withdraws into its sleeve. The cabinet absorbs recoil while the wheel contacts and the distribution outlet retain support.',
    ability: 'The actual 1.1 s summon warning opens the opposed horizontal shutters, seats both feed valves and draws the vertical pressure piston into its fixed sleeve. The release begins at the completed warning pose; one pressure release drives the horizontal injector through the open mouth, unloads the piston, opens the heat exchangers and returns all mechanisms. Instantaneous summon has no invented persistent field, production counter, extra reinforcement or miniature enemy.',
    gameplay: 'Ground elite: hp880, speed.78, attack31, armor10, pressure30, core damage22. It has ordinary contact attacks, barrier contact and persistent core attacks. Summon attempts one reinforcement at the parent position; modern revision4+ picks static_drifter, memory_runner or ordered_sentinel by act. All summons share the encounter budget and the 100-active cap. There are no boss phases for this elite.',
    damage: 'A hit unloads the sprung cabinet, captive piston, visor and heat exchanger hinges. In the 650 ms death presentation the injector withdraws, the opposed shutters unlock unequally, pressure piston drops into its sleeve, pressure spine folds at the supported saddle and the cabinet settles on its rails. Wheels retain their last travel-driven contact phase.',
    sourceGeometry: "底盘、护梁与整面接触板采用登记的 corridor_wall；捕获导筒使用 rocket_sidesA 或 rocket_fuelA/B；工作机匣、门架、凹面装置继续使用登记的 Kenney CC0 源。主轮为 refined/drive-wheel，接触带使用 64 段轮廓。",
    detailPolicy: "42 件。部件承担承重、外壳、轴承、传感或工作机构职责，原有主轮安装保持原值。",
    sourceLicense: 'Kenney Space Kit and Tower Defense Kit CC0. Registered runtime GLBs are reused; original meshes and License.txt remain under development/assets/model_sources/kenney.',
  },
};
