const ENTER_MS = 180, EXIT_MS = 120;
const INPUT_EVENTS = ['pointerdown', 'pointerup', 'click', 'dblclick', 'contextmenu', 'keydown', 'keyup', 'wheel', 'touchstart', 'touchend'];

/** Transitions only; dialog decisions and focus restoration remain in app.js. */
export class DialogTransitions {
  constructor({ root, document = globalThis.document, window = globalThis.window, reducedMotion = () => false, onActiveChange = () => {} }) {
    if (!root || !document || !window) throw Error('DialogTransitions requires a root, document and window');
    this.root = root; this.document = document; this.window = window;
    this.reducedMotion = reducedMotion; this.onActiveChange = onActiveChange;
    this._active = false; this.layer = null; this.generation = 0; this.disposed = false;
    this.animations = new Set(); this.timers = new Set();
    this.media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.onResize = () => this.finish();
    this.onVisibility = () => { if (document.hidden || document.visibilityState === 'hidden') this.finish(); };
    this.onMotion = () => { if (this.media?.matches) this.finish(); };
    this.blockInput = event => {
      if (!this._active || event.key === 'Escape') return;
      event.preventDefault?.(); event.stopImmediatePropagation?.();
    };
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (this.media?.addEventListener) this.media.addEventListener('change', this.onMotion);
    else this.media?.addListener?.(this.onMotion);
    for (const type of INPUT_EVENTS) document.addEventListener(type, this.blockInput, { capture: true, passive: false });
  }

  get active() { return this._active; }
  setActive(value) {
    if (this._active === value) return;
    this._active = value; this.onActiveChange(value);
  }
  allowsMotion() {
    return !this.disposed && !this.reducedMotion() && !this.media?.matches &&
      !this.document.hidden && this.document.visibilityState !== 'hidden';
  }

  animate(element, from, to, duration, complete) {
    if (typeof element.animate !== 'function') { complete(); return false; }
    const generation = this.generation;
    let animation;
    try { animation = element.animate([{ opacity: from }, { opacity: to }], { duration, easing: 'ease-out', fill: 'none' }); }
    catch { complete(); return false; }
    if (!animation) { complete(); return false; }
    this.animations.add(animation);
    let finished = false;
    const done = () => {
      if (finished) return; finished = true;
      this.window.clearTimeout(timer); this.timers.delete(timer);
      if (this.animations.delete(animation)) {
        try { animation.cancel(); } catch { /* Also stop a stalled animation after its watchdog fires. */ }
      }
      if (generation === this.generation) complete();
    };
    // A missing finish notification must never leave an invisible input shield.
    const timer = this.window.setTimeout(done, duration + 50); this.timers.add(timer);
    if (animation.finished?.then) animation.finished.then(done, done);
    else animation.onfinish = done;
    return true;
  }

  open() {
    this.finish();
    if (!this.root.childNodes.length || !this.allowsMotion()) return false;
    return this.animate(this.root, 0, 1, ENTER_MS, () => {});
  }

  close() {
    if (!this.root.childNodes.length) return this.active;
    const computed = this.window.getComputedStyle?.(this.root);
    const opacity = Number(computed?.opacity ?? 1);
    const zoom = this.root.style.zoom || computed?.zoom || '1';
    const previewWidth = this.root.style.getPropertyValue('--preview-width') || computed?.getPropertyValue?.('--preview-width') || '';
    this.finish();
    if (!this.allowsMotion()) { this.root.replaceChildren(); return false; }

    const layer = this.document.createElement('div'), decoration = this.document.createElement('div');
    if (typeof layer.animate !== 'function') { this.root.replaceChildren(); return false; }
    layer.className = 'dialog-exit-layer'; layer.setAttribute('aria-hidden', 'true');
    Object.assign(layer.style, { position: 'fixed', inset: '0', zIndex: computed?.zIndex === 'auto' ? '50' : computed?.zIndex || '50', pointerEvents: 'auto' });
    decoration.className = 'dialog-exit-decoration'; decoration.inert = true;
    decoration.setAttribute('inert', ''); decoration.setAttribute('aria-hidden', 'true');
    decoration.style.zoom = zoom; decoration.style.position = 'relative';
    if (previewWidth) decoration.style.setProperty('--preview-width', previewWidth);
    // Move, rather than duplicate, the outgoing DOM so root is empty before
    // close returns. It is now decoration with no live selectors or controls.
    for (const child of [...this.root.childNodes]) decoration.append(child);
    for (const element of decoration.querySelectorAll('*')) {
      for (const attribute of [...element.attributes]) {
        if (attribute.name === 'id' || attribute.name === 'name' || attribute.name === 'for' || attribute.name === 'role' ||
            attribute.name.startsWith('data-') || attribute.name.startsWith('aria-') || attribute.name.startsWith('on')) element.removeAttribute(attribute.name);
      }
      if ('tabIndex' in element) element.tabIndex = -1;
    }
    layer.append(decoration); this.document.body.append(layer); this.layer = layer;
    this.setActive(true);
    this.animate(layer, Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1, 0, EXIT_MS, () => this.finish());
    return this.active;
  }

  finish() {
    this.generation++;
    for (const timer of this.timers) this.window.clearTimeout(timer);
    this.timers.clear();
    for (const animation of this.animations) { try { animation.cancel(); } catch { /* Already detached or finished. */ } }
    this.animations.clear();
    this.layer?.remove(); this.layer = null; this.setActive(false);
  }

  destroy() {
    this.disposed = true; this.finish();
    this.window.removeEventListener('resize', this.onResize);
    this.document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.media?.removeEventListener) this.media.removeEventListener('change', this.onMotion);
    else this.media?.removeListener?.(this.onMotion);
    for (const type of INPUT_EVENTS) this.document.removeEventListener(type, this.blockInput, true);
  }
}
