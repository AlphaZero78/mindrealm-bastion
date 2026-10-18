import {part,joint,sp,td,handed} from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up. A broad six-wheel chassis carries a short twin
// projector on a real traverse/elevation/recoil stack, with paired ranging ears.
const R=.36,depth=.23;
const stations=[-.73,.12,.97];
const rig=[
 joint('chassis',[0,.12,R]),
 joint('loadFrame',[0,.14,.63],'chassis'),
 joint('powerpack',[0,.76,.95],'loadFrame'),
 joint('turret',[0,.04,1.14],'loadFrame'),
 joint('elevation',[0,.12,1.44],'turret'),
 joint('recoil',[0,.12,1.44],'elevation'),
 joint('reticle',[0,-.49,1.77],'elevation'),
 joint('sensorMast',[0,.45,1.85],'turret'),
 joint('sensorL',[-.44,.45,2.08],'sensorMast'),
 joint('sensorR',[.44,.45,2.08],'sensorMast'),
 joint('feedL',[-.64,.30,1.48],'elevation'),
 joint('feedR',[.64,.30,1.48],'elevation'),
 joint('ventL',[-.48,.83,1.09],'powerpack'),
 joint('ventR',[.48,.83,1.09],'powerpack'),
 joint('braceL',[-.82,.12,.38],'chassis'),
 joint('braceR',[.82,.12,.38],'chassis'),
 ...[-1,1].flatMap(side=>stations.map((y,index)=>joint(`wheel${side<0?'L':'R'}${['F','M','R'][index]}`,[side*.91,y,R],'chassis'))),
];

const flanks=[-1,1].flatMap(side=>{
 const s=side<0?'L':'R';
 return [
  handed(part(`连续封闭纵向悬架梁 ${s}`,sp('corridor_wall'),[.24,1.78,.25],[side*.76,.12,.36],'chassis',[0,0,0],'metal'),side),
  handed(part(`连续轮上挡泥板 ${s}`,sp('corridor_wall'),[.26,2.25,.12],[side*.91,.12,.80],'chassis',[0,0,0],'armor'),side),
  handed(part(`水平截频蓄能匣 ${s}`,sp('rocket_fuelA'),[.25,.25,.66],[side*.64,.65,1.48],`feed${s}`,[90,0,0],'native'),side),
  handed(part(`后坐滑座下方包覆导向轨 ${s}`,sp('corridor_wall'),[.17,.86,.16],[side*.38,.06,1.32],'elevation',[0,0,0],'metal'),side),
  handed(part(`滑座前端双耳连接块 ${s}`,sp('rocket_baseB'),[.17,.20,.20],[side*.43,-.30,1.36],'recoil',[0,0,0],'metal'),side),
  handed(part(`带馈源和背筋的测距接收耳 ${s}`,sp('satelliteDish'),[.46,.39,.39],[side*.44,.45,2.08],`sensor${s}`,[0,0,side*8],'native'),side),
  handed(part(`测距耳双耳销座 ${s}`,sp('rocket_baseB'),[.20,.24,.17],[side*.44,.45,1.99],'sensorMast',[0,0,0],'metal'),side),
  handed(part(`后部封闭式蓄能散热匣 ${s}`,sp('machine_generator'),[.22,.44,.28],[side*.48,.83,.98],`vent${s}`,[0,0,0],'metal'),side),
  handed(part(`轮边制动支脚导向套 ${s}`,sp('rocket_sidesA'),[.23,.23,.42],[side*.82,.12,.22],'chassis',[0,0,0],'metal'),side),
  handed(part(`制动支脚伸缩芯 ${s}`,sp('rocket_fuelA'),[.15,.15,.42],[side*.82,.12,.10],`brace${s}`,[0,0,0],'metal'),side),
  handed(part(`制动支脚整面接地掌 ${s}`,sp('corridor_wall'),[.29,.46,.09],[side*.82,.10,.10],`brace${s}`,[0,0,0],'dark'),side),
 ];
});

const axles=stations.map((y,index)=>part(`贯穿车架的封闭轴座与差速桥 ${['前','中','后'][index]}`,sp('corridor_wall'),[1.80,.23,.22],[0,y,.30],'chassis',[0,0,0],'metal'));
const wheels=[-1,1].flatMap(side=>stations.flatMap((y,index)=>{
 const s=(side<0?'L':'R')+['F','M','R'][index];
 return [
  // Refined 64-segment contact rib. Uniform Y+90 puts every axle on X;
  // position is the transformed bottom-face origin, not the wheel centre.
  part(`圆弧倒角驱动轮 ${s}`,'refined/drive-wheel',[R*2,R*2,depth],[side*.91-depth/2,y,R],`wheel${s}`,[0,90,0],'native'),
 ];
}));

const base=[
 part('单层折边宽体承重机身',sp('corridor_wall'),[1.44,1.94,.45],[0,.18,.42],'loadFrame',[0,0,0],'armor'),
 part('后桥上方封闭传动箱',sp('machine_barrelLarge'),[.71,.61,.26],[0,.71,.47],'loadFrame',[0,0,0],'metal'),
 part('后部带散热筋的供能机组',sp('machine_generator'),[.70,.50,.55],[0,.76,.79],'powerpack',[0,0,0],'native'),
 part('前部整面防撞梁与炮架支座',sp('corridor_wall'),[.97,.28,.18],[0,-.92,.51],'loadFrame',[0,0,0],'armor'),
 part('炮塔下方整环承重座',sp('rocket_fuelB'),[.62,.62,.24],[0,.04,.94],'loadFrame',[0,0,0],'metal'),
 part('有面板接缝的八角回转轴承壳',sp('rocket_sidesA'),[.53,.53,.27],[0,.04,1.12],'turret',[0,0,0],'armor'),
 part('回转轴承侧置伺服传动盒',sp('machine_barrel'),[.25,.26,.34],[.48,.23,1.10],'turret',[0,0,0],'native'),
 part('俯仰轴两侧贯通的开框炮架',sp('supports_low'),[.98,.50,.30],[0,.12,1.25],'turret',[0,0,0],'metal'),
 part('短行程双联截频投射机匣',sp('turret_double'),[1.05,1.28,.63],[0,-.29,1.32],'recoil',[0,0,180],'native'),
 part('前向光学标尺的开框安装座',sp('supports_low'),[.38,.26,.18],[0,-.49,1.63],'elevation',[0,0,0],'metal'),
 part('前向窄窗锁定仪',sp('desk_computerScreen'),[.31,.16,.18],[0,-.49,1.77],'reticle',[0,0,0],'glow'),
 part('低壳带天线的测距信号箱',sp('machine_wireless'),[.40,.36,.54],[0,.49,1.64],'turret',[0,0,0],'native'),
 part('双测距耳下方封闭承重叉',sp('corridor_wall'),[.90,.28,.30],[0,.45,1.82],'sensorMast',[0,0,0],'metal'),
 part('测距箱底部独立供能接套',sp('rocket_fuelA'),[.22,.22,.37],[0,.50,1.32],'turret',[0,0,0],'gold'),
 ...flanks,...axles,...wheels,
];

export default {
 id:'frequency_hunter',kind:'enemies',role:'elite',locomotion:'crawler',rig,variants:{base},
 design:{
  polish: "单层折边机身承接三根轴桥。每侧一片整面挡泥板覆盖三轮上方，制动脚采用整面脚掌。炮塔环座、俯仰架与后坐导轨分层承重，蓄能匣保留独立工作空间。",
  assemblySymmetry: "测距耳、蓄能匣、挡泥板、导轨、散热器和制动脚均使用真实 X 镜像。左右静态角与源顶点反射对应，前后翼片合并为每侧一片护板。 炮塔右侧保留独立伺服传动盒，承担回转驱动；其余成对装配按左右镜像布置。",
  name:'截频猎手',
  silhouette: "宽体六轮猎车承载短双联炮、横向测距耳和轮边制动脚。",
  loadPath: "单层折边机身承接三根轴桥。每侧一片整面挡泥板覆盖三轮上方，制动脚采用整面脚掌。炮塔环座、俯仰架与后坐导轨分层承重，蓄能匣保留独立工作空间。",
  attack:'Ranging ears converge, the optical reticle settles and brake shoes plant. A short preload precedes a straight rearward twin-projector work stroke. Feed collars index and rear louvres open before the carriage and brakes return to transport position.',
  ability:'Gameplay owns 6-cell tower hunting, three-shot volleys and the following 2.5-second advance. Actual movement folds the ranging ears into transport, lifts the brake shoes and keeps all wheels distance-driven during attack or cast presentation. The optional cast pose prepares the ranging lock; it adds no combat pulse.',
  surfaces: "模型共 45 件。测距耳、蓄能匣、挡泥板、导轨、散热器和制动脚均使用真实 X 镜像。左右静态角与源顶点反射对应，前后翼片合并为每侧一片护板。",
  sources:'Registered Kenney Space Kit and Tower Defense Kit CC0 GLB. Source meshes and License.txt remain in development/assets/model_sources/kenney. Primary GLB topology was inspected locally before assembly.',
 },
};
