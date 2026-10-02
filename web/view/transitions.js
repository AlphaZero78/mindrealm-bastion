const EASING='cubic-bezier(.2,.7,.2,1)';
const DEFAULT_PIXELS=1920*1080;
const INTERACTIVE_ATTRIBUTES=new Set(['id','name','for','href','target','action','formaction','autofocus','tabindex','contenteditable','draggable']);
// These are the only data attributes used by stylesheet selectors. Retain
// their captured values so removing event metadata does not change layout.
const VISUAL_DATA_ATTRIBUTES=new Set(['data-screen','data-placing']);
const UNSAFE_ELEMENTS=new Set(['SCRIPT','IFRAME','OBJECT','EMBED','AUDIO','VIDEO']);

function freezeStyle(window,source,target){
  const computed=window.getComputedStyle(source);
  for(const property of computed)target.style.setProperty(property,computed.getPropertyValue(property));
}

function decoration(element){
  element.inert=true;
  element.setAttribute('aria-hidden','true');
  element.style.pointerEvents='none';
  element.style.userSelect='none';
}

/**
 * A visual-only bridge across synchronous screen renders. The caller decides
 * which scene keys deserve a transition; HUD updates should never call capture.
 *
 * const ticket=transitions.capture({reducedMotion:settings.reducedMotion});
 * // Replace the UI, commit layout and draw the new canvas immediately.
 * transitions.commit(ticket); // resolves on completion, never rejects
 *
 * onActiveChange lets the application suspend input without moving save/state
 * work into an animation callback. No listeners from the old UI are duplicated.
 */
export class ScreenTransitions{
  constructor({document=globalThis.document,window=globalThis.window,app,canvas=null,modalRoot=null,duration=240,maxSnapshotPixels=DEFAULT_PIXELS,onActiveChange=()=>{}}={}){
    this.document=document;this.window=window;this.app=app;this.canvas=canvas;this.modalRoot=modalRoot;
    this.duration=Math.max(220,Math.min(280,Number.isFinite(duration)?duration:240));
    this.maxSnapshotPixels=Math.max(1,Math.min(DEFAULT_PIXELS,Number.isFinite(maxSnapshotPixels)?maxSnapshotPixels:DEFAULT_PIXELS));
    this.onActiveChange=onActiveChange;this.record=null;this.disposed=false;this.sequence=0;
    this.media=window?.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.onVisibility=()=>{if(this.document.hidden)this.finish('hidden');};
    this.onResize=()=>this.finish('resized');
    this.onMotion=()=>{if(this.media.matches)this.finish('reduced-motion');};
    document?.addEventListener('visibilitychange',this.onVisibility);
    window?.addEventListener('resize',this.onResize);
    this.media?.addEventListener?.('change',this.onMotion);
  }

  get active(){return !!this.record;}

  cloneLayer(source,{viewport=false}={}){
    const originals=[source,...source.querySelectorAll('*')];
    if(originals.length>4000)throw Error('Screen snapshot is too large');
    const clone=source.cloneNode(true),copies=[clone,...clone.querySelectorAll('*')],scroll=[];
    for(let index=0;index<originals.length;index++){
      const original=originals[index],copy=copies[index];
      // ID selectors disappear when the clone is sanitized. Freeze only these
      // nodes rather than computing every style on every route-map element.
      if(index===0||original.hasAttribute('id'))freezeStyle(this.window,original,copy);
      if(UNSAFE_ELEMENTS.has(copy.tagName)){copy.remove();continue;}
      for(const attribute of [...copy.attributes]){
        const name=attribute.name.toLowerCase();
        if(INTERACTIVE_ATTRIBUTES.has(name)||name.startsWith('on')||(name.startsWith('data-')&&!VISUAL_DATA_ATTRIBUTES.has(name))||name.startsWith('aria-'))copy.removeAttribute(attribute.name);
      }
      if('value' in original&&original.type!=='file')copy.value=original.value;
      if('checked' in original)copy.checked=original.checked;
      if('selectedIndex' in original)copy.selectedIndex=original.selectedIndex;
      copy.style.animation='none';copy.style.transition='none';decoration(copy);
      if(original.scrollLeft||original.scrollTop)scroll.push([copy,original.scrollLeft,original.scrollTop]);
    }
    const rect=source.getBoundingClientRect(),zoom=Number.parseFloat(this.window.getComputedStyle(source).zoom)||1;
    Object.assign(clone.style,{position:'absolute',left:`${viewport?0:rect.left/zoom}px`,top:`${viewport?0:rect.top/zoom}px`,width:`${(viewport?this.window.innerWidth:rect.width)/zoom}px`,height:`${(viewport?this.window.innerHeight:rect.height)/zoom}px`,margin:'0',transform:'none',opacity:'1',containerType:'inline-size'});
    return {clone,scroll};
  }

  capture({reducedMotion=false}={}){
    this.finish('replaced');
    if(this.disposed||reducedMotion||this.media?.matches||this.document?.hidden||!this.app||this.app.isConnected===false)return null;
    let overlay,bitmap;
    try{
      overlay=this.document.createElement('div');overlay.setAttribute('data-screen-transition','outgoing');decoration(overlay);
      Object.assign(overlay.style,{position:'fixed',inset:'0',width:'100vw',height:'100dvh',overflow:'hidden',zIndex:'80',isolation:'isolate',contain:'layout paint',background:this.window.getComputedStyle(this.document.body).backgroundColor,opacity:'1'});
      const canvas=this.canvas,rect=canvas?.getBoundingClientRect();
      if(canvas&&canvas.width>0&&canvas.height>0&&rect.width>0&&rect.height>0&&this.window.getComputedStyle(canvas).display!=='none'){
        bitmap=this.document.createElement('canvas');
        const factor=Math.min(1,Math.sqrt(this.maxSnapshotPixels/(canvas.width*canvas.height)));
        bitmap.width=Math.max(1,Math.floor(canvas.width*factor));bitmap.height=Math.max(1,Math.floor(canvas.height*factor));
        const context=bitmap.getContext('2d');if(!context)throw Error('Canvas snapshot unavailable');
        context.drawImage(canvas,0,0,bitmap.width,bitmap.height);
        decoration(bitmap);Object.assign(bitmap.style,{position:'absolute',left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,imageRendering:this.window.getComputedStyle(canvas).imageRendering,zIndex:'0'});overlay.append(bitmap);
      }
      const layers=[this.cloneLayer(this.app)];
      if(this.modalRoot?.childElementCount)layers.push(this.cloneLayer(this.modalRoot,{viewport:true}));
      layers.forEach(({clone},index)=>{clone.style.zIndex=String(index+1);overlay.append(clone);});
      this.document.body.append(overlay);
      for(const layer of layers)for(const [node,left,top]of layer.scroll){node.scrollLeft=left;node.scrollTop=top;}
      let resolve;const finished=new Promise(done=>{resolve=done;}),ticket=Object.freeze({id:++this.sequence,finished});
      this.record={ticket,resolve,overlay,bitmap,animations:[],restore:[],raf:null,timer:null,committed:false};
      this.armTimeout(this.record,500,'uncommitted');this.notify(true);
      return ticket;
    }catch{
      overlay?.remove();if(bitmap){bitmap.width=0;bitmap.height=0;}
      return null;
    }
  }

  commit(ticket){
    const record=this.record;
    if(!ticket)return Promise.resolve({status:'skipped'});
    if(!record||ticket!==record.ticket||record.committed)return ticket.finished;
    if(this.disposed||this.document.hidden||this.media?.matches){this.finish('skipped');return ticket.finished;}
    record.committed=true;
    const transform=this.window.getComputedStyle(this.app).transform||'none',startTransform=`translateY(8px)${transform==='none'?'':` ${transform}`}`;
    this.armTimeout(record,this.duration+120,'timeout');
    try{
      if(typeof record.overlay.animate!=='function'||typeof this.app.animate!=='function')throw Error('Use CSS transition fallback');
      for(const [node,frames]of [[record.overlay,[{opacity:1},{opacity:0}]],[this.app,[{opacity:0,transform:startTransform},{opacity:1,transform}]]]){
        const animation=node.animate(frames,{duration:this.duration,easing:EASING,fill:'both'});
        // Attach a rejection handler immediately, including when creating the
        // second animation throws before Promise.all can own the pair.
        Promise.resolve(animation.finished).catch(()=>{});record.animations.push(animation);
      }
      Promise.all(record.animations.map(animation=>animation.finished)).then(()=>this.endRecord(record,'finished'),()=>this.endRecord(record,'animation-cancelled'));
    }catch{
      for(const animation of record.animations)try{animation.cancel();}catch{}
      record.animations=[];this.cssFallback(record,startTransform,transform);
    }
    return ticket.finished;
  }

  cssFallback(record,startTransform,transform){
    const app=this.app,style=app.style;
    for(const property of ['opacity','transform','transition','will-change'])record.restore.push([style,property,style.getPropertyValue(property),style.getPropertyPriority(property)]);
    Object.assign(style,{opacity:'0',transform:startTransform,transition:'none',willChange:'opacity, transform'});
    record.overlay.style.transition='none';
    // Commit the starting pose before the next frame; no asynchronous work is
    // inserted between the caller's state mutation and its new DOM commit.
    app.getBoundingClientRect();
    const start=()=>{
      if(this.record!==record)return;
      record.raf=null;record.overlay.style.transition=`opacity ${this.duration}ms ${EASING}`;
      style.transition=`opacity ${this.duration}ms ${EASING}, transform ${this.duration}ms ${EASING}`;
      record.overlay.style.opacity='0';style.opacity='1';style.transform=transform;
      this.armTimeout(record,this.duration+34,'finished');
    };
    if(this.window.requestAnimationFrame)record.raf=this.window.requestAnimationFrame(start);else start();
  }

  armTimeout(record,milliseconds,status){
    if(record.timer!==null)this.window.clearTimeout(record.timer);
    record.timer=this.window.setTimeout(()=>this.endRecord(record,status),milliseconds);
  }

  notify(active){try{this.onActiveChange(active);}catch{}}

  endRecord(record,status){
    if(this.record!==record)return;
    this.record=null;
    this.window.clearTimeout(record.timer);
    if(record.raf!==null)this.window.cancelAnimationFrame?.(record.raf);
    for(const animation of record.animations)try{animation.cancel();}catch{}
    for(const [style,property,value,priority]of record.restore){if(value)style.setProperty(property,value,priority);else style.removeProperty(property);}
    record.overlay.remove();if(record.bitmap){record.bitmap.width=0;record.bitmap.height=0;}
    record.animations=[];record.restore=[];record.overlay=null;record.bitmap=null;
    this.notify(false);record.resolve({status});
  }

  finish(reason='finished'){if(this.record)this.endRecord(this.record,reason);}
  cancel(){this.finish('cancelled');}
  dispose(){
    if(this.disposed)return;this.disposed=true;this.finish('disposed');
    this.document?.removeEventListener('visibilitychange',this.onVisibility);
    this.window?.removeEventListener('resize',this.onResize);
    this.media?.removeEventListener?.('change',this.onMotion);
  }
}
