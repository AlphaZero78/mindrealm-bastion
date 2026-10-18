import {part,joint,sp,handed} from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up; the outlet faces -Y. The complete CC0 hangar
// shell encloses a real opposed-head scan bed, rather than two exposed tanks.
const rig = [
  joint('chassis', [0, .03, .28]),
  joint('cabinet', [0, .03, .58], 'chassis'),
  joint('powerpack', [0, .69, .74], 'cabinet'),
  joint('sensor', [0, -.64, 1.43], 'cabinet'),
  joint('feed', [0, -.15, .81], 'cabinet'),
  joint('ejector', [0, -.28, .61], 'cabinet'),
];

for (const side of [-1, 1]) {
  const id = side < 0 ? 'L' : 'R';
  rig.push(
    joint('wheel' + id + 'F', [side * .79, -.66, .28], 'chassis'),
    joint('wheel' + id + 'R', [side * .79, .68, .28], 'chassis'),
    joint('scan' + id, [side * .47, .25, 1.12], 'cabinet'),
    joint('head' + id, [side * .405, .25, 1.125], 'scan' + id),
    joint('clamp' + id, [side * .40, -.49, .89], 'cabinet'),
    joint('door' + id, [side * .42, -.68, 1.03], 'cabinet'),
    joint('vent' + id, [side * .57, .69, 1.16], 'powerpack'),
  );
}

const base = [
 part('single folded scanning chassis',sp('corridor_wall'),[1.32,1.84,.30],[0,.03,.36],'cabinet',[0,0,0],'armor'),
 part('continuous arched scan chamber',sp('hangar_roundA'),[1.18,1.18,.71],[0,-.005,.74],'cabinet',[0,0,0],'ivory'),
 part('single reinforced outlet frame',sp('gate_complex'),[1.30,.22,.83],[0,-.61,.64],'cabinet',[0,0,0],'metal'),
 part('scan status visor',sp('desk_computerScreen'),[.28,.15,.16],[0,-.64,1.39],'sensor',[0,0,0],'glow'),
 part('single continuous scan bed',sp('corridor_wall'),[.87,1.43,.14],[0,-.06,.66],'cabinet',[0,0,0],'metal'),
 part('single flat outfeed platen',sp('corridor_wall'),[.70,.92,.11],[0,-.16,.81],'feed',[0,0,0],'gold'),
 part('single rear power converter',sp('machine_generatorLarge'),[1.09,.41,.52],[0,.71,.64],'powerpack',[0,0,0],'native'),
 part('under bed ejector cylinder',sp('machine_barrelLarge'),[.24,.24,.66],[0,-.05,.61],'cabinet',[90,0,0],'native'),
 part('captured ejector piston',sp('rocket_fuelA'),[.13,.13,.52],[0,-.28,.61],'ejector',[90,0,0],'metal'),
 part('broad ejector contact bumper',sp('corridor_wall'),[.50,.26,.18],[0,-.83,.52],'ejector',[0,0,0],'armor'),
];
for(const side of [-1,1]){
 const id=side<0?'L':'R';
 base.push(
  handed(part('single lower suspension rail '+id,sp('corridor_wall'),[.20,1.80,.20],[side*.60,.03,.24],'chassis',[0,0,0],'metal'),side),
  handed(part('single scanner guide '+id,sp('corridor_wall'),[.13,1.15,.12],[side*.47,-.03,1.00],'cabinet',[0,0,0],'metal'),side),
  handed(part('captured scanner carriage '+id,sp('corridor_wall'),[.21,.23,.20],[side*.47,.25,1.01],'scan'+id,[0,0,0],'ivory'),side),
  handed(part('inward facing slice scanner '+id,sp('satelliteDish_detailed'),[.34,.31,.215],[side*.405,.25,1.125],'head'+id,[0,-side*90,0],'glow'),side),
  handed(part('single platen edge clamp '+id,sp('corridor_wall'),[.14,.27,.15],[side*.315,-.49,.83],'clamp'+id,[0,0,0],'metal'),side),
  handed(part('paired curved outlet shutter '+id,sp('corridor_wallCorner'),[.34,.105,.44],[side*.255,-.72,.83],'door'+id,[0,0,0],'ivory'),side),
  handed(part('single rear cooling door '+id,sp('corridor_wall'),[.12,.34,.32],[side*.56,.69,.84],'vent'+id,[0,0,0],'metal'),side),
 );
 for(const [suffix,y]of [['F',-.66],['R',.68]]){
  base.push(part('circular bevelled traction wheel '+id+suffix,'refined/drive-wheel',[.56,.56,.18],[side*.79-.09,y,.28],'wheel'+id+suffix,[0,90,0],'native'));
 }
}

export default {
 id:'replication_node',kind:'enemies',role:'normal',locomotion:'crawler',rig,variants:{base},
 design:{
  name:'复制节点',
  silhouette:'单片低底盘、完整拱形扫描室、相向双扫描头、分体弧门和一张出舱托盘。',
  loadPath:'四轮→每侧一根下纵梁→连续底盘与扫描床→拱壳和单个前门框。后置功率盒直接接入底盘，扫描滑架由左右各一条导轨承载。',
  attack:'床下撞击缸、捕获活塞和宽短撞头保留原攻击行程。',
  ability:'保留夹持、扫描、开门、送料和复位动作；复制目标、生成结果及增援预算继续由战斗规则决定。',
  refinement:'40→28 件。删除变速箱、两根压扁横轴、后门框、外侧第二层曲板、托盘下重复齿条、参考小机箱及铰轴饰环。左右扫描头、滑架、夹爪、弧门和散热门使用 handed；弧门取消一侧独有的 180 度替代镜像。主轮及 rig 原位。',
  partCount:28,
  sources:'Registered Kenney CC0 meshes and the shared refined drive wheel; original sources and licenses retained.',
 },
};
