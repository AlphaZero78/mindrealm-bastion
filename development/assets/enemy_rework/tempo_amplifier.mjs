import {part,joint,sp,handed} from '../../web-tools/enemy-model-authoring.mjs';

// Model space: X right, Y rear, Z up, forward -Y. The acoustic unit is
// carried by one folded chassis shell; each wheel keeps its real X axle.
const rig=[
 joint('chassis',[0,0,.38]),
 joint('suspensionL',[-.66,0,.35],'chassis'),
 joint('suspensionR',[.66,0,.35],'chassis'),
 joint('wheelLF',[-.83,-.49,.27],'chassis'),
 joint('wheelLR',[-.83,.47,.27],'chassis'),
 joint('wheelRF',[.83,-.49,.27],'chassis'),
 joint('wheelRR',[.83,.47,.27],'chassis'),
 joint('amplifier',[0,.14,.74],'chassis'),
 joint('hornTilt',[0,-.38,1.10],'amplifier'),
 joint('diaphragm',[0,-.71,1.26],'hornTilt'),
 joint('baffleL',[-.54,-.10,1.10],'amplifier'),
 joint('baffleR',[.54,-.10,1.10],'amplifier'),
 joint('ventL',[-.50,.32,1.03],'amplifier'),
 joint('ventR',[.50,.32,1.03],'amplifier'),
 joint('striker',[0,-.59,.46],'chassis'),
 joint('governor',[0,.595,1.13],'amplifier'),
 joint('sensor',[0,.06,1.22],'amplifier'),
 joint('driver',[0,.36,1.10],'amplifier'),
];

const flanks=[-1,1].flatMap(side=>{
 const suffix=side<0?'L':'R';
 return [
  handed(part(`single suspension rail ${suffix}`,sp('corridor_wall'),[.20,1.20,.22],[side*.64,0,.27],`suspension${suffix}`,[0,0,0],'metal'),side),
  handed(part(`acoustic baffle hinge sleeve ${suffix}`,sp('rocket_fuelA'),[.12,.12,.42],[side*.54,-.10,.86],'amplifier',[0,0,0],'metal'),side),
  handed(part(`outward curved acoustic baffle ${suffix}`,sp('corridor_wallCorner'),[.20,.60,.50],[side*.61,-.16,.86],`baffle${suffix}`,[0,0,0],'armor'),side),
  handed(part(`single flush heat shutter ${suffix}`,sp('corridor_wall'),[.12,.34,.20],[side*.50,.32,.92],`vent${suffix}`,[0,side*7,0],'metal'),side),
 ];
});

const wheels=[-1,1].flatMap(side=>[-.49,.47].flatMap((y,index)=>{
 const suffix=(side<0?'L':'R')+(index===0?'F':'R');
 return [
  handed(part(`short fixed axle sleeve ${suffix}`,sp('rocket_fuelA'),[.20,.20,.12],[side*.64,y,.27],'chassis',[0,side*90,0],'metal'),side),
  // Both tyre mounts retain the same X axle and half-depth origin correction.
  part(`machined drive wheel ${suffix}`,'refined/drive-wheel',[.54,.54,.18],[side*.83-.09,y,.27],`wheel${suffix}`,[0,90,0],'native'),
 ];
}));

const base=[
 part('single folded chassis load shell',sp('corridor_wall'),[1.34,1.30,.32],[0,0,.34],'chassis',[0,0,0],'armor'),
 part('single acoustic amplifier casing',sp('machine_generatorLarge'),[1.02,.90,.55],[0,.08,.65],'amplifier',[0,0,0],'native'),
 part('timing display and sight',sp('desk_computerScreen'),[.30,.21,.22],[0,.06,1.18],'sensor',[0,0,0],'glow'),
 part('acoustic power driver',sp('machine_barrelLarge'),[.34,.34,.44],[0,.36,.88],'driver',[0,0,0],'gold'),
 ...flanks,
 ...wheels,
 part('acoustic gimbal cradle',sp('gate_simple'),[.87,.26,.44],[0,-.29,.83],'amplifier',[0,0,0],'metal'),
 part('single concave acoustic horn',sp('satelliteDish_detailed'),[.82,.57,.63],[0,-.47,.95],'hornTilt',[0,0,0],'native'),
 part('captured moving diaphragm throat',sp('rocket_fuelB'),[.24,.24,.22],[0,-.42,1.26],'diaphragm',[90,0,0],'glow'),
 part('single captured impact ram sleeve',sp('rocket_sidesA'),[.23,.23,.52],[0,-.24,.46],'chassis',[90,0,0],'gold'),
 part('broad blunt contact shoe',sp('corridor_wall'),[.66,.24,.20],[0,-.75,.32],'striker',[0,0,0],'armor'),
 part('governor bearing pedestal',sp('rocket_sidesA'),[.23,.30,.40],[0,.54,.70],'amplifier',[0,0,0],'metal'),
 part('annular timing flywheel',sp('rocket_fuelA'),[.40,.40,.085],[0,.64,1.13],'governor',[90,0,0],'gold'),
 part('flywheel timing cam',sp('corridor_wall'),[.075,.08,.13],[.06,.56,1.11],'governor',[0,0,0],'accent'),
 part('captured impact ram shaft',sp('rocket_fuelA'),[.11,.11,.50],[0,-.365,.46],'striker',[90,0,0],'metal'),
];

export default {
 id:'tempo_amplifier',kind:'enemies',role:'normal',locomotion:'crawler',rig,variants:{base},
 design:{
  name:'节拍增幅器',
  silhouette:'Low four-wheel acoustic command machine: wide continuous keel, one concave front horn, folding baffle cheeks and one exposed rear timing flywheel.',
  loadPath:'Four short axle sleeves → one longitudinal suspension rail per side → one folded chassis shell → one amplifier casing → horn cradle and baffle hinges. Each left baffle is a true source-vertex X reflection of its right counterpart.',
  attack:'A lower impact shoe retracts within its sleeve, advances along a crossmember guide, contacts the blocker, then returns. The upper horn aims while the tires remain planted.',
  ability:'Haste uses 1.1 s preparation: baffles unfold, heat shutters open and the driver loads the diaphragm. Release makes one strong diaphragm stroke; ctx.boosted holds a 4 s working aperture while the timing cam repeats smaller mechanical strokes.',
  refinement:'29 structural parts. All compressed cargo/speeder shells, duplicate wheel fairings, secondary crossmembers, extra horn rings and the second sensor/power box are removed. The chassis, carried amplifier and working horn read as three distinct levels. Paired rails, baffles, hinges, shutters and axle sleeves use handed source geometry; wheel mounts and all rig pivots stay unchanged.',
  partCount:29,
  sources:'Registered Kenney Space Kit CC0 GLB parts; original sources and License.txt retained in development/assets/model_sources/kenney/space-kit.',
 },
};
