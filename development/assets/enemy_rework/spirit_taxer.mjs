import { part, joint, sp, handed } from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up. The cargo hull supplies a single continuous load
// surface; the real open gate mesh becomes a visible auditing press frame.
const rig = [
  joint('chassis', [0, .06, .63]),
  joint('auditFrame', [0, -.20, .88], 'chassis'),
  joint('press', [0, -.20, 1.53], 'auditFrame'),
  joint('stamp', [0, -.20, 1.434], 'press'),
  joint('gauge', [0, .27, 1.07], 'chassis'),
  joint('rearCam', [0, .64, 1.02], 'chassis'),
  joint('noseRam', [0, -.68, .65], 'chassis'),
  joint('noseTip', [0, -.90, .65], 'noseRam'),
  joint('rudder', [0, .81, .82], 'chassis'),
];

const base = [
  part('带分层侧肩与检修面板的完整宽体艇壳',sp('craft_cargoA'),[1.90, 1.76, .50],[0, .06, .47],'chassis',[0, 0, 180],'armor'),
  part('四组推力承座之间的贯通腹部双轨骨架',sp('supports_low'),[1.40, 1.24, .18],[0, .06, .39],'chassis',[0, 0, 0],'metal'),
  // gate_simple was measured as an open upright ring with its own base, so
  // the actuator and platen remain visible through its genuine aperture.
  part('保留真实开孔与双脚底座的审计承力环',sp('gate_simple'),[.88, .32, .91],[0, -.20, .86],'auditFrame',[0, 0, 0],'ivory'),
  part('审计环上缘捕获式压机导套',sp('rocket_sidesA'),[.25, .25, .32],[0, -.20, 1.48],'auditFrame',[0, 0, 0],'metal'),
  part('贯穿上缘导套的征收压机芯杆',sp('rocket_fuelA'),[.15, .15, .43],[0, -.20, 1.32],'press',[0, 0, 0],'gold'),
  part('开环内的四耳审计压头',sp('rocket_baseB'),[.30, .25, .13],[0, -.20, 1.434],'stamp',[180, 0, 0],'metal'),
  part('压头下方固定的折面计量砧',sp('rocket_topB'),[.33, .26, .11],[0, -.20, 1.12],'auditFrame',[0, 0, 0],'accent'),
  part('后甲板内嵌征收传动机组',sp('machine_generatorLarge'),[.65, .54, .39],[0, .56, .80],'chassis',[0, 0, 0],'native'),
  part('后向可见的封边计量偏心盘',sp('rocket_fuelB'),[.22, .22, .075],[0, .61, 1.02],'rearCam',[-90, 0, 0],'gold'),
  part('真实低机箱与细天线比例的账目接收器',sp('machine_wireless'),[.32, .28, .29],[0, .24, .93],'chassis',[0, 0, 0],'native'),
  part('征收状态显示的折边标尺窗',sp('desk_computerScreen'),[.24, .13, .16],[0, .27, 1.07],'gauge',[0, 0, 0],'glow'),
  part('腹下近接触杆的连续导座',sp('corridor_wall'),[.38, .53, .12],[0, -.64, .51],'chassis',[0, 0, 0],'metal'),
  part('鼻部接触杆固定套筒',sp('rocket_sidesA'),[.24, .24, .38],[0, -.47, .65],'chassis',[90, 0, 0],'metal'),
  part('始终留在套筒内的征收探杆',sp('rocket_fuelA'),[.13, .13, .45],[0, -.49, .65],'noseRam',[90, 0, 0],'gold'),
  part('火种接触用的折面审计封印头',sp('rocket_topB'),[.25, .22, .15],[0, -.90, .65],'noseTip',[90, 0, 0],'blade'),
  part('尾舵嵌入式双耳根座',sp('rocket_baseB'),[.26, .26, .19],[0, .80, .72],'chassis',[0, 0, 0],'metal'),
  part('独立厚边后稳定舵',sp('corridor_wall'),[.20, .24, .28],[0, .94, .86],'rudder',[0, 0, 0],'armor'),
];

for (const side of [-1, 1]) {
  const s = side < 0 ? 'L' : 'R';
  rig.push(
    joint('arm' + s, [side * .73, -.10, .86], 'chassis'),
    joint('scoop' + s, [side * .94, -.40, 1.03], 'arm' + s),
    joint('meter' + s, [side * .83, -.10, 1.09], 'arm' + s),
    joint('vent' + s, [side * .51, .69, .99], 'chassis'),
  );
  base.push(
    handed(part('侧肩嵌入式采集臂整环转座 ' + s,sp('rocket_fuelB'),[.34, .40, .18],[side * .73, -.10, .76],'chassis',[0, 0, 0],'metal'),side),
    handed(part('转座至采集器的包覆承力臂 ' + s,sp('corridor_wall'),[.31, .51, .18],[side * .86, -.27, .84],'arm' + s,[0, 0, 0],'metal'),side),
    handed(part('带背筋馈源和低位安装脚的精神采集碟 ' + s,sp('satelliteDish_large'),[.64, .42, .59],[side * .94, -.40, .99],'scoop' + s,[0, 0, side * 14],'ivory'),side),
    handed(part('横向计量器的真实空心导筒 ' + s,sp('rocket_sidesA'),[.23, .23, .31],[side * .83, -.10, 1.09],'arm' + s,[0, -side * 90, 0],'metal'),side),
    handed(part('导筒内向中心抽取的计量芯 ' + s,sp('rocket_fuelA'),[.13, .13, .31],[side * .82, -.10, 1.09],'meter' + s,[0, -side * 90, 0],'gold'),side),
    handed(part('计量芯内端整环耦合阀 ' + s,sp('rocket_fuelB'),[.15, .15, .06],[side * .52, -.10, 1.09],'meter' + s,[0, -side * 90, 0],'accent'),side),
    handed(part('甲板后部横卧封闭账目储匣 ' + s,sp('rocket_fuelB'),[.27, .28, .50],[side * .51, .73, 1.03],'chassis',[90, 0, 0],'metal'),side),
    handed(part('计量储匣后置封边散热匣 ' + s,sp('machine_generator'),[.24, .28, .22],[side * .51, .71, .94],'vent' + s,[0, 0, 0],'metal'),side),
  );
}

for (const side of [-1, 1]) for (const [station, y] of [['F', -.50], ['A', .56]]) {
  const s = (side < 0 ? 'L' : 'R') + station, x = side * .67;
  rig.push(joint('nozzle' + s, [x, y, .45], 'chassis'));
  base.push(
    // These square castings are sockets; the actual four-ear rocket bases
    // provide the articulated thrust outlet. No casting is treated as a tyre.
    handed(part('腹部嵌入式方形推力套座 ' + s,sp('pipe_ringHigh'),[.28, .28, .13],[x, y, .42],'chassis',[0, 0, 0],'metal'),side),
    handed(part('四角独立矢量推力喷口 ' + s,sp('rocket_fuelB'),[.26, .26, .26],[x, y, .45],'nozzle' + s,[180, 0, 0],'metal'),side),
    handed(part('喷口内部小面积发光推力喉 ' + s,sp('rocket_topA'),[.09, .09, .04],[x, y, .21],'nozzle' + s,[180, 0, 0],'glow'),side),
  );
}

export default {
  id: 'spirit_taxer', kind: 'enemies', role: 'elite', locomotion: 'hover',
  rig, variants: { base },
  design: {
  polish: "完整艇壳作为唯一主体。采集臂采用连续承力壳，四角喷口使用一体管壁，储匣保留完整本体。鼻部叠加护脊、储匣扣片和喷口重复护唇已收掉，后舵独立安装。",
  assemblySymmetry: "双采集碟、臂座、内拉计量器、后储匣和四角喷口按真实 X 镜像安装。原有外展角与计量器轴向采用对应反射角。 左右结构保持对称。前鼻接触器、中央审计压机和后驱动盘按各自职责分层。",
    name: '精神税吏',
    silhouette: "宽体悬浮征收艇承载审计压机、双采集碟和并排账目储匣。",
    geometryEvidence: "完整飞行艇壳保留作为主体；连续承力臂、机腹承板或稳定舵使用登记的 corridor_wall；凹面碟、压机与捕获导筒保持完整源结构。喷口使用连续管壁。全部沿用登记的 Kenney CC0 素材。",
    loadPath: "完整艇壳作为唯一主体。采集臂采用连续承力壳，四角喷口使用一体管壁，储匣保留完整本体。鼻部叠加护脊、储匣扣片和喷口重复护唇已收掉，后舵独立安装。",
    articulation: '艇壳、审计环、压杆、压头、状态标尺、后偏心盘、两个采集臂/碟/计量芯/散热片、四个矢量喷口、尾舵及接触探杆/封印头，共21个关节。',
    locomotion: '实际air飞行，速度驱动前后喷口差异推力、尾舵和小角度艇身俯仰。moving独立于action，能力预警和持续抽取期间继续推进；机体高度固定，静止姿态稳定。',
    attack: '真实规则在抵达火种时每2.7秒持续突破。前鼻探杆回抽预载后完成前伸工作行程，封印头接触压缩，喷口制动后复位。计量和采集机构保留实际正在生效的腐蚀工作状态。',
    ability: 'corrode_resistance有1.1秒预警。释放即时征收2精神，并降低4抗性持续5秒；多名腐蚀来源叠加。预警展开双采集臂并上提审计压杆；释放计量芯内拉，压头下压。abilityActive/Elapsed/Remaining控制实际持续状态、偏心计量及结束前0.34秒回收。',
    damage: '受击由采集碟、审计架与压头小行程卸载，并由四角喷口差动修正。死亡关闭内拉阀，收拢采集臂，压杆泄压下落，尾舵和喷口停机；真实飞行高度落地由EntityRenderer承担。',
    surfaces: "模型共 45 件。双采集碟、臂座、内拉计量器、后储匣和四角喷口按真实 X 镜像安装。原有外展角与计量器轴向采用对应反射角。",
    review: '前上方检查开环孔和压杆、双碟与内拉计量芯；后上方检查双储匣、低机箱和偏心盘；腹侧检查四角套座和鼻部探杆导轨。比较预警末帧、释放初帧、持续0.18秒/2.5秒/尾段、施法移动、突破接触和死亡末帧。',
    sourceLicense: 'Kenney Space Kit CC0；原始网格和License.txt保留在development/assets/model_sources/kenney/space-kit。',
  },
};
