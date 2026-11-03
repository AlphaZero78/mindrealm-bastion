import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFile, mkdir, readFile, readdir, rename, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const atelier=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const target=path.resolve(option('--target')||path.resolve(atelier,'../..'));
const pack=path.resolve(option('--pack')||path.join(atelier,'release/mindrealm-entity-pack'));
const backupArgument=option('--backup');
if(!backupArgument)throw Error('Provide an external --backup directory for the original runtime files');
const backup=path.resolve(backupArgument);
const inside=(root,relative)=>{
 const absolute=path.resolve(root,relative),part=path.relative(root,absolute);
 if(!part||part==='..'||part.startsWith('..'+path.sep)||path.isAbsolute(part))throw Error(`Path escapes its root: ${relative}`);
 return absolute;
};
const under=(root,file)=>{const value=path.relative(root,file);return !value||(!path.isAbsolute(value)&&value!=='..'&&!value.startsWith('..'+path.sep));};
if(under(target,backup)||under(pack,backup)||under(backup,target)||under(backup,pack))throw Error('Backup must be separate from source and target');
const exists=async file=>{try{return(await stat(file)).isFile();}catch(error){if(error.code==='ENOENT')return false;throw error;}};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function walk(root,prefix=''){
 const result=[];
 for(const entry of await readdir(path.join(root,prefix),{withFileTypes:true})){
  if(entry.isSymbolicLink())throw Error(`Asset links are not accepted: ${prefix}${entry.name}`);
  const relative=prefix+entry.name;
  if(entry.isDirectory())result.push(...await walk(root,relative+'/'));
  else if(entry.isFile())result.push(relative);
 }
 return result.sort();
}
const packageData=JSON.parse(await readFile(path.join(target,'package.json'),'utf8'));
assert.equal(packageData.name,'mindrealm-bastion','Target must be the existing game project');
const {towers,enemies}=await import(pathToFileURL(path.join(target,'game/web/core/content.js')).href);
const manifest=JSON.parse(await readFile(path.join(pack,'game/assets/game/models/models.json'),'utf8'));
assert.equal(manifest.format,2);
assert.deepEqual(Object.keys(manifest.entities).sort(),[...Object.keys(towers),...Object.keys(enemies)].sort());
const required=new Set(['assets/game/models/models.json','assets/game/models/tracking_drone/base.glb']);
let appearances=0;
for(const [id,definition]of Object.entries(manifest.entities)){
 const variants=towers[id]?['T1','T2A','T2B','T3A','T3B']:enemies[id].kind==='boss'?['phase1','phase2','phase3']:['base'];
 assert.deepEqual(Object.keys(definition.variants),variants,`${id}: appearance coverage`);
 assert.ok(Object.values(definition.bounds||{}).length===3&&Object.values(definition.bounds).every(value=>Number.isFinite(value)&&value>0),`${id}: finite model bounds`);
 for(const [variant,entry]of Object.entries(definition.variants)){
  assert.equal(entry.source,`models/${id}/${variant}.glb`);required.add('assets/game/'+entry.source);appearances++;
 }
 const kind=towers[id]?'towers':'enemies';
 required.add(`assets/game/portraits/${id}.png`);required.add(`assets/game/sprites/${kind}/${id}.png`);
 required.add(`assets/game/sprites/animations/${kind}/${id}.png`);
 if(kind==='enemies')required.add(`assets/game/sprites/death/enemies/${id}.png`);
}
assert.equal(appearances,109);
for(const file of await walk(path.join(pack,'game/web/view'))){
 if(!/^[a-z-]+\.js$/.test(file))throw Error(`Unexpected runtime view: ${file}`);
 required.add('web/view/'+file);
}
for(const file of await walk(path.join(pack,'game/assets/third_party/three')))required.add('assets/third_party/three/'+file);
for(const file of ['entity-renderer.js','whole-entity-renderer.js','entity-assets.js','entity-animation.js','mechanical-connections.js','entity-art.js','entity-art-bounds.js','model-portraits.js'])assert.ok(required.has('web/view/'+file),`Missing runtime module ${file}`);
// Preserve unrelated battlefield changes and accept only the three planned
// integration edits. Rebuilding a pack against an already integrated game works.
let battlefield=await readFile(path.join(target,'game/web/view/battlefield.js'),'utf8');
for(const [before,after]of [
 ['if(!this.realtime)for(const id of [...TOWERS,...ENEMIES])','for(const id of [...TOWERS,...ENEMIES])'],
 ['if(this.realtime){if(geometry)this.realtime.add(type,pose,geometry,{opacity,wreck,reducedMotion:!!this.selection.reducedMotion});this.entityFrames.push','if(this.realtime&&this.realtime.add(type,pose,geometry,{opacity,wreck,reducedMotion:!!this.selection.reducedMotion})){this.entityFrames.push'],
 ['this.realtime?.begin(this.camera,this.state.terrain,this.canvas.width,this.canvas.height);this.overlays=[];','this.realtime?.prepareState(this.state);this.realtime?.begin(this.camera,this.state.terrain,this.canvas.width,this.canvas.height);this.overlays=[];'],
]){
 if(battlefield.includes(before))battlefield=battlefield.replace(before,after);
 else assert.ok(battlefield.includes(after),'Battlefield integration contract changed');
}
assert.equal((await readFile(path.join(pack,'game/web/view/battlefield.js'),'utf8')).replaceAll('\r\n','\n'),battlefield.replaceAll('\r\n','\n'),'Pack would overwrite unrelated battlefield work');
const records=[];
for(const relative of [...required].sort()){
 const source=inside(path.join(pack,'game'),relative),destination=inside(path.join(target,'game'),relative),bytes=await readFile(source);
 assert.ok(bytes.length,relative);
 if(relative.endsWith('.glb')){
  assert.equal(bytes.readUInt32LE(0),0x46546c67,relative);assert.equal(bytes.readUInt32LE(8),bytes.length,relative);
  const doc=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)).trim());
  assert.deepEqual(doc.animations.map(clip=>clip.name),['idle','move','attack','windup','release','ability','shutdown'],relative);
 }
 if(relative.endsWith('.png'))assert.equal(bytes.toString('ascii',1,4),'PNG',relative);
 records.push({path:'game/'+relative,source,destination,sha256:hash(bytes),bytes:bytes.length,previous:await exists(destination)});
}
const old=JSON.parse(await readFile(path.join(target,'game/assets/game/models/models.json'),'utf8'));
const retired=old.format===2?[]:[...new Set([
 ...Object.values(old.sources||{}).map(entry=>'game'+entry.path),
 'game/assets/game/lighting/studio_small_09_pmrem.bin',
 ...['nor_gl.png','rough.jpg','diff.jpg'].map(suffix=>'game/assets/third_party/polyhaven/blue_metal_plate_'+suffix),
])];
for(const file of retired){
 assert.ok(/^game\/assets\/game\/models\/[^/]+\.glb$/.test(file)||file==='game/assets/game/lighting/studio_small_09_pmrem.bin'||/^game\/assets\/third_party\/polyhaven\/blue_metal_plate_(nor_gl\.png|rough\.jpg|diff\.jpg)$/.test(file),`Unexpected retirement ${file}`);
 inside(target,file);inside(backup,'retired/'+file);
}
await mkdir(backup,{recursive:false});
await writeFile(path.join(backup,'installation-plan.json'),JSON.stringify({target,pack,files:records.map(({source,destination,...record})=>record),retired},null,2)+'\n');
for(const record of records){
 if(record.previous){const saved=inside(backup,'overwritten/'+record.path);await mkdir(path.dirname(saved),{recursive:true});await copyFile(record.destination,saved);}
 await mkdir(path.dirname(record.destination),{recursive:true});await copyFile(record.source,record.destination);
 assert.equal(hash(await readFile(record.destination)),record.sha256,record.path);
}
for(const file of retired){
 const source=inside(target,file);if(!await exists(source))continue;
 const destination=inside(backup,'retired/'+file);await mkdir(path.dirname(destination),{recursive:true});await rename(source,destination);
}
for(const file of ['enemy-rig.test.mjs','model-reflection.test.mjs','entity-batches.test.mjs','pages.test.mjs','runtime-boundary.test.mjs','realtime-assets.test.mjs','whole-entity-test-helpers.mjs']){
 const destination=inside(target,'development/web-tests/'+file);
 if(await exists(destination)){const saved=inside(backup,'overwritten/development/web-tests/'+file);await mkdir(path.dirname(saved),{recursive:true});await copyFile(destination,saved);}
 await copyFile(path.join(atelier,'tools/migration',file),destination);
}
const inventory=inside(target,'development/web-tools/refresh-asset-manifest.mjs'),savedInventory=inside(backup,'overwritten/development/web-tools/refresh-asset-manifest.mjs');
await mkdir(path.dirname(savedInventory),{recursive:true});await copyFile(inventory,savedInventory);
await copyFile(path.join(atelier,'tools/refresh-asset-manifest.mjs'),inventory);
console.log(`MINDREALM_MODELS_INSTALLED entities=49 appearances=${appearances} files=${records.length} retired=${retired.length}`);
console.log(`Backup: ${backup}`);
console.log('Refresh the game asset manifest, then run the final game checks.');
