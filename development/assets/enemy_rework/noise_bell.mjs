import {part,joint,sp,td,handed} from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up; forward -Y. A six-wheel wagon carries one
// inverted concave bell in a continuous open gantry. The bell is suspended
// from its real pedestal; the external hammer strikes its left skirt.
const rig=[
 joint('chassis',[0,0,.38]),
 joint('frame',[0,0,.62],'chassis'),
 joint('bell',[0,.02,2.01],'frame'),
 joint('clapper',[0,.02,1.43],'bell'),
 joint('hammer',[-.78,.03,1.48],'frame'),
 joint('pressureCase',[0,.74,.64],'frame'),
 joint('cam',[0,1.00,1.13],'pressureCase'),
 joint('pump',[0,.76,1.48],'pressureCase'),
 joint('ventL',[-.34,.78,1.08],'pressureCase'),
 joint('ventR',[.34,.78,1.08],'pressureCase'),
 joint('sensor',[0,-.30,2.02],'frame'),
 joint('ram',[0,-.64,.58],'chassis'),
];

const wheelRadius=.29, wheelDepth=.19;
for(const side of [-1,1])for(const [index,y]of [-.73,0,.73].entries()){
 const id=(side<0?'L':'R')+index;
 rig.push(joint('wheel'+id,[side*.90,y,wheelRadius],'chassis'));
}

const base=[
 part('single folded six axle bell load deck',sp('corridor_wall'),[1.50,1.93,.34],[0,0,.28],'chassis',[0,0,0],'native'),
 part('open four post bell load gantry',sp('supports_high'),[1.39,1.25,1.42],[0,0,.61],'frame',[0,0,0],'metal'),
 part('machined roof torsion bridge',sp('gate_simple'),[1.29,.43,.25],[0,.02,1.88],'frame',[0,0,0],'armor'),
 part('square captured bell suspension seat',sp('pipe_ringHigh'),[.43,.43,.14],[0,.02,1.90],'frame',[0,0,0],'gold'),
 // The large dish includes its own concave skirt and square pedestal. At
 // X=180 its pedestal is the suspension and its open mouth points down.
 part('single inverted concave bell with integral suspension',sp('satelliteDish_large'),[1.07,1.04,1.14],[0,.02,2.01],'bell',[180,0,0],'ivory'),
 part('sealed octagonal bell neck and pressure jacket',sp('hangar_roundB'),[.63,.55,.49],[0,.14,1.30],'bell',[0,0,0],'gold'),
 part('front edge bell frequency reader',sp('desk_computerScreen'),[.29,.18,.22],[0,-.30,1.99],'sensor',[0,0,0],'glow'),
 part('front enclosed reader load bracket',sp('corridor_wall'),[.34,.30,.13],[0,-.27,1.88],'frame',[0,0,0],'metal'),
 part('internal transverse clapper pivot',sp('rocket_baseB'),[.21,.21,.09],[0,.065,1.43],'bell',[90,0,0],'metal'),
 part('captured internal clapper solid neck',sp('rocket_fuelA'),[.13,.13,.49],[0,.02,.95],'clapper',[0,0,0],'metal'),
 part('faceted internal clapper contact mass',sp('machine_barrelLarge'),[.17,.19,.17],[0,.02,.91],'clapper',[0,0,0],'dark'),
 part('outboard enclosed hammer load clevis',sp('corridor_wall'),[.24,.33,.20],[-.69,.03,1.39],'frame',[0,0,0],'metal'),
 part('external hammer transverse four ear pivot',sp('rocket_baseA'),[.27,.27,.12],[-.78,.09,1.48],'frame',[90,0,0],'gold'),
 part('external hammer enclosed load lever',sp('corridor_wall'),[.19,.21,.48],[-.78,.03,1.01],'hammer',[0,0,0],'metal'),
 part('external hammer bevelled striking mass',sp('machine_barrelLarge'),[.25,.30,.25],[-.78,.03,.91],'hammer',[0,0,0],'armor'),
 part('hammer lower captive stroke stop cross bracket',sp('corridor_wall'),[.37,.23,.10],[-.825,.03,.81],'frame',[0,0,0],'gold'),
 part('rear ribbed pressure control cabinet',sp('machine_generatorLarge'),[.80,.54,.76],[0,.76,.64],'pressureCase',[0,0,180],'native'),
 part('rear sealed pressure reservoir',sp('machine_barrelLarge'),[.33,.31,.53],[0,.84,1.00],'pressureCase',[0,0,0],'gold'),
 part('pressure governor fixed bearing mount',sp('corridor_wall'),[.34,.27,.19],[0,.96,.99],'pressureCase',[0,0,0],'metal'),
 part('pressure governor four ear drive cam',sp('rocket_baseA'),[.33,.33,.10],[0,1.05,1.13],'cam',[90,0,0],'gold'),
 part('eccentric governor follower pin',sp('rocket_fuelA'),[.045,.045,.07],[.073,1.04,1.17],'cam',[90,0,0],'accent',true),
 part('fixed pressure relief follower sleeve',sp('rocket_sidesA'),[.23,.23,.31],[0,.76,1.29],'pressureCase',[0,0,0],'metal'),
 part('captured pressure relief follower shaft',sp('rocket_fuelA'),[.13,.13,.35],[0,.76,1.42],'pump',[0,0,0],'gold'),
 part('pressure relief loaded cap',sp('rocket_topB'),[.19,.17,.16],[0,.76,1.70],'pump',[0,0,0],'accent'),
 handed(part('left enclosed pressure heat cassette',sp('machine_generator'),[.21,.35,.40],[-.34,.78,.98],'ventL',[0,0,0],'metal'),-1),
 handed(part('right enclosed pressure heat cassette',sp('machine_generator'),[.21,.35,.40],[.34,.78,.98],'ventR',[0,0,0],'metal'),1),
 part('forward impact captive dual guide',sp('corridor_wall'),[.75,.51,.13],[0,-.54,.44],'chassis',[0,0,0],'metal'),
 part('forward impact fixed flanged sleeve',sp('rocket_sidesA'),[.24,.24,.37],[0,-.29,.58],'chassis',[90,0,0],'metal'),
 part('forward impact captured shaft',sp('rocket_fuelA'),[.13,.13,.62],[0,-.36,.58],'ram',[90,0,0],'gold'),
 part('forward impact continuous knocker plate',sp('corridor_wall'),[.75,.24,.24],[0,-.87,.46],'ram',[0,0,180],'armor'),
];

for(const side of [-1,1])for(const [index,y]of [-.73,0,.73].entries()){
 const id=(side<0?'L':'R')+index, x=side*.90;
 base.push(
  handed(part('six axle captured load carrier '+id,sp('corridor_wall'),[.24,.30,.22],[side*.70,y,.25],'chassis',[0,0,0],'metal'),side),
  // Both refined 64-segment contact ribs mount at +Y 90. The bottom
  // centre is half the axial depth behind the joint, putting the axle at x.
  part('machined rounded ground wheel '+id,'refined/drive-wheel',[wheelRadius*2,wheelRadius*2,wheelDepth],[x-wheelDepth/2,y,wheelRadius],'wheel'+id,[0,90,0],'native'),
 );
}

export default {
 id:'noise_bell',kind:'enemies',role:'elite',locomotion:'crawler',rig,variants:{base},
 design:{
  polish: "折边底盘直接连接钟架，重复下鞍架已收掉。前撞头采用整面接触板，读数器座、锤臂与止挡改用连续承力面。",
  assemblySymmetry: "两侧冷却机匣和六个轮端承座按真实 X 镜像布置。轮胎沿既有同轴安装保留完整侧面。 左侧外击锤为明确的单边工作机构，保留独立承座、摆臂和止挡；右侧留出钟体回响空间。",
  name:'噪声丧钟',
  silhouette: "六轮钟车保留开放四柱钟架、倒置凹面吊钟、左侧击锤和后压力箱。",
  loadPath: "折边底盘直接连接钟架，重复下鞍架已收掉。前撞头采用整面接触板，读数器座、锤臂与止挡改用连续承力面。",
  attack:'The front contoured knocker withdraws inside the fixed sleeve, drives along its dual guide, contacts the blocker, then reseats. The pressure bell stays supported above the impact path.',
  ability:'Actual pressure_aura: 1.1 s warning, followed by a 4 s field that increases death pressure by 25% within 6 cells. Warning retracts the external hammer, lifts the captured regulator and opens rear heat shutters; release strikes the skirt, the internal clapper and hanging bell answer the impact, and timed cam/hammer working strokes sustain the held aperture.',
  locomotion:'All six wheels roll from model travel using the registered circular contact profile. One chassis height correction maintains ground contact; cage mounting compression reflects movement while casting can run simultaneously.',
  damage:'A hit loads the suspended bell and clapper while the wheel keel remains planted. Death depressurizes the rear regulator, closes the shutters, lowers the bell in its capture seat and leaves the skirt hammer against its stop. Reduced motion uses this same fixed final failure pose.',
  sourceGeometry: "底盘、护梁与整面接触板采用登记的 corridor_wall；捕获导筒使用 rocket_sidesA 或 rocket_fuelA/B；工作机匣、门架、凹面装置继续使用登记的 Kenney CC0 源。主轮为 refined/drive-wheel，接触带使用 64 段轮廓。",
  detailPolicy: "42 件。部件承担承重、外壳、轴承、传感或工作机构职责，原有主轮安装保持原值。",
  sourceLicense:'Registered Kenney Space Kit and Tower Defense Kit CC0 GLBs; original source meshes and license notices remain in development/assets/model_sources/kenney.',
 },
};
