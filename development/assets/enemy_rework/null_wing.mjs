import {part, joint, sp, handed} from '../../web-tools/enemy-model-authoring.mjs';

// Registered craft noses point +Y. The continuous patrol hull faces -Y.
// The four short vector nozzles carry the hull; the dorsal radio deck is
// captured on a telescopic spindle and carries three separate RF paddles.
const lifts = [
  {id:'LF',x:-.47,y:-.47}, {id:'RF',x:.47,y:-.47},
  {id:'LR',x:-.47,y:.49}, {id:'RR',x:.47,y:.49},
];
const channels = [
  {id:'L',x:-.27,y:-.11}, {id:'R',x:.27,y:-.11},
  {id:'C',x:0,y:.38},
];
const rig = [
  joint('chassis',[0,.025,.83]),
  joint('trimL',[-.57,.51,.885],'chassis'),
  joint('trimR',[.57,.51,.885],'chassis'),
  joint('rudder',[0,.88,.97],'chassis'),
  joint('sensor',[0,-.87,.93],'chassis'),
  ...lifts.map(({id,x,y})=>joint('vector'+id,[x,y,.59],'chassis')),
  joint('radioDeck',[0,.08,1.11],'chassis'),
  ...channels.map(({id,x,y})=>joint('array'+id,[x,y,1.225],'radioDeck')),
  joint('tuner',[0,.07,1.24],'radioDeck'),
  joint('contactRam',[0,-.86,.81],'chassis'),
  joint('contactTip',[0,-1.235,.81],'contactRam'),
];

const base = [
  part('鼻尾连续的窄长巡航主壳',sp('craft_racer'),[1.06,2.32,.29],[0,.025,.66],'chassis',[0,0,180],'armor'),
  part('尾部推进供压机与原生管线',sp('machine_generator'),[.42,.43,.23],[0,.73,.835],'chassis',[0,0,180],'native'),
  part('前鼻队列接收机与导航天线',sp('machine_wireless'),[.24,.22,.20],[0,-.87,.87],'sensor',[0,0,180],'native'),
];

for (const side of [-1,1]) {
  const id=side<0?'L':'R';
  base.push(
    handed(part('机壳侧肩单片短翼 '+id,sp('craft_speederB'),[.50,.70,.10],[side*.52,.16,.78],'chassis',[0,0,side*180],'ivory'),side),
    handed(part('短翼后缘单片制动副翼 '+id,sp('corridor_wall'),[.34,.31,.065],[side*.57,.65,.885],'trim'+id,[0,0,0],'armor'),side),
  );
}

base.push(
  part('机尾单片短稳定舵',sp('corridor_wall'),[.14,.28,.20],[0,.94,.97],'rudder',[0,0,0],'armor'),
);

for (const {id,x,y} of lifts) {
  const side=Math.sign(x);
  base.push(
    handed(part('升力点 '+id+' 的环形推力肩框',sp('rocket_fuelB'),[.30,.30,.18],[x,y,.55],'chassis',[0,0,0],'metal'),side),
    handed(part('升力点 '+id+' 的连续矢量喷口',sp('rocket_fuelB'),[.24,.24,.22],[x,y,.59],'vector'+id,[180,0,0],'metal'),side),
  );
}

base.push(
  part('广播升降主轴的加长空心捕获套',sp('rocket_sidesA'),[.28,.28,.25],[0,.08,.935],'chassis',[0,0,0],'metal'),
  part('留在捕获套内的广播升降主轴',sp('rocket_fuelA'),[.16,.16,.29],[0,.08,.98],'radioDeck',[0,0,0],'gold'),
  part('广播三信道共用的单片承载平台',sp('corridor_wall'),[.80,.88,.115],[0,.08,1.11],'radioDeck',[0,0,0],'metal'),
);

for (const {id,x,y} of channels) {
  const side=id==='L'?-1:1;
  base.push(
    handed(part('广播信道 '+id+' 的封闭射频面板',sp('corridor_wall'),[.34,.10,.53],[x,y,1.225],'array'+id,[0,0,0],'ivory'),side),
    handed(part('广播信道 '+id+' 背部无线机箱与馈源',sp('machine_wireless'),[.27,.14,.39],[x,y+.064,1.265],'array'+id,[0,0,side*180],'native'),side),
  );
}

base.push(
  part('平台中心三信道环形调谐凸轮',sp('rocket_fuelB'),[.25,.25,.065],[0,.07,1.215],'tuner',[0,0,0],'accent'),
  part('接触杆前向加长空心捕获导筒',sp('rocket_sidesA'),[.19,.19,.48],[0,-.72,.81],'chassis',[90,0,0],'dark'),
  part('沿导筒前伸的火种接触杆',sp('rocket_fuelA'),[.10,.10,.40],[0,-.86,.81],'contactRam',[90,0,0],'gold'),
  part('接触杆端部的可压缩短触帽',sp('rocket_topA'),[.16,.15,.095],[0,-1.235,.81],'contactTip',[90,0,0],'blade'),
);

export default {
  id:'null_wing',kind:'enemies',role:'normal',locomotion:'hover',
  rig,variants:{base},
  design:{
    name:'缄默巡翼',
    silhouette:'单个窄长巡航机壳、两片短翼、四路矢量喷口和背上三片广播面板。原侧面板外展、后面板后展的三信道轮廓保留。',
    geometryEvidence:'完整 craft_racer 提供连续机壳，craft_speederB 用于两片短翼。单片 corridor_wall 构成副翼、尾舵、承台和射频面板；无线机箱留在各面板背面。',
    loadPath:'四个环形推力肩框直接承载主机壳。升降主轴与捕获套连接单层广播平台，三片面板的根部直接落在平台顶面。短翼贴入机壳侧肩，副翼从其后缘延伸。',
    locomotion:'原四路喷口差动、短翼制动、尾舵调平以及移动施法保持原关节和动作。',
    attack:'原接触杆回抽、前伸、触帽压缩与复位保持原值；加长导筒覆盖活动杆尾部。',
    ability:'原 jam 预警升平台和展开三片面板，释放时短行程下压并转动调谐凸轮；持续广播与到期复位沿用现有状态。',
    damage:'原面板卸载、升降平台回落及四路喷口失锁保持原值；共享渲染器负责飞行下降。',
    review:'重点查看左右短翼和双侧面板的镜像细节、广播平台全抬起时的导筒重叠、四个喷口与主机壳的连接以及接触杆最大前伸。',
    materials:'44 件收为 29 件。删除腹部重复龙骨、背部叠壳、两根多片横桥、三类舵面装饰座、四枚喷口内芯、三枚阵列铰圈和鼻下叠架。左右短翼、副翼、升力组件和双侧阵列执行源网格 X 镜像。',
    sourceLicense:'Kenney Space Kit CC0；原始网格与 License.txt 保留于 development/assets/model_sources/kenney/space-kit/。',
    partCount:29,
  },
};
