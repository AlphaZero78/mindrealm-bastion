import {part,joint,sp,handed} from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up; -Y is forward. This is a shielded RF cabinet on
// six separate axles, with a captive crown that opens through real bearings.
const rig = [
  joint('chassis', [0, 0, .36]),
  joint('rfCase', [0, .03, .57], 'chassis'),
  joint('mast', [0, -.11, 1.95], 'rfCase'),
  joint('rotor', [0, -.11, 2.16], 'mast'),
  joint('panelL', [-.36, -.11, 2.03], 'mast'),
  joint('panelR', [.36, -.11, 2.03], 'mast'),
  joint('panelF', [0, -.27, 2.03], 'mast'),
  joint('ventL', [-.47, .52, 1.10], 'rfCase'),
  joint('ventR', [.47, .52, 1.10], 'rfCase'),
  joint('striker', [0, -.88, .46], 'chassis'),
  joint('driveL', [-.72, 0, .26], 'chassis'),
  joint('driveR', [.72, 0, .26], 'chassis'),
];
for (const side of [-1, 1]) {
  const suffix = side < 0 ? 'L' : 'R';
  for (const [station, y] of [['F', -.64], ['M', 0], ['R', .64]]) {
    rig.push(joint('wheel' + suffix + station, [side * .82, y, .26], 'chassis'));
  }
}

const base = [
  part('单片折边承重底盘',sp('corridor_wall'),[1.36,1.70,.28],[0,0,.30],'chassis',[0,0,0],'metal'),
  part('单体射频屏蔽机柜',sp('machine_generatorLarge'),[.98,.97,.94],[0,-.02,.57],'rfCase',[0,0,0],'armor'),
  part('中央升降轴固定导套',sp('machine_barrelLarge'),[.37,.37,.62],[0,-.11,1.42],'rfCase',[0,0,0],'metal'),
  part('捕获式干扰供能轴芯',sp('rocket_fuelB'),[.17,.17,.48],[0,-.11,1.65],'mast',[0,0,0],'gold'),
  part('阵列共用的单片承台',sp('corridor_wall'),[.80,.28,.14],[0,-.11,1.97],'mast',[0,0,0],'metal'),
  part('环形旋转频率驱动头',sp('rocket_fuelA'),[.23,.23,.15],[0,-.11,2.07],'rotor',[0,0,0],'glow'),
  part('底盘内的固定液压撞杆套',sp('machine_barrelLarge'),[.21,.21,.59],[0,-.36,.46],'chassis',[90,0,0],'metal'),
  part('捕获式撞杆活塞',sp('rocket_fuelA'),[.11,.11,.64],[0,-.40,.46],'striker',[90,0,0],'gold'),
  part('单片宽短接触撞头',sp('corridor_wall'),[.62,.30,.20],[0,-.98,.34],'striker',[0,0,0],'armor'),
];

for(const side of [-1,1]){
 const suffix=side<0?'L':'R';
 base.push(
  handed(part('单根下承重纵梁 '+suffix,sp('corridor_wall'),[.18,1.66,.20],[side*.64,0,.26],'chassis',[0,0,0],'metal'),side),
  handed(part('轮桥终传动鼓 '+suffix,sp('rocket_fuelB'),[.22,.22,.24],[side*.60,0,.26],'drive'+suffix,[0,side*90,0],'metal'),side),
  handed(part('机柜后侧散热门 '+suffix,sp('corridor_wall'),[.13,.38,.39],[side*.47,.52,.84],'vent'+suffix,[0,0,0],'metal'),side),
  handed(part('侧阵列单体轴套 '+suffix,sp('rocket_sidesA'),[.18,.18,.26],[side*.36,-.11,2.03],'panel'+suffix,[0,0,0],'metal'),side),
  handed(part('带原生馈源的侧向接收阵列 '+suffix,sp('satelliteDish_detailed'),[.39,.28,.41],[side*.36,-.11,2.14],'panel'+suffix,[0,0,-side*90],'native'),side),
 );
 for(const [station,y]of [['F',-.64],['M',0],['R',.64]]){
  const id=suffix+station;
  base.push(part('独立轴心驱动轮 '+id,'refined/drive-wheel',[.52,.52,.20],[side*.82-.10,y,.26],'wheel'+id,[0,90,0],'native'));
 }
}
base.push(
 part('前阵列单体轴套',sp('rocket_sidesA'),[.18,.18,.26],[0,-.27,2.03],'panelF',[0,0,0],'metal'),
 part('带原生馈源的前向接收阵列',sp('satelliteDish_detailed'),[.43,.26,.40],[0,-.30,2.14],'panelF',[0,0,0],'native'),
);

export default {
 id:'bandwidth_jammer',kind:'enemies',role:'normal',locomotion:'crawler',rig,variants:{base},
 design:{
  name:'带宽干扰体',
  silhouette:'六轮低底盘承载单体屏蔽机柜，顶端三片接收阵列组成独立冠部。',
  loadPath:'六轮→两根下承梁→单片底盘→单体机柜→捕获导套与单片承台→三片阵列。',
  attack:'撞杆套收在底盘内，活塞与宽短撞头保留原前伸、接触和复位动作。',
  ability:'原 1.1 秒预警、降低 2 点带宽、持续 3 秒及三片阵列展开动作保持。',
  refinement:'38→27 件。删除压扁货船肩壳、重复顶部肩盖、后置小供能箱、轮侧第二层护板、前撞杆底托和独立阵列饰环。左右纵梁、驱动鼓、散热门、轴套和碟面均采用真正 X 镜像，车轮及 rig 原位。',
  partCount:27,
  sources:'Registered Kenney CC0 meshes and the shared refined drive wheel; original sources and licenses retained.',
 },
};
