import { part, joint, sp, handed } from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up. Two sealed shells meet along the load-bearing spine.
// Both bay lids rotate on fore/aft hinge shafts; feet carry the chassis below.
const legNames = ['FL', 'FR', 'RL', 'RR'];
const legMounts = [[-.83, -.43], [.83, -.43], [-.83, .43], [.83, .43]];

const rig = [
  joint('chassis', [0, 0, .68]),
  joint('service', [0, 0, 1.28], 'chassis'),
  joint('ram', [0, -.82, .66], 'chassis'),
  joint('shellL', [-.13, 0, 1.25], 'chassis'),
  joint('shellR', [.13, 0, 1.25], 'chassis'),
  joint('latchL', [-.77, -.34, .78], 'chassis'),
  joint('latchR', [.77, -.34, .78], 'chassis'),
  joint('sledL', [-.39, 0, .70], 'chassis'),
  joint('sledR', [.39, 0, .70], 'chassis'),
  ...legNames.flatMap((name, i) => {
    const [x, y] = legMounts[i];
    return [
      joint('hip' + name, [x, y, .68], 'chassis'),
      joint('knee' + name, [x, y, .40], 'hip' + name),
      joint('ankle' + name, [x, y, .12], 'knee' + name),
    ];
  }),
];

function bay(side) {
  const suffix = side < 0 ? 'L' : 'R';
  const label = side < 0 ? '左' : '右';
  return [
    // The dome and skirt are one closed licensed mesh, rather than stacked
    // rings. Their two inner skirts overlap by .10 to seal the median seam.
    part(label + '舱连续折面孵化壳', sp('hangar_roundB'), [.86, 1.24, .66], [side * .38, 0, .67], 'shell' + suffix, [0, 0, 0], 'armor'),
    part(label + '舱贯通前后的密封铰轴套筒', sp('machine_barrel'), [.18, .18, .82], [side * .13, .41, 1.25], 'chassis', [90, 0, 0], 'metal'),
    part(label + '舱下缘圆肩锁闩座', sp('rocket_fuelB'), [.18, .21, .14], [side * .73, -.34, .69], 'chassis', [0, side * 90, 0], 'metal'),
    part(label + '舱回撤式封闭门锁盒', sp('machine_barrel'), [.15, .26, .12], [side * .77, -.34, .78], 'latch' + suffix, [0, 0, 0], 'gold'),
    // A supported empty cradle makes the exit legible without inventing a
    // second set of offspring when the shared reinforcement budget is empty.
    part(label + '舱横向出舱空载托盘', sp('corridor_wall'), [.56, .84, .14], [side * .39, 0, .67], 'sled' + suffix, [0, 0, 0], 'metal'),
  ].map(piece => handed(piece, side));
}

function leg(name, index) {
  const [x, y] = legMounts[index];
  const side = Math.sign(x);
  return [
    // These transverse bearings bridge the belly's edge to the leg centre.
    // The complete .28 + .28 link chain terminates at the flat .12 ankle.
    part(name + '承重髋轴与法兰', sp('pipe_ringHigh'), [.18, .18, .28], [x - side * .14, y, .68], 'hip' + name, [0, side * 90, 0], 'metal'),
    part(name + '上段密封承重筒', sp('machine_barrel'), [.18, .21, .28], [x, y, .40], 'hip' + name, [0, 0, 0], 'native'),
    part(name + '膝部横轴止推座', sp('pipe_ring'), [.16, .16, .16], [x - side * .08, y, .40], 'knee' + name, [0, side * 90, 0], 'metal'),
    part(name + '下段圆肩承重壳', sp('rocket_fuelB'), [.17, .19, .28], [x, y, .12], 'knee' + name, [0, 0, 0], 'metal'),
    part(name + '踝部调平轴套', sp('pipe_ring'), [.14, .14, .14], [x - side * .07, y, .12], 'ankle' + name, [0, side * 90, 0], 'metal'),
    part(name + '宽底抓地靴', sp('corridor_wall'), [.28, .40, .10], [x, y - .025, .02], 'ankle' + name, [0, 0, 0], 'armor'),
  ].map(piece => handed(piece, side));
}

const base = [
  part('连接四髋的单层腹部底盘', sp('corridor_wall'), [1.38, 1.15, .24], [0, 0, .51], 'chassis', [0, 0, 0], 'armor'),
  part('贯穿双舱的内置承力脊梁', sp('supports_low'), [.30, 1.13, .22], [0, 0, .69], 'chassis', [0, 0, 0], 'metal'),
  part('双舱背部调压与维护箱', sp('machine_generatorLarge'), [.27, 1.03, .20], [0, .015, 1.28], 'service', [0, 0, 0], 'native'),
  part('后缘液压换热器', sp('machine_generator'), [.48, .22, .24], [0, .62, .65], 'chassis', [0, 0, 0], 'metal'),
  part('前向路面距离观察仪', sp('desk_computerScreen'), [.27, .095, .13], [0, -.66, 1.05], 'chassis', [0, 0, 0], 'glow'),
  part('冲撞滑靴单层固定导套', sp('machine_barrel'), [.36, .36, .56], [0, -.49, .66], 'chassis', [90, 0, 0], 'metal'),
  part('前向液压冲撞滑靴', sp('corridor_wall'), [.53, .31, .20], [0, -.85, .60], 'ram', [0, 0, 0], 'armor'),
  ...bay(-1),
  ...bay(1),
  ...legNames.flatMap((name, i) => leg(name, i)),
];

export default {
  id: 'fracture_seed',
  kind: 'enemies',
  role: 'normal',
  locomotion: 'crawler',
  rig,
  variants: { base },
  design: {
    silhouette: '四足承载的双瓣封闭孵化壳，中央维护脊、两侧门锁和前向冲撞滑靴形成独立轮廓。',
    support: '整体腹盘连接四根横髋轴。每足有 .28 + .28 模型单位的密封承重段，膝轴连接上下段，踝轴保持鞋底接地。',
    attack: '单层固定导套约束冲撞滑靴。准备时回缩，工作行程向前，接触压缩，随后退回护套。',
    ability: 'split 由死亡事件触发。门锁回撤、舱盖绕贯通铰轴向外翻开，两个空夹持载架分别朝左前和右前推出。',
    reinforcement: '实际两只 spike_runner 由 battle.js 的 reinforce 生成，并受共享预算约束。模型只表现可见的出舱通路和空载架。',
    surfaces: '封闭舱盖、单层腹盘与空载托盘分层。铰轴套筒、封闭门锁和四足护筒解释连接；前端保留一个固定导套和一块工作滑靴。',
    sourceLicense: 'Kenney Space Kit CC0；来源与许可证保留在 development/assets/model_sources/kenney/space-kit。',
    symmetry: '两瓣舱盖、门锁、出舱托盘和四足按左右真实反射。删除托盘上的重复鞍座，前撞头改用单层固定导套，足底与空载托盘使用干净折角壳。双舱开合与死亡推出仍沿原关节。',
    partCount: base.length,
  },
};
