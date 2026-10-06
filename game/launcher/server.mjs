import http from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.MINDREALM_PORT || 4173);
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ogg':'audio/ogg','.mp3':'audio/mpeg','.ttf':'font/ttf','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8' };
const pathKey = value => process.platform === 'win32' ? value.toLowerCase() : value;
const within = (file, directory) => pathKey(file).startsWith(pathKey(directory + sep));
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
    if (req.method==='HEAD') { res.writeHead(200,{...headers,'Content-Length':info.size});res.end();return; }
    const data = await readFile(physical);
    res.writeHead(200,{...headers,'Content-Length':data.length});res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=createGameServer();
 server.on('error', error => { console.error(`启动失败：${error.message}`); process.exitCode=1; });
 server.listen(port,'127.0.0.1',()=>console.log(`心域防线 http://127.0.0.1:${port}`));
}
