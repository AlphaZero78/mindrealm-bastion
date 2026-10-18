import { part, joint, sp, handed } from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up; the front aperture faces -Y. A complete racer hull
// carries a forward-open retort and three reaction-thrust trunnions.
const rig = [
  joint('chassis', [0, .03, .59]),
  joint('reactor', [0, -.075, .77], 'chassis'),
  joint('fieldRotor', [0, -.2425, 1.04], 'reactor'),
  joint('collector', [0, -.20, 1.04], 'reactor'),
  joint('pump', [0, .40, 1.165], 'chassis'),
  joint('compressor', [0, .665, .775], 'chassis'),
  joint('sensor', [0, -.64, .82], 'chassis'),
  joint('gateL', [-.36, -.475, 1.04], 'reactor'),
  joint('gateR', [.36, -.475, 1.04], 'reactor'),
  joint('contactRam', [0, -.62, .62], 'chassis'),
  joint('ramTip', [0, -.745, .62], 'contactRam'),
  joint('rudder', [0, .67, .77], 'chassis'),
];
const thrusters = [
  { id: 'L', x: -.55, y: -.10 },
  { id: 'R', x: .55, y: -.10 },
  { id: 'A', x: 0, y: .60 },
];
for (const { id, x, y } of thrusters) rig.push(joint('nozzle' + id, [x, y, .35], 'chassis'));

const base = [
  part('完整折面飞行腹壳', sp('craft_racer'), [1.28, 1.42, .36], [0, .03, .42], 'chassis', [0, 0, 180], 'armor'),
  part('腹下单层纵向动力护脊', sp('corridor_wall'), [.58, 1.10, .13], [0, .08, .34], 'chassis', [0, 0, 0], 'metal'),
  part('护筒底部连续承重鞍', sp('rocket_fuelB'), [.63, .47, .20], [0, -.075, .65], 'chassis', [0, 0, 0], 'metal'),
  // rocket_sidesA is a closed circumference with a real open bore. Its
  // authored Z axis turns toward -Y; the bore remains visible between doors.
  part('保留实际内孔的腐蚀护筒', sp('rocket_sidesA'), [.74, .74, .34], [0, -.09, 1.04], 'reactor', [90, 0, 0], 'ivory'),
  part('护筒后端单层进料座', sp('corridor_wall'), [.41, .31, .25], [0, .06, .77], 'reactor', [0, 0, 0], 'metal'),
  part('内置电极轴的固定套筒', sp('machine_barrel'), [.16, .16, .28], [0, .075, 1.04], 'reactor', [90, 0, 0], 'metal'),
  part('捕获在内孔中的四耳电极转子', sp('rocket_baseA'), [.245, .245, .075], [0, -.205, 1.04], 'fieldRotor', [90, 0, 0], 'gold'),
  part('轴向腐蚀馈针的绝缘导管', sp('rocket_fuelA'), [.05, .05, .19], [0, -.13, 1.04], 'collector', [90, 0, 0], 'metal'),
  part('工作口内的馈针终端', sp('rocket_topB'), [.10, .10, .09], [0, -.30, 1.04], 'collector', [90, 0, 0], 'glow'),
  part('带侧脚和完整罐壁的后置储压罐', sp('machine_barrelLarge'), [.36, .38, .53], [0, .40, .62], 'chassis', [0, 0, 0], 'metal'),
  part('储压罐上部加长阀芯导套', sp('machine_barrel'), [.18, .18, .31], [0, .40, 1.03], 'chassis', [0, 0, 0], 'gold'),
  part('导套内圆肩往复阀芯', sp('rocket_fuelB'), [.11, .11, .31], [0, .40, 1.12], 'pump', [0, 0, 0], 'metal'),
  part('阀芯上端压力指示帽', sp('rocket_topA'), [.14, .14, .10], [0, .40, 1.405], 'pump', [0, 0, 0], 'accent'),
  part('储压罐后侧传动和调压机', sp('machine_generator'), [.34, .30, .24], [0, .59, .62], 'chassis', [0, 0, 0], 'native'),
  part('后向可见压缩机传动凸轮', sp('rocket_baseA'), [.19, .19, .08], [0, .625, .775], 'compressor', [-90, 0, 0], 'gold'),
  // The wireless source is a low case and thin aerial, used at its real scale.
  part('前鼻低机箱和细天线接收器', sp('machine_wireless'), [.25, .22, .21], [0, -.64, .76], 'sensor', [0, 0, 0], 'native'),
  part('贯通腹壳的加长探头套筒', sp('machine_barrel'), [.20, .20, .35], [0, -.39, .62], 'chassis', [90, 0, 0], 'metal'),
  part('留在套筒内的轴向接触杆', sp('rocket_fuelA'), [.07, .07, .33], [0, -.43, .62], 'contactRam', [90, 0, 0], 'gold'),
  part('火种近接触的折面探头', sp('rocket_topB'), [.17, .17, .14], [0, -.725, .62], 'ramTip', [90, 0, 0], 'blade'),
  part('尾舵固定根部套座', sp('pipe_ringHigh'), [.15, .15, .12], [0, .67, .71], 'chassis', [0, 0, 0], 'metal'),
  part('后向稳定舵面', sp('corridor_wall'), [.09, .31, .22], [0, .75, .72], 'rudder', [0, 0, 0], 'armor'),
];

for (const side of [-1, 1]) {
  const id = side < 0 ? 'L' : 'R';
  base.push(...[
    part('工作口外侧连续隔离门 ' + id, sp('corridor_wall'), [.36, .06, .60], [side * .18, -.475, .74], 'gate' + id, [0, 0, 0], 'armor'),
    part('隔离门竖直铰轴紧凑承座 ' + id, sp('machine_barrel'), [.12, .12, .13], [side * .36, -.475, .975], 'gate' + id, [0, 0, 0], 'gold'),
    part('连接腹壳和门轴的密封支承筒 ' + id, sp('machine_barrel'), [.14, .16, .30], [side * .36, -.40, .80], 'reactor', [0, 0, 0], 'metal'),
  ].map(piece => handed(piece, side)));
}

for (const { id, x, y } of thrusters) {
  base.push(...[
    // Square pipe castings act as fixed sockets and outlet guards. They do
    // not rotate as rims; the complete four-ear nozzle tilts in its socket.
    part('腹壳嵌入式推力承座 ' + id, sp('pipe_ringHigh'), [.26, .26, .18], [x, y, .31], 'chassis', [0, 0, 0], 'metal'),
    part('耳轴支承的下向收敛喷口 ' + id, sp('rocket_baseB'), [.25, .25, .23], [x, y, .35], 'nozzle' + id, [180, 0, 0], 'metal'),
    part('下向喷口方形耐热出口护圈 ' + id, sp('pipe_ring'), [.23, .23, .06], [x, y, .11], 'nozzle' + id, [0, 0, 0], 'dark'),
    part('出口内的小面积燃烧喉 ' + id, sp('rocket_topA'), [.10, .10, .04], [x, y, .105], 'nozzle' + id, [180, 0, 0], 'glow'),
  ].map(piece => handed(piece, x < 0 ? -1 : 1)));
}

export default {
  id: 'resistance_corruptor', kind: 'enemies', role: 'normal', locomotion: 'hover',
  rig, variants: { base },
  design: {
    name: '抗性腐蚀体',
    silhouette: '一体机腹承载前向空心腐蚀护筒，护筒有两扇隔离门。圆肩阀芯从后部储压罐导套伸出。腹下三组矢量喷口形成三点推力布局，前鼻保留单独接触探头。',
    geometryEvidence: 'craft_racer 保留完整飞行壳体；rocket_sidesA 提供实际空心护筒；machine_barrelLarge 提供储压罐。corridor_wall 用于护脊、进料座、门和尾舵；machine_barrel 用于轴套。rocket_baseA/B 保留电极、凸轮和喷口用途，machine_wireless 保留低机箱与细天线比例。',
    loadPath: '连续机腹承载三组嵌入式推力承座、腐蚀护筒底鞍和后部储压罐。密封门轴支承筒连到护筒，门的竖直铰轴穿过紧凑承座。探头固定导套连到腹部护脊，杆芯始终留在导套内。',
    articulation: '机腹、护筒底座、内孔电极转子、轴向馈针、后置往复阀芯、压缩机凸轮、低位接收器、左右隔离门、三组喷口、尾舵和接触杆。接触头有单独压缩关节。',
    locomotion: 'air 为持续飞行。移动速度控制机腹前倾、尾舵和三组下向喷口的推力方向；压缩机凸轮按模型行程转动。施法期间的 moving 保持独立，机腹持续推进。静止时姿态固定。',
    attack: '真实战斗仅在抵达火种时接触突破。喷口先制动，杆芯沿固定套筒回抽，再完成前伸、接触压缩和复位。上方腐蚀护筒可以维持正在生效的工作状态。',
    ability: 'corrode_resistance 有 1.1 秒预警。释放后全场抗性降低 2，持续 5 秒，多名叠加。预警打开隔离门并提起阀芯；释放压下阀芯，内孔电极开始旋转。abilityActive、abilityElapsed 和 abilityRemaining 控制实际工作和尾段回收。',
    damage: '受击在护筒座、门轴和传感器处卸载；推进喷口短暂校正。650 ms 死亡窗口内阀芯泄压、门轴回收、尾舵下折和喷口卸载，机腹小角度前倾。渲染器负责真实飞行高度的落地。',
    surfaces: '39 件已登记 Kenney CC0 加工网格。单层护脊、进料座、门轴支承筒与加长导套形成清楚的装配层次。腐蚀护筒内孔、喷口、电极、阀芯和探头保持可见。',
    review: '前方近景看护筒内孔与门轴；后上方看罐壁、阀芯和凸轮；低侧面看三组喷口套座与探头捕获长度。比较预警末帧、释放零帧、持续工作中段、最后 0.34 秒、施法移动、接触压缩和死亡末帧。',
    sourceLicense: 'Kenney Space Kit CC0。原始网格和 License.txt 保留在 development/assets/model_sources/kenney/space-kit。',
    symmetry: '两扇隔离门、门轴支承与左右推力组件采用真实反射。腹下护脊、进料座和尾舵用单层壳面；删除夹在罐体之间的两根细馈管与重复探头滑架。后方第三喷口、储压罐和凸轮保留纵向功能布局。',
  },
};
