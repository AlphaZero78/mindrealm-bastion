import {part,joint,sp,td,handed} from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up; forward is -Y. Four broad feet carry a short
// platform. A high folded excavation boom carries a transverse ripper head.
const feet=[
 {id:'LF',x:-.84,y:-.60}, {id:'RR',x:.84,y:.60},
 {id:'RF',x:.84,y:-.60}, {id:'LR',x:-.84,y:.60},
];
const boomLength=Math.hypot(.39,.64),boomAngle=Math.atan2(.39,.64)*180/Math.PI;
const dipperLength=Math.hypot(.63,.87),dipperAngle=-Math.atan2(.63,.87)*180/Math.PI;
const rig=[
 joint('chassis',[0,.08,1.00]),
 joint('deck',[0,.08,1.08],'chassis'),
 ...feet.flatMap(({id,x,y})=>[
  joint('hip'+id,[x,y,1.00],'chassis'),
  joint('knee'+id,[x,y,.55],'hip'+id),
  joint('ankle'+id,[x,y,.10],'knee'+id),
 ]),
 joint('shroudL',[-.54,.38,1.08],'deck'),
 joint('shroudR',[.54,.38,1.08],'deck'),
 joint('sight',[.49,-.54,1.18],'deck'),
 joint('boom',[0,-.40,1.37],'deck'),
 joint('elbow',[0,-.79,2.01],'boom'),
 joint('wrist',[0,-1.42,1.14],'elbow'),
 joint('rotor',[0,-1.505,1.14],'wrist'),
];

const body=[
 part('single folded four-foot service deck',sp('corridor_wall'),[1.48,1.46,.31],[0,.08,.73],'chassis',[0,0,0],'armor'),
 ...[-.60,.60].map((y,index)=>part(`full-width enclosed ${index?'rear':'front'} torque beam`,sp('corridor_wall'),[1.90,.26,.24],[0,y,.85],'chassis',[0,0,0],'metal')),
 part('ribbed rear electromechanical powerpack',sp('machine_generatorLarge'),[1.03,.73,.43],[0,.36,1.035],'deck',[0,0,0],'native'),
 part('octagonal front boom bearing cradle',sp('gate_simple'),[.69,.26,.47],[0,-.40,1.14],'deck',[0,0,0],'metal'),
 ...[-1,1].flatMap((side,index)=>[
  handed(part(`sealed hydraulic reserve ${side<0?'left':'right'}`,sp('rocket_fuelA'),[.23,.23,.43],[side*.54,.38,1.08],'deck',[0,0,0],'gold'),side),
  handed(part(`liftable smooth sided coolant sleeve ${side<0?'left':'right'}`,sp('rocket_sidesA'),[.29,.33,.48],[side*.54,.38,1.06],index?'shroudR':'shroudL',[0,0,0],'metal'),side),
 ]),
 // This complete source is a low electronics case with its own aerial.
 part('rear radio and controller service case',sp('machine_wireless'),[.37,.34,.25],[.35,.74,1.04],'deck',[0,0,0],'dark'),
 part('protected side ranging display',sp('desk_computerScreen'),[.22,.10,.14],[.49,-.54,1.18],'sight',[0,0,0],'glow'),
];

const legs=feet.flatMap(({id,x,y})=>{
 const side=Math.sign(x);
 return [
  handed(part(`transverse hip bearing ${id}`,sp('pipe_ringHigh'),[.30,.30,.14],[x-side*.07,y,1.00],'hip'+id,[0,side*90,0],'metal'),side),
  handed(part(`captured upper leg protective sleeve ${id}`,sp('rocket_sidesA'),[.32,.30,.40],[x,y,.585],'hip'+id,[0,0,0],'armor'),side),
  handed(part(`enclosed knee bearing and wiper ${id}`,sp('rocket_fuelB'),[.27,.27,.16],[x-side*.08,y,.55],'knee'+id,[0,side*90,0],'gold'),side),
  handed(part(`guided lower servo and cylinder case ${id}`,sp('machine_barrelLarge'),[.25,.24,.45],[x,y,.10],'knee'+id,[0,0,0],'native'),side),
  handed(part(`ankle enclosed load socket ${id}`,sp('rocket_sidesA'),[.27,.24,.14],[x,y,.03],'ankle'+id,[0,0,0],'metal'),side),
  handed(part(`wide continuous ground shoe ${id}`,sp('corridor_wall'),[.40,.54,.14],[x,y-.025,0],'ankle'+id,[0,0,0],'armor'),side),
 ];
});

const excavation=[
 part('full-width shoulder reduction bearing',sp('pipe_ringHigh'),[.39,.39,.58],[-.29,-.40,1.37],'boom',[0,90,0],'gold'),
 // These angles and lengths meet the authored shoulder/elbow/wrist pivots.
 part('continuous captured boom armour sleeve',sp('rocket_sidesA'),[.49,.33,.69],[0,-.413,1.391],'boom',[boomAngle,0,0],'armor'),
 part('elbow geared transverse circular axle',td('tower-round-middle-a'),[.36,.36,.43],[-.215,-.79,2.01],'elbow',[0,90,0],'metal'),
 part('elbow enclosed torque motor case',sp('machine_barrelLarge'),[.34,.34,.20],[.215,-.79,2.01],'elbow',[0,90,0],'gold'),
 part('dipper captured rectangular service sleeve',sp('rocket_sidesA'),[.43,.32,.99],[0,-1.405,1.161],'elbow',[dipperAngle,0,0],'armor'),
 part('wrist transverse locking bearing',sp('pipe_ringHigh'),[.34,.34,.46],[-.23,-1.42,1.14],'wrist',[0,90,0],'gold'),
 part('forward enclosed cutter reduction case',sp('machine_barrelLarge'),[.46,.46,.33],[0,-1.115,1.14],'wrist',[90,0,0],'native'),
 // This measured twelve-sided disc is a tool rotor, driven about -Y.
 part('bevelled four-chisel rock cutter carrier',td('tower-round-middle-a'),[.70,.70,.15],[0,-1.43,1.14],'rotor',[90,0,0],'dark'),
 ...[[.26,0],[-.26,0],[0,.26],[0,-.26]].map(([x,z],index)=>
  handed(part(`replaceable short shouldered rock chisel ${index+1}`,sp('rocket_topB'),[.17,.17,.15],[x,-1.58,1.14+z],'rotor',[90,0,0],'armor'),x<0?-1:1)),
 part('square protected directional pressure aperture',sp('pipe_ringHigh'),[.21,.21,.08],[0,-1.59,1.14],'rotor',[90,0,0],'glow'),
];

export default {
 id:'terrain_dismantler',kind:'enemies',role:'elite',locomotion:'walker',rig,
 variants:{base:[...body,...legs,...excavation]},
 design:{
  polish: "折边平台连接前后扭矩横梁。脚掌采用完整接地面，腿套和折臂外壳直接承力，套壳内部的重复细框已收掉。肘部驱动机匣采用完整封边壳。",
  assemblySymmetry: "前后左右腿、液压储筒和冷却套按真实 X 镜像安装。刀盘左右切齿反射源几何，肩、肘、腕位置及四足承重点保持原值。 右侧保留测距窗、后控制机箱和肘部驱动机匣；这些单侧设备分别负责测距、控制和扭矩输入。",
  name:'地形拆解者',
  silhouette: "四足拆解平台以高折臂、前刀盘和四个宽脚掌形成轮廓。",
  loadPath: "折边平台连接前后扭矩横梁。脚掌采用完整接地面，腿套和折臂外壳直接承力，套壳内部的重复细框已收掉。肘部驱动机匣采用完整封边壳。",
  movement:'A four-phase crawl lifts one foot at a time. Each 0.45/0.45 leg uses solved hip/knee angles and an opposing ankle angle; stance displacement exactly cancels model-space travel. The suspended power deck shifts away from the swinging shoe.',
  attack:'The boom retracts the tool, the feet brace and the torque motor preloads. A downward cutting arc places the head, then four forged chisels index through the work sector. Terrain contact uses a deeper cut; construction attacks use the central directional pressure aperture. Wrist counter-rotation keeps the cutter axis controlled through the arm stroke.',
  ability:'The siege warning opens the coolant sleeves and primes the boom gearbox while feet can keep walking. Non-boss siege release only resets this preparation. Gameplay remains 3.6-cell construction targeting, triple terrain damage and 2.5 seconds of advance after three construction attacks; the elite keeps attacking after reaching the core.',
  death:'The four knees lose lift together while shoes stay flat. The low keel settles, pressure sleeves drop onto their stops, the boom folds down and the cutter coasts into its final indexed position. No complete body oscillation or wheel substitute is used.',
  surfaces: "模型共 48 件。前后左右腿、液压储筒和冷却套按真实 X 镜像安装。刀盘左右切齿反射源几何，肩、肘、腕位置及四足承重点保持原值。",
  sources:'Registered Kenney Space Kit and Tower Defense Kit CC0 GLB sources, inspected locally from the runtime L0 geometry. Original source meshes and License.txt remain in development/assets/model_sources/kenney/.',
 },
};
