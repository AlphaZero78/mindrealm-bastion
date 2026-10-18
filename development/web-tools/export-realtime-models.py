"""Export reusable, articulated Kenney parts for the live PBR renderer.

Run with Blender 4.5+ and --output <external staging directory>. Runtime
assemblies reuse the existing authored recipes; no primitive stand-ins are made.
LOD0 refines curved strips and adds rounded machined edges. The distant mesh
retains a lighter curved silhouette. Source GLBs are preserved unchanged.
"""
import argparse
import importlib.util
import json
import math
import subprocess
from pathlib import Path
import sys
sys.dont_write_bytecode = True
import bpy
import bmesh
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('entity_recipes', Path(__file__).with_name('bake-entity-art.py'))
recipes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recipes)
refine_spec = importlib.util.spec_from_file_location('surface_refinement', Path(__file__).with_name('refine-model-surfaces.py'))
refinement = importlib.util.module_from_spec(refine_spec)
refine_spec.loader.exec_module(refinement)

def split_surfaces(mesh, level, material_names):
    """Preserve evaluated corner normals when splitting the material batches."""
    mesh.calc_loop_triangles()
    normals = [tuple(n.vector) for n in mesh.corner_normals]
    for material_index, surface in enumerate(material_names):
        faces = [p for p in mesh.polygons if p.material_index == material_index]
        if not faces:
            continue
        used = sorted({v for face in faces for v in face.vertices})
        remap = {old: new for new, old in enumerate(used)}
        output = bpy.data.meshes.new(f'L{level}_{surface}')
        output.from_pydata([mesh.vertices[v].co[:] for v in used], [], [[remap[v] for v in face.vertices] for face in faces])
        output.materials.append(recipes.material('towers', surface))
        output.update()
        uv=output.uv_layers.new(name='SurfaceUV')
        for face in output.polygons:
            axis=max(range(3),key=lambda i:abs(face.normal[i]))
            for loop_index in face.loop_indices:
                v=output.vertices[output.loops[loop_index].vertex_index].co
                uv.data[loop_index].uv=(v.y+.5,v.z) if axis==0 else (v.x+.5,v.z) if axis==1 else (v.x+.5,v.y+.5)
        for p in output.polygons:
            p.use_smooth = True
        output.normals_split_custom_set([normals[index] for face in faces for index in face.loop_indices])
        obj = bpy.data.objects.new(f'L{level}_{surface}', output)
        obj['surface'] = surface
        obj['lod'] = level
        bpy.context.scene.collection.objects.link(obj)
        yield obj

def export_source(source, output):
    for obj in list(bpy.context.scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    wheel = source == refinement.DRIVE_WHEEL
    sources = [] if wheel else recipes.template(source, 'towers', 'native', exclude_nodes=('cable',))
    material_names = list(recipes.PALETTES['towers'])
    counts = [0, 0]
    for level in [0, 1]:
        for source_mesh in refinement.drive_wheel_meshes(recipes, level) if wheel else sources:
            # Loose decorative cable nodes become long exposed lines when a
            # source cabinet is reused as a limb sleeve. Keep the sealed shell.
            if 'cable' in source_mesh.name.lower():
                continue
            obj = bpy.data.objects.new('normalized_source', source_mesh.copy())
            bpy.context.scene.collection.objects.link(obj)
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            # GLTF duplicates vertices at UV/normal seams. Weld coincident
            # positions so bevels operate on the original solid panel edges.
            topology=bmesh.new();topology.from_mesh(obj.data)
            bmesh.ops.remove_doubles(topology,verts=list(topology.verts),dist=.00001)
            topology.to_mesh(obj.data);topology.free();obj.data.update()
            if source in refinement.ROUND_SOURCES:
                refinement.round_source_strips(obj.data, 3 if level == 0 else 1)
            if source in refinement.CURVED_SOURCES:
                refinement.refine_curved_shell(obj,level)
            # Smooth curved faces while preserving the source's hard panel edges.
            for p in obj.data.polygons:
                p.use_smooth = True
            obj.data.set_sharp_from_angle(angle=math.radians(38))
            if level == 0 and not wheel:
                bevel = obj.modifiers.new('machined_edges', 'BEVEL')
                bevel.width = .032
                bevel.segments = 5
                bevel.limit_method = 'ANGLE'
                bevel.angle_limit = math.radians(28)
                bevel.harden_normals = True
                bpy.ops.object.modifier_apply(modifier=bevel.name)
            # Curved interpolation and bevel miters may exceed the old polygon
            # box. Preserve the normalized authoring envelope and joint fits.
            extent=[max(abs(v.co[i]) for v in obj.data.vertices) for i in [0,1]]
            min_z=min(0,min(v.co.z for v in obj.data.vertices))
            height=max(1,max(v.co.z for v in obj.data.vertices)-min_z)
            for v in obj.data.vertices:
                v.co.x/=max(1,extent[0]*2);v.co.y/=max(1,extent[1]*2)
                v.co.z=(v.co.z-min_z)/height
            obj.data.update()
            weighted = obj.modifiers.new('panel_normals', 'WEIGHTED_NORMAL')
            weighted.keep_sharp = True
            weighted.weight = 40
            bpy.ops.object.modifier_apply(modifier=weighted.name)
            obj.data.update()
            for part in split_surfaces(obj.data, level, material_names):
                part.data.calc_loop_triangles()
                counts[level] += len(part.data.loop_triangles)
            bpy.data.objects.remove(obj, do_unlink=True)
    # One shared mesh per semantic surface and LOD, even for multi-node sources.
    for level in [0, 1]:
        for surface in material_names:
            group = [o for o in bpy.context.scene.objects if o.get('lod') == level and o.get('surface') == surface]
            if len(group) > 1:
                bpy.ops.object.select_all(action='DESELECT')
                for obj in group:
                    obj.select_set(True)
                bpy.context.view_layer.objects.active = group[0]
                bpy.ops.object.join()
    path = output / (source.replace('/', '__') + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', export_yup=True,
                              export_extras=True, export_animations=False,
                              export_texcoords=True, export_tangents=False,
                              export_cameras=False, export_lights=False)
    metadata={'path': '/assets/game/models/' + path.name, 'triangles': counts, 'bytes': path.stat().st_size,
              'surfaceRevision': 3}
    if wheel:
        metadata.update(derivedFrom=refinement.WHEEL_PARENT, circularSegments=64,
                        refinement='retained cast hub, rounded tyre shoulders, recessed rim and fasteners')
    return metadata

def entity_definition(recipe):
    variants = {v: recipes.assembly_parts(recipe, v) for v in recipe['variants']}
    # Small fasteners and cooling modules reuse licensed modeled components.
    # They are omitted at distant LOD; the role-defining assembly stays intact.
    for parts in variants.values():
        additions=[]
        if recipe['kind']=='towers':
            for x in [-.66,.66]:
                for y in [-.57,.57]:
                    additions.append(recipes.sp('barrel',(.12,.12,.085),(x,y,.31),finish='metal'))
        elif recipe['locomotion']=='crawler':
            for x in [-.76,.76]:
                for y in [-.48,.43]:
                    additions.append(recipes.sp('pipe_ring',(.24,.24,.11),(x,y,.22),'wheel',(0,90,0),'metal'))
        else:
            for z in [.77,1.02,1.27]:
                additions.append(recipes.sp('barrel',(.10,.09,.07),(0,-.29,z),'body',finish='metal'))
        parts.extend(dict(part,detail=True) for part in additions)
    corners = [Vector((x, y, z)) for x in [-.5, .5] for y in [-.5, .5] for z in [0, 1]]
    points = []
    for parts in variants.values():
        for p in parts:
            pos, rot = recipes.pose_part(p, 0, recipe)
            matrix = Matrix.Translation(pos) @ Matrix.Rotation(rot.z, 4, 'Z') @ Matrix.Rotation(rot.y, 4, 'Y') @ Matrix.Rotation(rot.x, 4, 'X') @ Matrix.Diagonal((*p['size'], 1))
            points.extend(matrix @ corner for corner in corners)
    # Runtime uses Y up; the authored front (-Blender Y) becomes +Z.
    bounds = {'x': max(abs(p.x) for p in points)*2, 'y': max(p.z for p in points), 'z': max(abs(p.y) for p in points)*2}
    return dict(kind=recipe['kind'], role=recipe['role'], locomotion=recipe['locomotion'], variants=variants, bounds=bounds)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    parser.add_argument('--node', default='node')
    parser.add_argument('--sources', help='Comma-separated source IDs for a local sample export')
    parser.add_argument('--definitions-only', action='store_true', help='Stage assembly changes while retaining the current source GLBs')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    output = Path(args.output).resolve()
    if output == ROOT or ROOT in output.parents:
        parser.error('Export to an external staging directory before inspecting assets.')
    output.mkdir(parents=True, exist_ok=True)
    if args.sources:
        models={source:export_source(source,output) for source in args.sources.split(',')}
        (output/'sample-sources.json').write_text(json.dumps(models,indent=2),encoding='utf-8')
        print('SURFACE_SAMPLE_EXPORTED '+str(len(models)),flush=True)
        return
    authored_path = output / 'authored-enemies.json'
    subprocess.run([args.node, str(ROOT/'development/web-tools/build-enemy-models.mjs'), '--output='+str(authored_path)], check=True)
    authored = json.loads(authored_path.read_text(encoding='utf-8'))
    entities = {id: entity_definition(recipe) for id, recipe in recipes.RECIPES.items() if recipe['kind']=='towers'}
    entities.update({id: entity for id, entity in authored['entities'].items() if entity['kind']=='enemies' and entity.get('visualRevision')==2})
    sources = sorted({p['source'] for entity in entities.values() for parts in entity['variants'].values() for p in parts})
    models = authored['sources'] if args.definitions_only else {}
    for source in sources:
        if args.definitions_only:
            if source not in models:
                raise ValueError('Assembly requires a source export: '+source)
        else:
            models[source] = export_source(source, output)
            print('REALTIME_PART ' + source + ' ' + str(models[source]['triangles']), flush=True)
    metadata = dict(format=1, source='Kenney CC0 model parts; license notices are included in licenses/',
                    sources=models, entities=entities)
    (output/'models.json').write_text(json.dumps(metadata, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('REALTIME_EXPORT_OK ' + json.dumps(dict(entities=len(entities), sources=len(models), bytes=sum(m['bytes'] for m in models.values()))), flush=True)

if __name__ == '__main__':
    main()
