import {cp, mkdir, readFile, readdir, lstat, rm, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname, extname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {inventoryAssets} from './refresh-asset-manifest.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const marker = 'mindrealm-github-pages';
const manifestName = 'site-manifest.json';

export function normalizeBasePath(value) {
  if (value === '/') return '/';
  if (typeof value !== 'string' || !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\/?$/.test(value)) {
    throw Error('Base path must be / or a slash-prefixed repository path.');
  }
  return value.replace(/\/$/, '') + '/';
}

// Only the hosted copy is rewritten. Native packages keep their root URLs.
// Cover HTML attributes, CSS url(), JS strings/templates and model-index JSON.
export function rewriteHostedPaths(source, basePath) {
  const base = normalizeBasePath(basePath);
  return source.replace(/(["'`(])\/(assets|web)\//g, (_, prefix, folder) => `${prefix}${base}${folder}/`);
}

function within(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep));
}

async function filesBelow(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const name = prefix + entry.name;
    if (entry.isSymbolicLink()) throw Error(`Symbolic links are not published: ${name}`);
    if (entry.isDirectory()) files.push(...await filesBelow(join(directory, entry.name), name + '/'));
    else if (entry.isFile()) files.push(name);
  }
  return files.sort();
}

async function prepareOutput(output) {
  // Inside this checkout, only the ignored out/ area may hold build products.
  // Never permit an ancestor of the checkout as a recursive replacement target.
  if (within(output, projectRoot) || (within(projectRoot, output) &&
      (!within(join(projectRoot, 'out'), output) || output === join(projectRoot, 'out')))) {
    throw Error('Output must be a child of out/ or a separate directory outside the checkout.');
  }
  for (let parent = output; ; parent = dirname(parent)) {
    try { if ((await lstat(parent)).isSymbolicLink()) throw Error('Output must not traverse symbolic links.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (dirname(parent) === parent) break;
  }
  await mkdir(output, {recursive: true});
  if ((await readdir(output)).length) {
    const previous = JSON.parse(await readFile(join(output, manifestName), 'utf8').catch(() => 'null'));
    if (previous?.kind !== marker) throw Error('Refusing to replace an unrecognized output directory.');
    await filesBelow(output);
    await rm(output, {recursive: true});
    await mkdir(output, {recursive: true});
  }
}

export async function buildPages({outputDir = join(projectRoot, 'out/github-pages'), basePath = '/mindrealm-bastion/'} = {}) {
  const base = normalizeBasePath(basePath), output = resolve(outputDir);
  const metadata = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
  const inventory = await inventoryAssets(projectRoot);
  const assets = inventory.retained.filter(file => file.startsWith('assets/') &&
    (inventory.runtime.includes(file) || /\/(?:LICENSE|License|OFL)\.txt$/.test(file)));
  const webFiles = await filesBelow(join(projectRoot, 'web'));
  await prepareOutput(output);
  for (const name of [...webFiles.map(file => 'web/' + file), ...assets]) {
    const target = join(output, name);
    await mkdir(dirname(target), {recursive: true});
    const textResource = (name.startsWith('web/') && ['.js', '.css', '.html', '.json'].includes(extname(name))) ||
      name === 'assets/game/models/models.json';
    if (textResource) {
      await writeFile(target, rewriteHostedPaths(await readFile(join(projectRoot, name), 'utf8'), base));
    } else {
      await cp(join(projectRoot, name), target);
    }
  }
  await cp(join(output, 'web/index.html'), join(output, 'index.html'));
  await writeFile(join(output, '.nojekyll'), '');
  await mkdir(join(output, 'licenses'), {recursive: true});
  for (const kit of ['space-kit', 'modular-space-kit', 'tower-defense-kit']) {
    await cp(join(projectRoot, 'development/assets/model_sources/kenney', kit, 'License.txt'),
      join(output, 'licenses', `kenney-${kit}.txt`));
  }
  await cp(join(projectRoot, 'docs/THIRD_PARTY_ASSETS.md'), join(output, 'licenses/THIRD_PARTY_ASSETS.md'));
  const files = [], paths = await filesBelow(output);
  for (const path of paths) {
    const bytes = await readFile(join(output, path));
    files.push({path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')});
  }
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (totalBytes >= 1024 ** 3) throw Error('Static site exceeds the GitHub Pages 1 GiB size limit.');
  const manifest = {kind: marker, version: metadata.version, basePath: base,
    commit: process.env.GITHUB_SHA || null, totalBytes, files};
  await writeFile(join(output, manifestName), JSON.stringify(manifest, null, 2) + '\n');
  return {output, ...manifest};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {values} = parseArgs({options: {'base-path': {type: 'string'}, output: {type: 'string'}}});
  buildPages({basePath: values['base-path'], outputDir: values.output}).then(result => {
    console.log(`GITHUB_PAGES_BUILD_OK version=${result.version} base=${result.basePath} files=${result.files.length} bytes=${result.totalBytes} output=${result.output}`);
  }).catch(error => {console.error(error.message); process.exitCode = 1;});
}
