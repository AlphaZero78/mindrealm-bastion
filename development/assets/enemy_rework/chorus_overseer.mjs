import { part, joint, sp, handed } from '../../web-tools/enemy-model-authoring.mjs';

// The continuous racer shell carries a triangular lift keel and three separate
// chorus channels. Stage poses are baked about measured, fixed hinge centres.
const swing = (v, pivot, degrees) => {
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const x = v[0] - pivot[0], y = v[1] - pivot[1];
  return [pivot[0] + x * c - y * s, pivot[1] + x * s + y * c, v[2]];
};
const deployed = (piece, pivot, degrees) => {
  piece.position = swing(piece.position, pivot, degrees);
  piece.rotation[2] += degrees;
  return piece;
};
const bankAngle = stage => [0, 39, 67][stage];
const crownRise = stage => [0, .10, .36][stage];
const crownTilt = stage => [52, 28, 0][stage];

const rig = [
  joint('chassis', [0, .12, .68]),
  joint('harmonicCore', [0, .14, 1.16], 'chassis'),
  joint('coreCoupler', [0, .14, 1.36], 'harmonicCore'),
  joint('noseRam', [0, -.63, .67], 'chassis'),
  joint('noseTip', [0, -.98, .67], 'noseRam'),
  joint('cantorF', [0, -.59, 1.10], 'chassis'),
  joint('feedF', [0, -.42, 1.43], 'cantorF'),
  joint('ventF', [0, -.28, 1.17], 'chassis'),
  joint('relayLift', [0, .82, 1.35], 'chassis'),
  joint('jammerRotor', [0, .73, 1.29], 'chassis'),
  joint('rudder', [0, 1.01, .90], 'chassis'),
];
for (const side of [-1, 1]) {
  const tag = side < 0 ? 'L' : 'R', hinge = [side * .58, .43, 1.04];
  rig.push(joint('channel' + tag, hinge, 'chassis'));
  rig.push(joint('shroud' + tag, [side * .26, .72, 1.36], 'chassis'));
  for (let stage = 0; stage < 3; stage++) {
    const a = side * bankAngle(stage);
    rig.push(
      joint('cantor' + tag + stage, swing([side * .62, -.01, 1.10], hinge, a), 'channel' + tag),
      joint('feed' + tag + stage, swing([side * .62, .10, 1.41], hinge, a), 'cantor' + tag + stage),
      joint('vent' + tag + stage, swing([side * .58, .33, 1.18], hinge, a), 'channel' + tag),
    );
  }
}
for (let stage = 0; stage < 3; stage++)
  rig.push(joint('relayHead' + stage, [0, .82, 1.46 + crownRise(stage)], 'relayLift'));
for (const [id, x, y] of [['F', 0, -.56], ['L', -.53, .61], ['R', .53, .61]])
  rig.push(joint('nozzle' + id, [x, y, .45], 'chassis'));

function variant(stage) {
  const rise = crownRise(stage), parts = [
    part('整片折面飞行声脊与两侧一体肩甲',sp('craft_racer'),[1.60, 2.12, .56],[0, .12, .44],'chassis',[0, 0, 180],'armor'),
    part('连接三点升力承座的单层机腹承板',sp('corridor_wall'),[1.18, 1.42, .14],[0, .13, .38],'chassis',[0, 0, 0],'metal'),
    part('中央声脊压入式楔形承力鞍',sp('machine_generatorLarge'),[.67, .57, .35],[0, .15, .92],'chassis',[0, 0, 0],'native'),
    part('具有背部回路的完整合唱换能机箱',sp('machine_generator'),[.47, .49, .55],[0, .14, 1.16],'harmonicCore',[0, 0, 0],'ivory'),
    part('机箱上缘捕获式多声道耦合导筒',sp('rocket_sidesA'),[.26, .26, .35],[0, .14, 1.40],'harmonicCore',[0, 0, 0],'metal'),
    part('耦合导筒内可压缩的实心相位芯',sp('rocket_fuelA'),[.12, .12, .41],[0, .14, 1.36],'coreCoupler',[0, 0, 0],'gold'),
    part('顶部相位芯的浅顶捕获盖',sp('rocket_topB'),[.30, .30, .11],[0, .14, 1.69],'coreCoupler',[0, 0, 0],'gold'),
    part('前向合唱状态的低位折边窗口',sp('desk_computerScreen'),[.26, .13, .16],[0, -.08, 1.16],'harmonicCore',[0, 0, 0],'glow'),
    part('中央前声道的四耳横梁根座',sp('rocket_baseA'),[.27, .29, .14],[0, -.50, .96],'chassis',[0, 0, 0],'metal'),
    part('前声道底座与机箱之间的封闭承力桥',sp('corridor_wall'),[.40, .48, .18],[0, -.39, .97],'chassis',[0, 0, 0],'metal'),
    part('具有完整碟壁和馈源的前向主声道',sp('satelliteDish_large'),[.70, .43, .68],[0, -.59, 1.10],'cantorF',[0, 0, 0],'ivory'),
    part('前主声道捕获式馈源导套',sp('rocket_sidesA'),[.17, .17, .28],[0, -.36, 1.43],'cantorF',[90, 0, 0],'metal'),
    part('留在主声道导套内的发射工作芯',sp('rocket_fuelA'),[.10, .10, .33],[0, -.36, 1.43],'feedF',[90, 0, 0],'gold'),
    part('主声道馈源封边脉冲耦合口',sp('rocket_fuelB'),[.14, .14, .065],[0, -.67, 1.43],'feedF',[90, 0, 0],'accent'),
    part('主声道后部独立回波散热匣',sp('machine_generator'),[.24, .26, .23],[0, -.28, 1.17],'ventF',[0, 0, 0],'metal'),
    part('前鼻接触器的连续导座',sp('corridor_wall'),[.35, .58, .13],[0, -.70, .56],'chassis',[0, 0, 0],'metal'),
    part('鼻部火种接触器的固定空心套筒',sp('rocket_sidesA'),[.24, .24, .40],[0, -.45, .67],'chassis',[90, 0, 0],'metal'),
    part('始终被鼻部套筒捕获的突破探杆',sp('rocket_fuelA'),[.13, .13, .57],[0, -.48, .67],'noseRam',[90, 0, 0],'gold'),
    part('探杆前端有折面的火种接触脉冲冠',sp('rocket_topB'),[.27, .24, .17],[0, -.98, .67],'noseTip',[90, 0, 0],'blade'),
    part('后甲板嵌入式三声道同步接收机',sp('machine_wireless'),[.39, .30, .33],[0, .69, 1.15],'chassis',[0, 0, 180],'native'),
    part('真实孔道内的高位传递阵列升降导筒',sp('rocket_sidesA'),[.31, .31, .62],[0, .82, 1.04],'chassis',[0, 0, 0],'metal'),
    part('被导筒捕获的高位传递阵列芯杆',sp('rocket_fuelA'),[.19, .19, .73],[0, .82, 1.12 + rise],'relayLift',[0, 0, 0],'gold'),
    part('升降芯杆外部连续机械导壳',sp('rocket_sidesA'),[.42, .43, .37],[0, .82, 1.02],'chassis',[0, 0, 0],'metal'),
    part('带真实背筋和三角馈源的高位传递阵列',sp('satelliteDish_detailed'),[.70, .50, .65],[0, .82, 1.46 + rise],'relayHead' + stage,[crownTilt(stage), 0, 0],'ivory'),
    part('传递阵列下方的四耳危险干扰转阀',sp('rocket_baseA'),[.24, .24, .15],[0, .73, 1.29],'jammerRotor',[0, 0, 0],'gold'),
    part('危险干扰喉的内嵌发射芯',sp('rocket_topA'),[.10, .10, .13],[0, .73, 1.35],'jammerRotor',[0, 0, 0],'glow'),
    part('后稳定舵双耳承座',sp('rocket_baseB'),[.24, .24, .12],[0, 1.01, .81],'chassis',[0, 0, 0],'metal'),
    part('后稳定舵的整面厚边护板',sp('corridor_wall'),[.18, .30, .23],[0, 1.01, .90],'rudder',[0, 0, 0],'armor'),
  ];

  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R', hinge = [side * .58, .43, 1.04];
    const a = side * bankAngle(stage), leaf = piece => deployed(piece, hinge, a);
    const shroudPivot = [side * .26, .72, 1.36];
    parts.push(
      handed(part('侧声道与肩甲之间的固定四耳根轴 ' + tag,sp('rocket_baseA'),[.28, .30, .16],[side * .58, .43, .96],'chassis',[0, 0, 0],'metal'),side),
      leaf(handed(part('固定根轴至完整声道底脚的包覆承力臂 ' + tag,sp('corridor_wall'),[.28, .60, .20],[side * .58, .18, .93],'channel' + tag,[0, 0, 0],'metal'),side)),
      leaf(handed(part('臂根自带回路的独立声道驱动机箱 ' + tag,sp('machine_generator'),[.26, .27, .32],[side * .58, .32, 1.08],'channel' + tag,[0, 0, 0],'native'),side)),
      leaf(handed(part('具有完整碟壁底脚与馈源的侧声道 ' + tag,sp('satelliteDish_large'),[.60, .40, .62],[side * .62, -.01, 1.10],'cantor' + tag + stage,[0, 0, side * 12],'ivory'),side)),
      leaf(handed(part('侧声道馈源的捕获式工作导筒 ' + tag,sp('rocket_sidesA'),[.17, .17, .29],[side * .62, .10, 1.41],'cantor' + tag + stage,[90, 0, side * 12],'metal'),side)),
      leaf(handed(part('侧声道实际工作行程的馈源芯 ' + tag,sp('rocket_fuelA'),[.10, .10, .34],[side * .62, .10, 1.41],'feed' + tag + stage,[90, 0, side * 12],'gold'),side)),
      leaf(handed(part('馈源芯端的封边信道接口 ' + tag,sp('rocket_fuelB'),[.14, .14, .065],[side * .684, -.203, 1.41],'feed' + tag + stage,[90, 0, side * 12],'accent'),side)),
      leaf(handed(part('独立声道后部受控散热匣 ' + tag,sp('machine_generator'),[.24, .25, .23],[side * .58, .33, 1.18],'vent' + tag + stage,[0, 0, 0],'metal'),side)),
      deployed(handed(part('围绕真实根轴打开的干扰喉侧护壳 ' + tag,sp('corridor_wallCorner'),[.17, .43, .39],[side * .26, .58, 1.27],'shroud' + tag,[0, 0, side * 180],'armor'),side), shroudPivot, side * [0, 39, 72][stage]),
      handed(part('侧护壳的固定四耳铰座 ' + tag,sp('rocket_baseB'),[.15, .15, .09],[side * .26, .72, 1.31],'chassis',[0, 0, 0],'metal'),side),
    );
  }
  for (const [id, x, y] of [['F', 0, -.56], ['L', -.53, .61], ['R', .53, .61]]) {
    const side = Math.sign(x) || 1;
    parts.push(
      handed(part('三点升力系统的机腹方形承座 ' + id,sp('pipe_ringHigh'),[.31, .31, .13],[x, y, .42],'chassis',[0, 0, 0],'metal'),side),
      handed(part('独立矢量化升力系统的连续喷口 ' + id,sp('rocket_fuelB'),[.28, .28, .26],[x, y, .45],'nozzle' + id,[180, 0, 0],'metal'),side),
      handed(part('小面积可见的喷口工作喉 ' + id,sp('rocket_topA'),[.09, .09, .04],[x, y, .21],'nozzle' + id,[180, 0, 0],'glow'),side),
    );
  }
  return parts;
}

export default {
  id: 'chorus_overseer', kind: 'enemies', role: 'boss', locomotion: 'hover', rig,
  variants: { phase1: variant(0), phase2: variant(1), phase3: variant(2) },
  design: {
  polish: "机腹采用单层承板连接三个喷口。声道臂与鼻部导座使用连续壳体，喷口收成完整管壁，尾舵使用整面厚边护板。重复喷口护唇已收掉。",
  assemblySymmetry: "侧声道、馈芯、驱动机匣、干扰喉弧形护壳和后方左右喷口使用真实 X 镜像。阶段展开仍绕原根轴，侧护壳采用同一右侧基准反射。 前主声道和前喷口各有一个，后侧喷口成对布置，构成原有三点承重与三声道职责。左右两翼保持镜像。",
    name: '合唱监管者',
    silhouette: "三点升力的合唱平台保留完整飞行声脊、前左右三声道和后升降阵列。",
    geometryEvidence: "完整飞行艇壳保留作为主体；连续承力臂、机腹承板或稳定舵使用登记的 corridor_wall；凹面碟、压机与捕获导筒保持完整源结构。喷口使用连续管壁。全部沿用登记的 Kenney CC0 素材。",
    loadPath: "机腹采用单层承板连接三个喷口。声道臂与鼻部导座使用连续壳体，喷口收成完整管壁，尾舵使用整面厚边护板。重复喷口护唇已收掉。",
    phases: 'phase1三声道前向收纳，后阵列低位折叠，危险干扰喉由侧护壳围住。phase2两側完整声道臂各展开39度，高位阵列抬升0.10并由52度折叠改为28度，侧护壳展开39度露出干扰喉。phase3侧臂展开67度，后阵列抬升0.36并竖直，侧护壳展开72度使干扰喉与高位信道形成独立危险轮廓。所有展开绕真实固定轴，部件尺寸保持一致。',
    articulation: '底壳、换能机箱/耦合芯、鼻部接触杆/脉冲冠、主声道/馈芯/散热、左右完整臂/声道/馈芯/散热、后阵列升降/阵列头、干扰阀/侧护壳、后舵、三点矢量喷口；阶段专属的碟轴和馈芯轴保留准确的已展开全局pivot。',
    locomotion: '实际始终air，moving和speed分别驱动三点差动推力、尾舵和机身小角度前倾；施法时仍保持实际移动，停止和减少动态效果固定，机体没有时钟漂浮摇摆。',
    attack: '飞行首领绕过地面阻路，抵达火种后每2.7秒持续突破。鼻部探杆先回抽预载，沿捕获导筒前伸，脉冲冠压缩接触，三点喷口制动并复位。高难度surge由中央相位芯蓄压、三向声道聚焦、芯杆下压释放及散热匣排载表示。',
    ability: 'group_shield预警1.1秒后瞬时为6格内敌人补充至18%生命护盾。三声道先对准/回抽馈芯蓄势，释放从中央耦合芯传至前/左/右声道并复位。phase>=1的释放额外征用6带宽2秒；abilityActive仅保持实际干扰喉与上层传递阵列工作，盾量由shieldFraction反馈，boosted仅影响真实推进。',
    damage: '受击在机箱、碟轴、馈芯与喷口间分配小行程卸载；死亡停止三向馈芯、回收侧臂、压下相位芯、折回高位阵列并闭合干扰护壳，局部停机姿态固定。实际飞行高度1.3的落地位移由EntityRenderer承担。',
    surfaces: "各阶段分别为 57、57、57 件。侧声道、馈芯、驱动机匣、干扰喉弧形护壳和后方左右喷口使用真实 X 镜像。阶段展开仍绕原根轴，侧护壳采用同一右侧基准反射。",
    review: '前上方对比三阶段侧臂展开和前/左/右独立声道；右后上方核对低位折叠、二阶段开喉、三阶段抬升竖直阵列；腹侧看三点升力与鼻部捕获导筒。检查预警末帧/释放初帧、三声道传递中帧、2秒干扰末帧、移动施法、突破接触与死亡末帧。',
    sourceLicense: 'Kenney Space Kit CC0，原始网格及License.txt保留于development/assets/model_sources/kenney/space-kit。',
  },
};
