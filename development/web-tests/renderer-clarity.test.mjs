import test from 'node:test';
import assert from 'node:assert/strict';
import {Battlefield,renderResolution,rangeBoundary,screenToGround,worldToScreen} from '../../game/web/view/battlefield.js';
import {newRun} from '../../game/web/core/state.js';
import * as Rules from '../../game/web/core/rules.js';
import {ENTITY_ART} from '../../game/web/view/entity-art.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function context(){return new Proxy({calls:[],measureText:text=>({width:String(text).length*12})},{get(target,key){if(key in target)return target[key];return (...args)=>{for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),`${String(key)} received a non-finite coordinate`);target.calls.push({method:key,args});};}});}
class Surface{
  constructor(){this.style={};this.width=300;this.height=150;this.clientWidth=1116;this.isConnected=true;this.ctx=context();this.rect={left:246,top:106,width:1116,height:427};}
  getContext(){return this.ctx;}getBoundingClientRect(){return this.rect;}setAttribute(){}addEventListener(){}removeEventListener(){}focus(){}hasPointerCapture(){return false;}
}
function setup(dpr=1){const original={document:globalThis.document,window:globalThis.window,Image:globalThis.Image,ResizeObserver:globalThis.ResizeObserver};globalThis.window={devicePixelRatio:dpr,addEventListener(){},removeEventListener(){}};globalThis.document={createElement:()=>new Surface()};globalThis.Image=class{constructor(){this.complete=true;this.naturalWidth=384;this.naturalHeight=48;}};globalThis.ResizeObserver=class{observe(){}disconnect(){}};const canvas=new Surface(),field=new Battlefield(canvas),state=newRun('renderer-clarity');state.phase='prep';field.setState(state);return {canvas,field,state,restore(){field.destroy();Object.assign(globalThis,original);}};}

test('backing resolution never magnifies a 560 pixel canvas and bounds high-DPI fill cost',()=>{
  for(const [width,height]of [[960,540],[1116,427],[1366,768],[1920,1080]])for(const dpr of [1,1.25,1.5,2,3]){const r=renderResolution(width,height,dpr);assert.equal(r.width,width);assert.equal(r.height,height);assert.ok(r.pixelWidth>=width);assert.ok(r.pixelHeight>=height);assert.ok(r.ratio>=1&&r.ratio<=1.5);assert.ok(r.pixelWidth*r.pixelHeight<3004000);if(dpr===1){assert.equal(r.pixelWidth,width);assert.equal(r.pixelHeight,height);}}
});

test('DPR backing store does not change CSS picking, camera projection or cursor-anchored zoom',()=>{
  const qa=setup(2);try{const {field,canvas}=qa;assert.equal(field.camera.width,1116);assert.equal(field.camera.height,427);assert.equal(canvas.width,1674);assert.equal(canvas.style.imageRendering,'auto');assert.equal(canvas.ctx.imageSmoothingEnabled,false);
    for(const yaw of [0,Math.PI/4,Math.PI*1.25])for(const height of [0,2,4]){field.camera.yaw=yaw;assert.deepEqual(field.p(13.5,17.5,height),worldToScreen(13.5,17.5,height,field.camera));const projected=field.project(13.5,17.5,height),pointer=field.pointerPosition({clientX:projected.x+canvas.rect.left,clientY:projected.y+canvas.rect.top}),world=screenToGround(pointer.x,pointer.y,height,field.camera);near(world.x,13.5);near(world.z,17.5);}
    const cursor={x:320,y:190},before=screenToGround(cursor.x,cursor.y,0,field.camera);field.changeZoom(1.2,cursor);const after=screenToGround(cursor.x,cursor.y,0,field.camera);near(before.x,after.x);near(before.z,after.z);field.render(100);const cacheDraw=canvas.ctx.calls.find(c=>c.method==='drawImage'&&c.args[0]===field.cache);assert.deepEqual(cacheDraw.args.slice(1),[0,0,1116,427],'physical cache must have an explicit CSS destination size');
  }finally{qa.restore();}
});

test('range outline removes interior grid edges while retaining disconnected visibility boundaries',()=>{
  const joined=rangeBoundary([{x:1,z:1},{x:2,z:1}]);assert.equal(joined.length,6);assert.ok(!joined.some(e=>e.x===1&&e.z===1&&e.a[0]===1&&e.b[0]===1));assert.equal(rangeBoundary([{x:1,z:1},{x:3,z:1}]).length,8);
});

test('visible and hatched blocked regions share the combat verdict, including terrain previews',()=>{
  const qa=setup();try{const {field,state}=qa,unit=state.units.find(u=>u.type==='pulse_array');for(const cell of state.terrain.cells){cell.h=0;cell.ramp=-1;}unit.x=10;unit.z=10;for(const cell of Rules.footprint(state,unit))state.terrain.cells[cell.z*41+cell.x].h=1;for(let z=6;z<17;z++)state.terrain.cells[z*41+14].h=4;field.setSelection({selectedUid:unit.uid});field.updateRange();assert.ok(field.rangeBlocked.length>0);
    for(const cell of field.range)assert.equal(Rules.solveAttack(state,unit,{...cell,hp:100,maxHp:100,air:false,armor:0}).ok,true);
    for(const cell of field.rangeBlocked){const result=Rules.solveAttack(state,unit,{...cell,hp:100,maxHp:100,air:false,armor:0});assert.equal(result.ok,false);assert.equal(result.blocked,true);assert.ok(result.distance<=result.range);}
    const preview={ok:true,cells:[{x:14,z:10,h:0,after:{h:0,ramp:-1,protected:false}}]};field.setSelection({selectedUid:unit.uid,terrainTool:'lower',preview});field.updateRange();assert.equal(field.rangeHeight({x:14,z:10}),0);assert.equal(state.terrain.cells[10*41+14].h,4,'drawing a hypothetical surface must not edit terrain');
  }finally{qa.restore();}
});

test('preview ghost and boundaries render above entities without pointer text, including frozen confirmation',()=>{
  const qa=setup();try{const {field,state,canvas}=qa,unit=state.units[0],other=state.units[1];other.x=18;other.z=18;const origin={x:18,z:14},order=[];field.setInteractive(true);field.hover=origin;field.setSelection({unit,previewOrigin:{...origin},preview:Rules.placement(state,unit,origin.x,origin.z)});
    for(const name of ['drawRangeFill','drawSelection']){const original=field[name].bind(field);field[name]=(...args)=>{order.push(name);return original(...args);};}const drawUnit=field.drawUnit.bind(field);field.drawUnit=(u,time,ghost)=>{order.push(ghost?'ghost':'entity');return drawUnit(u,time,ghost);};field.setInteractive(false);field.render(100);
    assert.ok(order.indexOf('drawRangeFill')<order.indexOf('entity'));assert.ok(order.indexOf('entity')<order.indexOf('drawSelection'));assert.ok(order.indexOf('drawSelection')<order.indexOf('ghost'));assert.deepEqual(field.previewOrigin(),origin);assert.equal(field.hover,null);const text=canvas.ctx.calls.filter(c=>c.method==='fillText').map(c=>c.args[0]);assert.ok(!text.some(value=>/H\d|18,14|专注|休眠|醒觉火种/.test(value)));assert.ok(field.entityBoxes.length>=2,'labels can avoid both deployed entities and the ghost');
  }finally{qa.restore();}
});

test('compact world annotations avoid the unit silhouette and stay inside the viewport',()=>{
  const qa=setup();try{const {field,canvas}=qa;field.entityBoxes=[{left:470,right:650,top:150,bottom:300}];field.worldLabels=[{text:'火种',anchor:{x:560,y:210},color:'#79dfc1',dx:0,dy:1},{text:'▲ 北 16',anchor:{x:25,y:20},color:'#f18478',dx:-1,dy:-1}];field.drawWorldLabels();const labels=canvas.ctx.calls.filter(c=>c.method==='fillText');assert.equal(labels.length,2);for(const label of labels){const [text,x,y]=label.args,width=text.length*12+8;assert.ok(x-width/2>=0&&x+width/2<=1116&&y-9>=0&&y+9<=427);assert.ok(x+width/2<=465||x-width/2>=655||y+9<=145||y-9>=305);}
  }finally{qa.restore();}
});
test('boss frequency shock keeps its radius and locked targets readable with reduced motion and clears at release',()=>{
 const qa=setup();try{const {field,state,canvas}=qa;state.pressureLevel=10;state.phase='battle';const target=state.units[0];target.x=18;target.z=19;state.battle={time:10.8,enemies:[{id:'boss-test',kind:'boss',hp:100,surgeWarningUntil:12,surgeOrigin:{x:20,z:17,h:0},surgeTargets:[target.uid]}]};field.setSelection({reducedMotion:true});field.worldLabels=[];field.drawSurgeTelegraphs();
 assert.ok(field.worldLabels.some(label=>label.text==='! 频震 · 1.2秒'));
 assert.ok(field.worldLabels.some(label=>label.text==='! 频震锁定'));
 assert.ok(canvas.ctx.calls.some(call=>call.method==='setLineDash'&&call.args[0].length));
 state.battle.time=12;field.worldLabels=[];const before=canvas.ctx.calls.length;field.drawSurgeTelegraphs();assert.equal(field.worldLabels.length,0);assert.equal(canvas.ctx.calls.length,before);
 state.battle.time=11;state.battle.enemies[0].hp=0;field.drawSurgeTelegraphs();assert.equal(field.worldLabels.length,0);
 }finally{qa.restore();}
});

test('renderer uses branch and phase poses, freezes action effects, and stops overloaded units',()=>{
 const qa=setup();try{const {field,state,canvas}=qa,u=state.units[0];Object.assign(u,{x:18,z:16,tier:3,branch:'B',lastActionAt:10,actionKind:'melee',facing:Math.PI/2});state.phase='battle';
 const e={id:'e-art',type:'noise_hive',kind:'boss',x:19,z:15,hp:100,maxHp:100,phase:2,facing:Math.PI,castUntil:11};state.battle={time:10.1,enemies:[e],disabled:[]};
 const event={type:'shot',action:'attack',actionKind:'melee',sourceKind:'unit',sourceId:u.uid,sourceType:u.type,targetKind:'enemy',targetId:e.id,targetType:e.type,time:10,from:{x:18,z:16,h:0},to:{x:19,z:15,h:0}};
 field.render(1000,[event]);const frames=structuredClone(field.entityFrames),clock=field.entityMotion.clock;
 assert.equal(frames.find(f=>f.key===`unit:${u.uid}`).row,46);assert.equal(frames.find(f=>f.key==='enemy:e-art').row,28);assert.equal(field.effects.length,1);
 const modelCalls=()=>[...canvas.ctx.calls,...(field.entityLayer?.ctx.calls||[])].filter(c=>c.method==='drawImage'&&[...field.images.values()].includes(c.args[0]));
 assert.ok(modelCalls().length>0);for(const call of modelCalls()){const type=[...field.images].find(([,img])=>img===call.args[0])[0],art=ENTITY_ART[type],[,x,y,w,h]=call.args;assert.equal(w,art.cell);assert.equal(h,art.cell);assert.ok(x>=0&&x+w<=art.cell*8);assert.ok(y>=0&&y+h<=art.cell*art.rows);}
 field.render(100000);assert.deepEqual(field.entityFrames,frames);assert.equal(field.entityMotion.clock,clock);assert.equal(field.effects.length,1,'wall time does not expire paused impacts');
 state.battle.disabled=[u.uid];field.render(100016);const disabled=field.entityFrames.find(f=>f.key===`unit:${u.uid}`);assert.equal(disabled.action,'disabled');assert.equal(disabled.row,40);assert.ok([...canvas.ctx.calls,...(field.entityLayer?.ctx.calls||[])].some(c=>c.method==='fillText'&&c.args[0]==='Ⅱ 停机'));
 state.battle.time=11.1;field.render(100033);assert.equal(field.effects.length,0);assert.equal(field.entityFrames.find(f=>f.key==='enemy:e-art').pose,0);
 }finally{qa.restore();}
});

test('impacts retain snapshot centers and flight height after target removal; corpses expire and clear on view changes',()=>{
 const qa=setup();try{const {field,state}=qa;state.phase='battle';state.battle={time:5,enemies:[],disabled:[]};
 const point={x:12.4,z:11.8,h:2};assert.deepEqual(field.eventPoint(point,null,'enemy','floating_noise'),field.p(12.9,12.3,4.1));assert.deepEqual(field.eventPoint(point,null,'enemy','static_drifter'),field.p(12.9,12.3,2.8));
 const dead={id:'dead-flight',type:'floating_noise',kind:'normal',air:true,x:12.4,z:11.8,h:2,hp:0,facing:1};field.render(100,[{type:'kill',action:'death',time:5,sourceKind:'enemy',sourceId:dead.id,sourceType:dead.type,from:point,entity:dead}]);assert.equal(field.entityFrames.filter(f=>f.action==='death').length,1);
 state.battle.time=5.7;field.render(200);assert.equal(field.entityFrames.filter(f=>f.action==='death').length,0);assert.equal(field.entityMotion.deaths.length,0);
 state.battle.time=6;field.render(300,[{type:'kill',action:'death',time:6,sourceKind:'enemy',sourceId:dead.id,entity:dead}]);field.setState(newRun('different-visual-run'));assert.equal(field.entityMotion.deaths.length,0);assert.equal(field.effects.length,0);
 }finally{qa.restore();}
});

test('small viewport sprites retain a readable body without changing world anchors or unit footprints',()=>{
 const qa=setup();try{const {field,state}=qa;field.camera.scale=1;const original=JSON.stringify(state);
 for(const [type,art]of Object.entries(ENTITY_ART)){const enemy=art.kind==='enemies',entity=enemy?{id:type,type,kind:art.role,x:14,z:12,hp:10,maxHp:10}:{...state.units[0],type,x:14,z:12,tier:1},g=field.entityGeometry(entity,enemy),size=field.modelSize(entity,g,enemy),minimum=enemy?(art.role==='boss'?38:art.role==='elite'?26:20):28,span=enemy?art.minVisibleSpan:Math.max(art.bounds.width,art.bounds.height),p=field.p(g.x,g.z,g.h),box=field.modelBox(p,size,art);
 assert.ok(size*span/art.cell>=minimum-1e-8,`${type} is too small at the lowest camera scale`);assert.ok(box.left<box.right&&box.top<box.bottom);assert.deepEqual(field.entityGeometry(entity,enemy),g,'screen sizing cannot change the world footprint');
 }
 assert.equal(JSON.stringify(state),original);
 }finally{qa.restore();}
});

test('selection corners enclose the enlarged body and airborne entities keep their rule height across tile edges',()=>{
 const qa=setup();try{const {field,state,canvas}=qa,u=state.units[0];Object.assign(u,{x:14,z:12});field.camera.scale=2;const g=field.entityGeometry(u),p=field.p(g.x,g.z,g.h),box=field.modelBox(p,field.modelSize(u,g),ENTITY_ART[u.type]);canvas.ctx.calls.length=0;field.drawUnitOutline(u,'#fff');
 const corners=canvas.ctx.calls.filter(c=>c.method==='lineTo').map(c=>c.args);assert.ok(corners.some(([x,y])=>x<box.left&&y<box.top));assert.ok(corners.some(([x,y])=>x>box.right&&y>box.bottom));
 state.terrain.cells[1*41+2].h=0;state.terrain.cells[1*41+3].h=1;const e={id:'floating-edge',type:'floating_noise',x:2.8,z:1.2,air:true,h:0};assert.equal(field.entityGeometry(e,true).h,1.3);assert.equal(field.entityGeometry({...e,h:undefined},true).h,1.3,'fractional coordinates use the same floor cell as rules');
 state.terrain.cells[1*41+2].h=3;assert.equal(field.entityGeometry({...e,hp:0},true).h,1.3,'a death snapshot keeps its recorded height');
 }finally{qa.restore();}
});

test('entity occlusion masks an isolated surface and never repaints rear terrain over the scene',()=>{
 const qa=setup();try{const {field,state,canvas}=qa;const u=state.units[0];Object.assign(u,{x:18,z:17});
 for(const cell of state.terrain.cells)cell.h=0;for(let z=19;z<22;z++)for(let x=18;x<22;x++)state.terrain.cells[z*41+x].h=3;state.terrain.revision++;
 const drawTile=field.drawTile.bind(field),occlude=field.occlude.bind(field);let entityPass=false,masked=0;
 field.drawTile=(ctx,tile)=>{assert.equal(entityPass,false,'terrain may only paint during its cache build');drawTile(ctx,tile);};
 field.occlude=(...args)=>{if(field.maskingEntity){assert.notEqual(field.ctx,canvas.ctx,'a terrain mask cannot erase the composed scene');masked++;}entityPass=true;try{occlude(...args);}finally{entityPass=false;}};
 for(const yaw of [0,Math.PI/4,Math.PI*.75,Math.PI*1.25,Math.PI*1.75]){field.camera.yaw=yaw;field.dirty=true;field.render(100);}
 assert.ok(masked>=1);assert.ok(field.entityLayer.width<canvas.width,'mask allocation is bounded to model rectangles');
 }finally{qa.restore();}
});

test('rectangular model keeps its placement direction on battle entry before aiming its first shot',()=>{
 const qa=setup();try{const {field,state}=qa,u=state.units.find(u=>u.type==='focus_rail');Object.assign(u,{x:18,z:15,rotation:1,lastActionAt:null,facing:0});
 state.phase='prep';field.render(100);const preview=field.entityFrames.find(f=>f.key===`unit:${u.uid}`);assert.equal(preview.facing,Math.PI/2);
 state.phase='battle';state.battle={time:0,enemies:[],disabled:[]};field.render(200);assert.equal(field.entityFrames.find(f=>f.key===`unit:${u.uid}`).facing,Math.PI/2);
 u.lastActionAt=0;u.facing=Math.PI;state.battle.time=.1;field.render(300);assert.equal(field.entityFrames.find(f=>f.key===`unit:${u.uid}`).facing,Math.PI);
 }finally{qa.restore();}
});

test('render rule caches expire after success and exceptions so later upgrades cannot reuse stale stats',()=>{
 const qa=setup();try{const {field,state}=qa,u=state.units[0];Object.assign(u,{x:18,z:15});field.render(100);
 const before=Rules.unitStats(state,u).attack;state.modifiers.attack=.5;assert.ok(Rules.unitStats(state,u).attack>before);
 const draw=field.drawBackground;field.drawBackground=()=>{Rules.unitStats(state,u);throw Error('controlled draw failure');};assert.throws(()=>field.render(200),/controlled draw failure/);
 state.modifiers.attack=1;assert.equal(Rules.unitStats(state,u).attack,before*2);field.drawBackground=draw;field.render(300);
 }finally{qa.restore();}
});
