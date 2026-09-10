"""Render modular Home architecture pieces for Barkly.

These are transparent structural overlays, not baked rooms. The app keeps the
live sky, time-of-day, upgrades, layout, and interaction logic; Blender supplies
physical thickness, bevels, and a shared light response for the frame itself.
"""
from pathlib import Path
import hashlib
import os

import bpy

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from palette import light_rgb, tone  # noqa: E402  -- the one place a colour comes from
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "art-review" / "home-architecture"
OUT.mkdir(parents=True, exist_ok=True)

CAMERA_LOCATION = (3.0, -10.8, 4.5)


def _srgb_to_linear(channel: float) -> float:
    """
    THE REASON EVERY PROP SHIPPED PASTEL.

    Blender's Base Color input is LINEAR. A hex colour off a palette is sRGB.
    Handing `int(hex) / 255` straight to the shader tells Blender that #E14B45's
    0.29 green is a linear 0.29, and the render then encodes it back out through
    sRGB on the way to the PNG -- which lifts mid-tones hard. Under a perfectly
    neutral unit light and with no other change, #E14B45 comes back as #F1948E,
    #37B4CD as #80DBE8, #8A3FD6 as #C288EC. Three dusty pastels, from three
    candy colours, with nothing in the lighting or the view transform at fault.

    This is what the AgX fix could not reach. Dropping AgX stopped the highlight
    shoulder from rolling saturated pixels toward white and it measurably helped,
    but the base colours were already wrong before a single light hit them, so
    Town stayed washed and the doc that recorded that pass said so plainly:
    "it did not fix everything".
    """
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def rgb(value: str):
    value = value.lstrip('#')
    return tuple(_srgb_to_linear(int(value[i:i+2], 16) / 255) for i in (0, 2, 4))


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
    # STANDARD, NOT AgX -- see tools/blender/world_prop_pack.py for the
    # measurement. AgX rolls saturated highlights toward white by design, which
    # is what turned every authored candy colour in this pack into pastel.
    try:
        scene.view_settings.view_transform = 'Standard'
    except (TypeError, ValueError):
        pass
    try:
        scene.view_settings.look = 'None'
    except (TypeError, ValueError):
        pass

    bpy.ops.object.camera_add(location=CAMERA_LOCATION)
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 6.1
    look_at(cam, (0, 0, 1.55))
    scene.camera = cam

    bpy.ops.object.light_add(type='AREA', location=(-4.5, -4.8, 8.0))
    key = bpy.context.object
    key.data.energy = 845
    key.data.size = 5.0
    key.data.color = light_rgb("key")
    look_at(key, (0, 0, 1.4))

    bpy.ops.object.light_add(type='AREA', location=(4.5, -2.0, 4.0))
    fill = bpy.context.object
    fill.data.energy = 245
    fill.data.size = 5.0
    fill.data.color = light_rgb("fill")
    look_at(fill, (0, 0, 1.4))

    bpy.ops.object.light_add(type='AREA', location=(0.8, 3.5, 6.4))
    rim = bpy.context.object
    rim.data.energy = 365
    rim.data.size = 3.8
    rim.data.color = light_rgb("key")
    look_at(rim, (0, 0, 1.4))


def build_window_frame():
    wood = mat("Honey molded wood", tone("wood", "base"), roughness=0.44, coat=0.09)
    wood_dark = mat("Recess edge", tone("wood", "shade"), roughness=0.56, coat=0.04)
    sill = mat("Warm sill", tone("wood", "lit"), roughness=0.42, coat=0.10)
    brass = mat("Upgrade brass", tone("sun", "base"), roughness=0.30, metallic=0.55, coat=0.05)

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


# A BUILDERS TABLE, for a pack that renders exactly one thing.
#
# Not ceremony: `scripts/promote-props.py` derives what it ships from a pack's
# own BUILDERS, and the rule that nothing is hand-listed is what stops a second
# copy of the shipping recipe growing back. Until this table existed, the way
# window_frame.png reached the app was a `cp` line in a workflow -- and that
# workflow was quietly overwriting the four home props with unquantised,
# uncontoured renders every time it ran.
BUILDERS = {
    "window_frame": (build_window_frame, None, None, {"displayWidth": 224, "anchor": "bottom"}),
}



def stamp_pack(out_dir):
    """Record WHICH VERSION of this file rendered into `out_dir`.

    `scripts/promote-props.py` reads this instead of comparing modification
    times. Times are rewritten by `git rebase`, `git checkout` and a fresh
    clone without a byte of the pack changing -- which marked every render
    stale and cost a fifteen-minute re-render to produce identical files --
    and a `git stash pop` can restore an older pack with a newer time, which
    the time check waved straight through.

    Written LAST, after every render in the run succeeded. A pass that dies
    halfway must not leave a marker saying the directory is current.
    """
    digest = hashlib.sha256(Path(__file__).resolve().read_bytes()).hexdigest()
    (out_dir / ".pack-sha256").write_text(digest + "\n", encoding="utf-8")


def main():
    # Same PROP_ONLY narrowing the other two packs take, so the refusal message
    # promote-props prints for a stale render is a command that actually runs.
    only = os.environ.get("PROP_ONLY", "").strip()
    for name, (builder, _scale, _target, _metadata) in BUILDERS.items():
        if only and not name.startswith(only):
            continue
        clean()
        setup()
        builder()
        scene = bpy.context.scene
        scene.render.filepath = str(OUT / f"{name}.png")
        bpy.ops.render.render(write_still=True)
        print(f"rendered {scene.render.filepath}")
    if not only:
        stamp_pack(OUT)


main()
