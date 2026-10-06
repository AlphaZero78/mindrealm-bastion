import * as T from '../../assets/third_party/three/three.bundle.js';

const radians=Math.PI/180,S=Math.sin(55*radians),C=Math.cos(55*radians),TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const PALETTE={
 towers:{dark:0x27343d,metal:0xb1bdc5,ivory:0xd7dfdf,accent:0x529e9b,glow:0x80f0df,gold:0xcaa565,armor:0x47747b,blade:0xd3e5ed},
 enemies:{dark:0x302c39,metal:0xb9a5a6,ivory:0xd4c5c0,accent:0xc65a53,glow:0xff8c60,gold:0xc89864,armor:0x674455,blade:0xe2cdcc}
};
const degreesToRadians=values=>values.map(v=>v*radians);
const surfaceFor=(surface,finish)=>finish==='native'||surface==='dark'?surface:surface==='accent'||finish==='blade'||finish==='glow'?finish:surface==='metal'?'metal':finish;

/** Articulated, instanced parts. No game state is written by this renderer. */
export class EntityRenderer{
 constructor({onError=()=>{},canvas=document.createElement('canvas')}={}){
  this.canvas=canvas;this.onError=onError;this.ready=false;this.disposed=false;this.errors=[];this.sources=new Map();this.batches=new Map();this.materials=new Map();this.turns=new Map();this.frames=[];
  this.renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance',premultipliedAlpha:true});
  this.renderer.setClearColor(0x000000,0);this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.06;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;
  this.scene=new T.Scene();this.camera=new T.OrthographicCamera(-1,1,1,-1,.1,300);
  this.scene.add(new T.HemisphereLight(0xdbefff,0x34433b,.85));
  const key=new T.DirectionalLight(0xffecd4,2.7);key.position.set(5,48,32);key.target.position.set(20,0,20);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-34,right:34,top:34,bottom:-34,near:.5,far:120});key.shadow.bias=-.00015;key.shadow.normalBias=.018;key.shadow.autoUpdate=false;this.keyLight=key;this.scene.add(key,key.target);
  const rim=new T.DirectionalLight(0x8dd7e9,.95);rim.position.set(20,10,-20);this.scene.add(rim);
  this.depthMaterial=new T.MeshBasicMaterial({colorWrite:false,depthWrite:true,side:T.DoubleSide});
  this.depthMesh=new T.Mesh(new T.BufferGeometry(),this.depthMaterial);this.depthMesh.renderOrder=-10;this.depthMesh.frustumCulled=false;this.depthMesh.castShadow=true;this.scene.add(this.depthMesh);
  this.position=new T.Vector3();this.scale=new T.Vector3();this.euler=new T.Euler(0,0,0,'ZYX');this.quat=new T.Quaternion();this.rootQuat=new T.Quaternion();this.spinQuat=new T.Quaternion();this.spinAxis=new T.Vector3(0,0,1);this.matrix=new T.Matrix4();this.rootMatrix=new T.Matrix4();this.color=new T.Color();this.up=new T.Vector3(0,1,0);
  this.axis=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2);this.inverseAxis=this.axis.clone().invert();
  this.stats={mode:'realtime-webgl',ready:false,drawCalls:0,triangles:0,instances:0,entities:0,sourceCount:0,lod:[0,0]};
  this.readyPromise=this.load().catch(error=>{this.errors.push(String(error?.message||error));onError(`实时模型加载失败：${error?.message||error}`);return false;});
 }
 async load(){
  const response=await fetch('/assets/game/models/models.json');if(!response.ok)throw Error(`模型索引 ${response.status}`);this.catalog=await response.json();
  if(this.catalog.format!==1)throw Error('模型索引格式不受支持');
  const loader=new T.GLTFLoader(),jobs=Object.entries(this.catalog.sources);let cursor=0;
  const workers=Array.from({length:4},async()=>{while(cursor<jobs.length){const [source,definition]=jobs[cursor++],gltf=await loader.loadAsync(definition.path),lod=[[],[]];gltf.scene.updateMatrixWorld(true);
   gltf.scene.traverse(node=>{if(!node.isMesh)return;const level=Number(node.userData.lod),surface=node.userData.surface;if(![0,1].includes(level)||!Object.hasOwn(PALETTE.towers,surface))throw Error(`无效模型分组 ${source}/${node.name}`);const geometry=node.geometry.clone().applyMatrix4(node.matrixWorld);geometry.computeBoundingSphere();lod[level].push({geometry,surface,key:`${source}:${level}:${lod[level].length}`});});
   if(!lod[0].length||!lod[1].length)throw Error(`缺少模型细节等级 ${source}`);this.sources.set(source,lod);
   const obsolete=new Set();gltf.scene.traverse(node=>{if(node.isMesh){obsolete.add(node.geometry);for(const mat of(Array.isArray(node.material)?node.material:[node.material]))obsolete.add(mat);}});for(const item of obsolete)item.dispose();
  }});
  const environment=fetch('/assets/game/lighting/studio_small_09_pmrem.bin').then(async response=>{
   if(!response.ok)throw Error(`环境光资源 ${response.status}`);const data=await response.arrayBuffer();if(data.byteLength!==768*1024*8)throw Error('环境光资源尺寸错误');
   const texture=new T.DataTexture(new Uint16Array(data),768,1024,T.RGBAFormat,T.HalfFloatType);texture.mapping=T.CubeUVReflectionMapping;texture.colorSpace=T.LinearSRGBColorSpace;texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;this.environment={texture,width:768,height:1024,dispose:()=>texture.dispose()};this.scene.environment=texture;this.scene.environmentIntensity=.78;
  });
  const surfaces=Promise.all(['nor_gl.png','rough.jpg','diff.jpg'].map(async name=>{const texture=await new T.TextureLoader().loadAsync(`/assets/third_party/polyhaven/blue_metal_plate_${name}`);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(1.6,1.6);texture.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());if(name==='diff.jpg')texture.colorSpace=T.SRGBColorSpace;return texture;})).then(([normal,roughness,color])=>{this.surfaceNormal=normal;this.surfaceRoughness=roughness;this.surfaceColor=color;});
  await Promise.all([...workers,environment,surfaces]);
  if(this.disposed){this.destroy();return false;}
  for(const definition of Object.values(this.catalog.entities))for(const [name,parts]of Object.entries(definition.variants))definition.variants[name]=parts.map(part=>({...part,rotation:degreesToRadians(part.rotation)}));
  this.ready=true;this.stats.ready=true;this.stats.sourceCount=this.sources.size;return true;
 }
 material(kind,surface,ghost){
  const key=`${kind}:${surface}:${ghost?'ghost':'solid'}`;if(this.materials.has(key))return this.materials.get(key);
  const metal={metal:.94,blade:.99,dark:.68,ivory:.58,gold:.94,armor:.48,accent:.46,glow:.18}[surface];
  const roughness={metal:.22,blade:.14,dark:.42,ivory:.28,gold:.24,armor:.46,accent:.4,glow:.23}[surface];
  const color=PALETTE[kind][surface],glow=surface==='glow';
  const material=new T.MeshStandardMaterial({color,metalness:metal,roughness,map:glow?null:this.surfaceColor,roughnessMap:this.surfaceRoughness,normalMap:glow?null:this.surfaceNormal,normalScale:new T.Vector2(.32,.32),emissive:glow?color:0x000000,emissiveIntensity:glow?.62:0,envMapIntensity:1.1,transparent:ghost,opacity:ghost?.44:1,depthWrite:!ghost});
  if(!glow){material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP\n vec3 wearSample=texture2D(map,vMapUv).rgb;\n float wear=dot(wearSample,vec3(0.2126,0.7152,0.0722));\n diffuseColor.rgb*=mix(0.56,1.06,sqrt(clamp(wear*4.0,0.0,1.0)));\n#endif`);};material.customProgramCacheKey=()=> 'mindrealm-metal-wear-v1';}
  this.materials.set(key,material);return material;
 }
 batch(part,kind,surface,ghost){
  const key=`${part.key}:${kind}:${surface}:${ghost?'g':'s'}`;let batch=this.batches.get(key);
  if(!batch){const material=this.material(kind,surface,ghost);batch={geometry:part.geometry,material,count:0,capacity:16,mesh:null};this.batches.set(key,batch);this.replaceMesh(batch);}
  if(batch.count===batch.capacity){batch.capacity*=2;this.replaceMesh(batch);}
  return batch;
 }
 replaceMesh(batch){
  const old=batch.mesh,mesh=new T.InstancedMesh(batch.geometry,batch.material,batch.capacity);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.renderOrder=batch.material.transparent?2:0;mesh.castShadow=!batch.material.transparent;mesh.receiveShadow=true;
  if(old){mesh.instanceMatrix.array.set(old.instanceMatrix.array);if(old.instanceColor){mesh.setColorAt(0,new T.Color(1,1,1));mesh.instanceColor.array.set(old.instanceColor.array);}this.scene.remove(old);old.dispose();}
  this.scene.add(mesh);batch.mesh=mesh;
 }
 syncTerrain(terrain){
  if(!terrain){this.depthMesh.visible=false;return;}
  this.depthMesh.visible=true;if(terrain===this.terrain&&terrain.revision===this.terrainRevision)return;this.terrain=terrain;this.terrainRevision=terrain.revision;
  this.shadowStamp=null;
  const vertices=[],n=terrain.size,cells=terrain.cells;
  const quad=(a,b,c,d)=>vertices.push(...a,...b,...c,...a,...c,...d);
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
   const height=cells[z*n+x].h*.95;
   quad([x,height,z],[x+1,height,z],[x+1,height,z+1],[x,height,z+1]);
   for(const [dx,dz,a,b]of[[1,0,[x+1,z+1],[x+1,z]],[-1,0,[x,z],[x,z+1]],[0,1,[x,z+1],[x+1,z+1]],[0,-1,[x+1,z],[x,z]]]){
    const nx=x+dx,nz=z+dz,lower=nx<0||nz<0||nx>=n||nz>=n?-1.425:cells[nz*n+nx].h*.95;if(lower>=height)continue;
    quad([a[0],height,a[1]],[b[0],height,b[1]],[b[0],lower,b[1]],[a[0],lower,a[1]]);
   }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));this.depthMesh.geometry.dispose();this.depthMesh.geometry=geometry;
 }
 begin(camera,terrain,width,height){
  if(!this.ready)return;this.view=camera;this.iconMode=false;this.frames=[];this.present=new Set();this.stats.lod=[0,0];this.shadowParts=[];
  this.keyLight.position.set(5,48,32);this.keyLight.target.position.set(20,0,20);Object.assign(this.keyLight.shadow.camera,{left:-34,right:34,top:34,bottom:-34,near:.5,far:120});this.keyLight.shadow.camera.updateProjectionMatrix();
  if(this.canvas.width!==width||this.canvas.height!==height)this.renderer.setSize(width,height,false);
  const w=camera.width/camera.scale,h=camera.height/camera.scale;Object.assign(this.camera,{left:-w/2,right:w/2,top:h/2,bottom:-h/2});this.camera.updateProjectionMatrix();
  const focusY=camera.focusY||0;this.camera.position.set(camera.x+Math.sin(camera.yaw)*C*100,focusY+S*100,camera.z+Math.cos(camera.yaw)*C*100);this.camera.lookAt(camera.x,focusY,camera.z);this.camera.updateMatrixWorld();this.syncTerrain(terrain);
  for(const batch of this.batches.values()){batch.count=0;batch.mesh.visible=false;}
 }
 add(type,pose,g,{opacity=1,wreck=false,reducedMotion=false,definition=this.catalog?.entities[type]}={}){
  if(!this.ready)return;if(!definition)throw Error(`缺少模型 ${type}`);
  const parts=definition.variants[pose.variant]||Object.values(definition.variants)[0],bounds=definition.bounds,enemy=definition.kind==='enemies',ghost=pose.action==='preview';
  let size=this.iconMode?1:enemy?(definition.role==='boss'?4.5:definition.role==='elite'?2.95:2.2)/Math.max(bounds.x,bounds.z):Math.min(g.fp[0],g.fp[1])*1.18/Math.min(bounds.x,bounds.z);
  if(!enemy&&!this.iconMode)size=Math.min(size,Math.max(...g.fp)*1.18/Math.max(bounds.x,bounds.z));
  size*=1-(pose.spawn||0)*.15;
  const apparent=Math.max(bounds.x,bounds.z,bounds.y)*size*this.view.scale,level=this.iconMode||apparent>=54?0:1;
  let facing=pose.facing||0,turn=this.turns.get(pose.key),clock=pose.clock||0;
  if(turn&&!ghost&&!this.iconMode&&!reducedMotion){const delta=((facing-turn.angle+Math.PI)%TAU+TAU)%TAU-Math.PI,step=clamp((clock-turn.clock)/1000,0,.1)*18;facing=turn.angle+clamp(delta,-step,step);}
  this.turns.set(pose.key,{angle:facing,clock});this.present.add(pose.key);
  const falling=pose.action==='death'?clamp(pose.progress,0,1):0;
  this.rootQuat.setFromAxisAngle(this.up,facing);if(falling&&!reducedMotion)this.rootQuat.multiply(this.spinQuat.setFromAxisAngle(this.spinAxis,falling*.65));this.position.set(g.x,g.h*.95+.025,g.z);this.scale.set(size,size*(falling?1-falling*.72:wreck?.33:1),size);
  if(pose.action==='hover'&&!reducedMotion)this.position.y+=Math.sin(pose.progress*TAU)*size*.085;
  this.rootMatrix.compose(this.position,this.rootQuat,this.scale);
  const active=!['disabled','wreck','preview','death'].includes(pose.action),cycle=active&&['move','hover'].includes(pose.action)&&!reducedMotion?Math.sin(pose.progress*TAU):0;
  const progress=clamp(pose.progress||0,0,1),attack=pose.action==='attack'?(reducedMotion?.8:progress<.17?-.36*Math.sin(progress/.17*Math.PI):Math.sin((progress-.17)/.83*Math.PI)*Math.exp(-(progress-.17)*1.6)):0;
  const cast=pose.action==='cast'?(reducedMotion?.7:Math.sin(progress*Math.PI)*.55+.3):0;
  this.stats.lod[level]++;
  if(!ghost)this.shadowParts.push(`${pose.key}:${type}:${pose.variant}:${g.x.toFixed(3)}:${g.z.toFixed(3)}:${g.h}:${size.toFixed(3)}:${facing.toFixed(3)}:${wreck}:${falling.toFixed(3)}:${level}:${cycle.toFixed(3)}:${attack.toFixed(3)}:${cast.toFixed(3)}`);
  for(const part of parts){
   if(level===1&&part.detail)continue;
   let [px,py,pz]=part.position,[rx,ry,rz]=part.rotation;const motion=part.motion,side=motion.endsWith('L')?-1:1;
   if(motion.startsWith('leg')){rx+=cycle*.44*side;py+=cycle*.15*side;pz+=Math.max(0,Math.cos(progress*TAU)*side)*.12*Math.abs(cycle);}
   else if(motion.startsWith('wheel')){} // Spin around the part's original axle below.
   else if(motion.startsWith('drive')){py+=cycle*.11*side;pz+=cycle*.045*side;}
   else if(motion.startsWith('segment')){const index=Number(motion.at(-1))||0;px+=cycle?Math.sin(progress*TAU+index*.85)*.23:0;rz+=cycle*.13;if(index===2){py-=attack*.29;rx-=attack*.14;}}
   else if(motion.startsWith('blade')){ry+=attack*.62*side;rz+=attack*.62*side;py-=Math.max(0,attack)*.34;}
   else if(/^(barrel|hammer|mortar)/.test(motion)){py+=attack*.28;rx-=attack*(motion==='mortar'?.28:.15);rx+=cast*.1;}
   else if(motion.startsWith('loader'))py+=attack*.18;
   else if(/^(tool|arm)/.test(motion)){rx+=(attack*.34+cast*.39)*side;rz+=(attack*.17+cast*.33)*side;py-=attack*.12+cast*.17;}
   else if(motion.startsWith('shield')){px+=cast*.17*side;py-=attack*.22;rz+=(cast*.29-attack*.12)*side;}
   else if(/^(sensor|speaker)/.test(motion)){rz+=cycle*.13+cast*.23*side;rx+=cast*.24;}
   else if(/^(fin|brace)/.test(motion))ry+=(cycle*.09+cast*.26)*side;
   else if(/^(drone|pod|reservoir)/.test(motion)){pz+=(motion.startsWith('drone')?cycle*.12*side:0)+cast*.18;px+=cast*.14*side;rz+=cycle*.12*side;if(motion.startsWith('drone')){py-=attack*.31;pz+=attack*.2;rx-=attack*.19;}}
   else if(motion==='ring'||motion==='gate'){rz+=cast*.28;pz+=cast*.09;}
   else if(['core','head','engine'].includes(motion)){pz+=cast*.15;rz+=cast*.13;if(motion==='head')rx-=attack*.18;}
   else if(motion==='body'){if(enemy){rx-=attack*.16;py-=attack*.16;}if(['walker','runner'].includes(definition.locomotion)){rz+=cycle*.045;pz+=Math.abs(cycle)*.045;}else if(definition.locomotion==='crawler'){ry+=cycle*.045;pz+=cycle*.035;}}
   this.position.set(px,pz,-py);this.euler.set(rx,ry,rz,'ZYX');this.quat.setFromEuler(this.euler);if(motion.startsWith('wheel')&&active&&pose.action==='move'&&!reducedMotion)this.quat.multiply(this.spinQuat.setFromAxisAngle(this.spinAxis,progress*TAU*2));this.quat.premultiply(this.axis).multiply(this.inverseAxis);this.scale.set(part.size[0],part.size[2],part.size[1]);this.matrix.compose(this.position,this.quat,this.scale).premultiply(this.rootMatrix);
   for(const primitive of this.sources.get(part.source)[level]){
    const surface=surfaceFor(primitive.surface,part.finish),batch=this.batch(primitive,definition.kind,surface,ghost),index=batch.count++;
    batch.mesh.setMatrixAt(index,this.matrix);const shade=wreck?.28:pose.action==='disabled'?.36:opacity<1?opacity:1,hit=pose.hit||0;this.color.setRGB(shade*(1+hit*.75),shade*(1+hit*.75),shade*(1+hit*.75));batch.mesh.setColorAt(index,this.color);
   }
  }
  this.frames.push({key:pose.key,type,variant:pose.variant,action:pose.action,facing,progress:pose.progress,lod:level,size,parts:parts.length});
 }
 addDrone(drone,geometry,clock){
  if(!this.ready)return;if(!this.droneDefinition){const source=this.catalog.entities.drone_loom.variants.T1.find(p=>p.motion.startsWith('drone'));this.droneDefinition={kind:'towers',role:'projectile',locomotion:'hover',bounds:{x:.55,y:.29,z:.78},variants:{base:[{...source,position:[0,0,0],rotation:[0,0,0],motion:'body'}]}};}
  this.add('tracking_drone',{key:`drone:${drone.id}`,variant:'base',action:'idle',clock,progress:0,facing:drone.facing}, {...geometry,fp:[.75,.9]},{definition:this.droneDefinition});
 }
 flush(){
  if(!this.ready)return false;let instances=0;
  for(const batch of this.batches.values())if(batch.count){const mesh=batch.mesh;mesh.visible=true;mesh.count=batch.count;mesh.instanceMatrix.clearUpdateRanges();mesh.instanceMatrix.addUpdateRange(0,batch.count*16);mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor){mesh.instanceColor.clearUpdateRanges();mesh.instanceColor.addUpdateRange(0,batch.count*3);mesh.instanceColor.needsUpdate=true;}instances+=batch.count;}
  for(const key of this.turns.keys())if(!this.present.has(key))this.turns.delete(key);
  const shadowStamp=`${this.iconMode}:${this.depthMesh.visible}:${this.shadowParts.join('|')}`;if(shadowStamp!==this.shadowStamp){this.keyLight.shadow.needsUpdate=true;this.shadowStamp=shadowStamp;}
  this.renderer.render(this.scene,this.camera);Object.assign(this.stats,{drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,instances,entities:this.frames.length,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,width:this.canvas.width,height:this.canvas.height});return true;
 }
 renderIcon(type,variant,cell=256){
  const definition=this.catalog.entities[type],b=definition.bounds,span=Math.max(b.x,b.z,b.y*1.05);this.begin({x:0,z:0,yaw:Math.PI/4,width:cell,height:cell,scale:cell/(span*1.42),focusY:b.y*.47},null,cell,cell);this.iconMode=true;
  this.keyLight.position.set(-7,10,6);this.keyLight.target.position.set(0,b.y*.5,0);Object.assign(this.keyLight.shadow.camera,{left:-span,right:span,top:span,bottom:-span,near:.5,far:35});this.keyLight.shadow.camera.updateProjectionMatrix();
  this.add(type,{key:'icon',clock:0,action:'idle',progress:0,facing:0,variant},{x:0,z:0,h:0,fp:[2,2]});this.flush();return this.canvas;
 }
 snapshot(){return {...this.stats,lod:[...this.stats.lod],errors:[...this.errors]};}
 destroy(){this.disposed=true;for(const batch of this.batches.values())batch.mesh.dispose();for(const lod of this.sources.values())for(const list of lod)for(const part of list)part.geometry.dispose();for(const material of this.materials.values())material.dispose();this.environment?.dispose();this.surfaceNormal?.dispose();this.surfaceRoughness?.dispose();this.surfaceColor?.dispose();this.keyLight.shadow.map?.dispose();this.depthMesh.geometry.dispose();this.depthMaterial.dispose();this.renderer.dispose();this.batches.clear();this.sources.clear();}
}
