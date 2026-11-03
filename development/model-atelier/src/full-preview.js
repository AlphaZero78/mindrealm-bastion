import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clone as cloneRig } from 'three/addons/utils/SkeletonUtils.js';

const $ = id => document.getElementById(id);
const assetRoot = './release/mindrealm-entity-pack/game/assets/game/models/';
const groupNames = {
  'base-frontier': '边境基础', 'noise-support': '噪声支援', 'memory-factory': '记忆工厂',
  'heavy-ground': '重装地面', 'signal-operations': '信号职能', 'elite-watch': '精英监察',
  'boss-frontier': '前线首领', 'boss-control': '统御首领', 'melee-towers': '近战建筑',
  'mixed-towers': '混合职能建筑', 'support-towers': '支援建筑', 'core-tower-variants': '核心建筑分支',
  'core-entities': '既有核心',
};
const actionNames = { idle: '待机', move: '行进', attack: '攻击', windup: '预警', release: '释放', ability: '专属能力', shutdown: '停机 / 消散' };
const loader = new GLTFLoader();
const modelCache = new Map();
const thumbnailCache = new Map();
const state = { records: [], selected: null, playing: true, speed: 1, wireframe: false, renderToken: 0, errors: [] };
const studio = {
  renderer: null, scene: null, camera: null, controls: null, root: null, mixer: null,
  action: null, actions: {}, materials: [], environment: null, resizeObserver: null,
  thumbnailRenderer: null, thumbnailScene: null, thumbnailCamera: null, thumbnailEnvironment: null,
};
let lastFrame = 0;

function modelPath(record) {
  return `${assetRoot}${record.id}/${record.variant}.glb`;
}

function loadModel(record) {
  const key = `${record.id}/${record.variant}`;
  if (!modelCache.has(key)) modelCache.set(key, loader.loadAsync(modelPath(record)));
  return modelCache.get(key);
}

function createRenderer(container, preserve = true) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: preserve, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  if (container) {
    renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight), false);
    container.prepend(renderer.domElement);
  }
  return renderer;
}

function environment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const texture = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  return texture;
}

function addStudioLights(scene, shadows = false) {
  scene.add(new THREE.HemisphereLight(0xd9f0e5, 0x202735, 1.25));
  const key = new THREE.DirectionalLight(0xf1f2df, 3.3);
  key.position.set(4, 8, -4);
  key.castShadow = shadows;
  if (shadows) {
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 24 });
    key.shadow.normalBias = 0.025;
  }
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8dbed3, 1.3);
  fill.position.set(-4, 3, 2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x7ee4ca, 1.8);
  rim.position.set(-1, 5, 5);
  scene.add(rim);
}

function fitCamera(camera, root, controls, detail = false) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const distance = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * (detail ? 1.1 : 0.72);
  camera.position.copy(center).addScaledVector(new THREE.Vector3(1.05, 0.72, -1.7).normalize(), distance);
  camera.lookAt(center);
  if (controls) {
    controls.target.copy(center);
    controls.update();
  }
}

function initThumbnailStudio() {
  if (studio.thumbnailRenderer) return;
  studio.thumbnailRenderer = createRenderer(null);
  studio.thumbnailRenderer.setSize(256, 256, false);
  studio.thumbnailRenderer.setClearColor(0x000000, 0);
  studio.thumbnailEnvironment = environment(studio.thumbnailRenderer);
  studio.thumbnailScene = new THREE.Scene();
  studio.thumbnailScene.environment = studio.thumbnailEnvironment;
  studio.thumbnailScene.environmentIntensity = 0.92;
  addStudioLights(studio.thumbnailScene);
  studio.thumbnailCamera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
}

async function thumbnail(record) {
  const key = `${record.id}/${record.variant}`;
  if (thumbnailCache.has(key)) return thumbnailCache.get(key);
  initThumbnailStudio();
  const gltf = await loadModel(record);
  const root = gltf.scene;
  const mixer = new THREE.AnimationMixer(root);
  const idle = gltf.animations.find(clip => clip.name === 'idle') || gltf.animations[0];
  mixer.clipAction(idle).play();
  mixer.update(0);
  studio.thumbnailScene.add(root);
  root.updateMatrixWorld(true);
  fitCamera(studio.thumbnailCamera, root, null);
  studio.thumbnailRenderer.render(studio.thumbnailScene, studio.thumbnailCamera);
  const image = studio.thumbnailRenderer.domElement.toDataURL('image/png');
  studio.thumbnailScene.remove(root);
  mixer.stopAllAction();
  mixer.uncacheRoot(root);
  thumbnailCache.set(key, image);
  return image;
}

function initDetailStudio() {
  const container = $('detail-viewer');
  studio.renderer = createRenderer(container);
  studio.renderer.shadowMap.enabled = true;
  studio.renderer.shadowMap.type = THREE.PCFShadowMap;
  studio.environment = environment(studio.renderer);
  studio.scene = new THREE.Scene();
  studio.scene.background = new THREE.Color(0x0e181c);
  studio.scene.fog = new THREE.Fog(0x0e181c, 15, 42);
  studio.scene.environment = studio.environment;
  studio.scene.environmentIntensity = 0.92;
  addStudioLights(studio.scene, true);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x162428, roughness: 0.92, metalness: 0.12 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.035;
  floor.receiveShadow = true;
  studio.scene.add(floor);
  const grid = new THREE.GridHelper(40, 80, 0x35584e, 0x273e40);
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  studio.scene.add(grid);
  studio.camera = new THREE.PerspectiveCamera(36, 1, 0.025, 120);
  studio.controls = new OrbitControls(studio.camera, studio.renderer.domElement);
  studio.controls.enableDamping = true;
  studio.controls.dampingFactor = 0.065;
  studio.controls.maxPolarAngle = Math.PI * 0.48;
  studio.controls.minDistance = 1.3;
  studio.controls.maxDistance = 40;
  studio.resizeObserver = new ResizeObserver(() => {
    studio.camera.aspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
    studio.camera.updateProjectionMatrix();
    studio.renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight), false);
  });
  studio.resizeObserver.observe(container);
}

function setAction(name) {
  if (!studio.mixer || !studio.actions[name]) return;
  const previous = studio.action;
  const next = studio.actions[name];
  if (previous && previous !== next && state.playing) previous.fadeOut(0.16);
  else studio.mixer.stopAllAction();
  next.reset();
  next.stopFading();
  next.setEffectiveWeight(1);
  next.setLoop(name === 'shutdown' ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
  next.clampWhenFinished = name === 'shutdown';
  if (state.playing && previous && previous !== next) next.fadeIn(0.16);
  next.play();
  studio.action = next;
  updatePlayButton();
}

function updatePlayButton() {
  $('play-toggle').textContent = state.playing ? '暂停' : '播放';
}

async function openDetail(record) {
  state.selected = record;
  state.playing = true;
  state.wireframe = false;
  $('wireframe-toggle').setAttribute('aria-pressed', 'false');
  $('detail-title').textContent = `${record.name} · ${record.variant}`;
  $('detail-code').textContent = `${record.id} / ${groupNames[record.group] || record.group}`;
  $('detail-description').textContent = '正在建立三维检视…';
  $('detail-mechanism').textContent = '';
  if (!$('detail-dialog').open) $('detail-dialog').showModal();
  if (!studio.renderer) initDetailStudio();
  if (studio.root) {
    studio.scene.remove(studio.root);
    studio.mixer?.stopAllAction();
    studio.materials.forEach(material => material.dispose());
  }
  const gltf = await loadModel(record);
  const root = cloneRig(gltf.scene);
  studio.materials = [];
  root.traverse(node => {
    if (!node.isMesh) return;
    node.material = node.material.clone();
    node.castShadow = !node.material.transparent;
    node.receiveShadow = true;
    studio.materials.push(node.material);
  });
  studio.root = root;
  studio.scene.add(root);
  studio.mixer = new THREE.AnimationMixer(root);
  studio.actions = Object.fromEntries(gltf.animations.map(clip => [clip.name, studio.mixer.clipAction(clip)]));
  $('detail-title').textContent = `${record.name} · ${record.variant}`;
  $('detail-code').textContent = `${record.id} / ${groupNames[record.group] || record.group}`;
  $('detail-description').textContent = record.mechanism || record.concept || '';
  $('detail-mechanism').textContent = `${record.role} · ${record.locomotion} · ${record.triangles.toLocaleString()} 三角面`;
  $('download-variant').href = modelPath(record);
  $('download-variant').download = `${record.id}__${record.variant}.glb`;
  $('action-select').replaceChildren(...gltf.animations.map(clip => {
    const option = document.createElement('option');
    option.value = clip.name;
    option.textContent = actionNames[clip.name] || clip.name;
    return option;
  }));
  $('action-select').value = 'idle';
  $('speed-select').value = String(state.speed);
  setAction('idle');
  fitCamera(studio.camera, root, studio.controls, true);
  const dialog = $('detail-dialog');
  if (!dialog.open) dialog.showModal();
  updatePlayButton();
}

function filteredRecords() {
  const query = $('search-input').value.trim().toLowerCase();
  return state.records.filter(record =>
    (!$('group-filter').value || record.group === $('group-filter').value) &&
    (!$('kind-filter').value || record.kind === $('kind-filter').value) &&
    (!$('variant-filter').value || record.variant === $('variant-filter').value) &&
    (!query || `${record.name} ${record.id} ${record.group}`.toLowerCase().includes(query)),
  );
}

async function renderCards() {
  const token = ++state.renderToken;
  const records = filteredRecords();
  $('review-grid').replaceChildren(...records.map(record => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'entity-card';
    card.dataset.kind = record.kind;
    card.setAttribute('aria-label', `查看 ${record.name} ${record.variant}`);
    card.innerHTML = `<img alt="${record.name} ${record.variant}" loading="lazy"><figcaption><span class="entity-name">${record.name}</span><span class="entity-meta"><span>${record.variant}</span><span>${record.role}</span></span><span class="entity-group">${groupNames[record.group] || record.group} · ${record.id}</span></figcaption>`;
    card.addEventListener('click', () => openDetail(record).catch(error => showError(error)));
    return card;
  }));
  let completed = 0;
  const queue = [...records];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const record = queue.shift();
      const index = records.indexOf(record);
      try {
        const image = await thumbnail(record);
        if (token !== state.renderToken) return;
        const card = $('review-grid').children[index];
        card.querySelector('img').src = image;
      } catch (error) {
        state.errors.push({ id: record.id, variant: record.variant, message: error.message });
        if (token === state.renderToken) $('review-grid').children[index].classList.add('error');
      }
      completed++;
      if (token === state.renderToken) $('review-status').textContent = `${records.length} 个外观 · ${completed} 已渲染`;
    }
  });
  await Promise.all(workers);
  if (token === state.renderToken) {
    $('review-status').textContent = `${records.length} 个外观 · 全部已渲染`;
    $('engine-status').textContent = state.errors.length ? `LOCAL / ${state.errors.length} ERRORS` : 'LOCAL / ALL RENDERED';
  }
}

function showError(error) {
  console.error(error);
  state.errors.push({ id: state.selected?.id, variant: state.selected?.variant, message: error.message });
  $('review-status').textContent = `加载失败：${error.message}`;
  $('engine-status').textContent = 'LOCAL / ERROR';
  if ($('detail-dialog').open) $('detail-description').textContent = `加载失败：${error.message}`;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.08, (now - (lastFrame || now)) / 1000);
  lastFrame = now;
  if (studio.root && studio.mixer && state.playing) studio.mixer.update(dt * state.speed);
  if (studio.root && studio.renderer && $('detail-dialog').open) {
    studio.controls.update();
    studio.renderer.render(studio.scene, studio.camera);
    if (studio.action) {
      const clip = studio.action.getClip();
      $('action-time').value = Math.round(studio.action.time / clip.duration * 1000);
    }
  }
}

async function init() {
  const response = await fetch(`${assetRoot}catalog.json`);
  if (!response.ok) throw new Error(`模型清单不可用 (${response.status})`);
  const catalog = await response.json();
  state.records = catalog.entities.flatMap(entity => entity.variants.map(variant => ({ ...entity, ...variant, group: entity.group || 'core-entities' })));
  $('variant-count').textContent = state.records.length;
  const groups = [...new Set(state.records.map(record => record.group))];
  $('group-filter').append(...groups.map(group => {
    const option = document.createElement('option');
    option.value = group;
    option.textContent = groupNames[group] || group;
    return option;
  }));
  const filters = new URLSearchParams(location.search);
  for (const id of ['group', 'kind', 'variant']) {
    const value = filters.get(id);
    const select = $(`${id}-filter`);
    if ([...select.options].some(option => option.value === value)) select.value = value;
  }
  for (const id of ['group-filter', 'kind-filter', 'variant-filter']) $(id).addEventListener('change', renderCards);
  $('search-input').addEventListener('input', renderCards);
  $('action-select').addEventListener('change', event => setAction(event.target.value));
  $('play-toggle').addEventListener('click', () => { state.playing = !state.playing; updatePlayButton(); });
  $('speed-select').addEventListener('change', event => { state.speed = Number(event.target.value); });
  $('action-time').addEventListener('input', event => {
    if (!studio.action) return;
    studio.action.paused = false;
    studio.action.time = studio.action.getClip().duration * Number(event.target.value) / 1000;
    studio.mixer.update(0);
  });
  $('wireframe-toggle').addEventListener('click', () => {
    state.wireframe = !state.wireframe;
    studio.root?.traverse(node => { if (node.isMesh) node.material.wireframe = state.wireframe; });
    $('wireframe-toggle').setAttribute('aria-pressed', String(state.wireframe));
  });
  $('close-detail').addEventListener('click', () => $('detail-dialog').close());
  $('detail-dialog').addEventListener('click', event => {
    if (event.target === $('detail-dialog')) {
      const rect = $('detail-dialog').getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('detail-dialog').close();
    }
  });
  $('detail-dialog').addEventListener('close', () => { state.playing = false; });
  window.fullReview = { records: state.records, errors: state.errors, ready: false, thumbnail, openDetail };
  await renderCards();
  window.fullReview.ready = true;
  requestAnimationFrame(frame);
}

init().catch(showError);
