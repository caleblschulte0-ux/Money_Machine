"""Render modular Home architecture pieces for Barkly.

These are transparent structural overlays, not baked rooms. The app keeps the
live sky, time-of-day, upgrades, layout, and interaction logic; Blender supplies
physical thickness, bevels, and a shared light response for the frame itself.
"""
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "art-review" / "home-architecture"
OUT.mkdir(parents=True, exist_ok=True)

CAMERA_LOCATION = (3.0, -10.8, 4.5)


def rgb(value: str):
    value = value.lstrip('#')
    return tuple(int(value[i:i+2], 16) / 255 for i in (0, 2, 4))


def look_at(obj, target=(0.0, 0.0, 0.25)):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def mat(name, color, roughness=0.48, metallic=0.0, coat=0.06):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb(color), 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if 'Coat Weight' in bsdf.inputs:
        bsdf.inputs['Coat Weight'].default_value = coat
    elif 'Clearcoat' in bsdf.inputs:
        bsdf.inputs['Clearcoat'].default_value = coat
    return m


def cube(name, loc, scale, material, bevel=0.14):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = o.modifiers.new('Molded edge', 'BEVEL')
    mod.width = bevel
    mod.segments = 5
    o.data.materials.append(material)
    return o


def clean():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def setup():
    scene = bpy.context.scene
    try:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except (TypeError, ValueError):
        scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 640
    scene.render.resolution_y = 760
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = True
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass

    bpy.ops.object.camera_add(location=CAMERA_LOCATION)
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 6.1
    look_at(cam, (0, 0, 1.55))
    scene.camera = cam

    bpy.ops.object.light_add(type='AREA', location=(-4.5, -4.8, 8.0))
    key = bpy.context.object
    key.data.energy = 1050
    key.data.size = 5.0
    key.data.color = (1.0, 0.76, 0.55)
    look_at(key, (0, 0, 1.4))

    bpy.ops.object.light_add(type='AREA', location=(4.5, -2.0, 4.0))
    fill = bpy.context.object
    fill.data.energy = 300
    fill.data.size = 5.0
    fill.data.color = (0.58, 0.78, 1.0)
    look_at(fill, (0, 0, 1.4))

    bpy.ops.object.light_add(type='AREA', location=(0.8, 3.5, 6.4))
    rim = bpy.context.object
    rim.data.energy = 450
    rim.data.size = 3.8
    rim.data.color = (1.0, 0.86, 0.66)
    look_at(rim, (0, 0, 1.4))


def build_window_frame():
    wood = mat('Honey molded wood', '#A9652E', roughness=0.44, coat=0.09)
    wood_dark = mat('Recess edge', '#6F3A1E', roughness=0.56, coat=0.04)
    sill = mat('Warm sill', '#B97535', roughness=0.42, coat=0.10)
    brass = mat('Upgrade brass', '#D39B38', roughness=0.30, metallic=0.55, coat=0.05)

    # Shadow/recess lip sits behind the brighter frame and makes the window feel
    # cut into a wall even though the live sky is composited by React Native.
    cube('left_recess', (-1.58, 0.22, 1.55), (0.24, 0.20, 1.72), wood_dark, 0.18)
    cube('right_recess', (1.58, 0.22, 1.55), (0.24, 0.20, 1.72), wood_dark, 0.18)
    cube('top_recess', (0, 0.22, 3.15), (1.60, 0.20, 0.24), wood_dark, 0.18)

    cube('left_frame', (-1.47, 0.0, 1.55), (0.18, 0.28, 1.62), wood, 0.15)
    cube('right_frame', (1.47, 0.0, 1.55), (0.18, 0.28, 1.62), wood, 0.15)
    cube('top_frame', (0, 0.0, 3.07), (1.50, 0.28, 0.18), wood, 0.15)
    cube('bottom_frame', (0, 0.0, 0.08), (1.50, 0.28, 0.18), wood, 0.14)

    # Crossbars sit slightly proud of the outer frame.
    cube('vertical_mullion', (0, -0.05, 1.56), (0.10, 0.20, 1.46), wood, 0.08)
    cube('horizontal_mullion', (0, -0.05, 1.52), (1.35, 0.20, 0.10), wood, 0.08)

    # The sill projects into the room. Its extra depth and highlight are what a
    # flat SVG rectangle cannot convincingly fake.
    cube('sill_body', (0, -0.27, -0.15), (1.76, 0.48, 0.16), sill, 0.16)
    cube('sill_glint', (-0.12, -0.70, -0.03), (1.34, 0.025, 0.035), brass, 0.03)


clean()
setup()
build_window_frame()
scene = bpy.context.scene
scene.render.filepath = str(OUT / 'window_frame.png')
bpy.ops.render.render(write_still=True)
print(f'rendered {scene.render.filepath}')
