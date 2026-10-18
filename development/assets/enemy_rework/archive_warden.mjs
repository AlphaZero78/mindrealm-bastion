import {part,joint,sp,td,handed} from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up, front -Y. The gate, sealed archive and pump stand
// on a sprung saddle. The six equal contact rims have independent axle rigs.
const R=.31, DEPTH=.18, AXLE_X=.93;
const rig=[
 joint('chassis',[0,0,R]),
 joint('vaultSaddle',[0,.03,.60],'chassis'),
 joint('doorL',[-.54,-.915,1.35],'vaultSaddle'),
 joint('doorR',[.54,-.915,1.35],'vaultSaddle'),
 joint('shieldPress',[0,-.96,1.32],'vaultSaddle'),
 joint('indexCam',[0,-1.055,1.90],'vaultSaddle'),
 joint('pump',[0,.68,1.43],'vaultSaddle'),
 joint('receiver',[0,.08,1.87],'vaultSaddle'),
 joint('heatL',[-.36,.76,.97],'vaultSaddle'),
 joint('heatR',[.36,.76,.97],'vaultSaddle'),
 joint('contactRam',[0,-.71,.61],'chassis'),
];
for(const side of [-1,1])for(const [index,y]of [-.72,0,.72].entries())
 rig.push(joint('wheel'+(side<0?'L':'R')+index,[side*AXLE_X,y,R],'chassis'));

const base=[
 part('single folded six wheel archive load deck',sp('corridor_wall'),[1.60,1.84,.28],[0,0,.26],'chassis',[0,0,180],'dark'),
 part('sprung archive transverse saddle with integral feet',sp('gate_simple'),[1.34,1.27,.14],[0,.03,.55],'vaultSaddle',[0,0,0],'gold'),
 part('single sealed faceted archive vault and curved roof',sp('hangar_roundA'),[1.12,1.12,1.23],[0,.07,.64],'vaultSaddle',[0,0,0],'armor'),
 part('complete octagonal front security gate and load sill',sp('gate_complex'),[1.27,.30,1.46],[0,-.62,.57],'vaultSaddle',[0,0,0],'metal'),
 part('rear ribbed archive charge power cabinet',sp('machine_generatorLarge'),[.71,.42,.59],[0,.68,.67],'vaultSaddle',[0,0,180],'native'),
 part('fixed square pump foot pressure manifold',sp('pipe_ring'),[.35,.35,.12],[0,.68,1.22],'vaultSaddle',[0,0,0],'metal'),
 part('open octagonal charge pump guide sleeve',sp('rocket_sidesA'),[.28,.28,.46],[0,.68,1.19],'vaultSaddle',[0,0,0],'dark'),
 part('captured charge pump working tube',sp('rocket_fuelA'),[.15,.15,.49],[0,.68,1.40],'pump',[0,0,0],'gold'),
 part('charge pump faceted retention and relief cap',sp('rocket_topB'),[.25,.25,.11],[0,.68,1.80],'pump',[0,0,0],'accent'),
 part('roof protected archive sequencing receiver',sp('machine_wireless'),[.28,.29,.20],[0,.08,1.84],'receiver',[0,0,180],'native'),
 part('receiver seated roof load bracket',sp('corridor_wall'),[.40,.27,.13],[0,.08,1.74],'vaultSaddle',[0,0,0],'metal'),
 handed(part('left enclosed heat discharge cassette',sp('machine_generator'),[.24,.36,.34],[-.36,.76,.97],'heatL',[0,0,0],'metal'),-1),
 handed(part('right enclosed heat discharge cassette',sp('machine_generator'),[.24,.36,.34],[.36,.76,.97],'heatR',[0,0,0],'metal'),1),
 part('front contact fixed flanged octagonal sleeve',sp('rocket_sidesA'),[.28,.28,.54],[0,-.42,.61],'chassis',[90,0,0],'metal'),
 part('front captured telescoping contact tube',sp('rocket_fuelA'),[.15,.15,.65],[0,-.52,.61],'contactRam',[90,0,0],'gold'),
 part('wide continuous warder contact plate',sp('corridor_wall'),[.94,.35,.28],[0,-1.02,.47],'contactRam',[0,0,180],'armor'),
 handed(part('left front contact enclosed rail cradle',sp('corridor_wall'),[.20,.60,.14],[-.34,-.68,.48],'chassis',[0,0,0],'metal'),-1),
 handed(part('right front contact enclosed rail cradle',sp('corridor_wall'),[.20,.60,.14],[.34,-.68,.48],'chassis',[0,0,0],'metal'),1),
 // rocket_baseA supplies a four-ear lock bearing; its axle is along Y.
 part('central captured four ear shield press bearing',sp('rocket_baseA'),[.32,.32,.13],[0,-.96,1.32],'vaultSaddle',[90,0,0],'gold'),
 part('central open annular shield pressure chamber',sp('rocket_fuelB'),[.24,.24,.27],[0,-.93,1.32],'shieldPress',[90,0,0],'dark'),
 part('central faceted forward shield working electrode',sp('rocket_topB'),[.22,.22,.08],[0,-1.14,1.32],'shieldPress',[90,0,0],'glow'),
 part('captured archive index cam axial drive tube',sp('rocket_fuelA'),[.13,.13,.21],[0,-.87,1.90],'indexCam',[90,0,0],'metal'),
 part('visible four ear archive index cam above security leaves',sp('rocket_baseA'),[.25,.25,.07],[0,-1.02,1.90],'indexCam',[90,0,0],'gold'),
];

for(const side of [-1,1]){
 const id=side<0?'L':'R';
 base.push(
  handed(part('fixed enclosed security leaf hinge post '+id,sp('corridor_wall'),[.19,.21,.96],[side*.54,-.915,.83],'vaultSaddle',[0,0,0],'metal'),side),
  handed(part('upper axial captured security hinge '+id,sp('rocket_fuelB'),[.19,.19,.08],[side*.54,-.915,1.75],'vaultSaddle',[0,0,0],'gold'),side),
  handed(part('machined thick edged archive security leaf '+id,sp('corridor_wall'),[.36,.13,.94],[side*.36,-.915,.88],'door'+id,[0,0,0],'ivory'),side),
  handed(part('leaf mounted stepped captive latch '+id,sp('machine_barrelLarge'),[.115,.115,.10],[side*.28,-.965,1.32],'door'+id,[90,0,0],'gold'),side),
 );
}
for(const side of [-1,1])for(const [index,y]of [-.72,0,.72].entries()){
 const id=(side<0?'L':'R')+index,x=side*AXLE_X;
 base.push(
  part('ground rolling machined rounded wheel '+id,'refined/drive-wheel',[R*2,R*2,DEPTH],[x-DEPTH/2,y,R],'wheel'+id,[0,90,0],'native'),
  handed(part('fixed square axle bearing housing '+id,sp('pipe_ring'),[.22,.22,.16],[side*(.76-.08),y,R],'chassis',[0,side*90,0],'metal'),side),
  handed(part('archive enclosed axle load transfer cradle '+id,sp('corridor_wall'),[.27,.28,.21],[side*.68,y,.30],'chassis',[0,0,0],'gold'),side),
 );
}

export default {
 id:'archive_warden',kind:'enemies',role:'elite',locomotion:'crawler',rig,variants:{base},
 design:{
  polish: "底盘与弹性鞍座分层承担保险库载荷，内部重复底板和门口叠架已收掉。双锁页采用整面厚板，铰柱与导轨形成连续结构，上铰轴沿真实竖轴安装。",
  assemblySymmetry: "锁页、铰柱、上铰座、冷却机匣、撞栓轨和轮端轴座使用真实 X 镜像。左轮端轴座原点与旋转轴同步反射，主轮安装保留原值。 左右结构保持对称。前护盾出口、后充压泵与顶部接收器各有固定职责。",
  name:'档案典狱长',
  silhouette: "六轮档案保险库保留弧顶壳、前安全门、中央护盾压栓和低位撞栓。",
  sourceGeometry: "底盘、护梁与整面接触板采用登记的 corridor_wall；捕获导筒使用 rocket_sidesA 或 rocket_fuelA/B；工作机匣、门架、凹面装置继续使用登记的 Kenney CC0 源。主轮为 refined/drive-wheel，接触带使用 64 段轮廓。",
  loadPath: "底盘与弹性鞍座分层承担保险库载荷，内部重复底板和门口叠架已收掉。双锁页采用整面厚板，铰柱与导轨形成连续结构，上铰轴沿真实竖轴安装。",
  articulation:'17 joints: chassis, sprung vault saddle, two vertical-axis security leaves, one axial shield press, one transverse indexing cam, one vertical pump, receiver, paired cooling cassettes, lower contact ram and six independent wheel axles.',
  locomotion:'Travel drives the exact registered polygonal rim perimeter. Wheel support height changes with the same rolling angle and corrects chassis Z; all six axles share their real contact radius. The saddle compresses independently, so actual moving=true still rotates wheels during ability preparation and release. Speed changes preserve travel phase.',
  attack:'The lower contoured contact nose drives a short .16-unit work stroke and loads both rail cradles. Actual melee, terrain and elite breach events arrive as instantaneous releases, so release frame zero is the loaded contact; its recoil withdraws into the sleeve, recocks and reseats. An explicit warning animates the same captured preload. The archive saddle takes the impulse above the planted axle frame.',
  ability:'Actual group_shield: 1.1 s warning, then one shield grant within six cells equal to 18% enemy maximum HP, keeping the higher shield. Warning opens both security leaves, indexes the cam through one quarter-turn and draws the rear charge pump. The exposed front electrode discharges through one short press stroke, then both leaves reseat and the pump vents. The shieldFraction gauge biases the press only; no sustained aura is implied.',
  damage:'A hit unloads the sprung saddle, pushes the shield carriage inside its captured bearing and deflects the leaf hinges. Over the real 650 ms death window the rear pump sinks, the indexing lock relaxes, the leaves droop forward on their retained hinges, the lower nose retracts, and the vault saddle settles. Six wheel contacts retain the load.',
  surfaces: "模型共 49 件。锁页、铰柱、上铰座、冷却机匣、撞栓轨和轮端轴座使用真实 X 镜像。左轮端轴座原点与旋转轴同步反射，主轮安装保留原值。",
  review:'Inspect front low three-quarter for the separate lower contact nose and central press; inspect front straight-on for the .36 clear working aperture between closed leaves; inspect rear three-quarter for connected pump guide and power cabinet; inspect low side for six ground contacts. Compare warning progress=1 and release progress=0, cast while moving, attack contact, and the final retained-axle failure pose.',
  sourceLicense:'Registered Kenney Space Kit and Tower Defense Kit CC0 GLBs. Original sources and License.txt remain under development/assets/model_sources/kenney.',
  partCount:49,
 },
};
