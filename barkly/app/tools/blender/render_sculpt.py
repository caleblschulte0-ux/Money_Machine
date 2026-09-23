"""Light and render a sculpted PLY (tools/sculpt/) in the canon's style.

Blender does not model anything here -- the form comes from the distance
field. This only applies the flocked vinyl material (reading the per-vertex
paint) and the studio softbox from toybox.py, with the shared camera.

    blender -b --python tools/blender/render_sculpt.py -- IN.ply OUT.png [ortho] [target_z]
"""
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import toybox                      # noqa: E402
import world_prop_pack as pack     # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
src, out = argv[0], argv[1]
ortho = float(argv[2]) if len(argv) > 2 else 6.2
tz = float(argv[3]) if len(argv) > 3 else 2.1

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
toybox.studio(target=(0.0, 0.0, tz), key_energy=3600.0)

bpy.ops.wm.ply_import(filepath=src)
obj = bpy.context.selected_objects[0]
for poly in obj.data.polygons:
    poly.use_smooth = True

# Flocked vinyl, but coloured by the sculpt's paint instead of one constant.
mat = toybox.flock_painted("Sculpt flock", nap=0.62)
obj.data.materials.clear()
obj.data.materials.append(mat)

bpy.ops.object.camera_add(location=(0.0, -11.2, 4.5))
cam = bpy.context.object
cam.data.type = "ORTHO"
cam.data.ortho_scale = ortho
pack.look_at(cam, (0.0, 0.0, tz))
scene = bpy.context.scene
scene.camera = cam
scene.render.resolution_x, scene.render.resolution_y = 600, 760
scene.render.film_transparent = True
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print(f"rendered {out}")
