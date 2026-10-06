import test from 'node:test';
import assert from 'node:assert/strict';
import {ScreenTransitions} from '../../game/web/view/transitions.js';

const css=name=>name.replace(/[A-Z]/g,char=>`-${char.toLowerCase()}`);
class Style{
  constructor(values={}){this.values=new Map();this.priorities=new Map();Object.entries(values).forEach(([key,value])=>this.setProperty(css(key),value));return new Proxy(this,{get:(target,key)=>typeof key==='symbol'||key in target?Reflect.get(target,key):target.getPropertyValue(css(key)),set:(target,key,value)=>{if(key in target)target[key]=value;else target.setProperty(css(key),String(value));return true;}});}
  setProperty(key,value,priority=''){this.values.set(key,String(value));this.priorities.set(key,priority);}
  getPropertyValue(key){return this.values.get(key)||'';}
  getPropertyPriority(key){return this.priorities.get(key)||'';}
  removeProperty(key){this.values.delete(key);this.priorities.delete(key);}
  [Symbol.iterator](){return this.values.keys();}
}
class Events{
  constructor(){this.listeners=new Map();}
  addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
  removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
  fire(name){for(const fn of [...this.listeners.get(name)||[]])fn();}
}
class Element extends Events{
  constructor(document,tag='div'){super();this.document=document;this.tagName=tag.toUpperCase();this.attrs=new Map();this.style=new Style();this.children=[];this.scrollTop=0;this.scrollLeft=0;this.width=640;this.height=360;this.rect={left:0,top:0,width:1280,height:720};this.isConnected=true;this.textContent='';this.animations=[];}
  get attributes(){return [...this.attrs].map(([name,value])=>({name,value}));}
  get childElementCount(){return this.children.length;}
  hasAttribute(name){return this.attrs.has(name);}
  setAttribute(name,value){this.attrs.set(name,String(value));}
  getAttribute(name){return this.attrs.get(name)??null;}
  removeAttribute(name){this.attrs.delete(name);}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;this.isConnected=false;}
  querySelectorAll(){return this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);}
  getBoundingClientRect(){return this.rect;}
  cloneNode(deep){if(this.failClone)throw Error('clone rejected');const node=new Element(this.document,this.tagName);node.attrs=new Map(this.attrs);node.style=new Style(Object.fromEntries(this.style.values));node.textContent=this.textContent;node.rect={...this.rect};if(deep)this.children.forEach(child=>node.append(child.cloneNode(true)));return node;}
  getContext(){return this.document.failCanvas?null:{drawImage:(...args)=>this.document.draws.push({target:this,args})};}
  animate(frames,options){if(this.failAnimate)throw Error('animation unavailable');let resolve,reject;const finished=new Promise((yes,no)=>{resolve=yes;reject=no;}),animation={frames,options,finished,resolve,reject,cancelled:false,cancel(){this.cancelled=true;reject(Error('cancelled'));}};this.animations.push(animation);return animation;}
}
function harness(options={}){
  const document=new Events();document.hidden=false;document.draws=[];document.body=new Element(document,'body');document.createElement=tag=>new Element(document,tag);
  const window=new Events();window.innerWidth=1280;window.innerHeight=720;window.media=new Events();window.media.matches=false;window.matchMedia=()=>window.media;window.getComputedStyle=node=>new Style({display:'block',zoom:'1',transform:'none',backgroundColor:'rgb(9,25,32)',...Object.fromEntries(node.style.values)});
  window.timers=new Map();window.frames=new Map();let serial=0;window.setTimeout=(fn,delay)=>{const id=++serial;window.timers.set(id,{fn,delay});return id;};window.clearTimeout=id=>window.timers.delete(id);window.requestAnimationFrame=fn=>{const id=++serial;window.frames.set(id,fn);return id;};window.cancelAnimationFrame=id=>window.frames.delete(id);window.flushFrames=()=>{const frames=[...window.frames.values()];window.frames.clear();frames.forEach(fn=>fn());};window.flushTimers=()=>{const timers=[...window.timers.values()];window.timers.clear();timers.forEach(({fn})=>fn());};
  const app=document.createElement('div'),canvas=document.createElement('canvas'),modalRoot=document.createElement('div');app.setAttribute('id','app');canvas.setAttribute('id','battlefield');modalRoot.setAttribute('id','modal-root');document.body.append(canvas,app,modalRoot);
  const button=document.createElement('button');button.setAttribute('id','old-button');button.setAttribute('data-action','new');button.setAttribute('onclick','unwanted()');button.setAttribute('aria-label','new game');button.textContent='Old scene';app.append(button);
  const changes=[],transitions=new ScreenTransitions({document,window,app,canvas,modalRoot,onActiveChange:active=>changes.push(active),...options});
  const overlays=()=>document.body.children.filter(node=>node.getAttribute('data-screen-transition'));
  return {document,window,app,canvas,modalRoot,button,changes,transitions,overlays};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};

test('outgoing placement layout keeps its captured CSS state while all action metadata is removed',()=>{
  for(const placing of ['true','false']){
    const h=harness();try{
      const screen=h.document.createElement('main'),tutorial=h.document.createElement('aside');
      screen.setAttribute('class','battle-screen');screen.setAttribute('data-screen','battle');screen.setAttribute('data-placing',placing);
      screen.setAttribute('data-action','enter');screen.setAttribute('data-id','node-1');screen.setAttribute('data-unknown','unsafe');
      tutorial.setAttribute('class','tutorial');tutorial.textContent='Placement tutorial';screen.append(tutorial);h.app.append(screen);
      h.transitions.capture();const copy=h.overlays()[0].children[1].children[1];
      screen.setAttribute('data-placing',placing==='true'?'false':'true');
      assert.equal(copy.getAttribute('data-placing'),placing,'the outgoing tutorial retains its hidden or visible placement state');
      assert.equal(copy.getAttribute('data-screen'),'battle');assert.equal(copy.children[0].getAttribute('class'),'tutorial');
      for(const attribute of ['data-action','data-id','data-unknown'])assert.equal(copy.hasAttribute(attribute),false);
      assert.equal(copy.inert,true);assert.equal(copy.style.pointerEvents,'none');
    }finally{h.transitions.dispose();}
  }
});

test('capture preserves the old visual state, scroll and modal before synchronous new DOM work',async()=>{
  const h=harness();try{
    h.app.scrollTop=215;h.app.scrollLeft=9;h.app.style.zoom='1.25';h.app.rect={left:0,top:0,width:1280,height:720};
    const input=h.document.createElement('input');input.type='text';input.value='Changed value';input.checked=true;input.setAttribute('name','seed');h.app.append(input);
    const modal=h.document.createElement('section');modal.setAttribute('id','confirmation');modal.setAttribute('data-modal','confirm');modal.textContent='Old confirmation';h.modalRoot.append(modal);
    const ticket=h.transitions.capture(),overlay=h.overlays()[0],clone=overlay.children[1],oldModal=overlay.children[2];
    assert.equal(h.transitions.active,true);assert.deepEqual(h.changes,[true]);assert.equal(h.document.draws.length,1);assert.equal(h.document.draws[0].args[0],h.canvas);assert.equal(overlay.style.zIndex,'80');
    assert.equal(clone.scrollTop,215);assert.equal(clone.scrollLeft,9);assert.equal(clone.style.zoom,'1.25');assert.equal(clone.style.width,'1024px');assert.equal(clone.children[1].value,'Changed value');assert.equal(clone.children[1].checked,true);assert.equal(oldModal.children[0].textContent,'Old confirmation');
    h.button.textContent='New scene';h.modalRoot.children=[];assert.equal(clone.children[0].textContent,'Old scene');
    for(const node of [overlay,...overlay.querySelectorAll('*')]){assert.equal(node.inert,true);assert.equal(node.getAttribute('aria-hidden'),'true');assert.equal(node.style.pointerEvents,'none');assert.equal(node.hasAttribute('id'),false);assert.equal(node.hasAttribute('data-action'),false);assert.equal(node.hasAttribute('data-modal'),false);assert.equal(node.hasAttribute('onclick'),false);}
    const promise=h.transitions.commit(ticket);assert.equal(h.app.animations.length,1);assert.equal(h.canvas.animations.length,0,'live battlefield is never translated or scaled');assert.equal(h.button.textContent,'New scene');
    assert.equal(overlay.animations[0].options.duration,240);assert.match(h.app.animations[0].frames[0].transform,/translateY\(8px\)/);
    overlay.animations[0].resolve();h.app.animations[0].resolve();assert.deepEqual(await promise,{status:'finished'});assert.equal(h.overlays().length,0);assert.equal(h.document.draws[0].target.width,0);assert.deepEqual(h.changes,[true,false]);
  }finally{h.transitions.dispose();}
});

test('a rapid replacement finishes the preceding ticket, never stacks snapshots and ignores stale commits',async()=>{
  const h=harness();try{
    let previous;
    for(let i=0;i<20;i++){
      h.button.textContent=`scene ${i}`;const ticket=h.transitions.capture();assert.equal(h.overlays().length,1);assert.equal(h.overlays()[0].children[1].children[0].textContent,`scene ${i}`);
      if(previous){assert.deepEqual(await previous.finished,{status:'replaced'});assert.deepEqual(await h.transitions.commit(previous),{status:'replaced'});assert.equal(h.overlays().length,1);}
      h.transitions.commit(ticket);previous=ticket;
    }
    h.transitions.cancel();assert.deepEqual(await previous.finished,{status:'cancelled'});await flush();assert.equal(h.overlays().length,0);assert.equal(h.window.timers.size,0);assert.equal(h.window.frames.size,0);assert.ok(h.document.draws.every(draw=>draw.target.width===0));
  }finally{h.transitions.dispose();}
});

test('animation rejection unlocks the committed UI and leaves no styles or timers behind',async()=>{
  const h=harness();try{
    const ticket=h.transitions.capture();h.transitions.commit(ticket);h.app.animations[0].reject(Error('browser interrupted animation'));
    assert.deepEqual(await ticket.finished,{status:'animation-cancelled'});assert.equal(h.transitions.active,false);assert.deepEqual(h.changes,[true,false]);assert.equal(h.window.timers.size,0);assert.equal(h.app.style.opacity,'');assert.equal(h.overlays().length,0);
  }finally{h.transitions.dispose();}
});

test('CSS fallback restores original inline declarations after unavailable or partially failed Web Animations',async()=>{
  for(const mode of ['missing','throws']){
    const h=harness();try{
      h.app.style.setProperty('opacity','.9','important');h.app.style.setProperty('transform','scale(.98)');h.app.style.setProperty('transition','color 1s');
      if(mode==='missing')h.app.animate=null;else h.app.failAnimate=true;
      const ticket=h.transitions.capture(),overlay=h.overlays()[0];h.transitions.commit(ticket);assert.equal(h.app.style.opacity,'0');assert.equal(h.transitions.active,true);
      if(mode==='throws')assert.equal(overlay.animations[0].cancelled,true);
      h.window.flushFrames();assert.equal(h.app.style.opacity,'1');assert.equal(h.app.style.transform,'scale(.98)');assert.equal(overlay.style.opacity,'0');assert.match(h.app.style.transition,/240ms/);
      h.window.flushTimers();assert.deepEqual(await ticket.finished,{status:'finished'});await flush();assert.equal(h.app.style.opacity,'.9');assert.equal(h.app.style.getPropertyPriority('opacity'),'important');assert.equal(h.app.style.transform,'scale(.98)');assert.equal(h.app.style.transition,'color 1s');assert.equal(h.app.style.willChange,'');assert.equal(h.overlays().length,0);
    }finally{h.transitions.dispose();}
  }
});

test('reduced motion skips capture allocation and a changed system preference ends active motion immediately',async()=>{
  const h=harness();try{
    assert.equal(h.transitions.capture({reducedMotion:true}),null);assert.deepEqual(await h.transitions.commit(null),{status:'skipped'});assert.equal(h.document.draws.length,0);assert.deepEqual(h.changes,[]);
    h.window.media.matches=true;assert.equal(h.transitions.capture(),null);h.window.media.matches=false;
    const ticket=h.transitions.capture();h.transitions.commit(ticket);h.window.media.matches=true;h.window.media.fire('change');assert.deepEqual(await ticket.finished,{status:'reduced-motion'});assert.equal(h.overlays().length,0);
  }finally{h.transitions.dispose();}
});

test('hidden pages, resize, uncommitted renders and a suspended fallback frame cannot leave an interaction lock',async()=>{
  for(const reason of ['hidden','resized','uncommitted','timeout']){
    const h=harness();try{
      const ticket=h.transitions.capture();
      if(reason==='hidden'){h.transitions.commit(ticket);h.document.hidden=true;h.document.fire('visibilitychange');}
      if(reason==='resized'){h.transitions.commit(ticket);h.window.fire('resize');}
      if(reason==='uncommitted')h.window.flushTimers();
      if(reason==='timeout'){h.app.animate=null;h.transitions.commit(ticket);h.window.flushTimers();}
      assert.deepEqual(await ticket.finished,{status:reason});assert.equal(h.transitions.active,false);assert.equal(h.overlays().length,0);assert.equal(h.window.frames.size,0);assert.deepEqual(h.changes,[true,false]);
    }finally{h.transitions.dispose();}
  }
});

test('capture failures degrade to immediate rendering and do not leak a partially allocated canvas',async()=>{
  for(const mode of ['clone','canvas']){
    const h=harness();try{if(mode==='clone')h.app.failClone=true;else h.document.failCanvas=true;assert.equal(h.transitions.capture(),null);assert.equal(h.transitions.active,false);assert.equal(h.overlays().length,0);assert.equal(h.window.timers.size,0);assert.ok(h.document.draws.every(draw=>draw.target.width===0));assert.deepEqual(h.changes,[]);}finally{h.transitions.dispose();}
  }
});

test('snapshot memory is bounded at high resolutions and unsafe embedded content is not cloned into the page',()=>{
  const h=harness({duration:999,maxSnapshotPixels:99999999});try{
    h.canvas.width=7680;h.canvas.height=4320;for(const name of ['script','iframe','audio','video'])h.app.append(h.document.createElement(name));
    const ticket=h.transitions.capture(),bitmap=h.overlays()[0].children[0];assert.ok(bitmap.width*bitmap.height<=1920*1080);assert.equal(h.document.draws.length,1);assert.equal(h.transitions.duration,280);
    assert.ok(!h.overlays()[0].querySelectorAll('*').some(node=>['SCRIPT','IFRAME','AUDIO','VIDEO'].includes(node.tagName)));
    h.transitions.commit(ticket);h.transitions.finish();assert.equal(bitmap.width,0);assert.equal(bitmap.height,0);
  }finally{h.transitions.dispose();}
});

test('dispose is idempotent, removes observers and cancels even a pending CSS fallback frame',async()=>{
  const h=harness();h.app.animate=null;const ticket=h.transitions.capture();h.transitions.commit(ticket);h.transitions.dispose();h.transitions.dispose();
  assert.deepEqual(await ticket.finished,{status:'disposed'});assert.equal(h.transitions.capture(),null);assert.equal(h.overlays().length,0);assert.equal(h.window.frames.size,0);assert.equal(h.window.timers.size,0);
  assert.equal(h.document.listeners.get('visibilitychange').size,0);assert.equal(h.window.listeners.get('resize').size,0);assert.equal(h.window.media.listeners.get('change').size,0);assert.deepEqual(h.changes,[true,false]);
});
