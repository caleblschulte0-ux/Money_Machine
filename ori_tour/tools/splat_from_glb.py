"""Turn a glTF figure into a Gaussian splat file (.splat), for TESTING the splat path.

A real splat figure is a capture: a person or object photographed from all
round and trained into splats (Scaniverse, Postshot, a capture studio). This
script only makes a stand-in from one of our meshes, so the page's splat
renderer can be tested before a capture exists. The result is labelled as made
from a model in src/core/figures.ts and never presented as a capture.

  python3.11 tools/splat_from_glb.py plain.glb out.splat --height 3.0 --yaw 90 --count 120000

Output: the antimatter15 .splat layout (32 bytes per splat: position f32x3,
scale f32x3, RGBA u8x4, rotation u8x4 as w,x,y,z), in metres, +y up, the
figure standing on y=0, centred on x/z, its front turned to -z by --yaw
(the same turn usdz_blender.py takes). Needs bpy (pip install bpy, Python 3.11).
"""
import argparse, math, struct, sys

import bpy
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("glb"); ap.add_argument("out")
ap.add_argument("--height", type=float, required=True)
ap.add_argument("--yaw", type=float, default=0.0, help="degrees about +up that turn the model's front to -z")
ap.add_argument("--count", type=int, default=120000)
ap.add_argument("--seed", type=int, default=1)
a = ap.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.glb)
shapes = set()
for o in list(bpy.context.scene.objects):
    if o.type == "ARMATURE":
        for pb in o.pose.bones:
            if pb.custom_shape:
                shapes.add(pb.custom_shape.name); pb.custom_shape = None
for n in shapes:
    if n in bpy.data.objects: bpy.data.objects.remove(bpy.data.objects[n])
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()

tris, uvs, imgs = [], [], []
for o in bpy.context.scene.objects:
    if o.type != "MESH": continue
    m = bpy.data.meshes.new_from_object(o.evaluated_get(dg), depsgraph=dg)
    m.transform(o.matrix_world)
    m.calc_loop_triangles()
    co = np.array([v.co[:] for v in m.vertices], np.float64)
    uvl = m.uv_layers.active.data if m.uv_layers else None
    for lt in m.loop_triangles:
        tris.append(co[list(lt.vertices)])
        uvs.append(np.array([uvl[i].uv[:] for i in lt.loops]) if uvl else np.zeros((3, 2)))
        mat = m.materials[lt.material_index] if m.materials else None
        img = None
        if mat and mat.node_tree:
            for n in mat.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image: img = n.image; break
        imgs.append(img)
tris = np.array(tris); uvs = np.array(uvs)
# Blender is z-up; the splat is y-up with -y(blender) -> +z: (x, y, z) -> (x, z, -y)
tris = tris[..., [0, 2, 1]] * np.array([1, 1, -1])
lo, hi = tris.reshape(-1, 3).min(0), tris.reshape(-1, 3).max(0)
s = a.height / (hi[1] - lo[1])
tris = (tris - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])) * s
yaw = math.radians(a.yaw)
R = np.array([[math.cos(yaw), 0, math.sin(yaw)], [0, 1, 0], [-math.sin(yaw), 0, math.cos(yaw)]])
tris = tris @ R.T

e1, e2 = tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0]
cross = np.cross(e1, e2); area = np.linalg.norm(cross, axis=1) / 2
rng = np.random.default_rng(a.seed)
pick = rng.choice(len(tris), size=a.count, p=area / area.sum())
r1, r2 = rng.random(a.count), rng.random(a.count)
flip = r1 + r2 > 1; r1[flip], r2[flip] = 1 - r1[flip], 1 - r2[flip]
t = tris[pick]
pos = t[:, 0] + r1[:, None] * (t[:, 1] - t[:, 0]) + r2[:, None] * (t[:, 2] - t[:, 0])
uv = uvs[pick]; uvp = uv[:, 0] + r1[:, None] * (uv[:, 1] - uv[:, 0]) + r2[:, None] * (uv[:, 2] - uv[:, 0])
normal = cross[pick] / np.maximum(np.linalg.norm(cross[pick], axis=1, keepdims=True), 1e-12)

col = np.full((a.count, 3), 0.6)
cache = {}
for i, img in enumerate(imgs):
    if img is not None and img.name not in cache:
        w, h = img.size; px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px)
        cache[img.name] = px.reshape(h, w, 4)
for k in range(a.count):
    img = imgs[pick[k]]
    if img is None: continue
    px = cache[img.name]; h, w = px.shape[:2]
    u, v = uvp[k] % 1.0
    col[k] = px[int(v * (h - 1)), int(u * (w - 1)), :3]

# each splat: a flat disc in the surface, sized so the discs just cover it
r = math.sqrt(area.sum() * s * s / a.count / math.pi) * 1.25
scale = np.tile([r, r, r * 0.15], (a.count, 1))
# rotation taking +z to the normal
z = np.array([0, 0, 1.0])
axis = np.cross(np.broadcast_to(z, normal.shape), normal)
sin = np.linalg.norm(axis, axis=1); cos = normal @ z
ang = np.arctan2(sin, cos)
axis = axis / np.maximum(sin[:, None], 1e-12); axis[sin < 1e-9] = [1, 0, 0]
q = np.concatenate([np.cos(ang / 2)[:, None], axis * np.sin(ang / 2)[:, None]], 1)  # w, x, y, z

rgba = np.concatenate([np.clip(col, 0, 1) * 255, np.full((a.count, 1), 255)], 1).astype(np.uint8)
rot = np.clip(q * 128 + 128, 0, 255).astype(np.uint8)
rec = np.zeros(a.count, dtype=[("p", "<f4", 3), ("s", "<f4", 3), ("c", "u1", 4), ("r", "u1", 4)])
rec["p"], rec["s"], rec["c"], rec["r"] = pos, scale, rgba, rot
rec.tofile(a.out)
print(f"{a.out}: {a.count} splats, {rec.nbytes} bytes, height {pos[:, 1].max():.2f} m")
