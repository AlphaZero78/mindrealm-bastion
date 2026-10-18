import { part, joint, sp, handed } from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up. A sealed phase chamber is carried between two
// trunnion-mounted guide jaws. All four legs close their load path into the
// same keel; the jaws receive power through their stationary Y-axis bearings.
const rig = [
  joint('chassis', [0, .02, .78]),
  joint('body', [0, .02, .96], 'chassis'),
  joint('chamber', [0, -.04, 1.35], 'body'),
  joint('sensor', [0, -.70, 1.18], 'body'),
  joint('ram', [0, -.64, .91], 'body'),
];

const legs = [
  { id: 'LF', side: -1, y: -.45 },
  { id: 'RF', side: 1, y: -.45 },
  { id: 'LR', side: -1, y: .45 },
  { id: 'RR', side: 1, y: .45 },
];
for (const { id, side, y } of legs) {
  const x = side * .69;
  rig.push(
    joint('hip' + id, [x, y, .78], 'chassis'),
    joint('knee' + id, [x, y, .455], 'hip' + id),
    joint('ankle' + id, [x, y, .13], 'knee' + id),
  );
}
for (const side of [-1, 1]) {
  const id = side < 0 ? 'L' : 'R';
  rig.push(
    joint('guide' + id, [side * .61, -.03, 1.12], 'body'),
    joint('jaw' + id, [side * .47, -.10, 1.90], 'guide' + id),
  );
}

const base = [
  part('single enclosed four-foot load keel', sp('corridor_wall'), [1.40, 1.16, .16], [0, .02, .69], 'chassis', [0, 0, 0], 'metal'),
  part('sealed phase transport machinery hull', sp('machine_generatorLarge'), [1.30, 1.40, .36], [0, .02, .77], 'body', [0, 0, 0], 'armor'),
  part('central ribbed phase pressure chamber', sp('machine_barrelLarge'), [.47, .51, .66], [0, -.04, 1.10], 'chamber', [0, 0, 0], 'native'),
  part('rounded chamber crown and pressure interlock', sp('rocket_topA'), [.40, .40, .23], [0, -.04, 1.70], 'chamber', [0, 0, 0], 'gold'),
  part('rear generator with accessible service panels', sp('machine_generator'), [.64, .48, .45], [0, .48, 1.02], 'body'),
  part('power manifold bridging both guide trunnions', sp('supports_low'), [1.24, .27, .17], [0, .33, 1.15], 'body', [0, 0, 0], 'metal'),
  part('protected forward route and phase registration visor', sp('desk_computerScreen'), [.37, .10, .16], [0, -.70, 1.10], 'sensor', [0, 0, 0], 'glow'),
  part('front breach ram fixed guide sleeve', sp('machine_barrel'), [.27, .27, .32], [0, -.48, .91], 'body', [90, 0, 0], 'metal'),
  part('captive ram carriage and bevelled contact head', sp('corridor_wall'), [.50, .42, .20], [0, -.83, .80], 'ram', [0, 0, 0], 'armor'),
  part('ram carriage front wiper and capture collar', sp('pipe_ringHigh'), [.28, .28, .08], [0, -.64, .91], 'body', [90, 0, 0], 'gold'),
];

for (const { id, side, y } of legs) {
  const x = side * .69;
  base.push(...[
    part('load carrying transverse hip bearing ' + id, sp('pipe_ringHigh'), [.24, .24, .10], [x - side * .05, y, .78], 'hip' + id, [0, side * 90, 0], 'metal'),
    part('rounded upper knee-drive housing ' + id, sp('rocket_fuelB'), [.22, .24, .325], [x, y, .455], 'hip' + id, [0, 0, 0], 'metal'),
    part('sealed transverse knee bearing ' + id, sp('pipe_ring'), [.22, .22, .085], [x - side * .0425, y, .455], 'knee' + id, [0, side * 90, 0], 'gold'),
    part('lower actuator shell carrying the ankle clevis ' + id, sp('machine_barrel'), [.21, .23, .325], [x, y, .13], 'knee' + id, [0, 0, 0], 'native'),
    part('single broad levelled walking shoe ' + id, sp('corridor_wall'), [.34, .48, .13], [x, y - .045, 0], 'ankle' + id, [0, 0, 0], 'armor'),
  ].map(piece => handed(piece, side)));
}

for (const side of [-1, 1]) {
  const id = side < 0 ? 'L' : 'R';
  base.push(...[
    // The axial supply shaft passes through the Y trunnion. Closing a guide
    // rotates around that shaft, so its connection to the manifold stays put.
    part('phase guide rear trunnion and rotary supply bearing ' + id, sp('pipe_ringHigh'), [.30, .30, .12], [side * .61, .03, 1.12], 'guide' + id, [90, 0, 0], 'metal'),
    part('single curved phase guide cheek ' + id, sp('corridor_wallCorner'), [.62, .21, .87], [side * .66, .02, 1.11], 'guide' + id, [0, 0, side * 90], 'armor'),
    part('enclosed inner phase alignment rail ' + id, sp('rocket_fuelB'), [.16, .20, .74], [side * .54, -.20, 1.14], 'guide' + id, [0, 0, 0], 'metal'),
    part('single upper jaw elbow housing ' + id, sp('corridor_wall'), [.31, .44, .18], [side * .57, -.03, 1.88], 'guide' + id, [0, 0, 0], 'metal'),
    part('articulated phase focusing head and jaw drive ' + id, sp('machine_wireless'), [.22, .28, .24], [side * .40, -.28, 1.87], 'jaw' + id, [0, 0, 0], 'native'),
    part('inward facing phase registration surface ' + id, sp('desk_computerScreen'), [.10, .25, .18], [side * .29, -.30, 1.895], 'jaw' + id, [0, 0, -side * 90], 'glow'),
    part('sealed manifold to guide rotary power coupling ' + id, sp('machine_barrel'), [.18, .18, .40], [side * .61, .33, 1.12], 'guide' + id, [90, 0, 0], 'gold'),
  ].map(piece => handed(piece, side)));
}

export default {
  id: 'phase_teleporter', kind: 'enemies', role: 'normal', locomotion: 'walker',
  rig, variants: { base },
  design: {
    name: '相位迁跃体',
    silhouette: '中央压力舱嵌入连续机械底盘。两侧弧形导向夹高于舱冠，四只短承重足形成低而宽的支撑面。正面可同时读出双夹开口、朝内定位面和前置撞头。',
    loadPath: '四足掌经踝、胫段执行器、膝轴和圆肩上腿壳接入贯通承重底盘。导向夹由真实 Y 轴耳座承载，夹头通过上方整体转接壳连接。',
    joints: '四套长度各为 0.325 的髋膝踝机构；机身载荷轴、轴向压力舱、定位镜和捕获式撞头；两套导向夹轴与夹头校准轴。',
    locomotion: '按模型坐标 travel 驱动四拍步进。每足 75% 周期接地，支撑阶段相对 Y 位移导数为 1，抵消沿 −Y 的机身行程。摆动阶段抬足、回摆并由踝轴调平。',
    attack: '前置撞头在固定导套内回抽、前压接触、弹性退让并复位。压力舱承担轴向载荷，四足在真实停止时压低承重中心。',
    ability: 'teleport：实际预警 1.1 秒；压稳载荷后，双侧导向夹闭合、夹头校准、压力舱蓄压。释放起点保持预警终姿，随后压力舱压下、夹头卸载、导向架重新展开。battle.js 沿当前地面路线向前迁跃最多 4 格。',
    powerConnection: '后置发电箱接入横向供能桥。金属轴穿过每侧 Y 轴承，把供能桥与导向夹连接；双夹开合时轴线保持重合。',
    damage: '受击时机身载荷轴退让，压力舱和撞头释放冲量。死亡在 650 ms 内先卸压，再屈膝下沉、导向夹失锁、舱冠落下；足掌保持接地。',
    surfaces: '44 件已登记的 Kenney CC0 机械网格。完整底盘、上腿护壳、封闭校准轨与旋转供能套筒覆盖细连接。圆肩夹头外壳和舱冠收顺轮廓，双夹运动间隙与窄定位面保留。',
    detailPolicy: '44 件全部参与承重、供能、传感或迁跃校准。双夹开口、核心舱、底盘与步足保留完整轮廓。',
    symmetry: '四足与双夹、夹头和供能套使用真实反射。双侧定位屏转向中央，夹外壳改成相对的单层弧片。底盘、撞头、上夹连接和足靴采用干净壳面，移除缩小飞船源自带的翼片层次。',
    sourceLicense: 'Kenney Space Kit CC0；原始素材与许可证保留在 development/assets/model_sources/kenney/space-kit，运行网格沿用 models.json 登记的 GLB。',
  },
};
