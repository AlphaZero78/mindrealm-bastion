// Browser-only assertions for the shared event presentation.
export function eventUISizing(){
 return [...document.querySelectorAll('.event-cg,.event-title-ribbon,.event-prose,.run-hud,.event-option-title,.event-effects-body')].map(el=>{
  const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
  const snap=value=>Math.round(value*100)/100;
  return {class:el.className,x:snap(rect.x),y:snap(rect.y),width:snap(rect.width),height:snap(rect.height),fontSize:style.fontSize};
 });
}
export function eventUISizingStable(before,after){
 return before.length===after.length&&before.every((item,index)=>item.class===after[index].class&&item.fontSize===after[index].fontSize&&['x','y','width','height'].every(key=>Math.abs(item[key]-after[index][key])<=.25));
}
export function eventLayoutIssues(){
 const stage=document.querySelector('.event-stage');if(!stage)return[{reason:'event stage missing'}];
 const issues=[],rect=stage.getBoundingClientRect(),image=stage.querySelector('.event-cg'),fog=stage.querySelector('.event-atmosphere');
 if(stage.scrollTop||stage.scrollLeft||getComputedStyle(stage).overflow!=='clip')issues.push({reason:'oversized fog must not make the stage scroll when an option is focused'});
 const art=image.getBoundingClientRect(),style=getComputedStyle(image);
 if(Math.abs(art.width/rect.width-.8)>.003||Math.abs(art.height/rect.height-.8)>.003)issues.push({reason:'CG must use 80% of its former display frame',art:art.toJSON(),stage:rect.toJSON()});
 if(Math.abs(art.left+art.width/2-rect.left-rect.width/2)>1||Math.abs(art.top+art.height/2-rect.top-rect.height/2)>1)issues.push({reason:'CG must remain centered'});
 if(style.maskImage==='none'||!getComputedStyle(fog).filter.includes('blur(')||fog.currentSrc!==image.currentSrc)issues.push({reason:'CG edge feather or matching-color diffusion is missing'});
 const story=stage.querySelector('.event-story'),storyStyle=getComputedStyle(story);
 if(storyStyle.backgroundColor!=='rgba(0, 0, 0, 0)'||parseFloat(storyStyle.borderLeftWidth)>0)issues.push({reason:'story body gained an enclosing panel'});
 if(/查看并确认选择|选择\s*0[1-9]/.test(stage.querySelector('.event-options').textContent))issues.push({reason:'obsolete choice labels remain'});
 for(const el of document.querySelectorAll('.event-story,.event-title-ribbon,.event-prose,.event-choice,.event-outcome,.event-option-title,.event-confirmation,.event-material,.resource.depth')){
  const r=el.getBoundingClientRect();
  if(r.left<-.75||r.right>innerWidth+.75||r.top<-.75||r.bottom>innerHeight+.75||el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2)issues.push({reason:'content clipped',class:el.className,rect:r.toJSON(),content:[el.scrollWidth,el.scrollHeight],client:[el.clientWidth,el.clientHeight]});
 }
 for(const choice of stage.querySelectorAll('.event-choice')){
  const title=choice.querySelector('.event-option-title'),effect=choice.querySelector('.event-result'),button=choice.querySelector('[data-action="event-choice"]');
  if(!title?.textContent.trim()||getComputedStyle(title).backgroundImage==='none'||title.getBoundingClientRect().bottom>effect.getBoundingClientRect().top+1)issues.push({reason:'action title must occupy its own upper strip'});
  if(button.disabled!==!choice.querySelector('.event-choice-hint').hidden)issues.push({reason:'unavailable reason disagrees with button state'});
  const armed=choice.classList.contains('is-armed'),prompt=choice.querySelector('.event-confirmation');
  if(armed===prompt.hidden||button.getAttribute('aria-expanded')!==String(armed)||(armed&&button.disabled))issues.push({reason:'inline confirmation state disagrees with the action'});
  const arrow=choice.querySelector('.event-choice-cue svg'),arrowStyle=arrow&&getComputedStyle(arrow);
  if(arrowStyle?.strokeLinecap!=='round'||arrowStyle.strokeLinejoin!=='round')issues.push({reason:'choice arrow must have rounded ends and joins'});
 }
 if(stage.querySelectorAll('.event-choice.is-armed').length>1)issues.push({reason:'only one event action can await confirmation'});
 return issues;
}
