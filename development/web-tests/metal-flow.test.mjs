import test from 'node:test';
import assert from 'node:assert/strict';
import {MetalFlowBackground} from '../../game/web/view/metal-flow.js';

class Events{
 constructor(){this.listeners=new Map();}
 addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
 removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
 emit(name,event={}){for(const fn of [...(this.listeners.get(name)||[])])fn(event);}
 count(name){return this.listeners.get(name)?.size||0;}
}
const classes=()=>{const values=new Set();return{add:name=>values.add(name),remove:name=>values.delete(name),contains:name=>values.has(name)};};
function mockGL({compile=true,link=true}={}){
 const calls={draws:0,programDeletes:0,bufferDeletes:0,shaderDeletes:0,times:[]};
 return{calls,VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,ARRAY_BUFFER:5,STATIC_DRAW:6,FLOAT:7,TRIANGLES:8,
  createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>compile,deleteShader(){calls.shaderDeletes++;},
  createProgram:()=>({}),attachShader(){},linkProgram(){},getProgramParameter:()=>link,deleteProgram(){calls.programDeletes++;},
  createBuffer:()=>({}),bindBuffer(){},bufferData(){},deleteBuffer(){calls.bufferDeletes++;},
  getAttribLocation:()=>0,getUniformLocation:(_,name)=>name,viewport(){},useProgram(){},enableVertexAttribArray(){},vertexAttribPointer(){},
  uniform2f(){},uniform1f(name,value){if(name==='uTime')calls.times.push(value);},drawArrays(){calls.draws++;}
 };
}
function environment({width=1920,height=1080,webgl=true,compile=true,link=true,reduced=false}={}){
 let clock=0,serial=0;const jobs=new Map(),media=Object.assign(new Events(),{matches:reduced}),window=new Events(),document=new Events();
 Object.assign(window,{innerWidth:width,innerHeight:height,performance:{now:()=>clock},matchMedia:()=>media,
  setTimeout(fn,delay){const id=++serial;jobs.set(id,{at:clock+Math.max(0,delay),fn});return id;},
  clearTimeout:id=>jobs.delete(id),requestAnimationFrame(fn){const id=++serial;jobs.set(id,{at:clock+16,fn:()=>fn(clock)});return id;},cancelAnimationFrame:id=>jobs.delete(id)});
 Object.assign(document,{defaultView:window,hidden:false,body:{classList:classes()},createElement(){
  const gl=webgl?mockGL({compile,link}):null;
  return Object.assign(new Events(),{width:300,height:150,gl,setAttribute(){},getContext:()=>gl,remove(){this.parent.children=this.parent.children.filter(c=>c!==this);}});
 }});
 const root={ownerDocument:document,dataset:{},classList:classes(),children:[],setAttribute(){},append(child){child.parent=this;this.children.push(child);},getBoundingClientRect:()=>({width:window.innerWidth,height:window.innerHeight})};
 function advance(ms){const until=clock+ms;for(let guard=0;guard<10000;guard++){
  const next=[...jobs].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>until){clock=until;return;}
  clock=next[1].at;jobs.delete(next[0]);next[1].fn();
 }throw Error('Scheduler did not quiesce');}
 return{root,document,window,media,jobs,advance};
}

test('one metal surface bounds pixel work and frame submissions in menu and battle',()=>{
 const h=environment({width:7680,height:4320}),flow=new MetalFlowBackground(h.root),gl=flow.canvas.gl;
 assert.equal(flow.stats.backend,'webgl');assert.ok(flow.stats.pixels<=180000);assert.equal(flow.stats.targetFps,20);
 h.advance(2000);assert.ok(flow.stats.frames>15&&flow.stats.frames<=41);
 const before=flow.stats.frames;flow.setMode('battle');assert.ok(flow.stats.pixels<=90000);assert.equal(flow.stats.targetFps,10);
 h.advance(2000);assert.ok(flow.stats.frames-before>8&&flow.stats.frames-before<=21);
 assert.equal(gl.calls.draws,flow.stats.frames);assert.ok(Object.isFrozen(flow.stats));
 h.window.innerWidth=320;h.window.innerHeight=200;
 for(let i=0;i<12;i++)h.window.emit('resize');h.advance(120);
 assert.equal(flow.stats.width,320);assert.equal(flow.stats.height,200);
 flow.destroy();
});

test('hidden and reduced-motion states cancel work, freeze time and resume without a time jump',()=>{
 const h=environment(),flow=new MetalFlowBackground(h.root);h.advance(300);const elapsed=flow.elapsed;
 h.document.hidden=true;h.document.emit('visibilitychange');const hiddenFrames=flow.stats.frames;
 assert.equal(h.jobs.size,0);h.advance(10000);assert.equal(flow.stats.frames,hiddenFrames);
 h.document.hidden=false;h.document.emit('visibilitychange');assert.equal(flow.elapsed,elapsed);
 flow.setReducedMotion(true);const frozen=flow.stats.frames;h.advance(2000);assert.equal(flow.stats.frames,frozen);assert.equal(h.jobs.size,0);
 flow.setReducedMotion(false);h.advance(100);assert.ok(flow.stats.frames>frozen);
 h.media.matches=true;h.media.emit('change');const osFrozen=flow.stats.frames;h.advance(1000);assert.equal(flow.stats.frames,osFrozen);
 h.media.matches=false;h.media.emit('change');h.advance(100);assert.ok(flow.stats.frames>osFrozen);
 flow.destroy();
});

test('unsupported or failed shaders keep the CSS surface without a JavaScript frame loop',()=>{
 for(const options of [{webgl:false},{compile:false},{link:false}]){
  const h=environment(options),flow=new MetalFlowBackground(h.root);
  assert.equal(flow.stats.backend,'css');assert.equal(h.root.dataset.renderer,'css');assert.equal(h.jobs.size,0);
  h.advance(3000);assert.equal(flow.stats.frames,0);flow.setReducedMotion(true);assert.equal(h.root.dataset.motion,'reduced');
  h.document.hidden=true;h.document.emit('visibilitychange');assert.equal(h.root.dataset.hidden,'true');
  if(flow.gl){assert.ok(flow.gl.calls.shaderDeletes>0);if(options.link===false)assert.equal(flow.gl.calls.programDeletes,1);}
  flow.destroy();assert.equal(h.root.children.length,0);assert.equal(h.document.count('visibilitychange'),0);
 }
});

test('context recovery and replacement own exactly one renderer and release pending work',()=>{
 const h=environment(),first=new MetalFlowBackground(h.root),canvas=first.canvas;h.advance(50);
 let prevented=false;canvas.emit('webglcontextlost',{preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(first.stats.backend,'css');assert.equal(first.stats.contextLosses,1);assert.equal(h.jobs.size,0);
 canvas.emit('webglcontextrestored');assert.equal(first.stats.backend,'webgl');h.advance(100);
 const next=new MetalFlowBackground(h.root);assert.equal(first.stats.destroyed,true);assert.equal(h.root.children.length,1);
 assert.equal(h.document.count('visibilitychange'),1);assert.equal(h.window.count('resize'),1);
 h.window.emit('resize');h.advance(50);next.destroy();const frames=next.stats.frames;
 assert.equal(h.jobs.size,0);h.advance(5000);assert.equal(next.stats.frames,frames);
 assert.equal(next.canvas.gl.calls.programDeletes,1);assert.equal(next.canvas.gl.calls.bufferDeletes,1);
 assert.equal(h.root.children.length,0);assert.equal(h.media.count('change'),0);assert.equal(h.window.count('resize'),0);
 assert.equal(h.document.body.classList.contains('has-metal-flow'),false);next.destroy();
});
