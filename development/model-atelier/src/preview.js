import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ENTITIES } from './catalog.js';

const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const state = {
  ready: false, mode: 'overview', selectedId: ENTITIES[0].id,
  playing: !matchMedia('(prefers-reduced-motion: reduce)').matches,
  speed: 1, wireframe: false, grid: true, rotate: false,
  assets: new Map(), manifest: new Map(),
};
let scene, camera, renderer, controls, modelLayer, stageGroup, gridHelper, accentLight;
let environment, stageMaterials;
const loader = new GLTFLoader();

const fallbackIcons = {
  memory_runner: '<path d="M8 8h16v12H8zM11 20 7 30m14-10 3 10M10 30h-6m21 0h5M12 8V4h10v4M12 13h6"/>',
  repair_skiff: '<path d="M13 12C4 12 2 22 3 27c5-1 9-4 11-9m7-6c9 0 11 10 10 15-5-1-9-4-11-9M17 6v16m-4-9 4-4 4 4M9 28l6-5m10 5-6-5"/>',
  null_wing: '<path d="m17 5 5 10-5 10-5-10ZM5 12l8 3m14 0-8 3M5 19l8-2m14 0-8 2M9 27a10 10 0 0 1 16 0M9 6a10 10 0 0 1 16 0"/>',
  focus_rail: '<circle cx="16" cy="15" r="8"/><circle cx="16" cy="15" r="5"/><path d="M14 7V3m4 4V3M14 27v-8m4 8v-8M16 10v10m-6-5h12M8 29l-3 3m19-3 3 3"/>',
  arc_mortar: '<path d="M8 12c0 12 16 12 16 0M7 12h18M16 20v8m-5 0h10M16 4v4M6 4l3 3m17-3-3 3"/><circle cx="16" cy="9" r="3"/>',
  resistance_beacon: '<path d="m16 6 4 8-4 8-4-8ZM9 10c-6 7-5 13-1 17m15-17c6 7 5 13 1 17M10 29h12M8 12l3 9-3 5m16-14-3 9 3 5"/>',
};

function icon(id) {
  return `<svg class="thumb-fallback" viewBox="0 0 34 34" fill="none" aria-hidden="true">${fallbackIcons[id]}</svg>`;
}

function renderLibrary() {
  $('entity-list').replaceChildren();
  for (const entity of ENTITIES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'entity-card';
    button.dataset.entity = entity.id;
    button.dataset.kind = entity.kind;
    button.setAttribute('aria-label', `查看${entity.name}`);
    button.innerHTML = `<span class="thumb-shell">${icon(entity.id)}<img alt="" data-thumbnail="${entity.id}"></span><span class="entity-card-text"><span class="card-code">${entity.code}</span><strong>${entity.name}</strong><small>${entity.english}</small></span><svg class="card-chevron" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="m4 3 4 4-4 4"/></svg>`;
    button.addEventListener('click', () => selectEntity(entity.id));
    $('entity-list').append(button);
  }
}

function renderDetails() {
  const entity = ENTITIES.find(item => item.id === state.selectedId);
  const asset = state.assets.get(entity.id);
  const friendly = entity.kind === 'building';
  $('entity-code').textContent = entity.code;
  $('entity-code').classList.toggle('friendly', friendly);
  $('entity-kind').textContent = entity.kindLabel;
  $('entity-kind').classList.toggle('friendly', friendly);
  $('entity-name').textContent = entity.name;
  $('entity-role').textContent = entity.role;
  $('entity-concept').textContent = entity.concept;
  $('entity-design').textContent = entity.design;
  $('entity-mechanism').textContent = entity.mechanism;
  $('entity-act').textContent = entity.act;
  $('entity-materials').textContent = entity.materials;
  const stats = state.manifest.get(entity.id);
  $('entity-geometry').textContent = `${(stats.triangles / 1000).toFixed(1)}K 三角面 · ${stats.joints} 组活动关节`;
  $('entity-tags').replaceChildren(...entity.tags.map(tag => {
    const span = document.createElement('span');
    span.textContent = tag;
    return span;
  }));
  $('action-list').replaceChildren(...entity.actions.map((action, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = action.id;
    button.setAttribute('aria-pressed', String(asset?.clipId === action.id));
    button.innerHTML = `<span class="action-index">0${index + 1}</span>${action.label}`;
    button.addEventListener('click', () => selectClip(action.id));
    return button;
  }));
  $('download-model').href = `./models/${entity.id}.glb`;
  $('download-model').download = `${entity.id}.glb`;
  $('download-model').setAttribute('aria-label', `下载${entity.name}的 GLB 模型`);
  document.querySelectorAll('.entity-card').forEach(card => card.classList.toggle('active', card.dataset.entity === entity.id));
  updateActionUI();
}

function updateActionUI() {
  const entity = ENTITIES.find(item => item.id === state.selectedId);
  const asset = state.assets.get(entity.id);
  const action = entity.actions.find(item => item.id === asset?.clipId) || entity.actions[0];
  $('action-label').textContent = action.label;
  $('action-english').textContent = action.english;
  $('action-detail').textContent = action.detail;
  $('action-loop').textContent = action.id === 'shutdown' ? '单次' : '循环';
  document.querySelectorAll('[data-action]').forEach(button => {
    const active = button.dataset.action === action.id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $('animation-scope').textContent = state.mode === 'overview' ? '阵容同步' : '当前单体';
  updateSceneStatus();
}

function updateViewUI() {
  const entity = ENTITIES.find(item => item.id === state.selectedId);
  const overview = state.mode === 'overview';
  $('view-kicker').textContent = overview ? 'ENSEMBLE / 06' : `${entity.code} / ${entity.kind === 'monster' ? 'HOSTILE SIGNAL' : 'MIND CONSTRUCT'}`;
  $('view-title').textContent = overview ? '失控信号 × 心智构造' : entity.name;
  $('view-subtitle').textContent = overview ? 'SIX ORIGINAL ENTITIES' : entity.english;
  $('detail-view').setAttribute('aria-pressed', String(!overview));
  $('overview-view').setAttribute('aria-pressed', String(overview));
  if (overview) {
    const triangles = [...state.manifest.values()].reduce((sum, item) => sum + item.triangles, 0);
    $('geometry-stats').textContent = `${(triangles / 1000).toFixed(1)}K TRI / 6 GLB`;
  } else {
    const stats = state.manifest.get(entity.id);
    $('geometry-stats').textContent = `${stats.triangles.toLocaleString()} TRI / ${stats.meshes} MESH`;
  }
  updateActionUI();
}

function updatePlayUI() {
  $('play-icon').innerHTML = state.playing ? '<path d="M6 4v12M14 4v12"/>' : '<path d="m6 3 10 7-10 7Z"/>';
  $('play-toggle').querySelector('span').textContent = state.playing ? '暂停' : '播放';
  $('play-toggle').setAttribute('aria-label', state.playing ? '暂停动作' : '播放动作');
  updateSceneStatus();
}

function updateSceneStatus() {
  if (!state.ready) return;
  const entity = ENTITIES.find(item => item.id === state.selectedId);
  const action = entity.actions.find(item => item.id === state.assets.get(entity.id)?.clipId);
  $('scene-status').textContent = !state.playing ? '动作时钟已暂停'
    : state.mode === 'overview' ? '阵容巡航 · 6 实体在线'
    : `${action.label} · 实时关节驱动`;
}

function updateTimeline() {
  if (!state.ready) return;
  const asset = state.assets.get(state.selectedId);
  if (!asset?.current) return;
  const clip = asset.current.getClip();
  const ratio = Math.min(1, asset.current.time / clip.duration);
  $('timeline').value = Math.round(ratio * 1000);
  $('timeline').style.setProperty('--value', `${ratio * 100}%`);
  $('time-current').textContent = `${asset.current.time.toFixed(2)} s`;
  $('time-duration').textContent = `${clip.duration.toFixed(2)} s`;
}

function createScene() {
  const viewport = $('viewport');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e181c);
  scene.fog = new THREE.Fog(0x0e181c, 19, 58);
  camera = new THREE.PerspectiveCamera(36, 1, 0.05, 100);
  camera.position.set(4, 3, -6);
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(Math.max(1, viewport.clientWidth), Math.max(1, viewport.clientHeight), false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '三维模型：拖动旋转，滚轮缩放，右键平移');
  viewport.prepend(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  environment = pmrem.fromScene(room, 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.90;
  scene.environmentRotation.y = 0.4;
  room.dispose();
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xd4eee7, 0x1b2430, 1.45));
  const key = new THREE.DirectionalLight(0xf0f3df, 3.5);
  key.position.set(4, 8, -4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 28 });
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.025;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x92bbd4, 1.65);
  fill.position.set(-5, 3, -2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x84e6d0, 2.4);
  rim.position.set(-2, 5, 5);
  scene.add(rim);
  accentLight = new THREE.PointLight(0x69efd0, 10, 9, 2);
  accentLight.position.set(-2.5, 2.4, -2);
  scene.add(accentLight);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x111c20, metalness: 0.12, roughness: 0.93 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.085;
  floor.receiveShadow = true;
  scene.add(floor);
  gridHelper = new THREE.GridHelper(70, 140, 0x3a6158, 0x293f42);
  gridHelper.position.y = -0.078;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.32;
  gridHelper.material.depthWrite = false;
  scene.add(gridHelper);
  modelLayer = new THREE.Group();
  modelLayer.name = 'Preview_entities';
  stageGroup = new THREE.Group();
  stageGroup.name = 'Preview_plinths';
  scene.add(modelLayer, stageGroup);
  stageMaterials = {
    base: new THREE.MeshStandardMaterial({ color: 0x1c2a2e, metalness: 0.74, roughness: 0.42 }),
    edge: new THREE.MeshStandardMaterial({ color: 0x31464a, metalness: 0.80, roughness: 0.38 }),
    enemy: new THREE.MeshBasicMaterial({ color: 0xbb7168, transparent: true, opacity: 0.64 }),
    building: new THREE.MeshBasicMaterial({ color: 0x68bba4, transparent: true, opacity: 0.64 }),
    ticks: new THREE.LineBasicMaterial({ color: 0x527c70, transparent: true, opacity: 0.40 }),
  };

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 1.5;
  controls.maxDistance = 34;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.8;
  controls.panSpeed = 0.65;
  controls.autoRotateSpeed = 0.70;
  controls.update();
  const resize = () => {
    const width = Math.max(1, viewport.clientWidth), height = Math.max(1, viewport.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  new ResizeObserver(resize).observe(viewport);
  resize();
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    showError(new Error('WebGL 上下文已中断，请重新加载预览。'));
  });
}

function labelSprite(entity) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.textAlign = 'center';
  context.fillStyle = entity.kind === 'monster' ? '#d59a8d' : '#add4c2';
  context.font = '500 41px "Microsoft YaHei", sans-serif';
  context.fillText(entity.name, 256, 56);
  context.fillStyle = '#6b8884';
  context.font = '17px Consolas, monospace';
  context.fillText(`${entity.code}  /  ${entity.english}`, 256, 92);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.92 });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.7, 0.425, 1);
  return sprite;
}

function makePlatform(x, z, entity, radius, label) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.035, 0.08, 64), stageMaterials.base);
  base.position.y = -0.035;
  base.receiveShadow = true;
  group.add(base);
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.025, radius * 1.055, 0.028, 64), stageMaterials.edge);
  lower.position.y = -0.075;
  group.add(lower);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.94, 0.008, 6, 96), stageMaterials[entity.kind === 'monster' ? 'enemy' : 'building']);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.009;
  group.add(ring);
  const vertices = [];
  for (let i = 0; i < 48; i++) {
    const angle = i * TAU / 48;
    const inner = radius * (i % 4 === 0 ? 0.79 : 0.84), outer = radius * 0.88;
    vertices.push(Math.sin(angle) * inner, 0.012, Math.cos(angle) * inner, Math.sin(angle) * outer, 0.012, Math.cos(angle) * outer);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  group.add(new THREE.LineSegments(geometry, stageMaterials.ticks));
  if (label) {
    const sprite = labelSprite(entity);
    sprite.position.set(0, 0.11, -radius - 0.12);
    group.add(sprite);
  }
  stageGroup.add(group);
}

function clearStage() {
  stageGroup.traverse(node => {
    node.geometry?.dispose();
    if (node.isSprite) {
      node.material.map?.dispose();
      node.material.dispose();
    }
  });
  stageGroup.clear();
}

function fitCamera() {
  if (!state.ready) return;
  modelLayer.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  for (const asset of visibleAssets()) bounds.expandByObject(asset.root);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  center.y += state.mode === 'overview' ? 0.05 : 0.10;
  const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
  const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
  const distance = sphere.radius / Math.sin(Math.min(vertical, horizontal)) * (state.mode === 'overview' ? 1.09 : 0.99);
  const direction = new THREE.Vector3(state.mode === 'overview' ? 0.85 : 1.10, state.mode === 'overview' ? 0.88 : 0.76, -1.8).normalize();
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.near = Math.max(0.025, distance / 150);
  camera.far = Math.max(100, distance * 5);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

function visibleAssets() {
  return state.mode === 'overview' ? ENTITIES.map(entity => state.assets.get(entity.id)).filter(Boolean) : [state.assets.get(state.selectedId)].filter(Boolean);
}

function setMode(mode) {
  if (!state.ready) return;
  state.mode = mode;
  modelLayer.clear();
  clearStage();
  if (mode === 'overview') {
    ENTITIES.forEach((entity, index) => {
      const asset = state.assets.get(entity.id);
      const row = index < 3 ? 1 : -1;
      const column = index % 3;
      asset.root.position.set((column - 1) * 2.38, 0.015, row * 1.30);
      asset.root.rotation.set(0, (column - 1) * -0.10, 0);
      modelLayer.add(asset.root);
      makePlatform(asset.root.position.x, asset.root.position.z, entity, 1.04, true);
    });
    accentLight.color.setHex(0x69efd0);
  } else {
    const entity = ENTITIES.find(item => item.id === state.selectedId);
    const asset = state.assets.get(entity.id);
    asset.root.position.set(0, 0.015, 0);
    asset.root.rotation.set(0, 0, 0);
    modelLayer.add(asset.root);
    makePlatform(0, 0, entity, 1.34, false);
    const outer = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.004, 4, 128), stageMaterials[entity.kind === 'monster' ? 'enemy' : 'building']);
    outer.rotation.x = Math.PI / 2;
    outer.position.y = -0.070;
    stageGroup.add(outer);
    accentLight.color.setHex(entity.kind === 'monster' ? 0xff7469 : 0x69efd0);
  }
  gridHelper.visible = state.grid;
  fitCamera();
  updateViewUI();
}

function selectEntity(id) {
  if (!state.ready) return;
  state.selectedId = id;
  renderDetails();
  setMode('detail');
}

function playClip(asset, id, immediate = false) {
  const next = asset.actions[id];
  if (!next) return;
  const instant = immediate || !state.playing;
  if (instant) asset.mixer.stopAllAction();
  else if (asset.current && asset.current !== next) asset.current.fadeOut(0.16);
  next.reset();
  next.stopFading();
  next.setEffectiveWeight(1);
  next.setLoop(id === 'shutdown' ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
  next.clampWhenFinished = id === 'shutdown';
  if (!instant) next.fadeIn(0.16);
  next.play();
  asset.current = next;
  asset.clipId = id;
  if (instant) asset.mixer.update(0);
}

function selectClip(id) {
  if (!state.ready) return;
  for (const asset of visibleAssets()) playClip(asset, id);
  updateActionUI();
  updateTimeline();
}

function selectEntityThumbnail(id, data) {
  const image = document.querySelector(`[data-thumbnail="${id}"]`);
  if (!image) return;
  image.addEventListener('load', () => {
    image.classList.add('loaded');
    image.parentElement.querySelector('svg').style.opacity = '0';
  }, { once: true });
  image.src = data;
}

function makeThumbnails() {
  const thumbRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  thumbRenderer.setSize(192, 192);
  thumbRenderer.setPixelRatio(1);
  thumbRenderer.setClearColor(0x000000, 0);
  thumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  thumbRenderer.toneMappingExposure = 1.12;
  const thumbScene = new THREE.Scene();
  thumbScene.environment = environment;
  thumbScene.environmentIntensity = 1.0;
  thumbScene.add(new THREE.HemisphereLight(0xe1f4e9, 0x2b2533, 1.65));
  const light = new THREE.DirectionalLight(0xf2f3e4, 3.6);
  light.position.set(3, 5, -4);
  thumbScene.add(light);
  const rim = new THREE.DirectionalLight(0x85d5c9, 1.9);
  rim.position.set(-3, 2, 3);
  thumbScene.add(rim);
  const thumbCamera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
  for (const asset of state.assets.values()) {
    thumbScene.add(asset.root);
    asset.mixer.update(0.12);
    asset.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(asset.root);
    const center = bounds.getCenter(new THREE.Vector3());
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    thumbCamera.position.copy(center).addScaledVector(new THREE.Vector3(1.0, 0.7, -1.7).normalize(), sphere.radius / Math.sin(THREE.MathUtils.degToRad(17)) * 1.03);
    thumbCamera.lookAt(center);
    thumbRenderer.render(thumbScene, thumbCamera);
    selectEntityThumbnail(asset.entity.id, thumbRenderer.domElement.toDataURL('image/png'));
    thumbScene.remove(asset.root);
  }
  thumbRenderer.dispose();
}

async function loadModels() {
  const response = await fetch('./models/manifest.json');
  if (!response.ok) throw new Error(`模型清单加载失败 (${response.status})，请先运行 npm run build。`);
  const manifest = await response.json();
  if (manifest.models?.length !== 6) throw new Error('模型清单不完整，需要六件原创模型。');
  manifest.models.forEach(item => state.manifest.set(item.id, item));
  let completed = 0;
  await Promise.all(ENTITIES.map(async entity => {
    const stats = state.manifest.get(entity.id);
    if (!stats) throw new Error(`模型清单缺少 ${entity.name}`);
    let gltf;
    try {
      gltf = await loader.loadAsync(`./models/${stats.file}`);
    } catch {
      throw new Error(`${entity.name} 的 GLB 无法加载，请重新生成模型。`);
    }
    if (gltf.animations.length !== 4) throw new Error(`${entity.name} 未包含四套动作。`);
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const actions = Object.fromEntries(gltf.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
    const asset = { entity, root: gltf.scene, mixer, actions, current: null, clipId: 'idle' };
    gltf.scene.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = !node.material.transparent;
      node.receiveShadow = true;
      node.material.envMapIntensity = 1.0;
    });
    mixer.addEventListener('finished', () => {
      if (visibleAssets().every(item => item.current?.paused)) {
        state.playing = false;
        updatePlayUI();
      }
    });
    state.assets.set(entity.id, asset);
    playClip(asset, 'idle', true);
    completed++;
    $('load-progress').textContent = `已装载 ${completed} / 6 件模型 · ${entity.name}`;
    $('load-bar').style.width = `${completed / 6 * 100}%`;
  }));
  $('load-progress').textContent = '正在生成模型缩略图…';
  makeThumbnails();
  state.ready = true;
  renderDetails();
  setMode('overview');
  updatePlayUI();
  updateTimeline();
  $('timeline').disabled = false;
  $('engine-status').textContent = 'LOCAL / r186 / 24 CLIPS';
  document.body.dataset.ready = 'true';
  await renderer.compileAsync(scene, camera);
  $('loading').classList.add('is-done');
}

function togglePlay() {
  if (!state.ready) return;
  if (!state.playing && visibleAssets().every(asset => asset.current?.paused)) {
    for (const asset of visibleAssets()) playClip(asset, asset.clipId, true);
  }
  state.playing = !state.playing;
  updatePlayUI();
}

function restart() {
  for (const asset of visibleAssets()) playClip(asset, asset.clipId, true);
  updateTimeline();
}

function toggleWireframe() {
  state.wireframe = !state.wireframe;
  for (const asset of state.assets.values()) asset.root.traverse(node => {
    if (node.isMesh) node.material.wireframe = state.wireframe;
  });
  $('toggle-wireframe').setAttribute('aria-pressed', String(state.wireframe));
}

function saveSnapshot() {
  if (!state.ready) return;
  renderer.render(scene, camera);
  renderer.domElement.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mindrealm-${state.mode}-${Date.now()}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }, 'image/png');
}

function showError(error) {
  console.error('[atelier]', error);
  $('loading').classList.add('is-done');
  $('error-panel').hidden = false;
  $('error-message').textContent = `${error?.message || error} 请通过本地服务器打开预览。`;
  $('engine-status').textContent = 'LOCAL / ERROR';
  $('scene-status').textContent = '观测台未完成初始化';
}

function bindUI() {
  $('detail-view').addEventListener('click', () => setMode('detail'));
  $('overview-view').addEventListener('click', () => setMode('overview'));
  $('reset-view').addEventListener('click', fitCamera);
  $('toggle-grid').addEventListener('click', () => {
    state.grid = !state.grid;
    gridHelper.visible = state.grid;
    $('toggle-grid').setAttribute('aria-pressed', String(state.grid));
  });
  $('toggle-wireframe').addEventListener('click', toggleWireframe);
  $('toggle-rotate').addEventListener('click', () => {
    state.rotate = !state.rotate;
    controls.autoRotate = state.rotate;
    $('toggle-rotate').setAttribute('aria-pressed', String(state.rotate));
  });
  $('snapshot').addEventListener('click', saveSnapshot);
  $('play-toggle').addEventListener('click', togglePlay);
  $('restart').addEventListener('click', restart);
  $('next-action').addEventListener('click', () => {
    const entity = ENTITIES.find(item => item.id === state.selectedId);
    const index = entity.actions.findIndex(action => action.id === state.assets.get(entity.id)?.clipId);
    selectClip(entity.actions[(index + 1) % entity.actions.length].id);
  });
  $('timeline').addEventListener('input', event => {
    const ratio = Number(event.target.value) / 1000;
    for (const asset of visibleAssets()) {
      if (!asset.current) continue;
      asset.current.paused = false;
      asset.current.time = ratio * asset.current.getClip().duration;
      asset.mixer.update(0);
    }
    updateTimeline();
  });
  $('speed-controls').addEventListener('click', event => {
    const button = event.target.closest('[data-speed]');
    if (!button) return;
    state.speed = Number(button.dataset.speed);
    document.querySelectorAll('[data-speed]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  });
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    document.querySelectorAll('.entity-card').forEach(card => { card.hidden = button.dataset.filter !== 'all' && card.dataset.kind !== button.dataset.filter; });
  }));
  const dialog = $('about-dialog');
  $('about-button').addEventListener('click', () => dialog.showModal());
  $('close-about').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  $('retry').addEventListener('click', () => location.reload());
  window.addEventListener('keydown', event => {
    if (!state.ready || dialog.open || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, button, a')) return;
    if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
    if (event.code === 'KeyF') fitCamera();
    if (event.code === 'KeyG') $('toggle-grid').click();
    if (event.code === 'KeyW') toggleWireframe();
    if (/^Digit[1-4]$/.test(event.code)) {
      const entity = ENTITIES.find(item => item.id === state.selectedId);
      selectClip(entity.actions[Number(event.code.at(-1)) - 1].id);
    }
  });
  window.addEventListener('error', event => showError(event.error || new Error(event.message)));
  window.addEventListener('unhandledrejection', event => showError(event.reason));
}

function frame(now) {
  requestAnimationFrame(frame);
  const delta = Math.min(0.08, Math.max(0, (now - (frame.previous || now)) / 1000));
  frame.previous = now;
  if (state.ready && state.playing) {
    for (const asset of state.assets.values()) asset.mixer.update(delta * state.speed);
  }
  controls.update();
  renderer.render(scene, camera);
  updateTimeline();
}

async function init() {
  renderLibrary();
  bindUI();
  createScene();
  requestAnimationFrame(frame);
  await loadModels();
}

window.atelier = {
  get ready() { return state.ready; },
  getState: () => ({ mode: state.mode, selectedId: state.selectedId, playing: state.playing, speed: state.speed, wireframe: state.wireframe, grid: state.grid, models: state.assets.size }),
  getAnimationState: id => {
    const asset = state.assets.get(id || state.selectedId);
    return asset ? { clip: asset.clipId, time: asset.current.time, duration: asset.current.getClip().duration, paused: asset.current.paused } : null;
  },
  getModelStats: () => [...state.manifest.values()],
};

init().catch(showError);
