import { mergeVertices } from '../vendor/three/examples/jsm/utils/BufferGeometryUtils.js';

/** Index repeated vertices without removing faces, joints, seams or materials. */
export function optimizeModelExport(root, clips) {
  const geometries = new Map();
  const result = { verticesBefore: 0, verticesAfter: 0, triangles: 0, keysBefore: 0, keysAfter: 0, maximumAttributeError: 0 };
  root.traverse(node => {
    if (!node.isMesh) return;
    const original = node.geometry;
    if (!geometries.has(original)) {
      const indexed = mergeVertices(original, 1e-6);
      const count = original.index?.count ?? original.attributes.position.count;
      if (indexed.index.count !== count) throw new Error(`Indexing changed the faces in ${node.name}`);
      // Compare the full vertex stream in drawing order, including the normals
      // and UV seams. A smaller file must describe the same surface.
      for (const [name, before] of Object.entries(original.attributes)) {
        const after = indexed.getAttribute(name);
        if (!after || after.itemSize !== before.itemSize) throw new Error(`Indexing lost ${name} in ${node.name}`);
        for (let i = 0; i < count; i++) {
          const a = original.index ? original.index.getX(i) : i, b = indexed.index.getX(i);
          for (let component = 0; component < before.itemSize; component++) {
            const difference = Math.abs(before.array[a * before.itemSize + component] - after.array[b * after.itemSize + component]);
            if (difference > 1.01e-6) throw new Error(`Indexing changed ${name} in ${node.name}`);
            result.maximumAttributeError = Math.max(result.maximumAttributeError, difference);
          }
        }
      }
      result.verticesBefore += original.attributes.position.count;
      result.verticesAfter += indexed.attributes.position.count;
      result.triangles += count / 3;
      geometries.set(original, indexed);
    }
    node.geometry = geometries.get(original);
  });
  for (const geometry of geometries.keys()) geometry.dispose();
  for (const clip of clips) {
    result.keysBefore += clip.tracks.reduce((sum, track) => sum + track.times.length, 0);
    clip.optimize();
    result.keysAfter += clip.tracks.reduce((sum, track) => sum + track.times.length, 0);
  }
  return result;
}
