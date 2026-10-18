export const TAU=Math.PI*2;
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const ease=(x,a,b)=>smooth((x-a)/(b-a));
export const pulse=(x,a,b,c)=>ease(x,a,b)*(1-ease(x,b,c));
export const fract=x=>x-Math.floor(x);
// The continuous central tyre rib uses the same 64-point circle in both LODs.
// Contact integration preserves the refined mesh's real supporting radius.
const wheelProfile=Array.from({length:64},(_,i)=>[Math.cos(i*TAU/64)*.5,Math.sin(i*TAU/64)*.5]);
export function wheelSupportHeight(angle,radius,staticYSign=1){
 const c=Math.cos(angle),s=Math.sin(angle);let height=-Infinity;
 for(const [x,y]of wheelProfile)height=Math.max(height,staticYSign*x*c-y*s);
 return radius*2*height;
}
// Integrate the rim support function once. Its perimeter is the distance
// travelled in one revolution; polygonal tyres use their actual contact radius.
const wheelSectors=(()=>{
 const edges=wheelProfile.map(([x,y],i)=>{const [nx,ny]=wheelProfile[(i+1)%wheelProfile.length];return fract(Math.atan2(nx-x,ny-y)/TAU)*TAU;});
 const limits=[0,...edges.filter(a=>a>1e-9&&a<TAU-1e-9).sort((a,b)=>a-b),TAU],sectors=[];let distance=0;
 for(let i=1;i<limits.length;i++){
  const a=limits[i-1],b=limits[i];if(b-a<1e-9)continue;const mid=(a+b)/2,c=Math.cos(mid),s=Math.sin(mid);
  let point=wheelProfile[0],height=-Infinity;for(const v of wheelProfile){const h=v[0]*c-v[1]*s;if(h>height){height=h;point=v;}}
  const [x,y]=point,length=2*(x*(Math.sin(b)-Math.sin(a))+y*(Math.cos(b)-Math.cos(a)));
  sectors.push({a,b,x,y,start:distance,end:distance+length});distance+=length;
 }
 return {sectors,perimeter:distance};
})();
export function wheelRollAngle(travel,radius){
 const distance=Math.max(0,Number.isFinite(travel)?travel:0)/radius,turns=Math.floor(distance/wheelSectors.perimeter),remaining=distance-turns*wheelSectors.perimeter;
 const sector=wheelSectors.sectors.find(s=>remaining<=s.end)||wheelSectors.sectors.at(-1),target=remaining-sector.start;
 let angle=sector.a+(sector.b-sector.a)*target/(sector.end-sector.start);
 for(let i=0;i<3;i++){
  const travelled=2*(sector.x*(Math.sin(angle)-Math.sin(sector.a))+sector.y*(Math.cos(angle)-Math.cos(sector.a)));
  angle-=(travelled-target)/wheelSupportHeight(angle,1);
 }
 return turns*TAU+angle;
}
/** Three mechanical phases: prepare, work stroke, return. */
export const stroke=(x,prepare=.24,impact=.42)=>x<prepare?-smooth(x/prepare)*.35:x<impact?-.35+1.35*smooth((x-prepare)/(impact-prepare)):1-smooth((x-impact)/(1-impact));
/** Contact-aware two-link gait. Stance occupies 62%; swing lifts the foot. */
export function gait(phase,{stride=.34,lift=.17,upper=.52,lower=.52}={}){
 const p=fract(phase),stance=p<.62,t=stance?p/.62:(p-.62)/.38;
 const forward=stance?stride*(.5-t):stride*(-.5+smooth(t));
 const height=stance?0:lift*Math.sin(Math.PI*t),vertical=Math.min(upper+lower-.002,upper+lower-.025-height);
 const distance=Math.min(upper+lower-.001,Math.hypot(forward,vertical));
 const knee=Math.PI-Math.acos(clamp((upper*upper+lower*lower-distance*distance)/(2*upper*lower),-1,1));
 const hip=Math.atan2(forward,vertical)-Math.acos(clamp((upper*upper+distance*distance-lower*lower)/(2*upper*distance),-1,1));
 return {hip,knee,ankle:-hip-knee,forward,height,stance};
}
