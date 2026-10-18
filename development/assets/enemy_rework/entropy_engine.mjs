import {part,joint,sp,td,handed} from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up. The asymmetric single cannon has a separate sliding
// cradle. A three-chamber rotary magazine loads it over a diagonal lift rail.
const radius=.32,depth=.22,stations=[-.69,.06,.81];
const drumPivot=[.61,.40,1.56];
const rig=[
 joint('chassis',[0,.06,radius]),
 joint('loadFrame',[0,.10,.59],'chassis'),
 joint('powerpack',[-.22,.84,1.00],'loadFrame'),
 joint('cannonCradle',[-.28,-.27,1.06],'loadFrame'),
 joint('recoil',[-.28,-.28,1.79],'cannonCradle'),
 joint('muzzle',[-.28,-.780,1.793],'recoil'),
 joint('sight',[-.28,-.48,2.04],'recoil'),
 joint('drum',drumPivot,'loadFrame'),
 joint('shuttle',[.38,.15,1.43],'loadFrame'),
 joint('indexDrive',[.61,.77,1.56],'loadFrame'),
 joint('loaderSight',[.90,.10,1.88],'loadFrame'),
 ...[-1,1].flatMap(side=>[
  joint(`brace${side<0?'L':'R'}`,[side*.62,-.46,.55],'chassis'),
  joint(`shoe${side<0?'L':'R'}`,[side*.62,-.46,.11],`brace${side<0?'L':'R'}`),
  joint(`vent${side<0?'L':'R'}`,[side*.42,.84,1.03],'powerpack'),
 ]),
 ...[-1,1].flatMap(side=>stations.map((y,i)=>joint(`wheel${side<0?'L':'R'}${i}`,[side*.88,y,radius],'chassis'))),
];

const flanks=[-1,1].flatMap(side=>{
 const s=side<0?'L':'R';
 return [
  handed(part(`贯通三轮轴的封闭承重梁 ${s}`,sp('corridor_wall'),[.21,1.78,.23],[side*.66,.06,.35],'chassis',[0,0,0],'metal'),side),
  handed(part(`三轮上方整面挡泥板 ${s}`,sp('corridor_wall'),[.24,1.74,.13],[side*.88,.06,.70],'chassis',[0,0,0],'armor'),side),
  handed(part(`车内侧制动撑脚导向套 ${s}`,sp('rocket_sidesA'),[.23,.24,.38],[side*.62,-.46,.34],'chassis',[0,0,0],'metal'),side),
  handed(part(`制动撑脚抛光伸缩芯 ${s}`,sp('rocket_fuelA'),[.13,.13,.55],[side*.62,-.46,.11],`brace${s}`,[0,0,0],'metal'),side),
  handed(part(`制动撑脚整面接地掌 ${s}`,sp('corridor_wall'),[.25,.42,.09],[side*.62,-.46,.11],`shoe${s}`,[0,0,0],'dark'),side),
  handed(part(`动力舱铰接封边散热匣 ${s}`,sp('machine_generator'),[.19,.33,.25],[side*.42,.84,.96],`vent${s}`,[0,0,0],'metal'),side),
 ];
});

const wheels=[-1,1].flatMap(side=>stations.map((y,i)=>
 part(`倒角圆弧实心轮 ${side<0?'L':'R'}${i}`,'refined/drive-wheel',[radius*2,radius*2,depth],[side*.88-depth/2,y,radius],`wheel${side<0?'L':'R'}${i}`,[0,90,0],'native')
));
const axles=stations.map((y,i)=>part(`贯穿轮梁的差速轴桥 ${i}`,sp('corridor_wall'),[1.72,.21,.21],[0,y,.30],'chassis',[0,0,0],'metal'));

// Every cartridge is rotated with its radial station. A 120-degree index
// therefore ends in a geometrically identical rest pose, including the bands.
const cartridges=[0,120,240].flatMap((degrees,i)=>{
 const a=degrees*Math.PI/180,x=drumPivot[0]+.27*Math.sin(a),z=drumPivot[2]+.27*Math.cos(a);
 return [
  part(`三工位八角穿甲弹套 ${i}`,sp('rocket_fuelB'),[.23,.23,.54],[x,.665,z],'drum',[90,degrees,0],'native'),
 ];
});

const base=[
 part('单层折边短宽装甲机身',sp('corridor_wall'),[1.48,1.87,.39],[0,.10,.48],'loadFrame',[0,0,0],'armor'),
 part('前缘整面防撞梁',sp('corridor_wall'),[.99,.25,.18],[0,-.94,.53],'loadFrame',[0,0,0],'armor'),
 part('偏置供能机组与成型散热筋',sp('machine_generatorLarge'),[.86,.55,.43],[-.22,.84,.82],'powerpack',[0,0,180],'native'),
 part('单管炮架下方捕获式承重座',sp('rocket_fuelB'),[.72,.52,.19],[-.28,-.27,.83],'loadFrame',[0,0,0],'metal'),
 part('炮架底部封闭贯通横梁',sp('corridor_wall'),[.98,.56,.21],[-.28,-.27,1.00],'cannonCradle',[0,0,0],'metal'),
 // Local topology inspection places the actual source muzzle at
 // [0,-.481,.719]. Its source already points toward authored -Y.
 part('带真实炮管俯仰耳和底座的单管穿甲炮',td('weapon-cannon'),[.96,1.04,.88],[-.28,-.28,1.16],'recoil',[0,0,0],'native'),
 part('炮口方形聚束及卸压唇',sp('pipe_ring'),[.31,.32,.04],[-.28,-.774,1.793],'muzzle',[90,0,0],'glow'),
 part('炮顶独立窄窗测距仪',sp('desk_computerScreen'),[.23,.13,.16],[-.28,-.48,2.04],'sight',[0,0,0],'glow'),
 handed(part('左侧炮架包覆后坐导轨',sp('corridor_wall'),[.15,1.04,.14],[-.66,-.21,1.025],'cannonCradle',[0,0,0],'metal'),-1),
 handed(part('右侧炮架包覆后坐导轨',sp('corridor_wall'),[.15,1.04,.14],[.10,-.21,1.025],'cannonCradle',[0,0,0],'metal'),1),
 handed(part('左侧带接口的后坐制退筒',sp('machine_barrel'),[.21,.21,.43],[-.73,.06,1.25],'cannonCradle',[90,0,0],'native'),-1),
 handed(part('右侧带接口的后坐制退筒',sp('machine_barrel'),[.21,.21,.43],[.17,.06,1.25],'cannonCradle',[90,0,0],'native'),1),
 handed(part('左侧制退筒滑动芯杆',sp('rocket_fuelA'),[.105,.105,.36],[-.73,-.08,1.25],'recoil',[90,0,0],'metal'),-1),
 handed(part('右侧制退筒滑动芯杆',sp('rocket_fuelA'),[.105,.105,.36],[.17,-.08,1.25],'recoil',[90,0,0],'metal'),1),
 part('从弹匣到炮闩的斜向升降导轨',sp('rocket_sidesA'),[.19,.24,.73],[.38,.15,1.40],'loadFrame',[0,-60,0],'metal'),
 part('斜导轨上双耳托弹滑台',sp('rocket_baseB'),[.27,.33,.17],[.38,.15,1.43],'shuttle',[0,0,0],'gold'),
 part('托弹滑台上的方形闭锁舌',sp('barrel'),[.20,.28,.09],[.38,.12,1.60],'shuttle',[0,0,0],'metal'),
 part('三工位弹匣下方连续托座',sp('corridor_wall'),[.86,.60,.23],[.61,.40,1.04],'loadFrame',[0,0,0],'metal'),
 part('弹匣后轴承固定立座',sp('rocket_sidesA'),[.24,.23,.39],[.61,.74,1.19],'loadFrame',[0,0,0],'metal'),
 part('弹匣前轴承固定立座',sp('rocket_sidesA'),[.24,.23,.39],[.61,.055,1.19],'loadFrame',[0,0,0],'metal'),
 part('弹匣后端十二边旋转捕获盘',td('tower-round-middle-a'),[.83,.83,.065],[.61,.73,1.56],'drum',[90,0,0],'dark'),
 part('弹匣前端连续固定捕获护环',sp('rocket_sidesA'),[.81,.81,.07],[.61,.135,1.56],'loadFrame',[90,0,0],'metal'),
 part('分度器的四耳偏心驱动凸轮',sp('rocket_baseA'),[.29,.29,.065],[.61,.805,1.56],'indexDrive',[90,0,0],'gold'),
 part('弹匣侧置分度伺服传动壳',sp('machine_barrel'),[.20,.20,.28],[1.07,.60,1.33],'loadFrame',[0,0,0],'native'),
 part('弹匣上沿装填锁定观察窗',sp('desk_computerScreen'),[.18,.12,.17],[.90,.10,1.88],'loaderSight',[0,0,0],'glow'),
 ...cartridges,...flanks,...axles,...wheels,
];

export default {
 id:'entropy_engine',kind:'enemies',role:'elite',locomotion:'crawler',rig,variants:{base},
 design:{
  polish: "主底盘、挡泥板、制动脚掌和防撞梁采用整面构件。重复腹框、隐藏传动块和三枚弹套扣箍已收掉。炮座、后坐导轨与弹匣托座分层承重，前捕获护环保留。",
  assemblySymmetry: "左右轮边构件按车体中心真实反射。双制退筒、芯杆和后坐轨围绕炮轴 X=-0.28 形成对应镜像，三工位弹匣按原有 120° 分度排列。 左偏火炮、右后三工位弹匣、斜向送料与偏置动力包具有明确供弹和后坐职责，保持原布局。",
  name:'熵蚀攻城机',
  silhouette: "六轮攻城机以左偏单管炮、右后三工位弹匣和斜向送料轨形成非对称炮车。",
  loadPath: "主底盘、挡泥板、制动脚掌和防撞梁采用整面构件。重复腹框、隐藏传动块和三枚弹套扣箍已收掉。炮座、后坐导轨与弹匣托座分层承重，前捕获护环保留。",
  attack:'The real hit starts the muzzle relief stroke and rearward cannon recoil. The recoil cylinders absorb it, the frame compresses, the threefold magazine indexes one station, and the diagonal shuttle transfers a cartridge to the breech before returning home. The drive cam completes a closed revolution. Each shot ends in a preloaded fixed pose.',
  ability:'The gameplay retains 4.4-cell single-target siege fire, 30% armour penetration, triple terrain damage and 2.5 seconds of advance after three shots. The non-boss siege warning prepares pressure and feed interlocks. Movement lifts the shoes and keeps wheels driven by travel even during a warning; a siege warning release closes interlocks.',
  surfaces: "模型共 49 件。左右轮边构件按车体中心真实反射。双制退筒、芯杆和后坐轨围绕炮轴 X=-0.28 形成对应镜像，三工位弹匣按原有 120° 分度排列。",
  sources:'Kenney Space Kit and Tower Defense Kit CC0 GLB assets registered in models.json. Original licensed meshes remain in development/assets/model_sources/kenney. Actual LOD1 topology and orthographic source profiles were inspected locally before assembly.',
 },
};
