const MUSIC_ROOT='/assets/third_party/opengameart/';
const SFX_ROOT='/assets/third_party/kenney/sci-fi-sounds/';
export const AUDIO_FILES={calm:`${MUSIC_ROOT}singularity/singularity_calm.mp3`,action:`${MUSIC_ROOT}singularity/singularity_action.mp3`,menu:`${MUSIC_ROOT}dark-sci-fi-audio/title.ogg`,route:`${MUSIC_ROOT}dark-sci-fi-audio/sector.ogg`,node:`${MUSIC_ROOT}dark-sci-fi-audio/transmission.ogg`,victory:`${MUSIC_ROOT}dark-sci-fi-audio/victory.ogg`,hover:`${MUSIC_ROOT}dark-sci-fi-audio/hover.ogg`,click:`${SFX_ROOT}computerNoise_001.ogg`,deploy:`${SFX_ROOT}doorOpen_001.ogg`,shot:`${SFX_ROOT}laserSmall_000.ogg`,heavy:`${SFX_ROOT}laserLarge_001.ogg`,hit:`${SFX_ROOT}impactMetal_002.ogg`,explosion:`${SFX_ROOT}lowFrequency_explosion_000.ogg`,shield:`${SFX_ROOT}forceField_001.ogg`,defeat:`${SFX_ROOT}explosionCrunch_003.ogg`};
// EBU R128 measurements of the retained CC0 sources, verified with FFmpeg.
// Equalize music at playback without rewriting the original licensed files.
export const MUSIC_LUFS={calm:-18,action:-18,menu:-19.9,route:-12.1,node:-13.2,victory:-14};
// Reuse short, tonal sections of the licensed computer cue. In particular,
// deployment no longer plays the door sample's sustained high-frequency sweep.
export const UI_CUES=Object.freeze({
  hover:Object.freeze({source:'click',offset:.025,duration:.045,rate:.9,attack:.004,release:.032,gain:.11,lowpass:1450,highpass:110,priority:0}),
  click:Object.freeze({source:'click',offset:.02,duration:.065,rate:.9,attack:.006,release:.047,gain:.22,lowpass:1900,highpass:110,priority:1}),
  deploy:Object.freeze({source:'click',offset:.24,duration:.18,rate:.85,attack:.012,release:.13,gain:.30,lowpass:1650,highpass:100,priority:2})
});
function envelope(param,now,duration,profile){
  const attack=Math.min(profile.attack,duration*.2),release=Math.min(profile.release,duration-attack);
  param.setValueAtTime(0,now);
  if(param.linearRampToValueAtTime){
    param.linearRampToValueAtTime(profile.gain,now+attack);
    param.setValueAtTime(profile.gain,now+duration-release);
    param.linearRampToValueAtTime(0,now+duration);
  }else{
    // Older hosts still receive a smooth attack/release and an explicit end.
    param.setTargetAtTime(profile.gain,now,Math.max(.001,attack/3));
    param.setTargetAtTime(0,now+duration-release,Math.max(.001,release/6));
    param.setValueAtTime(0,now+duration);
  }
}
const musicGain=name=>10**((-18-(MUSIC_LUFS[name]??-18))/20);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
const SCENES={nexus:'node',prep:'prepare',prebattle:'prepare',preparation:'prepare',deployment:'prepare',map:'route',reward:'node',rewards:'node',camp:'node',workshop:'node',shop:'node',treasure:'node',event:'node',loss:'defeat',lost:'defeat',win:'victory',won:'victory',credits:'menu',settings:'menu',codex:'menu'};
export function normalizeScene(scene){return SCENES[scene]||(['prepare','battle','boss','route','node','victory','defeat'].includes(scene)?scene:'menu');}
export function adaptiveMix(danger,boss=false,paused=false){const d=Math.max(clamp(danger),boss?.5:0),duck=paused?.28:1;return {calm:Math.cos(d*Math.PI/2)*duck,action:Math.sin(d*Math.PI/2)*duck};}
export function approachDanger(current,target,dt){const c=clamp(current),t=clamp(target),duration=t>c?1.5:4;return c+Math.sign(t-c)*Math.min(Math.abs(t-c),Math.max(0,dt)/duration);}

/** Audio is unlocked by a user gesture once. Scene changes never restart shared stems. */
export class AudioDirector{
  constructor({onError=()=>{}}={}){
    this.onError=onError;this.errors=[];this.volumes={master:.7,music:.65,sfx:.5,ui:.5};this.buffers=new Map();this.pending=new Map();this.tracks=new Map();this.allTracks=new Set();this.cooldowns=new Map();this.activeEffects=new Set();this.effectNodes=new Map();this.pendingEffects=0;this.interactionRequest=0;this.lastInteraction=null;this.interactionVoice=null;this.scene='menu';this.danger=0;this.targetDanger=0;this.boss=false;this.paused=false;this.lastUpdate=0;this.disposed=false;this.generation=0;this.appliedGeneration=-1;
  }
  async unlock(){
    if(this.disposed)return false;if(this.unlocking)return this.unlocking;
    this.unlocking=(async()=>{try{
      if(!this.context){
        const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)throw Error('此浏览器不支持 Web Audio');
        this.context=new Context();for(const name of ['master','music','sfx','ui'])this[name]=this.context.createGain();
        this.lowpass=this.context.createBiquadFilter();this.lowpass.type='lowpass';this.lowpass.frequency.value=6000;this.lowpass.Q.value=.45;
        this.bossEQ=this.context.createBiquadFilter();this.bossEQ.type='lowshelf';this.bossEQ.frequency.value=140;this.bossEQ.gain.value=0;
        this.compressor=this.context.createDynamicsCompressor();this.compressor.threshold.value=-8;this.compressor.knee.value=0;this.compressor.ratio.value=20;this.compressor.attack.value=.003;this.compressor.release.value=.25;
        this.music.connect(this.lowpass);this.lowpass.connect(this.bossEQ);this.bossEQ.connect(this.compressor);this.sfx.connect(this.compressor);this.ui.connect(this.compressor);this.compressor.connect(this.master);this.master.connect(this.context.destination);
        this.setVolumes(this.volumes);this.timer=setInterval(()=>this.tick(),50);
      }
      if(this.context.state!=='running')await this.context.resume();
      if(this.appliedGeneration!==this.generation)await this.applyScene();return true;
    }catch(error){this.reportError(`音频启动失败：${error.message}`);return false;}finally{this.unlocking=null;}})();
    return this.unlocking;
  }
  reportError(message){if(this.errors.includes(message))return;this.errors.push(message);this.onError(message);}
  async load(name){
    if(this.buffers.has(name))return this.buffers.get(name);if(this.pending.has(name))return this.pending.get(name);
    const promise=(async()=>{const response=await fetch(AUDIO_FILES[name]);if(!response.ok)throw Error(`${response.status} ${AUDIO_FILES[name]}`);const buffer=await this.context.decodeAudioData(await response.arrayBuffer());this.buffers.set(name,buffer);return buffer;})();
    this.pending.set(name,promise);try{return await promise;}catch(error){this.reportError(`声音素材加载失败（${name}）：${error.message}`);throw error;}finally{this.pending.delete(name);}
  }
  target(gain,value,timeConstant=.1){const now=this.context.currentTime;if(gain.cancelAndHoldAtTime)gain.cancelAndHoldAtTime(now);else{gain.cancelScheduledValues(now);gain.setValueAtTime(gain.value,now);}gain.setTargetAtTime(value,now,timeConstant);}
  setVolumes(values={}){for(const key of ['master','music','sfx','ui'])if(Number.isFinite(values[key]))this.volumes[key]=clamp(values[key]);if(!this.context)return;for(const key of ['master','music','sfx','ui'])this.target(this[key].gain,this.volumes[key]*(key==='music'?.72:1),.04);}
  setScene(scene){const value=normalizeScene(scene);if(this.scene===value)return;this.scene=value;this.generation++;if(value!=='boss'&&value!=='battle'){this.boss=false;this.targetDanger=0;}if(this.context)this.applyScene().catch(()=>{});}
  update({danger=0,boss=false,paused=false}={}){this.targetDanger=clamp(danger);this.boss=!!boss;this.paused=!!paused;}
  makeTrack(name,buffer,when,loop=true){
    const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;source.loop=loop;gain.gain.value=0;source.connect(gain);gain.connect(this.music);
    const track={name,source,gain,stopping:false};source.onended=()=>{source.disconnect();gain.disconnect();this.allTracks.delete(track);if(this.tracks.get(name)===track)this.tracks.delete(name);};
    this.tracks.set(name,track);this.allTracks.add(track);source.start(when);return track;
  }
  retireExcept(names){for(const [name,track]of this.tracks){if(names.includes(name)||track.stopping)continue;track.stopping=true;this.target(track.gain.gain,0,.25);try{track.source.stop(this.context.currentTime+1.5);}catch{}this.tracks.delete(name);}}
  async applyScene(){
    if(!this.context||this.context.state!=='running'||this.disposed)return;const generation=this.generation,scene=this.scene;
    if(['battle','boss','prepare'].includes(scene)){
      const [calm,action]=await Promise.all([this.load('calm'),this.load('action')]);if(generation!==this.generation||this.disposed)return;
      if(Math.abs(calm.duration-action.duration)>.05){this.reportError('战斗音乐两层长度不一致，无法保持同步。');return;}
      this.retireExcept(['calm','action']);if(!this.tracks.has('calm')||!this.tracks.has('action')){
        for(const name of ['calm','action']){const old=this.tracks.get(name);if(old){old.stopping=true;try{old.source.stop();}catch{}this.tracks.delete(name);}}
        const when=this.context.currentTime+.05;this.makeTrack('calm',calm,when);this.makeTrack('action',action,when);
      }
    }else{
      const name=scene==='defeat'?'node':scene,buffer=await this.load(name);if(generation!==this.generation||this.disposed)return;
      this.retireExcept([name]);if(!this.tracks.has(name))this.makeTrack(name,buffer,this.context.currentTime+.02,name!=='victory');
      if(scene==='defeat')this.play('defeat');
    }
    this.appliedGeneration=generation;this.tick();
  }
  tick(){
    if(!this.context||this.disposed)return;const now=this.context.currentTime,dt=this.lastUpdate?Math.max(0,Math.min(.15,now-this.lastUpdate)):.05;this.lastUpdate=now;
    const battle=['battle','boss'].includes(this.scene),boss=battle&&(this.boss||this.scene==='boss'),target=battle?Math.max(this.targetDanger,boss?.5:0):0;
    this.danger=approachDanger(this.danger,target,dt);const mix=adaptiveMix(this.scene==='prepare'?0:this.danger,false,this.paused);
    for(const [name,track]of this.tracks){if(track.stopping)continue;const level=['calm','action'].includes(name)?mix[name]:(this.paused?.28:this.scene==='defeat'?.48:1);this.target(track.gain.gain,level*musicGain(name),.28);}
    this.target(this.bossEQ.gain,boss?2.5:0,.5);
  }
  async play(type){
    if(!this.context||this.context.state!=='running'||this.disposed)return;
    const aliases={attack:'shot',unit_attack:'shot',enemy_attack:'hit',kill:'explosion',death:'explosion',pressure:'shield',repair:'shield',heal:'shield',upgrade:'deploy',terrain:'hit',terrain_break:'hit',confirm:'click',cancel:'hover',error:'hit',select:'hover',boss:'heavy',boss_phase:'heavy',warning:'shield',ability:'shield'},name=aliases[type]||type;
    // Music files cannot accidentally be played as unbounded one-shot effects.
    if(!['hover','click','deploy','shot','heavy','hit','explosion','shield','defeat'].includes(name))return;
    const profile=UI_CUES[name],isUI=!!profile,now=this.context.currentTime,minInterval=name==='shot'?.08:name==='hover'?.09:name==='deploy'?.12:name==='explosion'?.15:.07;
    if(this.volumes.master===0||this.volumes[isUI?'ui':'sfx']===0)return;
    if(now-(this.cooldowns.get(name)??-Infinity)<minInterval)return;
    if(isUI&&this.lastInteraction&&now-this.lastInteraction.at<.075&&this.lastInteraction.priority>profile.priority)return;
    // Keep two voices available for interaction even during dense combat.
    // Obsolete UI requests share one decoded source and are discarded below.
    if(isUI?this.activeEffects.size>=14:this.activeEffects.size+this.pendingEffects>=12)return;
    const request=isUI?++this.interactionRequest:0;
    if(isUI)this.lastInteraction={at:now,priority:profile.priority};
    this.cooldowns.set(name,now);this.pendingEffects++;let createdVoice;
    try{
      const buffer=await this.load(profile?.source||name);
      if(this.disposed||this.context.state!=='running'||this.volumes.master===0||this.volumes[isUI?'ui':'sfx']===0)return;
      if(isUI&&(request!==this.interactionRequest||this.context.currentTime-now>.18))return;
      const source=this.context.createBufferSource(),gain=this.context.createGain(),nodes=[source,gain];source.buffer=buffer;
      const voice={name,source,gain,nodes,stopping:false,cleaned:false};createdVoice=voice;
      voice.cleanup=()=>{if(voice.cleaned)return;voice.cleaned=true;for(const node of nodes)node.disconnect();this.activeEffects.delete(source);this.effectNodes.delete(source);if(this.interactionVoice===voice)this.interactionVoice=null;};
      source.onended=voice.cleanup;
      if(isUI){
        const offset=buffer.duration>profile.offset?profile.offset:0,duration=Math.min(profile.duration,Math.max(0,buffer.duration-offset)/profile.rate);
        if(duration<=0){voice.cleanup();return;}
        const highpass=this.context.createBiquadFilter(),lowpass=this.context.createBiquadFilter();
        highpass.type='highpass';highpass.frequency.value=profile.highpass;highpass.Q.value=.5;
        lowpass.type='lowpass';lowpass.frequency.value=profile.lowpass;lowpass.Q.value=.5;
        nodes.push(highpass,lowpass);source.connect(highpass);highpass.connect(lowpass);lowpass.connect(gain);gain.connect(this.ui);
        if(source.playbackRate)source.playbackRate.value=profile.rate;
        const when=this.context.currentTime;envelope(gain.gain,when,duration,profile);
        if(this.interactionVoice)this.retireEffect(this.interactionVoice);
        this.interactionVoice=voice;this.activeEffects.add(source);this.effectNodes.set(source,voice);
        source.start(when,offset,duration*profile.rate);source.stop(when+duration);
      }else{
        gain.gain.value=name==='shot'?.24:name==='explosion'?.3:.4;source.connect(gain);gain.connect(this.sfx);
        this.activeEffects.add(source);this.effectNodes.set(source,voice);source.start();
      }
    }catch{if(createdVoice){try{createdVoice.source.stop();}catch{}createdVoice.cleanup();}}finally{this.pendingEffects--;}
  }
  retireEffect(voice){
    if(voice.stopping||voice.cleaned)return;voice.stopping=true;
    const now=this.context.currentTime,param=voice.gain.gain,fade=.008;
    if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(now);else{param.cancelScheduledValues(now);param.setValueAtTime(param.value,now);}
    if(param.linearRampToValueAtTime)param.linearRampToValueAtTime(0,now+fade);else param.setTargetAtTime(0,now,fade/3);
    try{voice.source.stop(now+fade+.002);}catch{voice.cleanup();}
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.interactionRequest++;clearInterval(this.timer);for(const track of this.allTracks)try{track.source.stop();}catch{}for(const voice of [...this.effectNodes.values()]){try{voice.source.stop();}catch{}voice.cleanup();}this.tracks.clear();this.allTracks.clear();this.activeEffects.clear();this.effectNodes.clear();this.interactionVoice=null;this.context?.close();}
}
