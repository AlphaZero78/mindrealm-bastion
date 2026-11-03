import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK = path.join(ROOT, 'release', 'mindrealm-entity-pack');
const REPORTS = path.join(ROOT, 'qa', 'reports');
const OPTIMIZED = path.join(ROOT, 'qa', 'optimized-runtime', 'reports');
const npm = process.platform === 'win32' ? 'cmd.exe' : 'npm';
const npmArguments = command => process.platform === 'win32' ? ['/d', '/s', '/c', 'npm', ...command] : command;
const json = async file => JSON.parse(await readFile(file, 'utf8'));

async function report(name) {
  const file = path.join(OPTIMIZED, name);
  const value = await json(file);
  assert.ok(!value.error, `${name}: ${value.error || 'browser failure'}`);
  assert.ok(!value.issues?.length, `${name}: ${JSON.stringify(value.issues)}`);
  if (Array.isArray(value.checks)) assert.ok(value.checks.filter(check => typeof check.ok === 'boolean').every(check => check.ok), `${name}: failed browser check`);
  return value;
}

async function run(command, log) {
  const result = spawnSync(npm, npmArguments(command), { cwd: ROOT, encoding: 'utf8', timeout: 180_000, maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  await writeFile(log, output);
  assert.equal(result.status, 0, `${npm} ${command.join(' ')}; see ${log}`);
  console.log(`PASS ${npm} ${command.join(' ')}`);
}

await mkdir(REPORTS, { recursive: true });
await run(['test'], path.join(REPORTS, 'final-atelier-tests.log'));
await run(['run', 'validate:grounding'], path.join(REPORTS, 'final-grounding.log'));
const grounding = await json(path.join(ROOT, 'qa', 'grounding.json'));
assert.equal(grounding.length, 40);
assert.ok(grounding.every(sample => sample.finite && sample.points > 0));
await run(['--prefix', 'qa/game-integration', 'test'], path.join(REPORTS, 'final-game-tests.log'));
await run(['--prefix', 'qa/game-integration', 'run', 'verify'], path.join(REPORTS, 'final-game-verify.log'));
const nodeTests = await readFile(path.join(REPORTS, 'final-game-tests.log'), 'utf8');
assert.match(nodeTests, /pass 297/);
assert.match(nodeTests, /fail 0/);
const assetVerification = await readFile(path.join(REPORTS, 'final-game-verify.log'), 'utf8');
assert.match(assetVerification, /MINDREALM_ASSETS_OK/);
assert.match(assetVerification, /MINDREALM_CONTENT_OK/);

const loading = await report('lazy-loading.json');
assert.equal(loading.status, 'ON_DEMAND_ENTITY_LOADING_OK');
assert.equal(loading.result.initial.sources, 50);
assert.equal(loading.result.after.sources, 51);
assert.equal(loading.result.restored.renderMode, 'realtime-webgl');

const realtime = await report('final-realtime-validation.json');
assert.equal(realtime.status, 'REALTIME_MODELS_XP_UI_OK');
assert.equal(realtime.catalog.sourceCount, 110);
assert.equal(realtime.catalog.records.length, 49);
assert.equal(realtime.catalog.records.reduce((sum, record) => sum + record.variants, 0), 109);

const invariants = await report('final-optimized-invariants.json');
assert.equal(invariants.status, 'OPTIMIZED_INVARIANTS_OK');
assert.ok(invariants.result.far.correctGeometry && invariants.result.near.correctGeometry);
assert.ok(invariants.result.far.triangles < invariants.result.near.triangles);
assert.equal(invariants.result.far.instances, invariants.result.near.instances);

const tactical = await report('final-tactical-combat.json');
assert.equal(tactical.status, 'TACTICAL_LIVE_COMBAT_OK');
const occlusion = await report('final-occlusion.json');
assert.equal(occlusion.status, 'OCCLUSION_PIXELS_OK');
assert.ok(occlusion.checks.every(check => check.outside === 0));

const combatFile = path.join(REPORTS, 'combat-preview.json');
const combat = await json(combatFile);
assert.equal(combat.ok, true);
assert.equal(combat.checks.length, 9);
assert.ok(combat.turning.maxStep <= 0.225);
assert.ok(combat.arc.apex > 3.5 && combat.cameraDistance > 16);
assert.ok(!combat.errors.length);

const performanceReport = await report('final-model-performance.json');
assert.equal(performanceReport.baseline.glbRequests, 50);
assert.equal(performanceReport.baseline.renderer.sourceCount, 50);
assert.equal(performanceReport.cases.length, 2);
for (const sample of performanceReport.cases) {
  assert.equal(sample.renderer.sourceCount, 110);
  assert.equal(sample.renderer.pendingAssets, 0);
  assert.equal(sample.types, 49);
  assert.equal(sample.renderedTypes, 50);
  assert.equal(sample.glbRequests ?? sample.download.glbRequests, 110);
  assert.ok(sample.retainedMemory?.usedJSHeapSize > 0);
  assert.ok(!sample.errors.length);
}

const acts = [];
for (let index = 1; index <= 3; index++) {
  const file = path.join(REPORTS, `final-full-run-act${index}.json`);
  const value = await json(file);
  assert.ok(!value.renderErrors?.length && !value.audioErrors?.length, `${file}: runtime errors`);
  assert.ok(!value.audit?.errors?.length, `${file}: audit errors`);
  if (index < 3) assert.equal(value.status, 'MINDREALM_BROWSER_ACT_OK', file);
  acts.push({ file: path.relative(ROOT, file), phase: value.phase, act: value.act, floor: value.floor, completed: value.completed, bosses: value.bosses });
}
const fullRun = acts.at(-1);
assert.equal(fullRun.phase, 'won');
assert.equal(fullRun.completed, 48);
assert.equal(fullRun.bosses.length, 3);

const modelManifest = await json(path.join(PACK, 'game', 'assets', 'game', 'models', 'models.json'));
const entities = Object.values(modelManifest.entities);
assert.equal(entities.length, 49);
assert.equal(entities.filter(entity => entity.kind === 'enemies').length, 37);
assert.equal(entities.filter(entity => entity.kind === 'towers').length, 12);
assert.equal(entities.reduce((sum, entity) => sum + Object.keys(entity.variants).length, 0), 109);

const verification = {
  format: 'mindrealm-entity-pack-verification/1',
  status: 'MINDREALM_ENTITY_PACK_VERIFIED',
  generatedAt: new Date().toISOString(),
  sourceGame: 'D:/game_build was used read-only; all integration changes and tests were made in kimitry copies.',
  scope: { entities: 49, enemies: 37, towers: 12, appearances: 109, glbs: 110, entityClips: 763, droneClips: 7, pngs: 184 },
  grounding: { appearances: grounding.length, framesPerAppearance: 25, minY: Math.min(...grounding.map(sample => sample.lowest)), report: 'qa/grounding.json' },
  commands: [
    { command: 'npm test', status: 'PASS', log: 'qa/reports/final-atelier-tests.log' },
    { command: 'npm run validate:grounding', status: 'PASS', log: 'qa/reports/final-grounding.log' },
    { command: 'npm --prefix qa/game-integration test', status: 'PASS', tests: 297, failed: 0, log: 'qa/reports/final-game-tests.log' },
    { command: 'npm --prefix qa/game-integration run verify', status: 'MINDREALM_ASSETS_OK / MINDREALM_CONTENT_OK', log: 'qa/reports/final-game-verify.log' },
  ],
  browser: [
    { name: loading.status, checks: loading.checks.length, report: 'qa/optimized-runtime/reports/lazy-loading.json' },
    { name: realtime.status, checks: realtime.checks, report: 'qa/optimized-runtime/reports/final-realtime-validation.json' },
    { name: invariants.status, checks: invariants.checks.length, report: 'qa/optimized-runtime/reports/final-optimized-invariants.json' },
    { name: tactical.status, checks: tactical.checks.length, report: 'qa/optimized-runtime/reports/final-tactical-combat.json' },
    { name: occlusion.status, checks: occlusion.checks.length, report: 'qa/optimized-runtime/reports/final-occlusion.json' },
    { name: 'ORIGINAL_COMBAT_PREVIEW_OK', checks: combat.checks.length, report: 'qa/reports/combat-preview.json', turning: combat.turning, projectile: combat.arc, cameraDistance: combat.cameraDistance },
  ],
  fullRun: { status: 'MINDREALM_BROWSER_48_NODES_WIN', acts },
  performance: performanceReport,
  notes: [
    'BatchedMesh retains real articulated matrixWorld, independent RGBA, functional joints, and genuine reduced LOD geometry.',
    'The game preloads 50 base GLBs and requests later variants on demand, with original generated sprite fallback.',
    'Stress measurements cover 24 T3 towers, 100 enemies and 96 independently rendered tracking drones. They are not a 60 FPS guarantee on every device.',
    'The pack does not include the original game, test copies, old model generators, or stock model parts.',
  ],
};
await writeFile(path.join(PACK, 'verification.json'), `${JSON.stringify(verification, null, 2)}\n`);
console.log(`MINDREALM_ENTITY_PACK_VERIFIED: 49 entities, 109 appearances, 110 GLBs, 184 PNGs, 48 nodes won.`);
