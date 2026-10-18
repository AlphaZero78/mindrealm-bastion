import {part,joint,sp,handed} from '../../web-tools/enemy-model-authoring.mjs';

// X right, Y rear, Z up. The shield is a two-door pavise carried by a
// telescoping crosshead. Hip, knee and ankle axles carry its mass into the pads.
const rig=[
 joint('chassis',[0,.14,1.14]),
 joint('torso',[0,.12,1.12],'chassis'),
 joint('hipL',[-.46,.14,1.14],'chassis'),
 joint('kneeL',[-.46,.14,.64],'hipL'),
 joint('ankleL',[-.46,.14,.14],'kneeL'),
 joint('hipR',[.46,.14,1.14],'chassis'),
 joint('kneeR',[.46,.14,.64],'hipR'),
 joint('ankleR',[.46,.14,.14],'kneeR'),
 joint('linkL',[-.49,-.06,1.31],'torso'),
 joint('linkR',[.49,-.06,1.31],'torso'),
 joint('ram',[0,-.22,1.28],'torso'),
 joint('shieldL',[-.66,-.45,1.30],'ram'),
 joint('shieldR',[.66,-.45,1.30],'ram'),
 joint('emitter',[0,-.50,1.35],'ram'),
 joint('sensor',[0,-.18,1.86],'torso'),
 joint('capacitor',[0,.54,1.44],'torso'),
 joint('ventL',[-.30,.53,1.54],'capacitor'),
 joint('ventR',[.30,.53,1.54],'capacitor'),
];

const legs=[-1,1].flatMap(side=>{
 const suffix=side<0?'L':'R',x=side*.46;
 return [
  part(`hip axle ${suffix}`,sp('pipe_ring'),[.26,.26,.12],[x-side*.06,.14,1.14],`hip${suffix}`,[0,side*90,0],'metal'),
  part(`single sealed upper load housing ${suffix}`,sp('machine_barrel'),[.27,.29,.50],[x,.14,.64],`hip${suffix}`,[0,0,0],'armor'),
  part(`knee bearing ${suffix}`,sp('pipe_ring'),[.25,.25,.12],[x-side*.06,.14,.64],`knee${suffix}`,[0,side*90,0],'gold'),
  part(`sealed lower load servo ${suffix}`,sp('machine_barrel'),[.26,.28,.50],[x,.14,.14],`knee${suffix}`,[0,0,0],'armor'),
  part(`ankle bearing ${suffix}`,sp('pipe_ring'),[.20,.20,.10],[x-side*.05,.14,.14],`ankle${suffix}`,[0,side*90,0],'metal'),
  part(`single flat contact pad ${suffix}`,sp('corridor_wall'),[.45,.69,.14],[x,.06,0],`ankle${suffix}`,[0,0,0],'metal'),
 ].map(piece=>handed(piece,side));
});

const shieldHalves=[-1,1].flatMap(side=>{
 const suffix=side<0?'L':'R';
 return [
  part(`full hydraulic guide sleeve ${suffix}`,sp('machine_barrel'),[.20,.20,.43],[side*.49,0,1.31],`link${suffix}`,[90,0,0],'gold'),
  part(`captured telescoping slider ${suffix}`,sp('rocket_fuelB'),[.12,.50,.10],[side*.49,-.34,1.33],'ram',[0,0,0],'metal'),
  part(`vertical shield hinge ${suffix}`,sp('machine_barrel'),[.15,.16,.68],[side*.66,-.45,.98],'ram',[0,0,0],'metal'),
  part(`rebated shield door ${suffix}`,sp('corridor_wallCorner'),[.67,.27,1.23],[side*.32,-.55,.59],`shield${suffix}`,[0,0,-side*4],'armor'),
  part(`lower impact shoe ${suffix}`,sp('corridor_wall'),[.62,.23,.13],[side*.32,-.63,.60],`shield${suffix}`,[0,0,-side*4],'metal'),
  part(`field feed rail ${suffix}`,sp('rocket_fuelA'),[.075,.11,.72],[side*.13,-.66,.80],'ram',[0,0,0],'glow'),
 ].map(piece=>handed(piece,side));
});

const base=[
 part('single pelvic load shell',sp('corridor_wall'),[1.08,.80,.35],[0,.14,1.01],'chassis',[0,0,0],'armor'),
 part('ribbed resonator housing',sp('machine_generator'),[.72,.62,.50],[0,.24,1.32],'torso',[0,0,0],'native'),
 part('torso slew bearing',sp('pipe_ring'),[.65,.61,.13],[0,.12,1.31],'torso',[0,0,0],'metal'),
 handed(part('left shoulder socket',sp('rocket_sidesA'),[.29,.45,.48],[-.61,.10,1.19],'torso',[0,0,0],'armor'),-1),
 part('right shoulder socket',sp('rocket_sidesA'),[.29,.45,.48],[.61,.10,1.19],'torso',[0,0,0],'armor'),
 part('forward sight slit',sp('desk_computerScreen'),[.43,.20,.24],[0,-.18,1.76],'sensor',[0,0,0],'glow'),
 part('rear charge accumulator',sp('rocket_fuelB'),[.36,.31,.65],[0,.54,1.16],'capacitor',[0,0,0],'gold'),
 handed(part('left rounded vent shutter',sp('rocket_fuelB'),[.18,.36,.43],[-.29,.54,1.23],'ventL',[0,-12,0],'armor'),-1),
 part('right rounded vent shutter',sp('rocket_fuelB'),[.18,.36,.43],[.29,.54,1.23],'ventR',[0,12,0],'armor'),
 ...legs,
 part('shield ram compact cradle',sp('corridor_wall'),[.88,.30,.33],[0,-.17,1.12],'torso',[0,0,0],'metal'),
 ...shieldHalves,
 part('concave field projector',sp('satelliteDish_detailed'),[.52,.30,.51],[0,-.46,1.07],'emitter',[0,0,0],'glow'),
 part('projector throat bearing',sp('pipe_ring'),[.39,.39,.12],[0,-.48,1.34],'emitter',[90,0,0],'gold'),
 part('shield crown deflector',sp('rocket_topA'),[.39,.34,.30],[0,-.44,1.61],'ram',[0,0,0],'armor'),
];

export default {
 id:'shield_echo',kind:'enemies',role:'normal',locomotion:'walker',rig,variants:{base},
 design:{
  name:'护盾回声',
  silhouette:'Low two-legged walking pavise, split front doors, central projector, rear accumulator and an exposed sight above the shield.',
  loadPath:'Contact pads → ankle/knee/hip bearings → pelvic keel → shoulder sockets → guide links and ram crosshead → vertical shield hinges.',
  attack:'Closed pavise retracts on the guides, then the crosshead drives both shield impact shoes forward before damped recovery.',
  ability:'Self-shield: stance locks; doors unfold about outside hinges, rear shutters vent, accumulator feeds the central projector, then the doors relock.',
  finishRevision:'Each leg has one upper and one lower sealed servo housing. Each shield retains one curved door, one impact shoe and one aligned hydraulic sleeve; the moving slider keeps its shield-strike travel. Rounded rear shutters remain separate from the reservoir.',
  symmetry:'True mirrored shield leaves have opposite curvature. Hip, knee and ankle sleeves use reflected axle origins and rotations. Single thigh housings, flat soles and impact shoes replace overlapping shells and scaled spacecraft; redundant guide cowls and face overlays are removed.',
  sources:'Existing bevelled, surfaced Kenney Space Kit CC0 GLB parts; source models and License.txt are retained in development/assets/model_sources/kenney/space-kit.',
 },
};
