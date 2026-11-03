import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EntityBatchPool } from './entity-batches.js';
import {
  loadEntityManifest,
  loadEntityModel,
  instantiateEntityModel,
  ENTITY_MANIFEST_URL,
} from './entity-assets.js';
import { createEntityMixer } from './entity-animation.js';
import { TRACKING_DRONE_ID, createTrackingDronePose } from './tracking-drone.js';

const TAU = Math.PI * 2;
const S = Math.sin(55 * Math.PI / 180);
const C = Math.cos(55 * Math.PI / 180);
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

function yawOffset(definition) {
  if (Number.isFinite(definition.yawOffset)) return definition.yawOffset;
  return definition.forward === '+z' ? 0 : Math.PI;
}

export class WholeEntityRenderer {
  constructor({ onError = () => {}, canvas = document.createElement('canvas'), preload = 'all' } = {}) {
    this.canvas = canvas;
    this.onError = onError;
    this.preloadMode = preload;
    this.ready = false;
    this.disposed = false;
    this.errors = [];
    this.sources = new Map();
    this.modelAssets = new Map();
    this.assetPromises = new Map();
    this.failedAssets = new Map();
    this.bulkLoads = 0;
    this.instances = new Map();
    this.turns = new Map();
    this.frames = [];
    this.present = new Set();
    this.shadowParts = [];
    this.frameSerial = 0;
    this.iconMode = false;
    this.manifestUrl = ENTITY_MANIFEST_URL;
    this.loader = new GLTFLoader();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environmentTarget = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = 0.92;
    this.scene.environmentRotation.y = 0.4;
    room.dispose();
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xdbefff, 0x34433b, 1.15));
    const key = new THREE.DirectionalLight(0xffecd4, 2.7);
    key.position.set(5, 48, 32);
    key.target.position.set(20, 0, 20);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 0.5, far: 120 });
    key.shadow.bias = -0.00015;
    key.shadow.normalBias = 0.018;
    key.shadow.autoUpdate = false;
    this.keyLight = key;
    this.scene.add(key, key.target);
    const rim = new THREE.DirectionalLight(0x8dd7e9, 0.95);
    rim.position.set(20, 10, -20);
    this.scene.add(rim);

    this.depthMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: THREE.DoubleSide });
    this.depthMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.depthMaterial);
    this.depthMesh.renderOrder = -10;
    this.depthMesh.frustumCulled = false;
    this.depthMesh.castShadow = true;
    this.scene.add(this.depthMesh);
    this.batchPool = new EntityBatchPool(this.scene);
    this.batches = this.batchPool.batches;

    this.stats = {
      mode: 'realtime-webgl',
      ready: false,
      drawCalls: 0,
      triangles: 0,
      instances: 0,
      entities: 0,
      sourceCount: 0,
      lod: [0, 0],
    };
    this.readyPromise = this.load().catch(error => {
      this.disposeInstances();
      this.disposeSources();
      this.ready = false;
      this.stats.ready = false;
      if (!this.disposed) {
        this.errors.push(String(error?.message || error));
        onError(`实时模型加载失败：${error?.message || error}`);
      }
      return false;
    });
  }

  assetJobs(core = false, type = null, variant = null) {
    const jobs = [];
    for (const [id, definition] of Object.entries(this.catalog.entities)) {
      if (type && id !== type) continue;
      for (const [name, entry] of Object.entries(definition.variants)) {
        if (variant && name !== variant) continue;
        if (core && name !== (definition.variants.base ? 'base' : definition.variants.T1 ? 'T1' : 'phase1')) continue;
        jobs.push({ type: id, variant: name, entry, label: `${id}/${name}` });
      }
    }
    return jobs;
  }

  loadAsset(job) {
    const key = `${job.type}/${job.variant}`;
    if (this.modelAssets.has(key)) return Promise.resolve(this.modelAssets.get(key));
    if (this.assetPromises.has(key)) return this.assetPromises.get(key);
    if (this.failedAssets.has(key) || this.disposed) return Promise.resolve(null);
    const promise = loadEntityModel(job.entry, {
      loader: this.loader,
      manifestUrl: this.manifestUrl,
      label: job.label,
    }).then(asset => {
      if (this.disposed) {
        asset.dispose();
        return null;
      }
      this.sources.set(asset.url, asset);
      this.modelAssets.set(key, asset);
      this.stats.sourceCount = this.sources.size;
      if (this.ready && !this.bulkLoads) this.batchPool.prepare([asset]);
      return asset;
    }).catch(error => {
      this.failedAssets.set(key, error);
      if (this.ready && !this.disposed) {
        this.errors.push(String(error?.message || error));
        this.onError(`实时模型加载失败：${error?.message || error}`);
      }
      return null;
    }).finally(() => this.assetPromises.delete(key));
    this.assetPromises.set(key, promise);
    return promise;
  }

  async loadAssets(jobs) {
    const pending = jobs.filter(job => !this.modelAssets.has(`${job.type}/${job.variant}`));
    if (!pending.length || this.disposed) return;
    this.bulkLoads++;
    try {
      let cursor = 0;
      const workers = Array.from({ length: Math.min(4, pending.length) }, async () => {
        while (!this.disposed) {
          const job = pending[cursor++];
          if (!job) return;
          await this.loadAsset(job);
        }
      });
      await Promise.all(workers);
      if (!this.disposed) this.batchPool.prepare(this.modelAssets);
    } finally {
      this.bulkLoads--;
    }
  }

  async load() {
    this.catalog = await loadEntityManifest(this.manifestUrl);
    const jobs = this.assetJobs(this.preloadMode === 'core');
    await this.loadAssets(jobs);
    if (this.disposed) {
      this.disposeSources();
      return false;
    }
    const failed = jobs.find(job => !this.modelAssets.has(`${job.type}/${job.variant}`));
    if (failed) throw this.failedAssets.get(`${failed.type}/${failed.variant}`) || new Error(`${failed.label} 未加载`);
    this.ready = true;
    this.stats.ready = true;
    this.stats.sourceCount = this.sources.size;
    return true;
  }

  async preload(type = null, variant = null) {
    if (!this.catalog) {
      await this.readyPromise;
      if (!this.catalog) return false;
    }
    const jobs = this.assetJobs(false, type, variant);
    await this.loadAssets(jobs);
    const failed = jobs.find(job => !this.modelAssets.has(`${job.type}/${job.variant}`));
    if (failed) throw this.failedAssets.get(`${failed.type}/${failed.variant}`) || new Error(`${failed.label} 未加载`);
    return !this.disposed;
  }

  prepareState(state) {
    if (!this.ready || !state) return Promise.resolve(false);
    const jobs = [];
    const request = (entity, variant) => {
      const definition = this.catalog.entities[entity.type];
      const selected = definition?.variants[variant] ? variant : Object.keys(definition?.variants || {})[0];
      if (selected) jobs.push({ type: entity.type, variant: selected, entry: definition.variants[selected], label: `${entity.type}/${selected}` });
    };
    for (const unit of state.units || []) request(unit, `T${unit.tier || 1}${(unit.tier || 1) > 1 ? unit.branch || 'A' : ''}`);
    for (const enemy of [...(state.battle?.queue || []), ...(state.battle?.enemies || [])]) {
      const definition = this.catalog.entities[enemy.type];
      request(enemy, definition?.variants.base ? 'base' : `phase${clamp(finite(enemy.phase), 0, 2) + 1}`);
    }
    return this.loadAssets(jobs);
  }

  syncTerrain(terrain) {
    if (!terrain) {
      this.depthMesh.visible = false;
      return;
    }
    this.depthMesh.visible = true;
    if (terrain === this.terrain && terrain.revision === this.terrainRevision) return;
    this.terrain = terrain;
    this.terrainRevision = terrain.revision;
    this.shadowStamp = null;
    const vertices = [];
    const n = terrain.size;
    const cells = terrain.cells;
    const quad = (a, b, c, d) => vertices.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      const height = cells[z * n + x].h * 0.95;
      quad([x, height, z], [x + 1, height, z], [x + 1, height, z + 1], [x, height, z + 1]);
      for (const [dx, dz, a, b] of [
        [1, 0, [x + 1, z + 1], [x + 1, z]], [-1, 0, [x, z], [x, z + 1]],
        [0, 1, [x, z + 1], [x + 1, z + 1]], [0, -1, [x + 1, z], [x, z]],
      ]) {
        const nx = x + dx, nz = z + dz;
        const lower = nx < 0 || nz < 0 || nx >= n || nz >= n ? -1.425 : cells[nz * n + nx].h * 0.95;
        if (lower >= height) continue;
        quad([a[0], height, a[1]], [b[0], height, b[1]], [b[0], lower, b[1]], [a[0], lower, a[1]]);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.depthMesh.geometry.dispose();
    this.depthMesh.geometry = geometry;
  }

  begin(camera, terrain, width, height) {
    if (!this.ready) return;
    this.view = camera;
    this.iconMode = false;
    this.frameSerial++;
    this.frames = [];
    this.present = new Set();
    this.shadowParts = [];
    this.batchPool.begin();
    this.stats.lod = [0, 0];
    this.keyLight.position.set(5, 48, 32);
    this.keyLight.target.position.set(20, 0, 20);
    Object.assign(this.keyLight.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 0.5, far: 120 });
    this.keyLight.shadow.camera.updateProjectionMatrix();
    if (this.canvas.width !== width || this.canvas.height !== height) this.renderer.setSize(width, height, false);
    const w = camera.width / camera.scale, h = camera.height / camera.scale;
    Object.assign(this.camera, { left: -w / 2, right: w / 2, top: h / 2, bottom: -h / 2 });
    this.camera.updateProjectionMatrix();
    const focusY = camera.focusY || 0;
    this.camera.position.set(camera.x + Math.sin(camera.yaw) * C * 100, focusY + S * 100, camera.z + Math.cos(camera.yaw) * C * 100);
    this.camera.lookAt(camera.x, focusY, camera.z);
    this.camera.updateMatrixWorld();
    this.syncTerrain(terrain);
  }

  createInstance(type, key, definition, asset) {
    const model = instantiateEntityModel(asset);
    const root = new THREE.Group();
    root.name = `Entity_${type}_${key}`;
    const alignment = new THREE.Group();
    alignment.name = 'Model_alignment';
    alignment.position.set(-asset.bounds.center[0], -asset.bounds.min[1], -asset.bounds.center[2]);
    alignment.add(model.root);
    root.add(alignment);
    const meshes = [];
    model.root.traverse(node => { if (node.isMesh) meshes.push(node); });
    const ranked = meshes.map(node => ({ node, ...model.sources.get(node) })).sort((a, b) => b.radius - a.radius);
    const farSelection = new Set(ranked.slice(0, 12).map(entry => entry.node));
    let emissive = 0;
    for (const entry of ranked) {
      if (!entry.emissive || farSelection.has(entry.node)) continue;
      farSelection.add(entry.node);
      if (++emissive === 4) break;
    }
    const functional = new Set();
    for (const clip of asset.animations) {
      if (clip.name === 'idle') continue;
      for (const track of clip.tracks) functional.add(track.name.slice(0, track.name.lastIndexOf('.')));
    }
    for (const node of meshes) {
      for (let parent = node; parent && parent !== model.root; parent = parent.parent) {
        if (functional.has(parent.name)) {
          farSelection.add(node);
          break;
        }
      }
    }
    const farNodes = meshes.filter(node => farSelection.has(node));
    const legacyScene = asset.hasSkinnedMesh;
    if (legacyScene) this.scene.add(root);
    return {
      type,
      definition,
      asset,
      root,
      alignment,
      model,
      meshes,
      farNodes,
      legacyScene,
      animation: createEntityMixer(model.root, asset.animations, { stride: definition.stride || 1.5 }),
      meshCount: model.meshCount,
      style: null,
      styleSignature: '',
      frame: this.frameSerial,
    };
  }

  removeInstance(key) {
    const instance = this.instances.get(key);
    if (!instance) return;
    this.batchPool.remove(instance.root.uuid);
    this.scene.remove(instance.root);
    instance.animation.dispose();
    instance.model.dispose();
    instance.root.clear();
    this.instances.delete(key);
  }

  applyStyle(instance, pose, { opacity, ghost, wreck, spawn }) {
    const disabled = pose.action === 'disabled';
    const dying = pose.action === 'death';
    const hit = ghost || dying ? 0 : clamp(finite(pose.hit));
    const shade = wreck ? 0.28 : disabled ? 0.36 : 1;
    const alpha = clamp(finite(opacity, 1)) * (ghost ? 0.44 : 1) * (1 - spawn * 0.65);
    const transparent = ghost || dying || alpha < 0.999;
    instance.style = { alpha, brightness: shade * (1 + hit * 0.75), transparent };
    const signature = `${alpha}:${shade}:${hit}:${ghost}:${dying}`;
    if (signature === instance.styleSignature) return instance.style;
    instance.styleSignature = signature;
    const brightness = instance.style.brightness;
    for (const base of instance.model.materials) {
      const material = base.material;
      if (base.color && material.color) material.color.copy(base.color).multiplyScalar(brightness);
      if (base.emissive && material.emissive) material.emissive.copy(base.emissive).multiplyScalar(brightness);
      if ('emissiveIntensity' in material) material.emissiveIntensity = base.emissiveIntensity;
      material.opacity = base.opacity * alpha;
      const nextTransparent = base.transparent || transparent;
      if (material.transparent !== nextTransparent) {
        material.transparent = nextTransparent;
        material.needsUpdate = true;
      }
      material.depthWrite = nextTransparent ? false : base.depthWrite;
    }
    for (const mesh of instance.meshes) {
      const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.castShadow = meshMaterials.every(material => !material.transparent && material.opacity >= 0.999);
      mesh.receiveShadow = true;
      mesh.renderOrder = meshMaterials.some(material => material.transparent) ? 2 : 0;
    }
    return instance.style;
  }

  submitInstance(instance, level) {
    if (instance.legacyScene) return;
    const far = level === 1;
    for (const node of far ? instance.farNodes : instance.meshes) {
      if (!node.visible) continue;
      const source = instance.model.sources.get(node);
      if (!source) throw new Error(`实例缺少几何来源：${instance.type}/${node.name}`);
      const renderSource = far ? source.far : source;
      const elements = node.matrixWorld.elements;
      const scale = Math.max(
        Math.hypot(elements[0], elements[1], elements[2]),
        Math.hypot(elements[4], elements[5], elements[6]),
        Math.hypot(elements[8], elements[9], elements[10]),
      );
      if (!Number.isFinite(scale) || scale <= 0) continue;
      const pixelRadius = renderSource.radius * scale * this.view.scale;
      const threshold = this.iconMode ? 0.02 : 0.06;
      if (pixelRadius < threshold) continue;
      this.batchPool.add(renderSource, node.matrixWorld, {
        ...instance.style,
        shadow: !far,
        owner: instance.root.uuid,
        part: node.uuid,
      });
    }
  }

  add(type, pose, g, {
    opacity = 1,
    wreck = false,
    reducedMotion = false,
    definition = this.catalog?.entities[type],
  } = {}) {
    if (!this.ready) return false;
    if (!definition) throw new Error(`缺少模型 ${type}`);
    const variant = definition.variants[pose.variant] ? pose.variant : Object.keys(definition.variants)[0];
    const asset = this.modelAssets.get(`${type}/${variant}`);
    if (!asset) {
      void this.preload(type, variant).catch(() => {});
      return false;
    }
    const entityKey = pose.key ?? `${g.x}:${g.z}`;
    const key = `${type}:${entityKey}`;
    let instance = this.instances.get(key);
    if (instance && instance.asset !== asset) {
      this.removeInstance(key);
      instance = null;
    }
    if (!instance) {
      instance = this.createInstance(type, entityKey, definition, asset);
      this.instances.set(key, instance);
    }
    instance.frame = this.frameSerial;
    instance.root.visible = true;

    const ghost = pose.action === 'preview';
    const spawn = reducedMotion ? 0 : clamp(finite(pose.spawn));
    const clock = Math.max(0, finite(pose.clock));
    const bounds = asset.bounds.size;
    const enemy = definition.kind === 'enemies';
    const fp = Array.isArray(g.fp) && g.fp.length >= 2 ? g.fp : [1, 1];
    let size = this.iconMode ? 1 : enemy
      ? (definition.role === 'boss' ? 4.5 : definition.role === 'elite' ? 2.95 : 2.2) / Math.max(bounds[0], bounds[2], 0.000001)
      : Math.min(fp[0], fp[1]) * 1.18 / Math.max(0.000001, Math.min(bounds[0], bounds[2]));
    if (!enemy && !this.iconMode) size = Math.min(size, Math.max(...fp) * 1.18 / Math.max(bounds[0], bounds[2], 0.000001));
    size *= 1 - spawn * 0.15;
    const apparent = Math.max(...bounds) * size * this.view.scale;
    const level = this.iconMode || apparent >= 54 ? 0 : 1;

    let facing = finite(pose.facing);
    const turn = this.turns.get(key);
    const rewound = turn && clock < turn.clock;
    if (turn && !rewound && !ghost && !this.iconMode && !reducedMotion) {
      const delta = ((facing - turn.angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
      const step = clamp((clock - turn.clock) / 1000, 0, 0.1) * 18;
      facing = turn.angle + clamp(delta, -step, step);
    }
    this.turns.set(key, { angle: facing, clock });
    this.present.add(key);

    const sample = instance.animation.sample({ ...pose, clock }, { reducedMotion });
    const falling = pose.action === 'death' ? clamp(finite(pose.progress)) : 0;
    const flightDrop = enemy && pose.air && pose.action === 'death'
      ? 1.3 * 0.95 * Math.min(1, ((reducedMotion ? 1 : falling) / 0.74) ** 2)
      : 0;
    instance.root.position.set(g.x, g.h * 0.95 + 0.025 - flightDrop, g.z);
    instance.root.rotation.set(0, facing + yawOffset(definition), 0);
    instance.root.scale.setScalar(size);
    this.applyStyle(instance, pose, { opacity, ghost, wreck, spawn });
    instance.root.updateMatrixWorld(true);
    this.submitInstance(instance, level);

    this.stats.lod[level]++;
    if (!ghost) {
      this.shadowParts.push([
        key, variant, g.x, g.z, g.h, size, facing, sample.clip, sample.time,
        falling, flightDrop, instance.styleSignature, level,
      ].join(':'));
    }
    this.frames.push({
      key: pose.key,
      type,
      variant: pose.variant,
      action: pose.action,
      facing,
      progress: pose.progress,
      lod: level,
      size,
      parts: instance.meshCount,
    });
    return true;
  }

  addDrone(drone, geometry, clock) {
    if (!this.ready) return false;
    return this.add(
      TRACKING_DRONE_ID,
      createTrackingDronePose(drone, clock),
      { ...geometry, fp: geometry.fp || [0.75, 0.9] },
    );
  }

  flush() {
    if (!this.ready) return false;
    for (const [key, instance] of this.instances) if (instance.frame !== this.frameSerial) this.removeInstance(key);
    for (const key of this.turns.keys()) if (!this.present.has(key)) this.turns.delete(key);
    let instances = this.batchPool.flush();
    const shadowStamp = `${this.iconMode}:${this.depthMesh.visible}:${this.shadowParts.join('|')}`;
    if (shadowStamp !== this.shadowStamp) {
      this.keyLight.shadow.needsUpdate = true;
      this.shadowStamp = shadowStamp;
    }
    this.renderer.render(this.scene, this.camera);
    for (const instance of this.instances.values()) if (instance.legacyScene) instances += instance.meshCount;
    Object.assign(this.stats, {
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      instances,
      entities: this.frames.length,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      width: this.canvas.width,
      height: this.canvas.height,
      sourceCount: this.sources.size,
    });
    return true;
  }

  boundsFor(type, variant) {
    const definition = this.catalog.entities[type];
    if (!definition) throw new Error(`缺少模型 ${type}`);
    const selected = definition.variants[variant] ? variant : Object.keys(definition.variants)[0];
    const asset = this.modelAssets.get(`${type}/${selected}`);
    if (!asset) {
      void this.preload(type, selected).catch(() => {});
      return null;
    }
    return asset.bounds.size;
  }

  renderIcon(type, variant, cell = 256) {
    if (!this.ready) return this.canvas;
    const b = this.boundsFor(type, variant);
    if (!b) return this.canvas;
    const span = Math.max(b[0], b[2], b[1] * 1.05);
    this.begin({ x: 0, z: 0, yaw: Math.PI / 4, width: cell, height: cell, scale: cell / (span * 1.42), focusY: b[1] * 0.47 }, null, cell, cell);
    this.iconMode = true;
    this.keyLight.position.set(-7, 10, 6);
    this.keyLight.target.position.set(0, b[1] * 0.5, 0);
    Object.assign(this.keyLight.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 0.5, far: 35 });
    this.keyLight.shadow.camera.updateProjectionMatrix();
    this.add(type, { key: 'icon', clock: 0, action: 'idle', progress: 0, facing: 0, variant }, { x: 0, z: 0, h: 0, fp: [2, 2] });
    this.flush();
    return this.canvas;
  }

  renderStudy(type, variant, {
    cell = 512,
    action = 'idle',
    progress = 0,
    clock = 0,
    travel = 0,
    facing = 0,
    stage = 'release',
    phase = 0,
    hit = 0,
    yaw = Math.PI / 4,
    speed = 1,
    moving = action === 'move',
    reducedMotion = false,
    ...state
  } = {}) {
    if (!this.ready) return this.canvas;
    const b = this.boundsFor(type, variant);
    if (!b) return this.canvas;
    const air = state.air ? 1.3 : 0;
    const span = Math.max(b[0], b[2], b[1] * 1.05) + air * 0.95;
    this.begin({ x: 0, z: 0, yaw, width: cell, height: cell, scale: cell / (span * 1.34), focusY: b[1] * 0.44 + air * 0.475 }, null, cell, cell);
    this.iconMode = true;
    this.keyLight.position.set(-7, 10, 6);
    this.keyLight.target.position.set(0, b[1] * 0.5, 0);
    Object.assign(this.keyLight.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 0.5, far: 35 });
    this.keyLight.shadow.camera.updateProjectionMatrix();
    this.add(type, { ...state, key: `study:${type}`, clock, action, progress, travel, speed, moving, facing, variant, stage, phase, hit }, { x: 0, z: 0, h: air, fp: [2, 2] }, {
      reducedMotion,
      opacity: state.opacity ?? 1,
      wreck: state.wreck || false,
    });
    this.flush();
    return this.canvas;
  }

  snapshot() {
    return { ...this.stats, lod: [...this.stats.lod], errors: [...this.errors], pendingAssets: this.assetPromises.size };
  }

  disposeInstances() {
    for (const key of [...this.instances.keys()]) this.removeInstance(key);
    this.turns.clear();
  }

  disposeSources() {
    for (const asset of new Set(this.sources.values())) asset.dispose();
    this.sources.clear();
    this.modelAssets.clear();
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.ready = false;
    this.stats.ready = false;
    this.disposeInstances();
    this.batchPool.dispose();
    this.disposeSources();
    this.scene.environment = null;
    this.environmentTarget?.dispose();
    this.environmentTarget = null;
    this.keyLight.shadow.map?.dispose();
    this.depthMesh.geometry.dispose();
    this.depthMaterial.dispose();
    this.renderer.dispose();
    this.failedAssets.clear();
    this.frames = [];
    this.present.clear();
  }
}

export { WholeEntityRenderer as EntityRenderer };
export default WholeEntityRenderer;
