import {part, joint, sp, handed} from '../../web-tools/enemy-model-authoring.mjs';

// The complete source wing carries one trailing flap on each side. Paired
// source meshes are mirrored locally; no duplicate wing-root frames remain.
function trailingSurface(side) {
  const key = side < 0 ? 'L' : 'R';
  const name = side < 0 ? '左' : '右';
  return handed(part(`${name}后掠翼单片后缘副翼`, sp('corridor_wall'), [.64,.26,.06],
    [side*.99,.43,.855], `flap${key}`, [0,0,side*18], 'armor'), side);
}

function rearOutlet(side) {
  const key = side < 0 ? 'L' : 'R';
  const name = side < 0 ? '左' : '右';
  return handed(part(`${name}尾部前推气流出口`, sp('pipe_ringHigh'), [.20,.17,.07],
    [side*.17,.80,.735], `tailVent${key}`, [-90,0,0], 'metal'), side);
}

const liftBlades = Array.from({length:4}, (_, index) => {
  const angle = index*Math.PI/2;
  return part(`腹中升力叶轮第 ${index+1} 片加工叶`, sp('corridor_wall'), [.16,.21,.025],
    [.11*Math.cos(angle), -.01+.11*Math.sin(angle), .415], 'liftRotor', [0,0,index*90], 'blade');
});

export default {
  id: 'echo_glider',
  kind: 'enemies',
  role: 'normal',
  locomotion: 'hover',
  rig: [
    joint('chassis', [0,.04,.79]),
    joint('flapL', [-.77,.29,.85], 'chassis'),
    joint('flapR', [.77,.29,.85], 'chassis'),
    joint('elevator', [0,.73,.89], 'chassis'),
    joint('rudder', [0,.76,.92], 'chassis'),
    joint('tailVentL', [-.17,.80,.735], 'chassis'),
    joint('tailVentR', [.17,.80,.735], 'chassis'),
    joint('liftVector', [0,-.01,.62], 'chassis'),
    joint('liftRotor', [0,-.01,.425], 'liftVector'),
    joint('sensor', [0,-.78,.875], 'chassis'),
    joint('echoL', [-.31,.45,1.045], 'chassis'),
    joint('echoR', [.31,.45,1.045], 'chassis'),
    joint('echoLift', [0,.46,1.18], 'chassis'),
    joint('echoRotor', [0,.46,1.345], 'echoLift'),
    joint('attackSled', [0,-.77,.655], 'chassis'),
    joint('contactTip', [0,-1.18,.655], 'attackSled'),
  ],
  variants: {
    base: [
      part('完整宽幅三角滑翔主翼壳', sp('craft_speederB'), [2.65,1.75,.18], [0,.025,.68], 'chassis', [0,0,180], 'armor'),
      part('从鼻部连续到尾部的背脊机身', sp('craft_racer'), [.80,1.67,.28], [0,-.02,.76], 'chassis', [0,0,180], 'native'),
      part('鼻端导航与编队识别狭窗机箱', sp('desk_computerScreen'), [.28,.105,.14], [0,-.815,.82], 'sensor', [0,0,180], 'glow'),
      trailingSurface(-1),
      trailingSurface(1),
      part('尾部单片折边升降舵', sp('corridor_wall'), [.44,.25,.05], [0,.81,.89], 'elevator', [0,0,0], 'armor'),
      part('尾部短偏航舵', sp('corridor_wall'), [.10,.25,.19], [0,.78,.91], 'rudder', [0,0,0], 'metal'),
      part('尾部前推气流压缩机', sp('machine_generator'), [.35,.32,.145], [0,.67,.66], 'chassis', [0,0,0], 'metal'),
      rearOutlet(-1),
      rearOutlet(1),

      part('腹中升力单元的固定承肩', sp('pipe_ringHigh'), [.64,.54,.10], [0,-.01,.58], 'chassis', [0,0,0], 'metal'),
      part('腹中连续矢量升力整流出口', sp('rocket_fuelB'), [.56,.46,.23], [0,-.01,.62], 'liftVector', [180,0,0], 'metal'),
      part('升力出口的环形耐热护唇', sp('rocket_fuelA'), [.49,.42,.05], [0,-.01,.385], 'liftVector', [0,0,0], 'dark'),
      part('升力叶轮的轴心整流帽', sp('rocket_topA'), [.095,.095,.04], [0,-.01,.445], 'liftRotor', [180,0,0], 'gold'),
      ...liftBlades,

      part('双回声阵列共用的单片承台', sp('corridor_wall'), [.76,.34,.09], [0,.45,1.00], 'chassis', [0,0,0], 'metal'),
      handed(part('左侧带背筋和馈源的回声阵列', sp('satelliteDish_detailed'), [.43,.34,.43], [-.31,.45,1.045], 'echoL', [0,0,-40], 'ivory'), -1),
      handed(part('右侧带背筋和馈源的回声阵列', sp('satelliteDish_detailed'), [.43,.34,.43], [.31,.45,1.045], 'echoR', [0,0,40], 'ivory'), 1),
      part('阵列中心同步芯的加长空心导筒', sp('rocket_sidesA'), [.22,.22,.27], [0,.46,1.075], 'chassis', [0,0,0], 'metal'),
      part('始终捕获于导筒内的升降同步芯', sp('rocket_fuelA'), [.115,.115,.30], [0,.46,1.10], 'echoLift', [0,0,0], 'glow'),
      part('回声信道环形同步凸轮', sp('rocket_fuelB'), [.21,.21,.06], [0,.46,1.32], 'echoRotor', [0,0,0], 'accent'),

      part('接触探杆的加长空心捕获导筒', sp('rocket_sidesA'), [.17,.17,.36], [0,-.70,.655], 'chassis', [90,0,0], 'dark'),
      part('沿导筒前伸的轴向接触探杆', sp('rocket_fuelA'), [.09,.09,.41], [0,-.77,.655], 'attackSled', [90,0,0], 'gold'),
      part('突破接触时压缩的短探头', sp('rocket_topA'), [.13,.12,.075], [0,-1.18,.655], 'contactTip', [90,0,0], 'blade'),
    ],
  },
  design: {
    silhouette: '完整宽幅三角翼、单条窄背脊和双回声阵列。腹中保留一个主升力出口，尾部保留单片升降舵与短偏航舵。',
    loadPath: '完整主翼直接承载背脊和两片后缘副翼。腹中环形承肩连接升力出口，单片背部承台连接回声阵列和同步导筒。',
    attack: '鼻下探杆沿原捕获导筒回抽、前伸和压缩；原接触关节与动作行程保持原值。',
    ability: '双阵列展开、同步芯升降和凸轮旋转沿用原 haste 状态；移动和升力动作保持独立。',
    materials: '43 件收为 27 件。删除腹部叠壳、翼根多层套架、尾桥、重复小供能机、装饰镜片与喷口内芯。副翼、尾舵、承台和叶轮使用单片折边源；左右副翼、尾出口与双阵列执行源网格 X 镜像。',
    source: 'Kenney Space Kit CC0；原始网格与 License.txt 保留在 development/assets/model_sources/kenney/space-kit/。',
    partCount: 27,
  },
};
