import {seededRandom} from './content.js';

export const WORLD_GENERATION=2;
export const LANDFORMS=['交错山脊','离散台群','环形洼地','双脊峡谷','破碎高原'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const directions=[[0,-1],[1,0],[0,1],[-1,0]];

/** A seed owns both the landform and its branching, cardinally connected roads. */
export function generateTerrain(seed){
 const random=seededRandom(`${seed}:terrain:2`),size=41,core={x:20,z:38,size:5};
 const entries=[{id:'north',name:'北入口',x:10+Math.floor(random()*21),z:0},{id:'west',name:'西入口',x:0,z:10+Math.floor(random()*17)},{id:'east',name:'东入口',x:40,z:10+Math.floor(random()*17)}];
 const profile=Math.floor(random()*LANDFORMS.length),smooth=t=>t*t*(3-2*t);
 const noise=scale=>{const width=Math.ceil(size/scale)+2,values=Array.from({length:width*width},()=>random()*2-1);return(x,z)=>{const fx=clamp(x/scale,0,width-1.001),fz=clamp(z/scale,0,width-1.001),ix=Math.floor(fx),iz=Math.floor(fz),tx=smooth(fx-ix),tz=smooth(fz-iz),a=values[iz*width+ix]*(1-tx)+values[iz*width+ix+1]*tx,b=values[(iz+1)*width+ix]*(1-tx)+values[(iz+1)*width+ix+1]*tx;return a*(1-tz)+b*tz;};};
 const warpX=noise(8+random()*7),warpZ=noise(8+random()*7),coarse=noise(9+random()*8),detail=noise(3.5+random()*3),rotation=random()*Math.PI;
 const hills=Array.from({length:5+Math.floor(random()*7)},(_,i)=>({x:4+random()*33,z:4+random()*30,rx:(profile===1?4:6)+random()*7,rz:4+random()*8,angle:rotation+(random()-.5)*2,height:3.5+random()*2}));
 // Jittered southern shoulders keep the new edge target defensible. They share
 // the same noisy silhouette and erosion as every other hill.
 for(const side of [0,1])hills.push({x:(side?26:8)+random()*7,z:28+random()*7,rx:6+random()*3,rz:5+random()*4,angle:random()*Math.PI,height:4.5+random()});
 const cells=Array.from({length:size*size},(_,i)=>{
  const x=i%size,z=Math.floor(i/size),wx=x+warpX(x,z)*4,wz=z+warpZ(x,z)*4;
  const protectedCell=Math.abs(x-core.x)<=2&&Math.abs(z-core.z)<=2||entries.some(e=>Math.abs(x-e.x)<=1&&Math.abs(z-e.z)<=1);
  let peak=0;for(const h of hills){const dx=wx-h.x,dz=wz-h.z,c=Math.cos(h.angle),s=Math.sin(h.angle),d=Math.hypot((dx*c-dz*s)/h.rx,(dx*s+dz*c)/h.rz);peak=Math.max(peak,h.height-d*3.15);}
  const rotated=(wx-20)*Math.cos(rotation)+(wz-18)*Math.sin(rotation),radial=Math.hypot((wx-20)/1.1,wz-18);
  const shape=profile===0?peak+.5*Math.sin(rotated*.45):profile===1?peak*.95:profile===2?Math.max(peak*.6,3.8-Math.abs(radial-11)*.6):profile===3?Math.max(peak*.55,4.1-Math.abs(Math.abs(rotated)-8)*.55):2.2+coarse(x,z)*2.2+peak*.35;
  return{h:protectedCell?0:clamp(Math.floor(shape+coarse(x,z)*.7+detail(x,z)*.45),0,4),ramp:-1,protected:protectedCell};
 });
 const road=new Set(),carve=(x,z,width)=>{for(let dz=-width;dz<=width;dz++)for(let dx=-width;dx<=width;dx++){if(dx*dx+dz*dz>width*width+1)continue;const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=size||nz>=size)continue;const i=nz*size+nx;cells[i].h=0;road.add(i);}};
 const connect=(from,to,width)=>{let x=from.x,z=from.z;carve(x,z,width);while(x!==to.x||z!==to.z){const dx=to.x-x,dz=to.z-z;if(dx&&(!dz||random()<Math.abs(dx)/(Math.abs(dx)+Math.abs(dz))))x+=Math.sign(dx);else z+=Math.sign(dz);carve(x,z,width);}};
 const junction={x:12+Math.floor(random()*17),z:25+Math.floor(random()*8)},upper={x:8+Math.floor(random()*25),z:12+Math.floor(random()*12)};
 for(const entry of entries){
  const waypoint=entry.id==='north'?{x:clamp(entry.x+Math.floor(random()*17)-8,4,36),z:8+Math.floor(random()*9)}:{x:entry.id==='west'?7+Math.floor(random()*7):27+Math.floor(random()*7),z:clamp(entry.z+Math.floor(random()*15)-7,5,30)};
  const mid=random()<.55?upper:{x:7+Math.floor(random()*27),z:19+Math.floor(random()*11)},width=random()<.3?2:1;
  connect(entry,waypoint,width);connect(waypoint,mid,width);connect(mid,junction,1);connect(junction,core,1);
  if(random()<.45)connect(waypoint,{x:clamp(junction.x+(entry.id==='east'?7:-7),3,37),z:junction.z+2},1);
 }
 // A protected target occupies the old southern entry area, entirely inside the board.
 for(let z=36;z<=40;z++)for(let x=18;x<=22;x++)cells[z*size+x].h=0;
 const erode=()=>{const queue=Array.from({length:cells.length},(_,i)=>i);for(let read=0;read<queue.length;read++){const i=queue[read],x=i%size,z=Math.floor(i/size);for(const [dx,dz]of directions){const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=size||nz>=size)continue;const j=nz*size+nx;if(cells[j].h>cells[i].h+1){cells[j].h=cells[i].h+1;queue.push(j);}}}};
 erode();
 // Existing shelves are preferred. Rare sparse seeds receive irregularly placed
 // low shelves, preserving every road and giving the opening ranged units space.
 const shelfSites=()=>{const result=[];for(let z=24;z<38;z++)for(let x=3;x<36;x++){const h=cells[z*size+x].h;if(h===0||Math.hypot(x+1-core.x,z+1-core.z)>15)continue;let valid=true;for(let dz=0;dz<3&&valid;dz++)for(let dx=0;dx<3;dx++)if(cells[(z+dz)*size+x+dx].h!==h||cells[(z+dz)*size+x+dx].protected){valid=false;break;}if(valid&&!result.some(p=>Math.abs(p.x-x)<4&&Math.abs(p.z-z)<4))result.push({x,z});}return result;};
 if(shelfSites().length<4){
  const candidates=[];for(let z=24;z<38;z++)for(let x=3;x<36;x++){if(Math.hypot(x+1-core.x,z+1-core.z)>13)continue;const area=[];for(let dz=0;dz<3;dz++)for(let dx=0;dx<3;dx++)area.push((z+dz)*size+x+dx);if(area.every(i=>!road.has(i)&&!cells[i].protected))candidates.push({area,weight:random()});}
  candidates.sort((a,b)=>a.weight-b.weight);for(const candidate of candidates){if(shelfSites().length>=4)break;for(const i of candidate.area)cells[i].h=1;erode();}
 }
 if(!cells.some(c=>c.h>=3)){
  // A low-noise plateau still needs one useful summit. Raise a tapered mound
  // away from all reserved roads, then enforce the same slope invariant.
  const sites=[];for(let z=4;z<25;z++)for(let x=4;x<37;x++){const area=[];for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++)if(Math.abs(dx)+Math.abs(dz)<=2)area.push({i:(z+dz)*size+x+dx,h:3-Math.abs(dx)-Math.abs(dz)});if(area.every(p=>!road.has(p.i)&&!cells[p.i].protected))sites.push({area,weight:random()});}
  sites.sort((a,b)=>a.weight-b.weight);if(sites[0])for(const p of sites[0].area)cells[p.i].h=Math.max(cells[p.i].h,p.h);erode();
 }
 return{size,core,entries,cells,revision:0,generation:WORLD_GENERATION,landform:LANDFORMS[profile]};
}
