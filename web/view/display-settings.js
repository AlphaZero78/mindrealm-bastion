/** Pure display settings shared by storage, the settings UI and the renderer. */
export const RESOLUTION_PRESETS = Object.freeze([
  { id: 'auto', label: '自动', width: null, height: null },
  ...[[960, 540], [1280, 720], [1600, 900], [1920, 1080], [2560, 1440]]
    .map(([width, height]) => ({ id: `${width}x${height}`, label: `${width} × ${height}`, width, height })),
].map(Object.freeze));

const presets = new Map(RESOLUTION_PRESETS.map(preset => [preset.id, preset]));
const positive = (value, fallback = 1) => Number.isFinite(value) && value > 0 ? value : fallback;
const dimension = (value, fallback = 1) => Math.max(1, Math.round(positive(value, fallback)));

export function normalizeResolution(value) {
  return typeof value === 'string' && presets.has(value) ? value : 'auto';
}

/**
 * Camera geometry and pointer picking remain in CSS pixels. A fixed preset is
 * the full-window rendering budget; the battlefield gets its proportional
 * share, using one scale on both axes even when window/preset aspects differ.
 */
export function resolveRenderResolution({ cssWidth, cssHeight, windowWidth, windowHeight, dpr = 1, resolution = 'auto' } = {}) {
  const width = dimension(cssWidth), height = dimension(cssHeight);
  const selected = normalizeResolution(resolution), preset = presets.get(selected);
  let ratio;
  if (selected === 'auto') {
    // Preserve the existing automatic mode: limit additional DPR sampling to
    // 1.5x / roughly 3MP, but never downsample a larger CSS battlefield itself.
    ratio = Math.max(1, Math.min(1.5, positive(dpr), Math.sqrt(3000000 / (width * height))));
  } else {
    const fullWidth = dimension(windowWidth, width), fullHeight = dimension(windowHeight, height);
    ratio = Math.min(preset.width / fullWidth, preset.height / fullHeight);
  }
  return { width, height, pixelWidth: Math.max(1, Math.round(width * ratio)),
    pixelHeight: Math.max(1, Math.round(height * ratio)), ratio, resolution: selected };
}
