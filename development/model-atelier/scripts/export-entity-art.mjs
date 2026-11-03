import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'qa', 'entity-art');
const WORK = path.join(OUTPUT, '_work');
const MANIFEST = path.join(ROOT, 'release', 'mindrealm-entity-pack', 'game', 'assets', 'game', 'models', 'models.json');
const CONTENT = process.env.MINDREALM_GAME_CONTENT || process.env.MINDREALM_CONTENT || 'D:/game_build/game/web/core/content.js';
const EXPORT_VERSION = 1;
const SAMPLE_IDS = ['static_drifter', 'arc_mortar', 'noise_hive'];
const CAST_ABILITIES = new Set(['heal', 'group_shield', 'summon', 'copy', 'teleport', 'jam', 'corrode_resistance', 'siege', 'sprint', 'pressure_aura', 'haste', 'shield']);
const EXTRA_CAST = new Map(Object.entries({
  scrap_bulwark: false,
  echo_glider: true,
  noise_bell: true,
  memory_runner: true,
  repair_skiff: true,
  null_wing: true,
  entropy_engine: true,
  archive_warden: true,
  ordered_sentinel: false,
}));
const SUPPORT_TOWERS = new Set(['bandwidth_relay', 'memory_mechanic', 'frequency_choir', 'resistance_beacon']);

function parseArgs(argv) {
  const options = { all: false, force: false, ids: [], port: 4179, timeout: 600_000, browser: process.env.CHROME_PATH || '' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all') options.all = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--ids') options.ids.push(...argv[++i].split(',').map(value => value.trim()).filter(Boolean));
    else if (arg === '--port') options.port = Number(argv[++i]);
    else if (arg === '--timeout') options.timeout = Number(argv[++i]) * 1000;
    else if (arg === '--browser') options.browser = argv[++i];
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`未知参数：${arg}`);
  }
  return options;
}

function usage() {
  console.log(`用法：
  node scripts/export-entity-art.mjs --ids static_drifter,arc_mortar,noise_hive
  node scripts/export-entity-art.mjs --all
选项：--force 重新生成已有实体；--browser <chrome.exe>；--port 4179；--timeout 600（秒）。
默认仅生成三件样本；输出始终写入 qa/entity-art。`);
}

async function readGameplay() {
  const text = await readFile(CONTENT, 'utf8');
  const start = text.indexOf('"enemies"');
  if (start < 0) throw new Error(`无法从 ${CONTENT} 读取敌人能力分类`);
  const end = text.indexOf('\n  ],', start);
  const section = text.slice(start, end < 0 ? undefined : end);
  const enemies = new Map();
  for (const match of section.matchAll(/\{([^{}]+)\}/g)) {
    const body = match[1];
    const id = body.match(/"id"\s*:\s*"([^"]+)"/)?.[1];
    if (!id) continue;
    enemies.set(id, {
      ability: body.match(/"ability"\s*:\s*"([^"]+)"/)?.[1] || 'none',
      air: body.match(/"air"\s*:\s*(true|false)/)?.[1] === 'true',
    });
  }
  return enemies;
}

function behaviorFor(id, definition, gameplay) {
  if (definition.kind === 'towers') return { cast: definition.role === 'support' || SUPPORT_TOWERS.has(id), air: false };
  const spec = gameplay.get(id);
  const cast = spec ? CAST_ABILITIES.has(spec.ability) : EXTRA_CAST.get(id);
  if (cast === undefined) throw new Error(`${id} 没有可确认的能力动作分类`);
  return { cast, air: spec?.air ?? /air|hover|flight/i.test(definition.locomotion) };
}

function browserExecutable(requested) {
  const candidates = [
    requested,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].filter(Boolean);
  const executable = candidates.find(candidate => existsSync(candidate));
  if (!executable) throw new Error('未找到 Chrome/Edge；请用 --browser 指定浏览器可执行文件');
  return executable;
}

async function serverHealthy(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureServer(port) {
  if (await serverHealthy(port)) return null;
  const child = spawn(process.execPath, ['server.mjs', '--port', String(port)], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let error = '';
  child.stderr.on('data', chunk => { error += chunk; });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error(`静态服务器启动失败：${error || child.exitCode}`);
    if (await serverHealthy(port)) return child;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error(`静态服务器未就绪：${error}`);
}

async function atomicWrite(target, data) {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}`;
  await writeFile(temporary, data);
  await rename(temporary, target);
}

function safePngPath(relative) {
  const normalized = String(relative).replaceAll('\\', '/');
  if (!/^assets\/game\/(?:portraits|sprites)\/[A-Za-z0-9_/-]+\.png$/.test(normalized) || normalized.includes('..')) {
    throw new Error(`拒绝非法输出路径：${relative}`);
  }
  const target = path.resolve(OUTPUT, normalized);
  if (!target.startsWith(`${OUTPUT}${path.sep}`)) throw new Error(`输出越界：${relative}`);
  return target;
}

let authoringDigest;
async function artifactSignature(definition, behavior) {
  const hash = createHash('sha256');
  if (!authoringDigest) {
    const digest = createHash('sha256');
    const directory = path.join(ROOT, 'src/runtime');
    for (const file of (await readdir(directory)).filter(file => file.endsWith('.js')).sort()) {
      digest.update(file).update(await readFile(path.join(directory, file)));
    }
    digest.update(await readFile(path.join(ROOT, 'tools/presentation/entity-art.js')));
    digest.update(await readFile(fileURLToPath(import.meta.url)));
    authoringDigest = digest.digest('hex');
  }
  hash.update(String(EXPORT_VERSION)).update(authoringDigest);
  hash.update(JSON.stringify({ kind: definition.kind, role: definition.role, stride: definition.stride, behavior }));
  for (const [variant, entry] of Object.entries(definition.variants)) {
    hash.update(variant).update(await readFile(path.join(path.dirname(MANIFEST), entry.source.slice('models/'.length))));
  }
  return hash.digest('hex');
}

async function hasSuccessfulWork(id, signature) {
  try {
    const metadata = JSON.parse(await readFile(path.join(WORK, `${id}.json`), 'utf8'));
    if (metadata.version !== EXPORT_VERSION || metadata.signature !== signature) return false;
    for (const file of metadata.files) if (!existsSync(safePngPath(file.path))) return false;
    return true;
  } catch {
    return false;
  }
}

async function exportEntity(browser, options, id, definition, behavior, signature) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.exposeFunction('__entityArtWrite', async (relative, base64) => {
    const bytes = Buffer.from(base64, 'base64');
    if (!bytes.length || bytes.length > 64 * 1024 * 1024) throw new Error(`PNG 大小异常：${relative}`);
    await atomicWrite(safePngPath(relative), bytes);
    return bytes.length;
  });
  const started = performance.now();
  try {
    const query = new URLSearchParams({ id, cast: behavior.cast ? '1' : '0', air: behavior.air ? '1' : '0' });
    await page.goto(`http://127.0.0.1:${options.port}/tools/presentation/index.html?${query}`, {
      waitUntil: 'load', timeout: options.timeout,
    });
    await page.waitForFunction(() => window.__entityArtResult || window.__entityArtError, null, {
      polling: 100, timeout: options.timeout,
    });
    const error = await page.evaluate(() => window.__entityArtError || null);
    if (error) throw new Error(`${error.message}\n${error.stack || ''}`);
    const result = await page.evaluate(() => window.__entityArtResult);
    if (!result) throw new Error(`${id} 未返回制作结果`);
    if (result.stats.renderer.errors?.length) throw new Error(`${id} 渲染器错误：${result.stats.renderer.errors.join('; ')}`);
    if (result.id !== id || result.kind !== definition.kind) throw new Error(`${id} 返回了错误实体数据`);
    const metadata = {
      version: EXPORT_VERSION,
      ...result,
      signature,
      behavior,
      elapsedMs: Math.round(performance.now() - started),
      generatedAt: new Date().toISOString(),
    };
    await atomicWrite(path.join(WORK, `${id}.json`), `${JSON.stringify(metadata, null, 2)}\n`);
    const bytes = result.files.reduce((sum, file) => sum + file.bytes, 0);
    console.log(`${id}: ${result.variants.length} variants, ${result.files.length} PNG, ${(bytes / 1024 / 1024).toFixed(2)} MiB, ${result.stats.framesPerSpritePass} frames/pass, portrait ${result.stats.portraitPasses} pass, sprites ${result.stats.spritePasses} pass, ${(metadata.elapsedMs / 1000).toFixed(1)}s`);
    return result;
  } catch (error) {
    if (consoleErrors.length) error.message += `\n浏览器错误：\n${consoleErrors.join('\n')}`;
    throw error;
  } finally {
    await page.close();
  }
}

async function writeConfigurations(manifest, signatures) {
  const portraits = {};
  const bounds = {};
  let completed = 0;
  for (const [id, definition] of Object.entries(manifest.entities)) {
    try {
      const metadata = JSON.parse(await readFile(path.join(WORK, `${id}.json`), 'utf8'));
      if (metadata.version !== EXPORT_VERSION || metadata.signature !== signatures.get(id)) continue;
      portraits[id] = metadata.portrait;
      bounds[id] = metadata.art;
      completed++;
    } catch {
      // A partial sample run writes a deliberately partial configuration.
    }
  }
  await atomicWrite(path.join(OUTPUT, 'web', 'view', 'model-portraits.js'), `export const MODEL_PORTRAITS=${JSON.stringify(portraits, null, 2)};\n`);
  await atomicWrite(path.join(OUTPUT, 'web', 'view', 'entity-art-bounds.json'), `${JSON.stringify(bounds, null, 2)}\n`);
  return completed;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error('无效端口');
  if (!Number.isFinite(options.timeout) || options.timeout < 30_000) throw new Error('单实体超时不能低于 30 秒');
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const ids = options.all ? Object.keys(manifest.entities) : options.ids.length ? options.ids : SAMPLE_IDS;
  for (const id of ids) if (!manifest.entities[id]) throw new Error(`models.json 中不存在 ${id}`);
  if (new Set(ids).size !== ids.length) throw new Error('实体清单存在重复 ID');
  const gameplay = await readGameplay();
  const signatures = new Map();
  for (const [id, definition] of Object.entries(manifest.entities)) {
    signatures.set(id, await artifactSignature(definition, behaviorFor(id, definition, gameplay)));
  }
  await mkdir(WORK, { recursive: true });
  const pending = [];
  for (const id of ids) {
    if (!options.force && await hasSuccessfulWork(id, signatures.get(id))) console.log(`${id}: skip (already generated)`);
    else pending.push(id);
  }
  let server = null;
  let browser = null;
  try {
    if (pending.length) {
      server = await ensureServer(options.port);
      browser = await chromium.launch({
        executablePath: browserExecutable(options.browser),
        headless: true,
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--hide-scrollbars'],
      });
      let completed = 0;
      for (const id of pending) {
        console.log(`[${++completed}/${pending.length}] ${id}`);
        await exportEntity(browser, options, id, manifest.entities[id], behaviorFor(id, manifest.entities[id], gameplay), signatures.get(id));
        await writeConfigurations(manifest, signatures);
      }
    }
    const configured = await writeConfigurations(manifest, signatures);
    const files = (await readdir(WORK)).filter(name => name.endsWith('.json')).length;
    console.log(`Done: ${ids.length} selected, ${pending.length} rendered, ${configured} configured, ${files} work records. Output: ${path.relative(ROOT, OUTPUT)}`);
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
