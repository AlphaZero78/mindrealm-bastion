import {acts} from './core/content.js';
import {eventArtPath} from './core/event-stories.js';
import {icon,escapeHTML as e} from './ui.js';

export function actTransitionScene(state,hud,{reducedMotion=false}={}){
 const next=state.nextAct,art=eventArtPath(next===1?'memory_press':'control_key');
 return `<main class="app-shell act-passage" data-reduced-motion="${reducedMotion}">${hud}<section class="act-passage-stage" aria-label="幕间转场"><img class="act-passage-art" src="${art}" alt="${e(acts[next].name)}的叙事场景"><div class="act-passage-shade"></div><div class="act-passage-content"><span class="eyebrow">本幕敌群已清理 · 控制信号已切断</span><div class="act-passage-emblem">${icon('map')}</div><p class="act-passage-from">离开${e(acts[state.act].name)}</p><h2>前往${e(acts[next].name)}</h2><p>火种越过这一层控制。防线、构造与沿途的选择，将随你继续深入。</p><ol class="act-passage-route">${acts.map((a,i)=>`<li class="${i<next?'complete':i===next?'next':''}"><b>${i+1}</b><span>${e(a.name)}</span></li>`).join('')}</ol><div class="act-passage-actions"><button class="btn ghost" data-action="inventory">检查构造背包</button><button class="btn primary" data-action="act-continue">进入第 ${next+1} 幕 ${icon('arrow')}</button></div><small>准备好后再进入下一幕的心神枢纽。</small></div></section></main>`;
}
