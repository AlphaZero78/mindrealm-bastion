import test from 'node:test';
import assert from 'node:assert/strict';
import {DialogTransitions} from '../../web/view/dialog-transitions.js';

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  fire(name, event = {}) { for (const fn of [...this.listeners.get(name) || []]) fn(event); }
  get listenerCount() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0); }
}
class Element {
  constructor(document, tag = 'div') {
    this.document = document; this.tagName = tag.toUpperCase(); this.attrs = new Map(); this.childNodes = [];
    this.style = {getPropertyValue(name) { return this[name] || ''; }, setProperty(name, value) { this[name] = value; }};
    this.animations = []; this.tabIndex = 0;
    if (['button', 'input', 'select'].includes(tag)) this.disabled = false;
    if (document.noAnimation) this.animate = undefined;
  }
  get attributes() { return [...this.attrs].map(([name, value]) => ({name, value})); }
  get children() { return this.childNodes; }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  removeAttribute(name) { this.attrs.delete(name); }
  append(...nodes) { for (const node of nodes) { node.remove(); node.parentElement = this; this.childNodes.push(node); } }
  remove() { if (this.parentElement) this.parentElement.childNodes = this.parentElement.childNodes.filter(node => node !== this); this.parentElement = null; }
  replaceChildren(...nodes) { for (const node of [...this.childNodes]) node.remove(); this.append(...nodes); }
  querySelectorAll() { return this.childNodes.flatMap(node => [node, ...node.querySelectorAll('*')]); }
  animate(frames, options) {
    if (this.document.throwAnimation) throw Error('animation unavailable');
    let resolve, reject;
    const animation = {frames, options, finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
      resolve: () => resolve(), reject: () => reject(Error('interrupted')), cancels: 0,
      cancel() { this.cancels++; reject(Error('cancelled')); }};
    this.animations.push(animation); return animation;
  }
}
function harness(options = {}) {
  const document = new Events(); document.hidden = false; document.visibilityState = 'visible';
  document.noAnimation = options.noAnimation; document.throwAnimation = options.throwAnimation;
  document.createElement = tag => new Element(document, tag); document.body = document.createElement('body');
  const window = new Events(); window.media = new Events(); window.media.matches = false; window.matchMedia = () => window.media;
  window.getComputedStyle = node => ({opacity: node.style.opacity || '1', zoom: node.style.zoom || '1', zIndex: node.style.zIndex || '50', getPropertyValue: name => node.style.getPropertyValue(name)});
  window.timers = new Map(); let serial = 0;
  window.setTimeout = (fn, delay) => { const id = ++serial; window.timers.set(id, {fn, delay}); return id; };
  window.clearTimeout = id => window.timers.delete(id);
  window.flushTimers = () => { const callbacks = [...window.timers.values()]; window.timers.clear(); callbacks.forEach(({fn}) => fn()); };
  const root = document.createElement('div'); root.setAttribute('id', 'modal-root'); document.body.append(root);
  const backdrop = document.createElement('div'), dialog = document.createElement('section'), button = document.createElement('button'), disabled = document.createElement('button');
  backdrop.className = 'modal-backdrop field-preview-modal'; dialog.className = 'modal panel'; disabled.disabled = true;
  dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-labelledby', 'dialog-title');
  button.setAttribute('id', 'dialog-title'); button.setAttribute('data-modal', 'confirm'); button.setAttribute('data-action', 'upgrade'); button.setAttribute('onclick', 'upgrade()');
  dialog.append(button, disabled); backdrop.append(dialog); root.append(backdrop);
  const changes = []; const transitions = new DialogTransitions({root, document, window, reducedMotion: options.reducedMotion, onActiveChange: active => changes.push(active)});
  const layers = () => document.body.childNodes.filter(node => node.className === 'dialog-exit-layer');
  return {document, window, root, backdrop, dialog, button, disabled, changes, transitions, layers};
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test('open fades live content for 180 ms without locking input and repeated open cancels the preceding animation', async () => {
  const h = harness(); try {
    assert.equal(h.transitions.open(), true); const animation = h.root.animations[0];
    assert.deepEqual(animation.frames, [{opacity: 0}, {opacity: 1}]); assert.equal(animation.options.duration, 180);
    assert.equal(h.transitions.active, false); assert.deepEqual(h.changes, []); assert.equal(h.root.childNodes[0], h.backdrop);
    assert.equal(h.transitions.open(), true); assert.equal(animation.cancels, 1); await flush();
    assert.equal(h.root.childNodes[0], h.backdrop); assert.equal(h.window.timers.size, 1);
    h.root.animations[1].resolve(); await flush(); assert.equal(h.window.timers.size, 0); assert.equal(h.transitions.animations.size, 0);
  } finally { h.transitions.destroy(); }
});

test('close empties the live root synchronously and preserves outgoing appearance in a noninteractive decoration', async () => {
  const h = harness(); try {
    h.root.style.zoom = '1.25'; h.root.style.setProperty('--preview-width', '248px'); h.root.style.opacity = '.6';
    assert.equal(h.transitions.close(), true); assert.equal(h.root.childNodes.length, 0); assert.equal(h.layers().length, 1);
    const layer = h.layers()[0], decoration = layer.childNodes[0];
    assert.equal(decoration.childNodes[0], h.backdrop); assert.equal(decoration.inert, true); assert.equal(decoration.getAttribute('aria-hidden'), 'true');
    assert.equal(decoration.style.zoom, '1.25'); assert.equal(decoration.style.getPropertyValue('--preview-width'), '248px');
    assert.equal(h.backdrop.className, 'modal-backdrop field-preview-modal'); assert.equal(h.button.disabled, false); assert.equal(h.disabled.disabled, true);
    assert.equal(layer.style.pointerEvents, 'auto'); assert.equal(layer.style.zIndex, '50'); assert.deepEqual(h.changes, [true]);
    for (const node of decoration.querySelectorAll('*')) {
      assert.equal(node.tabIndex, -1);
      assert.ok(node.attributes.every(({name}) => name !== 'id' && name !== 'role' && !name.startsWith('data-') && !name.startsWith('on') && !name.startsWith('aria-')));
    }
    assert.deepEqual(layer.animations[0].frames, [{opacity: .6}, {opacity: 0}]); assert.equal(layer.animations[0].options.duration, 120);
    layer.animations[0].resolve(); await flush();
    assert.equal(h.layers().length, 0); assert.equal(h.transitions.active, false); assert.deepEqual(h.changes, [true, false]); assert.equal(h.window.timers.size, 0);
  } finally { h.transitions.destroy(); }
});

test('repeated close cannot stack departure layers and reopen invalidates stale animation completion', async () => {
  const h = harness(); try {
    h.transitions.open(); h.transitions.close(); const oldLayer = h.layers()[0], oldExit = oldLayer.animations[0];
    assert.equal(h.transitions.close(), true); assert.equal(h.layers().length, 1); assert.equal(h.layers()[0], oldLayer);
    const fresh = h.document.createElement('section'); fresh.setAttribute('id', 'new-dialog'); h.root.append(fresh);
    h.transitions.open(); assert.equal(h.layers().length, 0); assert.equal(h.transitions.active, false); assert.equal(oldExit.cancels, 1);
    oldExit.resolve(); await flush(); assert.equal(h.root.childNodes[0], fresh); assert.equal(fresh.getAttribute('id'), 'new-dialog');
    assert.equal(h.window.timers.size, 1); h.transitions.close(); assert.equal(h.layers().length, 1);
    assert.deepEqual(h.changes, [true, false, true]);
  } finally { h.transitions.destroy(); }
});

test('finish is idempotent and never deletes fresh root content', async () => {
  const h = harness(); try {
    h.transitions.close(); const outgoing = h.layers()[0].animations[0];
    const fresh = h.document.createElement('section'); h.root.append(fresh);
    h.transitions.finish(); h.transitions.finish(); await flush();
    assert.equal(outgoing.cancels, 1); assert.equal(h.layers().length, 0); assert.equal(h.window.timers.size, 0);
    assert.equal(h.root.childNodes[0], fresh); assert.deepEqual(h.changes, [true, false]);
  } finally { h.transitions.destroy(); }
});

test('system or app reduced motion and hidden documents skip animation and close immediately', () => {
  for (const mode of ['system', 'app', 'hidden', 'visibility']) {
    const h = harness({reducedMotion: () => mode === 'app'}); try {
      if (mode === 'system') h.window.media.matches = true;
      if (mode === 'hidden') h.document.hidden = true;
      if (mode === 'visibility') h.document.visibilityState = 'hidden';
      assert.equal(h.transitions.open(), false); assert.equal(h.root.childNodes.length, 1);
      assert.equal(h.transitions.close(), false); assert.equal(h.root.childNodes.length, 0); assert.equal(h.layers().length, 0);
      assert.equal(h.window.timers.size, 0); assert.deepEqual(h.changes, []);
    } finally { h.transitions.destroy(); }
  }
});

test('resize, hiding and a changed system preference finish both entering and departing animations', async () => {
  for (const phase of ['enter', 'exit']) for (const reason of ['resize', 'hidden', 'motion']) {
    const h = harness(); try {
      if (phase === 'enter') h.transitions.open(); else h.transitions.close();
      const animation = phase === 'enter' ? h.root.animations[0] : h.layers()[0].animations[0];
      if (reason === 'resize') h.window.fire('resize');
      if (reason === 'hidden') { h.document.hidden = true; h.document.fire('visibilitychange'); }
      if (reason === 'motion') { h.window.media.matches = true; h.window.media.fire('change'); }
      await flush(); assert.equal(animation.cancels, 1); assert.equal(h.transitions.active, false); assert.equal(h.layers().length, 0);
      assert.equal(h.window.timers.size, 0); assert.equal(h.root.childNodes.length, phase === 'enter' ? 1 : 0);
    } finally { h.transitions.destroy(); }
  }
});

test('departure blocks background input but lets Escape reach the application cancellation handler', () => {
  const h = harness(); try {
    const input = (type, key) => { const event = {key, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }}; h.document.fire(type, event); return event; };
    assert.equal(input('click').prevented, false); h.transitions.close();
    for (const type of ['pointerdown', 'pointerup', 'click', 'dblclick', 'contextmenu', 'keydown', 'keyup', 'wheel', 'touchstart', 'touchend']) {
      const event = input(type, type.startsWith('key') ? 'Enter' : undefined); assert.equal(event.prevented, true); assert.equal(event.stopped, true);
    }
    for (const type of ['keydown', 'keyup']) { const event = input(type, 'Escape'); assert.equal(event.prevented, false); assert.equal(event.stopped, false); }
    h.transitions.finish(); assert.equal(input('click').prevented, false);
  } finally { h.transitions.destroy(); }
});

test('missing or rejected animation support cannot leave old controls or an input lock', async () => {
  for (const mode of ['missing', 'throws', 'rejected']) {
    const h = harness({noAnimation: mode === 'missing', throwAnimation: mode === 'throws'}); try {
      const result = h.transitions.close();
      if (mode === 'rejected') { assert.equal(result, true); h.layers()[0].animations[0].reject(); await flush(); }
      else assert.equal(result, false);
      assert.equal(h.root.childNodes.length, 0); assert.equal(h.layers().length, 0); assert.equal(h.transitions.active, false); assert.equal(h.window.timers.size, 0);
    } finally { h.transitions.destroy(); }
  }
});

test('watchdog cancels a stalled animation itself before releasing all state', async () => {
  for (const phase of ['enter', 'exit']) {
    const h = harness(); try {
      if (phase === 'enter') h.transitions.open(); else h.transitions.close();
      const animation = phase === 'enter' ? h.root.animations[0] : h.layers()[0].animations[0];
      assert.equal([...h.window.timers.values()][0].delay, phase === 'enter' ? 230 : 170);
      h.window.flushTimers(); await flush(); assert.equal(animation.cancels, 1);
      assert.equal(h.transitions.animations.size, 0); assert.equal(h.transitions.active, false); assert.equal(h.layers().length, 0); assert.equal(h.window.timers.size, 0);
      assert.equal(h.root.childNodes.length, phase === 'enter' ? 1 : 0);
    } finally { h.transitions.destroy(); }
  }
});

test('destroy detaches all global listeners and subsequent calls remain synchronous', async () => {
  const h = harness(); h.transitions.close(); h.transitions.destroy(); await flush();
  assert.equal(h.document.listenerCount, 0); assert.equal(h.window.listenerCount, 0); assert.equal(h.window.media.listenerCount, 0);
  assert.equal(h.layers().length, 0); assert.equal(h.window.timers.size, 0); assert.deepEqual(h.changes, [true, false]);
  const fresh = h.document.createElement('section'); h.root.append(fresh); assert.equal(h.transitions.open(), false); assert.equal(h.root.childNodes[0], fresh);
  assert.equal(h.transitions.close(), false); assert.equal(h.root.childNodes.length, 0); h.window.fire('resize'); assert.deepEqual(h.changes, [true, false]);
});
