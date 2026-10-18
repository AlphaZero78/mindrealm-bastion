import {part,joint,sp,handed} from '../../web-tools/enemy-model-authoring.mjs';

// A tall four-point load carrier. Its breastplate encloses a captive press;
// front and rear knees bend away from the occupied central work space.
// X right, Y rear, Z up. Forward contact and the shoe noses point toward -Y.
const HIP_Z=.87,KNEE_Z=.47,ANKLE_Z=.10,KNEE_OFFSET=.17;
const legs=[
 {id:'FL',x:-.66,y:-.40,bend:-1},
 {id:'FR',x:.66,y:-.40,bend:-1},
 {id:'RL',x:-.66,y:.40,bend:1},
 {id:'RR',x:.66,y:.40,bend:1},
];
const rig=[joint('chassis',[0,0,HIP_Z]),joint('mantle',[0,.10,1.22],'chassis')];
for(const {id,x,y,bend}of legs){
 rig.push(joint('hip'+id,[x,y,HIP_Z],'chassis'));
 rig.push(joint('knee'+id,[x,y+bend*KNEE_OFFSET,KNEE_Z],'hip'+id));
 rig.push(joint('ankle'+id,[x,y,ANKLE_Z],'knee'+id));
}
rig.push(
 joint('pressMount',[0,-.31,1.20],'mantle'),
 joint('ram',[0,-.74,1.20],'pressMount'),
 joint('preloadL',[-.245,.02,1.20],'pressMount'),
 joint('preloadR',[.245,.02,1.20],'pressMount'),
 joint('visor',[0,-.19,1.63],'mantle'),
);

const link=(label,source,width,depth,a,b,id,finish)=>{
 const dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dy,dz);
 return part(label,source,[width,depth,length],a,id,[-Math.atan2(dy,dz)*180/Math.PI,0,0],finish);
};
const base=[];
for(const {id,x,y,bend}of legs){
 const side=Math.sign(x);
 const hip=[x,y,HIP_Z],knee=[x,y+bend*KNEE_OFFSET,KNEE_Z],ankle=[x,y,ANKLE_Z];
 base.push(
  handed(part(id+' fixed annular hip socket',sp('rocket_fuelB'),[.29,.29,.17],[x-side*.085,y,HIP_Z],'chassis',[0,side*90,0],'metal'),side),
  handed(link(id+' single full-length thigh sleeve',sp('rocket_sidesA'),.28,.26,knee,hip,'hip'+id,'armor'),side),
  handed(part(id+' captured annular knee pin',sp('rocket_fuelA'),[.24,.24,.13],[x-side*.065,knee[1],KNEE_Z],'knee'+id,[0,side*90,0],'gold'),side),
  handed(link(id+' enclosed lower load strut',sp('rocket_sidesA'),.27,.29,ankle,knee,'knee'+id,'ivory'),side),
  handed(part(id+' single broad traction shoe',sp('corridor_wall'),[.40,.48,.12],[x,y,0],'ankle'+id,[0,0,side*180],'dark'),side),
 );
}
base.push(
 part('single continuous lower armoured keel',sp('corridor_wall'),[1.22,1.16,.25],[0,0,.67],'chassis',[0,0,0],'dark'),
 part('single high shoulder command mantle',sp('corridor_wall'),[1.40,.95,.61],[0,.10,.93],'mantle',[0,0,0],'armor'),
 part('single front breastplate around the press',sp('corridor_wall'),[1.10,.13,.43],[0,-.39,.98],'mantle',[0,0,0],'ivory'),
 part('rear press generator and cooling bank',sp('machine_generatorLarge'),[.76,.43,.39],[0,.48,1.18],'mantle',[0,0,180],'native'),
 part('high recessed order visor',sp('desk_computerScreen'),[.34,.17,.20],[0,-.19,1.53],'visor',[0,0,0],'glow'),
 part('single transverse press reaction bulkhead',sp('corridor_wall'),[.75,.29,.35],[0,-.31,.99],'pressMount',[0,0,0],'metal'),
 handed(part('left pressure accumulator sleeve',sp('rocket_fuelA'),[.16,.16,.59],[-.245,.02,1.20],'preloadL',[90,0,0],'gold'),-1),
 handed(part('right pressure accumulator sleeve',sp('rocket_fuelA'),[.16,.16,.59],[.245,.02,1.20],'preloadR',[90,0,0],'gold'),1),
 handed(part('left captured drive piston',sp('rocket_fuelA'),[.11,.11,.685],[-.245,-.055,1.20],'ram',[90,0,0],'metal'),-1),
 handed(part('right captured drive piston',sp('rocket_fuelA'),[.11,.11,.685],[.245,-.055,1.20],'ram',[90,0,0],'metal'),1),
 part('single open-bore press crosshead',sp('pipe_ring'),[.64,.35,.11],[0,-.74,1.20],'ram',[90,0,0],'dark'),
 part('broad short armour-piercing contact head',sp('rocket_topB'),[.37,.37,.21],[0,-.83,1.20],'ram',[90,0,0],'blade'),
);

export default {
 id:'ordered_sentinel',kind:'enemies',role:'normal',locomotion:'walker',rig,variants:{base},
 design:{
  name:'秩序重卫',
  silhouette:'单层高肩指挥壳、平直胸甲与中央短穿甲压头，由四条完整封闭步足承载；高位狭窗和宽足板保留重卫轮廓。',
  loadPath:'单层肩壳与胸甲 → 单片宽底架 → 四个环形髋座 → 整段股套、膝轴和胫套 → 宽足板。压头反力进入单片横向承压板。',
  locomotion:'原对角支撑、行程驱动及两段逆运动学保持原值；髋、膝、踝和四个足底坐标全部保留。',
  attack:'原双侧蓄压套筒和活塞带动一个横头及短压头，完成实际近战接触、吸收后坐及受控回位。',
  ability:'armored 沿用被动重甲规则，持续护甲由完整肩壳、胸甲和封闭承重腿表达。',
  death:'原压低膝部、肩壳失载、双侧套筒卸压及压头下垂保持原动作。',
  refinement:'44 件收为 32 件。删除两根重复髋梁、双侧压头叠架、四个内部股部重复构件及踝装饰圈。高肩壳和承压板使用单片折边源；左右全部步足、压力套筒和活塞执行源网格 X 镜像。',
  sources:'Kenney Space Kit CC0；原始网格与 License.txt 保留于 development/assets/model_sources/kenney/。',
  partCount:32,
 },
};
