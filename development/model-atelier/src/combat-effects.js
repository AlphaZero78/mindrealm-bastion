import * as THREE from '../vendor/three/build/three.module.js';
import { RULES, mortarPath } from './combat-rules.js';

const TAU = Math.PI * 2;
const clamp = value => Math.max(0, Math.min(1, value));

function disposeObject(root) {
  root.traverse(node => {
    node.geometry?.dispose();
    if (Array.isArray(node.material)) node.material.forEach(material => material.dispose());
    else node.material?.dispose();
  });
}

function glow(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
}

function segment(start, end, radius, material) {
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 12, 1, true), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function sparkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(48, 48, 0, 48, 48, 46);
  gradient.addColorStop(0, 'rgba(255,255,242,1)');
  gradient.addColorStop(0.14, 'rgba(255,244,199,0.95)');
  gradient.addColorStop(0.42, 'rgba(255,202,133,0.32)');
  gradient.addColorStop(1, 'rgba(255,182,113,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 96, 96);
  context.strokeStyle = 'rgba(255,252,231,0.95)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(48, 5); context.lineTo(48, 91);
  context.moveTo(5, 48); context.lineTo(91, 48);
  context.moveTo(20, 20); context.lineTo(76, 76);
  context.moveTo(76, 20); context.lineTo(20, 76);
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class CombatEffects {
  constructor(scene, camera, layer) {
    this.scene = scene;
    this.camera = camera;
    this.layer = layer;
    this.items = new Set();
    this.texts = new Set();
    this.projectiles = new Set();
    this.spark = sparkTexture();
    this.pathsVisible = true;
  }

  add(object, duration, { tick = null, complete = null, kind = null } = {}) {
    this.scene.add(object);
    const item = { object, duration, age: 0, tick, complete, kind };
    this.items.add(item);
    if (kind === 'projectile') this.projectiles.add(item);
    return item;
  }

  update(dt) {
    for (const item of [...this.items]) {
      item.age += dt;
      const t = clamp(item.age / item.duration);
      item.tick?.(t, dt);
      if (t >= 1) {
        this.scene.remove(item.object);
        disposeObject(item.object);
        this.items.delete(item);
        this.projectiles.delete(item);
        item.complete?.();
      }
    }
    for (const item of [...this.texts]) {
      item.age += dt;
      const t = clamp(item.age / item.duration);
      const position = item.world.clone();
      position.y += t * 0.72;
      position.project(this.camera);
      item.element.style.left = `${(position.x * 0.5 + 0.5) * this.layer.clientWidth}px`;
      item.element.style.top = `${(-position.y * 0.5 + 0.5) * this.layer.clientHeight}px`;
      item.element.style.opacity = String(1 - t * t);
      item.element.style.display = position.z > 1 ? 'none' : '';
      if (t >= 1) {
        item.element.remove();
        this.texts.delete(item);
      }
    }
  }

  text(text, world, kind = 'damage', duration = 0.85) {
    const element = document.createElement('div');
    element.className = `combat-float ${kind}`;
    element.textContent = text;
    this.layer.append(element);
    this.texts.add({ element, world: world.clone(), age: 0, duration });
  }

  sparkAt(point, scale = 0.7, duration = 0.2) {
    const material = new THREE.SpriteMaterial({ map: this.spark, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(point);
    return this.add(sprite, duration, {
      tick: t => {
        sprite.scale.setScalar(scale * (0.6 + t * 0.7));
        material.opacity = 1 - t;
        material.rotation = t * 0.6;
      },
    });
  }

  rail(start, end) {
    const group = new THREE.Group();
    const gold = glow(0xe5bd69), ivory = glow(0xf3fff0);
    group.add(segment(start, end, 0.029, gold), segment(start, end, 0.010, ivory));
    const direction = end.clone().sub(start).normalize();
    const a = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
    if (a.lengthSq() < 0.01) a.set(1, 0, 0);
    const b = new THREE.Vector3().crossVectors(direction, a).normalize();
    const points = [];
    for (const vector of [a, b]) {
      points.push(...end.clone().addScaledVector(vector, -0.33).toArray(), ...end.clone().addScaledVector(vector, 0.33).toArray());
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xf5d992, transparent: true, depthWrite: false })));
    this.add(group, 0.24, { tick: t => group.traverse(node => { if (node.material) node.material.opacity = 1 - t * t; }) });
    this.sparkAt(end, 0.85, 0.22);
  }

  mortar(start, end, onImpact) {
    const { curve, duration } = mortarPath(start, end);
    const group = new THREE.Group();
    const projectile = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), glow(0xc4fff0));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.022, 8, 28), glow(0x61e9ce));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.spark, color: 0x8bffdc, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(0.62);
    projectile.add(core, ring, halo);
    group.add(projectile);
    const guide = new THREE.Group();
    const path = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), new THREE.LineDashedMaterial({ color: 0x63e9bd, dashSize: 0.13, gapSize: 0.095, transparent: true, opacity: 0.62, depthWrite: false }));
    path.computeLineDistances();
    const ribbon = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.02, 5, false), glow(0x64cdb5, 0.24));
    guide.add(path, ribbon);
    guide.visible = this.pathsVisible;
    group.add(guide);
    const trailGeometry = new THREE.BufferGeometry();
    const trailPositions = new THREE.Float32BufferAttribute(new Float32Array(22 * 3), 3);
    trailPositions.setUsage(THREE.DynamicDrawUsage);
    trailGeometry.setAttribute('position', trailPositions);
    trailGeometry.setDrawRange(0, 0);
    const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: 0x96ffe0, transparent: true, opacity: 0.85, depthWrite: false }));
    trail.frustumCulled = false;
    group.add(trail);
    const marker = new THREE.Group();
    marker.position.copy(end);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(RULES.splashRadius, 0.017, 8, 96), glow(0xef927d, 0.55));
    rim.rotation.x = Math.PI / 2;
    const area = new THREE.Mesh(new THREE.CircleGeometry(RULES.splashRadius, 64), glow(0xef927d, 0.045));
    area.rotation.x = -Math.PI / 2;
    area.position.y = -0.006;
    marker.add(rim, area);
    group.add(marker);
    const trailPoints = [];
    const item = this.add(group, duration, {
      kind: 'projectile',
      tick: (t, dt) => {
        const point = curve.getPoint(t);
        projectile.position.copy(point);
        projectile.rotation.y += dt * 9;
        projectile.rotation.x += dt * 4;
        trailPoints.push(point.clone());
        if (trailPoints.length > 22) trailPoints.shift();
        trailPoints.forEach((point, index) => trailPositions.setXYZ(index, point.x, point.y, point.z));
        trailPositions.needsUpdate = true;
        trailGeometry.setDrawRange(0, trailPoints.length);
        rim.material.opacity = 0.35 + Math.sin(t * TAU * 2) * 0.17;
        marker.scale.setScalar(1 + Math.sin(t * TAU * 2) * 0.025);
      },
      complete: onImpact,
    });
    item.path = guide;
    return item;
  }

  explosion(point) {
    const group = new THREE.Group();
    group.position.copy(point);
    const outer = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 8, 80), glow(0x8df4d3));
    const inner = new THREE.Mesh(new THREE.TorusGeometry(1, 0.016, 8, 64), glow(0xf0b486));
    outer.rotation.x = inner.rotation.x = Math.PI / 2;
    inner.position.y = 0.03;
    group.add(outer, inner);
    this.add(group, 0.58, {
      tick: t => {
        outer.scale.setScalar(0.18 + t * RULES.splashRadius);
        inner.scale.setScalar(0.1 + t * 1.42);
        outer.material.opacity = (1 - t) * 0.9;
        inner.material.opacity = (1 - t) * 0.65;
      },
    });
    this.sparkAt(point.clone().add(new THREE.Vector3(0, 0.32, 0)), 1.5, 0.32);
    this.fragments(point, 10, 0xe2c595);
  }

  fragments(point, count, color) {
    const group = new THREE.Group();
    group.position.copy(point);
    const particles = [];
    for (let i = 0; i < count; i++) {
      const angle = i * TAU / count + 0.23;
      const mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.045), glow(color));
      const velocity = new THREE.Vector3(Math.cos(angle) * (1.1 + (i % 3) * 0.3), 0.9 + (i % 4) * 0.25, Math.sin(angle) * (1.1 + (i % 2) * 0.4));
      group.add(mesh);
      particles.push({ mesh, velocity });
    }
    this.add(group, 0.55, {
      tick: (t, dt) => {
        for (const particle of particles) {
          particle.mesh.position.copy(particle.velocity).multiplyScalar(t * 1.8);
          particle.mesh.position.y -= t * t * 1.3;
          particle.mesh.rotation.x += dt * 4;
          particle.mesh.rotation.z += dt * 5;
          particle.mesh.material.opacity = 1 - t;
        }
      },
    });
  }

  slow(point) {
    const group = new THREE.Group();
    group.position.copy(point);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 6, 48), glow(0x70d4c4));
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    this.add(group, 0.46, { tick: t => { ring.scale.setScalar(0.65 + t * 0.8); ring.material.opacity = 1 - t; } });
  }

  death(point) {
    const group = new THREE.Group();
    group.position.copy(point);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.022, 8, 48), glow(0xef8677));
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    this.add(group, RULES.deathDuration, { tick: t => { ring.scale.setScalar(0.5 + t * 1.7); ring.material.opacity = 1 - t; } });
    this.fragments(point, 5, 0xd49383);
  }

  support(origin, links = []) {
    const group = new THREE.Group();
    group.position.copy(origin);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.018, 8, 80), glow(0xe2c88b));
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    this.add(group, 1.05, {
      tick: t => {
        ring.scale.setScalar(0.3 + t * 4.2);
        ring.material.opacity = (1 - t) * 0.55;
      },
    });
    for (const end of links) {
      const middle = origin.clone().add(end).multiplyScalar(0.5);
      middle.y += 0.8;
      const curve = new THREE.QuadraticBezierCurve3(origin.clone(), middle, end.clone());
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)), new THREE.LineBasicMaterial({ color: 0xd4d9a6, transparent: true, opacity: 0.6, depthWrite: false }));
      this.add(line, 0.65, { tick: t => { line.material.opacity = (1 - t) * 0.55; } });
    }
  }

  coreImpact(origin) {
    this.support(origin, []);
    this.sparkAt(origin.clone().add(new THREE.Vector3(0, 0.35, 0)), 1.1, 0.35);
  }

  setPathsVisible(visible) {
    this.pathsVisible = visible;
    for (const item of this.items) if (item.path) item.path.visible = visible;
  }

  clear() {
    for (const item of this.items) {
      this.scene.remove(item.object);
      disposeObject(item.object);
    }
    for (const item of this.texts) item.element.remove();
    this.items.clear();
    this.projectiles.clear();
    this.texts.clear();
  }
}
