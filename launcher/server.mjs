import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.MINDREALM_PORT || 4173);
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ogg':'audio/ogg','.mp3':'audio/mpeg','.ttf':'font/ttf','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8' };
const server = http.createServer(async (req,res) => {
  try {
    const path = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path === '/health') { res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({app:'mindrealm-bastion',version:1})); return; }
    const requested = path === '/' ? 'web/index.html' : path.replace(/^\//,'');
    const allowed=/^(web|assets)\//.test(requested)||(process.env.MINDREALM_QA==='1'&&requested.startsWith('development/web-tests/helpers/'));
    if (!allowed) { res.writeHead(404); res.end('Not found'); return; }
    const file = resolve(root, requested);
    if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) { res.writeHead(404); res.end('Not found'); return; }
    const data = await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)] || 'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', error => { console.error(`启动失败：${error.message}`); process.exitCode=1; });
server.listen(port,'127.0.0.1',()=>console.log(`心域防线 http://127.0.0.1:${port}`));
