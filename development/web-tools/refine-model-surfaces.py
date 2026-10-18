"""Local surface refinement for the retained Kenney CC0 mechanical sources.

Circular source strips are retopologized along their measured radial profiles.
The drive wheel retains the source hub and adds a rounded tyre, recessed rims
and fasteners around it. Original source GLBs stay byte-for-byte unchanged.
"""
import math
import bpy
import bmesh
from mathutils import Vector

DRIVE_WHEEL = 'refined/drive-wheel'
WHEEL_PARENT = 'tower-defense-kit/tower-round-middle-a'
ROUND_SOURCES = {
    WHEEL_PARENT, 'tower-defense-kit/tower-round-bottom-c', 'tower-defense-kit/tower-round-top-a',
    *('space-kit/' + name for name in ['rocket_fuelA', 'rocket_fuelB', 'rocket_sidesA',
       'rocket_topA', 'rocket_topB', 'machine_barrel', 'machine_barrelLarge']),
}
CURVED_SOURCES = {'space-kit/'+name for name in ['hangar_roundA','hangar_roundB',
                  'satelliteDish','satelliteDish_detailed','satelliteDish_large']}


def refine_curved_shell(obj, level):
    """Smooth the original vault/dish topology while retaining panel boundaries."""
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    bmesh.ops.dissolve_limit(bm,angle_limit=math.radians(.5),verts=list(bm.verts),
                             edges=list(bm.edges),delimit={'MATERIAL'})
    bm.normal_update()
    crease=bm.edges.layers.float.get('crease_edge') or bm.edges.layers.float.new('crease_edge')
    for edge in bm.edges:
        hard=edge.is_boundary or len(edge.link_faces)!=2
        if not hard:
            hard=edge.calc_face_angle(0)>math.radians(55) or edge.link_faces[0].material_index!=edge.link_faces[1].material_index
        edge[crease]=1 if hard else 0
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    subdivision=obj.modifiers.new('continuous_curved_skin','SUBSURF')
    subdivision.levels=2 if level==0 else 1
    subdivision.render_levels=subdivision.levels
    subdivision.boundary_smooth='PRESERVE_CORNERS'
    bpy.ops.object.modifier_apply(modifier=subdivision.name)


def round_source_strips(mesh, cuts):
    """Subdivide circular side strips, preserving panel faces and cap interiors."""
    bm = bmesh.new(); bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
    rings = {}
    for v in bm.verts:
        r = math.hypot(v.co.x, v.co.y)
        rings.setdefault((round(v.co.z, 4), round(r, 3)), []).append(v)
    radial = set()
    for (z, radius), vertices in rings.items():
        if radius < .035 or len(vertices) < 8:
            continue
        angles = sorted({round(math.atan2(v.co.y, v.co.x), 5) for v in vertices})
        gaps = [(angles[(i+1) % len(angles)] - a) % math.tau for i, a in enumerate(angles)]
        if len(angles) >= 8 and max(gaps) < .81 and min(gaps) > .08:
            radial.update(vertices)
    strips, edges = [], set()
    for face in bm.faces:
        if len(face.verts) != 3 or not all(v in radial for v in face.verts):
            continue
        points = [v.co.copy() for v in face.verts]
        if max(p.z for p in points) - min(p.z for p in points) < .00001:
            continue
        a, b, c = points; u, v = b-a, c-a
        normal = u.cross(v)
        if normal.length < .000001:
            continue
        if max((p.xy.normalized()-q.xy.normalized()).length for p in points for q in points) > .9:
            continue
        uv, uu, vv = u.dot(v), u.dot(u), v.dot(v); denominator = uu*vv-uv*uv
        strips.append((a, u, v, normal.normalized(), uv, uu, vv, denominator,
                       [math.hypot(p.x, p.y) for p in points]))
        edges.update(face.edges)
    if edges:
        bmesh.ops.subdivide_edges(bm, edges=list(edges), cuts=cuts, use_grid_fill=True)
        targets = []
        for vertex in bm.verts:
            p = vertex.co.copy()
            for a, u, v, normal, uv, uu, vv, denominator, radii in strips:
                q = p-a
                if abs(q.dot(normal)) > .00001:
                    continue
                bu = (q.dot(u)*vv-q.dot(v)*uv)/denominator
                bv = (q.dot(v)*uu-q.dot(u)*uv)/denominator
                if min(bu, bv, 1-bu-bv) < -.00001:
                    continue
                radius = radii[0]*(1-bu-bv)+radii[1]*bu+radii[2]*bv
                length = math.hypot(p.x, p.y)
                if length > .00001:
                    targets.append((vertex, Vector((p.x*radius/length, p.y*radius/length, p.z))))
                break
        for vertex, target in targets:
            vertex.co = target
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh); bm.free(); mesh.update()


def lathe(name, profile, segments, material, recipes, center=(0,0,0), shoulder_tread=False):
    vertices, faces = [], []
    for radius, z in profile:
        for i in range(segments):
            angle = i*math.tau/segments
            # Shallow shoulder sipes leave the continuous central contact rib.
            r = radius - (.006 if shoulder_tread and .12 < z < .25 and i % 4 == 1 else 0)
            vertices.append((center[0]+r*math.cos(angle), center[1]+r*math.sin(angle), center[2]+z))
    for j in range(len(profile)-1):
        for i in range(segments):
            k=(i+1)%segments
            faces.append((j*segments+i,j*segments+k,(j+1)*segments+k,(j+1)*segments+i))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces)
    for finish in recipes.PALETTES['towers']:
        mesh.materials.append(recipes.material('towers',finish))
    index=list(recipes.PALETTES['towers']).index(material)
    for face in mesh.polygons:
        face.material_index=index;face.use_smooth=True
    mesh.update()
    return mesh


def drive_wheel_meshes(recipes, level):
    meshes=[]
    # Keep the licensed cast hub, now recessed inside the continuous rim.
    for source in recipes.template(WHEEL_PARENT,'towers','native'):
        mesh=source.copy()
        if level==0:
            round_source_strips(mesh,1)
        for v in mesh.vertices:
            v.co.x*=.44;v.co.y*=.44;v.co.z=v.co.z*.80+.10
        mesh.update();meshes.append(mesh)
    near=[(.31,.035),(.38,.035),(.433,.06),(.466,.10),(.487,.17),(.499,.25),
          (.5,.30),(.5,.40),(.484,.422),(.484,.452),(.5,.474),(.5,.526),
          (.484,.548),(.484,.578),(.5,.60),(.5,.70),(.499,.75),(.487,.83),
          (.466,.90),(.433,.94),(.38,.965),(.31,.965),(.31,.035)]
    far=[(.31,.035),(.44,.07),(.5,.30),(.5,.70),(.44,.93),(.31,.965),(.31,.035)]
    meshes.append(lathe('rounded_tyre',near if level==0 else far,64,'dark',recipes,shoulder_tread=level==0))
    rim=[(.12,.135),(.18,.16),(.255,.115),(.29,.04),(.315,.012),(.33,.022),
         (.333,.047),(.318,.075),(.29,.095),(.26,.17),(.18,.205),(.12,.18),(.12,.135)]
    if level==1:
        rim=[(.12,.135),(.255,.115),(.315,.012),(.33,.047),(.26,.17),(.12,.18),(.12,.135)]
    for side in [0,1]:
        profile=rim if side==0 else [(r,1-z) for r,z in reversed(rim)]
        meshes.append(lathe('recessed_rim',profile,48 if level==0 else 16,'metal',recipes))
        if level==0:
            for i in range(6):
                a=math.tau*i/6;cx,cy=.215*math.cos(a),.215*math.sin(a)
                bolt=[(.023,.10),(.028,.108),(.028,.137),(.022,.145),(.012,.145),(.012,.137),(.023,.10)]
                profile=bolt if side==0 else [(r,1-z) for r,z in reversed(bolt)]
                meshes.append(lathe('recessed_fastener',profile,6,'gold',recipes,center=(cx,cy,0)))
    return meshes
