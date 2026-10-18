import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../../game/assets/third_party/three/three.bundle.js';
import {reflectGeometryX} from '../../game/web/view/model-reflection.js';
import {mirrored} from '../web-tools/enemy-model-authoring.mjs';

test('source reflection preserves the actual curved panel normals, UVs and outward winding',async()=>{
 const bytes=await readFile(new URL('../../game/assets/game/models/space-kit__corridor_wallCorner.glb',import.meta.url));
 const model=await new T.GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const sources=[];model.scene.traverse(node=>{if(node.isMesh)sources.push(node.geometry);});
 assert.ok(sources.length>=2,'Both LODs');
 for(const source of sources)for(const original of [source,source.index?source.toNonIndexed():source.clone()]){
  const before=original.attributes.position.array.slice(),reflected=reflectGeometryX(original),restored=reflectGeometryX(reflected);
  assert.deepEqual(original.attributes.position.array,before,'Source stays unchanged');
  assert.deepEqual(reflected.attributes.uv.array,original.attributes.uv.array,'UVs follow their vertices');
  assert.deepEqual(restored.attributes.position.array,original.attributes.position.array,'Double reflection');
  for(let i=0;i<before.length;i++)assert.equal(reflected.attributes.position.array[i],i%3===0?-before[i]:before[i]);
  const indices=original.index?.array||Array.from({length:original.attributes.position.count},(_,i)=>i);
  const faceDot=(geometry,a,b,c)=>{
   const p=geometry.attributes.position,n=geometry.attributes.normal;
   return new T.Vector3().fromBufferAttribute(p,b).sub(new T.Vector3().fromBufferAttribute(p,a))
    .cross(new T.Vector3().fromBufferAttribute(p,c).sub(new T.Vector3().fromBufferAttribute(p,a)))
    .dot(new T.Vector3().fromBufferAttribute(n,a).add(new T.Vector3().fromBufferAttribute(n,b)).add(new T.Vector3().fromBufferAttribute(n,c)));
  };
  for(let i=0;i<indices.length;i+=3){const a=indices[i],b=indices[i+1],c=indices[i+2];
   assert.equal(reflected.index.array[i],a);assert.equal(reflected.index.array[i+1],c);assert.equal(reflected.index.array[i+2],b);
   assert.ok(Math.abs(faceDot(original,a,b,c)-faceDot(reflected,a,c,b))<1e-8,'Reflected faces keep their outward normals');
  }
 }
});

test('bilateral authoring reflects an asymmetric source under nonuniform scale and tilted joints',()=>{
 const pair=mirrored('test panel','space-kit/corridor_wallCorner',[.23,.79,.66],[.61,-.24,.83],['left','right'],[17,23,-11]);
 assert.equal(pair[0].mirrorX,true);assert.equal(pair[1].mirrorX,undefined);
 const matrix=p=>new T.Matrix4().compose(new T.Vector3(...p.position),new T.Quaternion().setFromEuler(new T.Euler(...p.rotation.map(v=>v*Math.PI/180),'ZYX')),new T.Vector3(...p.size));
 const left=matrix(pair[0]),right=matrix(pair[1]);
 for(const point of [[.49,.17,.06],[-.31,.42,.95],[.13,-.5,.73]]){
  const a=new T.Vector3(-point[0],point[1],point[2]).applyMatrix4(left),b=new T.Vector3(...point).applyMatrix4(right);b.x=-b.x;
  assert.ok(a.distanceTo(b)<1e-12);
 }
});

test('paired curved baffles and every tower side module retain both handed counterparts',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../../game/assets/game/models/models.json',import.meta.url),'utf8'));
 const same=(a,b)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<1e-9);
 const counterparts=(left,right)=>left.source===right.source&&same(left.size,right.size)&&same(left.position,[-right.position[0],right.position[1],right.position[2]])&&same(left.rotation,[right.rotation[0],-right.rotation[1],-right.rotation[2]])&&left.mirrorX===true&&!right.mirrorX;
 const baffles=catalog.entities.tempo_amplifier.variants.base.filter(p=>p.source==='space-kit/corridor_wallCorner'&&/^baffle[LR]$/.test(p.joint));
 assert.equal(baffles.length,2);
 assert.ok(counterparts(baffles.find(p=>p.joint==='baffleL'),baffles.find(p=>p.joint==='baffleR')),'Acoustic panels must bend in opposite directions');
 for(const [id,model]of Object.entries(catalog.entities))if(model.kind==='towers')for(const [variant,parts]of Object.entries(model.variants)){
  for(const p of parts.filter(p=>p.motion.endsWith('L'))){
   const matches=parts.filter(q=>q.motion===p.motion.slice(0,-1)+'R'&&counterparts(p,q));
   assert.equal(matches.length,1,`${id}/${variant}/${p.motion}: missing reflected mount`);
  }
  for(const p of parts.filter(p=>p.motion.endsWith('R')))assert.ok(parts.some(q=>q.motion===p.motion.slice(0,-1)+'L'&&counterparts(q,p)),`${id}/${variant}/${p.motion}: unpaired side module`);
 }
});
