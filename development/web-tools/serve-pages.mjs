import http from 'node:http';
import {readFile, realpath, stat} from 'node:fs/promises';
import {dirname, isAbsolute, relative, resolve, sep, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {normalizeBasePath} from './build-pages.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const types = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpg':'image/jpeg', '.mp3':'audio/mpeg', '.ogg':'audio/ogg',
  '.ttf':'font/ttf', '.txt':'text/plain; charset=utf-8', '.glb':'model/gltf-binary'};

export function createPagesPreview({directory, basePath}) {
  const base = normalizeBasePath(basePath), canonicalRoot = realpath(directory);
  return http.createServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) {res.writeHead(405); res.end(); return;}
      const url = new URL(req.url, 'http://localhost');
      if (base !== '/' && url.pathname === base.slice(0, -1)) {
        res.writeHead(301, {Location: base + url.search}); res.end(); return;
      }
      if (!url.pathname.startsWith(base)) {res.writeHead(404); res.end(); return;}
      const name = decodeURIComponent(url.pathname.slice(base.length)) || 'index.html';
      const canonical = await canonicalRoot, file = await realpath(resolve(canonical, name));
      const rel = relative(canonical, file);
      if (!rel || isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep) || !(await stat(file)).isFile()) {
        res.writeHead(404); res.end(); return;
      }
      const bytes = await readFile(file);
      res.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream',
        'Content-Length': bytes.length, 'Cache-Control': 'no-store'});
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch {res.writeHead(404); res.end();}
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {values} = parseArgs({options: {directory: {type: 'string', default: resolve(root, 'out/github-pages')},
    port: {type: 'string', default: '4187'}}});
  const manifest = JSON.parse(await readFile(resolve(values.directory, 'site-manifest.json'), 'utf8'));
  if (manifest.kind !== 'mindrealm-github-pages') throw Error('Directory is not a built Pages site.');
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 4173) throw Error('Choose an isolated preview port.');
  const server = createPagesPreview({directory: values.directory, basePath: manifest.basePath});
  server.on('error', error => {console.error(error.message); process.exitCode = 1;});
  server.listen(port, '127.0.0.1', () => console.log(`PAGES_PREVIEW http://127.0.0.1:${port}${manifest.basePath}?qa=1`));
}
