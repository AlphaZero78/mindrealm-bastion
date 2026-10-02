import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {Battlefield,worldToScreen,screenToGround,panScreen,cameraStep,wrapAngle,directionFrame} from '../../web/view/battlefield.js';
import {AudioDirector,AUDIO_FILES,adaptiveMix,approachDanger,normalizeScene} from '../../web/view/audio.js';
import {newRun} from '../../web/core/state.js';
import {makeEncounter} from '../../web/core/battle.js';
import * as Rules from '../../web/core/rules.js';
import {towers,enemies} from '../../web/core/content.js';
import {ENTITY_ART} from '../../web/view/entity-art.js';
const near=(actual,expected,epsilon=1e-8)=>assert.ok(Math.abs(actual-expected)<epsilon,`${actual} != ${expected}`);

test('orthographic picking and screen-relative WASD agree at all planned camera angles',()=>{
  for(const angle of [0,45,90,225,359])for(const h of [0,1,2,3,4]){
    const camera={x:20,z:24,yaw:angle*Math.PI/180,scale:8,width:640,height:360},target={x:9.3,z:30.75};
    const p=worldToScreen(target.x,target.z,h,camera),q=screenToGround(p.x,p.y,h,camera);near(q.x,target.x);near(q.z,target.z);
    for(const [key,dx,dy]of [['w',0,6],['s',0,-6],['a',6,0],['d',-6,0]]){
      const moved={...camera};cameraStep(moved,new Set([key]),.05);const after=worldToScreen(target.x,target.z,h,moved);near(after.x-p.x,dx);near(after.y-p.y,dy);
    }
    const drag={...camera};panScreen(drag,30,-20);const after=worldToScreen(target.x,target.z,h,drag);near(after.x-p.x,-30);near(after.y-p.y,20);
  }
});
test('Q/E rotates continuously at 90 degrees per second, wraps, and atlas facing follows the camera',()=>{
  const camera={x:20,z:24,yaw:0,scale:8};for(let i=0;i<20;i++)cameraStep(camera,new Set(['e']),.05);near(camera.yaw,Math.PI/2);for(let i=0;i<80;i++)cameraStep(camera,new Set(['q']),.05);near(camera.yaw,Math.PI/2);near(wrapAngle(-.25),Math.PI*2-.25);
  for(let frame=0;frame<8;frame++){const theta=frame*Math.PI/4;assert.equal((directionFrame(Math.sin(theta),Math.cos(theta),0)-directionFrame(Math.sin(theta),Math.cos(theta),Math.PI/4)+8)%8,1);}
});

class Surface{
  constructor(){this.handlers=new Map();this.style={};this.width=640;this.height=360;this.clientWidth=1280;this.isConnected=true;this.ctx=makeContext();this.captures=new Set();}
  getBoundingClientRect(){return {left:30,top:76,width:1280,height:600};}
  getContext(){return this.ctx;}setAttribute(){}focus(){}setPointerCapture(id){this.captures.add(id);}releasePointerCapture(id){this.captures.delete(id);}hasPointerCapture(id){return this.captures.has(id);}
  addEventListener(type,fn){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(fn);}
  removeEventListener(type,fn){this.handlers.get(type)?.delete(fn);}
  fire(type,data={}){const event={key:'',button:0,target:this,preventDefault(){this.prevented=true;},...data};for(const fn of this.handlers.get(type)||[])fn(event);return event;}
}
function makeContext(){const calls=[];return new Proxy({calls,measureText:text=>({width:String(text).length*6})},{get(target,key){if(key in target)return target[key];return (...args)=>{for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),`Nonfinite ${String(key)} canvas coordinate`);calls.push({method:key,args});};},set(target,key,value){target[key]=value;return true;}});}
function mockDOM(){const old={document:globalThis.document,window:globalThis.window,Image:globalThis.Image,ResizeObserver:globalThis.ResizeObserver};const window=new Surface();globalThis.window=window;globalThis.document={createElement:()=>new Surface()};globalThis.Image=class{constructor(){this.complete=true;this.naturalWidth=384;this.naturalHeight=48;}};globalThis.ResizeObserver=class{observe(){}disconnect(){}};return {window,restore:()=>Object.assign(globalThis,old)};}

test('hidden views and modals release camera/canvas input; buttons retain rotate/zoom/focus interfaces',()=>{
  const dom=mockDOM(),canvas=new Surface();let clicks=0,cancels=0;const field=new Battlefield(canvas,{onCell:()=>clicks++,onCancel:()=>cancels++});try{
    const state=newRun('view-input');state.phase='prep';field.setState(state);field.setEncounter(makeEncounter(state));field.setInteractive(true);field.focus();
    const before=field.zoomLevel;field.zoom('in');assert.ok(field.zoomLevel>before);field.zoom('out');near(field.zoomLevel,before);field.rotate(Math.PI/8);near(field.camera.yaw,3*Math.PI/8);
    const world=field.project(20.5,24.5),rect=canvas.getBoundingClientRect();canvas.fire('pointerdown',{clientX:world.x+rect.left,clientY:world.y+rect.top});assert.equal(clicks,1);
    dom.window.fire('keydown',{key:'w'});assert.equal(field.keys.size,1);field.setInteractive(false);assert.equal(field.keys.size,0);assert.equal(field.hover,null);assert.equal(canvas.tabIndex,-1);
    const camera={...field.camera};dom.window.fire('keydown',{key:'e'});canvas.fire('wheel',{deltaY:100});canvas.fire('pointerdown',{clientX:world.x+rect.left,clientY:world.y+rect.top});canvas.fire('contextmenu');field.render(100);assert.deepEqual(field.camera,camera);assert.equal(clicks,1);assert.equal(cancels,0);
    field.setInteractive(true);dom.window.fire('keydown',{key:'w',target:{tagName:'INPUT'}});assert.equal(field.keys.size,0);dom.window.fire('keydown',{key:'e',ctrlKey:true});assert.equal(field.keys.size,0);canvas.fire('contextmenu');assert.equal(cancels,1);
  }finally{field.destroy();dom.restore();}
});
test('live state contract renders airborne string IDs and six bosses, caches paths across camera movement, refreshes broken terrain',()=>{
  const dom=mockDOM(),canvas=new Surface(),field=new Battlefield(canvas);try{
    const state=newRun('view-contract');state.phase='prep';field.setState(state);const encounter=makeEncounter(state);field.setEncounter(encounter);field.render(100);
    assert.equal(field.tiles.length,41*41);assert.equal(Rules.entriesOf(state).filter(e=>field.entryStatus(e).active).length,1);const paths=field.paths;
    field.rotate(.1);field.render(116);assert.equal(field.paths,paths,'camera rotation must not recalculate navigation');
    state.terrain.cells[10*41+10].h=0;state.terrain.revision++;field.render(132);assert.notEqual(field.paths,paths);assert.equal(field.tiles.find(t=>t.x===10&&t.z===10).h,0);
    state.phase='battle';state.battle={time:1,entries:Rules.entriesOf(state),enemies:Object.values(enemies).filter(e=>e.air||e.kind==='boss').map((e,i)=>({...e,id:`e${i+1}`,type:e.id,x:8+i,z:18,maxHp:e.hp,warningUntil:2,pressureMarked:true}))};field.hover={x:8,z:18};field.render(148);
    assert.equal(Rules.entriesOf(state).filter(e=>field.entryStatus(e).active).length,4);const draws=canvas.ctx.calls.filter(c=>c.method==='drawImage');assert.ok(draws.length>6,'actual sprite atlas frames were drawn');assert.ok(canvas.ctx.calls.some(c=>c.method==='fillText'&&String(c.args[0]).includes('能力蓄力')));
    assert.ok(canvas.ctx.calls.some(c=>c.method==='fillText'&&String(c.args[0]).includes('高压力目标')));field.setInteractive(true);field.keys.add('e');field.render(180);assert.equal(field.fastTerrain,true);field.keys.clear();field.render(212);assert.equal(field.fastTerrain,false,'decorative grid must return after camera movement stops');
  }finally{field.destroy();dom.restore();}
});
test('all 40 entities have transparent eight-direction models and complete authored pose and variant sheets',async()=>{
  for(const [folder,catalog]of [['towers',towers],['enemies',enemies]])for(const id of Object.keys(catalog)){
    const art=ENTITY_ART[id];assert.ok(art,id);assert.equal(art.directions,8);assert.equal(art.cell,80);assert.equal(art.poseRows,10);
    for(const [path,rows]of [[art.staticPath,art.iconRows],[art.animationPath,art.rows]]){const data=await readFile(new URL(`../..${path}`,import.meta.url));assert.equal(data.toString('ascii',1,4),'PNG');assert.equal(data.readUInt32BE(16),art.cell*art.directions,id);assert.equal(data.readUInt32BE(20),art.cell*rows,id);assert.equal(data[25],6,`${id} must preserve RGBA transparency`);}
    assert.equal(art.variants.length,folder==='towers'?5:catalog[id].kind==='boss'?3:1);
  }
  for(const path of Object.values(AUDIO_FILES))await access(new URL(`../..${path}`,import.meta.url));assert.notEqual(AUDIO_FILES.node,AUDIO_FILES.hover);
});
test('placement range and terrain-edit range match the combat solver, including live low-spirit growth',()=>{
  const dom=mockDOM(),field=new Battlefield(new Surface());try{
    const state=newRun('view-range'),unit=state.units.find(u=>u.type==='pulse_array');state.phase='prep';unit.x=4;unit.z=4;for(const cell of state.terrain.cells)cell.h=0;for(const cell of Rules.footprint(state,unit))state.terrain.cells[cell.z*41+cell.x].h=2;
    field.setState(state);field.setSelection({selectedUid:unit.uid});field.updateRange();
    const brute=source=>{const expected=[];for(let z=0;z<41;z++)for(let x=0;x<41;x++)if(Rules.solveAttack(source,unit,{x,z,hp:100,maxHp:100,air:false,armor:0}).ok)expected.push({x,z});return expected;};
    assert.deepEqual(field.range,brute(state));const before=field.range.length;state.modifiers.crisis_range=.5;state.spirit=20;field.updateRange();assert.ok(field.range.length>before);assert.deepEqual(field.range,brute(state));
    const cells=[{x:7,z:5,h:4,after:{h:4,ramp:-1,protected:false}}],preview={ok:true,cells};field.setSelection({selectedUid:unit.uid,terrainTool:'raise',preview});field.updateRange();const terrain={...state.terrain,cells:state.terrain.cells.slice()};terrain.cells[5*41+7]=cells[0].after;assert.deepEqual(field.range,brute({...state,terrain}));
  }finally{field.destroy();dom.restore();}
});
test('modal confirmation keeps the frozen footprint and range while rejecting battlefield input',()=>{
  const dom=mockDOM(),canvas=new Surface(),field=new Battlefield(canvas);try{
    const state=newRun('modal-preview');state.phase='prep';field.setState(state);field.setInteractive(true);const unit=state.units[0],origin={x:18,z:15};field.hover=origin;field.setSelection({unit,previewOrigin:{...origin},preview:Rules.placement(state,unit,origin.x,origin.z)});field.updateRange();const before=[...field.range];field.setInteractive(false);assert.equal(field.hover,null);assert.deepEqual(field.previewOrigin(),origin);canvas.ctx.calls.length=0;field.drawSelection();assert.deepEqual(field.range,before);assert.ok(canvas.ctx.calls.some(call=>call.method==='drawImage'),'frozen unit ghost remains drawn under the modal');
    field.setSelection({});assert.equal(field.previewOrigin(),null);field.setInteractive(true);field.drawSelection();assert.equal(field.range.length,0);
  }finally{field.destroy();dom.restore();}
});
test('scene aliases and equal-power danger ramps cover every game state without victory-on-loss fallback',()=>{
  assert.deepEqual(['menu','map','prep','battle','node','reward','won','lost'].map(normalizeScene),['menu','route','prepare','battle','node','node','victory','defeat']);
  for(let d=0;d<=1;d+=.01){const mix=adaptiveMix(d);near(mix.calm**2+mix.action**2,1);}near(adaptiveMix(1,false,true).action,.28);near(adaptiveMix(0,true).action,Math.SQRT1_2);
  let value=0;for(let i=0;i<30;i++)value=approachDanger(value,1,.05);near(value,1);for(let i=0;i<80;i++)value=approachDanger(value,0,.05);near(value,0);near(approachDanger(.5,1,-1),.5);
});
class Param{constructor(){this.value=0;}cancelAndHoldAtTime(){}cancelScheduledValues(){}setValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}}
class AudioNode{constructor(){this.gain=new Param();this.frequency=new Param();this.Q=new Param();for(const name of ['threshold','knee','ratio','attack','release'])this[name]=new Param();this.connections=[];}connect(node){this.connections.push(node);}disconnect(){this.disconnected=true;}start(time){this.startedAt=time;}stop(time){this.stoppedAt=time;if(time==null)this.onended?.();}}
class Context{static instances=[];constructor(){Context.instances.push(this);this.currentTime=1;this.state='suspended';this.destination={};this.sources=[];}createGain(){return new AudioNode();}createBiquadFilter(){return new AudioNode();}createDynamicsCompressor(){return new AudioNode();}createBufferSource(){const n=new AudioNode();this.sources.push(n);return n;}async resume(){this.state='running';}async close(){this.state='closed';}async decodeAudioData(){return {duration:180};}}
test('audio unlocks once, synchronizes stems, retains phase on battle changes, respects buses and frees effects',async()=>{
  const original={AudioContext:globalThis.AudioContext,fetch:globalThis.fetch};globalThis.AudioContext=Context;globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});Context.instances=[];const audio=new AudioDirector();try{
    audio.setScene('prep');await Promise.all([audio.unlock(),audio.unlock(),audio.unlock()]);assert.equal(Context.instances.length,1);assert.equal(audio.tracks.size,2);assert.equal(audio.tracks.get('calm').source.startedAt,audio.tracks.get('action').source.startedAt);const source=audio.tracks.get('calm').source;
    audio.setScene('battle');await audio.applyScene();assert.equal(audio.tracks.get('calm').source,source);audio.setScene('boss');await audio.applyScene();audio.tick();assert.equal(audio.bossEQ.gain.value,2.5);assert.equal(audio.lowpass.frequency.value,6000);assert.equal(audio.compressor.ratio.value,20);
    audio.setVolumes({master:.3,music:.4,sfx:.5,ui:.6});near(audio.master.gain.value,.3);near(audio.music.gain.value,.4*.72);near(audio.sfx.gain.value,.5);near(audio.ui.gain.value,.6);
    const active=[];for(let i=0;i<40;i++){audio.context.currentTime+=.2;active.push(audio.play(i%2?'shot':'click'));}await Promise.all(active);assert.ok(audio.activeEffects.size<=14);assert.equal(audio.pendingEffects,0);assert.ok(audio.activeEffects.size>0);for(const effect of [...audio.activeEffects])effect.onended();assert.equal(audio.activeEffects.size,0);
    audio.setScene('lost');await audio.applyScene();assert.ok(audio.tracks.has('node'));assert.ok(!audio.tracks.has('victory'));assert.ok(audio.allTracks.size>audio.tracks.size,'fading sources remain tracked until they end');audio.setScene('won');await audio.applyScene();const victory=audio.tracks.get('victory');assert.equal(victory.source.loop,false);victory.source.onended();const count=audio.context.sources.length;audio.setScene('won');await audio.unlock();assert.equal(audio.context.sources.length,count,'finished victory cue must not restart on clicks');
  }finally{audio.dispose();assert.equal(audio.allTracks.size,0);Object.assign(globalThis,original);}
});
