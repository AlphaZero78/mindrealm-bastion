import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {once} from 'node:events';
import {createDevelopmentServer,instrumentApp} from '../web-tools/dev-server.mjs';
import {runtimeFiles} from '../web-tools/runtime-layout.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
test('all shipping module imports resolve inside the game tree without developer instrumentation',async()=>{
 const files=await runtimeFiles(root),shipped=new Set(files);
 for(const file of files.filter(p=>p.endsWith('.js')&&!p.startsWith('assets/'))){
  const source=await readFile(resolve(root,'game',file),'utf8');
  for(const match of source.matchAll(/(?:from\s*|import\s*\()(['"])(\.[^'"]+)\1/g)){
   const target=resolve(root,'game',dirname(file),match[2]);
   assert.ok(shipped.has(target.slice(resolve(root,'game').length+1).replaceAll('\\','/')),`${file}: ${match[2]}`);
   assert.ok((await stat(target)).isFile());
  }
 }
 assert.ok(!files.some(file=>/\.(?:import|uid|hdr|test\.mjs)$|AGENTS|model_sources|prompts\.json/.test(file)));
});
test('developer server isolates storage and exposes only its explicit helper and authoring routes',async t=>{
 const server=createDevelopmentServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url=`http://127.0.0.1:${server.address().port}`;
 const app=await (await fetch(url+'/web/app.js')).text();
 assert.ok(app.includes('window.__mindrealm='));assert.ok(!app.includes('storage=localStorage;'));
 assert.ok(app.includes("Saves.createSaveStore(storage,'mindrealm.qa.v2')"));
 const original=await readFile(resolve(root,'game/web/app.js'),'utf8');
 assert.ok(original.includes('storage=localStorage;'));assert.ok(!original.includes('__mindrealm'));
 assert.throws(()=>instrumentApp(original.replace('storage=localStorage;',''),'bridge'));
 const helper=await (await fetch(url+'/development/web-tests/helpers/reference-strategy.mjs')).text();
 assert.ok(helper.includes("'/web/core/"));assert.ok(!helper.includes('../../../game/'));
 assert.equal((await fetch(url+'/development/assets/lighting/studio_small_09_1k.hdr',{method:'HEAD'})).status,200);
 for(const path of ['/development/AGENTS.md','/development/web-tools/qa-bridge.js','/development/web-tests/helpers/..%2f..%2fAGENTS.md'])assert.equal((await fetch(url+path)).status,404,path);
 assert.equal((await (await fetch(url+'/health')).json()).app,'mindrealm-bastion-development');
});
