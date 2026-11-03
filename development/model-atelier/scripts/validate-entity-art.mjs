import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const rootFlag = argv.indexOf('--root');
const staging = path.join(ROOT, 'qa', 'entity-art');
const packed = path.join(ROOT, 'release', 'mindrealm-entity-pack', 'game');
const OUTPUT = rootFlag >= 0 ? path.resolve(ROOT, argv[rootFlag + 1] || '') : staging;
if (![staging, packed].includes(OUTPUT)) throw new Error('--root 仅支持 qa/entity-art 或 release/mindrealm-entity-pack/game');
const MANIFEST = rootFlag >= 0 ? path.join(OUTPUT, 'assets/game/models/models.json') : path.join(packed, 'assets/game/models/models.json');
const failures = [];
let checkedPng = 0;
let checkedCells = 0;
let checkedPixels = 0;

function check(condition, message) {
  if (!condition) failures.push(message);
}

function args(argv) {
  const options = { ids: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ids') options.ids.push(...argv[++i].split(',').map(value => value.trim()).filter(Boolean));
    else if (argv[i] === '--all') options.all = true;
    else if (argv[i] === '--root') i++;
    else throw new Error(`未知参数：${argv[i]}`);
  }
  return options;
}

function emptyUnion() {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, pixels: 0 };
}

function addUnion(union, info) {
  union.minX = Math.min(union.minX, info.minX);
  union.minY = Math.min(union.minY, info.minY);
  union.maxX = Math.max(union.maxX, info.maxX);
  union.maxY = Math.max(union.maxY, info.maxY);
  union.pixels += info.pixels;
}

function mergeUnion(a, b) {
  if (!b.pixels) return;
  a.minX = Math.min(a.minX, b.minX);
  a.minY = Math.min(a.minY, b.minY);
  a.maxX = Math.max(a.maxX, b.maxX);
  a.maxY = Math.max(a.maxY, b.maxY);
  a.pixels += b.pixels;
}

function paddedBounds(union, cell, padding) {
  const x = Math.max(0, union.minX - padding);
  const y = Math.max(0, union.minY - padding);
  const right = Math.min(cell - 1, union.maxX + padding);
  const bottom = Math.min(cell - 1, union.maxY + padding);
  return { x, y, width: right - x + 1, height: bottom - y + 1 };
}

function sameBounds(actual, expected) {
  return actual && ['x', 'y', 'width', 'height'].every(key => actual[key] === expected[key]);
}

function hash(data) {
  let value = 2166136261;
  for (let i = 0; i < data.length; i++) {
    value ^= data[i];
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(16).padStart(8, '0');
}

function cellInfo(png, column, row, cell, keepPixels = false) {
  const x0 = column * cell;
  const y0 = row * cell;
  const data = keepPixels ? Buffer.alloc(cell * cell * 4) : null;
  const union = emptyUnion();
  let touches = false;
  let transparent = 0;
  for (let y = 0; y < cell; y++) {
    for (let x = 0; x < cell; x++) {
      const source = ((y0 + y) * png.width + x0 + x) * 4;
      const alpha = png.data[source + 3];
      if (keepPixels) png.data.copy(data, (y * cell + x) * 4, source, source + 4);
      if (!alpha) {
        transparent++;
        continue;
      }
      union.minX = Math.min(union.minX, x);
      union.minY = Math.min(union.minY, y);
      union.maxX = Math.max(union.maxX, x);
      union.maxY = Math.max(union.maxY, y);
      union.pixels++;
      if (x === 0 || y === 0 || x === cell - 1 || y === cell - 1) touches = true;
    }
  }
  checkedCells++;
  checkedPixels += cell * cell;
  return { ...union, touches, transparent, data, hash: data ? hash(data) : null };
}

function hashCell(png, column, row, cell) {
  const copy = canvasCell(png, column, row, cell);
  return hash(copy);
}

function canvasCell(png, column, row, cell) {
  const data = Buffer.alloc(cell * cell * 4);
  for (let y = 0; y < cell; y++) {
    const source = ((row * cell + y) * png.width + column * cell) * 4;
    png.data.copy(data, y * cell * 4, source, source + cell * 4);
  }
  return data;
}

function differentPixels(a, b) {
  let count = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) count++;
  }
  return count;
}

function loadPng(relative, width, height, label) {
  const target = path.join(OUTPUT, relative);
  if (!existsSync(target)) {
    check(false, `${label}: 缺少 ${relative}`);
    return null;
  }
  let png;
  try {
    png = PNG.sync.read(readFileSync(target));
  } catch (error) {
    check(false, `${label}: PNG 解码失败 ${error.message}`);
    return null;
  }
  checkedPng++;
  check(png.width === width && png.height === height, `${label}: 尺寸 ${png.width}x${png.height}，期望 ${width}x${height}`);
  if (png.width !== width || png.height !== height) return null;
  return png;
}

async function listPngs(directory) {
  const result = [];
  async function visit(current, prefix = '') {
    if (!existsSync(current)) return;
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`;
      if (entry.isDirectory()) await visit(path.join(current, entry.name), `${relative}/`);
      else if (entry.isFile() && entry.name.endsWith('.png')) result.push(relative);
    }
  }
  await visit(directory);
  return result.sort();
}

function validateCell(info, label, minimumPixels) {
  check(info.pixels >= minimumPixels, `${label}: 非零 alpha 像素 ${info.pixels}，少于 ${minimumPixels}`);
  check(info.transparent > 0, `${label}: 单元没有透明背景`);
  check(!info.touches, `${label}: 非零 alpha 触及单元边缘，可能裁切`);
}

async function main() {
  const options = args(process.argv.slice(2));
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const ids = options.ids.length ? options.ids : Object.keys(manifest.entities);
  for (const id of ids) check(!!manifest.entities[id], `models.json 缺少 ${id}`);
  const portraitModule = await import(pathToFileURL(path.join(OUTPUT, 'web', 'view', 'model-portraits.js')).href);
  const portraits = portraitModule.MODEL_PORTRAITS;
  const bounds = JSON.parse(await readFile(path.join(OUTPUT, rootFlag >= 0 ? 'assets/game/models/entity-art-bounds.json' : 'web/view/entity-art-bounds.json'), 'utf8'));
  check(!!portraits && typeof portraits === 'object', 'MODEL_PORTRAITS 未导出对象');
  check(JSON.stringify(Object.keys(portraits).sort()) === JSON.stringify([...ids].sort()), '肖像配置覆盖与请求实体不一致');
  check(JSON.stringify(Object.keys(bounds).sort()) === JSON.stringify([...ids].sort()), 'bounds 配置覆盖与请求实体不一致');
  const expectedPng = [];
  for (const id of ids) {
    const definition = manifest.entities[id];
    if (!definition) continue;
    const variants = Object.keys(definition.variants);
    const kind = definition.kind;
    const label = id;
    expectedPng.push(`assets/game/portraits/${id}.png`, `assets/game/sprites/${kind}/${id}.png`, `assets/game/sprites/animations/${kind}/${id}.png`);
    if (kind === 'enemies') expectedPng.push(`assets/game/sprites/death/enemies/${id}.png`);
    const portrait = portraits[id];
    const art = bounds[id];
    check(portrait?.cell === 256 && portrait?.rows === variants.length, `${label}: 肖像 cell/rows 契约错误`);
    check(portrait?.path === `/assets/game/portraits/${id}.png`, `${label}: 肖像 path 错误`);
    check(art?.cell === 80 && art?.directions === 8, `${label}: sprite cell/directions 契约错误`);
    check(JSON.stringify(art?.variants) === JSON.stringify(variants), `${label}: bounds variants 顺序错误`);
    check(Number.isFinite(art?.baseline) && art.baseline > 0.2 && art.baseline < 0.98, `${label}: baseline 异常 ${art?.baseline}`);
    check(art?.bearing === 0 && art?.elevation === 55, `${label}: bearing/elevation 契约错误`);
    if (!portrait || !art) continue;

    const portraitPng = loadPng(`assets/game/portraits/${id}.png`, 256, 256 * variants.length, `${label}/portrait`);
    if (portraitPng) {
      const union = emptyUnion();
      const variantHashes = [];
      for (let row = 0; row < variants.length; row++) {
        const info = cellInfo(portraitPng, 0, row, 256, true);
        validateCell(info, `${label}/portrait/${variants[row]}`, 64);
        addUnion(union, info);
        variantHashes.push(info.hash);
      }
      check(new Set(variantHashes).size === variants.length, `${label}: 肖像变体存在完全相同像素`);
      check(sameBounds(portrait.bounds, paddedBounds(union, 256, 6)), `${label}: 肖像共享 bounds 不是全变体非零 alpha 联合加对称留边`);
    }

    const staticPng = loadPng(`assets/game/sprites/${kind}/${id}.png`, 640, 80 * variants.length, `${label}/static`);
    const staticUnion = emptyUnion();
    const staticHashes = [];
    if (staticPng) {
      for (let variant = 0; variant < variants.length; variant++) {
        const directionHashes = [];
        for (let direction = 0; direction < 8; direction++) {
          const info = cellInfo(staticPng, direction, variant, 80);
          validateCell(info, `${label}/static/${variants[rowOrZero(variant)]}/${direction}`, 16);
          addUnion(staticUnion, info);
          directionHashes.push(hashCell(staticPng, direction, variant, 80));
        }
        staticHashes.push(directionHashes);
        check(new Set(directionHashes).size >= 2, `${label}/${variants[variant]}: 八方向静态图完全相同`);
      }
      check(new Set(staticHashes.map(row => row.join(','))).size === variants.length, `${label}: 静态变体存在完全相同像素`);
      check(sameBounds(art.iconBounds, paddedBounds(staticUnion, 80, 2)), `${label}: iconBounds 与全方向全变体静态 alpha 联合不符`);
    }

    const animationPng = loadPng(`assets/game/sprites/animations/${kind}/${id}.png`, 640, 800 * variants.length, `${label}/animation`);
    const animationUnion = emptyUnion();
    const animationVariantSignatures = [];
    if (animationPng) {
      for (let variant = 0; variant < variants.length; variant++) {
        const variantSignature = [];
        for (let direction = 0; direction < 8; direction++) {
          const rows = [];
          for (let row = 0; row < 10; row++) {
            const atlasRow = variant * 10 + row;
            const info = cellInfo(animationPng, direction, atlasRow, 80);
            validateCell(info, `${label}/animation/${variants[variant]}/${direction}/${row}`, 16);
            addUnion(animationUnion, info);
            rows.push(hashCell(animationPng, direction, atlasRow, 80));
          }
          variantSignature.push(...rows);
          if (staticHashes.length) check(rows[0] === staticHashes[variant][direction], `${label}/${variants[variant]}/${direction}: 静态 idle 与动作第 0 行不一致`);
          check(new Set(rows.slice(1, 5)).size >= 2, `${label}/${variants[variant]}/${direction}: move 四帧缺少有效变化`);
          check(new Set(rows.slice(5, 8)).size >= 2, `${label}/${variants[variant]}/${direction}: attack 三帧缺少有效变化`);
          check(new Set(rows).size >= 6, `${label}/${variants[variant]}/${direction}: 十行动作缺乏有效变化`);
        }
        animationVariantSignatures.push(variantSignature.join(','));
      }
      check(new Set(animationVariantSignatures).size === variants.length, `${label}: 动作变体存在完全相同像素`);
    }

    let deathUnion = null;
    if (kind === 'enemies') {
      const deathPng = loadPng(`assets/game/sprites/death/enemies/${id}.png`, 640, 320 * variants.length, `${label}/death`);
      deathUnion = emptyUnion();
      const deathVariantSignatures = [];
      if (deathPng) {
        for (let variant = 0; variant < variants.length; variant++) {
          const variantSignature = [];
          for (let direction = 0; direction < 8; direction++) {
            const frames = [];
            for (let deathRow = 0; deathRow < 4; deathRow++) {
              const info = cellInfo(deathPng, direction, variant * 4 + deathRow, 80, true);
              validateCell(info, `${label}/death/${variants[variant]}/${direction}/${deathRow}`, 12);
              addUnion(deathUnion, info);
              frames.push(info);
              variantSignature.push(info.hash);
            }
            check(new Set(frames.map(frame => frame.hash)).size === 4, `${label}/${variants[variant]}/${direction}: shutdown 四时刻存在完全相同死亡帧`);
            for (let frame = 1; frame < 4; frame++) {
              check(differentPixels(frames[frame - 1].data, frames[frame].data) > 16, `${label}/${variants[variant]}/${direction}: 死亡第 ${frame - 1}/${frame} 帧缺少真实姿态变化`);
            }
          }
          deathVariantSignatures.push(variantSignature.join(','));
        }
        check(new Set(deathVariantSignatures).size === variants.length, `${label}: 死亡变体存在完全相同像素`);
      }
    }
    const totalUnion = emptyUnion();
    mergeUnion(totalUnion, staticUnion);
    mergeUnion(totalUnion, animationUnion);
    if (deathUnion) mergeUnion(totalUnion, deathUnion);
    if (totalUnion.pixels) {
      const expectedBounds = paddedBounds(totalUnion, 80, 2);
      check(sameBounds(art.bounds, expectedBounds), `${label}: bounds 不是静态/动作/死亡全姿态 alpha 联合`);
      check(art.minVisibleSpan === Math.max(16, Math.round(Math.max(art.iconBounds.width, art.iconBounds.height))), `${label}: minVisibleSpan 与新的静态可见范围不符`);
    }
    console.log(`${id}: ${variants.length} variants checked`);
  }
  const actualPng = (await listPngs(path.join(OUTPUT, 'assets', 'game'))).map(file => `assets/game/${file}`);
  const expected = [...expectedPng].sort();
  check(JSON.stringify(actualPng) === JSON.stringify(expected), `PNG 覆盖不一致：实际 ${actualPng.length}，期望 ${expected.length}；缺少 ${expected.filter(file => !actualPng.includes(file)).join(', ') || '无'}；多出 ${actualPng.filter(file => !expected.includes(file)).join(', ') || '无'}`);
  console.log(`Checked ${ids.length} entities, ${checkedPng} PNG, ${checkedCells} cells, ${checkedPixels} pixels.`);
  if (failures.length) {
    console.error(`FAILED (${failures.length})`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Validated ${ids.length} entities: dimensions, alpha, shared bounds, variants, directions, animation rows, and sampled shutdown frames.`);
}

function rowOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
