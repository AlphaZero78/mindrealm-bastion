import {part,joint,sp,handed} from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up. All six wheels turn around a real X axle;
// the suspended load frame can compress without translating their contacts.
const rig=[
 joint('chassis',[0,.14,.40]),
 joint('loadFrame',[0,.12,.55],'chassis'),
 joint('powerpack',[0,.66,.78],'loadFrame'),
 ...[-1,1].flatMap(side=>[-.66,.16,.98].map((y,index)=>joint(`wheel${side<0?'L':'R'}${['F','M','R'][index]}`,[side*.86,y,.31],'chassis'))),
 joint('braceL',[-.73,-.52,.62],'chassis'),
 joint('braceR',[.73,-.52,.62],'chassis'),
 joint('shoeL',[-.73,-.85,.09],'braceL'),
 joint('shoeR',[.73,-.85,.09],'braceR'),
 joint('ram',[0,.02,1.04],'loadFrame'),
 joint('preloadL',[-.49,.43,1.03],'loadFrame'),
 joint('preloadR',[.49,.43,1.03],'loadFrame'),
 joint('flywheel',[.35,.70,1.14],'powerpack'),
 joint('ventL',[-.50,.70,1.05],'powerpack'),
 joint('ventR',[.50,.70,1.05],'powerpack'),
 joint('sight',[0,-.57,1.23],'loadFrame'),
];

const flanks=[-1,1].flatMap(side=>{
 const suffix=side<0?'L':'R';
 return [
  handed(part(`single lower suspension beam ${suffix}`,sp('corridor_wall'),[.20,1.98,.20],[side*.65,.16,.29],'chassis',[0,0,0],'metal'),side),
  handed(part(`single upper ram guide ${suffix}`,sp('corridor_wall'),[.20,1.38,.18],[side*.46,-.15,.91],'loadFrame',[0,0,0],'metal'),side),
  handed(part(`hydraulic accumulator sleeve ${suffix}`,sp('machine_barrel'),[.22,.22,.69],[side*.49,.76,1.03],'loadFrame',[90,0,0],'native'),side),
  handed(part(`accumulator preload collar ${suffix}`,sp('rocket_fuelB'),[.28,.28,.08],[side*.49,.43,1.03],`preload${suffix}`,[90,0,0],'gold'),side),
  handed(part(`recoil brace strut ${suffix}`,sp('rocket_sidesA'),[.21,.22,.57],[side*.73,-.52,.62],`brace${suffix}`,[156,0,0],'metal'),side),
  handed(part(`compact recoil brace shoe ${suffix}`,sp('corridor_wall'),[.28,.36,.105],[side*.73,-.85,.09],`shoe${suffix}`,[0,0,0],'armor'),side),
  handed(part(`flush powerpack cooling door ${suffix}`,sp('corridor_wall'),[.12,.35,.25],[side*.50,.70,.94],`vent${suffix}`,[0,side*8,0],'metal'),side),
 ];
});

const wheels=[-1,1].flatMap(side=>[-.66,.16,.98].map((y,index)=>{
 const suffix=(side<0?'L':'R')+['F','M','R'][index];
 return part(`bevelled solid drive wheel ${suffix}`,'refined/drive-wheel',[.62,.62,.22],[side*.86-.11,y,.31],`wheel${suffix}`,[0,90,0],'native');
}));

const base=[
 part('single folded siege chassis',sp('corridor_wall'),[1.44,2.02,.30],[0,.12,.35],'loadFrame',[0,0,0],'armor'),
 part('raised continuous hydraulic bed',sp('corridor_wall'),[.98,1.15,.28],[0,-.15,.62],'loadFrame',[0,0,0],'dark'),
 part('single rear hydraulic powerpack',sp('machine_generatorLarge'),[1.00,.68,.61],[0,.67,.68],'powerpack',[0,0,0],'native'),
 ...flanks,
 ...wheels,
 part('central hydraulic cylinder',sp('machine_barrelLarge'),[.37,.37,.85],[0,.65,1.04],'loadFrame',[90,0,0],'native'),
 part('guided telescoping ram shaft',sp('rocket_fuelA'),[.20,.20,.98],[0,.28,1.04],'ram',[90,0,0],'metal'),
 part('single sliding ram crosshead',sp('corridor_wall'),[.91,.16,.23],[0,.02,.925],'ram',[0,0,0],'gold'),
 part('forged flared impact hammer',sp('rocket_baseB'),[.87,.56,.27],[0,-.70,1.04],'ram',[90,0,0],'armor'),
 part('front shaft guide sleeve',sp('rocket_sidesA'),[.31,.31,.43],[0,-.25,1.04],'loadFrame',[90,0,0],'metal'),
 part('traction timing flywheel',sp('rocket_fuelA'),[.36,.36,.08],[.30,.70,1.14],'flywheel',[0,90,0],'gold'),
 part('protected forward ranging sight',sp('desk_computerScreen'),[.25,.16,.17],[0,-.57,1.23],'sight',[0,0,0],'glow'),
];

export default {
 id:'siege_ram',kind:'enemies',role:'normal',locomotion:'crawler',rig,variants:{base},
 design:{
  name:'攻城冲锤',
  silhouette:'六轮低底盘、抬高的液压工作床、双导轨冲锤和后置动力盒。',
  loadPath:'六轮→每侧一根下承梁→单片底盘→连续液压床→双导轨、蓄能筒与冲锤。左右斜撑和宽鞋承担接触反力。',
  attack:'原预拉、前冲、接触和复位行程保留，支撑鞋与压力套环继续按原关节工作。',
  ability:'保留 3.6 格攻城、3 倍地形伤害及三次攻击后的推进表现。',
  refinement:'38→30 件。删除三根压扁货船横轴、独立变速箱、前后门框、斜坡横梁、前端小发光框和飞轮小饰件。一个连续液压床承担原多框架的连接。所有成对非轮部件使用 handed，主轮与 rig 坐标保持原值。',
  partCount:30,
  sources:'Registered Kenney CC0 meshes and the shared refined drive wheel; original sources and licenses retained.',
 },
};
