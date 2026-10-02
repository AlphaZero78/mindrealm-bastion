import test from 'node:test';
import assert from 'node:assert/strict';
import { RESOLUTION_PRESETS, normalizeResolution, resolveRenderResolution } from '../../web/view/display-settings.js';
import { createSaveStore } from '../../web/core/save.js';
import { hashSeed } from '../../web/core/content.js';

class MemoryStorage {
  data = new Map(); calls = 0; failAt = Infinity;
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { if (++this.calls === this.failAt) throw Error('simulated quota'); this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}
function rawSettings(settings) {
  const payload = JSON.stringify(settings);
  return JSON.stringify({ version: 2, kind: 'settings', checksum: hashSeed(payload).toString(16), payload });
}
const customSettings = { master: .23, music: .12, effects: .41, ui: .35, uiScale: 1.25, tutorial: false, reducedMotion: true, quality: 'low' };

test('resolution catalog is immutable, finite and normalizes unknown selections to auto', () => {
  assert.deepEqual(RESOLUTION_PRESETS.map(p => p.id), ['auto', '960x540', '1280x720', '1600x900', '1920x1080', '2560x1440']);
  assert.ok(Object.isFrozen(RESOLUTION_PRESETS));
  for (const preset of RESOLUTION_PRESETS) {
    assert.ok(Object.isFrozen(preset));
    assert.equal(normalizeResolution(preset.id), preset.id);
    assert.ok(preset.label.length > 0);
    if (preset.id !== 'auto') assert.equal(preset.width / preset.height, 16 / 9);
  }
  for (const invalid of [undefined, null, '', '4k', '1920×1080', 'AUTO', -1, NaN, {}, ['1280x720']])
    assert.equal(normalizeResolution(invalid), 'auto');
});

test('fixed presets change actual backing dimensions proportionally to the complete window', () => {
  const css = { cssWidth: 1200, cssHeight: 600, windowWidth: 1920, windowHeight: 1080 };
  for (const preset of RESOLUTION_PRESETS.slice(1)) {
    const expected = preset.width / 1920;
    const result = resolveRenderResolution({ ...css, resolution: preset.id, dpr: 3 });
    assert.equal(result.width, 1200); assert.equal(result.height, 600);
    assert.equal(result.ratio, expected);
    assert.equal(result.pixelWidth, Math.round(1200 * expected));
    assert.equal(result.pixelHeight, Math.round(600 * expected));
    assert.deepEqual(result, resolveRenderResolution({ ...css, resolution: preset.id, dpr: 1 }), 'Fixed presets are not multiplied by DPR a second time');
  }
  assert.equal(resolveRenderResolution({ ...css, resolution: '960x540' }).pixelWidth, 600);
  assert.equal(resolveRenderResolution({ ...css, resolution: '2560x1440' }).pixelWidth, 1600);
});

test('nonmatching and portrait window aspects use one scale and retain battlefield picking coordinates', () => {
  for (const window of [[1280, 1024], [1000, 1600], [2560, 1080], [960, 540]]) {
    const [windowWidth, windowHeight] = window;
    const cssWidth = Math.round(windowWidth * .64), cssHeight = Math.round(windowHeight * .7);
    const result = resolveRenderResolution({ cssWidth, cssHeight, windowWidth, windowHeight, resolution: '1920x1080' });
    const scale = Math.min(1920 / windowWidth, 1080 / windowHeight);
    assert.equal(result.ratio, scale);
    assert.equal(result.width, cssWidth); assert.equal(result.height, cssHeight);
    assert.ok(Math.abs(result.pixelWidth - cssWidth * scale) <= .5);
    assert.ok(Math.abs(result.pixelHeight - cssHeight * scale) <= .5);
    assert.ok(windowWidth * scale <= 1920 && windowHeight * scale <= 1080);
  }
});

test('auto preserves CSS clarity while capping additional DPR work and handles tiny or invalid dimensions', () => {
  for (const [width, height] of [[960, 540], [1116, 427], [1366, 768], [1920, 1080], [3840, 2160]]) {
    for (const dpr of [1, 1.25, 1.5, 2, 3]) {
      const result = resolveRenderResolution({ cssWidth: width, cssHeight: height, dpr });
      const expected = Math.max(1, Math.min(1.5, dpr, Math.sqrt(3000000 / (width * height))));
      assert.equal(result.ratio, expected);
      assert.equal(result.pixelWidth, Math.round(width * expected));
      assert.equal(result.pixelHeight, Math.round(height * expected));
      assert.ok(result.pixelWidth >= width && result.pixelHeight >= height);
    }
  }
  assert.deepEqual(resolveRenderResolution(), { width: 1, height: 1, pixelWidth: 1, pixelHeight: 1, ratio: 1, resolution: 'auto' });
  for (const invalid of [0, -1, NaN, Infinity, '100']) {
    const result = resolveRenderResolution({ cssWidth: invalid, cssHeight: invalid, dpr: invalid, resolution: 'invalid' });
    assert.equal(result.width, 1); assert.equal(result.height, 1); assert.equal(result.resolution, 'auto');
    assert.ok(Number.isFinite(result.ratio) && result.pixelWidth >= 1 && result.pixelHeight >= 1);
  }
  const tiny = resolveRenderResolution({ cssWidth: .1, cssHeight: .1, windowWidth: 2560, windowHeight: 1440, resolution: '960x540' });
  assert.equal(tiny.pixelWidth, 1); assert.equal(tiny.pixelHeight, 1);
});

test('old settings acquire auto without rewriting storage or losing existing preferences', () => {
  const memory = new MemoryStorage(), key = 'display-old.settings';
  const raw = rawSettings(customSettings); memory.setItem(key, raw);
  const store = createSaveStore(memory, 'display-old');
  assert.deepEqual(store.loadSettings(), { ...customSettings, resolution: 'auto' });
  assert.equal(memory.getItem(key), raw, 'A read must not overwrite the original legacy settings');
  memory.setItem(key, rawSettings({ music: .09, reducedMotion: true }));
  const partial = store.loadSettings();
  assert.equal(partial.music, .09); assert.equal(partial.reducedMotion, true);
  assert.equal(partial.resolution, 'auto'); assert.equal(partial.uiScale, 1);
});

test('an invalid resolution falls back independently and partial setting updates preserve other choices', () => {
  const memory = new MemoryStorage(), store = createSaveStore(memory, 'display-invalid');
  for (const resolution of ['unknown', 900, null, { width: 1920 }, ['auto']]) {
    memory.setItem('display-invalid.settings', rawSettings({ ...customSettings, resolution }));
    assert.deepEqual(store.loadSettings(), { ...customSettings, resolution: 'auto' });
  }
  assert.equal(store.saveSettings({ ...customSettings, resolution: '1280x720' }).ok, true);
  const choice = store.loadSettings();
  assert.equal(store.saveSettings({ music: .06 }).ok, true);
  assert.deepEqual(store.loadSettings(), { ...choice, music: .06 });
  assert.equal(store.saveSettings({ resolution: 'bad-data' }).ok, true);
  assert.deepEqual(store.loadSettings(), { ...choice, music: .06, resolution: 'auto' });
  const preserved = memory.getItem('display-invalid.settings');
  assert.equal(store.saveSettings({ resolution: '1920x1080', music: 2 }).ok, false);
  assert.equal(memory.getItem('display-invalid.settings'), preserved, 'Unrelated invalid settings must still be rejected');
});

test('every selected resolution persists through a fresh store and reproduces the same actual buffer', () => {
  const memory = new MemoryStorage(), store = createSaveStore(memory, 'display-reload');
  for (const preset of RESOLUTION_PRESETS) {
    assert.equal(store.saveSettings({ ...customSettings, resolution: preset.id }).ok, true);
    const loaded = createSaveStore(memory, 'display-reload').loadSettings();
    assert.deepEqual(loaded, { ...customSettings, resolution: preset.id });
    const area = { cssWidth: 867, cssHeight: 497, windowWidth: 1366, windowHeight: 768, dpr: 2 };
    assert.deepEqual(resolveRenderResolution({ ...area, resolution: loaded.resolution }), resolveRenderResolution({ ...area, resolution: preset.id }));
  }
});

test('settings write failures and corrupt primary envelopes retain a complete compatible safe choice', () => {
  for (let failAt = 1; failAt <= 3; failAt++) {
    const memory = new MemoryStorage(), prefix = `display-failure-${failAt}`, store = createSaveStore(memory, prefix);
    assert.equal(store.saveSettings({ ...customSettings, resolution: '1280x720' }).ok, true);
    const previous = store.loadSettings(); memory.calls = 0; memory.failAt = failAt;
    const requested = { ...previous, resolution: '2560x1440' }, unchanged = structuredClone(requested);
    assert.equal(store.saveSettings(requested).ok, false);
    assert.deepEqual(requested, unchanged);
    assert.deepEqual(createSaveStore(memory, prefix).loadSettings(), previous);
  }
  const memory = new MemoryStorage(), store = createSaveStore(memory, 'display-backup');
  memory.setItem('display-backup.settings', rawSettings(customSettings));
  assert.equal(store.saveSettings({ resolution: '1920x1080' }).ok, true);
  memory.setItem('display-backup.settings', '{broken');
  assert.deepEqual(store.loadSettings(), { ...customSettings, resolution: 'auto' }, 'A pre-resolution backup remains recoverable');
  const failed = createSaveStore({ getItem: () => { throw Error('disabled'); }, setItem: () => { throw Error('disabled'); }, removeItem: () => {} }, 'display-blocked');
  assert.equal(failed.loadSettings().resolution, 'auto');
  assert.equal(failed.saveSettings({ resolution: '960x540' }).ok, false);
});
