import * as THREE from '../../assets/third_party/three/three.bundle.js';
import { clone as cloneRig } from '../../assets/third_party/three/addons/utils/SkeletonUtils.js';

const CONTACT_NAME = /anchor|spike|stake|brace|foot|ankle|wheel|tyre|tire|tread|track|roller|shoe|sole|hoof|skid|pad/i;
const FALLBACK_NAME = /leg|knee|hip/i;
const baselineCache = new Map();
const correctionCache = new Map();

function lowestVertex(root, names = null) {
  if (names && !names.length) return Infinity;
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const point = new THREE.Vector3();
  let minimum = Infinity;
  root.traverse(node => {
    if (!node.isMesh || (names && !names.includes(node.name))) return;
    const position = node.geometry.getAttribute('position');
    for (let index = 0; index < position.count; index++) {
      point.fromBufferAttribute(position, index).applyMatrix4(node.matrixWorld).applyMatrix4(inverse);
      minimum = Math.min(minimum, point.y);
    }
  });
  return minimum + root.position.y;
}

function baselineFor(root, key) {
  if (baselineCache.has(key)) return baselineCache.get(key);
  const baseline = lowestVertex(root);
  baselineCache.set(key, baseline);
  return baseline;
}

export class GroundContact {
  constructor(root, { deferMatrixUpdates = false } = {}) {
    this.root = root;
    this.deferMatrixUpdates = deferMatrixUpdates;
    this.restY = root.position.y;
    this.cacheKey = root.name || root;
    this.contacts = [];
    root.traverse(node => {
      if (node.isMesh && CONTACT_NAME.test(node.name)) this.contacts.push(node);
    });
    if (!this.contacts.length) root.traverse(node => {
      if (node.isMesh && FALLBACK_NAME.test(node.name)) this.contacts.push(node);
    });
    this.contactNames = this.contacts.map(node => node.name);
    this.baseline = baselineFor(root, this.cacheKey);
    this.analysisRoot = cloneRig(root);
    this.analysisMixer = new THREE.AnimationMixer(this.analysisRoot);
  }

  measure() {
    return this.root ? lowestVertex(this.root, this.contactNames) : Infinity;
  }

  reset() {
    if (!this.root) return;
    this.root.position.y = this.restY;
    if (!this.deferMatrixUpdates) this.root.updateMatrixWorld(true);
  }

  correctionFor(clip, time) {
    if (!correctionCache.has(this.cacheKey)) correctionCache.set(this.cacheKey, new Map());
    const clips = correctionCache.get(this.cacheKey);
    if (clips.has(clip.uuid)) return clips.get(clip.uuid)(time);
    // Indexed exports compress constant tracks independently. The first track
    // can contain only its endpoints while legs still move between them.
    const times = [...new Set([0, clip.duration, ...clip.tracks.flatMap(track => Array.from(track.times))])].sort((a, b) => a - b);
    const corrections = new Float32Array(times.length);
    const action = this.analysisMixer.clipAction(clip);
    for (let index = 0; index < times.length; index++) {
      this.analysisMixer.stopAllAction();
      action.reset().play();
      this.analysisMixer.setTime(times[index]);
      corrections[index] = Math.max(0, this.baseline - lowestVertex(this.analysisRoot, this.contactNames));
    }
    const sample = value => {
      const time = Math.max(0, Math.min(clip.duration, Number.isFinite(value) ? value : 0));
      let index = times.findIndex(value => value >= time);
      if (index < 0) index = times.length - 1;
      if (index === 0) return corrections[0];
      return Math.max(corrections[index - 1], corrections[index]);
    };
    clips.set(clip.uuid, sample);
    return sample(time);
  }

  apply(clip = null, time = 0, composed = false) {
    if (!this.root || !Number.isFinite(this.baseline)) return 0;
    const correction = clip && !composed
      ? this.correctionFor(clip, time)
      : Math.max(0, this.baseline - this.measure());
    if (composed || !clip) this.root.position.y += correction;
    else this.root.position.y = this.restY + correction;
    if (!this.deferMatrixUpdates) this.root.updateMatrixWorld(true);
    return correction;
  }

  dispose() {
    this.contacts.length = 0;
    this.analysisMixer.stopAllAction();
    this.analysisMixer.uncacheRoot(this.analysisRoot);
    this.analysisRoot.clear();
    this.analysisRoot = null;
    this.analysisMixer = null;
    this.root = null;
  }
}
