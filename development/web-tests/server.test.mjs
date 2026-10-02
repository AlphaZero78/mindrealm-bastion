import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,mkdir,writeFile,utimes,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {once} from 'node:events';
import {createGameServer} from '../../launcher/server.mjs';

async function fixture(t,qa=false){
 const root=await mkdtemp(join(tmpdir(),'mindrealm-server-audit-'));
 assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep+'mindrealm-server-audit-'));
 await mkdir(join(root,'web'));await mkdir(join(root,'assets'));await mkdir(join(root,'development/web-tests/helpers'),{recursive:true});
 await writeFile(join(root,'web/index.html'),'test page');await writeFile(join(root,'web/app.js'),'old js');await writeFile(join(root,'private.txt'),'not public');await writeFile(join(root,'development/web-tests/helpers/fixture.mjs'),'qa helper');
 const server=createGameServer({rootDirectory:root,qa});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
 const request=(path='/',options={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path,...options},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));});req.on('error',reject);req.end();});
 return {root,request};
}
test('public server serves only resolved public trees, including encoded separator and link checks',async t=>{
 const {root,request}=await fixture(t);assert.equal((await request('/')).body,'test page');
 for(const path of ['/private.txt','/web/..%2fprivate.txt','/assets/..%5cprivate.txt','/web/%2e%2e%2fprivate.txt','/web/../../private.txt','/web/app.js%00','/development/web-tests/helpers/fixture.mjs'])assert.equal((await request(path)).status,404,path);
 await mkdir(join(root,'private'));await writeFile(join(root,'private/secret.txt'),'secret');await symlink(join(root,'private'),join(root,'assets/link'),'junction');
 assert.equal((await request('/assets/link/secret.txt')).status,404);
 assert.equal((await request('/web')).status,404);assert.equal((await request('/web/missing.js')).status,404);
 assert.equal((await request('/',{method:'POST'})).status,405);
});
test('HEAD avoids a payload and ETag revalidates unchanged and modified local resources',async t=>{
 const {root,request}=await fixture(t);const first=await request('/web/app.js');assert.equal(first.status,200);assert.equal(first.body,'old js');assert.equal(first.headers['cache-control'],'no-cache');assert.equal(first.headers['x-content-type-options'],'nosniff');
 const head=await request('/web/app.js',{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.body,'');assert.equal(Number(head.headers['content-length']),6);
 const cached=await request('/web/app.js',{headers:{'If-None-Match':first.headers.etag}});assert.equal(cached.status,304);assert.equal(cached.body,'');
 await writeFile(join(root,'web/app.js'),'new js');const time=new Date(Date.now()+2000);await utimes(join(root,'web/app.js'),time,time);
 const changed=await request('/web/app.js',{headers:{'If-None-Match':first.headers.etag}});assert.equal(changed.status,200);assert.equal(changed.body,'new js');assert.notEqual(changed.headers.etag,first.headers.etag);
 assert.deepEqual(JSON.parse((await request('/health')).body),{app:'mindrealm-bastion',version:1});assert.equal((await request('/health',{method:'HEAD'})).body,'');
});
test('QA helper access is explicit and cannot escape its own directory',async t=>{
 const {request}=await fixture(t,true);assert.equal((await request('/development/web-tests/helpers/fixture.mjs')).body,'qa helper');
 assert.equal((await request('/development/web-tests/helpers/..%2f..%2f..%2fprivate.txt')).status,404);
});
