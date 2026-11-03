import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clone as cloneRig } from 'three/addons/utils/SkeletonUtils.js';
import { CombatEffects } from './combat-effects.js';
import { RULES, TOWERS, ENCOUNTERS, attackDamage, railTarget, mortarTarget, splashTargets, pressureAtDeath, distanceXZ, formatTime, turnAngle } from './combat-rules.js';

const $ = id => document.getElementById(id);
const clamp = value => Math.max(0, Math.min(1, value));
const state = {
  ready: false, playing: true, auto: true, speed: 1, time: 0, spirit: 100,
  beacon: true, paths: true, selectedKey: null, finished: false, finishedAt: 0,
  shots: 0, hits: 0, damage: 0,
};
const sources = new Map();
const actors = [];
const towers = [];
const logEntries = [];
let scene, camera, renderer, controls, effects, actorGroup, towerGroup, core, coreLight;
let lastFrame = 0;
const loader = new GLTFLoader();
const towerPositions = {
  focus_rail: new THREE.Vector3(-3.05, 0.62, 1.95),
  arc_mortar: new THREE.Vector3(3.05, 0.62, -1.05),
  resistance_beacon: new THREE.Vector3(2.65, 0.14, -3.35),
};

function showError(error) {
  console.error('[combat-atelier]', error);
  $('combat-loading').classList.add('is-done');
  $('combat-error').hidden = false;
  $('combat-error-text').textContent = error?.message || String(error);
  $('engine-status').textContent = 'LOCAL / ERROR';
}

function addLog(text, tone = 'normal') {
  logEntries.unshift({ time: state.time, text, tone });
  if (logEntries.length > 7) logEntries.length = 7;
  $('battle-log').replaceChildren(...logEntries.map(entry => {
    const item = document.createElement('li');
    item.className = entry.tone;
    const time = document.createElement('time');
    time.textContent = formatTime(entry.time);
    const span = document.createElement('span');
    span.textContent = entry.text;
    item.append(time, span);
    return item;
  }));
}

function prepareModel(source, training = false) {
  const root = cloneRig(source.root);
  const materials = new Set();
  root.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = !node.material.transparent;
    node.receiveShadow = true;
    node.material = node.material.clone();
    node.material.envMapIntensity = 0.95;
    if (training) node.material.color.lerp(new THREE.Color(0x8ab7aa), 0.20);
    materials.add(node.material);
  });
  const materialStates = [...materials].map(material => ({
    material,
    color: material.color.clone(),
    emissive: material.emissive?.clone() || null,
    intensity: material.emissiveIntensity || 0,
    opacity: material.opacity,
    transparent: material.transparent,
    depthWrite: material.depthWrite,
  }));
  const mixer = new THREE.AnimationMixer(root);
  const actions = Object.fromEntries(source.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
  return { root, mixer, actions, materialStates, current: null, clipId: null };
}

function play(animated, id, once = false) {
  const next = animated.actions[id];
  if (!next) return;
  const instant = once || !state.playing;
  if (instant) animated.mixer.stopAllAction();
  else if (animated.current && animated.current !== next) animated.current.fadeOut(0.16);
  next.reset();
  next.stopFading();
  next.setEffectiveWeight(1);
  next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
  next.clampWhenFinished = once;
  if (!instant) next.fadeIn(0.16);
  next.play();
  animated.current = next;
  animated.clipId = id;
  animated.mixer.update(0);
}

function createScene() {
  const viewport = $('combat-viewport');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d171c);
  scene.fog = new THREE.Fog(0x0d171c, 22, 52);
  camera = new THREE.PerspectiveCamera(41, 1, 0.05, 100);
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(Math.max(1, viewport.clientWidth), Math.max(1, viewport.clientHeight), false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '建筑攻击怪物实战预览，拖动旋转，滚轮缩放，点击怪物锁定');
  viewport.prepend(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.78;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xcce8e0, 0x19232e, 1.15));
  const key = new THREE.DirectionalLight(0xf0eedb, 3.0);
  key.position.set(3, 10, -4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.5, far: 35 });
  key.shadow.normalBias = 0.025;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x87b4d1, 1.3);
  fill.position.set(-5, 4, 3);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x74dfc9, 1.7);
  rim.position.set(1, 5, 7);
  scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x111d22, roughness: 0.95, metalness: 0.08 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.16;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(50, 100, 0x35514d, 0x253b3f);
  grid.position.y = -0.145;
  grid.material.transparent = true;
  grid.material.opacity = 0.28;
  scene.add(grid);
  const arena = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.16, 17.2), new THREE.MeshStandardMaterial({ color: 0x1b2b2e, roughness: 0.8, metalness: 0.35 }));
  arena.position.set(0, -0.065, 2.85);
  arena.receiveShadow = true;
  scene.add(arena);
  const lane = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.06, 16.8), new THREE.MeshStandardMaterial({ color: 0x24393a, roughness: 0.75, metalness: 0.35 }));
  lane.position.set(0, 0.025, 2.75);
  lane.receiveShadow = true;
  scene.add(lane);
  const markings = [];
  for (const x of [-2.22, 0, 2.22]) {
    for (let z = -4.8; z < 10.7; z += 0.72) markings.push(x, 0.065, z, x, 0.065, z + 0.27);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(markings, 3));
  scene.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x517c70, transparent: true, opacity: 0.44 })));
  for (const [id, position] of Object.entries(towerPositions)) {
    const isBeacon = id === 'resistance_beacon';
    const height = isBeacon ? 0.13 : 0.54;
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.14, height, 8), new THREE.MeshStandardMaterial({ color: 0x30484a, metalness: 0.65, roughness: 0.4 }));
    platform.position.set(position.x, height / 2, position.z);
    platform.castShadow = true;
    platform.receiveShadow = true;
    scene.add(platform);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.015, 6, 64), new THREE.MeshBasicMaterial({ color: 0x69b5a3, transparent: true, opacity: 0.6 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(position.x, height + 0.01, position.z);
    scene.add(ring);
  }
  core = new THREE.Group();
  core.position.set(0, 0.13, -4.65);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.67, 0.80, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0x37514a, metalness: 0.72, roughness: 0.35 }));
  core.add(pedestal);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.31), new THREE.MeshStandardMaterial({ color: 0xffd393, emissive: 0xffa747, emissiveIntensity: 1.3, metalness: 0.22, roughness: 0.22 }));
  crystal.position.y = 0.68;
  crystal.scale.set(0.75, 1.6, 0.75);
  crystal.name = 'Wakeful_fire';
  core.add(crystal);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.022, 8, 64), new THREE.MeshBasicMaterial({ color: 0xf1d69a, transparent: true, opacity: 0.7 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.25;
  core.add(ring);
  coreLight = new THREE.PointLight(0xffc172, 5, 5, 2);
  coreLight.position.y = 0.8;
  core.add(coreLight);
  scene.add(core);
  actorGroup = new THREE.Group();
  towerGroup = new THREE.Group();
  scene.add(actorGroup, towerGroup);
  effects = new CombatEffects(scene, camera, $('combat-floats'));
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 5;
  controls.maxDistance = 34;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minPolarAngle = 0.14;
  controls.target.set(0, 0.65, 0.65);
  resetCamera();
  new ResizeObserver(() => {
    camera.aspect = Math.max(1, viewport.clientWidth) / Math.max(1, viewport.clientHeight);
    camera.updateProjectionMatrix();
    renderer.setSize(Math.max(1, viewport.clientWidth), Math.max(1, viewport.clientHeight), false);
  }).observe(viewport);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    showError(new Error('WebGL 上下文已中断，请重新加载实战预览。'));
  });
}

function resetCamera() {
  const viewport = $('combat-viewport');
  const aspect = Math.max(1, viewport.clientWidth) / Math.max(1, viewport.clientHeight);
  const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
  const target = new THREE.Vector3(0, 1.05, 2.1);
  const direction = new THREE.Vector3(0.55, 0.68, -1.05).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const bounds = new THREE.Box3(new THREE.Vector3(-4.7, -0.2, -5.8), new THREE.Vector3(4.7, 6.2, 10.9));
  let distance = 8;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const corner = new THREE.Vector3(x, y, z).sub(target);
    const forward = corner.dot(direction);
    distance = Math.max(distance,
      forward + Math.abs(corner.dot(right)) / (Math.tan(vertical) * aspect) + 0.75,
      forward + Math.abs(corner.dot(up)) / Math.tan(vertical) + 0.75,
    );
  }
  scene.fog.near = Math.max(22, distance * 0.9);
  scene.fog.far = Math.max(85, distance * 2.5);
  controls.target.copy(target);
  camera.position.copy(target).addScaledVector(direction, distance);
  controls.maxDistance = Math.max(45, distance * 1.35);
  controls.update();
}

function createTower(id) {
  const definition = TOWERS[id];
  const animated = prepareModel(sources.get(id));
  if (id === 'focus_rail') animated.root.getObjectByName('Focused_beam').visible = false;
  if (id === 'arc_mortar') animated.root.getObjectByName('Echo_projectile').visible = false;
  animated.root.position.copy(towerPositions[id]);
  towerGroup.add(animated.root);
  const tower = { ...definition, ...animated, action: 'idle', target: null, nextShotAt: id === 'focus_rail' ? 0.65 : 1.15, releaseAt: 0, endAt: 0, nextPulseAt: 0.35 };
  play(tower, 'idle');
  const label = document.createElement('div');
  label.className = 'tower-label';
  label.innerHTML = `<strong>${definition.name}</strong><span>${definition.kind === 'direct' ? 'DIRECT' : definition.kind === 'indirect' ? 'INDIRECT' : 'SUPPORT'}</span>`;
  $('actor-labels').append(label);
  tower.label = label;
  towers.push(tower);
}

function createActor(definition) {
  const animated = prepareModel(sources.get(definition.model), definition.training);
  const node = new THREE.Group();
  node.position.set(definition.lane, 0.04, definition.z);
  node.add(animated.root);
  animated.root.traverse(child => { child.userData.actorKey = definition.key; });
  actorGroup.add(node);
  const actor = {
    ...definition, ...animated, node, visual: animated.root,
    hp: definition.hp, maxHp: definition.hp, alive: true, done: false, dying: false,
    breached: false, hitAt: -100, deathAt: 0, slowUntil: 0,
  };
  play(actor, 'idle');
  const slowIndicator = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.015, 6, 48), new THREE.MeshBasicMaterial({ color: 0x68dfc5, transparent: true, opacity: 0.8, depthWrite: false }));
  ring.rotation.x = Math.PI / 2;
  slowIndicator.add(ring);
  for (const x of [-0.42, 0.42]) {
    const mote = new THREE.Mesh(new THREE.OctahedronGeometry(0.052), new THREE.MeshBasicMaterial({ color: 0xb2ffe3 }));
    mote.position.set(x, 0.05, 0);
    slowIndicator.add(mote);
  }
  slowIndicator.position.y = 0.055;
  slowIndicator.visible = false;
  node.add(slowIndicator);
  actor.slowIndicator = slowIndicator;
  const label = document.createElement('div');
  label.className = `actor-label${definition.training ? ' training' : ''}`;
  label.innerHTML = `<strong>${definition.name}</strong><div class="actor-health"><i></i></div><span></span>`;
  $('actor-labels').append(label);
  actor.label = label;
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `target-card${definition.training ? ' training' : ''}`;
  card.dataset.actor = definition.key;
  card.innerHTML = `<span class="target-card-heading"><strong>${definition.name}</strong><small>${definition.air ? '空中' : '地面'}</small></span><span class="target-hp">${definition.hp} / ${definition.hp}</span><span class="target-health"><i></i></span><span class="target-state">${definition.training ? '65% 溅射验证' : definition.air ? '飞行单位' : '地面单位'}</span>`;
  card.addEventListener('click', () => selectTarget(definition.key));
  $('enemy-list').append(card);
  actor.card = card;
  actors.push(actor);
}

function selectTarget(key) {
  const actor = actors.find(item => item.key === key && item.alive);
  state.selectedKey = actor ? key : null;
  for (const item of actors) item.card.classList.toggle('selected', item.key === state.selectedKey);
  $('target-mode').textContent = actor ? `手动锁定 · ${actor.name}` : '轨炮自动选择最高生命';
}

function actorAnchor(actor) {
  return actor.node.position.clone().add(new THREE.Vector3(0, actor.air ? 1.6 : 1.18, 0));
}

function muzzle(tower) {
  const node = tower.root.getObjectByName(tower.muzzle);
  return node.getWorldPosition(new THREE.Vector3());
}

function aim(tower, target) {
  const origin = tower.root.position;
  tower.aimYaw = Math.atan2(-(target.node.position.x - origin.x), -(target.node.position.z - origin.z));
}

function startAttack(tower) {
  if (state.finished || state.time < tower.nextShotAt || tower.kind === 'support') return false;
  const target = tower.kind === 'direct' ? railTarget(actors, state.selectedKey) : mortarTarget(actors);
  if (!target || distanceXZ(tower.root.position, target.node.position) > tower.range * RULES.rangeMultiplier) return false;
  tower.target = target;
  tower.action = 'attack';
  tower.releaseAt = state.time + tower.interval * tower.release;
  tower.endAt = state.time + tower.interval;
  tower.released = false;
  tower.nextShotAt = state.time + tower.interval;
  aim(tower, target);
  play(tower, 'attack', true);
  state.shots++;
  addLog(`${tower.name} · 锁定 ${target.name}`);
  return true;
}

function hurt(actor, amount, kind = 'direct') {
  if (!actor.alive) return;
  actor.hp = Math.max(0, actor.hp - amount);
  actor.hitAt = state.time;
  state.hits++;
  state.damage += Math.min(actor.hp + amount, amount) - actor.hp;
  effects.text(`−${amount.toFixed(1)}${kind === 'splash' ? ' 溅射' : ''}`, actorAnchor(actor), kind === 'splash' ? 'splash' : 'damage');
  if (kind !== 'splash') effects.sparkAt(actorAnchor(actor), 0.50, 0.18);
  if (actor.hp <= 0) killActor(actor);
}

function releaseAttack(tower) {
  tower.released = true;
  const target = tower.target;
  if (tower.kind === 'direct') {
    if (!target.alive) return;
    const origin = muzzle(tower);
    effects.rail(origin, actorAnchor(target));
    hurt(target, attackDamage(tower, target));
    addLog(`轨炮命中 ${target.name} · −${attackDamage(tower, target).toFixed(1)}`, 'hit');
    return;
  }
  const impact = new THREE.Vector3(target.node.position.x, 0.085, target.node.position.z);
  const origin = muzzle(tower);
  effects.mortar(origin, impact, () => {
    if (target.alive) hurt(target, attackDamage(tower, target));
    const secondary = splashTargets(actors, target, impact);
    for (const actor of secondary) {
      const damage = attackDamage(tower, actor) * RULES.splashRatio;
      hurt(actor, damage, 'splash');
      actor.slowUntil = state.time + RULES.slowDuration;
      effects.slow(actor.node.position.clone());
    }
    if (target.alive) target.slowUntil = state.time + RULES.slowDuration;
    effects.explosion(impact);
    addLog(`弧光落地 · 主目标全伤 · ${secondary.length} 个地面目标溅射并缓速`, 'hit');
  });
}

function killActor(actor) {
  actor.alive = false;
  actor.dying = true;
  actor.deathAt = state.time;
  actor.slowIndicator.visible = false;
  play(actor, 'shutdown', true);
  effects.death(actor.node.position.clone());
  const result = pressureAtDeath(actor, core.position, state.beacon);
  state.spirit = Math.max(0, state.spirit - result.actual);
  addLog(`${actor.name} 卸载 · 抗性抵消 ${result.resisted.toFixed(1)} · 精神 −${result.actual.toFixed(1)}`, 'pressure');
  if (state.beacon) {
    effects.text(`抗性抵消 ${result.resisted.toFixed(1)}`, actorAnchor(actor), 'support');
    pulseBeacon(false);
  }
  if (state.selectedKey === actor.key) selectTarget(null);
  if (state.spirit <= 0) finishBattle('防线失守');
}

function breach(actor) {
  actor.alive = false;
  actor.dying = true;
  actor.breached = true;
  actor.deathAt = state.time;
  state.spirit = Math.max(0, state.spirit - actor.coreDamage);
  play(actor, 'attack', true);
  effects.coreImpact(core.position.clone());
  effects.text(`精神 −${actor.coreDamage}`, core.position.clone().add(new THREE.Vector3(0, 1.35, 0)), 'breach');
  addLog(`${actor.name} 突破 · 精神 −${actor.coreDamage}`, 'warning');
  if (state.selectedKey === actor.key) selectTarget(null);
  if (state.spirit <= 0) finishBattle('防线失守');
}

function pulseBeacon(log = false) {
  const tower = towers.find(item => item.id === 'resistance_beacon');
  if (!state.beacon) return;
  play(tower, 'attack', true);
  const links = towers.filter(item => item.kind !== 'support').map(item => item.root.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
  links.push(core.position.clone().add(new THREE.Vector3(0, 0.7, 0)));
  effects.support(tower.root.position.clone().add(new THREE.Vector3(0, 0.10, 0)), links);
  if (log) addLog('抗性信标 · 全局抗性 +3 · 不造成伤害', 'support');
}

function toggleBeacon() {
  state.beacon = !state.beacon;
  const tower = towers.find(item => item.id === 'resistance_beacon');
  for (const entry of tower.materialStates) {
    if (entry.emissive) entry.material.emissiveIntensity = entry.intensity * (state.beacon ? 1 : 0.12);
  }
  if (state.beacon) {
    play(tower, 'idle');
    pulseBeacon(true);
    tower.nextPulseAt = state.time + tower.interval;
  } else {
    play(tower, 'shutdown', true);
    addLog('抗性信标停用 · 抗性 +0', 'warning');
  }
  updateControls();
}

function updateActor(actor, dt) {
  actor.mixer.update(dt);
  if (actor.alive && !state.finished) {
    const slow = state.time < actor.slowUntil;
    actor.node.position.z -= actor.speed * 0.35 * (slow ? RULES.slowMultiplier : 1) * dt;
    actor.slowIndicator.visible = slow;
    if (slow) actor.slowIndicator.rotation.y += dt * 2.6;
    if (actor.node.position.z <= -3.95) breach(actor);
  } else if (actor.dying) {
    const progress = clamp((state.time - actor.deathAt) / (actor.breached ? 0.46 : RULES.deathDuration));
    if (!actor.breached) {
      for (const entry of actor.materialStates) {
        entry.material.transparent = true;
        entry.material.opacity = entry.opacity * (1 - progress);
        entry.material.depthWrite = progress < 0.45;
      }
    }
    if (progress >= 1) {
      actor.done = true;
      actor.dying = false;
      actor.node.visible = false;
      actor.label.hidden = true;
    }
  }
  const hit = actor.alive ? clamp(1 - (state.time - actor.hitAt) / RULES.hitDuration) : 0;
  for (const entry of actor.materialStates) {
    if (entry.emissive) {
      entry.material.emissive.copy(entry.emissive).lerp(new THREE.Color(0xffe2d3), hit);
      entry.material.emissiveIntensity = entry.intensity + hit * 1.8;
    }
  }
  actor.visual.position.z = Math.sin(hit * Math.PI) * 0.07;
  actor.visual.rotation.z = Math.sin(hit * Math.PI) * 0.045;
}

function updateTower(tower, dt) {
  tower.mixer.update(dt);
  if (tower.target?.alive && tower.action === 'attack') aim(tower, tower.target);
  tower.root.rotation.y = turnAngle(tower.root.rotation.y, tower.aimYaw ?? tower.root.rotation.y, 3.6 * dt);
  if (tower.kind === 'support') {
    if (state.beacon && state.time >= tower.nextPulseAt && !state.finished) {
      pulseBeacon();
      tower.nextPulseAt = state.time + tower.interval;
    }
    if (state.beacon && tower.clipId === 'attack' && tower.current.time >= tower.current.getClip().duration - 0.02) play(tower, 'idle');
    return;
  }
  if (tower.action === 'attack') {
    if (!tower.released && state.time >= tower.releaseAt) releaseAttack(tower);
    if (state.time >= tower.endAt) {
      tower.action = 'idle';
      play(tower, 'idle');
    }
  }
  if (state.auto && !state.finished && tower.action !== 'attack' && state.time >= tower.nextShotAt) startAttack(tower);
}

function updateLabels() {
  const viewport = $('combat-viewport');
  const width = viewport.clientWidth, height = viewport.clientHeight;
  const place = (element, world, offset = 0) => {
    const p = world.project(camera);
    const visible = p.z < 1 && p.x > -1.15 && p.x < 1.15 && p.y > -1.15 && p.y < 1.15;
    element.style.display = visible ? '' : 'none';
    if (!visible) return;
    element.style.left = `${(p.x * 0.5 + 0.5) * width}px`;
    element.style.top = `${(-p.y * 0.5 + 0.5) * height + offset}px`;
  };
  for (const actor of actors) {
    if (!actor.done) place(actor.label, actorAnchor(actor).add(new THREE.Vector3(0, actor.air ? 0.80 : 0.70, 0)));
    actor.label.classList.toggle('selected', state.selectedKey === actor.key);
    const ratio = clamp(actor.hp / actor.maxHp);
    actor.label.querySelector('.actor-health i').style.width = `${ratio * 100}%`;
    actor.label.querySelector('span').textContent = !actor.alive ? '卸载' : state.time < actor.slowUntil ? `缓速 ${Math.max(0, actor.slowUntil - state.time).toFixed(1)}s` : `${Math.ceil(actor.hp)} HP`;
    actor.card.querySelector('.target-hp').textContent = `${Math.ceil(actor.hp)} / ${actor.maxHp}`;
    actor.card.querySelector('.target-health i').style.width = `${ratio * 100}%`;
    actor.card.querySelector('.target-state').textContent = !actor.alive ? actor.breached ? '已突破' : '已卸载' : state.time < actor.slowUntil ? '缓速 · 60% 移速' : actor.training ? '65% 溅射验证' : actor.air ? '飞行单位' : '地面单位';
    actor.card.classList.toggle('defeated', !actor.alive);
  }
  for (const tower of towers) place(tower.label, tower.root.position.clone().add(new THREE.Vector3(0, 2.25, 0)), -4);
  const crystal = core.getObjectByName('Wakeful_fire');
  crystal.rotation.y = state.time * 0.8;
  coreLight.intensity = 4.6 + Math.sin(state.time * 2.4) * 0.7;
}

function updateControls() {
  $('play-toggle').textContent = state.playing ? '暂停' : '播放';
  $('play-toggle').setAttribute('aria-pressed', String(!state.playing));
  $('auto-toggle').textContent = state.auto ? '自动交战' : '手动交战';
  $('auto-toggle').setAttribute('aria-pressed', String(state.auto));
  $('paths-toggle').textContent = state.paths ? '隐藏弹道' : '显示弹道';
  $('paths-toggle').setAttribute('aria-pressed', String(state.paths));
  $('beacon-toggle').setAttribute('aria-pressed', String(state.beacon));
  $('beacon-state').textContent = state.beacon ? '抗性 +3 · 持续生效' : '抗性 +0 · 已停用';
  $('step-button').disabled = state.playing || !state.ready || state.finished;
  for (const tower of towers) {
    if (tower.kind === 'support') continue;
    const remaining = Math.max(0, tower.nextShotAt - state.time);
    const button = $(tower.id === 'focus_rail' ? 'fire-rail' : 'fire-mortar');
    button.disabled = remaining > 0 || state.finished || !state.ready;
    button.style.setProperty('--cooldown', String(clamp(remaining / tower.interval)));
    button.querySelector('.attack-time').textContent = remaining > 0 ? `${remaining.toFixed(1)}s` : state.auto ? '自动' : '可发射';
  }
  document.querySelectorAll('[data-speed]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === state.speed)));
  $('battle-time').textContent = formatTime(state.time);
  $('spirit-value').textContent = Math.ceil(state.spirit);
  $('shot-count').textContent = state.shots;
  $('hit-count').textContent = state.hits;
  $('projectile-count').textContent = `${effects.projectiles.size} 枚弹体`;
  $('battle-state').textContent = state.finished ? '演算完成 · 可重新部署' : !state.playing ? '已暂停 · 可步进检查' : state.auto ? '自动交战进行中' : '手动交战进行中';
}

function finishBattle(message = '演算完成') {
  if (state.finished) return;
  state.finished = true;
  state.finishedAt = state.time;
  addLog(`${message} · 可重新演算`, 'support');
}

function resetBattle() {
  effects.clear();
  for (const actor of actors) {
    actor.mixer.stopAllAction();
    actor.materialStates.forEach(entry => entry.material.dispose());
    actor.slowIndicator.traverse(node => {
      node.geometry?.dispose();
      node.material?.dispose();
    });
    actor.label.remove();
    actor.card.remove();
    actorGroup.remove(actor.node);
  }
  actors.length = 0;
  Object.assign(state, { playing: true, auto: true, time: 0, spirit: 100, beacon: true, selectedKey: null, finished: false, finishedAt: 0, shots: 0, hits: 0, damage: 0 });
  logEntries.length = 0;
  ENCOUNTERS.forEach(createActor);
  for (const tower of towers) {
    tower.action = 'idle';
    tower.target = null;
    tower.aimYaw = 0;
    tower.root.rotation.y = 0;
    tower.nextShotAt = tower.id === 'focus_rail' ? 0.65 : 1.15;
    tower.nextPulseAt = 0.35;
    for (const entry of tower.materialStates) if (entry.emissive) entry.material.emissiveIntensity = entry.intensity;
    play(tower, 'idle');
  }
  addLog('三幕敌群接触 · 防御构造就绪');
  addLog('抗性信标已接入 · 全局抗性 +3', 'support');
  selectTarget(null);
  updateControls();
}

function advance(dt) {
  if (!state.ready) return;
  state.time += dt;
  for (const actor of actors) updateActor(actor, dt);
  for (const tower of towers) updateTower(tower, dt);
  effects.update(dt);
  if (!state.finished && actors.length && actors.every(actor => actor.done)) finishBattle();
  if (state.finished && state.time - state.finishedAt > 0.9) state.playing = false;
  updateControls();
}

function bindUI() {
  $('play-toggle').addEventListener('click', () => { state.playing = !state.playing; updateControls(); });
  $('auto-toggle').addEventListener('click', () => { state.auto = !state.auto; updateControls(); });
  $('replay').addEventListener('click', resetBattle);
  $('step-button').addEventListener('click', () => { if (!state.playing) advance(0.1); });
  $('fire-rail').addEventListener('click', () => startAttack(towers.find(tower => tower.id === 'focus_rail')));
  $('fire-mortar').addEventListener('click', () => startAttack(towers.find(tower => tower.id === 'arc_mortar')));
  $('beacon-toggle').addEventListener('click', toggleBeacon);
  $('paths-toggle').addEventListener('click', () => {
    state.paths = !state.paths;
    effects.setPathsVisible(state.paths);
    updateControls();
  });
  $('camera-reset').addEventListener('click', resetCamera);
  $('clear-target').addEventListener('click', () => selectTarget(null));
  $('speed-controls').addEventListener('click', event => {
    const button = event.target.closest('[data-speed]');
    if (!button) return;
    state.speed = Number(button.dataset.speed);
    updateControls();
  });
  $('combat-retry').addEventListener('click', () => location.reload());
  let pointer = null;
  renderer.domElement.addEventListener('pointerdown', event => { pointer = { x: event.clientX, y: event.clientY }; });
  renderer.domElement.addEventListener('pointerup', event => {
    if (!pointer || Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 5 || event.button !== 0) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    const hits = raycaster.intersectObjects(actorGroup.children, true);
    if (hits.length) selectTarget(hits[0].object.userData.actorKey);
    pointer = null;
  });
  window.addEventListener('keydown', event => {
    if (!state.ready || event.target.closest('button, input, a') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Space') { event.preventDefault(); state.playing = !state.playing; updateControls(); }
    if (event.code === 'KeyR') resetCamera();
    if (event.code === 'Period' && !state.playing) advance(0.1);
  });
  window.addEventListener('error', event => showError(event.error || new Error(event.message)));
  window.addEventListener('unhandledrejection', event => showError(event.reason));
}

async function loadModels() {
  const ids = ['memory_runner', 'repair_skiff', 'null_wing', 'focus_rail', 'arc_mortar', 'resistance_beacon'];
  let completed = 0;
  await Promise.all(ids.map(async id => {
    const gltf = await loader.loadAsync(`./models/${id}.glb`);
    sources.set(id, { root: gltf.scene, animations: gltf.animations });
    completed++;
    $('combat-load-text').textContent = `已装载 ${completed} / 6 件模型`;
  }));
  for (const id of Object.keys(towerPositions)) createTower(id);
  resetBattle();
  state.ready = true;
  updateControls();
  document.body.dataset.ready = 'true';
  $('engine-status').textContent = 'LOCAL / COMBAT READY';
  await renderer.compileAsync(scene, camera);
  $('combat-loading').classList.add('is-done');
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.06, Math.max(0, (now - (lastFrame || now)) / 1000));
  lastFrame = now;
  if (state.ready && state.playing) advance(dt * state.speed);
  controls.update();
  updateLabels();
  renderer.render(scene, camera);
}

async function init() {
  createScene();
  bindUI();
  requestAnimationFrame(frame);
  await loadModels();
}

window.combatLab = {
  getState: () => ({
    ready: state.ready, time: state.time, playing: state.playing, auto: state.auto, speed: state.speed,
    spirit: state.spirit, beacon: state.beacon, finished: state.finished, shots: state.shots, hits: state.hits,
    projectiles: effects?.projectiles.size || 0,
    cameraDistance: camera && controls ? camera.position.distanceTo(controls.target) : 0,
    projectileArcs: [...(effects?.projectiles || [])].map(item => {
      const geometry = item.path?.children[1]?.geometry;
      geometry?.computeBoundingBox();
      return { height: item.object.children[0].position.y, apex: geometry?.boundingBox?.max.y ?? null };
    }),
    actors: actors.map(actor => ({ key: actor.key, hp: actor.hp, alive: actor.alive, done: actor.done, slow: Math.max(0, actor.slowUntil - state.time), z: actor.node.position.z })),
    towers: towers.map(tower => ({ id: tower.id, action: tower.action, target: tower.target?.key || null, nextShotAt: tower.nextShotAt, yaw: tower.root.rotation.y, aimYaw: tower.aimYaw ?? tower.root.rotation.y })),
  }),
  getEvents: () => [...logEntries],
};

init().catch(showError);
