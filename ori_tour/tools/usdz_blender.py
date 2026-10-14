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
a.add_argument("--tint", default=None, help="0xRRGGBB base colour for a model with no colour texture")
a.add_argument("--max-tris", type=int, default=60000, help="decimate a static mesh above this (USDZ size)")
a.add_argument("--fur", default=None, help="the figure's FigureFur as JSON: grow it as shell fur Quick Look can show")
a.add_argument("--fur-shells", type=int, default=6, help="shells in the USDZ (fewer than the page: download size)")
a.add_argument("--fur-tris", type=int, default=12000, help="triangles per fur shell")
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

# a bare scan has no colour texture: give it the tint the phone draws it with
if args.tint:
    v = int(args.tint, 16)
    srgb = [((v >> s) & 255) / 255 for s in (16, 8, 0)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    for m in bpy.data.materials:
        b = m.node_tree and m.node_tree.nodes.get("Principled BSDF")
        if b and not b.inputs["Base Color"].is_linked:
            b.inputs["Base Color"].default_value = (*lin, 1)

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


def saved_image(name, rgba, colorspace):
    """Write pixels to a file in tmp and load it back as a FILE image (a generated
    image regenerates, losing its pixels, when its colour space changes)."""
    import numpy as np

    h, w = rgba.shape[:2]
    img = bpy.data.images.new(name, w, h)
    img.pixels.foreach_set(np.clip(rgba, 0, 1).astype(np.float32).ravel())
    path = os.path.join(tmp, name)
    img.filepath_raw = path
    img.file_format = "JPEG" if name.endswith(".jpg") else "PNG"
    img.save()
    bpy.data.images.remove(img)
    out = bpy.data.images.load(path)
    out.colorspace_settings.name = colorspace
    return out


def grow_fur(fur):
    """Shell fur Quick Look can show: --fur-shells decimated copies of the skinned
    mesh, each pushed out along its normal, skinned to the same bones, cut to
    strands by one strand map. The map holds len * (1 - 2d) per texel (a rounded cone
    per strand); a shell at height s keeps the texels above s through UsdPreviewSurface's
    opacityThreshold, which is the page's test (src/web/fur3d.ts) in one texture."""
    import numpy as np

    skinned = [o for o in scene.objects if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers)]
    for o in skinned:
        mat = o.active_material
        tex = mat and next((n.image for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image), None)
        if tex is None:
            continue
        w, h = tex.size
        px = np.empty(w * h * 4, np.float32)
        tex.pixels.foreach_get(px)
        px = px.reshape(h, w, 4)  # row 0 is the bottom; values are the stored sRGB
        lin = np.where(px[..., :3] <= 0.04045, px[..., :3] / 12.92, ((px[..., :3] + 0.055) / 1.055) ** 2.4)
        lum = lin @ np.array([0.299, 0.587, 0.114], np.float32)

        me = o.data
        nv = len(me.vertices)
        # each vertex's texture brightness, from its loops' UVs
        uv = np.empty(len(me.loops) * 2, np.float32)
        me.uv_layers.active.data.foreach_get("uv", uv)
        uv = uv.reshape(-1, 2) % 1.0
        lv = np.empty(len(me.loops), np.int64)
        me.loops.foreach_get("vertex_index", lv)
        l_lum = lum[(uv[:, 1] * (h - 1)).astype(int), (uv[:, 0] * (w - 1)).astype(int)]
        v_sum = np.bincount(lv, l_lum, nv)
        v_cnt = np.maximum(np.bincount(lv, None, nv), 1)
        # connected pieces (union-find over polygon edges)
        parent = np.arange(nv)

        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        for poly in me.polygons:
            vs = poly.vertices
            r0 = find(vs[0])
            for v in vs[1:]:
                r = find(v)
                if r != r0:
                    parent[r] = r0
        roots_ = np.array([find(i) for i in range(nv)])
        p_sum = np.bincount(roots_, v_sum / v_cnt, nv)
        p_cnt = np.maximum(np.bincount(roots_, None, nv), 1)
        mean = (p_sum / p_cnt)[roots_]
        bare = (mean > fur["bareAbove"]) | (mean < fur["bareBelow"])
        print(f"fur: {int(bare.sum())} of {nv} vertices bare")

        # the coat colour, with the model's painted hair and baked shading kept as light and dark
        def lin_hex(v):
            c = np.array([(v >> 16) & 255, (v >> 8) & 255, v & 255], np.float32) / 255
            return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

        coat_lin = lin_hex(fur["rootColor"]) * 0.55 + lin_hex(fur["tipColor"]) * 0.45  # one colour per shell: near the root, or tips speckle
        shade = np.clip(lum / 0.06, 0.35, 1.8)[..., None]
        c = np.clip(coat_lin * shade, 0, 1)
        c = np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)
        coat = saved_image("fur_coat.jpg", np.concatenate([c, np.ones((h, w, 1), np.float32)], 2), "sRGB")
        # the skin under the coat in the root colour, so gaps between strands read as dense fur
        # (as the page does); the bare pieces keep the model's own material
        r_ = np.clip(lin_hex(fur["rootColor"]) * shade, 0, 1)
        r_ = np.where(r_ <= 0.0031308, r_ * 12.92, 1.055 * r_ ** (1 / 2.4) - 0.055)
        skin = saved_image("fur_root.jpg", np.concatenate([r_, np.ones((h, w, 1), np.float32)], 2), "sRGB")
        own = mat.copy()
        own.name = "bare"
        mat.node_tree.nodes[next(n.name for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image)].image = skin
        me.materials.append(own)
        bare_faces = np.array([all(bare[v] for v in p.vertices) for p in me.polygons])
        me.polygons.foreach_set("material_index", np.where(bare_faces, len(me.materials) - 1, 0).astype(np.int32))

        # the strand map: a cone per strand, height = the strand's length
        n = max(8, int(fur["strands"] * 0.35))  # coarser than the page: about 4 px per strand in a 1024 px map
        S = 1024
        rng = np.random.default_rng(7)
        hsh = rng.random((n, n), dtype=np.float32)
        jx, jy = (rng.random((n, n), dtype=np.float32) - 0.5) * 0.5, (rng.random((n, n), dtype=np.float32) - 0.5) * 0.5
        g = (np.arange(S, dtype=np.float32) + 0.5) / S * n
        gx, gy = np.meshgrid(g, g)
        cx, cy = gx.astype(int), gy.astype(int)
        fx, fy = gx - cx - 0.5 - jx[cy, cx], gy - cy - 0.5 - jy[cy, cx]
        ln = 0.4 + 0.6 * hsh[cy, cx] ** 2
        cone = ln * np.clip(1 - 2 * np.sqrt(fx * fx + fy * fy), 0, 1) ** 0.6  # rounded, so strands keep some body
        mask = saved_image("fur_strands.png", np.repeat(cone[..., None], 4, 2), "Non-Color")

        ws = o.matrix_world.to_scale()
        len_local = fur["lengthM"] / ((ws.x + ws.y + ws.z) / 3)
        down = (o.matrix_world.inverted().to_3x3() @ Vector((0, 0, -1))).normalized()
        co = np.empty(nv * 3, np.float32)
        me.vertices.foreach_get("co", co)
        nrm = np.empty(nv * 3, np.float32)
        me.vertices.foreach_get("normal", nrm)
        co, nrm = co.reshape(-1, 3), nrm.reshape(-1, 3)
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        shells = args.fur_shells
        for i in range(1, shells + 1):
            t = i / shells
            sh = o.copy()
            sh.data = me.copy()
            sh.name = f"{o.name}_fur{i}"
            for coll in o.users_collection:
                coll.objects.link(sh)
            moved = co + nrm * (t * len_local) + np.array(down) * (len_local * 0.8 * t * t)
            sh.data.vertices.foreach_set("co", moved.ravel())
            import bmesh

            bm = bmesh.new()
            bm.from_mesh(sh.data)
            bm.verts.ensure_lookup_table()
            bmesh.ops.delete(bm, geom=[bm.verts[j] for j in np.nonzero(bare)[0]], context="VERTS")
            bm.to_mesh(sh.data)
            bm.free()
            d = sh.modifiers.new("decimate", "DECIMATE")
            d.ratio = min(1.0, args.fur_tris / tris)
            bpy.context.view_layer.objects.active = sh
            bpy.ops.object.modifier_move_to_index(modifier=d.name, index=0)
            bpy.ops.object.modifier_apply(modifier=d.name)
            m = bpy.data.materials.new(f"fur{i}")
            m.use_nodes = True
            nt = m.node_tree
            b = nt.nodes["Principled BSDF"]
            b.inputs["Roughness"].default_value = 1.0
            ct = nt.nodes.new("ShaderNodeTexImage")
            ct.image = coat
            mt = nt.nodes.new("ShaderNodeTexImage")
            mt.image = mask
            gt = nt.nodes.new("ShaderNodeMath")
            gt.operation = "GREATER_THAN"
            gt.inputs[1].default_value = t - 1e-3
            nt.links.new(ct.outputs["Color"], b.inputs["Base Color"])
            nt.links.new(mt.outputs["Color"], gt.inputs[0])
            nt.links.new(gt.outputs[0], b.inputs["Alpha"])
            sh.data.materials.clear()
            sh.data.materials.append(m)
        print(f"fur: {shells} shells of about {args.fur_tris} triangles, {fur['lengthM']} m")


if args.fur:
    import json

    grow_fur(json.loads(args.fur))
    bpy.context.view_layer.update()

# with fur, export to a plain USD first: Blender writes the strand map as the
# shells' opacity but not the threshold that cuts it into strands
export_to = os.path.join(tmp, "figure.usdc") if args.fur else args.out
bpy.ops.wm.usd_export(
    filepath=export_to,
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

if args.fur:
    from pxr import Sdf, Usd, UsdShade, UsdUtils

    stage = Usd.Stage.Open(export_to)
    for prim in stage.Traverse():
        name = prim.GetParent().GetName() if prim.GetParent() else ""
        if prim.GetTypeName() == "Shader" and name.startswith("fur") and name[3:].isdigit():
            s = UsdShade.Shader(prim)
            if s.GetIdAttr().Get() == "UsdPreviewSurface":
                s.CreateInput("opacityThreshold", Sdf.ValueTypeNames.Float).Set(int(name[3:]) / args.fur_shells - 1e-3)
    stage.GetRootLayer().Save()
    if not UsdUtils.CreateNewARKitUsdzPackage(Sdf.AssetPath(export_to), args.out):
        raise SystemExit("could not package the USDZ")
