"""Headless Blender smoke/material scene for Barkly art production.

Run with:
  blender -b --python tools/blender/material_scene.py

The point is not to ship these objects. It proves the repo can author and render
real 3D toy materials/lighting for production studies without a paid service.
"""
from __future__ import annotations

from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "art-review" / "blender"
OUT.mkdir(parents=True, exist_ok=True)

# Clean scene.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

scene = bpy.context.scene
# Ubuntu 24.04 currently provides Blender 4.x. Keep a fallback for older local installs.
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except (TypeError, ValueError):
    scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1100
scene.render.resolution_y = 760
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.world.color = (0.035, 0.022, 0.017)


def look_at(obj, target=(0, 0, 0)):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def mat(name, base, roughness, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = 0.22 if metallic < 0.5 else 0.08
        bsdf.inputs["Coat Roughness"].default_value = 0.16
    elif "Clearcoat" in bsdf.inputs:
        bsdf.inputs["Clearcoat"].default_value = 0.22 if metallic < 0.5 else 0.08
        bsdf.inputs["Clearcoat Roughness"].default_value = 0.16
    return m


def beveled_cube(name, loc, scale, material, bevel=0.24):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = o.modifiers.new("Soft molded edge", "BEVEL")
    mod.width = bevel
    mod.segments = 5
    o.data.materials.append(material)
    return o


def sphere(name, loc, radius, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, location=loc, radius=radius)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o


cream = mat("Warm enamel", (0.96, 0.79, 0.48), 0.24)
aqua = mat("Candy aqua", (0.055, 0.53, 0.78), 0.18)
coral = mat("Soft coral rubber", (0.82, 0.16, 0.12), 0.34)
wood = mat("Painted warm wood", (0.34, 0.13, 0.055), 0.46)
brass = mat("Brass reward metal", (0.66, 0.31, 0.055), 0.23, 0.86)
charcoal = mat("Charcoal rubber", (0.025, 0.021, 0.018), 0.42)

beveled_cube("plinth", (0, 0, -0.52), (5.5, 3.0, 0.42), wood, 0.32)
beveled_cube("cream_panel", (-3.6, 0.3, 0.45), (1.18, 0.72, 0.72), cream, 0.34)
sphere("aqua_ball", (-1.25, 0.2, 0.55), 0.92, aqua)
beveled_cube("coral_button", (1.0, 0.2, 0.45), (1.0, 0.72, 0.55), coral, 0.42)
sphere("brass_coin", (3.15, 0.15, 0.56), 0.88, brass)
bpy.context.object.scale.y = 0.34
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
beveled_cube("charcoal_strip", (0, -1.65, 0.02), (3.9, 0.38, 0.25), charcoal, 0.18)

bpy.ops.object.camera_add(location=(8.4, -11.2, 7.2))
cam = bpy.context.object
look_at(cam, (0, 0, 0.35))
cam.data.lens = 54
scene.camera = cam

bpy.ops.object.light_add(type="AREA", location=(-4.5, -4.5, 8.5))
key = bpy.context.object
key.data.energy = 1150
key.data.shape = "DISK"
key.data.size = 5.0
key.data.color = (1.0, 0.72, 0.48)
look_at(key, (0, 0, 0))

bpy.ops.object.light_add(type="AREA", location=(5.5, -1.0, 4.5))
fill = bpy.context.object
fill.data.energy = 620
fill.data.size = 5.5
fill.data.color = (0.55, 0.82, 1.0)
look_at(fill, (0, 0, 0.5))

bpy.ops.object.light_add(type="AREA", location=(0, 4.0, 7.5))
rim = bpy.context.object
rim.data.energy = 1000
rim.data.size = 3.0
rim.data.color = (1.0, 0.84, 0.58)
look_at(rim, (0, 0, 0.2))

scene.render.filepath = str(OUT / "barkly-material-scene.png")
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "barkly-material-scene.blend"))
print(f"rendered {scene.render.filepath}")
