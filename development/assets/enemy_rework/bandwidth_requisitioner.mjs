import { part, joint, sp, td, handed } from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up; -Y is forward. Six captured taps form the central
// requisition press. The additional two pairs have their own physical seats.
const rig = [
  joint('chassis', [0, .04, .30]),
  joint('body', [0, .10, .69], 'chassis'),
  joint('tapRack', [0, -.46, 1.24], 'body'),
  joint('channelCam', [0, -.67, 1.65], 'body'),
  joint('rearLid', [0, .97, 1.29], 'body'),
  joint('counterDish', [0, .49, 1.50], 'body'),
  joint('counterFeed', [0, .68, 1.17], 'body'),
  joint('telemetry', [0, .89, .87], 'body'),
];
for (const side of [-1, 1]) {
  const tag = side < 0 ? 'L' : 'R';
  rig.push(
    joint('jaw' + tag, [side * .58, -.96, .68], 'body'),
    joint('door' + tag, [side * .75, .28, .84], 'body'),
    joint('booster' + tag, [side * .77, .33, 1.05], 'body'),
    joint('boosterValve' + tag, [side * .77, -.11, 1.06], 'booster' + tag),
    joint('cooler' + tag, [side * .67, .71, .89], 'body'),
  );
  for (const [station, y] of [['F', -.96], ['A', -.32], ['B', .32], ['R', .96]]) {
    rig.push(joint('wheel' + tag + station, [side * 1.11, y, .30], 'chassis'));
  }
}

function hinge(piece, pivot, axis, degrees) {
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const d = piece.position.map((v, i) => v - pivot[i]);
  const r = axis === 0 ? [d[0], d[1] * c - d[2] * s, d[1] * s + d[2] * c]
    : [d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c];
  // Compose the global hinge outside the source's static orientation. The
  // flank panels face sideways, so adding Euler Y would hinge on a new axis.
  const [rx, ry, rz] = piece.rotation.map(v => v * Math.PI / 180);
  const [cx, cy, cz, sx, sy, sz] = [Math.cos(rx), Math.cos(ry), Math.cos(rz), Math.sin(rx), Math.sin(ry), Math.sin(rz)];
  const m = [[cy * cz, sx * sy * cz - cx * sz, cx * sy * cz + sx * sz],
    [cy * sz, sx * sy * sz + cx * cz, cx * sy * sz - sx * cz], [-sy, sx * cy, cx * cy]];
  const rotated = axis === 0 ? [m[0], m[1].map((v, i) => c * v - s * m[2][i]), m[1].map((v, i) => s * v + c * m[2][i])]
    : [m[0].map((v, i) => c * v + s * m[2][i]), m[1], m[0].map((v, i) => -s * v + c * m[2][i])];
  const orientation = [Math.atan2(rotated[2][1], rotated[2][2]), Math.asin(Math.max(-1, Math.min(1, -rotated[2][0]))), Math.atan2(rotated[1][0], rotated[0][0])].map(v => v * 180 / Math.PI);
  return { ...piece, position: r.map((v, i) => v + pivot[i]), rotation: orientation };
}

function variant(phase) {
  const parts = [
    part('single folded eight wheel requisition load deck',sp('corridor_wall'),[2.00, 2.37, .39],[0, .04, .41],'body',[0, 0, 0],'armor'),
    part('enclosed rear differential and power converter',sp('machine_generatorLarge'),[1.04, .62, .35],[0, .58, .36],'chassis',[0, 0, 0],'native'),
    part('complete rounded channel control housing and captive handle',sp('machine_generator'),[1.03, .90, .61],[0, .34, .78],'body',[0, 0, 180],'ivory'),
    part('processed hexagonal six channel pressure frame with load feet',sp('gate_complex'),[1.47, .37, 1.27],[0, -.44, .76],'body',[0, 0, 0],'metal'),
    part('captured six channel synchronising four ear cam',sp('rocket_baseA'),[.32, .32, .11],[0, -.615, 1.65],'channelCam',[90, 0, 0],'gold'),
    part('protected low rear requisition controller and radio aerials',sp('machine_wireless'),[.44, .38, .25],[0, .89, .78],'telemetry',[0, 0, 0],'native'),
    hinge(part('complete tapered rear apparatus service shroud',sp('rocket_topA'),[1.14, 1.05, .19],[0, .49, 1.27],'rearLid',[0, 0, 0],'armor'), [0, .97, 1.29], 0, phase === 2 ? -78 : 0),
    part('continuous front jaw guide cover with rounded edges',sp('corridor_wall'),[1.29, .31, .14],[0, -.92, .54],'body',[0, 0, 0],'metal'),
  ];
  for (const [station, y] of [['F', -.96], ['A', -.32], ['B', .32], ['R', .96]]) {
    parts.push(part('full span drive axle cradle ' + station,sp('corridor_wall'),[2.05, .18, .17],[0, y, .27],'chassis',[0, 0, 0],'metal'));
  }
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    parts.push(
      handed(part('four axle continuous enclosed load rail ' + tag,sp('corridor_wall'),[.23, .25, 2.18],[side * .85, 1.13, .32],'chassis',[90, 0, 0],'metal'),side),
      hinge(handed(part('complete ribbed flank equipment shutter ' + tag,sp('corridor_wall'),[1.23, .16, .76],[side * .81, .28, .84],'door' + tag,[0, 0, side * 90],'armor'),side), [side * .75, .28, .84], 1, side * [0, 56, 68][phase]),
      handed(part('fixed continuous flank shutter hinge ' + tag,sp('rocket_fuelB'),[.23, .23, .08],[side * .75, .32, .84],'body',[90, 0, 0],'gold',true),side),
      handed(part('fixed jaw thrust bearing and captured shoulder ' + tag,sp('rocket_fuelB'),[.34, .35, .14],[side * .58, -.96, .61],'body',[0, 0, 0],'metal'),side),
      handed(part('jaw forward enclosed captive linkage ' + tag,sp('corridor_wall'),[.22, .22, .58],[side * .58, -.92, .69],'jaw' + tag,[90, 0, 0],'metal'),side),
      handed(part('complete bevelled inward requisition contact jaw ' + tag,sp('corridor_wallCorner'),[.41, .71, .25],[side * .65, -1.23, .56],'jaw' + tag,[0, 0, side * 9],'ivory'),side),
      handed(part('four axle traction motor and protected termination ' + tag,sp('machine_barrelLarge'),[.29, .29, .23],[side * .74, .33, .36],'chassis',[0, side * 90, 0],'metal'),side),
      handed(part('hinged rear enclosed channel heat exchanger ' + tag,sp('machine_generator'),[.27, .35, .48],[side * .67, .71, .79],'cooler' + tag,[0, 0, 0],'metal'),side),
    );
    for (const [station, y] of [['F', -.96], ['A', -.32], ['B', .32], ['R', .96]]) {
      const id = tag + station;
      // Measured round source, +90 Y on both sides, bottom centre translated
      // to pivot X minus half depth. Eight wheel planes therefore share axle Z.
      parts.push(
        part('bevelled rounded round traction tyre ' + id,'refined/drive-wheel',[.60, .60, .19],[side * 1.11 - .095, y, .30],'wheel' + id,[0, 90, 0],'native'),
      );
    }
    for (const [row, z] of [['low', 1.00], ['middle', 1.25], ['upper', 1.50]]) {
      const x = side * .28;
      parts.push(
        handed(part('six channel stepped fixed induction sleeve ' + tag + row,sp('machine_barrelLarge'),[.25, .25, .42],[x, -.34, z],'body',[90, 0, 0],'metal'),side),
        handed(part('six channel captured signal intake plunger ' + tag + row,sp('rocket_fuelA'),[.16, .16, .44],[x, -.43, z],'tapRack',[90, 0, 0],'glow'),side),
      );
    }
    if (phase >= 1) {
      parts.push(
        handed(part('exposed complete auxiliary channel booster enclosure ' + tag,sp('machine_generator'),[.41, .55, .46],[side * .77, .33, .86],'booster' + tag,[0, 0, side * 90],'native'),side),
        handed(part('auxiliary fixed induction sleeve with supporting feet ' + tag,sp('machine_barrelLarge'),[.29, .29, .40],[side * .77, .05, 1.06],'booster' + tag,[90, 0, 0],'metal'),side),
        handed(part('captured eighth channel auxiliary induction plunger ' + tag,sp('rocket_fuelB'),[.17, .17, .43],[side * .77, -.03, 1.06],'boosterValve' + tag,[90, 0, 0],'gold'),side),
      );
    }
  }
  if (phase >= 2) {
    parts.push(
      part('enclosed rear counter channel pedestal bolted into the converter',sp('corridor_wall'),[.38, .42, .41],[0, .49, 1.09],'body',[0, 0, 0],'metal'),
      part('deployed complete concave counter channel sink and integral mount',sp('satelliteDish_large'),[1.24, .78, 1.03],[0, .49, 1.50],'counterDish',[10, 0, 0],'ivory'),
    );
    for (const side of [-1, 1]) {
      const tag = side < 0 ? 'L' : 'R';
      parts.push(
        handed(part('rear tenth channel fixed feeder sleeve ' + tag,sp('machine_barrelLarge'),[.30, .30, .43],[side * .43, .83, 1.17],'body',[90, 0, 0],'metal'),side),
        handed(part('captured rear counter channel feeder ' + tag,sp('rocket_fuelA'),[.16, .16, .48],[side * .43, .68, 1.17],'counterFeed',[90, 0, 0],'gold'),side),
      );
    }
  }
  return parts;
}

export default {
  id: 'bandwidth_requisitioner', kind: 'enemies', role: 'boss', locomotion: 'crawler', rig,
  variants: { phase1: variant(0), phase2: variant(1), phase3: variant(2) },
  design: {
  polish: "折边底盘与连续纵梁构成清楚的底层。前钳采用厚弧接触壳与连续连杆，侧门通过完整轴承连接底盘，主接口保持三行两列排布。",
  assemblySymmetry: "侧门采用右侧源姿态的真实 X 反射，左侧初始 Z 角改为负值后再叠加原展开轴。双钳、六接口、增压器及后馈源也按真实反射安装。 左右结构保持对称。前接口与后截流器按输入和导流功能区分。",
    name: '带宽征用者',
    silhouette: "八轮征用机台承载六信道压机、侧增压装置和后截流接收器。",
    loadPath: "折边底盘与连续纵梁构成清楚的底层。前钳采用厚弧接触壳与连续连杆，侧门通过完整轴承连接底盘，主接口保持三行两列排布。",
    joints: '八根独立 X 轴轮轴、隔振机台、六接口共用 Y 轴滑动架、前向 Y 轴四耳凸轮、两只 Z 钳臂、双侧 Y 铰门、两组捕获式增压阀、双散热门、后 X 轴壳盖、截流器俯仰轴及后端双阀。',
    phase1: '6 带宽：两扇侧壳门与后壳盖闭合，六个信道套筒及捕获式活塞在完整前框内工作。固定八轮机台和前接触钳提供低矮宽轮廓。',
    phase2: '8 带宽：侧壳门沿承重铰轴各打开 56 度，实际露出两台完整侧向增压机和两根追加信道阀。新增危险设备具有各自供能壳、固定套筒与受控活塞。',
    phase3: '10 带宽：侧壳门进一步打开至 68 度，后壳盖围绕后铰座打开 78 度，露出并抬起完整凹面截流接收器和后端双馈源。其承重框从原机台控制壳上延伸，两个追加馈源与侧向增压器同时工作。',
    locomotion: 'wheelRollAngle 按模型行程与 0.30 半径计算64 段实际接触带滚动；wheelSupportHeight 同步补偿机台轴高。八轮在能力准备及持续征用期间继续按实际行程工作，机台只承担速度荷载压缩。',
    attack: '双钳从固定推力座回撤、向前加速、向内夹合接触、卸载回位。完整楔形钳壳和捕获式包覆连杆围绕承重轴联动，机台承接后坐。贴身构造、火种与屏障使用同一短程接触机构。',
    ability: 'jam：真实 1.1 秒预警内六接口滑架回抽，前凸轮索引到锁合位，散热鳍开启。释放完成前伸征用行程，持续期凸轮按真实 elapsed/remaining 完成整周驱动；六接口分段进给、侧增压阀与后馈源按阶段参与。效果尾段沿导轨回收。',
    gameplay: '地面首领，air=false；生命低于 70%/35% 进入 phase=1/2；能力征用 6/8/10 带宽，基础循环 6.5/5.7/4.9 秒。difficulty.js 的实际 jamDuration 为 min(5,cycle-1.1)，动作使用 abilityActive/abilityElapsed/abilityRemaining，不写死五秒。持续期间最新部署单位先停机。',
    damage: '受击由机台隔振座短促压缩、钳联杆回撤和信道滑架回弹承接。650 ms 死亡过程先停凸轮、退活塞，再使机台倾入轴架、增压器卸载、后凹面装置围绕支座倒伏。八轮按冻结行程保持地面承重。',
    sourceGeometry: "底盘、护梁与整面接触板采用登记的 corridor_wall；捕获导筒使用 rocket_sidesA 或 rocket_fuelA/B；工作机匣、门架、凹面装置继续使用登记的 Kenney CC0 源。主轮为 refined/drive-wheel，接触带使用 64 段轮廓。",
    surfaces: "各阶段分别为 48、54、60 件。侧门采用右侧源姿态的真实 X 反射，左侧初始 Z 角改为负值后再叠加原展开轴。双钳、六接口、增压器及后馈源也按真实反射安装。",
    sourceLicense: 'Kenney Space Kit 2.0 和 Tower Defense Kit 2.1，CC0。原始网格与 License.txt 保留在 development/assets/model_sources/kenney 对应目录。',
  },
};
