import {part,joint,sp,handed} from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up. A complete octagonal gate carries the horizontal
// induction sleeve; the rear dish belongs to its captured upper load bridge.
const rig = [
  joint('chassis', [0, .025, .26]),
  joint('carriage', [0, .025, .59], 'chassis'),
  joint('gateway', [0, -.14, .93], 'carriage'),
  joint('liner', [0, .32, 1.43], 'gateway'),
  joint('plunger', [0, .27, 1.43], 'gateway'),
  joint('doorL', [-.42, -.37, 1.43], 'gateway'),
  joint('doorR', [.42, -.37, 1.43], 'gateway'),
  joint('dish', [0, .56, 1.74], 'gateway'),
  joint('sensor', [0, -.42, .99], 'carriage'),
  joint('transceiver', [0, .66, .79], 'carriage'),
  joint('striker', [0, -.79, .53], 'carriage'),
  joint('ventL', [-.59, .62, 1.015], 'carriage'),
  joint('ventR', [.59, .62, 1.015], 'carriage'),
];

for (const side of [-1, 1]) {
  const id = side < 0 ? 'L' : 'R';
  rig.push(
    joint('wheel' + id + 'F', [side * .80, -.61, .26], 'chassis'),
    joint('wheel' + id + 'R', [side * .80, .66, .26], 'chassis'),
  );
}

const base=[
 part('single folded signal carriage',sp('corridor_wall'),[1.35,1.58,.29],[0,.025,.38],'carriage',[0,0,0],'armor'),
 part('complete calling gate and pedestal',sp('gate_complex'),[1.11,.28,1.06],[0,-.14,.81],'gateway',[0,0,0],'ivory'),
 part('single gate load sill',sp('corridor_wall'),[.99,.62,.16],[0,-.14,.66],'carriage',[0,0,0],'metal'),
 part('horizontal induction sleeve',sp('rocket_sidesA'),[.64,.64,.70],[0,.53,1.43],'gateway',[90,0,0],'armor'),
 part('induction mouth collar',sp('rocket_fuelB'),[.69,.69,.14],[0,.02,1.43],'liner',[90,0,0],'gold'),
 part('rear pressure cap',sp('rocket_topA'),[.65,.65,.29],[0,.51,1.43],'gateway',[-90,0,0],'ivory'),
 part('captured signal compression liner',sp('rocket_fuelB'),[.50,.50,.42],[0,.44,1.43],'plunger',[90,0,0],'metal'),
 part('signal discharge electrode',sp('rocket_topB'),[.42,.42,.17],[0,.01,1.43],'plunger',[90,0,0],'glow'),
 part('single rear signal control bank',sp('machine_wireless'),[1.10,.48,.34],[0,.60,.67],'transceiver',[0,0,0],'native'),
 part('forward route and summoning visor',sp('desk_computerScreen'),[.25,.13,.15],[0,-.42,.90],'sensor',[0,0,0],'glow'),
 part('single broadcast dish with native pedestal',sp('satelliteDish_detailed'),[.64,.56,.66],[0,.56,1.70],'dish',[0,0,0],'native'),
 part('single dish support saddle',sp('corridor_wall'),[.66,.40,.16],[0,.50,1.59],'gateway',[0,0,0],'metal'),
 part('under sill contact cylinder',sp('machine_barrel'),[.21,.21,.42],[0,-.43,.53],'carriage',[90,0,0],'gold'),
 part('captured contact piston',sp('rocket_fuelA'),[.10,.10,.42],[0,-.47,.53],'striker',[90,0,0],'metal'),
 part('compact blunt contact shoe',sp('corridor_wall'),[.42,.21,.22],[0,-.91,.42],'striker',[0,0,0],'armor'),
];
for(const side of [-1,1]){
 const id=side<0?'L':'R';
 base.push(
  handed(part('single lower suspension rail '+id,sp('corridor_wall'),[.18,1.69,.20],[side*.63,.025,.24],'chassis',[0,0,0],'metal'),side),
  handed(part('mirrored curved aperture shutter '+id,sp('corridor_wallCorner'),[.43,.14,.60],[side*.21,-.37,1.13],'door'+id,[0,0,0],'ivory'),side),
  handed(part('induction sleeve load strut '+id,sp('rocket_sidesA'),[.23,.24,.57],[side*.39,.27,.73],'gateway',[0,0,0],'metal'),side),
  handed(part('single rear control bank cooling door '+id,sp('corridor_wall'),[.12,.33,.26],[side*.56,.62,.85],'vent'+id,[0,0,0],'metal'),side),
 );
 for(const [end,y]of [['F',-.61],['R',.66]]){
  const axleX=side*.80,wheelJoint='wheel'+id+end;
  base.push(part('independent round traction tyre '+id+end,'refined/drive-wheel',[.52,.52,.15],[axleX-.075,y,.26],wheelJoint,[0,90,0],'native'));
 }
}

export default {
 id:'signal_summoner',kind:'enemies',role:'normal',locomotion:'crawler',rig,variants:{base},
 design:{
  name:'信号召集体',
  silhouette:'单片四轮底盘托起完整召集门，横向感应舱位于门内，后方单碟形成最高层。',
  loadPath:'四轮→每侧一根纵梁→单片底盘和门槛→完整门架与双支柱→感应舱和单片碟座。',
  attack:'紧凑接触鞋、捕获活塞和导筒保留原攻击行程。',
  ability:'原预警对碟、开门、回拉电极、短行程释放和复位动作保持；增援仍由实际规则生成。',
  refinement:'39→27 件。删除横轴飞船壳、下方第二供能盒、双肩斜撑、独立冷却罐、外侧第二层护壳、弧门饰环和重叠碟座支块。后部控制箱合为一体承托两侧散热门。弧门、支柱、纵梁和散热门均 handed，主轮及 rig 原位。',
  partCount:27,
  sources:'Registered Kenney CC0 meshes and the shared refined drive wheel; original sources and licenses retained.',
 },
};
