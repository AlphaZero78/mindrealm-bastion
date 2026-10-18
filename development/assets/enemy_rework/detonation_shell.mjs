import {part,joint,sp,td,handed} from '../../web-tools/enemy-model-authoring.mjs';

// A pressure caisson carried on four real X-axis wheels. The complete round
// hangar cover opens on its rear cross-axis; both bearings share that axis.
const rig = [
  joint('chassis', [0, .04, .26]),
  joint('caisson', [0, .04, .53], 'chassis'),
  joint('lid', [0, .61, .77], 'caisson'),
  joint('pressureCore', [0, .04, .85], 'caisson'),
  joint('controller', [0, .39, .86], 'pressureCore'),
  joint('gearbox', [0, .70, .40], 'chassis'),
  joint('sensor', [0, -.73, .73], 'caisson'),
  joint('ram', [0, -.50, .49], 'caisson'),
];
for (const side of [-1, 1]) {
  const id = side < 0 ? 'L' : 'R';
  rig.push(
    joint('wheel' + id + 'F', [side * .77, -.54, .26], 'chassis'),
    joint('wheel' + id + 'R', [side * .77, .62, .26], 'chassis'),
    joint('latch' + id, [side * .52, -.25, .79], 'caisson'),
    joint('vent' + id, [side * .25, -.10, 1.095], 'pressureCore'),
  );
}

const base=[
 part('single folded pressure cart chassis',sp('corridor_wall'),[1.28,1.60,.24],[0,.04,.32],'caisson',[0,0,0],'armor'),
 part('single reinforced lower pressure cup',td('tower-round-bottom-c'),[1.16,1.38,.29],[0,.04,.45],'caisson',[0,0,0],'metal'),
 part('continuous rounded pressure cover',sp('hangar_roundB'),[1.28,1.46,.70],[0,.04,.69],'lid',[0,0,0],'armor'),
 part('compact rear traction enclosure',sp('corridor_wall'),[.54,.28,.20],[0,.70,.34],'gearbox',[0,0,0],'metal'),
 part('inner pressure storage sleeve',sp('rocket_fuelB'),[.61,.66,.36],[0,.04,.74],'pressureCore',[0,0,0],'gold'),
 part('pressure distributor cap',sp('rocket_topB'),[.61,.66,.18],[0,.04,1.10],'pressureCore',[0,0,0],'metal'),
 part('single pressure telemetry controller',sp('machine_wireless'),[.30,.23,.29],[0,.39,.85],'controller',[0,0,0],'native'),
 part('flush front pressure status visor',sp('desk_computerScreen'),[.29,.13,.15],[0,-.66,.66],'sensor',[0,0,0],'glow'),
 part('front contact cylinder',sp('machine_barrelLarge'),[.24,.24,.62],[0,-.19,.49],'caisson',[90,0,0],'native'),
 part('captured contact piston',sp('rocket_fuelA'),[.12,.12,.42],[0,-.50,.49],'ram',[90,0,0],'metal'),
 part('shallow contact cap',sp('rocket_topA'),[.46,.33,.14],[0,-.82,.49],'ram',[90,0,0],'armor'),
];
for(const side of [-1,1]){
 const id=side<0?'L':'R';
 base.push(
  handed(part('single lower suspension rail '+id,sp('corridor_wall'),[.20,1.50,.20],[side*.58,.04,.28],'chassis',[0,0,0],'metal'),side),
  handed(part('rear cover hinge load shoulder '+id,sp('rocket_sidesA'),[.21,.29,.28],[side*.42,.60,.51],'caisson',[0,0,0],'metal'),side),
  handed(part('round cover hinge bearing '+id,sp('rocket_fuelA'),[.20,.20,.08],[side*.38,.61,.77],'caisson',[0,side*90,0],'gold'),side),
  handed(part('single captured side lock '+id,sp('corridor_wall'),[.16,.24,.14],[side*.55,-.25,.76],'latch'+id,[0,0,0],'gold'),side),
  handed(part('relief valve body '+id,sp('machine_barrel'),[.13,.13,.235],[side*.25,-.10,.86],'pressureCore',[0,0,0],'native'),side),
  handed(part('captured relief poppet '+id,sp('rocket_topA'),[.16,.16,.11],[side*.25,-.10,1.095],'vent'+id,[0,0,0],'gold'),side),
 );
 for(const [suffix,y]of [['F',-.54],['R',.62]]){
  base.push(part('bevelled round traction wheel '+id+suffix,'refined/drive-wheel',[.52,.52,.17],[side*.77-.085,y,.26],'wheel'+id+suffix,[0,90,0],'native'));
 }
}

export default {
 id:'detonation_shell',kind:'enemies',role:'normal',locomotion:'crawler',rig,variants:{base},
 design:{
  name:'爆裂外壳',
  silhouette:'低四轮底盘、圆形下舱和单个完整拱盖；开盖后显示一个压力芯及成对泄压阀。',
  loadPath:'四轮→两根下纵梁→单片底盘→压力杯。后侧双肩和圆轴座直接承托盖缘，锁块位于杯盖接缝。',
  attack:'前短接触帽与捕获活塞保留原预载、接触和回程。',
  ability:'真实死亡首帧解锁、抬阀和开盖，随后保留原卸压与下沉动作；普通突破保持闭盖离场。',
  refinement:'40→27 件。删除压扁横轴与内底托、盖侧重复扭矩臂、侧锁外框、压力芯方框、外露控制细管、额外调压箱和传感器护框。传感器收回杯壁，左右纵梁、铰座、锁块和阀体采用 handed。主轮及全部 rig 原位。',
  partCount:27,
  sources:'Registered Kenney CC0 meshes and the shared refined drive wheel; original sources and licenses retained.',
 },
};
