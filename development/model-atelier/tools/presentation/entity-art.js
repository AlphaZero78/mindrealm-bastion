import * as THREE from '../../release/mindrealm-entity-pack/game/assets/third_party/three/three.bundle.js';
import { WholeEntityRenderer } from '../../release/mindrealm-entity-pack/game/web/view/whole-entity-runtime.js';

const TAU = Math.PI * 2;
const CAMERA_YAW = Math.PI / 4;
const ELEVATION = 55;
const GROUND_COS = Math.cos(ELEVATION * Math.PI / 180);
const DEATH_TIMES = [0.12, 0.38, 0.64, 0.9];
const MOVE_TIMES = [0, 0.25, 0.5, 0.75];
const ATTACK_TIMES = [0.12, 0.32, 0.62];
const STATUS = document.querySelector('#status');
const params = new URLSearchParams(location.search);
const selectedId = params.get('id');
const castEnabled = params.get('cast') === '1';
const airEnabled = params.get('air') === '1';
const nativeFetch = globalThis.fetch.bind(globalThis);

function mappedAssetUrl(pathname) {
  return `/release/mindrealm-entity-pack/game${pathname}`;
}

globalThis.fetch = async (input, options) => {
  const original = typeof input === 'string' ? input : input.url;
  const url = new URL(original, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith('/assets/game/')) return nativeFetch(input, options);
  if (url.pathname === '/assets/game/models/models.json') {
    const response = await nativeFetch(mappedAssetUrl(url.pathname), options);
    if (!response.ok) throw new Error(`模型清单加载失败：${response.status}`);
    const manifest = await response.json();
    if (!manifest.entities[selectedId]) throw new Error(`模型清单缺少 ${selectedId}`);
    manifest.entities = { [selectedId]: manifest.entities[selectedId] };
    return new Response(JSON.stringify(manifest), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  const mapped = mappedAssetUrl(url.pathname);
  if (typeof input === 'string') return nativeFetch(mapped, options);
  return nativeFetch(new Request(mapped, input), options);
};

function canvas2d(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
  context.clearRect(0, 0, width, height);
  return { canvas, context };
}

function emptyUnion() {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, pixels: 0 };
}

function addToUnion(union, info) {
  if (!info.bounds) return;
  union.minX = Math.min(union.minX, info.bounds.minX);
  union.minY = Math.min(union.minY, info.bounds.minY);
  union.maxX = Math.max(union.maxX, info.bounds.maxX);
  union.maxY = Math.max(union.maxY, info.bounds.maxY);
  union.pixels += info.pixels;
}

function paddedBounds(union, cell, padding) {
  if (!Number.isFinite(union.minX) || union.pixels <= 0) throw new Error('渲染结果没有非零 alpha 像素');
  const minX = Math.max(0, union.minX - padding);
  const minY = Math.max(0, union.minY - padding);
  const maxX = Math.min(cell - 1, union.maxX + padding);
  const maxY = Math.min(cell - 1, union.maxY + padding);
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function hashPixels(data) {
  let hash = 2166136261;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function readRenderedCell(source, target, cell) {
  target.context.clearRect(0, 0, cell, cell);
  target.context.drawImage(source, 0, 0, cell, cell);
  const pixels = target.context.getImageData(0, 0, cell, cell).data;
  const union = emptyUnion();
  let touches = false;
  for (let y = 0; y < cell; y++) {
    for (let x = 0; x < cell; x++) {
      const index = (y * cell + x) * 4;
      if (pixels[index + 3] === 0) continue;
      union.minX = Math.min(union.minX, x);
      union.minY = Math.min(union.minY, y);
      union.maxX = Math.max(union.maxX, x);
      union.maxY = Math.max(union.maxY, y);
      union.pixels++;
      if (x === 0 || y === 0 || x === cell - 1 || y === cell - 1) touches = true;
    }
  }
  if (!union.pixels) throw new Error('GLB 渲染产生了空帧');
  return {
    bounds: { minX: union.minX, minY: union.minY, maxX: union.maxX, maxY: union.maxY },
    pixels: union.pixels,
    touches,
    hash: hashPixels(pixels),
  };
}

function configureLighting(renderer, span, focusY) {
  renderer.keyLight.position.set(-7, 10, 6);
  renderer.keyLight.target.position.set(0, Math.max(0.2, focusY), 0);
  Object.assign(renderer.keyLight.shadow.camera, {
    left: -span, right: span, top: span, bottom: -span, near: 0.5, far: Math.max(35, span * 8),
  });
  renderer.keyLight.shadow.camera.updateProjectionMatrix();
}

function beginFrame(renderer, camera, cell, icon, span) {
  renderer.begin({
    x: 0, z: 0, yaw: CAMERA_YAW, width: cell, height: cell,
    scale: camera.scale, focusY: camera.focusY,
  }, null, cell, cell);
  renderer.iconMode = icon;
  configureLighting(renderer, span, camera.focusY);
}

function renderPose(renderer, job, variant, camera, cell, pose, options = {}) {
  const icon = !!options.icon;
  const span = options.span || 8;
  beginFrame(renderer, camera, cell, icon, span);
  const key = options.key || `${variant}:${pose.action}`;
  renderer.add(job.id, {
    clock: 1000,
    action: 'idle',
    progress: 0,
    facing: CAMERA_YAW,
    hit: 0,
    shutdownProgress: options.deathTime,
    ...pose,
    key,
    variant,
    air: job.air,
  }, {
    x: 0, z: 0, h: icon ? 0 : (job.air ? 1.3 : 0), fp: [1, 1],
  }, { reducedMotion: false });
  if (!renderer.flush()) throw new Error(`渲染器拒绝输出 ${job.id}/${variant}`);
  renderer.renderer.getContext().finish();
  return renderer.canvas;
}

function modelSpan(renderer, type, variant, icon) {
  const bounds = renderer.boundsFor(type, variant);
  if (icon) return Math.max(bounds[0], bounds[2], bounds[1] * 1.05);
  const definition = renderer.catalog.entities[type];
  const enemy = definition.kind === 'enemies';
  const size = enemy
    ? (definition.role === 'boss' ? 4.5 : definition.role === 'elite' ? 2.95 : 2.2) / Math.max(bounds[0], bounds[2], 0.000001)
    : 1.18 / Math.max(0.000001, Math.min(bounds[0], bounds[2]));
  return Math.max(bounds[0], bounds[2], bounds[1]) * size;
}

function initialCamera(renderer, job, icon, cell) {
  const variants = Object.keys(renderer.catalog.entities[job.id].variants);
  const spans = variants.map(variant => modelSpan(renderer, job.id, variant, icon));
  const span = Math.max(...spans, 0.1);
  const air = !icon && job.air ? 1.3 * 0.95 : 0;
  const padded = span * (icon ? 1.42 : 1.62) + air;
  const scale = cell / padded;
  const groundY = air + (icon ? 0 : 0.025);
  const baseline = icon ? 0.62 : 0.72;
  const focusY = groundY + (baseline - 0.5) * cell / (GROUND_COS * scale);
  return { scale, focusY, span: padded };
}

function fitCamera(camera, metrics, cell, icon) {
  const union = metrics.union;
  const width = union.maxX - union.minX + 1;
  const height = union.maxY - union.minY + 1;
  const center = cell / 2;
  const effectiveWidth = 2 * Math.max(center - union.minX, union.maxX - center) + 1;
  const target = icon ? cell - 28 : cell - 8;
  const occupied = Math.max(effectiveWidth, height);
  let zoom = 1;
  if (metrics.clipped || occupied > target) zoom = Math.min(target / Math.max(occupied, 1), metrics.clipped ? 0.9 : 1);
  else if (occupied < cell * 0.55) zoom = Math.min(1.24, target * 0.86 / Math.max(occupied, 1));
  if (Math.abs(zoom - 1) < 0.015) return null;
  zoom = Math.max(0.4, Math.min(1.3, zoom));
  const scale = camera.scale * zoom;
  const centerY = (union.minY + union.maxY) / 2;
  const projectedCenter = center + (centerY - center) * zoom;
  const focusY = camera.focusY + (center - projectedCenter) / (GROUND_COS * scale);
  return { ...camera, scale, focusY };
}

function poseForRow(row, job) {
  if (row >= 1 && row <= 4) return { action: job.air ? 'hover' : 'move', progress: MOVE_TIMES[row - 1] };
  if (row >= 5 && row <= 7) return { action: 'attack', progress: ATTACK_TIMES[row - 5] };
  if (row === 8) {
    return job.cast
      ? { action: 'cast', stage: 'windup', progress: 0.72 }
      : { action: 'attack', progress: 0.08 };
  }
  return job.cast
    ? { action: 'release', stage: 'release', progress: 0.36 }
    : { action: 'attack', progress: 0.54, hit: 0.85 };
}

async function renderPortraits(renderer, job) {
  const variants = Object.keys(renderer.catalog.entities[job.id].variants);
  const cell = 256;
  let camera = initialCamera(renderer, job, true, cell);
  let final = null;
  for (let pass = 0; pass < 4; pass++) {
    const atlas = canvas2d(cell, cell * variants.length);
    const scratch = canvas2d(cell, cell);
    const union = emptyUnion();
    let clipped = false;
    const hashes = [];
    for (let variantIndex = 0; variantIndex < variants.length; variantIndex++) {
      const variant = variants[variantIndex];
      STATUS.textContent = `${job.id}: portrait ${variant}, pass ${pass + 1}`;
      const source = renderPose(renderer, job, variant, camera, cell, {
        action: 'idle', progress: 0, facing: CAMERA_YAW,
      }, { icon: true, span: camera.span, key: `icon:${variant}` });
      const info = readRenderedCell(source, scratch, cell);
      clipped ||= info.touches;
      addToUnion(union, info);
      hashes.push(info.hash);
      atlas.context.drawImage(scratch.canvas, 0, variantIndex * cell);
    }
    const metrics = { union, clipped };
    final = { atlas, metrics, hashes, pass: pass + 1, camera };
    const next = fitCamera(camera, metrics, cell, true);
    if (!next) break;
    camera = next;
  }
  if (final.metrics.clipped) throw new Error(`${job.id} 肖像多次取景后仍然触边`);
  return {
    ...final,
    bounds: paddedBounds(final.metrics.union, cell, 6),
  };
}

async function renderSprites(renderer, job) {
  const variants = Object.keys(renderer.catalog.entities[job.id].variants);
  const cell = 80;
  const death = job.kind === 'enemies';
  let camera = initialCamera(renderer, job, false, cell);
  let final = null;
  for (let pass = 0; pass < 5; pass++) {
    const staticAtlas = canvas2d(640, cell * variants.length);
    const animationAtlas = canvas2d(640, 800 * variants.length);
    const deathAtlas = death ? canvas2d(640, 320 * variants.length) : null;
    const scratch = canvas2d(cell, cell);
    const union = emptyUnion();
    const iconUnion = emptyUnion();
    let clipped = false;
    let frameCount = 0;
    const deathHashes = [];
    const variantHashes = [];
    for (let variantIndex = 0; variantIndex < variants.length; variantIndex++) {
      const variant = variants[variantIndex];
      const staticHashes = [];
      for (let direction = 0; direction < 8; direction++) {
        const facing = CAMERA_YAW + direction * TAU / 8;
        const key = `sprite:${variant}:${direction}`;
        STATUS.textContent = `${job.id}: ${variant}, direction ${direction + 1}/8, pass ${pass + 1}`;
        const idleSource = renderPose(renderer, job, variant, camera, cell, {
          action: 'idle', progress: 0, facing,
        }, { span: camera.span, key });
        const idleInfo = readRenderedCell(idleSource, scratch, cell);
        clipped ||= idleInfo.touches;
        addToUnion(union, idleInfo);
        addToUnion(iconUnion, idleInfo);
        staticHashes.push(idleInfo.hash);
        staticAtlas.context.drawImage(scratch.canvas, direction * cell, variantIndex * cell);
        animationAtlas.context.drawImage(scratch.canvas, direction * cell, variantIndex * 800);
        frameCount++;
        for (let row = 1; row < 10; row++) {
          const pose = poseForRow(row, job);
          const source = renderPose(renderer, job, variant, camera, cell, { ...pose, facing }, { span: camera.span, key });
          const info = readRenderedCell(source, scratch, cell);
          clipped ||= info.touches;
          addToUnion(union, info);
          animationAtlas.context.drawImage(scratch.canvas, direction * cell, (variantIndex * 10 + row) * cell);
          frameCount++;
        }
        if (death) {
          const rowHashes = [];
          for (let deathRow = 0; deathRow < 4; deathRow++) {
            const progress = DEATH_TIMES[deathRow];
            const source = renderPose(renderer, job, variant, camera, cell, {
              action: 'death', progress, facing,
            }, { span: camera.span, key: `${key}:death`, deathTime: progress });
            const info = readRenderedCell(source, scratch, cell);
            clipped ||= info.touches;
            addToUnion(union, info);
            rowHashes.push(info.hash);
            deathAtlas.context.drawImage(scratch.canvas, direction * cell, (variantIndex * 4 + deathRow) * cell);
            frameCount++;
          }
          deathHashes.push({ variant, direction, hashes: rowHashes, unique: new Set(rowHashes).size });
        }
      }
      variantHashes.push({ variant, hashes: staticHashes, uniqueDirections: new Set(staticHashes).size });
    }
    const metrics = { union, iconUnion, clipped };
    final = {
      staticAtlas, animationAtlas, deathAtlas, metrics, deathHashes, variantHashes,
      frameCount, pass: pass + 1, camera,
    };
    const next = fitCamera(camera, metrics, cell, false);
    if (!next) break;
    camera = next;
  }
  if (final.metrics.clipped) throw new Error(`${job.id} 精灵多次取景后仍然触边`);
  const groundY = (job.air ? 1.3 * 0.95 : 0) + 0.025;
  const baseline = (40 + (final.camera.focusY - groundY) * GROUND_COS * final.camera.scale) / 80;
  const bounds = paddedBounds(unionOrThrow(final.metrics.union), 80, 2);
  const iconBounds = paddedBounds(unionOrThrow(final.metrics.iconUnion), 80, 2);
  return {
    ...final,
    art: {
      cell: 80,
      directions: 8,
      variants,
      baseline: Number(baseline.toFixed(6)),
      bearing: 0,
      elevation: ELEVATION,
      bounds,
      iconBounds,
      minVisibleSpan: Math.max(16, Math.round(Math.max(iconBounds.width, iconBounds.height))),
    },
  };
}

function unionOrThrow(union) {
  if (!Number.isFinite(union.minX) || !union.pixels) throw new Error('无法计算渲染边界');
  return union;
}

async function exportPng(path, canvas) {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(value => value ? resolve(value) : reject(new Error(`PNG 编码失败：${path}`)), 'image/png');
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  await globalThis.__entityArtWrite(path, btoa(binary));
  return { path, bytes: bytes.length, width: canvas.width, height: canvas.height };
}

async function main() {
  if (!selectedId) throw new Error('缺少 ?id=<entity>');
  if (typeof globalThis.__entityArtWrite !== 'function') throw new Error('缺少 Node 写入桥接');
  const renderer = new WholeEntityRenderer({
    canvas: document.querySelector('#renderer'),
    onError: message => { STATUS.textContent = message; },
  });
  try {
    STATUS.textContent = `${selectedId}: loading real GLB and seven clips`;
    const ready = await renderer.readyPromise;
    if (!ready || !renderer.ready) throw new Error(`GLB 加载失败：${renderer.errors.join('; ')}`);
    const definition = renderer.catalog.entities[selectedId];
    const job = { id: selectedId, kind: definition.kind, cast: castEnabled, air: airEnabled };
    const variants = Object.keys(definition.variants);
    if (definition.kind !== job.kind || !variants.length) throw new Error(`${selectedId} 清单定义无效`);
    const portraits = await renderPortraits(renderer, job);
    const sprites = await renderSprites(renderer, job);
    const files = [];
    files.push(await exportPng(`assets/game/portraits/${selectedId}.png`, portraits.atlas.canvas));
    files.push(await exportPng(`assets/game/sprites/${job.kind}/${selectedId}.png`, sprites.staticAtlas.canvas));
    files.push(await exportPng(`assets/game/sprites/animations/${job.kind}/${selectedId}.png`, sprites.animationAtlas.canvas));
    if (sprites.deathAtlas) files.push(await exportPng(`assets/game/sprites/death/enemies/${selectedId}.png`, sprites.deathAtlas.canvas));
    const deathUnique = sprites.deathHashes.map(item => item.unique);
    if (deathUnique.some(count => count < 4)) throw new Error(`${selectedId} 死亡四帧存在重复姿态：${deathUnique.join(',')}`);
    const result = {
      id: selectedId,
      kind: job.kind,
      variants,
      cast: job.cast,
      air: job.air,
      portrait: { cell: 256, rows: variants.length, bounds: portraits.bounds, path: `/assets/game/portraits/${selectedId}.png` },
      art: sprites.art,
      files,
      stats: {
        framesPerSpritePass: sprites.frameCount,
        portraitPasses: portraits.pass,
        spritePasses: sprites.pass,
        portraitPixels: portraits.metrics.union.pixels,
        spritePixels: sprites.metrics.union.pixels,
        directionVariants: sprites.variantHashes.map(item => ({ variant: item.variant, uniqueDirections: item.uniqueDirections })),
        deathTimes: DEATH_TIMES,
        deathUniqueMin: deathUnique.length ? Math.min(...deathUnique) : null,
        renderer: renderer.snapshot(),
      },
    };
    globalThis.__entityArtResult = result;
    STATUS.textContent = `${selectedId}: complete (${files.length} PNG files)`;
  } finally {
    renderer.destroy();
  }
}

main().catch(error => {
  console.error(error);
  globalThis.__entityArtError = { message: error.message, stack: error.stack };
  STATUS.textContent = `${selectedId || 'entity'}: ${error.message}`;
});
