import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {enemies} from '../../game/web/core/content.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const authored=resolve(root,'development/assets/enemy_rework');
const finite3=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export function validateEnemyModel(model,sources){
 if(!enemies[model.id]||model.kind!=='enemies'||model.role!==enemies[model.id].kind)throw Error(`Unknown enemy model ${model.id}`);
 if(!model.design||!Array.isArray(model.rig)||model.rig.length<4)throw Error(`${model.id}: missing articulated design`);
 const joints=new Set();
 for(const joint of model.rig){if(!joint.id||joints.has(joint.id)||!finite3(joint.pivot)||joint.parent&&!joints.has(joint.parent))throw Error(`${model.id}: invalid joint ${joint.id}`);joints.add(joint.id);}
 const expected=model.role==='boss'?['phase1','phase2','phase3']:['base'];
 if(JSON.stringify(Object.keys(model.variants).sort())!==JSON.stringify(expected))throw Error(`${model.id}: variants do not match gameplay`);
 let maxX=0,maxY=0,maxZ=0;
 for(const [variant,parts] of Object.entries(model.variants)){
  if(!Array.isArray(parts)||parts.length<18)throw Error(`${model.id}/${variant}: insufficient structural detail`);
  const labels=new Set();
  for(const part of parts){
   if(!part.label||labels.has(part.label)||!sources[part.source]||!joints.has(part.joint)||!finite3(part.size)||part.size.some(v=>v<=0)||!finite3(part.position)||!finite3(part.rotation)||part.motion!=='fixed')throw Error(`${model.id}/${variant}: invalid part ${part.label}`);
   labels.add(part.label);
   if(part.mirrorX!==undefined&&typeof part.mirrorX!=='boolean')throw Error(`${model.id}/${variant}: mirrorX must be boolean`);
   const [rx,ry,rz]=part.rotation.map(v=>v*Math.PI/180),[cx,cy,cz]=[Math.cos(rx),Math.cos(ry),Math.cos(rz)],[sx,sy,sz]=[Math.sin(rx),Math.sin(ry),Math.sin(rz)];
   for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [0,1]){
    const v=[x*part.size[0],y*part.size[1],z*part.size[2]],a=[v[0],v[1]*cx-v[2]*sx,v[1]*sx+v[2]*cx],b=[a[0]*cy+a[2]*sy,a[1],-a[0]*sy+a[2]*cy],p=[b[0]*cz-b[1]*sz,b[0]*sz+b[1]*cz,b[2]].map((v,i)=>v+part.position[i]);
    maxX=Math.max(maxX,Math.abs(p[0]));maxY=Math.max(maxY,Math.abs(p[1]));maxZ=Math.max(maxZ,p[2]);
   }
  }
 }
 const {design,...runtime}=model;
 return {...runtime,bounds:{x:maxX*2,y:maxZ,z:maxY*2},visualRevision:2};
}
export async function buildEnemyModels({partial=false,ids=null,output=null}={}){
 const catalogPath=resolve(root,'game/assets/game/models/models.json');
 const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
 await mkdir(authored,{recursive:true});
 const files=(await readdir(authored)).filter(f=>f.endsWith('.mjs')&&(!ids||ids.includes(f.slice(0,-4)))).sort();
 if(!partial&&files.length!==Object.keys(enemies).length)throw Error(`Expected ${Object.keys(enemies).length} independently authored enemies, found ${files.length}`);
 for(const file of files){
  const model=(await import(pathToFileURL(resolve(authored,file)))).default,valid=validateEnemyModel(model,catalog.sources);
  const name=model.id.replaceAll('_','-'),animationPath=resolve(root,'game/web/view/enemy-animations',name+'.js');
  const module=await import(pathToFileURL(animationPath));if(typeof module.animate!=='function')throw Error(`Missing animation ${model.id}`);
  catalog.entities[model.id]=valid;
 }
 const built=Object.keys(catalog.entities).filter(id=>catalog.entities[id].visualRevision===2).sort(),imports=[],entries=[];
 for(const [index,id]of built.entries()){imports.push(`import {animate as a${index}} from './enemy-animations/${id.replaceAll('_','-')}.js';`);entries.push(` ${JSON.stringify(id)}:a${index}`);}
 const destination=output?resolve(output):catalogPath;
 if(output){const rel=relative(root,destination);if(!rel||!rel.startsWith('..')&&!isAbsolute(rel))throw Error('Stage enemy catalogs outside the repository');await mkdir(dirname(destination),{recursive:true});}
 await writeFile(destination,JSON.stringify(catalog)+'\n');
 if(!output)await writeFile(resolve(root,'game/web/view/enemy-animation-bank.js'),`// Independently authored enemy motion registry.\n${imports.join('\n')}\nconst animations={\n${entries.join(',\n')}\n};\nexport const enemyAnimationIds=Object.freeze(Object.keys(animations));\nexport function animateEnemy(type,context){return animations[type]?.(context)??null;}\n`);
 return {models:files.length,total:Object.keys(enemies).length,parts:Object.entries(catalog.entities).filter(([,d])=>d.visualRevision===2).map(([id,d])=>({id,joints:d.rig.length,variants:Object.values(d.variants).map(parts=>parts.length)}))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))buildEnemyModels({partial:process.argv.includes('--partial'),ids:process.argv.find(a=>a.startsWith('--ids='))?.slice(6).split(','),output:process.argv.find(a=>a.startsWith('--output='))?.slice(9)}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
