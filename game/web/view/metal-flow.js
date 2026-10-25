const LIMITS=Object.freeze({menu:Object.freeze({pixels:180000,fps:20}),battle:Object.freeze({pixels:90000,fps:10})});
const VERTEX=`attribute vec2 aPosition;
void main(){gl_Position=vec4(aPosition,0.0,1.0);}`;
const FRAGMENT=`precision mediump float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uStrength;
void main(){
 vec2 p=(gl_FragCoord.xy/uResolution-.5)*vec2(uResolution.x/uResolution.y,1.0);
 p=mat2(.944,-.330,.330,.944)*p;
 float t=uTime;
 vec2 q=p+vec2(.23*sin(p.y*2.2+t*.15),.16*sin(p.x*2.0-t*.11));
 float a=q.x*4.5+q.y*1.6+.85*sin(q.y*3.1+t*.12);
 float b=q.x*2.4-q.y*3.3+.55*sin(q.x*2.0-t*.13);
 vec2 slope=vec2(4.5*cos(a)+.38*(2.4+1.1*cos(q.x*2.0-t*.13))*cos(b),
  (1.6+2.635*cos(q.y*3.1+t*.12))*cos(a)-1.254*cos(b));
 vec3 normal=normalize(vec3(slope*.24,1.0));
 vec3 reflection=reflect(vec3(0.0,0.0,-1.0),normal);
 float spectrum=smoothstep(-.6,.75,q.x+.30*sin(q.y*2.3-t*.09));
 vec3 blue=vec3(.055,.19,.43),pink=vec3(.40,.095,.30);
 vec3 metal=mix(blue,pink,spectrum);
 float foil=.5+.5*sin(reflection.x*5.2+reflection.y*2.7);
 metal*=.44+.85*foil;
 float silver=pow(max(0.0,dot(normal,normalize(vec3(-.55,.68,.60)))),18.0);
 float rim=pow(max(0.0,dot(normal,normalize(vec3(.65,-.48,.58)))),28.0);
 float seam=pow(max(0.0,1.0-abs(reflection.y*.85+reflection.x*.35-.19)),28.0);
 metal+=vec3(.60,.76,1.0)*silver*.62+vec3(1.0,.50,.78)*rim*.60;
 metal+=mix(vec3(.48,.67,.95),vec3(.96,.66,.81),spectrum)*seam*.19;
 float falloff=1.0-.24*smoothstep(.2,1.2,length(p*vec2(.65,1.0)));
 vec3 color=(metal*falloff+vec3(.018,.025,.055))*uStrength;
 gl_FragColor=vec4(color/(1.0+color*.30),1.0);
}`;
const instances=new WeakMap();

/** One viewport surface. UI panels share this image instead of owning animations. */
export class MetalFlowBackground{
 constructor(root,{reducedMotion=false}={}){
  if(!root?.ownerDocument)throw new TypeError('MetalFlowBackground requires a DOM root.');
  instances.get(root)?.destroy();
  this.root=root;this.document=root.ownerDocument;this.window=this.document.defaultView;
  this.mode='menu';this.preference=!!reducedMotion;this.destroyed=false;
  this.frames=0;this.elapsed=0;this.lastTime=null;this.lastDrawAt=-Infinity;
  this.lastSubmitMs=0;this.maxSubmitMs=0;this.totalSubmitMs=0;this.contextLosses=0;
  this.timer=null;this.raf=null;this.resizeTimer=null;this.resources=null;this.gl=null;
  this.canvas=this.document.createElement('canvas');this.canvas.className='metal-flow-canvas';
  this.canvas.setAttribute('aria-hidden','true');root.append(this.canvas);
  root.classList.add('metal-background');root.setAttribute('aria-hidden','true');
  this.document.body.classList.add('has-metal-flow');instances.set(root,this);
  this.media=this.window.matchMedia?.('(prefers-reduced-motion: reduce)');
  this.onVisibility=()=>this.sync();
  this.onMotion=()=>this.sync();
  this.onResize=()=>{
   if(this.resizeTimer!==null)this.window.clearTimeout(this.resizeTimer);
   this.resizeTimer=this.window.setTimeout(()=>{this.resizeTimer=null;this.resize();this.sync();},120);
  };
  this.onLost=event=>{
   event.preventDefault();this.contextLosses++;this.resources=null;
   this.backend='css';this.fallbackReason='context-lost';this.sync();
  };
  this.onRestored=()=>{if(!this.destroyed){this.initialize();this.resize();this.sync();}};
  this.document.addEventListener('visibilitychange',this.onVisibility);
  this.window.addEventListener('resize',this.onResize);
  this.media?.addEventListener?.('change',this.onMotion);
  this.canvas.addEventListener('webglcontextlost',this.onLost);
  this.canvas.addEventListener('webglcontextrestored',this.onRestored);
  this.initialize();this.resize();this.sync();
 }
 get reducedMotion(){return this.preference||!!this.media?.matches;}
 get limits(){return this.mode==='battle'?LIMITS.battle:LIMITS.menu;}
 get stats(){return Object.freeze({
  backend:this.backend,mode:this.mode,frames:this.frames,width:this.canvas.width,height:this.canvas.height,
  pixels:this.canvas.width*this.canvas.height,pixelBudget:this.limits.pixels,targetFps:this.limits.fps,
  reducedMotion:this.reducedMotion,hidden:!!this.document.hidden,destroyed:this.destroyed,
  scheduled:this.timer!==null||this.raf!==null,contextLosses:this.contextLosses,
  lastSubmitMs:this.lastSubmitMs,maxSubmitMs:this.maxSubmitMs,
  meanSubmitMs:this.frames?this.totalSubmitMs/this.frames:0,fallbackReason:this.fallbackReason||null
 });}
 initialize(){
  this.releaseResources();this.backend='css';this.fallbackReason=null;
  try{
   const gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,
    preserveDrawingBuffer:false,powerPreference:'low-power',failIfMajorPerformanceCaveat:true});
   if(!gl){this.fallbackReason='webgl-unavailable';return;}
   this.gl=gl;
   const shaders=[];let program=null,buffer=null;
   try{
    for(const [type,source]of [[gl.VERTEX_SHADER,VERTEX],[gl.FRAGMENT_SHADER,FRAGMENT]]){
     const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
     if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error('shader-compilation');
    }
    program=gl.createProgram();for(const shader of shaders)gl.attachShader(program,shader);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('program-link');
    buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    this.resources={program,buffer,position:gl.getAttribLocation(program,'aPosition'),
     resolution:gl.getUniformLocation(program,'uResolution'),time:gl.getUniformLocation(program,'uTime'),
     strength:gl.getUniformLocation(program,'uStrength')};
    this.backend='webgl';
   }catch(error){
    if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);
    this.fallbackReason=error.message;
   }finally{for(const shader of shaders)if(shader)gl.deleteShader(shader);}
  }catch{this.fallbackReason='webgl-unavailable';}
 }
 releaseResources(){
  if(this.gl&&this.resources){this.gl.deleteBuffer(this.resources.buffer);this.gl.deleteProgram(this.resources.program);}
  this.resources=null;
 }
 resize(){
  if(this.destroyed)return;
  const box=this.root.getBoundingClientRect(),width=Math.max(1,Math.round(box.width||this.window.innerWidth||1)),
   height=Math.max(1,Math.round(box.height||this.window.innerHeight||1));
  const scale=Math.min(1,Math.sqrt(this.limits.pixels/(width*height)),1024/width,1024/height);
  const w=Math.max(1,Math.floor(width*scale)),h=Math.max(1,Math.floor(height*scale));
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
 }
 cancel(){
  if(this.timer!==null)this.window.clearTimeout(this.timer);
  if(this.raf!==null)this.window.cancelAnimationFrame(this.raf);
  this.timer=null;this.raf=null;this.lastTime=null;
 }
 sync(){
  if(this.destroyed)return;
  this.cancel();
  this.root.dataset.renderer=this.backend;this.root.dataset.mode=this.mode;
  this.root.dataset.motion=this.reducedMotion?'reduced':'flow';
  this.root.dataset.hidden=String(!!this.document.hidden);
  if(this.document.hidden)return;
  if(this.backend==='webgl')this.draw(this.window.performance.now());
  this.schedule();
 }
 schedule(){
  if(this.destroyed||this.document.hidden||this.reducedMotion||this.backend!=='webgl'||this.timer!==null||this.raf!==null)return;
  const delay=Math.max(0,1000/this.limits.fps-(this.window.performance.now()-this.lastDrawAt));
  this.timer=this.window.setTimeout(()=>{
   this.timer=null;
   if(this.destroyed||this.document.hidden||this.reducedMotion)return;
   this.raf=this.window.requestAnimationFrame(time=>{this.raf=null;this.draw(time);this.schedule();});
  },delay);
 }
 draw(time){
  if(this.destroyed||this.document.hidden||this.backend!=='webgl'||!this.resources)return;
  if(!this.reducedMotion&&this.lastTime!==null)this.elapsed+=Math.max(0,Math.min(500,time-this.lastTime));
  this.lastTime=time;this.lastDrawAt=time;
  const start=this.window.performance.now(),gl=this.gl,r=this.resources;
  gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.useProgram(r.program);gl.bindBuffer(gl.ARRAY_BUFFER,r.buffer);
  gl.enableVertexAttribArray(r.position);gl.vertexAttribPointer(r.position,2,gl.FLOAT,false,0,0);
  gl.uniform2f(r.resolution,this.canvas.width,this.canvas.height);gl.uniform1f(r.time,this.elapsed/1000);
  gl.uniform1f(r.strength,this.mode==='battle'?.75:1.0);gl.drawArrays(gl.TRIANGLES,0,3);
  this.lastSubmitMs=Math.max(0,this.window.performance.now()-start);this.maxSubmitMs=Math.max(this.maxSubmitMs,this.lastSubmitMs);
  this.totalSubmitMs+=this.lastSubmitMs;this.frames++;
 }
 setMode(mode){
  const next=typeof mode==='string'?mode:'menu';if(this.destroyed||next===this.mode)return;
  this.mode=next;this.resize();this.sync();
 }
 setReducedMotion(value){
  const next=!!value;if(this.destroyed||next===this.preference)return;this.preference=next;this.sync();
 }
 destroy(){
  if(this.destroyed)return;this.destroyed=true;this.cancel();
  if(this.resizeTimer!==null)this.window.clearTimeout(this.resizeTimer);this.resizeTimer=null;
  this.document.removeEventListener('visibilitychange',this.onVisibility);
  this.window.removeEventListener('resize',this.onResize);this.media?.removeEventListener?.('change',this.onMotion);
  this.canvas.removeEventListener('webglcontextlost',this.onLost);this.canvas.removeEventListener('webglcontextrestored',this.onRestored);
  this.releaseResources();this.gl?.getExtension?.('WEBGL_lose_context')?.loseContext();this.gl=null;
  this.canvas.remove();this.root.classList.remove('metal-background');
  for(const name of ['renderer','mode','motion','hidden'])delete this.root.dataset[name];
  this.document.body.classList.remove('has-metal-flow');instances.delete(this.root);
 }
}
