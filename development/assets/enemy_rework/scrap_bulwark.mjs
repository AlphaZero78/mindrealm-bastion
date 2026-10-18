import {part,joint,sp,handed} from '../../web-tools/enemy-model-authoring.mjs';

// A single low armoured wagon. Four independent traction tyres carry a sprung
// platform; a short captive crosshead pushes the entire curved front apron.
// X right, Y rear, Z up; forward contact is -Y.
const R=.35,DEPTH=.20,AXLE_X=.82;
const axles=[{id:'FL',x:-AXLE_X,y:-.59},{id:'FR',x:AXLE_X,y:-.59},
 {id:'RL',x:-AXLE_X,y:.59},{id:'RR',x:AXLE_X,y:.59}];
const rig=[joint('chassis',[0,0,R])];
for(const axle of axles)rig.push(joint('wheel'+axle.id,[axle.x,axle.y,R],'chassis'));
rig.push(
 joint('loadFrame',[0,.04,.62],'chassis'),
 joint('hood',[0,.12,.87],'loadFrame'),
 joint('pressRam',[0,-.66,.70],'loadFrame'),
 joint('compressionL',[-.44,-.20,.68],'loadFrame'),
 joint('compressionR',[.44,-.20,.68],'loadFrame'),
 joint('sight',[0,-.13,1.15],'hood'),
 joint('ventL',[-.28,.69,1.00],'loadFrame'),
 joint('ventR',[.28,.69,1.00],'loadFrame'),
);

const base=[
 part('single folded armoured undercarriage',sp('corridor_wall'),[1.40,1.55,.30],[0,0,.31],'chassis',[0,0,0],'dark'),
 part('single salvaged glacis canopy',sp('craft_miner'),[1.32,1.22,.43],[0,-.03,.65],'hood',[0,0,0],'armor'),
 part('single rear compression powerpack',sp('machine_generatorLarge'),[.82,.49,.43],[0,.55,.66],'loadFrame',[0,0,0],'native'),
 part('short central piercing contact wedge',sp('rocket_topB'),[.34,.20,.16],[0,-.95,.70],'pressRam',[90,0,0],'blade'),
 part('single press reaction bed',sp('corridor_wall'),[.91,.36,.15],[0,-.46,.54],'loadFrame',[0,0,0],'metal'),
 part('protected low signal receiver',sp('machine_wireless'),[.35,.28,.33],[0,-.13,1.07],'sight',[0,0,180],'accent'),
];
for(const {id,x,y}of axles){
 const side=Math.sign(x);
 base.push(
  part(id+' independent machined traction tyre','refined/drive-wheel',[R*2,R*2,DEPTH],[x-DEPTH/2,y,R],'wheel'+id,[0,90,0],'native'),
  handed(part(id+' fixed axle sleeve',sp('rocket_fuelA'),[.24,.24,.16],[side*.57,y,R],'chassis',[0,side*90,0],'metal'),side),
 );
}
for(const side of [-1,1]){
 const id=side<0?'L':'R';
 base.push(
  handed(part('mirrored impact apron half '+id,sp('corridor_wallCorner'),[.72,.43,.69],[side*.36,-.79,.42],'pressRam',[0,0,0],'armor'),side),
  handed(part('single captured hydraulic sleeve '+id,sp('rocket_fuelA'),[.17,.17,.58],[side*.44,-.21,.68],'loadFrame',[90,0,0],'gold'),side),
  handed(part('captured press piston '+id,sp('rocket_fuelA'),[.12,.12,.61],[side*.44,-.335,.68],'pressRam',[90,0,0],'metal'),side),
  handed(part('short hydraulic preload collar '+id,sp('rocket_fuelB'),[.20,.20,.10],[side*.44,-.16,.68],'compression'+id,[90,0,0],'accent'),side),
  handed(part('single rear cooling duct '+id,sp('rocket_sidesA'),[.28,.24,.25],[side*.28,.69,.94],'vent'+id,[0,0,0],'metal'),side),
 );
}

export default {
 id:'scrap_bulwark',kind:'enemies',role:'normal',locomotion:'crawler',rig,variants:{base},
 design:{
  name:'废响重盾',
  silhouette:'低矮四轮重甲车，单层底盘、完整回收坡甲、左右成对的弧面前盾和后部双冷却筒。',
  loadPath:'四轮和短轴套→单片底盘→单个反力床与顶甲。双液压筒直接推动由两片镜像弧面拼成的宽盾。',
  attack:'双压力套环、捕获活塞、整幅前盾和中央短穿甲楔保留原前推、接触和复位。',
  ability:'被动护甲与穿甲继续由持续甲面和短接触楔表达。',
  refinement:'36→24 件。删除第二层车轴框、四个压扁托架、前盾叠加冠盖、双外导轨、第二动力盒、横头饰环、双侧裙和接收器雨罩。前盾分成真正镜像的两半，轴套与双液压机构也使用 handed；主轮及 rig 原位。',
  partCount:24,
  sources:'Registered Kenney CC0 meshes and the shared refined drive wheel; original sources and licenses retained.',
 },
};
