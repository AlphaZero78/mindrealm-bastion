export const PV_ASSETS=Object.freeze({
 video:'/assets/game/pv/opening-pv.mp4',
 poster:'/assets/game/pv/opening-pv-poster.jpg',
 notice:'/assets/game/pv/NOTICE.txt',
 imageLicense:'/assets/game/pv/MiniMax-H3-LICENSE.txt',
 voiceLicense:'/assets/game/pv/Qwen3-TTS-Apache-2.0.txt'
});

/** The film is created and fetched only after the menu button is activated. */
export class PVPlayer{
 constructor({onOpenChange=()=>{},volume=()=>1}={}){this.onOpenChange=onOpenChange;this.volume=volume;this.dialog=null;}
 get isOpen(){return !!this.dialog?.open;}
 open(opener){
  if(this.isOpen)return;
  const dialog=document.createElement('dialog');dialog.className='pv-dialog';dialog.setAttribute('aria-labelledby','pv-title');
  dialog.innerHTML=`<header class="pv-head"><div><span class="eyebrow">THE LAST CLEAR SIGNAL</span><h2 id="pv-title">心域防线 · 游戏 PV</h2></div><div class="pv-actions"><button type="button" class="btn ghost" data-pv-fullscreen>全屏</button><button type="button" class="btn ghost" data-pv-close aria-label="关闭游戏 PV">关闭 ×</button></div></header><video class="pv-video" controls playsinline preload="none" tabindex="0" aria-label="心域防线游戏 PV">你的浏览器暂时无法播放此视频。</video><footer class="pv-footer"><span>2 分 15 秒 · AI 生成影像 · MiniMax H3</span><a href="${PV_ASSETS.notice}" target="_blank" rel="noopener">制作与授权</a></footer><div class="pv-status" role="status" aria-live="polite" hidden><span></span><button type="button" class="btn" data-pv-retry hidden>重试播放</button></div>`;
  document.body.append(dialog);this.dialog=dialog;this.video=dialog.querySelector('video');this.opener=opener;
  const video=this.video,status=dialog.querySelector('.pv-status'),message=status.querySelector('span'),retry=dialog.querySelector('[data-pv-retry]');
  const showStatus=(text,canRetry=false)=>{if(this.dialog!==dialog)return;status.hidden=false;message.textContent=text;retry.hidden=!canRetry;};
  const play=()=>{video.play().catch(error=>{if(this.dialog===dialog&&error.name!=='AbortError')showStatus(error.name==='NotAllowedError'?'点击播放器中的播放按钮，开始观看。':'视频暂时无法播放，请重试。',error.name!=='NotAllowedError');});};
  video.volume=Math.max(0,Math.min(1,this.volume()));video.poster=PV_ASSETS.poster;
  video.addEventListener('playing',()=>{status.hidden=true;});
  video.addEventListener('error',()=>showStatus('视频加载失败，请重试播放。',true));
  retry.addEventListener('click',()=>{status.hidden=true;video.load();play();});
  dialog.querySelector('[data-pv-close]').addEventListener('click',()=>this.close());
  dialog.querySelector('[data-pv-fullscreen]').addEventListener('click',()=>{
   if(video.requestFullscreen)video.requestFullscreen().catch(()=>showStatus('可使用播放器中的全屏控件。'));
   else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();
  });
  let wasFullscreen=false,lastFullscreenExit=-Infinity;
  dialog.addEventListener('fullscreenchange',()=>{const active=document.fullscreenElement===video;if(wasFullscreen&&!active)lastFullscreenExit=performance.now();wasFullscreen=active;});
  dialog.addEventListener('cancel',event=>{
   event.preventDefault();
   if(document.fullscreenElement===video){document.exitFullscreen().catch(()=>{});return;}
   if(wasFullscreen||performance.now()-lastFullscreenExit<200)return;
   this.close();
  });
  dialog.addEventListener('close',()=>{if(this.dialog===dialog)this.close();});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)this.close();}});
  dialog.showModal();this.onOpenChange(true);video.src=PV_ASSETS.video;play();
  dialog.querySelector('[data-pv-close]').focus({preventScroll:true});
 }
 close({restoreFocus=true}={}){
  if(!this.dialog)return;
  const {dialog,video,opener}=this;this.dialog=null;this.video=null;this.opener=null;
  video.pause();video.removeAttribute('src');video.load();dialog.close();dialog.remove();this.onOpenChange(false);
  if(restoreFocus&&opener?.isConnected)opener.focus({preventScroll:true});
 }
}
