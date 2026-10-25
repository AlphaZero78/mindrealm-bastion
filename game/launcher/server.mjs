import http from 'node:http';
import { stat, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.MINDREALM_PORT || 4173);
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ogg':'audio/ogg','.mp3':'audio/mpeg','.mp4':'video/mp4','.ttf':'font/ttf','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8' };
const pathKey = value => process.platform === 'win32' ? value.toLowerCase() : value;
const within = (file, directory) => pathKey(file).startsWith(pathKey(directory + sep));
export function sendStaticFile(req,res,file,info,headers={}) {
 const base={...headers,'Accept-Ranges':'bytes','Last-Modified':info.mtime.toUTCString()};
 if(req.method==='HEAD'){res.writeHead(200,{...base,'Content-Length':info.size});res.end();return;}
 const condition=req.headers['if-range'];
 const canRange=!condition||(!condition.startsWith('W/')&&condition===headers.ETag)||(!Number.isNaN(Date.parse(condition))&&Math.floor(info.mtimeMs/1000)<=Date.parse(condition)/1000);
 let start=0,end=info.size-1,status=200;
 if(req.headers.range&&canRange){
  const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  let valid=!!match&&(match[1]!==''||match[2]!=='');
  if(valid){
   if(match[1]===''){const count=Number(match[2]);valid=Number.isSafeInteger(count)&&count>0;start=Math.max(0,info.size-count);}
   else{start=Number(match[1]);end=match[2]===''?end:Math.min(end,Number(match[2]));}
   valid=valid&&Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<=end&&start<info.size;
  }
  if(!valid){res.writeHead(416,{...base,'Content-Range':`bytes */${info.size}`,'Content-Length':0});res.end();return;}
  status=206;base['Content-Range']=`bytes ${start}-${end}/${info.size}`;
 }
 res.writeHead(status,{...base,'Content-Length':info.size?end-start+1:0});
 if(!info.size){res.end();return;}
 const stream=createReadStream(file,{start,end});
 stream.on('error',error=>res.destroy(error));res.on('close',()=>stream.destroy());stream.pipe(res);
}
export function createGameServer({rootDirectory = root} = {}) {
 const publicDirectories = ['web','assets','licenses'];
 const canonicalRoot = realpath(rootDirectory);
 return http.createServer(async (req,res) => {
  try {
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,{'Allow':'GET, HEAD'}); res.end(); return; }
    const path = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path === '/health') { const body=JSON.stringify({app:'mindrealm-bastion',version:1});res.writeHead(200,{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store'}); res.end(req.method==='HEAD'?undefined:body); return; }
    const requested = path === '/' ? 'web/index.html' : path.replace(/^\//,'');
    const file = resolve(rootDirectory, requested);
    // Validate the decoded, resolved path and its physical destination. Prefix
    // checks on the URL alone allow encoded separators to escape public trees.
    if (!publicDirectories.some(dir=>within(file,resolve(rootDirectory,dir)))) { res.writeHead(404); res.end('Not found'); return; }
    const physical=await realpath(file),canonical=await canonicalRoot;
    if (!publicDirectories.some(dir=>within(physical,resolve(canonical,dir)))) { res.writeHead(404); res.end('Not found'); return; }
    const info=await stat(physical);
    if (!info.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    const etag=`W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
    const headers={'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','ETag':etag,'X-Content-Type-Options':'nosniff'};
    if ((req.headers['if-none-match']||'').split(',').some(value=>value.trim()===etag||value.trim()==='*')) { res.writeHead(304,headers);res.end();return; }
    sendStaticFile(req,res,physical,info,headers);
  } catch { res.writeHead(404); res.end('Not found'); }
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=createGameServer();
 server.on('error', error => { console.error(`启动失败：${error.message}`); process.exitCode=1; });
 server.listen(port,'127.0.0.1',()=>console.log(`心域防线 http://127.0.0.1:${port}`));
}
