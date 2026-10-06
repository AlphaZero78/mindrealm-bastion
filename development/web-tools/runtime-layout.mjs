import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inventoryAssets} from './refresh-asset-manifest.mjs';

async function filesUnder(root,prefix=''){
 const result=[];
 for(const entry of await readdir(resolve(root,prefix),{withFileTypes:true})){
  const path=prefix+entry.name;if(entry.isSymbolicLink())throw Error(`Runtime links are not allowed: ${path}`);
  if(entry.isDirectory())result.push(...await filesUnder(root,path+'/'));else if(entry.isFile())result.push(path);
 }
 return result.sort();
}

// A single shipping boundary is shared by Windows and GitHub Pages exporters.
export async function runtimeFiles(workspace){
 const root=resolve(workspace,'game'),inventory=await inventoryAssets(workspace),paths=await filesUnder(root);
 const assets=new Set(inventory.retained.filter(p=>p.startsWith('game/assets/')).map(p=>p.slice(5)));
 for(const path of paths){
  const permitted=path.startsWith('assets/')?assets.has(path):
   /^web\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.(?:js|css|html|svg)$/.test(path)||
   /^licenses\/(?:THIRD_PARTY_ASSETS\.md|kenney-[a-z-]+\.txt)$/.test(path)||
   ['launcher/server.mjs','launcher/web_game.ps1','launcher/start_web.cmd'].includes(path);
  if(!permitted)throw Error(`File outside the shipping boundary: game/${path}`);
  if(/^(?:web|launcher)\//.test(path)){
   const text=await readFile(resolve(root,path),'utf8');
   if(/__mindrealm|MINDREALM_QA|development\/|\bdebugger\s*;|[A-Z]:[\\/]Users[\\/]/.test(text))throw Error(`Developer residue in game/${path}`);
  }
 }
 return paths;
}
