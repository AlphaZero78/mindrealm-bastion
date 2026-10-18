import {part,joint,sp,handed} from '../../web-tools/enemy-model-authoring.mjs';

// Prismatic grip carriages carry the low shell; no decorative axle is treated
// as a wheel. The shoulder rails, jack sleeves and pad rods visibly overlap.
const bays=[
 {id:'front',y:-.78,width:1.28,length:.98,x:.62},
 {id:'middle',y:.06,width:1.16,length:.94,x:.58},
 {id:'rear',y:.88,width:1.02,length:.88,x:.52},
];
const rig=[joint('chassis',[0,.06,.42])];
for(const bay of bays){
 rig.push(joint(bay.id,[0,bay.y,.42],'chassis'));
 for(const side of [-1,1]){
  const tag=bay.id+(side<0?'L':'R');
  rig.push(joint('carriage'+tag,[side*bay.x,bay.y,.33],bay.id));
  rig.push(joint('pad'+tag,[side*bay.x,bay.y,.13],'carriage'+tag));
 }
}
rig.push(joint('couplingF',[0,-.36,.52],'chassis'));
rig.push(joint('couplingR',[0,.47,.51],'chassis'));
rig.push(joint('head',[0,-1.15,.41],'front'));
rig.push(joint('jawL',[-.29,-1.31,.39],'head'));
rig.push(joint('jawR',[.29,-1.31,.39],'head'));

const base=[];
for(const bay of bays){
 base.push(
  part(bay.id+' rounded overlap armour canopy',sp('hangar_roundA'),[bay.width,bay.length,.52],[0,bay.y,.31],bay.id,[0,0,0],'armor'),
  part(bay.id+' single transverse load cradle',sp('corridor_wall'),[bay.width-.09,.62,.13],[0,bay.y,.29],bay.id,[0,0,0],'metal'),
 );
 for(const side of [-1,1]){
  const tag=bay.id+(side<0?'L':'R'),x=side*bay.x;
  base.push(...[
   part(tag+' single carriage rail cover',sp('corridor_wall'),[.20,.75,.12],[x,bay.y,.32],bay.id,[0,0,0],'metal'),
   part(tag+' rounded captured slide and jack crosshead',sp('rocket_fuelB'),[.24,.25,.12],[x,bay.y,.30],'carriage'+tag,[0,0,0],'gold'),
   part(tag+' full downward jack sleeve',sp('machine_barrel'),[.19,.19,.23],[x,bay.y,.43],'carriage'+tag,[180,0,0],'dark'),
   part(tag+' captive telescoping shoe piston',sp('rocket_fuelA'),[.105,.105,.24],[x,bay.y,.12],'pad'+tag,[0,0,0],'metal'),
   part(tag+' single broad clamp shoe',sp('corridor_wall'),[.35,.44,.12],[x,bay.y,.025],'pad'+tag,[0,0,0],'armor'),
  ].map(piece=>handed(piece,side)));
 }
}
base.push(
 // Rounded open-bore castings bridge the shell seams and follow the existing
 // coupling travel; the lower recess preserves the pad-carriage clearance.
 part('front rounded armoured vertebral collar',sp('rocket_sidesA'),[.71,.59,.31],[0,-.20,.54],'couplingF',[90,0,0],'dark'),
 part('rear rounded armoured vertebral collar',sp('rocket_sidesA'),[.64,.55,.29],[0,.62,.52],'couplingR',[90,0,0],'dark'),
 part('faceted continuous jaw drive cowl',sp('craft_miner'),[.85,.60,.28],[0,-1.28,.29],'head',[0,0,0],'native'),
 part('protected low forward contact sensor',sp('desk_computerScreen'),[.24,.12,.13],[0,-1.45,.54],'head',[0,0,0],'glow'),
 ...[-1,1].flatMap(side=>{
  const tag=side<0?'L':'R';
  return [
   part(tag+' compact vertical jaw hinge bearing',sp('machine_barrel'),[.18,.18,.085],[side*.29,-1.31,.3475],'head',[0,0,0],'metal'),
   part(tag+' inward curved armour splitting mandible',sp('corridor_wallCorner'),[.58,.18,.19],[side*.29,-1.56,.30],'jaw'+tag,[0,0,side*90],'blade'),
  ].map(piece=>handed(piece,side));
 }),
);

export default {
 id:'armored_worm',kind:'enemies',role:'normal',locomotion:'crawler',rig,variants:{base},
 design:{
  silhouette:'Three rounded, overlapping armoured vertebrae form a low tapering worm. Six short clamp shoes stay below its side rails, and two broad splitting mandibles emerge from the protected nose.',
  loadPath:'Rounded armour → transverse cradles → covered side carriages → full jack sleeves and captured pistons → six wide clamp shoes. Rounded vertebral collars keep the two shell seams covered throughout axial compression.',
  locomotion:'Travel drives three staggered grip cycles. Every planted pair moves rearward relative to the body at the actual travel rate; only the released pair lifts and returns. Small axial compression and jack travel follow the load transfer while the pad contacts retain their exact height.',
  attack:'The six pads brace, the nose drive retracts, vertical-axis mandibles open, and the nose thrust closes the forged splitting jaws through the contact stroke. Recoil and jaw reopening precede a full reset. Terrain and breach reuse this direct contact mechanism.',
  ability:'armored is passive: 12 armour and 35% attack pierce. There is no periodic cast warning or active shield in battle.js. Overlap armour and splitting jaws communicate those two actual advantages continuously.',
  surfaces:'Kenney CC0 rounded hangar armour, single cradle shells, covered slides, ribbed jacks and compact hinges use the same registered meshes and material layers as buildings. All 44 parts have a load, shielding, locomotion or attack function.',
  sources:'Kenney Space Kit CC0; registered GLB resources and original License.txt retained in development/assets/model_sources/kenney/space-kit/.',
  symmetry:'Six matched carriage and shoe assemblies use true reflection. The two curved mandibles face the midline around unchanged jaw pivots. Single cradle, rail and sole shells replace miniature spacecraft; only the deliberate fore-to-aft armour taper remains asymmetric.',
  partCount:44,
 },
};
