import http from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {dirname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGameServer} from '../../game/launcher/server.mjs';

const workspace=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const helperPrefix='/development/web-tests/helpers/';

export function instrumentApp(source,bridge){
 const replacements=[
  ['storage=localStorage;','storage=new MemoryStorage();'],
  ["Saves.createSaveStore(storage,'mindrealm.web.v2')","Saves.createSaveStore(storage,'mindrealm.qa.v2')"]
 ];
 for(const [from,to] of replacements){if(source.split(from).length!==2)throw Error(`Developer bridge requires exactly one storage boundary: ${from}`);source=source.replace(from,to);}
 if(source.includes('window.__mindrealm'))throw Error('Production app already contains developer instrumentation');
 return source+'\n'+bridge;
}

export function createDevelopmentServer({workspaceDirectory=workspace}={}){
 const root=resolve(workspaceDirectory),base=createGameServer({rootDirectory:resolve(root,'game')}),serveGame=base.listeners('request')[0];
 const helpers=realpath(resolve(root,'development/web-tests/helpers'));
 return http.createServer(async(req,res)=>{
  try{
   const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   if(!['GET','HEAD'].includes(req.method))return serveGame(req,res);
   if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:JSON.stringify({app:'mindrealm-bastion-development',version:1}));return;}
   let body,contentType='text/javascript; charset=utf-8';
   if(path==='/web/app.js'){
    const [source,bridge]=await Promise.all([readFile(resolve(root,'game/web/app.js'),'utf8'),readFile(resolve(root,'development/web-tools/qa-bridge.js'),'utf8')]);body=instrumentApp(source,bridge);
   }else if(path==='/development/assets/lighting/studio_small_09_1k.hdr'){
    body=await readFile(resolve(root,path.slice(1)));contentType='application/octet-stream';
   }else if(path.startsWith(helperPrefix)){
    const file=await realpath(resolve(root,path.slice(1))),canonical=await helpers;
    if(!file.startsWith(canonical+sep)||!(await stat(file)).isFile()||! /\.m?js$/.test(file)){res.writeHead(404);res.end();return;}
    body=(await readFile(file,'utf8')).replace(/(['"`])(?:\.\.\/)+game\/(web|assets)\//g,'$1/$2/');
   }else return serveGame(req,res);
   const bytes=Buffer.from(body);res.writeHead(200,{'Content-Type':contentType,'Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:500);res.end('Developer resource unavailable');}
 });
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.MINDREALM_DEV_PORT||4191);
 if(!Number.isInteger(port)||port<1024||port>65535||port===4173)throw Error('Use an isolated developer port, excluding 4173.');
 const server=createDevelopmentServer();server.on('error',error=>{console.error(error.message);process.exitCode=1;});
 server.listen(port,'127.0.0.1',()=>console.log(`MINDREALM_DEVELOPMENT_READY http://127.0.0.1:${port}/?qa=1`));
}
