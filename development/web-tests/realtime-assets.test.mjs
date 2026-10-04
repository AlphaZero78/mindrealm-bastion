import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {towers,enemies,events} from '../../web/core/content.js';
import {MODEL_PORTRAITS} from '../../web/view/model-portraits.js';
import {EntityMotion} from '../../web/view/entity-motion.js';
const bytes=path=>readFile(new URL('../../'+path,import.meta.url));
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
test('36 full event illustrations and 49 high resolution portrait sheets preserve their declared frames',async()=>{
 const hashes=new Set();for(const id of Object.keys(events)){const data=await bytes(`assets/game/events/${id}.png`);assert.equal(data.toString('ascii',1,4),'PNG');assert.ok(data.readUInt32BE(16)>=1600);assert.ok(data.readUInt32BE(20)>=900);hashes.add(createHash('sha256').update(data).digest('hex'));}assert.equal(hashes.size,36);
 assert.equal(Object.keys(MODEL_PORTRAITS).length,49);for(const [id,art]of Object.entries(MODEL_PORTRAITS)){const data=await bytes(art.path.slice(1));assert.equal(data.readUInt32BE(16),256,id);assert.equal(data.readUInt32BE(20),256*art.rows,id);assert.equal(data[25],6,id);assert.ok(art.bounds.x>=0&&art.bounds.y>=0&&art.bounds.width>0&&art.bounds.height>0&&art.bounds.x+art.bounds.width<=256&&art.bounds.y+art.bounds.height<=256);}
 assert.equal((await bytes('assets/game/lighting/studio_small_09_pmrem.bin')).length,768*1024*8);
});
test('visual interpolation advances joint phases between physics steps and retains future death cues',()=>{
 const enemy={id:'e1',type:'static_drifter',x:5,z:8,h:0,hp:40,maxHp:40,motion:{dx:.15,dz:0,distance:2.1}},state={units:[],battle:{time:2,enemies:[enemy]}};const motion=new EntityMotion();
 motion.update(state,[],1000,.2);const a=motion.sample(enemy,'enemy');motion.update(state,[],1016,.6);const b=motion.sample(enemy,'enemy');assert.ok(b.clock>a.clock);assert.ok(b.progress>a.progress);const before=JSON.stringify(state);
 motion.update(state,[],1100,.6);assert.deepEqual(motion.sample(enemy,'enemy'),b);assert.equal(JSON.stringify(state),before);
 motion.update(state,[{action:'death',sourceKind:'enemy',sourceId:'e1',time:2,entity:{...enemy,hp:0}}],1116,.8);assert.equal(motion.deaths.length,1);state.battle.time=2.7;motion.update(state,[],1800,1);assert.equal(motion.deaths.length,0);
});
