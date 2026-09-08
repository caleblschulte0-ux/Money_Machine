"""Render Barkly's locations as COMPOSED, LIT PLACES rather than loose props.

The prop pack's docstring states the old contract plainly: "This intentionally
does not render complete backgrounds. React Native supplies the sky, terrain,
time of day, responsive layout, interactions, and upgrade state." Everything
that contract asks React Native to do, React Native has been doing with
gradients -- and every improvement made on top of it has been a correction
inside that frame: a haze gradient because there was no aerial perspective, an
ellipse because there were no cast shadows, soft blobs because there was no
terrain.

Those are all approximations of ONE thing the old pipeline structurally cannot
produce: a scene where the objects and the ground are lit together. A prop
rendered alone has no idea the tree beside it exists. It cannot occlude it,
cannot catch bounce off it, cannot darken where it meets it, and cannot throw a
shadow across it. No amount of compositing at runtime adds that back, because
the information was never rendered.

So this renders each location as one 3D place, with real shadows, real ambient
occlusion, and one sun -- and hands the app a single plate.

WHAT THE APP KEEPS. The film stays transparent and the sky is NOT baked in, so
React Native still owns the sky gradient, the sun and moon, the four-band
master grade, the weather of the hour, and every dynamic object -- Barkly, the
NPCs, the ball, the dig site, the care tray. What moves into the plate is only
the part that never changes and always wanted to be lit as a whole: the ground
and the scenery standing on it.

Run:
  blender -b --python tools/blender/world_scene_pack.py
  SCENE_ONLY=park blender -b --python tools/blender/world_scene_pack.py
"""
from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

# The prop builders, the palette conversion and the primitives are all shared.
# This is a new way to COMPOSE the same world, not a second world.
import world_prop_pack as pack  # noqa: E402

OUT = ROOT / "art-review" / "world-scenes"
OUT.mkdir(parents=True, exist_ok=True)

# A portrait slice of the world, framed on the ground the dog stands on.
RESOLUTION = (768, 1365)
CAMERA_LOCATION = (3.0, -10.8, 4.5)
# How far back the camera stands along its OWN axis. An orthographic camera's
# framing does not change when it dollies back -- only its clipping does -- and
# the first two renders came out with the bottom two fifths of the frame empty
# because the near ground fell behind the camera plane and was clipped away.
# Scaling the position keeps atan2(x, -y) identical, so the yaw every prop in
# the shared pack is built against is untouched.
CAMERA_BACKOFF = 2.8

# EVERY POSITION IN THIS FILE IS IN THE CAMERA'S FRAME, not the world's.
#
# The shared camera is yawed 15.6 degrees off the X axis, so a world-aligned
# ground plane renders with DIAGONAL edges -- and since the horizon here is the
# far edge of that plane, a world-aligned ground gives a slanted horizon. The
# wide props in the prop pack already solve this by building in the camera's
# frame; a whole scene wants the same thing for a better reason: `x` becomes
# "across the screen" and `y` becomes "into the distance", which is how you
# actually compose a shot.
THETA = pack.camera_yaw()
TURN = pack.facing(THETA)


def clean():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.materials):
        if block.users == 0:
            bpy.data.materials.remove(block)


def setup(ortho_scale: float, target, sun_energy: float, sun_color, ambient: str):
    """One sun, real shadows, real occlusion -- the whole point of this pack.

    The prop pack lights each object with a three-area-light studio rig, which
    is right for an object on a turntable and is exactly why a room full of
    them never looked like a room: every prop is lit as though it were the only
    thing in the world. Here there is a SUN, it casts, and the ground receives.
    """
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except (TypeError, ValueError):
        scene.render.engine = "BLENDER_EEVEE"

    scene.render.resolution_x, scene.render.resolution_y = RESOLUTION
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    # The sky is not baked. React Native keeps it, along with the time of day.
    scene.render.film_transparent = True

    # Standard, for the same reason the prop pack uses it: this is stylised
    # game art, where the flat saturated colour IS the look, and a filmic
    # shoulder rolls exactly those colours toward white.
    try:
        scene.view_settings.view_transform = "Standard"
        scene.view_settings.look = "None"
    except (TypeError, ValueError):
        pass

    eevee = scene.eevee
    for attr, value in (
        ("use_gtao", True),            # ambient occlusion: where things MEET
        ("gtao_distance", 0.8),
        ("gtao_factor", 1.0),
        ("use_soft_shadows", True),
        ("shadow_cube_size", "2048"),
        ("shadow_cascade_size", "2048"),
        ("use_shadow_high_bitdepth", True),
        ("taa_render_samples", 64),
    ):
        if hasattr(eevee, attr):
            try:
                setattr(eevee, attr, value)
            except (TypeError, ValueError):
                pass

    # Ambient light stands in for the sky the app will draw behind this.
    scene.world.use_nodes = False
    scene.world.color = pack.rgb(ambient)

    bpy.ops.object.camera_add(location=tuple(v * CAMERA_BACKOFF for v in CAMERA_LOCATION))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    camera.data.sensor_fit = "HORIZONTAL"
    camera.data.clip_start = 0.1
    camera.data.clip_end = 300.0
    pack.look_at(camera, target)
    scene.camera = camera

    # THE sun. One light, one direction, and it casts.
    bpy.ops.object.light_add(type="SUN", location=(-6.0, -4.0, 9.0))
    sun = bpy.context.object
    sun.name = "Sun"
    sun.data.energy = sun_energy
    sun.data.color = pack.rgb(sun_color)
    # A disc, not a point: this is what makes a shadow soften with distance
    # from the thing casting it, which no ellipse under a prop can imitate.
    sun.data.angle = math.radians(3.2)
    pack.look_at(sun, target)

    # A cool bounce from the sky side, weak, no shadows of its own.
    bpy.ops.object.light_add(type="AREA", location=(5.0, -3.0, 5.0))
    fill = bpy.context.object
    fill.name = "Sky bounce"
    fill.data.energy = 220
    fill.data.size = 9.0
    fill.data.color = pack.rgb("#9EC8FF")
    if hasattr(fill.data, "use_shadow"):
        fill.data.use_shadow = False
    pack.look_at(fill, target)
    return camera


def ground(hex_near: str, centre: float = -22.0, size: float = 100.0):
    """The ground, as geometry. It receives shadow and it occludes.

    AN ORTHOGRAPHIC CAMERA HAS NO HORIZON. Every ray is parallel, so an
    infinite ground plane under a tilted ortho camera fills the entire frame
    and the sky never appears -- which is exactly what the second attempt here
    rendered, a field from edge to edge with nowhere for the sky to be. The
    perspective horizon everybody pictures is a property of a PERSPECTIVE
    camera, and this pack is orthographic on purpose, because that is what
    every prop and the dog himself are rendered with.

    So the horizon here is a real edge: the far side of the ground, which
    projects to a straight line because a straight edge under a parallel
    projection is straight. Sized so the near edge stays out of shot and the
    far edge lands near the top of the frame, with the treeline standing just
    inside it so canopies break the line into sky.
    """
    cx, cy = TURN(0.0, centre)
    bpy.ops.mesh.primitive_plane_add(size=size, location=(cx, cy, 0), rotation=(0, 0, THETA))
    plane = bpy.context.object
    plane.name = "ground"
    plane.data.materials.append(pack.material("Ground", hex_near, roughness=0.95))
    return plane


def park():
    """The park, composed.

    Positions are in world units on the ground plane, chosen so the middle of
    the frame stays clear -- that is where the dog stands, and he is drawn by
    the app on top of this.
    """
    ground("#6FBF4A")

    # The far treeline, as real trees at distance rather than a painted band.
    # A treeline far enough back to be a horizon, spread wider than the frame.
    for i in range(21):
        x = -26.0 + i * 2.6
        y = 21.5 + ((i * 0.618) % 1.0) * 3.0
        s = 1.7 + ((i * 0.382) % 1.0) * 0.8
        _tree(x, y, s, canopy="#5FA83C", trunk="#7A5233")

    # Then the trees that frame the shot: two near the edges, two mid-distance.
    for x, y, s in ((-7.6, -3.0, 1.6), (8.2, -1.4, 1.5), (-11.5, 9.0, 1.25), (12.5, 7.5, 1.2)):
        _tree(x, y, s)

    _path()
    _bench(5.4, -1.6)

    # Scatter. Placed by a repeatable sequence, never at random, so a re-render
    # is the same park.
    for i in range(70):
        t = (i * 0.6180339887) % 1.0
        u = (i * 0.3819660113) % 1.0
        x = -15.0 + t * 30.0
        y = -30.0 + u * 52.0
        if abs(x) < 3.0 and y < 0.0:
            continue  # the dog stands here
        _tuft(x, y, 0.7 + u * 0.7)


def _poly(name: str, points, z: float, mat):
    """One flat n-gon on the ground, from points already in the camera frame."""
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(*TURN(x, y), z) for x, y in points], [], [list(range(len(points)))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def _path():
    """A worn strip down the middle, as GEOMETRY on the ground.

    The app draws this as a translucent SVG ribbon, and a documented ruling
    keeps it deliberately faint -- "a worn place in the grass, not a feature
    competing with the dog standing on it". That ruling is about how LOUD it
    is, not what it is made of, so the colour here stays close to the grass; the
    difference is that it now takes the same sun and catches the same tree
    shadows, because it is part of the same ground.

    ONE n-gon, not a stack of cubes. The first attempt laid 26 overlapping
    boxes down the field and rendered a jagged staircase with a hard edge on
    every step -- a path is a shape, and a shape is one polygon.
    """
    dirt = pack.material("Path", "#93A867", roughness=0.96)
    left, right = [], []
    for i in range(15):
        t = i / 14.0
        y = -46.0 + t * 72.0
        w = 3.4 - t * 2.8          # narrows with distance, because it does
        wobble = math.sin(t * 5.2) * 0.5
        left.append((wobble - w, y))
        right.append((wobble + w, y))
    _poly("path", left + right[::-1], 0.010, dirt)


def _tree(x: float, y: float, s: float, canopy: str = "#5CB03A", trunk: str = "#8A5C39"):
    bark = pack.material(f"Bark{x:.1f}{y:.1f}", trunk, roughness=0.92)
    leaf = pack.material(f"Leaf{x:.1f}{y:.1f}", canopy, roughness=0.88)
    leaf_hi = pack.material(f"LeafHi{x:.1f}{y:.1f}", "#7BC855", roughness=0.86)
    wx, wy = TURN(x, y)
    pack.cylinder(f"trunk{x:.1f}{y:.1f}", (wx, wy, 1.35 * s), 0.30 * s, 2.7 * s, bark)
    for i, (dx, dy, dz, r) in enumerate((
        (0.0, 0.0, 3.3, 1.45), (-0.85, 0.15, 3.0, 1.05),
        (0.9, -0.1, 3.05, 1.0), (0.1, 0.5, 3.75, 0.95),
    )):
        lx, ly = TURN(x + dx * s, y + dy * s)
        pack.sphere(f"leaf{x:.1f}{y:.1f}_{i}",
                    (lx, ly, dz * s),
                    (r * s, r * s, r * 0.85 * s),
                    leaf_hi if i == 3 else leaf)


def _bench(x: float, y: float):
    wood = pack.material("Bench wood", "#D2762F", roughness=0.72)
    iron = pack.material("Bench iron", "#3B3B44", roughness=0.60, metallic=0.4)
    for i, (dz, dy) in enumerate(((0.72, 0.0), (0.98, -0.20), (1.24, -0.34))):
        bx, by = TURN(x, y + dy)
        pack.cube(f"slat{i}", (bx, by, dz), (1.55, 0.10, 0.055), wood, 0.03,
                  rotation=(0, 0, THETA))
    for i, sx in enumerate((-1.3, 1.3)):
        lx, ly = TURN(x + sx, y)
        pack.cube(f"leg{i}", (lx, ly, 0.36), (0.07, 0.09, 0.36), iron, 0.02,
                  rotation=(0, 0, THETA))


def _tuft(x: float, y: float, s: float):
    mats = (
        pack.material(f"Blade{x:.2f}{y:.2f}a", "#5FB53A", roughness=0.90),
        pack.material(f"Blade{x:.2f}{y:.2f}b", "#79C94F", roughness=0.90),
    )
    for i in range(5):
        a = (i / 5.0) * math.tau + x
        lean = 0.22 + ((i * 0.618) % 1.0) * 0.18
        h = (0.42 + ((i * 0.382) % 1.0) * 0.30) * s
        bx, by = TURN(x + math.cos(a) * 0.12, y + math.sin(a) * 0.12)
        blade = pack.cone(f"bl{x:.2f}{y:.2f}{i}", (bx, by, h / 2),
                          0.045 * s, 0.004, h, mats[i % 2],
                          rotation=(math.cos(a) * lean, math.sin(a) * lean, 0), vertices=8)
        blade.scale = (1.0, 0.34, 1.0)


SCENES = {
    "park": (park, 17.0, (0.0, 3.0, 1.0), 4.2, "#FFE2B4", "#7FA8C8"),
}


def main():
    only = os.environ.get("SCENE_ONLY", "").strip()
    manifest = {
        "camera": "Barkly composed scene v1 (orthographic, one sun, EEVEE shadows + AO)",
        "contract": "one lit plate per location; app keeps sky, grade, and every dynamic object",
        "resolution": list(RESOLUTION),
        "scenes": {},
    }
    for name, (builder, ortho, target, energy, sun_hex, ambient) in SCENES.items():
        if only and name != only:
            continue
        clean()
        setup(ortho, target, energy, sun_hex, ambient)
        builder()
        path = OUT / f"{name}.png"
        bpy.context.scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        print(f"rendered {path}")
        manifest["scenes"][name] = {"file": f"{name}.png"}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
