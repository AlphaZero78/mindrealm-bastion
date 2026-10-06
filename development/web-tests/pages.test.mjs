import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildPages, normalizeBasePath, rewriteHostedPaths} from '../web-tools/build-pages.mjs';
import {createPagesPreview} from '../web-tools/serve-pages.mjs';

test('Pages base paths reject external URLs, traversal and ambiguous path characters', () => {
  assert.equal(normalizeBasePath('/'), '/');
  assert.equal(normalizeBasePath('/mindrealm-bastion'), '/mindrealm-bastion/');
  assert.equal(normalizeBasePath('/games/mindrealm/'), '/games/mindrealm/');
  for (const value of ['', '//other.test/', 'https://example.com/', '/a/../b', '/a%2fb', '/a?x', '/a#x', '/a\\b', '/a//b']) {
    assert.throws(() => normalizeBasePath(value));
  }
});

test('hosted paths cover static HTML, CSS, dynamic JS and JSON while preserving other URLs', () => {
  const source = '<script src="/web/app.js"></script> url(/assets/font.ttf) ' +
    "const audio='/assets/audio/'; const image=`/assets/${name}.png`; " +
    '{"path":"/assets/model.glb"} https://example.com/assets/image.png ../../assets/library.js';
  const actual = rewriteHostedPaths(source, '/mindrealm-bastion/');
  assert.ok(actual.includes('src="/mindrealm-bastion/web/app.js"'));
  assert.ok(actual.includes('url(/mindrealm-bastion/assets/font.ttf)'));
  assert.ok(actual.includes('`/mindrealm-bastion/assets/${name}.png`'));
  assert.ok(actual.includes('"path":"/mindrealm-bastion/assets/model.glb"'));
  assert.ok(actual.includes('https://example.com/assets/image.png ../../assets/library.js'));
  assert.equal(rewriteHostedPaths(actual, '/mindrealm-bastion/'), actual);
  assert.equal(rewriteHostedPaths(source, '/'), source);
});

test('Pages refuses to replace source directories or unrelated files', async t => {
  const root = await mkdtemp(join(tmpdir(), 'mindrealm-pages-guard-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  const file = join(root, 'keep.txt'); await writeFile(file, 'keep me');
  await assert.rejects(buildPages({outputDir: root}), /unrecognized/);
  assert.equal(await readFile(file, 'utf8'), 'keep me');
  await assert.rejects(buildPages({outputDir: new URL('../../game/web/', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '')}), /Output/);
});

test('complete static export works under a repository subpath, including model and license assets', async t => {
  const root = await mkdtemp(join(tmpdir(), 'mindrealm-pages-export-')), output = join(root, 'site');
  t.after(() => rm(root, {recursive:true, force:true}));
  const sourceIndex = await readFile(new URL('../../game/web/index.html', import.meta.url), 'utf8');
  const result = await buildPages({outputDir: output});
  const server = createPagesPreview({directory: output, basePath: result.basePath});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`, base = origin + result.basePath;
  const index = await (await fetch(base + '?qa=1')).text();
  assert.equal(index, rewriteHostedPaths(sourceIndex, result.basePath));
  assert.equal((await fetch(origin + '/web/app.js')).status, 404);
  assert.equal((await fetch(base + 'launcher/server.mjs')).status, 404);
  assert.equal((await fetch(base + 'development/web-tests/helpers/reference-strategy.mjs')).status, 404);
  const models = await (await fetch(base + 'assets/game/models/models.json')).json();
  for (const definition of Object.values(models.sources)) {
    assert.ok(definition.path.startsWith(result.basePath + 'assets/'));
    assert.equal((await fetch(origin + definition.path, {method:'HEAD'})).status, 200);
  }
  for (const path of ['assets/third_party/three/three.bundle.js', 'assets/third_party/fusion-pixel-font/fusion-pixel-10px-zh_hans.ttf',
    'assets/third_party/opengameart/singularity/singularity_calm.mp3', 'licenses/kenney-space-kit.txt']) {
    assert.equal((await fetch(base + path, {method:'HEAD'})).status, 200);
  }
  for (const file of result.files) {
    assert.equal(createHash('sha256').update(await readFile(join(output, file.path))).digest('hex'), file.sha256);
    assert.ok(!/^(launcher|development|runtime|\.git)\//.test(file.path));
  }
  assert.equal(await readFile(new URL('../../game/web/index.html', import.meta.url), 'utf8'), sourceIndex);
  const rebuilt = await buildPages({outputDir: output});
  assert.deepEqual(rebuilt.files, result.files);
});
