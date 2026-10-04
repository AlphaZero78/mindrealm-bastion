"""Export reusable, articulated Kenney parts for the live PBR renderer.

Run with Blender 4.5+ and --output <external staging directory>. Runtime
assemblies reuse the existing authored recipes; no primitive stand-ins are made.
LOD0 adds small three-segment bevels. LOD1 retains the original licensed geometry.
"""
import argparse
import importlib.util
import json
import math
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
    sources = recipes.template(source, 'towers', 'native')
    material_names = list(recipes.PALETTES['towers'])
    counts = [0, 0]
    for level in [0, 1]:
        for source_mesh in sources:
            obj = bpy.data.objects.new('normalized_source', source_mesh.copy())
            bpy.context.scene.collection.objects.link(obj)
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            # GLTF duplicates vertices at UV/normal seams. Weld coincident
            # positions so bevels operate on the original solid panel edges.
            topology=bmesh.new();topology.from_mesh(obj.data)
            bmesh.ops.remove_doubles(topology,verts=list(topology.verts),dist=.00001)
            topology.to_mesh(obj.data);topology.free();obj.data.update()
            # Smooth curved faces while preserving the source's hard panel edges.
            for p in obj.data.polygons:
                p.use_smooth = True
            obj.data.set_sharp_from_angle(angle=math.radians(38))
            if level == 0:
                bevel = obj.modifiers.new('machined_edges', 'BEVEL')
                bevel.width = .022
                bevel.segments = 3
                bevel.limit_method = 'ANGLE'
                bevel.angle_limit = math.radians(35)
                bevel.harden_normals = True
                bpy.ops.object.modifier_apply(modifier=bevel.name)
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
    return {'path': '/assets/game/models/' + path.name, 'triangles': counts, 'bytes': path.stat().st_size}

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
            for x in [-.56,.56]:
                additions.append(recipes.sp('machine_generator',(.19,.31,.24),(x,.34,.43),finish='metal'))
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
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    output = Path(args.output).resolve()
    if output == ROOT or ROOT in output.parents:
        parser.error('Export to an external staging directory before inspecting assets.')
    output.mkdir(parents=True, exist_ok=True)
    entities = {id: entity_definition(recipe) for id, recipe in recipes.RECIPES.items()}
    sources = sorted({p['source'] for entity in entities.values() for parts in entity['variants'].values() for p in parts})
    models = {}
    for source in sources:
        models[source] = export_source(source, output)
        print('REALTIME_PART ' + source + ' ' + str(models[source]['triangles']), flush=True)
    metadata = dict(format=1, source='Kenney CC0; see development/assets/model_sources', blender=bpy.app.version_string,
                    sources=models, entities=entities)
    (output/'models.json').write_text(json.dumps(metadata, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('REALTIME_EXPORT_OK ' + json.dumps(dict(entities=len(entities), sources=len(models), bytes=sum(m['bytes'] for m in models.values()))), flush=True)

if __name__ == '__main__':
    main()
