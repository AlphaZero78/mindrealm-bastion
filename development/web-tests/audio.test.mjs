import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioDirector,UI_CUES} from '../../game/web/view/audio.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
class Param{
  constructor(value=0){this.value=value;this.events=[];}
  event(method,value,time,constant){assert.ok(Number.isFinite(time));this.events.push({method,value,time,constant});if(value!==undefined)this.value=value;}
  setValueAtTime(value,time){this.event('set',value,time);}
  linearRampToValueAtTime(value,time){this.event('ramp',value,time);}
  setTargetAtTime(value,time,constant){this.event('target',value,time,constant);}
  cancelAndHoldAtTime(time){this.event('hold',undefined,time);}
  cancelScheduledValues(time){this.event('cancel',undefined,time);}
}
class Node{
  constructor(context,kind){this.context=context;this.kind=kind;this.connections=[];this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.playbackRate=new Param(1);this.stops=[];}
  connect(node){this.connections.push(node);return node;}
  disconnect(){this.disconnected=true;}
  start(...args){if(this.context.failStart)throw Error('source rejected');this.started=args;}
  stop(time){this.stops.push(time??this.context.currentTime);if(time===undefined)this.end();}
  end(){if(!this.ended){this.ended=true;this.onended?.();}}
}
class Context{
  constructor(){this.currentTime=1;this.state='running';this.sources=[];this.nodes=[];}
  node(kind){const node=new Node(this,kind);this.nodes.push(node);return node;}
  createGain(){return this.node('gain');}
  createBiquadFilter(){return this.node('filter');}
  createBufferSource(){const source=this.node('source');this.sources.push(source);return source;}
  advance(seconds){this.currentTime+=seconds;for(const source of this.sources){if(!source.started)continue;const start=source.started[0]??1,duration=source.started[2]??source.buffer.duration;if(Math.min(...source.stops,start+duration/source.playbackRate.value)<=this.currentTime)source.end();}}
  close(){this.state='closed';}
}
function harness(){
  const audio=new AudioDirector();audio.context=new Context();for(const name of ['master','music','sfx','ui'])audio[name]=audio.context.createGain();
  for(const name of ['click','shot','hit','heavy','shield','explosion','defeat'])audio.buffers.set(name,{duration:name==='click'?5:3});
  return audio;
}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}

test('click and deployment use distinct short tonal sections with a zero-ended envelope on the UI bus',async()=>{
  const records={};
  for(const name of ['click','deploy','hover']){
    const audio=harness();try{
      await audio.play(name);const voice=audio.interactionVoice,source=voice.source,profile=UI_CUES[name];
      const [when,offset,inputDuration]=source.started,duration=inputDuration/source.playbackRate.value;
      assert.equal(source.buffer,audio.buffers.get('click'),'all short UI cues reuse the retained licensed tonal source');
      near(duration,source.stops[0]-when);assert.ok(offset>=0&&offset+inputDuration<=source.buffer.duration);
      const events=voice.gain.gain.events;assert.deepEqual(events[0],{method:'set',value:0,time:when,constant:undefined});
      assert.equal(events.at(-1).value,0);assert.equal(events.at(-1).method,'ramp');near(events.at(-1).time,when+duration);
      assert.ok(events.some(e=>e.method==='ramp'&&e.value>0&&e.time>when&&e.time<when+duration));
      assert.ok(Math.max(...events.map(e=>e.value||0))<=.3,'interaction gain stays below the former .32 unfiltered source');
      const highpass=source.connections[0],lowpass=highpass.connections[0];assert.equal(highpass.type,'highpass');assert.equal(lowpass.type,'lowpass');
      assert.ok(lowpass.frequency.value<=2000);assert.ok(highpass.frequency.value>=90);assert.equal(lowpass.connections[0],voice.gain);assert.equal(voice.gain.connections[0],audio.ui);
      assert.ok(!voice.nodes.some(n=>n.connections.includes(audio.sfx)||n.connections.includes(audio.music)));
      records[name]={duration,offset,rate:profile.rate};audio.context.advance(duration+.001);assert.equal(audio.activeEffects.size,0);assert.ok(voice.nodes.every(n=>n.disconnected));
    }finally{audio.dispose();}
  }
  assert.ok(records.click.duration>=.04&&records.click.duration<=.09);assert.ok(records.deploy.duration>=.12&&records.deploy.duration<=.22);
  assert.ok(records.deploy.duration>=records.click.duration*2);assert.notEqual(records.click.offset,records.deploy.offset);assert.ok(records.deploy.rate<records.click.rate);
});

test('confirm, selection, cancellation and upgrade aliases retain bounded feedback; music cannot become an effect',async()=>{
  for(const [input,expected]of [['confirm','click'],['select','hover'],['cancel','hover'],['upgrade','deploy']]){
    const audio=harness();try{await audio.play(input);assert.equal(audio.interactionVoice.name,expected);assert.ok(audio.context.sources[0].stops[0]-1<=.22);}finally{audio.dispose();}
  }
  const audio=harness();try{for(const type of ['calm','action','menu','route','victory','unknown'])await audio.play(type);assert.equal(audio.context.sources.length,0);}finally{audio.dispose();}
});

test('same action favors deployment, fades a preceding click, and rapid repeated clicks cannot stack',async()=>{
  const audio=harness();try{
    await audio.play('click');const click=audio.interactionVoice;await audio.play('deploy');const deploy=audio.interactionVoice;
    assert.equal(deploy.name,'deploy');assert.equal(click.stopping,true);near(click.source.stops.at(-1),1.01);
    assert.equal(click.gain.gain.events.at(-2).method,'hold');assert.equal(click.gain.gain.events.at(-1).value,0);near(click.gain.gain.events.at(-1).time,1.008);
    await audio.play('hover');await audio.play('confirm');await audio.play('deploy');assert.equal(audio.context.sources.length,2);
    audio.context.advance(.011);assert.equal(audio.activeEffects.size,1);assert.ok(click.nodes.every(n=>n.disconnected));
    audio.context.advance(.07);await audio.play('click');assert.equal(deploy.stopping,true);for(let i=0;i<100;i++)await audio.play('click');assert.equal(audio.context.sources.length,3);
    audio.context.advance(.2);assert.equal(audio.activeEffects.size,0);assert.equal(audio.interactionVoice,null);
  }finally{audio.dispose();}
});

test('slow decode cannot replay superseded or stale UI requests',async()=>{
  const audio=harness(),gate=deferred();audio.load=()=>gate.promise;
  try{
    const click=audio.play('click'),deploy=audio.play('deploy');audio.context.advance(.04);gate.resolve({duration:5});await Promise.all([click,deploy]);
    assert.equal(audio.context.sources.length,1);assert.equal(audio.interactionVoice.name,'deploy');assert.equal(audio.pendingEffects,0);
    audio.context.advance(.3);const late=deferred();audio.load=()=>late.promise;const pending=audio.play('click');audio.context.advance(.181);late.resolve({duration:5});await pending;
    assert.equal(audio.context.sources.length,1,'old input is discarded after its feedback window');assert.equal(audio.pendingEffects,0);
  }finally{audio.dispose();}
});

test('dense combat leaves capacity for current interaction and does not queue an audible UI backlog',async()=>{
  const audio=harness();try{
    for(let i=0;i<12;i++){await audio.play('shot');audio.context.advance(.081);}assert.equal(audio.activeEffects.size,12);
    await audio.play('heavy');assert.equal(audio.context.sources.length,12);await audio.play('click');assert.equal(audio.activeEffects.size,13);assert.equal(audio.interactionVoice.name,'click');
    audio.context.advance(.01);await audio.play('deploy');assert.equal(audio.activeEffects.size,14);audio.context.advance(.011);assert.equal(audio.activeEffects.size,13);
    for(let i=0;i<100;i++){audio.context.advance(.02);await audio.play('click');assert.ok(audio.activeEffects.size<=14);}audio.context.advance(4);assert.equal(audio.activeEffects.size,0);assert.equal(audio.pendingEffects,0);
  }finally{audio.dispose();}
});

test('muting, suspended audio and disposal suppress both immediate and delayed effects',async()=>{
  for(const kind of ['ui','master']){
    const audio=harness();try{audio.setVolumes({[kind]:0});let loads=0;audio.load=async()=>{loads++;return {duration:5};};await audio.play('click');assert.equal(loads,0);audio.setVolumes({[kind]:.5});await audio.play('click');assert.equal(audio.context.sources.length,1);}finally{audio.dispose();}
  }
  for(const action of ['mute','suspend','dispose']){
    const audio=harness(),gate=deferred();audio.load=()=>gate.promise;try{const pending=audio.play('deploy');if(action==='mute')audio.setVolumes({ui:0});if(action==='suspend')audio.context.state='suspended';if(action==='dispose')audio.dispose();gate.resolve({duration:5});await pending;assert.equal(audio.context.sources.length,0);assert.equal(audio.pendingEffects,0);}finally{audio.dispose();}
  }
});

test('truncated and empty buffers never schedule past available source data',async()=>{
  for(const length of [0,.003,.025,.241])for(const name of ['click','deploy']){
    const audio=harness();audio.buffers.set('click',{duration:length});try{
      await audio.play(name);if(!length){assert.equal(audio.activeEffects.size,0);assert.ok(audio.context.sources.every(s=>!s.started));continue;}
      const voice=audio.interactionVoice,source=voice.source,[when,offset,duration]=source.started;assert.ok(duration>0);assert.ok(offset+duration<=length+1e-10);
      const events=voice.gain.gain.events;assert.ok(events.every((event,i)=>!i||event.time>=events[i-1].time));near(events.at(-1).time,source.stops[0]);assert.ok(source.stops[0]>when);
    }finally{audio.dispose();}
  }
});

test('failed loading or source scheduling frees capacity, and a later valid click still works',async()=>{
  const audio=harness();try{
    audio.load=async()=>{throw Error('decode failed');};await audio.play('click');assert.equal(audio.pendingEffects,0);assert.equal(audio.activeEffects.size,0);
    audio.load=async()=>({duration:5});audio.context.advance(.1);audio.context.failStart=true;await audio.play('click');assert.equal(audio.pendingEffects,0);assert.equal(audio.activeEffects.size,0);assert.equal(audio.effectNodes.size,0);assert.ok(audio.context.sources.every(s=>s.disconnected));
    audio.context.failStart=false;audio.context.advance(.1);await audio.play('click');assert.equal(audio.activeEffects.size,1);
  }finally{audio.dispose();}
});

test('cleanup releases every filter and gain after natural completion, replacement, or repeated disposal',async()=>{
  const audio=harness();await audio.play('click');await audio.play('deploy');await audio.play('shot');const voices=[...audio.effectNodes.values()];assert.equal(voices.length,3);
  audio.dispose();audio.dispose();assert.equal(audio.context.state,'closed');assert.equal(audio.activeEffects.size,0);assert.equal(audio.effectNodes.size,0);assert.equal(audio.interactionVoice,null);
  assert.ok(voices.every(v=>v.nodes.every(node=>node.disconnected)));for(const voice of voices)voice.source.onended();assert.equal(audio.activeEffects.size,0);await audio.play('click');assert.equal(audio.context.sources.length,3);
});
