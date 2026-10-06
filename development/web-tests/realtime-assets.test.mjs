import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {towers,enemies,events,messengers} from '../../game/web/core/content.js';
import {MODEL_PORTRAITS} from '../../game/web/view/model-portraits.js';
import {NEXUS_ART} from '../../game/web/view/nexus-art.js';
import {EntityMotion} from '../../game/web/view/entity-motion.js';
const bytes=path=>readFile(new URL('../../'+(path.startsWith('development/')||path.startsWith('game/')?path:'game/'+path),import.meta.url));
test('all 49 realtime assemblies and 109 variants resolve to real licensed GLBs with two detail levels',async()=>{
 const models=JSON.parse(await bytes('assets/game/models/models.json'));assert.deepEqual(Object.keys(models.entities).sort(),[...Object.keys(towers),...Object.keys(enemies)].sort());
 let variants=0;for(const entity of Object.values(models.entities)){for(const [id,parts]of Object.entries(entity.variants)){variants++;assert.ok(parts.length>=4,id);for(const p of parts){assert.ok(models.sources[p.source],p.source);assert.ok([...p.size,...p.position,...p.rotation].every(Number.isFinite));assert.ok(p.size.every(v=>v>0));}}assert.ok(Object.values(entity.bounds).every(v=>v>0));}
 assert.equal(variants,109);assert.equal(Object.keys(models.sources).length,49);
 for(const source of Object.values(models.sources)){
  const data=await bytes(source.path.slice(1));assert.equal(data.readUInt32LE(0),0x46546c67);assert.equal(data.readUInt32LE(4),2);assert.equal(data.readUInt32LE(8),data.length);
  const doc=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)).trim());assert.ok(!doc.buffers.some(b=>b.uri));assert.ok(!doc.images?.length);assert.deepEqual([...new Set(doc.nodes.filter(n=>n.mesh!==undefined).map(n=>n.extras.lod))].sort(),[0,1]);
  for(const mesh of doc.meshes)for(const p of mesh.primitives)assert.ok(p.attributes.NORMAL!==undefined&&p.attributes.TEXCOORD_0!==undefined);
  assert.ok(source.triangles[0]>=source.triangles[1]);
 }
});
test('all 36 events and 12 messengers have distinct full-size scenes; portrait sheets preserve their frames',async()=>{
 assert.deepEqual(Object.keys(NEXUS_ART).sort(),Object.keys(messengers).sort());
 const hashes=new Set(),scenes=[...Object.keys(events).map(id=>`assets/game/events/${id}.png`),...Object.values(NEXUS_ART).map(art=>art.path.slice(1))];
 for(const path of scenes){const data=await bytes(path);assert.equal(data.toString('ascii',1,4),'PNG');const width=data.readUInt32BE(16),height=data.readUInt32BE(20);assert.ok(width>=1600,path);assert.ok(height>=900,path);assert.ok(Math.abs(width/height-16/9)<.015,path);hashes.add(createHash('sha256').update(data).digest('hex'));}assert.equal(hashes.size,48);
 assert.equal(Object.keys(MODEL_PORTRAITS).length,49);for(const [id,art]of Object.entries(MODEL_PORTRAITS)){const data=await bytes(art.path.slice(1));assert.equal(data.readUInt32BE(16),256,id);assert.equal(data.readUInt32BE(20),256*art.rows,id);assert.equal(data[25],6,id);assert.ok(art.bounds.x>=0&&art.bounds.y>=0&&art.bounds.width>0&&art.bounds.height>0&&art.bounds.x+art.bounds.width<=256&&art.bounds.y+art.bounds.height<=256);}
 assert.equal((await bytes('assets/game/lighting/studio_small_09_pmrem.bin')).length,768*1024*8);
});

test('CG provenance covers the live assets with exact sizes, hashes and complete selected generation steps',async()=>{
 for(const [kind,catalog]of [['event',events],['nexus',messengers]]){
  const record=JSON.parse(await bytes(`development/assets/${kind}_art/prompts.json`));
  assert.deepEqual(record.assets.map(art=>art[kind==='event'?'eventId':'messengerId']).sort(),Object.keys(catalog).sort());
  for(const art of record.assets){
   const data=await bytes(art.path);assert.equal(createHash('sha256').update(data).digest('hex'),art.sha256,art.path);
   assert.equal(data.readUInt32BE(16),art.width);assert.equal(data.readUInt32BE(20),art.height);assert.equal(data.length,art.bytes);
   assert.equal(art.generationMode,'built-in imagegen');const selected=art.steps.filter(s=>s.selected);assert.equal(selected.length,1);
   assert.equal(selected[0].prompt,art.finalPrompt);assert.equal(selected[0].outputFilename,art.finalGenerationFilename);
   assert.ok(art.briefZh&&art.acceptanceZh);for(const step of art.steps){assert.ok(step.prompt);assert.ok(step.outputFilename);if(step.operation==='edit')assert.ok(step.inputFilenames?.length);}
  }
 }
});
test('visual interpolation advances joint phases between physics steps and retains future death cues',()=>{
 const enemy={id:'e1',type:'static_drifter',x:5,z:8,h:0,hp:40,maxHp:40,motion:{dx:.15,dz:0,distance:2.1}},state={units:[],battle:{time:2,enemies:[enemy]}};const motion=new EntityMotion();
 motion.update(state,[],1000,.2);const a=motion.sample(enemy,'enemy');motion.update(state,[],1016,.6);const b=motion.sample(enemy,'enemy');assert.ok(b.clock>a.clock);assert.ok(b.progress>a.progress);const before=JSON.stringify(state);
 motion.update(state,[],1100,.6);assert.deepEqual(motion.sample(enemy,'enemy'),b);assert.equal(JSON.stringify(state),before);
 motion.update(state,[{action:'death',sourceKind:'enemy',sourceId:'e1',time:2,entity:{...enemy,hp:0}}],1116,.8);assert.equal(motion.deaths.length,1);state.battle.time=2.7;motion.update(state,[],1800,1);assert.equal(motion.deaths.length,0);
});
