import {part, joint, sp, td, handed} from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up. Four captured knee linkages support one continuous
// factory hull. Source bottoms, rather than bounding-box centres, are mounted.
const HIP_Z=.84, KNEE_Z=.46, ANKLE_Z=.12;
const UPPER=Math.hypot(.18,HIP_Z-KNEE_Z);
const LOWER=Math.hypot(.225,KNEE_Z-ANKLE_Z);
const UPPER_ANGLE=Math.atan2(.18,HIP_Z-KNEE_Z)*180/Math.PI;
const LOWER_ANGLE=-Math.atan2(.225,KNEE_Z-ANKLE_Z)*180/Math.PI;
const legs=[
 {id:'FL',side:-1,y:-.55}, {id:'FR',side:1,y:-.55},
 {id:'RL',side:-1,y:.55}, {id:'RR',side:1,y:.55},
];
const rig=[
 joint('chassis',[0,0,HIP_Z]),
 joint('punch',[0,-.84,1.03],'chassis'),
 joint('governor',[-.30,.40,1.33],'chassis'),
 joint('clutch',[.30,.40,1.33],'chassis'),
 joint('ventL',[-.54,.34,1.17],'chassis'),
 joint('ventR',[.54,.34,1.17],'chassis'),
];
for(const {id,side,y}of legs){
 const x=side*.57;
 rig.push(joint('hip'+id,[x,y,HIP_Z],'chassis'));
 rig.push(joint('knee'+id,[x,y+.18,KNEE_Z],'hip'+id));
 rig.push(joint('ankle'+id,[x,y-.045,ANKLE_Z],'knee'+id));
}

const base=[
 part('单层四髋承重底框',sp('corridor_wall'),[1.10,1.18,.18],[0,0,.76],'chassis',[0,0,0],'metal'),
 part('连续工厂突击装甲壳与原生检修边',sp('craft_cargoA'),[1.10,1.52,.38],[0,0,.86],'chassis',[0,0,180],'armor'),
 part('背部冲刺驱动电机与成型支座',sp('machine_generator'),[.44,.47,.32],[0,.40,1.15],'chassis',[0,0,180],'native'),
 handed(part('左侧外露调速飞轮',td('tower-round-middle-a'),[.34,.34,.11],[-.245,.40,1.33],'governor',[0,-90,0],'gold'),-1),
 handed(part('右侧储能离合飞轮',td('tower-round-middle-a'),[.34,.34,.11],[.245,.40,1.33],'clutch',[0,90,0],'metal'),1),
 handed(part('左侧单片铰接散热护盖',sp('corridor_wall'),[.12,.45,.25],[-.54,.34,1.06],'ventL',[0,0,0],'metal'),-1),
 handed(part('右侧单片铰接散热护盖',sp('corridor_wall'),[.12,.45,.25],[.54,.34,1.06],'ventR',[0,0,0],'metal'),1),
 part('受装甲肩保护的前向测距屏',sp('desk_computerScreen'),[.34,.18,.19],[0,-.61,1.13],'chassis',[0,0,0],'glow'),
 part('向前开口的八角液压导套',sp('rocket_fuelA'),[.34,.34,.37],[0,-.62,1.03],'chassis',[90,0,0],'gold'),
 part('与活塞同轴的宽短冲头',sp('corridor_wall'),[.62,.26,.19],[0,-1.005,.935],'punch',[0,0,0],'blade'),
 part('贯穿导套的捕获式内活塞',sp('rocket_fuelA'),[.25,.12,.57],[0,-.445,1.03],'punch',[90,0,0],'metal'),
];

for(const {id,side,y}of legs){
 const x=side*.57,footY=y-.045;
 base.push(
  handed(part(id+'环形髋轴承夹座',sp('rocket_fuelA'),[.23,.23,.12],[x-side*.06,y,HIP_Z],'chassis',[0,side*90,0],'metal'),side),
  handed(part(id+'封闭股部承重护套',sp('rocket_sidesA'),[.22,.21,UPPER],[x,y+.18,KNEE_Z],'hip'+id,[UPPER_ANGLE,0,0],'metal'),side),
  handed(part(id+'外露圆形膝轴承与固定端面',td('tower-round-middle-a'),[.20,.20,.11],[x-side*.055,y+.18,KNEE_Z],'knee'+id,[0,side*90,0],'gold'),side),
  handed(part(id+'封闭胫部导向承重护套',sp('rocket_sidesA'),[.18,.17,LOWER],[x,footY,ANKLE_Z],'knee'+id,[LOWER_ANGLE,0,0],'metal'),side),
  handed(part(id+'单片折边抓地跑鞋',sp('corridor_wall'),[.26,.43,.105],[x,footY-.02,.012],'ankle'+id,[0,0,side*180],'dark'),side),
 );
}

export default {
 id:'memory_runner',kind:'enemies',role:'normal',locomotion:'runner',rig,variants:{base},
 design:{
  name:'记忆赶工者',
  silhouette:'连续低胸装甲壳、背部驱动电机、双侧同形飞轮和宽短冲头，由四条封闭膝式步足承载。',
  loadPath:'单层底框与完整装甲壳连接四个髋轴承；每腿依次保留股套、膝轴、胫套和一块抓地跑鞋。',
  locomotion:'原四足行程驱动、髋膝踝逆解及足底接地坐标保持原值。',
  attack:'宽短冲头与捕获活塞同轴，沿原液压导套执行前推、回抽和复位。',
  ability:'sprint 原预警、离合预紧、压低胸壳、散热盖开启和持续冲刺动作沿用现有定义。',
  death:'原膝关节屈曲、护盖卸载及冲头下倾保持原值。',
  materials:'42 件收为 31 件。删除后置重复压力罐、冲头叠架、前置小镜片以及每腿的侧导筒和踝夹圈。成对飞轮、护盖及全部步足采用源网格 X 镜像，轮廓和轴向安装一致。',
  sources:'Kenney Space Kit 和 Tower Defense Kit CC0；原始网格与许可证保留于 development/assets/model_sources/kenney/。',
  partCount:31,
 },
};
