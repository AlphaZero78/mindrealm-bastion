import {part, joint, sp, handed} from '../../web-tools/enemy-model-authoring.mjs';

// All pivots and mounting positions are in the model's global rest coordinates.
// X points right, -Y is forward, Z points up. The long links meet their bearings.
const upper = Math.hypot(.24, .42);
const lower = Math.hypot(.22, .36);
const thighAngle = -Math.atan2(.24, .42) * 180 / Math.PI;
const calfAngle = Math.atan2(.22, .36) * 180 / Math.PI;

function leg(side) {
  const suffix = side < 0 ? 'L' : 'R';
  const x = side * .52;
  const hip = `hip${suffix}`, knee = `knee${suffix}`;
  const ankle = `ankle${suffix}`, toe = `toe${suffix}`;
  const label = side < 0 ? '左' : '右';
  return [
    part(`${label}髋轴承与外侧法兰`, sp('pipe_ring'), [.24,.24,.14], [x-side*.07,.12,.92], hip, [0,side*90,0], 'metal'),
    part(`${label}股部封闭承重筒`, sp('machine_barrel'), [.18,.17,upper], [x,-.12,.50], hip, [thighAngle,0,0], 'metal'),
    part(`${label}股部前缘护壳`, sp('rocket_sidesA'), [.27,.21,.39], [x,-.12,.50], hip, [thighAngle,0,0], 'armor'),
    part(`${label}膝轴承`, sp('pipe_ringHigh'), [.22,.22,.12], [x-side*.06,-.12,.50], knee, [0,side*90,0], 'metal'),
    part(`${label}胫部圆肩承重壳`, sp('rocket_fuelB'), [.19,.17,lower], [x,.10,.14], knee, [calfAngle,0,0], 'armor'),
    part(`${label}腱式蓄能筒`, sp('machine_barrel'), [.10,.12,.34], [x+side*.12,.09,.17], knee, [calfAngle,0,0], 'gold'),
    part(`${label}踝轴承`, sp('pipe_ring'), [.17,.17,.09], [x-side*.045,.10,.14], ankle, [0,side*90,0], 'metal'),
    part(`${label}平底跑鞋与抓地底`, sp('corridor_wall'), [.28,.50,.11], [x,-.04,.025], ankle, [0,0,0], 'armor'),
    part(`${label}可屈曲圆肩前掌`, sp('rocket_fuelB'), [.28,.25,.06], [x,-.24,.025], toe, [0,0,0], 'metal'),
    part(`${label}后跟制动块`, sp('machine_barrel'), [.16,.18,.09], [x,.22,.03], ankle, [0,0,0], 'dark'),
  ].map(piece => handed(piece, side));
}

export default {
  id: 'spike_runner',
  kind: 'enemies',
  role: 'normal',
  locomotion: 'runner',
  rig: [
    joint('chassis', [0,.12,.92]),
    joint('ram', [0,-.49,.86], 'chassis'),
    joint('governor', [0,.41,1.08], 'chassis'),
    joint('latch', [0,.43,1.06], 'chassis'),
    joint('brakeL', [-.46,.37,.91], 'chassis'),
    joint('brakeR', [.46,.37,.91], 'chassis'),
    joint('hipL', [-.52,.12,.92], 'chassis'),
    joint('kneeL', [-.52,-.12,.50], 'hipL'),
    joint('ankleL', [-.52,.10,.14], 'kneeL'),
    joint('toeL', [-.52,-.22,.07], 'ankleL'),
    joint('hipR', [.52,.12,.92], 'chassis'),
    joint('kneeR', [.52,-.12,.50], 'hipR'),
    joint('ankleR', [.52,.10,.14], 'kneeR'),
    joint('toeR', [.52,-.22,.07], 'ankleR'),
  ],
  variants: {
    base: [
      part('连续楔形胸壳', sp('craft_racer'), [1.04,1.34,.36], [0,-.015,.78], 'chassis', [0,0,180], 'native'),
      part('髋横梁与腹部承重壳', sp('corridor_wall'), [.86,.31,.14], [0,.16,.70], 'chassis', [0,0,0], 'metal'),
      part('背部液压蓄能机', sp('machine_generator'), [.43,.38,.20], [0,.40,.94], 'chassis', [0,0,0], 'gold'),
      part('蓄能机调速离合环', sp('pipe_ringHigh'), [.29,.25,.07], [0,.41,1.08], 'governor', [0,0,0], 'metal'),
      part('储能释放锁扣', sp('rocket_sidesA'), [.21,.34,.12], [0,.44,1.06], 'latch', [0,0,0], 'accent'),
      handed(part('左散热制动板', sp('corridor_wall'), [.09,.33,.20], [-.46,.37,.91], 'brakeL', [0,-12,0], 'metal'), -1),
      part('右散热制动板', sp('corridor_wall'), [.09,.33,.20], [.46,.37,.91], 'brakeR', [0,12,0], 'metal'),
      part('前向地形测距器', sp('desk_computerScreen'), [.23,.115,.135], [0,-.51,1.08], 'chassis', [0,0,0], 'dark'),
      part('测距器狭缝镜头', sp('rocket_topA'), [.12,.055,.065], [0,-.584,1.11], 'chassis', [90,0,0], 'glow'),
      part('双刺固定导轨罩', sp('corridor_wall'), [.46,.41,.16], [0,-.48,.78], 'chassis', [0,0,0], 'armor'),
      part('双刺活动冲锤座', sp('rocket_fuelB'), [.42,.32,.145], [0,-.64,.81], 'ram', [0,0,0], 'metal'),
      handed(part('左刺封闭滑动导套', sp('rocket_fuelB'), [.125,.125,.52], [-.18,-.20,.86], 'chassis', [90,0,0], 'metal'), -1),
      part('右刺封闭滑动导套', sp('rocket_fuelB'), [.125,.125,.52], [.18,-.20,.86], 'chassis', [90,0,0], 'metal'),
      handed(part('左刺导轨轴套', sp('pipe_ringHigh'), [.17,.17,.075], [-.18,-.66,.86], 'chassis', [90,0,0], 'gold'), -1),
      part('右刺导轨轴套', sp('pipe_ringHigh'), [.17,.17,.075], [.18,-.66,.86], 'chassis', [90,0,0], 'gold'),
      handed(part('左前冲刺尖', sp('rocket_topB'), [.135,.135,.50], [-.18,-.69,.86], 'ram', [90,0,0], 'blade'), -1),
      part('右前冲刺尖', sp('rocket_topB'), [.135,.135,.50], [.18,-.69,.86], 'ram', [90,0,0], 'blade'),
      ...leg(-1),
      ...leg(1),
    ],
  },
  design: {
    silhouette: '低重心楔形双足冲刺体。前方双刺、长胫腱和后跟制动跟可从轮廓辨认。',
    loadPath: '胸壳经髋横梁压到髋轴承、股部密封筒、膝轴承、胫部圆肩壳和跑鞋。腱式蓄能筒沿胫壳布置。',
    attack: '冲锤座沿双导轨收缩蓄势，再把双刺向前推出。固定轴套始终留在胸壳上。',
    ability: 'sprint 预警压缩支撑腿并打开储能锁扣；释放后拉长步幅，前掌蹬伸，后跟负责制动。',
    materials: '复用建筑同一批带加工倒角的 CC0 网格。股胫密封壳、腱筒导套和圆肩制动瓣收顺连接；前方双刺保留完整尖端和实际工作行程。',
    source: 'Kenney Space Kit CC0；源文件与许可证保留在 development/assets/model_sources/kenney/space-kit/。',
    symmetry: '左右步足、双刺与制动板采用真实反射。轴承中心回到髋膝踝 pivot。删去重复腱筒导套与腹下小护靴，保留独立前掌、制动跟和双刺行程。',
    partCount: 37,
  },
};
