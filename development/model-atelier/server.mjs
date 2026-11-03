import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const portArgument = process.argv.indexOf('--port');
const port = Number(portArgument >= 0 ? process.argv[portArgument + 1] : process.env.PORT || 4179);
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.glb': 'model/gltf-binary',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

const server = http.createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end('Method not allowed');
      return;
    }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
      response.end(JSON.stringify({ status: 'ok', models: 6, animations: 24 }));
      return;
    }
    const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    const info = await stat(target);
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Content-Length': info.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('未找到请求的资源');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`心域防线 · 原创构造观测台\nhttp://127.0.0.1:${port}/\n按 Ctrl+C 停止本地预览。`);
});
