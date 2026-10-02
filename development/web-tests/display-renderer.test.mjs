import test from 'node:test';
import assert from 'node:assert/strict';
import {Battlefield,screenToGround} from '../../web/view/battlefield.js';
import {RESOLUTION_PRESETS,resolveRenderResolution} from '../../web/view/display-settings.js';
import {newRun} from '../../web/core/state.js';
import * as Rules from '../../web/core/rules.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function context(){return new Proxy({calls:[],measureText:text=>({width:String(text).length*12})},{get(target,key){if(key in target)return target[key];return (...args)=>{for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),`${String(key)} received a non-finite coordinate`);target.calls.push({method:key,args});};}});}
class Surface{
  constructor(){this.style={};this.ctx=context();this._width=300;this._height=150;this.widthWrites=0;this.heightWrites=0;this.frameMarker=null;this.clientWidth=1670;this.isConnected=true;this.rect={left:250,top:126,width:1670,height:716};this.handlers=new Map();this.captures=new Set();}
  get width(){return this._width;}set width(value){this.widthWrites++;this._width=value;this.frameMarker=null;}
  get height(){return this._height;}set height(value){this.heightWrites++;this._height=value;this.frameMarker=null;}
  getContext(){return this.ctx;}getBoundingClientRect(){return this.rect;}setAttribute(){}focus(){}
  addEventListener(name,fn){if(!this.handlers.has(name))this.handlers.set(name,new Set());this.handlers.get(name).add(fn);}removeEventListener(name,fn){this.handlers.get(name)?.delete(fn);}
  hasPointerCapture(id){return this.captures.has(id);}setPointerCapture(id){this.captures.add(id);}releasePointerCapture(id){this.captures.delete(id);}
  fire(name,extra={}){const event={button:0,pointerId:7,target:this,preventDefault(){},...extra};for(const fn of this.handlers.get(name)||[])fn(event);}
}
function setup(dpr=1){const original={document:globalThis.document,window:globalThis.window,Image:globalThis.Image,ResizeObserver:globalThis.ResizeObserver};globalThis.window={devicePixelRatio:dpr,innerWidth:1920,innerHeight:1080,addEventListener(){},removeEventListener(){}};globalThis.document={createElement:()=>new Surface()};globalThis.Image=class{constructor(){this.complete=true;this.naturalWidth=384;this.naturalHeight=48;}};globalThis.ResizeObserver=class{observe(){}disconnect(){}};const clicks=[],hovers=[],canvas=new Surface(),field=new Battlefield(canvas,{onCell:cell=>clicks.push(cell),onHover:cell=>hovers.push(cell)}),state=newRun('display-renderer');state.phase='prep';for(const cell of state.terrain.cells){cell.h=0;cell.ramp=-1;}field.setState(state);field.setInteractive(true);return {canvas,field,state,clicks,hovers,restore(){field.destroy();Object.assign(globalThis,original);}};}
const eventAt=(canvas,p)=>({clientX:p.x+canvas.rect.left,clientY:p.y+canvas.rect.top});

test('every resolution preset changes only the backing buffer, keeping projection, hover and clicks in CSS coordinates',()=>{
  const qa=setup(2);try{const {field,canvas,clicks}=qa,camera={...field.camera},styles={...canvas.style},buffers=[];
    for(const preset of RESOLUTION_PRESETS){field.setResolution(preset.id);const expected=resolveRenderResolution({cssWidth:1670,cssHeight:716,windowWidth:1920,windowHeight:1080,dpr:2,resolution:preset.id});assert.equal(canvas.width,expected.pixelWidth);assert.equal(canvas.height,expected.pixelHeight);assert.deepEqual(field.camera,camera);assert.deepEqual({...canvas.style,cursor:''},{...styles,cursor:''});buffers.push(canvas.width);
      for(const yaw of [0,Math.PI/4,Math.PI*1.25]){field.camera.yaw=yaw;const p=field.project(18.5,15.5);canvas.fire('pointermove',eventAt(canvas,p));assert.deepEqual(field.hover,{x:18,z:15});canvas.fire('pointerdown',eventAt(canvas,p));canvas.fire('pointerup',eventAt(canvas,p));assert.deepEqual(clicks.at(-1),{x:18,z:15});for(const height of [0,2,4]){const raised=field.project(13.25,17.75,height),point=field.pointerPosition(eventAt(canvas,raised)),world=screenToGround(point.x,point.y,height,field.camera);near(world.x,13.25);near(world.z,17.75);}}
      field.camera.yaw=camera.yaw;
    }
    assert.equal(new Set(buffers).size,6,'all five fixed presets and automatic DPR use distinct buffers in this viewport');
  }finally{qa.restore();}
});

test('resolution changes preserve middle-button dragging and screen-relative movement',()=>{
  for(const preset of RESOLUTION_PRESETS){const qa=setup();try{const {field,canvas}=qa;field.setResolution(preset.id);const target={x:18.5,z:15.5},start=field.project(target.x,target.z);canvas.fire('pointerdown',{...eventAt(canvas,start),button:1});canvas.fire('pointermove',eventAt(canvas,{x:start.x+20,y:start.y-12}));const moved=field.project(target.x,target.z);near(moved.x-start.x,20);near(moved.y-start.y,-12);assert.ok(field.drag);assert.equal(canvas.hasPointerCapture(7),true);
      const before={...field.camera},pointer={...field.pointer},drag={...field.drag};field.setResolution(preset.id==='2560x1440'?'960x540':'2560x1440');assert.deepEqual(field.camera,before);assert.deepEqual(field.pointer,pointer);assert.deepEqual(field.drag,drag);assert.equal(canvas.hasPointerCapture(7),true);canvas.fire('pointermove',eventAt(canvas,{x:start.x+27,y:start.y-17}));const after=field.project(target.x,target.z);near(after.x-moved.x,7);near(after.y-moved.y,-5);canvas.fire('pointerup',{button:1});assert.equal(field.drag,null);assert.equal(canvas.hasPointerCapture(7),false);
    }finally{qa.restore();}}
});

test('repeated UI resizing preserves painted pixels and does not reset the canvas, cache or pointer',()=>{
  const qa=setup();try{const {field,state,canvas}=qa;field.render(100);const p=field.project(18.5,15.5);canvas.fire('pointermove',eventAt(canvas,p));const pointer={...field.pointer},hover={...field.hover},writes=[canvas.widthWrites,canvas.heightWrites,field.cache.widthWrites,field.cache.heightWrites];canvas.frameMarker='painted scene';field.cache.frameMarker='painted terrain';
    for(let i=0;i<5;i++){assert.equal(field.resize(),false);assert.equal(field.setResolution('auto'),false);assert.equal(field.setResolution('1920x1080'),false);assert.equal(field.setResolution('auto'),false);field.setState(state);assert.equal(field.resize(),false);}
    assert.deepEqual([canvas.widthWrites,canvas.heightWrites,field.cache.widthWrites,field.cache.heightWrites],writes);assert.equal(canvas.frameMarker,'painted scene');assert.equal(field.cache.frameMarker,'painted terrain');assert.deepEqual(field.pointer,pointer);assert.deepEqual(field.hover,hover);field.dirty=false;assert.equal(field.resize({force:true}),true);assert.equal(field.dirty,true);assert.equal(canvas.frameMarker,'painted scene');assert.deepEqual([canvas.widthWrites,canvas.heightWrites,field.cache.widthWrites,field.cache.heightWrites],writes);
    canvas.rect.height+=10;assert.equal(field.resize(),true);assert.equal(canvas.widthWrites,writes[0]);assert.equal(canvas.heightWrites,writes[1]+1,'a real dimension change must reset only the changed dimension');
  }finally{qa.restore();}
});

test('all presets preserve placement legality, complete range and the frozen confirmation ghost',()=>{
  const qa=setup();try{const {field,state,canvas}=qa,unit=state.units[0],origin={x:18,z:15},preview=Rules.placement(state,unit,origin.x,origin.z);assert.equal(preview.ok,true);field.hover=origin;field.setSelection({unit,previewOrigin:{...origin},preview});field.updateRange();const range=[...field.range],serialized=JSON.stringify(state);field.setInteractive(false);
    for(const preset of RESOLUTION_PRESETS){field.setResolution(preset.id);assert.equal(field.hover,null);assert.deepEqual(field.previewOrigin(),origin);canvas.ctx.calls.length=0;field.drawSelection();assert.deepEqual(field.range,range);assert.ok(canvas.ctx.calls.some(call=>call.method==='drawImage'),'the whole ghost is still drawn');assert.equal(Rules.placement(state,unit,origin.x,origin.z).ok,true);assert.equal(JSON.stringify(state),serialized);}
    field.setSelection({});field.setInteractive(true);field.drawSelection();assert.equal(field.previewOrigin(),null);assert.equal(field.range.length,0);assert.equal(JSON.stringify(state),serialized,'canceling a display preview cannot change resources or terrain');
  }finally{qa.restore();}
});

test('invalid presets recover to automatic and hidden view changes apply once the viewport returns',()=>{
  const qa=setup();try{const {field,canvas}=qa;field.setResolution('960x540');assert.equal(field.setResolution('not-a-resolution'),true);assert.equal(field.resolution,'auto');assert.equal(canvas.width,1670);field.render(100);canvas.frameMarker='retained';const writes=canvas.widthWrites;canvas.rect.width=0;assert.equal(field.setResolution('2560x1440'),false);assert.equal(canvas.widthWrites,writes);assert.equal(canvas.frameMarker,'retained');canvas.rect.width=1670;assert.equal(field.resize(),true);assert.equal(field.resolution,'2560x1440');assert.equal(canvas.width,2227);assert.equal(field.resize(),false);const camera={...field.camera};window.innerWidth=2560;window.innerHeight=1440;assert.equal(field.resize(),true,'a changed full-window budget must update fixed buffers even when the battlefield CSS size is unchanged');assert.equal(canvas.width,1670);assert.equal(canvas.height,716);assert.deepEqual(field.camera,camera);
  }finally{qa.restore();}
});
