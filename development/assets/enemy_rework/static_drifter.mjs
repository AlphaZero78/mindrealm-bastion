import { part, joint, sp, handed } from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up. The walker faces -Y.
// Every visible shell is an already registered, bevelled Kenney CC0 mesh.
const rig = [
  joint('chassis', [0, 0, 1.18]),
  joint('torso', [0, 0, 1.28], 'chassis'),
  joint('head', [0, 0, 1.88], 'torso'),
  joint('hipL', [-.35, 0, 1.18], 'chassis'),
  joint('kneeL', [-.35, 0, .68], 'hipL'),
  joint('ankleL', [-.35, 0, .18], 'kneeL'),
  joint('hipR', [.35, 0, 1.18], 'chassis'),
  joint('kneeR', [.35, 0, .68], 'hipR'),
  joint('ankleR', [.35, 0, .18], 'kneeR'),
  joint('shoulderL', [-.53, 0, 1.71], 'torso'),
  joint('elbowL', [-.60, -.02, 1.32], 'shoulderL'),
  joint('wristL', [-.60, -.10, 1.08], 'elbowL'),
  joint('shoulderR', [.53, 0, 1.71], 'torso'),
  joint('elbowR', [.60, -.02, 1.32], 'shoulderR'),
  joint('wristR', [.60, -.10, 1.08], 'elbowR'),
  joint('striker', [.60, -.16, .72], 'wristR'),
];

const body = [
  part('贯穿髋轴的单层承重梁', sp('corridor_wall'), [.82, .35, .20], [0, 0, 1.08], 'chassis', [0, 0, 0], 'metal'),
  part('下腹伺服箱与骨盆护壳', sp('corridor_wall'), [.48, .43, .25], [0, .035, 1.06], 'chassis', [0, 0, 0], 'armor'),
  part('窄胸整体检修机匣', sp('machine_generatorLarge'), [.70, .44, .57], [0, .025, 1.28], 'torso', [0, 0, 0], 'armor'),
  part('背部驱动器与散热层', sp('machine_generator'), [.46, .21, .39], [0, .24, 1.40], 'torso'),
  part('颈部转台及密封轴承', sp('pipe_ring'), [.22, .22, .09], [0, 0, 1.83], 'torso', [0, 0, 0], 'metal'),
  part('圆顶传感器防护头罩', sp('rocket_topA'), [.37, .34, .30], [0, -.025, 1.88], 'head', [0, 0, 0], 'armor'),
  part('前向单缝观察仪', sp('desk_computerScreen'), [.28, .09, .115], [0, -.21, 2.02], 'head', [12, 0, 0], 'glow'),
];

function leg(side, suffix) {
  const x = side * .35;
  return [
    // The bearing local Z axis becomes the transverse X axle. Its centre
    // coincides exactly with the rig pivot; plates stop short of that axle.
    part('髋部横向轴承 ' + suffix, sp('pipe_ringHigh'), [.25, .25, .12], [x - side * .06, 0, 1.18], 'hip' + suffix, [0, side * 90, 0], 'metal'),
    part('大腿密封承重筒 ' + suffix, sp('machine_barrel'), [.23, .23, .50], [x, 0, .68], 'hip' + suffix, [0, 0, 0], 'metal'),
    part('大腿分片护壳 ' + suffix, sp('rocket_sidesA'), [.31, .29, .40], [x, -.015, .73], 'hip' + suffix, [0, 0, 0], 'armor'),
    part('外露膝部销轴 ' + suffix, sp('pipe_ring'), [.23, .23, .09], [x - side * .045, 0, .68], 'knee' + suffix, [0, side * 90, 0], 'metal'),
    part('胫部伺服驱动壳 ' + suffix, sp('machine_barrelLarge'), [.25, .24, .49], [x, .015, .18], 'knee' + suffix),
    part('前长后短的平底承重靴 ' + suffix, sp('corridor_wall'), [.29, .50, .18], [x, -.09, .025], 'ankle' + suffix, [0, 0, 0], 'armor'),
  ].map(piece => handed(piece, side));
}

function arm(side, suffix) {
  return [
    part('肩部贯穿轴承 ' + suffix, sp('pipe_ringHigh'), [.27, .27, .12], [side * .53 - side * .06, 0, 1.71], 'shoulder' + suffix, [0, side * 90, 0], 'metal'),
    part('肩轴外侧圆肩护罩 ' + suffix, sp('rocket_fuelB'), [.25, .31, .27], [side * .53, .025, 1.57], 'shoulder' + suffix, [0, 0, side * 8], 'armor'),
    part('上臂密封承力壳 ' + suffix, sp('machine_barrel'), [.19, .21, .388], [side * .60, -.02, 1.32], 'shoulder' + suffix, [-3, -side * 10.4, 0], 'metal'),
    part('肘部横向销轴 ' + suffix, sp('pipe_ring'), [.20, .20, .09], [side * .60 - side * .045, -.02, 1.32], 'elbow' + suffix, [0, side * 90, 0], 'metal'),
    part('前臂驱动箱 ' + suffix, sp('machine_barrel'), [.27, .22, .253], [side * .60, -.10, 1.08], 'elbow' + suffix, [-18.4, 0, 0]),
  ].map(piece => handed(piece, side));
}

const base = [
  ...body,
  ...leg(-1, 'L'),
  ...leg(1, 'R'),
  ...arm(-1, 'L'),
  handed(part('平衡臂封闭握拳套', sp('rocket_fuelB'), [.23, .24, .20], [-.60, -.10, .99], 'wristL', [0, 0, 0], 'armor'), -1),
  ...arm(1, 'R'),
  part('敲击柄握持夹具', sp('weapon_gun'), [.23, .27, .16], [.60, -.13, 1.035], 'wristR', [0, 0, 0], 'metal'),
  part('贯通握柄的圆截面锤柄', sp('rocket_fuelA'), [.10, .10, .46], [.60, -.16, .70], 'wristR', [0, 0, 0], 'metal'),
  part('锤柄下段缓冲护筒', sp('machine_barrel'), [.15, .15, .24], [.60, -.16, .73], 'wristR', [0, 0, 0], 'armor'),
  part('横置缓冲式敲击头', sp('machine_barrelLarge'), [.24, .26, .40], [.40, -.16, .72], 'striker', [0, 90, 0], 'armor'),
  part('敲击头外端缓冲止挡', sp('pipe_ring'), [.22, .22, .06], [.77, -.16, .72], 'striker', [0, 90, 0], 'metal'),
];

export default {
  id: 'static_drifter',
  kind: 'enemies',
  role: 'normal',
  locomotion: 'walker',
  rig,
  variants: { base },
  design: {
    silhouette: '窄胸、圆顶单缝头罩、可见髋膝轴和一侧下垂的横头敲击锤。',
    support: '贯穿髋梁承载上身，左右腿各有 0.50 模型单位的大腿与胫段。脚掌绕踝轴调平。',
    attack: '右臂夹具固定贯通锤柄。肩肘抬锤、躯干转向、手腕导向，接触时敲击头沿锤柄压缩。',
    ability: 'none，按 content.js 的基础近战与地形敲击规则表现。',
    surfaces: '沿用建筑使用的倒角 CC0 网格。单层检修胸匣、完整足靴、圆顶头罩与肩罩各自成形；腿臂密封筒覆盖承力连接，锤柄保留短行程与缓冲护筒。',
    detailPolicy: '删去侧置电容、胫前叠壳、踝架与后跟小止挡；35 件部件保留完整承重和攻击机构。',
    symmetry: '左右腿、肩、上臂和前臂以 handed 反射源网格。右侧持锤、左侧平衡拳为职责非对称；正面单层检修机匣和完整足靴减少叠片。',
    sourceLicense: 'Kenney Space Kit CC0；来源和许可证保留在 development/assets/model_sources/kenney/space-kit。',
  },
};
