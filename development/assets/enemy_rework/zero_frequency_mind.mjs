import {part,joint,sp,td,handed} from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up. The wide eight-wheel carriage supports a continuous
// pressure shell and a tall, captured gate; its working device is a pressure
// diaphragm, rather than a long translating hammer or an excavation boom.
const radius=.30,depth=.22;
const axleY=[-.93,-.31,.31,.93];
const bankAngle=phase=>[0,32,49][phase];
const crownAngle=phase=>[76,47,0][phase];
const crownPivot=[0,.79,1.46];
const coverAngle=phase=>[0,44,69][phase];

function around(piece,pivot,degrees,axis){
 const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 const v=piece.position.map((n,i)=>n-pivot[i]);
 const q=axis===0?[v[0],v[1]*c-v[2]*s,v[1]*s+v[2]*c]
   :axis===1?[v[0]*c+v[2]*s,v[1],-v[0]*s+v[2]*c]
   :[v[0]*c-v[1]*s,v[0]*s+v[1]*c,v[2]];
 piece.position=q.map((n,i)=>n+pivot[i]);
 piece.rotation[axis]+=degrees;
 return piece;
}
const bankPivot=side=>[side*.78,.14,1.12];
const coverPivot=side=>[side*.92,.37,1.49];

const rig=[
 joint('chassis',[0,.08,radius]),
 joint('pressureFrame',[0,.08,.64],'chassis'),
 joint('powerpack',[0,.57,.92],'pressureFrame'),
 joint('gate',[0,-.26,.86],'pressureFrame'),
 joint('diaphragm',[0,-.66,1.49],'gate'),
 joint('nullCore',[0,-.79,1.49],'diaphragm'),
 joint('shutterL',[-.24,-.95,1.16],'gate'),
 joint('shutterR',[.24,-.95,1.16],'gate'),
 joint('sight',[0,-.48,2.22],'gate'),
 joint('crown',crownPivot,'pressureFrame'),
 joint('crownFeed',crownPivot,'crown'),
 ...[-1,1].flatMap(side=>[
  joint('channel'+(side<0?'L':'R'),bankPivot(side),'pressureFrame'),
  joint('cover'+(side<0?'L':'R'),coverPivot(side),'pressureFrame'),
 ]),
 ...[-1,1].flatMap(side=>axleY.map((y,i)=>joint(`wheel${side<0?'L':'R'}${i}`,[side*1.08,y,radius],'chassis'))),
];
for(let phase=0;phase<3;phase++){
 for(const side of [-1,1]){
  const tag=side<0?'L':'R',pivot=bankPivot(side);
  const point=around({position:[side*.78,-.42,1.27],rotation:[0,0,0]},pivot,side*bankAngle(phase),2).position;
  rig.push(joint(`feed${tag}${phase}`,point,'channel'+tag));
 }
}

const carriage=[
 part('single folded wide eight-wheel pressure deck',sp('corridor_wall'),[1.94,2.36,.38],[0,.08,.43],'pressureFrame',[0,0,0],'armor'),
 part('rear ribbed pressure generator with service ribs',sp('machine_generatorLarge'),[1.15,.93,.69],[0,.56,.78],'powerpack',[0,0,180],'native'),
 part('rear captured low controller case and original aerial',sp('machine_wireless'),[.39,.36,.25],[.54,.84,1.06],'powerpack',[0,0,180],'dark'),
 ...axleY.map((y,i)=>part(`full span load axle and differential carrier ${i}`,sp('corridor_wall'),[2.00,.22,.22],[0,y,.30],'chassis',[0,0,0],'metal')),
 ...[-1,1].flatMap(side=>{
  const tag=side<0?'L':'R';
  return [
   handed(part(`continuous enclosed longitudinal suspension beam ${tag}`,sp('corridor_wall'),[.24,2.30,.23],[side*.86,.03,.25],'chassis',[0,0,0],'metal'),side),
   ...axleY.flatMap((y,i)=>[
    // The refined 64-segment contact rib lies in XY. Both sides use +Y90;
    // bottom-centre position is the axle centre minus half the axial depth.
    part(`real bevelled drive wheel ${tag}${i}`,'refined/drive-wheel',[radius*2,radius*2,depth],[side*1.08-depth/2,y,radius],`wheel${tag}${i}`,[0,90,0],'native'),
   ]),
  ];
 }),
];

const gateParts=[
 part('complete tall octagonal lock gate with captured lower feet',sp('gate_complex'),[1.67,.49,1.52],[0,-.26,.79],'gate',[0,0,0],'metal'),
 part('enclosed front pressure drum and its native service feed',sp('machine_barrelLarge'),[.74,.74,.63],[0,-.22,1.49],'gate',[90,0,0],'native'),
 part('continuous front pressure face socket',sp('rocket_sidesA'),[.91,.91,.17],[0,-.79,1.49],'diaphragm',[90,0,0],'armor'),
 part('diaphragm captured polygonal working core',sp('rocket_fuelA'),[.24,.24,.27],[0,-.72,1.49],'nullCore',[90,0,0],'gold'),
 part('small front null-field focus crown',sp('rocket_topB'),[.27,.27,.08],[0,-.97,1.49],'nullCore',[90,0,0],'glow'),
 part('lower transverse sealed shutter guide',sp('corridor_wall'),[1.14,.16,.15],[0,-.97,.98],'gate',[0,0,0],'metal'),
 part('upper transverse sealed shutter guide',sp('corridor_wall'),[1.14,.16,.15],[0,-.97,1.90],'gate',[0,0,0],'metal'),
 handed(part('left captured machined sliding pressure shutter',sp('corridor_wall'),[.38,.10,.75],[-.24,-.95,1.12],'shutterL',[0,0,0],'ivory'),-1),
 handed(part('right captured machined sliding pressure shutter',sp('corridor_wall'),[.38,.10,.75],[.24,-.95,1.12],'shutterR',[0,0,0],'ivory'),1),
 part('high protected forward ranging and sequencing screen',sp('desk_computerScreen'),[.30,.15,.18],[0,-.48,2.22],'sight',[0,0,0],'glow'),
];

function variant(phase){
 const parts=[...carriage,...gateParts];
 for(const side of [-1,1]){
  const tag=side<0?'L':'R',pivot=bankPivot(side),a=side*bankAngle(phase);
  const swung=piece=>around(piece,pivot,a,2);
  parts.push(
   handed(part(`captured continuous side-channel hinge ${tag}`,sp('rocket_fuelB'),[.26,.26,.15],[side*.78,.14,1.04],'pressureFrame',[0,0,0],'gold'),side),
   swung(handed(part(`enclosed side-channel torque arm ${tag}`,sp('corridor_wall'),[.28,.72,.20],[side*.78,-.14,1.00],'channel'+tag,[0,0,0],'metal'),side)),
   swung(handed(part(`complete enclosed independent pressure chamber ${tag}`,sp('machine_barrelLarge'),[.39,.39,.56],[side*.78,.02,1.27],'channel'+tag,[90,0,0],'native'),side)),
   swung(handed(part(`continuous front side pressure throat ${tag}`,sp('rocket_sidesA'),[.48,.48,.13],[side*.78,-.48,1.27],'channel'+tag,[90,0,0],'armor'),side)),
   swung(handed(part(`captured chamber's independent pressure working core ${tag}`,sp('rocket_fuelA'),[.12,.12,.33],[side*.78,-.25,1.27],`feed${tag}${phase}`,[90,0,0],'gold'),side)),
   swung(handed(part(`exposed finite null-pressure throat ${tag}`,sp('rocket_topB'),[.17,.17,.055],[side*.78,-.55,1.27],`feed${tag}${phase}`,[90,0,0],'glow'),side)),
   around(handed(part(`hinged continuous side pressure armour cover ${tag}`,sp('corridor_wall'),[.31,.79,.20],[side*.92,.03,1.40],'cover'+tag,[0,0,0],'ivory'),side),coverPivot(side),side*coverAngle(phase),1),
  );
 }
 const crown=piece=>around(piece,crownPivot,crownAngle(phase),0);
 parts.push(
  part('captured rear transverse crown hinge and end mounts',sp('gate_simple'),[1.20,.24,.27],[0,.79,1.22],'pressureFrame',[0,0,0],'metal'),
  crown(part('enclosed five-channel dorsal collimator carrier',sp('corridor_wall'),[1.25,.31,.19],[0,.79,1.43],'crown',[0,0,0],'metal')),
 );
 for(const [i,x]of [-.48,-.24,0,.24,.48].entries()){
  parts.push(
   crown(handed(part(`captured dorsal collimator guide ${i+1}`,sp('rocket_sidesA'),[.17,.19,.40],[x,.79,1.54],'crown',[0,0,0],'dark'),x<0?-1:1)),
   crown(handed(part(`sliding blunt dorsal zero-frequency working electrode ${i+1}`,sp('rocket_fuelA'),[.15,.15,.37],[x,.79,1.81],'crownFeed',[0,0,0],'gold'),x<0?-1:1)),
  );
 }
 return parts;
}

export default {
 id:'zero_frequency_mind',kind:'enemies',role:'boss',locomotion:'crawler',rig,
 variants:{phase1:variant(0),phase2:variant(1),phase3:variant(2)},
 design:{
  polish: "底层收成单一折边机台，轮侧叠壳与重复甲板已收掉。前压力门、横向导轨、侧臂与背冠承梁采用连续构件。两侧压力盖保留独立展开关节。",
  assemblySymmetry: "压力门、侧通道、护盖和承梁上的五路准直件按真实 X 镜像布置。五路阵列的左右两对独立反射，中央一路保留中心位置。 左右静态装配保持对称。前压力鼓与后准直冠按攻城工作顺序分层。",
  name:'零频主脑',
  silhouette: "八轮压阵机通过高门架、前压力鼓、双侧压力腔和五路准直冠表达攻城能力。",
  geometryEvidence: "底盘、护梁与整面接触板采用登记的 corridor_wall；捕获导筒使用 rocket_sidesA 或 rocket_fuelA/B；工作机匣、门架、凹面装置继续使用登记的 Kenney CC0 源。主轮为 refined/drive-wheel，接触带使用 64 段轮廓。",
  loadPath: "底层收成单一折边机台，轮侧叠壳与重复甲板已收掉。前压力门、横向导轨、侧臂与背冠承梁采用连续构件。两侧压力盖保留独立展开关节。",
  phases:'phase1 两侧压力通道沿车身前向收纳，侧护壳封闭，后准直冠绕真实横轴折叠 76 度。phase2 两侧完整通道各展开 32 度，侧护壳打开 44 度，后冠改为折叠 47 度。phase3 两侧展开 49 度，护壳打开 69 度，五路导筒和电极整体竖立。阶段始终保留固定根轴和相同尺寸。',
  movement:'八轮用累计模型行程驱动实际轮胎轮廓，接触高度修正送到承重底盘。压力甲板在轴承上小幅压缩；真实移动可以与能力预警同时出现。',
  attack:'滑动护门开启，捕获芯回抽蓄势，压力鼓执行短促压缩行程，然后芯冠向前释放定向冲击。前门架和低位甲板吸收后坐。地形攻击使用更深压缩和较长接触行程；突破使用压住火种方向的持续压缩。',
  ability:'siege 预警 1.1 秒后冲击 10/11/12 格内至多 3/4/5 座构造，造成 65%/75%/85% 攻击力伤害。门架护门、侧压力芯和五路电极依次蓄压、开喉、共同压入释放，再沿捕获导筒复位。能力间隔为 6.5/5.7/4.9 秒；地形伤害为 3/4/5 倍攻击力。',
  situational:'三次攻城攻击后推进 2.5 秒。新规则中，六次阻挡攻击触发破阵预警，底盘锁定压力鼓并前进 2.5 秒。高难度频震先固定原点蓄力，五路冠压入并带动左右通道释放；普通零频能力与频震按 actionKind 分开。',
  damage:'受击由压力甲板、门架、鼓膜和侧腔分担短行程。死亡先闭合压力护门、收回电极，再卸载侧腔并压低甲板，车轮接地点保留，门架靠向已停机的后部机箱。',
  surfaces: "各阶段分别为 53、53、53 件。压力门、侧通道、护盖和承梁上的五路准直件按真实 X 镜像布置。五路阵列的左右两对独立反射，中央一路保留中心位置。",
  review:'前上方检查八轮宽体、门架与前压力鼓。左右前三分之四对比三阶段侧通道和护壳展开。后上方看 76/47/0 度冠架与真实捕获导筒。检查预警末帧、释放初帧、压力芯接触中帧、地形行程、破阵推进和死亡末帧。',
  sourceLicense:'Kenney Space Kit 和 Tower Defense Kit 均为 CC0；原始 GLB 与 License.txt 保留于 development/assets/model_sources/kenney/。',
 },
};
