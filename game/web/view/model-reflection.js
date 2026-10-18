/** Reflect local source X while keeping front-face winding and positive instances. */
export function reflectGeometryX(source){
 const geometry=source.clone();
 const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),tangent=geometry.getAttribute('tangent');
 for(let i=0;i<position.count;i++)position.setX(i,-position.getX(i));
 if(normal)for(let i=0;i<normal.count;i++)normal.setX(i,-normal.getX(i));
 if(tangent)for(let i=0;i<tangent.count;i++){tangent.setX(i,-tangent.getX(i));tangent.setW(i,-tangent.getW(i));}
 // Indexed winding also handles unindexed GLBs without reordering UV/normal data.
 const index=geometry.getIndex(),indices=index?Array.from(index.array):Array.from({length:position.count},(_,i)=>i);
 for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return geometry;
}
