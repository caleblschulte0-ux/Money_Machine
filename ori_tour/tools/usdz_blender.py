"""Write an AR Quick Look USDZ from a figure's glb with Blender (pip `bpy`).

three.js's USDZExporter writes a static mesh as text, so the iPhone figure had
to be cut to 20,000 triangles and 512 px textures and never moved. Blender
writes binary USD: the full mesh, the full textures, the skeleton and the idle
clip, which Quick Look plays on a loop.

    python3.11 tools/usdz_blender.py <in.glb> <out.usdz> --height 3.0 --yaw 180 [--clip Idle]

`in.glb` must be plain glTF (no meshopt); tools/build_figures.mjs --usdz decodes
first. --yaw is the total turn about up, degrees, so the figure faces the way
Quick Look shows it (the viewer looks at the model's +z). The figure is scaled
to --height metres, stood on the ground and centred on its footprint.
"""

import argparse
import sys

import bpy
from mathutils import Matrix, Vector

a = argparse.ArgumentParser()
a.add_argument("glb")
a.add_argument("out")
a.add_argument("--height", type=float, required=True)
a.add_argument("--yaw", type=float, default=0.0)
a.add_argument("--clip", default=None)
a.add_argument("--max-tris", type=int, default=60000, help="decimate a static mesh above this (USDZ size)")
args = a.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args.glb)
scene = bpy.context.scene
# Blender's glTF importer adds a mesh (an icosphere) to draw bones with; it is not part of the figure
shapes = {b.custom_shape for o in scene.objects if o.type == "ARMATURE" for b in o.pose.bones if b.custom_shape}
for o in shapes:
    bpy.data.objects.remove(o, do_unlink=True)
objs = list(scene.objects)
roots = [o for o in objs if o.parent is None]

# play the idle clip only: drop every other action from the armature
if args.clip:
    for o in objs:
        ad = o.animation_data
        if not ad:
            continue
        clip = next((x for x in bpy.data.actions if x.name.startswith(args.clip)), None)
        if clip is None:
            raise SystemExit(f"no action named {args.clip}: {[x.name for x in bpy.data.actions]}")
        for t in list(ad.nla_tracks):
            ad.nla_tracks.remove(t)
        ad.action = clip
        start, end = clip.frame_range
        scene.frame_start, scene.frame_end = int(start), int(end)
else:
    for o in objs:
        if o.animation_data:
            o.animation_data_clear()

# a static scan of 100,000 triangles is an 8 MB download Quick Look must finish
# before it shows anything; past --max-tris, decimate (never a skinned mesh)
for o in [o for o in scene.objects if o.type == "MESH" and not any(m.type == "ARMATURE" for m in o.modifiers)]:
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tris > args.max_tris:
        d = o.modifiers.new("decimate", "DECIMATE")
        d.ratio = args.max_tris / tris
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=d.name)
        print(f"{o.name}: {tris} triangles decimated to {sum(len(p.vertices) - 2 for p in o.data.polygons)}")

bpy.context.view_layer.update()

# USDZ carries PNG or JPEG only; Quick Look shows a WebP texture as untextured
import os
import tempfile

tmp = tempfile.mkdtemp()
bpy.context.scene.render.image_settings.quality = 90
for img in bpy.data.images:
    if img.source == "FILE" and img.file_format not in ("PNG", "JPEG"):
        path = os.path.join(tmp, f"{img.name.rsplit('.', 1)[0]}.jpg")
        img.filepath_raw = path
        img.file_format = "JPEG"
        img.save()
        img.packed_files and img.unpack(method="REMOVE")
        img.filepath = path
        img.reload()


def bounds():
    lo = Vector((1e9, 1e9, 1e9))
    hi = -lo
    for o in scene.objects:
        if o.type != "MESH":
            continue
        dg = bpy.context.evaluated_depsgraph_get()
        m = o.evaluated_get(dg).to_mesh()
        for v in m.vertices:
            w = o.matrix_world @ v.co
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
        o.evaluated_get(dg).to_mesh_clear()
    return lo, hi


lo, hi = bounds()
k = args.height / (hi.z - lo.z)
centre = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
fit = Matrix.Rotation(args.yaw * 3.141592653589793 / 180, 4, "Z") @ Matrix.Scale(k, 4) @ Matrix.Translation(-centre)
for r in roots:
    r.matrix_world = fit @ r.matrix_world
bpy.context.view_layer.update()
lo, hi = bounds()
print(f"size {hi.x - lo.x:.2f} x {hi.y - lo.y:.2f} x {hi.z - lo.z:.2f} m, ground {lo.z:.3f}")

bpy.ops.wm.usd_export(
    filepath=args.out,
    export_animation=args.clip is not None,
    export_armatures=True,
    export_shapekeys=True,
    export_textures_mode="NEW",
    usdz_downscale_size="KEEP",
    export_materials=True,
    generate_preview_surface=True,
    root_prim_path="/root",
    convert_orientation=True,
    export_global_up_selection="Y",
    export_global_forward_selection="NEGATIVE_Z",
    export_lights=False,
    export_cameras=False,
    convert_world_material=False,
)
