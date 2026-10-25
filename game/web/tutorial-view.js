import {currentTutorialStep} from './core/tutorial.js';
import {escapeHTML as e,icon} from './ui.js';

export function renderTutorialGuide(session,state,ctx={}){
 const step=currentTutorialStep(session,state,ctx),number=Math.min(step.index+1,step.total);
 const action=step.failed?'restart':step.complete?'finish':'next';
 return `<svg class="tutorial-target-layer" aria-hidden="true"><rect class="tutorial-control-ring" rx="10" hidden></rect><polygon class="tutorial-cell-ring" hidden></polygon><circle class="tutorial-cell-point" r="7" hidden></circle></svg><span class="tutorial-target-label" hidden aria-hidden="true"></span><section class="tutorial-guide ${step.complete?'is-complete':''} ${step.failed?'is-failed':''}" role="region" aria-label="新手教程" data-tutorial-step="${e(step.id)}"><div class="tutorial-guide-top"><span class="tutorial-kicker">${icon(step.complete?'check':'book')} ${step.complete?'练习完成':`基础教程 · ${number} / ${step.total}`}</span><button class="tutorial-icon-button" data-tutorial-action="exit" aria-label="退出教程" title="退出教程">${icon('close')}</button></div><div class="tutorial-progress" aria-hidden="true"><i style="width:${step.complete?100:(number-1)/step.total*100}%"></i></div><h2>${e(step.title)}</h2><p>${e(step.body)}</p><p class="tutorial-hint">${e(step.hint)}</p><div class="tutorial-guide-actions">${step.canContinue?`<button class="btn primary" data-tutorial-action="${action}">${e(step.buttonLabel)} ${icon('arrow')}</button>`:`<span class="tutorial-action-cue">${icon('info')} ${step.target?.cell&&!step.target?.selector?'点击高亮光点':'按高亮提示操作'}</span>`}${!step.complete&&!step.failed?'<button class="tutorial-restart" data-tutorial-action="restart">重新练习</button>':''}</div></section>`;
}

const lastUpdate=new WeakMap();
/** Position one DOM highlight and one world-space highlight; no animation loop is owned here. */
export function updateTutorialTargets(root,session,state,ctx,field,now=performance.now(),force=false){
 if(!root)return;
 const layer=root.querySelector('.tutorial-target-layer');if(!layer)return;
 const previous=lastUpdate.get(root);
 if(!force&&previous?.layer===layer&&now-previous.time<80)return;
 lastUpdate.set(root,{layer,time:now});
 const target=currentTutorialStep(session,state,ctx).target,
  control=root.querySelector('.tutorial-control-ring'),cell=root.querySelector('.tutorial-cell-ring'),point=root.querySelector('.tutorial-cell-point'),label=root.querySelector('.tutorial-target-label');
 control.setAttribute('hidden','');cell.setAttribute('hidden','');point.setAttribute('hidden','');label.hidden=true;
 if(!target)return;
 const width=window.innerWidth,height=window.innerHeight;
 layer.setAttribute('viewBox',`0 0 ${width} ${height}`);
 if(target.selector){
  const element=document.querySelector(`#app ${target.selector}`);
  if(element){const rect=element.getBoundingClientRect();if(rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<height){
   control.removeAttribute('hidden');control.setAttribute('x',Math.max(3,rect.left-4));control.setAttribute('y',Math.max(3,rect.top-4));
   control.setAttribute('width',Math.max(0,Math.min(width-6,rect.width+8)));control.setAttribute('height',Math.max(0,Math.min(height-6,rect.height+8)));
  }}
 }
 if(target.cell&&field&&['prep','battle'].includes(state.phase)){
  const mark=target.cell,rect=field.canvas.getBoundingClientRect(),h=field.heightAt(mark.x,mark.z)+.12;
  const points=[[mark.x,mark.z],[mark.x+(mark.w||1),mark.z],[mark.x+(mark.w||1),mark.z+(mark.d||1)],[mark.x,mark.z+(mark.d||1)]].map(([x,z])=>{const p=field.project(x,z,h);return{x:rect.left+p.x,y:rect.top+p.y};});
  cell.setAttribute('points',points.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));cell.removeAttribute('hidden');
  const origin=field.project(mark.x+.5,mark.z+.5,h),clickPoint={x:rect.left+origin.x,y:rect.top+origin.y};
  point.setAttribute('cx',clickPoint.x.toFixed(1));point.setAttribute('cy',clickPoint.y.toFixed(1));point.dataset.cellX=mark.x;point.dataset.cellZ=mark.z;point.removeAttribute('hidden');
  if(clickPoint.x>=0&&clickPoint.x<=width&&clickPoint.y>=0&&clickPoint.y<=height){
   label.hidden=false;label.textContent=`${target.label||'操作这里'}${target.selector?'':' · 点击光点'}`;label.style.left=`${Math.max(90,Math.min(width-90,clickPoint.x))}px`;label.style.top=`${Math.max(80,clickPoint.y-37)}px`;
  }
 }
}
