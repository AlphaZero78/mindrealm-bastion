import { part, joint, sp, handed } from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up; the long muzzle faces -Y. The shell and rifle form
// one low, continuous receiver, carried by four independent supporting legs.
const rig = [
  joint('chassis', [0, 0, .73]),
  joint('receiver', [0, .07, .85], 'chassis'),
  joint('turret', [0, -.04, 1.03], 'receiver'),
  joint('elevation', [0, -.15, 1.13], 'turret'),
  joint('recoil', [0, -.15, 1.13], 'elevation'),
  joint('scope', [.30, -.33, 1.46], 'elevation'),
  joint('feed', [-.32, .45, 1.325], 'elevation'),
  joint('ventL', [-.47, .57, 1.10], 'receiver'),
  joint('ventR', [.47, .57, 1.10], 'receiver'),
];
const stations = [
  { suffix: 'LF', side: -1, y: -.61 },
  { suffix: 'RF', side: 1, y: -.61 },
  { suffix: 'LR', side: -1, y: .61 },
  { suffix: 'RR', side: 1, y: .61 },
];
for (const { suffix, side, y } of stations) {
  const x = side * .69;
  rig.push(
    joint('hip' + suffix, [x, y, .73], 'chassis'),
    joint('knee' + suffix, [x, y, .43], 'hip' + suffix),
    joint('ankle' + suffix, [x, y, .13], 'knee' + suffix),
  );
}

const base = [
  part('内嵌腹部的开槽承重桥', sp('supports_low'), [1.28, 1.05, .17], [0, .02, .63], 'chassis', [0, 0, 0], 'metal'),
  part('前足贯通横轴与安装耳', sp('supports_low'), [1.55, .24, .16], [0, -.61, .65], 'chassis', [0, 0, 0], 'metal'),
  part('后足贯通横轴与安装耳', sp('supports_low'), [1.55, .24, .16], [0, .61, .65], 'chassis', [0, 0, 0], 'metal'),
  part('枪架下方的密封回转座', sp('pipe_ringHigh'), [.63, .63, .18], [0, -.04, .76], 'receiver', [0, 0, 0], 'metal'),
  part('贯穿前后的一体楔形猎杀机匣', sp('craft_speederB'), [1.10, 1.60, .48], [0, .08, .73], 'receiver', [0, 0, 180], 'armor'),
  part('尾部有检修面的供能传动箱', sp('machine_generator'), [.57, .45, .45], [0, .59, .89], 'receiver'),
  part('射线炮俯仰双耳托架', sp('rocket_baseB'), [.46, .54, .31], [0, .04, 1.00], 'turret', [0, 0, 0], 'metal'),
  part('带机匣和枪口的长射线武器', sp('weapon_rifle'), [.39, 2.05, .32], [0, -.77, 1.055], 'recoil'),
  handed(part('左侧前伸连续导轨护筒', sp('rocket_fuelB'), [.135, .15, 1.70], [-.225, .05, 1.13], 'elevation', [90, 0, 0], 'metal'), -1),
  part('右侧前伸连续导轨护筒', sp('rocket_fuelB'), [.135, .15, 1.70], [.225, .05, 1.13], 'elevation', [90, 0, 0], 'metal'),
  part('导轨前端单层枪口桥', sp('corridor_wall'), [.59, .22, .15], [0, -1.59, 1.06], 'recoil', [0, 0, 0], 'metal'),
  part('导轨末端射线聚焦环', sp('pipe_ringHigh'), [.26, .26, .10], [0, -1.69, 1.215], 'recoil', [90, 0, 0], 'metal'),
  part('侧置瞄准仪的双耳固定座', sp('supports_low'), [.31, .24, .16], [.30, -.33, 1.31], 'elevation', [0, 0, 0], 'metal'),
  part('带测距结构的瞄准仪罩', sp('machine_wireless'), [.28, .35, .30], [.30, -.33, 1.43], 'scope'),
  part('前向窄缝瞄准镜', sp('desk_computerScreen'), [.22, .065, .095], [.30, -.53, 1.56], 'scope', [0, 0, 0], 'glow'),
  part('后置可索引能源匣', sp('rocket_fuelB'), [.28, .30, .51], [-.32, .45, 1.07], 'feed', [0, 0, 0], 'metal'),
  part('能源匣到射线机匣的供能接桥', sp('supports_low'), [.41, .21, .15], [-.23, .23, 1.16], 'elevation', [0, 0, 0], 'gold'),
  handed(part('左后侧开合式圆肩散热壳', sp('rocket_fuelB'), [.23, .43, .31], [-.47, .57, 1.00], 'ventL', [0, 0, 0], 'metal'), -1),
  part('右后侧开合式圆肩散热壳', sp('rocket_fuelB'), [.23, .43, .31], [.47, .57, 1.00], 'ventR', [0, 0, 0], 'metal'),
];

for (const { suffix, side, y } of stations) {
  const x = side * .69;
  base.push(...[
    part('承重髋轴与外侧安装耳 ' + suffix, sp('pipe_ringHigh'), [.24, .24, .09], [x - side * .045, y, .73], 'hip' + suffix, [0, side * 90, 0], 'metal'),
    part('封闭式上腿伺服箱 ' + suffix, sp('machine_barrel'), [.23, .25, .30], [x, y, .43], 'hip' + suffix),
    part('可见的膝部贯通销轴 ' + suffix, sp('pipe_ring'), [.22, .22, .08], [x - side * .04, y, .43], 'knee' + suffix, [0, side * 90, 0], 'metal'),
    part('封闭式胫段承力筒 ' + suffix, sp('machine_barrel'), [.21, .23, .30], [x, y, .13], 'knee' + suffix, [0, 0, 0], 'metal'),
    part('前伸防滑承重足掌 ' + suffix, sp('corridor_wall'), [.33, .49, .15], [x, y - .07, .005], 'ankle' + suffix, [0, 0, 0], 'armor'),
  ].map(piece => handed(piece, side)));
}

export default {
  id: 'remote_hunter',
  kind: 'enemies',
  role: 'normal',
  locomotion: 'walker',
  rig,
  variants: { base },
  design: {
    silhouette: '四足低伏猎杀平台，长导轨从连续楔形机匣前伸，右侧测距仪和左后能源匣形成识别轮廓。',
    support: '四足接入两根横向承重桥。每足有长 0.30 的上腿与胫段，髋膝横轴驱动，踝轴调平足掌。',
    attack: '回转座承载俯仰托架，武器沿双导轨后坐。能源匣索引、瞄准仪稳定、射线聚焦环复位组成一次完整射击。',
    ability: 'tower_hunter：六格猎杀；每三次齐射后按 battle.js 的实际移动收拢瞄准仪并推进 2.5 秒。动作自身只读状态。',
    surfaces: '39 件已登记的 Kenney CC0 机械网格。成对导轨护筒与单层枪口桥承接长枪；胫段封闭筒、独立散热壳与平底足靴形成清楚的装配层次。销轴和窄缝测距镜保持独立。',
    detailPolicy: '删去机匣侧面重复开口筒、两个尾扣和内部小轴承。39 件部件保留长枪、能源匣、瞄准仪、支撑腿与足掌。',
    symmetry: '四足、成对长导套与后部散热壳使用真实反射。右测距仪和左后能源匣保留职责非对称；单层枪口桥与平底靴消除缩小飞船源的额外翼片。',
    sourceLicense: 'Kenney Space Kit CC0；原始素材和许可证保留于 development/assets/model_sources/kenney/space-kit。',
  },
};
