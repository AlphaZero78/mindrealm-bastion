import {part, joint, sp, handed} from '../../web-tools/enemy-model-authoring.mjs';

// Each nacelle is carried by the same transverse web as the central fuselage.
// The intake stays fixed; only its impeller and the bearing-mounted exit move.
function nacelle(side) {
  const suffix = side < 0 ? 'L' : 'R';
  const label = side < 0 ? '左' : '右';
  const x = side * .57;
  const parts = [
    part(`${label}连续涵道整流壳`, sp('rocket_sidesA'), [.55,.63,.25], [x,.10,.53], 'chassis', [0,0,0], 'armor'),
    part(`${label}真实开孔的倒角进气护环`, sp('rocket_sidesA'), [.58,.58,.075], [x,.10,.77], 'chassis', [0,0,0], 'metal'),
    part(`${label}圆肩定子承轴桥`, sp('rocket_fuelB'), [.43,.10,.065], [x,.10,.805], 'chassis', [0,0,0], 'dark'),
    part(`${label}叶轮轴心整流帽`, sp('rocket_topA'), [.12,.12,.06], [x,.10,.82], `rotor${suffix}`, [0,0,0], 'gold'),
  ];
  for (let i = 0; i < 3; i++) {
    const angle = i * 120;
    const a = angle * Math.PI / 180;
    parts.push(part(`${label}涵道叶轮第${i+1}叶`, sp('rocket_finsB'), [.215,.095,.035],
      [x + .10*Math.cos(a), .10 + .10*Math.sin(a), .82],
      i === 2 ? `brokenBlade${suffix}` : `rotor${suffix}`, [0,0,angle], 'blade'));
  }
  parts.push(
    part(`${label}矢量喷口固定肩环`, sp('pipe_ring'), [.33,.33,.08], [x,.10,.60], 'chassis', [0,0,0], 'metal'),
    part(`${label}矢量喷口外侧耳轴`, sp('pipe_ringHigh'), [.18,.18,.07], [x+side*.165,.10,.59], 'chassis', [0,side*90,0], 'gold'),
    part(`${label}万向收敛喷口`, sp('rocket_baseB'), [.31,.32,.22], [x,.10,.62], `nozzle${suffix}`, [180,0,0], 'metal'),
    part(`${label}喷口耐热出口唇`, sp('pipe_ringHigh'), [.27,.27,.075], [x,.10,.405], `nozzle${suffix}`, [0,0,0], 'dark'),
    part(`${label}喷口内燃烧喉`, sp('rocket_fuelA'), [.145,.155,.028], [x,.10,.41], `nozzle${suffix}`, [0,0,0], 'glow'),
  );
  // Rotor phase and each broken-blade hinge retain their independent timing.
  // The paired fixed ducts and vector-thrust mounts use exact X reflection.
  return parts.map(piece => /^(rotor|brokenBlade)/.test(piece.joint) ? piece : handed(piece, side));
}

export default {
  id: 'floating_noise',
  kind: 'enemies',
  role: 'normal',
  locomotion: 'hover',
  rig: [
    joint('chassis', [0,.10,.73]),
    joint('rotorL', [-.57,.10,.835], 'chassis'),
    joint('brokenBladeL', [-.5875,.0697,.835], 'rotorL'),
    joint('rotorR', [.57,.10,.835], 'chassis'),
    joint('brokenBladeR', [.5525,.0697,.835], 'rotorR'),
    joint('nozzleL', [-.57,.10,.62], 'chassis'),
    joint('nozzleR', [.57,.10,.62], 'chassis'),
    joint('sensor', [0,-.80,.945], 'chassis'),
    joint('rudder', [0,.78,.86], 'chassis'),
    joint('ram', [0,-.76,.565], 'chassis'),
    joint('ramTip', [0,-1.15,.55], 'ram'),
  ],
  variants: {
    base: [
      part('前后连续飞行机身', sp('craft_speederB'), [.82,1.88,.34], [0,-.035,.63], 'chassis', [0,0,180], 'native'),
      part('后背双涵道供能机', sp('machine_generator'), [.40,.48,.19], [0,.39,.90], 'chassis', [0,0,0], 'gold'),
      part('左右涵道单层承载梁壳', sp('corridor_wall'), [1.05,.27,.15], [0,.10,.625], 'chassis', [0,0,0], 'metal'),
      part('前向传感器固定轴座', sp('pipe_ring'), [.24,.24,.075], [0,-.77,.945], 'chassis', [90,0,0], 'metal'),
      part('窄面定向传感器外壳', sp('desk_computerScreen'), [.33,.115,.17], [0,-.845,.86], 'sensor', [0,0,0], 'dark'),
      part('火种导航狭缝镜头', sp('rocket_topB'), [.16,.115,.04], [0,-.92,.945], 'sensor', [90,0,0], 'glow'),
      part('尾舵固定铰链座', sp('supports_low'), [.40,.20,.09], [0,.78,.80], 'chassis', [0,0,0], 'metal'),
      part('尾部偏航稳定舵面', sp('corridor_wall'), [.10,.30,.27], [0,.82,.86], 'rudder', [0,0,0], 'armor'),
      part('尾舵根部密封驱动套', sp('machine_barrel'), [.15,.18,.21], [0,.79,.86], 'rudder', [0,0,0], 'metal'),
      part('供能机腹侧冷却器', sp('machine_barrelLarge'), [.16,.14,.22], [0,.52,.71], 'chassis', [0,0,0], 'metal'),
      ...nacelle(-1),
      ...nacelle(1),
      part('腹前触针单层固定导套', sp('machine_barrel'), [.25,.25,.60], [0,-.31,.565], 'chassis', [90,0,0], 'armor'),
      part('触针导向环与止挡', sp('pipe_ringHigh'), [.23,.23,.055], [0,-.86,.565], 'chassis', [90,0,0], 'gold'),
      part('触针滑动机芯与缓冲座', sp('machine_generator'), [.28,.28,.105], [0,-.76,.49], 'ram', [0,0,0], 'metal'),
      part('轴向接触探杆', sp('rocket_fuelA'), [.09,.09,.48], [0,-.68,.55], 'ram', [90,0,0], 'metal'),
      part('火种近接触针头', sp('rocket_topB'), [.16,.16,.19], [0,-1.15,.55], 'ramTip', [90,0,0], 'blade'),
    ],
  },
  design: {
    silhouette: '长轴窄机身、贴合侧壳的双涵道和腹前触针。背部进气口与底部矢量喷口构成可读的气流路径。',
    loadPath: '完整机身壳承载触针固定导套，横向梁壳承载两侧涵道。喷口肩环、外耳轴和收敛喷口构成转动支承。',
    attack: '喷口先制动，触针回缩蓄势；机身短距俯冲、探杆沿固定导套推出，针头接触后压缩并复位。',
    ability: 'air 是持续飞行。cast 预览只校准传感器与喷口，保持自身悬停；战斗中的实际攻击是抵达火种后的单次接触突破。',
    materials: '建筑共用的 Kenney CC0 加工网格。涵道采用单层梁壳，尾舵使用独立舵面和根部驱动套，触针使用固定导套与工作杆。叶轮、燃烧喉与狭缝镜头保持清晰。',
    source: 'Kenney Space Kit CC0；源网格与许可证位于 development/assets/model_sources/kenney/space-kit/。',
    symmetry: '左右固定涵道、进气环、定子桥和喷口使用真实反射。叶轮保留各自相位、反向转动与断叶关节绑定。删除脊部空环、第二层龙骨、腹下小环和三重触针护片；保留一个梁壳、一个固定导套和工作探杆。',
    partCount: 39,
  },
};
