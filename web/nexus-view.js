import {messengers,relics,acts} from './core/content.js';
import {escapeHTML as e,icon} from './ui.js';

export function nexusBody(state){
 const room=state.nexus[state.act],m=messengers[room.messenger];
 return `<div class="nexus-room" style="--nexus-color:${m.color}"><aside class="messenger-panel"><span class="eyebrow">SPIRIT / 0${state.act+1}</span><div class="messenger-portrait"><span style="mask-image:url('/assets/third_party/game-icons/${m.art}.svg')"></span></div><span class="tag gold">${acts[state.act].name} · 精神使者</span><h3>${m.name}</h3><p>${m.title}</p><blockquote>“${m.quote}”</blockquote><small>本幕四位使者中随机遇见一位。<br>六件专属收藏品中随机出现三件，选择一件。</small></aside><div class="nexus-offers">${room.options.map((id,index)=>{const r=relics[id];return `<article class="nexus-gift"><div class="nexus-gift-top"><span class="eyebrow">PACT / 0${index+1}</span><span class="tag gold">枢纽专属</span></div><div class="nexus-gift-art"><span style="mask-image:url('/assets/third_party/game-icons/${m.art}.svg')"></span>${icon(['ranged','shield','depth'][index])}</div><h3>${r.name}</h3><p>${e(r.description)}</p><small>持续到本局结束 · 选择前可查看并返回</small><button class="btn primary" data-action="nexus-gift" data-id="${id}">接纳这份赠礼 ${icon('arrow')}</button></article>`;}).join('')}</div></div>`;
}
