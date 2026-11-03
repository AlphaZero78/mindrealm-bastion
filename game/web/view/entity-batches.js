import * as THREE from '../../assets/third_party/three/three.bundle.js';

function extendMaterial(material) {
  const previousCompile = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile?.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_BATCHING_COLOR\ntotalEmissiveRadiance *= vColor.rgb;\n#endif');
  };
  material.customProgramCacheKey = () => `${previousKey?.call(material) ?? ''}:mindrealm-batched-rgba-v1`;
}

function batchMaterial(source, transparent) {
  const material = source.clone();
  material.transparent = source.transparent || transparent;
  material.depthWrite = material.transparent ? false : source.depthWrite;
  material.opacity = source.opacity;
  extendMaterial(material);
  return material;
}

function geometrySignature(geometry) {
  return `${geometry.index ? 'indexed' : 'plain'}:${Object.entries(geometry.attributes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized}`)
    .join('|')}`;
}

export class EntityBatchPool {
  constructor(scene, { capacity = 8 } = {}) {
    this.scene = scene;
    this.initialCapacity = capacity;
    this.batches = new Map();
    this.owners = new Map();
    this.descriptions = new WeakMap();
    this.sourceDescriptions = new WeakMap();
    this.partKeys = new WeakMap();
    this.materialKeys = new WeakMap();
    this.color = new THREE.Vector4();
    this.matrix = new THREE.Matrix4();
    this.anonymousSerial = 0;
  }

  materialKey(source) {
    let key = this.materialKeys.get(source);
    if (!key) {
      const parameters = source.toJSON();
      delete parameters.uuid;
      key = JSON.stringify(parameters);
      this.materialKeys.set(source, key);
    }
    return key;
  }

  describe(source, transparent, shadow) {
    if (source.skinned || source.materials.length !== 1) {
      throw new Error('BatchedMesh 需要单材质刚体几何；蒙皮网格必须由独立骨架渲染');
    }
    // Model source objects and their geometry layouts stay fixed after load.
    // Avoid rebuilding and hashing the full material/attribute key per part
    // on every frame; keep separate entries for all four render modes.
    let cached = this.sourceDescriptions.get(source);
    if (!cached || cached.geometry !== source.geometry || cached.material !== source.materials[0]) {
      cached = { geometry: source.geometry, material: source.materials[0], variants: [] };
      this.sourceDescriptions.set(source, cached);
    }
    const mode = (transparent ? 2 : 0) | (shadow ? 1 : 0);
    if (cached.variants[mode]) return cached.variants[mode];
    const materialKey = this.materialKey(source.materials[0]);
    const key = `${materialKey}:${geometrySignature(source.geometry)}:${transparent ? 't' : 's'}:${shadow ? 'shadow' : 'flat'}`;
    let variants = this.descriptions.get(source.geometry);
    if (!variants) {
      variants = new Map();
      this.descriptions.set(source.geometry, variants);
    }
    let description = variants.get(key);
    if (!description) {
      description = {
        key,
        source,
        material: source.materials[0],
        transparent,
        shadow,
        vertices: source.geometry.getAttribute('position').count,
        indices: source.geometry.index?.count || 0,
      };
      variants.set(key, description);
    }
    cached.variants[mode] = description;
    return description;
  }

  prepare(assets) {
    const capacities = new Map();
    const values = assets instanceof Map ? assets.values() : assets;
    for (const asset of values) {
      asset.scene.traverse(node => {
        if (!node.isMesh || node.isSkinnedMesh) return;
        for (const geometry of [node.geometry, asset.lodGeometries?.get(node.geometry)]) {
          if (!geometry) continue;
          const source = { geometry, materials: Array.isArray(node.material) ? node.material : [node.material] };
          for (const transparent of [false, true]) for (const shadow of [false, true]) {
            const description = this.describe(source, transparent, shadow);
            if (this.batches.get(description.key)?.reserved.has(geometry.uuid)) continue;
            let capacity = capacities.get(description.key);
            if (!capacity) {
              capacity = { description, geometries: new Map() };
              capacities.set(description.key, capacity);
            }
            if (!capacity.geometries.has(geometry.uuid)) capacity.geometries.set(geometry.uuid, description);
          }
        }
      });
    }
    for (const [key, capacity] of capacities) {
      let vertices = 0, indices = 0;
      for (const description of capacity.geometries.values()) {
        vertices += description.vertices;
        indices += description.indices;
      }
      const existing = this.batches.get(key);
      if (existing) {
        const count = existing.reserved.size + capacity.geometries.size;
        for (const [uuid, description] of capacity.geometries) existing.reserved.set(uuid, description);
        this.rebuild(existing, existing.vertexCapacity + vertices, existing.indexCapacity + indices, Math.max(existing.capacity, count * 4));
      } else {
        this.batches.set(key, this.createBatch(
          capacity.description, vertices, indices,
          Math.max(this.initialCapacity, capacity.geometries.size * 4),
          new Map(capacity.geometries),
        ));
      }
    }
    return { batches: this.batches.size, geometries: [...capacities.values()].reduce((sum, item) => sum + item.geometries.size, 0) };
  }

  begin() {
    for (const batch of this.batches.values()) {
      batch.count = 0;
      batch.mesh.visible = false;
      for (const [key, slot] of batch.slots) {
        if (!batch.mesh._instanceInfo[slot.id]?.active) throw new Error(`批次槽位失效 ${key}: ${JSON.stringify({ slot, info: batch.mesh._instanceInfo[slot.id], available: batch.mesh._availableInstanceIds, count: batch.mesh.instanceCount })}`);
        batch.mesh.setVisibleAt(slot.id, false);
      }
    }
  }

  createMesh(batch, vertices, indices, capacity) {
    const mesh = new THREE.BatchedMesh(capacity, Math.max(1, vertices), Math.max(1, indices), batch.materials[0]);
    mesh.name = 'Entity_material_batch';
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.perObjectFrustumCulled = false;
    mesh.sortObjects = batch.materials[0].transparent;
    mesh.castShadow = batch.shadow && !batch.materials[0].transparent && batch.materials[0].opacity >= 0.999;
    mesh.receiveShadow = true;
    mesh.renderOrder = batch.materials[0].transparent ? 2 : 0;
    this.scene.add(mesh);
    return mesh;
  }

  createBatch(description, vertices, indices, capacity = this.initialCapacity, reserved = new Map()) {
    const material = batchMaterial(description.material, description.transparent);
    const batch = {
      count: 0,
      capacity,
      vertexCapacity: vertices,
      indexCapacity: indices,
      shadow: description.shadow,
      materials: [material],
      material,
      geometries: new Map(),
      slots: new Map(),
      reserved,
    };
    batch.mesh = this.createMesh(batch, vertices, indices, capacity);
    return batch;
  }

  rebuild(batch, vertices = batch.vertexCapacity, indices = batch.indexCapacity, capacity = batch.capacity) {
    const previous = batch.mesh;
    batch.mesh = this.createMesh(batch, vertices, indices, capacity);
    for (const geometry of batch.geometries.values()) geometry.id = batch.mesh.addGeometry(geometry.description.source.geometry);
    for (const slot of batch.slots.values()) {
      const visible = previous.getVisibleAt(slot.id);
      previous.getMatrixAt(slot.id, this.matrix);
      previous.getColorAt(slot.id, this.color);
      slot.id = batch.mesh.addInstance(batch.geometries.get(slot.geometryUuid).id);
      batch.mesh.setMatrixAt(slot.id, this.matrix);
      batch.mesh.setColorAt(slot.id, this.color);
      batch.mesh.setVisibleAt(slot.id, visible);
    }
    this.scene.remove(previous);
    previous.dispose();
    batch.vertexCapacity = vertices;
    batch.indexCapacity = indices;
    batch.capacity = capacity;
  }

  grow(batch) {
    this.rebuild(batch, batch.vertexCapacity, batch.indexCapacity, batch.capacity * 2);
  }

  add(source, matrix, { alpha, brightness, transparent, shadow = true, owner, part = '' }) {
    const description = this.describe(source, transparent, shadow);
    let batch = this.batches.get(description.key);
    if (!batch) {
      batch = this.createBatch(description, description.vertices, description.indices);
      this.batches.set(description.key, batch);
    }
    let geometry = batch.geometries.get(source.geometry.uuid);
    if (!geometry) {
      if (!batch.reserved.has(source.geometry.uuid)) {
        this.rebuild(batch, batch.vertexCapacity + description.vertices, batch.indexCapacity + description.indices);
        batch.reserved.set(source.geometry.uuid, description);
      }
      geometry = { id: batch.mesh.addGeometry(source.geometry), description };
      batch.geometries.set(source.geometry.uuid, geometry);
    }
    let key;
    if (owner) {
      let cached = this.partKeys.get(source);
      if (!cached || cached.owner !== owner || cached.part !== part) {
        cached = { owner, part, key: `${owner}:${part}` };
        this.partKeys.set(source, cached);
      }
      key = cached.key;
    } else key = `anonymous:${++this.anonymousSerial}`;
    const existing = this.owners.get(key);
    if (existing && existing.batch !== batch) this.remove(key);
    let slot = batch.slots.get(key);
    if (!slot) {
      if (batch.slots.size >= batch.capacity) this.grow(batch);
      slot = { id: batch.mesh.addInstance(geometry.id), geometryUuid: source.geometry.uuid };
      batch.mesh.setVisibleAt(slot.id, false);
      batch.slots.set(key, slot);
      this.owners.set(key, { batch, slot });
    } else if (slot.geometryUuid !== source.geometry.uuid) {
      batch.mesh.setGeometryIdAt(slot.id, geometry.id);
      slot.geometryUuid = source.geometry.uuid;
    }
    batch.mesh.setMatrixAt(slot.id, matrix);
    this.color.set(brightness, brightness, brightness, alpha);
    batch.mesh.setColorAt(slot.id, this.color);
    batch.mesh.setVisibleAt(slot.id, true);
    batch.count++;
    return true;
  }

  remove(owner) {
    for (const key of [...this.owners.keys()]) {
      if (key !== owner && !key.startsWith(`${owner}:`)) continue;
      const { batch, slot } = this.owners.get(key);
      if (batch.mesh.getVisibleAt(slot.id)) batch.count--;
      batch.mesh.deleteInstance(slot.id);
      batch.slots.delete(key);
      this.owners.delete(key);
    }
  }

  flush() {
    let instances = 0;
    for (const batch of this.batches.values()) {
      batch.mesh.visible = batch.count > 0;
      instances += batch.count;
    }
    return instances;
  }

  dispose() {
    for (const batch of this.batches.values()) {
      this.scene.remove(batch.mesh);
      batch.mesh.dispose();
      for (const material of batch.materials) material.dispose();
      batch.slots.clear();
      batch.geometries.clear();
      batch.reserved.clear();
    }
    this.batches.clear();
    this.owners.clear();
    this.descriptions = new WeakMap();
    this.sourceDescriptions = new WeakMap();
    this.partKeys = new WeakMap();
    this.materialKeys = new WeakMap();
  }
}
